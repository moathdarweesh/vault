// The views, and the viewContext each one needs to render something real.
//
// ⚠️ A VIEW THAT IS NOT IN THIS LIST IS OUTSIDE THE NET, and "the net is green"
// then becomes true and meaningless. That is the exact blind spot CLAUDE.md
// records three separate times for test-convenience-ui.js — a suite driving a
// control that had been deleted, and nobody told because nothing compared the
// list against reality. Contract 75 compares this file against the
// <section data-view> list in index.html, so the next view someone adds either
// joins the net or fails the commit. (This line named «contract 32» from v355
// to 2026-09-27, and no contract read this file: 32 is the APK fingerprint.)
//
// ⚠️ SIX VIEWS ARE CAPTURED IN THEIR FALLBACK STATE, AND THAT IS STATED HERE
// RATHER THAN IMPLIED. This file used to say the `ctx` values were "resolved at
// capture time from the seeded fixture". Nothing read them: the matrix is the
// EMPTY state and navigates with `{}`, so exercise-detail rendered its
// not-found stub — 4 elements against home's 121 — and every refactor step was
// certified against that. The `ctx` field is gone; the six are listed below
// with what they show, and the seeded-data lane that would give them real
// content is stage 4. The sheets lane (fp/modals.js) DOES run over a fixture,
// so the food and workout paths those views wrap are not unwatched.
'use strict';

module.exports = [
  { view: 'home' },
  { view: 'workouts' },                                   // the Program tab (id kept from v197)
  { view: 'exercises' },
  { view: 'exercise-detail' },      // fallback: no exercise in context
  { view: 'cardio' },
  { view: 'food' },
  { view: 'sleep' },
  { view: 'compare' },
  { view: 'settings' },
  { view: 'planner' },
  { view: 'calendar' },
  { view: 'supplements' },
  { view: 'notifications' },
  { view: 'foodlog' },              // today, with no rows and NO TARGETS in the empty state: the four .macro-totals tiles, never the miniature ring (read back from a v405 record); a closed day's miniature is covered by scripts/test-food-log-ui.js
  { view: 'sleeplog' },             // today, empty: the day arrows, the empty state and the add; a night's ring, rows and a closed night are covered by scripts/test-cardio-sleep-ui.js
  { view: 'cardiolog' },            // today, empty: the day arrows, the empty state and the add; the day card, rows and scheduled ticks are covered by scripts/test-cardio-sleep-ui.js
  { view: 'day' },                  // ditto
  { view: 'session-day' },          // ditto
  { view: 'session-run' },          // fallback: no run in context
  { view: 'personal-records' },
  { view: 'muscle-sessions' },      // fallback: no muscle in context
  { view: 'custom-exercises' },
];
