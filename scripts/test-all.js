#!/usr/bin/env node
/**
 * Run every scripts/test-*.js and report honestly.
 *
 * WHY THIS EXISTS: twice in one release range the claim "all five suites pass"
 * was WRONG, and both times for the same reason — a suite that needs an external
 * Playwright runtime **throws MODULE_NOT_FOUND and is easy to read as noise**, so
 * a break inside it went unnoticed. v316 broke `[data-my-meals]`; v322 broke
 * `[data-quantity]`. Neither was caught until a review read the diff.
 *
 * So the rule here is: a suite that did not RUN is never counted as passing, and
 * the summary line names it and says why. A skip is louder than a pass.
 *
 * Exit code: 0 only if every suite that ran passed AND nothing was skipped for a
 * reason CI should have solved (--strict makes any skip fatal; CI passes it).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const files = fs.readdirSync(__dirname)
  .filter((f) => /^test-.*\.js$/.test(f) && f !== 'test-all.js')
  .sort();

// Classify before running anything. Two kinds of file are NOT suites:
//   MODULE     — it EXPORTS and has no `require.main === module` guard, so it is
//                a library another suite requires. Running it directly does
//                nothing and exits 0, which my own first draft reported as a
//                PASS — the exact lie this runner exists to stop.
//   DELEGATED  — actually required by another suite (a require() CALL, not a
//                mention in a comment; the first draft read line 1 of
//                test-convenience-ui.js and marked its CALLER as delegated).
//
// ⚠️ Exporting is NOT enough on its own. test-sync-status.js does BOTH — it
// exports `context` for its UI sibling AND runs its own suite behind a main
// guard — and a rule that looked only for `module.exports` silently dropped a
// passing suite from the run.
const modules = new Set(), invoked = new Set(), selfRunning = new Set();
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const exportsSomething = /^\s*module\.exports\s*=/m.test(src);
  const runsItself = /require\.main\s*===\s*module/.test(src);
  if (runsItself) selfRunning.add(f);
  if (exportsSomething && !runsItself) modules.add(f);
  for (const m of src.matchAll(/require\(\s*['"]\.\/(test-[\w-]+)['"]\s*\)/g)) invoked.add(m[1] + '.js');
}

const missingRuntime = (out) => /Cannot find module '(playwright|puppeteer)'/.test(out);

const pass = [], fail = [], skip = [], delegated = [], libs = [];
for (const f of files) {
  if (modules.has(f)) { libs.push(f); continue; }
  // Required by a sibling AND self-running means it is both a library and a
  // suite — run it. Only a file that cannot run itself is left to its caller.
  if (invoked.has(f) && !selfRunning.has(f)) { delegated.push(f); continue; }
  const t0 = Date.now();
  let out = '', ok = false;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, f)], {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 300000,
    });
    ok = true;
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }
  const ms = Date.now() - t0;
  if (ok && !out.trim()) {
    // Exited 0 and said nothing. Every real suite here ends with a PASS line, so
    // silence means it did not execute — a module, a guard that returned early,
    // or a harness that no-opped. Silence is never a pass.
    fail.push({ f, out: '(exited 0 but printed nothing — it did not actually run)' });
    console.log(`  FAIL  ${f.padEnd(30)} ${String(ms).padStart(6)}ms  silent exit 0 — nothing ran`);
  } else if (ok) {
    pass.push(f);
    const last = out.trim().split('\n').filter(Boolean).pop() || '';
    console.log(`  PASS  ${f.padEnd(30)} ${String(ms).padStart(6)}ms  ${last.slice(0, 72)}`);
  } else if (missingRuntime(out)) {
    skip.push(f);
    console.log(`  SKIP  ${f.padEnd(30)} ${String(ms).padStart(6)}ms  needs an external browser runtime (playwright)`);
  } else {
    fail.push({ f, out });
    console.log(`  FAIL  ${f.padEnd(30)} ${String(ms).padStart(6)}ms`);
  }
}

for (const { f, out } of fail) {
  console.log(`\n----- ${f} -----`);
  console.log(out.trim().split('\n').slice(-24).join('\n'));
}

console.log('');
if (libs.length) console.log(`  ${libs.length} module(s), required by a suite rather than run: ${libs.join(', ')}`);
if (delegated.length) console.log(`  ${delegated.length} suite(s) run by another suite, not directly: ${delegated.join(', ')}`);
console.log(`  ${pass.length} passed · ${fail.length} failed · ${skip.length} skipped`);
if (skip.length) {
  console.log(`  NOT RUN, so NOT passing: ${skip.join(', ')}`);
  console.log('  (CI installs the runtime so these run there; locally, "npm i --no-save playwright")');
}
if (fail.length) process.exit(1);
if (skip.length && STRICT) { console.log('\n  --strict: a skipped suite is a failure here.'); process.exit(1); }
