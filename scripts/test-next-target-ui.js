// «البرنامج الذي يتقدّم وحده» ON THE TWO SCREENS WHERE SETS ARE LOGGED (v434) — in real Chrome.
//
//   node scripts/test-next-target-ui.js            # ar/dark + en/light, 375px
//   QA_ONLY=<words> node scripts/test-next-target-ui.js
//
// WHY THIS EXISTS. scripts/test-next-target.js holds the RULE (histories to
// their next target). This suite holds what the lifter meets: the grey figure
// in every open row of the guided run and of the day card IS that target, one
// line says why — citing the range wherever the screen does not already print
// it — a ✓ (or «اعتمد المقترح») takes it and says so with Undo, a figure the
// lifter typed is handed on as their own, no row is ever asked for more than
// one rep over the weakest set, a first-ever exercise has no ghost to take and
// says what to do, a logged card ends on the next figure, the plan's range and
// set count steer it, an unreadable plan target or an assisted machine
// silences it, pounds land on a pound plate, an untouched card is asked again
// when the history under it changes, and the planner's door to the range is
// there for a plan built by hand.
//
// Every case seeds its own history through DB.sessions and drives the screen
// the way a thumb does (a click, typed figures). The harness is the one
// scripts/test-run-home-ui.js uses: the repo over loopback, js/cloud.js as an
// offline stub, every non-loopback request aborted.
//
// Each check was seen failing on an in-memory plant of js/app.js or styles.css
// (the file on disk never written); they are named in docs/RELEASE-NOTES.md
// under v434.
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const LIVE = '#modal-root .modal-overlay:not(.is-out)';

async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: theme, timezoneId: 'Asia/Riyadh', locale: lang === 'ar' ? 'ar-SA' : 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && window.__vltReady, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 9000 }).catch(() => {});
  const ids = await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked(); DB.prefs.setUnit('kg');
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    DB.plan.clearAll();
    navigate('home');
    // Two ordinary lifts (not legs: their step differs; not core: its first-time
    // line names no count; not an assisted machine: it is not prescribed), one
    // assisted machine, one leg lift and one core exercise.
    const group = (e) => String(e.category || '').toLowerCase();
    const plain = DB.exercises.list().filter((e) => group(e) !== 'legs' && group(e) !== 'core' && e.machineType !== 'assisted_pullup');
    const assisted = DB.exercises.list().find((e) => e.machineType === 'assisted_pullup');
    const legs = DB.exercises.list().find((e) => group(e) === 'legs' && e.machineType !== 'assisted_pullup');
    const core = DB.exercises.list().find((e) => group(e) === 'core' && !e.machineType);
    return { a: plain[0].id, b: plain[1].id, assisted: assisted ? assisted.id : null, legs: legs ? legs.id : null, core: core ? core.id : null, today: todayISO() };
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, guard, lang, theme, ids };
}

// One exercise's history replaced by the given sessions: [[daysAgo, [[reps, kg], …]], …].
const seed = (kit, id, sessions) => kit.ev(({ id, sessions }) => {
  try { closeModal(); } catch (_) {}
  try { clearRestTimer(); } catch (_) {}
  hideToast();
  DB.sessions.listByExercise(id).forEach((s) => DB.sessions.remove(s.id));
  const today = todayISO();
  for (const [ago, sets] of sessions) DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -ago), sets: sets.map(([reps, weight]) => ({ reps, weight })) });
  DB.undo.clear();
}, { id, sessions });
const go = (kit, view, ctx) => kit.ev(({ view, ctx }) => {
  hideToast();
  navStack = [{ view: 'home', context: {} }];
  navigate('home', {}, { fromPop: true });
  navigate(view, ctx);
}, { view, ctx });
const run = (kit, id) => go(kit, 'session-run', { date: kit.ids.today, runOnly: [id] });
const dayOf = (kit, list, date) => go(kit, 'session-day', { date: date || kit.ids.today, sdOnly: list });
const settle = (kit) => kit.ev(() => { try { clearRestTimer(); } catch (_) {} try { closeModal(); } catch (_) {} hideToast(); DB.plan.clearAll(); DB.prefs.setUnit('kg'); navigate('home'); });

const rowsOf = (sel) => (kit) => kit.ev((sel) => [...document.querySelectorAll(sel)].map((r) => {
  const [reps, w] = r.querySelectorAll('input');
  return [reps.value, reps.placeholder, w.value, w.placeholder];
}), sel);
const runRows = rowsOf('.view.active .run-set-row');
const dayRows = (kit, id) => rowsOf(`.view.active [data-ex-card="${id}"] .sd-set-row`)(kit);
const stored = (kit, id, date) => kit.ev(({ id, date }) =>
  (DB.sessions.listByExercise(id).find((s) => s.date === date) || { sets: [] }).sets.map((s) => [s.reps, s.weight, s.done !== false]), { id, date: date || kit.ids.today });
const toastNow = (kit) => kit.ev(() => {
  const el = document.querySelector('.toast.show');
  return el ? { msg: (el.querySelector('.toast-msg') || el).textContent.trim(), undo: !!el.querySelector('.toast-action') } : null;
});
const tr = (kit, key) => kit.ev((k) => t(k), key);
// Whatever is read off the screen carries no unfilled placeholder: a stray «{» is a visible defect.
const textOf = async (kit, sel) => {
  const text = await kit.ev((sel) => { const el = document.querySelector('.view.active ' + sel); return el ? el.textContent.trim() : null; }, sel);
  assert.ok(text == null || !/[{}]/.test(text), `nothing on screen carries an unfilled placeholder: ${text}`);
  return text;
};
const count = (kit, sel) => kit.page.locator('.view.active ' + sel).count();
const tick = (kit, i) => kit.page.locator(`.view.active .run-set-row[data-set="${i}"] [data-done]`).click();
const firstTime = (kit, lo, hi) => kit.ev(({ lo, hi }) => (lo === hi ? t('nxt_first_pick_one') : t('nxt_first_pick')).replace('{lo}', fmtNum(lo)).replace('{hi}', fmtNum(hi)) + ' ' + t('nxt_first_then'), { lo, hi });
// A reason line as a screen must print it: the dictionary's sentence with its « ({range})» group
// FILLED — the range in a left-to-right isolate, so an Arabic line cannot show 12–8 — or REMOVED,
// where the plan block on screen already prints the range.
const cited = (kit, key, lo, hi) => kit.ev(({ key, lo, hi }) => t(key).replace(' ({range})', ' (\u2066' + (lo === hi ? fmtNum(lo) : fmtNum(lo) + '–' + fmtNum(hi)) + '\u2069)'), { key, lo, hi });
const uncited = (kit, key) => kit.ev((key) => t(key).replace(' ({range})', ''), key);
// Where the cited range is DRAWN: is the low figure left of the high one? Measured on the glyphs —
// an Arabic line reorders a bare «8–12» to «12–8» (the digits are weak, the dash neutral), which is
// what the isolate is for; the string alone cannot show it.
const rangeDrawnLowFirst = (kit, sel, lo, hi) => kit.ev(({ sel, lo, hi }) => {
  const node = document.querySelector('.view.active ' + sel).firstChild, text = node.textContent, open = text.indexOf('(');
  const left = (i) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return r.getBoundingClientRect().left; };
  return left(text.indexOf(String(lo), open)) < left(text.indexOf(String(hi), open));
}, { sel, lo, hi });
const x = (n, row) => Array.from({ length: n }, () => row);
const S = (n, reps, kg) => x(n, [reps, kg]);

const CASES = [
  ['the run: every open row hints the next target, one line says why, and nothing is written', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 8, 60)]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), x(3, ['', '9', '', '60']), 'three sets of 8 at 60 last time: each row is EMPTY and hints 9 at 60');
    assert.equal(await textOf(kit, '.run-nxt'), await tr(kit, 'nxt_rep'), 'and one line says why');
    assert.equal(await count(kit, '.run-suggest'), 0, 'the old «Suggested today» card is gone');
    assert.deepEqual(await stored(kit, a), [], 'opening the screen wrote nothing');
  }],
  ['the run: ✓ on an untouched row logs the target and says so, and Undo brings the same ghosts back', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 8, 60)]]);
    await run(kit, a);
    await tick(kit, 0);
    assert.deepEqual(await stored(kit, a), [[9, 60, true]], 'the ✓ logged the target, not last time\'s 8');
    assert.deepEqual(await toastNow(kit), { msg: await tr(kit, 'run_sug_saved'), undo: true }, 'and the toast names the suggestion, with Undo');
    await kit.page.locator('.toast.show .toast-action').click();
    assert.deepEqual(await stored(kit, a), [], 'Undo takes the set back');
    assert.deepEqual(await runRows(kit), x(3, ['', '9', '', '60']), 'and the rows hint the same target again');
  }],
  ['the run: the top of the range on every set, two sessions running — heavier, and the summary calls the record', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 12, 60)], [6, S(3, 12, 60)]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), x(3, ['', '8', '', '62.5']), 'the weight goes up one step and the reps return to the bottom of the range');
    assert.equal(await textOf(kit, '.run-nxt'), await cited(kit, 'nxt_up', 8, 12), 'the line names the range it speaks of — no plan block prints it on this screen');
    assert.equal(await rangeDrawnLowFirst(kit, '.run-nxt', 8, 12), true, 'and the range is drawn low to high in both languages: «8–12», never «12–8»');
    for (const i of [0, 1, 2]) { await tick(kit, i); await kit.ev(() => hideToast()); }
    assert.deepEqual(await stored(kit, a), x(3, [8, 62.5, true]));
    await kit.page.locator('.view.active [data-next]').click();
    assert.ok(await count(kit, '.run-sum-pr') >= 1, 'a set heavier than every one before it is a record, and the summary says so');
  }],
  ['the run: one rep at a time — a 5×5 with a missed rep is asked for that rep, a five against 8–12 for six, a heavy single for two', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, [[5, 100], [5, 100], [5, 100], [5, 100], [4, 100]]], [6, S(5, 5, 100)]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), x(5, ['', '5', '', '100']), 'five fives with one missed rep: five rows at 100 × 5 — the scheme is the lifter\'s own, never «8» at a five-rep weight');
    assert.equal(await textOf(kit, '.run-nxt'), await tr(kit, 'nxt_rep'));
    await seed(kit, a, [[3, S(2, 5, 100)]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), x(2, ['', '6', '', '100']), 'two fives are not a scheme: the zone stands, and the step toward it is ONE rep');
    assert.equal(await textOf(kit, '.run-nxt'), await cited(kit, 'nxt_hold', 8, 12), 'the line says the weight stays, and which range it means');
    await seed(kit, a, [[3, [[1, 140], [5, 100], [5, 100], [5, 100]]]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), [['', '2', '', '140'], ...x(3, ['', '5', '', '100'])], 'a single at 140 over back-off fives: two at 140, and the back-off rows keep their own figures');
    await tick(kit, 1);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'run_filled_saved'), 'a back-off row is last time\'s own: its ✓ does not call it a suggestion');
    assert.deepEqual(await stored(kit, a), [[5, 100, true]]);
  }],
  ['the run: a first-ever exercise has NO ghost, says what to aim for, and ✓ on its empty row is refused', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, []);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), [['', '0', '', '0']], 'one blank row: no figure to take');
    assert.equal(await textOf(kit, '.run-nxt'), await firstTime(kit, 8, 12), 'the line says what to aim for and what happens from the next session');
    await tick(kit, 0);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'add_at_least_one'), 'a ✓ with no numbers is refused');
    assert.deepEqual(await stored(kit, a), [], 'and logs nothing — never «8 × 0»');
  }],
  ['the plan steers it: its range and its set count are the target\'s, and the plan block stays beside the line', async (kit) => {
    const { a, b } = kit.ids;
    await seed(kit, a, [[3, S(4, 8, 60)], [6, S(4, 8, 60)]]);
    await seed(kit, b, []);
    await kit.ev(({ a, b }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA day', exerciseIds: [a, b] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: todayISO() });
      const r = DB.plan.setSlotTargets(0, { [a]: { sets: 4, reps: '6-8', notes: '' }, [b]: { sets: 3, reps: '6-8', notes: '' } }, JSON.stringify(DB.plan.get()));
      if (!r.ok) throw new Error('setup: the targets were refused');
    }, kit.ids);
    await go(kit, 'session-run', { date: kit.ids.today });
    assert.deepEqual(await runRows(kit), x(4, ['', '6', '', '62.5']), 'a plan of 6–8 × 4, reached twice: four rows, heavier, back to 6');
    assert.equal(await count(kit, '.plan-target'), 1, 'the plan\'s own block is still drawn');
    assert.equal(await textOf(kit, '.run-nxt'), await uncited(kit, 'nxt_up'), 'and the line beside it — a plan target no longer silences the advice — names no range: the block above prints it');
    await kit.page.locator('.view.active [data-next]').click();
    assert.deepEqual(await runRows(kit), x(3, ['', '0', '', '0']), 'the next exercise is new: the plan\'s three rows, no ghosts');
    assert.equal(await textOf(kit, '.run-nxt'), await tr(kit, 'nxt_first_then'), 'its first-time line does not repeat the range the plan block prints');
    assert.deepEqual(await stored(kit, a), [], 'moving on from untouched prescribed rows logged nothing');
    await go(kit, 'session-day', { date: kit.ids.today });
    assert.equal(await textOf(kit, `[data-ex-card="${a}"] .sd-nxt`), await cited(kit, 'nxt_up', 6, 8), 'the day card draws no plan block, so its line cites the range — the plan\'s 6–8, not the default zone');
  }],
  ['where no rule applies the rows are last time\'s own and no line is drawn: a timed plan target, bodyweight at the top of the plan\'s range, an assisted machine', async (kit) => {
    const { a, assisted } = kit.ids;
    // A LOADED history on purpose: at bodyweight a target the rule could not read and the default
    // zone would print the same rows (40 reps is past any range), and the check could not fail.
    await seed(kit, a, [[3, S(2, 10, 20)]]);
    await kit.ev(({ a }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA day', exerciseIds: [a] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: todayISO() });
      const r = DB.plan.setSlotTargets(0, { [a]: { sets: 2, reps: '30 sec', notes: '' } }, JSON.stringify(DB.plan.get()));
      if (!r.ok) throw new Error('setup: the targets were refused');
    }, kit.ids);
    await go(kit, 'session-run', { date: kit.ids.today });
    assert.deepEqual(await runRows(kit), x(2, ['', '10', '', '20']), '«30 sec» is not a rep range: the rows hint what was done, not the 11 the default zone would ask');
    assert.equal(await count(kit, '.run-nxt'), 0, 'and no line is drawn — the plan stays the instruction');
    assert.equal(await count(kit, '.plan-target'), 1);
    // Bodyweight at the top of the plan's own range: the next step is added load, and that is the lifter's call.
    await seed(kit, a, [[3, S(3, 12, 0)], [6, S(3, 12, 0)]]);
    await kit.ev(({ a }) => {
      const r = DB.plan.setSlotTargets(0, { [a]: { sets: 3, reps: '8-12', notes: '' } }, JSON.stringify(DB.plan.get()));
      if (!r.ok) throw new Error('setup: the targets were refused');
    }, kit.ids);
    await go(kit, 'session-run', { date: kit.ids.today });
    assert.deepEqual(await runRows(kit), x(3, ['', '12', '', '0']), 'twelve at bodyweight under a plan of 8–12: the rows repeat it — no «13» the plan never asked for');
    assert.equal(await count(kit, '.run-nxt'), 0, 'and no line: there is nothing more this rule can ask');
    await kit.ev(() => DB.plan.clearAll());
    assert.ok(assisted, 'setup: the catalogue has an assisted machine');
    await seed(kit, assisted, [[3, S(3, 8, 40)]]);
    await run(kit, assisted);
    assert.deepEqual(await runRows(kit), x(3, ['', '8', '', '40']), 'an assisted machine (lower is better) is not progressed');
    assert.equal(await count(kit, '.run-nxt'), 0);
  }],
  ['pounds: the target lands on a pound plate, and its ✓ stores those kilograms', async (kit) => {
    const { a } = kit.ids;
    await kit.ev(() => DB.prefs.setUnit('lb'));
    await seed(kit, a, [[3, S(3, 12, 61.23)], [6, S(3, 12, 61.23)]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), x(3, ['', '8', '', '140']), '135 lb at the top twice: 140, never 137.8');
    await tick(kit, 0);
    assert.deepEqual(await stored(kit, a), [[8, await kit.ev(() => toStoredKg(140, 'lb')), true]]);
  }],
  ['bodyweight: the rows ask for one more rep on the weakest set, and a logged card ends on reps alone', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, [[10, 0], [8, 0], [7, 0]]]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), [['', '10', '', '0'], ['', '8', '', '0'], ['', '8', '', '0']], '10, 8, 7 at bodyweight: the weakest set is asked for 8, and no row for less than it did');
    assert.equal(await textOf(kit, '.run-nxt'), await tr(kit, 'nxt_bw'));
    await tick(kit, 2);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'run_sug_saved'));
    assert.equal(((await stored(kit, a))[0] || [])[0], 8, 'the ✓ logged the eight');
    await seed(kit, a, [[0, [[10, 0], [8, 0], [7, 0]]]]);
    await dayOf(kit, [a]);
    const card = `[data-ex-card="${a}"]`;
    assert.equal(await textOf(kit, card + ' .sd-nxt'), (await tr(kit, 'nxt_after_bw')).replace('{r}', '10 · 8 · 8'), 'there is no weight to state, so the logged card states the reps each row will be asked for');
    assert.equal(await kit.ev((sel) => { const n = document.querySelector('.view.active ' + sel + ' .sd-nxt .num'); return n ? n.getAttribute('dir') : null; }, card), 'ltr', 'as one left-to-right group');
  }],
  ['a leg lift from 50 kg takes the larger step, and the day card follows the plan\'s set count', async (kit) => {
    const { legs, a } = kit.ids;
    assert.ok(legs, 'setup: the catalogue has a leg exercise');
    await seed(kit, legs, [[3, S(3, 12, 100)], [6, S(3, 12, 100)]]);
    await run(kit, legs);
    assert.deepEqual(await runRows(kit), x(3, ['', '8', '', '105']), 'legs at 100 kg, the top twice: +5, not +2.5 (the category is stored «Legs»)');
    // The day card under a plan that says four sets, when last time had three.
    await seed(kit, a, [[3, S(3, 8, 60)]]);
    await kit.ev(({ a }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA day', exerciseIds: [a] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: todayISO() });
      const r = DB.plan.setSlotTargets(0, { [a]: { sets: 4, reps: '', notes: '' } }, JSON.stringify(DB.plan.get()));
      if (!r.ok) throw new Error('setup: the targets were refused');
    }, kit.ids);
    await go(kit, 'session-day', { date: kit.ids.today });
    assert.deepEqual(await dayRows(kit, a), x(4, ['', '9', '', '60']), 'four rows, as the plan says — the fourth hints the same target');
  }],
  ['three weeks away: the rows repeat your own figures, the line says so, and ✓ says «last time»', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[30, S(3, 12, 60)], [33, S(3, 12, 60)]]);
    await run(kit, a);
    assert.deepEqual(await runRows(kit), x(3, ['', '12', '', '60']), 'two tops, but 30 days ago: no raise, the same figures');
    assert.equal(await textOf(kit, '.run-nxt'), await tr(kit, 'nxt_back'));
    await tick(kit, 0);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'run_filled_saved'), 'the ✓ names last time\'s numbers — nothing was suggested');
  }],
  ['the run resumes: the set logged today stays, the rows still ahead keep the target', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 8, 60)], [0, [[9, 60]]]]);
    await run(kit, a);
    const rows = await runRows(kit);
    assert.deepEqual(rows[0].filter((_, i) => i % 2 === 0), ['9', '60'], 'today\'s own set is shown as logged');
    assert.deepEqual(rows.slice(1), x(2, ['', '9', '', '60']), 'and the two rows ahead hint the target computed from BEFORE today');
  }],
  ['the run: a set added under untouched prescribed rows hints the same target, and its ✓ names the suggestion', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 12, 60)], [6, S(3, 12, 60)]]);
    await run(kit, a);
    await kit.page.locator('.view.active [data-addset]').click();
    const rows = await runRows(kit);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[3], ['', '8', '', '62.5'], 'the fourth row hints the target too');
    await tick(kit, 3);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'run_sug_saved'));
    assert.deepEqual(await stored(kit, a), [[8, 62.5, true]]);
  }],
  ['the run: a figure typed over a prescribed one is the lifter\'s own — the rows ahead take it, and their ✓, a set added under them too, names an earlier set and not the suggestion', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 12, 60)], [6, S(3, 12, 60)]]);
    await run(kit, a);
    await kit.page.locator('.view.active .run-set-row[data-set="0"] [data-field="weight"]').fill('60');
    await tick(kit, 0);
    assert.deepEqual(await stored(kit, a), [[8, 60, true]], 'the target said 62.5; 60 was typed, and 60 × 8 is what is stored');
    await kit.ev(() => hideToast());
    assert.deepEqual((await runRows(kit)).slice(1), x(2, ['', '8', '', '60']), 'the two rows ahead now hint 60: that is what the bar is loaded with');
    await tick(kit, 1);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'run_carry_updated'), 'their ✓ says the numbers are an earlier set\'s — «the suggested numbers» would be untrue of a weight the lifter chose');
    await kit.ev(() => hideToast());
    await kit.page.locator('.view.active [data-addset]').click();
    const rows = await runRows(kit);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[3], ['', '8', '', '60'], 'a set added under the last open row hints the same figures');
    await tick(kit, 3);
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'run_carry_updated'), 'and from the same source: its ✓ names the earlier set too');
  }],
  ['the day card: the same target and the same line; «اعتمد المقترح» fills, Save writes, and the logged card ends on the next figure', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 8, 60)]]);
    await dayOf(kit, [a]);
    const card = `[data-ex-card="${a}"]`;
    assert.deepEqual(await dayRows(kit, a), x(3, ['', '9', '', '60']), 'the card\'s rows hint what the run\'s do');
    assert.equal(await textOf(kit, card + ' .sd-nxt'), await tr(kit, 'nxt_rep'), 'under the same line');
    assert.equal(await textOf(kit, card + ' [data-like-last]'), await tr(kit, 'sd_take_sug'), 'the fill button names what it takes: the suggestion, not «last time»');
    await kit.page.locator('.view.active ' + card + ' [data-like-last]').click();
    assert.deepEqual(await dayRows(kit, a), x(3, ['9', '9', '60', '60']), 'one tap makes every ghost a figure');
    assert.deepEqual(await stored(kit, a), [], 'and still writes nothing');
    await kit.page.locator('.view.active ' + card + ' [data-save-ex]').click();
    assert.deepEqual(await stored(kit, a), x(3, [9, 60, true]), 'Save is the writer');
    assert.equal(await textOf(kit, card + ' .sd-nxt'), (await tr(kit, 'nxt_after')).replace('{f}', '60 KG × 10'), 'the logged card says what comes next');
    assert.equal(await kit.ev((sel) => { const n = document.querySelector('.view.active ' + sel + ' .sd-nxt .num'); return n ? n.getAttribute('dir') : null; }, card), 'ltr', 'the figure is one left-to-right group in both languages');
  }],
  ['day one: a first-ever card says what to aim for, offers nothing to take, and ends on a computed figure', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, []);
    await dayOf(kit, [a]);
    const card = `[data-ex-card="${a}"]`;
    assert.equal(await textOf(kit, card + ' .sd-nxt'), await firstTime(kit, 8, 12));
    assert.equal(await count(kit, card + ' [data-like-last]'), 0, 'there is no ghost, so no fill button');
    await kit.page.locator(`.view.active ${card} .sd-set-row[data-set="0"] [data-field="reps"]`).fill('10');
    await kit.page.locator(`.view.active ${card} .sd-set-row[data-set="0"] [data-field="weight"]`).fill('60');
    await kit.page.locator('.view.active ' + card + ' [data-save-ex]').click();
    assert.equal(await textOf(kit, card + ' .sd-nxt'), (await tr(kit, 'nxt_after')).replace('{f}', '60 KG × 11'), 'the very first session already ends on the next target');
  }],
  ['the first-time sentence is said once per page, and moves to the next new card when the first is logged', async (kit) => {
    const { a, b } = kit.ids;
    await seed(kit, a, []); await seed(kit, b, []);
    await dayOf(kit, [a, b]);
    const first = await firstTime(kit, 8, 12);
    assert.equal(await count(kit, '.sd-nxt'), 1, 'two new exercises, one sentence');
    assert.equal(await textOf(kit, `[data-ex-card="${a}"] .sd-nxt`), first, 'on the first card');
    await kit.page.locator(`.view.active [data-ex-card="${a}"] .sd-set-row[data-set="0"] [data-field="reps"]`).fill('10');
    await kit.page.locator(`.view.active [data-ex-card="${a}"] .sd-set-row[data-set="0"] [data-field="weight"]`).fill('40');
    await kit.page.locator(`.view.active [data-ex-card="${a}"] [data-save-ex]`).click();
    assert.equal(await textOf(kit, `[data-ex-card="${b}"] .sd-nxt`), first, 'the second card carries it once the first is logged');
  }],
  ['the first-time sentence names each card\'s own range: a plan of 6–8 is not answered by 8–12, a single figure reads as one, and a core exercise is promised no count', async (kit) => {
    const { a, b, core } = kit.ids;
    assert.ok(core, 'setup: the catalogue has a core exercise');
    for (const id of [a, b, core]) await seed(kit, id, []);
    await kit.ev(({ a, b, core }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA day', exerciseIds: [a, b, core] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: todayISO() });
      const r = DB.plan.setSlotTargets(0, { [a]: { sets: 3, reps: '6-8', notes: '' }, [b]: { sets: 3, reps: '10', notes: '' } }, JSON.stringify(DB.plan.get()));
      if (!r.ok) throw new Error('setup: the targets were refused');
    }, kit.ids);
    await go(kit, 'session-day', { date: kit.ids.today });
    assert.equal(await textOf(kit, `[data-ex-card="${a}"] .sd-nxt`), await firstTime(kit, 6, 8), 'the plan says 6–8, and so does the sentence');
    assert.equal(await textOf(kit, `[data-ex-card="${b}"] .sd-nxt`), await firstTime(kit, 10, 10), 'a plan of «10» reads as one figure, not «10–10»');
    assert.equal(await textOf(kit, `[data-ex-card="${core}"] .sd-nxt`), await tr(kit, 'nxt_first_then'), 'a plank is held, not counted: only what happens next');
  }],
  ['the day card of an assisted machine offers last time\'s own figures under their true name, with no line', async (kit) => {
    const { assisted } = kit.ids;
    assert.ok(assisted, 'setup: the catalogue has an assisted machine');
    await seed(kit, assisted, [[3, S(3, 8, 40)]]);
    await dayOf(kit, [assisted]);
    const card = `[data-ex-card="${assisted}"]`;
    assert.deepEqual(await dayRows(kit, assisted), x(3, ['', '8', '', '40']), 'lower is better there: nothing is prescribed, the ghosts are what was done');
    assert.equal(await count(kit, card + ' .sd-nxt'), 0, 'no line');
    assert.equal(await textOf(kit, card + ' [data-like-last]'), await tr(kit, 'sd_like_last'), 'and the fill button says «كالمرّة السابقة»: it takes no suggestion');
  }],
  ['the unit switch re-asks an untouched card in the new unit and leaves a typed card alone', async (kit) => {
    const { a, b } = kit.ids;
    await seed(kit, a, [[3, S(3, 12, 60)], [6, S(3, 12, 60)]]);
    await seed(kit, b, [[3, S(3, 8, 60)]]);
    await dayOf(kit, [a, b]);
    assert.deepEqual((await dayRows(kit, a))[0], ['', '8', '', '62.5'], 'setup: in kilograms the target is 62.5');
    await kit.page.locator(`.view.active [data-ex-card="${b}"] .sd-set-row[data-set="0"] [data-field="reps"]`).fill('7');
    await kit.page.locator('.view.active [data-sd-unit="lb"]').click();
    assert.deepEqual((await dayRows(kit, a))[0], ['', '8', '', '140'], 'in pounds it is the next pound plate, 140 — not 62.5 kg re-printed as 138');
    assert.equal((await dayRows(kit, b))[0][0], '7', 'the card being typed in keeps its figure');
  }],
  ['the day card is asked again when the history under it changes: a session logged elsewhere moves an untouched target, and a card with typing on it is left alone', async (kit) => {
    const { a, b } = kit.ids;
    await seed(kit, a, [[3, S(3, 8, 60)]]);
    await seed(kit, b, [[3, S(3, 8, 60)]]);
    await dayOf(kit, [a, b]);
    assert.deepEqual(await dayRows(kit, a), x(3, ['', '9', '', '60']), 'setup: three eights last time, so nine');
    await kit.page.locator(`.view.active [data-ex-card="${b}"] .sd-set-row[data-set="0"] [data-field="reps"]`).fill('7');
    // The exercise page is opened from the card, a session is logged for yesterday while it is up, and Back returns here.
    await kit.ev(({ a, b }) => {
      navigate('exercise-detail', { exerciseId: a });
      const y = addDaysISO(todayISO(), -1);
      for (const id of [a, b]) DB.sessions.add({ exerciseId: id, date: y, sets: [10, 10, 10].map((reps) => ({ reps, weight: 60 })) });
      goBack();
    }, kit.ids);
    assert.equal(await kit.ev(() => currentView), 'session-day', 'setup: Back returned to the day page');
    assert.deepEqual(await dayRows(kit, a), x(3, ['', '11', '', '60']), 'the untouched card follows the new history: three tens yesterday, so eleven — not the nine computed before');
    assert.deepEqual((await dayRows(kit, b))[0], ['7', '9', '', '60'], 'the card being typed in keeps its figure and its ghosts');
  }],
  ['an older day\'s logged card does not speak for what comes next; the newest one does', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 8, 60)], [6, S(3, 8, 60)]]);
    const d6 = await kit.ev(() => addDaysISO(todayISO(), -6)), d3 = await kit.ev(() => addDaysISO(todayISO(), -3));
    await dayOf(kit, [a], d6);
    assert.equal(await count(kit, `[data-ex-card="${a}"].logged`), 1, 'setup: the card of six days ago is a logged one');
    assert.equal(await count(kit, '.sd-nxt'), 0, 'it prints no «next time»');
    await dayOf(kit, [a], d3);
    assert.equal(await textOf(kit, `[data-ex-card="${a}"] .sd-nxt`), (await tr(kit, 'nxt_after')).replace('{f}', '60 KG × 9'), 'the newest session\'s card does');
  }],
  ['a logged card three weeks old still ends on a figure: every row\'s own, to repeat', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[25, [[10, 60], [9, 60], [8, 60]]]]);
    await dayOf(kit, [a], await kit.ev(() => addDaysISO(todayISO(), -25)));
    assert.equal(await count(kit, `[data-ex-card="${a}"].logged`), 1, 'setup: the card of 25 days ago is a logged one, and it is the newest session');
    assert.equal(await textOf(kit, `[data-ex-card="${a}"] .sd-nxt`), (await tr(kit, 'nxt_after')).replace('{f}', '60 KG × 10 · 9 · 8'), 'the next session is three weeks on: each row is asked for what it did — never one figure standing for three');
  }],
  ['the planner opens the range for a plan built by hand, and the range it saves steers the target', async (kit) => {
    const { a } = kit.ids;
    await seed(kit, a, [[3, S(3, 5, 100)], [6, S(3, 5, 100)]]);
    await kit.ev(({ a }) => { DB.plan.setRotation({ cycle: [{ name: 'QA day', exerciseIds: [a] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: todayISO() }); }, kit.ids);
    await go(kit, 'planner', {});
    assert.equal(await count(kit, '[data-edit-targets="0"]'), 1, 'a slot with exercises and NO targets still offers «تعديل المجموعات والتكرارات»');
    await kit.page.locator('.view.active [data-edit-targets="0"]').click();
    await kit.page.locator(LIVE + ' #pt-0-reps').fill('5');
    await kit.page.locator(LIVE + ' [data-target-form] button[type="submit"]').click();
    await kit.page.waitForFunction((sel) => !document.querySelector(sel), LIVE, { timeout: 3000 });
    assert.equal(await kit.ev((a) => DB.plan.get().cycle[0].targets[a].reps, a), '5', 'the range is stored in the plan\'s own field');
    await go(kit, 'session-run', { date: kit.ids.today });
    assert.deepEqual(await runRows(kit), x(3, ['', '5', '', '102.5']), 'three fives at 100, twice, against a declared «5»: 102.5 × 5');
    assert.equal(await textOf(kit, '.run-nxt'), await uncited(kit, 'nxt_up'), 'the plan block prints the «5» just saved, so the line does not repeat it');
  }],
  ['at 320 px with larger text the line wraps inside its card and is never cut, in the run and on the day card', async (kit) => {
    const { a } = kit.ids;
    const fit = (sel) => kit.ev((sel) => {
      const el = document.querySelector('.view.active ' + sel);
      if (!el) return { missing: sel };
      const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect(), cs = getComputedStyle(el), main = document.querySelector('.main');
      return {
        missing: null, inside: r.left >= p.left - 0.5 && r.right <= p.right + 0.5, cut: el.scrollWidth > el.clientWidth + 1,
        oneLineOnly: cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis',
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1 || (!!main && main.scrollWidth > main.clientWidth + 1),
      };
    }, sel);
    const good = { missing: null, inside: true, cut: false, oneLineOnly: false, sideways: false };
    // The page's own toolbar (the date field + KG/LB): every child inside the toolbar's box. Measured
    // by rectangles — a scrollWidth would count the toggle's tap halo. Before v435 the toggle sat
    // 14 px outside it here, and under a wider fallback font the page scrolled sideways.
    const toolbarHolds = () => kit.ev(() => {
      const tb = document.querySelector('.view.active .sd-toolbar'), box = tb.getBoundingClientRect();
      return [...tb.children].map((n) => { const r = n.getBoundingClientRect(); return [Math.max(0, Math.round(box.left - r.left)), Math.max(0, Math.round(r.right - box.right))]; });
    });
    try {
      await kit.page.setViewportSize({ width: 320, height: 700 });
      await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
      // Every sentence that cites the range, at its longest — and the first-time pair.
      const short = [[7, 60], [5, 60], [5, 60]];
      const STATES = [
        ['first', [], () => firstTime(kit, 8, 12)],
        ['up', [[3, S(3, 12, 60)], [6, S(3, 12, 60)]], () => cited(kit, 'nxt_up', 8, 12)],
        ['confirm', [[3, S(3, 12, 60)]], () => cited(kit, 'nxt_confirm', 8, 12)],
        ['stretch', [[3, S(3, 12, 10)], [6, S(3, 12, 10)]], () => cited(kit, 'nxt_stretch', 8, 12)],
        ['hold', [[3, short]], () => cited(kit, 'nxt_hold', 8, 12)],
        ['deload', [[3, short], [6, short], [9, short]], () => cited(kit, 'nxt_deload', 8, 12)],
      ];
      for (const [state, history, want] of STATES) {
        await seed(kit, a, history);
        await run(kit, a);
        assert.equal(await textOf(kit, '.run-nxt'), await want(), `setup: this history reaches «${state}», and the line is its longest form`);
        assert.deepEqual(await fit('.run-nxt'), good, `the run's line fits at 320 px with larger text («${state}»)`);
        await dayOf(kit, [a]);
        assert.deepEqual(await toolbarHolds(), [[0, 0], [0, 0]], `the date field and the unit toggle stay inside the toolbar's own box at 320 px with larger text («${state}»)`);
        assert.deepEqual(await fit(`[data-ex-card="${a}"] .sd-nxt`), good, `the card's line fits at 320 px with larger text («${state}»)`);
        if (state !== 'first') {
          assert.deepEqual(await kit.ev((sel) => { const b = document.querySelector('.view.active ' + sel), row = b.parentElement; return { label: b.scrollWidth <= b.clientWidth + 1, row: row.scrollWidth <= row.clientWidth + 1 }; }, `[data-ex-card="${a}"] [data-like-last]`),
            { label: true, row: true }, `«اعتمد المقترح» fits its button and the card's action row («${state}»)`);
        }
      }
    } finally {
      await kit.ev(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
      await kit.page.setViewportSize({ width: 375, height: 812 });
    }
  }],
];

async function main() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;
        try { await fn(kit); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
        finally { await settle(kit).catch(() => {}); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  next target UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  next target UI (${passed} cases, AR/dark + EN/light, 375px): every open row of the run and of the day card hints the next target with one line saying why, the range cited where no plan block prints it; no row is asked for more than one rep over the weakest set; a ✓ or «اعتمد المقترح» takes it, names the suggestion and can be undone, and a typed figure is handed on as the lifter's own; a first-ever exercise has no ghost, is told its own range once and ends its first day on a computed figure; the plan's range and set count steer it and its block stays; a timed target, bodyweight at the top of the plan's range and an assisted machine silence it; pounds land on a pound plate; three weeks away repeats, row by row; the run resumes with the target; the unit switch and a changed history re-ask an untouched card; the planner opens the range for a hand-built plan; every line fits at 320 px with larger text`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });
