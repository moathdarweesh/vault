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
 *
 * ONE VERDICT AT TWO SPEEDS (2026-10-03). The browser suites took ~560 s one
 * after another, though each starts its own server on port 0 and its own Chrome
 * — they share nothing that could let one pass for another. So:
 *   --jobs 1   this runner exactly as it was: every suite, alphabetically, alone.
 *   --jobs N   the node suites first, one at a time (~2 s: a broken one is on
 *              screen before any browser starts); then the browser suites N at a
 *              time, longest first (HEAVY); then the EXCLUSIVE ones, alone.
 *              Default min(3, cores − 1); $TEST_JOBS sets it too, the flag wins.
 *   A browser suite that FAILS beside others runs ONCE more, alone. The second
 *   verdict is the verdict — and a pass there is NAMED in the summary, with the
 *   failure it printed beside the others: load-sensitivity is surfaced, never
 *   absorbed. --no-retry keeps the first verdict. --strict is unchanged.
 *   TEST_ALL_DIR points the runner at another directory of suites; only
 *   scripts/test-runner.js uses it, to prove this file over fakes.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TIMEOUT_MS = 300000;

// LONGEST FIRST — seconds each suite took ALONE (a `--jobs 1` run on the owner's
// laptop, 2026-10-03). The pool starts these before the rest so the longest suite
// never starts last and finishes alone. Update it when a `--jobs 1` run shows a
// suite past ~15 s that is not here, or two of these swap places. A stale order
// costs time, never a verdict: a suite not named here still runs, after these,
// alphabetically; a name here that is not a runnable suite is ignored.
const HEAVY = [
  'test-sync-status-ui.js',    // 181 s — hosts every test-convenience-ui.js case
  'test-cardio-sleep-ui.js',   // 126 s
  'test-ai-retry-ui.js',       //  62 s
  'test-program-ui.js',        //  60 s
  'test-fingerprint.js',       //  47 s
  'test-run-home-ui.js',       //  21 s
  'test-food-quick-ui.js',     //  18 s
];

// ALONE, AFTER THE POOL — a suite whose ASSERTION is a timing. test-startup.js
// benchmarks the former serial body placement against the current one under a
// 4x CPU throttle and asserts the parallel median reaches Home first; another
// Chrome stealing cores mid-round makes that a coin toss. A suite goes here only
// with its reason. One that merely got slower under load belongs in the lonely
// retry's report — and then in a fix.
const EXCLUSIVE = ['test-startup.js'];

const missingRuntime = (out) => /Cannot find module '(playwright|puppeteer)'/.test(out);

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
function classify(dir) {
  const files = fs.readdirSync(dir)
    .filter((f) => /^test-.*\.js$/.test(f) && f !== 'test-all.js')
    .sort();
  const modules = new Set(), invoked = new Set(), selfRunning = new Set(), browser = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const exportsSomething = /^\s*module\.exports\s*=/m.test(src);
    const runsItself = /require\.main\s*===\s*module/.test(src);
    if (runsItself) selfRunning.add(f);
    if (exportsSomething && !runsItself) modules.add(f);
    for (const m of src.matchAll(/require\(\s*['"]\.\/(test-[\w-]+)['"]\s*\)/g)) invoked.add(m[1] + '.js');
    // BROWSER = it loads Playwright: a call whose one argument is the string
    // 'playwright' — require(…), or test-admin-console.js's createRequire'd
    // req(…). The class decides WHEN a suite runs, never whether it counts.
    if (/\(\s*['"]playwright['"]\s*\)/.test(src)) browser.add(f);
  }
  const libs = files.filter((f) => modules.has(f));
  // Required by a sibling AND self-running means it is both a library and a
  // suite — run it. Only a file that cannot run itself is left to its caller.
  const delegated = files.filter((f) => !modules.has(f) && invoked.has(f) && !selfRunning.has(f));
  const runnable = files.filter((f) => !modules.has(f) && !delegated.includes(f));
  return { libs, delegated, runnable, browser };
}

// `--jobs N` / `--jobs=N` beats $TEST_JOBS beats min(3, cores − 1). Returns null
// (after saying why) for anything that is not a whole number of 1 or more: a
// pool of zero workers runs nothing and would print "0 failed" — the lie this
// file exists to stop.
function jobsFrom(args) {
  const at = args.findIndex((a) => a === '--jobs' || a.startsWith('--jobs='));
  const raw = at >= 0 ? (args[at].includes('=') ? args[at].slice('--jobs='.length) : args[at + 1]) : process.env.TEST_JOBS;
  if (at < 0 && (raw === undefined || raw === '')) {
    const cores = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
    return Math.max(1, Math.min(3, cores - 1));
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`test-all: --jobs / TEST_JOBS wants a whole number of 1 or more, not ${JSON.stringify(raw === undefined ? null : raw)}`);
    return null;
  }
  return n;
}

// One suite, to completion. It always RESOLVES — a failure is a verdict, not an
// exception. Same timeout and buffer as the execFileSync this replaced: the
// verdict must not change with the mode.
function runSuite(dir, f) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(dir, f)], {
      cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024, windowsHide: true,
    }, (err, stdout, stderr) => {
      const ms = Date.now() - t0;
      // What execFileSync gave, unchanged: stdout alone on success, stdout + stderr on failure.
      if (!err) resolve({ f, ms, ok: true, out: String(stdout || '') });
      else resolve({ f, ms, ok: false, out: String(stdout || '') + String(stderr || ''), timedOut: Boolean(err.killed) });
    });
  });
}

// The four verdicts, word for word what this runner has always printed.
const cols = (f, ms) => `${f.padEnd(30)} ${String(ms).padStart(6)}ms`;
function judge(r) {
  if (r.ok && !r.out.trim()) {
    // Exited 0 and said nothing. Every real suite here ends with a PASS line, so
    // silence means it did not execute — a module, a guard that returned early,
    // or a harness that no-opped. Silence is never a pass.
    return { ...r, kind: 'fail', silent: true, out: '(exited 0 but printed nothing — it did not actually run)',
      line: `  FAIL  ${cols(r.f, r.ms)}  silent exit 0 — nothing ran` };
  }
  if (r.ok) {
    const last = r.out.trim().split('\n').filter(Boolean).pop() || '';
    return { ...r, kind: 'pass', line: `  PASS  ${cols(r.f, r.ms)}  ${last.slice(0, 72)}` };
  }
  if (missingRuntime(r.out)) return { ...r, kind: 'skip', line: `  SKIP  ${cols(r.f, r.ms)}  needs an external browser runtime (playwright)` };
  return { ...r, kind: 'fail', line: `  FAIL  ${cols(r.f, r.ms)}` + (r.timedOut ? `  timed out after ${TIMEOUT_MS / 1000} s` : '') };
}

// N workers draining one queue. JavaScript runs one callback at a time, so
// shift() is the whole of the locking: no two workers can take the same suite.
async function pool(queue, jobs, work) {
  const left = queue.slice();
  const worker = async () => { while (left.length) await work(left.shift()); };
  await Promise.all(Array.from({ length: Math.min(jobs, left.length) }, worker));
}

async function main() {
  const args = process.argv.slice(2);
  const STRICT = args.includes('--strict');
  const RETRY = !args.includes('--no-retry');
  const JOBS = jobsFrom(args);
  if (JOBS === null) { process.exitCode = 2; return; }
  const DIR = process.env.TEST_ALL_DIR ? path.resolve(process.env.TEST_ALL_DIR) : __dirname;
  if (DIR !== __dirname) console.log(`  TEST_ALL_DIR: running the suites in ${DIR}, NOT scripts/\n`);
  const { libs, delegated, runnable, browser } = classify(DIR);
  const t0 = Date.now();
  const verdicts = new Map();   // file → its LATEST verdict (a retry replaces the pool's)
  const lonely = [];            // { f, out }: failed beside others, passed alone
  const run = async (f) => {
    const v = judge(await runSuite(DIR, f));
    verdicts.set(f, v);
    console.log(v.line);
    return v;
  };

  if (JOBS === 1) {
    // Today's runner, exactly: alphabetical, one at a time. Nothing is retried —
    // every suite already ran alone.
    for (const f of runnable) await run(f);
  } else {
    const alone = runnable.filter((f) => EXCLUSIVE.includes(f));
    const node = runnable.filter((f) => !browser.has(f) && !alone.includes(f));
    const pooled = runnable.filter((f) => browser.has(f) && !alone.includes(f));
    const queue = [...HEAVY.filter((f) => pooled.includes(f)), ...pooled.filter((f) => !HEAVY.includes(f))];
    console.log(`  ${node.length} node suite(s) one at a time, then ${queue.length} browser suite(s) ${JOBS} at a time, longest first` +
      (alone.length ? `, then ${alone.join(', ')} alone` : '') +
      (RETRY ? '; a browser suite that fails beside others runs once more, alone' : '') + '\n');
    for (const f of node) await run(f);
    await pool(queue, JOBS, run);
    for (const f of alone) await run(f);
    if (RETRY) {
      // A skip is not a failure, and a silent exit is structural (nothing ran),
      // never load: neither is retried.
      const again = queue.filter((f) => verdicts.get(f).kind === 'fail' && !verdicts.get(f).silent).sort();
      for (const f of again) {
        const first = verdicts.get(f);
        console.log(`  RETRY ${f.padEnd(30)} failed beside other suites — once more, alone`);
        const second = await run(f);
        if (second.kind === 'pass') lonely.push({ f, out: first.out });
        else second.retried = true;
      }
    }
  }

  // The pool's own honesty: every runnable suite has a verdict, or the runner is broken.
  const lost = runnable.filter((f) => !verdicts.has(f));
  const all = runnable.filter((f) => verdicts.has(f)).map((f) => verdicts.get(f));   // alphabetical, as before
  const pass = all.filter((v) => v.kind === 'pass');
  const fail = all.filter((v) => v.kind === 'fail');
  const skip = all.filter((v) => v.kind === 'skip').map((v) => v.f);
  const tail = (out) => out.trim().split('\n').slice(-24).join('\n');

  for (const v of fail) {
    console.log(`\n----- ${v.f}${v.retried ? ' — failed beside others AND alone' : ''} -----`);
    console.log(tail(v.out));
  }
  for (const { f, out } of lonely) {
    console.log(`\n----- ${f} — FAILED beside other suites (below), passed alone -----`);
    console.log(tail(out));
  }

  console.log('');
  if (lost.length) console.log(`  RUNNER BUG — never run, so NOT passing: ${lost.join(', ')}`);
  if (libs.length) console.log(`  ${libs.length} module(s), required by a suite rather than run: ${libs.join(', ')}`);
  if (delegated.length) console.log(`  ${delegated.length} suite(s) run by another suite, not directly: ${delegated.join(', ')}`);
  console.log(`  ${pass.length} passed · ${fail.length} failed · ${skip.length} skipped`);
  if (lonely.length) {
    console.log(`  PASSED ONLY ALONE — load-sensitive; see the case above: ${lonely.map((l) => l.f).join(', ')}`);
    console.log('  (green because alone it passes; not fine — fix the case, or name the suite in EXCLUSIVE with its reason)');
  }
  if (skip.length) {
    console.log(`  NOT RUN, so NOT passing: ${skip.join(', ')}`);
    console.log('  (CI installs the runtime so these run there; locally, "npm i --no-save playwright")');
  }
  console.log(`  wall ${((Date.now() - t0) / 1000).toFixed(1)} s, --jobs ${JOBS}`);
  if (fail.length || lost.length) { process.exitCode = 1; return; }
  if (skip.length && STRICT) { console.log('\n  --strict: a skipped suite is a failure here.'); process.exitCode = 1; }
}

// Read by scripts/test-runner.js: the order is read from here, never copied.
// Everything that touches the disk or argv runs inside main(), so requiring this
// file has no side effect.
module.exports = { HEAVY, EXCLUSIVE };
if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });
