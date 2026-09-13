-- ============================================================================
-- 29_ai-usage-fk-repair-v25.sql — the daily AI budget has been dead since v28.
--
-- NOT APPLIED. This file is in backend/pending/ deliberately: it is a LIVE WRITE
-- to the owner's production database and only he runs it.
--
-- ── WHAT IS BROKEN ─────────────────────────────────────────────────────────
-- 28 added:
--     alter table public.ai_usage
--       add constraint ai_usage_user_fk foreign key (user_id)
--       references auth.users(id) on delete cascade not valid;
--
-- and its header states, in writing:
--     "the FK is declared NOT VALID and left unvalidated: it enforces the
--      cascade for every FUTURE delete without rejecting the existing
--      sentinel row."
--
-- That is false, and it is the whole defect. **NOT VALID skips validation of
-- rows that ALREADY EXIST. It does not disable enforcement on INSERT.** Both
-- RI check triggers are live and enabled (tgenabled='O').
--
-- ai_budget_take() charges the GLOBAL counter as a row whose user_id is the
-- all-zero sentinel:
--     insert into public.ai_usage (user_id, day, n)
--       values ('00000000-0000-0000-0000-000000000000', today, 1)
--       on conflict (user_id, day) do update set n = ... + 1;
--
-- On the FIRST call of each new UTC day there is no sentinel row for `today`,
-- so ON CONFLICT cannot deflect it: it is a genuine INSERT, the FK fires, and
-- the sentinel is not a user (select count(*) from auth.users where
-- id = '00000000-…' → 0). The whole SECURITY DEFINER call aborts with 23503 —
-- **rolling back the per-user increment with it** — PostgREST answers 409, and
-- the Worker's
--     if (!r.ok) return { ok: true };   // gemini-worker.js:339
-- fails OPEN. Every AI call since has been served with no accounting at all.
--
-- ── MEASURED, READ-ONLY, ON THE LIVE DATABASE ──────────────────────────────
--   ai_usage holds exactly 2 rows, both day = 2026-09-06, n = 10.
--   Today is 2026-09-13. Nothing has been billed for SEVEN days.
--   convalidated = false; 2 RI triggers enabled; sentinel is not in auth.users.
--
-- This is the exact failure 26 and 27 exist to prevent: one account exhausting
-- the shared free Gemini quota and switching the AI off for everyone until
-- midnight. The only remaining bound is Cloudflare's per-IP limiter, which caps
-- a burst and never a day's spend across accounts.
--
-- ── THE FIX, AND WHY THIS ONE ──────────────────────────────────────────────
-- Drop the constraint. It was added for HOUSEKEEPING — orphan counter rows left
-- by deleted accounts — and it broke a live spending cap to get it. Those rows
-- are one per user per day and admin_prune_ai_usage() already deletes anything
-- older than 30 days, so an orphan self-clears; a dead budget does not.
--
-- Postgres has no partial or conditional foreign key, so there is no way to
-- keep this FK and exempt the sentinel. If the cascade is wanted back, the
-- right shape is to move the global counter OUT of the same table
-- (`ai_usage_global(day, n)`) so every row in ai_usage really is a user's —
-- that is a schema change plus a function rewrite, and it is not what an
-- actively-bleeding cap should wait for.
--
-- Idempotent. Reversible: re-adding the constraint restores exactly today's
-- (broken) state.
-- ============================================================================

alter table public.ai_usage drop constraint if exists ai_usage_user_fk;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- 28's VERIFY was not lazy — it proved the cascade fires, inside a rolled-back
-- block. It simply never exercised the ONE function that writes the table it
-- had just constrained. This project's own rule is "a migration must END BY
-- CALLING the thing it changed"; ai_budget_take() returns 'nosession' without
-- an auth.uid(), so the closest honest test is to perform its EXACT sentinel
-- INSERT for a day that does not exist yet, and assert it is accepted.
--
-- Everything below runs inside a block that RAISES at the end, so no probe row
-- survives and the counters are untouched.
do $$
declare
  probe_day date := (pg_catalog.now() at time zone 'utc')::date + 400;
  got       integer;
  still_there boolean;
begin
  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.ai_usage'::regclass and conname = 'ai_usage_user_fk'
  ) into still_there;
  if still_there then
    raise exception 'VERIFY FAILED: ai_usage_user_fk is still present';
  end if;

  -- the exact statement ai_budget_take() runs for the global counter
  insert into public.ai_usage (user_id, day, n)
    values ('00000000-0000-0000-0000-000000000000', probe_day, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into got;
  if got is distinct from 1 then
    raise exception 'VERIFY FAILED: sentinel insert returned %, expected 1', got;
  end if;

  raise exception 'VERIFY OK: the sentinel insert is accepted again — rolling back the probe';
exception
  when others then
    -- strpos(), NOT position(). `position(x in y)` is SQL GRAMMAR: it has the
    -- same shape as COALESCE and cannot be schema-qualified — pg_catalog.position
    -- (…in…) is a syntax error. This file's own header warns about that family
    -- and the first draft of this very block shipped it anyway. strpos() is a
    -- real pg_proc entry and qualifies cleanly.
    if pg_catalog.strpos(SQLERRM, 'VERIFY OK') > 0 then
      raise notice '%', SQLERRM;
    else
      raise;
    end if;
end $$;

-- After applying, confirm the real path from the app: make one AI call, then
--   select * from public.ai_usage where day = (now() at time zone 'utc')::date;
-- There must be TWO rows for today — your own user id, and the all-zero global
-- row. If only your own appears, the global charge is still failing.
