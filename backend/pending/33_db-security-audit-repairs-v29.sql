-- ============================================================================
-- 33_db-security-audit-repairs-v29.sql — what the 2026-09-27 database-security
-- audit proved on a scratch replay of migrations 01–30, repaired.
--
-- NOT APPLIED. A LIVE WRITE to the owner's production database, which only he
-- runs (backend/README.md §2). Drafted by the db-security-auditor, NOT run by
-- it anywhere but a throwaway in-memory replay: every VERIFY below passed there
-- (PGlite / PostgreSQL 18.3, the stubbed Supabase auth + storage schemas).
-- Independent of 31 (the caps oracle) and 32 (indexes): it touches neither
-- file's objects except to REVOKE EXECUTE on two trigger functions 31 may
-- rewrite, guarded so a renamed function is skipped, not an abort.
--
-- ONE TRANSACTION. Every VERIFY block CALLS the path it proves, as the role a
-- client really uses, then raises ROLLBACK-OK so no probe row survives; any
-- failure raises something else and the whole file aborts. `Success` after
-- `commit;` in the SQL editor is the proof. Idempotent.
--
-- ── WHAT IT CHANGES, AND WHY ───────────────────────────────────────────────
-- 1. storage: the RENAME path now honours the leaf-name shape. 26/27 put
--    `name ~ '^[^/]+/[A-Za-z0-9_-]{1,64}\.jpg$'` on the INSERT policy only; the
--    UPDATE policy is still 08's (own folder, one level). Proved on the
--    replay: a user renamed their own `<uid>/b1.jpg` to `<uid>/b1.svg`, then to
--    a 900-character `.html` name — both accepted. Storage's move endpoint is
--    an UPDATE of `name` under the caller's role, so the shape that keeps
--    active-content names out of the bucket could be walked around one step
--    after upload. The shape goes on WITH CHECK only: USING is unchanged, so
--    every existing object stays readable, deletable and erasable.
-- 2. username_available(): `p.username = candidate` inside `search_path = ''`
--    does NOT resolve to citext's case-insensitive `=` — that operator lives
--    in schema public, which is not on the path — so it falls through to
--    pg_catalog's TEXT equality. Proved: with `alpha_probe` taken,
--    username_available('ALPHA_PROBE') answered TRUE, and the save then failed
--    23505 on the case-insensitive unique index. Not a leak (the oracle is by
--    design); a correctness bug of exactly the "qualify your operators" kind.
--    The comparison is now `operator(public.=)`. CREATE OR REPLACE keeps 26's
--    ACL (authenticated only).
-- 3. admin_upsert_food, the 7-argument overload (21), wrote NO audit row — and
--    it is the one admin.html calls on every save (admin.html:1160), so no
--    catalogue edit since 21 is in audit_log. Proved: 7-arg delta 0, 6-arg
--    delta 1. It now audits like its 6-argument sibling and answers
--    'not authorized' like every other admin RPC.
-- 4. ⚠️ OWNER DECISION — delete this section AND "VERIFY 4" before applying if
--    co-admins must manage admins. admin_set_role(): only the founder may grant or remove the
--    ADMIN role. Today any admin can mint another admin and demote any admin
--    but the founder (proved: C, made admin by the founder, made D an admin;
--    D then demoted C). Every admin reads every user's whole blob
--    (vault_data_admin_read), so one stolen admin session — the admin.html
--    session-slot finding — could leave behind admins of its own that
--    outlive the stolen token. Non-admin roles (user/coach) stay manageable by
--    any admin; the founder guard and the audit row are kept.
-- 5. Hygiene: EXECUTE on the five trigger functions that never had it revoked
--    (Supabase's default privileges grant it to anon/authenticated). Not
--    callable directly — a trigger function refuses a plain call and PostgREST
--    does not expose them (live: PGRST202) — but 16 and 30 revoke on every
--    other trigger function, and a trigger fires without the caller holding
--    EXECUTE (VERIFY 5 proves the triggers still fire).
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ── 1. storage: the rename path honours the leaf-name shape ────────────────
drop policy if exists "exercise_images_owner_update" on storage.objects;
create policy "exercise_images_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  )
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and name ~ '^[^/]+/[A-Za-z0-9_-]{1,64}\.jpg$'
  );

-- ── 2. username_available(): citext's own equality, qualified ───────────────
create or replace function public.username_available(candidate public.citext)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.profiles p
        where p.username operator(public.=) candidate   -- citext =, not pg_catalog text =
     );
$$;

-- ── 3. admin_upsert_food (7-arg): audited like the 6-arg ────────────────────
create or replace function public.admin_upsert_food(
  p_id uuid, p_name text, p_serving text,
  p_cal numeric, p_pro numeric, p_carb numeric, p_fat numeric)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  rid uuid := p_id;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if rid is null then
    insert into public.food_catalog(name, serving, calories, protein, carbs, fat)
      values (p_name, p_serving, coalesce(p_cal,0), coalesce(p_pro,0), coalesce(p_carb,0), coalesce(p_fat,0))
      returning id into rid;
  else
    update public.food_catalog
       set name = p_name, serving = p_serving,
           calories = coalesce(p_cal,0), protein = coalesce(p_pro,0),
           carbs = coalesce(p_carb,0), fat = coalesce(p_fat,0)
     where id = rid;
  end if;
  perform public.audit('food.upsert', null, pg_catalog.jsonb_build_object('id', rid, 'name', p_name, 'fat', p_fat));
  return rid;
end;
$$;
revoke all on function public.admin_upsert_food(uuid, text, text, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_upsert_food(uuid, text, text, numeric, numeric, numeric, numeric) to authenticated;

-- ── 4. ⚠️ OWNER DECISION: only the founder grants or removes ADMIN ─────────
create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if target = auth.uid() then raise exception 'cannot change your own role'; end if;
  if target = 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2'::uuid then raise exception 'the owner account is protected'; end if;
  if new_role not in ('user','coach','admin') then raise exception 'invalid role'; end if;
  if (new_role = 'admin' or exists (select 1 from public.admins a where a.user_id = target))
     and auth.uid() is distinct from 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2'::uuid then
    raise exception 'only the owner account can grant or remove admin';
  end if;
  insert into public.user_flags (user_id, role, updated_by) values (target, new_role, auth.uid())
    on conflict (user_id) do update set role = excluded.role, updated_by = excluded.updated_by;
  if new_role = 'admin' then insert into public.admins (user_id) values (target) on conflict do nothing;
  else delete from public.admins where user_id = target; end if;
  perform public.audit('role.set', target, pg_catalog.jsonb_build_object('role', new_role));
end; $$;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ── 5. trigger functions: no client role holds EXECUTE ─────────────────────
do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.touch_updated_at()', 'public.enforce_vault_data_size()', 'public.bump_vault_data_version()',
    'public.feedback_rate_cap()', 'public.own_row_cap()'
  ] loop
    if pg_catalog.to_regprocedure(sig) is not null then
      execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', sig);
    end if;
  end loop;
end $$;

-- ── VERIFY 1: a real upload and a shape-keeping overwrite pass; a rename out of the shape fails ──
do $$
declare
  probe  uuid := pg_catalog.gen_random_uuid();
  caught text;
  n      integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify33-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name, owner) values ('exercise-images', probe || '/v33.jpg', probe);
  insert into storage.objects (bucket_id, name, owner) values ('exercise-images', probe || '/v33.jpg', probe)
    on conflict (bucket_id, name) do update set owner = excluded.owner;          -- the app's upsert:true overwrite
  update storage.objects set name = probe || '/v33b.jpg'
   where bucket_id = 'exercise-images' and name = probe || '/v33.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'VERIFY 1 failed: a rename that keeps the shape updated % rows', n; end if;
  begin
    update storage.objects set name = probe || '/v33b.svg'
     where bucket_id = 'exercise-images' and name = probe || '/v33b.jpg';
    caught := 'accepted';
  exception when insufficient_privilege then caught := 'refused'; end;
  reset role;
  if caught <> 'refused' then raise exception 'VERIFY 1 failed: a rename to .svg was %', caught; end if;
  raise exception 'ROLLBACK-OK: VERIFY 1';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 1') = 0 then raise; end if;
    raise notice 'VERIFY 1 ok: upload, overwrite and a shape-keeping rename pass; a rename to .svg is refused';
end $$;

-- ── VERIFY 2: username_available() is case-insensitive, like the unique index ──
do $$
declare
  probe  uuid := pg_catalog.gen_random_uuid();
  handle text := 'v33p' || pg_catalog.substr(pg_catalog.md5(probe::text), 1, 8);
  taken_upper boolean;
  fresh       boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify33-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.profiles (user_id, username) values (probe, handle);
  taken_upper := public.username_available(pg_catalog.upper(handle)::public.citext);
  fresh       := public.username_available(('z' || pg_catalog.substr(handle, 2))::public.citext);
  reset role;
  if taken_upper then raise exception 'VERIFY 2 failed: a taken handle in another case was reported available'; end if;
  if not fresh then raise exception 'VERIFY 2 failed: a free handle was reported taken'; end if;
  raise exception 'ROLLBACK-OK: VERIFY 2';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 2') = 0 then raise; end if;
    raise notice 'VERIFY 2 ok: a taken handle is taken in every case; a free one is free';
end $$;

-- ── VERIFY 3: the 7-argument food upsert writes its audit row ──────────────
do $$
declare
  founder  uuid := 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2';
  before_n bigint;
  after_n  bigint;
begin
  if not exists (select 1 from public.admins a where a.user_id = founder) then
    raise exception 'ROLLBACK-OK: VERIFY 3 (skipped: the founder is not in public.admins)';
  end if;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', founder, 'role', 'authenticated')::text, true);
  select pg_catalog.count(*) into before_n from public.audit_log;
  set local role authenticated;
  perform public.admin_upsert_food(null, 'verify33 food', null, 1, 1, 1, 1);
  reset role;
  select pg_catalog.count(*) into after_n from public.audit_log;
  if after_n - before_n <> 1 then
    raise exception 'VERIFY 3 failed: the 7-argument admin_upsert_food wrote % audit rows', after_n - before_n;
  end if;
  raise exception 'ROLLBACK-OK: VERIFY 3';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 3') = 0 then raise; end if;
    raise notice 'VERIFY 3 ok (%): the 7-argument food upsert audits', sqlerrm;
end $$;

-- ── VERIFY 4 (⚠️ OWNER DECISION — delete together with section 4): only the founder moves ADMIN ──
do $$
declare
  founder uuid := 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2';
  p1      uuid := pg_catalog.gen_random_uuid();
  p2      uuid := pg_catalog.gen_random_uuid();
  caught  text;
  u       uuid;
begin
  if not exists (select 1 from public.admins a where a.user_id = founder) then
    raise exception 'ROLLBACK-OK: VERIFY 4 (skipped: the founder is not in public.admins)';
  end if;
  foreach u in array array[p1, p2] loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'verify33-' || u || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  end loop;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', founder, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_role(p1, 'admin');                          -- the founder may
  reset role;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_set_role(p2, 'admin');                        -- another admin may not
    caught := 'accepted';
  exception when raise_exception then caught := sqlerrm; end;
  perform public.admin_set_role(p2, 'coach');                          -- non-admin roles still may
  reset role;
  if caught <> 'only the owner account can grant or remove admin' then
    raise exception 'VERIFY 4 failed: a non-founder admin granting admin gave "%"', caught;
  end if;
  if not exists (select 1 from public.user_flags f where f.user_id = p2 and f.role = 'coach') then
    raise exception 'VERIFY 4 failed: a non-founder admin could not set a non-admin role';
  end if;
  raise exception 'ROLLBACK-OK: VERIFY 4';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 4') = 0 then raise; end if;
    raise notice 'VERIFY 4 ok (%): only the founder grants or removes ADMIN', sqlerrm;
end $$;

-- ── VERIFY 5: no client role executes a trigger function, and the triggers still fire ──
do $$
declare
  probe uuid := pg_catalog.gen_random_uuid();
  sig   text;
  n     integer;
begin
  foreach sig in array array[
    'public.touch_updated_at()', 'public.enforce_vault_data_size()', 'public.bump_vault_data_version()',
    'public.feedback_rate_cap()', 'public.own_row_cap()'
  ] loop
    if pg_catalog.to_regprocedure(sig) is not null
       and (pg_catalog.has_function_privilege('anon', sig, 'execute')
            or pg_catalog.has_function_privilege('authenticated', sig, 'execute')) then
      raise exception 'VERIFY 5 failed: a client role can execute %', sig;
    end if;
  end loop;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify33-' || probe || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', probe, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.vault_data (user_id, data) values (probe, '{"v":1}'::jsonb);
  update public.vault_data set data = '{"v":2}'::jsonb where user_id = probe;            -- size, version, history triggers
  insert into public.exercises (id, owner_id, name) values (pg_catalog.gen_random_uuid(), probe, 'verify33');  -- own_row_cap, touch
  insert into public.feedback (user_id, username, message, context) values (probe, null, 'verify33', null); -- rate cap, snapshot, stamp
  reset role;
  select v.version into n from public.vault_data v where v.user_id = probe;
  if n is distinct from 1 then raise exception 'VERIFY 5 failed: the version trigger did not fire (version %)', n; end if;
  if not exists (select 1 from public.vault_data_history h where h.user_id = probe) then
    raise exception 'VERIFY 5 failed: the history trigger did not fire';
  end if;
  if not exists (select 1 from public.feedback f where f.user_id = probe) then
    raise exception 'VERIFY 5 failed: the feedback insert did not land';
  end if;
  raise exception 'ROLLBACK-OK: VERIFY 5';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 5') = 0 then raise; end if;
    raise notice 'VERIFY 5 ok: trigger functions are locked to client roles and every trigger still fires';
end $$;

commit;
