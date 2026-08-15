# THE VAULT — Claude Code Project Guide

A fitness / workout-tracking **PWA**. Vanilla JS, **no build step**, bilingual **EN/AR** (RTL), two modes (dark + light), mobile-first. Deployed to GitHub Pages and wrapped as an Android app via Capacitor.

- **Live:** https://moathdarweesh.github.io/vault/ (GitHub Pages, branch `main`)
- **Repo:** github.com/moathdarweesh/vault
- **`docs/AUTOMATION.md`** — the maintainer's own Arabic quick-reference for everything that runs automatically (the three `.githooks/` scripts, `npm run release`, the graph rebuild) and everything that does **not** (Worker redeploy, SQL, APK). Keep it in sync when you change any of that.

## Stack & key files
- `index.html` — markup, script wiring, and the cache-version markers.
- `js/app.js` (~190KB) — ALL views/rendering, the router `navigate(view, ctx, opts)`, and the two EN/AR translation objects. Use `Grep` to find a function; don't assume from names.
- `js/storage.js` — the `DB.*` localStorage API (all persistence). `MACHINE_SEED`, name-match migrations.
- `js/cloud.js` — Supabase email/password auth + whole-blob sync to a per-user `vault_data` row (RLS-protected). Uses the **publishable** key only (never service-role). Loads before app.js. Also: `getUsername/checkUsername/setUsername` (the mandatory-handle feature) and `getClient` (for tables.js).
- `js/tables.js` — the **"mirror"**: additively projects the local blob into the normalized schema-v2 tables (best-effort, one-way, idempotent, RLS-scoped). Never affects local logging. Loads after storage.js. It RECONCILES as well as upserts (v259): after projecting, it deletes the user's own rows that the blob no longer has, for `workout_sessions` (sets cascade), `cardio_logs`, `food_logs`, `sleep_logs`, `supplements` (logs cascade), `foods`, `plan_days` (its exercises cascade) and `cardio_types`.
  - **`exercises` is deliberately NOT reconciled.** Deleting a row there cascades into `user_exercise_prefs`, which carries `custom_image_path` — the durable pointer to user-uploaded exercise photos, the field whose absence once made those images unrecoverable. A few ghost rows in an analytics-only mirror is the cheaper side of that trade.
  - **Two id lists are DERIVED FROM THE NETWORK and their deletes are gated on the lookup having succeeded** (`catalogOk`, `cardioTypesOk`). Until v259 both catalog SELECTs discarded `error`, so a transient 5xx was indistinguishable from an empty catalog: every seed exercise unresolved, `sessions` came out empty, `blobLooksReal` stayed true on the user's food/sleep rows, the empty id list made the `.not('id','in',...)` filter vanish, and the delete degraded to **wiping that user's entire mirrored workout history**. Same chain for `cardio_types` -> `cardio_logs`. Verified by driving `projectAll` with a recording mock client.
  - Still one-way and analytics-only: the app does not read these tables back.
- `js/foodai.js` — AI calorie chat. Posts `{text}` to a **Cloudflare Worker** (`backend/worker/gemini-worker.js`) that holds the Gemini key server-side. The key never ships to the client.
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
npm run release          # bump every marker + verify, then commit all files together
```

**Current version: v269.** APK: build 18 / v2.7.

`scripts/release.js` rewrites all **16** markers and then re-reads them from disk to confirm; it exits non-zero if any disagree. The markers are `?v=N` in `index.html` (×14 — every script and stylesheet, the `js/vendor/supabase.js` preload, and **both `icons/icon.svg` links**), the `__cleaned_vN` sessionStorage key, the `FALLBACK` literal in `app.js`, and `version.json` → `web`. The count is derived, not hard-coded, so adding a marker is safe — just keep this sentence honest.

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
- **The IDENTITY LAYER at the end of `styles.css` is the authority** for the four
  devices that make the app recognisable — the machined edge (fill separates, a
  border MEANS interactive), the 2:1 corner law, no circles, and the five-bar
  field. It sits **last on purpose**: those rules have the same (0,1,0) specificity
  as the component rules they override, so only source order makes them win.
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

### The mark is THE CUT (v216) — there is no symbol
The Claude Design spec "Vault Logo CUT" replaced both earlier marks. A single
horizontal line shears the name: a **slot** in the surface colour with an
**accent hairline** inside it. Two layers, never one. `docs/BRAND.md` §1 is the law;
the short version:

- Slot **7%** of the type size, floor **2px**. Hairline **1.5px** minimum.
- **11%** for the V monogram — its two diagonals meet at a point and swallow 7%.
- **50%** on Latin, **52%** on Arabic (the dots carry the mass high).
- Tracking **.02em**. Wordmark floor **24px**. Below a **48px** tile the letter
  is dropped and the slot alone is the mark.
- Hairline is `#ff6a00` on dark, `#a34400` on light — `--accent-text`, not
  `--accent`, which is only 2.87:1 on the bone ground.

**Two ways to draw the slot; the surface picks.** Flat surface → paint it in
that surface's token (`.cut` does this via `--cut-bg`, and any context that
moves the mark onto a different surface MUST override it). Gradient or
translucent surface → mask the band away instead, because no single colour
matches it. `get/index.html` is the masked case.

**The Android themed icon needs its own file.** A monochrome layer is flattened
to alpha and tinted one colour, so the foreground's painted slot would come out
the same colour as the letter and the cut would vanish.
`ic_launcher_monochrome.xml` cuts the slot as a **hole** (`fillType="evenOdd"`),
using two quadrilaterals — one per diagonal — because a single rectangle across
both would count odd in the gap between them and fill in solid.

**The five bars are texture now, not a mark.** They survive as the pinstripe on
the app icon and as the section tick. They are no longer the in-app logo (the
top bar is the cut wordmark) and no longer the status-bar icon (that is the slot
mark). Do not reintroduce them as a logo.

### App icon vs LAUNCHER icon — two different files (v212)
`icons/icon.svg` is the PWA / browser-tab / apple-touch icon **only**. The
installed Android app takes its icon from `android/.../mipmap-*/ic_launcher*`,
a completely separate asset baked into the APK.

Nobody had ever replaced those, so **the app icon on every phone was the stock
Capacitor placeholder — a blue "X" on white** — for the app's whole life, while
`icon.svg` had carried the VAULT mark since v202. Updating one does not touch
the other; when the mark changes, BOTH have to move.

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
`ICONS` in `js/app.js` is a **55-key** FILLED set (+2 back-compat aliases) on the
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
- **Cloudflare Worker:** changes to `backend/worker/gemini-worker.js` require a **manual redeploy** (Cloudflare → Edit code → paste → Deploy). CORS is locked to an origin allowlist — if the AI breaks on the Android app, add the Capacitor origin to `ALLOWED_ORIGINS`.
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
- **Mirror** (`js/tables.js`): ongoing blob→tables projection on login/change.
- **Usernames**: mandatory unique `@handle` enforced by a blocking gate (app.js `ensureUsername`/`showUsernameGate`), set via the profiles table.
- **Admin**: the owner's user_id is in `admins`; `is_admin()` unlocks all-user reads via RLS (never a service_role key in any client). Powers `admin.html`.
- **Admin WRITE + user management** (`admin-write-v3.sql`, v110): `profiles.last_seen` (self-written activity stamp); `user_flags` (role user/coach/admin + status active/disabled/banned) — **admin-write-only via definer RPCs, no client write policy** so a user can read their own row but never escalate; `feedback` inbox (user inserts own, admin reads/resolves). Writes only through `admin_set_role`/`admin_set_status` (SECURITY DEFINER, re-check `is_admin()`, refuse self-target AND the founder owner id). App side (`js/cloud.js` `touchLastSeen`/`getMyFlags`/`submitFeedback`; `js/app.js` `enforceAccountStatus` + `showBlockedGate` + feedback form). **Ban is enforced in the DATABASE** as of `10_ban-rls.sql` + `12_ban-rls-v10.sql`: RESTRICTIVE policies AND-ed onto the owner policies cover the blob, feedback, the mirror tables, the `exercise-images` bucket and `profiles`. It no longer fails open. ⚠️ **`12` did not actually cover all of them, and said it did.** Its `mirror_tables` array was hand-written: it named 5 tables that never existed in this project and omitted 4 that do (`exercises`, `cardio_types`, `foods`, `user_prefs`), and the loop `continue`d past each missing name **with no notice**, so it created 11 policy pairs while every doc recorded 16. The VERIFY query only checked that `%_ban_%` policies existed — never that the count matched the table list, which is why an assertion on existence can hide a gap an assertion on COUNT would have caught. Closed by `15_ban-rls-completion-v11.sql` (which raises rather than skips, and asserts the count) — **applied + verified live 2026-08-13**, followed by `16` (erasure repair + search_path re-pins) and `17` (cross-tenant write guards), both applied and verified the same day. ⚠️ **16 nearly shipped a defect every catalog check passed**: it qualified `pg_catalog.coalesce(...)`, but COALESCE is SQL grammar with no `pg_proc` row, so it cannot be schema-qualified — the file would have applied clean, committed, passed every VERIFY, then thrown on the first admin call, and `admin.html` maps an RPC error to `[]` with no banner. Same trap for GREATEST/LEAST/NULLIF/CASE/CAST. **A migration that defines a function must END BY CALLING IT** — reading `pg_proc` proves it exists, only calling proves it runs. See `backend/README.md`: tables carrying a ban pair went 14 -> 18, and `client_errors` grants are now exactly `authenticated: SELECT, INSERT` with nothing for `anon`. Two independent audits found this separately; **not** an isolation break — RLS still scoped every one of those tables to `auth.uid()`. SELECT and DELETE are deliberately left alone so a blocked user can still export and erase their own data. The one hole left is the **Cloudflare Worker** — it is not Postgres, so RLS cannot reach it; a banned-but-authenticated account can still call the AI endpoint at the normal rate limit. Security-audited (no isolation break, no escalation; feedback fields escaped in the inbox).
- **Applying SQL:** run in the Supabase SQL editor. The "destructive operations" dialog is benign ONLY when the script's drops are `drop policy/trigger if exists` guards; a real DROP/DELETE/TRUNCATE needs explicit human confirmation. See the maintainer's memory (`vault-db-v2`).
- **Content/presets/audit/config** (`admin-write-v4.sql`, v111, applied+verified): `audit_log` (append-only, admin-read) + `audit()` logger; `app_config` (public read); `food_catalog` + `preset_plans` (global, public read); is_admin-gated definer CRUD RPCs for global exercises/cardio/foods/presets/config. App consumes them additively via `Cloud.pullCatalog()`/`bootCatalog()` (`js/app.js`) + `DB.exercises.mergeGlobal()`.
- **DB-department audit (2026-07-11)** — full read-only review by db-architect + normalization-auditor + db-security-auditor + db-index-optimizer. Verdict: **professional (A-/B+); no Critical; no client-reachable isolation break; every table BCNF or justified; indexes ahead of the workload.** Fixes surfaced: `backend/migrations/09_hardening-v5.sql` (additive — `feedback_user_idx` + `vault_data` grant double-lock; **APPLIED** in `e54cfed`, which read the resulting grants back); `backend/archive/DROP-migration_v2.CONFIRMATION-REQUIRED.sql` (**destructive** — the leftover `migration_v2` staging schema holds unminimized cross-user PII; NOT reachable but a data-min gap; human runs out-of-band after a backup). Roadmap/optional: consolidate `admins`↔`user_flags.role`; decompose `health_prefs.hidden text[]`→`health_hidden` before analytics; `loadAll()` → aggregate RPC as users grow; hard RLS ban.
- **Custom exercise images — durable backup** (`backend/migrations/08_storage-images-v6.sql`, **APPLIED + VERIFIED live 2026-07-17**; v120–v123): user-uploaded images (`customImage`) used to live ONLY as base64 inside the `vault_data` blob. The blob is a single mutable row with no history, so when an empty local state once overwrote it every image was destroyed — and the mirror never carried them, so a mirror restore brought back the exercise but not its picture (**this actually happened to the owner; the images were unrecoverable**). Now: the base64 STAYS in the blob (instant render + works offline in the gym — do not "optimise" this away), and a durable copy is ALSO uploaded to the **private** `exercise-images` bucket at `{auth.uid()}/{exercise_id}.jpg` (owner-only RLS on `storage.objects`, 5 MB cap, image mime allowlist — **keep `image/svg+xml` OUT of that allowlist permanently: it is what rejects an active-content SVG from a poisoned imported backup**). The pointer goes in the **existing** `user_exercise_prefs.custom_image_path` (schema-v2's designated field for exactly this bucket) — so the migration alters no table. `tables.js` writes it in a **separate upsert batch** from the `in_my_list` rows: an upsert writes every column in its payload, so a blob row with no path must never send `custom_image_path: null` and blank a pointer already on the server — that blind overwrite is the same bug class that destroyed the images. Client: `Cloud.backupExerciseImage/restoreExerciseImage/removeExerciseImage` (cloud.js), `backupExerciseImageFor()` on save + `syncExerciseImages()` after login/bootSync (app.js) which backfills any un-backed-up image AND heals an exercise whose base64 was lost but whose backup survived. **All best-effort** — every failure path leaves the local base64 untouched, so backing up can never lose an image, and the app works unchanged if the bucket is missing.
- Still pending: app doesn't READ from the new normalized tables yet (mirror is one-way + additive-only — see the tables.js note); social features deferred.

## Hardening pass (v189–v190) — invariants added by the 2026-07-25 codebase review

Full findings + verification in `docs/CODEBASE_REVIEW.md`. The load-bearing rules:

- **`saveLocal()` vs `save()` (`js/storage.js`).** `save()` flags the blob dirty for cloud sync; `saveLocal()` does not. **Housekeeping writes must use `saveLocal()`** — the Health Connect cache, the global-catalog merge, the onboarding flag. They run *before* `bootSync`'s pull resolves, and flagging them dirty manufactured a false `'conflict'` whose "Keep this device" branch force-pushes over a **newer** cloud blob (skipping both the empty-blob guard and the version compare). If you add a write that the device re-derives for itself, it belongs in `saveLocal()`.
- **READ-ONLY mode.** If the stored blob fails to parse, `loadState()` no longer overwrites it with `defaultState()`. It quarantines a copy at `gym_tracker_v1__corrupt`, sets `STATE_LOAD_FAILED`, and `writeStore()` refuses every write until a *deliberate* replacement (cloud pull / restore / reset) clears it via `reloadState()`. Never "fix" this by writing defaults.
- **`push()` returns `'ok'` on success** — and only on success. `'nosession'`, `'blocked'`, `'conflict'`, or a throw all mean the data did **not** upload. Any caller gating a destructive action (logout clearing the device) must test `=== 'ok'`, never "not an error string".
- **`applyRemote()` propagates `importRaw()`'s failure.** A failed pull must not advance the sync stamp or clear the dirty flag.
- **Mirror reconcile is gated on `blobLooksReal`** (`js/tables.js`). An empty id list makes the delete unbounded, so it only runs when the blob demonstrably holds user data.
- **Dates: always `todayISO()` / `addDaysISO()`, never `toISOString()`** for calendar days. `toISOString()` returns the previous day for every UTC+ user — this bug class has now appeared three times.
- **Error visibility.** `Cloud.reportError()` + `window.onerror`/`unhandledrejection` write to `client_errors` (`backend/migrations/11_client-errors-v9.sql`, **APPLIED + VERIFIED live 2026-08-05**): signed-in users only, no user content, per-session dedupe, DB-side rate cap of 20/hour, 30-day retention via `admin_prune_client_errors()`. The reporter must never throw and never block.
  > It sat in `pending/` for weeks while the client was already reporting into it — and `reportError` ends `.then(() => {}, () => {})`, swallowing both outcomes, so **every crash on every device was posted to a table that did not exist and silently discarded**. The mechanism built because "everything on this path fails silently" was itself failing silently, and had collected exactly zero rows. Verified after applying: 9 columns, 4 indexes, RLS on, 1 trigger, 2 definer functions, and a policy map of `DELETE:admin | INSERT:own | SELECT:own | SELECT:admin` — **no UPDATE policy for anyone**, so nobody can edit or erase evidence of a bug.
- **Accessibility invariants.** Both modes pass WCAG AA across 15 views and the modals, swept with a scrim-aware auditor. `--text-ghost` is for input placeholders and `--text-faint` is **decorative only** (~1.4:1 in light by design) — do not "unify" them, and never use `--text-faint` for text a user has to read. Muted tokens are calibrated against **`--surface-3`**, the worst surface they land on, never against `--bg`. Pinch-zoom is enabled, which means **inputs must stay ≥16px** or iOS focus-zoom returns.
- **Worker auth** (`backend/worker/gemini-worker.js`) fails **closed** on any 4xx and open only on 5xx/network error, plus a per-caller rate limit. Requires a manual Cloudflare redeploy.
- **Pending SQL: NONE.** `backend/pending/` is empty — 11–14 (`client-errors-v9`, `ban-rls-v10`, `launch-hardening`, `hardening-v8`) were applied and verified live on 2026-08-05. **`backend/README.md` is the authority for what is applied**, derived from git rather than memory; this bullet has twice claimed the wrong thing when edited from memory instead.

## Feature factory
This machine has a `/feature-factory` skill (24 specialist subagents, tailored to THE VAULT) that builds a feature end-to-end. See the maintainer's Claude memory for the roster.
