-- ============================================================================
-- THE VAULT — post-audit hardening v5 (ADDITIVE, NON-DESTRUCTIVE, idempotent)
-- ============================================================================
-- Produced by the Database department's read-only audit (2026-07-11). Contains
-- ONLY the two safe, additive fixes it surfaced. NO destructive statement here
-- (the one destructive item — DROP SCHEMA migration_v2 — is in its own file with
-- a mandatory backup + human-confirmation gate; it is NOT in this file).
-- Safe to run in the Supabase SQL editor; safe to re-run.
-- ============================================================================

-- ---- 1. The one uncovered foreign key (index audit) ------------------------
-- feedback.user_id (references auth.users ON DELETE SET NULL) had no index; its
-- only consumer is the account-deletion cascade, which without this does a seq
-- scan of feedback per deletion. feedback is tiny, so a plain (non-concurrent)
-- index is instant and needs no CONCURRENTLY dance.
create index if not exists feedback_user_idx on public.feedback (user_id);

-- ---- 2. vault_data grant hardening (security audit M-1) ---------------------
-- vault_data holds each user's ENTIRE app-state blob. Its RLS isolation already
-- holds (four auth.uid()=user_id policies), but — unlike the 16 schema-v2 tables
-- — it never revoked Supabase's default auto-grants, so protection rested on the
-- policy alone. Double-lock it exactly like the v2 tables: revoke the auto-grants
-- from anon/public, re-grant only to authenticated. Policies are left untouched
-- (they already apply to authenticated), so there is zero isolation risk.
revoke all on public.vault_data from anon, authenticated, public;
grant select, insert, update, delete on public.vault_data to authenticated;

-- ---- verify (optional) ------------------------------------------------------
-- select indexname from pg_indexes where tablename='feedback';   -- feedback_user_idx present
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name='vault_data';                               -- authenticated only (no anon)
