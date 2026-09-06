-- ============================================================================
-- 28_ai-usage-cascade-v24.sql — a deleted account must not leave its counter behind.
--
-- 26 created public.ai_usage with a bare `user_id uuid not null` and no foreign
-- key, so deleting a user left its per-day rows orphaned forever. Nothing reads
-- them, nothing prunes them (admin_prune_ai_usage only drops rows older than 30
-- days, and an orphan younger than that survives), and the table is exactly the
-- kind of unattended growth migration 26 set out to bound. Found while cleaning
-- up test accounts on 2026-09-06: two orphan rows from deleted probes.
--
-- The all-zero GLOBAL row is not a user and must survive, so the constraint is
-- NOT VALID against it — instead the delete cascades only for real users and the
-- sentinel row is exempted by a CHECK-free design: the FK is added with
-- `on delete cascade` and the sentinel simply never matches a user, which would
-- normally fail validation. So the FK is declared NOT VALID and left unvalidated:
-- it enforces the cascade for every FUTURE delete without rejecting the existing
-- sentinel row.
-- Idempotent.
-- ============================================================================

-- clean any orphan that already exists (never the sentinel, never a live user)
delete from public.ai_usage a
 where a.user_id <> '00000000-0000-0000-0000-000000000000'
   and not exists (select 1 from auth.users u where u.id = a.user_id);

alter table public.ai_usage drop constraint if exists ai_usage_user_fk;
alter table public.ai_usage
  add constraint ai_usage_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;

-- VERIFY — by DELETING a user and watching the row go, inside a block that
-- rolls back. Reading pg_constraint would only prove the constraint exists, not
-- that it cascades, which is the whole point.
do $$
declare
  probe uuid := '00000000-0000-4000-8000-00000cadcade';
  before_n integer;
  after_n integer;
begin
  -- a throwaway auth row purely to be deleted again
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (probe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'cascade.probe@example.invalid', '', pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb);
  insert into public.ai_usage (user_id, day, n) values (probe, (pg_catalog.now() at time zone 'utc')::date, 3);
  select pg_catalog.count(*) into before_n from public.ai_usage where user_id = probe;

  delete from auth.users where id = probe;
  select pg_catalog.count(*) into after_n from public.ai_usage where user_id = probe;

  if before_n <> 1 or after_n <> 0 then
    raise exception 'VERIFY failed: ai_usage did not cascade (before=%, after=%)', before_n, after_n;
  end if;
  raise exception 'ROLLBACK-OK: deleting a user removed its ai_usage row (% -> %)', before_n, after_n;
exception
  when others then
    if pg_catalog.position('ROLLBACK-OK' in sqlerrm) = 0 then raise; end if;
    raise notice 'VERIFY ok: the cascade fires';
end $$;
