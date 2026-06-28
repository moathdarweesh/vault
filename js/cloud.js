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
  function importRaw(raw) {
    try {
      localStorage.setItem(STORE_KEY, raw);
      if (typeof DB !== 'undefined' && DB.reload) DB.reload();
      return true;
    } catch (_) { return false; }
  }
  // Does local hold real user data (vs a fresh/empty install)?
  function localHasData() {
    try {
      const s = JSON.parse(exportRaw() || '{}');
      return (s.sessions && s.sessions.length) || (s.cardio && s.cardio.length) ||
        (s.sleep && s.sleep.length) || (s.foodLogs && Object.keys(s.foodLogs).length) ||
        (s.supplements && s.supplements.length) ||
        (s.exercises && s.exercises.some((e) => e.isCustom));
    } catch (_) { return false; }
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
  async function push() {
    const c = sb(); const s = await getSession();
    if (!c || !s) return;
    const raw = exportRaw();
    let blob; try { blob = JSON.parse(raw || '{}'); } catch (_) { blob = {}; }
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
    await push(); markLinked(s.user.id);
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

  window.Cloud = {
    configured, ensureSdk, getSession, currentEmail,
    signUp, signIn, signOut, changePassword, resetPassword, onPasswordRecovery,
    pull, push, onLocalChange,
    resolveOnLogin, chooseCloud, chooseLocal, bootSync, applyRemote,
  };
})();
