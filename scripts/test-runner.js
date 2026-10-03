#!/usr/bin/env node
/**
 * test-runner — proves scripts/test-all.js itself, over FAKE suites.
 *
 * The runner is the one check every other check depends on, and nothing tested
 * it: the "silent exit 0 is a FAIL" rule, the module/delegated classification,
 * and (since 2026-10-03) the pool — node suites first, N browser suites at a
 * time, HEAVY first, EXCLUSIVE alone, a failed browser suite retried once alone
 * and NAMED when it passes there. A pool that lost a suite, retried a skip, or
 * swallowed a load-sensitive failure would print a green summary; this file is
 * what makes those lies fail.
 *
 * How: a fresh temp directory of fake suites per run (node fakes, browser fakes
 * that hold for a few hundred ms, a library, a delegated file, a flaky one that
 * fails its first run and passes its second), `TEST_ALL_DIR` pointing the runner
 * at it, and every fake writing `log/<name>.<pid>.json` = {start, end}. Order,
 * overlap and "alone" are computed from those intervals, never from shared
 * files. Each assertion below was seen to FAIL on a planted defect in a scratch
 * copy of test-all.js (`TEST_RUNNER_UNDER_TEST=<copy>`), so the real file is
 * never edited to prove it. HEAVY / EXCLUSIVE are read from the runner, never
 * copied. The three strings test-all.js classifies files by are spelled in
 * pieces here, so this file is never mistaken for a library or a browser suite.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RUNNER = process.env.TEST_RUNNER_UNDER_TEST
  ? path.resolve(process.env.TEST_RUNNER_UNDER_TEST)
  : path.join(__dirname, 'test-all.js');
const { HEAVY, EXCLUSIVE } = require(RUNNER);

// Spelled in pieces — see the header.
const PW = "require('play" + "wright')";
const EXPORTS = 'module' + '.exports = ';
const GUARD = 'if (require' + '.main === module) ';
const SIBLING = (name) => "require('./" + name + "')";
const NO_PW = "Error: Cannot find module 'play" + "wright'";

// ── fakes ──────────────────────────────────────────────────────────────────
function fake({ browser = false, hold = 0, mode = 'pass', label = '' }) {
  return [
    browser ? `if (process.env.NEVER_SET) ${PW};` : '',
    "const fs = require('fs'), path = require('path');",
    'const start = Date.now();',
    'setTimeout(() => {',
    '  const name = path.basename(__filename);',
    "  fs.writeFileSync(path.join(__dirname, 'log', name + '.' + process.pid + '.json'), JSON.stringify({ name, start, end: Date.now() }));",
    mode === 'pass' ? `  console.log('PASS ${label}');` : '',
    mode === 'fail' ? "  console.error('planted node failure'); process.exit(1);" : '',
    mode === 'skip' ? `  console.error(${JSON.stringify(NO_PW)}); process.exit(1);` : '',
    mode === 'flaky' ? [
      "  const marker = path.join(__dirname, 'flaky.ran');",
      "  if (!fs.existsSync(marker)) { fs.writeFileSync(marker, '1'); console.error('the case that needs the machine to itself'); process.exit(1); }",
      "  console.log('PASS flaky');",
    ].join('\n') : '',
    `}, ${hold});`,
  ].filter(Boolean).join('\n') + '\n';
}

function fixture(kind) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-runner-'));
  fs.mkdirSync(path.join(dir, 'log'));
  const w = (f, s) => fs.writeFileSync(path.join(dir, f), s);
  if (kind === 'steady') {
    w('test-a-pass.js', fake({ label: 'a' }));
    w('test-b-fail.js', fake({ mode: 'fail' }));
    w('test-c-silent.js', fake({ mode: 'silent' }));
    w('test-d-skip.js', fake({ browser: true, mode: 'skip' }));
    w('test-e-lib.js', `${EXPORTS}{ lib: true };\n`);
    w('test-f-both.js', `${EXPORTS}{ both: true };\n${GUARD}console.log('PASS both');\n`);
    w('test-g-caller.js', `// a comment that mentions test-a-pass.js\n${SIBLING('test-h-delegated')};\nconsole.log('PASS caller');\n`);
    w('test-h-delegated.js', "console.log('delegated ran');\n");
    w('test-0a-browser.js', fake({ browser: true, hold: 250, label: '0a' }));
    w('test-0b-browser.js', fake({ browser: true, hold: 250, label: '0b' }));
    w('test-0c-browser.js', fake({ browser: true, hold: 250, label: '0c' }));
    w(HEAVY[0], fake({ browser: true, hold: 600, label: 'heavy0' }));
    w(HEAVY[1], fake({ browser: true, hold: 400, label: 'heavy1' }));
    w(EXCLUSIVE[0], fake({ browser: true, hold: 150, label: 'exclusive0' }));
    w('test-s-browser-fail.js', fake({ browser: true, mode: 'fail' }));
    w('test-t-browser-silent.js', fake({ browser: true, mode: 'silent' }));
  } else if (kind === 'flaky') {
    w('test-a-pass.js', fake({ label: 'a' }));
    w('test-0a-browser.js', fake({ browser: true, hold: 300, label: '0a' }));
    w('test-y-flaky.js', fake({ browser: true, hold: 100, mode: 'flaky' }));
  } else if (kind === 'strict') {
    w('test-a-pass.js', fake({ label: 'a' }));
    w('test-d-skip.js', fake({ browser: true, mode: 'skip' }));
  }
  return dir;
}

// ── one run of the runner under test ───────────────────────────────────────
function runAll(kind, args, env = {}) {
  const dir = fixture(kind);
  try {
    const e = { ...process.env };
    delete e.TEST_JOBS; delete e.TEST_ALL_DIR; delete e.NODE_PATH;   // an outer `npm test` must not leak in
    const r = spawnSync(process.execPath, [RUNNER, ...args], {
      encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...e, TEST_ALL_DIR: dir, ...env },
    });
    const intervals = fs.readdirSync(path.join(dir, 'log'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, 'log', f), 'utf8')))
      .sort((a, b) => a.start - b.start);
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', out: (r.stdout || '') + (r.stderr || ''), intervals };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Final verdict per suite: the LAST PASS/FAIL/SKIP line that names it (a retry replaces the pool's).
function verdicts(out) {
  const m = new Map();
  for (const line of out.split('\n')) {
    const hit = /^ {2}(PASS|FAIL|SKIP) {2}(test-[\w-]+\.js)\s/.exec(line);
    if (hit) m.set(hit[2], hit[1]);
  }
  return m;
}
const overlaps = (a, b) => a.start < b.end && b.start < a.end;
// The most suites running at ONE instant (a sweep over starts and ends — an end
// sorts before a start at the same millisecond). Not "how many touched the
// longest one": a 600 ms suite is touched by five that never ran together.
function maxOverlap(ivs) {
  const events = [];
  for (const i of ivs) { events.push([i.start, 1]); events.push([i.end, -1]); }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0, best = 0;
  for (const [, d] of events) { now += d; best = Math.max(best, now); }
  return best;
}
const of = (ivs, name) => ivs.filter((i) => i.name === name);
const BROWSER_FAKES = new Set(['test-0a-browser.js', 'test-0b-browser.js', 'test-0c-browser.js', HEAVY[0], HEAVY[1], EXCLUSIVE[0], 'test-d-skip.js', 'test-s-browser-fail.js', 'test-t-browser-silent.js']);

// ── the runs ───────────────────────────────────────────────────────────────
const S1 = runAll('steady', ['--jobs', '1']);
const S3 = runAll('steady', ['--jobs', '3']);
const S4 = runAll('steady', [], { TEST_JOBS: '4' });
const S41 = runAll('steady', ['--jobs', '1'], { TEST_JOBS: '4' });
const F3 = runAll('flaky', ['--jobs', '3']);
const FN = runAll('flaky', ['--jobs', '3', '--no-retry']);
const T0 = runAll('strict', ['--jobs', '3']);
const TS = runAll('strict', ['--strict', '--jobs', '3']);
const TS1 = runAll('strict', ['--strict', '--jobs', '1']);
const Z = runAll('strict', ['--jobs', '0']);
const A = runAll('strict', [], { TEST_JOBS: 'abc' });
const RUNS = 11;

// ── the assertions ─────────────────────────────────────────────────────────
const failures = [];
let n = 0;
function check(id, what, fn) {
  n++;
  try { fn(); console.log(`  ok    ${id.padEnd(4)} ${what}`); } catch (e) {
    failures.push(id);
    console.log(`  FAIL  ${id.padEnd(4)} ${what}\n        ${String(e.message).split('\n').join('\n        ')}`);
  }
}
const has = (out, re, msg) => assert.match(out, re, msg || `expected ${re}`);
const hasNot = (out, re, msg) => assert.doesNotMatch(out, re, msg || `did not expect ${re}`);
const block = (out, head) => {
  const i = out.indexOf(head);
  assert.ok(i >= 0, `no block ${JSON.stringify(head)}`);
  const rest = out.slice(i + head.length);
  const j = rest.indexOf('\n-----');
  return j >= 0 ? rest.slice(0, j) : rest;
};

check('R1', 'a library (exports, no main guard) is listed, never run', () => {
  has(S1.out, /^ {2}1 module\(s\), required by a suite rather than run: test-e-lib\.js$/m);
  hasNot(S1.out, /^ {2}(PASS|FAIL|SKIP) {2}test-e-lib\.js/m);
});
check('R2', 'exports AND a main guard = a suite that runs', () => {
  has(S1.out, /^ {2}PASS {2}test-f-both\.js\s+\d+ms {2}PASS both$/m);
});
check('R3', 'a require() CALL delegates; a mention in a comment does not', () => {
  has(S1.out, /^ {2}1 suite\(s\) run by another suite, not directly: test-h-delegated\.js$/m);
  hasNot(S1.out, /^ {2}(PASS|FAIL|SKIP) {2}test-h-delegated\.js/m);
  has(S1.out, /^ {2}PASS {2}test-a-pass\.js\s/m, 'the mentioned suite still runs');
});
check('R4', 'the verdict lines and the counts line, character for character', () => {
  for (const r of [S1, S3]) {
    has(r.out, /^ {2}PASS {2}test-a-pass\.js\s+\d+ms {2}PASS a$/m);
    has(r.out, /^ {2}9 passed · 4 failed · 1 skipped$/m);
  }
});
check('R5', 'exit 0 with no output is a FAIL named as such', () => {
  has(S1.out, /^ {2}FAIL {2}test-c-silent\.js\s+\d+ms {2}silent exit 0 — nothing ran$/m);
  assert.match(block(S1.out, '----- test-c-silent.js -----'), /exited 0 but printed nothing/);
  assert.equal(verdicts(S1.out).get('test-c-silent.js'), 'FAIL');
});
check('R6', 'a failure block carries the suite\'s stderr', () => {
  assert.match(block(S1.out, '----- test-b-fail.js -----'), /planted node failure/);
});
check('R7', 'a missing runtime is a SKIP: exit 0 without --strict, and named as NOT passing', () => {
  assert.equal(T0.status, 0, T0.out);
  has(T0.out, /^ {2}SKIP {2}test-d-skip\.js\s+\d+ms {2}needs an external browser runtime \(playwright\)$/m);
  has(T0.out, /^ {2}NOT RUN, so NOT passing: test-d-skip\.js$/m);
});
check('R8', '--strict makes the skip fatal, in the pool and in --jobs 1', () => {
  for (const r of [TS, TS1]) {
    assert.equal(r.status, 1, r.out);
    has(r.out, /^ {2}--strict: a skipped suite is a failure here\.$/m);
  }
});
check('R9', 'a failed suite fails the run (both modes)', () => {
  assert.equal(S1.status, 1); assert.equal(S3.status, 1);
});
check('R10', '--jobs 1 runs in alphabetical order, node and browser mixed', () => {
  const alphabetical = ['test-0a-browser.js', 'test-0b-browser.js', 'test-0c-browser.js', 'test-a-pass.js', 'test-b-fail.js', 'test-c-silent.js',
    HEAVY[1], 'test-d-skip.js', 'test-f-both.js', 'test-g-caller.js', 'test-s-browser-fail.js', EXCLUSIVE[0], HEAVY[0], 'test-t-browser-silent.js'].sort();
  const logged = new Set(S1.intervals.map((i) => i.name));
  assert.deepEqual(S1.intervals.map((i) => i.name), alphabetical.filter((f) => logged.has(f)));
});
check('R11', '--jobs 1 is the old runner: one at a time, no retry, no pool header', () => {
  assert.equal(maxOverlap(S1.intervals), 1);
  hasNot(S1.out, /RETRY/); hasNot(S1.out, /node suite\(s\) one at a time/);
});
check('R12', 'the final verdict per suite is identical for --jobs 1 and --jobs 3', () => {
  assert.deepEqual([...verdicts(S3.out)].sort(), [...verdicts(S1.out)].sort());
  assert.equal(verdicts(S3.out).size, 14);
  hasNot(S3.out, /RUNNER BUG/);
});
check('R13', 'pooled: every node suite ends before the first browser suite starts', () => {
  const node = S3.intervals.filter((i) => !BROWSER_FAKES.has(i.name));
  const browser = S3.intervals.filter((i) => BROWSER_FAKES.has(i.name));
  assert.ok(node.length >= 3 && browser.length >= 6, `node ${node.length}, browser ${browser.length}`);
  assert.ok(Math.max(...node.map((i) => i.end)) <= Math.min(...browser.map((i) => i.start)), 'a browser suite started before the node suites ended');
});
check('R14', 'pooled: exactly 3 browser suites at a time', () => {
  assert.equal(maxOverlap(S3.intervals), 3);
});
check('R15', 'TEST_JOBS sets the pool; the --jobs flag beats it', () => {
  assert.equal(maxOverlap(S4.intervals), 4, 'TEST_JOBS=4');
  has(S4.out, /^ {2}wall [\d.]+ s, --jobs 4$/m);
  assert.equal(maxOverlap(S41.intervals), 1, 'TEST_JOBS=4 --jobs 1');
  has(S41.out, /^ {2}wall [\d.]+ s, --jobs 1$/m);
});
check('R16', 'HEAVY suites start first, then the rest alphabetically', () => {
  const firstThree = S3.intervals.filter((i) => BROWSER_FAKES.has(i.name)).slice(0, 3).map((i) => i.name).sort();
  assert.deepEqual(firstThree, [HEAVY[0], HEAVY[1], 'test-0a-browser.js'].sort());
});
check('R17', 'an EXCLUSIVE suite overlaps nothing and starts after the pool', () => {
  const ex = of(S3.intervals, EXCLUSIVE[0]);
  assert.equal(ex.length, 1);
  for (const i of S3.intervals) if (i !== ex[0]) assert.ok(!overlaps(i, ex[0]), `${i.name} overlapped ${EXCLUSIVE[0]}`);
  for (const name of [HEAVY[0], HEAVY[1], 'test-0a-browser.js', 'test-0b-browser.js', 'test-0c-browser.js']) {
    assert.ok(of(S3.intervals, name)[0].end <= ex[0].start, `${name} was still running when ${EXCLUSIVE[0]} started`);
  }
});
check('R18', 'a suite that fails beside others AND alone stays FAIL and says so', () => {
  has(S3.out, /^ {2}RETRY test-s-browser-fail\.js\s+failed beside other suites — once more, alone$/m);
  assert.equal(verdicts(S3.out).get('test-s-browser-fail.js'), 'FAIL');
  has(S3.out, /^----- test-s-browser-fail\.js — failed beside others AND alone -----$/m);
  hasNot(S3.out, /PASSED ONLY ALONE/);
  assert.equal(of(S3.intervals, 'test-s-browser-fail.js').length, 2, 'it ran exactly twice');
});
check('R19', 'a suite that passes only alone is green AND named, with the pooled failure printed', () => {
  assert.equal(F3.status, 0, F3.out);
  has(F3.out, /^ {2}RETRY test-y-flaky\.js\s/m);
  has(F3.out, /^ {2}3 passed · 0 failed · 0 skipped$/m);
  has(F3.out, /^ {2}PASSED ONLY ALONE — load-sensitive; see the case above: test-y-flaky\.js$/m);
  assert.match(block(F3.out, '----- test-y-flaky.js — FAILED beside other suites (below), passed alone -----'), /the case that needs the machine to itself/);
  assert.equal(verdicts(F3.out).get('test-y-flaky.js'), 'PASS');
});
check('R20', 'the lonely retry really runs alone', () => {
  const runs = of(F3.intervals, 'test-y-flaky.js');
  assert.equal(runs.length, 2);
  const second = runs[1];
  for (const i of F3.intervals) if (i !== second) assert.ok(!overlaps(i, second), `${i.name} overlapped the retry`);
});
check('R21', '--no-retry keeps the first verdict', () => {
  hasNot(FN.out, /RETRY/);
  assert.equal(FN.status, 1);
  assert.equal(verdicts(FN.out).get('test-y-flaky.js'), 'FAIL');
  assert.equal(of(FN.intervals, 'test-y-flaky.js').length, 1);
});
check('R22', 'a SKIP and a silent exit are never retried', () => {
  hasNot(S3.out, /RETRY test-d-skip\.js/); hasNot(S3.out, /RETRY test-t-browser-silent\.js/);
  assert.equal(of(S3.intervals, 'test-t-browser-silent.js').length, 1);
});
check('R23', 'a pool of zero or a non-number is refused (exit 2), running nothing', () => {
  for (const r of [Z, A]) {
    assert.equal(r.status, 2, r.out);
    has(r.stderr, /--jobs/);
    assert.equal(r.intervals.length, 0, 'a suite ran');
    hasNot(r.out, /passed ·/);
  }
});
check('R24', 'TEST_ALL_DIR is announced', () => {
  has(S1.out, /^ {2}TEST_ALL_DIR: running the suites in .*, NOT scripts\/$/m);
});

if (failures.length) {
  console.log(`\nFAIL test runner: ${failures.length} of ${n} assertions failed (${failures.join(', ')}) — runner under test: ${RUNNER}`);
  process.exit(1);
}
console.log(`PASS test runner: ${n} assertions over ${RUNS} runs of test-all.js on fake suites — pool, HEAVY/EXCLUSIVE order, lonely retry, classification, exit codes`);
