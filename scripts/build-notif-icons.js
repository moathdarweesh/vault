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
 *   - the slot through the mark must be a GAP, not a black shape. Black is ink
 *     as far as alpha is concerned, so a painted slot fills solid and the cut
 *     disappears. This is the same trap the Android themed icon hit in v212.
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

// ---- the badge, verbatim from the spec -----------------------------------
const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
  <path d="M2.6 3.4H7.2L10.1 10.6H5.5Z" fill="#fff"/>
  <path d="M16.8 3.4H21.4L18.5 10.6H13.9Z" fill="#fff"/>
  <path d="M6.7 13.4H11.3L12 15.2L12.7 13.4H17.3L14.4 20.6H9.6Z" fill="#fff"/>
</svg>`;

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
  const s = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  const i = s.indexOf('const ICONS');
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

  const badgeOut = path.join(OUT, 'badge-96.png');
  render(BADGE, badgeOut, 96);
  console.log(`  badge-96.png            ${fs.statSync(badgeOut).size} bytes  (white ink, transparent, slot is a gap)`);

  for (const [name, key] of TILES) {
    if (!ICONS[key]) { console.error(`  MISSING glyph in ICONS: ${key}`); process.exitCode = 1; continue; }
    const out = path.join(OUT, `${name}.png`);
    render(tileSvg(ICONS[key]), out, 192);
    console.log(`  ${(name + '.png').padEnd(24)}${fs.statSync(out).size} bytes  (${key})`);
  }
}

main();
