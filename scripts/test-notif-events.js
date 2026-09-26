// The reminder system is told things by the rest of the app. Before v363 it was
// told by DIRECT CALL from three workout save paths and two supplement paths,
// every one of them inside a bare try/catch or unguarded — so a rename made them
// silently do nothing, which is the exact shape of the v251 failure ("its only
// callers were the permission sheet and the settings redraw, so a normal session
// armed zero in-app timers").
//
// They are `vault:*` events now, which contract 7 can see. This suite proves the
// other half, which no contract can: that the events actually REACH the domain
// and do the same work, in the same order, synchronously.
//
// ⚠️ THE SPIES WORK BECAUSE A TOP-LEVEL `function` IN A CLASSIC SCRIPT IS A
// PROPERTY OF THE GLOBAL OBJECT. `const`/`let` are not — they live in the
// declarative record and cannot be replaced from outside. So this technique
// covers function declarations only, which is what these five names are.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('playwright');   // MODULE_NOT_FOUND here is what test-all.js reads as "needs a browser runtime"
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ROOT = path.resolve(__dirname, '..');

// ── half one: the source no longer carries a domain→domain call ─────────────
// A green browser check over an app that still calls directly would prove
// nothing about whether the OLD path was removed.
{
  const src = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8').split(/\r?\n/);
  const TOP = /^(?:async\s+)?(?:function\s+\*?|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/;
  const ownerOf = (n) => { let cur = '(top level)'; for (let i = 0; i < n; i++) { const m = TOP.exec(src[i]); if (m) cur = m[1]; } return cur; };
  // Inside the notifications domain itself, or in the shell: both are allowed.
  // Anything else is a domain reaching into the reminder system by name.
  const ALLOWED = new Set(['openNotifPermSheet', 'renderNotifications', 'maybeAskNotifPermission',
    'armNotifications', 'syncRemindersOrWarn', 'refreshAfterSync', 'afterScripts', '(top level)']);
  const strays = [];
  for (const name of ['maybeAskNotifPermission', 'armNotifications', 'syncRemindersOrWarn']) {
    src.forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, '');
      if (!new RegExp('(?:^|[^\\w$.])' + name + '\\s*\\(').test(code)) return;
      if (TOP.exec(l)) return;                       // the declaration itself
      const owner = ownerOf(i + 1);
      if (!ALLOWED.has(owner)) strays.push(owner + ' calls ' + name + '() directly at js/app.js:' + (i + 1));
    });
  }
  assert.deepEqual(strays, [], 'a domain still reaches the reminder system by name:\n  ' + strays.join('\n  '));
}

(async () => {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const seen = await fence(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(origin + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.armNotifications === 'function', null, { timeout: 15000 });

  // ── half two: each event reaches the domain, synchronously, once ───────────
  const got = await page.evaluate(() => {
    const calls = [];
    const spy = (n) => { window[n] = function () { calls.push(n); }; };
    ['maybeAskNotifPermission', 'armNotifications', 'syncRemindersOrWarn'].forEach(spy);

    const out = {};
    calls.length = 0;
    window.dispatchEvent(new CustomEvent('vault:session-saved'));
    out.afterSessionSaved = calls.slice();           // read BEFORE yielding: proves it was synchronous

    calls.length = 0;
    window.dispatchEvent(new CustomEvent('vault:reminders-changed'));
    out.afterRemindersChanged = calls.slice();

    // an unrelated event must not reach either listener
    calls.length = 0;
    window.dispatchEvent(new CustomEvent('vault:save-state'));
    out.afterUnrelated = calls.slice();
    return out;
  });

  assert.deepEqual(got.afterSessionSaved, ['maybeAskNotifPermission'],
    'vault:session-saved did not synchronously reach the permission ask: ' + JSON.stringify(got.afterSessionSaved));
  assert.deepEqual(got.afterRemindersChanged, ['armNotifications', 'syncRemindersOrWarn'],
    'vault:reminders-changed did not run the pair in order: ' + JSON.stringify(got.afterRemindersChanged));
  assert.deepEqual(got.afterUnrelated, [],
    'an unrelated vault:* event reached the reminder listeners: ' + JSON.stringify(got.afterUnrelated));

  // ── half three: the in-app bar shows reminders ONE AT A TIME ───────────────
  // Three channels in one minute is the ordinary case, not an edge: every
  // out-of-window dose and meal is moved to window.start, and equal `at`s get
  // equal delays. The swap nulled the current bar and mounted the next 120ms
  // later, so a THIRD call inside that window mounted at once; the delayed mount
  // then cancelled its timer and took the slot, and the third bar stayed until
  // a swipe. On v397 this read, at 0 / 2.5 / 5.5 / 11 / 17 s:
  //   «QA supps (leaving) + QA train», «QA train + QA food», «QA train», «QA train», «QA train».
  // The page runs on Playwright's clock, so five-second lives cost nothing.
  const page2 = await ctx.newPage();
  const seen2 = await fence(page2);
  page2.on('pageerror', (e) => errors.push(String(e)));
  await page2.clock.install({ time: new Date('2026-09-15T08:00:00') });
  await page2.goto(origin + '/index.html', { waitUntil: 'load' });
  await page2.waitForFunction(() => typeof window.showNotifBar === 'function' && window.__vltReady, null, { timeout: 15000 });
  await page2.bringToFront();
  // The boot's own timers (the review, the catch-up) run out first; whatever
  // they put up is removed and its timers are let finish.
  await page2.clock.runFor(2000);
  await page2.evaluate(() => { document.querySelectorAll('.ntf-bar').forEach((b) => b.remove()); document.getElementById('onboard-gate')?.remove(); });
  await page2.clock.runFor(6000);
  const bars = () => page2.evaluate(() => [...document.querySelectorAll('.ntf-bar')].map((b) => ({
    title: (b.querySelector('.ntf-title') || {}).textContent || '',
    body: (b.querySelector('.ntf-body') || {}).textContent || '',
    leaving: /\bis-(outx|outy|swap)\b/.test(b.className),
  })));
  const said = (list) => list.map((b) => b.title + (b.leaving ? ' (leaving)' : '')).join(' + ') || '(none)';
  await page2.evaluate(() => {
    showNotifBar({ channel: 'supps', title: 'QA supps' });
    showNotifBar({ channel: 'food', title: 'QA food' });
    showNotifBar({ channel: 'train', title: 'QA train' });
  });
  const shown = [said(await bars())];
  for (const ms of [2500, 3000, 5500, 6000]) { await page2.clock.runFor(ms); shown.push(said(await bars())); }
  assert.deepEqual(shown, ['QA supps', 'QA supps', 'QA food', 'QA train', '(none)'],
    'three reminders in one minute are shown one at a time, each for its own five seconds, and leave nothing behind (0 / 2.5 / 5.5 / 11 / 17 s): ' + JSON.stringify(shown));

  await page2.evaluate(() => document.querySelectorAll('.ntf-bar').forEach((b) => b.remove()));
  await page2.clock.runFor(6000);
  // A same-channel reminder that arrives while the last bar is LEAVING was
  // written into the leaving bar and vanished with it. v397: «(none)».
  await page2.evaluate(() => showNotifBar({ channel: 'supps', title: 'QA first' }));
  await page2.clock.runFor(5050);                       // its five seconds are up: it is on its way out
  await page2.evaluate(() => showNotifBar({ channel: 'supps', title: 'QA second' }));
  await page2.clock.runFor(400);
  const second = said(await bars());
  assert.equal(second, 'QA second', 'a same-channel reminder that arrives while the last bar is leaving is shown, not written into the leaving bar: ' + second);
  await page2.clock.runFor(6000);

  await page2.evaluate(() => document.querySelectorAll('.ntf-bar').forEach((b) => b.remove()));
  await page2.clock.runFor(6000);
  // …and a same-channel update carrying a body the first bar did not have
  // dropped the body, because the span to hold it did not exist. v397: body «».
  await page2.evaluate(() => {
    showNotifBar({ channel: 'water', title: 'QA water' });
    showNotifBar({ channel: 'water', title: 'QA water 2', body: 'QA body' });
  });
  const swapped = await bars();
  assert.deepEqual(swapped.map((b) => [b.title, b.body]), [['QA water 2', 'QA body']],
    'a same-channel update brings its body with it: ' + JSON.stringify(swapped));
  await page2.clock.runFor(6000);

  await page2.evaluate(() => document.querySelectorAll('.ntf-bar').forEach((b) => b.remove()));
  await page2.clock.runFor(6000);
  // ── half four: deliver() asks again at fire time ──────────────────────────
  // scheduleForDate drops a linked dose once it is ticked, food once today's
  // target is met and the streak once today has training — but only when the
  // timers are ARMED, and ticking, eating or training does not re-arm them.
  // deliver() re-asked about water alone, so the other three arrived for
  // something the user had just done. On v397 all four probes below came back
  // {spent:true, logged:true}.
  const dv = await page2.evaluate(() => {
    const today = todayISO();
    const probe = (item) => {
      const before = DB.notif.logForDate(today).filter((x) => x.tag === item.tag).length;
      deliver(item);
      return { spent: DB.notif.alreadySent(item.tag), logged: DB.notif.logForDate(today).filter((x) => x.tag === item.tag).length > before };
    };
    const out = {};
    const taken = DB.supplements.add({ name: 'QA dose', dose: '', color: '', times: [] });
    DB.supplements.setTaken(taken.id, today, true);
    out.suppTaken = probe({ date: today, at: '08:00', channel: 'supps', tag: 'supps:qa-taken:' + today, payload: { name: 'QA dose', i: 1, n: 1, suppId: taken.id } });
    DB.nutrition.setTargets({ calories: 1500, protein: 100, carbs: 150, fat: 50 });
    DB.foodLogs.add(today, { name: 'QA meal', servings: 1, calories: 1600, protein: 10, carbs: 10, fat: 10 });
    out.foodMet = probe({ date: today, at: '08:00', channel: 'food', tag: 'food:qa-met:' + today, payload: { name: 'QA lunch', i: 1, n: 1 } });
    DB.sessions.add({ exerciseId: DB.exercises.list()[0].id, date: today, sets: [{ reps: 5, weight: 40 }] });
    out.streakKept = probe({ date: today, at: '08:00', channel: 'streak', tag: 'streak:' + today, payload: { n: 9 } });
    // the control: a dose nobody has ticked still arrives, and spends its tag
    const open = DB.supplements.add({ name: 'QA dose 2', dose: '', color: '', times: [] });
    out.suppOpen = probe({ date: today, at: '08:00', channel: 'supps', tag: 'supps:qa-open:' + today, payload: { name: 'QA dose 2', i: 1, n: 1, suppId: open.id } });
    return out;
  });
  const quiet = { spent: false, logged: false };
  assert.deepEqual(dv, { suppTaken: quiet, foodMet: quiet, streakKept: quiet, suppOpen: { spent: true, logged: true } },
    'a reminder whose reason is gone by the time it fires is dropped without spending its tag (a ticked dose, a met target, a streak kept), and one still due arrives: ' + JSON.stringify(dv));
  await page2.clock.runFor(6000);

  assert.deepEqual(errors, [], 'page errors:\n  ' + errors.join('\n  '));
  seen.assertContained();
  seen2.assertContained();
  await browser.close();
  await srv.close();

  console.log('PASS notif events: no domain calls the reminder system by name; vault:session-saved and '
    + 'vault:reminders-changed each reach it synchronously, in order, and an unrelated event does not; '
    + 'three bars in one minute show one at a time and leave nothing; a reminder is re-asked at fire time');
})();
