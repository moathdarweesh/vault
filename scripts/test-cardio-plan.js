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

// ---------------------------------------------------------------- Health Connect imports (review 2026-09-25)
// Two ways a watch import made the cardio log wrong, and the one way a delete
// did not stick. Each case FAILED on v397 before its fix; the message says
// what v397 did instead.
{
  const h = context(), hdb = h.c.DB, hrun = (code) => vm.runInContext(code, h.c);
  const dayOf = (n) => hrun(`addDaysISO(todayISO(), ${n})`);
  // A LOCAL wall-clock time on an ISO day, as the ISO instant Health Connect sends.
  const at = (iso, hh, mm) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, hh, mm).toISOString(); };
  const rowsOn = (iso) => hdb.cardio.list().filter((x) => x.date === iso);

  // ── TICK FIRST, WATCH SECOND (features:body-home-settings#2). complete() claims
  // a walk that is already there; the reverse order had no reconciliation, so a
  // walk ticked on Home and synced from the watch later was two rows.
  assert.equal(hdb.cardioPlan.add({ type: 'walking', days: [0, 1, 2, 3, 4, 5, 6], duration: 30 }).ok, true);
  const pid = hdb.cardioPlan.list()[0].id;
  const D1 = dayOf(-2);
  assert.equal(hdb.cardioPlan.complete(pid, D1).ok, true);
  const tick = rowsOn(D1)[0];
  assert.equal(tick.planAuto, true, 'setup: the tick wrote its own row');
  const walk = { start: at(D1, 7, 0), end: at(D1, 7, 31), type: 'walking', minutes: 31, calories: 150 };
  hdb.cardio.importFromHealth([walk]);
  assert.equal(rowsOn(D1).length, 1, 'a ticked walk and the same walk from the watch are ONE row — v397 kept both, and every total counted the minutes twice');
  const adopted = rowsOn(D1)[0];
  assert.equal(adopted.id, tick.id, "the tick's row is adopted, id and all");
  assert.equal(adopted.planId, pid, 'it is still the tick');
  assert.equal(adopted.planAuto, undefined, "but no longer the tick's to delete");
  assert.equal(adopted.duration, 31, "the watch's minutes");
  assert.equal(adopted.calories, 150, "and its calories replace the tick's 0");
  assert.equal(adopted.source, 'health');
  assert.equal(adopted.hcKey, walk.start);
  assert.equal(hdb.cardioPlan.forDate(D1)[0].doneId, tick.id, 'the box stays ticked');
  assert.equal(hdb.cardioPlan.forDate(D1)[0].doneAuto, false, 'as a claim — the state complete() leaves in the other order');
  assert.equal(hdb.cardio.importFromHealth([walk]), 0, 'the next sync does not add it again');
  assert.equal(hdb.cardioPlan.uncomplete(pid, D1).ok, true);
  assert.equal(rowsOn(D1).length, 1, "an un-tick afterwards only unclaims: the watch's walk survives");
  assert.equal(rowsOn(D1)[0].duration, 31);
  // Only the tick's own row is adopted: never a row the user typed, never another type.
  const D2 = dayOf(-3);
  hdb.cardio.add({ type: 'walking', date: D2, duration: 20, calories: 90 });
  hdb.cardio.importFromHealth([{ start: at(D2, 8, 0), end: at(D2, 8, 25), type: 'walking', minutes: 25, calories: 120 }]);
  assert.equal(rowsOn(D2).length, 2, "a row the user typed is not the tick's, so it is never overwritten");
  const D3 = dayOf(-4);
  hdb.cardioPlan.complete(pid, D3);
  hdb.cardio.importFromHealth([{ start: at(D3, 9, 0), end: at(D3, 9, 40), type: 'running', minutes: 40, calories: 380 }]);
  assert.equal(rowsOn(D3).length, 2, 'a run is not the walk that was ticked');
  assert.equal(rowsOn(D3).find((x) => x.planId === pid).planAuto, true, 'and the tick is left as it was');

  // ── A DELETE STICKS (bugs:food-body#7, features:body-home-settings#4). The
  // dedupe knew only the rows still stored, and the next read starts at the
  // newest REMAINING key minus a day — so a deleted newest session was always
  // inside it, and came back.
  const run1 = { start: at(dayOf(-1), 18, 0), end: at(dayOf(-1), 18, 40), type: 'running', minutes: 40, calories: 400 };
  assert.equal(hdb.cardio.importFromHealth([run1]), 1);
  hdb.cardio.remove(hdb.cardio.list().find((x) => x.hcKey === run1.start).id);
  assert.equal(hdb.cardio.importFromHealth([run1]), 0, 'a deleted watch session stays deleted on the next sync — v397 imported it again');
  assert.equal(hdb.cardio.list().some((x) => x.hcKey === run1.start), false);
  const night = { start: at(dayOf(-2), 23, 10), end: at(dayOf(-1), 6, 40), minutes: 450, stages: { deep: 80, light: 250, rem: 90, awake: 30 } };
  assert.equal(hdb.sleep.importFromHealth([night]), 1);
  hdb.sleep.remove(hdb.sleep.list().find((x) => x.hcKey === night.start).id);
  assert.equal(hdb.sleep.importFromHealth([night]), 0, 'a deleted watch night stays deleted — v397 imported it again');
  assert.equal(hdb.sleep.list().some((x) => x.hcKey === night.start), false);
  // The refusal travels in the blob, so a delete on one device sticks on the others.
  const other = context();
  assert.equal(other.c.DB.importJSON(hdb.exportJSON()), true);
  assert.equal(other.c.DB.sleep.importFromHealth([night]), 0, 'a device that receives the blob refuses the night too');
  assert.equal(other.c.DB.cardio.importFromHealth([run1]), 0, 'and the run');
  // One domain's refusal is not the other's.
  const twin = { start: night.start, end: at(dayOf(-2), 23, 50), type: 'walking', minutes: 40, calories: 100 };
  assert.equal(hdb.cardio.importFromHealth([twin]), 1, "a walk that shares a deleted night's start is still imported");

  // ── KEPT ONLY WHILE IT CAN MATTER. The plugin reads history back 30 days at
  // most (HealthConnectPlugin.kt, historyStart), so an older key guards nothing:
  // it is pruned at the next delete, and the list has a ceiling.
  const oldKey = at(dayOf(-45), 22, 0);
  hrun(`STATE.healthDeleted.sleep.push(${json(oldKey)}, 'not a time')`);
  const night2 = { start: at(dayOf(-6), 23, 0), end: at(dayOf(-5), 7, 0), minutes: 480 };
  hdb.sleep.importFromHealth([night2]);
  hdb.sleep.remove(hdb.sleep.list().find((x) => x.hcKey === night2.start).id);
  const kept = JSON.parse(hdb.exportJSON()).healthDeleted.sleep;
  assert.equal(kept.includes(oldKey), false, 'a refusal older than the read-back window is pruned at the next delete');
  assert.equal(kept.includes('not a time'), false, 'and so is one that is not a time at all');
  assert.ok(kept.includes(night.start) && kept.includes(night2.start), 'the recent ones stay: ' + json(kept));
  hrun('STATE.healthDeleted.cardio = Array.from({ length: 400 }, (_, i) => new Date(Date.now() - i * 60000).toISOString())');
  hdb.cardio.remove(hdb.cardio.list().find((x) => x.hcKey === twin.start).id);
  const capped = JSON.parse(hdb.exportJSON()).healthDeleted.cardio;
  assert.ok(capped.length <= 200 && capped.includes(twin.start), 'the list has a ceiling, and the newest refusal is inside it (' + capped.length + ')');

  // ── THE BLOB GATES. Optional (an older backup has none), an object when
  // present, normalised on load, and NOT user data: a device whose only content
  // is a list of deletions is an empty device.
  const blob = JSON.parse(hdb.exportJSON());
  assert.equal(hdb._validateBlob(blob), true);
  assert.equal(hdb._validateBlob({ ...blob, healthDeleted: [] }), false, 'a non-object is refused');
  assert.equal(hdb._validateBlob({ ...blob, healthDeleted: 'nope' }), false);
  const older = { ...blob }; delete older.healthDeleted;
  assert.equal(hdb._validateBlob(older), true, 'a blob without it still validates');
  assert.equal(hdb.hasUserData({ healthDeleted: { sleep: [night.start] } }), false, 'deletions alone are not user data');
  const raw = JSON.parse(h.values.get(h.keys.store));
  raw.healthDeleted = { sleep: 'nope', cardio: [1, night.start, null, night.start, { x: 1 }] };
  h.values.set(h.keys.store, json(raw));
  hrun('reloadState()');
  const norm = JSON.parse(h.values.get(h.keys.store)).healthDeleted;
  assert.equal(json(norm), json({ sleep: [], cardio: [night.start] }), 'normalised on load and WRITTEN BACK: ' + json(norm));
}

// ---------------------------------------------------------------- one night is one night (features:body-home-settings#3)
// A night logged by hand and then read from the watch was two rows: Home
// summed them («14:15 نوم اليوم») and the hero showed whichever sorted first,
// the one without stages. The watch night now REPLACES the hand-logged one
// when the two cover the same stretch — more than half of the longer — and the
// row keeps its id. A nap beside a night, or a partial watch record inside a
// long hand-logged night, is not the same stretch.
{
  const h = context(), hdb = h.c.DB, hrun = (code) => vm.runInContext(code, h.c);
  const at = (iso, hh, mm) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, hh, mm).toISOString(); };
  const dayOf = (n) => hrun(`addDaysISO(todayISO(), ${n})`);
  const onDay = (iso) => hdb.sleep.list().filter((x) => x.date === iso);
  const D = dayOf(-1), E = dayOf(-2);
  const mine = hdb.sleep.add({ date: D, sleepTime: '23:30', wakeTime: '06:45' });
  const stages = { deep: 70, light: 260, rem: 70, awake: 20 };
  const watch = { start: at(E, 23, 40), end: at(D, 6, 50), minutes: 430, stages };
  hdb.sleep.importFromHealth([watch]);
  assert.equal(onDay(D).length, 1, 'a hand-logged night and the same night from the watch are ONE row — v397 kept both, and Home summed them');
  const one = onDay(D)[0];
  assert.equal(one.id, mine.id, 'the hand-logged row is kept, id and all');
  assert.equal(one.durationMinutes, 430, "with the watch's measured minutes");
  assert.equal(json(one.stages), json(stages), 'and its stages');
  assert.equal(one.sleepTime + ' ' + one.wakeTime, '23:40 06:50', 'and its times');
  assert.equal(one.source, 'health');
  assert.equal(hdb.sleep.importFromHealth([watch]), 0, 'the next sync does not add it again');
  // A nap is not the night.
  const F = dayOf(-3), G = dayOf(-4);
  hdb.sleep.add({ date: F, sleepTime: '14:00', wakeTime: '15:00' });
  hdb.sleep.importFromHealth([{ start: at(G, 23, 0), end: at(F, 7, 0), minutes: 480 }]);
  assert.equal(onDay(F).length, 2, 'a nap beside a night stays a nap');
  // A partial watch record does not swallow a long hand-logged night.
  const H = dayOf(-5);
  hdb.sleep.add({ date: H, sleepTime: '23:00', wakeTime: '07:00' });
  hdb.sleep.importFromHealth([{ start: at(H, 1, 0), end: at(H, 3, 0), minutes: 120 }]);
  assert.equal(onDay(H).length, 2, 'two hours inside an eight-hour night are not the same stretch');
  assert.equal(onDay(H).find((x) => x.source !== 'health').durationMinutes, 480, 'and the hand-logged night keeps its eight hours');
  // Deleting the merged night refuses the watch copy, like any watch night.
  hdb.sleep.remove(mine.id);
  assert.equal(hdb.sleep.importFromHealth([watch]), 0, 'deleting the merged night keeps the watch copy out too');
}

console.log('PASS cardio schedule: validation, local weekday, id-less join refused, claim-not-duplicate, un-tick preserves imported and corrected rows, schedule vs history, blob gates, load normalisation, undo, cap; Health Connect: tick-then-import is one row, a deleted watch session or night stays deleted (and on other devices), refusals pruned past the read-back window and capped, blob gates, a hand-logged night and the watch copy are one night');
