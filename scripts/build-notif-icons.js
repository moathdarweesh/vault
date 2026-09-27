#!/usr/bin/env node
/**
 * Generate the seven notification assets from APPLY-notifications.md §1.
 *
 *   node scripts/build-notif-icons.js
 *
 * WHY A GENERATOR AND NOT SEVEN CHECKED-IN PNGs
 * Six of the seven are a brand tile wrapped around a glyph that already lives in
 * `ICONS` in js/app.js. Hand-exporting them means the day someone fixes the
 * `droplet` path, the notification tray keeps the old one forever and nothing
 * says so. This reads the live ICONS object, so the assets cannot drift.
 *
 * THE BADGE IS THE ONE THAT MATTERS. Android throws away every colour in a
 * notification's small icon and prints its ALPHA CHANNEL, tinted. So:
 *   - white ink only; any other colour is discarded anyway;
 *   - a fully transparent background, or the tile becomes the white square;
 *   - the gaps in the mark must be GAPS, not black shapes. Black is ink as far
 *     as alpha is concerned, so a painted gap fills solid. This is the same
 *     trap the Android themed icon hit in v212.
 *
 * THE BADGE IS THE BARBELL (v403, owner decision): ICONS.dumbbell's five
 * rectangles, scaled .95 about the glyph's centre — the SAME geometry as
 * android/.../drawable/ic_stat_vault.xml, so a reminder looks the same on the
 * phone and in a browser. scripts/test-brand-icon.js checks the output.
 *
 * Rendering is Chrome headless: no dependency, and it rasterises the real SVG
 * rather than approximating it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'icons');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---- the badge: the barbell silhouette, from the live glyph ---------------
// Read from ICONS.dumbbell at build time (see readIcons) and bound to white:
// the five rectangles at .95 about (12,12), as ic_stat_vault.xml draws them.
//
// ONE PATH, NOT FIVE RECTS (v405). Five separate <rect>s put the shaft/plate
// joins (x = 9.5 and 14.5 → 38.5 and 57.5 px at 96) on half pixels, and two
// antialiased edges compose to alpha ≈ 191: a hairline of background through
// the tint on every reminder. ic_stat_vault.xml is one path of five subpaths
// for exactly this reason. The same path data is generated HERE from the
// glyph's rects (rect → M/h/a/v with the rx corners), so the glyph stays the
// one source and the badge cannot drift from it — and it is checked against
// the status-bar icon's pathData, which must be the identical string.
const rectsOf = (svg) => [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map(([, a]) => {
  const n = (k) => { const m = a.match(new RegExp('\\b' + k + '="([^"]*)"')); return m ? Number(m[1]) : 0; };
  return { x: n('x'), y: n('y'), w: n('width'), h: n('height'), r: n('rx') };
});
const num = (v) => String(Math.round(v * 1000) / 1000);
const rectPath = ({ x, y, w, h, r }) => (r
  ? `M${num(x + r)},${num(y)}h${num(w - 2 * r)}a${num(r)},${num(r)} 0 0 1 ${num(r)},${num(r)}v${num(h - 2 * r)}a${num(r)},${num(r)} 0 0 1 -${num(r)},${num(r)}h-${num(w - 2 * r)}a${num(r)},${num(r)} 0 0 1 -${num(r)},-${num(r)}v-${num(h - 2 * r)}a${num(r)},${num(r)} 0 0 1 ${num(r)},-${num(r)}Z`
  : `M${num(x)},${num(y)}h${num(w)}v${num(h)}h-${num(w)}Z`);
const badgePath = (dumbbell) => rectsOf(dumbbell).map(rectPath).join('');
const badgeSvg = (dumbbell) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
  <g transform="translate(12 12) scale(0.95) translate(-12 -12)"><path fill="#fff" d="${badgePath(dumbbell)}"/></g>
</svg>`;
const STAT_ICON = path.join(ROOT, 'android/app/src/main/res/drawable/ic_stat_vault.xml');

// ---- the six category tiles ----------------------------------------------
const TILES = [
  ['cat-train-192',   'dumbbell'],
  ['cat-supps-192',   'pill'],
  ['cat-water-192',   'droplet'],
  ['cat-food-192',    'utensils'],
  ['cat-streak-192',  'zap'],
  ['cat-summary-192', 'bell'],
];

function readIcons() {
  // js/catalog.js since v334. This read app.js for twenty-two releases after the
  // move, where `indexOf('const ICONS')` matched `const ICONS_FOR` - a local in
  // renderNotifications - then brace-walked an unrelated block and reported every
  // glyph missing. Nothing noticed: no npm script, no contract and no CI runs it.
  // Read where it lives, match the whole declaration, and refuse to guess.
  const s = fs.readFileSync(path.join(ROOT, 'js', 'catalog.js'), 'utf8');
  const i = s.indexOf('const ICONS = ');
  if (i < 0) throw new Error('build-notif-icons: `const ICONS = ` not found in js/catalog.js');
  const j = s.indexOf('{', i);
  let d = 0, k;
  for (k = j; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) break; }
  }
  const body = s.slice(j, k + 1);
  const out = {};
  const re = /^\s{2}([a-zA-Z]+):\s*'(.*)',?\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) out[m[1]] = m[2];
  return out;
}

/** The glyph paths carry currentColor / var(--icon-accent); a standalone PNG
 *  has neither, so bind them to the spec's two literals. This is the ONE place
 *  an explicit colour inside an <svg> is allowed — §1's stated exception for
 *  exported asset files. */
function bindColours(pathMarkup) {
  return pathMarkup
    .replace(/var\(--icon-accent,\s*#ff6a00\)/g, '#ff6a00')
    .replace(/var\(--icon-accent\)/g, '#ff6a00')
    .replace(/currentColor/g, '#F4EFE9');
}

function tileSvg(glyph) {
  const g = bindColours(glyph);
  const S = 192, R = 42, ART = 112, off = (S - ART) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="${R}" fill="#000"/>
  <g transform="translate(${off} ${off}) scale(${ART / 24})">${g}</g>
</svg>`;
}

function render(svg, outFile, size) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-icon-'));
  const html = path.join(tmp, 'i.html');
  // margin:0 and a transparent body: --default-background-color=00000000 keeps
  // the badge's background genuinely empty rather than white.
  fs.writeFileSync(html,
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg}`);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--screenshot=${outFile}`,
    `--window-size=${size},${size}`,
    'file:///' + html.replace(/\\/g, '/'),
  ], { stdio: 'pipe' });
  fs.rmSync(tmp, { recursive: true, force: true });
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ICONS = readIcons();

  if (!ICONS.dumbbell) throw new Error('build-notif-icons: ICONS.dumbbell missing — the badge is drawn from it');
  // One geometry on both platforms: the path generated from the glyph must be
  // the status-bar icon's pathData, character for character.
  const statPath = (fs.readFileSync(STAT_ICON, 'utf8').match(/android:pathData="([^"]*)"/) || [])[1];
  if (statPath !== badgePath(ICONS.dumbbell)) {
    throw new Error(`build-notif-icons: the badge path generated from ICONS.dumbbell is not ic_stat_vault.xml's pathData\n  glyph: ${badgePath(ICONS.dumbbell)}\n  stat : ${statPath}`);
  }
  const badgeOut = path.join(OUT, 'badge-96.png');
  render(badgeSvg(ICONS.dumbbell), badgeOut, 96);
  console.log(`  badge-96.png            ${fs.statSync(badgeOut).size} bytes  (white ink, transparent, the barbell at .95 as ONE path — ic_stat_vault.xml's)`);

  for (const [name, key] of TILES) {
    if (!ICONS[key]) { console.error(`  MISSING glyph in ICONS: ${key}`); process.exitCode = 1; continue; }
    const out = path.join(OUT, `${name}.png`);
    render(tileSvg(ICONS[key]), out, 192);
    console.log(`  ${(name + '.png').padEnd(24)}${fs.statSync(out).size} bytes  (${key})`);
  }
}

main();
