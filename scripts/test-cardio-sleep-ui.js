#!/usr/bin/env node
// THE INSTRUMENT — the Cardio and Sleep pages after the 2026-09-27 redesign,
// driven in a real browser: one card per page (a mono figure, a goal control,
// a seven-column track), the redrawn cardio glyphs, the type picker, and the
// two sheets. Every figure is asserted against the rows the case itself
// seeded, never against a screenshot.
//
// Same harness as scripts/fingerprint-net.js (scripts/fp/server.js): the repo
// over loopback on a FREE port, js/cloud.js replaced by an offline stub, and a
// route filter that aborts every request that is not 127.0.0.1. Playwright is
// external (npm i --no-save playwright eslint@9 globals), never a dependency.
//
// Standalone: it runs itself behind the require.main guard and is required by
// no other suite, so scripts/test-all.js runs it as its own line.
//
// Seen failing on v403 before the design existed (scripts/test-all.js's rule:
// a check is trusted only after it has been seen to fail): every case below
// printed its own FAIL line — «the cardio page has no .trk-hero», «no
// .trk-goal-btn», «the sleep page has no .trk-hero», «#cardio-add-type sits
// inside .type-selector» … — and the run exited 1.
//
// THE SLEEP RING (the owner, mid-build: «أريد نفس التغيير الذي حصل بصفحة الأكل
// يحصل هنا من ناحية التصميم»). The Sleep hero took the food log's miniature:
// ONE card, a 144px ring (.cal-ring-bg/.cal-ring-fg, r=54, C=339.29) filled by
// last night against the sleep goal, the duration in its centre with the
// verdict under it as one line, compact rows beside it (the range, the 7-night
// average with its delta, deep and efficiency as two short bars), no 7-night
// track. The ring cases below were seen failing on the built tree before the
// ring existed — «the sleep page has no .slp-mini ring card» in every sleep
// case, AR and EN — and pass only against the ring.
//
// THE TWO LOGS (2026-09-27, the owner on the Sleep page: the sleep log should
// follow the food log's idea — where it lives, in the day, and in the details
// of that day's sleep; then on the Cardio page: the same for cardio). The day
// ledger left both pages for a dated screen each (sleeplog, cardiolog). The
// five log cases at the end, and the ledger cases rewritten for the new
// design, were seen failing on the tree before the logs existed, AR and EN:
// «no ledger rows on the Sleep page — 15 !== 0», «no ledger rows on the
// Cardio page — 16 !== 0», «['home', undefined] !== ['sleeplog', <today>]»
// (navigate('sleeplog') fell back to Home), «the log link stays in the
// header», «ONE night: the range alone …», «locator.click: Timeout» on the
// log rows — 24 of 44 cases, exit 1.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const SHOT_DIR = process.env.QA_SCREENSHOT_DIR || '';
const ONLY = process.env.QA_ONLY || '';
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);

// ── the page kit ────────────────────────────────────────────────────────────
async function openPage(browser, origin, { lang, theme, reduced = false }) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
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
    DB.nutrition.setTargets({ calories: 2000, protein: 120, carbs: 220, fat: 60 });
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
  // The stagger's own cleanup window (motion.js: steps × step + --dur-base + 120ms)
  // is under 1.2 s on every view; after it every rule scoped to `.enter` is gone.
  const settled = () => page.waitForFunction(() => !document.querySelector('.view.active.enter, .view.active .enter'), null, { timeout: 3000 });
  return { ctx, page, ev, reset, settled, errors, guard, lang, theme };
}

// ── the seeds — deterministic, written through DB.* ─────────────────────────
// Cardio: two sessions today (35 walking + 20 walking → one well with two
// stacked segments) and one running session on the newest earlier day that is
// still inside the app's week (Sun→Sat). Returns what the hero must show.
function seedCardio() {
  DB.cardio.list().forEach((c) => DB.cardio.remove(c.id));
  DB.cardioTypes.allTypes().filter((t) => t.isCustom).forEach((t) => DB.cardioTypes.remove(t.id));
  if (typeof DB.prefs.setCardioGoal === 'function') DB.prefs.setCardioGoal(150);   // v403 has no goal yet: the seed still runs, the hero assertions name what is missing
  const today = todayISO();
  const weekStart = isoOf(startOfWeek(new Date()));
  const prev = addDaysISO(today, -1) >= weekStart ? addDaysISO(today, -1) : null;
  const rows = [
    { type: 'walking', date: today, duration: 35, calories: 180 },
    { type: 'walking', date: today, duration: 20, calories: 0 },
  ];
  if (prev) rows.push({ type: 'running', date: prev, duration: 50, calories: 400 });
  // Oldest first so the LAST written is a walk — the sheet must open on it.
  rows.slice().reverse().forEach((r) => DB.cardio.add(r));
  const weekMin = rows.reduce((s, r) => s + r.duration, 0);
  const weekCal = rows.reduce((s, r) => s + r.calories, 0);
  const pace = Math.ceil(150 / 7);
  const byDay = {}; rows.forEach((r) => { byDay[r.date] = (byDay[r.date] || 0) + r.duration; });
  const biggest = Math.max(...Object.values(byDay));
  const scale = Math.min(Math.max(2 * pace, biggest), 4 * pace);   // capped: one long session must not flatten the week
  return { today, prev, weekMin, weekCal, sessions: rows.length, pace, scale, todayDow: new Date(today + 'T12:00:00').getDay(), todayMin: 55, prevMin: prev ? 50 : 0 };
}
// Sleep: last night from the watch WITH stages, the night before by hand at
// exactly the goal, a gap, then a short night — so the track shows a hit, a
// miss, an empty well and a stage bar on the hero.
function seedSleep() {
  DB.sleep.list().forEach((s) => DB.sleep.remove(s.id));
  if (typeof DB.prefs.setSleepGoal === 'function') DB.prefs.setSleepGoal(480);
  const today = todayISO(), d1 = addDaysISO(today, -1), d3 = addDaysISO(today, -3);
  DB.sleep.add({ date: d3, sleepTime: '00:30', wakeTime: '06:00' });        // 5:30
  DB.sleep.add({ date: d1, sleepTime: '23:00', wakeTime: '07:00' });        // 8:00 — the goal exactly
  // A removed watch night is REFUSED on re-import by its start key (the app's
  // own dedupe), so each seed carries a fresh second in the key; the minute is
  // what the sheet shows.
  window.__qaSeed = (window.__qaSeed || 0) + 1;
  DB.sleep.importFromHealth([{ start: d1 + 'T23:30:' + String(window.__qaSeed % 60).padStart(2, '0'), end: today + 'T06:45:00', stages: { deep: 90, rem: 80, light: 240, awake: 25 } }]);   // 7:15
  return { today, d1, d3, latest: 435, avg: Math.round((480 + 330) / 2), deep: 90, todayDow: new Date(today + 'T12:00:00').getDay() };
}

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  ['the cardio hero renders the week from the seeded rows, figures exact', async ({ ev, reset, settled }) => {
    const s = await ev(seedCardio);
    await reset('cardio'); await settled();
    const got = await ev(() => {
      const h = document.querySelector('.view.active .trk-hero');
      if (!h) throw new Error('the cardio page has no .trk-hero');
      const bars = [...h.querySelectorAll('.trk-col')].map((c) => ({ n: c.querySelectorAll('.trk-bar').length, hit: !!c.querySelector('.trk-bar.is-hit'), v: [...c.querySelectorAll('.trk-bar')].map((b) => b.style.getPropertyValue('--v').trim()) }));
      return {
        fig: h.querySelector('.trk-num')?.textContent.trim(), unit: h.querySelector('.trk-unit')?.textContent.trim(),
        ro: [...h.querySelectorAll('.trk-ro-val')].map((x) => x.textContent.trim()),
        roLabelFirst: [...h.querySelectorAll('.trk-ro')].every((r) => r.firstElementChild && r.firstElementChild.classList.contains('trk-ro-lab')),
        wellBg: getComputedStyle(h.querySelector('.trk-col')).backgroundColor, cardBg: getComputedStyle(h).backgroundColor,
        idleBar: (() => { const b = h.querySelector('.trk-bar:not(.is-hit)'); return b ? getComputedStyle(b).backgroundColor : null; })(),
        futureDays: [...h.querySelectorAll('.trk-day.is-future')].map((d) => getComputedStyle(d).opacity),
        futureWells: [...h.querySelectorAll('.trk-col.is-future')].map((d) => getComputedStyle(d).opacity),
        pastDays: h.querySelectorAll('.trk-day:not(.is-future)').length,
        delta: h.querySelector('.trk-delta')?.textContent.trim(),
        eyebrow: !!document.querySelector('.view.active .page-eyebrow'), stat: !!document.querySelector('.view.active .stat-row'),
        cols: bars, goalBottom: h.querySelector('.trk-goal')?.style.bottom, days: [...h.querySelectorAll('.trk-days > *')].map((d) => d.textContent.trim()),
        aria: h.querySelector('.trk-bars')?.getAttribute('aria-label') || '', role: h.querySelector('.trk-bars')?.getAttribute('role'),
        unitMin: t('unit_min'), none: t('trk_none'), sep: t('list_sep'), spoken: typeof spokenMinutes === 'function' ? spokenMinutes(55) : '(no spokenMinutes)', left: t('goal_left').replace('{n}', fmtNum(150 - 55 - (DB.cardio.list().length > 2 ? 50 : 0))),
      };
    });
    assert.equal(got.fig, String(s.weekMin), 'the figure is the week\'s minutes');
    assert.equal(got.unit, got.unitMin);
    assert.deepEqual(got.ro, [String(s.sessions), String(s.weekCal)], 'sessions and calories are the two readouts');
    assert.equal(got.roLabelFirst, true, 'each readout is a labelled figure, the label first — «4 الجلسات» put the article after a numeral');
    assert.notEqual(got.wellBg, got.cardBg, 'an empty well is visible against the card (dark drew both in --surface-2)');
    if (got.idleBar) assert.notEqual(got.idleBar, got.wellBg, 'a bar under the pace line is visible inside its well');
    assert.ok(got.futureWells.every((o) => Number(o) < 1), 'a day still to come has its well dimmed, not drawn as a day with nothing logged');
    assert.ok(got.futureDays.every((o) => o === '1'), 'its label stays --text-dim at full strength — at 0.5 over the card it measured 2.4:1: ' + got.futureDays);
    assert.equal(got.delta, got.left, 'the delta is the minutes left to the goal');
    assert.equal(got.eyebrow, false, 'the eyebrow «this week» is gone'); assert.equal(got.stat, false, 'the three stat boxes are gone');
    assert.equal(got.cols.length, 7, 'seven wells');
    assert.equal(got.cols[s.todayDow].n, 2, 'two sessions today → two stacked segments in one well');
    assert.equal(got.cols[s.todayDow].hit, true, '55 minutes reaches the 22-minute pace');
    assert.deepEqual(got.cols[s.todayDow].v.slice().sort(), [35, 20].map((m) => Math.round(m / s.scale * 1000) / 10 + '%').sort(), 'each segment is its session ÷ scale');
    if (s.prev) { const pd = new Date(s.prev + 'T12:00:00').getDay(); assert.equal(got.cols[pd].n, 1); assert.equal(got.cols[pd].hit, true); }
    const emptyDays = got.cols.filter((c) => c.n === 0).length;
    assert.equal(emptyDays, 7 - (s.prev ? 2 : 1), 'a day with nothing draws the well only');
    assert.equal(got.goalBottom, Math.round(s.pace / s.scale * 1000) / 10 + '%', 'the goal line sits at pace ÷ scale');
    assert.equal(got.days.length, 7);
    assert.equal(got.role, 'img'); assert.ok(got.aria.includes(got.spoken), `the track names today's minutes as a spoken word («${got.spoken}»), not the one-letter unit: ${got.aria}`);
    assert.equal(got.aria.split(': ')[1].split(got.sep).length, got.pastDays, 'the track reads only the days that have happened — a future day is not «nothing»');
  }],

  ['the goal control edits the weekly goal and the track closes on it', async ({ page, ev, reset, settled }) => {
    await ev(seedCardio);
    await reset('cardio'); await settled();
    const btn = page.locator('.view.active .trk-goal-btn');
    assert.ok(await btn.count(), 'no .trk-goal-btn');
    assert.ok((await btn.getAttribute('aria-label') || '').length > 0, 'the goal button is named');
    const halo = await ev(() => { const b = document.querySelector('.view.active .trk-goal-btn'); const a = getComputedStyle(b, '::after'); return { content: a.content, h: parseFloat(a.height), box: b.getBoundingClientRect().height }; });
    assert.ok(halo.content !== 'none' && halo.h >= 44, 'the 36px goal button carries a 44px halo: ' + JSON.stringify(halo));
    await btn.click();
    await page.waitForSelector('#modal-root .modal-overlay #goal-input');
    assert.equal(await page.locator('#modal-root .modal-title').innerText(), await ev(() => t('cardio_goal')));
    assert.equal(await page.locator('#goal-input').inputValue(), '150');
    assert.equal((await page.locator('label[for="goal-input"]').textContent()).trim(), await ev(() => t('goal_min_week')), 'the field names a weekly target, not a session\'s duration');
    await page.locator('#goal-input').fill('10');
    await page.locator('#goal-save').click();
    await page.waitForTimeout(120);
    const refused = await ev(() => ({ open: !!document.querySelector('#modal-root .modal-overlay:not(.is-out) #goal-input'), goal: DB.prefs.cardioGoal(), focus: document.activeElement && document.activeElement.id, toast: (document.querySelector('#toast, .toast')?.textContent || '') }));
    assert.equal(refused.open, true, 'a goal under the floor keeps the sheet open'); assert.equal(refused.goal, 150, 'and changes nothing');
    assert.equal(refused.focus, 'goal-input', 'focus returns to the field'); assert.ok(/30/.test(refused.toast) && /1,?200/.test(refused.toast), 'the toast names the bounds: ' + refused.toast);
    await page.locator('#goal-input').fill('50');
    await page.locator('#goal-save').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    assert.equal(await ev(() => document.activeElement && document.activeElement.id), 'cardio-goal-btn', 'focus comes back to the goal button the repaint rebuilt');
    const got = await ev(() => ({ goal: DB.prefs.cardioGoal(), delta: document.querySelector('.view.active .trk-delta')?.textContent.trim(), met: t('goal_met'), isMet: !!document.querySelector('.view.active .trk-bars.is-met'), btn: document.querySelector('.view.active .trk-goal-btn')?.textContent.replace(/\s+/g, ' ').trim() }));
    assert.equal(got.goal, 50);
    assert.equal(got.delta, got.met, 'the delta says the goal is met');
    assert.equal(got.isMet, true, '.trk-bars.is-met lifts the goal line');
    assert.ok(got.btn.includes('50'), 'the button shows the new goal');
    await ev(() => DB.prefs.setCardioGoal(150));
  }],

  ['a log row still opens its sheet (focus stays put), and a new log opens on the last-used type with focus in the minutes', async ({ page, ev, reset, settled }) => {
    const seeded = await ev(seedCardio);
    await reset('cardiolog', { date: seeded.today }); await settled();
    await page.locator('.view.active [data-edit-cardio]').first().click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-duration');
    assert.ok(['35', '20', '50'].includes(await page.locator('#cardio-duration').inputValue()));
    await page.waitForTimeout(120);
    assert.notEqual(await ev(() => document.activeElement && document.activeElement.id), 'cardio-duration', 'opening a session to read or delete it does not raise the keyboard');
    await ev(() => closeModal());
    await reset('cardio'); await settled();
    await page.locator('.view.active #add-cardio-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-type-selector');
    await page.waitForTimeout(120);
    const got = await ev(() => ({
      checked: [...document.querySelectorAll('#cardio-type-selector .type-option[aria-checked="true"]')].map((b) => b.dataset.type),
      active: [...document.querySelectorAll('#cardio-type-selector .type-option.active')].map((b) => b.dataset.type),
      last: DB.cardio.list()[0].type, focus: document.activeElement && document.activeElement.id,
      addInside: !!document.querySelector('#cardio-type-selector #cardio-add-type'),
      addName: (() => { const b = document.querySelector('#cardio-add-type'); return { aria: b.getAttribute('aria-label'), text: b.textContent.replace(/\s+/g, ' ').trim() }; })(),
      logGlyph: !!document.querySelector('.view.active #add-cardio-btn svg'),
    }));
    assert.deepEqual(got.checked, [got.last], 'the sheet opens on the last-used type'); assert.deepEqual(got.active, [got.last]);
    assert.equal(got.focus, 'cardio-duration', 'the minutes field takes focus');
    assert.equal(got.addInside, false, '#cardio-add-type sits inside .type-selector');
    assert.ok(got.addName.text && (got.addName.aria === null || got.addName.aria.startsWith(got.addName.text)), 'the add control\'s name contains its visible label (WCAG 2.5.3): ' + JSON.stringify(got.addName));
    assert.equal(got.logGlyph, true, 'the «log» button carries the last-used type\'s glyph');
  }],

  ['the type tiles select with aria-checked, keep their node, and carry the redrawn duotone glyphs', async ({ page, ev, reset, settled }) => {
    await ev(seedCardio);
    await reset('cardio'); await settled();
    await page.locator('.view.active #add-cardio-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-type-selector');
    const before = await ev(() => { const b = document.querySelector('#cardio-type-selector [data-type="cycling"]'); b.__qa = 1; return [...document.querySelectorAll('#cardio-type-selector .type-option')].map((x) => x.dataset.type); });
    assert.deepEqual(before, ['treadmill', 'walking', 'running', 'cycling']);
    await page.locator('#cardio-type-selector [data-type="cycling"]').click();
    await page.waitForTimeout(420);   // the tint spreads over --dur-fast (260ms); read the plate after it lands
    const got = await ev(() => {
      const opts = [...document.querySelectorAll('#cardio-type-selector .type-option')];
      const glyph = (name) => document.querySelector(`#cardio-type-selector [data-type="${name}"] svg`)?.innerHTML || '';
      return {
        checked: opts.filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.type),
        roles: opts.every((b) => b.getAttribute('role') === 'radio'),
        kept: !!document.querySelector('#cardio-type-selector [data-type="cycling"]').__qa,
        glyphs: ['treadmill', 'walking', 'running', 'cycling'].map((n) => ({ n, accent: glyph(n).includes('var(--icon-accent'), base: glyph(n).includes('fill="currentColor"'), stroke: /stroke=/.test(glyph(n)) })),
        icons: [ICONS.walk, ICONS.run, ICONS.bike, ICONS.treadmill].map((s) => ({ accent: s.includes('var(--icon-accent'), base: s.includes('currentColor'), circle: /<circle/.test(s) })),
        well: getComputedStyle(document.querySelector('#cardio-type-selector [data-type="cycling"] .type-option-icon')).backgroundColor,
        accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(),
      };
    });
    assert.deepEqual(got.checked, ['cycling']); assert.equal(got.roles, true);
    assert.equal(got.kept, true, 'selecting a tile toggles the node in place, it does not rebuild the grid');
    for (const g of got.glyphs) { assert.equal(g.accent && g.base && !g.stroke, true, `${g.n}: two filled masses, nothing stroked`); }
    for (const i of got.icons) { assert.equal(i.circle, false, 'the redrawn cardio glyphs carry no circle head'); }
    const hex = (rgb) => '#' + (rgb.match(/\d+/g) || []).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('');
    assert.equal(hex(got.well), got.accent.toLowerCase(), 'the selected well is a solid accent plate');
  }],

  ['every cardio glyph paints inside its 24-unit grid, the four built-ins drawn with no transform', async ({ ev }) => {
    // icon() emits a bare <svg viewBox="0 0 24 24">, and the UA's
    // svg:not(:root){overflow:hidden} cuts anything past the grid — the v410
    // run glyph, tipped through rotate(-22)/scale(0.76), painted to y≈25.1 and
    // lost its heel at every size. Measured with overflow visible, so what
    // would be clipped is counted, not hidden.
    const got = await ev(() => {
      const names = [...new Set([...DB.cardioTypes.allTypes().filter((x) => !x.isCustom).map((x) => x.iconName), ...CARDIO_ICON_OPTIONS])];
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:240px';
      document.body.appendChild(host);
      const out = names.map((n) => {
        host.innerHTML = `<svg viewBox="0 0 24 24" width="240" height="240" style="overflow:visible">${ICONS[n] || ''}</svg>`;
        const b = host.firstElementChild.getBBox();
        return { n, drawn: !!ICONS[n], box: [b.x, b.y, b.x + b.width, b.y + b.height].map((v) => Math.round(v * 100) / 100), transform: /transform=/.test(ICONS[n] || '') };
      });
      host.remove();
      return out;
    });
    assert.ok(got.length >= 4, 'the cardio glyphs are listed');
    for (const g of got) {
      assert.equal(g.drawn, true, `${g.n} is an ICONS glyph`);
      assert.ok(g.box[0] >= 0 && g.box[1] >= 0 && g.box[2] <= 24 && g.box[3] <= 24, `${g.n} paints at [${g.box.join(', ')}] — past 0..24 its own svg clips it`);
    }
    for (const g of got.filter((x) => ['walk', 'run', 'bike', 'treadmill'].includes(x.n))) assert.equal(g.transform, false, `${g.n} is drawn in grid coordinates, not through a transform`);
  }],

  ['the new-type flow still works and lands on the new tile', async ({ page, ev, reset, settled }) => {
    await ev(seedCardio);
    await reset('cardio'); await settled();
    await page.locator('.view.active #add-cardio-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-add-type');
    await page.locator('#cardio-add-type').click();
    await page.waitForSelector('.modal-overlay.nested #cardio-type-name');
    await page.locator('#cardio-type-name').fill('QA rowing');
    await page.locator('[data-cardio-icon="flame"]').click();
    assert.equal(await page.locator('[data-cardio-icon="flame"]').getAttribute('aria-checked'), 'true');
    await page.locator('#cardio-type-save').click();
    await page.waitForFunction(() => !document.querySelector('.modal-overlay.nested'));
    const got = await ev(() => ({ checked: [...document.querySelectorAll('#cardio-type-selector .type-option[aria-checked="true"] .type-option-label')].map((x) => x.textContent.trim()), n: document.querySelectorAll('#cardio-type-selector .type-option').length }));
    assert.deepEqual(got.checked, ['QA rowing']); assert.equal(got.n, 5);
    await page.locator('#cardio-duration').fill('40');
    await page.locator('#save-cardio-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    const fig = await ev(() => document.querySelector('.view.active .trk-num')?.textContent.trim());
    const s = await ev(() => DB.cardio.list().reduce((a, c) => a + (inRangeISO(c.date, weekRanges().thisStart, weekRanges().thisEnd) ? c.duration : 0), 0));
    assert.equal(fig, String(s), 'a save through the sheet re-renders the figure');
    await reset('cardiolog', { date: await ev(() => todayISO()) }); await settled();
    const tiles = await ev(() => { const bg = (el) => el && getComputedStyle(el).backgroundColor; const rows = [...document.querySelectorAll('.view.active .fig-row-tile')]; const custom = rows.find((r) => /cardio-custom|\bcustom\b/.test(r.className)); const walk = rows.find((r) => r.classList.contains('walking')); return { custom: bg(custom), walk: bg(walk) }; });
    assert.ok(tiles.custom && tiles.walk, 'both tiles render: ' + JSON.stringify(tiles));
    assert.equal(tiles.custom, tiles.walk, 'a user-made type sits in the same neutral well as the built-ins — the one tinted tile drew the eye to the generic glyph');
  }],

  ['the newest session is the last one WRITTEN on the newest day, even when two types share it', async ({ page, ev, reset, settled }) => {
    await ev(() => {
      DB.cardio.list().forEach((c) => DB.cardio.remove(c.id));
      const today = todayISO();
      DB.cardio.add({ type: 'cycling', date: today, duration: 40, calories: 300 });
      DB.cardio.add({ type: 'running', date: today, duration: 25, calories: 250 });
    });
    await reset('cardio'); await settled();
    const aria = await ev(() => ({ label: document.querySelector('.view.active #add-cardio-btn').getAttribute('aria-label'), run: t('running') }));
    assert.ok(aria.label.endsWith(aria.run), 'the «log» button names the type written last: ' + aria.label);
    await page.locator('.view.active #add-cardio-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-type-selector');
    const checked = await ev(() => [...document.querySelectorAll('#cardio-type-selector .type-option[aria-checked="true"]')].map((b) => b.dataset.type));
    assert.deepEqual(checked, ['running'], 'the sheet preselects the session written last, not the first of the day');
    await ev(() => closeModal());
  }],

  ['with no session at all, the page says it once: the hero at zero and «log», no header, sentence or older-days door', async ({ ev, reset, settled }) => {
    await ev(() => DB.cardio.list().forEach((c) => DB.cardio.remove(c.id)));
    await reset('cardio'); await settled();
    const got = await ev(() => ({ fig: document.querySelector('.view.active .trk-num')?.textContent.trim(), log: !!document.querySelector('.view.active #add-cardio-btn'),
      title: !!document.querySelector('.view.active .row-between .section-title'), empty: !!document.querySelector('.view.active .empty'), older: !!document.querySelector('.view.active #more-cardio-days'),
      link: !!document.querySelector('.view.active .header-links .link-btn') }));
    assert.equal(got.fig, '0'); assert.equal(got.log, true, '«log» stays'); assert.equal(got.link, true, 'the log link stays in the header');
    assert.equal(got.title, false, 'no «all sessions» header over nothing'); assert.equal(got.empty, false, 'no empty sentence'); assert.equal(got.older, false, 'no older-days door');
  }],

  ['one long session does not flatten the week: the scale stops at four times the pace', async ({ ev, reset, settled }) => {
    await ev(() => {
      DB.cardio.list().forEach((c) => DB.cardio.remove(c.id));
      DB.prefs.setCardioGoal(150);
      DB.cardio.add({ type: 'cycling', date: todayISO(), duration: 120, calories: 900 });
    });
    await reset('cardio'); await settled();
    const got = await ev(() => {
      const h = document.querySelector('.view.active .trk-hero');
      const bars = [...h.querySelectorAll('.trk-bar')];
      return { v: bars.map((b) => b.style.getPropertyValue('--v').trim()), goal: h.querySelector('.trk-goal').style.bottom, fig: h.querySelector('.trk-num').textContent.trim(),
        inside: bars.map((b) => b.getBoundingClientRect().top >= b.parentElement.getBoundingClientRect().top - 0.5).every(Boolean) };
    });
    assert.deepEqual(got.v, ['100%'], 'a 120-minute ride fills its well to the top, and no further');
    assert.equal(got.goal, '25%', 'the pace line sits at a quarter of the well (22 of 88), not at 18%');
    assert.equal(got.inside, true, 'no bar runs out of its well'); assert.equal(got.fig, '120', 'the figure still says the whole of it');
  }],

  ['the sleep hero is ONE ring beside compact rows: last night against the goal, figures exact', async ({ ev, reset, settled }) => {
    const s = await ev(seedSleep);
    await reset('sleep'); await settled();
    const got = await ev(() => {
      const view = document.querySelector('.view.active');
      const h = view.querySelector('.slp-mini');
      if (!h) throw new Error('the sleep page has no .slp-mini ring card');
      const fg = h.querySelector('.slp-ring .cal-ring-fg');
      const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
      const tracks = [...h.querySelectorAll('.slp-rows .macro-track')];
      const bar = (i) => tracks[i] && tracks[i].querySelector('.macro-track-fill');
      const probe = document.createElement('span'); probe.style.color = 'var(--text-mute)'; h.appendChild(probe);
      const mute = getComputedStyle(probe).color; probe.remove();
      return {
        ring: !!h.querySelector('.slp-ring .cal-ring-bg') && !!fg, ringPx: Math.round(h.querySelector('.slp-ring').getBoundingClientRect().width),
        dash: fg ? parseFloat(fg.getAttribute('stroke-dasharray')) : null, empty: fg ? fg.classList.contains('is-empty') : null,
        num: txt(h.querySelector('.cal-ring-num')), verdict: txt(h.querySelector('.slp-verdict')), centreEls: h.querySelectorAll('.cal-ring-center > *').length,
        short: t('sleep_short_by').replace('{v}', formatDuration(45)),
        ranges: h.querySelectorAll('.time-range').length, src: txt(h.querySelector('.slp-src')), watch: t('from_watch'), cardRange: txt(h.querySelector('.slp-rows .time-range')),
        ledger: view.querySelectorAll('.ledger, [data-edit-sleep], [data-ledger-sleep]').length,
        tracks: tracks.map((tr) => ({ name: txt(tr.querySelector('.macro-track-name')), nums: txt(tr.querySelector('.macro-track-nums')), bar: !!tr.querySelector('.macro-track-bar'), left: txt(tr.querySelector('.macro-track-left')) })),
        deepW: bar(1) ? parseFloat(bar(1).style.width) : null, effW: bar(2) ? parseFloat(bar(2).style.width) : null,
        bar: bar(1) ? (({ borderTopLeftRadius: r, height: hh }) => [r, hh])(getComputedStyle(bar(1).parentElement)) : null,
        foodBar: (() => { const w = document.createElement('div'); w.className = 'nutri-mini'; w.innerHTML = '<div class="macro-track"><div class="macro-track-bar"></div></div>'; view.appendChild(w); const c = getComputedStyle(w.querySelector('.macro-track-bar')); const v = [c.borderTopLeftRadius, c.height]; w.remove(); return v; })(),
        avgColor: tracks[0] && tracks[0].querySelector('.macro-track-left') ? getComputedStyle(tracks[0].querySelector('.macro-track-left')).color : null, mute,
        labels: { avg: t('avg_7n'), deep: t('sleep_deep'), eff: t('sleep_efficiency'), up: t('avg_up').replace('{v}', formatDuration(30)) },
        quality: t('sleep_q_excellent'), cap: txt(h.querySelector('.trk-cap')), goalBtn: !!h.querySelector('.trk-cap #sleep-goal-btn'),
        track: view.querySelectorAll('.trk-bars, .trk-col').length, oldHero: !!view.querySelector('.trk-hero'), stageBar: !!h.querySelector('.sl-bar'),
        capsule: !!view.querySelector('.sleep-quality'), stat: !!view.querySelector('.stat-row'), eyebrow: !!view.querySelector('.page-eyebrow'),
        logBtns: view.querySelectorAll('#add-sleep-btn').length, logInCard: !!h.querySelector('#add-sleep-btn'),
      };
    });
    assert.equal(got.ring, true, 'the ring draws with the calorie ring\'s two classes'); assert.equal(got.ringPx, 144, 'the ring is 144px, the food log\'s miniature');
    near(got.dash, 339.29 * Math.min(1, s.latest / 480), 0.5, 'the fill is last night ÷ the goal');
    assert.equal(got.empty, false);
    assert.equal(got.num, '7:15', 'the centre is the duration'); assert.equal(got.verdict, got.short, 'under it, the verdict with the gap');
    assert.equal(got.centreEls, 2, 'two centre lines: the duration and the verdict');
    // The ledger left the page for the sleep log, so the page's card carries
    // the night's bed → wake range itself (one ltr run) and its source.
    assert.equal(got.ledger, 0, 'no ledger rows on the page');
    assert.equal(got.ranges, 1, 'the card reads the bed → wake range once');
    assert.equal(got.cardRange, '11:30 PM → 6:45 AM', 'as one run, the way a row prints it');
    assert.equal(got.src, got.watch, 'with the watch named as the source');
    assert.equal(got.tracks.length, 3, 'three tracks: the average, deep, efficiency');
    assert.deepEqual([got.tracks[0].name, got.tracks[0].nums, got.tracks[0].bar], [got.labels.avg, formatDurationNode(s.avg), false], 'the average of the seven nights BEFORE the ring\'s night, as a figure');
    assert.equal(got.tracks[0].left, got.labels.up, 'with its delta against last night — 7:15 against 6:45, not against an average that already holds 7:15');
    assert.equal(got.avgColor, got.mute, 'the delta is --text-mute, not a second hue');
    assert.deepEqual([got.tracks[1].name, got.tracks[1].nums, got.tracks[1].bar], [got.labels.deep, '1:30', true], 'deep, as a short bar');
    assert.deepEqual([got.tracks[2].name, got.tracks[2].nums, got.tracks[2].bar], [got.labels.eff, '94%', true], 'efficiency, as a short bar');
    near(got.deepW, 90 / (90 + 80 + 240) * 100, 0.2, 'deep fills its share of the sleep'); assert.equal(got.effW, 94);
    assert.deepEqual(got.bar, got.foodBar, 'the bars are the food log miniature\'s own track, one to one');
    assert.ok(got.cap.includes(got.quality), 'the quality word sits in the caption row'); assert.equal(got.goalBtn, true, 'the goal button stays in the caption row');
    assert.equal(got.track, 0, 'no 7-night track on the sleep hero — the ledger lists the nights'); assert.equal(got.oldHero, false); assert.equal(got.stageBar, false);
    assert.equal(got.capsule, false); assert.equal(got.stat, false); assert.equal(got.eyebrow, false);
    assert.equal(got.logBtns, 1); assert.equal(got.logInCard, false, '«سجّل» sits under the card, not in it');
  }],

  ['the verdict reads by case — on target, short by the gap, over by the gap — and no night leaves the ring empty', async ({ ev, reset, settled }) => {
    const night = (sleepTime, wakeTime) => ev(({ sleepTime, wakeTime }) => {
      DB.sleep.list().forEach((x) => DB.sleep.remove(x.id));
      DB.prefs.setSleepGoal(480);
      if (sleepTime) DB.sleep.add({ date: todayISO(), sleepTime, wakeTime });
    }, { sleepTime, wakeTime });
    const read = () => ev(() => {
      const h = document.querySelector('.view.active .slp-mini');
      if (!h) throw new Error('the sleep page has no .slp-mini ring card');
      const fg = h.querySelector('.cal-ring-fg');
      const v = h.querySelector('.slp-verdict');
      return { dash: parseFloat(fg.getAttribute('stroke-dasharray')), empty: fg.classList.contains('is-empty'), num: h.querySelector('.cal-ring-num').textContent.trim(),
        verdict: v ? v.textContent.trim() : null, met: v ? v.classList.contains('is-met') : null, over: fg.classList.contains('over'),
        s: { on: t('sleep_on_goal'), short: t('sleep_short_by').replace('{v}', '0:30'), over: t('sleep_over_by').replace('{v}', '0:30') },
        rows: h.querySelectorAll('.slp-rows .macro-track, .slp-rows .time-range').length, logInCard: !!h.querySelector('#add-sleep-btn'),
        logBtns: document.querySelectorAll('.view.active #add-sleep-btn').length, text: h.textContent, emptyLine: t('ledger_empty_sleep'),
        linecap: getComputedStyle(fg).strokeLinecap,
        history: !!document.querySelector('.view.active .row-between .section-title'), emptySentence: !!document.querySelector('.view.active .empty'), older: !!document.querySelector('.view.active #more-sleep-days') };
    });
    await night('23:00', '07:00'); await reset('sleep'); await settled();
    let g = await read();
    assert.equal(g.verdict, g.s.on, 'exactly the goal: on target'); assert.equal(g.met, true); near(g.dash, 339.29, 0.5, 'a met night closes the ring');
    assert.equal(g.rows, 1, 'ONE night: the range alone, no average row (it would repeat the ring\'s own figure)');
    assert.equal(g.logInCard, false, 'the log button sits under the card'); assert.equal(g.logBtns, 1, 'and it is the page\'s only one');
    await night('23:30', '07:00'); await reset('sleep'); await settled();
    g = await read();
    assert.equal(g.verdict, g.s.short, 'half an hour under: short by 0:30'); near(g.dash, 339.29 * 450 / 480, 0.5, 'the ring fills 450 of 480');
    await night('22:30', '07:00'); await reset('sleep'); await settled();
    g = await read();
    assert.equal(g.verdict, g.s.over, 'half an hour over: over by 0:30'); near(g.dash, 339.29, 0.5, 'the fill is clamped at the goal');
    assert.equal(g.over, false, 'more sleep is never drawn in --danger');
    await night(null); await reset('sleep'); await settled();
    g = await read();
    assert.equal(g.empty, true, 'no night: the ring carries .is-empty'); assert.equal(g.dash, 0, 'and a zero fill'); assert.notEqual(g.linecap, 'round', 'so no round-cap dot is drawn');
    assert.equal(g.verdict, null, 'the verdict is hidden'); assert.equal(g.num, '—');
    assert.equal(g.rows, 0, 'no rows describe a night that does not exist');
    assert.equal(g.logInCard, false, 'the log button stays under the card'); assert.equal(g.logBtns, 1, 'and it is the page\'s only one');
    assert.equal(g.text.includes(g.emptyLine), false, 'no empty-state sentence inside the card');
    assert.equal(g.history, false, 'no «السجل» header over nothing'); assert.equal(g.emptySentence, false, 'no empty-state sentence under it'); assert.equal(g.older, false, 'no «older days» door into more emptiness');
  }],

  ['the ring\'s centre fits its chord, and the card stacks under 360px (375px with «larger text»)', async ({ page, ev, reset, settled, lang }) => {
    const cells = [];
    try {
      for (const seed of ['under', 'over']) {
        await ev((seed) => {
          DB.sleep.list().forEach((x) => DB.sleep.remove(x.id));
          DB.prefs.setSleepGoal(480);
          const today = todayISO();
          window.__qaSeed = (window.__qaSeed || 0) + 1;
          if (seed === 'under') DB.sleep.importFromHealth([{ start: addDaysISO(today, -1) + 'T23:30:' + String(window.__qaSeed % 60).padStart(2, '0'), end: today + 'T06:45:00', stages: { deep: 90, rem: 80, light: 240, awake: 25 } }]);
          else DB.sleep.add({ date: today, sleepTime: '20:15', wakeTime: '07:00' });   // 10:45 — the widest figure and «over by 2:45»
          DB.sleep.add({ date: addDaysISO(today, -2), sleepTime: '23:00', wakeTime: '06:00' });
        }, seed);
        for (const width of [375, 360, 340]) {
          for (const lg of [false, true]) {
            await page.setViewportSize({ width, height: 812 });
            await ev((lg) => { DB.prefs.setTextLg(lg); document.body.classList.toggle('text-lg', lg); }, lg);
            await reset('sleep'); await settled();
            const c = await ev(() => {
              const h = document.querySelector('.view.active .slp-mini');
              if (!h) throw new Error('the sleep page has no .slp-mini ring card');
              const ringBox = h.querySelector('.slp-ring');
              const fg = ringBox.querySelector('.cal-ring-fg');
              const ring = ringBox.getBoundingClientRect();
              const cy = ring.top + ring.height / 2;
              const sw = parseFloat(getComputedStyle(fg).strokeWidth) * (ring.width / 120);
              const R = 54 * (ring.width / 120) - sw / 2;
              // Fonts are fenced off in this harness: the fallback face is narrower
              // than JetBrains Mono / Plex, so a measured width is taken at x1.12
              // unless the brand mono actually loaded.
              const mono = [...document.fonts].some((f) => /JetBrains Mono/i.test(f.family) && f.status === 'loaded');
              const k = mono ? 1 : 1.12;
              const lines = [...h.querySelectorAll('.cal-ring-center > *')].map((n) => {
                const range = document.createRange(); range.selectNodeContents(n);
                const ls = [];
                for (const r of range.getClientRects()) {
                  if (!r.width) continue;
                  const mid = (r.top + r.bottom) / 2;
                  const L = ls.find((l) => mid >= l.top && mid <= l.bottom);
                  if (!L) { ls.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }); continue; }
                  L.left = Math.min(L.left, r.left); L.right = Math.max(L.right, r.right); L.top = Math.min(L.top, r.top); L.bottom = Math.max(L.bottom, r.bottom);
                }
                return { text: n.textContent.trim(), n: ls.length, scroll: n.scrollWidth, client: n.clientWidth,
                  fit: ls.map((L) => { const dy = Math.max(Math.abs(L.top - cy), Math.abs(L.bottom - cy)); return { w: (L.right - L.left) * k, chord: 2 * Math.sqrt(Math.max(0, R * R - dy * dy)), inside: dy <= R }; }) };
              });
              const rows = h.querySelector('.slp-rows').getBoundingClientRect();
              const hr = h.getBoundingClientRect();
              const clip = [];
              for (const el of [h, ...h.querySelectorAll('*')]) {
                if (!el.getClientRects().length || el.closest('svg')) continue;
                if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') clip.push(el.className + ' ' + el.scrollWidth + '>' + el.clientWidth);
                const r = el.getBoundingClientRect();
                if (r.width && (r.right > hr.right + 0.5 || r.left < hr.left - 0.5)) clip.push(el.className + ' leaves the card');
              }
              const view = document.querySelector('.view.active');
              return { lines, stacked: rows.top >= ring.bottom - 1, clip, sideways: view.scrollWidth > view.clientWidth + 1, scale: getComputedStyle(document.body).getPropertyValue('--fs-scale').trim(), mono };
            });
            const where = `${lang} ${seed} ${width}px${lg ? ' text-lg' : ''}`;
            cells.push(where);
            assert.equal(c.lines.length, 2, where + ': two centre lines');
            for (const L of c.lines) {
              assert.ok(L.scroll <= L.client, `${where}: «${L.text}» clips its box`);
              assert.equal(L.n, 1, `${where}: «${L.text}» is ONE line`);
              for (const f of L.fit) {
                assert.ok(f.inside, `${where}: «${L.text}» runs below the ring's inner circle`);
                assert.ok(f.w <= f.chord + 0.5, `${where}: «${L.text}» sits on the ring stroke (${f.w.toFixed(1)}px at x${c.mono ? 1 : 1.12}, chord ${f.chord.toFixed(1)}px)`);
              }
            }
            assert.equal(c.stacked, width < 360 || (lg && width < 375), `${where}: the ring ${c.stacked ? 'stacks above' : 'sits beside'} the rows`);
            assert.deepEqual(c.clip, [], where + ': nothing clips or leaves the card');
            assert.equal(c.sideways, false, where + ': the view does not scroll sideways');
            assert.equal(c.scale, lg ? '1.1' : '1');
          }
        }
      }
    } finally {
      await page.setViewportSize({ width: 375, height: 812 });
      await ev(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
    }
    assert.equal(cells.length, 12);
  }],

  ['the sleep sheet opens on last night\'s times, and a night saved through it re-renders the hero', async ({ page, ev, reset, settled }) => {
    await ev(seedSleep);
    await reset('sleep'); await settled();
    await page.locator('.view.active #add-sleep-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #sleep-start');
    assert.equal(await page.locator('#sleep-start').inputValue(), '23:30'); assert.equal(await page.locator('#sleep-end').inputValue(), '06:45');
    assert.equal(await page.locator('#sleep-date').inputValue(), await ev(() => addDaysISO(todayISO(), -2)), 'today and yesterday are logged: the sheet opens on the newest night still missing');
    const inline = await ev(() => (document.querySelector('#sleep-duration-preview .prev-session-sets')?.getAttribute('style') || '').includes('font-size'));
    assert.equal(inline, false, 'the live total carries no inline font size');
    await ev(() => closeModal());
    // The night's row lives in the sleep log now; the page's ring is the same
    // card, so the edit made there is read back on the page.
    await reset('sleeplog', { date: await ev(() => todayISO()) }); await settled();
    await page.locator('.view.active [data-edit-sleep]').first().click();
    await page.waitForSelector('#modal-root .modal-overlay #sleep-end');
    await page.locator('#sleep-end').fill('07:45');
    await page.locator('#save-sleep-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    await reset('sleep'); await settled();
    const got = await ev(() => ({ fig: document.querySelector('.view.active .slp-mini .cal-ring-num')?.textContent.trim(), verdict: document.querySelector('.view.active .slp-verdict')?.textContent.trim(), over: t('sleep_over_by').replace('{v}', '0:15'), dash: parseFloat(document.querySelector('.view.active .slp-mini .cal-ring-fg')?.getAttribute('stroke-dasharray')) }));
    assert.equal(got.fig, '8:15'); assert.equal(got.verdict, got.over, 'a quarter hour past the goal'); near(got.dash, 339.29, 0.5, 'the ring closes');
  }],

  ['«log» with tonight already logged never writes a second row for that date, and the newest row of a date is the one the ring reads', async ({ page, ev, reset, settled }) => {
    await ev(() => { DB.sleep.list().forEach((x) => DB.sleep.remove(x.id)); DB.prefs.setSleepGoal(480); DB.sleep.add({ date: todayISO(), sleepTime: '23:30', wakeTime: '06:45' }); });
    await reset('sleep'); await settled();
    await page.locator('.view.active #add-sleep-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #sleep-date');
    await page.locator('#save-sleep-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    const dates = await ev(() => DB.sleep.list().map((x) => x.date));
    assert.equal(dates.length, 2, 'the save wrote a night'); assert.equal(new Set(dates).size, 2, 'and not a second one for a date already logged: ' + dates);
    // A correction ADDED for a date (not edited): the later-written row wins,
    // in the ring and in the average, the way newestCardio settles cardio.
    const got = await ev(() => {
      DB.sleep.list().forEach((x) => DB.sleep.remove(x.id));
      const today = todayISO();
      DB.sleep.add({ date: today, sleepTime: '01:00', wakeTime: '06:00' });   // 5:00, written first
      const later = DB.sleep.add({ date: today, sleepTime: '23:00', wakeTime: '06:30' });   // 7:30, written after
      later.createdAt = new Date(Date.now() + 1000).toISOString();
      renderView(currentView);
      return { num: document.querySelector('.view.active .slp-mini .cal-ring-num')?.textContent.trim() };
    });
    assert.equal(got.num, '7:30', 'the ring reads the row written last for the date, not the first');
  }],

  ['the two goals are Settings rows, and both goals survive a backup round-trip', async ({ page, ev, reset }) => {
    await ev(() => { DB.prefs.setCardioGoal(200); DB.prefs.setSleepGoal(450); });
    await reset('settings');
    const rows = await ev(() => ({ c: document.querySelector('.view.active [data-goal="cardio"]')?.textContent.replace(/\s+/g, ' ') || '', s: document.querySelector('.view.active [data-goal="sleep"]')?.textContent.replace(/\s+/g, ' ') || '', title: document.querySelector('.view.active [data-goal="cardio"] .settings-action-title')?.textContent.trim(), named: t('cardio_goal_set') }));
    assert.equal(rows.title, rows.named, 'out of the Cardio page the row says what the goal is of');
    assert.ok(rows.c.includes('200'), 'the cardio goal row shows its value'); assert.ok(rows.s.includes('7:30'), 'the sleep goal row shows its value');
    await page.locator('.view.active [data-goal="sleep"]').click();
    await page.waitForSelector('#modal-root .modal-overlay #goal-input');
    assert.equal(await page.locator('#goal-input').inputValue(), '7.5');
    assert.equal((await page.locator('#goal-live').innerText({ timeout: 1000 }).catch(() => '')).trim(), '7:30', 'the hours entered read back as H:MM, the way the goal is shown everywhere');
    await page.locator('#goal-input').fill('8.25');
    assert.equal((await page.locator('#goal-live').innerText({ timeout: 1000 }).catch(() => '')).trim(), '8:15', 'and follow the field as it is typed');
    await page.locator('#goal-input').fill('9');
    await page.locator('#goal-save').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    const trip = await ev(() => { const before = [DB.prefs.cardioGoal(), DB.prefs.sleepGoal()]; DB.importJSON(DB.exportJSON()); return { before, after: [DB.prefs.cardioGoal(), DB.prefs.sleepGoal()], clamp: (DB.prefs.setCardioGoal(5), DB.prefs.cardioGoal()) }; });
    assert.deepEqual(trip.before, [200, 540]); assert.deepEqual(trip.after, [200, 540], 'the goals survive export → import');
    assert.equal(trip.clamp, 30, 'the goal is clamped to its floor');
    await ev(() => { DB.prefs.setCardioGoal(150); DB.prefs.setSleepGoal(480); });
  }],

  ['AR and EN, dark and light, 375px, «larger text»: nothing on the hero or the sheet clips, no raw key', async ({ page, ev, reset, settled, lang, theme }) => {
    await ev(seedCardio); await ev(seedSleep);
    await ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
    const clipped = [];
    const scan = (root) => ev((root) => {
      const out = [];
      const host = document.querySelector(root);
      if (!host) return ['missing ' + root];
      for (const el of [host, ...host.querySelectorAll('*')]) {
        if (!el.getClientRects().length || el.tagName === 'SVG' || el.classList.contains('sr-only')) continue;   // .sr-only is a 1px clip by design
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') out.push(root + ' ' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth);
      }
      const view = document.querySelector('.view.active');
      if (view.scrollWidth > view.clientWidth + 1) out.push(root + ' the view scrolls sideways ' + view.scrollWidth + '>' + view.clientWidth);
      const text = host.innerText || '';
      if (/undefined|NaN/.test(text) || /(^|\s)[a-z]+_[a-z0-9_]+(\s|$)/.test(text)) out.push(root + ' raw text: ' + text.slice(0, 80));
      return out;
    }, root);
    for (const view of ['cardio', 'sleep']) {
      await reset(view); await settled();
      clipped.push(...await scan(view === 'sleep' ? '.view.active .slp-mini' : '.view.active .trk-hero'));
      if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${view}-${lang}-${theme}.png`), animations: 'disabled', timeout: 15000 }).catch(() => {});
    }
    // The two logs, whole, on a day with rows (today) and on a closed day.
    for (const view of ['cardiolog', 'sleeplog']) {
      for (const back of [0, -1]) {
        await reset(view, { date: await ev((n) => addDaysISO(todayISO(), n), back) }); await settled();
        clipped.push(...await scan('.view.active'));
        if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${view}${back}-${lang}-${theme}.png`), animations: 'disabled', timeout: 15000 }).catch(() => {});
      }
    }
    await reset('cardio'); await settled();
    await page.locator('.view.active #add-cardio-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-type-selector');
    clipped.push(...await scan('#modal-root .modal'));
    if (SHOT_DIR) await page.locator('#modal-root .modal').screenshot({ path: path.join(SHOT_DIR, `cardio-sheet-${lang}-${theme}.png`), animations: 'disabled', timeout: 15000 }).catch(() => {});
    await ev(() => { closeModal(); DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
    assert.deepEqual(clipped, [], 'nothing clips at the largest text size: ' + JSON.stringify(clipped));
  }],

  ['the bars grow, the ring draws and the figures settle on arrival, and the end state is the reduced-motion render', async ({ browser, origin, ev, reset, settled, lang, theme }) => {
    await ev(seedCardio); await ev(seedSleep);
    const shapeFn = () => {
      const cs = (el) => { const s = getComputedStyle(el); return [s.height, s.transform, s.opacity, s.animationName]; };
      const h = document.querySelector('.view.active .trk-hero');
      if (h) return { bars: [...h.querySelectorAll('.trk-bar')].map(cs), fig: cs(h.querySelector('.trk-fig')), line: cs(h.querySelector('.trk-goal')) };
      const m = document.querySelector('.view.active .slp-mini');
      const fg = m.querySelector('.cal-ring-fg');
      return { dash: getComputedStyle(fg).strokeDasharray, fg: cs(fg), centre: cs(m.querySelector('.cal-ring-center')), fills: [...m.querySelectorAll('.macro-track-fill')].map(cs) };
    };
    const live = {};
    for (const view of ['cardio', 'sleep']) {
      await reset(view);
      const arriving = await ev((view) => {
        const enter = !!document.querySelector('.view.active.enter, .view.active .enter');
        if (view === 'cardio') {
          const h = document.querySelector('.view.active .trk-hero');
          return { enter, anims: [getComputedStyle(h.querySelector('.trk-bar')).animationName, getComputedStyle(h.querySelector('.trk-fig')).animationName, getComputedStyle(h.querySelector('.trk-goal')).animationName], k: [...h.querySelectorAll('.trk-col')].map((c, i) => c.querySelector('.trk-bar') ? c.querySelector('.trk-bar').style.getPropertyValue('--k').trim() === String(i) : true).every(Boolean) };
        }
        const m = document.querySelector('.view.active .slp-mini');
        if (!m) throw new Error('the sleep page has no .slp-mini ring card');
        return { enter, anims: [getComputedStyle(m.querySelector('.cal-ring-fg')).animationName, getComputedStyle(m.querySelector('.cal-ring-center')).animationName], k: true };
      }, view);
      assert.equal(arriving.enter, true, view + ': the view arrives under the stagger host');
      assert.deepEqual(arriving.anims, view === 'cardio' ? ['trk-grow', 'vlt-enter', 'trk-line'] : ['slp-draw', 'vlt-enter'], view + ': ' + (view === 'cardio' ? 'the bars grow, the figure settles, the line draws' : 'the ring draws and its centre settles'));
      assert.equal(arriving.k, true, view + ': each bar carries its column index');
      await settled();
      live[view] = await ev(shapeFn);
      // The ring's own transform is its rotate(-90) attribute, so it is held to
      // «no animation, fully opaque»; everything else to «no transform» too.
      const statics = view === 'cardio' ? live[view].bars : [live[view].centre, ...live[view].fills];
      assert.ok(statics.every((x) => x[1] === 'none' && x[2] === '1' && x[3] === 'none'), view + ': after the window nothing is still moving');
      if (view === 'sleep') assert.ok(live[view].fg[2] === '1' && live[view].fg[3] === 'none', 'sleep: the ring has finished drawing');
    }
    const r = await openPage(browser, origin, { lang, theme, reduced: true });
    try {
      await r.ev(seedCardio); await r.ev(seedSleep);
      for (const view of ['cardio', 'sleep']) {
        await r.reset(view);
        const still = await r.ev(() => ({ enter: !!document.querySelector('.view.active.enter, .view.active .enter'), stagger: getComputedStyle(document.documentElement).getPropertyValue('--stagger-bar').trim() }));
        assert.equal(still.enter, false, view + ': under reduced motion the stagger is never mounted');
        assert.equal(still.stagger, '0ms', '--stagger-bar is zeroed by the clamp');
        const got = await r.page.evaluate(shapeFn);
        assert.deepEqual(got, live[view], view + ': the reduced-motion render is the animated render\'s end state');
      }
      assert.deepEqual(r.errors, []);
    } finally { await r.ctx.close(); }
  }],

  // ── THE TWO LOGS (the owner, on the Sleep page: the sleep log should follow
  // the food log's idea — where it lives, in the day, and in the details of
  // that day's sleep; then on the Cardio page: the same for the cardio log).
  // The day ledger left both pages for a dated screen each, reached from the
  // page header exactly as Food reaches its log.
  ['the sleep page carries no ledger: the header link and the ring open the log on the ring\'s night, Back returns, one add under the card', async ({ page, ev, reset, settled }) => {
    const s = await ev(seedSleep);
    await reset('sleep'); await settled();
    const got = await ev(() => {
      const v = document.querySelector('.view.active');
      const card = v.querySelector('.slp-mini');
      const link = v.querySelector('.page-header .header-links .link-btn');
      const adds = [...v.querySelectorAll('#add-sleep-btn')];
      return {
        rows: v.querySelectorAll('[data-edit-sleep], .ledger, .ledger-day, [data-ledger-sleep]').length,
        title: !!v.querySelector('.section-title'), older: !!v.querySelector('#more-sleep-days'),
        link: link ? link.textContent.replace(/\s+/g, ' ').trim() : null, want: t('sleep_log'), chevron: !!(link && link.querySelector('.icon-mirror svg')),
        adds: adds.length, inCard: !!(card && card.querySelector('#add-sleep-btn')),
        below: !!(adds[0] && card) && adds[0].getBoundingClientRect().top >= card.getBoundingClientRect().bottom - 0.5,
        sideways: v.scrollWidth > v.clientWidth + 1,
      };
    });
    assert.equal(got.rows, 0, 'no ledger rows on the Sleep page');
    assert.equal(got.title, false, 'no history header'); assert.equal(got.older, false, 'no older-days door');
    assert.equal(got.link, got.want, 'the header carries the log link, as Food\'s does'); assert.equal(got.chevron, true, 'with its mirrored chevron');
    assert.equal(got.adds, 1, 'ONE add'); assert.equal(got.inCard, false); assert.equal(got.below, true, 'under the card');
    assert.equal(got.sideways, false, 'the page does not scroll sideways');
    await page.locator('.view.active .header-links .link-btn').click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['sleeplog', s.today], 'the link opens the log on the ring\'s night');
    await page.locator('.view.active [data-back]').click();
    assert.equal(await ev(() => currentView), 'sleep', 'Back returns to the Sleep page');
    await settled();
    await page.locator('.view.active .slp-mini .slp-ring').click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['sleeplog', s.today], 'tapping the ring card opens the log on the night it shows');
    await page.locator('.view.active [data-back]').click();
    await settled();
    await page.locator('.view.active #sleep-goal-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #goal-input');
    assert.equal(await ev(() => currentView), 'sleep', 'the goal button inside the card opens its sheet, not the log');
    await ev(() => closeModal());
    // The ring's night when it is not today: the link follows it.
    const d3 = await ev(() => { const k = addDaysISO(todayISO(), -3); DB.sleep.list().filter((x) => x.date !== k).forEach((x) => DB.sleep.remove(x.id)); return k; });
    await reset('sleep'); await settled();
    // The review of the logs (2026-09-27): the header link is the Food and
    // Cardio links' twin, so it opens TODAY; only the ring opens its own night.
    await page.locator('.view.active .header-links .link-btn').click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['sleeplog', s.today], 'the header link opens today\'s log, as Food\'s and Cardio\'s do — never an old night');
    await page.locator('.view.active [data-back]').click();
    await settled();
    await page.locator('.view.active .slp-mini .slp-ring').click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['sleeplog', d3], 'the ring opens the log on the night it shows');
  }],

  ['a logged night\'s log has no add: its row is the door, so no copy of the night is one tap away; an empty day keeps its add; focus never falls to <body>', async ({ page, ev, reset, settled }) => {
    const s = await ev(seedSleep);
    await reset('sleeplog', { date: s.today }); await settled();
    const count = () => ev(() => DB.sleep.list().filter((x) => x.date === todayISO()).length);
    const before = await count();
    assert.equal(await page.locator('.view.active #add-sleeplog-btn').count(), 0, 'a logged night\'s log offers no add (it opened preset to that very night, and one Save wrote a copy)');
    await page.locator('.view.active [data-edit-sleep]').first().click();
    await page.waitForSelector('#modal-root #save-sleep-btn');
    await page.locator('#modal-root #save-sleep-btn').click();
    await settled();
    assert.equal(await count(), before, 'saving through the row edits the night, never adds one');
    const inView = () => ev(() => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest('.view.active'); });
    assert.equal(await inView(), true, 'after the save, focus lands inside the log, not on <body>');
    // An empty day keeps its add, and the add writes THAT day.
    await reset('sleeplog', { date: addDaysISOnode(s.today, -2) }); await settled();
    assert.equal(await page.locator('.view.active #add-sleeplog-btn').count(), 1, 'an empty day keeps its add');
  }],

  ['the day arrows keep keyboard focus on the arrow pressed, and hand it to «previous» when «next» stops at today', async ({ page, ev, reset, settled }) => {
    await ev(seedSleep);
    for (const view of ['sleeplog', 'cardiolog']) {
      await reset(view, { date: await ev(() => addDaysISO(todayISO(), -2)) }); await settled();
      await page.locator('.view.active [data-day-step="-1"]').focus();
      await page.keyboard.press('Enter');
      await settled();
      assert.equal(await ev(() => document.activeElement && document.activeElement.dataset.dayStep), '-1', view + ': «previous» keeps focus after it moves the day');
      await page.locator('.view.active [data-day-step="1"]').focus();
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await settled(); }
      assert.deepEqual(await ev(() => [viewContext.date === todayISO(), document.activeElement && document.activeElement.dataset.dayStep]), [true, '-1'], view + ': at today «next» is disabled, and focus moves to «previous», not <body>');
    }
  }],

  ['a watch sync repaints an open log: health.js refreshes sleeplog and cardiolog, and the sleep log asks for a sync as the cardio log does', async () => {
    const health = fs.readFileSync(path.join(__dirname, '..', 'js', 'health.js'), 'utf8');
    const list = (health.match(/function refreshActive\(\)[\s\S]*?\[([^\]]*)\]/) || [])[1] || '';
    for (const v of ['home', 'cardio', 'sleep', 'cardiolog', 'sleeplog']) assert.ok(new RegExp("'" + v + "'").test(list), 'health.js refreshActive() repaints ' + v + ' after an import (its list: ' + list.trim() + ')');
    const body = fs.readFileSync(path.join(__dirname, '..', 'js', 'body.js'), 'utf8');
    const log = body.slice(body.indexOf('function renderSleepLog('), body.indexOf('\n}\n', body.indexOf('function renderSleepLog(')));
    assert.ok(/Health\.autoSync\(\)/.test(log), 'renderSleepLog asks for a watch sync, as renderCardioLog does');
  }],

  ['the sleep log walks the days: the arrows move it and next stops at today; a night shows its ring, details and row; an empty day says so and its add saves to THAT date; an edit keeps the day', async ({ page, ev, reset, settled }) => {
    const s = await ev(seedSleep);
    await reset('sleeplog', { date: s.today }); await settled();
    const read = () => ev(() => {
      const v = document.querySelector('.view.active');
      const card = v.querySelector('.slp-mini');
      const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
      return {
        view: currentView, date: viewContext.date, label: txt(v.querySelector('.day-nav-label')),
        next: v.querySelector('[data-day-step="1"]') ? v.querySelector('[data-day-step="1"]').disabled : 'no next button',
        h1: txt(v.querySelector('h1.sr-only')), top: txt(v.querySelector('.detail-top-title')),
        ring: txt(card && card.querySelector('.cal-ring-num')), verdict: txt(card && card.querySelector('.slp-verdict')), closed: !!(card && card.classList.contains('closed')),
        goalBtn: !!(card && card.querySelector('.trk-goal-btn')),
        tracks: card ? [...card.querySelectorAll('.macro-track-name')].map(txt) : [],
        rows: [...v.querySelectorAll('[data-edit-sleep]')].map((r) => ({ range: txt(r.querySelector('.time-range')), sub: txt(r.querySelector('.fig-row-sub')), edge: !!r.querySelector('.sl-bar .sl-seg') })),
        empty: txt(v.querySelector('.empty-title')), adds: v.querySelectorAll('#add-sleeplog-btn').length,
        sideways: v.scrollWidth > v.clientWidth + 1,
        w: { today: t('today'), title: t('sleep_log'), watch: t('from_watch'), deep: t('sleep_deep'), eff: t('sleep_efficiency'), none: t('ledger_no_sleep'), on: t('sleep_on_goal') },
      };
    });
    let g = await read();
    assert.deepEqual([g.view, g.date], ['sleeplog', s.today]);
    assert.equal(g.top, g.w.title, 'the bar names the log'); assert.equal(g.h1, g.w.title, 'and an sr-only h1 names the screen');
    assert.equal(g.label, g.w.today); assert.equal(g.next, true, 'next is disabled on today');
    assert.equal(g.ring, '7:15', 'the day\'s card is the night\'s ring'); assert.equal(g.closed, false); assert.equal(g.goalBtn, false, 'the log card carries no goal control — the page does');
    assert.ok(g.tracks.includes(g.w.deep) && g.tracks.includes(g.w.eff), 'the stages as the deep and efficiency bars: ' + g.tracks);
    assert.equal(g.rows.length, 1, 'the night\'s row');
    assert.equal(g.rows[0].range, '11:30 PM → 6:45 AM', 'bed → wake, 12-hour, as one ltr run'); assert.equal(g.rows[0].sub, g.w.watch, 'the watch as its source'); assert.equal(g.rows[0].edge, true, 'and its stage edge');
    assert.equal(g.adds, 0, 'a logged night has no add: its row is the door (a second add wrote a copy of the night)'); assert.equal(g.empty, null); assert.equal(g.sideways, false, 'no sideways scroll');
    await page.locator('.view.active [data-day-step="-1"]').click();
    g = await read();
    assert.equal(g.date, s.d1, 'prev moves one day back'); assert.equal(g.label, await ev((d) => formatDate(d), s.d1)); assert.equal(g.next, false, 'next is live on a past day');
    assert.equal(g.ring, '8:00'); assert.equal(g.verdict, g.w.on); assert.equal(g.closed, true, 'a past night reads as a closed record'); assert.equal(g.rows.length, 1);
    await page.locator('.view.active [data-day-step="-1"]').click();
    g = await read();
    const d2 = await ev(() => addDaysISO(todayISO(), -2));
    assert.equal(g.date, d2); assert.equal(g.ring, null, 'an empty day draws no card'); assert.equal(g.rows.length, 0);
    assert.equal(g.empty, g.w.none, 'it says so once'); assert.equal(g.adds, 1, 'and keeps its one add');
    await page.locator('.view.active #add-sleeplog-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #sleep-date');
    assert.equal(await page.locator('#sleep-date').inputValue(), d2, 'the add opens on THAT date');
    await page.locator('#sleep-start').fill('23:00'); await page.locator('#sleep-end').fill('06:00');
    await page.locator('#save-sleep-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    g = await read();
    assert.deepEqual([g.view, g.date], ['sleeplog', d2], 'the save re-renders the log on the same day');
    assert.equal(g.ring, '7:00'); assert.equal(g.rows.length, 1);
    assert.equal(await ev((d) => DB.sleep.list().filter((x) => x.date === d).length, d2), 1, 'the night was written to that date');
    await page.locator('.view.active [data-day-step="1"]').click();
    await page.locator('.view.active [data-edit-sleep]').first().click();
    await page.waitForSelector('#modal-root .modal-overlay #sleep-end');
    await page.locator('#sleep-end').fill('07:30');
    await page.locator('#save-sleep-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    g = await read();
    assert.deepEqual([g.view, g.date, g.ring], ['sleeplog', s.d1, '8:30'], 'an edit re-renders the log on the same day');
    await page.locator('.view.active [data-day-step="1"]').click();
    g = await read();
    assert.equal(g.date, s.today); assert.equal(g.next, true, 'next stops at today again');
  }],

  ['the cardio page carries no ledger: the header link opens today\'s log, a day well opens that day, Back returns, one add under the card', async ({ page, ev, reset, settled }) => {
    const s = await ev(seedCardio);
    await reset('cardio'); await settled();
    const got = await ev(() => {
      const v = document.querySelector('.view.active');
      const card = v.querySelector('.trk-hero');
      const link = v.querySelector('.page-header .header-links .link-btn');
      const adds = [...v.querySelectorAll('#add-cardio-btn')];
      return {
        rows: v.querySelectorAll('[data-edit-cardio], .ledger, .ledger-day, [data-ledger-cardio]').length,
        title: !!v.querySelector('.section-title'), older: !!v.querySelector('#more-cardio-days'),
        link: link ? link.textContent.replace(/\s+/g, ' ').trim() : null, want: t('cardio_log'), chevron: !!(link && link.querySelector('.icon-mirror svg')),
        adds: adds.length, inCard: !!(card && card.querySelector('#add-cardio-btn')),
        below: !!(adds[0] && card) && adds[0].getBoundingClientRect().top >= card.getBoundingClientRect().bottom - 0.5,
        future: (v.querySelector('.trk-col.is-future') || {}).dataset?.trkDay || null,
        sideways: v.scrollWidth > v.clientWidth + 1,
      };
    });
    assert.equal(got.rows, 0, 'no ledger rows on the Cardio page');
    assert.equal(got.title, false, 'no «all sessions» header'); assert.equal(got.older, false, 'no older-days door');
    assert.equal(got.link, got.want, 'the header carries the log link, as Food\'s does'); assert.equal(got.chevron, true, 'with its mirrored chevron');
    assert.equal(got.adds, 1, 'ONE add'); assert.equal(got.inCard, false); assert.equal(got.below, true, 'under the card');
    assert.equal(got.sideways, false, 'the page does not scroll sideways');
    await page.locator('.view.active .header-links .link-btn').click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['cardiolog', s.today], 'the link opens the log on today');
    await page.locator('.view.active [data-back]').click();
    assert.equal(await ev(() => currentView), 'cardio', 'Back returns to the Cardio page');
    await settled();
    const day = s.prev || s.today;
    await page.locator(`.view.active .trk-col[data-trk-day="${day}"]`).click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['cardiolog', day], 'a day\'s well opens the log on that day');
    await page.locator('.view.active [data-back]').click();
    await settled();
    if (got.future) {
      await page.locator(`.view.active .trk-col[data-trk-day="${got.future}"]`).click();
      assert.equal(await ev(() => currentView), 'cardio', 'a day still to come opens nothing');
    }
    await page.locator('.view.active #cardio-goal-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #goal-input');
    assert.equal(await ev(() => currentView), 'cardio', 'the goal button inside the card opens its sheet, not the log');
    await ev(() => closeModal());
  }],

  ['the cardio log walks the days: the day\'s totals and rows, the arrows, an empty day\'s add on THAT date, an edit on the same day', async ({ page, ev, reset, settled }) => {
    const s = await ev(() => {
      DB.cardio.list().forEach((c) => DB.cardio.remove(c.id));
      DB.cardioPlan.list().forEach((r) => DB.cardioPlan.remove(r.id));
      DB.prefs.setCardioGoal(150);
      const today = todayISO(), d1 = addDaysISO(today, -1), d2 = addDaysISO(today, -2);
      DB.cardio.add({ type: 'running', date: d1, duration: 50, calories: 400 });
      DB.cardio.add({ type: 'walking', date: today, duration: 35, calories: 180 });
      DB.cardio.add({ type: 'walking', date: today, duration: 20, calories: 0 });
      return { today, d1, d2 };
    });
    await reset('cardiolog', { date: s.today }); await settled();
    const read = () => ev(() => {
      const v = document.querySelector('.view.active');
      const card = v.querySelector('.cl-day');
      const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
      return {
        view: currentView, date: viewContext.date, label: txt(v.querySelector('.day-nav-label')),
        next: v.querySelector('[data-day-step="1"]') ? v.querySelector('[data-day-step="1"]').disabled : 'no next button',
        h1: txt(v.querySelector('h1.sr-only')), top: txt(v.querySelector('.detail-top-title')),
        fig: txt(card && card.querySelector('.trk-num')), unit: txt(card && card.querySelector('.trk-unit')),
        ro: card ? [...card.querySelectorAll('.trk-ro')].map((r) => [txt(r.querySelector('.trk-ro-lab')), txt(r.querySelector('.trk-ro-val'))]) : [],
        share: txt(card && card.querySelector('.trk-delta')),
        rows: v.querySelectorAll('[data-edit-cardio]').length, owed: v.querySelectorAll('[data-cardio-done]').length,
        empty: txt(v.querySelector('.empty-title')), adds: v.querySelectorAll('#add-cardiolog-btn').length,
        sideways: v.scrollWidth > v.clientWidth + 1,
        w: { today: t('today'), title: t('cardio_log'), cal: t('calories'), min: t('unit_min'), none: t('ledger_no_cardio') },
        share37: t('cardio_goal_share').replace('{p}', fmtNum(37)), share33: t('cardio_goal_share').replace('{p}', fmtNum(33)),
      };
    });
    let g = await read();
    assert.deepEqual([g.view, g.date], ['cardiolog', s.today]);
    assert.equal(g.top, g.w.title, 'the bar names the log'); assert.equal(g.h1, g.w.title, 'and an sr-only h1 names the screen');
    assert.equal(g.label, g.w.today); assert.equal(g.next, true, 'next is disabled on today');
    assert.equal(g.fig, '55', 'the day\'s minutes'); assert.equal(g.unit, g.w.min);
    assert.deepEqual(g.ro, [[g.w.cal, '180']], 'the day\'s calories (the count of sessions is the rows under it)');
    assert.equal(g.share, g.share37, 'the day\'s share of the weekly goal');
    assert.equal(g.rows, 2); assert.equal(g.adds, 1); assert.equal(g.empty, null); assert.equal(g.sideways, false, 'no sideways scroll');
    await page.locator('.view.active [data-day-step="-1"]').click();
    g = await read();
    assert.equal(g.date, s.d1, 'prev moves one day back'); assert.equal(g.label, await ev((d) => formatDate(d), s.d1)); assert.equal(g.next, false, 'next is live on a past day');
    assert.equal(g.fig, '50'); assert.deepEqual(g.ro, [[g.w.cal, '400']]); assert.equal(g.share, g.share33); assert.equal(g.rows, 1);
    await page.locator('.view.active [data-day-step="-1"]').click();
    g = await read();
    assert.equal(g.date, s.d2); assert.equal(g.fig, null, 'an empty day draws no card'); assert.equal(g.rows, 0);
    assert.equal(g.empty, g.w.none, 'it says so once'); assert.equal(g.adds, 1, 'and keeps its one add');
    await page.locator('.view.active #add-cardiolog-btn').click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-date');
    assert.equal(await page.locator('#cardio-date').inputValue(), s.d2, 'the add opens on THAT date');
    await page.locator('#cardio-duration').fill('25');
    await page.locator('#save-cardio-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    g = await read();
    assert.deepEqual([g.view, g.date, g.fig, g.rows], ['cardiolog', s.d2, '25', 1], 'the save re-renders the log on the same day, with the session');
    assert.equal(await ev((d) => DB.cardio.list().filter((x) => x.date === d).length, s.d2), 1, 'the session was written to that date');
    await page.locator('.view.active [data-day-step="1"]').click();
    await page.locator('.view.active [data-day-step="1"]').click();
    await page.locator('.view.active [data-edit-cardio]').first().click();
    await page.waitForSelector('#modal-root .modal-overlay #cardio-duration');
    await page.locator('#cardio-duration').fill('40');
    await page.locator('#save-cardio-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    g = await read();
    const sum = await ev(() => String(DB.cardio.list().filter((x) => x.date === todayISO()).reduce((a, c) => a + c.duration, 0)));
    assert.deepEqual([g.view, g.date, g.fig], ['cardiolog', s.today, sum], 'an edit re-renders the log on the same day');
    assert.notEqual(sum, '55', 'and the edit landed');
  }],

  ['a scheduled session appears on its day in the log, and its tick writes or claims the row exactly as Home\'s does', async ({ page, ev, reset, settled }) => {
    const s = await ev(() => {
      DB.cardio.list().forEach((c) => DB.cardio.remove(c.id));
      DB.cardioPlan.list().forEach((r) => DB.cardioPlan.remove(r.id));
      const today = todayISO();
      DB.cardioPlan.add({ type: 'cycling', days: [0, 1, 2, 3, 4, 5, 6], duration: 30 });
      return { today, id: (DB.cardioPlan.list()[0] || {}).id };
    });
    try {
      await reset('cardiolog', { date: s.today }); await settled();
      const look = () => ev(() => ({
        owed: [...document.querySelectorAll('.view.active [data-cardio-done]')].map((b) => b.dataset.cardioDone),
        named: [...document.querySelectorAll('.view.active [data-cardio-done]')].every((b) => (b.getAttribute('aria-label') || '').includes(t('cycling'))),
        shown: document.querySelectorAll('.view.active [data-edit-cardio]').length, empty: !!document.querySelector('.view.active .empty'),
        rows: DB.cardio.list().filter((c) => c.date === todayISO()).map((c) => ({ planId: c.planId || null, auto: !!c.planAuto, dur: c.duration, type: c.type })),
        at: [currentView, viewContext.date],
      }));
      let g = await look();
      assert.deepEqual(g.owed, [s.id], 'today\'s scheduled ride is on the log, owed'); assert.equal(g.named, true, 'its tick is named by the type');
      assert.equal(g.shown, 0); assert.equal(g.empty, false, 'a day with a session owed is not «nothing»');
      await page.locator('.view.active [data-cardio-done]').click();
      g = await look();
      assert.deepEqual(g.rows, [{ planId: s.id, auto: true, dur: 30, type: 'cycling' }], 'the tick writes the row Home\'s tick writes');
      assert.deepEqual(g.owed, [], 'the ride is no longer owed'); assert.equal(g.shown, 1, 'it is a session of the day now'); assert.deepEqual(g.at, ['cardiolog', s.today]);
      // An unclaimed ride of the same type (a watch import) is CLAIMED, not doubled.
      await ev(() => { DB.cardio.list().forEach((c) => DB.cardio.remove(c.id)); DB.cardio.add({ type: 'cycling', date: todayISO(), duration: 44, calories: 120 }); renderView(currentView); });
      await page.locator('.view.active [data-cardio-done]').click();
      g = await look();
      assert.deepEqual(g.rows, [{ planId: s.id, auto: false, dur: 44, type: 'cycling' }], 'the tick claims the existing ride');
      // A PAST day carries no tick, however old the schedule — only today's
      // log does, as Home (the review: a tick there back-wrote a session
      // months ago, and after its toast it could not be un-ticked).
      await ev(() => { STATE.cardioPlan.forEach((r) => { r.createdAt = new Date(Date.now() - 30 * 864e5).toISOString(); }); });
      await page.locator('.view.active [data-day-step="-1"]').click();
      g = await look();
      assert.deepEqual(g.owed, [], 'yesterday owes no tick even to a schedule made a month ago');
    } finally {
      await ev(() => { DB.cardioPlan.list().forEach((r) => DB.cardioPlan.remove(r.id)); DB.cardio.list().forEach((c) => DB.cardio.remove(c.id)); });
    }
  }],

  ['a row dated after today stays reachable: today\'s log lists it under its own date, outside the day\'s card; a past day does not', async ({ ev, reset, settled }) => {
    // The arrows stop at today, so a mistyped future date (an old blob, a
    // backup) would have no day to live on — the ledger showed it above today.
    const s = await ev(() => {
      DB.sleep.list().forEach((x) => DB.sleep.remove(x.id));
      DB.cardio.list().forEach((c) => DB.cardio.remove(c.id));
      const today = todayISO(), later = addDaysISO(today, 3);
      DB.sleep.add({ date: later, sleepTime: '23:00', wakeTime: '07:00' });
      DB.cardio.add({ type: 'walking', date: later, duration: 30, calories: 0 });
      return { today, d1: addDaysISO(today, -1) };
    });
    try {
      for (const view of ['sleeplog', 'cardiolog']) {
        const look = () => ev(() => ({
          n: document.querySelectorAll('.view.active .ledger-day.is-future [data-edit-sleep], .view.active .ledger-day.is-future [data-edit-cardio]').length,
          tag: document.querySelector('.view.active .ledger-day.is-future .ledger-num')?.textContent.trim() || null, want: t('date_future_tag'),
          card: !!document.querySelector('.view.active .slp-mini, .view.active .cl-day'), empty: !!document.querySelector('.view.active .empty'),
        }));
        await reset(view, { date: s.today }); await settled();
        let g = await look();
        assert.equal(g.n, 1, view + ': today\'s log lists the later row'); assert.equal(g.tag, g.want, view + ': under its own date, tagged as still to come');
        assert.equal(g.card, false, view + ': it is not counted as today\'s'); assert.equal(g.empty, true, view + ': today itself is still empty');
        await reset(view, { date: s.d1 }); await settled();
        g = await look();
        assert.equal(g.n, 0, view + ': a past day does not repeat it');
      }
    } finally {
      await ev(() => { DB.sleep.list().forEach((x) => DB.sleep.remove(x.id)); DB.cardio.list().forEach((c) => DB.cardio.remove(c.id)); });
    }
  }],
];

// formatDuration, in Node, for the expectations (H:MM — the owner's clock rule).
function addDaysISOnode(iso, n) { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
function formatDurationNode(min) { const m = Math.round(min); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  try {
    if (SHOT_DIR) fs.mkdirSync(SHOT_DIR, { recursive: true });
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
  if (failures.length) { console.error(`FAIL  cardio+sleep UI: ${failures.length} of ${CASES.length * 2} cases failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  cardio+sleep UI (${passed} cases, AR/dark + EN/light, 375px): the instrument hero from seeded rows (figures exact), the goal control and the is-met track, the last-used type and focus in the minutes, the redrawn duotone glyphs on radio tiles kept in place, every cardio glyph inside its 24-unit grid with no transform, the new-type flow and its neutral tile, the empty page said once, the sleep ring (fill = last night ÷ the goal, the duration and a one-line verdict inside the chord at 375/360/340 × normal/larger text, the night's range and source on the page's card, the three rows with the average of the nights BEFORE, no track, the stacked narrow card, the empty ring), the sheet on last night's times and the newest missing date, no second row for a logged date, the newest row of a date in the ring, the Settings goal rows and the backup round-trip, nothing clipped at «larger text», the reduced-motion end state, and THE TWO LOGS (no ledger on either page, one add under each card, the header link / the ring / a day's well opening the log on the right day, Back, the arrows with next stopped at today, a day's card, details and rows, an empty day's add written to THAT date, an edit kept on its day, a closed night, a scheduled ride owed on its day and ticked or claimed as on Home)`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
