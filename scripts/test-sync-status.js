// Real storage/cloud code in isolated contexts; no network or personal data.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// `opts` builds what ONE window cannot show: `values` shares a single Storage
// between two contexts — two windows of one origin — and `locks` hands navigator
// a Web Locks manager they both use. Timers now carry their delay, and
// `advance(ms)` fires the ones that fall due: "how many uploads does a workout
// cost" is a question about TIME, and a harness whose timers never ran could
// only ever answer "none". Nothing fires unless a case advances the clock, so
// every older case sees exactly the harness it was written against.
function context(opts = {}) {
  const values = opts.values || new Map(), events = [], timers = new Map(), listeners = new Map(), docListeners = new Map();
  let fail = '', timer = 0, now = 0, session = { user: { id: 'alice' } };
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
  const c = { console: { log() {}, warn() {}, error() {} }, navigator: { languages: ['en'], onLine: true, ...(opts.locks ? { locks: opts.locks } : {}) },
    crypto: require('node:crypto').webcrypto,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    // A real window DELIVERS the events it is handed. storage.js registers a
    // `storage` listener at load, and a recorder that never calls it would have
    // proved only that the registration did not throw.
    addEventListener(type, fn) { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); },
    removeEventListener(type, fn) { const a = listeners.get(type) || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    dispatchEvent(e) { events.push(e.type); (listeners.get(e.type) || []).slice().forEach(fn => fn(e)); },
    setTimeout(fn, ms) { timers.set(++timer, { fn, at: now + (Number(ms) || 0) }); return timer; }, clearTimeout(id) { timers.delete(id); },
    document: { currentScript: null, visibilityState: 'visible',
      addEventListener(type, fn) { (docListeners.get(type) || docListeners.set(type, []).get(type)).push(fn); } },
    supabase: { createClient: () => client },
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
  // Fire, in order, every timer due within `ms` — including the ones a callback
  // arms on the way — and let the async work each one starts settle first.
  async function advance(ms) {
    const until = now + ms;
    for (let guard = 0; guard < 1000; guard++) {
      for (let i = 0; i < 4; i++) await tick();
      const due = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    now = until;
    for (let i = 0; i < 4; i++) await tick();
  }
  // The app going to the background, as the document announces it.
  function hide() {
    c.document.visibilityState = 'hidden';
    (docListeners.get('visibilitychange') || []).slice().forEach((fn) => fn({ type: 'visibilitychange' }));
  }
  return { c, values, keys, events, account, session: value => { session = value; },
    query: fn => { query = fn; }, fail: value => { fail = value; }, advance, hide };
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
  await housekeepingIsNotAnEdit();
  await malformedBlobsAreRefused();
  await lostReplyIsStillOurOwn();
  await forceIsNotDowngraded();
  await newerBlobIsKeptWhole();
  await aWorkoutIsNotTenUploads();
  console.log('PASS save/sync: write outcomes, read-only/quota recovery, account isolation, in-flight edits, offline, auth, errors, conflicts, status presentation; boot-time housekeeping writes flag nothing dirty and cannot manufacture a conflict; five crashing shapes refused at the door, and a reload that lands READ-ONLY restores the previous bytes and reports failure; a push whose reply was lost is recognised as our own by the next push and by the boot, through a second lost attempt; a force push never shares a plain one');
}

// A ROW PostgREST-shaped enough for pushOnce: a conditional UPDATE matches only
// at its version; `lose` makes the NEXT update commit and then drop its reply,
// the way a request that reached the server over a dying connection does.
function server(initial) {
  const r = { version: 1, data: initial, updated_at: '2026-09-15T08:00:00.000Z', errors: [], lose: 0, down: 0 };
  r.serve = async (q) => {
    if (q.table === 'client_errors') { r.errors.push(q.rows); return { data: null, error: null }; }
    if (q.kind === 'update') {
      if (r.down) { r.down--; throw new Error('Failed to fetch'); }   // never reached the server
      const want = (q.filters.find(([k]) => k === 'version') || [])[1];
      if (want !== r.version) return { data: [], error: null };
      r.version++; r.data = q.rows.data; r.updated_at = q.rows.updated_at;
      if (r.lose) { r.lose--; return { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 }; }
      return { data: [{ version: r.version }], error: null };
    }
    if (q.fields === 'updated_at,version') return { data: { version: r.version, updated_at: r.updated_at }, error: null };
    return { data: { data: r.data, version: r.version, updated_at: r.updated_at }, error: null };
  };
  return r;
}

// ── A PUSH WHOSE REPLY WAS LOST IS STILL THIS DEVICE'S OWN ───────────────────
// The pushing stamp exists so that an upload which committed but never
// answered is recognised as the device's own. But every push overwrote it
// before sending: after push 1 committed and lost its reply, the retry (4 s)
// or the next set's debounce replaced the stamp, sent the stale base version,
// matched no row, found push 1's bytes (≠ its own, a set later) and reported a
// CONFLICT — and the boot could no longer adopt the row either. The dropped
// packet in the gym the retry chain was built for, answered with a question.
async function lostReplyIsStillOurOwn() {
  const ex = (c) => c.DB.exercises.list()[0].id;
  const logSet = async (c, reps) => { const x = c.DB.sessions.add({ exerciseId: ex(c), date: '2026-09-15', sets: [{ reps, weight: 60 }] }); await tick(); await tick(); return x; };
  // A REAL gap between attempts: each push stamps new Date() to the millisecond,
  // and two attempts inside one millisecond would share a stamp by accident —
  // which is how a single stamp slot can look as if it remembered both.
  const later = () => new Promise((resolve) => setTimeout(resolve, 5));
  // (a) the next push recognises it
  {
    const s = context(), { c } = s;
    const row = server(JSON.parse(c.DB.exportJSON()));
    s.query(row.serve);
    const one = await logSet(c, 8);
    row.lose = 1;
    assert.equal(await c.Cloud.push(), 'error', 'push 1 committed, but the device never heard so');
    assert.equal(row.version, 2, '(the row did move)');
    const two = await logSet(c, 9);                        // a set later
    await later();
    assert.equal(await c.Cloud.push(), 'ok', "push 2 called push 1's own row a conflict");
    assert.equal(row.errors.filter((e) => e.kind === 'sync-conflict').length, 0, 'and nothing was reported as one');
    assert.equal(row.version, 3, 'push 2 was a CONDITIONAL write on the version push 1 produced');
    const sent = JSON.stringify(row.data.sessions);
    assert.ok(sent.includes(one.id) && sent.includes(two.id), 'the row holds both sets');
    assert.equal(c.Cloud.syncState().dirty, false, 'and the device knows it');
  }
  // (b) the BOOT recognises it — through a second attempt that never reached the
  //     server at all, whose stamp is the only one a single slot would still hold
  {
    const s = context(), { c } = s;
    const row = server(JSON.parse(c.DB.exportJSON()));
    s.query(row.serve);
    await logSet(c, 8);
    row.lose = 1;
    assert.equal(await c.Cloud.push(), 'error');
    await logSet(c, 9);
    await later();
    row.down = 1;
    await assert.rejects(c.Cloud.push(), /Failed to fetch/, 'push 2 never reached the server');
    // The app is killed here; the next launch's boot sync finds push 1's row.
    await later();
    assert.equal(await c.Cloud.bootSync(), 'pushed', "the boot called push 1's own row «both sides changed»");
    assert.equal(row.errors.filter((e) => e.kind === 'sync-conflict').length, 0, 'nothing reported');
    assert.equal(row.version, 3, 'adopted, then pushed on top of it');
  }
}

// ── A GUIDED WORKOUT IS NOT ONE WHOLE-BLOB UPLOAD PER SET ─────────────────────
// Every save() armed a 1.2 s debounce and every debounce uploaded the ENTIRE
// blob. Sets land a rest apart — 90 s by default — so no two ever merged: a
// 10-set run re-sent the account's whole history ten times, and the server
// wrote ten history rows. While the run screen is open the upload is held (one
// timer per few minutes, not one per set); leaving the run and the app going
// to the background send it at once. The dirty flag is set exactly as before.
async function aWorkoutIsNotTenUploads() {
  const s = context(), { c } = s;
  let uploads = 0, version = 1;
  s.query(async (q) => { if (q.kind === 'update') { uploads++; version++; return { data: [{ version }], error: null }; } return { data: null, error: null }; });
  const ex = c.DB.exercises.list()[0].id;
  if (c.Cloud.pace) c.Cloud.pace('run');                  // what navigate('session-run') does
  let row = c.DB.sessions.add({ exerciseId: ex, date: '2026-09-15', sets: [{ reps: 8, weight: 60 }] });
  for (let set = 2; set <= 10; set++) {
    await s.advance(90000);                               // the default rest between two sets
    row = c.DB.sessions.update(row.id, { sets: row.sets.concat([{ reps: 8, weight: 60 }]) });
  }
  await s.advance(90000);
  assert.ok(uploads <= 3, `a 10-set run uploaded the whole blob ${uploads} times`);
  assert.ok(uploads >= 1, 'and still backs up while it runs');
  assert.equal(c.Cloud.syncState().dirty, true, '(the last sets are waiting, and the flag says so)');
  if (c.Cloud.pace) c.Cloud.pace('normal');               // leaving the run screen
  await s.advance(0);
  assert.equal(c.Cloud.syncState().dirty, false, 'leaving the run sends what it held — nothing is left behind');
  // The app going to the background mid-run sends the held upload at once.
  if (c.Cloud.pace) c.Cloud.pace('run');
  row = c.DB.sessions.update(row.id, { sets: row.sets.concat([{ reps: 6, weight: 60 }]) });
  await s.advance(1000);
  const before = uploads;
  s.hide();
  await s.advance(0);
  assert.equal(uploads, before + 1, 'hiding the app mid-run sends the held upload');
  assert.equal(c.Cloud.syncState().dirty, false, 'and the device knows it');
  assert.ok(JSON.stringify(c.DB.sessions.get(row.id).sets).length > 0);
}

// ── A NEWER BUILD'S BLOB SURVIVES THIS ONE ────────────────────────────────────
// SCHEMA_VERSION was written and never read, and every load rebuilt each set
// from reps, weight and done alone — normChanged, then written back. So the day
// a newer build adds a field to a set, a tab or WebView still on this build
// resumes, pulls, strips it, and its next edit pushes the stripped blob with a
// matching version: no conflict, nothing reported, the field gone from the
// account. Now an unknown per-set field rides through a load and a save, and a
// blob stamped with a NEWER schema is never pushed by an older build — the save
// centre shows the 'blocked' state it already has until the app updates.
async function newerBlobIsKeptWhole() {
  const s = context(), { c, values, keys } = s;
  const blob = JSON.parse(c.DB.exportJSON());
  blob.sessions = [{ id: 'fut1', exerciseId: blob.exercises[0].id, date: '2026-09-15', createdAt: '2026-09-15T10:00:00.000Z', laterField: 1,
    sets: [{ reps: 5, weight: 100, rpe: 8, warmup: false }, { reps: 3, weight: 110, done: false, tempo: '3-1-1' }] }];
  blob.futureSlice = { a: 1 };
  values.set(keys.store, JSON.stringify(blob)); c.DB.reload();
  c.DB.prefs.setUnit('lb');                               // any ordinary save
  let stored = JSON.parse(values.get(keys.store));
  assert.deepEqual(stored.sessions[0].sets[0], { reps: 5, weight: 100, rpe: 8, warmup: false }, 'an unknown per-set field is stripped on load → save');
  assert.deepEqual(stored.sessions[0].sets[1], { reps: 3, weight: 110, done: false, tempo: '3-1-1' }, 'and beside the done:false resume flag');
  assert.equal(stored.sessions[0].laterField, 1, 'an unknown session field survives');
  assert.deepEqual(stored.futureSlice, { a: 1 }, 'and so does an unknown top-level slice');

  blob.version = 99;                                      // a blob a NEWER build wrote
  values.set(keys.store, JSON.stringify(blob)); c.DB.reload();
  const writes = [];
  s.query(async (q) => { if (q.kind !== 'read' && q.table !== 'client_errors') writes.push(q.kind); return { data: [{ version: 2 }], error: null }; });
  c.DB.prefs.setUnit('kg');
  assert.equal(JSON.parse(values.get(keys.store)).version, 99, 'the newer stamp is never lowered');
  assert.equal(await c.Cloud.push(), 'blocked', 'an older build pushed a blob stamped with a newer schema');
  assert.equal(await c.Cloud.push({ force: true }), 'blocked', 'nor may «keep this device» force it up');
  assert.equal(writes.length, 0, 'nothing was offered to the row');
  assert.equal(c.Cloud.syncState().status, 'blocked', 'the save centre says sync is paused, with the state it already has');
  c.DB.resetAll();                                        // a reset replaces the blob without a load…
  assert.equal(c.DB.schemaTooNew(), false, '…and the device then holds this build\'s own default, not the newer blob');
  blob.version = 1;                                       // back on this build's schema
  values.set(keys.store, JSON.stringify(blob)); c.DB.reload();
  assert.equal(await c.Cloud.push(), 'ok', 'and pushes resume');
  // «Keep this device» over a row a NEWER build wrote would replace what this
  // build cannot read with what it can: refused, and nothing is sent.
  writes.length = 0;
  s.query(async (q) => { if (q.kind !== 'read' && q.table !== 'client_errors') writes.push(q.kind); return { data: { data: { ...blob, version: 99 }, version: 3, updated_at: '2026-09-15T11:00:00Z' }, error: null }; });
  assert.equal(await c.Cloud.chooseLocal(), 'failed', "«keep this device» force-pushed over a newer build's copy");
  assert.equal(writes.length, 0, 'and nothing was sent');
}

// ── A FORCE PUSH NEVER SHARES A PLAIN ONE ─────────────────────────────────────
// push() hands a caller the upload already in flight. For a plain push that is
// right; for «keep this device» (chooseLocal) and restoreRecovery it is not:
// the in-flight CONDITIONAL upload meets the moved row, answers 'conflict', and
// the user's explicit decision is reported as failed without ever being tried.
async function forceIsNotDowngraded() {
  const s = context(), { c } = s;
  c.DB.sessions.add({ exerciseId: c.DB.exercises.list()[0].id, date: '2026-09-15', sets: [{ reps: 8, weight: 60 }] });
  await tick(); await tick();
  const kinds = [];
  let answer;
  s.query((q) => { if (q.table !== 'client_errors') kinds.push(q.kind); return q.kind === 'update'
    ? new Promise((resolve) => { answer = () => resolve({ data: [], error: null }); })
    : Promise.resolve(q.kind === 'upsert' ? { data: [{ version: 9 }], error: null } : { data: { data: {}, version: 5 }, error: null }); });
  const plain = c.Cloud.push();
  await tick();
  const forced = c.Cloud.push({ force: true });
  await tick();
  if (answer) answer();
  assert.equal(await plain, 'conflict', '(the plain push meets the moved row)');
  assert.equal(await forced, 'ok', 'the force push was handed the plain one instead of running');
  assert.ok(kinds.includes('upsert'), 'the explicit decision reached the wire as the overwrite it is');
}

// ── A SHAPE THAT CRASHES THE LOAD IS REFUSED AT THE DOOR ─────────────────────
// _validateBlob checked section TYPES and _idsSafe passed a null element on
// purpose, so `exercises: [null]` imported «successfully» and loadState then
// threw at ex.imageSlug — READ-ONLY, after importJSON had already called
// onLocalChange: the bytes went up, and every device that pulled them went
// READ-ONLY too. A food-log day stored as an object threw at list.some.
// …AND A LOAD THAT CRASHES ANYWAY IS A FAILURE. importRaw and importJSON now
// ask DB.loadFailed() after the reload: a shape no rule anticipated puts the
// previous bytes back and reports false, which is what applyRemote's failure
// propagation needs to be told.
async function malformedBlobsAreRefused() {
  const s = context(), { c, values, keys } = s;
  const mine = c.DB.sessions.add({ exerciseId: c.DB.exercises.list()[0].id, date: '2026-09-09', sets: [{ reps: 8, weight: 40 }] });
  const base = () => JSON.parse(c.DB.exportJSON());
  let offered = 0;
  c.Cloud.onLocalChange = () => { offered++; };
  const SHAPES = {
    'a null exercise': (b) => { b.exercises.unshift(null); },
    'a bare value in the sleep log': (b) => { b.sleep = [42]; },
    'a food-log day stored as an object': (b) => { b.foodLogs = { '2026-09-01': { id: 'f1', name: 'x', calories: 1 } }; },
    'a null row inside a food-log day': (b) => { b.foodLogs = { '2026-09-01': [null] }; },
    'a supplement-log day that is not a map': (b) => { b.supplementLogs = { '2026-09-01': 'yes' }; },
  };
  for (const [name, mutate] of Object.entries(SHAPES)) {
    const b = base(); mutate(b);
    const imported = c.DB.importJSON(JSON.stringify(b));
    assert.equal(imported, false, `${name}: the backup imported (READ-ONLY afterwards: ${c.DB.loadFailed()})`);
    assert.equal(c.DB.loadFailed(), false, `${name}: the device is left READ-ONLY`);
    assert.equal(c.Cloud.applyRemote({ data: b }, 'alice'), false, `${name}: the pull applied it`);
  }
  assert.equal(offered, 0, 'a refused import is never offered to the cloud');
  assert.ok(c.DB.sessions.get(mine.id), 'and the device still holds its own data');

  // A load that throws for a reason no rule anticipated — injected, so the
  // honesty of the two import paths is tested apart from any one shape.
  vm.runInContext("{ const real = migratePlan; migratePlan = (p) => { if (p && p.poison) throw new Error('an unanticipated shape'); return real(p); }; }", c);
  // The way back RELOADS, and the reload's own migrations may re-normalise the
  // old bytes — so what must hold is "the previous data", not "the same string".
  const sessionsOf = () => JSON.stringify(JSON.parse(values.get(keys.store)).sessions);
  const before = sessionsOf();
  const poisoned = base(); poisoned.plan = { poison: true };
  assert.equal(c.Cloud.applyRemote({ data: poisoned }, 'alice'), false, 'a pull whose reload lands READ-ONLY is a FAILED pull');
  assert.equal(c.DB.loadFailed(), false, 'the previous bytes are back, and readable');
  assert.equal(sessionsOf(), before, 'the store holds the previous data');
  assert.equal(JSON.parse(values.get(keys.store)).plan.poison, undefined, 'and not the refused blob');
  assert.equal(c.DB.importJSON(JSON.stringify(poisoned)), false, 'an import whose reload lands READ-ONLY is a failed import');
  assert.equal(sessionsOf(), before, 'the store holds the previous data, again');
  assert.equal(offered, 0, 'and nothing was offered to the cloud');
  assert.ok(c.DB.sessions.get(mine.id), 'the device\'s own data survives both');
}

// ── HOUSEKEEPING IS NOT AN EDIT ──────────────────────────────────────────────
// CLAUDE.md's rule: a write the device re-derives for itself goes through
// saveLocal(). These run at BOOT, before bootSync's pull has answered, and a
// dirty flag set in that window is read by the pull as «both sides changed» —
// a conflict the user never made, whose «keep this device» force-pushes over
// the newer copy. The weekly-review stamp (load + 400 ms) still called save().
// Add the next boot-time housekeeping write to this list.
async function housekeepingIsNotAnEdit() {
  const HOUSEKEEPING = {
    'DB.prefs.setOnboarded()': (c) => c.DB.prefs.setOnboarded(),
    'DB.prefs.setReviewSeen(week)': (c) => c.DB.prefs.setReviewSeen('2026-09-13'),
    'DB.health.setData(cache)': (c) => c.DB.health.setData({ steps: { today: 4200 } }),
    'DB.exercises.mergeGlobal(catalog)': (c) => c.DB.exercises.mergeGlobal([{ id: 'g-row-1', name: 'Global Row', category: 'Back', image_slug: null, machine_type: null }]),
    'DB.notif.migrateFromReminders()': (c) => c.DB.notif.migrateFromReminders(),
    'DB.plan.markRestPrompted()': (c) => c.DB.plan.markRestPrompted(),
  };
  for (const [name, write] of Object.entries(HOUSEKEEPING)) {
    const s = context(), { c, values, keys } = s;
    c.DB.sessions.add({ exerciseId: c.DB.exercises.list()[0].id, date: '2026-09-09', sets: [{ reps: 8, weight: 40 }] });
    await tick(); await tick();                             // onLocalChange sets dirty again after its await
    values.delete(keys.dirty + 'alice');                    // that edit reached the cloud long ago
    const remote = JSON.parse(c.DB.exportJSON());
    remote.sessions.push({ id: 'tablet1', exerciseId: remote.exercises[0].id, date: '2026-09-14', sets: [{ reps: 5, weight: 80 }], createdAt: '2026-09-14T10:00:00.000Z' });
    let answer;                                             // the boot pull, still on the wire
    s.query((r) => new Promise((resolve) => { answer = () => resolve(r.fields === 'updated_at,version'
      ? { data: { version: 2, updated_at: '2026-09-14T10:00:00Z' }, error: null }
      : { data: { data: remote, version: 2, updated_at: '2026-09-14T10:00:00Z' }, error: null }); }));
    const boot = c.Cloud.bootSync();                        // the other device moved the row to v2
    await tick();
    const bytes = values.get(keys.store);
    write(c);                                               // …and the housekeeping write lands meanwhile
    await tick();
    assert.notEqual(values.get(keys.store), bytes, `${name} wrote nothing — the case would prove nothing`);
    assert.equal(c.Cloud.syncState().dirty, false, `${name} flagged the blob dirty — a boot-time housekeeping write must use saveLocal()`);
    for (let i = 0; i < 6 && answer; i++) { const a = answer; answer = null; a(); await tick(); await tick(); }
    assert.equal(await boot, 'pulled', `${name} during the boot pull turned it into a false 'conflict'`);
  }
}
module.exports = { context };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
