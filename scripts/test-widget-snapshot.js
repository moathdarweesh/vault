// The home-screen widget snapshot (v365), proved before any native code exists.
//
// This is the half that CAN be verified today: DB.widget.snapshot() is a pure
// read over DB, and DB.widget.push()/clear() are a guarded hand-off. Everything
// below runs the real js/storage.js in a vm over the shared harness — no copy of
// the function, so it cannot drift from what ships.
//
// Four things are worth more than the shape assertions:
//
//   · THE DAY. A widget sits on the home screen for hours untouched, so a day
//     resolved anywhere but at write time is not a flicker, it is the whole
//     display. This codebase has shipped that bug six times.
//   · WHAT IS NOT IN IT. The snapshot lives in native storage, outside every
//     localStorage sweep, and is drawn on the least private surface the phone
//     has. A photo or a token reaching it would be a leak with no way back.
//   · THAT IT IS INERT. With no plugin present nothing must be written and
//     nothing must throw — that is what lets the web half ship alone.
//   · THAT THE STUB IS THE PLUGIN. The first version of this file stubbed
//     `Plugins.Preferences` with `remove({key})` — the shape of a package this
//     app does not use — while the shipped clear() called a method the real
//     plugin never had. Every assertion passed against a plugin that did not
//     exist, and the shared-phone leak clear() exists to prevent would have
//     shipped green. The stub is now checked against WidgetBridgePlugin.kt on
//     every run; contract 40 does the same for the call sites.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { context } = require('./test-sync-status.js');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/storage.js'), 'utf8');

// ── the source half: the day may only come from the local helper ────────────
{
  const body = src.slice(src.indexOf('    snapshot(date) {'), src.indexOf('    /** Hand the snapshot'));
  assert.ok(body.length > 200, 'snapshot() was not found in js/storage.js — this suite is reading the wrong file');
  assert.ok(/todayISO\(\)/.test(body), 'snapshot() no longer resolves the day with todayISO()');
  assert.ok(!/toISOString\(\)\s*\.\s*slice/.test(body),
    'snapshot() slices a calendar day off an ISO timestamp — that reads the UTC day, which is yesterday for every UTC+ user before 03:00');
}

const state = context();
const { c, values, keys } = state;
const DB = c.DB;
const today = c.todayISO();

// ── seed through the REAL API, the way scripts/fp/fixture.js does ───────────
DB.plan.setRotation({
  cycle: [{ name: 'دفع', exerciseIds: ['a', 'b', 'c'] }, { name: 'سحب', exerciseIds: ['d', 'e'] }],
  trainingDays: [0, 1, 2, 3, 4, 5, 6],
  anchor: today,
});
DB.nutrition.setTargets({ calories: 2500, protein: 150, carbs: 250, fat: 80 });
DB.foodLogs.addMany(today, [{ name: 'أرز', calories: 1660, protein: 98, carbs: 200, fat: 40 }]);
DB.water.add(today, 1500);
DB.bodyweight.log(c.addDaysISO(today, -25), 78.6);
DB.bodyweight.log(today, 77.4);
// ⚠️ EVERY SEED IS CHECKED. cardioPlan.add refuses an unknown type and returns
// {ok:false} — my first draft passed 'walk' (the ICON name; the type id is
// 'walking'), so nothing was created, snap.cardio was null, and every assertion
// about it would have been testing an absence. A seed that fails silently makes
// the suite vacuous.
const planned = DB.cardioPlan.add({ type: 'walking', days: [0, 1, 2, 3, 4, 5, 6], duration: 30 });
assert.ok(planned && planned.ok !== false, 'the cardio seed was refused: ' + JSON.stringify(planned));
assert.equal(DB.cardioPlan.forDate(today).length, 1, 'the seeded cardio is not due today');
assert.ok(DB.nutrition.hasTargets(), 'the nutrition seed did not take');
assert.ok(DB.plan.workoutForDate(new Date(today + 'T12:00:00')), 'the plan seed did not take');

const snap = DB.widget.snapshot();

// ── shape ───────────────────────────────────────────────────────────────────
assert.equal(snap.v, 1, 'the snapshot carries no version — a native reader could not tell the shape apart');
assert.equal(snap.day, today, 'the snapshot is not for today');
assert.equal(typeof snap.at, 'number');
// ⚠️ JSON, NOT deepEqual. DB builds these objects INSIDE the vm realm, and
// assert.deepStrictEqual compares prototypes — two identical objects are not
// deepEqual across realms, and the failure prints them looking the same. The
// same trap is recorded on scripts/test-plan-import.js.
const same = (a, b, why) => assert.equal(JSON.stringify(a), JSON.stringify(b), why);
same(snap.kcal, { eaten: 1660, goal: 2500 }, 'calories');
same(snap.protein, { eaten: 98, goal: 150 }, 'protein');
same(snap.water, { ml: 1500, goal: DB.water.goal() }, 'water');
assert.equal(snap.workout && snap.workout.count, 3, 'the day\'s slot lost its exercise count');
assert.equal(snap.rest, false);
assert.equal(snap.weight.kg, 77.4);
assert.equal(snap.weight.delta30, -1.2, '30-day weight delta is wrong');
assert.equal(snap.cardio && snap.cardio.minutes, 30);
assert.equal(snap.cardio.done, false);

// ── the day is resolved at CALL time, and an explicit day is honoured ───────
{
  const past = c.addDaysISO(today, -3);
  assert.equal(DB.widget.snapshot(past).day, past, 'an explicit date is ignored');
  assert.equal(DB.widget.snapshot(past).water.ml, 0, 'the snapshot for another day read today\'s water');
  assert.equal(DB.widget.snapshot().day, today, 'the default day is not today');
}

// ── ⚠️ what must never be in it ─────────────────────────────────────────────
{
  const text = JSON.stringify(snap);
  for (const forbidden of ['customImage', 'imagePath', 'access_token', 'refresh_token', 'email', 'vault_img']) {
    assert.ok(!text.includes(forbidden), 'the snapshot carries `' + forbidden + '` — it is drawn on the home screen and survives in native storage');
  }
  // A snapshot is a handful of numbers. A history array reaching it would be a
  // silent copy of the user's log into a store nothing sweeps.
  assert.ok(text.length < 900, 'the snapshot is ' + text.length + ' bytes — something list-shaped got in');
  const flat = (o) => Object.values(o).every((v) => v === null || typeof v !== 'object' || !Array.isArray(v));
  assert.ok(flat(snap), 'the snapshot holds an array');
}

// ── inert with no plugin: nothing written, nothing thrown ──────────────────
{
  const before = values.size;
  assert.equal(DB.widget.push(), false, 'push() claimed success with no native plugin present');
  assert.equal(DB.widget.clear(), false, 'clear() claimed success with no native plugin present');
  assert.equal(values.size, before, 'push() wrote to localStorage — the snapshot belongs in NATIVE storage only');
  assert.equal(values.get(keys.widget) ?? null, null, 'the widget key landed in localStorage');
}

// ── and it lands once a plugin is there ────────────────────────────────────
{
  // ⚠️ THE STUB IS READ AGAINST THE KOTLIN, EVERY RUN. A stub is a promise
  // about a surface this harness cannot load; the only way to keep the promise
  // honest is to compare it with the file that defines the surface. Both
  // halves: the NAME the plugin registers under (a mismatch makes _plugin()
  // return null, and push() is documented to return false then — so the widget
  // would simply never update, with nothing to see), and the METHOD set (a
  // Capacitor call to a missing method rejects asynchronously, past the
  // synchronous try/catch, so clear() reports success having cleared nothing).
  const KT = path.join(ROOT, 'android/app/src/main/java/com/moath/thevault/WidgetBridgePlugin.kt');
  const kt = fs.readFileSync(KT, 'utf8');
  const name = (kt.match(/@CapacitorPlugin\s*\(\s*name\s*=\s*"(\w+)"/) || [])[1];
  assert.ok(name, 'WidgetBridgePlugin.kt declares no @CapacitorPlugin(name = "...")');
  // Anchored to line start: a commented-out annotation is not an export.
  const declared = [...kt.matchAll(/^[^\S\r\n]*@PluginMethod\s*\r?\n\s*fun\s+(\w+)\s*\(/gm)].map((m) => m[1]).sort();

  // The plugin OWNS the storage name — no key travels with a call, which is
  // why set() takes only {value}. 'snapshot' below mirrors the Kotlin's KEY
  // constant purely so the store is inspectable; nothing in JS names it.
  const store = new Map();
  const stub = {
    set({ value }) { store.set('snapshot', value); },
    clear() { store.delete('snapshot'); },
    status() { return { available: true, placed: 0, hasSnapshot: store.has('snapshot') }; },
  };
  assert.equal(JSON.stringify(Object.keys(stub).sort()), JSON.stringify(declared),
    'the stub does not mirror WidgetBridgePlugin.kt — stub [' + Object.keys(stub).sort() + '] vs @PluginMethod [' + declared + ']');
  c.Capacitor = { Plugins: { [name]: stub } };

  assert.equal(DB.widget.push(), true, 'push() failed with a plugin present');
  assert.equal(store.size, 1, 'push() reached the plugin under a name it does not register — check _plugin() against @CapacitorPlugin(name)');
  const written = JSON.parse(store.get('snapshot'));
  assert.equal(written.day, today, 'the written snapshot is not for today');
  assert.equal(written.kcal.eaten, 1660);

  assert.equal(DB.widget.clear(), true);
  assert.equal(store.size, 0, 'clear() left the snapshot in native storage — the next account on a shared phone would read it');

  // a plugin that throws must not take a save down with it
  stub.set = () => { throw new Error('native boom'); };
  assert.equal(DB.widget.push(), false, 'a throwing plugin was not contained');
  delete c.Capacitor;
}

// ── an empty install answers with nulls, never a throw ─────────────────────
{
  const fresh = context();
  const s = fresh.c.DB.widget.snapshot();
  assert.equal(s.workout, null);
  assert.equal(s.rest, true, 'an install with no plan does not read as a rest day');
  assert.equal(s.kcal, null, 'calories appeared with no goal set');
  assert.equal(s.weight, null);
  assert.equal(s.cardio, null);
  assert.equal(s.streak, 0);
  assert.equal(s.water.ml, 0);
}

// ── computeStreak lives in js/app.js and may not have run yet ──────────────
{
  assert.equal(typeof c.computeStreak, 'undefined', 'this harness loads app.js — the guard below proves nothing');
  assert.equal(DB.widget.snapshot().streak, 0, 'snapshot() threw or guessed when computeStreak was absent');
  c.computeStreak = () => 12;
  assert.equal(DB.widget.snapshot().streak, 12, 'snapshot() does not read computeStreak at call time');
}

// ── t() lives in js/ui.js and may not have run yet — the words are guarded ──
{
  assert.equal(typeof c.t, 'undefined', 'this harness loads ui.js — the guard below proves nothing');
  // {} and never raw keys: the Kotlin has an English fallback for every word
  // it is not handed; a raw key drawn on the home screen has none.
  same(DB.widget.snapshot().labels, {}, 'snapshot() threw or sent raw keys when t() was absent');
  c.t = (k) => 'L:' + k;
  same(DB.widget.snapshot().labels, {
    today: 'L:today', rest: 'L:rest_day', exercises: 'L:exercises',
    kcal: 'L:calories', protein: 'L:protein_g', water: 'L:water',
    since: 'L:widget_since', hoursShort: 'L:widget_hours_short',
    // the three widgets build 24 adds draw these six
    remaining: 'L:widget_remaining', streakUnit: 'L:widget_streak_unit',
    dayUnit: 'L:streak_days', qWorkout: 'L:widget_q_workout',
    qWeight: 'L:bodyweight', qWater: 'L:widget_q_water',
  }, 'the fourteen widget words are not each wired to their own key');
  delete c.t;
}

console.log('PASS widget snapshot: day resolved at write time, ' + JSON.stringify(snap).length
  + ' bytes with no photo/token/array, inert with no plugin, lands and clears through a stub '
  + 'that mirrors WidgetBridgePlugin.kt, words guarded on t(), and an empty install answers with nulls');
