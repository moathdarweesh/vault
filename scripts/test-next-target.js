#!/usr/bin/env node
/**
 * THE NEXT TARGET (v434) — the rule behind «البرنامج الذي يتقدّم وحده».
 *
 * nextTarget(sessions, o) is what every open set row on the day card and in
 * the guided run now hints: not last time's figures, but the next target
 * computed from the lifter's own sessions — the weight, the reps of each row,
 * and the state that names the reason (`up`, `confirm`, `rep`, `stretch`,
 * `hold`, `deload`, `back`, `bw`, `first`). nxtRange reads the plan's rep
 * target («8-12», «١٠», «3x10»); nxtDayGap counts days; nxtWhy, nxtReps and
 * nxtFigure turn a result into the one line a screen prints. All are top-level
 * functions in js/app.js, so this file reads them out of the shipped source
 * and runs them bare against the REAL converters of js/ui.js — the way
 * scripts/test-plates.js does: nothing is copied here, so it cannot drift from
 * what the app executes.
 *
 * The table below is the spec's, case for case. Where a constant has a
 * source it is named in js/app.js beside NXT; where it is judgement the
 * comment there says so.
 *
 * Seen failing before it was trusted: on the tree without the rule («nextTarget
 * is not a top-level function in js/app.js»), and on in-memory plants of
 * js/app.js (the file on disk never written) — each named in
 * docs/RELEASE-NOTES.md under v434.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Pull each top-level declaration out by name: a function from `function
// NAME(` to the line that closes it at column 0; a table from its one line.
function slice(file, consts, funcs) {
  const lines = read(file).split(/\r?\n/), out = [];
  for (const name of consts) {
    const line = lines.find((l) => l.startsWith(`const ${name} = `));
    assert.ok(line && line.endsWith(';'), `${name} is not a one-line top-level const in ${file} — did it move?`);
    out.push(line);
  }
  for (const name of funcs) {
    const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
    assert.ok(start !== -1, `${name} is not a top-level function in ${file} — did it move?`);
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) if (lines[i] === '}') { end = i; break; }
    assert.ok(end !== -1, `${name}: no closing brace at column 0`);
    out.push(lines.slice(start, end + 1).join('\n'));
  }
  return out.join('\n');
}
const RULE = ['nxtRange', 'nxtDayGap', 'nextTarget', 'nxtWhy', 'nxtReps', 'nxtFigure'];
const code = [
  slice('js/ui.js', ['KG_TO_LB', 'NUM_FMT'], ['toDisplayWeight', 'toStoredKg', 'fmtNum']),
  slice('js/app.js', ['PLATE_SETS', 'NXT'], ['platesPerSide', ...RULE]),
].join('\n');
const said = [];
const ctx = vm.createContext({ t: (k) => { said.push(k); return k; } });
vm.runInContext(code + '\n', ctx);
const { NXT, nxtRange, nxtDayGap, nextTarget, nxtWhy, nxtReps, nxtFigure, toDisplayWeight, toStoredKg, platesPerSide, PLATE_SETS } =
  vm.runInContext('({ NXT, nxtRange, nxtDayGap, nextTarget, nxtWhy, nxtReps, nxtFigure, toDisplayWeight, toStoredKg, platesPerSide, PLATE_SETS })', ctx);

const eq = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);

// ---- the constants, pinned: a change here is a change of the rule ---------
eq(NXT, { lo: 8, hi: 12, over: 2, cap: 0.1, stall: 3, cut: 0.1, gap: 21, own: 3, sane: 1000 }, 'NXT: the zone 8–12, two reps over for a big jump, the 10% cap, three sessions to a deload of ~10%, 21 days to «back», three sets to a scheme of its own, the 1000 noise guard');
const five = (c) => `${c}, ${c}, ${c}, ${c}, ${c}`;

// ---- the table -------------------------------------------------------------
const TODAY = '2026-11-16';
const day = (n) => new Date(Date.UTC(2026, 10, 16) - n * 86400000).toISOString().slice(0, 10);
// «10,9,9@60» = three sets at 60 kg; «12@50,10@55,8@60» = a pyramid. A figure
// with no @ takes the weight of the next one to its right that has it.
function sets(text) {
  const parts = text.split(',').map((x) => x.trim());
  let w = 0;
  const out = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const [r, own] = parts[i].split('@');
    if (own !== undefined) w = Number(own);
    out.unshift({ reps: Number(r), weight: w });
  }
  return out;
}
const S = (ago, text, extra) => ({ date: day(ago), sets: sets(text), ...(extra || {}) });
const O = (extra) => ({ today: TODAY, unit: 'kg', legs: false, lo: 8, hi: 12, sets: null, open: false, ...(extra || {}) });
// One line per result: state, the range it worked in, w and r, then the rows
// as weight×reps in the unit on screen — «*» a prescribed row, «-» an empty figure.
function show(nx, unit) {
  if (nx === null) return 'null';
  if (nx.state === 'first') return `first ${nx.lo}-${nx.hi} | w=${nx.w} r=${nx.r} | ${nx.rows === null ? 'no rows' : 'ROWS'}`;
  const cell = (g) => `${g.weight === '' ? '-' : (unit === 'lb' ? toDisplayWeight(g.weight, 'lb') + 'lb' : g.weight)}x${g.reps === '' ? '-' : g.reps}${g.sug ? '*' : ''}`;
  return `${nx.state} ${nx.lo}-${nx.hi} | w=${nx.w} r=${nx.r} | ${nx.rows.map(cell).join(', ')}`;
}
const x3 = (c) => `${c}, ${c}, ${c}`, x2 = (c) => `${c}, ${c}`, x4 = (c) => `${c}, ${c}, ${c}, ${c}`;
const top3 = '12,12,12@60';
const CASES = [
  ['T01 no history', [], O(), 'first 8-12 | w=0 r=0 | no rows'],
  ['T02 no history, the plan says 6–8 × 4', [], O({ lo: 6, hi: 8, sets: 4 }), 'first 6-8 | w=0 r=0 | no rows'],
  ['T03 mid-range 10,9,9: the weakest set + 1, no row asked for less than it did', [S(3, '10,9,9@60')], O(), 'rep 8-12 | w=60 r=10 | ' + x3('60x10*')],
  ['T04 the top once: confirm it', [S(3, top3), S(6, '11,10,10@60')], O(), 'confirm 8-12 | w=60 r=12 | ' + x3('60x12*')],
  ['T05 the top on every set, two sessions running: heavier, back to the bottom', [S(3, top3), S(6, top3)], O(), 'up 8-12 | w=62.5 r=8 | ' + x3('62.5x8*')],
  ['T06 the top on SOME sets only is not the top', [S(3, '12,11,9@60'), S(6, top3)], O(), 'rep 8-12 | w=60 r=10 | 60x12*, 60x11*, 60x10*'],
  ['T07 two tops at DIFFERENT weights are one top at this weight', [S(3, '12,12@60'), S(6, '12,12@57.5')], O(), 'confirm 8-12 | w=60 r=12 | ' + x2('60x12*')],
  ['T08 one miss: hold the weight, and ONE rep more on the weakest set — never the whole way to the range in one session', [S(3, '7,6,6@60')], O(), 'hold 8-12 | w=60 r=7 | ' + x3('60x7*')],
  ['T09 two misses: still hold', [S(3, '7,6,6@60'), S(6, '7,7,6@60')], O(), 'hold 8-12 | w=60 r=7 | ' + x3('60x7*')],
  ['T10 three misses: lighter, on the plate grid', [S(3, '7,6,6@60'), S(6, '7,7,6@60'), S(9, '6,6,5@60')], O(), 'deload 8-12 | w=55 r=8 | ' + x3('55x8*')],
  ['T11 three misses at 40', [S(3, '7@40'), S(6, '7@40'), S(9, '7@40')], O(), 'deload 8-12 | w=35 r=8 | 35x8*'],
  ['T12 three misses at 5: 90% rounds back to 5, so there is nothing lighter — hold, never −50%', [S(3, '7@5'), S(6, '7@5'), S(9, '7@5')], O(), 'hold 8-12 | w=5 r=8 | 5x8*'],
  ['T13 three misses at 2.5: no lighter plate', [S(3, '7@2.5'), S(6, '7@2.5'), S(9, '7@2.5')], O(), 'hold 8-12 | w=2.5 r=8 | 2.5x8*'],
  ['T14 the best set in range, the weakest far under: the weakest + 1, not +3', [S(3, '9,6,5@60')], O(), 'hold 8-12 | w=60 r=6 | 60x9*, 60x6*, 60x6*'],
  ['T15 the weakest one under the range', [S(3, '8,7,7@60')], O(), 'rep 8-12 | w=60 r=8 | ' + x3('60x8*')],
  ['T16 21 days away: repeat your own figures, nothing prescribed', [S(21, top3), S(24, top3)], O(), 'back 8-12 | w=60 r=12 | ' + x3('60x12')],
  ['T17 20 days away is not a layoff', [S(20, top3), S(23, top3)], O(), 'up 8-12 | w=62.5 r=8 | ' + x3('62.5x8*')],
  ['T18 a pyramid after 60 days comes back as it was', [S(60, '12@50,10@55,8@60')], O(), 'back 8-12 | w=60 r=8 | 50x12, 55x10, 60x8'],
  ['T19 a single-number target «10», reached twice', [S(3, '10,10,10@60'), S(6, '10,10,10@60')], O({ lo: 10, hi: 10 }), 'up 10-10 | w=62.5 r=10 | ' + x3('62.5x10*')],
  ['T20 «10» with a set under it', [S(3, '10,9,8@60')], O({ lo: 10, hi: 10 }), 'hold 10-10 | w=60 r=9 | 60x10*, 60x9*, 60x9*'],
  ['T21 the plan says 4 sets, last time had 3', [S(3, top3), S(6, '12,12,12,12@60')], O({ sets: 4 }), 'up 8-12 | w=62.5 r=8 | ' + x4('62.5x8*')],
  ['T22 the plan says 6–8 × 4', [S(3, '8,8,8,8@60'), S(6, '8,8,8,8@60')], O({ lo: 6, hi: 8, sets: 4 }), 'up 6-8 | w=62.5 r=6 | ' + x4('62.5x6*')],
  ['T23 no plan, 10,10@40', [S(3, '10,10@40')], O(), 'rep 8-12 | w=40 r=11 | ' + x2('40x11*')],
  ['T24 bodyweight: the weakest + 1, no weight to hint', [S(3, '10,8,7@0')], O(), 'bw 8-12 | w=0 r=8 | -x10*, -x8*, -x8*'],
  ['T25 bodyweight at the top of a DECLARED range: nothing more to prescribe (the next step is added load)', [S(3, '12,12,12@0'), S(6, '12,12,12@0')], O(), 'null'],
  ['T26 pounds: 135 → 140, never 137.8', [S(3, '12,12,12@61.23'), S(6, '12,12,12@61.23')], O({ unit: 'lb' }), 'up 8-12 | w=63.5 r=8 | ' + x3('140lbx8*')],
  ['T27 pounds, legs from 110 lb: +10', [S(3, '12,12@102.06'), S(6, '12,12@102.06')], O({ unit: 'lb', legs: true }), 'up 8-12 | w=106.59 r=8 | ' + x2('235lbx8*')],
  ['T28 legs from 50 kg: +5', [S(3, '12,12,12@100'), S(6, '12,12,12@100')], O({ legs: true }), 'up 8-12 | w=105 r=8 | ' + x3('105x8*')],
  ['T29 legs under 50 kg: +2.5', [S(3, '12,12@47.5'), S(6, '12,12@47.5')], O({ legs: true }), 'up 8-12 | w=50 r=8 | ' + x2('50x8*')],
  ['T30 a jump over 10% (10 → 12.5): two reps past the range first', [S(3, '12,12,12@10'), S(6, '12,12,12@10')], O(), 'stretch 8-12 | w=10 r=13 | ' + x3('10x13*')],
  ['T31 the stretched bar reached once', [S(3, '14,14,14@10'), S(6, '13,13,12@10')], O(), 'confirm 8-12 | w=10 r=14 | ' + x3('10x14*')],
  ['T32 the stretched bar reached twice', [S(3, '14,14,14@10'), S(6, '14,14,14@10')], O(), 'up 8-12 | w=12.5 r=8 | ' + x3('12.5x8*')],
  ['T33 a lighter row keeps its own figures', [S(3, '10@40,12@60,12@60'), S(6, '10@40,12@60,12@60')], O(), 'up 8-12 | w=62.5 r=8 | 40x10, 62.5x8*, 62.5x8*'],
  ['T34 a pyramid: only the heaviest row is progressed', [S(3, '12@50,10@55,8@60')], O(), 'rep 8-12 | w=60 r=9 | 50x12, 55x10, 60x9*'],
  ['T35 two weights in one session', [S(4, '8@40,8@42.5')], O(), 'rep 8-12 | w=42.5 r=9 | 40x8, 42.5x9*'],
  ['T36 a deload asks two reps over the best set, and a back-off row that would now be heavier comes down with it — prescribed', [S(3, '5@60,5@60,8@57.5'), S(6, '6@60,5@60,8@57.5'), S(9, '6@60,6@60,8@57.5')], O(), 'deload 8-12 | w=55 r=7 | 55x7*, 55x7*, 55x8*'],
  ['T37 a «minimum» session counts: its sets are working sets', [S(2, top3, { kind: 'minimum' }), S(6, top3)], O(), 'up 8-12 | w=62.5 r=8 | ' + x3('62.5x8*')],
  ['T38 a set typed and not ticked (done:false) counts, as it does in the records', [{ date: day(3), sets: [{ reps: 12, weight: 60 }, { reps: 12, weight: 60 }, { reps: 9, weight: 60, done: false }] }], O(), 'rep 8-12 | w=60 r=10 | 60x12*, 60x12*, 60x10*'],
  ['T39 today\'s own row and a future row are not history', [{ date: day(-5), sets: [{ reps: 3, weight: 200 }] }, { date: TODAY, sets: [{ reps: 12, weight: 62.5 }] }, S(3, '10,10@60')], O(), 'rep 8-12 | w=60 r=11 | ' + x2('60x11*')],
  ['T40 two stored rows on one date are one session', [S(3, '12@60'), S(3, '12@60'), S(6, '11@60')], O(), 'confirm 8-12 | w=60 r=12 | ' + x2('60x12*')],
  ['T41 noise in a stored session is dropped, not obeyed', [{ date: day(3), sets: [{ reps: '8.6', weight: '60' }, { reps: -3, weight: 60 }, { reps: Infinity, weight: 60 }, { reps: 8, weight: NaN }, null, { reps: 0, weight: 0 }] }], O(), 'rep 8-12 | w=60 r=10 | 60x10*'],
  ['T42 only a weight-only row: no rule applies', [{ date: day(3), sets: [{ reps: 0, weight: 60 }] }], O(), 'null'],
  ['T43 history passed out of order', [S(9, '8@55'), S(3, '9@60'), S(6, '12@57.5')], O(), 'rep 8-12 | w=60 r=10 | 60x10*'],
  ['T44 a heavy five against a declared 8–12: six, never eight at a five-rep weight', [S(2, '5@100')], O(), 'hold 8-12 | w=100 r=6 | 100x6*'],
  ['T45 3×8@60 (the run suite\'s seed)', [S(3, '8,8,8@60')], O(), 'rep 8-12 | w=60 r=9 | ' + x3('60x9*')],
  ['T46 3×10@40 (the convenience suite\'s seed)', [S(3, '10,10,10@40')], O(), 'rep 8-12 | w=40 r=11 | ' + x3('40x11*')],
  ['T47 pounds: a hold returns the stored kilograms untouched', [S(3, '5,5@61.23')], O({ unit: 'lb' }), 'hold 8-12 | w=61.23 r=6 | ' + x2('135lbx6*')],
  ['T48 a weight-only row heavier than the working weight', [{ date: day(3), sets: [{ reps: 10, weight: 60 }, { reps: 0, weight: 70 }] }], O(), 'rep 8-12 | w=60 r=11 | 60x11*, 70x-'],
  ['T49 pounds: a deload lands on the 5-lb grid', [S(3, '6@61.23'), S(6, '6@61.23'), S(9, '7@61.23')], O({ unit: 'lb' }), 'deload 8-12 | w=54.43 r=8 | 120lbx8*'],
  ['T50 confirm keeps reps already above the top', [S(3, '15,14,12@60')], O(), 'confirm 8-12 | w=60 r=12 | 60x15*, 60x14*, 60x12*'],
  ['T51 no declared range, 5,5,5: a scheme of its own', [S(3, '5,5,5@100')], O({ open: true }), 'confirm 5-5 | w=100 r=5 | ' + x3('100x5*')],
  ['T52 the same twice: the scheme goes up', [S(3, '5,5,5@100'), S(6, '5,5,5@100')], O({ open: true }), 'up 5-5 | w=102.5 r=5 | ' + x3('102.5x5*')],
  ['T53 the same history under a DECLARED 8–12 is a miss', [S(3, '5,5,5@100'), S(6, '5,5,5@100')], O(), 'hold 8-12 | w=100 r=6 | ' + x3('100x6*')],
  ['T54 two sets are not a scheme: the zone stands, one rep at a time', [S(3, '5,5@100')], O({ open: true }), 'hold 8-12 | w=100 r=6 | ' + x2('100x6*')],
  ['T55 three sets within one rep of each other under the zone ARE a scheme: 6,5,5 is 5–6', [S(3, '6,5,5@100')], O({ open: true }), 'rep 5-6 | w=100 r=6 | ' + x3('100x6*')],
  ['T56 no declared range, sets inside the zone: the zone stands', [S(3, '10,10,10@60')], O({ open: true }), 'rep 8-12 | w=60 r=11 | ' + x3('60x11*')],
  ['T57 a 5×5 lifter adding weight every session', [S(3, '5,5,5@102.5'), S(6, '5,5,5@100')], O({ open: true }), 'confirm 5-5 | w=102.5 r=5 | ' + x3('102.5x5*')],
  ['T58 an off-grid 24 (a dumbbell) snaps to the plate grid going up', [S(3, '14,14,14@24'), S(6, '14,14,14@24')], O(), 'up 8-12 | w=27.5 r=8 | ' + x3('27.5x8*')],
  ['T59 a lighter high-rep row after the working set keeps its figures', [S(3, '10@60,15@40')], O(), 'rep 8-12 | w=60 r=11 | 60x11*, 40x15'],
  ['T60 10,9,8: weakest + 1 is 9', [S(3, '10,9,8@60')], O(), 'rep 8-12 | w=60 r=9 | 60x10*, 60x9*, 60x9*'],
  ['T61 a stored row of zeros is no history', [{ date: day(3), sets: [{ reps: 0, weight: 0 }] }], O(), 'first 8-12 | w=0 r=0 | no rows'],
  ['T62 24 kg at the top twice: the step is over 10%, so not yet', [S(3, '12,12,12@24'), S(6, '12,12,12@24')], O(), 'stretch 8-12 | w=24 r=13 | ' + x3('24x13*')],
  ['T63 pounds, legs under 110 lb: +5', [S(3, '12,12@47.63'), S(6, '12,12@47.63')], O({ unit: 'lb', legs: true }), 'up 8-12 | w=49.9 r=8 | ' + x2('110lbx8*')],
  ['T64 the plan says 2 sets, last time had 3', [S(3, '10,9,9@60')], O({ sets: 2 }), 'rep 8-12 | w=60 r=10 | ' + x2('60x10*')],
  ['T65 one set', [S(3, '9@40')], O(), 'rep 8-12 | w=40 r=10 | 40x10*'],
  ['T66 pounds: 25 lb at the top twice is a big jump', [S(3, '12,12@11.34'), S(6, '12,12@11.34')], O({ unit: 'lb' }), 'stretch 8-12 | w=11.34 r=13 | ' + x2('25lbx13*')],
  ['T67 a step of exactly 10% is allowed', [S(3, '12,12@25'), S(6, '12,12@25')], O(), 'up 8-12 | w=27.5 r=8 | ' + x2('27.5x8*')],
  // ── the stall counter and its guards (the review's surviving mutants) ──
  ['T68 three misses, the oldest at ANOTHER weight: only two at this one — hold', [S(3, '7@60'), S(6, '7@60'), S(9, '7@62.5')], O(), 'hold 8-12 | w=60 r=8 | 60x8*'],
  ['T69 the oldest of three had its best set in the range: not a third miss', [S(3, '7,7@60'), S(6, '7,7@60'), S(9, '9,6@60')], O(), 'hold 8-12 | w=60 r=8 | ' + x2('60x8*')],
  ['T70 three misses at 1 kg: 90% rounds to nothing, so there is no deload — never a target of 0 kg', [S(3, '7@1'), S(6, '7@1'), S(9, '7@1')], O(), 'hold 8-12 | w=1 r=8 | 1x8*'],
  ['T71 a big jump with the weakest set under the top is «one more rep», not a stretch', [S(3, '10,10,10@10')], O(), 'rep 8-12 | w=10 r=11 | ' + x3('10x11*')],
  ['T72 legs at exactly 50 kg: +5', [S(3, '12,12@50'), S(6, '12,12@50')], O({ legs: true }), 'up 8-12 | w=55 r=8 | ' + x2('55x8*')],
  ['T73 pounds, legs at exactly 110 lb: +10', [S(3, '12,12@49.9'), S(6, '12,12@49.9')], O({ unit: 'lb', legs: true }), 'up 8-12 | w=54.43 r=8 | ' + x2('120lbx8*')],
  ['T74 back from a layoff with ragged sets: every row repeats its own', [S(25, '10,9,8@60')], O(), 'back 8-12 | w=60 r=8 | 60x10, 60x9, 60x8'],
  // ── low-rep lifters: never eight reps at a five-rep weight (the review, critical) ──
  ['T75 a 5×5 with ONE missed rep keeps its scheme: the missed rep is the target', [S(3, '5,5,5,5,4@100'), S(6, '5,5,5,5,5@100')], O({ open: true, legs: true }), 'rep 4-5 | w=100 r=5 | ' + five('100x5*')],
  ['T76 a heavy single over back-off sets is asked for ONE more rep, not eight', [S(3, '1@140,5@100,5@100,5@100')], O({ open: true }), 'hold 8-12 | w=140 r=2 | 140x2*, 100x5, 100x5, 100x5'],
  ['T77 three sessions of a heavy single: lighter, and two reps over the single — not eight at nine tenths of a max', [S(3, '1@140'), S(6, '1@140'), S(9, '1@140')], O(), 'deload 8-12 | w=125 r=3 | 125x3*'],
  ['T78 the first session after a raise is not a scheme: the session before it was in the zone', [S(3, '7,7,6@62.5'), S(6, top3)], O({ open: true }), 'hold 8-12 | w=62.5 r=7 | ' + x3('62.5x7*')],
  ['T79 7,6,6 twice with no declared range is the lifter\'s own range', [S(3, '7,6,6@40'), S(6, '7,6,6@40')], O({ open: true }), 'rep 6-7 | w=40 r=7 | ' + x3('40x7*')],
  ['T80 a spread of two reps is not a scheme', [S(3, '7,6,5@40')], O({ open: true }), 'hold 8-12 | w=40 r=6 | 40x7*, 40x6*, 40x6*'],
  // ── the plan's set count is a count of WORKING sets ──
  ['T81 warm-up rows do not eat the planned sets', [S(3, '10@20,10@20,8@60,8@60,8@60')], O({ sets: 3 }), 'rep 8-12 | w=60 r=9 | 20x10, 20x10, 60x9*, 60x9*, 60x9*'],
  ['T82 a pyramid under the same count keeps its three rows', [S(3, '12@50,10@55,8@60')], O({ sets: 3 }), 'rep 8-12 | w=60 r=9 | 50x12, 55x10, 60x9*'],
  ['T83 a set the plan does not ask for is not what the plan is judged on: 12,12,(9) under a 2-set plan is the top once', [S(3, '12,12,9@60')], O({ sets: 2 }), 'confirm 8-12 | w=60 r=12 | ' + x2('60x12*')],
  // ── bodyweight ──
  ['T84 bodyweight under a declared range climbs to its top and no further', [S(3, '11,11@0')], O(), 'bw 8-12 | w=0 r=12 | ' + x2('-x12*')],
  ['T85 bodyweight with NO declared range keeps climbing', [S(3, '12,12,12@0'), S(6, '12,12,12@0')], O({ open: true }), 'bw 8-12 | w=0 r=13 | ' + x3('-x13*')],
  ['T86 bodyweight has no scheme of its own: three sixes do not rewrite the zone', [S(3, '6,6,6@0')], O({ open: true }), 'bw 8-12 | w=0 r=7 | ' + x3('-x7*')],
  ['T87 a newest session with a weight and no reps has no working set: nothing is prescribed', [S(3, '0@60'), S(6, '8,8@60')], O(), 'null'],
];
for (const [name, hist, o, want] of CASES) {
  const frozen = JSON.stringify(hist);
  const got = nextTarget(hist, o);
  assert.equal(show(got, o.unit), want, name);
  assert.equal(JSON.stringify(hist), frozen, name + ' — the history handed in is never mutated');
}

// ---- nxtRange: the plan's rep target as a range, or null (the plan stays the instruction) ----
const RANGES = [
  [['8-12', '8–12', '8 — 12', '٨-١٢', '۸ إلى ۱۲', '12-8', '8 to 12', '4 x 8-12', '8-12 reps'], { lo: 8, hi: 12 }],
  [['8-10 لكل جهة'], { lo: 8, hi: 10 }],
  [['15 – 20'], { lo: 15, hi: 20 }],
  [['10', '3x10', '3×10', '3*10', '10 each side', '10 مرات', '١٠'], { lo: 10, hi: 10 }],
  [['5x5'], { lo: 5, hi: 5 }],
  [['12x'], { lo: 12, hi: 12 }],
  [['8~12', '8 الى 12', '8 حتى 12'], { lo: 8, hi: 12 }],
  [['1'], { lo: 1, hi: 1 }],
  // a count of SETS is not a rep target, and «the larger figure first» is ambiguous without the plan's count
  [['3 sets', '3 مجموعات', '4 جولات', '12 sets', '10 x 3 sets', '4 rounds', '12×3', '10x3'], null],
  // more units a plan sheet writes: a time, a load, energy
  [['30 ثانيه', '1 دقيقه', '5 دقايق', '1 ساعة', '1 hour', '2 hrs', '30″', '30"', "1'", '10 كجم', '10 كغم', '10 كيلو', '10 باوند', '10 kgs', '15 cal', '20kg', '45 lb', '2 min', '8-12 lbs'], null],
  [['RIR 2', '2 RIR', '10 max', '30٪'], null],
  // time and distance, a word that is not a count, a per-set list, a load: not a rep range
  [['30 sec', '30s', '1:00', '٣٠ ثانية', '2 د', '45 ثانية لكل جهة', '20 m'], null],
  [['AMRAP', 'حتى الفشل', 'RPE 8', '5 @ 80%'], null],
  [['10 / 8 / 6', '12, 10, 8', '10/8', '8-12 @ 60kg'], null],
  [['0-99', '60', '0', '', '   ', 'slow', 8, null, undefined], null],
];
for (const [inputs, want] of RANGES) for (const input of inputs) eq(nxtRange(input), want, `nxtRange(${JSON.stringify(input)})`);
// The slot's planned set count settles «reps × sets» against «sets × reps».
eq(nxtRange('12×3', 3), { lo: 12, hi: 12 }, '«12×3» on a 3-set slot is twelve reps');
eq(nxtRange('3x10', 3), { lo: 10, hi: 10 }, '«3x10» on a 3-set slot is ten reps');
eq(nxtRange('4x3', 4), { lo: 3, hi: 3 }, '«4x3» on a 4-set slot is three reps');
eq(nxtRange('10x3', 4), null, '«10x3» on a 4-set slot settles nothing: no range');

// ---- nxtDayGap --------------------------------------------------------------
eq(nxtDayGap('2026-10-26', '2026-11-16'), 21, '26 October to 16 November is 21 days');
eq(nxtDayGap('2026-10-27', '2026-11-16'), 20, 'and from the 27th it is 20');
eq(nxtDayGap('2026-12-31', '2027-01-01'), 1, 'across a year');
eq(nxtDayGap('2026-03-28', '2026-03-29'), 1, 'across a clock change: days are counted in UTC');
eq(nxtDayGap('nope', '2026-11-16'), 0, 'a date that is not one counts as no gap, never as a layoff');

// ---- nxtWhy: one dictionary key per state, by literal ------------------------
const why = (nx, rangeShown) => { said.length = 0; return nxtWhy(nx, rangeShown); };
for (const state of ['up', 'stretch', 'confirm', 'rep', 'hold', 'deload', 'back', 'bw']) {
  eq(why({ state, lo: 8, hi: 12, rows: [] }, false), 'nxt_' + state, `nxtWhy says nxt_${state} for «${state}»`);
}
eq(why({ state: 'first', lo: 8, hi: 12, rows: null }, false), 'nxt_first_pick nxt_first_then', 'first time: what to pick, then what happens next');
eq(why({ state: 'first', lo: 10, hi: 10, rows: null }, false), 'nxt_first_pick_one nxt_first_then', 'first time with a single-number target');
eq(why({ state: 'first', lo: 6, hi: 8, rows: null }, true), 'nxt_first_then', 'first time where the plan block already prints the range: only what happens next');
eq(why({ state: 'first', lo: 8, hi: 12, rows: null, bare: true }, false), 'nxt_first_then', 'first time on an exercise where «sets of 8–12» would be a guess (a plank): only what happens next');
eq(why(null, false), '', 'no result, no line');
eq(why({ state: 'nonsense' }, false), '', 'an unknown state says nothing');
const REACHED = ['nxt_up', 'nxt_stretch', 'nxt_confirm', 'nxt_rep', 'nxt_hold', 'nxt_deload', 'nxt_back', 'nxt_bw', 'nxt_first_pick', 'nxt_first_pick_one', 'nxt_first_then'];

// ---- nxtReps / nxtFigure: «62.5 KG × 8», and each row's own when they differ ---
eq(nxtFigure(nextTarget([S(3, '12,12,9@60')], O()), 'kg'), '60 KG × 12 · 12 · 10', 'rows that ask for different reps are each stated — a lifter who did twelves is not told «× 10»');
eq(nxtFigure(nextTarget([S(25, '10,9,8@60')], O()), 'kg'), '60 KG × 10 · 9 · 8', 'back from a layoff: each row\'s own figure');
eq(nxtFigure(nextTarget([S(3, '12@50,10@55,8@60')], O()), 'kg'), '60 KG × 9', 'only the rows at the working weight are counted');
eq(nxtReps(nextTarget([S(3, '10,8,7@0')], O()), 'kg'), '10 · 8 · 8', 'bodyweight: the reps of each row');
eq(nxtReps(nextTarget([S(3, '10,10@0')], O({ open: true })), 'kg'), '11', 'bodyweight, every row the same: one figure');
eq(nxtReps(null, 'kg'), '', 'no result, no reps');
const hist5 = [S(3, top3), S(6, top3)];
eq(nxtFigure(nextTarget(hist5, O()), 'kg'), '62.5 KG × 8', 'the figure in kilograms');
eq(nxtFigure(nextTarget([S(3, '12,12,12@61.23'), S(6, '12,12,12@61.23')], O({ unit: 'lb' })), 'lb'), '140 LB × 8', 'the figure in pounds, on the plate');
eq(nxtFigure(nextTarget([S(3, '10,8,7@0')], O()), 'kg'), '', 'bodyweight has no weight × reps figure');
eq(nxtFigure(nextTarget([], O()), 'kg'), '', 'first time has no figure');
eq(nxtFigure(null, 'kg'), '', 'no result, no figure');

// ---- junk never throws --------------------------------------------------------
for (const junk of [null, undefined, 'x', 5, [null], [{}], [{ date: 5 }], [{ date: '2026-11-10' }], [{ date: '2026-11-10', sets: 'x' }], [{ date: '2026-11-10', sets: [null, 5, 'a', {}, { reps: 'x', weight: 'y' }, { reps: -1, weight: -1 }, { reps: 1e9, weight: 1e9 }] }]]) {
  let got;
  assert.doesNotThrow(() => { got = nextTarget(junk, O()); }, 'junk history must not throw: ' + JSON.stringify(junk));
  assert.equal(got && got.state, 'first', 'junk history reads as no history: ' + JSON.stringify(junk));
}

// ---- the properties, over a grid ------------------------------------------------
// The weight moves only in `up` and `deload`; an `up` is at most one step (plus
// half a plate of rounding), lands on the plate grid and is loadable; a deload
// is lighter and comes only after three sessions; a hold returns the stored
// kilograms untouched; no row at the working weight is asked for less than it did.
let grid = 0, cutLo = 1, cutHi = 0;
const seen = {};
for (const unit of ['kg', 'lb']) for (const legs of [false, true]) {
  const weights = unit === 'kg' ? [2.5, 5, 7.5, 10, 12.5, 15, 20, 22.5, 25, 27.5, 40, 47.5, 50, 60, 61, 100, 142.5, 200] : [5, 10, 25, 45, 50, 55, 95, 105, 110, 135, 137.5, 225, 315];
  for (const wu of weights) for (const r1 of [1, 5, 7, 8, 9, 11, 12, 13, 14, 15]) for (const r2 of [5, 7, 8, 12, 14]) for (const n of [1, 2, 3, 4]) for (const [lo, hi] of [[8, 12], [5, 5], [6, 8], [12, 15]]) {
    const kg = toStoredKg(wu, unit);
    const hist = [];
    for (let i = 0; i < n; i++) hist.push({ date: day(3 * (i + 1)), sets: [{ reps: r1, weight: kg }, { reps: r1, weight: kg }, { reps: i === 0 ? r1 : r2, weight: kg }] });
    const at = `${unit}${legs ? ' legs' : ''} ${wu} r1=${r1} r2=${r2} n=${n} ${lo}-${hi}`;
    const nx = nextTarget(hist, O({ unit, legs, lo, hi }));
    grid++;
    assert.equal(JSON.stringify(nextTarget(hist, O({ unit, legs, lo, hi }))), JSON.stringify(nx), 'the same history gives the same answer: ' + at);
    assert.ok(nx && Array.isArray(nx.rows) && nx.rows.length === 3, 'a plain history always gets its three rows: ' + at);
    seen[nx.state] = (seen[nx.state] || 0) + 1;
    const W = toDisplayWeight(kg, unit), shown = toDisplayWeight(nx.w, unit), plate = unit === 'lb' ? 5 : 2.5;
    const inc = unit === 'lb' ? (legs && W >= 110 ? 10 : 5) : (legs && W >= 50 ? 5 : 2.5);
    for (const g of nx.rows) {
      assert.ok(Number.isInteger(g.reps) && g.reps >= 1, 'every row carries a whole, positive rep target: ' + at);
      assert.ok(g.weight > 0, 'and a weight: ' + at);
    }
    if (nx.state === 'up') {
      assert.ok(n >= 2, 'a raise needs two sessions: ' + at);
      assert.ok(shown > W && shown <= W + inc + plate / 2 + 1e-9, `a raise is one step, never more (${W} → ${shown}): ` + at);
      assert.ok(Math.abs(shown / plate - Math.round(shown / plate)) < 1e-9, `a raise lands on the plate grid (${shown}): ` + at);
      const iron = PLATE_SETS[unit];
      if (shown >= iron.bars[0]) assert.equal(platesPerSide(shown, iron.bars[0], iron.plates).remainder, 0, `a raise can be loaded on the bar (${shown}): ` + at);
    } else if (nx.state === 'deload') {
      assert.ok(n >= 3, 'a deload needs three sessions: ' + at);
      assert.ok(shown < W && shown > 0, `a deload is lighter and not nothing (${W} → ${shown}): ` + at);
      const cut = 1 - shown / W; cutLo = Math.min(cutLo, cut); cutHi = Math.max(cutHi, cut);
      // Lighter is not «and now the whole range»: two reps over the best set of last time, the range's bottom at most.
      nx.rows.forEach((g) => assert.equal(g.reps, Math.min(lo, r1 + 2), `a deload asks two reps over the best set, the range's bottom at most: ` + at));
    } else {
      assert.equal(shown, W, `the weight does not move in «${nx.state}»: ` + at);
      assert.equal(nx.w, kg, `and the stored kilograms come back untouched in «${nx.state}»: ` + at);
      const own = hist[0].sets.map((x) => x.reps), weak = Math.min(...own);
      nx.rows.forEach((g, i) => assert.ok(g.reps >= own[i], `no row is asked for less than it did in «${nx.state}»: ` + at));
      // ONE REP AT A TIME: at an unchanged weight no row is asked for more than one rep over the weakest set (confirm asks for what was done).
      if (nx.state !== 'confirm') nx.rows.forEach((g, i) => assert.equal(g.reps, Math.max(own[i], weak + 1), `at an unchanged weight a row is its own figure or the weakest set + 1 in «${nx.state}»: ` + at));
      else nx.rows.forEach((g, i) => assert.equal(g.reps, own[i], 'a confirm asks every row for what it did: ' + at));
    }
  }
}
assert.ok(cutLo > 0.08 && cutHi < 0.17, `every deload on the grid is between 8% and 17% (measured ${(cutLo * 100).toFixed(1)}%–${(cutHi * 100).toFixed(1)}%), never the −50% a fixed «one plate lighter» gave at 5 kg`);
for (const state of ['up', 'confirm', 'rep', 'stretch', 'hold', 'deload']) assert.ok(seen[state] > 0, `the grid reaches «${state}»`);

// ---- the dictionary holds every key the rule can say, in both languages ---------
const dict = vm.createContext({});
vm.runInContext(read('js/i18n.js') + '\nthis.I18N = I18N;', dict);
const I18N = dict.I18N;
const CITES = ['nxt_up', 'nxt_confirm', 'nxt_stretch', 'nxt_hold', 'nxt_deload'];
for (const lang of ['en', 'ar']) {
  for (const key of [...REACHED, 'nxt_after', 'nxt_after_bw', 'sd_take_sug']) assert.ok(typeof I18N[lang][key] === 'string' && I18N[lang][key].trim(), `${lang}.${key} exists`);
  const holds = { nxt_first_pick: ['{lo}', '{hi}'], nxt_first_pick_one: ['{lo}'], nxt_after: ['{f}'], nxt_after_bw: ['{r}'] };
  for (const key of CITES) holds[key] = ['{range}'];
  for (const key of Object.keys(I18N[lang]).filter((k) => k.startsWith('nxt_'))) {
    const want = holds[key] || [];
    const got = I18N[lang][key].match(/\{[a-z]+\}/g) || [];
    eq(got.slice().sort(), want.slice().sort(), `${lang}.${key} carries exactly its placeholders ${JSON.stringify(want)} — a reason line prints no set figure (that is the ghost beside it)`);
  }
  // A line that speaks of «the range» cites it as the exact group « ({range})» that nxtWhy fills or removes.
  for (const key of CITES) assert.ok(I18N[lang][key].split(' ({range})').length === 2, `${lang}.${key} cites the range as « ({range})», once`);
  // …and with the REAL words: the range is printed where the screen does not show it, and gone where it does.
  const real = vm.createContext({ t: (k) => I18N[lang][k] });
  vm.runInContext(code + '\n', real);
  const say = (nx, shown) => vm.runInContext('(nx, shown) => nxtWhy(nx, shown)', real)(nx, shown);
  for (const key of CITES) {
    const state = key.slice(4);
    const open = say({ state, lo: 8, hi: 12, rows: [] }, false), shown = say({ state, lo: 8, hi: 12, rows: [] }, true), one = say({ state, lo: 5, hi: 5, rows: [] }, false);
    assert.ok(open.includes('(\u20668–12\u2069)'), `${lang}: «${state}» cites the range, isolated left-to-right: ${JSON.stringify(open)}`);
    assert.ok(one.includes('(\u20665\u2069)'), `${lang}: «${state}» cites a single-number range as one figure: ${JSON.stringify(one)}`);
    assert.ok(!/[{}()\u2066\u2069]/.test(shown) && !shown.includes('  '), `${lang}: «${state}» with the range on screen prints no citation and no stray gap: ${JSON.stringify(shown)}`);
    assert.equal(open.replace(' (\u20668–12\u2069)', ''), shown, `${lang}: «${state}» is the same sentence with and without the citation`);
  }
  assert.ok(!/weight|وزن/.test(say({ state: 'first', lo: 8, hi: 12, rows: null }, false)), `${lang}: the first-time line names no weight — it is also said of a push-up`);
}

console.log(`PASS next target: ${CASES.length} histories to their next target (first time, +1 rep on the weakest set, confirm, up, a big jump stretched, hold, deload, back from a layoff, bodyweight, a scheme of its own, pounds on the plate, noise), ${RANGES.reduce((n, r) => n + r[0].length, 0)} rep targets read or refused, ${grid} grid cases (one step up at most, on the plate and loadable; deloads ${(cutLo * 100).toFixed(1)}%–${(cutHi * 100).toFixed(1)}%; a hold returns the stored kilograms; no row asked for less than it did), and every line the rule can say in both dictionaries`);
