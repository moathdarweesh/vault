-- ============================================================================
-- THE VAULT — schema v2 FINAL: CORE (non-social) tables + COMPLETE RLS.
-- ============================================================================
-- Apply-ready. Run in the Supabase SQL editor (as the migration role).
--
-- ADDITIVE ONLY. This file does NOT touch, alter, or drop public.vault_data,
-- auth.users, or any other live object. Idempotent where safe
-- (create table if not exists; drop policy if exists before create policy).
--
-- Social tables (friendships, coaching_relationships, user_exercise_stats) are
-- intentionally OMITTED per the owner's scope decision. Every table below is
-- therefore PURE own-data isolation, except the two shared catalogs
-- (exercises, cardio_types) which mix a read-only global catalog with per-user
-- custom rows.
--
-- Sync contract per syncable row: client-generated id + server-authored
-- updated_at (trigger) + deleted_at tombstone.
--
-- ----------------------------------------------------------------------------
-- SECURITY MODEL (read before applying)
-- ----------------------------------------------------------------------------
-- Threat model: the application layer WILL eventually be wrong (a forgotten
-- `where user_id = ?`, an ORM scope miss, injected input). Isolation is proven
-- in the database so an app bug becomes a 403, not a breach.
--
-- Supabase role model, and how each interacts with RLS on these tables:
--   * anon           — logged-out client. Granted NOTHING on these tables
--                       (revoked below). Even if reached, auth.uid() is null so
--                       every policy fails. Double-locked.
--   * authenticated  — the logged-in client, via the PUBLISHABLE/anon key only
--                       (see js/cloud.js line 14 — no privileged key ships).
--                       NOT a table owner, NOT superuser => RLS is fully
--                       ENFORCED against it. This is the isolation boundary.
--   * service_role   — server-side only, has the BYPASSRLS attribute, so it
--                       reads/writes ALL users' rows. This is how the OWNER
--                       analyzes aggregate data (see the OWNER ANALYTICS note at
--                       the bottom). This key must live in secrets, never client.
--   * postgres       — table owner (the SQL editor session). Owners bypass RLS
--                       on their own tables UNLESS `force row level security` is
--                       set (see the FORCE note below).
--
-- RLS-enabled != RLS-enforced. All three traps are checked in this file:
--   (a) RLS enabled with NO policy => denies all (safe, but unusable) — every
--       table below has explicit per-command policies.
--   (b) a `using (true)` policy => protects nothing — NONE is used here.
--   (c) owner/superuser bypass => see the FORCE note; the app never connects as
--       owner/superuser, so the client boundary holds regardless.
--
-- FORCE ROW LEVEL SECURITY — deliberate decision:
--   Not enabled by default. The application only ever authenticates as
--   `authenticated` (a non-owner role), so RLS is already fully enforced on the
--   client path. service_role analytics (owner requirement) relies on BYPASSRLS,
--   which `force` does NOT override — so forcing would keep analytics working.
--   OPTIONAL HARDENING (defense in depth against an accidental owner-role
--   connection): the migration engineer MAY run, per table:
--       alter table public.<t> force row level security;
--   This closes the `postgres`-owner bypass while leaving service_role analytics
--   intact. It is left OUT of the default apply so the owner's dashboard/SQL
--   editor (postgres) keeps its expected full visibility per the analytics note.
--
-- Injection surface: no views (nothing bypasses base-table RLS); the only
-- function is the SECURITY INVOKER trigger `touch_updated_at`, which contains no
-- dynamic SQL and pins search_path. Clean.
-- ============================================================================

-- ---- 0. Extensions, enums, shared trigger ---------------------------------
create extension if not exists citext;

do $$ begin
  create type exercise_category as enum
    ('Chest','Back','Legs','Shoulders','Arms','Core','Other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_pref  as enum ('kg','lb');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lang_pref  as enum ('en','ar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_pref as enum ('dark','light');
exception when duplicate_object then null; end $$;

-- Server-authoritative updated_at: forced on INSERT and UPDATE so a client's
-- clock can never corrupt the incremental-sync watermark. SECURITY INVOKER
-- (default). Hardened: search_path pinned to '' and now() fully qualified so a
-- caller-controlled search_path cannot influence resolution.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end $$;

-- ---- 1. IDENTITY ----------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path  text,                       -- Supabase Storage path, not a blob
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  lang       lang_pref  not null default 'en',
  theme      theme_pref not null default 'dark',
  unit       unit_pref  not null default 'kg',
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_user_prefs_touch on public.user_prefs;
create trigger trg_user_prefs_touch before insert or update on public.user_prefs
  for each row execute function public.touch_updated_at();

-- ---- 2. EXERCISE CATALOG (global rows owner_id IS NULL + per-user customs) -
create table if not exists public.exercises (
  id           uuid primary key,                         -- client/catalog id
  owner_id     uuid references auth.users(id) on delete cascade,  -- NULL = global
  name         text not null,
  category     exercise_category not null default 'Other',
  image_slug   text,                                     -- free-exercise-db slug
  machine_type text,                                     -- client SVG blueprint key
  -- Derived, single-writer, drift-proof (replaces the old CHECK + stored bool):
  is_custom    boolean generated always as (owner_id is not null) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index if not exists exercises_global_name_key
  on public.exercises (lower(name)) where owner_id is null and deleted_at is null;
create unique index if not exists exercises_custom_name_key
  on public.exercises (owner_id, lower(name)) where owner_id is not null and deleted_at is null;
create index if not exists exercises_owner_idx on public.exercises (owner_id);
drop trigger if exists trg_exercises_touch on public.exercises;
create trigger trg_exercises_touch before insert or update on public.exercises
  for each row execute function public.touch_updated_at();

create table if not exists public.user_exercise_prefs (
  user_id           uuid not null references auth.users(id) on delete cascade,
  exercise_id       uuid not null references public.exercises(id) on delete cascade,
  in_my_list        boolean not null default false,
  custom_image_path text,                                -- Storage path (not base64)
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  primary key (user_id, exercise_id)
);
drop trigger if exists trg_uxp_touch on public.user_exercise_prefs;
create trigger trg_uxp_touch before insert or update on public.user_exercise_prefs
  for each row execute function public.touch_updated_at();

-- ---- 3. WORKOUTS (session -> sets) ----------------------------------------
create table if not exists public.workout_sessions (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  performed_on date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, performed_on desc);
create index if not exists workout_sessions_exercise_idx
  on public.workout_sessions (user_id, exercise_id);
drop trigger if exists trg_ws_touch on public.workout_sessions;
create trigger trg_ws_touch before insert or update on public.workout_sessions
  for each row execute function public.touch_updated_at();

create table if not exists public.workout_sets (
  id         uuid primary key,                           -- client-assigned per set
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  set_index  smallint not null,
  reps       smallint not null default 0 check (reps   >= 0),
  weight     numeric(6,2) not null default 0 check (weight >= 0),  -- unit per user_prefs.unit
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists workout_sets_session_index_key
  on public.workout_sets (session_id, set_index) where deleted_at is null;
create index if not exists workout_sets_session_idx on public.workout_sets (session_id);
drop trigger if exists trg_wset_touch on public.workout_sets;
create trigger trg_wset_touch before insert or update on public.workout_sets
  for each row execute function public.touch_updated_at();

-- ---- 4. CARDIO (text PK preserves built-in slugs + Health Connect mapping) -
create table if not exists public.cardio_types (
  id         text primary key,                           -- 'treadmill' ... | 'custom-<uuid>'
  owner_id   uuid references auth.users(id) on delete cascade,  -- NULL = built-in
  label      text not null,
  icon_name  text not null default 'heart',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists cardio_types_owner_idx on public.cardio_types (owner_id);
drop trigger if exists trg_ctypes_touch on public.cardio_types;
create trigger trg_ctypes_touch before insert or update on public.cardio_types
  for each row execute function public.touch_updated_at();

create table if not exists public.cardio_logs (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  cardio_type_id text not null references public.cardio_types(id) on delete restrict,
  performed_on   date not null,
  duration_min   integer not null default 0 check (duration_min >= 0),
  calories       numeric(7,1) not null default 0 check (calories >= 0),
  source         text,                                   -- 'health' | NULL(manual)
  hc_key         text,                                   -- HC session start (dedupe)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create unique index if not exists cardio_logs_hc_key
  on public.cardio_logs (user_id, hc_key) where hc_key is not null and deleted_at is null;
create index if not exists cardio_logs_user_date_idx
  on public.cardio_logs (user_id, performed_on desc);
drop trigger if exists trg_cardio_touch on public.cardio_logs;
create trigger trg_cardio_touch before insert or update on public.cardio_logs
  for each row execute function public.touch_updated_at();

-- ---- 5. NUTRITION ---------------------------------------------------------
create table if not exists public.foods (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  serving    text,
  calories   numeric(7,1) not null default 0 check (calories >= 0),
  protein    numeric(7,2) not null default 0 check (protein  >= 0),
  carbs      numeric(7,2) not null default 0 check (carbs    >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists foods_user_idx on public.foods (user_id);
drop trigger if exists trg_foods_touch on public.foods;
create trigger trg_foods_touch before insert or update on public.foods
  for each row execute function public.touch_updated_at();

create table if not exists public.food_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  food_id    uuid references public.foods(id) on delete set null,  -- NULL for AI/manual
  logged_on  date not null,
  name       text not null,                               -- snapshot
  servings   numeric(6,2) not null default 1 check (servings > 0),
  calories   numeric(7,1) not null default 0 check (calories >= 0),  -- per serving
  protein    numeric(7,2) not null default 0 check (protein  >= 0),
  carbs      numeric(7,2) not null default 0 check (carbs    >= 0),
  fat        numeric(7,2) not null default 0 check (fat      >= 0),
  source     text,                                        -- 'ai' | 'manual' | NULL
  logged_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, logged_on desc);
drop trigger if exists trg_foodlogs_touch on public.food_logs;
create trigger trg_foodlogs_touch before insert or update on public.food_logs
  for each row execute function public.touch_updated_at();

-- ---- 6. SLEEP -------------------------------------------------------------
create table if not exists public.sleep_logs (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  slept_on     date not null,
  sleep_time   time,
  wake_time    time,
  duration_min integer not null default 0 check (duration_min >= 0),
  source       text,                                      -- 'health' | NULL
  hc_key       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index if not exists sleep_logs_hc_key
  on public.sleep_logs (user_id, hc_key) where hc_key is not null and deleted_at is null;
create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, slept_on desc);
drop trigger if exists trg_sleep_touch on public.sleep_logs;
create trigger trg_sleep_touch before insert or update on public.sleep_logs
  for each row execute function public.touch_updated_at();

-- ---- 7. WEEKLY PLAN -------------------------------------------------------
create table if not exists public.plan_days (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  name        text not null default 'Workout',
  notes       text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, day_of_week)
);
drop trigger if exists trg_plandays_touch on public.plan_days;
create trigger trg_plandays_touch before insert or update on public.plan_days
  for each row execute function public.touch_updated_at();

create table if not exists public.plan_day_exercises (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position    smallint not null default 0,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  foreign key (user_id, day_of_week)
    references public.plan_days(user_id, day_of_week) on delete cascade
);
create unique index if not exists plan_day_ex_unique
  on public.plan_day_exercises (user_id, day_of_week, exercise_id) where deleted_at is null;
create index if not exists plan_day_ex_idx
  on public.plan_day_exercises (user_id, day_of_week, position);
drop trigger if exists trg_plandayex_touch on public.plan_day_exercises;
create trigger trg_plandayex_touch before insert or update on public.plan_day_exercises
  for each row execute function public.touch_updated_at();

-- ---- 8. SUPPLEMENTS -------------------------------------------------------
create table if not exists public.supplements (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  dose       text,
  color      text not null default '#22d3ee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists supplements_user_idx on public.supplements (user_id);
drop trigger if exists trg_supp_touch on public.supplements;
create trigger trg_supp_touch before insert or update on public.supplements
  for each row execute function public.touch_updated_at();

-- user_id REMOVED (2NF fix): owner derives via supplement_id -> supplements.user_id.
create table if not exists public.supplement_logs (
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  taken_on      date not null,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  primary key (supplement_id, taken_on)
);
create index if not exists supplement_logs_taken_idx on public.supplement_logs (taken_on);
drop trigger if exists trg_supplog_touch on public.supplement_logs;
create trigger trg_supplog_touch before insert or update on public.supplement_logs
  for each row execute function public.touch_updated_at();

-- ---- 9. HEALTH PREFS ------------------------------------------------------
create table if not exists public.health_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hidden     text[] not null default '{}',
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_healthprefs_touch on public.health_prefs;
create trigger trg_healthprefs_touch before insert or update on public.health_prefs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
-- Every one of the 16 tables gets: RLS ENABLED + an explicit policy for EACH of
-- SELECT / INSERT / UPDATE / DELETE. No `using (true)`. UPDATE policies carry
-- BOTH `using` (which rows are targetable) AND `with check` (what they may
-- become) so a row can never be moved out of its owner's tenancy.
--
-- Predicate binds to the session identity `auth.uid()` (from the verified JWT),
-- NEVER to a client-supplied body value. `(select auth.uid())` is used so the
-- planner evaluates it once (initplan) instead of per row.
--
-- Two shapes:
--   OWNED  -> auth.uid() = user_id  (or, for children with no user_id column, an
--             EXISTS against the parent's owner).
--   CATALOG (exercises, cardio_types) -> read shared globals + own customs;
--             write own customs only. A user can NEVER write a global row.
-- ============================================================================

-- ---- profiles (owned; user_id is PK) --------------------------------------
alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- user_prefs (owned; user_id is PK) ------------------------------------
alter table public.user_prefs enable row level security;
drop policy if exists user_prefs_select_own on public.user_prefs;
create policy user_prefs_select_own on public.user_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_prefs_insert_own on public.user_prefs;
create policy user_prefs_insert_own on public.user_prefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists user_prefs_update_own on public.user_prefs;
create policy user_prefs_update_own on public.user_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists user_prefs_delete_own on public.user_prefs;
create policy user_prefs_delete_own on public.user_prefs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- exercises (CATALOG: shared globals owner_id IS NULL + own customs) ----
-- SELECT: any authenticated user sees the shared catalog (owner_id IS NULL) plus
--         their own customs. INSERT/UPDATE/DELETE: OWN rows only; owner_id must
--         equal auth.uid(), so a client can never mint, edit, or delete a global
--         catalog row, nor re-home a row to NULL or to another user. Catalog
--         maintenance happens only as service_role (the owner).
alter table public.exercises enable row level security;
drop policy if exists exercises_select_catalog_or_own on public.exercises;
create policy exercises_select_catalog_or_own on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
drop policy if exists exercises_insert_own on public.exercises;
create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists exercises_update_own on public.exercises;
create policy exercises_update_own on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists exercises_delete_own on public.exercises;
create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---- user_exercise_prefs (owned; user_id in composite PK) -----------------
alter table public.user_exercise_prefs enable row level security;
drop policy if exists uxp_select_own on public.user_exercise_prefs;
create policy uxp_select_own on public.user_exercise_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists uxp_insert_own on public.user_exercise_prefs;
create policy uxp_insert_own on public.user_exercise_prefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists uxp_update_own on public.user_exercise_prefs;
create policy uxp_update_own on public.user_exercise_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists uxp_delete_own on public.user_exercise_prefs;
create policy uxp_delete_own on public.user_exercise_prefs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- workout_sessions (owned) ---------------------------------------------
alter table public.workout_sessions enable row level security;
drop policy if exists workout_sessions_select_own on public.workout_sessions;
create policy workout_sessions_select_own on public.workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_insert_own on public.workout_sessions;
create policy workout_sessions_insert_own on public.workout_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_update_own on public.workout_sessions;
create policy workout_sessions_update_own on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_delete_own on public.workout_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- workout_sets (CHILD: no user_id column by design [BCNF]) --------------
-- Ownership is enforced via EXISTS against the parent workout_sessions, whose id
-- is the PK (indexed) and whose own RLS is also owner-scoped => the subquery is
-- evaluated under the caller's RLS, giving defense in depth. session_id is
-- indexed (workout_sets_session_idx) so the check is index-friendly. The
-- with-check on INSERT/UPDATE prevents attaching a set to a session you don't own.
alter table public.workout_sets enable row level security;
drop policy if exists workout_sets_select_own on public.workout_sets;
create policy workout_sets_select_own on public.workout_sets
  for select to authenticated
  using (exists (select 1 from public.workout_sessions ws
                 where ws.id = workout_sets.session_id
                   and ws.user_id = (select auth.uid())));
drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated
  with check (exists (select 1 from public.workout_sessions ws
                      where ws.id = workout_sets.session_id
                        and ws.user_id = (select auth.uid())));
drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own on public.workout_sets
  for update to authenticated
  using (exists (select 1 from public.workout_sessions ws
                 where ws.id = workout_sets.session_id
                   and ws.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions ws
                      where ws.id = workout_sets.session_id
                        and ws.user_id = (select auth.uid())));
drop policy if exists workout_sets_delete_own on public.workout_sets;
create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated
  using (exists (select 1 from public.workout_sessions ws
                 where ws.id = workout_sets.session_id
                   and ws.user_id = (select auth.uid())));

-- ---- cardio_types (CATALOG: shared built-ins owner_id IS NULL + own customs)
-- Same shape as exercises. Built-in slugs (treadmill/walking/running/cycling)
-- are global (owner_id NULL); customs are 'custom-<uuid>' owned rows. Users read
-- all built-ins + their own; write their own only; never touch a built-in.
alter table public.cardio_types enable row level security;
drop policy if exists cardio_types_select_catalog_or_own on public.cardio_types;
create policy cardio_types_select_catalog_or_own on public.cardio_types
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
drop policy if exists cardio_types_insert_own on public.cardio_types;
create policy cardio_types_insert_own on public.cardio_types
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists cardio_types_update_own on public.cardio_types;
create policy cardio_types_update_own on public.cardio_types
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists cardio_types_delete_own on public.cardio_types;
create policy cardio_types_delete_own on public.cardio_types
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---- cardio_logs (owned) --------------------------------------------------
alter table public.cardio_logs enable row level security;
drop policy if exists cardio_logs_select_own on public.cardio_logs;
create policy cardio_logs_select_own on public.cardio_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists cardio_logs_insert_own on public.cardio_logs;
create policy cardio_logs_insert_own on public.cardio_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists cardio_logs_update_own on public.cardio_logs;
create policy cardio_logs_update_own on public.cardio_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists cardio_logs_delete_own on public.cardio_logs;
create policy cardio_logs_delete_own on public.cardio_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- foods (owned) --------------------------------------------------------
alter table public.foods enable row level security;
drop policy if exists foods_select_own on public.foods;
create policy foods_select_own on public.foods
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists foods_insert_own on public.foods;
create policy foods_insert_own on public.foods
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists foods_update_own on public.foods;
create policy foods_update_own on public.foods
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists foods_delete_own on public.foods;
create policy foods_delete_own on public.foods
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- food_logs (owned; direct user_id kept for index-friendly RLS) --------
alter table public.food_logs enable row level security;
drop policy if exists food_logs_select_own on public.food_logs;
create policy food_logs_select_own on public.food_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists food_logs_insert_own on public.food_logs;
create policy food_logs_insert_own on public.food_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists food_logs_update_own on public.food_logs;
create policy food_logs_update_own on public.food_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists food_logs_delete_own on public.food_logs;
create policy food_logs_delete_own on public.food_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- sleep_logs (owned) ---------------------------------------------------
alter table public.sleep_logs enable row level security;
drop policy if exists sleep_logs_select_own on public.sleep_logs;
create policy sleep_logs_select_own on public.sleep_logs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists sleep_logs_insert_own on public.sleep_logs;
create policy sleep_logs_insert_own on public.sleep_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists sleep_logs_update_own on public.sleep_logs;
create policy sleep_logs_update_own on public.sleep_logs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists sleep_logs_delete_own on public.sleep_logs;
create policy sleep_logs_delete_own on public.sleep_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- plan_days (owned; user_id in composite PK) ---------------------------
alter table public.plan_days enable row level security;
drop policy if exists plan_days_select_own on public.plan_days;
create policy plan_days_select_own on public.plan_days
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists plan_days_insert_own on public.plan_days;
create policy plan_days_insert_own on public.plan_days
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists plan_days_update_own on public.plan_days;
create policy plan_days_update_own on public.plan_days
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists plan_days_delete_own on public.plan_days;
create policy plan_days_delete_own on public.plan_days
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- plan_day_exercises (owned; direct user_id kept for index-friendly RLS)
-- Has its own user_id column, so the policy is a direct auth.uid() = user_id (no
-- parent EXISTS needed). The composite FK to plan_days still enforces that the
-- (user_id, day_of_week) references the caller's own plan day.
alter table public.plan_day_exercises enable row level security;
drop policy if exists plan_day_ex_select_own on public.plan_day_exercises;
create policy plan_day_ex_select_own on public.plan_day_exercises
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists plan_day_ex_insert_own on public.plan_day_exercises;
create policy plan_day_ex_insert_own on public.plan_day_exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists plan_day_ex_update_own on public.plan_day_exercises;
create policy plan_day_ex_update_own on public.plan_day_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists plan_day_ex_delete_own on public.plan_day_exercises;
create policy plan_day_ex_delete_own on public.plan_day_exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- supplements (owned) --------------------------------------------------
alter table public.supplements enable row level security;
drop policy if exists supplements_select_own on public.supplements;
create policy supplements_select_own on public.supplements
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists supplements_insert_own on public.supplements;
create policy supplements_insert_own on public.supplements
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists supplements_update_own on public.supplements;
create policy supplements_update_own on public.supplements
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists supplements_delete_own on public.supplements;
create policy supplements_delete_own on public.supplements
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- supplement_logs (CHILD: no user_id column by design [2NF fix]) --------
-- Ownership derives via EXISTS against the parent supplements
-- (supplement_id -> supplements.user_id). supplements.id is the PK (indexed),
-- supplement_id is the FK/left column of this table's PK => index-friendly. The
-- with-check on INSERT/UPDATE prevents logging against a supplement you don't own.
alter table public.supplement_logs enable row level security;
drop policy if exists supplement_logs_select_own on public.supplement_logs;
create policy supplement_logs_select_own on public.supplement_logs
  for select to authenticated
  using (exists (select 1 from public.supplements s
                 where s.id = supplement_logs.supplement_id
                   and s.user_id = (select auth.uid())));
drop policy if exists supplement_logs_insert_own on public.supplement_logs;
create policy supplement_logs_insert_own on public.supplement_logs
  for insert to authenticated
  with check (exists (select 1 from public.supplements s
                      where s.id = supplement_logs.supplement_id
                        and s.user_id = (select auth.uid())));
drop policy if exists supplement_logs_update_own on public.supplement_logs;
create policy supplement_logs_update_own on public.supplement_logs
  for update to authenticated
  using (exists (select 1 from public.supplements s
                 where s.id = supplement_logs.supplement_id
                   and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.supplements s
                      where s.id = supplement_logs.supplement_id
                        and s.user_id = (select auth.uid())));
drop policy if exists supplement_logs_delete_own on public.supplement_logs;
create policy supplement_logs_delete_own on public.supplement_logs
  for delete to authenticated
  using (exists (select 1 from public.supplements s
                 where s.id = supplement_logs.supplement_id
                   and s.user_id = (select auth.uid())));

-- ---- health_prefs (owned; user_id is PK) ----------------------------------
alter table public.health_prefs enable row level security;
drop policy if exists health_prefs_select_own on public.health_prefs;
create policy health_prefs_select_own on public.health_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists health_prefs_insert_own on public.health_prefs;
create policy health_prefs_insert_own on public.health_prefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists health_prefs_update_own on public.health_prefs;
create policy health_prefs_update_own on public.health_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists health_prefs_delete_own on public.health_prefs;
create policy health_prefs_delete_own on public.health_prefs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================================
-- LEAST-PRIVILEGE GRANTS
-- ============================================================================
-- Grants are a SEPARATE layer from RLS: RLS filters rows, grants gate whether a
-- role may touch the table at all. Belt and suspenders.
--   * anon (logged-out)  -> NOTHING. All cloud tables require a login; a
--                           logged-out user runs local-only (see js/storage.js).
--   * authenticated      -> exactly the DML the app performs. RLS then restricts
--                           WHICH rows.
--   * service_role       -> full access, for the owner's cross-user analytics.
-- No GRANT ALL to anon/authenticated; no column is granted beyond what is used.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_prefs','exercises','user_exercise_prefs',
    'workout_sessions','workout_sets','cardio_types','cardio_logs',
    'foods','food_logs','sleep_logs','plan_days','plan_day_exercises',
    'supplements','supplement_logs','health_prefs'
  ] loop
    execute format('revoke all on public.%I from anon, public;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
  end loop;
end $$;

-- ============================================================================
-- OWNER ANALYTICS — how "hold and analyze ALL users' data" is satisfied
-- ============================================================================
-- No extra table and no denormalized copy is needed. The normalized tables above
-- already ARE the owner's warehouse. RLS restricts ONLY the anon/publishable key
-- that ships in the client (js/cloud.js). It does NOT restrict:
--   * service_role  — has BYPASSRLS; use it server-side (Edge Function, cron, a
--                     server script) with the SERVICE_ROLE key (kept in secrets,
--                     never in the repo or the client) to read every user's rows.
--   * the SQL editor / dashboard — the owner's `postgres` session bypasses RLS on
--                     its own tables (unless the optional `force` hardening above
--                     is applied), so plain `select ... from public.workout_sessions`
--                     in the SQL editor returns ALL users' rows for analysis.
-- So the owner queries/join/aggregates across all users freely; each END USER,
-- holding only the publishable key, sees strictly their own rows.
-- REMINDER: the app must ONLY ever use the publishable/anon key. If a service_role
-- key or a direct owner connection string ever reaches client code, isolation is
-- gone — that key belongs only in server-side secrets.

-- ============================================================================
-- SUPABASE STORAGE — bucket policy INTENT (run in Storage -> Policies UI)
-- ============================================================================
-- Storage RLS lives on the storage.objects table, which the Storage UI manages;
-- these are given as instructions because the Policies UI is the supported path
-- (equivalent SQL is shown for the migration engineer who prefers to run it).
--
-- Create BOTH buckets as PRIVATE (social is deferred: no avatar or custom photo
-- is shared with anyone, so nothing needs public read):
--   * avatars          <- profiles.avatar_path                 objects: '<uid>/avatar.jpg'
--   * exercise-images  <- user_exercise_prefs.custom_image_path objects: '<uid>/<exercise_id>.jpg'
--
-- GUARANTEE for each bucket: a user may only read/write objects whose FIRST path
-- segment is their own uid. The client must always upload to a key that begins
-- with `${auth.uid()}/`. Serve private objects via short-lived signed URLs.
--
-- For EACH bucket create FOUR policies (SELECT, INSERT, UPDATE, DELETE), target
-- role `authenticated`, all with the SAME folder predicate. In the UI: Storage ->
-- Policies -> New policy -> "For full customization". Predicate template
-- (swap the bucket_id per bucket):
--
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = (select auth.uid())::text
--
-- INSERT uses WITH CHECK; SELECT and DELETE use USING; UPDATE needs BOTH USING
-- and WITH CHECK (same predicate) or a user could move a file out of their folder.
--
-- Equivalent SQL for the 'avatars' bucket (repeat with bucket_id='exercise-images'):
--   drop policy if exists avatars_select_own on storage.objects;
--   create policy avatars_select_own on storage.objects
--     for select to authenticated
--     using ( bucket_id = 'avatars'
--         and (storage.foldername(name))[1] = (select auth.uid())::text );
--   drop policy if exists avatars_insert_own on storage.objects;
--   create policy avatars_insert_own on storage.objects
--     for insert to authenticated
--     with check ( bucket_id = 'avatars'
--         and (storage.foldername(name))[1] = (select auth.uid())::text );
--   drop policy if exists avatars_update_own on storage.objects;
--   create policy avatars_update_own on storage.objects
--     for update to authenticated
--     using ( bucket_id = 'avatars'
--         and (storage.foldername(name))[1] = (select auth.uid())::text )
--     with check ( bucket_id = 'avatars'
--         and (storage.foldername(name))[1] = (select auth.uid())::text );
--   drop policy if exists avatars_delete_own on storage.objects;
--   create policy avatars_delete_own on storage.objects
--     for delete to authenticated
--     using ( bucket_id = 'avatars'
--         and (storage.foldername(name))[1] = (select auth.uid())::text );

-- ============================================================================
-- VERIFICATION CHECKLIST (confirm none is missed after apply)
-- ============================================================================
-- Expect 16 rows, all rowsecurity = true:
--   select relname, relrowsecurity, relforcerowsecurity
--     from pg_class where relnamespace = 'public'::regnamespace
--      and relname in ('profiles','user_prefs','exercises','user_exercise_prefs',
--        'workout_sessions','workout_sets','cardio_types','cardio_logs','foods',
--        'food_logs','sleep_logs','plan_days','plan_day_exercises','supplements',
--        'supplement_logs','health_prefs') order by relname;
-- Expect 4 policies per table (64 total; catalogs still 4 each):
--   select tablename, cmd, count(*) from pg_policies where schemaname='public'
--     group by tablename, cmd order by tablename, cmd;
-- Any table with rowsecurity=false OR fewer than 4 policies is a blocker.
-- ============================================================================

-- ============================================================================
-- PERFORMANCE / ACCESS-PATTERN INDEXES  (additive; index-only — no table or
-- policy change). Every index names the exact query it serves. Written with
-- `create index if not exists` to match this file's idempotent style.
--
-- APPLY NOTE (db-migration-engineer): on a table that ALREADY holds rows, a
-- plain CREATE INDEX takes an ACCESS EXCLUSIVE lock and blocks writes for the
-- whole build. When applying to a populated table, re-issue each of these as
--   create index concurrently if not exists <name> on ... ;
-- run OUTSIDE a transaction block (concurrently cannot run in a txn). On the
-- first fresh apply (empty tables) the plain form below is fine.
--
-- Derived from the app's real access patterns (js/storage.js, js/app.js):
--   sessions.listByExercise  -> where user_id=? and exercise_id=? order by date desc
--   sessions.listAll / cardio/sleep .list -> where user_id=? order by <date> desc
--   foodLogs.listForDate     -> where user_id=? and logged_on=?
--   supplements.isTaken/streak -> where supplement_id=? [and taken_on=?]
--   plan.get                 -> where user_id=? [and day_of_week=?] order by position
--   incremental pull-sync    -> where user_id=? and updated_at > <watermark>
-- ============================================================================

-- ---- (A) FOREIGN-KEY referencing-side coverage ----------------------------
-- Every FK gets an index on the CHILD side so a parent delete/update is not a
-- full seq scan (and lock) of the child. Listed here are only the FKs NOT
-- already covered by an existing PK/index whose LEADING column is the FK.
-- (Already covered, so intentionally not repeated: workout_sets.session_id via
--  workout_sets_session_idx; supplement_logs.supplement_id via its PK;
--  plan_day_exercises(user_id,day_of_week) via plan_day_ex_idx; every user_id
--  FK via its user-leading PK/index; exercises.owner_id & cardio_types.owner_id
--  via their *_owner_idx.)

-- exercises delete (user removing a CUSTOM exercise) CASCADEs here. The PK
-- (user_id, exercise_id) does NOT lead with exercise_id, so the cascade would
-- seq-scan. Serves: ON DELETE CASCADE from public.exercises.
create index if not exists user_exercise_prefs_exercise_idx
  on public.user_exercise_prefs (exercise_id);

-- exercise_id FK is ON DELETE RESTRICT; deleting an exercise probes the LARGEST
-- table for referencing rows. workout_sessions_exercise_idx leads with user_id,
-- not exercise_id, so it cannot serve this integrity probe (a bare exercise_id
-- lookup). Serves: FK RESTRICT check on public.exercises delete.
create index if not exists workout_sessions_exercise_fk_idx
  on public.workout_sessions (exercise_id);

-- cardio_type_id FK is ON DELETE RESTRICT; deleting a custom cardio type probes
-- cardio_logs. No existing index leads with cardio_type_id.
-- Serves: FK RESTRICT check on public.cardio_types delete.
create index if not exists cardio_logs_type_idx
  on public.cardio_logs (cardio_type_id);

-- food_id FK is ON DELETE SET NULL; deleting a reference food must find every
-- food_log pointing at it to null the column. No existing index on food_id.
-- Serves: FK SET NULL on public.foods delete.
create index if not exists food_logs_food_idx
  on public.food_logs (food_id);

-- exercise_id FK is ON DELETE CASCADE; deleting an exercise cascades into the
-- weekly plan. Neither plan index leads with exercise_id.
-- Serves: ON DELETE CASCADE from public.exercises.
create index if not exists plan_day_exercises_exercise_idx
  on public.plan_day_exercises (exercise_id);

-- ---- (B) INCREMENTAL PULL-SYNC watermark (user_id, updated_at) -------------
-- Per-table incremental sync pulls only rows changed since the client's last
-- watermark: `where user_id=? and updated_at > ? order by updated_at`. The
-- existing (user_id, <business_date> desc) indexes CANNOT serve this: they are
-- ordered by performed_on/logged_on/slept_on, so a watermark pull would read
-- ALL of the user's rows every sync. These four high-volume, append-only log
-- tables therefore get the watermark index (distinct from, not redundant with,
-- their date index). Bounded/one-row-per-user tables are omitted below.
create index if not exists workout_sessions_user_updated_idx
  on public.workout_sessions (user_id, updated_at);
create index if not exists cardio_logs_user_updated_idx
  on public.cardio_logs (user_id, updated_at);
create index if not exists food_logs_user_updated_idx
  on public.food_logs (user_id, updated_at);
create index if not exists sleep_logs_user_updated_idx
  on public.sleep_logs (user_id, updated_at);

-- ---- DELIBERATELY OMITTED (decisions on record, not oversights) -----------
-- * profiles / user_prefs / health_prefs: exactly ONE row per user (user_id is
--   the PK). Reads and the sync watermark are a PK point-lookup; a
--   (user_id, updated_at) index would just duplicate the PK.
-- * plan_days: <=7 rows per user (PK (user_id, day_of_week)); the PK already
--   clusters a user's days. A watermark index is not worth its write cost.
-- * foods / supplements: bounded reference lists. The existing foods_user_idx /
--   supplements_user_idx (user_id) already narrow to the user's small set for
--   both list() and the watermark filter. Adding (user_id, updated_at) would
--   make the plain (user_id) index a redundant prefix, and this file only ADDs
--   (never drops), so the sync filter rides the existing index.
-- * user_exercise_prefs / plan_day_exercises: bounded per user; the PK /
--   plan_day_ex_idx already lead with user_id and cover the small watermark
--   scan. (Their FK-to-exercises indexes in section A are a separate concern.)
-- * exercises (own customs): few per user; exercises_owner_idx (owner_id) serves
--   the `owner_id=? and updated_at>?` custom pull, and the GLOBAL catalog
--   (owner_id is null) is admin-maintained and pulled wholesale/rarely — so no
--   (owner_id, updated_at).
-- * workout_sets / supplement_logs: CHILD tables with no user_id. Incremental
--   sync is PARENT-driven (re-pull children of changed sessions/supplements)
--   via workout_sets_session_idx (session_id) and the supplement_logs PK. A bare
--   (updated_at) index here would be a cross-tenant scan and is avoided.
-- * listByExercise date sort: (user_id, exercise_id) narrows to a handful of
--   rows per exercise; the `order by performed_on desc` runs on that tiny set. A
--   wider (user_id, exercise_id, performed_on desc) would make the existing
--   (user_id, exercise_id) index redundant for a negligible sort gain.
-- * list() name sorts (exercises/foods/supplements): small per-user/catalog sets
--   sorted client-side; no (..., name) index warranted.
-- * partial `where deleted_at is null` variants of the (user_id, date) indexes:
--   not added — they would duplicate the existing full indexes. Revisit (and
--   hand to db-migration-engineer) only if tombstone churn becomes measurable.
-- ============================================================================
