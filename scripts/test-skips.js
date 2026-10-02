// Behavioural checks for the day without training (v418): DB.skips and the
// sixth reminder channel, `missed`. Node built-ins only; no real user storage,
// no account, no network. Run: node scripts/test-skips.js
//
// The owner's request (2026-10-02): a planned training day that passes with no
// session logged is recorded as a day without training, and the user is told —
// without being bound to it. Two statuses come out of that, and these checks
// hold them apart: a REST date postpones the rotation's slot (DB.plan.setRest,
// unchanged), a SKIP moves nothing; a rest date wins wherever both could show.
// A session is any DB.sessions row on that date (a «minimum» one too); cardio
// is not a session.
//
// Every fixture is a date the case builds from the local clock, never a fixed
// calendar day: the rotation is anchored on a Sunday two weeks before «T», the
// latest Sunday on or before today, so the weekdays below are the same on every
// run and no fixture ever lies in the future.
//
// Written against the plan's names before the implementation existed; on v417
// it stops at the first case (STATE.skips is absent), which is the fail-first
// proof the release notes record.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context } = require('./test-sync-status');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const json = (v) => JSON.stringify(v);
// Values handed back by the vm context are built from ITS Array and Object, and
// strict deepEqual compares prototypes — so both sides go through JSON first.
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const deq = (got, want, msg) => assert.deepEqual(plain(got), plain(want), msg);

// One isolated app per case group: cloud.js + storage.js, a rotation of three
// named slots on Sun/Tue/Thu anchored on T-14, and small in-context helpers.
function app() {
  const h = context(), DB = h.c.DB;
  const run = (code) => vm.runInContext(code, h.c);
  const T = run('addDaysISO(todayISO(), -new Date().getDay())');   // the latest Sunday <= today
  const day = (n) => run(`addDaysISO(${json(T)}, ${n})`);
  // workoutForDate takes a Date; built with the numeric constructor (local midnight).
  run(`function __slot(iso) { const p = iso.split('-').map(Number); const w = DB.plan.workoutForDate(new Date(p[0], p[1] - 1, p[2])); return w ? w.name : null; }`);
  const slot = (iso) => run(`__slot(${json(iso)})`);
  const ids = DB.exercises.list().slice(0, 2).map((e) => e.id);
  DB.plan.setRotation({
    cycle: [{ name: 'QA Alpha', exerciseIds: ids }, { name: 'QA Beta', exerciseIds: ids }, { name: 'QA Gamma', exerciseIds: ids }],
    trainingDays: [0, 2, 4],
    anchor: day(-14),
  });
  const train = (iso, kind) => DB.sessions.add({ exerciseId: ids[0], date: iso, sets: [{ reps: 5, weight: 60 }], kind });
  const skips = () => JSON.parse(run('JSON.stringify(STATE.skips === undefined ? null : STATE.skips)'));
  return { h, DB, run, T, day, slot, train, skips };
}
const sorted = (a) => { const p = plain(a); return Array.isArray(p) ? p.sort() : p; };

// ---------------------------------------------------------------- an old blob
// A v417 blob has no `skips` at all; it must load with the default shape, not
// leave the slice undefined for the first settle() to trip on.
{
  const { h, run, skips } = app();
  assert.equal(run('save()').ok, true, 'setup: the blob is written');
  const raw = JSON.parse(h.values.get(h.keys.store));
  delete raw.skips;
  h.values.set(h.keys.store, json(raw));
  run('reloadState()');
  deq(skips(), { last: '', days: {} }, 'a blob without `skips` loads with the default { last: \'\', days: {} } — got ' + json(skips()));
}
{
  const { DB } = app();
  assert.equal(typeof DB.skips, 'object', 'DB.skips exists');
  assert.equal(DB.skips.MAX, 400, 'the record is capped at 400 days');
  assert.equal(DB.skips.BACKFILL_DAYS, 7, 'and looks back at most 7 days');
}

// ---------------------------------------------------------------- the first settle
// Tracking starts at the first settle: an existing user's past is never
// back-filled with days they could not have known were being recorded.
{
  const { DB, T, day, skips } = app();
  deq(DB.skips.settle(T), [], 'the first settle records nothing');
  assert.equal(skips().last, day(-1), 'and marks yesterday as settled');
  deq(skips().days, {}, 'with no day recorded');
  deq(DB.skips.settle(T), [], 'a second call the same day changes nothing');
  assert.equal(DB.skips.unseen(), null, 'nothing is unseen');
  deq(DB.skips.list(), [], 'and the list is empty');
}

// ---------------------------------------------------------------- what is recorded
// The week before T, with T-8 already settled: Sun T-7 trained, Tue T-5 declared
// rest, Thu T-3 planned and not trained; Mon/Wed/Fri/Sat are not training days.
{
  const { h, DB, T, day, train, skips } = app();
  DB.skips.settle(day(-7));                              // tracking starts: last = T-8
  assert.equal(skips().last, day(-8), 'setup: T-8 is the last settled day');
  train(day(-7));
  DB.plan.setRest(day(-5), true);
  const added = DB.skips.settle(T);
  deq(sorted(added), [day(-3)], 'exactly the planned day without a session is recorded — not the trained Sunday, not the rest Tuesday, not a non-training weekday: ' + json(added));
  deq(Object.keys(skips().days).sort(), [day(-3)], 'and the stored record holds that day alone: ' + json(skips().days));
  const rec = skips().days[day(-3)];
  assert.equal(typeof rec.at, 'string', 'an entry carries when it was recorded');
  assert.ok(!isNaN(Date.parse(rec.at)), 'as a datetime: ' + rec.at);
  assert.equal(rec.seen, false, 'and starts unseen');
  assert.equal(skips().last, day(-1), 'last moves to yesterday');
  // Idempotent: the same day again records nothing and writes nothing. A save
  // of identical bytes would leave the store unchanged, so the WRITE is counted
  // by the event save() dispatches, not by comparing what was stored.
  const saves = () => h.events.filter((e) => e === 'vault:save-state').length;
  const before = saves();
  deq(DB.skips.settle(T), [], 'a second settle the same day returns []');
  deq(Object.keys(skips().days), [day(-3)], 'and records nothing more');
  assert.equal(saves(), before, 'and writes nothing (a save() would flag the blob dirty for no change)');
  assert.equal(DB.skips.has(day(-3)), true, 'has() answers for the recorded day');
  assert.equal(DB.skips.has(day(-7)), false, 'not for the trained one');
  assert.equal(DB.skips.has(day(-5)), false, 'nor for the rest day');
}

// ---------------------------------------------------------------- a «minimum» session counts, cardio does not
{
  const { DB, T, day, train } = app();
  DB.skips.settle(day(-7));
  train(day(-5), 'minimum');
  DB.cardio.add({ type: 'walking', date: day(-3), duration: 30, calories: 0 });
  deq(sorted(DB.skips.settle(T)), [day(-7), day(-3)],
    'a «minimum» session is a session (T-5 not recorded); a walk is not one (T-3 recorded)');
}

// ---------------------------------------------------------------- the backfill cap
// last = T-13: the gap is twelve days, and only the last seven are looked at.
// T-12 (Tue) and T-10 (Thu) are planned, untrained and NOT recorded.
{
  const { DB, T, day, slot, skips } = app();
  DB.skips.settle(day(-12));                             // last = T-13
  assert.equal(skips().last, day(-13), 'setup: T-13 is the last settled day');
  const added = DB.skips.settle(T);
  deq(sorted(added), [day(-7), day(-5), day(-3)], 'the backfill stops at 7 days: ' + json(added));
  assert.equal(DB.skips.has(day(-12)), false, 'a planned day beyond the seven is not recorded');
  assert.equal(DB.skips.has(day(-10)), false, 'nor the other');

  // list(): newest first; unseen(): the newest unseen; a rest date wins.
  deq(DB.skips.list().map((x) => x.date), [day(-3), day(-5), day(-7)], 'list() is newest first');
  assert.ok(DB.skips.list().every((x) => typeof x.at === 'string' && x.seen === false), 'each row carries at and seen');
  const u = DB.skips.unseen();
  assert.ok(u && u.date === day(-3), 'unseen() is the newest unseen day: ' + json(u));
  DB.plan.setRest(day(-5), true);                         // declared after the fact, not through toRest()
  assert.equal(DB.skips.has(day(-5)), false, 'has() is false for a day in restDates — a rest date wins');
  deq(DB.skips.list().map((x) => x.date), [day(-3), day(-7)], 'and list() leaves it out');
  DB.plan.setRest(day(-5), false);
  assert.equal(DB.skips.has(day(-5)), true, 'the record itself was never touched');

  // toRest(): the record leaves, the day becomes a rest date, and the rotation
  // moves back one slot from there on — the day's workout is postponed.
  const names = ['QA Alpha', 'QA Beta', 'QA Gamma'];
  const wasToday = slot(T);
  const tok = DB.skips.toRest(day(-3));
  assert.ok(tok, 'toRest returns a token for its undo');
  assert.equal(skips().days[day(-3)], undefined, 'toRest removes the record');
  assert.equal(DB.plan.isRest(day(-3)), true, 'and declares the day rest');
  assert.ok(DB.plan.get().restDates.includes(day(-3)), 'in restDates');
  assert.equal(DB.skips.has(day(-3)), false, 'has() follows');
  assert.equal(slot(T), names[(names.indexOf(wasToday) + 2) % 3], `T's slot moves back one (${wasToday} → ${slot(T)})`);
  DB.skips.undoRest(tok);
  assert.equal(DB.plan.isRest(day(-3)), false, 'undoRest takes the rest date back');
  assert.equal(slot(T), wasToday, "and T's slot with it");
  const back = skips().days[day(-3)];
  assert.ok(back && back.seen === true, 'and puts the record back, already seen: ' + json(back));

  // markSeen(): every entry, and unseen() is empty after it.
  assert.ok(DB.skips.unseen(), 'setup: something is still unseen');
  DB.skips.markSeen();
  assert.ok(Object.values(skips().days).every((x) => x.seen === true), 'markSeen marks every entry');
  assert.equal(DB.skips.unseen(), null, 'and nothing is unseen after it');
}

// ---------------------------------------------------------------- the cap at 400
{
  const { DB, run, T, day, skips } = app();
  // 400 recorded days, long before the plan's anchor, oldest first.
  run(`(() => { const days = {}; let d = '2024-01-01'; for (let i = 0; i < 400; i++) { days[d] = { at: '2024-01-01T00:00:00.000Z', seen: true }; d = addDaysISO(d, 1); } STATE.skips = { last: ${json(day(-8))}, days }; })()`);
  const oldest = Object.keys(skips().days).sort().slice(0, 3);
  assert.equal(Object.keys(skips().days).length, 400, 'setup: 400 days on record');
  deq(sorted(DB.skips.settle(T)), [day(-7), day(-5), day(-3)], 'the three new days are recorded');
  const keys = Object.keys(skips().days);
  assert.equal(keys.length, DB.skips.MAX, 'the record stays at ' + DB.skips.MAX + ' (got ' + keys.length + ')');
  assert.ok([day(-7), day(-5), day(-3)].every((d) => keys.includes(d)), 'the newest are kept');
  assert.ok(oldest.every((d) => !keys.includes(d)), 'the oldest are dropped: ' + json(oldest));
}

// ---------------------------------------------------------------- the blob gate
{
  const { DB, day, skips } = app();
  const blob = JSON.parse(DB.exportJSON());
  assert.equal(DB._validateBlob(blob), true, 'setup: the exported blob validates');
  const older = { ...blob }; delete older.skips;
  assert.equal(DB._validateBlob(older), true, 'a blob without `skips` still validates');
  assert.equal(DB._validateBlob({ ...blob, skips: [] }), false, 'a `skips` that is not an object is refused');
  assert.equal(DB._validateBlob({ ...blob, skips: 'nope' }), false, 'nor a string');
  const good = { at: new Date().toISOString(), seen: false };
  const dirty = { ...blob, skips: { last: day(-1), days: {
    [day(-3)]: good,
    'not-a-date': { at: good.at, seen: false },
    [day(-5)]: 'nope',
    [day(-7)]: { at: 5, seen: false },
    [day(-10)]: null,
    [day(-12)]: { at: good.at, seen: 'yes' },
    [day(-14)]: { seen: false },
  } } };
  assert.equal(DB.importJSON(json(dirty)), true, 'a blob carrying malformed skip entries is still imported (the entries are dropped, the blob is not refused)');
  const days = (skips() || {}).days || {};
  deq(Object.keys(days), [day(-3)], 'only the well-formed entry survives: ' + json(days));
  deq(days[day(-3)], good, 'untouched');
}

// ---------------------------------------------------------------- the `missed` channel
{
  const { DB, run } = app();
  const today = run('todayISO()');
  deq(DB.notif.get().channels.missed, { on: true, at: '21:00' }, 'the channel defaults to on at 21:00: ' + json(DB.notif.get().channels.missed));
  DB.notif.setChannel('missed', { at: '20:30' });
  assert.equal(DB.notif.get().channels.missed.at, '20:30', 'setChannel sets its time');
  run('reloadState()');
  assert.equal(DB.notif.get().channels.missed.at, '20:30', 'and the time persists across a reload');
  DB.notif.setChannel('missed', { at: '25:99' });
  assert.equal(DB.notif.get().channels.missed.at, '20:30', 'an impossible time is refused');
  DB.notif.setChannel('missed', { at: 'soon' });
  assert.equal(DB.notif.get().channels.missed.at, '20:30', 'and a non-time');
  // destFor: the record's card is on Home. (Home is ALSO destFor's fallback, so
  // this line alone could not fail; contract 77 pins the explicit entry.)
  assert.equal(DB.notif.destFor('missed').view, 'home', 'a missed-workout reminder opens Home');

  // stillDue: today only, and silent the moment a session is logged — the
  // training reminder too (it used to fire after you trained).
  assert.equal(DB.notif.stillDue({ channel: 'missed', date: today }), true, 'missed is due with nothing logged today');
  assert.equal(DB.notif.stillDue({ channel: 'train', date: today }), true, 'train is due with nothing logged today');
  DB.cardio.add({ type: 'walking', date: today, duration: 20, calories: 0 });
  assert.equal(DB.notif.stillDue({ channel: 'missed', date: today }), true, 'a walk is not a session: missed stays due');
  assert.equal(DB.notif.stillDue({ channel: 'train', date: today }), true, 'and train');
  DB.sessions.add({ exerciseId: DB.exercises.list()[0].id, date: today, sets: [{ reps: 5, weight: 60 }] });
  assert.equal(DB.notif.stillDue({ channel: 'missed', date: today }), false, 'a session today silences the missed-workout reminder');
  assert.equal(DB.notif.stillDue({ channel: 'train', date: today }), false, 'and the training reminder');
}

// ---------------------------------------------------------------- a rest taken today silences both
// The training pair also yields to a rest date (stillDue, v418): a rest
// declared at noon on a planned training day, with NO session logged, leaves
// neither the training nor the missed-workout reminder due — the in-app timer
// used to stay live and say «no workout logged today» on a day declared rest.
// Today is made a planned day whatever the weekday: the same three slots on
// every weekday, anchored on T-14 (T-14 <= today, so today is inside the plan).
{
  const { DB, run, day, slot } = app();
  const today = run('todayISO()');
  const ids = DB.exercises.list().slice(0, 2).map((e) => e.id);
  DB.plan.setRotation({
    cycle: [{ name: 'QA Alpha', exerciseIds: ids }, { name: 'QA Beta', exerciseIds: ids }, { name: 'QA Gamma', exerciseIds: ids }],
    trainingDays: [0, 1, 2, 3, 4, 5, 6],
    anchor: day(-14),
  });
  assert.ok(slot(today), 'setup: today is a planned training day (its slot: ' + json(slot(today)) + ')');
  assert.equal(DB.plan.isRest(today), false, 'setup: today is not a rest date');
  assert.equal(DB.skips._trainedOn(today), false, 'setup: no session is logged today');
  const due = () => ({
    missed: DB.notif.stillDue({ channel: 'missed', date: today }),
    train: DB.notif.stillDue({ channel: 'train', date: today }),
  });
  deq(due(), { missed: true, train: true }, 'a planned training day with no session: the missed-workout and the training reminder are both due — got ' + json(due()));
  DB.plan.setRest(today, true);
  assert.equal(DB.plan.isRest(today), true, 'setup: today is a rest date now');
  assert.equal(DB.skips._trainedOn(today), false, 'and still no session is logged');
  deq(due(), { missed: false, train: false }, 'a rest declared today, with no session logged, silences the missed-workout and the training reminder — got ' + json(due()));
  DB.plan.setRest(today, false);
  deq(due(), { missed: true, train: true }, 'and taking the rest back makes both due again — got ' + json(due()));
}

// ---------------------------------------------------------------- the schedule and the words
// A rotation on every weekday anchored today, so tomorrow is a training day
// whatever today is. i18n.js, catalog.js and ui.js join the context for t().
{
  const h = context(), DB = h.c.DB, run = (code) => vm.runInContext(code, h.c);
  for (const f of ['js/i18n.js', 'js/catalog.js', 'js/ui.js']) vm.runInContext(read(f), h.c);
  const I18N = vm.runInContext('I18N', h.c);
  const today = run('todayISO()'), tomorrow = run('addDaysISO(todayISO(), 1)'), after = run('addDaysISO(todayISO(), 2)');
  const ids = DB.exercises.list().slice(0, 2).map((e) => e.id);
  DB.plan.setRotation({
    cycle: [{ name: 'QA Alpha', exerciseIds: ids }, { name: 'QA Beta', exerciseIds: ids }, { name: 'QA Gamma', exerciseIds: ids }],
    trainingDays: [0, 1, 2, 3, 4, 5, 6],
    anchor: today,
  });
  run(`function __slot(iso) { const p = iso.split('-').map(Number); const w = DB.plan.workoutForDate(new Date(p[0], p[1] - 1, p[2])); return w ? w.name : null; }`);
  const missedOn = (iso) => DB.notif.scheduleForDate(iso).filter((it) => it.channel === 'missed');
  const m = missedOn(tomorrow);
  assert.equal(m.length, 1, 'a training day arms one missed-workout reminder: ' + json(DB.notif.scheduleForDate(tomorrow).map((x) => x.tag)));
  assert.equal(m[0].at, '21:00', 'at the channel time');
  assert.equal(m[0].tag, 'missed:' + tomorrow, 'tagged by its day');
  DB.plan.setRest(after, true);
  assert.equal(missedOn(after).length, 0, 'a rest day arms none');
  DB.notif.setChannel('missed', { on: false });
  assert.equal(missedOn(tomorrow).length, 0, 'a switched-off channel arms none');
  DB.notif.setChannel('missed', { on: true });

  for (const l of ['ar', 'en']) {
    DB.prefs.setLang(l);
    const armed = DB.notif.text(missedOn(tomorrow)[0]);
    const live = DB.notif.text({ channel: 'missed', date: today, tag: 'missed:' + today });
    for (const [which, r, iso] of [['armed ahead', armed, tomorrow], ['today', live, today]]) {
      assert.equal(r.title, I18N[l].notif_missed_title, `the missed-workout title (${l}, ${which}): «${r.title}»`);
      assert.ok(!/[{}]/.test(r.title + r.body), `no unfilled placeholder (${l}, ${which}): «${r.title}» «${r.body}»`);
      const name = run(`__slot(${json(iso)})`);
      assert.ok(r.body.includes(name), `the body names the day's slot «${name}» (${l}, ${which}): «${r.body}»`);
    }
  }
}

console.log('PASS skips: an old blob loads the default; the first settle records nothing; a settle records exactly the planned untrained days (not a trained, a rest or a non-training day; a minimum session counts, a walk does not), backfills at most 7 days and is idempotent; has() yields to a rest date; toRest postpones the slot and undoRest restores it; markSeen/unseen; the 400 cap; the blob gate drops malformed entries; the missed channel defaults on at 21:00, validates its time, opens Home, is armed on a training day only, speaks both languages without a hole, and a session silences it and the training reminder, and so does a rest declared today with no session logged');
