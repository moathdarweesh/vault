-- ============================================================================
-- 25_admin-week-client-v21.sql — the Console's numbers and its own label cover
-- the SAME seven days, in the OWNER'S timezone.
--
-- 23 moved the adherence week to Sunday, matching the app's WEEK_START. It left
-- one seam: the SQL anchors on `current_date`, which is UTC, while admin.html's
-- weekLabel() and the plan-vs-done grid anchor on the BROWSER's local date. In
-- Saudi Arabia (UTC+3) every Sunday between 00:00 and 03:00 local it is still
-- Saturday in UTC, so for those three hours the panel's "this week" figures
-- covered the PREVIOUS week while the caption above them named the new one.
--
-- Two changes, both small:
--   1. `p_week_start date default null` — the client passes the week start it is
--      already displaying (admin.html weekStartDate()); with no argument the
--      function falls back to the UTC Sunday, so any other caller is unchanged.
--   2. an UPPER bound (`< week_start + 7`). Without it a session dated in the
--      FUTURE (the app allows a future-dated plan day) counted toward "this
--      week" forever.
--
-- Signature change, so this is DROP + CREATE, not CREATE OR REPLACE — and a
-- DROP DISCARDS THE FUNCTION'S ACL. Postgres then grants EXECUTE to PUBLIC on
-- the new function, which is precisely how 19 silently undid the double-lock
-- that 14 and 16 had put in place (nothing leaked — `is_admin()` still raised —
-- but the defence-in-depth was gone until 23 restored it). The revoke/grant
-- pair below is therefore NOT optional boilerplate; it is the repair, and
-- check-contracts #28 now refuses a migration that drops a locked function
-- without re-locking it. Idempotent.
-- ============================================================================

drop function if exists public.admin_user_stats();
drop function if exists public.admin_user_stats(date);

create function public.admin_user_stats(p_week_start date default null)
returns table(user_id uuid, sessions bigint, sets bigint, volume numeric,
              foods bigint, sleeps bigint, cardio bigint, custom bigint,
              last_session date,
              week_done bigint, training_days int, plan_name text)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  -- the caller's Sunday when it sends one, else the UTC Sunday (the app's WEEK_START)
  with wk as (select coalesce(p_week_start, (current_date - extract(dow from current_date)::int)::date) as d),
  v as (select vd.user_id as uid, vd.data from public.vault_data vd),
  sess as (
    select v.uid, s.val as s,
           case when (s.val->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (s.val->>'date')::date end as d
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
    (select max(sess.d) from sess where sess.uid = v.uid),
    (select count(distinct sess.d) from sess, wk
       where sess.uid = v.uid and sess.d >= wk.d and sess.d < wk.d + 7),
    coalesce(jsonb_array_length(case when jsonb_typeof(v.data#>'{plan,trainingDays}')='array'
        then v.data#>'{plan,trainingDays}' else '[]'::jsonb end), 0),
    (select string_agg(c.val->>'name', '/' order by ord)
       from jsonb_array_elements(case when jsonb_typeof(v.data#>'{plan,cycle}')='array'
         then v.data#>'{plan,cycle}' else '[]'::jsonb end) with ordinality c(val, ord))
  from v;
end;
$$;

revoke all on function public.admin_user_stats(date) from public, anon;
grant execute on function public.admin_user_stats(date) to authenticated;

-- VERIFY — the function must RUN, not merely exist: a plpgsql body only
-- raw-parses at CREATE time, so reading pg_proc proves nothing (migration 16's
-- pg_catalog.coalesce trap). The migration role is not an admin, so a correct
-- function raises exactly 'not authorized'; anything else fails here.
do $$
begin
  perform count(*) from public.admin_user_stats();                    -- default argument
  raise exception 'VERIFY failed: the is_admin() guard did not fire';
exception
  when raise_exception then
    if sqlerrm <> 'not authorized' then raise; end if;
    raise notice 'VERIFY ok (default arg): body executed, guard fired as designed';
end $$;

do $$
begin
  perform count(*) from public.admin_user_stats('2026-09-06'::date);  -- explicit week start
  raise exception 'VERIFY failed: the is_admin() guard did not fire';
exception
  when raise_exception then
    if sqlerrm <> 'not authorized' then raise; end if;
    raise notice 'VERIFY ok (explicit arg): body executed, guard fired as designed';
end $$;

-- and the ACL the DROP discarded is back:
do $$
begin
  if has_function_privilege('anon', 'public.admin_user_stats(date)', 'execute')
     or has_function_privilege('public', 'public.admin_user_stats(date)', 'execute') then
    raise exception 'VERIFY failed: anon/PUBLIC can still EXECUTE admin_user_stats';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_user_stats(date)', 'execute') then
    raise exception 'VERIFY failed: authenticated lost EXECUTE';
  end if;
  raise notice 'VERIFY ok: EXECUTE is authenticated-only';
end $$;
