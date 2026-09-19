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

  assert.deepEqual(errors, [], 'page errors:\n  ' + errors.join('\n  '));
  seen.assertContained();
  await browser.close();
  await srv.close();

  console.log('PASS notif events: no domain calls the reminder system by name; vault:session-saved and '
    + 'vault:reminders-changed each reach it synchronously, in order, and an unrelated event does not');
})();
