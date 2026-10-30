#!/usr/bin/env node
/**
 * THE QUICK-ADJUST BAR'S ARITHMETIC AND THE PLATE CALCULATOR'S MATHS (v427).
 *
 * runAdjustValue(base, delta, field, unit) is what a tap on the bar under a
 * set input computes — the field's figure (or its ghost) plus a step, never
 * below zero, reps whole, a weight on the unit's 0.5 step. platesPerSide
 * (target, bar, plates) is what the plate sheet shows — the plates ONE side
 * takes, greedy from the largest, with the nearest loadable weight below when
 * the set cannot reach the target. Both are top-level functions in js/app.js
 * so this file reads them out of the shipped source and runs them bare, the
 * way scripts/test-run-list.js reads the run's order: nothing is copied here,
 * so it cannot drift from what the app executes. The two tables the sheet
 * loads from (PLATE_SETS, RUN_WEIGHT_STEP) are read the same way.
 *
 * Seen failing on in-memory plants of js/app.js before it was trusted (the
 * file on disk never written): the rounding dropped («a typed 60.3 + 1 lands
 * on the 0.5 step»), the clamp dropped («−1 at 0 stays 0»), the greedy walk
 * reversed («60 kg over 20: one 20 a side»), the remainder zeroed («61: …
 * nearest 60, 1 short»).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.resolve(__dirname, '..', 'js', 'app.js');
const src = fs.readFileSync(APP, 'utf8');
const FUNCS = ['runAdjustValue', 'platesPerSide'];
const CONSTS = ['RUN_WEIGHT_STEP', 'PLATE_SETS'];

// Pull each top-level declaration out by name: a function from `function
// NAME(` to the line that closes it at column 0; a table from its one line.
const lines = src.split(/\r?\n/);
const picked = [];
for (const name of CONSTS) {
  const line = lines.find((l) => l.startsWith(`const ${name} = `));
  assert.ok(line && line.endsWith(';'), `${name} is not a one-line top-level const in js/app.js — did it move?`);
  picked.push(line);
}
for (const name of FUNCS) {
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  assert.ok(start !== -1, `${name} is not a top-level function in js/app.js — did it move?`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) if (lines[i] === '}') { end = i; break; }
  assert.ok(end !== -1, `${name}: no closing brace at column 0`);
  picked.push(lines.slice(start, end + 1).join('\n'));
}
const ctx = vm.createContext({});
vm.runInContext(picked.join('\n') + '\n', ctx);
const { runAdjustValue, platesPerSide, RUN_WEIGHT_STEP, PLATE_SETS } =
  vm.runInContext(`({ ${[...CONSTS, ...FUNCS].join(', ')} })`, ctx);

const eq = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);

// ---- runAdjustValue: a tap on the bar ------------------------------------
eq(RUN_WEIGHT_STEP, { kg: 0.5, lb: 0.5 }, 'the weight step is the input\'s own 0.5 in both units');
eq(runAdjustValue(60, 2.5, 'weight', 'kg'), 62.5, 'an empty field with the ghost 60: «+2.5» is last time + 2.5');
eq(runAdjustValue(0, -1, 'weight', 'kg'), 0, '«−1» at 0 stays 0 — never below zero');
eq(runAdjustValue(8, 1, 'reps', 'kg'), 9, 'reps: 8 + 1');
eq(runAdjustValue(60.3, 1, 'weight', 'kg'), 61.5, 'a typed 60.3 + 1 lands on the 0.5 step');
eq(runAdjustValue(62.5, -2.5, 'weight', 'kg'), 60, '62.5 − 2.5');
eq(runAdjustValue(135, 5, 'weight', 'lb'), 140, 'lb: 135 + 5');
eq(runAdjustValue(137.3, 2.5, 'weight', 'lb'), 140, 'lb rounds to its 0.5 step too');
eq(runAdjustValue(0, -1, 'reps', 'kg'), 0, 'reps never below zero');
eq(runAdjustValue(8.4, 1, 'reps', 'kg'), 9, 'reps a whole number');
eq(runAdjustValue('', 2.5, 'weight', 'kg'), 2.5, 'nothing at all counts as 0');
eq(runAdjustValue('abc', 1, 'reps', 'kg'), 1, 'and so does noise');
eq(runAdjustValue('60', '2.5', 'weight', 'kg'), 62.5, 'strings, as an input hands them');

// ---- platesPerSide: the plates one side takes ----------------------------
eq(PLATE_SETS.kg, { bars: [20, 15, 10], plates: [25, 20, 15, 10, 5, 2.5, 1.25] }, 'the kg iron: three bars (20 first), seven plates heaviest first');
eq(PLATE_SETS.lb, { bars: [45, 35], plates: [45, 35, 25, 10, 5, 2.5] }, 'the lb iron: two bars (45 first), six plates — no 1.25');
const KG = PLATE_SETS.kg.plates, LB = PLATE_SETS.lb.plates;
eq(platesPerSide(60, 20, KG), { side: [20], loaded: 60, remainder: 0 }, '60 kg over 20: one 20 a side');
eq(platesPerSide(65, 20, KG), { side: [20, 2.5], loaded: 65, remainder: 0 }, '65: a 20 and a 2.5');
eq(platesPerSide(82.5, 20, KG), { side: [25, 5, 1.25], loaded: 82.5, remainder: 0 }, '82.5 with a 25 on the rack: 25 + 5 + 1.25, greedy from the largest');
eq(platesPerSide(100, 20, KG), { side: [25, 15], loaded: 100, remainder: 0 }, '100 with a 25: 25 + 15');
// The spec's two rows name a rack WITHOUT a 25 (their answers say so):
const NO25 = KG.filter((p) => p !== 25);
eq(platesPerSide(82.5, 20, NO25), { side: [20, 10, 1.25], loaded: 82.5, remainder: 0 }, '82.5 without a 25: 20 + 10 + 1.25');
eq(platesPerSide(100, 20, NO25), { side: [20, 20], loaded: 100, remainder: 0 }, '100 without a 25: two 20s');
eq(platesPerSide(61, 20, KG), { side: [20], loaded: 60, remainder: 1 }, '61: no plate makes 0.5 a side — nearest 60, 1 short');
eq(platesPerSide(15, 20, KG), { side: [], loaded: 20, remainder: -5 }, '15 over a 20 bar: lighter than the bar (a negative remainder)');
eq(platesPerSide(0, 20, KG), { side: [], loaded: 20, remainder: 0 }, '0: the bar only');
eq(platesPerSide('', 20, KG), { side: [], loaded: 20, remainder: 0 }, 'nothing: the bar only');
eq(platesPerSide(NaN, 20, KG), { side: [], loaded: 20, remainder: 0 }, 'noise: the bar only');
eq(platesPerSide(20, 20, KG), { side: [], loaded: 20, remainder: 0 }, 'exactly the bar: the bar only, not «lighter than»');
eq(platesPerSide(135, 45, LB), { side: [45], loaded: 135, remainder: 0 }, 'lb 135 over 45: one 45');
eq(platesPerSide(225, 45, LB), { side: [45, 45], loaded: 225, remainder: 0 }, '225: two 45s');
eq(platesPerSide(137.5, 45, LB), { side: [45], loaded: 135, remainder: 2.5 }, '137.5: no 1.25 in pounds — nearest 135, 2.5 short');
eq(platesPerSide(60, 15, KG), { side: [20, 2.5], loaded: 60, remainder: 0 }, 'a 15 kg bar: 22.5 a side');
eq(platesPerSide(60, 10, KG), { side: [25], loaded: 60, remainder: 0 }, 'a 10 kg bar: a 25 a side');
eq(platesPerSide(200, 20, KG), { side: [25, 25, 25, 15], loaded: 200, remainder: 0 }, 'repeated plates repeat: 90 a side is three 25s and a 15');
eq(platesPerSide(22.5, 20, KG), { side: [1.25], loaded: 22.5, remainder: 0 }, 'the smallest plate alone');
eq(platesPerSide(21, 20, KG), { side: [], loaded: 20, remainder: 1 }, '21: half a kilo a side is below every plate — the bar, 1 short');
eq(platesPerSide(60, 20, []), { side: [], loaded: 20, remainder: 40 }, 'no plates at all: the bar, the rest short');
eq(platesPerSide(60.01, 20, KG), { side: [20], loaded: 60, remainder: 0.01 }, 'a hundredth over: 60, a hundredth short — no float debris');
eq(KG, [25, 20, 15, 10, 5, 2.5, 1.25], 'and the plate list is never mutated');

console.log('PASS plates: the quick-adjust sum (ghost + step, clamped at 0, reps whole, weight on the 0.5 step in kg and lb) ' +
            'and the per-side plate walk (greedy from the largest over the kg and lb racks, the nearest loadable weight and its remainder, ' +
            'lighter than the bar, the bar only, three kg bars and two lb bars)');
