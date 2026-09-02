-- ============================================================================
-- 20_vault-data-history-v16.sql — keep the last 10 versions of every blob
--
-- WHY: vault_data is ONE mutable row per user and the client syncs the blob
-- whole. When two devices genuinely diverge (the phone logs a workout offline
-- while the laptop logs meals), the conflict dialog can only keep one side
-- wholesale — and the side that was force-pushed over had NO copy anywhere on
-- the server. The one-slot device snapshot lives on the losing device and is
-- itself replaced by the next pull. This table is the missing copy: every
-- UPDATE that changes `data` files the OLD row here, and the ten newest are
-- kept per user.
--
-- SCOPE: the trigger is the only writer. Users may SELECT their own history
-- (a future "restore from the cloud's previous version" needs nothing more);
-- there is no INSERT/UPDATE/DELETE policy for anyone, and the auto-grants are
-- revoked and re-granted SELECT-only, matching the vault_data double-lock in
-- 09_hardening-v5.sql. The admin's is_admin() window is deliberately NOT
-- extended here — the console has no use for history yet.
--
-- SIZE: the uploaded payload already strips backed-up base64 images (cloud.js
-- pushOnce), so a version is the text blob, typically 40–500 KB. Ten per user.
-- ============================================================================

create table if not exists public.vault_data_history (
  id          bigserial primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  version     integer,
  data        jsonb       not null,
  replaced_at timestamptz not null default now()
);
create index if not exists vault_data_history_user_idx
  on public.vault_data_history (user_id, replaced_at desc);

alter table public.vault_data_history enable row level security;
drop policy if exists vault_data_history_select_own on public.vault_data_history;
create policy vault_data_history_select_own on public.vault_data_history
  for select using (auth.uid() = user_id);

revoke all on public.vault_data_history from anon, authenticated, public;
grant select on public.vault_data_history to authenticated;
-- the trigger function is SECURITY DEFINER, so the table owner writes; no
-- sequence grant is needed for authenticated.

-- SECURITY DEFINER with an empty search_path (the convention since 18): the
-- function body names every relation with its schema.
create or replace function public.vault_data_keep_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.data is distinct from new.data then
    insert into public.vault_data_history (user_id, version, data)
      values (old.user_id, old.version, old.data);
    -- keep the ten newest for this user
    delete from public.vault_data_history h
      where h.user_id = old.user_id
        and h.id not in (
          select id from public.vault_data_history
           where user_id = old.user_id
           order by replaced_at desc, id desc
           limit 10
        );
  end if;
  return new;
end;
$$;
revoke all on function public.vault_data_keep_history() from public, anon, authenticated;

drop trigger if exists trg_vault_data_history on public.vault_data;
create trigger trg_vault_data_history
  before update on public.vault_data
  for each row execute function public.vault_data_keep_history();

-- ---- verify -----------------------------------------------------------------
-- select tgname from pg_trigger where tgrelid = 'public.vault_data'::regclass;
--   -- trg_vault_data_history present, alongside trg_vault_data_size / _version
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'vault_data_history';   -- authenticated: SELECT only
