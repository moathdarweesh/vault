-- ============================================================================
-- 32_indexes-v28.sql — the index pass: nothing added, one index dropped, and
-- the drop happens only if the database's own statistics agree.
--
-- NOT APPLIED. Written 2026-09-27 by a query-layer review that had NO live
-- access, so every claim below comes from reading the code and the
-- migrations. The one question only the live database can answer — "is this
-- index ever used?" — is asked BY THIS FILE, in a gate that aborts the whole
-- transaction unless the answer is no. It goes through db-migration-engineer
-- before the owner runs it.
--
-- ── WHAT THE REVIEW FOUND ──────────────────────────────────────────────────
-- The tables that survive 18 are vault_data, vault_data_history, profiles,
-- admins, user_flags, feedback, client_errors, audit_log, app_config,
-- food_catalog, preset_plans, exercises, cardio_types, ai_usage and
-- ai_usage_global.
--   * Every foreign key has an index that leads with it. VERIFY 1 asserts this
--     for the live catalog, because an unindexed FK turns every account
--     deletion into a scan of the child table.
--   * Every query the clients send (js/cloud.js, admin.html, the Worker) is
--     served by a primary key or an existing composite index, or reads a table
--     small enough that a sequential scan is the right plan. So NOTHING IS
--     ADDED. An index nobody's query needs costs write throughput for good.
--   * One index serves nothing: client_errors_build_idx (build, created_at
--     desc), created by 11. No client, Worker, RPC, trigger or Console query
--     filters or sorts client_errors by `build`:
--       - the Console reads `order by id desc` (admin.html:719) and filters by
--         severity in the browser        -> client_errors_pkey
--       - the hourly cap counts (user_id, created_at > now() - 1 hour)
--                                        -> client_errors_user_idx
--       - the 30-day prune deletes created_at < now() - 30 days
--                                        -> client_errors_created_idx
--       - erasure deletes by user_id     -> client_errors_user_idx
--     Every reportError() insert still pays to maintain it.
--
-- ── WHY THE DROP IS GATED ──────────────────────────────────────────────────
-- "No code uses it" is necessary but not sufficient. The owner's own SQL
-- editor queries (for example "errors from build v404") would use this index
-- and appear nowhere in the repo. pg_stat_user_indexes.idx_scan counts every
-- scan, by anyone. The gate refuses unless idx_scan = 0 AND the statistics
-- cover at least 14 days: since pg_stat_database.stats_reset, or since the
-- server started when they were never reset (the conservative reading). If it
-- refuses, NOTHING is applied. Find the query that reads the index first.
--
-- ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
-- The costs the review found are not index problems, and no index fixes them.
-- They go to their own reviewed changes, not this file:
--   * admin_user_stats() (25) runs correlated subqueries against MATERIALIZED
--     CTEs, so every user rescans every user's sessions and sets: O(users x
--     total sessions). It also decompresses each blob about 14 times per call.
--     The fix is a rewrite that aggregates per user with LATERAL.
--   * The admin SELECT policies call public.is_admin() bare (05, 06, 07, 11,
--     18), so it runs once per row the Console reads instead of once per
--     query. The fix is `using ((select public.is_admin()))` via ALTER POLICY.
--   * exercise_image_count() (27) counts storage.objects by
--     storage.foldername(name), which no index can serve. Every upload scans
--     the whole bucket. The fix is a name range on the existing
--     (bucket_id, name) index. storage.objects is Supabase's table, so no
--     index of ours goes on it.
-- Considered and rejected:
--   * an expression index on vault_data ((data->'prefs'->>'unit')) for the
--     Console's unit column. It would re-evaluate the expression, and so
--     detoast the whole blob, on EVERY push, to speed up a read the owner makes
--     a few times a week. Returning the unit from admin_user_stats() instead
--     costs nothing.
--   * feedback (user_id, created_at) in place of feedback_user_idx. The cap
--     reads every feedback row the account ever sent, but that is a handful
--     today. Revisit if any account passes ~1,000 rows.
--   * (user_id, replaced_at desc, id desc) on vault_data_history. The trims
--     already ride vault_data_history_user_idx over at most 11 rows. The id
--     tiebreak is an incremental sort of those 11 rows.
--   * ai_usage (day) for admin_prune_ai_usage(). Nothing calls that prune.
--
-- ── LOCKS ──────────────────────────────────────────────────────────────────
-- DROP INDEX takes ACCESS EXCLUSIVE on client_errors until the COMMIT, and the
-- VERIFY blocks run before it (a second or two). A reportError() that lands
-- mid-run waits and then proceeds; the client swallows its outcome anyway. It
-- is NOT `drop index concurrently`: that cannot run inside the transaction
-- that carries the gate and the VERIFY, and the table holds at most 30 days of
-- rows. Lock waits are capped at 5 s; past that the file aborts whole, and you
-- re-run it. Idempotent: on a re-run the gate finds the index gone, and the
-- VERIFY blocks run again.
--
-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- 1 reads the catalog, because the facts it checks ARE catalog facts: which
-- indexes exist, and that every foreign key is covered. 2 CALLS every path
-- that reads or writes client_errors, under a throwaway account, as
-- `authenticated` wherever a client would. It then raises, so no probe row
-- survives. A clean run prints (in a client that shows NOTICEs):
--   GATE ok | GATE: ... already gone
--   VERIFY 1 ok: ...
--   VERIFY 2 ok: ...
-- The Supabase SQL editor shows no NOTICEs. There, `Success` after `commit;` is
-- the proof, and an ERROR means nothing was applied.
-- ============================================================================

begin;

set local lock_timeout = '5s';

-- ── GATE — the statistics decide, not this file ────────────────────────────
do $$
declare
  scans bigint;
  since timestamptz;
begin
  select s.idx_scan into scans
    from pg_catalog.pg_stat_user_indexes s
   where s.schemaname = 'public' and s.indexrelname = 'client_errors_build_idx';
  if not found then
    raise notice 'GATE: client_errors_build_idx is already gone (a re-run); nothing to decide';
    return;
  end if;

  -- never reset -> count from the server start (the conservative reading: a
  -- restart may or may not have kept the counters, so assume it did not)
  select coalesce(d.stats_reset, pg_catalog.pg_postmaster_start_time()) into since
    from pg_catalog.pg_stat_database d
   where d.datname = pg_catalog.current_database();

  if scans > 0 then
    raise exception 'GATE: client_errors_build_idx has been scanned % times since % — something reads it. Find that query (pg_stat_statements, the SQL editor history) before dropping. Nothing was applied.', scans, since;
  end if;
  if since > pg_catalog.now() - interval '14 days' then
    raise exception 'GATE: the index statistics only cover the time since % — re-run once they span 14 days of traffic. Nothing was applied.', since;
  end if;
  raise notice 'GATE ok: client_errors_build_idx scanned 0 times since %', since;
end $$;

-- ── THE CHANGE ─────────────────────────────────────────────────────────────
drop index if exists public.client_errors_build_idx;

-- ============================================================================
-- VERIFY — inside the transaction: any failure raises, and nothing commits.
-- ============================================================================

-- 1. the index set, read from the catalog because these facts ARE catalog facts
do $$
declare
  idx     text;
  missing text;
begin
  if pg_catalog.to_regclass('public.client_errors_build_idx') is not null then
    raise exception 'VERIFY 1 failed: client_errors_build_idx still exists';
  end if;

  -- client_errors keeps exactly the three indexes its queries use
  select pg_catalog.string_agg(c.relname::text, ',' order by c.relname::text) into idx
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
   where i.indrelid = 'public.client_errors'::pg_catalog.regclass;
  if idx is distinct from 'client_errors_created_idx,client_errors_pkey,client_errors_user_idx' then
    raise exception 'VERIFY 1 failed: client_errors indexes are [%], expected [client_errors_created_idx,client_errors_pkey,client_errors_user_idx]', idx;
  end if;

  -- every foreign key declared in public is covered by a valid, non-partial
  -- index whose leading columns are the FK's own (an account deletion then
  -- finds its child rows by index, not by a scan of the child table)
  select pg_catalog.string_agg(c.conrelid::pg_catalog.regclass::text || '.' || c.conname, ', ') into missing
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_namespace n on n.oid = c.connamespace
   where c.contype = 'f'
     and n.nspname = 'public'
     and not exists (
       select 1
         from pg_catalog.pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and i.indpred is null
          and (select pg_catalog.array_agg(k.attnum order by k.ord)
                 from pg_catalog.unnest(i.indkey::int2[]) with ordinality k(attnum, ord)
                where k.ord <= pg_catalog.array_length(c.conkey, 1)) = c.conkey
     );
  if missing is not null then
    raise exception 'VERIFY 1 failed: foreign keys with no covering index: %', missing;
  end if;

  raise notice 'VERIFY 1 ok: client_errors_build_idx gone; client_errors keeps pkey/user/created; every public foreign key is index-covered';
end $$;

-- 2. every path into client_errors, called the way its caller calls it
do $$
declare
  probe    uuid := pg_catalog.gen_random_uuid();
  admin_id uuid;
  claims   text;
  n        integer;
  skipped  boolean := false;
begin
  -- a throwaway account (client_errors.user_id references auth.users); gone at the ROLLBACK-OK below
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify32-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  claims := pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text;
  perform pg_catalog.set_config('request.jwt.claims', claims, true);

  -- 2a. the reportError() payload (js/cloud.js reportError), from the client role: stored.
  --     ONE row on purpose: the hourly cap is the trigger's contract, not this
  --     index change's, and pending/31 may rewrite that trigger. A 21-row cap
  --     probe here would make 32 abort over a rule it does not touch.
  set local role authenticated;
  insert into public.client_errors (user_id, build, kind, msg, src, line, ua)
    values (probe, 'verify32', 'manual', 'verify probe', 'verify.sql', 1, 'verify');
  -- 2b. the account reads its own row back through RLS
  select pg_catalog.count(*)::integer into n from public.client_errors e where e.user_id = probe;
  reset role;
  if n <> 1 then
    raise exception 'VERIFY 2a-b failed: the probe reads back % rows (expected its 1)', n;
  end if;

  -- 2c. the Console: its first page (admin.html:719) holds the probe's row,
  --     and the 30-day prune it runs at every sign-in (admin.html:559) runs
  --     and leaves today's row. The DROP holds ACCESS EXCLUSIVE, so nobody
  --     else can have inserted in between: the newest row is the probe's.
  select a.user_id into admin_id from public.admins a order by a.user_id limit 1;
  if admin_id is null then
    skipped := true;
  else
    perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select pg_catalog.count(*)::integer into n
      from (select e.id, e.user_id from public.client_errors e order by e.id desc limit 1000) p
     where p.user_id = probe;
    if n <> 1 then
      reset role;
      raise exception 'VERIFY 2c failed: the Console''s first page holds % of the probe''s 1 row', n;
    end if;
    perform public.admin_prune_client_errors(30);
    select pg_catalog.count(*)::integer into n from public.client_errors e where e.user_id = probe;
    reset role;
    if n <> 1 then
      raise exception 'VERIFY 2c failed: after the 30-day prune the probe has % rows (expected 1: it is seconds old)', n;
    end if;
    perform pg_catalog.set_config('request.jwt.claims', claims, true);
  end if;

  -- 2d. erasure (js/cloud.js deleteAccount -> delete_own_account()), called by the account itself
  set local role authenticated;
  perform public.delete_own_account();
  reset role;
  select pg_catalog.count(*)::integer into n from public.client_errors e where e.user_id = probe;
  if n <> 0 then
    raise exception 'VERIFY 2d failed: % client_errors rows survive the account''s erasure', n;
  end if;

  if skipped then raise exception 'ROLLBACK-OK: VERIFY 2 (admin path skipped)'; end if;
  raise exception 'ROLLBACK-OK: VERIFY 2';
exception
  when others then
    -- strpos(), NOT position(): position(x in y) is SQL grammar and cannot be
    -- pg_catalog-qualified (the trap 28's VERIFY fell into).
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 2') = 0 then raise; end if;
    if sqlerrm = 'ROLLBACK-OK: VERIFY 2' then
      raise notice 'VERIFY 2 ok: the client payload inserts and reads back, the Console page and the prune run, erasure removes the row';
    else
      raise notice 'VERIFY 2 ok: the client payload inserts and reads back, erasure removes the row; admin path skipped (public.admins is empty)';
    end if;
end $$;

commit;
