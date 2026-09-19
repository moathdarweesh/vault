// Boot cost, measured — because the split plan says every step is measured
// against it and the first two steps shipped with an UPPER BOUND instead.
//
//   node scripts/measure-boot.js --tag before [--n 10]
//   node scripts/measure-boot.js --tag after  [--n 10]
//
// Two lanes, and the pair is the point:
//
//   local   no throttle. Isolates PARSE + EXECUTE — the cost that does not go
//           away on a fast network. This is where an extra <script> shows up.
//   rtt200  200 ms of latency on every request, this project's real measured
//           TTFB (v253: median 215 ms against 3 ms of body download). Deferred
//           scripts are discovered in one HTML parse and fetched in parallel, so
//           if they truly overlap, an extra file costs ~0 here. If they ever
//           serialise, this lane is what says so.
//
// ⚠️ A SINGLE UN-ALTERNATED RUN MEASURES THE MACHINE, NOT THE CHANGE, AND IT
// LIES BY A FACTOR OF FIFTEEN. Measuring v360 the obvious way — baseline first,
// then the change — said DOMContentLoaded had dropped from 71.9 ms to 47.3 ms:
// a 34% IMPROVEMENT from adding a twelfth script, with the two distributions not
// even overlapping. It was entirely the cold first browser launch of the session.
// Alternating before/after/before/after in one window gave 45.6 / 46.7 / 44.8 /
// 46.3 — the extra script costs about +1.3 ms, and the flattering result was the
// harness warming up. So: ALWAYS take both sides in one alternated window, and
// read `first sample vs median` below — a first sample far above the median is
// this trap announcing itself.
'use strict';
const path = require('node:path');
const { start, fence } = require('./fp/server.js');

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const TAG = flag('tag', null);
if (!TAG) { console.log('usage: node scripts/measure-boot.js --tag <name> [--n 10] [--warmups 3]'); process.exit(1); }
const N = Number(flag('n', 10));
const WARMUPS = Number(flag('warmups', 3));
const LANES = [['local', 0], ['rtt200', 200]];

const stat = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return { med: s[s.length >> 1], min: s[0], max: s[s.length - 1] };
};

(async () => {
  const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch();
  const rows = [];
  let meta = null;

  for (const [lane, latency] of LANES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const seen = await fence(page);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (latency) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: -1, uploadThroughput: -1 });

    const dcl = [];
    for (let i = 0; i < N + WARMUPS; i++) {
      await page.goto(origin + '/index.html', { waitUntil: 'load' });
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const js = performance.getEntriesByType('resource').filter((r) => /\.js(\?|$)/.test(r.name));
        return { dcl: nav.domContentLoadedEventEnd - nav.startTime, n: js.length, bytes: js.reduce((a, r) => a + (r.decodedBodySize || 0), 0) };
      });
      if (i < WARMUPS) continue;
      dcl.push(m.dcl); meta = m;
    }
    rows.push([lane, dcl]);
    seen.assertContained();   // the harness fence is the enforcement, not a convention — see fp/server.js
    await ctx.close();
  }

  await browser.close();
  await srv.close();

  console.log(`measure-boot: ${TAG} — ${meta.n} scripts, ${Math.round(meta.bytes / 1024)} KB decoded, ${N} loads per lane (${WARMUPS} discarded)`);
  for (const [lane, dcl] of rows) {
    const s = stat(dcl);
    const drift = dcl[0] - s.med;
    console.log(`  ${lane.padEnd(7)} DOMContentLoaded  median ${s.med.toFixed(1)} ms   (min ${s.min.toFixed(1)}, max ${s.max.toFixed(1)})`);
    console.log(`          first sample vs median: ${drift >= 0 ? '+' : ''}${drift.toFixed(1)} ms` + (drift > s.med * 0.15 ? '   ⚠️ STILL WARMING UP — raise --warmups; this number is not a result yet' : ''));
  }
  for (const [lane, dcl] of rows) console.log(`RAW ${TAG} ${lane} ` + dcl.map((x) => x.toFixed(1)).join(' '));
  console.log('\n  ⚠️ One run is a measurement of this machine. To measure a CHANGE, take both\n     sides in one alternated window: before, after, before, after.');
})();
