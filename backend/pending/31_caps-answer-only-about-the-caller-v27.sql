-- ============================================================================
-- 31_caps-answer-only-about-the-caller-v27.sql — the two SECURITY DEFINER
-- BEFORE-INSERT caps answer only about the caller.
--
-- NOT APPLIED. It is in backend/pending/ on purpose: a LIVE WRITE to the
-- owner's production database, which only he runs (CLAUDE.md, the list that
-- "still needs the owner"). Written 2026-09-27 from the access-control audit
-- (finding LOW-1). README §2 carries its row; move both when it has run.
--
-- ── WHAT IT CHANGES, AND WHY ───────────────────────────────────────────────
-- feedback_rate_cap() (27 §A) and own_row_cap() (27 §B) are SECURITY DEFINER,
-- and have to be: a count that runs under RLS counts nothing (26's cap was a
-- no-op for exactly that reason). But a BEFORE INSERT trigger fires BEFORE the
-- row meets the policy's WITH CHECK, and both counted rows for the user_id /
-- owner_id ON THE INCOMING ROW. A signed-in caller inserting with SOMEONE
-- ELSE's id was refused either way — by a different message: 'feedback rate
-- limit' when that account had sent five in the hour, 42501 when it had not
-- (and '<table> row limit reached' at 2,000 rows). One bit about another
-- account per request, from a table the caller cannot read. Not a data leak,
-- but an oracle is an oracle.
--
-- Both functions now begin by asking whether the row is the CALLER's:
--     if new.user_id is distinct from auth.uid() then return new; end if;
-- (owner_id for the row cap) and let RLS refuse a row that is not — 42501,
-- the same answer whatever the other account's count is. A global catalog
-- row (owner_id null; the admin RPCs are its only writers) takes the same
-- early return, as 27's `if new.owner_id is null` did. Nothing else changes:
-- the counts, the limits, the string js/cloud.js matches ('feedback rate
-- limit') and the trigger bindings are as 27 left them. CREATE OR REPLACE
-- keeps each function's OID and ACL, so the triggers and contract 30's locks
-- are untouched.
--
-- ONE TRANSACTION, idempotent, lock_timeout 5 s (nothing applied if it
-- aborts; re-run it). The VERIFY block runs before the COMMIT: it applies
-- whole with every probe passing, or not at all.
--
-- ── VERIFY — what the block proves, BY CALLING ────────────────────────────
-- Two throwaway accounts, A and B, inside a block that raises at the end so
-- no probe row survives:
--   1. as A, five feedback rows land and the sixth raises 'feedback rate
--      limit' — the cap still binds for the caller;
--   2. as B, a feedback row NAMING A (who is at the cap) is refused with
--      42501 by RLS — and never with 'feedback rate limit'. Before this file
--      the trigger answered 'feedback rate limit' here: that is the oracle;
--   3. as B, an exercise OWNED BY A is refused with 42501, never with
--      'row limit reached';
--   4. B's own exercise still lands — the row cap still runs for the caller;
--   5. and both surviving bodies carry the guard (a read, beside the calls).
-- The SQL editor shows no NOTICEs: `Success` after `commit;` is the proof.
--
-- ── HOW TO APPLY (the owner) ──────────────────────────────────────────────
-- 1. Backup first — backend/docs/DB-BACKUP-RESTORE.md.
-- 2. Supabase dashboard → SQL editor → New query → paste the WHOLE file → Run.
--    No "destructive operation" dialog is expected: this file drops nothing.
-- 3. Read-only check afterwards:
--      select proname from pg_proc
--       where proname in ('feedback_rate_cap','own_row_cap')
--         and pg_get_functiondef(oid) like '%is distinct from auth.uid()%';
--    → two rows.
-- 4. git mv backend/pending/31_caps-answer-only-about-the-caller-v27.sql backend/migrations/
--    and move README's §2 row to §1 with the date and the path it took.
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ── A. feedback_rate_cap: a count about the caller only ─────────────────────
create or replace function public.feedback_rate_cap()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  recent integer;
begin
  -- Not the caller's row: say nothing about anyone else. RLS
  -- (feedback_insert_own, WITH CHECK user_id = auth.uid()) refuses it next.
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;
  select pg_catalog.count(*) into recent
  from public.feedback f
  where f.user_id = new.user_id
    and f.created_at > pg_catalog.now() - interval '1 hour';
  -- RAISE, never `return null`: a BEFORE INSERT trigger that returns null drops
  -- the row and PostgREST reports success, so the form would say "sent" for a
  -- message nobody will ever read. js/cloud.js matches this exact string.
  if recent >= 5 then
    raise exception 'feedback rate limit';
  end if;
  return new;
end;
$$;

-- ── B. own_row_cap: a count about the caller only ───────────────────────────
create or replace function public.own_row_cap()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  n integer;
  cap integer := 2000;
begin
  -- Not the caller's row — including the global catalog row (owner_id null,
  -- written only by the admin RPCs), which 27 exempted the same way. RLS
  -- (<table>_insert_own, WITH CHECK owner_id = auth.uid()) refuses the rest.
  if new.owner_id is distinct from auth.uid() then
    return new;
  end if;
  execute pg_catalog.format('select pg_catalog.count(*) from public.%I where owner_id = $1', tg_table_name)
    into n using new.owner_id;
  if n >= cap then
    raise exception '% row limit reached (%)', tg_table_name, cap;
  end if;
  return new;
end;
$$;

-- ── VERIFY — inside the transaction: any failure raises, and nothing commits ─
do $$
declare
  a      uuid := pg_catalog.gen_random_uuid();
  b      uuid := pg_catalog.gen_random_uuid();
  caught text;
  state  text;
  i      integer;
begin
  -- two throwaway accounts (every FK here points at auth.users); gone at the ROLLBACK-OK below
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify31a-' || a || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify31b-' || b || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);

  -- 1. as A: five land, the sixth raises — the cap still binds for the caller
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..5 loop
    insert into public.feedback (user_id, username, message, context) values (a, null, 'verify31 probe ' || i, null);
  end loop;
  begin
    insert into public.feedback (user_id, username, message, context) values (a, null, 'verify31 probe 6', null);
    caught := 'accepted';
  exception when others then
    caught := sqlerrm;
  end;
  reset role;
  if caught <> 'feedback rate limit' then
    raise exception 'VERIFY 1 failed: the caller''s 6th feedback in an hour gave "%"', caught;
  end if;

  -- 2. as B: a row naming A (at the cap) is refused by RLS, never by the cap.
  --    Before this file: 'feedback rate limit' — the one bit about A.
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.feedback (user_id, username, message, context) values (a, null, 'verify31 as b', null);
    caught := 'accepted'; state := '00000';
  exception when others then
    caught := sqlerrm; state := sqlstate;
  end;
  reset role;
  if caught = 'feedback rate limit' then
    raise exception 'VERIFY 2 failed: the feedback cap still answers about another account';
  end if;
  if state <> '42501' then
    raise exception 'VERIFY 2 failed: a feedback row naming another account gave % "%" (expected 42501 from RLS)', state, caught;
  end if;

  -- 3. as B: an exercise owned by A is refused by RLS, never by the row cap
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.exercises (id, owner_id, name) values (pg_catalog.gen_random_uuid(), a, 'verify31 as b');
    caught := 'accepted'; state := '00000';
  exception when others then
    caught := sqlerrm; state := sqlstate;
  end;
  reset role;
  if caught like '%row limit reached%' then
    raise exception 'VERIFY 3 failed: the row cap still answers about another account';
  end if;
  if state <> '42501' then
    raise exception 'VERIFY 3 failed: an exercise owned by another account gave % "%" (expected 42501 from RLS)', state, caught;
  end if;

  -- 4. B's own exercise lands: the cap still runs for the caller (count < 2000)
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.exercises (id, owner_id, name) values (pg_catalog.gen_random_uuid(), b, 'verify31 own');
  reset role;
  if not exists (select 1 from public.exercises e where e.owner_id = b and e.name = 'verify31 own') then
    raise exception 'VERIFY 4 failed: the caller''s own exercise did not land';
  end if;

  -- 5. both surviving bodies carry the guard (a read, beside the calls above)
  if pg_catalog.pg_get_functiondef('public.feedback_rate_cap()'::regprocedure) not like '%is distinct from auth.uid()%'
     or pg_catalog.pg_get_functiondef('public.own_row_cap()'::regprocedure) not like '%is distinct from auth.uid()%' then
    raise exception 'VERIFY 5 failed: a cap body is missing the caller guard';
  end if;
  if not (select prosecdef from pg_catalog.pg_proc where oid = 'public.feedback_rate_cap()'::regprocedure)
     or not (select prosecdef from pg_catalog.pg_proc where oid = 'public.own_row_cap()'::regprocedure) then
    raise exception 'VERIFY 5 failed: a cap is no longer SECURITY DEFINER, so its count would see nothing';
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 31';
exception
  when others then
    if sqlerrm <> 'ROLLBACK-OK: VERIFY 31' then raise; end if;
    raise notice 'VERIFY 31 ok: the caller''s 6th feedback raises; a row naming another account is 42501, never the cap''s message (feedback and exercises); the caller''s own row lands; both bodies carry the guard';
end $$;

commit;
