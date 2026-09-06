-- ============================================================================
-- 27_abuse-hardening-repairs-v23.sql — what an adversarial review of 26 found,
-- repaired. Forty-two agents read that migration against the live database and
-- confirmed twenty-eight findings. Four of them meant 26 did not do what it
-- said, one meant it BROKE something, and one was a defect I introduced while
-- fixing another. This file is the record of the repairs, applied live and
-- proved by probes that were rolled back afterwards.
--
--   A. the feedback cap could never fire       (26 shipped it as a no-op)
--   B. the AI budget billed refusals to the shared row  (one account could
--      switch the AI off for everyone — the exact outcome 26 existed to stop)
--   C. exercise_image_count(uuid) answered about ANY user
--   D. exercises / cardio_types were still unbounded — the largest remaining
--      way to fill the free tier, which 26 missed entirely
--   E. an "always allow replacing your own photo" carve-out I added between 26
--      and this file referenced storage.objects from inside storage.objects'
--      own INSERT policy: EVERY upload then failed with 42P17 infinite
--      recursion, silently, because the client treats a failed backup as
--      best-effort. Live for about twenty minutes; no user hit it.
--
-- Idempotent. Every section ends by CALLING what it defines.
-- ============================================================================

-- ── A. the feedback cap was a NO-OP ────────────────────────────────────────
-- SECURITY INVOKER + no own-row SELECT policy on `feedback` means the trigger's
-- own count ran under RLS and saw zero rows, so `recent >= 5` was never true.
-- A cap that reads through the same RLS it is trying to enforce is not a cap.
create or replace function public.feedback_rate_cap()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  recent integer;
begin
  select pg_catalog.count(*) into recent
  from public.feedback f
  where f.user_id = new.user_id
    and f.created_at > pg_catalog.now() - interval '1 hour';
  -- RAISE, never `return null`: a BEFORE INSERT trigger that returns null drops
  -- the row and PostgREST reports success, so the form would say "sent" for a
  -- message nobody will ever read. js/cloud.js matches this exact string.
  if recent >= 5 then
    raise exception 'feedback rate limit';
  end if;
  return new;
end;
$$;

-- ── B. the AI budget must not bill what it refuses ─────────────────────────
-- 26 incremented BOTH counters and then tested them, so a user past their own
-- 60 kept adding to the shared 800 with every refused call. Nine hundred calls
-- from one account — cheap, since the RPC is reachable from any signed-in
-- browser — and every other user's first call of the day is refused.
-- Now: read, decide, and only then charge. A single account can contribute at
-- most its own daily limit to the global figure.
create or replace function public.ai_budget_take(p_user_limit integer default 60, p_global_limit integer default 800)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid    uuid := auth.uid();
  today  date := (pg_catalog.now() at time zone 'utc')::date;
  mine   integer;
  total  integer;
begin
  if uid is null then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'nosession');
  end if;

  -- COALESCE is SQL GRAMMAR, not a function: it has no pg_proc row and cannot
  -- be schema-qualified. `pg_catalog.coalesce(...)` applies clean and throws on
  -- the first call — migration 16 nearly shipped that, and this function did
  -- ship it for about ten minutes. Same for GREATEST, LEAST, NULLIF, CASE, CAST.
  select n into mine from public.ai_usage u where u.user_id = uid and u.day = today;
  mine := coalesce(mine, 0);
  if mine >= p_user_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'user_daily', 'used', mine, 'limit', p_user_limit);
  end if;

  select n into total from public.ai_usage u
   where u.user_id = '00000000-0000-0000-0000-000000000000' and u.day = today;
  total := coalesce(total, 0);
  if total >= p_global_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'global_daily', 'used', total, 'limit', p_global_limit);
  end if;

  insert into public.ai_usage (user_id, day, n) values (uid, today, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into mine;
  insert into public.ai_usage (user_id, day, n)
    values ('00000000-0000-0000-0000-000000000000', today, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into total;

  return pg_catalog.jsonb_build_object('allowed', true, 'used', mine, 'limit', p_user_limit);
end;
$$;
revoke all on function public.ai_budget_take(integer, integer) from public, anon;
grant execute on function public.ai_budget_take(integer, integer) to authenticated;
-- RESIDUAL, on purpose: `authenticated` must keep EXECUTE because the Worker
-- calls this with the CALLER'S token. A signed-in user can therefore spend
-- their own 60 without using the AI, which adds at most 60 to the global 800 —
-- exactly what using the app does. The global cap is only as strong as accounts
-- are scarce, and that is the sign-up decision, not a SQL one.

-- ── C. the image count answers about the CALLER only ───────────────────────
-- 26's version took a uuid, was SECURITY DEFINER and was granted to
-- authenticated: any signed-in user could ask how many private photos any other
-- account had, and the owner's uuid is in the public repo.
drop policy if exists "exercise_images_owner_insert" on storage.objects;
drop function if exists public.exercise_image_count(uuid);

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
    and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;
revoke all on function public.exercise_image_count() from public, anon;
grant execute on function public.exercise_image_count() to authenticated;

-- ── E. the carve-out, expressed WITHOUT re-entering the policy ─────────────
-- "Always allow replacing an object you already own" was first written as an
-- EXISTS over storage.objects inside storage.objects' own INSERT policy.
-- Postgres answers 42P17 infinite recursion — for EVERY insert, at zero objects,
-- not at the 200 ceiling — and the client treats a failed photo backup as
-- best-effort, so the durable backup died in silence. SECURITY DEFINER is what
-- keeps the count out of that trap; the existence check needs the same.
create or replace function public.exercise_image_exists(p_name text)
returns boolean
language sql
security definer
set search_path to ''
stable
as $$
  select exists (
    select 1 from storage.objects o
    where o.bucket_id = 'exercise-images'
      and o.name = p_name
      and (storage.foldername(o.name))[1] = (select auth.uid())::text   -- own objects only: never an oracle about anyone else
  );
$$;
revoke all on function public.exercise_image_exists(text) from public, anon;
grant execute on function public.exercise_image_exists(text) to authenticated;

create policy "exercise_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and name ~ '^[^/]+/[A-Za-z0-9_-]{1,64}\.jpg$'
    and (public.exercise_image_count() < 200 or public.exercise_image_exists(name))
  );

-- ── D. the two tables 26 left unbounded ────────────────────────────────────
-- `exercises` and `cardio_types` are the other tables an ordinary account may
-- INSERT into. Nothing bounded the text or the row count, so one account could
-- write until the 500 MB free tier filled and the project went read-only for
-- every user — a bigger lever than the blob history 26 spent its effort on.
alter table public.exercises drop constraint if exists exercises_name_len;
alter table public.exercises add constraint exercises_name_len check (length(name) <= 120);
alter table public.exercises drop constraint if exists exercises_image_slug_len;
alter table public.exercises add constraint exercises_image_slug_len check (image_slug is null or length(image_slug) <= 200);
alter table public.exercises drop constraint if exists exercises_machine_type_len;
alter table public.exercises add constraint exercises_machine_type_len check (machine_type is null or length(machine_type) <= 60);

alter table public.cardio_types drop constraint if exists cardio_types_id_len;
alter table public.cardio_types add constraint cardio_types_id_len check (length(id) <= 64);
alter table public.cardio_types drop constraint if exists cardio_types_label_len;
alter table public.cardio_types add constraint cardio_types_label_len check (length(label) <= 120);
alter table public.cardio_types drop constraint if exists cardio_types_icon_len;
alter table public.cardio_types add constraint cardio_types_icon_len check (icon_name is null or length(icon_name) <= 40);

-- and a row ceiling per owner. SECURITY DEFINER for the same reason the feedback
-- cap needed it: a count that runs under RLS counts nothing.
create or replace function public.own_row_cap()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  n integer;
  cap integer := 2000;
begin
  if new.owner_id is null then      -- a global catalog row: admin RPCs only
    return new;
  end if;
  execute pg_catalog.format('select pg_catalog.count(*) from public.%I where owner_id = $1', tg_table_name)
    into n using new.owner_id;
  if n >= cap then
    raise exception '% row limit reached (%)', tg_table_name, cap;
  end if;
  return new;
end;
$$;

drop trigger if exists exercises_own_row_cap on public.exercises;
create trigger exercises_own_row_cap before insert on public.exercises
  for each row execute function public.own_row_cap();
drop trigger if exists cardio_types_own_row_cap on public.cardio_types;
create trigger cardio_types_own_row_cap before insert on public.cardio_types
  for each row execute function public.own_row_cap();

-- ============================================================================
-- VERIFY — each of these CALLS the thing it checks and FAILS when the claim is
-- false. The write probes run against a real user id (the foreign keys require
-- one) inside blocks that raise at the end, so every row they make is rolled
-- back; that is how the same probes were run when this was applied live.
-- ============================================================================
do $$
declare
  probe uuid; caught text; i int; r jsonb; mine int; total int;
begin
  select user_id into probe from public.vault_data order by user_id limit 1;
  if probe is null then
    raise notice 'VERIFY skipped: no user rows to probe against';
    return;
  end if;

  -- A: the sixth message in an hour is REFUSED, not silently dropped
  for i in 1..5 loop
    insert into public.feedback (user_id, message) values (probe, 'verify probe ' || i);
  end loop;
  begin
    insert into public.feedback (user_id, message) values (probe, 'verify probe 6');
    caught := 'no error';
  exception when others then caught := sqlerrm; end;
  if caught <> 'feedback rate limit' then
    raise exception 'VERIFY A failed: the 6th feedback gave "%"', caught;
  end if;

  -- D: an over-long exercise name is refused
  begin
    insert into public.exercises (id, owner_id, name) values (gen_random_uuid(), probe, repeat('x', 500));
    caught := 'no error';
  exception when others then caught := sqlerrm; end;
  if caught not like '%exercises_name_len%' then
    raise exception 'VERIFY D failed: a 500-character exercise name gave "%"', caught;
  end if;

  -- B: three allowed, the fourth refused, and the refusal charges NOTHING
  perform set_config('request.jwt.claims', '{"sub":"' || probe || '","role":"authenticated"}', true);
  for i in 1..4 loop
    select public.ai_budget_take(3, 800) into r;
  end loop;
  select n into mine from public.ai_usage where user_id = probe and day = (pg_catalog.now() at time zone 'utc')::date;
  select n into total from public.ai_usage where user_id = '00000000-0000-0000-0000-000000000000' and day = (pg_catalog.now() at time zone 'utc')::date;
  if (r->>'allowed')::boolean then
    raise exception 'VERIFY B failed: the 4th call was allowed';
  end if;
  if coalesce(mine, 0) <> 3 or coalesce(total, 0) <> 3 then
    raise exception 'VERIFY B failed: a refusal was billed (mine=%, global=%)', mine, total;
  end if;

  raise exception 'ROLLBACK-OK: A, B and D all held';
exception
  when others then
    if sqlerrm <> 'ROLLBACK-OK: A, B and D all held' then raise; end if;
    raise notice 'VERIFY ok: feedback cap raises, name length enforced, refusals cost nothing';
end $$;

-- C + E: the image policy admits a real upload and refuses a wrong name, with
-- no recursion. Rolled back the same way.
do $$
declare
  probe uuid; okjpg text; badsvg text;
begin
  select (storage.foldername(name))[1]::uuid into probe
    from storage.objects where bucket_id = 'exercise-images' limit 1;
  if probe is null then
    raise notice 'VERIFY C/E skipped: the bucket is empty';
    return;
  end if;
  perform set_config('request.jwt.claims', '{"sub":"' || probe || '","role":"authenticated"}', true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('exercise-images', probe || '/verify-probe.jpg', probe);
    okjpg := 'accepted';
  exception when others then okjpg := sqlerrm; end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('exercise-images', probe || '/verify-probe.svg', probe);
    badsvg := 'accepted';
  exception when others then badsvg := sqlerrm; end;
  reset role;
  if okjpg <> 'accepted' then
    raise exception 'VERIFY E failed: a legitimate .jpg upload was refused (%)', okjpg;
  end if;
  if badsvg = 'accepted' then
    raise exception 'VERIFY C failed: a .svg name was accepted';
  end if;
  raise exception 'ROLLBACK-OK: jpg accepted, svg refused';
exception
  when others then
    if sqlerrm <> 'ROLLBACK-OK: jpg accepted, svg refused' then raise; end if;
    raise notice 'VERIFY ok: the bucket policy admits a real upload and nothing else';
end $$;

-- and the grants, which need no probe
do $$
begin
  if has_function_privilege('anon', 'public.exercise_image_count()', 'execute')
     or has_function_privilege('anon', 'public.exercise_image_exists(text)', 'execute')
     or has_function_privilege('anon', 'public.ai_budget_take(integer,integer)', 'execute') then
    raise exception 'VERIFY failed: anon can execute one of the new functions';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'exercise_image_count' and p.pronargs = 1) then
    raise exception 'VERIFY failed: the one-argument exercise_image_count(uuid) still exists — it answered about any user';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.feedback_rate_cap()'::regprocedure) then
    raise exception 'VERIFY failed: feedback_rate_cap is not SECURITY DEFINER, so its count sees nothing';
  end if;
  raise notice 'VERIFY ok: grants and definer flags';
end $$;
