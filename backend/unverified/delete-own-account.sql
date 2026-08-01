-- ============================================================================
-- delete-own-account.sql  —  GDPR / Play "right to erasure": let a signed-in
-- user delete THEIR OWN account and all data, with no admin/service key.
-- ============================================================================
-- Deleting the auth.users row ON DELETE CASCADEs into public.vault_data (the
-- authoritative blob), profiles, user_flags, and every schema-v2 mirror table
-- (all reference auth.users(id) on delete cascade). feedback.user_id is ON
-- DELETE SET NULL, so we clear those rows explicitly first.
--
-- NOT covered by the DB cascade: Storage objects (the exercise-images bucket has
-- no FK to auth.users). The CLIENT sweeps exercise-images/{uid}/ via the Storage
-- API (owner RLS) BEFORE calling this RPC — see Cloud.deleteAccount().
--
-- SECURITY DEFINER so a normal authenticated user can run it; it only ever
-- touches auth.uid()'s own rows. search_path='' (no injection surface).
-- Idempotent (create or replace). Apply in the Supabase SQL editor.
-- ============================================================================

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

  -- feedback FK is ON DELETE SET NULL → remove the user's rows explicitly.
  delete from public.feedback where user_id = uid;

  -- The authoritative blob (also cascades from auth.users, but be explicit).
  delete from public.vault_data where user_id = uid;

  -- Deleting the auth user cascades to profiles, user_flags and every
  -- schema-v2 mirror table that references auth.users(id) on delete cascade.
  delete from auth.users where id = uid;
end;
$$;

-- Only a signed-in user may call it; never anon/public.
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ============================================================================
-- VERIFY (optional, run as a normal user via the app or with a user JWT):
--   select public.delete_own_account();   -- deletes the CALLER's account
-- After it runs, the caller's session becomes invalid and every row keyed to
-- their uid is gone. Confirm with (as admin):
--   select count(*) from public.vault_data where user_id = '<uid>';   -- 0
-- ============================================================================
