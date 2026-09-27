#!/usr/bin/env node
// THE QUICK FOOD PATHS — three shortcuts to a meal the app already knows,
// driven in a real browser at 375x812, AR/dark and EN/light:
//
//   (a) «Repeat yesterday» comes pre-ticked for THIS time of day: yesterday's
//       rows logged (addedAt) within two hours, either side, of this moment
//       one day earlier — real elapsed time, so yesterday's 23:30 is not
//       «near» at 00:30 and a row back-filled this morning never is. The rest
//       stay unticked; with nothing near now, or with EVERY row near (a whole
//       day in one write shares one stamp), nothing is ticked and Add waits
//       (the v391 rule — the default is never «everything»).
//   (b) a «recently eaten» row at the top of the food add sheet: up to five
//       distinct items (same name + calories) from the last 14 days, most
//       eaten first, the most recent breaking a tie; one tap logs it again in
//       ONE addMany write with Undo; no row at all with no history.
//   (c) the food catalogue in search: DB.search.query appends a last group of
//       FOOD_PRESETS (and the server presets) matched by the same folding; the
//       top-bar search and the saved-food picker show it under the user's own
//       foods, and a tap logs one serving — fat included (p.f) — with Undo.
//
// Same harness as scripts/test-cardio-sleep-ui.js (scripts/fp/server.js): the
// repo over loopback, js/cloud.js stubbed, every non-127.0.0.1 request aborted
// by the fence. None of these paths calls the Worker; a route for it answers
// 503 anyway, and the fence proves afterwards that nothing left loopback.
//
// Seen failing on the tree before the change (the project's rule: a check is
// trusted only after it has been seen to fail) — see the report in the builder
// log: every case printed its own FAIL line and the run exited 1.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';

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
  // The Worker is never called by these paths; if one ever did, it gets a 503
  // here rather than a live answer (the fence would abort it regardless).
  await page.route(/workers\.dev|gemini/i, (route) => route.fulfill({ status: 503, body: '' }));
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
    document.getElementById('add-sheet-overlay')?.remove();
    hideToast();
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx || {});
  }, { view, ctx });
  const settled = () => page.waitForFunction(() => !document.querySelector('.view.active.enter, .view.active .enter'), null, { timeout: 3000 });
  return { ctx, page, ev, reset, settled, errors, guard, lang, theme };
}

// Every food row and saved food gone, through DB.* (the blob's own doors).
function wipeFood() {
  for (const d of Object.keys(STATE.foodLogs)) DB.foodLogs.listForDate(d).slice().forEach((r) => DB.foodLogs.remove(d, r.id));
  DB.foods.list().forEach((f) => DB.foods.remove(f.id));
}
const rowsOn = (page, day) => page.evaluate((d) => DB.foodLogs.listForDate(d || todayISO()).map((r) => ({ name: r.name, servings: r.servings, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, source: r.source })), day);
async function undoFromToast(page) {
  const btn = page.locator('#toast .toast-action');
  await btn.waitFor({ state: 'visible', timeout: 2000 });
  assert.equal((await btn.textContent()).trim(), await page.evaluate(() => t('undo')), 'the toast offers Undo');
  await btn.click();
  await page.waitForTimeout(150);
}

const CASES = [
  // ── (a) repeat yesterday, pre-ticked for this time of day ─────────────────
  ['repeat yesterday: the rows logged within two hours of now come ticked, the others do not, and Add is live', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('home');
    const s = await ev(() => {
      const today = todayISO(), y = addDaysISO(today, -1);
      DB.foodLogs.addMany(y, [
        { name: 'Near before', servings: 1, calories: 300, protein: 20, carbs: 30, fat: 9 },
        { name: 'Far away', servings: 1, calories: 500, protein: 10, carbs: 60, fat: 20 },
        { name: 'Near after', servings: 1.5, calories: 200, protein: 5, carbs: 25, fat: 7 },
        { name: 'No stamp', servings: 1, calories: 100, protein: 1, carbs: 1, fat: 1 },
      ]);
      const rows = STATE.foodLogs[y];
      // Only the TIME OF DAY is read; the stamps sit on yesterday's date here,
      // and the ±2 h window wraps across midnight.
      const at = (min) => new Date(Date.now() - 864e5 + min * 60000).toISOString();
      rows[0].addedAt = at(-90); rows[1].addedAt = at(-300); rows[2].addedAt = at(100); delete rows[3].addedAt;
      return { today, y };
    });
    await ev((d) => openRepeatYesterday(d, refreshCaller), s.today);
    await page.waitForSelector('#modal-root #ry-list');
    const g = await ev(() => ({
      ticked: [...document.querySelectorAll('#ry-list [data-ry]')].map((c) => c.checked),
      add: document.getElementById('ry-add').disabled,
    }));
    assert.deepEqual(g.ticked, [true, false, true, false], 'the two rows within two hours are ticked, the far and the unstamped are not');
    assert.equal(g.add, false, 'Add is live with rows ticked');
    await page.locator('#ry-add').click();
    await page.waitForTimeout(150);
    const logged = await rowsOn(page, s.today);
    assert.deepEqual(logged.map((r) => [r.name, r.servings]), [['Near before', 1], ['Near after', 1.5]], 'the ticked rows land, portions verbatim');
    await undoFromToast(page);
    assert.equal((await rowsOn(page, s.today)).length, 0, 'Undo takes the repeat back');
  }],

  ['repeat yesterday: nothing near now → nothing ticked and Add waits (the default is never «everything»)', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('home');
    const today = await ev(() => {
      const t0 = todayISO(), y = addDaysISO(t0, -1);
      DB.foodLogs.addMany(y, [{ name: 'Far one', servings: 1, calories: 300, protein: 1, carbs: 1, fat: 1 }, { name: 'Far two', servings: 1, calories: 200, protein: 1, carbs: 1, fat: 1 }]);
      STATE.foodLogs[y].forEach((r, i) => { r.addedAt = new Date(Date.now() - 864e5 + (i ? 6 : -6) * 3600e3).toISOString(); });
      return t0;
    });
    await ev((d) => openRepeatYesterday(d, refreshCaller), today);
    await page.waitForSelector('#modal-root #ry-list');
    const g = await ev(() => ({ ticked: [...document.querySelectorAll('#ry-list [data-ry]')].map((c) => c.checked), add: document.getElementById('ry-add').disabled }));
    assert.deepEqual(g.ticked, [false, false]);
    assert.equal(g.add, true, 'Add stays off until something is ticked');
  }],

  ['repeat yesterday: «near» is real time one day later — at 00:30 yesterday\'s 23:30 (an hour ago) is not near, yesterday\'s 00:45 is, a row back-filled this morning is not', async ({ ev }) => {
    // Pure: the same helper the sheet uses, fed a fixed "now". A clock-time
    // circle called the 23:30 snack eaten ONE hour ago «near» at 00:30 and
    // ticked it for a second logging; a row added to yesterday at 07:00 today
    // ticked at breakfast for a meal eaten the evening before.
    const g = await ev(() => {
      if (typeof foodNearNow !== 'function') throw new Error('no foodNearNow helper');
      const mk = (dayOff, h, m) => { const d = new Date(); d.setDate(d.getDate() + dayOff); d.setHours(h, m, 0, 0); return d; };
      const now = mk(0, 0, 30);
      return [
        foodNearNow(mk(-1, 23, 30).toISOString(), now),          // eaten an hour ago, across the day line
        foodNearNow(mk(-1, 0, 45).toISOString(), now),           // this time yesterday
        foodNearNow(mk(0, 7, 0).toISOString(), mk(0, 7, 30)),    // back-filled onto yesterday this morning
        foodNearNow(mk(-1, 21, 0).toISOString(), now),
        foodNearNow('', now), foodNearNow('garbage', now),
      ];
    });
    assert.deepEqual(g, [false, true, false, false, false, false]);
  }],

  ['repeat yesterday: a whole day added in ONE write (one shared stamp, near now) ticks nothing — the default is never «everything»', async ({ page, ev, reset }) => {
    // Repeat-yesterday at 21:00 with every row ticked writes the whole day in
    // one addMany, so every row carries 21:00; the next evening all of them
    // came pre-ticked and one tap logged the whole day again. Same for a user
    // who logs the whole day at night.
    await ev(wipeFood); await reset('home');
    const today = await ev(() => {
      const t0 = todayISO(), y = addDaysISO(t0, -1);
      DB.foodLogs.addMany(y, [
        { name: 'Breakfast', servings: 1, calories: 400, protein: 20, carbs: 40, fat: 10 },
        { name: 'Lunch', servings: 1, calories: 700, protein: 40, carbs: 60, fat: 20 },
        { name: 'Dinner', servings: 1, calories: 600, protein: 35, carbs: 50, fat: 18 },
      ]);
      const stamp = new Date(Date.now() - 864e5 + 30 * 60000).toISOString();
      STATE.foodLogs[y].forEach((r) => { r.addedAt = stamp; });
      return t0;
    });
    await ev((d) => openRepeatYesterday(d, refreshCaller), today);
    await page.waitForSelector('#modal-root #ry-list');
    const g = await ev(() => ({ ticked: [...document.querySelectorAll('#ry-list [data-ry]')].map((c) => c.checked), add: document.getElementById('ry-add').disabled }));
    assert.deepEqual(g.ticked, [false, false, false], 'every row near now would be every row: nothing is ticked');
    assert.equal(g.add, true, 'Add waits');
  }],

  // ── (b) recently eaten ─────────────────────────────────────────────────────
  ['the add sheet opens with «recently eaten»: five distinct items, most eaten first, escaped', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('food');
    await ev(() => {
      const d = (n) => addDaysISO(todayISO(), -n);
      const put = (n, name, cal, servings = 1) => DB.foodLogs.addMany(d(n), [{ name, servings, calories: cal, protein: 10, carbs: 10, fat: 3 }]);
      put(20, 'Old pizza', 800); put(21, 'Old pizza', 800); put(22, 'Old pizza', 800); put(23, 'Old pizza', 800);   // outside 14 days
      put(1, 'Oats', 350); put(3, 'Oats', 350); put(5, 'Oats', 350);
      put(2, 'Eggs', 156, 2); put(6, 'Eggs', 156, 1);
      put(0, 'Oats', 500);                       // same name, other calories: another item
      put(4, 'Chicken <b>grill</b>', 400);
      put(7, 'Rice', 260); put(8, 'Tuna', 116); put(9, 'Salad', 90);
    });
    await ev(() => openAddSheet(todayISO(), refreshCaller));
    await page.waitForSelector('#add-sheet-overlay .add-recent-chip', { timeout: 3000 });
    const g = await ev(() => ({
      chips: [...document.querySelectorAll('#add-sheet-overlay .add-recent-chip')].map((b) => b.querySelector('.add-recent-name').textContent),
      label: document.querySelector('#add-sheet-overlay .add-recent-label')?.textContent.trim(), want: t('fl_recent'),
      bold: !!document.querySelector('#add-sheet-overlay .add-recent-chip b'),
      aboveGrid: (() => { const r = document.querySelector('#add-sheet-overlay .add-recent'), gr = document.querySelector('#add-sheet-overlay .add-grid'); return !!(r && gr && (r.compareDocumentPosition(gr) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
      pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      chipH: Math.round(document.querySelector('#add-sheet-overlay .add-recent-chip').getBoundingClientRect().height),
      radius: getComputedStyle(document.querySelector('#add-sheet-overlay .add-recent-chip')).borderTopLeftRadius,
      rowScrolls: getComputedStyle(document.querySelector('#add-sheet-overlay .add-recent-row')).overflowX,
    }));
    assert.deepEqual(g.chips, ['Oats', 'Eggs', 'Oats', 'Chicken <b>grill</b>', 'Rice'], 'three Oats 350, two Eggs, then one-offs newest first (Oats 500 today, Chicken, Rice); the 20-day-old pizza never');
    assert.equal(g.bold, false, 'a food name is text, never markup');
    assert.equal(g.label, g.want, 'the row is named');
    assert.equal(g.aboveGrid, true, 'the row sits above the method tiles');
    assert.equal(g.pageScroll, false, 'the page never scrolls sideways');
    assert.equal(g.rowScrolls, 'auto', 'the row scrolls sideways on its own');
    assert.equal(g.chipH, 44, 'a chip is the M button (44px), two lines inside');
    assert.equal(g.radius, '12px', 'a rounded rectangle on the M radius, never a capsule');
  }],

  ['one tap on a recent chip logs it again in one write, with last time\'s portion, and Undo takes it back', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('food');
    await ev(() => {
      DB.foodLogs.addMany(addDaysISO(todayISO(), -6), [{ name: 'Eggs', servings: 1, calories: 156, protein: 12, carbs: 1, fat: 10 }]);
      DB.foodLogs.addMany(addDaysISO(todayISO(), -2), [{ name: 'Eggs', servings: 2, calories: 156, protein: 12, carbs: 1, fat: 10, source: 'photo' }]);
    });
    await ev(() => openAddSheet(todayISO(), refreshCaller));
    await page.waitForSelector('#add-sheet-overlay .add-recent-chip', { timeout: 3000 });
    const kcal = await ev(() => document.querySelector('#add-sheet-overlay .add-recent-chip .add-recent-cal')?.textContent.trim());
    assert.ok(kcal && kcal.includes(await ev(() => fmtNum(312))), 'the chip shows the calories as last eaten (2 × 156): ' + kcal);
    const undoBefore = await ev(() => DB.undo.list()[0]?.token || null);
    await page.locator('#add-sheet-overlay .add-recent-chip').first().click();
    await page.waitForFunction(() => !document.getElementById('add-sheet-overlay'), null, { timeout: 2000 });
    const rows = await rowsOn(page);
    assert.deepEqual(rows, [{ name: 'Eggs', servings: 2, calories: 156, protein: 12, carbs: 1, fat: 10, source: 'photo' }], 'the same row as last time, portion and figures exact');
    const head = await ev(() => DB.undo.list().slice(0, 2).map((e) => e.token));
    assert.ok(head[0] !== undoBefore && head[1] === undoBefore, 'one write, one new undo entry');
    await undoFromToast(page);
    assert.equal((await rowsOn(page)).length, 0, 'Undo takes it back');
  }],

  ['a keyboard focus ring on a recent chip is not clipped by its scrolling row', async ({ page, ev, reset }) => {
    // overflow-x:auto clips the other axis too (v373): the global 2px ring at
    // a 2px offset sat 4px outside the chip, and the row cut it off at the
    // top, the bottom and the first chip's start edge.
    await ev(wipeFood); await reset('food');
    await ev(() => {
      const d = (n) => addDaysISO(todayISO(), -n);
      DB.foodLogs.addMany(d(1), [{ name: 'Oats', servings: 1, calories: 350, protein: 10, carbs: 50, fat: 6 }]);
      DB.foodLogs.addMany(d(2), [{ name: 'Eggs', servings: 1, calories: 156, protein: 12, carbs: 1, fat: 10 }]);
    });
    await ev(() => openAddSheet(todayISO(), refreshCaller));
    await page.waitForSelector('#add-sheet-overlay.open .add-recent-chip', { timeout: 3000 });
    await page.waitForTimeout(350);                          // the sheet's own entrance
    await page.keyboard.press('Tab');
    for (let i = 0; i < 6 && !(await ev(() => !!document.activeElement?.closest('.add-recent-chip'))); i++) await page.keyboard.press('Tab');
    const g = await ev(() => {
      const chip = document.activeElement.closest('.add-recent-chip');
      if (!chip) return null;
      const cs = getComputedStyle(chip);
      const out = (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0);
      const c = chip.getBoundingClientRect(), r = chip.closest('.add-recent-row').getBoundingClientRect();
      return { visible: chip.matches(':focus-visible') && cs.outlineStyle !== 'none' && out > 0,
        top: c.top - out - r.top, bottom: r.bottom - (c.bottom + out), start: Math.min(c.left - out - r.left, r.right - (c.right + out)) };
    });
    assert.ok(g, 'Tab reaches a recent chip');
    assert.equal(g.visible, true, 'the chip shows a focus ring');
    assert.ok(g.top >= -0.5 && g.bottom >= -0.5, `the ring fits the row vertically (top ${g.top.toFixed(1)}, bottom ${g.bottom.toFixed(1)})`);
    assert.ok(g.start >= -0.5, `the first chip's ring fits the row's edges (${g.start.toFixed(1)})`);
  }],

  ['no history: the add sheet has no «recently eaten» row', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('food');
    await ev(() => openAddSheet(todayISO(), refreshCaller));
    await page.waitForSelector('#add-sheet-overlay .add-grid');
    assert.equal(await ev(() => document.querySelectorAll('#add-sheet-overlay .add-recent, #add-sheet-overlay .add-recent-chip').length), 0);
  }],

  // ── (c) the catalogue in search ────────────────────────────────────────────
  ['DB.search.query appends the catalogue as the LAST group, below the user\'s own foods, and never repeats a saved food', async ({ ev }) => {
    const g = await ev((lang) => {
      for (const d of Object.keys(STATE.foodLogs)) DB.foodLogs.listForDate(d).slice().forEach((r) => DB.foodLogs.remove(d, r.id));
      DB.foods.list().forEach((f) => DB.foods.remove(f.id));
      DB.foods.add({ name: lang === 'ar' ? 'رز بيتي' : 'Home rice', calories: 200, protein: 4, carbs: 40, fat: 2 });
      DB.foods.add({ name: lang === 'ar' ? 'أرز أبيض' : 'White Rice', calories: 130, protein: 3, carbs: 28, fat: 0.3 });   // the same as a preset
      const r = DB.search.query(lang === 'ar' ? 'رز' : 'rice');
      const firstCat = r.findIndex((x) => x.type === 'catalog');
      return {
        types: r.map((x) => x.type), firstCat, lastOwn: r.map((x) => x.type).lastIndexOf('food'),
        cat: r.filter((x) => x.type === 'catalog').map((x) => x.name),
        white: r.filter((x) => x.type === 'catalog' && /white rice|أرز أبيض/i.test(x.name)).length,
        preset: r.find((x) => x.type === 'catalog')?.preset || null,
      };
    }, await ev(() => DB.prefs.get().lang));
    assert.ok(g.firstCat > 0, 'the catalogue answers «rice»: ' + JSON.stringify(g.types));
    assert.ok(g.lastOwn >= 0 && g.lastOwn < g.firstCat, 'the user\'s own foods come first');
    assert.ok(g.types.slice(g.firstCat).every((x) => x === 'catalog'), 'the catalogue is the last group');
    assert.equal(g.white, 0, 'a preset already saved as a food is not offered twice');
    assert.ok(g.cat.length <= 8, 'at most eight catalogue results');
    assert.ok(g.preset && typeof g.preset.cal === 'number' && 'f' in g.preset, 'a catalogue result carries its preset figures');
  }],

  ['the top-bar search shows «from the food guide» last, and a tap logs one serving with its fat, with Undo', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('home');
    await ev(() => DB.foods.add({ name: DB.prefs.get().lang === 'ar' ? 'رز بيتي' : 'Home rice', calories: 200, protein: 4, carbs: 40, fat: 2 }));
    await ev(() => openUnifiedSearch());
    await page.waitForSelector('#cx-query');
    await page.locator('#cx-query').fill(await ev(() => DB.prefs.get().lang === 'ar' ? 'رز' : 'rice'));
    await page.waitForSelector('#cx-results [data-result]');
    const g = await ev(() => {
      const heads = [...document.querySelectorAll('#cx-results h3')].map((h) => h.textContent.trim());
      const cat = [...document.querySelectorAll('#cx-results [data-cat-result]')];
      return { heads, want: t('cx_catalog'), own: t('tab_saved_foods'), n: cat.length, first: cat[0]?.querySelector('strong')?.textContent.trim(), sub: cat[0]?.querySelector('span')?.textContent || '' };
    });
    assert.equal(g.heads[g.heads.length - 1], g.want, 'the catalogue is the last group: ' + g.heads.join(' | '));
    assert.ok(g.heads.indexOf(g.own) >= 0 && g.heads.indexOf(g.own) < g.heads.length - 1, 'the saved foods come above it');
    assert.ok(g.n > 0, 'catalogue rows are tappable');
    const p = await ev((name) => { const p = allFoodPresets().find((x) => foodPresetName(x) === name); return p && { cal: p.cal, pro: p.pro, carb: p.carb, f: p.f || 0 }; }, g.first);
    assert.ok(p, 'the first catalogue row names a preset: ' + g.first);
    assert.ok(g.sub.includes(await ev((n) => fmtNum(n), p.cal)), 'the row shows the preset\'s calories: ' + g.sub);
    await page.locator('#cx-results [data-cat-result]').first().click();
    await page.waitForTimeout(150);
    const rows = await rowsOn(page);
    assert.deepEqual(rows, [{ name: g.first, servings: 1, calories: p.cal, protein: p.pro, carbs: p.carb, fat: p.f, source: 'catalog' }], 'one serving, fat included');
    await undoFromToast(page);
    assert.equal((await rowsOn(page)).length, 0, 'Undo takes it back');
  }],

  ['a catalogue search row says it ADDS (a plus and «add» in its name), and one row keeps to one digit script', async ({ page, ev, reset }) => {
    // Every other search result opens something; this one logs food on one
    // tap, so the row must say so as the picker's rows do. And «130 سعرة ·
    // ١ كوب · ٢٠٠غ» mixed Latin and Arabic-Indic figures in one line
    // (test-i18n rule 16 reads only the dictionaries, never preset data).
    await ev(wipeFood); await reset('home');
    await ev(() => openUnifiedSearch());
    await page.waitForSelector('#cx-query');
    await page.locator('#cx-query').fill(await ev(() => DB.prefs.get().lang === 'ar' ? 'رز' : 'rice'));
    await page.waitForSelector('#cx-results [data-cat-result]', { timeout: 2000 });
    const g = await ev(() => [...document.querySelectorAll('#cx-results [data-cat-result]')].map((b) => ({
      plus: !!b.querySelector('svg'),
      name: (b.getAttribute('aria-label') || b.textContent).replace(/\s+/g, ' ').trim(),
      text: b.textContent.replace(/\s+/g, ' ').trim(),
      add: t('add'),
    })));
    assert.ok(g.length > 0);
    for (const r of g) {
      assert.equal(r.plus, true, 'a plus mark on «' + r.text + '»');
      assert.ok(r.name.includes(r.add), 'its accessible name says «' + r.add + '»: ' + r.name);
      assert.ok(!(/[٠-٩]/.test(r.text) && /[0-9]/.test(r.text)), 'one digit script per row: ' + r.text);
    }
    await ev(() => { closeModal(); });
  }],

  ['a search that only the catalogue answers is not «no results» any more', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('home');
    await ev(() => openUnifiedSearch());
    await page.waitForSelector('#cx-query');
    await page.locator('#cx-query').fill(await ev(() => DB.prefs.get().lang === 'ar' ? 'رز' : 'rice'));
    await page.waitForSelector('#cx-results [data-cat-result]', { timeout: 2000 });
    assert.equal(await ev(() => document.querySelector('#cx-results p')?.textContent.trim() === t('cx_empty')), false);
  }],

  ['the saved-food picker lists catalogue matches under the saved ones while searching, and a tap logs one serving with Undo', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('food');
    await ev(() => DB.foods.add({ name: DB.prefs.get().lang === 'ar' ? 'رز بيتي' : 'Home rice', calories: 200, protein: 4, carbs: 40, fat: 2 }));
    await ev(() => openSavedFoodPicker(todayISO(), refreshCaller));
    await page.waitForSelector('#sf-list');
    assert.equal(await ev(() => document.querySelectorAll('#sf-list [data-add-cat]').length), 0, 'no catalogue before a search');
    await page.locator('#sf-search').fill(await ev(() => DB.prefs.get().lang === 'ar' ? 'رز' : 'rice'));
    await page.waitForSelector('#sf-list [data-add-cat]', { timeout: 2000 });
    const g = await ev(() => {
      const list = document.getElementById('sf-list');
      const own = list.querySelector('[data-add-saved]'), head = list.querySelector('.sfp-cat-head'), cat = list.querySelector('[data-add-cat]');
      const after = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      return { order: after(own, head) && after(head, cat), head: head?.textContent.trim(), want: t('cx_catalog'), name: cat?.querySelector('.picker-row-name')?.firstChild?.textContent.trim() };
    });
    assert.equal(g.order, true, 'saved row, then the catalogue heading, then its rows');
    assert.equal(g.head, g.want);
    await page.locator('#sf-list [data-add-cat]').first().click();
    await page.waitForTimeout(150);
    const rows = await rowsOn(page);
    assert.equal(rows.length, 1); assert.equal(rows[0].servings, 1); assert.equal(rows[0].source, 'catalog');
    const p = await ev((name) => { const p = allFoodPresets().find((x) => foodPresetName(x) === name); return p && p.f; }, rows[0].name);
    assert.equal(rows[0].fat, p || 0, 'fat from the preset');
    await undoFromToast(page);
    assert.equal((await rowsOn(page)).length, 0);
  }],

  ['the picker\'s catalogue group is a real heading, and adding from a row keeps keyboard focus on it', async ({ page, ev, reset }) => {
    // The top-bar search names the same group with an <h3>; here it was a div
    // a screen reader cannot jump to. And the double-tap guard set `disabled`
    // on the focused row, which blurs it: focus fell to <body>.
    await ev(wipeFood); await reset('food');
    await ev(() => DB.foods.add({ name: DB.prefs.get().lang === 'ar' ? 'رز بيتي' : 'Home rice', calories: 200, protein: 4, carbs: 40, fat: 2 }));
    await ev(() => openSavedFoodPicker(todayISO(), refreshCaller));
    await page.waitForSelector('#sf-list');
    await page.locator('#sf-search').fill(await ev(() => DB.prefs.get().lang === 'ar' ? 'رز' : 'rice'));
    await page.waitForSelector('#sf-list [data-add-cat]', { timeout: 2000 });
    const head = await ev(() => { const h = document.querySelector('#sf-list .sfp-cat-head'); return h && { tag: h.tagName, role: h.getAttribute('role') }; });
    assert.ok(head && (/^H[1-6]$/.test(head.tag) || head.role === 'heading'), 'the catalogue group is a heading: ' + JSON.stringify(head));
    for (const sel of ['#sf-list [data-add-cat]', '#sf-list [data-add-saved]']) {
      await page.locator(sel).first().focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(120);
      const f = await ev((s) => ({ same: document.activeElement === document.querySelector(s), tag: document.activeElement?.tagName, picked: document.querySelector(s)?.classList.contains('picked') }), sel);
      assert.equal(f.picked, true, sel + ' logged');
      assert.equal(f.same, true, sel + ': focus stays on the row it pressed (was ' + f.tag + ')');
      // a second press inside the guard window adds nothing
      const n = (await rowsOn(page)).length;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(80);
      assert.equal((await rowsOn(page)).length, n, sel + ': a double press is still refused');
    }
    await ev(() => { closeModal(); });
  }],

  ['the saved-food picker with no saved foods: a search still finds the catalogue', async ({ page, ev, reset }) => {
    await ev(wipeFood); await reset('food');
    await ev(() => openSavedFoodPicker(todayISO(), refreshCaller));
    await page.waitForSelector('#sf-list');
    await page.locator('#sf-search').fill(await ev(() => DB.prefs.get().lang === 'ar' ? 'رز' : 'rice'));
    await page.waitForSelector('#sf-list [data-add-cat]', { timeout: 2000 });
    assert.equal(await ev(() => document.querySelectorAll('#sf-list [data-add-saved]').length), 0);
    await ev(() => { closeModal(); });
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
      await kit.ev(wipeFood).catch(() => {});
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  food quick paths: ${failures.length} failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  food quick paths (${passed} cases, AR/dark + EN/light, 375px): «repeat yesterday» pre-ticks the rows logged within two hours of this moment a day earlier (elapsed time, never a clock circle) and nothing else, never every row, Add lands them with Undo; the add sheet's «recently eaten» row (five distinct name+calorie items from 14 days, most eaten first, escaped, above the tiles, its own sideways scroll, M-size rounded chips, one tap = one write with last time's portion and Undo, absent with no history); the food catalogue as the last search group in DB.search.query, the top-bar search and the saved-food picker, below the user's own foods, never repeating a saved one, a tap logging one serving with its fat and Undo; a catalogue search row shows a plus and says «add», in one digit script; the picker's catalogue group is a heading and a tap keeps focus on its row; a recent chip's focus ring is not clipped`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
