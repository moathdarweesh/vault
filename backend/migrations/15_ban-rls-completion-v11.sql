-- ============================================================================
-- 15_ban-rls-completion-v11.sql
--
-- Closes the gap migration 12 left open, and hardens two grants around it.
-- Safe to re-run: every policy is dropped-if-exists before it is created, and
-- the grant statements are absolute (not additive).
--
-- WHY THIS EXISTS
-- ---------------
-- 12_ban-rls-v10.sql looped over a hand-written `mirror_tables` array and
-- skipped, with `continue` and no notice, any name that did not exist. The
-- array was wrong on BOTH sides:
--
--   * it named 5 tables that never existed in this project --
--     user_cardio_types, user_foods, body_weight, water_logs, nutrition_targets
--     (they are from the deferred social/normalised draft), and
--   * it omitted 4 tables that do exist and that js/tables.js writes on every
--     projection -- exercises, cardio_types, foods, user_prefs.
--
-- So the run created 11 policy pairs where the author, the migration README and
-- CLAUDE.md all recorded 16. The silent `continue` is what hid it, and the
-- VERIFY query only checked that policies named '%_ban_%' existed -- never that
-- the count matched the table list. A banned account could therefore still
-- INSERT and UPDATE its own rows in those four tables.
--
-- Two independent reviews reached this finding separately, and the table list
-- below was then re-derived from 02_schema-v2.sql rather than copied from
-- either of them.
--
-- Scope note: this is NOT a cross-user isolation break. RLS still scopes every
-- one of these tables to auth.uid(); the failure is that a moderation control
-- documented as complete was narrower than documented.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. The four missing mirror tables.
--
-- is_banned() reads no column of the row, so the same restrictive predicate
-- works whether the table keys ownership on user_id or owner_id. RESTRICTIVE
-- composes with AND, so a user who is not banned is completely unaffected --
-- and SELECT is deliberately untouched, so the global catalog rows
-- (owner_id is null) stay readable to everyone including banned accounts.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  missing text[] := array['exercises', 'cardio_types', 'foods', 'user_prefs'];
begin
  foreach t in array missing loop
    -- Fail LOUDLY. A silent skip is the exact mechanism that hid the original
    -- gap for three migrations; a missing table here is a bug in this file.
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise exception 'table public.% does not exist -- fix this migration, do not skip it', t;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_ban_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check (not public.is_banned())', t || '_ban_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_ban_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
         using (not public.is_banned()) with check (not public.is_banned())',
      t || '_ban_update', t);

    raise notice 'ban policies applied to %', t;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. profiles: close the delete-then-insert re-brand.
--
-- 12 restricted UPDATE only, so a banned user could delete their own profiles
-- row (DELETE is deliberately open, for erasure) and INSERT a fresh one under a
-- new @handle -- a full re-brand, which is precisely what the ban was meant to
-- stop. DELETE stays open on purpose: the right to erasure outranks the ban.
-- ----------------------------------------------------------------------------
drop policy if exists profiles_ban_insert on public.profiles;
create policy profiles_ban_insert on public.profiles
  as restrictive for insert to authenticated
  with check (not public.is_banned());

-- ----------------------------------------------------------------------------
-- 3. client_errors: the double-lock every other table already has.
--
-- 11_client-errors-v9.sql created the table and its four policies but never ran
-- the revoke/grant pair that 06, 07 and 09 apply everywhere else, so Supabase's
-- default `grant all to anon, authenticated` survived on it. RLS still held the
-- line -- there is no UPDATE policy for any role, and every policy is `to
-- authenticated`, so anon matches none -- but the guarantee rested on one layer
-- instead of two.
--
-- DELETE is granted to nobody: no client deletes these rows. Pruning goes
-- through admin_prune_client_errors(), which is SECURITY DEFINER and therefore
-- runs with the owner's privileges, not the caller's.
-- ----------------------------------------------------------------------------
revoke all on public.client_errors from anon, authenticated, public;
grant select, insert on public.client_errors to authenticated;

commit;

-- ============================================================================
-- VERIFY -- run after committing. Each query states its own pass condition.
-- ============================================================================

-- 1. Every client-writable user table now carries BOTH ban policies.
--    Expect: 15 rows, every one of them ins=1 and upd=1. Zero rows with a 0.
select
  c.relname                                                         as table_name,
  count(*) filter (where p.polname like '%\_ban\_insert')           as ins,
  count(*) filter (where p.polname like '%\_ban\_update')           as upd
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'workout_sessions','workout_sets','cardio_logs','food_logs','sleep_logs',
    'plan_days','plan_day_exercises','supplements','supplement_logs',
    'user_exercise_prefs','health_prefs','exercises','cardio_types','foods','user_prefs'
  )
group by c.relname
order by ins, upd, c.relname;

-- 2. profiles: insert + update both banned, delete deliberately open.
--    Expect exactly: profiles_ban_insert, profiles_ban_update.
select polname from pg_policy
where polrelid = 'public.profiles'::regclass and polname like '%\_ban\_%'
order by polname;

-- 3. client_errors grants are exactly SELECT + INSERT for authenticated,
--    and nothing at all for anon. Expect 2 rows, both 'authenticated'.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'client_errors'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by grantee, privilege_type;

-- 4. The assertion migration 12 should have carried: the number of tables with
--    a complete ban pair must equal the number of client-writable user tables.
--    Expect: banned_pairs = 15.
select count(*) as banned_pairs from (
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
    and p.polname like '%\_ban\_%'
    and c.relname <> 'profiles'
  group by c.relname
  having count(*) filter (where p.polname like '%\_ban\_insert') = 1
     and count(*) filter (where p.polname like '%\_ban\_update') = 1
) q;
