-- ============================================================================
-- THE VAULT — DATA MIGRATION: vault_data.data (JSON blob)  ->  schema v2 tables
-- ============================================================================
--                        *** DRAFT — NOT YET APPLIED ***
--
--   File-authoring only. This script has NOT been run against any database.
--   DO NOT run it in the Supabase SQL editor until the migration engineer's
--   gates pass (verified backup + dry run on a restored copy + owner sign-off).
--
-- ----------------------------------------------------------------------------
-- WHAT THIS IS
-- ----------------------------------------------------------------------------
-- A ONE-TIME, IDEMPOTENT, REVERSIBLE backfill that reads every existing
-- public.vault_data.data JSON blob (the whole-app localStorage snapshot each
-- user syncs today) and expands it into the normalized v2 tables created by
-- backend/schema-v2.sql:
--   user_prefs, exercises(custom), user_exercise_prefs, workout_sessions,
--   workout_sets, cardio_types(custom), cardio_logs, foods, food_logs,
--   sleep_logs, plan_days, plan_day_exercises, supplements, supplement_logs,
--   health_prefs.
--
-- DESIGN PROMISES (every one is honored below):
--   * ADDITIVE + READ-ONLY on the legacy side. public.vault_data, auth.users,
--     and the global catalog rows (exercises/cardio_types WHERE owner_id IS NULL)
--     are NEVER written, altered, or dropped. vault_data stays the source of
--     truth until every blob is backfilled AND verified.
--   * IDS ARE REUSED. crypto.randomUUID() ids the client already minted become
--     the PKs (sessions, cardio, foods, food_logs, sleep, supplements, custom
--     exercises, custom cardio types). Sets and plan-day rows had NO id in the
--     blob, so they get a DETERMINISTIC id (md5 of their natural key) — stable
--     across re-runs, so a replay never duplicates them.
--   * SEED/MACHINE EXERCISES ARE NOT COPIED. A non-custom exercise in a blob is
--     matched by lower(name) to the shared global catalog and COLLAPSED into a
--     user_exercise_prefs row (in_my_list / custom_image_path). Its blob-local id
--     is remapped to the global catalog id everywhere it is referenced.
--   * DATE-KEYED MAPS ARE EXPANDED. foodLogs{date->[..]}, supplementLogs
--     {date->{id->true}}, and plan{dow->{..}} become rows.
--   * BASE64 IMAGES ARE STAGED, NOT UPLOADED. SQL cannot write to Storage. Every
--     exercises[].customImage base64 is recorded in migration_v2.image_uploads
--     with its target Storage path; an external uploader (see STEP I) pushes the
--     bytes and the prefs row already points at the path.
--   * IDEMPOTENT. Re-running inserts nothing twice (ON CONFLICT DO NOTHING /
--     stable ids). Safe to replay after a partial failure.
--   * REVERSIBLE. SECTION DOWN removes exactly what SECTION UP inserted, scoped
--     by ids re-derived from the blob, and never touches the global catalog,
--     vault_data, or auth.users.
--
-- PREREQUISITES (must be true BEFORE running SECTION UP):
--   1. backend/schema-v2.sql has been applied (the 16 tables + trigger exist).
--   2. The GLOBAL CATALOG is already seeded by the maintainer:
--        - public.exercises rows for every SEED_EXERCISES + MACHINE_SEED name,
--          owner_id IS NULL  (matched here by lower(name)).
--        - public.cardio_types built-ins 'treadmill','walking','running',
--          'cycling', owner_id IS NULL (referenced by cardio_logs.type).
--      If the catalog is empty, SECTION UP raises and aborts (see the guard in
--      STEP A) rather than silently duplicating 100+ rows into every user.
--   3. IDS ARE UUIDs. Every v2 PK is `uuid`, matching the client's
--      crypto.randomUUID() ids. js/storage.js uid() has a legacy non-UUID
--      fallback ('id-<base36>') used only when crypto.randomUUID is unavailable
--      (never in a secure/HTTPS/localhost context, which this PWA always runs
--      in). A non-UUID id cannot live in a uuid column: the ::uuid cast raises
--      'invalid input syntax for type uuid', and since SECTION UP is ONE
--      transaction the whole run rolls back with nothing written (safe, atomic).
--      Repair such blobs, then re-run.
--
-- RUN ORDER (deliberate — do NOT execute the whole file blindly; it contains
-- BOTH an UP and a DOWN):
--   1) SECTION UP        (this backfill)
--   2) STEP I uploader   (external Node script — pushes base64 images to Storage)
--   3) SECTION VERIFY    (row-count reconciliation; must be clean before cutover)
--   ...only if you must undo it...
--   X) SECTION DOWN      (rollback)
--
-- LOCK / TXN NOTES: the UP is a single transaction (all INSERTs into fresh/empty
-- tables; no CONCURRENTLY, no DDL on populated tables) so a failure rolls back
-- cleanly with nothing half-written. It only takes ACCESS SHARE on vault_data
-- (a plain read). lock_timeout is set short; statement_timeout is disabled for
-- the duration because a large backfill may legitimately run long.
-- ============================================================================


-- ############################################################################
-- ############################  SECTION UP  ##################################
-- ############################################################################
begin;

set local lock_timeout = '5s';       -- never queue forever behind another lock
set local statement_timeout = '0';   -- a full-tenant backfill may run long
set local idle_in_transaction_session_timeout = '60s';

-- ---- STEP 0. Staging schema (holds the id map + image manifest + run log) ---
-- Kept AFTER commit so the uploader (STEP I), VERIFY, and DOWN can use it.
create schema if not exists migration_v2;

-- Flattened copy of every blob's exercises[] (read-only extract of vault_data).
create table if not exists migration_v2.exercise_src (
  user_id      uuid   not null,
  local_id     uuid   not null,      -- the blob's crypto.randomUUID id
  name         text   not null,
  category     text,
  image_slug   text,
  machine_type text,
  is_custom    boolean not null default false,
  in_my_list   boolean not null default false,
  custom_image text,                 -- base64 / data-URL, or NULL
  created_at   timestamptz,
  primary key (user_id, local_id)
);

-- local blob exercise id  ->  canonical v2 exercise id (+ how it was resolved).
create table if not exists migration_v2.exercise_id_map (
  user_id      uuid not null,
  local_id     uuid not null,
  canonical_id uuid not null,
  resolution   text not null,        -- 'global-match' | 'custom' | 'custom-fallback'
  primary key (user_id, local_id)
);

-- Manifest of base64 images to push to Storage (STEP I). uploaded=false until done.
create table if not exists migration_v2.image_uploads (
  user_id      uuid not null,
  exercise_id  uuid not null,        -- canonical exercise id
  local_id     uuid not null,
  bucket       text not null default 'exercise-images',
  storage_path text not null,        -- '<user_id>/<exercise_id>.jpg'
  base64_data  text not null,        -- raw value from blob (may carry a data: prefix)
  uploaded     boolean not null default false,
  primary key (user_id, exercise_id)
);

create table if not exists migration_v2.run_log (
  step       text,
  detail     text,
  ran_at     timestamptz not null default now()
);

-- ---- STEP A. Extract exercises[] and resolve canonical ids ------------------
insert into migration_v2.exercise_src
  (user_id, local_id, name, category, image_slug, machine_type,
   is_custom, in_my_list, custom_image, created_at)
select v.user_id,
       (e->>'id')::uuid,
       e->>'name',
       coalesce(nullif(e->>'category',''),'Other'),
       nullif(e->>'imageSlug',''),
       nullif(e->>'machineType',''),
       coalesce((e->>'isCustom')::boolean, false),
       coalesce((e->>'inMyList')::boolean, false),
       nullif(e->>'customImage',''),
       coalesce((e->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'exercises') e
where jsonb_typeof(v.data->'exercises') = 'array'
  and (e->>'id') is not null
  and (e->>'name') is not null
on conflict (user_id, local_id) do nothing;

-- SAFETY GUARD: refuse to run if the global catalog was not seeded first —
-- otherwise every seed/machine exercise would fall back to a per-user custom
-- and we'd duplicate the whole catalog into each account.
do $$
declare n_global int;
begin
  select count(*) into n_global from public.exercises where owner_id is null;
  if n_global = 0 then
    raise exception
      'ABORT: global exercise catalog is empty (public.exercises WHERE owner_id IS NULL). '
      'Seed the catalog before running this backfill (see PREREQUISITES).';
  end if;
end $$;

-- Resolve each blob exercise to a canonical id:
--   non-custom + name found in global catalog -> the GLOBAL id (collapse)
--   custom                                    -> its own local id (kept)
--   non-custom + name NOT in catalog          -> its own local id, promoted to a
--                                                user-owned custom (LOSSLESS
--                                                fallback so referencing sessions/
--                                                plans keep a valid exercise_id).
-- Customs (and fallbacks) are de-duplicated per (user, lower(name)) so the
-- exercises_custom_name_key unique index cannot be violated; duplicates all
-- point at the earliest row's id.
with resolved as (
  select s.user_id, s.local_id, s.name, s.is_custom, s.created_at,
         g.id as global_id
  from migration_v2.exercise_src s
  left join public.exercises g
    on g.owner_id is null
   and g.deleted_at is null
   and lower(g.name) = lower(s.name)
),
custom_canon as (
  select user_id, local_id,
         first_value(local_id) over (
           partition by user_id, lower(name)
           order by created_at nulls last, local_id
         ) as canon_local
  from resolved
  where is_custom or global_id is null      -- rows that become customs
)
insert into migration_v2.exercise_id_map (user_id, local_id, canonical_id, resolution)
select r.user_id, r.local_id,
       case when (not r.is_custom) and r.global_id is not null
              then r.global_id
            else cc.canon_local
       end as canonical_id,
       case when (not r.is_custom) and r.global_id is not null then 'global-match'
            when r.is_custom                                    then 'custom'
            else                                                     'custom-fallback'
       end as resolution
from resolved r
left join custom_canon cc
  on cc.user_id = r.user_id and cc.local_id = r.local_id
on conflict (user_id, local_id) do nothing;

-- ---- STEP B. Insert per-user CUSTOM / fallback exercises --------------------
-- Global-match rows are NOT inserted (they already exist as catalog rows).
-- Only the canonical representative of each custom (local_id = canonical_id) is
-- written, so a de-duplicated name group produces exactly one row.
insert into public.exercises
  (id, owner_id, name, category, image_slug, machine_type, created_at)
select m.canonical_id, s.user_id, s.name,
       (case when s.category in
               ('Chest','Back','Legs','Shoulders','Arms','Core','Other')
             then s.category else 'Other' end)::exercise_category,
       s.image_slug, s.machine_type,
       coalesce(s.created_at, now())
from migration_v2.exercise_id_map m
join migration_v2.exercise_src s
  on s.user_id = m.user_id and s.local_id = m.canonical_id
where m.resolution in ('custom','custom-fallback')
  and m.local_id = m.canonical_id
on conflict (id) do nothing;

-- ---- STEP C. Stage base64 images + set custom_image_path -------------------
-- Path convention (schema-v2.sql Storage note): bucket 'exercise-images',
-- object key '<user_id>/<exercise_id>.jpg'. A custom photo may sit on a CUSTOM
-- exercise OR override a seed exercise; both are keyed by the canonical id, so
-- the path always begins with the owner's uid (per-user isolation preserved).
insert into migration_v2.image_uploads
  (user_id, exercise_id, local_id, storage_path, base64_data)
select m.user_id, m.canonical_id, m.local_id,
       m.user_id::text || '/' || m.canonical_id::text || '.jpg',
       s.custom_image
from migration_v2.exercise_id_map m
join migration_v2.exercise_src s
  on s.user_id = m.user_id and s.local_id = m.local_id
where s.custom_image is not null
on conflict (user_id, exercise_id) do nothing;

-- ---- STEP D. user_exercise_prefs (collapse in_my_list + custom image) -------
-- Only rows with NON-DEFAULT state get a prefs row (in_my_list = true OR a
-- custom image). Absence == default (not in list, no image), so the shared
-- catalog is never bloated with one row per user per exercise.
insert into public.user_exercise_prefs
  (user_id, exercise_id, in_my_list, custom_image_path)
select m.user_id, m.canonical_id,
       bool_or(s.in_my_list)              as in_my_list,
       max(iu.storage_path)               as custom_image_path
from migration_v2.exercise_id_map m
join migration_v2.exercise_src s
  on s.user_id = m.user_id and s.local_id = m.local_id
left join migration_v2.image_uploads iu
  on iu.user_id = m.user_id and iu.exercise_id = m.canonical_id
group by m.user_id, m.canonical_id
having bool_or(s.in_my_list) or max(iu.storage_path) is not null
on conflict (user_id, exercise_id) do update
  set in_my_list        = excluded.in_my_list or public.user_exercise_prefs.in_my_list,
      custom_image_path = coalesce(excluded.custom_image_path,
                                   public.user_exercise_prefs.custom_image_path);

-- ---- STEP E. workout_sessions + workout_sets -------------------------------
-- exerciseId is remapped through the id map. A session pointing at an exercise
-- absent from exercises[] (should not happen — exercises.remove() also removes
-- its sessions) is dropped by the join and surfaced in SECTION VERIFY.
insert into public.workout_sessions
  (id, user_id, exercise_id, performed_on, created_at)
select (ses->>'id')::uuid, v.user_id, m.canonical_id, (ses->>'date')::date,
       coalesce((ses->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'sessions') ses
     join migration_v2.exercise_id_map m
       on m.user_id = v.user_id
      and m.local_id = (ses->>'exerciseId')::uuid
where jsonb_typeof(v.data->'sessions') = 'array'
  and (ses->>'id') is not null
  and (ses->>'exerciseId') is not null
  and (ses->>'date') is not null
on conflict (id) do nothing;

-- Sets carry no id in the blob -> deterministic id = md5(session:set_index)::uuid.
-- set_index is 0-based array order. Idempotent (same key -> same id on replay).
insert into public.workout_sets
  (id, session_id, set_index, reps, weight)
select md5((ses->>'id') || ':' || (st.ord - 1)::text)::uuid,
       (ses->>'id')::uuid,
       (st.ord - 1)::smallint,
       round(coalesce((st.val->>'reps')::numeric, 0))::smallint,
       round(coalesce((st.val->>'weight')::numeric, 0), 2)
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'sessions') ses
     join migration_v2.exercise_id_map m
       on m.user_id = v.user_id and m.local_id = (ses->>'exerciseId')::uuid
     cross join lateral jsonb_array_elements(ses->'sets')
       with ordinality st(val, ord)
where jsonb_typeof(v.data->'sessions') = 'array'
  and jsonb_typeof(ses->'sets') = 'array'
  and (ses->>'id') is not null
  and (ses->>'exerciseId') is not null
on conflict (id) do nothing;

-- ---- STEP F. cardio_types (custom) + cardio_logs ---------------------------
-- Built-ins live in the global catalog (owner_id IS NULL, seeded). Here we add
-- only each user's custom 'custom-<uuid>' types.
insert into public.cardio_types
  (id, owner_id, label, icon_name, created_at)
select ct->>'id', v.user_id, ct->>'label',
       coalesce(nullif(ct->>'iconName',''),'heart'),
       coalesce((ct->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'cardioTypes') ct
where jsonb_typeof(v.data->'cardioTypes') = 'array'
  and (ct->>'id') is not null
  and (ct->>'label') is not null
on conflict (id) do nothing;

-- LOSSLESS RECOVERY OF ORPHANED CUSTOM TYPES.
-- js/storage.js cardioTypes.remove() deletes a custom type from cardioTypes[]
-- but does NOT delete the cardio[] logs that referenced it, so a blob can hold a
-- cardio log whose 'type' is a 'custom-<uuid>' that is no longer present in
-- cardioTypes[]. cardio_logs.cardio_type_id is ON DELETE RESTRICT, so such a log
-- cannot be inserted without a parent row. Rather than DROP those logs (silent
-- data loss) or ABORT the whole tenant backfill, re-materialize the missing
-- custom type as an owned row (label unknown post-deletion -> a placeholder). The
-- owner is the user whose blob references it ('custom-<uuid>' is per-user and
-- randomly minted, so it belongs to exactly one account in practice).
insert into public.cardio_types (id, owner_id, label, icon_name)
select q.type_id, min(q.user_id::text)::uuid, 'Custom Cardio', 'heart'
from (
  select c->>'type' as type_id, v.user_id
  from public.vault_data v
       cross join lateral jsonb_array_elements(v.data->'cardio') c
  where jsonb_typeof(v.data->'cardio') = 'array'
    and (c->>'type') like 'custom-%'
) q
where not exists (select 1 from public.cardio_types ct where ct.id = q.type_id)
group by q.type_id
on conflict (id) do nothing;

-- GUARD (narrowed): after re-materializing customs above, the only way a cardio
-- log can still reference a missing type is a BUILT-IN slug (treadmill/walking/
-- running/cycling) that was never seeded — a real prerequisite failure, not a
-- per-user data quirk. Abort clearly rather than dropping the logs to a bad FK.
do $$
declare missing text;
begin
  select string_agg(distinct t, ', ') into missing
  from (
    select c->>'type' as t
    from public.vault_data v
         cross join lateral jsonb_array_elements(v.data->'cardio') c
    where jsonb_typeof(v.data->'cardio') = 'array' and (c->>'type') is not null
  ) q
  where not exists (select 1 from public.cardio_types ct where ct.id = q.t);
  if missing is not null then
    raise exception
      'ABORT: cardio logs reference BUILT-IN cardio_types that are not seeded: %. '
      'Run backend/seed-v2.sql (built-in cardio types) before this backfill.', missing;
  end if;
end $$;

insert into public.cardio_logs
  (id, user_id, cardio_type_id, performed_on, duration_min, calories,
   source, hc_key, created_at)
select (c->>'id')::uuid, v.user_id, c->>'type', (c->>'date')::date,
       round(coalesce((c->>'duration')::numeric, 0))::int,
       round(coalesce((c->>'calories')::numeric, 0), 1),
       nullif(c->>'source',''), nullif(c->>'hcKey',''),
       coalesce((c->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'cardio') c
where jsonb_typeof(v.data->'cardio') = 'array'
  and (c->>'id') is not null
  and (c->>'type') is not null
  and (c->>'date') is not null
on conflict (id) do nothing;

-- ---- STEP G. foods + food_logs ---------------------------------------------
insert into public.foods
  (id, user_id, name, serving, calories, protein, carbs, created_at)
select (f->>'id')::uuid, v.user_id, f->>'name', nullif(f->>'serving',''),
       round(coalesce((f->>'calories')::numeric, 0), 1),
       round(coalesce((f->>'protein')::numeric, 0), 2),
       round(coalesce((f->>'carbs')::numeric, 0), 2),
       coalesce((f->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'foods') f
where jsonb_typeof(v.data->'foods') = 'array'
  and (f->>'id') is not null
  and (f->>'name') is not null
on conflict (id) do nothing;

-- foodLogs is a date-keyed map of arrays. food_id is nulled when it points at a
-- food that no longer exists (foods.remove() leaves logs behind) — the FK is a
-- hard constraint on INSERT, and the name snapshot preserves the label anyway.
-- servings <= 0 is coerced to 1 (matches the app's own `Number(x)||1`) to satisfy
-- the servings > 0 CHECK.
insert into public.food_logs
  (id, user_id, food_id, logged_on, name, servings,
   calories, protein, carbs, fat, source, logged_at)
select (fl->>'id')::uuid, v.user_id, fo.id, d.key::date, fl->>'name',
       (case when coalesce((fl->>'servings')::numeric, 1) <= 0
             then 1 else round((fl->>'servings')::numeric, 2) end),
       round(coalesce((fl->>'calories')::numeric, 0), 1),
       round(coalesce((fl->>'protein')::numeric, 0), 2),
       round(coalesce((fl->>'carbs')::numeric, 0), 2),
       round(coalesce((fl->>'fat')::numeric, 0), 2),
       nullif(fl->>'source',''),
       coalesce((fl->>'addedAt')::timestamptz, (d.key || 'T00:00:00')::timestamptz)
from public.vault_data v
     cross join lateral jsonb_each(v.data->'foodLogs') d
     cross join lateral jsonb_array_elements(d.value) fl
     left join public.foods fo
       on fo.id = nullif(fl->>'foodId','')::uuid
      and fo.user_id = v.user_id
where jsonb_typeof(v.data->'foodLogs') = 'object'
  and jsonb_typeof(d.value) = 'array'
  and (fl->>'id') is not null
  and (fl->>'name') is not null
on conflict (id) do nothing;

-- ---- STEP H. sleep_logs -----------------------------------------------------
insert into public.sleep_logs
  (id, user_id, slept_on, sleep_time, wake_time, duration_min,
   source, hc_key, created_at)
select (sl->>'id')::uuid, v.user_id, (sl->>'date')::date,
       nullif(sl->>'sleepTime','')::time,
       nullif(sl->>'wakeTime','')::time,
       round(coalesce((sl->>'durationMinutes')::numeric, 0))::int,
       nullif(sl->>'source',''), nullif(sl->>'hcKey',''),
       coalesce((sl->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'sleep') sl
where jsonb_typeof(v.data->'sleep') = 'array'
  and (sl->>'id') is not null
  and (sl->>'date') is not null
on conflict (id) do nothing;

-- ---- STEP J. plan_days + plan_day_exercises --------------------------------
-- plan is a map dow('0'..'6') -> null | { name, exerciseIds:[], notes? }.
insert into public.plan_days (user_id, day_of_week, name, notes)
select v.user_id, d.key::smallint,
       coalesce(nullif(d.value->>'name',''),'Workout'),
       nullif(d.value->>'notes','')
from public.vault_data v
     cross join lateral jsonb_each(v.data->'plan') d
where jsonb_typeof(v.data->'plan') = 'object'
  and jsonb_typeof(d.value) = 'object'      -- excludes JSON null (rest days)
on conflict (user_id, day_of_week) do nothing;

-- exerciseIds are remapped through the id map; position is the 0-based array
-- order. Row id is deterministic md5(user|dow|canonical_exercise) so a replay is
-- stable and a duplicate exercise in one day collapses to a single row.
insert into public.plan_day_exercises
  (id, user_id, day_of_week, exercise_id, position)
select md5(v.user_id::text || '|' || d.key || '|' || m.canonical_id::text)::uuid,
       v.user_id, d.key::smallint, m.canonical_id, (ex.ord - 1)::smallint
from public.vault_data v
     cross join lateral jsonb_each(v.data->'plan') d
     cross join lateral jsonb_array_elements_text(d.value->'exerciseIds')
       with ordinality ex(local_id, ord)
     join migration_v2.exercise_id_map m
       on m.user_id = v.user_id and m.local_id = ex.local_id::uuid
where jsonb_typeof(v.data->'plan') = 'object'
  and jsonb_typeof(d.value) = 'object'
  and jsonb_typeof(d.value->'exerciseIds') = 'array'
on conflict (id) do nothing;

-- ---- STEP K. supplements + supplement_logs ---------------------------------
insert into public.supplements
  (id, user_id, name, dose, color, created_at)
select (sp->>'id')::uuid, v.user_id, sp->>'name', nullif(sp->>'dose',''),
       coalesce(nullif(sp->>'color',''),'#22d3ee'),
       coalesce((sp->>'createdAt')::timestamptz, now())
from public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'supplements') sp
where jsonb_typeof(v.data->'supplements') = 'array'
  and (sp->>'id') is not null
  and (sp->>'name') is not null
on conflict (id) do nothing;

-- supplementLogs is date -> { supplementId: true }. Only true values are logged.
-- The join to supplements enforces both the FK and per-user ownership; a log
-- against a deleted supplement is dropped.
insert into public.supplement_logs (supplement_id, taken_on)
select (kv.key)::uuid, d.key::date
from public.vault_data v
     cross join lateral jsonb_each(v.data->'supplementLogs') d
     cross join lateral jsonb_each(d.value) kv
     join public.supplements s
       on s.id = (kv.key)::uuid and s.user_id = v.user_id
where jsonb_typeof(v.data->'supplementLogs') = 'object'
  and jsonb_typeof(d.value) = 'object'
  and kv.value = 'true'::jsonb
on conflict (supplement_id, taken_on) do nothing;

-- ---- STEP L. user_prefs + health_prefs -------------------------------------
insert into public.user_prefs (user_id, lang, theme, unit)
select v.user_id,
       (case when v.data->'prefs'->>'lang'  in ('en','ar')     then v.data->'prefs'->>'lang'  else 'en'   end)::lang_pref,
       (case when v.data->'prefs'->>'theme' in ('dark','light') then v.data->'prefs'->>'theme' else 'dark' end)::theme_pref,
       (case when v.data->'prefs'->>'unit'  in ('kg','lb')     then v.data->'prefs'->>'unit'  else 'kg'   end)::unit_pref
from public.vault_data v
where jsonb_typeof(v.data->'prefs') = 'object'
on conflict (user_id) do nothing;

insert into public.health_prefs (user_id, hidden)
select v.user_id,
       coalesce(array(select jsonb_array_elements_text(v.data->'health'->'hidden')), '{}')
from public.vault_data v
where jsonb_typeof(v.data->'health'->'hidden') = 'array'
on conflict (user_id) do nothing;

-- NOTE: public.profiles has NO source in the blob (no display_name / avatar), so
-- no profile rows are backfilled. They are created lazily by the app on first
-- profile edit. Intentionally omitted, not overlooked.

insert into migration_v2.run_log (step, detail)
values ('UP', 'blob -> v2 backfill completed in one transaction');

commit;

-- After COMMIT, the migration_v2 staging schema PERSISTS (needed by STEP I, the
-- VERIFY section, and DOWN). Drop it only after cutover is confirmed good.


-- ############################################################################
-- ####################  STEP I. BASE64 IMAGE UPLOAD  #########################
-- ############################################################################
-- SQL cannot write to Supabase Storage, so the base64 exercise photos are only
-- STAGED above (migration_v2.image_uploads). Run this EXTERNAL step after
-- SECTION UP and before cutover. It must run SERVER-SIDE with the SERVICE_ROLE
-- key (never the publishable key, never in client code).
--
-- Procedure (Node, @supabase/supabase-js):
--   1. Ensure a PRIVATE bucket 'exercise-images' exists (schema-v2.sql Storage
--      note) with the per-user folder RLS policies applied.
--   2. select user_id, exercise_id, storage_path, base64_data
--        from migration_v2.image_uploads where uploaded = false;
--   3. For each row: strip any 'data:image/...;base64,' prefix, Buffer.from(b64,
--      'base64'), then
--        supabaseAdmin.storage.from('exercise-images')
--          .upload(storage_path, buffer, { contentType: 'image/jpeg', upsert: true });
--   4. On success: update migration_v2.image_uploads set uploaded = true
--        where user_id = $1 and exercise_id = $2;
--   5. Re-run until zero rows remain with uploaded = false.
--
-- user_exercise_prefs.custom_image_path already points at storage_path, so once
-- the object exists the app resolves it via a short-lived signed URL. Until the
-- upload completes those images 404 — hence uploads MUST finish before cutover
-- (VERIFY below fails while any remain).


-- ############################################################################
-- ##########################  SECTION VERIFY  ################################
-- ############################################################################
-- Read-only reconciliation. Run after SECTION UP + STEP I. Every check must pass
-- before vault_data is retired / the app is cut over to the v2 tables.

-- (1) Per-table: blob count vs inserted count. Expect blob_count = v2_count for
--     the log tables (sessions/cardio/foods/food_logs/sleep/supplements). Small
--     shortfalls indicate dropped orphans — investigate with checks (3)-(6).
-- select 'workout_sessions' as tbl,
--        (select count(*) from public.vault_data v
--           cross join lateral jsonb_array_elements(v.data->'sessions')
--          where jsonb_typeof(v.data->'sessions')='array')            as blob_count,
--        (select count(*) from public.workout_sessions)               as v2_count
-- union all select 'cardio_logs',
--        (select count(*) from public.vault_data v
--           cross join lateral jsonb_array_elements(v.data->'cardio')
--          where jsonb_typeof(v.data->'cardio')='array'),
--        (select count(*) from public.cardio_logs)
-- union all select 'foods',
--        (select count(*) from public.vault_data v
--           cross join lateral jsonb_array_elements(v.data->'foods')
--          where jsonb_typeof(v.data->'foods')='array'),
--        (select count(*) from public.foods)
-- union all select 'sleep_logs',
--        (select count(*) from public.vault_data v
--           cross join lateral jsonb_array_elements(v.data->'sleep')
--          where jsonb_typeof(v.data->'sleep')='array'),
--        (select count(*) from public.sleep_logs)
-- union all select 'supplements',
--        (select count(*) from public.vault_data v
--           cross join lateral jsonb_array_elements(v.data->'supplements')
--          where jsonb_typeof(v.data->'supplements')='array'),
--        (select count(*) from public.supplements);

-- (2) Exercise resolution breakdown (how many collapsed vs kept as custom):
-- select resolution, count(*) from migration_v2.exercise_id_map group by resolution;

-- (3) Sessions whose exerciseId was NOT present in exercises[] (dropped orphans):
-- select v.user_id, ses->>'id' as session_id, ses->>'exerciseId' as missing_exercise
-- from public.vault_data v cross join lateral jsonb_array_elements(v.data->'sessions') ses
-- left join migration_v2.exercise_id_map m
--   on m.user_id = v.user_id and m.local_id = (ses->>'exerciseId')::uuid
-- where jsonb_typeof(v.data->'sessions')='array' and m.local_id is null;

-- (4) food_logs whose foodId was nulled (referenced a deleted food):
-- select count(*) as nulled_food_refs
-- from public.vault_data v
--   cross join lateral jsonb_each(v.data->'foodLogs') d
--   cross join lateral jsonb_array_elements(d.value) fl
-- where jsonb_typeof(v.data->'foodLogs')='object' and jsonb_typeof(d.value)='array'
--   and nullif(fl->>'foodId','') is not null
--   and not exists (select 1 from public.foods fo
--                    where fo.id = (fl->>'foodId')::uuid and fo.user_id = v.user_id);

-- (5) Pending image uploads (MUST be 0 before cutover):
-- select count(*) as pending_uploads from migration_v2.image_uploads where uploaded = false;

-- (6) Spot-check a single user end to end (swap in a real uuid):
-- select 'sessions' k, count(*) from public.workout_sessions where user_id = '<uid>'
-- union all select 'sets', count(*) from public.workout_sets s
--   join public.workout_sessions ws on ws.id = s.session_id where ws.user_id = '<uid>'
-- union all select 'custom_exercises', count(*) from public.exercises where owner_id = '<uid>'
-- union all select 'prefs', count(*) from public.user_exercise_prefs where user_id = '<uid>';


-- ############################################################################
-- ###########################  SECTION DOWN  #################################
-- ############################################################################
--                  *** ROLLBACK — run DELIBERATELY, alone ***
--
-- Removes exactly what SECTION UP inserted. Rows are scoped by ids RE-DERIVED
-- from the blob (and by the staging id map), so:
--   * the global catalog (exercises/cardio_types WHERE owner_id IS NULL) is
--     NEVER touched;
--   * public.vault_data and auth.users are NEVER touched;
--   * any row the live app created AFTER cutover with a fresh random id is not
--     matched and is left alone.
--
-- REVERSIBILITY CAVEAT (state it out loud): ids are REUSED from the blob, so a
-- backfilled row that a user EDITED live after cutover shares its id with the
-- blob and WOULD be removed by this DOWN. Therefore DOWN is only safe to run
-- PRE-CUTOVER, while the v2 tables still hold only backfilled data. After
-- cutover, roll back by restoring the verified backup instead.
--
-- Children are deleted before parents to respect FKs.
/*  -- uncomment to execute
begin;
set local lock_timeout = '5s';

-- workout_sets -> via their backfilled parent sessions
delete from public.workout_sets s
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'sessions') ses
where jsonb_typeof(v.data->'sessions')='array'
  and s.session_id = (ses->>'id')::uuid;

delete from public.workout_sessions ws
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'sessions') ses
where jsonb_typeof(v.data->'sessions')='array'
  and ws.id = (ses->>'id')::uuid;

delete from public.cardio_logs cl
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'cardio') c
where jsonb_typeof(v.data->'cardio')='array'
  and cl.id = (c->>'id')::uuid;

-- custom cardio types only (owner_id IS NOT NULL); never a built-in.
-- (a) the ones declared in cardioTypes[] ...
delete from public.cardio_types ct
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'cardioTypes') j
where jsonb_typeof(v.data->'cardioTypes')='array'
  and ct.owner_id is not null
  and ct.id = j->>'id';
-- (b) ... and the orphaned 'custom-<uuid>' types STEP F re-materialized from a
-- cardio log whose declaring type had been deleted from cardioTypes[].
delete from public.cardio_types ct
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'cardio') c
where jsonb_typeof(v.data->'cardio')='array'
  and ct.owner_id is not null
  and (c->>'type') like 'custom-%'
  and ct.id = c->>'type';

delete from public.food_logs fl
using public.vault_data v
     cross join lateral jsonb_each(v.data->'foodLogs') d
     cross join lateral jsonb_array_elements(d.value) j
where jsonb_typeof(v.data->'foodLogs')='object'
  and jsonb_typeof(d.value)='array'
  and fl.id = (j->>'id')::uuid;

delete from public.foods f
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'foods') j
where jsonb_typeof(v.data->'foods')='array'
  and f.id = (j->>'id')::uuid;

delete from public.sleep_logs sl
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'sleep') j
where jsonb_typeof(v.data->'sleep')='array'
  and sl.id = (j->>'id')::uuid;

-- supplement_logs -> via their backfilled parent supplements
delete from public.supplement_logs sll
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'supplements') j
where jsonb_typeof(v.data->'supplements')='array'
  and sll.supplement_id = (j->>'id')::uuid;

delete from public.supplements sp
using public.vault_data v
     cross join lateral jsonb_array_elements(v.data->'supplements') j
where jsonb_typeof(v.data->'supplements')='array'
  and sp.id = (j->>'id')::uuid;

-- plan_day_exercises: same deterministic ids as the UP
delete from public.plan_day_exercises pde
using public.vault_data v
     cross join lateral jsonb_each(v.data->'plan') d
     cross join lateral jsonb_array_elements_text(d.value->'exerciseIds')
       with ordinality ex(local_id, ord)
     join migration_v2.exercise_id_map m
       on m.user_id = v.user_id and m.local_id = ex.local_id::uuid
where jsonb_typeof(v.data->'plan')='object'
  and jsonb_typeof(d.value)='object'
  and jsonb_typeof(d.value->'exerciseIds')='array'
  and pde.id = md5(v.user_id::text || '|' || d.key || '|' || m.canonical_id::text)::uuid;

delete from public.plan_days pd
using public.vault_data v
     cross join lateral jsonb_each(v.data->'plan') d
where jsonb_typeof(v.data->'plan')='object'
  and jsonb_typeof(d.value)='object'
  and pd.user_id = v.user_id
  and pd.day_of_week = d.key::smallint;

-- user_exercise_prefs: everything we created came from the id map
delete from public.user_exercise_prefs uxp
using migration_v2.exercise_id_map m
where uxp.user_id = m.user_id and uxp.exercise_id = m.canonical_id;

-- custom / fallback exercises only (owner_id IS NOT NULL); never the catalog
delete from public.exercises e
using migration_v2.exercise_id_map m
where e.owner_id is not null
  and e.id = m.canonical_id
  and m.resolution in ('custom','custom-fallback');

delete from public.user_prefs up
using public.vault_data v
where up.user_id = v.user_id
  and jsonb_typeof(v.data->'prefs') = 'object';

delete from public.health_prefs hp
using public.vault_data v
where hp.user_id = v.user_id
  and jsonb_typeof(v.data->'health'->'hidden') = 'array';

commit;

-- After the DB rollback:
--   * Delete the uploaded Storage objects too (SQL can't): for each
--     migration_v2.image_uploads row, supabaseAdmin.storage
--       .from('exercise-images').remove([storage_path]);  (server-side).
--   * Then drop the staging schema:  drop schema if exists migration_v2 cascade;
*/
-- ============================================================================
-- END — DRAFT, NOT YET APPLIED
-- ============================================================================
