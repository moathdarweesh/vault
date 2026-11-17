// «ماذا آكل الآن؟» (v436) — THE ENGINE, run on the real app code.
//
// One meal, its calories worked out and its portion fitted on a quarter-
// serving step to what is left of the day for the meal of the hour, from any
// source the device holds (the ready meals, the catalogue's dishes of
// WTE_CAT, the user's own recipes, meal bundles). This suite loads the REAL
// js/storage.js, i18n, catalog, ui and food.js in a vm (the loader of
// scripts/test-shared-recipes.js: context() from test-sync-status.js, then
// the four files whole) and holds:
//   N0       the sixteen pure functions and the two helpers they call
//            (wteHour, wteItemCopy) are top-level, end at their first
//            column-0 brace, and touch no store, clock, page or network;
//   N1–N48   the specification's table (spec-final.md §9.1), every expected
//            value recomputed against the rule, the three WTE_CAT overrides
//            of the build notes included (Jamriyah and Marasee a breakfast or
//            a snack, Masoub a breakfast or a dinner);
//   N49      wteAsk, the shell's question, on the real store (one preset that
//            throws costs one meal; a row with no stamp never moves the period);
//   N50      the cycle filter's last two fallbacks (a budget far from every meal);
//   N51      wteAsk hands back its pool (the tap asks the question again by it);
//   N52      a bundle row repeated by «كرّر الأمس» or a recent chip keeps its
//            sourceId, so it is still eaten today (the two copies, sliced
//            from js/food.js and run);
//   N53      the after-line against the REAL ring: picks logged through the
//            store, nutritionGauge read, then undone;
//   the grid P1–P15 (§4.5, and P15: the list in the rule's order, its
//            shortfall and distance labels recomputed): 103,680 budgets × their ranked lists, plus the
//            reversed pool, the no-target hours, the small band on a 0.1 kcal
//            step and the onsets of a tier-1 and an out-of-period answer —
//            run whole inside ONE vm call (a cross-context call per cell is
//            the slow part).
// Each case prints its own line; the run fails (exit 1) if any case does, and
// the PASS line names its counts. Node built-ins only, no network.
// Run: node scripts/test-what-to-eat.js
//
// js/food.js is read with CRLF normalised to LF wherever its text is sliced
// (N0, N44, N52): a Windows checkout (core.autocrlf) is not a defect.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context } = require('./test-sync-status');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
// The source as TEXT to slice: CRLF normalised once (a CRLF checkout must not fail a case).
const readLF = (name) => read(name).replace(/\r\n/g, '\n');
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const deq = (got, want, msg) => assert.deepEqual(plain(got), plain(want), msg);
const json = (v) => JSON.stringify(v);

// The app with the whole food domain (test-shared-recipes.js's foodApp).
function foodApp(lang) {
  const h = context();
  for (const f of ['js/i18n.js', 'js/catalog.js', 'js/ui.js', 'js/food.js']) vm.runInContext(read(f), h.c);
  const run = (code) => vm.runInContext(code, h.c);
  run(`DB.prefs.setLang(${json(lang || 'en')})`);
  const W = run(`({ WTE, WTE_CAT, SHR_PERIODS, wtePeriod, wteBudget, wtePortion, wteRank, wteReadyRow, wteRecipeRow, wteCatRow, wteBundleRow,
    wteNext, wteWord, wteAfter, wteEatenKeys, wteItems, wteEntry, wteHeadHtml, wteAnswerHtml, wtePool, wteAsk, t, fmtNum, recScaleQty,
    recViewRowsHtml, shrMealName, FOOD_PRESETS, SUGGESTION_PRESETS, suggestionItems })`);
  const DB = h.c.DB;
  const fold = (s) => DB.search.fold(s);
  return { h, DB, run, W, fold };
}
// A store-backed app's clock pinned to an hour of 17 November 2026, local time:
// `new Date()` and Date.now() read it (the log's stamps and wteAsk's hour too);
// a Date built from arguments is an ordinary Date.
function pinClock(app, hour) {
  app.run(`(() => { const RD = globalThis.__qaRealDate || (globalThis.__qaRealDate = Date);
    const T = new RD(2026, 10, 17, ${Number(hour)}, 0, 0).getTime();
    Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }; })()`);
  assert.equal(app.run('new Date().getHours()'), hour, 'setup: the clock pinned at ' + hour + ':00');
}

// Short spelling of a pick: «greek-yogurt-berries×1.5=371», «cat:Mansaf×1.25=1050».
const short = (id) => String(id).replace('builtin:sg-', '').replace('catalog:', 'cat:');
const fmt = (x) => short(x.id) + '×' + x.p + '=' + x.kcal;
const fmts = (list) => plain(list).map(fmt);

// The recipe r1 (§9.1: 4 servings, 600/45/50/20 per serving, «800 g» of meat),
// and the two bundles: b1 392/37/42/9 (max 20 → maxPor 2), b2 one item at 16
// servings, 300 kcal in all (maxPortion floor(20/16 × 4)/4 = 1.25).
const R1 = { id: 'r1', name: 'House Mansaf', servings: 4, items: [{ name: 'Lamb', qty: '800 g', calories: 2400, protein: 180, carbs: 200, fat: 80 }] };
const R1_PER = { calories: 600, protein: 45, carbs: 50, fat: 20 };
const B1 = { id: 'b1', name: 'Club breakfast', items: [{ name: 'Eggs', servings: 1, calories: 392, protein: 37, carbs: 42, fat: 9 }] };
const B2 = { id: 'b2', name: 'Oats pot', items: [{ name: 'Oats', servings: 16, calories: 18.75, protein: 1.875, carbs: 1.25, fat: 0.625 }] };

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// The app once, in English, for every case that does not change the store.
const A = foodApp('en');
const W = A.W;
const DAY1 = A.run('wtePool()');
const ask = (o, pool, eaten) => {
  const b = W.wteBudget(o);
  return { b: plain(b), list: W.wteRank(pool || DAY1, b, eaten || []), raw: b };
};
const keysOf = (id) => plain(DAY1).find((r) => r.id === id).keys;

// ---------------------------------------------------------------- N0. pure, top-level, in its place
const PURE = ['wtePeriod', 'wteBudget', 'wtePortion', 'wteRank', 'wteReadyRow', 'wteRecipeRow', 'wteCatRow', 'wteBundleRow',
  'wteNext', 'wteWord', 'wteAfter', 'wteEatenKeys', 'wteItems', 'wteEntry', 'wteHeadHtml', 'wteAnswerHtml',
  // the two helpers the rule's own bodies call (contract 82(a) holds them too): an
  // impure helper makes every caller impure, and the grid would measure another rule
  'wteHour', 'wteItemCopy'];
// Date( without new, performance and a bare STATE read the clock or the raw store too.
const FORBIDDEN = /\bDB\.|\bdocument\b|\bwindow\b|localStorage|todayISO\(|new Date|\bDate\(|Date\.now|\bperformance\b|\bSTATE\b|Math\.random|\bCloud\b|navigate\(/;
test('N0 the pure functions', () => {
  const src = readLF('js/food.js');
  const lines = src.split('\n');
  const body = (name) => {
    const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
    assert.ok(start >= 0, `${name} is a top-level function in js/food.js`);
    const end = lines.findIndex((l, i) => i > start && l === '}');
    assert.ok(end > start, `${name} ends at a column-0 brace`);
    return lines.slice(start + 1, end).join('\n');
  };
  for (const name of PURE) {
    const m = body(name).match(FORBIDDEN);
    assert.ok(!m, `${name} touches «${m && m[0]}»: the rule must be pure`);
  }
  // In its place: after shrDoorHtml, before THE PAGE (v422); WTE on one line.
  const at = (s) => src.indexOf(s);
  assert.ok(at('function shrDoorHtml(') < at('\nconst WTE = {') && at('\nconst WTE = {') < at('\n// ---- THE PAGE (v422)'), 'the section sits after shrDoorHtml and before THE PAGE (v422)');
  assert.ok(/^const WTE = \{[^\n]*\};$/m.test(src), 'const WTE is one line');
  for (const name of ['wtePool', 'wteAsk']) assert.ok(at(`\nfunction ${name}(`) > at('\nconst WTE = {') && at(`\nfunction ${name}(`) < at('\n// ---- THE PAGE (v422)'), `${name} is in the section`);
  const pool = body('wtePool');
  for (const s of ['SUGGESTION_PRESETS', 'FOOD_PRESETS', 'DB.recipes.list()', 'DB.mealBundles.list()']) assert.ok(pool.includes(s), `wtePool reads ${s}`);
  for (const s of ['suggestionPool(', 'sharedPool(', 'SHARED_RECIPES', 'Cloud', 'allFoodPresets(']) assert.ok(!pool.includes(s), `wtePool never reads ${s}`);
});

// ---------------------------------------------------------------- N1. the constants
test('N1 WTE and WTE_CAT', () => {
  deq(W.WTE, { share: { breakfast: 18, lunch: 23, snack: 23, dinner: 36 }, night: 5, floor: 150, ceil: 0.5, done: 50, tolMin: 50, tol: 0.1, near: 0.25, minQ: 2, maxQ: 8, aimKg: 0.4, aim: 30, aimStep: 5, moved: 150 }, 'WTE is §4.1');
  assert.equal(Object.keys(W.WTE_CAT).length, 51, '51 catalogue dishes');
  // The integrator's three overrides (build notes §1).
  deq(W.WTE_CAT.Jamriyah, ['breakfast', 'snack'], 'Jamriyah: a breakfast or a snack');
  deq(W.WTE_CAT.Marasee, ['breakfast', 'snack'], 'Marasee: a breakfast or a snack');
  deq(W.WTE_CAT.Masoub, ['breakfast', 'dinner'], 'Masoub: a breakfast or a dinner');
  deq(W.WTE_CAT['Haneeth with Rice'], ['lunch', 'dinner'], 'and the rest as the spec wrote them');
});

// ---------------------------------------------------------------- N2/N3. the period
test('N2 wtePeriod by the clock', () => {
  const hours = [0, 4, 5, 10, 11, 15, 16, 18, 19, 23, 99, 'x'];
  deq(hours.map((h) => W.wtePeriod(h, [])), ['snack', 'snack', 'breakfast', 'breakfast', 'lunch', 'lunch', 'snack', 'snack', 'dinner', 'dinner', 'lunch', 'lunch']);
});
test('N3 the advance', () => {
  const got = [[10, [{ h: 6, kcal: 150 }]], [10, [{ h: 6, kcal: 149 }]], [11, [{ h: 10, kcal: 400 }]], [20, [{ h: 19, kcal: 900 }]], [23, [{ h: 19, kcal: 149 }]],
    [17, [{ h: 16, kcal: 100 }, { h: 17, kcal: 60 }]], [13, [{ h: 14, kcal: 500 }]], [2, [{ h: 1, kcal: 500 }]], [21, [{ h: 4, kcal: 500 }]]].map(([h, a]) => W.wtePeriod(h, a));
  deq(got, ['lunch', 'breakfast', 'lunch', 'snack', 'dinner', 'dinner', 'lunch', 'snack', 'dinner'],
    '150 moves breakfast to lunch, 149 does not, another period\'s hours do not count, dinner moves to the snack, two rows add up, a later hour does not count, the night never moves, a night row does not count');
});

// ---------------------------------------------------------------- N4–N8. the budget and the portion
test('N4 no target', () => {
  const a = plain(W.wteBudget(null));
  deq([a.state, a.period, a.aim], ['notarget', 'lunch', 30], 'null: no target, noon, the default aim');
  deq(plain(W.wteBudget({ target: 'x', eaten: 5, hour: 99 })).state + '/' + plain(W.wteBudget({ target: 'x', eaten: 5, hour: 99 })).period, 'notarget/lunch');
  deq(plain(W.wteBudget({ hour: 8 })).period, 'breakfast');
  const b = plain(W.wteBudget({ target: 2000, eaten: NaN, hour: 8 }));
  deq([b.state, b.kcal, b.eaten], ['meal', 360, 0], 'a NaN eaten counts as 0, as the ring');
});
test('N5 done', () => {
  const a = plain(W.wteBudget({ target: 2000, eaten: 1950.6, hour: 12 }));
  deq([a.state, a.left], ['done', 49], '49.4 left is done (the ring reads 49)');
  const b = plain(W.wteBudget({ target: 2000, eaten: 2240, hour: 21 }));
  deq([b.state, b.left], ['done', -240], 'over the target is done');
  const c = plain(W.wteBudget({ target: 2000, eaten: 1950.4, hour: 12 }));
  deq([c.state, c.left, c.kcal, c.tol], ['meal', 50, 50, 50], '49.6 left reads 50: a meal, B 50, tol 50');
});
test('N6 the budgets', () => {
  const B = (o) => plain(W.wteBudget(o));
  deq([B({ target: 2000, eaten: 0, hour: 8 }).kcal, B({ target: 2000, eaten: 0, hour: 8 }).tol], [360, 50], '2000/0@8: 360, tol 50');
  const e4 = B({ target: 2000, eaten: 500, hour: 13, ate: [{ h: 8, kcal: 500 }], kg: 80, proteinLeft: 110 });
  deq([e4.period, e4.kcal, e4.aim], ['lunch', 421, 32], 'E4: lunch 421, aim 32');
  deq([B({ target: 2000, eaten: 0, hour: 20 }).kcal, B({ target: 2000, eaten: 0, hour: 20 }).tol], [1000, 100], '2000/0@20: the ceiling, 1000');
  deq([B({ target: 3500, eaten: 0, hour: 20 }).kcal, B({ target: 3500, eaten: 0, hour: 20 }).tol], [1750, 175]);
  const n1 = B({ target: 2000, eaten: 0, hour: 1 });
  deq([n1.period, n1.late, n1.kcal], ['snack', true, 460], '01:00: a late snack of 460');
  const n2 = B({ target: 500, eaten: 0, hour: 1 });
  deq([n2.period, n2.late, n2.kcal], ['snack', true, 150], '500/0@1: floored to 150');
  deq(B({ target: 200, eaten: 0, hour: 20 }).kcal, 100, '200/0@20: half the target');
  const s1 = B({ target: 2000, eaten: 0, hour: 16 });
  deq([s1.period, s1.late, s1.kcal], ['snack', false, 460], '16:00, nothing eaten: the snack cap 460 (raw 780)');
  deq(B({ target: 1500, eaten: 0, hour: 16 }).kcal, 345, '1500/0@16: 345');
  const d = B({ target: 2800, eaten: 1700, hour: 20, ate: [{ h: 19, kcal: 900 }] });
  deq([d.period, d.late, d.kcal], ['snack', true, 253], 'after dinner: a late snack of 253');
});
test('N7 the protein aim', () => {
  const aim = (o) => plain(W.wteBudget(Object.assign({ target: 2000, eaten: 0, hour: 8 }, o))).aim;
  deq([aim({ kg: 75 }), aim({ kg: 120, proteinLeft: 15.6 }), aim({ kg: 80, proteinLeft: -10 }), aim({ kg: 10 })], [30, 16, 0, 30]);
});
test('N8 wtePortion', () => {
  const B = (o) => W.wteBudget(o);
  deq(W.wtePortion(800, B({ target: 2000, eaten: 1100, hour: 20 }), 2), { p: 1, kcal: 800, err: 100 }, '×1.25 would pass the target');
  deq(W.wtePortion(400, B({ target: 2500, eaten: 0, hour: 8 }), 2), { p: 1, kcal: 400, err: 50 }, 'a tie goes to the smaller portion');
  assert.equal(W.wtePortion(0, B({ target: 2500, eaten: 0, hour: 8 }), 2), null, 'no kcal, no portion');
  assert.equal(W.wtePortion(200, B({ target: 2000, eaten: 1920, hour: 20 }), 2), null, 'every half portion passes the target');
  deq(W.wtePortion(300, B({ target: 2500, eaten: 0, hour: 8 }), 1.25), { p: 1.25, kcal: 375, err: 75 }, 'the bundle ceiling binds');
  deq(W.wtePortion(300, B({ target: 2500, eaten: 0, hour: 8 }), 2), { p: 1.5, kcal: 450, err: 0 }, 'without it, ×1.5');
  assert.equal(W.wtePortion(300, B({ hour: 8 }), 2), null, 'no target, no portion');
});

// ---------------------------------------------------------------- N9–N34. the worked examples
test('N9 E1: day one, no target, 08:00', () => {
  const { list } = ask({ hour: 8 });
  assert.equal(list.length, 22, 'the 22 breakfasts (the spec said 21; Marasee joins breakfast by the override)');
  deq(fmts(list.slice(0, 4)), ['cottage-strawberries×1=179', 'greek-yogurt-berries×1=247', 'eggs-labneh-bread×1=437', 'cat:Shakshuka×1=350']);
  deq([list[0].protein, list[0].carbs, list[0].fat], [18, 12, 7], 'cottage: 17.5→18, 11.5→12, 6.5→7');
  assert.ok(plain(list).every((x) => x.p === 1 && x.o === 0), 'one serving, in the period');
  assert.ok(!plain(list).some((x) => x.id === 'catalog:Haneeth with Rice'), 'no lunch dish at breakfast');
});
test('N10 E2: no target, 13:00', () => {
  const { list } = ask({ hour: 13 });
  deq(fmt(plain(list)[0]), 'cat:Haneeth with Rice×1=440');
  deq([list[0].protein, list[0].carbs, list[0].fat], [45, 44, 7]);
  assert.equal(list.length, 45, 'the 45 lunches (the spec said 46; Marasee leaves lunch by the override)');
});
test('N11 E1 with the cottage eaten', () => {
  const { list } = ask({ hour: 8 }, DAY1, ['builtin:sg-cottage-strawberries']);
  assert.equal(list[0].id, 'builtin:sg-greek-yogurt-berries', 'greek first');
  assert.equal(list[list.length - 1].id, 'builtin:sg-cottage-strawberries', 'the eaten one last, never removed');
});
test('N12 E3: 2000/0@8', () => {
  const { list, raw } = ask({ target: 2000, eaten: 0, hour: 8 });
  deq(fmt(plain(list)[0]), 'greek-yogurt-berries×1.5=371');
  deq([list[0].protein, list[0].carbs, list[0].fat], [33, 26, 16]);
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1630 }, '2000 − 370.5 = 1629.5 → 1630, the ring\'s figure');
  assert.equal(list.length, 21);
  deq(fmt(plain(list)[1]), 'cottage-strawberries×2=358');
});
test('N13 E4: 2000/500@13, 80 kg, 110 g left', () => {
  const { list, raw } = ask({ target: 2000, eaten: 500, hour: 13, ate: [{ h: 8, kcal: 500 }], kg: 80, proteinLeft: 110 });
  deq(fmt(plain(list)[0]), 'cat:Fried Chicken Drumsticks×1=430');
  deq([list[0].protein, list[0].carbs, list[0].fat], [32, 18, 26]);
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1070 });
  assert.equal(list.length, 40, 'forty lunches within ±50');
  assert.ok(plain(list).every((x) => x.o === 0 && x.tier === 0), 'every pick in the period and within tolerance');
  deq(fmts(list.slice(1, 7)), ['cat:Haneeth with Rice×1=440', 'chicken-wrap-veg×1=442', 'cat:Fried Chicken Breast Piece×1=450', 'fish-rice-veg×0.75=426', 'tuna-salad×1.25=434', 'chicken-pasta-veg×0.75=436']);
});
test('N14 E5: the drumsticks logged, asked again', () => {
  const { list, raw, b } = ask({ target: 2000, eaten: 930, hour: 13, ate: [{ h: 8, kcal: 500 }, { h: 13, kcal: 430 }], kg: 80, proteinLeft: 78 }, DAY1, keysOf('catalog:Fried Chicken Drumsticks'));
  deq([b.period, b.kcal], ['snack', 417], 'the question moves on to the snack, B 417');
  deq(fmt(plain(list)[0]), 'protein-shake-dates×1.25=384');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 686 });
  assert.equal(list.length, 16, '16 snacks (the spec said 15; Jamriyah ×1.25 = 456 joins the snack by the override)');
  assert.ok(plain(list).some((x) => fmt(x) === 'cat:Jamriyah×1.25=456'), 'Jamriyah is the one that joined');
});
test('N15 E6: 300 left at 20:00', () => {
  const { list, raw } = ask({ target: 2000, eaten: 1700, hour: 20 });
  deq(fmt(plain(list)[0]), 'chicken-pasta-veg×0.5=291');
  deq(W.wteAfter(raw, list[0]), { done: true, n: 10 });
  assert.equal(list.length, 31);
  // The after-line's threshold, exactly: 50 left is still a figure, 49 completes the goal.
  const at = (kcal) => plain(W.wteAfter({ state: 'meal', target: 2000, eaten: 1000 }, { row: { kcal }, p: 1 }));
  deq([at(950), at(951), at(1000)], [{ done: false, n: 50 }, { done: true, n: 49 }, { done: true, n: 0 }], '50 left reads 50; under 50 the goal completes');
});
test('N16 E7: 01:00, nothing eaten', () => {
  const { list, raw, b } = ask({ target: 2000, eaten: 0, hour: 1 });
  deq([b.period, b.late, b.kcal], ['snack', true, 460]);
  deq(fmt(plain(list)[0]), 'protein-shake-dates×1.5=461');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1540 });
});
test('N17 E8: 2000/0@20', () => {
  const { list, raw } = ask({ target: 2000, eaten: 0, hour: 20 });
  deq(fmt(plain(list)[0]), 'cat:Mansaf×1.25=1050');
  deq([list[0].protein, list[0].carbs, list[0].fat], [54, 71, 58]);
  deq(W.wteAfter(raw, list[0]), { done: false, n: 950 });
  assert.equal(list.length, 28, '28 dinners (the spec said 27; Masoub ×2 = 1080 joins, Jamriyah and Marasee leave by the override)');
});
test('N18 E9: 120 left at 21:00', () => {
  const { list, raw } = ask({ target: 2000, eaten: 1880, hour: 21 });
  deq(fmts(list), ['boiled-eggs-veg×0.5=95', 'cat:Mantu×0.5=98', 'cat:Hail Kibbeh×0.5=95'], 'eggs ×0.75 = 143 is refused by the hard cap; Marasee is no dinner any more (the spec listed it second)');
  deq(W.wteAfter(raw, list[0]), { done: true, n: 25 });
});
test('N19 E10: 70 left at 21:00', () => {
  const { list, raw, b } = ask({ target: 2000, eaten: 1930, hour: 21 });
  deq(fmts(list), ['cat:Marasee×0.5=58'], 'the only meal that fits');
  assert.equal(list[0].o, 1, 'now OUT of its period (a breakfast or a snack, by the override): the fallback');
  deq(W.wteAfter(raw, list[0]), { done: true, n: 13 });
  const html = W.wteAnswerHtml(list[0], raw);
  for (const p of ['breakfast', 'lunch', 'snack', 'dinner']) assert.ok(!html.includes(W.shrMealName(p)), 'an out-of-period pick prints no period word: ' + W.shrMealName(p));
  assert.ok(html.includes('<span class="num">25 ' + W.t('unit_g') + '</span>'), 'its weight, 50 × 0.5');
  assert.equal(b.period, 'dinner');
});
test('N20 the small band', () => {
  for (const left of [55, 57.4, 49.5]) {
    const { list, b } = ask({ target: 2000, eaten: 2000 - left, hour: 21 });
    assert.equal(b.state, 'meal', left + ' left is a meal');
    assert.equal(list.length, 0, left + ' left: no half portion fits');
  }
  assert.equal(DAY1.length, 76, 'with the whole pool');
  assert.equal(ask({ target: 2000, eaten: 1942.5, hour: 21 }).list.length, 1, '57.5 left: Marasee ×0.5 fits');
  assert.equal(ask({ target: 2000, eaten: 1950.6, hour: 21 }).b.state, 'done', '49.4 left is done');
});
test('N21 E13: 3500/0@20', () => {
  const { list, raw } = ask({ target: 3500, eaten: 0, hour: 20 });
  deq(fmts(list), ['cat:Lamb over Rice×2=1700', 'cat:Mansaf×2=1680']);
  assert.equal(list[0].tier, 0);
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1800 });
  const ready = plain(DAY1).filter((r) => r.kind === 'builtin');
  const r = ask({ target: 3500, eaten: 0, hour: 20 }, ready).list;
  deq([fmt(plain(r)[0]), r[0].tier], ['chicken-rice-salad×2=1204', 1], 'the 25 ready meals alone: tier 1');
});
test('N22 E14: 70 left at 07:00', () => {
  const { list, raw } = ask({ target: 2000, eaten: 1930, hour: 7 });
  deq(fmts(list), ['cat:Marasee×0.5=58']);
  assert.equal(list[0].o, 0, 'Marasee is a breakfast now (the spec had it out of period here)');
  const html = W.wteAnswerHtml(list[0], raw);
  assert.ok(html.includes(W.shrMealName('breakfast')), 'so the line names breakfast');
  deq(W.wteAfter(raw, list[0]), { done: true, n: 13 });
});
test('N23 E15: Greek yogurt logged at 08:00, asked at 09:00', () => {
  const { list, raw, b } = ask({ target: 2000, eaten: 247, hour: 9, ate: [{ h: 8, kcal: 247 }] }, DAY1, keysOf('builtin:sg-greek-yogurt-berries'));
  deq([b.period, b.kcal], ['lunch', 492]);
  deq(fmt(plain(list)[0]), 'cat:Chicken Shawarma Sandwich×1=500');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1253 });
  const low = plain(W.wteBudget({ target: 2000, eaten: 100, hour: 9, ate: [{ h: 8, kcal: 100 }] }));
  deq([low.period, low.kcal], ['breakfast', 342], 'a 100-kcal breakfast does not advance');
});
const R1ROW = W.wteRecipeRow(R1, R1_PER, A.fold);
const POOL_R1 = plain(DAY1).concat([plain(R1ROW)]);
test('N24 E16: 800 left at 20:00 + the recipe', () => {
  const { list } = ask({ target: 2200, eaten: 1400, hour: 20 }, POOL_R1);
  deq(fmt(plain(list)[0]), 'cat:Chicken over Rice×1=750');
  deq(fmt(plain(list)[4]), 'recipe:r1×1.25=750', 'the recipe is fifth: the source earns nothing');
});
test('N25 E16c: 600 left', () => {
  const { list, raw } = ask({ target: 2200, eaten: 1600, hour: 20 }, POOL_R1);
  deq(fmt(plain(list)[0]), 'recipe:r1×1=600');
  deq(W.wteAfter(raw, list[0]), { done: true, n: 0 });
  assert.equal(list.length, 33);
});
const B1ROW = W.wteBundleRow(B1, 20), B2ROW = W.wteBundleRow(B2, 1.25);
test('N26 E17: the bundle at 07:30', () => {
  const { list, raw } = ask({ target: 2000, eaten: 0, hour: 7 }, plain(DAY1).concat([plain(B1ROW)]));
  deq(fmt(plain(list)[0]), 'bundle:b1×1=392');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1608 });
  assert.equal(list.length, 22);
});
test('N27 E18: b2 alone', () => {
  const a = ask({ target: 2500, eaten: 0, hour: 8 }, [plain(B2ROW)]).list;
  deq(plain(a).map((x) => fmt(x) + '/t' + x.tier), ['bundle:b2×1.25=375/t1'], 'capped at ×1.25, inside the 25 % window');
  const b = ask({ target: 2500, eaten: 0, hour: 8 }, [plain(W.wteBundleRow(B2, 2))]).list;
  deq(fmts(b), ['bundle:b2×1.5=450'], 'with maxPor 2');
});
test('N28 E18b: DAY1 + b2 at 2333/0@8', () => {
  const { list, raw } = ask({ target: 2333, eaten: 0, hour: 8 }, plain(DAY1).concat([plain(B2ROW)]));
  deq(fmt(plain(list)[0]), 'bundle:b2×1.25=375');
  assert.ok(!plain(list).some((x) => x.id === 'bundle:b2' && x.p > 1.25), 'never ×1.5');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1958 });
});
test('N29 E19: 500/0@1', () => {
  const { list, raw, b } = ask({ target: 500, eaten: 0, hour: 1 });
  assert.equal(b.kcal, 150);
  deq(fmt(plain(list)[0]), 'protein-shake-dates×0.5=154');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 347 });
});
test('N30 E21: 1800/1250@17, 70 kg, 20 g left', () => {
  const { list, raw, b } = ask({ target: 1800, eaten: 1250, hour: 17, kg: 70, proteinLeft: 20 });
  deq([b.aim, b.kcal], [20, 214]);
  deq(fmt(plain(list)[0]), 'cottage-strawberries×1.25=224');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 326 });
});
test('N31 E22: 100 left at 13:00', () => {
  const { list, raw, b } = ask({ target: 2000, eaten: 1900, hour: 13 });
  deq([b.period, b.kcal], ['lunch', 100], 'the floor: B is what is left');
  deq(fmts(list), ['cat:Mantu×0.5=98', 'cat:Hail Kibbeh×0.5=95'], 'Marasee is no lunch any more (the spec led with Marasee ×0.75 = 86, length 3)');
  deq(W.wteAfter(raw, list[0]), { done: true, n: 3 }, '2000 − 1997.5 = 2.5 → 3');
});
test('N32 E20: after dinner', () => {
  const { list, raw, b } = ask({ target: 2800, eaten: 1700, hour: 20, ate: [{ h: 19, kcal: 900 }] });
  deq([b.period, b.late, b.kcal], ['snack', true, 253]);
  deq(fmt(plain(list)[0]), 'cottage-strawberries×1.5=269');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 832 });
});
test('N33 E23: 2000/0@16', () => {
  const { list, raw, b } = ask({ target: 2000, eaten: 0, hour: 16 });
  assert.equal(b.kcal, 460);
  deq(fmt(plain(list)[0]), 'protein-shake-dates×1.5=461');
  deq(W.wteAfter(raw, list[0]), { done: false, n: 1540 });
  deq(fmt(plain(ask({ target: 1500, eaten: 0, hour: 16 }).list)[0]), 'protein-shake-dates×1=307', 'at 1500: shake ×1 under the 345 cap');
});
test('N34 the day walk', () => {
  const walk = (T) => {
    let eaten = 0;
    const ate = [], keys = [], picks = [];
    for (const hr of [8, 13, 17, 20]) {
      const b = W.wteBudget({ target: T, eaten, hour: hr, ate });
      const p = plain(W.wteRank(DAY1, b, keys))[0];
      picks.push(fmt(p));
      const k = p.row.kcal * p.p;
      eaten += k; ate.push({ h: hr, kcal: k }); keys.push(...p.row.keys);
    }
    return { picks, left: Math.round(T - eaten) };
  };
  deq(walk(2000), { picks: ['greek-yogurt-berries×1.5=371', 'cat:Fried Chicken Breast Piece×1=450', 'protein-shake-dates×1.5=461', 'cat:Mixed Grilled Kebab Plate×1=650'], left: 69 });
  deq([walk(1500).left, walk(2500).left, walk(3000).left], [12, 12, 55]);
});

// ---------------------------------------------------------------- N35–N37. order and the cycle
test('N35 the id breaks a tie', () => {
  const ra = plain(W.wteRecipeRow(Object.assign({}, R1, { id: 'a' }), R1_PER, A.fold));
  const rb = plain(W.wteRecipeRow(Object.assign({}, R1, { id: 'b' }), R1_PER, A.fold));
  const b = W.wteBudget({ target: 2200, eaten: 1600, hour: 20 });
  for (const pool of [[rb, ra], [ra, rb], plain(DAY1).concat([rb, ra]), [ra].concat(plain(DAY1), [rb])]) {
    assert.equal(W.wteRank(pool, b, [])[0].id, 'recipe:a', 'recipe:a first in every order');
  }
  const nb = W.wteBudget({ hour: 20 });
  assert.equal(W.wteRank([rb, ra], nb, [])[0].id, 'recipe:a', 'and with no target');
});
test('N36 the pool reversed', () => {
  const b = W.wteBudget({ target: 2000, eaten: 500, hour: 13, ate: [{ h: 8, kcal: 500 }], kg: 80, proteinLeft: 110 });
  const a = plain(W.wteRank(DAY1, b, [])).map((x) => x.id + '@' + x.p);
  const r = plain(W.wteRank(plain(DAY1).reverse(), b, [])).map((x) => x.id + '@' + x.p);
  deq(r, a);
});
test('N37 wteNext', () => {
  deq([W.wteNext(25, 24), W.wteNext(1, 0), W.wteNext(0, 5)], [0, 0, 0]);
  const seen = [];
  let i = 0;
  do { seen.push(i); i = W.wteNext(40, i); } while (i !== 0 && seen.length < 100);
  assert.equal(seen.length, 40, '40 distinct before the repeat');
  assert.equal(new Set(seen).size, 40);
});

// The two LAST fallbacks of the cycle filter (§4.2 step 8), which no budget of
// the grid reaches: a budget far from every meal (9,000 a day, nothing eaten,
// 20:00: B 4,500, the largest dinner ×2 = 1,700). Every in-period pick, closest
// first, and none of another period; with no in-period meal at all, every pick.
test('N50 the last fallbacks: far from every meal', () => {
  const { list, b } = ask({ target: 9000, eaten: 0, hour: 20 });
  deq([b.period, b.kcal, b.tol], ['dinner', 4500, 450], 'setup: half of 9,000');
  const dinners = plain(DAY1).filter((r) => r.meals.includes('dinner'));
  assert.ok(list.length > 0 && plain(list).every((x) => x.o === 0 && x.tier === 1 && x.err > 1125), 'setup: no dinner within the 25 % window');
  assert.equal(list.length, dinners.length, 'every dinner of the pool, and no meal of another period');
  const errs = plain(list).map((x) => x.err);
  deq(errs, errs.slice().sort((x, y) => x - y), 'tier 1: the closest first');
  const others = plain(DAY1).filter((r) => !r.meals.includes('dinner'));
  const lone = plain(ask({ target: 9000, eaten: 0, hour: 20 }, others).list);
  assert.equal(lone.length, others.length, 'with no dinner in the pool: every pick');
  assert.ok(lone.every((x) => x.o === 1), 'all of them out of the period');
});

// THE TAP ASKS AGAIN BY THE POOL: wteAsk hands it back, and every pick is a row of it.
test('N51 wteAsk hands back its pool', () => {
  const app = foodApp('en');
  app.run(`DB.recipes.add(${json({ name: R1.name, servings: 4, items: R1.items })})`);
  app.run(`DB.mealBundles.update(null, ${json({ name: B1.name, items: B1.items })})`);
  const a = plain(app.run('wteAsk()'));
  assert.ok(Array.isArray(a.pool), 'wteAsk returns `pool`');
  deq(a.pool.map((r) => r.id), plain(app.run('wtePool()')).map((r) => r.id), 'the very pool wtePool reads');
  assert.equal(a.n, a.pool.length, '`n` is its size');
  deq(plain(a.pool).reduce((m, r) => { m[r.kind] = (m[r.kind] || 0) + 1; return m; }, {}), { builtin: 25, recipe: 1, catalog: 51, bundle: 1 }, 'the four sources');
  const byId = new Map(a.pool.map((r) => [r.id, r]));
  assert.ok(a.list.length > 0 && a.list.every((x) => byId.has(x.id) && json(x.row) === json(byId.get(x.id))), 'every pick is a row of that pool, figure for figure');
});

// «كرّر الأمس» and a recent chip copy a row field by field. A bundle's rows are
// «eaten today» only by `bundle:<id>` (a bundle has no name key), so a copy that
// drops sourceId lets the bundle come back as the answer. The two copies are
// SLICED from js/food.js and run here, on a row DB.mealBundles.log wrote.
test('N52 a repeated bundle row is still eaten by its id', () => {
  const src = readLF('js/food.js');
  const lines = src.split('\n');
  const fnBody = (name) => { const s = lines.findIndex((l) => l.startsWith(`function ${name}(`)); const e = lines.findIndex((l, i) => i > s && l === '}'); assert.ok(s >= 0 && e > s, 'setup: ' + name); return lines.slice(s, e + 1).join('\n'); };
  const cut = (body, a, z) => { const i = body.indexOf(a), j = body.indexOf(z, i + a.length); assert.ok(i >= 0 && j > i, 'setup: found «' + a + '»'); return body.slice(i, j + z.length); };
  const ry = cut(fnBody('openRepeatYesterday'), '.map((e) => ({', '}))');
  const chip = cut(fnBody('openAddSheet'), '[{ name: r.name,', '}]');
  const app = foodApp('en');
  const copies = { repeat: app.run('(' + ry.slice('.map('.length, -1) + ')'), chip: app.run('((r) => (' + chip + ')[0])') };
  const made = app.run(`DB.mealBundles.update(null, ${json({ name: B1.name, items: B1.items })})`);
  assert.ok(made && made.ok, 'setup: a bundle');
  const id = made.entity.id;
  assert.ok(app.run(`DB.mealBundles.log(${json(id)}, todayISO(), 1, 'op-n52').ok`), 'setup: the bundle logged');
  const row = plain(app.run('DB.foodLogs.listForDate(todayISO())[0]'));
  assert.deepEqual([row.source, row.sourceId], ['bundle', id], 'setup: the logged row names its bundle');
  const want = 'bundle:' + id;
  assert.ok(W.wteEatenKeys([row], A.fold).includes(want), 'setup: the logged row itself is eaten by the bundle\'s id');
  for (const [how, copy] of Object.entries(copies)) {
    const c = plain(copy(row));
    assert.equal(c.sourceId, id, how + ': the copy carries sourceId');
    assert.ok(W.wteEatenKeys([c], A.fold).includes(want), how + ': the repeated row is still eaten by `' + want + '`');
    for (const none of [undefined, '', 7]) {
      const r = Object.assign({}, row, { sourceId: none });
      if (none === undefined) delete r.sourceId;
      assert.ok(!Object.prototype.hasOwnProperty.call(plain(copy(r)), 'sourceId'), how + ': no sourceId field from ' + json(none));
    }
  }
});

// THE AFTER-LINE AGAINST THE REAL RING. The grid compares wteAfter with the
// same product it is made of; here each pick is LOGGED through the store
// (DB.foodLogs.addMany with wteEntry, a bundle through DB.mealBundles.log),
// the ring's own figure is read (nutritionGauge(day).calLeft, under 50 the
// goal), and the write is undone.
test('N53 the after-line is the ring once the pick is logged', () => {
  const app = foodApp('en');
  app.run(`DB.recipes.add(${json({ name: R1.name, servings: 4, items: R1.items })})`);
  for (const bnd of [B1, B2]) assert.ok(app.run(`DB.mealBundles.update(null, ${json({ name: bnd.name, items: bnd.items })}).ok`), 'setup: ' + bnd.name);
  const kinds = new Set();
  // What is left after each logged row, past the whole kcal: a half tells round
  // from floor, a quarter tells it from ceil (1800/500@19: Jamriyah ×0.75 leaves x.25).
  const rems = new Set();
  let n = 0;
  for (const [T, E, h] of [[2000, 0, 7], [2333, 0, 8], [2000, 500, 13], [1800, 1250, 17], [2200, 1400, 20], [2000, 1700, 20], [2000, 1930, 21], [2000, 0, 1], [1800, 500, 19]]) {
    pinClock(app, h);
    app.run(`DB.nutrition.setTargets({ calories: ${T}, protein: 0, carbs: 0, fat: 0 })`);
    app.run('DB.foodLogs.listForDate(todayISO()).slice().forEach((r) => DB.foodLogs.remove(todayISO(), r.id))');
    if (E) assert.ok(app.run(`DB.foodLogs.addMany(todayISO(), [{ name: 'QA seed', servings: 1, calories: ${E}, protein: 0, carbs: 0, fat: 0 }], 'op-n53-seed-${T}-${E}-${h}').ok`), 'setup: the seed row');
    const len = app.run('wteAsk().list.length');
    assert.ok(len > 0, `setup: a list at ${T}/${E}@${h}`);
    for (const i of [...new Set([0, len - 1])]) {
      const op = 'op-n53-' + (n++);
      const r = plain(app.run(`(() => {
        const a = wteAsk(), x = a.list[${i}], day = todayISO();
        const w = x.row.kind === 'bundle' ? DB.mealBundles.log(x.row.srcId, day, x.p, ${json(op)}) : DB.foodLogs.addMany(day, [wteEntry(x)], ${json(op)});
        const out = { ok: !!(w && w.ok), kind: x.row.kind, id: x.id, p: x.p, kcal: Number(x.row.kcal), after: wteAfter(a.b, x), left: nutritionGauge(day).calLeft };
        out.undo = !!(w && w.undoToken && DB.undo.apply(w.undoToken).ok);
        out.back = nutritionGauge(day).calLeft;
        return out;
      })()`));
      const tag = `${T}/${E}@${h} #${i} ${r.id}×${r.p}`;
      assert.equal(r.ok, true, tag + ': logged');
      kinds.add(r.kind);
      if (r.kind !== 'bundle') rems.add(Math.round((((T - E - r.kcal * r.p) % 1) + 1) % 1 * 100) / 100);
      const shown = r.left < 50 ? Math.max(0, r.left) : r.left;
      assert.equal(r.after.done, r.left < 50, `${tag}: the goal completes exactly when the ring reads under 50 (${r.left})`);
      if (r.kind === 'bundle') assert.ok(Math.abs(shown - r.after.n) <= 1, `${tag}: after ${r.after.n}, the ring ${shown}`);
      else assert.equal(r.after.n, shown, `${tag}: after ${r.after.n}, the ring ${shown}`);
      deq([r.undo, r.back], [true, Math.round(T - E)], tag + ': undone, the ring back where it was');
    }
  }
  assert.ok(rems.has(0.5) && rems.has(0.25), 'setup: a log that leaves a half and one that leaves a quarter, so the ring\'s rounding is told from floor and ceil: ' + [...rems]);
  assert.ok(n >= 12 && kinds.has('bundle') && kinds.has('recipe') && kinds.has('catalog') && kinds.has('builtin'), 'setup: every kind logged at least once: ' + [...kinds] + ' (' + n + ' logs)');
});

// ---------------------------------------------------------------- N38–N42. the small helpers
test('N38 wteWord', () => {
  const got = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 0.3].map((p) => W.wteWord(p));
  const want = ['wte_por_050', 'wte_por_075', 'rec_serv_1', 'wte_por_125', 'wte_por_150', 'wte_por_175', 'rec_serv_2'].map((k) => W.t(k)).concat(['']);
  deq(got, want);
  assert.equal(new Set(got).size, 8, 'eight different words');
});
test('N39 wteEatenKeys', () => {
  const rows = [{ source: 'builtin', sourceId: 'sg-x', name: 'A' }, { source: 'recipe', name: 'Kabsa' }, { source: 'catalog', sourceId: 'Mansaf', name: 'Mansaf' },
    { source: 'bundle', sourceId: 'b1', name: 'Eggs' }, { source: 'manual', name: '' }];
  deq(W.wteEatenKeys(rows, A.fold), ['builtin:sg-x', 'n:a', 'n:kabsa', 'catalog:Mansaf', 'n:mansaf', 'bundle:b1', 'n:eggs']);
  deq(W.wteEatenKeys([{ source: 'builtin', sourceId: 'sg-x', name: 'A' }, { source: 'builtin', sourceId: 'sg-x', name: 'a' }], A.fold), ['builtin:sg-x', 'n:a'], 'unique');
});
test('N40 wteItems', () => {
  const rec = plain(W.wteRecipeRow({ id: 'r4', name: 'Four', servings: 4, items: [{ name: 'Meat', qty: '800 g', calories: 2000, protein: 160, carbs: 0, fat: 120 }, { name: 'Salt', qty: 'a pinch of salt', calories: 0, protein: 0, carbs: 0, fat: 0 }] }, { calories: 500, protein: 40, carbs: 0, fat: 30 }, A.fold));
  const at1 = plain(W.wteItems(rec, 1));
  deq(at1.map((x) => x.qty), ['200 g', 'a pinch of salt'], 'one serving of four: the amount ÷ 4, a wordy one unchanged');
  deq([at1[0].calories, at1[0].protein, at1[0].fat], [500, 40, 30], 'the figures × 1/4');
  const at15 = plain(W.wteItems(rec, 1.5));
  deq([at15[0].qty, at15[0].calories], ['300 g', 750], '×1.5 of four');
  const ready = { id: 'builtin:x', kind: 'builtin', servings: 1, items: [{ name: 'Oats', qty: '150 g', calories: 200, protein: 8, carbs: 30, fat: 4 }] };
  deq(plain(W.wteItems(ready, 1.5))[0].qty, '225 g');
  deq(plain(W.wteItems(ready, 1))[0].qty, '150 g', 'the same string at one serving');
  const bun = plain(W.wteBundleRow({ id: 'bx', name: 'Two eggs', items: [{ name: 'Egg', servings: 2, calories: 78, protein: 6, carbs: 1, fat: 5 }] }, 20));
  const bi = plain(W.wteItems(bun, 1.5))[0];
  deq([bi.qty, bi.calories, bi.protein], ['× ' + W.fmtNum(3), 78 * 2 * 1.5, 6 * 2 * 1.5], 'a bundle item: × n·p, its figures × n·p');
  deq(plain(W.wteItems(plain(W.wteCatRow(W.FOOD_PRESETS.find((f) => f.en === 'Mansaf'), false, A.fold)), 1.25)), [], 'a catalogue dish has none');
});
test('N41 wteEntry', () => {
  const greek = plain(ask({ target: 2000, eaten: 0, hour: 8 }).list)[0];
  const e1 = plain(W.wteEntry(greek));
  deq(e1, { name: greek.row.name, servings: 1.5, calories: 247, protein: 22, carbs: 17, fat: 10.9, source: 'builtin', sourceId: 'sg-greek-yogurt-berries' }, 'one serving\'s figures, the portion in servings');
  const mansaf = plain(ask({ target: 2000, eaten: 0, hour: 20 }).list)[0];
  deq(plain(W.wteEntry(mansaf)), { name: 'Mansaf', servings: 1.25, calories: 840, protein: 43, carbs: 57, fat: 46.4, source: 'catalog', sourceId: 'Mansaf' });
  const r = plain(ask({ target: 2200, eaten: 1600, hour: 20 }, POOL_R1).list)[0];
  const e3 = plain(W.wteEntry(r));
  deq([e3.servings, e3.calories, e3.source, e3.sourceId], [1, 600, 'recipe', 'r1']);
  const bun = plain(ask({ target: 2000, eaten: 0, hour: 7 }, plain(DAY1).concat([plain(B1ROW)])).list)[0];
  assert.equal(W.wteEntry(bun), null, 'a bundle logs through DB.mealBundles.log');
  assert.equal(W.wteEntry(null), null);
});
test('N42 the adapters', () => {
  assert.equal(W.wteBundleRow(B1, 0.25), null, 'a bundle whose ceiling is under ½');
  assert.equal(W.wteBundleRow(Object.assign({}, B1, { name: '  ' }), 2), null, 'no name');
  assert.equal(W.wteBundleRow({ id: 'z', name: 'Zero', items: [{ name: 'Water', servings: 1, calories: 0 }] }, 2), null, 'no calories');
  const two = plain(W.wteBundleRow({ id: 'y', name: 'Twice', items: [{ name: 'Bar', servings: 2, calories: 140, protein: 10, carbs: 15, fat: 5 }] }, 2.5));
  deq([two.kcal, two.protein, two.maxPor, two.id, two.kind, two.srcId], [280, 20, 2, 'bundle:y', 'bundle', 'y']);
  assert.equal(W.wteRecipeRow({ id: 'e', name: 'Empty', servings: 1, items: [] }, { calories: 100 }, A.fold), null, 'a recipe with no items');
  const legacy = plain(W.wteRecipeRow({ id: 'l', name: 'Legacy', servings: 2.5, items: [{ name: 'Rice', qty: '500 g', calories: 1000, protein: 20, carbs: 200, fat: 5 }] }, { calories: 400, protein: 8, carbs: 80, fat: 2 }, A.fold));
  assert.equal(legacy.servings, 2.5, 'a legacy 2.5 servings stays the divisor');
  deq([plain(W.wteItems(legacy, 1))[0].qty, plain(W.wteItems(legacy, 1))[0].calories], ['200 g', 400], 'and wteItems divides by it');
  const fp = (en) => W.FOOD_PRESETS.find((f) => f.en === en);
  assert.equal(W.wteCatRow(fp('French Fries'), false, A.fold), null, 'a side is not a meal');
  assert.equal(plain(W.wteCatRow(fp('Shawarma Wrap'), false, A.fold)).grams, null, '«1 wrap» names no weight');
  const m = plain(W.wteCatRow(fp('Mansaf'), true, A.fold));
  deq([m.grams, m.name, m.id, m.servings, m.maxPor], [350, fp('Mansaf').ar, 'catalog:Mansaf', 1, 2], 'Mansaf: 350 g, its Arabic name');
  deq(plain(W.wteReadyRow(W.SUGGESTION_PRESETS[0], [], { calories: 100 }, false, A.fold)), null, 'a ready meal with no items');
  const p0 = W.SUGGESTION_PRESETS[0], items0 = W.suggestionItems(p0);
  assert.ok(W.wteReadyRow(p0, items0, { calories: 100 }, false, A.fold), 'setup: the ready meal itself is a candidate');
  for (const meals of [[], ['supper'], undefined]) {
    assert.equal(W.wteReadyRow(Object.assign({}, p0, { meals }), items0, { calories: 100 }, false, A.fold), null, 'a ready meal in no known period: ' + json(meals));
  }
});

// ---------------------------------------------------------------- N43. the pool
test('N43 wtePool', () => {
  const kinds = (pool) => plain(pool).reduce((m, r) => { m[r.kind] = (m[r.kind] || 0) + 1; return m; }, {});
  const app = foodApp('en');
  const fresh = app.run('wtePool()');
  assert.equal(fresh.length, 76, 'day one: 76 meals');
  deq(kinds(fresh), { builtin: 25, catalog: 51 });
  app.run('SHARED_RECIPES = cleanSharedRecipes(' + json([
    { id: 'shr-a', lang: 'en', name: 'Community oats', servings: 1, meals: ['breakfast'], kcal: 300, protein: 20, carbs: 40, fat: 5, created_at: '2026-11-01T08:00:00.000Z' },
    { id: 'shr-b', lang: 'en', name: 'Community rice', servings: 2, meals: ['lunch'], kcal: 500, protein: 30, carbs: 60, fat: 10, created_at: '2026-11-01T09:00:00.000Z' }]) + ')');
  assert.equal(app.run('SHARED_RECIPES.length'), 2, 'setup: two community rows in memory');
  assert.equal(app.run('wtePool()').length, 76, 'the community never reaches the pool');
  const p0 = app.W.SUGGESTION_PRESETS[0];
  const copy = app.run(`DB.recipes.add({ name: ${json(p0.en)}, servings: 1, items: suggestionItems(SUGGESTION_PRESETS[0]), origin: 'builtin' })`);
  assert.ok(copy, 'setup: a saved copy of a ready meal');
  assert.equal(app.run('wtePool()').length, 76, 'its saved copy is not a second answer');
  app.run(`DB.recipes.add(${json({ name: R1.name, servings: 4, items: R1.items })})`);
  const withOwn = app.run('wtePool()');
  assert.equal(withOwn.length, 77, 'an own recipe joins');
  deq(kinds(withOwn), { builtin: 25, recipe: 1, catalog: 51 });
  const own = plain(withOwn).find((r) => r.kind === 'recipe');
  deq([own.kcal, own.protein, own.carbs, own.fat, own.servings, own.meals], [600, 45, 50, 20, 4, ['breakfast', 'lunch', 'snack', 'dinner']], 'one serving by DB.recipes.perServing, every period');
  const ar = foodApp('ar');
  const arPool = plain(ar.run('wtePool()'));
  assert.equal(arPool.length, 76);
  const cat = arPool.find((r) => r.id === 'catalog:Mansaf');
  assert.equal(cat.name, ar.W.FOOD_PRESETS.find((f) => f.en === 'Mansaf').ar, 'a catalogue dish in Arabic');
  // Eaten by the catalogue's own id (what a log row's sourceId holds), never by the shown name.
  deq(cat.keys, ['catalog:Mansaf', 'n:' + ar.fold(cat.name)], 'a catalogue dish is keyed by its en, whatever the language');
  const rd = arPool.find((r) => r.id === 'builtin:' + p0.id);
  assert.equal(rd.name, p0.ar, 'a ready meal in Arabic');
  assert.ok(rd.keys.includes('n:' + ar.fold(p0.ar)), 'its name key folded');
});
// Only an EXACT saved copy is left out: one figure changed is a meal of the
// user's own, and an own recipe with the same figures but no origin is too.
test('N43b wtePool keeps what is not a copy', () => {
  const app = foodApp('en');
  const p0 = app.W.SUGGESTION_PRESETS[0];
  const items = plain(app.run('suggestionItems(SUGGESTION_PRESETS[0])'));
  app.run(`DB.recipes.add(${json({ name: p0.en, servings: 1, items, origin: 'builtin' })})`);
  assert.equal(app.run('wtePool()').length, 76, 'setup: the exact copy is left out');
  const edited = items.map((it, i) => (i === 0 ? Object.assign({}, it, { calories: Number(it.calories) + 40 }) : it));
  app.run(`DB.recipes.add(${json({ name: p0.en, servings: 1, items: edited, origin: 'builtin' })})`);
  assert.equal(app.run('wtePool()').length, 77, 'a copy with one figure edited is kept');
  app.run(`DB.recipes.add(${json({ name: 'QA twin', servings: 1, items })})`);
  const pool = plain(app.run('wtePool()'));
  assert.equal(pool.length, 78, 'an own recipe with the same figures and no origin is kept');
  assert.ok(pool.some((r) => r.kind === 'recipe' && r.name === 'QA twin'), 'the twin is in the pool');
});

// ---------------------------------------------------------------- N44. WTE_CAT against the catalogue
test('N44 WTE_CAT against the catalogue', () => {
  const meals = W.FOOD_PRESETS.filter((f) => f.cat === 'meals').map((f) => f.en);
  const keys = Object.keys(W.WTE_CAT);
  for (const k of keys) assert.ok(meals.includes(k), `«${k}» is the en of a cat: 'meals' row`);
  deq(meals.filter((m) => !keys.includes(m)).sort(), ['Basbousa', 'French Fries', 'Kunafa', 'Luqaimat', 'Sago Dessert'], 'left out: exactly the five sides and sweets');
  for (const k of keys) {
    const v = plain(W.WTE_CAT[k]);
    assert.ok(v.length > 0, k + ' has a period');
    deq(v, ['breakfast', 'lunch', 'snack', 'dinner'].filter((p) => v.includes(p)), k + ': a subset of SHR_PERIODS, in its order, no repeat');
  }
  const src = readLF('js/food.js');
  const block = src.slice(src.indexOf('\nconst WTE_CAT = {\n') + 19, src.indexOf('\n};', src.indexOf('\nconst WTE_CAT = {\n')));
  const lines = block.split('\n');
  assert.equal(lines.length, 51, 'one dish per line');
  for (const l of lines) assert.ok(/^ {2}'([^']+)': \[('(breakfast|lunch|snack|dinner)'(, )?)+\],$/.test(l), 'the line form: ' + l);
});

// ---------------------------------------------------------------- N45. the markup
test('N45 the head and the answer', () => {
  const head = W.wteHeadHtml('<img src=x onerror=alert(1)>');
  assert.ok(head.includes('&lt;img') && !head.includes('<img'), 'the title is escaped');
  assert.ok(head.includes('class="modal-title"') && head.includes('data-close') && head.includes('aria-label="' + W.t('close') + '"'), 'the header and its close button');
  for (const lang of ['en', 'ar']) {
    const app = foodApp(lang);
    const pool = app.run('wtePool()');
    const srcWords = ['shr_src_mine', 'shr_src_community', 'shr_src_builtin'].map((k) => app.W.t(k));
    let n = 0;
    for (const o of [{ hour: 8 }, { target: 2000, eaten: 0, hour: 8 }, { target: 2000, eaten: 0, hour: 20 }, { target: 3500, eaten: 0, hour: 20 }, { target: 2000, eaten: 1930, hour: 7 }, { target: 2000, eaten: 1930, hour: 21 }]) {
      const b = app.W.wteBudget(o);
      const list = app.W.wteRank(pool, b, []);
      assert.ok(list.length > 0, 'setup: a list for ' + json(o));
      const sentinel = Object.assign({}, plain(b), b.state === 'meal' ? { kcal: 98765, tol: 98765 } : {});
      for (const pick of list) {
        const html = app.W.wteAnswerHtml(pick, sentinel);
        n++;
        assert.ok(!/NaN|\{|98765/.test(html), lang + ': no NaN, no brace, no budget figure: ' + html.slice(0, 160));
        for (const w of srcWords) assert.ok(!html.includes(w), lang + ': no source label');
        const figs = [...html.matchAll(/rec-bar-n[^"]*">([^<]*)</g)].map((m) => m[1]);
        deq(figs, [pick.kcal, pick.protein, pick.carbs, pick.fat].map((v) => app.W.fmtNum(v)), 'the four cells are the pick\'s figures');
      }
    }
    assert.ok(n > 60, 'setup: every pick of six asks');
    const e8 = app.W.wteRank(pool, app.W.wteBudget({ target: 2000, eaten: 0, hour: 20 }), [])[0];
    const h8 = app.W.wteAnswerHtml(e8, app.W.wteBudget({ target: 2000, eaten: 0, hour: 20 }));
    assert.ok(/rec-bar-kcal is-long"/.test(h8), lang + ': 1,050 is five characters: is-long');
    assert.ok(h8.includes('<span class="num">438 ' + app.W.t('unit_g') + '</span>'), lang + ': 350 g × 1.25 = 437.5 → 438 on the line');
    assert.ok(h8.includes(app.W.shrMealName('dinner')) && h8.includes(app.W.t('wte_por_125')), lang + ': dinner, 1¼');
    const big = Object.assign({}, plain(e8), { kcal: 12345 });
    assert.ok(/rec-bar-kcal is-xlong"/.test(app.W.wteAnswerHtml(big, app.W.wteBudget({ target: 2000, eaten: 0, hour: 20 }))), lang + ': 12,345 is six: is-xlong');
    const short3 = app.W.wteRank(pool, app.W.wteBudget({ target: 2000, eaten: 0, hour: 8 }), [])[0];
    assert.ok(/rec-bar-kcal"/.test(app.W.wteAnswerHtml(short3, app.W.wteBudget({ target: 2000, eaten: 0, hour: 8 }))), lang + ': 371 keeps the full size');
    const nt = app.W.wteRank(pool, app.W.wteBudget({ hour: 8 }), [])[0];
    const hn = app.W.wteAnswerHtml(nt, app.W.wteBudget({ hour: 8 }));
    assert.ok(!hn.includes(app.W.t('wte_after_done')) && (hn.match(/<p class="shr-figs">/g) || []).length === 1, lang + ': no after-line without a target');
    const after = app.W.wteAnswerHtml(short3, app.W.wteBudget({ target: 2000, eaten: 0, hour: 8 }));
    // The line as the dictionary spells it (the key's own text, or the key
    // itself until the sheet's builder adds it), its {n} the after figure.
    const line = '<p class="shr-figs">' + app.W.t('wte_after').replace('{n}', () => '<span class="num">' + app.W.fmtNum(1630) + '</span>') + '</p>';
    assert.ok(after.endsWith(line), lang + ': the after-line, last: ' + after.slice(-120));
    const done = app.W.wteRank(pool, app.W.wteBudget({ target: 2000, eaten: 1700, hour: 20 }), [])[0];
    assert.ok(app.W.wteAnswerHtml(done, app.W.wteBudget({ target: 2000, eaten: 1700, hour: 20 })).endsWith('<p class="shr-figs">' + app.W.t('wte_after_done') + '</p>'), lang + ': 10 left after it: the goal completes');
  }
});

// ---------------------------------------------------------------- N46/N47. junk and mutation
test('N46 junk never throws', () => {
  const b = W.wteBudget({ target: 2000, eaten: 0, hour: 8 });
  deq(W.wteRank(null, b), []);
  deq(W.wteRank([1, 'x', null, { id: 'a', meals: [], kcal: NaN }], b, []), []);
  assert.equal(plain(W.wteBudget({ target: Infinity, eaten: 1e9 })).state, 'notarget');
  const big = plain(W.wteBudget({ target: 1e9, eaten: -5, hour: -1 }));
  assert.ok(big.state === 'meal' && big.period === 'lunch' && Number.isInteger(big.kcal) && big.kcal > 0 && big.eaten === 0, 'a valid meal: ' + json(big));
});
test('N47 no input is mutated', () => {
  const pool = plain(DAY1).concat([plain(R1ROW), plain(B1ROW)]);
  const b = W.wteBudget({ target: 2000, eaten: 500, hour: 13, ate: [{ h: 8, kcal: 500 }], kg: 80, proteinLeft: 110 });
  const before = [json(pool), json(b)];
  const eaten = keysOf('catalog:Fried Chicken Drumsticks');
  W.wteRank(pool, b, eaten);
  W.wteRank(pool, W.wteBudget({ hour: 13 }), eaten);
  deq([json(pool), json(b)], before);
});

// ---------------------------------------------------------------- N48. the dictionaries
const KEYS = ['wte_title', 'wte_por_050', 'wte_por_075', 'wte_por_125', 'wte_por_150', 'wte_por_175', 'wte_after', 'wte_after_done', 'wte_goal', 'wte_done', 'wte_small', 'wte_none', 'wte_log', 'wte_next', 'wte_logged'];
test('N48 the fifteen keys in both dictionaries', () => {
  const I = A.run('I18N');
  const holes = (s) => (String(s).match(/\{[a-z]+\}/g) || []).sort();
  for (const k of KEYS) {
    for (const lang of ['en', 'ar']) {
      assert.ok(typeof I[lang][k] === 'string' && I[lang][k].trim(), `${lang}.${k} exists`);
      assert.notEqual(I[lang][k], k, `${lang}.${k} is not its own key`);
    }
    deq(holes(I.ar[k]), holes(I.en[k]), `${k}: the same placeholders in both`);
  }
  deq(holes(I.en.wte_after), ['{n}']);
  deq(holes(I.en.wte_logged), ['{name}', '{portion}']);
});

// ---------------------------------------------------------------- N49. the shell's question
test('N49 wteAsk on the real store', () => {
  const app = foodApp('en');
  const hourNow = () => app.run('new Date().getHours()');
  const stable = (fn) => { for (let i = 0; i < 3; i++) { const h0 = hourNow(); const v = fn(); if (hourNow() === h0) return [v, h0]; } throw new Error('the hour kept changing'); };
  const [a, h0] = stable(() => plain(app.run('wteAsk()')));
  assert.equal(a.day, app.run('todayISO()'));
  deq([a.b.state, a.n], ['notarget', 76], 'day one: no target, the 76 meals');
  deq(a.list.map((x) => x.id), plain(app.W.wteRank(app.run('wtePool()'), app.W.wteBudget({ hour: h0 }), [])).map((x) => x.id), 'the list for the hour');
  const entry = plain(app.W.wteEntry(plain(app.W.wteRank(app.run('wtePool()'), app.W.wteBudget({ target: 2000, eaten: 0, hour: 13 }), []))[0]));
  // A protein target 12 g above what the row brings, so the protein left (12)
  // is what binds the aim, under the default 30.
  const proteinIn = Math.round(entry.protein * entry.servings * 10) / 10;
  const proteinTarget = Math.round(proteinIn) + 12;
  app.run(`DB.nutrition.setTargets({ calories: 2000, protein: ${proteinTarget}, carbs: 220, fat: 60 })`);
  const w = app.run(`DB.foodLogs.addMany(todayISO(), [${json(entry)}], 'op-n49')`);
  assert.ok(w && w.ok, 'setup: one row logged');
  const [b, h1] = stable(() => plain(app.run('wteAsk()')));
  const eaten = entry.calories * entry.servings;
  deq([b.b.state, b.b.target, b.b.eaten], ['meal', 2000, eaten], 'the target and what the log holds');
  const want = plain(app.W.wteBudget({ target: 2000, eaten, hour: h1, ate: [{ h: h1, kcal: eaten }], proteinLeft: Math.round((proteinTarget - proteinIn) * 10) / 10 }));
  assert.ok(want.aim >= 11 && want.aim <= 13, 'setup: the protein left binds the aim: ' + want.aim);
  deq(b.b, want, 'the budget from the ring\'s figures, the row\'s hour and the protein left');
  const keys = plain(app.W.wteEatenKeys(app.run('DB.foodLogs.listForDate(todayISO())'), app.fold));
  assert.ok(keys.includes(entry.source + ':' + entry.sourceId), 'the logged row is eaten by its source');
  deq(b.list.map((x) => x.id + '@' + x.p), plain(app.W.wteRank(app.run('wtePool()'), want, keys)).map((x) => x.id + '@' + x.p), 'ranked with the eaten keys');
  app.run('wtePool = () => { throw new Error("planted"); }');
  const c = plain(app.run('wteAsk()'));
  deq([c.n, c.list.length], [0, 0], 'a pool that throws is an empty pool, never a throw');
  // The body weight the aim reads: the calculator's profile until a weigh-in,
  // then the NEWEST weigh-in (two of them, the older one written last).
  const bw = foodApp('en');
  bw.run('DB.nutrition.setTargets({ calories: 2000, protein: 0, carbs: 0, fat: 0 })');
  bw.run('STATE.nutrition = Object.assign(DB.nutrition.get(), { profile: Object.assign({}, DB.nutrition.get().profile, { weightKg: 70 }) })');
  assert.equal(plain(bw.run('wteAsk()')).b.aim, 28, 'no weigh-in: the profile\'s 70 kg, 0.4 × 70');
  bw.run('DB.bodyweight.log(todayISO(), 80); DB.bodyweight.log(addDaysISO(todayISO(), -10), 50)');
  assert.equal(plain(bw.run('wteAsk()')).b.aim, 32, 'the newest weigh-in (80 kg), not the older 50 kg nor the profile');
  // ONE ready meal whose pricing throws costs that meal, never the sheet.
  const one = foodApp('en');
  one.run('(() => { const real = suggestionItems; suggestionItems = (p) => { if (p === SUGGESTION_PRESETS[0]) throw new Error("planted"); return real(p); }; })()');
  const o = plain(one.run('wteAsk()'));
  deq([o.n, o.list.some((x) => x.id === 'builtin:' + one.W.SUGGESTION_PRESETS[0].id)], [75, false], 'one preset that throws: 75 meals, not 0');
  // A row with no stamp (a legacy or imported row) has no hour: it never moves the period.
  const st = foodApp('en');
  pinClock(st, 13);
  st.run('DB.nutrition.setTargets({ calories: 2000, protein: 0, carbs: 0, fat: 0 })');
  st.run(`DB.foodLogs.addMany(todayISO(), [{ name: 'QA lunch', servings: 1, calories: 400, protein: 0, carbs: 0, fat: 0 }], 'op-n49-stamp')`);
  assert.equal(plain(st.run('wteAsk()')).b.period, 'snack', 'setup: the same row stamped 13:00 moves the lunch on');
  st.run('delete STATE.foodLogs[todayISO()][0].addedAt');
  assert.equal(st.run('DB.foodLogs.listForDate(todayISO())[0].addedAt'), undefined, 'setup: the stamp is gone');
  deq([plain(st.run('wteAsk()')).b.period, plain(st.run('wteAsk()')).b.eaten], ['lunch', 400], 'unstamped: still counted as eaten, but the question stays at lunch');
});

// ---------------------------------------------------------------- THE GRID (P1–P15), one vm call
// Everything below runs INSIDE the app's context: `api` is an object of the
// context's own functions, so no call crosses a realm per cell.
function grid(api, args) {
  const { wteBudget, wteRank, wtePortion, wteAfter, wteNext, wteEntry, wteAnswerHtml, wteItems, recViewRowsHtml, mealPeriodFor, SHR_PERIODS, WTE } = api;
  const fail = {};
  const say = (p, msg) => { (fail[p] = fail[p] || []).length < 3 && fail[p].push(msg); fail[p].n = (fail[p].n || 0) + 1; };
  const count = { cells: 0, meal0: 0, picks: 0, reversed: 0, html: 0, notarget: 0, band: 0 };
  const Q = new Set([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  const POOLS = args.pools;
  const before = POOLS.map((p) => JSON.stringify(p));
  const valid = (r) => r && typeof r === 'object' && typeof r.id === 'string' && Array.isArray(r.meals) && Number(r.kcal) > 0;
  const next = (p) => (p === 'dinner' ? 'snack' : SHR_PERIODS[SHR_PERIODS.indexOf(p) + 1]);
  const mono = new Map();
  for (const T of args.targets) for (const pct of args.pcts) for (let hour = 0; hour < 24; hour++) for (let am = 0; am < 2; am++) for (let kp = 0; kp < args.kgpl.length; kp++) for (let pi = 0; pi < POOLS.length; pi++) {
    const eaten = T * pct / 100;
    const ate = am ? [{ h: hour, kcal: Math.min(eaten, 400) }] : [];
    const keys = am ? args.eatenKeys : [];
    const [kg, pl] = args.kgpl[kp];
    const o = { target: T, eaten, hour, ate, kg, proteinLeft: pl };
    const tag = `${T}/${pct}%@${hour} ate${am} kg${kp} pool${pi}`;
    const b = wteBudget(o);
    const bj = JSON.stringify(b);
    const list = wteRank(POOLS[pi], b, keys);
    count.cells++;
    if (JSON.stringify(b) !== bj) say('P3', tag + ': the budget was mutated');
    // P6 — the state.
    const L = Math.round(T - eaten);
    if (b.state !== (L < WTE.done ? 'done' : 'meal')) say('P6', `${tag}: state ${b.state} with ${L} left`);
    if (b.state === 'done') { if (list.length) say('P6', tag + ': done but a list'); continue; }
    if (b.state !== 'meal') { say('P6', tag + ': state ' + b.state); continue; }
    // P11 — the advance.
    const clock = mealPeriodFor({ getHours: () => hour });
    const wantP = hour < WTE.night ? 'snack' : am && Math.min(eaten, 400) >= WTE.moved ? next(clock) : clock;
    if (b.period !== wantP) say('P11', `${tag}: period ${b.period}, expected ${wantP}`);
    // P5 — the bounds, and the budget never falls as what is left rises.
    const lo = Math.round(Math.min(150, L, 0.5 * T)), hi = Math.round(Math.min(L, 0.5 * T));
    if (!(b.kcal >= lo && b.kcal <= hi)) say('P5', `${tag}: kcal ${b.kcal} outside ${lo}–${hi}`);
    if (!am && pi === 0) {
      const mk = T + '|' + hour + '|' + kp;
      const prev = mono.get(mk);
      if (prev && prev.left > L && prev.kcal < b.kcal) say('P5', `${tag}: kcal ${b.kcal} at ${L} left, but ${prev.kcal} at ${prev.left}`);
      mono.set(mk, { left: L, kcal: b.kcal });
    }
    // P13 — the snack cap.
    if (b.period === 'snack' && b.kcal > Math.round(Math.max(Math.min(150, L), 0.23 * T))) say('P13', `${tag}: a ${b.kcal} snack`);
    // P7 — empty only in the small band (the code meals, nothing eaten).
    if (!list.length && !(pi === 0 && b.exact >= 49.5 && b.exact < 57.5) && pi === 0) say('P7', `${tag}: empty with ${b.exact} left`);
    // P10/P14 — the cycle is honest and COMPLETE: recomputed from the pool.
    const fits = [];
    for (const r of POOLS[pi]) {
      if (!valid(r)) continue;
      const x = wtePortion(Number(r.kcal), b, Number(r.maxPor));
      if (x) fits.push({ id: r.id, o: r.meals.includes(b.period) ? 0 : 1, err: x.err, p: x.p, kcal: x.kcal });
    }
    const win = Math.max(b.tol, Math.round(WTE.near * b.kcal));
    const A = fits.filter((x) => x.o === 0 && x.err <= b.tol);
    const BC = fits.filter((x) => (x.o === 0 && x.err <= win) || (x.o === 1 && x.err <= b.tol));
    const inP = fits.filter((x) => x.o === 0);
    const want = A.length ? A : BC.length ? BC : inP.length ? inP : fits;
    const got = new Map(list.map((x) => [x.id, x]));
    if (want.length !== list.length || want.some((x) => !got.has(x.id) || got.get(x.id).p !== x.p || got.get(x.id).kcal !== x.kcal)) {
      say('P14', `${tag}: listed ${list.length}, the rule keeps ${want.length} (${A.length ? 'A' : BC.length ? 'BC' : 'all'})`);
    }
    // P15 — the in-period picks come first in EVERY list (§4.2: the 25 % fallback is the
    // in-period half, then the out-of-period one): no in-period pick after an out-of-period one.
    const firstOut = list.findIndex((x) => x.o === 1);
    if (firstOut >= 0 && list.some((x, j) => j > firstOut && x.o === 0)) say('P15', `${tag}: an in-period pick follows ${list[firstOut].id}, out of the period`);
    // P4 — unique ids, and the cycle visits every one.
    if (got.size !== list.length) say('P4', tag + ': an id twice');
    if (list.length) {
      const seen = new Set();
      let i = 0;
      do { seen.add(i); i = wteNext(list.length, i); } while (i !== 0 && seen.size <= list.length);
      if (seen.size !== list.length) say('P4', `${tag}: the cycle visits ${seen.size} of ${list.length}`);
    }
    for (let j = 0; j < list.length; j++) {
      const x = list[j], r = x.row;
      count.picks++;
      // P1 — never past the target.
      const a = wteAfter(b, x);
      if (b.eaten + Number(r.kcal) * x.p > b.target + 1e-9 || !a || a.n < 0) say('P1', `${tag}: ${x.id}×${x.p} passes the target`);
      // P2 — the grid.
      if (!Q.has(x.p) || x.p > Number(r.maxPor) + 1e-9) say('P2', `${tag}: ${x.id}×${x.p} off the grid (maxPor ${r.maxPor})`);
      // P8 — integers, honest labels.
      if (![x.kcal, x.protein, x.carbs, x.fat, a && a.n].every(Number.isInteger)) say('P8', `${tag}: ${x.id} a figure that is not an integer`);
      if (x.e !== (Array.isArray(r.keys) && r.keys.some((k) => keys.includes(k)) ? 1 : 0)) say('P9', `${tag}: ${x.id} eaten ${x.e}, its keys say otherwise`);
      if (x.o !== (r.meals.includes(b.period) ? 0 : 1) || x.tier !== (x.err <= b.tol ? 0 : 1) || x.err !== Math.abs(x.kcal - b.kcal) || x.kcal !== Math.round(Number(r.kcal) * x.p)) {
        say('P8', `${tag}: ${x.id} carries a label its figures do not`);
      }
      // P15 — the order (§4.2 step 7), from the pick's own figures: the protein
      // shortfall in 5 g steps and the distance from one serving recomputed here.
      const ps = Math.ceil(Math.max(0, b.aim - x.protein) / WTE.aimStep), pd = Math.abs(x.p - 1);
      if (x.ps !== ps || x.pd !== pd) say('P15', `${tag}: ${x.id} shortfall ${x.ps} / distance ${x.pd}, the rule says ${ps} / ${pd}`);
      // A list is one sorted run, or two (in-period, then out of period) in the 25 % fallback.
      if (j > 0 && list[j - 1].o === x.o) {
        const w = list[j - 1];
        const key = (y) => [y.tier, y.o, y.e, y.tier === 1 ? y.err : 0, Math.ceil(Math.max(0, b.aim - y.protein) / WTE.aimStep), Math.abs(y.p - 1), y.err, -y.protein];
        const kw = key(w), kx = key(x);
        const d = kw.findIndex((v, n) => v !== kx[n]);
        if (d >= 0 ? kw[d] > kx[d] : !(w.id < x.id)) say('P15', `${tag}: ${w.id} listed before ${x.id} (key ${d})`);
      }
      // P9 — eaten never ahead of uneaten in the same tier and period class.
      if (x.e === 1) for (let k = j + 1; k < list.length; k++) {
        const y = list[k];
        if (y.e === 0 && y.tier === x.tier && y.o === x.o) { say('P9', `${tag}: eaten ${x.id} before uneaten ${y.id}`); break; }
      }
    }
    // P8 — the after-line equals the ring after logging: first and last pick.
    for (const x of list.length ? [list[0], list[list.length - 1]] : []) {
      const a = wteAfter(b, x);
      let consumed = eaten;
      if (x.row.kind === 'bundle') for (const it of args.bundleItems[x.row.srcId]) consumed += (Number(it.calories) || 0) * ((Number(it.servings) || 1) * x.p);
      else { const e = wteEntry(x); consumed += e.calories * e.servings; }
      const ring = Math.round(T - consumed);
      const shown = ring < WTE.done ? Math.max(0, ring) : ring;
      if (x.row.kind === 'bundle' ? Math.abs(shown - a.n) > 1 : shown !== a.n) say('P8', `${tag}: ${x.id} after ${a.n}, the ring ${shown}`);
    }
    // P8 — the text, on a quarter of the hours.
    if (list.length && args.htmlHours.includes(hour)) {
      for (const x of [list[0], list[list.length - 1]]) {
        const html = wteAnswerHtml(x, b) + recViewRowsHtml(wteItems(x.row, x.p), true);
        count.html++;
        if (/NaN|\{|undefined/.test(html)) say('P8', `${tag}: ${x.id} text ${html.slice(0, 80)}`);
        for (const m of html.matchAll(/rec-view-figs[^>]*>(.*?)<\/span><\/div>/g)) {
          for (const f of m[1].matchAll(/<span class="num">([^<]*)<\/span>/g)) if (!/^-?[0-9,]+$/.test(f[1])) say('P8', `${tag}: ${x.id} ingredient figure «${f[1]}»`);
        }
      }
    }
    // P3 — the code meals reversed give the same list.
    if (pi === 0) {
      const rev = wteRank(args.reversed, b, keys);
      count.reversed++;
      count.meal0++;
      if (rev.map((x) => x.id + '@' + x.p).join() !== list.map((x) => x.id + '@' + x.p).join()) say('P3', tag + ': the reversed pool reorders');
    }
  }
  if (POOLS.some((p, i) => JSON.stringify(p) !== before[i])) say('P3', 'a pool was mutated');
  // P2/P7 — no target: one serving each; the code meals list their period whole.
  const per = {};
  for (const q of SHR_PERIODS) per[q] = POOLS[0].filter((r) => r.meals.includes(q)).length;
  for (let hour = 0; hour < 24; hour++) for (let kp = 0; kp < args.kgpl.length; kp++) for (let pi = 0; pi < POOLS.length; pi++) {
    const b = wteBudget({ target: 0, hour, kg: args.kgpl[kp][0], proteinLeft: args.kgpl[kp][1] });
    const list = wteRank(POOLS[pi], b, []);
    count.notarget++;
    if (b.state !== 'notarget') say('P6', `${hour}: no target is not notarget`);
    if (list.some((x) => x.p !== 1)) say('P2', `${hour}: no target, a portion other than one`);
    if (pi === 0 && (list.length !== per[b.period] || list.some((x) => x.o !== 0))) say('P7', `${hour}: no target lists ${list.length}, the period holds ${per[b.period]}`);
  }
  // P6 — a valid target is never notarget; an eaten that is not a number is 0.
  for (const e of [NaN, Infinity, -Infinity, 'x', null, undefined, -50]) {
    const b = wteBudget({ target: 2000, eaten: e, hour: 8 });
    if (b.state !== 'meal' || b.eaten !== 0 || b.kcal !== 360) say('P6', `eaten ${String(e)} gave ${JSON.stringify(b)}`);
  }
  // P7 — the small band on a 0.1 kcal step, at every hour.
  let bandLo = null, bandHi = null, bandN = 0;
  for (let hour = 0; hour < 24; hour++) for (let x = 400; x <= 700; x++) {
    const left = x / 10;
    const b = wteBudget({ target: 2000, eaten: 2000 - left, hour });
    count.band++;
    if (b.state === 'meal' && !wteRank(POOLS[0], b, []).length) { bandN++; if (hour === 21) { bandLo = bandLo === null ? left : bandLo; bandHi = left; } }
  }
  // P7 — the first target (step 10) at which a first answer is tier 1, or out
  // of its period, with nothing eaten; and tier 1 with the ready meals alone.
  const onset = (pool, test) => {
    for (let T = 1000; T <= 6000; T += 10) for (let hour = 0; hour < 24; hour++) {
      const b = wteBudget({ target: T, eaten: 0, hour });
      const l = wteRank(pool, b, []);
      if (l.length && test(l[0])) return [T, hour, b.kcal, l[0].id, l[0].p, l[0].kcal];
    }
    return null;
  };
  const ready = POOLS[0].filter((r) => r.kind === 'builtin');
  const onsets = { tier1: onset(POOLS[0], (x) => x.tier === 1), out: onset(POOLS[0], (x) => x.o === 1), readyTier1: onset(ready, (x) => x.tier === 1) };
  return { fail, count, band: [bandLo, bandHi, bandN], onsets };
}

// THE GRID'S REALM. In context()'s sandbox every built-in (Math, Number, Set)
// is found through the sandbox's interceptors — measured 300 ns a Math.round,
// 0.9 ms a rank, two minutes for the grid. A realm made with DONT_CONTEXTIFY
// has an ordinary global object (Node ≥ 22.8; CI runs 24): the same four files
// run whole in it, the rule's code byte for byte, 100 times faster. It holds
// no store — only the pure rule and its helpers run here (t() reads English);
// every row it ranks was priced by the real app above.
function fastRealm() {
  assert.ok(vm.constants && vm.constants.DONT_CONTEXTIFY, 'the grid needs vm.constants.DONT_CONTEXTIFY (Node 22.8 or later)');
  const g = vm.createContext(vm.constants.DONT_CONTEXTIFY);
  vm.runInContext("var window = globalThis; var DB = { prefs: { get: () => ({ lang: 'en' }) } };", g);
  for (const f of ['js/i18n.js', 'js/catalog.js', 'js/ui.js', 'js/food.js']) vm.runInContext(read(f), g, { filename: f });
  return (code) => vm.runInContext(code, g);
}

let gridLine = '';
test('GRID P1–P15', () => {
  const t0 = Date.now();
  const pools = [plain(DAY1), plain(DAY1).concat([plain(R1ROW)]), plain(DAY1).concat([plain(B1ROW), plain(B2ROW)])];
  const args = {
    targets: [1000, 1200, 1500, 1800, 2000, 2200, 2600, 2650, 2700, 3200, 3780, 4200],
    pcts: [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 93, 95, 96, 97, 98, 99, 100, 105],
    kgpl: [[null, null], [80, 110], [55, 0]],
    eatenKeys: ['builtin:sg-greek-yogurt-berries', 'catalog:Mansaf', 'n:chicken wrap', 'recipe:r1', 'bundle:b1', 'catalog:Lamb over Rice', 'builtin:sg-protein-shake-dates'],
    pools, reversed: plain(DAY1).reverse(), htmlHours: [1, 8, 13, 17, 20, 23],
    bundleItems: { b1: B1.items, b2: B2.items },
  };
  const fast = fastRealm();
  const api = fast('({ wteBudget, wteRank, wtePortion, wteAfter, wteNext, wteEntry, wteAnswerHtml, wteItems, recViewRowsHtml, mealPeriodFor, SHR_PERIODS, WTE })');
  // The rows the REAL store priced (DAY1 and the rest), made the fast realm's own objects.
  const local = fast('JSON.parse')(json(args));
  const out = plain(fast('(' + grid.toString() + ')')(api, local));
  const ms = Date.now() - t0;
  const props = Object.keys(out.fail);
  assert.ok(!props.length, 'the grid: ' + props.map((p) => `${p} ×${out.fail[p].length}: ${out.fail[p].join(' ; ')}`).join(' || '));
  assert.equal(out.count.cells, 12 * 20 * 24 * 2 * 3 * 3, 'every cell ran');
  let meal0 = 0;
  for (const T of args.targets) for (const pct of args.pcts) if (Math.round(T - T * pct / 100) >= 50) meal0 += 24 * 2 * 3;
  assert.equal(out.count.reversed, meal0, 'the reversed slice: every meal cell of the code meals');
  assert.ok(out.count.picks > 1000000 && out.count.html > 10000, 'setup: picks and texts checked: ' + json(out.count));
  deq(out.band, [49.5, 57.4, 24 * 80], 'P7: empty exactly on 49.5–57.4 at every hour');
  deq(out.onsets.tier1, [3780, 19, 1890, 'catalog:Lamb over Rice', 2, 1700], 'P7: a tier-1 first answer first appears at 3,780 (19:00)');
  deq(out.onsets.out, [4940, 0, 1136, 'catalog:Lamb over Rice', 1.25, 1063], 'P7: an out-of-period first answer first appears at 4,940 (00:00, a late snack)');
  deq(out.onsets.readyTier1, [2680, 19, 1340, 'builtin:sg-chicken-rice-salad', 2, 1204], 'P7: with the ready meals alone, at 2,680');
  assert.ok(ms < 15000, `the grid ran in ${ms} ms (must stay under 15 s)`);
  gridLine = `${out.count.cells} budgets (${out.count.picks} picks, ${out.count.reversed} reversed, ${out.count.html} texts, ${out.count.notarget} no-target, ${out.count.band} band steps) in ${ms} ms`;
});

// ---------------------------------------------------------------- P12. junk through every pure function
test('P12 every pure function is total', () => {
  const junk = [null, undefined, 'x', '', NaN, 1e9, -1e9, Infinity, 0, -1, [], [1, 'x', null], {}, { state: 'meal' }, { id: 'a', meals: 'x', kcal: 5 },
    { id: 'b', meals: ['lunch'], kcal: 280, maxPor: NaN }, { target: 'x', eaten: {}, hour: [] }];
  const b = W.wteBudget({ target: 2000, eaten: 0, hour: 12 });
  let n = 0;
  for (const x of junk) for (const y of junk) {
    W.wtePeriod(x, y); W.wteBudget(x); W.wtePortion(x, y, x); W.wteRank(x, y, x); W.wteRank([x, y], b, y); W.wteRank([x, y], W.wteBudget({ hour: 8 }), x);
    W.wteNext(x, y); W.wteWord(x); W.wteAfter(x, y); W.wteEatenKeys([x, y], A.fold); W.wteEatenKeys(x, y); W.wteItems(x, y); W.wteEntry(x);
    W.wteReadyRow(x, y, x, true, A.fold); W.wteRecipeRow(x, y, A.fold); W.wteCatRow(x, true, A.fold); W.wteBundleRow(x, y); W.wteHeadHtml(x);
    for (const html of [W.wteAnswerHtml(x, y), W.wteAnswerHtml(x, b)]) {
      assert.equal(typeof html, 'string', 'wteAnswerHtml answers a string');
      assert.ok(!/NaN|undefined/.test(html), `wteAnswerHtml(${String(json(x))}, …) prints no NaN and no undefined: ${html.slice(0, 120)}`);
    }
    n++;
  }
  assert.equal(n, junk.length * junk.length);
  // A pick whose row is missing or not an object draws nothing at all.
  for (const p of [{ row: null }, { row: 'x' }, { p: 1, kcal: 5 }]) assert.equal(W.wteAnswerHtml(p, b), '', 'no row, no answer: ' + json(p));
  // …and the OTHER argument: a real pick under every junk budget, and a pick whose row is an
  // object with no figures (or a catalogue row with a weight and no portion), under a real one.
  const real = W.wteRank([{ id: 'r', kind: 'catalog', srcId: 'r', name: 'R', meals: ['lunch'], servings: 1, kcal: 500, protein: 30, carbs: 40, fat: 20, items: [], grams: 250, maxPor: 2, keys: [] }], b, [])[0];
  assert.ok(real && real.row, 'setup: a real pick');
  for (const y of junk) {
    const html = W.wteAnswerHtml(real, y);
    assert.equal(typeof html, 'string', 'wteAnswerHtml answers a string under a junk budget: ' + json(y));
    assert.ok(!/NaN|undefined/.test(html), `a real pick under the budget ${String(json(y))} prints no NaN and no undefined: ${html.slice(0, 160)}`);
  }
  for (const y of [null, undefined, 'x', 5]) assert.equal(W.wteAnswerHtml(real, y), '', 'no budget, no answer: ' + json(y));
  for (const p of [{ row: {} }, { row: { kind: 'catalog', grams: 100 } }, { row: {}, o: 0, p: 'x', kcal: 'y', protein: null, carbs: {}, fat: [] }]) {
    const html = W.wteAnswerHtml(p, b);
    assert.ok(typeof html === 'string' && !/NaN|undefined/.test(html), `a row with no figures prints no NaN and no undefined (${json(p)}): ${html.slice(0, 160)}`);
  }
  const odd = W.wteRank([{ id: 'b', meals: ['lunch'], kcal: 280, maxPor: NaN }], b, []);
  deq(fmts(odd), ['b×2=560'], 'a NaN maxPor reads as 2 (B 561: ×2 = 560)');
  deq(fmts(W.wteRank([{ id: 'c', meals: ['lunch'], kcal: 280, maxPor: 1 }], b, [])), ['c×1=280'], 'and a real one binds');
  deq(fmts(W.wteRank([{ id: 'd', meals: ['lunch'], kcal: '280', maxPor: 2 }], b, [])), ['d×2=560'], 'a kcal written as a string is read as its number (§4.2: Number(kcal))');
});

(async () => {
  const failed = [];
  for (const [name, fn] of cases) {
    try { await fn(); console.log('  ok    ' + name); }
    catch (e) { failed.push(name); console.log('  FAIL  ' + name + ' — ' + String((e && e.message) || e).split('\n')[0]); }
  }
  if (failed.length) {
    console.log(`test-what-to-eat: ${failed.length} of ${cases.length} cases failed (${failed.map((n) => n.split(' ')[0]).join(', ')})`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS what to eat: ${cases.length} cases — the pure rule in its place, the constants and WTE_CAT against the catalogue, the period and its advance, the budget, the portion and its hard cap, the worked examples E1–E23 with the three WTE_CAT overrides, the cycle, the adapters, the pool (no community, no saved copy twice), the markup escaped and honest, junk total, nothing mutated, wteAsk on the real store and its pool, a repeated bundle still eaten today, the after-line against the real ring; the grid: ${gridLine}`);
})().catch((e) => { console.log('test-what-to-eat: the runner itself threw — ' + ((e && e.stack) || e)); process.exitCode = 1; });
