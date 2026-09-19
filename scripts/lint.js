#!/usr/bin/env node
/**
 * Run the linter — and say so, loudly, when it could not run.
 *
 * ESLint is deliberately NOT in package.json (see eslint.config.js): it is
 * installed with `npm i --no-save playwright eslint@9 globals` — ONE command for
 * everything outside the manifest, because an --no-save install PRUNES whatever
 * the manifest does not list, and a second one for eslint silently removed
 * playwright. So a fresh clone does not have it.
 * The one thing this wrapper must never do is exit 0 in that case and let the
 * absence read as a pass. That is the shape this project has been burned by
 * three times (the reporter into a missing table, the cap that could never be
 * true, the budget dead for nine days): a guard that is not running looks
 * exactly like a guard that found nothing.
 *
 * So: absent locally → a loud SKIP line and exit 0, because a developer without
 * the tool should still be able to run `npm run verify`; absent under --strict
 * (what CI passes) → a FAILURE, because CI installed it one step earlier and an
 * absence there means the install step lied.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

let bin;
try {
  // eslint's package.json "exports" map hides bin/ from require.resolve; the
  // package.json itself is exported, so locate the bin relative to that.
  bin = path.join(path.dirname(require.resolve('eslint/package.json', { paths: [ROOT] })), 'bin', 'eslint.js');
} catch (_) {
  const line = 'lint: SKIPPED — eslint is not installed. Install it without touching package.json:  npm i --no-save playwright eslint@9 globals';
  if (STRICT) { console.error('FAIL  ' + line + '  (--strict: an absent linter is a failure)'); process.exit(1); }
  console.log('SKIP  ' + line);
  process.exit(0);
}

const r = spawnSync(process.execPath, [bin, '.', '--max-warnings=0'], { cwd: ROOT, stdio: 'inherit' });
if (r.status === 0) console.log('PASS  lint: the ' + require('./shipped.js').JS.length + ' shipped scripts, the tooling and the Worker are clean under eslint.config.js');
process.exit(r.status === null ? 1 : r.status);
