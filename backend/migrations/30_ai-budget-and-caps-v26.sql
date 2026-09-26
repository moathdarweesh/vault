-- ============================================================================
-- 30_ai-budget-and-caps-v26.sql — the daily AI budget, working and not the
-- caller's to set; and hourly caps that a backdated row cannot dodge.
--
-- NOT APPLIED. It is in backend/pending/ on purpose: a LIVE WRITE to the
-- owner's production database, which only he runs (CLAUDE.md, the list that
-- "still needs the owner"). It SUPERSEDES 29, which now sits in archive/ with a
-- header saying so. 29 only dropped the foreign key; applied on its own it
-- would have switched the dead budget back on WITH the caller-chosen limits of
-- item 2 below — the hole the dead budget was hiding.
--
-- ONE TRANSACTION. Every VERIFY block runs before the COMMIT at the bottom,
-- so the file applies whole with every probe passing, or not at all.
-- For the length of the run (a second or two) it holds ACCESS EXCLUSIVE on
-- feedback, client_errors, ai_usage and ai_usage_global, and SHARE ROW
-- EXCLUSIVE on auth.users (re-adding a foreign key takes that on the table it
-- references): a feedback submit, an error report, an AI call or a sign-in
-- landing mid-run waits for the COMMIT, then proceeds under the new rules. Its
-- own lock waits are capped at 5 s — past that it aborts whole; re-run it.
-- Idempotent: a second run lands on the same objects and re-runs the probes.
--
-- ── WHAT IT CHANGES, AND WHY ───────────────────────────────────────────────
-- 1. The shared daily figure moves OUT of ai_usage into ai_usage_global(day, n).
--    28 added ai_usage.user_id -> auth.users as NOT VALID and wrote that this
--    would not reject the all-zero GLOBAL sentinel row. NOT VALID only skips
--    rows that ALREADY EXIST; every INSERT is still checked. The first charge
--    of each UTC day inserts a new sentinel row, the FK refuses it (23503), the
--    whole call rolls back (the per-user increment with it), and the Worker
--    fails open: measured live 2026-09-13, nothing billed since 2026-09-06.
--    With the shared figure in its own table every ai_usage row is a real
--    account, so 28's cascade is KEPT and the constraint is VALIDATED —
--    deleting an account removes its counters (29, by dropping the FK, would
--    have left them behind: security:backend#6).
-- 2. ai_budget_take() takes NO arguments. 27's version compared the counts
--    with p_user_limit / p_global_limit — the CALLER's values. The Worker sent
--    '{}' for the defaults, but any signed-in account could POST
--    /rest/v1/rpc/ai_budget_take {"p_user_limit":1e9,"p_global_limit":1e9}
--    with its own token: every call passed and added 1 to the shared figure at
--    no Gemini cost, so about 800 calls switched the AI off for everyone until
--    UTC midnight, repeatable daily (database#1, security:backend#1). The
--    limits are constants in the body now — 60 per account and 800 in total,
--    per UTC day — and the (integer, integer) overload is DROPPED: a second
--    signature beside it would have left the old one callable, and PostgREST
--    would have found two candidates for the Worker's '{}' (PGRST203). With
--    one zero-argument function PostgREST resolves the Worker's existing body
--    to it, so this file takes effect with no Worker change.
--    The charge is also serialised: every caller locks today's global row FOR
--    UPDATE first, so read -> decide -> charge cannot interleave between two
--    concurrent calls (27 read and then wrote; parallel calls at 59 all passed).
-- 3. ai_budget_take() refuses a banned or disabled account, reason 'blocked'.
--    The ban lives in public.user_flags and RESTRICTIVE policies enforce it on
--    every table, but the Worker is not Postgres: a banned account's JWT stays
--    valid, and it kept its 60 AI calls a day (security:backend#4). This
--    function is the one point on the AI path where the database can say no.
--    It asks public.is_banned(), the predicate every ban policy uses, so the
--    AI door and the table doors cannot disagree about who is blocked. The
--    Worker already fails CLOSED on allowed=false and answers DAILY_LIMIT for
--    every reason (the official client shows a banned account its blocked
--    screen and never calls the AI, so only a scripted caller meets this).
-- 4. feedback and client_errors: created_at belongs to the server.
--    Both hourly caps count `created_at > now() - interval '1 hour'`, and
--    created_at was writable by the client: a row sent as 2000-01-01 was never
--    counted, so one account could insert without limit (PostgREST takes a
--    JSON array — a thousand rows a request) until the free tier filled and
--    the project went read-only for every user (security:backend#2). Now:
--      - authenticated loses TABLE-level INSERT on both and gets COLUMN-level
--        INSERT on exactly the columns js/cloud.js sends —
--          feedback      (user_id, username, message, context)      submitFeedback()
--          client_errors (user_id, build, kind, msg, src, line, ua)  reportError()
--        so a client cannot name created_at, status or id at all (username
--        stays in the grant because the client sends it; the snapshot trigger
--        from 13/16 overwrites it with the server's copy anyway);
--      - a BEFORE INSERT trigger on both stamps created_at = now(), so even a
--        writer that DOES hold full INSERT (this SQL editor, a future grant
--        mistake) cannot backdate a row past the caps.
--    js/cloud.js needs no change: it never sent created_at. ⚠️ A client that
--    adds a column to either insert payload must add it to the grant IN THE
--    SAME CHANGE, or that insert fails with 42501 — and reportError swallows
--    its own failures, so a missed grant there is silent.
-- 5. admin_prune_ai_usage() prunes ai_usage_global as well. Retention stays in
--    that function, not in the budget. (pg_cron is not installed and no page
--    calls it, so retention is still aspirational — CLAUDE.md, "Still open".)
--
-- UNCHANGED, deliberately: the Worker still fails OPEN when this RPC errors
-- (the owner's availability decision — the Worker now LOGS every such
-- failure); and a signed-in account can still spend its own 60 without using
-- the AI — 27's residual, which now genuinely holds: one account adds at most
-- 60 to the 800.
--
-- ── VERIFY — what each block proves, BY CALLING ────────────────────────────
-- Blocks 2-4 each create a THROWAWAY auth user, act as the `authenticated`
-- role wherever a client would, and end by raising, so no probe row survives.
-- Block 1 reads the catalog, because the facts it checks ARE catalog facts
-- (an ACL, a validation flag, a column grant); 2-4 then prove each by calling.
-- A clean run prints exactly these four NOTICEs, in this order, then COMMITs:
--   VERIFY 1 ok: one zero-argument ai_budget_take, locked; FK validated; no sentinel row; INSERT grants are exactly the client payloads
--   VERIFY 2 ok: 60 allowed then user_daily, refusals bill nothing; global_daily at 800; banned/disabled blocked; no session refused; the two-argument call is gone
--   VERIFY 3 ok: both client payloads insert; created_at cannot be named; backdated rows are stamped now(); the 6th feedback raises and the 21st error is dropped; the admin resolve still works
--   VERIFY 4 ok: erasure cascades the counter; the prune refuses a non-admin and clears both tables for an admin
-- (3 and 4 say "admin path skipped" instead if public.admins is empty.)
-- ANYTHING ELSE — an ERROR, a missing NOTICE — means NOTHING was applied.
--
-- ── AFTER APPLYING (read-only) ─────────────────────────────────────────────
-- Make one AI call from the app, then:
--   select * from public.ai_usage_global where day = (now() at time zone 'utc')::date;   -- n went up by 1
--   select user_id, n from public.ai_usage where day = (now() at time zone 'utc')::date;  -- your row, +1
-- and in the Worker's logs, no "[gemini-worker] budget rpc failed OPEN" line after
-- the apply. Then move this file to backend/migrations/ and update README row 30.
-- ============================================================================

begin;

-- While this file waits for a lock, everything queued behind it waits too —
-- sign-ins included, since the foreign key below needs auth.users. So it gives
-- up after 5 s (nothing applied; re-run it) rather than stall them.
set local lock_timeout = '5s';

-- ── 1. the shared daily figure gets a table of its own ─────────────────────
create table if not exists public.ai_usage_global (
  day date    primary key,
  n   integer not null default 0 check (n >= 0)
);

-- Every table this file alters, locked up front, at the strength it will need
-- and in ONE order — the order the app's own writers take them:
-- delete_own_account() goes feedback -> client_errors -> ... -> auth.users, and
-- ai_budget_take() goes ai_usage_global -> ai_usage. A live call that lands
-- mid-run then queues behind this file holding nothing, instead of holding one
-- of these while it waits for another: the cycle that aborts one side. (A weak
-- lock first and a stronger one later on the same table is the classic way to
-- build that cycle, which is why these are ACCESS EXCLUSIVE from the start —
-- the drop-trigger and alter-table statements below need that much anyway.)
lock table public.feedback, public.client_errors, public.ai_usage_global, public.ai_usage in access exclusive mode;

alter table public.ai_usage_global enable row level security;
-- No policy and no client grant, exactly like ai_usage: ai_budget_take() is the only door.
revoke all on public.ai_usage_global from anon, authenticated, public;
comment on table public.ai_usage_global is
  'Calls the Worker allowed per UTC day across every account: the shared Gemini key''s daily figure. Written only by ai_budget_take(); pruned by admin_prune_ai_usage().';

-- The constraint FIRST: re-adding it takes SHARE ROW EXCLUSIVE on auth.users,
-- so no account can be deleted between the sweep below and the VALIDATE (a
-- deletion in between would leave an orphan and fail the validation). Dropped
-- and re-added rather than only validated, so the file also applies where 29
-- was run first and the constraint is gone.
alter table public.ai_usage drop constraint if exists ai_usage_user_fk;
alter table public.ai_usage
  add constraint ai_usage_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;

-- carry every global figure across (greatest(): a re-run can never lower one)...
insert into public.ai_usage_global (day, n)
  select a.day, a.n from public.ai_usage a
   where a.user_id = '00000000-0000-0000-0000-000000000000'
  on conflict (day) do update set n = greatest(public.ai_usage_global.n, excluded.n);
-- ...then the sentinel leaves ai_usage, and so does any orphan
delete from public.ai_usage where user_id = '00000000-0000-0000-0000-000000000000';
delete from public.ai_usage a where not exists (select 1 from auth.users u where u.id = a.user_id);

-- every row is a real account's now, so the constraint holds for the rows that exist too
alter table public.ai_usage validate constraint ai_usage_user_fk;

comment on table public.ai_usage is
  'Per-account, per-UTC-day count of AI calls the Worker allowed. Every row is a real account (validated FK to auth.users, on delete cascade); the shared figure is public.ai_usage_global. Written only by ai_budget_take().';

-- ── 2 + 3. the budget: constants, not arguments — and nothing for a blocked account ──
-- The two-argument overload goes explicitly. The zero-argument function below
-- is a new object, so it gets its revoke/grant pair right after it is created
-- (check-contracts #28 replays exactly that order).
drop function if exists public.ai_budget_take(integer, integer);

create or replace function public.ai_budget_take()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  user_limit   constant integer := 60;    -- one account, per UTC day
  global_limit constant integer := 800;   -- the one shared Gemini key, per UTC day
  uid    uuid := auth.uid();
  today  date := (pg_catalog.now() at time zone 'utc')::date;
  mine   integer;
  total  integer;
begin
  if uid is null then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'nosession');
  end if;
  -- the same predicate as every RESTRICTIVE ban policy (10, 12, 15, 16)
  if public.is_banned() then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'blocked');
  end if;

  -- Today's global row, locked: every caller queues here, so the decision
  -- below is made on figures nobody else can move until this call ends.
  insert into public.ai_usage_global (day, n) values (today, 0)
    on conflict (day) do nothing;
  select g.n into total from public.ai_usage_global g where g.day = today for update;

  -- COALESCE is SQL grammar, not a function: it must never be pg_catalog-qualified (16, 27).
  select u.n into mine from public.ai_usage u where u.user_id = uid and u.day = today;
  mine := coalesce(mine, 0);
  if mine >= user_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'user_daily', 'used', mine, 'limit', user_limit);
  end if;
  if total >= global_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'global_daily', 'used', total, 'limit', global_limit);
  end if;

  -- Only an ALLOWED call is charged (27's rule): every refusal above bills nothing.
  insert into public.ai_usage (user_id, day, n) values (uid, today, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into mine;
  update public.ai_usage_global g set n = g.n + 1 where g.day = today;

  return pg_catalog.jsonb_build_object('allowed', true, 'used', mine, 'limit', user_limit);
end;
$$;
revoke all on function public.ai_budget_take() from public, anon;
grant execute on function public.ai_budget_take() to authenticated;

-- ── 4. created_at belongs to the server ─────────────────────────────────────
create or replace function public.stamp_created_at()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  new.created_at := pg_catalog.now();
  return new;
end;
$$;
-- a trigger body, not an endpoint: no client role may call it (16's rule for trigger functions)
revoke all on function public.stamp_created_at() from public, anon, authenticated;

drop trigger if exists feedback_stamp_created_at_trg on public.feedback;
create trigger feedback_stamp_created_at_trg
  before insert on public.feedback
  for each row execute function public.stamp_created_at();

drop trigger if exists client_errors_stamp_created_at_trg on public.client_errors;
create trigger client_errors_stamp_created_at_trg
  before insert on public.client_errors
  for each row execute function public.stamp_created_at();

-- Revoking a table-level privilege also revokes any column-level one of the
-- same kind, so it is revoke-then-grant, and a re-run lands on the same grants.
-- SELECT and UPDATE are untouched (the admin inbox reads and resolves).
revoke insert on public.feedback from anon, authenticated, public;
grant insert (user_id, username, message, context) on public.feedback to authenticated;

revoke insert on public.client_errors from anon, authenticated, public;
grant insert (user_id, build, kind, msg, src, line, ua) on public.client_errors to authenticated;

-- ── 5. retention covers the new table ──────────────────────────────────────
create or replace function public.admin_prune_ai_usage()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  removed        integer;
  removed_global integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.ai_usage where day < ((pg_catalog.now() at time zone 'utc')::date - 30);
  get diagnostics removed = row_count;
  delete from public.ai_usage_global where day < ((pg_catalog.now() at time zone 'utc')::date - 30);
  get diagnostics removed_global = row_count;
  return removed + removed_global;
end;
$$;
revoke all on function public.admin_prune_ai_usage() from public, anon;
grant execute on function public.admin_prune_ai_usage() to authenticated;

-- PostgREST re-reads its schema cache when this NOTIFY is delivered (at the
-- COMMIT), so the Worker's next call finds the zero-argument function at once.
notify pgrst, 'reload schema';

-- ============================================================================
-- VERIFY — inside the transaction: any failure raises, and nothing commits.
-- ============================================================================

-- 1. the shape, read from the catalog because these facts ARE catalog facts
do $$
declare
  cols text;
begin
  if pg_catalog.to_regprocedure('public.ai_budget_take(integer,integer)') is not null then
    raise exception 'VERIFY 1 failed: the caller-chosen-limits overload ai_budget_take(integer, integer) still exists';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname = 'ai_budget_take') <> 1 then
    raise exception 'VERIFY 1 failed: expected exactly one public.ai_budget_take';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'public.ai_budget_take()'::pg_catalog.regprocedure
                    and p.prosecdef and p.pronargs = 0
                    and exists (select 1 from pg_catalog.unnest(p.proconfig) c where c like 'search_path=%')) then
    raise exception 'VERIFY 1 failed: ai_budget_take() is not a zero-argument SECURITY DEFINER with a pinned search_path';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.ai_budget_take()', 'execute')
     or pg_catalog.has_function_privilege('public', 'public.ai_budget_take()', 'execute') then
    raise exception 'VERIFY 1 failed: anon/PUBLIC can execute ai_budget_take()';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.ai_budget_take()', 'execute') then
    raise exception 'VERIFY 1 failed: authenticated cannot execute ai_budget_take(), and the Worker calls it with the caller''s token';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.stamp_created_at()', 'execute') then
    raise exception 'VERIFY 1 failed: a client role can execute the stamp_created_at() trigger function';
  end if;
  if not coalesce((select c.convalidated from pg_catalog.pg_constraint c
                    where c.conrelid = 'public.ai_usage'::pg_catalog.regclass and c.conname = 'ai_usage_user_fk'), false) then
    raise exception 'VERIFY 1 failed: ai_usage_user_fk is missing or still NOT VALID';
  end if;
  if exists (select 1 from public.ai_usage where user_id = '00000000-0000-0000-0000-000000000000') then
    raise exception 'VERIFY 1 failed: the sentinel row is still in ai_usage';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.ai_usage_global', 'select')
     or pg_catalog.has_table_privilege('authenticated', 'public.ai_usage_global', 'select')
     or pg_catalog.has_table_privilege('authenticated', 'public.ai_usage_global', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.ai_usage_global', 'update')
     or pg_catalog.has_table_privilege('authenticated', 'public.ai_usage_global', 'delete') then
    raise exception 'VERIFY 1 failed: a client role holds a privilege on ai_usage_global';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.feedback', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.client_errors', 'insert') then
    raise exception 'VERIFY 1 failed: authenticated still holds TABLE-level INSERT on feedback or client_errors';
  end if;
  select pg_catalog.string_agg(distinct column_name::text, ',' order by column_name::text) into cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'feedback' and grantee = 'authenticated' and privilege_type = 'INSERT';
  if cols is distinct from 'context,message,user_id,username' then
    raise exception 'VERIFY 1 failed: feedback INSERT columns for authenticated are [%], expected [context,message,user_id,username] (js/cloud.js submitFeedback)', cols;
  end if;
  select pg_catalog.string_agg(distinct column_name::text, ',' order by column_name::text) into cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'client_errors' and grantee = 'authenticated' and privilege_type = 'INSERT';
  if cols is distinct from 'build,kind,line,msg,src,ua,user_id' then
    raise exception 'VERIFY 1 failed: client_errors INSERT columns for authenticated are [%], expected [build,kind,line,msg,src,ua,user_id] (js/cloud.js reportError)', cols;
  end if;
  raise notice 'VERIFY 1 ok: one zero-argument ai_budget_take, locked; FK validated; no sentinel row; INSERT grants are exactly the client payloads';
end $$;

-- 2. the budget, called the way the Worker calls it: as `authenticated`, under
--    the caller's own claims
do $$
declare
  probe  uuid := pg_catalog.gen_random_uuid();
  today  date := (pg_catalog.now() at time zone 'utc')::date;
  claims text;
  r      jsonb;
  i      integer;
  mine   integer;
  total  integer;
  caught text;
begin
  -- a throwaway account (every FK here points at auth.users); gone at the ROLLBACK-OK below
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify30-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  claims := pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text;
  -- today's shared figure starts at 0 for this probe only (rolled back with it)
  insert into public.ai_usage_global (day, n) values (today, 0) on conflict (day) do update set n = 0;

  -- 2a. sixty allowed, the sixty-first refused, and the refusal bills nothing
  perform pg_catalog.set_config('request.jwt.claims', claims, true);
  set local role authenticated;
  for i in 1..60 loop
    r := public.ai_budget_take();
    if not coalesce((r->>'allowed')::boolean, false) then
      raise exception 'VERIFY 2a failed: call % of 60 was refused: %', i, r;
    end if;
  end loop;
  r := public.ai_budget_take();
  reset role;
  if coalesce((r->>'allowed')::boolean, true) or (r->>'reason') is distinct from 'user_daily' then
    raise exception 'VERIFY 2a failed: the 61st call answered %', r;
  end if;
  select u.n into mine from public.ai_usage u where u.user_id = probe and u.day = today;
  select g.n into total from public.ai_usage_global g where g.day = today;
  if mine is distinct from 60 or total is distinct from 60 then
    raise exception 'VERIFY 2a failed: after 60 allowed and 1 refused, per-account % and global % (expected 60 and 60)', mine, total;
  end if;

  -- 2b. the GLOBAL cap refuses a fresh account, and bills nothing either
  delete from public.ai_usage where user_id = probe;
  update public.ai_usage_global set n = 800 where day = today;
  set local role authenticated;
  r := public.ai_budget_take();
  reset role;
  if coalesce((r->>'allowed')::boolean, true) or (r->>'reason') is distinct from 'global_daily' then
    raise exception 'VERIFY 2b failed: at 800 in total a fresh account got %', r;
  end if;
  if exists (select 1 from public.ai_usage where user_id = probe)
     or (select g.n from public.ai_usage_global g where g.day = today) is distinct from 800 then
    raise exception 'VERIFY 2b failed: a global refusal was billed';
  end if;

  -- 2c. a banned or disabled account is refused before anything is counted; re-activated, it is served
  update public.ai_usage_global set n = 0 where day = today;
  insert into public.user_flags (user_id, status) values (probe, 'banned');
  set local role authenticated;
  r := public.ai_budget_take();
  reset role;
  if (r->>'reason') is distinct from 'blocked' then
    raise exception 'VERIFY 2c failed: a banned account got %', r;
  end if;
  update public.user_flags set status = 'disabled' where user_id = probe;
  set local role authenticated;
  r := public.ai_budget_take();
  reset role;
  if (r->>'reason') is distinct from 'blocked' then
    raise exception 'VERIFY 2c failed: a disabled account got %', r;
  end if;
  if exists (select 1 from public.ai_usage where user_id = probe)
     or (select g.n from public.ai_usage_global g where g.day = today) is distinct from 0 then
    raise exception 'VERIFY 2c failed: a blocked call was billed';
  end if;
  update public.user_flags set status = 'active' where user_id = probe;
  set local role authenticated;
  r := public.ai_budget_take();
  reset role;
  if not coalesce((r->>'allowed')::boolean, false) then
    raise exception 'VERIFY 2c failed: the same account, re-activated, got %', r;
  end if;

  -- 2d. no session, no budget
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  r := public.ai_budget_take();
  reset role;
  if (r->>'reason') is distinct from 'nosession' then
    raise exception 'VERIFY 2d failed: a caller with no sub got %', r;
  end if;

  -- 2e. the caller-chosen limits are gone: the old call no longer resolves
  perform pg_catalog.set_config('request.jwt.claims', claims, true);
  set local role authenticated;
  begin
    execute 'select public.ai_budget_take(1000000, 1000000)';
    caught := 'resolved';
  exception when undefined_function then
    caught := 'undefined_function';
  end;
  reset role;
  if caught <> 'undefined_function' then
    raise exception 'VERIFY 2e failed: ai_budget_take(1000000, 1000000) %', caught;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 2';
exception
  when others then
    -- strpos(), NOT position(): position(x in y) is SQL grammar and cannot be
    -- pg_catalog-qualified — the trap 28's own VERIFY fell into.
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 2') = 0 then raise; end if;
    raise notice 'VERIFY 2 ok: 60 allowed then user_daily, refusals bill nothing; global_daily at 800; banned/disabled blocked; no session refused; the two-argument call is gone';
end $$;

-- 3. feedback and client_errors, written exactly the way js/cloud.js writes them
do $$
declare
  probe    uuid := pg_catalog.gen_random_uuid();
  admin_id uuid;
  claims   text;
  caught   text;
  i        integer;
  n        integer;
  upd      integer;
  oldest   timestamptz;
  skipped  boolean := false;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify30-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  claims := pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text;
  perform pg_catalog.set_config('request.jwt.claims', claims, true);

  -- 3a. the submitFeedback() payload, from the client role, is accepted...
  set local role authenticated;
  insert into public.feedback (user_id, username, message, context)
    values (probe, 'not-my-handle', 'verify probe 1', 'verify');
  -- ...and naming created_at, or status, is refused by the grant (not by RLS: both rows would pass the policy)
  begin
    insert into public.feedback (user_id, message, created_at) values (probe, 'verify backdated', '2000-01-01');
    caught := 'accepted';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;
  if caught not like 'permission denied%' then
    raise exception 'VERIFY 3a failed: the client role naming feedback.created_at gave "%"', caught;
  end if;
  begin
    insert into public.feedback (user_id, message, status) values (probe, 'verify self-status', 'open');
    caught := 'accepted';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;
  reset role;
  if caught not like 'permission denied%' then
    raise exception 'VERIFY 3a failed: the client role naming feedback.status gave "%"', caught;
  end if;

  -- 3b. a writer that DOES hold full INSERT (this session) cannot backdate either
  for i in 2..5 loop
    insert into public.feedback (user_id, message, created_at) values (probe, 'verify probe ' || i, '2000-01-01');
  end loop;
  select pg_catalog.min(f.created_at) into oldest from public.feedback f where f.user_id = probe;
  if oldest < pg_catalog.now() then
    raise exception 'VERIFY 3b failed: a backdated feedback row kept created_at = %', oldest;
  end if;

  -- 3c. so the cap counts all five, and the sixth, sent as the client sends it, is refused out loud
  set local role authenticated;
  begin
    insert into public.feedback (user_id, username, message, context) values (probe, null, 'verify probe 6', null);
    caught := 'no error';
  exception when others then
    caught := sqlerrm;
  end;
  reset role;
  if caught <> 'feedback rate limit' then
    raise exception 'VERIFY 3c failed: the 6th feedback in an hour gave "%"', caught;
  end if;
  if exists (select 1 from public.feedback f where f.user_id = probe and f.username = 'not-my-handle') then
    raise exception 'VERIFY 3c failed: the client-sent username was stored instead of the server snapshot';
  end if;

  -- 3d. the admin inbox still resolves a row: UPDATE was never narrowed
  select a.user_id into admin_id from public.admins a order by a.user_id limit 1;
  if admin_id is null then
    skipped := true;
  else
    perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.feedback set status = 'resolved' where user_id = probe and message = 'verify probe 1';
    get diagnostics upd = row_count;
    reset role;
    if upd <> 1 then
      raise exception 'VERIFY 3d failed: the admin resolve updated % rows (expected 1)', upd;
    end if;
    perform pg_catalog.set_config('request.jwt.claims', claims, true);
  end if;

  -- 3e. the reportError() payload, from the client role, is accepted; naming created_at is refused
  set local role authenticated;
  insert into public.client_errors (user_id, build, kind, msg, src, line, ua)
    values (probe, 'verify30', 'manual', 'verify probe 1', 'verify.sql', 1, 'verify');
  begin
    insert into public.client_errors (user_id, build, kind, msg, created_at)
      values (probe, 'verify30', 'manual', 'verify backdated', '2000-01-01');
    caught := 'accepted';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;
  reset role;
  if caught not like 'permission denied%' then
    raise exception 'VERIFY 3e failed: the client role naming client_errors.created_at gave "%"', caught;
  end if;

  -- 3f. nineteen backdated rows from the full-INSERT writer are stamped now(), so the cap sees twenty...
  for i in 2..20 loop
    insert into public.client_errors (user_id, build, kind, msg, created_at)
      values (probe, 'verify30', 'manual', 'verify probe ' || i, '2000-01-01');
  end loop;
  select pg_catalog.count(*)::integer, pg_catalog.min(e.created_at) into n, oldest
    from public.client_errors e where e.user_id = probe;
  if n <> 20 or oldest < pg_catalog.now() then
    raise exception 'VERIFY 3f failed: % rows, oldest created_at %', n, oldest;
  end if;
  -- ...and drops the twenty-first silently (that cap returns null by design: nothing is promised to the user there)
  set local role authenticated;
  insert into public.client_errors (user_id, build, kind, msg, src, line, ua)
    values (probe, 'verify30', 'manual', 'verify probe 21', null, null, 'verify');
  reset role;
  select pg_catalog.count(*)::integer into n from public.client_errors e where e.user_id = probe;
  if n <> 20 then
    raise exception 'VERIFY 3f failed: the 21st client error in an hour was stored (% rows)', n;
  end if;

  if skipped then raise exception 'ROLLBACK-OK: VERIFY 3 (admin path skipped)'; end if;
  raise exception 'ROLLBACK-OK: VERIFY 3';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 3') = 0 then raise; end if;
    if sqlerrm = 'ROLLBACK-OK: VERIFY 3' then
      raise notice 'VERIFY 3 ok: both client payloads insert; created_at cannot be named; backdated rows are stamped now(); the 6th feedback raises and the 21st error is dropped; the admin resolve still works';
    else
      raise notice 'VERIFY 3 ok: both client payloads insert; created_at cannot be named; backdated rows are stamped now(); the 6th feedback raises and the 21st error is dropped; admin path skipped (public.admins is empty)';
    end if;
end $$;

-- 4. the counter leaves with the account, and retention covers both tables
do $$
declare
  probe     uuid := pg_catalog.gen_random_uuid();
  admin_id  uuid;
  today     date := (pg_catalog.now() at time zone 'utc')::date;
  r         jsonb;
  caught    text;
  left_rows bigint;
  old_rows  bigint;
  removed   integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify30-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  insert into public.ai_usage_global (day, n) values (today, 0) on conflict (day) do update set n = 0;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text, true);

  set local role authenticated;
  r := public.ai_budget_take();                    -- one real charge: the account now has a counter row
  insert into public.feedback (user_id, username, message, context) values (probe, null, 'verify erase', null);
  insert into public.client_errors (user_id, build, kind, msg, src, line, ua)
    values (probe, 'verify30', 'manual', 'verify erase', null, null, null);
  -- 4a. the prune runs to its gate for an ordinary account ('not authorized' is the PASS: the body parsed and ran)
  begin
    removed := public.admin_prune_ai_usage();
    caught := 'no error';
  exception when others then
    caught := sqlerrm;
  end;
  -- 4b. the app's own erasure path, called by the account itself
  perform public.delete_own_account();
  reset role;
  if not coalesce((r->>'allowed')::boolean, false) then
    raise exception 'VERIFY 4 failed: the probe''s one charge was refused: %', r;
  end if;
  if caught <> 'not authorized' then
    raise exception 'VERIFY 4a failed: admin_prune_ai_usage() for an ordinary account gave "%"', caught;
  end if;
  select (select pg_catalog.count(*) from public.ai_usage where user_id = probe)
       + (select pg_catalog.count(*) from public.feedback where user_id = probe)
       + (select pg_catalog.count(*) from public.client_errors where user_id = probe)
       + (select pg_catalog.count(*) from auth.users where id = probe)
    into left_rows;
  if left_rows <> 0 then
    raise exception 'VERIFY 4b failed: % rows of the erased account survive (its ai_usage row should cascade from auth.users)', left_rows;
  end if;

  -- 4c. retention, as an admin: rows older than 30 days leave BOTH tables
  select a.user_id into admin_id from public.admins a order by a.user_id limit 1;
  if admin_id is null then
    raise exception 'ROLLBACK-OK: VERIFY 4 (admin path skipped)';
  end if;
  insert into public.ai_usage (user_id, day, n) values (admin_id, today - 40, 1)
    on conflict (user_id, day) do update set n = 1;
  insert into public.ai_usage_global (day, n) values (today - 40, 1)
    on conflict (day) do update set n = 1;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  removed := public.admin_prune_ai_usage();
  reset role;
  select (select pg_catalog.count(*) from public.ai_usage where day < today - 30)
       + (select pg_catalog.count(*) from public.ai_usage_global where day < today - 30)
    into old_rows;
  if old_rows <> 0 or removed < 2 then
    raise exception 'VERIFY 4c failed: after the prune % old rows remain (it removed %)', old_rows, removed;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 4';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 4') = 0 then raise; end if;
    if sqlerrm = 'ROLLBACK-OK: VERIFY 4' then
      raise notice 'VERIFY 4 ok: erasure cascades the counter; the prune refuses a non-admin and clears both tables for an admin';
    else
      raise notice 'VERIFY 4 ok: erasure cascades the counter; the prune refuses a non-admin; admin path skipped (public.admins is empty)';
    end if;
end $$;

commit;
