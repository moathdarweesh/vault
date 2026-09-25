# THE VAULT — backend

Supabase (Postgres + RLS), project ref `ilmusnuchqlpirywonzx`, plus one
Cloudflare Worker that holds the Gemini key server-side.

**There is no migration tool.** Every `.sql` here is applied by hand — pasted
into the Supabase SQL editor, or run through the Supabase MCP `execute_sql`
where the session has it (`apply_migration` is refused by the permission
classifier; `execute_sql` is not). Either way the two questions that matter —
*what order do these run in* and *which have already run* — live in this file
and nowhere else, so every row below records the date AND the path it took. Keep it true.
(The server cannot answer either question: `supabase_migrations.schema_migrations` holds
rows for 18 and 19 only, because a SQL-editor paste writes no ledger row.)

```
backend/
  migrations/   applied to the live database, in dependency order  ← numbered
  pending/      written and reviewed, NOT yet applied — the owner's to-do list
  archive/      superseded or historical; never run these
                (unverified/ was retired on 2026-09-25 — see §3)
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

Run in this order on a fresh project. All of them are idempotent EXCEPT `04`
(a one-time blob backfill), so re-running a file on a database that already has
it is safe.

| # | File | What it establishes |
|---|---|---|
| 01 | `supabase-setup.sql` | `public.vault_data` — the whole-blob table, one JSON row per user, owner-only RLS. **This is what actually carries user data.** ⚠️ The file writes four policies; live has **three** (read-only check, 2026-09-13). `vault_delete_own` sits behind the file's own never-actioned "ACTION REQUIRED" banner and was never applied, so `vault_data` has no DELETE policy — harmless, because no client deletes the blob and erasure runs through `delete_own_account()` (SECURITY DEFINER). Before ever applying it, read CLAUDE.md "The backend audit": a client-side delete would leave up to ten full prior blobs in `vault_data_history`. |
| 02 | `schema-v2.sql` | The 16-table normalized schema, 64 RLS policies, `touch_updated_at()`, 27 indexes, least-privilege grants. Additive — it does not touch `vault_data`. |
| 03 | `seed-v2.sql` | The global exercise + cardio catalog (`owner_id IS NULL` rows). |
| 04 | `migrate-blob-to-v2.sql` | One-time blob → tables backfill. **Aborts** unless 03 has seeded the catalog. |
| 05 | `admin-v2.sql` | `profiles.username` (unique), the `admins` registry, `is_admin()`, and additive admin-read policies. |
| 06 | `admin-write-v3.sql` | `user_flags` (role/status): writes only via the `is_admin()`-gated definer RPCs `admin_set_role`/`admin_set_status` — deliberately **no** client write policy, so a user can read their own row but never escalate. `feedback` is the opposite shape: a user may INSERT their own row (`feedback_insert_own`; status must be `open`) and has **no** SELECT on it — the author cannot read it back — while only an admin reads or resolves it (`feedback_admin_read`/`feedback_admin_update`). This row used to credit `feedback` with `user_flags`' no-write rule. |
| 07 | `admin-write-v4.sql` | `audit_log`, `app_config`, `food_catalog`, `preset_plans` + their gated CRUD RPCs. |
| 08 | `storage-images-v6.sql` | The private `exercise-images` bucket and its owner-only policies. |
| 09 | `hardening-v5.sql` | `feedback_user_idx` + the `vault_data` grant double-lock (anon revoked, `authenticated` narrowed to the four DML verbs). |
| 10 | `ban-rls.sql` | `is_banned()` + RESTRICTIVE policies, so a ban holds at the database instead of only in the client. Also lowers the `exercise-images` per-file cap to **512 KB** (`file_size_limit = 524288`, confirmed live) — the "5 MB" in CLAUDE.md is 08's figure, from before this file. The ban could not reach the AI Worker, which is not Postgres, until 30's `ai_budget_take()` began refusing a blocked account. |
| 11 | `client-errors-v9.sql` | `client_errors` — insert-own / select-own / admin-select / admin-delete, **no UPDATE policy for anyone**, a 20-per-hour DB-side rate cap in a BEFORE-INSERT trigger, and the `is_admin()`-gated 30-day prune RPC. Applied + verified live 2026-08-05. ⚠️ The cap did not bind until 30: it counts `created_at`, which the client could set, so a row sent as 2000-01-01 was never counted. |
| 12 | `ban-rls-v10.sql` | Extends the ban past the blob: RESTRICTIVE INSERT/UPDATE policies on the mirror tables, the `exercise-images` bucket, and `profiles`. SELECT and DELETE stay open, so a blocked user can still export and erase their own data. Applied + verified live 2026-08-05. **Incomplete — see 15.** Its hand-written table array named 5 tables that do not exist and omitted 4 that do, and the loop `continue`d past the missing ones in silence, so it created 11 policy pairs where this table claimed 16. |
| 13 | `launch-hardening.sql` | ~5 MB `vault_data` size cap (BEFORE trigger) + server-side `feedback.username` snapshot, which stops a crafted insert displaying any @handle in the admin inbox. Applied + verified live 2026-08-05. |
| 14 | `hardening-v8.sql` | Revokes the implicit PUBLIC/anon EXECUTE on `admin_user_stats()`/`admin_activity()` and pins `search_path` on every SECURITY DEFINER function missing it. Applied + verified live 2026-08-05. |
| 16 | `security-audit-repairs-v12.sql` | Rewrites `delete_own_account()` to delete the caller's children explicitly in FK-safe order — the old one relied on the `auth.users` cascade, which hits `ON DELETE RESTRICT` from `workout_sessions.exercise_id`/`cardio_logs.cardio_type_id`. Also re-pins `admin_user_stats`/`admin_activity`/`snapshot_feedback_username` from `search_path=public` to `''`, makes `client_errors_rate_cap` SECURITY INVOKER, adds the `client_errors` ban policy, and drops `migration_v2` behind a raise-guard. Applied + verified live 2026-08-13. |
| 17 | `cross-tenant-write-guards-v13.sql` | 8 RESTRICTIVE guards so a row cannot reference another user's custom exercise/cardio type; all 12 predicates permit the global catalog (`owner_id is null`). Adds `workout_sessions_performed_idx`. Refuses to apply if any cross-tenant row already exists. Applied + verified live 2026-08-13. |
| 15 | `ban-rls-completion-v11.sql` | Closes 12's gap: ban INSERT/UPDATE on the four tables it missed (`exercises`, `cardio_types`, `foods`, `user_prefs`), a ban on `profiles` INSERT (12 restricted UPDATE only, so a banned user could delete their own profile row and insert a new one under a fresh @handle), and the revoke/grant double-lock `client_errors` never got. Raises instead of skipping a missing table, and its VERIFY asserts the policy COUNT rather than mere existence — the check that would have caught 12. Applied + verified live 2026-08-13: tables carrying a ban pair went 14 -> 18, all four missing tables show ins=1/upd=1, `profiles_ban_insert` exists, and `client_errors` grants are exactly `authenticated: SELECT, INSERT` with nothing for `anon`. |
| 18 | `drop-mirror-v14.sql` | Removes the one-way analytics mirror (13 normalized tables) after the owner decision that the blob IS the truth; rewrites the three functions that named those tables (plpgsql binds table names at call time) in the same transaction; adds the `vault_data_admin_read` policy so `admin.html` reads blobs directly. Applied + verified live 2026-09-02. |
| 19 | `admin-adherence-v15.sql` | The Console's adherence RPC: planned-vs-done per user per week, counting DISTINCT DATES (the blob stores one session row per exercise). Applied + verified live 2026-09-02. ⚠️ It used DROP + a bare CREATE, and a DROP discards the function ACL: PUBLIC/anon regained EXECUTE on `admin_user_stats()` from this apply until 23 re-issued the revoke (the `is_admin()` gate still raised, so nothing was exposed — the 14/16 double-lock was simply gone). check-contracts #28 now catches that shape. |
| 20 | `vault-data-history-v16.sql` | `vault_data_history` — the last 10 versions of every user's blob, filed by a BEFORE UPDATE trigger (SECURITY DEFINER, empty search_path) whenever `data` changes; own-row SELECT only, no client write path, grants double-locked like `vault_data`. Closes the "the side force-pushed over had no copy anywhere" gap of whole-blob sync. Applied + verified live 2026-09-02 (the trigger read back from `pg_trigger` in the same run). Since v300 the file also adds the `version` column itself (`add column if not exists`, the same statement as 22): its trigger reads `old.version`, and a replay of this folder in order reached 20 before 22 — check-contracts #4 now replays the columns too. |
| 21 | `food-catalog-fat-v17.sql` | `food_catalog.fat` (default 0) and a 7-argument `admin_upsert_food` overload with `p_fat`; the 6-argument original stays. Applied + verified live 2026-09-02 — verified BY CALLING: a `do` block invoked the new overload (it ran to its admin gate, as a non-admin session must), and the same run counted the column, the 7-arg and the 6-arg functions (1 / 1 / 1). |
| 22 | `vault-data-version.sql` | The server-authoritative `version` column on `vault_data` (+ its bump trigger) that the client's optimistic-concurrency push compares against. Applied live long before it was numbered — it sat in `unverified/` while every push already depended on it; moved into the history in v298 so a rebuild of the schema from this folder produces a database the client can sync with. Idempotent. |
| 23 | `admin-week-sunday-v19.sql` | `admin_user_stats()` re-created with the adherence week anchored on SUNDAY — the app's one `WEEK_START` since v298 (migration 19 had Saturday from the Console design's copy, so the Console and the Program tab counted different weeks). Return type unchanged; idempotent. Also re-locks EXECUTE (see row 19). Applied 2026-09-05 **through the Supabase MCP `execute_sql`**; verified by calling it (non-admin session stops at the gate), by reading the anchor back out of `pg_get_functiondef`, and the file now ends with that call instead of suggesting it in a comment. |
| 24 | `client-errors-kinds-v20.sql` | `client_errors.kind` CHECK widened to the five kinds the app actually sends (`error`, `unhandledrejection`, `manual`, `notif`, `sync-conflict`). 11 allowed three; `reportError('notif', …)` and the sync-conflict diagnostics were refused with 23514 and silently dropped — the conflict diagnostics had never reached the table. Idempotent. Applied 2026-09-05 through the Supabase MCP and verified by reading the constraint back. check-contracts #18 now reads the LAST such constraint and refuses a new `reportError('<kind>')` literal that is not in it. |
| 25 | `admin-week-client-v21.sql` | `admin_user_stats(p_week_start date default null)` — the Console passes the week it is DISPLAYING (browser-local Sunday) instead of letting the SQL anchor on UTC `current_date`: between 00:00 and 03:00 local every Sunday, UTC was still on Saturday and the figures covered the previous week while the caption named the new one. Adds the missing upper bound (`< week_start + 7`) so a future-dated session stops counting as "this week". Signature change, so DROP + CREATE — and the revoke/grant pair after it is the ACL the DROP discards (see row 19). Ends by CALLING both overload forms and by asserting the ACL. Idempotent. |
| 26 | `abuse-hardening-v22.sql` | The 2026-09-06 security assessment's ABUSE surface, closed in one file: `anon` loses EXECUTE on `username_available()` and `is_admin()` (05 intended this and the revoke never took, so an unauthenticated handle oracle was live); `authenticated` loses the default TRUNCATE/TRIGGER/REFERENCES on `profiles`/`exercises`/`cardio_types`; `enforce_vault_data_size` and `bump_vault_data_version` get pinned search_paths; `feedback` gets 2,000/200-character limits and a 5-per-hour trigger; `profiles.display_name` gets a 60-character limit; the blob history is bounded by BYTES as well as count (10 versions AND ≤ 8 MB, never fewer than 2 — one account's worst case falls from ~55 MB to ~13 MB of a 500 MB tier); the image bucket gets a leaf-name shape and a 200-object per-user cap via `exercise_image_count()`; and `ai_usage` + `ai_budget_take()` give the shared Gemini key a DURABLE per-user (60) and global (800) daily budget, which the Worker calls with the caller's own token. **No isolation change** — every cross-tenant probe returned zero rows before and after. ⚠️ **Four of its eight sections did not do what the file said — see row 27.** Applied 2026-09-06 through the Supabase MCP `execute_sql`; its VERIFY blocks ran, but several of them read a catalog rather than calling the thing they claimed to prove, which is how a no-op shipped looking green. Two more holes outlived both 26 and 27 — see rows 27 and 30. |
| 27 | `abuse-hardening-repairs-v23.sql` | What a 42-agent adversarial review of 26 confirmed, repaired: the feedback cap was a NO-OP (SECURITY INVOKER, so its own count ran under RLS and saw zero rows); `ai_budget_take` billed the SHARED global row for calls it REFUSED, so one account could switch the AI off for every user (proved live: 900 calls from one account, 840 of them refused, drove the global row to 900 and the next user's first call was denied); `exercise_image_count(uuid)` answered about ANY user; `exercises`/`cardio_types` were still unbounded in text and row count, which was a larger tier-filling lever than the blob history 26 spent its effort on; and a carve-out added between the two files referenced `storage.objects` from inside its own INSERT policy, so EVERY image upload failed with 42P17 infinite recursion, silently, for about twenty minutes (no user hit it — the last successful upload predates it). Applied 2026-09-06 through the Supabase MCP `execute_sql`. **Every VERIFY here CALLS**: five stored and the sixth raising, a 500-character exercise name refused, three AI calls allowed and the fourth refused with nothing billed, a real `.jpg` upload accepted and a `.svg` refused — all inside blocks that raise at the end, so no probe row survives. ⚠️ **Two of its repairs left a hole, found by the 2026-09-25 review:** B's `ai_budget_take(p_user_limit, p_global_limit)` compared the counts with the CALLER's limits, so a direct PostgREST call with huge values passed every check and still charged the shared row — one account could switch the AI off for everyone, the outcome B says it prevents (its VERIFY called `ai_budget_take(3, 800)` and never tried a bigger number); and A's cap counts a `created_at` the client could backdate. Both repaired by 30. |
| 28 | `ai-usage-cascade-v24.sql` | `ai_usage` had no foreign key to `auth.users`, so deleting an account left its per-day counter rows orphaned forever — nothing reads them and `admin_prune_ai_usage` only drops rows older than 30 days, so a young orphan survived indefinitely. Found while cleaning up test accounts (two real orphans). Adds `on delete cascade`, declared NOT VALID so the all-zero GLOBAL sentinel row (which is not a user) is not rejected while every future delete still cascades. Applied 2026-09-06 and VERIFIED BY DELETING a throwaway user and watching its counter row go 1 → 0, inside a rolled-back block. ⚠️ **Its NOT VALID premise was wrong.** NOT VALID skips only the rows that already exist; every INSERT is still checked. So from the next UTC day the budget's insert of the all-zero global row failed with 23503, the whole call rolled back, and the Worker failed open — measured live 2026-09-13: nothing billed since 2026-09-06. The VERIFY proved the cascade and never called `ai_budget_take()`, the one function that writes this table. It also could not compile as committed (`pg_catalog.position(x in y)` is grammar, like COALESCE), so the text that ran live differed from this file; it uses `strpos()` since the 2026-09-25 review, so the file replays. Repaired by 30 (§2). |

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

**And every migration that constrains a TABLE must end by exercising every write
path into that table** — as the role that really writes it. 28 added a foreign key
to `ai_usage` and proved the cascade by deleting a probe user, which was true; it
never called `ai_budget_take()`, the only function that INSERTs into that table,
and that function failed on the next UTC day and stayed failed for a week. 30 is
the pattern: every write path into `ai_usage`, `ai_usage_global`, `feedback` and
`client_errors` is exercised under a throwaway user, as `authenticated` where a
client would be.

## 2) Not yet applied — `pending/`

| # | File | What it does | State |
|---|---|---|---|
| 30 | `ai-budget-and-caps-v26.sql` | Revives the daily AI budget (dead since 2026-09-06 — row 28) and closes three holes the 2026-09-25 review found: the global counter moves out of `ai_usage` into `ai_usage_global`, so 28's foreign key is kept and VALIDATED; `ai_budget_take()` takes **no arguments** (60 per account, 800 in total, per UTC day, as constants), its caller-chosen-limits overload is dropped, and it refuses a banned or disabled account (`blocked`); `feedback` and `client_errors` lose table-level INSERT for `authenticated` — column-level INSERT on exactly what `js/cloud.js` sends — and a trigger stamps `created_at = now()`, so a backdated row can no longer dodge the hourly caps; `admin_prune_ai_usage()` covers the new table. One transaction; four VERIFY blocks CALL every write path and roll their probes back; it commits only if all four pass. No client or Worker change is needed for it to take effect. | **NOT APPLIED** — a live write; the owner runs it |

**How the owner applies 30:**

1. Take a backup first — [`docs/DB-BACKUP-RESTORE.md`](docs/DB-BACKUP-RESTORE.md).
2. Supabase dashboard → **SQL editor** → New query → paste the **whole** of
   `backend/pending/30_ai-budget-and-caps-v26.sql` → **Run**. The "destructive
   operation" dialog is expected and benign here: the drops are `drop constraint if
   exists` (re-added in the next statement), `drop trigger if exists` guards, and
   `drop function if exists public.ai_budget_take(integer, integer)` — the overload
   being removed on purpose. The only DELETEs remove the all-zero sentinel row
   (after copying it to `ai_usage_global`) and orphan counter rows; the VERIFY blocks
   delete only their own throwaway rows, and roll those back.
   Same file through the Supabase MCP `execute_sql` (the path 23–27 took), or with
   psql: `psql "<direct connection string>" -v ON_ERROR_STOP=1 -f backend/pending/30_ai-budget-and-caps-v26.sql`.
   If it answers `must be owner of table …`, that table was created by another role:
   run the file by the path that applied 26–28 (the MCP `execute_sql`). Nothing was
   applied in the meantime — the transaction aborted whole.
3. Expect **exactly four NOTICEs**, `VERIFY 1 ok` … `VERIFY 4 ok` (their full text
   is in the file's header), and no error. Anything else means nothing was applied.
4. Live check: make one AI call from the app, then
   `select * from public.ai_usage_global where day = (now() at time zone 'utc')::date;`
   — `n` went up by one.
5. `git mv backend/pending/30_ai-budget-and-caps-v26.sql backend/migrations/`, and move
   this row to §1 with the date and the path it took.

**29 is gone from here.** `29_ai-usage-fk-repair-v25.sql` sat in `pending/` from
2026-09-13 and is now in `archive/`, superseded by 30 and never to be run: it only
dropped the foreign key, so applied on its own it would have revived the budget WITH
27's caller-chosen limits, and left a deleted account's counters behind. (Before 29,
20 and 21 were the last files through here — applied 2026-09-02 from the SQL editor,
driven through the owner's signed-in Chrome.)

## 3) `unverified/` — retired 2026-09-25

The folder is gone. Its three files were checked live on 2026-08-13, and every one of
them has been superseded since — so its standing advice, "verify against live, then
run", had turned into advice to run the wrong SQL. All three are in `archive/` with a
header saying what replaced them. The 2026-08-13 verdicts are kept as HISTORY:

| File (now in `archive/`) | 2026-08-13 verdict | Why it must never run now |
|---|---|---|
| `admin-scale-rpc.sql` | APPLIED | Both functions were re-defined since: `admin_activity()` by 16 and 18, `admin_user_stats()` by 16, 18, 19, 23 and 25 (it is `admin_user_stats(p_week_start date)` now). Re-run, it puts back bodies over the tables 18 dropped — they compile, then fail with 42P01 on the first call, which `admin.html` shows as an all-zero Console — and re-creates a zero-argument `admin_user_stats()` beside 25's with PUBLIC holding EXECUTE. This table used to say "move it into `migrations/`", which would have put that regression into every rebuild. |
| `delete-own-account.sql` | APPLIED — and the FK-RESTRICT abort it implied was live then | 16 rewrote `delete_own_account()` to delete the caller's children in FK-safe order (the abort is fixed), and 18 rewrote it again for the tables that survived the mirror. Re-run, it restores this older body. |
| `perf-indexes.sql` | NOT APPLIED then | 17 created `workout_sessions_performed_idx` the same day, and 18 dropped `workout_sessions` itself; the file now fails with 42P01. |

Also confirmed in the 2026-08-13 run: the `migration_v2` staging schema (unminimized cross-user
PII, no RLS) is **absent**, so M-9 is a latent re-run hazard only.

## 4) Never run — `archive/`

| File | Why it is here |
|---|---|
| `schema-v2-draft.sql` | The fuller design **including the deferred social tables**, cut down into `02_schema-v2.sql`. It has **no RLS at all** — its policies exist only as comments. Applying it would create unprotected tables. Kept as the design record. |
| `DROP-migration_v2.CONFIRMATION-REQUIRED.sql` | Destructive, not idempotent. Drops the leftover `migration_v2` staging schema, which holds unminimized cross-user PII. Not client-reachable, but a data-minimization gap. Requires a verified backup and a human at the keyboard. |
| `29_ai-usage-fk-repair-v25.sql` | Superseded by `pending/30` on 2026-09-25, never applied. It only dropped `ai_usage_user_fk`: applied alone it would have revived the budget with 27's caller-chosen limits (one account could switch the AI off for everyone, daily) and left a deleted account's counters behind. Its diagnosis of 28 is right, and CLAUDE.md cites it. |
| `admin-scale-rpc.sql` | From the retired `unverified/`. Superseded by 16/18/19/23/25 — see §3. |
| `delete-own-account.sql` | From the retired `unverified/`. Superseded by 16 and 18 — see §3. |
| `perf-indexes.sql` | From the retired `unverified/`. Its index came with 17 and its table left with 18 — see §3. |

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
5. A pending file that is superseded before it runs goes to `archive/` with a
   header naming what replaced it — never left in `pending/`, where the next
   reader takes it for work still to do (that is what 29 would have become).

**Never put a `service_role` key in any client.** `admin.html` reads every user
through `is_admin()` RLS with the publishable key only.

## The Worker

[`worker/`](worker/) holds `gemini-worker.js`, its `wrangler.toml` and the deploy
guide. Since v306 it deploys with **`npx wrangler deploy` from `backend/worker/`**;
nothing in this repo pushes it automatically, and the old dashboard paste is retired
— a paste drops the `RATE_LIMITER` binding and the logs switch, which live in
`wrangler.toml`. The `GEMINI_KEY` secret lives on the Worker and survives a deploy
(`npx wrangler secret put GEMINI_KEY` only to rotate it — a secret change, so the
owner's). CORS is an origin allowlist; if the AI breaks in the Android app, that
list is the first place to look.

The Worker takes the durable budget by calling `ai_budget_take()` with the caller's
own token and an empty body, `{}` — since 30 the function takes no arguments. If
that call fails, the request is still served (fail-open, the owner's availability
decision) but the Worker logs `[gemini-worker] budget rpc failed OPEN: <status>
<code> <message>`. After any change to `ai_usage`, `ai_usage_global` or the
function, search Workers Logs for that line: for a week in September it would have
been on every call.
