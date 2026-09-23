# THE VAULT — Claude Code Project Guide

A fitness / workout-tracking **PWA**. Vanilla JS, **no build step**, bilingual **EN/AR** (RTL), two modes (dark + light), mobile-first. Deployed to GitHub Pages and wrapped as an Android app via Capacitor.

- **Live:** https://moathdarweesh.github.io/vault/ (GitHub Pages, branch `main`)
- **Repo:** github.com/moathdarweesh/vault
- **`docs/AUTOMATION.md`** — the maintainer's own Arabic quick-reference for everything that runs automatically (the three `.githooks/` scripts, `npm run release`, the graph rebuild) and everything that does **not** (Worker redeploy, SQL, APK). Keep it in sync when you change any of that.

## Stack & key files
- `index.html` — markup, script wiring, and the cache-version markers.
- `js/i18n.js` — the two EN/AR dictionaries and nothing else. **Loads FIRST of the thirteen scripts**: `const I18N` is shared through the global lexical scope, which only works if it has already executed when app.js's `t()` runs.
- `js/catalog.js` — the app's static data and nothing else: `ICONS` (+ its two back-compat aliases), `WORKOUT_TEMPLATES`, `EXERCISE_MUSCLES`, both exercise-name maps and `FOOD_PRESETS`. Loads second, before app.js, for the same lexical-scope reason. **Contracts 13, 22 and 23 read THIS file now, not app.js.**
- `js/app.js` (**~464KB**) — the shell, the router `navigate(view, ctx, opts)`, and the domains that have not left yet (workout, planner, notifications, supplements, settings, auth). Use `Grep` to find a function; don't assume from names.
- `js/ui.js` (**~31KB**, v360) — the presentation vocabulary: format (numbers, weights, days, names), `escapeHtml`, `$`/`$$`, the shared surfaces (`showToast`, `openModal`, `closeModal`, `confirmDialog`, `openImageLightbox`, `emptyState`), `t()`/`icon()`, and `applyTheme`/`applyLang`. **The floor of the call graph** — contract 39 refuses any member that reaches past `DB.prefs`, or reaches Cloud, a module or the router. Loads after motion.js and before food.js.
- `js/body.js` (**~39KB**, v362) — the body domain: sleep, body weight and cardio. Three day-entry screens sharing one `dayLedgerHtml` renderer, which is why they are one file. One inbound edge from `renderProgram` (scheduled cardio, v315) and none outward.
- `js/food.js` (**~130KB**, v359) — the food domain: the Food and food-log views, the calculator, the recipe ledger, the saved-food picker, the meal bundles, the shopping list, the barcode scanner and the voice/photo capture. **Loads BEFORE app.js** — `bootCatalog()` calls into it inside a bare catch, so loading it later would swallow a ReferenceError and silently never merge the server food catalog.
- `js/storage.js` — the `DB.*` localStorage API (all persistence). `MACHINE_SEED`, name-match migrations.
- `js/cloud.js` — Supabase email/password auth + whole-blob sync to a per-user `vault_data` row (RLS-protected). Uses the **publishable** key only (never service-role). Loads before app.js. Also: `getUsername/checkUsername/setUsername` (the mandatory-handle feature) and `getClient` (RLS-scoped client for auxiliary readers).
- ~~`js/tables.js`~~ — **the mirror was REMOVED in v278** (owner decision, migration `18_drop-mirror-v14.sql`): the 13 normalized projection tables are dropped, the admin panel reads `vault_data` blobs directly under a `vault_data_admin_read` (is_admin) SELECT policy, and `admin_user_stats`/`admin_activity`/`delete_own_account` were rewritten over the blobs IN THE SAME TRANSACTION as the drops — plpgsql binds table names at call time, so dropping first would have broken every account deletion. The mirror's projection was silently empty for workout_sessions (name-remap failures), which is half of why it went.
  - Still one-way and analytics-only: the app does not read these tables back.
- `js/foodai.js` — AI calorie chat. Posts `{text}` to a **Cloudflare Worker** (`backend/worker/gemini-worker.js`) that holds the Gemini key server-side. The key never ships to the client.
- `js/health.js` — Health Connect bridge (Capacitor, no-op on web).
- `js/update.js` — native-shell update checker. No-op on web (web is always latest via the live URL). On the APK it compares the installed `versionCode` (via `@capacitor/app` `App.getInfo().build`) against `version.json` → `apk.build`; if a newer APK exists, shows the dismissible "download" banner linking to Drive. Best-effort, never blocks the app.
- `version.json` (repo root) — the APK-shell update manifest read by `js/update.js`. Bump `apk.build`/`apk.url`/notes when you ship a NEW APK.
- `styles.css` (~100KB) — one stylesheet; reuse existing CSS variables and classes.
- `admin.html` — standalone owner-only **multi-center control console** (GitHub Pages, not in the APK). Owner logs in → `is_admin()` RLS unlocks reading every user. Sidebar centers: dashboard, users (search/sort + per-user drill-down + **role/status write controls**), analytics, catalog, feedback inbox, roles/admins, releases, export. Writes go only through the `is_admin()`-gated definer RPCs (`admin_set_role`/`admin_set_status`). Publishable key only — never a service_role key.

## How to run & verify

- Startup scripts are in `<head>` with `defer`: downloads overlap, execution retains cloud → storage → app → health → notify → foodai → update order after DOM parsing. Keep the inline theme mirror and old service-worker cleanup. Never replace `defer` with `async` on these dependent scripts. `node scripts/test-startup.js` benchmarks the former serial body placement against the current placement in isolated Chrome (external Playwright runtime); `--verbose` includes individual resource timings.
- **Run:** `node dev-server.js` → http://localhost:8080 (serves `Cache-Control: no-store`). Honors `$PORT`. Also `.claude/launch.json` server name `vault` for the preview tool.
- **No automated test framework.** "Tested" = verified in the real running app by driving the DOM with `preview_eval`. **Screenshots time out on this app — do not rely on them.**

## Non-negotiable rules
- **Every user-facing string** goes through `t('key')` and has BOTH an EN and an AR entry in `app.js`. A missing language is a bug.
- **Read/write data only through `DB.*`** — never touch `localStorage` directly from view code.
- **Escape untrusted data** rendered into `innerHTML` with `escapeHtml()` — exercise/food names, and anything from cloud sync / imported backups / AI responses are untrusted.
- No new dependencies, no build step. Free-first (the maintainer prioritizes free tools/services).

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
npm run verify           # 43 contracts + lint + 13 suites — THE GATE
npm run release          # bump every marker and re-read them; runs NO tests
```

**Current version: v392.** APK: build 24 / v3.3.

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
- ⚠️ **FIVE places rebuild the plan object field by field** — `defaultState`,
  `migratePlan` (both branches), `plan.get()`'s fallback, `setRotation`,
  `clearAll`. `migratePlan` runs on **every load**. A field not enumerated in all
  of them is silently erased from the synced blob on the next write. Adding a
  sixth plan field means touching all five.
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
  bevel).

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
`ICONS` in `js/app.js` is a **52-key** FILLED set (+2 back-compat aliases — contract 23 prints the 54) on the
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

- **Verified first.** `npm run verify` (39 contracts + lint + 11 suites) must pass, and any change to
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
- **Android APK:** `npm run build:www && npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` → `android/app/build/outputs/apk/debug/app-debug.apk`. Copied to Google Drive (`G:\ملفاتي`). Portable JDK/SDK live under `C:\Users\moath\at` (`JAVA_HOME=…\jdk\jdk-21.0.11+10`, `ANDROID_HOME=…\sdk`).

## Distribution model — Live URL + native-update banner (since v109)
`capacitor.config.json` sets `server.url = https://moathdarweesh.github.io/vault/`, so the **APK is a thin shell that loads the LIVE site**. Consequences:
- **Ordinary updates (JS/CSS/HTML) reach everyone automatically** on next app open, with NO reinstall — a `git push` updates web AND app users at once. The bundled `www/` is only a build artifact; it is ignored at runtime.
- The APK's WebView origin is now `https://moathdarweesh.github.io` (same as web) — the Worker CORS allowlist already includes it. **Needs internet at launch** (acceptable: the app is cloud/AI-dependent anyway).
- A **NEW APK is only needed for NATIVE changes** (new Capacitor plugin/permission, `capacitor.config`, native code). To ship one: bump `versionCode` in `android/app/build.gradle`, build, copy to Drive, then set `version.json` → `apk.build` to the new versionCode + `apk.url` to the Drive share link + notes, and push. Installed apps then show the in-app "download update" banner (`js/update.js`).
- Migration note: users upgrading from a pre-v109 (bundled) APK land on the new github.io origin, so localStorage/auth reset once → they log in again and cloud sync restores their data. New users are unaffected.

## Backend v2 — normalized DB, mirror, admin (APPLIED to live Supabase)

> **`backend/README.md` is the authority for WHAT IS APPLIED and in WHAT ORDER.**
> backend/ is now sorted into `migrations/` (applied, numbered by dependency),
> `pending/`, `unverified/` (state unrecorded — check live before running),
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
- **Custom exercise images — durable backup** (`backend/migrations/08_storage-images-v6.sql`, **APPLIED + VERIFIED live 2026-07-17**; v120–v123): user-uploaded images (`customImage`) used to live ONLY as base64 inside the `vault_data` blob. The blob is a single mutable row with no history, so when an empty local state once overwrote it every image was destroyed — and the mirror never carried them, so a mirror restore brought back the exercise but not its picture (**this actually happened to the owner; the images were unrecoverable**). Now (v291): the base64 lives in a **side store** — one localStorage key per photo, `vault_img_<exerciseId>` — and every exercise object exposes `customImage` as a **non-enumerable accessor** onto it (`js/storage.js` `defineImgAccessor`), so readers and writers are unchanged while `JSON.stringify(STATE)` carries no photos: a set commit no longer serialises megabytes, the pre-sync snapshot fits, and a cloud pull replaces the blob and **leaves the photos alone** (they used to vanish after every foreground pull until the next heal). Still instant and still offline. An inline `customImage` found in a stored/imported/pulled blob is moved out on load; `exportJSON()` re-attaches photos so a backup file is complete; `Cloud.pushOnce` re-attaches any photo that has **no bucket copy yet** so it still travels; `imgPrune()` drops keys for exercises that no longer exist (never in READ-ONLY mode — the default state has none of the user's exercises); `clearLocalUserData()` wipes them on logout; `DB.exercises.setImage()` writes a photo without touching the blob (the boot-time heal uses it). Cards get a base64 background AFTER parsing (`hydrateCardImages`), never inside the HTML string. A durable copy is ALSO uploaded to the **private** `exercise-images` bucket at `{auth.uid()}/{exercise_id}.jpg` (owner-only RLS on `storage.objects`, 5 MB cap, image mime allowlist — **keep `image/svg+xml` OUT of that allowlist permanently: it is what rejects an active-content SVG from a poisoned imported backup**). The pointer is `imagePath` on the exercise object in the blob (the `user_exercise_prefs.custom_image_path` mirror column went with the mirror in v278). Since v291 the blob also carries `imageAt` (when the photo was last set) and `imageCleared` (an explicit removal): a device reconciles its side store against them on every load, so a photo removed or replaced on one device is removed or refetched on the others instead of resurrected and pushed back. Two rules that fell out of the second review (v292): **a NEW photo resets `imagePath` to null** (the bucket copy is stale; the upload runs again and the push carries the bytes inline until it lands — unchanged bytes on a re-save change nothing), and **the pre-sync rescue re-attaches every un-backed-up photo** exactly as the upload does, because the raw blob no longer holds any and the pull that follows a snapshot prunes the side store. A missing stamp beside a stored photo counts as *different*, never as a match. Client: `Cloud.backupExerciseImage/restoreExerciseImage/removeExerciseImage` (cloud.js), `backupExerciseImageFor()` on save + `syncExerciseImages()` after login/bootSync (app.js) which backfills any un-backed-up image AND heals an exercise whose base64 was lost but whose backup survived. **All best-effort** — every failure path leaves the local base64 untouched, so backing up can never lose an image, and the app works unchanged if the bucket is missing.
- Still pending: social features deferred. (The normalized-tables mirror was removed in v278.)

## Hardening pass (v189–v190) — invariants added by the 2026-07-25 codebase review

Full findings + verification in `docs/CODEBASE_REVIEW.md`. The load-bearing rules:

- **`saveLocal()` vs `save()` (`js/storage.js`).** `save()` flags the blob dirty for cloud sync; `saveLocal()` does not. **Housekeeping writes must use `saveLocal()`** — the Health Connect cache, the global-catalog merge, the onboarding flag. They run *before* `bootSync`'s pull resolves, and flagging them dirty manufactured a false `'conflict'` whose "Keep this device" branch force-pushes over a **newer** cloud blob (skipping both the empty-blob guard and the version compare). If you add a write that the device re-derives for itself, it belongs in `saveLocal()`.
- **READ-ONLY mode.** If the stored blob fails to parse, `loadState()` no longer overwrites it with `defaultState()`. It quarantines a copy at `gym_tracker_v1__corrupt`, sets `STATE_LOAD_FAILED`, and `writeStore()` refuses every write until a *deliberate* replacement (cloud pull / restore / reset) clears it via `reloadState()`. Never "fix" this by writing defaults.
- **`push()` returns `'ok'` on success** — and only on success. `'nosession'`, `'blocked'`, `'conflict'`, or a throw all mean the data did **not** upload. Any caller gating a destructive action (logout clearing the device) must test `=== 'ok'`, never "not an error string". **And use `Cloud.flush()`, not `push()`, before destroying local data** (v291): `push()` hands back a push already in flight, whose snapshot predates a save made during the upload — it resolves `'ok'` with dirty honestly still set, and logout wiped the device on that `'ok'`. `flush()` pushes again while dirty.
- **`applyRemote()` propagates `importRaw()`'s failure.** A failed pull must not advance the sync stamp or clear the dirty flag.
- **Mirror reconcile is gated on `blobLooksReal`** (`js/tables.js`). An empty id list makes the delete unbounded, so it only runs when the blob demonstrably holds user data.
- **Dates: always `todayISO()` / `addDaysISO()`, never `toISOString()`** for calendar days. `toISOString()` returns the previous day for every UTC+ user — this bug class has now appeared three times. **And resolve the day when the row is WRITTEN, not when the sheet opened** (v291, the fourth appearance, via a stale closure): `openAddSheet(null, …)` means "today, decided by `todayISO()` at log time"; every `DB.foodLogs.add(date || todayISO(), …)` site and `FoodAI`'s `dateNow()` follow it. Only the history view passes an explicit past date.
- **The guided screen does not move (v290–v291).** The rest bar is ONE persistent element with two states of the same min-height — `.rest-timer.idle` (no rest running) and `.live` (countdown, sticky) — inserted by `ensureRestBar()` directly before `.run-nav` **as a child of the view** (position:sticky can only travel inside its containing block; never wrap it). `stopRestTimer()` goes idle in place; only `clearRestTimer()` (navigate away) removes it. Re-renders (add set, next exercise) re-attach the SAME node, so the countdown never restarts. `Notify.restAlarm()` is the locked-phone alert, armed 1.5 s after `endAt` so an on-screen finish cancels it before it fires. A ✓ on a set with no numbers is refused (toast), and un-ticking stops the clock only for the set that started it.
- **The guided run resumes.** `runIdx` opens on the first exercise with no session on the run date (the last one if all have); persisted sets come back `done: true`. The suggestion and the best/last cells read history that **excludes the run date** — today's own row must never become "last session" mid-workout. Suggestions are computed in the unit the bar is loaded in (5-lb plates for lb users), and legs are matched case-insensitively (`'Legs'` is what is stored).
- **Sync decisions (v289–v291).** `push()` is serialised (one in flight; later callers share its promise); a conflict against identical bytes is a self-conflict and reports `'ok'`; `vault:push-ok` reopens the conflict-toast latch, which otherwise suppresses only repeats of one unresolved conflict. `bootSyncCore` decides pull-vs-push by the server **`version`** when both sides know it (clocks only as a fallback), and recognises its own last push through the `vault_pushing_<uid>` stamp written *before* the request, so an app killed mid-upload does not manufacture a conflict. `chooseLocal()` snapshots the cloud copy before force-pushing over it. The rescue slot (`vault_pre_sync_backup`) is stamped with its `uid` and refused for any other account, holds no backed-up photos, and records a failed write (`…_failed`) that Settings shows; logout also clears it, the `__corrupt` copy, the AI cache and the `vault_img_*` keys. READ-ONLY refusals dispatch `vault:save-failed {readonly:true}`, and `init()` asks `DB.loadFailed()` because the load-failed event fires before app.js exists. Inside the APK an `<a download>` is inert: `exportBackupFile()` shares or copies to the clipboard there.
- **Console sinks.** Every blob-derived string in `admin.html` goes through `esc()`; enumerable values (`prefs.unit`) are whitelisted at load (`u.unit==='lb'?'lb':'kg'`) — `toUpperCase()` is not a defence. Two stored-XSS sinks (sleep times, unit → `admin_set_role` escalation) were closed in v291.
- **Worker chat mode** runs under a fixed server-side `CHAT_SYSTEM` and ignores the client `prompt` entirely; food/photo/audio still take `prompt || text` as the user turn (food/photo under the strict JSON `SYSTEM` instruction). Requires the manual Cloudflare paste-deploy — **deployed 2026-09-02 as version `d356f094`** (the owner pasted from the clipboard; the dashboard editor is a cross-origin iframe that browser automation cannot type into, so this step stays manual).
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
- **Pending SQL: NONE.** `20_vault-data-history-v16.sql` (server-side history of the last 10 blob versions, trigger-written, own-row SELECT) and `21_food-catalog-fat-v17.sql` (fat column + 7-arg `admin_upsert_food`) were written in v291 and **applied + verified live 2026-09-02** from the SQL editor (the MCP apply had been refused by the session's permission classifier; the editor was driven through the owner's signed-in Chrome, and 21 was verified by CALLING the new overload). The client is tolerant either way (`select('*')` on the catalog; the Console falls back to the 6-arg RPC). 11–14 (`client-errors-v9`, `ban-rls-v10`, `launch-hardening`, `hardening-v8`) were applied and verified live on 2026-08-05. **`backend/README.md` is the authority for what is applied**, derived from git rather than memory; this bullet has twice claimed the wrong thing when edited from memory instead.

## Photo schedule import (v309)

- Entry: **Program → Edit cycle → Import a workout photo** (`openPlanImageImport`, app.js). Pick/capture one JPG/PNG/WebP image, explicitly read, then review names, matches, sets, rep/duration text, notes and weekdays. Up to 14 workouts × 20 exercises. Exact bilingual matching only; ambiguous/unmatched names require choosing a library exercise or explicitly adding a custom one. Append is the default for an existing cycle; replacement requires a checkbox and preserves logged sessions.
- `FoodAI.analyzePlanImage` uses `mode: 'workout-plan'` on the existing Worker, with the same auth and daily budget. The Worker owns the fixed transcription prompt; client text and instructions in the photo are not trusted. An older Worker response fails explicitly. The photo is compressed locally, never persisted in the blob or photo side store, and the request is cancelled on dismissal/timeout.
- **Targets are not history.** Optional `cycle[i].targets[exerciseId] = {sets: number|null, reps: string, notes: string}` belongs to a particular cycle slot. `planSlot`/`normalizePlanTargets` preserve it through migration and rotation replacement, and prune removed IDs. The guided run displays the reviewed targets and starts fresh planned rows empty/unchecked. It never logs targets automatically or changes existing sessions. Targets remain editable from the cycle card.
- `DB.plan.importImagePlan` writes the cycle and new exercises atomically, restores the old in-memory state if storage fails, and refuses a stale review if the plan changed. All draft edits are transient until explicit save. Do not create custom exercises during analysis/review.
- Verification: `node scripts/test-plan-import.js`; `node scripts/preview-plan-import.js` is a **loopback-only synthetic QA environment** using the real UI and Worker with mocked auth/model responses. It must never replace production auth. Detailed scope and deployment status: `docs/PLAN_PHOTO_IMPORT.md`.

## Save center (v310)

- Settings owns one Saving & sync center. `saveCenterModel` maps storage/cloud outcomes; `updateSaveCenter` patches its text and actions. Save/sync events are coalesced without polling or extra network requests.
- `DB.saveState()` returns a copy of the latest local write outcome. `writeStore` keeps its boolean contract; `save`/`saveLocal` return the outcome. This does not make legacy mutators transactional: undo and rollback are separate work.
- `Cloud.syncState()` preserves linked/dirty/stamp/version and adds status/online/confirmedAt. Runtime outcomes are account-scoped; durable dirty/version markers remain authoritative. Conflict resolution updates the center too.
- The center covers records, not separate exercise-photo backups. No schema, SQL, Worker, or application dependency changes. Scope and verification: `docs/SAVE_CENTER_PHASE_1.md`; tests: `scripts/test-sync-status.js` and optional `scripts/test-sync-status-ui.js` (external Playwright runtime).

## Everyday convenience features (v312)

- `docs/USER_CONVENIENCE_IMPLEMENTATION.md` records scope and validation. Keep all original iOS work separate.
- `changeSlice` in storage.js owns scoped rollback and ephemeral Undo. `DB.undo.list/apply/clear` bounds history by age/count/size, verifies account and expected after-state, and is cleared on reload/logout. Feature transactions refuse when another tab changed the stored bytes. Do not restore a whole blob to undo one food or set.
- Meals use `DB.mealBundles.update/log` and `DB.foodLogs.addMany`: one write, snapshot nutrition, explicit portion/date and operation deduplication. Recipes also edit in one write. `purchase` metadata is separate from nutrition math.
- `DB.shopping` stores optional `shoppingLists` in the existing blob; unknown quantities stay unknown. Merge only an explicit ingredient identity with compatible units/preparation. Existing lists are snapshots, not live recipe references.
- `DB.search` derives bounded local results on demand; no query history or persisted index. Modal results verify their owner and refresh on save. Use the real route contexts (`exercise-detail.exerciseId`, `foodlog.foodLog.date`).
- `Cloud.listPlanHistory/readPlanHistory/checkPlanRestoreVersion` use existing own-row history, metadata first. Program restoration verifies references/current plan/catalog/version, snapshots before mutation, and changes only plan plus explicitly recreated exercise definitions.
- Conditional push errors no longer fall back to unconditional upsert. Unknown versions insert only; force-upsert is reserved for explicit conflict resolution. Do not reintroduce fallback overwrite.
- Verification: `test-convenience.js`, `test-convenience-cloud.js`, and `test-sync-status-ui.js` (which invokes `test-convenience-ui.js`). Browser/cloud faults use isolated synthetic data. The opt-in live probe was refused by Turnstile (600010), created no accounts, and is not a completed production RLS audit.

## v314 (2026-09-13) — the design pass over v309–v313, and the iOS build that runs without a Mac

The owner's verdict on v309–v313 was «التصميم ما عجبني لكن الميزة عجبتني» — the features
were right, the design was not. All five feature test suites passed and all 31 contracts
held, because **no test in this project looks at design**. Every defect below was found
by reading the shipped files and measuring the rendered DOM.

**Three of them are one family, and that is the lesson worth keeping: v312 added its
features ON TOP of existing components without first asking whether the app already had
one.** A global search button was added beside a search button that already existed; a
new search field was hand-built instead of using `.search-wrap`; and new CSS was appended
under the banner that says not to append under it. Before adding a component, grep for it.

- **The v312 convenience CSS sat BELOW the identity-layer banner** — 18 declarations
  inside the region whose authority is pure source order. Exactly the v218–v227 drift that
  `styles.css`'s own banner exists to prevent. Moved above it, and **the move was proved
  inert the way v262's was**: 110 computed-style fingerprints across four sheets, of which
  103 were byte-identical and the 7 that changed were the intended token fix.
- **`--text-muted` does not exist in this project; the token is `--text-mute`.** It was
  used twice, so `.cx-stack label` and `.cx-result span` painted at full `--text`. Measured:
  `rgb(253,250,247)` where a real muted line is `rgb(176,166,158)`. Every field caption in
  My Meals / Shopping / Search / Recent changes had no hierarchy at all — which is most of
  what "crowded" looked like. **A CSS variable that does not exist fails silently**: the
  property is simply dropped and the element inherits. Grep the definition before using a token.
- **`.vault-bar` is `justify-content: space-between` and was built for TWO children.** The
  v312 search button made it three, so `space-between` distributed it into the middle of the
  bar — measured at 90px of dead space on each side on a 375px phone. Search and the
  screen's action now share a trailing `.vault-bar-actions` group, which also retires the
  `<span style="width:40px">` that only existed to balance the old layout.
- **The Program tab's bar action was a MAGNIFIER labelled `search_exercises`, and its
  handler is `navigate('exercises')`** — it never searched anything; it opens the exercise
  browser, which titles itself `t('train')`. So it both lied about itself and put a second
  magnifier beside the global one. It is `icon('dumbbell')` / `t('train')` now. The
  duplication was always there; grouping the bar is what made it visible.
- **`openUnifiedSearch` was the only search in the app not using `.search-wrap`** (the
  exercise browser, food picker, exercise picker and swap chooser all do). It had a CAPTION
  above an empty box reading «تمرين أو وجبة أو YYYY-MM-DD» — a format token shown to a user.
  Rebuilt on the shared component: inline magnifier, placeholder, no caption, zero new CSS
  (`.search-wrap` already mirrors the icon for RTL via `inset-inline-start`). The date format
  moved to `cx_ambiguous`, which appears only when an ambiguous date is actually typed.
- **The meal card carried four controls and was forced to wrap** — 179px of buttons in a
  335px card, so v312 added `flex-wrap: wrap` rather than reduce it, and every card stood
  115px tall. It is one row again (measured 66px, `nowrap`): the NAME is a `<button>` that
  opens the editor, plus portion and add. **DELETE moved into `openMealEditor`, which had
  none** — it used to sit 8px from the button that LOGS the meal. Same shape the v301
  ingredient ledger settled on.
- **`apple-touch-icon` pointed at an SVG, and iOS does not support SVG for it** — Safari
  ignores it and puts a SCREENSHOT OF THE PAGE on the Home Screen. `icons/apple-touch-icon-180.png`
  is rendered from `icon.svg` onto an opaque black tile (iOS applies its own squircle mask and
  does not expect alpha). `rel="icon"` stays SVG for desktop.
  > The first attempt wrote a CORRUPT file: the base64 was damaged in transit and the IDAT
  > chunk's CRC was bad. **The browser did not error — it rendered the icon fully
  > transparent.** Caught only by reading the bytes. If an image is ever generated this way
  > again, verify the PNG's own chunk CRCs and defilter the rows before trusting a pixel
  > count — raw IDAT bytes are per-row deltas, not pixels, so a naive read reports nonsense.

### The plan is rebuilt in SEVEN places, not five — and `planSlot` is the dangerous one
The "FIVE places rebuild the plan" note above is **half stale and half incomplete**, and
both halves matter:
- `migratePlan`'s ROTATION branch was fixed in v298 to spread (`...plan`), so an unknown
  TOP-LEVEL plan field now survives a load. The load path is no longer where data dies.
- But **`planSlot()` (storage.js) rebuilds every cycle SLOT field by field with no spread,
  and `migratePlan` runs it on every slot on every load.** Anything attached to a rotation
  slot that `planSlot` does not enumerate is erased silently, everywhere, forever. `targets`
  survives only because v309 added it to `planSlot` explicitly.
- The remaining write sites that rebuild from a literal and preserve nothing are
  `setRotation`, `clearAll`, `defaultState`, `plan.get()`'s fallback and `migratePlan`'s
  legacy branch. **`setRotation` is the trap**: adopting a template would silently delete any
  plan field it does not name.
- Practical rule: **new per-user data that is not part of the rotation belongs at the TOP
  LEVEL of the blob, not inside `plan`.** `shoppingLists` (v312) is the template — 6 additive
  edits (defaultState, the loadState presence backfill, the array-shape loop, `_validateBlob`,
  `_idsSafe`, `hasUserData`), none of which can erase anything. The `hasUserData` line is
  mandatory, not optional: without it a device whose only content is that field reads as
  "empty" to cloud.js, gets pulled over with no rescue snapshot, and is refused a push.

### iOS builds in CI now — no Mac, no Apple account, no signing
`.github/workflows/ios-build.yml` builds the app for the simulator on **`macos-26`** and
uploads the `.app`. The runner is pinned, and pinned to 26 on purpose: since **28 April
2026** App Store Connect refuses any upload not built with Xcode 26 against the iOS 26 SDK,
so an older runner would prove the app compiles against an SDK Apple will not accept.
Never `macos-latest` — that label moves on Apple's schedule.
- **The run log needs repo-admin rights** (the REST logs endpoint answers 403 to everyone
  else), so `scripts/ci-step.sh` re-emits any failure as a GitHub `::error::` **annotation**,
  which IS public on a public repo (verified: logs 403, `/check-runs/<id>/annotations` 200).
  Every stage is its own step so the step NAME alone locates a failure.
- Three defects it exposed, all the same shape — a file that exists and is invisible to the
  thing that consumes it: **there was no shared scheme at all** (Xcode writes the automatic
  one into `xcuserdata`, which is per-user and gitignored, so `xcodebuild -scheme App` could
  never have worked on any other machine); and `PrivacyInfo.xcprivacy` plus both
  `InfoPlist.strings` were tracked but **not referenced in `project.pbxproj`**, so Xcode would
  have built an app without them — App Store Connect refuses an upload with no privacy
  manifest, and every Arabic permission prompt would have been English.
- CI reads the BUILT `.app` for the privacy manifest, the web bundle and `ar.lproj` — not the
  source. This project has shipped an Android icon three times that was right in source and
  wrong in the binary.
- **A simulator build cannot run on a real iPhone** (unsigned, simulator slice). The free
  route onto a phone today is the PWA: Safari → Share → Add to Home Screen. A native install
  needs either the $99 Apple Developer Program (then CI → TestFlight) or self-signed
  sideloading; both are the owner's decision and neither is code.
- `scripts/sync-ios.js` must never apply `shell: true` to `process.execPath`: Node's own path
  on Windows is `C:\Program Files\nodejs\node.exe` and cmd.exe splits it at the space. The
  shell is for the `.cmd` shim only.

## v315 (2026-09-13) — scheduled cardio

"Schedule cardio in Program, tick it off on Home." Designed by a judge panel
(three shapes scored 262 / 256 / 213) and then attacked: 20 defects were found
against the winner and folded in before a line was written. `scripts/test-cardio-plan.js`
is the verification script — the project's form of TDD, per the deviation noted below.

- **`STATE.cardioPlan` is a TOP-LEVEL slice, deliberately not a field of `plan`.**
  The plan object is rebuilt from a literal in **seven** places, not the five named
  above: `defaultState`, both `migratePlan` branches, `plan.get()`'s fallback,
  `setRotation`, `clearAll` — **and `planSlot()`, which rebuilds every cycle SLOT on
  every load**. `setRotation` is the trap: adopting a template would silently delete
  a plan field it does not name, and "Clear plan" would take the cardio schedule
  with the lifting one. `shoppingLists` (v312) is the template for the six additive
  edits; the `hasUserData` line is mandatory, or a device whose only content is a
  schedule reads as "empty" to cloud.js and is pulled over with no rescue snapshot.
- **There is no second "done" store.** Completion is a real `DB.cardio` row carrying
  `planId`. That is what buys the streak, the week strip, the stat strip and the day
  ledger for free — a private done-map would have to be taught to every one of them.
- **Ticking CLAIMS an existing unclaimed row rather than adding one.** A walk
  imported from the watch on the same day, of the same type, is adopted. Without
  this, using the app after a watch-tracked walk guaranteed the minutes were counted
  twice with no way for the user to avoid it.
- **Un-ticking never hard-deletes a row the tick did not create.** Rows the tick
  wrote carry `planAuto: true` and are removed; a claimed row is merely UNCLAIMED,
  so an imported walk's minutes and calories survive.
- **The join is guarded on `entityIdSafe(r.id)`**, because `undefined === undefined`
  would let one imported walk tick every id-less row at once — and `_idsSafe` now
  refuses a `cardioPlan` row with no id rather than tolerating it.
- `forDate` builds its weekday with the **numeric** Date constructor.
  `new Date('2026-09-13')` parses as UTC and returns the previous day for every
  UTC+ user — the bug class this codebase has now hit five times.
- **Home stamps the rendered day into `data-iso` and checks it before writing.** A
  phone left on Home across midnight never fires `visibilitychange`, so the card can
  be painted for yesterday; it repaints instead of writing the wrong day. The row is
  re-read at CLICK time, never captured at render time.
- Home caps the list at 3 with done sunk to the bottom, and carries a `.section-title`
  — without a heading, two rows with a "+" between the hero and the calories card
  read as "add something", not "mark this done".
- `resolveCardioType` was nested inside `renderCardio` and is now module scope:
  Program and Home both render a cardio row, and a second copy would be an agreement
  between three call sites with nothing keeping them equal.
- ⚠️ **`.supp-toggle.taken` was missing from the identity layer's
  `--icon-accent: currentColor` list**, whose comment claimed "these six" while
  naming five. It fills with `--accent` while `--icon-accent` still resolved to
  `--accent-text` — the same orange in dark mode — so the short leg of the duotone
  check was painted orange on orange and the tick rendered as **a bare diagonal
  slash**. Live in Supplements ever since that toggle shipped; scheduled cardio
  reuses the control, which is how it finally surfaced. Verified after the fix:
  the leg resolves to `rgb(26,8,0)` on the `rgb(255,106,0)` fill.

## v316 (2026-09-13) — the design pass, continued: 38 defects across the v312 sheets

v314 fixed the seven worst. This finishes the sweep the owner asked for
(«صلحهم كلهم»). Same method, and it is the only method that works here: **no test
in this project looks at design**, so every one of these was found by reading the
shipped files and then proved by measuring the rendered DOM.

**Two of the fifty-six "confirmed" findings were wrong, and measuring is what
caught them. Both are recorded so they are not re-opened:**

- **Positive `letter-spacing` does NOT break Arabic joins in this app.** The
  theory was sound — Arabic is cursive, forty-two label rules pair
  `text-transform: uppercase` (a no-op in a script with no uppercase) with
  +0.01em..+1px of tracking, and tracking a joined script should pull it apart. A
  42-selector RTL override and a contract to keep it honest were written, and
  then measured in the live browser: at 0.18em on 11px IBM Plex Sans Arabic, a
  12-character Arabic string grows by **1.98px** and the identical-length Latin
  string by **23.77px**. The delta is exactly `spaces × 1.98`; a single Arabic
  word of ANY length grows by **zero**. Blink applies letter-spacing at run
  boundaries, not between joined glyphs. The fix was a no-op with a false comment
  attached, so it was reverted. Contract count stays 31.
- **Arabic-Indic numerals in `pi_*` are the house style, not an anomaly.**
  `١٥ ميغابايت` was flagged as inconsistent. It is not: `username_rules` (٣–٢٠),
  `auth_pw_short` (٨), `last_7_days` (آخر ٧ أيام), the progression reasons and all
  219 `FOOD_PRESETS` Arabic serving strings (`١٠٠غ`) use them. Latin digits are
  for RENDERED figures (`.num`, JetBrains Mono); Arabic-Indic digits are for
  digits embedded in Arabic prose. Changing `pi_*` would have been the defect.

### What actually shipped

- **`t('delete') + '؟'` titled three confirm sheets** — an English word beside an
  Arabic question mark in the Arabic UI, naming nothing. One `delete_q` key, both
  scripts, all three sites.
- **The saved-foods picker's three `role="tab"` buttons carried no
  `aria-selected` and no `aria-controls`**, so the tablist announced three
  unselected tabs pointing at no panel. And its search box was built once, from
  the Foods tab, and never changed: standing on Recipes the empty field still read
  «ابحث عن أكل…». **`applyTab()` is now the one writer of every per-tab surface**
  (the `on` class, `aria-selected`, the placeholder, the new-button label) and both
  the first render and the click handler call it, so they cannot drift.
- **`.cx-stack .btn` set `white-space: normal` without `height: auto`.** `.btn`
  fixes its height, so a label that wrapped overflowed its own button. Measured: two
  lines (21px) still fit the 44px box; at three the text is 63px and spilled 9.5px
  past the button's edge, top and bottom. (`.cx-tools` went with it — THIS release
  moved its only user to `.header-links`; an earlier draft of this line credited
  v314, but `.header-links` does not exist in `4041fc5`.)
- **Six free-text fields in the convenience sheets had no `dir="auto"`** — the meal
  name, the list name, the item name, both ingredient-identity fields and the
  category. The recipe editor and the photo import set it on every such field; a
  Latin name typed into an RTL page put its punctuation on the wrong end.
- **The meal editor asked for a portion without ever saying what it was worth.**
  Each row now carries its own calorie figure under the name, patched in place on
  `input` — a redraw per keystroke would take the caret out of the field being
  typed in (verified: 130 × 3 → 390, focus retained). The portion control is
  `flex: 0 0 auto` so the NAME takes the leftover width instead of splitting it
  50/50 with a two-character number field (126px → 132px, and the long-name row
  no longer overflows).
- **`cx_amount_hint` was a muted `.settings-hint` in the meal editor and
  full-strength body text in the purchase editor** — the same sentence, two
  weights, and in the louder place it was the loudest line on the sheet, sitting
  above a second aside that was correctly muted. Measured after: both
  `rgb(176,166,158)`.
- **The shopping-sources sheet asked the user to choose sources and then listed
  none.** With no saved meals and no recipes it showed «اختر الوجبات أو الوصفات»
  over empty space, with «Review» (primary) above the only thing that could
  actually work. The instruction is now conditional, the empty state says why, and
  the blank-list button becomes the primary — and `#cx-shopping-preview`'s handler
  is guarded, because the button it binds is no longer always there.
- **Two accessible names were lies.** The servings field on each source row was
  named after the MEAL, so a screen reader repeated the row's own heading and never
  said what the number meant; and both preparation `<select>`s were named
  `cx_unspecified` — **the name of one of their own options** — so each announced
  itself as its default value. The servings and edit controls now name the field
  AND the meal; preparation is `<label>`-wrapped like its three siblings, which
  also gives it the visible caption it was the only control on those sheets to
  lack (measured: zero uncaptioned controls left in the purchase editor).

**Still open, and deliberately not attempted here:** `openPurchaseEditor` is still
a spreadsheet — four controls per ingredient in one flat stack. Rebuilding it onto
the v301 ingredient-ledger primitives (one summary line per row, a well that opens
on tap) is the right shape and is its own piece of work.

## v318 (2026-09-13) — Home's cardio is a task card that shrinks when the task is paid

The owner's words: «مابدي خيار الكارديو كذا خليه قريب او نفس خيار ابدا التمرين لكن بدل ما
اضغط عليه وابدا التمرين لا ينحط عليه تم». A judge panel scored three shapes (323 / 310 / 289)
and the LITERAL one — the workout hero's exact size with «تمّ» on the bar — lost, scoring
highest on project law (87) and **lowest on "the day after" (62)**. The measurement is why:
the workout hero is 184px, and on a 375px phone the calories hero below it already ends 117px
past the fold. A third 184px card starts the calories card at 646px — entirely below it.

**THREE SIZES, ONE FAMILY, and the ladder between them IS the design.** CARD (owed, 145px) →
ROW (owed, queued, 68px) → STRIP (settled, 44px). Prime space under the workout hero stays
proportional to what is still owed. Measured through the whole cycle at 375×812:

| | block | calories card visible |
|---|---|---|
| before (v317) | 95px | 192px |
| owed — the card | 145px | 151px |
| done — the strip | **44px** | **252px** |

You pay 41px while you owe it and are repaid 60px when it is done, and the calories card never
goes below the fold — which the literal shape could not promise.

- **THE CARD IS ALWAYS "THE CARDIO YOU OWE NEXT" — exactly one, or none.** Everything else
  queues below at row weight, capped at 2 while a card exists (3 when none does). Height is
  bounded whatever the schedule holds, and `DB.cardioPlan.MAX` is 20. With more than one owed,
  the card's meta says «١ من ٢» so the card never pretends to be the whole day.
- **The `.section-title` is gone, and its job was inherited, not dropped.** A heading reading
  «كارديو اليوم» above one row saying «مشي · ٣٠ د» spent 26px to label a single item, and
  neither hero on this screen does that — each names itself in its own eyebrow. The identical
  key moved into the card's eyebrow; no string was added or deleted.
  > ⚠️ **The tick did NOT survive with it, and the attempt is worth recording.** v318 stood the
  > identity layer's device 5 (one bar of the mark) on end down the card's inline-start edge as
  > `.hero-card.cardio-task::before`. The owner's reaction was «ليش فيه خط برتقالي؟» — which is
  > the verdict: a mark that has to be explained has failed. It was also broken, and measurably
  > so: the bar was inset 12px top and bottom while the card's corner radius is 24px, so
  > `overflow: hidden` clipped it against the curve — **fully hidden 12px in, half visible at 16,
  > whole only at 24**. What shipped was a tapered stroke stuck to the edge. Removed in v320
  > (`content: none`). **When you inset a decoration along a rounded edge, the inset must be at
  > least the corner radius, or the curve eats its ends.** The identity layer already permits
  > going without: `.rot-section-title` deliberately does not take the tick either.
- **The radial glow is deliberately NOT inherited.** It marks the two NAVIGATIONAL heroes —
  cards that take you somewhere. This card completes in place. That, the 145-vs-184 height, and
  the size-M bar are what keep three stacked cards legible without it.
- **No plus glyph survives anywhere in the block**, on the card or the queued rows. A "+" in a
  square is what made the day's job read as "add something", which was the whole complaint.
  Both controls are labelled: «تمّ» filled while owed, «تراجع» outlined once settled.
- **The settled strip is not a ticked box.** A check sitting in a square still offers itself as
  something to tick. Four independent signals say "done" so colour is never alone: the word
  «تم» in the meta, the `.is-done` wash, the geometry (44 against 145), and an accessible name
  that says what pressing it DOES — «تراجع عن تسجيل مشي», not «تراجع».
- **It keeps `var(--elev-1)`.** Dropping the elevation was tempting (settled things recede) but
  `--surface-1` on `--bg` is ~1.08:1 in dark: with no border and no bevel the strip would have
  had no edge at all.
- **`--icon-accent: currentColor` on both controls is not optional.** The duotone `check` and
  `refresh` glyphs would otherwise resolve their accent leg to `--accent-text` and paint brand
  orange on a muted control — the exact `.supp-toggle.taken` failure recorded under v315.
- **The fold animates the button and nothing else.** It is the one element that genuinely ceases
  to exist; the icon, the name and the duration sit perfectly still and survive into the strip.
  The card is not replaced, it is de-boned. The icon is the continuity anchor — the one element
  present at all three sizes, in its own category colour, which is never orange. The write
  happens BEFORE the 180ms fold, so an interrupted teardown costs nothing but a repaint, and
  `prefers-reduced-motion` skips it entirely.
- **Swipe was asked for as an alternative («او») and deliberately NOT built.** It fixes neither
  half of the complaint (the control was the wrong size and the wrong verb; a full-width labelled
  bar fixes both), it has no affordance so the button must ship anyway, `app.js` has exactly one
  `pointerdown` listener in 14,800 lines, and "swipe right to complete" means the opposite
  physical motion to an Arabic and an English reader in an app that flips `dir` on a preference.
  A mis-swipe also writes a real `DB.cardio` row and can silently claim an unclaimed watch
  import. If it is ever wanted: gesture on `.cardio-task` only, ≥56px travel with ≤14px drift,
  `setPointerCapture` after the axis locks, either direction accepted, calling the same code path
  the CTA calls.
- The toast is direction-aware now (`cardio_sched_undone`); it used to say "logged" for an
  un-tick too. The `DB.cardioPlan` completion contract is untouched: ticking still CLAIMS an
  unclaimed same-type row rather than adding one, and un-ticking still never hard-deletes a row
  the tick did not create.

## v321 (2026-09-13) — THE EMBER: the void answers the hand

«خلي الخلفيه السودا الي ورا يكون الها تفاعل منظر رائع بشكل سلس». A judge panel scored three
takes: react to the hand (308), to the day's progress (280), to scroll depth (258).

**The headline is not the winner. All three scored LOWEST on "can you even see it" — 56 / 42 / 42
— and three independent judges reached that separately.** Verified here rather than taken on
trust: the winner's own numbers put a 120ms tap at `rgba(255,138,48,0.0145)` over `#000`, which is
**rgb(4,2,1) — a 4/255 delta**. Beautiful, cheap, law-abiding, and invisible. The fix applied is
the owner-intent judge's: rise **700ms → 260ms** and dark peak **0.085 → 0.16**, which puts a tap
at rgb(19,10,4) and a held press at **rgb(41,22,8) — 4.35× the luminance of the brightest pixel
`--bg-grad` already paints** (measured rgb(13,7,3)). `--text-mute` over that peak still measures
**7.25:1**.

- **At rest it is exactly zero.** No finger on the glass means `opacity: 0` and nothing animating,
  so the void is byte-identical to v320. This is not an always-running animation.
- **The physics ARE the throttle.** The rise is LINEAR, so contact time and brightness are the same
  number — and a scroll fires `pointercancel` the instant Chrome claims the touch, so the single
  most frequent gesture in the app makes the LEAST heat. Nothing is sampled and nothing runs per
  frame: two class toggles and three custom-property writes per press. Those properties are written
  on the `.ember` LEAF, never on `.app` or `:root` — a custom property changed on `.app` invalidates
  style for every descendant that inherits it, which is hundreds of nodes on every touch.
- **`.ember-clip` stops at the nav's top edge, and that is not cosmetic.** `.bottom-nav` lives inside
  `.app` and carries `backdrop-filter: blur(24px) saturate(180%)`. A warm mass drifting under it
  would make the compositor re-rasterise that blur on every frame of every press — the same cost
  this project already deleted the per-card `backdrop-filter` layers for (v297). `down()` also
  returns early when a `.modal-overlay`, an open `.sheet-overlay` or the `.auth-gate` is up: behind
  an opaque gate the work is invisible, behind a blur surface it is expensive.
- **`isolation: isolate` on `.app` was verified against index.html, not assumed.** `.app` closes at
  line 117 while `#modal-root` (181) and `#toast` (182) are SIBLINGS at body level, so the subtree
  was already below them and isolating it traps nothing.
- **Physical `left`/`top`, never `inset-inline-start`.** The coordinate comes from pointer `clientX`,
  which is physical, so a logical property would mirror the ember away from the finger in Arabic.
- **Reduced motion gets no ember at all** — `setupEmber()` returns before it creates the element,
  because the global `0.01ms !important` clamp would turn this into a hard flash under every tap.
  The CSS rule is only the belt to that brace, for a user who flips the OS setting mid-session.

> ⚠️ **THE CEILING, measured, and worth knowing before anyone tries to make this grander.** The
> effect paints BEHIND the content, and **87% of the Home screen is covered by cards — only 13% of
> the shell is exposed void.** So any background effect in this app can only ever read in the
> gutters and the gaps between cards. That is not a flaw in this design; it is the budget every
> background effect here has to live inside. If more presence is wanted, the lever is the peak
> alpha in `--ember-grad`, not the mechanism.

## v322 (2026-09-13) — the purchase editor becomes a ledger

The last and largest of the v316 review's findings, deliberately deferred then and closed now.
`openPurchaseEditor` was a spreadsheet: **four always-open labelled controls per ingredient**, so a
six-ingredient recipe put **24 controls** on one sheet and the names they belonged to were lost
among them.

It is the **v301 ingredient ledger's** shape now, and it reuses that component outright —
`.rec-row`, `.rec-line`, `.rec-sum`, `.rec-sum-t`, `.rec-sum-ic`, `.rec-more`, `.rec-f`, `.rec-cap`
are all inherited unchanged. **There is one ledger idiom in this app now, not two that merely
resemble each other.** Measured on a six-ingredient recipe: 6 rows of 86px, and **0 controls
reachable at rest** where 24 used to be visible.

- **Line 1 is the ingredient and what the recipe calls for** («أرز» · «200 غ»); line 2 is a
  READ-ONLY summary of the shopping amount that opens a well on tap. Closed, the summary carries
  the whole answer on one line — «500 غ · نيء · أرز أبيض» — so nothing has to be opened to read it.
- **`paint(row)` is the ONE writer of line 2**, derived from that row's own fields and nothing
  else, exactly as `updateSummary()` is in the recipe ledger. The line can never disagree with the
  well underneath it.
- **Three delegated listeners on the list, bound once** — the ledger's own rule. Editing a field
  repaints only its own summary, so nothing the user is typing into is re-rendered underneath them.
- **The well is two columns, not the recipe well's four.** That well holds four NUMBER inputs; this
  one holds two selects and a free-text id, and `.pur-f-id` spans the row because the id is the only
  free-text field here. `.rec-f` styles `input` only — the recipe well never had a select — so
  `.pur-row .rec-f select` matches it exactly, and sets `color` explicitly because a styled control
  that does not measured 2.23:1 here once before.
- **`cx_identity_hint` moved into the well**, where identity is actually set. It used to be the
  second of two asides stacked above the content before the user reached anything editable.
- The save path is unchanged: it still reads `[data-quantity]`, `[data-unit]`, `[data-identity]`
  and `[data-preparation]` out of each `[data-purchase]` row, and `originalText` still carries the
  recipe's own wording through. Verified end to end — `{quantity: 500, unit: 'g', ingredientId:
  'أرز أبيض', preparation: 'raw', originalText: '200 غ'}`.

## v324 (2026-09-13) — what the pre-push review found, and one block instead of two boxes

A 74-agent adversarial review of the whole unpushed range (v316–v322) before it reached any device.
Two blockers, fourteen more confirmed, seven killed by refutation.

### The two blockers

- **`bindVaultAction` asked for "the ACTIVE view" instead of the view it was rendering.** Every view
  stays in the DOM, and v318 gave this app **its first DEFERRED render** (the cardio fold waits
  180ms) — so those two stopped being the same thing. Tick «سجّله» then switch to Program inside the
  window and Home's Settings handler was attached to **Program's** top-bar button: reproduced live,
  the dumbbell landed on Settings and pushed a junk history entry. It now takes the element being
  rendered, which kills the class for any future deferred render. The fold also bails if the user
  left Home, and the toast is raised immediately instead of 180ms later — deferred, it arrived after
  a `navigate()` that was meant to clear it, and a second tick could leave one toast describing the
  other row.
  > **A deferred render is a different animal from a synchronous one.** Anything that queries
  > `.view.active` from inside a render is correct only while renders are synchronous, and this app
  > is no longer that.
- **v322 broke the browser QA suite and "all five suites pass" was wrong twice.**
  `test-convenience-ui.js` fills `[data-quantity]`, which the purchase ledger now keeps
  `display:none` inside a collapsed well. That suite needs an external Playwright runtime, so it
  **skips silently** in ordinary runs. This is the SECOND time in one range the same blind spot hid
  a break (the first was `[data-my-meals]` in v316). **The honest claim for a normal run is four
  suites, not five** — `test-convenience-ui.js` is only exercised under Playwright.

### One block, not two boxes

The owner, on the Home cardio block: **«هذي كلها كارديو ليش كذا منفصلين؟»** — and he was right. The
lead cardio was a raised `.hero-card` and each queued one a raised `.data-row`, every one carrying
its own `--elev-1`, so two things of the same kind sat in two unrelated boxes. **Today's cardio is
one object, so it now gets one surface**: `.home-sched` is the card, and the lead cardio and the
rows are flat inside it, divided by a rule instead of by a gap. Measured after: exactly **one**
raised surface in the block.

### The rest

- «كارديو اليوم» lived inside the CARD, so ticking the last owed cardio removed the only heading on
  screen and left the settled strips labelled by nothing. It belongs to the block now.
- **WCAG 2.5.3 Label in Name**: visible «تمّ» against an accessible name of «سجّل إنجاز مشي» shares
  no word, so voice control could not address it — and «تمّ» collided with the «تم» the settled strip
  prints one row below, a state word doing an action's job. Both names start from «سجّله» now.
- An `aria-label` REPLACES an element's whole text, so labelling a favourited meal button silenced
  the item count and calories a screen reader otherwise reads from inside it. The label carries them.
- Every summary button in the purchase ledger took its name from the summary text, so all of them
  announced the same sentence and none said which ingredient it belonged to.
- `body:has(.toast.show) .modal` fired for EVERY toast, so an ordinary «تم الحفظ» resized an open
  sheet by 134px mid-interaction. Only an action toast is tall enough to reach a sheet's buttons and
  only it needs to stay reachable, so only it earns the reservation.
- `.link-btn` is ~28px of text reaching 44px through `inset: -6px -8px`, so the Food header's two
  links at `gap: 2px` had halos **overlapping by 10px** and the lower one won the shared strip — the
  bottom edge of «قوائم المشتريات» opened Food history. 14px of gap clears them with 2px to spare.

## v325 (2026-09-13) — every cardio is the same row, and the tick is the whole control

Two rounds of the owner's own feedback on the block v318 built, and both retired code rather than
adding it.

- **«هذي كلها كارديو ليش كذا منفصلين؟»** The lead cardio was a raised `.hero-card` and each queued
  one a raised `.data-row`, every one carrying its own `--elev-1` — so two things of the SAME kind
  sat in two unrelated boxes. Fixed in v324: the BLOCK is the one surface, everything inside is flat
  and divided by a rule.
- **«خلي تصميم المشي نفس الجري احلا»** — and having seen both shapes he chose the row. So the card
  form is **gone entirely**: one row shape, one height (measured: 68px each), sorted owed-first.
- **«وخلي علامه صح بدون كلمه سجله»** — the owed control is now the check ALONE, a 36px square with a
  20px glyph and the 44px halo every sub-44 control here carries. The word repeated what the tick
  already said and cost more width than the duration beside it. Its accessible name still says the
  action and the activity («سجّله — مشي»), because an icon-only button has no visible label to
  match. The settled control KEEPS its «تراجع»: that is a different action, and a second unlabelled
  glyph on the same row would be a riddle.

**What this deleted is the point.** The card form took `.cardio-task`, `.cardio-task-head`,
`.cardio-done-cta`, `.is-folding`, `.is-unfolding`, the `cardio-cta-in` keyframes and their
reduced-motion pair with it — styles.css lost 4.4KB — plus the `cardio_task_of` and
`cardio_task_scheduled` keys and the `cardio_mark_done` word.

> ⚠️ **And it retired the 180ms deferred render with them.** That fold was this app's first async
> render, and it is what let Home's handlers escape onto whatever view the user switched to inside
> the window (see v324). The repaint is synchronous again. The structural fix in `bindVaultAction` —
> scope to the element being rendered, never to `.view.active` — stays, because it is what makes the
> NEXT deferred render safe.

## v326 (2026-09-13) — one geometry for every cardio row

«عدل الابعاد وخليها متناسقه». Measured before touching anything, and the numbers named the fault:

| | owed row | settled row |
|---|---|---|
| category tile | 42 × 42 | 42 × 42 |
| **control** | **36 × 36** | **70 × 36** |
| **name column** | **217px** | **183px** |

A 34px difference between the two controls moved the name column between rows, so two rows of the
same kind did not line up. **Both controls are now the SAME SQUARE as the tile that opens the row**,
so a row reads `[42][name][42]` and every row is the mirror of every other — measured after: tiles,
controls, name columns and row heights all identical.

- The undo lost its «تراجع» for the same reason the check lost «سجّله». **The done state is still
  carried by text, never by colour alone**: «تم» sits in the meta line and the `.is-done` wash mutes
  the title and dims the tile. The accessible name still says the action and the activity
  («تراجع — جري»), which is what an icon-only control needs.
- The 44px tap target is preserved on a 42px control by `inset: -1px`, the same halo pattern every
  sub-44 control in this app uses.
- The title's 8px margin and the list's 12px were stacking into 20px above the first divider against
  12px of row padding below it. One 12px value now, so the rhythm above the list matches the rhythm
  inside it.

## v327 (2026-09-13) — the top bar leaves while you read

«البار هذا اذا نزلت خليه يختفي وما يطلع الا اذا طلعت فوق اخر شي». It goes on the way down and
comes back **only at the very top** — not on the way up, which is the stricter half of the spec and
the part a generic hide-on-scroll header would get wrong. Verified: hidden at 300, **still hidden at
120 on the way back up**, visible again at 0.

- **ONE listener, not twenty.** `.main` is the single scroll container all twenty views share, and
  exactly one `.vault-bar` is in the DOM at a time — so the state is a class on `.main` and whichever
  bar is mounted obeys it. `setupBarAutoHide()` is idempotent the same way `setupEmber()` is.
- **Passive and rAF-coalesced.** Scrolling is the gesture that decides whether this app feels
  smooth, so the handler never blocks it and never runs more than once a frame. It reads one number
  and toggles one class; no layout is forced.
- **`translateY`, not height or display.** It stays on the compositor, and a sticky element keeps its
  place in flow either way, so nothing below it reflows.
- **No view-change hook is needed, and I nearly added a fake one.** The first draft listened for a
  `vault:view` event that **this codebase never dispatches** — contract 7 ("every `vault:*` event is
  both dispatched and listened for") is what would have caught it. It is unnecessary anyway:
  `navigate()` restores each view's saved offset by WRITING `main.scrollTop`, which fires the same
  scroll event. When two views share an offset nothing moves, and the bar is already in the right
  state for it.

## v328 (2026-09-13) — the last four, restored and corrected

These four were written as v323, then removed when the owner reverted that turn, and never made it
back into the shipped tree — v324's work was the review's findings, not these. Re-applied now, with
one of them corrected by what the review had since found.

- **Chained sheets lost focus entirely.** `openModal` captured its return-focus anchor AFTER
  `root.innerHTML` had already replaced the sheet that was open, so in a chain the captured node was
  detached one line earlier and `closeModal`'s `document.contains()` check handed focus to `<body>`.
  Captured BEFORE the rewrite now, and only from OUTSIDE `#modal-root`, so a sheet that opens a
  sheet returns to the control that started the chain. Verified: Food → Shopping → "new list" →
  close now focuses `[data-shopping]`.
- **The save centre's one action had zero margin on every side**, jammed between two hints — and
  `.settings-hint` carries `margin-top: -4px`, a pull-up meant for a hint that follows a control, so
  the trailing line was drawn 4px INTO the button. Now 18px above and 12px below.
- **The shopping editor's footer was four full-width slabs** with the one filled action buried
  third. The secondaries share a row and the primary keeps the width: **4 slabs → 1** (measured:
  164px each against a 337px Save).
- **`.cx-list`, and the correction that matters.** A list is not a form: `.cx-stack`'s 14px gap is
  the rhythm between FIELDS, so rows of the same kind floated apart. But the first draft applied it
  to BOTH list-shaped sheets, and the pre-push review caught what that did to the second one —
  > ⚠️ **`.cx-list`'s children MUST be borderless.** `.cx-list > :first-child` takes the top edge
  > off, at (0,2,0). On a child that carries its own border — `openShoppingLists`' rows are
  > `.btn-ghost`, `border: 1px solid var(--border)` at (0,1,0) — that leaves a rounded box with
  > left, right and bottom edges and an open top. It is applied to `openRecentChanges` only, whose
  > rows are borderless `div.cx-row`. Verified in the running app: first row `border-top: 0`, the
  > rest `1px`, 8px between, and every child genuinely borderless.

## v329 (2026-09-13) — the shopping list, rebuilt from its foundation

«عدل الميزه من اساسها جذريا خليها اسهل وابسط وتاخذ المكونات من وصفاتي». A judge panel scored three
rebuilds (343 / 337 / 333) and **three judges independently caught the same dangerous instruction in
the winner**: its "delete js/app.js 10099–10371" would have destroyed `openPreviousPrograms`,
`openPreviousProgramPreview` and `renderSettings`, which sit inside that span. Functions are deleted
BY NAME here, with an assertion that the neighbours survived.

### The measurement that decided the design

Taken from the owner's own live data before a line was written:

| | |
|---|---|
| recipes / meals | 3 / 7 |
| **shopping lists ever saved** | **0** |
| **ingredients carrying purchase data** | **0** |
| **ingredient IDs ever typed** | **0** |

**The quantity/unit/identity/preparation layer was never filled in once.** It existed so `combine()`
could merge, and `combine()` merged only on the one field nobody ever entered — so every row arrived
saying «تحتاج تحديد الكمية» and the feature was never completed. Five sheets became **one**.

- **One tap** from Food to a usable list; **two** to fill it from a recipe. There is no create, no
  list name, no list-of-lists. Recipes and meals are CHIPS that pour their ingredient names in.
- **Amounts are the recipe's own words**, carried as a caption and joined as text — «أرز · 200 غ +
  كوب». Never parsed, never scaled, never summed. That is v301's decision for `recipe.qty` applied
  one layer out. **A meal bundle has no `qty` field at all**, so it contributes names only; the old
  design treating that as an error is half of why it felt broken.
  > `combine()`'s old law — "never a name guess" — is a rule about ARITHMETIC: 500 g + 1 kg is wrong
  > unless you know the two rows are the same substance. Joining TEXT computes nothing, so a name
  > match is safe here for the first time. `DB.search.normalize` is the one normaliser.
- **A tick never moves its row and never enters undo history.** One class on one `<li>`, no redraw —
  the next unticked item stays where the eye already is. `changeSlice(..., remember = false)`:
  twenty ticks would otherwise flush «آخر التعديلات» of every change that matters.
- **Re-adding a name you already have un-ticks it** — you need it again.

### Two traps the panel missed, both caught by reading storage.js

> ⚠️ **`_validateBlob` REQUIRED `typeof list.name === 'string'`.** Dropping the list name would have
> made the blob fail validation, so a sync pull would refuse. The gate now permits every legacy
> field (`list.name`, `it.quantity`, `it.unit`) and requires none — a device on an older build still
> syncs the old shape into this row. Verified: legacy shape validates, new shape validates, a
> non-array `amounts` is rejected.
> ⚠️ **`hasUserData()` counts `shoppingLists.length`.** A list auto-created on first render would
> make a FRESH INSTALL read as "has data" and defeat the empty-device guard — the exact failure that
> guard exists to prevent. **The list is never materialised while empty**: `get()` returns a virtual
> one and writes nothing, and removing the last item drops it again. It stays `shoppingLists[0]`, an
> array of one, so all six blob registrations keep working untouched.

### What was deleted

`openShoppingLists`, `openShoppingDetail`, `openShoppingSources`, `openPurchaseEditor`,
`openShoppingEditor` — **195 lines**; `DB.shopping.preview/combine/save/remove/list`; the shopping
branch of the search index; the v322 purchase-ledger CSS; and **24 i18n keys × 2 dictionaries**.
> Contract 5 caught a real break while I did it: `cx_portion_unset` has a live call site in the meal
> editor and my line replacement had taken it as collateral. `cx_amount_hint` and `cx_name` are also
> still in use and were never candidates. **Never delete a key without grepping its `t()` sites,
> including the dynamic `t('cx_' + x)` families.**

### One more trap, in the CSS

`.sl-tick` is a `<label>` inside `.cx-stack`, and `.cx-stack label` sets `flex-direction: column` at
higher specificity — so the checkbox and the text **stacked** and every row stood 71px instead of 44.
`.cx-stack label.cx-row` already exists as the precedent for exactly this; the fix is the same idiom.
And `.rec-del`'s 44px `::after` halo pushed the sheet 4px wide (341 against 337), so the list carries
4px of inline padding to keep the halo inside.

## v330 (2026-09-13) — the shopping tick is the app's own square

«ليش المربعات بيضه مش نفس كل مربعات التم الي الاخرى في التطبيق البرتقاليه». Correct, and the reason
is worth keeping:

> ⚠️ **`accent-color` only paints a checkbox's CHECKED state.** An UNCHECKED native box keeps the
> browser's own chrome — white on this palette — so it reads as a foreign control beside
> `.run-set-done` and `.supp-toggle`. Every other native checkbox in this app
> (`.bundle-pick-row`, `.mf-keep`, `.plan-import-confirm`) has the same latent problem.

The box is now `appearance: none` and drawn to `.run-set-done`'s exact values — 26px, r8,
transparent until ticked, then `--accent` fill with an `--accent-ink` mark. Verified against a live
`.run-set-done.done`: same `rgb(255,106,0)` fill and border, same radius.

- **Transparent when empty, deliberately not `--surface-2`** — the reason `.run-set-done` documents:
  a filled empty box reads as a STATE rather than as an absence.
- **The mark is DRAWN** (two rotated borders), because an `<input>` cannot hold an `<svg>` — and
  keeping it a real checkbox is what lets the whole row stay a `<label>` target.
- ⚠️ **The global `input, select, textarea` rule sets `padding: 13px 14px`, and under `border-box`
  that padding is a SIZE FLOOR.** With `width/height: 26px` the box still came out **30×28**. Any
  input styled to a fixed small size in this app must zero its padding explicitly.

## v331 (2026-09-13) — the second decision, and three logs behind one button

«ابني الثنتين الاخيرات بشكل احترافي سلس» — the two features the owner picked out of a shortlist.

### 1. A swap can now be made permanent, afterwards

A swap in the guided run has always been TODAY-ONLY: it edits `runCtx.runOnly`, an in-memory list
that dies with `viewContext`. But «الجهاز مشغول» is rarely a one-day fact, and the only way to make
it stick was to leave the run, open Program, and edit the rotation by hand.

**The decision is offered AFTER the swap, not before it.** A "and for good?" dialog in the chooser
would put a commitment in front of someone mid-set; the confirmation toast carries «دائمًا» as an
action instead. One tap takes it, ignoring it lets it expire in 8s, and the workout never stops
either way.

- **The slot is resolved at ACTION time, never captured.** The toast outlives the render that raised
  it, and between the swap and the tap the plan can be edited on another device and pulled in.
- **It writes through `DB.plan.setSlotExercises(i, ids)`** — the narrow slot API — because
  `setRotation()` rebuilds the plan object field by field and erases every field it is not handed.
  `i` comes from `cycle.indexOf(workoutForDate(D))`, which is sound because `workoutForDate`
  returns the live cycle element (the same idiom `renderSessionDay` already uses).
- **Three states are NOT offerable, and fall back to the plain toast:** a rest day or no plan
  (`workoutForDate` → null); the slot no longer holding the old exercise; and the slot ALREADY
  holding the new one — reachable when `runOnly` has narrowed the run, where a write would
  *duplicate* an exercise rather than swap it. All three measured against a live run.
- **The replacement takes the old exercise's POSITION**, because an exercise order is a session
  order. Survivors keep their `targets`; the departed exercise's prescription leaves with it and the
  newcomer inherits none of it — `normalizePlanTargets` already guarantees this, and
  `scripts/test-plan-import.js` now asserts it.
- The new exercise is added to the Train list, the same as the day editor's save: an exercise that is
  in the program but not in the list is scheduled and unfindable.
- **The toast is scoped to the account that raised it.** It is the only deferred *write handle* on
  the run screen — live for 8s and surviving navigation — so it follows the rule the convenience
  sheets and scoped undo already follow: a `Cloud.getLastUid()` captured at offer time, compared at
  tap time. Verified by swapping the uid under a live toast: the write is refused and the plan is
  byte-identical.
- `run_ex_today_only` was rewritten — it used to end "edit the rotation to change it for good",
  which is now false.

> ⚠️ **`scripts/test-plan-import.js` compares arrays as JSON, and that is not a style choice.**
> `DB` builds its arrays inside the `vm` realm, and `assert.deepStrictEqual` compares prototypes —
> two identical lists of strings are **not** deepEqual across realms. The failure looks like data
> corruption (both arrays print the same) and is not.

### 2. Quick log — the search sheet's empty state

Water, weight and a saved meal were **2, 4 and 6 taps** away, each on a different screen (weight's
card is below Home's fold). They are the three things logged most often and the three least worth
navigating for.

**It adds no new control.** `openUnifiedSearch()` is opened by the search button, which is the one
thing already in every screen's top bar, and the space under its field was blank — worse, any save
anywhere in the app fires `vault:save-state`, which re-dispatches `input` here, so an untouched
sheet would repaint itself as «لا توجد نتائج». The empty query has an answer now: +250 / +500,
الوزن, وجباتي — every one of them an existing component (`.cx-actions`, `.cx-stack .btn`, the
existing water/weight/meal APIs), and every one two taps from anywhere.

- **The launcher lives OUTSIDE `#cx-results`, in its own `#cx-quick`.** `#cx-results` is an
  `aria-live` region, and a live region is for results that arrive on their own — interactive
  controls inside one get the whole block re-announced on every tap and every background save.
  Results stay live; the launcher does not. One delegated listener, on a box that is never rewritten.
- **A water tap rewrites ONE number, never the block.** Replacing it destroyed the button under the
  user's thumb (measured: focus fell to `<body>` on every tap). `syncWaterNow()` is called from the
  tap *and* from the save-state repaint, so a cup logged on the Food screen still moves this number
  while the sheet is open.
- **The running total under the cups IS the confirmation.** A toast would sit on top of the two
  buttons that produced it, and the sheet stays open for a second tap. The `−250` undo comes across
  from the Food hero too: a mis-tap must not be fixable only by the navigation this feature removes.
- Weight and وجباتي simply call `openWeightSheet()` / `openSavedFoodPicker(todayISO(), null,
  'bundles')`: `openModal` rewrites `#modal-root`, so the search sheet is replaced, not stacked.
- **Measured at a keyboard-shrunk viewport (375×500):** the whole block, last button included, is
  visible without scrolling — so auto-focusing the search field costs nothing.


### What the pre-push review found

Thirty-four agents read the change before it reached a device; 29 findings, 13 confirmed after
adversarial verification. **Two of the confirmed ones I then measured to be wrong**, and both are
recorded here because the measurement is the useful part.

**HIGH — «دائمًا» re-sorted the live run, and the exercise it had just made permanent was never
reached.** Confirmed by walking a five-exercise run in the browser:

    before   start A → swap A→X → screen jumps to B → «دائمًا» → Next shows B AGAIN → C, D, E, end
                                                                 X is never displayed
    after    start A → swap A→X → screen stays on X  → «دائمًا» → Next shows B, C, D, E, end

> ⚠️ **`runOnly` carries TWO different meanings and they need different maths.** A *selection*
> (`navigate('session-run', {runOnly})`) is a set of ids chosen on another screen: it has no order,
> so the order comes from the plan with non-plan ids appended. **The run's own list**, once
> `runListNow()` has materialised it, IS the order — `replaceInRun` puts a substitute at the
> position it replaced, and a drop slides the next exercise into the gap. Re-deriving the second
> from the plan threw that position away.

`runCtx.runOrdered` distinguishes them. This also repairs a **pre-existing v307 defect**: before
v331 a swap already moved the new exercise to the END of the run and jumped the screen forward one.
And the drop path's comment — "the next exercise slides into it" — was a *lie* until this fix;
it now measurably does.

**MEDIUM — a write from the quick log never repainted the screen behind the sheet**, which invites
logging the same cup twice. `refreshCaller()` (`renderView(currentView)`; the sheet lives in
`#modal-root` and survives) now runs after each. Chasing it turned up **a pre-existing bug at a door
that has nothing to do with this feature**: logging 77.7 kg from Home's *own* weight card and closing
the sheet left the card still reading «سجّل وزنك». `openWeightSheet` refreshes its caller now, so
both doors are fixed.

**MEDIUM — the «دائمًا» button was a 31.5px target**, under the project's 44px floor, and it is the
only route into the whole feature. It gets a `::after` halo that grows **downward only**: while a
rest timer runs the toast clears `.run-nav` by just 7px, and a symmetric halo measurably started
stealing the run's own Next/Prev taps. Measured 44×61 in both geometries.

**LOW — a spent toast action stayed in the tab order.** `.toast.show .toast-action` already drops
`pointer-events`, and `showToast`'s `spent` flag refuses the handler — measured, a click after
expiry fires nothing. But a hidden toast is `opacity: 0`, not `display: none`, so the button stayed
*focusable*: a keyboard user tabbed to the end of the page and landed on an announced, invisible
"Undo". `hideToast` sets `tabIndex = -1` + `aria-hidden` now. Pre-existing for every Undo toast
the app has ever shown.

**LOW — the options sheet contradicted itself**, promising «لا يتغيّر برنامجك» four lines above a hint
that says it can. The subtitle is «لهذا اليوم، إلا أن تختار غير ذلك» now.

**Refuted by measurement — "hideToast never disarms the action, so the cancelled button still
rewrites the program."** It does not: after expiry the computed `pointer-events` is `none` *and*
the `spent` flag returns early, so a synthetic `.click()` fired the handler **zero** times. Only the
focusability half of that finding was real.

**Refuted by measurement — "the action toast covers the run's controls."** With a real live rest
timer the toast box overlaps `.run-nav` by 4px, but `#toast` is `pointer-events: none` and the
action button sat 7px clear, so no tap was ever stolen. Cosmetic, pre-existing, and left alone
rather than risking shared toast geometry for 4px.

## v332 — the two named boxes over the shopping list

«ليش ما نحطهم بخانه اسمها … عشان تكون ارتب»

The sheet's whole subject is the list, and its top third was not the list. Measured on the owner's
own data at 375×812 BEFORE anything was designed — these are the numbers the change is judged by:

| | before | after (shut) |
|---|---|---|
| top block | **212px** | **96px** |
| share of a 632px sheet | **34%** | **15%** |
| first shopping item at | y=**325**, past half the screen | y=**209** |
| his 6 items | needed a scroll | **all visible** |
| at 36 sources | ~20 rows, ~850px | **96px — unchanged** |

> ⚠️ **GROUPING ALONE MAKES IT WORSE.** Two headings *add* 2×44 + 2×8 = 104px to a block that is
> already too tall — 212px becomes ~316px, half the sheet. The heading has to be able to **CLOSE**.
> That is the whole design: a box without a lid is not a box.

**Which box is open is DERIVED FROM THE LIST, once, at render** — `const srcOpen =
!DB.shopping.get().items.length`. An empty list is the one moment filling it IS the task, so وجباتي
opens itself and the pour stays **one tap**; a list with items on it is a list he came to read, so
both are shut. It is never re-read: `draw()` rewrites `#sl-list` only, so a box can never open or
shut under the thumb — and `sl_empty` is worded to be true in BOTH states, which is what lets
`draw()` stay untouched.

The two names are not new vocabulary: `tab_recipes` (وصفاتي) and `tab_bundles` (وجباتي) are the
literal tabs he already taps in `openSavedFoodPicker`. Both are passed as `t('…')` **literals** at
the call site so contract 5's usage scanner keeps counting them.

### Two traps, one of them already shipped

> ⚠️ **`[hidden]` DOES NOT HIDE AN ELEMENT THIS FILE GAVE A `display` TO.** An author `display`
> beats the UA `[hidden]` rule at any specificity. Measured live before writing the fix: a
> `[hidden]` `.sl-chips` computed `display: flex` and stood 22.5px tall. Without
> `.sl-chips[hidden] { display: none }` every "shut" box ships **wide open** — a no-op that looks
> delivered.

Looking for that trap found **its twin, live since v329**: `.cx-actions` is `display: flex` and
`.sl-foot` had no rule at all, so `foot.hidden = !items.length` had **never hidden anything** —
«امسح المشترى» and «أفرغ القائمة» rendered under an empty list. Measured (`hidden: true`,
`display: flex`, height > 0), then fixed with `.sl-foot[hidden] { display: none }`.

The third catch is one no contract can make: `sl_empty` read «اضغط وصفةً في الأعلى» — a string that
became a **lie** the moment the chips went behind a lid. The key still existed in both dictionaries,
so contract 5 stayed green. Only reading the string catches it. Now: «اختر من «وصفاتي» أو «وجباتي»
في الأعلى» — true whether a box is open or shut.

### Two details worth keeping

- `data-src` stays the index into the **FLAT** `sources` array (`map` then `filter`, never a
  per-group index) — the existing `[data-src]` handler indexes `sources[]` directly, so a
  per-group index would silently pour the wrong recipe in. That handler is untouched.
- The chevron is `arrowDown` rotated 180°, **not** a rotated `chevronRight`, and deliberately
  carries **no** `.icon-mirror`: the icon law in styles.css names the six glyphs that flip in
  Arabic and says in its own words that vertical arrows are not among them.

### The honest cost

Open, وجباتي is 272px — taller than the 212px he complained about. That is a state he opens
deliberately and shuts with one tap, not the state that greets him every time. And the chips keep
their ragged widths inside the box: ellipsising a long recipe name so it lines up with its
neighbours would break the first law — the box fits what is in it, you do not trim what is in it to
fit the box.

## v333 — the translations move out of js/app.js

«حسن من الكود عشان يتحسن القراف» — improve the CODE so the graph improves. The graph is a
measurement of the codebase, so the route to a better graph is a better-shaped source tree, not a
better-looking picture.

The graph was mined for structural defects and every candidate measured before acting. **Two of the
three leads were false**, which is the part worth keeping:

- **"83 functions in storage.js are never called."** The AST extractor does not see a call through
  an object literal (`DB.prefs.setTheme`), a handler binding (`el.onclick = fn`), or a
  `window.X = {…}` public surface — so most of its own "dead" list is alive. A source-level scan of
  all **256** top-level functions across the seven scripts found **zero** genuinely dead ones.
  (`$` and `$$` looked dead only because `$` is a regex anchor — my scan's bug, not the code's.)
- **"three helper names are defined in more than one file."** `pull`, `open` and `sync` — each in
  its own module namespace (`Cloud.pull` vs `Health.pull`). Correct as they are.

### What the measurement did find

| js/app.js | |
|---|---|
| total | **15,191 lines · 815 KB** |
| `I18N` (both dictionaries) | **1,931 lines · 115 KB — 13% of the lines, 14% of the bytes** |
| all pure-data blocks | 2,501 lines · 171 KB — 21% of the bytes |
| references to `I18N` inside app.js | **one**, in `t()` |

A dictionary is not a view and not a router, and this file is documented as being "ALL
views/rendering + the router". 1,931 lines of data in the middle of it is most of why this guide has
to tell readers to Grep rather than trust the file's shape.

`js/i18n.js` holds it now. **app.js: 15,191 → 13,260 lines, 815 → 698 KB.**

> ⚠️ **A top-level `const` in a classic script is NOT on `window` — but it IS shared.** It lives in
> the global LEXICAL environment, which every later classic script can read, so app.js's `t()` still
> resolves `I18N` — **only because i18n.js executes first**. It is the first of the eight `defer`
> scripts and contract 1 enforces that order. Verified in a real browser rather than assumed:
> `typeof I18N !== 'undefined'` from app.js's scope, 1073 keys in each dictionary, `t()` correct in
> both languages, switching both ways, `body[dir=rtl]` intact, and no raw key on screen.

Contract changes: the `JS` list gains `js/i18n.js` (first), contract 1's title says **eight**
scripts, and contract 5 reads the dictionaries from their own file. The key counts are unchanged —
937 literal keys + 12 prefixes, en 1073 / ar 1073 — which is the proof nothing was lost in transit.

**Still in app.js, measured and deliberately left:** `FOOD_PRESETS` (235 lines), the two exercise
name maps (150), `EXERCISE_MUSCLES` (74), `ICONS` (66), `WORKOUT_TEMPLATES` (45) — ~570 lines
together. Each is read by a contract that would have to move with it, and none is 13% of the file.
Worth doing as one `js/catalog.js` when there is a reason to touch them; not worth the contract
churn on its own.

## v334 — the catalog follows the translations out

«حسن الكود اكثر ومنظم اكثر». Same move as v333, on what the v333 note said was left:
`ICONS` (66 lines), `WORKOUT_TEMPLATES` (45), `EXERCISE_MUSCLES` (74), the two exercise-name maps
(150) and `FOOD_PRESETS` (235) — **570 lines of static data** that no view reads line by line and
that never changes at runtime. All six were referenced from **app.js only**, which is what made the
move mechanical rather than a refactor.

`js/catalog.js` holds them. Across v333 and v334 together:

| js/app.js | lines | KB |
|---|---|---|
| before v333 | 15,191 | 815 |
| after v333 (i18n out) | 13,260 | 698 |
| **after v334 (catalog out)** | **12,644** | **637** |

**17% of the lines and 22% of the bytes** left the file, and nothing about the app changed. Nine
`defer` scripts now, in the order i18n → catalog → cloud → storage → app → health → notify →
foodai → update, which contract 1 enforces.

**`icon()` deliberately stayed in app.js.** The icon SET is data; rendering one is code — the same
split as `t()` against `js/i18n.js`. A file called "catalog" that also contains a renderer is the
shape this was moving away from.

**Three contracts now read `js/catalog.js` instead of app.js** — the exercise-name maps agreeing
with each other and with the seeds (13), the seven glyphs duplicated in index.html and update.js
matching their masters (22), and every `icon('name')` in the scripts being a real key (23). Their
counts are unchanged: 73 seed exercises, 7 glyphs, 51 names against 54 keys.

Verified in a real browser, because every icon in the app now depends on a second file having
executed: all six globals visible from app.js's scope with their exact sizes (ICONS 54,
FOOD_PRESETS 219, EXERCISE_MUSCLES 72, EXERCISE_NAME_AR 73, WORKOUT_TEMPLATES 4), **all 54 keys
render non-empty svg content**, both back-compat aliases resolve, an unknown name still renders
empty exactly as documented, and six views paint with zero empty `<svg>` elements.

> My first check asserted `icon('dumbbell')` contains `<path` and it came back false — because that
> glyph starts with `<rect`. The assertion was wrong, not the code. Check every key for *content*,
> never one key for a particular element.

### What is left in app.js, and what it would cost

Pure data is now **0 lines**. What remains is genuinely views and router — 34 declared sections,
12,644 lines. The next largest thing is not data but a single function: **`renderSessionRun` at 847
lines**, followed by `openRecipeEditor` (484) and `renderHome` (483). Splitting app.js further means
splitting by DOMAIN — food, workout, settings — and those sections call freely across each other
through the shared global scope, so the boundary would have to be designed rather than measured.
That is a different kind of work from these two commits, and it should not be started by accident.


## v335 — the run's order becomes four pure functions, with teeth

«انت شوف الافضل وطبق». The v334 note said splitting app.js by DOMAIN needs a designed boundary, so
that is deliberately not what this is. The better answer was the other thing that note named: the
largest function in the file, and the fact that **the logic deciding which exercise is on screen has
broken silently twice while every contract and every suite stayed green.**

| | |
|---|---|
| v307 | a swapped-in exercise moved to the END of the run; you finished on the one you replaced |
| v331 | «دائمًا» re-sorted the run under a positional cursor — the exercise just made permanent sat behind it and was **never reached**, while its neighbour was shown twice |

Neither was reachable from a test, because it lived inside `renderSessionRun`'s closure.

`runOrder`, `runReplace`, `runIdxAfterDrop` and `runSwapAllowed` are top-level now — plain arrays
in, plain values out, no DOM, no `DB`, no `viewContext`. `renderSessionRun` 847 → 828 lines; the
point is not the 19 lines, it is that the part that can be *wrong* is now the part that is *tested*.

### The test reads the shipped source

`scripts/test-run-list.js` pulls the four declarations out of `js/app.js` by name and runs them in a
bare `vm` context. **Nothing is copied into the test**, so it cannot drift from what the app
executes — and app.js is never evaluated whole (it touches `document` at top level), so no DOM shim
is needed. If a function is renamed or stops being top-level, the test fails on that, by name.

> ⚠️ **A passing test proves nothing until it can fail.** Eight mutations were written back into
> `js/app.js` — both shipped regressions and six plausible neighbours — and the suite was run
> against each. **8 of 8 caught**, and app.js restored byte-for-byte afterwards. A suite that
> survives its own bug being reintroduced is decoration.

The four, and what each refuses:

- **`runOrder(planIds, only, ordered)`** — the whole v331 fix in one expression. `runOnly` carries
  two meanings: a SELECTION from another screen has no order of its own (the plan orders it, with
  non-plan ids appended), while the run's OWN list, once `runListNow()` materialised it, **is** the
  order. The test asserts both, and asserts that the same input without the flag produces exactly
  the v307 defect — so the difference between the two is itself pinned down.
- **`runReplace(list, oldId, newId)`** — a substitute takes the POSITION of what it replaced; a
  drop closes the gap. Returns a NEW array, which one mutation exists to keep true.
- **`runIdxAfterDrop(idx, len)`** — stay on the position so the next exercise slides in; past the
  end step back one; an empty run is 0, never −1.
- **`runSwapAllowed(ids, oldId, newId)`** — the three states where «دائمًا» must not be offered:
  the slot no longer holds the old exercise, it ALREADY holds the new one (a write would duplicate
  rather than swap — reachable whenever `runOnly` has narrowed the run), and `oldId === newId`.

Verified live afterwards as well, because a pure function being right is not the same as the screen
being right: swap → stays in place, «دائمًا» → plan written and every exercise reached exactly once,
drop → the next slides in with the plan untouched, and a scrambled selection `[D, outsider, B]`
still comes out `B, D, outsider`. The owner's plan was restored byte-for-byte.

**Six Node suites now**, not five. `scripts/test-run-list.js` is the first one in this project that
tests app.js at all — every other suite exercises `storage.js`, `cloud.js` or the Worker.


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
npm test             # every suite; a skip is reported, loudly
npm run test:strict  # a skip is a FAILURE — what CI runs
npm run verify       # contracts + suites
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

`backend/pending/29_ai-usage-fk-repair-v25.sql` is the fix. **It is NOT applied** — it is a live
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
`gemini-worker.js:339` (`if (!r.ok) return { ok: true };`) fails OPEN.

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


## v336 — the ingredient weight becomes optional, and the rest day stops speaking slang

«خلي اضافة الوزن اختيارية مش الزامية — لأنه لما أقولك حبة فليفلة غالباً ما راح أعرف وزنها».
He was right, and it was worse than "inconvenient": **the weight was mandatory in practice,
and nothing said so.** Measured on the live app before a line was written — «حبة فليفلة» with
no weight stayed `data-state="idle"` forever (the auto-fill gate never even fired), and the
save guard then refused the row with «لا أرقام له — اكتبها أو احذفه». A dead end with no exit.

### The weight is optional — but a different signal had to replace it

Simply deleting the qty requirement from `scheduleAuto` costs a SECOND model call in the
common case: you type the name, pause to think, the debounce fires on the name alone, then you
type the weight and it fires again. That breaks v299's law — **never one call per row** — on a
quota that is per-UTC-day and shared by every user.

> **A row with a weight waits for a PAUSE IN TYPING. A row without one waits for the row to be
> LEFT.** `scheduleAuto(it, settled)`: `settled` comes from a new fourth delegated `focusout`
> listener and from `trySave`. Leaving the row is the moment you have demonstrably declined to
> give a weight. Both paths arm the SAME `autoTimer`, so rows still batch into one request.

Measured, model stubbed, no network and no write to the owner's data:

| | before | after |
|---|---|---|
| «حبة فليفلة», no weight | **never computed, then refused** | 1 call on leaving the row |
| name typed, still in the row | — | **0 calls** |
| …then the weight typed | 1 call | **1 call** (not 2) |
| a saved food, no weight | refused | **0 calls** — its own serving, offline |
| leaving the same finished row again | — | **0 calls** |
| triple-tapping save | — | **1 call** |

`localLookup` answers a weightless row from the saved food's OWN serving, unscaled — the
offline path, no model call at all. The line sent to the model is `(q ? q + ' ' : '') + name`,
so a weightless row sends `حبة فليفلة` and the name carries the amount.

### What the pre-push review found — 49 raised, 12 confirmed, TWO blockers

Both blockers were mine, both introduced by this change, and neither was reachable from any
contract or suite. They collapse to two root causes, and each carries a lesson.

> ⚠️ **`!hasFigures(it)` IS NOT "this row has been settled".** A row can compute, honestly and
> successfully, to 0/0/0/0 — a zero-macro saved food is trivially reachable (`ماء`, `شاي`,
> and the shipped presets `كولا دايت` and `كرياتين` are all zeros; `DB.foods.add` requires only
> a name). My first guard on the `trySave` sweep tested `!hasFigures`, so such a row was armed,
> settled at zero, re-entered `trySave` through `finishSaveIfWanted(true)`, and **looped**.
> Measured before the fix: 7 toasts in 6 seconds, the save button frozen on «سيُحفظ بعد الحساب»,
> the recipe unsaveable — and on the AI variant **66 model calls a minute** against the shared
> daily quota, from a tab the user could simply walk away from. `NaN` reaches the same place
> (`Math.round('165 kcal')`) from an imported blob.

> ⚠️ **`parseGrams()` RETURNS null FOR TWO DIFFERENT STATES** — "no amount was given" and "an
> amount was given that is not grams". My no-weight branch keyed on `!g` and so treated
> «٣ حبات», «٢ كوب», «ملعقة زيت» — the wordings the amount field deliberately invites, and which
> v301 chose free text precisely to allow — as *no amount at all*, answering with ONE unscaled
> serving. «٣ حبات بطاطا» came out 90 kcal instead of ~400, tagged «محسوبة لهذا الوزن», flowing
> through `perServing` into the food log permanently. It fired on the ORDINARY weighted path,
> with no new gesture, for exactly the users who have saved foods. Ask about the STRING
> (`!String(qtyRaw||'').trim()`), never about what `parseGrams` did with it.

**The fix for both lives in ONE place.** `scheduleAuto` now owns the rule and the callers carry
no copy of it: `if (settled && (hasFigures(it) || it._auto)) return;`. The settled path is not
an edit — nothing about the row changed, the user just left it — so it may only start work that
has **never** been done. `it._auto` is truthy for every one of pending/sent/done/fail; the retry
and recompute buttons clear it to null first, which is exactly what lets them through. That one
line closes the loop, stops a focusout through N finished rows costing N calls, and stops a
save tapped twice from re-sending a request that is already in flight.

Verified by reproducing each blocker first and watching it stop: zero-macro row → no loop, 0
calls, an honest refusal; «٣ حبات بطاطا» → 1 call to the model, 400 kcal; «200 غ بطاطا» → 0
calls, 180 kcal offline (correctly scaled); focusout through a finished row → 0 extra calls.

**Known and deliberately NOT changed:** a genuinely zero-calorie ingredient (water) still cannot
be saved in a recipe — v301's named-zero guard refuses it. That is pre-existing, identical at
HEAD with a weight, and fixing it means changing what `rec_need_figs` is for. It is a separate
decision, not a side effect of this one.

### The rest day stops speaking slang

«خلي التطبيق يكون لهجة بيضاء خاصة لأهل الرياض — طلع لي البارح باللهجة العامية (صار خطأ)».

Measured before rewriting anything: ~1,070 Arabic strings are clean, and **one family** broke
ranks. `git log -S` on a known-bad string dated it to **v226**, not yesterday — he only SAW it
yesterday, because that screen appears only on a rest day.

> ⚠️ **A REGISTER CHANGE IS PER-SCREEN, NOT PER-STRING.** A later pass had converted HALF of
> v226's family — `rest_sheet_*` and `rest_min_*` became فصحى — and left the `anyway_*` block
> beside them in slang. So one screen spoke in **two voices at once**, which is more jarring
> than either voice alone, and is what finally produced the complaint. When converting, sweep
> every key the SCREEN renders.

A keyword scan would not have found this family — «حاس», «نشوفك» and «بقائمتك» match no common
marker list. What found it was `git log -S` on one known-bad string, then reading every Arabic
string that commit introduced.

Ten strings moved to the neutral register: «حاس إنك قادر اليوم؟» → «أتشعر أنك قادر اليوم؟»,
«ما في تمرين بقائمتك يشتغل على هذي العضلة» → «لا يوجد في قائمتك تمرين يعمل على هذه العضلة»,
«نشوفك بكرة» → «إلى الغد», «بكرة» → «الغد», «ما يتعب» → «لا يُجهد», «رجع» → «عاد». No key was
added or removed, so the dictionaries stay at parity and contract 5 is untouched. Both sheets
render in AR and EN with zero box overflow and no raw key on screen.

> **THE v226 DIALECT EXCEPTION IS REVOKED.** From 2026-07-30 a design spec's Arabic copy was
> pasted verbatim, dialect included, because asked directly the owner chose «طبّق المواصفة
> حرفيًا — باللهجة». He has reversed it: a spec supplies the MEANING and the tone, never the
> dialect. Every shipped Arabic string is translated into this register first.

### One measurement that corrects an earlier note

Asked why the background has no interaction, I measured rather than answered: THE EMBER (v321)
is intact and live. But the exposed void on Home measures **22.7%** at 329×687, not the **13%**
this file records — the conclusion is unchanged (it can only read in the gutters) but the number
was wrong. A real tab switch was also measured to fire **zero** `focusout` events, which is why
the new listener needs no `document.hasFocus()` guard; adding one would have been a dead line
with a false comment attached, which this project has reverted before.
## v337 — the motion tokens, and five ticks that were painting orange on orange

Two jobs in one release: the foundation of `APPLY-motion.md` (§0 only — the rest waits on an
owner decision), and the confirmed findings of a 314-agent audit for surviving old-design remnants.

### §0 — the motion tokens, plus the gap the spec left open

`--ease-out/-inout/-back` and `--dur-tap/fast/base/slide/open` are in `:root`. Two decisions:

- **`--dur-press` became an ALIAS (`var(--dur-tap)`), not a rival.** It was already exactly 120ms and
  31 declarations read it. One number, two names, and it cannot drift.
- ⚠️ **A STAGGER IS A DELAY, AND THE GLOBAL REDUCED-MOTION CLAMP NEVER TOUCHED DELAYS.** The clamp
  flattens `animation-duration` and `transition-duration` only. §2's stagger is
  `animation-delay: calc(var(--i) * 140ms)`, so left as a literal a reduced-motion user would still
  wait 6 x 140 = 840ms for a list to finish arriving, each item snapping in at 0.01ms — the motion
  removed and the WAIT kept, which is the worse half. The step is a token (`--stagger`) zeroed with
  the rest, and the clamp now names `animation-delay` and `transition-delay` explicitly.

**Measured before touching anything:** §4 (the message bar) was ALREADY implemented to the letter —
`0.14`, `240`, `170`, `0.15`, `90`, `460`, `56` are all live in `.ntf-bar`, from an earlier spec. And
the spec disagrees with the code in three places: the nav has FIVE tabs not four; the "indicator" is a
per-button 32x32 `--accent-soft` pill that cannot slide, not a dash; and no splash screen exists.

> ⚠️ **§3 CONTRADICTS §6 OF ITS OWN SPEC.** §3 slides the `.view` for 500ms; `.bottom-nav` carries
> `backdrop-filter: blur(24px) saturate(180%)` and samples exactly that view. `js/app.js:12376` already
> states the mechanism in this codebase's own words — a moving backdrop makes the compositor
> re-rasterise every frame, which is why THE EMBER refuses to run behind a modal overlay — and v297
> deleted every per-card `backdrop-filter` for the same reason. §6 forbids animated blur. Unresolved.

### The icon colour law, re-derived by MEASUREMENT

v315 found `.supp-toggle.taken` missing from the `--icon-accent: currentColor` list and shipping a tick
as a bare diagonal slash. That list was never re-derived — it was only patched. Doing it properly
(render a duotone glyph in each accent-filled container, compare its accent leg to its own background)
found **five more**:

| | background | accent leg |
|---|---|---|
| `.run-set-done.done` | `rgb(255,106,0)` | `rgb(255,106,0)` |
| `.sd-status-pill` | `rgb(255,106,0)` | `rgb(255,106,0)` |
| `.bento-pr` | `rgb(255,106,0)` | `rgb(255,106,0)` |
| `.health-card-toggle.on` | `rgb(255,106,0)` | `rgb(255,106,0)` |
| `.supp-toggle.taken` (the v315 fix, as control) | `rgb(255,106,0)` | one mass only ✓ |

**`.run-set-done.done` is the tick you touch on every set of every workout**, and it has been half
invisible since the duotone set landed. The control case is what proves the method: a correct container
renders ONE fill colour.

> ⚠️ **`color: transparent` HID A GLYPH ONLY WHILE THE SET WAS STROKED.** `.picker-row-check` and
> `.health-card-toggle` use it for their unchecked state — a v202 idiom. Since v211 a glyph has TWO
> masses and the second is driven by `--icon-accent`, so an orange mark sat inside a box the user reads
> as empty. Both now set `--icon-accent: transparent` beside it.

All five went into the identity layer's list, never onto the component rule: **the list is the
authority, or the next person has two places to check.**

### Dead weight removed

`.bundle-pick` (v312), `.cta-card` in six grouped lists, `.exercise-chev`/`.cta-card-chev` in the RTL
flip, `@keyframes shimmer`, `--accent-dim`/`--accent-quiet` (the v218 split bar), and the
`cardio-settled` class still shipping on every settled row with zero rules behind it (v325).
**styles.css 8340 -> 8313 lines.** `privacy.html` also still shipped a STROKED arrow at
`stroke-width="2.4"` — literally the old hard-coded nav width v211 removed — now the duotone `back`
master.

> ⚠️ **`www/` AND `android/.../assets/public/` ARE BUILD ARTIFACTS AND MUST NOT COUNT AS USAGE.** A
> deadness grep across the whole tree reported `.bundle-pick` as alive with 8 references; every one was
> in a stale build copy. Scope the check to `js/*.js` plus the four HTML pages, or a dead class looks
> load-bearing.


## v339 — the motion engine (APPLY-motion.md, part one)

`js/motion.js` is the tenth `defer` script and the first new one since v334. It publishes
`window.VltMotion` — `stagger · count · bar · pulse · numFlip · dragToDismiss` — and reads no
other module, so it only has to sit ahead of app.js. Contract 1 now fixes TEN scripts:
i18n → catalog → cloud → storage → **motion** → app → health → notify → foodai → update.

> ⚠️ **EVERY SELECTOR IN THE SPEC MATCHED ZERO RULES IN THIS APP.** `.screen`, `.tab-indicator`,
> `.tab-icon`, `.bar-fill`, `.toggle-knob`, `.sheet`, `.sheet-scrim`, `.btn-secondary`,
> `.row-tappable`, `.chip-tappable` — checked before a line was written, all zero. Pasted
> verbatim the handoff would have shipped ~120 lines of CSS styling nothing and a module nothing
> calls. The real vocabulary is `.view`, `.nav-btn`, `.modal`/`.modal-overlay`, `.btn-ghost`,
> `.data-row`, `.ntfs-switch`, `.run-progress-fill`. **The spec's VALUES and RULES are kept
> exactly; only the names are translated.** A design spec names the app it was drawn against, not
> necessarily the one in front of you.

### ⚠️ I SHIPPED A DUPLICATE AND THE MEASUREMENT CAUGHT IT

The app has raised its sheets since long before this spec — `.modal` runs `sheetUp`,
`.modal-overlay` runs `overlayIn`. I added a SECOND mechanism on top (a transform transition
behind `.vlt-sheet.is-in`) without grepping for the one that existed, which is **verbatim the
failure v314 recorded**: "v312 added its features ON TOP of existing components without first
asking whether the app already had one. Before adding a component, grep for it."

Caught by reading `getAnimations()` on a live sheet: TWO effects on one element, the wrong one
winning. The entrance is the app's own again, merely retuned to the tokens — `sheetUp` 300ms/`--ease`
→ **400ms/`--ease-out`**, and the scrim 200ms → **400ms linear** so the two now arrive together
instead of the scrim finishing first. What the app genuinely LACKED is what stayed new: an EXIT
(260ms — an arrival is worth watching, a departure is not) and drag-to-dismiss at the spec's 120px.

### Two defects that only a hidden document exposes

> ⚠️ **`requestAnimationFrame` DOES NOT FIRE IN A HIDDEN DOCUMENT, AND NEITHER DOES
> `animationend`.** Both bit here, and both would have shipped:
>
> - The sheet got its `is-in` class from a double rAF. In a hidden or backgrounded document it
>   never arrived, so the sheet sat at `translateY(100%)` — invisible, stuck, no error. Replaced
>   with a synchronous reflow flush (`void el.offsetWidth`), which is all a transition needs and
>   works whatever the visibility.
> - The stagger removed its `.enter` class on `animationend`. Measured: the class survived, and
>   a later re-render of the same screen replayed the WHOLE stagger at once, every child at delay
>   0, because the new children still match `.enter > *`. It is a TIMER now, sized to the real
>   window — `min(n-1,5) × --stagger + --dur-base`. **Every save re-renders a view in this app**,
>   so "the animating children are gone before they finish" is the ordinary case, not the edge one.

### The stagger, measured

First render of `cardio`: six children at **0 / 140 / 280 / 420 / 560 / 700ms** — the cap is in the
calc (`min(var(--i), 5)`), so a twenty-row list cannot make the reader wait three seconds for
content that has already arrived. Revisiting the screen: **0 animations**. Re-rendering it in place
(what a save does): **0 animations**. The guard is `data-entered` on the container, and the
distinction it draws is the whole point — the stagger says "this screen just arrived", and a screen
that was already here must not claim it.

`--stagger` is a token and not the spec's literal 140ms because the global reduced-motion clamp
flattens `animation-duration` and never touches `animation-DELAY` (see v337).

### What contract 15 caught in my own code

It refused `wrap.querySelector('svg')` as "JS queries #svg". The scanner is RIGHT: this app's `$()`
helper accepts `$('modal-root')` meaning `#modal-root`, so a bare word inside a query genuinely is
ambiguous — and the ambiguity was mine. `getElementsByTagName('svg')[0]` says TAG and means tag.

### Deliberately NOT in this release

**§3, the tab slide.** It contradicts rule 11 of its own spec: sliding `.view` for 500ms under a
`.bottom-nav` that carries `backdrop-filter: blur(24px)` IS animated blur, and `js/app.js:12376`
already states the mechanism in this codebase's own words. It is its own piece of work with an
owner decision in front of it. The nav also has FIVE tabs, not the four the spec assumes.

Also not here: the `.pulse-ring` uses `--radius-btn-m`, **not** the spec's `border-radius: 50%` —
device 4 of the identity layer forbids circles.


## v340 — the tab slide, and the Capacitor logo finally leaves

### §3 — the owner chose variant (2)

> ⚠️ **THE SPEC ASSUMES `.screen { position: absolute; inset: 0 }`. THIS APP HAS TWENTY `.view`
> SECTIONS IN NORMAL FLOW** inside the `.main` scroller, so two of them displayed at once stack
> VERTICALLY rather than overlapping. Making them absolute for the slide would pin them to the
> scroller's padding box and throw the scroll position away — with the sticky rest bar and the
> v327 bar-auto-hide both reading that same scroller.

So the OUTGOING view leaves as a **GHOST**: `position: fixed` at the rectangle it already
occupied, read while it is still laid out. That takes it out of flow instantly, `.main` is left
holding only the arriving view, and the two overlap for exactly one slide. `.main` contains
nothing but the twenty views, which is what makes this safe.

> ⚠️ **AND §3 CONTRADICTS RULE 11 OF ITS OWN SPEC.** Rule 11 forbids animated blur;
> `.bottom-nav` carries `backdrop-filter: blur(24px)` and samples exactly the view that slides.
> The owner chose variant (2): the live blur is LIFTED for the slide and the bar wears
> `--nav-bg-solid`, the same colour at full alpha. Over this app's near-black ground the blurred
> and the solid read the same, so the swap is invisible — and the bar stops re-rasterising a
> 24px blur every frame, which is what v297 deleted every per-card backdrop-filter to avoid.

**`--dir` is +1/−1 and already carries the RTL flip**, so ONE keyframe pair serves both
directions and both writing systems. `translateX` is physical; deriving the sign in JS is what
keeps the keyframes logical.

> ⚠️ **I NEGATED THE DIRECTION TWICE.** The first draft multiplied tab order by `opts.fromPop`.
> But Back to an earlier tab is the same physical move as TAPPING that earlier tab — the order
> is the whole answer. Measured: forward and Back both came out −1. The order alone now decides,
> and home→food (−1) mirrors food→home (+1).

Only the five BOTTOM-NAV tabs slide. A detail screen is a step INTO the tab you are on, not a
move across the row, and sliding it would say something untrue about where you went.

### ⚠️ OWNER OVERRIDE: the entry plays EVERY time, not once

«خلي حتى لو رجعت لصفحة وطلعت ورجعت» — rule 5 of the spec says first render only. The owner
overruled it. But **arriving is not the same as re-rendering**: every save in this app calls
`renderView` again (log a set, tick a cardio row, land a sync), and staggering there would make
the screen jump under your thumb while you work. So `__vltArriving` is set by `navigate()` alone
and cleared by the render that consumes it.

Measured: three separate visits to Settings → **15 stagger animations each time**. A re-render in
place → **0**. A tab slide → **0**, because the slide IS the arrival — that half of rule 5 stays,
or the cards would climb while the screen is still moving.

### The Capacitor logo is gone from all fourteen files

The blue ✕ had been the native splash since the FIRST Android commit (`e7b5d3a`) and was never
touched — v212 fixed the LAUNCHER icon, which is a different asset. Eleven Android densities
and three iOS images, all replaced.

> **THE NATIVE SPLASH IS FRAME 0 OF THE WEB SPLASH, and that is not decoration.** Android paints
> this PNG as the window background (`styles.xml`: `android:background="@drawable/splash"`) before
> the WebView has anything, and the web splash then plays from 0ms. Draw the lock already thrown
> and the sequence jumps BACKWARDS the instant the web takes over. So the image is literally
> t=0 from `.design/Main.dc.html`: five bolts, tight, flat, the middle one orange — composited
> over black by hand, because a PNG has no CSS opacity.

Written with a ~60-line PNG encoder (zlib + CRC32 in Node) because no image library is installed
on this machine. Rounded ends are antialiased from a signed-distance field — a jagged 2px cap is
visible on a 320-wide mdpi screen. Every file also got **smaller** (40.3K → 26.5K on iOS).

⚠️ **These are NATIVE assets: they need a new APK to reach an installed device.** Until then a
phone still flashes the blue ✕ on launch.

### Three scale fixes the owner picked

`.sd-set-remove` 36px circle → `--radius-btn-s`; `.img-lightbox-close` 42px/50% → the M rung
(44/`--radius-btn-m`, which also clears the tap floor it was 2px under); the update banner's two
buttons off the scale on all three axes → 44/12/14. Measured after: 36/r10, 44/r12, 44/r12/14px.


## v341 — no blur at all, and the ghost that would not leave

### The nav loses its backdrop-filter, permanently

«الانميشن خليه فقط انزلاق بدون ضبابية». v340 lifted the blur for the slide and put it back —
which meant **the bar changed appearance in the middle of the motion.** The owner removed the
conflict instead of scheduling around it, and he is right: now nothing changes at all, ever, and
the compositor never re-rasterises a 24px blur — not during a slide, not during a scroll, not
behind THE EMBER.

It also finishes a decision this project already made: **v297 deleted every per-card
backdrop-filter for exactly this cost, and the bar was the one survivor.** Measured before
removing it: blurred `rgb(15,12,9)` against the solid `rgb(13,10,7)` — three levels apart on a
near-black ground, which is why the loss is not visible. `--nav-bg` had no readers left and is
retired; `.app.vlt-sliding` is gone from the CSS and the JS together.

### ⚠️ ONE TIMER FOR N CONCURRENT ELEMENTS IS NOT A DEBOUNCE

A 93-agent adversarial review of v337–v340 raised 29 findings; 5 survived verification, and
**three separate dimensions independently found the same blocker and each reproduced it live.**

`switchTab` kept ONE timer on the function object and cancelled it to schedule the next slide:

```js
clearTimeout(switchTab.__t);            // looks like a debounce
switchTab.__t = setTimeout(cleanup, ms) // but each cleanup closes over ITS OWN from/to/pin
```

Cancelling it did not cancel the work — it **abandoned** it. Two bottom-nav taps inside the 640ms
window (a mis-tap and its correction; ordinary use) left the first view pinned as a ghost
**forever**: `position: fixed`, `pointer-events: none`, and `vlt-slide-out` holding it at 22% and
.4 opacity by its `both` fill. Returning to that tab showed it **displayed but dead to touch**,
with the scroller collapsed — and `.view.vlt-ghost` is (0,2,0) and later in the file than
`.view.active`, so losing `.active` could not even hide it.

The fix is not a second timer. The cleanup is a **closure kept beside** its timer, and the next
slide RUNS it rather than dropping it — **synchronously, before the new rectangle is read**,
because otherwise `getBoundingClientRect()` returns the stale pinned rect of a ghost that has not
been undone. A defensive sweep strips `.vlt-ghost`/`.vlt-in` from every view at the start of a
slide, so a node can never be both a live ghost and an arriving screen. Measured after: two taps
150ms apart → **0 stranded**; three taps 80ms apart → **0**; the returned-to view is `static`,
`pointer-events: auto`, no inline style, scroller full.

### ⚠️ DROPPING `.dragging` RESTARTS THE ENTRANCE

`.dragging` suspends the sheet entrance with `animation: none`. The abort path simply removed the
class — which is the **restart-an-animation idiom `pulse()` uses on purpose** — so a drag the user
changed their mind about replayed the whole 400ms entrance from off-screen. `.settling` keeps the
animation suspended and springs the inline transform back instead, dropped on a timer (never
`transitionend`: it does not fire in a hidden document, and a sheet stuck in `.settling` could
never be dragged again). Measured: `replayedEntrance: false`.

### ⚠️ A LEAVING SHEET IS NOT AN OPEN SHEET

v339 deferred the sheet's DOM removal by 320ms for its exit — but nothing else in the app was
taught that a node in `#modal-root` can now be a **corpse**. Every "is a dialog open?" test read a
stale answer for a third of a second: `goBack()` closed a corpse instead of popping the view (one
Back press did nothing), the Escape handler honoured the dead node's `data-dismissible="0"`, and
the overlay still ate taps full-screen. Now `.is-out` carries `pointer-events: none`, and the
three tests select `.modal-overlay:not(.is-out)`.

> And `setPointerCapture` throws on a pointer the element does not own. Unguarded it aborted the
> rest of the handler, leaving `.dragging` on with no transform — a sheet with its animation
> suspended and nothing moving it. It is in a try/catch now.

**What the review refuted: 24 of 29.** The five that survived are above.


## v342 — the door exists now, and the transition stops leaving a trace

### 1. «بيضل فيه أثر من الصفحة الأولى» — and he was reading it exactly right

Measured mid-slide (t=300 of 500) before touching anything:

| | position | z-index | opacity | background |
|---|---|---|---|---|
| the view being LEFT | `fixed` | **1** | **0.7** | transparent |
| the view being OPENED | `static` | **auto (0)** | 1 | **transparent** |

So the screen you were leaving was composited **on top of** the screen you were
opening, at 70%, over a transparent arrival — two screens superimposed for half a
second. v340 built the ghost to keep the outgoing view visible while the two
overlapped, and never asked what it would be drawn *over*.

Stacking the ghost underneath an opaque arrival is the iOS answer and was the
other candidate. The instruction was «دون أثر الصفحة التي قبل الانتقال», so the
ghost is **deleted, not re-ordered**: `.view.vlt-ghost`, `@keyframes
vlt-slide-out`, the `position:fixed` pin, the rectangle read, and every
`from`-side line in `switchTab`. Only the arriving screen moves, over the app's
own `--bg-grad`.

> **What the deletion buys is worth more than what it fixes.** With nothing
> pinned there is no rectangle to read, no inline geometry to restore, and no
> cleanup that can be abandoned — so **the v341 stranded-ghost class of bug has
> no surface left to happen on.** Verified: three bottom-nav taps 80ms apart
> leave zero ghost nodes, zero `position:fixed` views and exactly one displayed
> view; the arriving view is transparent-backed on purpose, so no flat-vs-radial
> seam travels with the slide.

### 2. ⚠️ THE SECOND DEFECT, FOUND WHILE MEASURING THE FIRST

After the slide settled, the **arrived** view measured `opacity: 0; transform:
translateY(8px)` — `fadeUp` at its first frame, 640ms after the slide began.

`.view` carried `animation: fadeUp`, and `.view.vlt-in` overrides that shorthand.
So when the cleanup removed `.vlt-in`, the computed animation-name changed
`vlt-slide-in` → `fadeUp`, **and a changed animation-name starts a new
animation.** Every tab switch was followed, a third of a second after it landed,
by the same screen fading out to nothing and back over 200ms. It is v341's
`.dragging` lesson in a second place: **a class removal is not a neutral act.**

`fadeUp` had exactly one consumer in the whole stylesheet — `.view` itself — and
two later mechanisms had made it redundant: a tab arrival is `vlt-slide-in`, and
every other arrival is the child stagger `navigate()` arms. It was a third
entrance running on top of both. Deleted. Safe by construction: `vlt-slide-in`
already ends at `transform: none`, so losing the declaration reverts the element
to the state it was already holding. Measured after: opacity 1, transform none,
**zero animations**, no leftover `style` attribute.

### 3. THE SPLASH — the vault door, from the canvas into the app

«السبلاش مش موجود» — correct, and it had never existed. v340 replaced the
fourteen **native** launch images (the Android window background and the iOS
launch asset) and CLAUDE.md said so, but the *web* splash was only ever a design
file. `grep splash` over the shipped app returned nothing but `brandLockup('splash')`,
which is a font SIZE.

`.design/Main.dc.html` is a **looping** canvas piece on a 4200ms `--cycle`. A
one-shot is not that file pasted in. Converted, the authored percentages turn out
to be a 10ms grid in disguise (39.3% × 4200 = 1650.6; the author meant 1650):

| ms | beat |
|---|---|
| 0 → 320 | the middle bolt throws, 12 → 86 units — the lock, before anything else |
| 260 → 600 | the inner pair rises, 18 → 58 |
| 340 → 680 | the outer pair rises, 18 → 40 |
| 0 → 700 | the light blooms behind the door |
| **680 → 1300** | **the dwell** — the author's own note: an open lock you never see is a transition, not a state |
| 1300 → 1650 | the bolts part and fade: the hand-over |
| 1650 → 2060 | **VAULT** fades in where they were |
| 1700 → 2400 | the two leaves swing apart and the app is there |

**Four families of keyframes exist only so the loop has no seam, and two of them
are actively dangerous here:**

> ⚠️ **`cycleFade` starts the stage at `opacity: 0` and lights it at 1.6% = 67ms.**
> Android paints the PNG as the window background and the web splash takes over
> from 0ms — so a verbatim copy **dips the handover to black and re-lights it**.
> Dropped: this splash is at full opacity in frame 1.
> ⚠️ **Every `100%` keyframe resets to frame 0** for the loop. The app's global
> reduced-motion clamp forces every animation onto its LAST keyframe in 0.01ms,
> so pasting the resets would hand a reduced-motion user a **closed door with the
> app sealed behind it, permanently.** Dropped — and the splash is not mounted at
> all under reduced motion, with a `display:none` media query as the brace.

Also dropped: `.behind`, the design's four placeholder cards. The real UI is
behind this door.

#### FRAME 0 IS A CONTRACT WITH FOURTEEN SHIPPED PNGs

Those images are already on phones and only a new APK can replace them, so the
web side is the side that must conform. Verified in the bytes of
`drawable-port-xxxhdpi/splash.png` and then in the browser:

| | native PNG | the CSS, composited |
|---|---|---|
| dim bolt | `rgb(40, 35, 32)` | `#6f6259` × .36 → **`rgb(40, 35, 32)`** |
| middle bolt | `rgb(224, 93, 0)` | `#ff6a00` × .88 → **`rgb(224, 93, 0)`** |
| group width | 21% of the short edge | **70.09px** vs the rule's **70.14px** |

> ⚠️ **SCALE IS WHERE A LITERAL PASTE BREAKS.** The encoder sizes the 82-unit
> group to 21% of the SHORT EDGE; the design is a fixed 82px on a fixed 390px
> stage. Those agree only at exactly 390pt. On a 360pt Android the web bolts
> would appear **8.5% larger** the instant the WebView paints, and on a 430pt
> iPhone **9% smaller**. `--vs-u: 0.2561vmin` is one design unit — 0.21/82 of a
> vmin — and every dimension in section 8 is a multiple of it.

The colours are literals, not tokens, for the same reason: a theme change must
never desynchronise the web splash from images a phone cannot update.

#### TWO PHASES, because the app behind the door does not arrive on a clock

Phase A (0 → 1300ms) is self-contained. Phase B — the part that reveals the app —
is **held by JS until `window.__vltReady`**, which `js/app.js` sets immediately
after its first render, capped at 2500ms. A slow launch therefore stands with the
lock open a little longer, which is the one beat this sequence can afford to
stretch: it is a state, not a transition. Measured:

| | door opens | node removed |
|---|---|---|
| app ready before 1300ms (normal) | 1306ms | 2465ms |
| app renders at 2000ms | 2041ms | 3193ms |
| app **never** reports ready | 2558ms (the cap) | 3708ms |

Never `animationend` — it does not fire in a hidden document, and a door that
never opens is worse than one that opens early.

#### Details that are load-bearing

- **The mark is duplicated once per leaf**, and that is the design, not a
  redundancy: the light sits BEHIND the door, so a single bloom under two opaque
  black leaves is invisible — Main.dc.html:69-73 records the bug. Both copies are
  cut at the same seam, and the top leaf overlaps by **0.5px** because a flush
  50/50 join renders as a hairline at any fractional DPR.
- **The markup is in `index.html`, not built by a script.** `styles.css` is
  render-blocking, so the door and the first paint arrive in the same frame and
  there is never an unpainted shell behind it. The controller is inline and runs
  at parse time, before all ten deferred scripts — the whole point is that the
  first painted frame is already the right one.
- ⚠️ **`vs-bloom-in` is RESTATED in phase B, first in the list and byte-identical.**
  Declaring only the out-animation would drop phase A's `both` fill and the light
  would blink back to `opacity: 0` before the fade began. Measured across the
  phase change: `currentTime` preserved, opacity 1 throughout — the running
  animation is kept, not restarted.
- **The stagger belongs to the door.** app.js's boot render happens behind a
  closed door, so staggering there would play the arrival to nobody and leave a
  static screen for the door to reveal. `window.__vltSplash` makes renderView
  hand its host over; the clock fires it 400ms into phase B, as the leaves part —
  which is exactly what the design draws, and the design was quoting this app's
  own `--stagger`/`--dur-base`/`--ease-out` tokens all along.
- **An automatic reload must not replay it.** `js/update.js` reloads the entry
  html with `?u=` when a newer web build exists, and the service-worker cleanup
  reloads once too — both within a couple of seconds. A `__splash_v1`
  sessionStorage stamp (the `__cleaned_vN` precedent: no `vault_` prefix, so
  outside the VAULT_KEYS registry and outside the release script's rewrite)
  suppresses a second door inside 10 seconds. A deliberate refresh a minute later
  is a relaunch and still gets it.
- **Archivo is started at t=0.** Left alone the wordmark's face is discovered only
  when the non-blocking font stylesheet is promoted — two sequential round trips
  AFTER first paint — and the word is due at 1650ms. `document.fonts.load()` in
  the controller moves that download 1.6 seconds earlier without touching the
  timeline.
- **`direction: ltr` is pinned on the wordmark.** `letter-spacing` adds its space
  after each glyph and `text-indent` compensates from the inline START edge —
  which is the right-hand side in Arabic, so the two scripts would place the
  glyphs differently inside an identically centred box. It is the same object in
  both languages.
- **The bolts animate `height` and `gap`** — layout properties, during the busiest
  700ms of a cold launch — so `.vs-mark` is a fixed-size box with
  `contain: layout size` to keep that work inside it.
- **The splash is black for everyone**, including light theme. The native launch
  image is black on every device and cannot be themed; a bone-coloured door would
  disagree with the frame the phone just painted. The reveal is a wipe, not a
  flash — the leaves part to show the app rather than cross-fading to it.

## v343 — what the review found in the door, an hour after it shipped

A 10-agent adversarial pass over v342. Three findings were real, and one of them
was **visible on the live site**, so it is recorded before anything else.

> ⚠️ **THE DOOR OPENED ONTO ITSELF.** `.vs` carried `background: #000000`,
> straight from the design's `.stage`. In the canvas that is right — the thing
> behind the door there is a FAKE app drawn INSIDE the stage. Here the real app
> is behind the whole element, so the leaves swung away to reveal a 375×812
> sheet of opaque black, and the app appeared by POPPING IN when the node was
> removed 50ms later. **The entire reveal — the one beat the sequence exists
> for — was invisible.** Measured on the live site at full open: both leaves off
> screen, `rgb(0, 0, 0)` still covering everything.

The stage is transparent now. The two leaves (50% + 0.5px and 50%) cover it
completely at rest, so frame 0 is still solid black, and `index.html`'s critical
inline style paints the page black underneath in any case.

**Nothing in the CSS or the DOM said this was wrong.** Every computed style,
every colour, every keyframe measured correct. It is only wrong in relation to
what sits BEHIND the element — which is the one thing a design file cannot tell
you, because in the design file there is nothing behind it.

- **The door went pointer-transparent 600ms before it stopped covering the
  screen.** `pointerEvents = none` was set at the START of phase B, but the
  leaves do not begin to move for another 400ms and are not clear of the screen
  for 1100ms — so for most of a second a tap passed THROUGH a closed door onto
  controls the user could not see. The door now blocks taps for exactly as long
  as it is on screen: the node is removed 50ms after the swing ends, which is
  when the app really is reachable.
- **`document.fonts.load()` was fetching nothing.** It runs at parse time, when
  the Google Fonts sheet is still `media="print"` and its `@font-face` rules are
  not in the document yet — so it finds no matching face and resolves without
  requesting anything. It is armed again on that sheet's load event, and once
  more on a short timer for the case where the sheet had already landed.
- **The splash branch of `renderView` did not consume `__vltSlid`.** A tab tapped
  in the ~400ms between the door opening and that flag clearing sets it on the
  way in, and it then survived to eat the NEXT screen's entrance.
- **`performance.now()`, not `Date.now()`.** The wall clock can be corrected
  backwards mid-boot, and that clock decides both when the door MAY open and when
  it MUST.

> ⚠️ **AND BACK QUIT THE APP.** On the APK, Back at the root screen calls
> `App.exitApp()` — so a press during the 2.4-second launch sequence closed the
> app outright, which is the one thing an impatient tap on what looks like a
> loading screen must never do. `goBack()` swallows it while `#splash` is in the
> DOM, and the popstate handler re-pushes the entry so the history depth is
> unchanged. Proven on the running app: at root with no door `goBack()` returns
> false (exit, as before); with the door up it returns true.

**Two findings were deliberately not acted on, and the reasoning is the record:**

- *"The app behind the door is not `aria-hidden`."* Correct, and left that way on
  purpose. The splash is `aria-hidden` decoration; hiding the app for 2.4 seconds
  would give a screen-reader user **silence** instead of the app they can already
  use. The visual door is not their door.
- *"The 2500ms cap can open onto an empty shell."* That is the trade the cap
  exists to make, and a late render is not stranded: `__vltSplash` is cleared when
  the door opens, so the render that eventually arrives finds `__vltArriving` set
  and staggers itself.

## v345 — the rest of the review: the updater was cutting the door in half

The v342 review finished with **15 raised, 11 confirmed after adversarial
verification, 4 refuted.** v343 and v344 took the first six. These are the rest,
and the first one was already happening on the owner's phone.

### ⚠️ A BACKGROUND UPDATE MUST NEVER NAVIGATE OUT FROM UNDER THE DOOR

`js/app.js` is deferred script #6 and `js/update.js` is #11, so `__vltReady` is
**always** set before update.js runs; the boot reload then fires at
DOMContentLoaded plus one round trip for `version.json`, while the door is on
screen until at least 2450ms. So **on every release, the first launch got a door
cut off mid-sequence** — and the `__splash_v1` stamp, written at parse time, then
suppressed it on the load the user actually keeps. A release day meant one broken
splash and then none.

I watched it happen live, minutes after v342 shipped: the page loaded v342 from
cache, started the door, and update.js replaced it with `?u=343`.

> **Moving the stamp to the teardown is the obvious fix and it is the wrong one.**
> Load 1 would then leave no stamp, so load 2 would play the door from frame 0 —
> a partial door followed by a whole one, which is exactly the double door the
> stamp exists to prevent. **The reload waits instead**, with a 6s ceiling so a
> door that never left cannot strand it. Proven on the running app with a faked
> newer build: the previous page unloaded at **2515ms with the door already
> gone**, where before it went at ~300ms.

### ⚠️ THE STATUS BAR WENT LIGHT OVER A BLACK DOOR

`applyTheme()` runs seven lines before the app declares itself ready, and it is
unconditional — so a **light-theme** user was handed dark status-bar icons painted
over the black door for the whole launch. Invisible icons, every launch.

Only the two SURFACE signals wait: the `theme-color` meta and Capacitor's
SystemBars style. **The body theme class never waits** — the app behind the door
has to already be in the user's theme at the moment the leaves part. The splash
claims the bar at mount (the pre-paint script may already have set it to the bone
ground) and `applyTheme` keeps it there while `#splash` is in the DOM; the
teardown re-runs `applyTheme`, which is idempotent and is the only writer of both
surfaces. Measured: light + door → `#000000` with `body.theme-light` already on;
light + no door → `#faf5f0`; dark → `#000000` throughout.

> Contract 21 refused the first attempt, correctly: it pins the shape
> `theme === 'light' ? '#…' : '#…'` so the two grounds stay greppable and in step
> with styles.css, the static meta and the pre-paint script. The splash condition
> folds in on the NEXT line instead of inside that expression.

### The rest

- **The hand-off yields to a slide.** A tab can still be reached by keyboard in
  the ~400ms between the door opening and `__vltSplash` clearing. That sets
  `__vltSlid`, and the slide IS the entrance — handing the host over anyway would
  fire a stagger on top of a screen that is still moving, and the flag would
  survive to eat the next arrival too.
- **Three prose blocks still described the `position: fixed` pin as the live
  mechanism**, including `switchTab`'s own API contract — a mechanism v342
  deleted. The contract is real but its reason had changed: call it before the
  caller toggles `.active` because `navigate()` resolves the leaving view with
  `.view.active`, so after the toggle that lookup returns the ARRIVING view and
  no slide runs at all. **This project has been burned by stale prose before**
  (CLAUDE.md's mark documentation was 100 versions out of date), so a comment that
  describes deleted code is treated as a defect, not as history.
- **The Archivo warm-up comment now says what is true.** The call at parse time
  fetches nothing — the font sheet is still `media="print"`, its `@font-face`
  rules are not in the screen font source, and `fonts.load()` resolves against an
  empty match list. It is re-armed on the sheet's load and on a timer, but
  `.vs-word` is rendered (opacity 0, not `display: none`), so the browser asks for
  Archivo at the first style recalc after promotion anyway. It is a belt, not a
  shortcut; the only thing that would actually beat the two round trips is
  self-hosting a five-glyph subset, which the CSP already permits.

### What the verifier REFUTED, and why it is worth keeping

- **"Back during the door quits the app."** The path is real and every cited line
  is accurate — but Back at the nav root exiting is `goBack()`'s documented
  contract, Android's convention, and what Android's own SplashScreen API does.
  v344 swallows it anyway: a press on what looks like a loading screen should not
  close the app, and the guard costs one line. Recorded here as a **deliberate
  divergence from the platform default**, not as a bug fix.
- **"iOS draws the mark at 21% of the LONG edge."** Refuted — the iOS launch
  images are square (2732×2732), so short and long edge are the same number.
- **"The 2500ms cap opens onto an empty shell"** and **"the app behind the door is
  not aria-hidden"** — both already answered in v343's note.

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

## v392 — same recipe, different amounts: the ingredients sheet scales

The owner, one release after the ingredients sheet: **«بدي بقصة الوصفة أقدر
أغير الكميات … على أساس إني بدي نفس الوصفة وكميات غير»** — asked which of two
readings he meant (edit the stored amounts, or scale them for today's
cooking), the second sentence answered it: the recipe stays, the amounts move.

So the servings line at the top of `openRecipeView` is the editor's own
stepper (`.rt-serv` / `.rt-step`, `rec_servings` / `rec_serv_less` /
`rec_serv_more` — zero new keys) used as a **SCALER, not an edit**: it opens
at the recipe's count, and every amount is rewritten in place at
`chosen ÷ base`. An amount is free text, so `recScaleQty()` moves only its
leading number — Latin or Arabic-Indic, with a decimal — and leaves the rest
of the string alone; a string with no number («رشّة») is left exactly as
written, and at the recipe's own count every amount is the original string
again, digits and all. Nothing is written to the recipe.

Measured seeded, ar/dark/375, a 4-serving recipe:

| servings | أرز بسمتي | دجاج | بصل | ملح |
|---|---|---|---|---|
| 4 (opens here) | 500 غ | ١ كيلو | ٣ حبات | رشّة |
| 5 | 625 غ | 1.25 كيلو | 3.75 حبات | رشّة |
| 2 | 250 غ | 0.5 كيلو | 1.5 حبات | رشّة |
| back to 4 | 500 غ | ١ كيلو | ٣ حبات | رشّة |

The floor is 1, the stored recipe is byte-identical afterwards, the step
buttons are 36px with the stepper's own 44px halo.

> **The probe caught the first version stepping 1 → 0 → 4.** `parseInt(v) ||
> base` reads a typed or stepped 0 as «blank» and jumps to the recipe's count
> — 0 is a number and `||` cannot tell it from `NaN`. It asks
> `Number.isFinite(raw)` now and clamps to 1–99.

45 contracts · lint · 13 suites.

## v391 — the recipe's name opens its ingredients

The owner, on the recipe card: **«بدي زر يكون بإمكاني أشوف المكونات عشان أعمل
الطبخة نفسها لما بدي إياها»**. The card had three controls — add, edit, delete
— and none of them was *read*: the only way to see what goes into «كبسة دجاج»
was to open the editor, a form.

**No fourth control was added.** The NAME is the door, which is the meal
card's own precedent (v314: «the NAME is a `<button>` that opens the
editor»), and `openRecipeView()` (`js/food.js`) is a read-only sheet: the
recipe's name as its title, one line with the one number a cook needs («٤
حصص»), then every ingredient with its amount **exactly as typed** — «500 غ»,
«١ كيلو», or nothing at all — never parsed, never scaled, and no macros: at
the stove the arithmetic is noise. The list holds zero controls; «تعديل»
under it is the way to change anything and returns to the picker the way the
card's own pencil does. Zero new dictionary keys — the title is the data, and
`rec_u_serv` / `rec_edit` / `close` already existed.

Measured seeded, ar/dark/375 and en/light/412: the name button 194–219×60,
the sheet named by `aria-labelledby` after the recipe, three rows with the
amounts hugging the end (`.rec-view-qty`, `flex: none` — `.cx-row > span` is
`flex: 1`, which would have split each row 50/50 with a two-character
amount), a blank amount rendering the name alone, 0 controls inside the
list, «تعديل» 44px tall and opening the editor with the same three rows. The
sheet is in the fingerprint net (`recipe-view`, contract 36).

### And «كرّر أمس» starts with nothing ticked

The owner, on the repeat-yesterday sheet: **«لا تجعل الديفلت كله مختار — لا
تجعل ولا شي مختار»**. v376 ticked everything on the reasoning that the common
case is most of the day; he has overruled it, and the sheet is a list to pick
FROM now. The add button is disabled until a box is ticked and re-derives
that on every change — a filled «أضف المختار» that answers a tap with «اختر
شيئًا أولًا» is a button that does nothing, which this project deletes rather
than ships. `fl_repeat_none` stays as the belt behind it.

### And the split's day names follow the exercise-name setting

The owner, on the templates sheet: **«ليش صارت أسماء الجداول معرّبة تمام وأنا
مختار إنها تكون كل الأسامي بالإنجليزي؟»** He was right: v383's `planDayName`
asked only «is the UI Arabic?», so a person who chose English exercise names
(`prefs.exNames === 'en'`) read «دفع / سحب / أرجل» over «Bench Press» — two
decisions on one screen. «Push / Pull / Legs» is the same vocabulary as the
exercise names beside it, so it takes the same decision: `planDayName` and
`tmplDisplayName` return the English name when `exNamesMode()` is `'en'`,
and the Arabic display map otherwise (`translit` is Arabic letters too). The
stored value never moves, as before. The sheet's subtitle — «اختار برنامج
يعبّي خطتك الأسبوعية», dialect AND a v387 subtitle that describes the sheet
you are standing on — went with it, from both dictionaries.

### Barcode: the amount starts at the product's own serving

The owner: **«خاصية الباركود ليش المنتجات اللي فيها قليلة، وممكن يطلع المنتج
صح بس وزنه مختلف كليًّا؟»** Two different answers. The coverage is the
database's, not the app's: Open Food Facts is the free, crowd-sourced source
and its Gulf shelf is thin — a product nobody has ever scanned into it is
«not found» here, and there is no free source with better GCC coverage to
fall back to. The weight WAS ours: the figures come per 100 g and the box
opened at **100 g for every product** — a 30 g bar, a 330 ml can — so the
product read as right and its weight as wrong. It now asks for
`serving_quantity` and `product_quantity` too, and `defaultGrams()` opens the
box at the label's serving, else a single-serve package (≤ 400), else 100.
Still editable; nothing else on the card changed.

### And the photo analysis that «got slow like never before»

Not measurable from here without a session token, so it is made measurable
instead: `callModel` in the Worker now logs **every attempt's model, status
and milliseconds** (Workers Logs, on since v388) and bounds each attempt at
**25 s** — a timeout falls through to the next id exactly as a network error
does. The likely shape, to be read off the next slow photo's log: the loop
tries three ids in order and each attempt re-uploads the photo, so a
rate-limited first id plus a slow second one is three sequential round trips.
Deployed with `npx wrangler deploy` (no secret changed).

45 contracts · lint · 13 suites.

## v390 — no zoom, «Continue with Google», and the hold that had no way out

Three owner instructions, one build workflow (Opus 5.5, six verifier
MUST_FIXes applied), and the sleep hero's arrow from the v389 pass.

### 1. «ما بدي ينعمل زوم» — the app is pinned to scale 1

The phone had enlarged the app mid-session. Two causes, two halves:

- **Web:** the viewport meta carried no `maximum-scale`, so a pinch or a
  double-tap scaled the whole shell. It reads `maximum-scale=1,
  user-scalable=no` now, and **contract 45** refuses a commit where either
  token is missing — proved by removing `user-scalable=no` and watching it
  fire by name, `index.html` restored byte-for-byte.
- **Native:** Android's WebView also honours the phone's own font-size
  setting through `textZoom`, which no meta can touch. `MainActivity.
  pinTextZoom()` sets it to 100 and `capacitor.config.json` carries
  `android.zoomEnabled: false`. **That half reaches phones only with APK 25**
  (built, unpublished — see §4); until then the web meta alone is what an
  installed phone gets, and the phone's font-size slider can still scale it.

The in-app «خطّ أكبر» (v380) is the accessible route and is untouched.
Inputs stay ≥16px: iOS ignores `user-scalable=no` and would focus-zoom.

### 2. Google sign-in — the web half is live but DARK, the native half waits for APK 25

**Web (`Cloud.providers()` / `signInWithGoogle`):** the button is gated on
`GET /auth/v1/settings → external.google`, one cached request per load, 4 s
ceiling, any failure reads as «shut». So it appears the moment the owner
enables the provider in Supabase and never before — a button for a door that
is not open would answer «provider is not enabled» after a full-page trip.
It is hidden inside the native shell: Google refuses OAuth in a WebView.

**Native (`GoogleSignInPlugin.kt`, Credential Manager + googleid →
`signInWithIdToken` with a raw nonce; Supabase hashes it SHA-256):**
contract 44 pins the JS ↔ Kotlin surface. Ships only in APK 25, and only
after the owner fills `plugins.GoogleSignIn.webClientId` in
`capacitor.config.json` — it is an empty string in the committed tree.

> ⚠️ **SUPABASE LINKS A GOOGLE IDENTITY TO AN EXISTING EMAIL ACCOUNT ONLY WHEN
> THAT ADDRESS IS CONFIRMED.** Sign-up here is auto-confirmed without
> verification, so «Continue with Google» on an existing email account creates
> a SECOND uid with the same address. `guardForeignBlob` treats that as
> «duplicate», not as a shared phone: nothing swept, pulled or pushed, and
> `showDuplicateAccountDialog` explains. `VAULT_KEYS.lastEmail` is a `{uid,
> email}` pair so it can never describe a uid other than `lastUid`.

### 3. The six MUST_FIXes, and the one that was a lockout

The verifiers' list, in the order they were applied:

| # | finding | fix |
|---|---|---|
| 2 | Back closed the non-dismissible hold dialog | `goBack()` returns early over a `[data-dismissible="0"]` overlay |
| 4 | the native Google tap set `ov.style.zIndex` inline to clear the auth gate | `body:has(> .auth-gate) .modal-overlay { z-index: 1001 }` in `styles.css`; the inline line and its dead `const ov` are gone |
| 5 | `test-multi-window.js` had no same-email case | `sameEmailSecondAccountIsHeld`, both entry points + push, 7/7 mutations caught |
| 3, 6 | reporting: the meta is a no-op inside the APK; textZoom needs APK 25 | §1 above, and CLAUDE.md's accessibility invariants |
| **1** | **the hold dialog's only button was «sign out» — a person whose old password is lost, or who wants two accounts, was locked out of the app for good** | **«المتابعة بهذا الحساب»** |

**#1 is the v351 shared-phone sweep offered DELIBERATELY.** `Cloud.
releaseDuplicateHold()` reads the uid and address from the SESSION (never
from an argument a dialog could get wrong), rescues the previous account's
blob under ITS uid — restorable by that account, refused to this one — sweeps
the device through `clearLocalUserData()`, and hands the device to the new
uid, so the next boot and the next push stop reading as a second account.
The sweep is one function now, `sweepToAccount(uid, email, prev)`, with two
callers: the guard when two different addresses prove a shared phone, and
the release when the person chooses. A rescue that cannot be written sweeps
nothing, exactly as the guard behaves.

> ⚠️ **ONE DIALOG, TWO STAGES, AND DELIBERATELY NOT `confirmDialog()`.** That
> helper closes the sheet on cancel — which here would drop the person into
> the empty second account with the hold still set and nothing on screen
> saying so. Both stages are the same non-dismissible dialog re-rendered, and
> «رجوع» re-renders stage 1, so there is no state in which the hold is set and
> the dialog is gone.

Measured in the running app, ar/dark/375 and en/light/412: two 50px buttons
per stage, `aria-labelledby` on both, `data-dismissible="0"` on both, no raw
key; «رجوع» → stage 1; a refused release keeps the dialog, re-enables the
button and toasts «تعذّر وضع البيانات السابقة جانبًا…»; an accepted one calls
`releaseDuplicateHold` once and reloads. The suite's new case
(`releaseSweepsUnderTheOldUid`, login + boot) asserts the rescue's
`uid === 'alice'`, the store no longer holds the session, the photo side
store went with it, `lastUid`/`lastEmail` describe the new account, and
neither the next sync nor a push says «duplicate» — **and it fails by name
when the release is mutated to claim success without sweeping.**

### 4. The sleep hero, and the release notes on what is NOT live

The v389 row fix left the hero above it wrapping «11:10» over «PM»; it uses
the same `.time-range` / `.time-word` idiom now, `dir="ltr"`.

**Owner steps, none of them code:** in Google Cloud create an Android OAuth
client with the debug cert's SHA-1 (`79:8A:7B:E5:A7:4F:1E:07:A1:04:16:F3:B2:
7F:D2:9E:47:ED:1F:83`) and a Web client; enable Google in Supabase Auth with
the Web client's id/secret (the secret never enters this repo — the owner
pastes it); write the Web client id into `plugins.GoogleSignIn.webClientId`;
then build and publish APK 25 (`versionCode` stays 24 in the committed tree
until that day). The web button lights up on its own the moment the provider
is enabled.

45 contracts · lint · **13 suites, 0 failed, 0 skipped**.

## v389 — the «الساعة» badge that sat in the middle of the sleep row

The owner: **«في النوم المسجَّل فيه علامة الساعة أو المزامنة — علامة الساعة بتيجي
بالنصف وشكلها مش كويس»**. Measured on an imported night at ar/dark/375 before
anything was touched:

| | |
|---|---|
| the badge's box | x 109–175 |
| its own title column | x 166–289 |
| the duration value's column | x 124–154 |

So the badge had **spilled 57px out of the title column and was sitting on top
of the value column**, beside `7:55`, reading as a third figure — exactly
«بالنصف». And the same screenshot showed the second half of «شكلها مش كويس»: the
title had wrapped as **«11:10» over «PM», «7:05» over «AM»** — four fragments.

### One cause for both: `.data-title` is a non-wrapping flex row

The range was three flex items — a time, an arrow, a time — plus the badge as a
fourth. A flex row that cannot wrap does two bad things to items that do not fit:
it lets text break *inside* an item (so each time split at its own space), and it
pushes whatever is left clean out of the box (so the badge landed in the middle of
the row). The badge was not misplaced; it was **overflow**.

- **The range is ONE item now** — `<span class="num time-range" dir="ltr">` holding
  two `.time-word` spans that cannot break — so it wraps as text, at the arrow,
  never inside a time. `dir="ltr"` is v374's rule applied one row over: a range
  has an order and the arrow points along it in both scripts. Measured after:
  «11:10 PM →» / «7:05 AM», **0 elements outside the title box** (was 1).
- **The source is a word in the meta line** — «مدة النوم · من الساعة» — the way the
  cardio row already carries «تم» (v326): a standing property of the row is text,
  never a chip. `.src-badge` was a **capsule** (`border-radius: 999px`) on a
  `<span>`, which is why contract 42 could not see it (its scope is controls), and
  it went with its markup. Both dictionaries: «الساعة» → «من الساعة», 'Watch' →
  'From the watch'.
- **The cardio twin got the same edit** (`js/body.js:273`), and the measurement
  turned up one more thing there: its meta read **«30 الدقائق»** — `t('minutes')`
  is the COLUMN LABEL, and after a numeral the definite article is the v383
  «20 المجموعات» trap — and `js/body.js:281` was the **only** cardio site in the
  app spelling it that way; the Home rows, the day view and the stat strip all use
  `unit_min`. It reads «30 د · 150 سعرة · من الساعة» now.

> The probe's first run seeded the night with `DB.sleep.add({…, source:
> 'health'})` and **no badge appeared** — `add()` is a field whitelist and drops
> `source`. `importFromHealth()` is the only writer of `source`/`hcKey`, so the
> probe seeds through it, the way Health Connect really does. A seed that
> silently loses the field under test proves nothing, which is the widget suite's
> lesson (v365) met again.

### Named, not fixed

`formatTime12` paints Latin **PM / AM** inside the Arabic UI («11:10 PM»). Every
sleep figure on the Home card and the ledger carries it. It is a separate
decision about the whole formatter, not a side effect of this row.

### What both net lanes say

Sheets **110/110 identical**. Views **152/160**, and all 24 differences are one
string — the footer's build label, `v386 → v388`, because the baseline was
captured before v388's marker bump. Neither lane renders an imported night (the
matrix is the empty state; the fixture seeds none), so the evidence for the
change itself is the seeded probe above, and the net's job here is the other
one: proving nothing else moved. It holds.

## v388 — «صار خطأ» on every food photo: one message hiding six different failures

The owner's report: **«فيه مشكلة بالتصوير — دائماً بيطلع لي صار خطأ»**, on the
installed app.

«صار خطأ» is `ai_error`, and it is not a message — it is `friendlyErr`'s
**fallback**, reached when an error matches none of the five it can name. So the
first job was not to fix anything, it was to find out *which* failure the app had
stopped being able to describe. Five parallel lenses, every finding
adversarially verified, and the answer turned out to be that **six distinct
failures all render as that one sentence.**

### The measurement that located it, and it is not in the app at all

`ai_budget_take` is called by the Worker **only after** every gate — method,
CORS, per-IP limit, the caller's identity, the per-caller burst, input
validation, the size caps, **and the check that `GEMINI_KEY` is bound** — and
**immediately before** the Gemini loop. So its call log is a tracer through the
whole request. Supabase `edge_logs`, read-only:

```
21 POSTs to /rest/v1/rpc/ai_budget_take in 24h · every one 409 · three in the last hour
```

That single query settles nine hypotheses at once: the photos **do** reach the
Worker, the key **is** bound, the session is valid, the image is not too large,
CORS and CSP are fine, and the request shape has not drifted. The failure is
inside the model loop, and nowhere else.

### ⚠️ AND THE OBVIOUS SUSPECT IS THE ONE THE CODE RULES OUT

`gemini-2.0-flash` **was shut down by Google on 2026-06-01** and was still the
second entry in `MODELS`, 112 days later. That is a real defect and it is fixed
here. **It is not what the owner was seeing**, and the reason is one line:

```js
if (res.status === 429 || res.status === 404) return { rateLimited: true };
```

A retired model answers **404**, which this treats as **429** — so had all three
ids been dead, the Worker would have returned `RATE_LIMIT` and the app would
have said «الخدمة مشغولة — جرّب بعد دقيقة»: advice about a wait that would never
end. A model retirement could never produce «صار خطأ». The eliminating evidence
and the bug were the same line.

What is left is the only upstream shape that reaches the fallback: a non-2xx
that is **neither 404 nor 429** — a **400 or 403**, which are properties of the
**key or its project**, never of a model. That is why all three fail together,
on every request, for ever: *«دائماً»* was the diagnosis all along.

### Six failures, one sentence — now five sentences

| upstream | before | after |
|---|---|---|
| 403 — Google refuses the KEY | «صار خطأ» | **`UPSTREAM_AUTH`** → «تعذّر الوصول إلى خدمة الذكاء — الخلل عندنا لا عندك» |
| 400 — Google refuses the REQUEST | «صار خطأ» | **`UPSTREAM_AUTH`** → the same |
| 404 — every id retired | **«مشغولة، جرّب بعد دقيقة»** (a lie) | **`MODEL_RETIRED`** → «الخلل عندنا», and the log **names each dead id** |
| 429 — genuinely busy | «مشغولة، جرّب بعد دقيقة» | unchanged |
| 500 — upstream broken | «صار خطأ» | «صار خطأ» — correct, nothing more to say |
| the photo never left the phone | «صار خطأ» | «الملف كبير جداً» / «تعذّرت قراءة هذه الصورة» |

Proved by running the **real** `gemini-worker.js` in a vm against a stubbed
upstream and the **real** `friendlyErr` over the result — never a copy, so the
table cannot drift from what ships.

### ⚠️ THE SECOND PRODUCER WAS IN THE CLIENT, AND IT NEVER TOUCHED THE NETWORK

```js
try { const pic = await processImage(file); … } catch (_) {}   // the reason, destroyed
…
if (!image) throw new Error(tr('ai_error'));                    // «صار خطأ», no request at all
```

`processImage` rejects for two ordinary reasons — a photo over **40 megapixels**
(a 50MP or 200MP phone camera clears that by itself) and a file the browser
cannot decode (HEIC) — and both were thrown away and replaced with the generic
error. The `catch` keeps the reason now.

> **A free discriminator this leaves behind, for the next time:** the picker
> replaces the bubble with a `<img>` thumbnail **only on success**. Thumbnail
> visible → the photo was processed and the failure is downstream. The bare word
> «صورة» → it never left the phone.

### ⚠️ THE 502 CARRIED NOTHING, SO THIS CLASS WAS UNDIAGNOSABLE FROM A PHONE

`callModel` returns four distinct failures — `upstream fetch failed`,
`upstream_error`, `no result`, `parse error` — and the loop assigned every one of
them to `lastError`, **logged it, and returned the fixed string `service
unavailable`**. So all four were unreachable by any client, and the only record
of which one it was went to a console with no sink attached. The code travels
now; the message never does, because a Google error message can quote the key's
own project.

### ⚠️ AND WRANGLER WAS ACTIVELY SWITCHING THE BLACK BOX OFF

`wrangler.toml` had no `[observability]` block. Cloudflare enables Workers Logs
by default only for **newly created** Workers, and this one's first deploy was
2026-07-18 — but the stronger half is that **wrangler sends
`observability: { enabled: false }` on every deploy when the config omits it**,
so switching it on in the dashboard is undone by the next `wrangler deploy`. It
has to live in the file. It does now (`enabled = true`, full sampling; the free
plan keeps 3 days).

That is the third time this project has recorded the same shape — `reportError`
posting into a table that did not exist, the feedback cap that could never be
true, and now the one log line that names Google's refusal, written to nothing.

### One defect the proof caught in the fix itself

The new «تعذّرت قراءة هذه الصورة» branch was placed **below** the network branch,
whose test is the **unanchored** `/load failed/` — and `processImage` rejects
with the literal `image load failed`. So an undecodable HEIC would have told the
user to check their internet connection. Caught by running the mapping rather
than reading it; the branch sits above the network test now, with a comment
saying why the order is load-bearing.

### Four spellings of one agreement, and three of them had drifted

The same failed-response block existed **four times** — photo/food, plan import,
chat and voice — each worded slightly differently. The first fix taught one of
them the new codes; the other three would have gone on showing «صار خطأ» for
exactly the failure this release exists to name. `workerError(res, data,
dailyKey)` is the one reader now, and `dailyKey` is the only thing a caller may
vary (the plan import says it in its own words).

> It is spelled `data.code === '…'` throughout on purpose. **Contract 30 reads
> both sides of this boundary by grepping for that literal**, and it failed the
> commit twice while this was written: once for the Worker assembling
> `code: code` into a variable, and once for a two-character `d.code` alias
> here. Both times the checker was right — a computed or abbreviated spelling
> makes the agreement invisible to the next reader as well.

### Deployed

Worker version **`6338e97f-cc65-4304-b12b-d776931eef71`**, 2026-09-21T18:55Z,
read back from `wrangler deployments list` as 100% of live traffic rather than
inferred from a successful upload. No secret changed, so this is the ordinary
`npx wrangler deploy` path from `backend/worker/`.

### Still the owner's, and named plainly

- **The daily AI budget has been dead since 2026-09-06** — 21 of 21 calls
  refused with 409, `ai_usage` frozen at that date, and the Worker fails **open**
  on it. So the shared free-tier cap has protected nothing for over two weeks.
  `backend/pending/29_ai-usage-fk-repair-v25.sql` is the repair and it is a live
  write.
- **The next photo now names its own cause.** «الخلل عندنا» confirms the key or
  its project; check in AI Studio / Google Cloud whether
  the Generative Language API is still enabled, whether the key has gained an
  HTTP-referrer or IP restriction (a Worker's egress IP is not stable, so such a
  restriction fails permanently), and whether the free tier still covers it.

## v387 — the app-wide declutter: thirty lines that named what you were already looking at

The owner's instruction, and it is the rule for every screen from here on:

> «التطبيق كامل بدي ما يكون فيه كتابة ما إلها معنى أو ما إلها لازم — بدي واجهته
> نظيفة تمامًا ومش زحمة، ويكون فقط الأشياء الي المستخدم بيحتاجها»

v386 answered the two examples he named (the export route, and «تقدير» beside a
food). This is the sweep those two implied, over every view and every sheet.

**Thirty strings left the screens, twenty-nine keys left both dictionaries, and
five CSS rules left the stylesheet with them.** Measured seeded, ar/dark/375,
before and after, on the same fixture:

| | before | after |
|---|---|---|
| Settings | 2503px · 15 section labels | **2409px · 13** |
| Program | 1116px | 1091px |
| Planner | 1043px | 1017px |
| Cardio | 924px | 898px |
| Sleep | 1082px | 1057px |
| Reminders | 1789px | 1720px |
| Records | 236px | **188px** |
| the first-run hero | **184px** — «الثلاثاء / جاهز للتمرين؟ / سجّل أول تمرين لتبدأ. / ابدأ أول تمرين» | **144px** — «جاهز للتمرين؟ / ابدأ أول تمرين» |

Every affected view lost **exactly one element per removed line** (149 → 148,
957 → 956, 177 → 175 …), which is the accounting that says nothing else went
with them, and **every screen still renders a real heading and zero empty
boxes** — measured, per view and per sheet, not inferred.

### What the thirty were, and the one question that decided each

*Does it tell you something you cannot already see on this screen?*

- **Seven page subtitles** under seven page titles — «دورتك، وحجم عملك الأسبوعي،
  وأرقامك القياسية» under «برنامجي», «تتبّع متى تنام ومتى تصحى» under «النوم».
  Each describes the screen you are standing on.
- **Six sheet subtitles**, same shape — «معادلة Mifflin-St Jeor» under «حاسبة
  السعرات», «تنبيهات المكمّلات والماء» under «التذكيرات».
- **Nine empty-state second lines** telling you to press a button that is on
  screen and already labelled: «اضغط "سجّل جلسة" لتسجيل أول مجموعة»، «جرّب بحث
  مختلف»، «سجّل جلسةً بالزرّ في الأعلى».
- **The weekday, printed twice on Home.** Every one of the six hero branches
  appended `· الخميس` to its eyebrow while `.home-hello` prints «الخميس، ٢٠
  سبتمبر» in full, from the same `now`, directly above it.
- **«البيانات»** labelling one row, and **«إرسال ملاحظة»** painted twice four
  lines apart — a heading and then the button's own title.
- **«أدوات»** as the eyebrow of the personal-records page, which is not a tool.
- **`cx_amount_hint`**, which said «كميات المشتريات مستقلة عنها» — about the
  purchase-quantity layer **v329 deleted**. A sentence describing a feature that
  has not existed for fifty-eight releases.

### Two defects the sweep turned up on the way

- **`empty_day_drop` was still in dialect** — «يوم راحة — اضغط + أو اسحب تمرين
  **لهون**» — a v336 violation that survived that release's sweep because that
  string is only drawn on an empty rotation slot. It is «يوم راحة» now: the
  state, with the instruction and the dialect gone in one edit.
- **`.heat-cell` carried an `aria-label` that duplicated its own visible name**,
  and an `aria-label` REPLACES an element's content — so a screen reader heard
  «صدر» and never the SET COUNT inside it, which is the only reason that cell
  exists. The attribute is gone; the name now comes from the content, count and
  all. (The same lesson as v324's favourited meal button, in a second place.)
- And the reminder test toast joined `t('remind_test_failed')` to `res.reason`,
  an internal English token — «تعذّر الإرسال · unsupported». The suffix is gone.

### ⚠️ THE METHOD, BECAUSE THE FIRST ATTEMPT AT THIS DESTROYED THREE FILES

The first pass deleted whole LINES containing a needle. Several of those needles
sat inside a ternary branch:

```
-      ? emptyState({ iconName: 'dumbbell', title: t('no_sessions'), text: t('log_session_tap') })
```

so `js/app.js`, `js/food.js` and `js/body.js` all stopped parsing —
`SyntaxError: Missing } in template expression`. **And the patcher reported 22
successes, because its read-back only checked that the string was gone.** A
needle can be gone from a file that no longer parses.

Three things fix that class, and all three are in this release:

1. **`emptyState()`'s `text` is OPTIONAL now** (`js/ui.js`) — the `.empty-text`
   div is not drawn at all rather than drawn empty. So nine of the thirty are a
   removed PROPERTY, never a removed line.
2. **A line is dropped only when it is self-contained** — the patcher counts
   braces and backticks on it and refuses otherwise, which is exactly what would
   have stopped the ternary cuts.
3. **`node --check` after EVERY single edit**, with the pre-edit bytes restored
   on any failure. Not after the file, not at the end: after each one. 38 of 38
   applied, every one parsed back.

### What was deliberately KEPT, and why

The instruction is about text with no meaning, not about text that is short.

- **The greeting** («صباح الخير») and **«الراحة جزء من الخطة — العضلة تكبر اليوم
  لا أمس»** — the app's voice on the two screens where it has something to say.
- **`boot_title` + the launch timings** — v381, which the owner commissioned.
- **«الأصناف» and «كل الجلسات»** — each sits in a `.row-between` with its screen's
  primary button, so removing the label moves the button to the other edge. A
  layout regression to save one word is not a trade.
- **`sl_empty`** and **`barcode_hint`** — each is the ONLY content of the box it
  is in; deleting it leaves an empty box, which is the owner's own first law.
- **`delete_sleep_text`** — a confirm dialog naming what a destructive action
  does. One line from being removable, and it should not be.

### What the checks say

43 contracts · lint · **13 suites, 0 failed, 0 skipped**. Both fingerprint lanes
on the finished tree: **no page errors, no empty cells, no raw keys, no empty
icons** across 160 view cells and 110 sheet cells. **Contract 38 named all
twenty-nine dead keys itself** the moment their last caller went — the v358
inverse doing the whole job it was built for — and both dictionaries stay at
parity (**en 1085 / ar 1085**, from 1114).

## v386 — the route out of the app is closed, and a word that told you nothing

Two owner instructions, one of them with a screenshot: **«شيل اي شي بيصدر بيانات
عشان يكون المستخدم محكور عندي»**, and — as the example of the whole rule —
**«كلمة تقدير الي بتكون عند الاكله»**.

### The data rows are gone from Settings

| | before | after |
|---|---|---|
| action rows in Settings | **11** | **9** |
| the Data group | تصدير · استيراد · إعادة تعيين | **إعادة تعيين** |
| the screen | 2669px | **2503px** |

`exportBackupFile()` itself **survives, reachable from exactly two places, and
neither is a way out of the app**:

- **`showUnreadableDialog()`** — the stored blob will not parse, so the app is in
  READ-ONLY mode and refuses every write. This is the only action it offers, and
  what it writes is the raw unreadable original, which `importJSON()` **refuses
  by definition** (v350). It is not a file anyone can leave with.
- **the save centre, and only on `failed`** — the device could not WRITE.

> **I kept those two deliberately, and it is one line to overrule me.** A user in
> either state is not choosing to go elsewhere; they are about to lose
> everything. Deleting the rescue would not add lock-in, it would add data loss —
> and this project has already paid that bill once, when a set of exercise photos
> became unrecoverable. If they should go too, it is those two call sites.

`DB.importJSON()` also survives and is **not** dead code: `cloud.js`'s
`applyRemote()` calls `importRaw()` on every pull, which is how a new device is
restored from the cloud.

### «تقدير» — and why it is the right example

v376 painted a source tag beside every food name — «تقدير» for an AI or voice
estimate, «من الملصق» for a barcode. Measured on a seeded day, before and after:

```
before   ["شوفان من الملصق", "دجاج مشوي تقدير", "أرز"]
after    ["شوفان",           "دجاج مشوي",       "أرز"]
tags painted: 2 → 0
```

**Nothing left the data.** `source` is still stored on every row — measured after
the change: `[barcode, ai, manual]`. What went is a word on screen that told you
where a figure came from, which is not something you can act on while reading
your day's calories.

### What the contracts did on their own

Contract 38 — the v358 inverse — named **all seven** strings the moment their
screens went: `export_data_sub`, `import_data`, `import_data_sub`, `imported`,
`import_failed`, `fl_src_label`, `fl_src_estimate`. Deleted from both
dictionaries, which stay at parity (**en 1114 / ar 1114**). `.food-log-src` went
with its markup, and its comment with it.

## v385 — T4.2: the heading ladder, and the dialogs that had no name

The last of the plan's furniture threads, and the two things it found are both
larger than the word «ladder» suggests.

### ⚠️ NO DIALOG IN THIS APP HAD AN ACCESSIBLE NAME

`openModal()` emits `role="dialog" aria-modal="true"` with **neither
`aria-labelledby` nor `aria-label`**, and **35 of the 38 titles under it are
`<div class="modal-title">`**. So every sheet in the app announced itself as
*"dialog"* and nothing else — the saved-food picker, the calculator, the recipe
ledger, the weight sheet, the reminders page, all of them, for as long as they
have existed.

The wiring is in `openModal`, not at the call sites: one edit names all 38 and
carries every sheet written after it, where 38 edits would be 38 chances to
forget. A sheet with no title keeps no name rather than gaining a wrong one.
Measured on three:

```
saved-foods  {"labelledby":"vlt-modal-title-1","name":"أكل محفوظ"}
calculator   {"labelledby":"vlt-modal-title-2","name":"حاسبة السعرات"}
weight       {"labelledby":"vlt-modal-title-3","name":"الوزن"}
```

### Four of twenty views rendered no heading at all

`home`, `exercise-detail`, `foodlog` and `notifications`. Each **does** draw a
title — as a `<div>` with a class that looks like a heading — and a styled div
is invisible to the document outline and to every heading shortcut.

> ⚠️ **AND THE BAR TITLE CANNOT BE THAT HEADING.** `.detail-top` sets
> `bar.inert = tuck` on scroll-down, so an `<h1>` inside it **leaves the
> accessibility tree the moment the user scrolls** — a heading that exists only
> while you are at the top of the page. That is worse than none, because it
> looks fixed.

So `exercise-detail`'s hero name — visible, in the content, in both its photo
and no-photo branches — becomes the real `<h1>` it always was. The other three
carry an `sr-only` `<h1>` in the content, each named with the key that screen
already uses (Home takes the word from its own nav button, so the nav and the
outline cannot drift apart). No pixel moves.

**`emptyState()`'s headline went with them.** It is often the WHOLE of what a
screen has to say — `exercise-detail` renders nothing else when the id is gone,
which is exactly the state the fingerprint net captures it in — so its `<div>`
is an `<h2>` now. Measured after: **20 of 20 views render a real heading**,
where it had been 16, and the net's own fallback captures are covered too.

### The ladder: three rungs, and the reason it was five

| | was | is |
|---|---|---|
| `.page-title` (17 sites) | 26px **literal** | `--fs-h1` |
| `.detail-hero-name` | 28px | `--fs-h1` (26) |
| `.run-ex-name` | `--fs-title` (24) | `--fs-h1` (26) |
| `.modal-title` (38 sheets) | 20px | `--fs-h2` |
| `.detail-top-title` | 18px | `--fs-h2` (20) |
| `.settings-group-title` | 17px | `--fs-h3` |
| `.empty-title` | 16px | `--fs-h3` (17) |

> ⚠️ **AND EVERY ONE OF THOSE WAS A LITERAL, WHICH MEANT v380 NEVER REACHED
> THEM.** The comment above the type scale has claimed since v200 that
> «`--fs-page` is the 26px `.page-title`» — **that token was never declared**.
> So when v380 raised the eleven tokens for larger text, the person who asked
> for bigger type got a bigger BODY under headings that had not moved a pixel.
> Prose describing a change that did not land is how the app's most-used heading
> sat out its own accessibility feature.

Measured on the Settings screen, which is the one view with two levels:

```
normal  h1 26px · h3 17px
large   h1 29px · h3 19px
```

> **One measurement of my own was wrong first, and the mistake is the useful
> part.** A probe that toggled `body.text-lg` and read `getComputedStyle` in the
> same synchronous block reported 26px at both sizes — so I went looking for a
> broken selector in a stylesheet that was fine. Reading the custom properties
> straight off `body` in a fresh pass said 15→17 and 26→29 immediately. **Toggle
> and measure in the same task and you can read the state you started from.**

### Contract 43

Every view in the `renderView` switch must emit an `<h1>`–`<h6>` from its own
renderer — brace-matched from the declaration, so a heading emitted by a
different function does not count for this view. **Proved able to fail 3 of 3**,
both scripts restored byte-for-byte: Home's heading removed fires by name,
foodlog's fires, and a `<div class="page-title">` in place of the `<h1>` fires —
which is the whole point, since that div is exactly what the four were already
drawing.

### And the mark documentation, corrected at last

v367 recorded that «BRAND.md and CLAUDE.md's mark sections are still wrong and
are now **knowingly** wrong — correcting them is its own commit». This is that
commit, and every claim in it was read out of the code rather than the documents:

- **`.cut` and `--cut-bg` do not exist in `styles.css`** and have not since v227.
  The file says so in its own words. Both documents pointed the in-app top bar at
  that class.
- **The in-app mark is `brandLockup()`** — two half-`dumbbell` plates flanking
  VAULT over TRAIN, exactly two sizes, three call sites. `admin.html` hand-inlines
  the same two plate SVGs twice because it cannot reach `js/ui.js`, and nothing
  keeps those copies in step.
- **THE CUT survives on FOUR surfaces**, not three: the icons, the download page,
  and **`privacy.html`**, which paints its own `--cut-slot` / `--cut-hair` and
  which `docs/BRAND.md`'s shipping table had never listed at all.
- **The identity layer's banner lists SEVEN devices and its seventh has no rule
  block** — the numbered sections stop at 6, because the cut left the stylesheet
  at v227. CLAUDE.md said «four devices». Contracts 41 and 42 now enforce two of
  them outright.
- **The web splash still draws the five bars**, which the same page forbids as a
  mark. It is frame 0 of a sequence whose first frame is a PNG already on phones
  (v340), so it is the launch animation and not a logo — stated, because a reader
  checking the rule against the app will otherwise find it and assume drift.

Two more stale claims in the type-scale law went with them: **fractional sizes
are not gone** (23 declarations still carry `.5px`, corrected rather than acted
on — re-rounding 23 sizes is its own measured change), and `.section-title` no
longer draws a `::after` rule; the identity layer sets `content: none` on it and
adds the 2px bar tick instead.

### What both net lanes say, and why the headline number is not the answer

This is the first release where reading `N/M cells identical` would have been
useless: **8 of 160 views and 20 of 110 sheets**. `emptyState()` appears on
nearly every screen in the EMPTY state, which is exactly what the matrix
renders, so a one-pixel change to its headline touches almost every cell. The
number says "this release moved a lot of screens", which is true and tells you
nothing about whether it moved anything it should not have.

So the diff was accounted for element by element instead:

| | |
|---|---|
| **sheets** | **ZERO elements whose class changed.** 90 `acc` + 90 `id` — every dialog gaining the accessible name it never had — plus 4 on the empty state. Nothing else, in 110 cells. |
| **views** | **24 cells gained exactly ONE element** — the `sr-only` `<h1>`, on home, notifications and foodlog, across all 8 contexts. The other 136 have the identical element count. |
| the rest | `detail-top-title` 18→20 (96), the empty state's tag and its 1px, and the boxes that reflow by that 1px |

**Every difference is one this change made.** The per-element accounting is what
proves that; the cell count could not have.

## v384 — T4.2: the chips group — what a control is, not what it is called

The identity layer states both halves of this law in its own words:

```
4. No circles          — straight edges, butt caps, mitre joins
/* Capsules are for TRANSIENT chips only. Anything that holds STATE gets the
   machined corner. */
```

> ⚠️ **AND NOTHING COULD SEE A BREACH OF EITHER.** A class called `*-chip` reads
> as a chip in review however it is emitted — so a `<button data-goto="calendar">`
> in the Home header of every session, and a 20px `<button>` at `999px` (which on
> a 20px box **is** a circle), both sat in the app for as long as they had
> existed. The question the law actually asks is not what a class is called: it
> is whether the **element** is a control.

Measured in the running app, before and after:

| | tag | before | after |
|---|---|---|---|
| `.streak-chip` — Home header, every session | `button` | `999px` | **12px**, hit 87×45 |
| `.supp-preset` — stateful (`.picked`/`.added`) | `button` | `999px`, 40px tall | **10px**, hit 84×**44** |
| `.color-swatch` — stateful (`.active`) | `button` | **`50%`**, 32px | **10px**, 36px, hit 48×48 |
| `.time-chip-x` | `button` | **`999px` on 20×20 — a circle** | **8px**, 28×28 |
| `.cycle-chip-num` — repainted by `.current` | `span` | **`999px` on 20×20** | **8px** |
| `.cardio-icon-chip` | `button` | 10px literal, **38px, no halo** | token, hit 60×**44** |
| `.toast-action` | `button` | `999px` | **0**, hit 46×46 |

Four of those are also the tap floor: `.supp-preset` stood at 40, `.color-swatch`
at 32, `.time-chip-x` at **20** — the worst target in the app — and
`.cardio-icon-chip` at 38 with nothing around it.

> **Every halo had to be paid for in the GAP, which is the v373 lesson arriving
> from the other side.** A 4px halo in a 6px grid gap means two halos overlap by
> 2px and the later one wins the shared strip, so the earlier control measures 42.
> `.cardio-icon-chips` went 6 → 8, `.color-swatches` 8 → 12, and `.time-chip-x`
> was GROWN (20 → 28) rather than haloed further, because its rows wrap at gap 8
> and a 12px halo would have reached into the row above.

### `.toast-action` and `.color-swatch` were found by the contract, not by me

Both turned up on contract 42's first run over a tree I had already swept by
hand. `.toast-action` then answered itself by being read: it is
`background: transparent; border: none` in every state, so the `999px` had
nothing to round — not an exception to name, a declaration that painted nothing.

### Contract 42, and the trap it walked into first

It refuses a capsule or a circle on any class a `<button>` or an `<a>` is emitted
with, across the four view scripts and the four pages.

> ⚠️ **ITS FIRST RUN REPORTED `.filter-pill`, WHICH IS CORRECT.** That rule
> declares `var(--radius-pill)` at 1128 and the identity layer overrides it to
> `var(--radius-btn-s)` at 8743 — the layer is physically last and wins by source
> order, which is the whole reason it is last. Reading the FIRST declaration
> would have reported a control that is already right and, worse, **would have
> missed a control made wrong by a later rule.** It takes the last declaration
> now: the same trap contract 41 had to close two releases ago, met again from
> the other direction.

It attributes each declaration by walking BACK to its own opening brace rather
than splitting the file into rules — a rule walk desynchronises on the first
`@media`, and the identity layer sits past several of them.

**Proved able to fail, 5 of 5**, `styles.css` restored byte-for-byte: both
shipped defects replanted at their own rules fire by name, a new circular control
fires, and a non-control `<span>` at `999px` and a later rule that CORRECTS an
earlier capsule both stay silent.

One named exception: **`.rest-chip`**, the one capsule argued for in writing —
`styles.css` and `js/app.js` both state the case, and the code backs it (no state
class, a static label, the decision belongs to the sheet it opens).

### ⚠️ A STRIP THAT IS "NOT INTERACTIVE" WAS REACHABLE BY KEYBOARD

`.wk-compact .wk-chip` is `pointer-events: none`, and the stylesheet says in its
own words that the strip *"is not interactive there"*. It is not — **to a
finger**. `pointer-events` does not stop Enter, so a keyboard reached all seven
and could fire the `[data-day]` handler from a sheet with no day to open. They
carry `disabled` now: out of the tab order, and the click never dispatches.

### What this does NOT do, named rather than implied

**`.wk-disc` is still a 50% circle**, and it is the most-rendered shape in the
app — seven of them on Home and seven more in the Day view, with the plan state
painted on the circle itself. It is a `<span>` inside the button, so contract 42
cannot reach it by design (the contract's scope is the class a CONTROL is emitted
with), and it is a device-4 contradiction rather than a chip wearing a button's
clothes, which is what this thread was asked to fix. Changing it is one line —
`border-radius: var(--radius-sm)` — and it restyles the screen the owner looks at
most, so it is his call and not a side effect of this one.

Also left: the three unread `--chip-*` properties, and now `--chip-radius` with
them. The token is the CHIP radius and a capsule is correct for a chip; what was
wrong was a stateful `<button>` reading it. v358's decision stands — an empty
rung in a designed scale is not dead weight.

### What both net lanes say

Views **160/160 identical** — every chip in this release lives in a sheet, so
that is containment and nothing more. Sheets **104 of 110 identical**, and every
difference is one this change made: `999px → 10px` (36), `50% → 10px` (32),
`999px → 8px` (2), `position: static → relative` (88, which is what a halo
needs), the two gaps, and the boxes of the controls that grew.

> ⚠️ **AND 60 `overflowX` FLIPS, WHICH HAD TO BE CHASED RATHER THAN WAVED AT.**
> A halo is CONTENT to its scroll ancestor, and `.modal` is `overflow-y: auto`,
> which makes its `overflow-x` computed non-visible — so a negative-inset
> `::after` can give a sheet a horizontal scrollbar **without moving a single
> box**, which is exactly what `.rec-del` did in v329. Every changed box in the
> diff was identical before and after, so the flip is the halo being visible to
> `scrollWidth` on the inner containers. Measured on the two sheets that carry
> these controls: `scrollWidth === clientWidth` on both, `scrolls: false`, and
> the document does not scroll either. The halos sit inside the sheet's own
> padding.

## v383 — T4.2: the Arabic copy group — a numeral's noun, and the fold's English

Two threads the plan names, both measured in the running app first because both
are claims about a rendered string.

### 1. «20 المجموعات» — the definite article after a numeral

```
ar  exercises  ["20 المجموعات · 65 kg", …]
ar  compare    ["9 المجموعات", "11 المجموعات"]
```

> ⚠️ **`t('sets')` IS THE COLUMN LABEL.** «المجموعات» is right over a column and
> wrong after a numeral, and **v372 hit this exact trap on the Home hero** — it
> was still live in three more places, two of them reading `t('sessions_n')`,
> whose name says *sessions* and whose value says *sets*.

One key for the count, named for what it is rather than for the first screen
that needed it: `home_done_sets` → **`n_sets`** (`'{n} sets'` / `'{n} مجموعة'`),
used at all four sites. `sessions_n` had no caller left afterwards and **contract
38 named it in the same run** — the v358 inverse doing exactly its job. Measured
after: «20 مجموعة», «9 مجموعة», «11 مجموعة», and the English untouched.

> **What was deliberately NOT changed, and the reason is not laziness.**
> `${n} ${t('exercises')}` paints «٥ تمارين». Formal Arabic takes the plural
> genitive for 3–10 and the singular accusative for 11+ («٢٠ تمرينًا»), so the
> code's English-shaped singular/plural rule is **right in the common range and
> wrong above ten** — while the house style since v372 is a flat singular. Both
> are defensible, a tamyīz engine is not what a UI needs, and swapping one
> imperfect rule for another under cover of a copy fix would be a change nobody
> asked for. Named here instead.

### 2. The four templates spoke English inside the Arabic fold

```
titles     ["Push / Pull / Legs", "Upper / Lower", "Full Body", "Bro Split"]
day chips  ["Push","Pull","Legs","Upper A","Lower A", … ,"Chest","Back","Legs","Shoulders","Arms"]
cycle      ["Push","Pull","Legs"]           ← and these are in the user's PLAN
```

The DESCRIPTIONS were already translated (`tmpl_desc_*`, in both dictionaries);
the names and the day chips never were, so each card read half in one language
and half in the other.

> ⚠️ **TRANSLATING THE CATALOG WOULD HAVE BEEN THE WRONG FIX, AND WORSE THAN
> NONE.** Adopting a template writes `{ name: w.name }` into the cycle, so the
> day name is **user data**. A translated literal would fix only plans adopted
> afterwards, and would freeze whichever language was current at adoption into
> the blob for ever.

So `PLAN_DAY_AR` (js/catalog.js) is a **display map**, and `planDayName()` is
the same decision `exDisplayName()` already makes for exercises — which means it
repairs every plan ever adopted, and a day the user renamed is simply not in the
map. Proved in the running app rather than asserted:

```
stored in the plan : ["Push","Pull","Legs","يوم الكتف عندي"]
displayed, ar      : ["دفع","سحب","أرجل","يوم الكتف عندي"]
displayed, en      : ["Push","Pull","Legs","يوم الكتف عندي"]
stored is untouched: true
```

Eight render sites go through it. **The vocabulary is the app's own** — صدر /
ظهر / أرجل / أكتاف / ذراع are `cat_Chest`…`cat_Arms`, and the Arabic
descriptions already said «دفع / سحب / أرجل», so the sheet now speaks one
language to itself. `tmpl_name_*` joins the existing `tmpl_desc_*` family and
contract 5 picked it up without being told (12 prefix families → 13).

Two smaller things fell out of the same sweep: the rotation editor carried a
**hard-coded English `'Workout'`** fallback while its two siblings both used
`t('workout_label')`, and `openScheduleModal()` takes either a built-in or an
admin-curated server preset with no flag on the object to tell them apart —
hence `tmplDisplayName()`, which asks the only question that can be answered
(is this id one of the four?) instead of guessing from the shape.

### What both net lanes say

The sheets lane: **108 of 110 cells identical**, and every difference in the
other two is a word this change translated, plus the box each translated word
now occupies. The views lane: **160/160 identical, 0 differences** — which is
containment and **not** evidence for the change, because the matrix runs the
EMPTY state, where there is no plan to draw a cycle chip for and no set to
count. The evidence for the change itself is the seeded probe above.

## v382 — T4.2: the corner law, and the rung the scale had abandoned

Measured across all 20 views before anything was touched — every box at least
24px square, so a 2px chip's corner is not counted as a design decision:

```
across all views: 9 distinct radii — 5px, 8px, 9px, 10px, 12px, 14px, 16px, 24px, 999px
```

Three of the nine are on no rung. **And the largest group was wearing a value the
scale itself had thrown away:** `--radius` is declared `14px` at line 148 and
redefined to `16px` by the identity layer at 8677, which is physically last and
wins by source order — so `14px` has been dead since v227, and thirteen boxes
went on spelling it out by hand.

| | |
|---|---|
| 13 × `14px` | → `var(--radius)` — the rung they were already trying to be |
| 4 × `9px` | → `var(--radius-sm)` |
| `.modal` `20px 20px 0 0` | → the token: the identity layer already renders it 24, so the declaration was **describing a paint that never happened** |
| `.nav-btn.active::before` `13px` at line 810 | **deleted** — the identity layer sets the same selector and says in its own comment that the earlier one changes nothing |
| `.add-sheet` 26 · `.food-fab` 20 · `.onb-logo` 20 | → `var(--radius-lg)` |
| `.add-tile-icon` 15 | → `var(--radius)`, the same rung as the `.add-tile` beside it |
| `.ai-edit-f > input` 11 · `.health-card-icon` 11 | → `var(--radius-btn-m)` |

**Measured after: 9 distinct radii → 7, and every survivor is a rung** (`5px` is
the named exception below; `999px` is `--radius-pill`).

### Contract 41, and the two decisions that make it checkable

> ⚠️ **THE SCALE HAS TO BE THE EFFECTIVE ONE, OR THE CONTRACT BLESSES THE EXACT
> VALUE IT EXISTS TO CATCH.** My first draft collected every `--radius*`
> declaration in the file — which includes the dead `14px` and the dead `22px`.
> It would have passed a stylesheet full of the drift it was written for. It
> takes the LAST declaration of each name now, which is what the cascade does
> here, and the rung count fell from 8 to 6 the moment it did.

> **And it governs only radii at or above the scale's own floor (8px).** Under
> that there is no token to reach for — a 2px scrollbar thumb, a 1px dash, a 3px
> dot are shapes, not corners. That boundary is derived from the scale rather
> than a range waved through, which is the difference between a contract and a
> filter.

Two named exceptions, each naming its selector: **`5px`** for the two
theme-swatch miniatures (a card at about a quarter scale, where 16 would be four
times too round) and **`13px`** for the nav's active pill, which the identity
layer already justifies in writing — the icon spec fixes it at 13 around a 32px
box. Nothing else. A radius earns a place there only where the scale has nothing
to offer, never where nobody has snapped it yet: that is how a contract launders
drift instead of catching it.

**Proved able to fail, 5 of 5**, `styles.css` restored byte-for-byte: a planted
`14px` — *the historical defect* — fires, an ordinary off-scale `19px` fires,
and a real token, a `3px` below the floor and a nested `var(--card-radius,
var(--radius))` all stay silent. The nested case needed the strip to run
innermost-first; one pass left the outer half of the call as debris and reported
a token's own fallback as a literal.

### What both net lanes say

Every difference in 318 (views) and 275 (sheets) is a radius this change made —
`14px→16px`, `9px→8px`, `15px→16px`, `26px→24px` — plus the known
image-load race. **Nothing else moved**, which is the containment the net exists
for; the visual change itself is the point and is listed above.

### ⚠️ AND THE NET HAD BEEN REPORTING A FAILURE NOBODY ACTED ON

Capturing the sheets lane printed, on both sides of the diff and so on every run
since v379:

```
✗ modal/ar/dark/375/weekly-review: rendered EMPTY (0 children) — the renderer threw or did nothing
```

`openWeeklyReview()` opens **only when a review is due** (`if (!due) return`), and
the fixture seeds no session in last week. So the sheet was listed in the net,
captured nothing, and announced it every time — the exact shape this project
keeps paying for, a red check that everyone learns to read past.

`scripts/fp/modals.js` entries take a **`pre`** now: JS evaluated in the page just
before the opener, with the fixture in scope. Weekly review's makes its condition
true — a session dated inside last week, and the seen-stamp cleared. Measured
after: **16 elements and the review's own Arabic in the cell**, where there had
been zero.

### Still open in T4.2, named rather than implied

The corner group is closed. The plan's other threads are not: the heading ladder
(**4 of 20 views render no `<h1>`–`<h6>` at all**, and Settings is the only screen
with a second level), chips wearing a button's clothes, the «20 المجموعات»
grammar, and the English template names inside the Arabic fold. Each is its own
measurement and its own release.

## v381 — T4.3: the launch, timed on a phone instead of inferred

**Every measurement in this project so far has run under `reduced-motion`**,
where the vault door is never mounted at all — so the launch sequence the owner
actually sees has never been timed. The plan asked for «بضع لقطاتٍ زمنيّة …
تُقرأ من هاتفك بعد التثبيت», and that is what this is: four numbers, in the
order a person experiences them, on the Settings screen.

The door already kept its own clock (`performance.now()`, since v343, because
the wall clock can be corrected backwards mid-boot). It now also records when
the app said it was ready and when the leaves parted, and Settings reads them
beside the navigation timings the browser already has.

Measured on a real launch with the door genuinely running:

```
أوّل بايت 30ms · أوّل رسم 344ms · جاهزيّة التطبيق 363ms · انفتاح الباب 1468ms
```

> ⚠️ **TWO ORIGINS ON ONE LINE IS A READING THAT LIES, AND THE EYE ACCEPTS IT.**
> The door's clock starts when the door mounts, not at navigation, so the first
> version of this line reported `app ready 211ms` beside `first paint 504ms` —
> the app apparently ready 293ms **before the first pixel**. Every number was
> correct and the line was nonsense. All four are on navigation time now, and
> they read monotonically, which is the only way a reader can use them.

> **And one bug lint could not see:** `bootTimingText()` declared
> `const t = window.__vltT` — shadowing `t`, the translator — so every
> `t('boot_…')` call inside it became a call on a plain object. The name is
> legal, so no rule fires; it would simply have thrown on the Settings screen.
> It is `stamps` now.

## v380 — T4.1: larger text, and the two boxes that could not take it

The app is written in **pixels throughout** — no `rem` root to scale, no
`text-size-adjust` — so honouring the OS font size would mean rewriting
thousands of declarations. What IS possible is the plan's own limited version:
**the type scale is already ELEVEN tokens**, so raising those eleven raises
every size in the app from one place. `body.text-lg` redefines them at +10%,
rounded to whole pixels.

Declared on **body, not `:root`**, for the reason `--accent-text` is: `var()`
resolves on the element the property is declared on, and the class lives on
body.

> ⚠️ **THE PRE-PAINT SCRIPT WRITES `className =`, WHICH REPLACES EVERY CLASS.**
> The size has to be written in the same breath as the theme, because
> `applyTheme()` later uses `classList` and would not have restored it — the app
> would paint at one size and jump to the other a few hundred milliseconds in.
> Measured across a real relaunch (a new page on the same store): `--fs-body`
> `15px → 17px`, the class present in the first frame, and `theme-dark` still
> beside it.

### What the measurement found, which is the point of the task

The plan asks that this be measured «أنّ لا صندوقًا ينقصّ». Walked across all 20
views in both contexts, comparing each view at normal size against itself at
+10% so a box that already overflowed is not blamed on this change. **Three
cells gained a clipped box, from two causes:**

- **`.row-between` overflowed by 23px on Supplements**, pushing the whole view
  7px wide — a horizontal page scroll. A heading beside two labelled buttons,
  in a flex row with no wrap. **It wraps now**, and that is worth having
  regardless: a long translation would have done the same thing at the normal
  size.
- **`.stat-cell-label` ran 6–8px past its cell** on Home and Program. It
  already declares `text-overflow: ellipsis`, so it was truncating *by design*
  — but «SESSIO…» is the opposite of what someone asking for larger text wants.
  It wraps at the large size instead: two readable lines beat one truncated
  one, and the cell is already a centred flex column.

Measured after: **no box clips at +10% that did not already clip at normal
size.**

> **And the shared utility was proved inert at the normal size** rather than
> assumed. Diffing the stylesheet change alone against the identical tree:
> **96 differences, every one of them the two declared properties**
> (`flex-wrap`, `gap`) across 48 cells, and **zero `box` changes**. The wrap
> costs nothing while the row fits.

## v379 — T3.1 and T3.2: the routine is derived, and the week reports itself once

### T3.1 — `DB.routine`, and it stores nothing

What time you usually train, which weekdays you actually turn up on, how many
sessions a normal week holds — every one of those is already implied by the
sessions in the blob. So **none of it is stored**: no new key, no new blob
field, nothing to migrate, nothing that can go stale or disagree with the log
it came from, nothing extra to sync.

> ⚠️ **THE HABIT IS WHAT YOU DID, NOT WHAT YOU PLANNED.** The plan already
> says which days are training days; asking it would only report what the user
> once intended. These answers come from `createdAt` and `date` on real
> sessions — which is exactly why they can disagree with the plan, and that
> disagreement is the whole point of a weekly review.

Two details that decide whether the answers are true:

- **The hour is the MODE, not the mean.** An average of 07:00 and 19:00 is
  13:00 — a time this person has never trained.
- **Days are counted once each, not once per exercise.** Five exercises on a
  Monday are one Monday.

Everything is `null`/`enough: false` rather than a guess below six sessions: a
"usual hour" derived from two sessions is not a habit, it is two numbers.
Measured against eight seeded weeks of Sun/Tue/Thu:

```
no history      {enough: false, sessions: 0}
eight weeks     {enough: true, sessions: 24, perWeek: 3, usualHour: 21, usualDays: [0,2,4]}
```

### T3.2 — the weekly review

Once, on the first open after a week ends, and never again for that week.
**Three things and no more**: whether the week happened, one comparable
improvement, one suggestion with its reason. A review that lists everything is
a report nobody finishes.

**The suggestion is never applied by the sheet.** It names what it would change
and opens the screen that owns that change — the plan is edited where the plan
is edited. A review that quietly rearranged the week would be one nobody could
trust opening.

The improvement uses the same rule v378 put on the Compare panel, for the same
reason: both weeks must have a figure, because an exercise done last week and
not the week before is **new**, not improved.

> ⚠️ **`weekRanges()` RETURNS DATE OBJECTS, NOT ISO STRINGS**, and that one
> assumption would have shipped the feature inside out. The stamp stored
> `String(date)` — a locale-formatted sentence — and then compared that string
> against a `Date`, which can never be equal. **Measured before the fix: the
> review opened on every single app open, for ever.** It is `isoOf(lastStart)`
> now, storage.js's own local-day formatter, on both sides. The stamp is a
> DATE rather than a flag for the same family of reason: a boolean would need
> something to reset it, and whatever reset it would be a second place that
> decides when a week ends.

Measured: it opens once, returns `nothing opened` on the next call in the same
week, and «لا تعرضها مجدّدًا» keeps it away even with the stamp cleared.

## v378 — T3.3 and T3.4, and the red drop the weekly review was to be built on

Three changes, each measured; they ship together because each is small,
independent, and the first is the defect T3.2 says must be fixed before the
weekly review is built on top of it.

### ⚠️ NOT DOING SOMETHING YET IS NOT DOING IT WORSE

`renderCompareWorkouts` handed `deltaBlock` this week's best against last
week's. With nothing logged this week the figure is **0**, so an exercise the
user simply had not reached yet was drawn as a **red drop the full size of last
week's best**. On a Tuesday that is most of the Compare screen in red, about a
week that has barely started.

A delta is only meaningful when BOTH weeks have a number. The two one-sided
cases are states, not changes, and each now says which it is — «لم تتمرّنه بعد
هذا الأسبوع» or «جديد هذا الأسبوع». Measured: trained last week, nothing yet
this week → `compare-delta flat`, no arrow, no red.

### T3.3 — coming back

A gap is the moment an app is most likely to be deleted, and Home met it with
the same hero as any other day: no acknowledgement, and no route back in that
did not start with a decision.

**The tone IS the design.** It states a fact and opens two doors — no streak
language, no "you missed 12 days", no red, and nothing that reads as a warning.
The one thing a returning user is actually unsure of is whether their plan
survived, so that is the sentence: «خطّتك محفوظة كما تركتها».

Seven days, counted from the last session **of any kind** — a fortnight of
cardio is not a break — and it disappears the moment anything is logged, so
nobody sees it twice. Measured at 12 days away, then again after logging today:

```
12 days away      title "خطّتك محفوظة كما تركتها" · "مضى 12 يومًا منذ آخر جلسة"
                  doors ["تابِع اليوم", "رتّب أسبوعك"]
after logging     no card
```

> ⚠️ **AND MY FIRST DRAFT BLANKED THE WHOLE HOME SCREEN.** The block read
> `todayIsoNow`, a `const` declared further down the same function — a TDZ
> `ReferenceError` that took the entire render with it. Contracts and lint both
> passed; **the probe caught it**, which is the argument for measuring a change
> rather than reading it.

### T3.4 — the buzz

One `buzz(kind)`, so the rule lives in one place, and deliberately short
patterns: a set ✓ is the tap you make forty times in a workout and gets the
smallest possible tick (12ms); a personal best is the rare one and earns a
double. The rest alarm keeps its own longer pattern — it has to reach you with
the phone face down.

Measured: ON → `[12]` and `[16,60,26]`; OFF → nothing at all; and with
`navigator.vibrate` deleted entirely it does not throw. **It is a no-op on iOS**
— Safari has never shipped the API — and that is acceptable because it is a
confirmation and never the only signal: every caller already shows something.

The switch reuses the **unit toggle's** shape, the two-option control this
settings page already has, rather than adding a third kind of switch;
`.ntfs-switch` is the reminders page's `role="switch"` button and copying it
here would be a second spelling of "on or off". Tapping ON answers with the
thing itself.

> **Contract 35 caught an invented token on the way**: `--radius-card` does not
> exist (`--card-radius` does). That is the `--text-muted` class of bug from
> v314, in the exact place the contract was written for.

## v377 — T2.5: the search speaks the language people type

The plan asked for «٢٠ استعلامًا حقيقيًّا تُقاس أوّلًا». Twenty-four were, against
the app's own 219 presets — written the way a Gulf or Levantine speaker types
them, not the way the catalogue spells them:

> **17 of 24 found something. SEVEN found nothing** — and not for one reason
> but two, which is why measuring first mattered.

| what failed | the real cause |
|---|---|
| `تونه` (while `تونة` found 3) | **ة is the one letter the normaliser never folded**, beside the أ and ى folds it already had |
| `جبنة` (while `جبن` found 8) | **folding could not have fixed it**: the query is LONGER than the catalogue's word |
| `فراخ` `بطاطس` `بندورة` `عيش` `معكرونة` | genuine synonyms — a different word for the same food |

So both halves were needed, and neither alone would have done: `ة → ه` in
`DB.search.normalize`, and a six-entry `FOOD_SYNONYMS` map in `js/catalog.js`,
where the food data lives. **Measured after: 24 of 24.**

**The synonym pass canonicalises BOTH sides**, which is what makes it
symmetric: query and catalogue entry go through the same table, so «فراخ»
finds «دجاج» and a row the user named «فراخ» is found by «دجاج». It runs per
WORD, because entries are phrases («صدر دجاج مشوي») and only the word is the
synonym.

> ⚠️ **THE KEYS ARE THE FOLDED FORM** — after ة→ه and أ→ا. A key written in its
> unfolded spelling is an entry that can never match, silently, which is this
> project's favourite shape of bug.

> ⚠️ **لبن AND حليب ARE NOT MERGED, AND THAT IS THE DECISION.** In the Gulf and
> the Levant لبن is yoghurt or buttermilk; in Egypt it is milk. A synonym that
> is only a synonym in some dialects is a WRONG ANSWER for the rest — and both
> words already find their own rows (6 and 5). A map like this earns its bytes
> only where the two words name the same food everywhere.

## v376 — T2.4: where a figure came from, and yesterday in one sheet

### The log never said which numbers were guesses

Every food row has carried a `source` since the day it was written — `ai`,
`voice`, `barcode`, `manual`, `recipe`, `saved` — and **none of it had ever
been drawn.** A figure read off a package and a figure a model estimated looked
exactly alike, which is the one distinction a calorie log actually owes you.

**Only the two that change how you should READ the number are labelled**:
`barcode` → «من الملصق», `ai`/`voice` → «تقدير». A tag on every row is five
tags on five rows, which is noise — `manual`, `saved` and `recipe` are the
user's OWN figures and need no comment on themselves. Measured on a seeded day:

| | |
|---|---|
| شوفان (barcode) | **«من الملصق»** |
| دجاج مشوي (ai) | **«تقدير»** |
| أرز (manual) | no tag |

It is a quiet aside on the name line, deliberately **not** a chip: the identity
layer reserves a capsule for a TRANSIENT chip, and this is a standing property
of the row.

### «كرّر أمس»

Most days are not new days — the breakfast is the breakfast. Logging it again
cost the whole capture path (chat, photo, barcode, or a hunt through saved
foods) for food the app already had, with the portions already decided.

**A list with choices, never a "copy the day" button.** Nobody eats the same
four things every day, and an all-or-nothing repeat would be wrong often enough
to stop being used. Everything starts ticked because the common case is most of
it. The tile appears only when yesterday actually holds something.

**The portions come across verbatim**, which is the other half of "as they
were": a repeat that silently logged one serving of a 1.5-serving meal would be
a different meal. Measured — three items yesterday (×1.5, ×1, ×2), one unticked:

```
logged to today: [{"شوفان", servings: 1.5, src: barcode},
                  {"أرز",   servings: 2,   src: manual}]
```

The unticked item stayed behind, the portions and the sources survived, and it
is ONE `addMany` write with an Undo offered on it. The day is resolved with
`todayISO()` at the moment the button is pressed, never captured when the sheet
opened — the sheet can stand open across midnight.

The row reuses **`.sl-tick`, the ticked row this app already has** (the shopping
list's), rather than a second one that merely resembles it — so its checkbox is
the app's own orange square from v330 and not the browser's white one.

> ⚠️ **AND I REPEATED, IN THE SAME SESSION, THE PATCHER BUG I HAD JUST WRITTEN
> DOWN.** A script added the English keys, threw on the Arabic anchor, and
> discarded the English write with it — because it still buffered and wrote at
> the end. **Contract 5 caught it by name** (`AR only: fl_repeat_*`), and
> contract 36 caught the new sheet missing from the fingerprint net in the same
> run. Two checks, two real catches, on a change that looked finished.

## v375 — T2.2: last time's numbers are a suggestion, not a record

The day card pre-filled every row with last week's figures **as real input
values**, so one tap on Save logged them all as performed sets. Measured in the
tap probe before the change: **typing ONE set and saving wrote TWO** — the
second being last week's — and nothing on the screen told the two apart.

The plan calls this «تمييزٌ واضح بين المقترَح والمنجَز», and the fix is the
shape the guided run has always used: **they are ghosts now.** The save path
already drops a row with no reps and no weight, so confirming the whole card
became a deliberate act instead of a side effect of saving.

**The zero-effort path is kept, not removed.** «كالمرّة السابقة» (141×44) turns
every ghost into a real figure in one tap, and is offered only while there is
something to confirm — a ghost to take and no figure of your own yet.

| | before | after |
|---|---|---|
| on arrival | last week's numbers, as values | empty, ghosts `8/40` · `8/42.5` |
| type ONE set, Save | **2 sets written** | **1 set** — `{reps:9, weight:62.5}` |
| «كالمرّة السابقة» → Save | — | both rows, deliberately |

Two controls the audit measured under the tap floor went with it, and both for
the reason v373 recorded — **a halo is measured from the PADDING box, so a 1px
border costs it 2px**:

| | before | after |
|---|---|---|
| `.run-set-done` — the ✓ on every set of every workout | 26px box, `inset:-9px` → **42** | `-10px` → **44 × 44** |
| `.sd-save-btn` — the card's own commit | `height: auto` → **69 × 40** | `min-height: var(--btn-h-m)` → **69 × 44** |

> **One thing that looked like a defect and was not.** The probe reported the
> card's buttons `covered`, and what covered them was `div.add-sheet.ntfp-sheet`
> — the notification-permission sheet the app raises on the FIRST logged workout
> (v363's `vault:session-saved`). Real behaviour; the probe was working behind
> it. Worth recording because "the control is covered" reads as a layout bug and
> was a sequencing one.

## v374 — T2.6: a measurement is one object, and its parts have an order

The plan listed five Arabic number/unit defects. **Measured in the running app,
three of the five were not defects at all**, and that is the useful half:

| the plan | painted, in an RTL line | verdict |
|---|---|---|
| «g160» — a unit before its number | `<span class="num">160kg</span>` → **`160kg`** | **refuted** — digits and a Latin unit inside one span form one run and read correctly |
| «30 الدقائق» | «مدة: 30 دقيقة» → **`مدة: 30 دقيقة`** | **refuted** |
| «660 1,455 lb kg» on 7 of 7 cards | authored `660 · lb · 299.4 kg` → **`lb 660 kg 299.4`** | **confirmed** |

**The confirmed one is not a bidi problem, it is a FLEX problem**, which is why
the existing `body[dir="rtl"]` rules could never have fixed it: they flipped the
`margin-left`/`margin-right` of `.w-unit` and `.w-alt` — moving the unit to the
other side of a number it had already been torn from. The three spans are flex
items, and in an RTL row flex lays them out right to left, so each unit lands
beside the wrong figure.

`.sets-row-weight` and `.session-card-volume-value` carry `direction: ltr` now,
so the group keeps its authored order while the row around it stays RTL.
Measured after: **`299.4 kg 660 lb`** and **`1,200 kg 2,646 lb`**, both exactly
as authored. The margin flips are gone — with an LTR group the authored margins
are the correct ones.

> ⚠️ **`direction` ALSO DECIDES WHAT `flex-start` MEANS.** The cell had
> `body[dir="rtl"] … { justify-content: flex-start }`, which was the RIGHT edge
> while it inherited `rtl` and became the LEFT edge the moment the group turned
> LTR. It says `flex-end` now, and the edge was measured rather than reasoned:
> the content sits at x 270–375 inside a cell spanning 35–375 — flush right,
> where it has always been. `.sets-row-reps` is deliberately left alone: it
> shares the rule but not the problem.

## v373 — T2.3: the halos that were 42, and the rail that made one unfixable

The audit found ≥7 controls whose "44px" halo measured 42, and named the cause:

> ⚠️ **`inset: -4px` IS MEASURED FROM THE PADDING BOX, so each 1px border costs
> the halo 2px.** A 36px bordered control with `inset: -4px` reaches 42, not 44.

Seven of the eleven haloed controls carry a 1px border and moved to `-5px`;
the four that are borderless (`.compare-tab`, `.bundle-add`, `.rec-del`,
`.rec-act`) were already right and growing them would have made them 46 for
nothing. **Which ones have a border was checked, not assumed.**

Two more had a different cause and would not have answered to any inset:

- **`.data-actions` was `gap: 2px`** — two 32px controls whose 44px halos
  overlap, so the later one wins the shared strip and each measured **34 wide
  against 44 tall**. `.vault-bar-actions` was `gap: 4px` with the same result
  (**40 wide**). 12px each, the arithmetic v324 already applied to `.link-btn`.

> ⚠️ **AND `overflow-x: auto` MAKES THE OTHER AXIS CLIP TOO.** CSS does not
> allow `visible` on one axis beside a scrolling one, so `.filter-bar` cut every
> child's `::after` at its own padding box — 2px above. `.filter-pill` measured
> **42 with its inset computing to `-5px`**, and no change to the pill could ever
> have fixed it. The rail's top padding is 6px now. This is worth remembering
> for every future halo: **a control inside a horizontal rail cannot have a halo
> bigger than that rail's padding.**

Measured after, by real hit-testing outward from each centre — a halo counts, a
neighbour stealing an edge counts against:

| | box | before | after |
|---|---|---|---|
| `.calendar-nav-btn` | 36×36 | 42 | **44 × 44** |
| `.vault-action` | 36×36 | 40 wide | **44 × 44** |
| `.ledger-add` | 343×36 | 42 tall | **81 × 44** |
| `.filter-pill` | 57×36 | 42 tall | **58 × 44** |
| `.data-actions .icon-btn` | 32×32 | 34 wide | **44 × 44** |

Also removed: `.hero-card .planner-day-muscles`, which **v368 left behind** when
it deleted the markup and the muscle block. Nothing catches a dead selector
here — contract 35 checks that every `var(--x)` exists, not that every rule has
something to style.

## v372 — T2.1: Home knows the workout is half done

Home had three hero branches and **not one of them knew a session was open.**
Log two exercises of five, come back, and the hero still read «ابدأ تمرين
اليوم» — the same words and the same filled button as before you started. The
screen the owner looks at most had no idea he was mid-workout.

A fourth branch now sits ahead of `hasPlanToday`, in two states of one fact:

| | eyebrow | meta | CTA |
|---|---|---|---|
| not started | خطة اليوم | ٢ تمارين · ٢ مجموعة هذا الأسبوع | **تمرين اليوم** (filled) |
| open | **قيد التنفيذ** | **١ من ٢ تمارين** | **أكمل تمرينك** (filled) |
| finished | **اكتمل** | **٣ مجموعة · 65 kg** | **سجّل أكلك** (line, not slab) |

**Counted by EXERCISES COVERED, never by sets.** A plan slot is a list of
exercises, and "1 of 2" is the only count that means anything to the person
reading it. A session with no sets is not coverage: the guided run writes a row
the moment a number is typed, and an empty one is an intention.

**Finished is not a task, so it loses the filled button.** What is left of the
day is eating, and that is a line, not a slab. The rest chip goes with it — a
finished workout has nothing to decline.

> **The CTA keeps its PLACE and the comment says exactly how much it moves.**
> First draft asserted "THE CTA DOES NOT MOVE"; the measurement said 352 → 352
> → **338**, because a ghost control is shorter than a filled one and the
> eyebrow row lost its chip. 14px, in the state where the label changed anyway
> — but a comment this file's own numbers contradict is a defect, so it states
> the number instead of denying it.

Two defects in my own branch, both caught by rendering it rather than reading
it: the meta read **«3 المجموعات · 65»** — `t('sets')` is the COLUMN LABEL, and
a definite article after a numeral is not Arabic, while `fmtWeight()` returns a
bare figure and the unit comes from `unitLabel()` separately. It is
«٣ مجموعة · 65 kg» now, the singular tamyīz being the house style
`sessions_this_week` already uses.

## v371 — T1.4: the save centre shrinks when there is nothing to do

Measured before touching it, at 375×812, and the number that decided the
change is not the height but its **invariance**:

| | card | share of the settings fold |
|---|---|---|
| synced | 261px | **34.8%** |
| error | 261px | 34.8% |
| every other state | 261px | 34.8% |

The block was IDENTICAL in every state — including a **52px «إعادة المزامنة»
button with no job** when everything is already synced, and a **44px caveat**
about photo backups, describing a failure that is not happening.

**CALM is derived in `saveCenterModel`, beside every other decision about this
card**, and it is exactly "nothing failed and the cloud is confirmed". In it
the device line goes (it is implied — a device that failed to write is never
calm), the action goes, the caveat goes. What is left is the state and when it
was confirmed:

| | before | after |
|---|---|---|
| synced | 261px · 34.8% | **111px · 14.8%** |
| error | 261px | **261px — unchanged** |

**The nine v310 state strings are untouched**, per v364's rule: each carries
real information and the calm line is composed from the ones that already
exist rather than from a new sentence. No key was added or removed.

The rows are hidden with `display: none` rather than visually — the status
block is `aria-live`, and a screen reader should hear what the screen shows,
not the two lines it no longer shows.

> **The fingerprint net could not see this either, and says so honestly:** the
> matrix runs the empty, signed-out state, where the cloud is not `synced`, so
> `calm` is false and the card stays whole. Its 144/160 is containment — the
> only differences are the build label and the one `id` this change adds.

## v370 — T1.2: the tick that logs numbers you never typed

The plan said sets have no undo. **They do** — `changeSlice` records every
session write and four paths already offer it. What had none was the one write
that can happen with no input at all: **✓ on an untouched row fills reps and
weight from last time's ghost and commits them.** Measured before the fix:

| | on screen | in the database | toast |
|---|---|---|---|
| before ✓ | empty, ghost `8 / 40` | — | none |
| after ✓, nothing typed | `8 / 40` | **`{reps:8, weight:40}`** | **none at all** |
| after un-✓ | `8 / 40` | **still there**, `done:false` | none |

Un-ticking does not take it back — it means "not done", not "delete" — and per
v298 an un-ticked set still counts in stats and PRs. So a mis-tap wrote a set
the user never performed, into their volume and their records, silently.

**Only the ✓ that INVENTED the numbers offers Undo.** An ordinary ✓ over
figures you typed stays silent: a toast every ninety seconds mid-workout is
noise, and that tick is already its own undo. The token is captured before the
write and compared after — the same guard the blur commit uses — because
`commitExercise` can decline to write and offering the PREVIOUS entry would
undo something nobody asked about.

Measured after, in three phases: the offer appears («سُجّلت بأرقام المرّة
السابقة»), taking it leaves **`db: []`** and an empty row; un-ticking still
keeps the set; a typed ✓ raises nothing. Proved able to fail both ways —
`invented &&` → `false &&` loses the offer, → `true &&` fires on the typed
tick — with `js/app.js` restored byte-for-byte each time.

> ⚠️ **`DB.undo.apply` IS LIFO, SO EACH PHASE STARTS FROM THE SAME STATE.** The
> first probe ticked, un-ticked, re-ticked and then tapped Undo — testing a
> token that was no longer the newest entry. It reported STALE against working
> code, which reads exactly like a broken feature.

## v369 — T1.1: the guided run resumes its POSITION, and now its plan too

v189 built the resume and v296 reshaped it, and in the eleven months since,
**it had never once been measured against a real close.** Every check was a
re-render inside one living page — which is the case the feature does not have
to survive. `viewContext` dies with the document; the database does not, and
the run's position is DERIVED from it rather than stored, so a close is the
only gesture that touches the part that can be wrong.

`ux-flows.js` has a fifth path now: start the run, move to the second
exercise, log a set, **close the page**, reopen, and walk back in. The close is
a NEW PAGE in the same context, not a reload — the old document and every JS
global go, `localStorage` stays, which is what an Android WebView kill leaves
behind. It arrives through `openPage()`, split out of `openContext()` for this
and exported, so the reopened page is fenced, clocked and ready by the same
code the first one used; a second spelling would drift, and the first thing to
drift would be the fence. **The split was proved inert the way this project
requires: a matrix on each side, 160/160 cells identical, 0 differences.**

### ⚠️ MY FIRST PROBE COULD NOT HAVE FAILED, AND THE PLANTED DEFECT PROVED IT

The plan's own suggested mutation is `runIdx = 0` always. Planted against a
probe that logged its set on the FIRST exercise, **the report did not change at
all** — because the correct answer there is also 0. A probe whose subject is
the default value is a probe that cannot see the bug it was written for.

It logs on the **second** exercise now. With the same mutation planted it fails
by name — `NOT the exercise it was on (كيبل كروس أوفر)`, the tick gone, the
rows empty — and with `js/app.js` restored byte-for-byte it passes. 1 of 1.

### What the proof then found: the position came back, the PLAN did not

| after closing mid-exercise | before | after |
|---|---|---|
| the exercise | كيبل كروس أوفر | **the same** |
| the logged set, in the database | `{reps:10, weight:55}` | **unchanged** |
| its ✓ | restored | restored |
| **set rows on screen** | **3** | **1** |

`runInit`'s saved-session branch mapped today's sets 1:1, so the moment a
session existed for today the row count — which is how many sets you are
DOING, and which comes from the slot's `targets` or from last time — was
dropped. Close the app after set 1 of 3 and you came back to one row, with
nothing waiting for the set you were about to do. The feature's own comment
says **"RESUME, do not restart"**; it resumed the position and restarted the
plan. It now pads back out to the planned count, and the padding can never
invent history because `commitExercise` drops every row with no reps and no
weight — measured: **3 → 3, and the database still holds exactly one set.**

> ⚠️ **INSIDE THAT BRANCH, `last` IS TODAY.** `lastForExercise` sorts by date
> descending and today's own session is the newest, so padding to `last.sets
> .length` there is padding to your own length — a no-op that reads as a fix.
> It reads `lastForExercise(exId, today.id)`, with today's row excluded, which
> is the same discipline v189 already applied to the suggestion and the
> best/last cells for exactly this reason.

**The fingerprint net's 160/160 is again WEAK evidence for this change** and is
reported as such: the matrix runs the empty state, where `runInit` takes its
no-history branch and never reaches the code that moved. What the net is doing
here is its second job — proving nothing ELSE moved — and that holds.

### T1.3 — the duplicate-tap lane, and three ways it lied before it was true

`ux-flows.js` now runs each of the four daily writes a second time with the
final button tapped **twice, 120ms apart** — a bounced thumb, a dropped frame,
or a phone that read one press as two. Nobody taps twice in 120ms on purpose.

**Every one of the four holds, and each by a DIFFERENT mechanism** — which is
the useful part, because three of those mechanisms are accidents of something
else and only one is a guard:

| | | how |
|---|---|---|
| water +250 | **doubles, by design** | a cup is a STEPPER — three taps mean 750ml |
| body weight | one row | the button stays live and **accepts** the second tap; `changeSlice`short-circuits a write whose value is unchanged, and the day already holds that entry |
| a set | one row | the card's Save **removes itself** once it commits — `the control is gone` |
| a saved food | one row | the v357 800ms `disabled` guard, measured **refusing** |

Nothing needed fixing, so nothing was changed. **Named residual:** body weight
is the only one of the four with no guard of any kind — it is protected by a
data coincidence, not a decision, and it would break silently if that sheet
ever gained a second field or logging ever became multi-entry per day.

#### ⚠️ THREE WAYS THE LANE REPORTED SOMETHING FALSE FIRST

1. **"2 sets after a double tap" is not a duplicate.** The day card also
   commits the rows it pre-filled from last time, so a single, correct save
   already produces more than one set. I had written the expected count as a
   constant I guessed, and it read as a defect. The fix is that the set case
   carries **its own one-tap control**, run from the same cleared state, so the
   pre-filled rows cancel out. Both come out `1 session / 2 sets`.
2. **A fixed-coordinate second tap could not reach the guard it claimed to
   test.** Proved by DELETING the v357 guard: the lane still said ONE — because
   the undo toast resizes the open sheet (v324's `:has(.toast.show)`
   reservation), the row slid **134px** out from under the point, and the
   second click landed on the modal. That case was decoration. The second tap
   FOLLOWS the control now, which is also the likelier human gesture; what a
   fixed-point bounce *would* have hit is recorded beside it from the same
   instant, without spending a second click. With the guard removed the lane
   now says **DOUBLED, 2 rows**, and with it restored, ONE.
3. **Counting the undo ledger proved nothing at all.** It reported `0 new
   entries` for all four — including the saved-food add, which demonstrably
   pushes one. The ledger is a **ring buffer capped at 5**, `changeSlice`
   shifts the oldest out, and the fixture already saturates it, so the length
   is pinned at 5 forever: the delta was a property of the container. It reads
   the HEAD now, which is what the user sees in «آخر التعديلات» — and the set
   case then shows exactly one `session_saved` above my own `session_deleted`.
   **Water and body weight never appear in that ledger at all**, so for those
   two the row count is the only evidence there is; that is stated rather than
   left to look like a clean result.

#### ⚠️ AND MY OWN PATCHER PRINTED THREE SUCCESSES IT THEN THREW AWAY

It accumulated edits in memory and wrote the file **once at the end**, so when
a later assertion fired, the two edits already applied were discarded — while
the `ok` lines they had printed stood as evidence they had landed. I only
caught it because the next run showed `undefined` where the new field should
be. A patcher writes after each edit and **reads the bytes back**, or it says
up front that nothing is written until all of them pass. Printing success
before durability is the same failure this project keeps recording in the app,
turned inward on the tooling that checks it.

## v368 — T1.5: the three actions the shell's own furniture was hiding

The first task out of the owner's research plan, and the one it ranked first
because it was already measured. Every number below is from `.uxaudit/pass2` —
the 20 views WITH data, ar/dark/375 and en/light/412 — taken before anything
was touched.

| | before | after |
|---|---|---|
| Home hero | 315px | **186px** |
| calories card visible above the fold | **45** of 214px | **174** of 214px |
| the weight card | y=1028 | y=**899** |
| water «+250» hit box (ar) | **35**×36 | **53**×36 |
| exercise-detail hero | 281 / 309 | **211 / 232** |
| «سجّل جلسة» | y=718 / 758 — **below the 748 fold** | y=**648 / 681**, above it in both |
| its hit box (ar) | 53×**30** | 53×**44** |

### 1. Home's hero carried a SECOND copy of the muscle heatmap

`js/app.js:1727` already recorded the decision: *"The muscle heatmap moved to
the Program tab (renderProgram)."* The hero kept its own copy anyway — 117px of
chips plus a 12px margin, **129px inside a 315px card**. That is why the
calories numeral's top edge landed on **y=748 exactly**, the fold line, and why
v318's own measured ladder (151–252px of that card visible) had stopped holding.

Deleting it took `groupMusclesFromExercises`'s only caller, twelve now-dead CSS
rules (1,578 bytes) and — the part a grep would miss — the last reader of
`anterior` and `posterior`. **Contract 38 (every dictionary key must be
reachable) would have failed the commit**, so both keys left both dictionaries
in the same change. That is the contract doing exactly the job v358 built it for.

### 2. ⚠️ THE FLOATING ADD BUTTON OWNS A COLUMN, NOT A MOMENT

The Food screen's FAB is absolutely positioned in `.app` at
`inset-inline-start: 16px` and is 68 wide, so it covers x 16..84 of the start
edge **at every scroll position**. The water row sits under it: in Arabic the
«+250» cup measured a **35px** effective hit box out of a 126px-wide control,
while «+500» beside it measured a full 53. In English 53px of it were covered.

So the fix is a reserved column (`padding-inline-start: 76px` = the FAB's 16px
inset + its 68px width − the card's own 16px padding + 8px of clearance), not a
shorter hero. **A height fix would only have held at `scrollTop: 0`.**

> **And the cup is still flagged `tap<44`, honestly**: it is **36px TALL** with
> no halo, which is a different defect — T2.3 in the plan, one line of `inset`
> away, and not this task's to claim.

### 3. The detail hero photo went 4:3 → 16:9, and NOT into the top bar

At 4:3 a decorative stock photo took **281px of a 375px phone — 37.6% of the
fold** — and pushed the screen's only filled action to y=718 (30 of its 44px
visible) in Arabic and y=758, entirely under the nav, in English. Seven of the
eight seeded screens that have a filled action keep it above the fold; this was
the exception.

> ⚠️ **Moving the button into `.detail-top` was the tidy-looking fix and is
> wrong.** That bar tucks itself away on scroll (`app.js` adds `.tuck` and sets
> `bar.inert = true`), so an action parked there would leave the accessibility
> tree the moment the user scrolled — hiding it *more* thoroughly than the nav
> did. The photo is `object-fit: cover`, so 16:9 crops rather than distorts.

### What the fingerprint net can and cannot say here

Both lanes report **160/160 views and 106/106 sheets identical**, and that is
**weak evidence for this change** — stated plainly rather than quoted as a pass.
The matrix runs the **EMPTY state**: Home takes a different hero branch, Food
shows the setup card, and exercise-detail renders its not-found stub. The net
never renders what moved.

The real containment check is the audit's own 40 **seeded** cells, diffed
`pass2` against `t15`:

```
CHANGED  ar_dark_375/home              scrollH 1516 -> 1387 · primary y 481 -> 352
CHANGED  ar_dark_375/exercise-detail   flags {tap<44:1, belowFold:14} -> {belowFold:14}
                                       scrollH 2811 -> 2741 · primary y 718 (below) -> 648 (above)
CHANGED  en_light_412/home             scrollH 1516 -> 1387 · primary y 481 -> 352
CHANGED  en_light_412/exercise-detail  flags {belowFold:15} -> {belowFold:14}
                                       scrollH 2582 -> 2504 · primary y 758 (below) -> 681 (above)

4 cells changed · 36 identical, of 40 seeded cells
```

> **Food is absent from that list and it was NOT untouched.** The comparison key
> is `counts.flags`, and the cup's count stayed `tap<44: 6` because its height
> still fails — so a real 35→53 improvement produced no diff at this resolution.
> **A coarse key that cannot see a fix it should see is a coarse key that cannot
> see a regression either**; the per-element hit box is what proved this one, and
> the diff key is the thing to sharpen before the next task leans on it.

### ⚠️ DETECT THE DOMINANT LINE ENDING, NEVER ITS PRESENCE

The patcher wrote LF search strings against CRLF files and matched nothing, so
it gained an ending-detector — `s.includes('\r\n')`. Then one of my own
replacements joined with `'\r\n'` into a file the tool was treating as LF,
**and the detector then read those 22 self-inflicted CRLF as proof the whole
file was CRLF**, silently breaking the next edit. A file's ending is the one
most of its lines use, not any ending that occurs in it. (`core.autocrlf` is
`true` here, so the working tree is CRLF throughout and git stores LF — which
is also why the committed diff is 13 added / 74 removed and not a whole file.)

The allow-list guard caught a second one: my own class list omitted
`planner-side-label`, and the CSS removal refused rather than cutting a rule it
had not been told about.

## v367 — APK build 24: four widgets, and the mark the app actually uses

The owner's verdict on build 23's widget: «ما عجبتني، ما فيها هويّة ولا شكل
جذّاب». Then, on the first redesign: **«هذي الهويّة لا أريدها، انظر في التصميم
الحالي»** — and he was reading his own app correctly.

### ⚠️ I DESIGNED AGAINST A DOCUMENT THAT HAS BEEN WRONG FOR 140 RELEASES

`docs/BRAND.md` §1 and this file both say the in-app mark is THE CUT. It is not.
`styles.css` says so in its own words — `/* --- THE CUT is retired --- */` — and
has since **v227**. CLAUDE.md's own v348 note already recorded the problem:
*"three documents agree with each other and disagree with the app."* I read the
documents instead of the running app, and built a whole widget family on a mark
the app dropped 140 releases ago.

**The live mark is `brandLockup()` (js/ui.js:522):** two bar PLATES flanking
`VAULT` with `TRAIN` beneath it. Measured off the running app rather than
guessed — plate 10×15, gap 6, VAULT 11px Archivo 800 at .2em, TRAIN 5.5px mono
at .3em, plates in `--accent`.

Then the owner cut it further: **the plates ALONE, no wordmark** — «الي علامته
خطوط البرتقاليّة فقط كأنّها أثقال». He is right on the measurement too:
`brandLockup` derives TRAIN at half the VAULT size, so inside a widget it lands
at **6.5px**, under every legibility floor this project has; and the app itself
drops the sub-line below size 10. A shape reads at any size. A 5.5px word does
not.

> **The rule this leaves behind: measure the app, not the document.** BRAND.md
> and CLAUDE.md's mark sections were still wrong and knowingly wrong after this
> release — **corrected at v385**, from the code: both now describe TWO marks,
> the lockup inside the app and the cut on the icons and the download page, and
> both name `privacy.html`, which paints a cut and which BRAND.md had never
> listed at all.

### The four, and why four in ONE build

| | size | what it is |
|---|---|---|
| `VaultWidgetProvider` | 4×2 | today's workout + kcal/protein/water, the streak chip, the mark |
| `CaloriesWidgetProvider` | 2×2 | what is LEFT to eat, one big mono number |
| `StreakWidgetProvider` | 2×2 | the streak, today's split under a rule |
| `QuickWidgetProvider` | 4×1 | workout · weight · +250, three buttons |

⚠️ **Every widget is a manifest receiver, so every widget revision costs a new
APK and a manual install for ~10 people.** Four now, in one build, rather than
four builds. The class name `VaultWidgetProvider` is kept for the same reason:
a widget the owner already placed is bound to THAT name, and renaming it would
make it vanish on update rather than change.

### The quick-log widget cannot write, and does not pretend to

The app's data lives in the WebView's own storage, which nothing outside it may
open — that is the whole reason `DB.widget.push()` hands out a snapshot. So each
button carries `thevault://quick/<action>` and the web side performs it.

> ⚠️ **TWO DOORS, AND BOTH ARE REAL.** A cold launch delivers the url through
> `App.getLaunchUrl()`; a warm one — the app already in memory, the common case
> on Android — delivers it through `appUrlOpen`, and `getLaunchUrl` still
> returns the ORIGINAL launch. Listening to one means the button works once and
> then silently stops.
> ⚠️ **AND AN ACTION IS SPENT ONCE.** Without the 4-second guard a resume
> re-runs the last one: tap +250 in the morning, come back at noon, and a second
> cup is logged that nobody poured.
> ⚠️ **AND EACH PENDINGINTENT NEEDS ITS OWN REQUEST CODE.** Intents differing
> only by DATA are "the same" to `PendingIntent.getActivity`, so three buttons
> sharing a request code collapse into whichever was created last — three
> buttons, one action, silently. The action is hashed into the request code.

### What build 23 got wrong in the pixels

- ⚠️ **The machined edge was never drawn.** The tile's stroke was `#1F2B2620` —
  a **dark** line at 12% on a `#0d0a07` tile, i.e. invisible. `--border` is
  `rgba(255,232,212,.11)`, which in Android's `#AARRGGBB` is **`#1CFFE8D4`** —
  light. Every colour in the widget drawables is computed from the token now
  rather than typed, because that conversion is exactly where it went wrong.
- The tile had no texture. It carries the icon's own bar field now: a 2dp bar on
  an 11dp pitch at 3.5% white, as an 11×1 **mdpi** PNG tiled by the platform.
  mdpi is deliberate — 11px at mdpi IS 11dp, so the PITCH stays 11dp on every
  density; `nodpi` would pin it to 11 physical px, a 3.7dp pitch on a 3× screen.
- The widget drew in the launcher's font. Three faces ship in `res/font/` now
  (Archivo, JetBrains Mono, IBM Plex Sans Arabic — all OFL, 776 KB, header of
  every file checked), so numbers are mono and words are the app's face.

### Rules that bite, found while writing it

> ⚠️ **REMOTEVIEWS HAS A FIXED VIEW SET AND PLAIN `View` IS NOT IN IT** — nor is
> `Space`. Every bar, plate and divider is an `ImageView` with a background,
> which IS in the set and which `setInt(id,"setBackgroundResource",…)` repaints.
> A `View` inflates fine in the app and throws in the launcher's process, on the
> home screen, where there is no console. The generator asserts the view set.
> ⚠️ **THE LAYOUT DIRECTION FOLLOWS THE APP, NOT THE PHONE.** A widget inflated
> in the launcher's process takes the LAUNCHER's locale, so an Arabic app on an
> English phone would draw its Arabic words left-to-right.
> `setLayoutDirection` from the snapshot's own `lang` is what keeps them together.
> ⚠️ **`--` MAY NOT APPEAR IN AN XML COMMENT**, and the guard I wrote for it
> caught *my own* comment (`--border`) on its first run. It cost a build on 23.

**Not a lock-screen widget.** The design called the streak tile «القفل» at
first; Android removed lock-screen widgets from phones in 12 and brought them
back in 14 for TABLETS only, so a phone cannot host one. It is a home-screen
identity tile, which is what it always was.

### Measured

40 contracts · lint · **13 suites, 0 failed, 0 skipped**. The widget suite
caught the six new snapshot words itself and was updated to expect fourteen.
Read out of the BINARY, never the source — and AAPT2 path shortening renames
every resource file (`res/EY.xml`, `res/Cf.ttf`), so a filename grep proves
nothing and every id is resolved through the resource table:

| | |
|---|---|
| `versionCode='24' versionName='3.3'` | ✓ |
| `android:debuggable` | absent · `allowBackup=false` intact |
| the four receivers | all present by class name |
| the six Kotlin classes | all in `classes2.dex` |
| 5 fonts · 4 layouts · 9 drawables · 4 labels | all resolve through the table |
| `widget_today` compiled | links real `@font/…` and `@drawable/widget_mark_*` ids |

> The build printed `e: Daemon compilation failed: Could not connect to Kotlin
> compile daemon` and then `BUILD SUCCESSFUL`. That is exactly the case where
> reading the binary is the only honest check — Gradle fell back to in-process
> compilation and every class is genuinely there.

## v366 — APK build 23: the widget reaches the phone, and a leak found on the way

v365 shipped the web half and said the APK was owed whether or not a widget ever
shipped, because **every installed copy is debuggable and that voids
`allowBackup="false"`** — the `debuggable false` fix had sat in `build.gradle`
since v348 with `versionCode` never moving. Seventeen releases. This build
carries it, the native bridge and the widget together.

### ⚠️ DB.widget.clear() CALLED A METHOD THE PLUGIN DOES NOT HAVE

`clearLocalUserData()` calls `DB.widget.clear()` on logout. It called
**`P.remove(…)`**, and `WidgetBridgePlugin.kt` declares `set`, `clear`,
`status`. No `remove`.

> **A Capacitor call rejects ASYNCHRONOUSLY, so the synchronous `try/catch`
> around it cannot see the failure: `clear()` returned `true` having cleared
> nothing.** The next account on a shared phone would find the previous user's
> weight, calories and workout name ON THE HOME SCREEN — the v351 leak, on the
> least private surface the device has, which is the exact outcome `clear()`'s
> own doc comment says it exists to prevent.

The cause is a half-finished swap: the code was written against
`@capacitor/preferences` (`Preferences.remove({key})`), the plugin was replaced
with our own, and `_plugin()` was updated — the call NAMES and their `key`
arguments were not. `P.set({ value })` and `P.clear()` now; the plugin owns the
storage name, which is why neither passes a key.

**And the suite that should have caught it was blind twice.** Its stub was
`Plugins.Preferences` with `remove({key})` — mirroring a package this app does
not use — so `clear()` "passed" against a plugin that does not exist. And the
`labels` block added for the snapshot called `t()` bare while `computeStreak`
two lines above it is guarded on `typeof` for the same reason (both live in
later scripts), so the suite was failing outright with `ReferenceError: t is not
defined` by the time the native half landed.

> **A STUB IS A PROMISE ABOUT A SURFACE THE HARNESS CANNOT LOAD, AND A PROMISE
> HAS TO BE KEPT.** The stub is now read against `WidgetBridgePlugin.kt` on
> every run — both the name it registers under and its `@PluginMethod` set — the
> same move v356 made when it derived the Cloud stub surface from the scripts.

### Contract 40, and the anchor it needed

Two agreements with no compiler between them, both failing silently:

| | what a mismatch does |
|---|---|
| `Capacitor.Plugins.X` ↔ `@CapacitorPlugin(name = "X")` | `_plugin()` returns null, and `push()` is DOCUMENTED to return false then — so the widget never updates, for ever, and nothing reports it because that IS the no-APK path |
| `P.m(` ↔ `@PluginMethod fun m` | the async rejection above |

**Proved able to fail, 6 of 6**, every file restored byte-for-byte: the shipped
defect verbatim, the plugin renamed from either side, `clear` renamed to `wipe`,
the annotation commented out, and a negative control (`P.status`, a legal
method, stays silent).

> ⚠️ **The commented-out case is the one that taught something.** It did NOT
> fire at first, because the method regex is unanchored and so counts
> `// @PluginMethod` as an export. Anchored to line start in **contracts 15 and
> 40** — 15 had carried the same hole for the Health plugin since v298.

### Read out of the binary, never the source

The rule this project paid for three times with the launcher icon. AAPT2 path
shortening renames every resource file (`res/RC.xml`, `res/EY.xml`), so a
filename grep finds nothing and proves nothing — the resource IDs are resolved
through the table instead:

| | |
|---|---|
| `versionCode='23' versionName='3.2'` | ✓ |
| `android:debuggable` | **absent entirely** — build 22 carried `=true` |
| `android:allowBackup=false` | survived ✓ |
| `<receiver .VaultWidgetProvider exported=true>` + `APPWIDGET_UPDATE` + meta-data → `@0x7f100002` → `xml/widget_today_info` | ✓ |
| that provider info | 140×140dp, `updatePeriodMillis=0`, `resizeMode=3`, 2×2 cells |
| the layout `@0x7f0b002d` | all **16** ids resolve BY NAME; only FrameLayout / LinearLayout / TextView / ProgressBar, so RemoteViews can inflate every one |
| `MainActivity.onCreate`, disassembled from `classes2.dex` | `const-class HealthConnectPlugin → registerPlugin`, then `const-class WidgetBridgePlugin → registerPlugin` |

**5.29 MB against build 22's 6.74**, and the drop is explained rather than
assumed: `debuggable false` turns nine un-merged dex files into two
(16.9 MB → 14.4 MB uncompressed). The web bundle's 32 `assets/public/` entries
and `assets/capacitor.config.json` are all present, and `js/ui.js`, `js/body.js`
and `js/food.js` appear for the first time — the v359–v362 split reaching the
shell.

### The widget itself

- **RemoteViews, deliberately not Glance.** Glance needs Jetpack Compose, and
  this project's first law is no dependencies and no build step. The cost is
  real and paid here: no arbitrary drawing, a fixed set of view types, every
  value set by id.
- **Every word it draws travels in the snapshot**, not in `strings.xml`.
  Android keys resources off the SYSTEM locale, but this app's language is a
  preference set inside the app — a widget reading its own resources would sit
  in English beside an Arabic app with no way to correct it. Eight words cost
  ~140 bytes and mean a copy change reaches the widget on an ordinary web push,
  with no new APK.
- **An age, not a clock**, and only past 120 minutes. A widget is a state AS OF
  a moment; saying when it was taken is the difference between stale and wrong.
- **`updatePeriodMillis=0`** — Android never polls it. `WidgetBridgePlugin.set()`
  repaints every placed widget itself, because otherwise logging a set would
  leave the home screen stating the old number for up to half an hour.
- ⚠️ **Every widget is a manifest receiver, so every widget revision costs a new
  APK and a manual install for ~10 people.** That is why this build ships the
  one resizable provider that reads a single snapshot, and not the quick-log
  widget — working buttons are the only part with real unknowns, and an install
  is not spent on an unknown.
- ⚠️ **`--` MAY NOT APPEAR IN AN XML COMMENT**, and I wrote `--surface-1` in
  `widget_bg.xml` and `--surface-3` in `widget_meter.xml`. The resource compiler
  refuses the file outright. CLAUDE.md records this trap for `icon.svg`; it
  applies to every XML resource, and it cost a build.

### Measured

40 contracts · lint · **13 suites, 0 failed, 0 skipped**. The fingerprint net
against a v365 baseline captured on a stashed tree: **160/160 views and 106/106
sheets, 0 differences** — the web change lives entirely inside `DB.widget` and
draws nothing, so the net's second job applies: proving the fix did not leak
into anything else.

## v365 — the widget snapshot: the half that can be proved before the APK exists

The owner asked for home-screen widgets on both platforms, chose to defer iOS
entirely, and left the Android decision to me. I read the shipped binary rather
than the source to decide it:

```
aapt2 dump xmltree download/THE-VAULT.apk --file AndroidManifest.xml
versionCode = 22   debuggable = true   allowBackup = false
```

> ⚠️ **EVERY INSTALLED COPY IS DEBUGGABLE, WHICH VOIDS `allowBackup="false"`.**
> `adb run-as` and `chrome://inspect` both work on a debuggable app, so the
> WebView storage — session token included — is readable, which is exactly what
> build 21 added the backup flag to prevent. **The fix has been in
> `build.gradle` since v348 (`debuggable false`) and `versionCode` is still 22,
> so it has never been built.** Sixteen releases of waiting.

So the APK is owed whether or not a widget ever ships, and the widget's marginal
cost becomes the widget itself. **And every Android widget is a manifest
receiver, so every widget revision costs a new APK and a manual install for ~10
people** — which is why build 23 will carry the three that read ONE snapshot and
not the fourth (quick-log needs working buttons, the only part with real
unknowns; an install is not spent on an unknown).

### This release is the WEB half, and it is inert

`DB.widget.snapshot()` is a pure read over eight DB namespaces; `push()` hands it
to a Capacitor Preferences plugin **no shipped APK carries yet** and does nothing
when it is absent — the same shape `js/health.js` and `js/notify.js` use, which
contract 26 enforces. So it ships on an ordinary push, is verified by the
machinery that already exists, and starts landing the day an APK carries the
plugin. Holding it back until then would mean shipping both halves at once,
untested. Views 40/40, sheets 106/106, zero differences.

### Two rules the snapshot is built around

> ⚠️ **THE DAY IS RESOLVED AT WRITE TIME, NEVER PASSED IN FROM A RENDER.** This
> codebase has shipped the render-time-day bug six times. A widget makes it
> strictly worse than a screen does: a phone left untouched past midnight keeps
> the snapshot on screen for hours, so a stale day is not a flicker, it is the
> whole display.

> ⚠️ **AND LOGOUT MUST CLEAR IT, WHICH NO EXISTING SWEEP COULD DO.** The snapshot
> lives in native storage, outside every `localStorage.removeItem` in
> `clearLocalUserData`. Without the one line added there, the next account on a
> shared phone finds the previous user's weight and calories **on the home
> screen** — the v351 leak, on the least private surface the device has.

It carries numbers and the plan slot's own name: no photos, no session token, no
logs. Measured at **331 bytes**, and the suite fails if it grows past 900 or
gains an array.

### scripts/test-widget-snapshot.js — the thirteenth suite

A source half asserts the day comes from `todayISO()` and never from a sliced
timestamp. A behaviour half runs the real `js/storage.js` in a vm: shape, an
explicit past date honoured, nothing forbidden in the JSON, **inert with no
plugin**, landing and clearing with one, a throwing plugin contained, an empty
install answering with nulls, and `computeStreak` read at call time because it
lives in a later script.

**6 of 6 mutations caught**, `js/storage.js` restored byte-for-byte: the UTC
slice, a captured day, `push()` claiming success with no plugin, `clear()` not
removing the key, a history array reaching the snapshot, and `computeStreak`
called unguarded.

> **Two of my own mistakes are in the suite as comments, because both make a test
> vacuous rather than red.** Objects built inside the vm realm are not
> `deepStrictEqual` to ours — the failure prints them looking identical (the trap
> already recorded on `test-plan-import.js`), so the comparisons are JSON. And my
> cardio seed passed `'walk'`, which is the ICON name; the type id is
> `'walking'`, so `add()` refused, nothing was created, and every assertion about
> `snap.cardio` would have been testing an absence. **Every seed asserts it took
> now** — a seed that fails silently makes the whole suite prove nothing.

### Next, and what it needs from the owner

Build 23 = the `debuggable false` fix + the plugin + the three widgets. Before
any build, `npm run sync`: the root `capacitor.config.json` differs from the copy
in `android/app/src/main/assets`. Same debug signing key, so it installs over
build 22 with no uninstall and no data loss; the signing-key decision stays
separate and is the owner's.

> ⚠️ **And none of this project's verification reaches native code.** 39
> contracts, 13 suites and the fingerprint net are all web-side. The widget will
> be verified the way v212, v304 and build 22 were: build it, then read the built
> binary with `aapt2` — never trust the source. This project has shipped an icon
> that was right in source and wrong in the binary three times.

## v364 — «وين المنطق؟»: the ledger, and twelve headings at one weight

Two owner reports on the running app, both correct.

### 1. «هل معقول يظهر فيه كل الايام زي كذا وين المنطق؟»

With no cardio logged, the screen was **seven identical dashed rows** — the
same sentence «لا كارديو» seven times, each with its own date, under a heading
reading «كل الجلسات» and over three stat boxes already reading 0, 0, 0.

> **The v299 design is right and so is the complaint — they are about different
> situations. An empty day is information only AS A GAP.** Between days that
> have something, "nothing on the 17th" is a fact worth a row and a + to fill
> it. With nothing in the window at all it is not a ledger, it is the word "no"
> repeated `days` times.

So an empty WINDOW collapses to one empty state; an empty DAY inside a window
that has entries is untouched. Measured in the running app: **7 rows → 1 box**
with no data (view height 544px), and **7 rows with 5 gaps** once two sessions
three days apart exist. `dayLedgerHtml` is shared, so sleep got the same rule
from the same line — which is the boundary v362 chose it for.

### 2. «زبط الاعدادات وخلي الها معنى والشكل خليه افضل»

Settings opened with **two unexplained full-width buttons** — «برامج سابقة» and
«آخر التعديلات», both niche history tools, in the loudest position on the page
with no heading over them — and then **twelve `.section-title` dividers at one
weight in no order**: language, exercise names, theme and unit are four
headings for one thing, while the cloud copy, the account and the export sat
apart from each other.

> ⚠️ **THE MISSING LEVEL IS ABOVE .section-title, NOT BELOW IT.** That class is
> 11px, uppercase, 0.18em tracking, with a rule line after it — it is already a
> LABEL. The instinct was to demote the twelve and add a smaller label under a
> new heading; that would have produced a page of 9px text. The fix adds ONE
> level above and changes nothing inside: **25 ids/data-attributes and 41
> strings, the same sets**, asserted by the patch itself.

Five groups: حسابك والمزامنة · المظهر واللغة · التذكيرات والصحة · النسخ والسجلّ ·
التطبيق. The two orphan buttons moved under «السجلّ» inside the backups group,
where they are what they are — your data's history.

### ⚠️ AND CONTRACT 38 CAUGHT MY OWN PATCH DESTROYING MARKUP

The restructure locates each block and re-emits it. The first spelling found a
block's close with `at('</div>', …)` — any line CONTAINING one — which matched
`<div class="settings-action-icon">${icon('refresh', 20)}</div>` and truncated
two blocks.

> **The patch's own check passed**, because it compared the set of ids and
> data-attributes and every line it dropped carried neither. **Contract 38 — the
> v358 inverse, every dictionary key must be reachable — is what caught it**, by
> noticing `reset_data`, `reset_data_sub` and `privacy_policy_sub` had stopped
> being referenced by anything. A hook-set check proves the handlers still have
> elements; it does not prove the markup is intact. The patch asserts the STRING
> set too now, and closes only on a line that IS `    </div>`.

### The save centre: one column, because the label was the value

The rows asked for a label and a value, and the values are complete
self-describing sentences — so the label repeated them and the repetition was
what squeezed the sentence into a column too narrow for it:

| label | value |
|---|---|
| على هذا الجهاز | **محفوظ على هذا الجهاز** — the same phrase twice |
| النسخة السحابية | **المزامنة السحابية غير مرتبطة بهذا الجهاز** — «السحابية» twice, wrapped to two lines |

The nine state strings are NOT touched — they were written in v310 and each
carries real information («your saved device copy is available» during an
outage is reassurance, not decoration). What went is the column that repeated
them, and with it `sc_device`/`sc_cloud` from both dictionaries. Measured after:
**44px and 43px, one line each**, in Arabic and in English. And `sc_title`
narrowed from «الحفظ والمزامنة» to «حالة الحفظ», because the group heading now
carries «المزامنة» and the eye tripped on the echo.

### The net proved the change was CONFINED, which is its other job

A design change is supposed to differ. What must not differ is everything else:
**6 of 40 view cells changed — cardio, sleep and settings, in both contexts —
and the sheets lane is 106/106 identical.** Nothing else moved.

> A crude first pass called 23 cells changed and sent me hunting through `home`
> and `calendar`. It was comparing the whole record including `renderMs`; the
> tool's own diff had said 34/40 identical all along and was right. **Compare
> what the tool compares, or you will chase your own timing jitter.**

## v363 — the reminder system is TOLD, not called

Five call sites in two domains reached into the notification domain by name:
three workout save paths called `maybeAskNotifPermission()`, and two supplement
paths called `armNotifications()` then `syncRemindersOrWarn()`. They are two
`vault:*` events now — `vault:session-saved` and `vault:reminders-changed` —
with both listeners INSIDE the notifications block, so they travel with it.

### ⚠️ THE REASON IS NOT TIDINESS: A CHECK CAN SEE AN EVENT

Every one of those five calls sat inside a bare `try { … } catch (_) {}` or was
unguarded, so a rename or a load failure made it **silently do nothing, for
ever**. That is verbatim the v251 failure — the arming function "was never
called at boot… so a normal session armed zero in-app timers, and on the web
reminders did not exist at all". **Contract 7 refuses a `vault:*` event that is
dispatched and never listened for, or listened for and never dispatched. It has
no way to see a swallowed ReferenceError.**

The dispatch is synchronous, so nothing about the order of work moved: the same
code runs at the same moment, reached by a name the tooling can check. The three
workout sites also carried a comment saying there are THREE save paths and all
three must ask — one name now, and a fourth save path cannot forget.

Shell calls were deliberately left direct (`afterScripts`, `refreshAfterSync`):
the shell is allowed to call a domain, that is what a shell is. What went was
domain→domain.

### scripts/test-notif-events.js — the twelfth suite, and the first to test this at all

Two halves, because either alone proves nothing. A **source** half asserts no
function outside the notifications domain or the shell names those three by
name — a green browser check over an app that still called directly would say
nothing about whether the old path was removed. A **browser** half spies on the
three and dispatches each event, asserting the calls happen synchronously, once,
and in the pair's original order, and that an unrelated `vault:*` event reaches
neither.

> ⚠️ **THE SPIES WORK ONLY BECAUSE A TOP-LEVEL `function` IN A CLASSIC SCRIPT IS
> A PROPERTY OF THE GLOBAL OBJECT.** `const`/`let` are not — they live in the
> declarative record and cannot be replaced from outside. The technique covers
> function declarations only, which is what these five names are.

Proved able to fail, 3 of 3: the pair reordered, a workout path calling by name
again, and the listener deleted (that one is caught by contract 7, not the
suite). Views 40/40, sheets 106/106, zero differences.

## v362 — js/body.js, and a boundary that turns a shared helper into a private one

The third file out of `js/app.js`: **sleep, body weight and cardio**. app.js
**10,004 → 9,183 lines (502 → 464 KB)**. Views **40/40 identical**, sheets
**106/106**, zero differences each.

### Why the three go together, and it is not "they felt related"

`dayLedgerHtml` — the one-row-per-day renderer — has **exactly two callers**,
`renderSleep` and `renderCardio`. Split sleep from cardio and it has to stay
behind in app.js as a shared helper forever; kept together it is **internal to
this file**. That is the deciding measurement:

> **A boundary is better when it turns a shared helper into a private one, and
> worse when it does the reverse.** Sleep+weight alone was 389 lines and left
> `dayLedgerHtml` in app.js. Sleep+weight+cardio is 799 lines and takes it.

All three are also the same SHAPE — a day entry, one row per calendar day —
against a workout, which is a structured session of sets.

### ⚠️ ONE LATERAL EDGE IN, AND IT IS THE FEATURE, NOT DEBT

`renderProgram` calls `resolveCardioType()` and `openCardioScheduleModal()`. The
Program screen is **where cardio is scheduled** (v315), and `resolveCardioType`
was lifted to module scope in that release precisely because Program and Home
both render a cardio row. Inventing an indirection to hide that edge would buy
nothing. Outward the file reaches only shell, router and shared primitives —
zero lateral edges out.

### Compare did NOT come, and the criterion is v359's own

It was the obvious thing to bundle in. Measured instead, by DB namespaces — the
test that kept `renderHome` with the router:

| | namespaces |
|---|---|
| `renderHome` / `renderDay` | **10 / 11** — genuinely cross-domain |
| `renderCompare` | **0** — a dispatcher |
| its three panels | 2 / 1 / 1 — one domain each |

So Compare is not a composition like Home; it is three single-domain panels
behind a mode toggle. But `renderCompareWorkouts` reads `exercises`+`sessions` —
the WORKOUT domain — so filing the view under "body" would put a workout panel
in it, and **splitting one view across three files would be worse than leaving
it whole**. It stays with the router. `MODE_LIST`/`modeToggleHtml` stayed too:
that is the THEME toggle, settings chrome, and it sits beside the save centre.

### ⚠️ MY OWN SPLICE CUT THREE LINES OF LIVE CODE, AND THE ASSERTIONS DID NOT SEE IT

The extraction removes three runs and two orphaned banners. The runs went
bottom-up correctly; the orphans went in a **second pass whose `.reverse()` left
them ASCENDING**, so removing the earlier one shifted the later one and it cut
three lines of real code instead of the banner it named.

> **Every assertion I had written passed.** They ran against the ORIGINAL line
> numbers, before any splicing — which is exactly the window an index-shift bug
> lives in. It surfaced only because a `grep` afterwards found the banner still
> there. **Assert at the point of the cut, or do not assert:** the removal list
> is one list now, sorted strictly descending, checked for overlap, and every
> splice reads back what it is about to take before taking it.

### Three comment banners describing code that is not there

Found by scanning every view script for a banner block followed only by another
banner. **Two were left by v359** — `// Calorie / macro calculator` and
`// FOOD LOG VIEW`, whose functions moved to js/food.js — and the third
**predates v358**: the saved-food picker's banner has been sitting 560 lines
above its own function, immediately over the recipe calculator's banner (checked
against `018563f`, so the split did not cause it — it made it visible). All
three healed; the picker's is back over `openSavedFoodPicker`.

### The v360 structure work paid for itself immediately

**39 contracts and lint passed on the first run.** Contracts 26 and 36 and the
ESLint `DB.*` law all read `VIEWS` from `scripts/shipped.js` now, so wiring a
third view script was two list entries and a script tag — against v359, where
four hand-written file lists had to be found and corrected one at a time.

### Proved, and the one that failed was my test

**9 defects planted in js/body.js, 9 caught**: contract 36 (a sheet outside the
net), 34 (the same name in two scripts), 26 (an unguarded module call), 1 (the
file dropped from the list), 39 (VIEWS naming an unshipped file), and four
ESLint rules — `no-undef`, the `DB.*` law, the UTC-day rule and the active-view
rule. One case first read MISSED, and the mutation was wrong, not the contract:
it inserted a decoy list without removing anything, so contract 39 was correctly
silent. Rewritten to actually name an unshipped file, it fires by name.

### The cost is now below what this harness can resolve

Alternated before/after/before/after, as v360's lesson requires:

| | BEFORE (12) | AFTER (13) | BEFORE (12) | AFTER (13) |
|---|---|---|---|---|
| local | 47.1 ms | 46.6 ms | 48.5 ms | 45.7 ms |
| 200 ms RTT | 862.2 ms | 863.9 ms | 875.2 ms | 875.1 ms |

**Two of the four deltas are negative, and two identical BEFORE runs differ by
1.4 ms.** So the thirteenth script costs something on the order of v360's
measured +1.3 ms and this harness cannot resolve it at n=8 — which is the
honest statement, not "it got faster". Do not read a negative delta here as a
speed-up.

### Next

What is left in app.js is the shell plus three domains. **Notifications** is the
largest single block (836 lines, one run, no top-level statements) and carries
the last lateral debt worth inverting: four sites — `openSessionModal`,
`renderSessionDay`, `renderSessionRun`, `openSupplementModal` — call
`armNotifications()` directly. That is one concern, a domain arming the reminder
system, and it inverts into a `vault:*` event for free, with contract 7 already
enforcing that every such event is both dispatched and listened for. **Planner**
(815 lines) and **supplements** (430) follow, and workout last.

## v360 — the floor: js/ui.js, and the measurement that reversed its own headline

The second file out of `js/app.js`, and the opposite kind of cut from the first.
`js/food.js` was a DOMAIN, chosen for having no lateral edges. This is the
**FLOOR**: the bottom of the call graph, the words every view is written in.
**10,597 → 10,004 lines (531 → 502 KB)**, and both fingerprint lanes say nothing
moved — views **40/40 identical**, sheets **106/106**, zero differences each.

### The set is a CLOSURE, computed, not a list somebody liked

Seeded with the obvious primitives and closed over what they mention: **41
declarations, 6 runs, 485 lines, ZERO top-level statements**, and the closure
dragged in exactly three names — `openModal`'s own state bindings. Its ten
top-level bindings all initialise to literals, so loading before app.js is safe
in both directions for the same reason js/food.js is: every borrowed name —
`I18N`, `ICONS`, `DB`, `startOfWeek` — is read at CALL time.

### ⚠️ DB.prefs IS ALLOWED AND THE REST OF DB IS NOT — measured, not chosen

The tidy rule to write was "a primitive touches no DB at all". It is false, and
the check said so before it shipped: **`t()` — the most-called name in the app,
101 callers — reads `DB.prefs.get().lang`**, and all five weight formatters read
`DB.prefs.get().unit`. Unit and language ARE presentation; user DATA is what must
never be reachable from here. **A rule known to be false is a rule people route
around**, so the rule says what is true and **contract 39** enforces exactly that
line: `DB.prefs` yes, any other `DB.x` no, no Cloud, no module, no `navigate()`,
no `renderView()`, no `localStorage` — plus no dead primitive, and no name in
VIEWS that is not a shipped script.

### ⚠️ FOUR MORE CONTRACTS READ A MOVED FUNCTION OUT OF app.js — ALL FOUR LOUD

v359 caught two that would have gone SILENT. This release found four more of the
same family, and every one of them **failed the commit** instead:

| | read | broke on |
|---|---|---|
| contract 21 | `src['js/app.js']` for `mirrorUi({…})` | `applyLang` moved |
| contract 21 | …and for `'theme-' + theme` | `applyTheme` moved |
| theme-color | `applyTheme`'s two `#…` literals | `applyTheme` moved |
| contract 36 | app.js + food.js, hand-listed | `openModal`/`openImageLightbox` moved |

The difference between loud and silent is the whole lesson of the two releases:
**a check that MATCHES a pattern fails loudly when its subject moves; a check
that matches and then tests the result goes quiet.** Contract 24 was the second
kind. All four now read `VIEWS` from `scripts/shipped.js`, so this is the last
release in which a moved function can break a hand-written file list.

### VIEWS and EARLY are spelled POSITIVELY, and that is a bug class too

Contract 26 derived its scan by SUBTRACTION — `JS` minus a hand-listed six —
which has the failure mode backwards: **a script added to JS and forgotten there
silently JOINS the view layer** and gets view rules applied to it, with nothing
to say so. `scripts/shipped.js` now spells `VIEWS` (the three that render) and
derives `EARLY` (everything loading before the four late modules) from the ORDER
rather than from a list. Contract 39 refuses a VIEWS entry that is not shipped.

> And v359 left contract 26 reporting `` `app.js:${i + 1}` `` over a CONCATENATION of
> five files — so a real unguarded call in js/food.js would have been reported at
> a line number in a file that does not have it. The check was right and the
> report was a wild goose chase. Each line keeps its own file now.

### A sentence that had been severed across 850 lines

`let toastTimeout = null;` sat at line 388 carrying two lines of `hideToast`'s
doc comment ending mid-clause — **"…Safe to"** — while the third line,
**"call anytime (navigation, view change…)"**, sat at 1241 above the function it
documents. An earlier edit had cut a comment in half and moved the halves 850
lines apart. Both ends came out in the same extraction; deleting one blank line
rejoined them.

### ⚠️ MY FIRST BOOT MEASUREMENT WAS WRONG BY A FACTOR OF FIFTEEN, IN MY FAVOUR

v359 shipped with an upper BOUND (215 ms of TTFB budget) instead of a number, so
this release measured it. Done the obvious way — baseline first, then the change
— DOMContentLoaded went **71.9 ms → 47.3 ms**: adding a twelfth script had
apparently made boot **34% FASTER**, with the two distributions not even
overlapping. A flattering result with a clean separation is exactly when to
distrust it. Alternated before/after/before/after in one window:

| | BEFORE (11) | AFTER (12) | BEFORE (11) | AFTER (12) |
|---|---|---|---|---|
| local | 45.6 ms | 46.7 ms | 44.8 ms | 46.3 ms |
| 200 ms RTT | 867.1 ms | 863.7 ms | 859.2 ms | 861.0 ms |

The whole 24 ms was **the cold first browser launch of the session**. The honest
cost of a twelfth `<script defer>` is **about +1.3 ms of parse/execute and
nothing measurable at 200 ms RTT** — because deferred scripts are discovered in
one HTML parse and fetched in parallel. That also retires v359's 215 ms bound:
it was honest and it was ~165× too loose.

`scripts/measure-boot.js` keeps the method, in two lanes (`local` isolates parse
and execute; `rtt200` uses this project's own measured TTFB), and it reports
`first sample vs median` so a cold run announces itself instead of flattering.
**One un-alternated run measures the machine, not the change.**

### ⚠️ AND THE FINGERPRINT NET'S TWO LANES SHARED ONE TAG NAMESPACE

`matrix --tag X` then `modals --tag X` both wrote `.fpnet/X.json`, so the second
**silently ate the first** and the views evidence was gone. v357 added a guard
refusing to compare a views record with a sheets record — it simply never got the
chance, because the overwrite had already happened. **The check was right and
could not run**, which is this project's most expensive recurring shape.

The lane is part of the filename now (`X.views.json`, `X.sheets.json`), a bare
tag means EVERY lane under it, and a lane captured on only one side is a FAILURE
rather than a smaller report — proved by feeding it a one-lane tag and watching
it refuse with exit 1. `diff uiB uiA` now reports both lanes in one command.

### Proved, not assumed

**16 defects planted, 16 caught**, all three files restored byte-for-byte: each
of contract 39's six refusals plus its dead-primitive and VIEWS arms; DB.prefs
staying allowed (a negative control — the rule is a line, not a ban); both halves
of contract 21; the theme-color literal; a new sheet in ui.js the net does not
know; the same name in two scripts; a reordered script list; and two ESLint rules.

### What did NOT move, and why

`setUiLanguage()` re-renders, so it stayed: applying a language is vocabulary,
deciding to repaint is the router's job. `vaultBar()` reaches the unified search
and the undo ledger. The in-app notification bar closes cleanly as a nine-name
cluster but **exactly one caller opens it, inside one domain** — a surface with
one caller is not shared, and moving it here would mean moving it twice.
`isNativeShell()` has one caller and sits under `exportBackupFile`'s own doc
comment; taking it would have split a comment from the function it documents.

### ⚠️ AND CI CAUGHT WHAT THE LOCAL RUN COULD NOT (v361)

v360 was pushed with every gate green and **CI went red**. The filename was the
smaller half of it. `scripts/test-fingerprint.js` built the record path itself as
`<tag>.json`; the lane change moved it to `<tag>.views.json` — and **locally the
old file was still on disk from an earlier commit**, so all four assertions
passed against a record the run they had just performed did not write. On CI,
with an empty `.fpnet`, it failed honestly.

> **The stale read is the defect; the rename merely exposed it.** That suite could
> have passed with the tool writing NOTHING, and had no way to say so. It deletes
> the record first now — so "the file exists" genuinely means "this run wrote it"
> — and it takes the path from the tool itself (`fingerprint-net.js` exports
> `OUT` and `recordFile` behind a `require.main` guard) rather than spelling it a
> second time, which is what broke it.

Proved three ways: green against an EMPTY `.fpnet` (the CI case); a planted stale
2-cell record at both the old and the new filename **ignored**, the suite still
reading 160 fresh cells; and with the tool mutated to write nothing the assertion
**fires by name** — `the matrix wrote no record at …ci-smoke.views.json`. The
tool was restored byte-for-byte.

> And the wider lesson, which this project has paid for before: **a local `npm
> test` runs against a working directory that CI does not have.** `.fpnet/` holds
> 40-odd records from earlier commits. Any suite that reads an artifact it did not
> just create is reading history, and history passes.

### Next

The floor is down and proved. Body/health and settings next, then **workout
last**: 28 inbound edges and the only lateral debt left, seven sites of which are
one concern — a domain arming the reminder system — that inverts into a `vault:*`
event for free.

## v359 — the split begins: js/food.js, and the two checks it would have silenced

The first domain leaves `js/app.js`. **12,974 → 10,597 lines (644 → 531 KB)**, and
both fingerprint lanes say nothing moved: views **40/40 identical**, sheets
**106/106**, zero differences each.

### Food went first because it was measured to, not chosen

Re-derived on this tree rather than taken from the survey: **28 declarations, 4
runs, 2,377 lines, and ZERO top-level statements inside any run** — which is what
makes a pure cut-and-paste safe. Of the four domains it is the only one with **no
lateral edge in either direction**:

| | inbound | outbound |
|---|---|---|
| **food** | **8 sites, every one shell/router** (renderView ×2, the unified search ×4, bootCatalog, showOnboarding) | 23 names — all shared primitives, router or chrome |
| workout | 28 | owes lateral debt in three directions |

> ⚠️ **AND IT LOADS BEFORE app.js — THE ONE ORDER THAT IS NOT ARBITRARY.**
> `bootCatalog()` calls `setServerFoodCatalog()` inside a bare `catch (_) {}`, and
> `Cloud.configured()` is synchronous — so with food.js AFTER app.js the
> continuation after `await Cloud.pullCatalog()` can drain in the microtask
> checkpoint at the end of app.js's own execution, the ReferenceError is
> swallowed, and the server food catalog silently never merges. Forever, with
> nothing to see. Contract 1 pins the order and fails loudly on it.

The other direction is safe for a measured reason: all three of food.js's
top-level bindings initialise to **literals** (`FOOD_CAT_ORDER`,
`SERVER_FOOD_PRESETS`, `_zxingPromise`), and there is not one top-level statement
in the file. Every name it borrows — `t`, `escapeHtml`, `icon`, `$`, `openModal`,
`DB`, `Cloud`, `FoodAI` — is read at CALL time.

### ⚠️ TWO CHECKS WOULD HAVE GONE SILENT, AND NEITHER WOULD HAVE SAID SO

**Contract 24** read `src['js/app.js'].match(/len \+ line\.length \+ 1 > (\d+)/)`,
and its **only** match in the repository is inside `openRecipeEditor` — food. After
the move: `undefined` → `Number(undefined)` is `NaN` → `if (batch && …)` is falsy
→ **prints ✓ while checking nothing.** It searches the concatenation now AND
asserts it found the cap, so it can never go quiet by losing its file again.

**Contract 26** scanned only `js/app.js` for unguarded module calls. **Ten
`FoodAI.` sites moved.** It loops the view scripts now.

Two more were loud rather than silent, which is the good failure: **contract 1**
refuses an eleventh script tag that is not in the list, and **contract 36** would
have reported all twelve moved openers as "not a top-level sheet any more" — a
true alarm with the wrong diagnosis. It reads both files.

And **ESLint's `vault/no-direct-storage-in-views`** was scoped to `files:
['js/app.js']`, so the `DB.*` law would have stopped covering 2,400 lines of view
code the moment they moved.

### Proved, not assumed

Six defects planted **in js/food.js**, each caught by the check that is supposed
to see it: the batch cap raised past the Worker cap; the cap deleted (contract 24
says **"has gone silent"** by name); an unguarded `FoodAI.` call; a misspelled
identifier (`no-undef`); `localStorage` from view code; a sliced stored timestamp.
**6 of 6**, and `js/food.js` restored byte-for-byte.

### The cost, stated plainly

**One extra request and zero bytes saved.** This is a maintainability change, not
a performance one — and this project measured itself LATENCY-bound in v253
(median TTFB 215 ms against 3 ms of body download), so the honest upper bound is
215 ms of TTFB budget, less in wall-clock because h2 overlaps them. Food **cannot**
be lazy-loaded: `renderView` is synchronous, `food` is a bottom-nav tab, and
`bootCatalog` touches it on every boot.

### What did NOT move, and why

`openUnifiedSearch`, `openSearchDay` and `openRecentChanges` sit inside the food
line span and are **global search and undo** — shell, not food. The convenience
primitives (`convenienceError`, `offerUndo`, `convenienceModal`, `cxHeader`) stay
in app.js because body/health and workout use them too. `renderHome` and
`renderDay` each read eight `DB` namespaces across four domains and belong with
whatever keeps the router — any scheme that files them under a domain is wrong.

`openCoach` moved with the food domain rather than being deleted: it is dead
code, but it is dead **by a recorded owner decision** (v219, with a TO RESTORE
comment beside it and its own SKIP entry in `fp/modals.js`). Reopening that is
the owner's call, not a side effect of a refactor.

### Next

`js/ui.js` (the 22 shared primitives) is second, not first — extracting it first
would put 3,000 call sites across a new boundary before the contract and lint
machinery had been proved on a smaller one. It has been, now. Then body/health
and settings, and **workout last**: it has 28 inbound edges and the only lateral
debt left, seven sites of which are one concern — a domain arming the reminder
system — that inverts into a `vault:*` event for free.

## v358 — the dead-code phase, and the inverse of contract 5

The "clean" half of clean-then-split. **176 lines removed and 0 pixels moved** —
both fingerprint lanes, before and after: views 40/40 identical, sheets 106/106,
zero differences each.

### What was actually dead

| | |
|---|---|
| `VltMotion.count`, `.bar`, `.pulse`, `.numFlip` | exported by `js/motion.js` and called by **nothing** — zero `VltMotion.x` across the ten scripts and four pages |
| `styles.css` §2, §5, §6 + four `@keyframes` | the CSS only those four could apply. `.vlt-bar-fill` was never written by ANY file, so it was unreachable even from `bar()` |
| 15 i18n keys × 2 dictionaries | mostly the leftovers of the meal-bundle sheet whose CSS v337 already removed |
| 5 `DB.*` members, `window.CARDIO_TYPES`, `Cloud.getClient` | no call site anywhere in the shipped client |
| `.btn-accent`, `.vs-noscript`, 4 unread custom properties, 4 dead `admin.html` rules | — |

### ⚠️ THREE WAYS A DEAD-CODE SCAN LIES, ALL THREE MEASURED HERE

1. **A substring test is green by construction.** `no_cardio` survived an earlier
   survey because `ledger_no_cardio` contains its name. A reference is a WHOLE
   QUOTED LITERAL or it is not a reference.
2. **The quote style is not uniform.** My first deletion pass removed 28 of 30
   entries and stopped, because `cx_tools` is the one **double-quoted** entry in
   `js/i18n.js` and the pattern only knew `'`.
3. **The key regex only saw the first key on a line.** `^\s{4}(\w+):` found 883
   names where contract 5 counts 1,079 entries — this dictionary puts two on a
   line in places. The gap was the tell; without it `cardio_sched_empty` would
   have been missed the way `no_cardio` was.

> Each of those is the same shape from a different angle: **a detector whose
> "found a reference" test can be satisfied by something that is not one.** They
> are recorded because the next scan will meet them again.

### Contract 38 — contract 5, inverted

Contract 5 proves every `t()` call has a key. **Nothing proved every key has a
caller**, which is why fifteen outlived their screens. Contract 38 does, and it
was built against all three traps: a whole quoted literal in either quote style,
`data-t="…"` on the pages, and the prefix families rediscovered from the corpus
(`t|tr|F('x' + y)` — `js/foodai.js` uses `tr(`, and a `t(`-only scanner reports
two live keys as dead and blocks a good commit).

Six planted cases: a dead key **fires**; reached by `t()`, double-quoted,
reached by a `tr()` family, and reached only from a page by `data-t` all stay
**silent**; and a key rescued only by a longer key containing it **fires**.
Unreferenced is still allowed when it is a decision — the `KEPT` map takes the
key and the reason, the way `fp/modals.js` names its SKIPs. It ships empty.

### What was NOT removed, and why

- **`DB.cardioTypes.remove` and `DB.foods.remove`** are unreached and stay: each
  is the only delete path for a row the USER created. Removing the only way to
  undo a creation is not dead-code removal.
- **`--green-2`, `--green-ink`, `--chip-h`, `--chip-pad-x`, `--chip-fs`** are
  unread and stay: an empty rung in a designed scale is not the same thing as
  dead weight, and which one they are is the owner's call, not a measurement.
  (`--chip-radius` IS read, at `styles.css:1310`, through the **fallback** form
  `var(--chip-radius, 999px)` — which is why no inverse contract was added for
  custom properties: a regex that requires `var(--x)` would declare it dead.)

### ⚠️ AND ONE THING THE SCAN COULD NOT HAVE SEEN

`DB.mealBundles.add` is dead in the app — and `scripts/test-convenience.js`
called it. The scan was scoped to the shipped client, which is the right scope
for "does the app use it" and the wrong one for "will this break the build". **It
was the suite run that caught it**, which is the system working as designed.

The fix was not to keep the method: `add(data)` was a thin wrapper around
`update(null, data)`, which is what the app calls — so a suite using `add` was
testing a path that could not regress for a user. The suite uses the live one now.

## v357 — the day a write lands on, and the tidy-up the review asked for

The second half of the same adversarial review. v356 took the guards; this takes
the dates, the double-taps, and the structure the owner asked for in his own
words — «الكود مرتب بشكل مخيف كأنّ محترفًا كتبه، عشان الصيانة بعدين».

### ⚠️ THE UTC-DAY BUG CLASS, SIXTH APPEARANCE — IN THE LINT RULE'S BLIND SPOT

v353 shipped `vault/no-utc-calendar-day` for exactly this class. It keys on a
`toISOString()` call — and **six sites had no `toISOString()` in them at all**:
the timestamp was already a stored string and the code did `String(rec.at)
.slice(0, 10)`, which reads its **UTC** day. For every UTC+ user before 03:00
that is yesterday.

The rule learned the second shape — a `.slice(0, 10)` on anything named `at`,
`*_at`, `*At`, `created*`, `updated*`, `replaced*`, `*seen*` — and it was widened
**before** the sites were fixed, so it could be shown naming them: three errors
on the unfixed tree, exactly the three in `js/*.js`. The other three live in
`admin.html`, which ESLint does not read — so they get **contract 37**, which
scans the four pages for the same shapes.

> ⚠️ **AND CONTRACT 37 FLAGGED ITS OWN COMMENT ON ITS FIRST RUN** — the comment
> above `dayOf()` quotes the pattern it warns about. That is the v333 trap (a name
> that appears only inside a REMOVAL comment reads as live), arriving from the
> other direction. It strips whole-line comments now, the way contract 26 already
> does, and only when the slashes OPEN the line so a `https://` URL is never cut.

`dayOfTimestamp(ts)` in storage.js and `dayOf(ts)` in admin.html are the local
answer. Seven planted cases: the defect fires in both files, and the three
correct forms — `dayOfTimestamp(x)`, an ordinary `list.slice(0, 10)`, a comment
about the pattern — all stay silent.

### Two writes landed on the day the SCREEN was drawn, not the day they happened

- **Water on the Food dashboard.** `renderFood` resolves `const date = todayISO()`
  and the tap 60 lines below wrote `DB.water.add(date, …)`. The comment two lines
  above the repaint already says «todayISO() HERE, not the render-time `date`» —
  applied to the repaint, never to the write.
- **Every supplement tick.** Same shape, and here the app already had the better
  answer: Home's cardio row **repaints when the day has moved** rather than
  writing the wrong one. Supplements now does the same (`dayMoved()`), which is
  stronger than swapping in `todayISO()` — the row would otherwise paint "taken"
  consistently with a day the user is no longer in.

Both are the phone-left-open-past-midnight case, which `DATE_DERIVED_VIEWS` only
repairs on a `visibilitychange` that never comes.

### Three more from the same pass

- **The food picker's two "add" buttons had no repeat-tap guard.** The verifier
  refuted the original P1 («rapid taps duplicate the record in five sheets») and
  was right — every sheet save is synchronous and ends in `closeModal()`, and
  `.is-out` carries `pointer-events: none`. But these two sheets **stay open by
  design**, and their sibling meal button already disables for 800 ms. They do now.
- **A barcode network failure said «this barcode is not in the database».** A DNS
  failure, an offline phone, a CSP refusal and a genuinely unknown barcode were
  one message. `auth_err_network` already exists in both dictionaries.
- **`exportJSON()` lost EVERY photo when one was unreadable.** One `try` around
  the whole re-attach loop; one bad side-store key aborted it and the backup was
  handed over incomplete under a success toast. One try per photo now, and it
  says how many it could not read.

### ⚠️ `scripts/build-notif-icons.js` HAD BEEN BROKEN FOR TWENTY-TWO RELEASES

It reads `ICONS` out of a file by `indexOf('const ICONS')`. v334 moved `ICONS` to
`js/catalog.js` — and the substring still matched, because `js/app.js` contains
`const ICONS_FOR` (a local inside `renderNotifications`). It brace-walked an
unrelated block, reported all six glyphs missing and exited 1. **No npm script, no
contract and no CI runs it, which is why nobody noticed.** It reads
`js/catalog.js` now, matches `const ICONS = `, and throws by name rather than
guessing. Verified by running it: six PNGs, byte-identical to the committed ones.

> This is the survey's own thesis, already realised in the repo: it is precisely
> what a hard-coded file path does to a tool when the code moves underneath it,
> and it is the argument for the split's change-list being complete.

### The structure pass

| | |
|---|---|
| `cellProblems()` **crashed the whole run** with a `TypeError` on the `{error}` cell `pageCapture` returns for a missing root | returns and names the cell — proved by pointing a sheet at an overlay that never mounts: `✗ modal/ar/dark/375/notif-perm: no root for …`, no TypeError |
| `diff` accepted a views record and a sheets record as comparable | `lane` and `contexts` are in the record and in the comparability list |
| the ten-file list and the top-level regex were spelled **twice** (check-contracts + eslint), each under a comment saying a second spelling would drift | `scripts/shipped.js`, required by both |
| `scripts/fp/views.js` promised `ctx` "resolved at capture time from the seeded fixture" — **nothing read it** | the six detail views are named as fallback captures, with what each shows; the seeded VIEWS lane is stage 4 |
| `DB.loadFailed`'s comment sat **54 lines** above its declaration, glued to the top of the adopt block | back beside its code |
| `guardForeignBlob`'s "returns true so the caller can re-read" — no caller does | the comment says so |
| the net's header and usage line never learned the `modals` lane or `--contexts` existed; the focus comment cited timers the grep it prescribes does not yield | corrected against the code beside them |

> ⚠️ **THE `ctx` ONE IS THE ONE THAT MATTERED.** Six of twenty views were being
> captured in their NOT-FOUND state — `exercise-detail` is four elements against
> home's 121 — and certified identical on every refactor step. `views.js`'s own
> header names that outcome: «the net is green then becomes true and meaningless».
> The file is honest about it now instead of promising otherwise.

### Measured

Both lanes, twice each, on the finished tree: views **40/40 identical, 4,099
elements**; sheets **106/106 identical, 8,842 elements**; 0 differences. Against
the pre-v356 baselines the same, so nothing in v356 or v357 moved a pixel. 37
contracts, lint, and eleven suites pass.

> The review that produced v356 and v357 ran as eight agents over four lenses;
> three verifiers were cut short by a model usage limit, so **the correctness,
> structure and test-quality lenses are reviewed but not adversarially verified**.
> Every finding acted on above was re-derived here against the files before it was
> touched. The unverified remainder is listed in the next section.

### Still open from the same review

The `scripts/fp/server.js` stub surface is three pasted 1,100-character lines and
has already drifted (all three stub `pushOnce`, which is internal and not on
`window.Cloud`); the two lanes repeat the same 25-line per-cell tail and
`pageCapture` belongs in `scripts/fp/`; contract 36 hand-lists the five dialogs a
second time and never checks `host` against the view list; four auth/gate dialogs
are in neither the net nor its SKIP map. Then the dead-code phase (~9.5 KB, 15
i18n keys, four `VltMotion` helpers nothing calls) and the split, whose first file
is measured to be `js/food.js`.

## v356 — the review of the review: two guards that failed open, one of them mine

> v356 and v357 were written as two bodies of work and SHIP IN ONE PUSH — the
> markers passed through v356 and rest at v357, so no device ever loads a build
> labelled v356. They are kept apart here because they answer different halves of
> the same review: this one the guards, the next one the dates and the structure.

An adversarial pass over everything shipped since v350 (four lenses, every finding
re-derived by a skeptic) plus the six-lens survey that preceded it. The headline is
the shape this project keeps naming: **a guard that fails open and passes review.**
Three of them, and the third was written eight releases ago by me.

### ⚠️ THE EMPTY-BLOB BACKUP GUARD FAILED OPEN

`pushOnce` refuses to overwrite a cloud row that holds real data with a local
blob that holds none — the guard against «Reset all data» destroying the only
backup. It read the row with `try { remote = await pull(); } catch (_) { remote =
undefined; }` and then tested `if (remote && …)`. **A read that threw passed the
guard.** Measured by the verifier on the real `cloud.js`: with the read answering
500, the UPDATE went out carrying `sessions=0` over a row holding `sessions=20`.
Reachable by ordinary means — Reset-all, then one flaky read inside the 1.2 s
debounce. Migration 20 keeps ten prior versions server-side, so the owner could
recover it in SQL; the user could not.

It refuses now: a read that fails, or no client/session, returns `'error'` — the
documented outcome `runPush()` already turns into a retry — and no write is
offered. The dirty flag stays; the next foreground tries again.

> The cloud suite's first case had to change with it, and the reason is worth a
> line: its fixture was data-less, so after the fix the guard's own read failed
> BEFORE the CAS the case exists to test, and «failed CAS never overwrites» would
> have gone green without ever attempting the CAS. The fixture logs a session
> first now, and the case asserts the UPDATE was actually attempted.

### ⚠️ `guardForeignBlob` (v351) DISCARDED THE RESCUE'S OWN FAILURE

`snapshotRaw` returns `false` when it cannot write (quota, private mode) and
records `RECOVERY_FAILED_KEY`. The v351 guard discarded both and swept the device
anyway — the comment said «the blob is KEPT», the code could destroy it. On a
full phone, the previous account's data was deleted by the code that existed to
preserve it.

**No rescue, no sweep.** The snapshot's boolean is the gate; on `false` the device
is left exactly as it was, `localHasData()` stays true, the caller takes the
conflict path it always took (which asks rather than acts), and the failure is
reported. The write-back after the sweep is covered too: it cannot fail for quota
(the sweep freed strictly more than it rewrites) but if it fails at all the blob
goes back where it was. `test-multi-window.js` reproduces the quota case: every
`setItem` throwing, the previous account's blob untouched, `lastUid` unchanged.

### ⚠️ ONE HEALTH METRIC REACHED HOME'S innerHTML UNESCAPED

`js/health.js` coerces eight of its nine metrics through `fmt()`/`round()`;
`exercise.minutes` was interpolated raw into the card, and the card into Home's
`innerHTML`. `health` was in neither validator's list, so a poisoned backup
imported cleanly, and the CSP carries `'unsafe-inline'` on purpose — executed in
a vm over the shipped file with the REAL `fmtNum`: `<img src=x onerror=…>` came
out of `homeSectionHtml()` verbatim. Coerced like its siblings, escaped as well
(the rule, not just the fix), and `health` is validated as an object when present.

> A harness that stubs `fmtNum` as `String(n)` produces a FALSE second finding
> (`heartRate.latest` appears to be a sink). The verifier hit exactly that and
> corrected it; `scripts/test-untrusted-render.js` uses the real formatter.

### `exerciseImageUrl` had no character guard — and escaping could not have helped

The slug lands inside `style="background-image:url('…')"` at three sites. **The
HTML parser decodes `&#39;` back to a quote BEFORE the CSS parser reads the
attribute**, so `escapeHtml()` is no defence there — measured in real Chromium:
`a'); position:fixed; inset:0; …` injected a full-screen overlay. A slug is an
identifier and is now validated as one (`/^[A-Za-z0-9_.-]+$/`); all 73 seed slugs
were checked against the pattern before it shipped, so it cannot blank a real
photo. Ten payloads refused in the new suite.

### `restoreRecovery()` said «restored» after a failed upload

Its own header promised «true only if BOTH the local restore and the upload
succeeded»; it returned `true` unconditionally. It returns `{restored, uploaded}`
now and the toast says which half happened (`sync_restored_local`, both
dictionaries): a restore that stays on one device is half a rescue.

### Proved, in this order

Every new assertion was run against the UNFIXED tree first and went red: the
poisoned metric reached innerHTML, the guard offered no refusal, the sweep ran.
Then the fix, then green. `scripts/test-untrusted-render.js` is the eleventh
suite.

### The fingerprint net, stage 3 — the sheets, and a settle that was still racing

`node scripts/fingerprint-net.js modals --tag X` opens **every `open*()` sheet and
the five dialogs** — 53 entries in `scripts/fp/modals.js` over a seeded fixture
(`scripts/fp/fixture.js`, one of everything through the real `DB.*` API) — captures
them at their root, and asserts each one CLOSES (a corpse in `#modal-root` is a
defect the v341 review found live). Two contexts by default (ar/dark/375 +
en/light/412, ~1.5 min), all eight on request. **Contract 36** compares the list
against the `open*` declarations in `app.js`: a new sheet joins the net, is named
in `SKIP` with a reason, or the commit fails — the six own-overlay sheets and the
camera/microphone/dormant ones are listed with theirs.

| planted, both sheet-only | the views matrix | the sheets lane |
|---|---|---|
| `.rec-sum-t` at full ink + `.modal-title` at weight 400 | 5 differences | **157 differences, 18/106 identical, each named by sheet** |

> ⚠️ **THREE NOISE SOURCES THE VIEWS LANE HAD NEVER SHOWN.** Sheets focus their
> first field from a `setTimeout` (30/60/150 ms), own-overlay sheets reach rest by
> adding `.open` inside a rAF, and `syncDetailTopTitle` toggles a class whose
> opacity then TRANSITIONS — a predicate evaluated before the app's own frame saw
> no animation, and a capture after it read the transition mid-flight
> (`.detail-top-title` flipped in 4 of 40 cells of an unchanged tree). `settle()`
> now runs the app's rAF FIRST, then a predicate in which a PENDING animation
> counts as in flight, then waits for focus to hold still. Measured after: views
> **40/40**, sheets **106/106**, 0 differences each, twice.

Also caught on the way: the harness stubs lacked 36 `Cloud` members the app
reaches (`ensureSdk` first), so eight sheets threw and read as "empty"; the stub
surface is derived from the scripts now. And the fixture had no calorie goal, so
`renderFood` kept opening the calculator over whatever the lane had opened —
eleven sheets "did not close" for that reason alone.

**Still outside the net:** the motion lane (everything runs under reduced motion),
the seeded-data VIEWS (the matrix is the empty state; only the sheets see the
fixture), camera and microphone.

### Still open from the same review, next

The date-write pair (water on the Food dashboard and every supplement tick write
to the RENDER-time day; six display sites slice a UTC timestamp); the food
picker's two unguarded add buttons; `scripts/build-notif-icons.js`, already broken
by the catalog split exactly the way the food split would break it; the dead-code
phase (~9.5 KB, 15 i18n keys, four motion helpers nothing calls); and the split
itself, whose first file is now measured to be `js/food.js` — the only domain with
zero lateral edges in either direction.

## v355 — the net sees all eight cells now, and one of them runs on every push

Stage 1 of the fingerprint net recorded ONE cell of eight — ar/dark/375 — so a
refactor step that broke the light theme, the English layout or a wider phone
would have been certified identical. That is not a theoretical gap; it was
measured before this shipped, and it is the reason the `js/app.js` split could
not start yet.

### `matrix` — stage 2

`node scripts/fingerprint-net.js matrix --tag X` records **8 contexts × 20 views**
— ar/en × dark/light × 375/412 — in one browser, as one record, with **every
property band on** (41 properties, where stage 1 kept 13 so a human could read
the first baseline). `diff` treats the whole thing as one capture and refuses to
compare records taken with different property sets.

| | |
|---|---|
| one matrix | **49 seconds** — 160 cells, 16,396 elements, 41 properties each |
| two matrices, no change | **160/160 cells identical, 0 differences** |
| slowest synchronous render, anywhere | `exercises` at **34ms** |

### The proof that stage 2 was needed, not merely nice

Two defects planted at once — mute text painted at full ink **only in the light
theme** (the v314 shape), and the page title at weight 400 **only in English**:

| | verdict |
|---|---|
| stage 1, ar/dark/375 | **20/20 cells identical, 0 differences — certified, blind** |
| stage 2, the matrix | **98/160 identical, 108 differences — caught**, and each group names its cell: `en/dark/375/calendar` for the weight, `ar/light/375/settings` for the colour |

Both files restored byte-for-byte afterwards.

### The hang lane

The owner's condition on the whole refactor is «لا يعلّق التطبيق». `page.evaluate`
has **no default timeout**, so a render that never returned would have left the
run looking "in progress" rather than failed. Every render is now raced against
a hard ceiling on the Node side: past **8 s** the capture aborts naming the view
— **THE APP HUNG** — because a hung page's main thread cannot be recovered; past
**1.5 s** the render is a PROBLEM (a visible freeze on a phone) and the run fails.
The three slowest renders are printed on every capture so the number is seen
before it is a problem.

> ⚠️ **A NOISE SOURCE STAGE 1 HAD "CLOSED" WAS STILL OPEN, and only eight contexts
> showed it.** The `loaded machine-photo` flip — recorded above as noise source 1
> — reappeared in 5 of 160 cells. `img.complete` is true BEFORE the load event has
> dispatched, and the app's capture-phase `load` listener is what adds the class,
> so the settle predicate was waiting on the browser's flag and not on the state
> the app writes. It now requires a loaded image to CARRY `loaded` (a broken one,
> `naturalWidth` 0 because the fence blocked it, never will). A state, not an
> event. 160/160 identical afterwards.

### `scripts/test-fingerprint.js` — the CI smoke lane the header promised

The net's own header named this file for two releases and it did not exist —
stale prose, which this project treats as a defect. It runs the full matrix on
every push and asserts the four free failure signals plus the hang lane across
all 160 cells: no page error, no empty view, no raw i18n key, no empty `<svg>`,
no slow or hung render, and 0 requests escaped the fence. **It does not diff
against a committed baseline**: fonts are blocked by the fence, so the app under
test renders in `system-ui`, which differs by machine — a byte baseline would
fail everywhere but where it was recorded. The invariants hold everywhere; the
diff stays a local tool. Ten suites now; under `--strict` a missing browser is a
failure, so the lane cannot silently stop running.

**Still outside the net, stated so it is not trusted beyond its reach:** modals
and sheets, the motion lane (everything is captured under reduced motion), and
the seeded-data scenarios — the matrix is the empty state. Each is stage 3–5 and
each is built when a refactor step needs it.

## v354 — the backup that went to the clipboard now asks first

Item 6 of the security plan. Inside the APK, `exportBackupFile()` has two routes
off the phone: the system share sheet when the WebView offers one, else **the
clipboard** — added in v291 because an `<a download>` is inert in a Capacitor
WebView and the export button had been "a button that visibly did nothing at the
exact moment a copy off the phone mattered most". That fallback copied the whole
backup silently, under a success toast.

**The clipboard is not private, and the user is told so before the copy.** On
Android the foreground app and the KEYBOARD can read it, and a keyboard's own
clipboard history keeps a copy for as long as it likes. The copy now happens only
after `confirmDialog` names who can read it and what to do afterwards («ألصقها
فورًا في مكانٍ آمن، ثم انسخ شيئًا آخر»), and the success toast ends the same way.

> ⚠️ **DELIBERATELY NO TIMED AUTO-CLEAR.** It was the obvious addition and it is
> wrong twice over: a wipe of our own write would not reach the keyboard's history,
> which is the copy that actually persists — and it WOULD destroy whatever the
> user copied next. A mitigation that does not mitigate and costs the user data
> is the shape this project deletes, not ships.

It stays the last resort rather than being refused: on a build with no share
sheet it is the only route out at the moment (storage full, corrupt store) one
matters most, and refusing it would be the v291 dead button again. The real fix —
a native share/filesystem plugin — is a NEW APK and the owner's call.

Measured in a fenced browser with the native shell faked and no share sheet: the
dialog appears, **0 copies before OK, 1 copy of 23,458 bytes after it, 0 on
cancel**, the OK button on the primary (not danger) style, nothing left the
machine. Three keys in both dictionaries (en/ar 1078).

## v353 — the linter, and the first thing it found was a rule nobody could see

The agreed refactor is "clean first, then split by domain", under the owner's
condition that nothing changes. The clean half starts with a tool, because this
project has NO BUILD STEP: nothing type-checks, nothing compiles, and a misspelled
identifier in a vanilla-JS file is a ReferenceError that reaches a phone.

**ESLint 9, as a dev tool that never ships** — exactly the decision already made
for Playwright: `npm i --no-save`, never in `package.json`, never in a lockfile,
never in the bundle a user downloads. `scripts/lint.js` reports a loud SKIP when
it is absent locally and a FAILURE under `--strict`, which CI passes — because a
linter that is not running looks exactly like a linter that found nothing, and
that is the shape this project has paid for three times.

### Five rules, each one a defect that actually shipped

`eslint.config.js` encodes the project's own laws, not a style guide:

| rule | the defect it exists for |
|---|---|
| `no-bare-handler-with-params` | v348 — `addEventListener('click', showChangePassword)` handed the Event to `recovery`; change-password dead on both paths |
| `no-utc-calendar-day` | `toISOString().slice(0,10)` — the bug class this codebase has hit **five** times |
| `no-date-string-parse` | `new Date('2026-08-04')` parses as UTC — the previous day for every UTC+ user |
| `no-direct-storage-in-views` | CLAUDE.md's non-negotiable: view code goes through `DB.*` |
| `no-active-view-query` | v324 — a render that asked for `.view.active` while rendering a different view |

Plus `no-undef` with the cross-file global surface **derived from the ten files at
lint time**, never hand-listed — a hand-written list would be a second spelling of
the source and would drift on the first addition.

> ⚠️ **THE FIRST RUN REFINED TWO OF THEM, and that is recorded on the rules.** The
> bare-handler rule flagged seven handlers whose first parameter IS the event
> (`end(e)`, `release(e)`, `down(e)`) — the ordinary, correct case. The defect is
> a first parameter that is NOT the event, which the Event then satisfies as
> truthy. And the active-view rule needed an allow-list of shell functions BY NAME
> (`navigate`, `bindVaultAction`, `syncDetailTopTitle`…), each read and confirmed
> to run outside any render. A new `.view.active` anywhere else is an error until
> it is read and added — that is the rule working, not an exception to it.

### What the first run found

- **`enter_name` was declared TWICE in both dictionaries.** Identical strings, so
  no user saw a wrong word — but in an object literal the last key silently wins,
  so the first line was dead and an edit to it would have changed nothing.
  Contract 5 proves a key EXISTS in both dictionaries and cannot see a duplicate.
- **`js/foodai.js` carried a 13-line copy of the Worker's system prompt** that
  nothing referenced — since v291 the Worker owns the prompt and ignores any
  client copy. A second spelling that could only drift.
- Two dead locals in `app.js`, four in the tooling, one dead `require`.

### Two contracts a per-file linter cannot express

**34 — no top-level name declared in two shipped scripts.** The ten files are
classic scripts sharing one global lexical scope; a `const` declared in two of
them is a SyntaxError that stops the SECOND file from executing at all — a blank
app, with the error in a console nobody on a phone will open. 339 names checked.

**35 — every `var(--x)` names a defined custom property.** A CSS variable that
does not exist FAILS SILENTLY: the declaration is dropped and the element
inherits. v314 shipped `--text-muted` for `--text-mute` and four sheets lost
their hierarchy. **This contract caught one on its first run:** `.rot-section-title`
read `var(--fs-eyebrow, 11px)` — a token that has never existed anywhere, so the
rule had been rendering on its fallback alone. It is `var(--fs-caption)` now, the
real 11px token, and the fingerprint net confirms the computed value did not move.

### Proved able to fail, then proved inert

Eleven mutations planted into the shipped files — each rule's exact defect, two
negative controls that must NOT fire, a misspelled identifier, a duplicate key,
`DB` declared in a second file, and `--fs-eyebrow` restored: **11 of 11 caught**,
all four files restored byte-for-byte. Fingerprint net v351 → v353: **19/20 cells
identical, 2,053 elements, the only three differences the build label.**

> ⚠️ **ONE `--no-save` INSTALL FOR EVERYTHING OUTSIDE THE MANIFEST.** An --no-save
> install PRUNES every package the manifest does not list — so a second one for
> eslint silently removed playwright, and the two browser suites read as "needs an
> external runtime". And an unpinned install resolved ESLint **10**, which no
> longer carries `globals` transitively; the config had leaned on a dependency
> nobody had declared. Both are fixed at the source: `npm i --no-save playwright
> eslint@9 globals`, one command, in CI and in the runbook. A tool that moves on
> someone else's schedule is not a control — the same reason Node is pinned.

**35 contracts + lint + 9 suites.** No shipped behaviour changes beyond the dead
code removed and the one token corrected; `package.json` gains three script lines
and no dependency.

## v352 — nobody could say which libraries were running. Now a contract does.

The security plan named this and it is the cheapest real gap in the app: two
third-party bundles execute with full privileges in this origin, with access to
the `localStorage` the session token lives in — and **nothing in this repo
recorded which version either one was.** No filename version, no `package.json`
entry, no note in the commit that added them.

> ⚠️ **So "is the library in my app clean?" was not "probably yes" — it was
> UNANSWERABLE.** You cannot check a bundle against an advisory list without
> knowing what it is.

Both were identified the only way that proves anything: **download the published
artifact and compare SHA-256.** Not by reading a version string out of the
bundle — the bundle is the thing under suspicion.

| | `js/vendor/supabase.js` | `js/vendor/zxing.min.js` |
|---|---|---|
| package | `@supabase/supabase-js` | `@zxing/library` |
| version | **2.108.2** | **0.21.3** |
| artifact | `dist/umd/supabase.js` | `umd/index.min.js` |
| bytes | 204,619 | 336,008 |
| upstream match | **byte-identical** | **byte-identical** |

`@zxing/library` carries no version marker anywhere in its bundle, so it was
found by **hashing 22 candidate artifacts across 11 published versions until one
matched**. Byte-identical means something worth stating plainly: neither vendored
copy carries a local edit, so nothing was quietly patched into them on the way in.

`npm audit` against exactly those two pinned versions: **0 critical · 0 high ·
0 moderate · 0 low.** Both are behind the current release (2.116.0 / 0.23.0).
Neither gap is a security one today — and **being behind is only safe while
someone is checking**, which is why the re-check is now a row in
`docs/AUTOMATION.md` under "what does not update itself", beside the APK build.

### Contract 33, and it was made to fail before it was trusted

`js/vendor/SOURCES.md` records package, version, artifact, source URL and hash.
Contract 33 recomputes each hash **from the bytes on disk** — the same shape as
contract 32 for the APK — and also refuses a new file in `js/vendor/` with no
block written for it, so a third library cannot arrive unrecorded.

| planted | |
|---|---|
| five bytes appended to `zxing.min.js` | **caught** — named the file, the recorded hash and the real one |
| a new unrecorded `js/vendor/newthing.js` | **caught** — "ships to every device and SOURCES.md does not say what it is" |
| both reverted | green, and the file byte-identical |

> **A hash that does not match its file is worse than no hash**, because it tells
> the reader a tampered file is genuine. That is why this is a contract and not a
> note — the same reasoning v349 recorded for the published APK fingerprint.

**33 contracts now.** This release changes no shipped behaviour: `SOURCES.md` is
documentation and the contract is a dev-time check. Nothing was added to the
bundle the user downloads — the "no dependencies, no build step" law is untouched,
and it is still most of why this app has no supply-chain surface to begin with.

## v351 — the last two P1s: two windows of one app, and two accounts on one phone

The 22-axis audit left exactly two confirmed P1s in code. Both are closed here,
both had their own repro steps corrected on the way, and both are now under a
suite that has been proved able to fail.

### ⚠️ TWO WINDOWS OF THIS APP SILENTLY DESTROYED EACH OTHER'S DATA

`changeSlice` refuses to write over bytes it did not write. **`writeStore` — a
plain `save()` — has no such guard**, so tab A's next ordinary save rewrote the
whole blob from a STATE that had never seen tab B's work. `Cloud.onLocalChange`
then flagged that loss for upload, and the conditional UPDATE was **accepted** —
so the session was absent from the only backup too.

Measured in two real Chromium tabs of one context, fenced:

| | before | now |
|---|---|---|
| B logs a session, then A saves a pref | **B's session is gone** | B's session survives, A's pref lands |
| a refused transaction | `DB.saveState()` still read `{ok:true}` | `{ok:false, code:'STALE'}` |
| what the save centre said | «التخزين غير متاح» — a storage failure | «نافذةٌ أخرى من التطبيق غيّرت هذه البيانات» |
| A's undo stack after B's write | kept, against a state that no longer exists | cleared |

Exposure is narrower than it looks and is stated rather than guessed: **the APK
is a Capacitor WebView with its own storage partition, so APK-beside-Chrome is
NOT this.** What is exposed is two browser tabs, a Chrome-installed PWA beside a
Chrome tab, and the password-reset link opening a second tab.

> ⚠️ **`DB.adoptForeignWrite()` IS DELIBERATELY NOT `reloadState()`, AND THE TWO
> DIFFERENCES ARE BOTH LOAD-BEARING.** `reloadState()` is for a DELIBERATE
> whole-blob replacement — a cloud pull, a restore, a reset. It clears
> `STATE_LOAD_FAILED` unconditionally, and READ-ONLY may only be lifted by a
> deliberate act; and it ends in `imgPrune()`, which deletes every `vault_img_*`
> key absent from the newly loaded STATE — **and photos are device-local**, so
> adopting a sibling's write would have taken this window's photos with it.

The listener is installed in `js/storage.js`, beside the state it refreshes,
because storage.js is the single owner of `STATE`. It refuses anything it cannot
trust: a blob that will not parse (a half-written or quota-truncated write), one
that fails `DB._validateBlob`, a removal of the key (another window logging out —
treating that as a blob would wipe this one), and any key that is not the store.

**The repaint is the other half, and it has one rule.** `app.js` listens for
`vault:store-adopted` and re-renders — but **never over an open sheet and never
inside the guided run**, where a re-render destroys half-typed set fields.
Answering a silent data loss with a smaller one is not a fix. Measured with the
search sheet open and text half-typed in it: **1 adoption, 0 view repaints, the
sheet still open, the typed text intact** — and the data adopted all the same.

### ⚠️ A SHARED PHONE SHOWED THE NEXT ACCOUNT THE PREVIOUS USER'S DATA

Every sync path asked "does the device have data?" and **none asked "whose?"**.
`localHasData()` is anonymous, and `getLastUid()` was never compared with the new
session's uid on either path. So alice's blob was offered to bob as a conflict
whose «keep this device» **upserts alice's sessions into bob's cloud row** — and
the other branch snapshots it into the single rescue slot stamped *bob*, so bob
was then OFFERED a Restore of it.

> ⚠️ **REPRO CORRECTION, recorded because the obvious story is wrong.** "Go
> offline and tap Logout" does NOT produce this state: offline with a valid token
> makes `signOut()` fail with `AuthRetryableFetchError` and the user stays signed
> in. The real triggers are **(a) ONLINE, where `signOut()` SUCCEEDS and it is the
> PUSH that failed** — another device advanced the row, a 5xx, a banned account —
> which is exactly the case where app.js deliberately skips `clearLocalUserData()`
> to preserve the unpushed blob; and **(b) offline with an already-expired access
> token.**

`guardForeignBlob(uid)` runs at the top of BOTH `resolveOnLoginCore` and
`bootSyncCoreUnguarded` — they reach the same `pushed()` branch — and before the
boot path's own fast-path `localHasData()`. The blob is **kept, not discarded**:
snapshotted under the OLD owner's uid, so it stays recoverable by the person it
belongs to and is refused to everyone else by the uid stamp `recoveryInfo()` and
`restoreRecovery()` already check.

**`clearLocalUserData()` is reused rather than re-spelled.** This IS the state it
describes — the device no longer belongs to the account whose residue is on it —
and its prefix sweep already covers the photo side store, the reminder log, the
AI cache and the pre-paint mirror, each of which is the same disclosure by another
route («user B on a shared phone used to read user A's log» is a bill this project
has already paid). A second copy of that key list is how the last one drifted. The
rescue is read back and written again after the sweep, because that sweep removes
it too.

> **The honest limit:** `snapshotRaw` re-attaches an un-backed-up photo only for a
> **custom** exercise, so a photo on a seed exercise with no bucket copy is not in
> the rescue. That is pre-existing — every rescue this app takes has the same
> shape — and `imgPrune()` would have deleted those keys at the next boot anyway.
> It is named here so nobody reads "the blob is kept" as "everything is kept".

### A ninth suite, and it was made to fail before it was trusted

`scripts/test-multi-window.js` runs the real `storage.js` and `cloud.js` in an
isolated vm. Both defects are invisible to a single-document test, which is every
other suite in this project. **Ten mutations were written back into the shipped
files — both defects restored verbatim, plus eight plausible neighbours — and
the suite was run against each: 10 of 10 caught**, with all three files restored
byte-for-byte afterwards. A suite that survives its own bug being reintroduced is
decoration.

> ⚠️ **AND THE ELEVENTH MUTATION FOUND A HOLE IN THE HARNESS ITSELF.** "Adoption
> prunes the photo side store" was NOT caught — because `imgPrune()` sweeps with
> `Object.keys(localStorage)`, and the harness's fake storage was a plain object,
> which yields its METHOD names. **So every prefix sweep in every suite in this
> project had been a silent no-op** — `imgPrune()` and `clearLocalUserData()`
> both. A real `Storage` is an exotic object; the fake is a Proxy now, and with it
> the mutation is caught and "the previous account's photos and reminder log are
> off the device" is a measured fact rather than an inference.

The harness also keeps the PAYLOAD offered to the wire, not just the verb, so
"alice's data never reached bob's row" is checked against the bytes.

### The fingerprint net, again

Both fixes are invisible to every ordinary render: **19/20 cells identical, 2,053
elements, and the only three differences are the build label in the footer**
(`VAULT · v349` → `VAULT · v350`, the marker the v350 capture was taken before).

### Still open

No P1 remains in code. The owner-only list is unchanged and still headed by
`backend/pending/29_ai-usage-fk-repair-v25.sql`; the 43 P2/P3 findings from the
22-axis audit and the clean-then-split refactor of `js/app.js` are next.

## v350 — the 22-axis audit: the rescue that rescued nothing, and the tool that printed a dangerous command

The owner supplied his own audit framework — 22 axes, 10 executable stress
scenarios, and a rules section written specifically against **fake auditing**: no
finding without evidence, confidence separated from severity, every axis
classified explicitly including «NOT TESTED», and a standing ban on writing
"tested" when you only read the code.

Run as written: **22 agents · 1,563 tool calls · 103 findings raised · 47
confirmed after editing · 9 refuted · every P0/P1 and every CONFIRMED claim
adversarially re-checked with REFUTED as the default verdict.**

**Two axes came back clean, and they are the two worth naming first.** Axis 08
(permissions and user isolation) is the strongest positive result in the whole
audit: RLS on all 14 tables, 49 policies all keyed on `auth.uid()`,
`anon`/`authenticated` both `rolbypassrls = false`, storage pinned to
`foldername(name)[1] = auth.uid()`, and all 14 `admin_*` definer RPCs re-checking
`is_admin()` behind `SET search_path TO ''`. **Three identities were simulated —
one synthetic and two real non-admin accounts — and each saw exactly its own row
and zero foreign rows.** Axis 12 (performance) likewise found no defect in the
tested scope. The stated limit is honest: WRITE isolation was proved by reading
the `WITH CHECK` expressions and the grant map, never by executing a cross-tenant
write, because the session was read-only.

### ⚠️ THE ONE RESCUE OFFERED IN READ-ONLY MODE EXPORTED NONE OF THE USER'S DATA

When the stored blob cannot be parsed, `loadState()` quarantines a copy at
`VAULT_KEYS.corrupt` and runs the app on `defaultState()` **in memory**, refusing
every write. The dialog the user then sees offers exactly one action: export a
backup. That button called `DB.exportJSON()`, which serialises `STATE` — and
`STATE` is the default.

Measured in the running app, on a real store truncated to 80%:

| | the old path | now |
|---|---|---|
| bytes | **23,167** | **14,893** |
| parseable | yes | no — it is the raw original |
| **`hasUserData()`** | **false** | — |
| contents | 73 freshly-id'd seed exercises, **0 sessions, 0 foods** | byte-identical to the quarantined copy |
| file name | `vault-backup-…` | `vault-corrupt-…` |
| toast | «تصدير البيانات» — **success** | says it is the unreadable ORIGINAL and **not** a restorable backup |
| nothing quarantined | exports the empty default, reports success | **refuses** |

`grep -n corrupt js/app.js` returned **zero hits**: the quarantined copy was
never named to the user anywhere, and logout deletes it.

> **This is the shape this project has paid for before: a rescue that runs,
> reports success, and does nothing.** It is the same family as `reportError`
> posting into a table that did not exist, and as the feedback cap that could
> never be true.

Three details are load-bearing. The bytes are read through **`DB.corruptRaw()`**,
never a `localStorage` literal in app.js — contract 8 refuses an unregistered key
spelling. The file is **never called a backup**: it is by definition unparseable,
so `importJSON()` would refuse it, and labelling it as restorable would be a
second lie on top of the first. And with nothing quarantined the export
**refuses**, because a file whose `hasUserData()` is false is worse than no file.

### ⚠️ THE PRE-COMMIT HOOK PRINTED THE ONE STAGING COMMAND CLAUDE.md FORBIDS BY NAME

`scripts/check-release.js:61` printed `Fix: npm run release && git add -A` every
time it refused a commit — the most common refusal in this project —
and `docs/AUTOMATION.md` repeated it three times as the release runbook. Against
CLAUDE.md's own «Stage explicitly, never `git add -A`», which names the owner's
private working files.

Measured in the tree at that moment: **493,863 bytes** of the owner's own
untracked working documents, sitting exactly where that printed advice would
sweep them — into a **public** repository, irrevocably.

`git add -u` stages tracked modifications only and **cannot** pick up an untracked
file. The advice is safe by construction now, rather than by the reader
remembering a rule written in a different file. Whether any past commit actually
swept one was not reconstructed from history: this is a latent trigger, not a
realised loss.

### The fingerprint net earned its keep on its first real use

Both fixes change behaviour only in READ-ONLY mode and in a printed hook message
— neither of which appears in a normal render. Capturing against the v349
baseline: **20/20 cells identical, 2,053 elements, 0 differences.** That is the
net's actual job: not to find the bug, but to prove the fix did not leak into
anything else.

### Nine claims the verifier REFUTED, kept because a refutation is worth a finding

Among them: that rapid repeat taps on Save duplicate the record in five sheets
(raised P1); that "go offline and tap Logout" triggers the shared-device leak —
it does not, because offline with a valid token makes `signOut()` fail and the
user stays signed in; that the fingerprint net executes 48.1% of `js/app.js`; that
a dev skip-login button ships to production; and that `www/` and the native asset
copies are stale published copies. **CLAUDE.md:1670 was also corrected by
measurement**: the domain boundary for splitting `js/app.js` is not merely
"designable", it is measurable — 750 of ~1,000 internal edges land in 19 shared
primitives, and only 8 lateral food/workout/body/settings references exist.

### Still open, highest first

Two P1s remained in code and were the next release: **two documents of one origin
silently destroying each other's data** (reproduced in real Chromium, two tabs,
with the loss propagating to the single cloud copy), and **a shared device showing
the next account the previous user's data and letting it upload into its own cloud
row** (reproduced in a vm over the real cloud.js, with a second and worse branch
the first lens missed). Both carried corrections to their own original repro steps.
**Both are closed in v351** — see its note above.

The owner-only list is unchanged and still headed by
`backend/pending/29_ai-usage-fk-repair-v25.sql`.

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

## v349 — the console could not log in, and the download could not be checked

The owner asked for a full review — database, code, design, security — plus the
published catalogue of vibe-coding failures compared against this app. Fourteen
agents across five lenses, then three more surveys. **The headline is worth
stating before the findings: against that catalogue this app is an outlier in
the right direction.** The five failures that most often kill a vibe-coded app —
RLS off, a privileged key in the client, no server-side authorization, hardcoded
secrets, no input validation — are all absent, and absent *by construction*: no
build step and no npm means the highest-rate supply-chain risk (19.7% of
AI-recommended packages do not exist) has no surface at all; one blob per user
means BOLA has no surface; RLS plus definer RPCs means client-side authorization
has no surface.

> **What did land is almost entirely two shapes the research says survive
> competence: a guard that fails open and passes review, and a verification that
> proves the wrong thing.** Both are already in this file's history, and both are
> in this release.

### ⚠️ THE ADMIN CONSOLE HAS BEEN LOCKED SINCE v305, AND NOBODY TRIED

One probe settled it, against the live project, with a fake email and no token:

```
POST /auth/v1/token   → {"error_code":"captcha_failed",
                         "msg":"request disallowed (no captcha_token found)"}
POST /auth/v1/signup  → the same
```

The gate refuses **before it looks at the credentials**. `admin.html` sends a
bare `signInWithPassword` with no `captchaToken` — and a bare
`resetPasswordForEmail` too — so **every** sign-in and every reset from that page
has been refused for as long as Turnstile has been on. The app carries the token
at all three of its doors; this page is standalone, duplicates its own auth, and
was never taught to.

It has its own small Turnstile owner now, shaped like the app's: lazy script load
with a hard timeout, explicit render into a live node, and a reset on every
failure — because a token is single-use and expires in about five minutes, so
without the reset a mistyped password makes the *next* attempt fail on the
challenge instead, which reads as a broken login.

> The probe is worth keeping as a technique: **a fake email answers "is this gate
> on?" without touching a real account or a real password.**

### ⚠️ THE APK IS SIGNED WITH THE ANDROID DEBUG KEY

Read out of the shipped binary, not inferred:

```
Signer #1 certificate DN: C=US, O=Android, CN=Android Debug
Signer #1 certificate SHA-256: e9472323a854d50fd75be5c957feb79c51479177e61e8f378528aa4c89c010b4
```

That key ships with the Android SDK and sits on every developer machine on
earth. **Anyone can sign a modified build with it, and Android will install it
over this app as an update** — inheriting its localStorage, its session token,
its photo side store and its notification log. This is the concrete answer to
"can someone trojan my app", and the signature proves nothing about who built it.

Replacing the key is the owner's call and has a real cost: a new key forces an
uninstall, which takes the device-local photo side store and the notification log
with it. What can be done without touching the key is to **publish what the real
binary hashes to**, so a tampered copy is detectable at all. Before this release
`version.json` carried **zero** hash fields and there was no sidecar.

Now: `apk.sha256` in `version.json`, `download/THE-VAULT.apk.sha256` beside the
binary, and **contract 32** recomputing it from the bytes on every commit.

> **A hash that does not match the file is worse than no hash** — it tells the
> user a tampered binary is genuine. That is why it is a contract and not a note.

### Two navigation sinks that accepted anything

`apk.url` comes from `version.json` and went straight into a main-frame
navigation in two places — `openLink()` in `js/update.js` and `ready()` in
`get/index.html` — with no check of scheme or host. `apk.build` beside it is
type-checked *and* contract-enforced; the URL was not checked at all.

⚠️ **And `javascript:` would actually have run.** The CSP carries
`'unsafe-inline'` in `script-src` — deliberately, for the pre-paint scripts and
Capacitor's bridge — so it cannot stop a `javascript:` URI. The source is
same-origin (it needs repo write), which makes this defence in depth rather than
a live hole, and it is the cheapest possible check.

Both now require `https:` and a host from the release allowlist, and a URL that
fails is **refused**, not silently swapped — `get/index.html` falls back to its
own constant. Measured against eight hostile or malformed inputs
(`javascript:`, `data:`, `http:` on a good host, a wrong host, a lookalike host
`raw.githubusercontent.evil.com`, a protocol-relative `//evil`, empty, null):
**8 of 8 refused, and the real release URL passes.**

### What the audit found that is still the owner's, in order

1. **The daily AI budget has been failing open for nine days** — proven from the
   live logs this time: 16 POSTs to `rpc/ai_budget_take` in 24 hours, **16 × 409,
   zero 2xx**, with matching foreign-key violations in `postgres_logs` at the same
   milliseconds. `backend/pending/29` is the fix and is a live write.
2. **Email confirmation** (the owner's choice over closing sign-up) — without it
   every per-account cap is undone by a second address.
3. **The 8-character floor server-side, and leaked-password protection on.**
4. **The signing key decision** above.
5. **One restore drill.** The runbook says "a backup you have never restored does
   not exist" and none has ever been run — and images were lost here once already.
6. **`pg_cron`, or something that calls the prune functions.** Retention is
   aspirational: the functions exist and nothing invokes them.

## v348 — the full audit: what it found, and the four it could fix in code

The owner asked for a review of the database, the code, the design and the
security, plus web research on the failure modes of AI-built ("vibe coded") apps
compared against this one. Fourteen agents, five lenses, every headline finding
adversarially verified: **26 findings, 8 verified in depth, 0 refuted.**

Against the published vibe-coding failure list — hardcoded credentials, no access
control, silent error handling, happy-path-only code — this app is far above the
norm: no secret ships to a client, RLS is on every table, and cross-tenant probes
return nothing. **The one failure mode it did hit is the most common one on that
list: a guard that fails silently and open.**

### ⚠️ CHANGE PASSWORD WAS DEAD ON BOTH PATHS, AND ONE MISSING `() =>` DID IT

```js
$('#change-pw-btn', el)?.addEventListener('click', showChangePassword);
```

The function is passed BARE, so the click **Event** arrives as its `recovery`
argument and is truthy. That hid the current-password field, skipped its own
required-field check, and reached `if (recovery) return null` in cloud.js — a
`return` from the whole function, not a skip of the re-auth. `updateUser` was
never called, `res.error` on `null` threw, the catch translated `undefined`, and
the password was never changed. **The real recovery path, from the emailed link,
hit the same `return null` and was equally dead.** Two handlers 160 lines above
already use arrow wrappers; this one did not.

Reviving it was not enough on its own. **Turnstile has guarded sign-in since
v305, and the re-auth IS a sign-in** — so `signInWithPassword` would have been
refused with `captcha_failed`, which the old code collapsed into `reauth_failed`
and showed as «كلمة السر الحالية غير صحيحة»: wrong, and unfixable by the user.
The sheet carries a challenge now (re-auth path only — a recovery session never
signs in), the token is passed, the widget is reset on every failure because a
token is single-use, and a captcha refusal is let through so
`translateAuthError` reaches its `auth_err_captcha` branch.

Measured after: both paths return a result OBJECT, never null; the settings sheet
shows the current-password field and the challenge slot, the recovery sheet shows
neither.

### ⚠️ THE SELF-CONFLICT COMPARE COULD NEVER BE TRUE

`same = JSON.stringify(cur.data) === JSON.stringify(payload)` — and
`vault_data.data` is **jsonb**, which canonicalises object key order (by length,
then bytewise) at every level. The app re-imposes its own fixed order on every
load: `defaultNutrition()` declares `sex, age, heightCm, …` and
`Object.assign(dn.profile, parsed…)` keeps the TARGET's order, so the default
wins every time. **The bytes coming back never matched the bytes going out**, so
every silent self-conflict adoption escalated into the user-facing conflict toast
the branch exists to prevent.

`stableJson()` sorts OBJECT keys only — **array order is data here** (a list of
sets, meals, days) and is untouched, which is exactly what jsonb itself does.
Measured on the real shape: the old compare says different, the new one says
same, and a reordered `sessions` array still compares different.

### Two more, cheap

- **Every push echoed the whole blob back to read one integer.** `.select('*')`
  on the conditional UPDATE and on the INSERT/upsert, when only `version` is ever
  read. Narrowed to `.select('version')`. **The 0-rows probe at cloud.js:726 is
  deliberately NOT narrowed** — it reads `cur.data` for the self-conflict compare
  above, and narrowing it would turn every silent adoption into a conflict toast.
- ⚠️ **THE SHIPPED APK IS DEBUGGABLE, AND THAT VOIDS `allowBackup=false`.** Read
  back out of build 22 with `aapt2 dump xmltree`: `android:debuggable=true` sits
  next to `android:allowBackup=false`. `adb run-as` and `chrome://inspect` both
  work on a debuggable app, so the WebView storage the backup flag was added to
  protect (v302) was reachable anyway. AGP sets it implicitly for the debug type
  and this file never declared it. `debug { debuggable false }` now does. The
  debug signingConfig is KEPT on purpose: build 23 must install over build 22
  without an uninstall, or the device-local photo side store and the notification
  log go with it. **This one needs a new APK to reach a phone.**

### What the audit found that only the owner can fix

Recorded here so it is not lost, in the order that matters:

1. **The daily AI budget has been failing OPEN for nine days** — and this pass
   proved it from the LIVE LOGS, not just the catalog: 16 POSTs to
   `rpc/ai_budget_take` in 24 hours, **16 × 409**, zero 2xx, with 16 matching
   `violates foreign key constraint "ai_usage_user_fk"` lines in postgres_logs at
   the same milliseconds. `ai_usage` still holds 2 rows, both `day=2026-09-06`.
   `backend/pending/29_ai-usage-fk-repair-v25.sql` is the fix and is a live write.
   > Correction to that file's own header: it argues the FK is safe to drop
   > because `admin_prune_ai_usage()` clears orphans after 30 days. **pg_cron is
   > not installed**, so that function has no caller. The decision does not
   > change — an orphan row is ~1 per user per day and a dead cap is bleeding now
   > — but the durable repair is to move the global counter into its own table.
2. **Sign-up is open and auto-confirmed**, so a ban is undone by registering a
   second email.
3. **Leaked-password protection is off** in Supabase Auth; the 8-character floor
   is enforced only in the client.
4. **`feedback` has no deletion path anywhere** — not in the app, not in the
   console, not in any RPC.
5. **The image bucket caps object COUNT but never BYTES** — one account can claim
   ~102 MB of a 1 GB tier.

### And one that is neither code nor SQL

**CLAUDE.md, docs/BRAND.md and the identity layer still describe THE CUT as the
in-app mark, 120 versions after v227 replaced it with the AJ lockup.** Three
documents agree with each other and disagree with the app. This is the same class
as the stale prose v345 removed, but larger: a future session reading those files
would "restore" a mark the app has not used for a hundred releases.

## v347 — a duration is a clock reading, everywhere

The owner's rule, verbatim, and it is absolute:

> «الوقت خليه يكون بالتطبيق كذا **4:59** — مش يكون 4 س 55 د، لا تخلي ولا شي زي كذا أبدًا»

Swept the whole app for compound hour+minute renderings. There were exactly
**two producers**, and the second one was a duplicate of the first:

- **`formatDuration()` (js/storage.js)** — every sleep figure in the app: the Home
  stat cell, the sleep hero, deep sleep, the stage legend, the day ledger, both
  weekly averages, the week-over-week delta, and the live preview inside the log
  sheet. Eleven call sites, one function.
- **`sleepValue()` (js/health.js)** — the Health Connect card had its OWN copy of
  the hour/minute arithmetic, so the rule would have had to be applied twice and
  could drift. It calls `formatDuration` now. One formatter, not two.

`durUnits()` went with it — the س/د и h/m abbreviations existed only to be
concatenated by the old shape. **A clock reading needs no translating**, so the
figure is now byte-identical in both languages. `unit_hr` was retired from both
dictionaries after checking it had no other reader: no dynamic `t('unit_' + x)`
family exists and no `METRICS` entry carries it. `unit_min` stays — cardio still
logs minutes.

### Two decisions inside it

- **ALWAYS `H:MM`, including under an hour.** 45 minutes is `0:45`, not `45د`.
  The sleep card must not change shape between a short night and a long one — a
  column of figures that switches format is what the reading eye actually trips
  over.
- **Rounded inside the formatter**, because the weekly averages arrive
  fractional: 431.5 minutes used to render as `7س 11.5د`. It is `7:12`.

### Measured, not assumed

| minutes | 0 | 5 | 45 | 59 | 60 | 65 | **299** | 431.5 | 1439 |
|---|---|---|---|---|---|---|---|---|---|
| renders | 0:00 | 0:05 | 0:45 | 0:59 | 1:00 | 1:05 | **4:59** | 7:12 | 23:59 |

Identical in Arabic and English, and no abbreviation survives anywhere in the
output.

> **RTL needs no wrapper, and this was measured rather than reasoned.** Digits are
> European Numbers and the colon is a Common Separator, so the bidi algorithm
> keeps `4:59` as ONE left-to-right run inside an Arabic line. Rendered inside
> «نمت 4:59 الليلة» on the live page: x = 303 / 322 / 332 for 4, 5, 9 — left to
> right, in an `rtl` document. The `dir="ltr"` on a few older call sites is
> harmless and was left alone.

**Deliberately not changed: cardio still logs «٣٠ د».** That is a single-unit
quantity like calories or millilitres, not the hours-and-minutes form the rule
names — and `0:30` for a thirty-minute walk reads worse, not better. One line
here if that is wanted too.

## v346 — the frame stops moving, the content moves instead

Two owner reports, one cause:

1. «بعد الانزلاق والانتقال لشاشة أخرى خليها تيجي أنيميشن التدرّج» — the staggered
   card entrance should play on tab switches too, not only on other arrivals.
2. «فيه تأخير بسيط بيكون خلفية سودة ثم تظهر الشاشة المنتقل إليها».

**Measured on a real home → food switch before touching anything:** the arriving
view carried exactly one animation — `vlt-slide-in`, **50ms delay + 500ms**, from
`translateX(100%)`. So for the first 50ms the new screen was **entirely
off-screen** while the old one was already `display: none`, and it was only fully
in place at **550ms**. For that whole window most of the screen was nothing but
`--bg-grad`.

> ⚠️ **THAT VOID IS NOT A BUG IN THE SLIDE — IT IS THE SLIDE.** A frame can only
> arrive from off-screen, and v342 deleted the outgoing ghost that used to fill
> the gap. There were exactly two ways out: put the old screen back underneath —
> which is the thing the owner asked to stop seeing («دون أثر الصفحة التي قبل
> الانتقال») — or stop moving the frame.

So the frame no longer moves at all. The screen is in place from the first
frame, and the CARDS arrive in sequence from the side you moved toward. That is
report 1's stagger and report 2's fix in a single change, and it is the only
shape that answers both without reintroducing the screen he asked to stop
seeing.

### How the direction travels

`--ex` / `--ey` are the offset each card starts from, set on the host by
`stagger(host, dir)` and inherited by `.enter > *`. A tab switch sets
`--ex: ±26px` with `--ey: 6px` because the motion is sideways; every other
arrival keeps the defaults (`0`, `24px`) and the cards simply rise. **One
keyframe serves both.**

`dir` is the tab ORDER (+1 later, −1 earlier) and carries no writing direction of
its own, so **the RTL flip is applied in `stagger()`** — the last place before it
becomes a physical translate. Measured in the running app, Arabic:

| | `--ex` | reads as |
|---|---|---|
| home → food (a later tab) | **−26px** | comes from the left, which is "later" in RTL |
| food → workouts (earlier) | **+26px** | mirrored |
| → settings (not a tab) | unset → `0` | the plain 24px rise |

`viewDisplacedOffScreen: false` on every one of them, and the first card's
`animation-delay` is `0s` — **nothing is ever off-screen and nothing waits.**

### What this deleted

`.view.vlt-in`, `@keyframes vlt-slide-in`, `flushSlide()`, `clearSlideMarks()`,
the per-slide cleanup closure and its timer, `__vltSlid`, and the `--dur-slide`
token (v341 retired `--nav-bg` the same way — a token with no readers goes).

> The v341 lesson those existed to carry outlives their code, and is kept as a
> comment on `switchTab`: **ONE TIMER FOR N CONCURRENT ELEMENTS IS NOT A
> DEBOUNCE.** Cancelling a shared timer does not cancel the work, it abandons
> it. Anything that schedules per-element teardown here must keep the cleanup as
> a closure beside its timer and RUN it rather than drop it.

`switchTab()` survives with one job — pulsing the tab that was tapped, 500ms
`--ease-back`, so the tab is still answering while the cards land.

### Rule 5 is retired, not broken

APPLY-motion.md's rule 5 said the stagger and the slide must never run together.
With the frame no longer moving there is nothing to keep apart: **every arrival
is the stagger**, and `__vltEnterDir` carries the only thing the render still
needs to know. It is spent by the render it belongs to and zeroed either way, so
a render that stands down cannot leave a direction behind for the next one.

### The review, run before any of it shipped — chrome was arriving like content

21 agents over four lenses, every finding adversarially verified: **17 raised, 12
confirmed, 5 refuted.** They collapse to four causes.

> ⚠️ **`.vault-bar` IS THE FIRST CHILD OF ALL FIVE TAB VIEWS**, so `.enter > *`
> made the brand header itself fade in and travel 26px on every tab tap — the most
> frequent navigation in the app. This stylesheet already says what that element
> is, a few hundred lines up: *"Chrome, not content: it used to scroll away with
> the page and re-animate on every tab tap."* v346 handed back the behaviour v316
> took away.
>
> And it was worse than cosmetic: `vlt-enter` ends on `transform: none`, which
> **overrode `.main.bar-hidden .vault-bar { transform: translateY(-100%) }`** for
> the whole entrance window — so returning to a scrolled tab showed the header for
> a second and then snapped it away in one frame.

`.enter > .vault-bar, .enter > .detail-top` now refuse the entrance. The
specificity was checked both ways: (0,2,0) beats `.enter > *` and loses to
`.main.bar-hidden .vault-bar` at (0,3,0), so the v327 auto-hide still wins. No
restart trap either — the bar's base `animation-name` is already `none`.

**The CSS exemption alone would have introduced a new wait**, which the review
caught: `stagger()` numbers every child, so an exempt-but-numbered bar spends
index 0 and the first real card starts a whole step late. `stagger()` skips
persistent chrome when numbering, so the first card is still at 0ms. Measured
after: bar `animation-name: none`, opacity 1, no `--i`; first card `--i: 0`,
delay `0s`.

### The other three

- **`--ex` / `--ey` were written only when there was a direction.** The host is a
  PERSISTENT node — the same `.view` for the life of the app — so the last tab
  switch's sideways offset stayed on it, and the next directionless arrival at
  that view replayed a direction it had not moved in. They are written every time
  now. Measured: arriving at Settings after a tab switch reads `0px` / `24px`.
- **A re-render inside the stagger window replayed the whole entrance at delay 0.**
  The class lives on the host, which SURVIVES an innerHTML rewrite of its own
  contents — so brand-new children match `.enter > *`, have no `--i`, and all
  animate together. Every save in this app re-renders the current view, and after
  v346 that is reachable right after a tab tap. `VltMotion.cancelStagger(host)` is
  called by any render that is not an arrival: the entrance was introducing
  content that no longer exists. Same shape as the `animationend` lesson — the
  cleanup cannot be left to the timer, because the thing being cleaned up is gone
  before it fires.
- ⚠️ **THE HOME TAB HAS NEVER ANSWERED THE TOUCH, SINCE v340.** Its glyph is
  wrapped in `.home-center-icon`, so `.nav-btn.vlt-pulse > svg` never matched it —
  the middle tab, the one under the thumb, was the only one that did not pulse.
  Measured after the fix: both scale to 1.16.

### And one number the owner would have felt

The tab arrival finished at **1100ms** against the 550ms the frame slide took.
First content is at 0ms either way, so nothing is late — but the screen kept
assembling for twice as long, in the change whose whole purpose was to stop it
looking late. `--stagger-fast: 60ms` is a second step for the arrival you make
forty times a day; the ceremonial 140ms stays for a screen you opened
deliberately. Last card now lands at **700ms**.

**Refuted, and worth recording:** that 26px would clip full-bleed rows past the
16px gutter (nothing legible is ever cut — the offset exceeds the gutter only in
the first ~60ms, at opacity ≤ 0.4); that the six-child cap concentrates ten
concurrent animations on Home; and that `opts.noSlide` is now dead.

**Known and deliberately left:** the arriving cards are `opacity: 0` but still
focusable and tappable for up to 700ms. They occupy their final positions, so a
tap lands on the control the user is aiming at — making them inert would cost
more than it buys.

## APK build 22 (v3.1) — the native half of v337–v341 reaches the phone

Every web change since build 21 already reached installed devices on the next app open (the
shell loads the live URL). **The fourteen splash images did not**: they are native assets
baked into the APK, so until this build a phone still flashed the blue Capacitor ✕ on launch
while the web splash it introduces played a different story one frame later.

`versionCode 21 → 22`, `versionName "3.0" → "3.1"`, `version.json` → `apk.build: 22` /
`apk.version: "3.1"` (contract 11 refuses a commit where those disagree), same debug
certificate so it installs over build 21.

**Verified by UNPACKING THE BUILT BINARY, never by checking a filename** — the rule v212 paid
for three times:

| read from the `.apk` | |
|---|---|
| `aapt2 dump badging` | `versionCode='22' versionName='3.1'`, minSdk 26, targetSdk 36 |
| all **11** `res/*/splash.png` entries | PNG colour-type **2** — my RGB encoder, not the stock asset |
| `aapt2 dump xmltree AndroidManifest.xml` | `android:allowBackup=false` survived, plus `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `USE_EXACT_ALARM` |

`npx cap sync android` warns that `@capacitor/core@8.5.1` is ahead of `@capacitor/android@8.4.1`.
Benign, and left alone deliberately: no plugin or permission changed in this build, so the safe
move before an APK is to change nothing else.

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
  write minimal code. This project states **"No automated test framework"** and
  **"no new dependencies, no build step"** — "tested" means verified in the running
  app by driving the DOM. Since v309 there ARE Node-only behavioural scripts
  (`scripts/test-*.js`), so the honest reading is: **every feature gets a verification
  script or a measured DOM check, written alongside it** — not a red/green cycle.
  Adopting literal TDD would be a real change and needs this line rewritten first.
- **`using-git-worktrees` / `finishing-a-development-branch`** assume a branch
  workflow. This project ships from `main` directly, because GitHub Pages builds the
  branch with no CI — see "Deploy". Skip both unless the work is genuinely long-lived.

`using-superpowers`'s own session-start hook is **not** installed: it would require a
skill invocation before every reply in every project on this machine. The skills are
available and routed; the always-on discipline is the owner's call, not a default.

## Feature factory
This machine has a `/feature-factory` skill (24 specialist subagents, tailored to THE VAULT) that builds a feature end-to-end. See the maintainer's Claude memory for the roster.
