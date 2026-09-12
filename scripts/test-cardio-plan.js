// Behavioural checks for scheduled cardio. Node built-ins only; no real user
// storage, no account, no network. Run: node scripts/test-cardio-plan.js
//
// Every case here is a defect the design review predicted. They are written as
// tests rather than trusted as fixes, because this project's own history is full
// of corrections that read correctly and did nothing.
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { context } = require('./test-sync-status');

const s = context(), c = s.c, DB = c.DB;
const run = (code) => vm.runInContext(code, c);
const json = (v) => JSON.stringify(v);

// A Sunday and the Tuesday after it, in LOCAL terms.
const SUN = '2026-09-13';
const TUE = '2026-09-15';
assert.equal(new Date(2026, 8, 13).getDay(), 0, 'fixture day is a Sunday');
assert.equal(new Date(2026, 8, 15).getDay(), 2, 'fixture day is a Tuesday');

// ---------------------------------------------------------------- validation
assert.equal(DB.cardioPlan.add({ type: 'walking', days: [], duration: 30 }).ok, false, 'no days is refused');
assert.equal(DB.cardioPlan.add({ type: 'walking', days: [0], duration: 0 }).ok, false, 'zero duration is refused');
assert.equal(DB.cardioPlan.add({ type: 'walking', days: [0], duration: 2000 }).ok, false, 'absurd duration is refused');
assert.equal(DB.cardioPlan.add({ type: 'no-such-type', days: [0], duration: 30 }).ok, false, 'unknown type is refused');
assert.equal(DB.cardioPlan.list().length, 0, 'a refused add writes nothing');

const added = DB.cardioPlan.add({ type: 'walking', days: [2, 0, 0, 9, -1], duration: 30.4 });
assert.equal(added.ok, true);
const row = DB.cardioPlan.list()[0];
assert.equal(json(row.days), json([0, 2]), 'days are de-duplicated, range-checked and sorted');
assert.equal(row.duration, 30, 'duration is rounded to whole minutes');

// ---------------------------------------------------------------- forDate
assert.equal(DB.cardioPlan.forDate(SUN).length, 1, 'falls on its Sunday');
assert.equal(DB.cardioPlan.forDate('2026-09-14').length, 0, 'not on a Monday');
assert.equal(DB.cardioPlan.forDate('nonsense').length, 0, 'a malformed date yields nothing, never a throw');
// The UTC trap: new Date('2026-09-13') is UTC midnight, which is the 12th for
// every UTC+ user. forDate must use the numeric constructor.
assert.equal(DB.cardioPlan.forDate(SUN)[0].id, row.id);
assert.equal(DB.cardioPlan.forDate(SUN)[0].doneId, null, 'not done yet');

// ---------------------------------------------------------------- the id-less join
// A tampered/partial blob carrying a row with no id must never match a log row
// whose planId is also undefined — that would tick every such row at once.
run(`STATE.cardioPlan.push({ type: 'running', days: [0], duration: 20 })`);
run(`STATE.cardio.push({ id: 'c-orphan', type: 'running', date: '${SUN}' })`);
assert.equal(DB.cardioPlan.forDate(SUN).length, 1, 'an id-less schedule row is not served');
run(`STATE.cardioPlan = STATE.cardioPlan.filter(r => r.id)`);
run(`STATE.cardio = STATE.cardio.filter(x => x.id !== 'c-orphan')`);

// ---------------------------------------------------------------- complete
const done = DB.cardioPlan.complete(row.id, SUN);
assert.equal(done.ok, true);
const log1 = DB.cardio.list().filter((x) => x.date === SUN);
assert.equal(log1.length, 1, 'exactly one cardio row is written');
assert.equal(log1[0].planId, row.id, 'it carries the join key');
assert.equal(log1[0].planAuto, true, 'and is marked as created by the tick');
assert.equal(log1[0].duration, 30, 'with the scheduled duration');
assert.equal(DB.cardioPlan.forDate(SUN)[0].doneId, log1[0].id, 'forDate now reports it done');
assert.equal(DB.cardioPlan.complete(row.id, SUN).changed, false, 'ticking twice is a no-op');
assert.equal(DB.cardio.list().filter((x) => x.date === SUN).length, 1, 'and writes no second row');

// ---------------------------------------------------------------- uncomplete (ours)
assert.equal(DB.cardioPlan.uncomplete(row.id, SUN).ok, true);
assert.equal(DB.cardio.list().filter((x) => x.date === SUN).length, 0, 'a row the tick created is removed');
assert.equal(DB.cardioPlan.forDate(SUN)[0].doneId, null);

// ---------------------------------------------------------------- the Health Connect double-count
// A walk arrives from the watch BEFORE the user ticks. Ticking must CLAIM it, not
// add a second row — otherwise the minutes are counted twice with no way out.
const watch = DB.cardio.add({ type: 'walking', date: SUN, duration: 42, calories: 310 });
run(`STATE.cardio.find(x => x.id === ${json(watch.id)}).source = 'health'`);
assert.equal(DB.cardioPlan.complete(row.id, SUN).ok, true);
const afterClaim = DB.cardio.list().filter((x) => x.date === SUN);
assert.equal(afterClaim.length, 1, 'the watch row was claimed, not duplicated');
assert.equal(afterClaim[0].id, watch.id, 'and it is the same row');
assert.equal(afterClaim[0].duration, 42, "the watch's own minutes are untouched");
assert.equal(afterClaim[0].calories, 310, 'and its calories');
assert.equal(afterClaim[0].planAuto, undefined, 'it is NOT marked as ours');

// ---------------------------------------------------------------- uncomplete (theirs)
assert.equal(DB.cardioPlan.uncomplete(row.id, SUN).ok, true);
const afterUnclaim = DB.cardio.list().filter((x) => x.date === SUN);
assert.equal(afterUnclaim.length, 1, 'un-ticking does NOT delete a row the tick did not create');
assert.equal(afterUnclaim[0].id, watch.id);
assert.equal(afterUnclaim[0].duration, 42, "the user's data survives an un-tick");
assert.equal(afterUnclaim[0].planId, undefined, 'it is merely unclaimed');
assert.equal(DB.cardioPlan.forDate(SUN)[0].doneId, null, 'and the box reads empty again');

// ---------------------------------------------------------------- a corrected row
// The user ticks, then fixes the figures in the Cardio tab. Un-ticking must not
// throw that correction away.
assert.equal(DB.cardioPlan.complete(row.id, TUE).ok, true);
const mine = DB.cardio.list().find((x) => x.date === TUE);
DB.cardio.update(mine.id, { duration: 55, calories: 400 });
assert.equal(DB.cardio.list().find((x) => x.id === mine.id).planAuto, true, 'update keeps the marker');
DB.cardioPlan.uncomplete(row.id, TUE);
assert.equal(DB.cardio.list().filter((x) => x.date === TUE).length, 0,
  'a row the tick created is still the tick\'s to remove, even after an edit');

// ---------------------------------------------------------------- schedule vs history
DB.cardioPlan.complete(row.id, SUN);
const before = DB.cardio.list().length;
assert.equal(DB.cardioPlan.remove(row.id).ok, true);
assert.equal(DB.cardio.list().length, before, 'deleting the SCHEDULE never deletes logged sessions');
assert.equal(DB.cardioPlan.list().length, 0);

// ---------------------------------------------------------------- the blob gates
const good = DB.cardioPlan.add({ type: 'cycling', days: [1, 3], duration: 45 });
assert.equal(good.ok, true);
const blob = JSON.parse(DB.exportJSON());
assert.ok(Array.isArray(blob.cardioPlan) && blob.cardioPlan.length === 1, 'it exports');
assert.equal(DB._validateBlob({ ...blob, cardioPlan: {} }), false, 'a non-array is refused');
assert.equal(DB._idsSafe({ ...blob, cardioPlan: [{ type: 'walking', days: [0], duration: 10 }] }), false,
  'a row with no id is refused');
assert.equal(DB._idsSafe({ ...blob, cardioPlan: [{ id: 'bad id!', type: 'walking' }] }), false,
  'a row with an unsafe id is refused');
assert.equal(DB._idsSafe(blob), true, 'a real blob passes');
assert.equal(DB.hasUserData({ cardioPlan: blob.cardioPlan }), true,
  'a device whose only content is a schedule is NOT empty');

// ---------------------------------------------------------------- load normalisation
const raw = JSON.parse(s.values.get(s.keys.store));
raw.cardioPlan = [
  { id: 'keep-me', type: 'walking', days: [9, 1, 1, -2, 3], duration: '20.6' },
  { id: 'no-type', days: [1] },
  { type: 'running', days: [1], duration: 10 },
  null, 'nope', { id: 'bad id!', type: 'running', days: [1], duration: 5 },
];
s.values.set(s.keys.store, json(raw));
run('reloadState()');
const kept = DB.cardioPlan.list();
assert.equal(kept.length, 1, 'malformed rows are dropped, not repaired');
assert.equal(kept[0].id, 'keep-me');
assert.equal(json(kept[0].days), json([1, 3]), 'days cleaned on load');
assert.equal(kept[0].duration, 21, 'duration coerced on load');
assert.ok(JSON.parse(s.values.get(s.keys.store)).cardioPlan.length === 1,
  'the repaired shape is WRITTEN BACK, not just fixed in memory');

// ---------------------------------------------------------------- undo
DB.undo.clear();
const u = DB.cardioPlan.add({ type: 'treadmill', days: [5], duration: 15 });
assert.equal(DB.cardioPlan.list().length, 2);
assert.equal(DB.undo.apply(u.undoToken).ok, true);
assert.equal(DB.cardioPlan.list().length, 1, 'adding a schedule is undoable');

// ---------------------------------------------------------------- the cap
for (let i = 0; i < 30; i++) DB.cardioPlan.add({ type: 'walking', days: [i % 7], duration: 10 });
assert.equal(DB.cardioPlan.list().length, DB.cardioPlan.MAX, 'the list is capped');
assert.equal(DB.cardioPlan.add({ type: 'walking', days: [0], duration: 10 }).code, 'LIMIT');

console.log('PASS cardio schedule: validation, local weekday, id-less join refused, claim-not-duplicate, un-tick preserves imported and corrected rows, schedule vs history, blob gates, load normalisation, undo, cap');
