#!/usr/bin/env node
/**
 * Bump every cache-busting marker in one shot.
 *
 *   npm run release          -> current build + 1
 *   npm run release 200      -> set an explicit build number
 *   npm run release --check  -> verify only, change nothing (used by the git hook)
 *
 * WHY THIS EXISTS
 * The version lives in 12 places across 4 files. Miss one and the release fails
 * SILENTLY in one of two directions (CLAUDE.md "CACHE WORKFLOW"):
 *   - version.json.web left behind  -> js/update.js never reloads devices, so a
 *     shipped fix degrades to "whenever the 10-minute GitHub Pages cache expires".
 *   - version.json.web set ahead    -> every device reloads once per launch until
 *     the deployed ?v=N catches up (guarded, not a brick, but it is a tax on
 *     every user, every launch).
 *
 * Plain Node, zero dependencies, no build step: this only rewrites source files
 * in place, so the repo stays byte-for-byte servable by GitHub Pages.
 *
 * IMPORTANT — regexes are ANCHORED. A bare /v\d+/ scan matches SVG path data
 * (`<path d="M4 9v6"/>` appears in index.html and hundreds of times in the ICONS
 * table in app.js), so a naive verifier would fail on every single run.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const p = (f) => path.join(ROOT, f);

// [file, regex, how to rebuild the matched text with the new number]
const MARKERS = [
  ['index.html',  /\?v=(\d+)/g,                 (n) => `?v=${n}`],
  ['index.html',  /__cleaned_v(\d+)/g,          (n) => `__cleaned_v${n}`],
  // app.js derives VAULT_BUILD from its own ?v=N at runtime; this literal is the
  // fallback (file://, stripped query) and must still track the release.
  ['js/app.js',   /const FALLBACK = 'v(\d+)'/g, (n) => `const FALLBACK = 'v${n}'`],
  ['version.json', /"web":\s*(\d+)/g,           (n) => `"web": ${n}`],
];

function read(f) { return fs.readFileSync(p(f), 'utf8'); }

/** Every marker's current number, per file. */
function scan() {
  const found = [];
  for (const [file, re] of MARKERS) {
    const src = read(file);
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(src)) !== null) found.push({ file, value: Number(m[1]), text: m[0] });
  }
  return found;
}

function currentBuild() {
  const m = read('js/app.js').match(/const FALLBACK = 'v(\d+)'/);
  if (!m) throw new Error("Could not find the VAULT_BUILD fallback literal in js/app.js");
  return Number(m[1]);
}

/** True when every marker agrees. Prints the disagreement when it doesn't. */
function check(expected) {
  const found = scan();
  if (!found.length) { console.error('release: no markers found — the regexes are stale.'); return false; }
  const target = expected != null ? expected : found[0].value;
  const bad = found.filter((f) => f.value !== target);
  const counts = found.reduce((a, f) => (a[f.file] = (a[f.file] || 0) + 1, a), {});
  if (bad.length) {
    console.error(`release: MARKER MISMATCH — expected v${target}`);
    for (const b of bad) console.error(`   ${b.file}: found "${b.text}"`);
    return false;
  }
  console.log(`release: all ${found.length} markers agree at v${target} ` +
    `(${Object.entries(counts).map(([f, c]) => `${f}×${c}`).join(', ')})`);
  return true;
}

function bump(next) {
  for (const [file, re, build] of MARKERS) {
    const src = read(file);
    const out = src.replace(new RegExp(re.source, re.flags), () => build(next));
    if (out !== src) fs.writeFileSync(p(file), out);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) process.exit(check() ? 0 : 1);

  const explicit = args.find((a) => /^\d+$/.test(a));
  const cur = currentBuild();
  const next = explicit ? Number(explicit) : cur + 1;
  if (next <= cur && !explicit) { console.error(`release: refusing to go backwards (v${cur} -> v${next})`); process.exit(1); }

  bump(next);
  // Re-read from disk and confirm — a write that silently matched nothing is the
  // whole failure mode this script exists to prevent.
  if (!check(next)) { console.error('release: post-write verification FAILED.'); process.exit(1); }
  console.log(`release: v${cur} -> v${next}. Remember to commit all 4 files together.`);
}

main();
