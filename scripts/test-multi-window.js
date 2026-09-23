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

// Sign the device in as `user` once through `entry`, the way a normal boot
// does, so the guard records the address that uid signed in with. Returns
// nothing; the requests it makes are not the test's business.
async function bootAs(s, entry, user) {
  s.session({ user });
  s.query(async () => ({ data: null, error: null }));
  await s.c.Cloud[entry]();
}

// ── V-03 a foreign blob is preserved under its own owner and never uploaded ──
// `emails`: the same scenario with both accounts carrying an address — and two
// DIFFERENT addresses, which is a shared phone, so the v351 answer must hold
// exactly as it did before the same-person case existed.
async function foreignBlobIsNeverAdopted(entry, emails) {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const alice = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  if (emails) {
    await bootAs(s, entry, { id: 'alice', email: 'Alice@Example.invalid' });
    assert.ok(values.has(keys.lastEmail), 'a boot records the address its uid signed in with');
    assert.equal(JSON.parse(values.get(keys.lastEmail)).email, 'alice@example.invalid', 'a boot records the address its uid signed in with, lower-cased');
  }

  // THE REAL TRIGGER, and it is not "go offline and tap Logout": offline with a
  // valid token makes signOut() fail and the user stays signed in. It is a
  // logout whose PUSH failed — another device advanced the row, a 5xx, a banned
  // account — where app.js deliberately KEEPS the unpushed blob.
  s.session({ user: emails ? { id: 'bob', email: 'bob@example.invalid' } : { id: 'bob' } });
  assert.equal(c.Cloud.getLastUid(), 'alice', 'the device still carries the previous owner');
  assert.equal(c.Cloud.localHasData(), true, 'and still carries their data');

  // The blob is not the only residue: the photo side store and the reminder log
  // are device-local too, and "user B on a shared phone read user A's log" is a
  // failure this project has already paid for once.
  values.set(keys.img + 'alice-ex', 'data:image/jpeg;base64,AAAA');
  values.set(keys.notifLog, '[{"text":"alice reminder"}]');

  const requests = [];
  s.query(async (r) => { requests.push(r); return { data: null, error: null }; });   // bob's row is empty
  assert.notEqual(await c.Cloud[entry](), 'duplicate', 'two different addresses are two people, never "the same person"');

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
  if (emails) assert.deepEqual(JSON.parse(values.get(keys.lastEmail)), { uid: 'bob', email: 'bob@example.invalid' }, 'after the sweep the address describes the new owner');
}

// ── the SAME PERSON, a SECOND ACCOUNT: held, never swept, never uploaded ─────
// «Continue with Google» can make a new uid for an address that already has an
// account (Supabase links only to a CONFIRMED address). Treating that as a
// shared phone swept the person's own history into the one rescue slot — which
// a second bounce overwrites and a logout deletes — and the app looked empty.
async function sameEmailSecondAccountIsHeld(entry) {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  await bootAs(s, entry, { id: 'alice', email: 'owner@example.invalid' });
  values.set(keys.img + 'mine-ex', 'data:image/jpeg;base64,AAAA');
  values.set(keys.notifLog, '[{"text":"my reminder"}]');
  const storeBefore = values.get(keys.store);

  // The same address, typed differently: Supabase lower-cases, a person may not.
  s.session({ user: { id: 'alice-google', email: 'OWNER@example.invalid' } });
  const requests = [];
  s.query(async (r) => { requests.push(r); return { data: null, error: null }; });
  assert.equal(await c.Cloud[entry](), 'duplicate', 'the sync stops and says why');

  assert.equal(values.get(keys.store), storeBefore, 'the blob is byte-for-byte where it was');
  assert.ok(c.DB.sessions.listAll().some((x) => x.id === mine.id), 'and the app still shows it');
  assert.equal(c.Cloud.getLastUid(), 'alice', 'the device still says whose it is');
  assert.equal(values.get(keys.img + 'mine-ex'), 'data:image/jpeg;base64,AAAA', 'photos kept');
  assert.equal(values.get(keys.notifLog), '[{"text":"my reminder"}]', 'reminder log kept');
  const rescue = values.get(keys.recovery);
  assert.notEqual(rescue ? JSON.parse(rescue).reason : '', 'foreign-account', 'nothing was swept into the rescue slot');
  // One row DOES leave: the client_errors note that this happened, so the owner
  // can see it in the console. It names no address and carries no data.
  const toRow = () => requests.filter((r) => r.table !== 'client_errors');
  assert.equal(toRow().length, 0, 'not one read or write reached the second account\'s row');
  assert.equal(JSON.stringify(requests).toLowerCase().includes('owner@'), false, 'the address is never reported');

  // A save fires a push BEFORE the next guard runs; it must refuse too.
  c.DB.prefs.setUnit('lb');
  assert.equal(await c.Cloud.push(), 'duplicate', 'a push as the second account is refused');
  assert.equal(toRow().length, 0, 'and it sent nothing');

  // Back as the original account, everything is ordinary again.
  s.session({ user: { id: 'alice', email: 'owner@example.invalid' } });
  assert.notEqual(await c.Cloud[entry](), 'duplicate', 'the original account syncs as before');

  // The address describes LAST_UID_KEY, so a logout's sweep takes it too — the
  // next person on this phone must not be judged against the last one's address.
  c.Cloud.clearLocalUserData();
  assert.equal(values.has(keys.lastEmail), false, 'logout sweeps the remembered address');
}

// ── the deliberate way out: the hold is released and the v351 sweep runs ──────
// «Continue with this account» rescues the previous account's blob under ITS
// uid, sweeps the device, and hands it to the new uid — after which neither a
// sync nor a push reads as a second account.
async function releaseSweepsUnderTheOldUid(entry) {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  await bootAs(s, entry, { id: 'alice', email: 'owner@example.invalid' });
  values.set(keys.img + 'mine-ex', 'data:image/jpeg;base64,AAAA');
  s.session({ user: { id: 'alice-google', email: 'owner@example.invalid' } });
  s.query(async () => ({ data: null, error: null }));
  assert.equal(await c.Cloud[entry](), 'duplicate', 'held first');
  assert.equal(await c.Cloud.releaseDuplicateHold(), true, 'the hold is released on request');
  const rescue = JSON.parse(values.get(keys.recovery) || 'null');
  assert.ok(rescue && rescue.reason === 'foreign-account' && rescue.uid === 'alice', 'the previous account\'s blob is rescued under ITS uid');
  assert.ok(String(rescue.raw).includes(mine.id), 'and the rescue holds the data');
  assert.ok(!(values.get(keys.store) || '').includes(mine.id), 'the device no longer shows it');
  assert.equal(values.has(keys.img + 'mine-ex'), false, 'the photo side store went with it');
  assert.equal(c.Cloud.getLastUid(), 'alice-google', 'the device now belongs to the second account');
  assert.deepEqual(JSON.parse(values.get(keys.lastEmail)), { uid: 'alice-google', email: 'owner@example.invalid' }, 'and the address describes it');
  assert.notEqual(await c.Cloud[entry](), 'duplicate', 'the next sync no longer reads as a second account');
  c.DB.prefs.setUnit('lb');
  assert.notEqual(await c.Cloud.push(), 'duplicate', 'nor does a push');
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

// ── V-03, the failure the first fix ignored: the rescue cannot be written ────
// snapshotRaw returns false on a quota error. The v351 guard discarded that and
// swept the device anyway — so on a full phone the previous account's data was
// DESTROYED by the code whose comment promised to keep it.
async function foreignBlobSurvivesARescueFailure() {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const alice = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  s.session({ user: { id: 'bob' } });
  s.fail('QuotaExceededError');                       // every setItem throws from here
  s.query(async () => ({ data: null, error: null }));
  await c.Cloud.resolveOnLogin();
  s.fail('');
  assert.ok((values.get(keys.store) || '').includes(alice.id), 'no rescue → no sweep: the previous account\'s blob is untouched');
  assert.equal(c.Cloud.getLastUid(), 'alice', 'and the device still says whose it is');
  assert.equal(values.has(keys.recovery), false, 'nothing half-written in the rescue slot');
}

// ── restoreRecovery reports the upload half honestly ─────────────────────────
async function restoreSaysWhichHalf() {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  values.set(keys.recovery, JSON.stringify({ at: '2026-09-15T00:00:00.000Z', reason: 'test', raw: values.get(keys.store), uid: 'alice' }));
  c.DB.sessions.remove(mine.id);
  s.query(async () => { throw new Error('network down'); });
  const r = await c.Cloud.restoreRecovery();
  assert.equal(r && r.restored, true, 'restored on the device');
  assert.equal(r.uploaded, false, 'and it says the upload did not happen');
  assert.ok(c.DB.sessions.listAll().some((x) => x.id === mine.id), 'the data is back');
  s.query(async () => ({ data: [{ version: 9 }], error: null }));
  values.set(keys.recovery, JSON.stringify({ at: '2026-09-15T00:00:00.000Z', reason: 'test', raw: values.get(keys.store), uid: 'alice' }));
  const r2 = await c.Cloud.restoreRecovery();
  assert.equal(r2.uploaded, true, 'uploaded when the push lands');
}

async function run() {
  await foreignBlobSurvivesARescueFailure();
  await restoreSaysWhichHalf();
  lossWithoutTheListener();
  noLossWhenDelivered();
  refusesWhatItCannotTrust();
  staleIsNotAStorageFailure();
  // BOTH entry points reach the same pushed() branch, so both need the guard.
  for (const entry of ['resolveOnLogin', 'bootSync']) {
    await foreignBlobIsNeverAdopted(entry);
    await foreignBlobIsNeverAdopted(entry, true);
    await sameAccountIsUntouched(entry);
    await sameEmailSecondAccountIsHeld(entry);
    await releaseSweepsUnderTheOldUid(entry);
  }
  console.log('PASS multi-window: sibling writes adopted not overwritten, STALE recorded, READ-ONLY and garbage refused, photos kept; a foreign blob is rescued under its own uid and never uploaded (login + boot, with and without addresses), and never swept when the rescue cannot be written; a same-address second account is held — nothing swept, pulled or pushed (login + boot + push) — and released on request by the same sweep under the old uid; restore reports its upload half');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
