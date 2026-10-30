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
// (c) v427 — THE QUICK-ADJUST BAR AND THE PLATE CALCULATOR. A set input taking
//     focus brings ONE bar directly under its row: «−1» «+1» for reps, the
//     five unit steps and «الأقراص» for weight; a tap adds to the figure or to
//     the GHOST when the field is empty, keeps the focus and commits nothing
//     (the ✓ is the writer); the bar follows the focus and leaves on a blur to
//     elsewhere; pounds get the pound steps. «الأقراص» opens the sheet on the
//     field's weight: 65 reads «20 + 2.5» a side, 61 the nearest 60 (1 short),
//     15 is lighter than the bar, nothing is the bar only, the 15 kg bar can be
//     chosen, and «استخدم هذا الوزن» writes the LOADED weight back and commits
//     nothing. Both fit 375 and 320 px with larger text: no sideways scroll,
//     every button at least 44 px effective.
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
// The v427 cases were each seen failing on an in-memory plant of js/app.js or
// styles.css (the file on disk never written): the reps bar given the weight
// steps, the plate button dropped, the ghost ignored, the pointerdown guard
// removed (the focus left), a commit added to the bar's writer, the clamp
// dropped, the bar left in place, the leave timer's remove dropped, the pound
// steps replaced by the kg ones, the nearest line dropped, the typed target
// written instead of the loaded weight, the greedy walk reversed, flex-wrap
// set to nowrap, the 44 px halo removed.
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

// ── the quick-adjust kit (v427) ──────────────────────────────────────────────
const focusField = (kit, i, f) => kit.page.locator(row(i) + ` [data-field="${f}"]`).focus();
const fieldNow = (kit, i, f) => kit.ev(({ i, f }) => {
  const x = document.querySelector(`.view.active .run-set-row[data-set="${i}"] [data-field="${f}"]`);
  return { value: x.value, focused: document.activeElement === x };
}, { i, f });
// The bar as it stands: under which row, its buttons' faces, the plate button.
const barNow = (kit) => kit.ev(() => {
  const bars = document.querySelectorAll('.view.active .run-adjust');
  if (!bars.length) return null;
  const bar = bars[0], prev = bar.previousElementSibling;
  return { n: bars.length, row: prev && prev.matches('.run-set-row') ? Number(prev.dataset.set) : null,
    labels: [...bar.querySelectorAll('button')].map((b) => b.textContent.trim()), plates: !!bar.querySelector('[data-plates]') };
});
const tapAdj = (kit, d) => kit.page.locator(`.view.active .run-adjust [data-adj="${d}"]`).click();
// A dictionary line with its figures filled, in the page's language.
const say = (kit, key, vars) => kit.ev(({ key, vars }) => Object.entries(vars || {}).reduce((x, [k, v]) => x.replace('{' + k + '}', () => v), t(key)), { key, vars });
const sheetNow = (kit) => kit.ev(() => {
  const o = document.querySelector('#modal-root .modal-overlay:not(.is-out)');
  if (!o) return null;
  const q = (sel) => o.querySelector(sel);
  const chosen = q('[data-plate-bar][aria-checked="true"]');
  return { title: q('.modal-title').textContent.trim(), target: q('[data-plate-target]').value, bar: chosen ? chosen.dataset.plateBar : null,
    line: q('.plate-line').textContent.trim(), nearest: q('.plate-nearest') ? q('.plate-nearest').textContent.trim() : '', total: q('.plate-total').textContent.trim(),
    plates: [...o.querySelectorAll('.plate')].map((p) => p.textContent.trim()), heights: [...o.querySelectorAll('.plate')].map((p) => Math.round(p.getBoundingClientRect().height)) };
});
const plateTarget = (kit, v) => kit.page.locator('#modal-root [data-plate-target]').fill(String(v));

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
  ['quick-adjust: the bar sits under the focused row — «−1» «+1» for reps, the five unit steps and «الأقراص» for weight', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      assert.equal(await barNow(kit), null, 'setup: no bar before a field has focus');
      await focusField(kit, 1, 'reps');
      let b = await barNow(kit);
      assert.ok(b, 'a focused reps input brings the bar');
      assert.equal(b.row, 1, 'under THAT row');
      assert.deepEqual(b.labels, ['−1', '+1'], 'reps: −1 and +1 only');
      await focusField(kit, 1, 'weight');
      b = await barNow(kit);
      assert.deepEqual(b.labels, ['−2.5', '−1', '+1', '+2.5', '+5', await say(kit, 'plates')], 'weight: the five kg steps and «الأقراص»');
      assert.equal(b.plates, true, 'the plate button');
      assert.equal(b.row, 1, 'still under row 2');
      assert.equal(b.n, 1, 'ONE bar');
    } finally { await cleanup(kit, s); }
  }],
  ['quick-adjust: a tap reads the ghost on an empty field, keeps the focus and commits nothing; the ✓ then logs it; «−1» at 0 stays 0', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      await focusField(kit, 0, 'weight');
      await tapAdj(kit, 2.5);
      const f = await fieldNow(kit, 0, 'weight');
      assert.equal(f.value, '62.5', '«+2.5» on an empty field is the ghost 60 + 2.5');
      assert.equal(f.focused, true, 'the input keeps its focus (the keyboard stays)');
      assert.ok(await barNow(kit), 'and the bar stays');
      await kit.page.waitForTimeout(250);
      assert.deepEqual(await stored(kit, s), [], 'the bar committed nothing — no row in the database');
      await tick(kit, 0);
      assert.deepEqual(await stored(kit, s), [[8, 62.5, true]], 'the ✓ is the writer: 62.5, with the reps from the ghost');
      await kit.ev(() => hideToast());
      await type(kit, 1, 'weight', '0');
      await tapAdj(kit, -1);
      assert.equal((await fieldNow(kit, 1, 'weight')).value, '0', '«−1» at 0 stays 0');
      await focusField(kit, 1, 'reps');
      await tapAdj(kit, 1);
      assert.equal((await fieldNow(kit, 1, 'reps')).value, '9', '«+1» on empty reps is the ghost 8 + 1');
    } finally { await cleanup(kit, s); }
  }],
  ['quick-adjust: the bar follows the focus to the next row and leaves on a blur to elsewhere', async (kit) => {
    const s = await openRun(kit, straight);
    try {
      await focusField(kit, 0, 'weight');
      assert.equal((await barNow(kit)).row, 0, 'setup: under row 1');
      await focusField(kit, 2, 'reps');
      await kit.page.waitForTimeout(200);
      const b = await barNow(kit);
      assert.ok(b && b.row === 2, 'the bar moved under row 3');
      assert.deepEqual(b.labels, ['−1', '+1'], 'and shows the reps steps now');
      assert.equal(b.n, 1, 'ONE bar, moved — not a second one');
      await kit.ev(() => document.activeElement.blur());
      await kit.page.waitForTimeout(250);
      assert.equal(await barNow(kit), null, 'focus elsewhere: the bar is gone');
    } finally { await cleanup(kit, s); }
  }],
  ['quick-adjust: a pound user gets the pound steps', async (kit) => {
    await kit.ev(() => DB.prefs.setUnit('lb'));
    const s = await openRun(kit, [{ reps: 5, weight: 61.23 }]);   // 135 lb
    try {
      await focusField(kit, 0, 'weight');
      const b = await barNow(kit);
      assert.deepEqual(b.labels.slice(0, 5), ['−5', '−2.5', '+2.5', '+5', '+10'], 'lb: the pound steps');
      await tapAdj(kit, 5);
      assert.equal((await fieldNow(kit, 0, 'weight')).value, '140', 'the ghost 135 lb + 5');
      await kit.ev(() => hideToast());
      await tick(kit, 0);
      const st = await stored(kit, s);
      assert.equal(st.length, 1);
      assert.equal(st[0][1], await kit.ev(() => toStoredKg(140, 'lb')), 'stored in kilograms through the one rule');
    } finally { await cleanup(kit, s); await kit.ev(() => DB.prefs.setUnit('kg')); }
  }],
  ['plates: «الأقراص» opens the sheet on the field\'s weight, 65 reads «20 + 2.5», 61 the nearest 60, «استخدم هذا الوزن» writes 60 and commits nothing', async (kit) => {
    const s = await openRun(kit, [{ reps: 8, weight: 65 }, { reps: 8, weight: 65 }]);
    try {
      await focusField(kit, 0, 'weight');
      await kit.page.locator('.view.active .run-adjust [data-plates]').click();
      await kit.page.waitForSelector('#modal-root .modal-overlay');
      const u = await say(kit, 'unit_kg');
      let sh = await sheetNow(kit);
      assert.equal(sh.title, await say(kit, 'plates'), 'titled «الأقراص»');
      assert.equal(sh.target, '65', 'opened on the field\'s weight — the ghost, the field being empty');
      assert.equal(sh.bar, '20', 'the 20 kg bar by default');
      assert.equal(sh.line, await say(kit, 'plates_per_side', { list: '20 + 2.5' }), '65 kg: a 20 and a 2.5 a side');
      assert.deepEqual(sh.plates, ['20', '2.5'], 'drawn as two plates');
      assert.ok(sh.heights[0] > sh.heights[1], 'the 20 taller than the 2.5: ' + sh.heights.join('/'));
      assert.equal(sh.nearest, '', 'exact: no nearest line');
      assert.equal(sh.total, await say(kit, 'plates_total', { w: '65', u }), 'the total under it');
      await plateTarget(kit, 61);
      sh = await sheetNow(kit);
      assert.equal(sh.line, await say(kit, 'plates_per_side', { list: '20' }), '61: a 20 a side…');
      assert.equal(sh.nearest, await say(kit, 'plates_nearest', { w: '60', u, d: '1' }), '…and the nearest line: 60, 1 short');
      assert.equal(sh.total, await say(kit, 'plates_total', { w: '60', u }), 'the total is the loadable 60');
      await plateTarget(kit, 15);
      sh = await sheetNow(kit);
      assert.equal(sh.line, await say(kit, 'plates_under_bar'), '15 kg: lighter than the bar');
      assert.deepEqual(sh.plates, [], 'and no plate drawn');
      await plateTarget(kit, '');
      assert.equal((await sheetNow(kit)).line, await say(kit, 'plates_bar_only'), 'nothing: the bar only');
      await plateTarget(kit, 65);
      await kit.page.locator('#modal-root [data-plate-bar="15"]').click();
      sh = await sheetNow(kit);
      assert.equal(sh.bar, '15', 'the 15 kg bar chosen (aria-checked moved with the class)');
      assert.equal(sh.line, await say(kit, 'plates_per_side', { list: '25' }), '65 over a 15 bar: a 25 a side');
      await kit.page.locator('#modal-root [data-plate-bar="20"]').click();
      await plateTarget(kit, 61);
      await kit.page.locator('#modal-root [data-plate-use]').click();
      await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'), null, { timeout: 2000 });
      const f = await fieldNow(kit, 0, 'weight');
      assert.equal(f.value, '60', '«استخدم هذا الوزن» wrote the loadable 60, not the 61 typed');
      assert.equal(f.focused, true, 'and the field has its focus back');
      assert.ok(await barNow(kit), 'with the bar under it');
      assert.deepEqual(await stored(kit, s), [], 'nothing committed by the sheet');
      await tick(kit, 0);
      assert.deepEqual(await stored(kit, s), [[8, 60, true]], 'the ✓ logs 60');
    } finally { await cleanup(kit, s); }
  }],
  ['quick-adjust + plates: the bar and the sheet fit 375 and 320 px with larger text — no sideways scroll, every button at least 44 px effective', async (kit) => {
    const s = await openRun(kit, straight);
    const bad = [];
    try {
      for (const width of [375, 320]) {
        for (const lg of [false, true]) {
          await kit.page.setViewportSize({ width, height: 812 });
          await kit.ev((lg) => { DB.prefs.setTextLg(lg); document.body.classList.toggle('text-lg', lg); }, lg);
          await focusField(kit, 0, 'weight');
          const where = `${width}px${lg ? ' text-lg' : ''}`;
          // A control's effective height: its padding box plus the ::after halo the
          // button scale gives a sub-44 control (inset from the padding box).
          const m = await kit.ev(() => {
            const bar = document.querySelector('.view.active .run-adjust');
            bar.scrollIntoView({ block: 'center' });
            const br = bar.getBoundingClientRect();
            const hit = (x, y, b) => { const e = document.elementFromPoint(x, y); return !!(e && (e === b || b.contains(e))); };
            const eff = (b) => { const ps = getComputedStyle(b, '::after'); const halo = ps.content !== 'none' && ps.position === 'absolute' ? -(parseFloat(ps.top) || 0) - (parseFloat(ps.bottom) || 0) : 0; return b.clientHeight + halo; };
            return {
              doc: document.documentElement.scrollWidth <= window.innerWidth,
              barFits: bar.scrollWidth <= bar.clientWidth + 1 && br.right <= window.innerWidth,
              buttons: [...bar.querySelectorAll('button')].map((b) => {
                const r = b.getBoundingClientRect(), cx = r.left + r.width / 2;
                return { text: b.textContent.trim(), w: Math.round(r.width), h: eff(b), inside: r.left >= br.left - 0.5 && r.right <= br.right + 0.5,
                  cut: b.scrollWidth > b.clientWidth + 1, reach: hit(cx, r.top - 3, b) && hit(cx, r.bottom + 3, b) };
              }),
            };
          });
          if (!m.doc) bad.push(`${where}: the page scrolls sideways`);
          if (!m.barFits) bad.push(`${where}: the bar overflows`);
          for (const b of m.buttons) {
            if (!b.inside) bad.push(`${where}: «${b.text}» runs out of the bar`);
            if (b.cut) bad.push(`${where}: «${b.text}» is cut`);
            if (b.w < 44 || b.h < 44 || !b.reach) bad.push(`${where}: «${b.text}» is under 44 px effective (${b.w}×${b.h}, halo reachable: ${b.reach})`);
          }
          // the sheet, on a weight that takes five plates a side
          await kit.ev(() => openPlateCalc(200, 'kg'));
          await kit.page.waitForSelector('#modal-root .modal-overlay');
          const sm = await kit.ev(() => {
            const o = document.querySelector('#modal-root .modal-overlay:not(.is-out)'), md = o.querySelector('.modal'), mr = md.getBoundingClientRect();
            const eff = (b) => { const ps = getComputedStyle(b, '::after'); const halo = ps.content !== 'none' && ps.position === 'absolute' ? -(parseFloat(ps.top) || 0) - (parseFloat(ps.bottom) || 0) : 0; return b.clientHeight + halo; };
            return {
              fits: md.scrollWidth <= md.clientWidth + 1,
              plates: [...o.querySelectorAll('.plate')].map((p) => { const r = p.getBoundingClientRect(); return { text: p.textContent.trim(), inside: r.left >= mr.left - 0.5 && r.right <= mr.right + 0.5, cut: p.scrollWidth > p.clientWidth + 1 }; }),
              buttons: [...o.querySelectorAll('[data-plate-bar], [data-plate-use]')].map((b) => { const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), w: Math.round(r.width), h: eff(b), inside: r.left >= mr.left - 0.5 && r.right <= mr.right + 0.5, cut: b.scrollWidth > b.clientWidth + 1 }; }),
            };
          });
          if (!sm.fits) bad.push(`${where}: the sheet scrolls sideways`);
          if (sm.plates.length !== 4) bad.push(`${where}: 200 kg draws ${sm.plates.length} plates a side, not four`);
          for (const p of sm.plates) { if (!p.inside) bad.push(`${where}: plate «${p.text}» runs out of the sheet`); if (p.cut) bad.push(`${where}: plate «${p.text}» is cut`); }
          for (const b of sm.buttons) { if (!b.inside) bad.push(`${where}: «${b.text}» runs out of the sheet`); if (b.cut) bad.push(`${where}: «${b.text}» is cut`); if (b.w < 44 || b.h < 44) bad.push(`${where}: «${b.text}» is under 44 px (${b.w}×${b.h})`); }
          await kit.ev(() => closeModal());
          await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'), null, { timeout: 2000 });
        }
      }
      assert.deepEqual(bad, [], 'the bar and the sheet fit');
    } finally {
      await kit.page.setViewportSize({ width: 375, height: 812 });
      await kit.ev(() => { try { closeModal(); } catch (_) {} DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
      await cleanup(kit, s);
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
  console.log(`PASS  run + home UI (${passed} cases, AR/dark + EN/light, 375px): a new figure ticked on one set becomes the hint of the later untouched straight sets (weight and reps each on its own, in pounds too), a pyramid keeps its hints, a typed un-ticked figure and a row with its own numbers are left alone, a correction carries again, nothing is written before a set's own ✓ and that ✓ names where its numbers came from per field (an earlier set only when both did, a mix as a mix) with Undo; the suggestion fills every open set and writes nothing; Home's strip names its periods with new keys and every label fits its cell at 375/340 px, normal and larger text; v427: the quick-adjust bar under the focused row (reps ±1, the five unit steps + «الأقراص», the ghost as the base, focus kept, nothing committed, follows the focus and leaves on blur, pound steps) and the plate sheet (65 → 20 + 2.5, 61 → nearest 60, lighter than the bar, the bar only, the bar choice, «استخدم هذا الوزن» writes the loaded weight), both fitting 375/320 px with larger text at ≥ 44 px a button`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
