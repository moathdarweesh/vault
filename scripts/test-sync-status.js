// Real storage/cloud code in isolated contexts; no network or personal data.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function context() {
  const values = new Map(), events = [], timers = new Map(), listeners = new Map();
  let fail = '', timer = 0, session = { user: { id: 'alice' } };
  let query = async () => ({ data: [{ version: 2 }], error: null });
  const client = { auth: { getSession: async () => ({ data: { session } }) },
    from(table) {
      const request = { table, kind: 'read', fields: '', filters: [] };
      // The PAYLOAD is kept, not just the verb: "this account's data was never
      // uploaded" is a fact only if the bytes offered to the wire can be read.
      const chain = { insert(rows) { request.kind = 'insert'; request.rows = rows; return this; },
        update(rows) { request.kind = 'update'; request.rows = rows; return this; },
        upsert(rows) { request.kind = 'upsert'; request.rows = rows; return this; },
        select(fields) { request.fields = fields; return this; }, eq(key,value) { request.filters.push([key,value]); return this; },
        order() { return this; }, limit(count) { request.limit=count; return this; },
        maybeSingle() { return query(request); }, then(ok, no) { return query(request).then(ok, no); } };
      return chain;
    }, rpc: async () => ({ data: null, error: null }) };
  const c = { console: { log() {}, warn() {}, error() {} }, navigator: { languages: ['en'], onLine: true },
    crypto: require('node:crypto').webcrypto,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    // A real window DELIVERS the events it is handed. storage.js registers a
    // `storage` listener at load, and a recorder that never calls it would have
    // proved only that the registration did not throw.
    addEventListener(type, fn) { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); },
    removeEventListener(type, fn) { const a = listeners.get(type) || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    dispatchEvent(e) { events.push(e.type); (listeners.get(e.type) || []).slice().forEach(fn => fn(e)); },
    setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); },
    document: { currentScript: null }, supabase: { createClient: () => client },
    // A REAL Storage IS AN EXOTIC OBJECT: Object.keys(localStorage) yields the
    // STORED keys, and BOTH prefix sweeps in this app use exactly that —
    // imgPrune() in storage.js and clearLocalUserData() in cloud.js. A plain
    // object yields its METHOD names instead, so every sweep in this harness was
    // a silent no-op and a mutation that added one could not be caught. The proxy
    // is what makes "the photos were kept" and "the residue was swept" facts.
    localStorage: new Proxy({ get length() { return values.size; }, key: i => [...values.keys()][i],
      getItem: k => values.get(k) ?? null, removeItem: k => values.delete(k),
      clear() { values.clear(); },
      setItem(k, v) { if (fail) { const e = new Error('storage failed'); e.name = fail; throw e; } values.set(k, String(v)); } }, {
      ownKeys: () => [...values.keys()],
      getOwnPropertyDescriptor: (t, k) => (values.has(k)
        ? { value: values.get(k), enumerable: true, configurable: true, writable: true }
        : Reflect.getOwnPropertyDescriptor(t, k)),
      has: (t, k) => k in t || values.has(k),
      get: (t, k) => (k in t ? Reflect.get(t, k) : values.get(k)),
    }),
  };
  c.window = c; vm.createContext(c);
  vm.runInContext(read('js/cloud.js'), c);
  vm.runInContext(read('js/storage.js'), c);
  const keys = c.VAULT_KEYS;
  function account(uid) {
    session = uid ? { user: { id: uid } } : null;
    if (uid) { values.set(keys.lastUid, uid); values.set(keys.linked + uid, '1'); values.set(keys.ver + uid, '1'); values.set(keys.synced + uid, '2026-09-01T12:00:00Z'); }
  }
  account('alice');
  return { c, values, keys, events, account, session: value => { session = value; },
    query: fn => { query = fn; }, fail: value => { fail = value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function run() {
  const s = context(), { c } = s;
  const result = vm.runInContext('save()', c);
  assert.equal(result.ok, true);
  assert.equal(c.Cloud.syncState().dirty, true);
  assert.equal(c.Cloud.syncState().status, 'pending');
  const copy = c.DB.saveState(); copy.ok = false;
  assert.equal(c.DB.saveState().ok, true, 'read-only status copies');
  s.fail('QuotaExceededError');
  assert.equal(vm.runInContext('save()', c).code, 'QUOTA');
  assert.equal(c.DB.saveState().ok, false);
  s.fail('');
  assert.equal(vm.runInContext('save()', c).ok, true, 'successful retry clears write error');
  vm.runInContext('STATE_LOAD_FAILED = true', c);
  assert.equal(vm.runInContext('save()', c).code, 'READ_ONLY');
  vm.runInContext('STATE_LOAD_FAILED = false', c);
  const ex = c.DB.exercises.list()[0];
  c.DB.sessions.add({ exerciseId: ex.id, date: '2026-09-09', sets: [{ reps: 8, weight: 40 }] });
  let finish;
  s.query(() => new Promise(resolve => { finish = resolve; }));
  const push = c.Cloud.push();
  await tick();
  assert.equal(c.Cloud.syncState().status, 'syncing');
  c.DB.sessions.add({ exerciseId: ex.id, date: '2026-09-09', sets: [{ reps: 10, weight: 40 }] });
  finish({ data: [{ version: 2 }], error: null });
  assert.equal(await push, 'ok');
  assert.equal(c.Cloud.syncState().status, 'pending', 'old push cannot confirm a newer local edit');
  s.query(async () => ({ data: [{ version: 3 }], error: null }));
  await c.Cloud.push();
  assert.equal(c.Cloud.syncState().status, 'synced');
  assert.ok(c.Cloud.syncState().confirmedAt);
  c.navigator.onLine = false;
  assert.equal(c.Cloud.syncState().status, 'offline');
  c.navigator.onLine = true;
  s.session(null);
  assert.equal(await c.Cloud.push(), 'nosession');
  assert.equal(c.Cloud.syncState().status, 'signin');
  s.account('bob');
  assert.equal(c.Cloud.syncState().confirmedAt, '', 'confirmation belongs to one account');
  s.query(async () => { throw new Error('network down'); });
  await assert.rejects(c.Cloud.push());
  assert.equal(c.Cloud.syncState().status, 'error');
  assert.ok(s.events.includes('vault:sync-state'));
  assert.ok(s.events.includes('vault:save-state'));
  s.query(async request => request.kind === 'update'
    ? { data: [], error: null }
    : { data: { data: { exercises: [], sessions: [{ id: 'remote' }] }, version: 4 }, error: null });
  assert.equal(await c.Cloud.push(), 'conflict');
  assert.equal(c.Cloud.syncState().status, 'conflict');
  const remote = JSON.parse(s.values.get(s.keys.store));
  s.query(async () => ({ data: { data: remote, version: 4, updated_at: '2026-09-09T10:00:00Z' }, error: null }));
  assert.equal(await c.Cloud.chooseCloud(), 'ok');
  assert.equal(c.Cloud.syncState().status, 'synced', 'reviewing the cloud copy clears the conflict state');
  let reads = 0;
  s.query(async request => {
    assert.equal(request.fields, 'updated_at,version', 'fast path must not fetch the blob');
    reads++;
    return { data: { version: 4, updated_at: '2026-09-09T10:00:00Z' }, error: null };
  });
  assert.equal(await c.Cloud.bootSync(), 'synced');
  assert.equal(reads, 1, 'status tracking introduces no extra server requests');
  c.Cloud.clearLocalUserData();
  assert.equal(c.Cloud.syncState().status, 'unlinked');
  assert.equal(c.Cloud.syncState().confirmedAt, '');

  const app = read('js/app.js');
  vm.runInContext(app.slice(app.indexOf('function saveCenterModel('), app.indexOf('function updateSaveCenter(')), c);
  assert.equal(c.saveCenterModel({ ok: false, code: 'QUOTA' }, { status: 'synced' }).cloudKey, 'sc_older');
  assert.equal(c.saveCenterModel({ ok: false, code: 'QUOTA' }, { status: 'synced' }).action, 'export');
  assert.equal(c.saveCenterModel({ ok: true }, { status: 'conflict' }).action, 'review');
  assert.equal(c.saveCenterModel({ ok: true }, { status: 'syncing' }).disabled, true);
  console.log('PASS save/sync: write outcomes, read-only/quota recovery, account isolation, in-flight edits, offline, auth, errors, conflicts, status presentation');
}
module.exports = { context };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
