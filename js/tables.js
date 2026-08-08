// ============================================================================
// tables.js — "MIRROR" projection: local blob  ->  normalized Supabase tables.
// ============================================================================
// THE VAULT keeps its whole state in one localStorage blob (see storage.js) and
// syncs that blob to the `vault_data` row (see cloud.js). That stays the source
// of truth and the offline-first path — untouched.
//
// This module ADDITIVELY projects the same data into the normalized schema-v2
// tables so the owner has a real relational warehouse (and a foundation for
// future social features). It is:
//   * ONE-WAY  (blob -> tables). The app never reads back from these tables yet.
//   * BEST-EFFORT. Every network/DB error is swallowed; a failure here can NEVER
//     affect local logging. If offline or logged out, it simply no-ops.
//   * IDEMPOTENT. Everything upserts on its primary key with stable ids, so
//     re-running never duplicates.
//
// It talks to Supabase only through the publishable/anon client exposed by
// cloud.js, so RLS is fully enforced — it can only ever write the signed-in
// user's own rows.
// ============================================================================
(function () {
  'use strict';

  // ---- id helpers ----------------------------------------------------------
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);

  // Deterministic 128-bit hash -> 32 hex chars (so a legacy non-UUID id never
  // makes an insert into a uuid column fail, and re-runs stay stable).
  function hashHex(str) {
    let h1 = 0x9e3779b1, h2 = 0x85ebca77, h3 = 0xc2b2ae3d, h4 = 0x27d4eb2f;
    const s = String(str == null ? '' : str);
    for (let i = 0; i < s.length; i++) {
      const k = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ k, 0x85ebca77) >>> 0;
      h2 = Math.imul(h2 ^ k, 0xc2b2ae3d) >>> 0;
      h3 = Math.imul(h3 ^ k, 0x27d4eb2f) >>> 0;
      h4 = Math.imul(h4 ^ k, 0x165667b1) >>> 0;
    }
    const hx = (n) => (n >>> 0).toString(16).padStart(8, '0');
    return hx(h1) + hx(h2) + hx(h3) + hx(h4);
  }
  // Return a valid lowercase UUID for any string: pass real UUIDs through,
  // derive a deterministic v4-shaped UUID for anything else.
  function toUuid(id) {
    if (isUuid(id)) return String(id).toLowerCase();
    const h = hashHex(id);
    return (
      h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' +
      (((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)) + h.slice(17, 20) + '-' +
      h.slice(20, 32)
    );
  }

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const orNull = (v) => (v === undefined ? null : v);

  // ---- state ---------------------------------------------------------------
  let running = false;
  let timer = null;

  function readBlob() {
    try { return JSON.parse(DB.exportJSON()); } catch (_) { return null; }
  }

  // Best-effort upsert of one table's rows in chunks. Never throws.
  async function upsert(client, table, rows, onConflict) {
    if (!rows || !rows.length) return { table, count: 0 };
    let done = 0, err = null;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      try {
        const q = client.from(table).upsert(chunk, onConflict ? { onConflict } : undefined);
        const { error } = await q;
        if (error) { err = error.message; } else { done += chunk.length; }
      } catch (e) { err = (e && e.message) || String(e); }
    }
    return { table, count: done, error: err };
  }

  // ---- the projection ------------------------------------------------------
  async function projectAll() {
    if (running) return { skipped: 'already-running' };
    if (!window.Cloud || !Cloud.configured || !Cloud.configured()) return { skipped: 'not-configured' };
    running = true;
    const summary = {};
    try {
      if (Cloud.ensureSdk) { try { await Cloud.ensureSdk(); } catch (_) {} }
      const session = await Cloud.getSession();
      if (!session || !session.user) return { skipped: 'logged-out' };
      const client = Cloud.getClient && Cloud.getClient();
      if (!client) return { skipped: 'no-client' };
      const userId = session.user.id;

      const b = readBlob();
      if (!b) return { skipped: 'no-blob' };

      // --- resolve the shared exercise catalog: local name -> global id ------
      // Seed exercises have local ids that differ from the global catalog ids;
      // remap them by (lowercased) name. Custom exercises keep their own id.
      //
      // `error` USED TO BE DISCARDED HERE — only `data` was destructured — and
      // that was a live data-loss path, not a tidiness problem. A failed query
      // returns {data: null, error}, which is indistinguishable from an empty
      // catalog once the error is thrown away. Empty catalog means every
      // NON-CUSTOM exercise resolves to null at `exIdMap`, which means the
      // sessions loop skips every one of them, which means `sessions` comes out
      // EMPTY — while `blobLooksReal` stays true on the strength of the user's
      // food and sleep rows. The reconcile at the bottom of this file then runs
      // with an empty id list, skips its `.not('id','in',...)` filter, and
      // degrades to "delete every workout_sessions row for this user" — sets
      // cascading with them. One transient 5xx was enough.
      //
      // catalogOk is the gate. It is true only when the query SUCCEEDED and
      // returned rows, and no session delete may run without it.
      const nameToGlobal = {};
      let catalogOk = false;
      try {
        const { data: cat, error } = await client
          .from('exercises').select('id,name').is('owner_id', null);
        if (error) summary['catalog:exercises'] = 'ERR: ' + error.message;
        else if (cat && cat.length) {
          catalogOk = true;
          cat.forEach((r) => { if (r && r.name) nameToGlobal[String(r.name).toLowerCase()] = r.id; });
        } else summary['catalog:exercises'] = 'empty';
      } catch (e) { summary['catalog:exercises'] = 'ERR: ' + ((e && e.message) || String(e)); }

      const exList = Array.isArray(b.exercises) ? b.exercises : [];
      const exIdMap = {};                 // local exercise id -> server id (or null)
      const localFoodIds = new Set((b.foods || []).map((f) => f && f.id).filter(Boolean));

      const customExercises = [];
      const userExPrefs = [];     // in_my_list only — NEVER carries the image column
      const userExPrefsImg = [];  // rows that actually have an image pointer
      exList.forEach((ex) => {
        if (!ex || !ex.id) return;
        if (ex.isCustom) {
          const sid = toUuid(ex.id);
          exIdMap[ex.id] = sid;
          customExercises.push({
            id: sid,
            owner_id: userId,
            name: ex.name || 'Exercise',
            category: ex.category || 'Other',
            image_slug: orNull(ex.imageSlug),
            machine_type: orNull(ex.machineType),
          });
        } else {
          const gid = nameToGlobal[String(ex.name || '').toLowerCase()] || null;
          exIdMap[ex.id] = gid;          // may be null if not in catalog
        }
        // Pointer to the durable copy of the user's uploaded image. This is the
        // field whose absence made the images unrecoverable when the blob was
        // once wiped: a mirror restore brought back the exercise but not its
        // picture. user_exercise_prefs.custom_image_path is the schema's
        // DESIGNATED home for it (schema-v2.sql: "exercise-images <-
        // user_exercise_prefs.custom_image_path"), and unlike `exercises` that
        // table is purely owner-scoped.
        //
        // Split into two batches on purpose. An upsert writes every column in
        // its payload, so sending custom_image_path: null for a blob row that
        // has no path yet would NULL OUT a pointer already stored on the server
        // — the exact blind-overwrite that destroyed the images in the first
        // place. Rows without a path simply never mention the column.
        const sid = exIdMap[ex.id];
        if (sid) {
          if (ex.imagePath) {
            userExPrefsImg.push({
              user_id: userId,
              exercise_id: sid,
              in_my_list: !!ex.inMyList,
              custom_image_path: ex.imagePath,
            });
          } else if (ex.inMyList) {
            userExPrefs.push({ user_id: userId, exercise_id: sid, in_my_list: true });
          }
        }
      });

      // --- valid cardio types (built-in globals + this user's customs) -------
      //
      // The SAME swallowed-error trap as the exercise catalog above, and worse
      // here: the BUILT-IN cardio slugs exist ONLY in this query's result. The
      // blob has no copy of them — storage.js keeps them in the CARDIO_TYPES
      // const and STATE.cardioTypes holds customs only. So one failed SELECT
      // unresolves essentially every cardio log for essentially every user, and
      // `cardioLogs` comes out empty next to a `blobLooksReal` that is still
      // true. cardioTypesOk gates the cardio delete on the query having actually
      // worked.
      const validCardioTypes = new Set();
      let cardioTypesOk = false;
      try {
        const { data: ct, error } = await client.from('cardio_types').select('id');
        if (error) summary['catalog:cardio_types'] = 'ERR: ' + error.message;
        else if (ct && ct.length) {
          cardioTypesOk = true;
          ct.forEach((r) => r && r.id && validCardioTypes.add(r.id));
        } else summary['catalog:cardio_types'] = 'empty';
      } catch (e) { summary['catalog:cardio_types'] = 'ERR: ' + ((e && e.message) || String(e)); }
      const customCardioTypes = (b.cardioTypes || [])
        .filter((t) => t && t.id)
        .map((t) => {
          validCardioTypes.add(t.id);
          return { id: t.id, owner_id: userId, label: t.label || 'Cardio', icon_name: t.iconName || 'heart' };
        });

      // --- build row sets ----------------------------------------------------
      const userPrefs = [{
        user_id: userId,
        lang: (b.prefs && b.prefs.lang) === 'ar' ? 'ar' : 'en',
        theme: (b.prefs && b.prefs.theme) === 'light' ? 'light' : 'dark',
        unit: (b.prefs && b.prefs.unit) === 'lb' ? 'lb' : 'kg',
      }];
      const healthHidden = (b.health && Array.isArray(b.health.hidden)) ? b.health.hidden : [];
      const healthPrefs = [{ user_id: userId, hidden: healthHidden }];

      const sessions = [];
      const sets = [];
      (b.sessions || []).forEach((s) => {
        if (!s || !s.id) return;
        const exId = exIdMap[s.exerciseId];
        if (!exId || !s.date) return;                 // unresolved exercise -> skip
        const sid = toUuid(s.id);
        sessions.push({ id: sid, user_id: userId, exercise_id: exId, performed_on: s.date });
        (Array.isArray(s.sets) ? s.sets : []).forEach((st, i) => {
          sets.push({
            id: toUuid('set:' + s.id + ':' + i),
            session_id: sid,
            set_index: i,
            reps: num(st && st.reps),
            weight: num(st && st.weight),
          });
        });
      });

      const cardioLogs = (b.cardio || [])
        .filter((c) => c && c.id && c.type && validCardioTypes.has(c.type) && c.date)
        .map((c) => ({
          id: toUuid(c.id),
          user_id: userId,
          cardio_type_id: c.type,
          performed_on: c.date,
          duration_min: num(c.duration),
          calories: num(c.calories),
          source: orNull(c.source),
          hc_key: orNull(c.hcKey),
        }));

      const foods = (b.foods || [])
        .filter((f) => f && f.id)
        .map((f) => ({
          id: toUuid(f.id),
          user_id: userId,
          name: f.name || 'Food',
          serving: orNull(f.serving),
          calories: num(f.calories),
          protein: num(f.protein),
          carbs: num(f.carbs),
        }));

      const foodLogs = [];
      const flMap = (b.foodLogs && typeof b.foodLogs === 'object') ? b.foodLogs : {};
      Object.keys(flMap).forEach((date) => {
        (Array.isArray(flMap[date]) ? flMap[date] : []).forEach((e) => {
          if (!e || !e.id || !e.name) return;
          foodLogs.push({
            id: toUuid(e.id),
            user_id: userId,
            food_id: (e.foodId && localFoodIds.has(e.foodId)) ? toUuid(e.foodId) : null,
            logged_on: date,
            name: e.name,
            servings: num(e.servings) || 1,
            calories: num(e.calories),
            protein: num(e.protein),
            carbs: num(e.carbs),
            fat: num(e.fat),
            source: orNull(e.source),
          });
        });
      });

      const sleepLogs = (b.sleep || [])
        .filter((s) => s && s.id && s.date)
        .map((s) => ({
          id: toUuid(s.id),
          user_id: userId,
          slept_on: s.date,
          sleep_time: orNull(s.sleepTime),
          wake_time: orNull(s.wakeTime),
          duration_min: num(s.durationMinutes),
          source: orNull(s.source),
          hc_key: orNull(s.hcKey),
        }));

      // Plan is now a CONTINUOUS ROTATION (cycle + trainingDays + anchor), not a
      // fixed weekly grid. The mirror's plan_days schema is still day-of-week
      // keyed, so we materialize THIS WEEK (Sun..Sat) via workoutForDate — the
      // single source of truth for "what's the workout on date D". Lossy (drops
      // the rotation definition) and additive-only, so it can drift, but it
      // keeps admin.html's per-user plan view populated. Analytics-only.
      const planDays = [];
      const planDayEx = [];
      const weekStart = new Date(); weekStart.setHours(12, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // rewind to Sunday
      for (let dow = 0; dow <= 6; dow++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + dow);
        const day = (DB.plan && DB.plan.workoutForDate) ? DB.plan.workoutForDate(d) : null;
        if (!day) continue;
        planDays.push({ user_id: userId, day_of_week: dow, name: day.name || 'Workout' });
        (Array.isArray(day.exerciseIds) ? day.exerciseIds : []).forEach((localExId, pos) => {
          const exId = exIdMap[localExId];
          if (!exId) return;
          planDayEx.push({
            id: toUuid('pde:' + userId + ':' + dow + ':' + localExId),
            user_id: userId,
            day_of_week: dow,
            exercise_id: exId,
            position: pos,
          });
        });
      }

      const supplements = (b.supplements || [])
        .filter((s) => s && s.id)
        .map((s) => ({
          id: toUuid(s.id),
          user_id: userId,
          name: s.name || 'Supplement',
          dose: orNull(s.dose),
          color: s.color || '#22d3ee',
        }));
      const localSuppIds = new Set((b.supplements || []).map((s) => s && s.id).filter(Boolean));
      const supplementLogs = [];
      const slMap = (b.supplementLogs && typeof b.supplementLogs === 'object') ? b.supplementLogs : {};
      Object.keys(slMap).forEach((date) => {
        const day = slMap[date];
        if (!day || typeof day !== 'object') return;
        Object.keys(day).forEach((suppId) => {
          if (day[suppId] && localSuppIds.has(suppId)) {
            supplementLogs.push({ supplement_id: toUuid(suppId), taken_on: date });
          }
        });
      });

      // --- push in FK-safe order --------------------------------------------
      const steps = [
        ['user_prefs', userPrefs, 'user_id'],
        ['health_prefs', healthPrefs, 'user_id'],
        ['exercises', customExercises, 'id'],
        ['cardio_types', customCardioTypes, 'id'],
        ['foods', foods, 'id'],
        ['user_exercise_prefs', userExPrefs, 'user_id,exercise_id'],
        // Separate step: same table, but this payload carries custom_image_path.
        // Keeping it apart is what stops a null from clobbering a stored pointer.
        ['user_exercise_prefs', userExPrefsImg, 'user_id,exercise_id'],
        ['workout_sessions', sessions, 'id'],
        ['workout_sets', sets, 'id'],
        ['cardio_logs', cardioLogs, 'id'],
        ['food_logs', foodLogs, 'id'],
        ['sleep_logs', sleepLogs, 'id'],
        ['plan_days', planDays, 'user_id,day_of_week'],
        ['plan_day_exercises', planDayEx, 'id'],
        ['supplements', supplements, 'id'],
        ['supplement_logs', supplementLogs, 'supplement_id,taken_on'],
      ];
      for (const [table, rows, onConflict] of steps) {
        const r = await upsert(client, table, rows, onConflict);
        summary[table] = r.error ? ('ERR: ' + r.error) : r.count;
      }

      // RECONCILE — remove rows the user DELETED locally so the mirror REFLECTS the
      // blob instead of drifting. The mirror used to only ever upsert, so a deleted
      // session/food lived on forever as a ghost row — which now matters because
      // admin.html reads these tables (via the aggregate RPCs), so ghosts inflate
      // its numbers. Best-effort + RLS-scoped (can only touch the signed-in user's
      // own rows). workout_sets are removed via ON DELETE CASCADE from their
      // session. Skipped when the id set is huge to avoid an oversized delete query
      // (a miss just leaves the ghosts for the next pass — never data loss, since
      // the blob is the source of truth and these tables are analytics-only).
      // SAFETY GATE (same class of bug that once destroyed the exercise images):
      // when an id list is EMPTY the `.not('id','in',...)` filter below is skipped,
      // so the delete degrades to "remove EVERY row of this table for this user".
      // That is correct only if the local blob really is empty — and catastrophic
      // if it is empty because the store failed to load, was mid-restore, or the
      // projection ran before a cloud pull landed. So: only reconcile at all when
      // the blob demonstrably holds real user data. A leftover ghost row is
      // harmless (analytics-only, fixed on the next pass); a wiped mirror is not.
      const blobLooksReal = !!(
        sessions.length || cardioLogs.length || foodLogs.length ||
        sleepLogs.length || supplements.length
      );
      //
      // `opts.owner` and `opts.key` exist because the tables are NOT uniform:
      // exercises/cardio_types are scoped by `owner_id` (global catalog rows
      // carry NULL there, and NULL never equals a value, so those are excluded
      // automatically), and plan_days has NO `id` column at all — its key is the
      // composite (user_id, day_of_week). Reusing the id/user_id assumptions on
      // either would have deleted nothing at best and the wrong rows at worst.
      const reconcile = async (table, keys, opts) => {
        const o = opts || {};
        if (!blobLooksReal) return;   // never mass-delete from an empty/unloaded blob
        if (keys.length > 2000) return;
        try {
          let q = client.from(table).delete().eq(o.owner || 'user_id', userId);
          if (keys.length) q = q.not(o.key || 'id', 'in', '(' + keys.join(',') + ')');
          const { error } = await q;
          if (error) summary['reconcile:' + table] = 'ERR: ' + error.message;
        } catch (_) {}
      };
      if (!blobLooksReal) summary.reconcile = 'skipped (local blob has no user data)';

      // GATED on the catalog queries above having actually SUCCEEDED. These two
      // id lists are the only ones DERIVED FROM THE NETWORK: an exercise or a
      // cardio type that could not be resolved silently drops its rows, so an
      // empty list here can mean "the user deleted everything" OR "a lookup
      // failed" — and the second reading, acted on, wipes real history.
      if (catalogOk) await reconcile('workout_sessions', sessions.map((s) => s.id)); // sets cascade
      else summary['reconcile:workout_sessions'] = 'skipped (exercise catalog unavailable)';
      if (cardioTypesOk) await reconcile('cardio_logs', cardioLogs.map((c) => c.id));
      else summary['reconcile:cardio_logs'] = 'skipped (cardio types unavailable)';

      // Everything below derives from PURELY LOCAL blob data with no network
      // lookup in the path, so an empty list is an honest "the user has none of
      // these" rather than a failure wearing the same clothes.
      await reconcile('food_logs', foodLogs.map((f) => f.id));
      await reconcile('sleep_logs', sleepLogs.map((s) => s.id));
      await reconcile('supplements', supplements.map((s) => s.id));       // logs cascade
      await reconcile('foods', foods.map((f) => f.id));
      await reconcile('plan_days', planDays.map((d) => d.day_of_week), { key: 'day_of_week' });
      await reconcile('cardio_types', customCardioTypes.map((t) => t.id), { owner: 'owner_id' });

      // `exercises` IS DELIBERATELY NOT RECONCILED, and this is a decision, not
      // an omission. Deleting a row there CASCADES into user_exercise_prefs,
      // which carries `custom_image_path` — the pointer to the durable copy of
      // the user's own uploaded exercise photos. That is the field whose absence
      // once made those images UNRECOVERABLE for the owner (see CLAUDE.md), and
      // this is the same class of bug that did it: a momentarily incomplete blob
      // widening a delete. The entire prize on the other side is a few ghost
      // rows in an analytics-only mirror. Not a trade worth making.
      // Its children (plan_day_exercises, user_exercise_prefs) are reachable by
      // cascade from plan_days instead, which carries no image pointer.

      return { ok: true, userId, summary };
    } catch (e) {
      return { error: (e && e.message) || String(e), summary };
    } finally {
      running = false;
    }
  }

  // Throttled trigger, called from cloud.js on every local change. The mirror is
  // ANALYTICS-ONLY and one-way, and each projection re-upserts the user's whole
  // history across 16 tables — so at scale it is the biggest write amplifier. We
  // cap it to at most one projection per MIN_INTERVAL with a guaranteed trailing
  // run, instead of a resettable debounce that could either fire every burst or
  // (with a long debounce) never fire during a long logging session. Freshness of
  // admin analytics is traded for a ~15x cut in mirror writes — an easy trade.
  let lastRun = 0;
  const MIN_INTERVAL = 30000;
  function scheduleProject() {
    if (timer) return; // a projection is already pending — don't reset it
    const wait = Math.max(2500, MIN_INTERVAL - (Date.now() - lastRun));
    timer = setTimeout(() => {
      timer = null;
      lastRun = Date.now();
      projectAll().catch(() => {});
    }, wait);
  }

  window.Tables = { projectAll, scheduleProject };

  // Initial projection a few seconds after boot, once the login/sync settles.
  // Best-effort: no-ops if logged out.
  try {
    setTimeout(() => { projectAll().catch(() => {}); }, 4500);
  } catch (_) {}
})();
