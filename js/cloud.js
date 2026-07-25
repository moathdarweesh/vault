// Cloud sync + auth for THE VAULT — Supabase (email/password).
// All app data lives in ONE localStorage key (gym_tracker_v1), so syncing is
// just: push that blob up on change, pull it down on login. One row per user
// in the `vault_data` table, protected by Row Level Security.
//
// SETUP: create a free Supabase project, run backend/supabase-setup.sql, then
// paste your Project URL + anon key below. The anon key is PUBLIC and safe to
// ship — RLS makes sure each user only ever touches their own row.
(function () {
  'use strict';

  // ---- config (fill these from Supabase → Project Settings → API) ----------
  const SUPABASE_URL = 'https://ilmusnuchqlpirywonzx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ZBR2VENMP2O_K2YTMePCsw_NfLC9FSI';
  const TABLE = 'vault_data';
  const STORE_KEY = 'gym_tracker_v1'; // must match storage.js STORAGE_KEY

  const configured = () =>
    /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 30;

  // The Supabase SDK (~200KB) is loaded ON DEMAND — only when an account is
  // actually configured/used — so it never slows down app startup otherwise.
  let sdkPromise = null;
  function ensureSdk() {
    if (window.supabase) return Promise.resolve(true);
    if (!configured()) return Promise.resolve(false);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/supabase.js';
      s.onload = () => resolve(true);
      // On failure, clear the cached promise so a later call can retry instead
      // of being stuck with a permanent "false".
      s.onerror = () => { sdkPromise = null; resolve(false); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  let client = null;
  function sb() {
    if (client) return client;
    if (!configured() || !window.supabase) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return client;
  }

  // ---- whole-state snapshot/restore ----------------------------------------
  const exportRaw = () => { try { return localStorage.getItem(STORE_KEY); } catch (_) { return null; } };

  // Validate a parsed blob before writing it to localStorage.
  // Mirrors DB._validateBlob — only requires keys that must exist; optional
  // arrays are checked only when present so old backups still apply cleanly.
  function validateBlob(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!Array.isArray(data.exercises)) return false;
    if ('sessions' in data && !Array.isArray(data.sessions)) return false;
    if ('cardio' in data && !Array.isArray(data.cardio)) return false;
    if ('supplements' in data && !Array.isArray(data.supplements)) return false;
    return true;
  }

  function importRaw(raw) {
    try {
      // Guard: parse and validate shape before touching localStorage so a
      // corrupt or hostile remote blob can never replace good local state.
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_) { return false; }
      if (!validateBlob(parsed)) return false;
      // Apply the SAME id-charset check the file-import path uses. Entity ids are
      // interpolated into data-* attributes all over the render layer, so an id
      // like `"><img onerror=...>` is an attribute-breakout XSS. A cloud blob is
      // not automatically trustworthy: it is whatever some device uploaded, and a
      // tampered export can be restored to the account and then synced down here.
      try {
        if (typeof DB !== 'undefined' && DB._idsSafe && !DB._idsSafe(parsed)) return false;
      } catch (_) { return false; }
      localStorage.setItem(STORE_KEY, raw);
      if (typeof DB !== 'undefined' && DB.reload) DB.reload();
      return true;
    } catch (_) { return false; }
  }
  // Does a parsed blob hold real USER data (vs a fresh install / a post-reset
  // default state)? A reset/default blob still has the seeded exercise catalog
  // and an empty plan, so "has keys" is NOT enough — we look for user-generated
  // content: logged sessions/cardio/sleep, foods, food/supplement logs, own
  // supplements, or a custom exercise. Used both to detect a real local store
  // AND to protect a data-ful cloud backup from being overwritten by an empty one.
  function blobHasUserData(b) {
    try {
      if (!b || typeof b !== 'object') return false;
      return !!(
        (b.sessions && b.sessions.length) || (b.cardio && b.cardio.length) ||
        (b.sleep && b.sleep.length) || (b.foods && b.foods.length) ||
        (b.foodLogs && Object.keys(b.foodLogs).length) ||
        (b.supplements && b.supplements.length) ||
        (b.supplementLogs && Object.keys(b.supplementLogs).length) ||
        (b.exercises && b.exercises.some((e) => e && e.isCustom)) ||
        // Standalone tracking that isn't sessions/food — a device whose ONLY
        // content is these must NOT be treated as "empty" (else its plan / weight
        // / water / nutrition goal gets silently overwritten on first login and
        // never syncs up). Matches the new Weight/Water features.
        (b.bodyweight && b.bodyweight.length) ||
        (b.water && Object.keys(b.water).length) ||
        (b.cardioTypes && b.cardioTypes.length) ||
        (b.plan && Array.isArray(b.plan.cycle) && b.plan.cycle.length) ||
        (b.nutrition && b.nutrition.targets && b.nutrition.targets.calories)
      );
    } catch (_) { return false; }
  }
  // Does local hold real user data (vs a fresh/empty install)?
  function localHasData() {
    try { return blobHasUserData(JSON.parse(exportRaw() || '{}')); } catch (_) { return false; }
  }

  // ---- auth ----------------------------------------------------------------
  async function getSession() {
    const c = sb(); if (!c) return null;
    try { const { data } = await c.auth.getSession(); return data && data.session; }
    catch (_) { return null; }
  }
  async function currentEmail() {
    const s = await getSession();
    return s && s.user ? s.user.email : null;
  }
  async function signUp(email, password) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    const { data, error } = await c.auth.signUp({ email: email.trim(), password });
    if (error) return { error: error.message };
    // If email confirmation is OFF, a session is returned immediately.
    return { user: data.user, session: data.session };
  }
  async function signIn(email, password) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    return { user: data.user, session: data.session };
  }
  async function signOut() {
    const c = sb(); if (!c) return;
    try { await c.auth.signOut(); } catch (_) {}
  }
  // Change the signed-in user's password.
  async function changePassword(newPassword, currentPassword) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    // Require re-authentication with the CURRENT password so a briefly-unlocked
    // or shared logged-in device can't silently change it and lock the owner out.
    try {
      const email = await currentEmail();
      if (!email || !currentPassword) return { error: 'reauth_failed' };
      const { error: reauthErr } = await c.auth.signInWithPassword({ email, password: currentPassword });
      if (reauthErr) return { error: 'reauth_failed' };
    } catch (_) { return { error: 'reauth_failed' }; }
    const { error } = await c.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { ok: true };
  }
  // Send a password-reset email. The link opens the web app, which then fires a
  // PASSWORD_RECOVERY event (see onPasswordRecovery) so the user can set a new one.
  async function resetPassword(email) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    const redirectTo = 'https://moathdarweesh.github.io/vault/';
    const { error } = await c.auth.resetPasswordForEmail((email || '').trim(), { redirectTo });
    if (error) return { error: error.message };
    return { ok: true };
  }
  // Fire `cb` when the app is opened from a password-reset link.
  function onPasswordRecovery(cb) {
    const c = sb(); if (!c) return;
    try { c.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') cb(); }); } catch (_) {}
  }

  // ---- per-device sync state (persisted so it survives app restarts) -------
  const stampKey = (uid) => 'vault_synced_' + uid;
  const linkedKey = (uid) => 'vault_linked_' + uid;
  const dirtyKey = (uid) => 'vault_dirty_' + uid; // local edits not yet pushed
  const getStamp = (uid) => { try { return localStorage.getItem(stampKey(uid)) || ''; } catch (_) { return ''; } };
  const setStamp = (uid, iso) => { try { localStorage.setItem(stampKey(uid), iso || ''); } catch (_) {} };
  const isLinked = (uid) => { try { return !!localStorage.getItem(linkedKey(uid)); } catch (_) { return false; } };
  // Remember the last linked user id so onLocalChange can flag unsynced edits as
  // "dirty" EVEN when getSession() is momentarily null (SDK still loading on boot,
  // or an offline-expired token). Without this a workout logged in that window was
  // never marked dirty and got silently overwritten by the next bootSync pull.
  const LAST_UID_KEY = 'vault_last_uid';
  const setLastUid = (uid) => { try { if (uid) localStorage.setItem(LAST_UID_KEY, uid); } catch (_) {} };
  const getLastUid = () => { try { return localStorage.getItem(LAST_UID_KEY) || ''; } catch (_) { return ''; } };
  const markLinked = (uid) => { try { localStorage.setItem(linkedKey(uid), '1'); setLastUid(uid); } catch (_) {} };
  const isDirty = (uid) => { try { return !!localStorage.getItem(dirtyKey(uid)); } catch (_) { return false; } };
  const setDirty = (uid, v) => { try { v ? localStorage.setItem(dirtyKey(uid), '1') : localStorage.removeItem(dirtyKey(uid)); } catch (_) {} };
  // Optimistic-concurrency base version (the vault_data.version we last saw). Only
  // set once the server actually returns a numeric version (i.e. after the
  // vault-data-version.sql migration); until then it stays null and push() falls
  // back to the previous last-writer-wins upsert.
  const verKey = (uid) => 'vault_ver_' + uid;
  const getVersion = (uid) => { try { const v = localStorage.getItem(verKey(uid)); return v == null ? null : Number(v); } catch (_) { return null; } };
  const setVersion = (uid, v) => { try { if (typeof v === 'number' && isFinite(v)) localStorage.setItem(verKey(uid), String(v)); } catch (_) {} };

  // Compare two ISO timestamps by real time, NOT string order — Supabase returns
  // `+00:00` microsecond timestamps while the client writes `...Z` ms timestamps,
  // so a lexicographic `>` would be wrong. Returns true if `a` is strictly newer.
  function newer(a, b) {
    const ta = Date.parse(a || ''); const tb = Date.parse(b || '');
    if (!isFinite(ta)) return false;
    if (!isFinite(tb)) return true;
    return ta > tb;
  }
  // Does a remote blob actually hold data (vs null / {})?
  const remoteHasData = (remote) =>
    !!(remote && remote.data && typeof remote.data === 'object' && Object.keys(remote.data).length > 0);

  // ---- sync ----------------------------------------------------------------
  // Returns undefined (offline / no session), null (no row yet), or
  // { data, updatedAt }.
  async function pull() {
    const c = sb(); const s = await getSession();
    if (!c || !s) return undefined;
    // select('*') so we also pick up `version` when it exists, without naming a
    // column that may not exist yet (which would error pre-migration).
    const { data, error } = await c.from(TABLE).select('*').eq('user_id', s.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      data: data.data || null,
      updatedAt: data.updated_at || '',
      version: (typeof data.version === 'number' ? data.version : null),
    };
  }
  // Clear the "unpushed local changes" flag ONLY if the bytes we just uploaded are
  // still the current bytes. A push is asynchronous: the user can log a set while
  // it is in flight. Unconditionally clearing the flag afterwards marks that newer
  // edit as already-synced, so it is never pushed — and a later pull silently
  // overwrites it. If the store moved on, we leave the flag set and the debounced
  // push picks it up.
  function clearDirtyIfUnchanged(uid, uploadedRaw) {
    try {
      if (exportRaw() !== uploadedRaw) return;   // changed mid-flight → stay dirty
    } catch (_) { return; }                      // can't tell → assume dirty (safe)
    setDirty(uid, false);
  }

  async function push(opts) {
    const force = !!(opts && opts.force);
    const c = sb(); const s = await getSession();
    // NOT a success: there is no session (signed out, or the token could not be
    // refreshed — e.g. offline past expiry). Callers that gate a DESTRUCTIVE
    // action on "did this upload?" MUST treat this as a failure, or they will
    // discard local data that was never sent. The fire-and-forget callers below
    // ignore the return value, so naming it is safe.
    if (!c || !s) return 'nosession';
    const raw = exportRaw();
    let blob; try { blob = JSON.parse(raw || '{}'); } catch (_) { blob = {}; }
    // SAFETY GUARD (data-loss protection): never SILENTLY overwrite a cloud backup
    // that holds real user data with a local blob that holds NONE. That is exactly
    // what a "Reset all data", an import of an empty/other backup, or a corrupted
    // store would otherwise do — destroying the user's only backup 1.2s later.
    // We still allow it when the user EXPLICITLY forces it (chose "my device wins"),
    // and it auto-allows again the moment the local store has real data. The dirty
    // flag is left set so a later data-ful change can still sync.
    if (!force && !blobHasUserData(blob)) {
      let remote;
      try { remote = await pull(); } catch (_) { remote = undefined; }
      if (remote && blobHasUserData(remote.data)) {
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vault:push-blocked')); } catch (_) {}
        return 'blocked';
      }
    }
    // Strip base64 custom-exercise images from the UPLOADED payload — but only for
    // images that already have a durable bucket copy (imagePath is set ONLY after a
    // successful backup, so its presence guarantees the image is safe in the
    // exercise-images bucket). The base64 STAYS in localStorage (offline render is
    // untouched); on another device the pulled blob carries imagePath and
    // syncExerciseImages() rehydrates the base64 from the bucket. This cuts the
    // synced payload by an order of magnitude without losing any image: an
    // un-backed-up image keeps its base64 in the upload, so it is never dropped
    // before the bucket has it.
    let payload = blob;
    if (blob && Array.isArray(blob.exercises) &&
        blob.exercises.some((e) => e && e.customImage && e.imagePath)) {
      payload = Object.assign({}, blob, {
        exercises: blob.exercises.map((e) => {
          if (e && e.customImage && e.imagePath) {
            const copy = Object.assign({}, e);
            delete copy.customImage;
            return copy;
          }
          return e;
        }),
      });
    }
    const iso = new Date().toISOString();
    const uid = s.user.id;
    const known = getVersion(uid);
    // OPTIMISTIC CONCURRENCY: when we know the base version, write CONDITIONALLY on
    // the row still being at it (atomic integer compare — no timestamp-format
    // fragility). A real conflict (another device advanced the row) is DETECTED and
    // NOT clobbered: we keep our edits local (dirty stays set) and let the next
    // bootSync resolve it. Any error or unknown version falls through to the plain
    // upsert below, so this path is never worse than the old last-writer-wins.
    if (!force && known != null) {
      try {
        const { data: updated, error: updErr } = await c.from(TABLE)
          .update({ data: payload, updated_at: iso })
          .eq('user_id', uid).eq('version', known)
          .select('*');
        if (!updErr) {
          if (updated && updated.length) {
            if (typeof updated[0].version === 'number') setVersion(uid, updated[0].version);
            setStamp(uid, iso); clearDirtyIfUnchanged(uid, raw); return 'ok';
          }
          // 0 rows matched: the remote moved ahead (conflict) or the row is gone.
          const { data: cur, error: curErr } = await c.from(TABLE)
            .select('*').eq('user_id', uid).maybeSingle();
          if (!curErr && cur) {
            try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vault:push-conflict')); } catch (_) {}
            return 'conflict'; // do NOT overwrite the newer remote
          }
          // no row exists → fall through to the insert path below
        }
      } catch (_) { /* fall through to the safe upsert */ }
    }
    const { data: up, error } = await c.from(TABLE).upsert(
      { user_id: uid, data: payload, updated_at: iso },
      { onConflict: 'user_id' }
    ).select('*');
    if (error) throw new Error(error.message);
    if (up && up[0] && typeof up[0].version === 'number') setVersion(uid, up[0].version);
    setStamp(uid, iso);
    clearDirtyIfUnchanged(uid, raw); // only if nothing changed while we uploaded
    return 'ok';          // the ONLY success value — callers gate on this explicitly
  }

  // Debounced push fired by storage.js save() after any local change.
  let pushTimer = null;
  let syncing = false; // suppress pushes while we are restoring from cloud
  async function onLocalChange() {
    if (syncing) return;
    // Mark unpushed changes DIRTY FIRST, using the last-linked uid — BEFORE any
    // await. If getSession() is momentarily null (SDK still loading on boot, or an
    // offline-expired token), the change is still flagged, so the next bootSync
    // returns 'conflict' instead of silently pulling an older cloud blob over it.
    const lastUid = getLastUid();
    if (lastUid) setDirty(lastUid, true);
    const s = await getSession(); if (!s) return; // only push when logged in
    setDirty(s.user.id, true); // (same uid in the normal case)
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push().catch(() => {}); }, 1200);
    // Also project the change into the normalized tables (best-effort mirror).
    if (window.Tables && Tables.scheduleProject) Tables.scheduleProject();
  }

  // Replace local data with the cloud blob — but NEVER overwrite a non-empty
  // local store with an empty cloud blob. Returns true only if it applied.
  function applyRemote(remote) {
    if (!remoteHasData(remote)) return false;
    syncing = true;
    clearTimeout(pushTimer);            // cancel any pending echo push
    // PROPAGATE the import result. importRaw() returns false when the remote blob
    // fails to parse or fails shape validation — and this used to discard that,
    // so a FAILED pull was reported as a success. Callers then advanced the sync
    // stamp and CLEARED the dirty flag, marking local edits as "safely synced"
    // when nothing had been applied at all: silent divergence, and the next boot
    // would not even retry the pull.
    const applied = importRaw(JSON.stringify(remote.data));
    syncing = false;
    return applied;
  }

  // Called right after a successful sign-in / sign-up. Decides what to do with
  // local-vs-cloud data. Returns one of:
  //   'offline'  — couldn't reach the cloud; kept local data
  //   'pushed'   — cloud was empty, seeded it from this device
  //   'pulled'   — replaced local with cloud data
  //   'conflict' — first link AND both sides have data; caller must ask
  async function resolveOnLogin() {
    const s = await getSession(); if (!s) return 'offline';
    const uid = s.user.id;
    let remote;
    try { remote = await pull(); } catch (_) { return 'offline'; }
    if (remote === undefined) return 'offline';
    const pushed = async () => {
      let r; try { r = await push(); } catch (_) { r = 'error'; }
      if (r !== 'ok') return 'offline';   // don't claim success for a failed push
      markLinked(uid); return 'pushed';
    };
    // Cloud empty (no row, or a row with no data) → seed it from this device.
    if (remote === null || !remoteHasData(remote)) return pushed();
    // Cloud has data AND this device has its own data, first time → ask the user.
    if (!isLinked(uid) && localHasData()) return 'conflict';
    if (applyRemote(remote)) { setStamp(uid, remote.updatedAt); setVersion(uid, remote.version); setDirty(uid, false); markLinked(uid); return "pulled"; }
    return pushed();
  }
  // Conflict resolution choices (first link only).
  async function chooseCloud() {
    const s = await getSession(); if (!s) return;
    let remote;
    try { remote = await pull(); } catch (_) { return; }
    // Only commit to "cloud wins" if the cloud actually had data to apply.
    if (applyRemote(remote)) { setStamp(s.user.id, remote.updatedAt); setVersion(s.user.id, remote.version); setDirty(s.user.id, false); markLinked(s.user.id); }
    else { await push(); markLinked(s.user.id); } // cloud was empty → keep local
  }
  async function chooseLocal() {
    const s = await getSession(); if (!s) return;
    // Explicit user override ("my device wins") — force past the empty-blob guard.
    await push({ force: true }); markLinked(s.user.id);
  }

  // Background sync on app boot for an already-linked, logged-in device. Uses a
  // persisted "dirty" flag so it never silently loses data:
  //   - remote newer & no local edits  → pull
  //   - remote newer & local edits too  → conflict (let the user choose)
  //   - otherwise                       → push our local up
  async function bootSync() {
    const s = await getSession(); if (!s) return 'offline';
    const uid = s.user.id;
    let remote;
    try { remote = await pull(); } catch (_) { return 'offline'; }
    if (remote === undefined) return 'offline';
    // Report the REAL push outcome: this used to swallow every failure and return
    // 'pushed' regardless, so the UI said "Synced" after a push that was blocked,
    // conflicted, or never ran. 'offline' is an already-handled honest status.
    const pushed = async () => {
      let r; try { r = await push(); } catch (_) { r = 'error'; }
      if (r !== 'ok') return 'offline';
      markLinked(uid); return 'pushed';
    };
    if (remote === null || !remoteHasData(remote)) return pushed();
    const remoteNewer = newer(remote.updatedAt, getStamp(uid));
    // RECOVERY: this device has no user data but the cloud does. Timestamps alone
    // would never trigger a pull here (a local reset/corrupt-load leaves a recent
    // stamp), stranding the device empty next to a full backup. Pull it back.
    const localEmpty = !localHasData();
    if (remoteNewer && isDirty(uid) && !localEmpty) return 'conflict'; // both changed → ask
    if (remoteNewer || localEmpty) {
      if (applyRemote(remote)) { setStamp(uid, remote.updatedAt); setVersion(uid, remote.version); setDirty(uid, false); markLinked(uid); return "pulled"; }
      return 'offline';
    }
    return pushed();
  }

  // ---- username (public unique handle) ------------------------------------
  // Read the signed-in user's handle from profiles. Returns { username, offline }.
  // offline=true means we couldn't reach the server (or aren't logged in) — the
  // caller must NOT force a username in that case.
  async function getUsername() {
    const c = sb(); const s = await getSession();
    if (!c || !s) return { username: null, offline: true };
    try {
      const { data, error } = await c
        .from('profiles').select('username').eq('user_id', s.user.id).maybeSingle();
      if (error) throw error;
      return { username: (data && data.username) || null, offline: false };
    } catch (_) { return { username: null, offline: true }; }
  }
  // Live availability check via the server RPC (also validates the shape server-side).
  async function checkUsername(name) {
    const c = sb(); if (!c) return { available: false, offline: true };
    try {
      const { data, error } = await c.rpc('username_available', { candidate: name });
      if (error) throw error;
      return { available: data === true, offline: false };
    } catch (_) { return { available: false, offline: true }; }
  }
  // Claim a handle. A unique-violation (someone took it first) comes back as
  // { taken:true }; the DB check constraint rejects a bad shape.
  async function setUsername(name) {
    const c = sb(); const s = await getSession();
    if (!c || !s) return { error: 'offline' };
    try {
      const { error } = await c.from('profiles')
        .upsert({ user_id: s.user.id, username: name }, { onConflict: 'user_id' });
      if (error) {
        if (/duplicate|unique/i.test(error.message)) return { taken: true };
        return { error: error.message };
      }
      return { ok: true };
    } catch (e) { return { error: (e && e.message) || 'error' }; }
  }

  // ---- last-seen (self-written "last active" stamp) -----------------------
  // Best-effort upsert of the user's OWN profiles.last_seen. Never throws and
  // never blocks the app — a failure just means the timestamp isn't refreshed.
  async function touchLastSeen() {
    const c = sb(); const s = await getSession();
    if (!c || !s) return;
    try {
      await c.from('profiles')
        .upsert({ user_id: s.user.id, last_seen: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (_) { /* ignore */ }
  }

  // ---- account flags (role + status) --------------------------------------
  // Reads the signed-in user's role/status from user_flags (admin-managed only).
  // Defaults to an ACTIVE regular user when absent or offline, so the app never
  // locks someone out on a transient error or before an admin ever set a flag.
  async function getMyFlags() {
    const c = sb(); const s = await getSession();
    if (!c || !s) return { role: 'user', status: 'active', reason: null, offline: true };
    try {
      const { data, error } = await c
        .from('user_flags').select('role,status,reason').eq('user_id', s.user.id).maybeSingle();
      if (error) throw error;
      return {
        role: (data && data.role) || 'user',
        status: (data && data.status) || 'active',
        reason: (data && data.reason) || null,
        offline: false,
      };
    } catch (_) { return { role: 'user', status: 'active', reason: null, offline: true }; }
  }

  // ---- global catalog (admin-managed content, public reads) ---------------
  // Best-effort pull of admin-curated GLOBAL content the app should surface
  // additively: the global exercise catalog (owner_id IS NULL), the shared
  // food catalog, ready-made preset plans, and the single app_config row.
  // These tables are readable by anon (RLS "public read"), so this works even
  // when the user is logged out. ANY failure (offline, not configured, a
  // table not existing yet) resolves that field to null — callers must treat
  // every field as optional and never let a failure here block boot.
  const CATALOG_CACHE_KEY = 'vault_catalog_cache';
  const CATALOG_TTL = 30 * 60 * 1000; // 30 min

  async function pullCatalog() {
    const result = { exercises: null, foods: null, presets: null, config: null };
    if (!configured()) return result;
    try { if (ensureSdk) await ensureSdk(); } catch (_) {}
    const c = sb();
    if (!c) return result;

    // The three HEAVY, rarely-changing catalog tables (global exercises, foods,
    // presets) are served from a short localStorage cache so 10k cold-loads AND
    // every app foreground (bootCatalog re-runs) don't each re-read three full
    // tables from Postgres. `config` (the announcement) is ALWAYS fetched fresh
    // below so admin broadcasts still appear promptly.
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || 'null'); } catch (_) {}
    if (cached && cached.t && (Date.now() - cached.t) < CATALOG_TTL) {
      result.exercises = cached.exercises || null;
      result.foods = cached.foods || null;
      result.presets = cached.presets || null;
    } else {
      try {
        const { data, error } = await c
          .from('exercises')
          .select('id,name,category,image_slug,machine_type')
          .is('owner_id', null)
          .is('deleted_at', null);
        if (!error && Array.isArray(data)) result.exercises = data;
      } catch (_) {}
      try {
        const { data, error } = await c
          .from('food_catalog')
          .select('id,name,serving,calories,protein,carbs')
          .is('deleted_at', null);
        if (!error && Array.isArray(data)) result.foods = data;
      } catch (_) {}
      try {
        const { data, error } = await c
          .from('preset_plans')
          .select('id,name,description,data,position')
          .is('deleted_at', null)
          .order('position', { ascending: true });
        if (!error && Array.isArray(data)) result.presets = data;
      } catch (_) {}
      // Only cache a successful fetch of the primary table — never cache a
      // transient total failure (which would starve the app for 30 min).
      if (result.exercises !== null) {
        try {
          localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
            t: Date.now(), exercises: result.exercises, foods: result.foods, presets: result.presets,
          }));
        } catch (_) {}
      }
    }
    try {
      const { data, error } = await c
        .from('app_config')
        .select('default_unit,announcement_ar,announcement_en,announcement_active,updated_at')
        .limit(1)
        .maybeSingle();
      if (!error && data) result.config = data;
    } catch (_) {}
    return result;
  }

  // ---- feedback / suggestions ---------------------------------------------
  // Insert the user's OWN feedback row (RLS enforces user_id = self). The
  // username is snapshotted so the admin inbox reads well even if it changes.
  async function submitFeedback(message, context) {
    const c = sb(); const s = await getSession();
    if (!c || !s) return { error: 'offline' };
    const msg = String(message || '').trim();
    if (!msg) return { error: 'empty' };
    let username = null;
    try { const u = await getUsername(); username = u.username; } catch (_) {}
    try {
      const { error } = await c.from('feedback')
        .insert({ user_id: s.user.id, username: username, message: msg, context: context || null });
      if (error) return { error: error.message };
      return { ok: true };
    } catch (e) { return { error: (e && e.message) || 'error' }; }
  }

  // ---- exercise image backup (Storage) -------------------------------------
  // Custom exercise images live as base64 in the blob so they render instantly
  // and keep working offline (the gym has no signal). A durable copy is ALSO
  // kept in the PRIVATE `exercise-images` bucket, because the blob is a single
  // mutable row with no history: when an empty local state once overwrote it,
  // every uploaded image was destroyed and the mirror never held them, so they
  // were unrecoverable. Everything here is best-effort — a failure leaves the
  // local base64 untouched, so trying to back an image up can never lose it.
  const IMAGE_BUCKET = 'exercise-images';

  function dataUrlToBlob(dataUrl) {
    const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
    if (!m) return null;
    try {
      const bin = atob(m[2]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: m[1] });
    } catch (_) { return null; }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  }

  // Upload (or replace) the durable copy; returns its storage path, else null.
  // The path always starts with the user's own id — the bucket's RLS requires
  // the first segment to equal auth.uid(), so a user can only write in their
  // own folder and can never read or clobber anyone else's image.
  async function backupExerciseImage(exerciseId, dataUrl) {
    const c = sb(); const s = await getSession();
    if (!c || !s || !exerciseId) return null;
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return null;
    // ONE stable key per exercise, always `.jpg`: the app only ever encodes
    // JPEG (resizeImageToDataUrl → canvas.toDataURL('image/jpeg')), and a fixed
    // extension means `upsert` REPLACES the previous image. Deriving the
    // extension from the mime type instead would strand the old object under a
    // different key the moment an image changed type — orphaned forever,
    // referenced by nothing and missed by any `{uid}/` cleanup sweep. The
    // bucket validates the real contentType below, not this extension.
    const path = `${s.user.id}/${exerciseId}.jpg`;
    try {
      const { error } = await c.storage.from(IMAGE_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type });
      return error ? null : path;
    } catch (_) { return null; }
  }

  // Pull a backed-up image back down as a data URL — used to heal an exercise
  // whose base64 was lost with the blob but whose durable copy survived.
  async function restoreExerciseImage(path) {
    const c = sb(); const s = await getSession();
    if (!c || !s || !path) return null;
    try {
      const { data, error } = await c.storage.from(IMAGE_BUCKET).download(path);
      if (error || !data) return null;
      return await blobToDataUrl(data);
    } catch (_) { return null; }
  }

  async function removeExerciseImage(path) {
    const c = sb(); const s = await getSession();
    if (!c || !s || !path) return;
    try { await c.storage.from(IMAGE_BUCKET).remove([path]); } catch (_) {}
  }

  // Wipe this device's local copy + per-user sync bookkeeping. Used on logout
  // (so a shared device doesn't leak the previous user's blob) and after account
  // deletion. A synced user restores from the cloud on next sign-in.
  function clearLocalUserData() {
    try {
      localStorage.removeItem('gym_tracker_v1');
      localStorage.removeItem(CATALOG_CACHE_KEY);
      localStorage.removeItem(LAST_UID_KEY);
      Object.keys(localStorage).forEach((k) => {
        if (/^vault_(synced|linked|dirty|ver)_/.test(k)) localStorage.removeItem(k);
      });
    } catch (_) {}
  }

  // GDPR / Play right-to-erasure. Sweeps the user's Storage objects (no DB
  // cascade covers the bucket), then the delete_own_account() RPC removes the
  // auth user + every row keyed to their uid (cascades), then we sign out and
  // wipe local. Throws on any hard failure so the UI can report it.
  async function deleteAccount() {
    const c = sb();
    if (!c) throw new Error('offline');
    const s = await getSession();
    const uid = s && s.user && s.user.id;
    if (!uid) throw new Error('not signed in');
    // 1) Sweep the user's own image objects (owner RLS).
    //
    // NOT best-effort any more. Storage objects are NOT covered by the account
    // cascade, so swallowing a failure here deletes the account while leaving the
    // user's photos sitting in the bucket — with the row that pointed at them
    // gone, nothing will ever clean them up, and the user was told their data was
    // erased. We retry once, then ABORT: the account still exists at this point,
    // so aborting is recoverable (the user simply tries again) whereas proceeding
    // is not.
    let sweepErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data: files, error: listErr } = await c.storage.from(IMAGE_BUCKET).list(uid, { limit: 1000 });
        if (listErr) throw new Error(listErr.message);
        if (files && files.length) {
          const { error: rmErr } = await c.storage.from(IMAGE_BUCKET).remove(files.map((f) => uid + '/' + f.name));
          if (rmErr) throw new Error(rmErr.message);
        }
        sweepErr = null;
        break;
      } catch (e) { sweepErr = e; }
    }
    if (sweepErr) throw new Error('could not remove your stored images — nothing was deleted, please try again');
    // 2) Delete the account + all data (cascades) via the definer RPC.
    const { error } = await c.rpc('delete_own_account');
    if (error) throw new Error(error.message || 'delete failed');
    // 3) End the session + clear the device.
    try { await c.auth.signOut(); } catch (_) {}
    clearLocalUserData();
  }

  window.Cloud = {
    configured, ensureSdk, getSession, currentEmail,
    signUp, signIn, signOut, changePassword, resetPassword, onPasswordRecovery,
    pull, push, onLocalChange,
    resolveOnLogin, chooseCloud, chooseLocal, bootSync, applyRemote,
    localHasData, // so the UI can tell an empty device from one that already has data
    getClient: sb, // exposed for the tables.js "mirror" projection (RLS-scoped)
    getUsername, checkUsername, setUsername,
    touchLastSeen, getMyFlags, submitFeedback,
    pullCatalog,
    backupExerciseImage, restoreExerciseImage, removeExerciseImage,
    deleteAccount, clearLocalUserData,
  };
})();
