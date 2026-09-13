#!/usr/bin/env node
/**
 * Enrich graphify-out/graph.json: give every node a TYPE, and every community a
 * plain-language NAME. Re-runnable — the post-commit hook rebuilds the graph
 * from scratch, so anything hand-made has to be re-appliable or it rots.
 *
 * WHY THIS EXISTS (measured on the shipped graph before it was written):
 *   - 99.8% of nodes had `type: null`, so nothing could tell a SQL trigger from
 *     a doc heading from a JS function.
 *   - 12 of the 97 file-naming community labels pointed at a file containing
 *     NONE of that community's nodes. 95 echoed a filename, 29 repeated the
 *     same name twice, 38 ran past five words, 8 were truncated mid-paren.
 *
 * ⚠️ COMMUNITY IDS ARE NOT STABLE. Louvain renumbers on every reclustering, so
 * a name keyed on the id is wrong after the next rebuild — which is exactly what
 * happened the first time this was done. Names are keyed on a SIGNATURE derived
 * from the community's own content: its dominant source file plus its
 * highest-degree member. Both are properties of the code, not of the run.
 */
const fs = require('fs');
const path = require('path');

const GRAPH = path.resolve(__dirname, '..', 'graphify-out', 'graph.json');
const LABELS = path.resolve(__dirname, '..', 'graphify-out', '.graphify_labels.json');
if (!fs.existsSync(GRAPH)) { console.error('no graphify-out/graph.json — build the graph first'); process.exit(1); }

const g = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));
const base = (p) => String(p || '').replace(/\\/g, '/').split('/').pop();
const ext = (p) => (base(p).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();

// ---------------------------------------------------------------- node types
function deriveType(n) {
  const label = String(n.label || '');
  const file = String(n.source_file || '').replace(/\\/g, '/');
  const e = ext(file);
  if (label === base(file) || label === file) return 'file';
  if (/^public\./.test(label)) return /\(\)$/.test(label) ? 'sql-function' : 'sql-table';
  if (/^trg_/.test(label)) return 'sql-trigger';
  if (e === 'sql') return 'sql-object';
  if (e === 'md') return 'doc';                       // every node in a .md is a heading
  if (e === 'json' || e === 'gradle' || /\.(properties|ya?ml|toml)$/.test(file)) return 'config';
  if (e === 'sh' || /^(post-commit|post-checkout|pre-commit)/.test(label)) return 'script';
  if (e === 'kt' || e === 'java' || e === 'swift') return (/^\.|\(\)$/.test(label)) ? 'method' : 'class';
  if (e === 'html') return 'ui';
  if (/^(DB|Cloud|Notify|Health|FoodAI|VaultUpdate)\b/.test(label)) return /\(\)$/.test(label) ? 'api-method' : 'api';
  if (/\(\)$/.test(label)) return /\./.test(label) ? 'method' : 'function';
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(label)) return 'constant';
  return 'symbol';
}

// ------------------------------------------------------- community signatures
const by = new Map();
for (const n of g.nodes) { const c = String(n.community); if (!by.has(c)) by.set(c, []); by.get(c).push(n); }
const deg = new Map();
for (const e of g.links) { deg.set(e.source, (deg.get(e.source) || 0) + 1); deg.set(e.target, (deg.get(e.target) || 0) + 1); }

function signature(members) {
  const f = {};
  for (const m of members) { const b = base(m.source_file); if (b) f[b] = (f[b] || 0) + 1; }
  const dom = Object.entries(f).sort((a, b) => b[1] - a[1])[0];
  const top = members.slice().sort((a, b) => (deg.get(b.id) || 0) - (deg.get(a.id) || 0))[0];
  return { file: dom ? dom[0] : '', top: top ? String(top.label) : '' };
}

// Hand-authored, keyed "<dominant file>::<top-degree member>".
const NAMES = {
  'cloud.js::Cloud': 'Cloud Auth & Account',
  'cloud.js::cloud.js': 'Cloud Sync & Auth',
  'cloud.js::bootSyncCoreUnguarded()': 'Boot Sync & Conflicts',
  'cloud.js::restoreRecovery()': 'Password Recovery',
  'app.js::app.js': 'App Shell & Guided Run',
  'app.js::t()': 'UI Primitives & Modals',
  'app.js::renderHome()': 'Home, Calendar & Streaks',
  'app.js::showToast()': 'Home & Program Screens',
  'app.js::openUnifiedSearch()': 'Food Pickers & Recipes',
  'app.js::escapeHtml()': 'Food & Notification Views',
  'app.js::DB': 'Sleep Tracking Views',
  'app.js::showConflictDialog()': 'Sync Conflict Dialog',
  'app.js::ntfMount()': 'In-App Notification Bar',
  'app.js::bootCatalog()': 'Global Catalog Boot',
  'storage.js::storage.js': 'Local Storage Layer',
  'storage.js::DB.notif': 'Notifications Engine',
  'storage.js::DB.prefs': 'Language, Units & Targets',
  'storage.js::DB.plan': 'Plan Rotation API',
  'storage.js::DB.cardioPlan': 'Cardio Plan & Types API',
  'storage.js::DB.sessions': 'Sessions & Personal Records',
  'storage.js::DB.exercises': 'Exercise Catalog API',
  'storage.js::DB.mealBundles': 'Saved Meals API',
  'storage.js::openShoppingList()': 'Search, Sessions & Shopping',
  'storage.js::openSupplementModal()': 'Supplements',
  'storage.js::defaultState()': 'Blob Shape & Defaults',
  'storage.js::loadState()': 'Blob Load & Migration',
  'storage.js::uid()': 'Ids & Date Helpers',
  'storage.js::defineImgAccessor()': 'Exercise Photo Side Store',
  'storage.js::clearLocalUserData()': 'Local Data Teardown',
  'storage.js::sync()': 'Reminder Scheduling',
  'storage.js::bindListeners()': 'Notification Listeners',
  'health.js::health.js': 'Health Connect Sync',
  'notify.js::notify.js': 'Notification Delivery',
  'notify.js::catchUp()': 'Reminder Catch-Up',
  'foodai.js::foodai.js': 'AI Food Analysis',
  'update.js::update.js': 'Update Checker & Banners',
  'gemini-worker.js::gemini-worker.js': 'Gemini Worker (Cloudflare)',
  'admin.html::renderDetail (user detail overlay)': 'Admin User Management',
  'admin.html::showCenter (centre router)': 'Admin Shell & Navigation',
  'admin.html::is_admin-gated SECURITY DEFINER RPC write path': 'Admin Catalog CRUD',
  'admin.html::loadAll (global data load + aggregation)': 'Admin Dashboard & Export',
  'privacy.html::THE VAULT Privacy Policy': 'Privacy Policy & Admin Gate',
  'icon.svg::Solid V Letterform Mark': 'App Icon Artwork',
  'manifest.json::manifest.json': 'PWA Manifest',
  'package.json::scripts': 'Capacitor Dependencies',
  'dev-server.js::dev-server.js': 'Dev Server',
  'AppDelegate.swift::AppDelegate': 'iOS App Delegate',
  'MainActivity.java::MainActivity': 'Android MainActivity',
  'HealthConnectPlugin.kt::HealthConnectPlugin': 'Health Connect Plugin (Kotlin)',
  'PermissionsRationaleActivity.kt::PermissionsRationaleActivity': 'Health Rationale Activity',
  'CLAUDE.md::js/storage.js (the DB.* API)': 'Project Guide — Core Files',
  'CLAUDE.md::js/tables.js (the one-way mirror)': 'Project Guide — Backend Files',
  'CLAUDE.md::js/update.js (update checker)': 'Live-URL Distribution',
  'LLD.md::THE VAULT — Low-Level Design': 'Low-Level Design Overview',
  'BRAND.md::THE VAULT — Brand & Design System': 'Brand & Design System',
  'BRAND.md::1. The mark — THE CUT': 'The Mark — THE CUT',
  'README.md::README.md': 'Repository README Set',
  'README.md::Cloudflare Worker Calorie Proxy': 'Worker Proxy & Quota',
  'AUTOMATION.md::الأتمتة في THE VAULT — دليل مختصر': 'Automation Guide (Arabic)',
  'schema-v2-draft.sql::schema-v2-draft.sql': 'Schema v2 Draft (archived)',
  '02_schema-v2.sql::02_schema-v2.sql': 'Live Schema v2 Tables',
  '07_admin-write-v4.sql::07_admin-write-v4.sql': 'Admin Write RPCs & Audit',
  'USER_CONVENIENCE_ROADMAP_AR.md::خطة تحسين سهولة الاستخدام في THE VAULT': 'Convenience Roadmap (Arabic)',
  'verify-convenience-live.js::verify-convenience-live.js': 'Convenience Live Probe',
  'graph-viewer.js::graph-viewer.js': 'Graph Viewer Build',
  'graph_refine.py::clean_name()': 'Graph Community Refiner',
  'graph-methods.js::graph-methods.js': 'Release & Graph Scripts',
};
// Prefixes that make a good name straight from the filename when the file owns
// exactly one community — no hand entry needed and no filename echoed twice.
const TITLE = (s) => s.replace(/\.[a-z0-9]+$/i, '').replace(/^\d+_/, '')
  .replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function derive(sig, members) {
  const hand = NAMES[`${sig.file}::${sig.top}`];
  if (hand) return hand;
  // The top member IS the file node -> the community is that file.
  if (sig.top && sig.top === sig.file) {
    const t = TITLE(sig.file);
    return /migration|\.sql$/i.test(sig.file) || /^\d/.test(sig.file) ? `${t} Migration` : t;
  }
  // Otherwise name it after its busiest member, cleaned — never after the file,
  // which is what produced "app.js · app.js" in the shipped set.
  const t = String(sig.top || '')
    .replace(/\(\)$/, '').replace(/^(DB|Cloud|Notify|Health|FoodAI)\./, '')
    .replace(/^public\./, '').replace(/\s*\([^)]*\)?\s*$/, '').trim();
  if (!t) return TITLE(sig.file) || 'Unlinked nodes';
  const words = t.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).filter(Boolean);
  return words.slice(0, 5).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ---------------------------------------------------------------------- apply
const typeCount = {};
for (const n of g.nodes) { n.type = deriveType(n); typeCount[n.type] = (typeCount[n.type] || 0) + 1; }

const labels = {};
let hand = 0;
for (const [cid, members] of by.entries()) {
  const sig = signature(members);
  if (NAMES[`${sig.file}::${sig.top}`]) hand++;
  labels[cid] = derive(sig, members);
}
for (const n of g.nodes) n.community_name = labels[String(n.community)];

fs.writeFileSync(GRAPH, JSON.stringify(g), 'utf8');
fs.writeFileSync(LABELS, JSON.stringify(labels), 'utf8');

// -------------------------------------------------------- the same three tests
const vals = Object.entries(labels);
const echoes = vals.filter(([, v]) => /\.(js|md|sql|html|json|kt|java|gradle|css|swift|ts)\b/i.test(v)).length;
const dups = vals.filter(([, v]) => { const p = String(v).split(/\s*[·—–|]\s*/).map((x) => x.trim()); return p.length > 1 && p[0] === p[1]; }).length;
const longs = vals.filter(([, v]) => String(v).replace(/[—–&]/g, '').split(/\s+/).filter(Boolean).length > 5).length;
const unbal = vals.filter(([, v]) => v.split('(').length !== v.split(')').length).length;
let misassigned = 0;
for (const [cid, members] of by.entries()) {
  const claimed = [...String(labels[cid]).matchAll(/([\w.\-]+\.(?:js|md|sql|html|json|kt|java|gradle|css|swift|ts))/gi)].map((m) => m[1]);
  if (!claimed.length) continue;
  const actual = new Set(members.map((m) => base(m.source_file)).filter(Boolean));
  if (!claimed.some((c) => actual.has(c))) misassigned++;
}
console.log(`enriched  ${g.nodes.length} nodes · ${Object.keys(typeCount).length} kinds · ${vals.length} clusters (${hand} hand-named)`);
const bad = misassigned + echoes + dups + longs + unbal;
console.log(`  label audit — misassigned ${misassigned} · filename echo ${echoes} · duplicated ${dups} · >5 words ${longs} · truncated ${unbal}`);
if (bad) { console.error('  FAIL: the label set regressed'); process.exit(1); }
