-- ============================================================================
-- vault-data-version.sql  —  optimistic concurrency for the whole-blob sync
-- ============================================================================
-- The client's blob push was an unconditional last-writer-wins upsert: a user on
-- two devices (e.g. the PWA + the APK shell) could log on device A, then device B,
-- and B's write silently destroyed A's edits. This adds a monotonic `version`
-- that the DB increments on every UPDATE, so the client can write CONDITIONALLY
-- ("only if the row is still at the version I last saw") and detect — instead of
-- clobber — a concurrent write.
--
-- ADDITIVE + idempotent. Apply in the Supabase SQL editor. Safe to apply BEFORE
-- or AFTER the matching client (v-next): the client treats `version` as optional,
-- so nothing breaks in either order.
-- ============================================================================

alter table public.vault_data
  add column if not exists version bigint not null default 0;

-- Server-authoritative increment: the client never sets version; this bumps it on
-- every UPDATE so two writers can't both land on the same next version.
create or replace function public.bump_vault_data_version()
returns trigger
language plpgsql
as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists trg_vault_data_version on public.vault_data;
create trigger trg_vault_data_version
  before update on public.vault_data
  for each row execute function public.bump_vault_data_version();

-- ============================================================================
-- VERIFY:
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='vault_data' and column_name='version';
--   -- update your own row twice and confirm version increments by 1 each time.
-- ============================================================================
