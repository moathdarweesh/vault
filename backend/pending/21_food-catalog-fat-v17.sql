-- ============================================================================
-- 21_food-catalog-fat-v17.sql — the curated food catalog learns about fat
--
-- WHY: food_catalog (07_admin-write-v4.sql) has calories/protein/carbs and no
-- fat column, admin_upsert_food takes no fat, and the app's mapper therefore
-- had nothing to read — so every catalog food a user saved logged 0 g fat,
-- forever, and the fat ring under-counted with no sign anything was off. The
-- built-in presets carry `f`; the server path could not, by schema.
--
-- SHAPE: additive. The old 6-argument admin_upsert_food stays (the Console
-- falls back to it when this migration is not yet applied); a 7-argument
-- overload with p_fat is added. Existing rows default to 0, which is what
-- they were logging anyway — the owner can fill them in from the Console.
-- ============================================================================

alter table public.food_catalog
  add column if not exists fat numeric(7,2) not null default 0;

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
  if not public.is_admin() then raise exception 'admin only'; end if;
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
  return rid;
end;
$$;
revoke all on function public.admin_upsert_food(uuid, text, text, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_upsert_food(uuid, text, text, numeric, numeric, numeric, numeric) to authenticated;

-- ---- verify -----------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'food_catalog' and column_name = 'fat';        -- 1 row
-- select proname, pronargs from pg_proc where proname = 'admin_upsert_food'; -- 6 and 7
