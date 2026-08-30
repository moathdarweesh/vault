-- ============================================================================
-- 18_drop-mirror-v14.sql — remove the one-way analytics mirror (owner decision)
--
-- WHY: the mirror was a projection of vault_data into 13 normalized tables,
-- re-uploaded after every local edit. It was broken for its main table
-- (workout_sessions held 1 row across all users while the owner's blob holds
-- 152 sessions), carried a documented delete-hazard class that misfired once
-- historically, and its only consumer was admin.html. The blob IS the truth;
-- the admin now reads it directly under a new is_admin() SELECT policy.
--
-- ORDER MATTERS: three live functions name these tables in their bodies.
-- plpgsql binds table names at CALL time, so dropping the tables first would
-- leave delete_own_account() throwing on every account deletion. Functions are
-- rewritten FIRST, in the same transaction as the drops.
--
-- Both jsonb query cores below were dry-run against the live vault_data rows
-- before being baked in (owner: 152 sessions / 417 sets / volume 166,161).
-- ============================================================================

-- ---- 1. the admin's new window: read blobs directly ------------------------
drop policy if exists vault_data_admin_read on public.vault_data;
create policy vault_data_admin_read on public.vault_data
  for select using (public.is_admin());

-- ---- 2. delete_own_account: only surviving tables --------------------------
-- feedback is DELETED here (not left user_id-null): the function has always
-- deleted it, and privacy.html documents deletion accordingly. The one thing
-- that survives an account deletion is audit_log (no auth.users FK): the
-- admin action log, retained for security, holds no account data.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.feedback      where user_id = uid;
  delete from public.client_errors where user_id = uid;

  -- Caller-owned catalog rows. Nothing references them any more: the mirror
  -- tables that once pointed at exercises/cardio_types are dropped below.
  delete from public.exercises     where owner_id = uid;
  delete from public.cardio_types  where owner_id = uid;

  delete from public.profiles      where user_id = uid;
  delete from public.user_flags    where user_id = uid;
  delete from public.admins        where user_id = uid;
  delete from public.vault_data    where user_id = uid;

  -- Last by design: after this succeeds, no account remains even if the client
  -- later fails to sweep non-transactional Storage objects.
  delete from auth.users where id = uid;
end;
$$;

-- ---- 3. admin_user_stats: same signature, computed from the blobs ----------
create or replace function public.admin_user_stats()
returns table(user_id uuid, sessions bigint, sets bigint, volume numeric,
              foods bigint, sleeps bigint, cardio bigint, custom bigint,
              last_session date)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with v as (select vd.user_id as uid, vd.data from public.vault_data vd),
  sess as (
    select v.uid, s.val as s
    from v, lateral jsonb_array_elements(
      case when jsonb_typeof(v.data->'sessions')='array' then v.data->'sessions' else '[]'::jsonb end
    ) as s(val)
  ),
  sets as (
    select sess.uid,
           coalesce((x.val->>'reps')::numeric, 0)   as reps,
           coalesce((x.val->>'weight')::numeric, 0) as weight
    from sess, lateral jsonb_array_elements(
      case when jsonb_typeof(sess.s->'sets')='array' then sess.s->'sets' else '[]'::jsonb end
    ) as x(val)
  )
  select v.uid,
    (select count(*) from sess where sess.uid = v.uid),
    (select count(*) from sets where sets.uid = v.uid),
    (select coalesce(sum(reps * weight), 0) from sets where sets.uid = v.uid),
    (select coalesce(sum(jsonb_array_length(d.value)), 0)
       from jsonb_each(case when jsonb_typeof(v.data->'foodLogs')='object' then v.data->'foodLogs' else '{}'::jsonb end) d
       where jsonb_typeof(d.value) = 'array'),
    (case when jsonb_typeof(v.data->'sleep')='array'  then jsonb_array_length(v.data->'sleep')  else 0 end)::bigint,
    (case when jsonb_typeof(v.data->'cardio')='array' then jsonb_array_length(v.data->'cardio') else 0 end)::bigint,
    (select count(*) from jsonb_array_elements(
       case when jsonb_typeof(v.data->'exercises')='array' then v.data->'exercises' else '[]'::jsonb end) e
       where (e.value->>'isCustom')::boolean is true),
    (select max(sess.s->>'date')::date from sess where sess.uid = v.uid)
  from v;
end;
$$;

-- ---- 4. admin_activity: same result keys, computed from the blobs ----------
-- Exercise names resolve within EACH user's own blob (local ids differ from
-- the global catalog for seed exercises — the very mismatch that broke the
-- mirror's projection is simply not a problem when the blob names itself).
create or replace function public.admin_activity()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with v as (select vd.user_id as uid, vd.data from public.vault_data vd),
  sess as (
    select v.uid, s.val->>'exerciseId' as ex_id, s.val->>'date' as d
    from v, lateral jsonb_array_elements(
      case when jsonb_typeof(v.data->'sessions')='array' then v.data->'sessions' else '[]'::jsonb end) s(val)
  ),
  ex as (
    select v.uid, e.val->>'id' as id, e.val->>'name' as name,
           coalesce(e.val->>'category', 'Other') as cat
    from v, lateral jsonb_array_elements(
      case when jsonb_typeof(v.data->'exercises')='array' then v.data->'exercises' else '[]'::jsonb end) e(val)
  ),
  j as (
    select sess.uid, sess.d, coalesce(ex.name, '—') as name, coalesce(ex.cat, 'Other') as cat
    from sess left join ex on ex.uid = sess.uid and ex.id = sess.ex_id
  )
  select jsonb_build_object(
    'sess_today', (select count(*) from j where j.d >= current_date::text),
    'sess_week',  (select count(*) from j where j.d >= (current_date - 7)::text),
    'top_ex', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select j.name, j.cat, count(*)::int as n from j group by j.name, j.cat
        order by n desc limit 8) t),
    'cat_dist', (select coalesce(jsonb_object_agg(dd.cat, dd.n), '{}'::jsonb) from (
        select j.cat, count(*)::int as n from j group by j.cat) dd),
    'recent', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select j.uid as user_id, j.name as ex, j.cat, j.d as date from j
        order by j.d desc nulls last limit 12) r)
  ) into result;

  return result;
end;
$$;

-- ---- 5. drop the mirror, children before parents ---------------------------
drop table if exists public.workout_sets;
drop table if exists public.workout_sessions;
drop table if exists public.cardio_logs;
drop table if exists public.supplement_logs;
drop table if exists public.supplements;
drop table if exists public.food_logs;
drop table if exists public.foods;
drop table if exists public.sleep_logs;
drop table if exists public.plan_day_exercises;
drop table if exists public.plan_days;
drop table if exists public.user_exercise_prefs;
drop table if exists public.user_prefs;
drop table if exists public.health_prefs;

-- ---- VERIFY ----------------------------------------------------------------
do $$
declare
  remaining int;
  pol int;
begin
  select count(*) into remaining from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('workout_sets','workout_sessions','cardio_logs',
      'supplement_logs','supplements','food_logs','foods','sleep_logs',
      'plan_day_exercises','plan_days','user_exercise_prefs','user_prefs','health_prefs');
  if remaining <> 0 then
    raise exception 'VERIFY failed: % mirror tables still exist', remaining;
  end if;

  select count(*) into pol from pg_policy
  where polrelid = 'public.vault_data'::regclass and polname = 'vault_data_admin_read';
  if pol <> 1 then
    raise exception 'VERIFY failed: vault_data_admin_read policy missing';
  end if;
end $$;
