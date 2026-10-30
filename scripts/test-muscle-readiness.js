#!/usr/bin/env node
/**
 * MUSCLE READINESS (v428): the word under each well of THE BODY plate.
 *
 * muscleReadiness(lastDate, now) reads the day of a muscle's LAST session —
 * an ISO day, as sessions carry one — against the day of `now`, and answers
 * 'none' (no session ever), 'fatigued' (today), 'recovering' (yesterday) or
 * 'fresh' (two days or more). CALENDAR DAYS, not hours: a session logged
 * yesterday at 20:00 read at 00:30 is «yesterday», not «four hours ago» —
 * that is what a lifter means by «I trained yesterday». A future day reads as
 * today (defensive). muscleReadinessWord(state) is the word each state is
 * shown as, '' for `none`, through t() with whole-literal keys.
 *
 * Both are top-level functions in js/app.js, read out of the shipped source
 * and run bare the way scripts/test-plates.js reads the plate maths: nothing
 * is copied here, so this cannot drift from what the app executes.
 *
 * Seen failing on in-memory plants of js/app.js before it was trusted (the
 * file on disk never written): «null → none» (none returned as fresh), «by
 * the calendar day» (the day start dropped: 20:00 yesterday read as fresh,
 * 23:59 today as recovering), «a future date → fatigued» (fell through to
 * fresh), «two days ago → fresh» (two days read as recovering), «none → no
 * word» (a never-trained muscle given «ready»).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.resolve(__dirname, '..', 'js', 'app.js');
const src = fs.readFileSync(APP, 'utf8');
const FUNCS = ['muscleReadiness', 'muscleReadinessWord'];

// Pull each top-level function out by name: from `function NAME(` to the line
// that closes it at column 0.
const lines = src.split(/\r?\n/);
const picked = [];
for (const name of FUNCS) {
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  assert.ok(start !== -1, `${name} is not a top-level function in js/app.js — did it move?`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) if (lines[i] === '}') { end = i; break; }
  assert.ok(end !== -1, `${name}: no closing brace at column 0`);
  picked.push(lines.slice(start, end + 1).join('\n'));
}
// t() answers its key: the word test pins WHICH key each state reaches.
const ctx = vm.createContext({ t: (k) => k });
vm.runInContext(picked.join('\n') + '\n', ctx);
const { muscleReadiness, muscleReadinessWord } = vm.runInContext(`({ ${FUNCS.join(', ')} })`, ctx);

// Local-time clocks (the app's days are local days): Wednesday 30 September
// 2026 at 10:00, and the two edges of that day.
const at = (iso, hh, mm) => { const d = new Date(iso + 'T00:00:00'); d.setHours(hh, mm, 0, 0); return d; };
const NOW = at('2026-09-30', 10, 0);

assert.equal(muscleReadiness(null, NOW), 'none', 'null → none');
assert.equal(muscleReadiness(undefined, NOW), 'none', 'undefined → none');
assert.equal(muscleReadiness('', NOW), 'none', 'an empty day → none');
assert.equal(muscleReadiness('nope', NOW), 'none', 'a day that is not a day → none, never a throw');
assert.equal(muscleReadiness('2026-09-30', NOW), 'fatigued', 'today → fatigued');
assert.equal(muscleReadiness('2026-09-29', NOW), 'recovering', 'yesterday → recovering');
assert.equal(muscleReadiness('2026-09-28', NOW), 'fresh', 'two days ago → fresh');
assert.equal(muscleReadiness('2026-09-20', NOW), 'fresh', 'ten days ago → fresh');
assert.equal(muscleReadiness('2026-10-01', NOW), 'fatigued', 'a future date → fatigued (defensive)');
assert.equal(muscleReadiness('2027-03-01', NOW), 'fatigued', 'far in the future → fatigued too');
// By the calendar day, not by the hour: the day start is what counts.
assert.equal(muscleReadiness('2026-09-29', at('2026-09-30', 0, 30)), 'recovering', 'by the calendar day: yesterday read at 00:30 is recovering, not «fatigued» at 4 h');
assert.equal(muscleReadiness('2026-09-29', at('2026-09-30', 20, 0)), 'recovering', 'by the calendar day: yesterday read at 20:00 is recovering, not «fresh» at 44 h');
assert.equal(muscleReadiness('2026-09-30', at('2026-09-30', 23, 59)), 'fatigued', 'by the calendar day: today at 23:59 is still fatigued');
assert.equal(muscleReadiness('2026-09-28', at('2026-09-30', 0, 0)), 'fresh', 'by the calendar day: two days ago at midnight is fresh');
// `now` as a timestamp, or omitted (the clock).
assert.equal(muscleReadiness('2026-09-28', NOW.getTime()), 'fresh', 'a timestamp for now works');
const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
assert.equal(muscleReadiness(todayIso), 'fatigued', 'now omitted: the clock — today is fatigued');
assert.equal(muscleReadiness('2026-09-28', 'nope'), 'none', 'a now that is not a time → none, never a throw');

// The word: one whole-literal key per state, nothing for none.
assert.equal(muscleReadinessWord('fatigued'), 'mr_fatigued', 'fatigued → mr_fatigued');
assert.equal(muscleReadinessWord('recovering'), 'mr_recovering', 'recovering → mr_recovering');
assert.equal(muscleReadinessWord('fresh'), 'mr_fresh', 'fresh → mr_fresh');
assert.equal(muscleReadinessWord('none'), '', 'none → no word');
assert.equal(muscleReadinessWord(undefined), '', 'nothing → no word');

console.log('PASS muscle readiness: the state of a muscle from the day of its last session (none / fatigued today / recovering yesterday / fresh from two days, ' +
            'by the calendar day not the hour, a future day as today, noise as none) and the word each state reaches (one literal key each, none for a muscle never trained)');
