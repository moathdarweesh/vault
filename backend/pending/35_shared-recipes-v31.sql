-- ============================================================================
-- 35_shared-recipes-v31.sql — «اقتراحات»: recipes users share with each other,
-- published only after the AI moderator approves them, and read by every
-- signed-in account without the author's name.
--
-- NOT APPLIED. It is in backend/pending/ on purpose: a LIVE WRITE to the
-- owner's production database, which only he runs (CLAUDE.md, the list that
-- "still needs the owner"). Written 2026-10-02 for v419 (plan
-- twinkling-forging-pelican, "Backend"). README §2 carries its row; move both
-- when it has run. Nothing here has touched the live project.
--
-- ONE TRANSACTION, idempotent, lock_timeout 5 s (nothing applied if it aborts;
-- re-run it). GATE 0 runs before any DDL; every VERIFY block runs before the
-- COMMIT at the bottom, so the file applies whole with every probe passing, or
-- not at all. It creates one table, so it locks nothing anyone uses except
-- auth.users for an instant (the foreign key below takes SHARE ROW EXCLUSIVE
-- on it): a sign-in landing mid-run waits for the COMMIT.
--
-- ── WHAT IT CHANGES, AND WHY ───────────────────────────────────────────────
-- This is the app's first CROSS-USER content. Until now every user's recipes
-- lived only in their own blob (DB.recipes); the one shared precedent is the
-- admin-curated food_catalog. So the trust path is narrow on purpose:
--
-- 1. public.shared_recipes — one row per recipe a user published: the dish
--    name, servings, meal tags, the ingredient list and the per-serving
--    figures (computed HERE, with DB.recipes.perServing's rounding).
--    `source_id` is the author's own recipe id: publishing the same recipe
--    again REPLACES the older copy. Rows are immutable after publishing;
--    `status` ('approved' | 'removed') is the only later write, made by the
--    owner by hand until a console centre exists (HOW TO APPLY, last step).
--    created_at is stamped by the server (stamp_created_at(), migration 30).
-- 2. ANONYMITY IS STRUCTURAL. `authenticated` gets a column-level SELECT on
--    every column EXCEPT author, source_id, removed_at and removed_reason, and
--    no table-level privilege; `anon` and PUBLIC get nothing. No client — the
--    Console included — can read who shared what FROM THIS TABLE: a `select *`
--    is refused with 42501, so every reader names its columns (check-contracts
--    #78 holds js/cloud.js and admin.html to this list). That hides the author
--    from every other USER. It does NOT hide it from an ADMIN session: the
--    author's own blob carries recipes[].shared.id (DB.recipes.setShared) and
--    18's vault_data_admin_read lets an admin read every blob, so the Console
--    could match a row's id to its author. No client role may write.
-- 3. Two SELECT policies: every signed-in account reads APPROVED rows; an
--    admin also reads removed ones. Neither references its own table (27's
--    42P17 lesson), and there is no ban policy on SELECT (a banned account
--    already sees only the blocked screen).
-- 4. publish_shared_recipe(p_key, p_lang, p_meals, p_source_id, p_recipe) —
--    the ONLY writer of new rows, SECURITY DEFINER. It is called by the
--    Cloudflare Worker, after the model approved the recipe, with the CALLER's
--    own token (so the author is auth.uid() and cannot be forged) and the
--    server key SHARE_KEY, which it compares with the Vault secret
--    `share_recipe_key`. A client calling it directly does not hold the key.
--    The checks, in order, each a `raise exception`; the Worker maps the five
--    a caller can meet to a code and answers 'not authenticated' and 'share
--    payload invalid' as a 502 (its own readShare refuses every such shape
--    first, the per-serving bound included, before the budget):
--      'not authenticated'      no auth.uid()
--      'share blocked'          public.is_banned() — a DEFINER bypasses the
--                               RESTRICTIVE ban policies, so it asks itself
--      'share unavailable'      no Vault secret named share_recipe_key
--      'share key invalid'      p_key is not that secret (compared as SHA-256)
--      'share payload invalid'  any shape check (below) fails
--      'share daily limit'      10 recipes by this author published in the last day
--      'share active limit'     100 recipes by this author held (any status)
--    Shape: lang 'ar'|'en'; meals 1-4 distinct of breakfast/lunch/snack/
--    dinner; source_id ^[A-Za-z0-9_-]{1,64}$; the recipe's keys exactly
--    {items,name,servings}; name 1-80 characters after btrim; servings a whole
--    1-99; 1-30 items, each with keys exactly
--    {calories,carbs,fat,name,protein,qty}, a name of at most 80 AS SENT and
--    not blank (the array is stored verbatim, so the bound is on the raw
--    string, not its trimmed copy), a qty string of at most 24, four figures
--    that are JSON numbers in 0-100000 written in at most 16 characters (a
--    value bound alone admits 16 000 decimals); the total calories above 0;
--    each per-serving figure at most 100000 (the columns' own check — refused
--    by name instead of with a raw 23514). Even a leaked key cannot write
--    anything a saved recipe could not hold. Then one author
--    at a time (an advisory lock on the author), the two caps — counted as
--    DEFINER, because a count under RLS counts nothing (26) — then the older
--    copy of the same source is deleted and the new row inserted. The caps do
--    not count that older copy: re-sharing a recipe at a cap replaces it
--    instead of being refused, and the totals never grow past the caps.
--    Withdraw deletes rows, so a withdraw/re-share loop is bounded by the
--    60-a-day AI budget, not by these caps — accepted for v1.
-- 5. withdraw_shared_recipe(p_id) — the author removes their own copy;
--    returns whether a row went. No ban check: erasure stays open to a
--    blocked account. An RPC, not a client DELETE: the SELECT policy hides a
--    removed row from its author, and no client role holds DELETE.
-- 6. delete_own_account() re-created with every statement 18 left in it, plus
--    the caller's shared recipes, deleted explicitly before auth.users (the
--    foreign key cascades too; 16's rule is that erasure names its tables).
--    CREATE OR REPLACE keeps its ACL; the revoke/grant pair is re-issued
--    anyway (check-contracts #28).
--
-- ── GATE 0 — before any DDL ────────────────────────────────────────────────
-- Refuses the whole file, naming what is missing, unless: the Vault is
-- installed (vault.decrypted_secrets); a Vault secret named share_recipe_key
-- holds 64 lowercase hex characters; pgcrypto's extensions.digest(bytea,text)
-- exists; and the LIVE delete_own_account() still contains each `delete from`
-- statement of migration 18 (whitespace collapsed) and NO OTHER `delete from`
-- (nine, or ten once this file has run) — a body that lost a statement, or
-- gained one outside the migrations, is never silently overwritten. (A gained
-- statement of another kind — an update, a perform — is not detected.)
--
-- ── VERIFY — what each block proves, BY CALLING ────────────────────────────
-- Probes are THROWAWAY auth users; every block that writes ends by raising
-- ROLLBACK-OK, so no probe row survives. The Vault key is read as postgres
-- BEFORE `set local role authenticated` (no client role can read the Vault —
-- block 1 proves it). A clean run prints, in a client that shows NOTICEs:
--   VERIFY 1 ok: RLS on; authenticated SELECTs exactly the 12 public columns; no table privilege for any client role; both functions definer, pinned and locked; the Vault unreadable to clients; the stamp trigger in place
--   VERIFY 2 ok: a publish returns the id and the stored name; per-serving figures as hand-computed; author is the caller; 80 Arabic characters fit; re-sharing a source leaves one row with a new id
--   VERIFY 3 ok: a wrong or missing key, 34 malformed payloads, a banned or disabled account and a caller with no sub are each refused by name
--   VERIFY 4 ok: the 11th recipe in a day and the 101st held are refused; re-sharing at either cap replaces; a withdraw frees a place
--   VERIFY 5 ok: another account reads the 12 columns of an approved row and nothing else; author, source_id, *, INSERT, UPDATE and DELETE are 42501; a removed row is hidden; anon reads nothing; the admin sees removed rows and still not the author
--   VERIFY 6 ok: another account cannot withdraw a recipe; its author can, once; no session is refused
--   VERIFY 7 ok: erasure removes every recipe the account shared and leaves another account's
-- (5 says "admin path skipped" instead if public.admins is empty.)
-- The Supabase SQL editor shows no NOTICEs: there, `Success` after `commit;`
-- is the proof, and an ERROR means NOTHING was applied.
--
-- ── HOW TO APPLY (the owner, once, ~5 min) ────────────────────────────────
-- 1. Backup first — backend/docs/DB-BACKUP-RESTORE.md.
-- 2. Dashboard → Database → Extensions: confirm `supabase_vault` and
--    `pgcrypto` (schema `extensions`) are enabled.
-- 3. Generate the key on your own machine:
--      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--    Dashboard → Integrations → Vault → Add new secret: name
--    `share_recipe_key`, value = that hex. Use the Vault UI, NOT the SQL
--    editor: the editor's history keeps the text of every query.
-- 4. The SAME hex on the Worker:
--      cd backend/worker && npx wrangler secret put SHARE_KEY
-- 5. SQL editor → New query → paste this WHOLE file → Run. A GATE 0 error
--    names what is missing and applies nothing; `Success` after `commit;` is
--    the proof that every VERIFY passed. If the editor raises its
--    "destructive operation" dialog, it is reacting to the
--    `drop policy/trigger if exists` guards and to the DELETE statements
--    inside the function bodies and the rolled-back VERIFY blocks: this file
--    removes no existing row and no existing object.
-- 6. Read-only check afterwards:
--      select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('publish_shared_recipe', 'withdraw_shared_recipe', 'delete_own_account');   -- 3
--      select count(*) from pg_class where oid = to_regclass('public.shared_recipes');                -- 1
-- 7. Clear the clipboard (it still holds the key), then tell Claude «35 applied»:
--    the file moves to backend/migrations/ and its README row to §1.
-- Rotating the key later: update the Vault secret, then `npx wrangler secret
-- put SHARE_KEY` with the same value. Between the two steps every share is
-- refused as 'unavailable' (the user reads «المشاركة غير متاحة الآن»).
-- Removing a recipe by hand, until the console centre exists:
--   update public.shared_recipes
--      set status = 'removed', removed_at = pg_catalog.now(), removed_reason = '<why>'
--    where id = '<uuid>';
-- A ban does NOT take down what the account already shared: is_banned() is
-- asked only at publish, so its approved rows stay in the feed. To remove
-- everything one account shared (SQL editor, as postgres):
--   update public.shared_recipes
--      set status = 'removed', removed_at = pg_catalog.now(), removed_reason = '<why>'
--    where author = '<user uuid>' and status = 'approved';
-- (A ban that hides content by itself would be a later migration with its own
-- calling VERIFY: a trigger on user_flags. Not a user_flags subquery in the
-- SELECT policy — a no-op under RLS — and not a uuid-taking definer helper
-- granted to authenticated — an oracle.)
--
-- The way back, if this file ever has to be undone (it discards every published
-- copy and is a real removal: the owner confirms it). ONE transaction with
-- lock_timeout 5 s, in THIS order:
--   1. delete_own_account goes back to the body of migration 18 FIRST (section 2
--      of 18_drop-mirror-v14.sql, verbatim; OR REPLACE, so its ACL stays). After
--      this file its body names shared_recipes, and plpgsql resolves a table when
--      the statement RUNS: with the table gone and this body left, every account
--      deletion raises 42P01 (the trap the header of 18 records).
--   2. publish_shared_recipe and withdraw_shared_recipe are removed.
--   3. shared_recipes is removed LAST. Its foreign key goes with it, and that
--      takes ACCESS EXCLUSIVE on auth.users (applying took SHARE ROW EXCLUSIVE):
--      sign-ins and token refreshes queue behind it, hence the lock_timeout.
--   4. notify pgrst to reload its schema; then delete the Vault secret
--      share_recipe_key and run npx wrangler secret delete SHARE_KEY.
-- stamp_created_at stays: it belongs to migration 30, and the feedback and
-- client_errors triggers run it. The statements are NOT spelled out here on
-- purpose: check-contracts #4 replays this text with its comments, and a
-- commented-out removal would read as the last word about the table.
-- ============================================================================

begin;

-- A lock this file waits for queues sign-ins behind it (the foreign key needs
-- auth.users): past 5 s it gives up whole rather than stall them. Re-run it.
set local lock_timeout = '5s';

-- ── GATE 0 — what this file stands on, checked before it changes anything ──
do $$
declare
  body text;
  stmt text;
begin
  if pg_catalog.to_regclass('vault.decrypted_secrets') is null then
    raise exception 'GATE 0: vault.decrypted_secrets does not exist — enable the supabase_vault extension (Dashboard → Database → Extensions). Nothing was applied.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets s
                  where s.name = 'share_recipe_key' and s.decrypted_secret ~ '^[0-9a-f]{64}$') then
    raise exception 'GATE 0: no Vault secret named share_recipe_key holding 64 lowercase hex characters — add it in Integrations → Vault first (HOW TO APPLY, step 3). Nothing was applied.';
  end if;
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'GATE 0: extensions.digest(bytea, text) does not exist — enable pgcrypto in the extensions schema. Nothing was applied.';
  end if;
  select pg_catalog.regexp_replace(pg_catalog.lower(p.prosrc), '\s+', ' ', 'g') into body
    from pg_catalog.pg_proc p
   where p.oid = pg_catalog.to_regprocedure('public.delete_own_account()');
  if body is null then
    raise exception 'GATE 0: public.delete_own_account() does not exist — this file re-creates the body migration 18 wrote. Nothing was applied.';
  end if;
  foreach stmt in array array[
    'delete from public.feedback where user_id = uid',
    'delete from public.client_errors where user_id = uid',
    'delete from public.exercises where owner_id = uid',
    'delete from public.cardio_types where owner_id = uid',
    'delete from public.profiles where user_id = uid',
    'delete from public.user_flags where user_id = uid',
    'delete from public.admins where user_id = uid',
    'delete from public.vault_data where user_id = uid',
    'delete from auth.users where id = uid'
  ] loop
    if pg_catalog.strpos(body, stmt) = 0 then
      raise exception 'GATE 0: the live delete_own_account() no longer contains "%" — it was changed outside the migrations; reconcile it before this file replaces it. Nothing was applied.', stmt;
    end if;
  end loop;
  -- ...and nothing beyond them: 18 wrote nine `delete from`, this file a tenth
  -- (present on a re-run). 'delete from ' is 12 characters.
  if (pg_catalog.length(body) - pg_catalog.length(pg_catalog.replace(body, 'delete from ', ''))) / 12
     <> 9 + (pg_catalog.strpos(body, 'delete from public.shared_recipes where author = uid') > 0)::integer then
    raise exception 'GATE 0: the live delete_own_account() holds a `delete from` that neither migration 18 nor this file wrote — it was changed outside the migrations; reconcile it before this file replaces it. Nothing was applied.';
  end if;
end $$;

-- ── 1. the table ───────────────────────────────────────────────────────────
-- One column per line and `);` at column 0: check-contracts #4 reads the
-- columns from this body.
create table if not exists public.shared_recipes (
  id          uuid primary key default pg_catalog.gen_random_uuid(),
  author      uuid not null references auth.users(id) on delete cascade,
  source_id   text not null check (source_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  lang        text not null check (lang in ('ar','en')),
  name        text not null check (pg_catalog.char_length(name) between 1 and 80),
  servings    smallint not null check (servings between 1 and 99),
  meals       text[] not null check (pg_catalog.cardinality(meals) between 1 and 4 and meals <@ array['breakfast','lunch','snack','dinner']::text[]),
  items       jsonb not null check (pg_catalog.jsonb_typeof(items) = 'array' and pg_catalog.jsonb_array_length(items) between 1 and 30),
  kcal        integer not null check (kcal between 0 and 100000),
  protein     numeric(8,1) not null check (protein between 0 and 100000),
  carbs       numeric(8,1) not null check (carbs between 0 and 100000),
  fat         numeric(8,1) not null check (fat between 0 and 100000),
  status      text not null default 'approved' check (status in ('approved','removed')),
  created_at  timestamptz not null default pg_catalog.now(),
  removed_at  timestamptz,
  removed_reason text check (pg_catalog.char_length(removed_reason) <= 200),
  constraint shared_recipes_removed_shape check ((status = 'removed') = (removed_at is not null)),
  constraint shared_recipes_one_per_source unique (author, source_id)
);
-- the feed (newest approved first, js/cloud.js pullSharedRecipes) and the caps (per author, per day)
create index if not exists shared_recipes_feed_idx   on public.shared_recipes (created_at desc, id desc) where status = 'approved';
create index if not exists shared_recipes_author_idx on public.shared_recipes (author, created_at);

comment on table public.shared_recipes is
  'Recipes users published for every signed-in account (v419 «اقتراحات»). Written only by publish_shared_recipe() (the Worker, after the AI moderator approved) and withdraw_shared_recipe(); status is the only later write. author and source_id are never granted to a client role.';
comment on column public.shared_recipes.author is
  'The publishing account. NEVER granted to anon/authenticated: the author''s anonymity is the column-level SELECT grant (migration 35, check-contracts #78).';
comment on column public.shared_recipes.source_id is
  'The author''s own recipe id (DB.recipes): publishing it again replaces the older copy. Not granted to any client role.';

-- created_at belongs to the server (30's trigger function, reused)
drop trigger if exists shared_recipes_stamp_created_at_trg on public.shared_recipes;
create trigger shared_recipes_stamp_created_at_trg
  before insert on public.shared_recipes
  for each row execute function public.stamp_created_at();

-- ── 2. grants and RLS: anonymity is the column list ─────────────────────────
-- Revoking the table privilege first also clears any column privilege of the
-- same kind, so a re-run lands on exactly this list.
alter table public.shared_recipes enable row level security;
revoke all on public.shared_recipes from anon, authenticated, public;
grant select (id, lang, name, servings, meals, items, kcal, protein, carbs, fat, status, created_at) on public.shared_recipes to authenticated;

drop policy if exists shared_recipes_read_approved on public.shared_recipes;
create policy shared_recipes_read_approved on public.shared_recipes
  for select to authenticated
  using (status = 'approved');

drop policy if exists shared_recipes_admin_read on public.shared_recipes;
create policy shared_recipes_admin_read on public.shared_recipes
  for select to authenticated
  using ((select public.is_admin()));

-- ── 3. publish_shared_recipe: the only door in ──────────────────────────────
create or replace function public.publish_shared_recipe(p_key text, p_lang text, p_meals text[], p_source_id text, p_recipe jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  -- THE SHARE BOUNDS (scripts/test-share-recipe.js holds them equal to the Worker's SHARE_* and js/storage.js)
  share_name     constant integer := 80;
  share_qty      constant integer := 24;
  share_fig      constant numeric := 100000;
  share_items    constant integer := 30;
  share_servings constant integer := 99;
  share_meals    constant text[]  := array['breakfast','lunch','snack','dinner'];
  -- the caps, per author (the database's alone)
  share_daily    constant integer := 10;    -- published in the last 24 hours
  share_active   constant integer := 100;   -- held, any status
  uid     uuid := auth.uid();
  secret  text;
  v_name  text;
  v_serv  numeric;
  v_items jsonb;
  item    jsonb;
  fig     text;
  t_kcal  numeric := 0;
  t_prot  numeric := 0;
  t_carb  numeric := 0;
  t_fat   numeric := 0;
  s_kcal  numeric;
  s_prot  numeric;
  s_carb  numeric;
  s_fat   numeric;
  n       integer;
  new_id  uuid;
begin
  -- 1. who
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- 2. a DEFINER bypasses the RESTRICTIVE ban policies, so the ban is asked here
  --    (the same predicate every ban policy and ai_budget_take() use)
  if public.is_banned() then
    raise exception 'share blocked';
  end if;

  -- 3. the server key: only the Worker holds it. Compared as SHA-256 digests,
  --    so the comparison takes the same time however much of it matches.
  select s.decrypted_secret into secret
    from vault.decrypted_secrets s
   where s.name = 'share_recipe_key'
   order by s.created_at desc
   limit 1;
  if secret is null then
    raise exception 'share unavailable';
  end if;
  if extensions.digest(pg_catalog.convert_to(p_key, 'UTF8'), 'sha256')
     is distinct from extensions.digest(pg_catalog.convert_to(secret, 'UTF8'), 'sha256') then
    raise exception 'share key invalid';
  end if;

  -- 4. the shape — never more than a saved recipe can hold. Nested IFs where
  --    a cast follows a type test: SQL does not promise to evaluate OR left to
  --    right, and a cast error is not 'share payload invalid'.
  if p_lang is null or p_lang not in ('ar', 'en') then
    raise exception 'share payload invalid';
  end if;
  if p_meals is null
     or pg_catalog.array_ndims(p_meals) is distinct from 1
     or pg_catalog.cardinality(p_meals) not between 1 and 4
     or not (p_meals <@ share_meals)
     or (select pg_catalog.count(distinct m.meal) from pg_catalog.unnest(p_meals) as m(meal)) <> pg_catalog.cardinality(p_meals) then
    raise exception 'share payload invalid';
  end if;
  if p_source_id is null or p_source_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'share payload invalid';
  end if;
  if pg_catalog.jsonb_typeof(p_recipe) is distinct from 'object' then
    raise exception 'share payload invalid';
  end if;
  if (select pg_catalog.array_agg(o.okey order by o.okey collate pg_catalog."C") from pg_catalog.jsonb_object_keys(p_recipe) as o(okey))
     is distinct from array['items','name','servings'] then
    raise exception 'share payload invalid';
  end if;
  if pg_catalog.jsonb_typeof(p_recipe->'name') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_recipe->'servings') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_recipe->'items') is distinct from 'array' then
    raise exception 'share payload invalid';
  end if;
  v_name := pg_catalog.btrim(p_recipe->>'name');
  v_serv := (p_recipe->>'servings')::numeric;
  v_items := p_recipe->'items';
  if pg_catalog.char_length(v_name) not between 1 and share_name
     or v_serv <> pg_catalog.trunc(v_serv)
     or v_serv not between 1 and share_servings
     or pg_catalog.jsonb_array_length(v_items) not between 1 and share_items then
    raise exception 'share payload invalid';
  end if;
  for item in select x.val from pg_catalog.jsonb_array_elements(v_items) as x(val) loop
    if pg_catalog.jsonb_typeof(item) is distinct from 'object' then
      raise exception 'share payload invalid';
    end if;
    if (select pg_catalog.array_agg(o.okey order by o.okey collate pg_catalog."C") from pg_catalog.jsonb_object_keys(item) as o(okey))
       is distinct from array['calories','carbs','fat','name','protein','qty'] then
      raise exception 'share payload invalid';
    end if;
    if pg_catalog.jsonb_typeof(item->'name') is distinct from 'string'
       or pg_catalog.jsonb_typeof(item->'qty') is distinct from 'string' then
      raise exception 'share payload invalid';
    end if;
    -- The array is stored VERBATIM (step 8), so the bound is on the name as sent:
    -- 'x' followed by a megabyte of spaces has a trimmed length of 1.
    if pg_catalog.char_length(pg_catalog.btrim(item->>'name')) < 1
       or pg_catalog.char_length(item->>'name') > share_name
       or pg_catalog.char_length(item->>'qty') > share_qty then
      raise exception 'share payload invalid';
    end if;
    foreach fig in array array['calories', 'protein', 'carbs', 'fat'] loop
      if pg_catalog.jsonb_typeof(item->fig) is distinct from 'number' then
        raise exception 'share payload invalid';
      end if;
      -- In range AND short: jsonb keeps every digit it was sent, and a number
      -- with 16 000 decimals is still "between 0 and 100000". The Worker's
      -- figures are at most 7 characters (99999.9).
      if (item->>fig)::numeric not between 0 and share_fig
         or pg_catalog.char_length(item->>fig) > 16 then
        raise exception 'share payload invalid';
      end if;
    end loop;
    t_kcal := t_kcal + (item->>'calories')::numeric;
    t_prot := t_prot + (item->>'protein')::numeric;
    t_carb := t_carb + (item->>'carbs')::numeric;
    t_fat  := t_fat  + (item->>'fat')::numeric;
  end loop;
  -- per serving, with DB.recipes.perServing's rounding (kcal whole, macros to 0.1)
  s_kcal := pg_catalog.round(t_kcal / v_serv);
  s_prot := pg_catalog.round(t_prot / v_serv, 1);
  s_carb := pg_catalog.round(t_carb / v_serv, 1);
  s_fat  := pg_catalog.round(t_fat / v_serv, 1);
  if t_kcal <= 0 or s_kcal > share_fig or s_prot > share_fig or s_carb > share_fig or s_fat > share_fig then
    raise exception 'share payload invalid';
  end if;

  -- 5. one author at a time: the caps below are read -> decide -> write
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public.shared_recipes:' || uid::text, 0));

  -- 6. the caps, counted as DEFINER (under RLS a count sees only approved rows).
  --    The older copy of this same source is not counted: it is replaced below.
  select pg_catalog.count(*)::integer into n
    from public.shared_recipes r
   where r.author = uid and r.source_id <> p_source_id
     and r.created_at > pg_catalog.now() - interval '1 day';
  if n >= share_daily then
    raise exception 'share daily limit';
  end if;
  select pg_catalog.count(*)::integer into n
    from public.shared_recipes r
   where r.author = uid and r.source_id <> p_source_id;
  if n >= share_active then
    raise exception 'share active limit';
  end if;

  -- 7. re-sharing replaces
  delete from public.shared_recipes r where r.author = uid and r.source_id = p_source_id;

  -- 8. the row, with the figures per serving
  insert into public.shared_recipes (author, source_id, lang, name, servings, meals, items, kcal, protein, carbs, fat)
    values (uid, p_source_id, p_lang, v_name, v_serv::smallint, p_meals, v_items, s_kcal::integer, s_prot, s_carb, s_fat)
    returning id into new_id;
  return pg_catalog.jsonb_build_object('id', new_id, 'name', v_name);
end;
$$;
revoke all on function public.publish_shared_recipe(text, text, text[], text, jsonb) from public, anon;
grant execute on function public.publish_shared_recipe(text, text, text[], text, jsonb) to authenticated;

-- ── 4. withdraw_shared_recipe: the author takes it back ─────────────────────
create or replace function public.withdraw_shared_recipe(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  n   integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- no ban check: erasure stays open to a blocked account
  delete from public.shared_recipes r where r.id = p_id and r.author = uid;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke all on function public.withdraw_shared_recipe(uuid) from public, anon;
grant execute on function public.withdraw_shared_recipe(uuid) to authenticated;

-- ── 5. delete_own_account: 18's body, plus the shared recipes ──────────────
-- feedback is DELETED here (not left user_id-null): the function has always
-- deleted it, and privacy.html documents deletion accordingly. The one thing
-- that survives an account deletion is audit_log (no auth.users FK): the
-- admin action log, retained for security, holds no account data.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.feedback      where user_id = uid;
  delete from public.client_errors where user_id = uid;

  -- Caller-owned catalog rows. Nothing references them any more: the mirror
  -- tables that once pointed at exercises/cardio_types are gone (18).
  delete from public.exercises     where owner_id = uid;
  delete from public.cardio_types  where owner_id = uid;

  delete from public.profiles      where user_id = uid;
  delete from public.user_flags    where user_id = uid;
  delete from public.admins        where user_id = uid;
  delete from public.vault_data    where user_id = uid;

  -- 35: every recipe this account shared (the foreign key would cascade them;
  -- erasure names its tables, 16's rule)
  delete from public.shared_recipes where author = uid;

  -- Last by design: after this succeeds, no account remains even if the client
  -- later fails to sweep non-transactional Storage objects.
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- PostgREST re-reads its schema cache when this NOTIFY is delivered (at the
-- COMMIT), so the Worker's first publish finds the function at once.
notify pgrst, 'reload schema';

-- ============================================================================
-- VERIFY — inside the transaction: any failure raises, and nothing commits.
-- ============================================================================

-- 1. the shape, read from the catalog because these facts ARE catalog facts
do $$
declare
  cols text;
  fn   text;
begin
  if not coalesce((select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.shared_recipes'::pg_catalog.regclass), false) then
    raise exception 'VERIFY 1 failed: row level security is off on public.shared_recipes';
  end if;
  select pg_catalog.string_agg(distinct column_name::text, ',' order by column_name::text) into cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'shared_recipes' and grantee = 'authenticated' and privilege_type = 'SELECT';
  if cols is distinct from 'carbs,created_at,fat,id,items,kcal,lang,meals,name,protein,servings,status' then
    raise exception 'VERIFY 1 failed: authenticated may SELECT [%] of shared_recipes, expected [carbs,created_at,fat,id,items,kcal,lang,meals,name,protein,servings,status] — never author or source_id', cols;
  end if;
  if exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and table_name = 'shared_recipes'
                and (grantee in ('anon', 'PUBLIC') or (grantee = 'authenticated' and privilege_type <> 'SELECT'))) then
    raise exception 'VERIFY 1 failed: a client role holds a column privilege on shared_recipes beyond authenticated''s SELECT list';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.shared_recipes', 'select')
     or pg_catalog.has_table_privilege('authenticated', 'public.shared_recipes', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.shared_recipes', 'update')
     or pg_catalog.has_table_privilege('authenticated', 'public.shared_recipes', 'delete')
     or pg_catalog.has_table_privilege('authenticated', 'public.shared_recipes', 'truncate')
     or pg_catalog.has_table_privilege('anon', 'public.shared_recipes', 'select')
     or pg_catalog.has_table_privilege('anon', 'public.shared_recipes', 'insert')
     or pg_catalog.has_table_privilege('public', 'public.shared_recipes', 'select')
     or pg_catalog.has_table_privilege('public', 'public.shared_recipes', 'insert') then
    raise exception 'VERIFY 1 failed: a client role holds a TABLE-level privilege on shared_recipes';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = 'shared_recipes') <> 2
     or exists (select 1 from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = 'shared_recipes' and p.cmd <> 'SELECT') then
    raise exception 'VERIFY 1 failed: shared_recipes must carry exactly the two SELECT policies';
  end if;
  foreach fn in array array['public.publish_shared_recipe(text,text,text[],text,jsonb)', 'public.withdraw_shared_recipe(uuid)', 'public.delete_own_account()'] loop
    if not exists (select 1 from pg_catalog.pg_proc p
                    where p.oid = pg_catalog.to_regprocedure(fn) and p.prosecdef
                      and exists (select 1 from pg_catalog.unnest(p.proconfig) c where c like 'search_path=%')) then
      raise exception 'VERIFY 1 failed: % is missing, or not a SECURITY DEFINER with a pinned search_path', fn;
    end if;
    if pg_catalog.has_function_privilege('anon', fn, 'execute') or pg_catalog.has_function_privilege('public', fn, 'execute') then
      raise exception 'VERIFY 1 failed: anon/PUBLIC can execute %', fn;
    end if;
    if not pg_catalog.has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'VERIFY 1 failed: authenticated cannot execute %', fn;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('authenticated', 'vault.decrypted_secrets', 'select')
     or pg_catalog.has_table_privilege('anon', 'vault.decrypted_secrets', 'select') then
    raise exception 'VERIFY 1 failed: a client role can read vault.decrypted_secrets — the share key (and every other secret) would be readable';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger t
                  where t.tgrelid = 'public.shared_recipes'::pg_catalog.regclass
                    and t.tgname = 'shared_recipes_stamp_created_at_trg' and not t.tgisinternal
                    and t.tgfoid = 'public.stamp_created_at()'::pg_catalog.regprocedure) then
    raise exception 'VERIFY 1 failed: the created_at stamp trigger is missing on shared_recipes';
  end if;
  raise notice 'VERIFY 1 ok: RLS on; authenticated SELECTs exactly the 12 public columns; no table privilege for any client role; both functions definer, pinned and locked; the Vault unreadable to clients; the stamp trigger in place';
end $$;

-- 2. a publish, called the way the Worker calls it: as `authenticated`, under the caller's claims, with the key
do $$
declare
  a      uuid := pg_catalog.gen_random_uuid();
  k      text;
  base   jsonb := '{"name":"  فول مدمس بالطحينة  ","servings":3,"items":[{"name":"فول مدمس","qty":"٢ كوب","calories":400,"protein":20.5,"carbs":50,"fat":10.2},{"name":"طحينة","qty":"ملعقة","calories":101,"protein":0.4,"carbs":3.3,"fat":0}]}';
  r      jsonb;
  r2     jsonb;
  got    record;
  n      integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35a-' || a || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  -- the key, read as postgres: no client role can read the Vault (VERIFY 1)
  select s.decrypted_secret into k from vault.decrypted_secrets s where s.name = 'share_recipe_key' order by s.created_at desc limit 1;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);

  set local role authenticated;
  r := public.publish_shared_recipe(k, 'ar', array['breakfast','snack'], 'verify35-src-1', base);
  reset role;
  if (r->>'name') is distinct from 'فول مدمس بالطحينة' or (r->>'id') is null then
    raise exception 'VERIFY 2 failed: the publish answered % (expected the new id and the trimmed name)', r;
  end if;
  select * into got from public.shared_recipes s where s.id = (r->>'id')::uuid;
  if got.author is distinct from a then
    raise exception 'VERIFY 2 failed: the row''s author is %, not the caller', got.author;
  end if;
  -- totals 501 / 20.9 / 53.3 / 10.2 over 3 servings
  if got.kcal <> 167 or got.protein <> 7.0 or got.carbs <> 17.8 or got.fat <> 3.4 or got.servings <> 3 then
    raise exception 'VERIFY 2 failed: per serving % kcal / % / % / % over % servings (expected 167 / 7.0 / 17.8 / 3.4 over 3)', got.kcal, got.protein, got.carbs, got.fat, got.servings;
  end if;
  if got.lang <> 'ar' or got.meals <> array['breakfast','snack'] or got.items <> base->'items' or got.status <> 'approved'
     or got.removed_at is not null or got.source_id <> 'verify35-src-1' or got.created_at < pg_catalog.now() then
    raise exception 'VERIFY 2 failed: the stored row is not what was published: %', pg_catalog.row_to_json(got);
  end if;

  -- 80 characters of Arabic fit: the bound counts characters, not bytes
  set local role authenticated;
  r2 := public.publish_shared_recipe(k, 'ar', array['dinner'], 'verify35-src-2',
          pg_catalog.jsonb_set(base, '{name}', pg_catalog.to_jsonb(pg_catalog.repeat('ب', 80))));
  reset role;
  if pg_catalog.char_length(r2->>'name') <> 80 then
    raise exception 'VERIFY 2 failed: an 80-character Arabic name answered %', r2;
  end if;

  -- re-sharing the same source replaces it: ONE row, with a new id and the new name
  set local role authenticated;
  r2 := public.publish_shared_recipe(k, 'ar', array['lunch'], 'verify35-src-1', pg_catalog.jsonb_set(base, '{name}', '"فول مدمس"'));
  reset role;
  select pg_catalog.count(*)::integer into n from public.shared_recipes s where s.author = a and s.source_id = 'verify35-src-1';
  if n <> 1 or (r2->>'id') = (r->>'id')
     or not exists (select 1 from public.shared_recipes s where s.id = (r2->>'id')::uuid and s.name = 'فول مدمس' and s.meals = array['lunch']) then
    raise exception 'VERIFY 2 failed: re-sharing a source left % rows (first id %, second %)', n, r->>'id', r2->>'id';
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 2';
exception
  when others then
    -- strpos(), NOT position(): position(x in y) is SQL grammar and cannot be pg_catalog-qualified (28)
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 2') = 0 then raise; end if;
    raise notice 'VERIFY 2 ok: a publish returns the id and the stored name; per-serving figures as hand-computed; author is the caller; 80 Arabic characters fit; re-sharing a source leaves one row with a new id';
end $$;

-- 3. every refusal, by calling: the key, the shape, the ban, the session
do $$
declare
  a      uuid := pg_catalog.gen_random_uuid();
  k      text;
  base   jsonb := '{"name":"Garlic pasta","servings":2,"items":[{"name":"spaghetti","qty":"200 g","calories":742,"protein":26,"carbs":150,"fat":3},{"name":"olive oil","qty":"2 tbsp","calories":239,"protein":0,"carbs":0,"fat":27}]}';
  bad    record;
  caught text;
  tried  integer := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35a-' || a || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  select s.decrypted_secret into k from vault.decrypted_secrets s where s.name = 'share_recipe_key' order by s.created_at desc limit 1;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);

  set local role authenticated;
  -- 3a. a key that is not the Vault's — wrong, upper-cased, empty, absent
  for bad in
    select * from (values
      ('a wrong key',      pg_catalog.repeat('0', 64)),
      ('the key in upper case', pg_catalog.upper(k)),
      ('an empty key',     ''),
      ('no key',           null::text)
    ) v(label, key)
  loop
    begin
      perform public.publish_shared_recipe(bad.key, 'en', array['lunch'], 'verify35-key', base);
      caught := 'accepted';
    exception when others then
      caught := sqlerrm;
    end;
    if caught is distinct from 'share key invalid' then
      raise exception 'VERIFY 3a failed: % gave "%" (expected share key invalid)', bad.label, caught;
    end if;
  end loop;

  -- 3b. thirty-four malformed payloads, each refused by name before anything is written
  for bad in
    select * from (values
      ('servings 0',            'en'::text, array['lunch']::text[], 'verify35-bad'::text, pg_catalog.jsonb_set(base, '{servings}', '0')),
      ('servings 100',          'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{servings}', '100')),
      ('servings 1.5',          'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{servings}', '1.5')),
      ('servings as a string',  'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{servings}', '"2"')),
      ('no items',              'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items}', '[]')),
      ('31 items',              'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items}', (select pg_catalog.jsonb_agg(base->'items'->0) from pg_catalog.generate_series(1, 31)))),
      ('items not an array',    'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items}', '{}')),
      ('an item not an object', 'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0}', '"spaghetti"')),
      ('an 81-character name',  'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{name}', pg_catalog.to_jsonb(pg_catalog.repeat('x', 81)))),
      ('a blank name',          'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{name}', '"   "')),
      ('an 81-character item',  'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,name}', pg_catalog.to_jsonb(pg_catalog.repeat('x', 81)))),
      ('a nameless item',       'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,name}', '"  "')),
      ('an item name padded past 80', 'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,name}', pg_catalog.to_jsonb('x' || pg_catalog.repeat(' ', 80)))),
      ('a figure of 40 decimals', 'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,fat}', ('0.' || pg_catalog.repeat('1', 40))::jsonb)),
      ('a 25-character qty',    'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,qty}', pg_catalog.to_jsonb(pg_catalog.repeat('q', 25)))),
      ('a figure of -1',        'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,protein}', '-1')),
      ('a figure of 100001',    'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,calories}', '100001')),
      ('a figure as a string',  'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,fat}', '"12"')),
      ('a null figure',         'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0,carbs}', 'null')),
      ('an extra recipe key',   'en', array['lunch'], 'verify35-bad', base || '{"author":"someone"}'),
      ('a missing recipe key',  'en', array['lunch'], 'verify35-bad', base - 'servings'),
      ('an extra item key',     'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0}', (base->'items'->0) || '{"id":"x"}')),
      ('a missing item key',    'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(base, '{items,0}', (base->'items'->0) - 'qty')),
      ('total kcal 0',          'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(pg_catalog.jsonb_set(base, '{items,0,calories}', '0'), '{items,1,calories}', '0')),
      ('200000 kcal a serving', 'en', array['lunch'], 'verify35-bad', pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(base, '{servings}', '1'), '{items,0,calories}', '100000'), '{items,1,calories}', '100000')),
      ('a recipe not an object','en', array['lunch'], 'verify35-bad', '[]'::jsonb),
      ('meals [brunch]',        'en', array['brunch'], 'verify35-bad', base),
      ('meals []',              'en', '{}'::text[], 'verify35-bad', base),
      ('a meal twice',          'en', array['lunch','lunch'], 'verify35-bad', base),
      ('meals in two dimensions','en', '{{lunch,dinner}}'::text[], 'verify35-bad', base),
      ('lang fr',               'fr', array['lunch'], 'verify35-bad', base),
      ('a source id with a space','en', array['lunch'], 'verify35 bad', base),
      ('a 65-character source id','en', array['lunch'], pg_catalog.repeat('s', 65), base),
      ('no source id',          'en', array['lunch'], null::text, base)
    ) v(label, lang, meals, src, recipe)
  loop
    tried := tried + 1;
    begin
      perform public.publish_shared_recipe(k, bad.lang, bad.meals, bad.src, bad.recipe);
      caught := 'accepted';
    exception when others then
      caught := sqlerrm;
    end;
    if caught is distinct from 'share payload invalid' then
      raise exception 'VERIFY 3b failed: % gave "%" (expected share payload invalid)', bad.label, caught;
    end if;
  end loop;
  reset role;
  if exists (select 1 from public.shared_recipes s where s.author = a) then
    raise exception 'VERIFY 3b failed: a refused publish left a row';
  end if;

  -- 3c. a banned or a disabled account is refused before its key is even read
  insert into public.user_flags (user_id, status) values (a, 'banned');
  set local role authenticated;
  begin
    perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-ban', base);
    caught := 'accepted';
  exception when others then
    caught := sqlerrm;
  end;
  reset role;
  if caught is distinct from 'share blocked' then
    raise exception 'VERIFY 3c failed: a banned account gave "%"', caught;
  end if;
  update public.user_flags set status = 'disabled' where user_id = a;
  set local role authenticated;
  begin
    perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-ban', base);
    caught := 'accepted';
  exception when others then
    caught := sqlerrm;
  end;
  reset role;
  if caught is distinct from 'share blocked' then
    raise exception 'VERIFY 3c failed: a disabled account gave "%"', caught;
  end if;
  delete from public.user_flags where user_id = a;

  -- 3d. no sub, no publish
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  begin
    perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-nosub', base);
    caught := 'accepted';
  exception when others then
    caught := sqlerrm;
  end;
  reset role;
  if caught is distinct from 'not authenticated' then
    raise exception 'VERIFY 3d failed: a caller with no sub gave "%"', caught;
  end if;

  -- 3e. and the base payload itself is a valid one: the refusals above are about what was changed
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.publish_shared_recipe(k, 'en', array['lunch','dinner'], 'verify35-good', base);
  reset role;

  if tried <> 34 then
    raise exception 'VERIFY 3b failed: % malformed payloads were tried, expected 34', tried;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 3';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 3') = 0 then raise; end if;
    raise notice 'VERIFY 3 ok: a wrong or missing key, 34 malformed payloads, a banned or disabled account and a caller with no sub are each refused by name';
end $$;

-- 4. the caps: ten a day, a hundred held — counted as DEFINER, about the caller only
do $$
declare
  c      uuid := pg_catalog.gen_random_uuid();
  d      uuid := pg_catalog.gen_random_uuid();
  k      text;
  base   jsonb := '{"name":"Lentil soup","servings":4,"items":[{"name":"red lentils","qty":"300 g","calories":1070,"protein":76,"carbs":180,"fat":3}]}';
  caught text;
  i      integer;
  n      integer;
  old_id uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35c-' || c || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35d-' || d || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  select s.decrypted_secret into k from vault.decrypted_secrets s where s.name = 'share_recipe_key' order by s.created_at desc limit 1;

  -- 4a. C: ten distinct recipes in a day land, the eleventh is refused...
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..10 loop
    perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-c-' || i, base);
  end loop;
  begin
    perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-c-11', base);
    caught := 'accepted';
  exception when others then
    caught := sqlerrm;
  end;
  if caught is distinct from 'share daily limit' then
    reset role;
    raise exception 'VERIFY 4a failed: the 11th recipe in a day gave "%"', caught;
  end if;
  -- ...and re-sharing one of the ten replaces it (the count stays ten)
  perform public.publish_shared_recipe(k, 'en', array['dinner'], 'verify35-c-3', base);
  reset role;
  select pg_catalog.count(*)::integer into n from public.shared_recipes s where s.author = c;
  if n <> 10 then
    raise exception 'VERIFY 4a failed: after ten, a refusal and a re-share, C holds % rows (expected 10)', n;
  end if;

  -- 4b. D holds 99, published two days ago (inserted as postgres; the stamp trigger fires on INSERT only)
  insert into public.shared_recipes (author, source_id, lang, name, servings, meals, items, kcal, protein, carbs, fat)
    select d, 'verify35-d-' || g.i, 'en', 'verify35 old ' || g.i, 1, array['lunch'], base->'items', 1070, 76, 180, 3
      from pg_catalog.generate_series(1, 99) as g(i);
  update public.shared_recipes set created_at = pg_catalog.now() - interval '2 days' where author = d;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-d-100', base);   -- the 100th lands
  begin
    perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-d-101', base);
    caught := 'accepted';
  exception when others then
    caught := sqlerrm;
  end;
  if caught is distinct from 'share active limit' then
    reset role;
    raise exception 'VERIFY 4b failed: the 101st recipe held gave "%"', caught;
  end if;
  perform public.publish_shared_recipe(k, 'en', array['snack'], 'verify35-d-5', base);     -- re-sharing at the cap replaces
  reset role;
  select pg_catalog.count(*)::integer into n from public.shared_recipes s where s.author = d;
  if n <> 100 then
    raise exception 'VERIFY 4b failed: at the active cap a re-share left D with % rows (expected 100)', n;
  end if;

  -- 4c. one withdraw frees a place
  select s.id into old_id from public.shared_recipes s where s.author = d and s.source_id = 'verify35-d-1';
  set local role authenticated;
  if not public.withdraw_shared_recipe(old_id) then
    reset role;
    raise exception 'VERIFY 4c failed: D could not withdraw its own recipe';
  end if;
  perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-d-101', base);
  reset role;
  select pg_catalog.count(*)::integer into n from public.shared_recipes s where s.author = d;
  if n <> 100 then
    raise exception 'VERIFY 4c failed: after a withdraw and a publish D holds % rows (expected 100)', n;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 4';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 4') = 0 then raise; end if;
    raise notice 'VERIFY 4 ok: the 11th recipe in a day and the 101st held are refused; re-sharing at either cap replaces; a withdraw frees a place';
end $$;

-- 5. anonymity, as another account, as anon, and as the admin
do $$
declare
  a        uuid := pg_catalog.gen_random_uuid();
  b        uuid := pg_catalog.gen_random_uuid();
  admin_id uuid;
  k        text;
  base     jsonb := '{"name":"Garlic pasta","servings":2,"items":[{"name":"spaghetti","qty":"200 g","calories":742,"protein":26,"carbs":150,"fat":3}]}';
  live_id  uuid;
  gone_id  uuid;
  got      record;
  q        text;
  state    text;
  n        integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35a-' || a || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35b-' || b || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  select s.decrypted_secret into k from vault.decrypted_secrets s where s.name = 'share_recipe_key' order by s.created_at desc limit 1;

  -- A publishes two; the owner removes the second by hand (as postgres, the way HOW TO APPLY says)
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  live_id := (public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-live', base)->>'id')::uuid;
  gone_id := (public.publish_shared_recipe(k, 'en', array['dinner'], 'verify35-gone', base)->>'id')::uuid;
  reset role;
  update public.shared_recipes set status = 'removed', removed_at = pg_catalog.now(), removed_reason = 'verify35' where id = gone_id;

  -- 5a. B reads A's approved row through the granted columns...
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select s.id, s.lang, s.name, s.servings, s.meals, s.items, s.kcal, s.protein, s.carbs, s.fat, s.status, s.created_at into got
    from public.shared_recipes s where s.id = live_id;
  -- ...but never who published it, nor anything written
  foreach q in array array[
    pg_catalog.format('select author from public.shared_recipes where id = %L', live_id),
    pg_catalog.format('select source_id from public.shared_recipes where id = %L', live_id),
    pg_catalog.format('select * from public.shared_recipes where id = %L', live_id),
    pg_catalog.format('select id from public.shared_recipes where author = %L', a),
    'insert into public.shared_recipes (author, source_id, lang, name, servings, meals, items, kcal, protein, carbs, fat) values (auth.uid(), ''verify35-b'', ''en'', ''x'', 1, array[''lunch''], ''[{"name":"x","qty":"","calories":1,"protein":0,"carbs":0,"fat":0}]''::jsonb, 1, 0, 0, 0)',
    pg_catalog.format('update public.shared_recipes set name = %L where id = %L', 'verify35 defaced', live_id),
    pg_catalog.format('delete from public.shared_recipes where id = %L', live_id)
  ] loop
    begin
      execute q;
      state := '00000';
    exception when others then
      state := sqlstate;
    end;
    if state <> '42501' then
      reset role;
      raise exception 'VERIFY 5a failed: as another account, «%» gave SQLSTATE % (expected 42501)', q, state;
    end if;
  end loop;
  -- 5b. a removed row is hidden from everyone but the admin
  select pg_catalog.count(*)::integer into n from public.shared_recipes s where s.id = gone_id;
  reset role;
  if got.id is distinct from live_id or got.name <> 'Garlic pasta' or got.kcal <> 371 then
    raise exception 'VERIFY 5a failed: another account could not read the approved row''s columns (got %)', pg_catalog.row_to_json(got);
  end if;
  if n <> 0 then
    raise exception 'VERIFY 5b failed: another account sees a removed recipe';
  end if;
  if not exists (select 1 from public.shared_recipes s where s.id = live_id and s.name = 'Garlic pasta') then
    raise exception 'VERIFY 5a failed: the refused UPDATE or DELETE changed the row';
  end if;

  -- 5c. anon reads nothing at all
  set local role anon;
  begin
    execute pg_catalog.format('select id from public.shared_recipes where id = %L', live_id);
    state := '00000';
  exception when others then
    state := sqlstate;
  end;
  reset role;
  if state <> '42501' then
    raise exception 'VERIFY 5c failed: anon reading shared_recipes gave SQLSTATE % (expected 42501)', state;
  end if;

  -- 5d. the admin sees the removed row, and still never its author
  select x.user_id into admin_id from public.admins x order by x.user_id limit 1;
  if admin_id is null then
    raise exception 'ROLLBACK-OK: VERIFY 5 (admin path skipped)';
  end if;
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select pg_catalog.count(*)::integer into n from public.shared_recipes s where s.id = gone_id and s.status = 'removed';
  begin
    execute pg_catalog.format('select author from public.shared_recipes where id = %L', gone_id);
    state := '00000';
  exception when others then
    state := sqlstate;
  end;
  reset role;
  if n <> 1 then
    raise exception 'VERIFY 5d failed: the admin does not see a removed recipe';
  end if;
  if state <> '42501' then
    raise exception 'VERIFY 5d failed: the admin reading author gave SQLSTATE % (expected 42501 — the Console must not read author from this table)', state;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 5';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 5') = 0 then raise; end if;
    if sqlerrm = 'ROLLBACK-OK: VERIFY 5' then
      raise notice 'VERIFY 5 ok: another account reads the 12 columns of an approved row and nothing else; author, source_id, *, INSERT, UPDATE and DELETE are 42501; a removed row is hidden; anon reads nothing; the admin sees removed rows and still not the author';
    else
      raise notice 'VERIFY 5 ok: another account reads the 12 columns of an approved row and nothing else; author, source_id, *, INSERT, UPDATE and DELETE are 42501; a removed row is hidden; anon reads nothing; admin path skipped (public.admins is empty)';
    end if;
end $$;

-- 6. withdraw: only the author, once; never without a session
do $$
declare
  a      uuid := pg_catalog.gen_random_uuid();
  b      uuid := pg_catalog.gen_random_uuid();
  k      text;
  base   jsonb := '{"name":"Garlic pasta","servings":2,"items":[{"name":"spaghetti","qty":"200 g","calories":742,"protein":26,"carbs":150,"fat":3}]}';
  rid    uuid;
  ok_b   boolean;
  ok_a   boolean;
  ok_a2  boolean;
  caught text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35a-' || a || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35b-' || b || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  select s.decrypted_secret into k from vault.decrypted_secrets s where s.name = 'share_recipe_key' order by s.created_at desc limit 1;

  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  rid := (public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-w', base)->>'id')::uuid;
  reset role;

  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok_b := public.withdraw_shared_recipe(rid);
  reset role;
  if ok_b or not exists (select 1 from public.shared_recipes s where s.id = rid) then
    raise exception 'VERIFY 6 failed: another account withdrawing the recipe answered % and the row is %', ok_b,
      case when exists (select 1 from public.shared_recipes s where s.id = rid) then 'still there' else 'gone' end;
  end if;

  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok_a := public.withdraw_shared_recipe(rid);
  ok_a2 := public.withdraw_shared_recipe(rid);
  reset role;
  if not ok_a or ok_a2 or exists (select 1 from public.shared_recipes s where s.id = rid) then
    raise exception 'VERIFY 6 failed: the author''s withdraw answered % then % (expected true, then false, and the row gone)', ok_a, ok_a2;
  end if;

  perform pg_catalog.set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  begin
    perform public.withdraw_shared_recipe(rid);
    caught := 'no error';
  exception when others then
    caught := sqlerrm;
  end;
  reset role;
  if caught is distinct from 'not authenticated' then
    raise exception 'VERIFY 6 failed: a withdraw with no sub gave "%"', caught;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 6';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 6') = 0 then raise; end if;
    raise notice 'VERIFY 6 ok: another account cannot withdraw a recipe; its author can, once; no session is refused';
end $$;

-- 7. erasure: the app's own path, called by the account itself
do $$
declare
  a    uuid := pg_catalog.gen_random_uuid();
  b    uuid := pg_catalog.gen_random_uuid();
  k    text;
  base jsonb := '{"name":"Garlic pasta","servings":2,"items":[{"name":"spaghetti","qty":"200 g","calories":742,"protein":26,"carbs":150,"fat":3}]}';
  left_a bigint;
  left_b bigint;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35a-' || a || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb),
           (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify35b-' || b || '@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  select s.decrypted_secret into k from vault.decrypted_secrets s where s.name = 'share_recipe_key' order by s.created_at desc limit 1;

  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-e-b', base);
  reset role;

  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.publish_shared_recipe(k, 'en', array['lunch'], 'verify35-e-1', base);
  perform public.publish_shared_recipe(k, 'en', array['dinner'], 'verify35-e-2', base);
  perform public.delete_own_account();
  reset role;

  select (select pg_catalog.count(*) from public.shared_recipes s where s.author = a)
       + (select pg_catalog.count(*) from auth.users u where u.id = a)
    into left_a;
  select pg_catalog.count(*) into left_b from public.shared_recipes s where s.author = b;
  if left_a <> 0 then
    raise exception 'VERIFY 7 failed: % rows of the erased account survive (its shared recipes, or the account)', left_a;
  end if;
  if left_b <> 1 then
    raise exception 'VERIFY 7 failed: erasing one account left another with % shared recipes (expected 1)', left_b;
  end if;

  raise exception 'ROLLBACK-OK: VERIFY 7';
exception
  when others then
    if pg_catalog.strpos(sqlerrm, 'ROLLBACK-OK: VERIFY 7') = 0 then raise; end if;
    raise notice 'VERIFY 7 ok: erasure removes every recipe the account shared and leaves another account''s';
end $$;

commit;
