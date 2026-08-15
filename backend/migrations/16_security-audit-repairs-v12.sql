-- ============================================================================
-- 16_security-audit-repairs-v12.sql
--
-- Repairs the remaining v263 pentest/database-audit findings. NOT YET APPLIED:
-- the orchestrator must run the pre-flight below, review this file, take the
-- documented backup, and apply it manually in the Supabase SQL editor.
--
-- IMPORTANT LIVE STATE
-- --------------------
-- public.delete_own_account() is CONFIRMED APPLIED as of 2026-08-13. This is a
-- repair of live behaviour, not a first install. Its auth.users cascade can hit
-- workout_sessions.exercise_id/cardio_logs.cardio_type_id RESTRICT before their
-- user-owned parents disappear, so a real erasure request can abort after the
-- old client has already destroyed the user's Storage images.
--
-- This migration also:
--   * replaces three weak `search_path = public` SECURITY DEFINER pins with an
--     empty path and fully-qualified relations. Migration 14 could not catch
--     these by construction: it selected only definer functions with NO pin;
--   * makes client_errors_rate_cap() SECURITY INVOKER and removes implicit
--     client EXECUTE from both internal trigger functions;
--   * adds the client_errors ban INSERT policy omitted because the table did not
--     exist when migration 12's array was drafted; and
--   * drops migration_v2 after cutover. The staging schema was confirmed ABSENT
--     live on 2026-07-17/2026-08-13, so this is a no-op there and closes only the
--     fresh-project/re-run path where migration 04 recreates cross-user PII.
--
-- PRE-FLIGHT (READ ONLY; run and review BEFORE applying this file)
-- ---------------------------------------------------------------------------
-- 1. Confirm all five functions below exist with the expected zero-argument
--    signatures. Do not use this migration to install an unknown baseline.
-- 2. Reconfirm migration_v2 is absent on live. If it exists, STOP and determine
--    why before approving the DROP SCHEMA ... CASCADE below.
-- 3. Reconfirm the FK actions from pg_constraint: workout_sessions -> exercises
--    and cardio_logs -> cardio_types must be RESTRICT; every auth.users child
--    named in delete_own_account() must still match the schema-derived list.
--    Also confirm zero cross-tenant references to another user's custom
--    exercise/cardio parent; the existing write policies do not prove that.
-- 4. Take and restore-test the backup required by backend/README.md.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Right-to-erasure: remove the caller's rows in FK-safe order.
--
-- The order comes from every FK in migrations 01, 02, 05, 06 and 11. Leaves
-- without a direct auth.users FK go first; rows that RESTRICT/CASCADE from the
-- caller's custom catalog parents go before those parents; auth.users is last.
-- The null-auth guard and caller-only uid binding are preserved byte-for-byte in
-- behaviour from the confirmed-live function.
-- ----------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Leaf children first. These rows either have no direct auth.users FK or also
  -- point at a parent that this function must delete later.
  delete from public.workout_sets x
  using public.workout_sessions ws
  where x.session_id = ws.id and ws.user_id = uid;

  delete from public.workout_sessions where user_id = uid;
  delete from public.cardio_logs where user_id = uid;
  delete from public.food_logs where user_id = uid;

  delete from public.supplement_logs sl
  using public.supplements s
  where sl.supplement_id = s.id and s.user_id = uid;

  delete from public.plan_day_exercises where user_id = uid;
  delete from public.user_exercise_prefs where user_id = uid;

  -- feedback would otherwise survive with user_id NULL. Everything else below
  -- is direct caller data; explicit deletion makes the order independent of the
  -- auth.users RI trigger creation order that broke the old function.
  delete from public.feedback where user_id = uid;
  delete from public.client_errors where user_id = uid;
  delete from public.sleep_logs where user_id = uid;
  delete from public.plan_days where user_id = uid;
  delete from public.supplements where user_id = uid;
  delete from public.foods where user_id = uid;

  -- The two RESTRICT failures are now impossible for ordinary caller-owned
  -- data: their referencing workout/cardio rows were removed above.
  delete from public.exercises where owner_id = uid;
  delete from public.cardio_types where owner_id = uid;

  delete from public.health_prefs where user_id = uid;
  delete from public.user_prefs where user_id = uid;
  delete from public.profiles where user_id = uid;
  delete from public.user_flags where user_id = uid;
  delete from public.admins where user_id = uid;
  delete from public.vault_data where user_id = uid;

  -- Last by design: after this succeeds, no account remains even if the client
  -- later fails to sweep non-transactional Storage objects.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Admin aggregates: replace the weak public pin with an empty path.
-- ----------------------------------------------------------------------------
create or replace function public.admin_user_stats()
returns table (
  user_id      uuid,
  sessions     bigint,
  sets         bigint,
  volume       numeric,
  foods        bigint,
  sleeps       bigint,
  cardio       bigint,
  custom       bigint,
  last_session date
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with
    s as (
      select ws.user_id, pg_catalog.count(*)::bigint as sessions,
             pg_catalog.max(ws.performed_on) as last_session
      from public.workout_sessions ws
      group by ws.user_id
    ),
    st as (
      select ws.user_id, pg_catalog.count(*)::bigint as sets,
             coalesce(pg_catalog.sum(x.reps * x.weight), 0)::numeric as volume
      from public.workout_sets x
      join public.workout_sessions ws on ws.id = x.session_id
      group by ws.user_id
    ),
    f as (
      select fl.user_id, pg_catalog.count(*)::bigint as foods
      from public.food_logs fl group by fl.user_id
    ),
    sl as (
      select s2.user_id, pg_catalog.count(*)::bigint as sleeps
      from public.sleep_logs s2 group by s2.user_id
    ),
    c as (
      select cl.user_id, pg_catalog.count(*)::bigint as cardio
      from public.cardio_logs cl group by cl.user_id
    ),
    cx as (
      select e.owner_id as user_id, pg_catalog.count(*)::bigint as custom
      from public.exercises e
      where e.owner_id is not null
      group by e.owner_id
    ),
    ids as (
      select s.user_id from s union
      select st.user_id from st union
      select f.user_id from f union
      select sl.user_id from sl union
      select c.user_id from c union
      select cx.user_id from cx
    )
  select
    i.user_id,
    coalesce(s.sessions, 0),
    coalesce(st.sets, 0),
    coalesce(st.volume, 0),
    coalesce(f.foods, 0),
    coalesce(sl.sleeps, 0),
    coalesce(c.cardio, 0),
    coalesce(cx.custom, 0),
    s.last_session
  from ids i
  left join s  on s.user_id  = i.user_id
  left join st on st.user_id = i.user_id
  left join f  on f.user_id  = i.user_id
  left join sl on sl.user_id = i.user_id
  left join c  on c.user_id  = i.user_id
  left join cx on cx.user_id = i.user_id;
end;
$$;

create or replace function public.admin_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select pg_catalog.jsonb_build_object(
    'sess_today', (
      select pg_catalog.count(*) from public.workout_sessions ws
      where ws.performed_on >= current_date
    ),
    'sess_week', (
      select pg_catalog.count(*) from public.workout_sessions ws
      where ws.performed_on >= current_date - 7
    ),
    'top_ex', (
      select coalesce(pg_catalog.jsonb_agg(t), '[]'::jsonb) from (
        select e.name as name, coalesce(e.category::text, 'Other') as cat,
               pg_catalog.count(*)::int as n
        from public.workout_sessions ws
        join public.exercises e on e.id = ws.exercise_id
        group by e.name, e.category
        order by n desc
        limit 8
      ) t
    ),
    'cat_dist', (
      select coalesce(pg_catalog.jsonb_object_agg(d.cat, d.n), '{}'::jsonb) from (
        select coalesce(e.category::text, 'Other') as cat,
               pg_catalog.count(*)::int as n
        from public.workout_sessions ws
        join public.exercises e on e.id = ws.exercise_id
        group by e.category
      ) d
    ),
    'recent', (
      select coalesce(pg_catalog.jsonb_agg(r), '[]'::jsonb) from (
        select ws.user_id, e.name as ex,
               coalesce(e.category::text, 'Other') as cat,
               ws.performed_on as date
        from public.workout_sessions ws
        left join public.exercises e on e.id = ws.exercise_id
        order by ws.performed_on desc nulls last
        limit 12
      ) r
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_user_stats() from public, anon, authenticated;
revoke all on function public.admin_activity() from public, anon, authenticated;
grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_activity() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Internal trigger functions: strong pin, invoker where privilege is unused,
--    and no callable surface for client roles.
-- ----------------------------------------------------------------------------
create or replace function public.snapshot_feedback_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.username := (
    select p.username from public.profiles p where p.user_id = new.user_id
  );
  return new;
end;
$$;

create or replace function public.client_errors_rate_cap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recent integer;
begin
  select pg_catalog.count(*) into recent
  from public.client_errors ce
  where ce.user_id = new.user_id
    and ce.created_at > pg_catalog.now() - interval '1 hour';

  if recent >= 20 then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.snapshot_feedback_username() from public, anon, authenticated;
revoke all on function public.client_errors_rate_cap() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. client_errors was created after the original ban table array. It accepts
--    INSERT but never UPDATE, so only the missing restrictive INSERT is needed.
-- ----------------------------------------------------------------------------
drop policy if exists client_errors_ban_insert on public.client_errors;
create policy client_errors_ban_insert on public.client_errors
  as restrictive for insert to authenticated
  with check (not public.is_banned());

-- ----------------------------------------------------------------------------
-- 5. migration 04 is immutable applied history. Cleanup therefore lands here:
--    live is a verified no-op; a fresh sequential apply drops the staging copy
--    of cross-user blob/image PII after migration 04's cutover has completed.
-- ----------------------------------------------------------------------------
-- Fails LOUD, not silent. This is the file's only destructive statement, and a
-- silent skip is exactly what hid migration 12's gap for three releases. The
-- schema was confirmed ABSENT live on 2026-07-17 and again on 2026-08-13, so the
-- expected path is "raises nothing because there is nothing to drop". If it ever
-- DOES exist, that is a fact worth stopping for -- it holds unminimized
-- cross-user PII -- not something to cascade away inside a routine migration.
do $$
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'migration_v2') then
    raise exception 'migration_v2 exists on live; confirm out-of-band before dropping cross-user PII';
  end if;
end $$;

drop schema if exists migration_v2 cascade;

commit;

-- ============================================================================
-- VERIFY -- run after committing. Every query states its own pass condition.
-- ============================================================================

-- 1. Function mode + pin. Expect exactly 5 rows. `prosecdef` must be true for
--    delete/admin/admin/snapshot, false for client_errors_rate_cap; every
--    `proconfig` must contain only the empty search_path pin.
select p.proname, p.prosecdef, p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'delete_own_account', 'admin_user_stats', 'admin_activity',
    'snapshot_feedback_username', 'client_errors_rate_cap'
  )
order by p.proname;

-- 2. Function grants. Expect authenticated EXECUTE on exactly
--    delete_own_account/admin_user_stats/admin_activity; expect NO rows for
--    snapshot_feedback_username or client_errors_rate_cap, and no anon/PUBLIC.
select r.routine_name, r.grantee, r.privilege_type
from information_schema.routine_privileges r
where r.routine_schema = 'public'
  and r.routine_name in (
    'delete_own_account', 'admin_user_stats', 'admin_activity',
    'snapshot_feedback_username', 'client_errors_rate_cap'
  )
  and r.grantee in ('PUBLIC', 'anon', 'authenticated')
order by r.routine_name, r.grantee;

-- 3. Ban policy. Expect exactly one row:
--    client_errors_ban_insert | INSERT | RESTRICTIVE.
select p.policyname, p.cmd, p.permissive
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'client_errors'
  and p.policyname = 'client_errors_ban_insert';

-- 4. Trigger bindings survived CREATE OR REPLACE. Expect exactly two rows,
--    each bound to the like-named function and enabled (`tgenabled = O`).
select t.tgname, p.proname, t.tgenabled
from pg_catalog.pg_trigger t
join pg_catalog.pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and t.tgname in ('trg_feedback_username', 'client_errors_rate_cap_trg')
order by t.tgname;

-- 5. Staging cleanup. Expect staging_schemas = 0.
select pg_catalog.count(*) as staging_schemas
from pg_catalog.pg_namespace n
where n.nspname = 'migration_v2';

-- 6. Erasure body inspection. Expect one row; pg_get_functiondef must show the
--    leaf-first deletes above and `delete from auth.users` as the final DELETE.
select pg_catalog.pg_get_functiondef(p.oid) as delete_own_account_definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_own_account'
  and p.pronargs = 0;

-- 7. Functional erasure check (use a disposable test account only). After the
--    caller invokes the RPC, this admin-side query must return total_rows = 0.
--    Replace the placeholder only after recording the disposable uid.
-- select (
--   (select pg_catalog.count(*) from public.vault_data where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.profiles where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.user_prefs where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.workout_sessions where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.user_exercise_prefs where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.cardio_logs where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.foods where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.food_logs where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.sleep_logs where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.plan_days where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.plan_day_exercises where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.supplements where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.health_prefs where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.exercises where owner_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.cardio_types where owner_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.feedback where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.client_errors where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.user_flags where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from public.admins where user_id = '<uid>'::uuid) +
--   (select pg_catalog.count(*) from auth.users where id = '<uid>'::uuid)
-- ) as total_rows; -- PASS: 0
-- ============================================================================

-- ============================================================================
-- VERIFY 8 -- THE FUNCTIONAL SMOKE TEST. Run as the owner, AFTER committing.
--
-- Add because this file already shipped one defect that every catalog-reading
-- check passed: `pg_catalog.coalesce(...)`. COALESCE is SQL GRAMMAR, not a
-- function -- `select count(*) from pg_proc where proname='coalesce'` returns 0
-- on this server -- so it cannot be schema-qualified. plpgsql only raw-parses a
-- body at CREATE time, so the file applied clean, committed, and passed
-- VERIFY 1-7, and both RPCs would then have thrown on their first real call.
-- admin.html maps an RPC error to [] with no banner, so the console would have
-- shown all eight users at zero and read as "nobody uses the app".
--
-- Reading pg_proc proves a function EXISTS. Only calling it proves it RUNS.
-- Never again verify one of these files without executing what it defines.
--
-- Note: both bodies open with `if not public.is_admin() then raise exception`,
-- and auth.uid() is null for the SQL-editor role, so these are expected to raise
-- 'not authorized'. THAT IS A PASS -- it proves the body parsed and executed.
-- A 42883 "function ... does not exist" or a parse error is a FAIL.
-- ============================================================================
-- select public.admin_user_stats();   -- PASS: raises 'not authorized'
-- select public.admin_activity();     -- PASS: raises 'not authorized'
-- select public.delete_own_account(); -- PASS: raises 'not authenticated'
