-- ============================================================================
-- 23_admin-week-sunday-v19.sql — the Console counts the SAME week as the app.
--
-- Migration 19 anchored the adherence week on SATURDAY ("الأسبوع من السبت", the
-- Console design's copy). The app has ONE week start since v298 — storage.js
-- WEEK_START = 0, Sunday — used by every strip, the planner, the calendar and
-- the "this week" statistics. Until this file the owner could see a user at
-- "2 / 5" in the Console and the same user at "0 / 5" on his own Program tab
-- on the same morning: two definitions of "this week".
--
-- Only the week anchor changes:
--   was:  current_date - ((dow + 1) % 7)   -- Sat→0 back, Sun→1 … Fri→6
--   now:  current_date -  dow              -- Sun→0 back, Mon→1 … Sat→6
-- The function BODY is 19's, verbatim, except that anchor. The FILE differs from
-- 19 in three more ways, none cosmetic:
--   1. CREATE OR REPLACE, not DROP + CREATE — atomic, and it keeps the ACL.
--   2. It re-issues the revoke/grant pair. 19 used DROP + a bare CREATE, and a
--      DROP DISCARDS THE ACL: Postgres re-granted EXECUTE to PUBLIC/anon on the
--      new function, silently undoing the double-lock 14 and 16 had put there.
--      Nothing leaked — is_admin() still raised 'not authorized' — but the
--      defence-in-depth was gone from 19's apply until this file's. That is the
--      repair, not boilerplate; check-contracts #28 now refuses a migration that
--      drops a locked function without re-locking it.
--   3. It ENDS BY CALLING the function (backend/README.md's rule), which 19 did
--      and the first draft of this file only suggested in a comment.
-- Idempotent.
-- ============================================================================

create or replace function public.admin_user_stats()
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
  with wk as (select (current_date - extract(dow from current_date)::int)::date as d),   -- Sunday, like the app's WEEK_START
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
       where sess.uid = v.uid and sess.d >= wk.d),
    coalesce(jsonb_array_length(case when jsonb_typeof(v.data#>'{plan,trainingDays}')='array'
        then v.data#>'{plan,trainingDays}' else '[]'::jsonb end), 0),
    (select string_agg(c.val->>'name', '/' order by ord)
       from jsonb_array_elements(case when jsonb_typeof(v.data#>'{plan,cycle}')='array'
         then v.data#>'{plan,cycle}' else '[]'::jsonb end) with ordinality c(val, ord))
  from v;
end;
$$;

revoke all on function public.admin_user_stats() from public, anon;
grant execute on function public.admin_user_stats() to authenticated;

-- VERIFY — the function must RUN, not merely exist: a plpgsql body only
-- raw-parses at CREATE time, so reading pg_proc proves nothing (migration 16's
-- pg_catalog.coalesce trap). The migration role is not an admin, so a correct
-- function raises exactly 'not authorized'; a bad cast or a missing column
-- raises something else and FAILS here. `when others` would have swallowed both.
do $$
begin
  perform count(*) from public.admin_user_stats();
  raise exception 'VERIFY failed: the is_admin() guard did not fire';
exception
  when raise_exception then
    if sqlerrm <> 'not authorized' then raise; end if;
    raise notice 'VERIFY ok: body executed, guard fired as designed';
end $$;

-- and the anchor it now uses, for the record:
select (current_date - extract(dow from current_date)::int)::date as week_start_sunday;
