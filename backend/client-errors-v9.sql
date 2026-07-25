-- ============================================================================
-- THE VAULT — client error reporting (ADDITIVE, non-destructive)
--
-- Problem this solves: the app has 77 empty `catch (_) {}` blocks and no error
-- handler at all. Every device gets each build simultaneously (live-URL shell),
-- so a bad push is invisible — you cannot tell a broken build from a quiet day,
-- cannot confirm a rollback worked, and cannot see whether the historically
-- dangerous paths (blob-overwrite guard, image backfill, mirror) are failing in
-- the field. Those are exactly the silent catch sites.
--
-- Design constraints honoured:
--   * free tier only — reuses the Supabase project already in place
--   * no new runtime dependency in the client
--   * PRIVACY: no message bodies from user data, hard length caps, and a user
--     can only ever insert/read their OWN rows. Only an admin reads everything.
--   * cannot become an abuse vector: insert-only for users, no update/delete,
--     and a per-user rate cap enforced in the trigger.
--
-- Apply: paste into the Supabase SQL editor and Run. Creates one table + policies.
-- ============================================================================

create table if not exists public.client_errors (
  id          bigserial primary key,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  build       text        not null check (length(build) <= 16),
  kind        text        not null check (kind in ('error', 'unhandledrejection', 'manual')),
  msg         text        not null check (length(msg) <= 500),
  src         text                 check (src is null or length(src) <= 300),
  line        integer,
  ua          text                 check (ua is null or length(ua) <= 200),
  created_at  timestamptz not null default now()
);

comment on table public.client_errors is
  'Best-effort client crash reports. User-insertable, self-readable, admin-readable. No PII beyond the user id; message text is capped and produced by the app, never from user content.';

-- Read paths: your own rows, or everything if you are an admin.
create index if not exists client_errors_user_idx    on public.client_errors (user_id, created_at desc);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_build_idx   on public.client_errors (build, created_at desc);

alter table public.client_errors enable row level security;

drop policy if exists client_errors_insert_own on public.client_errors;
create policy client_errors_insert_own on public.client_errors
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists client_errors_select_own on public.client_errors;
create policy client_errors_select_own on public.client_errors
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists client_errors_select_admin on public.client_errors;
create policy client_errors_select_admin on public.client_errors
  for select to authenticated
  using (public.is_admin());

-- Admin may clear old noise; nobody else can delete or update anything.
drop policy if exists client_errors_delete_admin on public.client_errors;
create policy client_errors_delete_admin on public.client_errors
  for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Rate cap. A crash LOOP would otherwise write thousands of rows per minute and
-- burn the free-tier row budget. Cap each user to 20 reports/hour; excess is
-- silently dropped (the client is fire-and-forget and ignores the result).
-- ----------------------------------------------------------------------------
create or replace function public.client_errors_rate_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent integer;
begin
  select count(*) into recent
  from public.client_errors
  where user_id = new.user_id
    and created_at > now() - interval '1 hour';

  if recent >= 20 then
    return null;   -- drop silently, do not error the caller
  end if;
  return new;
end;
$$;

drop trigger if exists client_errors_rate_cap_trg on public.client_errors;
create trigger client_errors_rate_cap_trg
  before insert on public.client_errors
  for each row execute function public.client_errors_rate_cap();

-- ----------------------------------------------------------------------------
-- Retention: keep 30 days. Call from the admin console (or a scheduled job if
-- you ever add one). Admin-gated so a user cannot purge evidence of a bug.
-- ----------------------------------------------------------------------------
create or replace function public.admin_prune_client_errors(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.client_errors where created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.admin_prune_client_errors(integer) from public, anon;
grant  execute on function public.admin_prune_client_errors(integer) to authenticated;

-- ============================================================================
-- VERIFY (after applying)
--   select * from public.client_errors order by created_at desc limit 20;
--   -- as a normal user, this must return ONLY that user's rows.
--
--   -- confirm no user-facing write path beyond insert:
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='client_errors' order by cmd;
-- ============================================================================
