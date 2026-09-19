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

const { JS, VIEWS, EARLY, TOP_LEVEL } = require('./shipped.js');
const PAGE_FILES = ['index.html', 'admin.html', 'privacy.html', 'get/index.html'];
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
  // The title is DERIVED. It used to spell the order out by hand next to a
  // check that reads it from JS — two spellings of one fact, and the hand one
  // is the one that goes stale silently while the check stays green.
  contract('index.html loads the ' + JS.length + ' scripts in dependency order (' + JS.map((f) => f.slice(3, -3)).join(' → ') + ')',
    order.join(',') === want.join(',') ? [] : ['found: ' + order.join(' → ')]);
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="js\/[^">]+"[^>]*>/g)].map(m => m[0]);
  contract('startup scripts download in parallel and execute in order',
    tags.filter(tag => !/\sdefer(?:\s|>)/.test(tag) || /\sasync(?:\s|>)/.test(tag)));
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
  // a table named through a const — `const TABLE = 'vault_data'` … `.from(TABLE)` — counts too
  for (const m of clients.matchAll(/const\s+([A-Z_]\w*)\s*=\s*'([\w-]+)'/g)) {
    if (new RegExp('storage\\s*\\.from\\(' + m[1] + '\\)').test(clients)) used.bucket.add(m[2]);
    else if (new RegExp('\\.from\\(' + m[1] + '\\)').test(clients)) used.table.add(m[2]);
  }
  used.table.delete('objects');   // storage.objects is Supabase's, not ours
  // replay the migrations in order: the LAST statement about a name wins
  const dir = path.join(root, 'backend/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const state = { table: {}, rpc: {}, bucket: {}, cols: {} };
  const trigFn = {};   // trigger function → the old./new. columns its body reads
  const problems = [];
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    // columns: from the CREATE TABLE body (one column per line) and every ADD COLUMN since
    for (const m of sql.matchAll(/create table(?: if not exists)?\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)^\)/gim)) {
      const cols = new Set();
      for (const line of m[2].split(/\r?\n/)) { const c = line.trim().match(/^"?([a-z_]\w*)"?\s+\w/i); if (c && !/^(primary|unique|check|constraint|foreign|references|like)$/i.test(c[1])) cols.add(c[1].toLowerCase()); }
      state.cols[m[1].toLowerCase()] = cols;
    }
    for (const m of sql.matchAll(/alter table\s+(?:public\.)?(\w+)\s+add column(?: if not exists)?\s+"?(\w+)"?/gi)) (state.cols[m[1].toLowerCase()] = state.cols[m[1].toLowerCase()] || new Set()).add(m[2].toLowerCase());
    // a trigger function's body names columns of the row it fires on; they must exist on the
    // table the trigger is attached to AT THIS POINT of the replay (20 read old.version two files before 22 added it)
    for (const m of sql.matchAll(/create(?: or replace)? function\s+(?:public\.)?(\w+)\s*\(\s*\)\s*returns trigger[\s\S]*?\$\$([\s\S]*?)\$\$/gi)) trigFn[m[1].toLowerCase()] = new Set([...m[2].matchAll(/\b(?:old|new)\.(\w+)/gi)].map((x) => x[1].toLowerCase()));
    for (const m of sql.matchAll(/create(?: or replace)? trigger\s+\w+[\s\S]*?\bon\s+(?:public\.)?(\w+)[\s\S]*?execute (?:function|procedure)\s+(?:public\.)?(\w+)\s*\(/gi)) {
      const refs = trigFn[m[2].toLowerCase()], cols = state.cols[m[1].toLowerCase()];
      if (refs && cols) for (const c of refs) if (!cols.has(c)) problems.push(`${f}: trigger on ${m[1]} runs ${m[2]}(), which reads ${c} — a column ${m[1]} does not have at that point of the replay`);
    }
    for (const m of sql.matchAll(/\b(create table(?: if not exists)?|drop table(?: if exists)?)\s+(?:public\.)?(\w+)/gi)) state.table[m[2].toLowerCase()] = /^create/i.test(m[1]);
    for (const m of sql.matchAll(/\b(create(?: or replace)? function|drop function(?: if exists)?)\s+(?:public\.)?(\w+)\s*\(/gi)) state.rpc[m[2].toLowerCase()] = /^create/i.test(m[1]);
    for (const m of sql.matchAll(/storage\.buckets[\s\S]{0,300}?'([\w-]+)'/g)) state.bucket[m[1]] = true;
  }
  for (const kind of ['table', 'rpc', 'bucket']) for (const n of used[kind]) if (!state[kind][n]) problems.push(`${kind} "${n}" is used by a client but no migration leaves it in place`);
  contract('every Supabase table / RPC / bucket the clients call exists after replaying backend/migrations in order, and every trigger reads columns its table has by then', problems);
}

// ---------------------------------------------------------------- 5. i18n: every literal key exists in BOTH dictionaries, and the dictionaries match
{
  const app = src['js/i18n.js'].split(/\r?\n/);
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
  // keys that reach t() by other routes: the static nav's data-t attributes (index.html),
  // health.js's METRICS label/unit fields, and storage.js's F('key') reminder texts
  for (const m of html.matchAll(/data-t="([A-Za-z0-9_]+)"/g)) usedKeys.add(m[1]);
  for (const m of src['js/health.js'].matchAll(/\b(?:label|unit):\s*'([A-Za-z0-9_]+)'/g)) if (m[1] !== 'percent') usedKeys.add(m[1]);
  for (const m of src['js/storage.js'].matchAll(/\bF\(\s*'([A-Za-z0-9_]+)'/g)) usedKeys.add(m[1]);
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
  // reminder tap destinations (DB.notif.destFor) name views as data and reach navigate() unchanged
  for (const m of src['js/storage.js'].matchAll(/\bview:\s*'([\w-]+)'/g)) targets.add(m[1]);
  const rv = src['js/app.js'].slice(src['js/app.js'].indexOf('function renderView('));
  const body = rv.slice(0, rv.search(/\r?\nfunction /));
  const cases = new Set([...body.matchAll(/case '([\w-]+)':/g)].map((m) => m[1]));
  const problems = [];
  for (const v of targets) if (!sections.has(v)) problems.push(`navigate('${v}') but index.html has no <section data-view="${v}">`);
  for (const v of sections) if (!cases.has(v)) problems.push(`<section data-view="${v}"> has no case in renderView()`);
  // the bottom nav's buttons and navigate()'s navMap (which tab stays lit) are the same vocabulary
  const navBtns = new Set([...html.matchAll(/class="nav-btn[^"]*" data-view="([\w-]+)"/g)].map((m) => m[1]));
  const nm = src['js/app.js'].match(/const navMap = \{([\s\S]*?)\};/);
  if (!nm) problems.push('app.js has no navMap literal');
  else {
    const navMap = {};
    for (const m of nm[1].replace(/\/\/[^\n]*/g, '').matchAll(/'?([\w-]+)'?\s*:\s*'([\w-]+)'/g)) navMap[m[1]] = m[2];
    for (const v of navBtns) if (!sections.has(v)) problems.push(`bottom-nav button data-view="${v}" has no <section>`);
    for (const v of sections) if (!(v in navMap)) problems.push(`navMap has no entry for view '${v}' — no tab stays lit there`);
    for (const k of Object.keys(navMap)) { if (!sections.has(k)) problems.push(`navMap names '${k}', which has no <section>`); if (!navBtns.has(navMap[k])) problems.push(`navMap lights tab '${navMap[k]}' for '${k}', but the bottom nav has no such button`); }
  }
  contract('views: every navigate() target and reminder destination has a <section>, every <section> a renderView case and a navMap entry, and navMap lights only real tabs', problems);
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
    // a key DERIVED from another (`STORAGE_KEY + '__corrupt'`) is a second spelling the registry cannot see
    for (const f of JS) for (const m of src[f].matchAll(/(?:STORAGE_KEY|VAULT_KEYS\.\w+)\s*\+\s*'(_+\w*)'/g)) problems.push(`${f}: key derived as ${m[0]} — register it in VAULT_KEYS instead`);
    const regObj = {}; for (const m of reg[1].matchAll(/\b(\w+):\s*'([^']+)'/g)) regObj[m[1]] = m[2];
    if (regObj.corrupt !== regObj.store + '__corrupt') problems.push(`VAULT_KEYS.corrupt ('${regObj.corrupt}') is not VAULT_KEYS.store + '__corrupt' — an existing user's quarantined copy would not be found`);
    // imgPrune sweeps every key starting with VAULT_KEYS.img: no OTHER registry value may start with it
    for (const [k, v] of Object.entries(regObj)) if (k !== 'img' && k !== 'imgAt' && v.startsWith(regObj.img)) problems.push(`VAULT_KEYS.${k} ('${v}') starts with VAULT_KEYS.img — imgPrune would delete it`);
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
  // update.js ends its native check on `typeof apk.build !== 'number'` — a quoted build passes a string compare and silently disables the banner
  if (typeof apk.build !== 'number') problems.push(`version.json apk.build must be a JSON number (update.js requires typeof 'number'), got ${JSON.stringify(apk.build)}`);
  if (typeof apk.version !== 'string') problems.push(`version.json apk.version must be a string, got ${JSON.stringify(apk.version)}`);
  const capRoot = 'capacitor.config.json', capCopy = 'android/app/src/main/assets/capacitor.config.json';
  if (exists(capRoot) && exists(capCopy) && read(capRoot).replace(/\s+/g, '') !== read(capCopy).replace(/\s+/g, '')) {
    console.log('  ! capacitor.config.json differs from the copy inside android/app/src/main/assets — run `npm run sync` before the next APK build (not a failure: the web release does not ship it)');
  }
  contract('version.json apk.build/apk.version equal build.gradle versionCode/versionName', problems);
}

// ---------------------------------------------------------------- 11b. the published APK fingerprint is the real one
/* The APK is signed with the Android DEBUG key — the one that ships with the
   SDK and sits on every developer machine on earth — so the signature proves
   nothing about who built it. The published SHA-256 is the only thing a user
   can actually check the download against.

   ⚠️ A HASH THAT DOES NOT MATCH THE FILE IS WORSE THAN NO HASH: it tells the
   user a tampered binary is genuine. So it is recomputed from the bytes on
   every commit, and both places that publish it must agree with them. */
{
  const problems = [];
  const apkPath = 'download/THE-VAULT.apk';
  if (!exists(apkPath)) {
    problems.push('download/THE-VAULT.apk is missing');
  } else {
    const real = require('crypto').createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex');
    const declared = (JSON.parse(read('version.json')).apk || {}).sha256 || '';
    if (!declared) problems.push('version.json apk.sha256 is missing — publish the fingerprint of the binary you ship');
    else if (declared !== real) problems.push(`version.json apk.sha256 says ${declared.slice(0, 16)}… but the file hashes to ${real.slice(0, 16)}…`);
    const sidecarPath = apkPath + '.sha256';
    if (!exists(sidecarPath)) {
      problems.push('download/THE-VAULT.apk.sha256 is missing');
    } else {
      const sidecar = read(sidecarPath).trim().split(/\s+/)[0] || '';
      if (sidecar !== real) problems.push(`the .sha256 sidecar says ${sidecar.slice(0, 16)}… but the file hashes to ${real.slice(0, 16)}…`);
    }
  }
  contract('the published APK fingerprint equals the bytes of the shipped binary', problems);
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
  const cat = src['js/catalog.js'];
  const mapKeys = (name) => {
    const i = cat.indexOf('const ' + name + ' = {'); if (i < 0) return null;
    const body = cat.slice(i, cat.indexOf('\n};', i));
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

// ---------------------------------------------------------------- 14. RPC argument names match the SQL parameter names (PostgREST resolves by NAME)
{
  const dir = path.join(root, 'backend/migrations');
  let sql = '';
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) sql += '\n' + fs.readFileSync(path.join(dir, f), 'utf8');
  const fns = {};   // name → [param-name lists], every overload that survives replay
  for (const m of sql.matchAll(/create(?: or replace)? function\s+(?:public\.)?(\w+)\s*\(([^)]*)\)/gi)) {
    const params = m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.replace(/^(in|out|inout)\s+/i, '').split(/\s+/)[0].toLowerCase());
    (fns[m[1].toLowerCase()] = fns[m[1].toLowerCase()] || []).push(params);
  }
  const clients = { 'js/cloud.js': src['js/cloud.js'], 'js/app.js': src['js/app.js'], 'js/foodai.js': src['js/foodai.js'], 'admin.html': admin };
  const problems = []; let checked = 0;
  for (const [f, s] of Object.entries(clients)) {
    for (const m of s.matchAll(/\.rpc\(\s*['"](\w+)['"]\s*(?:,\s*(\{[^}]*\}|[A-Za-z_$][\w$.]*))?/g)) {
      const name = m[1].toLowerCase(), defs = fns[name];
      if (!defs) { problems.push(`${f}: rpc('${name}') has no definition in the migrations`); continue; }
      if (!m[2] || !m[2].startsWith('{')) continue;            // arguments built elsewhere: checked by contract 4 (exists) only
      const args = m[2].slice(1, -1).split(',').map((a) => a.trim()).filter(Boolean).map((a) => a.split(':')[0].trim().replace(/['"]/g, '').toLowerCase());
      checked++;
      if (!defs.some((p) => p.length === args.length && args.every((a) => p.includes(a)))) problems.push(`${f}: rpc('${name}', {${args.join(', ')}}) matches no overload — SQL has ${defs.map((p) => '(' + p.join(', ') + ')').join(' | ')}`);
    }
  }
  contract(`every rpc() call's argument names match a surviving SQL overload (${checked} calls with literal arguments)`, problems);
}

// ---------------------------------------------------------------- 15. js/health.js calls only methods HealthConnectPlugin.kt declares
{
  const kt = exists('android/app/src/main/java/com/moath/thevault/HealthConnectPlugin.kt') ? read('android/app/src/main/java/com/moath/thevault/HealthConnectPlugin.kt') : '';
  const methods = new Set([...kt.matchAll(/^[^\S\r\n]*@PluginMethod\s*\r?\n\s*fun\s+(\w+)\s*\(/gm)].map((m) => m[1]));
  const calls = new Set([...src['js/health.js'].matchAll(/plugin\(\)\.(\w+)\(/g)].map((m) => m[1]));
  const problems = kt ? [...calls].filter((c) => !methods.has(c)).map((c) => `js/health.js calls plugin().${c}() but the Kotlin plugin has no @PluginMethod ${c}`) : [];
  contract(`js/health.js calls only @PluginMethods the native plugin declares (${calls.size} calls)`, problems);
}

// ---------------------------------------------------------------- 16. the Console counts the SAME week as the app
// storage.js WEEK_START is the app's one week start (contract 10). The Console has
// three more copies of that decision — the SQL anchor in admin_user_stats(), the
// two client-side week computations in admin.html, and the captions that name the
// day. Migration 19 said Saturday while the app said Sunday, and the same user
// read two different adherence figures on the same morning.
{
  const problems = [];
  const ws = Number((src['js/storage.js'].match(/^const WEEK_START\s*=\s*(\d)/m) || [])[1]);
  const AR_DAY = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const ANCHOR_SQL = { 0: 'current_date - extract(dow from current_date)::int', 6: 'current_date - ((extract(dow from current_date)::int + 1) % 7)' };
  const ANCHOR_JS = { 0: /getDate\(\)\s*-\s*(\w+)\.getDay\(\)\)/, 6: /getDate\(\)\s*-\s*\(\((\w+)\.getDay\(\)\s*\+\s*1\)\s*%\s*7\)\)/ };
  if (!(ws in ANCHOR_SQL)) problems.push(`WEEK_START = ${ws} — this contract knows the Sunday (0) and Saturday (6) anchors only; teach it the new one`);
  else {
    // the SQL: the last migration (replay order) that defines admin_user_stats decides
    const dir = path.join(root, 'backend/migrations');
    let def = null, from = null;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      const i = sql.search(/create(?: or replace)? function\s+(?:public\.)?admin_user_stats\s*\(/i);
      if (i >= 0) { def = sql.slice(i); from = f; }
    }
    if (!def) problems.push('no migration defines admin_user_stats()');
    else if (!def.includes(ANCHOR_SQL[ws])) problems.push(`${from}: admin_user_stats() does not anchor its week on day ${ws} — expected "${ANCHOR_SQL[ws]}"`);
    // the two client-side week starts in admin.html (weekStartDate + the plan-vs-done grid)
    const jsSites = [...admin.matchAll(/getDate\(\)\s*-\s*[^;]*getDay\(\)[^;]*;/g)].map((m) => m[0]);
    if (jsSites.length !== 2) problems.push(`admin.html has ${jsSites.length} week-start computations (expected 2: weekStartDate and the plan-vs-done grid)`);
    for (const site of jsSites) if (!ANCHOR_JS[ws].test(site)) problems.push(`admin.html week start does not begin on day ${ws}: ${site.trim()}`);
    // the captions name the day
    for (const m of admin.matchAll(/الأسبوع من ([\u0600-\u06FF]+)/g)) if (m[1] !== AR_DAY[ws]) problems.push(`admin.html caption says the week starts on ${m[1]}, the app says ${AR_DAY[ws]}`);
    for (const m of admin.matchAll(/تفرغ كل ([\u0600-\u06FF]+)/g)) if (m[1] !== AR_DAY[ws].replace(/^ال/, '')) problems.push(`admin.html says the list empties every ${m[1]}, the week starts on ${AR_DAY[ws]}`);
  }
  contract(`the Console counts the app's week (WEEK_START ${ws}): the admin_user_stats() anchor, both admin.html week starts and every caption agree`, problems);
}

// ---------------------------------------------------------------- 17. the static DOM app.js assumes (index.html's chrome)
// The bottom nav, the modal root, the toast, the food FAB, .app, .main and the
// theme-color meta are static HTML that no template emits; JS queries them by
// name, and `$('#bottom-nav').addEventListener` runs at top level with no guard.
{
  const problems = [];
  const js = JS.map((f) => src[f]).join('\n');
  const stripped = js.replace(/\/\/[^\n]*/g, '');
  const ids = new Set(), classes = new Set();
  for (const m of stripped.matchAll(/(?:\$|getElementById|querySelector)\(\s*'#?([\w-]+)'\s*\)/g)) ids.add(m[1]);
  for (const m of stripped.matchAll(/(?:\$\$|\$|querySelectorAll|querySelector)\(\s*'\.([\w-]+)'\s*\)/g)) classes.add(m[1]);
  const emitsId = (id) => new RegExp('id=\\"' + id + '\\"|\\bid:\\s*\'' + id + '\'|\\.id\\s*=\\s*\'' + id + '\'').test(js);
  // emitted by JS when the token is named anywhere other than a '.x' query literal —
  // a class attribute (`class="sfp-tab${…}"`), a classList call, or `moved ? 'is-moved' : ''`
  const emitsClass = (c) => (stripped.match(new RegExp('\\b' + c + '\\b', 'g')) || []).length > (stripped.match(new RegExp('[\'"`]\\.' + c + '[\'"`]', 'g')) || []).length;
  for (const id of ids) if (!emitsId(id) && !new RegExp('id=\\"' + id + '\\"').test(html)) problems.push(`JS queries #${id}, which no template emits and index.html does not have`);
  for (const c of classes) if (!emitsClass(c) && !new RegExp('class=\\"[^\\"]*\\b' + c + '\\b').test(html)) problems.push(`JS queries .${c}, which no template emits and index.html does not have`);
  if (/meta\[name="theme-color"\]/.test(js) && !/<meta name="theme-color"/.test(html)) problems.push('JS updates meta[name="theme-color"] but index.html has no such meta');
  contract(`the static DOM the scripts query (${ids.size} ids, ${classes.size} classes) exists — in index.html when no template emits it`, problems);
}

// ---------------------------------------------------------------- 18. client_errors accepts every kind the app reports
{
  const dir = path.join(root, 'backend/migrations');
  let kinds = null, from = null;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of sql.matchAll(/kind\s+(?:text\s+not\s+null\s+)?check\s*\(\s*kind\s+in\s*\(([^)]*)\)|check\s*\(\s*kind\s+in\s*\(([^)]*)\)/gi)) { kinds = new Set([...(m[1] || m[2]).matchAll(/'([^']+)'/g)].map((x) => x[1])); from = f; }
  }
  const problems = [];
  if (!kinds) problems.push('no migration constrains client_errors.kind');
  else for (const f of JS) for (const m of src[f].matchAll(/reportError\(\s*'([\w-]+)'/g)) if (!kinds.has(m[1])) problems.push(`${f}: reportError('${m[1]}', …) — ${from} only accepts ${[...kinds].join(', ')}; the insert is refused and silently dropped`);
  contract(`client_errors accepts every reportError() kind the scripts send (${kinds ? [...kinds].length : 0} kinds, ${from})`, problems);
}

// ---------------------------------------------------------------- 19. a module app.js paints around (typeof X ? X.y() : '') redraws once it exists
{
  const problems = [];
  const mods = new Set([...src['js/app.js'].matchAll(/typeof (\w+) !== 'undefined' \? \1\./g)].map((m) => m[1]));
  const file = { Health: 'js/health.js', Notify: 'js/notify.js', FoodAI: 'js/foodai.js', VaultUpdate: 'js/update.js' };
  for (const mod of mods) {
    const f = file[mod]; if (!f) { problems.push(`no file known for module ${mod}`); continue; }
    const after = src[f].slice(src[f].indexOf('window.' + mod + ' ='));
    if (!/refreshActive\(\)|renderView\(/.test(after)) problems.push(`${f}: app.js's init() renders before this file exists and its template asks typeof ${mod} — nothing after window.${mod} = … redraws the view`);
  }
  contract(`modules loaded after app.js redraw what init() painted without them (${[...mods].join(', ') || 'none'})`, problems);
}

// ---------------------------------------------------------------- 20. the two background colours, in all four places
{
  const css = read('styles.css');
  const dark = (css.match(/:root, body\.theme-dark[\s\S]*?--bg:\s*(#[0-9a-f]{6})/i) || [])[1];
  const light = (css.match(/body\.theme-light[\s\S]*?--bg:\s*(#[0-9a-f]{6})/i) || [])[1];
  const problems = [];
  if (!dark || !light) problems.push(`styles.css --bg not found (dark ${dark}, light ${light})`);
  else {
    const meta = (html.match(/<meta name="theme-color" content="(#[0-9a-f]{6})"/i) || [])[1];
    if (meta !== dark) problems.push(`index.html static theme-color ${meta} ≠ styles.css dark --bg ${dark}`);
    for (const [name, text] of [['index.html pre-paint', html], ['js/ui.js applyTheme', src['js/ui.js']]]) {
      const m = text.match(/theme === 'light' \? '(#[0-9a-f]{6})' : '(#[0-9a-f]{6})'/i);
      if (!m) problems.push(`${name}: no "theme === 'light' ? '#…' : '#…'" literal`);
      else { if (m[1] !== light) problems.push(`${name}: light ${m[1]} ≠ styles.css ${light}`); if (m[2] !== dark) problems.push(`${name}: dark ${m[2]} ≠ styles.css ${dark}`); }
    }
  }
  contract(`theme-color tracks --bg exactly: styles.css (${dark}/${light}), the static meta, the pre-paint script and applyTheme agree`, problems);
}

// ---------------------------------------------------------------- 21. the pre-paint mirror's shape is a three-file agreement
{
  const problems = [];
  const pre = html.slice(html.indexOf("localStorage.getItem('"), html.indexOf('</script>', html.indexOf("localStorage.getItem('")));
  const readFields = new Set([...pre.matchAll(/\bui\.(\w+)/g)].map((m) => m[1]));
  const mirror = src['js/storage.js'].slice(src['js/storage.js'].indexOf('function mirrorUi('));
  const written = new Set([...mirror.slice(0, mirror.indexOf('\n}')).matchAll(/\b(\w+):\s*p\.\w+/g)].map((m) => m[1]));
  // ⚠️ THE VIEW SCRIPTS, NOT app.js. applyTheme() and applyLang() — the only two
  // callers of mirrorUi() — moved to js/ui.js in v360, and this contract caught
  // it LOUDLY, which is the whole difference between contract 21 and the silent
  // failure contract 24 was one release away from. It reads VIEWS now.
  const viewSrc = VIEWS.map((f) => src[f]).join('\n');
  for (const m of viewSrc.matchAll(/mirrorUi\(\{\s*(\w+)/g)) written.add(m[1]);
  for (const f of readFields) if (!written.has(f)) problems.push(`index.html's pre-paint reads ui.${f}, which mirrorUi() never writes`);
  if (!/'theme-' \+ ui\.theme/.test(pre)) problems.push("index.html's pre-paint no longer builds 'theme-' + ui.theme");
  if (!/'theme-' \+ theme/.test(viewSrc)) problems.push("applyTheme() no longer builds 'theme-' + theme");
  for (const t of ['dark', 'light']) if (!new RegExp('body\\.theme-' + t + '\\b').test(read('styles.css'))) problems.push(`styles.css has no body.theme-${t} block`);
  contract(`the pre-paint mirror's fields (${[...readFields].join(', ')}) are written by mirrorUi(), and the theme-<name> class is spelled the same in index.html, js/ui.js and styles.css`, problems);
}

// ---------------------------------------------------------------- 22. the seven glyphs copied outside ICONS are byte-for-byte the masters
{
  const problems = [];
  const app = src['js/catalog.js'];
  const block = app.slice(app.indexOf('const ICONS = {'), app.indexOf('\n};', app.indexOf('const ICONS = {')));
  const icons = {}; for (const m of block.matchAll(/^\s+(\w+):\s*'((?:[^'\\]|\\.)*)',?\s*(?:\/\/.*)?$/gm)) icons[m[1]] = m[2];
  const norm = (x) => x.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  const nav = html.slice(html.indexOf('<nav class="bottom-nav"'), html.indexOf('</nav>'));
  const navSvgs = [...nav.matchAll(/<svg[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => m[1]);
  const navOrder = [...nav.matchAll(/data-view="(\w+)"/g)].map((m) => ({ workouts: 'calendar', cardio: 'heartPulse', home: 'home', food: 'utensils', sleep: 'moon' })[m[1]]);
  if (navSvgs.length !== navOrder.length) problems.push(`bottom nav: ${navSvgs.length} svgs for ${navOrder.length} buttons`);
  navOrder.forEach((name, i) => { if (navSvgs[i] != null && norm(navSvgs[i]) !== norm(icons[name] || '')) problems.push(`index.html nav glyph #${i + 1} differs from ICONS.${name}`); });
  const upd = [...src['js/update.js'].matchAll(/<svg[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => m[1]);
  ['refresh', 'arrowUp'].forEach((name, i) => { if (upd[i] == null) problems.push(`update.js has no svg #${i + 1} (expected ICONS.${name})`); else if (norm(upd[i]) !== norm(icons[name] || '')) problems.push(`update.js svg #${i + 1} differs from ICONS.${name}`); });
  contract(`the 7 glyphs duplicated outside ICONS (5 in index.html's nav, 2 in update.js) match their masters`, problems);
}

// ---------------------------------------------------------------- 23. every icon name is an ICONS key (a wrong name renders nothing, silently)
{
  const problems = [];
  const app = src['js/catalog.js'];
  const block = app.slice(app.indexOf('const ICONS = {'), app.indexOf('\n};', app.indexOf('const ICONS = {')));
  const keys = new Set([...block.matchAll(/^\s+(\w+):\s*'/gm)].map((m) => m[1]));
  for (const m of app.matchAll(/^ICONS\.(\w+) = ICONS\.(\w+);/gm)) { if (!keys.has(m[2])) problems.push(`alias ICONS.${m[1]} points at missing ICONS.${m[2]}`); keys.add(m[1]); }
  const used = new Map();
  for (const f of JS) {
    const code = src[f].replace(/\/\/[^\n]*/g, '');
    for (const m of code.matchAll(/\b(?:icon|ic)\(\s*'([A-Za-z][\w]*)'/g)) used.set(m[1], f);
    for (const m of code.matchAll(/\b(?:iconName|icon):\s*'([a-z][A-Za-z0-9]*)'/g)) used.set(m[1], f);
  }
  const opts = src['js/storage.js'].match(/const CARDIO_ICON_OPTIONS = \[([^\]]*)\]/);
  if (opts) for (const m of opts[1].matchAll(/'(\w+)'/g)) used.set(m[1], 'js/storage.js CARDIO_ICON_OPTIONS');
  for (const [name, f] of used) if (!keys.has(name)) problems.push(`${f}: icon '${name}' is not an ICONS key`);
  contract(`every icon name in the scripts (${used.size} names) is one of the ${keys.size} ICONS keys`, problems);
}

// ---------------------------------------------------------------- 24. the Worker's caps and origins fit what the clients send
{
  const vm = require('vm');
  const problems = [];
  const worker = read('backend/worker/gemini-worker.js');
  const textCap = Number((worker.match(/text = String\(body\.text \|\| ''\)\.slice\(0, (\d+)\)/) || [])[1]);
  const promptCap = Number((worker.match(/prompt = String\(body\.prompt \|\| ''\)\.slice\(0, (\d+)\)/) || [])[1]);
  if (!textCap || !promptCap) problems.push(`could not read the Worker's text/prompt caps (${textCap}/${promptCap})`);
  else {
    const fa = src['js/foodai.js'];
    // imagePrompt() with the longest note the input allows, evaluated from the source
    const ip = fa.slice(fa.indexOf('function imagePrompt(note) {'), fa.indexOf('\n  }', fa.indexOf('function imagePrompt(note) {')) + 4);
    const noteMax = Number((fa.match(/ai-note-input[^>]*maxlength="(\d+)"/) || [])[1]) || 400;
    let ipLen = -1; try { ipLen = vm.runInNewContext(ip + '; imagePrompt("x".repeat(' + noteMax + ')).length', {}); } catch (e) { problems.push('could not evaluate imagePrompt(): ' + e.message); }
    const vp = fa.slice(fa.indexOf('const VOICE_PROMPT = ['), fa.indexOf(".join(' ');", fa.indexOf('const VOICE_PROMPT = [')) + 11);
    let vpLen = -1; try { vpLen = vm.runInNewContext(vp + '; VOICE_PROMPT.length', {}); } catch (e) { problems.push('could not evaluate VOICE_PROMPT: ' + e.message); }
    const proxy = fa.slice(fa.indexOf('async function analyzeViaProxy('), fa.indexOf('\n  }', fa.indexOf('async function analyzeViaProxy(')));
    if (!/prompt:\s*String\(text/.test(proxy)) problems.push('foodai.js analyzeViaProxy sends the photo instruction as `text` (capped at ' + textCap + ') instead of `prompt`');
    if (ipLen > promptCap) problems.push(`imagePrompt() with a ${noteMax}-char note is ${ipLen} chars — the Worker keeps ${promptCap} of \`prompt\`; the note (the ground truth) is what gets cut`);
    if (vpLen > promptCap) problems.push(`VOICE_PROMPT is ${vpLen} chars — the Worker keeps ${promptCap} of \`prompt\``);
    // ⚠️ THE CONCATENATION, NOT js/app.js. The recipe batch cap lives inside
    // openRecipeEditor, which moved to js/food.js — and a file-scoped match
    // would have returned undefined, `Number(undefined)` is NaN, `if (batch &&
    // …)` is falsy, and this contract would have printed ✓ while checking
    // nothing. It asserts it FOUND the cap now, so it can never go quiet by
    // losing its file again.
    const batch = Number((JS.map((f) => src[f]).join('\n').match(/len \+ line\.length \+ 1 > (\d+)/) || [])[1]);
    if (!batch) problems.push('no recipe batch cap found in any shipped script — this check has gone silent');
    if (batch && batch > textCap) problems.push(`the recipe auto-fill batches up to ${batch} chars of \`text\`; the Worker keeps ${textCap}`);
    // every port a dev server can listen on is an origin the Worker admits
    const ports = new Set();
    const ds = exists('dev-server.js') ? read('dev-server.js') : ''; const dp = (ds.match(/PORT \|\| (\d+)/) || [])[1]; if (dp) ports.add(dp);
    if (exists('.claude/launch.json')) for (const c of (JSON.parse(read('.claude/launch.json')).configurations || [])) if (c.port) ports.add(String(c.port));
    const allowed = new Set([...(worker.match(/const ALLOWED_ORIGINS = new Set\(\[([\s\S]*?)\]\)/) || ['', ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
    const localRe = (worker.match(/const LOCAL_DEV_ORIGIN = \/(.+)\/;/) || [])[1];
    const admits = (o) => allowed.has(o) || (localRe ? new RegExp(localRe).test(o) : false);
    for (const port of ports) if (!admits('http://localhost:' + port)) problems.push(`a dev server listens on ${port} but the Worker's CORS admits neither http://localhost:${port} nor local origins by pattern — AI calls fail with "Failed to fetch"`);
  }
  contract(`the Worker's caps (text ${textCap}, prompt ${promptCap}) hold the clients' longest instructions, and its CORS admits every dev-server port`, problems);
}

// ---------------------------------------------------------------- 25. .run-nav is emitted once, at the root of the guided screen
// position:sticky can only travel inside its containing block, so the rest bar
// (inserted before .run-nav) and .run-nav itself must be DIRECT children of the
// view. ensureRestBar reports a wrapper at runtime; this refuses it at commit.
{
  const problems = [];
  const lines = src['js/app.js'].split(/\r?\n/);
  const emits = lines.map((l, i) => [l, i + 1]).filter(([l]) => /class="run-nav"/.test(l));
  if (emits.length !== 1) problems.push(`app.js emits class="run-nav" ${emits.length} times (expected 1)`);
  else if (!/^    <div class="run-nav">/.test(emits[0][0])) problems.push(`app.js:${emits[0][1]}: .run-nav is not at the template's root indentation (4 spaces) — a wrapper would be the sticky bar's containing block`);
  const queries = (src['js/app.js'].match(/querySelector\('\.view\.active \.run-nav'\)/g) || []).length;
  if (queries !== 1) problems.push(`app.js queries '.view.active .run-nav' ${queries} times (expected 1: ensureRestBar)`);
  contract('.run-nav is emitted once, as a direct child of the guided view, and queried from one place', problems);
}

// ---------------------------------------------------------------- 26. app.js checks a later module before using it, and never on a boot timer
{
  const problems = [];
  // ⚠️ EVERY SCRIPT THAT LOADS BEFORE THE MODULES, and each line keeps its own
  // FILE. v359 widened this scan from app.js to a concatenation but left the
  // message saying `app.js:${i + 1}` — so a real unguarded call in js/food.js
  // would have been reported at a line number in a file that does not have it.
  // The check was right and the report was a wild goose chase.
  const lines = EARLY.flatMap((f) => src[f].split(/\r?\n/).map((text, i) => [f, i + 1, text]));
  const mods = ['Notify', 'Health', 'FoodAI', 'VaultUpdate'];
  for (const mod of mods) {
    const guard = new RegExp('window\\.' + mod + '\\b|typeof ' + mod + '\\b');
    lines.forEach(([file, no, text], i) => {
      const code = text.replace(/\/\/.*$/, '');
      if (!new RegExp('\\b' + mod + '\\.').test(code) || guard.test(code)) return;
      const back = lines.slice(Math.max(0, i - 20), i).filter(([f]) => f === file).map(([, , x]) => x).join('\n');
      if (!guard.test(back)) problems.push(`${file}:${no}: uses ${mod}. with no window.${mod} / typeof ${mod} check on the line or within the 20 lines above`);
    });
  }
  // the init IIFE: no timer armed at evaluation time may be the thing that waits for a later script
  const init = src['js/app.js'].slice(src['js/app.js'].indexOf('(function init() {'));
  for (const m of init.matchAll(/setTimeout\(\(\) => \{([\s\S]*?)\n  \}, (\d+)\);/g)) if (Number(m[2]) >= 1000 && new RegExp('\\b(' + mods.join('|') + ')\\.').test(m[1])) problems.push(`init(): a ${m[2]} ms timer armed during app.js's evaluation is what reaches ${mods.find((x) => m[1].includes(x + '.'))}. — gate it on afterScripts() instead`);
  contract('app.js checks a later module (Notify/Health/FoodAI/VaultUpdate) before using it, and init() reaches none of them from a timer', problems);
}

// ---------------------------------------------------------------- 27. the catalog tables pullCatalog reads while logged out are anon-readable
{
  const problems = [];
  const dir = path.join(root, 'backend/migrations');
  const anonGrant = {}, anonPolicy = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(/\b(grant|revoke)\s+(?:all|select)(?:\s+privileges)?\s+on\s+(?:table\s+)?public\.(\w+)\s+(?:to|from)\s+([^;]+);/gi)) if (/\banon\b/.test(m[3])) anonGrant[m[2].toLowerCase()] = m[1].toLowerCase() === 'grant';
    for (const m of sql.matchAll(/create policy\s+\S+\s+on\s+public\.(\w+)[\s\S]*?for\s+select\s+to\s+([^\n]+)/gi)) anonPolicy[m[1].toLowerCase()] = /\banon\b/.test(m[2]);
  }
  const c = src['js/cloud.js'];
  const start = c.indexOf('async function pullCatalog()');
  const endRel = c.slice(start).search(/\r?\n  \}\r?\n/);
  const body = endRel < 0 ? '' : c.slice(start, start + endRel);
  if (!body) problems.push('cloud.js: could not delimit pullCatalog()');
  let guarded = '';
  const gi = body.indexOf('if (signedIn) {');
  if (gi >= 0) { let d = 0; for (let i = body.indexOf('{', gi); i < body.length; i++) { if (body[i] === '{') d++; else if (body[i] === '}') { d--; if (!d) { guarded = body.slice(gi, i + 1); break; } } } }
  const open = body.replace(guarded, '');
  for (const m of open.matchAll(/\.from\('(\w+)'\)/g)) if (!anonGrant[m[1]] || !anonPolicy[m[1]]) problems.push(`pullCatalog reads '${m[1]}' without a session, but the migrations give anon ${anonGrant[m[1]] ? 'a grant' : 'no grant'} and ${anonPolicy[m[1]] ? 'a select policy' : 'no select policy'} on it — the read fails on every logged-out boot`);
  contract('every table pullCatalog() reads without a session is anon-readable after the migrations; the rest wait for one', problems);
}

// ---------------------------------------------------------------- 28. a function locked against anon/PUBLIC stays locked
// Postgres grants EXECUTE on a NEW function to PUBLIC, and DROP discards the
// ACL — so `drop function f(); create function f()` silently undoes a revoke
// made three migrations earlier. That happened: 19 re-created admin_user_stats
// that way and handed anon EXECUTE back (the is_admin() gate still raised, so
// nothing was exposed) until 23 re-issued the revoke. Replayed in order, every
// function that was ever locked must still be locked at the end.
{
  const dir = path.join(root, 'backend/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const locked = {};      // fn → true (revoked from anon/PUBLIC) | false (ACL discarded since)
  const everLocked = {};  // fn → the file that first locked it
  const openedBy = {};    // fn → the file that discarded its ACL
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
    const events = [];
    // a revoke naming anon or public — 'revoke all on function f(...) from public, anon'
    for (const m of sql.matchAll(/revoke\s+(?:all|execute)[\s\S]{0,40}?on function\s+(?:public\.)?(\w+)\s*\(([^)]*)\)\s*from\s+([^;]+);/gi)) if (/\b(anon|public)\b/i.test(m[3])) events.push([m.index, m[1].toLowerCase(), 'lock']);
    // anything that gives the function a FRESH acl: a drop, or a create that is not OR REPLACE
    for (const m of sql.matchAll(/drop function(?: if exists)?\s+(?:public\.)?(\w+)\s*\(/gi)) events.push([m.index, m[1].toLowerCase(), 'open']);
    for (const m of sql.matchAll(/create function\s+(?:public\.)?(\w+)\s*\(/gi)) events.push([m.index, m[1].toLowerCase(), 'open']);
    events.sort((a, b) => a[0] - b[0]);
    for (const [, fn, kind] of events) {
      if (kind === 'lock') { locked[fn] = true; if (!everLocked[fn]) everLocked[fn] = f; }
      else if (everLocked[fn] && locked[fn]) { locked[fn] = false; openedBy[fn] = f; }
      else if (everLocked[fn]) openedBy[fn] = f;
    }
  }
  const problems = [];
  for (const fn of Object.keys(everLocked)) if (!locked[fn]) problems.push(`${fn}(): ${everLocked[fn]} revoked EXECUTE from anon/PUBLIC, then ${openedBy[fn]} dropped or re-created it without re-issuing the revoke — Postgres hands EXECUTE back to PUBLIC on the new function`);
  contract(`every function ever locked against anon/PUBLIC is still locked after the replay (${Object.keys(everLocked).length} functions)`, problems);
}

// ---------------------------------------------------------------- 29. the CSP covers every origin the code reaches
// A Content-Security-Policy that is missing an origin does not warn: the
// request is simply blocked, and on this app that means fonts, exercise
// photos, barcodes or the AI silently stop working for everyone at once. The
// four pages must also carry the SAME policy, or hardening one page while
// leaving another open is indistinguishable from having done the work.
{
  const problems = [];
  const PAGES = ['index.html', 'admin.html', 'privacy.html', 'get/index.html'];
  const policies = {};
  for (const f of PAGES) {
    const m = read(f).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    if (!m) { problems.push(`${f} has no Content-Security-Policy meta`); continue; }
    policies[f] = m[1];
  }
  const values = [...new Set(Object.values(policies))];
  if (values.length > 1) problems.push('the four pages carry ' + values.length + ' different policies; they must be identical');
  const csp = values[0] || '';
  const directive = (name) => {
    const d = csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(name + ' '));
    return d ? d.slice(name.length + 1).split(/\s+/) : [];
  };
  if (csp) {
    // frame-ancestors is IGNORED in a meta tag — its presence would be a lie
    if (/frame-ancestors/.test(csp)) problems.push("the meta CSP names frame-ancestors, which browsers ignore there — it needs a real header");
    for (const d of ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src', 'font-src', 'object-src', 'base-uri', 'form-action']) {
      if (!directive(d).length) problems.push(`the CSP has no ${d}`);
    }
    if (!directive('object-src').includes("'none'")) problems.push("object-src must be 'none'");
    // every origin the code actually reaches must be allowed SOMEWHERE in the policy
    const sources = [...JS.map((f) => src[f]), html, admin, read('privacy.html'), read('get/index.html')].join('\n');
    const used = new Set();
    for (const m of sources.matchAll(/https:\/\/([a-z0-9.-]+)/gi)) used.add('https://' + m[1].toLowerCase());
    const selfHosts = new Set(['https://moathdarweesh.github.io']);   // 'self' covers the site's own origin
    const allowed = new Set(csp.split(/[;\s]+/).filter((x) => x.startsWith('https://')));
    for (const u of used) {
      if (selfHosts.has(u) || allowed.has(u)) continue;
      // a host named only inside a comment or a store URL is not a fetch target;
      // require it to appear on a line that actually loads or connects
      const re = new RegExp('(?:src|href|fetch\\(|PROXY_URL|SUPABASE_URL|REMOTE)[^\\n]{0,80}' + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (re.test(sources)) problems.push(`the code loads from ${u} but the CSP does not allow it — the request will be blocked with no error`);
    }
  }
  contract(`the four pages carry one Content-Security-Policy, and it allows every origin the code loads from`, problems);
}

// ---------------------------------------------------------------- 30. error strings crossing a language boundary
// A message raised in SQL or returned by the Worker, and matched by a regex in
// JS, is an agreement between two files nothing else keeps. Reword one side and
// every check still passes while the app quietly degrades to a generic error —
// the failure the project's own rule exists to prevent ("when a review finds a
// 'must match' comment, add a contract"). Both directions are checked.
{
  const problems = [];
  const dir = path.join(root, 'backend/migrations');
  // Only the SURVIVING definition of each function counts: an older migration
  // still carrying the old wording must not satisfy the check for a body that
  // has since been replaced.
  const bodies = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of text.matchAll(/create(?: or replace)? function\s+(?:public\.)?(\w+)\s*\([\s\S]*?\$\$([\s\S]*?)\$\$/gi)) bodies[m[1].toLowerCase()] = m[2];
  }
  const sql = Object.values(bodies).join('\n');
  const js = JS.map((f) => src[f]).join('\n');
  const worker = exists('backend/worker/gemini-worker.js') ? read('backend/worker/gemini-worker.js') : '';

  // (a) a JS regex tested against a database error message must name a string
  //     some migration actually raises
  let checkedSql = 0;
  for (const f of JS) {
    for (const m of src[f].matchAll(/\/([a-z][a-z ]{4,60}?)\/i\.test\(\s*(?:\(?\s*)?(?:error|err|e)\s*(?:&&|\?|\.)[^)]*message/gi)) {
      checkedSql++;
      const lit = m[1];
      if (!new RegExp("raise exception '" + lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'").test(sql)) {
        problems.push(`${f} matches a database error /${lit}/i, but no migration raises exactly that string`);
      }
    }
  }

  // (b) every `code:` the Worker returns is a code the client tests for, and
  //     every code the client tests for is one the Worker can send
  const workerCodes = new Set([...worker.matchAll(/code:\s*'([A-Z_]+)'/g)].map((m) => m[1]));
  const clientCodes = new Set([...js.matchAll(/data\.code === '([A-Z_]+)'/g)].map((m) => m[1]));
  for (const c of workerCodes) if (!clientCodes.has(c)) problems.push(`the Worker can return code '${c}' but no client path tests for it — the user gets a generic message`);
  for (const c of clientCodes) if (workerCodes.size && !workerCodes.has(c)) problems.push(`a client tests for code '${c}', which the Worker never sends`);

  contract(`error strings cross the SQL/JS and Worker/JS boundaries intact (${checkedSql} database matches, ${workerCodes.size} Worker codes)`, problems);
}

// ---------------------------------------------------------------- 33. the vendored libraries are the ones we say they are
// Two third-party bundles execute with full privileges in this app`s own
// origin, with access to the localStorage the session token lives in — and
// until js/vendor/SOURCES.md existed, NOTHING in this repo recorded which
// version either one was. No filename version, no package.json entry, no note
// in the commit that added them. "Is the library in my app clean?" was not
// "probably yes", it was unanswerable.
//
// SOURCES.md records the package, the exact version, the upstream URL and the
// SHA-256 of the published artifact each file was proved byte-identical to.
// This recomputes those hashes from the bytes on disk, the way contract 32
// does for the APK — a hash that does not match its file is WORSE than no
// hash, because it tells the reader a tampered file is genuine. It also
// refuses a new file in js/vendor/ with no block here, so a third library
// cannot arrive unrecorded.
{
  const problems = [];
  const dir = path.join(root, 'js/vendor');
  const docRel = 'js/vendor/SOURCES.md';
  let recorded = 0;
  if (!exists(docRel)) {
    problems.push(`${docRel} is missing — nothing records what the vendored libraries are`);
  } else {
    const doc = read(docRel);
    const rows = new Map();
    for (const m of doc.matchAll(/^file:\s+(\S+)[^\S\n]*\r?\n\s*sha256:\s+([0-9a-f]{64})\s*$/gm)) rows.set(m[1], m[2]);
    recorded = rows.size;
    // every recorded file must exist and still hash to what is written down
    for (const [rel, want] of rows) {
      if (!exists(rel)) { problems.push(`${docRel} records ${rel}, which does not exist`); continue; }
      const got = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
      if (got !== want) problems.push(`${rel} has changed: ${docRel} says ${want.slice(0, 16)}… but the file hashes to ${got.slice(0, 16)}… — replace the library AND its block in the same commit`);
    }
    // …and every shipped file in the folder must be recorded
    for (const f of fs.readdirSync(dir).filter((f) => !f.endsWith('.md'))) {
      if (!rows.has('js/vendor/' + f)) problems.push(`js/vendor/${f} ships to every device and ${docRel} does not say what it is`);
    }
  }
  contract(`the vendored libraries hash to what js/vendor/SOURCES.md says they are (${recorded} recorded)`, problems);
}

// ---------------------------------------------------------------- 34. no top-level name is declared in two shipped scripts
// The shipped files are CLASSIC scripts sharing one global lexical scope.
// A top-level `const`/`let`/`class` declared in two of them is a SyntaxError
// ("Identifier has already been declared") that stops the SECOND file from
// executing at all — a blank app, with the error only in a console nobody on
// a phone will open. A duplicate `function`/`var` is quieter and worse: the
// later one silently replaces the earlier. ESLint is per-file and cannot see
// this; eslint.config.js derives the shared surface from the same scan.
{
  const problems = [];
  const TOP = TOP_LEVEL;
  const owner = new Map();
  for (const f of JS) {
    for (const line of src[f].split(/\r?\n/)) {
      if (line[0] === ' ' || line[0] === '\t') continue;
      const m = TOP.exec(line);
      if (!m) continue;
      const prev = owner.get(m[1]);
      if (prev && prev !== f) problems.push(`\`${m[1]}\` is declared at top level in both ${prev} and ${f} — a SyntaxError that blanks the app for a const/let/class, a silent override for a function/var`);
      else owner.set(m[1], f);
    }
  }
  contract(`no top-level identifier is declared in two shipped scripts (${owner.size} names across ${JS.length} files)`, problems);
}

// ---------------------------------------------------------------- 35. every var(--x) names a custom property that is defined
// A CSS variable that does not exist FAILS SILENTLY: the declaration is
// dropped and the element inherits. v314 shipped `--text-muted` (the token is
// `--text-mute`) in two rules, so every field caption in four sheets painted at
// full `--text` and the screens read as "crowded" — invisible to every test,
// found by reading the stylesheet. Definitions are collected from everywhere a
// property can be set (the stylesheet, the inline <style> of each page, JS
// template strings, and setProperty calls); every use must name one of them.
{
  const problems = [];
  const PAGES = ['index.html', 'admin.html', 'privacy.html', 'get/index.html'];
  const cssSources = ['styles.css', ...PAGES];
  const defined = new Set();
  const defRe = /(--[a-z][a-z0-9-]*)\s*:/g;
  for (const f of [...cssSources, ...JS]) {
    const text = f === 'styles.css' ? read(f) : src[f] || read(f);
    for (const m of text.matchAll(defRe)) defined.add(m[1]);
    for (const m of text.matchAll(/setProperty\(\s*['"](--[a-z][a-z0-9-]*)['"]/g)) defined.add(m[1]);
  }
  const used = new Map();
  for (const f of [...cssSources, ...JS]) {
    const text = f === 'styles.css' ? read(f) : src[f] || read(f);
    for (const m of text.matchAll(/var\(\s*(--[a-z][a-z0-9-]*)/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(f);
    }
  }
  for (const [name, files] of used) {
    if (!defined.has(name)) problems.push(`var(${name}) is used in ${[...files].join(', ')} but no stylesheet, page or script ever defines it — the declaration is silently dropped`);
  }
  contract(`every var(--x) in the stylesheet, the pages and the scripts names a defined custom property (${used.size} used, ${defined.size} defined)`, problems);
}

// ---------------------------------------------------------------- 36. every sheet is inside the fingerprint net, or named as left out
// The views lane navigates VIEWS; most of what the food domain does lives in
// SHEETS, and a moved sheet that broke would pass a views-only net. So
// scripts/fp/modals.js lists every top-level open*() in app.js plus the five
// dialogs, and anything left out is in its SKIP map WITH A REASON. This is the
// same shape as contract 32 for views: "the net is green" must not quietly
// become "the net is green over the sheets someone remembered to list". The
// reverse is checked too — an entry naming a function that no longer exists
// is the test-convenience-ui.js failure this project has recorded three times.
{
  const problems = [];
  const { ENTRIES, SKIP } = require('./fp/modals.js');
  // EVERY view script, derived — not app.js, and not the hand-written pair that
  // v359 left here. openModal() and openImageLightbox() both moved to js/ui.js,
  // and a scan that still named two files would have called them "not a
  // top-level sheet any more": a loud failure with the wrong diagnosis, for the
  // second release running. It is read from VIEWS now and cannot happen again.
  const app = VIEWS.map((f) => src[f]).join('\n');
  const openers = new Set([...app.matchAll(/^(?:async )?function (open[A-Z]\w*)\(/gm)].map((m) => m[1]));
  for (const d of ['confirmDialog', 'showUnreadableDialog', 'showConflictDialog', 'showChangePassword', 'showFeedback']) openers.add(d);
  const covered = new Set(ENTRIES.map((e) => e.name));
  for (const name of openers) {
    if (!covered.has(name) && !(name in SKIP)) problems.push(`${name}() is a sheet in the view scripts that scripts/fp/modals.js neither captures nor names in SKIP with a reason`);
  }
  for (const name of [...covered, ...Object.keys(SKIP)]) {
    if (!openers.has(name)) problems.push(`scripts/fp/modals.js names ${name}(), which is not a top-level sheet in any view script any more`);
  }
  const ids = ENTRIES.map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) problems.push(`duplicate entry id(s) in scripts/fp/modals.js: ${[...new Set(dup)].join(', ')}`);
  contract(`every sheet in js/app.js is captured by the fingerprint net or named in its SKIP map with a reason (${ENTRIES.length} entries over ${covered.size} sheets, ${Object.keys(SKIP).length} skipped)`, problems);
}

// ---------------------------------------------------------------- 37. no page slices a calendar day off a timestamp
// `String(ts).slice(0,10)` reads the UTC day - yesterday for every UTC+ user
// before 03:00, the sixth appearance of this bug class. The lint rule catches it
// in js/*.js and does not read the pages; admin.html had FOUR. Every page has a
// local-day helper now, so a new slice is a regression wherever it appears.
{
  const problems = [];
  const PAGES = ['index.html', 'admin.html', 'privacy.html', 'get/index.html'];
  let scanned = 0;
  for (const p of PAGES) {
    read(p).split(/\r?\n/).forEach((raw, i) => {
      scanned++;
      // A WHOLE-LINE COMMENT IS NOT CODE. The first run of this contract flagged
      // the comment above dayOf() for quoting the very pattern it warns about —
      // the v333 trap, where a name that appears only inside a REMOVAL comment
      // reads as live. Stripped the way contract 26 strips, and only when the
      // slashes OPEN the line, so a https:// URL is never cut in half.
      const line = raw.replace(/^\s*\/\/.*$/, '');
      if (/\.slice\(\s*0\s*,\s*10\s*\)|\.substring\(\s*0\s*,\s*10\s*\)|\.split\(\s*['\"]T['\"]\s*\)\s*\[\s*0\s*\]/.test(line)) {
        problems.push(`${p}:${i + 1} slices a calendar day off a timestamp - use the page's local-day helper (dayOf)`);
      }
    });
  }
  contract(`no page slices a calendar day off a timestamp (${scanned} lines over ${PAGES.length} pages)`, problems);
}

// ---------------------------------------------------------------- 38. every dictionary key is reachable — contract 5 inverted
// Contract 5 proves every t() call has a key. This proves every key has a
// caller, and nothing did: fifteen keys had outlived their screens, one of them
// («no_cardio») for so long that a survey missed it because a LONGER live key
// (`ledger_no_cardio`) contained its name.
//
// THREE TRAPS, each one measured while this was written:
//   · a SUBSTRING test is green by construction — `no_cardio` passes it on the
//     strength of `ledger_no_cardio`. A reference is a WHOLE QUOTED LITERAL.
//   · the quote style is not uniform: `cx_tools` was the one double-quoted
//     entry in the file, and a single-quote pattern silently left it behind.
//   · the dynamic families are not all spelled t('x' + y) — js/foodai.js uses
//     tr('ai_nut_' + k), and a scanner that matches only `t(` reports two live
//     keys as dead and fails CLOSED on a good commit.
//
// UNREFERENCED is deliberately allowed when it is a DECISION: add the key to
// KEPT below with the reason, the way fp/modals.js names its SKIPs. An empty
// KEPT is the healthy state and is where this ships.
{
  const problems = [];
  const KEPT = {
    // key: why it stays although nothing references it
  };
  const dict = src['js/i18n.js'];
  // every `name:` that opens a quoted value, wherever it sits on the line
  const keys = new Set([...dict.matchAll(/(?:^|[{,]\s*)\s*([a-z][a-z0-9_]*)\s*:\s*['"`]/gm)].map((m) => m[1]));
  const corpus = [...JS.filter((f) => f !== 'js/i18n.js').map((f) => src[f]), ...PAGE_FILES.map((p) => read(p))].join('\n');
  // the prefix families, rediscovered from the corpus rather than hard-coded
  const fams = [...new Set([...corpus.matchAll(/\b(?:t|tr|F)\(\s*'([A-Za-z0-9_]*)'\s*\+/g)].map((m) => m[1]).filter(Boolean))];  for (const k of keys) {
    if (fams.some((p) => k.startsWith(p))) continue;
    if (new RegExp('([\'"`])' + k + '\\1|data-t="' + k + '"').test(corpus)) continue;
    if (k in KEPT) continue;    problems.push(`js/i18n.js defines \`${k}\` and nothing references it — delete it from BOTH dictionaries, or add it to this contract's KEPT map with the reason`);
  }
  contract(`every dictionary key is reachable (${keys.size} keys, ${fams.length} prefix families, ${Object.keys(KEPT).length} kept by decision)`, problems);
}


// ---------------------------------------------------------------- 39. js/ui.js is the floor, and stays the floor
// A file called "the shared primitives" is a WISH until something refuses the
// first primitive that reaches upward. The moment one does — a formatter that
// reads a workout, a sheet that calls navigate() — js/ui.js stops being the
// bottom of the graph and becomes a second app.js with a smaller name, and the
// whole reason for the split is gone. Nothing announces that; it just happens,
// one convenient line at a time.
//
// ⚠️ DB.prefs IS ALLOWED AND THE REST OF DB IS NOT, and that line is measured,
// not chosen. t() — the most-called name in the app — reads
// DB.prefs.get().lang, and every weight formatter reads DB.prefs.get().unit;
// unit and language ARE presentation. User DATA is what must never be reachable
// from here. "No DB at all" would have been the tidier sentence and a false
// one, and a rule known to be false is a rule people route around.
//
// The second half is the inverse: VIEWS must name real, shipped scripts. It is
// a positive list now (scripts/shipped.js), and a positive list can name a file
// that no longer ships — which would silently shrink every check derived from
// it, contracts 26 and 36 and the ESLint DB.* law included.
{
  const problems = [];
  const FORBIDDEN = [
    [/\bDB\s*\.\s*(?!prefs\b)(\w+)/, (m) => `reads DB.${m[1]} — js/ui.js may touch DB.prefs and nothing else of DB`],
    [/\bCloud\s*\./, () => 'reaches Cloud — the network is not a presentation concern'],
    [/\b(Health|Notify|FoodAI|VaultUpdate)\s*\./, (m) => `reaches ${m[1]}. — a module that loads AFTER it`],
    [/\bnavigate\s*\(/, () => 'calls navigate() — routing is the shell\'s job, not the vocabulary\'s'],
    [/\brenderView\s*\(/, () => 'calls renderView() — deciding to repaint is the shell\'s job'],
    [/\blocalStorage\b/, () => 'touches localStorage directly — every store goes through DB'],
  ];
  const lines = src['js/ui.js'].split(/\r?\n/);
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const [re, say] of FORBIDDEN) {
      const m = re.exec(code);
      if (m) problems.push(`js/ui.js:${i + 1}: ${say(m)}`);
    }
  });
  // …and no primitive may be dead. The corpus is EVERY shipped script WITH
  // js/ui.js's own body in it, minus the declaration lines themselves — the
  // first spelling of this asked only whether the scripts ABOVE used each name,
  // and called THEMES, THEME_ALIAS, toastTimeout and formatDelta dead when all
  // four are used by their neighbours inside this very file. A liveness check
  // that reads the wrong corpus does not under-report; it accuses.
  const uiLines = src['js/ui.js'].split(/\r?\n/);
  const declared = [];
  const body = [];
  uiLines.forEach((line) => {
    const m = TOP_LEVEL.exec(line);
    if (m) { declared.push(m[1]); body.push(line.slice(line.indexOf(m[1]) + m[1].length)); } else body.push(line);
  });
  const above = JS.filter((f) => f !== 'js/ui.js').map((f) => src[f]).concat(body.join('\n')).join('\n');
  for (const n of declared) {
    if (n.startsWith('__')) continue;   // openModal's own state, private by name
    // An IDENTIFIER boundary, not \b: `$` and `$$` are not word characters, so
    // \b never matches beside them and the two most-used primitives in the file
    // would have been reported dead.
    const used = new RegExp('(?:^|[^\\w$])' + n.replace(/\$/g, '\\$') + '(?![\\w$])');
    if (!used.test(above)) problems.push(`js/ui.js declares \`${n}\` and no view script uses it — a primitive with no caller is dead code in the one file that must stay small`);
  }
  for (const f of VIEWS) if (!JS.includes(f)) problems.push(`scripts/shipped.js lists ${f} in VIEWS, but it is not one of the ${JS.length} shipped scripts`);
  contract(`js/ui.js reaches no DB but DB.prefs, no Cloud, no module and no router, and every one of its ${declared.length} names has a caller above it`, problems);
}

// ---------------------------------------------------------------- 40. DB.widget talks to a plugin that exists, by a name it answers to
{
  // The web half and the native half of the widget are two files with no
  // compiler between them, and BOTH halves of the agreement fail SILENTLY.
  //
  //   the NAME    — `Capacitor.Plugins.WidgetBridge` vs @CapacitorPlugin(name)
  //                 A rename on either side makes _plugin() return null, and
  //                 push() is DOCUMENTED to return false when there is no
  //                 plugin. So the widget simply stops updating, for ever,
  //                 and nothing reports it because that IS the no-APK path.
  //
  //   the METHODS — P.set / P.clear vs @PluginMethod
  //                 A Capacitor call rejects ASYNCHRONOUSLY, so the
  //                 synchronous try/catch around it cannot see the failure:
  //                 clear() returns true having cleared nothing. That is the
  //                 shared-phone leak DB.widget.clear() exists to prevent,
  //                 on the least private surface the device has.
  const KT = 'android/app/src/main/java/com/moath/thevault/WidgetBridgePlugin.kt';
  const kt = exists(KT) ? read(KT) : '';
  const js = src['js/storage.js'];
  const calls = new Set([...js.matchAll(/\bP\.(\w+)\s*\(/g)].map((m) => m[1]));
  const problems = [];
  let methods = new Set();
  if (kt) {
    const named = kt.match(/@CapacitorPlugin\s*\(\s*name\s*=\s*"(\w+)"/);
    const reached = js.match(/Capacitor\.Plugins\.(\w+)\)?\s*\|\|\s*null/);
    if (!named) problems.push(`${KT} carries no @CapacitorPlugin(name = "...")`);
    if (!reached) problems.push('js/storage.js no longer reaches the widget plugin through Capacitor.Plugins.<name>');
    if (named && reached && named[1] !== reached[1]) {
      problems.push(`js/storage.js asks for Capacitor.Plugins.${reached[1]} but the Kotlin registers "${named[1]}" - the widget would silently never update`);
    }
    methods = new Set([...kt.matchAll(/^[^\S\r\n]*@PluginMethod\s*\r?\n\s*fun\s+(\w+)\s*\(/gm)].map((m) => m[1]));
    for (const c of calls) {
      if (!methods.has(c)) problems.push(`js/storage.js calls P.${c}() but ${KT} has no @PluginMethod ${c} - the call rejects asynchronously and the sync try/catch reports success`);
    }
  }
  contract(`DB.widget reaches the native plugin by the name it registers, and calls only @PluginMethods it declares (${calls.size} calls, ${methods.size} declared)`, problems);
}

console.log(failures.length ? `\ncheck-contracts: ${failures.length} broken contract(s)` : '\ncheck-contracts: all contracts hold');
process.exit(failures.length ? 1 : 0);
