#!/usr/bin/env node
// THE DAILY THREE, COUNTED — how many taps from Home to the writes a user makes
// every day: a set, a cup of water, the morning weight, a saved food.
//
//   node scripts/ux-flows.js                # ar/dark/375, seeded, real clicks
//
// ⚠️ A TOOL, NOT A SUITE (not test-*.js). It prints a table and writes
// .uxaudit/flows.json. It exists because «اسهل ما يكون» is a number: the tap
// count of the thing done most often. Every path here is driven with REAL
// clicks on the rendered app (Playwright mouse, not element.click()), so a
// control that is covered, under the nav, or 42px wide costs what it really
// costs — and every write is PROVED by reading DB.* afterwards, so "two taps"
// means two taps that produced a row.
//
// What is recorded per path: the taps in order (selector, where it was on
// screen at tap time, whether it needed a scroll to reach), typing steps, the
// time from the first tap to the write landing (fake clock, so this is work
// not waiting), and the DB read that proves it.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { start, ROOT } = require('./fp/server.js');
const { seedFixture } = require('./fp/fixture.js');
const { openContext, openPage, settle } = require('./fingerprint-net.js');

const OUT = path.join(ROOT, '.uxaudit');

async function drive(page, steps, ctxName) {
  const log = [];
  const fold = await page.evaluate(() => { const n = document.querySelector('.bottom-nav'); return n ? n.getBoundingClientRect().top : window.innerHeight; });
  for (const s of steps) {
    if (s.type) {
      const loc = page.locator(s.sel).first();
      await loc.fill(String(s.type));
      log.push({ kind: 'type', sel: s.sel, value: s.type });
      continue;
    }
    if (s.wait) { await page.clock.runFor(s.wait); await page.waitForTimeout(40); continue; }
    const loc = page.locator(s.sel).first();
    await loc.waitFor({ state: 'visible', timeout: 4000 });
    // ⚠️ SETTLE BEFORE READING WHERE IT IS. A sheet is measured mid-entrance
    // otherwise: the weight button once read y=1095 — its resting 678 plus one
    // sheet-height — and the log said 'under the nav' about a control that was
    // simply still arriving. The net's settle() waits on animations by state.
    await settle(page, (await page.evaluate(() => !!document.querySelector('#modal-root .modal-overlay'))) ? '#modal-root' : '.view.active');
    // where is it BEFORE we touch it — under the nav means a scroll to reach
    const box = await loc.boundingBox();
    const inNav = s.sel.includes('.bottom-nav');   // the nav IS the fold line; its own buttons are not under it
    const under = box && !inNav ? (box.y + box.height / 2 > fold || box.y < 0) : null;
    if (under) await loc.scrollIntoViewIfNeeded();
    const b2 = await loc.boundingBox();
    const cx = b2.x + b2.width / 2, cy = b2.y + b2.height / 2;
    // a REAL click at the centre: a covered or 42px control fails or lands elsewhere
    await page.mouse.click(cx, cy);
    let second = null, atOldPoint = null, moved = null;
    if (s.twice) {
      // THE BOUNCE WINDOW IS FAKE-CLOCK TIME, WHICH IS WHAT A GUARD READS.
      // 120ms is under every debounce in this app, so a site with no guard
      // writes twice.
      //
      // A FIXED-COORDINATE SECOND TAP MEASURES THE WRONG THING, and that was
      // proved rather than reasoned: with the v357 guard on the saved-food row
      // DELETED, the fixed-point lane still reported ONE row - because the undo
      // toast resizes the open sheet (v324's :has(.toast.show) reservation),
      // the row slid out from under the point, and the second click landed on
      // the modal. The guard it claimed to be testing was never exercised, so
      // that case was decoration.
      //
      // So the second tap FOLLOWS the control to wherever it now is, which is
      // also the likelier human gesture: a tap that seems not to have
      // registered is repeated AT THE BUTTON, which the user can still see.
      // What a fixed-point bounce would have hit is recorded beside it, read at
      // the same instant, without spending a second click on it.
      await page.clock.runFor(120);
      await page.waitForTimeout(30);
      atOldPoint = await page.evaluate(([x, y]) => {
        const at = document.elementFromPoint(x, y);
        if (!at) return 'nothing';
        const el = at.closest('button, a, [role="button"], input, label') || at;
        const cls = typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls + (el.disabled ? ' [disabled]' : '');
      }, [cx, cy]);
      const b3 = (await loc.count()) ? await loc.boundingBox() : null;
      if (!b3) {
        second = 'the control is gone - there is nothing to tap twice';
      } else {
        moved = Math.round(Math.abs(b3.x - b2.x) + Math.abs(b3.y - b2.y));
        const off = await loc.evaluate((el) => !!el.disabled).catch(() => false);
        second = (off ? 'refused [disabled]' : 'accepted') + (moved ? ' - the control had moved ' + moved + 'px' : '');
        await page.mouse.click(b3.x + b3.width / 2, b3.y + b3.height / 2);
      }
    }
    await page.clock.runFor(s.after || 400);
    await page.waitForTimeout(60);
    log.push({ kind: 'tap', sel: s.sel, y: Math.round(box.y), h: Math.round(box.height), w: Math.round(box.width), scrolledToReach: !!under, label: s.label || '', twice: !!s.twice, secondTap: second, aFixedPointBounceWouldHit: atOldPoint, movedPx: moved });
  }
  return { ctx: ctxName, taps: log.filter((l) => l.kind === 'tap').length, typing: log.filter((l) => l.kind === 'type').length, steps: log };
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.log('ux-flows: playwright is not installed here'); process.exitCode = 1; return; }
  const srv = start('in');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results = [];
  try {
    const ctxName = 'ar/dark/375';
    const { ctx, page, errors, guard } = await openContext(browser, origin, { lang: 'ar', theme: 'dark', width: 375 });
    const fx = await page.evaluate(seedFixture);
    // every day trains, so Home has a workout to start
    await page.evaluate((fx) => DB.plan.setRotation({ cycle: [{ name: 'Push', exerciseIds: [fx.exerciseId, fx.exerciseId2] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: addDaysISO(fx.today, -7) }), fx);
    const home = async (pg = page) => { await pg.evaluate(() => { try { closeModal(); } catch (_) {} document.querySelectorAll('.sheet-overlay, .img-lightbox').forEach((e) => e.remove()); const m = document.querySelector('.main'); if (m) m.scrollTop = 0; navigate('home', {}, { fromPop: true }); }); await settle(pg, '.view.active'); await pg.clock.runFor(6000); await pg.waitForTimeout(60); };
    const read = (fn, arg, pg = page) => pg.evaluate(fn, arg);

    // ── 1. a cup of water ────────────────────────────────────────────────────
    await home();
    const water0 = await read((d) => DB.water.get(d), fx.today);
    const w = await drive(page, [
      { sel: '.view.active [data-unified-search]', label: 'search (top bar)' },
      { sel: '#cx-quick .cx-actions button:first-child', label: '+250', after: 1000 },
    ], ctxName);
    const water1 = await read((d) => DB.water.get(d), fx.today);
    results.push({ path: 'water +250 ml', ...w, proof: `DB.water ${water0} → ${water1}`, landed: water1 === water0 + 250 });

    // ── 2. the morning weight ───────────────────────────────────────────────
    await home();
    const bw0 = await read(() => DB.bodyweight.list().length);
    const bw = await drive(page, [
      { sel: '.view.active [data-unified-search]', label: 'search (top bar)' },
      { sel: '#cx-quick [data-ql="weight"]', label: 'الوزن' },
      { sel: '#weight-input', type: '77.9' },
      { sel: '#weight-save', label: 'save', after: 800 },
    ], ctxName);
    const bw1 = await read((d) => { const l = DB.bodyweight.list(); const t = l.find((e) => e.date === d); return { n: l.length, today: t && t.kg }; }, fx.today);
    results.push({ path: 'body weight', ...bw, proof: `DB.bodyweight ${bw0} rows → ${bw1.n}, today=${bw1.today}`, landed: bw1.today === 77.9 });

    // ── 3. a set in today's workout ─────────────────────────────────────────
    await home();
    const s0 = await read((a) => DB.sessions.listAll().filter((s) => s.date === a.today && s.exerciseId === a.exerciseId).length, fx);
    const set = await drive(page, [
      { sel: '#home-start-workout', label: 'تمرين اليوم (hero)' },
      // the hero opens session-day (the day's list with inline set rows), not the guided run
      { sel: '.view.active [data-set="0"] [data-field="reps"]', type: '8' },
      { sel: '.view.active [data-set="0"] [data-field="weight"]', type: '60' },
      // session-day has no per-row tick: typing reveals the card's Save (.sd-save-btn loses .sd-hidden), and that is the commit
      { sel: '.view.active .sd-save-btn:not(.sd-hidden)', label: 'save (card)', after: 1500 },
    ], ctxName);
    const s1 = await read((a) => { const l = DB.sessions.listAll().filter((s) => s.date === a.today && s.exerciseId === a.exerciseId); return { n: l.length, sets: l[0] && l[0].sets }; }, fx);
    results.push({ path: 'a set (today, first exercise)', ...set, proof: `DB.sessions today/ex1 ${s0} → ${s1.n}, sets=${JSON.stringify(s1.sets)}`, landed: s1.n === 1 && !!s1.sets && s1.sets.length >= 1 && Number(s1.sets[0].reps) === 8 });

    // ── 4. a saved food ─────────────────────────────────────────────────────
    await home();
    const f0 = await read((d) => DB.foodLogs.listForDate(d).length, fx.today);
    const food = await drive(page, [
      { sel: '.bottom-nav .nav-btn[data-view="food"]', label: 'Food tab' },
      { sel: '#food-fab', label: 'FAB +' },
      { sel: '.add-tile[data-method="saved"]', label: 'saved foods tile', after: 600 },
      { sel: '#modal-root .picker-row[data-add-saved="0"]', label: 'first saved food', after: 1200 },
    ], ctxName);
    const f1 = await read((d) => DB.foodLogs.listForDate(d).length, fx.today);
    results.push({ path: 'a saved food', ...food, proof: `DB.foodLogs today ${f0} → ${f1}`, landed: f1 === f0 + 1 });

    // -- THE DUPLICATE-TAP LANE ----------------------------------------------
    // The same four writes, with the FINAL button tapped twice 120ms apart. A
    // human cannot tap twice in 120ms on purpose; that is a bounced thumb, a
    // dropped frame, or a phone that registered one press as two. What must
    // come out of it is ONE row.
    //
    // WATER IS DELIBERATELY NOT EXPECTED TO REFUSE, and that is a decision and
    // not an omission. A cup is a STEPPER - three taps mean 750ml - so an
    // 800ms lock-out would break the ordinary gesture to prevent a rare one,
    // and the mistake is already both visible (the running total under the
    // cups) and one tap from undone (the -250 beside them). It is measured all
    // the same, because "two cups" has to be on the record as a choice.
    const dupes = [];
    // A WRITE THAT IS IDEMPOTENT IN THE DATA STILL RUNS ITS TRANSACTION TWICE.
    // Body weight is one entry per day, so saving the same figure twice leaves
    // one row - but each save can leave its own entry in the undo ledger, and
    // the user then reads the same change listed twice in "the latest changes".
    // That is a duplicate they can see, so the ledger is read beside the row.
    //
    // COUNTING IT WOULD PROVE NOTHING: the ledger is a RING BUFFER CAPPED AT 5
    // (changeSlice shifts the oldest out) and the fixture already saturates it,
    // so length is pinned at 5 and a delta of 0 is a property of the container,
    // not of the app. The first draft of this lane reported 0 for all four
    // cases, including the saved-food add, which demonstrably pushes an entry.
    // The HEAD of the list is what the user reads, so that is what is compared.
    const undoTop = () => read(() => (DB.undo.list() || []).slice(0, 2).map((e) => e.label));
    const twiceInLedger = (t) => !!(t && t[0] && t[0] === t[1]);

    await home();
    const dw0 = await read((d) => DB.water.get(d), fx.today), du0 = await undoTop();
    const dwF = await drive(page, [
      { sel: '.view.active [data-unified-search]', label: 'search (top bar)' },
      { sel: '#cx-quick .cx-actions button:first-child', label: '+250', twice: true, after: 1400 },
    ], ctxName);
    const dw1 = await read((d) => DB.water.get(d), fx.today), du1 = await undoTop();
    dupes.push({ path: 'water +250 ml', wrote: (dw1 - dw0) + ' ml', undoTop: du1, wasAlreadyDoubled: twiceInLedger(du0), twiceInLedger: twiceInLedger(du1), one: '250 ml', single: dw1 - dw0 === 250, expected: 'a stepper: repeat taps ARE the gesture', steps: dwF.steps });

    await home();
    const dbw0 = await read(() => DB.bodyweight.list().length), bu0 = await undoTop();
    const dbwF = await drive(page, [
      { sel: '.view.active [data-unified-search]', label: 'search (top bar)' },
      { sel: '#cx-quick [data-ql="weight"]', label: 'weight' },
      { sel: '#weight-input', type: '81.3' },
      { sel: '#weight-save', label: 'save', twice: true, after: 1400 },
    ], ctxName);
    const dbw1 = await read((d) => { const l = DB.bodyweight.list(); return { n: l.length, today: (l.find((e) => e.date === d) || {}).kg }; }, fx.today), bu1 = await undoTop();
    dupes.push({ path: 'body weight save', wrote: (dbw1.n - dbw0) + ' new rows (today=' + dbw1.today + ')', undoTop: bu1, wasAlreadyDoubled: twiceInLedger(bu0), twiceInLedger: twiceInLedger(bu1), one: '0 new rows', single: dbw1.n === dbw0, expected: 'one entry per day by construction', steps: dbwF.steps });

    // THE SET NEEDS ITS OWN ONE-TAP CONTROL, AND THIS IS THE WHOLE POINT.
    // The day card does NOT commit one row: it also commits the rows it
    // pre-filled from last time, so a single, correct save already produces
    // more than one set. Reading "2 sets" after a double tap and calling it a
    // duplicate would have been a finding invented out of a constant I had
    // guessed. The only honest control is the SAME FLOW WITH ONE TAP from the
    // same cleared state, so the two are compared against each other and the
    // pre-filled rows cancel out.
    const clearToday = () => page.evaluate((a) => { DB.sessions.listAll().filter((s) => s.date === a.today).forEach((s) => DB.sessions.remove(s.id)); }, fx);
    const setFlow = (twice) => [
      { sel: '#home-start-workout', label: 'start today (hero)' },
      { sel: '.view.active [data-set="0"] [data-field="reps"]', type: '9' },
      { sel: '.view.active [data-set="0"] [data-field="weight"]', type: '62.5' },
      { sel: '.view.active .sd-save-btn:not(.sd-hidden)', label: 'save (card)', twice, after: 2000 },
    ];
    const readToday = () => read((a) => { const l = DB.sessions.listAll().filter((s) => s.date === a.today); return { n: l.length, sets: l.reduce((t, s) => t + s.sets.length, 0) }; }, fx);

    await clearToday(); await home();
    await drive(page, setFlow(false), ctxName);
    const ctrl = await readToday();

    await clearToday(); await home();
    const su0 = await undoTop();
    const dsF = await drive(page, setFlow(true), ctxName);
    const ds1 = await readToday(); const su1 = await undoTop();
    dupes.push({
      path: 'a set (session-day save)',
      wrote: ds1.n + ' sessions / ' + ds1.sets + ' sets',
      undoTop: su1, wasAlreadyDoubled: twiceInLedger(su0), twiceInLedger: twiceInLedger(su1),
      one: ctrl.n + ' sessions / ' + ctrl.sets + ' sets (measured, same flow, one tap)',
      single: ds1.n === ctrl.n && ds1.sets === ctrl.sets,
      expected: 'identical to its own one-tap control',
      steps: dsF.steps,
    });

    await home();
    const df0 = await read((d) => DB.foodLogs.listForDate(d).length, fx.today), fu0 = await undoTop();
    const dfF = await drive(page, [
      { sel: '.bottom-nav .nav-btn[data-view="food"]', label: 'Food tab' },
      { sel: '#food-fab', label: 'FAB +' },
      { sel: '.add-tile[data-method="saved"]', label: 'saved foods tile', after: 600 },
      { sel: '#modal-root .picker-row[data-add-saved="0"]', label: 'first saved food', twice: true, after: 2000 },
    ], ctxName);
    const df1 = await read((d) => DB.foodLogs.listForDate(d).length, fx.today), fu1 = await undoTop();
    dupes.push({ path: 'a saved food (picker stays open)', wrote: (df1 - df0) + ' rows', undoTop: fu1, wasAlreadyDoubled: twiceInLedger(fu0), twiceInLedger: twiceInLedger(fu1), one: '1 row', single: df1 - df0 === 1, expected: 'one row - v357 put an 800ms guard here', steps: dfF.steps });

    // -- 5. THE TICK THAT INVENTS NUMBERS -------------------------------------
    // The ✓ in the guided run is the app's most frequent write, and on an
    // UNTOUCHED row it fills reps and weight from last time's ghost and commits
    // them - a performed set the user never typed. Un-ticking does not take it
    // back (it only flips done:false, and an un-ticked set still counts in
    // stats and PRs, v298), and before this lane existed no toast was raised at
    // all. So the one ✓ that can surprise you now offers Undo, and an ordinary
    // ✓ over typed numbers stays silent, because a toast every ninety seconds
    // mid-workout is noise and that tick is already its own undo.
    //
    // THREE PHASES FROM THE SAME STATE, and that is not tidiness: DB.undo.apply
    // is LIFO and refuses a token that is no longer the newest entry, so a
    // probe that ticks, un-ticks, re-ticks and THEN taps Undo is testing a
    // stale token rather than the feature. The first draft did exactly that and
    // reported STALE against working code.
    const tickRead = (pg) => read((a) => {
      const v = document.querySelector('.view.active');
      const row = v.querySelector('.run-set-row[data-set="0"]');
      const toast = document.querySelector('.toast.show');
      return {
        screen: row ? [row.querySelector('[data-field="reps"]').value, row.querySelector('[data-field="weight"]').value] : null,
        db: DB.sessions.listAll().filter((x) => x.date === a.today && x.exerciseId === a.exerciseId).map((x) => x.sets),
        undoOffered: !!(toast && toast.querySelector('.toast-action')),
        toast: toast ? (toast.querySelector('.toast-msg') || toast).textContent.trim() : null,
      };
    }, fx, pg);
    const freshRun = async () => {
      await page.evaluate((a) => {
        DB.sessions.listAll().filter((s) => s.date === a.today).forEach((s) => DB.sessions.remove(s.id));
        DB.undo.clear();
        const t = document.querySelector('.toast'); if (t) t.classList.remove('show');
      }, fx);
      await home();
      await drive(page, [
        { sel: '#home-start-workout', label: 'start today (hero)' },
        { sel: '.view.active #sd-start-run', label: 'start the guided run', after: 800 },
      ], ctxName);
    };

    await freshRun();
    await drive(page, [{ sel: '.view.active .run-set-row[data-set="0"] [data-done]', label: 'tick an untouched row', after: 1200 }], ctxName);
    const tickA = await tickRead(page);
    await drive(page, [{ sel: '.toast.show .toast-action', label: 'take the Undo', after: 1200 }], ctxName);
    const tickAUndone = await tickRead(page);

    await freshRun();
    await drive(page, [
      { sel: '.view.active .run-set-row[data-set="0"] [data-done]', label: 'tick', after: 1000 },
      { sel: '.view.active .run-set-row[data-set="0"] [data-done]', label: 'un-tick', after: 1000 },
    ], ctxName);
    const tickB = await tickRead(page);

    await freshRun();
    await page.evaluate(() => {
      const r = document.querySelector('.view.active .run-set-row[data-set="0"]');
      for (const f of ['reps', 'weight']) {
        const i = r.querySelector('[data-field="' + f + '"]');
        i.value = f === 'reps' ? '7' : '35';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.clock.runFor(900); await page.waitForTimeout(60);
    await page.evaluate(() => { const t = document.querySelector('.toast'); if (t) t.classList.remove('show'); });
    await drive(page, [{ sel: '.view.active .run-set-row[data-set="0"] [data-done]', label: 'tick over typed numbers', after: 1200 }], ctxName);
    const tickC = await tickRead(page);

    const tick = {
      invented: tickA, afterUndo: tickAUndone, unticked: tickB, typed: tickC,
      offeredOnInvented: tickA.undoOffered,
      undoRemovedIt: tickAUndone.db.length === 0,
      untickStillKeepsIt: tickB.db.length === 1,
      silentWhenTyped: !tickC.undoOffered,
    };
    tick.ok = tick.offeredOnInvented && tick.undoRemovedIt && tick.untickStillKeepsIt && tick.silentWhenTyped;

    // -- 6. THE RESUME: the app is CLOSED mid-workout, and comes back ---------
    // v189 built this and v296 reshaped it, and it has never been measured
    // against a real close. Every check until now was a re-render inside one
    // living page - which is the case the feature does not have to survive.
    // viewContext dies with the document; the database does not, and the run's
    // position is DERIVED from it rather than stored, so this is the only test
    // that touches the thing that can actually be wrong.
    //
    // The close is a NEW PAGE in the same context, not a reload: the old
    // document is destroyed, every JS global with it, and localStorage stays -
    // which is exactly what an Android WebView kill leaves behind. It opens
    // through openPage() so it arrives fenced, clocked and ready by the same
    // code the first page used; a second spelling of that setup would drift,
    // and the first thing to drift would be the fence.
    await page.evaluate((a) => { DB.sessions.listAll().filter((s) => s.date === a.today).forEach((s) => DB.sessions.remove(s.id)); }, fx);
    // A KNOWN PLAN FOR THAT EXERCISE, seeded rather than inherited from the
    // fixture: three sets last time means the run opens on three empty rows,
    // so 'how many sets am I doing' is a number this probe controls instead of
    // a property of whichever exercise the fixture happened to build.
    await page.evaluate((a) => { DB.sessions.add({ exerciseId: a.exerciseId2, date: addDaysISO(a.today, -3), sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 45 }, { reps: 8, weight: 50 }] }); }, fx);
    await home();
    const runIn = await drive(page, [
      { sel: '#home-start-workout', label: 'start today (hero)' },
      { sel: '.view.active #sd-start-run', label: 'start the guided run', after: 800 },
      // THE SECOND EXERCISE, NEVER THE FIRST. Logging on exercise 1 makes the
      // correct answer 0, which is also the answer a broken runIdx gives - and
      // that was not hypothetical: planting `runIdx = 0` against a first-exercise
      // probe changed nothing in this report, so the probe was proving nothing.
      { sel: '.view.active .run-nav [data-next]', label: 'next exercise', after: 900 },
      { sel: '.view.active .run-set-row[data-set="0"] [data-field="reps"]', type: '10' },
      { sel: '.view.active .run-set-row[data-set="0"] [data-field="weight"]', type: '55' },
      { sel: '.view.active .run-set-row[data-set="0"] [data-done]', label: 'tick the set', after: 1500 },
    ], ctxName);
    const runState = (pg) => read(() => {
      const v = document.querySelector('.view.active');
      const rows = [...v.querySelectorAll('.run-set-row')];
      return {
        view: v.id,
        exercise: (v.querySelector('.run-ex-name') || {}).textContent || '',
        rows: rows.length,
        ticked: rows.filter((r) => r.querySelector('[data-done]').classList.contains('done')).length,
        values: rows.map((r) => [r.querySelector('[data-field="reps"]').value, r.querySelector('[data-field="weight"]').value]),
      };
    }, null, pg);
    const beforeClose = await runState(page);
    const dbBefore = await read((a) => DB.sessions.listAll().filter((s) => s.date === a.today).map((s) => ({ ex: s.exerciseId, sets: s.sets })), fx);

    await page.close();
    const re = await openPage(ctx, origin, { lang: 'ar', theme: 'dark' });
    const page2 = re.page;
    const backIn = await drive(page2, [
      { sel: '#home-start-workout', label: 'start today (hero)' },
      { sel: '.view.active #sd-start-run', label: 'start the guided run', after: 800 },
    ], ctxName);
    const afterOpen = await runState(page2);
    const dbAfter = await read((a) => DB.sessions.listAll().filter((s) => s.date === a.today).map((s) => ({ ex: s.exerciseId, sets: s.sets })), fx, page2);

    const resume = {
      tapsToLogTheSet: runIn.taps,
      tapsToGetBackIn: backIn.taps,
      exerciseBefore: beforeClose.exercise,
      exerciseAfter: afterOpen.exercise,
      sameExercise: !!beforeClose.exercise && beforeClose.exercise === afterOpen.exercise,
      tickedBefore: beforeClose.ticked,
      tickedAfter: afterOpen.ticked,
      rowsBefore: beforeClose.rows,
      rowsAfter: afterOpen.rows,
      valuesBefore: beforeClose.values,
      valuesAfter: afterOpen.values,
      dbBefore, dbAfter,
      // The set has to come back as a PERFORMED set, not as an empty row that
      // merely looks the same: the numbers survive in the database and the tick
      // is restored from them.
      setSurvived: JSON.stringify(dbBefore) === JSON.stringify(dbAfter) && dbAfter.length === 1 && dbAfter[0].sets.length >= 1,
      tickRestored: afterOpen.ticked >= 1,
      // REOPENING MUST NOT OFFER FEWER ROWS THAN YOU HAD. The run resumes its
      // POSITION from the database, but the row count came from last time's
      // session or from the slot's targets - and once a session exists for
      // today that signal was dropped, so the set you were ABOUT to do had no
      // row waiting. 'Resume, do not restart' has to cover the plan for the
      // exercise, not only the sets already in the database.
      nextSetReady: afterOpen.rows >= beforeClose.rows,
    };
    resume.ok = resume.sameExercise && resume.setSurvived && resume.tickRestored && resume.nextSetReady;

    const contained2 = re.guard.assertContained();
    for (const e of re.errors) errors.push('(after reopen) ' + e);
    const contained = guard.assertContained();
    contained.afterReopen = contained2;
    await ctx.close();
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'flows.json'), JSON.stringify({ results, dupes, tick, resume, errors, contained }, null, 2));

    console.log('\nux-flows — taps from Home to the write (ar/dark/375, seeded):\n');
    for (const r of results) {
      console.log(`  ${r.path.padEnd(32)} ${String(r.taps).padStart(2)} taps · ${r.typing} typed · ${r.landed ? 'LANDED' : 'DID NOT LAND'}   ${r.proof}`);
      for (const s of r.steps) console.log('      ' + (s.kind === 'tap' ? `tap  ${s.label.padEnd(22)} y=${String(s.y).padStart(4)} ${s.w}×${s.h}${s.scrolledToReach ? '  (under the nav — scrolled to reach)' : ''}` : `type ${s.value}`));
    }
    console.log('\nthe same four writes, tapped TWICE 120ms apart:\n');
    for (const d of dupes) {
      console.log(`  ${d.path.padEnd(34)} wrote ${String(d.wrote).padEnd(30)} (one tap = ${d.one})`);
      console.log(`      undo ledger head: ${JSON.stringify(d.undoTop)}${d.twiceInLedger && !d.wasAlreadyDoubled ? '  <-- THE SAME CHANGE LISTED TWICE' : ''}`);
      const t = d.steps[d.steps.length - 1];
      console.log(`      ${d.single ? 'ONE' : 'DOUBLED'} · second tap on the control: ${t && t.secondTap} · ${d.expected}`);
      console.log(`      a fixed-point bounce would instead have hit ${t && t.aFixedPointBounceWouldHit}`);
    }

    console.log('\nthe ✓ that fills an untouched row from last time:\n');
    console.log(`  tick an untouched row       db ${JSON.stringify(tick.invented.db)} · ${tick.offeredOnInvented ? 'Undo offered: ' + JSON.stringify(tick.invented.toast) : 'NO UNDO OFFERED'}`);
    console.log(`  take the Undo               db ${JSON.stringify(tick.afterUndo.db)}${tick.undoRemovedIt ? '  - the set the user never typed is gone' : '  <-- IT IS STILL THERE'}`);
    console.log(`  un-tick instead             db ${JSON.stringify(tick.unticked.db)}${tick.untickStillKeepsIt ? '  - unchanged: "not done" is not "delete"' : '  <-- un-ticking deleted it'}`);
    console.log(`  ✓ over numbers you typed    ${tick.silentWhenTyped ? 'silent, as it must be' : '<-- OFFERED AN UNDO NOBODY NEEDS'}`);

    console.log('\nthe guided run, after the app is CLOSED mid-workout:\n');
    console.log(`  logged a set in ${resume.tapsToLogTheSet} taps, closed the page, reopened, back in the run in ${resume.tapsToGetBackIn} taps`);
    console.log(`  the run opens on            ${resume.exerciseAfter || '(nothing)'}${resume.sameExercise ? '  - the same exercise' : '  <-- NOT the exercise it was on (' + resume.exerciseBefore + ')'}`);
    console.log(`  set rows                    ${resume.rowsBefore} -> ${resume.rowsAfter}, ticked ${resume.tickedBefore} -> ${resume.tickedAfter}${resume.tickRestored ? '' : '  <-- THE TICK DID NOT COME BACK'}${resume.nextSetReady ? '' : '  <-- NO ROW LEFT FOR THE SET YOU WERE ABOUT TO DO'}`);
    console.log(`  what is in the database     ${JSON.stringify(resume.dbAfter.map((s) => s.sets))}${resume.setSurvived ? '  - unchanged by the close' : '  <-- CHANGED BY THE CLOSE'}`);
    console.log(`  the rows on screen          ${JSON.stringify(resume.valuesAfter)}`);
    console.log(`  ${resume.ok ? 'RESUMED' : 'DID NOT RESUME'}`);

    if (errors.length) { console.log('\npage errors:'); for (const e of errors) console.log('  ✗ ' + e); }
    console.log('\nfence: ' + JSON.stringify(contained));
    if (results.some((r) => !r.landed) || !resume.ok || !tick.ok) process.exitCode = 1;
  } finally {
    await browser.close(); await srv.close();
  }
})().catch((e) => { console.error('ux-flows: ' + (e.stack || e.message)); process.exitCode = 1; });
