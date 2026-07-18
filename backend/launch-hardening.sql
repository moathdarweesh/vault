-- ============================================================================
-- launch-hardening.sql  —  pre-10k-launch safety hardening (ADDITIVE, SAFE)
-- ============================================================================
-- Apply in the Supabase SQL editor. Every statement here is additive and
-- idempotent (guarded with "if exists" / "or replace"); it adds NO destructive
-- operation, alters no existing column, and cannot lock any user out. The
-- "destructive operations" dialog, if shown, is only for the `drop trigger if
-- exists` guards below and is benign.
--
-- PRE-FLIGHT (run these READ-ONLY checks first and eyeball the output):
--   select count(*) as users, max(pg_column_size(data)) as biggest_blob_bytes
--     from public.vault_data;                       -- confirm the size cap is generous
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='feedback';   -- confirm 'username' exists
-- Only run the DO sections below once the pre-flight looks as expected.
-- ============================================================================


-- 1) vault_data blob SIZE CAP -------------------------------------------------
-- RLS proves ownership but never bounds the row size, so a scripted client could
-- upsert a multi-megabyte (or gigabyte) blob straight through PostgREST, blowing
-- storage/egress for everyone. This BEFORE trigger rejects an oversized blob.
-- pg_column_size(jsonb) is the TOAST-compressed on-disk size, so 5 MB is very
-- generous for real data (a normal account after the v164 image-strip is well
-- under 1 MB) while still stopping abuse. Tighten toward ~2 MB later once all
-- clients have pushed at least once post-strip.
create or replace function public.enforce_vault_data_size()
returns trigger
language plpgsql
as $$
begin
  if pg_column_size(new.data) > 5000000 then   -- ~5 MB compressed
    raise exception 'vault_data blob too large (%.1f MB); max 5 MB',
      pg_column_size(new.data) / 1048576.0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vault_data_size on public.vault_data;
create trigger trg_vault_data_size
  before insert or update on public.vault_data
  for each row execute function public.enforce_vault_data_size();


-- 2) feedback.username — SERVER-SIDE snapshot (fixes handle-spoofing) ----------
-- The feedback INSERT policy only checks user_id = auth.uid(); the `username`
-- column is whatever the client sends, so a crafted insert can display ANY
-- @handle next to a message in the owner's admin inbox (integrity/spoofing —
-- confirmed LOW in the security audit). Overwrite it on the server from the
-- caller's real profile so the client value is never trusted.
create or replace function public.snapshot_feedback_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.username := (select username from public.profiles where user_id = new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_feedback_username on public.feedback;
create trigger trg_feedback_username
  before insert on public.feedback
  for each row execute function public.snapshot_feedback_username();


-- ============================================================================
-- VERIFY (run after applying):
--   -- size cap present:
--   select tgname from pg_trigger where tgrelid = 'public.vault_data'::regclass
--     and not tgisinternal;
--   -- username snapshot present:
--   select tgname from pg_trigger where tgrelid = 'public.feedback'::regclass
--     and not tgisinternal;
--   -- functional check (as any signed-in user, the inserted username should equal
--   --   your profiles.username regardless of what the client sent).
-- ============================================================================
