#!/usr/bin/env node
/**
 * Pre-commit guard: refuse a commit that ships user-visible code WITHOUT bumping
 * the cache-busting version.
 *
 *   node scripts/check-release.js
 *
 * WHY THIS AND NOT JUST scripts/release.js --check
 * `--check` only proves the 12 markers agree with EACH OTHER. It cannot catch the
 * failure that has actually occurred in this repo (commit ea6c74e, "v150"): a
 * commit that edited js/app.js and nothing else, after the v150 markers had
 * already been consumed by an earlier commit. Every marker still agreed — they
 * were just stale, so the change never reached a single phone.
 *
 * So this compares the STAGED tree against HEAD:
 *   if any shipped file changed AND index.html's ?v=N is unchanged  -> fail.
 *
 * Install (optional, one line):
 *   git config core.hooksPath .githooks
 * Bypass for a genuine docs/backend-only commit that git can't classify:
 *   SKIP_RELEASE_CHECK=1 git commit ...
 */
'use strict';
const { execSync } = require('child_process');

// Files whose contents are served to a browser — changing any of them requires a
// new ?v=N or devices keep running the old copy from cache.
const SHIPPED = /^(index\.html|styles\.css|js\/.*\.js|privacy\.html|admin\.html)$/;
// …except these, which are not part of the cached app bundle.
const EXEMPT = /^(js\/vendor\/|scripts\/)/;

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (_) { return ''; }
}

function main() {
  if (process.env.SKIP_RELEASE_CHECK) { console.log('check-release: skipped (SKIP_RELEASE_CHECK)'); return 0; }
  if (!sh('git rev-parse --git-dir')) { console.log('check-release: not a git repo, skipping'); return 0; }

  const staged = sh('git diff --cached --name-only').split('\n').map((s) => s.trim()).filter(Boolean);
  if (!staged.length) return 0;

  const shipped = staged.filter((f) => SHIPPED.test(f) && !EXEMPT.test(f));
  if (!shipped.length) return 0;   // nothing user-visible in this commit

  const verOf = (src) => { const m = src.match(/\?v=(\d+)/); return m ? m[1] : null; };
  const headVer = verOf(sh('git show HEAD:index.html'));
  const stagedVer = verOf(sh('git show :index.html') || sh('git show HEAD:index.html'));

  if (headVer && stagedVer && headVer === stagedVer) {
    console.error('');
    console.error('  ✖ check-release: this commit ships code but does NOT bump the version.');
    console.error('');
    console.error('    changed: ' + shipped.join(', '));
    console.error('    index.html is still at ?v=' + headVer + ' (same as HEAD).');
    console.error('');
    console.error('    Devices cache by ?v=N, so this change would never reach them.');
    console.error('    Fix:  npm run release  &&  git add -A');
    console.error('    Or:   SKIP_RELEASE_CHECK=1 git commit …   (if this really is not shipped code)');
    console.error('');
    return 1;
  }
  console.log(`check-release: ok (v${headVer} -> v${stagedVer})`);
  return 0;
}

process.exit(main());
