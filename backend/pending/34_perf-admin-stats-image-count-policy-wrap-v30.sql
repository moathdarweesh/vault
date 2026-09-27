-- ============================================================================
-- 34_perf-admin-stats-image-count-policy-wrap-v30.sql — three performance
-- repairs from the 2026-09-27 index review. Nobody can see, write or be
-- refused anything they could not before; the same answers arrive faster.
--
-- NOT APPLIED. A LIVE WRITE to the owner's production database, which only he
-- runs (backend/README.md §2). Written by db-migration-engineer and DRY-RUN
-- ONLY on two throwaway in-memory PGlite replicas — PostgreSQL 16.4 and 18.3,
-- migrations 01–30 replayed with stand-ins for Supabase's auth and storage
-- schemas (archive/admin-scale-rpc.sql before 14, the order the live project
-- took — README §1). Nothing here has touched the live project.
--
-- Composes with the other pending files: it touches none of their objects.
-- 31 rewrites feedback_rate_cap() and own_row_cap(); 32 drops an index on
-- client_errors (this file alters that table's POLICIES only); 33 rewrites a
-- storage UPDATE policy and three functions, none of them here. Dry-run in
-- number order (31 → 32 → 33 → 34, then 34 again), with 34 first and the
-- other three after it, and on 30 alone: every VERIFY of every file passed in
-- each order. (32's own gate refuses on a fresh replica — its statistics
-- cover minutes, not 14 days — and aborts whole without touching anything;
-- 33 and 34 then apply as usual.)
--
-- ONE TRANSACTION. Every VERIFY block runs before the COMMIT at the bottom,
-- so the file applies whole with every probe passing, or not at all.
-- Idempotent: a second run re-creates the same bodies, re-sets the same
-- predicates and re-runs every probe.
--
-- ── WHAT IT CHANGES, AND WHY ───────────────────────────────────────────────
-- A. admin_user_stats(p_week_start date) — the Console's per-user rollup
--    (admin.html:770). 25's body runs correlated subqueries against
--    MATERIALIZED CTEs: every user's row rescans EVERY user's sessions and
--    sets, so the call is O(users x total sessions), and each blob is
--    decompressed about 14 times per user. The new body aggregates each blob
--    once, in LATERAL subqueries, from one detoasted copy. Same signature,
--    same 12 columns in the same order and types, same is_admin() guard,
--    same Sunday anchor (contract 16), same upper bound. CREATE OR REPLACE,
--    so the ACL that 23/25 locked is KEPT (re-asserted below anyway,
--    contract 28).
--    Replica (PGlite, so read the RATIOS, not the milliseconds), ~150 sessions
--    per account plus the 12 malformed blobs and the owner's; median of the
--    7 week windows the identity check used:
--        38 blobs    148 ms ->  25 ms   (x6)
--        63 blobs    573 ms ->  58 ms   (x10)
--       113 blobs   1.74 s  ->  85 ms   (x20)
--       213 blobs   6.96 s  -> 171 ms   (x41)
--    Doubling the accounts quadrupled 25's time and doubles this one's.
--    Identity on the same replicas: every row of every window equal as TEXT
--    (so 500 vs 500.0 would count as a difference) — 1,491 rows x 7 windows at
--    213 blobs, 0 differing, the same row order too.
--    VERIFY 1 runs 25's body VERBATIM beside the new one on the live rows and
--    refuses to commit on a single differing row.
--
-- B. exercise_image_count() — the 200-photo cap inside the bucket's INSERT
--    policy (27), so it runs on EVERY photo upload. 27 counts by
--    storage.foldername(name), which no index can serve: every upload scans
--    the whole bucket. The new body first bounds `name` to the caller's own
--    folder with a C-collation range — `<uid>/` <= name < `<uid>0` ('0' is
--    the byte after '/'), exactly the names that start with `<uid>/` — which
--    Supabase's own idx_objects_bucket_id_name (bucket_id, name COLLATE "C")
--    serves; 27's foldername equality is KEPT as the exact test, so the count
--    is the same number. If that index were ever absent the answer is
--    unchanged and merely no faster. SECURITY DEFINER, search_path '' and
--    27's 42P17 rule are unchanged: storage.objects is still read only from
--    inside this definer function, never from a policy expression on
--    storage.objects itself.
--    Replica, ~8,000–8,600 objects in 414 folders (401 accounts, plus edge
--    names: nested paths, `<uid>0/…`, `<uid>-/…`, `/<uid>/…`, an upper-case
--    uid, another bucket): 24–28 ms -> 0.6 ms per call (x42–47), and one
--    photo upload through the bucket's INSERT policy 25–29 ms -> 0.8–1.3 ms
--    (x21–32). The plan is an Index Only Scan on idx_objects_bucket_id_name
--    that reads only the caller's own names. Identity: the count for every
--    one of 407 callers (401 accounts, 5 unknown uids, no session) equal
--    before and after.
--
-- C. Thirteen policies called public.is_admin() or auth.uid() BARE, which
--    Postgres evaluates once PER ROW it reads (is_admin() is SECURITY DEFINER,
--    so it is never inlined — each row pays a function call and a probe of
--    public.admins; auth.uid() is inlined as two current_setting() reads and a
--    jsonb parse per row). `(select …)` makes each an InitPlan: evaluated once
--    per statement. Both functions are STABLE: inside one statement they see
--    one set of claims and one snapshot of public.admins, so the once-per-
--    statement value IS the per-row value: the predicates are identical apart
--    from the wrap, and ALTER POLICY without TO keeps each policy's roles,
--    command and PERMISSIVE flag. The GATE refuses the whole file if any live
--    predicate differs from what the migrations wrote (bare or already
--    wrapped), so a hand edit made outside the migrations is never silently
--    overwritten.
--    «Never reference a table inside its own policy» still holds: the
--    wrapped subqueries read no table; is_admin() reads public.admins as a
--    definer, and none of these policies is on public.admins.
--    Replica, 50,000 client_errors rows, as `authenticated`:
--      the Console's error page (admin.html:775)   ~17 ms  -> ~8 ms    (x2)
--      the admin counting every error row          ~400 ms -> ~6 ms    (x59–66)
--      a user counting their own error rows        ~400 ms -> ~5 ms    (x81–90)
--      the audit page (admin.html:762)             ~14 ms  -> ~7 ms    (x2)
--      a pull (cloud.js, one row by primary key)   unchanged, ~1 ms
--    A LIMIT-1000 page pays per row only for the rows it returns; anything
--    that filters a whole table paid it for every row it looked at.
--
-- NOT HERE, deliberately:
--   * returning prefs.unit from admin_user_stats — it changes the return
--     type, so it is DROP + CREATE with a re-lock: its own migration, if ever.
--   * bootSync's needless pull, the Console's paging/order/limits — app
--     changes (js/, admin.html), handled elsewhere.
--   * the write policies that still call auth.uid() bare (vault_insert_own,
--     vault_update_own, client_errors_insert_own) and the RESTRICTIVE
--     is_banned() pairs: each guards a write of ONE row, where once per row
--     and once per statement are the same single call.
--
-- ── LOCKS ──────────────────────────────────────────────────────────────────
-- A and B replace functions and take no table lock. Each ALTER POLICY takes
-- ACCESS EXCLUSIVE on its table until the COMMIT. So:
--   * VERIFY 1 and 2 — the only blocks that read every blob or the bucket, and
--     1 runs 25's slow body — run BEFORE section C, under no exclusive lock;
--   * section C locks the busiest tables last (vault_data is read on every
--     foreground), and vault_data BEFORE vault_data_history — the order a push
--     takes them through the history trigger — so a push landing mid-run
--     waits instead of deadlocking;
--   * after C only VERIFY 3–5 run (tens of milliseconds), then COMMIT.
-- A pull, push, error report or feedback landing in that window waits for the
-- COMMIT and proceeds. Lock waits are capped at 3 s (while this file waits in
-- the queue, reads queue behind it — so it gives up fast rather than stall
-- them); past that it aborts whole: re-run it.
-- Duration: the lock-free VERIFY 1 dominates, because it runs 25's quadratic
-- body three times. Whole file on the PGlite replica: 0.7 s at 38 blobs,
-- 2.2 s at 63, 6 s at 113, 22 s at 213 — each DO block is one statement
-- under the 60 s statement_timeout, which a native server clears with room
-- at this project's size. Past it the file aborts whole (nothing applied).
-- VERIFY 4's rolled-back probe rows still advance two sequences
-- (vault_data_history.id, client_errors.id): a gap of a few ids, nothing else.
--
-- ── VERIFY — what each block proves, BY CALLING ────────────────────────────
-- Probes are THROWAWAY auth users (and, where a block needs one, a throwaway
-- ADMIN — a probe written into public.admins); every block that writes ends by
-- raising ROLLBACK-OK, so no probe row, grant or admin survives. A clean run
-- prints (in a client that shows NOTICEs):
--   GATE ok: 13 policies read as the migrations wrote them (N already wrapped)
--   VERIFY 1 ok: admin_user_stats — the known answer in 4 windows; identical to 25's body on every row in 3 windows; non-admin stopped at the guard; anon refused EXECUTE
--   VERIFY 2 ok: exercise_image_count read 0,1,2,3 across three real uploads and 1 for a second account, equal to 27's formula
--   VERIFY 3 ok: 13 policies wrapped; predicates, commands, roles unchanged
--   VERIFY 4 ok: owners read only their own rows, other accounts none, the admin every row it could before; feedback resolve and error delete answer as before
--   VERIFY 5 ok: 12 client statements plan auth.uid()/is_admin() as InitPlans — once per statement, never per row
-- The Supabase SQL editor shows no NOTICEs: there, `Success` after `commit;`
-- is the proof, and an ERROR means NOTHING was applied.
-- If VERIFY 2 fails reading 0 for every upload AND names 27's formula as 0
-- too, the count reads through RLS on that server: 27's cap never bound. That
-- is a pre-existing hole this file exposed, not one it caused — stop and
-- report it; do not edit the check.
-- Every block was SEEN TO FAIL on the replica before it was trusted: 19
-- planted defects (a week bound, the plan-name order, the set count, a
-- swapped field, the guard removed, a DROP that loses the ACL, an empty and a
-- leaking image range, a policy opened, one left bare, and — with VERIFY 3
-- cut out — the calls in 4a/4b/4c/5 each catching theirs alone; three hand
-- edits for the GATE). Each aborted the file with the database byte-identical
-- afterwards. One ends in a raw error rather than a VERIFY line: an image
-- count that leaks the whole bucket makes VERIFY 2's own probe upload hit
-- the 200 cap — "new row violates row-level security policy for table
-- objects" — which is still an abort with nothing applied.
--
-- ── HOW TO APPLY (the owner) ───────────────────────────────────────────────
-- 1. Backup first — backend/docs/DB-BACKUP-RESTORE.md.
-- 2. Apply 31, 32, 33 first if they are going in (number order); 34 does not
--    need them.
-- 3. Supabase dashboard → SQL editor → New query → paste this WHOLE file →
--    Run. `Success. No rows returned` = applied and every VERIFY passed.
--    If the editor raises its "destructive operation" dialog, it is reacting
--    to VERIFY 4's probes — a DELETE of the probe's own error row, and an
--    UPDATE whose WHERE reads no column — inside a block that is always
--    rolled back. There is no DROP, TRUNCATE or unbounded DELETE in this file.
-- 4. Re-run the EXPLAIN kit rows 1, 2, 4, 6, 12, 20, 22–27 (each should
--    answer, no ERROR line; 12 and 20 should be much faster, 23 about twice
--    as fast, and the Filter lines of 1, 2, 4, 6 and 22–27 should name
--    InitPlan parameters instead of is_admin() / current_setting()), and M8
--    (storage.objects must list idx_objects_bucket_id_name — what B's range
--    rides; without it B is exactly as correct and merely no faster). Then
--    open the Console once: the users table and the error list should show
--    the same figures as before.
-- 5. Read-only live check (answers 13 | true | true | false once applied;
--    0 | false | false | false before — both seen on the replica):
--      select
--        (select count(*) from pg_policies p,
--                lateral (select replace(replace(replace(p.qual || coalesce(p.with_check, ''), 'public.', ''),
--                           '( SELECT auth.uid() AS uid)', ''), '( SELECT is_admin() AS is_admin)', '') as bare) b
--          where p.schemaname = 'public'
--            and p.policyname in ('audit_admin_read', 'feedback_admin_read', 'feedback_admin_update', 'user_flags_select',
--                                 'exercises_admin_read', 'cardio_types_admin_read', 'client_errors_select_own',
--                                 'client_errors_select_admin', 'client_errors_delete_admin', 'profiles_admin_read',
--                                 'vault_select_own', 'vault_data_admin_read', 'vault_data_history_select_own')
--            and strpos(b.bare, 'uid()') = 0 and strpos(b.bare, 'is_admin()') = 0)                     as wrapped_of_13,
--        pg_get_functiondef('public.admin_user_stats(date)'::regprocedure) like '%cross join lateral%' as stats_rewritten,
--        pg_get_functiondef('public.exercise_image_count()'::regprocedure) like '%collate pg_catalog."C"%' as image_range,
--        has_function_privilege('anon', 'public.admin_user_stats(date)', 'execute')                   as anon_can_call_stats;
-- 6. git mv this file to backend/migrations/ and move its row to §1.
-- The DOWN section at the bottom of this file puts back exactly the 25 / 27
-- bodies and the bare predicates, if ever needed.
-- ============================================================================

begin;

set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- ── GATE — the thirteen policies must read as the migrations wrote them ─────
-- Compared after reducing a bare call AND its (select …) wrap to one token,
-- so the file passes on a fresh server (bare) and on a re-run (wrapped), and
-- refuses anything else: a missing policy, another command or role set, or a
-- predicate someone changed by hand. Deparsed text is normalised (lower case,
-- no whitespace, no `public.`) so the session's search_path cannot move it.
do $$
declare
  r       record;
  hq      text;
  hc      text;
  tq      text;
  tc      text;
  wrapped integer := 0;
begin
  for r in
    select w.tbl, w.pol, w.cmd, w.roles, w.q, w.c,
           p.policyname, p.cmd as h_cmd, p.roles::text as h_roles, p.permissive as h_perm,
           p.qual as h_q, p.with_check as h_c
      from (values
        -- table                 policy                           command   roles              USING (token form)             WITH CHECK
        ('audit_log',          'audit_admin_read',              'SELECT', '{authenticated}', '{admin}',                     null::text),
        ('feedback',           'feedback_admin_read',           'SELECT', '{authenticated}', '{admin}',                     null),
        ('feedback',           'feedback_admin_update',         'UPDATE', '{authenticated}', '{admin}',                     '{admin}'),
        ('user_flags',         'user_flags_select',             'SELECT', '{authenticated}', '((user_id={uid})or{admin})',  null),
        ('exercises',          'exercises_admin_read',          'SELECT', '{authenticated}', '{admin}',                     null),
        ('cardio_types',       'cardio_types_admin_read',       'SELECT', '{authenticated}', '{admin}',                     null),
        ('client_errors',      'client_errors_select_own',      'SELECT', '{authenticated}', '(user_id={uid})',             null),
        ('client_errors',      'client_errors_select_admin',    'SELECT', '{authenticated}', '{admin}',                     null),
        ('client_errors',      'client_errors_delete_admin',    'DELETE', '{authenticated}', '{admin}',                     null),
        ('profiles',           'profiles_admin_read',           'SELECT', '{authenticated}', '{admin}',                     null),
        ('vault_data',         'vault_select_own',              'SELECT', '{public}',        '({uid}=user_id)',             null),
        ('vault_data',         'vault_data_admin_read',         'SELECT', '{public}',        '{admin}',                     null),
        ('vault_data_history', 'vault_data_history_select_own', 'SELECT', '{public}',        '({uid}=user_id)',             null)
      ) w(tbl, pol, cmd, roles, q, c)
      left join pg_catalog.pg_policies p
        on p.schemaname = 'public' and p.tablename = w.tbl and p.policyname = w.pol
  loop
    if r.policyname is null then
      raise exception 'GATE: policy % on public.% does not exist — this file alters the policy the migrations created. Nothing was applied.', r.pol, r.tbl;
    end if;
    if r.h_cmd <> r.cmd or r.h_roles <> r.roles or r.h_perm <> 'PERMISSIVE' then
      raise exception 'GATE: policy % on public.% is % % for %, the migrations made it PERMISSIVE % for %. Reconcile it first. Nothing was applied.',
        r.pol, r.tbl, r.h_perm, r.h_cmd, r.h_roles, r.cmd, r.roles;
    end if;
    hq := pg_catalog.regexp_replace(pg_catalog.lower(coalesce(r.h_q, '')), '\s+|public\.', '', 'g');
    hc := pg_catalog.regexp_replace(pg_catalog.lower(coalesce(r.h_c, '')), '\s+|public\.', '', 'g');
    tq := pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(hq,
            '(selectauth.uid()asuid)', '{uid}'), '(selectis_admin()asis_admin)', '{admin}'), 'auth.uid()', '{uid}'), 'is_admin()', '{admin}');
    tc := pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(hc,
            '(selectauth.uid()asuid)', '{uid}'), '(selectis_admin()asis_admin)', '{admin}'), 'auth.uid()', '{uid}'), 'is_admin()', '{admin}');
    if tq <> r.q or tc <> coalesce(r.c, '') then
      raise exception 'GATE: policy % on public.% reads USING (%) WITH CHECK (%) — the migrations wrote USING % WITH CHECK %. Someone changed it outside the migrations; reconcile before applying. Nothing was applied.',
        r.pol, r.tbl, r.h_q, coalesce(r.h_c, '-'), r.q, coalesce(r.c, '-');
    end if;
    -- fully wrapped = no bare call left once the wrapped forms are taken out
    if pg_catalog.strpos(pg_catalog.replace(pg_catalog.replace(hq || hc, '(selectauth.uid()asuid)', ''), '(selectis_admin()asis_admin)', ''), 'auth.uid()') = 0
       and pg_catalog.strpos(pg_catalog.replace(pg_catalog.replace(hq || hc, '(selectauth.uid()asuid)', ''), '(selectis_admin()asis_admin)', ''), 'is_admin()') = 0 then
      wrapped := wrapped + 1;
    end if;
  end loop;
  raise notice 'GATE ok: 13 policies read as the migrations wrote them (% already wrapped)', wrapped;
end $$;

-- ── A. admin_user_stats: one pass per blob ─────────────────────────────────
create or replace function public.admin_user_stats(p_week_start date default null)
returns table(user_id uuid, sessions bigint, sets bigint, volume numeric,
              foods bigint, sleeps bigint, cardio bigint, custom bigint,
              last_session date,
              week_done bigint, training_days int, plan_name text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  -- the caller's Sunday when it sends one, else the UTC Sunday (the app's WEEK_START)
  wk date := coalesce(p_week_start, (current_date - extract(dow from current_date)::int)::date);
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select vd.user_id,
    coalesce(s.n_sess, 0),
    coalesce(s.n_sets, 0),
    coalesce(s.vol, 0),
    (select coalesce(sum(jsonb_array_length(f.value)), 0)
       from jsonb_each(case when jsonb_typeof(one.d->'foodLogs')='object' then one.d->'foodLogs' else '{}'::jsonb end) f
      where jsonb_typeof(f.value) = 'array'),
    (case when jsonb_typeof(one.d->'sleep')='array'  then jsonb_array_length(one.d->'sleep')  else 0 end)::bigint,
    (case when jsonb_typeof(one.d->'cardio')='array' then jsonb_array_length(one.d->'cardio') else 0 end)::bigint,
    (select count(*) from jsonb_array_elements(
       case when jsonb_typeof(one.d->'exercises')='array' then one.d->'exercises' else '[]'::jsonb end) e
      where (e.value->>'isCustom')::boolean is true),
    s.last_d,
    coalesce(s.wk_done, 0),
    coalesce(jsonb_array_length(case when jsonb_typeof(one.d#>'{plan,trainingDays}')='array'
        then one.d#>'{plan,trainingDays}' else '[]'::jsonb end), 0),
    (select string_agg(c.val->>'name', '/' order by c.ord)
       from jsonb_array_elements(case when jsonb_typeof(one.d#>'{plan,cycle}')='array'
         then one.d#>'{plan,cycle}' else '[]'::jsonb end) with ordinality c(val, ord))
  from public.vault_data vd
  -- ONE decompression per blob: `|| '{}'` hands back a detoasted copy, and
  -- OFFSET 0 keeps it a single evaluation that every expression below reads
  cross join lateral (select vd.data || '{}'::jsonb as d offset 0) one
  -- sessions and sets, aggregated for THIS blob only (25 rescanned every blob's)
  left join lateral (
    select count(*)::bigint                    as n_sess,
           coalesce(sum(x.k), 0)::bigint       as n_sets,
           coalesce(sum(x.v), 0)::numeric      as vol,
           max(x.dt)                           as last_d,
           (count(distinct x.dt) filter (where x.dt >= wk and x.dt < wk + 7))::bigint as wk_done
    from (
      select case when (ss.val->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (ss.val->>'date')::date end as dt,
             st.k, st.v
      from jsonb_array_elements(case when jsonb_typeof(one.d->'sessions')='array' then one.d->'sessions' else '[]'::jsonb end) ss(val)
      cross join lateral (
        select count(*) as k,
               sum(coalesce((z.val->>'reps')::numeric, 0) * coalesce((z.val->>'weight')::numeric, 0)) as v
        from jsonb_array_elements(case when jsonb_typeof(ss.val->'sets')='array' then ss.val->'sets' else '[]'::jsonb end) z(val)
      ) st
    ) x
  ) s on true;
end;
$$;

-- CREATE OR REPLACE keeps the ACL; re-asserted so the file stands on its own (contract 28)
revoke all on function public.admin_user_stats(date) from public, anon;
grant execute on function public.admin_user_stats(date) to authenticated;

-- ── VERIFY 1: the same rows as 25, the known answer, and the same doors ─────
do $$
declare
  v34_m      uuid := pg_catalog.gen_random_uuid();   -- a throwaway ADMIN (registered below; rolled back)
  v34_k      uuid := pg_catalog.gen_random_uuid();   -- a throwaway user whose blob has a known answer
  v34_sun    date := (current_date - extract(dow from current_date)::int)::date;
  p_week_start date;                                  -- the name 25's query reads (pasted verbatim below)
  v34_want   bigint;
  v34_diff   bigint;
  v34_rows   bigint;
  v34_all    bigint;
  v34_got    record;
  v34_caught text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (v34_m, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify34-' || v34_m || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (v34_k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify34-' || v34_k || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  insert into public.admins (user_id) values (v34_m);

  -- K writes its blob through the app's own insert path. Its known answer:
  -- 6 sessions (two on this Sunday, one next week, one last Saturday, one with
  -- a malformed date and non-array sets, one that is not even an object),
  -- 3 sets, volume 5*100 + 3*120 + 10*20 = 1060, 2 foods (a non-array day is
  -- skipped), 2 sleeps, 1 cardio, 1 custom exercise ("false" as a string is
  -- not custom), last session next Monday, 2 training days, plan 'A/B' (a
  -- cycle slot with no name is skipped).
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', v34_k, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.vault_data (user_id, data) values (v34_k, pg_catalog.jsonb_build_object(
    'sessions', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('date', pg_catalog.to_char(v34_sun, 'YYYY-MM-DD'), 'sets', '[{"reps":5,"weight":100},{"reps":3,"weight":120}]'::jsonb),
      pg_catalog.jsonb_build_object('date', pg_catalog.to_char(v34_sun, 'YYYY-MM-DD'), 'sets', '[{"reps":10,"weight":20}]'::jsonb),
      pg_catalog.jsonb_build_object('date', pg_catalog.to_char(v34_sun + 8, 'YYYY-MM-DD')),
      pg_catalog.jsonb_build_object('date', pg_catalog.to_char(v34_sun - 1, 'YYYY-MM-DD')),
      '{"date":"2026-9-1","sets":"x"}'::jsonb,
      '7'::jsonb),
    'foodLogs',  '{"a":[1,2],"b":"x","c":[]}'::jsonb,
    'sleep',     '[{},{}]'::jsonb,
    'cardio',    '[{}]'::jsonb,
    'exercises', '[{"isCustom":true},{"isCustom":"false"},{}]'::jsonb,
    'plan',      '{"trainingDays":[1,2],"cycle":[{"name":"A"},{"x":1},{"name":"B"}]}'::jsonb));

  -- 1a. K is not an admin: both argument forms run the body to its guard
  begin
    perform pg_catalog.count(*) from public.admin_user_stats();
    v34_caught := 'accepted';
  exception when raise_exception then v34_caught := sqlerrm; end;
  if v34_caught <> 'not authorized' then
    raise exception 'VERIFY 1a failed: a non-admin calling admin_user_stats() got "%"', v34_caught;
  end if;
  begin
    perform pg_catalog.count(*) from public.admin_user_stats(v34_sun);
    v34_caught := 'accepted';
  exception when raise_exception then v34_caught := sqlerrm; end;
  if v34_caught <> 'not authorized' then
    raise exception 'VERIFY 1a failed: a non-admin calling admin_user_stats(date) got "%"', v34_caught;
  end if;
  reset role;

  -- 1b. anon holds no EXECUTE at all
  set local role anon;
  begin
    perform pg_catalog.count(*) from public.admin_user_stats(v34_sun);
    v34_caught := 'accepted';
  exception when insufficient_privilege then v34_caught := 'refused'; end;
  reset role;
  if v34_caught <> 'refused' then
    raise exception 'VERIFY 1b failed: anon calling admin_user_stats(date) was %', v34_caught;
  end if;

  -- 1c. as the admin, K's row is the known answer in four week windows
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', v34_m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  foreach p_week_start in array array[null, v34_sun - 7, v34_sun + 7, '2020-01-05']::date[] loop
    v34_want := case when p_week_start = '2020-01-05' then 0 else 1 end;
    select * into v34_got from public.admin_user_stats(p_week_start) s where s.user_id = v34_k;
    if not found then
      raise exception 'VERIFY 1c failed: for week % the admin read no row for the known blob', coalesce(p_week_start::text, 'default');
    end if;
    if (v34_got.sessions, v34_got.sets, v34_got.volume, v34_got.foods, v34_got.sleeps, v34_got.cardio,
           v34_got.custom, v34_got.last_session, v34_got.week_done, v34_got.training_days, v34_got.plan_name)
          is distinct from
          (6::bigint, 3::bigint, 1060::numeric, 2::bigint, 2::bigint, 1::bigint,
           1::bigint, v34_sun + 8, v34_want, 2, 'A/B'::text) then
      raise exception 'VERIFY 1c failed: for week % the known blob reads %', coalesce(p_week_start::text, 'default'), v34_got;
    end if;
  end loop;

  -- 1d. identical to 25's body, row for row, on every blob in this database.
  --     The inner query is 25's `return query` text, pasted unchanged.
  foreach p_week_start in array array[null, v34_sun - 7, current_date + 7]::date[] loop
    with before_rows(user_id, sessions, sets, volume, foods, sleeps, cardio, custom,
                     last_session, week_done, training_days, plan_name) as materialized (
      with wk as (select coalesce(p_week_start, (current_date - extract(dow from current_date)::int)::date) as d),
      v as (select vd.user_id as uid, vd.data from public.vault_data vd),
      sess as (
        select v.uid, s.val as s,
               case when (s.val->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (s.val->>'date')::date end as d
        from v, lateral jsonb_array_elements(
          case when jsonb_typeof(v.data->'sessions')='array' then v.data->'sessions' else '[]'::jsonb end
        ) as s(val)
      ),
      sets as (
        select sess.uid,
               coalesce((x.val->>'reps')::numeric, 0)   as reps,
               coalesce((x.val->>'weight')::numeric, 0) as weight
        from sess, lateral jsonb_array_elements(
          case when jsonb_typeof(sess.s->'sets')='array' then sess.s->'sets' else '[]'::jsonb end
        ) as x(val)
      )
      select v.uid,
        (select count(*) from sess where sess.uid = v.uid),
        (select count(*) from sets where sets.uid = v.uid),
        (select coalesce(sum(reps * weight), 0) from sets where sets.uid = v.uid),
        (select coalesce(sum(jsonb_array_length(d.value)), 0)
           from jsonb_each(case when jsonb_typeof(v.data->'foodLogs')='object' then v.data->'foodLogs' else '{}'::jsonb end) d
           where jsonb_typeof(d.value) = 'array'),
        (case when jsonb_typeof(v.data->'sleep')='array'  then jsonb_array_length(v.data->'sleep')  else 0 end)::bigint,
        (case when jsonb_typeof(v.data->'cardio')='array' then jsonb_array_length(v.data->'cardio') else 0 end)::bigint,
        (select count(*) from jsonb_array_elements(
           case when jsonb_typeof(v.data->'exercises')='array' then v.data->'exercises' else '[]'::jsonb end) e
           where (e.value->>'isCustom')::boolean is true),
        (select max(sess.d) from sess where sess.uid = v.uid),
        (select count(distinct sess.d) from sess, wk
           where sess.uid = v.uid and sess.d >= wk.d and sess.d < wk.d + 7),
        coalesce(jsonb_array_length(case when jsonb_typeof(v.data#>'{plan,trainingDays}')='array'
            then v.data#>'{plan,trainingDays}' else '[]'::jsonb end), 0),
        (select string_agg(c.val->>'name', '/' order by ord)
           from jsonb_array_elements(case when jsonb_typeof(v.data#>'{plan,cycle}')='array'
             then v.data#>'{plan,cycle}' else '[]'::jsonb end) with ordinality c(val, ord))
      from v
    ),
    after_rows as materialized (select * from public.admin_user_stats(p_week_start))
    select (select pg_catalog.count(*) from (select b::text from before_rows b except all select a::text from after_rows a) x)
         + (select pg_catalog.count(*) from (select a::text from after_rows a except all select b::text from before_rows b) y),
           (select pg_catalog.count(*) from after_rows)
      into v34_diff, v34_rows;
    if v34_diff <> 0 then
      raise exception 'VERIFY 1d failed: for week % the new body and 25''s differ in % rows — nothing was applied', coalesce(p_week_start::text, 'default'), v34_diff;
    end if;
  end loop;
  reset role;

  select pg_catalog.count(*) into v34_all from public.vault_data;   -- as the table owner: every blob
  if v34_rows <> v34_all then
    raise exception 'VERIFY 1d failed: the admin read % rows of % blobs', v34_rows, v34_all;
  end if;
  raise exception 'ROLLBACK-OK: VERIFY 1';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 1') = 0 then raise; end if;
    raise notice 'VERIFY 1 ok: admin_user_stats — the known answer in 4 windows; identical to 25''s body on every row in 3 windows; non-admin stopped at the guard; anon refused EXECUTE';
end $$;

-- ── B. exercise_image_count: an index range over the caller's own folder ────
create or replace function public.exercise_image_count()
returns integer
language sql
security definer
set search_path to ''
stable
as $$
  select pg_catalog.count(*)::integer
  from storage.objects o
  where o.bucket_id = 'exercise-images'
    -- exactly the names that begin `<uid>/`, in byte order: what
    -- idx_objects_bucket_id_name (bucket_id, name COLLATE "C") serves
    and o.name collate pg_catalog."C" >= ((select auth.uid())::text || '/')
    and o.name collate pg_catalog."C" <  ((select auth.uid())::text || '0')
    -- 27's own test, kept: the count is the same number
    and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;
revoke all on function public.exercise_image_count() from public, anon;
grant execute on function public.exercise_image_count() to authenticated;

-- ── VERIFY 2: the count counts the caller's uploads, through the real upload ─
do $$
declare
  p      uuid := pg_catalog.gen_random_uuid();
  q      uuid := pg_catalog.gen_random_uuid();
  seen   integer[] := '{}';
  q_n    integer;
  old_n  bigint;
  i      integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (p, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify34-' || p || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (q, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify34-' || q || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);

  -- P uploads three photos through the bucket's INSERT policy (which itself
  -- calls exercise_image_count() and exercise_image_exists() — no 42P17),
  -- reading its count before each and after the last
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', p, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..3 loop
    seen := seen || public.exercise_image_count();
    insert into storage.objects (bucket_id, name, owner) values ('exercise-images', p || '/verify34_' || i || '.jpg', p);
  end loop;
  seen := seen || public.exercise_image_count();
  reset role;

  -- Q uploads one; its count is its own, not P's
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', q, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name, owner) values ('exercise-images', q || '/verify34_1.jpg', q);
  q_n := public.exercise_image_count();
  reset role;

  -- 27's formula, as the function's owner (the role a SECURITY DEFINER body runs as)
  select pg_catalog.count(*) into old_n from storage.objects o
   where o.bucket_id = 'exercise-images' and (storage.foldername(o.name))[1] = p::text;

  if seen is distinct from array[0, 1, 2, 3] or q_n <> 1 or old_n <> 3 then
    raise exception 'VERIFY 2 failed: exercise_image_count() read % across three uploads (expected {0,1,2,3}) and % for a second account (expected 1); 27''s formula counts % for the first — if both read 0, the count reads through RLS on this server and 27''s cap never bound', seen, q_n, old_n;
  end if;
  raise exception 'ROLLBACK-OK: VERIFY 2';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 2') = 0 then raise; end if;
    raise notice 'VERIFY 2 ok: exercise_image_count read 0,1,2,3 across three real uploads and 1 for a second account, equal to 27''s formula';
end $$;

-- ── C. the thirteen policies: (select …) — once per statement ──────────────
-- Quietest tables first, vault_data before vault_data_history (see LOCKS).
-- Each predicate is the migrations' own text with the call wrapped; nothing else.
alter policy audit_admin_read              on public.audit_log          using ((select public.is_admin()));                             -- 07
alter policy feedback_admin_read           on public.feedback           using ((select public.is_admin()));                             -- 06
alter policy feedback_admin_update         on public.feedback           using ((select public.is_admin()))
                                                                        with check ((select public.is_admin()));                        -- 06
alter policy user_flags_select             on public.user_flags         using (user_id = (select auth.uid()) or (select public.is_admin())); -- 06
alter policy exercises_admin_read          on public.exercises          using ((select public.is_admin()));                             -- 05
alter policy cardio_types_admin_read       on public.cardio_types       using ((select public.is_admin()));                             -- 05
alter policy client_errors_select_own      on public.client_errors      using (user_id = (select auth.uid()));                          -- 11
alter policy client_errors_select_admin    on public.client_errors      using ((select public.is_admin()));                             -- 11
alter policy client_errors_delete_admin    on public.client_errors      using ((select public.is_admin()));                             -- 11
alter policy profiles_admin_read           on public.profiles           using ((select public.is_admin()));                             -- 05
alter policy vault_select_own              on public.vault_data         using ((select auth.uid()) = user_id);                          -- 01
alter policy vault_data_admin_read         on public.vault_data         using ((select public.is_admin()));                             -- 18
alter policy vault_data_history_select_own on public.vault_data_history using ((select auth.uid()) = user_id);                          -- 20

-- ── VERIFY 3: the thirteen now read wrapped, and nothing else about them moved ─
-- A catalog read, because what it checks IS a catalog fact (the stored
-- predicate, command and roles); VERIFY 4 and 5 then prove it by calling.
do $$
declare
  r      record;
  hq     text;
  hc     text;
  want_q text;
  want_c text;
begin
  for r in
    select w.tbl, w.pol, w.cmd, w.roles, w.q, w.c,
           p.policyname, p.cmd as h_cmd, p.roles::text as h_roles, p.permissive as h_perm,
           p.qual as h_q, p.with_check as h_c
      from (values
        ('audit_log',          'audit_admin_read',              'SELECT', '{authenticated}', '{admin}',                     null::text),
        ('feedback',           'feedback_admin_read',           'SELECT', '{authenticated}', '{admin}',                     null),
        ('feedback',           'feedback_admin_update',         'UPDATE', '{authenticated}', '{admin}',                     '{admin}'),
        ('user_flags',         'user_flags_select',             'SELECT', '{authenticated}', '((user_id={uid})or{admin})',  null),
        ('exercises',          'exercises_admin_read',          'SELECT', '{authenticated}', '{admin}',                     null),
        ('cardio_types',       'cardio_types_admin_read',       'SELECT', '{authenticated}', '{admin}',                     null),
        ('client_errors',      'client_errors_select_own',      'SELECT', '{authenticated}', '(user_id={uid})',             null),
        ('client_errors',      'client_errors_select_admin',    'SELECT', '{authenticated}', '{admin}',                     null),
        ('client_errors',      'client_errors_delete_admin',    'DELETE', '{authenticated}', '{admin}',                     null),
        ('profiles',           'profiles_admin_read',           'SELECT', '{authenticated}', '{admin}',                     null),
        ('vault_data',         'vault_select_own',              'SELECT', '{public}',        '({uid}=user_id)',             null),
        ('vault_data',         'vault_data_admin_read',         'SELECT', '{public}',        '{admin}',                     null),
        ('vault_data_history', 'vault_data_history_select_own', 'SELECT', '{public}',        '({uid}=user_id)',             null)
      ) w(tbl, pol, cmd, roles, q, c)
      left join pg_catalog.pg_policies p
        on p.schemaname = 'public' and p.tablename = w.tbl and p.policyname = w.pol
  loop
    hq := pg_catalog.regexp_replace(pg_catalog.lower(coalesce(r.h_q, '')), '\s+|public\.', '', 'g');
    hc := pg_catalog.regexp_replace(pg_catalog.lower(coalesce(r.h_c, '')), '\s+|public\.', '', 'g');
    want_q := pg_catalog.replace(pg_catalog.replace(r.q, '{uid}', '(selectauth.uid()asuid)'), '{admin}', '(selectis_admin()asis_admin)');
    want_c := pg_catalog.replace(pg_catalog.replace(coalesce(r.c, ''), '{uid}', '(selectauth.uid()asuid)'), '{admin}', '(selectis_admin()asis_admin)');
    if r.policyname is null or r.h_cmd <> r.cmd or r.h_roles <> r.roles or r.h_perm <> 'PERMISSIVE'
       or hq <> want_q or hc <> want_c then
      raise exception 'VERIFY 3 failed: policy % on public.% is % % for % USING (%) WITH CHECK (%)',
        r.pol, r.tbl, r.h_perm, r.h_cmd, r.h_roles, r.h_q, coalesce(r.h_c, '-');
    end if;
  end loop;
  raise notice 'VERIFY 3 ok: 13 policies wrapped; predicates, commands, roles unchanged';
end $$;

-- ── VERIFY 4: who reads what — every rewritten policy, called ──────────────
-- Two throwaway users (A, B) write what the app writes, as `authenticated`;
-- a throwaway admin (M) reads. Section C holds ACCESS EXCLUSIVE on all nine
-- tables, so nobody else's row can land between two counts.
do $$
declare
  a     uuid := pg_catalog.gen_random_uuid();
  b     uuid := pg_catalog.gen_random_uuid();
  m     uuid := pg_catalog.gen_random_uuid();
  u     uuid;
  r     record;
  own_n bigint;
  oth_n bigint;
  e_own bigint;
  e_oth bigint;
  tot   bigint;
  fid   uuid;
  n     integer;
  n2    integer;
begin
  foreach u in array array[a, b, m] loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'verify34-' || u || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  end loop;
  insert into public.admins (user_id) values (m);
  insert into public.user_flags (user_id) values (a);                         -- what admin_set_role/_status write
  perform public.audit('verify34.probe', a, '{}'::jsonb);                    -- what every admin RPC writes

  foreach u in array array[a, b] loop
    perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.vault_data (user_id, data) values (u, '{"v":1}'::jsonb);
    update public.vault_data set data = '{"v":2}'::jsonb where user_id = u;          -- files one history row
    insert into public.client_errors (user_id, build, kind, msg) values (u, 'verify34', 'manual', 'verify34 probe');
    insert into public.profiles (user_id) values (u);
    insert into public.exercises (id, owner_id, name) values (pg_catalog.gen_random_uuid(), u, 'verify34');
    insert into public.cardio_types (id, owner_id, label) values ('verify34-' || u, u, 'verify34');
    reset role;
  end loop;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.feedback (user_id, message) values (a, 'verify34 probe');       -- the author cannot read it back (06)
  reset role;
  select f.id into fid from public.feedback f where f.user_id = a;

  -- 4a. each reader against each table: (own rows, anyone else's rows)
  for r in
    select * from (values
      -- table                owner col   filter                          A own/else  B own/else  the admin reads every row
      ('vault_data',         'user_id',  '',                             1, 0,       1, 0,       true),
      ('vault_data_history', 'user_id',  '',                             1, 0,       1, 0,       false),  -- no admin read on history, by design
      ('client_errors',      'user_id',  '',                             1, 0,       1, 0,       true),
      ('feedback',           'user_id',  '',                             0, 0,       0, 0,       true),
      ('user_flags',         'user_id',  '',                             1, 0,       0, 0,       true),
      ('audit_log',          'actor',    '',                             0, 0,       0, 0,       true),
      ('profiles',           'user_id',  '',                             1, 0,       1, 0,       true),
      ('exercises',          'owner_id', ' where owner_id is not null',  1, 0,       1, 0,       true),   -- the global catalog is everyone's
      ('cardio_types',       'owner_id', ' where owner_id is not null',  1, 0,       1, 0,       true)
    ) x(tbl, col, filt, a_own, a_oth, b_own, b_oth, admin_all)
  loop
    foreach u in array array[a, b] loop
      perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', u, 'role', 'authenticated')::text, true);
      set local role authenticated;
      execute pg_catalog.format('select count(*) filter (where %1$I = $1), count(*) filter (where %1$I is distinct from $1) from public.%2$I%3$s',
                                r.col, r.tbl, r.filt)
        into own_n, oth_n using u;
      reset role;
      if u = a then e_own := r.a_own; e_oth := r.a_oth; else e_own := r.b_own; e_oth := r.b_oth; end if;
      if own_n <> e_own or oth_n <> e_oth then
        raise exception 'VERIFY 4a failed: user % reads % of its own and % other rows in public.%', case when u = a then 'A' else 'B' end, own_n, oth_n, r.tbl;
      end if;
    end loop;
    perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', m, 'role', 'authenticated')::text, true);
    set local role authenticated;
    execute pg_catalog.format('select count(*) from public.%I%s', r.tbl, r.filt) into own_n;
    reset role;
    execute pg_catalog.format('select count(*) from public.%I%s', r.tbl, r.filt) into tot;     -- the table owner: every row
    if (r.admin_all and own_n <> tot) or (not r.admin_all and own_n <> 0) then
      raise exception 'VERIFY 4a failed: the admin reads % of % rows in public.%', own_n, tot, r.tbl;
    end if;
  end loop;

  -- 4b. resolving feedback: the author cannot, the admin can (USING and WITH CHECK).
  --     The author holds no SELECT policy on feedback, so an UPDATE whose WHERE
  --     reads a column is refused by the SELECT side before feedback_admin_update
  --     is ever asked — that first probe alone cannot see a broken UPDATE policy
  --     (seen on the replica: USING (true) passed it). The second reads no column
  --     (its WHERE is a variable), so the UPDATE policy alone decides; a USING that
  --     let the author through would reach every row here, rolled back with the block.
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.feedback f set status = 'resolved' where f.id = fid;
  get diagnostics n = row_count;
  update public.feedback set status = 'resolved' where fid is not null;
  get diagnostics n2 = row_count;
  reset role;
  if n <> 0 or n2 <> 0 then
    raise exception 'VERIFY 4b failed: the author resolved feedback (% rows by id, % rows with a column-free WHERE)', n, n2;
  end if;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.feedback f set status = 'resolved' where f.id = fid;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 or not exists (select 1 from public.feedback f where f.id = fid and f.status = 'resolved') then
    raise exception 'VERIFY 4b failed: the admin resolve updated % rows', n;
  end if;

  -- 4c. client_errors_delete_admin. No client role holds DELETE on client_errors
  --     (15, 30): the Console prunes through the definer admin_prune_client_errors().
  --     This grant exists only so the policy can be called; it is rolled back
  --     with the block (the notice below re-checks that it did not survive).
  grant delete on public.client_errors to authenticated;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.client_errors e where e.user_id = a;
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'VERIFY 4c failed: a user deleted % of its own error rows', n; end if;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.client_errors e where e.user_id = a;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'VERIFY 4c failed: the admin deleted % of the probe''s 1 error row', n; end if;

  raise exception 'ROLLBACK-OK: VERIFY 4';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 4') = 0 then raise; end if;
    if pg_catalog.has_table_privilege('authenticated', 'public.client_errors', 'delete') then
      raise exception 'VERIFY 4 failed: the probe''s DELETE grant on client_errors survived the rollback';
    end if;
    raise notice 'VERIFY 4 ok: owners read only their own rows, other accounts none, the admin every row it could before; feedback resolve and error delete answer as before';
end $$;

-- ── VERIFY 5: the plans — auth.uid()/is_admin() once per statement ─────────
-- EXPLAIN (no ANALYZE: nothing executes) of the statements the clients send,
-- as `authenticated`. A bare call shows up per row in a Filter — is_admin() by
-- name, auth.uid() inlined as current_setting(); wrapped, each is an InitPlan.
-- Both conditions are required, so a plan with no RLS at all cannot pass.
do $$
declare
  me   uuid := pg_catalog.gen_random_uuid();
  q    text;
  line text;
  plan text;
begin
  grant delete on public.client_errors to authenticated;       -- for the DELETE plan only; rolled back
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', me, 'role', 'authenticated')::text, true);
  set local role authenticated;
  foreach q in array array[
    pg_catalog.format('select * from public.vault_data where user_id = %L', me),                                  -- pull (cloud.js)
    'select user_id, data from public.vault_data limit 1000',                                                    -- Console (admin.html:755, 1423)
    pg_catalog.format('select id, version, replaced_at from public.vault_data_history where user_id = %L order by replaced_at desc limit 10', me),
    'select id, user_id, build, kind, msg, src, line, created_at from public.client_errors order by id desc limit 1000',  -- admin.html:775
    'select * from public.feedback limit 1000',
    pg_catalog.format('select role, status, reason from public.user_flags where user_id = %L', me),              -- getMyFlags
    'select id, actor, action, target, detail, created_at from public.audit_log order by id desc limit 1000',
    'select user_id, username, created_at, last_seen from public.profiles limit 1000',
    'select id, name, category, owner_id, deleted_at from public.exercises limit 1000',
    'select * from public.cardio_types limit 1000',
    'update public.feedback set status = ''resolved'' where id = ''00000000-0000-0000-0000-000000000000''',
    'delete from public.client_errors where id = -1'
  ] loop
    plan := '';
    for line in execute 'explain (costs off) ' || q loop
      plan := plan || line || E'\n';
    end loop;
    if pg_catalog.strpos(plan, 'InitPlan') = 0 or plan ~ '(is_admin|auth\.uid|current_setting)\(' then
      raise exception 'VERIFY 5 failed: [%] still evaluates a policy call per row:%', q, E'\n' || plan;
    end if;
  end loop;
  reset role;
  raise exception 'ROLLBACK-OK: VERIFY 5';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 5') = 0 then raise; end if;
    if pg_catalog.has_table_privilege('authenticated', 'public.client_errors', 'delete') then
      raise exception 'VERIFY 5 failed: the probe''s DELETE grant on client_errors survived the rollback';
    end if;
    raise notice 'VERIFY 5 ok: 12 client statements plan auth.uid()/is_admin() as InitPlans — once per statement, never per row';
end $$;

commit;

-- ============================================================================
-- DOWN — puts back exactly what 25, 27 and 01/05/06/07/11/18/20 left. Fully
-- reversible: no row of data is involved, only function bodies and policy
-- predicates. Paste as one block if ever needed:
--
-- begin;
-- set local lock_timeout = '3s';
-- create or replace function public.admin_user_stats(p_week_start date default null)
-- returns table(user_id uuid, sessions bigint, sets bigint, volume numeric,
--               foods bigint, sleeps bigint, cardio bigint, custom bigint,
--               last_session date,
--               week_done bigint, training_days int, plan_name text)
-- language plpgsql security definer set search_path to '' as $$
-- begin
--   if not public.is_admin() then
--     raise exception 'not authorized';
--   end if;
--   return query
--   -- the caller's Sunday when it sends one, else the UTC Sunday (the app's WEEK_START)
--   with wk as (select coalesce(p_week_start, (current_date - extract(dow from current_date)::int)::date) as d),
--   v as (select vd.user_id as uid, vd.data from public.vault_data vd),
--   sess as (
--     select v.uid, s.val as s,
--            case when (s.val->>'date') ~ '^\d{4}-\d{2}-\d{2}$' then (s.val->>'date')::date end as d
--     from v, lateral jsonb_array_elements(
--       case when jsonb_typeof(v.data->'sessions')='array' then v.data->'sessions' else '[]'::jsonb end
--     ) as s(val)
--   ),
--   sets as (
--     select sess.uid,
--            coalesce((x.val->>'reps')::numeric, 0)   as reps,
--            coalesce((x.val->>'weight')::numeric, 0) as weight
--     from sess, lateral jsonb_array_elements(
--       case when jsonb_typeof(sess.s->'sets')='array' then sess.s->'sets' else '[]'::jsonb end
--     ) as x(val)
--   )
--   select v.uid,
--     (select count(*) from sess where sess.uid = v.uid),
--     (select count(*) from sets where sets.uid = v.uid),
--     (select coalesce(sum(reps * weight), 0) from sets where sets.uid = v.uid),
--     (select coalesce(sum(jsonb_array_length(d.value)), 0)
--        from jsonb_each(case when jsonb_typeof(v.data->'foodLogs')='object' then v.data->'foodLogs' else '{}'::jsonb end) d
--        where jsonb_typeof(d.value) = 'array'),
--     (case when jsonb_typeof(v.data->'sleep')='array'  then jsonb_array_length(v.data->'sleep')  else 0 end)::bigint,
--     (case when jsonb_typeof(v.data->'cardio')='array' then jsonb_array_length(v.data->'cardio') else 0 end)::bigint,
--     (select count(*) from jsonb_array_elements(
--        case when jsonb_typeof(v.data->'exercises')='array' then v.data->'exercises' else '[]'::jsonb end) e
--        where (e.value->>'isCustom')::boolean is true),
--     (select max(sess.d) from sess where sess.uid = v.uid),
--     (select count(distinct sess.d) from sess, wk
--        where sess.uid = v.uid and sess.d >= wk.d and sess.d < wk.d + 7),
--     coalesce(jsonb_array_length(case when jsonb_typeof(v.data#>'{plan,trainingDays}')='array'
--         then v.data#>'{plan,trainingDays}' else '[]'::jsonb end), 0),
--     (select string_agg(c.val->>'name', '/' order by ord)
--        from jsonb_array_elements(case when jsonb_typeof(v.data#>'{plan,cycle}')='array'
--          then v.data#>'{plan,cycle}' else '[]'::jsonb end) with ordinality c(val, ord))
--   from v;
-- end;
-- $$;
-- revoke all on function public.admin_user_stats(date) from public, anon;
-- grant execute on function public.admin_user_stats(date) to authenticated;
--
-- create or replace function public.exercise_image_count()
-- returns integer language sql security definer set search_path to '' stable as $$
--   select pg_catalog.count(*)::integer
--   from storage.objects o
--   where o.bucket_id = 'exercise-images'
--     and (storage.foldername(o.name))[1] = (select auth.uid())::text;
-- $$;
-- revoke all on function public.exercise_image_count() from public, anon;
-- grant execute on function public.exercise_image_count() to authenticated;
--
-- alter policy audit_admin_read              on public.audit_log          using (public.is_admin());
-- alter policy feedback_admin_read           on public.feedback           using (public.is_admin());
-- alter policy feedback_admin_update         on public.feedback           using (public.is_admin()) with check (public.is_admin());
-- alter policy user_flags_select             on public.user_flags         using (user_id = (select auth.uid()) or public.is_admin());
-- alter policy exercises_admin_read          on public.exercises          using (public.is_admin());
-- alter policy cardio_types_admin_read       on public.cardio_types       using (public.is_admin());
-- alter policy client_errors_select_own      on public.client_errors      using (user_id = auth.uid());
-- alter policy client_errors_select_admin    on public.client_errors      using (public.is_admin());
-- alter policy client_errors_delete_admin    on public.client_errors      using (public.is_admin());
-- alter policy profiles_admin_read           on public.profiles           using (public.is_admin());
-- alter policy vault_select_own              on public.vault_data         using (auth.uid() = user_id);
-- alter policy vault_data_admin_read         on public.vault_data         using (public.is_admin());
-- alter policy vault_data_history_select_own on public.vault_data_history using (auth.uid() = user_id);
-- commit;
-- ============================================================================
