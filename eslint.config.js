// THE VAULT — the linter, and it is not here for style.
//
// This project has NO BUILD STEP. Nothing type-checks, nothing compiles, and a
// misspelled identifier in a vanilla-JS file is a ReferenceError that reaches a
// phone. `no-undef` alone is worth the whole file.
//
// ⚠️ ESLINT IS A DEV TOOL AND NEVER SHIPS. It is deliberately NOT in
// package.json — the same decision the project already made for Playwright:
// installed with `npm i --no-save playwright eslint@9 globals` (one command —
// a --no-save install prunes whatever the manifest does not list, so a second
// one removes the first; and eslint@9 is pinned because 10 dropped `globals`
// as a transitive package and this file had leaned on it undeclared), so it
// never enters the dependency tree, never lands in a lockfile, and cannot reach
// the bundle a user downloads.
// `node scripts/lint.js` reports loudly when it is absent, and `--strict` (what
// CI runs) makes an absent linter a FAILURE rather than a silent pass — the shape
// this project has been burned by three times.
//
// THE FIVE CUSTOM RULES BELOW ARE THE POINT. Each one encodes a defect this
// codebase actually shipped, named in CLAUDE.md, that no generic rule catches.
// The first run of this file found a duplicate i18n key in both dictionaries,
// a dead prompt mirror, two dead locals, and taught two of the rules what a
// false positive looks like — those refinements are recorded on the rules.

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const globals = require('globals');

// ---------------------------------------------------------------------------
// The cross-file global surface, DERIVED — never hand-listed.
//
// The ten shipped scripts are classic <script defer> files. A top-level `const`
// in one is NOT on `window`, but it IS in the global lexical scope, so every
// later script can read it (that is exactly how app.js reaches I18N and ICONS).
// A hand-written list of those names would be a second spelling of the source
// and would drift the first time someone adds one — which is the failure mode
// this project has a whole contract system to prevent. So it is read from the
// files themselves at lint time. Contract 34 is the other half: it refuses the
// same name declared at top level in TWO of these files, which is a SyntaxError
// that blanks the app.
// ---------------------------------------------------------------------------
const ROOT = __dirname;
const SHIPPED = [
  'js/i18n.js', 'js/catalog.js', 'js/cloud.js', 'js/storage.js', 'js/motion.js',
  'js/app.js', 'js/health.js', 'js/notify.js', 'js/foodai.js', 'js/update.js',
];
const TOP_LEVEL = /^(?:async\s+)?(?:function\s+\*?|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/;
const shared = {};
for (const rel of SHIPPED) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line[0] === ' ' || line[0] === '\t') continue;   // top level only, column 0
    const m = TOP_LEVEL.exec(line);
    if (m) shared[m[1]] = 'readonly';
  }
}
// Set on window rather than declared, so the scan above cannot see them.
for (const n of ['VAULT_KEYS', 'Cloud', 'DB', 'VltMotion', 'Health', 'Notify', 'FoodAI', 'VaultUpdate', 'I18N']) shared[n] = 'readonly';

// ---------------------------------------------------------------------------
// The project's own rules. Every one of these is a defect that shipped.
// ---------------------------------------------------------------------------
const vault = {
  rules: {

    // v348: `$('#change-pw-btn').addEventListener('click', showChangePassword)`
    // passed the function BARE, so the click Event arrived as its `recovery`
    // argument and was truthy. Change-password was dead on BOTH paths for
    // months. Two handlers 160 lines above already used arrow wrappers.
    //
    // REFINED after the first run: a handler whose first parameter IS the event
    // (`end(e)`, `release(e)`, `down(e)`) is the ordinary, correct case and was
    // flagged seven times. The defect is a first parameter that is NOT the
    // event — `recovery`, a flag, an id — which the Event then satisfies.
    'no-bare-handler-with-params': {
      meta: { type: 'problem', schema: [], messages: {
        bare: "`{{name}}` takes `{{first}}` as its first argument, so binding it bare hands it the click Event there — the v348 change-password defect. Wrap it: `() => {{name}}()`.",
      } },
      create(context) {
        const firstParam = new Map();
        const record = (id, params) => {
          if (!id || !id.name) return;
          const p = params[0];
          firstParam.set(id.name, !p ? '' : p.type === 'Identifier' ? p.name
            : p.type === 'AssignmentPattern' && p.left.type === 'Identifier' ? p.left.name : '?');
        };
        return {
          FunctionDeclaration: (n) => record(n.id, n.params),
          VariableDeclarator: (n) => {
            if (n.init && (n.init.type === 'ArrowFunctionExpression' || n.init.type === 'FunctionExpression')) record(n.id, n.init.params);
          },
          'CallExpression:exit'(node) {
            const c = node.callee;
            if (c.type !== 'MemberExpression' || c.property.name !== 'addEventListener') return;
            const handler = node.arguments[1];
            if (!handler || handler.type !== 'Identifier') return;
            const first = firstParam.get(handler.name);
            if (first && !/^(_?e|_?ev|_?evt|_?event|_)$/.test(first)) {
              context.report({ node: handler, messageId: 'bare', data: { name: handler.name, first } });
            }
          },
        };
      },
    },

    // The bug class this codebase has hit FIVE times. `toISOString()` is UTC, so
    // it returns YESTERDAY for every UTC+ user after ~21:00 — and Moath is UTC+3.
    // Calendar days come from todayISO() / addDaysISO(), never from here. The
    // two sanctioned sites (todayISO itself, which shifts the clock first, and
    // the validDay round-trip) carry an eslint-disable with the reason.
    'no-utc-calendar-day': {
      meta: { type: 'problem', schema: [], messages: {
        utc: 'toISOString() is UTC: this returns the PREVIOUS day for every UTC+ user after ~21:00. Use todayISO() / addDaysISO() for a calendar day.',
      } },
      create(context) {
        const src = context.sourceCode || context.getSourceCode();
        return {
          CallExpression(node) {
            const c = node.callee;
            if (c.type !== 'MemberExpression' || c.property.name !== 'toISOString') return;
            // Only the DAY-slicing forms. A full ISO timestamp is legitimate and
            // is used all over this app for `createdAt`.
            const after = src.getText(node.parent && node.parent.parent ? node.parent.parent : node.parent) || '';
            if (/\.slice\(\s*0\s*,\s*10\s*\)|\.substring\(\s*0\s*,\s*10\s*\)|\.split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]/.test(after)) {
              context.report({ node, messageId: 'utc' });
            }
          },
        };
      },
    },

    // `new Date('2026-08-04')` parses as UTC and yields the previous day in
    // UTC+. `_dateOf()` in storage.js and `forDate` in the cardio plan both use
    // the NUMERIC constructor for exactly this reason.
    'no-date-string-parse': {
      meta: { type: 'problem', schema: [], messages: {
        parse: "new Date(<string>) parses a bare YYYY-MM-DD as UTC — the previous day for every UTC+ user. Build it with the numeric constructor: new Date(y, m - 1, d).",
      } },
      create(context) {
        return {
          NewExpression(node) {
            if (node.callee.name !== 'Date' || node.arguments.length !== 1) return;
            const a = node.arguments[0];
            const isDayish = (a.type === 'Literal' && typeof a.value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a.value))
              || a.type === 'TemplateLiteral';
            if (isDayish) context.report({ node, messageId: 'parse' });
          },
        };
      },
    },

    // CLAUDE.md, a non-negotiable: "Read/write data only through DB.* — never
    // touch localStorage directly from view code." Contract 8 catches an
    // unregistered KEY SPELLING; this catches the access itself, which is what
    // put two spellings of the corrupt-blob key in two files (v300). The four
    // per-DEVICE flags in app.js (announcement dismissal, the unit seed) are
    // reviewed exceptions and each carries its reason on the line.
    'no-direct-storage-in-views': {
      meta: { type: 'problem', schema: [], messages: {
        direct: 'View code reads and writes through DB.* only — never localStorage directly (CLAUDE.md, non-negotiable). Add an accessor to js/storage.js instead.',
      } },
      create(context) {
        return {
          MemberExpression(node) {
            if (node.object.type === 'Identifier' && (node.object.name === 'localStorage' || node.object.name === 'sessionStorage')) {
              context.report({ node, messageId: 'direct' });
            }
          },
        };
      },
    },

    // v324, a shipped blocker: `bindVaultAction` asked for "the ACTIVE view"
    // while rendering a DIFFERENT one, and v318's deferred render made those two
    // stop being the same thing — Home's handler landed on Program's button.
    // Anything inside a render takes the element it is rendering.
    //
    // The SHELL is allowed to address the active view — that is its job — so the
    // rule takes an allow-list BY FUNCTION NAME (stable across line drift). Every
    // name in it was read and confirmed to run outside any render's scope. A new
    // site anywhere else is an error until it is read and added.
    'no-active-view-query': {
      meta: { type: 'problem', schema: [{ type: 'object', properties: { allowIn: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }], messages: {
        active: "Querying '.view.active' from inside a render is only correct while every render is synchronous, and this app has shipped a deferred one (v324). Take the element being rendered instead — or, if this is shell code, read it and add its function name to allowIn.",
      } },
      create(context) {
        const allow = new Set(((context.options && context.options[0]) || {}).allowIn || []);
        const enclosing = (node) => {
          for (let p = node.parent; p; p = p.parent) {
            if (p.type === 'FunctionDeclaration' && p.id) return p.id.name;
            if (p.type === 'FunctionExpression' && p.id) return p.id.name;   // a NAMED IIFE, e.g. (function wireDetailTopAutoHide() {…})()
            if ((p.type === 'FunctionExpression' || p.type === 'ArrowFunctionExpression') && p.parent
                && p.parent.type === 'VariableDeclarator' && p.parent.id.type === 'Identifier') return p.parent.id.name;
          }
          return '';
        };
        return {
          Literal(node) {
            if (typeof node.value === 'string' && /\.view\.active/.test(node.value) && !allow.has(enclosing(node))) {
              context.report({ node, messageId: 'active' });
            }
          },
        };
      },
    },
  },
};

const PROJECT_RULES = {
  'vault/no-bare-handler-with-params': 'error',
  'vault/no-utc-calendar-day': 'error',
  'vault/no-date-string-parse': 'error',
  'vault/no-active-view-query': ['error', { allowIn: ['bindVaultAction', 'navigate', 'syncDetailTopTitle', 'wireDetailTopAutoHide', 'setupBarAutoHide', 'ensureRestBar'] }],
};

// `vars: 'local'` — a TOP-LEVEL declaration is cross-file by design here (I18N,
// ICONS, FOOD_PRESETS are read by later scripts); only a local can be dead.
// `ignoreRestSiblings` — `const { planId, ...rest } = c` omits a key on purpose.
const UNUSED = ['error', { vars: 'local', args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }];

const CORRECTNESS = {
  'no-undef': 'error',
  'no-unused-vars': UNUSED,
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-redeclare': ['error', { builtinGlobals: false }],   // the shared surface above IS this file's own declarations
  'no-const-assign': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-sparse-arrays': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-async-promise-executor': 'error',
};

module.exports = [
  { ignores: ['node_modules/**', 'www/**', 'android/**', 'ios/**', 'graphify-out/**', 'graphify-out.bak/**', 'js/vendor/**', 'download/**', 'docs/**', '.fpnet/**'] },

  // ── the ten shipped scripts ───────────────────────────────────────────────
  {
    files: ['js/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',          // classic <script defer>, NOT modules
      globals: { ...globals.browser, ...shared, Capacitor: 'readonly', ZXing: 'readonly', supabase: 'readonly', turnstile: 'readonly', BarcodeDetector: 'readonly' },
    },
    plugins: { vault },
    rules: { ...CORRECTNESS, ...PROJECT_RULES },
  },

  // js/app.js is the view layer, and the DB.* law is written for exactly it.
  {
    files: ['js/app.js'],
    plugins: { vault },
    rules: { 'vault/no-direct-storage-in-views': 'error' },
  },

  // ── the tooling: Node, and it never ships. The browser suites pass whole
  //    functions into page.evaluate(), so those files genuinely contain browser
  //    code too — both global sets, plus the app's shared surface.
  {
    files: ['scripts/**/*.js', 'dev-server.js', 'eslint.config.js'],
    // qa* and homeReady are PAGE globals the browser suites' harness injects
    // (fp/server.js stubs; test-startup's probe) and then read back inside
    // page.evaluate() — real in the page, invisible to a per-file linter.
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser, ...shared, qaCloud: 'writable', qaSession: 'writable', qaBeforeLogs: 'writable', homeReady: 'writable' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': UNUSED,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-dupe-keys': 'error',
    },
  },

  // ── the Cloudflare Worker: a service-worker runtime, no DOM ───────────────
  {
    files: ['backend/worker/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.worker } },
    rules: { ...CORRECTNESS },
  },
];
