-- ============================================================================
-- ban-rls.sql  —  make the account ban REAL at the database layer.
-- ============================================================================
-- Today enforceAccountStatus() only paints a removable DOM overlay and bootSync
-- runs first, so a banned/disabled user keeps full RLS read/write. This adds a
-- server-side gate that RLS enforces regardless of the client.
--
-- Uses RESTRICTIVE policies: they are AND-ed with the existing permissive
-- owner policies, so a NORMAL user (is_banned()=false → `not false`=true) is
-- completely unaffected, and only a banned/disabled user is blocked. It never
-- edits or drops the existing policies — additive and low-risk.
--
-- Scope: block WRITES (insert/update) of the vault_data blob + feedback inserts.
-- Reads/deletes stay allowed so a blocked user can still export or erase their
-- own data (GDPR). Idempotent. Apply in the Supabase SQL editor.
-- ============================================================================

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_flags
    where user_id = auth.uid()
      and status in ('banned', 'disabled')
  );
$$;
revoke all on function public.is_banned() from public, anon;
grant execute on function public.is_banned() to authenticated;

-- vault_data: a blocked user cannot WRITE their blob (no sync), but can still
-- read/delete it (export / erasure).
drop policy if exists vault_data_ban_insert on public.vault_data;
create policy vault_data_ban_insert on public.vault_data
  as restrictive for insert to authenticated
  with check (not public.is_banned());

drop policy if exists vault_data_ban_update on public.vault_data;
create policy vault_data_ban_update on public.vault_data
  as restrictive for update to authenticated
  using (not public.is_banned())
  with check (not public.is_banned());

-- feedback: a blocked user cannot spam the inbox.
drop policy if exists feedback_ban_insert on public.feedback;
create policy feedback_ban_insert on public.feedback
  as restrictive for insert to authenticated
  with check (not public.is_banned());

-- ============================================================================
-- Storage: lower the exercise-images per-file cap from 5MB toward the client's
-- real output (512KB) — raises an attacker's cost to fill the free-tier bucket.
-- ============================================================================
update storage.buckets set file_size_limit = 524288 where id = 'exercise-images';

-- ============================================================================
-- VERIFY:
--   select public.is_banned();  -- false for a normal user
--   select polname from pg_policies where tablename='vault_data' and polname like '%ban%';
--   select id, file_size_limit from storage.buckets where id='exercise-images';  -- 524288
-- ============================================================================
