-- ============================================================================
-- THE VAULT — roadmap layer: content management + preset plans + audit + config
-- (ADDITIVE, idempotent). Run in the Supabase SQL editor. Builds on
-- admin-v2.sql (admins + is_admin) and admin-write-v3.sql (user_flags/feedback).
--   1. audit_log     — every admin write is recorded (admin-read only).
--   2. app_config    — one global config row the APP reads on boot (public read).
--   3. food_catalog  — global foods the admin curates; the app merges them in.
--   4. preset_plans  — ready-made plans (jsonb) the app lets users browse+adopt.
--   5. Admin RPCs (SECURITY DEFINER, is_admin-gated, audited) to CRUD global
--      exercises / cardio types / foods / presets / config. Catalog writes go
--      ONLY through these — the base RLS still forbids clients writing globals.
-- Safe to re-run. No existing data touched.
-- ============================================================================

-- ---- 1. Audit log -----------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  target     uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon, authenticated, public;
grant select on public.audit_log to authenticated;

-- Internal logger: SECURITY DEFINER so the admin RPCs can insert past the
-- no-insert policy. NOT granted to clients — only called from other definer fns.
create or replace function public.audit(a_action text, a_target uuid, a_detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log(actor, action, target, detail)
  values (auth.uid(), a_action, a_target, a_detail);
$$;
revoke all on function public.audit(text, uuid, jsonb) from public, anon, authenticated;

-- ---- 2. Global app config (single row, public-readable) ---------------------
create table if not exists public.app_config (
  id                 int primary key default 1 check (id = 1),
  default_unit       text not null default 'kg' check (default_unit in ('kg','lb')),
  announcement_ar    text,
  announcement_en    text,
  announcement_active boolean not null default false,
  updated_at         timestamptz not null default now()
);
insert into public.app_config(id) values (1) on conflict do nothing;
alter table public.app_config enable row level security;
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select to anon, authenticated using (true);   -- config is public, non-sensitive
revoke all on public.app_config from anon, authenticated, public;
grant select on public.app_config to anon, authenticated;

create or replace function public.admin_set_config(p_unit text, p_ar text, p_en text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_unit not in ('kg','lb') then raise exception 'invalid unit'; end if;
  update public.app_config
     set default_unit = p_unit, announcement_ar = p_ar, announcement_en = p_en,
         announcement_active = coalesce(p_active,false), updated_at = now()
   where id = 1;
  perform public.audit('config.update', null, jsonb_build_object('unit',p_unit,'active',p_active));
end; $$;
revoke all on function public.admin_set_config(text, text, text, boolean) from public, anon;
grant execute on function public.admin_set_config(text, text, text, boolean) to authenticated;

-- ---- 3. Global food catalog (admin-curated, public-readable) ----------------
create table if not exists public.food_catalog (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  serving    text,
  calories   numeric(7,1) not null default 0,
  protein    numeric(7,2) not null default 0,
  carbs      numeric(7,2) not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.food_catalog enable row level security;
drop policy if exists food_catalog_read on public.food_catalog;
create policy food_catalog_read on public.food_catalog
  for select to anon, authenticated using (deleted_at is null);
revoke all on public.food_catalog from anon, authenticated, public;
grant select on public.food_catalog to anon, authenticated;

create or replace function public.admin_upsert_food(p_id uuid, p_name text, p_serving text, p_cal numeric, p_pro numeric, p_carb numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  if p_id is null then
    insert into public.food_catalog(name, serving, calories, protein, carbs)
    values (p_name, p_serving, coalesce(p_cal,0), coalesce(p_pro,0), coalesce(p_carb,0))
    returning id into v_id;
  else
    update public.food_catalog set name=p_name, serving=p_serving, calories=coalesce(p_cal,0),
      protein=coalesce(p_pro,0), carbs=coalesce(p_carb,0), deleted_at=null where id=p_id;
    v_id := p_id;
  end if;
  perform public.audit('food.upsert', null, jsonb_build_object('id',v_id,'name',p_name));
  return v_id;
end; $$;
revoke all on function public.admin_upsert_food(uuid, text, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_upsert_food(uuid, text, text, numeric, numeric, numeric) to authenticated;

create or replace function public.admin_delete_food(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.food_catalog set deleted_at = now() where id = p_id;
  perform public.audit('food.delete', null, jsonb_build_object('id',p_id));
end; $$;
revoke all on function public.admin_delete_food(uuid) from public, anon;
grant execute on function public.admin_delete_food(uuid) to authenticated;

-- ---- 4. Preset plans (ready-made, jsonb; public-readable) -------------------
-- data shape: { "days": [ { "name": "Push", "exercises": ["Bench Press", ...] }, ... ] }
create table if not exists public.preset_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  data        jsonb not null default '{"days":[]}',
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
alter table public.preset_plans enable row level security;
drop policy if exists preset_plans_read on public.preset_plans;
create policy preset_plans_read on public.preset_plans
  for select to anon, authenticated using (deleted_at is null);
revoke all on public.preset_plans from anon, authenticated, public;
grant select on public.preset_plans to anon, authenticated;

create or replace function public.admin_upsert_preset(p_id uuid, p_name text, p_desc text, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  if p_id is null then
    insert into public.preset_plans(name, description, data)
    values (p_name, p_desc, coalesce(p_data,'{"days":[]}'::jsonb)) returning id into v_id;
  else
    update public.preset_plans set name=p_name, description=p_desc,
      data=coalesce(p_data,'{"days":[]}'::jsonb), deleted_at=null where id=p_id;
    v_id := p_id;
  end if;
  perform public.audit('preset.upsert', null, jsonb_build_object('id',v_id,'name',p_name));
  return v_id;
end; $$;
revoke all on function public.admin_upsert_preset(uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_upsert_preset(uuid, text, text, jsonb) to authenticated;

create or replace function public.admin_delete_preset(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.preset_plans set deleted_at = now() where id = p_id;
  perform public.audit('preset.delete', null, jsonb_build_object('id',p_id));
end; $$;
revoke all on function public.admin_delete_preset(uuid) from public, anon;
grant execute on function public.admin_delete_preset(uuid) to authenticated;

-- ---- 5. Global EXERCISE + CARDIO catalog admin RPCs ------------------------
-- Writes owner_id-NULL globals, which base RLS forbids to clients — allowed here
-- only because the function is SECURITY DEFINER (runs as owner) and is_admin-gated.
create or replace function public.admin_upsert_exercise(p_id uuid, p_name text, p_category text, p_image_slug text, p_machine_type text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  if p_category not in ('Chest','Back','Legs','Shoulders','Arms','Core','Other') then
    raise exception 'invalid category';
  end if;
  -- exercises.id has no default → generate it on create (mirrors admin_upsert_cardio);
  -- on-conflict handles edits, and only ever touches globals (never a user's custom).
  v_id := coalesce(p_id, gen_random_uuid());
  insert into public.exercises(id, owner_id, name, category, image_slug, machine_type)
  values (v_id, null, p_name, p_category::public.exercise_category, p_image_slug, p_machine_type)
  on conflict (id) do update
    set name=excluded.name, category=excluded.category,
        image_slug=excluded.image_slug, machine_type=excluded.machine_type, deleted_at=null
    where public.exercises.owner_id is null;   -- globals only
  perform public.audit('exercise.upsert', null, jsonb_build_object('id',v_id,'name',p_name,'category',p_category));
  return v_id;
end; $$;
revoke all on function public.admin_upsert_exercise(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_upsert_exercise(uuid, text, text, text, text) to authenticated;

create or replace function public.admin_delete_exercise(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  -- soft delete (workout_sessions references exercises ON DELETE RESTRICT)
  update public.exercises set deleted_at = now() where id = p_id and owner_id is null;
  perform public.audit('exercise.delete', null, jsonb_build_object('id',p_id));
end; $$;
revoke all on function public.admin_delete_exercise(uuid) from public, anon;
grant execute on function public.admin_delete_exercise(uuid) to authenticated;

create or replace function public.admin_upsert_cardio(p_id text, p_label text, p_icon text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_label),'') = '' then raise exception 'label required'; end if;
  v_id := coalesce(nullif(trim(p_id),''), 'cat-' || replace(gen_random_uuid()::text,'-',''));
  insert into public.cardio_types(id, owner_id, label, icon_name)
  values (v_id, null, p_label, coalesce(nullif(trim(p_icon),''),'heart'))
  on conflict (id) do update set label=excluded.label, icon_name=excluded.icon_name, deleted_at=null
    where public.cardio_types.owner_id is null;
  perform public.audit('cardio.upsert', null, jsonb_build_object('id',v_id,'label',p_label));
  return v_id;
end; $$;
revoke all on function public.admin_upsert_cardio(text, text, text) from public, anon;
grant execute on function public.admin_upsert_cardio(text, text, text) to authenticated;

-- ---- 6. Record role/status changes in the audit log too ---------------------
-- Re-define the v3 RPCs to append an audit row (bodies otherwise unchanged).
create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if target = auth.uid() then raise exception 'cannot change your own role'; end if;
  if target = 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2'::uuid then raise exception 'the owner account is protected'; end if;
  if new_role not in ('user','coach','admin') then raise exception 'invalid role'; end if;
  insert into public.user_flags (user_id, role, updated_by) values (target, new_role, auth.uid())
    on conflict (user_id) do update set role = excluded.role, updated_by = excluded.updated_by;
  if new_role = 'admin' then insert into public.admins (user_id) values (target) on conflict do nothing;
  else delete from public.admins where user_id = target; end if;
  perform public.audit('role.set', target, jsonb_build_object('role',new_role));
end; $$;

create or replace function public.admin_set_status(target uuid, new_status text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if target = auth.uid() then raise exception 'cannot change your own status'; end if;
  if target = 'e0fd050a-b7c0-4f0a-b2a6-b733a8e329f2'::uuid then raise exception 'the owner account is protected'; end if;
  if new_status not in ('active','disabled','banned') then raise exception 'invalid status'; end if;
  insert into public.user_flags (user_id, status, reason, updated_by) values (target, new_status, reason, auth.uid())
    on conflict (user_id) do update set status = excluded.status, reason = excluded.reason, updated_by = excluded.updated_by;
  perform public.audit('status.set', target, jsonb_build_object('status',new_status,'reason',reason));
end; $$;

-- Re-issue grants for self-containment (CREATE OR REPLACE keeps the old ACL, but
-- don't depend on v3 having run first for the defense-in-depth to hold).
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
revoke all on function public.admin_set_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text, text) to authenticated;

-- ---- verify (optional) ------------------------------------------------------
-- select count(*) from public.food_catalog; select count(*) from public.preset_plans;
-- select count(*) from public.app_config;   select count(*) from public.audit_log;
-- select proname from pg_proc where proname like 'admin_%' order by 1;
