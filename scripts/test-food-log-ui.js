#!/usr/bin/env node
// THE FOOD LOG'S DAY PAGE — a MINIATURE of the Food tab's hero for the day
// shown: the calorie ring and the three macro tracks drawn small, with the
// eaten items under it. On a CLOSED day (before today) the ring's big figure is
// the day's VERDICT, |target − eaten|, under «دون الهدف» / «فوق الهدف»; today it
// is the hero's own «متبقٍّ» / «زيادة». No water bar, no pencil, no click, and
// nothing that names the day — .day-nav already does. Without targets the four
// tiles stay exactly as they were, text-node patching included.
//
// Runs standalone (require.main guard) over fp/server.js on an EPHEMERAL port,
// the way test-sync-status-ui.js does, so it never collides with a sibling run.
// Playwright is external here, as everywhere in this project.
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, fence } = require('./fp/server.js');

const C = 339.29;                       // the r=54 ring, as js/food.js draws it
const TGT = { calories: 2000, protein: 150, carbs: 200, fat: 60 };
const UNDER = '2026-09-01';             // a closed day, always in the past
const OVER = '2026-08-20';              // another, eaten past its target
const ON = '2026-08-10';                // a closed day eaten EXACTLY to its target (L4)
const LEGACY = '2026-08-05';            // a closed day holding a row an older build stored unclamped (L3)
const LEGACY_TEXT = '2026-08-06';       // and one holding a non-numeric row (L3)
const EMPTY = '2026-08-01';             // a closed day with nothing logged (L5)
const WIDE = '2026-07-20';              // a closed day whose track figures are the widest realistic ones (L6)
const ROWS = {
  [UNDER]: [{ name: 'QA oats', calories: 600, protein: 40, carbs: 50, fat: 20 },
            { name: 'QA rice', calories: 500, protein: 30, carbs: 60, fat: 15 }],
  [OVER]:  [{ name: 'QA feast', calories: 1500, protein: 90, carbs: 150, fat: 50 },
            { name: 'QA cake', calories: 900, protein: 10, carbs: 120, fat: 30 }],
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);
// Every centre line inside its box (scrollWidth ≤ clientWidth) AND inside the
// ring's inner circle (its width ≤ the chord at its farthest edge, ±0.5px).
//
// FONT-AWARE (v405, M3): fence() aborts Google Fonts, so under the harness the
// figures are measured in the machine's monospace fallback, whose digits are
// narrower than JetBrains Mono's (~0.55em against ~0.6em) — a line that fits
// here can sit on the stroke on a phone. When the brand mono is NOT loaded,
// every measured width is multiplied by WIDER, a documented worst-case factor
// (the widest fallback-to-brand ratio measured, 1.09, with margin), so the
// check is conservative under the fallback and exact under the real face.
const WIDER = 1.12;
const fits = (c, where) => {
  assert.equal(c.centreEls, 3, `${where}: three centre lines (figure, label, sub)`);
  const k = c.mono ? 1 : WIDER;
  for (const n of c.centre) {
    assert.ok(n.scroll <= n.client, `${where}: «${n.text}» clips its box (${n.scroll} > ${n.client}, ring ${c.ringPx}px)`);
    assert.ok(n.inside, `${where}: «${n.text}» runs below the ring's inner circle`);
    assert.ok(n.width * k <= n.chord + 0.5, `${where}: «${n.text}» sits on the ring stroke (${n.width.toFixed(1)}px wide${k > 1 ? ` × ${k} for the missing brand mono = ${(n.width * k).toFixed(1)}` : ''}, ${n.chord.toFixed(1)}px chord, ring ${c.ringPx}px)`);
  }
};

// Targets on, the two closed days rebuilt from ROWS, today holding one 800 kcal row.
const seed = (page) => page.evaluate(({ TGT, ROWS }) => {
  DB.nutrition.setTargets(TGT);
  const wipe = (d) => DB.foodLogs.listForDate(d).forEach((r) => DB.foodLogs.remove(d, r.id));
  for (const d of Object.keys(ROWS)) {
    wipe(d);
    ROWS[d].forEach((r) => DB.foodLogs.add(d, Object.assign({ servings: 1, source: 'manual' }, r)));
  }
  const today = todayISO();
  wipe(today);
  DB.foodLogs.add(today, { name: 'QA today', servings: 1, calories: 800, protein: 50, carbs: 80, fat: 20, source: 'manual' });
  return today;
}, { TGT, ROWS });

const go = (page, date) => page.evaluate((date) => { closeModal(); navigate('foodlog', { date }); }, date);

// Everything the page says about the summary, read in one trip.
const card = (page) => page.evaluate(() => {
  const view = document.querySelector('.view.active');
  const q = (s) => view.querySelectorAll(s).length;
  const mini = view.querySelector('.nutri-mini');
  const fg = mini && mini.querySelector('.cal-ring-fg');
  const txt = (s) => (mini && mini.querySelector(s) ? mini.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    mini: q('.nutri-mini'), closed: q('.nutri-mini.closed'), host: q('#fl-summary'), tiles: q('.macro-totals'),
    water: q('.water-card'), pencil: q('.nutri-edit'), rows: q('[data-food-row]'),
    dash: fg ? parseFloat(fg.getAttribute('stroke-dasharray')) : null,
    ringOver: fg ? fg.classList.contains('over') : null,
    num: txt('.cal-ring-num'), label: txt('.cal-ring-label'), sub: txt('.cal-ring-sub'),
    tracks: mini ? [...mini.querySelectorAll('.macro-track')].map((t) => ({
      nums: t.querySelector('.macro-track-nums').textContent.replace(/\s+/g, ' ').trim(),
      width: parseFloat(t.querySelector('.macro-track-fill').style.width),
      leftLines: t.querySelectorAll('.macro-track-left').length,
    })) : [],
    cursor: mini ? getComputedStyle(mini).cursor : null,
    dayLabel: view.querySelector('.day-nav-label').textContent.trim(),
    // The bar's title shows only on .show-title (opacity 0 otherwise): the log
    // has no .page-title, so the bar title is the screen's only visible name.
    barTitle: q('.detail-top.show-title .detail-top-title'),
    // Where keyboard focus sits: a row's pencil inside the LIVE list, or not.
    focusPencil: !!(document.activeElement && document.activeElement.matches('[data-edit-food]') && view.contains(document.activeElement)),
    rowsText: [...view.querySelectorAll('#food-log-list .food-log-meta')].map((m) => m.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
    tilesText: (view.querySelector('.macro-totals') || {}).textContent ? view.querySelector('.macro-totals').textContent.replace(/\s+/g, ' ').trim() : null,
    emptyRing: fg ? fg.classList.contains('is-empty') : null,
    emptyTitle: (view.querySelector('#food-log-list .empty-title') || {}).textContent || null,
    // Is the brand mono actually LOADED? document.fonts.check() answers true for
    // a family with no registered face at all (nothing to load), which is
    // exactly the fenced case — so the FontFaceSet is read instead.
    mono: [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'JetBrains Mono' && f.status === 'loaded'),
    fontsCheck: document.fonts.check('11px "JetBrains Mono"'),
    // Each macro track's head: the name and the figures must each be ONE line,
    // and their ink (widened for a missing brand face) must share the head's width.
    heads: mini ? [...mini.querySelectorAll('.macro-track-head')].map((h) => {
      // LINES, not fragments: a range over «<span class=num>125.5</span> / <span class=num>150</span>g»
      // answers one rect per inline box, six on one line. Rows are counted by
      // vertical overlap, the way the ring-centre code above does.
      const one = (el) => {
        const r = document.createRange(); r.selectNodeContents(el);
        const rows = [];
        for (const x of r.getClientRects()) {
          if (!x.width) continue;
          const mid = (x.top + x.bottom) / 2, row = rows.find((y) => mid >= y.top && mid <= y.bottom);
          if (row) { row.top = Math.min(row.top, x.top); row.bottom = Math.max(row.bottom, x.bottom); } else rows.push({ top: x.top, bottom: x.bottom });
        }
        return rows.length;
      };
      const w = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
      const name = h.querySelector('.macro-track-name'), nums = h.querySelector('.macro-track-nums');
      return { name: name.textContent.trim(), nums: nums.textContent.replace(/\s+/g, ' ').trim(), nameLines: one(name), numsLines: one(nums), nameW: w(name), numsW: w(nums), headW: h.clientWidth };
    }) : [],
    // The three centre lines: nothing may run past its box, in either language,
    // at any scale — and nothing may cross the STROKE either. `chord` is the
    // inner circle's width at the line's farthest edge from the centre; a line
    // wider than that sits on the ring, which the box test alone cannot see.
    centre: mini ? (() => {
      const ring = mini.querySelector('.nutri-mini-ring').getBoundingClientRect();
      const cy = ring.top + ring.height / 2;
      const sw = parseFloat(getComputedStyle(fg).strokeWidth) * (ring.width / 120);
      const R = 54 * (ring.width / 120) - sw / 2;
      // Per LINE of ink, not per box: a sub that wraps its unit is a box as wide
      // as its max-width, while the ink on each line is what meets the stroke.
      return [...mini.querySelectorAll('.cal-ring-center > *')].flatMap((n) => {
        const range = document.createRange(); range.selectNodeContents(n);
        const lines = [];
        for (const r of range.getClientRects()) {
          if (!r.width) continue;
          const mid = (r.top + r.bottom) / 2;
          let L = lines.find((l) => mid >= l.top && mid <= l.bottom);
          if (!L) { L = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; lines.push(L); continue; }
          L.left = Math.min(L.left, r.left); L.right = Math.max(L.right, r.right);
          L.top = Math.min(L.top, r.top); L.bottom = Math.max(L.bottom, r.bottom);
        }
        const text = n.textContent.replace(/\s+/g, ' ').trim();
        return lines.map((L, i) => {
          const dy = Math.max(Math.abs(L.top - cy), Math.abs(L.bottom - cy));
          return { text: lines.length > 1 ? `${text} (line ${i + 1}/${lines.length})` : text, scroll: n.scrollWidth, client: n.clientWidth,
            width: L.right - L.left, chord: 2 * Math.sqrt(Math.max(0, R * R - dy * dy)), inside: dy <= R };
        });
      });
    })() : [],
    centreEls: mini ? mini.querySelectorAll('.cal-ring-center > *').length : 0,
    ringPx: mini ? mini.querySelector('.cal-ring-center').clientWidth : null,
    scale: getComputedStyle(document.body).getPropertyValue('--fs-scale').trim(),
    text: mini ? mini.textContent : '',
  };
});

// The Food tab's hero, read the same way, so the two can be compared field for field.
const hero = (page) => page.evaluate(() => {
  const h = document.querySelector('.view.active .nutri-hero');
  if (!h) return null;
  const txt = (s) => h.querySelector(s).textContent.replace(/\s+/g, ' ').trim();
  const fg = h.querySelector('.cal-ring-fg');
  return {
    num: txt('.cal-ring-num'), label: txt('.cal-ring-label'), sub: txt('.cal-ring-sub'),
    dash: parseFloat(fg.getAttribute('stroke-dasharray')), ringOver: fg.classList.contains('over'),
    tracks: [...h.querySelectorAll('.macro-track')].map((t) => ({
      nums: t.querySelector('.macro-track-nums').textContent.replace(/\s+/g, ' ').trim(),
      width: parseFloat(t.querySelector('.macro-track-fill').style.width),
      leftLines: t.querySelectorAll('.macro-track-left').length,
    })),
    water: document.querySelectorAll('.view.active .water-card').length,
    pencil: document.querySelectorAll('.view.active .nutri-edit').length,
    emptyRing: fg.classList.contains('is-empty'),
  };
});

// THE PIXEL AT 12 O'CLOCK (v405, L2). .cal-ring-fg has stroke-linecap: round,
// so a dash of 0 still paints a DOT of one stroke-width at the top of the ring.
// The DOM cannot see that — the attribute reads "0.0 339.3" either way — so the
// ring is rasterised: the live <svg> is cloned with each circle's computed
// stroke properties written inline (the stylesheet's tokens do not reach an
// <img>), drawn on a 120×120 canvas at viewBox scale, and the pixel at the
// stroke's centre line, (60, 6), is read back. On an empty day it must be the
// TRACK's colour, never the fill's.
const ringTop = (page, sel) => page.evaluate(async (sel) => {
  const svg = document.querySelector(sel + ' .cal-ring');
  if (!svg) return { error: 'no ring under ' + sel };
  const clone = svg.cloneNode(true);
  const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  for (const cls of ['cal-ring-bg', 'cal-ring-fg']) {
    const src = svg.querySelector('.' + cls), dst = clone.querySelector('.' + cls), cs = getComputedStyle(src);
    for (const p of ['stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'fill']) dst.style.setProperty(p, cs.getPropertyValue(p));
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '120'); clone.setAttribute('height', '120');
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  await img.decode();
  const cv = document.createElement('canvas'); cv.width = cv.height = 120;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const px = [...g.getImageData(60, 6, 1, 1).data];
  return { px: px.slice(0, 3), alpha: px[3], track: rgb(getComputedStyle(svg.querySelector('.cal-ring-bg')).stroke), fill: rgb(getComputedStyle(svg.querySelector('.cal-ring-fg')).stroke) };
}, sel);

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const shots = process.env.QA_SCREENSHOT_DIR;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message); console.error('PAGE ERROR:', e.message); });
    const net = await fence(page);
    await page.goto(origin + '/');
    await page.waitForFunction(() => typeof navigate === 'function');
    await page.evaluate(() => {
      DB.prefs.setOnboarded(); hideAuthGate(); document.getElementById('onboard-gate')?.remove();
      // The boot splash parts on its own clock; a page screenshot must not wait for it.
      document.getElementById('splash')?.remove();
      DB.prefs.setTextLg(false); document.body.classList.remove('text-lg');
    });
    const measured = { scaleMax: null, fonts: null, bands: [], mono: null, fontsCheck: null };

    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      await page.evaluate(({ lang, theme }) => { DB.prefs.setLang(lang); DB.prefs.setTheme(theme); applyLang(lang); applyTheme(theme); }, { lang, theme });
      const s = await page.evaluate(() => ({ under: t('fl_day_under'), over: t('fl_day_over'), left: t('nutri_left'), overNow: t('nutri_over'), cal: t('cal') }));
      assert.notEqual(s.under, 'fl_day_under', `${lang}: fl_day_under is in the dictionary`);
      assert.notEqual(s.over, 'fl_day_over', `${lang}: fl_day_over is in the dictionary`);
      const today = await seed(page);

      // (a) a closed day, eaten under its target: the verdict, the dash, the tracks
      await go(page, UNDER);
      let c = await card(page);
      assert.equal(c.closed, 1, `${lang}: a closed day renders the miniature hero (.nutri-mini.closed) — found ${c.closed}, with ${c.tiles} .macro-totals`);
      assert.equal(c.host, 1, `${lang}: the miniature sits in #fl-summary`);
      assert.equal(c.tiles, 0, `${lang}: with targets the four tiles are gone`);
      assert.equal(c.water, 0, `${lang}: no water card in the log`);
      assert.equal(c.pencil, 0, `${lang}: no pencil in the log`);
      assert.notEqual(c.cursor, 'pointer', `${lang}: the log's own card is not a target`);
      near(c.dash, C * Math.min(1, 1100 / 2000), 0.5, `${lang}: ring dash for 1100/2000`);
      assert.equal(c.ringOver, false, `${lang}: an under day's ring is not .over`);
      assert.equal(c.num, '900', `${lang}: the centre figure is |target − eaten|`);
      assert.equal(c.label, s.under, `${lang}: the label is the under-target verdict`);
      // No unit on the miniature's sub line (v405, M3): «868 / 2,300» — the
      // hero keeps «سعرة»/«cal»; here the unit was the width that met the stroke.
      assert.equal(c.sub, '1,100 / 2,000', `${lang}: the sub line is eaten / target, no unit`);
      assert.equal(c.tracks.length, 3, `${lang}: three macro tracks`);
      const want = [[70, 150], [110, 200], [35, 60]];
      c.tracks.forEach((tr, i) => {
        near(tr.width, Math.min(100, (want[i][0] / want[i][1]) * 100), 0.01, `${lang}: track ${i} width`);
        assert.equal(tr.nums, `${want[i][0]} / ${want[i][1]}g`, `${lang}: track ${i} figures`);
        assert.equal(tr.leftLines, 0, `${lang}: the miniature track has no third «left» line`);
      });
      assert.equal(c.rows, 2, `${lang}: the eaten rows are listed under the card`);
      assert.ok(!/undefined|fl_day_|nutri_/.test(c.text), `${lang}: every string resolves`);
      assert.ok(!c.text.includes(c.dayLabel), `${lang}: the card never repeats the date .day-nav already shows`);
      fits(c, `${lang}/scale ${c.scale}`);
      if (shots) await page.screenshot({ path: path.join(shots, `foodlog-past-${lang}-${theme}.png`) });

      // (b) today: the hero's own words — left, then over
      await go(page, today);
      c = await card(page);
      assert.equal(c.mini, 1, `${lang}: today renders the miniature`);
      assert.equal(c.closed, 0, `${lang}: today is not a closed day`);
      assert.equal(c.num, '1,200', `${lang}: today's figure is what is left`);
      assert.equal(c.label, s.left, `${lang}: today's label is nutri_left`);
      await page.evaluate((d) => DB.foodLogs.add(d, { name: 'QA second', servings: 1, calories: 1500, protein: 10, carbs: 10, fat: 10, source: 'manual' }), today);
      await go(page, today);
      c = await card(page);
      assert.equal(c.num, '300', `${lang}: today over by 300`);
      assert.equal(c.label, s.overNow, `${lang}: today's label is nutri_over`);
      assert.equal(c.ringOver, true, `${lang}: today's ring is .over when over`);

      // (h) the hero and the miniature read the same day through ONE arithmetic
      // (nutritionGauge): every figure, the dash and every track agree — and the
      // hero keeps what the miniature leaves out (water, pencil, the third line).
      await page.evaluate(() => { closeModal(); navigate('food'); });
      const h = await hero(page);
      assert.ok(h, `${lang}: the Food tab renders its hero with targets`);
      assert.equal(h.water, 1, `${lang}: the hero still has its water card`);
      assert.equal(h.pencil, 1, `${lang}: the hero still has its pencil`);
      const pick = (o) => ({ num: o.num, label: o.label, dash: o.dash, ringOver: o.ringOver, tracks: o.tracks.map((t) => [t.nums, t.width]) });
      assert.deepEqual(pick(h), pick(c), `${lang}: the hero and the miniature disagree about today`);
      assert.equal(h.sub, `${c.sub} ${s.cal}`, `${lang}: the hero's sub is the miniature's with its unit`);
      assert.ok(h.tracks.every((t) => t.leftLines === 1), `${lang}: the hero keeps its third «left» line`);

      // (c) a closed day eaten past its target
      await go(page, OVER);
      c = await card(page);
      assert.equal(c.closed, 1, `${lang}: the over day is closed`);
      assert.equal(c.ringOver, true, `${lang}: an over day's ring is .over`);
      near(c.dash, C, 0.5, `${lang}: the ring is full when over`);
      assert.equal(c.num, '400', `${lang}: over by 400`);
      assert.equal(c.label, s.over, `${lang}: the label is the over-target verdict`);
      near(c.tracks[1].width, 100, 0.01, `${lang}: a macro past its target caps at 100%`);

      // (g) the day arrows still move the day, and the card follows
      await go(page, UNDER);
      const before = (await card(page)).dayLabel;
      await page.locator('.view.active #day-next').click();
      c = await card(page);
      assert.notEqual(c.dayLabel, before, `${lang}: next moved the day`);
      assert.equal(c.closed, 1, `${lang}: the day after is still closed`);
      assert.equal(c.num, '2,000', `${lang}: an empty closed day is under by the whole target`);
      near(c.dash, 0, 0.5, `${lang}: an empty day's ring is empty`);
      await page.locator('.view.active #day-prev').click();
      await page.locator('.view.active #day-prev').click();
      c = await card(page);
      assert.notEqual(c.dayLabel, before, `${lang}: prev moved the day`);
      assert.equal(c.num, '2,000', `${lang}: the day before is empty too`);

      // (d) delete a row through the existing flow: the card re-renders with the new figure
      await go(page, UNDER);
      await page.locator('.view.active [data-del-food]').first().click();
      c = await card(page);
      assert.equal(c.rows, 1, `${lang}: one row left after the delete`);
      assert.equal(c.closed, 1, `${lang}: the card is still there after a delete`);
      assert.equal(c.num, '1,500', `${lang}: the verdict follows the delete (2000 − 500)`);
      near(c.dash, C * (500 / 2000), 0.5, `${lang}: the dash follows the delete`);
      assert.equal(c.sub, '500 / 2,000', `${lang}: the sub follows the delete`);
      near(c.tracks[0].width, (30 / 150) * 100, 0.01, `${lang}: the protein track follows the delete`);
      assert.ok(await page.locator('.toast-action').isVisible(), `${lang}: the delete still offers undo`);

      // (f) the largest text scale the app allows: nothing in the ring centre clips
      await seed(page);
      await page.evaluate(() => { DB.prefs.setTextLg(true); document.body.classList.toggle('text-lg', true); });
      for (const d of [UNDER, OVER]) {
        await go(page, d);
        c = await card(page);
        assert.equal(c.scale, '1.1', `${lang}: body.text-lg is the largest scale (--fs-scale ${c.scale})`);
        measured.scaleMax = c.scale;
        fits(c, `${lang}/${d}/scale ${c.scale}`);
      }
      measured.fonts = await page.evaluate(() => ['.cal-ring-num', '.cal-ring-label', '.cal-ring-sub'].map((s) => s + ' ' + getComputedStyle(document.querySelector('.nutri-mini ' + s)).fontSize));
      await page.evaluate(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });

      // (i) THE v405 FINDINGS, each one seen failing on v404 first. Collected
      // softly so ONE run names every one of them, then asserted together.
      const found = [];
      const soft = (name, fn) => { try { fn(); } catch (e) { found.push(`${lang}/${name}: ${e.message}`); } };
      await seed(page);

      // M1 — targets set while the row editor is OPEN (another tab wrote them;
      // the store-adopted repaint skips an open sheet): the save must draw the
      // miniature with the new figure, not patch tiles that are no longer the shape.
      await page.evaluate(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
      await go(page, UNDER);
      c = await card(page);
      soft('M1 precondition', () => assert.equal(c.tiles, 1, 'the day opens on the four tiles'));
      await page.locator('.view.active [data-edit-food]').first().click();
      await page.evaluate((TGT) => DB.nutrition.setTargets(TGT), TGT);
      await page.fill('#modal-root #fl-cal', '700');       // the 600 kcal oats row → 700
      await page.click('#modal-root #fl-save');
      c = await card(page);
      soft('M1', () => {
        assert.equal(c.mini, 1, `targets flipped while the editor was open: the save must render the miniature (found ${c.mini}, tiles ${c.tiles})`);
        assert.equal(c.num, '800', 'the miniature carries the saved figure (2000 − 1200)');
        near(c.dash, C * (1200 / 2000), 0.5, 'and its dash');
        // The re-render replaced the row the editor was opened from: focus
        // must land on the NEW row's pencil, never fall to <body>.
        assert.ok(c.focusPencil, 'after the re-rendering save, focus is on the saved row\'s pencil in the live list');
        assert.equal(c.barTitle, 1, 'the re-rendered day keeps its bar title shown (.detail-top.show-title)');
      });
      await page.evaluate(() => closeModal());
      // The day arrows re-render in place too: the bar title must survive them.
      await page.locator('.view.active #day-next').click();
      c = await card(page);
      soft('bar title after day-next', () => assert.equal(c.barTitle, 1, `a day arrow keeps the bar title shown (found ${c.barTitle})`));

      // L2 — an EMPTY ring paints no dot: a round-capped dash of 0 is a dot of
      // one stroke-width at 12 o'clock unless the fill stroke is switched off.
      await page.evaluate((d) => DB.foodLogs.listForDate(d).forEach((r) => DB.foodLogs.remove(d, r.id)), today);
      await go(page, EMPTY);
      c = await card(page);
      let top = await ringTop(page, '.view.active .nutri-mini');
      soft('L2 miniature', () => {
        near(c.dash, 0, 0.5, 'the day is empty');
        assert.deepEqual(top.px, top.track, `the pixel at the ring's top is the track colour (got ${top.px}, track ${top.track}, fill ${top.fill})`);
        assert.equal(c.emptyRing, true, 'an empty day\'s .cal-ring-fg carries .is-empty');
      });
      await page.evaluate(() => { closeModal(); navigate('food'); });
      const h2 = await hero(page);
      top = await ringTop(page, '.view.active .nutri-hero');
      soft('L2 hero', () => {
        near(h2.dash, 0, 0.5, 'today is empty');
        assert.deepEqual(top.px, top.track, `the hero's top pixel is the track colour (got ${top.px}, track ${top.track}, fill ${top.fill})`);
        assert.equal(h2.emptyRing, true, 'the hero\'s empty today carries .is-empty');
      });

      // L3 — rows older builds stored UNCLAMPED (a typed minus, a non-number):
      // planted straight into the blob, the way a legacy blob arrives.
      const planted = await page.evaluate(({ neg, abc }) => {
        const blob = JSON.parse(DB.exportJSON());
        blob.foodLogs[neg] = [{ id: 'qa-legacy-neg', name: 'QA legacy minus', servings: 1, calories: -300, protein: -10, carbs: 20, fat: 5, source: 'manual' }];
        blob.foodLogs[abc] = [{ id: 'qa-legacy-abc', name: 'QA legacy text', servings: 1, calories: 'abc', protein: 5, carbs: 'x', fat: 'y', source: 'manual' }];
        return DB.importJSON(JSON.stringify(blob));
      }, { neg: LEGACY, abc: LEGACY_TEXT });
      soft('L3 precondition', () => assert.equal(planted, true, 'the legacy blob imports'));
      await page.evaluate(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
      await go(page, LEGACY);
      c = await card(page);
      soft('L3 negative row', () => {
        assert.equal(c.closed, 1, 'the legacy day renders the miniature');
        near(c.dash, 0, 0.5, `a negative sum draws an EMPTY ring, not a full one (dash ${c.dash})`);
        assert.equal(c.emptyRing, true, 'and the empty ring is switched off');
        assert.equal(c.num, '2,000', 'a negative sum counts as nothing eaten: under by the whole target');
        c.tracks.forEach((tr, i) => assert.ok(Number.isFinite(tr.width) && tr.width >= 0 && tr.width <= 100, `track ${i} width is a finite 0–100 (${tr.width})`));
      });
      await go(page, LEGACY_TEXT);
      c = await card(page);
      soft('L3 text row', () => {
        assert.ok(!/NaN/.test(c.text), `no NaN anywhere on the card: «${c.text.replace(/\s+/g, ' ').trim()}»`);
        near(c.dash, 0, 0.5, `a non-number counts as nothing (dash ${c.dash})`);
        assert.equal(c.num, '2,000', 'under by the whole target');
        c.tracks.forEach((tr, i) => assert.ok(Number.isFinite(tr.width) && tr.width >= 0 && tr.width <= 100, `track ${i} width is a finite 0–100 (${tr.width})`));
      });
      // The same legacy rows in the ROW LIST under the card, and in the four
      // tiles drawn when targets are off (initial render and the delete patch).
      const bad = /NaN|-\s*\d|−\s*\d/;
      soft('L3 text row list', () => assert.ok(!bad.test(c.rowsText), `the row list prints no NaN or minus: «${c.rowsText}»`));
      await go(page, LEGACY);
      c = await card(page);
      soft('L3 negative row list', () => assert.ok(!bad.test(c.rowsText), `the row list prints no NaN or minus: «${c.rowsText}»`));
      await page.evaluate(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
      for (const d of [LEGACY, LEGACY_TEXT]) {
        await go(page, d);
        c = await card(page);
        soft(`L3 tiles ${d}`, () => assert.ok(c.tiles === 1 && !bad.test(c.tilesText), `the four tiles print no NaN or minus: «${c.tilesText}»`));
      }
      await page.evaluate((d) => DB.foodLogs.add(d, { name: 'QA valid', servings: 1, calories: 100, protein: 5, carbs: 10, fat: 2, source: 'manual' }), LEGACY_TEXT);
      await go(page, LEGACY_TEXT);
      await page.locator('.view.active [data-food-row]', { hasText: 'QA valid' }).locator('[data-del-food]').click();
      c = await card(page);
      soft('L3 tiles after delete', () => assert.ok(c.tiles === 1 && !bad.test(c.tilesText), `the patched tiles print no NaN or minus: «${c.tilesText}»`));
      await page.evaluate((TGT) => DB.nutrition.setTargets(TGT), TGT);

      // L4 — a closed day eaten EXACTLY to its target is «on target», not «0 under».
      await page.evaluate((d) => {
        DB.foodLogs.listForDate(d).forEach((r) => DB.foodLogs.remove(d, r.id));
        DB.foodLogs.add(d, { name: 'QA exact a', servings: 1, calories: 1200, protein: 90, carbs: 120, fat: 40, source: 'manual' });
        DB.foodLogs.add(d, { name: 'QA exact b', servings: 1, calories: 800, protein: 60, carbs: 80, fat: 20, source: 'manual' });
      }, ON);
      const onStr = await page.evaluate(() => t('fl_day_on'));
      await go(page, ON);
      c = await card(page);
      soft('L4', () => {
        assert.notEqual(onStr, 'fl_day_on', 'fl_day_on is in the dictionary');
        assert.equal(c.num, '0', 'the figure is 0');
        assert.equal(c.label, onStr, `the label is the on-target verdict, not «${c.label}»`);
        assert.equal(c.ringOver, false, 'exactly on target is not over');
        near(c.dash, C, 0.5, 'and the ring is full');
      });

      // L5 — an empty PAST day never says «today».
      const l5 = await page.evaluate(() => ({ today: t('no_food_logged'), day: t('no_food_logged_day') }));
      await go(page, EMPTY);
      c = await card(page);
      soft('L5 past day', () => {
        assert.notEqual(l5.day, 'no_food_logged_day', 'no_food_logged_day is in the dictionary');
        assert.equal(c.emptyTitle, l5.day, `an empty closed day reads the day's own empty line, not «${c.emptyTitle}»`);
      });
      await go(page, today);
      c = await card(page);
      soft('L5 today', () => assert.equal(c.emptyTitle, l5.today, 'an empty today still reads the today line'));
      await go(page, ON);
      await page.locator('.view.active [data-del-food]').first().click();
      await page.locator('.view.active [data-del-food]').first().click();
      c = await card(page);
      soft('L5 after delete', () => assert.equal(c.emptyTitle, l5.day, `deleting the last row of a closed day leaves the day's line, not «${c.emptyTitle}»`));

      // L1 — midnight passes while the log is open: the next refresh must see
      // the day CLOSE (the visibilitychange repaint does not fire on a phone that
      // stayed awake). todayISO is a global function; it is moved a day forward
      // for one refresh and restored byte for byte.
      await seed(page);
      await go(page, today);
      c = await card(page);
      soft('L1 precondition', () => assert.equal(c.closed, 0, 'today opens live'));
      await page.evaluate(() => { window.__qaToday = window.todayISO; window.todayISO = () => addDaysISO(window.__qaToday(), 1); });
      await page.locator('.view.active [data-del-food]').first().click();
      c = await card(page);
      await page.evaluate(() => { window.todayISO = window.__qaToday; delete window.__qaToday; });
      soft('L1', () => {
        assert.equal(c.closed, 1, `after midnight a delete re-renders the day as CLOSED (.nutri-mini.closed found ${c.closed})`);
        assert.equal(c.label, s.under, 'and the label is the verdict');
        assert.equal(c.barTitle, 1, 'and the re-rendered day keeps its bar title shown');
      });
      // …and the other side of midnight: a FUTURE day (the calendar opens one)
      // that BECOMES today must re-render as today, header and all.
      const tomorrow = await page.evaluate(() => addDaysISO(todayISO(), 1));
      const todayLabel = await page.evaluate(() => t('today_totals'));
      await page.evaluate((d) => {
        DB.foodLogs.listForDate(d).forEach((r) => DB.foodLogs.remove(d, r.id));
        DB.foodLogs.add(d, { name: 'QA tomorrow a', servings: 1, calories: 300, protein: 20, carbs: 30, fat: 10, source: 'manual' });
        DB.foodLogs.add(d, { name: 'QA tomorrow b', servings: 1, calories: 200, protein: 10, carbs: 20, fat: 5, source: 'manual' });
      }, tomorrow);
      await go(page, tomorrow);
      c = await card(page);
      soft('L1 future precondition', () => assert.notEqual(c.dayLabel, todayLabel, 'tomorrow opens under its date'));
      await page.evaluate(() => { window.__qaToday = window.todayISO; window.todayISO = () => addDaysISO(window.__qaToday(), 1); });
      await page.locator('.view.active [data-del-food]').first().click();
      c = await card(page);
      await page.evaluate(() => { window.todayISO = window.__qaToday; delete window.__qaToday; });
      soft('L1 future becomes today', () => assert.equal(c.dayLabel, todayLabel, `after midnight the day that became today reads «${todayLabel}», not «${c.dayLabel}»`));
      await page.evaluate((d) => DB.foodLogs.listForDate(d).forEach((r) => DB.foodLogs.remove(d, r.id)), tomorrow);

      // L6 — the 340–374px band: every macro-track head stays ONE line, name
      // and figures, at the widest realistic figures, at both scales. The head's
      // ink is widened like the ring's when the brand faces are absent.
      await page.evaluate((d) => {
        DB.foodLogs.listForDate(d).forEach((r) => DB.foodLogs.remove(d, r.id));
        DB.foodLogs.add(d, { name: 'QA wide', servings: 1, calories: 1850, protein: 125.5, carbs: 250.5, fat: 55.5, source: 'manual' });
      }, WIDE);
      await page.evaluate(() => DB.nutrition.setTargets({ calories: 2000, protein: 150, carbs: 300, fat: 60 }));
      for (const width of [375, 360, 340]) for (const lg of [false, true]) {
        await page.setViewportSize({ width, height: 740 });
        await page.evaluate((lg) => { DB.prefs.setTextLg(lg); document.body.classList.toggle('text-lg', lg); }, lg);
        await go(page, WIDE);
        c = await card(page);
        const k = c.mono ? 1 : WIDER;
        const where = `L6 ${width}px${lg ? ' text-lg' : ''}`;
        soft(where, () => {
          assert.equal(c.heads.length, 3, 'three track heads');
          for (const hd of c.heads) {
            assert.equal(hd.nameLines, 1, `«${hd.name}» is one line (head ${hd.headW}px)`);
            assert.equal(hd.numsLines, 1, `«${hd.nums}» is one line (head ${hd.headW}px)`);
            assert.ok((hd.nameW + hd.numsW) * k <= hd.headW, `«${hd.name}» + «${hd.nums}» = ${(hd.nameW + hd.numsW).toFixed(1)}px${k > 1 ? ` × ${k} = ${((hd.nameW + hd.numsW) * k).toFixed(1)}` : ''} does not share a ${hd.headW}px head`);
          }
          fits(c, where);
        });
        measured.bands.push(`${lang} ${width}${lg ? '+lg' : ''}: heads ${c.heads.map((hd) => `${(hd.nameW + hd.numsW).toFixed(0)}/${hd.headW}`).join(' ')}`);
      }
      await page.setViewportSize({ width: 375, height: 812 });
      await page.evaluate(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
      await page.evaluate((TGT) => DB.nutrition.setTargets(TGT), TGT);
      measured.fontsCheck = c.fontsCheck; measured.mono = c.mono;
      assert.deepEqual(found, [], `${lang}: the v405 findings`);

      // (e) no targets: the four tiles, exactly as before, and their text-node patching
      await page.evaluate(() => DB.nutrition.setTargets({ calories: 0, protein: 0, carbs: 0, fat: 0 }));
      await go(page, UNDER);
      c = await card(page);
      assert.equal(c.tiles, 1, `${lang}: without targets the four tiles render`);
      assert.equal(c.mini, 0, `${lang}: without targets there is no miniature`);
      assert.equal(await page.locator('.view.active .macro-total.cal .macro-total-value').innerText(), `1,100${s.cal}`, `${lang}: the calorie tile`);
      await page.locator('.view.active [data-del-food]').first().click();
      assert.equal(await page.locator('.view.active .macro-total.cal .macro-total-value').innerText(), `500${s.cal}`, `${lang}: the tile is patched in place after a delete`);
    }
    assert.deepEqual(errors, [], 'no page errors');
    const contained = net.assertContained();
    console.log(`PASS food log UI: AR/dark + EN/light at 375×812 — a closed day's miniature hero (verdict, dash, three tracks, no water/pencil/click), today's left/over, an over day's red ring, the arrows, a delete re-rendering the card, the four tiles without targets, and nothing clipping at --fs-scale ${measured.scaleMax} (${measured.fonts.join(', ')}); the v405 findings (targets flipped under an open editor — focus kept on the saved row, the bar title kept through the arrows and every re-render, the empty ring paints no dot, unclamped legacy rows, «on target», the past day's empty line, midnight closing the day and a future day becoming today, legacy rows in the row list and the four tiles, one-line track heads at 375/360/340 ± text-lg: ${measured.bands.join(' · ')}); brand mono ${measured.mono ? 'loaded' : `absent (fonts.check says ${measured.fontsCheck}), widths × ${WIDER}`}; ${contained.blockedTotal} requests fenced`);
  } finally { await browser.close(); await srv.close(); }
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
