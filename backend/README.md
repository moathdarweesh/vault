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
| 12 | `ban-rls-v10.sql` | Extends the ban past the blob: RESTRICTIVE INSERT/UPDATE policies on the mirror tables, the `exercise-images` bucket, and `profiles` (so a banned account cannot re-brand). SELECT and DELETE stay open, so a blocked user can still export and erase their own data. Applied + verified live 2026-08-05. |
| 13 | `launch-hardening.sql` | ~5 MB `vault_data` size cap (BEFORE trigger) + server-side `feedback.username` snapshot, which stops a crafted insert displaying any @handle in the admin inbox. Applied + verified live 2026-08-05. |
| 14 | `hardening-v8.sql` | Revokes the implicit PUBLIC/anon EXECUTE on `admin_user_stats()`/`admin_activity()` and pins `search_path` on every SECURITY DEFINER function missing it. Applied + verified live 2026-08-05. |

> ⚠️ **Keep `image/svg+xml` OUT of the `exercise-images` mime allowlist,
> permanently.** It is what rejects an active-content SVG arriving from a
> poisoned imported backup.

## 2) Not yet applied — `pending/`

**Empty.** Everything written has been applied; 11–14 went in on 2026-08-05.

## 3) State unknown — `unverified/`

These were written and committed, but nothing in git or the docs records whether
they were ever run. **Check the live database before running any of them** — all
four are idempotent, so a re-run is safe, but knowing the real state matters more
than the run itself.

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
