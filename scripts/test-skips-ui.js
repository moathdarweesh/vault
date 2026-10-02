#!/usr/bin/env node
// THE DAY WITHOUT TRAINING (v418), driven in a real browser: a planned day that
// passed with no session is recorded (DB.skips) and Home says so once, under the
// hero, with the one flip the owner left open — «It was a rest day», which
// postpones that day's slot — beside OK. The Day view carries the same record,
// the reminders page carries the sixth channel (`missed`), and a saved session
// re-syncs the alarms so today's training and missed-workout alarms go quiet.
//
// Same harness as scripts/test-cardio-sleep-ui.js (scripts/fp/server.js): the
// repo over loopback on a FREE port, js/cloud.js replaced by the offline stub
// ('out': no account, so boot settles at once), and a route filter that aborts
// every request that is not 127.0.0.1. Playwright is external (npm i --no-save
// playwright eslint@9 globals), never a dependency.
//
// Every expectation is computed in the page from the seed the case wrote
// through the app's own DB, and every string through t(): the same assertions
// run in AR/dark and EN/light. The seed is a rotation of three named slots on
// every weekday, anchored two weeks back, so yesterday is always a planned day
// and today always carries the next slot; skips.last is set to two days ago,
// so one settle() records exactly yesterday.
//
// Standalone: it runs itself behind the require.main guard and is required by
// no other suite, so scripts/test-all.js runs it as its own line.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';

// ── the page kit (scripts/test-cardio-sleep-ui.js's, unchanged in shape) ────
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
  // The fence aborts fonts and the live hosts; Chrome logs each as a resource error.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && typeof DB !== 'undefined');
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked();
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = (view, ctx) => ev(({ view, ctx }) => {
    try { closeModal(); } catch (_) {}
    hideToast();
    document.querySelectorAll('#modal-root .modal-overlay.nested').forEach((s) => s.remove());
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx || {});
  }, { view, ctx });
  return { ctx, page, ev, reset, errors, guard, lang, theme };
}

// ── the seed — written through DB.*, run in the page ───────────────────────
// Returns what the screens must show, every string through t().
function seedSkip() {
  const today = todayISO(), y = addDaysISO(today, -1);
  const noon = (iso) => new Date(iso + 'T12:00:00');
  const ids = DB.exercises.list().slice(0, 2).map((e) => e.id);
  DB.plan.setRotation({
    cycle: [{ name: 'QA Alpha', exerciseIds: ids }, { name: 'QA Beta', exerciseIds: ids }, { name: 'QA Gamma', exerciseIds: ids }],
    trainingDays: [0, 1, 2, 3, 4, 5, 6],
    anchor: addDaysISO(today, -14),
  });
  (DB.plan.get().restDates || []).slice().forEach((d) => DB.plan.setRest(d, false));   // setRotation carries them over
  // Boot already ran the first settle (last = yesterday). Wind the clock back
  // one day so the next settle owes exactly yesterday, then let the app settle.
  STATE.skips = { last: addDaysISO(today, -2), days: {} };
  save();
  const added = DB.skips.settle();
  const ySlot = planDayName(DB.plan.workoutForDate(noon(y)).name);
  const tSlot = planDayName(DB.plan.workoutForDate(noon(today)).name);
  const yDay = dayName(noon(y).getDay(), true);
  return {
    today, y, added, ySlot, tSlot,
    title: t('skip_card_title').replace('{day}', yDay),
    body: t('skip_card_body').replace('{slot}', ySlot),
    hint: t('skip_card_rest_hint').replace('{slot}', ySlot),
    rest: t('skip_card_rest'), ok: t('skip_card_ok'),
    toast: t('skip_rest_toast').replace('{slot}', ySlot),
    daySkipped: t('day_skipped'),
  };
}

// The card as the screen shows it, or null.
function readCard() {
  const el = document.querySelector('.view.active .skip-card');
  if (!el) return null;
  const hero = document.querySelector('.view.active .hero-card');
  const h = (sel) => { const b = el.querySelector(sel); return b ? Math.round(b.getBoundingClientRect().height) : 0; };
  const txt = (sel) => (el.querySelector(sel) || {}).textContent || '';
  return {
    iso: el.dataset.iso || '',
    shown: el.getBoundingClientRect().height > 0,
    afterHero: !!hero && !!(hero.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
    title: txt('.skip-card-title').trim(), body: txt('.skip-card-body').trim(), hint: txt('.skip-card-hint').trim(),
    rest: txt('[data-skip-rest]').trim(), ok: txt('[data-skip-ok]').trim(),
    restH: h('[data-skip-rest]'), okH: h('[data-skip-ok]'),
    all: el.textContent,
  };
}
const heroTitle = () => ((document.querySelector('.view.active .hero-card .hero-title') || {}).textContent || '').trim();

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  ['(a) Home shows the card under the hero, with yesterday\'s weekday and slot', async ({ ev, reset }) => {
    const s = await ev(seedSkip);
    assert.deepEqual(s.added, [s.y], 'setup: one settle() records exactly yesterday: ' + JSON.stringify(s.added));
    await reset('home');
    const c = await ev(readCard);
    assert.ok(c, 'Home has no .skip-card for a planned day that passed without a session');
    assert.ok(c.shown, 'the card has no height');
    assert.ok(c.afterHero, 'the card sits after the hero card');
    assert.equal(c.iso, s.y, 'the card is yesterday\'s');
    assert.equal(c.title, s.title, 'the title names yesterday\'s weekday');
    assert.equal(c.body, s.body, 'the body names yesterday\'s slot');
    assert.equal(c.hint, s.hint, 'the hint says what the flip does');
    assert.equal(c.rest, s.rest, 'the flip is «' + s.rest + '»');
    assert.equal(c.ok, s.ok, 'beside «' + s.ok + '»');
    assert.equal(c.restH, 44, 'the flip sits on the 44px rung (' + c.restH + ')');
    assert.equal(c.okH, 44, 'and OK (' + c.okH + ')');
    assert.ok(!/[{}]/.test(c.all), 'no unfilled placeholder on the card: «' + c.all.trim() + '»');
  }],

  ['(b) OK hides the card, and it stays hidden after leaving Home and coming back', async ({ page, ev, reset }) => {
    const s = await ev(seedSkip);
    await reset('home');
    assert.ok(await ev(readCard), 'setup: the card is on Home');
    await page.locator('.view.active .skip-card [data-skip-ok]').click();
    assert.equal(await ev(readCard), null, 'OK takes the card off Home');
    assert.equal(await ev(() => DB.skips.unseen()), null, 'and marks the record seen');
    assert.equal(await ev((y) => DB.skips.has(y), s.y), true, 'the record itself stays');
    await reset('workouts');
    await reset('home');
    assert.equal(await ev(readCard), null, 'the card does not come back after a navigation away and back');
  }],

  ['(c) «It was a rest day» postpones yesterday\'s slot to today, and the toast\'s Undo restores it', async ({ page, ev, reset }) => {
    const s = await ev(seedSkip);
    await reset('home');
    assert.ok(await ev(readCard), 'setup: the card is on Home');
    assert.equal(await ev(heroTitle), s.tSlot, 'setup: the hero carries today\'s own slot');
    await page.locator('.view.active .skip-card [data-skip-rest]').click();
    assert.equal(await ev(readCard), null, 'the flip takes the card off Home');
    const toast = await ev(() => { const el = document.getElementById('toast'); return { show: !!el && el.classList.contains('show'), msg: ((el && (el.querySelector('.toast-msg') || el)) || {}).textContent || '', undo: !!(el && el.querySelector('.toast-action')) }; });
    assert.ok(toast.show, 'a toast is raised');
    assert.equal(toast.msg.trim(), s.toast, 'saying the day is rest and which slot is next');
    assert.ok(toast.undo, 'with an Undo');
    assert.equal(await ev((y) => DB.plan.isRest(y), s.y), true, 'yesterday is a rest date now');
    assert.equal(await ev(heroTitle), s.ySlot, 'the hero now carries yesterday\'s slot — it was postponed, not lost');
    await page.locator('#toast.show .toast-action').click();
    assert.equal(await ev((y) => DB.plan.isRest(y), s.y), false, 'Undo takes the rest date back');
    assert.equal(await ev(heroTitle), s.tSlot, 'and the hero returns to today\'s slot');
    assert.equal(await ev((y) => DB.skips.has(y), s.y), true, 'and the record is back');
  }],

  ['(d) Settings → reminders: a sixth row after Training, a switch and a time; the summary reads six of six', async ({ ev, reset, lang }) => {
    await ev(() => DB.notif.setChannel('missed', { on: true, at: '21:00' }));
    await reset('notifications');
    const r = await ev(() => {
      const v = document.querySelector('.view.active');
      const rows = [...v.querySelectorAll('.ntfs-row')];
      const ids = rows.map((x) => (x.querySelector('[data-toggle]') || {}).dataset?.toggle || '');
      const row = rows[ids.indexOf('missed')];
      const sw = row && row.querySelector('[data-toggle="missed"]');
      const time = row && row.querySelector('input[type="time"][data-missed-at]');
      return {
        n: rows.length, ids,
        title: row ? (row.querySelector('.ntfs-title') || {}).textContent : '',
        sub: row ? (row.querySelector('.ntfs-sub') || {}).textContent : '',
        role: sw ? sw.getAttribute('role') : '', checked: sw ? sw.getAttribute('aria-checked') : '',
        time: time ? time.value : null,
        wantTitle: t('notif_ch_missed'), wantSub: t('notif_ch_missed_sub').replace('{time}', '21:00'),
      };
    });
    assert.equal(r.n, 6, 'six channel rows: ' + JSON.stringify(r.ids));
    assert.equal(r.ids.indexOf('missed'), r.ids.indexOf('train') + 1, 'the missed-workout row comes right after Training: ' + JSON.stringify(r.ids));
    assert.equal(r.title, r.wantTitle, 'its title');
    assert.equal(r.sub, r.wantSub, 'its summary names the time');
    assert.equal(r.role, 'switch', 'it has a switch');
    assert.equal(r.checked, 'true', 'on by default');
    assert.equal(r.time, '21:00', 'and a time input at 21:00');
    // The time input writes the channel.
    const at = await ev(() => {
      const i = document.querySelector('.view.active [data-missed-at]');
      i.value = '20:30';
      i.dispatchEvent(new Event('change', { bubbles: true }));
      return DB.notif.get().channels.missed.at;
    });
    assert.equal(at, '20:30', 'changing the time input sets the channel time');
    await ev(() => DB.notif.setChannel('missed', { at: '21:00' }));
    // The Settings summary: every channel is on by default, and there are six.
    await reset('settings');
    const sum = await ev(() => ((document.querySelector('.view.active #notifications-btn .settings-action-sub') || {}).textContent || '').trim());
    const want = lang === 'ar' ? '6 من 6' : '6 of 6';
    assert.ok(sum.startsWith(want), `the reminders summary reads «${want}»: «${sum}»`);
  }],

  ['(e) the Day view of yesterday carries the record and the same flip; today\'s does not', async ({ page, ev, reset }) => {
    const s = await ev(seedSkip);
    await reset('day', { date: s.y });
    const d = await ev(() => {
      const el = document.querySelector('.view.active .day-skipped');
      if (!el) return null;
      const b = el.querySelector('[data-skip-rest]');
      return { text: el.textContent, btn: b ? b.textContent.trim() : '', h: b ? Math.round(b.getBoundingClientRect().height) : 0 };
    });
    assert.ok(d, 'the Day view of yesterday has no .day-skipped');
    assert.ok(d.text.includes(s.daySkipped), `it says «${s.daySkipped}»: «${d.text.trim()}»`);
    assert.equal(d.btn, s.rest, 'with the same flip');
    assert.equal(d.h, 44, 'on the 44px rung (' + d.h + ')');
    await page.locator('.view.active .day-skipped [data-skip-rest]').click();
    assert.equal(await ev((y) => DB.plan.isRest(y), s.y), true, 'the Day view\'s flip declares the day rest');
    assert.equal(await ev(() => !!document.querySelector('.view.active .day-skipped')), false, 'and the line leaves');
    await ev((y) => DB.plan.setRest(y, false), s.y);
    await reset('day', { date: s.today });
    assert.equal(await ev(() => !!document.querySelector('.view.active .day-skipped')), false, 'today is not a day without training yet');
  }],

  ['(f) a saved session re-syncs the alarms within two seconds', async ({ ev }) => {
    const r = await ev(async () => {
      const real = window.Notify;
      let n = 0;
      window.Notify = Object.assign({}, real || {}, { sync: () => { n += 1; return Promise.resolve({ ok: true }); } });
      try {
        window.dispatchEvent(new CustomEvent('vault:session-saved'));
        const t0 = performance.now();
        while (!n && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 50));
        return { n, ms: Math.round(performance.now() - t0) };
      } finally { window.Notify = real; }
    });
    assert.ok(r.n >= 1, `vault:session-saved led to no Notify.sync() within 2 s (${JSON.stringify(r)})`);
  }],

  // The guided run fires NO vault:session-saved until its summary, yet each of
  // its commits writes today's session — so a run still going at 21:00 got «no
  // workout logged today» mid-workout unless the commit itself re-syncs the
  // alarms (queueAlarmResync in commitExercise: one burst, 1500 ms after the
  // last commit). Driven through the real controls: Home's hero → the day's
  // «guided mode» → type the first set → ✓ → Next (which leaves the exercise
  // and commits again; it is not the last, so no summary and no event).
  ['(g) the guided run\'s own commit re-syncs the alarms, with no vault:session-saved behind it', async ({ page, ev, reset }) => {
    const s = await ev(() => {
      const today = todayISO();
      const ids = DB.exercises.list().slice(0, 2).map((e) => e.id);
      DB.plan.setRotation({
        cycle: [{ name: 'QA Alpha', exerciseIds: ids }, { name: 'QA Beta', exerciseIds: ids }, { name: 'QA Gamma', exerciseIds: ids }],
        trainingDays: [0, 1, 2, 3, 4, 5, 6],
        anchor: addDaysISO(today, -14),
      });
      (DB.plan.get().restDates || []).slice().forEach((d) => DB.plan.setRest(d, false));   // setRotation carries them over
      DB.sessions.listAll().filter((x) => x.date === today).forEach((x) => DB.sessions.remove(x.id));
      return { today, first: ids[0], logged: DB.sessions.listAll().filter((x) => x.date === today).length };
    });
    assert.equal(s.logged, 0, 'setup: nothing is logged today');
    await reset('home');
    await page.locator('.view.active #home-start-workout').click();
    await page.waitForFunction(() => currentView === 'session-day' && !!document.querySelector('.view.active #sd-start-run'), null, { timeout: 5000 });
    await page.locator('.view.active #sd-start-run').click();
    await page.waitForFunction(() => currentView === 'session-run' && !!document.querySelector('.view.active .run-set-row[data-set="0"]'), null, { timeout: 5000 });
    // The spy goes in only now, so nothing the navigation did is counted.
    await ev(() => {
      const real = window.Notify;
      const q = window.__qaRunSync = { real, syncs: [], saved: [], tNext: 0 };
      q.onSaved = () => q.saved.push(performance.now());
      window.addEventListener('vault:session-saved', q.onSaved);
      window.Notify = Object.assign({}, real || {}, {
        sync: () => { q.syncs.push(performance.now()); return Promise.resolve({ ok: true }); },
        foreground: () => Promise.resolve({ ok: true }),
      });
    });
    try {
      const row = page.locator('.view.active .run-set-row[data-set="0"]');
      await row.locator('[data-field="weight"]').fill('60');
      await row.locator('[data-field="reps"]').fill('8');
      await row.locator('[data-done]').click();
      assert.equal(await row.locator('[data-done]').getAttribute('aria-pressed'), 'true', 'the ✓ marks the first set done');
      await ev(() => { window.__qaRunSync.tNext = performance.now(); });
      await page.locator('.view.active .run-nav [data-next]').click();
      const r = await ev(async (s) => {
        const q = window.__qaRunSync;
        while (!q.syncs.length && performance.now() - q.tNext < 2500) await new Promise((res) => setTimeout(res, 50));
        const first = q.syncs.length ? q.syncs[0] : null;
        const row = DB.sessions.listAll().find((x) => x.date === s.today && x.exerciseId === s.first);
        return {
          syncs: q.syncs.length,
          ms: first == null ? null : Math.round(first - q.tNext),
          savedBefore: first == null ? q.saved.length : q.saved.filter((x) => x <= first).length,
          saved: q.saved.length,
          view: currentView,
          summary: !!document.querySelector('.view.active [data-run-save]'),
          set: row && row.sets[0] ? { reps: row.sets[0].reps, weight: row.sets[0].weight, done: row.sets[0].done } : null,
        };
      }, s);
      // A stored set carries `done` only when false (runInit reads `done !== false`).
      assert.ok(r.set && r.set.reps === 8 && r.set.weight > 0 && r.set.done !== false, 'setup: the run wrote the typed, ticked set to today\'s session: ' + JSON.stringify(r));
      assert.equal(r.view, 'session-run', 'still in the run: ' + JSON.stringify(r));
      assert.equal(r.summary, false, 'and not on its summary (Next on exercise 1 of 2): ' + JSON.stringify(r));
      assert.ok(r.syncs >= 1, `the run's commits led to no Notify.sync() within 2.5 s of leaving the exercise (${JSON.stringify(r)})`);
      assert.ok(r.ms <= 2200, `the re-sync came ${r.ms} ms after leaving the exercise, past 2.2 s (${JSON.stringify(r)})`);
      assert.equal(r.savedBefore, 0, `a vault:session-saved was dispatched before the re-sync, so it was not the commit's own (${JSON.stringify(r)})`);
    } finally {
      await ev(() => {
        const q = window.__qaRunSync;
        if (q) { window.Notify = q.real; window.removeEventListener('vault:session-saved', q.onSaved); delete window.__qaRunSync; }
        try { clearRestTimer(); } catch (_) {}
      });
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
        try { await fn({ ...kit, browser, origin }); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  skips UI: ${failures.length} of ${CASES.length * 2} cases failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  skips UI (${passed} cases, AR/dark + EN/light, 375px): the day-without-training card under the hero with yesterday's weekday and slot and two 44px buttons, OK hides it for good, «It was a rest day» postpones the slot to today with a toast whose Undo restores it, the sixth reminder row after Training (switch, time, summary) and «6 of 6», the Day view's line and flip, a saved session re-syncing the alarms, and the guided run's own commit re-syncing them with no session-saved event behind it`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
