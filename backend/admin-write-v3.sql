-- ============================================================================
-- THE VAULT — admin WRITE layer: user management + feedback (ADDITIVE, idempotent)
-- ============================================================================
-- Run in the Supabase SQL editor. Builds on admin-v2.sql (admins + is_admin()).
-- Adds, WITHOUT touching existing data or the read-only admin policies:
--   1. profiles.last_seen — a self-written "last active" timestamp.
--   2. public.user_flags — the roles + account-status store. WRITE-ONLY via the
--      SECURITY DEFINER RPCs below; a user can READ their own row (to enforce a
--      ban locally) but can NEVER write role/status → no privilege escalation.
--   3. public.feedback — a suggestions inbox: any user inserts their own; only
--      admins read/resolve.
--   4. admin_set_role() / admin_set_status() — the only write paths. Each
--      re-checks is_admin() server-side and refuses to act on the caller's own
--      account (no self-lockout / self-ban).
-- Security note: there are deliberately NO client INSERT/UPDATE/DELETE policies
-- on user_flags or admins. All privileged writes go through the definer RPCs,
-- which run past RLS but gate on is_admin(). Safe to re-run.
-- ============================================================================

-- ---- 1. Last-seen on profiles ----------------------------------------------
-- Written by the user on their OWN profiles row (the existing own-row UPDATE
-- policy already permits it). Harmless, non-escalating.
alter table public.profiles add column if not exists last_seen timestamptz;

-- ---- 2. Roles + account status (admin-write-only) --------------------------
create table if not exists public.user_flags (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'user'   check (role   in ('user','coach','admin')),
  status     text not null default 'active' check (status in ('active','disabled','banned')),
  reason     text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.user_flags enable row level security;

-- READ: a user sees only their own row; an admin sees everyone. No write policy
-- exists on purpose → clients can never write this table directly.
drop policy if exists user_flags_select on public.user_flags;
create policy user_flags_select on public.user_flags
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Server-authored updated_at (same shared trigger the schema uses elsewhere).
drop trigger if exists trg_user_flags_touch on public.user_flags;
create trigger trg_user_flags_touch before insert or update on public.user_flags
  for each row execute function public.touch_updated_at();

-- Reads only; writes happen exclusively through the definer RPCs below.
-- Double-lock: revoke Supabase's default auto-grants from EVERY client role, then
-- re-grant only SELECT — so the no-write guarantee doesn't rest on RLS alone.
revoke all on public.user_flags from anon, authenticated, public;
grant select on public.user_flags to authenticated;

-- ---- 3. Feedback / suggestions inbox ---------------------------------------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  username   text,                       -- snapshot at submit time
  message    text not null,
  context    text,                       -- e.g. app version / view
  status     text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

-- A user may INSERT only their own feedback; only admins may read or resolve.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');  -- can't self-resolve
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback
  for select to authenticated using (public.is_admin());
drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.feedback from anon, authenticated, public;
grant select, insert, update on public.feedback to authenticated;

-- ---- 4. The ONLY write paths: admin RPCs (SECURITY DEFINER, is_admin-gated) --
-- admin_set_role: sets a user's role and keeps the admins registry in sync so
-- is_admin() stays authoritative. Refuses to touch the caller's own account.
create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if target = auth.uid() then
    raise exception 'cannot change your own role';
  end if;
  if target = 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2'::uuid then
    raise exception 'the owner account is protected';  -- no admin can demote the founder
  end if;
  if new_role not in ('user','coach','admin') then
    raise exception 'invalid role';
  end if;

  insert into public.user_flags (user_id, role, updated_by)
  values (target, new_role, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role, updated_by = excluded.updated_by;

  if new_role = 'admin' then
    insert into public.admins (user_id) values (target) on conflict do nothing;
  else
    delete from public.admins where user_id = target;
  end if;
end;
$$;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- admin_set_status: activate / disable / ban a user. Refuses self-target.
create or replace function public.admin_set_status(target uuid, new_status text, reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if target = auth.uid() then
    raise exception 'cannot change your own status';
  end if;
  if target = 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2'::uuid then
    raise exception 'the owner account is protected';  -- no admin can ban the founder
  end if;
  if new_status not in ('active','disabled','banned') then
    raise exception 'invalid status';
  end if;

  insert into public.user_flags (user_id, status, reason, updated_by)
  values (target, new_status, reason, auth.uid())
  on conflict (user_id) do update
    set status = excluded.status, reason = excluded.reason, updated_by = excluded.updated_by;
end;
$$;
revoke all on function public.admin_set_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text, text) to authenticated;

-- ---- 5. Harden admins grants + backfill existing admins' role --------------
-- admins is escalation-critical: strip the default auto-grants (writes happen
-- only inside the definer RPC / SQL editor); keep SELECT so admins_select_self
-- works. Then make sure every existing admin has role='admin' in user_flags so
-- the roles view is consistent (the owner was seeded straight into admins).
revoke all on public.admins from anon, authenticated, public;
grant select on public.admins to authenticated;   -- RLS still limits to own row
insert into public.user_flags (user_id, role)
select a.user_id, 'admin' from public.admins a
on conflict (user_id) do update set role = 'admin';

-- ---- verify (optional) ------------------------------------------------------
-- select public.is_admin();                          -- true when run as the owner
-- select count(*) from public.user_flags;            -- admin sees all rows
-- select count(*) from public.feedback;              -- admin-only
-- -- expect an exception (self-target guard):
-- -- select public.admin_set_status('e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2','banned',null);
