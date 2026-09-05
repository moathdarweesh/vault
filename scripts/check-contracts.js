#!/usr/bin/env node
/**
 * check-contracts — the implicit agreements between files, made explicit and
 * enforced. One global scope, seven classic <script>s, one blob, one Worker,
 * one schema history: a lot of this app is "X assumes Y", with nothing but a
 * comment keeping X and Y in step. This script keeps them in step. It runs from
 * .githooks/pre-commit (after check-release) and as `npm run check`.
 *
 * Every contract below names the two sides it compares and prints exactly what
 * disagrees. It reads files only — no network, no build, no dependencies — and
 * takes well under a second. Exit 1 on any broken contract.
 *
 * Add a contract here whenever a review finds a "must match" comment.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const JS = ['js/cloud.js', 'js/storage.js', 'js/app.js', 'js/health.js', 'js/notify.js', 'js/foodai.js', 'js/update.js'];
const src = Object.fromEntries(JS.map((f) => [f, read(f)]));
const html = read('index.html');
const admin = read('admin.html');

const failures = [];
const contract = (name, problems) => {
  if (problems.length) { failures.push(name); console.log('  ✗ ' + name); problems.forEach((p) => console.log('      - ' + p)); }
  else console.log('  ✓ ' + name);
};

// ---------------------------------------------------------------- 1. script order = dependency graph
{
  const order = [...html.matchAll(/<script src="(js\/[\w./-]+?)(?:\?v=\d+)?"/g)].map((m) => m[1]).filter((s) => !s.startsWith('js/vendor/'));
  const want = JS;
  contract('index.html loads the seven scripts in dependency order (cloud → storage → app → health → notify → foodai → update)',
    order.join(',') === want.join(',') ? [] : ['found: ' + order.join(' → ')]);
}

// ---------------------------------------------------------------- 2. every version marker agrees
{
  const problems = [];
  const vs = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1]));
  const cleaned = (html.match(/__cleaned_v(\d+)/) || [])[1];
  const web = JSON.parse(read('version.json')).web;
  const fallback = (src['js/app.js'].match(/FALLBACK\s*=\s*'v(\d+)'/) || [])[1];
  // the other versioned pages and the doc's "Current version" line — release.js rewrites them all
  const others = {};
  for (const f of ['manifest.json', 'admin.html', 'privacy.html', 'get/index.html']) others[f] = [...read(f).matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1]));
  others['CLAUDE.md'] = [...read('CLAUDE.md').matchAll(/Current version: v(\d+)/g)].map((m) => Number(m[1]));
  for (const f of Object.keys(others)) if (!others[f].length) problems.push(`${f} has no version marker (release.js expects one)`);
  const set = new Set([...vs, Number(cleaned), Number(web), Number(fallback), ...Object.values(others).flat()]);
  if (set.size !== 1) problems.push(`?v= markers ${[...new Set(vs)].join('/')} · __cleaned_v${cleaned} · version.json web ${web} · app.js FALLBACK ${fallback} · ` + Object.entries(others).map(([f, a]) => `${f} ${[...new Set(a)].join('/')}`).join(' · '));
  // every local script/stylesheet/icon/manifest reference in index.html carries a marker
  for (const m of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
    const u = m[1];
    if (/^(https?:|data:|mailto:)/.test(u)) continue;
    if (!/\.(js|css|svg|json|png|webmanifest)(\?|$)/.test(u)) continue;
    if (!/\?v=\d+/.test(u)) problems.push('no ?v= marker: ' + u);
  }
  contract('every cache-busting marker carries the same version, and every shipped asset has one', problems);
}

// ---------------------------------------------------------------- 3. the two Supabase configs are one
{
  const c = (re, s) => (s.match(re) || [])[1];
  const url1 = c(/SUPABASE_URL\s*=\s*'([^']+)'/, src['js/cloud.js']), url2 = c(/SUPABASE_URL\s*=\s*'([^']+)'/, admin);
  const key1 = c(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/, src['js/cloud.js']), key2 = c(/SUPABASE_KEY\s*=\s*'([^']+)'/, admin);
  const problems = [];
  if (!url1 || url1 !== url2) problems.push(`URL: cloud.js ${url1} vs admin.html ${url2}`);
  if (!key1 || key1 !== key2) problems.push(`key: cloud.js ${key1 && key1.slice(0, 18)}… vs admin.html ${key2 && key2.slice(0, 18)}…`);
  if (key1 && !/^sb_publishable_/.test(key1)) problems.push('cloud.js key is not a publishable key');
  contract('admin.html and cloud.js point at the same Supabase project with the same publishable key', problems);
}

// ---------------------------------------------------------------- 4. tables, RPCs and buckets the clients use exist in the schema history
{
  const clients = src['js/cloud.js'] + src['js/app.js'] + src['js/foodai.js'] + src['js/update.js'] + admin;
  const used = { table: new Set(), rpc: new Set(), bucket: new Set() };
  for (const m of clients.matchAll(/\.from\(['"]([\w-]+)['"]\)/g)) used.table.add(m[1]);
  for (const m of clients.matchAll(/\.rpc\(['"](\w+)['"]/g)) used.rpc.add(m[1]);
  for (const m of clients.matchAll(/storage\s*\.from\(['"]([\w-]+)['"]\)/g)) used.bucket.add(m[1]);
  used.table.delete('objects');   // storage.objects is Supabase's, not ours
  // replay the migrations in order: the LAST statement about a name wins
  const dir = path.join(root, 'backend/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const state = { table: {}, rpc: {}, bucket: {} };
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of sql.matchAll(/\b(create table(?: if not exists)?|drop table(?: if exists)?)\s+(?:public\.)?(\w+)/gi)) state.table[m[2].toLowerCase()] = /^create/i.test(m[1]);
    for (const m of sql.matchAll(/\b(create(?: or replace)? function|drop function(?: if exists)?)\s+(?:public\.)?(\w+)\s*\(/gi)) state.rpc[m[2].toLowerCase()] = /^create/i.test(m[1]);
    for (const m of sql.matchAll(/storage\.buckets[\s\S]{0,300}?'([\w-]+)'/g)) state.bucket[m[1]] = true;
  }
  const problems = [];
  for (const kind of ['table', 'rpc', 'bucket']) for (const n of used[kind]) if (!state[kind][n]) problems.push(`${kind} "${n}" is used by a client but no migration leaves it in place`);
  contract('every Supabase table / RPC / bucket the clients call exists after replaying backend/migrations in order', problems);
}

// ---------------------------------------------------------------- 5. i18n: every literal key exists in BOTH dictionaries, and the dictionaries match
{
  const app = src['js/app.js'].split(/\r?\n/);
  const range = (start) => {
    const s = app.findIndex((l) => l.startsWith(start));
    let e = -1; for (let i = s + 1; i < app.length; i++) if (/^  \},?\s*$/.test(app[i])) { e = i; break; }
    const keys = new Set();
    // keys at line start AND several per line (`a: 'x', b: 'y',`), quoted or bare
    for (let i = s + 1; i < e; i++) for (const m of app[i].matchAll(/(?:^\s*|[{,]\s*)'?([A-Za-z0-9_]+)'?\s*:\s*['"`]/g)) keys.add(m[1]);
    return keys;
  };
  const en = range('  en: {'), ar = range('  ar: {');
  const problems = [];
  const onlyEn = [...en].filter((k) => !ar.has(k)), onlyAr = [...ar].filter((k) => !en.has(k));
  if (onlyEn.length) problems.push('EN only: ' + onlyEn.join(', '));
  if (onlyAr.length) problems.push('AR only: ' + onlyAr.join(', '));
  const usedKeys = new Set(), prefixes = new Set();
  for (const f of JS) for (const m of src[f].matchAll(/\b(?:t|tr)\(\s*'([A-Za-z0-9_]+)'\s*([+,)])/g)) {
    // t('cat_' + x) is a PREFIX: every key under it must exist in both dictionaries
    if (m[2] === '+') prefixes.add(m[1]); else usedKeys.add(m[1]);
  }
  const missing = [...usedKeys].filter((k) => !en.has(k) || !ar.has(k));
  if (missing.length) problems.push('used but missing from a dictionary: ' + missing.join(', '));
  for (const p of prefixes) {
    const a = [...en].filter((k) => k.startsWith(p)).sort().join(','), b = [...ar].filter((k) => k.startsWith(p)).sort().join(',');
    if (!a) problems.push(`prefix t('${p}' + …) has no keys`); else if (a !== b) problems.push(`prefix '${p}' keys differ between en and ar`);
  }
  contract(`i18n: ${usedKeys.size} literal keys + ${prefixes.size} prefixes resolve in both dictionaries (en ${en.size} / ar ${ar.size})`, problems);
}

// ---------------------------------------------------------------- 6. views: every navigate() target has a section, every section a renderer
{
  const sections = new Set([...html.matchAll(/<section class="view[^"]*" data-view="([\w-]+)"/g)].map((m) => m[1]));
  const targets = new Set();
  for (const f of JS) for (const m of src[f].matchAll(/navigate\(\s*'([\w-]+)'/g)) targets.add(m[1]);
  const rv = src['js/app.js'].slice(src['js/app.js'].indexOf('function renderView('));
  const body = rv.slice(0, rv.search(/\r?\nfunction /));
  const cases = new Set([...body.matchAll(/case '([\w-]+)':/g)].map((m) => m[1]));
  const problems = [];
  for (const v of targets) if (!sections.has(v)) problems.push(`navigate('${v}') but index.html has no <section data-view="${v}">`);
  for (const v of sections) if (!cases.has(v)) problems.push(`<section data-view="${v}"> has no case in renderView()`);
  contract('views: every navigate() target has a <section>, every <section> a renderView case', problems);
}

// ---------------------------------------------------------------- 7. custom events: every vault:* event has a sender and a listener
{
  const sent = new Set(), heard = new Set();
  for (const f of JS) {
    for (const m of src[f].matchAll(/CustomEvent\(\s*'(vault:[\w-]+)'/g)) sent.add(m[1]);
    for (const m of src[f].matchAll(/addEventListener\(\s*'(vault:[\w-]+)'/g)) heard.add(m[1]);
  }
  const problems = [];
  for (const e of sent) if (!heard.has(e)) problems.push(`${e} is dispatched but nothing listens`);
  for (const e of heard) if (!sent.has(e)) problems.push(`${e} is listened for but never dispatched`);
  contract('every vault:* event is both dispatched and listened for', problems);
}

// ---------------------------------------------------------------- 8. localStorage keys: one registry, no stray literals
{
  const reg = src['js/cloud.js'].match(/window\.VAULT_KEYS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
  const problems = [];
  if (!reg) problems.push('cloud.js has no window.VAULT_KEYS registry');
  else {
    const values = [...reg[1].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
    const registryText = reg[0];
    for (const f of [...JS]) {
      const body = f === 'js/cloud.js' ? src[f].replace(registryText, '') : src[f];
      const code = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');   // comments may name a key
      for (const v of values) {
        const re = new RegExp("['\"`]" + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?:[^'\"`]*)?['\"`]", 'g');
        const hits = [...code.matchAll(re)].map((m) => m[0]);
        // a prefix key legitimately appears as 'vault_img_' + id; a literal that merely STARTS with a
        // registered value but continues ('vault_img_at_') is a different key and is checked on its own
        for (const h of hits) { const inner = h.slice(1, -1); if (values.includes(inner)) problems.push(`${f}: literal ${h} — use VAULT_KEYS`); }
      }
    }
    // the other direction: a key-shaped literal that is NOT in the registry at all.
    // Only literals that actually reach Web Storage count — directly on a
    // localStorage/sessionStorage line, or through a const/var/let that a
    // storage call later uses (a table name like 'vault_data' is not a key).
    for (const f of JS) {
      const code = src[f].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const storageIdents = new Set([...code.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
      for (const line of code.split(/\r?\n/)) {
        for (const m of line.matchAll(/['"`]((?:vault[._]|gym_tracker|foodai_|hc_)[\w.]*)['"`]/g)) {
          const lit = m[1];
          if (values.includes(lit)) continue;
          if (f === 'js/cloud.js' && registryText.includes(m[0])) continue;
          const onStorageLine = /(?:localStorage|sessionStorage)\./.test(line);
          const assigned = (line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/) || [])[1];
          if (onStorageLine || (assigned && storageIdents.has(assigned))) problems.push(`${f}: unregistered key literal '${lit}' — add it to VAULT_KEYS`);
        }
      }
    }
    // index.html's pre-paint scripts run BEFORE cloud.js and must spell the mirror key
    // themselves — so that one literal is checked against the registry instead.
    const ui = (reg[1].match(/\bui:\s*'([^']+)'/) || [])[1];
    const inHtml = [...html.matchAll(/localStorage\.getItem\('([^']+)'\)/g)].map((m) => m[1]);
    for (const k of inHtml) if (k !== ui) problems.push(`index.html reads localStorage key '${k}' but the registry's ui key is '${ui}'`);
  }
  contract('localStorage keys come from the VAULT_KEYS registry in cloud.js — no literal copies elsewhere', problems);
}

// ---------------------------------------------------------------- 9. Worker error strings are ones the client can translate
{
  const worker = exists('backend/worker/gemini-worker.js') ? read('backend/worker/gemini-worker.js') : '';
  // the `{ error: '…' }` bodies only — not console.error('…:', x) text
  const errs = [...worker.matchAll(/[{,(]\s*error:\s*'([^'\n]+)'/g)].map((m) => m[1]);
  const reSrc = (src['js/foodai.js'].match(/const WORKER_ERR_RE\s*=\s*(\/.+\/[a-z]*);/) || [])[1];
  const problems = [];
  if (!reSrc) problems.push('foodai.js has no WORKER_ERR_RE');
  else {
    const re = new Function('return ' + reSrc)();
    for (const e of new Set(errs)) if (!re.test(e.toLowerCase().replace(/_/g, ' '))) problems.push(`worker error '${e}' has no client translation`);
  }
  contract('every error string the Worker can return is one foodai.friendlyErr translates', problems);
}

// ---------------------------------------------------------------- 10. one blob validator, one week start
{
  const problems = [];
  const vb = src['js/cloud.js'].slice(src['js/cloud.js'].indexOf('function validateBlob('), src['js/cloud.js'].indexOf('function validateBlob(') + 900);
  if (!/DB\._validateBlob/.test(vb)) problems.push('cloud.js validateBlob does not delegate to DB._validateBlob — two validators drift');
  if (!/^const WEEK_START\s*=/m.test(src['js/storage.js'])) problems.push('storage.js has no WEEK_START');
  if (/\[0, 1, 2, 3, 4, 5, 6\]/.test(src['js/app.js'])) problems.push('app.js still builds a week with a literal [0..6] — use weekOrder()');
  contract('the blob has one validator (storage.js) and the week one start (storage.js WEEK_START)', problems);
}

// ---------------------------------------------------------------- 11. the APK's numbers agree everywhere
{
  const problems = [];
  const gradle = exists('android/app/build.gradle') ? read('android/app/build.gradle') : '';
  const code = (gradle.match(/versionCode\s+(\d+)/) || [])[1], name = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
  const apk = JSON.parse(read('version.json')).apk || {};
  if (gradle && String(apk.build) !== String(code)) problems.push(`version.json apk.build ${apk.build} vs build.gradle versionCode ${code}`);
  if (gradle && String(apk.version) !== String(name)) problems.push(`version.json apk.version ${apk.version} vs build.gradle versionName ${name}`);
  const capRoot = 'capacitor.config.json', capCopy = 'android/app/src/main/assets/capacitor.config.json';
  if (exists(capRoot) && exists(capCopy) && read(capRoot).replace(/\s+/g, '') !== read(capCopy).replace(/\s+/g, '')) {
    console.log('  ! capacitor.config.json differs from the copy inside android/app/src/main/assets — run `npm run sync` before the next APK build (not a failure: the web release does not ship it)');
  }
  contract('version.json apk.build/apk.version equal build.gradle versionCode/versionName', problems);
}

// ---------------------------------------------------------------- 12. index.html preconnects to the project cloud.js talks to
{
  const url = (src['js/cloud.js'].match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1] || '';
  const host = url.replace(/^https?:\/\//, '');
  const pre = [...html.matchAll(/rel="(?:preconnect|dns-prefetch)" href="https:\/\/([^"/]+)"/g)].map((m) => m[1]).filter((h) => /supabase\.co$/.test(h));
  const problems = pre.filter((h) => h !== host).map((h) => `index.html preconnects to ${h}, cloud.js uses ${host}`);
  contract('index.html preconnects to the same Supabase host cloud.js uses', problems);
}

// ---------------------------------------------------------------- 13. the two exercise-name maps cover every seed exercise, and each other
{
  const app = src['js/app.js'];
  const mapKeys = (name) => {
    const i = app.indexOf('const ' + name + ' = {'); if (i < 0) return null;
    const body = app.slice(i, app.indexOf('\n};', i));
    return new Set([...body.matchAll(/^\s*'([^']+)':\s*'/gm)].map((m) => m[1]));
  };
  const a = mapKeys('EXERCISE_NAME_AR'), b = mapKeys('EXERCISE_NAME_AR_FULL');
  const seeds = new Set([...src['js/storage.js'].matchAll(/^\s*\{\s*name:\s*'([^']+)'/gm)].map((m) => m[1]));
  const problems = [];
  if (!a || !b) problems.push('a name map is missing from js/app.js');
  else {
    for (const k of a) if (!b.has(k)) problems.push(`'${k}' has a transliteration but no translation (EXERCISE_NAME_AR_FULL)`);
    for (const k of b) if (!a.has(k)) problems.push(`'${k}' has a translation but no transliteration (EXERCISE_NAME_AR)`);
    for (const k of seeds) if (!a.has(k) || !b.has(k)) problems.push(`seed exercise '${k}' is missing from a name map`);
  }
  contract(`exercise names: ${seeds.size} seed exercises have both a transliteration and a translation, and the two maps match`, problems);
}

console.log(failures.length ? `\ncheck-contracts: ${failures.length} broken contract(s)` : '\ncheck-contracts: all contracts hold');
process.exit(failures.length ? 1 : 0);
