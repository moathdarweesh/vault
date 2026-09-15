// The twenty views, and the viewContext each one needs to render something real.
//
// ⚠️ A VIEW THAT IS NOT IN THIS LIST IS OUTSIDE THE NET, and "the net is green"
// then becomes true and meaningless. That is the exact blind spot CLAUDE.md
// records three separate times for test-convenience-ui.js — a suite driving a
// control that had been deleted, and nobody told because nothing compared the
// list against reality. Contract 32 compares this file against the
// <section data-view> list in index.html, so the next view someone adds either
// joins the net or fails the commit.
//
// The context values are resolved AT CAPTURE TIME from the seeded fixture (the
// ids are not stable literals) — each entry names the slice to take one from.
'use strict';

module.exports = [
  { view: 'home' },
  { view: 'workouts' },                                   // the Program tab (id kept from v197)
  { view: 'exercises' },
  { view: 'exercise-detail', ctx: { from: 'exerciseId' } },
  { view: 'cardio' },
  { view: 'food' },
  { view: 'sleep' },
  { view: 'compare' },
  { view: 'settings' },
  { view: 'planner' },
  { view: 'calendar' },
  { view: 'supplements' },
  { view: 'notifications' },
  { view: 'foodlog', ctx: { from: 'foodLogDate' } },
  { view: 'day', ctx: { from: 'dayIso' } },
  { view: 'session-day', ctx: { from: 'sessionDate' } },
  { view: 'session-run', ctx: { from: 'runDate' } },
  { view: 'personal-records' },
  { view: 'muscle-sessions', ctx: { from: 'muscle' } },
  { view: 'custom-exercises' },
];
