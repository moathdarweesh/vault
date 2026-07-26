# THE VAULT — Claude Code Project Guide

A fitness / workout-tracking **PWA**. Vanilla JS, **no build step**, bilingual **EN/AR** (RTL), dark-themed, mobile-first. Deployed to GitHub Pages and wrapped as an Android app via Capacitor.

- **Live:** https://moathdarweesh.github.io/vault/ (GitHub Pages, branch `main`)
- **Repo:** github.com/moathdarweesh/vault
- **`AUTOMATION.md`** — the maintainer's own Arabic quick-reference for everything that runs automatically (the three `.githooks/` scripts, `npm run release`, the graph rebuild) and everything that does **not** (Worker redeploy, SQL, APK). Keep it in sync when you change any of that.

## Stack & key files
- `index.html` — markup, script wiring, and the cache-version markers.
- `js/app.js` (~190KB) — ALL views/rendering, the router `navigate(view, ctx, opts)`, and the two EN/AR translation objects. Use `Grep` to find a function; don't assume from names.
- `js/storage.js` — the `DB.*` localStorage API (all persistence). `MACHINE_SEED`, name-match migrations.
- `js/cloud.js` — Supabase email/password auth + whole-blob sync to a per-user `vault_data` row (RLS-protected). Uses the **publishable** key only (never service-role). Loads before app.js. Also: `getUsername/checkUsername/setUsername` (the mandatory-handle feature) and `getClient` (for tables.js).
- `js/tables.js` — the **"mirror"**: additively projects the local blob into the normalized schema-v2 tables (best-effort, one-way, idempotent, RLS-scoped). Never affects local logging. Loads after storage.js. **⚠️ ADDITIVE-ONLY: it only upserts — it never DELETEs or writes `deleted_at`, so rows deleted locally live on in the tables. The mirror can therefore drift from the blob; it is analytics-only and NOT safe for the app to read back until delete/tombstone propagation + a reconcile pass are added** (flagged by the DB-department audit, 2026-07-11).
- `js/foodai.js` — AI calorie chat. Posts `{text}` to a **Cloudflare Worker** (`backend/gemini-worker.js`) that holds the Gemini key server-side. The key never ships to the client.
- `js/health.js` — Health Connect bridge (Capacitor, no-op on web).
- `js/update.js` — native-shell update checker. No-op on web (web is always latest via the live URL). On the APK it compares the installed `versionCode` (via `@capacitor/app` `App.getInfo().build`) against `version.json` → `apk.build`; if a newer APK exists, shows the dismissible "download" banner linking to Drive. Best-effort, never blocks the app.
- `version.json` (repo root) — the APK-shell update manifest read by `js/update.js`. Bump `apk.build`/`apk.url`/notes when you ship a NEW APK.
- `styles.css` (~100KB) — one stylesheet; reuse existing CSS variables and classes.
- `admin.html` — standalone owner-only **multi-center control console** (GitHub Pages, not in the APK). Owner logs in → `is_admin()` RLS unlocks reading every user. Sidebar centers: dashboard, users (search/sort + per-user drill-down + **role/status write controls**), analytics, catalog, feedback inbox, roles/admins, releases, export. Writes go only through the `is_admin()`-gated definer RPCs (`admin_set_role`/`admin_set_status`). Publishable key only — never a service_role key.

## How to run & verify
- **Run:** `node dev-server.js` → http://localhost:8080 (serves `Cache-Control: no-store`). Honors `$PORT`. Also `.claude/launch.json` server name `vault` for the preview tool.
- **No automated test framework.** "Tested" = verified in the real running app by driving the DOM with `preview_eval`. **Screenshots time out on this app — do not rely on them.**

## Non-negotiable rules
- **Every user-facing string** goes through `t('key')` and has BOTH an EN and an AR entry in `app.js`. A missing language is a bug.
- **Read/write data only through `DB.*`** — never touch `localStorage` directly from view code.
- **Escape untrusted data** rendered into `innerHTML` with `escapeHtml()` — exercise/food names, and anything from cloud sync / imported backups / AI responses are untrusted.
- No new dependencies, no build step. Free-first (the maintainer prioritizes free tools/services).

## CACHE WORKFLOW — now automated. **Do not bump by hand.**

```bash
npm run release          # bump every marker + verify, then commit all files together
```

**Current version: v208.** APK: build 8 / v1.7.

`scripts/release.js` rewrites all **13** markers and then re-reads them from disk to confirm; it exits non-zero if any disagree. The markers are `?v=N` in `index.html` (×11, including the `js/vendor/supabase.js` preload), the `__cleaned_vN` sessionStorage keys, the `FALLBACK` literal in `app.js`, and `version.json` → `web`.

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

### Reminders (v208) — the first native change since v109
Supplement and water reminders. **This is why APK build 8 exists**: a Capacitor
plugin is a native change, so unlike every release since v109 it does NOT reach
installed users from a `git push` — they must install the new APK.

- `DB.reminders.schedule()` in `js/storage.js` is the **single source of truth**:
  it turns settings into a concrete list of daily alarms. Both delivery paths read
  it, so they can never disagree about what was due. Times are local `"HH:MM"`
  strings, never timestamps — a reminder means "08:00 wherever you are", which is
  what survives a timezone change and DST.
- `js/notify.js` has two paths. **Native**: `@capacitor/local-notifications`,
  real alarms with the app closed, scheduled with `{ on: { hour, minute } }` so
  they repeat daily at wall-clock time. **In-app**: everywhere else (web, and any
  shell older than build 8) it catches up on open — anything due earlier today and
  not logged is surfaced once as a toast, deduped per day in `vault_reminder_seen`.
  The in-app path is not a downgrade; it answers "what did I miss?" and stays
  useful on the APK.
- `sync()` cancels everything and re-schedules, rather than diffing — that is how
  you avoid an orphan alarm for a deleted supplement. Call it after ANY change to
  times or settings.
- Manifest needs all three: `POST_NOTIFICATIONS` (targetSdk 36),
  **`RECEIVE_BOOT_COMPLETED`** (Android drops every alarm on reboot; without this
  reminders silently stop until the app is next opened) and `SCHEDULE_EXACT_ALARM`
  (falls back to inexact when not granted, which is fine for a reminder).
- Water slots are generated from a from/to window and a step, **capped at 24** —
  Android silently drops a runaway schedule rather than erroring.
- `DB.supplements.update()` is a **field whitelist**; it silently drops anything it
  doesn't name. Reminder times saved on create and vanished on edit until `times`
  was added to it. Check that list when adding a field.

### Icon set — "VAULT Machined" (v202)
`ICONS` in `js/app.js` is a **53-key** hand-drawn set on a strict grid: every
endpoint on an even coordinate, angles 0/45/90 only, radii from {1,2,3,4,6,8,10},
outer `rx=2`, **max 5 sub-paths**, flat caps + mitre joins.
- `icon(name, size)` keeps its per-size stroke-width bands (16→2.25, 18–20→2,
  22+→1.75) — that is deliberate optical correction, do not "simplify" it.
- `ICON_CAPS` is a per-icon cap override; **keep it minimal** (currently
  `heartPulse` alone). Every entry weakens the set's unity.
- **7 glyphs are duplicated outside `ICONS`** and must be kept byte-identical:
  five in `index.html`'s bottom-nav (`calendar`, `heartPulse`, `home`, `utensils`,
  `moon`) and two in `js/update.js` (`refresh`, `arrowUp`).
- A wrong key name returns `''` and the icon vanishes **silently, with no error** —
  this actually shipped (`icon('send')` with no `send` key left the Settings
  feedback row blank). Audit call sites when renaming anything.
- **Known, deliberately unfixed:** the nav icons render at 22px (26 for home) but
  hard-code `stroke-width="2"`/`2.4`, where the band for that size is 1.75 — so
  they sit ~14% heavier than the same glyph elsewhere.

### Type scale & RTL invariants (v200–v201)
- **Nothing renders below 11px.** 24 declarations were at 9–10px; all raised.
  Fractional sizes are gone. 12/13/14/15 are NOT unified — they carry 157
  declarations in distinct roles across 18 views.
- `.page-title` is **26px**, not 32: at 32 it tied exactly with `.stat-cell-value`,
  so a heading read once competed with the numbers that are the content.
- **One section-header system per screen.** `.rot-section-title` (+ optional
  `.rot-section-head` for a trailing action, `.rot-section-sub` for context) is the
  Program tab's; `.section-title` draws a `::after` rule and must not be mixed in
  beside it.
- **`text-align: start`, never `left`,** unless a `body[dir="rtl"]` override exists
  for that exact selector. Three rules shipped Arabic left-aligned inside RTL rows.
- A `<button>` with no `color` inherits the UA `buttontext` default — `.settings-action-row`
  measured **2.23:1** that way. Always set `color` on a styled button.

### Auto-update delivery (since v113) — how updates actually reach devices
The `?v=N` busting alone does NOT reach phones, because the **entry `index.html` itself** is HTTP-cached by GitHub Pages (`Cache-Control: max-age=600`) and the SPA/APK-WebView never re-fetches it while open. `js/update.js` fixes this: on boot it fetches `version.json` fresh (`no-store`), compares `web` to the page's own `?v=N` (parsed from the script src), and if newer **reloads the entry html with a `?u=<build>` cache-buster** → fresh index.html + fresh `?v=N` scripts. Runs on web AND inside the APK WebView. Four guards make a reload loop impossible (unknown-build no-op, `<=` no-op, url-already-`?u=`-targeted no-op, once-per-session `sessionStorage` guard). On resume it re-pulls admin content + shows a tap-to-update banner. **Bootstrap caveat:** a device only gains the auto-updater once it is already ON a build that has it (≥v113) — the first arrival of ≥v113 still relies on the 10-min HTTP cache expiring (or a manual hard-refresh / clear-cache). Every update after that is automatic within seconds of app open.
- **Admin announcement** (`app_config.announcement_*`): shown by `showAnnouncementBanner`. Dismissal is keyed on the config's `updated_at`, so **editing or re-saving the announcement in the admin panel re-broadcasts it to everyone**, even users who dismissed the previous one. `pullCatalog` selects `updated_at`; `init()` re-runs `bootCatalog` on foreground so a freshly-activated announcement appears without a restart.

## Deploy
- **Web:** commit + push to `main`; GitHub Pages auto-rebuilds.
- **Cloudflare Worker:** changes to `backend/gemini-worker.js` require a **manual redeploy** (Cloudflare → Edit code → paste → Deploy). CORS is locked to an origin allowlist — if the AI breaks on the Android app, add the Capacitor origin to `ALLOWED_ORIGINS`.
- **Supabase:** schema/RLS changes in `backend/supabase-setup.sql` must be run in the Supabase SQL editor.
- **Android APK:** `npm run build:www && npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` → `android/app/build/outputs/apk/debug/app-debug.apk`. Copied to Google Drive (`G:\ملفاتي`). Portable JDK/SDK live under `C:\Users\moath\at` (`JAVA_HOME=…\jdk\jdk-21.0.11+10`, `ANDROID_HOME=…\sdk`).

## Distribution model — Live URL + native-update banner (since v109)
`capacitor.config.json` sets `server.url = https://moathdarweesh.github.io/vault/`, so the **APK is a thin shell that loads the LIVE site**. Consequences:
- **Ordinary updates (JS/CSS/HTML) reach everyone automatically** on next app open, with NO reinstall — a `git push` updates web AND app users at once. The bundled `www/` is only a build artifact; it is ignored at runtime.
- The APK's WebView origin is now `https://moathdarweesh.github.io` (same as web) — the Worker CORS allowlist already includes it. **Needs internet at launch** (acceptable: the app is cloud/AI-dependent anyway).
- A **NEW APK is only needed for NATIVE changes** (new Capacitor plugin/permission, `capacitor.config`, native code). To ship one: bump `versionCode` in `android/app/build.gradle`, build, copy to Drive, then set `version.json` → `apk.build` to the new versionCode + `apk.url` to the Drive share link + notes, and push. Installed apps then show the in-app "download update" banner (`js/update.js`).
- Migration note: users upgrading from a pre-v109 (bundled) APK land on the new github.io origin, so localStorage/auth reset once → they log in again and cloud sync restores their data. New users are unaffected.

## Backend v2 — normalized DB, mirror, admin (APPLIED to live Supabase)
The app is going multi-user. Alongside the legacy `vault_data` blob (still the local-first source of truth), a **normalized schema** is live in Supabase (project ref `ilmusnuchqlpirywonzx`). SQL artifacts in `backend/`:
- `schema-v2.sql` — 16 core tables + full RLS + indexes (APPLIED). `seed-v2.sql` — global exercise/cardio catalog (APPLIED). `migrate-blob-to-v2.sql` — one-time blob→tables backfill, SECTION UP applied. `admin-v2.sql` — `profiles.username` (unique), `admins` registry + `is_admin()` + additive admin-READ policies on all tables + `username_available()` RPC (APPLIED).
- **Mirror** (`js/tables.js`): ongoing blob→tables projection on login/change.
- **Usernames**: mandatory unique `@handle` enforced by a blocking gate (app.js `ensureUsername`/`showUsernameGate`), set via the profiles table.
- **Admin**: the owner's user_id is in `admins`; `is_admin()` unlocks all-user reads via RLS (never a service_role key in any client). Powers `admin.html`.
- **Admin WRITE + user management** (`admin-write-v3.sql`, v110): `profiles.last_seen` (self-written activity stamp); `user_flags` (role user/coach/admin + status active/disabled/banned) — **admin-write-only via definer RPCs, no client write policy** so a user can read their own row but never escalate; `feedback` inbox (user inserts own, admin reads/resolves). Writes only through `admin_set_role`/`admin_set_status` (SECURITY DEFINER, re-check `is_admin()`, refuse self-target AND the founder owner id). App side (`js/cloud.js` `touchLastSeen`/`getMyFlags`/`submitFeedback`; `js/app.js` `enforceAccountStatus` + `showBlockedGate` + feedback form). **Ban is client-enforced (soft) — fails OPEN**; a hard RLS/auth-level ban is Roadmap. Security-audited (no isolation break, no escalation; feedback fields escaped in the inbox).
- **Applying SQL:** run in the Supabase SQL editor. The "destructive operations" dialog is benign ONLY when the script's drops are `drop policy/trigger if exists` guards; a real DROP/DELETE/TRUNCATE needs explicit human confirmation. See the maintainer's memory (`vault-db-v2`).
- **Content/presets/audit/config** (`admin-write-v4.sql`, v111, applied+verified): `audit_log` (append-only, admin-read) + `audit()` logger; `app_config` (public read); `food_catalog` + `preset_plans` (global, public read); is_admin-gated definer CRUD RPCs for global exercises/cardio/foods/presets/config. App consumes them additively via `Cloud.pullCatalog()`/`bootCatalog()` (`js/app.js`) + `DB.exercises.mergeGlobal()`.
- **DB-department audit (2026-07-11)** — full read-only review by db-architect + normalization-auditor + db-security-auditor + db-index-optimizer. Verdict: **professional (A-/B+); no Critical; no client-reachable isolation break; every table BCNF or justified; indexes ahead of the workload.** Fixes surfaced: `backend/hardening-v5.sql` (additive — `feedback_user_idx` + `vault_data` grant double-lock; **ready to apply, not yet applied**); `backend/DROP-migration_v2.CONFIRMATION-REQUIRED.sql` (**destructive** — the leftover `migration_v2` staging schema holds unminimized cross-user PII; NOT reachable but a data-min gap; human runs out-of-band after a backup). Roadmap/optional: consolidate `admins`↔`user_flags.role`; decompose `health_prefs.hidden text[]`→`health_hidden` before analytics; `loadAll()` → aggregate RPC as users grow; hard RLS ban.
- **Custom exercise images — durable backup** (`backend/storage-images-v6.sql`, **APPLIED + VERIFIED live 2026-07-17**; v120–v123): user-uploaded images (`customImage`) used to live ONLY as base64 inside the `vault_data` blob. The blob is a single mutable row with no history, so when an empty local state once overwrote it every image was destroyed — and the mirror never carried them, so a mirror restore brought back the exercise but not its picture (**this actually happened to the owner; the images were unrecoverable**). Now: the base64 STAYS in the blob (instant render + works offline in the gym — do not "optimise" this away), and a durable copy is ALSO uploaded to the **private** `exercise-images` bucket at `{auth.uid()}/{exercise_id}.jpg` (owner-only RLS on `storage.objects`, 5 MB cap, image mime allowlist — **keep `image/svg+xml` OUT of that allowlist permanently: it is what rejects an active-content SVG from a poisoned imported backup**). The pointer goes in the **existing** `user_exercise_prefs.custom_image_path` (schema-v2's designated field for exactly this bucket) — so the migration alters no table. `tables.js` writes it in a **separate upsert batch** from the `in_my_list` rows: an upsert writes every column in its payload, so a blob row with no path must never send `custom_image_path: null` and blank a pointer already on the server — that blind overwrite is the same bug class that destroyed the images. Client: `Cloud.backupExerciseImage/restoreExerciseImage/removeExerciseImage` (cloud.js), `backupExerciseImageFor()` on save + `syncExerciseImages()` after login/bootSync (app.js) which backfills any un-backed-up image AND heals an exercise whose base64 was lost but whose backup survived. **All best-effort** — every failure path leaves the local base64 untouched, so backing up can never lose an image, and the app works unchanged if the bucket is missing.
- Still pending: app doesn't READ from the new normalized tables yet (mirror is one-way + additive-only — see the tables.js note); social features deferred.

## Hardening pass (v189–v190) — invariants added by the 2026-07-25 codebase review

Full findings + verification in `CODEBASE_REVIEW.md`. The load-bearing rules:

- **`saveLocal()` vs `save()` (`js/storage.js`).** `save()` flags the blob dirty for cloud sync; `saveLocal()` does not. **Housekeeping writes must use `saveLocal()`** — the Health Connect cache, the global-catalog merge, the onboarding flag. They run *before* `bootSync`'s pull resolves, and flagging them dirty manufactured a false `'conflict'` whose "Keep this device" branch force-pushes over a **newer** cloud blob (skipping both the empty-blob guard and the version compare). If you add a write that the device re-derives for itself, it belongs in `saveLocal()`.
- **READ-ONLY mode.** If the stored blob fails to parse, `loadState()` no longer overwrites it with `defaultState()`. It quarantines a copy at `gym_tracker_v1__corrupt`, sets `STATE_LOAD_FAILED`, and `writeStore()` refuses every write until a *deliberate* replacement (cloud pull / restore / reset) clears it via `reloadState()`. Never "fix" this by writing defaults.
- **`push()` returns `'ok'` on success** — and only on success. `'nosession'`, `'blocked'`, `'conflict'`, or a throw all mean the data did **not** upload. Any caller gating a destructive action (logout clearing the device) must test `=== 'ok'`, never "not an error string".
- **`applyRemote()` propagates `importRaw()`'s failure.** A failed pull must not advance the sync stamp or clear the dirty flag.
- **Mirror reconcile is gated on `blobLooksReal`** (`js/tables.js`). An empty id list makes the delete unbounded, so it only runs when the blob demonstrably holds user data.
- **Dates: always `todayISO()` / `addDaysISO()`, never `toISOString()`** for calendar days. `toISOString()` returns the previous day for every UTC+ user — this bug class has now appeared three times.
- **Error visibility.** `Cloud.reportError()` + `window.onerror`/`unhandledrejection` write to `client_errors` (`backend/client-errors-v9.sql`): signed-in users only, no user content, per-session dedupe, DB-side rate cap of 20/hour, 30-day retention via `admin_prune_client_errors()`. The reporter must never throw and never block.
- **Accessibility invariants.** All 13 themes pass WCAG AA on `--text-dim`; `--text-ghost` (new) is for input placeholders — `--text-faint` stays for decorative dots/bars, so do not "unify" them. Pinch-zoom is enabled, which means **inputs must stay ≥16px** or iOS focus-zoom returns.
- **Worker auth** (`backend/gemini-worker.js`) fails **closed** on any 4xx and open only on 5xx/network error, plus a per-caller rate limit. Requires a manual Cloudflare redeploy.
- **Pending SQL (written, not yet applied):** `backend/client-errors-v9.sql`, `backend/hardening-v8.sql` (revoke PUBLIC execute + pin `search_path`), `backend/ban-rls-v10.sql` (extend the ban to the mirror tables, storage and profiles). Also still pending from the earlier audit: `backend/hardening-v5.sql`.

## Feature factory
This machine has a `/feature-factory` skill (24 specialist subagents, tailored to THE VAULT) that builds a feature end-to-end. See the maintainer's Claude memory for the roster.
