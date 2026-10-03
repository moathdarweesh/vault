#!/usr/bin/env node
// «اقتراحات» (v419), driven in a real browser: the Food tab's suggestions card
// fed by recipes other users share — four meal periods, up to three community
// recipes for the period the clock is in, each a door to its ingredients with
// «سجّل حصّة», «احفظها في وصفاتي» and a report — and the other half, sharing
// one's own recipe from its view («شاركها» / «أزل من المشاركة»), which reports
// the moderator's verdict in one translated sentence.
//
// Same harness as scripts/test-skips-ui.js (scripts/fp/server.js): the repo
// over loopback on a free port, js/cloud.js replaced by the offline stub
// ('out'), and a route filter that aborts every request that is not 127.0.0.1.
// Playwright is external (npm i --no-save playwright eslint@9 globals).
//
// THE SERVER IS NEVER CALLED. Each case sets the five Cloud methods this
// feature reads (pullSharedRecipes, getSharedRecipeItems, getSession,
// withdrawSharedRecipe, submitFeedback) on the page's stub, recording into
// window.__shr, then calls loadSharedRecipes({force:true}). The Worker's host
// is routed to a stub that answers from a queue each case fills — fulfil only:
// the handler never calls route.continue(), so nothing can leave the machine,
// and the fence proves it afterwards. FoodAI.shareRecipe (the real one) builds
// the request, so the wire format the Worker reads is asserted here too.
//
// Every expectation comes from the case's own fixture and every string through
// t(): the same assertions run in AR/dark and EN/light. The clock is real; the
// meal period it implies is computed HERE from the hour (5–10 breakfast, 11–15
// lunch, 16–18 snack, else dinner), never from the app's own function.
//
// Seen failing on the tree before the feature was built (the project's rule: a
// check is trusted only after it has been seen to fail), and planted defects
// named by their case: drop the period filter (2, 3), swap the fit term (3),
// log `servings: n` (7), spread the server's items into the draft (8), print
// the name unescaped (14).
//
// Standalone: it runs itself behind the require.main guard and is required by
// no other suite. QA_ONLY=<words> re-runs the cases whose name contains them.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const WORKER_HOST = 'vault-calories.moathdarweesh2000.workers.dev';
const PERIODS = ['breakfast', 'lunch', 'snack', 'dinner'];
const XSS = '<img src=x onerror="window.__xss=1">';

// ── the page kit ────────────────────────────────────────────────────────────
async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
    colorScheme: theme,
    timezoneId: 'Asia/Riyadh',
    locale: lang === 'ar' ? 'ar-SA' : 'en-US',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The fence aborts fonts and the live hosts, and the stub answers 4xx on
  // purpose; Chrome logs each as a resource error.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  // THE WORKER STUB — registered after the fence, so it wins for this host.
  const worker = { queue: [], calls: [] };
  await page.route((url) => url.hostname === WORKER_HOST, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = null;
    try { body = req.postDataJSON(); } catch (_) { body = null; }
    worker.calls.push(body);
    const next = worker.queue.shift() || { status: 500, body: { error: 'upstream' } };
    if (next.delay) await new Promise((r) => setTimeout(r, next.delay));
    return route.fulfill({ status: next.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(next.body) });
  });
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && typeof DB !== 'undefined' && typeof FoodAI !== 'undefined');
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked();
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    DB.nutrition.setTargets({ calories: 2000, protein: 120, carbs: 220, fat: 60 });
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = (view, ctx) => ev(({ view, ctx }) => {
    try { closeModal(); } catch (_) {}
    const r = document.getElementById('modal-root'); if (r) r.innerHTML = '';
    hideToast();
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx || {});
  }, { view, ctx });
  const fresh = () => { worker.queue.length = 0; worker.calls.length = 0; };
  return { ctx, page, ev, reset, errors, guard, lang, theme, worker, fresh };
}

// ── the fixture ─────────────────────────────────────────────────────────────
// A community row as the list query returns it (no items: they are fetched on
// a tap). `ageMin` makes created_at, newest first by index.
const row = (id, name, meals, kcal, protein, carbs, fat, servings, ageMin) => ({
  id, lang: /[؀-ۿ]/.test(name) ? 'ar' : 'en', name, servings, meals, kcal, protein, carbs, fat,
  created_at: new Date(Date.now() - ageMin * 60000).toISOString(),
});
// Six rows: four for the clock's period P (one also O), two for O only.
// Protein per kcal: -3 .120, -1 .100, -2 .070, -4 .040 · -6 .050, -5 .010.
function sixRows(px, P, O) {
  return [
    row(px + '-1', 'Grilled chicken bowl', [P], 500, 50, 40, 12, 2, 10),
    row(px + '-2', 'شوربة عدس', [P, O], 300, 21, 45, 5, 4, 20),
    row(px + '-3', 'Tuna salad', [P], 250, 30, 10, 12, 4, 30),
    row(px + '-4', 'Oat porridge', [P], 350, 14, 55, 8, 1, 40),
    row(px + '-5', 'Fruit plate', [O], 200, 2, 48, 1, 1, 50),
    row(px + '-6', 'Cheese toast', [O], 320, 16, 30, 14, 1, 60),
  ];
}
// The ingredients of «Tuna salad» (4 servings): totals 1000 / 120 / 40 / 48,
// so a serving is the row's 250 / 30 / 10 / 12. The first item carries an id
// and an editor flag the server never sends — a draft built by spreading the
// server's objects would carry them into the user's blob.
const TUNA_ITEMS = [
  { name: 'Tuna', qty: '200 g', calories: 700, protein: 100, carbs: 0, fat: 20, id: 'srv-item-1', _auto: 'done' },
  { name: 'Olive oil', qty: '2 tbsp', calories: 240, protein: 0, carbs: 0, fat: 27 },
  { name: 'خبز', qty: '٤ شرائح', calories: 60, protein: 20, carbs: 40, fat: 1 },
];
// The ranking the card promises: what fits the calories left first (when a
// target exists), then protein per kcal, then the newer.
const rankIds = (rows, period, calLeft) => rows.filter((r) => r.meals.includes(period))
  .map((r) => ({ id: r.id, fit: calLeft == null ? 0 : (r.kcal <= Math.max(0, calLeft) ? 1 : 0), d: r.kcal > 0 ? r.protein / r.kcal : 0, at: r.created_at }))
  .sort((a, b) => (b.fit - a.fit) || (b.d - a.d) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map((r) => r.id);

// ── in-page helpers ─────────────────────────────────────────────────────────
// The five Cloud methods, as each case wants them, recording into __shr.
async function stubCloud(page, cfg) {
  await page.evaluate((cfg) => {
    const q = window.__shr = { pulls: 0, items: [], withdraw: [], feedback: [], release: null };
    const copy = (x) => JSON.parse(JSON.stringify(x));
    if (cfg.pull === 'missing') delete Cloud.pullSharedRecipes;
    else if (cfg.pull === 'deferred') Cloud.pullSharedRecipes = () => { q.pulls++; return new Promise((res) => { q.release = res; }); };
    else Cloud.pullSharedRecipes = async () => { q.pulls++; return cfg.rows == null ? null : copy(cfg.rows); };
    Cloud.getSharedRecipeItems = async (id) => {
      q.items.push(id);
      if (cfg.itemsDelay) await new Promise((r) => setTimeout(r, cfg.itemsDelay));
      const it = (cfg.items || {})[id];
      return it ? copy(it) : null;
    };
    Cloud.getSession = async () => (cfg.signedIn === false ? null : { access_token: 'qa-token', user: { id: 'qa-user' } });
    Cloud.withdrawSharedRecipe = async (id) => { q.withdraw.push(id); return copy(cfg.withdraw || { ok: true }); };
    Cloud.submitFeedback = async (m, c) => { q.feedback.push([m, c]); return copy(cfg.feedback || { ok: true }); };
  }, cfg);
}
const load = (page) => page.evaluate(() => loadSharedRecipes({ force: true }));
// The clock's meal period, by the spec — not by the app's function.
const clockPeriod = (page) => page.evaluate(() => {
  const h = new Date().getHours();
  return h >= 5 && h <= 10 ? 'breakfast' : h >= 11 && h <= 15 ? 'lunch' : h >= 16 && h <= 18 ? 'snack' : 'dinner';
});
const periods = async (page) => {
  const P = await clockPeriod(page);
  return { P, O: PERIODS[(PERIODS.indexOf(P) + 1) % 4], PICK: P === 'lunch' ? 'dinner' : 'lunch' };
};

function readCard() {
  const c = document.querySelector('.view.active #shr-card');
  if (!c) return null;
  const water = document.querySelector('.view.active .water-card');
  return {
    cls: c.className,
    title: ((c.querySelector('h2.shr-title') || {}).textContent || '').trim(),
    periods: [...c.querySelectorAll('.shr-periods .shr-period')].map((b) => ({ p: b.dataset.shrPeriod, text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') })),
    pressed: [...c.querySelectorAll('.shr-period[aria-pressed="true"]')].map((b) => b.dataset.shrPeriod),
    rows: [...c.querySelectorAll('.shr-rows .shr-row')].map((b) => b.dataset.shrOpen),
    titles: [...c.querySelectorAll('.shr-rows .shr-row .fig-row-title')].map((x) => x.textContent),
    subs: [...c.querySelectorAll('.shr-rows .shr-row .fig-row-sub')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
    figs: [...c.querySelectorAll('.shr-rows .shr-row .fig-row-num')].map((x) => x.textContent.trim()),
    more: ((c.querySelector('[data-shr-more]') || {}).textContent || '').trim() || null,
    empty: [...c.querySelectorAll('.shr-empty')].map((x) => x.textContent.trim()),
    inHero: !!c.closest('.nutri-hero'),
    afterWater: !!water && !!(water.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING),
    text: c.textContent,
  };
}
function readSheet() {
  const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
  if (!m) return null;
  const h = m.querySelector('h2.modal-title, .modal-title');
  const btn = (sel) => { const b = m.querySelector(sel); return b ? { text: b.textContent.trim(), disabled: b.disabled } : null; };
  return {
    title: h ? h.textContent : null, titleTag: h ? h.tagName : null, titleDir: h ? h.getAttribute('dir') : null,
    sub: ((m.querySelector('.modal-subtitle') || {}).textContent || '').trim(),
    figs: ((m.querySelector('.shr-figs') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    list: ((m.querySelector('.cx-list.rec-view') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    names: [...m.querySelectorAll('.rec-view .cx-row > span:first-child')].map((x) => x.textContent),
    qty: [...m.querySelectorAll('.rec-view [data-qty]')].map((x) => x.textContent.trim()),
    serv: (m.querySelector('#shr-servings') || {}).value,
    log: btn('#shr-log'), save: btn('#shr-save'), report: btn('#shr-report'),
    rows: [...m.querySelectorAll('.shr-rows .shr-row')].map((b) => b.dataset.shrOpen),
    reasons: [...m.querySelectorAll('[data-shr-reason]')].map((b) => ({ r: b.dataset.shrReason, text: b.textContent.trim() })),
    repErr: ((m.querySelector('#shr-rep-err') || {}).textContent || '').trim(),
    terms: [...m.querySelectorAll('.cx-list.shr-terms > p')].map((p) => p.textContent.trim()),
    send: btn('#shr-send'),
    shareErr: ((m.querySelector('#shr-share-err') || {}).textContent || '').trim(),
    verdict: ((m.querySelector('.shr-verdict') || {}).textContent || '').trim(),
    reason: ((m.querySelector('.shr-reason') || {}).textContent || '').trim(),
    ok: btn('#shr-ok'),
    share: btn('[data-share-view]'), edit: btn('[data-edit-view]'),
    text: m.textContent,
  };
}
const toastText = () => {
  const el = document.getElementById('toast');
  return el && el.classList.contains('show') ? ((el.querySelector('.toast-msg') || el).textContent || '').trim() : '';
};
const rowsToday = () => DB.foodLogs.listForDate(todayISO()).map((r) => ({ name: r.name, servings: r.servings, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, source: r.source }));
function wipe() {
  for (const d of Object.keys(STATE.foodLogs)) DB.foodLogs.listForDate(d).slice().forEach((r) => DB.foodLogs.remove(d, r.id));
  DB.recipes.list().forEach((r) => DB.recipes.remove(r.id));
  DB.nutrition.setTargets({ calories: 2000, protein: 120, carbs: 220, fat: 60 });
}
const sheetUp = (page, sel) => page.waitForFunction((s) => !!document.querySelector('#modal-root .modal-overlay:not(.is-out) ' + s), sel, { timeout: 4000 });
const sheetGone = (page) => page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'), null, { timeout: 3000 });
const cardRow = (id) => `.view.active #shr-card [data-shr-open="${id}"]`;
// Open a community row's sheet from the card and wait for its ingredients.
async function openRowSheet(page, id, { items = true } = {}) {
  await page.locator(cardRow(id)).click();
  await sheetUp(page, '#shr-log');
  if (items) await page.waitForFunction(() => document.querySelectorAll('#modal-root .modal-overlay:not(.is-out) .rec-view .cx-row [data-qty], #modal-root .modal-overlay:not(.is-out) .rec-view .cx-row > span:first-child').length > 1, null, { timeout: 4000 });
}
// A recipe of the user's own, through DB.*.
const ownRecipe = (page, data) => page.evaluate((d) => DB.recipes.add(d), data);
const BOWL = { name: 'QA shared bowl', servings: 2, items: [
  { name: 'Rice', qty: '200 g', calories: 260, protein: 5, carbs: 56, fat: 1 },
  { name: 'Chicken', qty: '150 g', calories: 248, protein: 46, carbs: 0, fat: 5 }] };
async function openOwnView(page, id) {
  await page.evaluate((id) => openRecipeView(todayISO(), DB.recipes.list().find((r) => r.id === id), () => {}), id);
  await sheetUp(page, '[data-edit-view]');
}

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  ['(1) the card: absent on a null answer, a missing method and before the answer; then up to three rows for the clock\'s period with only it pressed; a water tap keeps it and pulls nothing', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: [] });
    await load(page);
    await reset('food');
    assert.equal(await ev(readCard), null, 'no community recipe → no card at all');
    await stubCloud(page, { rows: null });
    await load(page);
    await reset('food');
    assert.equal(await ev(readCard), null, 'a null answer (no session, an error) → no card');
    await stubCloud(page, { pull: 'missing' });
    assert.equal(await load(page), false, 'a Cloud without pullSharedRecipes (an old cloud.js) answers false and throws nothing');
    await reset('food');
    assert.equal(await ev(readCard), null, 'a missing method → no card');
    // Before the answer: the Food tab paints without the card, and the card
    // arrives by itself when the pull resolves — the render's own wiring.
    const rows = sixRows('qa-c1', P, O);
    await stubCloud(page, { pull: 'deferred' });
    await ev(() => { window.__shrLoading = loadSharedRecipes({ force: true }); });
    await reset('food');
    assert.equal(await ev(readCard), null, 'the pull has not answered → no card yet');
    await ev((rows) => window.__shr.release(rows), rows);
    await page.waitForFunction(() => !!document.querySelector('.view.active #shr-card'), null, { timeout: 3000 });
    const c = await ev(readCard);
    const want = await ev((P) => ({ title: t('shr_title'), labels: ['breakfast', 'lunch', 'snack', 'dinner'].map((p) => t('shr_meal_' + p)), more: t('show_more') }), P);
    assert.ok(/\bcard\b/.test(c.cls) && /\bshr-card\b/.test(c.cls), 'it is a .card.shr-card: ' + c.cls);
    assert.equal(c.title, want.title, 'its heading is «' + want.title + '»');
    assert.deepEqual(c.periods.map((x) => x.p), PERIODS, 'four period buttons in day order');
    assert.deepEqual(c.periods.map((x) => x.text), want.labels, 'each named in the reader\'s language');
    assert.deepEqual(c.pressed, [P], 'only the clock\'s period is pressed: ' + JSON.stringify(c.periods));
    assert.ok(c.periods.every((x) => x.pressed === 'true' || x.pressed === 'false'), 'every period button carries aria-pressed');
    assert.deepEqual(c.rows, rankIds(rows, P, 2000).slice(0, 3), 'the first three of the period\'s ranking');
    assert.equal(c.more, want.more, 'a fourth row in the period → «' + want.more + '»');
    assert.equal(c.inHero, false, 'the card is not inside .nutri-hero (whose catch-all opens the log)');
    assert.equal(c.afterWater, true, 'it follows the water card');
    assert.ok(!/[{}]/.test(c.text), 'no unfilled placeholder: ' + c.text.trim());
    await page.locator('.view.active [data-add-water="250"]').click();
    const after = await ev(readCard);
    assert.ok(after && after.rows.length === 3, 'the water tap repaints the dashboard and the card is still there');
    assert.equal(await ev(() => window.__shr.pulls), 1, 'and nothing was pulled again: the dashboard repaint reads memory');
  }],

  ['(2) a period button: Lunch pressed alone shows lunch rows only, keeps focus, opens nothing; still pressed after a log', async ({ page, ev, reset }) => {
    const { P, O, PICK } = await periods(page);
    const rows = sixRows('qa-c2', P, O).concat([row('qa-c2-pick', 'Pick of the period', [PICK], 400, 30, 40, 10, 1, 5)]);
    await stubCloud(page, { rows, items: { 'qa-c2-pick': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    assert.ok(await ev(readCard), 'setup: the card is up');
    await page.locator(`.view.active #shr-card [data-shr-period="${PICK}"]`).click();
    const c = await ev(readCard);
    assert.deepEqual(c.pressed, [PICK], `«${PICK}» is the one pressed button`);
    assert.deepEqual(c.rows, rankIds(rows, PICK, 2000).slice(0, 3), `only ${PICK} rows, in rank order: ${JSON.stringify(c.rows)}`);
    assert.equal(await ev(() => document.activeElement && document.activeElement.dataset.shrPeriod), PICK, 'focus stays on the button pressed (the card was repainted under it)');
    assert.equal(await ev(() => currentView), 'food', 'a period button opens nothing');
    assert.equal(await ev(() => !!document.querySelector('#modal-root .modal-overlay:not(.is-out)')), false, 'and raises no sheet');
    await openRowSheet(page, 'qa-c2-pick', { items: false });
    await page.locator('#shr-log').click();
    await sheetGone(page);
    assert.deepEqual((await ev(readCard)).pressed, [PICK], 'the pick holds through a log and the repaint after it');
    await page.locator(`.view.active #shr-card [data-shr-period="${P}"]`).click();
    assert.deepEqual((await ev(readCard)).pressed, [P], 'and the clock\'s period can be pressed back');
  }],

  ['(3) the ranking: with 500 kcal left the fitting recipes lead (E, D, C); without a target protein per kcal decides (C, E, D)', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const rows = [
      row('qa-c3-c', 'Dish C', [P], 650, 70, 50, 20, 1, 30),
      row('qa-c3-d', 'Dish D', [P], 300, 15, 40, 8, 1, 20),
      row('qa-c3-e', 'Dish E', [P], 420, 45, 30, 10, 1, 10),
      row('qa-c3-f', 'Dish F', [O], 100, 50, 0, 1, 1, 5),     // another period: never ranked here
    ];
    await stubCloud(page, { rows });
    await load(page);
    await ev(() => DB.foodLogs.addMany(todayISO(), [{ name: 'QA eaten', servings: 1, calories: 1500, protein: 50, carbs: 150, fat: 50 }]));
    await reset('food');
    const c = await ev(readCard);
    assert.ok(c, 'setup: the card is up');
    assert.deepEqual(c.titles, ['Dish E', 'Dish D', 'Dish C'], 'what fits 500 kcal first, by protein per kcal; then the rest: ' + JSON.stringify(c.titles));
    assert.equal(c.more, null, 'three rows, no «show more»');
    await ev(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
    await reset('food');
    // The Food tab opens the calculator by itself when no target is set.
    await page.waitForTimeout(400);
    await ev(() => { try { closeModal(); } catch (_) {} });
    const n = await ev(readCard);
    assert.ok(n, 'the card is there without a target too (under the setup button)');
    assert.equal(await ev(() => !!document.querySelector('.view.active .nutri-setup')), true, 'setup: no target, so the setup button is up');
    assert.deepEqual(n.titles, ['Dish C', 'Dish E', 'Dish D'], 'no target → protein per kcal alone: ' + JSON.stringify(n.titles));
  }],

  ['(4) a period with nothing in it: one empty line, the period row still there', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const empty = PERIODS.find((p) => p !== P && p !== O);
    await stubCloud(page, { rows: sixRows('qa-c4', P, O) });
    await load(page);
    await reset('food');
    await page.locator(`.view.active #shr-card [data-shr-period="${empty}"]`).click();
    const c = await ev(readCard);
    const want = await ev(() => t('shr_none'));
    assert.deepEqual(c.empty, [want], 'one «' + want + '» line');
    assert.equal(c.rows.length, 0, 'no rows');
    assert.equal(c.periods.length, 4, 'the four period buttons stay');
    assert.deepEqual(c.pressed, [empty], 'with the empty period pressed');
    assert.equal(c.more, null, 'and no «show more»');
    await page.locator(`.view.active #shr-card [data-shr-period="${P}"]`).click();
  }],

  ['(5) «show more» lists every recipe of the period in rank order, and a row there opens its sheet', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const rows = sixRows('qa-c5', P, O);
    await stubCloud(page, { rows, items: { 'qa-c5-4': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    await page.locator('.view.active #shr-card [data-shr-more]').click();
    await sheetUp(page, '.shr-rows .shr-row');
    const s = await ev(readSheet);
    const want = await ev((P) => ({ title: t('shr_title'), sub: t('shr_meal_' + P) }), P);
    assert.equal(s.title, want.title, 'the sheet is titled «' + want.title + '»');
    assert.equal(s.sub, want.sub, 'and names the period');
    assert.deepEqual(s.rows, rankIds(rows, P, 2000), 'all four, in rank order');
    await page.locator('#modal-root [data-shr-open="qa-c5-4"]').click();
    await sheetUp(page, '#shr-log');
    assert.equal((await ev(readSheet)).title, 'Oat porridge', 'the row opens that recipe');
  }],

  ['(6) a tap opens the recipe: its name, one serving\'s figures, the ingredients fetched on the tap, and a stepper that scales 4 → 2', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c6', P, O), items: { 'qa-c6-3': TUNA_ITEMS }, itemsDelay: 400 });
    await load(page);
    await reset('food');
    await page.locator(cardRow('qa-c6-3')).click();
    await sheetUp(page, '#shr-log');
    const before = await ev(readSheet);
    const want = await ev(() => ({ per: t('rec_per'), cal: t('cal'), loading: t('cx_loading'), p: t('protein_label'), c: t('carbs_label'), f: t('fat_label'),
      log: t('shr_log'), save: t('shr_save'), report: t('shr_report'), n: [250, 30, 10, 12].map(fmtNum) }));
    assert.equal(before.title, 'Tuna salad', 'the sheet\'s heading is the recipe\'s name');
    assert.equal(before.titleTag, 'H2', 'a real heading');
    assert.equal(before.titleDir, 'auto', 'a user\'s name takes its own direction');
    for (const part of [want.per, want.cal, want.p, want.c, want.f, ...want.n]) assert.ok(before.figs.includes(part), `the figures line carries «${part}»: «${before.figs}»`);
    assert.equal(before.list, want.loading, 'one line while the ingredients are on their way');
    assert.deepEqual([before.log && before.log.text, before.save && before.save.text, before.report && before.report.text], [want.log, want.save, want.report], 'log, save and report');
    assert.equal(before.save.disabled, true, 'nothing to save before the ingredients arrive');
    assert.deepEqual(await ev(() => window.__shr.items), ['qa-c6-3'], 'the ingredients are asked for once, by the row\'s id');
    await page.waitForFunction(() => document.querySelectorAll('#modal-root .rec-view [data-qty]').length === 3, null, { timeout: 4000 });
    const s = await ev(readSheet);
    assert.deepEqual(s.names, ['Tuna', 'Olive oil', 'خبز'], 'the ingredients by name');
    assert.deepEqual(s.qty, ['200 g', '2 tbsp', '٤ شرائح'], 'their amounts as written');
    assert.equal(s.serv, '4', 'the stepper starts at the recipe\'s own servings');
    assert.equal(s.save.disabled, false, 'saving is live once they are in');
    for (const part of want.n) assert.ok(s.figs.includes(part), `the figures re-derived from the ingredients agree: «${s.figs}»`);
    await page.locator('#modal-root .rt-step [data-step="-1"]').click();
    await page.locator('#modal-root .rt-step [data-step="-1"]').click();
    const half = await ev(readSheet);
    assert.equal(half.serv, '2', 'two steps down');
    assert.deepEqual(half.qty, ['100 g', '1 tbsp', '2 شرائح'], 'every leading number halves, nothing else moves');
  }],

  ['(7) «Log a serving» writes ONE row of one serving with the per-serving figures, closes, repaints the hero, and Undo takes it back', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c7', P, O), items: { 'qa-c7-3': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    await openRowSheet(page, 'qa-c7-3');
    await page.locator('#modal-root .rt-step [data-step="-1"]').click();   // the stepper scales amounts, never the log
    await page.locator('#shr-log').click();
    await sheetGone(page);
    assert.deepEqual(await ev(rowsToday), [{ name: 'Tuna salad', servings: 1, calories: 250, protein: 30, carbs: 10, fat: 12, source: 'shared' }], 'one row, one serving, the serving\'s figures, source «shared»');
    assert.equal(await ev(() => ((document.querySelector('.view.active .cal-ring-sub .num') || {}).textContent || '').trim()), await ev(() => fmtNum(250)), 'the hero repainted: 250 eaten');
    const msg = await ev(toastText);
    assert.equal(msg, await ev(() => t('rec_logged').replace('{name}', 'Tuna salad')), 'the toast names the recipe');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await ev(rowsToday), [], 'Undo takes the row back');
  }],

  ['(8) «Save to my recipes» makes a copy with its own item ids and nothing of the server\'s; the button says it is in the recipes, and still does on reopening', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c8', P, O), items: { 'qa-c8-3': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    await openRowSheet(page, 'qa-c8-3');
    await page.locator('#shr-save').click();
    await page.waitForTimeout(100);
    const recs = await ev(() => DB.recipes.list());
    assert.equal(recs.length, 1, 'one recipe saved');
    const r = recs[0];
    assert.equal(r.name, 'Tuna salad');
    assert.equal(r.servings, 4, 'its servings');
    assert.deepEqual(r.items.map((it) => [it.name, it.qty, it.calories, it.protein, it.carbs, it.fat]), TUNA_ITEMS.map((it) => [it.name, it.qty, it.calories, it.protein, it.carbs, it.fat]), 'the ingredients exactly');
    assert.ok(r.items.every((it) => typeof it.id === 'string' && it.id && it.id !== 'srv-item-1'), 'every item has a NEW id: ' + JSON.stringify(r.items.map((it) => it.id)));
    const keys = [...Object.keys(r), ...r.items.flatMap((it) => Object.keys(it))];
    assert.ok(!keys.some((k) => k.startsWith('_')), 'no editor flag reaches the blob: ' + JSON.stringify(keys));
    assert.ok(!('shared' in r), 'a copy is not a shared recipe');
    const s = await ev(readSheet);
    assert.ok(s, 'the sheet stays open');
    assert.deepEqual(s.save, { text: await ev(() => t('shr_in_recipes')), disabled: true }, 'the button says «in your recipes» and is spent');
    assert.equal(await ev(toastText), await ev(() => t('shr_saved')), 'the toast says it was saved');
    await ev(() => closeModal());
    await sheetGone(page);
    await openRowSheet(page, 'qa-c8-3');
    assert.deepEqual((await ev(readSheet)).save, { text: await ev(() => t('shr_in_recipes')), disabled: true }, 'reopened, it is still in the recipes');
  }],

  ['(9) report: one feedback row «recipe-report:<id>», a thank-you, and the row leaves the card; signed out it asks for a sign-in and sends nothing', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c9', P, O), items: { 'qa-c9-3': TUNA_ITEMS, 'qa-c9-1': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    await openRowSheet(page, 'qa-c9-3', { items: false });
    await page.locator('#shr-report').click();
    await sheetUp(page, '[data-shr-reason]');
    const s = await ev(readSheet);
    const want = await ev(() => ({ title: t('shr_report_title'), reasons: [['not_food', t('shr_reason_not_food')], ['offensive', t('shr_reason_offensive')], ['wrong_figures', t('shr_reason_wrong')]], thanks: t('shr_reported'), signin: t('shr_signin'), many: t('feedback_too_many') }));
    assert.equal(s.title, want.title, 'the report sheet asks what is wrong');
    assert.equal(s.sub, 'Tuna salad', 'and names the recipe');
    assert.deepEqual(s.reasons.map((x) => [x.r, x.text]), want.reasons, 'three reasons');
    await page.locator('#modal-root [data-shr-reason="not_food"]').click();
    await sheetGone(page);
    assert.deepEqual(await ev(() => window.__shr.feedback), [['not_food', 'recipe-report:qa-c9-3']], 'one feedback row, its context naming the recipe');
    assert.equal(await ev(toastText), want.thanks, 'a thank-you');
    const c = await ev(readCard);
    assert.ok(!c.rows.includes('qa-c9-3'), 'the reported recipe leaves the card: ' + JSON.stringify(c.rows));
    // Signed out: the sheet says so, and nothing is sent.
    await stubCloud(page, { rows: sixRows('qa-c9', P, O), items: { 'qa-c9-1': TUNA_ITEMS }, signedIn: false });
    await openRowSheet(page, 'qa-c9-1', { items: false });
    await page.locator('#shr-report').click();
    await sheetUp(page, '[data-shr-reason]');
    await page.locator('#modal-root [data-shr-reason="offensive"]').click();
    await page.waitForTimeout(150);
    assert.equal((await ev(readSheet)).repErr, want.signin, 'signed out → «' + want.signin + '»');
    assert.deepEqual(await ev(() => window.__shr.feedback), [], 'and no feedback was sent');
    // The hourly feedback cap has its own sentence.
    await stubCloud(page, { rows: sixRows('qa-c9', P, O), feedback: { error: 'ratelimit' } });
    await page.locator('#modal-root [data-shr-reason="offensive"]').click();
    await page.waitForTimeout(150);
    assert.equal((await ev(readSheet)).repErr, want.many, 'the hourly cap → «' + want.many + '»');
  }],

  ['(10) share: the four terms, a request in the Worker\'s protocol, the marker {id, at}, «Stop sharing» on the view and «shared» in the picker; a corrected name is announced', async ({ page, ev, reset, worker, fresh }) => {
    await reset('food');
    const rec = await ownRecipe(page, BOWL);
    await stubCloud(page, { rows: [] });
    await openOwnView(page, rec.id);
    const want = await ev(() => ({ share: t('shr_share'), unshare: t('shr_unshare'), title: t('shr_share_title'), send: t('shr_send'), sending: t('shr_sending'),
      terms: [t('shr_term_review'), t('shr_term_anon'), t('shr_term_withdraw'), t('shr_term_copy')], published: t('shr_published'), tag: t('shr_tag_shared'), note: t('shr_del_note') }));
    const v = await ev(readSheet);
    assert.deepEqual(v.share, { text: want.share, disabled: false }, 'the view offers «' + want.share + '»');
    assert.ok(v.edit, 'beside «edit»');
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    const s = await ev(readSheet);
    assert.equal(s.title, want.title, 'the share sheet\'s title');
    assert.equal(s.sub, BOWL.name, 'it names the recipe');
    assert.deepEqual(s.terms, want.terms, 'the four terms, in order');
    assert.deepEqual(s.send, { text: want.send, disabled: false }, '«' + want.send + '»');
    fresh();
    worker.queue.push({ status: 200, delay: 400, body: { verdict: 'approve', id: 'pub-1', name: BOWL.name } });
    await page.locator('#shr-send').click();
    await page.waitForTimeout(120);
    assert.deepEqual((await ev(readSheet)).send, { text: want.sending, disabled: true }, 'while it is reviewed the button says so and is off');
    await page.waitForFunction((u) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === u; }, want.unshare, { timeout: 5000 });
    assert.equal(worker.calls.length, 1, 'one request');
    const b = worker.calls[0];
    assert.deepEqual(Object.keys(b).sort(), ['lang', 'mode', 'shareRecipe'], 'the body is {mode, lang, shareRecipe}: ' + JSON.stringify(b));
    assert.equal(b.mode, 'share-recipe');
    assert.ok(['ar', 'en'].includes(b.lang), 'a language: ' + b.lang);
    assert.deepEqual(Object.keys(b.shareRecipe).sort(), ['items', 'name', 'servings', 'sourceId'], 'the recipe carries exactly these: ' + JSON.stringify(Object.keys(b.shareRecipe)));
    assert.equal(b.shareRecipe.sourceId, rec.id, 'sourceId is the recipe\'s id');
    assert.equal(b.shareRecipe.name, BOWL.name);
    assert.equal(b.shareRecipe.servings, 2);
    assert.ok(b.shareRecipe.items.every((it) => JSON.stringify(Object.keys(it).sort()) === JSON.stringify(['calories', 'carbs', 'fat', 'name', 'protein', 'qty'])), 'every item has exactly six keys: ' + JSON.stringify(b.shareRecipe.items));
    assert.deepEqual(b.shareRecipe.items.map((it) => [it.name, it.qty, it.calories]), BOWL.items.map((it) => [it.name, it.qty, it.calories]), 'the items as stored');
    const mark = await ev((id) => DB.recipes.list().find((r) => r.id === id).shared, rec.id);
    assert.ok(mark && mark.id === 'pub-1' && typeof mark.at === 'string' && !Number.isNaN(Date.parse(mark.at)), 'the recipe carries shared = {id, at}: ' + JSON.stringify(mark));
    assert.deepEqual(Object.keys(mark).sort(), ['at', 'id'], 'and nothing else');
    assert.equal(await ev(toastText), want.published, '«' + want.published + '»');
    // The picker tags it, and deleting it says the published copy stays.
    await ev(() => { closeModal(); openSavedFoodPicker(todayISO(), () => {}, 'recipes'); });
    await sheetUp(page, `[data-view-rec="${rec.id}"]`);
    const meta = await ev((id) => document.querySelector(`#modal-root [data-view-rec="${id}"] .bundle-meta`).textContent, rec.id);
    assert.ok(meta.includes(want.tag), 'the picker\'s meta says «' + want.tag + '»: ' + meta.trim());
    await page.locator(`#modal-root [data-del-rec="${rec.id}"]`).click();
    await page.waitForFunction(() => !!document.querySelector('#modal-root .confirm-dialog'), null, { timeout: 3000 });
    assert.ok((await ev(() => document.querySelector('#modal-root .confirm-dialog').textContent)).includes(want.note), 'the delete question says the copy stays shared');
    await ev(() => closeModal());
    // A name the moderator corrected is announced.
    const typo = await ownRecipe(page, { ...BOWL, name: 'QA spelled wrogn' });
    await openOwnView(page, typo.id);
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    fresh();
    worker.queue.push({ status: 200, body: { verdict: 'approve', id: 'pub-2', name: 'QA spelled wrong' } });
    await page.locator('#shr-send').click();
    await page.waitForFunction(() => !!document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-edit-view]'), null, { timeout: 5000 });
    assert.equal(await ev(toastText), await ev(() => t('shr_published_as').replace('{name}', 'QA spelled wrong')), 'the toast gives the published name');
  }],

  ['(11) a rejection: the translated reason, «OK» back to the view, and no marker; a refusal reads the same way', async ({ page, ev, reset, worker, fresh }) => {
    await reset('food');
    const rec = await ownRecipe(page, BOWL);
    await stubCloud(page, { rows: [] });
    const want = await ev(() => ({ rejected: t('shr_rejected'), pd: t('shr_rej_personal_data'), daily: t('shr_rej_daily_limit'), ok: t('shr_ok'), share: t('shr_share') }));
    for (const [body, reason] of [[{ verdict: 'reject', reason: 'personal_data' }, want.pd], [{ verdict: 'refused', reason: 'daily_limit' }, want.daily]]) {
      await openOwnView(page, rec.id);
      await page.locator('#modal-root [data-share-view]').click();
      await sheetUp(page, '#shr-send');
      fresh();
      worker.queue.push({ status: 200, body });
      await page.locator('#shr-send').click();
      await sheetUp(page, '.shr-verdict');
      const s = await ev(readSheet);
      assert.equal(s.verdict, want.rejected, 'the verdict line');
      assert.equal(s.reason, reason, 'the reason, translated: ' + JSON.stringify(body));
      assert.deepEqual(s.ok, { text: want.ok, disabled: false }, '«' + want.ok + '»');
      await page.locator('#shr-ok').click();
      await sheetUp(page, '[data-share-view]');
      assert.equal((await ev(readSheet)).share.text, want.share, '«OK» returns to the recipe, still offering to share');
      assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'no marker');
    }
  }],

  ['(12) the failures: a 429 says the daily limit and the button is live again; an old Worker says «not available yet»; signed out and non-whole servings send nothing', async ({ page, ev, reset, worker, fresh }) => {
    await reset('food');
    const rec = await ownRecipe(page, BOWL);
    const want = await ev(() => ({ daily: t('ai_daily_limit'), old: t('shr_unavailable'), signin: t('shr_signin'), whole: t('shr_whole_servings'), send: t('shr_send') }));
    const attempt = async (id, answer, cfg) => {
      await stubCloud(page, { rows: [], ...(cfg || {}) });
      await openOwnView(page, id);
      await page.locator('#modal-root [data-share-view]').click();
      await sheetUp(page, '#shr-send');
      fresh();
      if (answer) worker.queue.push(answer);
      await page.locator('#shr-send').click();
      await page.waitForFunction(() => { const e = document.querySelector('#modal-root #shr-share-err'); return !!e && !!e.textContent.trim(); }, null, { timeout: 5000 });
      return ev(readSheet);
    };
    let s = await attempt(rec.id, { status: 429, body: { error: 'daily limit', code: 'DAILY_LIMIT' } });
    assert.equal(s.shareErr, want.daily, 'a 429 with the daily code → the daily-limit sentence');
    assert.deepEqual(s.send, { text: want.send, disabled: false }, 'and the button is live again');
    s = await attempt(rec.id, { status: 400, body: { error: 'no input' } });
    assert.equal(s.shareErr, want.old, 'a Worker without the mode (400 no input) → «' + want.old + '»');
    s = await attempt(rec.id, null, { signedIn: false });
    assert.equal(s.shareErr, want.signin, 'signed out → «' + want.signin + '»');
    assert.equal(worker.calls.length, 0, 'and no request');
    const half = await ownRecipe(page, { ...BOWL, name: 'QA half servings', servings: 2.5 });
    s = await attempt(half.id, null);
    assert.equal(s.shareErr, want.whole, '2.5 servings → «' + want.whole + '»');
    assert.equal(worker.calls.length, 0, 'and no request');
  }],

  ['(13) stop sharing: the withdraw call names the published id and the marker goes; a failure keeps it and says so', async ({ page, ev, reset }) => {
    await reset('food');
    const rec = await ownRecipe(page, BOWL);
    const set = await ev((id) => DB.recipes.setShared(id, { id: 'pub-9', at: new Date().toISOString() }), rec.id);
    assert.ok(set && set.ok !== false, 'setup: the marker is written: ' + JSON.stringify(set));
    const want = await ev(() => ({ share: t('shr_share'), unshare: t('shr_unshare'), done: t('shr_withdrawn'), failed: t('shr_withdraw_failed') }));
    await stubCloud(page, { rows: [], withdraw: { ok: false, error: 'x' } });
    await openOwnView(page, rec.id);
    assert.equal((await ev(readSheet)).share.text, want.unshare, 'a shared recipe\'s view offers «' + want.unshare + '»');
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForTimeout(200);
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-9'], 'one withdraw call, by the published id');
    assert.equal(await ev((id) => (DB.recipes.list().find((r) => r.id === id).shared || {}).id, rec.id), 'pub-9', 'a failure keeps the marker');
    assert.equal(await ev(toastText), want.failed, '«' + want.failed + '»');
    assert.deepEqual((await ev(readSheet)).share, { text: want.unshare, disabled: false }, 'and the button is live again');
    await stubCloud(page, { rows: [], withdraw: { ok: true } });
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, want.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-9'], 'withdrawn by the published id');
    assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'the marker is gone');
    assert.equal(await ev(toastText), want.done, '«' + want.done + '»');
    // {ok:false} with NO error: the database found nothing of ours by that id —
    // already gone (a lost reply after an earlier withdraw, or the owner's own
    // removal). It reads as withdrawn, and the marker goes too.
    await ev((id) => DB.recipes.setShared(id, { id: 'pub-10', at: new Date().toISOString() }), rec.id);
    await stubCloud(page, { rows: [], withdraw: { ok: false } });
    await openOwnView(page, rec.id);
    assert.equal((await ev(readSheet)).share.text, want.unshare, 'setup: shared again');
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, want.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-10'], 'asked once, by the new published id');
    assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'an answer of «nothing to delete» clears the marker');
    assert.equal(await ev(toastText), want.done, 'and says it is no longer shared');
  }],

  ['(14) untrusted text: a name carrying markup never becomes an element — card, sheet, ingredients, report, «show more» — and a row with an unsafe id is dropped', async ({ page, ev, reset }) => {
    const { P } = await periods(page);
    const rows = [
      row('qa-x-1', XSS, [P], 300, 40, 20, 5, 1, 5),
      row('bad id!', 'Unsafe id row', [P], 300, 60, 20, 5, 1, 1),
      row('../../x', 'Traversal row', [P], 300, 60, 20, 5, 1, 2),
      row('qa-x-2', 'Plain two', [P], 300, 30, 20, 5, 1, 10),
      row('qa-x-3', 'Plain three', [P], 300, 20, 20, 5, 1, 20),
      row('qa-x-4', 'Plain four', [P], 300, 10, 20, 5, 1, 30),
    ];
    const items = { 'qa-x-1': [{ name: '<b>bold</b>' + XSS, qty: '<i>1</i> cup', calories: 300, protein: 40, carbs: 20, fat: 5 }] };
    await stubCloud(page, { rows, items });
    await ev(() => { delete window.__xss; });
    await load(page);
    await reset('food');
    // Scoped to the card and the sheets: an exercise photo elsewhere carries a
    // legitimate onerror="this.remove()".
    const noMarkup = () => ({ img: document.querySelectorAll('#shr-card img, #modal-root img').length, onerror: document.querySelectorAll('#shr-card [onerror], #modal-root [onerror]').length,
      b: document.querySelectorAll('#shr-card b, #modal-root .rec-view b, #modal-root .rec-view i').length });
    const c = await ev(readCard);
    assert.deepEqual(c.rows, ['qa-x-1', 'qa-x-2', 'qa-x-3'], 'the two unsafe ids are gone; the rest rank as usual: ' + JSON.stringify(c.rows));
    assert.equal(c.titles[0], XSS, 'the name prints as text');
    assert.deepEqual(await ev(noMarkup), { img: 0, onerror: 0, b: 0 }, 'no element made of it on the card');
    await openRowSheet(page, 'qa-x-1', { items: false });
    await page.waitForFunction(() => document.querySelectorAll('#modal-root .rec-view [data-qty]').length === 1, null, { timeout: 4000 });
    const s = await ev(readSheet);
    assert.equal(s.title, XSS, 'the sheet\'s heading is the text');
    assert.deepEqual(s.names, ['<b>bold</b>' + XSS], 'an ingredient\'s name is text');
    assert.deepEqual(s.qty, ['<i>1</i> cup'], 'and its amount');
    assert.deepEqual(await ev(noMarkup), { img: 0, onerror: 0, b: 0 }, 'no element in the sheet');
    await page.locator('#shr-report').click();
    await sheetUp(page, '[data-shr-reason]');
    assert.equal((await ev(readSheet)).sub, XSS, 'the report sheet names it as text');
    assert.deepEqual(await ev(noMarkup), { img: 0, onerror: 0, b: 0 }, 'no element there');
    await ev(() => closeModal());
    await page.locator('.view.active #shr-card [data-shr-more]').click();
    await sheetUp(page, '.shr-rows .shr-row');
    assert.deepEqual(await ev(noMarkup), { img: 0, onerror: 0, b: 0 }, 'nor in «show more»');
    await page.waitForTimeout(300);
    assert.equal(await ev(() => typeof window.__xss), 'undefined', 'no handler ever ran');
  }],

  ['(15) layout: every period button holds its word at 375 and 320, with and without «Larger text»; the rows are door-sized and the heading glyph is 16px', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c15', P, O) });
    await load(page);
    try {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        await reset('food');
        for (const lg of [false, true]) {
          const g = await ev((lg) => {
            document.body.classList.toggle('text-lg', lg);
            const card = document.querySelector('.view.active #shr-card');
            const out = {
              spill: [...card.querySelectorAll('.shr-period')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => `${b.dataset.shrPeriod} ${b.scrollWidth}>${b.clientWidth}`),
              cardSpill: card.scrollWidth > card.clientWidth + 1,
              periodH: [...card.querySelectorAll('.shr-period')].map((b) => Math.round(b.getBoundingClientRect().height)),
              rowH: [...card.querySelectorAll('.shr-row')].map((b) => Math.round(b.getBoundingClientRect().height)),
              svg: (() => { const s = card.querySelector('.shr-title svg'); const r = s && s.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null; })(),
              radius: getComputedStyle(card.querySelector('.shr-period')).borderTopLeftRadius,
            };
            document.body.classList.remove('text-lg');
            return out;
          }, lg);
          const where = `${width}px${lg ? ' + larger text' : ''}`;
          assert.deepEqual(g.spill, [], `a period word overflows its button at ${where}: ${g.spill.join(', ')}`);
          assert.equal(g.cardSpill, false, `the card overflows at ${where}`);
          assert.ok(g.periodH.every((h) => h === 36), `period buttons on the S rung (36px) at ${where}: ${g.periodH}`);
          assert.ok(g.rowH.length && g.rowH.every((h) => h >= 44), `rows at least 44px at ${where}: ${g.rowH}`);
          assert.deepEqual(g.svg, [16, 16], `the heading glyph is 16px at ${where}`);
          assert.equal(g.radius, '10px', 'a rounded rectangle on the S radius, never a capsule');
        }
      }
    } finally {
      await page.setViewportSize({ width: 375, height: 812 });
    }
  }],

  ['(16) the user\'s own published recipe is never suggested back to them', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const rows = sixRows('qa-c16', P, O);
    await stubCloud(page, { rows });
    await load(page);
    await reset('food');
    assert.ok((await ev(readCard)).rows.includes('qa-c16-3'), 'setup: another user\'s view of it — the row is on the card');
    const rec = await ownRecipe(page, BOWL);
    const set = await ev((id) => DB.recipes.setShared(id, { id: 'qa-c16-3', at: new Date().toISOString() }), rec.id);
    assert.ok(set && set.ok !== false, 'setup: our recipe carries the published id: ' + JSON.stringify(set));
    await reset('food');
    const c = await ev(readCard);
    assert.ok(!c.rows.includes('qa-c16-3'), 'our own published copy is off the card: ' + JSON.stringify(c.rows));
    assert.deepEqual(c.rows, rankIds(rows.filter((r) => r.id !== 'qa-c16-3'), P, 2000), 'the others rank as before');
    assert.equal(c.more, null, 'three left in the period, so no «show more»');
  }],

  // Surfaced by cases 8, 10 and 13 (v419): guardConvenienceModal wrote
  // Cloud.getLastUid() into a data attribute, and a signed-out device's null
  // became the STRING "null" — so the vault:save-state listener saw an owner
  // that never matched and closed every convenience sheet on every write.
  ['(17) a signed-out device keeps its convenience sheet through a write: a cup logged from the search sheet, and the sheet is still there', async ({ page, ev, reset }) => {
    await reset('food');
    await ev(() => openUnifiedSearch());
    await sheetUp(page, '[data-ql="water"][data-ml="250"]');
    const before = await ev(() => DB.water.get(todayISO()));
    await page.locator('#modal-root [data-ql="water"][data-ml="250"]').click();
    await page.waitForTimeout(150);
    assert.equal(await ev(() => DB.water.get(todayISO())), before + 250, 'the cup was logged');
    assert.ok(await ev(() => !!document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-ql="water"]')), 'the sheet is still open after the write');
    await ev(() => closeModal());
  }],
];

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;   // QA_ONLY=<words>: re-run one case while planting a defect
        try {
          await kit.ev(wipe); kit.fresh();
          await fn({ ...kit, browser, origin }); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`);
        } catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
        // Back to the 'out' stub's signed-out session, whatever the case set.
        await kit.ev(() => { Cloud.getSession = async () => null; try { closeModal(); } catch (_) {} hideToast(); }).catch(() => {});
      }
      await kit.ev(wipe).catch(() => {});
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  shared recipes UI: ${failures.length} failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  shared recipes UI (${passed} cases, AR/dark + EN/light, 375px): the «Suggestions» card (absent on null, on a missing method and before the answer; four period buttons with only the clock's pressed; three rows ranked by what fits the calories left, then protein per kcal; an empty period's one line; «show more» in rank order; outside the hero, kept by a water tap with no second pull), a recipe's sheet (name, one serving's figures, the ingredients fetched on the tap, a 4 → 2 scaler), «Log a serving» as one serving with Undo, «Save to my recipes» as a clean copy, the report (one feedback row, the row leaves; signed out sends nothing), sharing (four terms, the Worker's protocol, the {id, at} marker, «Stop sharing», «shared» in the picker, a corrected name announced), a rejection's translated reason, the failures (daily limit, an old Worker, signed out, non-whole servings), withdrawing (the published id; a failure keeps the marker), untrusted names never markup and unsafe ids dropped, the period buttons fitting at 375/320 with and without larger text, and the user's own published recipe never suggested back`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
