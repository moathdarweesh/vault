// THE TEN SHIPPED SCRIPTS, IN DEPENDENCY ORDER — spelled once.
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
  'js/app.js', 'js/health.js', 'js/notify.js', 'js/foodai.js', 'js/update.js',
];

// A declaration at column 0 — the shared lexical scope. Used to derive the
// cross-file global surface (eslint) and to refuse the same name in two files
// (contract 34: a SyntaxError that blanks the app).
const TOP_LEVEL = /^(?:async\s+)?(?:function\s+\*?|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/;

module.exports = { JS, TOP_LEVEL };
