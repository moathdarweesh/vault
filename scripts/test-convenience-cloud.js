'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {context} = require('./test-sync-status');
async function run() {
  const state = context(), {Cloud,DB} = state.c, requests=[];
  // With user data on the device the empty-blob backup guard is skipped, so this
  // case reaches the CAS it exists to test (a data-less fixture would stop at the
  // guard's own read and never offer the UPDATE at all).
  DB.sessions.add({ exerciseId: DB.exercises.list()[0].id, date: '2026-09-15', sets: [{ reps: 5, weight: 50 }] });
  state.query(async request => {requests.push(request);return {data:null,error:{message:'conditional write failed'}};});
  assert.equal(await Cloud.push(),'error');
  assert.equal(requests.filter(r=>r.kind==='upsert').length,0,'failed CAS never overwrites');
  assert.ok(requests.some(r=>r.kind==='update'),'the CAS was actually attempted');
  requests.length=0;
  state.query(async request => {requests.push(request); if(request.kind==='update') throw new Error('network'); return {data:null,error:null};});
  await assert.rejects(Cloud.push(),/network/);
  assert.equal(requests.filter(r=>r.kind==='upsert').length,0);
  requests.length=0;
  state.values.delete(state.keys.ver+'alice');
  state.query(async request => {requests.push(request);return {data:null,error:{message:'already exists',code:'23505'}};});
  await assert.rejects(Cloud.push(),/already exists/);
  assert.equal(requests.find(r=>r.kind!=='read').kind,'insert','unknown version can only insert, never overwrite');
  state.account('alice'); requests.length=0;
  state.query(async request => {
    requests.push(request);
    return {data: request.fields==='id,version,replaced_at' ? [{id:1,version:1,replaced_at:'2026-09-09'}] : {id:1,version:1,data:JSON.parse(DB.exportJSON())},error:null};
  });
  assert.equal((await Cloud.listPlanHistory()).rows.length,1);
  assert.equal(requests[0].fields,'id,version,replaced_at');assert.equal(requests[0].limit,10);
  assert.ok(requests[0].filters.some(([key,value])=>key==='user_id'&&value==='alice'));
  const preview = await Cloud.readPlanHistory(1);assert.equal(preview.ok,true);assert.ok(!('data' in preview),'UI receives no unrelated historical logs');
  let finish;
  state.query(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=Cloud.listPlanHistory();
  await new Promise(resolve=>setImmediate(resolve)); state.account('bob');finish({data:[{id:1}],error:null});
  assert.equal((await pending).code,'STALE','late previous-account response discarded');
  // THE EMPTY-BLOB BACKUP GUARD MUST REFUSE WHEN IT CANNOT READ. A fresh
  // context holds no user data (seed exercises do not count); the cloud row
  // is unknown because the read fails. Before: the guard passed and the UPDATE
  // went out carrying nothing over whatever the row held.
  {
    const g = context(); requests.length = 0;
    assert.equal(g.c.DB.hasUserData(), false, 'the fixture must be data-less for this case');
    g.query(async request => { requests.push(request); if (request.kind === 'read') throw new Error('flaky read'); return { data: [{ version: 2 }], error: null }; });
    assert.equal(await g.c.Cloud.push(), 'error', 'the guard refuses when the cloud copy cannot be read');
    assert.equal(requests.filter(r => r.kind !== 'read').length, 0, 'no write was offered to the wire');
    // The fixture made no local change, so there is no dirty flag to keep — what
    // matters is that a refusal is an OUTCOME the caller can act on, not a throw.
    assert.equal(g.c.Cloud.syncState().status, 'error', 'and the save centre says so');
  }
  await rescueOutlivesARoutinePull();
  await photoRaces();
  console.log('PASS cloud: CAS errors/uncertainty cannot upsert, unknown-version insert only, bounded own-account history, stale account response; the empty-blob backup guard refuses on a failed read; the rescue a conflict set aside outlives the next routine pull; a photo removed or replaced while it uploads stays removed or replaced — in the pointer, the bucket and the heal — and an unchanged photo is not re-sent');
}

// ── A PHOTO CHANGED WHILE IT UPLOADS ─────────────────────────────────────────
// The upload's callback wrote imagePath unconditionally. Remove the photo while
// it uploads and the pointer came back; syncExerciseImages then read «no photo,
// but a pointer» as a LOST photo and restored the deleted one from the object
// the upload had just written — here and on every other device. Replace it
// while it uploads and two uploads raced to the one key, so the older photo
// could be what the bucket kept. The heal had the same hole across its own
// download. The REAL app.js functions run here, on the real DB, against a
// bucket whose objects land when the test says so.
function photoRig() {
  const s = context(), c = s.c;
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  vm.runInContext(app.slice(app.indexOf('function exerciseImgSrc('), app.indexOf('function hydrateCardImages(')), c);
  vm.runInContext("var currentView = 'home'; function renderView() {}", c);
  const bucket = new Map(), pending = [], calls = { upload: 0, restore: 0, remove: [] };
  c.Cloud.backupExerciseImage = (id, dataUrl) => { calls.upload++; return new Promise((resolve) => pending.push({ id, dataUrl, resolve })); };
  c.Cloud.removeExerciseImage = async (p) => { calls.remove.push(p); bucket.delete(p); };
  let restoreGate = null;
  c.Cloud.restoreExerciseImage = (p) => { calls.restore++; return restoreGate ? restoreGate.then(() => bucket.get(p) || null) : Promise.resolve(bucket.get(p) || null); };
  // The object for `dataUrl` reaches the bucket NOW, and its upload answers.
  const land = async (dataUrl) => {
    const i = pending.findIndex((u) => u.dataUrl === dataUrl);
    if (i >= 0) { const [u] = pending.splice(i, 1); const p = 'alice/' + u.id + '.jpg'; bucket.set(p, u.dataUrl); u.resolve(p); }
    for (let k = 0; k < 8; k++) await tick();
  };
  const hold = () => { let open; restoreGate = new Promise((r) => { open = r; }); return () => { restoreGate = null; open(); }; };
  // An upload is IN FLIGHT once its request has left: let the queue start it.
  const started = async () => { for (let k = 0; k < 4; k++) await tick(); };
  return { c, bucket, calls, land, hold, started };
}
async function photoRaces() {
  const A = 'data:image/jpeg;base64,QUFB', B = 'data:image/jpeg;base64,QkJC', C = 'data:image/jpeg;base64,Q0ND';
  // (1) REMOVED while it uploads
  {
    const { c, bucket, calls, land, started } = photoRig();
    const ex = c.DB.exercises.add({ name: 'Cable fly', category: 'Chest', customImage: A });
    c.backupExerciseImageFor(ex.id, A);
    await started();
    c.DB.exercises.update(ex.id, { customImage: null });         // what the edit sheet's save does
    c.backupExerciseImageFor(ex.id, null);
    await land(A);
    assert.equal(c.DB.exercises.getById(ex.id).imagePath, null, 'a photo removed while its upload ran got its pointer back');
    await c.syncExerciseImages();
    assert.equal(c.DB.exercises.getImage(ex.id), null, 'and the heal brought the removed photo back');
    assert.equal(bucket.size, 0, 'the object that upload wrote is removed, not left for a heal to find');
    assert.deepEqual(calls.remove, ['alice/' + ex.id + '.jpg']);
  }
  // (2) REPLACED while it uploads — and the older upload is the slower one
  {
    const { c, bucket, land, started } = photoRig();
    const ex = c.DB.exercises.add({ name: 'Cable fly', category: 'Chest', customImage: A });
    c.backupExerciseImageFor(ex.id, A);
    await started();
    c.DB.exercises.update(ex.id, { customImage: B });
    c.backupExerciseImageFor(ex.id, B);
    await started();
    await land(B); await land(A); await land(B);                // B answers first if it is already running
    const p = 'alice/' + ex.id + '.jpg';
    assert.equal(bucket.get(p), B, 'the bucket holds the OLDER photo — the slower upload won the one key');
    assert.equal(c.DB.exercises.getById(ex.id).imagePath, p, 'and the pointer names it');
  }
  // (3) the HEAL races a new photo across its own download
  {
    const { c, bucket, hold } = photoRig();
    const ex = c.DB.exercises.add({ name: 'Cable fly', category: 'Chest', customImage: null });
    const p = 'alice/' + ex.id + '.jpg';
    bucket.set(p, A);
    c.DB.exercises.update(ex.id, { imagePath: p });              // this device lost its copy; the bucket has one
    const open = hold();
    const heal = c.syncExerciseImages();
    for (let k = 0; k < 4; k++) await tick();
    c.DB.exercises.update(ex.id, { customImage: C });            // a new photo, chosen while the old one downloads
    open(); await heal;
    assert.equal(c.DB.exercises.getImage(ex.id), C, 'the heal wrote the old bucket copy over the photo just chosen');
  }
  // (4) a blob that ALREADY carries the bad pair (a removal, and a pointer an
  //     upload wrote after it) is never healed back
  {
    const { c, bucket, calls } = photoRig();
    const ex = c.DB.exercises.add({ name: 'Cable fly', category: 'Chest', customImage: A });
    const p = 'alice/' + ex.id + '.jpg';
    bucket.set(p, A);
    c.DB.exercises.update(ex.id, { customImage: null });
    c.DB.exercises.update(ex.id, { imagePath: p });
    await c.syncExerciseImages();
    assert.equal(calls.restore, 0, 'an explicit removal with a pointer beside it was treated as a lost photo');
    assert.equal(c.DB.exercises.getImage(ex.id), null);
  }
  // (5) an unchanged photo is not re-sent: the edit sheet passes it on every save
  {
    const { c, calls, land, started } = photoRig();
    const ex = c.DB.exercises.add({ name: 'Cable fly', category: 'Chest', customImage: A });
    c.backupExerciseImageFor(ex.id, A);
    await started();
    await land(A);
    assert.equal(calls.upload, 1);
    c.DB.exercises.update(ex.id, { name: 'Cable fly (low)', customImage: A });
    c.backupExerciseImageFor(ex.id, A);
    assert.equal(calls.upload, 1, 'an unchanged, already backed-up photo was uploaded again on a rename');
  }
}

// THE RESCUE OUTLIVES THE NEXT ROUTINE PULL. applyRemote snapshotted the local
// blob into the ONE rescue slot before EVERY pull — a clean, linked one too,
// which the cloud already holds — so the copy «keep the account copy» had just
// set aside was replaced the next time another device pushed and this one came
// to the foreground. The dialog promises «the other copy is kept».
async function rescueOutlivesARoutinePull() {
  const r = context(), rc = r.c;
  const ex = rc.DB.exercises.list()[0].id;
  const stranded = rc.DB.sessions.add({ exerciseId: ex, date: '2026-09-20', sets: [{ reps: 6, weight: 90 }] });   // logged here, never uploaded
  await tick(); await tick();
  const row = (sessions) => { const b = JSON.parse(rc.DB.exportJSON()); b.sessions = sessions; return b; };
  const other1 = { id: 'other1', exerciseId: ex, date: '2026-09-19', sets: [{ reps: 5, weight: 80 }], createdAt: '2026-09-19T10:00:00.000Z' };
  const v5 = row([other1]);
  r.query(async () => ({ data: { data: v5, version: 5, updated_at: '2026-09-20T10:00:00Z' }, error: null }));
  assert.equal(await rc.Cloud.chooseCloud(), 'ok', '«keep the account copy»');
  const held = () => { const rec = JSON.parse(r.values.get(r.keys.recovery) || 'null'); return !!(rec && rec.raw && rec.raw.includes(stranded.id)); };
  assert.equal(held(), true, 'the set it discarded is in the rescue');
  // Another device pushes v6; this one comes to the foreground — a ROUTINE pull.
  const v6 = row([other1, { ...other1, id: 'other2', date: '2026-09-21', createdAt: '2026-09-21T10:00:00.000Z' }]);
  r.query(async (q) => (q.fields === 'updated_at,version'
    ? { data: { version: 6, updated_at: '2026-09-21T10:00:00Z' }, error: null }
    : { data: { data: v6, version: 6, updated_at: '2026-09-21T10:00:00Z' }, error: null }));
  assert.equal(await rc.Cloud.bootSync(), 'pulled');
  assert.equal(held(), true, 'a routine pull of a clean, linked device replaced the only copy of the set «keep the account copy» discarded');
  // The guard is not a blanket refusal: a pull over UNSYNCED edits still takes one.
  const typed = rc.DB.sessions.add({ exerciseId: ex, date: '2026-09-22', sets: [{ reps: 3, weight: 100 }] });
  await tick(); await tick();
  const v7 = row([other1]);
  r.query(async () => ({ data: { data: v7, version: 7, updated_at: '2026-09-22T10:00:00Z' }, error: null }));
  assert.equal(await rc.Cloud.chooseCloud(), 'ok');
  assert.ok(JSON.parse(r.values.get(r.keys.recovery)).raw.includes(typed.id), 'a pull over unsynced edits still keeps them in the rescue');
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
run().catch(error=>{console.error(error);process.exitCode=1;});
