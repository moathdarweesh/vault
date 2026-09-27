#!/usr/bin/env node
// THE GUIDED RUN'S CARRIED HINT and HOME'S PERIOD LABELS, driven in a real
// browser with real clicks.
//
// (a) A new figure typed and ticked on one set becomes the pale hint of every
//     LATER, UNTOUCHED set whose hint was the same as that set's own — the
//     straight-sets case: 60 → 62.5 on set 1 used to leave sets 2 and 3
//     hinting 60, so the change cost a tap + typing on every set. A pyramid's
//     sets keep their own hints (theirs differ). Nothing is written before a
//     set's own ✓; the ✓ that takes a carried hint says where the numbers came
//     from, with Undo. The suggestion fills EVERY open set, not only the first.
// (b) Home's stat strip says what period each figure counts — training DAYS
//     this week, cardio minutes this week, today's sleep — and every label fits
//     its cell at 375 and 340 px, at the normal and the larger text size.
//
// Same harness as scripts/test-cardio-sleep-ui.js (scripts/fp/server.js): the
// repo over loopback on a free port, js/cloud.js replaced by an offline stub,
// and a route filter that aborts every request that is not 127.0.0.1 — the
// Worker is never reached. Playwright is external, never a dependency.
//
// Standalone: it runs itself behind the require.main guard and is required by
// no other suite.
//
// Seen failing on the tree before the change (a check is trusted only after it
// has been seen to fail): every carry case, the suggestion case and the Home
// label case printed FAIL, AR and EN («sets 2 and 3 now hint 62.5», «BOTH open
// sets hint the suggestion», «the three cells read the new period labels»,
// «340px: «Today's sleep» is cut (ellipsis)»). The two that pass on the old
// tree by nature were seen failing on a planted defect: the pyramid case with
// carryHint's same-old-hint guard removed, the fit case with the
// `.home-stats .stat-cell-label` wrap rule disabled («375px: «أيام التمرين هذا
// الأسبوع» is cut (ellipsis)»). The Arabic labels take two lines at most, the
// upper-case English «TRAINING DAYS THIS WEEK» three.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';

// ── the page kit ────────────────────────────────────────────────────────────
async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    colorScheme: theme,
    timezoneId: 'Asia/Riyadh',
    locale: lang === 'ar' ? 'ar-SA' : 'en-US',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && typeof DB !== 'undefined');
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked();
    DB.prefs.setUnit('kg');
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settled = () => page.waitForFunction(() => !document.querySelector('.view.active.enter, .view.active .enter'), null, { timeout: 3000 }).catch(() => {});
  return { ctx, page, ev, settled, errors, guard, lang, theme };
}

// ── the run kit ─────────────────────────────────────────────────────────────
const row = (i) => `.view.active .run-set-row[data-set="${i}"]`;

// One exercise that today's plan does not carry (no targets, so the
// suggestion shows and the rows come from last time), its history replaced by
// ONE earlier session with the given sets, then the run opened on it.
async function openRun(kit, sets, { daysAgo = 3 } = {}) {
  return kit.ev(({ sets, daysAgo }) => {
    try { closeModal(); } catch (_) {}
    try { clearRestTimer(); } catch (_) {}
    hideToast();
    const planned = new Set((DB.plan.workoutForDate(new Date())?.exerciseIds) || []);
    const ex = DB.exercises.list().find((e) => !planned.has(e.id));
    DB.sessions.listByExercise(ex.id).forEach((s) => DB.sessions.remove(s.id));
    const today = todayISO();
    if (sets.length) DB.sessions.add({ exerciseId: ex.id, date: addDaysISO(today, -daysAgo), sets });
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    navigate('session-run', { date: today, runOnly: [ex.id] });
    return { id: ex.id, today };
  }, { sets, daysAgo });
}
const ghosts = (kit) => kit.ev(() => [...document.querySelectorAll('.view.active .run-set-row')].map((r) => {
  const [reps, w] = r.querySelectorAll('input');
  return [reps.value, reps.placeholder, w.value, w.placeholder];
}));
const stored = (kit, { id, today }) => kit.ev(({ id, today }) =>
  (DB.sessions.listByExercise(id).find((s) => s.date === today) || { sets: [] }).sets.map((s) => [s.reps, s.weight, s.done !== false]), { id, today });
const toastNow = (kit) => kit.ev(() => {
  const el = document.querySelector('.toast.show');
  return el ? { msg: (el.querySelector('.toast-msg') || el).textContent.trim(), undo: !!el.querySelector('.toast-action') } : null;
});
const tick = (kit, i) => kit.page.locator(row(i) + ' [data-done]').click();
const type = (kit, i, field, v) => kit.page.locator(row(i) + ` [data-field="${field}"]`).fill(String(v));
const cleanup = (kit, s) => kit.ev(({ id }) => {
  try { clearRestTimer(); } catch (_) {}
  hideToast();
  DB.sessions.listByExercise(id).forEach((x) => DB.sessions.remove(x.id));
  navigate('home');
}, s);

// ── the cases ───────────────────────────────────────────────────────────────
const straight = [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }, { reps: 8, weight: 60 }];

const CASES = [
  ['straight sets: a new weight ticked on set 1 becomes the hint of sets 2 and 3, and nothing else is written', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      assert.deepEqual(await ghosts(kit), [['', '8', '', '60'], ['', '8', '', '60'], ['', '8', '', '60']], 'setup: three rows hinting last time');
      await type(kit, 0, 'weight', '62.5');
      await tick(kit, 0);
      assert.deepEqual(await ghosts(kit), [['8', '8', '62.5', '60'], ['', '8', '', '62.5'], ['', '8', '', '62.5']],
        'sets 2 and 3 now hint 62.5 (the reps hint was not changed, so it stays 8); set 1 took its reps from its own ghost');
      assert.deepEqual(await stored(kit, s), [[8, 62.5, true]], 'only the ticked set reached the database — a hint is never a value');
      await kit.ev(() => hideToast());
      await tick(kit, 1);
      assert.deepEqual(await stored(kit, s), [[8, 62.5, true], [8, 62.5, true]], 'a ✓ on the untouched set 2 logs the carried figure');
      const tt = await toastNow(kit);
      assert.equal(tt && tt.msg, await kit.ev(() => t('run_carry_updated')), 'and says the numbers came from the set before, not «last time»');
      assert.equal(tt.undo, true, 'with Undo, as every ✓ that invents figures');
    } finally { await cleanup(kit, s); }
  }],
  ['straight sets: new reps carry too, each field on its own', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      await type(kit, 0, 'reps', '10');
      await tick(kit, 0);
      assert.deepEqual((await ghosts(kit)).slice(1).map((g) => [g[1], g[3]]), [['10', '60'], ['10', '60']], 'the reps hint moved to 10, the weight hint stayed 60');
    } finally { await cleanup(kit, s); }
  }],
  ['the ✓ names where its numbers came from per field: an earlier set only when both did, «an earlier set» never «the previous one»', async (kit) => {
    // (1) Straight sets, new reps on set 1: set 2's reps are carried and its
    //     weight hint is the very figure set 1 logged — both from an earlier set.
    let s = await openRun(kit, straight);
    try {
      await type(kit, 0, 'reps', '10');
      await tick(kit, 0);
      await kit.ev(() => hideToast());
      await tick(kit, 2);                                   // set 3, while set 2 is still open
      assert.equal((await toastNow(kit) || {}).msg, await kit.ev(() => t('run_carry_updated')), 'both figures are set 1\'s: the carry toast');
      const words = await kit.ev(() => ({ lang: DB.prefs.get().lang, keys: [t('run_carry_saved'), t('run_carry_updated')] }));
      const previous = words.lang === 'ar' ? /المجموعة السابقة/ : /previous set/i;
      assert.ok(words.keys.every((k) => !previous.test(k)), 'set 3 took set 1\'s numbers, not «the previous set\'s»: ' + words.keys.join(' | '));
    } finally { await cleanup(kit, s); }
    // (2) Rising weights, new reps on set 1: set 2 takes set 1's reps but keeps
    //     LAST TIME's 65 — neither «an earlier set's numbers» nor «last time's».
    s = await openRun(kit, [{ reps: 8, weight: 60 }, { reps: 8, weight: 65 }, { reps: 8, weight: 70 }]);
    try {
      await type(kit, 0, 'reps', '10');
      await tick(kit, 0);
      assert.deepEqual((await ghosts(kit))[1].slice(1, 4).filter((_, k) => k !== 1), ['10', '65'], 'setup: set 2 hints 10 reps (carried) × 65 (last time)');
      await kit.ev(() => hideToast());
      await tick(kit, 1);
      const got = await toastNow(kit), want = await kit.ev(() => ({ carry: t('run_carry_updated'), filled: t('run_filled_updated'), mixed: t('run_mixed_updated') }));
      assert.notEqual(got && got.msg, want.carry, 'the 65 did not come from an earlier set');
      assert.notEqual(got && got.msg, want.filled, 'and the 10 did not come from last time');
      assert.equal(got && got.msg, want.mixed, 'a mixed ✓ says so');
      assert.equal(got.undo, true);
    } finally { await cleanup(kit, s); }
  }],
  ['a pyramid keeps its own hints', async (kit) => {
    const s = await openRun(kit, [{ reps: 12, weight: 50 }, { reps: 10, weight: 55 }, { reps: 8, weight: 60 }]);
    try {
      await type(kit, 0, 'weight', '52.5');
      await tick(kit, 0);
      assert.deepEqual((await ghosts(kit)).slice(1).map((g) => [g[1], g[3]]), [['10', '55'], ['8', '60']], 'sets 2 and 3 hinted other figures than set 1, so they are not straight sets and nothing moves');
    } finally { await cleanup(kit, s); }
  }],
  ['a typed but un-ticked figure carries nothing, and a row with its own numbers is left alone', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      await type(kit, 0, 'weight', '65');
      await kit.page.locator(row(1) + ' [data-field="weight"]').focus();   // leave the field: the blur commit, no ✓
      await kit.page.waitForFunction(({ id, today }) => DB.sessions.listByExercise(id).some((x) => x.date === today), s, { timeout: 3000 });
      assert.deepEqual((await ghosts(kit)).slice(1).map((g) => g[3]), ['60', '60'], 'no ✓, no carry');
      await type(kit, 1, 'weight', '70');                                   // set 2 is now the user's own
      await tick(kit, 0);
      const g = await ghosts(kit);
      assert.deepEqual([g[1][2], g[1][3]], ['70', '60'], 'set 2 keeps what was typed in it, and its hint is not touched');
      assert.equal(g[2][3], '65', 'the untouched set 3 takes the carried figure');
    } finally { await cleanup(kit, s); }
  }],
  ['a corrected figure carries again after an un-tick', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      await type(kit, 0, 'weight', '62.5');
      await tick(kit, 0);
      await tick(kit, 0);                         // un-tick
      await type(kit, 0, 'weight', '65');
      await tick(kit, 0);
      assert.deepEqual((await ghosts(kit)).slice(1).map((g) => g[3]), ['65', '65'], 'the sets that took 62.5 from set 1 follow its correction');
      assert.deepEqual(await stored(kit, s), [[8, 65, true]], 'and still only set 1 is written');
    } finally { await cleanup(kit, s); }
  }],
  ['a pound user: the carried hint is shown in the unit typed', async (kit) => {
    await kit.ev(() => DB.prefs.setUnit('lb'));
    const s = await openRun(kit, [{ reps: 5, weight: 61.23 }, { reps: 5, weight: 61.23 }]);   // 135 lb
    try {
      assert.deepEqual((await ghosts(kit)).map((g) => g[3]), ['135', '135'], 'setup: the ghost in pounds');
      await type(kit, 0, 'weight', '140');
      await tick(kit, 0);
      assert.equal((await ghosts(kit))[1][3], '140', 'set 2 hints 140 lb');
      await kit.ev(() => hideToast());
      await tick(kit, 1);
      const st = await stored(kit, s);
      assert.equal(st.length, 2);
      assert.equal(st[1][1], st[0][1], 'the ✓ on set 2 stores exactly the kilograms set 1 stored');
    } finally { await cleanup(kit, s); await kit.ev(() => DB.prefs.setUnit('kg')); }
  }],
  ['the suggestion fills every open set and writes nothing', async (kit) => {
    const s = await openRun(kit, [{ reps: 10, weight: 40 }, { reps: 10, weight: 40 }, { reps: 10, weight: 40 }]);
    try {
      await type(kit, 0, 'reps', '10'); await type(kit, 0, 'weight', '40');
      await tick(kit, 0);                                                   // set 1 done at last time's figures
      await kit.ev(() => hideToast());
      const sug = kit.page.locator('.view.active .run-suggest');
      assert.equal(await sug.count(), 1, 'setup: a suggestion is offered');
      const want = await sug.evaluate((b) => [b.dataset.sugR, b.dataset.sugW]);
      await sug.click();
      const g = await ghosts(kit);
      assert.deepEqual([g[0][0], g[0][2]], ['10', '40'], 'the done set is left as it is');
      assert.deepEqual(g.slice(1).map((x) => [x[0], x[1], x[2], x[3]]), [['', want[0], '', want[1]], ['', want[0], '', want[1]]], 'BOTH open sets hint the suggestion, not only the first');
      assert.deepEqual(await stored(kit, s), [[10, 40, true]], 'the tap wrote nothing');
      const tt = await toastNow(kit);
      assert.equal(tt && tt.msg, await kit.ev(() => t('sug_applied_all')), 'the toast says it went into the open sets');
      await kit.ev(() => hideToast());
      await tick(kit, 2);
      assert.equal((await toastNow(kit) || {}).msg, await kit.ev(() => t('run_sug_updated')), 'a ✓ on a later set names the suggestion');
    } finally { await cleanup(kit, s); }
  }],
  ['Home: the strip says what period each figure counts', async (kit) => {
    const got = await kit.ev(() => {
      const today = todayISO();
      const ex = DB.exercises.list()[0];
      DB.sessions.add({ exerciseId: ex.id, date: today, sets: [{ reps: 5, weight: 50 }] });
      DB.cardio.add({ type: 'walking', date: today, duration: 20, calories: 0 });
      window.__qaHome = { ex: ex.id, today };
      navStack = [{ view: 'home', context: {} }];
      navigate('home', {}, { fromPop: true });
      const labels = [...document.querySelectorAll('.view.active .stat-strip .stat-cell-label')].map((l) => l.textContent.trim());
      return { labels, want: [t('home_stat_days'), t('home_stat_cardio'), t('sleep_today')], old: DB.prefs.get().lang === 'ar' ? 'الجلسات' : 'Sessions', lang: DB.prefs.get().lang };
    });
    try {
      assert.deepEqual(got.labels, got.want, 'the three cells read the new period labels');
      assert.notEqual(got.want[0], got.old, 'the first cell no longer reads the bare «sessions»');
      const week = got.lang === 'ar' ? /الأسبوع/ : /week/i;
      assert.ok(week.test(got.want[0]) && week.test(got.want[1]), 'both weekly cells name the week: ' + got.want.slice(0, 2).join(' | '));
    } finally {
      await kit.ev(() => { const q = window.__qaHome; DB.sessions.listByExercise(q.ex).filter((s) => s.date === q.today).forEach((s) => DB.sessions.remove(s.id)); DB.cardio.list().forEach((c) => DB.cardio.remove(c.id)); navigate('home'); });
    }
  }],
  ['Home: every label fits its cell at 375 and 340 px, normal and larger text', async (kit) => {
    await kit.ev(() => {
      const today = todayISO();
      const ex = DB.exercises.list()[0];
      DB.sessions.add({ exerciseId: ex.id, date: today, sets: [{ reps: 5, weight: 50 }] });
      DB.cardio.add({ type: 'walking', date: today, duration: 125, calories: 0 });
      window.__qaHome = { ex: ex.id, today };
    });
    const bad = [];
    try {
      for (const width of [375, 340]) {
        for (const lg of [false, true]) {
          await kit.page.setViewportSize({ width, height: 812 });
          await kit.ev((lg) => { DB.prefs.setTextLg(lg); document.body.classList.toggle('text-lg', lg); navStack = [{ view: 'home', context: {} }]; navigate('home', {}, { fromPop: true }); }, lg);
          await kit.settled();
          const m = await kit.ev(() => [...document.querySelectorAll('.view.active .stat-strip .stat-cell')].map((c) => {
            const l = c.querySelector('.stat-cell-label'); const lr = l.getBoundingClientRect(); const cr = c.getBoundingClientRect();
            const lh = parseFloat(getComputedStyle(l).lineHeight) || parseFloat(getComputedStyle(l).fontSize) * 1.4;
            return { text: l.textContent.trim(), clipped: l.scrollWidth > l.clientWidth + 1, inside: lr.left >= cr.left - 0.5 && lr.right <= cr.right + 0.5 && lr.bottom <= cr.bottom + 0.5,
              lines: Math.round(lr.height / lh), h: Math.round(cr.height), doc: document.documentElement.scrollWidth <= window.innerWidth };
          }));
          const where = `${width}px${lg ? ' text-lg' : ''}`;
          for (const c of m) {
            if (c.clipped) bad.push(`${where}: «${c.text}» is cut (ellipsis)`);
            if (!c.inside) bad.push(`${where}: «${c.text}» runs out of its cell`);
            if (c.lines > (kit.lang === 'ar' ? 2 : 3)) bad.push(`${where}: «${c.text}» takes ${c.lines} lines`);
            if (!c.doc) bad.push(`${where}: the page scrolls sideways`);
          }
          if (new Set(m.map((c) => c.h)).size !== 1) bad.push(`${where}: the three cells differ in height ${m.map((c) => c.h).join('/')}`);
        }
      }
      assert.deepEqual(bad, [], 'every label fits');
    } finally {
      await kit.page.setViewportSize({ width: 375, height: 812 });
      await kit.ev(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); const q = window.__qaHome; DB.sessions.listByExercise(q.ex).filter((s) => s.date === q.today).forEach((s) => DB.sessions.remove(s.id)); DB.cardio.list().forEach((c) => DB.cardio.remove(c.id)); navigate('home'); });
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
        try { await fn(kit); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  run + home UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  run + home UI (${passed} cases, AR/dark + EN/light, 375px): a new figure ticked on one set becomes the hint of the later untouched straight sets (weight and reps each on its own, in pounds too), a pyramid keeps its hints, a typed un-ticked figure and a row with its own numbers are left alone, a correction carries again, nothing is written before a set's own ✓ and that ✓ names where its numbers came from per field (an earlier set only when both did, a mix as a mix) with Undo; the suggestion fills every open set and writes nothing; Home's strip names its periods with new keys and every label fits its cell at 375/340 px, normal and larger text`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
