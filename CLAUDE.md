# THE VAULT — Claude Code Project Guide

A fitness / workout-tracking **PWA**. Vanilla JS, **no build step**, bilingual **EN/AR** (RTL), dark-themed, mobile-first. Deployed to GitHub Pages and wrapped as an Android app via Capacitor.

- **Live:** https://moathdarweesh.github.io/vault/ (GitHub Pages, branch `main`)
- **Repo:** github.com/moathdarweesh/vault

## Stack & key files
- `index.html` — markup, script wiring, and the cache-version markers.
- `js/app.js` (~190KB) — ALL views/rendering, the router `navigate(view, ctx, opts)`, and the two EN/AR translation objects. Use `Grep` to find a function; don't assume from names.
- `js/storage.js` — the `DB.*` localStorage API (all persistence). `MACHINE_SEED`, name-match migrations.
- `js/cloud.js` — Supabase email/password auth + whole-blob sync to a per-user `vault_data` row (RLS-protected). Uses the **publishable** key only (never service-role). Loads before app.js. Also: `getUsername/checkUsername/setUsername` (the mandatory-handle feature) and `getClient` (for tables.js).
- `js/tables.js` — the **"mirror"**: additively projects the local blob into the normalized schema-v2 tables (best-effort, one-way, idempotent, RLS-scoped). Never affects local logging. Loads after storage.js.
- `js/foodai.js` — AI calorie chat. Posts `{text}` to a **Cloudflare Worker** (`backend/gemini-worker.js`) that holds the Gemini key server-side. The key never ships to the client.
- `js/health.js` — Health Connect bridge (Capacitor, no-op on web).
- `styles.css` (~100KB) — one stylesheet; reuse existing CSS variables and classes.
- `admin.html` — standalone owner-only **admin control panel** (GitHub Pages, not in the APK). Owner logs in → `is_admin()` RLS unlocks reading every user; per-user drill-down shows all their data. Publishable key only.

## How to run & verify
- **Run:** `node dev-server.js` → http://localhost:8080 (serves `Cache-Control: no-store`). Honors `$PORT`. Also `.claude/launch.json` server name `vault` for the preview tool.
- **No automated test framework.** "Tested" = verified in the real running app by driving the DOM with `preview_eval`. **Screenshots time out on this app — do not rely on them.**

## Non-negotiable rules
- **Every user-facing string** goes through `t('key')` and has BOTH an EN and an AR entry in `app.js`. A missing language is a bug.
- **Read/write data only through `DB.*`** — never touch `localStorage` directly from view code.
- **Escape untrusted data** rendered into `innerHTML` with `escapeHtml()` — exercise/food names, and anything from cloud sync / imported backups / AI responses are untrusted.
- No new dependencies, no build step. Free-first (the maintainer prioritizes free tools/services).

## CACHE WORKFLOW (mandatory every release that changes shipped files)
Bump the version in **four** places in `index.html` + the label, or the change never reaches phones:
1. `?v=N` on every `<script>` tag.
2. `?v=N` on the `<link rel="stylesheet" href="styles.css?v=N">`.
3. The `__cleaned_vN` sessionStorage key in the inline cleanup script.
4. The visible build label `THE VAULT · vN` in `app.js`.
Then grep for the old number — zero matches should remain. **Current version: v108.**

## Deploy
- **Web:** commit + push to `main`; GitHub Pages auto-rebuilds.
- **Cloudflare Worker:** changes to `backend/gemini-worker.js` require a **manual redeploy** (Cloudflare → Edit code → paste → Deploy). CORS is locked to an origin allowlist — if the AI breaks on the Android app, add the Capacitor origin to `ALLOWED_ORIGINS`.
- **Supabase:** schema/RLS changes in `backend/supabase-setup.sql` must be run in the Supabase SQL editor.
- **Android APK:** `npm run build:www && npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` → `android/app/build/outputs/apk/debug/app-debug.apk`. Installed via Google Drive (delete the old APK first). Portable JDK/SDK live under `C:\Users\moath\at`.

## Backend v2 — normalized DB, mirror, admin (APPLIED to live Supabase)
The app is going multi-user. Alongside the legacy `vault_data` blob (still the local-first source of truth), a **normalized schema** is live in Supabase (project ref `ilmusnuchqlpirywonzx`). SQL artifacts in `backend/`:
- `schema-v2.sql` — 16 core tables + full RLS + indexes (APPLIED). `seed-v2.sql` — global exercise/cardio catalog (APPLIED). `migrate-blob-to-v2.sql` — one-time blob→tables backfill, SECTION UP applied. `admin-v2.sql` — `profiles.username` (unique), `admins` registry + `is_admin()` + additive admin-READ policies on all tables + `username_available()` RPC (APPLIED).
- **Mirror** (`js/tables.js`): ongoing blob→tables projection on login/change.
- **Usernames**: mandatory unique `@handle` enforced by a blocking gate (app.js `ensureUsername`/`showUsernameGate`), set via the profiles table.
- **Admin**: the owner's user_id is in `admins`; `is_admin()` unlocks all-user reads via RLS (never a service_role key in any client). Powers `admin.html`.
- **Applying SQL:** run in the Supabase SQL editor. The "destructive operations" dialog is benign ONLY when the script's drops are `drop policy/trigger if exists` guards; a real DROP/DELETE/TRUNCATE needs explicit human confirmation. See the maintainer's memory (`vault-db-v2`).
- Still pending: base64 custom-exercise images not yet uploaded to Storage; app doesn't READ from the new tables yet (mirror is one-way); social features deferred.

## Feature factory
This machine has a `/feature-factory` skill (24 specialist subagents, tailored to THE VAULT) that builds a feature end-to-end. See the maintainer's Claude memory for the roster.
