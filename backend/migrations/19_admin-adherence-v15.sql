-- ============================================================================
-- 19_admin-adherence-v15.sql — the numbers the Console design asks for.
-- APPLIED + VERIFIED live 2026-08-30.
--
-- The Console design (Claude Design "Vault Admin.dc.html") is built around two
-- numbers that did not exist: "الالتزام هذا الأسبوع" (adherence) and
-- "المتعثّرون" (< 50% of their plan). Computing them in the browser would mean
-- downloading every user's whole blob (~42 KB each) to count dates — the design
-- itself says "مئات متوقّعة", so this belongs in SQL.
--
-- WEEK STARTS SATURDAY, per the design's own copy ("الأسبوع من السبت"):
--   current_date - ((dow + 1) % 7)   -- dow: Sun=0 … Sat=6
-- Sat→0 back, Sun→1, Fri→6. Verified live: 2026-08-30 → 2026-08-29.
--
-- Return type changes, so DROP then CREATE — CREATE OR REPLACE cannot change a
-- function's output columns.
--
-- THE COUNT IS DISTINCT DATES, NOT ROWS. The blob stores one session row PER
-- EXERCISE, so counting rows would read a 5-exercise workout as five days
-- trained and peg every user at 100% adherence.
-- ============================================================================

drop function if exists public.admin_user_stats();

create function public.admin_user_stats()
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
  with sat as (select (current_date - ((extract(dow from current_date)::int + 1) % 7))::date as d),
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
    (select count(distinct sess.d) from sess, sat
       where sess.uid = v.uid and sess.d >= sat.d),
    coalesce(jsonb_array_length(case when jsonb_typeof(v.data#>'{plan,trainingDays}')='array'
        then v.data#>'{plan,trainingDays}' else '[]'::jsonb end), 0),
    (select string_agg(c.val->>'name', '/' order by ord)
       from jsonb_array_elements(case when jsonb_typeof(v.data#>'{plan,cycle}')='array'
         then v.data#>'{plan,cycle}' else '[]'::jsonb end) with ordinality c(val, ord))
  from v;
end;
$$;

-- VERIFY — the function must RUN, not merely exist. A plpgsql body only
-- raw-parses at CREATE time (see the pg_catalog.coalesce trap that migration 16
-- nearly shipped), so reading pg_proc proves nothing. The migration role is NOT
-- an admin, so a correct function raises exactly 'not authorized'; a missing
-- column or bad cast raises something else and fails here.
do $$
begin
  perform count(*) from public.admin_user_stats();
  raise exception 'VERIFY failed: the is_admin() guard did not fire';
exception
  when raise_exception then
    if sqlerrm <> 'not authorized' then raise; end if;
    raise notice 'VERIFY ok: body executed, guard fired as designed';
end $$;
