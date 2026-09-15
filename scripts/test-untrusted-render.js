// UNTRUSTED DATA AT THE RENDER SINKS — the shipped js/health.js and js/storage.js,
// fed a poisoned blob. No browser, no network, no personal data.
//
// CLAUDE.md's law: escape untrusted data rendered into innerHTML — and a backup
// file or a cloud pull is untrusted. Two sinks were found where the law did not
// hold and the escaping tool could not have helped:
//
//   · js/health.js — `exercise.minutes` was the ONE metric not coerced through
//     fmt()/round(), and the card interpolated the value raw into the Home
//     screen's innerHTML. `health` was in neither validator's list, so the
//     poisoned blob imported cleanly.
//   · js/storage.js exerciseImageUrl — the slug lands inside
//     style="background-image:url('…')", where the HTML parser decodes &#39;
//     back to a quote BEFORE the CSS parser runs. escapeHtml() is not a defence
//     there; only refusing the characters is.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context } = require('./test-sync-status');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const PAYLOAD = '<img src=x onerror=alert(1)>';

// ── health.js, executed, with the REAL fmtNum ────────────────────────────────
// A harness that stubs fmtNum as String(n) produces a FALSE second finding
// (heartRate.latest appears to be a sink). The real one is Number(n).toLocaleString.
function healthHtml(data) {
  const c = {
    console: { log() {}, warn() {}, error() {} },
    t: (k) => k, icon: () => '<svg></svg>',
    fmtNum: (n) => Number(n).toLocaleString('en-US'),
    escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    formatDuration: (m) => { const x = Math.round(Number(m) || 0); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); },
    DB: { health: { get: () => ({ data, syncedAt: 1, hidden: [] }), isHidden: () => false, set() {}, setHidden() {} } },
    document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},   // health.js subscribes to vault:sync-settled at load
    setTimeout, clearTimeout,
  };
  c.window = c; c.Capacitor = undefined;
  vm.createContext(c);
  vm.runInContext(read('js/health.js'), c);
  return String(c.Health.homeSectionHtml());
}

{
  const html = healthHtml({
    exercise: { minutes: PAYLOAD },
    heartRate: { latest: '<b>hr</b>' },
    calories: '<b>cal</b>',
    sleep: { minutes: 420 },
  });
  assert.ok(html.length > 0, 'the health section rendered something');
  assert.equal(html.includes('<img'), false, 'the poisoned exercise.minutes reached innerHTML raw');
  assert.equal(html.includes('onerror'), false);
  assert.equal(html.includes('<b>'), false, 'no metric lets markup through');
  // and an honest number still renders as one
  const ok = healthHtml({ exercise: { minutes: 42 } });
  assert.ok(/42/.test(ok), 'a real value still renders');
}

// ── storage.js: the slug guard, and the validator ────────────────────────────
{
  const { c } = context();
  const url = (slug) => c.exerciseImageUrl(slug);
  assert.ok(url('Barbell_Bench_Press_-_Medium_Grip').endsWith('Barbell_Bench_Press_-_Medium_Grip.jpg'), 'a bundled seed slug still resolves locally');
  assert.ok(url('Some_Other_Slug').endsWith('/Some_Other_Slug/0.jpg'), 'an unbundled slug still resolves remotely');
  for (const bad of [
    "a'); position:fixed; inset:0; z-index:99999; background:rgb(255,0,0); x:url('b",
    'a"b', 'a b', 'a<b', 'a`b', 'a\\b', "a')", 'a)b', 'a;b', '../x',
  ]) assert.equal(url(bad), '', 'refused: ' + JSON.stringify(bad));
  assert.equal(url(''), ''); assert.equal(url(null), '');

  // `health` must be an object when present — and absent is still fine, so an
  // older backup without it still imports (the validator's own rule).
  const base = JSON.parse(c.DB.exportJSON());
  assert.equal(c.DB._validateBlob({ ...base, health: 'poison' }), false, 'a non-object health slice is refused');
  assert.equal(c.DB._validateBlob({ ...base, health: { data: { exercise: { minutes: PAYLOAD } } } }), true, 'the validator does not deep-check values — the render coerces');
  delete base.health;
  assert.equal(c.DB._validateBlob(base), true, 'a blob without health still validates');
}

console.log('PASS untrusted render: health.js coerces and escapes every metric; exerciseImageUrl refuses a non-identifier slug (10 payloads); health validated as an object, optional');
