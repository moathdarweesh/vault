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
const ROWS = {
  [UNDER]: [{ name: 'QA oats', calories: 600, protein: 40, carbs: 50, fat: 20 },
            { name: 'QA rice', calories: 500, protein: 30, carbs: 60, fat: 15 }],
  [OVER]:  [{ name: 'QA feast', calories: 1500, protein: 90, carbs: 150, fat: 50 },
            { name: 'QA cake', calories: 900, protein: 10, carbs: 120, fat: 30 }],
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);
// Every centre line inside its box (scrollWidth ≤ clientWidth) AND inside the
// ring's inner circle (its width ≤ the chord at its farthest edge, ±0.5px).
const fits = (c, where) => {
  assert.equal(c.centreEls, 3, `${where}: three centre lines (figure, label, sub)`);
  for (const n of c.centre) {
    assert.ok(n.scroll <= n.client, `${where}: «${n.text}» clips its box (${n.scroll} > ${n.client}, ring ${c.ringPx}px)`);
    assert.ok(n.inside, `${where}: «${n.text}» runs below the ring's inner circle`);
    assert.ok(n.width <= n.chord + 0.5, `${where}: «${n.text}» sits on the ring stroke (${n.width.toFixed(1)}px wide, ${n.chord.toFixed(1)}px chord, ring ${c.ringPx}px)`);
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
  };
});

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
    const measured = { scaleMax: null, fonts: null };

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
      assert.equal(c.sub, `1,100 / 2,000 ${s.cal}`, `${lang}: the sub line is eaten / target unit`);
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
      const pick = (o) => ({ num: o.num, label: o.label, sub: o.sub, dash: o.dash, ringOver: o.ringOver, tracks: o.tracks.map((t) => [t.nums, t.width]) });
      assert.deepEqual(pick(h), pick(c), `${lang}: the hero and the miniature disagree about today`);
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
      assert.equal(c.sub, `500 / 2,000 ${s.cal}`, `${lang}: the sub follows the delete`);
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
    console.log(`PASS food log UI: AR/dark + EN/light at 375×812 — a closed day's miniature hero (verdict, dash, three tracks, no water/pencil/click), today's left/over, an over day's red ring, the arrows, a delete re-rendering the card, the four tiles without targets, and nothing clipping at --fs-scale ${measured.scaleMax} (${measured.fonts.join(', ')}); ${contained.blockedTotal} requests fenced`);
  } finally { await browser.close(); await srv.close(); }
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
