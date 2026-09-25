#!/usr/bin/env node
/**
 * The guided run's ORDER — the logic that decides which exercise is on screen.
 *
 * WHY THIS FILE EXISTS: that logic has broken SILENTLY twice.
 *   v307  a swapped-in exercise moved to the END of the run and the screen
 *         jumped forward one, so you finished on the exercise you had replaced.
 *   v331  «دائمًا» wrote the substitution into the plan, the plan then re-sorted
 *         the run under a POSITIONAL cursor, and the exercise just made
 *         permanent sat behind that cursor and was never reached — while its
 *         neighbour was presented twice.
 * Both times every contract and every suite stayed green, because none of this
 * was reachable from a test: it lived inside renderSessionRun's closure.
 *
 * It reads the functions out of the shipped js/app.js and runs them in a bare
 * context. Nothing is copied here, so this file cannot drift from what the app
 * actually executes — and app.js is not evaluated whole (it touches document at
 * top level), so no DOM shim is needed.
 *
 * v397 added three: the day's list as the DATABASE remembers it (dayIds), where
 * a re-entered run opens on that list (runResumeIdx), and what the reorder
 * sheet writes when it closes (reorderMerge). The first two exist because a
 * swap lived only in viewContext — close the app and the substitute's sets were
 * on no screen — and a calendar day showed only what the CURRENT rotation puts
 * on it, so a session logged off the plan could not be opened from its date.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.resolve(__dirname, '..', 'js', 'app.js');
const src = fs.readFileSync(APP, 'utf8');
const NAMES = ['runOrder', 'runReplace', 'runIdxAfterDrop', 'runSwapAllowed', 'dayIds', 'runResumeIdx', 'reorderMerge'];

// Pull each top-level declaration out by name: from `function NAME(` to the
// line that closes it at column 0.
const lines = src.split(/\r?\n/);
const picked = [];
for (const name of NAMES) {
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  assert.ok(start !== -1, `${name} is not a top-level function in js/app.js — did it move?`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) if (lines[i] === '}') { end = i; break; }
  assert.ok(end !== -1, `${name}: no closing brace at column 0`);
  picked.push(lines.slice(start, end + 1).join('\n'));
}
const ctx = vm.createContext({});
vm.runInContext(picked.join('\n') + '\n', ctx);
const { runOrder, runReplace, runIdxAfterDrop, runSwapAllowed, dayIds, runResumeIdx, reorderMerge } =
  vm.runInContext(`({ ${NAMES.join(', ')} })`, ctx);

const PLAN = ['a', 'b', 'c', 'd', 'e'];
const eq = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);

// ---- runOrder: the two meanings of runOnly --------------------------------
eq(runOrder(PLAN, null, false), PLAN, 'no runOnly: the run IS the plan');
eq(runOrder(PLAN, null, true), PLAN, 'ordered is meaningless without a list');

// A SELECTION has no order of its own, so the PLAN orders it...
eq(runOrder(PLAN, ['d', 'b'], false), ['b', 'd'], 'a selection is ordered by the plan');
// ...and anything outside the plan is appended, in the order given.
eq(runOrder(PLAN, ['d', 'z', 'b', 'y'], false), ['b', 'd', 'z', 'y'],
   'ids outside the plan append, keeping their own order');
eq(runOrder(PLAN, [], false), [], 'an empty selection selects nothing');

// THE RUN'S OWN LIST is the order — the plan must not touch it. This single
// assertion is the v331 HIGH bug.
eq(runOrder(PLAN, ['x', 'b', 'c', 'd', 'e'], true), ['x', 'b', 'c', 'd', 'e'],
   'an ORDERED list is returned verbatim — the plan never re-sorts it');
// The same input WITHOUT the flag is what used to happen, and it is wrong:
eq(runOrder(PLAN, ['x', 'b', 'c', 'd', 'e'], false), ['b', 'c', 'd', 'e', 'x'],
   'and unordered it would move the substitute to the end — the v307 defect');
// Even when the plan has since adopted the substitute, ordered wins.
eq(runOrder(['x', 'b', 'c'], ['x', 'b', 'c'], true), ['x', 'b', 'c'],
   'ordered list unchanged after «دائمًا» wrote the same ids into the plan');
eq(runOrder(undefined, ['b'], true), ['b'], 'a missing plan is an empty plan');

// ---- runReplace: position is preserved ------------------------------------
eq(runReplace(PLAN, 'a', 'x'), ['x', 'b', 'c', 'd', 'e'], 'a substitute takes the position');
eq(runReplace(PLAN, 'c', 'x'), ['a', 'b', 'x', 'd', 'e'], 'including in the middle');
eq(runReplace(PLAN, 'e', 'x'), ['a', 'b', 'c', 'd', 'x'], 'and at the end');
eq(runReplace(PLAN, 'a', null), ['b', 'c', 'd', 'e'], 'a drop closes the gap');
eq(runReplace(PLAN, 'c', null), ['a', 'b', 'd', 'e'], 'from the middle too');
eq(runReplace(PLAN, 'zz', 'x'), PLAN, 'an id that is not there changes nothing');
eq(PLAN, ['a', 'b', 'c', 'd', 'e'], 'and the input array is never mutated');
eq(runReplace(['a'], 'a', null), [], 'dropping the last one empties the list');

// ---- runIdxAfterDrop: stay on the position --------------------------------
assert.equal(runIdxAfterDrop(0, 4), 0, 'dropping the first keeps position 0 — the next slides in');
assert.equal(runIdxAfterDrop(2, 4), 2, 'the middle keeps its position');
assert.equal(runIdxAfterDrop(4, 4), 3, 'dropping the LAST steps back one');
assert.equal(runIdxAfterDrop(9, 4), 3, 'a stale index past the end clamps to the end');
assert.equal(runIdxAfterDrop(0, 0), 0, 'an empty run is position 0, never -1');
assert.equal(runIdxAfterDrop(3, 0), 0, 'even from a stale index');
assert.equal(runIdxAfterDrop(-1, 4), 0, 'a negative index never survives');

// ---- runSwapAllowed: the three refusals -----------------------------------
assert.equal(runSwapAllowed(PLAN, 'a', 'x'), true, 'the ordinary case is offerable');
assert.equal(runSwapAllowed(PLAN, 'zz', 'x'), false,
  'refused when the slot no longer holds the old exercise');
assert.equal(runSwapAllowed(PLAN, 'a', 'b'), false,
  'refused when the slot ALREADY holds the new one — a write would duplicate, not swap');
assert.equal(runSwapAllowed(PLAN, 'a', 'a'), false, 'refused when it is not a swap at all');
assert.equal(runSwapAllowed([], 'a', 'x'), false, 'an empty slot holds nothing to swap');
assert.equal(runSwapAllowed(undefined, 'a', 'x'), false, 'a missing slot is not offerable');
assert.equal(runSwapAllowed(PLAN, '', 'x'), false, 'an empty id is not an exercise');
assert.equal(runSwapAllowed(PLAN, 'a', null), false, 'and neither is a null one');

// ---- the two shipped regressions, replayed end to end ---------------------
// v331: start on A, swap A→X, then «دائمًا» writes [X,B,C,D,E] into the plan.
{
  let list = runOrder(PLAN, null, false);          // the run follows the plan
  let idx = 0;                                      // showing 'a'
  assert.equal(list[idx], 'a');
  list = runReplace(list, 'a', 'x');                // swap
  const planAfterAlways = ['x', 'b', 'c', 'd', 'e'];
  const shown = runOrder(planAfterAlways, list, true);
  assert.equal(shown[idx], 'x', 'v331: the swapped-in exercise is STILL on screen after «دائمًا»');
  const walk = [];
  for (let i = idx; i < shown.length; i++) walk.push(shown[i]);
  eq(walk, ['x', 'b', 'c', 'd', 'e'], 'v331: every exercise is reached exactly once');
  assert.equal(new Set(walk).size, walk.length, 'v331: and none is presented twice');
}
// v307: a swap must not move the substitute to the end of the run.
{
  const list = runReplace(PLAN, 'a', 'x');
  const shown = runOrder(PLAN, list, true);
  assert.equal(shown.indexOf('x'), 0, 'v307: the substitute stays where the exercise it replaced was');
  assert.notEqual(shown[shown.length - 1], 'x', 'v307: and is not pushed to the end');
}
// A drop leaves a walkable run with the next exercise in place.
{
  let list = runOrder(PLAN, null, false);
  let idx = 1;                                      // showing 'b'
  list = runReplace(list, 'b', null);
  idx = runIdxAfterDrop(idx, list.length);
  assert.equal(runOrder(PLAN, list, true)[idx], 'c', 'a drop slides the next exercise into place');
}

// ---- dayIds: the day as the database remembers it -------------------------
// The plan says what falls on a date; the sessions say what was DONE on it.
// Both screens that show a day (session-day, the guided run) build their list
// here, so a swap survives a closed app and a calendar day shows its sets.
const logged = (...rows) => rows.map((r) => (typeof r === 'string' ? { exerciseId: r } : r));
eq(dayIds(PLAN, []), PLAN, 'nothing logged: the day is the plan');
eq(dayIds(PLAN, logged('c', 'a')), PLAN, 'a logged plan exercise stays where the plan put it');
eq(dayIds(PLAN, logged('z')), ['a', 'b', 'c', 'd', 'e', 'z'],
   'a session off the plan is APPENDED — on screen, where it can be seen and edited');
eq(dayIds(PLAN, logged({ exerciseId: 'x', replaces: 'b' })), ['a', 'x', 'c', 'd', 'e'],
   'a logged substitute takes the PLACE of what it replaced — the swap survives the close');
eq(dayIds([], logged('z', 'y')), ['z', 'y'],
   'a day the rotation calls rest, or a day before the plan began: the list is what was logged, in order');
eq(dayIds(undefined, logged('z')), ['z'], 'a missing plan is an empty plan');
eq(dayIds(PLAN, logged({ exerciseId: 'x', replaces: 'q' })), ['a', 'b', 'c', 'd', 'e', 'x'],
   'a substitute for something this plan does not hold is only appended');
eq(dayIds(PLAN, logged({ exerciseId: 'c', replaces: 'a' })), PLAN,
   'a "substitute" that is already on the plan is not moved — it would be on the list twice');
eq(dayIds(PLAN, logged({ exerciseId: 'x', replaces: 'b' }, 'b')), ['a', 'x', 'c', 'd', 'e', 'b'],
   'the replaced exercise, logged after all, comes back — appended, never lost');
eq(dayIds(PLAN, logged('z', 'z')), ['a', 'b', 'c', 'd', 'e', 'z'], 'two sessions of one exercise are one entry');
eq(PLAN, ['a', 'b', 'c', 'd', 'e'], 'and the plan array is never mutated');

// ---- runResumeIdx: where a re-entered run opens ----------------------------
// The LAST exercise with a session is the one you were on. Only the day's OWN
// list counts for that: something logged off the plan earlier in the day is
// appended after it, and letting it win would open an evening run on the
// morning's extras.
assert.equal(runResumeIdx(PLAN, [], PLAN), 0, 'nothing logged: the first exercise');
assert.equal(runResumeIdx(PLAN, ['a', 'b'], PLAN), 1, 'the last one with a session — possibly mid-way');
assert.equal(runResumeIdx(PLAN.concat('z'), ['a', 'z'], PLAN), 0,
  'an extra logged off the plan does not pull the run past the plan exercise you were on');
assert.equal(runResumeIdx(PLAN.concat('z'), ['z'], PLAN), 0,
  'nothing of the plan logged yet: a fresh run starts on the plan, never on an extra logged earlier');
assert.equal(runResumeIdx(['z', 'y'], ['z', 'y'], []), 1, 'a list of extras alone resumes on its last');
{
  // The v369 close, after a swap: A→X at position 0, X logged, then B logged.
  const day = dayIds(['a', 'b', 'c'], logged({ exerciseId: 'x', replaces: 'a' }, 'b'));
  eq(day, ['x', 'b', 'c'], 'after a swap the reopened day holds the substitute in place');
  assert.equal(day[runResumeIdx(day, ['x', 'b'], day.slice(0, 3))], 'b',
    'and the run reopens on the exercise it was on, not on the substitute');
}

// ---- reorderMerge: what the reorder sheet writes ---------------------------
eq(reorderMerge(['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c']), null,
   'opened and closed without a move: nothing to write, nothing to sync');
eq(reorderMerge(['c', 'a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c']), ['c', 'a', 'b'], 'a move is written');
eq(reorderMerge(['c', 'a', 'b'], ['a', 'b', 'c'], ['a', 'b']), ['a', 'b'],
   'an exercise removed while the sheet was open is not resurrected by closing it');
eq(reorderMerge(['c', 'a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']), ['c', 'a', 'b', 'd'],
   'one added while it was open is kept, after the ones the user ordered');
eq(reorderMerge(['a', 'b'], ['a', 'b'], ['a', 'b', 'd']), null,
   'no move is still no write, whatever changed underneath');

console.log('PASS run list: selection vs ordered, replace keeps position, drop slides, ' +
            'swap refusals, the v307 + v331 regressions, the day as logged, the resume, and the reorder write');
