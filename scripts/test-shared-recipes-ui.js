#!/usr/bin/env node
// «اقتراحات» (v419), driven in a real browser: the Food tab's suggestions card
// fed by recipes other users share — four meal periods, up to three community
// recipes for the period the clock is in, each a door to its ingredients with
// «سجّل حصّة», «احفظها في وصفاتي» and a report — and the other half, sharing
// one's own recipe from its view («شاركها» / «أزل من المشاركة»), which reports
// the moderator's verdict in one translated sentence.
//
// AUTOMATIC SHARING (v420) is the third half: every recipe a signed-in user
// saves is sent for that same review by itself (js/food.js, runAutoShare) —
// after a one-time notice with «أوقِفها», one request at a time, a gap between
// two, a ceiling per day, a pause when the server says «enough for today» —
// and the user's own published recipes are suggested on their own card.
// Cases 18–24 and 26–32 drive that engine; 25 is its row in Settings. The
// review of v420 added 28–31 (a displaced notice; «أزل من المشاركة» under a
// re-share in flight and a sync on the wire; the setting turned off during a
// review; «آخر التعديلات» after the engine published) and rows in 10, 18, 19,
// 20 and 25; the fix after it added 32 (a notice cut short by a hold or a stop
// — a delete's Undo, the setting off, offline — raised again, never stamped
// seen for a window nobody saw) and a row in 20.
//
// «اقتراحات اليوم» (v421) is the fourth: the card is there from the first day,
// titled «اقتراحات اليوم», and filled from THREE sources — the user's own
// recipes, the community's, and the READY MEALS that ship with the app
// (SUGGESTION_PRESETS in js/catalog.js, priced from the food catalogue) — the
// best row of each source first, then the rest by rank; a row says its source
// (data-shr-src) and carries a caption over its name when it is the user's or
// another user's, never when it is a ready meal; «show more» groups the period
// under three captions; an own recipe opens its recipe view; a ready meal's
// sheet carries its ingredients with their figures (no fetch), logs one serving
// as source 'builtin' and saves a copy with origin 'builtin' that automatic
// sharing never sends. Cases 1–5, 14, 16 and 18 were rewritten to that truth,
// 6 gained the figures under each ingredient, 33–35 are new. THE READY MEALS
// ARE PRICED HERE (readyMeals), from the catalogue as the fixture — never
// through js/food.js's suggestionItems — and the card's order is this file's
// own reading of the spec (rankRows, cardIds), as the community ranking always
// was (rankIds).
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
// t(): the same assertions run in AR/dark and EN/light. The meal period the
// clock implies is computed HERE from the hour (5–10 breakfast, 11–15 lunch,
// 16–18 snack, else dinner), never from the app's own function.
//
// THE CLOCK is Playwright's (page.clock), installed before the page loads at
// the real time and left RUNNING: cases 1–17, 25, 33 and 35 meet an ordinary
// clock, and 34 until it opens the engine at its end.
// The engine's waits are 1.5 s, 12 s and 4 s, so its cases STOP the clock
// (`account()`) and step it (`clock.run(ms)`): «nothing is sent inside the
// window» is then a statement about the page's own timeline, not about how
// fast this machine was. js/food.js's constants are never touched.
//
// THE ENGINE AND THE OLDER CASES. Under the 'out' stub Cloud.configured() is
// false and there is no last uid; the engine asks for both before anything
// else, so in cases 1–17, 25, 33 and 35 it is inert whatever they save — the loop
// asserts those two facts, and an idle engine, before EVERY case. Only
// `account()` opens it (a configured Cloud, a uid, a session), and the loop
// closes it again after every case. The engine's own state (the queue, its
// timer, the session flag, the device ledger) is module state in js/food.js:
// `engineReset` is the ONE place this suite touches it, between cases;
// `reboot()` is the real thing — the app opened again — where a case needs
// exactly that. The card's own memory of a period the user pressed
// (SHR_PICK) is put back in `wipe()`, before every case: a case that fails
// half-way through a pick must not hand the next one a card for another period.
//
// Seen failing on the tree before the feature was built (the project's rule: a
// check is trusted only after it has been seen to fail), and planted defects
// named by their case: drop the period filter (2, 3), swap the fit term (3),
// log `servings: n` (7), spread the server's items into the draft (8), print
// the name unescaped (14).
// v420: every assertion cases 10, 13, 16 and 18–27 gained (their `setup:`
// lines aside) was seen to fail on a defect planted IN MEMORY — js/food.js;
// js/app.js for the Settings row, js/storage.js where an edit drops a field —
// each plant caught by the assertion it was written for, in both passes (a
// plant on an English word, in the English one). Among them: a request inside
// the notice's window (18), an unchanged re-save shared again (18), a rejected
// recipe retried (21), «the daily limit» not stopping the queue (22), two
// requests in flight (23), a copy from the list shared (20), a withdrawn
// recipe shared again (20), the user's own row kept off the card (16), a
// marker written after an account change (24).
// The review's fixes (28–31 and the rows added to 10, 18, 19, 20, 25), each
// seen to fail the same way: «seen» stamped when the notice is DRAWN (18, 28),
// a displaced notice not raised again (28), the notice raised under a hidden
// page (28), «أوقِفها» not stamping seen (19), a session that is not the
// device's account sending (20), a sync on the wire not waited for (20, 29),
// the gate dropping the queue instead of holding it (29), noAuto set only
// AFTER the withdraw (29), noAuto left on after a refused withdraw (29), the
// setting turned off mid-review ignored (30), a marker replaced withdrawn (30),
// the ledger not following the marker (31, js/storage.js), an orphaned copy
// not withdrawn (31, js/app.js), the fourth term by the setting alone (10),
// the hint the same in both states (25, js/app.js).
// The fix after the review, seen to fail the same way: the hold wait read
// above the notice block (32), a stopped step keeping the notice it could no
// longer watch (32, and for the offline stop alone), «seen» stamped when the
// notice is drawn and a displaced notice counted as seen (32), the notice
// raised again left unwatched or cut short (32), a dependency that throws
// under the backfill escaping the render of Food (20).
// v421: every assertion cases 1–6, 14, 16, 18, 20 and 33–35 gained was seen
// to fail on a defect planted IN MEMORY — js/food.js; js/storage.js, js/i18n.js
// and styles.css where the defect lives there — in both passes, each caught by
// the assertion written for it (42 plants): the card hidden while the
// community list is empty (1); the ready meals never drawn (1, 4); the user's
// own row not first, by a reordered head or by rank alone (33); a ready meal's
// ingredient figures not scaled by its grams, or scaled by the grams
// themselves (34); a copy of a ready meal saved without its origin, as
// 'shared', or through a DB.recipes.add that keeps 'shared' alone (34); a
// caption on a ready meal (1, 33), none on another user's row (33); no
// data-shr-src (33); the card repeating its heads (1); v420's title (1); an own
// recipe opening the suggestion sheet (33, 5); the own published recipe in
// every period, or beside the feed's copy (16, 18); «show more» reordered, with
// a caption on every row, or without its captions (5); the ready meal fetched,
// marked busy, logged as 'shared' or under the prefixed id, reported (34); the
// scaler leaving the figures (34, 6) and a community ingredient without them
// (6); a grams amount glued to its unit and a unit counted once (34); the
// sheet's «follows your edits» and automatic sharing's «wanted» back to v420's
// 'shared' test (34); the price of an own recipe or a ready meal unfenced
// inside the render of Food (20 — the v421 regression this suite found); and
// four layout defects — the figures not wrapped under the amount, the caption
// beside the name, the captions hidden, a row wider than the card (35).
// The fixes after the v421 review (fixes-v421.md, F1–F6) changed what cases 1,
// 5, 7, 8, 16, 31, 33, 34 and 35 expect, and every assertion they gained was
// seen to fail the same way, in both passes: the user's own recipe opened from
// the card with no «سجّل حصّة» (33), not first (33), the view drawn again
// after a withdraw dropping it (16), the picker's view gaining it (33), the
// scaler's servings logged (33), «تعديل» from the card landing in the picker
// (33), its row wider than its share (35); a counted unit back to its label,
// an egg of 55 g, an amount glued to its unit (34); a ready meal or a
// community row left beside the copy saved from it (34, 8), the card behind
// not repainted after that save (8); the withdrawn copy suggested back after
// «أزل من المشاركة» (16) or after an Undo (31, js/app.js); a ready meal's copy
// stored without noAuto (34); «show more» captioning a lone source (1); a name
// holding «$&» toasted through a replacement string (7, 33).
//
// Standalone: it runs itself behind the require.main guard and is required by
// no other suite. QA_ONLY=<words> re-runs the cases whose name contains them.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

// The engine's state in js/food.js: one `let` declares them all, and the lint's
// derived globals see only the first name of a declaration (__autoQueue).
/* global __autoTimer:writable, __autoBusy, __autoOff:writable, __autoHoldUntil:writable, __autoRetried:writable, __autoNextAt:writable, __autoNoticeBtn:writable, __autoNoticeAt:writable */
// The suggestion card's memory of a period the user pressed (see the header).
/* global SHR_PICK:writable */

const ONLY = process.env.QA_ONLY || '';
const WORKER_HOST = 'vault-calories.moathdarweesh2000.workers.dev';
const PERIODS = ['breakfast', 'lunch', 'snack', 'dinner'];
const XSS = '<img src=x onerror="window.__xss=1">';
// The engine's figures BY THE SPEC (v420 §2), never read from js/food.js: the
// wait after a trigger, the one-time notice's window, the gap between two
// requests, the requests a device may send in a local day, the pause after
// «the daily limit», and how long an Undo on the recipes keeps it waiting.
const DELAY = 1500, NOTICE = 12000, GAP = 4000, DAY_MAX = 12, PAUSE = 6 * 3600 * 1000, HOLD = 11000;
// «Try again in a minute»: the wait js/foodai.js puts on a rate-limited answer
// (429 without the day's code), which the engine waits out once.
const RETRY = 60000;
// «Nothing, ever»: longer than every wait above put together.
const QUIET = 30000;
const UID = 'qa-user';
// Where the page's clock starts: now — unless the Riyadh day (UTC+3, the
// context's zone) has under three quarters of an hour left. The engine cases
// step the clock forward — 29 minutes of page time over one page, measured —
// and the day's ceiling (23) is counted per LOCAL day, so a run that would
// cross midnight starts just after it instead.
const clockStart = () => {
  const now = Date.now(), minute = Math.floor(now / 60000 + 180) % 1440;
  return minute >= 1395 ? now + (1441 - minute) * 60000 : now;
};

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
  // An answer marked `gate` waits until the case lets it go (`letGo()`): the
  // request is then IN FLIGHT for exactly as long as the case says, whatever
  // the machine's speed. `most` is the most requests ever in flight at once.
  const worker = { queue: [], calls: [], inflight: 0, most: 0, release: null };
  await page.route((url) => url.hostname === WORKER_HOST, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = null;
    try { body = req.postDataJSON(); } catch (_) { body = null; }
    worker.calls.push(body);
    worker.inflight++;
    worker.most = Math.max(worker.most, worker.inflight);
    const next = worker.queue.shift() || { status: 500, body: { error: 'upstream' } };
    try {
      if (next.delay) await new Promise((r) => setTimeout(r, next.delay));
      if (next.gate) await new Promise((r) => { worker.release = r; });
      return await route.fulfill({ status: next.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(next.body) });
    } finally { worker.inflight--; }
  });
  // Every timer of the page is the clock's from its first script on (see the
  // header); it runs like any clock until a case stops it.
  await page.clock.install({ time: clockStart() });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const boot = async () => {
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
  };
  await boot();
  const reset = (view, ctx) => ev(({ view, ctx }) => {
    try { closeModal(); } catch (_) {}
    const r = document.getElementById('modal-root'); if (r) r.innerHTML = '';
    hideToast();
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx || {});
  }, { view, ctx });
  const fresh = () => { worker.queue.length = 0; worker.calls.length = 0; worker.most = 0; };
  // THE CLOCK, for the engine's cases. stop(): nothing in the page moves until
  // run(ms) — which fires every timer due in those ms, in order — and go()
  // hands the page its running clock back (the loop does, after every case).
  const clock = {
    stop: async () => { await page.clock.pauseAt((await ev(() => Date.now())) + 200); },
    run: (ms) => page.clock.runFor(ms),
    go: () => page.clock.resume(),
  };
  // The stub has RECEIVED n requests since fresh() — in flight or answered —
  // and exactly n: `what` is the case's own sentence for that request…
  const sent = async (n, what) => {
    const end = Date.now() + 5000;
    while (worker.calls.length < n && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    assert.equal(worker.calls.length, n, `${what}: the Worker was asked ${n} time(s) by now, for: ${JSON.stringify(worker.calls.map((c) => c && c.shareRecipe && c.shareRecipe.name))}`);
  };
  // …and the page has had n ANSWERS since account() (pageSignIn counts them as
  // the share call settles): the engine has acted on each as far as it can
  // without the clock moving. The network takes real time; this waits for it.
  const answered = async (n, what) => {
    await sent(n, what);
    await page.waitForFunction((n) => window.__answered >= n, n, { timeout: 5000 });
  };
  const letGo = () => { const r = worker.release; worker.release = null; if (r) r(); };
  // THE APP OPENED AGAIN: a new page load — every `let` of js/food.js is new,
  // localStorage (the blob, the device ledger) is what it was. The clock runs
  // while it loads; the case stops it again through account().
  const reboot = async () => { await clock.go(); await boot(); };
  return { ctx, page, ev, reset, errors, guard, lang, theme, worker, fresh, clock, sent, answered, letGo, reboot };
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
// target exists), then protein per kcal, then the newer — a stable sort, so
// rows that tie keep the order the pool lists them in (v421 §2: the user's
// own, the community's, the ready meals in the catalogue's order).
const rankRows = (rows, period, calLeft) => rows.filter((r) => r.meals.includes(period))
  .map((r) => ({ r, fit: calLeft == null ? 0 : (r.kcal <= Math.max(0, calLeft) ? 1 : 0), d: r.kcal > 0 ? r.protein / r.kcal : 0, at: String(r.created_at || '') }))
  .sort((a, b) => (b.fit - a.fit) || (b.d - a.d) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map((x) => x.r);
const rankIds = (rows, period, calLeft) => rankRows(rows, period, calLeft).map((r) => r.id);
// THE CARD'S ORDER (v421 §2): the best-ranked row of each source — the user's
// own, then the community's, then a ready meal, each when there is one — then
// the rest by rank. The card draws the first three.
const cardIds = (rows, period, calLeft) => {
  const ranked = rankRows(rows, period, calLeft);
  const heads = ['mine', 'community', 'builtin'].map((s) => ranked.find((r) => r.src === s)).filter(Boolean);
  return heads.concat(ranked.filter((r) => !heads.includes(r))).map((r) => r.id);
};
// The community's rows as the pool holds them: their own ids, src named.
const community = (rows) => rows.map((r) => ({ ...r, src: 'community' }));
// A recipe of the user's own as the pool reads it (§2): 'mine:' + its id, one
// serving's figures from its ingredients — rounded as DB.recipes rounds, kcal
// whole and a macro to 0.1 — the periods of its published copy when the list
// holds that copy, else all four, and its createdAt as «the newer». `rec` is
// the recipe as stored (the case's fixture, read back).
const mineRow = (rec, feed) => {
  const n = Math.max(1, Number(rec.servings) || 1);
  const sum = (f) => rec.items.reduce((a, it) => a + it[f], 0);
  const pub = rec.shared ? (feed || []).find((r) => r.id === rec.shared.id) : null;
  return { id: 'mine:' + rec.id, src: 'mine', name: rec.name, meals: pub ? pub.meals : PERIODS, created_at: rec.createdAt,
    kcal: Math.round(sum('calories') / n), protein: Math.round(sum('protein') / n * 10) / 10, carbs: Math.round(sum('carbs') / n * 10) / 10, fat: Math.round(sum('fat') / n * 10) / 10 };
};

// ── in-page helpers ─────────────────────────────────────────────────────────
// The five Cloud methods, as each case wants them, recording into __shr.
// `freshRows` is what a pull PAST the caches answers ({fresh: true} — the one
// automatic sharing makes after an approval); `fresh` counts those. A
// `withdraw` of 'deferred' holds every withdraw call open until the case
// answers it by its index (`withdrawWaits`), so a withdraw can be IN FLIGHT
// while a share answers.
async function stubCloud(page, cfg) {
  await page.evaluate((cfg) => {
    const q = window.__shr = { pulls: 0, fresh: 0, items: [], withdraw: [], withdrawWaits: [], feedback: [], release: null };
    const copy = (x) => JSON.parse(JSON.stringify(x));
    if (cfg.pull === 'missing') delete Cloud.pullSharedRecipes;
    else if (cfg.pull === 'deferred') Cloud.pullSharedRecipes = () => { q.pulls++; return new Promise((res) => { q.release = res; }); };
    else Cloud.pullSharedRecipes = async (o) => {
      q.pulls++;
      if (o && o.fresh) { q.fresh++; if (cfg.freshRows) return copy(cfg.freshRows); }
      return cfg.rows == null ? null : copy(cfg.rows);
    };
    Cloud.getSharedRecipeItems = async (id) => {
      q.items.push(id);
      if (cfg.itemsDelay) await new Promise((r) => setTimeout(r, cfg.itemsDelay));
      const it = (cfg.items || {})[id];
      return it ? copy(it) : null;
    };
    Cloud.getSession = async () => (cfg.signedIn === false ? null : { access_token: 'qa-token', user: { id: 'qa-user' } });
    if (cfg.withdraw === 'deferred') Cloud.withdrawSharedRecipe = (id) => { q.withdraw.push(id); return new Promise((res) => { q.withdrawWaits.push(res); }); };
    else Cloud.withdrawSharedRecipe = async (id) => { q.withdraw.push(id); return copy(cfg.withdraw || { ok: true }); };
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
// THE READY MEALS BY THIS FILE'S OWN READING (v421 §1–2), in the page for the
// reader's language. The catalogue is their fixture, as sixRows is the
// community's: each meal of SUGGESTION_PRESETS priced from FOOD_PRESETS by
// the spec's arithmetic — an amount in grams scales its entry by g / the grams
// the entry's serving NAMES, a unit by n; an ingredient rounded as DB.recipes
// rounds (kcal whole, a macro to 0.1); the meal the sum of its ingredients,
// rounded the same way — and never through js/food.js's suggestionItems. An
// amount is ONE figure (`amt`) and its unit (`unit`, a dictionary key) —
// «١٥٠ غ» / '150 g' — and, since the v421 fix (F2), a count of a unit entry
// too: n × the weight of one serving in SERVING_WEIGHTS (js/catalog.js, the
// catalogue's own data), in grams, or millilitres for a liquid. Rows in the
// pool's shape, in the catalogue's order.
function readyMeals() {
  const ar = DB.prefs.get().lang === 'ar';
  // Latin digits in both languages, like the figures line beside each amount (ui.js).
  const digits = (v) => String(v);
  // The grams a serving names: scripts/test-shared-recipes.js's gramsIn (case J).
  const gramsIn = (s) => { const m = /(\d+(?:\.\d+)?)\s*g(?![A-Za-z])/.exec(String(s)); return m ? Number(m[1]) : null; };
  const r1 = (v) => Math.round(v * 10) / 10;
  return SUGGESTION_PRESETS.map((p) => {
    const items = p.items.map((it) => {
      const e = FOOD_PRESETS.find((x) => x.en === it.en);
      const k = it.g !== undefined ? it.g / gramsIn(e.s) : it.n;
      const w = it.g !== undefined ? null : SERVING_WEIGHTS[it.en];
      const amt = it.g !== undefined ? it.g : it.n * (w.g || w.ml);
      const unit = it.g !== undefined || w.g ? 'unit_g' : 'unit_ml';
      return { name: ar ? e.ar : e.en, g: it.g === undefined ? null : it.g, n: it.n === undefined ? null : it.n, servingG: gramsIn(e.s), amt, unit,
        qty: digits(amt) + ' ' + t(unit),
        calories: Math.round(e.cal * k), protein: r1(e.pro * k), carbs: r1(e.carb * k), fat: r1(e.f * k) };
    });
    const sum = (f) => items.reduce((a, x) => a + x[f], 0);
    return { id: 'builtin:' + p.id, preset: p.id, src: 'builtin', name: ar ? p.ar : p.en, meals: p.meals.slice(), items,
      kcal: Math.round(sum('calories')), protein: r1(sum('protein')), carbs: r1(sum('carbs')), fat: r1(sum('fat')) };
  });
}
// What an ingredient's figures line reads at `f` times its amount (v421):
// «٧٠٠ سعرة · ١٠٠ بروتين · ٠ كارب · ٢٠ دهون», whole figures, the card's spelling.
function figsText({ items, f }) {
  const n = (v) => fmtNum(Math.round(v * f));
  return items.map((it) => [n(it.calories) + ' ' + t('cal'), n(it.protein) + ' ' + t('protein_label'), n(it.carbs) + ' ' + t('carbs_label'), n(it.fat) + ' ' + t('fat_label')].join(' · '));
}
// A row's figures as the card prints them: the kcal figure and the macros line.
function rowText(r) {
  const n = (v) => fmtNum(Math.round(v));
  return { fig: n(r.kcal), sub: [n(r.protein) + ' ' + t('protein_label'), n(r.carbs) + ' ' + t('carbs_label'), n(r.fat) + ' ' + t('fat_label')].join(' · ') };
}

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
    // v421: each row's source, and the caption over its name ('' for none) —
    // with whether that caption stands BEFORE the name (null: no caption).
    srcs: [...c.querySelectorAll('.shr-rows .shr-row')].map((b) => b.dataset.shrSrc || null),
    caps: [...c.querySelectorAll('.shr-rows .shr-row')].map((b) => ((b.querySelector('.shr-src') || {}).textContent || '').trim()),
    capFirst: [...c.querySelectorAll('.shr-rows .shr-row')].map((b) => { const s = b.querySelector('.shr-src'), n = b.querySelector('.fig-row-title'); return s && n ? !!(s.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) : null; }),
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
    // v421: the figures line under each ingredient, and whether the list is busy.
    figsRows: [...m.querySelectorAll('.rec-view [data-figs]')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
    busy: (() => { const l = m.querySelector('#shr-items'); return l ? l.getAttribute('aria-busy') : null; })(),
    serv: (m.querySelector('#shr-servings') || {}).value,
    log: btn('#shr-log'), save: btn('#shr-save'), report: btn('#shr-report'),
    rows: [...m.querySelectorAll('.shr-rows .shr-row')].map((b) => b.dataset.shrOpen),
    // «show more» (v421): the captions in order, each with the rows under it;
    // every row's source; and how many rows carry a caption of their own.
    groups: [...m.querySelectorAll('.shr-list > .shr-group')].map((p) => {
      const list = p.nextElementSibling && p.nextElementSibling.matches('.shr-rows') ? p.nextElementSibling : null;
      return { src: p.dataset.shrGroup, text: p.textContent.trim(), rows: list ? [...list.querySelectorAll('.shr-row')].map((b) => b.dataset.shrOpen) : [] };
    }),
    rowSrcs: [...m.querySelectorAll('.shr-rows .shr-row')].map((b) => b.dataset.shrSrc || null),
    rowCaps: m.querySelectorAll('.shr-rows .shr-row .shr-src').length,
    reasons: [...m.querySelectorAll('[data-shr-reason]')].map((b) => ({ r: b.dataset.shrReason, text: b.textContent.trim() })),
    repErr: ((m.querySelector('#shr-rep-err') || {}).textContent || '').trim(),
    terms: [...m.querySelectorAll('.cx-list.shr-terms > p')].map((p) => p.textContent.trim()),
    send: btn('#shr-send'),
    shareErr: ((m.querySelector('#shr-share-err') || {}).textContent || '').trim(),
    verdict: ((m.querySelector('.shr-verdict') || {}).textContent || '').trim(),
    reason: ((m.querySelector('.shr-reason') || {}).textContent || '').trim(),
    ok: btn('#shr-ok'),
    share: btn('[data-share-view]'), edit: btn('[data-edit-view]'),
    // v421 (fix F1): «سجّل حصّة» on an own recipe's view opened from the card,
    // and the order of the view's actions ('log', 'edit', 'share').
    logView: (() => { const b = m.querySelector('[data-log-view]'); return b ? { text: b.textContent.trim(), disabled: b.disabled, primary: b.classList.contains('btn-primary') } : null; })(),
    actions: [...m.querySelectorAll('.cx-actions > button')].map((b) => (b.hasAttribute('data-log-view') ? 'log' : b.hasAttribute('data-edit-view') ? 'edit' : b.hasAttribute('data-share-view') ? 'share' : b.id || b.className)),
    text: m.textContent,
  };
}
// LAYOUT (v421, case 35), in the page: «Larger text» set as asked, then one
// part measured — the card's rows, «show more»'s list, or a ready meal's
// ingredient lines. `spills` names every element of a box that leaves it side
// to side, or scrolls its own content sideways (a box can hide its overflow).
function layoutOf({ part, lg }) {
  document.body.classList.toggle('text-lg', lg);
  const name = (el) => el.getAttribute('class') || el.tagName;
  const spills = (box) => {
    const b = box.getBoundingClientRect(), out = [];
    for (const el of [box, ...box.querySelectorAll('*')]) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (el !== box && (r.left < b.left - 1 || r.right > b.right + 1)) out.push(`${name(el)} ${Math.round(r.left)}–${Math.round(r.right)} outside ${Math.round(b.left)}–${Math.round(b.right)}`);
      else if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} scrolls ${el.scrollWidth} > ${el.clientWidth}`);
    }
    return out;
  };
  const sheet = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
  if (part === 'card') {
    const card = document.querySelector('.view.active #shr-card');
    const rows = [...card.querySelectorAll('.shr-row')];
    return {
      srcs: rows.map((b) => b.dataset.shrSrc),
      spill: rows.flatMap((b) => spills(b).map((x) => b.dataset.shrSrc + ': ' + x)),
      cardSpill: card.scrollWidth > card.clientWidth + 1,
      pageSpill: document.documentElement.scrollWidth > window.innerWidth + 1,
      rowH: rows.map((b) => Math.round(b.getBoundingClientRect().height)),
      // A caption: drawn, and wholly above the name. null where there is none.
      caps: rows.map((b) => {
        const s = b.querySelector('.shr-src'), n = b.querySelector('.fig-row-title');
        if (!s) return null;
        const a = s.getBoundingClientRect();
        return a.height > 0 && a.bottom <= n.getBoundingClientRect().top + 1;
      }),
    };
  }
  if (part === 'more') {
    const list = sheet.querySelector('.shr-list');
    return { spill: spills(list), modalSpill: sheet.scrollWidth > sheet.clientWidth + 1,
      caps: [...list.querySelectorAll('.shr-group')].map((p) => Math.round(p.getBoundingClientRect().height)) };
  }
  if (part === 'view') {
    // An own recipe's view from the card (v421 fix F1): three actions on one
    // row — «سجّل حصّة», «تعديل», the share button — each word inside its button.
    const row = sheet.querySelector('.cx-actions');
    const btns = [...row.querySelectorAll('button')];
    return { n: btns.length, spill: spills(row), modalSpill: sheet.scrollWidth > sheet.clientWidth + 1,
      h: btns.map((b) => Math.round(b.getBoundingClientRect().height)),
      clipped: btns.filter((b) => b.scrollHeight > b.clientHeight + 1).map((b) => b.textContent.trim()) };
  }
  const rows = [...sheet.querySelectorAll('.rec-view .cx-row.has-figs')];
  return {
    n: rows.length,
    spill: rows.flatMap((r) => spills(r)),
    // The figures' line starts below the name AND the amount.
    below: rows.map((r) => {
      const top = r.querySelector('[data-figs]').getBoundingClientRect().top;
      return [...r.querySelectorAll(':scope > span:not([data-figs])')].every((x) => top >= x.getBoundingClientRect().bottom - 1);
    }),
    modalSpill: sheet.scrollWidth > sheet.clientWidth + 1,
  };
}
const toastText = () => {
  const el = document.getElementById('toast');
  return el && el.classList.contains('show') ? ((el.querySelector('.toast-msg') || el).textContent || '').trim() : '';
};
// The toast's ACTION while it is offered («تراجع», «أوقِفها»), else ''.
const toastAct = () => {
  const el = document.getElementById('toast');
  const b = el && el.classList.contains('show') && el.classList.contains('has-action') ? el.querySelector('.toast-action') : null;
  return b ? b.textContent.trim() : '';
};
const rowsToday = () => DB.foodLogs.listForDate(todayISO()).map((r) => ({ name: r.name, servings: r.servings, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, source: r.source }));
function wipe() {
  for (const d of Object.keys(STATE.foodLogs)) DB.foodLogs.listForDate(d).slice().forEach((r) => DB.foodLogs.remove(d, r.id));
  DB.recipes.list().forEach((r) => DB.recipes.remove(r.id));
  DB.nutrition.setTargets({ calories: 2000, protein: 120, carbs: 220, fat: 60 });
  // Automatic sharing is ON by default, and every case starts from the default.
  if (!DB.prefs.autoShare()) DB.prefs.setAutoShare(true);
  // The card shows the clock's period again, whatever a case pressed.
  SHR_PICK = null;
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
// «show more» from the card: the sheet as it reads, left open.
async function openMore(page) {
  await page.locator('.view.active #shr-card [data-shr-more]').click();
  await sheetUp(page, '.shr-rows .shr-row');
  return page.evaluate(readSheet);
}
// The rows of one source's group in that sheet ([] when it has none).
const group = (sheet, src) => ((sheet.groups || []).find((g) => g.src === src) || { rows: [] }).rows;
// A recipe of the user's own, through DB.*.
const ownRecipe = (page, data) => page.evaluate((d) => DB.recipes.add(d), data);
const BOWL = { name: 'QA shared bowl', servings: 2, items: [
  { name: 'Rice', qty: '200 g', calories: 260, protein: 5, carbs: 56, fat: 1 },
  { name: 'Chicken', qty: '150 g', calories: 248, protein: 46, carbs: 0, fat: 5 }] };
// A recipe of the user's own that the ranking puts LAST in any period: 4 g of
// protein in 390 kcal is less per kcal than any community row of sixRows for
// the clock's period and any ready meal.
const RICE = { name: 'QA plain rice', servings: 1, items: [{ name: 'Rice', qty: '300 g', calories: 390, protein: 4, carbs: 86, fat: 1 }] };
async function openOwnView(page, id) {
  await page.evaluate((id) => openRecipeView(todayISO(), DB.recipes.list().find((r) => r.id === id), () => {}), id);
  await sheetUp(page, '[data-edit-view]');
}
const recOf = (id) => DB.recipes.list().find((x) => x.id === id) || null;
const markOf = (id) => { const r = DB.recipes.list().find((x) => x.id === id); return (r && r.shared) || null; };
// A signature as the marker carries it: 8 lowercase hex characters.
const SIG = /^[0-9a-f]{8}$/;

// ── automatic sharing (v420): the engine's kit ──────────────────────────────
// THE ACCOUNT, in the page: a configured Cloud with a last uid (window.__qaUid,
// so a case can change the account in the middle of a request), and a recorder
// under fetch — window.__posts holds the PAGE'S time of every request to the
// Worker, taken the instant it leaves, so «nothing was sent» never waits for
// the network to say so.
// window.__answered counts the share calls that have SETTLED (an answer or a
// throw): FoodAI.shareRecipe is still the real one, called through.
function pageSignIn(a) {
  window.__qaUid = a.uid;
  Cloud.configured = () => true;
  Cloud.getLastUid = () => window.__qaUid;
  if (!window.__qaFetch) {
    window.__qaFetch = window.fetch;
    window.fetch = function (input) {
      if (String((input && input.url) || input).indexOf(a.host) !== -1) window.__posts.push(Date.now());
      return window.__qaFetch.apply(this, arguments);
    };
    const share = FoodAI.shareRecipe;
    FoodAI.shareRecipe = function () {
      const p = share.apply(this, arguments);
      const settle = () => { window.__answered++; };
      p.then(settle, settle);
      return p;
    };
  }
  window.__posts = [];
  window.__answered = 0;
}
// …and back to the 'out' stub's install, whatever the case set.
function pageSignOut() {
  Cloud.configured = () => false;
  Cloud.getLastUid = () => null;
  Cloud.getSession = async () => null;
  // What cases 20 and 28 close, should they fail half-way: the own properties
  // over the prototype's real navigator.onLine and document.visibilityState,
  // the settled sync, the stub's sync status, DB's own loadFailed.
  delete navigator.onLine;
  delete document.visibilityState;
  Cloud.isSettled = () => true;
  qaCloud.status = 'pending';
  if (window.__qaLoadFailed) { DB.loadFailed = window.__qaLoadFailed; delete window.__qaLoadFailed; }
  // …and the undo ledger, as a real sign-out sweeps it (cloud.js
  // clearLocalUserData). Left holding the account's entries, it meets the
  // signed-out writes of the next case and DB.undo.list() drops it WHOLE —
  // so that case's first Undo answers STALE (seen: case 34 after the engine
  // cases; case 31 lists the ledger itself for the same reason).
  DB.undo.clear();
}
// THE ENGINE'S OWN STATE, put back to a page that never shared anything: the
// queue, its one timer, «stopped until the app is opened again», the hold, the
// one rate-limit wait, the gap, the notice's button and when it was raised —
// and the device ledger.
// `seen` is whether the one-time notice was shown already. The ONE place this
// suite writes js/food.js's module state (see the header). Answers whether a
// request is still in flight, which a reset cannot undo.
function engineReset(seen) {
  __autoQueue.length = 0;
  clearTimeout(__autoTimer);
  __autoTimer = null; __autoOff = false; __autoHoldUntil = 0; __autoRetried = false; __autoNextAt = 0; __autoNoticeBtn = null; __autoNoticeAt = 0;
  localStorage.removeItem(VAULT_KEYS.shareAuto);
  if (seen) DB.prefs.setAutoShareSeen(); else delete STATE.prefs.autoShareSeen;
  return __autoBusy;
}
// OPEN THE ENGINE FOR A CASE: the five Cloud methods (stubCloud's cfg), the
// account, a clean engine — and the clock STOPPED: from here the page moves
// only by clock.run(). `seen: false` is a device that has not shown the notice
// yet; `keep` leaves the engine and its ledger as they are (after a reboot).
async function account(kit, cfg = {}) {
  await stubCloud(kit.page, { rows: [], ...cfg });
  await kit.ev(pageSignIn, { uid: UID, host: WORKER_HOST });
  if (!cfg.keep) assert.equal(await kit.ev(engineReset, cfg.seen !== false), false, 'setup: no request is in flight when the case begins');
  await kit.clock.stop();
}
// The page's time of every request it sent to the Worker, and the device's
// ledger as it is stored.
const posts = (kit) => kit.ev(() => window.__posts.slice());
const ledger = () => JSON.parse(localStorage.getItem(VAULT_KEYS.shareAuto) || 'null');
const pageNow = () => Date.now();
// SAVE THROUGH THE EDITOR — the engine's first trigger. A `draft` is added; an
// `id` is opened and saved again, a new `name` typed first when given. The
// pointer leaves the screen afterwards: a toast with an action does not time
// out under a pointer (WCAG 2.2.1), and the notice is such a toast.
async function editorSave(kit, { draft, id, name }) {
  const { page, ev } = kit;
  if (id) await ev((id) => openRecipeEditor(null, DB.recipes.list().find((r) => r.id === id), () => {}), id);
  else await ev((d) => openRecipeEditor(null, d, () => {}), draft);
  const live = (sel) => page.locator('#modal-root .modal-overlay:not(.is-out) ' + sel);
  await live('#rec-rows .rec-row').first().waitFor({ timeout: 4000 });
  if (name) await live('#rec-name').fill(name);
  await live('#rec-save').click();
  await page.mouse.move(0, 0);
  assert.equal(await ev(toastText), await ev(() => t('rec_saved')), 'setup: the editor saved the recipe');
  const want = name || (draft && draft.name);
  return ev(({ id, want }) => DB.recipes.list().find((r) => (id ? r.id === id : r.name === want)) || null, { id, want });
}
// A recipe automatic sharing wants: whole servings, calories, nobody's copy.
const dish = (name) => ({ ...BOWL, name });
// The user's own published recipe as the community list returns it: one
// serving of BOWL, suited to every period so the clock's is always among them.
const ownRow = (id, name) => row(id, name, PERIODS, 254, 26, 28, 3, 2, 0);
// Another user's «Tuna salad» (TUNA_ITEMS), suited to every period too: an
// engine case steps the clock by minutes, and a row for the clock's period
// alone would be off the card at the first redraw after that walk crossed
// 05:00, 11:00, 16:00 or 19:00.
const tunaRow = (id) => row(id, 'Tuna salad', PERIODS, 250, 30, 10, 12, 4, 30);
// What the Worker answers.
const APPROVE = (id, extra) => ({ status: 200, body: { verdict: 'approve', id, name: '' }, ...(extra || {}) });

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  // v421: the card used to be ABSENT here — no community recipe, no card — and
  // the owner never saw it. It is there from the first day now, ready meals in it.
  ['(1) the card is there from the first day: with no community list — a null answer, a Cloud without the call, an empty list, and before the answer — it is titled «اقتراحات اليوم» and holds three ready meals for the clock\'s period, only that period pressed; the list arriving adds its best row by itself; a water tap keeps it and pulls nothing; «show more» with the ready meals alone draws them bare, with no caption', async ({ page, ev, reset, lang }) => {
    const { P, O } = await periods(page);
    const ready = await ev(readyMeals);
    const want = await ev(() => ({ title: t('shr_title'), labels: ['breakfast', 'lunch', 'snack', 'dinner'].map((p) => t('shr_meal_' + p)), more: t('show_more') }));
    // THE TITLE is the spec's words (v421 §4), not only whatever the dictionary holds.
    assert.equal(want.title, lang === 'ar' ? 'اقتراحات اليوم' : 'Today’s suggestions', 'the card is titled as the owner named it: ' + want.title);
    const readyCard = cardIds(ready, P, 2000).slice(0, 3);
    assert.equal(readyCard.length, 3, 'setup: the clock\'s period has at least three ready meals');
    for (const [cfg, what] of [[{ rows: null }, 'a null answer (no session, an error)'], [{ pull: 'missing' }, 'a Cloud without pullSharedRecipes (an old cloud.js)'], [{ rows: [] }, 'an empty list']]) {
      await stubCloud(page, cfg);
      const answer = await load(page);
      if (cfg.pull === 'missing') assert.equal(answer, false, 'a Cloud without pullSharedRecipes answers false and throws nothing');
      await reset('food');
      const c = await ev(readCard);
      assert.ok(c, `${what}: the card is there all the same`);
      assert.equal(c.title, want.title, `${what}: titled «${want.title}»`);
      assert.deepEqual(c.rows, readyCard, `${what}: three ready meals, the period's best first: ${JSON.stringify(c.rows)}`);
      assert.deepEqual(c.srcs, ['builtin', 'builtin', 'builtin'], `${what}: each row says it is a ready meal (data-shr-src)`);
      assert.deepEqual(c.caps, ['', '', ''], `${what}: and a ready meal carries no caption — the default says nothing`);
      assert.deepEqual(c.pressed, [P], `${what}: only the clock's period is pressed`);
      assert.deepEqual(c.empty, [], `${what}: no «nothing yet» line`);
    }
    // «SHOW MORE» WITH ONE SOURCE (v421 fix F5): no recipe and no list, so the
    // ready meals alone — drawn bare. A caption tells groups apart; a lone
    // «اقتراحات جاهزة» over every row would tell nothing, and repeat the
    // title's «اقتراحات».
    const bare = await openMore(page);
    assert.deepEqual([bare.groups, bare.rowCaps, await ev(() => document.querySelectorAll('#modal-root [data-shr-group], #modal-root .shr-src').length)], [[], 0, 0],
      '«show more» with one source draws no caption at all — no group caption, no row caption: ' + JSON.stringify(bare.groups));
    assert.deepEqual(bare.rows, rankIds(ready, P, 2000), 'and every ready meal of the period, in rank order');
    assert.deepEqual(bare.rowSrcs, bare.rows.map(() => 'builtin'), 'each a ready meal');
    await ev(() => closeModal());
    await sheetGone(page);
    // Each row is the meal priced from the catalogue: its name, its kcal, its macros.
    const first = await ev(readCard);
    const meals = readyCard.map((id) => ready.find((r) => r.id === id));
    assert.deepEqual(first.titles, meals.map((m) => m.name), 'the ready meals by name, in the reader\'s language');
    const text = [];
    for (const m of meals) text.push(await ev(rowText, m));
    assert.deepEqual([first.figs, first.subs], [text.map((x) => x.fig), text.map((x) => x.sub)], 'each with one serving\'s figures — the sum of its ingredients, priced from the catalogue');
    // Before the answer: the Food tab paints the card from memory — the ready
    // meals — and the list, once it answers, puts its best recipe on the card
    // by itself: the render's own wiring, no second render.
    const rows = sixRows('qa-c1', P, O);
    await stubCloud(page, { pull: 'deferred' });
    await ev(() => { window.__shrLoading = loadSharedRecipes({ force: true }); });
    await reset('food');
    assert.deepEqual(((await ev(readCard)) || {}).rows, readyCard, 'the pull has not answered: the card holds the ready meals meanwhile');
    await ev((rows) => window.__shr.release(rows), rows);
    await page.waitForFunction((id) => !!document.querySelector(`.view.active #shr-card [data-shr-open="${id}"]`), rankIds(rows, P, 2000)[0], { timeout: 3000 }).catch(() => {});
    const c = await ev(readCard);
    assert.ok(/\bcard\b/.test(c.cls) && /\bshr-card\b/.test(c.cls), 'it is a .card.shr-card: ' + c.cls);
    assert.equal(c.title, want.title, 'its heading is «' + want.title + '»');
    assert.deepEqual(c.periods.map((x) => x.p), PERIODS, 'four period buttons in day order');
    assert.deepEqual(c.periods.map((x) => x.text), want.labels, 'each named in the reader\'s language');
    assert.deepEqual(c.pressed, [P], 'only the clock\'s period is pressed: ' + JSON.stringify(c.periods));
    assert.ok(c.periods.every((x) => x.pressed === 'true' || x.pressed === 'false'), 'every period button carries aria-pressed');
    assert.deepEqual(c.rows, cardIds(community(rows).concat(ready), P, 2000).slice(0, 3), 'the list in, its best recipe leads and the best ready meal follows, then the next by rank: ' + JSON.stringify(c.rows));
    assert.deepEqual(c.srcs.slice(0, 2), ['community', 'builtin'], 'a community row, then a ready meal');
    assert.equal(c.more, want.more, 'more rows in the period → «' + want.more + '»');
    assert.equal(c.inHero, false, 'the card is not inside .nutri-hero (whose catch-all opens the log)');
    assert.equal(c.afterWater, true, 'it follows the water card');
    assert.ok(!/[{}]/.test(c.text), 'no unfilled placeholder: ' + c.text.trim());
    await page.locator('.view.active [data-add-water="250"]').click();
    const after = await ev(readCard);
    assert.ok(after && after.rows.length === 3, 'the water tap repaints the dashboard and the card is still there');
    assert.equal(await ev(() => window.__shr.pulls), 1, 'and nothing was pulled again: the dashboard repaint reads memory');
  }],

  ['(2) a period button: Lunch pressed alone shows lunch rows only — the community\'s best, then the ready meals — keeps focus, opens nothing; still pressed after a log', async ({ page, ev, reset }) => {
    const { P, O, PICK } = await periods(page);
    const rows = sixRows('qa-c2', P, O).concat([row('qa-c2-pick', 'Pick of the period', [PICK], 400, 30, 40, 10, 1, 5)]);
    await stubCloud(page, { rows, items: { 'qa-c2-pick': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    assert.ok(await ev(readCard), 'setup: the card is up');
    const pool = community(rows).concat(await ev(readyMeals));
    await page.locator(`.view.active #shr-card [data-shr-period="${PICK}"]`).click();
    const c = await ev(readCard);
    assert.deepEqual(c.pressed, [PICK], `«${PICK}» is the one pressed button`);
    assert.deepEqual(c.rows, cardIds(pool, PICK, 2000).slice(0, 3), `${PICK}'s rows — the best of each source, then by rank: ${JSON.stringify(c.rows)}`);
    assert.ok(c.rows.every((id) => pool.find((r) => r.id === id).meals.includes(PICK)), `every row suits ${PICK}: ${JSON.stringify(c.rows)}`);
    assert.equal(c.rows[0], 'qa-c2-pick', `the community's best for ${PICK} leads`);
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

  // v421: the card holds one row of each source, so the community's whole
  // ranking is read where it is listed whole — «show more», its own group.
  ['(3) the ranking: with 500 kcal left the fitting recipes lead (E, D, C) — the card\'s community row is E, «show more» lists E, D, C and the ready meals by the same rule; without a target protein per kcal decides (C, E, D)', async ({ page, ev, reset }) => {
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
    const ready = await ev(readyMeals);
    const pool = community(rows).concat(ready);
    const c = await ev(readCard);
    assert.ok(c, 'setup: the card is up');
    assert.deepEqual(c.rows, cardIds(pool, P, 500).slice(0, 3), 'the card with 500 kcal left: the best of each source, then by rank: ' + JSON.stringify(c.rows));
    assert.equal(c.titles[0], 'Dish E', 'the community\'s best for 500 kcal left is E — it fits, and has the most protein per kcal of what fits');
    let more = await openMore(page);
    assert.deepEqual(group(more, 'community').map((id) => rows.find((r) => r.id === id).name), ['Dish E', 'Dish D', 'Dish C'], '«show more»: what fits 500 kcal first, by protein per kcal; then the rest');
    assert.deepEqual(group(more, 'builtin'), rankIds(ready, P, 500), 'and the ready meals by the same rule');
    await ev(() => closeModal());
    await sheetGone(page);
    await ev(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
    await reset('food');
    // The Food tab opens the calculator by itself when no target is set.
    await page.waitForTimeout(400);
    await ev(() => { try { closeModal(); } catch (_) {} });
    await sheetGone(page);
    const n = await ev(readCard);
    assert.ok(n, 'the card is there without a target too (under the setup button)');
    assert.equal(await ev(() => !!document.querySelector('.view.active .nutri-setup')), true, 'setup: no target, so the setup button is up');
    assert.deepEqual(n.rows, cardIds(pool, P, null).slice(0, 3), 'no target → protein per kcal alone: ' + JSON.stringify(n.rows));
    assert.equal(n.titles[0], 'Dish C', 'the community\'s best is C now');
    more = await openMore(page);
    assert.deepEqual(group(more, 'community').map((id) => rows.find((r) => r.id === id).name), ['Dish C', 'Dish E', 'Dish D'], '«show more» without a target: protein per kcal alone');
    assert.deepEqual(group(more, 'builtin'), rankIds(ready, P, null), 'the ready meals too');
  }],

  // v421: a period no community recipe suits used to hold one «nothing yet»
  // line. The ready meals cover every period now.
  ['(4) a period no community recipe suits holds ready meals alone — its three best, no caption, «show more» for the rest, no empty line — and the period row stays', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const empty = PERIODS.find((p) => p !== P && p !== O);
    await stubCloud(page, { rows: sixRows('qa-c4', P, O) });
    await load(page);
    await reset('food');
    const ready = await ev(readyMeals);
    await page.locator(`.view.active #shr-card [data-shr-period="${empty}"]`).click();
    const c = await ev(readCard);
    const want = await ev(() => ({ none: t('shr_none'), more: t('show_more') }));
    assert.deepEqual(c.pressed, [empty], `«${empty}» pressed`);
    assert.deepEqual(c.rows, rankIds(ready, empty, 2000).slice(0, 3), `no community recipe suits ${empty}: its three best ready meals, by rank: ${JSON.stringify(c.rows)}`);
    assert.deepEqual([c.srcs, c.caps], [['builtin', 'builtin', 'builtin'], ['', '', '']], 'ready meals, with no caption');
    assert.deepEqual(c.empty, [], `no «${want.none}» line: the ready meals are always there`);
    assert.equal(c.more, want.more, `more ready meals suit ${empty} → «${want.more}»`);
    assert.equal(c.periods.length, 4, 'the four period buttons stay');
    await page.locator(`.view.active #shr-card [data-shr-period="${P}"]`).click();
  }],

  // v421: the whole period, grouped under the three sources' captions.
  ['(5) «show more» lists the whole period under three captions — my recipes, other users\', ready meals — each group in rank order, no row with a caption of its own; a row there opens its sheet: an own recipe its view, a community recipe or a ready meal the suggestion sheet', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const rows = sixRows('qa-c5', P, O);
    await stubCloud(page, { rows, items: { 'qa-c5-4': TUNA_ITEMS } });
    await load(page);
    const rec = await ownRecipe(page, BOWL);
    await reset('food');
    const ready = await ev(readyMeals);
    const s = await openMore(page);
    const want = await ev((P) => ({ title: t('shr_title'), sub: t('shr_meal_' + P), mine: t('shr_src_mine'), community: t('shr_src_community'), builtin: t('shr_src_builtin') }), P);
    assert.equal(s.title, want.title, 'the sheet is titled «' + want.title + '»');
    assert.equal(s.sub, want.sub, 'and names the period');
    assert.deepEqual(s.groups.map((g) => [g.src, g.text]), [['mine', want.mine], ['community', want.community], ['builtin', want.builtin]], 'three captions, in order: «' + [want.mine, want.community, want.builtin].join('», «') + '»');
    const groups = [['mine:' + rec.id], rankIds(rows, P, 2000), rankIds(ready, P, 2000)];
    assert.deepEqual(s.groups.map((g) => g.rows), groups, 'under each, the period\'s rows of that source in rank order');
    assert.deepEqual(s.rows, groups.flat(), 'and no row outside a group');
    assert.deepEqual(s.rowSrcs, s.groups.flatMap((g) => g.rows.map(() => g.src)), 'every row under its own source\'s caption');
    assert.equal(s.rowCaps, 0, 'a row under its caption carries none of its own');
    // The own recipe opens the recipe itself…
    await page.locator(`#modal-root [data-shr-open="mine:${rec.id}"]`).click();
    await sheetUp(page, '[data-edit-view]').catch(() => {});
    const v = (await ev(readSheet)) || {};
    assert.deepEqual([v.title, !!v.edit, v.log, v.report], [BOWL.name, true, null, null], 'an own recipe opens its recipe view — «edit» on it — not the suggestion sheet');
    assert.deepEqual([v.logView, v.actions[0]], [{ text: await ev(() => t('shr_log')), disabled: false, primary: true }, 'log'], 'and, opened from a suggestion, «' + (await ev(() => t('shr_log'))) + '» first on it (v421 fix F1)');
    // …a community row the suggestion sheet…
    await ev(() => closeModal());
    await sheetGone(page);
    await openMore(page);
    await page.locator('#modal-root [data-shr-open="qa-c5-4"]').click();
    await sheetUp(page, '#shr-log');
    assert.equal((await ev(readSheet)).title, 'Oat porridge', 'a community row opens that recipe');
    // …and a ready meal its own: the meal's name, with nothing to report.
    await ev(() => closeModal());
    await sheetGone(page);
    await openMore(page);
    const meal = ready.find((r) => r.id === groups[2][groups[2].length - 1]);
    await page.locator(`#modal-root [data-shr-open="${meal.id}"]`).click();
    await sheetUp(page, '#shr-log');
    const b = await ev(readSheet);
    assert.deepEqual([b.title, b.names, b.report], [meal.name, meal.items.map((it) => it.name), null], 'a ready meal opens with its own ingredients, and no report');
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
    // v421: every ingredient also says what it costs («كل مكوّن محسوب»).
    assert.deepEqual(s.figsRows, await ev(figsText, { items: TUNA_ITEMS, f: 1 }), 'each ingredient with its own figures under its amount');
    assert.equal(s.serv, '4', 'the stepper starts at the recipe\'s own servings');
    assert.equal(s.save.disabled, false, 'saving is live once they are in');
    for (const part of want.n) assert.ok(s.figs.includes(part), `the figures re-derived from the ingredients agree: «${s.figs}»`);
    await page.locator('#modal-root .rt-step [data-step="-1"]').click();
    await page.locator('#modal-root .rt-step [data-step="-1"]').click();
    const half = await ev(readSheet);
    assert.equal(half.serv, '2', 'two steps down');
    assert.deepEqual(half.qty, ['100 g', '1 tbsp', '2 شرائح'], 'every leading number halves, nothing else moves');
    assert.deepEqual(half.figsRows, await ev(figsText, { items: TUNA_ITEMS, f: 0.5 }), 'and each ingredient\'s figures halve with its amount');
  }],

  ['(7) «Log a serving» writes ONE row of one serving with the per-serving figures, closes, repaints the hero, and Undo takes it back; a name holding «$&» is toasted as written', async ({ page, ev, reset }) => {
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
    // A NAME WITH «$» IN IT (v421 fix F6) is another user's text: the toast
    // prints it as written — a replacement STRING would read «$&» as the
    // placeholder it replaced and «$$» as one «$».
    const dollar = row('qa-c7-dollar', 'Price $& $1 $$ $\' bowl', [P], 250, 30, 10, 12, 4, 5);
    await stubCloud(page, { rows: sixRows('qa-c7', P, O), items: { 'qa-c7-dollar': TUNA_ITEMS } });
    await ev((r) => openSharedRecipe(r, null, () => {}), dollar);
    await sheetUp(page, '#shr-log');
    await page.locator('#shr-log').click();
    await sheetGone(page);
    assert.equal(await ev(toastText), await ev((n) => t('rec_logged').split('{name}').join(n), dollar.name), 'a name holding «$&», «$1», «$$» and «$\'» is toasted exactly as written');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
  }],

  ['(8) «Save to my recipes» makes a copy with its own item ids and nothing of the server\'s; the button says it is in the recipes, and still does on reopening; the copy stands in for the row it was saved from, on the card behind at once and in «show more»', async ({ page, ev, reset }) => {
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
    // ONE MEAL, ONE ROW (v421 fix F3b): the copy stands in for the row it was
    // saved from — same name, servings and kcal — on the card behind at once
    // (no row left there whose door opens nothing) and in «show more»; it is
    // the user's own now, under the periods that row carried.
    const mine = 'mine:' + r.id;
    const c = await ev(readCard);
    assert.deepEqual([c.rows[0], c.srcs[0], c.caps[0]], [mine, 'mine', await ev(() => t('shr_src_mine'))], 'the card behind already leads with the copy, as the user\'s own: ' + JSON.stringify(c.rows));
    assert.ok(!c.rows.includes('qa-c8-3'), 'and the row it was saved from is gone from it: ' + JSON.stringify(c.rows));
    const more = await openMore(page);
    assert.deepEqual([group(more, 'mine'), more.rows.includes('qa-c8-3')], [[mine], false], '«show more» lists the recipe once, as the user\'s own');
    await ev(() => closeModal());
    await sheetGone(page);
    // Reached directly, that row's sheet still says the copy is saved.
    await ev((r) => openSharedRecipe(r, null, () => {}), sixRows('qa-c8', P, O)[2]);
    await sheetUp(page, '#shr-log');
    await page.waitForFunction(() => document.querySelectorAll('#modal-root .rec-view [data-qty]').length === 3, null, { timeout: 4000 });
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

  ['(10) share: the four terms — the fourth by the setting — a request in the Worker\'s protocol, the marker {id, at, sig}, «Stop sharing» on the view and «shared» in the picker; a corrected name is announced', async ({ page, ev, reset, worker, fresh }) => {
    await reset('food');
    const rec = await ownRecipe(page, BOWL);
    await stubCloud(page, { rows: [] });
    await openOwnView(page, rec.id);
    const want = await ev(() => ({ share: t('shr_share'), unshare: t('shr_unshare'), title: t('shr_share_title'), send: t('shr_send'), sending: t('shr_sending'),
      terms: [t('shr_term_review'), t('shr_term_anon'), t('shr_term_withdraw')], follow: t('shr_term_follow'), copy: t('shr_term_copy'), published: t('shr_published'), tag: t('shr_tag_shared'), note: t('shr_del_note') }));
    const v = await ev(readSheet);
    assert.deepEqual(v.share, { text: want.share, disabled: false }, 'the view offers «' + want.share + '»');
    assert.ok(v.edit, 'beside «edit»');
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    // THE FOURTH TERM SAYS WHICH HOLDS (v420): with automatic sharing on — the
    // default — the published copy follows the recipe's later edits…
    assert.equal(await ev(() => DB.prefs.autoShare()), true, 'setup: automatic sharing is on, the default');
    assert.deepEqual((await ev(readSheet)).terms, [...want.terms, want.follow], 'the four terms, in order; with automatic sharing on the fourth says the copy follows your edits');
    // …but not for a copy saved from the list (origin 'shared'): automatic
    // sharing never follows that recipe, so its fourth line says the copy stays
    // as sent — with the setting still on.
    await ev(() => closeModal());
    const fromList = await ownRecipe(page, { ...BOWL, name: 'QA copy from the list', origin: 'shared' });
    assert.equal(await ev((id) => DB.recipes.list().find((r) => r.id === id).origin, fromList.id), 'shared', 'setup: a copy from the list carries its origin');
    await openOwnView(page, fromList.id);
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    assert.deepEqual((await ev(readSheet)).terms, [...want.terms, want.copy], 'a copy saved from the list: the fourth term says the copy stays as sent, although automatic sharing is on');
    assert.equal(await ev(() => DB.prefs.autoShare()), true, 'setup: and the setting was on throughout');
    // …and with it off the copy stays as it was sent. The request below leaves
    // from this sheet: sharing by hand is what is left when the setting is off.
    await ev(() => { closeModal(); DB.prefs.setAutoShare(false); });
    await openOwnView(page, rec.id);
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    const s = await ev(readSheet);
    assert.equal(s.title, want.title, 'the share sheet\'s title');
    assert.equal(s.sub, BOWL.name, 'it names the recipe');
    assert.deepEqual(s.terms, [...want.terms, want.copy], 'with automatic sharing off the fourth says the copy does not follow them');
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
    const mark = await ev(markOf, rec.id);
    assert.ok(mark && mark.id === 'pub-1' && typeof mark.at === 'string' && !Number.isNaN(Date.parse(mark.at)), 'the recipe carries shared = {id, at, …}: ' + JSON.stringify(mark));
    // The sig (v420) names the content AS PUBLISHED: it is what tells a later
    // edit from the copy everyone sees.
    assert.deepEqual(Object.keys(mark).sort(), ['at', 'id', 'sig'], 'the marker is {id, at, sig} and nothing else');
    assert.ok(SIG.test(mark.sig), 'the sig is 8 hex characters: ' + mark.sig);
    assert.equal(mark.sig, await ev((id) => shrSig(DB.recipes.list().find((r) => r.id === id)), rec.id), 'and it is the signature of the recipe as it was sent');
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

  ['(13) stop sharing: the withdraw call names the published id, the marker goes and the recipe is out of automatic sharing until it is shared by hand again; a failure keeps it and says so; a button the marker moved under only redraws', async ({ page, ev, reset, worker, fresh }) => {
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
    assert.equal(await ev((id) => 'noAuto' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'a recipe that is still published is not taken out of automatic sharing');
    await stubCloud(page, { rows: [], withdraw: { ok: true } });
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, want.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-9'], 'withdrawn by the published id');
    assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'the marker is gone');
    assert.equal(await ev(toastText), want.done, '«' + want.done + '»');
    // «Not automatically» (v420): without it automatic sharing would publish
    // the recipe again at the next render of Food (case 20 watches that).
    assert.equal(await ev((id) => DB.recipes.list().find((r) => r.id === id).noAuto, rec.id), true, 'and the recipe is marked noAuto: the user took it out of sharing');
    // {ok:false} with NO error: the database found nothing of ours by that id —
    // already gone (a lost reply after an earlier withdraw, or the owner's own
    // removal). It reads as withdrawn, and the marker goes too.
    await ev((id) => { DB.recipes.setNoAuto(id, false); DB.recipes.setShared(id, { id: 'pub-10', at: new Date().toISOString() }); }, rec.id);
    await stubCloud(page, { rows: [], withdraw: { ok: false } });
    await openOwnView(page, rec.id);
    assert.equal((await ev(readSheet)).share.text, want.unshare, 'setup: shared again');
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, want.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-10'], 'asked once, by the new published id');
    assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'an answer of «nothing to delete» clears the marker');
    assert.equal(await ev(toastText), want.done, 'and says it is no longer shared');
    assert.equal(await ev((id) => DB.recipes.list().find((r) => r.id === id).noAuto, rec.id), true, 'and it too leaves the recipe out of automatic sharing');
    // SHARED BY HAND AGAIN (v420): the user asked for it, so «not automatically»
    // is lifted and the recipe follows its edits like any other.
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    fresh();
    worker.queue.push(APPROVE('pub-11'));
    await page.locator('#shr-send').click();
    await page.waitForFunction((u) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === u; }, want.unshare, { timeout: 5000 });
    const again = await ev(recOf, rec.id);
    assert.ok(again.shared && again.shared.id === 'pub-11' && SIG.test(again.shared.sig), 'setup: shared by hand, the marker carries its sig: ' + JSON.stringify(again.shared));
    assert.equal('noAuto' in again, false, 'sharing it by hand lifts noAuto: ' + JSON.stringify(Object.keys(again)));
    // THE MARKER MOVED UNDER THE OPEN SHEET (v420). Automatic sharing publishes
    // in the background, so a view drawn with «شاركها» can be looking at a
    // recipe that is shared by now — and a tap there must not WITHDRAW it. The
    // tap only draws the view again, with the button that is true.
    await ev(() => closeModal());
    const under = await ownRecipe(page, { ...BOWL, name: 'QA moved under' });
    await stubCloud(page, { rows: [], withdraw: { ok: true } });
    await openOwnView(page, under.id);
    assert.equal((await ev(readSheet)).share.text, want.share, 'setup: the view was drawn for a recipe that is not shared');
    await ev((id) => DB.recipes.setShared(id, { id: 'pub-under', at: new Date().toISOString() }), under.id);
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForTimeout(200);
    assert.deepEqual(await ev(() => window.__shr.withdraw), [], 'a tap on a «share» the recipe outgrew withdraws nothing');
    assert.equal(await ev(() => !!document.querySelector('#modal-root #shr-send')), false, 'and it opens no share sheet for a recipe that is shared already');
    assert.equal(((await ev(readSheet)).share || {}).text, want.unshare, 'the view is drawn again, offering «' + want.unshare + '» now');
    assert.deepEqual(await ev((id) => { const r = DB.recipes.list().find((x) => x.id === id); return [(r.shared || {}).id, 'noAuto' in r]; }, under.id), ['pub-under', false], 'the marker stands and the recipe stays in automatic sharing');
    // The other way round — a pull took the marker away under «Stop sharing»:
    // the tap asks the server nothing and opens no share sheet either.
    await ev((id) => DB.recipes.setShared(id, null), under.id);
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForTimeout(200);
    assert.deepEqual(await ev(() => window.__shr.withdraw), [], 'a tap on a «stop sharing» with nothing left to stop asks the server nothing');
    assert.equal(await ev(() => !!document.querySelector('#modal-root #shr-send')), false, 'and it does not open the share sheet by surprise');
    assert.equal(((await ev(readSheet)).share || {}).text, want.share, 'the view is drawn again, offering «' + want.share + '»');
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
    const safe = rows.filter((r) => /^qa-x-\d$/.test(r.id));
    assert.deepEqual(c.rows, cardIds(community(safe).concat(await ev(readyMeals)), P, 2000).slice(0, 3), 'the two unsafe ids are gone; the rest rank as usual: ' + JSON.stringify(c.rows));
    assert.equal(c.rows[0], 'qa-x-1', 'the community\'s best safe row leads — the two that out-rank it are the unsafe ones');
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
    const more = await openMore(page);
    assert.deepEqual(group(more, 'community'), ['qa-x-1', 'qa-x-2', 'qa-x-3', 'qa-x-4'], '«show more» lists the four safe rows and neither unsafe one');
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

  // v419 took the user's own published rows OFF their card; v420 put the
  // feed's copy back on it. v421: the recipe is the user's OWN row now — once,
  // under the periods the review gave its published copy — and the feed's copy
  // is left out, of the card and of «show more».
  ['(16) the user\'s own PUBLISHED recipe is suggested once, as their own — under the periods its published copy carries — and the feed\'s copy is left out of the card and «show more»; should that copy still reach the suggestion sheet it offers no copy and no report; withdrawn from the card, the copy the list still holds is not suggested back, and the view keeps «سجّل حصّة»', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    // The published copy of OUR recipe, as the list returns it: the review
    // tagged it for O alone.
    const pubRow = row('qa-c16-pub', BOWL.name, [O], 254, 25.5, 28, 3, 2, 0);
    const rows = sixRows('qa-c16', P, O).concat([pubRow]);
    await stubCloud(page, { rows, items: { 'qa-c16-pub': BOWL.items, 'qa-c16-1': TUNA_ITEMS }, itemsDelay: 300 });
    await load(page);
    const rec = await ownRecipe(page, BOWL);
    const set = await ev((id) => DB.recipes.setShared(id, { id: 'qa-c16-pub', at: new Date().toISOString() }), rec.id);
    assert.ok(set && set.ok !== false, 'setup: our recipe carries the published id: ' + JSON.stringify(set));
    await reset('food');
    const want = await ev(() => ({ more: t('show_more'), log: t('shr_log'), save: t('shr_save'), mine: t('shr_in_recipes'), report: t('shr_report'), cap: t('shr_src_mine') }));
    const pool = [mineRow(await ev(recOf, rec.id), rows)].concat(community(rows.filter((r) => r.id !== pubRow.id)), await ev(readyMeals));
    const mine = 'mine:' + rec.id;
    let c = await ev(readCard);
    assert.ok(!c.rows.includes(mine), `its published copy suits ${O} alone, so our recipe is not on ${P}'s card: ${JSON.stringify(c.rows)}`);
    assert.ok(!c.rows.includes(pubRow.id), 'and neither is the feed\'s copy');
    assert.deepEqual(c.rows, cardIds(pool, P, 2000).slice(0, 3), `${P}'s card as the pool reads without it`);
    await page.locator(`.view.active #shr-card [data-shr-period="${O}"]`).click();
    c = await ev(readCard);
    assert.deepEqual([c.rows[0], c.srcs[0], c.caps[0]], [mine, 'mine', want.cap], `on ${O}, the period its published copy carries, our recipe is the first row — as our own, «${want.cap}»`);
    assert.ok(!c.rows.includes(pubRow.id), 'and the feed\'s copy is not on the card: the recipe appears ONCE');
    assert.deepEqual(c.rows, cardIds(pool, O, 2000).slice(0, 3), `${O}'s card: our recipe, then the best of the others`);
    const more = await openMore(page);
    assert.deepEqual([group(more, 'mine'), more.rows.includes(pubRow.id)], [[mine], false], '«show more» lists it once, under «' + want.cap + '», and never the feed\'s copy');
    assert.deepEqual(group(more, 'community'), rankIds(rows.filter((r) => r.id !== pubRow.id), O, 2000), 'the other users\' recipes of the period, in rank order');
    await ev(() => closeModal());
    await sheetGone(page);
    // THE DOOR v420 BUILT for one's own row stays shut: should the feed's copy
    // still reach the suggestion sheet (opened directly), it is already in the
    // user's recipes — the save button spent from the start — and nobody
    // reports themselves.
    await ev((r) => openSharedRecipe(r, null, () => {}), pubRow);
    await sheetUp(page, '#shr-log');
    const first = await ev(readSheet);
    assert.deepEqual(first.save, { text: want.mine, disabled: true }, 'the save button is spent from the start: «' + want.mine + '»');
    assert.equal(first.report, null, 'there is no report button on one\'s own recipe');
    assert.deepEqual(first.log, { text: want.log, disabled: false }, 'and «' + want.log + '» is offered as on any row');
    await page.waitForFunction(() => document.querySelectorAll('#modal-root .rec-view [data-qty]').length === 2, null, { timeout: 4000 });
    const s = await ev(readSheet);
    assert.deepEqual(s.save, { text: want.mine, disabled: true }, 'the ingredients arriving do not offer a copy after all');
    assert.equal(s.report, null, 'nor a report');
    await page.locator('#shr-log').click();
    await sheetGone(page);
    assert.deepEqual(await ev(rowsToday), [{ name: BOWL.name, servings: 1, calories: 254, protein: 25.5, carbs: 28, fat: 3, source: 'shared' }], 'logging a serving works as for any row');
    assert.equal(await ev(() => DB.recipes.list().length), 1, 'and nothing was copied into the recipes');
    // Another user's recipe keeps both.
    await ev((r) => openSharedRecipe(r, null, () => {}), rows.find((r) => r.id === 'qa-c16-1'));
    await sheetUp(page, '#shr-log');
    await page.waitForFunction(() => document.querySelectorAll('#modal-root .rec-view [data-qty]').length === 3, null, { timeout: 4000 });
    const other = await ev(readSheet);
    assert.deepEqual(other.save, { text: want.save, disabled: false }, 'another user\'s recipe still offers «' + want.save + '»');
    assert.deepEqual(other.report, { text: want.report, disabled: false }, 'and «' + want.report + '»');
    await ev(() => closeModal());
    await sheetGone(page);
    // «أزل من المشاركة» FROM THE CARD (v421 fixes F1, F3c). The list in memory
    // still holds the copy just withdrawn, and with the marker gone nothing
    // names it as ours: it must leave the card at once, not come back as
    // another user's recipe with «أبلِغ» on it. And the view, drawn again by
    // the withdraw, keeps the «سجّل حصّة» the card opened it with.
    const words = await ev(() => ({ share: t('shr_share'), unshare: t('shr_unshare'), log: t('shr_log') }));
    await reset('food');
    await page.locator(`.view.active #shr-card [data-shr-period="${O}"]`).click();
    await page.locator(cardRow(mine)).click();
    await sheetUp(page, '[data-edit-view]');
    const before = await ev(readSheet);
    assert.deepEqual([before.share && before.share.text, before.actions], [words.unshare, ['log', 'edit', 'share']], 'setup: our published recipe\'s view from the card — «' + words.log + '», «edit», «' + words.unshare + '»');
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, words.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), [pubRow.id], 'setup: withdrawn by its published id');
    assert.deepEqual((await ev(readSheet)).actions, ['log', 'edit', 'share'], 'the view drawn again after the withdraw keeps «' + words.log + '» first');
    await ev(() => closeModal());
    await sheetGone(page);
    await reset('food');
    await page.locator(`.view.active #shr-card [data-shr-period="${O}"]`).click();
    c = await ev(readCard);
    assert.ok(c.rows.includes(mine) && !c.rows.includes(pubRow.id), `the withdrawn copy is not on ${O}'s card as another user's recipe — ours is there, once: ${JSON.stringify(c.rows)}`);
    const after = await openMore(page);
    assert.deepEqual([after.rows.includes(pubRow.id), group(after, 'mine')], [false, [mine]], '«show more» does not list it either');
    await ev(() => closeModal());
    await sheetGone(page);
    await reset('food');
    await page.locator(`.view.active #shr-card [data-shr-period="${P}"]`).click();
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

  // ── AUTOMATIC SHARING (v420) ──────────────────────────────────────────────
  // From here a case opens the engine with account(): the clock is stopped and
  // stepped, the Worker's answers are queued, and `posts` is the page's own
  // record of every request on the page's own timeline. An assertion that
  // nothing was sent always follows a clock.run(): that is when it could have.
  ['(18) a save in the editor: the notice with «أوقِفها», then — when its window ends — exactly ONE request; the marker carries its sig, the list is pulled fresh and the card repainted; an unchanged re-save sends nothing, an edit sends one more for the same sourceId', async (kit) => {
    const { page, ev, reset, worker, clock, answered } = kit;
    await account(kit, { seen: false, freshRows: [ownRow('pub-18', 'QA auto bowl')] });
    await load(page);
    await reset('food');
    const c0 = await ev(readCard);
    assert.ok(c0 && c0.srcs.length && c0.srcs.every((s) => s === 'builtin'), 'setup: no recipe of ours and none of the community — the card holds ready meals alone: ' + JSON.stringify(c0 && c0.rows));
    const want = await ev(() => ({ notice: t('shr_auto_notice'), stop: t('shr_auto_stop') }));
    worker.queue.push(APPROVE('pub-18'));
    const t0 = await ev(pageNow);
    const rec = await editorSave(kit, { draft: dish('QA auto bowl') });
    assert.ok(rec && !rec.shared, 'setup: the recipe is saved, and not shared');
    // The editor's save draws nothing on the Food tab behind it (its onDone
    // is a no-op here): what the card shows later, a repaint put there.
    assert.ok(!(await ev(readCard)).rows.includes('mine:' + rec.id), 'setup: the save itself does not redraw the card');
    // Nothing happens at once: the engine waits DELAY after its trigger.
    await clock.run(DELAY - 100);
    assert.notEqual(await ev(toastText), want.notice, 'no notice before the delay is up');
    assert.equal(await ev(() => DB.prefs.autoShareSeen()), false, 'and nothing is stamped as seen');
    await clock.run(100);
    // THE ONE-TIME NOTICE, before the first request this account sends from here.
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [want.notice, want.stop], 'the notice says what will happen, with «' + want.stop + '» on it');
    // «SEEN» IS WHAT ENDED ON SCREEN, not what was drawn: a notice up for a
    // second and then replaced or hidden (case 28) must come back, so nothing
    // is stamped while it is still up.
    assert.equal(await ev(() => DB.prefs.autoShareSeen()), false, 'while the notice is up it is not yet «seen»: the stamp waits for its window to run out on screen');
    assert.deepEqual(await posts(kit), [], 'and nothing was sent with it');
    // ITS WINDOW: nothing is sent for as long as the notice stays.
    await clock.run(NOTICE - 100);
    assert.deepEqual(await posts(kit), [], `nothing is sent inside the notice's window (${DELAY + NOTICE - 100} ms after the save)`);
    assert.equal(await ev(toastAct), want.stop, 'the notice is still up, «' + want.stop + '» still on offer');
    assert.equal(await ev(() => DB.prefs.autoShareSeen()), false, 'still not «seen» a moment before the window ends');
    assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'and no marker was written');
    await clock.run(100);
    await answered(1, 'when the notice\'s window ends the recipe is sent');
    assert.deepEqual((await posts(kit)).map((at) => at - t0), [DELAY + NOTICE], 'exactly ONE request, at the moment the window ends');
    assert.equal(await ev(() => DB.prefs.autoShareSeen()), true, 'its window run out on screen, the notice is «seen»: the device remembers that it was shown');
    assert.deepEqual([worker.calls[0].mode, worker.calls[0].shareRecipe.sourceId], ['share-recipe', rec.id], 'the share request, for the recipe just saved');
    const mark = await ev(markOf, rec.id);
    assert.ok(mark && mark.id === 'pub-18' && !Number.isNaN(Date.parse(mark.at)), 'the approval wrote the marker: ' + JSON.stringify(mark));
    assert.deepEqual(Object.keys(mark).sort(), ['at', 'id', 'sig'], 'as {id, at, sig}');
    assert.ok(SIG.test(mark.sig), 'the sig is 8 hex characters: ' + mark.sig);
    assert.equal(mark.sig, await ev((id) => shrSig(DB.recipes.list().find((r) => r.id === id)), rec.id), 'and names the content as it was sent');
    // The user's own recipe is a suggestion now: the list is read PAST both
    // caches, and the card alone is drawn — on a Food tab nobody re-rendered —
    // the recipe on it ONCE, as the user's own (v421): the feed's copy of it,
    // pub-18, is left out.
    await page.waitForFunction((id) => !!document.querySelector(`.view.active #shr-card [data-shr-open="mine:${id}"]`), rec.id, { timeout: 3000 }).catch(() => {});
    assert.equal(await ev(() => window.__shr.fresh), 1, 'the community list was pulled fresh, once');
    const c1 = (await ev(readCard)) || { rows: [] };
    assert.deepEqual([c1.rows[0], c1.rows.includes('pub-18')], ['mine:' + rec.id, false], 'and the card was painted, the recipe first on it as the user\'s own, the feed\'s copy left out: ' + JSON.stringify(c1.rows));
    assert.equal(await ev(toastText), '', 'no toast per recipe');
    // AN UNCHANGED RE-SAVE is a write and a trigger — and nothing to send: the
    // marker's sig still names this very content.
    await editorSave(kit, { id: rec.id });
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, worker.calls.length], [1, 1], 'an unchanged re-save sends nothing: the page has asked once in all, and the Worker heard once');
    // AN EDIT moves the content away from that sig: one more request for the
    // same recipe (the server replaces the published copy by its sourceId).
    await stubCloud(page, { rows: [], freshRows: [ownRow('pub-18b', 'QA auto bowl, edited')] });
    worker.queue.push(APPROVE('pub-18b'));
    const t1 = await ev(pageNow);
    await editorSave(kit, { id: rec.id, name: 'QA auto bowl, edited' });
    assert.equal(((await ev(readCard)) || { titles: [] }).titles[0], 'QA auto bowl', 'setup: the edit\'s save draws nothing on the card either');
    await clock.run(DELAY - 100);
    assert.equal((await posts(kit)).length, 1, 'the edit\'s request waits the delay too');
    await clock.run(100);
    assert.notEqual(await ev(toastText), want.notice, 'and there is no second notice: this device showed it once');
    await answered(2, 'an edited recipe is sent again');
    assert.deepEqual((await posts(kit)).slice(1).map((at) => at - t1), [DELAY], 'an edit sends ONE more, the delay after its save');
    assert.deepEqual([worker.calls[1].shareRecipe.sourceId, worker.calls[1].shareRecipe.name], [rec.id, 'QA auto bowl, edited'], 'for the same sourceId, with the new content');
    const mark2 = await ev(markOf, rec.id);
    assert.equal(mark2 && mark2.id, 'pub-18b', 'the marker follows the new copy: ' + JSON.stringify(mark2));
    assert.notEqual(mark2.sig, mark.sig, 'and its sig moved with the content');
    assert.equal(mark2.sig, await ev((id) => shrSig(DB.recipes.list().find((r) => r.id === id)), rec.id), 'to the content as sent');
    // The card is drawn again from the fresh list: the edit's name on its own
    // row — nothing but that repaint drew the Food tab since the save — and the
    // new copy, pub-18b, left out too.
    await page.waitForFunction((n) => { const t = document.querySelector('.view.active #shr-card .shr-row .fig-row-title'); return !!t && t.textContent === n; }, 'QA auto bowl, edited', { timeout: 3000 }).catch(() => {});
    const c2 = (await ev(readCard)) || { rows: [], titles: [] };
    assert.deepEqual([c2.rows[0], c2.titles[0], c2.rows.includes('pub-18b')], ['mine:' + rec.id, 'QA auto bowl, edited', false], 'the card is drawn again from the fresh list: our row with the edit, the new copy left out: ' + JSON.stringify(c2.rows));
    const led = (await ev(ledger)) || {};
    assert.deepEqual([led.uid, led.n, led.day], [UID, 2, await ev(() => todayISO())], 'the device counted both requests, for this account and this day');
    // THE REPLACED COPY (v421, the fixes' review): the server deleted pub-18
    // when the edit replaced it. A list that still holds it — the cache a
    // failed pull falls back to — must not draw it beside the user's own row.
    const stale = await ev((rows) => {
      const keep = SHARED_RECIPES;
      SHARED_RECIPES = cleanSharedRecipes(rows);
      const ids = suggestionPool().map((r) => r.id);
      SHARED_RECIPES = keep;
      return ids;
    }, [ownRow('pub-18', 'QA auto bowl'), ownRow('pub-18b', 'QA auto bowl, edited')]);
    assert.deepEqual([stale.includes('pub-18'), stale.includes('pub-18b'), stale.filter((id) => id === 'mine:' + rec.id).length], [false, false, 1], 'a stale list holding the REPLACED copy and the new one suggests the recipe once, as the user\'s own: ' + JSON.stringify(stale.slice(0, 6)));
  }],

  ['(19) «أوقِفها» inside the window: no request ever, the setting off and Settings showing it; turning it on in Settings sends nothing by itself — the next render of Food does; turned off in Settings while a saved recipe waits, it stays home; a notice the keyboard holds up holds the request too', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, answered } = kit;
    await account(kit, { seen: false });
    await reset('food');
    const want = await ev(() => ({ notice: t('shr_auto_notice'), stop: t('shr_auto_stop'), stopped: t('shr_auto_stopped') }));
    const rec = await editorSave(kit, { draft: dish('QA stopped bowl') });
    await clock.run(DELAY);
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [want.notice, want.stop], 'setup: the notice is up');
    // «أوقِفها», one second before the window ends.
    await clock.run(NOTICE - 1000);
    await page.locator('#toast.show .toast-action').click();
    await page.mouse.move(0, 0);
    assert.equal(await ev(() => DB.prefs.autoShare()), false, '«' + want.stop + '» turns automatic sharing off');
    assert.equal(await ev(toastText), want.stopped, 'and says so');
    // The user ANSWERED the notice: that is «seen» too (the window never ran
    // out on screen), so turning sharing on later shows no second notice.
    assert.equal(await ev(() => DB.prefs.autoShareSeen()), true, '«' + want.stop + '» stamps the notice as seen');
    await clock.run(QUIET * 2);
    assert.deepEqual([await posts(kit), worker.calls.length, await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id)], [[], 0, false],
      'no request, ever: the page sent none, the Worker heard none, and the recipe is not shared');
    // SETTINGS shows it off…
    await reset('settings');
    const radios = () => [...document.querySelectorAll('.view.active [data-auto-share]')].map((b) => [b.dataset.autoShare, b.getAttribute('aria-checked')]);
    assert.deepEqual(await ev(radios), [['1', 'false'], ['0', 'true']], 'the Settings row shows automatic sharing off');
    // …and turning it on there sends nothing by itself.
    await page.locator('.view.active [data-auto-share="1"]').click();
    await page.mouse.move(0, 0);
    assert.deepEqual(await ev(radios), [['1', 'true'], ['0', 'false']], 'setup: turned on again in Settings');
    assert.equal(await ev(() => DB.prefs.autoShare()), true, 'setup: the setting is on');
    await clock.run(QUIET * 2);
    assert.deepEqual(await posts(kit), [], 'turning it on in Settings sends nothing by itself');
    // The next render of Food is what queues the recipe — and the notice, shown
    // once already, is not shown again.
    worker.queue.push(APPROVE('pub-19'));
    const t1 = await ev(pageNow);
    await reset('food');
    await clock.run(DELAY - 100);
    assert.deepEqual(await posts(kit), [], 'the render\'s request waits the delay');
    await clock.run(100);
    assert.notEqual(await ev(toastText), want.notice, 'the notice, shown once on this device, is not shown again');
    await answered(1, 'the next render of Food sends the recipe that was held back');
    assert.deepEqual((await posts(kit)).map((at) => at - t1), [DELAY], 'the next render of Food sends it, the delay after the render');
    assert.equal(worker.calls[0].shareRecipe.sourceId, rec.id, 'the recipe that was held back');
    assert.equal(((await ev(markOf, rec.id)) || {}).id, 'pub-19', 'and it is published');
    // TURNED OFF IN SETTINGS WHILE A RECIPE WAITS TO LEAVE. The setting is read
    // when the request would go, not when the recipe was saved: a recipe saved
    // with sharing on, and the row tapped off before the delay is up, stays home.
    await clock.run(QUIET);
    worker.queue.push(APPROVE('pub-19-late'));
    const late = await editorSave(kit, { draft: dish('QA stopped in Settings') });
    await clock.run(DELAY - 100);
    await reset('settings');
    await page.locator('.view.active [data-auto-share="0"]').click();
    await page.mouse.move(0, 0);
    assert.equal(await ev(() => DB.prefs.autoShare()), false, 'setup: turned off in Settings, 100 ms before the request would leave');
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, worker.calls.length, await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), late.id)], [1, 1, false],
      'turned off in Settings while a saved recipe waits: it is never sent, and not shared');
    // A NOTICE THE KEYBOARD HOLDS UP. A toast with an action does not time out
    // under the keyboard's focus (WCAG 2.2.1), so the notice can outlive its
    // window — and while «أوقِفها» is still on offer nothing is sent under it.
    // The focus gone, the notice runs out, and only then does the recipe leave.
    await ev(wipe);
    await account(kit, { seen: false });
    fresh();
    await reset('food');
    worker.queue.push(APPROVE('pub-19-held'));
    await editorSave(kit, { draft: dish('QA held notice') });
    await clock.run(DELAY);
    await ev(() => document.querySelector('#toast .toast-action').focus());
    await clock.run(NOTICE + QUIET);
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [want.notice, want.stop], 'setup: held by the focus, the notice outlives its window (js/ui.js showToast)');
    assert.deepEqual(await posts(kit), [], 'nothing is sent while «' + want.stop + '» is still on offer');
    await ev(() => document.activeElement.blur());
    await clock.run(NOTICE + GAP);
    await answered(1, 'the focus gone and the notice run out, the recipe is sent');
  }],

  ['(20) nothing is sent — signed out, a session that is not the device\'s account, the setting off, offline, no account id, no configured cloud, a sync not settled, a sync on the wire, a store that failed to load; 2.5 servings, a copy saved from the list, a recipe the user withdrew — and the notice is not spent on any of it; with the gates open exactly the wanted recipes go', async (kit) => {
    const { page, ev, reset, worker, clock, answered } = kit;
    await account(kit, { seen: false, rows: [tunaRow('qa-c20-3')], items: { 'qa-c20-3': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    const want = await ev(() => ({ notice: t('shr_auto_notice'), share: t('shr_share') }));
    // A render of Food (trigger 3), then longer than every wait of the engine.
    const silent = async (what) => {
      await reset('food');
      await clock.run(QUIET);
      assert.deepEqual([await posts(kit), worker.calls.length], [[], 0], what + ': nothing is sent — the page asked nothing, the Worker heard nothing');
      assert.equal(await ev(() => DB.prefs.autoShareSeen()), false, what + ': and the one-time notice was not spent on it');
    };
    // THREE RECIPES IT DOES NOT WANT, with every gate open — and nothing else
    // in the recipes yet, so each render below is about that recipe alone.
    // 2.5 servings: the server keeps whole servings, and would refuse it only
    // after the day's budget was charged for the request.
    await ownRecipe(page, { ...BOWL, name: 'QA half servings', servings: 2.5 });
    await silent('2.5 servings');
    // A copy saved from the community list is someone else's recipe: never
    // published back — not at a render, not when it is saved again in the editor.
    await openRowSheet(page, 'qa-c20-3');
    await page.locator('#shr-save').click();
    await page.mouse.move(0, 0);
    const copy = await ev(() => DB.recipes.list().find((r) => r.name === 'Tuna salad') || null);
    assert.ok(copy && copy.origin === 'shared', 'the saved copy says where it came from — origin: \'shared\': ' + JSON.stringify(copy && Object.keys(copy)));
    await silent('a copy saved from the list');
    await editorSave(kit, { id: copy.id });
    await silent('that copy, saved again in the editor');
    // A recipe the user took out of sharing stays out — after an edit as well.
    const gone = await ownRecipe(page, dish('QA withdrawn bowl'));
    await ev((id) => { DB.recipes.setShared(id, { id: 'pub-20', at: new Date().toISOString(), sig: shrSig(DB.recipes.list().find((r) => r.id === id)) }); }, gone.id);
    await openOwnView(page, gone.id);
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, want.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-20'], 'setup: the user withdrew it');
    await silent('a recipe the user withdrew');
    await editorSave(kit, { id: gone.id, name: 'QA withdrawn bowl, edited' });
    await silent('that recipe, after an edit');
    // A RECIPE WHOSE ROWS ARE NOT ALL ROWS — a null an imported or pulled blob
    // may carry (the validator keeps it): never sent, and never a throw out of
    // the render of Food, whose handlers are bound AFTER the backfill — the
    // water button still logs.
    assert.equal(await ev(() => {
      const b = JSON.parse(DB.exportJSON());
      b.recipes.push({ id: 'qa-c20-null-row', name: 'QA null row', servings: 1, items: [null], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' });
      return DB.importJSON(JSON.stringify(b));
    }), true, 'setup: a backup carrying a recipe with a null row restores');
    assert.deepEqual(await ev(() => (DB.recipes.list().find((r) => r.id === 'qa-c20-null-row') || {}).items), [null], 'setup: and the stored recipe carries that row');
    await silent('a recipe with a null row');
    const water = await ev(() => DB.water.get(todayISO()));
    await page.locator('.view.active [data-add-water="250"]').click();
    assert.equal(await ev(() => DB.water.get(todayISO())), water + 250, 'and the render of Food kept its handlers: the water button still logs');
    await ev(() => DB.recipes.remove('qa-c20-null-row'));
    // A DEPENDENCY THAT THROWS under autoShareWants — a well-formed recipe and
    // DB.recipes.totals replaced by a throw: the render of Food survives it
    // (the backfill is fenced), its handlers are bound, and nothing is sent.
    // A throw out of the render, should the fence be missing, is kept here so
    // that the water button — the defect as the user meets it — is what speaks.
    const whole = await ownRecipe(page, dish('QA well-formed under a throw'));
    await ev(() => { window.__qaTotals = DB.recipes.totals; DB.recipes.totals = () => { throw new Error('qa: totals'); }; });
    try {
      const threw = await reset('food').then(() => null, (e) => String((e && e.message) || e));
      await clock.run(QUIET);
      const cup = await ev(() => DB.water.get(todayISO()));
      await page.locator('.view.active [data-add-water="250"]').click();
      assert.equal(await ev(() => DB.water.get(todayISO())), cup + 250, 'a dependency that throws under the backfill: the render of Food kept its handlers — the water button still logs');
      assert.deepEqual([threw, await posts(kit), worker.calls.length, await ev(() => DB.prefs.autoShareSeen())], [null, [], 0, false], 'nothing escaped the render, and nothing is sent for it — the page asked nothing, the Worker heard nothing, the notice not spent');
    } finally {
      await ev(() => { DB.recipes.totals = window.__qaTotals; delete window.__qaTotals; });
      await ev((id) => DB.recipes.remove(id), whole.id);
    }
    // NINE CLOSED GATES — every one the engine reads before a request (§2, and
    // the review's two: the session must be the account whose recipes are on
    // the device, and a sync on the wire is waited out — case 29 has the wait).
    // Under each, a recipe automatic sharing would send is saved through the
    // editor (trigger 1) — and waits, with the ones saved under the gates
    // before it.
    const gates = [
      ['signed out', () => { Cloud.getSession = async () => null; }, () => { Cloud.getSession = async () => ({ access_token: 'qa-token', user: { id: 'qa-user' } }); }],
      // a duplicate or held device, or another account's session in the tab
      ['a session that is not the account on this device', () => { Cloud.getSession = async () => ({ access_token: 'qa-token', user: { id: 'qa-someone-else' } }); }, () => { Cloud.getSession = async () => ({ access_token: 'qa-token', user: { id: 'qa-user' } }); }],
      ['the setting off', () => { DB.prefs.setAutoShare(false); }, () => { DB.prefs.setAutoShare(true); }],
      ['offline', () => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); }, () => { delete navigator.onLine; }],
      ['a session with no account id', () => { window.__qaUid = null; }, () => { window.__qaUid = 'qa-user'; }],
      ['a cloud that is not configured', () => { Cloud.configured = () => false; }, () => { Cloud.configured = () => true; }],
      ['the first sync not settled yet', () => { Cloud.isSettled = () => false; }, () => { Cloud.isSettled = () => true; }],
      ['a sync on the wire', () => { qaCloud.status = 'syncing'; }, () => { qaCloud.status = 'pending'; }],
      ['a store that failed to load (READ-ONLY)', () => { window.__qaLoadFailed = DB.loadFailed; DB.loadFailed = () => true; }, () => { DB.loadFailed = window.__qaLoadFailed; delete window.__qaLoadFailed; }],
    ];
    const wanted = [];
    for (const [what, close, open] of gates) {
      await ev(close);
      wanted.push((await editorSave(kit, { draft: dish('QA gate: ' + what) })).id);
      await silent(what);
      await ev(open);
    }
    assert.equal(await ev(() => navigator.onLine), true, 'setup: online again');
    // THE CONTROL — the same engine, the same recipes, every gate open: the
    // notice it never spent comes first, then exactly the recipes saved under
    // the gates are sent — one each — and none of the other three.
    wanted.forEach((_, i) => worker.queue.push(APPROVE('pub-20-' + i)));
    await reset('food');
    await clock.run(DELAY);
    assert.equal(await ev(toastText), want.notice, 'the control: with the gates open the notice comes');
    await clock.run(NOTICE);
    for (let i = 1; i <= wanted.length; i++) {
      await answered(i, `the control: wanted recipe ${i} of ${wanted.length} is sent`);
      await clock.run(GAP);
    }
    await clock.run(QUIET);
    assert.deepEqual(worker.calls.map((c) => c.shareRecipe.sourceId).sort(), wanted.slice().sort(),
      'the control: one request for each recipe saved under a closed gate and no other — not the 2.5 servings, the copy or the withdrawn one: ' + JSON.stringify(worker.calls.map((c) => c.shareRecipe.name)));
  }],

  ['(21) a rejection is remembered: the next renders of Food do not send the recipe again, and nothing is said about it; after an edit it is sent again; a save right after an answer waits out the gap', async (kit) => {
    const { page, ev, reset, worker, clock, answered } = kit;
    await account(kit);
    const rec = await ownRecipe(page, dish('QA rejected bowl'));
    worker.queue.push({ status: 200, body: { verdict: 'reject', reason: 'personal_data' } });
    await reset('food');
    await clock.run(DELAY);
    await answered(1, 'a render of Food sends the recipe that is not published yet');
    assert.equal(worker.calls[0].shareRecipe.sourceId, rec.id, 'the render of Food sent that recipe');
    assert.equal(await ev((id) => 'shared' in DB.recipes.list().find((r) => r.id === id), rec.id), false, 'a rejected recipe gets no marker');
    assert.equal(await ev(toastText), '', 'and the review\'s answer raises no toast');
    const sig = await ev((id) => shrSig(DB.recipes.list().find((r) => r.id === id)), rec.id);
    const tried = ((await ev(ledger)) || {}).tried || {};
    assert.deepEqual(tried[rec.id] && [tried[rec.id].sig, tried[rec.id].reason], [sig, 'personal_data'], 'the device remembers which content was refused, and why: ' + JSON.stringify(tried));
    for (let i = 0; i < 2; i++) { await reset('food'); await clock.run(QUIET); }
    assert.deepEqual([(await posts(kit)).length, worker.calls.length], [1, 1], 'the next renders of Food do not send the same content again: the page has asked once in all, and the Worker heard once');
    // After an edit it is other content, and the review is asked again.
    worker.queue.push(APPROVE('pub-21'));
    await editorSave(kit, { id: rec.id, name: 'QA rejected bowl, fixed' });
    await clock.run(DELAY);
    await answered(2, 'after an edit the recipe is sent again');
    assert.deepEqual([worker.calls[1].shareRecipe.sourceId, worker.calls[1].shareRecipe.name], [rec.id, 'QA rejected bowl, fixed'], 'the same recipe, as it reads NOW — the queue holds ids, never a copy of the recipe');
    assert.equal(((await ev(markOf, rec.id)) || {}).id, 'pub-21', 'and it is published');
    // A SAVE RIGHT AFTER AN ANSWER waits out the gap: two requests are never
    // closer than GAP, whichever trigger asks for the second.
    worker.queue.push(APPROVE('pub-21-b'));
    const t2 = await ev(pageNow);
    await editorSave(kit, { id: rec.id, name: 'QA rejected bowl, fixed twice' });
    await clock.run(GAP - 100);
    assert.equal((await posts(kit)).length, 2, 'a recipe saved right after an answer does not leave the delay later: the gap after that answer holds for it too');
    await clock.run(100);
    await answered(3, 'the gap over, the new edit is sent');
    assert.deepEqual((await posts(kit)).slice(2).map((at) => at - t2), [GAP], 'exactly a gap after the answer before it');
  }],

  ['(22) «the daily limit» stops the queue — the recipes behind it are not sent — and a later render inside the pause sends nothing; the AI budget\'s 429 does the same, and the app opened again still waits', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, answered, reboot } = kit;
    await account(kit);
    for (const n of ['QA limit one', 'QA limit two', 'QA limit three']) await ownRecipe(page, dish(n));
    // THE DATABASE'S OWN CAP: 200 {verdict: 'refused', reason: 'daily_limit'}.
    worker.queue.push({ status: 200, body: { verdict: 'refused', reason: 'daily_limit' } }, APPROVE('pub-22-a'), APPROVE('pub-22-b'));
    await reset('food');
    await clock.run(DELAY);
    await answered(1, 'setup: the first of the three is sent, and refused');
    const at = (await posts(kit))[0];
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, await ev(() => DB.recipes.list().filter((r) => r.shared).length)], [1, 0], 'the two recipes behind the refused one are not sent, and nothing is published');
    assert.equal(((await ev(ledger)) || {}).until, at + PAUSE, 'the device remembers a pause of six hours from the answer');
    await reset('food');
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, worker.calls.length], [1, 1], 'a later render of Food inside the pause sends nothing: the Worker heard the one refused request and no other');
    // THE AI'S DAY BUDGET: 429 {code: 'DAILY_LIMIT'} — a throw this time, the
    // same answer. A device with a clean ledger, the same three recipes.
    await account(kit);
    fresh();
    worker.queue.push({ status: 429, body: { error: 'daily limit', code: 'DAILY_LIMIT' } }, APPROVE('pub-22-c'), APPROVE('pub-22-d'));
    await reset('food');
    await clock.run(DELAY);
    await answered(1, 'setup: the first of the three is sent, and answered 429');
    const at2 = (await posts(kit))[0];
    await clock.run(QUIET);
    assert.equal((await posts(kit)).length, 1, 'the AI budget\'s 429 stops the queue too: the two recipes behind it are not sent');
    await reset('food');
    await clock.run(QUIET);
    assert.equal((await posts(kit)).length, 1, 'and a later render of Food sends nothing');
    assert.equal(((await ev(ledger)) || {}).until, at2 + PAUSE, 'the device remembers the same pause, six hours from the answer');
    // THE APP OPENED AGAIN inside the pause: a new page on the same device.
    // Whatever the old page kept in memory is gone; the ledger's pause holds.
    await reboot();
    await account(kit, { keep: true });
    await reset('food');
    await editorSave(kit, { draft: dish('QA limit four') });
    await clock.run(QUIET);
    assert.deepEqual([await posts(kit), worker.calls.length, await ev(() => DB.recipes.list().filter((r) => r.shared).length)], [[], 1, 0],
      'opened again inside the pause, the app sends nothing — not for a render, not for a save: the Worker heard the one 429 and no other, and nothing is published');
  }],

  ['(23) the backfill: a render of Food sends what is not published yet ONE AT A TIME — never two in flight, a gap after every answer — and at most ' + DAY_MAX + ' in a day', async (kit) => {
    const { ev, reset, worker, clock, sent, answered, letGo } = kit;
    await account(kit);
    const N = DAY_MAX + 2;
    const ids = await ev((n) => {
      const out = [];
      for (let i = 1; i <= n; i++) out.push(DB.recipes.add({ name: 'QA backfill ' + i, servings: 2, items: [{ name: 'Rice', qty: '200 g', calories: 260 + i, protein: 5, carbs: 56, fat: 1 }] }).id);
      return out;
    }, N);
    // The first answer is HELD: that request is in flight for as long as this
    // case says, whatever the machine's speed.
    worker.queue.push(APPROVE('pub-23-1', { gate: true }));
    for (let i = 2; i <= N; i++) worker.queue.push(APPROVE('pub-23-' + i));
    const t0 = await ev(pageNow);
    await reset('food');
    await clock.run(DELAY - 100);
    assert.deepEqual(await posts(kit), [], 'nothing before the delay');
    await clock.run(100);
    await sent(1, 'the delay over, the render\'s first recipe is sent');
    // IN FLIGHT. Food is rendered again — another trigger — and the clock runs
    // far past every wait of the engine: nothing leaves until the answer is in.
    await reset('food');
    await clock.run(QUIET);
    assert.deepEqual((await posts(kit)).map((at) => at - t0), [DELAY], 'one request, and no second one while it is in flight');
    assert.equal(worker.inflight, 1, 'setup: the first request is still unanswered');
    letGo();
    await answered(1, 'setup: the held answer arrives');
    // THE GAP runs from the ANSWER: the next recipe leaves GAP after it, no sooner.
    for (let i = 2; i <= DAY_MAX; i++) {
      await clock.run(GAP - 100);
      assert.equal((await posts(kit)).length, i - 1, `request ${i} waits out the gap after answer ${i - 1}`);
      await clock.run(100);
      await answered(i, `the gap over, request ${i} of the day leaves`);
    }
    // THE DAY'S CEILING: two recipes are still unpublished, and they wait.
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, worker.calls.length, worker.most], [DAY_MAX, DAY_MAX, 1],
      `${DAY_MAX} requests in the day and no more, with ${N} recipes to publish — as many as the Worker heard, never two of them in flight`);
    const asked = worker.calls.map((c) => c.shareRecipe.sourceId);
    assert.ok(new Set(asked).size === DAY_MAX && asked.every((id) => ids.includes(id)), 'each recipe once: ' + JSON.stringify(worker.calls.map((c) => c.shareRecipe.name)));
    assert.equal(await ev(() => DB.recipes.list().filter((r) => r.shared).length), DAY_MAX, `${DAY_MAX} are published; the other two wait for tomorrow`);
    const led = (await ev(ledger)) || {};
    assert.deepEqual([led.uid, led.n, led.day], [UID, DAY_MAX, await ev(() => todayISO())], 'the device counted them, for this account and this day');
    await reset('food');
    await clock.run(QUIET);
    assert.equal((await posts(kit)).length, DAY_MAX, 'another render the same day sends nothing more');
  }],

  ['(24) an account change while the request is in flight: its answer writes no marker, pulls nothing and withdraws nothing, and the queue stops; a refusal that arrives after it pauses nobody', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, sent, answered, letGo } = kit;
    await account(kit);
    await ownRecipe(page, dish('QA other account bowl'));
    await ownRecipe(page, dish('QA other account bowl two'));
    worker.queue.push(APPROVE('pub-24', { gate: true }), APPROVE('pub-24-b'), APPROVE('pub-24-c'));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the first recipe is sent, its answer held');
    // Another account signs in on this phone while the review runs.
    await ev(() => { window.__qaUid = 'qa-someone-else'; });
    letGo();
    await answered(1, 'setup: the held approval arrives');
    assert.equal(await ev(() => DB.recipes.list().filter((r) => r.shared).length), 0, 'the approval writes no marker into what is another account\'s data by now');
    await clock.run(QUIET);
    assert.equal((await posts(kit)).length, 1, 'and the queue stops: the second recipe is not sent in the other account\'s name');
    assert.equal(await ev(() => window.__shr.fresh), 0, 'nothing is pulled for it');
    assert.deepEqual(await ev(() => window.__shr.withdraw), [], 'and nothing is withdrawn in the other account\'s name');
    const led = (await ev(ledger)) || {};
    assert.deepEqual([led.uid, led.n], [UID, 1], 'the device ledger is still the first account\'s, its one request counted');
    // THE CONTROL: the same engine, the account unchanged through the request.
    await ev((uid) => { window.__qaUid = uid; }, UID);
    await reset('food');
    await clock.run(DELAY);
    await answered(2, 'the control: back on the first account, a render of Food sends again');
    assert.equal(await ev(() => DB.recipes.list().filter((r) => r.shared).length), 1, 'the control: with the account unchanged the approval does write its marker');
    // A REFUSAL that arrives after the change writes nothing either: the day's
    // budget answering 429 would otherwise pause the OTHER account's device.
    await account(kit);
    fresh();
    worker.queue.push({ status: 429, body: { error: 'daily limit', code: 'DAILY_LIMIT' }, gate: true });
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the recipe still unpublished is sent, its answer held');
    await ev(() => { window.__qaUid = 'qa-someone-else'; });
    letGo();
    await answered(1, 'setup: the held 429 arrives');
    await clock.run(QUIET);
    const led2 = (await ev(ledger)) || {};
    assert.deepEqual([led2.uid, led2.n, led2.until], [UID, 1, 0], 'a «daily limit» that arrives after the account changed pauses nobody: the ledger is still the first account\'s, with no pause in it');
  }],

  ['(25) Settings: «Sharing my recipes» is the first row of its group — a hint that tells the truth in both states, and two radios that say and set the state — and it fits at 375 and 320, in both states, with and without «Larger text»', async ({ page, ev, reset }) => {
    await reset('settings');
    const want = await ev(() => ({ group: t('set_g_data'), title: t('shr_auto'), hint: t('shr_auto_sub'), hintOff: t('shr_auto_off_sub'), on: t('shr_auto_on'), off: t('shr_auto_off') }));
    const readRow = () => {
      const group = [...document.querySelectorAll('.view.active .settings-group')].find((g) => g.querySelector('[data-auto-share]'));
      if (!group) return null;
      const sec = group.querySelector('.settings-section');   // the group's FIRST row
      const box = sec.querySelector('.unit-toggle');
      return {
        group: ((group.querySelector('.settings-group-title') || {}).textContent || '').trim(),
        first: !!sec.querySelector('[data-auto-share]'),
        title: ((sec.querySelector('.section-title') || {}).textContent || '').trim(),
        hints: [...sec.querySelectorAll('p.settings-hint')].map((p) => p.textContent.trim()),
        role: box && box.getAttribute('role'), label: box && box.getAttribute('aria-label'),
        radios: [...sec.querySelectorAll('.unit-toggle > .unit-option')].map((b) => ({ v: b.dataset.autoShare, role: b.getAttribute('role'), checked: b.getAttribute('aria-checked'), active: b.classList.contains('active'), text: b.textContent.trim() })),
        all: document.querySelectorAll('.view.active [data-auto-share]').length,
      };
    };
    const r = await ev(readRow);
    assert.ok(r, 'the row is on the Settings screen');
    assert.equal(r.group, want.group, 'in the «' + want.group + '» group');
    assert.equal(r.first, true, 'as that group\'s first row');
    assert.equal(r.title, want.title, 'titled «' + want.title + '»');
    assert.deepEqual(r.hints, [want.hint], 'one hint, saying what automatic sharing does');
    assert.deepEqual([r.role, r.label], ['radiogroup', want.title], 'a radiogroup, named like its title');
    assert.deepEqual(r.radios, [{ v: '1', role: 'radio', checked: 'true', active: true, text: want.on }, { v: '0', role: 'radio', checked: 'false', active: false, text: want.off }], 'two radios: «' + want.on + '» first and chosen — the default — then «' + want.off + '»');
    assert.equal(r.all, 2, 'and no second copy of the control');
    await page.locator('.view.active [data-auto-share="0"]').click();
    assert.deepEqual((await ev(readRow)).radios.map((x) => [x.v, x.checked, x.active]), [['1', 'false', false], ['0', 'true', true]], '«' + want.off + '» chosen: the row says so');
    assert.equal(await ev(() => DB.prefs.autoShare()), false, 'and the setting is stored off');
    // THE HINT TELLS THE TRUTH IN BOTH STATES: off, it says new recipes are not
    // published and what is published stays until «أزل من المشاركة» — the
    // on-state sentence would be false for the one and silent about the other.
    assert.deepEqual((await ev(readRow)).hints, [want.hintOff], 'with «' + want.off + '» chosen the one hint reads «' + want.hintOff + '»');
    assert.notEqual(want.hintOff, want.hint, 'setup: the two hints differ');
    await page.locator('.view.active [data-auto-share="1"]').click();
    assert.deepEqual((await ev(readRow)).radios.map((x) => [x.v, x.checked, x.active]), [['1', 'true', true], ['0', 'false', false]], '«' + want.on + '» chosen again');
    assert.equal(await ev(() => DB.prefs.autoShare()), true, 'and stored on');
    assert.deepEqual((await ev(readRow)).hints, [want.hint], 'and the hint is the on-state one again');
    // The row fits in BOTH states: the off hint is the longer sentence.
    try {
      for (const on of [true, false]) {
        await ev((on) => DB.prefs.setAutoShare(on), on);
        for (const width of [375, 320]) {
          await page.setViewportSize({ width, height: 812 });
          await reset('settings');
          for (const lg of [false, true]) {
            const g = await ev((lg) => {
              document.body.classList.toggle('text-lg', lg);
              const sec = document.querySelector('.view.active [data-auto-share]').closest('.settings-section');
              const hint = sec.querySelector('p.settings-hint'), opts = [...sec.querySelectorAll('.unit-option')];
              const box = (el) => el.getBoundingClientRect();
              const out = {
                hint: hint.textContent.trim(),
                spill: opts.filter((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).map((b) => `${b.dataset.autoShare} ${b.scrollWidth}x${b.scrollHeight} in ${b.clientWidth}x${b.clientHeight}`),
                heights: opts.map((b) => Math.round(box(b).height)),
                oneRow: new Set(opts.map((b) => Math.round(box(b).top))).size === 1,
                hintIn: box(hint).left >= box(sec).left - 1 && box(hint).right <= box(sec).right + 1 && hint.scrollWidth <= hint.clientWidth + 1,
                secSpill: sec.scrollWidth > sec.clientWidth + 1,
                inView: box(sec).left >= 0 && box(sec).right <= window.innerWidth + 1,
                pageSpill: document.documentElement.scrollWidth > window.innerWidth + 1,
              };
              document.body.classList.remove('text-lg');
              return out;
            }, lg);
            const where = `${width}px${lg ? ' + larger text' : ''}, sharing ${on ? 'on' : 'off'}`;
            assert.equal(g.hint, on ? want.hint : want.hintOff, `the hint for that state at ${where}`);
            assert.deepEqual(g.spill, [], `a radio's word overflows its button at ${where}: ${g.spill.join(', ')}`);
            assert.ok(g.heights.length === 2 && g.heights.every((h) => h === 44), `both radios on the M rung (44px) at ${where}: ${g.heights}`);
            assert.equal(g.oneRow, true, `side by side at ${where}`);
            assert.equal(g.hintIn, true, `the hint stays inside its row at ${where}`);
            assert.deepEqual([g.secSpill, g.inView, g.pageSpill], [false, true, false], `the row overflows at ${where}`);
          }
        }
      }
    } finally {
      await page.setViewportSize({ width: 375, height: 812 });
      await ev(() => DB.prefs.setAutoShare(true));
    }
  }],

  // Section 7 of the v420 spec lists 18–25. This one holds what its §2 and §3
  // also promise and no case above reaches: the import chooser's «احفظ الكل»
  // as a trigger of its own, and autoShareHold — an Undo on the recipes slice
  // (10 s) must still work, so nothing is sent and no marker written under it —
  // and, beside it, the notice that waits while any Undo is on the screen.
  ['(26) the other doors: «save all» in the import chooser queues the recipes it made; under an Undo on the recipes — a copy just saved, a recipe just deleted — nothing is sent and no marker is written, and the Undo still works; the one-time notice never takes an Undo\'s place', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, sent, answered, letGo } = kit;
    await account(kit, { rows: [tunaRow('qa-c26-3')], items: { 'qa-c26-3': TUNA_ITEMS } });
    await load(page);
    await reset('food');
    const want = await ev(() => ({ undo: t('undo'), saved: t('shr_saved'), deleted: t('rec_deleted'), undone: t('updated') }));
    // «احفظ الكل»: the chooser saves every dish it holds, and Food is not
    // rendered again — only that tap can have queued them.
    worker.queue.push(APPROVE('pub-26-a'), APPROVE('pub-26-b'));
    await ev((d) => openRecipeChooser(null, d, () => {}), [dish('QA import one'), dish('QA import two')]);
    await page.locator('#rx-pick-all').click();
    await page.mouse.move(0, 0);
    const made = await ev(() => DB.recipes.list().map((r) => r.id));
    assert.equal(made.length, 2, 'setup: «save all» saved both dishes');
    await clock.run(DELAY - 100);
    assert.deepEqual(await posts(kit), [], 'the chooser\'s request waits the delay');
    await clock.run(100);
    await answered(1, '«save all» is a trigger: the first dish it saved is sent');
    await clock.run(GAP);
    await answered(2, '«save all» queued every dish it saved: the second is sent a gap later');
    assert.deepEqual(worker.calls.map((c) => c.shareRecipe.sourceId).sort(), made.slice().sort(), '«save all» queued the recipes it made: both are sent');
    await clock.run(QUIET);
    // (a) A REQUEST WAITING TO LEAVE. A third recipe is saved in the editor,
    // and before its delay is up a copy is saved from the list: that Undo is on
    // the recipes slice, and a marker written under it would turn it stale.
    worker.queue.push(APPROVE('pub-26-c'));
    const third = await editorSave(kit, { draft: dish('QA held bowl') });
    await openRowSheet(page, 'qa-c26-3');
    const t1 = await ev(pageNow);
    await page.locator('#shr-save').click();
    await page.mouse.move(0, 0);
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [want.saved, want.undo], 'setup: the copy is saved, its Undo on offer');
    await ev(() => closeModal());
    await clock.run(9000);
    const under = (await posts(kit)).length;
    assert.equal(await ev(toastAct), want.undo, 'setup: 9 s in, the Undo is still on offer');
    await page.locator('#toast.show .toast-action').click();
    await page.mouse.move(0, 0);
    assert.deepEqual([under, await ev(toastText), await ev(() => DB.recipes.list().some((r) => r.name === 'Tuna salad'))], [2, want.undone, false],
      'nothing was sent under the Undo (9 s in), so it answers «' + want.undone + '» — not that the recipes moved under it — and takes the copy back');
    await clock.run(HOLD - 9000 - 100);
    assert.equal((await posts(kit)).length, 2, `the engine waits ${HOLD} ms from the save`);
    await clock.run(100);
    await answered(3, 'the hold over, the waiting recipe is sent');
    assert.deepEqual((await posts(kit)).slice(2).map((at) => at - t1), [HOLD], `exactly ${HOLD} ms after the copy was saved`);
    assert.equal(((await ev(markOf, third.id)) || {}).id, 'pub-26-c', 'and it is published');
    await clock.run(QUIET);
    // (b) A REQUEST ALREADY IN FLIGHT when an Undo is offered: its approval
    // arrives under the Undo and waits for it before writing the marker.
    worker.queue.push(APPROVE('pub-26-d', { gate: true }));
    const fourth = await ownRecipe(page, dish('QA in flight bowl'));
    await reset('food');
    await clock.run(DELAY);
    await sent(4, 'setup: the fourth recipe is sent, its answer held');
    await ev(() => openSavedFoodPicker(todayISO(), () => {}, 'recipes'));
    await sheetUp(page, `[data-del-rec="${made[0]}"]`);
    await page.locator(`#modal-root [data-del-rec="${made[0]}"]`).click();
    await page.waitForFunction(() => !!document.querySelector('#modal-root .confirm-dialog'), null, { timeout: 3000 });
    await page.locator('#modal-root .confirm-dialog [data-ok]').click();
    await page.mouse.move(0, 0);
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [want.deleted, want.undo], 'setup: a recipe is deleted, its Undo on offer');
    assert.equal(await ev((id) => DB.recipes.list().some((r) => r.id === id), made[0]), false, 'setup: it is gone');
    await ev(() => closeModal());
    letGo();
    await answered(4, 'setup: the held approval arrives, under the Undo');
    assert.equal(await ev(markOf, fourth.id), null, 'the approval that arrived under the Undo has written no marker');
    await clock.run(9000);
    const early = await ev(markOf, fourth.id);
    await page.locator('#toast.show .toast-action').click();
    await page.mouse.move(0, 0);
    assert.deepEqual([early, await ev(toastText), await ev((id) => DB.recipes.list().some((r) => r.id === id), made[0])], [null, want.undone, true],
      'nor 9 s in — so the delete\'s Undo answers «' + want.undone + '» too, and brings the recipe back');
    await clock.run(HOLD - 9000 - 100);
    assert.equal(await ev(markOf, fourth.id), null, `the marker waits ${HOLD} ms from the delete`);
    await clock.run(100);
    await page.waitForFunction((id) => { const r = DB.recipes.list().find((x) => x.id === id); return !!(r && r.shared); }, fourth.id, { timeout: 3000 }).catch(() => {});
    assert.equal(((await ev(markOf, fourth.id)) || {}).id, 'pub-26-d', 'and then it is written');
    // (c) THE ONE-TIME NOTICE NEVER TAKES AN UNDO'S PLACE. A device that has not
    // shown it yet; a recipe is saved, and a serving logged from the list before
    // the delay is up — that Undo (10 s, on the food log: no hold) is on screen
    // when the notice is due. The notice waits its turn, and comes after it.
    await ev(wipe);
    await account(kit, { seen: false, rows: [tunaRow('qa-c26-3')], items: { 'qa-c26-3': TUNA_ITEMS } });
    fresh();
    await load(page);
    await reset('food');
    const say = await ev(() => ({ notice: t('shr_auto_notice'), stop: t('shr_auto_stop'), logged: t('rec_logged').replace('{name}', 'Tuna salad') }));
    worker.queue.push(APPROVE('pub-26-e'));
    await editorSave(kit, { draft: dish('QA behind an Undo') });
    await openRowSheet(page, 'qa-c26-3');
    await page.locator('#shr-log').click();
    await sheetGone(page);
    await page.mouse.move(0, 0);
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [say.logged, want.undo], 'setup: a serving is logged, its Undo on offer');
    await clock.run(DELAY);
    assert.deepEqual([await ev(toastText), await ev(toastAct), await ev(() => DB.prefs.autoShareSeen())], [say.logged, want.undo, false],
      'the notice is due, and an Undo is on screen: the Undo stays, and the notice is not spent');
    await clock.run(10000 - DELAY + GAP);
    assert.deepEqual([await ev(toastText), await ev(toastAct), await posts(kit)], [say.notice, say.stop, []], 'the Undo gone, the notice comes — before anything is sent');
    await clock.run(NOTICE);
    await answered(1, 'the notice shown and its window over, the recipe is sent');
  }],

  // Also beyond section 7's list: the answers §2 names that no case above
  // meets, and what a review meets when the recipe changed under it. Every
  // part is a device with a clean engine; the first five have three recipes
  // each, so «the recipes behind it» always exist.
  ['(27) the other answers: «blocked» is remembered and stops the session; the cap on held recipes, «unavailable» and a failed request stop it and remember nothing; a rate limit is waited out once and the same recipe goes again; an approval for a recipe withdrawn or deleted meanwhile writes no marker and its copy comes down; an edit made during the review is sent after it', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, sent, answered, letGo } = kit;
    const want = await ev(() => ({ share: t('shr_share') }));
    // A device that never shared, three unpublished recipes, the first answer
    // as given and approvals behind it; Food is rendered and the first request
    // answered. Answers the id of the recipe that was sent.
    const firstAnswer = async (px, answer, what) => {
      await ev(wipe);
      await account(kit);
      fresh();
      for (const n of ['one', 'two', 'three']) await ownRecipe(page, dish(`QA ${px} ${n}`));
      worker.queue.push(answer, APPROVE('pub-27-' + px + '-b'), APPROVE('pub-27-' + px + '-c'));
      await reset('food');
      await clock.run(DELAY);
      await answered(1, 'setup: the first recipe is sent, and ' + what);
      return worker.calls[0].shareRecipe.sourceId;
    };
    // Is anything else sent — the recipes behind it, or at a later render of Food?
    const afterwards = async () => {
      await clock.run(QUIET);
      await reset('food');
      await clock.run(QUIET);
      return [(await posts(kit)).length, worker.calls.length];
    };
    // «BLOCKED»: the account may not share. That content is not sent again, and
    // nothing else is asked until the app is opened again.
    const blocked = await firstAnswer('blocked', { status: 200, body: { verdict: 'refused', reason: 'blocked' } }, 'the account is «blocked»');
    assert.deepEqual(await afterwards(), [1, 1], '«blocked» stops automatic sharing for the session: not the recipes behind it, not a later render of Food');
    let led = (await ev(ledger)) || {};
    assert.deepEqual([Object.keys(led.tried || {}), ((led.tried || {})[blocked] || {}).reason, led.until], [[blocked], 'blocked', 0], 'the refused recipe is remembered with its reason, and no pause is stored: ' + JSON.stringify(led));
    // THE CAP ON HELD RECIPES, and «unavailable»: the session stops, and the
    // device remembers nothing — neither is about that one recipe, or about today.
    for (const reason of ['active_limit', 'unavailable']) {
      await firstAnswer(reason.replace('_', '-'), { status: 200, body: { verdict: 'refused', reason } }, 'refused as «' + reason + '»');
      assert.deepEqual(await afterwards(), [1, 1], `«${reason}» stops automatic sharing for the session too`);
      led = (await ev(ledger)) || {};
      assert.deepEqual([Object.keys(led.tried || {}), led.until], [[], 0], `and nothing is remembered for «${reason}» — no recipe refused, no pause: ` + JSON.stringify(led));
    }
    // A REQUEST THAT FAILS (the Worker answers 500): no second try, the same stop.
    await firstAnswer('failed', { status: 500, body: { error: 'upstream' } }, 'the request fails');
    assert.deepEqual(await afterwards(), [1, 1], 'a request that fails stops automatic sharing for the session: it is not tried again, and the recipes behind it wait');
    led = (await ev(ledger)) || {};
    assert.deepEqual([Object.keys(led.tried || {}), led.until], [[], 0], 'and a failure is not remembered as a refusal or a pause: ' + JSON.stringify(led));
    // «TRY AGAIN IN A MINUTE» (429 without the day's code) is waited out — ONCE
    // per opening of the app — and the SAME recipe goes again.
    const busy = await firstAnswer('busy', { status: 429, body: { error: 'rate limited' } }, 'the Worker is busy');
    worker.queue.splice(1, 0, { status: 429, body: { error: 'rate limited' } });   // approve · busy again · approve
    const tBusy = (await posts(kit))[0];
    await clock.run(RETRY - 100);
    assert.equal((await posts(kit)).length, 1, 'a rate limit is waited out: nothing for the minute it asks for, not even the recipes behind it');
    await clock.run(100);
    await answered(2, 'the minute over, automatic sharing asks again');
    assert.deepEqual([worker.calls[1].shareRecipe.sourceId, (await posts(kit))[1] - tBusy], [busy, RETRY], 'the SAME recipe, a minute after the busy answer');
    await clock.run(GAP);
    await answered(3, 'setup: the next recipe is sent, and the Worker is busy again');
    await clock.run(RETRY);
    assert.deepEqual(await afterwards(), [3, 3], 'a second rate limit is not waited out: one wait per opening of the app, then it stops');
    // AN APPROVAL FOR A RECIPE THE USER WITHDREW WHILE IT WAS REVIEWED. The
    // recipe was published, then edited — so it is sent again — and during that
    // review the user takes it out of sharing. Their answer stands: no marker,
    // and the copy the approval just published comes down as well.
    await ev(wipe);
    await account(kit, { withdraw: { ok: true } });
    fresh();
    const rec = await ownRecipe(page, dish('QA withdrawn in review'));
    await ev((id) => { DB.recipes.setShared(id, { id: 'pub-27-old', at: new Date().toISOString(), sig: '00000000' }); }, rec.id);
    worker.queue.push(APPROVE('pub-27-new', { gate: true }));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the edited recipe is sent again, its answer held');
    await openOwnView(page, rec.id);
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, want.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-27-old'], 'setup: the user withdrew the published copy while the new one was reviewed');
    await ev(() => closeModal());
    letGo();
    await answered(1, 'setup: the held approval arrives');
    await page.waitForFunction(() => window.__shr.withdraw.length > 1, null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await ev((id) => { const r = DB.recipes.list().find((x) => x.id === id); return [r.shared || null, r.noAuto]; }, rec.id), [null, true], 'an approval for a recipe the user withdrew meanwhile writes no marker: their answer stands');
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-27-old', 'pub-27-new'], 'and the copy that approval just published is taken down too');
    // A RECIPE DELETED WHILE IT WAS REVIEWED: its marker cannot be written, and
    // a copy no marker points at could never be withdrawn from the app — so it
    // is taken down at once, and the queue goes on to the next recipe.
    await ev(wipe);
    await account(kit, { withdraw: { ok: true } });
    fresh();
    const doomed = await ownRecipe(page, dish('QA deleted in review'));
    await ownRecipe(page, dish('QA behind the deleted one'));
    worker.queue.push(APPROVE('pub-27-doomed', { gate: true }), APPROVE('pub-27-behind'));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the first recipe is sent, its answer held');
    assert.equal(worker.calls[0].shareRecipe.sourceId, doomed.id, 'setup: it is the recipe about to be deleted');
    await ev((id) => { DB.recipes.remove(id); }, doomed.id);
    letGo();
    await answered(1, 'setup: the held approval arrives');
    await page.waitForFunction(() => window.__shr.withdraw.length > 0, null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-27-doomed'], 'a marker that cannot be written — the recipe was deleted meanwhile — takes the published copy down');
    await clock.run(GAP);
    await answered(2, 'and the queue goes on: the recipe behind it is sent a gap later');
    // AN EDIT MADE WHILE THE REVIEW RAN. The marker names the content AS SENT —
    // the sig is taken before the request leaves — so the recipe reads as
    // changed since it was published, and the next render of Food sends the edit.
    await ev(wipe);
    await account(kit);
    fresh();
    const live = await ownRecipe(page, dish('QA edited in review'));
    const sigSent = await ev((id) => shrSig(DB.recipes.list().find((r) => r.id === id)), live.id);
    worker.queue.push(APPROVE('pub-27-live', { gate: true }), APPROVE('pub-27-live-2'));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the recipe is sent, its answer held');
    await ev((id) => { DB.recipes.update(id, { name: 'QA edited in review, since' }); }, live.id);
    letGo();
    await answered(1, 'setup: the held approval arrives');
    assert.equal(((await ev(markOf, live.id)) || {}).sig, sigSent, 'an edit made during the review: the marker names the content as it was SENT, not as it reads now');
    await clock.run(QUIET);
    await reset('food');
    await clock.run(DELAY);
    await answered(2, 'so the next render of Food sends the edit');
    assert.equal(worker.calls[1].shareRecipe.name, 'QA edited in review, since', 'as the recipe reads now');
  }],
  // ── THE REVIEW OF v420 ───────────────────────────────────────────────────
  // (finding 8) «seen» used to be stamped the moment the notice was DRAWN, so
  // any other toast, a tab switch or a hidden page took it away for good and
  // the recipes went anyway. It is seen only once it ENDED on screen now: a
  // displaced notice comes back, nothing is sent until one has run its whole
  // window with the page visible, and under a hidden page it is not raised.
  ['(28) a displaced notice is not spent: hidden by a navigation or replaced by another toast it comes back, and the request leaves only after a full window on screen; under a hidden page it is raised only once the page is visible again', async (kit) => {
    const { ev, reset, worker, fresh, clock, answered } = kit;
    const want = await ev(() => ({ notice: t('shr_auto_notice'), stop: t('shr_auto_stop') }));
    const seen = () => ev(() => DB.prefs.autoShareSeen());
    const noticeUp = async () => [await ev(toastText), await ev(toastAct)];
    // When the notice on screen was raised — the engine's own record, read only.
    const raisedAt = () => ev(() => __autoNoticeAt);
    // (a) A NAVIGATION one second in: navigate() hides every toast.
    await account(kit, { seen: false });
    await reset('food');
    worker.queue.push(APPROVE('pub-28-a'));
    await editorSave(kit, { draft: dish('QA displaced by a tab') });
    await clock.run(DELAY);
    assert.deepEqual(await noticeUp(), [want.notice, want.stop], 'setup: the notice is up');
    await clock.run(1000);
    await ev(() => navigate('home'));
    assert.equal(await ev(toastAct), '', 'setup: the navigation took the notice down');
    await clock.run(1000);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.notice, want.stop], false, []], 'within a second the notice is back — not spent, and nothing was sent');
    const backA = await raisedAt();
    await clock.run(NOTICE - 1000);
    assert.deepEqual([await posts(kit), await seen(), await ev(toastAct)], [[], false, want.stop], 'its window counts from its RETURN: a second before that ends nothing is sent, and «' + want.stop + '» is still on offer');
    await clock.run(1000);
    await answered(1, 'a full window on screen later, the recipe is sent');
    assert.deepEqual([(await posts(kit)).map((at) => at - backA), await seen()], [[NOTICE], true], 'exactly a full window after it came back — and only then is it seen');
    // (b) ANOTHER TOAST two seconds in: showToast rewrites the one element.
    await ev(wipe);
    await account(kit, { seen: false });
    fresh();
    await reset('food');
    worker.queue.push(APPROVE('pub-28-b'));
    await editorSave(kit, { draft: dish('QA displaced by a toast') });
    await clock.run(DELAY);
    assert.deepEqual(await noticeUp(), [want.notice, want.stop], 'setup: the notice is up');
    await clock.run(2000);
    await ev(() => showToast('QA another toast'));
    assert.deepEqual(await noticeUp(), ['QA another toast', ''], 'setup: another toast took its place');
    await clock.run(1000);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.notice, want.stop], false, []], 'within a second the notice is back — not spent, nothing sent');
    const backB = await raisedAt();
    await clock.run(NOTICE - 1000);
    assert.deepEqual([await posts(kit), await seen()], [[], false], 'nothing a second before the returned window ends');
    await clock.run(1000);
    await answered(1, 'the returned window over, the recipe is sent');
    assert.deepEqual([(await posts(kit)).map((at) => at - backB), await seen()], [[NOTICE], true], 'exactly a full window after it came back; seen then');
    // (c) THE PAGE HIDDEN — before the notice is due, and then a second into it.
    await ev(wipe);
    await account(kit, { seen: false });
    fresh();
    await reset('food');
    worker.queue.push(APPROVE('pub-28-c'));
    const hide = () => ev(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
    const show = () => ev(() => { delete document.visibilityState; });
    await hide();
    await editorSave(kit, { draft: dish('QA under a hidden page') });
    await clock.run(DELAY + QUIET);
    assert.deepEqual([await ev(toastAct), await seen(), await posts(kit)], ['', false, []], 'hidden before the notice is due: it is not raised, not spent, and nothing is sent — however long the page stays hidden');
    await show();
    await clock.run(GAP);
    assert.deepEqual([await noticeUp(), await seen()], [[want.notice, want.stop], false], 'visible again, the notice comes');
    await clock.run(1000);
    await hide();
    await clock.run(1000);
    assert.deepEqual([await ev(toastText), await seen(), await posts(kit)], ['', false, []], 'hidden a second into the notice: it is taken down — it starts over — and is not spent');
    await clock.run(NOTICE + QUIET);
    assert.deepEqual([await ev(toastText), await seen(), await posts(kit)], ['', false, []], 'and nothing is sent for as long as the page stays hidden');
    await show();
    await clock.run(GAP);
    assert.deepEqual(await noticeUp(), [want.notice, want.stop], 'visible again, the notice is raised again');
    const backC = await raisedAt();
    await clock.run(NOTICE);
    await answered(1, 'and after its full window on screen the recipe is sent');
    assert.deepEqual([(await posts(kit)).map((at) => at - backC), await seen()], [[NOTICE], true], 'a full window after it came back; seen then');
  }],

  // (findings 1 and 6) «أزل من المشاركة» tapped while an automatic re-share of
  // the same recipe is in flight, with the share answered FIRST: the handler
  // marks the recipe «not automatically» BEFORE its request, so the engine's
  // approval takes down the copy it just published instead of writing a marker
  // the handler would then clear without withdrawing. And a sync on the wire
  // HOLDS the queue (the other gates empty it): the request leaves by itself.
  ['(29) «Stop sharing» under a re-share in flight, the share answered first: the engine withdraws the NEW copy, no marker, noAuto set, nothing re-sent; a refused withdraw keeps the marker and lifts noAuto; a sync on the wire holds the queue and the request leaves by itself once it is back', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, sent, answered, letGo } = kit;
    const want = await ev(() => ({ share: t('shr_share'), unshare: t('shr_unshare'), done: t('shr_withdrawn'), network: t('auth_err_network') }));
    // [the marker's id or null, noAuto as stored: true, or 'absent']
    const state = (id) => ev((id) => { const r = DB.recipes.list().find((x) => x.id === id); return [(r.shared || {}).id || null, 'noAuto' in r ? r.noAuto : 'absent']; }, id);
    const viewSays = (s) => page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, s, { timeout: 4000 });
    // (a) The share answered first, the withdraw still open.
    await account(kit, { withdraw: 'deferred' });
    const rec = await ownRecipe(page, dish('QA withdrawn under a re-share'));
    await ev((id) => { DB.recipes.setShared(id, { id: 'pub-29-old', at: new Date().toISOString(), sig: '00000000' }); }, rec.id);
    worker.queue.push(APPROVE('pub-29-new', { gate: true }));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the edited recipe is sent again, its answer held');
    await openOwnView(page, rec.id);
    assert.equal((await ev(readSheet)).share.text, want.unshare, 'setup: the view offers «' + want.unshare + '»');
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction(() => window.__shr.withdraw.length === 1, null, { timeout: 2000 });
    assert.deepEqual([await ev(() => window.__shr.withdraw), await state(rec.id)], [['pub-29-old'], ['pub-29-old', true]], 'the tap asks for the OLD copy to come down, and marks the recipe «not automatically» BEFORE the answer');
    letGo();
    await answered(1, 'setup: the held approval arrives while the withdraw is still open');
    await page.waitForFunction(() => window.__shr.withdraw.length === 2, null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual([await ev(() => window.__shr.withdraw), await state(rec.id)], [['pub-29-old', 'pub-29-new'], ['pub-29-old', true]], 'the approval finds the recipe out of sharing: it writes no marker and takes its NEW copy down');
    // The database answers the first withdraw: nothing of yours by that id (the
    // re-share replaced it) — read as already gone.
    await ev(() => window.__shr.withdrawWaits[0]({ ok: false }));
    await viewSays(want.share);
    assert.deepEqual([await state(rec.id), await ev(toastText)], [[null, true], want.done], 'the withdraw answered: no marker, «not automatically» stands, and the view says it is no longer shared');
    await ev(() => closeModal());
    await clock.run(QUIET);
    await reset('food');
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, worker.calls.length, await ev(() => window.__shr.withdraw)], [1, 1, ['pub-29-old', 'pub-29-new']], 'and nothing is sent again — one request in all, the two withdraws and no other');
    // (b) A withdraw REFUSED with a reason: the copy is still published, so the
    // flag set before the request goes back to what it was.
    await ev(wipe);
    await account(kit, { withdraw: { ok: false, error: 'offline' } });
    fresh();
    const kept = await ownRecipe(page, dish('QA withdraw refused'));
    await ev((id) => { DB.recipes.setShared(id, { id: 'pub-29-kept', at: new Date().toISOString(), sig: '00000000' }); }, kept.id);
    await openOwnView(page, kept.id);
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForTimeout(200);
    assert.deepEqual([await ev(() => window.__shr.withdraw), await state(kept.id), await ev(toastText)], [['pub-29-kept'], ['pub-29-kept', 'absent'], want.network], 'a withdraw refused with a reason (offline): the marker stays, «not automatically» is lifted again, and the view says why');
    assert.equal(await ev((id) => autoShareWants(DB.recipes.list().find((r) => r.id === id)), kept.id), true, 'so automatic sharing still follows that recipe (it reads as edited since it was published)');
    await ev(() => closeModal());
    // (c) A SYNC ON THE WIRE holds the queue: nothing leaves while it lasts, and
    // the request leaves by itself once it is over — no save, no render of Food.
    await ev(wipe);
    await account(kit);
    fresh();
    worker.queue.push(APPROVE('pub-29-sync'));
    await ev(() => { qaCloud.status = 'syncing'; });
    const held = await editorSave(kit, { draft: dish('QA behind a sync') });
    await clock.run(DELAY + QUIET);
    assert.deepEqual([await posts(kit), await ev(() => __autoQueue.length)], [[], 1], 'a sync on the wire: nothing is sent, and the recipe is KEPT in the queue — the other gates empty it');
    await ev(() => { qaCloud.status = 'pending'; });
    await clock.run(GAP);
    await answered(1, 'the sync over, the request leaves by itself');
    assert.equal(worker.calls[0].shareRecipe.sourceId, held.id, 'for the recipe that waited');
  }],

  // (finding 11) The setting turned off while a request is in flight: the
  // approval writes no marker and takes the copy down — except for a recipe
  // that already had one: the server REPLACED its old copy, so the new id is
  // kept, or the published copy loses its only handle in the app.
  ['(30) the setting turned off during the review: the approval writes no marker and withdraws the new copy; for a recipe that already had a marker the marker is updated and nothing is withdrawn', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, sent, answered, letGo } = kit;
    await account(kit, { withdraw: { ok: true } });
    const first = await ownRecipe(page, dish('QA setting off in review'));
    worker.queue.push(APPROVE('pub-30-a', { gate: true }));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the recipe is sent, its answer held');
    await ev(() => DB.prefs.setAutoShare(false));   // what the Settings row does (js/app.js)
    letGo();
    await answered(1, 'setup: the held approval arrives');
    await page.waitForFunction(() => window.__shr.withdraw.length > 0, null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual([await ev(markOf, first.id), await ev(() => window.__shr.withdraw)], [null, ['pub-30-a']], 'turned off during the review: no marker, and the copy the approval published comes down');
    await clock.run(QUIET);
    assert.equal((await posts(kit)).length, 1, 'and nothing else is sent');
    // A recipe that already had a marker: the re-share REPLACED its old copy.
    await ev(wipe);
    await account(kit, { withdraw: { ok: true } });
    fresh();
    const had = await ownRecipe(page, dish('QA replaced in review'));
    await ev((id) => { DB.recipes.setShared(id, { id: 'pub-30-old', at: new Date().toISOString(), sig: '00000000' }); }, had.id);
    worker.queue.push(APPROVE('pub-30-new', { gate: true }));
    await reset('food');
    await clock.run(DELAY);
    await sent(1, 'setup: the edited recipe is sent again, its answer held');
    await ev(() => DB.prefs.setAutoShare(false));
    letGo();
    await answered(1, 'setup: the held approval arrives');
    await page.waitForTimeout(200);
    assert.deepEqual([((await ev(markOf, had.id)) || {}).id, await ev(() => window.__shr.withdraw)], ['pub-30-new', []], 'a recipe that already had a marker keeps the NEW id — its old copy was replaced — and nothing is withdrawn');
  }],

  // (findings 3 and 16) The marker is written outside the undo ledger, and
  // used to turn every recipes Undo in «آخر التعديلات» STALE seconds after a
  // save. The ledger's snapshots follow it now (js/storage.js
  // carryRecipeField) — and the Undo of an ADD the engine had published
  // withdraws the copy it leaves behind (js/app.js applyConvenienceUndo).
  ['(31) «Recent changes» after the engine published: the Undo of the save still applies — not STALE — and, for an add, withdraws the published copy — which leaves the suggestions at once; the Undo of an edit keeps the marker and withdraws nothing', async (kit) => {
    const { page, ev, reset, worker, clock, answered } = kit;
    // The list read fresh after an approval holds the copy just published (the
    // card's suggestions, v421 fix F3c).
    await account(kit, { withdraw: { ok: true }, freshRows: [row('pub-31-add', 'QA added then undone', PERIODS, 254, 26, 28, 3, 2, 0)] });
    // The wipe before this case wrote its removals into the ledger under no
    // account; the app drops a ledger another owner wrote the moment it is
    // listed (DB.undo.list), so what follows is this account's alone.
    await ev(() => DB.undo.list());
    const want = await ev(() => ({ undone: t('updated'), stale: t('cx_stale') }));
    const undoHead = async () => {
      await ev(() => openRecentChanges());
      await sheetUp(page, '[data-undo]');
      const rows = await ev(() => [...document.querySelectorAll('#modal-root [data-undo]')].map((b) => b.disabled));
      assert.equal(rows[0], false, 'setup: the newest entry offers its Undo: ' + JSON.stringify(rows));
      await page.locator('#modal-root [data-undo]:not([disabled])').first().click();
      await page.waitForTimeout(200);
      return ev(toastText);
    };
    worker.queue.push(APPROVE('pub-31-add'));
    await reset('food');
    const added = await editorSave(kit, { draft: dish('QA added then undone') });
    await clock.run(DELAY);
    await answered(1, 'setup: the saved recipe is sent and approved');
    assert.equal(((await ev(markOf, added.id)) || {}).id, 'pub-31-add', 'setup: its marker is written');
    await page.waitForFunction(() => window.__shr.fresh > 0 && sharedPool().some((r) => r.id === 'pub-31-add'), null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await ev(() => [sharedPool().some((r) => r.id === 'pub-31-add'), suggestionPool().filter((r) => r.id === 'pub-31-add' || r.src === 'mine').map((r) => r.src)]), [true, ['mine']],
      'setup: the list read fresh holds the published copy, and the card reads it once — as the user\'s own');
    const said = await undoHead();
    assert.notEqual(said, want.stale, 'the save\'s Undo is not STALE although the marker was written after it');
    assert.equal(said, want.undone, 'it answers «' + want.undone + '»');
    assert.equal(await ev((id) => DB.recipes.list().some((r) => r.id === id), added.id), false, 'and takes the recipe back');
    await page.waitForFunction(() => window.__shr.withdraw.length > 0, null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-31-add'], 'the Undo of an ADD withdraws the copy the engine published: nothing in the app held its id any more');
    // …and that copy leaves the suggestions at once (v421 fix F3c): the list in
    // memory still holds it, and nothing names it as the user's own any more.
    assert.deepEqual(await ev(() => suggestionPool().filter((r) => r.id === 'pub-31-add').map((r) => r.src)), [], 'the copy the Undo withdrew is not suggested back as another user\'s recipe');
    assert.ok(!((await ev(readCard)) || { rows: [] }).rows.includes('pub-31-add'), 'nor drawn on the card the Undo repainted');
    // The Undo of an EDIT: the recipe stays, with the marker of its newest copy.
    worker.queue.push(APPROVE('pub-31-b'), APPROVE('pub-31-c'));
    const edited = await editorSave(kit, { draft: dish('QA edited then undone') });
    await clock.run(DELAY + GAP);
    await answered(2, 'setup: the second recipe is sent and approved');
    await editorSave(kit, { id: edited.id, name: 'QA edited then undone, edited' });
    await clock.run(GAP);
    await answered(3, 'setup: the edit is sent and approved — the marker moves to the new copy');
    assert.equal(((await ev(markOf, edited.id)) || {}).id, 'pub-31-c', 'setup: the marker names the new copy');
    assert.equal(await undoHead(), want.undone, 'the edit\'s Undo applies — «' + want.undone + '», not STALE');
    assert.deepEqual(await ev((id) => { const r = DB.recipes.list().find((x) => x.id === id); return [r && r.name, ((r || {}).shared || {}).id]; }, edited.id), ['QA edited then undone', 'pub-31-c'], 'the old content is back and the marker — the newest copy\'s — stays');
    assert.deepEqual(await ev(() => window.__shr.withdraw), ['pub-31-add'], 'and nothing is withdrawn for it');
  }],

  // (the fix after the review) A NOTICE CUT SHORT BY A HOLD OR A STOP. Case 28
  // has the notice displaced while the step kept looking at it; here the step
  // itself is HELD (an Undo's hold) or STOPPED (the setting off, offline)
  // while the notice is up — and the notice was stamped «seen» at the next run
  // for a window nobody saw, the recipes then published with no notice. The
  // two waits sit below the notice block, and a stopped step forgets the
  // notice it can no longer watch: the notice is raised again, and the
  // request leaves only a full window after THAT raise.
  ['(32) a notice cut short by a hold or a stop is not spent — a delete\'s Undo hold, the setting turned off in Settings, going offline: the notice is raised again, seen only once a full window ran on screen, and the request leaves only then', async (kit) => {
    const { page, ev, reset, worker, fresh, clock, answered } = kit;
    const want = await ev(() => ({ notice: t('shr_auto_notice'), stop: t('shr_auto_stop'), deleted: t('rec_deleted'), undo: t('undo') }));
    const seen = () => ev(() => DB.prefs.autoShareSeen());
    const noticeUp = async () => [await ev(toastText), await ev(toastAct)];
    // When the notice on screen was raised — the engine's own record, read only.
    const raisedAt = () => ev(() => __autoNoticeAt);
    // THE WINDOW AFTER A RAISE: a second before it ends nothing is sent, it is
    // not seen and «أوقِفها» is still on offer; then exactly ONE request, a full
    // window after that raise, for the recipe saved — and only then is it seen.
    const fullWindow = async (rec, back, what) => {
      await clock.run(NOTICE - 100);
      assert.deepEqual([await posts(kit), await seen(), await ev(toastAct)], [[], false, want.stop], what + ': a second before a full window after that raise nothing is sent, it is not seen, and «' + want.stop + '» is still on offer');
      await clock.run(100);
      await answered(1, what + ': a full window after it was raised again, the recipe is sent');
      assert.deepEqual([(await posts(kit)).map((at) => at - back), await seen(), worker.calls[0].shareRecipe.sourceId], [[NOTICE], true, rec.id], what + ': exactly ONE request, a full window after THAT raise, for the recipe saved — and only then is it seen');
    };
    // (a) A DELETE FROM «وصفاتي» two seconds in: its Undo toast takes the
    // notice's place, and the delete holds the engine for HOLD ms. The hold is
    // read BELOW the notice block, so the step sees the notice gone before it
    // waits — and after the hold the notice is raised again.
    await account(kit, { seen: false });
    await reset('food');
    const doomed = await ownRecipe(page, dish('QA deleted meanwhile'));
    worker.queue.push(APPROVE('pub-32-a'));
    const recA = await editorSave(kit, { draft: dish('QA under a delete') });
    await clock.run(DELAY);
    assert.deepEqual(await noticeUp(), [want.notice, want.stop], 'setup: the notice is up');
    await clock.run(2000);
    await ev(() => openSavedFoodPicker(todayISO(), () => {}, 'recipes'));
    await sheetUp(page, `[data-del-rec="${doomed.id}"]`);
    await page.locator(`#modal-root [data-del-rec="${doomed.id}"]`).click();
    await page.waitForFunction(() => !!document.querySelector('#modal-root .confirm-dialog'), null, { timeout: 3000 });
    const delAt = await ev(pageNow);
    await page.locator('#modal-root .confirm-dialog [data-ok]').click();
    await page.mouse.move(0, 0);
    assert.deepEqual([await noticeUp(), await ev((id) => DB.recipes.list().some((r) => r.id === id), doomed.id)], [[want.deleted, want.undo], false], 'setup: the recipe is deleted, and its Undo took the notice\'s place');
    await ev(() => closeModal());
    await clock.run(1000);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.deleted, want.undo], false, []], 'the engine looked once under the Undo: the Undo stays, the notice is not spent, nothing is sent');
    await clock.run(HOLD - 1000 - 100);
    assert.deepEqual([await ev(toastAct), await seen(), await posts(kit)], ['', false, []], 'a moment before the hold ends: the Undo ran out, the notice is not back yet, it is not spent, nothing is sent');
    await clock.run(100);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.notice, want.stop], false, []], 'the hold over, the notice is raised AGAIN — the window the Undo cut short was not stamped seen, and nothing was sent');
    const backA = await raisedAt();
    assert.equal(backA - delAt, HOLD, `raised the moment the hold ended, ${HOLD} ms after the delete`);
    await fullWindow(recA, backA, '(a)');
    // (b) THE SETTING TURNED OFF IN SETTINGS two seconds in: the navigation
    // takes the toast down and «متوقفة» stops the step — which forgets the
    // notice it can no longer watch. Turned on again, the next render of Food
    // raises it AGAIN rather than stamping the cut-short window seen.
    await ev(wipe);
    await account(kit, { seen: false });
    fresh();
    await reset('food');
    worker.queue.push(APPROVE('pub-32-b'));
    const recB = await editorSave(kit, { draft: dish('QA stopped in Settings') });
    await clock.run(DELAY);
    assert.deepEqual(await noticeUp(), [want.notice, want.stop], 'setup: the notice is up');
    await clock.run(2000);
    await reset('settings');
    await page.locator('.view.active [data-auto-share="0"]').click();
    await page.mouse.move(0, 0);
    assert.deepEqual([await ev(() => DB.prefs.autoShare()), await ev(toastAct)], [false, ''], 'setup: «متوقفة» picked two seconds into the notice, which the navigation took down');
    await clock.run(1000);
    assert.deepEqual([await ev(toastAct), await seen(), await posts(kit)], ['', false, []], 'stopped by the setting a second later: no notice is raised over Settings, it is not spent, nothing is sent');
    await clock.run(QUIET);
    await page.locator('.view.active [data-auto-share="1"]').click();
    await page.mouse.move(0, 0);
    await clock.run(QUIET);
    assert.deepEqual([await ev(() => DB.prefs.autoShare()), await ev(toastAct), await seen(), await posts(kit)], [true, '', false, []], '«تلقائية» again: nothing by itself — no notice, not spent, nothing sent');
    await reset('food');
    await clock.run(DELAY);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.notice, want.stop], false, []], 'the next render of Food raises the notice AGAIN — the window the setting cut short was not stamped seen, and nothing was sent');
    await fullWindow(recB, await raisedAt(), '(b)');
    // (c) OFFLINE two seconds in: the step stops and forgets the notice, which
    // runs out on screen by itself, unwatched. Online again, the next render
    // of Food raises it AGAIN: nothing is sent on a window the engine could
    // not watch to its end.
    await ev(wipe);
    await account(kit, { seen: false });
    fresh();
    await reset('food');
    worker.queue.push(APPROVE('pub-32-c'));
    const recC = await editorSave(kit, { draft: dish('QA gone offline') });
    await clock.run(DELAY);
    assert.deepEqual(await noticeUp(), [want.notice, want.stop], 'setup: the notice is up');
    await clock.run(2000);
    await ev(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); });
    await clock.run(1000);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.notice, want.stop], false, []], 'offline a second later: the step stops — the notice is left to itself on screen, it is not spent, nothing is sent');
    await clock.run(5 * 60 * 1000);
    assert.deepEqual([await ev(toastAct), await seen(), await posts(kit)], ['', false, []], 'five minutes offline: the notice ran out unwatched — not spent, and nothing was sent');
    await ev(() => { delete navigator.onLine; });
    assert.equal(await ev(() => navigator.onLine), true, 'setup: online again');
    await reset('food');
    await clock.run(DELAY);
    assert.deepEqual([await noticeUp(), await seen(), await posts(kit)], [[want.notice, want.stop], false, []], 'online again, the next render of Food raises the notice AGAIN — the window nobody watched was not stamped seen, and nothing was sent');
    await fullWindow(recC, await raisedAt(), '(c)');
  }],

  // ── «اقتراحات اليوم» (v421) ──────────────────────────────────────────────
  // The three sources on one card. Every expectation is this file's own: the
  // pool's order (cardIds), the ready meals priced from the catalogue
  // (readyMeals), the user's own recipe read back as stored (mineRow).
  ['(33) the user\'s own recipe is the card\'s FIRST row even when it ranks last — captioned «من وصفاتي» — the community\'s best second, captioned «من المستخدمين», the best ready meal third with no caption; the own row opens the recipe view with «سجّل حصّة» first — one serving, Undo, a name with «$» as written — and «تعديل» there lands back on Food; the picker\'s view is unchanged', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    const rows = sixRows('qa-c33', P, O);
    await stubCloud(page, { rows });
    await load(page);
    const rec = await ownRecipe(page, RICE);
    await reset('food');
    const ready = await ev(readyMeals);
    const mine = mineRow(await ev(recOf, rec.id), rows);
    const pool = [mine].concat(community(rows), ready);
    assert.ok(rankIds(pool, P, 2000).indexOf(mine.id) >= 3, 'setup: by rank alone our recipe would not even be on the card: ' + rankIds(pool, P, 2000).indexOf(mine.id));
    const want = await ev(() => ({ mine: t('shr_src_mine'), community: t('shr_src_community') }));
    const c = await ev(readCard);
    assert.deepEqual(c.rows, [mine.id, rankIds(rows, P, 2000)[0], rankIds(ready, P, 2000)[0]], 'our recipe first, then the community\'s best, then the best ready meal: ' + JSON.stringify(c.rows));
    assert.deepEqual(c.rows, cardIds(pool, P, 2000).slice(0, 3), 'the best of each source, in that order');
    assert.deepEqual(c.srcs, ['mine', 'community', 'builtin'], 'each row names its source (data-shr-src)');
    assert.deepEqual(c.caps, [want.mine, want.community, ''], `a caption on our recipe («${want.mine}») and on another user's («${want.community}»), none on the ready meal`);
    assert.deepEqual(c.capFirst, [true, true, null], 'the caption stands over the name');
    const text = await ev(rowText, mine);
    assert.deepEqual([c.titles[0], c.figs[0], c.subs[0]], [RICE.name, text.fig, text.sub], 'our row: the recipe\'s name and one serving\'s figures');
    // The tap opens the recipe itself — the view the picker opens.
    await page.locator(cardRow(mine.id)).click();
    await sheetUp(page, '[data-edit-view]').catch(() => {});
    const v = (await ev(readSheet)) || {};
    assert.equal(v.title, RICE.name, 'the row opens our recipe');
    assert.ok(v.edit, 'with «edit»: the recipe view');
    assert.deepEqual([v.log, v.save, v.report], [null, null, null], 'not the suggestion sheet: nothing to save a copy of or report');
    assert.deepEqual(v.qty, ['300 g'], 'its ingredient as written');
    assert.deepEqual(v.figsRows, [], 'and the recipe view keeps the stove\'s silence: no figures under an ingredient');
    // «سجّل حصّة» (v421 fix F1): the card's first row is a meal to eat like the
    // others — first among the view's actions, the primary one.
    const w = await ev(() => ({ log: t('shr_log'), undo: t('undo') }));
    assert.deepEqual([v.logView, v.actions], [{ text: w.log, disabled: false, primary: true }, ['log', 'edit', 'share']], 'opened from the card, the view offers «' + w.log + '» first, as the primary action: ' + JSON.stringify(v.actions));
    await page.locator('#modal-root [data-step="1"]').click();   // the scaler moves amounts, never the log
    await page.locator('#modal-root [data-log-view]').click();
    await sheetGone(page);
    assert.deepEqual(await ev(rowsToday), [{ name: RICE.name, servings: 1, calories: 390, protein: 4, carbs: 86, fat: 1, source: 'recipe' }], 'ONE row of one serving, the serving\'s figures, source «recipe» — as the picker\'s «+» logs it');
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [await ev((n) => t('rec_logged').split('{name}').join(n), RICE.name), w.undo], 'the toast names the recipe, with «' + w.undo + '»');
    assert.equal(await ev(() => ((document.querySelector('.view.active .cal-ring-sub .num') || {}).textContent || '').trim()), await ev(() => fmtNum(390)), 'the hero repainted: 390 eaten');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await ev(rowsToday), [], 'Undo takes it back');
    // «تعديل» from the card lands back on Food — not in the saved-food picker,
    // which the card never opened.
    await page.locator(cardRow(mine.id)).click();
    await sheetUp(page, '[data-edit-view]');
    await page.locator('#modal-root [data-edit-view]').click();
    await page.locator('#modal-root .modal-overlay:not(.is-out) #rec-rows .rec-row').first().waitFor({ timeout: 4000 });
    await page.locator('#modal-root .modal-overlay:not(.is-out) #rec-save').click();
    await sheetGone(page).catch(() => {});
    assert.deepEqual(await ev(() => [currentView, !!document.querySelector('#modal-root .modal-overlay:not(.is-out)'), !!document.querySelector('#modal-root #sf-list')]), ['food', false, false], 'the edit saved, Food is on screen with no sheet over it — not the saved-food picker');
    assert.equal(((await ev(readCard)) || { rows: [] }).rows[0], mine.id, 'and the card is there, our recipe first');
    // The picker's view of the same recipe has its own «+» on the row: no log button there.
    await openOwnView(page, rec.id);
    assert.deepEqual([(await ev(readSheet)).logView, (await ev(readSheet)).actions], [null, ['edit', 'share']], 'opened from the picker, the view is as it was: «edit» and the share button alone');
    await ev(() => closeModal());
    await sheetGone(page);
    // A NAME WITH «$» (fix F6): the toast prints the recipe's name as written.
    const priced = await ownRecipe(page, { ...RICE, name: 'Rice $& $1 $$ bowl' });
    await ev((id) => openRecipeView(null, DB.recipes.list().find((r) => r.id === id), () => {}, { log: true }), priced.id);
    await sheetUp(page, '[data-log-view]');
    await page.locator('#modal-root [data-log-view]').click();
    await sheetGone(page);
    assert.equal(await ev(toastText), await ev((n) => t('rec_logged').split('{name}').join(n), priced.name), 'a name holding «$&», «$1» and «$$» is toasted exactly as written');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
  }],

  ['(34) a ready meal: its sheet opens with the ingredients already there — no fetch, nothing busy — each with its amount — one figure in grams or millilitres, a counted unit too — and its own figures, the meal\'s figures their sum; the scaler moves every amount with its figures; «Log a serving» writes one serving (source builtin, the meal\'s own id) with Undo; «Save to my recipes» keeps a copy with origin builtin and noAuto — standing in for the meal on the card and in «show more», opening its view with «سجّل حصّة», spent on reopening, its share sheet promising no following — that automatic sharing never sends', async (kit) => {
    const { page, ev, reset, worker, clock, answered } = kit;
    const { P } = await periods(page);
    await stubCloud(page, { rows: [] });
    await load(page);
    await reset('food');
    const ready = await ev(readyMeals);
    const want = await ev(() => ({ per: t('rec_per'), log: t('shr_log'), save: t('shr_save'), mine: t('shr_in_recipes'), saved: t('shr_saved'), undo: t('undo'),
      terms: [t('shr_term_review'), t('shr_term_anon'), t('shr_term_withdraw')], copy: t('shr_term_copy') }));
    // THE MEAL THIS CASE OPENS: the first on the card that weighs an ingredient
    // in grams other than its serving names — so an ingredient's figures can
    // only come out right if they were scaled by those grams. Every period's
    // card holds one (the snack period's best, a whey shake, weighs its scoop
    // exactly as the catalogue serves it).
    // (Their order is case 1's to pin: here a wrong price would move the card
    // before the figures this case reads could say why.)
    const card = (await ev(readCard)).rows;
    assert.ok(card.length === 3 && card.every((id) => ready.some((r) => r.id === id && r.meals.includes(P))), 'setup: the card holds three ready meals of the period: ' + JSON.stringify(card));
    const meal = card.map((id) => ready.find((r) => r.id === id)).find((m) => m.items.some((it) => it.g !== null && it.g !== it.servingG));
    assert.ok(meal, 'setup: a meal on the card weighs an ingredient in grams other than its serving: ' + JSON.stringify(card));
    await page.locator(cardRow(meal.id)).click();
    await sheetUp(page, '#shr-log');
    // AT ONCE — nothing is waited for: the ingredients came with the meal.
    const s = await ev(readSheet);
    assert.equal(s.title, meal.name, 'the sheet is the meal\'s, by its name');
    assert.deepEqual(s.names, meal.items.map((it) => it.name), 'its ingredients by name, in the reader\'s language, at once');
    assert.deepEqual(s.qty, meal.items.map((it) => it.qty), 'each amount ONE figure in grams «N غ» / «N g» (millilitres for a liquid), a counted unit as n × its serving\'s weight');
    assert.ok(s.qty.every((q) => /^([0-9]+|[٠-٩]+) (غ|مل|g|ml)$/.test(q)), 'no amount reads as a bare unit label («ملعقة», «رغيف», «حبة»): ' + JSON.stringify(s.qty));
    assert.deepEqual(s.figsRows, await ev(figsText, { items: meal.items, f: 1 }), 'each ingredient with ITS figures — its catalogue entry scaled to that amount');
    assert.equal(s.busy, null, 'nothing is busy');
    assert.deepEqual(await ev(() => window.__shr.items), [], 'and nothing was fetched');
    assert.equal(s.figs, want.per + ' ' + (await ev(rowText, meal)).fig + ' ' + (await ev(() => t('cal'))) + ' · ' + (await ev(rowText, meal)).sub, 'one serving\'s figures: the sum of its ingredients');
    assert.equal(s.serv, '1', 'one serving');
    assert.deepEqual([s.log, s.save, s.report], [{ text: want.log, disabled: false }, { text: want.save, disabled: false }, null], 'log and save live at once — and no report: nobody reports a ready meal');
    // THE SCALER moves EVERY amount — since the v421 fix (F2) every one is a
    // figure in grams or millilitres, a counted unit too — and every
    // ingredient's figures, by the same factor: no amount stands still beside
    // figures that moved.
    await page.locator('#modal-root .rt-step [data-step="1"]').click();
    const two = await ev(readSheet);
    assert.equal(two.serv, '2', 'one step up');
    assert.deepEqual(two.qty, await ev((items) => items.map((it) => it.amt * 2 + ' ' + t(it.unit)), meal.items), 'every amount doubles: ' + JSON.stringify(two.qty));
    assert.deepEqual(two.figsRows, await ev(figsText, { items: meal.items, f: 2 }), 'and every ingredient\'s figures double with it');
    // ONE SERVING, whatever the scaler shows.
    await page.locator('#shr-log').click();
    await sheetGone(page);
    const logged = await ev(() => DB.foodLogs.listForDate(todayISO()).map((r) => ({ name: r.name, servings: r.servings, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, source: r.source, sourceId: r.sourceId })));
    assert.deepEqual(logged, [{ name: meal.name, servings: 1, calories: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, source: 'builtin', sourceId: meal.preset }],
      'ONE row of one serving with the meal\'s figures, source «builtin» and the meal\'s own id');
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [await ev((n) => t('rec_logged').split('{name}').join(n), meal.name), want.undo], 'the toast names the meal, with «' + want.undo + '»');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await ev(rowsToday), [], 'Undo takes it back');
    // A UNIT COUNTED MORE THAN ONCE — two eggs — in the one meal that has one,
    // opened from «show more» of its own period: twice the weight of one egg,
    // «١٠٠ غ» / «100 g» (v421 fix F2; it read «٢ × بيضة» before, beside figures
    // the scaler doubled while it still said two eggs).
    const twice = ready.find((m) => m.items.some((it) => it.n > 1));
    await page.locator(`.view.active #shr-card [data-shr-period="${twice.meals[0]}"]`).click();
    await openMore(page);
    await page.locator(`#modal-root [data-shr-open="${twice.id}"]`).click();
    await sheetUp(page, '#shr-log');
    const t2 = await ev(readSheet);
    assert.deepEqual([t2.title, t2.names, t2.qty], [twice.name, twice.items.map((it) => it.name), twice.items.map((it) => it.qty)], 'a unit taken twice reads as twice its serving\'s weight: ' + JSON.stringify(t2.qty));
    const egg = twice.items.findIndex((it) => it.n > 1);
    assert.equal(t2.qty[egg], await ev((n) => String(n) + ' ' + t('unit_g'), twice.items[egg].n * 50), 'two eggs of 50 g (one large egg, the spec): «' + t2.qty[egg] + '»');
    assert.deepEqual(t2.figsRows, await ev(figsText, { items: twice.items, f: 1 }), 'and its figures are twice the entry\'s');
    // EVERY AMOUNT MOVES WITH ITS FIGURES, a counted unit too: at three servings
    // each amount and each figures line are ×3 together.
    await page.locator('#modal-root .rt-step [data-step="1"]').click();
    await page.locator('#modal-root .rt-step [data-step="1"]').click();
    const three = await ev(readSheet);
    assert.deepEqual([three.serv, three.qty, three.figsRows], ['3', await ev((items) => items.map((it) => it.amt * 3 + ' ' + t(it.unit)), twice.items), await ev(figsText, { items: twice.items, f: 3 })],
      'at three servings every amount — the eggs too — and every figures line are ×3: ' + JSON.stringify(three.qty));
    await ev(() => closeModal());
    await sheetGone(page);
    await page.locator(`.view.active #shr-card [data-shr-period="${P}"]`).click();
    // «SAVE TO MY RECIPES»: a copy that says where it came from.
    await page.locator(cardRow(meal.id)).click();
    await sheetUp(page, '#shr-log');
    await page.locator('#shr-save').click();
    await page.waitForTimeout(100);
    const recs = await ev(() => DB.recipes.list());
    assert.equal(recs.length, 1, 'one recipe saved');
    const r = recs[0];
    assert.deepEqual([r.name, r.servings, r.origin, 'shared' in r], [meal.name, 1, 'builtin', false], 'the copy: the meal\'s name, one serving, origin «builtin», no publication marker');
    // …and «not automatically» from birth (v421 fix F4): a phone still on v420
    // refuses only origin 'shared', so without noAuto it would publish this
    // copy as the user's own recipe once it pulled the blob.
    assert.equal(r.noAuto, true, 'the copy carries noAuto: true — automatic sharing never sends it, on this build or on v420');
    assert.deepEqual(r.items.map((it) => [it.name, it.qty, it.calories, it.protein, it.carbs, it.fat]), meal.items.map((it) => [it.name, it.qty, it.calories, it.protein, it.carbs, it.fat]), 'its ingredients, amounts and figures exactly');
    assert.ok(r.items.every((it) => typeof it.id === 'string' && it.id && !it.id.startsWith(meal.preset)), 'every ingredient has its own new id: ' + JSON.stringify(r.items.map((it) => it.id)));
    assert.ok(![...Object.keys(r), ...r.items.flatMap((it) => Object.keys(it))].some((k) => k.startsWith('_')), 'no editor flag reaches the blob');
    assert.deepEqual([(await ev(readSheet)).save, await ev(toastText), await ev(toastAct)], [{ text: want.mine, disabled: true }, want.saved, want.undo], 'the button says it is in the recipes and is spent; the toast says it was saved, with «' + want.undo + '»');
    // ONE MEAL, ONE ROW (v421 fix F3a): the copy stands in for the ready meal
    // it was saved from — on the card behind at once, and in «show more».
    const mineId = 'mine:' + r.id;
    let cardNow = await ev(readCard);
    assert.deepEqual([cardNow.rows[0], cardNow.rows.includes(meal.id)], [mineId, false], 'the card behind follows at once: the copy heads it, the ready original has left it: ' + JSON.stringify(cardNow.rows));
    await ev(() => closeModal());
    await sheetGone(page);
    await reset('food');
    cardNow = await ev(readCard);
    assert.deepEqual([cardNow.rows[0], cardNow.srcs[0], cardNow.rows.includes(meal.id)], [mineId, 'mine', false], 'the copy is the user\'s own recipe now — the card\'s first row — and the meal it copies is not on the card a second time');
    const moreNow = await openMore(page);
    assert.deepEqual([group(moreNow, 'mine'), moreNow.rows.includes(meal.id)], [[mineId], false], '«show more» lists the meal once, as the user\'s own: ' + JSON.stringify(moreNow.groups.map((g) => [g.src, g.rows.length])));
    await ev(() => closeModal());
    await sheetGone(page);
    // Reached directly, the ready meal's sheet still says the copy is saved.
    await ev((m) => openSharedRecipe(m, null, () => {}), meal);
    await sheetUp(page, '#shr-log');
    assert.deepEqual((await ev(readSheet)).save, { text: want.mine, disabled: true }, 'the meal reopened: it is still in the recipes');
    await ev(() => closeModal());
    await sheetGone(page);
    // The copy's row opens the recipe view, with «سجّل حصّة» first (fix F1).
    await page.locator(cardRow(mineId)).click();
    await sheetUp(page, '[data-edit-view]');
    const view = await ev(readSheet);
    assert.deepEqual([view.title, view.logView && view.logView.text, view.actions[0]], [meal.name, want.log, 'log'], 'the copy\'s row opens its recipe view, «' + want.log + '» first');
    await ev(() => closeModal());
    await sheetGone(page);
    // ITS SHARE SHEET: with automatic sharing on, the fourth term says the copy
    // stays as it was sent — automatic sharing never follows a copy.
    assert.equal(await ev(() => DB.prefs.autoShare()), true, 'setup: automatic sharing is on');
    await openOwnView(page, r.id);
    await page.locator('#modal-root [data-share-view]').click();
    await sheetUp(page, '#shr-send');
    assert.deepEqual((await ev(readSheet)).terms, [...want.terms, want.copy], 'a copy of a ready meal: the fourth term says the published copy stays as sent');
    await ev(() => closeModal());
    assert.equal(await ev((id) => autoShareWants(DB.recipes.list().find((x) => x.id === id)), r.id), false, 'automatic sharing does not want it');
    // THE ENGINE, OPEN: a recipe of the user's own beside the copy — the
    // control — is sent; the copy never is.
    await account(kit);
    const own = await ownRecipe(page, dish('QA control beside a copy'));
    worker.queue.push(APPROVE('pub-34'), APPROVE('pub-34-b'));
    await reset('food');
    await clock.run(DELAY);
    await answered(1, 'the control: the user\'s own recipe is sent');
    await clock.run(QUIET);
    assert.deepEqual([(await posts(kit)).length, worker.calls.map((x) => x.shareRecipe.sourceId)], [1, [own.id]], 'one request in all, for the user\'s own recipe — the copy of a ready meal is never sent: ' + JSON.stringify(worker.calls.map((x) => x.shareRecipe.name)));
  }],

  ['(35) layout: at 375 and 320, with and without «Larger text», every row of the card — mine, community, ready — keeps its caption, name and figures inside it, the caption over the name, and stays door-sized; «show more»\'s captions, a ready meal\'s ingredient lines — the figures on a line of their own, under the amount — and an own recipe\'s three actions stay inside their sheet', async ({ page, ev, reset }) => {
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c35', P, O) });
    await load(page);
    await ownRecipe(page, { ...BOWL, name: 'QA a recipe of mine whose name is long enough to wrap onto a second line' });
    const ready = await ev(readyMeals);
    // The period's ready meal with the most ingredients: the longest list.
    const meal = rankRows(ready, P, 2000).reduce((a, b) => (b.items.length > a.items.length ? b : a));
    try {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        for (const lg of [false, true]) {
          const where = `${width}px${lg ? ' + larger text' : ''}`;
          await reset('food');
          const c = await ev(layoutOf, { part: 'card', lg });
          assert.deepEqual(c.srcs, ['mine', 'community', 'builtin'], `setup: a row of each source at ${where}`);
          assert.deepEqual(c.spill, [], `a row's caption, name or figures leave the row at ${where}: ${c.spill.join('; ')}`);
          assert.deepEqual([c.cardSpill, c.pageSpill], [false, false], `the card or the page overflows sideways at ${where}`);
          assert.ok(c.rowH.every((h) => h >= 44), `rows at least 44px at ${where}: ${c.rowH}`);
          assert.deepEqual(c.caps, [true, true, null], `the caption is drawn over the name on the two rows that carry one at ${where}: ${JSON.stringify(c.caps)}`);
          await page.locator('.view.active #shr-card [data-shr-more]').click();
          await sheetUp(page, '.shr-group');
          const m = await ev(layoutOf, { part: 'more', lg });
          assert.deepEqual(m.spill, [], `«show more» spills at ${where}: ${m.spill.join('; ')}`);
          assert.equal(m.modalSpill, false, `«show more» scrolls sideways at ${where}`);
          assert.ok(m.caps.length === 3 && m.caps.every((h) => h > 0), `its three captions drawn at ${where}: ${m.caps}`);
          await page.locator(`#modal-root [data-shr-open="${meal.id}"]`).click();
          await sheetUp(page, '.rec-view .cx-row.has-figs');
          const s = await ev(layoutOf, { part: 'meal', lg });
          assert.equal(s.n, meal.items.length, `setup: the meal's ${meal.items.length} ingredients at ${where}`);
          assert.deepEqual(s.spill, [], `an ingredient line spills at ${where}: ${s.spill.join('; ')}`);
          assert.ok(s.below.every(Boolean), `each ingredient's figures sit on a line of their own, under its name and amount, at ${where}: ${s.below}`);
          assert.equal(s.modalSpill, false, `the meal's sheet scrolls sideways at ${where}`);
          await ev(() => closeModal());
          await sheetGone(page);
          // The own recipe's view from the card: three actions on one row (fix F1).
          await page.locator('.view.active #shr-card .shr-row[data-shr-src="mine"]').click();
          await sheetUp(page, '[data-log-view]');
          const v = await ev(layoutOf, { part: 'view', lg });
          assert.equal(v.n, 3, `setup: «log», «edit» and the share button at ${where}`);
          assert.deepEqual([v.spill, v.clipped], [[], []], `an action of the recipe view spills or clips its word at ${where}: ${v.spill.concat(v.clipped).join('; ')}`);
          assert.ok(v.h.every((h) => h >= 44), `the recipe view's actions at least 44px at ${where}: ${v.h}`);
          assert.equal(v.modalSpill, false, `the recipe view scrolls sideways at ${where}`);
          await ev(() => closeModal());
          await sheetGone(page);
        }
      }
    } finally {
      await ev(() => document.body.classList.remove('text-lg'));
      await page.setViewportSize({ width: 375, height: 812 });
    }
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
          // What cases 1–17 and 25 stand on (see the header), read before EVERY
          // case: no cloud and no account — so automatic sharing sends nothing,
          // whatever the case saves — and nothing of the engine left running.
          assert.deepEqual(await kit.ev(() => [Cloud.configured(), Cloud.getLastUid(), __autoQueue.length, __autoBusy]), [false, null, 0, false],
            'setup: the case starts signed out and unconfigured, the engine idle — automatic sharing is inert until account() opens it');
          await fn({ ...kit, browser, origin }); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`);
        } catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
        // Back to the 'out' stub's signed-out install, whatever the case set or
        // left: an answer still held is let go and its request allowed to end (a
        // reset cannot undo a request in flight — if the engine is waiting on the
        // stopped clock, the clock is stepped past every wait it has); then the
        // account is taken away, the engine put back, and the clock runs again.
        kit.letGo();
        await kit.ev(() => { try { closeModal(); } catch (_) {} hideToast(); }).catch(() => {});
        await kit.page.waitForFunction(() => !__autoBusy, null, { timeout: 2000 }).catch(() => kit.clock.run(HOLD + NOTICE).catch(() => {}));
        await kit.ev(pageSignOut).catch(() => {});
        await kit.ev(engineReset, true).catch(() => {});
        await kit.clock.go().catch(() => {});
      }
      await kit.ev(wipe).catch(() => {});
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  shared recipes UI: ${failures.length} failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  shared recipes UI (${passed} cases, AR/dark + EN/light, 375px): the «Today's suggestions» card (there from the first day — on null, on a missing method, on an empty list and before the answer — with ready meals priced from the catalogue; titled as the owner named it; four period buttons with only the clock's pressed; three rows, the best of each source, ranked by what fits the calories left, then protein per kcal; a period no community recipe suits filled with ready meals; «show more» grouped under three captions, each in rank order; outside the hero, kept by a water tap with no second pull), a recipe's sheet (name, one serving's figures, the ingredients fetched on the tap with each one's figures, a 4 → 2 scaler moving both), «Log a serving» as one serving with Undo, «Save to my recipes» as a clean copy, the report (one feedback row, the row leaves; signed out sends nothing), sharing (four terms — the fourth by the setting — the Worker's protocol, the {id, at, sig} marker, «Stop sharing», «shared» in the picker, a corrected name announced), a rejection's translated reason, the failures (daily limit, an old Worker, signed out, non-whole servings), withdrawing (the published id; a failure keeps the marker; a withdrawn recipe leaves automatic sharing until it is shared by hand; a button the marker moved under only redraws), untrusted names never markup and unsafe ids dropped, the period buttons fitting at 375/320 with and without larger text, the user's own published recipe suggested once, as their own, under its copy's periods (the feed's copy, reached directly, still offering no copy and no report); AUTOMATIC SHARING on a stopped clock — a save's one-time notice, then one request when its window ends, the sig, the fresh pull and the repaint, nothing for an unchanged re-save and one more for an edit; «stop» inside the window, the setting turned off while a recipe waits, a notice the keyboard holds up; nothing sent signed out, with the setting off, offline, without an account id or a configured cloud, before the sync settles, on a store that failed to load, for 2.5 servings, a copy from the list or a withdrawn recipe; a rejection remembered until an edit, and the gap kept for a save right after an answer; the daily limit and the AI budget's 429 pausing the device, also after the app is opened again; the backfill one at a time, a gap after each answer, ${DAY_MAX} a day; no marker after an account change, and no pause from a refusal that arrives after one; the Settings row at 375/320; «save all» as a trigger, an Undo on the recipes kept working, the notice waiting behind an Undo; «blocked», the held-recipes cap, «unavailable», a failed request, a rate limit waited out once, an approval for a recipe withdrawn or deleted meanwhile, and an edit made during the review sent after it; THE REVIEW'S FIXES — a notice seen only once it ended on screen (displaced by a navigation or a toast it comes back; under a hidden page it waits), «stop sharing» under a re-share in flight withdrawing the new copy, a refused withdraw lifting noAuto, a sync on the wire holding the queue, the setting turned off mid-review, «Recent changes» applicable after the engine published and withdrawing an undone add's copy, the fourth term for a copy from the list, the Settings hint in both states, a null row never breaking the render of Food; THE FIX AFTER IT — a dependency that throws under the backfill never breaking that render, and a notice cut short by a hold or a stop (a delete's Undo, the setting turned off in Settings, going offline) raised again, nothing sent and nothing seen until a full window ran on screen after THAT raise; «اقتراحات اليوم» (v421) — the user's own recipe first even when it ranks last, captioned, opening its recipe view; a ready meal's sheet with its ingredients at once, each with its figures, the scaler moving both, one serving logged as source builtin with Undo, a copy saved with origin builtin that its share sheet promises nothing for and automatic sharing never sends; captions on the user's and other users' rows only; the card, «show more» and a ready meal's sheet laid out at 375/320 with and without larger text; and a price that throws never breaking the render of Food; THE FIXES AFTER ITS REVIEW — «سجّل حصّة» on the user's own recipe opened from the card (first, one serving, Undo, kept through a withdraw's redraw, «تعديل» back to Food, the picker's view unchanged, three actions fitting at 320), every ingredient of a ready meal in grams or millilitres and every amount scaling with its figures, one meal one row (a ready meal's or a community recipe's copy standing in for it, the card behind repainted, a copy withdrawn by «أزل من المشاركة» or by an Undo never suggested back), a ready meal's copy carrying noAuto, «show more» with one source drawn bare, and a name holding «$» toasted as written`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
