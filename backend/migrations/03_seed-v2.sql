-- ============================================================================
-- THE VAULT — seed-v2.sql : GLOBAL CATALOG reference seed
-- ============================================================================
-- KIND: REFERENCE SEED. These are the built-in, application-owned catalog rows
-- the app cannot boot without: the ~73 stock exercises/machines every user
-- browses, and the 4 built-in cardio types. They are IDENTICAL for every user,
-- carry owner_id = NULL (= global), and are meant to ship to EVERY environment
-- INCLUDING PRODUCTION. Being a reference seed, it therefore has NO dev/prod
-- environment guard (guards belong on dev/test seeds only) and contains NO user
-- data and NO PII of any kind.
--
-- Companion to backend/schema-v2.sql — run AFTER that file has created the
-- tables. Additive only: touches nothing but public.exercises and
-- public.cardio_types, and only the global (owner_id IS NULL) rows it owns. It
-- never deletes, never truncates, never touches a user's custom rows.
--
-- ----------------------------------------------------------------------------
-- IDEMPOTENCY STRATEGY (re-runnable; running twice == running once)
-- ----------------------------------------------------------------------------
-- exercises  -> keyed on the schema's natural stable key: the partial unique
--               index exercises_global_name_key ON (lower(name))
--               WHERE owner_id IS NULL AND deleted_at IS NULL.
--               `ON CONFLICT (lower(name)) WHERE owner_id IS NULL AND
--                deleted_at IS NULL DO NOTHING` makes a re-run a no-op per row.
-- cardio_types -> keyed on its text PRIMARY KEY (id = 'treadmill' ...), which
--                 IS the natural slug. `ON CONFLICT (id) DO NOTHING`.
--
-- The conflict arbiter is ALWAYS a natural key (name / slug), NEVER a random id.
-- The primary-key `id` supplied for each exercise is DETERMINISTIC, derived from
-- the stable name via md5('vault:exercise:'||lower(name))::uuid — so the same
-- catalog row gets the same UUID in every environment and on every re-run. It is
-- never gen_random_uuid()/crypto.randomUUID(); nothing here depends on insertion
-- order. (md5 is core Postgres — no extension needed.)
--
-- DO NOTHING (not DO UPDATE) is deliberate: this seed only ever INTRODUCES a
-- missing global row. It never overwrites an edit an admin/service_role made to
-- an existing catalog row. RENAME SAFETY: a rename of a shipped catalog row is a
-- data migration (map the old name forward under data-migration-guardian), NOT a
-- re-seed — because the natural key here is the name, blindly re-running after a
-- rename would re-introduce the old name. So renames are migrated, not seeded.
-- ============================================================================

begin;

-- ---- 1. GLOBAL EXERCISES: free-weight + bodyweight (owner_id NULL) ----------
-- Source: js/storage.js SEED_EXERCISES (machine_type is NULL for these).
insert into public.exercises (id, owner_id, name, category, image_slug, machine_type)
select md5('vault:exercise:' || lower(v.name))::uuid,
       null,
       v.name,
       v.category::exercise_category,
       v.image_slug,
       null
from (values
  ('Squat',                 'Legs',      'Barbell_Squat'),
  ('Bench Press',           'Chest',     'Barbell_Bench_Press_-_Medium_Grip'),
  ('Deadlift',              'Back',      'Barbell_Deadlift'),
  ('Incline Bench Press',   'Chest',     'Barbell_Incline_Bench_Press_-_Medium_Grip'),
  ('Dumbbell Press',        'Chest',     'Dumbbell_Bench_Press'),
  ('Dumbbell Fly',          'Chest',     'Dumbbell_Flyes'),
  ('Push Up',               'Chest',     'Pushups'),
  ('Barbell Row',           'Back',      'Bent_Over_Barbell_Row'),
  ('Pull Up',               'Back',      'Pullups'),
  ('Dumbbell Row',          'Back',      'One-Arm_Dumbbell_Row'),
  ('Front Squat',           'Legs',      'Front_Barbell_Squat'),
  ('Romanian Deadlift',     'Legs',      'Romanian_Deadlift'),
  ('Lunges',                'Legs',      'Dumbbell_Lunges'),
  ('Calf Raise',            'Legs',      'Standing_Barbell_Calf_Raise'),
  ('Overhead Press',        'Shoulders', 'Standing_Military_Press'),
  ('Lateral Raise',         'Shoulders', 'Side_Lateral_Raise'),
  ('Front Raise',           'Shoulders', 'Front_Dumbbell_Raise'),
  ('Rear Delt Fly',         'Shoulders', 'Bent_Over_Low-Pulley_Side_Lateral'),
  ('Shrugs',                'Shoulders', 'Barbell_Shrug'),
  ('Barbell Curl',          'Arms',      'Barbell_Curl'),
  ('EZ Bar Curl',           'Arms',      'EZ-Bar_Curl'),
  ('Dumbbell Curl',         'Arms',      'Dumbbell_Bicep_Curl'),
  ('Incline Dumbbell Curl', 'Arms',      'Incline_Dumbbell_Curl'),
  ('Hammer Curl',           'Arms',      'Hammer_Curls'),
  ('Concentration Curl',    'Arms',      'Concentration_Curls'),
  ('Spider Curl',           'Arms',      'Spider_Curl'),
  ('Reverse Curl',          'Arms',      'Reverse_Barbell_Curl'),
  ('Chin-Up',               'Arms',      'Chin-Up'),
  ('Tricep Pushdown',       'Arms',      'Triceps_Pushdown'),
  ('Tricep Extension',      'Arms',      'Standing_Dumbbell_Triceps_Extension'),
  ('Dips',                  'Arms',      'Dips_-_Triceps_Version'),
  ('Plank',                 'Core',      'Plank'),
  ('Crunches',              'Core',      'Crunches'),
  ('Leg Raise',             'Core',      'Hanging_Leg_Raise'),
  ('Russian Twist',         'Core',      'Russian_Twist')
) as v(name, category, image_slug)
on conflict (lower(name)) where owner_id is null and deleted_at is null
do nothing;

-- ---- 2. GLOBAL EXERCISES: machines (owner_id NULL, machine_type set) --------
-- Source: js/storage.js MACHINE_SEED. machine_type is the client SVG blueprint
-- key (js/storage.js machineSvgFor); image_slug is the free-exercise-db photo.
insert into public.exercises (id, owner_id, name, category, image_slug, machine_type)
select md5('vault:exercise:' || lower(v.name))::uuid,
       null,
       v.name,
       v.category::exercise_category,
       v.image_slug,
       v.machine_type
from (values
  -- Chest
  ('Chest Press Machine',          'Chest',     'chest_press',         'Leverage_Chest_Press'),
  ('Incline Chest Press Machine',  'Chest',     'incline_chest_press', 'Leverage_Incline_Chest_Press'),
  ('Pec Deck Machine',             'Chest',     'pec_deck',            'Butterfly'),
  ('Cable Crossover',              'Chest',     'cable_crossover',     'Cable_Crossover'),
  ('Smith Machine Bench Press',    'Chest',     'smith_machine',       'Smith_Machine_Bench_Press'),
  -- Shoulders
  ('Shoulder Press Machine',       'Shoulders', 'shoulder_press',      'Seated_Cable_Shoulder_Press'),
  ('Smith Machine Shoulder Press', 'Shoulders', 'smith_machine',       'Smith_Machine_Overhead_Shoulder_Press'),
  ('Lateral Raise Machine',        'Shoulders', 'lateral_raise',       'Side_Lateral_Raise'),
  ('Cable Lateral Raise',          'Shoulders', 'cable_tower',         'Side_Lateral_Raise'),
  ('Rear Delt Fly Machine',        'Shoulders', 'rear_delt_fly',       'Reverse_Machine_Flyes'),
  ('Face Pull',                    'Shoulders', 'cable_tower',         'Face_Pull'),
  ('Cable Upright Row',            'Shoulders', 'cable_tower',         'Upright_Cable_Row'),
  ('Cable Shrug',                  'Shoulders', 'cable_tower',         'Cable_Shrugs'),
  -- Back
  ('Lat Pulldown Machine',         'Back',      'lat_pulldown',        'Wide-Grip_Lat_Pulldown'),
  ('Seated Row Machine',           'Back',      'seated_row',          'Seated_Cable_Rows'),
  ('T-Bar Row Machine',            'Back',      't_bar_row',           'T-Bar_Row_with_Handle'),
  ('Iso-Lateral Row',              'Back',      't_bar_row',           'Leverage_Iso_Row'),
  ('Assisted Pull-Up Machine',     'Back',      'assisted_pullup',     'Machine_Assisted_Chin-Up'),
  ('Back Extension',               'Back',      'back_extension',      'Hyperextensions_With_No_Hyperextension_Bench'),
  -- Legs
  ('Leg Press Machine',            'Legs',      'leg_press',           'Leg_Press'),
  ('Hack Squat Machine',           'Legs',      'hack_squat',          'Hack_Squat'),
  ('Smith Machine Squat',          'Legs',      'smith_machine',       'Smith_Machine_Squat'),
  ('Leg Extension Machine',        'Legs',      'leg_extension',       'Leg_Extensions'),
  ('Leg Curl Machine',             'Legs',      'leg_curl',            'Lying_Leg_Curls'),
  ('Seated Leg Curl',              'Legs',      'leg_curl',            'Seated_Leg_Curl'),
  ('Hip Abductor Machine',         'Legs',      'hip_abductor',        'Thigh_Abductor'),
  ('Hip Adductor Machine',         'Legs',      'hip_adductor',        'Thigh_Adductor'),
  ('Hip Thrust Machine',           'Legs',      'hip_thrust',          'Barbell_Hip_Thrust'),
  ('Calf Raise Machine',           'Legs',      'standing_calf',       'Standing_Calf_Raises'),
  ('Seated Calf Raise',            'Legs',      'seated_calf',         'Seated_Calf_Raise'),
  -- Arms
  ('Preacher Curl Machine',        'Arms',      'preacher_curl',       'Preacher_Curl'),
  ('Cable Curl',                   'Arms',      'cable_tower',         'Standing_Biceps_Cable_Curl'),
  ('Triceps Dip Machine',          'Arms',      'triceps_dip',         'Dips_-_Triceps_Version'),
  ('Assisted Dip Machine',         'Arms',      'assisted_pullup',     'Dips_-_Triceps_Version'),
  ('Cable Triceps Pushdown',       'Arms',      'cable_tower',         'Triceps_Pushdown'),
  ('Overhead Cable Triceps',       'Arms',      'cable_tower',         'Cable_Rope_Overhead_Triceps_Extension'),
  -- Core
  ('Ab Crunch Machine',            'Core',      'ab_crunch',           'Ab_Crunch_Machine'),
  ('Cable Crunch',                 'Core',      'cable_tower',         'Cable_Crunch')
) as v(name, category, machine_type, image_slug)
on conflict (lower(name)) where owner_id is null and deleted_at is null
do nothing;

-- ---- 3. BUILT-IN CARDIO TYPES (owner_id NULL) ------------------------------
-- Source: js/storage.js CARDIO_TYPES. The text id IS the stable natural key and
-- the PRIMARY KEY, so ON CONFLICT (id) DO NOTHING is the idempotency arbiter.
insert into public.cardio_types (id, owner_id, label, icon_name)
select v.id, null, v.label, v.icon_name
from (values
  ('treadmill', 'Treadmill', 'treadmill'),
  ('walking',   'Walking',   'walk'),
  ('running',   'Running',   'run'),
  ('cycling',   'Cycling',   'bike')
) as v(id, label, icon_name)
on conflict (id) do nothing;

commit;

-- ============================================================================
-- IDEMPOTENCY VERIFICATION (run these counts; apply the file a 2nd time; the
-- three counts must be byte-for-byte identical — that is the proof of re-run
-- safety). Expected: 73 global exercises (35 free/bodyweight + 38 machines),
-- and 4 built-in cardio types.
-- ============================================================================
--   select count(*) as global_exercises          -- expect 73
--     from public.exercises
--    where owner_id is null and deleted_at is null;
--   select count(*) as global_machines            -- expect 38
--     from public.exercises
--    where owner_id is null and deleted_at is null and machine_type is not null;
--   select count(*) as builtin_cardio_types       -- expect 4
--     from public.cardio_types
--    where owner_id is null and deleted_at is null;
-- ============================================================================
