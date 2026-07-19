-- ============================================================================
-- perf-indexes.sql  —  index the ONE access pattern the schema didn't cover
-- ============================================================================
-- The existing schema is already well-indexed: every per-user aggregation in
-- admin_user_stats() rides a (user_id, <date> desc) index, and the exercise join
-- rides workout_sessions_exercise_idx. The gap is admin_activity()'s GLOBAL,
-- cross-user queries on performed_on — "sessions today / this week" (range filter)
-- and the "recent 12" (order by performed_on desc). Those can't use the
-- (user_id, performed_on) index because user_id is the leading column, so today
-- they force a scan. A standalone index on performed_on serves them directly.
--
-- ADDITIVE + idempotent + online (CREATE INDEX IF NOT EXISTS). Apply in the
-- Supabase SQL editor. On a large table prefer CONCURRENTLY (must run outside a
-- transaction — see the note below).
-- ============================================================================

create index if not exists workout_sessions_performed_idx
  on public.workout_sessions (performed_on desc);

-- On a table that is ALREADY large, build it without locking writes instead:
--   (run this ALONE, not wrapped in a transaction / not with other statements)
-- create index concurrently if not exists workout_sessions_performed_idx
--   on public.workout_sessions (performed_on desc);

-- ============================================================================
-- VERIFY:
--   explain analyze
--     select count(*) from public.workout_sessions where performed_on >= current_date - 7;
--   -- should show an Index/Bitmap scan on workout_sessions_performed_idx, not a Seq Scan.
--
-- NOTE — the two heavy analytics in admin_activity() (top_ex, cat_dist) aggregate
-- over EVERY session and no index makes a full GROUP BY cheap. If they become slow
-- at very large scale, pre-aggregate them into a small summary table refreshed on a
-- schedule (materialized view / cron) rather than indexing — a separate, bigger step.
-- ============================================================================
