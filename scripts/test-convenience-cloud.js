'use strict';
const assert = require('node:assert/strict');
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
  console.log('PASS cloud: CAS errors/uncertainty cannot upsert, unknown-version insert only, bounded own-account history, stale account response; the empty-blob backup guard refuses on a failed read');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
