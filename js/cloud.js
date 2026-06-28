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
      s.onerror = () => resolve(false);
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

  // ---- per-device sync stamp (last point this device agreed with cloud) ----
  const stampKey = (uid) => 'vault_synced_' + uid;
  const linkedKey = (uid) => 'vault_linked_' + uid;
  const getStamp = (uid) => { try { return localStorage.getItem(stampKey(uid)) || ''; } catch (_) { return ''; } };
  const setStamp = (uid, iso) => { try { localStorage.setItem(stampKey(uid), iso || ''); } catch (_) {} };
  const isLinked = (uid) => { try { return !!localStorage.getItem(linkedKey(uid)); } catch (_) { return false; } };
  const markLinked = (uid) => { try { localStorage.setItem(linkedKey(uid), '1'); } catch (_) {} };

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
  }

  // Debounced push fired by storage.js save() after any local change.
  let pushTimer = null;
  let syncing = false; // suppress pushes while we are restoring from cloud
  async function onLocalChange() {
    if (syncing) return;
    const s = await getSession(); if (!s) return; // only sync when logged in
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push().catch(() => {}); }, 1200);
  }

  function applyRemote(remote) {
    syncing = true;
    importRaw(JSON.stringify(remote.data || {}));
    syncing = false;
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
    const remote = await pull();
    if (remote === undefined) return 'offline';
    if (remote === null) { await push(); markLinked(uid); return 'pushed'; }
    // remote row exists
    if (!isLinked(uid) && localHasData()) return 'conflict';
    applyRemote(remote); setStamp(uid, remote.updatedAt); markLinked(uid);
    return 'pulled';
  }
  // Conflict resolution choices (first link only).
  async function chooseCloud() {
    const s = await getSession(); if (!s) return;
    const remote = await pull();
    if (remote && remote.data) { applyRemote(remote); setStamp(s.user.id, remote.updatedAt); }
    markLinked(s.user.id);
  }
  async function chooseLocal() {
    const s = await getSession(); if (!s) return;
    await push(); markLinked(s.user.id);
  }

  // Background sync on app boot for an already-linked, logged-in device: pick up
  // changes made on other devices, and push anything made locally.
  async function bootSync() {
    const s = await getSession(); if (!s) return 'offline';
    const uid = s.user.id;
    let remote;
    try { remote = await pull(); } catch (_) { return 'offline'; }
    if (remote === undefined) return 'offline';
    if (remote === null) { await push().catch(() => {}); markLinked(uid); return 'pushed'; }
    if (remote.updatedAt && remote.updatedAt > getStamp(uid)) {
      applyRemote(remote); setStamp(uid, remote.updatedAt); markLinked(uid);
      return 'pulled';
    }
    await push().catch(() => {}); markLinked(uid);
    return 'pushed';
  }

  window.Cloud = {
    configured, ensureSdk, getSession, currentEmail,
    signUp, signIn, signOut, changePassword, resetPassword, onPasswordRecovery,
    pull, push, onLocalChange,
    resolveOnLogin, chooseCloud, chooseLocal, bootSync, applyRemote,
  };
})();
