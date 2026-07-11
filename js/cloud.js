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
        (b.exercises && b.exercises.some((e) => e && e.isCustom))
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
  async function changePassword(newPassword) {
    const c = sb(); if (!c) return { error: 'not_configured' };
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
  const markLinked = (uid) => { try { localStorage.setItem(linkedKey(uid), '1'); } catch (_) {} };
  const isDirty = (uid) => { try { return !!localStorage.getItem(dirtyKey(uid)); } catch (_) { return false; } };
  const setDirty = (uid, v) => { try { v ? localStorage.setItem(dirtyKey(uid), '1') : localStorage.removeItem(dirtyKey(uid)); } catch (_) {} };

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
    const { data, error } = await c.from(TABLE).select('data, updated_at').eq('user_id', s.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { data: data.data || null, updatedAt: data.updated_at || '' };
  }
  async function push(opts) {
    const force = !!(opts && opts.force);
    const c = sb(); const s = await getSession();
    if (!c || !s) return;
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
    const iso = new Date().toISOString();
    const { error } = await c.from(TABLE).upsert(
      { user_id: s.user.id, data: blob, updated_at: iso },
      { onConflict: 'user_id' }
    );
    if (error) throw new Error(error.message);
    setStamp(s.user.id, iso);
    setDirty(s.user.id, false); // our local edits are now safely in the cloud
  }

  // Debounced push fired by storage.js save() after any local change.
  let pushTimer = null;
  let syncing = false; // suppress pushes while we are restoring from cloud
  async function onLocalChange() {
    if (syncing) return;
    const s = await getSession(); if (!s) return; // only sync when logged in
    setDirty(s.user.id, true); // mark unpushed local changes (persists offline)
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
    importRaw(JSON.stringify(remote.data));
    syncing = false;
    return true;
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
    // Cloud empty (no row, or a row with no data) → seed it from this device.
    if (remote === null || !remoteHasData(remote)) { await push(); markLinked(uid); return 'pushed'; }
    // Cloud has data AND this device has its own data, first time → ask the user.
    if (!isLinked(uid) && localHasData()) return 'conflict';
    if (applyRemote(remote)) { setStamp(uid, remote.updatedAt); setDirty(uid, false); markLinked(uid); return 'pulled'; }
    await push(); markLinked(uid); return 'pushed';
  }
  // Conflict resolution choices (first link only).
  async function chooseCloud() {
    const s = await getSession(); if (!s) return;
    let remote;
    try { remote = await pull(); } catch (_) { return; }
    // Only commit to "cloud wins" if the cloud actually had data to apply.
    if (applyRemote(remote)) { setStamp(s.user.id, remote.updatedAt); setDirty(s.user.id, false); markLinked(s.user.id); }
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
    if (remote === null || !remoteHasData(remote)) { await push().catch(() => {}); markLinked(uid); return 'pushed'; }
    const remoteNewer = newer(remote.updatedAt, getStamp(uid));
    if (remoteNewer && isDirty(uid)) return 'conflict'; // both changed → ask
    if (remoteNewer) {
      if (applyRemote(remote)) { setStamp(uid, remote.updatedAt); setDirty(uid, false); markLinked(uid); return 'pulled'; }
      return 'offline';
    }
    await push().catch(() => {}); markLinked(uid); return 'pushed';
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

  window.Cloud = {
    configured, ensureSdk, getSession, currentEmail,
    signUp, signIn, signOut, changePassword, resetPassword, onPasswordRecovery,
    pull, push, onLocalChange,
    resolveOnLogin, chooseCloud, chooseLocal, bootSync, applyRemote,
    getClient: sb, // exposed for the tables.js "mirror" projection (RLS-scoped)
    getUsername, checkUsername, setUsername,
    touchLastSeen, getMyFlags, submitFeedback,
  };
})();
