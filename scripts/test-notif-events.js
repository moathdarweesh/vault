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
//
// Half five (v438, v440) holds the in-app bar's words: the title one line, the
// body two at most, apart and inside the capsule, in both directions, at 375
// and 320 px. It was seen failing on v437's and v439's stylesheets and on the
// other defects listed in docs/RELEASE-NOTES.md (v438, v440), each planted in
// memory (the file on disk never written).
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

  // v363–v417 pinned session-saved to the permission ask ALONE:
  //   assert.deepEqual(got.afterSessionSaved, ['maybeAskNotifPermission'],
  //     'vault:session-saved did not synchronously reach the permission ask: ' + JSON.stringify(got.afterSessionSaved));
  // v418 widens it on purpose. A logged session must silence today's training
  // and missed-workout reminders, and an alarm already handed to the OS is
  // withdrawn only by a re-sync — stillDue() answers at fire time in the app,
  // never inside Android's alarm. So the listener still asks synchronously
  // (the line below is the old assertion, kept), and then re-syncs the alarms
  // ONCE, debounced: a run of saves during a workout is one re-sync.
  assert.deepEqual(got.afterSessionSaved, ['maybeAskNotifPermission'],
    'vault:session-saved did not synchronously reach the permission ask: ' + JSON.stringify(got.afterSessionSaved));
  const resync = await page.evaluate(async () => {
    const real = window.Notify;
    let n = 0;
    window.Notify = Object.assign({}, real, { sync: () => { n += 1; return Promise.resolve({ ok: true }); } });
    try {
      window.dispatchEvent(new CustomEvent('vault:session-saved'));
      window.dispatchEvent(new CustomEvent('vault:session-saved'));
      const now = n;                                   // read BEFORE yielding: the re-sync is not synchronous
      await new Promise((r) => setTimeout(r, 2200));   // the debounce is 1500 ms
      return { now, later: n };
    } finally { window.Notify = real; }
  });
  assert.deepEqual(resync, { now: 0, later: 1 },
    'two vault:session-saved in a row re-sync the alarms once, after the debounce (want {now:0, later:1}): ' + JSON.stringify(resync));
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

  // ── half five: the bar's title is ONE line, its body TWO AT MOST, apart ────
  // From v231 to v437 both were inline <span>s written with no space between
  // them, and nothing in the stylesheet made them boxes: ONE run, the last
  // letter of the title touching the first of the body («0 من 2,500 ملبقي
  // 2,500 مل — نحو 10 أكواب.»). Measured on v437 in both languages, at 375 and
  // 320 px: the gap between the two boxes 0, and at 320 px the body past the
  // capsule's end (in Arabic at −1.4 px, off the screen), because the one-line
  // cap and its ellipsis mean nothing on an inline box. v438 made them a column.
  // v440 (the owner, shown v438's «…»: «Two body lines»): the body takes a
  // second line when its words need one, and never a third.
  // The words are the app's own water reminder, the one the defect was seen on.
  // Every figure is read off the two nodes' rectangles and compared with the
  // bar's own; the fence keeps the web font out, so this holds the STRUCTURE
  // (the same words in the app's font were measured by hand, v438's and v440's
  // notes), and no case below assumes how wide a word is: the body that needs
  // exactly two lines is FOUND, a word at a time, in whatever font is drawn.
  const lines = () => page2.evaluate(() => {
    const bar = document.querySelector('.ntf-bar');
    if (!bar) return null;
    const r1 = (n) => Math.round(n * 10) / 10;
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(r1); };
    const tEl = bar.querySelector('.ntf-title'), bEl = bar.querySelector('.ntf-body');
    const ts = tEl ? getComputedStyle(tEl) : null, bs = bEl ? getComputedStyle(bEl) : null;
    const rows = (el, s) => (el ? r1(el.getBoundingClientRect().height / parseFloat(s.lineHeight)) : 0);
    // A third line, were one painted, would lie right under the body's box:
    // ask the page what is there, at the end the line starts from.
    let under = false;
    if (bEl) { const r = bEl.getBoundingClientRect(); under = document.elementFromPoint(bs.direction === 'rtl' ? r.right - 8 : r.left + 8, r.bottom + 3) === bEl; }
    // The body's clip path as [top, right, bottom, left], in px.
    const m = bs ? /^inset\(([^)]*)\)$/.exec(bs.clipPath) : null;
    const v = m ? m[1].trim().split(/\s+/).map(parseFloat) : null;
    const floor = v ? [v[0], v.length > 1 ? v[1] : v[0], v.length > 2 ? v[2] : v[0], v.length > 3 ? v[3] : (v.length > 1 ? v[1] : v[0])] : null;
    return {
      dir: document.body.getAttribute('dir'), bar: box(bar), title: box(tEl), body: box(bEl),
      tRows: rows(tEl, ts), bRows: rows(bEl, bs), bLine: bs ? r1(parseFloat(bs.lineHeight)) : 0,
      more: bEl ? bEl.scrollHeight - bEl.clientHeight : 0, under, said: bEl ? bEl.textContent : '',
      titleCut: ts ? ts.overflowX + ' ' + ts.overflowY : '', bodyCut: bs ? bs.overflowX + ' ' + bs.overflowY : '', floor,
      known: CSS.supports('overflow', 'clip') && CSS.supports('clip-path', 'inset(0)'),
    };
  });
  // The distance between the two boxes in the order they are READ: along the
  // line when they share one (from the title's end to the body's start, so a
  // margin on a physical side reads as nothing in one of the two directions),
  // down the bar when the body stands under the title.
  const apart = (g) => {
    const [tl, tt, tr, tb] = g.title, [bl, bt, br, bb] = g.body;
    const oneLine = Math.min(tb, bb) - Math.max(tt, bt) > 0.5;
    return Math.round((oneLine ? (g.dir === 'rtl' ? tl - br : bl - tr) : bt - tb) * 10) / 10;
  };
  const within = (a, b) => a[0] >= b[0] - 0.5 && a[1] >= b[1] - 0.5 && a[2] <= b[2] + 0.5 && a[3] <= b[3] + 0.5;
  const tall = (g) => Math.round((g.bar[3] - g.bar[1]) * 10) / 10;
  const raise = async (words) => {
    await page2.evaluate(() => document.querySelectorAll('.ntf-bar').forEach((b) => b.remove()));
    await page2.clock.runFor(6000);
    await page2.evaluate((p) => showNotifBar({ channel: 'water', title: p.title, body: p.body }), words);
    await page2.clock.runFor(400);                      // the entrance is over: the bar is at rest
    return lines();
  };
  // What every bar owes, whatever its words: both nodes measurable, apart in
  // reading order, inside the capsule, the title on ONE line.
  const owes = (g, say) => {
    assert.ok(g && g.title && g.body, 'the bar is up with both nodes — ' + say);
    assert.ok(g.title[2] - g.title[0] > 20 && g.body[2] - g.body[0] > 20 && g.title[3] - g.title[1] > 8 && g.body[3] - g.body[1] > 8,
      'the title and the body each have a box to measure — ' + say);
    assert.ok(apart(g) >= 1,
      'the bar\'s title and body are apart (the gap between their boxes, in reading order, is ' + apart(g) + ' px; v437: 0, one run) — ' + say);
    assert.ok(within(g.title, g.bar) && within(g.body, g.bar),
      'the bar\'s title and body both lie inside the capsule (v437 at 320 px: the body ran past its end) — ' + say);
    assert.equal(g.tRows, 1, 'the title is one line (' + g.tRows + ') — ' + say);
  };
  for (const lang of ['ar', 'en']) {
    for (const [w, h] of [[375, 812], [320, 640]]) {
      await page2.setViewportSize({ width: w, height: h });
      const at = lang + ' ' + w + ' px';
      const words = await page2.evaluate((lang) => {
        DB.prefs.setLang(lang); applyLang(lang);
        return DB.notif.text({ channel: 'water', date: todayISO(), at: '08:00', tag: 'qa:lines', payload: {} }, 'live');
      }, lang);
      assert.ok(words.title && words.body, at + ': the water reminder has a title and a body: ' + JSON.stringify(words));

      // The app's own words: whole, on two lines at most.
      const g = await raise(words);
      const say = at + ' «' + words.title + '» / «' + words.body + '»: ' + JSON.stringify(g);
      assert.equal(g && g.dir, lang === 'ar' ? 'rtl' : 'ltr', at + ': the page reads in the language under test');
      owes(g, say);
      assert.ok(g.bRows <= 2 && g.more <= 1 && g.said === words.body,
        'the app\'s own words are whole in the bar, on two lines at most (' + g.bRows + ' lines, ' + g.more + ' px unseen) — ' + say);

      // ONE word: one line in any font. The height every other bar is read against.
      const first = words.body.split(' ')[0];
      const one = await raise({ title: words.title, body: first });
      const sayOne = at + ', a one-word body «' + first + '»: ' + JSON.stringify(one);
      owes(one, sayOne);
      assert.equal(one.bRows, 1, 'a one-word body is one line — ' + sayOne);

      // The body that needs EXACTLY two lines, found a word at a time through
      // the bar's own in-place swap (the same words again, and nothing else: a
      // glyph the short words do not have could come from another font and
      // change a line's height by itself; CI's fallback is not this PC's).
      const mid = await page2.evaluate((p) => {
        const pool = [];
        for (let i = 0; i < 12; i++) pool.push(...p.body.split(' '));
        const rows = () => { const el = document.querySelector('.ntf-bar .ntf-body'); return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)); };
        let k = 1, text = pool[0];
        while (rows() < 2 && k < pool.length) { text += ' ' + pool[k++]; showNotifBar({ channel: 'water', title: p.title, body: text }); }
        return text;
      }, words);
      const M = await raise({ title: words.title, body: mid });
      const sayM = at + ', the first body that needs a second line «' + mid + '»: ' + JSON.stringify(M);
      owes(M, sayM);
      assert.equal(M.bRows, 2, 'a body that needs a second line takes it (v438: one line, cut with «…») — ' + sayM);
      assert.ok(M.more <= 1 && M.said === mid, 'and it is whole on its two lines (' + M.more + ' px unseen) — ' + sayM);
      assert.ok(Math.abs((tall(M) - tall(one)) - M.bLine) <= 0.6,
        'the bar grows by exactly one body line for it (' + tall(one) + ' → ' + tall(M) + ' px, a line is ' + M.bLine + ') — ' + sayM);
      assert.equal(M.under, false, 'nothing of the body lies under its own box — ' + sayM);

      // Words far too long: the title still one line, the body two and NO MORE,
      // the rest unseen and unpainted, the bar no taller than for exactly two.
      const long = { title: [1, 2, 3, 4].map(() => words.title).join(' '), body: [1, 2, 3, 4, 5, 6, 7, 8].map(() => words.body).join(' ') };
      const L = await raise(long);
      const sayL = at + ', words far too long: ' + JSON.stringify(L);
      owes(L, sayL);
      assert.equal(L.bRows, 2, 'a body too long for two lines takes two and no more (' + L.bRows + ') — ' + sayL);
      assert.ok(L.more > 1, 'and the rest of it is cut (' + L.more + ' px unseen), or this case proves nothing — ' + sayL);
      assert.equal(L.under, false, 'no third line is painted under the body\'s box — ' + sayL);
      assert.equal(tall(L), tall(M), 'the bar is as tall as it is for a body of exactly two lines — ' + sayL);

      // LAST, what no rectangle can show. The title is cut SIDEWAYS only, the
      // body at its FLOOR only: a cut on all four sides takes the top of a
      // tanwin, of a shadda, and the flag of a «ك» with it (compared by pixels,
      // v438's and v440's notes). Read off the computed style, the only place a
      // clip can be read; and asked after the cases above, so that a third line
      // that IS painted is caught by where it lies, not by a property's name.
      assert.ok(g.known, 'this Chrome knows `overflow: clip` and `clip-path`, or the next two lines prove nothing');
      assert.equal(g.titleCut, 'clip visible', 'the title is cut along the line only, never above or below it (overflow-x overflow-y) — ' + say);
      assert.ok(g.bodyCut === 'visible visible' && g.floor && g.floor[2] === 0 && g.floor[0] <= -2 && g.floor[1] <= -2 && g.floor[3] <= -2,
        'the body is cut at its floor only: a clip path whose bottom is the box\'s own and whose other three sides stand outside it (overflow ' + g.bodyCut + ', inset ' + JSON.stringify(g.floor) + ') — ' + say);
    }
  }
  await page2.evaluate(() => document.querySelectorAll('.ntf-bar').forEach((b) => b.remove()));
  await page2.clock.runFor(6000);

  assert.deepEqual(errors, [], 'page errors:\n  ' + errors.join('\n  '));
  seen.assertContained();
  seen2.assertContained();
  await browser.close();
  await srv.close();

  console.log('PASS notif events: no domain calls the reminder system by name; vault:session-saved and '
    + 'vault:reminders-changed each reach it synchronously, in order, and an unrelated event does not; '
    + 'three bars in one minute show one at a time and leave nothing; a reminder is re-asked at fire time; '
    + 'the bar\'s title is one line and its body two at most, apart and inside the capsule, in Arabic and English at 375 and 320 px');
})();
