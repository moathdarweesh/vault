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
      const nameToGlobal = {};
      try {
        const { data: cat } = await client
          .from('exercises').select('id,name').is('owner_id', null);
        (cat || []).forEach((r) => { if (r && r.name) nameToGlobal[String(r.name).toLowerCase()] = r.id; });
      } catch (_) {}

      const exList = Array.isArray(b.exercises) ? b.exercises : [];
      const exIdMap = {};                 // local exercise id -> server id (or null)
      const localFoodIds = new Set((b.foods || []).map((f) => f && f.id).filter(Boolean));

      const customExercises = [];
      const userExPrefs = [];
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
        if (ex.inMyList) {
          const sid = exIdMap[ex.id];
          if (sid) userExPrefs.push({ user_id: userId, exercise_id: sid, in_my_list: true });
        }
      });

      // --- valid cardio types (built-in globals + this user's customs) -------
      const validCardioTypes = new Set();
      try {
        const { data: ct } = await client.from('cardio_types').select('id');
        (ct || []).forEach((r) => r && r.id && validCardioTypes.add(r.id));
      } catch (_) {}
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
      return { ok: true, userId, summary };
    } catch (e) {
      return { error: (e && e.message) || String(e), summary };
    } finally {
      running = false;
    }
  }

  // Debounced trigger, called from cloud.js on every local change.
  function scheduleProject(delay) {
    clearTimeout(timer);
    timer = setTimeout(() => { projectAll().catch(() => {}); }, delay || 2500);
  }

  window.Tables = { projectAll, scheduleProject };

  // Initial projection a few seconds after boot, once the login/sync settles.
  // Best-effort: no-ops if logged out.
  try {
    setTimeout(() => { projectAll().catch(() => {}); }, 4500);
  } catch (_) {}
})();
