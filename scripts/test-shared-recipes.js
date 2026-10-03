// Behavioural checks for «اقتراحات» (v419) — meal suggestions from recipes
// users share — on the DATA and AI-CLIENT side: the pure period, ranking,
// cleaning and copy helpers in js/food.js (A–D), the «shared» marker in
// js/storage.js (E), FoodAI.shareRecipe in js/foodai.js (F), the three Cloud
// calls in js/cloud.js (G) and the harness's stubs of them (H). Node built-ins
// only; no real storage, no account, no network — every Supabase answer and
// every Worker reply is a fake built here. Run: node scripts/test-shared-recipes.js
//
// Written against the plan's names while the implementation was being built:
// on v418 every case fails, each for its own reason (the name it calls does
// not exist yet), which is the fail-first proof. Each case runs on its own and
// prints its own line, so one half that has not landed never hides the state
// of the other; the run fails if any case does.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context } = require('./test-sync-status');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const json = (v) => JSON.stringify(v);
// Values handed back by a vm context are built from ITS Array and Object, and
// strict deepEqual compares prototypes — so both sides go through JSON first.
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const deq = (got, want, msg) => assert.deepEqual(plain(got), plain(want), msg);
const tick = () => new Promise((resolve) => setImmediate(resolve));
// An unpaired UTF-16 half — what Postgres jsonb refuses and a code-unit cut leaves.
const lone = (s) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(String(s));
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
// The columns migration 35 grants to `authenticated` (its `grant select (…)`).
const GRANTED = ['id', 'lang', 'name', 'servings', 'meals', 'items', 'kcal', 'protein', 'carbs', 'fat', 'status', 'created_at'];

// The app with the whole food domain: context() (cloud.js + storage.js), then
// i18n, catalog and ui for t(), then the REAL js/food.js — which has no
// top-level statement but constants and declarations (test-convenience.js).
function foodApp() {
  const h = context();
  for (const f of ['js/i18n.js', 'js/catalog.js', 'js/ui.js', 'js/food.js']) vm.runInContext(read(f), h.c);
  return { h, DB: h.c.DB, run: (code) => vm.runInContext(code, h.c) };
}

// A shared row as the list read returns it (no items — the list never carries them).
const row = (over) => Object.assign({ id: 'shr-ok', lang: 'ar', name: 'شوفان بالموز', servings: 2, meals: ['breakfast', 'snack'],
  kcal: 350, protein: 12.5, carbs: 55, fat: 8, created_at: '2026-10-01T08:00:00.000Z' }, over);
const ingredient = (over) => Object.assign({ name: 'رز', qty: '200 غ', calories: 260, protein: 5, carbs: 56, fat: 0.6 }, over);

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ---------------------------------------------------------------- A. the period a clock falls in
// Hours 5–10 breakfast, 11–15 lunch, 16–18 snack, everything else dinner —
// every boundary from both sides, through a duck-typed clock and a real Date.
test('A mealPeriodFor', () => {
  const { run } = foodApp();
  const want = [[4, 'dinner'], [5, 'breakfast'], [10, 'breakfast'], [11, 'lunch'], [15, 'lunch'],
    [16, 'snack'], [18, 'snack'], [19, 'dinner'], [23, 'dinner'], [0, 'dinner']];
  for (const [h, p] of want) assert.equal(run(`mealPeriodFor({ getHours: () => ${h} })`), p, `${h}:00 is ${p}`);
  assert.equal(run('mealPeriodFor(new Date(2026, 9, 2, 12, 30))'), 'lunch', 'a real Date is read by its local hour');
});

// ---------------------------------------------------------------- B. the ranking
// With a gauge, what still fits the day's calories comes first; then protein
// per calorie; then the newer. Only the asked period is ranked, and the input
// is never reordered in place.
test('B rankSuggestions', () => {
  const { run } = foodApp();
  const rows = [
    row({ id: 'C', meals: ['lunch'], kcal: 650, protein: 70, created_at: '2026-10-01T10:00:00.000Z' }),
    row({ id: 'D', meals: ['lunch', 'dinner'], kcal: 300, protein: 15, created_at: '2026-10-01T11:00:00.000Z' }),
    row({ id: 'E', meals: ['lunch'], kcal: 420, protein: 45, created_at: '2026-10-01T09:00:00.000Z' }),
    row({ id: 'B', meals: ['breakfast'], kcal: 200, protein: 40, created_at: '2026-10-01T12:00:00.000Z' }),
  ];
  run('var __rows = ' + json(rows));
  const ids = (code) => plain(run(code)).map((r) => r.id);
  deq(ids('rankSuggestions(__rows, "lunch", { calLeft: 500 })'), ['E', 'D', 'C'], 'with 500 kcal left: the two that fit (by protein per kcal), then the one that does not');
  deq(ids('rankSuggestions(__rows, "lunch", null)'), ['C', 'E', 'D'], 'with no gauge: protein per kcal alone');
  deq(ids('rankSuggestions(__rows, "breakfast", null)'), ['B'], 'another period ranks only its own rows');
  assert.equal(run('JSON.stringify(__rows)'), json(rows), 'the input is never mutated or reordered');
  run('var __ties = ' + json([row({ id: 'old', meals: ['dinner'], created_at: '2026-09-30T08:00:00.000Z' }),
    row({ id: 'new', meals: ['dinner'], created_at: '2026-10-01T08:00:00.000Z' })]));
  deq(ids('rankSuggestions(__ties, "dinner", null)'), ['new', 'old'], 'a tie goes to the newer');
});

// ---------------------------------------------------------------- C. cleaning what the server sent
// The rows are UNTRUSTED (another user wrote them, the AI corrected them).
test('C cleanSharedRecipes', () => {
  const { run } = foodApp();
  const planted = ingredient({ id: 'planted-id', _auto: true, _manual: true, qty: 'q'.repeat(30) });
  const input = [
    row({ id: 'ok' }),                                                       // a list row: no items, kept as it is
    row({ id: '<img src=x>' }),                                              // an unsafe id
    row({ id: 'ok', name: 'the same id again' }),                            // a duplicate
    row({ id: 'no-name', name: '   ' }),                                     // an empty name
    row({ id: 'no-items', items: [] }),                                      // 0 items
    row({ id: 'many-items', items: Array.from({ length: 31 }, () => ingredient()) }),   // 31 items
    row({ id: 'nan', kcal: 'x' }),                                           // a figure that is not a number
    row({ id: 'neg', protein: -1 }),                                         // a negative figure
    row({ id: 'no-meal', meals: ['brunch'] }),                               // no valid meal
    row({ id: 'long', name: 'x'.repeat(100), items: [planted] }),            // cut at 80; qty cut at 24; item id/_ keys gone
    row({ id: 'sur', name: 'Oats \uD83D mix 🍌' }),               // a lone half removed, a whole pair kept
    row({ id: 'meals', meals: ['dinner', 'brunch', 'breakfast', 'dinner'] }), // filtered, deduped, in the fixed order
    row({ id: 'serv0', servings: 0 }),
    row({ id: 'serv150', servings: 150 }),
  ];
  run('var __in = ' + json(input));
  const out = plain(run('cleanSharedRecipes(__in)'));
  const byId = Object.fromEntries(out.map((r) => [r.id, r]));
  deq(out.map((r) => r.id).sort(), ['long', 'meals', 'ok', 'serv0', 'serv150', 'sur'], 'exactly the usable rows survive: ' + json(out.map((r) => r.id)));
  assert.equal(byId.ok.name, 'شوفان بالموز', 'the first of a duplicated id is the one kept');
  assert.equal(byId.long.name.length, 80, 'a name is cut at 80');
  assert.equal(byId.long.items.length, 1, 'its one ingredient is kept');
  assert.equal(byId.long.items[0].qty.length, 24, 'an amount is cut at 24');
  assert.ok(!('id' in byId.long.items[0]), 'a planted item id is gone: ' + json(byId.long.items[0]));
  assert.ok(!Object.keys(byId.long.items[0]).some((k) => k[0] === '_'), 'and so is every _private key: ' + json(byId.long.items[0]));
  assert.ok(!lone(byId.sur.name) && byId.sur.name.startsWith('Oats') && byId.sur.name.includes('🍌'), 'the lone surrogate is removed, the whole pair kept: ' + json(byId.sur.name));
  deq(byId.meals.meals, ['breakfast', 'dinner'], 'meals filtered to the four, deduped, in the fixed order');
  assert.equal(byId.serv0.servings, 1, 'servings 0 → 1');
  assert.equal(byId.serv150.servings, 99, 'servings 150 → 99');
  deq(run('cleanSharedRecipes(cleanSharedRecipes(__in))'), out, 'cleaning is idempotent');
  run('var __many = ' + json(Array.from({ length: 250 }, (_, i) => row({ id: 'r' + i }))));
  assert.equal(run('cleanSharedRecipes(__many).length'), 200, 'at most 200 rows are kept');
});

// ---------------------------------------------------------------- D. «احفظها في وصفاتي»
// A saved copy is a NEW recipe of the user's own: new ids, none of the
// editor's private keys, never the «shared» marker of anyone's publish.
test('D shrCopyDraft / shrCopyExists', () => {
  const { DB, run } = foodApp();
  const raw = row({ id: 'shr-d', name: 'QA Shared Bowl', servings: 2, shared: { id: 'someone-else', at: '2026-10-01T08:00:00.000Z' },
    items: [ingredient({ id: 'it-1', _auto: true, _manual: true }), ingredient({ id: 'it-2', name: 'دجاج', qty: '150 غ', calories: 248, protein: 46, carbs: 0, fat: 5 })] });
  run('var __raw = ' + json(raw));
  const draft = plain(run('shrCopyDraft(__raw)'));
  assert.ok(draft && typeof draft === 'object', 'shrCopyDraft returns a draft');
  assert.ok(!('shared' in draft), 'the draft carries no «shared» marker: ' + json(draft));
  assert.equal(draft.name, 'QA Shared Bowl');
  assert.equal(draft.servings, 2);
  assert.equal(draft.items.length, 2);
  for (const it of draft.items) {
    assert.ok(!('id' in it), 'a draft item has no id: ' + json(it));
    assert.ok(!Object.keys(it).some((k) => k[0] === '_'), 'nor a _private key: ' + json(it));
    assert.ok(Object.keys(it).every((k) => ['name', 'qty', 'calories', 'protein', 'carbs', 'fat'].includes(k)), 'only the six recipe fields: ' + json(it));
  }
  assert.equal(run('shrCopyExists(__raw)'), false, 'before saving, no copy exists');
  const saved = DB.recipes.add(draft);
  assert.ok(saved, 'the draft saves as a recipe');
  assert.notEqual(saved.id, 'shr-d', 'under a new id');
  for (const it of saved.items) {
    assert.ok(SAFE_ID.test(it.id) && !['it-1', 'it-2'].includes(it.id), 'every saved item has a NEW safe id: ' + it.id);
    assert.ok(!Object.keys(it).some((k) => k[0] === '_'), 'and no _private key');
  }
  assert.ok(!('shared' in saved), 'the saved copy is not "shared"');
  assert.equal(run('shrCopyExists(__raw)'), true, 'after saving, the copy is found');
});

// ---------------------------------------------------------------- E. the «shared» marker
// {id, at}, written by DB.recipes.setShared only, outside the undo ledger;
// normalised (an invalid one dropped) at every door into the blob.
test('E DB.recipes.setShared', () => {
  const s = context(), DB = s.c.DB;
  const stored = (id) => (JSON.parse(s.values.get(s.keys.store)).recipes || []).find((r) => r.id === id);
  const rec = DB.recipes.add({ name: 'QA Bowl', servings: 2, items: [ingredient()] });
  assert.ok(rec, 'setup: a recipe');
  const marker = { id: '3f2a9c1e-0b7d-4c55-9a1e-2b6f0d8c7e41', at: '2026-10-02T09:00:00.000Z' };
  const undoBefore = DB.undo.list().length;
  const w = DB.recipes.setShared(rec.id, Object.assign({ author: 'planted' }, marker));
  assert.equal(w.ok, true, 'a valid marker is stored: ' + json(w));
  assert.equal(w.changed, true);
  assert.equal(w.undoToken, null, 'with no undo token');
  assert.equal(DB.undo.list().length, undoBefore, 'and NO undo entry — an Undo cannot un-publish');
  deq(stored(rec.id).shared, marker, 'persisted as exactly {id, at}');
  deq(DB.recipes.list().find((r) => r.id === rec.id).shared, marker, 'and in memory');
  // The refusals leave the stored marker as it was.
  for (const bad of [{ id: '<x>', at: marker.at }, { at: marker.at }, { id: marker.id }, { id: marker.id, at: 'not a date' },
    { id: marker.id, at: marker.at + ' '.repeat(17) }, 'a string', [marker], undefined]) {
    deq(DB.recipes.setShared(rec.id, bad), { ok: false, code: 'VALIDATION' }, 'refused as VALIDATION: ' + json(bad));
  }
  deq(stored(rec.id).shared, marker, 'no refusal touched the stored marker');
  deq(DB.recipes.setShared('no-such-recipe', marker), { ok: false, code: 'STALE' }, 'an unknown recipe is STALE');
  // update keeps it, and can neither replace nor add one; add never takes one.
  const edited = DB.recipes.update(rec.id, { name: 'QA Bowl 2', shared: { id: 'other', at: marker.at } });
  assert.equal(edited.name, 'QA Bowl 2');
  deq(edited.shared, marker, 'an edit keeps the marker and cannot replace it');
  deq(stored(rec.id).shared, marker);
  const copy = DB.recipes.add({ name: 'QA Copy', servings: 1, items: [ingredient()], shared: marker });
  assert.ok(copy && !('shared' in copy), 'add never takes a marker');
  // null clears it, still outside the ledger.
  const cleared = DB.recipes.setShared(rec.id, null);
  assert.equal(cleared.ok && cleared.changed, true, 'null clears: ' + json(cleared));
  assert.ok(!('shared' in stored(rec.id)), 'the stored recipe has no marker');
  assert.equal(DB.undo.list().length, undoBefore + 2, 'only the edit and the add entered the ledger');
  deq(DB.recipes.setShared(rec.id, null), { ok: true, changed: false }, 'clearing twice changes nothing');
  // The validator normalises, never refuses — a pull and a restore both pass it.
  const probe = { exercises: [], recipes: [{ id: 'p1', name: 'P1', items: [], shared: { id: '<x>', at: marker.at } }, { id: 'p2', name: 'P2', items: [], shared: marker }] };
  assert.equal(DB._validateBlob(probe), true, 'a bad marker never refuses a blob');
  assert.ok(!('shared' in probe.recipes[0]), '_validateBlob drops an invalid marker');
  deq(probe.recipes[1].shared, marker, 'and keeps a valid one');
  // A restore drops an invalid marker and keeps a valid one.
  DB.recipes.setShared(rec.id, marker);
  const blob = JSON.parse(DB.exportJSON());
  const other = blob.recipes.find((r) => r.id === copy.id);
  other.shared = { id: '"><img src=x>', at: marker.at };
  blob.recipes.push(Object.assign({}, other, { id: 'qa-null-marker', name: 'QA Null', shared: null }));
  assert.equal(DB.importJSON(JSON.stringify(blob)), true, 'a backup with a bad marker still restores');
  deq(stored(rec.id).shared, marker, 'a valid marker survives the restore');
  assert.ok(!('shared' in stored(copy.id)), 'an invalid one is dropped');
  assert.ok(!('shared' in stored('qa-null-marker')), 'and so is a null one');
  // And the boot door: a stored blob with a bad marker is normalised AND persisted.
  const raw = JSON.parse(s.values.get(s.keys.store));
  raw.recipes.find((r) => r.id === rec.id).shared = { id: marker.id, at: 'x'.repeat(41) };
  s.values.set(s.keys.store, JSON.stringify(raw));
  vm.runInContext('reloadState()', s.c);
  assert.ok(!('shared' in DB.recipes.list().find((r) => r.id === rec.id)), 'loadState drops it from memory');
  assert.ok(!('shared' in stored(rec.id)), 'and writes the corrected blob back');
  // At BOOT too — `let STATE = …loadState()` reaches the cleaner before the rest
  // of storage.js has run, where a const it read would still be in its dead zone
  // and the whole blob would land READ-ONLY instead of losing one marker.
  const b = context({ values: new Map([[s.keys.store, JSON.stringify(raw)]]) });
  assert.equal(b.c.DB.loadFailed(), false, 'a bad marker at boot never makes the blob unreadable');
  assert.ok(!('shared' in b.c.DB.recipes.list().find((r) => r.id === rec.id)), 'the boot load drops it');
});

// ---------------------------------------------------------------- F. FoodAI.shareRecipe
// The REAL js/foodai.js in a vm against a fetch that records every request.
test('F FoodAI.shareRecipe', async () => {
  const fa = read('js/foodai.js');
  const sent = [];
  let reply = () => ({ ok: true, status: 200, json: async () => ({}) });
  let session = { access_token: 'qa-token', user: { id: 'qa-user' } };
  const c = { console: { log() {}, warn() {}, error() {} }, AbortController, setTimeout, clearTimeout, URL, cacheWrites: 0,
    localStorage: { getItem: () => null, setItem() { c.cacheWrites++; }, removeItem() {} },
    fetch: async (url, opts) => { sent.push({ url, headers: opts.headers, body: JSON.parse(opts.body) }); return reply(); },
    Cloud: { getSession: async () => session } };
  c.window = c; vm.createContext(c);
  vm.runInContext(read('js/cloud.js').split('(function () {')[0], c);   // VAULT_KEYS, and nothing else of cloud.js
  vm.runInContext(fa, c);
  const FA = c.FoodAI;
  assert.equal(typeof FA.shareRecipe, 'function', 'FoodAI.shareRecipe is not exported');
  const answer = (status, body) => () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const share = async (rec) => { let out = null, err = null; await FA.shareRecipe(rec).then((v) => { out = v; }, (e) => { err = e; }); return { out, err }; };
  const said = async (status, body) => { reply = answer(status, body); const r = await share(rec); return r.err ? FA.friendlyErr(r.err) : 'resolved ' + json(r.out); };
  // A recipe exactly as DB.recipes stores it, plus what must never leave the phone.
  const rec = { id: 'rcp_QA1', name: '  QA Bowl  ', servings: 2, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T09:00:00.000Z',
    shared: { id: 'old-copy', at: '2026-10-01T08:00:00.000Z' },
    items: [ingredient({ id: 'i1', _auto: true, _src: 'ai' }), ingredient({ id: 'i2', name: 'دجاج', qty: '150 غ', calories: 248, protein: 46.5, carbs: 0, fat: 5 })] };
  const approve = { verdict: 'approve', id: '3f2a9c1e-0b7d-4c55-9a1e-2b6f0d8c7e41', name: 'QA Bowl' };
  reply = answer(200, approve);
  const ok = await share(rec);
  deq(ok.out, approve, 'an approval comes back as {verdict, id, name}: ' + json(ok.out || (ok.err && ok.err.message)));
  const b = sent[sent.length - 1].body;
  assert.equal(Object.keys(b).join(','), 'mode,lang,shareRecipe', 'the payload is share-only — an OLD Worker answers 400 no input: ' + Object.keys(b));
  assert.equal(b.mode, 'share-recipe');
  assert.equal(b.lang, 'en');
  deq(b.shareRecipe, { name: 'QA Bowl', servings: 2, sourceId: 'rcp_QA1', items: [
    { name: 'رز', qty: '200 غ', calories: 260, protein: 5, carbs: 56, fat: 0.6 },
    { name: 'دجاج', qty: '150 غ', calories: 248, protein: 46.5, carbs: 0, fat: 5 }] }, 'built field by field — no createdAt, no marker, no item id, no _ key: ' + json(b.shareRecipe));
  for (const it of b.shareRecipe.items) assert.equal(Object.keys(it).sort().join(','), 'calories,carbs,fat,name,protein,qty', 'exactly six keys per ingredient');
  assert.equal(sent[sent.length - 1].headers.Authorization, 'Bearer qa-token', "the caller's own token rides the request");
  c.DB = { prefs: { get: () => ({ lang: 'ar' }) } };
  await share(rec);
  assert.equal(sent[sent.length - 1].body.lang, 'ar', 'lang is the UI language, as an enum');
  delete c.DB;
  // The verdicts pass through; a reason that is not a code is «other».
  assert.equal(await said(200, { verdict: 'reject', reason: 'personal_data' }), 'resolved ' + json({ verdict: 'reject', reason: 'personal_data' }));
  assert.equal(await said(200, { verdict: 'refused', reason: 'daily_limit' }), 'resolved ' + json({ verdict: 'refused', reason: 'daily_limit' }));
  assert.equal(await said(200, { verdict: 'reject', reason: '<b>Not food</b>' }), 'resolved ' + json({ verdict: 'reject', reason: 'other' }), 'prose never reaches t()');
  // The failures, each by its own sentence. tr() answers the key in this vm.
  assert.equal(await said(400, { error: 'no input' }), 'shr_unavailable', 'an OLD Worker refuses the share fields: «not available yet»');
  assert.equal(await said(429, { error: 'daily limit', code: 'DAILY_LIMIT' }), 'ai_daily_limit', 'the daily budget is named, through workerError');
  assert.equal(await said(200, { items: [{ name: 'QA', calories: 1 }] }), 'ai_error', 'a food answer is not a verdict');
  assert.equal(await said(200, { verdict: 'approve', name: 'QA' }), 'ai_error', 'an approval without an id is not one');
  // Signed out: refused on the phone, nothing sent.
  const n0 = sent.length;
  session = null;
  assert.equal(await said(200, approve), 'ai_err_signin', 'no session → «sign in», before any request');
  delete c.Cloud;
  assert.equal(await said(200, approve), 'ai_err_signin', 'no Cloud at all → the same');
  assert.equal(sent.length, n0, 'and neither spent a request');
  assert.equal(c.cacheWrites, 0, 'a verdict is never cached');
  const proxy = (fa.match(/const PROXY_URL = '([^']+)'/) || [])[1];
  assert.ok(proxy && sent.every((x) => x.url === proxy), 'every share went to the Worker, through the one door');
});

// ---------------------------------------------------------------- G. the three Cloud calls
// The real js/cloud.js over test-sync-status.js's fake client: the query chain
// records table, columns, filters and limit; rpc is replaced on that client.
test('G Cloud.pullSharedRecipes / getSharedRecipeItems / withdrawSharedRecipe', async () => {
  const s = context(), { c, values, keys } = s;
  assert.equal(keys.sharedRecipes, 'vault_shared_recipes', 'the cache key is registered');
  assert.ok(!keys.sharedRecipes.startsWith(keys.img), 'and is not a photo key imgPrune would sweep');
  for (const n of ['pullSharedRecipes', 'getSharedRecipeItems', 'withdrawSharedRecipe']) assert.equal(typeof c.Cloud[n], 'function', 'Cloud.' + n + ' is exported');
  const asked = [];
  const wire = [
    Object.assign(row({ id: 'w1' }), { author: 'planted-author', source_id: 'planted-source', items: [ingredient()] }),
    row({ id: 'w2', lang: 'en', name: 'Oats', meals: ['breakfast'] }),
  ];
  let list = async () => ({ data: wire, error: null });
  let items = async () => ({ data: { items: [] }, error: null });
  s.query(async (q) => { asked.push(q); return q.fields === 'items' ? items(q) : list(q); });
  const pulls = () => asked.filter((q) => q.table === 'shared_recipes' && q.fields !== 'items').length;
  // The list read.
  const first = await c.Cloud.pullSharedRecipes();
  const q = asked[0];
  assert.equal(q && q.table, 'shared_recipes', 'the list reads shared_recipes');
  const cols = q.fields.split(',').map((x) => x.trim());
  assert.ok(!cols.includes('*') && !cols.includes('author') && !cols.includes('source_id'), 'never *, author or source_id: ' + q.fields);
  assert.ok(cols.every((x) => GRANTED.includes(x)), 'every column is one the grant names: ' + q.fields);
  assert.ok(!cols.includes('items'), 'the list carries no ingredients (egress)');
  assert.equal(q.fields, 'id,lang,name,servings,meals,kcal,protein,carbs,fat,created_at');
  deq(q.filters, [['status', 'approved']], "only approved rows — the owner's admin policy would also hand him the removed ones");
  assert.equal(q.limit, 300, 'at most 300 rows');
  deq(first, [row({ id: 'w1' }), row({ id: 'w2', lang: 'en', name: 'Oats', meals: ['breakfast'] })], 'each row field by field: a column the wire adds never rides through');
  // The cache: per account, 30 minutes, `fresh` bypasses it.
  const cache = JSON.parse(values.get(keys.sharedRecipes));
  assert.equal(cache.uid, 'alice', 'the cache is keyed to the account');
  deq(await c.Cloud.pullSharedRecipes(), first, 'a second read within the TTL answers the cache');
  assert.equal(pulls(), 1, 'without a request');
  await c.Cloud.pullSharedRecipes({ fresh: true });
  assert.equal(pulls(), 2, '{fresh:true} reads again');
  cache.at = Date.now() - 31 * 60 * 1000; values.set(keys.sharedRecipes, JSON.stringify(cache));
  await c.Cloud.pullSharedRecipes();
  assert.equal(pulls(), 3, 'an expired cache reads again');
  // A failure answers this account's cache, and never another account's.
  list = async () => ({ data: null, error: { message: 'qa outage' } });
  deq(await c.Cloud.pullSharedRecipes({ fresh: true }), first, "a failed read answers this account's cache");
  s.account('bob');
  assert.equal(await c.Cloud.pullSharedRecipes(), null, "never another account's: null");
  assert.equal(pulls(), 5, 'and that was a request, not a cache hit');
  list = async () => ({ data: wire, error: null });
  await c.Cloud.pullSharedRecipes();
  assert.equal(JSON.parse(values.get(keys.sharedRecipes)).uid, 'bob', "bob's read replaces alice's cache");
  s.session(null);
  const n0 = asked.length;
  assert.equal(await c.Cloud.pullSharedRecipes({ fresh: true }), null, 'signed out: null');
  assert.equal(asked.length, n0, 'and no request — the table is granted to signed-in users only');
  s.account('alice');
  // One row's ingredients: cleaned, remembered for the session.
  items = async () => ({ data: { items: [
    { id: 'planted', _auto: true, name: ' رز ', qty: '200 غ', calories: '260', protein: -5, carbs: 1e9, fat: 0.6 },
    'junk', null, { name: '', qty: '1', calories: 1 },
    { name: 'x'.repeat(79) + '🍌', qty: 'q'.repeat(30), calories: 'NaN-ish', protein: 1, carbs: 1, fat: 1 },
  ] }, error: null });
  const got = await c.Cloud.getSharedRecipeItems('w1');
  const iq = asked[asked.length - 1];
  assert.equal(iq.fields, 'items', 'the ingredients are read alone');
  deq(iq.filters, [['id', 'w1']], 'for that one row');
  deq(got, [{ name: 'رز', qty: '200 غ', calories: 260, protein: 0, carbs: 100000, fat: 0.6 },
    { name: 'x'.repeat(79), qty: 'q'.repeat(24), calories: 0, protein: 1, carbs: 1, fat: 1 }], 'six fields, the stored bounds, no half emoji: ' + json(got));
  got[0].name = 'mutated by a caller';
  const n1 = asked.length;
  deq((await c.Cloud.getSharedRecipeItems('w1'))[0].name, 'رز', 'the memo answers again, untouched by a caller');
  assert.equal(asked.length, n1, 'without a request');
  items = async () => ({ data: null, error: { message: 'qa' } });
  assert.equal(await c.Cloud.getSharedRecipeItems('w9'), null, 'a failed read is null');
  assert.equal(await c.Cloud.getSharedRecipeItems(''), null, 'and so is no id');
  // Withdrawing: the definer RPC, its literal arguments, the cache dropped.
  const client = c.supabase.createClient();
  const calls = [];
  let rpc = async () => ({ data: true, error: null });
  client.rpc = async (name, args) => { calls.push([name, plain(args)]); return rpc(); };
  await c.Cloud.pullSharedRecipes({ fresh: true });
  assert.ok(values.has(keys.sharedRecipes), 'setup: a cache to drop');
  deq(await c.Cloud.withdrawSharedRecipe('w1'), { ok: true }, 'the author withdraws');
  deq(calls[0], ['withdraw_shared_recipe', { p_id: 'w1' }], 'through withdraw_shared_recipe with exactly {p_id}');
  assert.ok(!values.has(keys.sharedRecipes), 'and the list cache is dropped');
  rpc = async () => ({ data: false, error: null });
  deq(await c.Cloud.withdrawSharedRecipe('w2'), { ok: false }, "false (not the author's, or gone) is not a success");
  rpc = async () => ({ data: null, error: { message: 'not authenticated' } });
  deq(await c.Cloud.withdrawSharedRecipe('w1'), { ok: false, error: 'signin' }, 'the SQL raise reads as «sign in»');
  rpc = async () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
  deq(await c.Cloud.withdrawSharedRecipe('w1'), { ok: false, error: 'offline' }, 'a dropped connection reads as offline');
  s.session(null);
  const c0 = calls.length;
  deq(await c.Cloud.withdrawSharedRecipe('w1'), { ok: false, error: 'signin' }, 'signed out: «sign in»');
  assert.equal(calls.length, c0, 'and no call');
  s.account('alice');
  assert.ok(/\.rpc\('withdraw_shared_recipe', \{ p_id: id \}\)/.test(read('js/cloud.js')), 'the rpc arguments are a literal object — contract 14 reads them');
  // Logout sweeps the cache and forgets the remembered ingredients.
  values.set(keys.sharedRecipes, '{}');
  c.Cloud.clearLocalUserData();
  assert.ok(!values.has(keys.sharedRecipes), 'clearLocalUserData sweeps the shared-recipes cache');
  s.account('alice');
  items = async () => ({ data: { items: [ingredient()] }, error: null });
  const n2 = asked.length;
  await c.Cloud.getSharedRecipeItems('w1');
  assert.equal(asked.length, n2 + 1, 'and the next account reads the ingredients afresh');
  await tick();
});

// ---------------------------------------------------------------- H. the harness
// A stub is a promise about a surface the harness cannot load — keep the SHAPE
// (CLAUDE.md, «the harness stub had a gate…»). Every fp/server.js mode answers
// the three calls the way the real one fails; and the fingerprint net reads an
// unresolved shr_ key on screen as a raw key.
test('H fp/server.js stubs + fingerprint raw keys', async () => {
  const { STUBS } = require('./fp/server.js');
  for (const [mode, stub] of Object.entries(STUBS)) {
    const w = {}; w.window = w; vm.createContext(w);
    vm.runInContext(stub, w);
    const C = w.Cloud;
    for (const n of ['pullSharedRecipes', 'getSharedRecipeItems', 'withdrawSharedRecipe']) assert.equal(typeof C[n], 'function', `the '${mode}' stub has Cloud.${n}`);
    assert.equal(await C.pullSharedRecipes(), null, `'${mode}': the pull answers null (no async card in the net)`);
    assert.equal(await C.getSharedRecipeItems('x'), null, `'${mode}': the ingredients answer null`);
    deq(await C.withdrawSharedRecipe('x'), { ok: false, error: 'fp-stub' }, `'${mode}': a withdraw fails the real shape`);
  }
  const net = read('scripts/fingerprint-net.js');
  const src = (net.match(/rawKeys:\s*\(visible\.match\((\/.+?\/g)\)/) || [])[1];
  assert.ok(src, 'found the raw-key pattern in scripts/fingerprint-net.js');
  const re = new Function('return ' + src)();
  assert.ok(re.test('shr_title'), 'the fingerprint net names an unresolved shr_ key: ' + src);
});

(async () => {
  const failed = [];
  for (const [name, fn] of cases) {
    try { await fn(); console.log('  ok    ' + name); }
    catch (e) { failed.push(name); console.log('  FAIL  ' + name + ' — ' + String((e && e.message) || e).split('\n')[0]); }
  }
  if (failed.length) {
    console.log(`test-shared-recipes: ${failed.length} of ${cases.length} cases failed (${failed.map((n) => n[0]).join(', ')})`);
    process.exitCode = 1;
  } else {
    console.log(`PASS shared recipes: ${cases.length} cases — the meal period, the ranking, the cleaning and the saved copy (food.js); the shared marker outside the undo ledger and normalised at every door (storage.js); shareRecipe signed-in, share-only, field by field, never cached (foodai.js); the list by named columns, approved only, cached per account, the items memoised, the withdraw by its literal args, swept on logout (cloud.js); the harness stubs and the raw-key net`);
  }
})();
