// THE CI SMOKE LANE OF THE FINGERPRINT NET.
//
// scripts/fingerprint-net.js is a TOOL (before/after on one machine) and is
// deliberately not named test-*.js. This file is the one suite that turns its
// four free failure signals — a page error during any render, a view that
// renders ZERO children, a raw i18n key on screen, an empty <svg> — plus the
// hang lane (a render that never returns) into a check that runs on every push,
// across BOTH languages, BOTH themes and two widths.
//
// It does NOT diff against a committed baseline: fonts are blocked by the fence,
// so the app under test renders in system-ui, which differs between Windows,
// macOS and the CI runner — a byte baseline would fail on every machine but the
// one that recorded it. The invariants above hold everywhere; the diff stays a
// local tool. Needs Playwright: absent locally it is reported as a SKIP by
// test-all.js, and under --strict (CI) a skip is a failure.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

require('playwright');   // MODULE_NOT_FOUND here is what test-all.js reads as "needs a browser runtime"

const ROOT = path.resolve(__dirname, '..');
const TAG = 'ci-smoke';
const VIEWS = require('./fp/views.js');

const r = spawnSync(process.execPath, [path.join(__dirname, 'fingerprint-net.js'), 'matrix', '--tag', TAG, '--props', 'stage1'], {
  cwd: ROOT, encoding: 'utf8', timeout: 12 * 60 * 1000,
});
const out = (r.stdout || '') + (r.stderr || '');
if (r.error) throw r.error;

const file = path.join(ROOT, '.fpnet', TAG + '.json');
assert.ok(fs.existsSync(file), 'the matrix wrote no record:\n' + out);
const rec = JSON.parse(fs.readFileSync(file, 'utf8'));

// Every cell of the matrix, no view missing: 8 contexts × the view list.
const cells = Object.keys(rec.cells);
assert.equal(cells.length, 8 * VIEWS.length, 'expected 8 × ' + VIEWS.length + ' cells, got ' + cells.length);

// The free failure signals and the hang lane, verbatim from the tool.
assert.deepEqual(rec.problems, [], 'the net reported problems:\n  ' + rec.problems.join('\n  ') + '\n' + out);
assert.equal(r.status, 0, 'fingerprint-net exited ' + r.status + ':\n' + out);

// The fence is enforcement, not convention: nothing may have left the machine.
assert.equal(rec.contained.escaped, 0, 'a request escaped the fence');

// Not one view rendered empty anywhere in the matrix — checked here as well as
// by the tool, so this suite cannot pass on a record that silently lost the check.
for (const [id, c] of Object.entries(rec.cells)) assert.ok(c.childCount > 0, id + ' rendered empty');

const total = Object.values(rec.cells).reduce((n, c) => n + (c.n || 0), 0);
const slowest = [...rec.timings].sort((a, b) => b.ms - a.ms)[0];
console.log('PASS fingerprint smoke: ' + cells.length + ' cells (ar/en × dark/light × 375/412 × ' + VIEWS.length + ' views), ' + total + ' elements, no page error, no empty view, no raw key, no empty icon, no slow or hung render; slowest ' + slowest.cell.split('/').slice(1).join('/') + ' ' + slowest.ms + 'ms; 0 requests escaped');
