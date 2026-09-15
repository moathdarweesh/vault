// TWO WINDOWS, AND TWO ACCOUNTS ON ONE DEVICE — the real storage.js and cloud.js
// in an isolated vm. No network, no personal data.
//
// Both defects this suite pins down were found by the v350 audit and reproduced
// before they were fixed, and both are invisible to a single-document test,
// which is every other suite in this project:
//
//   V-02  two documents of one origin silently destroyed each other's data. A
//         sibling write was refused by changeSlice but NOT recorded, and the
//         next PLAIN save (writeStore has no staleness guard) rewrote the whole
//         blob from stale memory — then Cloud.onLocalChange flagged the loss for
//         upload and the conditional UPDATE was accepted.
//
//   V-03  a shared device showed the next account the previous user's data and
//         let it upload into its own cloud row. Every sync path asked "does the
//         device have data?" and none asked "whose?".
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { context } = require('./test-sync-status');

const DAY = '2026-09-15';
const firstExercise = (c) => c.DB.exercises.list()[0].id;

/* What ANOTHER document of this origin does: it writes the store directly, from
   its own STATE. This one's STATE never sees it. */
function siblingWrite(s, mutate) {
  const blob = JSON.parse(s.values.get(s.keys.store));
  mutate(blob);
  s.values.set(s.keys.store, JSON.stringify(blob));
}
/* The `storage` event fires ONLY in the other documents of an origin — which is
   exactly the population that would otherwise overwrite this one. */
function deliverStorage(s, key) {
  s.c.dispatchEvent({ type: 'storage', key, newValue: s.values.get(key) ?? null });
}
const SIBLING = { id: 'sibling1', exerciseId: '', date: DAY, sets: [{ reps: 10, weight: 60 }], createdAt: DAY + 'T10:00:00.000Z' };

// ── V-02 (a) the loss, and that the refusal is now legible ───────────────────
function lossWithoutTheListener() {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 8, weight: 40 }] });
  siblingWrite(s, (b) => b.sessions.push({ ...SIBLING, exerciseId: ex }));

  // A transaction refuses, exactly as before — but it now SAYS SO. This used to
  // return STALE to its caller and leave lastSaveResult untouched, so the save
  // centre read {ok:true} and showed "the latest change was not saved".
  const refused = c.DB.recipes.remove('nothing');
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'STALE');
  assert.equal(c.DB.saveState().ok, false, 'the refusal reaches DB.saveState()');
  assert.equal(c.DB.saveState().code, 'STALE');

  // …and this is the loss itself: a PLAIN save has no staleness guard, so it
  // rewrites the whole blob from a STATE that never saw the sibling's work.
  c.DB.prefs.setUnit('lb');
  const after = JSON.parse(values.get(keys.store));
  assert.ok(after.sessions.some((x) => x.id === mine.id));
  assert.equal(after.sessions.some((x) => x.id === SIBLING.id), false,
    'undelivered: the plain save is what destroyed the sibling — this is the defect, reproduced');
}

// ── V-02 (b) with the event delivered, nothing is lost ───────────────────────
function noLossWhenDelivered() {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 8, weight: 40 }] });
  assert.ok(c.DB.undo.list().length > 0, 'the transaction left an undo entry');

  // A photo whose exercise is NOT in the blob. reloadState() would prune it;
  // adoption must not, because photos are device-local and the sibling's write
  // is not a deliberate whole-blob replacement.
  values.set(keys.img + 'ghost', 'data:image/jpeg;base64,AAAA');

  siblingWrite(s, (b) => b.sessions.push({ ...SIBLING, exerciseId: ex }));
  deliverStorage(s, keys.store);

  assert.ok(s.events.includes('vault:store-adopted'), 'app.js is told to repaint');
  assert.ok(s.events.includes('vault:save-state'), 'and the save centre is told the bytes moved');
  assert.equal(c.DB.sessions.listAll().filter((x) => x.id === SIBLING.id).length, 1, 'adopted into STATE');
  assert.equal(values.get(keys.img + 'ghost'), 'data:image/jpeg;base64,AAAA',
    'adoption must never prune the device-local photo store');
  assert.equal(c.DB.undo.list().length, 0, 'an undo whose before-state no longer exists is not an undo');
  assert.equal(c.DB.saveState().ok, true, 'and the app is not left wedged');

  // The write that used to destroy the sibling now carries it.
  c.DB.prefs.setUnit('lb');
  const after = JSON.parse(values.get(keys.store));
  assert.ok(after.sessions.some((x) => x.id === mine.id));
  assert.ok(after.sessions.some((x) => x.id === SIBLING.id), 'the sibling survives the next plain save');
  assert.equal(after.prefs.unit, 'lb', 'and this document keeps its own change');
  // The transaction path is no longer refused either.
  assert.equal(c.DB.recipes.remove('nothing').ok, true);
}

// ── V-02 (c) what must NOT be adopted ────────────────────────────────────────
function refusesWhatItCannotTrust() {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 8, weight: 40 }] });
  const before = c.DB.sessions.listAll().length;

  // READ-ONLY: the stored blob here is unreadable, and adopting is not the
  // deliberate replacement that may lift it. reloadState() clears the flag
  // unconditionally, which is exactly why this is not reloadState().
  vm.runInContext('STATE_LOAD_FAILED = true', c);
  siblingWrite(s, (b) => b.sessions.push({ ...SIBLING, exerciseId: ex }));
  deliverStorage(s, keys.store);
  assert.equal(c.DB.loadFailed(), true, 'READ-ONLY survives a sibling write');
  assert.equal(s.events.includes('vault:store-adopted'), false);
  assert.equal(c.DB.sessions.listAll().length, before, 'and STATE is untouched');
  vm.runInContext('STATE_LOAD_FAILED = false', c);

  // An unrelated key is not this document's business.
  s.events.length = 0;
  deliverStorage(s, keys.ui);
  assert.equal(s.events.includes('vault:store-adopted'), false);

  // Garbage — a half-written blob, a quota-truncated write — is never adopted.
  values.set(keys.store, '{ not json');
  deliverStorage(s, keys.store);
  assert.equal(c.DB.sessions.listAll().length, before, 'garbage is never adopted');
  assert.equal(s.events.includes('vault:store-adopted'), false);

  // Nor is a CLEAR: another document logging out removes the key entirely, and
  // treating that as a blob would wipe this document's STATE.
  values.delete(keys.store);
  deliverStorage(s, keys.store);
  assert.equal(c.DB.sessions.listAll().length, before, 'a removal is not a blob');
  assert.equal(s.events.includes('vault:store-adopted'), false);
}

// ── V-02 (d) the save centre must not blame the storage ──────────────────────
function staleIsNotAStorageFailure() {
  const s = context(), { c } = s;
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/app.js'), 'utf8');
  vm.runInContext(app.slice(app.indexOf('function saveCenterModel('), app.indexOf('function updateSaveCenter(')), c);
  const cloud = { status: 'synced' };
  assert.equal(c.saveCenterModel({ ok: false, code: 'STALE' }, cloud).detailKey, 'sc_stale');
  assert.equal(c.saveCenterModel({ ok: false, code: 'QUOTA' }, cloud).detailKey, 'sc_quota');
  assert.equal(c.saveCenterModel({ ok: false, code: 'READ_ONLY' }, cloud).detailKey, 'sc_readonly');
  assert.equal(c.saveCenterModel({ ok: false, code: 'WRITE_FAILED' }, cloud).detailKey, 'sc_write_failed');
}

// ── V-03 a foreign blob is preserved under its own owner and never uploaded ──
async function foreignBlobIsNeverAdopted(entry) {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const alice = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });

  // THE REAL TRIGGER, and it is not "go offline and tap Logout": offline with a
  // valid token makes signOut() fail and the user stays signed in. It is a
  // logout whose PUSH failed — another device advanced the row, a 5xx, a banned
  // account — where app.js deliberately KEEPS the unpushed blob.
  s.session({ user: { id: 'bob' } });
  assert.equal(c.Cloud.getLastUid(), 'alice', 'the device still carries the previous owner');
  assert.equal(c.Cloud.localHasData(), true, 'and still carries their data');

  // The blob is not the only residue: the photo side store and the reminder log
  // are device-local too, and "user B on a shared phone read user A's log" is a
  // failure this project has already paid for once.
  values.set(keys.img + 'alice-ex', 'data:image/jpeg;base64,AAAA');
  values.set(keys.notifLog, '[{"text":"alice reminder"}]');

  const requests = [];
  s.query(async (r) => { requests.push(r); return { data: null, error: null }; });   // bob's row is empty
  await c.Cloud[entry]();

  assert.equal((values.get(keys.store) || '').includes(alice.id), false,
    "the previous account's blob is off the device");
  assert.equal(c.DB.hasUserData(), false, 'so localHasData() sends the sync down the plain pull path');
  assert.equal(c.Cloud.getLastUid(), 'bob');
  assert.equal(values.get(keys.img + 'alice-ex'), undefined, "the previous account's photos are off the device");
  assert.equal(values.get(keys.notifLog), undefined, "and so is their reminder log");

  const wire = JSON.stringify(requests.map((r) => (r.rows === undefined ? null : r.rows)));
  assert.equal(wire.includes(alice.id), false, "nothing of alice's was ever offered to bob's row");

  const rescue = JSON.parse(values.get(keys.recovery));
  assert.equal(rescue.reason, 'foreign-account');
  assert.equal(rescue.uid, 'alice', 'the rescue is stamped with its REAL owner, not the incoming one');
  assert.ok(rescue.raw.includes(alice.id), 'the data is preserved, not discarded');
  assert.equal(c.Cloud.recoveryInfo(), null, 'and bob is never offered a Restore of it');
  values.set(keys.lastUid, 'alice');
  assert.ok(c.Cloud.recoveryInfo(), 'its owner is offered it when they sign back in');
}

// ── V-03 the negative control: one account's own device is left alone ────────
async function sameAccountIsUntouched(entry) {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  s.query(async () => ({ data: null, error: null }));
  await c.Cloud[entry]();
  assert.ok((values.get(keys.store) || '').includes(mine.id), 'the same account keeps its own data');
  const rescue = values.get(keys.recovery);
  assert.notEqual(rescue ? JSON.parse(rescue).reason : '', 'foreign-account',
    'nothing is treated as foreign when the uid has not changed');
}

async function run() {
  lossWithoutTheListener();
  noLossWhenDelivered();
  refusesWhatItCannotTrust();
  staleIsNotAStorageFailure();
  // BOTH entry points reach the same pushed() branch, so both need the guard.
  for (const entry of ['resolveOnLogin', 'bootSync']) {
    await foreignBlobIsNeverAdopted(entry);
    await sameAccountIsUntouched(entry);
  }
  console.log('PASS multi-window: sibling writes adopted not overwritten, STALE recorded, READ-ONLY and garbage refused, photos kept; a foreign blob is rescued under its own uid and never uploaded (login + boot)');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
