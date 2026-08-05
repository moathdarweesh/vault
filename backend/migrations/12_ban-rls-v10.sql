-- ============================================================================
-- ban-rls-v10.sql — extend the DB-level ban to the paths ban-rls.sql missed.
-- ============================================================================
-- ban-rls.sql blocked the blob write and feedback inserts. But a banned user
-- could still:
--   * write every NORMALIZED mirror table (js/tables.js projects the whole
--     history across 16 tables on any local change) — so the ban stopped the
--     blob but not the 16 tables that shadow it;
--   * upload into the exercise-images storage bucket;
--   * set/change their public @handle.
--
-- Same technique as before: RESTRICTIVE policies AND-ed onto the existing
-- permissive owner policies. A normal user (is_banned() = false) is completely
-- unaffected. Nothing is dropped or rewritten. Idempotent — safe to re-run.
--
-- Reads and DELETEs stay allowed everywhere, so a blocked user can still export
-- and erase their own data (GDPR).
--
-- Apply in the Supabase SQL editor. Expect no "destructive operations" dialog;
-- the only drops are `drop policy if exists` guards.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mirror tables — block INSERT and UPDATE for a banned user.
--
-- Written as a loop over the real table list so it stays correct if a table is
-- added later, and so we do not hand-maintain 16 near-identical policy pairs.
-- Only tables that actually have a user_id column are touched.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  mirror_tables text[] := array[
    'workout_sessions', 'workout_sets', 'cardio_logs', 'food_logs', 'sleep_logs',
    'plan_days', 'plan_day_exercises', 'supplements', 'supplement_logs',
    'user_exercise_prefs', 'user_cardio_types', 'user_foods', 'health_prefs',
    'body_weight', 'water_logs', 'nutrition_targets'
  ];
begin
  foreach t in array mirror_tables loop
    -- skip anything that does not exist in this project
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_ban_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check (not public.is_banned())', t || '_ban_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_ban_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
         using (not public.is_banned()) with check (not public.is_banned())',
      t || '_ban_update', t);

    raise notice 'ban policies applied to %', t;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Storage — a banned user cannot upload new objects.
--
-- Restrictive policy on storage.objects scoped to the exercise-images bucket, so
-- it cannot affect any other bucket. Reads/deletes remain allowed (export/erase).
-- ----------------------------------------------------------------------------
drop policy if exists exercise_images_ban_insert on storage.objects;
create policy exercise_images_ban_insert on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'exercise-images' or not public.is_banned());

drop policy if exists exercise_images_ban_update on storage.objects;
create policy exercise_images_ban_update on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'exercise-images' or not public.is_banned())
  with check (bucket_id <> 'exercise-images' or not public.is_banned());

-- ----------------------------------------------------------------------------
-- 3. Profiles — a banned user cannot change their public handle (evading a
--    report by re-branding). Row reads and the rest of the profile are untouched.
-- ----------------------------------------------------------------------------
drop policy if exists profiles_ban_update on public.profiles;
create policy profiles_ban_update on public.profiles
  as restrictive for update to authenticated
  using (not public.is_banned())
  with check (not public.is_banned());

-- ============================================================================
-- NOTE ON THE AI WORKER
-- The Cloudflare Worker cannot be gated by RLS — it is not Postgres. It now
-- validates the caller's JWT and rate-limits per user (backend/gemini-worker.js,
-- callerAllowed + rateLimited). To refuse banned users there too, the Worker
-- would need to read user_flags via the anon key; that is a deliberate follow-up,
-- not part of this migration. Until then the AI endpoint stays reachable by a
-- banned-but-authenticated account, capped at the same rate limit as everyone.
-- ============================================================================

-- ============================================================================
-- VERIFY (after applying)
--
--   -- every restrictive ban policy now in place:
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname in ('public','storage') and policyname like '%_ban_%'
--   order by tablename, cmd;
--
--   -- a NORMAL user must be unaffected: is_banned() = false
--   select public.is_banned();
-- ============================================================================
