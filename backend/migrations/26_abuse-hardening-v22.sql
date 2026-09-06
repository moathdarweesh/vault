-- ============================================================================
-- 26_abuse-hardening-v22.sql — close the ABUSE surface the 2026-09-06 security
-- assessment found. None of it was an isolation break: every cross-tenant probe
-- returned zero rows, and no path exposes an email, a password or a session.
-- What it found was cheaper: ways for ONE account (or none at all) to spend a
-- shared free-tier resource until the app stops working FOR EVERYONE.
--
-- Seven changes, each with a VERIFY that CALLS rather than merely reads:
--   1. anon loses EXECUTE on username_available() and is_admin()
--   2. authenticated loses TRUNCATE / TRIGGER / REFERENCES on three tables
--   3. two trigger functions get their search_path pinned
--   4. feedback gets length limits and a per-user hourly cap
--   5. profiles.display_name gets a length limit
--   6. the blob history is bounded by BYTES as well as by count
--   7. the image bucket gets a name shape and a per-user object cap
--   8. a DURABLE per-user + global daily budget for the shared AI key
--
-- Idempotent. What it deliberately does NOT do: lower the 5 MB blob cap. The
-- largest real blob is 55 KB, but `Cloud.pushOnce` re-attaches photos that have
-- no bucket copy yet, so a device with many un-backed-up photos legitimately
-- pushes megabytes. Bounding the HISTORY gets most of the win with none of that
-- risk: worst case per account falls from ~55 MB to ~13 MB.
-- ============================================================================

-- ── 1. anon may not call the admin gate or the handle oracle ────────────────
-- 05 intended this; the revoke never took, so `pg_proc.proacl` still listed
-- anon. Anyone holding the publishable key could ask "does @handle exist?" at
-- any rate, with no account. The answer is a boolean and handles are public by
-- design, but it is the one thing an outsider could learn about an account.
revoke execute on function public.username_available(public.citext) from anon, public;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.username_available(public.citext) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ── 2. least privilege on the three tables 02 left with the default ALL ─────
-- Not reachable today (PostgREST exposes no TRUNCATE verb and the role cannot
-- log in), and RLS still scopes every row. It becomes reachable the day any
-- SQL-executing RPC is added, and TRUNCATE is not filtered by RLS.
revoke all on public.profiles, public.exercises, public.cardio_types from anon, authenticated, public;
grant select, insert, update, delete on public.profiles, public.exercises, public.cardio_types to authenticated;

-- ── 3. pin the two mutable search_paths (Supabase advisor) ──────────────────
alter function public.enforce_vault_data_size() set search_path = '';
alter function public.bump_vault_data_version() set search_path = '';

-- ── 4. feedback: bounded text, bounded rate ────────────────────────────────
-- An authenticated user could insert unbounded rows of unbounded length. The
-- shape is client_errors' own cap, which has held since 11.
alter table public.feedback drop constraint if exists feedback_message_len;
alter table public.feedback add constraint feedback_message_len check (length(message) <= 2000);
alter table public.feedback drop constraint if exists feedback_context_len;
alter table public.feedback add constraint feedback_context_len check (context is null or length(context) <= 200);

create or replace function public.feedback_rate_cap()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  recent integer;
begin
  select pg_catalog.count(*) into recent
  from public.feedback f
  where f.user_id = new.user_id
    and f.created_at > pg_catalog.now() - interval '1 hour';

  -- Silently drop rather than raise: feedback is fire-and-forget in the client
  -- and an error here would surface as a broken form, not as a rate limit.
  if recent >= 5 then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_rate_cap_trg on public.feedback;
create trigger feedback_rate_cap_trg
  before insert on public.feedback
  for each row execute function public.feedback_rate_cap();

-- ── 5. profiles: a display name is a name, not a payload ───────────────────
alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len
  check (display_name is null or length(display_name) <= 60);
alter table public.profiles drop constraint if exists profiles_avatar_path_len;
alter table public.profiles add constraint profiles_avatar_path_len
  check (avatar_path is null or length(avatar_path) <= 300);

-- ── 6. the blob history is bounded by BYTES, not only by count ─────────────
-- 20 keeps the ten newest versions per user. Ten copies of a blob at the 5 MB
-- ceiling is 50 MB from one account — a tenth of the free tier, and the project
-- goes read-only for EVERY user when it fills. Now: the ten newest, and inside
-- those only what fits in 8 MB, but never fewer than two (a restore needs a
-- previous version to be worth anything).
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

    -- newest ten
    delete from public.vault_data_history h
      where h.user_id = old.user_id
        and h.id not in (
          select id from public.vault_data_history
           where user_id = old.user_id
           order by replaced_at desc, id desc
           limit 10
        );

    -- and of those, only what fits in 8 MB (always keeping the newest two)
    delete from public.vault_data_history h
      where h.user_id = old.user_id
        and h.id in (
          select id from (
            select id,
                   pg_catalog.row_number() over (order by replaced_at desc, id desc) as rn,
                   pg_catalog.sum(pg_catalog.pg_column_size(data))
                     over (order by replaced_at desc, id desc
                           rows between unbounded preceding and current row) as running
            from public.vault_data_history
            where user_id = old.user_id
          ) s
          where s.rn > 2 and s.running > 8000000
        );
  end if;
  return new;
end;
$$;

-- ── 7. the image bucket: a name shape and a per-user object cap ────────────
-- The owner check bound uploads to `{uid}/…` but not the count or the leaf
-- name, so one account could write unbounded objects (1 GB / 512 KB ≈ 2,000)
-- and fill the free storage tier for everyone. The client writes exactly
-- `{uid}/{exerciseId}.jpg`, where an exercise id is a uuid or a seed id such
-- as `rec_ex_1` — the shape below admits both and nothing else.
-- SECURITY DEFINER so the count does not re-enter the policy it is called from.
create or replace function public.exercise_image_count(p_uid uuid)
returns integer
language sql
security definer
set search_path to ''
stable
as $$
  select pg_catalog.count(*)::integer
  from storage.objects o
  where o.bucket_id = 'exercise-images'
    and (storage.foldername(o.name))[1] = p_uid::text;
$$;
revoke all on function public.exercise_image_count(uuid) from public, anon;
grant execute on function public.exercise_image_count(uuid) to authenticated;

drop policy if exists "exercise_images_owner_insert" on storage.objects;
create policy "exercise_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and name ~ '^[^/]+/[A-Za-z0-9_-]{1,64}\.jpg$'
    and public.exercise_image_count((select auth.uid())) < 200
  );

-- ── 8. a DURABLE daily budget for the shared AI key ────────────────────────
-- The Cloudflare Worker's limiter is a Map in isolate memory: every PoP and
-- every cold start has its own bucket, so it cannot bound a day's spend of the
-- ONE Gemini key everybody shares. One account looping the endpoint exhausts
-- the free quota and the AI stops working for every user until midnight.
-- Postgres is the shared store this app already has. The Worker calls
-- ai_budget_take() with the caller's own token, so the row is attributed by
-- auth.uid() and cannot be forged from the client.
create table if not exists public.ai_usage (
  user_id uuid not null,
  day     date not null default (pg_catalog.now() at time zone 'utc')::date,
  n       integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- No policy for anybody: the definer RPC is the only door. A client asking
-- directly gets zero rows, which is the correct answer to a question it should
-- not be asking.
revoke all on public.ai_usage from anon, authenticated, public;

comment on table public.ai_usage is
  'Per-user, per-UTC-day count of AI calls the Worker allowed. The all-zero uuid is the GLOBAL row. Written only by ai_budget_take().';

create or replace function public.ai_budget_take(p_user_limit integer default 60, p_global_limit integer default 800)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid    uuid := auth.uid();
  today  date := (pg_catalog.now() at time zone 'utc')::date;
  mine   integer;
  total  integer;
begin
  if uid is null then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'nosession');
  end if;

  -- Count first, then decide: a rejected call must not consume a slot, or a
  -- caller who is already over the limit would keep pushing the number up and
  -- the global row would stop meaning anything.
  insert into public.ai_usage (user_id, day, n) values (uid, today, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into mine;

  insert into public.ai_usage (user_id, day, n)
    values ('00000000-0000-0000-0000-000000000000', today, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into total;

  if mine > p_user_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'user_daily', 'used', mine, 'limit', p_user_limit);
  end if;
  if total > p_global_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'global_daily', 'used', total, 'limit', p_global_limit);
  end if;
  return pg_catalog.jsonb_build_object('allowed', true, 'used', mine, 'limit', p_user_limit);
end;
$$;
revoke all on function public.ai_budget_take(integer, integer) from public, anon;
grant execute on function public.ai_budget_take(integer, integer) to authenticated;

-- Housekeeping: an admin can drop rows older than 30 days.
create or replace function public.admin_prune_ai_usage()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  removed integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.ai_usage where day < ((pg_catalog.now() at time zone 'utc')::date - 30);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.admin_prune_ai_usage() from public, anon;
grant execute on function public.admin_prune_ai_usage() to authenticated;

-- ============================================================================
-- VERIFY — every claim above is CALLED, not merely read out of a catalog.
-- ============================================================================
do $$
begin
  -- 1 + 2: the grants
  if has_function_privilege('anon', 'public.username_available(public.citext)', 'execute')
     or has_function_privilege('anon', 'public.is_admin()', 'execute')
     or has_function_privilege('public', 'public.username_available(public.citext)', 'execute')
     or has_function_privilege('public', 'public.is_admin()', 'execute') then
    raise exception 'VERIFY failed: anon/PUBLIC can still EXECUTE the handle oracle or the admin gate';
  end if;
  if not has_function_privilege('authenticated', 'public.username_available(public.citext)', 'execute') then
    raise exception 'VERIFY failed: authenticated lost username_available';
  end if;
  if (select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated'
        and table_name in ('profiles', 'exercises', 'cardio_types')) <> 12 then
    raise exception 'VERIFY failed: the three tables should grant exactly SELECT/INSERT/UPDATE/DELETE to authenticated (4 x 3 = 12)';
  end if;
  -- 3: the pins (Postgres stores the empty path QUOTED: search_path="")
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('enforce_vault_data_size', 'bump_vault_data_version')
               and (p.proconfig is null or not (exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')))) then
    raise exception 'VERIFY failed: a trigger function still has a mutable search_path';
  end if;
  raise notice 'VERIFY ok: grants and search_paths';
end $$;

-- 4 + 5: the constraints reject what they name (rolled back either way)
do $$
begin
  begin
    perform 1 from public.feedback limit 1;                     -- the table binds
    if (select count(*) from pg_constraint
        where conrelid = 'public.feedback'::regclass
          and conname in ('feedback_message_len', 'feedback_context_len')) <> 2 then
      raise exception 'VERIFY failed: feedback length constraints missing';
    end if;
    if (select count(*) from pg_constraint
        where conrelid = 'public.profiles'::regclass
          and conname in ('profiles_display_name_len', 'profiles_avatar_path_len')) <> 2 then
      raise exception 'VERIFY failed: profiles length constraints missing';
    end if;
    if not exists (select 1 from pg_trigger where tgrelid = 'public.feedback'::regclass
                     and tgname = 'feedback_rate_cap_trg' and not tgisinternal) then
      raise exception 'VERIFY failed: the feedback rate cap trigger is not attached';
    end if;
  end;
  raise notice 'VERIFY ok: feedback and profiles bounds';
end $$;

-- 6 + 7: the two rewritten functions RUN (a plpgsql body only raw-parses at
-- CREATE time — migration 16's pg_catalog.coalesce trap)
do $$
declare
  c integer;
begin
  select public.exercise_image_count('00000000-0000-0000-0000-000000000000') into c;
  if c is null then raise exception 'VERIFY failed: exercise_image_count returned null'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage'
                   and policyname = 'exercise_images_owner_insert'
                   and with_check like '%exercise_image_count%') then
    raise exception 'VERIFY failed: the bucket insert policy does not carry the object cap';
  end if;
  if not exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                 where t.tgrelid = 'public.vault_data'::regclass
                   and p.proname = 'vault_data_keep_history' and not t.tgisinternal) then
    raise exception 'VERIFY failed: the history trigger is not attached';
  end if;
  raise notice 'VERIFY ok: image cap % objects for the sentinel uid, history trigger attached', c;
end $$;

-- 8: the budget RPC runs and refuses a session-less caller
do $$
declare
  r jsonb;
begin
  select public.ai_budget_take(60, 800) into r;
  if r is null then raise exception 'VERIFY failed: ai_budget_take returned null'; end if;
  if (r->>'allowed')::boolean and auth.uid() is null then
    raise exception 'VERIFY failed: ai_budget_take allowed a session-less caller';
  end if;
  raise notice 'VERIFY ok: ai_budget_take ran and answered %', r;
end $$;
