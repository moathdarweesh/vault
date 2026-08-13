do $archive_guard$
begin
  raise exception 'ARCHIVED DRAFT: do not execute any part of schema-v2-draft.sql';
end
$archive_guard$;

-- ============================================================================
-- THE VAULT — schema v2 DRAFT (normalized, multi-user + social)
-- ============================================================================
-- STATUS: DRAFT / ARCHIVE. NOT APPLIED. DO NOT RUN AS-IS.
--
-- ⚠️  DO NOT PASTE THIS FILE INTO SUPABASE. The APPLY-READY file is
--     >>> backend/schema-v2.sql <<<  (core tables + full RLS + indexes).
--     This draft is kept ONLY as a record of the fuller design (it still
--     contains the deferred SOCIAL tables — friendships / coaching /
--     leaderboard — for whenever those features are built later).
--
-- This is a DESIGN artifact produced by the database-architect. It replaces the
-- single-blob `vault_data(user_id, data jsonb)` model (see supabase-setup.sql)
-- with normalized tables so the app can support a leaderboard, friends, and a
-- coach<->trainee relationship.
--
-- Hand-off before anything ships:
--   * normalization-auditor  — confirm 3NF + record the deliberate denormalizations
--   * db-index-optimizer     — build the access-pattern index set (indexes here are seed hints only)
--   * db-security-auditor    — harden the RLS policies sketched in the comments
--   * db-migration-engineer  — turn this into a reversible migration + a blob->tables backfill
--
-- Platform: existing Supabase Postgres (auth.users is the identity table).
-- Conventions: snake_case, plural tables, singular columns, FK = <singular>_id.
-- Sync model: every user-owned, syncable table carries
--     id uuid  (CLIENT-generated, crypto.randomUUID)   — stable across devices
--     updated_at timestamptz  (trigger-maintained)      — last-writer-wins clock
--     deleted_at timestamptz  (tombstone)               — so deletes propagate
--   Enables incremental per-row pull:  WHERE updated_at > :last_sync.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions, enums, shared trigger
-- ----------------------------------------------------------------------------
create extension if not exists citext;   -- case-insensitive usernames

do $$ begin
  create type exercise_category as enum
    ('Chest','Back','Legs','Shoulders','Arms','Core','Other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_pref   as enum ('kg','lb');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lang_pref   as enum ('en','ar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_pref  as enum ('dark','light');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending','accepted','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type coaching_status  as enum ('pending','active','ended');
exception when duplicate_object then null; end $$;

-- Keep updated_at honest on every write (never trust the client's clock for it).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ============================================================================
-- 1. IDENTITY
-- ============================================================================

-- Public-facing identity. auth.users holds the private email; this holds the
-- shareable handle the leaderboard / friends UI renders. One row per user.
-- RLS intent:
--   SELECT: any authenticated user may read a profile (needed to search/add
--           friends and render leaderboard names). Email is NOT here, so this
--           leaks only what the user chose to make public.
--   INSERT/UPDATE/DELETE: only where user_id = auth.uid().
create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     citext not null,
  display_name text,
  avatar_path  text,                       -- Supabase Storage path, not a blob
  is_public    boolean not null default true,   -- opt out of the leaderboard
  share_workouts boolean not null default false, -- let friends see my activity
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint username_len  check (char_length(username) between 3 and 24),
  constraint username_shape check (username ~ '^[a-z0-9_]+$')
);
create unique index profiles_username_key on public.profiles (username);
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Per-user app settings (was blob.prefs). 1:1 with the user.
-- RLS intent: own row only.
create table public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  lang       lang_pref  not null default 'en',
  theme      theme_pref not null default 'dark',
  unit       unit_pref  not null default 'kg',
  updated_at timestamptz not null default now()
);
create trigger trg_user_prefs_touch before update on public.user_prefs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 2. EXERCISE CATALOG  (shared global rows + per-user custom rows in ONE table)
-- ============================================================================
-- One table holds BOTH the ~110 seeded catalog exercises and every user's
-- custom exercises. owner_id IS NULL  => global catalog row (shared, read-only
-- to users, seeded/maintained by the maintainer). owner_id = <uuid> => that
-- user's private custom exercise. This is how catalog + custom coexist WITHOUT
-- copying 110 catalog rows into every user's account.
-- RLS intent:
--   SELECT: owner_id IS NULL  OR  owner_id = auth.uid()
--   INSERT: with check owner_id = auth.uid()   (users can only make custom rows)
--   UPDATE/DELETE: using owner_id = auth.uid()  (nobody edits the global catalog
--                  via the anon key; seed edits happen as the maintainer/service role)
create table public.exercises (
  id           uuid primary key,           -- client-generated
  owner_id     uuid references auth.users(id) on delete cascade,  -- NULL = global
  name         text not null,
  category     exercise_category not null default 'Other',
  image_slug   text,                        -- free-exercise-db slug (catalog photos)
  machine_type text,                        -- key -> client renders SVG blueprint
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- a global row is never custom; a custom row must have an owner
  constraint exercise_owner_custom_ck
    check ( (owner_id is null and is_custom = false)
         or (owner_id is not null and is_custom = true) )
);
-- Case-insensitive uniqueness: global names unique among globals; custom names
-- unique per owner. (Two partial unique indexes because NULL owner_id groups.)
create unique index exercises_global_name_key
  on public.exercises (lower(name)) where owner_id is null and deleted_at is null;
create unique index exercises_custom_name_key
  on public.exercises (owner_id, lower(name)) where owner_id is not null and deleted_at is null;
create index exercises_owner_idx on public.exercises (owner_id);
create trigger trg_exercises_touch before update on public.exercises
  for each row execute function public.touch_updated_at();

-- Per-user overlay on ANY exercise (global or custom): the "in my list" flag,
-- and an optional per-user custom photo. Sparse — only rows the user touched.
-- This keeps per-user state OFF the shared catalog rows. (was blob.exercises[].inMyList
-- and blob.exercises[].customImage).
-- RLS intent: own rows only (user_id = auth.uid()).
create table public.user_exercise_prefs (
  user_id           uuid not null references auth.users(id) on delete cascade,
  exercise_id       uuid not null references public.exercises(id) on delete cascade,
  in_my_list        boolean not null default false,
  custom_image_path text,                   -- Supabase Storage path (NOT base64)
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  primary key (user_id, exercise_id)        -- composite PK, no surrogate needed
);
create trigger trg_uxp_touch before update on public.user_exercise_prefs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. WORKOUTS  (session -> sets, fully normalized)
-- ============================================================================
-- One logged workout of one exercise on one day (was blob.sessions[]).
-- RLS intent:
--   SELECT: owner  OR  (accepted friend of owner AND owner.share_workouts)
--                  OR  (auth.uid() is an ACTIVE coach of owner)
--   INSERT/UPDATE/DELETE: owner only (user_id = auth.uid()).
create table public.workout_sessions (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete restrict,
  performed_on date not null,               -- was `date` "YYYY-MM-DD"
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, performed_on desc);
create index workout_sessions_exercise_idx  on public.workout_sessions (user_id, exercise_id);
create trigger trg_ws_touch before update on public.workout_sessions
  for each row execute function public.touch_updated_at();

-- Individual sets of a session (was the embedded sets:[{reps,weight}] array).
-- set_index preserves the order the user entered them.
-- RLS intent: inherits the parent session's visibility via a subquery on
--   workout_sessions (own + friend + coach read; own-only write).
create table public.workout_sets (
  id          uuid primary key,
  session_id  uuid not null references public.workout_sessions(id) on delete cascade,
  set_index   smallint not null,
  reps        smallint not null default 0 check (reps  >= 0),
  weight      numeric(6,2) not null default 0 check (weight >= 0),  -- kg or lb per user_prefs.unit
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (session_id, set_index)
);
create index workout_sets_session_idx on public.workout_sets (session_id);
create trigger trg_wset_touch before update on public.workout_sets
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 4. CARDIO  (types = global + custom, same pattern as exercises)
-- ============================================================================
-- Built-in cardio types (treadmill/walking/running/cycling) become global rows
-- (owner_id NULL); user-defined types are owned rows. (was CARDIO_TYPES in code
-- + blob.cardioTypes[]).
-- RLS intent: SELECT owner_id IS NULL OR owner = auth.uid(); write own only.
create table public.cardio_types (
  id         uuid primary key,
  owner_id   uuid references auth.users(id) on delete cascade,   -- NULL = built-in
  label      text not null,
  icon_name  text not null default 'heart',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index cardio_types_owner_idx on public.cardio_types (owner_id);
create trigger trg_ctypes_touch before update on public.cardio_types
  for each row execute function public.touch_updated_at();

-- A logged cardio bout (was blob.cardio[]).
-- source/hc_key support Health Connect import dedupe (unchanged semantics).
-- RLS intent: same visibility as workout_sessions (own + friend + coach read).
create table public.cardio_logs (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  cardio_type_id uuid not null references public.cardio_types(id) on delete restrict,
  performed_on   date not null,
  duration_min   integer not null default 0 check (duration_min >= 0),
  calories       numeric(7,1) not null default 0 check (calories >= 0),
  source         text,                       -- e.g. 'health' | NULL(manual)
  hc_key         text,                       -- Health Connect session start (dedupe)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (user_id, hc_key)                    -- de-dupe health imports per user
);
create index cardio_logs_user_date_idx on public.cardio_logs (user_id, performed_on desc);
create trigger trg_cardio_touch before update on public.cardio_logs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 5. NUTRITION
-- ============================================================================
-- Per-user reference food list (was blob.foods[]). Private.
-- RLS intent: own rows only.
create table public.foods (
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
create index foods_user_idx on public.foods (user_id);
create trigger trg_foods_touch before update on public.foods
  for each row execute function public.touch_updated_at();

-- A food logged on a day (was blob.foodLogs["YYYY-MM-DD"][]). The macro columns
-- are DENORMALIZED copies captured at log time (matches current behaviour): an
-- entry keeps its numbers even if the reference food is later edited/deleted,
-- and AI/manual entries may have no reference food at all.
-- RLS intent: own rows only.
create table public.food_logs (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  food_id     uuid references public.foods(id) on delete set null,  -- may be NULL (AI/manual)
  logged_on   date not null,
  name        text not null,               -- snapshot; foods.name may drift/vanish
  servings    numeric(6,2) not null default 1 check (servings > 0),
  calories    numeric(7,1) not null default 0 check (calories >= 0),
  protein     numeric(7,2) not null default 0 check (protein  >= 0),
  carbs       numeric(7,2) not null default 0 check (carbs    >= 0),
  fat         numeric(7,2) not null default 0 check (fat      >= 0),
  source      text,                        -- 'ai' | 'manual' | NULL
  logged_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index food_logs_user_date_idx on public.food_logs (user_id, logged_on desc);
create trigger trg_foodlogs_touch before update on public.food_logs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 6. SLEEP
-- ============================================================================
-- Nightly sleep record (was blob.sleep[]). duration_min is DERIVED from
-- sleep_time/wake_time but stored because (a) Health Connect imports supply it
-- directly and (b) it saves recomputing on every read. Kept consistent by the
-- app / a generated column could replace it later.
-- RLS intent: own rows only.
create table public.sleep_logs (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  slept_on     date not null,              -- the date the sleep is attributed to
  sleep_time   time,                       -- "HH:MM" clock, no tz
  wake_time    time,
  duration_min integer not null default 0 check (duration_min >= 0),
  source       text,                       -- 'health' | NULL
  hc_key       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (user_id, hc_key)
);
create index sleep_logs_user_date_idx on public.sleep_logs (user_id, slept_on desc);
create trigger trg_sleep_touch before update on public.sleep_logs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 7. WEEKLY PLAN
-- ============================================================================
-- One planned workout day (0=Sun..6=Sat) per user (was blob.plan["0".."6"]).
-- RLS intent: own rows only.
create table public.plan_days (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  name        text not null default 'Workout',
  notes       text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, day_of_week)
);
create trigger trg_plandays_touch before update on public.plan_days
  for each row execute function public.touch_updated_at();

-- Ordered exercises within a planned day (was plan[dow].exerciseIds[]).
-- position preserves drag-and-drop order.
-- RLS intent: own rows only.
create table public.plan_day_exercises (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position    smallint not null default 0,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  foreign key (user_id, day_of_week)
    references public.plan_days(user_id, day_of_week) on delete cascade,
  unique (user_id, day_of_week, exercise_id)
);
create index plan_day_ex_idx on public.plan_day_exercises (user_id, day_of_week, position);
create trigger trg_plandayex_touch before update on public.plan_day_exercises
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 8. SUPPLEMENTS
-- ============================================================================
-- Supplement definitions (was blob.supplements[]). Private.
-- RLS intent: own rows only.
create table public.supplements (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  dose       text,
  color      text not null default '#22d3ee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index supplements_user_idx on public.supplements (user_id);
create trigger trg_supp_touch before update on public.supplements
  for each row execute function public.touch_updated_at();

-- "Did I take supplement X on day D" (was blob.supplementLogs["YYYY-MM-DD"][id]=true).
-- A row's existence == taken; deleted_at tombstones an untick so the delete syncs.
-- RLS intent: own rows only.
create table public.supplement_logs (
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  taken_on      date not null,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  primary key (supplement_id, taken_on)
);
create index supplement_logs_user_idx on public.supplement_logs (user_id, taken_on desc);
create trigger trg_supplog_touch before update on public.supplement_logs
  for each row execute function public.touch_updated_at();

-- Health Connect show/hide prefs (was blob.health.hidden[]). The health.data
-- cache itself stays CLIENT-SIDE (device-local mirror of Health Connect); it is
-- derived data with a device-of-record on the phone, so it is NOT stored here.
-- RLS intent: own row only.
create table public.health_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hidden     text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger trg_healthprefs_touch before update on public.health_prefs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 9. SOCIAL  (friends, coaching)
-- ============================================================================
do $archive_social_guard$
begin
  -- This second tripwire covers the plausible partial paste that starts at the
  -- deferred social section and therefore never sees the file-level guard.
  raise exception 'ARCHIVED DRAFT: build social tables in a new RLS-complete migration';
end
$archive_social_guard$;

-- Friend request / friendship. One row per pair, direction preserved so the
-- addressee can accept/decline. status: pending -> accepted (or blocked).
-- RLS intent:
--   SELECT: auth.uid() in (requester_id, addressee_id)
--   INSERT: with check requester_id = auth.uid()  (you send your own requests)
--   UPDATE: using addressee_id = auth.uid() (accept/decline) OR either party (block)
--   DELETE: either party (unfriend / cancel).
create table public.friendships (
  id           uuid primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  updated_at   timestamptz not null default now(),
  constraint no_self_friend check (requester_id <> addressee_id)
);
-- One relationship per unordered pair, regardless of who asked first.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);
create trigger trg_friend_touch before update on public.friendships
  for each row execute function public.touch_updated_at();

-- Coach -> trainee link. Directional: the coach may READ the trainee's workout
-- data (via RLS on workout_sessions/sets/cardio) once status='active'.
-- RLS intent:
--   SELECT: auth.uid() in (coach_id, trainee_id)
--   INSERT: with check requester side = auth.uid() (either can initiate; see requested_by)
--   UPDATE: the OTHER party accepts (status->active) / either ends it.
create table public.coaching_relationships (
  id           uuid primary key,
  coach_id     uuid not null references auth.users(id) on delete cascade,
  trainee_id   uuid not null references auth.users(id) on delete cascade,
  status       coaching_status not null default 'pending',
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint no_self_coach check (coach_id <> trainee_id)
);
create unique index coaching_pair_key on public.coaching_relationships (coach_id, trainee_id);
create index coaching_coach_idx   on public.coaching_relationships (coach_id, status);
create index coaching_trainee_idx on public.coaching_relationships (trainee_id, status);
create trigger trg_coach_touch before update on public.coaching_relationships
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 10. LEADERBOARD  (DELIBERATE DENORMALIZATION — cached aggregate)
-- ============================================================================
-- Per-user, per-exercise personal-record cache. This is NOT a source of truth:
-- it is derived from workout_sets and refreshed on write (trigger) or by a
-- scheduled job. It exists because the leaderboard compares stats ACROSS ALL
-- users; recomputing best_1rm/total_volume from raw sets for every user on every
-- leaderboard render would be O(all sets) per page load. 3NF is knowingly traded
-- for read latency here — normalization-auditor should record this exception.
-- RLS intent:
--   SELECT: rows whose owner has profiles.is_public = true (public leaderboard)
--           OR owner = auth.uid() OR owner is an accepted friend.
--   WRITE:  service role / SECURITY DEFINER refresh function only (never the client).
create table public.user_exercise_stats (
  user_id      uuid not null references auth.users(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  best_weight  numeric(6,2) not null default 0,
  best_one_rm  numeric(7,2) not null default 0,   -- Epley: w * (1 + reps/30)
  total_volume numeric(12,2) not null default 0,  -- sum(reps*weight)
  session_count integer not null default 0,
  computed_at  timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index ues_exercise_rank_idx on public.user_exercise_stats (exercise_id, best_one_rm desc);

-- ============================================================================
-- NOTE: enable RLS + create policies on EVERY table above before exposing the
-- anon key to these tables. Policies are described in-comment per table; the
-- db-security-auditor will author and harden the actual CREATE POLICY set,
-- including the friend/coach visibility subqueries for workout_* and cardio_logs.
-- The legacy public.vault_data table stays in place until every user's blob has
-- been backfilled, then is retired.
-- ============================================================================
