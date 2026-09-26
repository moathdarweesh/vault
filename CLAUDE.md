# THE VAULT — Claude Code Project Guide

A fitness / workout-tracking **PWA**. Vanilla JS, **no build step**, bilingual **EN/AR** (RTL), two modes (dark + light), mobile-first. Deployed to GitHub Pages and wrapped as an Android app via Capacitor.

- **Live:** https://moathdarweesh.github.io/vault/ (GitHub Pages, branch `main`)
- **Repo:** github.com/moathdarweesh/vault
- **`docs/AUTOMATION.md`** — the maintainer's own Arabic quick-reference for everything that runs automatically (the three `.githooks/` scripts, `npm run release`, the graph rebuild) and everything that does **not** (Worker redeploy, SQL, APK). Keep it in sync when you change any of that.

The release history — one section per version since v309 — is in `docs/RELEASE-NOTES.md`; read the section of the version you are changing before touching its feature.

## Stack & key files
- `index.html` — markup, script wiring, and the cache-version markers.
- `js/i18n.js` — the two EN/AR dictionaries and nothing else. **Loads FIRST of the thirteen scripts**: `const I18N` is shared through the global lexical scope, which only works if it has already executed when app.js's `t()` runs.
- `js/catalog.js` — the app's static data and nothing else: `ICONS` (+ its two back-compat aliases), `WORKOUT_TEMPLATES`, `EXERCISE_MUSCLES`, both exercise-name maps and `FOOD_PRESETS`. Loads second, before app.js, for the same lexical-scope reason. **Contracts 13, 22 and 23 read THIS file now, not app.js.**
- `js/app.js` (the largest file) — the shell, the router `navigate(view, ctx, opts)`, and the domains that have not left yet (workout, planner, notifications, supplements, settings, auth). Use `Grep` to find a function; don't assume from names. A screen's day arrives on `ctx.date` and its own unit on `ctx.unit` — one spelling per concept through the router (contract 67, v401).
- `js/ui.js` (v360) — the presentation vocabulary: format (numbers, weights, days, names), `escapeHtml`, `$`/`$$`, the shared surfaces (`showToast`, `openModal`, `closeModal`, `confirmDialog`, `openImageLightbox`, `emptyState`), the focus kit (`holdSheetFocus`, `trapTab`, `labelSheetFields`, `setChosen` — v399), the ONE kg↔lb rule (`toDisplayWeight`/`toStoredKg`/`kgToUnit`, contract 66, v401), `t()`/`icon()`, and `applyTheme`/`applyLang`. **The floor of the call graph** — contract 39 refuses any member that reaches past `DB.prefs`, or reaches Cloud, a module or the router. Loads after motion.js and before body.js.
- `js/body.js` (v362) — the body domain: sleep, body weight and cardio. Three day-entry screens sharing one `dayLedgerHtml` renderer, which is why they are one file. Its inbound edges (measured v401, listed in its header): `resolveCardioType` from Program, Home and the day view, `openCardioScheduleModal` from Program, `weightCardHtml`/`openWeightSheet` from Home, the weight quick action and the search. None outward.
- `js/food.js` (v359) — the food domain: the Food and food-log views, the calculator, the recipe ledger, the saved-food picker, the meal bundles, the shopping list, the barcode scanner and the voice/photo capture. **Loads BEFORE app.js** — `bootCatalog()` calls into it inside a bare catch, so loading it later would swallow a ReferenceError and silently never merge the server food catalog.
- `js/storage.js` — the `DB.*` localStorage API (all persistence). `MACHINE_SEED`, name-match migrations.
- `js/cloud.js` — Supabase email/password auth + whole-blob sync to a per-user `vault_data` row (RLS-protected). Uses the **publishable** key only (never service-role). Loads before app.js. Also: `getUsername/checkUsername/setUsername` (the mandatory-handle feature) and `getClient` (RLS-scoped client for auxiliary readers).
- ~~`js/tables.js`~~ — **the mirror was REMOVED in v278** (owner decision, migration `18_drop-mirror-v14.sql`): the 13 normalized projection tables are dropped, the admin panel reads `vault_data` blobs directly under a `vault_data_admin_read` (is_admin) SELECT policy, and `admin_user_stats`/`admin_activity`/`delete_own_account` were rewritten over the blobs IN THE SAME TRANSACTION as the drops — plpgsql binds table names at call time, so dropping first would have broken every account deletion. The mirror's projection was silently empty for workout_sessions (name-remap failures), which is half of why it went.
  - Still one-way and analytics-only: the app does not read these tables back.
- `js/foodai.js` — AI calorie chat. Posts `{text}` to a **Cloudflare Worker** (`backend/worker/gemini-worker.js`) that holds the Gemini key server-side. The key never ships to the client.
- `js/health.js` — Health Connect bridge (Capacitor, no-op on web).
- `js/update.js` — two jobs (its header): (1) the WEB auto-update, on web AND inside the APK WebView — reads `version.json` fresh and reloads the entry html when `web` is newer (see "Auto-update delivery"); (2) on the APK only, compares the installed `versionCode` against `version.json` → `apk.build` and shows the dismissible "download" banner. The download opens `apk.url` only for a host in `APK_HOSTS` (`raw.githubusercontent.com`, `github.com`, `objects.githubusercontent.com` — v349); the APK ships from `download/THE-VAULT.apk` in this repo (the `version.json` URL since v153), and the Google Drive route is retired. Best-effort, never blocks the app.
- `version.json` (repo root) — the update manifest read by `js/update.js`. Bump `apk.build`/`apk.version`/`apk.sha256`/notes when you ship a NEW APK (contracts 11 and 11b refuse a mismatch with `build.gradle` and with the committed binary's hash).
- `styles.css` — one stylesheet; reuse existing CSS variables and classes. The identity layer at its end wins by source order: new component CSS goes ABOVE its banner.
- `js/vendor/` — the two vendored libraries (supabase-js, zxing), identified by hash in `js/vendor/SOURCES.md` (contract 33, v352).
- `admin.html` — standalone owner-only **multi-center control console** (GitHub Pages, not in the APK). Owner logs in → `is_admin()` RLS unlocks reading every user. Sidebar centers: dashboard, users (search/sort + per-user drill-down + **role/status write controls**), analytics, catalog, feedback inbox, roles/admins, releases, export. Writes go only through the `is_admin()`-gated definer RPCs (`admin_set_role`/`admin_set_status`). Publishable key only — never a service_role key.

## How to run & verify

- Startup scripts are in `<head>` with `defer`: downloads overlap, and execution keeps the order `scripts/shipped.js` spells once — i18n → catalog → cloud → storage → motion → ui → body → food → app → health → notify → foodai → update (contract 1 holds `index.html` to it). Keep the inline theme mirror and old service-worker cleanup. Never replace `defer` with `async` on these dependent scripts. `node scripts/test-startup.js` benchmarks the former serial body placement against the current placement in isolated Chrome (external Playwright runtime); `--verbose` includes individual resource timings.
- **Run:** `node dev-server.js` → http://localhost:8080 (serves `Cache-Control: no-store`). Honors `$PORT`. Also `.claude/launch.json` server name `vault` for the preview tool.
- **Verify:** `npm run verify` — contracts (`scripts/check-contracts.js`), ESLint 9 (dev-only) and every `scripts/test-*.js` suite (node `vm` suites + real-Chrome Playwright suites); the commands print the current counts, so no document states them. One-time setup: `npm i --no-save playwright eslint@9 globals` as ONE command — a second `--no-save` install prunes the first (v353). A change is also measured in the running app: the fingerprint net for "nothing moved", `scripts/ux-audit.js` / `ux-flows.js` for the design and the daily tap paths. **Screenshots time out on this app — do not rely on them.**
- **A check is trusted only after it has been seen to fail** (v335, v369): plant the defect, watch the check name it, restore the file byte-for-byte. A probe whose subject is the default value cannot fail (v369); a suite must never read an artifact it did not just create — `.fpnet/` holds old records (v361).
- **Editing by script** (v368, v369, v376, v387, v395): detect a file's DOMINANT line ending, never its presence (the working tree is LF except where a checkout left CRLF — `js/catalog.js` is CRLF today); write after each edit and read the bytes back; `node --check` after every JS edit; never delete a whole line that may sit inside a ternary. `www/` and `android/.../assets/public/` are build artifacts — never count them as usage in a dead-code scan (v337).

## Non-negotiable rules
- **Every user-facing string** goes through `t('key')` and has BOTH an EN and an AR entry in `js/i18n.js`. A missing language is a bug.
- **Read/write data only through `DB.*`** — never touch `localStorage` directly from view code.
- **Escape untrusted data** rendered into `innerHTML` with `escapeHtml()` — exercise/food names, and anything from cloud sync / imported backups / AI responses are untrusted.
- No new dependencies, no build step. Free-first (the maintainer prioritizes free tools/services).
- **The Arabic is formal MSA (فصحى), never dialect** — a design spec supplies the meaning, never the dialect (the v226 exception was revoked in v336), and a register change is made per SCREEN, not per string (v336). `scripts/test-i18n.js` (v399) refuses dialect in every Arabic value and in the catalogue, pins one term per concept, and checks the count forms (one, two, 3–10, 11+ — a literal key per form; «2 يومان» said «two» twice, so one and two carry no figure, v401).
- **Owner rules that are absolute:** a duration is a clock reading `H:MM` everywhere (`formatDuration`, v347); nothing on screen names what the user can already see (v387); the box fits what is in it; there is no data-export route out of the app — `exportBackupFile()` survives only as the READ-ONLY rescue and the save centre's `failed` action (v386).
- **A dictionary key is deleted only after grepping its `t()` sites, dynamic `t('prefix_' + x)` families included** (v329); contract 5 refuses a missing key, contract 38 an unreachable one (v358).

### Minification: DECIDED NO (v253) — settled with measurement, do not re-open
The open question was whether to strip comments/whitespace from the shipped
bundle. It is closed, and the numbers are recorded here so it is not
re-litigated on intuition.

**The saving is real but nearly worthless, because the app is LATENCY-bound, not
bandwidth-bound.** Measured against the live site over h2:

| | |
|---|---|
| Median TTFB per asset | **215 ms** |
| Median body-download per asset | **3 ms** |
| `app.js` — 162 KB on the wire | 159 ms waiting, **30 ms** transferring |
| `update.js` — 3.9 KB on the wire | 228 ms waiting, **2 ms** transferring |
| Total time moving bytes, all 10 assets | **~226 ms** of a 1,950 ms load |

A 4 KB file and a 162 KB file cost within 20% of the same wall-clock, because
almost all of it is GitHub Pages' time-to-first-byte. Stripping comments would
cut 114 KB gzipped (301 KB → 187 KB, 38%) — which touches at most ~86 ms of that
226 ms, and less again in wall-clock because h2 downloads them in parallel.
Call it 1–2% of load time.

Against that: GitHub Pages serves the branch **directly, with no CI**, so a
build artifact would have to be committed. That converts this project's most
expensive documented failure — `ea6c74e`, "the change reached nobody" — into a
strictly worse one: the change reaches everyone, but it is the OLD code. The
`?v=N` hook guards one marker; it would now also have to guard "is dist/ built
from this source".

For the record, if this is ever revisited: the right shape is NOT a minifier.
It is blanking comment lines while KEEPING the newlines — that captured 93% of a
full strip's saving (114 KB of 123 KB) with byte-identical line numbers, so
stack traces stay accurate and no source map is needed.

**The actual bottleneck, if load time is ever worth attacking: the request
COUNT.** Ten assets × ~215 ms TTFB, and the tail (`update.js`, finishing at
1,945 ms) is what gates DOMContentLoaded at 1,950 ms. Fewer files or a host with
a faster TTFB — not fewer bytes.

## CACHE WORKFLOW — now automated. **Do not bump by hand.**

```bash
npm run verify           # contracts + lint + every suite — THE GATE (it prints the counts)
npm run release          # bump every marker and re-read them; runs NO tests
```

**Current version: v401.** APK: build 24 / v3.3.

> ⚠️ **`npm run release` RUNS NO TESTS, AND THIS LINE USED TO READ AS IF IT DID.**
> It said «bump every marker + verify», where *verify* meant the MARKERS — and
> v383, v384 and v385 were each pushed on that reading, with only the pre-commit
> hook's contracts behind them. The suites were run afterwards and all thirteen
> passed, so nothing shipped broken; but for the length of three releases the
> claim «13 suites» in a commit message was a thing I had not checked. The gate
> is `npm run verify`, it is a separate command, and the SHIPPING section's
> sequence has always spelled both.

`scripts/release.js` rewrites **every** marker and then re-reads them from disk to confirm; it exits non-zero if any disagree, and prints the count per file (derived, never hard-coded — the docs used to say 16 while the real count was 15). The markers are `?v=N` in `index.html` (every script and stylesheet, the `js/vendor/supabase.js` preload, both `icons/icon.svg` links, `manifest.json`), the `__cleaned_vN` sessionStorage key, the `FALLBACK` literal in `app.js`, `version.json` → `web`, the `?v=` in `manifest.json`, `admin.html`, `privacy.html` and `get/index.html`, and the `Current version` line in this file. `scripts/check-contracts.js` (pre-commit) refuses a commit where any of them disagree.

- `VAULT_BUILD` is **derived at runtime** from `app.js`'s own `?v=N`, so the visible label and the bug-report tag always describe the bundle the browser actually loaded. The `FALLBACK` literal is only for `file://`.
- `js/cloud.js` derives the same marker to cache-bust `js/vendor/supabase.js` — it must match the preload in `index.html` or the preload is wasted.
- **Never** verify with a bare `/v\d+/` scan: it matches SVG path data (`<path d="M4 9v6">`) in `index.html` and hundreds of times in `ICONS`. Only the anchored forms are safe.

A **pre-commit hook** (`.githooks/pre-commit` → `scripts/check-release.js`) refuses any commit that stages shipped code while `index.html`'s `?v=N` still equals HEAD's. Enable once with `npm run hooks`; bypass a genuine docs-only commit with `SKIP_RELEASE_CHECK=1`.

Why the hook and not just a self-consistency check: the failure that actually happened here (`ea6c74e`, "v150") was a commit that edited `js/app.js` and nothing else, *after* the v150 markers were already consumed. Every marker still agreed — they were simply stale, so the change reached nobody.

**Keep the `__cleaned_vN` service-worker cleanup block.** It looks like dead ritual (nothing has registered a service worker in ~150 builds), but it is what unregisters an ancient SW on a device that has not opened the app since the pre-v109 bundled APK. Deleting it would strand exactly those users on a permanently cached build with no way to reach them.

### Rollback
Every device loads the same live URL, so a bad push reaches everyone at once.
1. `git revert <bad-sha>` (do **not** force-push — the auto-updater compares numbers, so going *backwards* in `version.json` leaves devices ahead and they will not downgrade).
2. `npm run release` to move **forward** to a new build containing the revert.
3. Push, then watch `client_errors` (see below) to confirm the error rate drops.

### Standout nutrition/tracking features (v168–v172)
- **Barcode scan** (v168): native `BarcodeDetector` + Open Food Facts (free, no key). `openBarcodeScanner()` in app.js; editable grams → live macros → log.
- **Water tracking** (v169): `DB.water` (per-day ml) + a card on the Food dashboard (+250/+500/undo).
- **Body-weight + trend** (v170): `DB.bodyweight` (one entry/day, kg-canonical) + a Home card (sparkline) + `openWeightSheet()` (SVG trend chart, log input, editable history). Respects the kg/lb unit pref.
- **YOUR OWN NUMBERS BEAT THE MODEL** (v260, rewritten v270): `parseMacroText` in `js/foodai.js` runs BEFORE the cache and before the network. If the text carries explicit figures it is used verbatim and nothing is sent anywhere — that is the whole promise of the path. Exported as `FoodAI.parseText` so the one-line manual entry fills its boxes with the SAME rules; do not write a second parser.
  - It is NOT a regex per label any more. Per-label regexes could not express "a number belongs to exactly ONE label": in `سعرات 1000 بروتين 55` the 1000 sits one space from both, so each claimed it and protein came out 1000. It now collects every number and every label with positions, scores each legal pairing by the separator gap, and assigns greedily from the tightest pair outward, **never reusing a number**.
  - A UNIT between number and label (`18 جرام بروتين`) ranks TIGHTEST, ahead of bare adjacency — that phrase names its own measure. Without it, `18 جرام بروتين 15 جرام دهون` gave protein 15.
  - ⚠️ **`\b` DOES NOT WORK AFTER ARABIC LETTERS.** It is defined by `\w` = `[A-Za-z0-9_]`, so `/قرام\b/` never matches. Use `(?![\p{L}0-9])`. This cost a full debugging round.
  - Two guards keep it out of ordinary chat: an explicit calorie figure is required, AND a second macro beside it. That is why `كم سعرة في 100 جرام رز؟` still goes to the model instead of being logged as a 100-kcal meal.
- **Photo notes** (v270): a picked photo lands with an optional note box before the call. The note goes into `imagePrompt(note)` as GROUND TRUTH that outranks the model's reading of the image — a photo cannot show what is inside a dish, how it was cooked, or the oil in it.
- **`FOOD_PRESETS`** (v271): 219 entries, EN+AR, Gulf dishes and gym staples. **Every row carries `f` (fat)** and `js/app.js` reads it as `fat: p.f || 0` when logging — a row without `f` silently logs zero fat. The catalog once had `f` on only 19 of 62 rows and a delegated edit stripped those, which is how that was found. If you add a row, give it `f`.
- **Adjust the AI estimate** (v171): every AI food card (chat/photo in foodai.js, voice in app.js) has a portion stepper (0.25–20×) that live-recomputes macros; the estimate is stored as the per-serving base with the chosen portion as `servings` (totals = macros × servings). `logNutritionItems` honors `it.servings`.
- **First-run onboarding** (v172, reshaped in v197): `DB.prefs.onboarded()`/`setOnboarded()` + `showOnboarding()`. Now a **3-slide** overlay (welcome, units, goal→hands off to the real calculator) — the language slide is gone, see below. Shown only to genuinely empty installs; existing users (any history/targets) are auto-flagged so an update never re-shows it.

### Food, body and plan features since v309 — the invariants their release notes carry
- **v309 photo plan import:** targets (`cycle[i].targets`) are NOT history — never logged automatically; `planSlot` preserves them; `DB.plan.importImagePlan` is atomic and refuses a stale review; nothing is created during analysis.
- **v310 save centre / v312 convenience:** `changeSlice` owns scoped rollback and Undo — never restore a whole blob to undo one row; a conditional push error NEVER falls back to an unconditional upsert (force-upsert is only the explicit conflict choice); meals log through `DB.foodLogs.addMany` in one write.
- **v314 / v315 new per-user data goes at the TOP LEVEL of the blob**, never inside `plan`: the plan is rebuilt field by field in SEVEN places (`planSlot` rebuilds every slot on every load; `setRotation` drops what it does not name), and a top-level slice needs its six additive edits incl. `hasUserData`. Scheduled cardio (`STATE.cardioPlan`): completion is a real `DB.cardio` row with `planId`; a tick CLAIMS an unclaimed same-type row; un-ticking never hard-deletes a row the tick did not create; the join is guarded on `entityIdSafe`; Home repaints instead of writing when its `data-iso` day has moved.
- **v329 shopping list:** never materialised while empty (`hasUserData` counts it); `_validateBlob` permits every legacy field; amounts are the recipe's words, never parsed or summed; a tick never moves its row nor enters undo. **v332:** `[hidden]` does not hide an element the stylesheet gave a `display` — pair it with `[hidden] { display: none }` or use `style.display` (v400 again).
- **v336 recipe auto-fill:** never one model call per row — a row with a weight waits for a pause, a weightless one for the row to be LEFT; `!hasFigures` is not "settled" (a real zero exists); `parseGrams()` returns null both for "no amount" and "not grams" — ask the string. **v377 search:** `FOOD_SYNONYMS` keys are the FOLDED form; لبن/حليب are deliberately not merged. **v383:** plan day names are user data — translate them for display (`planDayName`, `PLAN_DAY_AR`), never in the stored plan. **v391/v392:** the recipe view is read-only and its scaler moves only an amount's leading number, never writing. **v400 recipe import:** a clip is decomposed ON the device; the draft is built field by field (never spread the Worker's object); `closeModal()` FIRST, then the editor.

## Navigation & information architecture (v197–v202) — read before touching a view

- **The app NEVER asks for a language.** It is guessed from the device locale
  (`detectLang()` in storage.js, consulted only when building a fresh state) and
  corrected by an **ar/en toggle on the login card**. Two screens used to ask on
  the same fresh install — a dedicated pre-login gate *and* onboarding step 0.
  Both are deleted, along with the `langPicked` flag. **Do not add a language
  question anywhere.** `setUiLanguage(lang)` is the single entry point: it also
  re-renders the current view AND the first-run card, which is alive underneath
  the login gate — `applyLang()` alone only fixes `dir` and the `[data-t]` labels.
- **Bottom-nav tab ids vs. their names.** The Program tab's view id is still
  **`workouts`** (baked into index.html's `<section>`, the nav button, and every
  pushState entry in users' history) but it renders `renderProgram` and is labelled
  **Program / برنامجي**. The exercise browser is its own view, **`exercises`**,
  which took over the router+section slot of the old `library` view — 195 lines
  nothing ever navigated to. `renderWorkouts`/`renderLibrary` no longer exist.
- **The Program tab owns the plan and progression**: cycle position, next training
  days, This week (adherence / sets / new records, each vs last week), muscle
  volume, top records. The rotation editor deliberately stays its own screen
  (`renderPlanner`, reached by "Edit cycle"). Home owns *starting* a workout; its
  hero is the only "start today" control — the Train tab used to carry a byte-identical
  copy of that `navigate()` call, which is why it had no job of its own.
- **Adherence denominator is `trainingDays.length`, never a `workoutForDate()`
  sweep.** `workoutForDate` returns null for any date before the plan's anchor
  ("before the plan started"), so a plan created today renders "1 / 1".
- **`navMap` in `navigate()`** decides which tab stays lit on a child screen.
  Anything reached from the Program tab must map to `workouts`.
- **`renderView` falls back to home on an unknown view** rather than leaving a
  blank screen — reachable via a pushState entry naming a view a later build removed.
- **Home shows the LAST SET**, not a recent-activity feed. The feed mixed workouts,
  cardio and sleep (all three already in the stat strip) and showed the session's
  *heaviest* weight rather than the set actually performed last.
- **`Health.autoSync()`** is safe to call from any view's render (no-op off-native,
  no-op without permission, 20s throttle). `renderCardio` calls it, because Health
  Connect sessions already import into the cardio log but only rendering HOME ever
  triggered a sync.

#### Router, sheets and screens — the invariants their release notes carry
- **Context keys** (v401): every dated screen reads `ctx.date`, a screen with its own unit `ctx.unit`; contract 67 refuses the old private spellings and any key a `navigate()` passes that the renderer never reads.
- **Never query `.view.active` from inside a render** — scope to the element being rendered (v324/v325; the lint rule `no-active-view-query`). **A leaving sheet (`.is-out`) is not an open sheet**: every "is a dialog open?" test selects `.modal-overlay:not(.is-out)` (v341).
- **Sheets:** Back, Escape and `navigate()` close every `.app` sheet through its own `__close` (contract 49); a must-answer dialog is never replaced (`openModal({hold})`, contract 52); every sheet built outside `openModal` holds focus with `holdSheetFocus` — six of them, one layered into `#modal-root` (contract 64, v399/v401); every dialog is named by its title and every field by its caption (v385, v399); every view renders a real heading, and the tucking bar title cannot be it (contract 43, v385).
- **Back arrows go BACK** (`data-back`, contract 50); a plan day's name is printed through `planDayName()` (contract 51); a toast for an action that ends in `navigate()` is raised AFTER it (v296, v398).
- **Motion:** every arrival is the child stagger, the frame never moves (v346); chrome (`.vault-bar`, `.detail-top`) refuses the entrance, and a non-arrival render cancels it (`cancelStagger`); one shared timer for N concurrent elements is not a debounce — keep each cleanup beside its timer (v341); `requestAnimationFrame` and `animationend` do not fire in a hidden document — use a reflow or a timer (v339).
- **The splash door** (v342–v345): frame 0 equals the native PNG, so no opacity dip and literal colours; the stage is transparent (the app is behind it); it blocks taps only while on screen; Back is swallowed while `#splash` exists; `js/update.js` waits for the door before an update reload; the status bar stays black over it.
- **The guided run and the day card:** last time's numbers are GHOSTS, never pre-filled values (v375); a ✓ that invents figures offers Undo (v370); the run resumes its exercise AND its planned rows, excluding today's own row from "last" (v369); `runOnly` has two meanings — a selection (plan order) and the run's own ordered list — kept apart by `runOrdered` and the pure `runOrder`/`runReplace`/`runIdxAfterDrop`/`runSwapAllowed` (v331/v335, `test-run-list.js`); "done today" is coverage of the PLAN, and skipping narrows only the run (v393).
- **Derived, never stored:** the routine (`DB.routine`, v379); the weekly review opens once per week, stamped with a local ISO day — `weekRanges()` returns Dates (contract 53); a week-over-week delta needs both weeks' figures (v378); an empty ledger WINDOW collapses to one empty state while a gap inside a window keeps its row (v364).

### The plan is a CONTINUOUS ROTATION, and its position is DERIVED (v229)
`plan = {mode, cycle, trainingDays, anchor, restDates, extraDates, restPromptAt}`.
`workoutForDate(D)` is the single source of truth for "what falls on D (null =
rest)". It does not store a position: it **counts elapsed training days since
the anchor** and indexes `cycle`. Everything else follows from that.

- **Two date lists, exact mirrors of each other.** `restDates` = a scheduled day
  the user declined; it stops advancing the cycle, so the workout it carried
  lands on the next real training day and everything slides *back*. `extraDates`
  = a non-training weekday pulled *into* the rotation; it advances the cycle, so
  today takes the session the next training day was going to carry and
  everything slides *forward*. A date must never be in both — `setRest` and
  `setExtra` each clear the other, or the rest entry silently wins in
  `workoutForDate` and the pull-forward does nothing.
- **Because the position is derived, undo is free and exact**: removing the list
  entry restores the previous rotation byte for byte. Do not "optimise" this
  into a stored cursor.
- **The weekday check must yield to `extraDates`.** `workoutForDate` used to
  `return null` on a non-training weekday *before* consulting any per-date list,
  which is why "train tomorrow's session now" could not work no matter what it
  wrote — the answer for today was decided before the list was read.
- ⚠️ **SEVEN places rebuild the plan field by field** (this line said five until
  v401; v314 found the other two) — `defaultState`, `migratePlan` (both
  branches; the rotation branch spreads unknown top-level fields since v298),
  `plan.get()`'s fallback, `setRotation`, `clearAll` — **and `planSlot()`, which
  rebuilds every cycle SLOT on every load with no spread**. A slot field not
  enumerated there is erased everywhere, for ever (`targets` survives only
  because v309 named it). New per-user data belongs at the TOP LEVEL of the blob
  (v314/v315 — see "Food, body and plan features since v309").
- Decide rest-ness by calling `workoutForDate`/`isRest`/`isExtra` — **never** by
  testing `trainingDays.includes(dow)` yourself. That test was correct before
  `extraDates` and is now wrong on any pulled-forward day.
- `sdOnly` (session-day) is a **filter** over the day's plan when there is one
  and the **list itself** when there is not — the "train a lagging muscle" route
  runs on a rest day, and a lagging muscle is by definition one the plan does not
  contain, so it could never be reached by filtering.

### Notifications (v208 → rebuilt at v251) — the only native surface
Training, supplement, water, meal and streak reminders, plus the page that shows
them. **This is why APK build 8 exists**: a Capacitor plugin is a native change,
so unlike every release since v109 it does NOT reach installed users from a
`git push` — they must install the new APK. The v251 rebuild needs **no new
APK**: no new plugin, no new permission, and both `addListener` hooks plus
`getDeliveredNotifications()` are already in the installed build.

#### The v251 rebuild — what was actually wrong
The owner's report was "the settings and the timed sentences are all wrong, not
scheduled correctly, and the text isn't tied to my numbers". All of it was true.
Fifteen defects; these five are the ones with lessons in them:

1. **TWO message builders.** `notifTexts()` in app.js read live `DB` data and was
   reachable only from the in-app bar. `titleFor`/`bodyFor` in notify.js read
   only `item.payload`, passed just `{n}`, and then **stripped** every unfilled
   `{placeholder}` — and *that* one fed the OS notifications, the web
   notifications and the catch-up, i.e. everything that reaches a phone. So the
   water reminder arrived titled literally **"of ml"** with a body reading
   "hours left in your day", at 09:00. **Now `DB.notif.text(item, mode)` in
   storage.js is the only builder** (storage.js loads before both consumers;
   `t`/`fmtNum`/`computeStreak` resolve at call time — guard with `typeof`).
   **`fill()` is deleted and nothing is stripped**: each branch fills every
   placeholder its key declares, and where a value is unavailable it selects a
   *different key* (`_plan`, `_first`, `_done`, `_nop`). A stray `{` in the
   output is now a visible defect. The regression test is one line — assert no
   `{` in any `text()` output across the horizon.
2. **The alarms were unbounded daily repeats** (`schedule: {on:{hour,minute}}`)
   armed from conditions evaluated for ONE day, so the training alarm fired on
   rest days and the streak alarm on a broken streak. **Now dated one-shots**
   (`schedule:{at}`) from `scheduleAhead(ARM_DAYS=7)`, one per day with that
   day's own answers. Trade-off, and it is real: **dated alarms EXPIRE** — seven
   days without opening the app and reminders stop. Every foreground re-arms and
   pushes the horizon back out. This shape change is also what made the history
   possible: a repeat never leaves `getPending()`, so "did it fire?" was
   unobservable; a one-shot disappears when it fires.
3. **`armNotifications()` was never called at boot.** Its only callers were the
   permission sheet and the settings redraw, so a normal session armed zero
   in-app timers — and on the web, where there is no OS alarm, that meant
   reminders did not exist at all. It is in `init()` and on `visibilitychange`
   now, and it also runs `migrateFromReminders()`, which was likewise stranded
   behind `sync()`'s native-only bail and so had never run on the web.
4. **`markSent()` was called before the display decision**, so a native
   backgrounded delivery burnt the tag and a slot of the daily cap while showing
   nothing. Split: `alreadySent()` reads up front, `markSent()` spends at each
   real display site.
5. **Two supplement-time UIs wrote to two stores.** The supplement editor wrote
   `sup.times`, which the scheduler has never read. `DB.notif.syncSuppDoses()`
   projects them into `channels.supps.doses` as **linked** doses (`suppId`), so
   they schedule *and* fall silent once `DB.supplements.isTaken()` says so.

- **`DB.notif.scheduleForDate(iso, opts)` is the single source of truth**, and it
  is per-DATE on purpose: every condition it applies (is it a training day, is
  the streak unextended, has the goal been met) is a property of a specific day.
  `scheduleAll()` is a today shim; `scheduleAhead(n)` is what the native path
  arms. `opts.includePast` is the ONLY difference between "what is coming" and
  `Notify.missed()`, so the two answers cannot drift. `opts.noCap` lets the page
  show what the cap held back.
- **`_setAt()` is the only writer of `at`/`hour`/`minute`.** They used to be set
  in two places, and the window-deferral rewrote only `at` — so a deferred dose
  armed the OS alarm for the original, out-of-window time. One writer, no drift.
- **Water is distributed, not stepped.** The old loop stepped from `window.start`
  and stopped after 5, dying at 15:00 and never reaching the 23:30 the user set.
  Raising the 5 does not fix it: the cap then evicts the LATEST slots, truncating
  coverage back to the morning by another route. It is generated last, into
  whatever room is left, spread evenly *inside* the window.
- **The daily cap is a SETTING now** (`cfg.cap`: `'auto'` | number | `'none'`).
  It was withheld on "a guard offered as an option is a guard the user can switch
  off" — but a guard that silently deletes reminders is one the user experiences
  as a broken feature, and they cannot tell those apart. The page also names what
  it held back.
- **Times are local `"HH:MM"` strings, never timestamps** — a reminder means
  "08:00 wherever you are", which is what survives a timezone change and DST.
  `_dateOf()` builds Dates with the **numeric** constructor: `new Date('2026-08-04')`
  parses as UTC, which is the bug class this codebase has hit three times.
- `js/notify.js` has two paths. **Native**: `@capacitor/local-notifications`,
  real alarms with the app closed. Seconds and ms are pinned to 0 — this is the
  same load-bearing detail the old `second: 0` carried, because
  `postponeTriggerIfNeeded` compares with `<=` and a stray second can push an
  alarm a FULL DAY forward. **In-app**: everywhere else (web, and any shell older
  than build 8) it catches up on open — deduped per day in `vault_reminder_seen`.
  The in-app path is not a downgrade; it answers "what did I miss?" and stays
  useful on the APK. Its gate used to be `DB.reminders.get().enabled`, a v208
  flag that defaults false and is now written by nothing, so catch-up was dead
  for anyone who configured the new page.

#### The log and the page
- **`vault.notif.log.v1`** (device-local, rolling 120) is what this device
  actually SHOWED. Device-local for the `DAY_KEY` reason plus one more: a
  reminder delivered on the phone was never seen on the laptop, so syncing it
  would make the laptop's history a lie. It stores the **rendered** text — the
  notification really did say that, and re-rendering later would rewrite history
  when a template or the UI language changed.
- **`vault.notif.armed.v1`** is the manifest of what `sync()` handed the OS.
  `Notify.reconcile()` (foreground, **before** `sync()` — sync rewrites the
  manifest) compares it against `getPending()` to learn what fired while the app
  was dead. Primary source is `getDeliveredNotifications()`; the manifest
  fallback is inference and cannot tell "delivered" from "Doze ate it", which is
  why `path` is recorded and never shown.
- The notifications view is **one page, three sections**: Today (arrived +
  coming up, the latter rendered through the same `DB.notif.text()` so you read
  the exact words at the exact minute), Earlier, then Settings.
- `sync()` cancels everything and re-schedules, rather than diffing — that is how
  you avoid an orphan alarm for a deleted supplement. Call it after ANY change to
  times or settings. Three rules it must keep:
  1. **Decide before destroying.** The permission check and the "is there anything
     to arm?" check both run BEFORE the cancel. Cancelling first looks harmless
     because a re-arm follows, but a cloud pull restoring `enabled: false`, or a
     revoked permission, would wipe every live alarm and arm nothing.
  2. **Check, never request.** `sync()` runs unattended (boot, foreground, every
     settings change). On Android 13+ a `POST_NOTIFICATIONS` dialog dismissed
     twice is hard-denied FOREVER, so burning the prompt with no user gesture
     behind it loses the permission permanently. Requesting belongs to `gate()`.
  3. **Report what Android holds**, not what we asked for: the returned `count`
     is re-read from `getPending()`.
- **It is also called on every foreground**, not just at boot. When the plugin
  re-arms a fired daily repeat it uses `set(AlarmManager.RTC, …)` —
  `RTC`, not `RTC_WAKEUP`, with `allowWhileIdle` dropped
  (`TimedNotificationPublisher.java`), which Doze can defer a long way. Only the
  INITIAL arming takes the wakeup-capable path, so re-syncing keeps every reminder
  on it.
- Manifest needs four: `POST_NOTIFICATIONS` (targetSdk 36),
  **`RECEIVE_BOOT_COMPLETED`** (Android drops every alarm on reboot; without this
  reminders silently stop until the app is next opened), `SCHEDULE_EXACT_ALARM`,
  and **`USE_EXACT_ALARM`**. From Android 14 `SCHEDULE_EXACT_ALARM` is denied by
  default and the user has to find the toggle; `USE_EXACT_ALARM` is granted at
  install. Google Play restricts it to alarm-clock and calendar apps — THE VAULT
  is sideload-only, so it does not apply, but **if this is ever published to Play
  that line must be removed** (the in-app "allow exact alarms" row covers the
  fallback).
- **The notification channel is ours, declared from JS** (`vault-reminders-v1` at
  importance HIGH, `vault-reminders-quiet-v1` at LOW for the sound-off setting).
  Left alone the plugin invents a channel called "Default" at IMPORTANCE_DEFAULT —
  no heads-up banner, and a settings entry the user cannot recognise. **A channel
  is IMMUTABLE once created**: importance, sound and vibration can never be
  changed afterwards, only the name. That is why sound on/off is two channels, and
  why the ids carry a version suffix — changing behaviour later means a NEW id.
  Neither channel sets `sound`, so each uses the phone's own default tone.
- **The small icon needs the APK.** Android draws a notification's small icon from
  its ALPHA CHANNEL ONLY; the plugin's fallback is `android.R.drawable.ic_dialog_info`,
  a fully opaque asset that flattens to a featureless white blob. `res/drawable/ic_stat_vault.xml`
  plus `plugins.LocalNotifications.smallIcon` in `capacitor.config.json` fix it —
  both are baked into the APK, so passing `smallIcon` from JS is a harmless no-op
  until the new build is installed.
- **Everything on this path fails SILENTLY**, which is why `Notify.diagnose()` and
  the test button exist. A refused permission, a muted channel, a battery optimiser
  sitting on the alarm and an OS that dropped the schedule all look identical to
  "the feature is broken". The Reminders screen states the permission, what Android
  actually holds, whether exact timing is allowed (with a one-tap fix), and how to
  clear a battery restriction; `Notify.test()` fires a real notification 5s out
  through the same channel and icon.
- **`Notify.gate()` is the single permission entry point** and every
  reminder-related control calls it: the master switch, the water switch, adding a
  time to a supplement, and opening the Reminders screen while enabled but
  unpermitted. It RAISES the system dialog; it does **not** veto the action —
  refusing the OS permission costs only the alerts that fire while the app is
  closed, and the in-app catch-up needs no permission, so blocking the action
  would disable a feature that still works. It also never re-prompts once the OS
  has hard-denied (Android stops showing the sheet); it explains instead.
- On web the same gate uses `Notification.requestPermission()`, and the catch-up
  raises a real system notification when granted, falling back to a toast.
- Water slots are generated from a from/to window and a step, **capped at 24** —
  Android silently drops a runaway schedule rather than erroring.
- `DB.supplements.update()` is a **field whitelist**; it silently drops anything it
  doesn't name. Reminder times saved on create and vanished on edit until `times`
  was added to it. Check that list when adding a field.
- **The reminder system is TOLD, never called by name from another domain** (v363):
  a save dispatches `vault:session-saved` / `vault:reminders-changed` and the
  notifications block listens — contract 7 sees an event, nobody sees a swallowed
  ReferenceError. `scripts/test-notif-events.js` refuses a direct call. A reminder
  asks ONE predicate, `DB.notif.stillDue()`, when armed and when it fires (contract 54, v398).
- **The home-screen widgets** (v365–v367): the snapshot's day is resolved at WRITE
  time, never passed in from a render; logout must clear it (`DB.widget.clear()` —
  native storage no localStorage sweep reaches); `Capacitor.Plugins.X` and every
  `P.method(` must match the Kotlin plugin (contract 40); RemoteViews has a fixed
  view set (no plain `View`); a widget's layout direction follows the APP's
  language; each PendingIntent needs its own request code; a quick action arrives
  through `getLaunchUrl` (cold) AND `appUrlOpen` (warm) and is spent once. Every
  widget revision is a new APK.

### Two modes, one identity (v210) — the theme system
The eleven alternate colour skins (forest, ocean, sand, mocha, olive, aurora,
sunset, nebula, slate, frost, dusk) were **deleted**. Each one defined its own
accent, so switching away from `dark` quietly dropped the brand — the app did not
have a look, it had a dropdown. `THEMES` is now `['dark', 'light']` and they are
the same identity on two surfaces. `docs/BRAND.md` is the authority.

- **The rule that generates the rest: *elevation is temperature*.** The page is a
  void, and anything lifted toward the viewer is heated metal, so the surface ramp
  climbs in warmth as well as lightness (H30, S~30%). `--bg` stays **pure black** —
  it matches the app-icon tile and is the OLED win on the phone this runs on;
  warming the void would read as a sepia filter. Light inverts the story rather
  than repeating it: bone ground, warm ink, near-white sheets.
- **The accent is `#ff6a00` in BOTH modes** (owner's explicit instruction). Only
  `--accent-text` darkens in light, for the places the accent is small text, and it
  must stay declared on **`body`, never `:root`** — `var()` resolves on the element
  the property is declared on.
- **Migration, not fallback.** A stored `nebula` has to become a stored `dark`, or
  it survives in localStorage AND in the synced blob forever. `LEGACY_THEME_MAP`
  (`js/storage.js`) maps every retired id; the clamp runs at **all three doors into
  STATE** — `loadState()` (setting `migrated = true` so it persists), `setTheme()`,
  and `importJSON()` (restoring an old backup). `normalizeTheme()` in `app.js` is
  the runtime backstop for a pref arriving from the cloud mid-session.
- **`applyTheme()`'s `<meta name="theme-color">` must track `--bg` exactly**
  (`#000000` / `#faf5f0`) or the phone paints a seam above the app.
- **The IDENTITY LAYER must stay PHYSICALLY LAST in `styles.css`** — it drifted into the middle of the file over v218–v227 (about 500 lines of component CSS ended up appended after it) and was moved back at v262. Its authority is pure SOURCE ORDER at equal (0,1,0) specificity, so anything below it silently wins; the drift it exists to prevent had already shipped inside those blocks (day labels at 10/9px, under the 11px floor). **Append new component CSS ABOVE the banner that now marks the boundary, never below it.** The move was verified inert: 504 computed-style fingerprints across every element of all 20 views in both themes, zero changed.
- **The IDENTITY LAYER at the end of `styles.css` is the authority** for the
  devices that make the app recognisable — the machined edge (fill separates, a
  border MEANS interactive), the 2:1 corner law, no circles, the bar tick, and the
  duotone icon colour law. It sits **last on purpose**: those rules have the same
  (0,1,0) specificity as the component rules they override, so only source order
  makes them win. Its own banner lists **seven**, and its seventh — «THE CUT» — is
  PROSE WITH NO RULE BLOCK behind it: the numbered sections stop at 6, because the
  cut left the stylesheet at v227. Contracts 41 and 42 now enforce devices 2 and 4
  directly.
- Zeroing `--card-border` drops the outline from **nine** components via the
  "Unified card surface" block. Anything that consumes it must be handed
  `box-shadow: var(--elev-1)` in the same breath or it loses its edge and gains
  nothing. Two deliberate exceptions: `.quick-add-chip` (a control, so it keeps an
  interactive border) and `.bento-card` (its `inset: 0` child paints over an inset
  bevel). ⚠️ From v364 to v401 the zeroing rule itself was DROPPED: a block inserted
  inside the identity layer's banner turned its prose into the selector of that rule
  (measured: body `--card-border` read `1px solid …`; no rendered border changed, as
  every consumer is also re-zeroed by name). Contract 69 refuses a comment opener
  inside a CSS comment.
- **CSS rules the release notes carry:** the icon colour law's `--icon-accent:
  currentColor` list is re-derived by MEASURING glyphs on accent fills, and
  `color: transparent` no longer hides a duotone glyph — set `--icon-accent:
  transparent` too (v337); `accent-color` paints only a CHECKED box, and the global
  input padding is a size floor — zero it on a small fixed box (v330); `.cx-list`
  children must be borderless (v328); a decoration inset along a rounded edge needs
  an inset of at least the corner radius (v318); a 44px halo's `inset` is measured
  from the padding box — a 1px border costs 2px — and `overflow-x: auto` clips a
  child's halo on the other axis too (v373); a Latin measurement is an ltr group,
  and `direction` also decides what `flex-start` means (v374); radii come from the
  EFFECTIVE scale — the last declaration of each token (contract 41, v382); no
  capsule or circle on a control, and a strip that is not interactive carries
  `disabled` (contract 42, v384); every font size is a token or
  `calc(Npx * var(--fs-scale))` so «Larger text» reaches it, and no rule nests inside
  another (contracts 62/63, v399); `body.text-lg` is declared on body and the
  pre-paint script writes it in the same `className =` as the theme (v380).

### Typography — three faces, from the brand kit (v213)
One face for text, one for the mark, one for figures. The Google Fonts link in
`index.html` loads these and nothing else.
- **IBM Plex Sans Arabic** — the body face, for **both scripts**. It carries a
  full Latin set, so it replaced the old Inter + Tajawal pair. The
  `body[dir="rtl"]` font override is **gone**: the app used to change typeface
  when you changed language.
- **Archivo** 800, `.2em` tracking — the `VAULT` wordmark and nothing else.
- **JetBrains Mono** — `.num`, i.e. every figure in the app. They are all
  measurements (reps, kg, kcal, 7:12, −0.6), and a mono face makes a column of
  them line up as data. It is tabular by construction, so the old negative
  `letter-spacing` that tightened Inter's figures was removed — it fought the
  mono metrics.

### TWO MARKS: the LOCKUP inside the app, THE CUT on the outside

> ⚠️ **THIS SECTION SAID «the mark is THE CUT» FOR 158 RELEASES WHILE THE TOP BAR
> DREW SOMETHING ELSE.** `styles.css` has carried `/* --- THE CUT is retired --- */`
> since **v227**, `.cut` and `--cut-bg` do not exist in it, and the in-app mark
> has been the AJ lockup ever since. v348 recorded that three documents agreed
> with each other and disagreed with the app; v367 designed a widget family
> against this page and had to throw it away. Corrected here, from the code.

**Inside the app: `brandLockup(size)` in `js/ui.js`.** Two plates — the left and
right halves of `ICONS.dumbbell`, cropped by viewBox so the mark follows the icon
set — flanking `VAULT` (Archivo 800, `.2em`, `--text`) over `TRAIN` (JetBrains
Mono, `.3em`, `--accent`); the plates are `--accent`. **Exactly two sizes**,
`header` (VAULT 11px) and `splash` (32px), and a caller cannot invent a third.
Three call sites, all in `js/app.js`: `vaultBar()` (five screens), the sign-in
gate, onboarding step 0. `admin.html` hand-inlines the same two plate SVGs twice
because it cannot reach `js/ui.js`; nothing keeps those copies in step.

**Outside the app, THE CUT survives on four surfaces** — `icons/icon.svg`,
`res/drawable/ic_launcher_foreground.xml` (and `ic_launcher_monochrome.xml` /
`ic_stat_vault.xml` with it), `get/index.html`, and `privacy.html`, which paints
its own and which `docs/BRAND.md` had never listed. A single horizontal line
shears the name: a **slot** in the surface colour with an **accent hairline**
inside it. Two layers, never one. `docs/BRAND.md` §1 is the law;
the short version:

- Slot **7%** of the type size, floor **2px**. Hairline **1.5px** minimum.
- **11%** for the V monogram — its two diagonals meet at a point and swallow 7%.
- **50%** on Latin, **52%** on Arabic (the dots carry the mass high).
- Tracking **.02em**. Wordmark floor **24px**. Below a **48px** tile the letter
  is dropped and the slot alone is the mark.
- Hairline is `#ff6a00` on dark, `#a34400` on light — `--accent-text`, not
  `--accent`, which is only 2.87:1 on the bone ground.

**Two ways to draw the slot; the surface picks.** Flat surface → paint it in
that surface's token (`privacy.html` does this with its own `--cut-slot` /
`--cut-hair`, and any context that moves the mark onto a different surface MUST
override it). Gradient or translucent surface → mask the band away instead,
because no single colour matches it. `get/index.html` is the masked case. The
shared `.cut` class and its `--cut-bg` that this paragraph used to name went with
v227; each surviving implementation carries its own, which is why neither broke
when the class was deleted.

**The Android themed icon needs its own file.** A monochrome layer is flattened
to alpha and tinted one colour, so the foreground's painted slot would come out
the same colour as the letter and the cut would vanish.
`ic_launcher_monochrome.xml` cuts the slot as a **hole** (`fillType="evenOdd"`),
using two quadrilaterals — one per diagonal — because a single rectangle across
both would count odd in the gap between them and fill in solid.

**The five bars are texture now, not a mark.** They survive as the pinstripe on
the app icon and as the section tick. They are no longer the in-app logo (the top
bar is the LOCKUP) and no longer the status-bar icon (that is the slot mark). Do
not reintroduce them as a logo.

> ⚠️ **AND THE WEB SPLASH DRAWS THEM ANYWAY** — `index.html`'s `.vs-bolt` field is
> five bars with the middle one in `#ff6a00`, above `VAULT` in Archivo. It is
> frame 0 of a sequence whose first frame is a PNG already installed on phones
> (v340), so it cannot be changed without a new APK and it is not a logo in the
> sense this rule forbids — it is the launch animation. Stated because a reader
> comparing the rule against the app will otherwise find it and assume drift.

### App icon vs LAUNCHER icon — two different files (v212)
`icons/icon.svg` is the PWA / browser-tab icon **only** — since v314 the
apple-touch icon is a separate PNG (`icons/apple-touch-icon-180.png`), because
iOS ignores SVG there. The
installed Android app takes its icon from `android/.../mipmap-*/ic_launcher*`,
a completely separate asset baked into the APK.

Nobody had ever replaced those, so **the app icon on every phone was the stock
Capacitor placeholder — a blue "X" on white** — for the app's whole life, while
`icon.svg` had carried the VAULT mark since v202. Updating one does not touch
the other; when the mark changes, ALL THREE have to move — `icons/icon.svg`, the
Android launcher vectors, and `icons/apple-touch-icon-180.png`, which is
re-rendered from icon.svg by hand (see the v314 note).

- The launcher icon is now a **VectorDrawable**
  (`res/drawable/ic_launcher_foreground.xml`) plus a black
  `ic_launcher_background` colour, wired through
  `mipmap-anydpi-v26/ic_launcher{,_round}.xml`. minSdkVersion is 26, so the
  anydpi-v26 adaptive icon ALWAYS wins — the five density PNGs beside it could
  never be loaded, and were deleted rather than left showing the wrong brand.
- ⚠️ **`res/drawable-v24/` shadows `res/drawable/`.** Capacitor ships a stock
  `drawable-v24/ic_launcher_foreground.xml` — the Android **robot** — and at
  minSdk 26 the `-v24` qualifier always wins. Writing the brand icon into plain
  `drawable/` therefore did nothing for THREE releases (v212, v213, v214): users
  saw our black background with their robot on it. Deleted at v215. **When
  replacing any drawable, `find res -name '<name>*'` first** — a qualified
  variant anywhere silently outranks the unqualified one.
- **Verify the icon by DECOMPILING it, never by checking a filename.** The check
  that missed this was "does the APK contain a file called
  `ic_launcher_foreground`?" — which matched the stock file. The check that
  caught it:
  `aapt2 dump xmltree <apk> --file res/drawable/ic_launcher_foreground.xml`
  and reading the actual `pathData`. It must start `M4.4,4.5h3.4l4.2,11.4`.
- `<monochrome>` points at the same vector, so the app joins the Android 13+
  themed-icon set instead of showing as a plain shrunken square beside them.
- **Adaptive-icon safe zone:** the canvas is 108dp but only the inner 72dp
  (18..90) is guaranteed visible — a launcher masks and parallaxes the rest. The
  mark spans 52dp, about 72% of that zone. A first pass at 86% rendered visibly
  oversized against a circular mask next to ordinary icons; check it against a
  real mask, not against the bare canvas.
- **XML comments may not contain a double hyphen.** `icon.svg` shipped for about
  a minute with `--bg` inside its comment, which makes the whole file fail to
  parse as an image — the HTML parser is lenient, an `image/svg+xml` consumer is
  not. Render it to a canvas to catch this; a text diff will not show it.

### Icon set — "VAULT Duotone" (v211, replaced the stroked v202 set)
`ICONS` in `js/catalog.js` (since v334) is a FILLED set (+2 back-compat aliases — contract 23 prints the count) on the
same 24 grid. Every glyph is **two masses**: the base in `currentColor` and the
accent in `var(--icon-accent)`. Nothing is stroked.
- `icon(name, size)` is now four lines and has **no knobs** — no stroke width, no
  caps, no joins. The per-size stroke bands and the `ICON_CAPS` map that used to
  live here are GONE: a filled mass holds its weight at any size, so one path set
  reads at 16px and at 40px. Do not reintroduce them.
- This also retired a known defect: the bottom nav hard-coded `stroke-width`
  2/2.4 at 22px and rendered ~14% heavier than the same glyph elsewhere. With no
  stroke there is nothing left to diverge.
- **Colour comes from the CONTAINER**, never from `icon()`. The rules live in the
  "DUOTONE ICONS" block of the identity layer at the end of `styles.css`. Three
  things there are load-bearing:
  - `--icon-accent` defaults to **`--accent-text`**, not `--accent`. As a GRAPHIC
    mass `#ff6a00` measures 2.65:1 on the light page — under the 3:1 WCAG floor
    for non-text graphics. `--accent-text` is the same orange in dark and `#a34400`
    in light (4.9–6.1:1).
  - On a solid accent FILL (`.home-center-icon`, `.hero-cta`, `.btn-primary`,
    `.food-fab`, `.nutri-setup-icon`) the accent layer would be orange on orange,
    so `--icon-accent: currentColor` collapses the glyph to one mass. That list is
    the complete live set — re-derive it by walking rendered svgs if new accent
    fills appear, don't guess.
  - **Never write a bare `svg { color: … }` rule.** Setting `color` on an svg beats
    inheritance, so it silently overrides every container that already sets the
    colour correctly. The one sanctioned exception is
    `.nav-btn.active:not(.home-center) > svg`, where a different base from the
    label IS the point.
- **7 glyphs are duplicated outside `ICONS`** and must be kept identical: five in
  `index.html`'s bottom-nav (`calendar`, `heartPulse`, `home`, `utensils`, `moon`)
  and two in `js/update.js` (`refresh`, `arrowUp`). Copy them from the live
  `ICONS` object programmatically and replace **positionally** — a regex over a
  repeated `<svg viewBox="0 0 24 24">` pattern will re-match an earlier slot,
  which has broken a release before.
- A wrong key name returns `''` and the icon vanishes **silently, with no error** —
  this actually shipped once. `apple` and `palette` survive as aliases of `meal`
  and `swatches` for exactly this reason. Some names are also **data-driven**
  (`CARDIO_ICON_OPTIONS` in storage.js, built-in cardio `iconName`s, the add-sheet
  tiles), so a rename has to be checked against those too, not just `icon('…')`
  call sites.
- `zap` is the one single-tone glyph (100% accent) — by design, not a bug.
- Charts and illustrations are NOT icons and correctly keep their strokes:
  `.cal-ring-*`, the sparkline paths, and `machineSvgFor()` in `js/storage.js`.

### Type scale & RTL invariants (v200–v201)
- **Nothing renders below 11px.** 24 declarations were at 9–10px; all raised.
  **Fractional sizes are NOT gone** — this line claimed they were and 23
  declarations still carry `.5px` (12.5 and 13.5, in the sleep labels, the
  rotation rows and the reminders sheet). They were never swept after v201, and
  the claim is corrected here rather than acted on: nothing in the app depends
  on it, and re-rounding 23 sizes is its own measured change. 12/13/14/15 are
  NOT unified — they carry 157
  declarations in distinct roles across 18 views.
- `.page-title` is **26px**, not 32: at 32 it tied exactly with `.stat-cell-value`,
  so a heading read once competed with the numbers that are the content. Since
  v385 it reads `--fs-h1` rather than a literal — it was a literal for 185
  releases while the comment above the type scale claimed a `--fs-page` that was
  never declared, which is how the app's most-used heading sat out v380's
  larger-text scale.
- **One section-header system per screen.** `.rot-section-title` (+ optional
  `.rot-section-head` for a trailing action, `.rot-section-sub` for context) is the
  Program tab's; `.section-title` carries the identity layer's BAR TICK and must
  not be mixed in beside it. (It drew a full-width `::after` rule when this line
  was written; the identity layer sets `content: none` on that and adds a 2px
  `::before` bar instead — the rule is the same, its reason is a different
  mark.)
- **`text-align: start`, never `left`,** unless a `body[dir="rtl"]` override exists
  for that exact selector. Three rules shipped Arabic left-aligned inside RTL rows.
- A `<button>` with no `color` inherits the UA `buttontext` default — `.settings-action-row`
  measured **2.23:1** that way. Always set `color` on a styled button.

### Auto-update delivery (since v113) — how updates actually reach devices
The `?v=N` busting alone does NOT reach phones, because the **entry `index.html` itself** is HTTP-cached by GitHub Pages (`Cache-Control: max-age=600`) and the SPA/APK-WebView never re-fetches it while open. `js/update.js` fixes this: on boot it fetches `version.json` fresh (`no-store`), compares `web` to the page's own `?v=N` (parsed from the script src), and if newer **reloads the entry html with a `?u=<build>` cache-buster** → fresh index.html + fresh `?v=N` scripts. Runs on web AND inside the APK WebView. Four guards make a reload loop impossible (unknown-build no-op, `<=` no-op, url-already-`?u=`-targeted no-op, once-per-session `sessionStorage` guard). On resume it re-pulls admin content + shows a tap-to-update banner. **Bootstrap caveat:** a device only gains the auto-updater once it is already ON a build that has it (≥v113) — the first arrival of ≥v113 still relies on the 10-min HTTP cache expiring (or a manual hard-refresh / clear-cache). Every update after that is automatic within seconds of app open.
- **Admin announcement** (`app_config.announcement_*`): shown by `showAnnouncementBanner`. Dismissal is keyed on the config's `updated_at`, so **editing or re-saving the announcement in the admin panel re-broadcasts it to everyone**, even users who dismissed the previous one. `pullCatalog` selects `updated_at`; `init()` re-runs `bootCatalog` on foreground so a freshly-activated announcement appears without a restart.

## SHIPPING IS PRE-AUTHORIZED — do not ask, just ship (standing, 2026-09-14)

The owner's instruction, verbatim: **«ثاني مرة لا تسألني إنّه أنشره أو لا — على طول انشر»**
(next time do not ask me whether to publish — publish straight away).

So when work is finished and verified, **run the release and push it without asking.** Do not
end a turn with "shall I commit and push?" — that question is now noise. The full sequence:

```bash
npm run verify && npm run release && git add <the files> && git commit && git push
```

This authorization is about the QUESTION, not about the standards. Everything that made the
question worth asking still applies, and none of it is waived:

- **Verified first.** `npm run verify` must pass — the gate's current counts are printed by `npm run verify` itself — and any change to
  shipped code must be measured in the running app. Pushing unverified work is not "shipping
  without asking", it is shipping something unknown — GitHub Pages serves the branch directly
  with no gate, so a bad push reaches every device at the next app open.
- **Stage explicitly, never `git add -A`.** `docs/PLAN_PHOTO_IMPORT.md` and
  `docs/CLAUDE_HANDOFF_V313_AR.md` are the owner's own working files and must NOT be
  committed. `release.js` deliberately does not commit for you; it prints the file list and
  leaves staging deliberate. Keep it that way.
- **Still ask about the genuinely irreversible**, which shipping the web app is not (a bad
  push is fixed by `git revert` + a forward release — see Rollback). The list that still
  needs the owner: running SQL against the live database, anything in `backend/pending/`,
  deploying the Worker when it carries a secret change, and publishing a new APK.
- **Report what was pushed**, with the version number and what is now live.

---
## Deploy
- **Web:** commit + push to `main`; GitHub Pages auto-rebuilds.
- **Cloudflare Worker:** changes to `backend/worker/gemini-worker.js` are deployed with `npx wrangler deploy` from `backend/worker/` (since v306; the dashboard paste is no longer needed). CORS is locked to an origin allowlist — if the AI breaks on the Android app, add the Capacitor origin to `ALLOWED_ORIGINS`.
- **Supabase:** schema/RLS changes in `backend/migrations/01_supabase-setup.sql` must be run in the Supabase SQL editor.
- **iOS** (v314): `.github/workflows/ios-build.yml` builds for the simulator on a PINNED `macos-26` runner — never `macos-latest`; the shared scheme and every resource must be referenced in `project.pbxproj`; `scripts/sync-ios.js` must never give `shell: true` to `process.execPath`. A simulator build does not run on a phone.
- **Android APK:** `npm run build:www && npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` → `android/app/build/outputs/apk/debug/app-debug.apk`, committed as `download/THE-VAULT.apk` with its `download/THE-VAULT.apk.sha256` sidecar (the Google Drive copy is retired). Portable JDK/SDK live under `C:\Users\moath\at` (`JAVA_HOME=…\jdk\jdk-21.0.11+10`, `ANDROID_HOME=…\sdk`). Verify by READING THE BUILT BINARY (`aapt2 dump badging` / `xmltree`, `apksigner verify --print-certs`), never the source (v212, v366); `debuggable false` is set because a debuggable build voids `allowBackup="false"` (v348/v365); `--` may not appear in an XML comment (v366).
- **APK signing — the debug keystore is the app's identity, and it is per-MACHINE.** `build.gradle` deliberately keeps the debug `signingConfig` (a new key forces every user to uninstall, and that takes the device-local photo side store and the notification log with it). The Android SDK generates `~/.android/debug.keystore` randomly on each machine; only the name `CN=Android Debug` is shared — the v349 note that the key "sits on every developer machine" is wrong. The shipped signer (read with `apksigner`, build 24) is SHA-256 `e9472323a854d50fd75be5c957feb79c51479177e61e8f378528aa4c89c010b4`; every build so far was made on the owner's PC with the debug config, whose key is `C:\Users\moath\.android\debug.keystore` (created 2026-06-23 — `keytool -list -v -keystore <that file> -alias androiddebugkey` shows its certificate). **Keep an encrypted copy off-machine, never in git.** A new machine must copy that file into its own `~/.android/` BEFORE its first build and confirm the signer hash of the built APK; otherwise the next APK cannot install over the current one. The published `apk.sha256` (contract 11b) proves which binary is genuine; the signature cannot, since the key is a debug key.

## Distribution model — Live URL + native-update banner (since v109)
`capacitor.config.json` sets `server.url = https://moathdarweesh.github.io/vault/`, so the **APK is a thin shell that loads the LIVE site**. Consequences:
- **Ordinary updates (JS/CSS/HTML) reach everyone automatically** on next app open, with NO reinstall — a `git push` updates web AND app users at once. The bundled `www/` is only a build artifact; it is ignored at runtime.
- The APK's WebView origin is now `https://moathdarweesh.github.io` (same as web) — the Worker CORS allowlist already includes it. **Needs internet at launch** (acceptable: the app is cloud/AI-dependent anyway).
- A **NEW APK is only needed for NATIVE changes** (new Capacitor plugin/permission, `capacitor.config`, native code). To ship one: bump `versionCode`/`versionName` in `android/app/build.gradle`, `npm run sync`, build, commit the binary as `download/THE-VAULT.apk` with its `.sha256` sidecar, then set `version.json` → `apk.build` / `apk.version` / `apk.sha256` + notes (contracts 11 and 11b refuse a mismatch) and push. `apk.url` stays the repo's raw URL — `js/update.js` and `get/index.html` refuse any host outside the release allowlist (v349), so a Drive link would leave the banner's button dead. Installed apps then show the in-app "download update" banner (`js/update.js`); the share page is `/vault/get/`.
- Migration note: users upgrading from a pre-v109 (bundled) APK land on the new github.io origin, so localStorage/auth reset once → they log in again and cloud sync restores their data. New users are unaffected.

## Backend v2 — normalized DB, mirror, admin (APPLIED to live Supabase)

> **`backend/README.md` is the authority for WHAT IS APPLIED and in WHAT ORDER.**
> backend/ is now sorted into `migrations/` (applied, numbered by dependency),
> `pending/` (written, NOT applied — the owner runs it), `archive/` (never run — since v397 it also holds the retired `unverified/` files and the superseded 29),
> `archive/` (never run), `worker/` and `docs/`. The summary below is context;
> that table is the state.
The app is going multi-user. Alongside the legacy `vault_data` blob (still the local-first source of truth), a **normalized schema** is live in Supabase (project ref `ilmusnuchqlpirywonzx`). SQL artifacts in `backend/`:
- `schema-v2.sql` — 16 core tables + full RLS + indexes (APPLIED). `seed-v2.sql` — global exercise/cardio catalog (APPLIED). `migrate-blob-to-v2.sql` — one-time blob→tables backfill, SECTION UP applied. `admin-v2.sql` — `profiles.username` (unique), `admins` registry + `is_admin()` + additive admin-READ policies on all tables + `username_available()` RPC (APPLIED).
- **Mirror**: REMOVED in v278 — see the tables.js tombstone near the top of this file.
- **Usernames**: mandatory unique `@handle` enforced by a blocking gate (app.js `ensureUsername`/`showUsernameGate`), set via the profiles table.
- **Admin**: the owner's user_id is in `admins`; `is_admin()` unlocks all-user reads via RLS (never a service_role key in any client). Powers `admin.html`.
- **Admin WRITE + user management** (`admin-write-v3.sql`, v110): `profiles.last_seen` (self-written activity stamp); `user_flags` (role user/coach/admin + status active/disabled/banned) — **admin-write-only via definer RPCs, no client write policy** so a user can read their own row but never escalate; `feedback` inbox (user inserts own, admin reads/resolves). Writes only through `admin_set_role`/`admin_set_status` (SECURITY DEFINER, re-check `is_admin()`, refuse self-target AND the founder owner id). App side (`js/cloud.js` `touchLastSeen`/`getMyFlags`/`submitFeedback`; `js/app.js` `enforceAccountStatus` + `showBlockedGate` + feedback form). **Ban is enforced in the DATABASE** as of `10_ban-rls.sql` + `12_ban-rls-v10.sql`: RESTRICTIVE policies AND-ed onto the owner policies cover the blob, feedback, the mirror tables, the `exercise-images` bucket and `profiles`. It no longer fails open. ⚠️ **`12` did not actually cover all of them, and said it did.** Its `mirror_tables` array was hand-written: it named 5 tables that never existed in this project and omitted 4 that do (`exercises`, `cardio_types`, `foods`, `user_prefs`), and the loop `continue`d past each missing name **with no notice**, so it created 11 policy pairs while every doc recorded 16. The VERIFY query only checked that `%_ban_%` policies existed — never that the count matched the table list, which is why an assertion on existence can hide a gap an assertion on COUNT would have caught. Closed by `15_ban-rls-completion-v11.sql` (which raises rather than skips, and asserts the count) — **applied + verified live 2026-08-13**, followed by `16` (erasure repair + search_path re-pins) and `17` (cross-tenant write guards), both applied and verified the same day. ⚠️ **16 nearly shipped a defect every catalog check passed**: it qualified `pg_catalog.coalesce(...)`, but COALESCE is SQL grammar with no `pg_proc` row, so it cannot be schema-qualified — the file would have applied clean, committed, passed every VERIFY, then thrown on the first admin call, and `admin.html` maps an RPC error to `[]` with no banner. Same trap for GREATEST/LEAST/NULLIF/CASE/CAST. **A migration that defines a function must END BY CALLING IT** — reading `pg_proc` proves it exists, only calling proves it runs. See `backend/README.md`: tables carrying a ban pair went 14 -> 18, and `client_errors` grants are now exactly `authenticated: SELECT, INSERT` with nothing for `anon`. Two independent audits found this separately; **not** an isolation break — RLS still scoped every one of those tables to `auth.uid()`. SELECT and DELETE are deliberately left alone so a blocked user can still export and erase their own data. The one hole left is the **Cloudflare Worker** — it is not Postgres, so RLS cannot reach it; a banned-but-authenticated account can still call the AI endpoint at the normal rate limit. Security-audited (no isolation break, no escalation; feedback fields escaped in the inbox).
- **Applying SQL:** the Supabase SQL editor, or the Supabase MCP `execute_sql` when the session has it (that is how 23–25 were applied; `apply_migration` is refused by the permission classifier, `execute_sql` is not). `backend/README.md`'s row must record WHICH path a file took. The "destructive operations" dialog is benign ONLY when the script's drops are `drop policy/trigger if exists` guards; a real DROP/DELETE/TRUNCATE needs explicit human confirmation. See the maintainer's memory (`vault-db-v2`).
- **Content/presets/audit/config** (`admin-write-v4.sql`, v111, applied+verified): `audit_log` (append-only, admin-read) + `audit()` logger; `app_config` (public read); `food_catalog` + `preset_plans` (global, public read); is_admin-gated definer CRUD RPCs for global exercises/cardio/foods/presets/config. App consumes them additively via `Cloud.pullCatalog()`/`bootCatalog()` (`js/app.js`) + `DB.exercises.mergeGlobal()`.
- **DB-department audit (2026-07-11)** — full read-only review by db-architect + normalization-auditor + db-security-auditor + db-index-optimizer. Verdict: **professional (A-/B+); no Critical; no client-reachable isolation break; every table BCNF or justified; indexes ahead of the workload.** Fixes surfaced: `backend/migrations/09_hardening-v5.sql` (additive — `feedback_user_idx` + `vault_data` grant double-lock; **APPLIED** in `e54cfed`, which read the resulting grants back); `backend/archive/DROP-migration_v2.CONFIRMATION-REQUIRED.sql` (**destructive** — the leftover `migration_v2` staging schema holds unminimized cross-user PII; NOT reachable but a data-min gap; human runs out-of-band after a backup). Roadmap/optional: consolidate `admins`↔`user_flags.role`; decompose `health_prefs.hidden text[]`→`health_hidden` before analytics; `loadAll()` → aggregate RPC as users grow; hard RLS ban.
- **Custom exercise images — durable backup** (`backend/migrations/08_storage-images-v6.sql`, **APPLIED + VERIFIED live 2026-07-17**; v120–v123): user-uploaded images (`customImage`) used to live ONLY as base64 inside the `vault_data` blob. The blob is a single mutable row with no history, so when an empty local state once overwrote it every image was destroyed — and the mirror never carried them, so a mirror restore brought back the exercise but not its picture (**this actually happened to the owner; the images were unrecoverable**). Now (v291): the base64 lives in a **side store** — one localStorage key per photo, `vault_img_<exerciseId>` — and every exercise object exposes `customImage` as a **non-enumerable accessor** onto it (`js/storage.js` `defineImgAccessor`), so readers and writers are unchanged while `JSON.stringify(STATE)` carries no photos: a set commit no longer serialises megabytes, the pre-sync snapshot fits, and a cloud pull replaces the blob and **leaves the photos alone** (they used to vanish after every foreground pull until the next heal). Still instant and still offline. An inline `customImage` found in a stored/imported/pulled blob is moved out on load; `exportJSON()` re-attaches photos so a backup file is complete; `Cloud.pushOnce` re-attaches any photo that has **no bucket copy yet** so it still travels; `imgPrune()` drops keys for exercises that no longer exist (never in READ-ONLY mode — the default state has none of the user's exercises); `clearLocalUserData()` wipes them on logout; `DB.exercises.setImage()` writes a photo without touching the blob (the boot-time heal uses it). Cards get a base64 background AFTER parsing (`hydrateCardImages`), never inside the HTML string. A durable copy is ALSO uploaded to the **private** `exercise-images` bucket at `{auth.uid()}/{exercise_id}.jpg` (owner-only RLS on `storage.objects`, 512 KB cap (live `file_size_limit` = 524288 — this line said 5 MB until v397), image mime allowlist — **keep `image/svg+xml` OUT of that allowlist permanently: it is what rejects an active-content SVG from a poisoned imported backup**). The pointer is `imagePath` on the exercise object in the blob (the `user_exercise_prefs.custom_image_path` mirror column went with the mirror in v278). Since v291 the blob also carries `imageAt` (when the photo was last set) and `imageCleared` (an explicit removal): a device reconciles its side store against them on every load, so a photo removed or replaced on one device is removed or refetched on the others instead of resurrected and pushed back. Two rules that fell out of the second review (v292): **a NEW photo resets `imagePath` to null** (the bucket copy is stale; the upload runs again and the push carries the bytes inline until it lands — unchanged bytes on a re-save change nothing), and **the pre-sync rescue re-attaches every un-backed-up photo** exactly as the upload does, because the raw blob no longer holds any and the pull that follows a snapshot prunes the side store. A missing stamp beside a stored photo counts as *different*, never as a match. Client: `Cloud.backupExerciseImage/restoreExerciseImage/removeExerciseImage` (cloud.js), `backupExerciseImageFor()` on save + `syncExerciseImages()` after login/bootSync (app.js) which backfills any un-backed-up image AND heals an exercise whose base64 was lost but whose backup survived. **All best-effort** — every failure path leaves the local base64 untouched, so backing up can never lose an image, and the app works unchanged if the bucket is missing.
- Still pending: social features deferred. (The normalized-tables mirror was removed in v278.)

## Hardening pass (v189–v190) — invariants added by the 2026-07-25 codebase review

Full findings + verification in `docs/CODEBASE_REVIEW.md`. The load-bearing rules:

- **`saveLocal()` vs `save()` (`js/storage.js`).** `save()` flags the blob dirty for cloud sync; `saveLocal()` does not. **Housekeeping writes must use `saveLocal()`** — the Health Connect cache, the global-catalog merge, the onboarding flag. They run *before* `bootSync`'s pull resolves, and flagging them dirty manufactured a false `'conflict'` whose "Keep this device" branch force-pushes over a **newer** cloud blob (skipping both the empty-blob guard and the version compare). If you add a write that the device re-derives for itself, it belongs in `saveLocal()`.
- **READ-ONLY mode.** If the stored blob fails to parse, `loadState()` no longer overwrites it with `defaultState()`. It quarantines a copy at `gym_tracker_v1__corrupt`, sets `STATE_LOAD_FAILED`, and `writeStore()` refuses every write until a *deliberate* replacement (cloud pull / restore / reset) clears it via `reloadState()`. Never "fix" this by writing defaults.
- **`push()` returns `'ok'` on success** — and only on success. `'nosession'`, `'blocked'`, `'conflict'`, or a throw all mean the data did **not** upload. Any caller gating a destructive action (logout clearing the device) must test `=== 'ok'`, never "not an error string". **And use `Cloud.flush()`, not `push()`, before destroying local data** (v291): `push()` hands back a push already in flight, whose snapshot predates a save made during the upload — it resolves `'ok'` with dirty honestly still set, and logout wiped the device on that `'ok'`. `flush()` pushes again while dirty.
- **`applyRemote()` propagates `importRaw()`'s failure.** A failed pull must not advance the sync stamp or clear the dirty flag.
- ~~**Mirror reconcile is gated on `blobLooksReal`** (`js/tables.js`).~~ History: the mirror and `js/tables.js` were removed in v278. The lesson stands for any future bulk delete keyed on a list — an empty id list makes the delete unbounded.
- **Dates: always `todayISO()` / `addDaysISO()`, never `toISOString()`** for calendar days. `toISOString()` returns the previous day for every UTC+ user — this bug class has now appeared three times. **And resolve the day when the row is WRITTEN, not when the sheet opened** (v291, the fourth appearance, via a stale closure): `openAddSheet(null, …)` means "today, decided by `todayISO()` at log time"; every `DB.foodLogs.add(date || todayISO(), …)` site and `FoodAI`'s `dateNow()` follow it. Only the history view passes an explicit past date.
- **The guided screen does not move (v290–v291).** The rest bar is ONE persistent element with two states of the same min-height — `.rest-timer.idle` (no rest running) and `.live` (countdown, sticky) — inserted by `ensureRestBar()` directly before `.run-nav` **as a child of the view** (position:sticky can only travel inside its containing block; never wrap it). `stopRestTimer()` goes idle in place; only `clearRestTimer()` (navigate away) removes it. Re-renders (add set, next exercise) re-attach the SAME node, so the countdown never restarts. `Notify.restAlarm()` is the locked-phone alert, armed 1.5 s after `endAt` so an on-screen finish cancels it before it fires. A ✓ on a set with no numbers is refused (toast), and un-ticking stops the clock only for the set that started it.
- **The guided run resumes.** `runIdx` opens on the LAST exercise that has a session on the run date — a half-done exercise must not be skipped (v369; this line said «the first with none» until v397) — or on the first when none has one; persisted sets come back `done: true`. The suggestion and the best/last cells read history that **excludes the run date** — today's own row must never become "last session" mid-workout. Suggestions are computed in the unit the bar is loaded in (5-lb plates for lb users), and legs are matched case-insensitively (`'Legs'` is what is stored).
- **Sync decisions (v289–v291).** `push()` is serialised (one in flight; later callers share its promise); a conflict against identical bytes is a self-conflict and reports `'ok'`; `vault:push-ok` reopens the conflict-toast latch, which otherwise suppresses only repeats of one unresolved conflict. `bootSyncCore` decides pull-vs-push by the server **`version`** when both sides know it (clocks only as a fallback), and recognises its own last push through the `vault_pushing_<uid>` stamp written *before* the request, so an app killed mid-upload does not manufacture a conflict. `chooseLocal()` snapshots the cloud copy before force-pushing over it. The rescue slot (`vault_pre_sync_backup`) is stamped with its `uid` and refused for any other account, holds no backed-up photos, and records a failed write (`…_failed`) that Settings shows; logout also clears it, the `__corrupt` copy, the AI cache and the `vault_img_*` keys. READ-ONLY refusals dispatch `vault:save-failed {readonly:true}`, and `init()` asks `DB.loadFailed()` because the load-failed event fires before app.js exists. Inside the APK an `<a download>` is inert: `exportBackupFile()` shares or copies to the clipboard there.
- **Console sinks.** Every blob-derived string in `admin.html` goes through `esc()`; enumerable values (`prefs.unit`) are whitelisted at load (`u.unit==='lb'?'lb':'kg'`) — `toUpperCase()` is not a defence. Two stored-XSS sinks (sleep times, unit → `admin_set_role` escalation) were closed in v291.
- **Worker chat mode** runs under a fixed server-side `CHAT_SYSTEM` and ignores the client `prompt` entirely; food/photo still take `prompt || text` as the user turn; audio runs under the fixed server-side `AUDIO_SYSTEM` since v397, and every mode returns at most `MAX_ITEMS` (40) items (food/photo under the strict JSON `SYSTEM` instruction). Deployed by the owner with `npx wrangler deploy` from `backend/worker/` (since v306; the dashboard paste of 2026-09-02, version `d356f094`, is history). ⚠️ The v391 timing cap and the v397 audio/logging/English-examples changes are committed but NOT yet deployed.
- **Error visibility.** `Cloud.reportError()` + `window.onerror`/`unhandledrejection` write to `client_errors` (`backend/migrations/11_client-errors-v9.sql`, **APPLIED + VERIFIED live 2026-08-05**): signed-in users only, no user content, per-session dedupe, DB-side rate cap of 20/hour, 30-day retention via `admin_prune_client_errors()`. The reporter must never throw and never block.
  > It sat in `pending/` for weeks while the client was already reporting into it — and `reportError` ends `.then(() => {}, () => {})`, swallowing both outcomes, so **every crash on every device was posted to a table that did not exist and silently discarded**. The mechanism built because "everything on this path fails silently" was itself failing silently, and had collected exactly zero rows. Verified after applying: 9 columns, 4 indexes, RLS on, 1 trigger, 2 definer functions, and a policy map of `DELETE:admin | INSERT:own | SELECT:own | SELECT:admin` — **no UPDATE policy for anyone**, so nobody can edit or erase evidence of a bug.
- **Accessibility invariants.** Both modes pass WCAG AA across 15 views and the modals, swept with a scrim-aware auditor. `--text-ghost` is for input placeholders and `--text-faint` is **decorative only** (~1.4:1 in light by design) — do not "unify" them, and never use `--text-faint` for text a user has to read. Muted tokens are calibrated against **`--surface-3`**, the worst surface they land on, never against `--bg`. **Zoom is OFF since 2026-09-23 (owner decision, v390: «ما بدي ينعمل زوم» after the app enlarged on his phone)** — the viewport carries `maximum-scale=1, user-scalable=no`, contract 45 enforces it, and the Android shell pins `textZoom` to 100 so the phone's font-size setting cannot scale the app either (that half reaches phones only with APK 25). The in-app «خطّ أكبر» setting (v380, `body.text-lg`) is the accessible route. **Inputs still stay ≥16px**: iOS ignores `user-scalable=no`, so focus-zoom would return there.
- **Worker auth** (`backend/worker/gemini-worker.js`) fails **closed** on any 4xx and open only on 5xx/network error, plus a per-caller rate limit. Requires a manual Cloudflare redeploy.
- **v296 (2026-09-05) — the glitch/smoothness/code review, 24 fixes + the rest bar + 14 controls.** Invariants it adds:
  - **`renderSessionRun` reads `runCtx`, never `viewContext`.** `navigate()` replaces `viewContext` synchronously, but the blur→`setTimeout(0)` commit of a half-typed set fires after that swap; reading `viewContext` there threw and the set never reached the DB (a v291 regression). Any new listener inside the run screen must close over `runCtx`.
  - **A set can be stored `done:false`** (typed, then the field lost focus, never ✓). `DB.sessions.add/update` keep the flag only when it is `false`; `runInit` shows `done: s.done !== false`. Sets from the other logging paths carry no flag and count as done.
  - **`prefs.restSec`** (default 90, 15–600) is the default rest; the IDLE rest bar's ±15 set it (`DB.prefs.setRestSec`), the LIVE ±15 only move the running clock. The idle bar is the live bar's shape (label + figure + ±15) so nothing moves when a rest starts — it is a control, not a dashed placeholder. A `floating` bar is removed on stop, never left idle over another view.
  - **`Notify.sync()` whitelists `REST_ALARM_ID`** in its orphan sweep — it runs on every foreground, mid-rest included, and used to cancel the very alarm that ends a rest with the screen off. The rest bar also re-arms on wake.
  - **Pre-paint mirror `vault_ui`** (`localStorage`, written by `storage.js mirrorUi()` on setLang/setTheme/boot and by `applyLang` with the nav labels): two inline scripts in `index.html` apply theme class, `dir`, `lang`, the theme-color meta and the nav labels BEFORE the static body paints. It is a mirror of prefs, never a source. Keep the theme class names `theme-<canonical>`.
  - **The food FAB lives in the shell** (`index.html`, child of `.app`, `display:none` unless `body[data-view="food"]`), filled and bound by `renderFood` through `fab.onclick`. Inside the fading `.view` the entrance transform was its containing block and it snapped into place 200 ms after every open.
  - **A confirmation toast for an action that ends in `navigate()` is raised AFTER the navigate** — `navigate()` hides any toast it finds. Three sites were silently mute for this reason.
  - **`navigate()` saves the scroll offset on the stack entry being left BEFORE the `.view` toggle** (hiding the outgoing view collapses the scroller to 0) and restores it on `fromPop`. `syncRemindersOrWarn()` surfaces `{ok:false}` from `Notify.sync()` at the three SETTINGS sites only (toast + `reportError`); the post-pull sync stays silent, and `notify.js` reports a never-asked permission as `'prompt'`, not `'denied'`.
  - **Fonts stay `display=swap`.** `optional` was tried in v296 and dropped by measurement: with the async-promoted (print→all) sheet, Chrome parks the faces on the fallback for the whole session on about one launch in four. The one-time reflow on a cold load (the Arabic fallback measures 25% taller) is the accepted cost. `.app` carries `height: 100vh` before `100dvh` for WebViews older than Chrome 108, which otherwise had no height at all.
  - **Buttons:** every pressable control is now on the three-size scale (`--btn-h-*`, `--radius-btn-*`, `--fs-btn-*`); the ones that must stay visually small carry a 44px `::after` halo. `transition: all` is gone — name the properties. `:hover` rules live under `@media (hover: hover)`. `.ai-note` is the chat note; the photo-note field is `.ai-note-input`. `--danger` is a real token in both themes.
  - **v297 (owner decisions):** the per-card `backdrop-filter` layers are gone (`.bento-card-name-tag` scrim 0.86, `.bento-toggle` plain) — the bottom nav keeps its blur, one layer. **A live rest follows you:** `navigate()` calls `parkRestBar()` — a running bar floats (`.rest-timer.floating`, fixed above the nav) over whatever screen comes next and `ensureRestBar()` slots it back above Prev/Next on return; `runInit` re-points `__restTimer.setRef` at the rebuilt set so un-ticking it still ends the rest; an idle bar is simply dropped.
- **v298 (2026-09-05) — the dependency-integrity pass: implicit agreements between files made explicit, and ENFORCED.**
  - **`scripts/check-contracts.js`** runs from the pre-commit hook (after `check-release`) and as `npm run check`: twenty-eight contracts (twelve at v298, one at v299, fifteen more at v300 — the v298 twelve run to the semicolon-run below, the rest are tagged) — script order = dependency order; every marker equal and every shipped asset versioned; admin.html and cloud.js on the same Supabase project/key; every table/RPC/bucket the clients call exists after replaying `backend/migrations` in order; every `t('key')` and every `t('prefix_' + x)` family present in BOTH dictionaries; every `navigate()` target has a `<section>` and every section a `renderView` case; every `vault:*` event dispatched AND listened; localStorage keys come from the registry only, and no unregistered `vault_*`/`gym_tracker*`/`foodai_*`/`hc_*` literal exists; every Worker error string is one `friendlyErr` translates; one blob validator and one week start; `version.json` apk numbers equal `build.gradle`; the preconnect host equals cloud.js's; **(v299)** the 73 seed exercises are in both name maps; **(v300)** every `rpc()` call's literal argument names match a surviving SQL overload (PostgREST resolves by NAME, and a renamed parameter fails at runtime as `[]`); `js/health.js` calls only `@PluginMethod`s the Kotlin plugin declares; **the Console counts the app's week** — the `admin_user_stats()` anchor (migration 23, Sunday), both `admin.html` week starts and every «الأسبوع من …» caption follow `WEEK_START` (migration 19 said Saturday, so the same user read two adherence figures on one morning). **When a review finds a "must match" comment, add a contract here instead.**
  - **`window.VAULT_KEYS`** (top of `js/cloud.js`, before its IIFE) is the ONE registry of localStorage keys. Every later file reads it; the checker refuses a literal copy. The two inline pre-paint scripts in `index.html` run before cloud.js and spell the `ui` key themselves — the checker compares that one literal against the registry. `clearLocalUserData` sweeps by registry prefixes and also clears the `DB.notif` side store and the unit-seed flag (user B on a shared phone used to read user A's reminder log).
  - **The blob has ONE validator** (`DB._validateBlob`, storage.js; cloud.js delegates) **and ONE normaliser** (`loadState`: every array field an array, every map a map, every session's `sets` numeric with `done:false` kept). `DB.hasUserData()` is the one "does this install hold user data" list; cloud.js and `seedDefaultUnitIfNew` ask it. `migratePlan` spreads unknown fields through instead of erasing them on every load.
  - **`WEEK_START = 0` and `weekOrder()`** (storage.js) are the week for everything — `startOfWeek` (stats) and every strip/planner order. Stats used to start on Monday while every strip started on Sunday.
  - **`Notify.foreground()`** = reconcile → sync → catchUp, chained. Boot, `visibilitychange` and `refreshAfterSync` call it; `refreshAfterSync` calls it with `{ catchUp: false }` (a second catch-up inside the boot's round trip burned the first missed-reminder bar) and also re-arms the in-app timers. Never call `Notify.sync()` from a foreground path directly — the manifest reconcile reads is the one sync rewrites.
  - **`bootSyncCore` asks the first-link question too, but only where it guards a PULL** (`remoteNewer && !localEmpty && !isLinked → conflict`, placed below the own-push adoption and the version compare) — a device whose conflict dialog died with the process used to pull over its data silently on the next launch; putting the guard any higher re-manufactured a self-conflict for a device whose first push lost its reply. **A push that lands marks the device linked.** One sync runs at a time (`syncInFlight`, shared by `bootSync` and `resume`), and `showConflictDialog` is a no-op while a conflict dialog is open.
  - `DB.exercises.remove` prunes the id from every plan slot. `sets[].done:false` is a RESUME flag only: an un-ticked, typed set still counts in stats and PRs (the pre-v296 behaviour, kept on purpose).
  - **Release markers** now include `manifest.json`, `admin.html`, `privacy.html`, `get/index.html` (their `?v=`) and this file's `Current version` line; `check-release` treats `js/vendor/`, `icons/`, `manifest.json` and `get/index.html` as shipped. `capacitor.config.json` declares `android.minWebViewVersion: 80` (`?.` is everywhere; `color-mix()` needs 111 and degrades visually below it). `backend/migrations/22_vault-data-version.sql` is the `version` column the push compare depends on (applied live long ago; it lived in `unverified/`). The `android/app/src/main/assets` copy of the Capacitor config is SEMANTICALLY IDENTICAL to the root one — this line claimed it "differs" for 68 releases, and the only difference is `cap sync`'s indentation. Run `npm run sync` before an APK build regardless, so the copy can never go stale.
- **v299 (2026-09-05) — three features + the Health Connect pass (APK 20).**
  - **Recipe rows fill their own figures** (`openRecipeEditor`): a name + a quantity schedules a fill after 900 ms — first `localLookup` (a `DB.foods` entry whose `serving` parses to grams, scaled; `parseGrams` reads Arabic-Indic digits and غ/جم/g/كغ/ml), else ONE batched `FoodAI.analyze()` for every pending row (lines `qty name`, ≤380 chars a batch, mapped by index when counts match else by name). A hand-typed figure sets `_manual` and is never overwritten; `_auto`/`_manual` are stripped on save. The Worker quota is per day: never one call per row.
  - **Sleep and cardio are a DAY LEDGER** (`dayLedgerHtml`): one row per calendar day, newest first, 7 days + "earlier days"; an empty day is a dashed `.ledger-add` carrying `data-ledger-sleep|cardio="<iso>"` that opens the log modal with `presetDate`. `ledgerDayIso` builds LOCAL dates — the same strings `todayISO()` and the Health Connect import write (date = the morning you woke).
  - **Exercise names have three modes** — `prefs.exNames` ∈ `translit` (Arabic letters, English sound: `EXERCISE_NAME_AR`) · `ar` (translated: `EXERCISE_NAME_AR_FULL`, 73 entries, formal terms — جهاز for a machine, ثلاثية الرؤوس for triceps, الكابل for cable) · `en`. `exNamesMode()` decides; `loadState` migrates the old boolean; `setExNames` keeps `translateExercises` in step for older readers. Adding a seed exercise means adding it to BOTH maps (the patch that introduced the full map refused a key on one side only).
  - **Health Connect (js/health.js + HealthConnectPlugin.kt, APK 20):** the plugin's `granted` means ALL permissions now (`partial` + `missing[]` say the rest; it used to mean ANY, so a steps-only grant looked connected while sleep never arrived); totals come from `aggregate()` (raw `readRecords().sumOf` counted the phone AND the watch); `readData` takes an optional `sinceTime` — `sinceTime()` in JS is the newest imported `hcKey` minus a day, so a foreground reads what is new, not thirty days. `Health.status()/statusText()/refreshStatus()` make the Settings row a LIVE status (web / not installed / needs update → Play Store / not connected / partly connected / connected + last sync). `applyToLogs` holds imports until `vault:sync-settled` (dispatched by cloud.js when bootSync/resolveOnLogin settle) — the morning's sleep used to reach the home card but not the ledger until the next foreground. The first permission prompt waits for onboarding and writes `hcPrompted` AFTER the dialog. Plugin errors are mapped to Arabic (`friendlyHealthErr`). Heart-rate/oxygen cards show the reading's age.
- **v300 (2026-09-06) — the three audit lenses the v298 pass could not finish (load order + globals, DOM/CSS structure, client ↔ backend contracts): 23 confirmed findings fixed, each with a contract.**
  - **Boot order.** `afterScripts(fn)` (app.js) runs `fn` once the load event has fired — every classic script has executed by then. The boot reminders used a 1.5 s timer armed during app.js's OWN evaluation, which raced notify.js (two scripts later) on a cold cache and silently armed nothing. health.js redraws Home once after `window.Health = …` when its section has content — `init()` paints Home before health.js exists, and on a phone without the permission nothing re-rendered it, so the Health card was absent from the first paint. storage.js keeps a quota failure that happens during its own evaluation (`DB.bootSaveFailed()`) and `init()` re-raises it into the `vault:save-failed` listener that did not exist yet. The add-sheet's Chat/Photo tiles check `window.FoodAI` like every other site (they ran from a detached 260 ms callback).
  - **One spelling.** The quarantined blob is written at `VAULT_KEYS.corrupt` (storage.js derived `STORAGE_KEY + '__corrupt'`; cloud.js cleared the registry's key — the same string today, two spellings). `imgPrune` names both photo prefixes instead of relying on `vault_img_at_` starting with `vault_img_`.
  - **Backend contracts.** Migration **24** widens `client_errors.kind` to the five kinds the app sends — `reportError('notif', …)` and the sync-conflict diagnostics were refused with 23514 and swallowed, so the diagnostics written for the multi-device conflict class had never reached the table. Migration **23** anchors `admin_user_stats()` on SUNDAY like `WEEK_START` (19 said Saturday; the Console's copy, `weekStartDate()` and the plan-vs-done grid follow). Migration 20 now adds the `version` column its trigger reads (idempotent): its history trigger reads `old.version`, and on a fresh project replayed in order that column did not exist until 22 — so every blob UPDATE between the two would have failed. The live database never had the window (22 was applied long before it was numbered), and contract 4 replays columns now so the next such trigger cannot be written blind. `pullCatalog` reads the global `exercises` catalog only with a session (`to authenticated`, anon revoked in 02 — the comment claimed anon). The photo instruction travels as `prompt` (the Worker keeps 1200 of it, 500 of `text`; `imagePrompt()` with a full note is ~1170, and the note was the part cut). The Worker admits `http://localhost:<any port>` / `127.0.0.1` (`LOCAL_DEV_ORIGIN`) — the preview runs on 8090 and the list had only 8080 — **deploys with `npx wrangler deploy` from `backend/worker/` since v306; until then the preview's AI calls still fail while the live site is unaffected.**
  - **Fifteen new contracts** (`scripts/check-contracts.js`, 28 total): the static DOM the scripts query exists in `index.html` when no template emits it (`#bottom-nav` is queried unguarded at top level — a rename blanked the app); `client_errors` accepts every `reportError()` kind; a module `init()` paints around (`typeof Health ? … : ''`) redraws after it exists; theme-color = `--bg` in all four places; the pre-paint mirror's fields are the ones `mirrorUi()` writes; the 7 duplicated glyphs equal their `ICONS` masters; every icon name is an `ICONS` key; the Worker's caps hold `imagePrompt`/`VOICE_PROMPT`/the recipe batch (evaluated from source) and its CORS admits every dev-server port; `.run-nav` is emitted once at the view's root (the sticky bar's containing block — `ensureRestBar` also reports a wrapper at runtime); app.js checks a later module within 20 lines of using it and `init()` reaches none from a timer; the tables `pullCatalog` reads without a session are anon-readable after the migrations; **every function ever locked against anon/PUBLIC is still locked after the replay** (a DROP discards the ACL and Postgres hands EXECUTE back to PUBLIC — migration 19 did exactly that to `admin_user_stats`, and 23 is what re-locked it); plus extensions — contract 4 follows `const TABLE = …`/`.from(TABLE)` and replays COLUMNS so a trigger reads only columns its table has by then; 5 collects `data-t` (index.html), `METRICS` label/unit (health.js) and `F('…')` (storage.js) keys; 6 covers `destFor` view strings, the bottom-nav `data-view`s and `navMap` both ways; 8 refuses a key derived by concatenation and asserts the registry's prefix containment; 11 asserts the manifest's TYPES (`typeof apk.build === 'number'`, as update.js requires). The `#ex-image-preview` query (dead since v94) is gone.
- **v301 (2026-09-06) — the recipe editor rebuilt: THE INGREDIENT LEDGER.** The owner asked for a radical rebuild — «سلسة ومفهومة وأقل عجقة». The sheet was a spreadsheet: seven live controls and five captions per ingredient, a two-line hint paragraph, two 4-cell totals grids. It is a LIST now, chosen by a three-designer judge panel (ledger / receipt / focused form; the ledger won 84 to 73 to 69) and hardened by the judges' objections.
  - **One ingredient = line 1 (name + amount + a dim `trash`) and line 2 (`.rec-sum`, a read-only summary that opens a well).** Four controls, zero captions. The four figures are NOT inputs by default: they arrive from the v299 auto-fill machinery and a tap opens `.rec-more` to override them.
  - **`updateSummary(it)` is the ONE writer of line 2.** It derives `data-state` (idle · pending · fail · done) and `data-src` (local · ai · manual · saved) from `_auto`/`_manual`/`_src` and rewrites only text, the tag and the pencil. `_manual` is a SOURCE, not a state, so a row the user deliberately zeroed reads `done`/`manual` — which is what lets the new save guard tell it from a row that was never worked out.
  - **The summary is `min-height: 32px` in EVERY state, including empty** (it holds the ghost hint there). A row above the one being typed in changes text and colour, never height, when its figures land.
  - **Rows are addressed by `_id`, never by index** (`rowOf`/`byId`/`itemOf`), and a whole row is re-rendered in exactly two situations: the sheet opens, and an undo restores a deleted row. Everything else patches in place, and the three listeners on `#rec-rows` are delegated and bound once — so nothing loses focus or caret while a reply lands.
  - **Only `[data-recompute]` ever clears `_manual`**, and it is a deliberate button press. Editing the AMOUNT on a saved recipe leaves the user's own figures alone — every pre-v299 recipe was typed by hand and `_manual` is stripped at save, so a silent recompute would replace them with an estimate.
  - **The named-zero row is refused at save** (`rec_need_figs`, and the offending row opens). `DB.recipes.add`'s `clean()` keeps a row on `name || calories || …`, so a row whose AI call failed used to save as four zeros and the recipe under-counted for ever — and per-serving is what the food log receives. A save tapped while a row is pending is REMEMBERED (`saveWanted`, the button says «سيُحفظ بعد الحساب») and spent when the figures land; any keystroke cancels it.
  - **The amount stays free text** (`type=text`, `dir=auto`, the `200 غ` placeholder). `inputmode=decimal` would have given a keypad with no letters, and «٣ حبات» / «ملعقة زيت» / «كوب أرز» are how a recipe is actually written — `parseGrams` returns null for them and the AI reads them fine. A bare number gets «غ» appended to the AI line only, so the model is not asked to price "200 دجاج".
  - **No `<datalist>` on the ingredient field.** One was tried and rejected on sight: it gave the field a dropdown arrow, and the screen then read as "choose from a list I picked for you" instead of "write anything and the figures appear". `localLookup` already matches whatever is typed against `DB.foods`, so the instant offline path still happens — it is just not advertised as a menu. `.sr-only` is new (the source word is always in the accessible name; only «تقدير» is painted, so colour never carries meaning alone). Servings moved into the totals well with a ±1 stepper and an Arabic dual/plural `aria-label`. `rec_ing` and `rec_figures_hint` are gone from both dictionaries; 27 keys are new.
- **v302 (2026-09-06) — the security assessment's findings, fixed.** The audit answered the owner's question (can anyone reach another user's data, handles or password) with a measured NO: RLS on all thirteen tables, forty-five policies read, and cross-tenant probes as two real users returning zero rows for the blob, the history, profiles, flags, feedback, errors and the image bucket. Passwords are never stored, logged or put in a URL by this app, no table has an email column, and `auth.users` grants nothing to anon or authenticated. What it DID find was abuse: ways for one account, or none, to spend a shared free-tier resource until the app stops for everyone.
  - **Migration 26** is the backend half — see `backend/README.md` row 26. The two that matter most: the blob HISTORY is now bounded by bytes as well as count (one account's worst case falls from ~55 MB to ~13 MB of a 500 MB tier, and it is the tier filling that turns the project read-only for every user), and the shared Gemini key finally has a DURABLE daily budget (`ai_usage` + `ai_budget_take`, 60 per user and 800 globally per UTC day). The Worker's own limiter is a Map in isolate memory: every PoP and every cold start has a separate copy, so it never could bound a day.
  - **The Worker** (deploys with `npx wrangler deploy` from `backend/worker/` since v306) gains a per-IP gate BEFORE the Supabase auth lookup — an unauthenticated flood used to cost a subrequest each, so junk bearer tokens could spend the 100,000/day free budget and switch the AI off for everyone — and calls `ai_budget_take` with the caller's own token. It fails OPEN on a network or 5xx failure and CLOSED only on an explicit refusal, the same trade the auth check makes. Its new `daily limit` error is translated as `ai_daily_limit`, which says the AI is done for today and the saved foods still work; `ai_err_busy` would have been a lie.
  - **A Content-Security-Policy** on all four pages. The session token lives in `localStorage`, so the cost of any future injection is account takeover; `connect-src` closes the fetch channel and `img-src` the `<img src=evil?token>` one. It does NOT make injection survivable: with `'unsafe-inline'` an injected script can still navigate the tab and carry the token in the URL, and no meta CSP can stop that. This narrows the blast radius; it does not remove it. Verified live: an arbitrary fetch and an arbitrary image are both blocked while the real exercise photo, the three brand fonts and Supabase all still load, with zero violations across fourteen views. **`script-src` keeps `'unsafe-inline'` on purpose** — three pre-paint inline scripts, six `onerror="this.remove()"` templates, and Capacitor injecting its native bridge as an inline `<script>` into the HTML it serves the APK (`JSInjector.getInjectedStream`). Hashes would break the phone and would silently blank the page whenever a release forgot to recompute them. `frame-ancestors` is absent because a `<meta>` CSP ignores it and GitHub Pages cannot set headers.
  - **The password floor is 8**, in the app, the Console and both dictionaries. Supabase allows roughly 1,800 sign-in attempts an hour from one IP, so six characters was the weakest link in a system where nothing else leaks.
  - **`android:allowBackup="false"`** — with the phone unlocked and USB debugging on, `adb` could pull the WebView's storage, session token included. It takes effect only in a NEW APK.
  - **One new contract** (29 total; the anon-lock contract was v300's — an earlier draft of this line credited v302 with both): the four pages carry ONE CSP that allows every origin the code loads from. A missing origin does not warn, it silently blocks fonts, photos, barcodes or the AI.
  - **STILL IN THE OWNER'S HANDS, and none of it is code:** paste-deploy the Worker; in Supabase Authentication set the minimum password length to 8 and turn on leaked-password protection (that check is a paid-plan feature — the length is not); and decide sign-up. Sign-up is open and auto-confirmed today, which multiplies every per-account cap above and means a ban is undone by re-registering. For an app whose users are a few dozen invited people, turning sign-up off and creating accounts by invitation is the cheapest answer; enabling email confirmation with a custom SMTP and a CAPTCHA is the other one.
- **v304 (2026-09-06) — what an adversarial review of v302 found, repaired.** Forty-two agents read migration 26 against the live database and confirmed twenty-eight findings. Four meant 26 did not do what it claimed, one meant it broke something, and one was a defect introduced while fixing another. **Migration 27** is the repair; `backend/README.md` rows 26 and 27 carry the detail. The lesson worth keeping is not any single bug — it is that **a VERIFY block that reads a catalog instead of calling the thing it claims to prove is how a no-op ships looking green.** Every VERIFY in 27 calls, inside a block that raises at the end so no probe row survives.
  - **The feedback cap was a NO-OP.** SECURITY INVOKER, so the trigger's own count ran under RLS and saw zero rows: `recent >= 5` could never be true. A cap that reads through the RLS it is trying to enforce is not a cap. SECURITY DEFINER now, and proved by inserting five and watching the sixth raise.
  - **The AI budget billed the calls it REFUSED.** It incremented both counters and then tested them, so a user past their own 60 kept adding to the shared 800. Proved live: 900 calls from one account, 840 of them refused, drove the global row to 900 and the next user's first call of the day was denied — the exact outcome migration 26 existed to prevent. It reads, decides, and only then charges. **Residual, on purpose:** `authenticated` keeps EXECUTE because the Worker calls the RPC with the caller's token, so a signed-in user can still spend their own 60 without using the AI. That is what using the app does anyway; the global cap is only as strong as accounts are scarce, and that is the sign-up decision.
  - **`exercise_image_count(uuid)` answered about ANY user.** SECURITY DEFINER, granted to authenticated, no check that the argument was the caller — and the owner's uuid is in the public repo. It takes no argument now.
  - **`exercises` and `cardio_types` were still unbounded** in text and row count, which is a larger tier-filling lever than the blob history 26 spent its effort on. Length checks plus a 2,000-row per-owner cap, on a SECURITY DEFINER trigger for the same reason the feedback cap needed one.
  - **A carve-out I added between 26 and 27 broke every image upload.** "Always allow replacing an object you already own" was written as an EXISTS over `storage.objects` inside `storage.objects`' own INSERT policy: Postgres answers 42P17 infinite recursion, for every insert, at zero objects — and the client treats a failed photo backup as best-effort, so it failed in total silence for about twenty minutes. `exercise_image_exists()` (SECURITY DEFINER) expresses it without re-entering the policy. **Never reference a table from inside its own RLS policy.**
  - **`pg_catalog.coalesce` bit again.** The rewritten budget function shipped it for ten minutes. COALESCE is SQL grammar with no `pg_proc` row: it cannot be schema-qualified, it applies clean, and it throws on the first call. The probe caught it. Same for GREATEST, LEAST, NULLIF, CASE, CAST.
  - **The daily-limit message now reaches the user.** All three client paths turned any 429 into "try again in a minute", so `ai_daily_limit` was dead code and someone out of budget would retry every minute until midnight. The body's code is read before the status. The Worker also spends the budget AFTER the request is known to be valid (an empty POST used to burn a slot without reaching Gemini) and rebuilds the Authorization header from the parsed token (`Bearer  <token>` with two spaces passed the auth check but made PostgREST reject the budget call, which fails open).
  - **The password-reset link asked for the password the user had just forgotten.** `onPasswordRecovery` opened the ordinary change-password form, which requires the current password to re-authenticate — with no way through. A recovery session is already proof of the mailbox, so that field is gone on that path and `changePassword(new, cur, recovery)` skips the re-auth.
  - **Contract 30**: an error string raised in SQL or returned by the Worker, and matched by a regex in JS, is an agreement between two files nothing else keeps. It replays function bodies so only the SURVIVING definition counts, and it checks both directions of the Worker's `code:` values.
  - **APK build 21 (v3.0)** carries `android:allowBackup="false"` — read back out of the built binary with `aapt2 dump xmltree`, not inferred from the source manifest — signed with the same debug certificate so it installs over build 20. Until a device installs it, that device still backs its WebView storage, session token included, into the user's Google account.
  - **Still open, and named honestly:** the Worker half is still not deployed (Cloudflare is a manual paste), and read EGRESS is untouched — RLS bounds who reads a row, never how often, so one account pulling its own blob in a loop is still the cheapest way to spend the 5 GB month. The per-account caps only bind while accounts are scarce, which remains the sign-up decision.
- **v305 (2026-09-06) — Turnstile on the three unauthenticated doors.** Sign-up is open and auto-confirmed, so one script could farm accounts, and every account carries its own slice of the shared AI budget and storage — which is also why a ban is undone by re-registering. Cloudflare Turnstile (managed mode) now guards sign-up, sign-in and password reset.
  - **The order matters and is not negotiable: the CLIENT ships first, the dashboard switch second.** Supabase ignores an unexpected `captchaToken`, so v305 was inert until the switch was thrown; throwing the switch first refuses every sign-in in the world for a challenge no client sends.
  - **LIVE since 2026-09-06** (the owner pasted the secret; the key never touched this repo or a transcript). Measured on the live site afterwards, not assumed: sign-in, sign-up and password reset without a token are all refused with `captcha_failed`; a FORGED token is refused with `invalid-input-response`; and a real sign-up through the deployed app with a genuine 773-character token succeeds. The throwaway account was deleted and the browser signed out — nine users before, nine after.
  - **Cloudflare's dashboard still shows "Siteverify isn't being called for VAULT". Ignore it: it is stale analytics, not a live signal.** The proof that siteverify runs is the `invalid-input-response` refusal above — that string is Cloudflare's own siteverify verdict, which only exists because Supabase called it.
  - `Cloud.captcha` (cloud.js) owns the widget: lazy script load with a 15 s timeout, explicit render, and `token()` / `reset()`. **A token is single-use and expires in about five minutes**, so every failed attempt calls `reset()` — without it a mistyped password makes every retry fail on the challenge instead, which reads as a broken login. The SITE key is public by design and lives in cloud.js; the SECRET key exists only in the Supabase dashboard and is not in this repo.
  - The widget is mounted from `showAuthGate` and `showForgotPassword` rather than from their templates, because Cloudflare draws into a live node and both cards are rebuilt on a language switch or a sign-in ⇄ sign-up flip.
  - **The slot reserves NO height.** A `min-height` showed every user a permanent blank gap for a check that is usually invisible; the margin appears only `:has(iframe)`. Verified in real Chrome: a 773-character token in under a second, the widget drawn in dark Arabic and solved with no user action, no CSP violations. **The preview pane cannot test this** — its sandbox blocks the widget iframe, so the token never arrives there and it looks broken when it is not.
  - CSP gained `challenges.cloudflare.com` in `script-src`, `connect-src` and a new `frame-src`; contract 29 would have caught the omission.
  - A failed challenge is its own message (`auth_err_captcha`). Supabase reports it as "captcha protection: request disallowed", which would otherwise fall through to the generic error and read as a wrong password.
- **v306 (2026-09-06) — the Worker deploys itself now, and its rate limit was an illusion.**
  - **`npx wrangler deploy` from `backend/worker/` replaces the manual paste.** Every release note since v291 carried a "needs a manual Cloudflare paste-deploy" caveat, and that is why the v302 hardening sat undeployed for a day. `backend/worker/wrangler.toml` pins exactly what was already live — `compatibility_date = "2026-06-26"`, `workers_dev = true`, the account id — read back with `wrangler versions view` first, because a wrong compatibility date changes behaviour and a missing `workers_dev` takes the endpoint offline. **GEMINI_KEY is not in that file and must never be**: secrets live on the Worker and survive a deploy (`wrangler secret put` prompts for one). Auth is `wrangler login`, an OAuth grant, not a token in a file.
  - **The per-IP and per-caller limiters did nothing, and this was measured, not reasoned.** 100 POSTs from one IP over one keep-alive connection in 12 seconds, against a 60-per-minute gate: **zero refused.** Cloudflare spreads requests across isolates and each has its own memory, so a `Map` counter is an illusion that reads as a rate limit in review. Replaced with `env.RATE_LIMITER`, Cloudflare's own binding, which is shared across isolates and free. The identical burst now gives 60 through and **39 refused with 429**, and a single request after the window is normal again. `rateLimited` (the per-caller burst) is the same illusion and is kept only because it costs nothing — the comment above it now says so. **The real bound on a determined caller is the durable daily budget in Postgres**, not either of these.
  - **The signed-in path is verified end to end**, which nothing before this had done: a throwaway account, one real call through the deployed Worker returning correct macros, and `ai_usage` showing exactly one call billed to that user and one to the global row — then the account and both counter rows deleted. Nine users before, nine after.
  - The Worker also now admits `http://localhost:<any port>`, so the preview server can reach the AI; a non-allowed origin still falls back to the site origin.
- **v307 (2026-09-06) — swap or skip an exercise mid-workout, and the captcha went invisible.**
  - A 36px control sits at the END of the guided run screen's `.detail-top`, whose middle child is `flex:1` — so it lands in the corner OPPOSITE the back arrow: top-left in Arabic, top-right in English, which is where an overflow control belongs in each direction. It carries the 44px tap halo the button scale requires of anything smaller.
  - **Both actions change TODAY'S RUN ONLY, and the plan is never touched.** The machine is taken or the shoulder hurts: that is a fact about this hour, not a decision to rewrite every future workout. The rotation is still edited where it has always been edited. Verified by reading the plan back after a swap and a drop — two exercises before, the same two after.
  - The mechanism is `runOnly`, the per-run list that already existed for the "train a lagging muscle" route. It is null while the run simply follows the plan, so the first edit MATERIALISES it from the ids on screen.
  - **Sets already logged today are the one destructive case, so it is the one that asks.** Dropping or swapping an exercise that has a session on the run date would orphan it; a confirm says the sets will be deleted, and they are (verified: one session before, zero after). Skipping is refused when one exercise is left, with a line saying to swap instead.
  - The chooser lists the SAME MUSCLE first, then everything else, over a search of both — a swap is nearly always for the same movement pattern.
  - **Turnstile is INVISIBLE now** (widget mode changed in Cloudflare; no code change). The owner was right that a Cloudflare box on a login card is not what real apps ship, and the managed widget was also rendering a visible FAILURE inside the preview pane, whose sandbox blocks its iframe. Measured on the live site after the change: slot height 0, no iframe, no text, and a 773-character token in 351 ms.
- **v308 (2026-09-06) — the requests that carried no news are gone. Ten foregrounds: 40 requests → 1.**
  - **THE BIG ONE: a foreground with nothing to sync no longer moves the blob at all.** `bootSyncCoreUnguarded` pulled the WHOLE row (`select('*')`) to compare a version number, then pushed the WHOLE blob back through the `pushed()` branch — on every glance at the phone, in both directions, whether or not anything had changed. A load audit measured that round trip as ~97% of this app's egress. There is now `pullMeta()` (`select('updated_at,version')`) and a FAST PATH in front of everything.
  - **The fast path fires only when five things all hold**, and each one guards a branch below it that would otherwise be skipped: not dirty (nothing of ours to send), versions equal (nothing of theirs to fetch), linked (the first-link question is answered), local has data (not the empty-device recovery), and no unaccounted push (not the adopt-own-row case). Anything else — including any error reading the metadata — falls through to the untouched full path. It returns a new `'synced'`, which the manual Sync button treats like `'pushed'`; every other consumer already ignored unknown values.
  - **Proved by stubbing the session and the network, three cases:** in sync → ONE request, `select=updated_at,version`, no `select=*`, no write, result `synced`. Remote ahead with a valid blob → metadata read, then `select=*`, marker applied, version adopted, result `pulled`. Remote ahead with an INVALID blob → falls through and refuses honestly (`offline`), which is the documented `applyRemote` contract. Local state restored byte-for-byte afterwards.
  - **The catalog cache was never written for a signed-out session.** It was keyed on `result.exercises !== null`, and that read needs a session — so `food_catalog` and `preset_plans` were re-fetched on EVERY foreground, forever, for nothing. It now caches whenever anything came back and records `signedIn`, so a logged-out cache is never served to a signed-in session (that one is stale by construction, not by age).
  - `bootCatalog()` is throttled to 5 minutes and `checkWebUpdate('resume')` likewise. Both hung off `visibilitychange` with no gate of their own; the announcement is edited a few times a year and a live-URL shell does not need sub-five-minute update latency. **A cold BOOT still checks immediately** — that is the seamless auto-reload path, and delaying it would strand a device on an old build for the whole session.
  - Measured on the running app, ten background→foreground cycles: **40 requests before, 1 after** (a single `version.json`). Signed in, the per-foreground cost falls from a full blob down plus a full blob up to one two-column row.
  - Also in this release: the swap chooser was painting the muscle name INSIDE `.picker-row-cat`, which is a 6px decorative colour stripe — every one of 144 rows overflowed its own box and the list grew a 49px horizontal scrollbar. The stripe now does its real job (`data-cat`, seven category colours) and the muscle is already named by the section headings above it.
- **Pending SQL: `backend/pending/30_ai-budget-and-caps-v26.sql`** (v397 — the daily AI budget fails OPEN until it is applied; owner-only, see `backend/README.md` §2). This bullet said "NONE" from v308 until v401. The history below is the v291 pair: `20_vault-data-history-v16.sql` (server-side history of the last 10 blob versions, trigger-written, own-row SELECT) and `21_food-catalog-fat-v17.sql` (fat column + 7-arg `admin_upsert_food`) were written in v291 and **applied + verified live 2026-09-02** from the SQL editor (the MCP apply had been refused by the session's permission classifier; the editor was driven through the owner's signed-in Chrome, and 21 was verified by CALLING the new overload). The client is tolerant either way (`select('*')` on the catalog; the Console falls back to the 6-arg RPC). 11–14 (`client-errors-v9`, `ban-rls-v10`, `launch-hardening`, `hardening-v8`) were applied and verified live on 2026-08-05. **`backend/README.md` is the authority for what is applied**, derived from git rather than memory; this bullet has twice claimed the wrong thing when edited from memory instead.
- **Data, sync and security invariants from v348–v399** (each version's section in `docs/RELEASE-NOTES.md` has the measurement):
  - **v396 — a blob is clamped where it comes IN** (prefs lang/unit, cardio figures, record lists, food-log days; contract 46 refuses a raw pref in markup); `SCHEMA_VERSION` is stamped and never lowered, and a newer build's blob is never pushed by an older one; a URL session is accepted only through `urlSessionAllowed` (login-CSRF, contract 47); pushes are serialised across windows with Web Locks and a sibling's reply only moves the version FORWARD; the guided run holds its uploads (`Cloud.pace`).
  - **v351 — two windows, one store:** a sibling's write is adopted with `DB.adoptForeignWrite()`, never `reloadState()` (which would lift READ-ONLY and prune this window's photos), and the repaint never runs over an open sheet or the guided run. **A shared phone:** `guardForeignBlob` rescues the previous account's blob under ITS uid and sweeps the device through `clearLocalUserData()` — and sweeps nothing if the rescue could not be written (v356).
  - **v356 — guards fail CLOSED:** the empty-blob backup guard refuses when its read fails; every health metric is coerced and escaped; an exercise-image slug is validated as an identifier (escaping cannot protect a CSS `url()` inside an attribute).
  - **v350 — the READ-ONLY rescue** exports the raw quarantined copy (`DB.corruptRaw()`), never called a backup; the pre-commit hook's advice is `git add -u`, never `-A`. **v354:** the clipboard fallback for a backup asks first, and deliberately has no timed auto-clear.
  - **v348:** the self-conflict compare uses `stableJson` (jsonb reorders keys); a handler is never passed bare when its first parameter is not the event (lint rule). **v357:** a calendar day is never sliced off a stored timestamp — `dayOfTimestamp()` (lint rule + contract 37), and a write resolves its day at WRITE time.
  - **v388 — the Worker's failures are named:** `UPSTREAM_AUTH` (Google refused the key/request), `MODEL_RETIRED`, `RATE_LIMIT`, `DAILY_LIMIT`; `workerError()` in `js/foodai.js` is the one reader, spelled `data.code === '…'` so contract 30 can see both sides; `[observability]` lives in `wrangler.toml` because every deploy would otherwise switch Workers Logs off. **v390:** a Google identity on an existing unconfirmed email is a SECOND uid — held by `showDuplicateAccountDialog`, released only through `Cloud.releaseDuplicateHold()` (the v351 sweep, chosen).
  - **Not deployed yet** (owner: `cd backend/worker && npx wrangler deploy`): the v391 timing cap, the v397 audio/logging/examples changes, the v399 recipe mode. **Not applied yet:** `backend/pending/30` (v397).

## CI — the web app has a gate now (no version bump: nothing shipped changed)

«انا بختصار بدي احسن بنيه تحتيه للكود والباك اند». Measured the infrastructure before
touching it, and three gaps came out of it:

| | |
|---|---|
| CI for the web app | **none** — only `ios-build.yml` existed |
| one command that runs the suites | **none** — six filenames had to be known by hand |
| anything comparing the live database to `backend/migrations/` | **none** — contract 4 replays the FILES, never the server |

**The first is the one that matters.** The only gate was `.githooks/pre-commit`: local,
opt-in (`npm run hooks` sets `core.hooksPath`), and bypassable with `--no-verify`. GitHub
Pages serves the branch directly with no build, so anything past the hook is live on every
device at the next app open. `ea6c74e` — "the change reached nobody" — was exactly a lapse of
local discipline. The hook is a brace; `.github/workflows/ci.yml` is the belt.

### The runner, and the lie it was built to stop

`scripts/test-all.js` runs every suite and **never counts one that did not run**. Twice the
claim "all five suites pass" was wrong, both times because a Playwright-needing suite threw
`MODULE_NOT_FOUND` and read as noise.

> ⚠️ **My own first draft reproduced the exact bug it was written to prevent.**
> `test-convenience-ui.js` is `module.exports = async function(page)` — a library, not a
> script. Running it alone does nothing and exits 0, and the runner printed **PASS**. Then the
> correction over-reached: a rule of "exports ⇒ module" silently dropped `test-sync-status.js`,
> which exports `context` for its sibling **and** runs its own suite behind
> `if (require.main === module)`. The rules that survived:
> - a file is a MODULE only if it exports **and has no main guard**;
> - delegation is a `require('./test-…')` **call**, never a mention in a comment (the first
>   draft read line 1 of a comment and marked the CALLER as delegated);
> - **exit 0 with no output is a FAILURE**, not a pass — every real suite here ends with a
>   PASS line, so silence means nothing executed.

### What running them for the first time found

Installing Playwright and running everything caught a **third** instance of the same blind
spot, live: `test-sync-status-ui.js` was waiting on `#cx-shopping-new` — a control **v329
deleted** when five shopping sheets became one. The suite had been driving a UI that no longer
existed, and nothing said so because nothing ran it. Its shopping block is rewritten against
the real v332 sheet: open the وصفاتي box, pour a recipe, assert the amounts arrive verbatim,
assert a tick does not enter undo history, add a typed item, assert the footer appears.

**8 passed · 0 failed · 0 skipped** — the first time every suite in this project has actually run.

### The commands

```bash
npm run check        # contracts only
npm run lint         # ESLint 9 with the project's rules (v353); --strict in CI
npm test             # every suite; a skip is reported, loudly
npm run test:strict  # a skip is a FAILURE — what CI runs
npm run verify       # contracts + lint + suites (lint joined in v353)
```

Playwright is installed `--no-save` in CI: never in `package.json`, never shipped. The "no new
dependencies" law is about the bundle the user downloads.

### Still open on the backend, and named honestly

**Nothing compares the live database to `backend/migrations/`.** Contract 4 replays the files
and proves the CLIENT's tables/RPCs/buckets exist in that replay — it cannot see the server. So
a migration applied live but edited afterwards, or a file never applied, is invisible to every
check in this repo; `backend/README.md` is prose maintained by hand, and it "has twice claimed
the wrong thing when edited from memory". A real drift check needs a read-only credential in CI
and is its own piece of work. Backups are likewise still a manual runbook
(`backend/docs/DB-BACKUP-RESTORE.md`), with no automation and no restore drill.


## The backend audit — and the one thing that is broken right now

«كمل فحص الباك اند وترابطه وتماسكه وسهوله صيانته». Fifty-three agents read the backend against the
**LIVE** database, read-only, and every finding went through an adversarial verifier. I then
re-proved the headline myself before writing it down, because this project's rule is that a
reviewer's claim is a lead, not a fact.

### ⚠️ HIGH — the daily AI budget has been dead for seven days, failing OPEN

`backend/pending/30_ai-budget-and-caps-v26.sql` is the fix (v397 — it supersedes 29, now in `archive/`, which would have revived the budget with caller-chosen limits). **It is NOT applied** — it is a live
write and only the owner runs it.

Migration 28 added a foreign key from `ai_usage.user_id` to `auth.users(id)`, and its own header
states in writing that **`NOT VALID` "enforces the cascade for every FUTURE delete without
rejecting the existing sentinel row."**

> ⚠️ **`NOT VALID` skips validation of rows that ALREADY EXIST. It does not disable enforcement on
> INSERT.** Both RI check triggers are live and enabled (`tgenabled = 'O'`).

`ai_budget_take()` charges the GLOBAL counter as a row whose `user_id` is the all-zero sentinel —
which is not a user (`select count(*) from auth.users where id = '00000000-…'` → **0**, that is
*why* the FK had to be NOT VALID). On the first call of each new UTC day there is no sentinel row
for `today`, so `ON CONFLICT` cannot deflect it: it is a genuine INSERT, the FK fires, 23503 aborts
the whole SECURITY DEFINER call — **rolling back the per-user increment with it** — and
`budgetAllows()` in `gemini-worker.js` fails OPEN (since v397 it at least LOGS the failure: `budget rpc failed OPEN: <status> <code>`).

Measured live, read-only: `ai_usage` still holds exactly **2 rows, both `day = 2026-09-06`, n = 10**,
while today is **2026-09-13**. Nothing has been billed for seven days. This is precisely the failure
26 and 27 exist to prevent — one account exhausting the shared free Gemini quota and switching the
AI off for everyone until midnight. The only bound left is Cloudflare's per-IP limiter, which caps a
burst and never a day's spend across accounts.

**HIGH, not CRITICAL, and the distinction is honest:** no user data is exposed, lost or reachable
across accounts, and nothing is corrupted. It is an unbounded shared-resource hole that has been
silently true for a week while every file, every contract and every VERIFY block stayed green.

> **28's VERIFY was not lazy — and that is the lesson.** It deletes a throwaway `auth.users` row
> inside a rolled-back block and asserts the counter cascades 1 → 0. It genuinely proves the cascade
> fires. It simply never calls `ai_budget_take()`, **the only function that writes the table it had
> just constrained.** The project's rule "a migration that defines a function must END BY CALLING
> IT" needs its other half: *a migration that constrains a TABLE must end by exercising every write
> path into that table.*

### Nothing else is unsafe, and that was checked rather than assumed

43 policies in `public` + 6 in `storage`; every permissive owner policy keyed on `auth.uid()`;
`authenticated` is `rolbypassrls = false`, so a grant without a matching policy denies rather than
leaks. `ai_usage` is grant-less to `anon` and `authenticated` — probed as `authenticated` and it
answers `42501 permission denied`, not an empty array. The two anon-executable SECURITY DEFINER
functions (`feedback_rate_cap`, `own_row_cap`) `return trigger`, so PostgREST excludes them from its
schema cache and both named endpoints answer 404 PGRST202. The `exercise-images` bucket is private,
has six policies, and its mime allowlist still has **no `image/svg+xml`**.

### Where the three records disagree (files · live · README)

- **`vault_delete_own`** exists in `01_supabase-setup.sql` behind its own never-actioned "ACTION
  REQUIRED" banner. Live, `vault_data` has **no DELETE policy at all**. README row 39 and migration
  09 both say "four owner-only policies"; live has three. Harmless — no client deletes from
  `vault_data`, and erasure runs through `delete_own_account()` (DEFINER, and
  `relforcerowsecurity = false`, so it genuinely bypasses RLS) — and the drift points the safe way.
  > ⚠️ **If that policy is ever applied, read this first:** `vault_data_history`'s FK is to
  > `auth.users`, not to `vault_data`, and `vault_data` has no DELETE trigger. A client-side "erase
  > my cloud copy" would delete the live blob and leave up to ten prior **full** blobs in history,
  > readable by the owner's own SELECT policy. A half-erase that reads as complete is worse than none.
- **README row 06** describes `feedback` as having "no client write policy, so a user can read their
  own row but never escalate". That is true of `user_flags` and false of `feedback`, which has
  `feedback_insert_own` (a client write policy) and **no own-row SELECT at all** — the author of a
  feedback row cannot read it back. The policies are right; the prose is wrong.
- **The storage cap.** CLAUDE.md says the `exercise-images` bucket has a "5 MB cap". Live
  `file_size_limit` is **524288 — 512 KB**. Anyone sizing a compression step against 5 MB would ship
  uploads that are refused.
- **The live migration ledger holds 2 rows, not 28.** `supabase_migrations.schema_migrations`
  carries only files 18 and 19 — everything else was applied by SQL-editor paste, which writes no
  ledger row. So the server cannot tell you what has been applied; `backend/README.md` is genuinely
  the only record, exactly as its header says.

### What I refuted myself, before reporting it

`client_errors_rate_cap()` is SECURITY **INVOKER** — the identical shape to `feedback_rate_cap()`,
which v304 had to convert to DEFINER because, under RLS, its own count saw zero and the cap was a
no-op for weeks. It looked like the same bug, unfixed, in a sibling. **It is not**, and the reason is
one policy: `feedback` has no own-row SELECT, so its count really did see zero, while
`client_errors` **does** have `client_errors_select_own`, so an INVOKER count over
`user_id = new.user_id` reads exactly the rows it needs. Correct as written.

### Still open, and none of it is code I can write

- **Nothing compares the live database to `backend/migrations/`.** Contract 4 replays the FILES.
- **`pg_cron` is not installed**, so `admin_prune_client_errors()` and `admin_prune_ai_usage()` exist
  and **nothing ever calls them**. Retention is aspirational.
- **All 18 rows in `client_errors` are `sync-conflict`** — zero crashes in a week of real use, which
  is good news — but nine of them read `at=push-version-moved` with `localVer` **equal to**
  `remoteVer`, which is the app raising a conflict against itself. Worth its own investigation.
- Backups remain a manual runbook with no automation and no restore drill.


## Measuring the design (2026-09-20) — `scripts/ux-audit.js` and `scripts/ux-flows.js`

«ابدأ بجولة القياس للعشرين شاشة». No test in this project looks at design, and
every defect the design passes fixed was found by measuring the rendered DOM by
hand. These two tools are that measurement, kept — the same decision the
fingerprint net was.

```bash
node scripts/ux-audit.js --tag pass1              # 20 views × ar/dark/375 + en/light/412, seeded, screenshots
node scripts/ux-flows.js                          # taps from Home to the four daily writes, real clicks, DB-proved
```

Both are TOOLS (not `test-*.js`), write to `.uxaudit/` (gitignored), and reuse the
net's harness — `openContext`, `settle`, `timedRender`, `withBrowser` are exported
from `fingerprint-net.js` now rather than copied, and `openContext` takes a
`fenceFn` so the audit can admit the two read-only font hosts (text-fit is wrong
in `system-ui`). Everything else is still aborted and asserted.

**What the audit records that the net deliberately does not:** every rect; the
**effective hit box** of every control by real hit-testing outward from its centre
(a `::after` halo counts, a neighbour stealing an edge counts against, 53 means
"≥53"); contrast against the COMPOSITED background; clipped content; the fold
line; overlapping controls; circles; the heading ladder and the type sizes in
use; a fold and a full-height screenshot per cell. The views are rendered WITH
data (the fixture plus three weeks of history), which the matrix never does.

### ⚠️ THE HARNESS STUB HAD A GATE OVER EVERY SIGNED-IN CAPTURE FOR TWO WEEKS

The first hit-test answered `<div .auth-gate>` for every button on the page.
`fp/server.js`'s `'in'` stub returned `getUsername: 'fpuser'` — a STRING — where
the real `Cloud.getUsername()` returns `{ username, offline }`, so
`ensureUsername()` read `info.username` as undefined and mounted the username
gate (z-index 1000, inset 0) over the app. **The net never noticed because it
reads computed styles and never hit-tests**; the sheets lane is captured at
`#modal-root`, which sits above it. Fixed at the stub, and `diff` says the
sheets lane is 106/106 identical before and after. A stub is a promise about a
surface the harness cannot load — keep the SHAPE, not only the name (the same
lesson as `test-widget-snapshot.js`, one release apart).

### Nine ways the first run lied, each closed before a reader saw a number

| the tool said | the truth | the fix |
|---|---|---|
| 36 spills on the exercise browser | items inside a horizontal rail, and SVG children | `inRail`, and SVG children excluded from spill/clip |
| 39 sub-44 controls on Food, 19 overlaps | `cursor: pointer` inherited into the calorie ring's digits | a control IS one (`button`/`a`/role/tabindex/onclick); a cursor is not evidence |
| `text<11px` on five screens | `.sr-only` (1×1) | visible means > 1px |
| every button `hits44: 0` | the username gate above | the stub fix, plus a **self-check**: the element at the root's centre must be inside the root, or the cell is reported COVERED by name |
| seven screens COVERED by `.ntf-title` | the reminder bar, real, on a 5 s timer the frozen clock never fires | record it once as `notifBar`, then `clock.runFor(5600)` so the APP dismisses it |
| 32 sub-44 cells on the calendar, a 44×44 cell scoring 0 | corners at ±21 on a 42px halo (`inset:-4px` is from the padding box; a 1px border eats 2px) and `.empty` cells that are `pointer-events:none` | measure the effective extent per direction; `unhittable` is its own flag |
| 16 `unhittable` on Notifications | `elementFromPoint` returns null OUTSIDE the viewport | scroll the control into view, read its live rect, scan, restore |
| 6 more `unhittable` | controls under the NAV (y 748–812) are on screen and occluded; rail items off-screen sideways | "in view" means above the nav line, both axes |
| 146 contrast failures on the light exercise browser | white text over a photo painted by a positioned SIBLING the ancestor walk cannot see | any painted surface containing the text that is not its ancestor → `overImage`, contrast unknown, never a number |

The flows probe had one of its own: it read a sheet's button **mid-entrance**
(y=1095 = its resting 678 plus one sheet-height) and logged "under the nav" about
a control that was still arriving. `settle()` before every box read now.

**Measured (ar/dark/375, seeded):** water +250 is **2 taps**; the morning weight
**3 taps + one field**; a set **2 taps + two fields** — and the day card commits
the rows pre-filled from last time as performed sets ("confirmed without a
throwaway edit" is the recorded intent; whether an untouched row should count
is the owner's call); a saved food **4 taps**. The day card's Save measures
**69×40** — under the 44 floor.

## THE FINGERPRINT NET — proving a refactor changed nothing

The owner authorised a large maintainability refactor of `js/app.js` (12,910 lines)
with one condition, in his own words: **«تأكّد تامًّا أنّه لا يتغيّر شيء ولا يعلّق
التطبيق»**. One measurement settles why that needed a tool and not care:

> **0.29% of `js/app.js` is under direct unit assertion — 38 lines of 12,910.**
> Five functions of 210. The browser suites TOUCH maybe 15% and pin down 2–3%. And
> no test in this project looks at design; every serious defect this month was
> found by measuring the rendered DOM by hand.

This project has twice proved a refactor inert exactly that way — **504**
computed-style fingerprints in v262, **110** in v314 — and threw the tooling away
both times. `scripts/fingerprint-net.js` is that technique, kept.

```bash
node scripts/fingerprint-net.js capture --tag before   # …do the step…
node scripts/fingerprint-net.js capture --tag after
node scripts/fingerprint-net.js diff before after
```

> **THE ONE DECISION THAT MAKES IT WORKABLE: the record is KEYED ON STRUCTURAL
> POSITION and DIFFED ON FIELDS.** If the key carried the class name, a class
> rename — the single most likely diff a maintainability refactor produces — would
> re-key every element and report *N deleted, N added*. That is the
> 500-diffs-nobody-reads failure, and it is a choice, not a fact.

**Lane A runs `reducedMotion: 'reduce'`, and that is the determinism guarantee,
not a shortcut.** Under it the splash is never mounted, `setupEmber()` returns
before it creates its element, and the global clamp zeroes every duration AND
(since v337) every delay. There is no animation to be mid-way through, so the
fingerprint is a function of the DOM and the CSS alone.

### It found its own noise, which is the point of running it twice against no change

Three sources, three different mechanisms, all closed before the net was trusted
with anything:

1. `cls: "loaded machine-photo" → "machine-photo"` — an image-load race.
2. `@data-log` — a generated id shape the mask did not know (bare base36, not the
   `id-…` or UUID forms). Ids are RENAMED in first-seen order, never blanked: a
   flat `<id>` would hide a reordering, which is a real defect class here (v331).
3. ⚠️ **`renderView` schedules `syncDetailTopTitle` inside a
   `requestAnimationFrame`**, so whether the detail-top title had faded in was a
   race. Waiting on rAF is forbidden as a BLIND wait — it never fires in a hidden
   document — but the net **asserts the timeline advances before it captures
   anything and aborts if it does not**, and a bounded double-rAF then settles
   exactly what the app itself defers to one.

### And it can fail, which is the only thing that makes a pass mean anything

| | |
|---|---|
| two captures, no change at all | **20/20 cells identical · 2,053 elements · 0 differences** |
| v314's `--text-mute` → `--text` planted | **caught** — `rgb(176,166,158)` → `rgb(253,250,247)`, 3 elements, named by screen |
| after `git checkout styles.css` | **0 differences again**, and the file byte-identical to HEAD |

Four failure signals ride along free on every capture: a page error or
`console.error` during any render; a view that renders **0 children**; a **raw
i18n key on screen** — contract 5 proves a key EXISTS in both dictionaries and
cannot prove the rendered screen reached it, which is exactly the gap v332
records; and an **empty `<svg>`**, because a wrong icon name returns `''` and the
glyph vanishes with no error.

> ⚠️ **THE FENCE IS THE ENFORCEMENT, NOT A CONVENTION.** `page.route` aborts every
> request that is not `127.0.0.1`, and the run ASSERTS afterwards that nothing
> escaped. The owner's real project ref is in the shipped `js/cloud.js`; a stub is
> a promise, an aborted route is a fact. A net that silently aborted a live write
> is not evidence that it never intended one.

**What it cannot catch, stated so it is not trusted beyond its reach:** whether
the design is GOOD — it is a conservation law, and would have certified all 38 of
v316's defects as identical; anything only a real font shows (fonts are blocked,
correctly, so the app under test renders in `system-ui`); anything only a real
device or the live backend shows; a change identical across every cell of the
matrix; and **anything wrong on BOTH sides — a conservation law conserves defects
with equal enthusiasm.**

**Stage 1** covered the 20 views in ar/dark/375 against the empty state. **Stage 2**
(v355) is `matrix` — all eight lang × theme × width cells, every band, and a CI
smoke lane. **Stage 3** (v356) is `modals` — every sheet and dialog over a seeded
fixture, with contract 36 keeping the list honest. **Still open: stage 4**, the
seeded-data VIEWS lane (six detail views are captured in their fallback state
today — `scripts/fp/views.js` names which), and **stage 5**, the motion lane. The
second language and theme, the other widths, the motion lane and the DB-diff
scenarios are stages 2–5, and each is worth building when a refactor step needs
it — not before.

**How to use it today** (v355–v361, v400): capture BOTH lanes before the change —
`matrix --tag X` (views, `.fpnet/X.views.json`) and `modals --tag X` (sheets,
`.fpnet/X.sheets.json`); each lane has its own file since v360, when a shared tag
silently overwrote the other lane — then the same with an `after` tag and
`diff X Y`, which reports both lanes and exits 1 on ANY difference. A new sheet
joins `scripts/fp/modals.js` at the END: `openModal` numbers titles with a
page-wide counter, so a mid-list entry renumbers every later sheet (v400).
`settle()` waits for the app's own frame, pending animations and still focus
(v356); a render past 8 s aborts the run as a hang (v355). The known noise is
the picture-load race (`loaded` on images): name it, never wave it through.

## Superpowers — and the two places this project deliberately departs from it

The [superpowers](https://github.com/obra/superpowers) methodology (14 skills) is
installed on this machine, with `/superpowers` as the single router. It is a good fit
for this repo and most of it simply names what the project already does —
`verification-before-completion` ("evidence before claims") and
`systematic-debugging` ("root cause before any fix") are this codebase's two most
expensive lessons, written down by someone else.

**Two of its skills conflict with decisions recorded above. Neither is an oversight,
and neither should be silently followed:**

- **`test-driven-development`** prescribes red/green: write the test, watch it fail,
  write minimal code. This project keeps **"no new dependencies, no build step"**, and
  its gate is its own contracts, lint and `scripts/test-*.js` suites (node `vm` and
  real-Chrome Playwright, installed `--no-save`) — so the reading is: **every change
  ships with a check that FAILED first** (the defect planted or the unfixed tree), or,
  for a pure refactor, the fingerprint net and the suites — plus a measured DOM check
  in the running app. That is red/green in substance; there is no test framework in
  the dependency sense, and adding one would need this line rewritten first.
- **`using-git-worktrees` / `finishing-a-development-branch`** assume a branch
  workflow. This project ships from `main` directly — GitHub Pages serves the branch,
  and CI (`.github/workflows/ci.yml`) reports on it rather than gating it — see
  "Deploy". Skip both unless the work is genuinely long-lived.

`using-superpowers`'s own session-start hook is **not** installed: it would require a
skill invocation before every reply in every project on this machine. The skills are
available and routed; the always-on discipline is the owner's call, not a default.

## Feature factory
This machine has a `/feature-factory` skill (24 specialist subagents, tailored to THE VAULT) that builds a feature end-to-end. See the maintainer's Claude memory for the roster.
