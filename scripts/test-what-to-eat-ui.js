// «ماذا آكل الآن؟» ON THE FOOD TAB (v436) — in real Chrome.
//
//   node scripts/test-what-to-eat-ui.js            # ar/dark + en/light, 375px (and 320px where a case says)
//   QA_ONLY=<words> node scripts/test-what-to-eat-ui.js
//
// WHY THIS EXISTS. scripts/test-what-to-eat.js holds the RULE (a budget and a
// pool to one ranked list). This suite holds what the owner meets: one door on
// Food (the dashboard's last box, under «اقتراحات اليوم», in both states), a
// sheet that names ONE meal of the hour with its portion, its four figures, what
// the ring will read after it and its ingredients at that portion; «وجبة أخرى»
// that walks the hour's list in place while its button stays under the thumb;
// «سجّلها» that writes the portion it shows (servings p, the source and its id),
// moves the ring to the after-line's figure and offers Undo; the question that
// moves on after a meal of the hour is logged (after dinner: a small late snack);
// the done, small and none sheets that offer nothing; a bundle at its own cap,
// an own recipe at its own scale, a hostile name drawn as text; the day read at
// the tap (midnight); one row for a double tap; and every figure inside its box
// at 320 px with larger text in both languages. Since the review: the tap asks
// the question again and refuses a stale answer (a row, a bundle edit, a
// deleted recipe, a new target, a bundle re-split under the portion shown or
// midnight under the open sheet), while an hour passing or an
// unrelated recipe still logs; the third meal of a walk is the one logged; a
// bundle repeated today stays «eaten»; a one-row list draws no figures line;
// the headline figure steps down only at 320 px; an account change under the
// sheet writes nothing; the toast keeps its reading order with a name in the
// other script; an amount hugs its row's end edge in both languages.
//
// THE HOUR DECIDES EVERY ANSWER, so the page's clock is FIXED per case
// (page.clock.setFixedTime: Date is pinned, the timers keep running) on
// 17 November 2026 in Riyadh, and every case names its hour. A row «logged at
// 08:30» is written with the clock at 08:30 and the question asked after the
// clock moves on. Every case seeds its own state through DB.* and drives the
// screen the way a thumb does. The expectations are the dictionary's own
// strings, built with t() in the page, and the figures of the spec's worked
// examples (§10, recomputed with the build's three WTE_CAT overrides).
//
// The harness is scripts/test-next-target-ui.js's: the repo over loopback,
// js/cloud.js as an offline stub, every non-loopback request aborted.
'use strict';

/* global WTE_CUR:writable, wtePool:writable */

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const LIVE = '#modal-root .modal-overlay:not(.is-out)';
const DAY = '2026-11-17', NEXT_DAY = '2026-11-18';
const pad = (n) => String(n).padStart(2, '0');
// A Riyadh wall-clock time on the suite's day (the context's zone is Asia/Riyadh).
const at = (h, m = 0, s = 0, day = DAY) => new Date(`${day}T${pad(h)}:${pad(m)}:${pad(s)}+03:00`);

async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', colorScheme: theme, timezoneId: 'Asia/Riyadh', locale: lang === 'ar' ? 'ar-SA' : 'en-US' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(at(8));
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
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const clock = (h, m, s, day) => page.clock.setFixedTime(at(h, m, s, day));
  return { ctx, page, ev, errors, guard, lang, theme, clock };
}

// ── the state a case starts from ────────────────────────────────────────────
// Everything of the food domain wiped (every day's rows, the recipes, the
// bundles, the body weights), the calculator's profile blank (no weight: the
// protein aim is the default 30), the target set — or none at all, as on day
// one — the Undo ledger empty and «وجبة أخرى»'s cursor back at the start.
const wipe = (kit, o) => kit.ev((o) => {
  try { closeModal(); } catch (_) {}
  const root = document.getElementById('modal-root'); if (root) root.innerHTML = '';
  hideToast();
  for (const d of Object.keys(STATE.foodLogs)) DB.foodLogs.listForDate(d).slice().forEach((r) => DB.foodLogs.remove(d, r.id));
  DB.recipes.list().forEach((r) => DB.recipes.remove(r.id));
  DB.mealBundles.list().forEach((b) => DB.mealBundles.remove(b.id));
  DB.bodyweight.list().forEach((e) => DB.bodyweight.remove(e.date));
  const blank = { sex: 'male', age: null, heightCm: null, weightKg: null, activity: 'moderate', goal: 'maintain' };
  if (o.target) {
    STATE.nutrition = Object.assign(DB.nutrition.get(), { profile: blank });
    DB.nutrition.setTargets({ calories: o.target, protein: o.protein || 0, carbs: 0, fat: 0 });
  } else {
    STATE.nutrition = { mode: 'off', profile: blank, targets: { calories: 0, protein: 0, carbs: 0, fat: 0 } };
  }
  document.body.classList.remove('text-lg');
  DB.prefs.setTextLg(false);
}, o);

// o = { target, protein, kg, logs: [[h, m, kcal, protein]], recipes: [...], bundles: [...], at: [h, m, s, day] }
// Returns the ids of the recipes and bundles it made, in order.
async function setup(kit, o) {
  await kit.clock(8);
  await wipe(kit, o);
  for (const [h, m, kcal, protein] of o.logs || []) {
    await kit.clock(h, m);
    await kit.ev(({ kcal, protein }) => {
      const r = DB.foodLogs.addMany(todayISO(), [{ name: 'QA meal', servings: 1, calories: kcal, protein: protein || 0, carbs: 0, fat: 0 }]);
      if (!r || !r.ok) throw new Error('setup: the seeded meal was refused');
    }, { kcal, protein });
  }
  const ids = await kit.ev(({ recipes, bundles }) => ({
    recipes: (recipes || []).map((r) => { const x = DB.recipes.add(r); if (!x) throw new Error('setup: the recipe was refused'); return x.id; }),
    bundles: (bundles || []).map((b) => { const x = DB.mealBundles.update(null, b); if (!x.ok) throw new Error('setup: the bundle was refused'); return x.entity.id; }),
  }), { recipes: o.recipes, bundles: o.bundles });
  await kit.clock(...(o.at || [8]));
  await kit.ev((kg) => {
    if (kg) DB.bodyweight.log(todayISO(), kg);
    DB.undo.clear();
    WTE_CUR = { sig: '', i: 0 };
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    navigate('food');
  }, o.kg || 0);
  if (!o.target) await noTargetFood(kit);
  return ids;
}
// DAY ONE OPENS THE CALCULATOR BY ITSELF (food.js, 250 ms after the Food tab
// arrives with no target). It is closed before any tap, or the tap would land on it.
async function noTargetFood(kit) {
  await kit.page.waitForFunction((s) => !!document.querySelector(s), LIVE + ' #calc-body', { timeout: 1500 }).catch(() => {});
  await kit.ev(() => { try { closeModal(); } catch (_) {} });
  await sheetGone(kit);
}
const sheetGone = (kit) => kit.page.waitForFunction((s) => !document.querySelector(s), LIVE, { timeout: 3000 });
// Up, and STILL: the sheet's own box has not moved for two polls (a sheet still
// rising would hand a case the rectangle of a frame in flight).
const sheetUp = async (kit, sel) => {
  await kit.page.waitForFunction((s) => !!document.querySelector(s), LIVE + ' ' + (sel || '.modal-title'), { timeout: 4000 });
  await kit.page.waitForFunction((s) => {
    const m = document.querySelector(s);
    const k = m ? JSON.stringify(m.getBoundingClientRect()) : '';
    const still = !!m && window.__qaRect === k;
    window.__qaRect = k;
    return still;
  }, LIVE + ' .modal', { timeout: 4000, polling: 50 });
};
const DOOR = '.view.active [data-wte-door]';
const openDoor = async (kit) => { await kit.page.locator(DOOR).click(); await sheetUp(kit); };
const tapNext = (kit) => kit.page.locator(LIVE + ' [data-wte-next]').click();
const tapLog = (kit) => kit.page.locator(LIVE + ' [data-wte-log]').click();
const settle = (kit) => kit.ev(() => {
  try { closeModal(); } catch (_) {}
  const root = document.getElementById('modal-root'); if (root) root.innerHTML = '';
  hideToast();
  document.body.classList.remove('text-lg'); DB.prefs.setTextLg(false);
  if (window.__qaWtePool) { wtePool = window.__qaWtePool; window.__qaWtePool = null; }
  // A case that failed half-way leaves nothing wrapped behind it.
  if (window.__qaReal) { DB.foodLogs.addMany = window.__qaReal.addMany; DB.mealBundles.log = window.__qaReal.log; showToast = window.__qaReal.toast; window.__qaReal = null; }
  if (window.__qaUid) { Cloud.getLastUid = window.__qaUid; window.__qaUid = null; }
  document.getElementById('add-sheet-overlay')?.remove();
  navigate('home');
});

// ── what the screen shows ───────────────────────────────────────────────────
function readWte() {
  const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
  if (!m) return null;
  const sp = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const title = m.querySelector('.modal-title');
  const body = m.querySelector('#wte-body');
  const lines = body ? [...body.querySelectorAll(':scope > p.shr-figs')] : [];
  const items = m.querySelector('#wte-items');
  const kc = m.querySelector('.rec-bar-kcal');
  return {
    title: title ? title.textContent : null, titleKids: title ? title.children.length : null,
    line: sp(lines[0]), portion: sp(body && body.querySelector('.shr-figs-k')), lines: lines.length,
    cells: [...m.querySelectorAll('.rec-bar-n')].map((x) => x.textContent.trim()),
    kcalCls: kc ? [...kc.classList].filter((c) => c === 'is-long' || c === 'is-xlong') : null,
    after: lines[1] ? sp(lines[1]) : null,
    afterNum: lines[1] && lines[1].querySelector('.num') ? lines[1].querySelector('.num').textContent.trim() : null,
    goal: !!m.querySelector('[data-wte-goal]'),
    goalBetween: (() => { const g = m.querySelector('[data-wte-goal]'); return !!g && g.previousElementSibling === body && g.nextElementSibling === items; })(),
    names: items ? [...items.querySelectorAll('.cx-row > span:first-child')].map((x) => x.textContent) : [],
    qty: items ? [...items.querySelectorAll('[data-qty]')].map((x) => x.textContent.trim()) : [],
    rows: items ? items.querySelectorAll('.cx-row').length : 0,
    figRows: items ? items.querySelectorAll('.cx-row > .rec-view-figs').length : 0,
    itemsShown: items ? getComputedStyle(items).display !== 'none' : null,
    itemsKids: items ? items.childNodes.length : null,
    buttons: [...m.querySelectorAll('.btn')].map((b) => (b.hasAttribute('data-wte-log') ? 'log' : b.hasAttribute('data-wte-next') ? 'next' : b.className)),
    empty: sp(m.querySelector('.shr-empty')),
    nums: m.querySelectorAll('.num').length,
    text: m.textContent,
  };
}
// The question as the page asks it now (the expected pick is computed HERE, in the page).
const ask = (kit) => kit.ev(() => {
  const a = wteAsk();
  return { state: a.b.state, period: a.b.period, n: a.n, list: a.list.map((x) => ({ id: x.id, kind: x.row.kind, name: x.row.name, p: x.p, kcal: x.kcal, o: x.o, e: x.e,
    names: wteItems(x.row, x.p).map((i) => i.name),
    // the amounts as recViewRowsHtml prints them: only a non-blank one, trimmed (U3's rule)
    qty: wteItems(x.row, x.p).map((i) => String(i.qty || '')).filter((q) => q.trim()).map((q) => q.trim()) })) };
});
const tr = (kit, key) => kit.ev((k) => t(k), key);
const line = (kit, keys, extra) => kit.ev(({ keys, extra }) => keys.map((k) => t(k)).concat(extra || []).join(' · '), { keys, extra });
const afterLine = (kit, n) => kit.ev((n) => t('wte_after').replace('{n}', fmtNum(n)), n);
const num = (kit, n) => kit.ev((n) => fmtNum(n), n);
const presetName = (kit, id) => kit.ev((id) => { const p = SUGGESTION_PRESETS.find((x) => x.id === id); return DB.prefs.get().lang === 'ar' ? p.ar : p.en; }, id);
const dishName = (kit, en) => kit.ev((en) => { const f = FOOD_PRESETS.find((x) => x.cat === 'meals' && x.en === en); return DB.prefs.get().lang === 'ar' ? f.ar : f.en; }, en);
const rowsOn = (kit, day) => kit.ev((day) => DB.foodLogs.listForDate(day || todayISO()).map((r) => ({ name: r.name, servings: r.servings, calories: r.calories, source: r.source, sourceId: r.sourceId })), day);
const ring = (kit) => kit.ev(() => { const n = document.querySelector('.view.active .cal-ring-num'); return n ? n.textContent.trim() : null; });
const toastNow = (kit) => kit.ev(() => {
  const el = document.querySelector('.toast.show');
  return el ? { msg: (el.querySelector('.toast-msg') || el).textContent.trim(), undo: !!el.querySelector('.toast-action') } : null;
});
const doorFocused = (kit) => kit.ev(() => !!document.activeElement && document.activeElement.matches('#nutri-host [data-wte-door]'));
const noPlaceholder = (r) => { assert.ok(r && !/[{}]/.test(r.text) && !/NaN/.test(r.text), `nothing on the sheet carries an unfilled placeholder or NaN: ${r && r.text}`); return r; };
const read = async (kit) => noPlaceholder(await kit.ev(readWte));
const narrow = async (kit) => {
  await kit.page.setViewportSize({ width: 320, height: 640 });
  await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
};
const wide = async (kit) => {
  await kit.ev(() => { DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); });
  await kit.page.setViewportSize({ width: 375, height: 812 });
};

// THE FIT MEASURE (U11), in the page. Side to side only: the sheet scrolls
// vertically by design. A control's TEXT is measured by its text nodes' own
// rectangles (Range.getClientRects), so text that overflows a clamped box is
// seen and a .link-btn's ::after halo is not; a figure is held to its CELL.
function fitProblems() {
  const out = [];
  const nm = (el) => el.getAttribute('class') || el.tagName;
  const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
  if (!m) return ['no sheet'];
  const box = m.getBoundingClientRect();
  for (const el of m.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.left < box.left - 1 || r.right > box.right + 1) out.push(`${nm(el)} ${Math.round(r.left)}–${Math.round(r.right)} outside the sheet ${Math.round(box.left)}–${Math.round(box.right)}`);
  }
  if (m.scrollWidth > m.clientWidth + 1) out.push(`the sheet scrolls sideways (${m.scrollWidth} > ${m.clientWidth})`);
  const textIn = (ctl, frame) => {
    const f = frame.getBoundingClientRect();
    const w = document.createTreeWalker(ctl, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) {
        if (r.left < f.left - 1 || r.right > f.right + 1) {
          out.push(`«${n.textContent.trim().slice(0, 24)}» ${Math.round(r.left)}–${Math.round(r.right)} outside its ${nm(frame)} ${Math.round(f.left)}–${Math.round(f.right)}`);
        }
      }
    }
  };
  for (const c of m.querySelectorAll('.wte-goal, .cx-actions > .btn, .modal-title, .shr-empty, #wte-body > p.shr-figs')) textIn(c, c);
  for (const c of m.querySelectorAll('.rec-bar-n')) textIn(c, c.closest('.rec-bar-cell'));
  // A button's words wrap inside its height, never past it.
  for (const c of m.querySelectorAll('.cx-actions > .btn')) if (c.scrollHeight > c.clientHeight + 1) out.push(`«${c.textContent.trim()}» is taller than its button (${c.scrollHeight} > ${c.clientHeight})`);
  // The goal link's halo (its ::after) stays 12 px clear of the figures above and the list below.
  const g = m.querySelector('.wte-goal');
  if (g) {
    const r = g.getBoundingClientRect(), a = getComputedStyle(g, '::after');
    // A sentence centred under the figures: every line of it, the wrapped one too.
    const mid = (r.left + r.right) / 2;
    for (const n of [...g.childNodes].filter((x) => x.nodeType === 3 && x.textContent.trim())) {
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const lr of rg.getClientRects()) if (Math.abs((lr.left + lr.right) / 2 - mid) > 2) out.push(`a line of the goal link is not centred (${Math.round((lr.left + lr.right) / 2)} against ${Math.round(mid)})`);
    }
    const top = r.top + parseFloat(a.top), bottom = r.bottom - parseFloat(a.bottom);
    const above = m.querySelector('#wte-body').getBoundingClientRect().bottom;
    if (top - above < 12 - 0.5) out.push(`the goal link's halo is ${Math.round(top - above)} px from the figures above it`);
    const items = m.querySelector('#wte-items');
    if (items && getComputedStyle(items).display !== 'none' && items.children.length) {
      const below = items.getBoundingClientRect().top;
      if (below - bottom < 12 - 0.5) out.push(`the goal link's halo is ${Math.round(below - bottom)} px from the list below it`);
    }
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('the page scrolls sideways');
  return out;
}
// The toast, by the same measure: every part inside it side to side, each
// text inside its own box, the toast on the screen.
function toastProblems() {
  const out = [];
  const el = document.querySelector('.toast.show');
  if (!el) return ['no toast'];
  const box = el.getBoundingClientRect();
  if (box.left < -0.5 || box.right > window.innerWidth + 0.5) out.push(`the toast ${Math.round(box.left)}–${Math.round(box.right)} leaves the screen`);
  for (const c of el.querySelectorAll('*')) {
    const r = c.getBoundingClientRect();
    if (r.left < box.left - 1 || r.right > box.right + 1) out.push(`${c.className} ${Math.round(r.left)}–${Math.round(r.right)} outside the toast ${Math.round(box.left)}–${Math.round(box.right)}`);
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.parentElement !== c || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const f = c.getBoundingClientRect();
      for (const r of rg.getClientRects()) if (r.left < f.left - 1 || r.right > f.right + 1) out.push(`«${n.textContent.trim().slice(0, 24)}» outside its ${c.className}`);
    }
  }
  return out;
}

// The headline figure's size against a fresh twin without the step classes, in
// the same cell (a fresh node has no transition to report mid-way), and its
// glyphs against the cell's content box.
function kcalSize() {
  const k = document.querySelector('#modal-root .modal-overlay:not(.is-out) .rec-bar-kcal');
  const twin = document.createElement('span');
  twin.className = 'num rec-bar-n rec-bar-kcal';
  twin.textContent = k.textContent;
  k.parentNode.appendChild(twin);
  const shown = parseFloat(getComputedStyle(k).fontSize), full = parseFloat(getComputedStyle(twin).fontSize);
  twin.remove();
  const cell = k.closest('.rec-bar-cell'), cr = cell.getBoundingClientRect(), cs = getComputedStyle(cell);
  const L = cr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), R = cr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
  const rg = document.createRange(); rg.selectNodeContents(k);
  const out = [...rg.getClientRects()].filter((r) => r.left < L - 0.5 || r.right > R + 0.5).map((r) => `${r.left.toFixed(1)}–${r.right.toFixed(1)} outside the cell's ${L.toFixed(1)}–${R.toFixed(1)}`);
  return { text: k.textContent, shown, full, out };
}
// Counts the writes and the toasts while a case taps: DB.foodLogs.addMany,
// DB.mealBundles.log (which calls addMany itself) and showToast, wrapped in
// place; uncountCalls puts the three back.
const countCalls = (kit) => kit.ev(() => {
  const c = window.__qaCalls = { addMany: 0, log: 0, toasts: [] };
  const real = window.__qaReal = window.__qaReal || { addMany: DB.foodLogs.addMany, log: DB.mealBundles.log, toast: showToast };
  DB.foodLogs.addMany = function (...a) { c.addMany++; return real.addMany.apply(this, a); };
  DB.mealBundles.log = function (...a) { c.log++; return real.log.apply(this, a); };
  showToast = function (...a) { c.toasts.push(a[0]); return real.toast.apply(this, a); };
});
const uncountCalls = (kit) => kit.ev(() => {
  const real = window.__qaReal;
  if (!real) return;
  DB.foodLogs.addMany = real.addMany; DB.mealBundles.log = real.log; showToast = real.toast;
  window.__qaReal = null;
});
// A tap on a STALE answer: nothing written on any of `days`, the toast says
// the meal changed, the sheet stays, focus stays on «سجّلها».
async function staleTap(kit, what, days) {
  const before = {};
  for (const d of days) before[d] = await rowsOn(kit, d);
  await tapLog(kit);
  await kit.page.waitForFunction(() => !!document.querySelector('.toast.show'), null, { timeout: 2000 })
    .catch(() => { throw new Error(`${what}: no toast after «سجّلها» (the tap threw, or wrote nothing and said nothing)`); });
  for (const d of days) assert.deepEqual(await rowsOn(kit, d), before[d], `${what}: nothing was written on ${d}`);
  assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'cx_stale'), `${what}: the toast says the meal changed`);
  assert.equal(await kit.ev((s) => !!document.querySelector(s), LIVE + ' [data-wte-log]'), true, `${what}: the sheet stays open`);
  assert.equal(await kit.ev((s) => document.activeElement === document.querySelector(s), LIVE + ' [data-wte-log]'), true, `${what}: focus stays on «سجّلها»`);
}
// A tap that must LOG: the sheet closes. A refusal is named by the case that
// expected none (a bare waitForFunction timeout names no case).
async function loggedTap(kit, what) {
  await tapLog(kit);
  await sheetGone(kit).catch(async () => { throw new Error(`${what}: the sheet is still open after «سجّلها» (the toast: ${JSON.stringify(await toastNow(kit))})`); });
}
// The toast's sentence measured on its own glyphs: where the name, the dash
// and the portion are DRAWN (a Range per substring of the one text node).
function toastOrder({ name, word }) {
  const el = document.querySelector('.toast.show .toast-msg');
  const tn = el && [...el.childNodes].find((n) => n.nodeType === 3);
  if (!tn) return null;
  const s = tn.textContent;
  const box = (i, len) => {
    const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + len);
    const rs = [...r.getClientRects()].filter((x) => x.width > 0);
    return { l: Math.min(...rs.map((x) => x.left)), r: Math.max(...rs.map((x) => x.right)), t: Math.min(...rs.map((x) => x.top)), b: Math.max(...rs.map((x) => x.bottom)) };
  };
  return { s, iso: s.includes(String.fromCharCode(0x2068) + name + String.fromCharCode(0x2069)), rtl: getComputedStyle(el).direction === 'rtl',
    name: box(s.indexOf(name), name.length), dash: box(s.indexOf('—'), 1), word: box(s.indexOf(word), word.length) };
}
// Every ingredient row with an amount, inside `sel`: the row's content box,
// the amount's and the name's rectangles, the amount's lines.
function qtyRects(sel) {
  return [...document.querySelectorAll(sel + ' .cx-row')].filter((r) => r.querySelector(':scope > .rec-view-qty')).map((row) => {
    const cs = getComputedStyle(row), rr = row.getBoundingClientRect();
    const L = rr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), R = rr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const qe = row.querySelector(':scope > .rec-view-qty'), q = qe.getBoundingClientRect(), n = row.querySelector(':scope > span:first-child').getBoundingClientRect();
    const rg = document.createRange(); rg.selectNodeContents(qe);
    const glyphs = [...rg.getClientRects()].filter((x) => x.width > 0);
    const tops = new Set(glyphs.map((x) => Math.round(x.top)));
    // Its one-line width, from a hidden copy that may not wrap.
    const c = qe.cloneNode(true);
    c.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;max-width:none;width:auto';
    row.appendChild(c);
    const natural = c.getBoundingClientRect().width;
    c.remove();
    return { text: qe.textContent, rtl: cs.direction === 'rtl', L, R, q: { l: q.left, r: q.right, w: q.width }, n: { l: n.left, r: n.right, w: n.width }, lines: tops.size, natural,
      g: { l: Math.min(...glyphs.map((x) => x.left)), r: Math.max(...glyphs.map((x) => x.right)) },
      spill: glyphs.filter((x) => x.left < q.left - 0.5 || x.right > q.right + 0.5).length };
  });
}

// ── the fixtures ────────────────────────────────────────────────────────────
// E4 (spec §10): 2,000 kcal and 110 g of protein a day, 500 kcal logged at
// 08:30, asked at 13:00, 80 kg on the scale.
const E4 = { target: 2000, protein: 110, kg: 80, logs: [[8, 30, 500, 0]], at: [13] };
// «منسف البيت»: four servings of 600 / 45 / 50 / 20, its one ingredient «800 غ لحم».
const HOME_MANSAF = { name: 'منسف البيت', servings: 4, items: [{ name: 'لحم', qty: '800 غ', calories: 2400, protein: 180, carbs: 200, fat: 80 }] };
// «فطور النادي» (E17): 392 kcal, 37 g of protein in all — oats once, egg whites twice.
const CLUB = { name: 'فطور النادي', items: [
  { name: 'QA oats', servings: 1, calories: 236, protein: 12, carbs: 40, fat: 4 },
  { name: 'QA egg whites', servings: 2, calories: 78, protein: 12.5, carbs: 1, fat: 2.5 },
] };
// E18b: one item at 16 servings, 300 kcal in all, so DB.mealBundles.maxPortion is 1.25.
const CAPPED = { name: 'QA capped', items: [{ name: 'QA bites', servings: 16, calories: 18.75, protein: 1.875, carbs: 1.25, fat: 0.625 }] };
const HOSTILE = '<img src=x onerror=window.__x=1>';

const CASES = [
  ['U1 the door (08:00): one, the dashboard\'s last box under «اقتراحات اليوم» in both states, with nothing added above the water card; its glyph and words; never a data-shr-* door; a tap opens the sheet', async (kit) => {
    const door = () => kit.ev(() => {
      const v = document.querySelector('.view.active[data-view="food"]');
      const doors = [...v.querySelectorAll('[data-wte-door]')], d = doors[0];
      const like = (name, size) => { const x = document.createElement('div'); x.innerHTML = icon(name, size); return x.firstElementChild.innerHTML; };
      const svgs = d ? [...d.querySelectorAll('svg')] : [];
      const prev = d && d.previousElementSibling, next = d && d.nextElementSibling;
      const kind = (el) => (!el ? null : el.matches('.nutri-hero') ? 'hero' : el.matches('.water-card') ? 'water' : el.matches('[data-shr-door]') ? 'shr' : el.matches('.nutri-setup') ? 'setup' : el.className);
      const shr = v.querySelector('[data-shr-door]'), water = v.querySelector('.water-card');
      return {
        n: doors.length, prev: kind(prev), next: kind(next), shrPrev: kind(shr && shr.previousElementSibling), shrN: v.querySelectorAll('[data-shr-door]').length,
        waterPrev: kind(water && water.previousElementSibling),
        glyph: !!svgs[0] && svgs[0] === d.firstElementChild && svgs[0].innerHTML === like('meal', 20),
        chevron: svgs.length === 2 && svgs[1].innerHTML === like('chevronRight', 16) && !!svgs[1].closest('.icon-mirror.shr-door-chev'),
        name: d ? d.querySelector('.shr-door-name').textContent.trim() : null, want: t('wte_title'),
        shrAttr: d ? [...d.attributes].map((a) => a.name).filter((a) => a.startsWith('data-shr')) : null,
        old: v.querySelectorAll('#shr-card, .shr-card, .shr-periods, [data-shr-period], [data-shr-more], [data-shr-open], .shr-row, .shr-rows, [data-shr-sec]').length,
        tag: d ? d.tagName + '/' + d.getAttribute('type') : null,
      };
    });
    await setup(kit, { target: 2000 });
    let d = await door();
    assert.deepEqual([d.n, d.prev, d.next, d.shrPrev, d.shrN, d.waterPrev], [1, 'shr', null, 'water', 1, 'hero'], `with a target: one door, the last box, after the suggestions door, which still follows the water card — and the water card is still the ring's next sibling: nothing was added above it (${JSON.stringify(d)})`);
    assert.deepEqual([d.glyph, d.chevron, d.name, d.tag], [true, true, d.want, 'BUTTON/button'], 'the bowl glyph first, the question, the mirrored chevron — a button');
    assert.deepEqual([d.shrAttr, d.old], [[], 0], 'it carries no data-shr-* attribute, and nothing of v421\'s card is on Food');
    await openDoor(kit);
    assert.equal(await kit.ev(() => currentView), 'food', 'a tap opens a sheet and does not navigate (the hero\'s catch-all opens the log)');
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    await setup(kit, { target: 0 });
    d = await door();
    assert.deepEqual([d.n, d.prev, d.next, d.shrPrev, d.shrN], [1, 'shr', null, 'setup', 1], `no target: one door, after the suggestions door, which still follows the setup button (${JSON.stringify(d)})`);
    assert.deepEqual([d.glyph, d.name, d.shrAttr, d.old], [true, d.want, [], 0]);
    await openDoor(kit);
    assert.equal(await kit.ev(() => currentView), 'food');
  }],
  ['U2 day one, 08:00, no target, empty library: breakfast at one serving, no after-line, the goal link between the figures and the ingredients; the link opens the calculator and the saved goal reopens the answer, fitted', async (kit) => {
    await setup(kit, { target: 0, at: [8] });
    await openDoor(kit);
    const r = await read(kit);
    const name = await presetName(kit, 'sg-cottage-strawberries');
    assert.equal(r.title, name, 'the densest breakfast by protein per kcal: cottage cheese with strawberries');
    assert.equal(r.line, await line(kit, ['shr_meal_breakfast', 'rec_serv_1']), 'the line names the meal of the hour and one serving');
    assert.deepEqual(r.cells, ['179', '18', '12', '7'], 'the four figures of one serving (E1)');
    assert.deepEqual([r.lines, r.after], [1, null], 'no target: no after-line');
    assert.deepEqual([r.goal, r.goalBetween], [true, true], 'the goal link sits between the answer and the ingredients');
    assert.equal(await kit.ev(() => document.querySelector('#modal-root [data-wte-goal]').textContent.trim()), await tr(kit, 'wte_goal'));
    const src = await kit.ev(() => ['shr_src_mine', 'shr_src_community', 'shr_src_builtin'].map((k) => t(k)));
    assert.ok(src.every((s) => !r.text.includes(s)), 'where the meal comes from is never said');
    const items = await kit.ev(() => suggestionItems(SUGGESTION_PRESETS.find((p) => p.id === 'sg-cottage-strawberries')).length);
    assert.deepEqual([r.rows, r.figRows], [items, items], 'one ingredient row per item of the ready meal, each with its own figures');
    assert.deepEqual(r.buttons, ['log', 'next']);
    await kit.page.locator(LIVE + ' [data-wte-goal]').click();
    await sheetUp(kit, '#calc-body #c-age');
    await kit.page.locator(LIVE + ' #c-age').fill('30');
    await kit.page.locator(LIVE + ' #c-height').fill('175');
    await kit.page.locator(LIVE + ' #c-weight').fill('80');
    await kit.page.locator(LIVE + ' #calc-save').click();
    await sheetUp(kit, '#wte-body');
    const f = await read(kit);
    assert.equal(await kit.ev(() => DB.nutrition.hasTargets()), true, 'setup: the calculator saved a goal');
    assert.deepEqual([f.goal, f.lines, !!f.after], [false, 2, true], 'the answer reopened at once, fitted: an after-line and no goal link');
    await kit.page.locator(LIVE + ' [data-close]').click();
    await sheetGone(kit);
    assert.equal(await doorFocused(kit), true, 'and its close returns focus to the door');
  }],
  ['U3 target 2,000, nothing eaten, 08:00: Greek yogurt at a serving and a half, 371 · 33 · 26 · 16, «1,630 left», every amount scaled by 1.5', async (kit) => {
    await setup(kit, { target: 2000, at: [8] });
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.title, await presetName(kit, 'sg-greek-yogurt-berries'));
    assert.equal(r.portion, await tr(kit, 'wte_por_150'), 'the portion, in the strong voice');
    assert.equal(r.line, await line(kit, ['shr_meal_breakfast', 'wte_por_150']));
    assert.deepEqual(r.cells, ['371', '33', '26', '16'], 'E3: 247 × 1.5 = 370.5 → 371');
    assert.equal(r.after, await afterLine(kit, 1630), 'and what the ring will read after it: round(2000 − 370.5) = 1,630');
    const want = await kit.ev(() => suggestionItems(SUGGESTION_PRESETS.find((p) => p.id === 'sg-greek-yogurt-berries')).map((it) => recScaleQty(it.qty, 1.5)).filter((q) => String(q).trim()));
    assert.deepEqual(r.qty, want, 'every amount is the ready meal\'s own at ×1.5');
    assert.ok(!r.text.includes('360'), 'the budget (360) is never printed');
  }],
  ['U4 «وجبة أخرى» at 13:00 (E4: 500 logged at 08:30, 80 kg): forty lunches, one per press, the first again after the last; focus and the floor never move, at 375 px and at 320 px with larger text', async (kit) => {
    const cycle = async (what) => {
      await setup(kit, E4);
      const a = await ask(kit);
      assert.equal(a.n, 76, 'setup: the day-one pool');
      assert.equal(a.list.length, 40, `${what}: the list the page computes is 40 lunches within tolerance`);
      assert.ok(a.list.every((x) => x.o === 0), 'all in the hour');
      await openDoor(kit);
      const lunch = await tr(kit, 'shr_meal_lunch');
      const probe = () => kit.ev(() => {
        const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
        const b = m.querySelector('[data-wte-next]').getBoundingClientRect(), foot = m.querySelector('.wte-foot');
        const mr = m.getBoundingClientRect(), fr = foot ? foot.getBoundingClientRect() : null;
        return { rect: [b.left, b.top, b.width, b.height].map(Math.round), footGap: foot ? Math.round(mr.bottom - fr.bottom) : 'no .wte-foot',
          sides: fr ? [Math.round(fr.left - mr.left), Math.round(mr.right - fr.right)] : null,
          same: foot === window.__qaFoot, focus: document.activeElement === m.querySelector('[data-wte-next]'), top: m.scrollTop };
      });
      await kit.ev(() => { window.__qaFoot = document.querySelector('#modal-root .modal-overlay:not(.is-out) .wte-foot'); });
      const first = await probe();
      assert.equal(first.footGap, 0, `${what}: the floor is flush with the sheet's bottom edge`);
      assert.ok(first.sides.every((v) => Math.abs(v) <= 1), `${what}: the floor runs edge to edge of the sheet (${first.sides})`);
      const titles = [(await read(kit)).title];
      for (let k = 1; k <= a.list.length; k++) {
        await kit.ev(() => { const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal'); m.scrollTop = m.scrollHeight; });
        await tapNext(kit);
        const r = await read(kit), p = await probe(), want = a.list[k % a.list.length];
        titles.push(r.title);
        assert.equal(r.title, want.name, `${what}: press ${k} names the next meal of the list`);
        assert.deepEqual(r.names, want.names, `${what}: press ${k}: the ingredients follow the title`);
        assert.deepEqual(r.qty, want.qty, `${what}: press ${k}: and their amounts are this meal's at its portion (×${want.p})`);
        assert.ok(r.line.startsWith(lunch), `${what}: press ${k}: the line names lunch («${r.line}»)`);
        assert.deepEqual([p.same, p.focus, p.top], [true, true, 0], `${what}: press ${k}: the same floor, focus on «وجبة أخرى», the sheet back at its top`);
        assert.ok(p.rect.every((v, i) => Math.abs(v - first.rect[i]) <= 1), `${what}: press ${k}: «وجبة أخرى» stays where it was (${p.rect} against ${first.rect})`);
        assert.ok(Math.abs(p.footGap) <= 1, `${what}: press ${k}: the floor is flush with the sheet's bottom edge (${p.footGap})`);
      }
      assert.equal(new Set(titles.slice(0, -1)).size, a.list.length, `${what}: ${a.list.length} presses gave ${a.list.length} distinct meals`);
      assert.equal(titles[titles.length - 1], titles[0], `${what}: and the press after the last is the first again`);
    };
    await cycle('375 px');
    try {
      await narrow(kit);
      await cycle('320 px with larger text');
    } finally { await wide(kit); }
    // «back at its top» means something only where the sheet scrolls before the
    // press AND after it (else the browser clamps the offset to 0 by itself), and
    // at the two sizes above almost none does (measured: 2 presses of 80). So a
    // low screen where every answer overflows (measured: a catalogue dish with no
    // ingredient rows is 317 px, under 360 px's 331 px ceiling, so 300): the whole
    // list, scrolled down, a press, and the new meal's name and figures at the top.
    try {
      await kit.page.setViewportSize({ width: 375, height: 300 });
      await setup(kit, E4);
      await openDoor(kit);
      const n = (await ask(kit)).list.length;
      let seen = 0;
      for (let k = 1; k <= n; k++) {
        const down = await kit.ev(() => { const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal'); m.scrollTop = m.scrollHeight; return m.scrollTop; });
        await tapNext(kit);
        const now = await kit.ev(() => { const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal'); return [m.scrollTop, m.scrollHeight - m.clientHeight]; });
        if (!(down > 0 && now[1] > 0)) continue;
        seen++;
        assert.equal(now[0], 0, `375×300: press ${k} brings the sheet back to its top`);
      }
      assert.ok(seen >= n - 1, `setup: at 375×300, ${seen} presses went from a scrolled sheet to one that can scroll`);
    } finally { await kit.page.setViewportSize({ width: 375, height: 812 }); }
  }],
  ['U5 «سجّلها» at 08:00 (from U3): one row of 1.5 servings with its source and id, the ring reads the after-line\'s 1,630, focus on the door, the toast names the portion, and Undo takes it back', async (kit) => {
    await setup(kit, { target: 2000, at: [8] });
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.afterNum, await num(kit, 1630), 'setup: the after-line says 1,630');
    await tapLog(kit);
    await sheetGone(kit);
    assert.deepEqual(await rowsOn(kit), [{ name: r.title, servings: 1.5, calories: 247, source: 'builtin', sourceId: 'sg-greek-yogurt-berries' }], 'one row: one serving\'s figures, the portion in servings, the source and its id');
    assert.equal(await ring(kit), r.afterNum, 'the ring reads what the after-line said');
    assert.equal(await doorFocused(kit), true, 'focus is on the door the repaint drew');
    // The name inside a first-strong isolate (FSI … PDI), as the sheet fills it.
    const msg = await kit.ev((name) => t('wte_logged').replace('{name}', () => String.fromCharCode(0x2068) + name + String.fromCharCode(0x2069)).replace('{portion}', () => t('wte_por_150')), r.title);
    assert.deepEqual(await toastNow(kit), { msg, undo: true }, 'the toast names the meal and its portion, with Undo');
    // The same words from the dictionary would agree with a broken key too: the toast itself holds the name, the portion, and no unfilled placeholder.
    const words = await kit.ev(() => t('wte_por_150'));
    assert.ok(msg.includes(r.title) && msg.includes(words) && !/[{}]/.test(msg), `the toast reads the meal and its portion, every placeholder filled: «${msg}»`);
    await kit.page.locator('.toast.show .toast-action').click();
    assert.deepEqual(await rowsOn(kit), [], 'Undo removes the row');
    assert.equal(await ring(kit), await num(kit, 2000), 'and the ring reads 2,000 again');
  }],
  ['U6 the question moves on after lunch: the E4 pick logged at 13:05, asked again at 13:10, answers a snack — the protein shake ×1.25 = 384, 686 left', async (kit) => {
    await setup(kit, E4);
    const a = await ask(kit);
    await openDoor(kit);
    const first = (await read(kit)).title;
    assert.equal(first, a.list[0].name, 'setup: the first lunch');
    await kit.clock(13, 5);
    await tapLog(kit);
    await sheetGone(kit);
    await kit.clock(13, 10);
    await openDoor(kit);
    const r = await read(kit);
    const snack = await tr(kit, 'shr_meal_snack');
    assert.ok(r.line.startsWith(snack), `the line names the snack («${r.line}»)`);
    assert.notEqual(r.title, first, 'and it is not the meal just logged');
    assert.equal(r.title, await presetName(kit, 'sg-protein-shake-dates'), 'E5: the shake');
    assert.equal(r.line, await line(kit, ['shr_meal_snack', 'wte_por_125']));
    assert.deepEqual([r.cells[0], r.after], ['384', await afterLine(kit, 686)], 'E5: 307 × 1.25 = 384, and 2000 − 1313.75 → 686 left');
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    // A row's SERVINGS count toward the 150 that moves the question: 100 kcal × 2
    // logged at 13:00 is 200, so at 13:10 the lunch is behind and a snack is asked.
    await setup(kit, { target: 2000, at: [13] });
    await kit.ev(() => { const w = DB.foodLogs.addMany(todayISO(), [{ name: 'QA two halves', servings: 2, calories: 100, protein: 0, carbs: 0, fat: 0 }]); if (!w || !w.ok) throw new Error('setup: the row was refused'); });
    await kit.clock(13, 10);
    await openDoor(kit);
    const two = await read(kit);
    assert.ok(two.line.startsWith(snack), `100 kcal × 2 servings moves the lunch on («${two.line}»)`);
  }],
  ['U6b the question moves on after dinner (E20): 2,800 a day, 800 at lunch and a 900-kcal dinner logged at 19:15, asked at 20:30 with 1,100 left — a small snack of 269, never a second dinner', async (kit) => {
    await setup(kit, { target: 2800, logs: [[13, 0, 800, 0], [19, 15, 900, 0]], at: [20, 30] });
    await openDoor(kit);
    const r = await read(kit);
    assert.ok(r.line.startsWith(await tr(kit, 'shr_meal_snack')), `the line names the snack («${r.line}»)`);
    assert.equal(r.cells[0], '269', 'E20: cottage cheese ×1.5 = 268.5 → 269 against a late-snack budget of 253');
    assert.equal(r.title, await presetName(kit, 'sg-cottage-strawberries'));
  }],
  ['U7 done at 13:00: 1,980 of 2,000 eaten, and 2,240, each say the goal is complete — no meal, no figure, no button', async (kit) => {
    for (const eaten of [1980, 2240]) {
      await setup(kit, { target: 2000, logs: [[12, 0, eaten, 0]], at: [13] });
      await openDoor(kit);
      const r = await read(kit);
      assert.deepEqual([r.title, r.empty, r.buttons, r.nums], [await tr(kit, 'wte_title'), await tr(kit, 'wte_done'), [], 0], `${eaten} eaten`);
      await kit.ev(() => closeModal());
      await sheetGone(kit);
    }
    // Done is said first (§4.4 step 2): a goal that is met stays met even when the pricing fails.
    await setup(kit, { target: 2000, logs: [[12, 0, 1980, 0]], at: [13] });
    await kit.ev(() => { window.__qaWtePool = wtePool; wtePool = () => { throw new Error('qa: the pricing failed'); }; });
    try {
      await openDoor(kit);
      assert.equal((await read(kit)).empty, await tr(kit, 'wte_done'), 'the goal met, the pricing failed: still «done», never «could not prepare»');
    } finally { await kit.ev(() => { wtePool = window.__qaWtePool; window.__qaWtePool = null; }); }
  }],
  ['U8 small at 21:00: 1,945 of 2,000 eaten (55 left, under the smallest half meal) says so with no figure and no button', async (kit) => {
    await setup(kit, { target: 2000, logs: [[12, 0, 1945, 0]], at: [21] });
    const a = await ask(kit);
    assert.deepEqual([a.state, a.n, a.list.length], ['meal', 76, 0], 'setup: a meal budget, a full pool, nothing fits');
    await openDoor(kit);
    const r = await read(kit);
    assert.deepEqual([r.title, r.empty, r.buttons, r.nums], [await tr(kit, 'wte_title'), await tr(kit, 'wte_small'), [], 0]);
    assert.ok(!r.text.includes('55'), 'the calories left are the ring\'s to print, not this sheet\'s');
  }],
  ['U8b none at 13:00: a target set and the pricing failing says it could not prepare a meal — no figure, no button', async (kit) => {
    await setup(kit, { target: 2000, at: [13] });
    await kit.ev(() => { window.__qaWtePool = wtePool; wtePool = () => { throw new Error('qa: the pricing failed'); }; });
    try {
      await openDoor(kit);
      const r = await read(kit);
      assert.deepEqual([r.title, r.empty, r.buttons, r.nums], [await tr(kit, 'wte_title'), await tr(kit, 'wte_none'), [], 0]);
    } finally { await kit.ev(() => { wtePool = window.__qaWtePool; window.__qaWtePool = null; }); }
  }],
  ['U-one one candidate at 21:00 (E10: 70 left): half a «مراصيع», no period word (it is not a dinner dish), no «وجبة أخرى», «سجّلها» takes the whole row', async (kit) => {
    await setup(kit, { target: 2000, logs: [[12, 0, 1930, 0]], at: [21] });
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.title, await dishName(kit, 'Marasee'));
    assert.equal(r.line, await kit.ev(() => t('wte_por_050') + ' · ' + fmtNum(25) + ' ' + t('unit_g')), 'the portion and the weight alone: «مراصيع» answers breakfast and a snack, never a dinner');
    assert.deepEqual([r.cells[0], r.after], ['58', await tr(kit, 'wte_after_done')], '115 × 0.5 = 57.5 → 58; 13 left completes the goal');
    assert.deepEqual(r.buttons, ['log'], 'one candidate: no «وجبة أخرى»');
    const w = await kit.ev(() => { const row = document.querySelector('#modal-root .modal-overlay:not(.is-out) .cx-actions'); return [row.getBoundingClientRect().width, row.querySelector('.btn').getBoundingClientRect().width].map(Math.round); });
    assert.ok(Math.abs(w[0] - w[1]) <= 1, `«سجّلها» takes the whole row (${w})`);
  }],
  ['U9 an own recipe at 20:00 (600 left of 2,200): «منسف البيت» first at one serving, its «800 غ لحم» read as «200 غ», logged as one serving of the recipe', async (kit) => {
    const { recipes: [id] } = await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [HOME_MANSAF], at: [20] });
    const a = await ask(kit);
    assert.deepEqual([a.list[0].id, a.list[0].p], ['recipe:' + id, 1], 'setup: the recipe leads at ×1 (E16c, err 0)');
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.title, HOME_MANSAF.name);
    assert.deepEqual(r.qty, ['200 غ'], 'one serving of four: the amount at a quarter');
    assert.deepEqual(r.cells, ['600', '45', '50', '20']);
    await tapLog(kit);
    await sheetGone(kit);
    const rows = await rowsOn(kit);
    assert.equal(rows.length, 2, 'the seeded lunch and one new row');
    assert.deepEqual(rows[1], { name: HOME_MANSAF.name, servings: 1, calories: 600, source: 'recipe', sourceId: id });
    // (A recipe deleted under the open sheet is U18's.)
  }],
  ['U9b a catalogue dish at 20:00 (E8: nothing eaten): «منسف» at a serving and a quarter, «438 غ» on the line, no ingredient list, the five-character kcal at its full size where it fits (375 px; U22 holds the narrow step), logged as 1.25 servings of the catalogue row', async (kit) => {
    await setup(kit, { target: 2000, at: [20] });
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.title, await dishName(kit, 'Mansaf'));
    assert.equal(r.line, await line(kit, ['shr_meal_dinner', 'wte_por_125'], [await kit.ev(() => fmtNum(438) + ' ' + t('unit_g'))]), '350 g × 1.25 = 437.5 → 438 g');
    assert.deepEqual(r.cells, ['1,050', '54', '71', '58']);
    assert.deepEqual(r.kcalCls, ['is-long'], 'five characters: the kcal carries is-long');
    const size = await kit.ev(kcalSize);
    assert.ok(size.shown === size.full && size.out.length === 0, `at 375 px «1,050» keeps the full size and fits its cell (${JSON.stringify(size)})`);
    assert.deepEqual([r.itemsKids, r.itemsShown], [0, false], 'a catalogue dish has no ingredient rows, and the empty list takes no room');
    await tapLog(kit);
    await sheetGone(kit);
    assert.deepEqual(await rowsOn(kit), [{ name: r.title, servings: 1.25, calories: 840, source: 'catalog', sourceId: 'Mansaf' }]);
  }],
  ['U10 a meal bundle at 07:30 (E17): «فطور النادي» first at one portion, logged as each of its items at its own servings', async (kit) => {
    const { bundles: [id] } = await setup(kit, { target: 2000, bundles: [CLUB], at: [7, 30] });
    const a = await ask(kit);
    assert.deepEqual([a.list[0].id, a.list[0].p, a.list[0].kcal], ['bundle:' + id, 1, 392], 'setup: the bundle leads at ×1');
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.title, CLUB.name);
    assert.deepEqual(r.cells, ['392', '37', '42', '9']);
    assert.deepEqual(r.qty, await kit.ev(() => ['× ' + fmtNum(1), '× ' + fmtNum(2)]), 'each item\'s own servings');
    await tapLog(kit);
    await sheetGone(kit);
    assert.deepEqual(await rowsOn(kit), [
      { name: 'QA oats', servings: 1, calories: 236, source: 'bundle', sourceId: id },
      { name: 'QA egg whites', servings: 2, calories: 78, source: 'bundle', sourceId: id },
    ]);
  }],
  ['U10b a bundle at its cap at 08:00 (E18b: 2,333 a day): ×1.25 = 375, never ×1.5 — the item logged at 20 servings (16 × 1.25)', async (kit) => {
    const { bundles: [id] } = await setup(kit, { target: 2333, bundles: [CAPPED], at: [8] });
    assert.equal(await kit.ev((id) => DB.mealBundles.maxPortion(id), id), 1.25, 'setup: one item at 16 servings caps the portion at 1.25');
    await openDoor(kit);
    const r = await read(kit);
    assert.equal(r.title, CAPPED.name, 'the capped bundle leads');
    assert.equal(r.line, await line(kit, ['shr_meal_breakfast', 'wte_por_125']));
    assert.deepEqual([r.cells[0], r.after], ['375', await afterLine(kit, 1958)]);
    await tapLog(kit);
    await sheetGone(kit);
    assert.deepEqual(await rowsOn(kit), [{ name: 'QA bites', servings: 20, calories: 18.75, source: 'bundle', sourceId: id }]);
  }],
  ['U11 at 320 px with larger text every state fits side to side, each text inside its own control and each figure inside its cell — the meal (E4, 1,050, 1,700), no target (E1, a 12,345-kcal recipe), done, small, none, and the toast', async (kit) => {
    const check = async (what) => {
      assert.deepEqual(await kit.ev(fitProblems), [], `${what}: everything inside the sheet`);
    };
    try {
      await narrow(kit);
      const states = [
        ['E4, 13:00', E4],
        ['E8, 20:00 (1,050)', { target: 2000, at: [20] }, ['1,050', ['is-long']]],
        ['E13, 20:00 (1,700)', { target: 3500, at: [20] }, ['1,700', ['is-long']]],
        ['E1, 08:00, no target', { target: 0, at: [8] }],
        ['done, 13:00', { target: 2000, logs: [[12, 0, 1980, 0]], at: [13] }],
        ['small, 21:00', { target: 2000, logs: [[12, 0, 1945, 0]], at: [21] }],
      ];
      for (const [what, o, kcal] of states) {
        await setup(kit, o);
        await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
        const door = await kit.ev(() => { const n = document.querySelector('.view.active [data-wte-door] .shr-door-name'); return [n.scrollWidth, n.clientWidth]; });
        assert.ok(door[0] <= door[1] + 1, `${what}: the door's name is not cut (${door})`);
        assert.equal(await kit.ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${what}: Food does not scroll sideways`);
        await openDoor(kit);
        if (kcal) { const r = await read(kit); assert.deepEqual([r.cells[0], r.kcalCls], kcal, `setup: ${what} is the widest figure it names`); }
        await check(what);
        await kit.ev(() => closeModal());
        await sheetGone(kit);
      }
      // A 12,345-kcal serving, reached with «وجبة أخرى» on day one: the six-character step.
      await setup(kit, { target: 0, at: [8], recipes: [{ name: 'QA feast', servings: 1, items: [{ name: 'QA feast', qty: '1', calories: 12345, protein: 300, carbs: 900, fat: 500 }] }] });
      await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
      await openDoor(kit);
      for (let k = 0; k < 80 && (await read(kit)).title !== 'QA feast'; k++) await tapNext(kit);
      const big = await read(kit);
      assert.deepEqual([big.title, big.cells[0], big.kcalCls], ['QA feast', '12,345', ['is-xlong']], 'setup: the recipe reached, six characters');
      await check('no target, 12,345 kcal');
      await kit.ev(() => closeModal());
      await sheetGone(kit);
      // None: the pricing failed.
      await setup(kit, { target: 2000, at: [13] });
      await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); window.__qaWtePool = wtePool; wtePool = () => { throw new Error('qa'); }; });
      await openDoor(kit);
      await check('none');
      await kit.ev(() => { wtePool = window.__qaWtePool; window.__qaWtePool = null; closeModal(); });
      await sheetGone(kit);
      // The toast of the longest ready-meal name in English (U5's log).
      await setup(kit, { target: 2000, at: [8] });
      await kit.ev(() => { DB.prefs.setTextLg(true); document.body.classList.add('text-lg'); });
      await openDoor(kit);
      await tapLog(kit);
      await sheetGone(kit);
      assert.ok(await toastNow(kit), 'setup: the toast is up');
      assert.deepEqual(await kit.ev(toastProblems), [], 'the toast and its Undo fit');
    } finally { await wide(kit); }
  }],
  ['U12 midnight: the sheet opened at 23:59:50 and «سجّلها» tapped at 00:00:10 writes NOTHING — the answer was for another day (cx_stale, the sheet stays, no row on either day)', async (kit) => {
    await setup(kit, { target: 2000, at: [23, 59, 50] });
    await openDoor(kit);
    await kit.clock(0, 0, 10, NEXT_DAY);
    assert.equal(await kit.ev(() => todayISO()), NEXT_DAY, 'setup: the page\'s day moved');
    await staleTap(kit, 'midnight', [DAY, NEXT_DAY]);
  }],
  ['U13 a double tap on «سجّلها» at 08:00 makes ONE write and leaves its Undo on offer; a double tap on a stale answer raises ONE cx_stale, writes nothing and keeps focus', async (kit) => {
    await setup(kit, { target: 2000, at: [8] });
    await openDoor(kit);
    await countCalls(kit);
    try {
      await kit.ev(() => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-wte-log]'); b.click(); b.click(); });
      await sheetGone(kit);
      const c = await kit.ev(() => window.__qaCalls);
      assert.deepEqual([c.addMany, c.log], [1, 0], `one write call, not two (${JSON.stringify(c)})`);
      assert.equal((await rowsOn(kit)).length, 1, 'one row');
      const toast = await toastNow(kit);
      assert.ok(toast && toast.undo && toast.msg !== await tr(kit, 'cx_stale'), `the toast still offers the Undo of that write: ${JSON.stringify(toast)}`);
    } finally { await uncountCalls(kit); }
    // The same double tap on an answer that went stale under the sheet (the recipe deleted).
    const { recipes: [gone] } = await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [HOME_MANSAF], at: [20] });
    await openDoor(kit);
    assert.equal((await read(kit)).title, HOME_MANSAF.name, 'setup: the recipe is the answer');
    await kit.ev((rid) => DB.recipes.remove(rid), gone);
    await kit.page.locator(LIVE + ' [data-wte-log]').focus();
    await countCalls(kit);
    try {
      await kit.ev(() => { const b = document.querySelector('#modal-root .modal-overlay:not(.is-out) [data-wte-log]'); b.click(); b.click(); });
      const c = await kit.ev(() => window.__qaCalls);
      const stale = await tr(kit, 'cx_stale');
      assert.deepEqual([c.addMany, c.log, c.toasts.filter((m) => m === stale).length, c.toasts.length], [0, 0, 1, 1], `one cx_stale toast and no write (${JSON.stringify(c)})`);
      assert.equal((await rowsOn(kit)).length, 1, 'only the seeded lunch');
      assert.equal(await kit.ev((s) => document.activeElement === document.querySelector(s), LIVE + ' [data-wte-log]'), true, 'focus stays on «سجّلها»');
    } finally { await uncountCalls(kit); }
  }],
  ['U14 a close and a reopen at 13:00 without logging shows the same meal: the cursor is kept', async (kit) => {
    await setup(kit, E4);
    const a = await ask(kit);
    await openDoor(kit);
    await tapNext(kit);
    await tapNext(kit);
    assert.equal((await read(kit)).title, a.list[2].name, 'setup: two presses on');
    await kit.page.locator(LIVE + ' [data-close]').click();
    await sheetGone(kit);
    await openDoor(kit);
    assert.equal((await read(kit)).title, a.list[2].name);
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    // The cursor is keyed by what is left: one more kcal logged leaves the same
    // forty lunches, at the same portions, but it is another question — from the first.
    await kit.ev(() => { const w = DB.foodLogs.addMany(todayISO(), [{ name: 'QA sip', servings: 1, calories: 1, protein: 0, carbs: 0, fat: 0 }]); if (!w || !w.ok) throw new Error('setup'); });
    const b = await ask(kit);
    assert.deepEqual(b.list.map((x) => x.id + '@' + x.p), a.list.map((x) => x.id + '@' + x.p), 'setup: the same list after one more kcal');
    await openDoor(kit);
    assert.equal((await read(kit)).title, b.list[0].name, 'what is left changed: the list starts again');
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    // … and by the day: the same list at the same hour tomorrow starts again.
    await setup(kit, { target: 2000, at: [13] });
    const c = await ask(kit);
    await openDoor(kit);
    await tapNext(kit);
    await tapNext(kit);
    assert.equal((await read(kit)).title, c.list[2].name, 'setup: two presses on');
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    await kit.clock(13, 0, 0, NEXT_DAY);
    const d = await ask(kit);
    assert.deepEqual(d.list.map((x) => x.id + '@' + x.p), c.list.map((x) => x.id + '@' + x.p), 'setup: the same list the next day');
    await openDoor(kit);
    assert.equal((await read(kit)).title, d.list[0].name, 'a new day: the list starts again');
  }],
  ['U15 the fence at 13:00: opening and walking the sheet asks nothing of the network, and with the community calls throwing the sheet is unchanged', async (kit) => {
    await setup(kit, E4);
    const blocked = kit.guard.blocked.length;
    await openDoor(kit);
    const before = [await read(kit)];
    await tapNext(kit);
    before.push(await read(kit));
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    assert.equal(kit.guard.blocked.length, blocked, 'no request was even attempted');
    await setup(kit, E4);
    await kit.ev(() => { window.__qaCloud = [Cloud.pullSharedRecipes, Cloud.getSharedRecipeItems]; Cloud.pullSharedRecipes = () => { throw new Error('qa'); }; Cloud.getSharedRecipeItems = () => { throw new Error('qa'); }; });
    try {
      await openDoor(kit);
      const after = [await read(kit)];
      await tapNext(kit);
      after.push(await read(kit));
      assert.deepEqual(after, before, 'the same two answers, figure for figure');
    } finally { await kit.ev(() => { [Cloud.pullSharedRecipes, Cloud.getSharedRecipeItems] = window.__qaCloud; }); }
  }],
  // The floating «+» sits at the inline START of the lane just above the nav, on the first word of
  // whatever row is there. The door is the dashboard's last box so that ONE flick shows it whole:
  // at the END of the scroll it stands above the nav, the «+» covers neither its glyph nor its
  // name, and its centre is the door — on the short phones where a door under the ring had its
  // first word under the «+» (measured at 360×740 and 360×780), and at the suite's two sizes.
  // At scroll 0 the first screen is what v435 drew: the water card closes it, on its old line.
  ['U16 the door and the floating «+» (08:00, a target): at the end of the scroll the door is whole above the nav and clear of the «+», and the water card has not moved from under the ring — at 360×740, 360×780, 375×812 and 320×640', async (kit) => {
    for (const [w, h] of [[360, 740], [360, 780], [375, 812], [320, 640]]) {
      await kit.page.setViewportSize({ width: w, height: h });
      try {
        await setup(kit, { target: 2000, at: [8] });
        const r = await kit.ev(() => {
          const main = document.querySelector('.main'), v = document.querySelector('.view.active[data-view="food"]');
          const d = v.querySelector('[data-wte-door]'), fabEl = document.getElementById('food-fab'), nav = document.getElementById('bottom-nav');
          main.scrollTop = 0;
          const hero = v.querySelector('.nutri-hero').getBoundingClientRect(), water = v.querySelector('.water-card').getBoundingClientRect();
          main.scrollTop = main.scrollHeight;
          const f = fabEl.getBoundingClientRect(), c = d.getBoundingClientRect(), navTop = nav.getBoundingClientRect().top;
          const meets = (q) => !(q.right <= f.left || f.right <= q.left || q.bottom <= f.top || f.bottom <= q.top);
          const name = d.querySelector('.shr-door-name'), tr = document.createRange(); tr.selectNodeContents(name.firstChild);
          const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
          return {
            fab: getComputedStyle(fabEl).display, gap: Math.round(water.top - hero.bottom),
            whole: c.top >= 0 && c.bottom <= navTop + 0.5, parts: [meets(d.querySelector('svg').getBoundingClientRect()), [...tr.getClientRects()].some(meets)],
            hit: !!hit && hit.closest('[data-wte-door]') === d,
          };
        });
        assert.equal(r.fab !== 'none', true, `setup: the FAB is drawn at ${w}×${h}`);
        assert.equal(r.gap >= 0 && r.gap <= 16, true, `${w}×${h}: the water card sits directly under the ring's card (a ${r.gap}px gap): no bar between them`);
        assert.equal(r.whole, true, `${w}×${h}: at the end of the scroll the door is whole, above the nav`);
        assert.deepEqual(r.parts, [false, false], `${w}×${h}: at the end of the scroll the «+» covers neither the door's glyph nor its name`);
        assert.equal(r.hit, true, `${w}×${h}: and the door's centre is the door`);
      } finally { await kit.page.setViewportSize({ width: 375, height: 812 }); }
    }
  }],
  ['U17 a hostile recipe name at 20:00 (600 left) is drawn as text, before and after a full «وجبة أخرى» round', async (kit) => {
    await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [{ name: HOSTILE, servings: 1, items: [{ name: 'QA', qty: '1', calories: 600, protein: 45, carbs: 50, fat: 20 }] }], at: [20] });
    const a = await ask(kit);
    assert.equal(a.list[0].name, HOSTILE, 'setup: the hostile recipe leads');
    await openDoor(kit);
    const look = () => kit.ev(() => { const h = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal-title'); return { kids: h.children.length, text: h.textContent, x: typeof window.__x, img: document.querySelectorAll('#modal-root img').length }; });
    assert.deepEqual(await look(), { kids: 0, text: HOSTILE, x: 'undefined', img: 0 });
    for (let k = 0; k < a.list.length; k++) await tapNext(kit);
    assert.deepEqual(await look(), { kids: 0, text: HOSTILE, x: 'undefined', img: 0 }, 'after a full round, set by textContent');
  }],
  // THE TAP ASKS AGAIN. A pull on resume, another tab or midnight can move the
  // store under the open sheet; the answer shown is then refused as STALE rather
  // than written with figures, a day or a ring other than the ones shown. What
  // leaves the meal shown exactly as true — the clock passing an hour (here a
  // period too), an unrelated new recipe — must still log. (Midnight is U12.)
  ['U18 the store moves under the open sheet: a row logged elsewhere, the bundle shown edited, the recipe shown deleted, the target changed, the bundle shown re-split under the portion shown — «سجّلها» writes nothing (cx_stale, the sheet and focus stay); the clock passing 11:00 or an unrelated new recipe — it logs the meal shown', async (kit) => {
    // (i) a row from another device (E8: Mansaf 1,050, nothing eaten at 20:00).
    await setup(kit, { target: 2000, at: [20] });
    await openDoor(kit);
    await kit.ev(() => { const w = DB.foodLogs.addMany(todayISO(), [{ name: 'QA from the laptop', servings: 1, calories: 500, protein: 0, carbs: 0, fat: 0 }]); if (!w || !w.ok) throw new Error('setup: the row was refused'); });
    await staleTap(kit, 'a row logged under the sheet', [DAY]);
    // (ii) the bundle shown, edited elsewhere (E17: «فطور النادي» at 07:30).
    const { bundles: [bid] } = await setup(kit, { target: 2000, bundles: [CLUB], at: [7, 30] });
    await openDoor(kit);
    assert.equal((await read(kit)).title, CLUB.name, 'setup: the bundle is the answer');
    await kit.ev(({ id, club }) => {
      const w = DB.mealBundles.update(id, { name: club.name, items: club.items.concat([{ name: 'QA juice', servings: 1, calories: 250, protein: 1, carbs: 60, fat: 0 }]) });
      if (!w || !w.ok) throw new Error('setup: the edit was refused');
    }, { id: bid, club: CLUB });
    await staleTap(kit, 'the bundle edited under the sheet', [DAY]);
    // (iii) the recipe shown, deleted (E16c: «منسف البيت» at 20:00, 600 left).
    const { recipes: [rid] } = await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [HOME_MANSAF], at: [20] });
    await openDoor(kit);
    assert.equal((await read(kit)).title, HOME_MANSAF.name, 'setup: the recipe is the answer');
    await kit.ev((id) => DB.recipes.remove(id), rid);
    await staleTap(kit, 'the recipe deleted under the sheet', [DAY]);
    // (vii) the target changed elsewhere (E8 at 20:00): the meal and what the log holds are the same,
    // but the after-line was read against the old goal.
    await setup(kit, { target: 2000, at: [20] });
    await openDoor(kit);
    await kit.ev(() => DB.nutrition.setTargets({ calories: 2400, protein: 0, carbs: 0, fat: 0 }));
    assert.equal(await kit.ev(() => wteAsk().b.target), 2400, 'setup: the target moved under the sheet');
    await staleTap(kit, 'the target changed under the sheet', [DAY]);
    // (viii) the bundle shown re-split elsewhere (E18b: «QA capped» at ×1.25, 08:00, 2,333 a day):
    // the same 300 kcal, but its item at 20 servings caps the portion at 1 — under the 1¼ shown.
    const { bundles: [cid] } = await setup(kit, { target: 2333, bundles: [CAPPED], at: [8] });
    await openDoor(kit);
    assert.equal((await read(kit)).title, CAPPED.name, 'setup: the capped bundle is the answer');
    const cap = await kit.ev((id) => {
      const w = DB.mealBundles.update(id, { name: 'QA capped', items: [{ name: 'QA bites', servings: 20, calories: 15, protein: 1.5, carbs: 1, fat: 0.5 }] });
      if (!w || !w.ok) throw new Error('setup: the edit was refused');
      const r = wteAsk().pool.find((x) => x.id === 'bundle:' + id);
      return [r.kcal, r.maxPor];
    }, cid);
    assert.deepEqual(cap, [300, 1],'setup: the same 300 kcal, its portion now capped at 1');
    await staleTap(kit, 'its cap fell under the portion shown', [DAY]);
    // (v) the clock passes 11:00 — an hour AND a period (breakfast → lunch) — and nothing else changes.
    await setup(kit, { target: 2000, at: [10, 59, 50] });
    await openDoor(kit);
    const shown = await kit.ev(() => { const x = wteAsk().list[WTE_CUR.i]; return { name: x.row.name, e: wteEntry(x) }; });
    assert.equal((await read(kit)).title, shown.name, 'setup: the meal shown');
    await kit.clock(11, 0, 10);
    assert.equal((await ask(kit)).period, 'lunch', 'setup: the question itself has moved on to lunch');
    await loggedTap(kit, 'the hour passing refuses nothing');
    const e = shown.e;
    assert.deepEqual(await rowsOn(kit), [{ name: e.name, servings: e.servings, calories: e.calories, source: e.source, sourceId: e.sourceId }], 'the hour passing refuses nothing: the meal shown is logged');
    // (vi) an unrelated recipe added under the sheet.
    await setup(kit, { target: 2000, at: [8] });
    await openDoor(kit);
    const shown2 = await kit.ev(() => wteEntry(wteAsk().list[WTE_CUR.i]));
    await kit.ev(() => { if (!DB.recipes.add({ name: 'QA unrelated', servings: 1, items: [{ name: 'QA', qty: '1', calories: 300, protein: 20, carbs: 30, fat: 10 }] })) throw new Error('setup'); });
    assert.equal((await ask(kit)).n, 77, 'setup: the pool grew by the new recipe');
    await loggedTap(kit, 'an unrelated new recipe refuses nothing');
    assert.deepEqual(await rowsOn(kit), [{ name: shown2.name, servings: shown2.servings, calories: shown2.calories, source: shown2.source, sourceId: shown2.sourceId }], 'an unrelated new recipe refuses nothing');
  }],
  ['U19 «سجّلها» after two presses of «وجبة أخرى» (E4, 13:00) logs the THIRD meal: its own row, the ring at the after-line read before the tap, the toast naming it', async (kit) => {
    await setup(kit, E4);
    await openDoor(kit);
    await tapNext(kit);
    await tapNext(kit);
    const want = await kit.ev(() => { const x = wteAsk().list[2]; return { name: x.row.name, kind: x.row.kind, entry: wteEntry(x), word: wteWord(x.p), first: wteAsk().list[0].row.name }; });
    assert.ok(want.entry && want.name !== want.first, 'setup: E4\'s third lunch is not a bundle, and not the first');
    const r = await read(kit);
    assert.equal(r.title, want.name, 'setup: the third meal is on screen');
    await tapLog(kit);
    await sheetGone(kit);
    const rows = await rowsOn(kit), e = want.entry;
    assert.deepEqual(rows.slice(1), [{ name: e.name, servings: e.servings, calories: e.calories, source: e.source, sourceId: e.sourceId }], 'the row is the third pick\'s: name, servings, calories, source and its id');
    assert.equal(await ring(kit), r.afterNum, 'the ring reads the after-line read before the tap');
    const toast = await toastNow(kit);
    assert.ok(toast && toast.undo && toast.msg.includes(want.name) && toast.msg.includes(want.word) && !toast.msg.includes(want.first), `the toast names that meal and its portion: ${JSON.stringify(toast)}`);
  }],
  ['U20 a bundle repeated today — by «كرّر الأمس» and by a recent chip — keeps its sourceId, so the question ranks it as eaten today', async (kit) => {
    const { bundles: [id] } = await setup(kit, { target: 2000, bundles: [CLUB], at: [7, 30] });
    await kit.ev((id) => { const w = DB.mealBundles.log(id, addDaysISO(todayISO(), -1), 1, 'qa-yesterday'); if (!w || !w.ok) throw new Error('setup: yesterday\'s bundle'); }, id);
    const eaten = async () => (await ask(kit)).list.find((x) => x.id === 'bundle:' + id);
    assert.equal((await eaten()).e, 0, 'setup: not eaten today yet');
    await kit.ev(() => openRepeatYesterday(null, () => {}));
    await kit.page.waitForSelector('#modal-root #ry-list');
    await kit.ev(() => document.querySelectorAll('#modal-root [data-ry]').forEach((c) => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }));
    await kit.page.locator('#modal-root #ry-add').click();
    await sheetGone(kit);
    const rows = await rowsOn(kit);
    assert.deepEqual(rows.map((r) => [r.name, r.source, r.sourceId]), [['QA oats', 'bundle', id], ['QA egg whites', 'bundle', id]], '«كرّر الأمس»: each row keeps its bundle\'s id');
    assert.equal((await eaten()).e, 1, '«كرّر الأمس»: the bundle is eaten today');
    await kit.ev(() => { DB.foodLogs.listForDate(todayISO()).slice().forEach((r) => DB.foodLogs.remove(todayISO(), r.id)); hideToast(); });
    assert.equal((await eaten()).e, 0, 'setup: today is empty again');
    await kit.ev(() => openAddSheet(null, () => {}));
    await kit.page.locator('#add-sheet-overlay .add-recent-chip', { hasText: 'QA oats' }).click();
    await kit.page.waitForFunction(() => !document.getElementById('add-sheet-overlay'), null, { timeout: 3000 });
    assert.deepEqual((await rowsOn(kit)).map((r) => [r.name, r.source, r.sourceId]), [['QA oats', 'bundle', id]], 'the recent chip: the row keeps its bundle\'s id');
    assert.equal((await eaten()).e, 1, 'the recent chip: the bundle is eaten today');
  }],
  ['U21 a one-row ingredient list draws no figures line (its four figures ARE the grid\'s): a one-ingredient recipe and a one-item bundle show the amount alone, also after a full «وجبة أخرى» round; a two-ingredient recipe keeps figures on both rows', async (kit) => {
    await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [HOME_MANSAF], at: [20] });
    const n = (await ask(kit)).list.length;
    await openDoor(kit);
    const figs = () => kit.ev((s) => document.querySelectorAll(s).length, LIVE + ' #wte-items [data-figs]');
    let r = await read(kit);
    assert.deepEqual([r.title, r.rows, r.figRows, r.qty, await figs()], [HOME_MANSAF.name, 1, 0, ['200 غ'], 0], 'one ingredient: its amount, no figures');
    for (let k = 0; k < n; k++) await tapNext(kit);
    r = await read(kit);
    assert.deepEqual([r.title, r.rows, r.figRows, await figs()], [HOME_MANSAF.name, 1, 0, 0], 'drawn again by «وجبة أخرى»: still no figures');
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    await setup(kit, { target: 2333, bundles: [CAPPED], at: [8] });
    await openDoor(kit);
    r = await read(kit);
    assert.deepEqual([r.title, r.rows, r.figRows, r.qty, await figs()], [CAPPED.name, 1, 0, [await kit.ev(() => '× ' + fmtNum(20))], 0], 'one item of a bundle: «× 20», no figures');
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    const TWO = { name: 'QA two rows', servings: 4, items: [{ name: 'QA lamb', qty: '600 g', calories: 1600, protein: 120, carbs: 0, fat: 60 }, { name: 'QA rice', qty: '400 g', calories: 800, protein: 60, carbs: 200, fat: 20 }] };
    await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [TWO], at: [20] });
    await openDoor(kit);
    r = await read(kit);
    assert.deepEqual([r.title, r.rows, r.figRows, await figs()], [TWO.name, 2, 2, 2], 'two ingredients: each keeps its own figures');
  }],
  ['U22 the headline figure steps down only where it must: «1,050» and «1,700» at the full size inside their cell at 375 px and at 360 and 375 px with larger text, stepped and inside it at 320 px with larger text; six characters stepped at every width', async (kit) => {
    const sizes = [[375, 812, false], [375, 812, true], [360, 780, true], [320, 640, true]];
    const at = async (w, h, lg) => {
      await kit.page.setViewportSize({ width: w, height: h });
      await kit.ev((lg) => { DB.prefs.setTextLg(lg); document.body.classList.toggle('text-lg', lg); }, lg);
      // A size change runs the figure's font-size transition: read it once it has landed.
      await kit.ev(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {}))));
      return kit.ev(kcalSize);
    };
    try {
      for (const [fig, o] of [['1,050', { target: 2000, at: [20] }], ['1,700', { target: 3500, at: [20] }]]) {
        await setup(kit, o);
        await openDoor(kit);
        for (const [w, h, lg] of sizes) {
          const s = await at(w, h, lg);
          const what = `${fig} at ${w}×${h}${lg ? ' with larger text' : ''}`;
          assert.equal(s.text, fig, `setup: ${what}`);
          assert.deepEqual(s.out, [], `${what}: inside its cell`);
          if (w >= 360) assert.equal(s.shown, s.full, `${what}: the full size (${s.shown} px)`);
          else assert.ok(s.shown < s.full, `${what}: stepped down (${s.shown} px against ${s.full})`);
        }
        await wide(kit);
        await kit.ev(() => closeModal());
        await sheetGone(kit);
      }
      await setup(kit, { target: 0, at: [8], recipes: [{ name: 'QA feast', servings: 1, items: [{ name: 'QA feast', qty: '1', calories: 12345, protein: 300, carbs: 900, fat: 500 }] }] });
      await openDoor(kit);
      for (let k = 0; k < 80 && (await read(kit)).title !== 'QA feast'; k++) await tapNext(kit);
      for (const [w, h, lg] of [...sizes, [412, 915, false]]) {
        const s = await at(w, h, lg);
        const what = `12,345 at ${w}×${h}${lg ? ' with larger text' : ''}`;
        assert.equal(s.text, '12,345', `setup: ${what}`);
        assert.ok(s.shown < s.full, `${what}: six characters step down at every width (${s.shown} px against ${s.full})`);
        assert.deepEqual(s.out, [], `${what}: inside its cell`);
      }
    } finally { await wide(kit); }
  }],
  ['U23 the account changes under the open sheet (a shared phone): «سجّلها» writes nothing and the sheet closes (guardConvenienceModal)', async (kit) => {
    await setup(kit, { target: 2000, at: [8] });
    await openDoor(kit);
    await kit.ev(() => { window.__qaUid = Cloud.getLastUid; const was = Cloud.getLastUid() || ''; Cloud.getLastUid = () => was + 'qa-someone-else'; });
    await countCalls(kit);
    try {
      await tapLog(kit);
      await sheetGone(kit);
      const c = await kit.ev(() => window.__qaCalls);
      assert.deepEqual([c.addMany, c.log], [0, 0], `no write was attempted (${JSON.stringify(c)})`);
      assert.deepEqual(await rowsOn(kit), [], 'no row in the log');
    } finally {
      await uncountCalls(kit);
      await kit.ev(() => { Cloud.getLastUid = window.__qaUid; window.__qaUid = null; });
    }
  }],
  ['U24 the toast keeps its reading order with a name in the other script (English UI: an Arabic name; Arabic UI: an English one), at 1 and at 1¼ servings: the name, the dash and the portion are drawn in order, the name inside FSI … PDI', async (kit) => {
    const name = kit.lang === 'en' ? 'كبسة البيت' : 'QA Bowl 2';
    for (const [per, p, key] of [[600, 1, 'rec_serv_1'], [480, 1.25, 'wte_por_125']]) {
      await setup(kit, { target: 2200, logs: [[13, 0, 1600, 0]], recipes: [{ name, servings: 1, items: [{ name: 'QA', qty: '1', calories: per, protein: 45, carbs: 50, fat: 20 }] }], at: [20] });
      const a = await ask(kit);
      const i = a.list.findIndex((x) => x.name === name);
      assert.ok(i >= 0 && a.list[i].p === p, `setup: the recipe is in the list at ×${p} (${i >= 0 ? a.list[i].p : 'absent'})`);
      await openDoor(kit);
      for (let k = 0; k < i; k++) await tapNext(kit);
      assert.equal((await read(kit)).title, name, 'setup: the recipe on screen');
      await tapLog(kit);
      await sheetGone(kit);
      const word = await tr(kit, key);
      const m = await kit.ev(toastOrder, { name, word });
      assert.ok(m, 'setup: the toast is up');
      const tag = `«${m.s}» at ×${p}`;
      assert.equal(m.iso, true, `${tag}: the name sits inside FSI … PDI`);
      assert.ok(Math.abs(m.name.t - m.word.t) < 2 && Math.abs(m.dash.t - m.word.t) < 2, `setup: ${tag} is one line`);
      if (m.rtl) assert.ok(m.name.l >= m.dash.r - 0.5 && m.dash.l >= m.word.r - 0.5, `${tag}: right to left, the name, the dash, the portion (${JSON.stringify(m)})`);
      else assert.ok(m.name.r <= m.dash.l + 0.5 && m.dash.r <= m.word.l + 0.5, `${tag}: left to right, the name, the dash, the portion (${JSON.stringify(m)})`);
      assert.equal(m.rtl, kit.lang === 'ar', 'setup: the sentence runs in the UI\'s direction');
    }
  }],
  ['U25 an ingredient amount hugs the row\'s end edge in both languages — the recipe view (a short amount and the longest one a recipe keeps), a ready meal\'s sheet and this sheet — and a long amount wraps inside half the row, never squeezing the name away (375 px, and 320 px with larger text)', async (kit) => {
    // A recipe keeps an amount's first 24 characters (DB.recipes, storage.js): the
    // fix list's 40-character example is stored as its 24-character cut.
    const LONG = 'ملعقة كبيرة من زيت الزيتون البكر الممتاز';
    const REC = { name: 'QA dressing', servings: 1, items: [{ name: 'QA rice', qty: '200 g', calories: 260, protein: 5, carbs: 56, fat: 1 }, { name: 'QA olive oil', qty: LONG, calories: 120, protein: 0, carbs: 0, fat: 14 }] };
    const { recipes: [id] } = await setup(kit, { target: 2000, recipes: [REC], at: [8] });
    const kept = await kit.ev((id) => DB.recipes.list().find((r) => r.id === id).items[1].qty, id);
    assert.equal(kept, LONG.slice(0, 24), 'setup: the recipe keeps the amount\'s first 24 characters');
    const check = (where, rows) => {
      assert.ok(rows.length > 0, `setup: ${where} has amounts`);
      for (const x of rows) {
        const tag = `${where} «${x.text}»`, half = (x.R - x.L) / 2;
        if (x.rtl) assert.ok(Math.abs(x.q.l - x.L) <= 1, `${tag}: its box's left edge is the row's end edge (${x.q.l.toFixed(1)} against ${x.L.toFixed(1)})`);
        else assert.ok(Math.abs(x.q.r - x.R) <= 1, `${tag}: its box's right edge is the row's end edge (${x.q.r.toFixed(1)} against ${x.R.toFixed(1)})`);
        // And the amount as DRAWN: a box can reach the end while its words sit mid-row (one line; a wrapped amount fills its half).
        if (x.lines === 1) {
          if (x.rtl) assert.ok(Math.abs(x.g.l - x.L) <= 1, `${tag}: its glyphs start at the row's end edge (${x.g.l.toFixed(1)} against ${x.L.toFixed(1)})`);
          else assert.ok(Math.abs(x.g.r - x.R) <= 1, `${tag}: its glyphs end at the row's end edge (${x.g.r.toFixed(1)} against ${x.R.toFixed(1)})`);
        } else assert.ok(Math.abs(x.q.w - half) <= 1, `${tag}: wrapped, it fills its half (${x.q.w.toFixed(1)} of ${half.toFixed(1)})`);
        assert.ok(x.q.l >= x.L - 1 && x.q.r <= x.R + 1 && x.spill === 0, `${tag}: inside the row, every glyph inside its own box`);
        assert.ok(x.q.w <= half + 1, `${tag}: at most half the row (${x.q.w.toFixed(1)} of ${(x.R - x.L).toFixed(1)})`);
        if (x.natural > half + 1) assert.ok(x.lines >= 2, `${tag}: too long for half the row (${x.natural.toFixed(1)} px), it wraps there (${x.lines} lines)`);
        assert.ok(x.n.w >= (x.R - x.L) * 0.4, `${tag}: the name keeps its room (${x.n.w.toFixed(1)} px)`);
      }
    };
    await kit.ev((id) => openRecipeView(null, DB.recipes.list().find((r) => r.id === id), () => {}), id);
    await sheetUp(kit, '.rec-view .cx-row');
    const view = await kit.ev(qtyRects, LIVE + ' .rec-view');
    check('the recipe view', view);
    assert.ok(view.some((x) => x.text === kept) && view.some((x) => x.text === '200 g'), 'setup: the long amount and the short one are there');
    try {
      await narrow(kit);
      await kit.ev(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {}))));
      const tight = await kit.ev(qtyRects, LIVE + ' .rec-view');
      const long = tight.find((x) => x.text === kept);
      assert.ok(long && long.natural > (long.R - long.L) / 2 + 1, `setup: at 320 px with larger text the long amount is wider than half the row (${long && long.natural.toFixed(1)})`);
      check('the recipe view at 320 px with larger text', tight);
    } finally { await wide(kit); }
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    await kit.ev(() => openSharedRecipe(suggestionPool().find((r) => r.src === 'builtin'), null, () => {}));
    await sheetUp(kit, '#shr-items .cx-row');
    check('a ready meal\'s sheet', await kit.ev(qtyRects, LIVE + ' #shr-items'));
    await kit.ev(() => closeModal());
    await sheetGone(kit);
    await setup(kit, { target: 2000, at: [8] });
    await openDoor(kit);
    check('this sheet', await kit.ev(qtyRects, LIVE + ' #wte-items'));
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
  if (failures.length) { console.error(`FAIL  what to eat UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  what to eat UI (${passed} cases, AR/dark + EN/light, 375px and 320px with larger text, ${Math.round((Date.now() - t0) / 1000)} s): one door on Food, the last box under «اقتراحات اليوم» in both states, nothing added above the water card; one meal of the hour with its portion, four figures, the after-line and its ingredients at that portion; «وجبة أخرى» walks the hour's forty lunches in place with its button and the floor unmoved; «سجّلها» writes servings p with the source and its id, the ring reads the after-line, focus is on the door and Undo takes it back; after lunch a snack, after dinner a small snack; done, small and none offer nothing; one candidate has one button; an own recipe at its scale, a catalogue dish with its weight, a bundle at its cap; the tap asks again and a stale answer writes nothing (midnight included) while an hour passing does not refuse; a double tap makes one write and keeps its Undo; the third meal of a walk is the one logged; a repeated bundle stays eaten; a one-row list has no figures line; the kcal steps down only at 320 px; an account change writes nothing; the toast keeps its reading order; an amount hugs its row's end; the cursor survives a reopen; nothing leaves the machine; the FAB covers nothing of the door; a hostile name is text; every state fits at 320 px with larger text`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });
