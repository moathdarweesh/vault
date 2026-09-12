#!/usr/bin/env node
/**
 * sync-ios — the local convenience wrapper: build www, sync iOS, then run the
 * bundle guard. CI runs the same three steps SEPARATELY so a failure names
 * itself instead of hiding inside one opaque script.
 *
 * Never run `npx cap sync ios` on its own: it regenerates the iOS runtime
 * config WITH the live-URL server block, which is the one thing App Store
 * guideline 4.2 will not accept. scripts/ios-bundle-guard.js is what removes it.
 *
 * ⚠️ `shell: true` is for `npx.cmd` ONLY. Node's own path on Windows is
 * `C:\Program Files\nodejs\node.exe`; handed to cmd.exe unquoted it is split at
 * the space and the run dies with «'C:\Program' is not recognized». A .cmd
 * shim, on the other hand, cannot be executed WITHOUT a shell. So the two cases
 * are spawned differently on purpose — do not unify them.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const win = process.platform === 'win32';

function run(cmd, args, opts) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: !!(opts && opts.shell) });
  if (r.error) { console.error('sync-ios: could not run ' + cmd + ' — ' + r.error.message); process.exit(1); }
  if (r.status !== 0) { console.error('sync-ios: ' + cmd + ' exited ' + r.status); process.exit(r.status || 1); }
}

run(process.execPath, [path.join('scripts', 'build-www.js')]);
run(win ? 'npx.cmd' : 'npx', ['cap', 'sync', 'ios'], { shell: win });
run(process.execPath, [path.join('scripts', 'ios-bundle-guard.js')]);
