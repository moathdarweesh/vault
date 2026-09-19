#!/usr/bin/env node
// THE DAILY THREE, COUNTED — how many taps from Home to the writes a user makes
// every day: a set, a cup of water, the morning weight, a saved food.
//
//   node scripts/ux-flows.js                # ar/dark/375, seeded, real clicks
//
// ⚠️ A TOOL, NOT A SUITE (not test-*.js). It prints a table and writes
// .uxaudit/flows.json. It exists because «اسهل ما يكون» is a number: the tap
// count of the thing done most often. Every path here is driven with REAL
// clicks on the rendered app (Playwright mouse, not element.click()), so a
// control that is covered, under the nav, or 42px wide costs what it really
// costs — and every write is PROVED by reading DB.* afterwards, so "two taps"
// means two taps that produced a row.
//
// What is recorded per path: the taps in order (selector, where it was on
// screen at tap time, whether it needed a scroll to reach), typing steps, the
// time from the first tap to the write landing (fake clock, so this is work
// not waiting), and the DB read that proves it.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { start, ROOT } = require('./fp/server.js');
const { seedFixture } = require('./fp/fixture.js');
const { openContext, settle } = require('./fingerprint-net.js');

const OUT = path.join(ROOT, '.uxaudit');

async function drive(page, steps, ctxName) {
  const log = [];
  const fold = await page.evaluate(() => { const n = document.querySelector('.bottom-nav'); return n ? n.getBoundingClientRect().top : window.innerHeight; });
  for (const s of steps) {
    if (s.type) {
      const loc = page.locator(s.sel).first();
      await loc.fill(String(s.type));
      log.push({ kind: 'type', sel: s.sel, value: s.type });
      continue;
    }
    if (s.wait) { await page.clock.runFor(s.wait); await page.waitForTimeout(40); continue; }
    const loc = page.locator(s.sel).first();
    await loc.waitFor({ state: 'visible', timeout: 4000 });
    // ⚠️ SETTLE BEFORE READING WHERE IT IS. A sheet is measured mid-entrance
    // otherwise: the weight button once read y=1095 — its resting 678 plus one
    // sheet-height — and the log said 'under the nav' about a control that was
    // simply still arriving. The net's settle() waits on animations by state.
    await settle(page, (await page.evaluate(() => !!document.querySelector('#modal-root .modal-overlay'))) ? '#modal-root' : '.view.active');
    // where is it BEFORE we touch it — under the nav means a scroll to reach
    const box = await loc.boundingBox();
    const inNav = s.sel.includes('.bottom-nav');   // the nav IS the fold line; its own buttons are not under it
    const under = box && !inNav ? (box.y + box.height / 2 > fold || box.y < 0) : null;
    if (under) await loc.scrollIntoViewIfNeeded();
    const b2 = await loc.boundingBox();
    // a REAL click at the centre: a covered or 42px control fails or lands elsewhere
    await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.clock.runFor(s.after || 400);
    await page.waitForTimeout(60);
    log.push({ kind: 'tap', sel: s.sel, y: Math.round(box.y), h: Math.round(box.height), w: Math.round(box.width), scrolledToReach: !!under, label: s.label || '' });
  }
  return { ctx: ctxName, taps: log.filter((l) => l.kind === 'tap').length, typing: log.filter((l) => l.kind === 'type').length, steps: log };
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.log('ux-flows: playwright is not installed here'); process.exitCode = 1; return; }
  const srv = start('in');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results = [];
  try {
    const ctxName = 'ar/dark/375';
    const { ctx, page, errors, guard } = await openContext(browser, origin, { lang: 'ar', theme: 'dark', width: 375 });
    const fx = await page.evaluate(seedFixture);
    // every day trains, so Home has a workout to start
    await page.evaluate((fx) => DB.plan.setRotation({ cycle: [{ name: 'Push', exerciseIds: [fx.exerciseId, fx.exerciseId2] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: addDaysISO(fx.today, -7) }), fx);
    const home = async () => { await page.evaluate(() => { try { closeModal(); } catch (_) {} document.querySelectorAll('.sheet-overlay, .img-lightbox').forEach((e) => e.remove()); const m = document.querySelector('.main'); if (m) m.scrollTop = 0; navigate('home', {}, { fromPop: true }); }); await settle(page, '.view.active'); await page.clock.runFor(6000); await page.waitForTimeout(60); };
    const read = (fn, arg) => page.evaluate(fn, arg);

    // ── 1. a cup of water ────────────────────────────────────────────────────
    await home();
    const water0 = await read((d) => DB.water.get(d), fx.today);
    const w = await drive(page, [
      { sel: '.view.active [data-unified-search]', label: 'search (top bar)' },
      { sel: '#cx-quick .cx-actions button:first-child', label: '+250', after: 1000 },
    ], ctxName);
    const water1 = await read((d) => DB.water.get(d), fx.today);
    results.push({ path: 'water +250 ml', ...w, proof: `DB.water ${water0} → ${water1}`, landed: water1 === water0 + 250 });

    // ── 2. the morning weight ───────────────────────────────────────────────
    await home();
    const bw0 = await read(() => DB.bodyweight.list().length);
    const bw = await drive(page, [
      { sel: '.view.active [data-unified-search]', label: 'search (top bar)' },
      { sel: '#cx-quick [data-ql="weight"]', label: 'الوزن' },
      { sel: '#weight-input', type: '77.9' },
      { sel: '#weight-save', label: 'save', after: 800 },
    ], ctxName);
    const bw1 = await read((d) => { const l = DB.bodyweight.list(); const t = l.find((e) => e.date === d); return { n: l.length, today: t && t.kg }; }, fx.today);
    results.push({ path: 'body weight', ...bw, proof: `DB.bodyweight ${bw0} rows → ${bw1.n}, today=${bw1.today}`, landed: bw1.today === 77.9 });

    // ── 3. a set in today's workout ─────────────────────────────────────────
    await home();
    const s0 = await read((a) => DB.sessions.listAll().filter((s) => s.date === a.today && s.exerciseId === a.exerciseId).length, fx);
    const set = await drive(page, [
      { sel: '#home-start-workout', label: 'تمرين اليوم (hero)' },
      // the hero opens session-day (the day's list with inline set rows), not the guided run
      { sel: '.view.active [data-set="0"] [data-field="reps"]', type: '8' },
      { sel: '.view.active [data-set="0"] [data-field="weight"]', type: '60' },
      // session-day has no per-row tick: typing reveals the card's Save (.sd-save-btn loses .sd-hidden), and that is the commit
      { sel: '.view.active .sd-save-btn:not(.sd-hidden)', label: 'save (card)', after: 1500 },
    ], ctxName);
    const s1 = await read((a) => { const l = DB.sessions.listAll().filter((s) => s.date === a.today && s.exerciseId === a.exerciseId); return { n: l.length, sets: l[0] && l[0].sets }; }, fx);
    results.push({ path: 'a set (today, first exercise)', ...set, proof: `DB.sessions today/ex1 ${s0} → ${s1.n}, sets=${JSON.stringify(s1.sets)}`, landed: s1.n === 1 && !!s1.sets && s1.sets.length >= 1 && Number(s1.sets[0].reps) === 8 });

    // ── 4. a saved food ─────────────────────────────────────────────────────
    await home();
    const f0 = await read((d) => DB.foodLogs.listForDate(d).length, fx.today);
    const food = await drive(page, [
      { sel: '.bottom-nav .nav-btn[data-view="food"]', label: 'Food tab' },
      { sel: '#food-fab', label: 'FAB +' },
      { sel: '.add-tile[data-method="saved"]', label: 'saved foods tile', after: 600 },
      { sel: '#modal-root .picker-row[data-add-saved="0"]', label: 'first saved food', after: 1200 },
    ], ctxName);
    const f1 = await read((d) => DB.foodLogs.listForDate(d).length, fx.today);
    results.push({ path: 'a saved food', ...food, proof: `DB.foodLogs today ${f0} → ${f1}`, landed: f1 === f0 + 1 });

    const contained = guard.assertContained();
    await ctx.close();
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'flows.json'), JSON.stringify({ results, errors, contained }, null, 2));

    console.log('\nux-flows — taps from Home to the write (ar/dark/375, seeded):\n');
    for (const r of results) {
      console.log(`  ${r.path.padEnd(32)} ${String(r.taps).padStart(2)} taps · ${r.typing} typed · ${r.landed ? 'LANDED' : 'DID NOT LAND'}   ${r.proof}`);
      for (const s of r.steps) console.log('      ' + (s.kind === 'tap' ? `tap  ${s.label.padEnd(22)} y=${String(s.y).padStart(4)} ${s.w}×${s.h}${s.scrolledToReach ? '  (under the nav — scrolled to reach)' : ''}` : `type ${s.value}`));
    }
    if (errors.length) { console.log('\npage errors:'); for (const e of errors) console.log('  ✗ ' + e); }
    console.log('\nfence: ' + JSON.stringify(contained));
    if (results.some((r) => !r.landed)) process.exitCode = 1;
  } finally {
    await browser.close(); await srv.close();
  }
})().catch((e) => { console.error('ux-flows: ' + (e.stack || e.message)); process.exitCode = 1; });
