// THE THIRTEEN SHIPPED SCRIPTS, IN DEPENDENCY ORDER — spelled once.
//
// They are classic <script defer> files sharing one global lexical scope, so
// the ORDER is the dependency graph and contract 1 proves it against
// index.html. Two tools need the same list and the same top-level-declaration
// regex — scripts/check-contracts.js (contracts 1 and 34) and eslint.config.js
// (the derived global surface) — and each used to carry its own copy, under a
// comment saying a hand-written list "would be a second spelling of the
// source". An eleventh script added to one and not the other would silently
// stop being linted, or stop being contracted, with nothing to say so.
'use strict';

const JS = [
  'js/i18n.js', 'js/catalog.js', 'js/cloud.js', 'js/storage.js', 'js/motion.js',
  'js/ui.js', 'js/body.js', 'js/food.js', 'js/app.js', 'js/health.js', 'js/notify.js',
  'js/foodai.js', 'js/update.js',
];

// THE SCRIPTS THAT RENDER, spelled POSITIVELY and on purpose.
//
// Contract 26 used to derive this by SUBTRACTION — JS minus a hand-listed six
// — which has the failure mode backwards: a script added to JS and forgotten
// here silently joins the view layer and gets rules written for views applied
// to it, with nothing to say so. A positive list fails the other way, which is
// the way that is loud: contract 39 refuses a name in VIEWS that is not in JS.
const VIEWS = ['js/ui.js', 'js/body.js', 'js/food.js', 'js/app.js'];

// The scripts that load BEFORE the four late modules. Contract 26 asks whether
// any of them reaches a module that has not run yet, so the set is derived from
// the ORDER rather than listed: a script inserted anywhere above health.js
// joins the scan by existing, not by being remembered.
const MODULES = ['js/health.js', 'js/notify.js', 'js/foodai.js', 'js/update.js'];
const EARLY = JS.slice(0, JS.indexOf(MODULES[0]));

// A declaration at column 0 — the shared lexical scope. Used to derive the
// cross-file global surface (eslint) and to refuse the same name in two files
// (contract 34: a SyntaxError that blanks the app).
const TOP_LEVEL = /^(?:async\s+)?(?:function\s+\*?|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/;

module.exports = { JS, VIEWS, MODULES, EARLY, TOP_LEVEL };
