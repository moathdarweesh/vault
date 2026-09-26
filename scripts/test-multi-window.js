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

// ── no rescue → no sweep → NO UPLOAD EITHER (access-control audit 2026-09-27) ──
// The case above proved the blob stays; it never asked where the sync went
// NEXT. With the device left as it was, both entry points went on as if it
// were bob's: bob's row is empty, so they reached pushed() and INSERTED
// alice's whole history into bob's account — pushOnce asked only «same
// address?», never «whose data?». The guard answers 'held' now, both callers
// stop on it exactly as on 'duplicate', and a push fired by a save refuses.
async function rescueFailureNeverUploads(entry) {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const alice = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 5, weight: 100 }] });
  await bootAs(s, entry, { id: 'alice', email: 'alice@example.invalid' });
  s.session({ user: { id: 'bob', email: 'bob@example.invalid' } });   // a shared phone: two addresses
  const requests = [];
  s.query(async (r) => { requests.push(r); return { data: null, error: null }; });   // bob's row is empty
  s.fail('QuotaExceededError');                       // the rescue cannot be written
  const r = await c.Cloud[entry]();
  s.fail('');
  const offered = () => JSON.stringify(requests.filter((q) => q.kind !== 'read' && q.table !== 'client_errors').map((q) => q.rows));
  assert.equal(offered().includes(alice.id), false, "alice's history was offered to bob's row by " + entry + ': ' + offered().slice(0, 120));
  assert.equal(r, 'held', entry + ' says the device is held, not synced: ' + r);
  assert.ok((values.get(keys.store) || '').includes(alice.id), 'the blob is untouched');
  assert.equal(c.Cloud.getLastUid(), 'alice', 'and the device still says whose it is');
  // A save fires a push BEFORE the next guard runs; it must refuse on its own.
  c.DB.prefs.setUnit('lb');
  requests.length = 0;
  assert.equal(await c.Cloud.push(), 'held', 'a push while the device is held is refused');
  assert.equal(offered().includes(alice.id), false, 'and it offered nothing');
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

// ── TWO WINDOWS PUSHING AT ONCE ARE ONE ACCOUNT, NOT A CONFLICT ──────────────
// push() was serialised INSIDE one document (`inFlight`) and nowhere else,
// while everything it decides by — the version, the pushing stamp, the store
// itself — is shared localStorage. Window B read the base version while window
// A's upload was still answering; B's conditional UPDATE then matched no row,
// the probe found A's bytes (≠ B's: B saved in between) and B reported a
// CONFLICT against data this very store holds. Logged after the fact, when A
// had already written the new version: `localVer == remoteVer` — the nine
// client_errors rows CLAUDE.md records as the app raising a conflict against
// itself.
//
// ONE vault_data ROW, answering the way PostgREST does: a conditional UPDATE
// matches only at the given version. `hold(q)` keeps a reply on the wire (the
// write itself has committed) until `release()`.
function row(initial) {
  const r = { version: 1, data: initial, updated_at: '2026-09-15T08:00:00.000Z', errors: [], release: null };
  r.serve = (hold) => async (q) => {
    if (q.table === 'client_errors') { r.errors.push(q.rows); return { data: null, error: null }; }
    if (q.kind === 'update') {
      const want = (q.filters.find(([k]) => k === 'version') || [])[1];
      let answer = { data: [], error: null };
      if (want === r.version) { r.version++; r.data = q.rows.data; r.updated_at = q.rows.updated_at; answer = { data: [{ version: r.version }], error: null }; }
      if (hold && hold(q)) return new Promise((resolve) => { r.release = () => { r.release = null; resolve(answer); }; });
      return answer;
    }
    if (q.fields === 'updated_at,version') return { data: { version: r.version, updated_at: r.updated_at }, error: null };
    return { data: { data: r.data, version: r.version, updated_at: r.updated_at }, error: null };
  };
  return r;
}
// A Web Locks manager two contexts share: `request` runs callbacks for one name
// one at a time, in arrival order, holding the lock until the callback settles.
function lockManager() {
  const chains = new Map();
  return { request(name, fn) { const run = (chains.get(name) || Promise.resolve()).then(() => fn({ name })); chains.set(name, run.catch(() => {})); return run; } };
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const conflictsIn = (server) => server.errors.filter((e) => e && e.kind === 'sync-conflict');

// With Web Locks the two uploads simply queue. Without them (an engine that has
// none) the second must still recognise the first — and the first's reply,
// arriving LAST, must not wind the shared version back under the second's.
async function twoWindowsPushTogether(withLocks) {
  const locks = withLocks ? lockManager() : null;
  const a = context({ locks }), b = context({ values: a.values, locks });
  deliverStorage(a, a.keys.store);                        // B's boot migration rewrote the store; A hears of it, as a browser tells it
  const ex = firstExercise(a.c);
  const server = row(JSON.parse(a.c.DB.exportJSON()));
  let first = true;
  const hold = (q) => { const h = first; first = false; return h; };   // A's upload commits; its reply is slow
  a.query(server.serve(hold)); b.query(server.serve(null));

  const setA = a.c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 8, weight: 60 }] });
  deliverStorage(b, a.keys.store);                        // B adopts A's set
  await settle();
  const pa = a.c.Cloud.push();                            // A: base v1 → v2 committed, reply on the wire
  await settle();
  b.c.DB.prefs.setUnit('lb');                             // B saves in between
  deliverStorage(a, a.keys.store);
  await settle();
  const pb = b.c.Cloud.push();                            // B: must not decide by a version A is still answering for
  await settle();
  if (server.release) server.release();
  const [ra, rb] = [await pa, await pb];
  assert.equal(ra, 'ok', 'window A uploads');
  assert.equal(rb, 'ok', "window B's push called window A's upload a conflict — one store, two windows, one account");
  assert.equal(conflictsIn(server).length, 0, 'and nothing was reported as a sync conflict');
  assert.ok(JSON.stringify(server.data.sessions).includes(setA.id), "the row holds A's set");
  assert.equal(server.data.prefs.unit, 'lb', "and B's change on top of it");
  assert.equal(Number(a.values.get(a.keys.ver + 'alice')), server.version, 'the shared version names the row as it is, not as the slower reply last saw it');
}

// Without Web Locks (an engine that has none), the one ordering that can still
// be recognised: the sibling's upload ANSWERED while this one was on the wire,
// so the shared version already names the row the probe finds. That row is one
// this store has incorporated — retry once, CONDITIONALLY, from a fresh export.
async function siblingLandedWhileThisOneWasOut() {
  const s = context(), { c, values, keys } = s;
  const ex = firstExercise(c);
  const server = row(JSON.parse(c.DB.exportJSON()));
  c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 8, weight: 60 }] });
  await settle();
  const sibling = JSON.parse(values.get(keys.store));    // what the sibling window pushed…
  const mine = c.DB.sessions.add({ exerciseId: ex, date: DAY, sets: [{ reps: 6, weight: 70 }] });   // …before this save
  await settle();
  const serve = server.serve(null);
  s.query(async (q) => {
    if (q.kind === 'update' && server.version === 1) {
      server.version = 2; server.data = sibling; server.updated_at = '2026-09-15T08:00:05.000Z';
      values.set(keys.ver + 'alice', '2');                // the sibling's answer, landed in the shared version
      c.DB.prefs.setUnit('lb');                           // and this window saved once more
      return { data: [], error: null };                   // this UPDATE matched nothing
    }
    return serve(q);
  });
  assert.equal(await c.Cloud.push(), 'ok', "a sibling window's upload that answered first is not a conflict");
  assert.equal(conflictsIn(server).length, 0, 'and nothing was reported as one');
  assert.equal(server.version, 3, 'the retry was a conditional write on the version the sibling produced');
  assert.ok(JSON.stringify(server.data.sessions).includes(mine.id), "this window's set reached the row");
  assert.equal(server.data.prefs.unit, 'lb', "and the retry sent a FRESH export — the save made while the first attempt was out is in it");
}

// The detection that must not weaken: a row moved by ANOTHER DEVICE — the shared
// version does not name it and no stamp of ours matches it — is a real conflict.
async function anotherDeviceIsStillAConflict() {
  const s = context(), { c } = s;
  const server = row(JSON.parse(c.DB.exportJSON()));
  server.version = 2; server.updated_at = '2026-09-15T09:00:00.000Z';
  server.data = { ...server.data, sessions: [{ id: 'phone1', exerciseId: firstExercise(c), date: DAY, sets: [{ reps: 1, weight: 1 }], createdAt: DAY + 'T09:00:00.000Z' }] };
  c.DB.sessions.add({ exerciseId: firstExercise(c), date: DAY, sets: [{ reps: 8, weight: 60 }] });
  await settle();
  s.query(server.serve(null));
  assert.equal(await c.Cloud.push(), 'conflict', 'a row another device moved is still a conflict');
  assert.equal(server.version, 2, 'and nothing was written over it');
  const note = conflictsIn(server).map((e) => e.msg).join(' ');
  assert.ok(/sentVer=1\b/.test(note), 'the note records the version this push was based on: ' + note);
  assert.ok(note.includes('remoteStamp=2026-09-15T09:00:00'), "and the row's own stamp: " + note);
}

// ── A LINK CANNOT SWAP THE ACCOUNT ON THIS DEVICE (login CSRF) ───────────────
// The client ran on the SDK's defaults: implicit flow, detectSessionInUrl on.
// Its _initialize() saved ANY session sitting in the URL fragment — no check
// that one was already stored, none that this browser had started a sign-in —
// so a link built from someone else's OWN tokens (#access_token=…) signed this
// device into their account, and guardForeignBlob then swept the owner's
// history aside as a shared phone. The REAL vendored SDK runs here, with
// cloud.js's own options; only the network is faked — GoTrue's /user answers
// for any valid token, and an attacker's own token is a valid one.
const SDK = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/vendor/supabase.js'), 'utf8');
const AUTH_KEY = 'sb-ilmusnuchqlpirywonzx-auth-token';
function jwt(sub) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, exp: now + 3600, iat: now, role: 'authenticated' }) + '.sig';
}
const fragment = (sub, type) => '#access_token=' + jwt(sub) + '&expires_in=3600&refresh_token=r-' + sub + '&token_type=bearer' + (type ? '&type=' + type : '');
const storedSession = (uid) => JSON.stringify({ access_token: jwt(uid), refresh_token: 'r-' + uid, expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: uid, aud: 'authenticated', email: uid + '@example.invalid' } });
async function linkArrives({ hash, signedIn, lastUid, withData, googleStarted }) {
  const s = context(), { c, values, keys } = s;
  if (withData) c.DB.sessions.add({ exerciseId: firstExercise(c), date: DAY, sets: [{ reps: 5, weight: 100 }] });
  if (lastUid === null) values.delete(keys.lastUid);
  if (signedIn) values.set(AUTH_KEY, storedSession(signedIn));
  let href = 'https://moathdarweesh.github.io/vault/' + hash;
  const tab = new Map();                                  // sessionStorage: per tab
  if (googleStarted) tab.set(keys.oauthStarted, String(Date.now()));   // what signInWithGoogle leaves behind
  Object.assign(c, {
    URL, URLSearchParams, Headers, Request, Response, AbortController, TextEncoder, TextDecoder, atob, btoa,
    WebSocket: class { close() {} }, setInterval: () => 0, clearInterval() {},
    history: { state: null, replaceState(st, title, u) { href = new URL(u, href).href; } },
    sessionStorage: { getItem: (k) => (tab.has(k) ? tab.get(k) : null), setItem: (k, v) => tab.set(k, String(v)), removeItem: (k) => tab.delete(k) },
    fetch: async (url, init) => {
      if (String(url).includes('/auth/v1/user')) {
        const h = (init && init.headers) || {};
        const auth = String((typeof h.get === 'function' ? h.get('Authorization') : (h.Authorization || h.authorization)) || '');
        const sub = JSON.parse(Buffer.from(auth.replace(/^Bearer /, '').split('.')[1], 'base64url').toString()).sub;
        return new Response(JSON.stringify({ id: sub, aud: 'authenticated', email: sub + '@example.invalid' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  Object.defineProperty(c, 'location', { configurable: true, get: () => { const u = new URL(href); return { href, hash: u.hash, search: u.search, pathname: u.pathname, origin: u.origin }; } });
  vm.runInContext(SDK, c);                                // the real client library replaces the harness's fake
  let recovered = false;
  c.Cloud.onPasswordRecovery(() => { recovered = true; }); // bootCloud's order: register, then ask
  await c.Cloud.getSession();
  await s.advance(0);                                     // the SDK announces PASSWORD_RECOVERY from a setTimeout(…, 0)
  const rec = JSON.parse(values.get(AUTH_KEY) || 'null');
  return { as: rec && rec.user && rec.user.id, recovered, href, refused: !!(c.Cloud.takeUrlRefusal && c.Cloud.takeUrlRefusal()), markLeft: tab.has(keys.oauthStarted) };
}
async function aLinkCannotSwapTheAccount() {
  let r = await linkArrives({ hash: fragment('mallory'), signedIn: 'alice' });
  assert.equal(r.as, 'alice', "a link replaced alice's signed-in session with mallory's");
  assert.equal(r.href.includes('access_token'), false, 'and the refused tokens are gone from the address bar');
  assert.equal(r.refused, true, 'and app.js is told, so the user hears why the link did nothing');
  r = await linkArrives({ hash: fragment('mallory', 'recovery'), signedIn: 'alice' });
  assert.equal(r.as, 'alice', "a «password reset» link for ANOTHER account replaced alice's session");
  assert.equal(r.recovered, false);
  r = await linkArrives({ hash: fragment('alice', 'recovery'), signedIn: 'alice' });
  assert.equal(r.recovered, true, "alice's own reset link, opened where alice is signed in, still reaches the new-password form");
  assert.equal(r.as, 'alice');
  r = await linkArrives({ hash: fragment('bob', 'recovery'), lastUid: null });
  assert.equal(r.recovered, true, 'a reset link opened in a fresh browser still works');
  assert.equal(r.as, 'bob');
  r = await linkArrives({ hash: fragment('mallory', 'recovery'), withData: true });
  assert.equal(r.as, null, "a signed-out device holding alice's data is not handed to another account by a link");
  assert.equal(r.recovered, false);
  r = await linkArrives({ hash: fragment('bob'), lastUid: null, googleStarted: true });
  assert.equal(r.as, 'bob', '«Continue with Google», started in this tab, still signs in on its return');
  assert.equal(r.markLeft, false, 'and the one-shot mark is spent');
  r = await linkArrives({ hash: fragment('bob'), lastUid: null });
  assert.equal(r.as, null, 'a Google-shaped return this tab never started is refused');
  assert.equal(r.refused, true);
}

// ── THE CONSOLE SHARES NEITHER THE APP'S SESSION SLOT NOR THE SDK'S DEFAULTS ─
// admin.html built its client on the defaults: detectSessionInUrl on, and the
// DERIVED storage key — the same key js/cloud.js keeps the app's session under,
// on the same origin. A «reset» link built from someone else's tokens, opened
// on admin.html, replaced the app's signed-in session with theirs, and the
// app's next launch ran as that account (audit 2026-09-27). The console's own
// client-creation lines run here, verbatim, under the real vendored SDK.
const ADMIN_BOOT = (() => {
  const a = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'admin.html'), 'utf8');
  const start = a.indexOf('var SUPABASE_URL=');
  const create = a.indexOf('var sb=window.supabase.createClient');
  return start > 0 && create > start ? a.slice(start, a.indexOf('\n', create)) : '';
})();
const ADMIN_KEY = (ADMIN_BOOT.match(/ADMIN_AUTH_KEY\s*=\s*'([^']+)'/) || [])[1] || AUTH_KEY;
async function adminLinkArrives({ hash, appSignedIn, adminSignedIn }) {
  const s = context(), { c, values } = s;
  if (appSignedIn) values.set(AUTH_KEY, storedSession(appSignedIn));       // the APP's session, same origin
  if (adminSignedIn) values.set(ADMIN_KEY, storedSession(adminSignedIn));  // the console's own
  let href = 'https://moathdarweesh.github.io/vault/admin.html' + hash;
  Object.assign(c, {
    URL, URLSearchParams, Headers, Request, Response, AbortController, TextEncoder, TextDecoder, atob, btoa,
    WebSocket: class { close() {} }, setInterval: () => 0, clearInterval() {},
    history: { state: null, replaceState(st, title, u) { href = new URL(u, href).href; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async (url, init) => {
      if (String(url).includes('/auth/v1/user')) {
        const h = (init && init.headers) || {};
        const auth = String((typeof h.get === 'function' ? h.get('Authorization') : (h.Authorization || h.authorization)) || '');
        const sub = JSON.parse(Buffer.from(auth.replace(/^Bearer /, '').split('.')[1], 'base64url').toString()).sub;
        return new Response(JSON.stringify({ id: sub, aud: 'authenticated', email: sub + '@example.invalid' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  Object.defineProperty(c, 'location', { configurable: true, get: () => { const u = new URL(href); return { href, hash: u.hash, search: u.search, pathname: u.pathname, origin: u.origin }; } });
  vm.runInContext(SDK, c);
  assert.ok(ADMIN_BOOT, "admin.html's client-creation lines were not found");
  vm.runInContext(ADMIN_BOOT, c);                          // the console's client, exactly as the page builds it
  await vm.runInContext('sb.auth.getSession()', c);
  await s.advance(0);
  const uid = (k) => { const r = JSON.parse(values.get(k) || 'null'); return (r && r.user && r.user.id) || null; };
  return { app: uid(AUTH_KEY), admin: uid(ADMIN_KEY), href };
}
async function aLinkCannotSwapTheAppAccountThroughTheConsole() {
  let r = await adminLinkArrives({ hash: fragment('mallory', 'recovery'), appSignedIn: 'alice' });
  assert.equal(r.app, 'alice', "a «reset» link opened on admin.html replaced the APP's signed-in session with mallory's");
  assert.notEqual(ADMIN_KEY, AUTH_KEY, 'the console keeps its session under its own key');
  r = await adminLinkArrives({ hash: fragment('mallory', 'recovery'), adminSignedIn: 'alice' });
  assert.equal(r.admin, 'alice', "a reset link for ANOTHER account replaced the console's signed-in session");
  assert.equal(r.href.includes('access_token'), false, 'and the refused tokens are gone from the address bar');
  r = await adminLinkArrives({ hash: fragment('alice', 'recovery'), adminSignedIn: 'alice' });
  assert.equal(r.admin, 'alice', "the owner's own reset link, opened where the owner is signed in, still lands");
  r = await adminLinkArrives({ hash: fragment('alice', 'recovery') });
  assert.equal(r.admin, 'alice', 'a reset link in a fresh browser still lands — is_admin() judges it next (contract 47)');
  r = await adminLinkArrives({ hash: fragment('mallory') });
  assert.equal(r.admin, null, 'a plain #access_token link is refused by the console');
}

// ── SIGN-IN REVEALS NOTHING BEFORE THE GUARD HAS ANSWERED (audit 2026-09-27) ─
// afterLogin took the gate down at once whenever the device held data — ANY
// data — so on a shared phone bob saw alice's already-painted screen while
// resolveOnLogin was still deciding; and an 'offline' answer never repainted,
// so the swept store stayed on screen until he navigated. The real afterLogin
// runs here over a stub Cloud that answers 'offline' after a tick.
async function loginRevealsNothingBeforeTheGuardAnswers() {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/app.js'), 'utf8');
  const body = app.slice(app.indexOf('async function afterLogin()'), app.indexOf('function showConflictDialog('));
  const calls = [];
  let answered = false, lastUid = 'alice';
  const c = {
    console, setImmediate,
    Cloud: { localHasData: () => true, getLastUid: () => lastUid, getSession: async () => ({ user: { id: 'bob' } }), touchLastSeen() {},
      resolveOnLogin: async () => { await new Promise((r) => setImmediate(r)); answered = true; calls.push('guard'); return 'offline'; } },
    hideAuthGate: () => calls.push(answered ? 'hideAuthGate' : 'hideAuthGate:before-guard'), showToast() {}, t: (k) => k,
    ensureUsername() {}, enforceAccountStatus() {}, showConflictDialog() {}, showDuplicateAccountDialog(k) { calls.push('dup:' + k); },
    refreshAfterSync: () => calls.push('refreshAfterSync'), syncExerciseImages() {},
  };
  vm.createContext(c); vm.runInContext(body, c);
  await c.afterLogin();
  assert.equal(calls.includes('hideAuthGate:before-guard'), false, "afterLogin revealed the screen before resolveOnLogin's guard answered — bob saw alice's data: " + calls.join(' > '));
  assert.ok(calls.indexOf('refreshAfterSync') > calls.indexOf('guard'), "an 'offline' answer over another account's data still repaints: " + calls.join(' > '));
  // …and the account's OWN device is still revealed at once, as before.
  calls.length = 0; answered = false; lastUid = 'bob';
  await c.afterLogin();
  assert.equal(calls[0], 'hideAuthGate:before-guard', "the account's own data is still shown without waiting: " + calls.join(' > '));
}

// ── A RESET LINK NAMES THE ACCOUNT IT RESETS, AND ASKS (audit 2026-09-27) ────
// recoveryFits lets a type=recovery link sign a signed-out, data-less device
// into the link's account — «type=recovery» is text anyone can put in a URL —
// and showChangePassword(true) then offered a new-password form that never
// said WHOSE password. The real function runs here over a fake sheet: the
// first thing it opens must name the account and ask; «not my account» ends
// the session and clears what it left behind; «continue» reaches the form.
function sheetOf(html) {
  const els = new Map();
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    const tag = html.slice(m.index, html.indexOf('>', m.index));
    els.set(m[1], { id: m[1], value: '', textContent: '', disabled: /\bdisabled\b/.test(tag), on: {},
      addEventListener(t, fn) { (this.on[t] = this.on[t] || []).push(fn); },
      click() { return Promise.all((this.on.click || []).map((fn) => fn())); } });
  }
  return { html, querySelector: (sel) => els.get(String(sel).replace(/^#/, '')) || null };
}
async function recoveryNamesTheAccountAndAsks() {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/app.js'), 'utf8');
  const at = app.indexOf('function confirmRecoveryAccount(');   // the question, above the form (absent before the fix)
  const body = app.slice(at >= 0 ? at : app.indexOf('function showChangePassword('), app.indexOf('function showFeedback('));
  const tk = () => new Promise((r) => setImmediate(r));
  const sheets = [], calls = [];
  let lastUid = 'bob', hasData = false;
  const c = {
    console, setImmediate,
    Cloud: { getSession: async () => ({ user: { id: 'bob', email: 'owner@example.invalid' } }), currentEmail: async () => 'owner@example.invalid',
      getLastUid: () => lastUid, localHasData: () => hasData, changePassword: async () => ({ ok: true }), captcha: null,
      signOut: async () => { calls.push('signOut'); }, clearLocalUserData: () => calls.push('clear') },
    t: (k) => (k === 'recovery_confirm_yes' ? 'Continue as {email}' : k), icon: () => '', escapeHtml: (s) => String(s), showToast() {},
    closeModal: () => calls.push('close'), translateAuthError: (m) => m, authSheetKit: () => ({ err() {}, busy() {}, token: async () => null, reset() {} }),
    location: { reload: () => calls.push('reload') },
    openModal: (html, opts) => { const el = sheetOf(html); sheets.push({ el, opts: opts || {} }); return el; },
  };
  vm.createContext(c); vm.runInContext(body, c);
  c.showChangePassword(true);
  for (let i = 0; i < 4; i++) await tk();
  const ask = sheets[0] && sheets[0].el;
  assert.ok(ask && ask.querySelector('#cpw-yes') && ask.querySelector('#cpw-no') && !ask.querySelector('#cpw-new'),
    'a reset link opened the new-password form without naming the account it resets, or asking: ' + (ask ? ask.html.replace(/\s+/g, ' ').trim().slice(0, 140) : 'no sheet'));
  assert.equal(sheets[0].opts.dismissible, false, 'the question must be answered');
  assert.equal(ask.querySelector('#cpw-yes').textContent, 'Continue as owner@example.invalid', 'the button names the account');
  assert.equal(ask.querySelector('#cpw-yes').disabled, false, 'and is live once the account is known');
  await ask.querySelector('#cpw-no').click();
  for (let i = 0; i < 4; i++) await tk();
  assert.deepEqual(calls, ['signOut', 'clear', 'reload'], 'refusal signs out, clears what the session left, reloads: ' + calls.join(' > '));
  assert.equal(sheets.length, 1, 'and no password form opened');
  // another account's data on the device is NOT cleared by a refusal
  sheets.length = 0; calls.length = 0; lastUid = 'alice'; hasData = true;
  c.showChangePassword(true);
  for (let i = 0; i < 4; i++) await tk();
  await sheets[0].el.querySelector('#cpw-no').click();
  for (let i = 0; i < 4; i++) await tk();
  assert.deepEqual(calls, ['signOut', 'reload'], "a refusal never clears another account's data: " + calls.join(' > '));
  // «continue as …» reaches the form, which has no current-password field
  sheets.length = 0; calls.length = 0; lastUid = 'bob'; hasData = false;
  c.showChangePassword(true);
  for (let i = 0; i < 4; i++) await tk();
  await sheets[0].el.querySelector('#cpw-yes').click();
  for (let i = 0; i < 4; i++) await tk();
  const form = sheets[1] && sheets[1].el;
  assert.ok(form && form.querySelector('#cpw-new') && !form.querySelector('#cpw-current'), 'the form opens once the account is confirmed, without a current-password field');
}

async function run() {
  await aLinkCannotSwapTheAccount();
  await aLinkCannotSwapTheAppAccountThroughTheConsole();
  await loginRevealsNothingBeforeTheGuardAnswers();
  await recoveryNamesTheAccountAndAsks();
  await twoWindowsPushTogether(true);
  await twoWindowsPushTogether(false);
  await siblingLandedWhileThisOneWasOut();
  await anotherDeviceIsStillAConflict();
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
    await rescueFailureNeverUploads(entry);
  }
  console.log('PASS multi-window: a URL session cannot replace a stored one or take over a signed-out device holding data, while the own-account and fresh-browser reset links and a Google return this tab started still sign in (the real vendored SDK); two windows pushing at once are one upload queue with Web Locks and still no conflict without them (the shared version never wound back), a sibling that answered first is retried once conditionally from a fresh export, another device is still a conflict and the note carries sentVer/remoteStamp; sibling writes adopted not overwritten, STALE recorded, READ-ONLY and garbage refused, photos kept; a foreign blob is rescued under its own uid and never uploaded (login + boot, with and without addresses), and never swept when the rescue cannot be written; a same-address second account is held — nothing swept, pulled or pushed (login + boot + push) — and released on request by the same sweep under the old uid; a rescue that cannot be written holds the device too — nothing of the previous account is offered to the new row (login + boot + push); the console keeps its own session slot and refuses a reset link for another account; sign-in reveals nothing before the guard has answered and repaints after; a reset link names the account and asks before the form; restore reports its upload half');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
