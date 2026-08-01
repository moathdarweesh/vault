-- ============================================================================
-- THE VAULT — admin dashboard + unique usernames (ADDITIVE, idempotent)
-- ============================================================================
-- Run in the Supabase SQL editor. Adds:
--   1. profiles.username — a unique, case-insensitive public handle each user sets.
--   2. A public.admins registry + is_admin() so the OWNER (and only the owner)
--      can read ALL users' rows for the admin dashboard — WITHOUT ever shipping a
--      service_role key to any client. The admin's own JWT unlocks the access via
--      RLS; the anon key alone still sees nothing.
--   3. username_available() RPC for live "is this handle taken?" checks.
-- Does NOT touch vault_data, auth.users, or any existing data. Safe to re-run.
-- ============================================================================

create extension if not exists citext;

-- ---- 1. Username handle -----------------------------------------------------
alter table public.profiles add column if not exists username citext;

-- Unique (case-insensitive), but many users may still be NULL (not set yet).
create unique index if not exists profiles_username_key
  on public.profiles (username) where username is not null;

-- Shape: 3–20 chars, letters/digits/underscore only.
do $$ begin
  alter table public.profiles
    add constraint profiles_username_shape
    check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;

-- ---- 2. Admin registry + gate ----------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- A user may see only their OWN admin row; nobody writes this table via the
-- client (managed by the owner in SQL). No insert/update/delete policy = denied.
drop policy if exists admins_select_self on public.admins;
create policy admins_select_self on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- is_admin(): SECURITY DEFINER so it can read public.admins past its own RLS.
-- search_path pinned to '' and every name fully-qualified (injection-safe).
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins a where a.user_id = auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---- 3. Admin READ policies (additive; OR-combined with own-data policies) --
-- Each table already has an own-data SELECT policy. Postgres OR-combines
-- permissive policies, so this ADDS "…or I'm the admin" without touching the
-- existing rules. Admins get READ only — never write — to every user's rows.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_prefs','exercises','user_exercise_prefs',
    'workout_sessions','workout_sets','cardio_types','cardio_logs',
    'foods','food_logs','sleep_logs','plan_days','plan_day_exercises',
    'supplements','supplement_logs','health_prefs'
  ] loop
    execute format('drop policy if exists %I on public.%I;', t || '_admin_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin());',
      t || '_admin_read', t);
  end loop;
end $$;

-- ---- 4. username_available() — live availability check ----------------------
create or replace function public.username_available(candidate citext)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = candidate);
$$;
revoke all on function public.username_available(citext) from public;
grant execute on function public.username_available(citext) to authenticated;

-- ---- 5. Make the owner an admin --------------------------------------------
insert into public.admins (user_id)
values ('e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2')
on conflict do nothing;

-- ---- verify (optional) ------------------------------------------------------
-- select public.is_admin();                         -- expect true when run as the owner
-- select count(*) as all_profiles from public.profiles;  -- admin sees every user
