-- ============================================================================
-- admin-scale-rpc.sql  —  make the admin console survive 10k users
-- ============================================================================
-- admin.html's loadAll() currently downloads EVERY row of workout_sessions,
-- workout_sets, food_logs, sleep_logs, cardio_logs (millions at scale) into one
-- browser tab and aggregates in JS — it hangs / OOM-crashes on every login.
--
-- These two SECURITY DEFINER RPCs move the heavy aggregation into Postgres and
-- return a per-user rollup (~one row per active user) + a small analytics JSON,
-- so the browser fetches kilobytes. BOTH are gated by is_admin() and RAISE for a
-- non-admin caller — critical, because SECURITY DEFINER bypasses RLS, so without
-- the gate any user could read everyone's stats.
--
-- ADDITIVE + idempotent (create or replace). Apply in the Supabase SQL editor.
-- The admin.html rewrite that CALLS these ships separately; creating them first
-- is harmless (nothing calls them yet).
--
-- PRE-FLIGHT (read-only): confirm is_admin() exists and you are an admin:
--   select public.is_admin();          -- must return true for the owner
-- ============================================================================


-- 1) Per-user rollup — replaces the client-side counting of the 5 heavy tables --
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
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with
    s as (
      select ws.user_id, count(*)::bigint AS sessions, max(ws.performed_on) AS last_session
      from workout_sessions ws group by ws.user_id
    ),
    st as (
      select ws.user_id, count(*)::bigint AS sets,
             coalesce(sum(x.reps * x.weight), 0)::numeric AS volume
      from workout_sets x join workout_sessions ws on ws.id = x.session_id
      group by ws.user_id
    ),
    f  as (select fl.user_id, count(*)::bigint AS foods  from food_logs   fl group by fl.user_id),
    sl as (select s2.user_id, count(*)::bigint AS sleeps from sleep_logs  s2 group by s2.user_id),
    c  as (select cl.user_id, count(*)::bigint AS cardio from cardio_logs cl group by cl.user_id),
    cx as (select e.owner_id AS user_id, count(*)::bigint AS custom
           from exercises e where e.owner_id is not null group by e.owner_id),
    ids as (
      select user_id from s   union
      select user_id from st  union
      select user_id from f   union
      select user_id from sl  union
      select user_id from c   union
      select user_id from cx
    )
  select
    i.user_id,
    coalesce(s.sessions, 0), coalesce(st.sets, 0), coalesce(st.volume, 0),
    coalesce(f.foods, 0), coalesce(sl.sleeps, 0), coalesce(c.cardio, 0),
    coalesce(cx.custom, 0), s.last_session
  from ids i
  left join s  on s.user_id  = i.user_id
  left join st on st.user_id = i.user_id
  left join f  on f.user_id  = i.user_id
  left join sl on sl.user_id = i.user_id
  left join c  on c.user_id  = i.user_id
  left join cx on cx.user_id = i.user_id;
end;
$$;


-- 2) Global activity analytics — the dashboard numbers that need the heavy tables
create or replace function public.admin_activity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'sess_today', (select count(*) from workout_sessions where performed_on >= current_date),
    'sess_week',  (select count(*) from workout_sessions where performed_on >= current_date - 7),
    'top_ex', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select e.name AS name, coalesce(e.category, 'Other') AS cat, count(*)::int AS n
        from workout_sessions ws join exercises e on e.id = ws.exercise_id
        group by e.name, e.category
        order by n desc
        limit 8
      ) t
    ),
    'cat_dist', (
      select coalesce(jsonb_object_agg(cat, n), '{}'::jsonb) from (
        select coalesce(e.category, 'Other') AS cat, count(*)::int AS n
        from workout_sessions ws join exercises e on e.id = ws.exercise_id
        group by e.category
      ) d
    ),
    'recent', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select ws.user_id, e.name AS ex, coalesce(e.category, 'Other') AS cat, ws.performed_on AS date
        from workout_sessions ws left join exercises e on e.id = ws.exercise_id
        order by ws.performed_on desc nulls last
        limit 12
      ) r
    )
  ) into result;

  return result;
end;
$$;


-- Callable by any signed-in user; the is_admin() gate inside each function is the
-- real authorization (a non-admin call just raises 'not authorized').
grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_activity()   to authenticated;

-- ============================================================================
-- VERIFY (as the owner, after applying):
--   select count(*) from public.admin_user_stats();   -- ~one row per active user
--   select public.admin_activity();                   -- small JSON of analytics
-- As a NON-admin these must raise 'not authorized'.
-- ============================================================================
