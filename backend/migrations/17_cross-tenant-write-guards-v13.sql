-- ============================================================================
-- 17_cross-tenant-write-guards-v13.sql
--
-- Prevents caller-owned rows from referencing another user's custom exercise
-- or cardio type. Global catalog rows (owner_id IS NULL) remain valid for every
-- authenticated user. Also installs the still-needed global session-date index
-- and hardens the existing 30-day client-error retention RPC now invoked by the
-- admin console.
--
-- NOT YET APPLIED. Run the read-only pre-flight below separately, review every
-- result, take the backup required by backend/README.md, then apply this file in
-- the Supabase SQL editor. This file intentionally performs no data cleanup.
-- ============================================================================

-- ============================================================================
-- PRE-FLIGHT (READ ONLY; run and review BEFORE applying this file)
-- ============================================================================

-- 1. RLS baseline. Expect all four tables with relrowsecurity = true. Expect
--    the eight named own-write policies (INSERT + UPDATE) to be PERMISSIVE.
select c.relname as table_name, c.relrowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'workout_sessions', 'cardio_logs',
    'user_exercise_prefs', 'plan_day_exercises'
  )
order by c.relname;

select p.tablename, p.policyname, p.cmd, p.permissive, p.qual, p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.policyname in (
    'workout_sessions_insert_own', 'workout_sessions_update_own',
    'cardio_logs_insert_own', 'cardio_logs_update_own',
    'uxp_insert_own', 'uxp_update_own',
    'plan_day_ex_insert_own', 'plan_day_ex_update_own'
  )
order by p.tablename, p.cmd;

-- 2. Data invariant. PASS only when every count is zero. A non-zero result
--    means STOP: investigate and clean the rows explicitly before applying.
select
  (
    select pg_catalog.count(*)
    from public.workout_sessions ws
    join public.exercises e on e.id = ws.exercise_id
    where e.owner_id is not null and e.owner_id <> ws.user_id
  ) as cross_tenant_sessions,
  (
    select pg_catalog.count(*)
    from public.cardio_logs cl
    join public.cardio_types ct on ct.id = cl.cardio_type_id
    where ct.owner_id is not null and ct.owner_id <> cl.user_id
  ) as cross_tenant_cardio_logs,
  (
    select pg_catalog.count(*)
    from public.user_exercise_prefs uxp
    join public.exercises e on e.id = uxp.exercise_id
    where e.owner_id is not null and e.owner_id <> uxp.user_id
  ) as cross_tenant_exercise_prefs,
  (
    select pg_catalog.count(*)
    from public.plan_day_exercises pde
    join public.exercises e on e.id = pde.exercise_id
    where e.owner_id is not null and e.owner_id <> pde.user_id
  ) as cross_tenant_plan_exercises;

-- 3. Parent lookup cost. Expect both PK indexes to resolve non-NULL. Each new
--    EXISTS is therefore one indexed catalog-id lookup per inserted/updated row.
select
  pg_catalog.to_regclass('public.exercises_pkey') as exercises_lookup_index,
  pg_catalog.to_regclass('public.cardio_types_pkey') as cardio_types_lookup_index;

-- 4. Session-date index state. The live pre-flight reported NULL; if it now
--    exists, review its definition before proceeding (the CREATE below is safe
--    and idempotent, but a conflicting same-name definition needs attention).
select pg_catalog.to_regclass('public.workout_sessions_performed_idx')
  as workout_sessions_performed_idx;

-- 5. Retention baseline. Expect exactly one postgres-owned SECURITY DEFINER
--    function with integer arguments and one default. old_rows is informational:
--    the admin console will prune it after this migration is applied.
select p.proname,
       pg_catalog.pg_get_userbyid(p.proowner) as owner,
       p.prosecdef,
       p.pronargs,
       p.pronargdefaults,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_prune_client_errors';

select pg_catalog.count(*) as client_errors_older_than_30_days
from public.client_errors ce
where ce.created_at < pg_catalog.now() - interval '30 days';

-- ============================================================================
-- APPLY
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Cross-tenant catalog-reference guards.
--
-- These are RESTRICTIVE policies by design. The existing PERMISSIVE own-row
-- policies continue to prove auth.uid() = user_id; these policies add a separate
-- invariant that every current or future permissive write path must also pass.
-- That avoids copying ownership logic into four baseline policies and prevents a
-- later permissive policy from OR-bypassing the catalog-ownership check.
--
-- INSERT checks the proposed parent. UPDATE checks both the existing row (USING)
-- and the proposed row (WITH CHECK), so an update cannot move a valid row onto
-- another user's custom parent. SELECT and DELETE are intentionally unchanged.
-- ----------------------------------------------------------------------------

-- Block concurrent writes until the policies are installed, then refuse to
-- install them over unreviewed legacy violations. SHARE ROW EXCLUSIVE conflicts
-- with the ROW EXCLUSIVE lock taken by INSERT/UPDATE/DELETE while still allowing
-- ordinary reads, closing the race after the separate pre-flight.
lock table public.workout_sessions,
           public.cardio_logs,
           public.user_exercise_prefs,
           public.plan_day_exercises
  in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.workout_sessions ws
    join public.exercises e on e.id = ws.exercise_id
    where e.owner_id is not null and e.owner_id <> ws.user_id
  ) then
    raise exception 'cross-tenant workout_sessions references exist; stop and clean them explicitly';
  end if;

  if exists (
    select 1
    from public.cardio_logs cl
    join public.cardio_types ct on ct.id = cl.cardio_type_id
    where ct.owner_id is not null and ct.owner_id <> cl.user_id
  ) then
    raise exception 'cross-tenant cardio_logs references exist; stop and clean them explicitly';
  end if;

  if exists (
    select 1
    from public.user_exercise_prefs uxp
    join public.exercises e on e.id = uxp.exercise_id
    where e.owner_id is not null and e.owner_id <> uxp.user_id
  ) then
    raise exception 'cross-tenant user_exercise_prefs references exist; stop and clean them explicitly';
  end if;

  if exists (
    select 1
    from public.plan_day_exercises pde
    join public.exercises e on e.id = pde.exercise_id
    where e.owner_id is not null and e.owner_id <> pde.user_id
  ) then
    raise exception 'cross-tenant plan_day_exercises references exist; stop and clean them explicitly';
  end if;
end
$$;

drop policy if exists workout_sessions_catalog_insert_guard on public.workout_sessions;
create policy workout_sessions_catalog_insert_guard on public.workout_sessions
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1
      from public.exercises e
      where e.id = workout_sessions.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

drop policy if exists workout_sessions_catalog_update_guard on public.workout_sessions;
create policy workout_sessions_catalog_update_guard on public.workout_sessions
  as restrictive for update to authenticated
  using (
    exists (
      select 1
      from public.exercises e
      where e.id = workout_sessions.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.exercises e
      where e.id = workout_sessions.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

drop policy if exists cardio_logs_catalog_insert_guard on public.cardio_logs;
create policy cardio_logs_catalog_insert_guard on public.cardio_logs
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1
      from public.cardio_types ct
      where ct.id = cardio_logs.cardio_type_id
        and (ct.owner_id is null or ct.owner_id = (select auth.uid()))
    )
  );

drop policy if exists cardio_logs_catalog_update_guard on public.cardio_logs;
create policy cardio_logs_catalog_update_guard on public.cardio_logs
  as restrictive for update to authenticated
  using (
    exists (
      select 1
      from public.cardio_types ct
      where ct.id = cardio_logs.cardio_type_id
        and (ct.owner_id is null or ct.owner_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.cardio_types ct
      where ct.id = cardio_logs.cardio_type_id
        and (ct.owner_id is null or ct.owner_id = (select auth.uid()))
    )
  );

drop policy if exists uxp_catalog_insert_guard on public.user_exercise_prefs;
create policy uxp_catalog_insert_guard on public.user_exercise_prefs
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1
      from public.exercises e
      where e.id = user_exercise_prefs.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

drop policy if exists uxp_catalog_update_guard on public.user_exercise_prefs;
create policy uxp_catalog_update_guard on public.user_exercise_prefs
  as restrictive for update to authenticated
  using (
    exists (
      select 1
      from public.exercises e
      where e.id = user_exercise_prefs.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.exercises e
      where e.id = user_exercise_prefs.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

drop policy if exists plan_day_ex_catalog_insert_guard on public.plan_day_exercises;
create policy plan_day_ex_catalog_insert_guard on public.plan_day_exercises
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1
      from public.exercises e
      where e.id = plan_day_exercises.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

drop policy if exists plan_day_ex_catalog_update_guard on public.plan_day_exercises;
create policy plan_day_ex_catalog_update_guard on public.plan_day_exercises
  as restrictive for update to authenticated
  using (
    exists (
      select 1
      from public.exercises e
      where e.id = plan_day_exercises.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.exercises e
      where e.id = plan_day_exercises.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Global workout-session date access.
--
-- js/tables.js only writes/reconciles workout_sessions; it has no date read that
-- benefits from this index. admin.html's per-user detail query is already served
-- by workout_sessions_user_date_idx (user_id, performed_on DESC). The current
-- admin_activity() RPC still has the uncovered global patterns: two range counts
-- on performed_on and ORDER BY performed_on DESC LIMIT 12. A standalone date
-- index is therefore still justified. At the confirmed live scale, a normal
-- transactional build is brief; CONCURRENTLY would require a separate apply.
-- ----------------------------------------------------------------------------
create index if not exists workout_sessions_performed_idx
  on public.workout_sessions (performed_on desc);

-- ----------------------------------------------------------------------------
-- 3. Client-error retention.
--
-- pg_cron availability varies by Supabase plan/project configuration, so this
-- migration does not pretend a schedule exists. admin.html invokes this RPC once
-- after a successful owner/admin check. Keep the existing admin gate and 30-day
-- default, but replace the weak search path with an empty pin and fully-qualified
-- names before making that call live.
-- ----------------------------------------------------------------------------
create or replace function public.admin_prune_client_errors(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.client_errors ce
  where ce.created_at < pg_catalog.now()
    - pg_catalog.make_interval(days => greatest(p_days, 1));

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_prune_client_errors(integer)
  from public, anon, authenticated;
grant execute on function public.admin_prune_client_errors(integer)
  to authenticated;

commit;

-- ============================================================================
-- VERIFY (READ ONLY; run after applying unless a step says otherwise)
-- ============================================================================

-- 1. Policy shape. Expect exactly 8 rows, all RESTRICTIVE. INSERT policies have
--    a catalog EXISTS in with_check; UPDATE policies have it in qual AND
--    with_check. The original permissive own-row policies must still exist.
select p.tablename, p.policyname, p.cmd, p.permissive, p.qual, p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.policyname in (
    'workout_sessions_catalog_insert_guard',
    'workout_sessions_catalog_update_guard',
    'cardio_logs_catalog_insert_guard',
    'cardio_logs_catalog_update_guard',
    'uxp_catalog_insert_guard',
    'uxp_catalog_update_guard',
    'plan_day_ex_catalog_insert_guard',
    'plan_day_ex_catalog_update_guard'
  )
order by p.tablename, p.cmd;

select p.tablename, p.policyname, p.cmd, p.permissive
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.policyname in (
    'workout_sessions_insert_own', 'workout_sessions_update_own',
    'cardio_logs_insert_own', 'cardio_logs_update_own',
    'uxp_insert_own', 'uxp_update_own',
    'plan_day_ex_insert_own', 'plan_day_ex_update_own'
  )
order by p.tablename, p.cmd;

-- 2. Data invariant remains clean. PASS only when all four counts are zero.
select
  (
    select pg_catalog.count(*)
    from public.workout_sessions ws
    join public.exercises e on e.id = ws.exercise_id
    where e.owner_id is not null and e.owner_id <> ws.user_id
  ) as cross_tenant_sessions,
  (
    select pg_catalog.count(*)
    from public.cardio_logs cl
    join public.cardio_types ct on ct.id = cl.cardio_type_id
    where ct.owner_id is not null and ct.owner_id <> cl.user_id
  ) as cross_tenant_cardio_logs,
  (
    select pg_catalog.count(*)
    from public.user_exercise_prefs uxp
    join public.exercises e on e.id = uxp.exercise_id
    where e.owner_id is not null and e.owner_id <> uxp.user_id
  ) as cross_tenant_exercise_prefs,
  (
    select pg_catalog.count(*)
    from public.plan_day_exercises pde
    join public.exercises e on e.id = pde.exercise_id
    where e.owner_id is not null and e.owner_id <> pde.user_id
  ) as cross_tenant_plan_exercises;

-- 3. Index definition. Expect one row whose definition ends with
--    public.workout_sessions USING btree (performed_on DESC).
select pg_catalog.pg_get_indexdef(c.oid) as index_definition
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'workout_sessions_performed_idx';

-- 4. Retention RPC. Expect one postgres-owned SECURITY DEFINER row with only
--    the empty search_path pin in proconfig. The grants query must return
--    authenticated only (no PUBLIC or anon).
select p.proname,
       pg_catalog.pg_get_userbyid(p.proowner) as owner,
       p.prosecdef,
       p.proconfig,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_prune_client_errors'
  and p.pronargs = 1;

select r.routine_name, r.grantee, r.privilege_type
from information_schema.routine_privileges r
where r.routine_schema = 'public'
  and r.routine_name = 'admin_prune_client_errors'
  and r.grantee in ('PUBLIC', 'anon', 'authenticated')
order by r.grantee;

-- 5. After signing in to admin.html once, expect zero. This query itself is
--    read-only; the preceding admin-console visit is what invokes the prune RPC.
select pg_catalog.count(*) as client_errors_older_than_30_days
from public.client_errors ce
where ce.created_at < pg_catalog.now() - interval '30 days';
-- ============================================================================
