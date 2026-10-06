// Behavioural checks for «اقتراحات» (v419) — meal suggestions from recipes
// users share — on the DATA and AI-CLIENT side: the pure period, ranking,
// cleaning and copy helpers in js/food.js (A–D), the «shared» marker in
// js/storage.js (E), FoodAI.shareRecipe in js/foodai.js (F), the three Cloud
// calls in js/cloud.js (G) and the harness's stubs of them (H) — and, since
// v420, what AUTOMATIC sharing stands on (I): the two prefs, the three recipe
// fields the engine reads (the marker's sig, noAuto, origin), the content
// signature, the question «is this recipe wanted?», the device ledger and the
// queue a trigger fills. What the engine does with them — every request — is
// the browser suite's. Node built-ins only; no
// real storage, no account, no network — every Supabase answer and every
// Worker reply is a fake built here.
// Run: node scripts/test-shared-recipes.js
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
// editor's private keys, never the «shared» marker of anyone's publish — and,
// since v420, `origin: 'shared'`: every recipe a user saves is now published
// by itself, and a copy of someone else's recipe must never be one of them.
test('D shrCopyDraft / shrCopyExists', () => {
  const { h, DB, run } = foodApp();
  const stored = (id) => (JSON.parse(h.values.get(h.keys.store)).recipes || []).find((r) => r.id === id);
  const raw = row({ id: 'shr-d', name: 'QA Shared Bowl', servings: 2, origin: 'planted', shared: { id: 'someone-else', at: '2026-10-01T08:00:00.000Z' },
    items: [ingredient({ id: 'it-1', _auto: true, _manual: true }), ingredient({ id: 'it-2', name: 'دجاج', qty: '150 غ', calories: 248, protein: 46, carbs: 0, fat: 5 })] });
  run('var __raw = ' + json(raw));
  const draft = plain(run('shrCopyDraft(__raw)'));
  assert.ok(draft && typeof draft === 'object', 'shrCopyDraft returns a draft');
  assert.ok(!('shared' in draft), 'the draft carries no «shared» marker: ' + json(draft));
  assert.equal(draft.origin, 'shared', "the draft says where it came from — origin: 'shared', whatever the row itself claims: " + json(draft));
  assert.equal(draft.name, 'QA Shared Bowl');
  assert.equal(draft.servings, 2);
  assert.equal(draft.items.length, 2);
  for (const it of draft.items) {
    assert.ok(!('id' in it), 'a draft item has no id: ' + json(it));
    assert.ok(!Object.keys(it).some((k) => k[0] === '_'), 'nor a _private key: ' + json(it));
    assert.equal(Object.keys(it).sort().join(','), 'calories,carbs,fat,name,protein,qty', 'exactly the six recipe fields: ' + json(it));
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
  assert.equal(stored(saved.id).origin, 'shared', "and it is STORED with origin: 'shared' — what keeps automatic sharing from publishing it back: " + json(stored(saved.id)));
  assert.equal(run('shrCopyExists(__raw)'), true, 'after saving, the copy is found');
});

// ---------------------------------------------------------------- E. the «shared» marker
// {id, at}, written by DB.recipes.setShared only, outside the undo ledger;
// normalised (an invalid one dropped) at every door into the blob. Since v420
// it may carry `sig` (8 lowercase hex, copied BY NAME); and two fields sit
// beside it on the recipe: `noAuto` (DB.recipes.setNoAuto, outside the ledger
// too) and `origin` (taken by add() alone, and only as 'shared').
test('E DB.recipes.setShared', () => {
  const s = context(), DB = s.c.DB;
  const stored = (id) => (JSON.parse(s.values.get(s.keys.store)).recipes || []).find((r) => r.id === id);
  // The ledger BY ITS TOKENS: it keeps five entries, so past five its length
  // stands still while an entry is pushed and another falls off the far end.
  const ledger = () => json(DB.undo.list().map((e) => e.token));
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
  // v420 — the sig: copied by name when it is 8 lowercase hex characters, and
  // only then. Anything else leaves {id, at}: never a refusal (the copy IS
  // published and the marker is its only handle), never the old sig inherited.
  const signed = Object.assign({}, marker, { sig: 'a1b2c3d4' });
  DB.recipes.setShared(rec.id, Object.assign({ author: 'planted', extra: 1 }, signed));
  deq(stored(rec.id).shared, signed, 'a sig is persisted — as exactly {id, at, sig}, the planted keys still dropped');
  for (const bad of ['A1B2C3D4', 'a1b2c3d', 'a1b2c3d4e', 'g1b2c3d4', ' a1b2c3d4', 'a1b2c3d4\n', 12345678, '', null, ['a1b2c3d4']]) {
    DB.recipes.setShared(rec.id, signed);
    const w2 = DB.recipes.setShared(rec.id, Object.assign({}, marker, { sig: bad }));
    deq(w2, { ok: true, changed: true, undoToken: null }, 'a sig that is not one is no refusal: ' + json(bad) + ' → ' + json(w2));
    deq(stored(rec.id).shared, marker, 'it is dropped, and the marker is exactly {id, at}: ' + json(bad));
  }
  DB.recipes.setShared(rec.id, signed);
  // update keeps it, and can neither replace nor add one; add never takes one.
  const edited = DB.recipes.update(rec.id, { name: 'QA Bowl 2', shared: { id: 'other', at: marker.at, sig: 'ffffffff' } });
  assert.equal(edited.name, 'QA Bowl 2');
  deq(edited.shared, signed, 'an edit keeps the marker — its sig too — and cannot replace it');
  deq(stored(rec.id).shared, signed, 'and so does the STORED recipe: ' + json(stored(rec.id).shared));
  const copy = DB.recipes.add({ name: 'QA Copy', servings: 1, items: [ingredient()], shared: marker });
  assert.ok(copy && !('shared' in copy), 'add never takes a marker');
  // null clears it, still outside the ledger.
  const cleared = DB.recipes.setShared(rec.id, null);
  assert.equal(cleared.ok && cleared.changed, true, 'null clears: ' + json(cleared));
  assert.ok(!('shared' in stored(rec.id)), 'the stored recipe has no marker');
  assert.equal(DB.undo.list().length, undoBefore + 2, 'only the edit and the add entered the ledger');
  deq(DB.recipes.setShared(rec.id, null), { ok: true, changed: false }, 'clearing twice changes nothing');
  // v420 — noAuto: true or ABSENT, written outside the ledger like the marker.
  const led = ledger();
  deq(DB.recipes.setNoAuto(rec.id, false), { ok: true, changed: false }, 'clearing a flag that was never set writes nothing');
  deq(DB.recipes.setNoAuto(rec.id, true), { ok: true, changed: true, undoToken: null }, 'setNoAuto(true) is a write with no undo token');
  assert.equal(stored(rec.id).noAuto, true, 'stored as noAuto: true: ' + json(stored(rec.id)));
  deq(DB.recipes.setNoAuto(rec.id, true), { ok: true, changed: false }, 'setting it twice changes nothing');
  deq(DB.recipes.setNoAuto(rec.id, false), { ok: true, changed: true, undoToken: null }, 'setNoAuto(false) is a write with no undo token');
  assert.ok(!('noAuto' in stored(rec.id)), 'and it DELETES the field — true or absent, never false: ' + json(stored(rec.id)));
  deq(DB.recipes.setNoAuto('no-such-recipe', true), { ok: false, code: 'STALE' }, 'an unknown recipe is STALE');
  assert.equal(ledger(), led, 'and none of it entered the undo ledger');
  // v420 — origin: add() keeps it only as 'shared'; an edit can neither set,
  // replace nor remove it.
  const fromFeed = DB.recipes.add({ name: 'QA From The Feed', servings: 1, items: [ingredient()], origin: 'shared' });
  assert.equal(fromFeed && stored(fromFeed.id).origin, 'shared', "add keeps origin: 'shared'");
  for (const other of ['mine', 'Shared', ' shared', true, 1, ['shared'], { v: 'shared' }, null]) {
    const r = DB.recipes.add({ name: 'QA Own', servings: 1, items: [ingredient()], origin: other });
    assert.ok(r && !('origin' in stored(r.id)), 'add takes no other origin: ' + json(other) + ' → ' + json(r && stored(r.id).origin));
  }
  const relabelled = DB.recipes.update(copy.id, { name: 'QA Copy 2', origin: 'shared' });
  assert.ok(relabelled && relabelled.name === 'QA Copy 2' && !('origin' in stored(copy.id)), 'an edit cannot SET an origin: ' + json(stored(copy.id)));
  const kept = DB.recipes.update(fromFeed.id, { name: 'QA From The Feed 2', origin: 'mine' });
  assert.equal(kept && kept.name === 'QA From The Feed 2' && stored(fromFeed.id).origin, 'shared', 'and keeps the one the recipe has, whatever the patch says');
  // v420 — THE LEDGER FOLLOWS THE TWO OUT-OF-LEDGER FIELDS (carryRecipeField).
  // Automatic sharing writes the marker a few seconds after every saved recipe;
  // DB.undo.apply refuses an entry whose `after` no longer equals the slice, so
  // without the carry every recipes Undo in «آخر التعديلات» answered STALE from
  // then on. An Undo made BEFORE the write is applicable AFTER it, keeps the
  // field as the slice has it, and the field itself is never undone.
  const head = () => DB.undo.list()[0].token;
  const u = DB.recipes.add({ name: 'QA Undo', servings: 2, items: [ingredient()] });
  assert.ok(u && DB.recipes.update(u.id, { name: 'QA Undo, edited' }), 'setup: a recipe, then an edit (the ledger\'s head)');
  const sig2 = Object.assign({}, marker, { sig: 'deadbeef' });
  deq(DB.recipes.setShared(u.id, sig2), { ok: true, changed: true, undoToken: null }, 'setup: the marker is written after the edit, outside the ledger');
  let undone = DB.undo.apply(head());
  deq([undone.ok, undone.changed], [true, true], 'the edit\'s Undo still applies after the marker was written — not STALE: ' + json(undone));
  deq([stored(u.id).name, stored(u.id).shared], ['QA Undo', sig2], 'it brings the old content back and KEEPS the marker: ' + json(stored(u.id)));
  assert.ok(DB.recipes.update(u.id, { servings: 3 }), 'setup: another edit');
  deq(DB.recipes.setNoAuto(u.id, true), { ok: true, changed: true, undoToken: null }, 'setup: noAuto written after it');
  undone = DB.undo.apply(head());
  deq([undone.ok, stored(u.id).servings, stored(u.id).noAuto, stored(u.id).shared], [true, 2, true, sig2], 'the same after setNoAuto: the Undo applies, and both fields stay as the slice has them: ' + json(stored(u.id)));
  // Cleared again (both deletes), the ADD itself is still undoable — the
  // snapshots' keys move with the slice's, in both directions.
  DB.recipes.setNoAuto(u.id, false);
  DB.recipes.setShared(u.id, null);
  undone = DB.undo.apply(head());
  deq([undone.ok, !!stored(u.id)], [true, false], 'the add\'s Undo applies after the fields were cleared again, and removes the recipe: ' + json(undone));
  // A delete's Undo after ANOTHER recipe was published meanwhile: it applies,
  // the deleted recipe comes back, and the other keeps its marker.
  const v = DB.recipes.add({ name: 'QA Deleted', servings: 1, items: [ingredient()] }), w2 = DB.recipes.add({ name: 'QA Published Meanwhile', servings: 1, items: [ingredient()] });
  assert.ok(v && w2 && DB.recipes.remove(v.id).ok, 'setup: two recipes, the first deleted');
  DB.recipes.setShared(w2.id, sig2);
  undone = DB.undo.apply(head());
  deq([undone.ok, !!stored(v.id), stored(w2.id).shared], [true, true, sig2], 'a delete\'s Undo applies after another recipe was published, brings it back, and the other keeps its marker: ' + json(undone));
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

// ---------------------------------------------------------------- I. automatic sharing (v420)
// Every recipe a signed-in user saves is published by itself unless they turn
// that off. THE DATA LAYER'S HALF: the two prefs (read strictly — they arrive
// from a pull or a backup as anything), the device ledger's key and its sweep
// on logout, and the three recipe fields the engine reads, through the doors a
// recipe passes on its way back to it (an edit, a pull, a restore). Then WHAT
// THE ENGINE STANDS ON in js/food.js, none of which sends anything: the
// content signature (shrCanon / shrSig), the one question «is this recipe
// wanted?» (autoShareWants), the device ledger (shrAutoStore / shrAutoSave)
// and the queue a trigger fills (queueAutoShare, autoShareHold).
// What the engine DOES with them — the notice, one request at a time, the
// pauses — is driven in a browser by scripts/test-shared-recipes-ui.js.
test('I automatic sharing', async () => {
  const { h: s, run } = foodApp(), { c, values, keys } = s, DB = c.DB;
  const blob = () => JSON.parse(values.get(keys.store));
  const dirty = () => values.has(keys.dirty + 'alice');
  // A pref as a pull or a restore delivers it: written into the stored blob, then loaded.
  const arrive = (key, value) => { const b = blob(); b.prefs[key] = value; values.set(keys.store, JSON.stringify(b)); vm.runInContext('reloadState()', c); };
  // The defaults: ON, and the notice not yet shown.
  assert.equal(DB.prefs.autoShare(), true, 'automatic sharing is ON by default — an older blob has no field');
  assert.equal(DB.prefs.autoShareSeen(), false, 'and its notice has not been shown');
  // «Seen» is housekeeping (saveLocal); the choice is a synced edit (save).
  assert.equal(dirty(), false, 'setup: nothing waits to be pushed');
  DB.prefs.setAutoShareSeen();
  assert.equal(blob().prefs.autoShareSeen, true, 'setAutoShareSeen is stored');
  assert.equal(dirty(), false, 'without marking the blob dirty — a stamp written at boot must not become a conflict');
  DB.prefs.setAutoShare(false);
  assert.equal(dirty(), true, 'the choice follows the account: setAutoShare is a synced edit');
  // The setter stores a boolean, whatever it is handed.
  DB.prefs.setAutoShare('yes');
  deq([blob().prefs.autoShare, DB.prefs.autoShare()], [true, true], 'setAutoShare(truthy) stores true');
  DB.prefs.setAutoShare(0);
  deq([blob().prefs.autoShare, DB.prefs.autoShare()], [false, false], 'setAutoShare(falsy) stores false — and reads as off');
  // The getters are STRICT: only a literal false is «off», only a literal true is «seen».
  for (const v of [0, '', null, 'false', 'off', 1, 'true', [], {}]) {
    arrive('autoShare', v);
    assert.equal(DB.prefs.autoShare(), true, 'only a literal false turns it off, not ' + json(v));
    arrive('autoShareSeen', v);
    assert.equal(DB.prefs.autoShareSeen(), false, 'only a literal true counts as seen, not ' + json(v));
  }
  arrive('autoShare', false);
  assert.equal(DB.prefs.autoShare(), false, 'a stored false is off');
  arrive('autoShareSeen', true);
  assert.equal(DB.prefs.autoShareSeen(), true, 'a stored true is seen');
  // The three fields, each through the real door, on recipes of their own.
  const mk = (name, extra) => DB.recipes.add(Object.assign({ name, servings: 2, items: [ingredient()] }, extra));
  const signed = { id: '3f2a9c1e-0b7d-4c55-9a1e-2b6f0d8c7e41', at: '2026-10-03T09:00:00.000Z', sig: 'a1b2c3d4' };
  const unsigned = { id: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', at: '2026-10-02T09:00:00.000Z' };
  const T = { plain: mk('QA plain'), published: mk('QA published'), old: mk('QA published by v419'), withdrawn: mk('QA withdrawn'), copy: mk('QA copy', { origin: 'shared' }) };
  assert.ok(Object.values(T).every(Boolean), 'setup: five recipes');
  DB.recipes.setShared(T.published.id, signed);
  DB.recipes.setShared(T.old.id, unsigned);
  DB.recipes.setNoAuto(T.withdrawn.id, true);
  // What the engine will read off each recipe — from the store, or from any list handed in.
  const fields = (list) => Object.fromEntries(Object.entries(T).map(([k, r]) => { const x = plain(list || blob().recipes).find((y) => y.id === r.id) || {}; return [k, { shared: x.shared, noAuto: x.noAuto, origin: x.origin }]; }));
  const want = { plain: {}, published: { shared: signed }, old: { shared: unsigned }, withdrawn: { noAuto: true }, copy: { origin: 'shared' } };
  deq(fields(), want, 'each door leaves its own field and no other: ' + json(fields()));
  // An EDIT keeps all three: the sig goes on naming what was PUBLISHED (so the
  // engine sees an edited recipe), a withdrawn recipe stays withdrawn, a copy a copy.
  for (const r of Object.values(T)) assert.ok(DB.recipes.update(r.id, { name: r.name + ' edited', servings: 3 }), 'setup: the edit saves');
  deq(fields(), want, 'an edit keeps the sig, noAuto and origin: ' + json(fields()));
  // A PULL (the stored bytes loaded again) and a RESTORE (a backup through the validator) keep them too.
  vm.runInContext('reloadState()', c);
  deq(fields(), want, 'a pull keeps them in the store: ' + json(fields()));
  deq(fields(DB.recipes.list()), want, 'and in memory: ' + json(fields(DB.recipes.list())));
  assert.equal(DB.importJSON(DB.exportJSON()), true, 'setup: a backup restores');
  deq(fields(), want, 'a restore keeps them: ' + json(fields()));

  // ── WHAT THE ENGINE STANDS ON (js/food.js) ───────────────────────────────
  const at = (id) => 'DB.recipes.list().find((x) => x.id === ' + json(id) + ')';
  // A question that throws is answered with the sentence it threw, so the
  // assertion that asked it names the defect instead of a stack.
  const ask = (code) => { try { return plain(run(code)); } catch (e) { return 'threw: ' + ((e && e.message) || e); } };
  const sig = (rec) => ask('shrSig(' + json(rec) + ')');
  const sigOf = (id) => ask('shrSig(' + at(id) + ')');
  const wants = (id) => ask('autoShareWants(' + at(id) + ')');
  const today = run('todayISO()');
  const empty = (uid) => ({ uid, day: today, n: 0, until: 0, tried: {} });
  const ledger = () => JSON.parse(values.get(keys.shareAuto) || 'null');
  const put = (o) => values.set(keys.shareAuto, typeof o === 'string' ? o : json(o));
  const save = (o) => { run('var __ledger = ' + json(o)); return ask('shrAutoSave(__ledger)'); };

  // 1. THE SIGNATURE — the recipe's CONTENT in 8 hex characters. It moves with
  // everything a reader of the published copy would see, and with nothing else.
  const base = { name: 'QA Bowl', servings: 2, items: [ingredient(), ingredient({ name: 'Chicken', qty: '150 g', calories: 248, protein: 46.5, carbs: 0, fat: 5 })] };
  const vary = (change) => { const v = JSON.parse(json(base)); change(v); return v; };
  const sig0 = sig(base);
  for (const [what, change] of [
    ['the name', (v) => { v.name = 'QA Bowl 2'; }],
    ['the servings', (v) => { v.servings = 3; }],
    ["an ingredient's name", (v) => { v.items[0].name = 'أرز بسمتي'; }],
    ['an amount', (v) => { v.items[0].qty = '250 غ'; }],
    ['the calories', (v) => { v.items[0].calories = 261; }],
    ['the protein', (v) => { v.items[0].protein = 6; }],
    ['the carbs', (v) => { v.items[0].carbs = 57; }],
    ['the fat', (v) => { v.items[0].fat = 0.7; }],
    ['an ingredient less', (v) => { v.items.pop(); }],
    ['an ingredient more', (v) => { v.items.push(ingredient({ name: 'Oil' })); }],
  ]) assert.notEqual(sig(vary(change)), sig0, 'the signature moves with ' + what);
  for (const [what, change] of [
    ["the recipe's id", (v) => { v.id = 'another-recipe'; }],
    ['its stamps (createdAt, updatedAt)', (v) => { v.createdAt = '2026-01-01T00:00:00.000Z'; v.updatedAt = '2026-10-03T09:00:00.000Z'; }],
    ['the marker', (v) => { v.shared = signed; }],
    ['noAuto', (v) => { v.noAuto = true; }],
    ['origin', (v) => { v.origin = 'shared'; }],
    ["the ingredients' ids", (v) => { v.items.forEach((it, i) => { it.id = 'item-' + i; }); }],
    ["an editor's private field on an ingredient", (v) => { v.items[0]._auto = 'done'; }],
    ['space around the name', (v) => { v.name = '  QA Bowl '; }],
    ['space around an amount', (v) => { v.items[0].qty = ' ' + v.items[0].qty + '  '; }],
    ['a figure written as a string', (v) => { v.items[0].calories = '260'; }],
  ]) assert.equal(sig(vary(change)), sig0, 'the signature does not move with ' + what);
  assert.equal(sig(vary((v) => { delete v.servings; })), sig(vary((v) => { v.servings = 1; })), 'a recipe with no servings reads as one serving');
  deq(ask('shrCanon(' + json(base) + ')'), [base.name, base.servings, base.items.map((it) => [it.name, it.qty, it.calories, it.protein, it.carbs, it.fat])],
    'the canonical form is exactly [name, servings, [[name, qty, calories, protein, carbs, fat]…]]');
  // FNV-1a, 32-bit (offset 811c9dc5, prime 01000193), over the UTF-16 units of
  // that JSON. The two answers were worked out apart from the app's spelling,
  // by BigInt arithmetic checked against the published vectors ('' → 811c9dc5,
  // 'foobar' → bf9cf968): ["QA",1,[]] and ["QA سلطة",2,[["رز","200 غ",260,5,56,0.6]]].
  assert.equal(sig({ name: 'QA', servings: 1, items: [] }), 'c08242c8', 'a known answer: FNV-1a (32-bit) over the JSON ["QA",1,[]]');
  assert.equal(sig({ name: 'QA سلطة', servings: 2, items: [ingredient()] }), '309837b5', 'a known answer with Arabic text and a fraction: every UTF-16 unit counts, whole');
  let lead = null;
  for (let i = 0; i < 400 && !lead; i++) { const x = sig(vary((v) => { v.name = 'QA pad ' + i; })); if (!/^[1-9a-f][0-9a-f]{7}$/.test(String(x))) lead = x; }
  assert.ok(/^0[0-9a-f]{7}$/.test(String(lead)), 'ALWAYS 8 lowercase hex characters — a signature that begins with a zero keeps it (DB.recipes.setShared drops any other shape): ' + json(lead));

  // 2. IS THIS RECIPE WANTED? One row per reason; each unwanted recipe differs
  // from a wanted one by that one thing. T (above) has been edited, pulled and
  // restored, and each of its recipes still carries what the question reads.
  const half = mk('QA two and a half', { servings: 2.5 });
  const zero = mk('QA no calories', { items: [ingredient({ calories: 0 })] });
  assert.ok(half && zero, 'setup: two more recipes');
  values.delete(keys.shareAuto);
  assert.equal(wants(T.plain.id), true, 'never published: wanted');
  assert.equal(wants(T.old.id), false, 'a marker with no sig (v419) counts as up to date');
  assert.equal(wants(T.withdrawn.id), false, 'taken out of sharing (noAuto): not wanted');
  assert.equal(wants(T.copy.id), false, "a copy from the community list (origin: 'shared'): not wanted");
  assert.equal(wants(half.id), false, '2.5 servings: not wanted — the Worker keeps whole servings');
  assert.equal(wants(zero.id), false, '0 kcal: not wanted');
  for (const none of ['null', 'undefined']) assert.equal(ask('autoShareWants(' + none + ')'), false, 'no recipe is not wanted: ' + none);
  // THE QUESTION IS TOTAL: a recipe whose rows are not all rows — a null among
  // them, which an imported or pulled blob may carry — is not wanted and never
  // a throw (it is asked from a render of Food; a throw there left the
  // dashboard without its click handler).
  const rowless = (items) => ({ id: 'qa-rowless', name: 'QA null row', servings: 1, items });
  assert.equal(ask('autoShareWants(' + json(rowless([null])) + ')'), false, 'items: [null] is not wanted, and does not throw');
  assert.equal(ask('autoShareWants(' + json(rowless([ingredient(), null])) + ')'), false, 'items: [row, null] is not wanted either');
  assert.equal(ask('autoShareWants(' + json(rowless([ingredient()])) + ')'), true, 'the control: the same recipe with its one real row is wanted');
  assert.equal(ask('autoShareWants(' + json(Object.assign(rowless([ingredient()]), { items: 'not a list' })) + ')'), false, 'items that are not a list: not wanted, no throw');
  // The same through the real door: a backup carrying that row restores, and
  // the stored recipe is still not wanted.
  const withNull = JSON.parse(DB.exportJSON());
  withNull.recipes.push({ id: 'qa-null-row', name: 'QA Null Row Stored', servings: 1, items: [null], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' });
  assert.equal(DB.importJSON(JSON.stringify(withNull)), true, 'setup: a backup with a null row restores');
  deq((blob().recipes.find((r) => r.id === 'qa-null-row') || {}).items, [null], 'setup: and the null row is STORED as it came (the validator keeps it)');
  assert.equal(wants('qa-null-row'), false, 'the stored recipe with a null row is not wanted: ' + json(blob().recipes.find((r) => r.id === 'qa-null-row')));
  // Published AS IT IS NOW: the marker's sig is the content's — until an edit.
  const live = Object.assign({}, signed, { sig: sigOf(T.published.id) });
  DB.recipes.setShared(T.published.id, live);
  assert.equal(blob().recipes.find((r) => r.id === T.published.id).shared.sig, live.sig, "setup: DB.recipes.setShared keeps the engine's signature: " + json(live.sig));
  assert.equal(wants(T.published.id), false, 'a marker with the sig of this very content: up to date');
  DB.recipes.update(T.published.id, { servings: 4 });
  assert.equal(wants(T.published.id), true, 'edited since it was published (the marker holds another sig): wanted again');
  // A sig that arrives by a pull is judged by nobody (setShared is the one door
  // that judges): null reads as none, and anything else that is not the
  // content's reads as changed — one re-share repairs it.
  const arriveSig = (id, value) => { const b = blob(); b.recipes.find((r) => r.id === id).shared.sig = value; values.set(keys.store, JSON.stringify(b)); vm.runInContext('reloadState()', c); };
  arriveSig(T.old.id, null);
  assert.equal(wants(T.old.id), false, 'a null sig is no sig: up to date');
  arriveSig(T.old.id, 12345678);
  assert.equal(wants(T.old.id), true, 'a sig that is not a signature reads as changed: wanted');
  // What a review refused is remembered on the DEVICE, per recipe AND per content.
  const refusal = (id, s8) => Object.assign(empty('alice'), { tried: { [id]: { sig: s8, reason: 'not_food', at: 1 } } });
  assert.equal(save(refusal(T.plain.id, sigOf(T.plain.id))), true, 'a save answers true: the refusal is written');
  assert.equal(wants(T.plain.id), false, 'refused with this very content: not sent again');
  assert.equal(wants(T.published.id), true, 'a refusal is about ITS recipe: another one is still wanted');
  DB.recipes.update(T.plain.id, { name: 'QA plain, corrected' });
  assert.equal(wants(T.plain.id), true, 'edited since it was refused (the ledger holds an older sig): wanted again');
  // A caller that already read the ledger hands it over (a backfill asks about every recipe).
  assert.equal(ask('autoShareWants(' + at(T.plain.id) + ', ' + json(refusal(T.plain.id, sigOf(T.plain.id))) + ')'), false, 'a ledger handed in is the one that is read');
  // Another account on this device does not inherit the refusal.
  save(refusal(T.plain.id, sigOf(T.plain.id)));
  s.account('bob');
  assert.equal(wants(T.plain.id), true, "another account's refusals are not this account's");
  s.account('alice');
  assert.equal(wants(T.plain.id), false, "back on the first account its refusal stands: the other account's read wrote nothing");

  // 3. THE DEVICE LEDGER — {uid, day, n, until, tried} under one registered key,
  // for the account that is signed in. Never in the blob; read clean every time.
  assert.equal(keys.shareAuto, 'vault_share_auto', 'the device ledger key is registered');
  const full = { uid: 'alice', day: today, n: 3, until: 0, tried: { [T.plain.id]: { sig: 'a1b2c3d4', reason: 'not_food', at: 5 } } };
  save(full);
  deq(ledger(), full, 'stored as exactly {uid, day, n, until, tried}');
  deq(ask('shrAutoStore()'), full, 'and read back as it was written');
  // Per account: another uid's ledger is ignored, never stamped with the new
  // uid, and replaced by that account's own first save.
  s.account('bob');
  deq(ask('shrAutoStore()'), empty('bob'), "another account's ledger is ignored: this one starts empty");
  deq([save(full), ledger()], [false, full], 'a ledger read for another account is not written under this one');
  deq([save(Object.assign(empty('bob'), { n: 1 })), ledger().uid], [true, 'bob'], "this account's own save replaces it");
  s.account('alice');
  // The count belongs to a local day; a pause is a time; neither is trusted as stored.
  put(Object.assign({}, full, { day: '2000-01-01', n: 7 }));
  deq(ask('shrAutoStore()'), Object.assign({}, full, { n: 0 }), 'a count from another day is zero, dated today — what was refused stays');
  for (const [bad, read] of [[-2, 0], ['5', 0], [3.9, 3]]) {
    put(Object.assign({}, full, { n: bad }));
    assert.equal(ask('shrAutoStore().n'), read, 'a count that is not a whole number of requests: ' + json(bad) + ' reads as ' + read);
  }
  save({ uid: 'alice', day: '2000-01-01', n: 3, until: 0, tried: {} });   // a ledger read yesterday, saved after midnight
  deq([ledger().day, ask('shrAutoStore().n')], ['2000-01-01', 0], "a count is saved under ITS day, so yesterday's is not carried into today");
  put(Object.assign({}, full, { until: Date.now() + 10 * 24 * 3600 * 1000 }));
  const until = ask('shrAutoStore().until');
  assert.ok(until > Date.now() && until <= Date.now() + 6 * 3600 * 1000, 'a pause never reaches further than one pause from now (a clock set forward, then back): ' + json(until));
  for (const bad of ['99999999999999', -5]) {
    put(Object.assign({}, full, { until: bad }));
    assert.equal(ask('shrAutoStore().until'), 0, 'a pause that is not a time reads as none: ' + json(bad));
  }
  // `tried` keeps {sig, reason, at} under a safe recipe id and nothing else.
  put('{"uid":"alice","day":' + json(today) + ',"n":1,"until":0,"tried":{"__proto__":{"sig":"ffffffff"},'
    + '"good":{"sig":"a1b2c3d4","reason":"not_food","at":5,"extra":"planted"},"bare":{"sig":"b1b2c3d4","reason":7,"at":"x"},'
    + '"bad id!":{"sig":"a1b2c3d4"},"nosig":{"reason":"x"},"numsig":{"sig":12345678},"notobj":"a1b2c3d4","nul":null}}');
  deq(ask('shrAutoStore().tried'), { good: { sig: 'a1b2c3d4', reason: 'not_food', at: 5 }, bare: { sig: 'b1b2c3d4', reason: '', at: 0 } },
    'tried keeps {sig, reason, at} under a safe id and drops the rest: ' + json(ask('shrAutoStore().tried')));
  assert.equal(ask('Object.getPrototypeOf(shrAutoStore().tried) === Object.prototype'), true, 'a "__proto__" entry never becomes the prototype of the map');
  // At most 100 refusals are kept — the newest.
  const many = empty('alice');
  for (let i = 0; i < 105; i++) many.tried['qa-' + i] = { sig: 'a1b2c3d4', reason: 'not_food', at: i };
  save(many);
  const keptIds = Object.keys(ledger().tried).map((k) => Number(k.slice(3))).sort((a, b) => a - b);
  assert.equal(keptIds.length, 100, 'at most 100 refusals are kept: ' + keptIds.length);
  deq(keptIds, Array.from({ length: 100 }, (_, i) => i + 5), 'and they are the newest ones');
  // A storage that fails is survived, both ways; and nobody's ledger is nobody's.
  put('{not json');
  deq(ask('shrAutoStore()'), empty('alice'), 'a ledger that is not JSON reads as empty');
  put(full);
  const realGet = c.localStorage.getItem;
  c.localStorage.getItem = (k) => { if (k === keys.shareAuto) throw new Error('qa: storage denied'); return realGet(k); };
  const denied = ask('shrAutoStore()');
  c.localStorage.getItem = realGet;
  deq(denied, empty('alice'), 'a storage that throws on the read is survived');
  s.fail('QuotaExceededError');
  const refusedWrite = save(full);
  s.fail('');
  assert.equal(refusedWrite, false, 'a storage that refuses the write is survived, and the save answers false');
  const lastUid = values.get(keys.lastUid);
  values.delete(keys.lastUid);
  put({ uid: '', day: today, n: 5, until: 0, tried: {} });
  deq(ask('shrAutoStore()'), empty(''), 'signed out (no last uid): an empty ledger, whatever is stored');
  deq([save({ uid: '', day: today, n: 9, until: 0, tried: {} }), ledger().n], [false, 5], 'and nothing is saved for nobody');
  values.set(keys.lastUid, lastUid);
  const realUid = c.Cloud.getLastUid;
  c.Cloud.getLastUid = () => null;
  const nobody = ask('shrAutoStore().uid');
  c.Cloud.getLastUid = realUid;
  assert.equal(nobody, '', "a Cloud whose last uid is null (the harness's offline stub) is nobody — never the string \"null\"");
  // The five figures the client is frugal by (the spec's): ms from a trigger to
  // the first step, the notice's window, the gap between two requests, the
  // requests per local day per device, the pause after «the daily limit».
  deq(ask('[SHR_AUTO_DELAY, SHR_AUTO_NOTICE_MS, SHR_AUTO_GAP, SHR_AUTO_DAY_MAX, SHR_AUTO_PAUSE_MS]'), [1500, 12000, 4000, 12, 6 * 3600 * 1000], 'the five figures: delay, notice, gap, day ceiling, pause');
  // THE PUBLISHED COPIES AN UNDO LEAVES BEHIND (shrOrphanedIds): the marker ids
  // of the recipes present WITH a marker in the list before the Undo and absent
  // from the list after it — what applyConvenienceUndo (js/app.js) withdraws
  // when the Undo of an add removes a recipe automatic sharing published.
  const m = (id, pub) => Object.assign({ id, name: id, servings: 1, items: [] }, pub ? { shared: { id: pub, at: '2026-10-03T09:00:00.000Z' } } : {});
  const before = [m('a', 'pub-a'), m('b', 'pub-b'), m('c'), m('d', ''), null, m('e', 'pub-e'), { id: 'f', shared: { at: 'x' } }];
  const orphans = (b, a) => ask('shrOrphanedIds(' + json(b) + ', ' + json(a) + ')');
  deq(orphans(before, [m('a', 'pub-a'), m('c')]), ['pub-b', 'pub-e'], 'the recipes gone from the list, by their published ids — a present one, one with no marker, an empty id, a null row and a marker with no id are never named: ' + json(orphans(before, [m('a', 'pub-a'), m('c')])));
  deq(orphans(before, before), [], 'nothing gone (the Undo of an edit or a delete): nothing to withdraw');
  deq(orphans(before, [m('b')]), ['pub-a', 'pub-e'], 'a recipe still present — without its marker — is still present');
  deq(orphans([], [m('a', 'pub-a')]), [], 'a recipe that only ARRIVED (a delete undone) is nothing to withdraw');
  for (const bad of ['null', 'undefined', '"x"', '{}', '7']) deq(ask('shrOrphanedIds(' + bad + ', ' + bad + ')'), [], 'what is not a list answers none: ' + bad);
  // 4. THE QUEUE — a trigger only QUEUES: ids once each and ONE timer, the
  // engine's. Read off the timers it arms, which are recorded here and never
  // run: nothing in this suite sends. The gap after a request holds for the
  // next trigger too — bounded by the gap itself — and a hold only extends.
  const armed = [];
  const realSet = c.setTimeout, realClear = c.clearTimeout;
  c.setTimeout = (fn, ms) => { armed.push([fn && fn.name, ms]); return 'qa-timer-' + armed.length; };
  c.clearTimeout = () => {};
  const idle = (then) => { armed.length = 0; run('__autoQueue.length = 0; __autoTimer = null; __autoBusy = false; __autoNextAt = 0; __autoHoldUntil = 0; ' + (then || '')); };
  try {
    idle('queueAutoShare(["a", "b", "a"]); queueAutoShare(["b", "c"]);');
    deq(ask('__autoQueue'), ['a', 'b', 'c'], 'ids join the queue once each, in the order they came');
    deq(armed, [['runAutoShare', 1500]], "ONE timer for all of them — the engine's, SHR_AUTO_DELAY after the first trigger: " + json(armed));
    idle('queueAutoShare("abc"); queueAutoShare([7, "", null, undefined, { id: "x" }]); queueAutoShare(); queueAutoShare([]);');
    deq([ask('__autoQueue'), armed], [[], []], 'what is not a list of ids queues nothing and arms nothing');
    idle('__autoBusy = true; queueAutoShare(["a"]);');
    deq([ask('__autoQueue'), armed], [['a'], []], 'while a step is in flight the id waits and no timer is armed — the step arms the next one itself');
    idle('__autoNextAt = Date.now() + 3000; queueAutoShare(["a"]);');
    assert.ok(armed.length === 1 && armed[0][0] === 'runAutoShare' && armed[0][1] > 2500 && armed[0][1] <= 3000, 'inside the gap after a request, a trigger waits out the rest of it: ' + json(armed));
    idle('__autoNextAt = Date.now() + 500; queueAutoShare(["a"]);');
    deq(armed, [['runAutoShare', 1500]], 'never sooner than the delay: ' + json(armed));
    idle('__autoNextAt = Date.now() + 10 * 3600 * 1000; queueAutoShare(["a"]);');
    deq(armed, [['runAutoShare', 4000]], 'never later than one gap — a clock set back cannot park the queue: ' + json(armed));
    idle('autoShareHold(11000);');
    const held = ask('__autoHoldUntil - Date.now()');
    assert.ok(held > 10000 && held <= 11000, 'a hold lasts as long as it was asked for: ' + json(held));
    run('autoShareHold(2000); autoShareHold("soon"); autoShareHold(-5000); autoShareHold();');
    const still = ask('__autoHoldUntil - Date.now()');
    assert.ok(still > 10000 && still <= 11000, 'a shorter hold, or one that is not a time, never shortens it: ' + json(still));
  } finally {
    c.setTimeout = realSet; c.clearTimeout = realClear;
    idle();
  }
  // Swept on logout with the account's other residue…
  save(full);
  c.Cloud.clearLocalUserData();
  assert.ok(!values.has(keys.shareAuto), 'clearLocalUserData sweeps it — the next account must not inherit a count, a pause or recipe ids');
  // …and the account that signs in next starts from nothing: the ledger lives
  // in storage alone, never in a copy the page keeps.
  s.account('alice');
  deq(ask('shrAutoStore()'), empty('alice'), 'after the sweep the next sign-in reads an empty ledger');
  await tick();
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
    console.log(`PASS shared recipes: ${cases.length} cases — the meal period, the ranking, the cleaning and the saved copy (food.js); the shared marker outside the undo ledger and normalised at every door (storage.js); shareRecipe signed-in, share-only, field by field, never cached (foodai.js); the list by named columns, approved only, cached per account, the items memoised, the withdraw by its literal args, swept on logout (cloud.js); the harness stubs and the raw-key net; automatic sharing's data layer — a copy stored with its origin, the marker's sig by name, noAuto outside the ledger, the two prefs read strictly, the device ledger swept on logout — and what its engine stands on: the content signature (FNV-1a, always 8 hex, moved by the content alone), the one question «is this recipe wanted?» over every reason, the device ledger per account, per day and survived when storage fails, the queue a trigger fills (ids once, one timer, the gap kept for the next trigger) and a hold that only extends; and the review's fixes — the ledger following the marker and noAuto, so every recipes Undo stays applicable after automatic sharing wrote; the question total over a null row (never a throw out of a render); the published ids an Undo leaves behind`);
  }
})();
