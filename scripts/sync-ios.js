#!/usr/bin/env node
/**
 * sync-ios — build www/, sync the iOS project, and then REMOVE `server` from the
 * generated iOS runtime config.
 *
 * WHY THIS SCRIPT EXISTS AT ALL
 * Android ships as a thin shell: `capacitor.config.json` sets
 * `server.url = https://moathdarweesh.github.io/vault/`, the APK loads the LIVE
 * site, and a `git push` updates every installed app with no reinstall. That is
 * the whole distribution model (see CLAUDE.md, "Distribution model").
 *
 * iOS CANNOT SHIP THAT WAY. App Store Review Guideline 4.2 rejects an app that is
 * "simply a web site bundled as an app", and reviewers apply it to exactly this
 * shape — a WKWebView pointed at a remote URL with no native substance. So the
 * iOS build serves its web assets from the BUNDLE (capacitor://localhost) and the
 * `server` block must not reach it.
 *
 * `ios/App/App/capacitor.config.json` is GITIGNORED (Capacitor regenerates it on
 * every sync), so this cannot be fixed once and committed — the strip has to
 * happen on every sync. That is why nobody should run `npx cap sync ios`
 * directly: run `npm run sync:ios`, and let CI run this too.
 *
 * It ends by RE-READING the file it wrote and refusing to exit 0 if `server`
 * survived. A silent failure here would ship an App-Store-rejectable build that
 * looks identical from the outside.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const IOS_CONFIG = path.join(root, 'ios', 'App', 'App', 'capacitor.config.json');

function run(cmd, args) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
}

if (!fs.existsSync(path.join(root, 'ios'))) {
  console.error('sync-ios: there is no ios/ platform. Run `npx cap add ios` first.');
  process.exit(1);
}

run('node', ['scripts/build-www.js']);
run('npx', ['cap', 'sync', 'ios']);

if (!fs.existsSync(IOS_CONFIG)) {
  console.error('sync-ios: expected ' + IOS_CONFIG + ' after the sync, and it is not there.');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(IOS_CONFIG, 'utf8'));
const had = !!(before.server && before.server.url);
delete before.server;
// `android` is meaningless in the iOS runtime config and only invites confusion.
delete before.android;
fs.writeFileSync(IOS_CONFIG, JSON.stringify(before, null, '\t') + '\n');

// Re-read from disk: proving the write, not the intention.
const after = JSON.parse(fs.readFileSync(IOS_CONFIG, 'utf8'));
if (after.server) {
  console.error('sync-ios: FAILED — `server` is still in the iOS config. Do not build this.');
  process.exit(1);
}
if (!after.appId || !after.webDir) {
  console.error('sync-ios: FAILED — the iOS config lost appId/webDir.');
  process.exit(1);
}

const pub = path.join(root, 'ios', 'App', 'App', 'public', 'index.html');
if (!fs.existsSync(pub)) {
  console.error('sync-ios: FAILED — no bundled index.html at ios/App/App/public. The app would open blank.');
  process.exit(1);
}

console.log('');
console.log('sync-ios: ok');
console.log('  server block ' + (had ? 'REMOVED (was the live URL)' : 'was already absent'));
console.log('  the iOS app will serve ios/App/App/public from the bundle');
console.log('  appId ' + after.appId + ', webDir ' + after.webDir);
