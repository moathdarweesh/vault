-- ============================================================================
-- THE VAULT — hardening v8 (ADDITIVE, non-destructive)
--
-- Two small least-privilege fixes surfaced by the 2026-07-25 codebase review.
-- Nothing here drops or rewrites data; it only tightens who may EXECUTE what.
--
-- Apply: paste into the Supabase SQL editor and Run. No "destructive operations"
-- dialog should appear — if one does, STOP and re-read the script.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Revoke the implicit PUBLIC execute grant on the admin aggregate RPCs.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Both functions
-- are SECURITY DEFINER, so they run as the owner; the is_admin() gate inside is
-- the real authorization and a non-admin call already raises 'not authorized'.
-- But defence in depth says the anon role should not even be able to CALL them:
-- with PUBLIC execute, an unauthenticated caller can invoke a definer function
-- and probe its behaviour/error surface. Explicitly revoke PUBLIC and re-grant
-- only to `authenticated` (which is what the app actually uses).
-- ----------------------------------------------------------------------------
revoke execute on function public.admin_user_stats() from public;
revoke execute on function public.admin_activity()   from public;
revoke execute on function public.admin_user_stats() from anon;
revoke execute on function public.admin_activity()   from anon;

grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_activity()   to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Pin search_path on every SECURITY DEFINER function that lacks it.
--
-- A definer function without a pinned search_path resolves unqualified names
-- using the CALLER's search_path, so a caller who can create objects in a schema
-- earlier on that path can shadow a table/function the definer body references
-- and get it executed with the owner's privileges.
--
-- This does not assume which functions are missing it — it finds them and fixes
-- them, so it is safe to re-run and stays correct as functions are added.
-- ----------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                                   -- SECURITY DEFINER only
      and (p.proconfig is null
           or not exists (
             select 1 from unnest(p.proconfig) c where c like 'search\_path=%'
           ))
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
    raise notice 'pinned search_path on %', fn.sig;
  end loop;
end $$;

-- ============================================================================
-- VERIFY (run after applying; both should return zero rows)
-- ============================================================================
-- Any SECURITY DEFINER function still missing a pinned search_path:
--
--   select p.oid::regprocedure as unpinned
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname='public' and p.prosecdef
--     and (p.proconfig is null or not exists (
--       select 1 from unnest(p.proconfig) c where c like 'search\_path=%'));
--
-- Any PUBLIC/anon execute grant left on the admin aggregates:
--
--   select grantee, routine_name
--   from information_schema.routine_privileges
--   where routine_schema='public'
--     and routine_name in ('admin_user_stats','admin_activity')
--     and grantee in ('PUBLIC','anon');
-- ============================================================================
