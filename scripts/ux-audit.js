#!/usr/bin/env node
// THE UX AUDIT — measure the twenty screens, so the design pass is ranked by
// numbers and not by taste.
//
//   node scripts/ux-audit.js --tag pass1                # both contexts, seeded, screenshots
//   node scripts/ux-audit.js --tag pass1 --contexts one  # ar/dark/375 only
//
// ⚠️ A TOOL, NOT A SUITE — deliberately not named test-*.js. It writes
// .uxaudit/<tag>/ (gitignored): one JSON per cell, one viewport screenshot and
// one full-height screenshot per cell, and index.json with the counts.
//
// WHY THIS EXISTS. No test in this project looks at design, and every defect
// the design passes fixed (v314, v316, v318, v324–v332) was found by reading
// the rendered DOM by hand. The fingerprint net records computed STYLES so a
// refactor can be proved inert; it deliberately records no geometry, and it
// navigates the views EMPTY. A design pass needs the opposite: the views WITH
// data, in the owner's real context, with every rect, every effective tap box,
// every contrast ratio and every clipped line — the things the owner's own
// complaints are made of («الصندوق ما يناسب اللي فيه»).
//
// What is measured, and the project law each one is measured against:
//   · tap boxes  — every interactive element, via REAL hit-testing at the four
//                  corners of a 44×44 box (so a ::after halo counts, and a
//                  sibling that steals the corner counts against it). Law: the
//                  44px floor, `--btn-h-*`.
//   · type       — font-size on every element that carries text. Law: nothing
//                  below 11px (v200); inputs ≥ 16px or iOS focus-zooms (v189).
//   · contrast   — text colour against the COMPOSITED background (ancestors
//                  walked, alpha blended). Law: WCAG AA, 4.5:1 / 3:1 large.
//   · clipping   — scrollWidth/Height past the client box under overflow
//                  hidden/clip, or a rect past the viewport edge. Law: the box
//                  fits what is in it (the owner's standing complaint).
//   · the fold   — where the first filled action and the first content sit
//                  against the viewport minus the nav. Law: v318's ladder.
//   · overlap    — two interactive rects intersecting. Law: v324's halo clash.
//   · circles    — border-radius ≥ half the box. Law: device 4, no circles.
//   · render ms  — the synchronous cost of the screen, from the net's timer.
//
// ⚠️ FONTS ARE ALLOWED THROUGH THIS FENCE, unlike the net's. The net blocks
// them for determinism (system-ui differs per machine); an audit of whether
// text FITS is wrong in the wrong face. fonts.googleapis.com and
// fonts.gstatic.com are read-only hosts; everything else is still aborted and
// the run still asserts that nothing else was ever allowed.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { start, ROOT } = require('./fp/server.js');
const VIEWS = require('./fp/views.js');
const { seedFixture } = require('./fp/fixture.js');
const { openContext, settle, timedRender, FROZEN } = require('./fingerprint-net.js');

const OUT = path.join(ROOT, '.uxaudit');
const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; };

const CONTEXTS = {
  one: [{ lang: 'ar', theme: 'dark', width: 375 }],
  extremes: [{ lang: 'ar', theme: 'dark', width: 375 }, { lang: 'en', theme: 'light', width: 412 }],
};

// ── the fence, with the two font hosts admitted ─────────────────────────────
const FONT_HOSTS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];
async function fenceWithFonts(page) {
  const allowed = [], blocked = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const ok = url.startsWith('http://127.0.0.1:') || (route.request().method() === 'GET' && FONT_HOSTS.some((h) => url.startsWith(h)));
    if (ok) { allowed.push(url); return route.continue(); }
    blocked.push(url);
    return route.abort();
  });
  return {
    allowed, blocked,
    assertContained() {
      const escaped = allowed.filter((u) => !u.startsWith('http://127.0.0.1:') && !FONT_HOSTS.some((h) => u.startsWith(h)));
      if (escaped.length) throw new Error('ux-audit: a request escaped the fence: ' + escaped.join(', '));
      return { escaped: 0, fonts: allowed.filter((u) => !u.startsWith('http://127.0.0.1:')).length, blockedTotal: blocked.length };
    },
  };
}

// ── the history the six detail views need, on top of the fixture ────────────
// Serialised into the page; closes over nothing.
function seedHistory(fx) {
  const out = { seeded: [], failed: [] };
  const step = (name, fn) => { try { const r = fn(); out.seeded.push(name); return r; } catch (e) { out.failed.push(name + ': ' + (e && e.message || e)); return null; } };
  const today = fx.today;
  // every weekday trains, so today is a training day for session-day/session-run
  step('plan-all-days', () => DB.plan.setRotation({
    cycle: [{ name: 'Push', exerciseIds: [fx.exerciseId, fx.exerciseId2] }, { name: 'Pull', exerciseIds: [fx.exerciseId3] }],
    trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: addDaysISO(today, -21),
  }));
  // three weeks of sessions on the first exercise: a chart, a PR, a streak
  for (let i = 1; i <= 6; i++) {
    const d = addDaysISO(today, -3 * i);
    step('session-' + i, () => DB.sessions.add({ exerciseId: fx.exerciseId, date: d, sets: [{ reps: 8, weight: 40 + i * 2.5 }, { reps: 8, weight: 42.5 + i * 2.5 }, { reps: 6, weight: 45 + i * 2.5 }] }));
    if (i % 2 === 0) step('session2-' + i, () => DB.sessions.add({ exerciseId: fx.exerciseId2, date: d, sets: [{ reps: 10, weight: 20 }, { reps: 10, weight: 22.5 }] }));
  }
  step('foods-today', () => DB.foodLogs.addMany(today, [
    { name: 'Chicken breast', calories: 330, protein: 62, carbs: 0, fat: 7 },
    { name: 'Rice', calories: 260, protein: 5, carbs: 56, fat: 1 },
    { name: 'Salad', calories: 60, protein: 2, carbs: 8, fat: 2 },
  ]));
  step('water-more', () => DB.water.add(today, 750));
  step('weights', () => { for (let i = 1; i <= 8; i++) DB.bodyweight.log(addDaysISO(today, -4 * i), 78.4 + i * 0.3); });
  step('sleep-more', () => { for (let i = 1; i <= 5; i++) DB.sleep.add({ date: addDaysISO(today, -i), sleepTime: '23:' + (10 + i * 5), wakeTime: '06:' + (30 + i * 3) }); });
  const ex = DB.exercises.list().find((e) => e.id === fx.exerciseId);
  out.muscleCat = ex && ex.category;
  return out;
}

// ── the page-side measurement ───────────────────────────────────────────────
// Serialised into the browser; closes over nothing.
function pageMeasure(opts) {
  const { rootSel, lang } = opts;
  const root = document.querySelector(rootSel);
  if (!root) return { error: 'no root for ' + rootSel };
  const vw = window.innerWidth, vh = window.innerHeight;
  const nav = document.querySelector('.bottom-nav');
  const navRect = nav ? nav.getBoundingClientRect() : null;
  const fold = navRect ? navRect.top : vh;
  const main = document.querySelector('.main');
  const mainRect = main ? main.getBoundingClientRect() : null;

  // ⚠️ SELF-CHECK BEFORE MEASURING. The first run measured every tap box
  // through a username gate the harness had mounted (z-index 1000, inset 0):
  // every elementFromPoint answered 'auth-gate' and every real button scored
  // zero hits. A covering layer is reported by name, never measured through.
  const rr = root.getBoundingClientRect();
  const top = document.elementFromPoint(Math.round(rr.left + rr.width / 2), Math.round(Math.min(rr.top + 40, vh - 1)));
  const coveredBy = top && !root.contains(top) && top !== root ? '<' + top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (top.className && typeof top.className === 'string' ? ' .' + top.className.trim().split(/s+/).slice(0, 2).join('.') : '') + '>' : null;

  const els = [root, ...root.querySelectorAll('*')];
  // two passes, never interleaved — a rect after a style read forces layout
  const rects = els.map((el) => el.getBoundingClientRect());
  const styles = els.map((el) => getComputedStyle(el));

  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  // the composited background under an element: walk up, blend alphas, give up on an image
  const bgUnder = (el) => {
    let acc = null, node = el, unknown = false;
    while (node && node !== document.documentElement) {
      const st = getComputedStyle(node);
      if (st.backgroundImage && st.backgroundImage !== 'none') { unknown = true; break; }
      const c = parse(st.backgroundColor);
      if (c && c.a > 0) {
        if (!acc) acc = c;
        else acc = blend(acc, c);
        if (acc.a >= 0.999) break;
      }
      node = node.parentElement;
    }
    if (unknown) return null;
    if (!acc) return { r: 0, g: 0, b: 0, a: 1 };
    if (acc.a < 0.999) { const body = parse(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 }; acc = blend(acc, body); }
    return acc;
  };

  const isInteractive = (el, st) => {
    if (st.pointerEvents === 'none' || st.visibility === 'hidden' || st.display === 'none') return false;
    if (el.matches('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [role="link"], summary, label[for]')) return true;
    if (el.hasAttribute('onclick') || el.onclick) return true;
    const ti = el.getAttribute('tabindex'); if (ti !== null && Number(ti) >= 0) return true;
    // ⚠️ NOT cursor:pointer. It inherits from a clickable card into every span
    // inside it, and the first draft flagged the calorie ring's own digits as
    // 39 sub-44px controls.
    return false;
  };
  const directText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();

  // ⚠️ A PHOTO PAINTED BY A POSITIONED CHILD IS INVISIBLE TO AN ANCESTOR WALK.
  // The exercise cards put the picture on a sibling of the text, so the walk
  // composited white text over the card's plain colour and reported 132
  // failures in light mode that the screenshot shows are legible. Any painted
  // surface (an <img>, or a background-image) whose box contains the text and
  // is not one of its ancestors makes the answer UNKNOWN, never a number.
  const surfaces = [];
  els.forEach((el, i) => { const st = styles[i], r = rects[i]; if (r.width < 8 || r.height < 8 || st.display === 'none' || st.visibility === 'hidden') return; if (el.tagName.toLowerCase() === 'img' || (st.backgroundImage && st.backgroundImage !== 'none')) surfaces.push({ el, r }); });
  const paintedUnder = (el, r) => surfaces.some((sf) => sf.el !== el && !sf.el.contains(el) && sf.r.left <= r.left + 1 && sf.r.top <= r.top + 1 && sf.r.right >= r.right - 1 && sf.r.bottom >= r.bottom - 1);

  const interactive = [];
  const items = els.map((el, i) => {
    const r = rects[i], st = styles[i];
    const visible = st.display !== 'none' && st.visibility !== 'hidden' && r.width > 1 && r.height > 1 && Number(st.opacity) > 0;   // >1: the .sr-only clip rect is 1x1
    const text = directText(el);
    const inter = visible && isInteractive(el, st);
    const item = {
      i, tag: el.tagName.toLowerCase(), cls: el.className && typeof el.className === 'string' ? el.className.trim().slice(0, 80) : '',
      id: el.id || undefined, role: el.getAttribute('role') || undefined, aria: el.getAttribute('aria-label') || undefined,
      text: text ? text.slice(0, 70) : undefined, allText: !text && visible ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50) || undefined : undefined,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      visible, interactive: inter,
      fs: parseFloat(st.fontSize), fw: st.fontWeight, lh: st.lineHeight, color: st.color, bg: st.backgroundColor,
      display: st.display, overflow: st.overflow, ws: st.whiteSpace, radius: st.borderTopLeftRadius,
      flags: [],
    };
    if (!visible) return item;
    // ── type floor
    if (text && item.fs < 11) item.flags.push('text<11px');
    if (el.matches('input, select, textarea') && item.fs < 16) item.flags.push('input<16px');
    // ── contrast
    if (text && text.length > 0) {
      const fg = parse(st.color), bg = paintedUnder(el, r) ? null : bgUnder(el);
      if (fg && !bg) item.overImage = true;
      if (fg && bg && fg.a > 0) {
        const fgc = fg.a < 1 ? blend(fg, bg) : fg;
        const cr = ratio(fgc, bg);
        item.contrast = Math.round(cr * 100) / 100;
        const large = item.fs >= 24 || (item.fs >= 18.66 && Number(st.fontWeight) >= 700);
        if (cr < (large ? 3 : 4.5)) item.flags.push('contrast<' + (large ? 3 : 4.5));
      } else if (fg && !bg) item.contrast = null;
    }
    // ── clipping and spill (not inside an <svg>: its children are clipped by its viewport)
    const inSvg = el.namespaceURI === 'http://www.w3.org/2000/svg' && el.tagName.toLowerCase() !== 'svg';
    const clipX = el.scrollWidth > el.clientWidth + 1, clipY = el.scrollHeight > el.clientHeight + 1;
    const hidden = /hidden|clip/.test(st.overflow) || /hidden|clip/.test(st.overflowX) || /hidden|clip/.test(st.overflowY);
    const ellipsis = st.textOverflow === 'ellipsis';
    if (!inSvg && (clipX || clipY) && hidden && el !== main && !el.matches('.main, .view')) {
      item.clip = { sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, ellipsis };
      // a deliberate one-line ellipsis is a design; a clipped block is a defect
      item.flags.push(ellipsis && clipX && !clipY ? 'ellipsis' : 'clipped');
    }
    if (!inSvg && (r.right > vw + 1 || r.left < -1)) {
      // inside an overflow-x rail it is content to scroll to; only a spill
      // with no scrolling ancestor is a defect
      let rail = null, node = el.parentElement;
      while (node && node !== root) { const o = getComputedStyle(node).overflowX; if (o === 'auto' || o === 'scroll') { rail = node; break; } node = node.parentElement; }
      if (rail) item.inRail = (rail.className || rail.tagName).toString().split(' ')[0]; else item.flags.push('spillsViewport');
    }
    // ── circles (device 4)
    const rad = parseFloat(st.borderTopLeftRadius);
    if (rad && Math.min(r.width, r.height) >= 20 && (st.borderTopLeftRadius.includes('%') ? parseFloat(st.borderTopLeftRadius) >= 50 : rad >= Math.min(r.width, r.height) / 2 - 0.5) && Math.abs(r.width - r.height) < 2) item.flags.push('circle');
    // ── interactive geometry
    if (inter) {
      item.tap = { w: Math.round(r.width), h: Math.round(r.height) };
      if (r.width < 48 || r.height < 48) {
        // ⚠️ THE EFFECTIVE HIT BOX, MEASURED — not the rect, not four corners.
        // A ::after halo counts (a pseudo hit-tests to its element), a sibling
        // that steals the edge counts against it, and the number is exact:
        // `inset: -4px` is measured from the PADDING box, so a 36px button with
        // a 1px border gets a 42px halo, and corner sampling at ±21 read that as
        // 'sometimes'. Scan outward from the centre in each direction until the
        // hit leaves the element; the sum is the box a thumb actually has.
        // ⚠️ elementFromPoint answers null OUTSIDE the viewport, so a control
        // below the fold read as 'unhittable' — 16 on one screen. Bring it into
        // view, read its LIVE rect, scan, and put the scroller back.
        let live = r;
        // 'in view' means above the NAV, not merely inside the viewport: a control
        // at y 748–812 is on screen and occluded, and a rail item is off-screen
        // sideways. Both are scrolled to, the way a thumb would.
        const scrolled = main && (r.top + r.height / 2 > fold || r.top < 0 || r.right > vw || r.left < 0);
        const rail = scrolled && (r.right > vw || r.left < 0) ? el.closest('[class]') && (() => { let n = el.parentElement; while (n && n !== root) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return n; n = n.parentElement; } return null; })() : null;
        const railLeft = rail ? rail.scrollLeft : 0;
        if (scrolled) { el.scrollIntoView({ block: 'center', inline: 'center' }); live = el.getBoundingClientRect(); }
        const cx = live.left + live.width / 2, cy = live.top + live.height / 2;
        const own = (h) => !!h && (h === el || el.contains(h));
        const reach = (dx, dy) => { let d = 0; for (let k = 1; k <= 26; k++) { const x = cx + dx * k, y = cy + dy * k; if (x < 0 || y < 0 || x >= vw || y >= vh) break; if (!own(document.elementFromPoint(x, y))) break; d = k; } return d; };
        if (!own(document.elementFromPoint(cx, cy))) { item.tap.hit = 0; item.flags.push('unhittable'); }
        else {
          const L = reach(-1, 0), R = reach(1, 0), U = reach(0, -1), D = reach(0, 1);
          item.tap.hit = { w: L + R + 1, h: U + D + 1 };   // the scan stops at ±26, so 53 means '≥ 53'
          if (item.tap.hit.w < 44 || item.tap.hit.h < 44) item.flags.push('tap<44');
        }
        if (scrolled) { main.scrollTop = 0; if (rail) rail.scrollLeft = railLeft; }
      }
      if (r.top >= fold) item.flags.push('belowFold');
      interactive.push({ i, rect: item.rect, el });
    }
    if (item.flags.length === 0) delete item.flags;
    return item;
  });

  // ── overlapping interactive boxes (v324's halo clash)
  const overlaps = [];
  for (let a = 0; a < interactive.length; a++) for (let b = a + 1; b < interactive.length; b++) {
    const A = interactive[a], B = interactive[b];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ra = A.rect, rb = B.rect;
    const ix = Math.min(ra.x + ra.w, rb.x + rb.w) - Math.max(ra.x, rb.x);
    const iy = Math.min(ra.y + ra.h, rb.y + rb.h) - Math.max(ra.y, rb.y);
    if (ix > 2 && iy > 2) overlaps.push({ a: A.i, b: B.i, px: ix * iy });
  }

  // ── the screen's shape
  const primary = items.find((it) => it.visible && /\b(btn-primary|hero-cta|home-center-icon)\b/.test(it.cls));
  const headings = items.filter((it) => it.visible && (/^h[1-4]$/.test(it.tag) || /\b(page-title|section-title|rot-section-title|hero-eyebrow|card-title)\b/.test(it.cls)) && (it.text || it.allText))
    .map((it) => ({ i: it.i, tag: it.tag, cls: it.cls.split(' ').slice(0, 2).join(' '), text: it.text || it.allText, fs: it.fs, y: it.rect.y }));
  const sizes = {};
  for (const it of items) if (it.visible && it.text) sizes[it.fs] = (sizes[it.fs] || 0) + 1;
  const fontsOk = document.fonts ? [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i) : [];

  return {
    coveredBy,
    vw, vh, fold, navH: navRect ? Math.round(navRect.height) : 0,
    scroller: main ? { scrollH: main.scrollHeight, clientH: main.clientHeight, top: Math.round(mainRect.top) } : null,
    dir: document.documentElement.dir || document.body.dir, lang,
    fontsLoaded: fontsOk,
    counts: {
      elements: items.length, visible: items.filter((it) => it.visible).length,
      interactive: interactive.length, interactiveAboveFold: interactive.filter((x) => x.rect.y < fold).length,
      text: items.filter((it) => it.visible && it.text).length,
      flags: items.reduce((m, it) => { for (const f of (it.flags || [])) m[f] = (m[f] || 0) + 1; return m; }, {}),
      overlaps: overlaps.length,
    },
    fontSizes: Object.entries(sizes).sort((a, b) => Number(a[0]) - Number(b[0])).map(([fs, n]) => ({ fs: Number(fs), n })),
    primary: primary ? { i: primary.i, cls: primary.cls, text: primary.text || primary.allText, y: primary.rect.y, h: primary.rect.h, aboveFold: primary.rect.y + primary.rect.h <= fold } : null,
    headings,
    overlaps,
    items,
  };
}

// ── contexts for the six views the matrix captures empty ─────────────────────
function ctxFor(view, fx, hist) {
  switch (view) {
    case 'exercise-detail': return { exerciseId: fx.exerciseId };
    case 'session-run': return { runDate: fx.today };
    case 'session-day': return { sdDate: fx.today };
    case 'muscle-sessions': return { muscleCat: hist.muscleCat || 'Chest' };
    case 'foodlog': return { foodLog: { date: fx.today } };
    case 'day': return { dayDate: fx.yesterday };
    default: return {};
  }
}

async function auditContext(browser, origin, { lang, theme, width }, dir) {
  // our fence, installed by openContext BEFORE the first request: the font
  // sheet is fetched at page load (media=print still downloads), and a fence
  // installed afterwards would find it already aborted.
  const { ctx, page, errors, guard } = await openContext(browser, origin, { lang, theme, width, fenceFn: fenceWithFonts });
  const cells = {}, problems = [];
  try {
    await page.evaluate(() => { document.querySelectorAll('link[rel="stylesheet"][media="print"]').forEach((l) => { l.media = 'all'; }); });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]));
    await page.waitForFunction(() => [...document.fonts].some((f) => f.status === 'loaded'), null, { timeout: 6000 }).catch(() => problems.push(lang + '/' + theme + '/' + width + ': no web font loaded — text-fit measurements are in system-ui'));

    const fx = await page.evaluate(seedFixture);
    for (const f of fx.failed) problems.push('fixture: ' + f);
    const hist = await page.evaluate(seedHistory, fx);
    for (const f of hist.failed) problems.push('history: ' + f);

    for (const v of VIEWS) {
      const cellId = lang + '/' + theme + '/' + width + '/' + v.view;
      const before = errors.length;
      const t = await timedRender(page, cellId, ({ view, ctx }) => {
        try { closeModal(); } catch (_) {}
        const main = document.querySelector('.main'); if (main) main.scrollTop = 0;
        const t0 = performance.now();
        navigate(view, ctx, { fromPop: true });
        return performance.now() - t0;
      }, { view: v.view, ctx: ctxFor(v.view, fx, hist) });
      await settle(page, '.view.active');
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]));
      // ⚠️ THE REMINDER BAR IS REAL, AND SO IS ITS 5-SECOND TIMER. Under the fixture
      // the 08:00 supplement is missed at the frozen noon, so the catch-up bar is
      // up over the top 56px of the first screens — and the harness clock is
      // frozen, so its ntfArmTimer never fires. Record it ONCE as its own object,
      // then let the APP dismiss it by advancing the clock past the timer; the
      // steady state a user reads for the rest of the visit is what is measured.
      const bar = await page.evaluate(() => { const b = document.querySelector('.ntf-bar'); if (!b) return null; const r = b.getBoundingClientRect(); return { rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, title: (b.querySelector('.ntf-title') || {}).textContent || '', body: (b.querySelector('.ntf-body') || {}).textContent || '' }; });
      if (bar) {
        await page.clock.runFor(5600);
        await page.waitForFunction(() => !document.querySelector('.ntf-bar'), null, { timeout: 3000 }).catch(() => problems.push(cellId + ': the reminder bar did not leave 5.6s after its timer was armed'));
        await settle(page, '.view.active');
      }
      const cell = await page.evaluate(pageMeasure, { rootSel: '.view.active', lang });
      if (bar) cell.notifBar = bar;
      cell.view = v.view; cell.cellId = cellId; cell.renderMs = Math.round(t * 10) / 10;
      cell.newErrors = errors.slice(before);
      if (cell.error) problems.push(cellId + ': ' + cell.error);
      if (cell.coveredBy) problems.push(cellId + ': the view is COVERED by ' + cell.coveredBy + ' — every hit-test below it is void');
      if (cell.newErrors && cell.newErrors.length) problems.push(cellId + ': ' + cell.newErrors.join(' | '));
      const base = path.join(dir, cellId.replace(/\//g, '_'));
      await page.screenshot({ path: base + '.fold.png' });
      // the full height of the .main scroller: grow the viewport, shoot, restore
      const tall = await page.evaluate(() => { const m = document.querySelector('.main'); return m ? Math.min(m.scrollHeight + 200, 4000) : 0; });
      if (tall > 812) {
        await page.setViewportSize({ width, height: tall });
        await page.waitForTimeout(80);
        await page.screenshot({ path: base + '.full.png' });
        await page.setViewportSize({ width, height: 812 });
        await page.waitForTimeout(80);
      }
      fs.writeFileSync(base + '.json', JSON.stringify(cell));
      cells[cellId] = { view: v.view, renderMs: cell.renderMs, counts: cell.counts, primary: cell.primary, scroller: cell.scroller, fold: cell.fold, fontsLoaded: cell.fontsLoaded, headings: cell.headings, file: path.basename(base) + '.json', shots: [path.basename(base) + '.fold.png'].concat(tall > 812 ? [path.basename(base) + '.full.png'] : []) };
      process.stdout.write('  ' + cellId.padEnd(38) + String(cell.renderMs).padStart(6) + 'ms  ' + JSON.stringify(cell.counts.flags) + (cell.counts.overlaps ? '  overlaps:' + cell.counts.overlaps : '') + '\n');
    }
    const contained = guard.assertContained();
    return { cells, problems, contained };
  } finally {
    await ctx.close();
  }
}

(async () => {
  const tag = flag('tag', null);
  if (!tag) { console.log('usage: node scripts/ux-audit.js --tag <name> [--contexts extremes|one]'); process.exitCode = 1; return; }
  const contexts = CONTEXTS[flag('contexts', 'extremes')];
  if (!contexts) throw new Error('--contexts must be extremes or one');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.log('ux-audit: playwright is not installed here'); process.exitCode = 1; return; }
  const dir = path.join(OUT, tag);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const srv = start('in');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const index = { tag, at: FROZEN.toISOString(), contexts: contexts.map((c) => c.lang + '/' + c.theme + '/' + c.width), views: VIEWS.length, cells: {}, problems: [], contained: [] };
  try {
    for (const c of contexts) {
      console.log(c.lang + '/' + c.theme + '/' + c.width);
      const r = await auditContext(browser, origin, c, dir);
      Object.assign(index.cells, r.cells);
      index.problems.push(...r.problems);
      index.contained.push(r.contained);
    }
  } finally {
    await browser.close(); await srv.close();
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));
  console.log('\nux-audit: ' + Object.keys(index.cells).length + ' cells → ' + path.relative(ROOT, dir));
  if (index.problems.length) { console.log('problems:'); for (const p of index.problems) console.log('  ✗ ' + p); }
  console.log('fence: ' + JSON.stringify(index.contained));
})().catch((e) => { console.error('ux-audit: ' + (e.stack || e.message)); process.exitCode = 1; });
