-- THE VAULT — Supabase setup
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- It creates one table that holds each user's whole app state as a JSON blob,
-- locked down so a user can only ever read/write their OWN row.

create table if not exists public.vault_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: every row is private to its owner.
alter table public.vault_data enable row level security;

drop policy if exists "vault_select_own" on public.vault_data;
create policy "vault_select_own" on public.vault_data
  for select using (auth.uid() = user_id);

drop policy if exists "vault_insert_own" on public.vault_data;
create policy "vault_insert_own" on public.vault_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "vault_update_own" on public.vault_data;
create policy "vault_update_own" on public.vault_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
