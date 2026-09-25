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

// ── prefs: an ENUMERABLE value arrives clamped, through every door ───────────
// prefs.lang reached two hrefs as privacy.html?lang=${…} and prefs.unit five
// templates as ${unit.toUpperCase()}, and loadState only FILLED them when they
// were empty. toUpperCase() is no defence — tag and attribute names are
// case-blind and a numeric entity survives it. Every legal value is known, so
// the value is clamped where a blob comes in, not escaped where it goes out.
{
  const LANG = 'en"><img src=x onerror=alert(1)>';
  const UNIT = '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">';
  const s = context(), { c } = s;
  const poisoned = (b) => ({ ...b, prefs: { ...b.prefs, lang: LANG, unit: UNIT, theme: LANG } });
  const clamped = (door) => {
    const p = c.DB.prefs.get();
    assert.ok(p.lang === 'en' || p.lang === 'ar', `${door}: prefs.lang arrived as ${JSON.stringify(p.lang)}`);
    assert.ok(p.unit === 'kg' || p.unit === 'lb', `${door}: prefs.unit arrived as ${JSON.stringify(p.unit)}`);
    assert.ok(p.theme === 'dark' || p.theme === 'light', `${door}: prefs.theme arrived as ${JSON.stringify(p.theme)}`);
  };
  // A backup file still IMPORTS: a bad preference is corrected, it is not a
  // reason to refuse the user's whole history.
  assert.equal(c.DB.importJSON(JSON.stringify(poisoned(JSON.parse(c.DB.exportJSON())))), true, 'the poisoned backup still imports');
  clamped('a backup file');
  assert.equal(c.Cloud.applyRemote({ data: poisoned(JSON.parse(c.DB.exportJSON())) }, 'alice'), true, 'the poisoned pull still applies');
  clamped('a cloud pull');
  // Another window's write is ADOPTED, not reloaded — a third door.
  s.values.set(s.keys.store, JSON.stringify(poisoned(JSON.parse(s.values.get(s.keys.store)))));
  c.dispatchEvent({ type: 'storage', key: s.keys.store });
  clamped('another window');
  c.DB.prefs.setLang(LANG);
  assert.equal(c.DB.prefs.get().lang, 'en', 'setLang clamps, as setUnit always has');
  c.DB.prefs.setLang('ar');
  assert.equal(c.DB.prefs.get().lang, 'ar', 'and a real choice is kept');
}

// ── cardio week totals: a figure from a blob is a NUMBER before it is a sum ──
// renderCardio added c.duration and c.calories up with `+` and printed the
// totals into innerHTML, so one string from a backup turned the sum into
// concatenated markup — `0<img src=x onerror=…>` in the stat box. Home's
// data-count and the Compare panel repeated the same reduce. The rows beside
// them always coerced; the totals did not. The REAL body.js renders here, on
// the real ui.js vocabulary and dictionaries.
{
  const s = context(), { c } = s;
  for (const f of ['js/i18n.js', 'js/catalog.js', 'js/ui.js', 'js/body.js']) vm.runInContext(read(f), c);
  const app = read('js/app.js');
  const fnSrc = (name) => {   // a top-level function, brace-matched from its declaration
    const at = app.indexOf('function ' + name + '(');
    for (let j = app.indexOf('{', at), d = 0; j < app.length; j++) {
      if (app[j] === '{') d++;
      else if (app[j] === '}' && --d === 0) return app.slice(at, j + 1);
    }
    throw new Error('no function ' + name + ' in js/app.js');
  };
  vm.runInContext(`${fnSrc('weekRanges')}\n${fnSrc('renderCompareCardio')}\nvar viewContext = {};\nfunction vaultBar() { return ''; }\nfunction deltaBlock() { return ''; }`, c);
  const el = { innerHTML: '', querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
  const views = () => { c.renderCardio(el); return { cardio: el.innerHTML, compare: String(c.renderCompareCardio()) }; };
  const clean = (html, where) => {
    assert.equal(html.includes('<img'), false, `${where}: a cardio figure from the blob reached innerHTML as markup`);
    assert.equal(html.includes('onerror'), false, `${where}: onerror in the output`);
  };
  const today = c.todayISO();
  const base = JSON.parse(c.DB.exportJSON());
  base.cardio = [
    { id: 'cw1', type: 'walking', date: today, duration: '"><img id="pwn1" src=x onerror="window.__pwn=1">', calories: PAYLOAD },
    { id: 'cw2', type: 'walking', date: today, duration: 30, calories: 200 },
  ];
  assert.equal(c.DB.importJSON(JSON.stringify(base)), true, 'the backup imports — a bad figure is corrected, not a reason to refuse it');
  for (const row of c.DB.cardio.list()) {
    assert.equal(typeof row.duration, 'number', `cardio ${row.id}: duration arrived as ${JSON.stringify(row.duration)}`);
    assert.equal(typeof row.calories, 'number', `cardio ${row.id}: calories arrived as ${JSON.stringify(row.calories)}`);
  }
  let out = views();
  clean(out.cardio, 'the Cardio tab'); clean(out.compare, 'the Compare panel');
  assert.ok(/stat-box-value num">30</.test(out.cardio), 'an honest figure still sums: 30 minutes this week');
  // The second layer on its own: a row that reached STATE without passing
  // loadState (the shape a future write path could produce) still sums as a
  // number, because the reducers coerce too.
  vm.runInContext(`STATE.cardio.push({ id: 'cw3', type: 'walking', date: ${JSON.stringify(today)}, duration: ${JSON.stringify(PAYLOAD)}, calories: ${JSON.stringify(PAYLOAD)} })`, c);
  out = views();
  clean(out.cardio, 'the Cardio tab, reducer alone'); clean(out.compare, 'the Compare panel, reducer alone');
}

console.log('PASS untrusted render: health.js coerces and escapes every metric; exerciseImageUrl refuses a non-identifier slug (10 payloads); health validated as an object, optional; prefs.lang/unit/theme arrive clamped through a backup, a pull and another window, and setLang clamps; cardio figures arrive as numbers and the Cardio and Compare week totals print no markup, with and without loadState');
