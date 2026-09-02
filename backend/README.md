# THE VAULT — backend

Supabase (Postgres + RLS), project ref `ilmusnuchqlpirywonzx`, plus one
Cloudflare Worker that holds the Gemini key server-side.

**There is no migration tool.** Every `.sql` here is pasted by hand into the
Supabase SQL editor. That is workable, but it means the two questions that
matter — *what order do these run in* and *which have already run* — live in
this file and nowhere else. Keep it true.

```
backend/
  migrations/   applied to the live database, in dependency order  ← numbered
  pending/      written and reviewed, NOT yet applied
  unverified/   applied state unknown — verify against live before running
  archive/      superseded or historical; never run these
  worker/       the Cloudflare Worker (gemini-worker.js) + its deploy guide
  docs/         backup/restore doctrine and the first-time Supabase setup
```

The numeric prefix in `migrations/` is the **run order**, derived from what each
file actually references (a policy on a table another file creates, an RPC that
calls a function another file defines). The original filename is kept after the
prefix on purpose: commit messages, `CLAUDE.md`, `docs/LLD.md` and the audit
notes all cite these by name, and renaming them would break that paper trail.

---

## 1) Applied — `migrations/`

Run in this order on a fresh project. All ten are idempotent, so re-running a
file on a database that already has it is safe.

| # | File | What it establishes |
|---|---|---|
| 01 | `supabase-setup.sql` | `public.vault_data` — the whole-blob table, one JSON row per user, four owner-only RLS policies. **This is what actually carries user data.** |
| 02 | `schema-v2.sql` | The 16-table normalized schema, 64 RLS policies, `touch_updated_at()`, 27 indexes, least-privilege grants. Additive — it does not touch `vault_data`. |
| 03 | `seed-v2.sql` | The global exercise + cardio catalog (`owner_id IS NULL` rows). |
| 04 | `migrate-blob-to-v2.sql` | One-time blob → tables backfill. **Aborts** unless 03 has seeded the catalog. |
| 05 | `admin-v2.sql` | `profiles.username` (unique), the `admins` registry, `is_admin()`, and additive admin-read policies. |
| 06 | `admin-write-v3.sql` | `user_flags` (role/status) and `feedback`; writes only via `is_admin()`-gated definer RPCs — there is deliberately **no** client write policy, so a user can read their own row but never escalate. |
| 07 | `admin-write-v4.sql` | `audit_log`, `app_config`, `food_catalog`, `preset_plans` + their gated CRUD RPCs. |
| 08 | `storage-images-v6.sql` | The private `exercise-images` bucket and its owner-only policies. |
| 09 | `hardening-v5.sql` | `feedback_user_idx` + the `vault_data` grant double-lock (anon revoked, `authenticated` narrowed to the four DML verbs). |
| 10 | `ban-rls.sql` | `is_banned()` + RESTRICTIVE policies, so a ban holds at the database instead of only in the client. |
| 11 | `client-errors-v9.sql` | `client_errors` — insert-own / select-own / admin-select / admin-delete, **no UPDATE policy for anyone**, a 20-per-hour DB-side rate cap in a BEFORE-INSERT trigger, and the `is_admin()`-gated 30-day prune RPC. Applied + verified live 2026-08-05. |
| 12 | `ban-rls-v10.sql` | Extends the ban past the blob: RESTRICTIVE INSERT/UPDATE policies on the mirror tables, the `exercise-images` bucket, and `profiles`. SELECT and DELETE stay open, so a blocked user can still export and erase their own data. Applied + verified live 2026-08-05. **Incomplete — see 15.** Its hand-written table array named 5 tables that do not exist and omitted 4 that do, and the loop `continue`d past the missing ones in silence, so it created 11 policy pairs where this table claimed 16. |
| 13 | `launch-hardening.sql` | ~5 MB `vault_data` size cap (BEFORE trigger) + server-side `feedback.username` snapshot, which stops a crafted insert displaying any @handle in the admin inbox. Applied + verified live 2026-08-05. |
| 14 | `hardening-v8.sql` | Revokes the implicit PUBLIC/anon EXECUTE on `admin_user_stats()`/`admin_activity()` and pins `search_path` on every SECURITY DEFINER function missing it. Applied + verified live 2026-08-05. |
| 16 | `security-audit-repairs-v12.sql` | Rewrites `delete_own_account()` to delete the caller's children explicitly in FK-safe order — the old one relied on the `auth.users` cascade, which hits `ON DELETE RESTRICT` from `workout_sessions.exercise_id`/`cardio_logs.cardio_type_id`. Also re-pins `admin_user_stats`/`admin_activity`/`snapshot_feedback_username` from `search_path=public` to `''`, makes `client_errors_rate_cap` SECURITY INVOKER, adds the `client_errors` ban policy, and drops `migration_v2` behind a raise-guard. Applied + verified live 2026-08-13. |
| 17 | `cross-tenant-write-guards-v13.sql` | 8 RESTRICTIVE guards so a row cannot reference another user's custom exercise/cardio type; all 12 predicates permit the global catalog (`owner_id is null`). Adds `workout_sessions_performed_idx`. Refuses to apply if any cross-tenant row already exists. Applied + verified live 2026-08-13. |
| 15 | `ban-rls-completion-v11.sql` | Closes 12's gap: ban INSERT/UPDATE on the four tables it missed (`exercises`, `cardio_types`, `foods`, `user_prefs`), a ban on `profiles` INSERT (12 restricted UPDATE only, so a banned user could delete their own profile row and insert a new one under a fresh @handle), and the revoke/grant double-lock `client_errors` never got. Raises instead of skipping a missing table, and its VERIFY asserts the policy COUNT rather than mere existence — the check that would have caught 12. Applied + verified live 2026-08-13: tables carrying a ban pair went 14 -> 18, all four missing tables show ins=1/upd=1, `profiles_ban_insert` exists, and `client_errors` grants are exactly `authenticated: SELECT, INSERT` with nothing for `anon`. |
| 18 | `drop-mirror-v14.sql` | Removes the one-way analytics mirror (13 normalized tables) after the owner decision that the blob IS the truth; rewrites the three functions that named those tables (plpgsql binds table names at call time) in the same transaction; adds the `vault_data_admin_read` policy so `admin.html` reads blobs directly. Applied + verified live 2026-09-02. |
| 19 | `admin-adherence-v15.sql` | The Console's adherence RPC: planned-vs-done per user per week, counting DISTINCT DATES (the blob stores one session row per exercise). Applied + verified live 2026-09-02. |
| 20 | `vault-data-history-v16.sql` | `vault_data_history` — the last 10 versions of every user's blob, filed by a BEFORE UPDATE trigger (SECURITY DEFINER, empty search_path) whenever `data` changes; own-row SELECT only, no client write path, grants double-locked like `vault_data`. Closes the "the side force-pushed over had no copy anywhere" gap of whole-blob sync. Applied + verified live 2026-09-02 (the trigger read back from `pg_trigger` in the same run). |
| 21 | `food-catalog-fat-v17.sql` | `food_catalog.fat` (default 0) and a 7-argument `admin_upsert_food` overload with `p_fat`; the 6-argument original stays. Applied + verified live 2026-09-02 — verified BY CALLING: a `do` block invoked the new overload (it ran to its admin gate, as a non-admin session must), and the same run counted the column, the 7-arg and the 6-arg functions (1 / 1 / 1). |

> ⚠️ **Keep `image/svg+xml` OUT of the `exercise-images` mime allowlist,
> permanently.** It is what rejects an active-content SVG arriving from a
> poisoned imported backup.

## ⚠️ VERIFY BY CALLING, NOT BY READING THE CATALOG

Migration 16 nearly shipped a defect that **every catalog-reading check passed**.
It qualified `pg_catalog.coalesce(...)` — but COALESCE is SQL *grammar*, not a
function: `select count(*) from pg_proc where proname='coalesce'` returns **0** on
this server, so it cannot be schema-qualified. plpgsql only raw-parses a body at
CREATE time, so the file applied clean, COMMITted, and passed every `pg_proc` /
`pg_policies` / `pg_get_functiondef` check — and both admin RPCs would have thrown
on their first real call. `admin.html` maps an RPC error to `[]` with no banner, so
the console would have shown all users at zero and read as "nobody uses the app".

The same trap applies to GREATEST, LEAST, NULLIF, CASE and CAST.

**Every migration that defines or replaces a function must end by CALLING it.**
Reading `pg_proc` proves the function EXISTS. Only calling it proves it RUNS. See
migration 16's VERIFY 8 for the pattern — a guard raising `not authorized` is a
PASS, because it proves the body parsed and executed.

## 2) Not yet applied — `pending/`

Nothing. 20 and 21 (written in v291) were applied from the SQL editor on
2026-09-02 — driven through the owner's signed-in Chrome, after the session's
permission classifier had refused the MCP apply — and moved to `migrations/`.

## 3) State unknown — `unverified/`

**Checked live on 2026-08-13.** Three of the four are already applied; only
`perf-indexes.sql` is genuinely missing. The "How to check" column is kept so the
result can be re-confirmed rather than trusted. Verdicts below are from that run.

| File | Verdict (2026-08-13) |
|---|---|
| `admin-scale-rpc.sql` | **APPLIED** — both `admin_user_stats()` and `admin_activity()` exist. Consistent with `14_hardening-v8.sql` having revoked EXECUTE on them inside one transaction, which could not have succeeded otherwise. Move it into `migrations/`. |
| `delete-own-account.sql` | **APPLIED** — `delete_own_account()` exists. ⚠️ This makes the FK-RESTRICT abort a LIVE defect, not a hypothetical one: `workout_sessions.exercise_id` and `cardio_logs.cardio_type_id` are `ON DELETE RESTRICT` while their parents cascade from `auth.users`, so any user with a custom exercise or cardio type that has logs should hit a foreign-key violation — after `Cloud.deleteAccount()` has already swept their Storage images. |
| `perf-indexes.sql` | **NOT APPLIED** — `workout_sessions_performed_idx` does not exist. |
| `vault-data-version.sql` | **APPLIED** — `vault_data.version` exists, `bump_vault_data_version()` exists, and `vault_data` carries both `trg_vault_data_size` and `trg_vault_data_version`. `max(version)` was **590**, so it is not merely present but actively incrementing. The optimistic-concurrency path in `js/cloud.js` (six read sites) is therefore backed by real server state, not an assumption. Move it into `migrations/`. |

Also confirmed in the same run: the `migration_v2` staging schema (unminimized cross-user
PII, no RLS) is **absent**, so M-9 is a latent re-run hazard only.

Original checks, kept for re-confirmation:

| File | What it does | How to check |
|---|---|---|
| `admin-scale-rpc.sql` | `admin_user_stats()` / `admin_activity()` aggregate RPCs for the admin panel. | `select proname from pg_proc where proname like 'admin\_%';` |
| `delete-own-account.sql` | `delete_own_account()` — **destructive by design**; the client sweeps Storage first, then this cascades the rows. | `select proname from pg_proc where proname = 'delete_own_account';` |
| `perf-indexes.sql` | One index on `workout_sessions(performed_on)`. | `select indexname from pg_indexes where indexname = 'workout_sessions_performed_idx';` |
| `vault-data-version.sql` | `vault_data.version` + its bump trigger — the server-authoritative sync counter. | `select column_name from information_schema.columns where table_name='vault_data' and column_name='version';` |

## 4) Never run — `archive/`

| File | Why it is here |
|---|---|
| `schema-v2-draft.sql` | The fuller design **including the deferred social tables**, cut down into `02_schema-v2.sql`. It has **no RLS at all** — its policies exist only as comments. Applying it would create unprotected tables. Kept as the design record. |
| `DROP-migration_v2.CONFIRMATION-REQUIRED.sql` | Destructive, not idempotent. Drops the leftover `migration_v2` staging schema, which holds unminimized cross-user PII. Not client-reachable, but a data-minimization gap. Requires a verified backup and a human at the keyboard. |

---

## Applying a file

1. Take a backup first — see [`docs/DB-BACKUP-RESTORE.md`](docs/DB-BACKUP-RESTORE.md).
   An unrestored backup is not a backup.
2. Supabase dashboard → SQL editor → paste the whole file → Run.
3. Supabase shows a **"destructive operation"** dialog for any `drop`. That is
   benign when the only drops are the `drop policy / trigger if exists` guards
   these files use before re-creating. It is **not** benign for a real
   `DROP TABLE` / `DELETE` / `TRUNCATE` — read the file before confirming.
4. Move the file into `migrations/` with the next number, and update the table
   above. A file whose state is only in someone's memory is how `unverified/`
   happened.

**Never put a `service_role` key in any client.** `admin.html` reads every user
through `is_admin()` RLS with the publishable key only.

## The Worker

[`worker/`](worker/) holds `gemini-worker.js` and its deploy guide. It needs a
**manual redeploy** from the Cloudflare dashboard — nothing in this repo pushes
it. CORS is an origin allowlist; if the AI breaks in the Android app, that list
is the first place to look.
