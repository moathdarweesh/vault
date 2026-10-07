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
// own reading of the spec (rankRows, and cardIds until v422), as the community
// ranking always was (rankIds).
//
// THE PAGE (v422) is the fifth. The owner, on a screenshot of v421's card:
// «يكون فقط اسمها الاقتراحات وبعدها يودّيه لصفحة ثانية … ثم يضغط على الفطور
// وتطلع معها الأكلات». Food carries ONE door now (data-shr-door: the glyph,
// «اقتراحات اليوم», the chevron of a door row at the reading end — no period,
// no row, no count), and the suggestions are a screen of their own, the view
// 'suggestions' (the Food tab stays lit; its back arrow returns): the food
// log's top, the calories left when a target exists, and four periods as an
// accordion — all CLOSED on an arrival, «الآن» on the clock's, one open at a
// time, a second tap closes it, a log, a save, a re-render, an Undo and a
// Back to the page keep it, and a new arrival closes it again. An open period is the WHOLE list —
// no cap, no «show more»: every row of the period, ranked, in three groups
// (the user's own, the community's, the ready meals) under their captions
// when more than one group has rows (groupIds is this file's reading). Every
// case that read the card reads the page now (readPage, arrive, tapPeriod):
// 1–9, 14–16 and 33–35 were rewritten to it — 33's «own row first» is the
// first GROUP now, «من وصفاتي», as the page orders by rank within groups — 18
// has the approval repaint the page, 20 opens the page under a price that
// throws (the fence moved with the prices: Food reads none of them now), 26
// saves and logs from a row of the page under its Undos, 31 looks for the
// withdrawn copy on the page; 36 is the door and the way back,
// 37 the scroll — a period opened below the fold is brought into view, and a
// header tapped while the list above it closes keeps its place.
// The review of v422 added 38 (a new day while the page is on show: the
// foreground draws it again) and rows in 1, 2 and 8: a sheet open over the
// page while a repaint replaces the row it was opened from hands focus back to
// that row drawn anew (1) or to its period's header (8), never to <body>; a
// Back to the page keeps its period open (2). Each was seen to fail, in both
// passes, on its fix reverted in memory: the page left out of the day-change
// repaint (38, js/app.js), the sheet's anchor not moved with its row (1, 8),
// a Back handing the page a copy of its entry (2, js/app.js).
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
// the real time and left RUNNING: cases 1–17, 25, 33 and 35–38 meet an ordinary
// clock, and 34 until it opens the engine at its end; 38 sets it a day ahead
// (setSystemTime, which fires no timer) and back again before it ends.
// The engine's waits are 1.5 s, 12 s and 4 s, so its cases STOP the clock
// (`account()`) and step it (`clock.run(ms)`): «nothing is sent inside the
// window» is then a statement about the page's own timeline, not about how
// fast this machine was. js/food.js's constants are never touched.
//
// THE ENGINE AND THE OLDER CASES. Under the 'out' stub Cloud.configured() is
// false and there is no last uid; the engine asks for both before anything
// else, so in cases 1–17, 25, 33 and 35–38 it is inert whatever they save — the loop
// asserts those two facts, and an idle engine, before EVERY case. Only
// `account()` opens it (a configured Cloud, a uid, a session), and the loop
// closes it again after every case. The engine's own state (the queue, its
// timer, the session flag, the device ledger) is module state in js/food.js:
// `engineReset` is the ONE place this suite touches it, between cases;
// `reboot()` is the real thing — the app opened again — where a case needs
// exactly that. The page's open period (SHR_OPEN, v422; the card's pressed
// period, SHR_PICK, before it) is put back in `wipe()`, before every case: a
// case that fails half-way through must not hand the next one a period open
// (an arrival closes it anyway; a case may read the page before it arrives).
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
// v422: every assertion the rewritten and new cases carry was seen to fail on
// a defect planted IN MEMORY — js/food.js, js/app.js or styles.css — in both
// passes (in the Arabic one alone for the Arabic-only chevron), each caught by
// the assertion written for it (42 plants): Food pulling the list, an arrival
// forcing its pull, the list's arrival not painted into the open period, or
// drawing the whole page again, or closing a sheet open over it (1);
// a tap leaving the other period open, a second tap not closing, a re-render
// closing it, an arrival keeping it, «الآن» on every period, a tap redrawing
// the page whole (its header losing focus), focus not handed back to the row
// after a log, a log closing the period (2, 7), a closed panel not hidden or
// holding rows, aria-controls naming no panel (2); the calories line not
// repainted (7), drawn with no target, reading the target, an opened period
// ranked without the gauge (3); the door opening the food log, the Food tab
// dark on the page, the back arrow going forward, the chevron unmirrored, a
// row back on Food, the door above the water card, a count on it, no door
// under the setup button (36); the scroll into view and the header kept in
// place removed (37); an approval not repainting the page (18); the door under
// the L rung, filled with the accent, its name cut, its words not 700, a
// header 36 tall, its arrow off its line, «الآن» wider than it, a name cut,
// the cards touching (15), a row 30 tall (35). Every v421 plant whose code
// survives (K2–K33, F1–F6, G2, G3) ran again against the rewritten cases and
// was caught (G2 in the Arabic pass alone, an Arabic-only defect); K28 and K29
// by the page opening under a price that throws (20), and K27 — which the
// first lock cannot see, since the copy carries noAuto (fix F4) — by case 34's
// second lock. K1, K3, K3b, K6, K6b, K8, K9, K15 and K31 were retired with the
// code they planted into. The 44×44 scan in test-convenience-ui.js names the
// door, a header and a row when each is shrunk under 44 (three plants, run
// through test-sync-status-ui.js).
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
// The page's open period (v422; see the header).
/* global SHR_OPEN:writable */

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
// THE OPEN PERIOD'S LIST (v422 §2), by this file's own reading: the pool's
// rows for the period, ranked (rankRows), in three groups — the user's own,
// the community's, the ready meals — each in rank order; [source, ids] for
// every group that has rows. The page draws every one: no cap, no «show more».
const groupIds = (pool, period, calLeft) => ['mine', 'community', 'builtin']
  .map((s) => [s, rankIds(pool.filter((r) => r.src === s), period, calLeft)]).filter(([, ids]) => ids.length);
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

// THE PAGE (v422), read in the page: its top (the bar's title, the real
// heading), the calories line, every period's header — its name, its «الآن»,
// whether it says it is open, the panel it names, whether it stands in an
// <h2> — every panel (hidden? drawn? rows in it? in its own header's card?),
// and the OPEN period's list: its rows (id, source, name, figures) and its
// captions, each with the rows under it. `allRows` is every row anywhere on
// the page — rows belong to the open panel alone — and `focus` where the
// keyboard is. null when the page is not the screen on show.
function readPage() {
  const v = document.querySelector('.view.active[data-view="suggestions"]');
  if (!v) return null;
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const heads = [...v.querySelectorAll('.shr-pg-head')];
  const open = heads.filter((h) => h.getAttribute('aria-expanded') === 'true').map((h) => h.dataset.shrSec);
  const panel = open.length === 1 ? document.getElementById('shr-pg-' + open[0]) : null;
  const rows = panel ? [...panel.querySelectorAll('.shr-rows .shr-row')] : [];
  const a = document.activeElement;
  return {
    bar: txt(v.querySelector('.detail-top .detail-top-title')),
    h1: txt(v.querySelector('h1')),
    left: txt(v.querySelector('.shr-pg-left')),
    heads: heads.map((h) => ({ p: h.dataset.shrSec, name: txt(h.querySelector('.shr-pg-name')), now: txt(h.querySelector('.shr-pg-now')),
      expanded: h.getAttribute('aria-expanded'), controls: h.getAttribute('aria-controls'), inH2: !!h.parentElement && h.parentElement.tagName === 'H2' })),
    panels: heads.map((h) => {
      const pn = document.getElementById(h.getAttribute('aria-controls') || '');
      return pn ? { hidden: pn.hidden, shown: pn.getClientRects().length > 0, rows: pn.querySelectorAll('.shr-row').length, home: pn.closest('.shr-pg-sec') === h.closest('.shr-pg-sec') } : null;
    }),
    open,
    rows: rows.map((b) => b.dataset.shrOpen),
    srcs: rows.map((b) => b.dataset.shrSrc || null),
    titles: rows.map((b) => (b.querySelector('.fig-row-title') || {}).textContent),
    subs: rows.map((b) => txt(b.querySelector('.fig-row-sub'))),
    figs: rows.map((b) => txt(b.querySelector('.fig-row-num'))),
    groups: panel ? [...panel.querySelectorAll(':scope > .shr-group')].map((p) => {
      const list = p.nextElementSibling && p.nextElementSibling.matches('.shr-rows') ? p.nextElementSibling : null;
      return { src: p.dataset.shrGroup, text: txt(p), rows: list ? [...list.querySelectorAll('.shr-row')].map((b) => b.dataset.shrOpen) : [] };
    }) : [],
    captions: v.querySelectorAll('.shr-src, [data-shr-group]').length,
    rowCaps: v.querySelectorAll('.shr-row .shr-src').length,
    allRows: [...v.querySelectorAll('.shr-row')].map((b) => b.dataset.shrOpen),
    empty: panel ? [...panel.querySelectorAll('.shr-empty')].map(txt) : [],
    more: v.querySelectorAll('[data-shr-more]').length,
    focus: a && a !== document.body && v.contains(a) ? (a.dataset.shrSec ? 'sec:' + a.dataset.shrSec : a.dataset.shrOpen ? 'row:' + a.dataset.shrOpen : a.tagName) : a === document.body ? 'body' : 'elsewhere',
    text: v.textContent,
  };
}
// THE DOOR (v422) on Food, read in the page: how many there are, and the one
// button — its tag and type, its words, its glyphs (the utensils first, the
// chevron of a door row last: the markup icon() draws), whether the chevron
// sits at the reading end and how it is turned, what stands before it, how
// wide it is beside that — and `old`, whatever of v421's card Food still draws.
function readDoor() {
  const v = document.querySelector('.view.active[data-view="food"]');
  if (!v) return null;
  const doors = [...v.querySelectorAll('[data-shr-door]')];
  const old = v.querySelectorAll('#shr-card, .shr-card, .shr-periods, [data-shr-period], [data-shr-more], [data-shr-open], .shr-row, .shr-rows, [data-shr-sec]').length;
  const d = doors[0];
  if (!d) return { n: 0, old };
  const like = (name, size) => { const x = document.createElement('div'); x.innerHTML = icon(name, size); return x.firstElementChild ? x.firstElementChild.innerHTML : '?'; };
  const svgs = [...d.querySelectorAll('svg')];
  const name = d.querySelector('.shr-door-name'), chev = d.querySelector('.shr-door-chev');
  const cs = chev && chev.querySelector('svg');
  const nr = name && name.getBoundingClientRect(), cr = chev && chev.getBoundingClientRect();
  const rtl = getComputedStyle(d).direction === 'rtl';
  const prev = d.previousElementSibling;
  return {
    n: doors.length, old, tag: d.tagName, type: d.getAttribute('type'),
    text: d.textContent.replace(/\s+/g, ' ').trim(), name: name ? name.textContent.trim() : null,
    svgs: svgs.length, nums: d.querySelectorAll('.num').length,
    glyph: svgs[0] === d.firstElementChild && !!svgs[0] && svgs[0].innerHTML === like('utensils', 20),
    chevron: !!cs && cs === svgs[svgs.length - 1] && cs.innerHTML === like('chevronRight', 16),
    flip: cs ? getComputedStyle(cs).transform : null,
    end: nr && cr ? (rtl ? cr.right <= nr.left + 1 : cr.left >= nr.right - 1) : null,
    after: !prev ? null : prev.matches('.water-card') ? 'water' : prev.matches('.nutri-setup') ? 'setup' : prev.className,
    inHero: !!d.closest('.nutri-hero'),
    w: Math.round(d.getBoundingClientRect().width), hostW: prev ? Math.round(prev.getBoundingClientRect().width) : null,
  };
}
// The calories line as the page should print it: «المتبقّي اليوم ١٬٦٠٠ سعرة».
function leftText(n) {
  return t('widget_remaining') + ' ' + fmtNum(n) + ' ' + t('cal');
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
// LAYOUT (v421, case 35; the page since v422), in the page: «Larger text» set
// as asked, then one part measured — the open period's list, a ready meal's
// ingredient lines, or an own recipe's actions. `spills` names every element
// of a box that leaves it side to side, or scrolls its own content sideways
// (a box can hide its overflow).
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
  if (part === 'panel') {
    // The open period on the page: every row — mine, community, ready — and
    // its group captions, inside the period's card.
    const panel = document.querySelector('.view.active[data-view="suggestions"] .shr-pg-panel:not([hidden])');
    const sec = panel.closest('.shr-pg-sec');
    const rows = [...panel.querySelectorAll('.shr-row')];
    return {
      srcs: [...new Set(rows.map((b) => b.dataset.shrSrc))],
      spill: rows.flatMap((b) => spills(b).map((x) => b.dataset.shrSrc + ' ' + b.dataset.shrOpen + ': ' + x)),
      secSpill: sec.scrollWidth > sec.clientWidth + 1,
      pageSpill: document.documentElement.scrollWidth > window.innerWidth + 1,
      rowH: Math.min(...rows.map((b) => Math.round(b.getBoundingClientRect().height))),
      // A caption: drawn, inside the card, and wholly above the rows it heads.
      caps: [...panel.querySelectorAll('.shr-group')].map((p) => {
        const a = p.getBoundingClientRect(), s = sec.getBoundingClientRect(), next = p.nextElementSibling;
        return a.height > 0 && a.left >= s.left - 1 && a.right <= s.right + 1 && !!next && a.bottom <= next.getBoundingClientRect().top + 1;
      }),
    };
  }
  if (part === 'view') {
    // An own recipe's view from the page (v421 fix F1): three actions on one
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
// THE DOOR'S BOX (v422, case 15), «Larger text» as asked: its height, the
// weight and size of its words, its fill beside the card surface's (a probe
// painted with --card-bg where the door stands), any of its parts outside it,
// whether its name is cut, and whether the page scrolls sideways.
function doorLayout(lg) {
  document.body.classList.toggle('text-lg', lg);
  const d = document.querySelector('.view.active [data-shr-door]');
  const b = d.getBoundingClientRect(), cs = getComputedStyle(d), name = d.querySelector('.shr-door-name');
  const probe = document.createElement('div');
  probe.style.background = 'var(--card-bg)';
  d.parentElement.appendChild(probe);
  const card = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return {
    h: Math.round(b.height), weight: cs.fontWeight, size: parseFloat(cs.fontSize), fill: [cs.backgroundColor, card],
    outside: [...d.children].filter((c) => { const r = c.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1; }).map((c) => c.getAttribute('class') || c.tagName),
    clipped: !name || name.scrollWidth > name.clientWidth + 1,
    pageSpill: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}
// THE PAGE'S HEADERS (v422, case 15), «Larger text» as asked: each one's
// height; every part of it — the tile, the name, «الآن», the arrow — inside it
// and centred on its line; a name cut short; the space between two period
// cards; and whether the page scrolls sideways.
function headLayout(lg) {
  document.body.classList.toggle('text-lg', lg);
  const heads = [...document.querySelectorAll('.view.active[data-view="suggestions"] .shr-pg-head')];
  const out = { n: heads.length, h: [], outside: [], offCentre: [], clipped: [], gaps: [], chips: 0, pageSpill: document.documentElement.scrollWidth > window.innerWidth + 1 };
  for (const h of heads) {
    const b = h.getBoundingClientRect(), mid = b.top + b.height / 2;
    out.h.push(Math.round(b.height));
    for (const c of h.children) {
      const r = c.getBoundingClientRect(), what = h.dataset.shrSec + ' ' + (c.getAttribute('class') || c.tagName);
      if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1) out.outside.push(what);
      if (Math.abs(r.top + r.height / 2 - mid) > 1) out.offCentre.push(`${what} ${Math.round(r.top + r.height / 2 - mid)}px`);
    }
    const name = h.querySelector('.shr-pg-name');
    if (!name || name.scrollWidth > name.clientWidth + 1) out.clipped.push(h.dataset.shrSec);
    out.chips += h.querySelectorAll('.shr-pg-now').length;
  }
  const secs = [...document.querySelectorAll('.view.active[data-view="suggestions"] .shr-pg-sec')];
  for (let i = 1; i < secs.length; i++) out.gaps.push(Math.round(secs[i].getBoundingClientRect().top - secs[i - 1].getBoundingClientRect().bottom));
  return out;
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
  // Every period of the page closed again, whatever a case opened.
  SHR_OPEN = null;
}
const sheetUp = (page, sel) => page.waitForFunction((s) => !!document.querySelector('#modal-root .modal-overlay:not(.is-out) ' + s), sel, { timeout: 4000 });
const sheetGone = (page) => page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'), null, { timeout: 3000 });
// THE PAGE'S CONTROLS (v422): a period's header, a row of the open period.
const SEC = (p) => `.view.active[data-view="suggestions"] [data-shr-sec="${p}"]`;
const pageRow = (id) => `.view.active[data-view="suggestions"] [data-shr-open="${id}"]`;
// ARRIVE at the page — a navigation of its own, so every period is closed —
// and, given one, open that period with a tap on its header. The page as it reads.
async function arrive(kit, p) {
  await kit.reset('suggestions');
  if (p) await kit.page.locator(SEC(p)).click();
  return kit.page.evaluate(readPage);
}
// A tap on a period's header, on the page already on screen: it opens that
// period and closes the one open — or closes it, when it is the one open.
async function tapPeriod(page, p) {
  await page.locator(SEC(p)).click();
  return page.evaluate(readPage);
}
// …and «that period, open»: a tap only when it is not open already.
async function showPeriod(page, p) {
  const on = await page.evaluate((s) => { const h = document.querySelector(s); return !!h && h.getAttribute('aria-expanded') === 'true'; }, SEC(p));
  return on ? page.evaluate(readPage) : tapPeriod(page, p);
}
// Open a row's sheet from the page and wait for its ingredients: the row is
// tapped where it is drawn — in the period open now — or, drawn nowhere, in
// `p` (the clock's period unless named) after an arrival.
async function openRowSheet(kit, id, { p, items = true } = {}) {
  const { page } = kit;
  if (!(await page.evaluate((s) => !!document.querySelector(s), pageRow(id)))) await arrive(kit, p || (await clockPeriod(page)));
  await page.locator(pageRow(id)).click();
  await sheetUp(page, '#shr-log');
  if (items) await page.waitForFunction(() => document.querySelectorAll('#modal-root .modal-overlay:not(.is-out) .rec-view .cx-row [data-qty], #modal-root .modal-overlay:not(.is-out) .rec-view .cx-row > span:first-child').length > 1, null, { timeout: 4000 });
}
// The rows of one source's group on the page ([] when it has none).
const group = (s, src) => ((s.groups || []).find((g) => g.src === src) || { rows: [] }).rows;
// The bottom-nav tabs lit, each with its aria-current.
const litTabs = () => [...document.querySelectorAll('.nav-btn')].filter((b) => b.classList.contains('active')).map((b) => [b.dataset.view, b.getAttribute('aria-current')]);
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
  // the owner never saw it. v422: the card became a door and a page, and on
  // the first day every period of the page unfolds the ready meals.
  ['(1) the first day: with no community list — a null answer, a Cloud without the call, an empty list, and before the answer — Food carries the door titled «اقتراحات اليوم», and each of the four periods opens on the ready meals alone: every one it has, in rank order, priced from the catalogue, with no caption (one source), no «nothing yet» and no «show more»; the list arriving while a period is open adds its rows there by itself, captioned now — a sheet open over the page stays open, the headers are not drawn again, and the sheet closed hands focus back to its row drawn anew; Food pulls nothing, and an arrival inside the throttle neither', async (kit) => {
    const { page, ev, reset, lang } = kit;
    const { P, O } = await periods(page);
    const ready = await ev(readyMeals);
    const want = await ev(() => ({ title: t('shr_title'), community: t('shr_src_community'), builtin: t('shr_src_builtin') }));
    // THE TITLE is the spec's words (v421 §4), not only whatever the dictionary holds.
    assert.equal(want.title, lang === 'ar' ? 'اقتراحات اليوم' : 'Today’s suggestions', 'the door and the page are titled as the owner named them: ' + want.title);
    for (const [cfg, what] of [[{ rows: null }, 'a null answer (no session, an error)'], [{ pull: 'missing' }, 'a Cloud without pullSharedRecipes (an old cloud.js)'], [{ rows: [] }, 'an empty list']]) {
      await stubCloud(page, cfg);
      const answer = await load(page);
      if (cfg.pull === 'missing') assert.equal(answer, false, 'a Cloud without pullSharedRecipes answers false and throws nothing');
      await reset('food');
      const d = await ev(readDoor);
      assert.deepEqual([d.n, d.name], [1, want.title], `${what}: Food carries the door, titled «${want.title}»`);
      // DAY ONE (v422): every period has meals to unfold — each in turn, one tap each.
      await arrive(kit);
      for (const p of PERIODS) {
        const pg = await tapPeriod(page, p);
        const ids = rankIds(ready, p, 2000);
        assert.ok(ids.length >= 4, `setup: ${p} has at least four ready meals (v421 §1): ${ids.length}`);
        assert.deepEqual([pg.open, pg.rows], [[p], ids], `${what}: «${p}» opens on every ready meal it has, the best first: ${JSON.stringify(pg.rows)}`);
        assert.ok(pg.srcs.every((x) => x === 'builtin'), `${what}: ${p}: each row a ready meal (data-shr-src)`);
        // A caption tells groups apart (v421 fix F5): one source, none — a lone
        // «اقتراحات جاهزة» over every row would tell nothing, and repeat the
        // title's «اقتراحات».
        assert.deepEqual([pg.captions, pg.empty, pg.more], [0, [], 0], `${what}: ${p}: one source, so no caption at all; no «nothing yet»; no «show more» — the page is the whole list`);
        assert.deepEqual(pg.allRows, ids, `${what}: ${p}: and no row in a closed period`);
      }
    }
    // Each row is the meal priced from the catalogue: its name, its kcal, its macros.
    const first = await arrive(kit, P);
    const meals = first.rows.map((id) => ready.find((r) => r.id === id));
    assert.deepEqual(first.titles, meals.map((m) => m.name), 'the ready meals by name, in the reader\'s language');
    const text = [];
    for (const m of meals) text.push(await ev(rowText, m));
    assert.deepEqual([first.figs, first.subs], [text.map((x) => x.fig), text.map((x) => x.sub)], 'each with one serving\'s figures — the sum of its ingredients, priced from the catalogue');
    // BEFORE THE ANSWER: the page paints from memory — the ready meals — and
    // the list, once it answers, puts its rows into the open period by itself:
    // the page's own wiring, no second arrival.
    const rows = sixRows('qa-c1', P, O);
    await stubCloud(page, { pull: 'deferred' });
    await ev(() => { window.__shrLoading = loadSharedRecipes({ force: true }); });
    let s = await arrive(kit, P);
    assert.deepEqual([s.rows, s.captions], [rankIds(ready, P, 2000), 0], 'the pull has not answered: the open period holds the ready meals meanwhile, uncaptioned');
    // A SHEET OPEN when the list answers (§2: the open panel is drawn again,
    // never the whole page): the sheet stays over the page, and the headers are
    // the very nodes they were — a whole page drawn again would replace them.
    await ev((sel) => { window.__qaHead = document.querySelector(sel); }, SEC(P));
    const tapped = s.rows[0];
    await page.locator(pageRow(tapped)).click();
    await sheetUp(page, '#shr-log');
    await ev((rows) => window.__shr.release(rows), rows);
    await page.waitForFunction((id) => !!document.querySelector(`.view.active [data-shr-open="${id}"]`), rankIds(rows, P, 2000)[0], { timeout: 3000 }).catch(() => {});
    const kept = await ev((sel) => [!!document.querySelector('#modal-root .modal-overlay:not(.is-out) #shr-log'), !!window.__qaHead && window.__qaHead.isConnected && window.__qaHead === document.querySelector(sel)], SEC(P));
    await ev(() => { delete window.__qaHead; closeModal(); });
    await sheetGone(page);
    assert.deepEqual(kept, [true, true], 'the list answering under an open sheet draws the open panel alone: the sheet stays open, the headers stay the same nodes');
    s = await ev(readPage);
    // The row the sheet was opened from was drawn anew under it (v422 review):
    // the sheet hands focus back to THAT row, by its id — never to <body>.
    assert.equal(s.focus, 'row:' + tapped, 'the sheet closed, focus is back on the row it was opened from — drawn anew by the list\'s arrival under the sheet — not on <body>');
    assert.deepEqual(s.groups.map((g) => [g.src, g.text, g.rows]), [['community', want.community, rankIds(rows, P, 2000)], ['builtin', want.builtin, rankIds(ready, P, 2000)]],
      'the list in, the open period gains the community\'s rows by itself, each group under its caption now that two sources have rows: ' + JSON.stringify(s.groups.map((g) => [g.src, g.rows.length])));
    assert.deepEqual(s.open, [P], 'and the period stays open');
    assert.ok(!/[{}]/.test(s.text), 'no unfilled placeholder: ' + s.text.trim().slice(0, 200));
    // FOOD PULLS NOTHING — it draws a door — and an arrival inside the
    // five-minute throttle reads what memory holds.
    await reset('food');
    await page.locator('.view.active [data-add-water="250"]').click();
    assert.equal(((await ev(readDoor)) || {}).n, 1, 'the water tap repaints the dashboard, the door with it');
    await arrive(kit, P);
    assert.equal(await ev(() => window.__shr.pulls), 1, 'one pull in all: the first arrival shared the one in flight, Food reads nothing of the list, and the next arrival waits out the throttle');
  }],

  // v422: the period buttons became the page's accordion.
  ['(2) the accordion: an arrival finds the four periods closed — headers in a day\'s order, each a disclosure naming its own panel, «الآن» on the clock\'s alone; a tap opens that period alone, focus staying on its header and nothing else opening; another tap opens another and closes the first; a second tap closes it; a log from its list keeps it open, focus back on the row, and so do a re-render, the Undo and a Back to the page; leaving for Food and coming back through the door finds every period closed', async (kit) => {
    const { page, ev, lang } = kit;
    const { P, O, PICK } = await periods(page);
    const rows = sixRows('qa-c2', P, O).concat([row('qa-c2-pick', 'Pick of the period', [PICK], 400, 30, 40, 10, 1, 5)]);
    await stubCloud(page, { rows, items: { 'qa-c2-pick': TUNA_ITEMS } });
    await load(page);
    const pool = community(rows).concat(await ev(readyMeals));
    const want = await ev(() => ({ labels: ['breakfast', 'lunch', 'snack', 'dinner'].map((p) => t('shr_meal_' + p)), now: t('shr_now') }));
    assert.equal(want.now, lang === 'ar' ? 'الآن' : 'Now', 'the chip says «الآن» / «Now»: ' + want.now);
    // AN ARRIVAL: all four closed.
    let s = await arrive(kit);
    assert.deepEqual(s.heads.map((h) => [h.p, h.name]), PERIODS.map((p, i) => [p, want.labels[i]]), 'four periods in the order of a day, each by its name in the reader\'s language');
    assert.ok(s.heads.every((h) => h.inH2 && h.controls === 'shr-pg-' + h.p), 'each header a button inside an <h2>, naming its own panel (aria-controls): ' + JSON.stringify(s.heads));
    assert.ok(s.panels.every((x) => x && x.home), 'and every panel it names is there, in its period\'s own card');
    assert.deepEqual([s.open, s.heads.map((h) => h.expanded), s.allRows], [[], ['false', 'false', 'false', 'false'], []], 'on arrival all four are CLOSED: no header expanded, no row anywhere');
    assert.ok(s.panels.every((x) => x.hidden && !x.shown && !x.rows), 'every panel hidden and empty: ' + JSON.stringify(s.panels));
    assert.deepEqual(s.heads.filter((h) => h.now).map((h) => [h.p, h.now]), [[P, want.now]], `«${want.now}» on the clock's period (${P}) and on no other`);
    // A TAP opens that period, and that one alone.
    s = await tapPeriod(page, PICK);
    assert.deepEqual([s.open, s.heads.map((h) => h.expanded)], [[PICK], PERIODS.map((p) => String(p === PICK))], `a tap on «${PICK}» opens it alone: ${JSON.stringify(s.heads.map((h) => h.expanded))}`);
    assert.deepEqual(s.panels.map((x) => x.shown), PERIODS.map((p) => p === PICK), 'its panel alone is drawn');
    assert.deepEqual(s.groups.map((g) => [g.src, g.rows]), groupIds(pool, PICK, 2000), `${PICK}'s rows: the community's, then the ready meals, each in rank order: ${JSON.stringify(s.rows)}`);
    assert.equal(s.rows[0], 'qa-c2-pick', `the community's best for ${PICK} leads`);
    assert.deepEqual(s.allRows, s.rows, 'and no row anywhere else');
    assert.equal(s.focus, 'sec:' + PICK, 'focus stays on the header pressed (the page was repainted around it)');
    assert.deepEqual(await ev(() => [currentView, !!document.querySelector('#modal-root .modal-overlay:not(.is-out)')]), ['suggestions', false], 'a header opens nothing else: no screen, no sheet');
    // ANOTHER TAP opens another period and closes the first.
    s = await tapPeriod(page, P);
    assert.deepEqual([s.open, s.groups.map((g) => [g.src, g.rows])], [[P], groupIds(pool, P, 2000)], `«${P}» opens, with its own rows`);
    const was = s.panels[PERIODS.indexOf(PICK)];
    assert.deepEqual([was.shown, was.rows, s.allRows], [false, 0, s.rows], `and «${PICK}» is closed, its rows gone: one period open at a time`);
    // A SECOND TAP on the open one closes it.
    s = await tapPeriod(page, P);
    assert.deepEqual([s.open, s.allRows, s.panels.map((x) => x.shown)], [[], [], [false, false, false, false]], 'a second tap on the open period closes it: none open');
    assert.equal(s.focus, 'sec:' + P, 'focus still on its header');
    // A LOG keeps the period open…
    await tapPeriod(page, PICK);
    await openRowSheet(kit, 'qa-c2-pick', { items: false });
    await page.locator('#shr-log').click();
    await sheetGone(page);
    s = await ev(readPage);
    assert.deepEqual(s.open, [PICK], 'the period holds through a log and the repaint after it');
    assert.equal(s.left, await ev(leftText, 1600), 'the calories left moved with the serving, 2,000 → 1,600, on the same paint');
    assert.equal(s.focus, 'row:qa-c2-pick', 'and focus is back on the row the sheet was opened from — the repaint drew that row anew and handed it the focus');
    // …and so does a re-render…
    await ev(() => renderView('suggestions'));
    assert.deepEqual((await ev(readPage)).open, [PICK], 'a re-render of the page (renderView) keeps it open');
    // …and the Undo, which draws the screen again.
    await page.locator('#toast.show .toast-action').click();
    await page.waitForFunction(() => DB.foodLogs.listForDate(todayISO()).length === 0, null, { timeout: 2000 }).catch(() => {});
    s = await ev(readPage);
    assert.deepEqual([s.open, s.left], [[PICK], await ev(leftText, 2000)], 'the Undo draws the page again: the period still open, the calories back to 2,000');
    // …and so does a BACK to this page (v422 review): another screen, then the
    // browser's Back — the router hands the page its own entry again (its
    // context object, its scroll offset), which is not a new arrival.
    await page.locator('.nav-btn[data-view="home"]').click();
    await page.waitForFunction(() => currentView === 'home', null, { timeout: 3000 });
    await ev(() => history.back());
    await page.waitForFunction(() => currentView === 'suggestions', null, { timeout: 3000 }).catch(() => {});
    s = await ev(readPage);
    assert.deepEqual([await ev(() => currentView), s && s.open], ['suggestions', [PICK]], 'Home, then Back: the page again, its period still open — a Back returns to the same entry');
    // LEAVING AND COMING BACK: the Food tab, then the door — a new arrival.
    await page.locator('.nav-btn[data-view="food"]').click();
    await page.waitForFunction(() => currentView === 'food', null, { timeout: 3000 });
    await page.locator('.view.active [data-shr-door]').click();
    await page.waitForFunction(() => currentView === 'suggestions', null, { timeout: 3000 });
    s = await ev(readPage);
    assert.deepEqual([s.open, s.allRows], [[], []], 'leaving for Food and coming back through the door: every period closed again');
  }],

  // v421: the card held one row of each source and «show more» the rest; the
  // page's open period is the whole ranking (v422).
  ['(3) the ranking: with 500 kcal left the page says so, and the fitting recipes lead the open period (E, D, C), the ready meals by the same rule; without a target there is no calories line, the door stands under the setup button, and protein per kcal decides (C, E, D)', async (kit) => {
    const { page, ev, reset } = kit;
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
    const ready = await ev(readyMeals);
    const pool = community(rows).concat(ready);
    let s = await arrive(kit, P);
    assert.equal(s.left, await ev(leftText, 500), 'the calories left today, above the periods: 500 — the figure the list is fitted to');
    assert.deepEqual(group(s, 'community').map((id) => rows.find((r) => r.id === id).name), ['Dish E', 'Dish D', 'Dish C'], 'with 500 kcal left: what fits first, by protein per kcal; then the rest');
    assert.deepEqual(group(s, 'builtin'), rankIds(ready, P, 500), 'and the ready meals by the same rule');
    assert.deepEqual(s.groups.map((g) => [g.src, g.rows]), groupIds(pool, P, 500), 'the whole period and nothing of another (Dish F is not here)');
    await ev(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
    await reset('food');
    // The Food tab opens the calculator by itself when no target is set.
    await page.waitForTimeout(400);
    await ev(() => { try { closeModal(); } catch (_) {} });
    await sheetGone(page);
    const d = await ev(readDoor);
    assert.deepEqual([d.n, d.after], [1, 'setup'], 'no target: the door stands under the setup button');
    s = await arrive(kit, P);
    assert.equal(s.left, null, 'and the page draws no calories line');
    assert.equal(await ev(() => document.querySelectorAll('.view.active .shr-pg-left').length), 0, 'not even an empty frame for one');
    assert.deepEqual(group(s, 'community').map((id) => rows.find((r) => r.id === id).name), ['Dish C', 'Dish E', 'Dish D'], 'no target → protein per kcal alone');
    assert.deepEqual(group(s, 'builtin'), rankIds(ready, P, null), 'the ready meals too');
  }],

  // v421: a period no community recipe suits used to hold one «nothing yet»
  // line; the ready meals cover every period. v422: all of them, no cap.
  ['(4) a period no community recipe suits opens on its ready meals alone — every one it has, in rank order, uncaptioned, with no «nothing yet» and no «show more»', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    const empty = PERIODS.find((p) => p !== P && p !== O);
    await stubCloud(page, { rows: sixRows('qa-c4', P, O) });
    await load(page);
    const ready = await ev(readyMeals);
    const none = await ev(() => t('shr_none'));
    const s = await arrive(kit, empty);
    const ids = rankIds(ready, empty, 2000);
    assert.deepEqual([s.open, s.rows], [[empty], ids], `no community recipe suits ${empty}: every ready meal it has (${ids.length}), by rank: ${JSON.stringify(s.rows)}`);
    assert.ok(s.srcs.every((x) => x === 'builtin'), 'ready meals only');
    assert.deepEqual([s.captions, s.empty, s.more], [0, [], 0], `one source: no caption, no «${none}», no «show more» — the list is whole`);
  }],

  // v421: «show more» grouped the period; v422: the open period IS that list.
  ['(5) an open period lists the whole period under three captions — my recipes, other users\', ready meals — each group in rank order, no row with a caption of its own; a row there opens its sheet: an own recipe its view, a community recipe or a ready meal the suggestion sheet', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    const rows = sixRows('qa-c5', P, O);
    await stubCloud(page, { rows, items: { 'qa-c5-4': TUNA_ITEMS } });
    await load(page);
    const rec = await ownRecipe(page, BOWL);
    const ready = await ev(readyMeals);
    const s = await arrive(kit, P);
    const want = await ev(() => ({ mine: t('shr_src_mine'), community: t('shr_src_community'), builtin: t('shr_src_builtin'), log: t('shr_log') }));
    assert.deepEqual(s.groups.map((g) => [g.src, g.text]), [['mine', want.mine], ['community', want.community], ['builtin', want.builtin]], 'three captions, in order: «' + [want.mine, want.community, want.builtin].join('», «') + '»');
    const groups = [['mine:' + rec.id], rankIds(rows, P, 2000), rankIds(ready, P, 2000)];
    assert.deepEqual(s.groups.map((g) => g.rows), groups, 'under each, the period\'s rows of that source in rank order');
    assert.deepEqual(s.rows, groups.flat(), 'and no row outside a group');
    assert.deepEqual(s.srcs, s.groups.flatMap((g) => g.rows.map(() => g.src)), 'every row under its own source\'s caption');
    assert.equal(s.rowCaps, 0, 'a row under its caption carries none of its own');
    // The own recipe opens the recipe itself…
    await page.locator(pageRow('mine:' + rec.id)).click();
    await sheetUp(page, '[data-edit-view]').catch(() => {});
    const v = (await ev(readSheet)) || {};
    assert.deepEqual([v.title, !!v.edit, v.log, v.report], [BOWL.name, true, null, null], 'an own recipe opens its recipe view — «edit» on it — not the suggestion sheet');
    assert.deepEqual([v.logView, (v.actions || [])[0]], [{ text: want.log, disabled: false, primary: true }, 'log'], 'and, opened from a suggestion, «' + want.log + '» first on it (v421 fix F1)');
    // …a community row the suggestion sheet…
    await ev(() => closeModal());
    await sheetGone(page);
    await page.locator(pageRow('qa-c5-4')).click();
    await sheetUp(page, '#shr-log');
    assert.equal((await ev(readSheet)).title, 'Oat porridge', 'a community row opens that recipe');
    // …and a ready meal its own: the meal's name, with nothing to report.
    await ev(() => closeModal());
    await sheetGone(page);
    const meal = ready.find((r) => r.id === groups[2][groups[2].length - 1]);
    await page.locator(pageRow(meal.id)).click();
    await sheetUp(page, '#shr-log');
    const b = await ev(readSheet);
    assert.deepEqual([b.title, b.names, b.report], [meal.name, meal.items.map((it) => it.name), null], 'a ready meal opens with its own ingredients, and no report');
  }],

  ['(6) a tap opens the recipe: its name, one serving\'s figures, the ingredients fetched on the tap, and a stepper that scales 4 → 2', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c6', P, O), items: { 'qa-c6-3': TUNA_ITEMS }, itemsDelay: 400 });
    await load(page);
    await arrive(kit, P);
    await page.locator(pageRow('qa-c6-3')).click();
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

  ['(7) «Log a serving» writes ONE row of one serving with the per-serving figures, closes, repaints the page — the calories left move, the period stays open — and Undo takes it back; a name holding «$&» is toasted as written', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c7', P, O), items: { 'qa-c7-3': TUNA_ITEMS } });
    await load(page);
    await openRowSheet(kit, 'qa-c7-3');
    await page.locator('#modal-root .rt-step [data-step="-1"]').click();   // the stepper scales amounts, never the log
    await page.locator('#shr-log').click();
    await sheetGone(page);
    assert.deepEqual(await ev(rowsToday), [{ name: 'Tuna salad', servings: 1, calories: 250, protein: 30, carbs: 10, fat: 12, source: 'shared' }], 'one row, one serving, the serving\'s figures, source «shared»');
    const s = await ev(readPage);
    assert.deepEqual([s.left, s.open], [await ev(leftText, 1750), [P]], 'the page repainted: 1,750 left, the period still open');
    const msg = await ev(toastText);
    assert.equal(msg, await ev(() => t('rec_logged').replace('{name}', 'Tuna salad')), 'the toast names the recipe');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await ev(rowsToday), [], 'Undo takes the row back');
    assert.equal((await ev(readPage)).left, await ev(leftText, 2000), 'and the page is drawn again: 2,000 left');
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

  ['(8) «Save to my recipes» makes a copy with its own item ids and nothing of the server\'s; the button says it is in the recipes, and still does on reopening; the copy stands in for the row it was saved from — on the page behind at once (the sheet, closed, hands focus to the period\'s header), and at the next arrival', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c8', P, O), items: { 'qa-c8-3': TUNA_ITEMS } });
    await load(page);
    await openRowSheet(kit, 'qa-c8-3');
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
    // ONE MEAL, ONE ROW (v421 fix F3b): the copy stands in for the row it was
    // saved from — same name, servings and kcal — on the page behind at once
    // (no row left there whose door opens nothing) and at the next arrival; it
    // is the user's own now, under the periods that row carried.
    const mine = 'mine:' + r.id;
    const cap = await ev(() => t('shr_src_mine'));
    let pg = await ev(readPage);
    assert.deepEqual([pg.rows[0], pg.srcs[0], pg.groups[0] && [pg.groups[0].src, pg.groups[0].text]], [mine, 'mine', ['mine', cap]], 'the page behind the sheet already leads with the copy, under «' + cap + '»: ' + JSON.stringify(pg.rows.slice(0, 4)));
    assert.ok(!pg.allRows.includes('qa-c8-3'), 'and the row it was saved from is gone from it: ' + JSON.stringify(pg.rows.slice(0, 4)));
    // ESCAPE closes the sheet (v422 review): the row it was opened from is
    // gone — the copy stands in for it — so focus goes to its period's header,
    // never to <body>.
    await page.keyboard.press('Escape');
    await sheetGone(page);
    assert.equal((await ev(readPage)).focus, 'sec:' + P, 'the sheet closed, focus is on the open period\'s header — the row it was opened from was repainted away under the sheet');
    pg = await arrive(kit, P);
    assert.deepEqual([group(pg, 'mine'), pg.allRows.includes('qa-c8-3')], [[mine], false], 'the next arrival lists the recipe once, as the user\'s own');
    // Reached directly, that row's sheet still says the copy is saved.
    await ev((r) => openSharedRecipe(r, null, () => {}), sixRows('qa-c8', P, O)[2]);
    await sheetUp(page, '#shr-log');
    await page.waitForFunction(() => document.querySelectorAll('#modal-root .rec-view [data-qty]').length === 3, null, { timeout: 4000 });
    assert.deepEqual((await ev(readSheet)).save, { text: await ev(() => t('shr_in_recipes')), disabled: true }, 'reopened, it is still in the recipes');
  }],

  ['(9) report: one feedback row «recipe-report:<id>», a thank-you, and the row leaves the page; signed out it asks for a sign-in and sends nothing', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    await stubCloud(page, { rows: sixRows('qa-c9', P, O), items: { 'qa-c9-3': TUNA_ITEMS, 'qa-c9-1': TUNA_ITEMS } });
    await load(page);
    await openRowSheet(kit, 'qa-c9-3', { items: false });
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
    const c = await ev(readPage);
    assert.ok(c.open.length === 1 && c.rows.length && !c.allRows.includes('qa-c9-3'), 'the reported recipe leaves the open period at once: ' + JSON.stringify(c.rows));
    // Signed out: the sheet says so, and nothing is sent.
    await stubCloud(page, { rows: sixRows('qa-c9', P, O), items: { 'qa-c9-1': TUNA_ITEMS }, signedIn: false });
    await openRowSheet(kit, 'qa-c9-1', { items: false });
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

  ['(14) untrusted text: a name carrying markup never becomes an element — the page, the sheet, the ingredients, the report — and a row with an unsafe id is dropped', async (kit) => {
    const { page, ev } = kit;
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
    // Scoped to the page and the sheets: an exercise photo elsewhere carries a
    // legitimate onerror="this.remove()".
    const noMarkup = () => ({ img: document.querySelectorAll('.view[data-view="suggestions"] img, #modal-root img').length, onerror: document.querySelectorAll('.view[data-view="suggestions"] [onerror], #modal-root [onerror]').length,
      b: document.querySelectorAll('.view[data-view="suggestions"] b, #modal-root .rec-view b, #modal-root .rec-view i').length });
    const c = await arrive(kit, P);
    const safe = rows.filter((r) => /^qa-x-\d$/.test(r.id));
    assert.deepEqual(group(c, 'community'), rankIds(safe, P, 2000), 'the two unsafe ids are gone; the four safe rows rank as usual: ' + JSON.stringify(group(c, 'community')));
    assert.ok(!c.allRows.includes('bad id!') && !c.allRows.includes('../../x'), 'neither unsafe id is drawn anywhere on the page');
    assert.equal(c.rows[0], 'qa-x-1', 'the community\'s best safe row leads — the two that out-rank it are the unsafe ones');
    assert.equal(c.titles[0], XSS, 'the name prints as text');
    assert.deepEqual(await ev(noMarkup), { img: 0, onerror: 0, b: 0 }, 'no element made of it on the page');
    await openRowSheet(kit, 'qa-x-1', { items: false });
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
    await sheetGone(page);
    assert.deepEqual(await ev(noMarkup), { img: 0, onerror: 0, b: 0 }, 'nor on the page once the sheets are gone');
    await page.waitForTimeout(300);
    assert.equal(await ev(() => typeof window.__xss), 'undefined', 'no handler ever ran');
  }],

  // v422: the period buttons are gone; the page's headers and Food's door are
  // the controls to fit.
  ['(15) layout at 375 and 320, with and without «Larger text»: the door is the L rung on the card surface — at least 52 tall, its words 15px (larger with «Larger text») at 700 — its parts inside it and its name whole; every period header at least 56 tall (the floor is 44), its tile, name, «الآن» and arrow inside it and on one line, its name whole, closed and open; the period cards a step (12px) apart; nothing wider than the screen', async (kit) => {
    const { page, ev, reset } = kit;
    const { P } = await periods(page);
    try {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        for (const lg of [false, true]) {
          const where = `${width}px${lg ? ' + larger text' : ''}`;
          await reset('food');
          const d = await ev(doorLayout, lg);
          assert.ok(d.h >= 52, `the door is at least 52 tall, the L rung, at ${where}: ${d.h}`);
          assert.equal(d.weight, '700', `its words at 700 at ${where}`);
          assert.ok(lg ? d.size > 15 : d.size === 15, `its words 15px — larger with «Larger text» — at ${where}: ${d.size}`);
          assert.equal(d.fill[0], d.fill[1], `the door wears the card surface, never an accent fill — «حدّد هدفك اليومي» is the screen's one filled action — at ${where}: ${JSON.stringify(d.fill)}`);
          assert.deepEqual([d.outside, d.clipped, d.pageSpill], [[], false, false], `the door's glyph, name and chevron inside it, its name whole, nothing wider than the screen at ${where}: ${JSON.stringify(d)}`);
          for (const open of [null, P]) {
            await arrive(kit, open);
            const h = await ev(headLayout, lg);
            const state = open ? `${where}, «${open}» open` : where;
            assert.equal(h.n, 4, `setup: four headers at ${state}`);
            assert.ok(h.h.every((x) => x >= 56), `every header at least 56 tall at ${state}: ${h.h}`);
            assert.deepEqual([h.outside, h.offCentre, h.clipped], [[], [], []], `each header's tile, name, «الآن» and arrow inside it and centred on its line, every name whole, at ${state}: ${JSON.stringify(h)}`);
            assert.equal(h.chips, 1, `setup: one «الآن» at ${state}`);
            assert.deepEqual(h.gaps, [12, 12, 12], `the period cards 12px apart (--sp-3) at ${state}: ${h.gaps}`);
            assert.equal(h.pageSpill, false, `the page is not wider than the screen at ${state}`);
          }
        }
      }
    } finally {
      await ev(() => document.body.classList.remove('text-lg'));
      await page.setViewportSize({ width: 375, height: 812 });
    }
  }],

  // v419 took the user's own published rows OFF their card; v420 put the
  // feed's copy back on it. v421: the recipe is the user's OWN row now — once,
  // under the periods the review gave its published copy — and the feed's copy
  // is left out. v422: the same, on the page.
  ['(16) the user\'s own PUBLISHED recipe is suggested once, as their own — under the periods its published copy carries — and the feed\'s copy is left out of the page; should that copy still reach the suggestion sheet it offers no copy and no report; withdrawn from the page, the copy the list still holds is not suggested back, and the view keeps «سجّل حصّة»', async (kit) => {
    const { page, ev } = kit;
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
    const want = await ev(() => ({ log: t('shr_log'), save: t('shr_save'), mine: t('shr_in_recipes'), report: t('shr_report'), cap: t('shr_src_mine') }));
    const pool = [mineRow(await ev(recOf, rec.id), rows)].concat(community(rows.filter((r) => r.id !== pubRow.id)), await ev(readyMeals));
    const mine = 'mine:' + rec.id;
    let c = await arrive(kit, P);
    assert.ok(!c.allRows.includes(mine), `its published copy suits ${O} alone, so our recipe is not in ${P}: ${JSON.stringify(c.rows.slice(0, 4))}`);
    assert.ok(!c.allRows.includes(pubRow.id), 'and neither is the feed\'s copy');
    assert.deepEqual(c.groups.map((g) => [g.src, g.rows]), groupIds(pool, P, 2000), `${P}'s list as the pool reads without it`);
    c = await tapPeriod(page, O);
    assert.deepEqual([c.rows[0], c.srcs[0], c.groups[0] && [c.groups[0].src, c.groups[0].text, c.groups[0].rows]], [mine, 'mine', ['mine', want.cap, [mine]]], `in ${O}, the period its published copy carries, our recipe heads the list — as our own, under «${want.cap}»`);
    assert.ok(!c.allRows.includes(pubRow.id), 'and the feed\'s copy is not on the page: the recipe appears ONCE');
    assert.deepEqual(c.groups.map((g) => [g.src, g.rows]), groupIds(pool, O, 2000), `${O}'s list: our recipe, then the others, each group in rank order`);
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
    // «أزل من المشاركة» FROM THE PAGE (v421 fixes F1, F3c). The list in memory
    // still holds the copy just withdrawn, and with the marker gone nothing
    // names it as ours: it must leave the page at once, not come back as
    // another user's recipe with «أبلِغ» on it. And the view, drawn again by
    // the withdraw, keeps the «سجّل حصّة» the page opened it with.
    const words = await ev(() => ({ share: t('shr_share'), unshare: t('shr_unshare'), log: t('shr_log') }));
    await arrive(kit, O);
    await page.locator(pageRow(mine)).click();
    await sheetUp(page, '[data-edit-view]');
    const before = await ev(readSheet);
    assert.deepEqual([before.share && before.share.text, before.actions], [words.unshare, ['log', 'edit', 'share']], 'setup: our published recipe\'s view from the page — «' + words.log + '», «edit», «' + words.unshare + '»');
    await page.locator('#modal-root [data-share-view]').click();
    await page.waitForFunction((s) => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-share-view]'); return !!b && b.textContent.trim() === s; }, words.share, { timeout: 4000 });
    assert.deepEqual(await ev(() => window.__shr.withdraw), [pubRow.id], 'setup: withdrawn by its published id');
    assert.deepEqual((await ev(readSheet)).actions, ['log', 'edit', 'share'], 'the view drawn again after the withdraw keeps «' + words.log + '» first');
    await ev(() => closeModal());
    await sheetGone(page);
    c = await arrive(kit, O);
    assert.ok(c.allRows.includes(mine) && !c.allRows.includes(pubRow.id), `the withdrawn copy is not in ${O} as another user's recipe — ours is there, once: ${JSON.stringify(c.rows.slice(0, 4))}`);
    assert.deepEqual(group(c, 'mine'), [mine], 'under «' + want.cap + '»');
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
  ['(18) a save in the editor: the notice with «أوقِفها», then — when its window ends — exactly ONE request; the marker carries its sig, the list is pulled fresh and the page repainted; an unchanged re-save sends nothing, an edit sends one more for the same sourceId', async (kit) => {
    const { page, ev, worker, clock, answered } = kit;
    await account(kit, { seen: false, freshRows: [ownRow('pub-18', 'QA auto bowl')] });
    await load(page);
    // THE PAGE ON SHOW, the clock's period open: an approval's repaint is the
    // page's (v422 — Food holds the door alone and has nothing to redraw).
    const c0 = await arrive(kit, await clockPeriod(page));
    assert.ok(c0 && c0.srcs.length && c0.srcs.every((s) => s === 'builtin'), 'setup: no recipe of ours and none of the community — the open period holds ready meals alone: ' + JSON.stringify(c0 && c0.rows));
    const want = await ev(() => ({ notice: t('shr_auto_notice'), stop: t('shr_auto_stop') }));
    worker.queue.push(APPROVE('pub-18'));
    const t0 = await ev(pageNow);
    const rec = await editorSave(kit, { draft: dish('QA auto bowl') });
    assert.ok(rec && !rec.shared, 'setup: the recipe is saved, and not shared');
    // The editor's save draws nothing on the page behind it (its onDone is a
    // no-op here): what the page shows later, a repaint put there.
    assert.ok(!(await ev(readPage)).allRows.includes('mine:' + rec.id), 'setup: the save itself does not redraw the page');
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
    // caches, and the open period alone is drawn again — on a page nobody
    // re-rendered — the recipe in it ONCE, as the user's own (v421): the
    // feed's copy of it, pub-18, is left out.
    await page.waitForFunction((id) => !!document.querySelector(`.view.active [data-shr-open="mine:${id}"]`), rec.id, { timeout: 3000 }).catch(() => {});
    assert.equal(await ev(() => window.__shr.fresh), 1, 'the community list was pulled fresh, once');
    const c1 = (await ev(readPage)) || { rows: [], groups: [], allRows: [] };
    assert.deepEqual([c1.rows[0], (c1.groups[0] || {}).src, c1.allRows.includes('pub-18')], ['mine:' + rec.id, 'mine', false], 'and the page was painted, the recipe first in the open period as the user\'s own, the feed\'s copy left out: ' + JSON.stringify(c1.rows.slice(0, 4)));
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
    assert.equal(((await ev(readPage)) || { titles: [] }).titles[0], 'QA auto bowl', 'setup: the edit\'s save draws nothing on the page either');
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
    // The page is drawn again from the fresh list: the edit's name on its own
    // row — nothing but that repaint drew the page since the save — and the
    // new copy, pub-18b, left out too.
    await page.waitForFunction((n) => { const t = document.querySelector('.view.active .shr-pg-panel:not([hidden]) .shr-row .fig-row-title'); return !!t && t.textContent === n; }, 'QA auto bowl, edited', { timeout: 3000 }).catch(() => {});
    const c2 = (await ev(readPage)) || { rows: [], titles: [], allRows: [] };
    assert.deepEqual([c2.rows[0], c2.titles[0], c2.allRows.includes('pub-18b')], ['mine:' + rec.id, 'QA auto bowl, edited', false], 'the page is drawn again from the fresh list: our row with the edit, the new copy left out: ' + JSON.stringify(c2.rows.slice(0, 4)));
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
    await openRowSheet(kit, 'qa-c20-3');
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
      // …and the page (v422), where the prices are read now — Food reads none
      // of them: a period opens whatever throws under it, every row it cannot
      // price left out, and nothing escapes the tap.
      const errs = kit.errors.length;
      const pg = await arrive(kit, await clockPeriod(page));
      assert.deepEqual([pg.open.length, pg.srcs.filter((x) => x !== 'community'), kit.errors.slice(errs)], [1, [], []],
        'a price that throws: the page still opens its period — every row it cannot price (the user\'s, the ready meals) left out — and nothing escapes the tap: ' + JSON.stringify([pg.open, pg.srcs, kit.errors.slice(errs)]));
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
    await openRowSheet(kit, 'qa-c26-3');
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
    await openRowSheet(kit, 'qa-c26-3');
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
    const pg = await arrive(kit, await clockPeriod(page));
    assert.ok(pg && pg.rows.length && !pg.allRows.includes('pub-31-add'), 'nor drawn on the page: ' + JSON.stringify(pg && pg.rows.slice(0, 4)));
    await reset('food');
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

  // ── «اقتراحات اليوم» (v421; the page since v422) ─────────────────────────
  // The three sources in one list. Every expectation is this file's own: the
  // list's order (groupIds), the ready meals priced from the catalogue
  // (readyMeals), the user's own recipe read back as stored (mineRow).
  ['(33) the user\'s own recipe heads the open period under «من وصفاتي» — the first group — even when it ranks last of all; the community\'s rows follow under «من المستخدمين», the ready meals under «اقتراحات جاهزة», each group in rank order; the own row opens the recipe view with «سجّل حصّة» first — one serving, Undo, a name with «$» as written — and «تعديل» there lands back on the page, the period still open; the picker\'s view is unchanged', async (kit) => {
    const { page, ev } = kit;
    const { P, O } = await periods(page);
    const rows = sixRows('qa-c33', P, O);
    await stubCloud(page, { rows });
    await load(page);
    const rec = await ownRecipe(page, RICE);
    const ready = await ev(readyMeals);
    const mine = mineRow(await ev(recOf, rec.id), rows);
    const pool = [mine].concat(community(rows), ready);
    assert.ok(rankIds(pool, P, 2000).indexOf(mine.id) >= 3, 'setup: by rank alone our recipe would come after three others at least: ' + rankIds(pool, P, 2000).indexOf(mine.id));
    const want = await ev(() => ({ mine: t('shr_src_mine'), community: t('shr_src_community'), builtin: t('shr_src_builtin') }));
    const c = await arrive(kit, P);
    assert.deepEqual(c.groups.map((g) => [g.src, g.text]), [['mine', want.mine], ['community', want.community], ['builtin', want.builtin]], `three groups, ours first: «${want.mine}», «${want.community}», «${want.builtin}»`);
    assert.deepEqual(c.groups.map((g) => [g.src, g.rows]), groupIds(pool, P, 2000), 'each group in rank order');
    assert.equal(c.rows[0], mine.id, 'our recipe is the list\'s first row although it ranks last: ' + JSON.stringify(c.rows.slice(0, 4)));
    assert.deepEqual(c.srcs, c.groups.flatMap((g) => g.rows.map(() => g.src)), 'each row names its source (data-shr-src) — the group it stands under');
    assert.equal(c.rowCaps, 0, 'and carries no caption of its own: its group\'s says it');
    const text = await ev(rowText, mine);
    assert.deepEqual([c.titles[0], c.figs[0], c.subs[0]], [RICE.name, text.fig, text.sub], 'our row: the recipe\'s name and one serving\'s figures');
    // The tap opens the recipe itself — the view the picker opens.
    await page.locator(pageRow(mine.id)).click();
    await sheetUp(page, '[data-edit-view]').catch(() => {});
    const v = (await ev(readSheet)) || {};
    assert.equal(v.title, RICE.name, 'the row opens our recipe');
    assert.ok(v.edit, 'with «edit»: the recipe view');
    assert.deepEqual([v.log, v.save, v.report], [null, null, null], 'not the suggestion sheet: nothing to save a copy of or report');
    assert.deepEqual(v.qty, ['300 g'], 'its ingredient as written');
    assert.deepEqual(v.figsRows, [], 'and the recipe view keeps the stove\'s silence: no figures under an ingredient');
    // «سجّل حصّة» (v421 fix F1): the list's first row is a meal to eat like the
    // others — first among the view's actions, the primary one.
    const w = await ev(() => ({ log: t('shr_log'), undo: t('undo') }));
    assert.deepEqual([v.logView, v.actions], [{ text: w.log, disabled: false, primary: true }, ['log', 'edit', 'share']], 'opened from the page, the view offers «' + w.log + '» first, as the primary action: ' + JSON.stringify(v.actions));
    await page.locator('#modal-root [data-step="1"]').click();   // the scaler moves amounts, never the log
    await page.locator('#modal-root [data-log-view]').click();
    await sheetGone(page);
    assert.deepEqual(await ev(rowsToday), [{ name: RICE.name, servings: 1, calories: 390, protein: 4, carbs: 86, fat: 1, source: 'recipe' }], 'ONE row of one serving, the serving\'s figures, source «recipe» — as the picker\'s «+» logs it');
    assert.deepEqual([await ev(toastText), await ev(toastAct)], [await ev((n) => t('rec_logged').split('{name}').join(n), RICE.name), w.undo], 'the toast names the recipe, with «' + w.undo + '»');
    const logged = await ev(readPage);
    assert.deepEqual([logged.left, logged.open], [await ev(leftText, 1610), [P]], 'the page repainted: 1,610 left, the period still open');
    await page.locator('#toast.show .toast-action').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await ev(rowsToday), [], 'Undo takes it back');
    // «تعديل» from the page lands back on the page — not in the saved-food
    // picker, which the page never opened.
    await page.locator(pageRow(mine.id)).click();
    await sheetUp(page, '[data-edit-view]');
    await page.locator('#modal-root [data-edit-view]').click();
    await page.locator('#modal-root .modal-overlay:not(.is-out) #rec-rows .rec-row').first().waitFor({ timeout: 4000 });
    await page.locator('#modal-root .modal-overlay:not(.is-out) #rec-save').click();
    await sheetGone(page).catch(() => {});
    assert.deepEqual(await ev(() => [currentView, !!document.querySelector('#modal-root .modal-overlay:not(.is-out)'), !!document.querySelector('#modal-root #sf-list')]), ['suggestions', false, false], 'the edit saved, the page is on screen with no sheet over it — not the saved-food picker');
    const back = (await ev(readPage)) || { open: [], rows: [] };
    assert.deepEqual([back.open, back.rows[0]], [[P], mine.id], 'the period still open, our recipe first');
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

  ['(34) a ready meal: its sheet opens with the ingredients already there — no fetch, nothing busy — each with its amount — one figure in grams or millilitres, a counted unit too — and its own figures, the meal\'s figures their sum; the scaler moves every amount with its figures; «Log a serving» writes one serving (source builtin, the meal\'s own id) with Undo; «Save to my recipes» keeps a copy with origin builtin and noAuto — standing in for the meal on the page behind at once and at the next arrival, opening its view with «سجّل حصّة», spent on reopening, its share sheet promising no following — that automatic sharing never sends', async (kit) => {
    const { page, ev, reset, worker, clock, answered } = kit;
    const { P } = await periods(page);
    await stubCloud(page, { rows: [] });
    await load(page);
    const ready = await ev(readyMeals);
    const want = await ev(() => ({ per: t('rec_per'), log: t('shr_log'), save: t('shr_save'), mine: t('shr_in_recipes'), saved: t('shr_saved'), undo: t('undo'),
      terms: [t('shr_term_review'), t('shr_term_anon'), t('shr_term_withdraw')], copy: t('shr_term_copy') }));
    // THE MEAL THIS CASE OPENS: the first of the period that weighs an
    // ingredient in grams other than its serving names — so an ingredient's
    // figures can only come out right if they were scaled by those grams.
    // (The list's order is case 1's to pin: here a wrong price would move it
    // before the figures this case reads could say why.)
    const list = (await arrive(kit, P)).rows;
    assert.ok(list.length >= 4 && list.every((id) => ready.some((r) => r.id === id && r.meals.includes(P))), 'setup: the open period holds the ready meals of the period: ' + JSON.stringify(list));
    const meal = list.map((id) => ready.find((r) => r.id === id)).find((m) => m.items.some((it) => it.g !== null && it.g !== it.servingG));
    assert.ok(meal, 'setup: a meal of the period weighs an ingredient in grams other than its serving: ' + JSON.stringify(list));
    await page.locator(pageRow(meal.id)).click();
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
    // opened from its own period on the page: twice the weight of one egg,
    // «١٠٠ غ» / «100 g» (v421 fix F2; it read «٢ × بيضة» before, beside figures
    // the scaler doubled while it still said two eggs).
    const twice = ready.find((m) => m.items.some((it) => it.n > 1));
    await showPeriod(page, twice.meals[0]);
    await page.locator(pageRow(twice.id)).click();
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
    await showPeriod(page, P);
    // «SAVE TO MY RECIPES»: a copy that says where it came from.
    await page.locator(pageRow(meal.id)).click();
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
    // it was saved from — on the page behind at once, and at the next arrival.
    const mineId = 'mine:' + r.id;
    let pg = await ev(readPage);
    assert.deepEqual([pg.rows[0], pg.allRows.includes(meal.id)], [mineId, false], 'the page behind follows at once: the copy heads the period, the ready original has left it: ' + JSON.stringify(pg.rows.slice(0, 4)));
    await ev(() => closeModal());
    await sheetGone(page);
    pg = await arrive(kit, P);
    assert.deepEqual([pg.rows[0], pg.srcs[0], group(pg, 'mine'), pg.allRows.includes(meal.id)], [mineId, 'mine', [mineId], false], 'the copy is the user\'s own recipe now — first, under «من وصفاتي» — and the meal it copies is not listed a second time: ' + JSON.stringify(pg.groups.map((g) => [g.src, g.rows.length])));
    // Reached directly, the ready meal's sheet still says the copy is saved.
    await ev((m) => openSharedRecipe(m, null, () => {}), meal);
    await sheetUp(page, '#shr-log');
    assert.deepEqual((await ev(readSheet)).save, { text: want.mine, disabled: true }, 'the meal reopened: it is still in the recipes');
    await ev(() => closeModal());
    await sheetGone(page);
    // The copy's row opens the recipe view, with «سجّل حصّة» first (fix F1).
    await page.locator(pageRow(mineId)).click();
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
    // TWO LOCKS, each enough alone: noAuto (for a phone on v420), and on this
    // build the origin itself (v421: any origin is refused, not 'shared' only).
    // Since the copy carries noAuto, the line above cannot see the second.
    assert.equal(await ev((id) => autoShareWants({ ...DB.recipes.list().find((x) => x.id === id), noAuto: undefined }), r.id), false, 'nor would it without noAuto: its origin «builtin» refuses it on its own');
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

  ['(35) layout: at 375 and 320, with and without «Larger text», every row of an open period — mine, community, ready — keeps its name and figures inside it and stays door-sized, and the three captions are drawn inside the card, each over its rows; a ready meal\'s ingredient lines — the figures on a line of their own, under the amount — and an own recipe\'s three actions stay inside their sheet', async (kit) => {
    const { page, ev } = kit;
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
          await arrive(kit, P);
          const c = await ev(layoutOf, { part: 'panel', lg });
          assert.deepEqual(c.srcs, ['mine', 'community', 'builtin'], `setup: rows of each source at ${where}`);
          assert.deepEqual(c.spill, [], `a row's name or figures leave the row at ${where}: ${c.spill.join('; ')}`);
          assert.deepEqual([c.secSpill, c.pageSpill], [false, false], `the period's card or the page overflows sideways at ${where}`);
          assert.ok(c.rowH >= 44, `every row at least 44px at ${where}: ${c.rowH}`);
          assert.deepEqual(c.caps, [true, true, true], `the three captions drawn inside the card, each over its rows, at ${where}: ${JSON.stringify(c.caps)}`);
          await page.locator(pageRow(meal.id)).click();
          await sheetUp(page, '.rec-view .cx-row.has-figs');
          const s = await ev(layoutOf, { part: 'meal', lg });
          assert.equal(s.n, meal.items.length, `setup: the meal's ${meal.items.length} ingredients at ${where}`);
          assert.deepEqual(s.spill, [], `an ingredient line spills at ${where}: ${s.spill.join('; ')}`);
          assert.ok(s.below.every(Boolean), `each ingredient's figures sit on a line of their own, under its name and amount, at ${where}: ${s.below}`);
          assert.equal(s.modalSpill, false, `the meal's sheet scrolls sideways at ${where}`);
          await ev(() => closeModal());
          await sheetGone(page);
          // The own recipe's view from the page: three actions on one row (fix F1).
          await page.locator('.view.active .shr-row[data-shr-src="mine"]').click();
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

  // ── THE DOOR AND THE PAGE (v422) ─────────────────────────────────────────
  ['(36) the door: Food carries ONE button — the utensils glyph, «اقتراحات اليوم», the chevron of a door row at the reading end — and nothing else of the old card: no period, no row, no count, no «show more»; under the water card (as wide), or under the setup button with no target, outside the hero; a tap opens the page with the Food tab still lit, titled in its bar and in its real heading; its back arrow — and the browser\'s Back — return to Food, off the stack', async (kit) => {
    const { page, ev, reset, lang } = kit;
    const { P, O } = await periods(page);
    // All three sources in memory: none of them reaches Food.
    await stubCloud(page, { rows: sixRows('qa-c36', P, O) });
    await load(page);
    await ownRecipe(page, BOWL);
    const title = await ev(() => t('shr_title'));
    await reset('food');
    const d = await ev(readDoor);
    assert.deepEqual([d.n, d.tag, d.type], [1, 'BUTTON', 'button'], 'ONE door on Food, a real button: ' + JSON.stringify(d));
    assert.deepEqual([d.text, d.name, d.nums], [title, title, 0], `its only words are «${title}» — no count, no figure, no subtitle: «${d.text}»`);
    assert.deepEqual([d.svgs, d.glyph, d.chevron], [2, true, true], 'two glyphs and no more: the utensils first, the chevron of a door row last');
    assert.equal(d.end, true, 'the chevron at the reading end of the bar');
    assert.equal(d.flip, lang === 'ar' ? 'matrix(-1, 0, 0, 1, 0, 0)' : 'none', 'and pointing where the reading goes — mirrored in Arabic, as it is drawn in English');
    assert.equal(d.old, 0, 'nothing of the old card on Food: no period button, no row, no «show more»');
    assert.deepEqual([d.after, d.inHero, d.w === d.hostW], ['water', false, true], `under the water card and as wide (${d.w} / ${d.hostW}), outside the hero, whose catch-all opens the log`);
    // THE TAP: the page, the Food tab still lit.
    await page.locator('.view.active [data-shr-door]').click();
    await page.waitForFunction(() => currentView === 'suggestions', null, { timeout: 3000 }).catch(() => {});
    assert.equal(await ev(() => currentView), 'suggestions', 'the door opens the page');
    assert.deepEqual(await ev(litTabs), [['food', 'page']], 'and the Food tab stays lit — the page is a step into it');
    const s = await ev(readPage);
    assert.deepEqual([s.bar, s.h1, s.open], [title, title, []], `titled «${title}» in the bar and in its real heading, every period closed`);
    assert.deepEqual(await ev(() => navStack.map((e) => e.view)), ['home', 'food', 'suggestions'], 'one step onto the stack');
    // ITS BACK ARROW goes BACK.
    await page.locator('.view.active .detail-top [data-back]').click();
    await page.waitForFunction(() => currentView === 'food', null, { timeout: 3000 }).catch(() => {});
    assert.deepEqual([await ev(() => currentView), await ev(() => navStack.map((e) => e.view)), await ev(litTabs)], ['food', ['home', 'food'], [['food', 'page']]], 'the back arrow returns to Food — off the stack, not forward onto it');
    assert.equal((await ev(readDoor)).n, 1, 'and the door is there');
    // …and so does the browser's Back (popstate; Android's button is goBack too).
    await page.locator('.view.active [data-shr-door]').click();
    await page.waitForFunction(() => currentView === 'suggestions', null, { timeout: 3000 });
    await ev(() => history.back());
    await page.waitForFunction(() => currentView === 'food', null, { timeout: 3000 }).catch(() => {});
    assert.deepEqual([await ev(() => currentView), await ev(litTabs)], ['food', [['food', 'page']]], 'the browser\'s Back returns to Food');
    // NO TARGET: the door under the setup button.
    await ev(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
    await reset('food');
    // The Food tab opens the calculator by itself when no target is set.
    await page.waitForTimeout(400);
    await ev(() => { try { closeModal(); } catch (_) {} });
    await sheetGone(page);
    const n = await ev(readDoor);
    assert.deepEqual([n.n, n.after, n.old, n.inHero], [1, 'setup', 0, false], 'no target: the door under the setup button, alone');
    await page.locator('.view.active [data-shr-door]').click();
    await page.waitForFunction(() => currentView === 'suggestions', null, { timeout: 3000 }).catch(() => {});
    assert.deepEqual([await ev(() => currentView), ((await ev(readPage)) || {}).left], ['suggestions', null], 'and it opens the page, with no calories line: there is no target to count from');
  }],

  ['(37) the scroll: a period opened below the fold is brought into view — its header, and its first row under it; and a header tapped while the list open above it closes keeps its place on screen', async (kit) => {
    const { page, ev } = kit;
    await stubCloud(page, { rows: [] });
    await load(page);
    // Where a period's header stands on screen, whether it and its open list's
    // first row are wholly inside the scroller, and how far the page is scrolled.
    const at = (p) => ev((p) => {
      const main = document.querySelector('.main'), m = main.getBoundingClientRect();
      const h = document.querySelector('.view.active [data-shr-sec="' + p + '"]').getBoundingClientRect();
      const first = document.querySelector('#shr-pg-' + p + ':not([hidden]) .shr-row');
      const r = first && first.getBoundingClientRect();
      return { top: Math.round(h.top), head: h.top >= m.top - 1 && h.bottom <= m.bottom + 1, row: r ? r.top >= m.top - 1 && r.bottom <= m.bottom + 1 : null, scroll: Math.round(main.scrollTop) };
    }, p);
    // A tap that is only a tap: Playwright would scroll the header into view first.
    const tap = (p) => ev((p) => document.querySelector('.view.active [data-shr-sec="' + p + '"]').click(), p);
    const expanded = () => ev(() => [...document.querySelectorAll('.view.active .shr-pg-head')].map((b) => b.getAttribute('aria-expanded')));
    // A NEW SCREEN HEIGHT, and the app laid out for it. The shell is 100dvh,
    // which follows a new viewport height a frame late: measured, the scroller
    // still read 748 tall at a 442px viewport, so the page judged the fold
    // where it no longer was. The width follows at once (cases 15, 25, 35).
    const resize = async (height) => {
      await page.setViewportSize({ width: 375, height });
      await page.waitForFunction((h) => { const n = document.querySelector('.bottom-nav'); return innerHeight === h && !!n && Math.abs(n.getBoundingClientRect().bottom - h) <= 1; }, height, { timeout: 3000 });
    };
    try {
      // A SCREEN THAT ENDS 20px BELOW THE LAST HEADER: the dinner header on
      // screen, its list's first row under the fold.
      await arrive(kit);
      const fit = await ev(() => { const h = document.querySelector('.view.active [data-shr-sec="dinner"]').getBoundingClientRect(); const m = document.querySelector('.main').getBoundingClientRect(); return Math.round(h.bottom + (innerHeight - m.bottom) + 20); });
      await resize(fit);
      await arrive(kit);
      const before = await at('dinner');
      assert.deepEqual([before.head, before.scroll], [true, 0], `setup: at 375×${fit} the dinner header is on screen, the page unscrolled: ${JSON.stringify(before)}`);
      await tap('dinner');
      assert.deepEqual(await expanded(), ['false', 'false', 'false', 'true'], 'setup: dinner open');
      const after = await at('dinner');
      assert.deepEqual([after.head, after.row], [true, true], `opened below the fold, its header and its first row are brought into view: ${JSON.stringify({ before, after })}`);
      // THE HEADER TAPPED KEEPS ITS PLACE: breakfast open, the page scrolled down
      // its list to the lunch header; a tap on lunch closes breakfast ABOVE it.
      await arrive(kit);
      await tap('breakfast');
      await ev(() => { const m = document.querySelector('.main'); const h = document.querySelector('.view.active [data-shr-sec="lunch"]'); m.scrollTop += h.getBoundingClientRect().top - m.getBoundingClientRect().top - 120; });
      const was = await at('lunch');
      assert.ok(was.head && was.scroll > 0, `setup: breakfast open above it, the lunch header 120px down a scrolled page: ${JSON.stringify(was)}`);
      await tap('lunch');
      assert.deepEqual(await expanded(), ['false', 'true', 'false', 'false'], 'setup: lunch open, breakfast closed above it');
      const now = await at('lunch');
      assert.ok(Math.abs(now.top - was.top) <= 1 && now.row, `the lunch header keeps its place on screen as breakfast's list closes above it (${was.top} → ${now.top}), its first row in view under it: ${JSON.stringify({ was, now })}`);
    } finally {
      await resize(812).catch(() => page.setViewportSize({ width: 375, height: 812 }));
    }
  }],

  // v422 review: the page reads «today» and the clock when it is DRAWN, so a
  // new day has to draw it again — the foreground's repaint (js/app.js,
  // DATE_DERIVED_VIEWS), as for every screen that derives its day from now.
  ['(38) a new day: the page left on show overnight is drawn again when the app comes back to the foreground — the new day\'s calories left, «الآن» on the new hour\'s period, the open list ranked for them — and the period open stays open', async (kit) => {
    const { page, ev } = kit;
    const { P } = await periods(page);
    await stubCloud(page, { rows: [] });
    await load(page);
    const ready = await ev(readyMeals);
    const now = await ev(() => t('shr_now'));
    await ev(() => DB.foodLogs.addMany(todayISO(), [{ name: 'QA eaten', servings: 1, calories: 1700, protein: 50, carbs: 150, fat: 50 }]));
    let s = await arrive(kit, P);
    assert.deepEqual([s.left, s.heads.filter((h) => h.now).map((h) => h.p), s.open], [await ev(leftText, 300), [P], [P]], 'setup: 300 left today, «' + now + '» on the clock\'s period, that period open');
    // THE NEXT MORNING — the next midday when the clock is in the morning
    // already, so «الآن» has another period to move to — and the app back in
    // the foreground. Nothing is pulled (the 'out' stub's resume answers
    // 'nosession'), so the day change alone has to draw the page.
    const was = await ev(() => Date.now());
    const hour = P === 'breakfast' ? 13 : 8;
    const Q = hour === 13 ? 'lunch' : 'breakfast';
    const next = await ev((hour) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(hour, 0, 0, 0); return d.getTime(); }, hour);
    try {
      await page.clock.setSystemTime(next);
      await ev(() => document.dispatchEvent(new Event('visibilitychange')));
      s = await ev(readPage);
      assert.deepEqual([s.left, s.heads.filter((h) => h.now).map((h) => [h.p, h.now]), s.open, s.rows], [await ev(leftText, 2000), [[Q, now]], [P], rankIds(ready, P, 2000)],
        `the app back the next day at ${hour}:00: the page drawn for it — 2,000 left, not yesterday's 300; «${now}» on ${Q}, not ${P}; the open list ranked for 2,000 — and ${P} still open`);
    } finally {
      // Today again, and the app's own day with it (the next foreground repaint).
      await page.clock.setSystemTime(was + 1000);
      await ev(() => document.dispatchEvent(new Event('visibilitychange')));
    }
    // A WHOLE render under an open sheet (the review's last finding): a new
    // day on the foreground or a pull's refresh calls renderView, which draws
    // every node of the page anew — the row the sheet was opened from too. The
    // sheet still hands focus back to THAT row when it closes, never to <body>.
    s = await ev(readPage);
    const rowId = s.rows[0];
    assert.ok(rowId && s.open[0] === P, 'setup: ' + P + ' still open, with rows: ' + JSON.stringify(s.rows.slice(0, 3)));
    await page.click(`.view.active [data-shr-open="${rowId}"]`);
    await sheetUp(page, '#shr-log');
    await ev(() => renderView('suggestions'));
    await page.keyboard.press('Escape');
    await sheetGone(page);
    assert.equal((await ev(readPage)).focus, 'row:' + rowId, 'a whole render of the page under the sheet, then Escape: focus is back on the row the sheet was opened from, drawn anew');
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
  console.log(`PASS  shared recipes UI (${passed} cases, AR/dark + EN/light, 375px): «اقتراحات اليوم» as a door and a page (v422) — Food's door (one button: the glyph, the name the owner gave, a chevron to the reading end; nothing of the old card; under the water card or the setup button, outside the hero; the tap opening the page with the Food tab lit, its back arrow and the browser's Back returning to Food) and the page (there from the first day — on null, on a missing method, on an empty list and before the answer — every period unfolding ready meals priced from the catalogue; four periods closed on arrival, «الآن» on the clock's alone, one open at a time, a second tap closing it, a log, a re-render, an Undo and a Back to the page keeping it, a new arrival closing it, a new day drawing it again; a sheet over the page handing focus back to its row drawn anew under it, or to its period's header; the calories left with a target and no line without one; the whole period ranked by what fits them, then protein per kcal, in three groups captioned only when more than one has rows; the community list arriving into the open period by itself; Food pulling nothing; the door and the headers fitting at 375/320 with and without larger text; a period below the fold brought into view and a tapped header kept in place), a recipe's sheet (name, one serving's figures, the ingredients fetched on the tap with each one's figures, a 4 → 2 scaler moving both), «Log a serving» as one serving with Undo, «Save to my recipes» as a clean copy, the report (one feedback row, the row leaves; signed out sends nothing), sharing (four terms — the fourth by the setting — the Worker's protocol, the {id, at, sig} marker, «Stop sharing», «shared» in the picker, a corrected name announced), a rejection's translated reason, the failures (daily limit, an old Worker, signed out, non-whole servings), withdrawing (the published id; a failure keeps the marker; a withdrawn recipe leaves automatic sharing until it is shared by hand; a button the marker moved under only redraws), untrusted names never markup and unsafe ids dropped, the user's own published recipe suggested once, as their own, under its copy's periods (the feed's copy, reached directly, still offering no copy and no report); AUTOMATIC SHARING on a stopped clock — a save's one-time notice, then one request when its window ends, the sig, the fresh pull and the page repainted, nothing for an unchanged re-save and one more for an edit; «stop» inside the window, the setting turned off while a recipe waits, a notice the keyboard holds up; nothing sent signed out, with the setting off, offline, without an account id or a configured cloud, before the sync settles, on a store that failed to load, for 2.5 servings, a copy from the list or a withdrawn recipe; a rejection remembered until an edit, and the gap kept for a save right after an answer; the daily limit and the AI budget's 429 pausing the device, also after the app is opened again; the backfill one at a time, a gap after each answer, ${DAY_MAX} a day; no marker after an account change, and no pause from a refusal that arrives after one; the Settings row at 375/320; «save all» as a trigger, an Undo on the recipes kept working, the notice waiting behind an Undo; «blocked», the held-recipes cap, «unavailable», a failed request, a rate limit waited out once, an approval for a recipe withdrawn or deleted meanwhile, and an edit made during the review sent after it; THE REVIEW'S FIXES — a notice seen only once it ended on screen (displaced by a navigation or a toast it comes back; under a hidden page it waits), «stop sharing» under a re-share in flight withdrawing the new copy, a refused withdraw lifting noAuto, a sync on the wire holding the queue, the setting turned off mid-review, «Recent changes» applicable after the engine published and withdrawing an undone add's copy, the fourth term for a copy from the list, the Settings hint in both states, a null row never breaking the render of Food; THE FIX AFTER IT — a dependency that throws under the backfill never breaking that render nor the page's open period, and a notice cut short by a hold or a stop (a delete's Undo, the setting turned off in Settings, going offline) raised again, nothing sent and nothing seen until a full window ran on screen after THAT raise; «اقتراحات اليوم» (v421) — the user's own recipe heading its period under «من وصفاتي» even when it ranks last, opening its recipe view; a ready meal's sheet with its ingredients at once, each with its figures, the scaler moving both, one serving logged as source builtin with Undo, a copy saved with origin builtin that its share sheet promises nothing for and automatic sharing never sends; the open period and a ready meal's sheet laid out at 375/320 with and without larger text; THE FIXES AFTER ITS REVIEW — «سجّل حصّة» on the user's own recipe opened from the page (first, one serving, Undo, kept through a withdraw's redraw, «تعديل» back to the page, the picker's view unchanged, three actions fitting at 320), every ingredient of a ready meal in grams or millilitres and every amount scaling with its figures, one meal one row (a ready meal's or a community recipe's copy standing in for it, the page behind repainted, a copy withdrawn by «أزل من المشاركة» or by an Undo never suggested back), a ready meal's copy carrying noAuto, one source drawn bare, and a name holding «$» toasted as written`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
