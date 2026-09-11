'use strict';
const assert = require('node:assert/strict');
const {context} = require('./test-sync-status');
async function run() {
  const state = context(), {Cloud,DB} = state.c, requests=[];
  state.query(async request => {requests.push(request);return {data:null,error:{message:'conditional write failed'}};});
  assert.equal(await Cloud.push(),'error');
  assert.equal(requests.filter(r=>r.kind==='upsert').length,0,'failed CAS never overwrites');
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
  console.log('PASS cloud: CAS errors/uncertainty cannot upsert, unknown-version insert only, bounded own-account history, stale account response');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
