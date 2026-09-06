-- ============================================================================
-- 24_client-errors-kinds-v20.sql — the error log accepts every kind the app sends.
--
-- 11 created client_errors with `check (kind in ('error','unhandledrejection',
-- 'manual'))`. Two reporters added since send other kinds:
--   js/app.js   syncRemindersOrWarn  →  reportError('notif', 'sync:<reason>')
--   js/cloud.js noteConflict         →  reportError('sync-conflict', <diagnostics>)
-- cloud.js inserts `kind` verbatim and swallows both outcomes, so every one of
-- those rows was refused with 23514 and discarded — the sync-conflict
-- diagnostics (localVer/remoteVer/stamps/pushing) written to debug the
-- multi-device conflict class had never reached the table.
--
-- scripts/check-contracts.js now reads the LAST such constraint in this folder
-- and refuses a commit whose reportError() literals are not in it.
-- Idempotent (drop if exists + add).
-- ============================================================================

alter table public.client_errors
  drop constraint if exists client_errors_kind_check;

alter table public.client_errors
  add constraint client_errors_kind_check
  check (kind in ('error', 'unhandledrejection', 'manual', 'notif', 'sync-conflict'));

-- VERIFY:
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.client_errors'::regclass and conname = 'client_errors_kind_check';
-- must list all five kinds.
