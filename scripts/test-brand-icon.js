// THE APP ICON, RENDERED (v403 — owner decision: the logo is the barbell again,
// in «الجمر», the embers: ember outer plates, accent inner plates, a bone shaft).
//
// Contract 72 holds the GEOMETRY of icons/icon.svg to ICONS.dumbbell as text.
// Text cannot see what a browser tab, a PWA install or a maskable crop sees, so
// this renders the file the way they meet it and asserts:
//
//   · it decodes as an IMAGE at all. An XML comment with a double hyphen in it
//     breaks the whole file for an image/svg+xml consumer while the HTML parser
//     shrugs (CLAUDE.md, v212) — a text diff will not show that.
//   · the fills, in both schemes, by role: outer plates #b84a00; inner plates
//     #ff6a00 on the black tile and #e05c00 on the bone one; the shaft #fdfaf7
//     on black and #1a1512 on bone.
//   · contrast: every plate ≥ 3:1 on its tile and the shaft ≥ 4.5:1, both
//     tiles, no exceptions.
//   · at 512, 192 and 48 px in both schemes: every ink pixel inside the maskable
//     safe circle (the inner 80% — manifest.json declares `maskable`), the ink
//     at ~62% of the tile, and each fill's pixels inside its own rectangles.
//   · the two PNGs re-rendered by hand whenever the mark changes, which is how
//     they went stale before: icons/apple-touch-icon-180.png (opaque, square —
//     iOS masks it) and icons/badge-96.png (white on transparent — a
//     notification badge is printed from its alpha).
//
// Uses the externally provided Playwright + Chrome, like the other browser suites.
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://vault.test';
const FILL = {
  dark: { tile: '#000000', outer: '#b84a00', inner: '#ff6a00', shaft: '#fdfaf7' },
  // On the bone tile the inner plates step down to the accent's second step:
  // the raw #ff6a00 measures 2.65:1 there, #e05c00 3.40:1 — the move the macro
  // bars make on light, and a ruling (v403) not to carry an exception instead.
  light: { tile: '#faf5f0', outer: '#b84a00', inner: '#e05c00', shaft: '#1a1512' },
};
const ROLE_OF = (w, h) => ({ '3x6': 'outer', '4x12': 'inner', '5x3.2': 'shaft' })[`${w}x${h}`];
// The canonical placement in the 512 tile: ICONS.dumbbell at scale 15, inset 76,
// so the glyph's centre (12,12) lands on the tile's and the ink spans 61.5%.
const CANON = { outer: [], inner: [], shaft: [] };
const GLYPH = (fs.readFileSync(path.join(ROOT, 'js/catalog.js'), 'utf8').match(/^\s+dumbbell:\s*'([^']*)'/m) || ['', ''])[1];
for (const m of GLYPH.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
  const [x, y, w, h] = m.slice(1).map(Number), r = ROLE_OF(w, h);
  if (r) CANON[r].push({ x: 76 + 15 * x, y: 76 + 15 * y, w: 15 * w, h: 15 * h });
}

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (hex) => { const c = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const toHex = (rgb) => '#' + rgb.match(/[\d.]+/g).slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('');
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// In the page: draw one image at S×S and summarise it. `boxes` are the mark's
// rectangles in 512-space, by role; `tile` the ground the ink is measured off.
async function analyse(page, src, S, tile, fills, boxes) {
  return page.evaluate(async ({ src, S, tile, fills, boxes }) => {
    const img = new Image(); img.src = src;
    try { await img.decode(); } catch (e) { return { error: 'does not decode as an image: ' + e.message }; }
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data, k = S / 512;
    const out = { ink: 0, maxR: 0, bbox: [S, S, -1, -1], roles: {}, corner: [d[0], d[1], d[2], d[3]], opaque: true };
    for (const r of Object.keys(fills)) out.roles[r] = { n: 0, stray: 0 };
    const near = (i, rgb, t) => Math.abs(d[i] - rgb[0]) <= t && Math.abs(d[i + 1] - rgb[1]) <= t && Math.abs(d[i + 2] - rgb[2]) <= t;
    const inside = (x, y, bs) => bs.some((b) => x + 0.5 >= b.x * k - 1 && x + 0.5 <= (b.x + b.w) * k + 1 && y + 0.5 >= b.y * k - 1 && y + 0.5 <= (b.y + b.h) * k + 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (d[i + 3] !== 255) { out.opaque = false; continue; }
      if (near(i, tile, 16)) continue;
      out.ink++;
      out.maxR = Math.max(out.maxR, Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2));
      out.bbox = [Math.min(out.bbox[0], x), Math.min(out.bbox[1], y), Math.max(out.bbox[2], x), Math.max(out.bbox[3], y)];
      for (const [r, rgb] of Object.entries(fills)) if (near(i, rgb, 1)) { out.roles[r].n++; if (!inside(x, y, boxes[r])) out.stray++, out.roles[r].stray++; }
    }
    return out;
  }, { src, S, tile: rgbOf(tile), fills: Object.fromEntries(Object.entries(fills).map(([r, h]) => [r, rgbOf(h)])), boxes });
}

async function run() {
  const fails = [], notes = [];
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const scheme of ['dark', 'light']) {
      const page = await browser.newPage({ colorScheme: scheme, viewport: { width: 600, height: 600 } });
      await page.route(ORIGIN + '/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        if (p === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0"></body>' });
        return route.fulfill({ contentType: p.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: fs.readFileSync(path.join(ROOT, p)) });
      });

      // 1 · the SVG as a document: each mark rectangle's role, computed fill and box.
      await page.goto(ORIGIN + '/icons/icon.svg');
      const doc = await page.evaluate(() => ({
        tile: (() => { const t = document.querySelector('.tile'); return t ? getComputedStyle(t).fill : null; })(),
        marks: [...document.querySelectorAll('g[transform] rect')].map((r) => {
          const m = r.getCTM(), a = (n) => +r.getAttribute(n);
          return { w: a('width'), h: a('height'), fill: getComputedStyle(r).fill, box: { x: m.a * a('x') + m.e, y: m.d * a('y') + m.f, w: m.a * a('width'), h: m.d * a('height') } };
        }),
      }));
      const want = FILL[scheme], boxes = { outer: [], inner: [], shaft: [] }, seen = { outer: [], inner: [], shaft: [] };
      const tile = doc.tile && toHex(doc.tile);
      if (tile !== want.tile) fails.push(`${scheme}: the tile is ${tile}, not ${want.tile}`);
      for (const m of doc.marks) { const r = ROLE_OF(m.w, m.h); if (r) { seen[r].push(toHex(m.fill)); boxes[r].push(m.box); } }
      const counts = `${seen.outer.length} outer, ${seen.inner.length} inner, ${seen.shaft.length} shaft`;
      const markOk = seen.outer.length === 2 && seen.inner.length === 2 && seen.shaft.length === 1 && doc.marks.length === 5;
      if (!markOk) fails.push(`${scheme}: icons/icon.svg's mark group holds ${doc.marks.length} rect(s) (${counts}) — the barbell is 2 outer 3×6, 2 inner 4×12 and 1 shaft 5×3.2`);
      for (const r of markOk ? ['outer', 'inner', 'shaft'] : []) {
        for (const f of seen[r]) if (f !== want[r]) fails.push(`${scheme}: a ${r} rect is ${f}, not ${want[r]}`);
        const cr = ratio(want[r], want.tile), floor = r === 'shaft' ? 4.5 : 3;
        if (cr < floor) fails.push(`${scheme}: the ${r} ${want[r]} is ${cr.toFixed(2)}:1 on ${want.tile}, under ${floor}:1`);
        notes.push(`${scheme} ${r} ${want[r]} ${cr.toFixed(2)}:1`);
      }

      // 2 · rendered at the three sizes a tab, a launcher and an install ask for.
      await page.goto(ORIGIN + '/');
      const fills = { outer: want.outer, inner: want.inner, shaft: want.shaft };
      for (const S of markOk ? [512, 192, 48] : []) {
        const a = await analyse(page, '/icons/icon.svg', S, want.tile, fills, boxes);
        if (a.error) { fails.push(`${scheme}/${S}: icons/icon.svg ${a.error}`); continue; }
        const spanPct = ((a.bbox[2] - a.bbox[0] + 1) / S) * 100;
        if (!a.ink) fails.push(`${scheme}/${S}: no ink at all`);
        if (a.maxR > 0.4 * S + 0.75) fails.push(`${scheme}/${S}: ink reaches ${a.maxR.toFixed(1)}px from the centre, outside the maskable circle (${(0.4 * S).toFixed(1)}px)`);
        if (spanPct < 58 || spanPct > 66) fails.push(`${scheme}/${S}: the ink spans ${spanPct.toFixed(1)}% of the tile, not ~62%`);
        for (const [r, v] of Object.entries(a.roles)) {
          if (!v.n) fails.push(`${scheme}/${S}: no pixel is the ${r} fill ${fills[r]}`);
          if (v.stray) fails.push(`${scheme}/${S}: ${v.stray} pixel(s) of the ${r} fill lie outside the ${r} rectangles`);
        }
        if (S === 512) notes.push(`${scheme} 512: ink ${spanPct.toFixed(1)}% wide, ${(a.maxR / S * 100).toFixed(1)}% of the tile from the centre (maskable ≤ 40%)`);
      }

      // 3 · the two hand-rendered PNGs follow the dark tile; checked once, against
      // the canonical placement rather than the SVG's, so a broken SVG cannot excuse them.
      if (scheme === 'dark') {
        const t = await analyse(page, '/icons/apple-touch-icon-180.png', 180, want.tile, fills, CANON);
        if (t.error) fails.push('apple-touch-icon-180.png ' + t.error);
        else {
          if (!t.opaque || t.corner.join() !== '0,0,0,255') fails.push(`apple-touch-icon-180.png must be an opaque square black tile (iOS rounds it); corner ${t.corner}, opaque ${t.opaque}`);
          for (const [r, v] of Object.entries(t.roles)) if (!v.n || v.stray) fails.push(`apple-touch-icon-180.png: the ${r} fill has ${v.n} pixel(s), ${v.stray} outside its rectangles — re-render it from icons/icon.svg`);
        }
        const b = await page.evaluate(async () => {
          const img = new Image(); img.src = '/icons/badge-96.png'; await img.decode();
          const c = document.createElement('canvas'); c.width = c.height = 96;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, 96, 96).data, A = (x, y) => d[(y * 96 + x) * 4 + 3];
          let tint = 0, x0 = 96, x1 = -1, y0 = 96, y1 = -1;
          for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
            const i = (y * 96 + x) * 4;
            if (d[i + 3] > 32 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) tint++;
            if (d[i + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
          }
          // the gaps between each outer and inner plate, and the solid shaft, at mid-height
          return { tint, box: [x0, y0, x1, y1], corner: A(0, 0), gaps: [A(21, 48), A(74, 48)], shaft: A(48, 48), inner: A(30, 30) };
        });
        // the silhouette at 0.95 about the centre, as ic_stat_vault.xml draws it: x 2.025..21.975, y 6.3..17.7 of 24
        const exp = [8, 25, 87, 70];
        if (b.tint) fails.push(`badge-96.png has ${b.tint} pixel(s) that are not white — a badge is printed from its alpha only`);
        if (b.corner !== 0) fails.push('badge-96.png is not transparent at its corner');
        if (b.box.some((v, i) => Math.abs(v - exp[i]) > 1)) fails.push(`badge-96.png's silhouette spans [${b.box}], the barbell at 0.95 spans [${exp}]`);
        if (b.gaps.some((v) => v > 32) || b.shaft !== 255 || b.inner !== 255) fails.push(`badge-96.png is not the barbell silhouette (gap alpha ${b.gaps}, shaft ${b.shaft}, inner plate ${b.inner})`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
  if (fails.length) {
    console.error('FAIL icon:\n  - ' + fails.join('\n  - '));
    process.exitCode = 1;
    return;
  }
  console.log('  ' + notes.join('\n  '));
  console.log('PASS icon: icons/icon.svg at 512/192/48 × dark/light — B fills by role, contrast, maskable circle, each fill inside its own plates; apple-touch-icon-180 and badge-96 are the barbell');
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
