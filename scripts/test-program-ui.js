#!/usr/bin/env node
// THE PROGRAM PAGE — «ثلاث صفائح», three plates (2026-09-27, the owner's
// order: the redesign chosen by the judge panel, with one addition of his own —
// «مع كلمات توضيحية للأشياء المعمولة»: every drawn element carries short words).
//
//   THE WEEK      the Cardio instrument reused: «هذا الأسبوع», the days trained
//                 over the days planned, one delta against last week, the days
//                 left, a track of seven wells (a trained day rises in ember to
//                 its sets, today is ringed, a planned day is outlined, a missed
//                 day shows an empty floor) with a one-line legend, and the sets
//                 and new-records readouts.
//   THE ROTATION  «دورتك» and the labelled edit button over the cycle ribbon,
//                 the pulled-forward line with its undo, «التمارين القادمة» as
//                 day tiles, and «الكارديو المجدول» as a lane with its add.
//   THE BODY      «العضلات · آخر ٧ أيام» as six muscle wells, and «أفضل أرقامك»
//                 as three record columns with «كل الأرقام».
//
// Every figure is asserted against rows the case itself seeded, and every door
// by where it lands. Same harness as scripts/test-cardio-sleep-ui.js
// (scripts/fp/server.js): the repo over loopback, js/cloud.js stubbed offline,
// every non-127.0.0.1 request aborted and the fence asserted after the run.
//
// The clock is FIXED at Wednesday 30 September 2026, 10:00 Riyadh — the
// design's own sample day — so the week has two days behind it, today, and
// days ahead, whatever day the suite runs on (page.clock.setFixedTime keeps the
// timers running, so motion.js's cleanup still fires).
//
// Standalone: runs itself behind the require.main guard; scripts/test-all.js
// runs it as its own line. QA_ONLY=<words> re-runs one case.
//
// Seen failing on the six-section page before the redesign existed: 24 of 26
// cases printed FAIL, AR and EN — «three plates: the week, the rotation, the
// body», «Cannot read properties of null (reading 'querySelectorAll')» for the
// week, the track and the ribbon, «the tiles are the next trainingDays.length
// training days», «the undo line is on the page», «the duration is a clock
// reading (H:MM)» ('30' !== '0:30'), «six wells, every category but Other»,
// «the three heaviest by 1RM», the no-plan case and the 44x44 case. The
// overflow case passed there VACUOUSLY (no plates to measure) and was made to
// require the three plates before it was trusted. The rep-moment case was
// seen failing on two planted defects (rep never set; the other plates left
// growing) and passes only against the built page.
//
// The review of the built page (same day) added eight cases' worth of checks,
// each seen failing on the first build before it was fixed: 26 of 36 cases
// FAILED — the first scrolling tile 16px off the ribbon's edge («right edges
// 359 vs 343»), Latin slot names set rtl in Arabic, «1دفع» for a reader, the
// tick sliding back on an undo that moved no slot, the planned outline at
// 1.68:1 / 1.53:1, «2 يومين» with no plan, «rest» said with no plan, a zero
// delta printed as «same as last week», «2 days left» on a Saturday with one
// day left, an eighth day in «last 7 days» (Core 1), the record weights 18px
// apart, .prg-mw 41 wide at 340px, and no «number = sets» note. The checks an
// earlier assertion hid were then seen failing on planted defects (the light
// current number 3.93:1, the clipped focus ring, names shifting on undo, day
// labels still, «2/2 يومين», the Friday line, no next-slot fallback on a rest
// day, well states from trainingDays.includes, an unescaped slot name, «kg»
// in pounds) — scratchpad program/plants.json and plant.js.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const FIXED = new Date('2026-09-30T07:00:00.000Z');   // 10:00 in Asia/Riyadh, a Wednesday
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
  await page.clock.setFixedTime(FIXED);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  // The seed is also callable from inside a case's own page function.
  await page.evaluate(`window.seedAll = ${seedAll.toString()}`);
  await page.evaluate(`window.contrastOf = ${contrastOf.toString()}`);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = (view, c) => ev(({ view, c }) => {
    try { closeModal(); } catch (_) {}
    hideToast();
    document.querySelectorAll('#modal-root .modal-overlay.nested').forEach((s) => s.remove());
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, c || {});
  }, { view, c });
  const settled = () => page.waitForFunction(() => !document.querySelector('.view.active.enter, .view.active .enter'), null, { timeout: 3000 });
  const back = async () => { await reset('workouts'); await settled(); };
  return { ctx, page, ev, reset, settled, back, errors, guard, lang, theme };
}

// ── the seed — deterministic, written through DB.* ──────────────────────────
// Push / Pull / Legs on Sun, Mon, Wed, Fri, anchored the Sunday before, so the
// week (Sun 27 Sep → Sat 3 Oct) has two trained days behind today, today still
// to train, and Friday ahead. Last week: ONE day (Mon 21). Returns what the
// page must show, derived here and never read off the page.
function seedAll() {
  DB.sessions.listAll().forEach((s) => DB.sessions.remove(s.id));
  DB.cardioPlan.list().forEach((r) => DB.cardioPlan.remove(r.id));
  DB.exercises.list().filter((e) => /^QA /.test(e.name)).forEach((e) => DB.exercises.remove && DB.exercises.remove(e.id));
  const ex = {
    bench: DB.exercises.add({ name: 'QA Bench', category: 'Chest' }).id,
    dead: DB.exercises.add({ name: 'QA <i>Dead</i>', category: 'Back' }).id,   // an untrusted name: printed, never parsed
    squat: DB.exercises.add({ name: 'QA Squat', category: 'Legs' }).id,
    curl: DB.exercises.add({ name: 'QA Curl', category: 'Arms' }).id,
  };
  const sets = (n, weight, reps) => Array.from({ length: n }, () => ({ weight, reps }));
  DB.plan.setRotation({ cycle: [{ name: 'Push', exerciseIds: [ex.bench] }, { name: 'Pull', exerciseIds: [ex.dead] }, { name: 'Legs', exerciseIds: [ex.squat] }], trainingDays: [0, 1, 3, 5], anchor: '2026-09-20' });
  // clear any per-date lists a previous case left
  (DB.plan.get().extraDates || []).slice().forEach((d) => DB.plan.setExtra(d, false));
  (DB.plan.get().restDates || []).slice().forEach((d) => DB.plan.setRest(d, false));
  const rows = [
    // last week — one day
    { exerciseId: ex.bench, date: '2026-09-21', sets: sets(4, 110, 3) },
    { exerciseId: ex.squat, date: '2026-09-21', sets: sets(4, 100, 5) },
    // this week — Sunday 10 sets, Monday 8
    { exerciseId: ex.bench, date: '2026-09-27', sets: sets(5, 120, 3) },
    { exerciseId: ex.dead, date: '2026-09-27', sets: sets(5, 140, 5) },
    { exerciseId: ex.squat, date: '2026-09-28', sets: sets(4, 90, 5) },
    { exerciseId: ex.curl, date: '2026-09-28', sets: sets(4, 20, 10) },
  ];
  rows.forEach((r) => DB.sessions.add(r));
  DB.cardioPlan.add({ type: 'walking', days: [0, 2, 4], duration: 30 });
  return {
    ex, today: '2026-09-30',
    daysNow: 2, daysLast: 1, planned: 4,
    setsNow: 18, setsLast: 8,
    prsNow: 1, prsLast: 0,                          // Bench 120 beat its 110; Dead and Curl have no history before the week
    perDay: { '2026-09-27': 10, '2026-09-28': 8 },
    muscles: { Chest: 1, Back: 1, Legs: 1, Shoulders: 0, Arms: 1, Core: 0 },   // sessions dated 24 Sep onward: today and the six days before
    records: [ex.dead, ex.bench, ex.squat],         // by Epley 1RM: 163.3, 132, 116.7 (Curl 26.7 is fourth)
    orm: [163, 132, 117],
    cardioId: DB.cardioPlan.list()[0].id,
  };
}

// WCAG contrast of a CSS colour (the first rgb()/rgba() in the string, so a
// box-shadow works too) over a solid background, alpha composited.
function contrastOf(fg, bg) {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const under = parse(bg), over = parse(fg);
  if (!under || !over) return NaN;
  const mix = (k) => over[k] * over.a + under[k] * (1 - over.a);
  const lum = (r, g, b) => {
    const ch = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const l1 = lum(mix('r'), mix('g'), mix('b')), l2 = lum(under.r, under.g, under.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// The effective hit box of every control matching sels, by hit-testing
// outward from its centre (a ::after halo counts, a neighbour stealing an
// edge counts against). ONE NAMED EXCEPTION: the week's seven wells cannot be
// 44 wide in less than 7 × 44 = 308px of track, and at 340px the track is 276,
// so there each well must reach its whole seventh of the track (its column and
// half of each gap), and no less.
function measureReach(sels) {
  const vw = innerWidth, vh = innerHeight, out = [];
  const track = document.querySelector('.view.active .prg-track');
  const wellFloor = track ? Math.min(44, Math.floor(track.getBoundingClientRect().width / 7)) : 44;
  for (const sel of sels) {
    const found = document.querySelectorAll('.view.active ' + sel);
    if (!found.length) out.push(sel + ' is not on the page');
    const needW = sel === '.prg-col[data-day-iso]' ? wellFloor : 44;
    for (const el of found) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const own = (h) => !!h && (h === el || el.contains(h));
      const run = (dx, dy) => { let d = 0; for (let k = 1; k <= 26; k++) { const x = cx + dx * k, y = cy + dy * k; if (x < 0 || y < 0 || x >= vw || y >= vh || !own(document.elementFromPoint(x, y))) break; d = k; } return d; };
      if (!own(document.elementFromPoint(cx, cy))) { out.push(sel + ' unhittable'); continue; }
      const w = run(-1, 0) + run(1, 0) + 1, h = run(0, -1) + run(0, 1) + 1;
      if (w < needW || h < 44) out.push(sel + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' reaches ' + w + 'x' + h + (needW < 44 ? ' (floor ' + needW + ')' : ''));
    }
  }
  return out;
}

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  ['three plates, and every caption and legend word in the language on screen', async ({ ev, back }) => {
    await ev(seedAll); await back();
    const g = await ev(() => {
      const v = document.querySelector('.view.active');
      const text = (sel) => [...v.querySelectorAll(sel)].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
      return {
        h1: v.querySelector('h1')?.textContent.trim(), want: t('program_title'),
        plates: ['.prg-week', '.prg-plan', '.prg-body'].map((s) => v.querySelectorAll(s).length),
        caps: text('.trk-cap-lab'),
        wantCaps: ['this_week_label', 'prg_cycle', 'prg_next', 'prg_cardio', 'prg_muscles', 'prg_records'].map((k) => t(k)),
        // What the legend SHOWS: an item that wrapped under the one line is clipped away.
        legend: [...v.querySelectorAll('.prg-legend .prg-lg')].filter((n) => n.getBoundingClientRect().top < n.parentElement.getBoundingClientRect().bottom - 1).map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
        // The figure inside a plate is explained on screen too (the owner's
        // rule), as the last item of the legend line.
        wantLegend: [t('prg_lg_trained'), t('today'), t('prg_lg_planned'), t('prg_wells_num')],
        edit: v.querySelector('.prg-edit')?.textContent.replace(/\s+/g, ' ').trim(), wantEdit: t('edit_cycle'),
        hint: v.querySelector('.prg-body .prg-hint')?.textContent.trim() ?? null, wantHint: t('prg_muscles_hint'),
        all: v.querySelector('.prg-all')?.textContent.trim(), wantAll: t('prg_all_records'),
        rawKey: [...v.querySelectorAll('*')].filter((n) => !n.children.length && /^(prg|program)_[a-z0-9_]+$/.test(n.textContent.trim())).map((n) => n.textContent.trim()),
        oldTitles: v.querySelectorAll('.rot-section-title').length,
      };
    });
    assert.equal(g.h1, g.want, 'the page keeps its real heading');
    assert.deepEqual(g.plates, [1, 1, 1], 'three plates: the week, the rotation, the body');
    assert.deepEqual(g.caps, g.wantCaps, 'each drawn thing is captioned, in order');
    assert.deepEqual(g.legend, g.wantLegend, 'the track has its one-line legend (no «missed» word while no day is missed)');
    assert.equal(g.edit, g.wantEdit, 'the edit button keeps a visible label');
    assert.equal(g.all, g.wantAll, '«all records» is labelled');
    assert.equal(g.hint, g.wantHint, 'the muscle wells say what their number counts');
    assert.deepEqual(g.rawKey, [], 'no raw key on screen');
    assert.equal(g.oldTitles, 0, 'the six stacked section titles are gone');
  }],

  ['the week figure is days trained over days planned, with one delta against last week and the days left', async ({ ev, back }) => {
    const s = await ev(seedAll); await back();
    const g = await ev(() => {
      const c = document.querySelector('.view.active .prg-week');
      const ro = [...c.querySelectorAll('.trk-ro')].map((r) => ({ lab: r.querySelector('.trk-ro-lab')?.textContent.trim(), val: r.querySelector('.trk-ro-val')?.textContent.trim(), d: r.querySelector('.prg-ro-d')?.textContent.trim() ?? null, up: !!r.querySelector('.prg-ro-d.is-up') }));
      return {
        num: c.querySelector('.trk-num')?.textContent.trim(), of: c.querySelector('.prg-of')?.textContent.trim() ?? null, unit: c.querySelector('.trk-unit')?.textContent.trim(),
        delta: c.querySelector('.prg-delta')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        left: c.querySelector('.prg-left')?.textContent.trim() ?? null, ro,
        range: c.querySelector('.trk-range')?.textContent.trim(),
        want: { unit: t('prg_days_n'), delta: '+1 ' + t('prg_vs_last'), left: t('prg_left_2'), sets: t('sets'), prs: t('program_new_prs'), range: formatDateShort('2026-09-27') + ' – ' + formatDateShort('2026-10-03') },
      };
    });
    assert.equal(g.num, String(s.daysNow), 'the figure is the days trained this week');
    assert.equal(g.of, '/' + s.planned, 'over the days the rotation plans (trainingDays.length)');
    assert.equal(g.unit, g.want.unit, 'the unit is the count form for four');
    assert.equal(g.delta, g.want.delta, 'one delta, «vs last week» printed once');
    assert.equal(g.left, g.want.left, 'two planned days are still needed: the dual form');
    assert.equal(g.range, g.want.range, 'the week\'s range sits on the caption row');
    assert.deepEqual(g.ro, [
      { lab: g.want.sets, val: String(s.setsNow), d: '+' + (s.setsNow - s.setsLast), up: true },
      { lab: g.want.prs, val: String(s.prsNow), d: '+' + (s.prsNow - s.prsLast), up: true },
    ], 'the two readouts, label first, each with its delta');
    // An equal week prints no figure delta: «vs last week» only for a change
    // (the approved grafts: deltas omitted when zero).
    await ev(() => { const bench = DB.exercises.list().find((e) => e.name === 'QA Bench').id; DB.sessions.add({ exerciseId: bench, date: '2026-09-22', sets: [{ weight: 50, reps: 5 }] }); renderView('workouts'); });
    const same = await ev(() => ({ d: document.querySelectorAll('.view.active .prg-week .prg-delta').length, text: document.querySelector('.view.active .prg-week .trk-fig')?.textContent || '', word: t('same_as_last_week') }));
    assert.equal(same.d, 0, 'two days each week: no figure delta');
    assert.ok(!same.text.includes(same.word), 'and no «same as last week» line: ' + same.text.replace(/\s+/g, ' ').trim());
    // A week with no figure last week prints no delta at all (v378).
    await ev(() => { DB.sessions.listAll().filter((x) => x.date < '2026-09-27').forEach((x) => DB.sessions.remove(x.id)); renderView('workouts'); });
    const none = await ev(() => ({ d: document.querySelectorAll('.view.active .prg-week .prg-delta, .view.active .prg-week .prg-ro-d').length }));
    assert.equal(none.d, 0, 'no last week, no delta');
  }],

  ['the track: a trained day rises by its sets, today is ringed, a planned day is outlined, a missed day shows its floor, and every door opens its day', async ({ page, ev, back }) => {
    const s = await ev(seedAll); await back();
    const g = await ev(() => {
      const track = document.querySelector('.view.active .prg-track');
      const cols = [...track.querySelectorAll('.prg-col')];
      return {
        role: track.getAttribute('role'), label: track.getAttribute('aria-label') || '', wantLabel: t('this_week_label'), hint: t('prg_wells_hint'),
        cols: cols.map((c) => {
          const well = c.querySelector('.prg-well'), plate = c.querySelector('.prg-plate');
          const cs = getComputedStyle(well, '::before'), after = getComputedStyle(well, '::after');
          return {
            tag: c.tagName, iso: c.dataset.dayIso || null, st: ['is-trained', 'is-today', 'is-planned', 'is-missed', 'is-rest'].filter((k) => c.classList.contains(k)),
            h: plate ? plate.getBoundingClientRect().height / well.getBoundingClientRect().height : 0,
            n: c.querySelector('.prg-plate-n')?.textContent.trim() ?? null, shadow: cs.boxShadow, floor: after.content !== 'none' ? parseFloat(after.height) : 0,
            aria: c.getAttribute('aria-label') || '', lab: c.querySelector('.prg-dlab')?.textContent.trim(), labToday: c.querySelector('.prg-dlab')?.classList.contains('is-today'),
          };
        }),
        dows: [0, 1, 2, 3, 4, 5, 6].map((d) => dayName(d)), setsWord: t('prg_sets_n').replace('{n}', '10'),
      };
    });
    assert.equal(g.role, 'group'); assert.ok(g.label.includes(g.wantLabel) && g.label.includes(g.hint), 'the wells are one named group, and the group says what the height means: ' + g.label);
    assert.deepEqual(g.cols.map((c) => c.lab), g.dows, 'seven wells in the week\'s order, Sunday first');
    assert.deepEqual(g.cols.map((c) => c.st[0]), ['is-trained', 'is-trained', 'is-rest', 'is-today', 'is-rest', 'is-planned', 'is-rest'], 'each well\'s state comes from the sessions and workoutForDate');
    assert.deepEqual(g.cols.map((c) => c.iso), ['2026-09-27', '2026-09-28', null, '2026-09-30', null, '2026-10-02', null], 'every well that holds a training day or a session is a door; a bare rest day is not');
    assert.deepEqual(g.cols.map((c) => c.tag), ['BUTTON', 'BUTTON', 'SPAN', 'BUTTON', 'SPAN', 'BUTTON', 'SPAN']);
    near(g.cols[0].h, 10 / (10 * 1.25), 0.02, 'Sunday\'s plate is its sets ÷ (the week\'s max × 1.25)');
    near(g.cols[1].h, 8 / (10 * 1.25), 0.02, 'Monday\'s plate');
    assert.deepEqual([g.cols[0].n, g.cols[1].n], ['10', '8'], 'the set count sits inside a plate that is tall enough');
    assert.ok(/inset/.test(g.cols[3].shadow) && /255, 106, 0/.test(g.cols[3].shadow) && /2px/.test(g.cols[3].shadow), 'today is ringed in the accent (a 2px inset ring): ' + g.cols[3].shadow);
    assert.ok(/inset/.test(g.cols[5].shadow) && /1px/.test(g.cols[5].shadow) && !/255, 106, 0/.test(g.cols[5].shadow), 'a planned day is outlined by a 1px hairline, not in the accent: ' + g.cols[5].shadow);
    // The planned outline is the only mark of the days still to do, so it
    // meets the 3:1 a graphic needs (WCAG 1.4.11) on its well, and so does the
    // legend's swatch of it.
    const pl = await ev(() => {
      const well = document.querySelectorAll('.view.active .prg-col')[5].querySelector('.prg-well');
      const sw = document.querySelector('.view.active .prg-legend .prg-sw.is-planned');
      const bg = getComputedStyle(well).backgroundColor;
      return { well: contrastOf(getComputedStyle(well, '::before').boxShadow, bg), sw: sw ? contrastOf(getComputedStyle(sw).boxShadow, getComputedStyle(sw).backgroundColor) : 0 };
    });
    assert.ok(pl.well >= 3, `the planned outline reads ${pl.well.toFixed(2)}:1 on its well, under 3:1`);
    assert.ok(pl.sw >= 3, `the legend's planned swatch reads ${pl.sw.toFixed(2)}:1, under 3:1`);
    assert.equal(g.cols[3].labToday, true, 'today\'s label is marked');
    assert.ok(g.cols[0].aria.includes(g.setsWord), 'a trained well speaks its sets in words: ' + g.cols[0].aria);
    for (const [i, iso] of [[0, '2026-09-27'], [5, '2026-10-02']]) {
      await back();
      await page.locator('.view.active .prg-col').nth(i).click();
      const at = await ev(() => [currentView, viewContext.date]);
      assert.deepEqual(at, ['session-day', iso], `well ${i} opens its own day (past and future alike)`);
    }
    // A planned day that went by untrained: an empty floor, never red, and the legend names it.
    await ev(() => { DB.sessions.listAll().filter((x) => x.date === '2026-09-28').forEach((x) => DB.sessions.remove(x.id)); });
    await back();
    const m = await ev(() => {
      const c = document.querySelectorAll('.view.active .prg-col')[1]; const a = getComputedStyle(c.querySelector('.prg-well'), '::after');
      const probe = document.createElement('span'); probe.style.color = 'var(--text-mute)'; c.appendChild(probe); const mute = getComputedStyle(probe).color; probe.remove();
      return { st: c.classList.contains('is-missed'), floor: parseFloat(a.height), bg: a.backgroundColor, mute, legend: [...document.querySelectorAll('.view.active .prg-legend .prg-lg:not(.prg-lg-num)')].map((n) => n.textContent.trim()), word: t('prg_lg_missed') };
    });
    assert.equal(m.st, true, 'Monday is missed now');
    assert.equal(m.floor, 2, 'a missed well shows a 2px floor');
    assert.equal(m.bg, m.mute, 'the floor is --text-mute, never red');
    assert.equal(m.legend[m.legend.length - 1], m.word, 'the legend adds «missed» once a missed well is on screen');
    void s;
  }],

  ['the ribbon marks the current slot and is not a control; the labelled edit button opens the planner', async ({ page, ev, back }) => {
    await ev(seedAll); await back();
    const g = await ev(() => {
      const r = document.querySelector('.view.active .prg-ribbon');
      const cur = DB.plan.get().cycle.indexOf(DB.plan.workoutForDate(new Date()));
      return {
        segs: [...r.querySelectorAll('.prg-seg')].map((s) => ({ n: s.querySelector('.prg-seg-n')?.textContent.trim(), name: s.querySelector('.prg-seg-name')?.textContent.trim(), cur: s.classList.contains('is-current'), aria: s.getAttribute('aria-current') })),
        want: DB.plan.get().cycle.map((c, i) => ({ n: String(i + 1), name: planDayName(c.name), cur: i === cur, aria: i === cur ? 'step' : null })),
        controls: r.querySelectorAll('button, a, input, [tabindex]').length,
        border: getComputedStyle(r.querySelector('.prg-seg')).borderTopWidth,
        // What a reader hears: the number and the name as two words, not «1Push».
        spoken: [...r.querySelectorAll('.prg-seg')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()),
        wantSpoken: DB.plan.get().cycle.map((c, i) => `${i + 1} — ${planDayName(c.name)}`),
        // Every figure and name on a segment or a tile is small text: 4.5:1 on its own fill.
        low: [...document.querySelectorAll('.view.active .prg-seg, .view.active .prg-tile')].flatMap((box) => [...box.querySelectorAll('.prg-seg-n, .prg-seg-name:not(.sr-only), .prg-tile-day, .prg-tile-n, .prg-tile-name')]
          .map((n) => ({ what: n.className + ' in ' + box.className, k: contrastOf(getComputedStyle(n).color, getComputedStyle(box).backgroundColor) }))
          .filter((x) => !(x.k >= 4.5)).map((x) => `${x.what} ${x.k.toFixed(2)}:1`)),
      };
    });
    assert.deepEqual(g.segs, g.want, 'one segment per slot, the current one raised and marked');
    assert.deepEqual(g.spoken, g.wantSpoken, 'each segment reads «N — name»');
    assert.deepEqual(g.low, [], 'every text on the ribbon and the tiles reaches 4.5:1');
    assert.equal(g.controls, 0, 'nothing in the ribbon is reachable as a control');
    assert.equal(g.border, '0px', 'a segment has no border — a border means interactive');
    await page.locator('.view.active .prg-ribbon .prg-seg').first().click();
    assert.equal(await ev(() => currentView), 'workouts', 'tapping the ribbon goes nowhere');
    await page.locator('.view.active .prg-edit[data-goto="planner"]').click();
    assert.equal(await ev(() => currentView), 'planner', 'the edit button opens the planner in one tap');
  }],

  ['the upcoming tiles are the next training days by workoutForDate, today\'s first, and each opens its day', async ({ page, ev, back }) => {
    await ev(seedAll); await back();
    const g = await ev(() => {
      const want = [];
      const cycle = DB.plan.get().cycle;
      for (let i = 0; i < 28 && want.length < DB.plan.get().trainingDays.length; i++) {
        const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
        const w = DB.plan.workoutForDate(d);
        if (w) want.push({ iso: addDaysISO(todayISO(), i), day: i === 0 ? t('today') : dayName(d.getDay()), n: String(cycle.indexOf(w) + 1), name: planDayName(w.name), today: i === 0 });
      }
      const got = [...document.querySelectorAll('.view.active .prg-tile')].map((b) => ({ iso: b.dataset.dayIso, day: b.querySelector('.prg-tile-day')?.textContent.trim(), n: b.querySelector('.prg-tile-n')?.textContent.trim(), name: b.querySelector('.prg-tile-name')?.textContent.trim(), today: b.classList.contains('is-today') }));
      const todayTile = document.querySelector('.view.active .prg-tile.is-today');
      return { want, got, bg: todayTile ? getComputedStyle(todayTile).backgroundColor : null };
    });
    assert.deepEqual(g.got, g.want, 'the tiles are the next trainingDays.length training days');
    assert.equal(g.bg, 'rgb(255, 106, 0)', 'today\'s tile is the one solid ember tile');
    await page.locator('.view.active .prg-tile').nth(1).click();
    assert.deepEqual(await ev(() => [currentView, viewContext.date]), ['session-day', g.want[1].iso], 'a tile opens its day in one tap');
  }],

  ['a pulled-forward day shows the undo line under the ribbon, and undo restores the rotation', async ({ page, ev, back }) => {
    const before = await ev(() => {
      seedAll();
      // Thursday is not a training day in this case's rotation; pull TODAY (a
      // Wednesday taken off the list) forward instead.
      const p = DB.plan.get();
      DB.plan.setRotation({ cycle: p.cycle, trainingDays: [0, 1, 5, 6], anchor: p.anchor });
      const snap = () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); const w = DB.plan.workoutForDate(d); return w ? w.name : null; });
      const plain = snap();
      DB.plan.setExtra(new Date(), true);
      return { plain, moved: snap() };
    });
    assert.notDeepEqual(before.moved, before.plain, 'the pull-forward moved the rotation (the precondition)');
    await back();
    const g = await ev(() => ({ line: !!document.querySelector('.view.active .prg-moved #program-undo-extra'), text: document.querySelector('.view.active .prg-moved')?.textContent.replace(/\s+/g, ' ').trim(), want: t('program_moved'), afterRibbon: document.querySelector('.view.active .prg-ribbon')?.nextElementSibling?.classList.contains('prg-moved') }));
    assert.equal(g.line, true, 'the undo line is on the page');
    assert.ok(g.text.includes(g.want), 'it says what happened');
    assert.equal(g.afterRibbon, true, 'directly under the ribbon it shifted');
    // Undo moves the FUTURE days: today's pulled-forward workout goes back to
    // the next training day, so the current slot, and the order of the names
    // on the tiles, are the same before and after; only the dates move. The
    // motion must say exactly that: the ribbon's tick stays put, the tiles'
    // numbers and names stay put, and the day labels are what change.
    const flip = await ev(() => {
      const v = document.querySelector('.view.active');
      const read = () => ({
        cur: [...v.querySelectorAll('.prg-seg')].findIndex((s) => s.classList.contains('is-current')),
        names: [...v.querySelectorAll('.prg-tile')].map((b) => b.querySelector('.prg-tile-n').textContent.trim() + ' ' + b.querySelector('.prg-tile-name').textContent.trim()),
        days: [...v.querySelectorAll('.prg-tile .prg-tile-day')].map((n) => n.textContent.trim()),
      });
      const was = read();
      v.querySelector('#program-undo-extra').click();
      const now = read();
      const moving = (sel) => [...v.querySelectorAll(sel)].filter((n) => n.getAnimations().length).length;
      const tick = v.querySelector('.prg-seg.is-current');
      return {
        was, now, unshift: !!v.querySelector('.prg-ribbon.is-unshift'),
        tickMoving: tick ? document.getAnimations().filter((a) => a.effect && a.effect.target === tick && a.effect.pseudoElement === '::before').length : 0,
        namesMoving: moving('.prg-tile .prg-tile-n, .prg-tile .prg-tile-name'), daysMoving: moving('.prg-tile .prg-tile-day'),
      };
    });
    assert.equal(flip.now.cur, flip.was.cur, 'the current slot is the same after undo (the precondition of the motion)');
    assert.deepEqual(flip.now.names, flip.was.names, 'and so is the sequence of workouts on the tiles');
    assert.notDeepEqual(flip.now.days, flip.was.days, 'only the days they fall on changed');
    assert.deepEqual([flip.unshift, flip.tickMoving], [false, 0], 'the ribbon\'s tick does not slide: the cycle did not step back');
    assert.equal(flip.namesMoving, 0, 'the tiles\' numbers and names do not shift: they did not change');
    assert.ok(flip.daysMoving > 0, 'the day labels, which did change, are what moves');
    const after = await ev(() => ({ extra: DB.plan.isExtra(new Date()), rot: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); const w = DB.plan.workoutForDate(d); return w ? w.name : null; }), toast: document.querySelector('.toast.show')?.textContent || '', want: t('anyway_undone'), view: currentView }));
    assert.equal(after.extra, false, 'undo clears the pulled-forward day');
    assert.deepEqual(after.rot, before.plain, 'and the rotation is exactly where it was');
    assert.ok(after.toast.includes(after.want), 'the toast says so');
    assert.equal(after.view, 'workouts');
    await page.waitForFunction(() => !document.querySelector('.view.active .prg-moved'), null, { timeout: 2000 });
  }],

  ['the cardio lane opens the schedule sheet to add and to edit', async ({ page, ev, back }) => {
    const s = await ev(seedAll); await back();
    const row = await ev(() => { const b = document.querySelector('.view.active #cardio-sched-list [data-cardio-sched-edit]'); return { fig: b?.querySelector('.fig-row-num')?.textContent.trim(), aria: b?.getAttribute('aria-label') || '', spoken: spokenMinutes(30) }; });
    assert.equal(row.fig, '0:30', 'the duration is a clock reading (H:MM)');
    assert.ok(row.aria.includes(row.spoken), 'and it is spoken in words: ' + row.aria);
    await page.locator('.view.active #cardio-sched-list [data-cardio-sched-edit]').click();
    await page.waitForSelector('#modal-root .modal-overlay:not(.is-out) #cs-duration');
    assert.equal(await page.locator('#cs-duration').inputValue(), '30', 'a row opens its own schedule');
    await back();
    await page.locator('.view.active #cardio-sched-list [data-cardio-sched-add]').click();
    await page.waitForSelector('#modal-root .modal-overlay:not(.is-out) #cs-duration');
    assert.equal(await page.locator('#cs-duration').inputValue(), '', 'the add opens an empty schedule');
    assert.equal(await page.locator('#modal-root .modal-title').last().innerText(), await ev(() => t('cardio_sched_add')));
    void s;
  }],

  ['the muscle wells carry the last 7 days\' counts and open that muscle', async ({ page, ev, back }) => {
    // The window's two edges: 24 Sep is the sixth day before today and counts;
    // 23 Sep is the seventh before, an eighth calendar day, and does not.
    const s = await ev(() => {
      const r = seedAll();
      const press = DB.exercises.add({ name: 'QA Press', category: 'Shoulders' }).id, plank = DB.exercises.add({ name: 'QA Plank', category: 'Core' }).id;
      DB.sessions.add({ exerciseId: press, date: '2026-09-24', sets: [{ weight: 5, reps: 5 }] });
      DB.sessions.add({ exerciseId: plank, date: '2026-09-23', sets: [{ weight: 5, reps: 5 }] });
      return { ...r, muscles: { ...r.muscles, Shoulders: 1 } };
    });
    await back();
    const g = await ev(() => [...document.querySelectorAll('.view.active .prg-mw')].map((b) => ({ cat: b.dataset.muscle, n: b.querySelector('.prg-mw-n')?.textContent.trim(), name: b.querySelector('.prg-mw-name')?.textContent.trim(), want: categoryLabel(b.dataset.muscle), fill: b.querySelector('.prg-mw-fill') ? b.querySelector('.prg-mw-fill').getBoundingClientRect().height : 0 })));
    assert.deepEqual(g.map((x) => x.cat), ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'], 'six wells, every category but Other');
    assert.deepEqual(Object.fromEntries(g.map((x) => [x.cat, Number(x.n)])), s.muscles, 'each well carries its session count');
    assert.ok(g.every((x) => x.name === x.want), 'each is named');
    assert.ok(g.filter((x) => x.n === '0').every((x) => x.fill === 0), 'a zero is an empty well');
    assert.ok(g.filter((x) => x.n !== '0').every((x) => x.fill > 0), 'a count fills its well');
    await page.locator('.view.active .prg-mw[data-muscle="Legs"]').click();
    assert.deepEqual(await ev(() => [currentView, viewContext.muscleCat]), ['muscle-sessions', 'Legs']);
  }],

  ['the records are the top three by estimated 1RM; «all records» and each record open their pages', async ({ page, ev, back }) => {
    const s = await ev(seedAll); await back();
    const g = await ev(() => [...document.querySelectorAll('.view.active .prg-rec')].map((b) => ({ id: b.dataset.exerciseId, name: b.querySelector('.prg-rec-name')?.textContent.trim(), orm: b.querySelector('.prg-rec-orm')?.textContent.trim(), html: b.querySelector('.prg-rec-name')?.innerHTML })));
    assert.deepEqual(g.map((x) => x.id), s.records, 'the three heaviest by 1RM, heaviest first');
    assert.equal(g[0].name, 'QA <i>Dead</i>', 'an exercise name is printed, never parsed');
    assert.ok(!/<i>/.test(g[0].html), 'escaped');
    assert.deepEqual(g.map((x) => x.orm), s.orm.map((n) => '1RM ≈ ' + n), 'with its estimated 1RM');
    await page.locator('.view.active .prg-all[data-goto="personal-records"]').click();
    assert.equal(await ev(() => currentView), 'personal-records');
    await back();
    await page.locator('.view.active .prg-rec').nth(1).click();
    assert.deepEqual(await ev(() => [currentView, viewContext.exerciseId]), ['exercise-detail', s.records[1]], 'a record opens its exercise');
    // The three weights are read across as one row: a name that wraps to two
    // lines must not push its weight below its neighbours'.
    await ev((id) => DB.exercises.update(id, { name: 'QA Incline Dumbbell Bench Press Heavy' }), s.ex.bench);
    await back();
    const row = await ev(() => [...document.querySelectorAll('.view.active .prg-rec')].map((b) => ({ lines: (() => { const r = document.createRange(); r.selectNodeContents(b.querySelector('.prg-rec-name')); return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size; })(), w: Math.round(b.querySelector('.prg-rec-w .num').getBoundingClientRect().top), orm: Math.round(b.querySelector('.prg-rec-orm').getBoundingClientRect().top) })));
    assert.ok(row.some((x) => x.lines >= 2) && row.some((x) => x.lines === 1), 'precondition: one name wraps, another does not: ' + JSON.stringify(row));
    assert.equal(new Set(row.map((x) => x.w)).size, 1, 'the three weights share one line: ' + JSON.stringify(row));
    assert.equal(new Set(row.map((x) => x.orm)).size, 1, 'and so do the three 1RM lines: ' + JSON.stringify(row));
    // In pounds the records speak the user's unit, through the one kg↔lb rule.
    try {
      await ev(() => DB.prefs.setUnit('lb'));
      await back();
      const lb = await ev(() => { const b = document.querySelector('.view.active .prg-rec'); return { w: b.querySelector('.prg-rec-w .num').textContent.trim(), u: b.querySelector('.prg-rec-u').textContent.trim(), orm: b.querySelector('.prg-rec-orm').textContent.trim(), want: fmtNum(toDisplayWeight(140, 'lb')), wantOrm: t('prg_orm').replace('{n}', fmtNum(toDisplayWeight(Math.round(140 * (1 + 5 / 30)), 'lb'))) }; });
      assert.deepEqual([lb.w, lb.u], [lb.want, 'lb'], 'the heaviest record in pounds');
      assert.equal(lb.orm, lb.wantOrm, 'and its 1RM in pounds');
    } finally { await ev(() => DB.prefs.setUnit('kg')); }
  }],

  ['with no plan: «build my program» opens the planner, and the cardio lane stays', async ({ page, ev, back }) => {
    await ev(() => { seedAll(); DB.plan.setRotation({ cycle: [], trainingDays: [], anchor: todayISO() }); });
    await back();
    const g = await ev(() => {
      const v = document.querySelector('.view.active');
      const b = v.querySelector('.prg-plan [data-goto="planner"]');
      return {
        btn: b?.textContent.replace(/\s+/g, ' ').trim(), want: t('program_build'), title: v.querySelector('.prg-noplan')?.textContent.replace(/\s+/g, ' ').trim(), wantTitle: t('program_no_plan_title'),
        ribbon: !!v.querySelector('.prg-ribbon'), tiles: v.querySelectorAll('.prg-tile').length,
        lane: !!v.querySelector('.prg-plan #cardio-sched-list [data-cardio-sched-add]'),
        of: !!v.querySelector('.prg-week .prg-of'), left: !!v.querySelector('.prg-week .prg-left'), num: v.querySelector('.prg-week .trk-num')?.textContent.trim() ?? '',
        unit: v.querySelector('.prg-week .trk-unit')?.textContent.trim(),
        // Formal Arabic names one and two with the noun alone (B6): no «2 يومين».
        wantNum: DB.prefs.get().lang === 'ar' ? '' : '2', wantUnit: DB.prefs.get().lang === 'ar' ? 'يومان' : 'days',
        doors: [...v.querySelectorAll('.prg-week .prg-col[data-day-iso]')].map((c) => c.dataset.dayIso),
        ring: [...v.querySelectorAll('.prg-week .prg-col')].some((c) => c.classList.contains('is-today') || c.classList.contains('is-planned') || c.classList.contains('is-missed')),
        // Nothing is planned, so no day is called a rest day.
        rest: [...v.querySelectorAll('.prg-week .prg-col')].filter((c) => c.textContent.includes(t('rest_day'))).length,
      };
    });
    assert.equal(g.btn, g.want); assert.ok(g.title.includes(g.wantTitle), 'the empty state says there is no program yet');
    assert.equal(g.ribbon, false); assert.equal(g.tiles, 0);
    assert.equal(g.lane, true, 'cardio can be scheduled without a lifting plan');
    assert.deepEqual([g.of, g.left, g.num, g.unit], [false, false, g.wantNum, g.wantUnit], 'the figure is the days trained, with no denominator and no days left, in its count form');
    assert.deepEqual(g.doors, ['2026-09-27', '2026-09-28'], 'a well is a door only where a session exists');
    assert.equal(g.ring, false, 'no ring, no outline, no floor without a plan');
    assert.equal(g.rest, 0, 'without a plan no well is announced as a rest day');
    await page.locator('.view.active .prg-plan [data-goto="planner"]').click();
    assert.equal(await ev(() => currentView), 'planner');
    // After a fraction the unit is one plural that agrees with no single number
    // («2/2 أيام»), never the dual after a figure («2/2 يومين»).
    await ev(() => DB.plan.setRotation({ cycle: [{ name: 'Push', exerciseIds: [] }, { name: 'Pull', exerciseIds: [] }], trainingDays: [0, 1], anchor: '2026-09-20' }));
    await back();
    const two = await ev(() => { const w = document.querySelector('.view.active .prg-week'); return [w.querySelector('.trk-num')?.textContent.trim(), w.querySelector('.prg-of')?.textContent.trim(), w.querySelector('.trk-unit')?.textContent.trim(), t('prg_days_n')]; });
    assert.deepEqual(two.slice(0, 3), ['2', '/2', two[3]], 'a two-day plan reads «2/2» and the plural');
  }],

  ['nothing overflows or is clipped at 375 and 340 px, normal and «Larger text»', async ({ page, ev, back }) => {
    // Monday missed, so the legend carries its longest set of words.
    await ev(() => { seedAll(); DB.sessions.listAll().filter((x) => x.date === '2026-09-28').forEach((x) => DB.sessions.remove(x.id)); });
    const probs = [];
    try {
      for (const w of [375, 340]) for (const lg of [false, true]) {
        await page.setViewportSize({ width: w, height: 812 });
        await ev((lg) => { DB.prefs.setTextLg(lg); document.body.classList.toggle('text-lg', lg); }, lg);
        await back();
        const p = await ev(() => {
          const out = [];
          const v = document.querySelector('.view.active');
          if (v.querySelectorAll('.prg-card').length !== 3) out.push('three plates expected, found ' + v.querySelectorAll('.prg-card').length);
          if (document.documentElement.scrollWidth > innerWidth + 0.5 || document.querySelector('.main').scrollWidth > document.querySelector('.main').clientWidth + 0.5) out.push('horizontal page overflow');
          for (const plate of v.querySelectorAll('.prg-card')) {
            const pr = plate.getBoundingClientRect();
            if (pr.left < -0.5 || pr.right > innerWidth + 0.5) out.push(plate.className + ' leaves the screen');
            for (const n of plate.querySelectorAll('*')) {
              if (!n.getClientRects().length || n.closest('.sr-only') || n.classList.contains('sr-only')) continue;
              if (n.closest('.prg-tiles') && n !== n.closest('.prg-tiles')) continue;   // the tile row may scroll (6–7 days); its own box is checked
              const r = n.getBoundingClientRect();
              if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5) out.push((n.className || n.tagName) + ' pokes out of its plate (' + Math.round(r.left) + '–' + Math.round(r.right) + ' in ' + Math.round(pr.left) + '–' + Math.round(pr.right) + ')');
              const cs = getComputedStyle(n);
              if (/hidden|clip/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) out.push((n.className || n.tagName) + ' clips its text sideways (' + n.scrollWidth + ' > ' + n.clientWidth + '): «' + n.textContent.trim().slice(0, 30) + '»');
              // The legend is ONE line by design: its last note drops out of
              // sight where it would wrap (checked item by item below).
              if (n.classList.contains('prg-legend')) continue;
              if (/hidden|clip/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) out.push((n.className || n.tagName) + ' clips its text vertically (' + n.scrollHeight + ' > ' + n.clientHeight + ')');
            }
          }
          // The legend: every state word on its one line and whole; the number
          // note either whole on that line or wholly out of sight, never cut.
          const lg = v.querySelector('.prg-legend');
          if (lg) {
            const box = lg.getBoundingClientRect(), items = [...lg.querySelectorAll('.prg-lg')];
            const first = items[0].getBoundingClientRect().top;
            for (const it of items) {
              const r = it.getBoundingClientRect(), shown = r.top < box.bottom - 1;
              const note = it.classList.contains('prg-lg-num');
              if (!note && (Math.abs(r.top - first) > 1 || r.bottom > box.bottom + 0.5)) out.push('the legend word «' + it.textContent.trim() + '» is not on the legend\'s one line');
              if (note && shown && (Math.abs(r.top - first) > 1 || r.bottom > box.bottom + 0.5)) out.push('the legend\'s number note is cut');
            }
            const note = lg.querySelector('.prg-lg-num');
            if (innerWidth >= 375 && !document.body.classList.contains('text-lg') && !(note && note.getBoundingClientRect().top < box.bottom - 1)) out.push('the legend\'s number note is out of sight at 375px');
          }
          // the muscle hint shares ONE line with its caption (the owner: only where it fits)
          const hint = v.querySelector('.prg-hint'), cap = hint && hint.parentElement.querySelector('.trk-cap-lab');
          if (hint && cap && hint.getClientRects().length && Math.abs(hint.getBoundingClientRect().top - cap.getBoundingClientRect().top) > 4) out.push('the muscle hint wrapped under its caption');
          if (innerWidth >= 375 && !(hint && hint.getClientRects().length)) out.push('the muscle hint is missing at 375px');
          return out;
        });
        probs.push(...p.map((x) => `${w}px${lg ? ' larger' : ''}: ${x}`));
      }
    } finally {
      await page.setViewportSize({ width: 375, height: 812 });
      await ev(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
    }
    assert.deepEqual([...new Set(probs)], [], 'no overflow and nothing clipped');
  }],

  ['every control on the page reaches 44 by 44 where a finger lands, at 375 and 340 px', async ({ page, ev, back }) => {
    await ev(() => { seedAll(); const p = DB.plan.get(); DB.plan.setRotation({ cycle: p.cycle, trainingDays: [0, 1, 5, 6], anchor: p.anchor }); DB.plan.setExtra(new Date(), true); });
    const sels = ['.prg-col[data-day-iso]', '.prg-edit', '#program-undo-extra', '.prg-tile', '#cardio-sched-list [data-cardio-sched-edit]', '#cardio-sched-list [data-cardio-sched-add]', '.prg-mw', '.prg-all', '.prg-rec'];
    const small = [];
    try {
      for (const width of [375, 340]) {
        await page.setViewportSize({ width, height: 812 });
        await back();
        small.push(...(await ev(measureReach, sels)).map((x) => width + 'px: ' + x));
      }
    } finally { await page.setViewportSize({ width: 375, height: 812 }); }
    assert.deepEqual([...new Set(small)], [], 'every control reaches 44x44 from its centre (its box or its ::after halo)');
  }],

  ['seven slots on seven days: a compact ribbon, scrolling tiles that start where the ribbon starts with their focus rings whole, and a hostile slot name printed as text', async ({ page, ev, back }) => {
    const HOSTILE = '<img src=x onerror="window.__prgPwn=1">';
    await ev((h) => {
      seedAll();
      const names = [h, 'Pull', 'Legs', 'Push B', 'Pull B', 'Legs B', 'Arms'];
      DB.plan.setRotation({ cycle: names.map((name) => ({ name, exerciseIds: [] })), trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: '2026-09-30' });
    }, HOSTILE);
    await back();
    await page.waitForTimeout(250);   // the row's snap settles
    const edges = () => ev(() => {
      const v = document.querySelector('.view.active');
      const row = v.querySelector('.prg-tiles'), rib = v.querySelector('.prg-ribbon');
      const rtl = getComputedStyle(row).direction === 'rtl';
      const start = (el) => { const r = el.getBoundingClientRect(); return Math.round(rtl ? r.right : r.left); };
      const end = (el) => { const r = el.getBoundingClientRect(); return Math.round(rtl ? r.left : r.right); };
      // :focus-visible is a 2px outline 2px out: 4px round the tile must lie inside the row's clip.
      const whole = (el) => { const r = el.getBoundingClientRect(), c = row.getBoundingClientRect(); return r.left - 4 >= c.left - 0.5 && r.right + 4 <= c.right + 0.5 && r.top - 4 >= c.top - 0.5 && r.bottom + 4 <= c.bottom + 0.5; };
      return { rtl, first: [start(row.firstElementChild), start(rib)], last: [end(row.lastElementChild), end(rib)], firstWhole: whole(row.firstElementChild), lastWhole: whole(row.lastElementChild) };
    });
    const atStart = await edges();
    assert.equal(atStart.firstWhole, true, 'the first tile\'s focus ring is not clipped by the scrolling row');
    assert.deepEqual(atStart.first, [atStart.first[1], atStart.first[1]], `the first tile starts where the ribbon starts (${atStart.rtl ? 'right' : 'left'} edges ${atStart.first.join(' vs ')})`);
    await ev(() => { const row = document.querySelector('.view.active .prg-tiles'); row.scrollLeft = getComputedStyle(row).direction === 'rtl' ? -row.scrollWidth : row.scrollWidth; });
    await page.waitForTimeout(250);
    const atEnd = await edges();
    assert.deepEqual(atEnd.last, [atEnd.last[1], atEnd.last[1]], `scrolled to the end, the last tile ends where the ribbon ends (${atEnd.last.join(' vs ')})`);
    assert.equal(atEnd.lastWhole, true, 'and its focus ring is whole');
    const g = await ev((h) => {
      const v = document.querySelector('.view.active');
      return {
        segs: v.querySelectorAll('.prg-seg').length, compact: v.querySelector('.prg-ribbon').classList.contains('is-compact'),
        cur: v.querySelector('.prg-seg-cur')?.textContent.trim(), tiles: v.querySelectorAll('.prg-tile').length, scroll: v.querySelector('.prg-tiles').classList.contains('is-scroll'),
        firstName: v.querySelector('.prg-tile .prg-tile-name')?.textContent.trim(), segName: v.querySelector('.prg-seg .prg-seg-name')?.textContent.trim(),
        img: v.querySelectorAll('img').length, pwn: window.__prgPwn === 1, overflow: document.documentElement.scrollWidth > innerWidth + 0.5, h,
      };
    }, HOSTILE);
    assert.deepEqual([g.segs, g.compact, g.tiles, g.scroll], [7, true, 7, true], 'seven segments in compact form, seven scrolling tiles');
    assert.deepEqual([g.cur, g.firstName, g.segName], [HOSTILE, HOSTILE, HOSTILE], 'the slot name is printed as text under the ribbon, on the tile and for a reader');
    assert.deepEqual([g.img, g.pwn, g.overflow], [0, false, false], 'no element was made of it, nothing ran, and the page does not scroll sideways');
  }],

  ['a slot or exercise name in the other script keeps its own direction, so an ellipsis cuts its end', async ({ ev, back }) => {
    const lang = await ev(() => DB.prefs.get().lang);
    await ev((lang) => {
      const s = seedAll();
      const other = lang === 'ar' ? ['Upper Body Strength', 'Lower Body Power', 'Full Body Conditioning'] : ['تمرين الجزء العلوي للقوة', 'تمرين الجزء السفلي للقدرة', 'تمرين الجسم كاملاً للتحمل'];
      const p = DB.plan.get();
      DB.plan.setRotation({ cycle: p.cycle.map((c, i) => ({ name: other[i], exerciseIds: c.exerciseIds })), trainingDays: p.trainingDays, anchor: p.anchor });
      DB.exercises.update(s.ex.dead, { name: lang === 'ar' ? 'QA Romanian Deadlift From A Deficit' : 'رفعة ميتة رومانية من منصة عالية' });
    }, lang);
    await back();
    const g = await ev((lang) => {
      const v = document.querySelector('.view.active');
      const foreign = lang === 'ar' ? /[A-Za-z]/ : /[؀-ۿ]/;
      const want = lang === 'ar' ? 'ltr' : 'rtl';
      const els = [...v.querySelectorAll('.prg-seg-name, .prg-tile-name, .prg-rec-name')].filter((n) => foreign.test(n.textContent));
      return {
        kinds: [...new Set(els.map((n) => n.className.split(' ')[0]))].sort(), cut: els.filter((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1).length,
        wrong: els.filter((n) => getComputedStyle(n).direction !== want).map((n) => `${n.className} «${n.textContent.trim()}» ${getComputedStyle(n).direction}`),
      };
    }, lang);
    assert.deepEqual(g.kinds, ['prg-rec-name', 'prg-seg-name', 'prg-tile-name'], 'precondition: a foreign-script name on the ribbon, a tile and a record');
    assert.ok(g.cut > 0, 'precondition: at least one of them is cut by its box');
    assert.deepEqual(g.wrong, [], 'each is set in its own direction');
  }],

  ['late in the week the days-left line counts only what the calendar still allows', async ({ page, ev, back }) => {
    try {
      await page.clock.setFixedTime(new Date('2026-10-02T07:00:00.000Z'));   // Friday: 2 of 4, Friday and Saturday still to come
      await ev(seedAll); await back();
      const fri = await ev(() => ({ left: document.querySelector('.view.active .prg-left')?.textContent.trim() ?? null, want: t('prg_left_2') }));
      assert.equal(fri.left, fri.want, 'Friday: two days are needed and two remain');
      await page.clock.setFixedTime(new Date('2026-10-03T07:00:00.000Z'));   // Saturday: 2 of 4, one day remains
      await back();
      const sat = await ev(() => document.querySelector('.view.active .prg-left')?.textContent.trim() ?? null);
      assert.equal(sat, null, 'Saturday: two are needed and one day remains, so no days-left line promises the week');
    } finally { await page.clock.setFixedTime(FIXED); }
  }],

  ['on a rest day the ribbon marks the next slot; pulled forward, today takes it; declined, a training day is a bare rest and its workout moves on', async ({ page, ev, back }) => {
    try {
      await page.clock.setFixedTime(new Date('2026-10-01T07:00:00.000Z'));   // Thursday, a rest day in the seed
      await ev(seedAll); await back();
      const read = () => ev(() => {
        const v = document.querySelector('.view.active'), cycle = DB.plan.get().cycle;
        const fri = new Date(); fri.setHours(12, 0, 0, 0); fri.setDate(fri.getDate() + 1);
        const col = v.querySelectorAll('.prg-col')[4];
        return {
          cur: [...v.querySelectorAll('.prg-seg')].findIndex((s) => s.classList.contains('is-current')), want: cycle.indexOf(DB.plan.workoutForDate(new Date()) || DB.plan.workoutForDate(fri)),
          today: [col.tagName, col.classList.contains('is-rest') ? 'rest' : col.classList.contains('is-today') ? 'today' : '?', col.dataset.dayIso || null],
          firstTile: v.querySelector('.prg-tile')?.dataset.dayIso, todayTile: !!v.querySelector('.prg-tile.is-today'), moved: !!v.querySelector('.prg-moved #program-undo-extra'),
        };
      });
      const thu = await read();
      assert.ok(thu.want >= 0, 'precondition: Friday carries a workout');
      assert.equal(thu.cur, thu.want, 'a rest day marks the NEXT slot to come');
      assert.deepEqual(thu.today, ['SPAN', 'rest', null], 'today\'s well is a bare rest, not a door');
      assert.deepEqual([thu.firstTile, thu.todayTile, thu.moved], ['2026-10-02', false, false], 'the tiles start on Friday');
      await ev(() => DB.plan.setExtra(new Date(), true)); await back();
      const x = await read();
      assert.equal(x.cur, thu.want, 'pulled forward, today carries the slot Friday was going to');
      assert.deepEqual(x.today, ['BUTTON', 'today', '2026-10-01'], 'today\'s well is ringed and a door');
      assert.deepEqual([x.firstTile, x.todayTile, x.moved], ['2026-10-01', true, true], 'the first tile is today, and the undo line is shown');
      // Declined: Wednesday, a training day, taken off.
      await page.clock.setFixedTime(FIXED);
      const planned = await ev(() => { seedAll(); return DB.plan.get().cycle.indexOf(DB.plan.workoutForDate(new Date())); });
      await ev(() => DB.plan.setRest(new Date(), true)); await back();
      const dec = await ev(() => {
        const v = document.querySelector('.view.active'), col = v.querySelectorAll('.prg-col')[3], tile = v.querySelector('.prg-tile');
        return { today: [col.tagName, col.classList.contains('is-rest')], tile: [tile?.dataset.dayIso, tile?.querySelector('.prg-tile-n')?.textContent.trim()] };
      });
      assert.deepEqual(dec.today, ['SPAN', true], 'a declined training day is a bare rest well');
      assert.deepEqual(dec.tile, ['2026-10-02', String(planned + 1)], 'and its workout moves to Friday\'s tile');
    } finally { await page.clock.setFixedTime(FIXED); }
  }],

  ['back from a finished workout, only today\'s well moves: its plate grows through the ring and the figure crossfades', async ({ ev, back, settled }) => {
    await ev(seedAll); await back();
    const first = await ev(() => document.querySelector('.view.active .prg-week').classList.contains('is-rep'));
    assert.equal(first, false, 'a first paint is not a rep');
    const g = await ev(() => {
      const bench = DB.exercises.list().find((e) => e.name === 'QA Bench').id;
      DB.sessions.add({ exerciseId: bench, date: todayISO(), sets: [{ weight: 100, reps: 5 }] });
      navigate('session-day', { date: todayISO() });
      navigate('workouts');
      const w = document.querySelector('.view.active .prg-week');
      return {
        rep: w.classList.contains('is-rep'), cols: [...w.querySelectorAll('.prg-col.is-rep')].map((c) => c.dataset.dayIso),
        was: w.querySelector('.prg-num-was')?.textContent.trim() ?? null, now: w.querySelector('.prg-frac > .trk-num')?.textContent.trim(),
        moving: [...w.querySelectorAll('.prg-col .prg-plate')].filter((p) => p.getAnimations().length).map((p) => p.closest('.prg-col').dataset.dayIso),
        enter: !!document.querySelector('.view.active.enter'),
      };
    });
    assert.equal(g.enter, true, 'the return is an arrival (the precondition)');
    assert.deepEqual([g.rep, g.cols], [true, ['2026-09-30']], 'today\'s well is the rep');
    assert.deepEqual(g.moving, ['2026-09-30'], 'and it is the only plate that moves');
    assert.deepEqual([g.was, g.now], ['2', '3'], 'the figure crossfades from its old value to the new one');
    await settled();
    const after = await ev(() => { renderView('workouts'); const w = document.querySelector('.view.active .prg-week'); return { rep: w.classList.contains('is-rep'), was: w.querySelectorAll('.prg-num-was').length }; });
    assert.deepEqual(after, { rep: false, was: 0 }, 'the next paint is an ordinary one');
  }],

  ['the arrival ends on the static frame, and under reduced motion that frame is all there is', async ({ browser, origin, lang, theme }) => {
    const kit = await openPage(browser, origin, { lang, theme, reduced: true });
    try {
      await kit.ev(seedAll);
      await kit.ev(() => { navStack = [{ view: 'home', context: {} }]; navigate('workouts'); });
      const g = await kit.ev(() => {
        const v = document.querySelector('.view.active');
        const moving = [...v.querySelectorAll('.prg-card, .prg-card *')].filter((n) => n.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().activeDuration > 1));
        const plate = v.querySelector('.prg-col.is-trained .prg-plate'), fig = v.querySelector('.prg-week .trk-fig');
        return { enter: !!document.querySelector('.view.active.enter, .view.active .enter'), moving: moving.map((n) => n.className), plate: getComputedStyle(plate).transform, fig: [getComputedStyle(fig).opacity, getComputedStyle(fig).transform], was: v.querySelectorAll('.prg-num-was').length };
      });
      assert.equal(g.enter, false, 'no stagger host under reduced motion');
      assert.deepEqual(g.moving, [], 'nothing is animating');
      assert.equal(g.plate, 'none', 'the plates stand at their height');
      assert.deepEqual(g.fig, ['1', 'none'], 'the figure is settled');
      assert.equal(g.was, 0, 'no crossfade figure is left in the DOM');
    } finally { kit.guard.assertContained(); await kit.ctx.close(); }
  }],
];

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0, ran = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;
        ran++;
        try { await fn({ ...kit, browser, origin }); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  program UI: ${failures.length} of ${ran} cases failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  program UI (${passed} cases, AR/dark + EN/light, 375px (340px for size), the clock fixed at Wed 30 Sep 2026 and moved to Thu/Fri/Sat where a case says so): three plates, every caption and legend word in both languages, the week figure (days trained / planned, one delta vs last week, the days left in their count form, no delta without last week), the seven wells (a trained day rises by its sets, today ringed, planned outlined, a missed floor and its legend word, every training or session day a door to its date, past and future), the ribbon (current slot marked, not a control) and the labelled edit button to the planner, the upcoming tiles by workoutForDate each opening its day, the pulled-forward line and its exact undo, the cardio lane (0:30, spoken; add and edit sheets), the six muscle wells with their 7-day counts opening muscle-sessions, the top three records by 1RM (escaped) with «all records» and each record opening its page, the no-plan state (build my program, the cardio lane kept), no overflow or clipping at 375/340 × normal/larger text, every control at 44x44, the rep moment (back from a workout only today's well moves, the figure crossfades), and the reduced-motion final frame; and from the review: an equal week prints no delta, the days-left line only while the calendar allows it, the planned outline and every ribbon/tile text at contrast, «N — name» for a reader, no «rest» without a plan, one and two as words with no plan and the plural after a fraction, the undo moving only the day labels, seven slots scrolling from the ribbon's edge with whole focus rings and a hostile name as text, foreign-script names in their own direction, the record weights on one line, pounds, a rest-day / pulled-forward / declined today, and the 7-day window`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
