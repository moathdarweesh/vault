#!/usr/bin/env node
/**
 * Render the brand's RASTER assets from their vector sources (v403).
 *
 *   node scripts/build-brand-assets.js
 *
 * Two families, one rule: nothing here is drawn by hand, so a raster can never
 * lag the vector it stands in for (the way apple-touch-icon-180.png lagged
 * icon.svg, and the native splash lagged the web one, before this file).
 *
 *   1. icons/apple-touch-icon-180.png — icons/icon.svg's DARK variant on an
 *      opaque black square. iOS rounds the corners itself and ignores SVG.
 *
 *   2. android/app/src/main/res/drawable-<qualifier>/splash.png — the web
 *      splash's FRAME 0, rendered from the LIVE styles.css at each file's own
 *      pixel size: the splash markup from index.html, no JS, no phase class, so
 *      what paints is the resting `.vs-*` rules — which contract 72 holds to
 *      ICONS.dumbbell. Android shows these until the WebView paints, and the
 *      handover is seamless only when this frame equals the stylesheet's; a
 *      change to the resting splash means running this and shipping a new APK.
 *
 * The page is served from a fake origin through page.route, straight off the
 * working tree (as scripts/test-brand-icon.js does): an about:blank document
 * may not load file:// subresources, so a setContent page silently rendered
 * with no stylesheet and a broken image.
 *
 * ⚠️ BAKED INTO THE APK: the splash PNGs reach a phone only with a new build.
 * Uses the same Playwright + Chrome the browser suites use.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android/app/src/main/res');
const ORIGIN = 'http://vault.test';
const TYPES = { '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.html': 'text/html' };

// The splash markup, verbatim from index.html: from `<div class="vs" id="splash"`
// to the </div> that closes it, found by counting divs (the file is CRLF, so a
// line-anchored pattern would miss). Read from the file so the two cannot drift.
function splashMarkup() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('<div class="vs" id="splash"');
  if (start < 0) throw new Error('build-brand-assets: the splash <div class="vs"> was not found in index.html');
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let depth = 0, m;
  while ((m = tag.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error('build-brand-assets: the splash <div> never closes');
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const ctx = await browser.newContext({ colorScheme: 'dark', deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    let doc = '';
    await page.route(ORIGIN + '/**', (route) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (p === '/__page.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: doc });
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
    const shot = async (out, w, h, html) => {
      doc = html;
      await page.setViewportSize({ width: w, height: h });
      await page.goto(ORIGIN + '/__page.html', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
      console.log(`  ${path.relative(ROOT, out).split(path.sep).join('/').padEnd(58)} ${w}×${h}  ${fs.statSync(out).size} bytes`);
    };

    // 1 · the apple-touch icon: the SVG as an <img> on black, 180 square.
    await shot(path.join(ROOT, 'icons/apple-touch-icon-180.png'), 180, 180,
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}img{display:block}</style>
       <img src="/icons/icon.svg" width="180" height="180" alt="">`);

    // 2 · the native splash: frame 0 of the web splash at each PNG's existing size.
    const mark = splashMarkup();
    const dirs = fs.readdirSync(RES).filter((d) => /^drawable(-(land|port)-[a-z]+)?$/.test(d) && fs.existsSync(path.join(RES, d, 'splash.png')));
    if (!dirs.length) throw new Error('build-brand-assets: no drawable*/splash.png found under ' + RES);
    for (const d of dirs) {
      const out = path.join(RES, d, 'splash.png');
      const buf = fs.readFileSync(out);
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);   // keep each file's own size
      await shot(out, w, h,
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
         <link rel="stylesheet" href="/styles.css">
         <style>html,body{margin:0;background:#000;overflow:hidden}</style>
         <body>${mark}</body></html>`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
