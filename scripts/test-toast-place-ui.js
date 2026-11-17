// WHERE A TOAST SITS (v437) — in real Chrome.
//
//   node scripts/test-toast-place-ui.js            # ar/dark + en/light, 375 px (and 320 px with larger text where a case says)
//   QA_ONLY=<words> node scripts/test-toast-place-ui.js
//
// WHY THIS EXISTS. The toast and the Food tab's floating «+» (#food-fab) shared
// ONE anchor: bottom = the nav + 16 px. Measured 2026-11-17 on v436, in both
// languages: every toast on Food lay on the button for its whole life — ten
// seconds for an Undo — with the button's edge showing past the toast's round
// corner (English, 375 px: the toast [19,671,356,732] on the «+» [16,672,84,732]).
//
// Since v437 a toast on Food sits ABOVE the «+», and this suite holds the whole
// of that sentence, because each half of it was a way to get it wrong:
//   · above the «+», by rectangles, for a plain toast, a long one and an Undo —
//     and Undo's tap halo (it reaches below the toast) stays off the button;
//   · from its FIRST frame: a food logged from the add sheet, or saved from a
//     sheet, raises its toast while that sheet is still leaving the document;
//   · the end of the Food page keeps its last box clear of the toast, as it was;
//   · ONLY there: Home, the food log and the suggestions page keep the old place;
//   · NOT over a sheet: a sheet opened from Food hides the «+» and has made
//     room for the toast at its old place (styles.css, «the SHEET makes room»),
//     so there the toast must not move — a lifted one lies on the sheet's Save;
//   · NOT while a rest runs: the floating rest bar's own rule keeps the toast
//     where it puts it on every view.
//   · a toast ALREADY on screen follows the sheet: down to the old place when a
//     sheet opens under it, above the «+» again when the sheet has closed.
//
// Every place is read off the screen and compared with the things around it
// (the «+», the nav, the page's last box, the sheet's Save), never with a
// figure copied out of the stylesheet. The harness is the one
// scripts/test-next-target-ui.js uses: the repo over loopback, js/cloud.js as an
// offline stub, every non-loopback request aborted.
//
// Each check was seen failing on an in-memory plant of styles.css (the file on
// disk never written), and the first two on v436 as shipped; they are named in
// docs/RELEASE-NOTES.md under v437.
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const LIVE = '#modal-root .modal-overlay:not(.is-out)';
// A name long enough that the toast is as wide as a toast gets (max-width 90vw).
const NAME = { ar: 'شاورما دجاج عربي بالثوم', en: 'Chicken shawarma plate' };
const ROW = (name) => ({ name, servings: 1, calories: 300, protein: 20, carbs: 10, fat: 5, source: 'saved' });

// Installed once in the page. Rectangles are [left, top, right, bottom].
const INSTALL = () => {
  window.__qaGeo = (extraSel) => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((n) => Math.round(n * 10) / 10); };
    const toast = document.getElementById('toast'), act = toast.querySelector('.toast-action');
    // Undo's tap area, off the stylesheet's own figures: the button's box grown by its ::after insets.
    let halo = null;
    if (act) {
      const r = act.getBoundingClientRect(), h = getComputedStyle(act, '::after'), px = (v) => parseFloat(v) || 0;
      halo = [r.left + px(h.left), r.top + px(h.top), r.right - px(h.right), r.bottom - px(h.bottom)].map((n) => Math.round(n * 10) / 10);
    }
    // The lowest thing the page draws: the box whose bottom edge is furthest down the active view.
    let low = null, lowName = '';
    for (const el of document.querySelectorAll('.view.active *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // >= : of the boxes that end on that edge, the last one in the document names it (the door, not the container around it).
      if (!low || r.bottom >= low.bottom) { low = r; lowName = (el.id && '#' + el.id) || (el.className && String(el.className.baseVal === undefined ? el.className : el.className.baseVal)) || el.tagName; }
    }
    const main = document.querySelector('.main'), fab = document.getElementById('food-fab');
    const mid = fab.getBoundingClientRect(), under = document.elementFromPoint(mid.left + mid.width / 2, mid.top + mid.height / 2);
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      toast: box(toast), cls: toast.className, text: (toast.querySelector('.toast-msg') || toast).textContent.trim(),
      act: box(act), halo,
      fab: getComputedStyle(fab).display === 'none' ? null : box(fab), fabTaps: !!under && (under === fab || fab.contains(under)),
      nav: box(document.getElementById('bottom-nav')),
      low: low ? [low.left, low.top, low.right, low.bottom].map((n) => Math.round(n * 10) / 10) : null, lowName,
      atEnd: !!main && main.scrollTop + main.clientHeight >= main.scrollHeight - 1, scrolls: !!main && main.scrollHeight > main.clientHeight + 1,
      rest: box(document.querySelector('.rest-timer.floating')),
      modal: box(document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal')),
      extra: extraSel ? box(document.querySelector(extraSel)) : null,
      view: document.body.dataset.view,
    };
  };
  // The toast's bottom edge as the stylesheet anchors it NOW, whatever frame of its slide is on screen.
  window.__qaAnchor = () => {
    const toast = document.getElementById('toast'), fab = document.getElementById('food-fab').getBoundingClientRect();
    return { edge: Math.round((window.innerHeight - parseFloat(getComputedStyle(toast).bottom)) * 10) / 10, fabTop: fab.top, shown: toast.classList.contains('show'), undo: toast.classList.contains('has-action') };
  };
};

async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: theme, timezoneId: 'Asia/Riyadh', locale: lang === 'ar' ? 'ar-SA' : 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && window.__vltReady, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 9000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked(); DB.prefs.setUnit('kg');
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    // A target, so Food is its whole dashboard (the ring, the water card, both doors) and the page scrolls.
    DB.nutrition.setTargets({ calories: 2400, protein: 150, carbs: 0, fat: 0 });
    navigate('home');
  }, { lang, theme });
  await page.evaluate(INSTALL);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, guard, lang, theme, name: NAME[lang] };
}

// ── the state a case starts from, and the one it leaves ─────────────────────
// No sheet of either kind, no toast, no rest, no food rows on any day (the add
// sheet's «recent» chips are read from them), the Undo ledger empty, the
// ordinary text size, the phone-sized viewport.
const settle = async (kit) => {
  await kit.ev(() => {
    try { closeModal(); } catch (_) {}
    const root = document.getElementById('modal-root'); if (root) root.innerHTML = '';
    document.querySelectorAll('.sheet-overlay').forEach((s) => { if (typeof s.__close === 'function') s.__close(); else s.remove(); });
    hideToast();
    try { clearRestTimer(); } catch (_) {}
    for (const d of Object.keys(STATE.foodLogs)) DB.foodLogs.listForDate(d).slice().forEach((r) => DB.foodLogs.remove(d, r.id));
    DB.foods.list().forEach((f) => DB.foods.remove(f.id));
    DB.undo.clear();
    DB.prefs.setTextLg(false); document.body.classList.remove('text-lg');
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
  });
  await kit.page.setViewportSize({ width: 375, height: 812 });
};
const go = async (kit, view, ctx) => {
  await kit.ev(({ view, ctx }) => {
    hideToast();
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx || {});
    document.querySelector('.main').scrollTop = 0;
  }, { view, ctx });
  // The arrival has rested: the page's lowest box has not moved for two polls.
  await kit.page.waitForFunction(() => {
    const k = JSON.stringify(window.__qaGeo().low);
    const same = window.__qaLow === k; window.__qaLow = k; return same;
  }, null, { timeout: 5000, polling: 80 });
};
const food = (kit) => go(kit, 'food');
const small = async (kit) => {
  await kit.page.setViewportSize({ width: 320, height: 640 });
  await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
};

// ── the toasts the cases raise, each the way the app raises it ──────────────
// A plain toast lives 1.8 s; the cases give it eight, so that a slow machine
// measures a toast and not its absence. Its place does not depend on its life.
const plain = (kit, key, name) => kit.ev(({ key, name }) => showToast(t(key).replace('{name}', name), { duration: 8000 }), { key, name: name || '' });
// The app's own Undo: one real write through the one meal write, announced by offerUndo.
const undo = (kit) => kit.ev((row) => {
  const r = DB.foodLogs.addMany(todayISO(), [row]);
  if (!r || !r.ok) throw new Error('setup: the row was refused');
  if (!offerUndo(t('fl_recent_logged').replace('{name}', row.name), r)) throw new Error('setup: no Undo was offered');
}, ROW(kit.name));
// The same Undo toast, given a minute instead of its ten seconds: for the case that opens and closes two sheets under ONE toast.
const standingUndo = (kit) => kit.ev((name) => showToast(t('fl_recent_logged').replace('{name}', name), { duration: 60000, actionLabel: t('undo'), onAction: () => {} }), kit.name);
// A food eaten yesterday: what the add sheet offers again as a «recent» chip.
const ateYesterday = (kit) => kit.ev((row) => {
  const r = DB.foodLogs.addMany(addDaysISO(todayISO(), -1), [row]);
  if (!r || !r.ok) throw new Error('setup: the seeded row was refused');
  DB.undo.clear();
}, ROW(kit.name));
// On screen, fully drawn, and STILL — then everything around it, read in the same task.
const still = async (kit, extraSel) => (await kit.page.waitForFunction((extraSel) => {
  const el = document.getElementById('toast');
  if (!el.classList.contains('show') || getComputedStyle(el).opacity !== '1') { window.__qaToast = ''; return false; }
  const g = window.__qaGeo(extraSel), k = JSON.stringify(g.toast);
  const same = window.__qaToast === k;
  window.__qaToast = k;
  return same ? g : false;
}, extraSel || '', { timeout: 6000, polling: 50 })).jsonValue();
// A sheet up and still (a sheet still rising would hand a case the rectangle of a frame in flight).
const sheetStill = async (kit, sel) => {
  await kit.page.waitForFunction((sel) => {
    const m = document.querySelector(sel);
    const k = m ? JSON.stringify(m.getBoundingClientRect()) : '';
    const same = !!m && window.__qaSheet === k;
    window.__qaSheet = k;
    return same;
  }, sel, { timeout: 5000, polling: 60 });
};

// ── the measures ────────────────────────────────────────────────────────────
const hits = (a, b) => !!a && !!b && a[0] < b[2] - 0.5 && b[0] < a[2] - 0.5 && a[1] < b[3] - 0.5 && b[1] < a[3] - 0.5;
const fmt = (r) => (r ? '[' + r.map((n) => Math.round(n)).join(',') + ']' : 'none');
// ABOVE THE «+»: no shared pixel, a real gap, and no further up than a gap needs to be.
function aboveFab(g, what) {
  assert.ok(g.fab, `setup: the «+» is on screen (${what})`);
  assert.ok(!hits(g.toast, g.fab), `${what}: the toast ${fmt(g.toast)} lies on the «+» ${fmt(g.fab)}`);
  const gap = Math.round((g.fab[1] - g.toast[3]) * 10) / 10;
  assert.ok(gap >= 8 && gap <= 16, `${what}: the toast's bottom edge is ${gap} px above the «+» (wanted 8–16: clear of it, and no further up than that)`);
  assert.ok(g.toast[0] >= 0 && g.toast[2] <= g.vw + 0.5 && g.toast[1] >= 0, `${what}: the toast ${fmt(g.toast)} is on the screen (${g.vw} px wide)`);
  if (g.halo) {
    assert.ok(g.halo[3] > g.act[3], `setup: Undo's tap halo reaches below its button (${what})`);
    assert.ok(!hits(g.halo, g.fab), `${what}: Undo's tap halo ${fmt(g.halo)} reaches the «+» ${fmt(g.fab)}`);
  }
  assert.ok(g.fabTaps, `${what}: a tap on the middle of the «+» reaches the «+»`);
}
// THE OLD PLACE: 16 px above the nav's top edge, measured against the nav itself.
function oldPlace(g, what) {
  assert.ok(g.nav, `setup: the nav is on screen (${what})`);
  const gap = Math.round((g.nav[1] - g.toast[3]) * 10) / 10;
  assert.equal(gap, 16, `${what}: the toast's bottom edge is ${gap} px above the nav (it was 16, and is still)`);
}

const CASES = [
  ['Food: a toast sits above the «+», never on it', async (kit) => {
    await food(kit);
    const before = await kit.ev(() => window.__qaGeo());
    // The button itself has not moved or changed size: 68 × 60, 16 px above the nav, 16 px in from the start edge.
    assert.deepEqual([before.fab[2] - before.fab[0], before.fab[3] - before.fab[1], before.nav[1] - before.fab[3], kit.lang === 'ar' ? before.vw - before.fab[2] : before.fab[0]],
      [68, 60, 16, 16], 'the «+» is where it was and the size it was');
    await plain(kit, 'fl_recent_logged', kit.name);
    aboveFab(await still(kit), 'a long plain toast');
    await plain(kit, 'cx_stale');
    aboveFab(await still(kit), 'an error');
    await plain(kit, 'sc_saved');
    aboveFab(await still(kit), 'a short toast');
    await undo(kit);
    const g = await still(kit);
    assert.ok(g.act, 'setup: this toast carries Undo');
    aboveFab(g, 'an Undo');
  }],
  ['Food: a food logged from the add sheet has its Undo above the «+» from the first frame', async (kit) => {
    // The app's own route, start to finish: the «+», the add sheet, a «recent» chip.
    await ateYesterday(kit);
    await food(kit);
    await kit.page.locator('#food-fab').click();
    await kit.page.waitForSelector('.sheet-overlay.open [data-recent]', { timeout: 4000 });
    await sheetStill(kit, '.sheet-overlay.open .add-sheet');
    const first = await kit.ev(() => {
      document.querySelector('.sheet-overlay.open [data-recent]').click();
      const sheet = document.querySelector('.sheet-overlay');
      return Object.assign(window.__qaAnchor(), { leaving: !!sheet && !sheet.classList.contains('open') });
    });
    assert.ok(first.shown && first.undo, 'setup: the chip logged its food and offered Undo');
    assert.ok(first.leaving, 'setup: the add sheet is still in the document, on its way out');
    assert.ok(first.edge <= first.fabTop - 8, `in the very task that raised it the Undo is anchored above the «+» (its bottom edge at ${first.edge}, the «+» from ${first.fabTop}): no frame of it on the button`);
    aboveFab(await still(kit), 'the Undo, at rest');
  }],
  ['Food: a toast raised as a sheet closes is above the «+» from the first frame', async (kit) => {
    // The manual entry's own Save: it closes the sheet and says «added» in one task.
    await food(kit);
    await kit.ev(() => openManualFoodEntry(null, () => {}));
    await kit.page.waitForSelector(LIVE + ' #mf-save', { timeout: 4000 });
    await sheetStill(kit, LIVE + ' .modal');
    await kit.page.locator(LIVE + ' #mf-name').fill('QA oats');
    await kit.page.locator(LIVE + ' #mf-cal').fill('300');
    const first = await kit.ev(() => {
      document.getElementById('mf-save').click();
      return Object.assign(window.__qaAnchor(), { leaving: !!document.querySelector('#modal-root .modal-overlay.is-out') });
    });
    assert.ok(first.shown, 'setup: Save said so in a toast');
    assert.ok(first.leaving, 'setup: the sheet is still in the document, on its way out');
    assert.ok(first.edge <= first.fabTop - 8, `in the very task that raised it the toast is anchored above the «+» (its bottom edge at ${first.edge}, the «+» from ${first.fabTop})`);
  }],
  ['the end of the Food page: the toast above the «+» clears the page\'s last box', async (kit) => {
    for (const size of ['375', '320']) {
      if (size === '320') await small(kit);
      await food(kit);
      await kit.ev(() => { const m = document.querySelector('.main'); m.scrollTop = m.scrollHeight; });
      await undo(kit);
      const g = await still(kit);
      const at = `${size} px${size === '320' ? ', larger text' : ''}`;
      assert.ok(g.scrolls && g.atEnd, `setup: the Food page scrolls, and it is at its end (${at})`);
      aboveFab(g, `an Undo at the end of the page (${at})`);
      assert.ok(g.low[3] <= g.toast[1] + 0.5, `${at}: the page's last box (${g.lowName}, down to ${Math.round(g.low[3])}) ends above the toast (from ${Math.round(g.toast[1])}): nothing of the page is under it`);
      await kit.ev(() => hideToast());
    }
  }],
  ['another view keeps the toast where it was: Home, the food log, the suggestions page', async (kit) => {
    const today = await kit.ev(() => todayISO());
    for (const [view, ctx] of [['home'], ['foodlog', { date: today }], ['suggestions']]) {
      await go(kit, view, ctx);
      await plain(kit, 'fl_recent_logged', kit.name);
      const g = await still(kit);
      assert.equal(g.view, view, `setup: this is «${view}»`);
      assert.equal(g.fab, null, `setup: «${view}» has no floating «+»`);
      oldPlace(g, `on «${view}»`);
    }
  }],
  ['a sheet over Food keeps the toast where the sheet made room for it', async (kit) => {
    for (const size of ['375', '320']) {
      if (size === '320') await small(kit);
      const at = `${size} px${size === '320' ? ', larger text' : ''}`;
      await food(kit);
      await kit.ev(() => openManualFoodEntry(null, () => {}));
      await kit.page.waitForSelector(LIVE + ' #mf-save', { timeout: 4000 });
      await sheetStill(kit, LIVE + ' .modal');
      // Typed work, then a way out: the sheet refuses once and says why, in a toast that stands.
      await kit.page.locator(LIVE + ' #mf-name').fill('QA');
      await kit.ev(() => requestClose());
      let g = await still(kit, LIVE + ' #mf-save');
      assert.ok(g.modal && /holds-sheet/.test(g.cls), `setup: the sheet is still open under its instruction (${at})`);
      oldPlace(g, `the unsaved-changes instruction over a sheet (${at})`);
      // The sheet's Save is scrolled to its resting place before it is compared with the toast.
      await kit.ev((sel) => { const m = document.querySelector(sel); m.scrollTop = m.scrollHeight; }, LIVE + ' .modal');
      g = await still(kit, LIVE + ' #mf-save');
      assert.ok(g.extra && !hits(g.toast, g.extra), `${at}: the instruction ${fmt(g.toast)} lies on the sheet's Save ${fmt(g.extra)}`);
      // An Undo over the same sheet, clean again.
      await kit.page.locator(LIVE + ' #mf-name').fill('');
      await undo(kit);
      g = await still(kit, LIVE + ' #mf-save');
      assert.ok(g.modal && g.act, `setup: an Undo over the open sheet (${at})`);
      oldPlace(g, `an Undo over a sheet (${at})`);
      await kit.ev((sel) => { const m = document.querySelector(sel); m.scrollTop = m.scrollHeight; }, LIVE + ' .modal');
      g = await still(kit, LIVE + ' #mf-save');
      assert.ok(g.extra && !hits(g.toast, g.extra), `${at}: the Undo ${fmt(g.toast)} lies on the sheet's Save ${fmt(g.extra)}`);
      await kit.ev(() => { closeModal(); hideToast(); });
      await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), null, { timeout: 4000 });
    }
  }],
  ['the add sheet over Food keeps the toast where it was', async (kit) => {
    await food(kit);
    await kit.page.locator('#food-fab').click();
    await kit.page.waitForSelector('.sheet-overlay.open .add-sheet', { timeout: 4000 });
    await sheetStill(kit, '.sheet-overlay.open .add-sheet');
    await plain(kit, 'sc_failed');
    const g = await still(kit);
    assert.equal(await kit.ev(() => !!document.querySelector('.sheet-overlay.open')), true, 'setup: the add sheet is open under the toast');
    oldPlace(g, 'a toast over the add sheet');
  }],
  ['a sheet opened under a standing Undo takes it back to its old place, and closing the sheet lifts it again', async (kit) => {
    // The toast is already on screen each time: its place has to follow the sheet, both ways and for both kinds of sheet.
    await food(kit);
    await standingUndo(kit);
    aboveFab(await still(kit), 'the standing Undo, before any sheet');
    // The «+» itself, tapped under the Undo: the add sheet rises over Food.
    await kit.page.locator('#food-fab').click();
    await kit.page.waitForSelector('.sheet-overlay.open .add-sheet', { timeout: 4000 });
    await sheetStill(kit, '.sheet-overlay.open .add-sheet');
    let g = await still(kit);
    assert.ok(g.act, 'setup: the Undo is still on screen over the add sheet');
    oldPlace(g, 'the standing Undo, once the add sheet is open');
    await kit.ev(() => document.querySelector('.sheet-overlay').__close());
    await kit.page.waitForFunction(() => !document.querySelector('.sheet-overlay'), null, { timeout: 4000 });
    aboveFab(await still(kit), 'the standing Undo, once the add sheet has closed');
    await kit.ev(() => openManualFoodEntry(null, () => {}));
    await kit.page.waitForSelector(LIVE + ' #mf-save', { timeout: 4000 });
    await sheetStill(kit, LIVE + ' .modal');
    g = await still(kit);
    assert.ok(g.act && g.modal, 'setup: the Undo is still on screen over the sheet');
    oldPlace(g, 'the standing Undo, once a sheet is open');
    await kit.ev(() => closeModal());
    await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), null, { timeout: 4000 });
    aboveFab(await still(kit), 'the standing Undo, once the sheet has closed');
  }],
  ['a rest running: the rest bar\'s own rule places the toast, on Food as on Home', async (kit) => {
    await food(kit);
    // Off the guided screen a started rest floats (startRestTimer's own branch), and it follows the user from view to view.
    await kit.ev(() => startRestTimer(90, 0, null, null));
    await plain(kit, 'fl_recent_logged', kit.name);
    const onFood = await still(kit);
    assert.ok(onFood.rest && onFood.view === 'food', 'setup: a rest bar floats over Food');
    await kit.ev(() => { hideToast(); navigate('home'); });
    await plain(kit, 'fl_recent_logged', kit.name);
    const onHome = await still(kit);
    assert.ok(onHome.rest && onHome.view === 'home', 'setup: the same rest bar floats over Home');
    assert.deepEqual(onFood.toast, onHome.toast, 'with a rest running the toast sits on Food exactly where it sits on Home');
  }],
  ['at 320 px with larger text a two-line toast sits above the «+»', async (kit) => {
    await small(kit);
    await food(kit);
    await plain(kit, 'fl_recent_logged', kit.name);
    let g = await still(kit);
    assert.ok(g.toast[3] - g.toast[1] > 50, `setup: at this width the toast wraps to two lines (${Math.round(g.toast[3] - g.toast[1])} px tall)`);
    aboveFab(g, 'a two-line toast');
    await undo(kit);
    g = await still(kit);
    aboveFab(g, 'a two-line Undo');
  }],
];

async function main() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  const t0 = Date.now();
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;
        try { await fn(kit); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
        finally { await settle(kit).catch(() => {}); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  toast place UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  toast place UI (${passed} cases, AR/dark + EN/light, 375px and 320px with larger text, ${Math.round((Date.now() - t0) / 1000)} s): on Food a toast sits above the «+» and never on it — plain, long, an error, an Undo with its tap halo, two lines at 320 px — from its first frame when a sheet closes under it, and a standing one follows a sheet down and up again; the end of the Food page keeps its last box clear of it; Home, the food log and the suggestions page keep the old place; over a sheet or the add sheet the toast stays where the sheet made room for it, off its Save; with a rest running the rest bar's rule places it on Food as on Home`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });
