// Cloud sync + auth for THE VAULT — Supabase (email/password).
// All app data lives in ONE localStorage key (gym_tracker_v1), so syncing is
// just: push that blob up on change, pull it down on login. One row per user
// in the `vault_data` table, protected by Row Level Security.
//
// SETUP: create a free Supabase project, run backend/migrations/01_supabase-setup.sql, then
// paste your Project URL + anon key below. The anon key is PUBLIC and safe to
// ship — RLS makes sure each user only ever touches their own row.
// ONE REGISTRY for every localStorage key this app owns. cloud.js is the first
// script, so every later file reads VAULT_KEYS instead of spelling a key; the
// pre-commit contract check (scripts/check-contracts.js) refuses a literal copy
// anywhere else. Prefix keys (ending in '_') take an id or a uid after them.
// The two inline scripts in index.html run BEFORE this file and must spell the
// `ui` key themselves — the check compares that one literal against `ui`.
window.VAULT_KEYS = Object.freeze({
  store: 'gym_tracker_v1',                 // the whole app state, one JSON blob
  corrupt: 'gym_tracker_v1__corrupt',      // an unparseable blob, kept for rescue
  img: 'vault_img_',                       // + exerciseId → photo data URL (side store)
  imgAt: 'vault_img_at_',                  // + exerciseId → the photo's stamp
  ui: 'vault_ui',                          // pre-paint mirror of prefs (theme, lang, nav labels)
  lastUid: 'vault_last_uid',
  recovery: 'vault_pre_sync_backup',       // the rescue copy taken before an overwrite
  recoveryFailed: 'vault_pre_sync_backup_failed',
  catalog: 'vault_catalog_cache',
  foodaiCache: 'foodai_cache',
  announcement: 'vault_announcement_dismissed',
  reminderSeen: 'vault_reminder_seen',
  hcPrompted: 'hc_prompted',
  pushing: 'vault_pushing_',               // + uid — the four per-account sync stamps
  synced: 'vault_synced_',
  linked: 'vault_linked_',
  dirty: 'vault_dirty_',
  ver: 'vault_ver_',
  notifDay: 'vault.notif.day.v1',          // DB.notif — the reminder side store (per device, per account)
  notifLog: 'vault.notif.log.v1',
  notifArmed: 'vault.notif.armed.v1',
  unitSeeded: 'vault_default_unit_seeded_v1',
  updateDismissed: 'vault_update_dismissed_build',   // js/update.js — per DEVICE, deliberately not swept on logout
  webReloadGuard: 'vault_wr_',                        // js/update.js — sessionStorage, + target build: one auto-reload per session per target
});
(function () {
  'use strict';

  // ---- config (fill these from Supabase → Project Settings → API) ----------
  const SUPABASE_URL = 'https://ilmusnuchqlpirywonzx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ZBR2VENMP2O_K2YTMePCsw_NfLC9FSI';
  const TABLE = 'vault_data';
  const STORE_KEY = VAULT_KEYS.store;

  const configured = () =>
    /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 30;

  // This file's own ?v=N, captured at load time (document.currentScript is only
  // valid during synchronous execution, so it cannot be read later from inside a
  // function). Used to cache-bust the vendored SDK below.
  const SELF_V = (() => {
    try {
      const src = (document.currentScript && document.currentScript.src) || '';
      const m = src.match(/[?&]v=(\d+)/);
      return m ? '?v=' + m[1] : '';
    } catch (_) { return ''; }
  })();

  // The Supabase SDK (~200KB) is loaded ON DEMAND — only when an account is
  // actually configured/used — so it never slows down app startup otherwise.
  let sdkPromise = null;
  function ensureSdk() {
    if (window.supabase) return Promise.resolve(true);
    if (!configured()) return Promise.resolve(false);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      // Carry the build marker. This was the ONE shipped file with no ?v=N, so a
      // device that cached it kept the old SDK indefinitely — a vendored-library
      // update (including a security fix) could never reach it. Derived from this
      // file's own marker so it always matches index.html's preload, which would
      // otherwise be wasted on a different URL.
      s.src = 'js/vendor/supabase.js' + SELF_V;
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
  // The blob has ONE definition of well-formed, and it lives with the blob's
  // owner: DB._validateBlob in storage.js. This used to be a second copy that
  // had drifted (it checked mealBundles/recipes; the import path did not), so a
  // file could import and then fail to sync. storage.js loads after this file
  // but before anything can call validateBlob, so delegating is safe; the
  // fallback only exists so a truly broken boot fails closed, not open.
  function validateBlob(data) {
    if (typeof DB !== 'undefined' && DB._validateBlob) return DB._validateBlob(data);
    return false;
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
  // Both live in storage.js now (DB._notifHasUserContent / DB.hasUserData): the
  // blob's owner decides what counts as user data, and the two other places
  // that had re-typed this list (seedDefaultUnitIfNew, and this file) ask it.
  function _notifHasUserContent(n) { return (typeof DB !== 'undefined' && DB._notifHasUserContent) ? DB._notifHasUserContent(n) : false; }
  function blobHasUserData(b) { return (typeof DB !== 'undefined' && DB.hasUserData) ? DB.hasUserData(b) : false; }
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
  // ---- Turnstile ---------------------------------------------------------
  // Bot protection on the three unauthenticated doors: sign-up, sign-in and
  // password reset. Sign-up is open, so without this one script can farm
  // accounts, and every account carries its own slice of the shared AI budget
  // and storage — which is what makes a ban undoable by re-registering.
  //
  // The SITE key is public by design (it identifies the widget to Cloudflare and
  // is visible in the page source of every site that uses Turnstile). The SECRET
  // key lives only in the Supabase dashboard and is never in this repo.
  const CAPTCHA_SITE_KEY = '0x4AAAAAAEqRei1h4Kv8R2yP';
  const CAPTCHA_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  let capScript = null, capWidget = null, capToken = '', capWaiters = [];

  function loadCaptcha() {
    if (capScript) return capScript;
    capScript = new Promise((resolve, reject) => {
      if (window.turnstile) return resolve(window.turnstile);
      const s = document.createElement('script');
      s.src = CAPTCHA_API; s.async = true; s.defer = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => reject(new Error('captcha_unreachable'));
      document.head.appendChild(s);
      // A blocked or very slow challenges.cloudflare.com must not leave the
      // sign-in button spinning forever with no explanation.
      setTimeout(() => reject(new Error('captcha_unreachable')), 15000);
    });
    return capScript;
  }

  function settleCaptcha(tok) {
    capToken = tok || '';
    const w = capWaiters; capWaiters = [];
    w.forEach((fn) => { try { fn(capToken); } catch (_) {} });
  }

  // Draw the widget into `el`. Safe to call again — the old one is removed
  // first, which is what a language switch or a sign-in ⇄ sign-up flip does.
  async function mountCaptcha(el, opts) {
    if (!el) return;
    const ts = await loadCaptcha();
    if (!ts) return;
    unmountCaptcha();
    capToken = '';
    capWidget = ts.render(el, {
      sitekey: CAPTCHA_SITE_KEY,
      theme: (opts && opts.theme) || 'auto',
      language: (opts && opts.lang) || 'auto',
      callback: (tok) => settleCaptcha(tok),
      // A token is single-use and expires after about five minutes. Both of
      // these clear it so the next attempt asks for a fresh one instead of
      // replaying a dead token, which Supabase rejects as a failed challenge.
      'expired-callback': () => settleCaptcha(''),
      'error-callback': () => settleCaptcha(''),
    });
  }

  function unmountCaptcha() {
    try { if (capWidget !== null && window.turnstile) window.turnstile.remove(capWidget); } catch (_) {}
    capWidget = null; capToken = '';
  }

  // The token for ONE attempt. Managed mode usually solves in about a second
  // without the user doing anything, so this waits rather than failing fast.
  function captchaToken(timeoutMs) {
    if (capToken) return Promise.resolve(capToken);
    if (capWidget === null) return Promise.resolve('');   // never mounted: send nothing
    return new Promise((resolve) => {
      capWaiters.push(resolve);
      setTimeout(() => {
        const i = capWaiters.indexOf(resolve);
        if (i >= 0) { capWaiters.splice(i, 1); resolve(''); }
      }, timeoutMs || 20000);
    });
  }

  // Spend the token and ask for a new one: it is valid for a single call.
  function resetCaptcha() {
    capToken = '';
    try { if (capWidget !== null && window.turnstile) window.turnstile.reset(capWidget); } catch (_) {}
  }

  // `captchaToken` is ignored by Supabase until CAPTCHA is switched on in the
  // dashboard, so this client is safe to ship before that switch — and MUST be
  // shipped before it, or every sign-in is refused for a missing challenge.
  const withCaptcha = (tok) => (tok ? { captchaToken: tok } : {});

  async function signUp(email, password, tok) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: withCaptcha(tok) });
    if (error) return { error: error.message };
    // If email confirmation is OFF, a session is returned immediately.
    return { user: data.user, session: data.session };
  }
  async function signIn(email, password, tok) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password, options: withCaptcha(tok) });
    if (error) return { error: error.message };
    return { user: data.user, session: data.session };
  }
  async function signOut() {
    const c = sb(); if (!c) return;
    try { await c.auth.signOut(); } catch (_) {}
  }
  // Change the signed-in user's password.
  async function changePassword(newPassword, currentPassword, recovery) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    // Require re-authentication with the CURRENT password so a briefly-unlocked
    // or shared logged-in device can't silently change it and lock the owner out.
    try {
      const email = await currentEmail();
      // A RECOVERY session is already proof of the mailbox — Supabase issued it
      // from the emailed link — so re-authenticating with the old password is
      // both impossible (the user forgot it) and unnecessary.
      if (recovery) return null;
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
  async function resetPassword(email, tok) {
    const c = sb(); if (!c) return { error: 'not_configured' };
    const redirectTo = 'https://moathdarweesh.github.io/vault/';
    const { error } = await c.auth.resetPasswordForEmail((email || '').trim(), Object.assign({ redirectTo }, withCaptcha(tok)));
    if (error) return { error: error.message };
    return { ok: true };
  }
  // Fire `cb` when the app is opened from a password-reset link.
  function onPasswordRecovery(cb) {
    const c = sb(); if (!c) return;
    try { c.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') cb(); }); } catch (_) {}
  }

  // ---- per-device sync state (persisted so it survives app restarts) -------
  const stampKey = (uid) => VAULT_KEYS.synced + uid;
  const linkedKey = (uid) => VAULT_KEYS.linked + uid;
  const dirtyKey = (uid) => VAULT_KEYS.dirty + uid; // local edits not yet pushed
  const getStamp = (uid) => { try { return localStorage.getItem(stampKey(uid)) || ''; } catch (_) { return ''; } };
  const setStamp = (uid, iso) => { try { localStorage.setItem(stampKey(uid), iso || ''); } catch (_) {} };
  // WHY DID THIS DEVICE SAY 'CONFLICT'? The dialog is a real question, but when
  // it keeps coming back the cause is in these four values and nothing else, and
  // until now none of them was recorded anywhere — leaving the answer to guesswork.
  // Numbers and booleans only (client_errors carries no user content by rule).
  function noteConflict(where, uid, remote) {
    try {
      const bits = [
        'at=' + where,
        'linked=' + (isLinked(uid) ? 1 : 0),
        'dirty=' + (isDirty(uid) ? 1 : 0),
        'localVer=' + String(getVersion(uid)),
        'remoteVer=' + String(remote && remote.version),
        'localStamp=' + String(getStamp(uid) || '').slice(0, 24),
        'remoteStamp=' + String((remote && remote.updatedAt) || '').slice(0, 24),
        'pushing=' + String(getPushing(uid) || '').slice(0, 24),
        'localHasData=' + (localHasData() ? 1 : 0),
      ].join(' ');
      reportError('sync-conflict', bits, 'cloud.js', 0);
    } catch (_) {}
  }
  const isLinked = (uid) => { try { return !!localStorage.getItem(linkedKey(uid)); } catch (_) { return false; } };
  // Remember the last linked user id so onLocalChange can flag unsynced edits as
  // "dirty" EVEN when getSession() is momentarily null (SDK still loading on boot,
  // or an offline-expired token). Without this a workout logged in that window was
  // never marked dirty and got silently overwritten by the next bootSync pull.
  const LAST_UID_KEY = VAULT_KEYS.lastUid;
  const setLastUid = (uid) => { try { if (uid) localStorage.setItem(LAST_UID_KEY, uid); } catch (_) {} };
  const getLastUid = () => { try { return localStorage.getItem(LAST_UID_KEY) || ''; } catch (_) { return ''; } };
  const markLinked = (uid) => { try { localStorage.setItem(linkedKey(uid), '1'); setLastUid(uid); } catch (_) {} };
  const isDirty = (uid) => { try { return !!localStorage.getItem(dirtyKey(uid)); } catch (_) { return false; } };
  const setDirty = (uid, v) => { try { v ? localStorage.setItem(dirtyKey(uid), '1') : localStorage.removeItem(dirtyKey(uid)); } catch (_) {} };
  // Optimistic-concurrency base version (the vault_data.version we last saw). Only
  // set once the server actually returns a numeric version (i.e. after the
  // vault-data-version.sql migration); until then it stays null and push() falls
  // back to the previous last-writer-wins upsert.
  const verKey = (uid) => VAULT_KEYS.ver + uid;
  const getVersion = (uid) => { try { const v = localStorage.getItem(verKey(uid)); return v == null ? null : Number(v); } catch (_) { return null; } };
  const setVersion = (uid, v) => { try { if (typeof v === 'number' && isFinite(v)) localStorage.setItem(verKey(uid), String(v)); } catch (_) {} };

  // ---- LAST-RESORT RECOVERY -----------------------------------------------
  // applyRemote() overwrites the WHOLE local blob. Every guard around it is an
  // attempt to be sure that is safe, and the audit found two ways to reach it
  // when it is not (a dismissed first-link dialog; a conflict resolved with
  // "keep the cloud copy" while local edits were stranded). Guards can be wrong;
  // a copy cannot. One snapshot, taken immediately before the overwrite, kept
  // under its own key so a wrong answer stays recoverable instead of final.
  //
  // ONE slot on purpose: this is an undo for the overwrite that just happened,
  // not a backup history. Keeping several would multiply a 40 KB blob against
  // the same localStorage quota whose exhaustion is itself a data-loss path.
  const RECOVERY_KEY = VAULT_KEYS.recovery;
  const RECOVERY_FAILED_KEY = VAULT_KEYS.recoveryFailed;
  // Keep `raw` (a whole-blob JSON string) as the one rescue slot.
  //
  // WITHOUT the base64 of images the bucket already holds: the snapshot is a
  // second full copy of the store, and with photos in it that was blob +
  // snapshot (+ a possible __corrupt copy) against one ~5 MB budget — so the
  // write failed, silently, on exactly the phones with the most to lose. An
  // image with imagePath is in the bucket and rehydrates from there.
  //
  // And a failed write is RECORDED, not swallowed: Settings can then say that
  // no pre-sync copy could be kept instead of quietly offering nothing.
  function snapshotRaw(raw, reason, uid) {
    try {
      // Nothing worth keeping, and never overwrite a good snapshot with an
      // empty one — the empty store IS the case you need the snapshot for.
      if (!raw || raw.length < 3) return false;
      let blob; try { blob = JSON.parse(raw); } catch (_) { return false; }
      if (!blobHasUserData(blob)) return false;
      // The raw blob carries NO photos since v291 (they live in the side store),
      // and the pull that follows this snapshot prunes/replaces the side store.
      // A photo with no bucket copy therefore exists nowhere but here — so the
      // rescue re-attaches exactly those, the way the upload does. Backed-up
      // ones are left out: the bucket is their durable copy and they are what
      // made a 3-MB rescue fail on the phones that needed it most.
      let keep = raw;
      if (Array.isArray(blob.exercises)) {
        let changed = false;
        const exercises = blob.exercises.map((e) => {
          if (!e) return e;
          if (e.customImage && e.imagePath) { changed = true; const copy = Object.assign({}, e); delete copy.customImage; return copy; }
          if (e.isCustom && !e.imagePath && !e.customImage && typeof DB !== 'undefined' && DB.exercises && DB.exercises.getImage) {
            const img = DB.exercises.getImage(e.id);
            if (img) { changed = true; return Object.assign({}, e, { customImage: img }); }
          }
          return e;
        });
        if (changed) keep = JSON.stringify(Object.assign({}, blob, { exercises }));
      }
      // Stamped with the account it belongs to. recoveryInfo()/restoreRecovery()
      // refuse a snapshot from any other uid, so a rescue taken under one account
      // can never be offered to — or force-pushed into — the next one.
      localStorage.setItem(RECOVERY_KEY, JSON.stringify({
        at: new Date().toISOString(), reason: String(reason || ''), raw: keep,
        // The session's uid when the caller has one: during a FIRST link the
        // snapshot is taken before markLinked(), so getLastUid() was still empty
        // and the rescue was stamped null — then refused a moment later.
        uid: uid || getLastUid() || null,
      }));
      try { localStorage.removeItem(RECOVERY_FAILED_KEY); } catch (_) {}
      return true;
    } catch (err) {
      // quota/private mode — never block the sync, but never hide it either
      try { console.warn('[VAULT] pre-sync snapshot could not be kept', err); } catch (_) {}
      try { localStorage.setItem(RECOVERY_FAILED_KEY, new Date().toISOString()); } catch (_) {}
      return false;
    }
  }
  function snapshotLocal(reason, uid) { return snapshotRaw(exportRaw(), reason, uid); }
  // ISO of the last snapshot that could NOT be written, or '' — for Settings.
  function recoveryFailedAt() {
    try { return localStorage.getItem(RECOVERY_FAILED_KEY) || ''; } catch (_) { return ''; }
  }
  // { at, reason, bytes } or null. Deliberately does NOT return the payload:
  // the UI only needs to know a rescue exists and when it was taken.
  // A snapshot from another account is not a rescue, it is a leak — treat it as
  // absent. A snapshot with no uid predates the stamp: only the signed-out state
  // may use one of those, so it cannot cross accounts either.
  function recoveryOwnedByCurrent(rec) {
    const cur = getLastUid() || null;
    const own = (rec && rec.uid) || null;
    return own ? own === cur : !cur;
  }
  function recoveryInfo() {
    try {
      const rec = JSON.parse(localStorage.getItem(RECOVERY_KEY) || 'null');
      if (!rec || !rec.raw) return null;
      if (!recoveryOwnedByCurrent(rec)) return null;
      return { at: rec.at || '', reason: rec.reason || '', bytes: rec.raw.length };
    } catch (_) { return null; }
  }
  // Put the snapshot back and push it. Returns true only if BOTH the local
  // restore and the upload succeeded — a restore that stays on one device is
  // half a rescue, and the next pull would undo it.
  async function restoreRecovery() {
    let rec;
    try { rec = JSON.parse(localStorage.getItem(RECOVERY_KEY) || 'null'); } catch (_) { return false; }
    if (!rec || !rec.raw) return false;
    if (!recoveryOwnedByCurrent(rec)) return false;
    // Swap: the blob we are about to replace becomes the new snapshot, so an
    // accidental restore is itself undoable.
    snapshotLocal('pre-restore', rec.uid || undefined);   // the rescue being restored belongs to this account (guarded above)
    if (!importRaw(rec.raw)) return false;
    const s = await getSession();
    if (s) { setDirty(s.user.id, true); try { await push({ force: true }); } catch (_) {} }
    return true;
  }

  // Compare two ISO timestamps by real time, NOT string order — Supabase returns
  // `+00:00` microsecond timestamps while the client writes `...Z` ms timestamps,
  // so a lexicographic `>` would be wrong. Returns true if `a` is strictly newer.
  function getPushing(uid) { try { return localStorage.getItem(VAULT_KEYS.pushing + uid) || ''; } catch (_) { return ''; } }
  function clearPushing(uid) { try { localStorage.removeItem(VAULT_KEYS.pushing + uid); } catch (_) {} }
  // Same instant, allowing for Supabase's microsecond '+00:00' form against the
  // client's millisecond 'Z' form.
  function sameInstant(a, b) {
    const ta = Date.parse(a || ''), tb = Date.parse(b || '');
    return isFinite(ta) && isFinite(tb) && ta === tb;   // our own iso is written back verbatim; a window could adopt ANOTHER device's row
  }
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

  // ONE PUSH AT A TIME. Six call sites reach this — the 1200ms debounce, the
  // retry chain, resume()/bootSync, resolveOnLogin, chooseLocal, logout — and
  // until now NOTHING serialized them. Two overlapping pushes both read the same
  // base version, the first bumps the row, and the second finds 0 rows matched
  // and reports a CONFLICT — against its own sibling. That is where
  // "في هذا الجهاز تعديلات لم تصل السحابة" kept coming from: not another device,
  // just this one racing itself. v275 made it visible by adding a second
  // automatic path (resume on every foreground) to a design that assumed one.
  //
  // Callers await the SAME in-flight promise rather than queueing a second
  // write: a push always sends the whole current blob, so a caller that arrives
  // mid-flight wants exactly what is already being sent. The dirty flag is the
  // safety net for anything typed after that snapshot — clearDirtyIfUnchanged
  // leaves it set, and the debounce fires again.
  let inFlight = null;
  function push(opts) {
    if (inFlight) return inFlight;
    // Announce success here rather than at each of pushOnce's three `return
    // 'ok'` sites — one place, and it cannot fall out of step with them. The
    // only listener is the conflict toast's latch, which must reopen once a
    // push lands again; without this a conflict the user simply dismissed would
    // silence every LATER conflict for the rest of the session, and a refusal
    // nobody is told about is worse than a refusal that nags.
    inFlight = pushOnce(opts)
      .then((r) => {
        if (r === 'ok') {
          try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vault:push-ok')); } catch (_) {}
        }
        return r;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  async function pushOnce(opts) {
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
    // Photos live in a side store now (storage.js), so exportRaw() carries none.
    // One that has NO bucket copy yet must still travel with the blob — it is
    // the only copy in the world besides this phone — so it is re-attached here
    // for the upload; a backed-up one (imagePath set) rehydrates from the
    // bucket on the other device, as before.
    if (typeof DB !== 'undefined' && DB.exercises && DB.exercises.getImage &&
        payload && Array.isArray(payload.exercises)) {
      let changed = false;
      const withImgs = payload.exercises.map((e) => {
        if (!(e && e.isCustom && !e.imagePath)) return e;
        const img = DB.exercises.getImage(e.id);
        if (!img) return e;
        changed = true;
        return Object.assign({}, e, { customImage: img });
      });
      if (changed) payload = Object.assign({}, payload, { exercises: withImgs });
    }
    const iso = new Date().toISOString();
    const uid = s.user.id;
    const known = getVersion(uid);
    // REMEMBER WHAT WE ARE ABOUT TO WRITE, BEFORE WRITING IT. If the process
    // dies after Postgres commits but before the response arrives, the row
    // carries this exact updated_at while the device still holds the old stamp,
    // the old version and dirty=1. The next bootSync saw "remote newer + local
    // dirty" and called it a conflict — against this device's own push — and
    // "keep account data" then discarded whatever was logged offline since.
    // bootSyncCore recognises this stamp and adopts the row instead.
    try { localStorage.setItem(VAULT_KEYS.pushing + uid, iso); } catch (_) {}
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
            setStamp(uid, iso); clearDirtyIfUnchanged(uid, raw); clearPushing(uid); markLinked(uid); return 'ok';   // a push that landed links the device
          }
          // 0 rows matched: the remote moved ahead (conflict) or the row is gone.
          const { data: cur, error: curErr } = await c.from(TABLE)
            .select('*').eq('user_id', uid).maybeSingle();
          if (!curErr && cur) {
            // SELF-CONFLICT: the row already holds exactly the bytes we were
            // trying to write, so a sibling push (or a retry of this same one)
            // got there first. Nothing was lost and nothing disagrees — adopt
            // the version it produced and report success. Alarming the user
            // here is what made the toast reappear "every little while".
            let same = false;
            try { same = JSON.stringify(cur.data) === JSON.stringify(payload); } catch (_) { same = false; }
            if (same) {
              if (typeof cur.version === 'number') setVersion(uid, cur.version);
              setStamp(uid, cur.updated_at || iso);
              clearDirtyIfUnchanged(uid, raw);
              clearPushing(uid);
              return 'ok';
            }
            // A REAL conflict: the remote holds something this device has never
            // seen. Do not overwrite it; let bootSync/resume resolve it.
            try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vault:push-conflict')); } catch (_) {}
            clearPushing(uid);   // the server answered: nothing of ours was committed
            noteConflict('push-version-moved', uid, cur);
            return 'conflict';
          }
          // no row exists → fall through to the insert path below
        }
      } catch (_) { /* fall through to the safe upsert */ }
    }
    const { data: up, error, status } = await c.from(TABLE).upsert(
      { user_id: uid, data: payload, updated_at: iso },
      { onConflict: 'user_id' }
    ).select('*');
    if (error) {
      // Only a genuine server answer proves nothing was committed. The SDK also
      // hands back {error} for a request that never got a response (status 0,
      // no PostgREST code) — that outcome is unknown, and the stamp must stay.
      if (error.code || (typeof status === 'number' && status > 0)) clearPushing(uid);
      throw new Error(error.message);
    }
    if (up && up[0] && typeof up[0].version === 'number') setVersion(uid, up[0].version);
    clearPushing(uid);
    setStamp(uid, iso);
    clearDirtyIfUnchanged(uid, raw); // only if nothing changed while we uploaded
    return 'ok';          // the ONLY success value — callers gate on this explicitly
  }

  // Debounced push fired by storage.js save() after any local change.
  let pushTimer = null;
  let syncing = false; // suppress pushes while we are restoring from cloud

  // ---- RETRY ---------------------------------------------------------------
  // The debounce used to be the only automatic push, it fired ONCE per change,
  // and it discarded its own failure (`push().catch(() => {})`). One dropped
  // packet in the gym and the set stayed on the phone until the next COLD start
  // — while the app had already told the user, in their own language, that
  // "sync resumes when you reconnect".
  //
  // Only TRANSIENT outcomes are retried. A 'conflict' must NOT be: the remote
  // genuinely moved ahead and retrying would just conflict again. That one is
  // surfaced to the user instead (see the vault:push-conflict listener).
  const RETRY_MS = [4000, 15000, 60000, 180000];
  let retryTimer = null;
  let retryStep = 0;
  function cancelRetry() { clearTimeout(retryTimer); retryTimer = null; retryStep = 0; }
  function scheduleRetry() {
    if (retryTimer) return;                       // one chain, not one per edit
    const wait = RETRY_MS[Math.min(retryStep, RETRY_MS.length - 1)];
    retryStep++;
    retryTimer = setTimeout(() => { retryTimer = null; runPush(); }, wait);
  }
  // The single place a background push is fired and its outcome acted on.
  async function runPush() {
    if (syncing) return 'busy';
    let r;
    try { r = await push(); } catch (_) { r = 'error'; }
    if (r === 'ok') cancelRetry();
    else if (r === 'nosession' || r === 'error') scheduleRetry();
    // 'blocked' and 'conflict' are decisions, not failures — leave them alone.
    return r;
  }

  // ---- HAS THIS SESSION RECONCILED YET? -----------------------------------
  // A device-derived import (Health Connect writes watch sessions straight into
  // the blob) that lands BEFORE the first pull resolves flags the blob dirty.
  // bootSync then sees `remoteNewer && isDirty` and reports a CONFLICT the user
  // never caused — and the answer that "keeps this device" force-pushes over a
  // genuinely newer cloud copy, skipping the empty-blob guard and the version
  // compare. storage.js:758 documents this exact chain; the fix had been applied
  // only to health.setData(), while sleep/cardio importFromHealth still call
  // save() one line away.
  //
  // saveLocal() is NOT the fix for those two: a watch workout is real user data
  // and has to reach the other devices. The race is the problem, so the import
  // waits for the reconciliation instead of being silenced.
  let syncSettled = false;
  function isSettled() {
    // Never linked → there is no cloud copy to race, so nothing to wait for.
    if (!getLastUid()) return true;
    return syncSettled;
  }
  async function bootSync() {
    try { return await bootSyncCore(); } finally { syncSettled = true; try { window.dispatchEvent(new CustomEvent('vault:sync-settled')); } catch (_) {} }
  }
  async function resolveOnLogin() {
    try { return await resolveOnLoginCore(); } finally { syncSettled = true; try { window.dispatchEvent(new CustomEvent('vault:sync-settled')); } catch (_) {} }
  }

  // ---- RESUME --------------------------------------------------------------
  // Called when the app comes back to the foreground or the connection returns.
  // bootSync() already encodes the whole decision (pull / push / ask), and it is
  // the ONLY thing that can repair a stale version — via the pull branch. It ran
  // exactly once per cold start, which on a live-URL Capacitor shell can be days
  // apart, so a phone that had been backgrounded never resynced at all.
  let resuming = false;
  let lastResumeAt = 0;
  async function resume(opts) {
    const force = !!(opts && opts.force);
    if (resuming) return 'busy';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    const now = Date.now();
    // Throttled: visibilitychange fires on every glance at the phone, and each
    // resume is a network round trip. The manual "Sync now" button passes force.
    if (!force && now - lastResumeAt < 20000) return 'throttled';
    lastResumeAt = now;
    resuming = true;
    try { return await bootSync(); } catch (_) { return 'offline'; }
    finally { resuming = false; }
  }
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
    // runPush(), not push().catch(() => {}): the failure has to start a retry
    // chain instead of vanishing.
    pushTimer = setTimeout(() => { runPush(); }, 1200);
  }

  // Replace local data with the cloud blob — but NEVER overwrite a non-empty
  // local store with an empty cloud blob. Returns true only if it applied.
  function applyRemote(remote, uid) {
    if (!remoteHasData(remote)) return false;
    // BEFORE the overwrite, not after: importRaw() replaces the stored blob, so
    // once it has run there is nothing left to copy.
    snapshotLocal('applyRemote', uid);
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
  async function resolveOnLoginCore() {
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
    if (!isLinked(uid) && localHasData()) { noteConflict('login-firstlink', uid, remote); return 'conflict'; }
    // ALREADY-LINKED devices need the same question asked a different way. The
    // guard above only covers a FIRST link, so a device that was linked before
    // fell straight through to applyRemote — and then setDirty(false) marked the
    // edits it had just destroyed as synced.
    //
    // That is reachable two ways, and the second is not exotic:
    //   · the offline grace path — a wasLinked device with local data keeps
    //     training with no session, and every save flags dirty via lastUid;
    //   · LOGOUT WHEN THE PUSH FAILED — app.js deliberately skips
    //     clearLocalUserData() there to preserve the unpushed blob, so `linked`
    //     and `dirty` both survive. The very next sign-in then overwrote exactly
    //     the data that fail-closed logout had just protected.
    // bootSync has always made this check; the interactive sign-in path is the
    // one that did not, and afterLogin calls THIS, not bootSync.
    if (isLinked(uid) && isDirty(uid) && localHasData()) { noteConflict('login-dirty', uid, remote); return 'conflict'; }
    if (applyRemote(remote, uid)) { setStamp(uid, remote.updatedAt); setVersion(uid, remote.version); setDirty(uid, false); markLinked(uid); return "pulled"; }
    // applyRemote FAILED on a blob that demonstrably has data (remoteHasData
    // passed above), so this is a broken import, not an empty cloud. Pushing
    // here would overwrite the very copy we failed to read. Report offline and
    // leave both sides untouched.
    return 'offline';
  }
  // Conflict resolution choices (first link only).
  // Returns 'ok' | 'failed'. The caller must not report success on 'failed':
  // this is the user's explicit "keep the account's data" decision, and a silent
  // no-op leaves it unexecuted while a later logout push clobbers the very copy
  // they chose to keep.
  async function chooseCloud() {
    const s = await getSession(); if (!s) return 'failed';
    let remote;
    try { remote = await pull(); } catch (_) { return 'failed'; }
    if (remote === undefined) return 'failed';
    if (applyRemote(remote, s.user.id)) {
      setStamp(s.user.id, remote.updatedAt); setVersion(s.user.id, remote.version);
      setDirty(s.user.id, false); markLinked(s.user.id);
      return 'ok';
    }
    // applyRemote returned false. That is TWO different situations and they used
    // to be conflated into "cloud was empty → keep local", which then pushed:
    //   · the cloud really is empty  → seeding it from this device is correct;
    //   · the import FAILED on a blob that has data → pushing overwrites the
    //     account data the user just explicitly chose to keep. That is the
    //     opposite of what they asked for, and it is unrecoverable.
    if (!remoteHasData(remote)) {
      const r = await push();
      if (r !== 'ok') return 'failed';
      markLinked(s.user.id);
      return 'ok';
    }
    return 'failed';
  }
  async function chooseLocal() {
    const s = await getSession(); if (!s) return 'failed';
    // The cloud copy is about to be overwritten wholesale. Keep it in the rescue
    // slot on THIS device first, so "my device wins" is undoable here as well —
    // until now only the losing device ever held a snapshot. (The server keeps
    // the last ten versions too, since 20_vault-data-history.)
    try {
      const remote = await pull();
      if (remote && remoteHasData(remote)) snapshotRaw(JSON.stringify(remote.data), 'pre-force-push', s.user.id);   // BEFORE markLinked: getLastUid() is still empty on a first link
    } catch (_) {}
    // Explicit user override ("my device wins") — force past the empty-blob guard.
    let r; try { r = await push({ force: true }); } catch (_) { r = 'error'; }
    if (r !== 'ok') return 'failed';
    markLinked(s.user.id);
    return 'ok';
  }

  // FOR CALLERS ABOUT TO DESTROY LOCAL DATA (logout). push() hands a caller the
  // push already in flight — whose snapshot of the store predates any save made
  // during the upload. That push resolves 'ok' and honestly leaves dirty set;
  // a caller that only looked at 'ok' then wiped the device with an unsent set
  // on it. Push, and push again while dirty, up to three times.
  async function flush() {
    let r = 'nosession';
    for (let i = 0; i < 3; i++) {
      try { r = await push(); } catch (_) { r = 'error'; }
      if (r !== 'ok') return r;
      const s = await getSession(); if (!s) return 'nosession';
      if (!isDirty(s.user.id)) return 'ok';
    }
    return 'dirty';
  }

  // Background sync on app boot for an already-linked, logged-in device. Uses a
  // persisted "dirty" flag so it never silently loses data:
  //   - remote newer & no local edits  → pull
  //   - remote newer & local edits too  → conflict (let the user choose)
  //   - otherwise                       → push our local up
  // ONE sync at a time. bootCloud's direct bootSync() and a visibilitychange
  // resume() inside the boot pull's round trip used to run two pulls, decide
  // 'conflict' twice, and stack two dialogs. Callers share the promise in flight.
  let syncInFlight = null;
  function bootSyncCore() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = bootSyncCoreUnguarded().finally(() => { syncInFlight = null; });
    return syncInFlight;
  }
  async function bootSyncCoreUnguarded() {
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
    // OUR OWN PUSH, whose answer never arrived (app killed mid-upload). The row
    // carries the stamp this device wrote; adopt its version and carry on.
    const attempted = getPushing(uid);
    if (attempted && sameInstant(remote.updatedAt, attempted)) {
      setStamp(uid, remote.updatedAt);
      if (typeof remote.version === 'number') setVersion(uid, remote.version);
      clearPushing(uid);
      return pushed();
    }
    // DECIDE BY THE SERVER'S COUNTER, not by clocks. updated_at is written from
    // each device's own clock, so a device running fast never saw the other
    // device's row as newer — it never pulled, its push conflicted on the
    // version, and the only way out offered was to force-push over the other
    // device. The version is what the conditional write actually trusts; the
    // timestamp compare remains only for a row whose version is unknown.
    const localVer = getVersion(uid);
    const remoteNewer = (typeof remote.version === 'number' && typeof localVer === 'number')
      ? remote.version > localVer
      : newer(remote.updatedAt, getStamp(uid));
    // RECOVERY: this device has no user data but the cloud does. Timestamps alone
    // would never trigger a pull here (a local reset/corrupt-load leaves a recent
    // stamp), stranding the device empty next to a full backup. Pull it back.
    const localEmpty = !localHasData();
    if (remoteNewer && isDirty(uid) && !localEmpty) { noteConflict('boot-both-changed', uid, remote); return 'conflict'; } // both changed → ask
    // FIRST LINK, guarding the PULL only. A device that never answered the
    // 'keep which copy?' question used to reach this branch, find the cloud
    // 'newer' than a stamp it never had, and pull over its local data silently.
    // It sits HERE, below the own-push adoption and the version compare, so a
    // device whose first push committed but never got its reply (or whose
    // background retry later succeeded) still adopts its own row and links —
    // asking it to choose between two copies of its own data was the very
    // self-conflict the pushing stamp exists to prevent.
    if (remoteNewer && !localEmpty && !isLinked(uid)) { noteConflict('boot-firstlink', uid, remote); return 'conflict'; }
    if (remoteNewer || localEmpty) {
      if (applyRemote(remote, uid)) { setStamp(uid, remote.updatedAt); setVersion(uid, remote.version); setDirty(uid, false); markLinked(uid); return "pulled"; }
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
  // food_catalog, preset_plans and app_config are readable by anon (migration
  // 07), so those work logged out. The exercises table is `to authenticated`
  // only (migration 02 revoked anon), so its read waits for a session — it used
  // to be attempted on every logged-out boot and fail; and because only a
  // signed-in pull is cached, a logged-out boot re-reads the two small public
  // tables each time, which is the cheaper of the two mistakes. ANY failure
  // (offline, not configured, a
  // table not existing yet) resolves that field to null — callers must treat
  // every field as optional and never let a failure here block boot.
  const CATALOG_CACHE_KEY = VAULT_KEYS.catalog;
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
      let signedIn = false;
      try { signedIn = !!(await getSession()); } catch (_) {}
      if (signedIn) {
        try {
          const { data, error } = await c
            .from('exercises')
            .select('id,name,category,image_slug,machine_type')
            .is('owner_id', null)
            .is('deleted_at', null);
          if (!error && Array.isArray(data)) result.exercises = data;
        } catch (_) {}
      }
      try {
        const { data, error } = await c
          .from('food_catalog')
          // `*`, not a column list: `fat` arrives with 21_food-catalog-fat and
          // naming it before that migration is applied would fail the whole
          // pull. The mapper reads what is there.
          .select('*')
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
  // ---- client error reporting ---------------------------------------------
  // Fire-and-forget crash reporting (backend/pending/client-errors-v9.sql).
  //
  // Rules this MUST obey, because it runs on the error path:
  //   * never throw — a reporter that crashes while reporting a crash is worse
  //     than no reporter at all;
  //   * never block the UI (no await at the call site);
  //   * never load the SDK just to report — if Supabase isn't already up, drop it;
  //   * send NO user content. Only the app's own message/stack location.
  // Dedupe identical messages within a session so a render loop can't spam.
  const __sentErrors = new Set();
  function reportError(kind, msg, src, line) {
    try {
      const m = String(msg || '').slice(0, 500);
      if (!m) return;
      const key = kind + '|' + m + '|' + (src || '') + '|' + (line || '');
      if (__sentErrors.has(key)) return;
      if (__sentErrors.size > 50) return;      // hard per-session ceiling
      __sentErrors.add(key);
      const c = client;                        // only if the SDK is ALREADY loaded
      if (!c) return;
      getSession().then((s) => {
        if (!s) return;                        // anonymous errors are not collected
        c.from('client_errors').insert({
          user_id: s.user.id,
          build: (typeof VAULT_BUILD !== 'undefined' ? VAULT_BUILD : 'unknown').slice(0, 16),
          kind: kind,
          msg: m,
          src: src ? String(src).slice(0, 300) : null,
          line: (typeof line === 'number' && isFinite(line)) ? line : null,
          ua: (navigator.userAgent || '').slice(0, 200),
        }).then(() => {}, () => {});           // swallow both outcomes
      }, () => {});
    } catch (_) { /* reporting must never surface an error of its own */ }
  }

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
      // The hourly cap (migration 26) RAISES, so the row is genuinely not
      // stored — the form must not claim it was sent.
      if (error && /feedback rate limit/i.test(error.message || '')) return { error: 'ratelimit' };
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
      localStorage.removeItem(VAULT_KEYS.store);
      // The three OTHER full copies of the blob. The pre-sync rescue held the whole
      // raw store and outlived logout, so on a shared phone the next account was
      // offered Restore of the previous one's entire history — and restoreRecovery
      // force-pushes, so one tap would have moved it into their cloud row. The
      // corrupt-blob copy and the AI cache (typed meal descriptions) are the same
      // kind of residue.
      localStorage.removeItem(RECOVERY_KEY);
      localStorage.removeItem(RECOVERY_FAILED_KEY);
      localStorage.removeItem(VAULT_KEYS.corrupt);
      localStorage.removeItem(VAULT_KEYS.foodaiCache);
      localStorage.removeItem(CATALOG_CACHE_KEY);
      localStorage.removeItem(LAST_UID_KEY);
      localStorage.removeItem(VAULT_KEYS.ui);   // the pre-paint mirror of prefs — the next account must not inherit this one's frame
      // The reminder side store and the one-time unit seed: user B on a shared
      // phone used to open Notifications and read user A's log.
      localStorage.removeItem(VAULT_KEYS.notifDay);
      localStorage.removeItem(VAULT_KEYS.notifLog);
      localStorage.removeItem(VAULT_KEYS.notifArmed);
      localStorage.removeItem(VAULT_KEYS.unitSeeded);
      // The per-account and per-exercise prefix keys, by their registry names —
      // a regex here used to be a second spelling of the same prefixes.
      const prefixes = [VAULT_KEYS.synced, VAULT_KEYS.linked, VAULT_KEYS.dirty, VAULT_KEYS.ver, VAULT_KEYS.pushing, VAULT_KEYS.img, VAULT_KEYS.imgAt];
      Object.keys(localStorage).forEach((k) => {
        if (prefixes.some((p) => k.indexOf(p) === 0)) localStorage.removeItem(k);
      });
    } catch (_) {}
  }

  // GDPR / Play right-to-erasure. Inventory Storage while the account is known
  // live, delete the account, then sweep the inventoried objects with the JWT
  // already in memory. The old sweep-first order destroyed photos before an RPC
  // failure left the account alive — an unrecoverable half-delete. Throws on any
  // hard failure so the UI can report it.
  async function deleteAccount() {
    const c = sb();
    if (!c) throw new Error('offline');
    const s = await getSession();
    const uid = s && s.user && s.user.id;
    if (!uid) throw new Error('not signed in');
    // 1) Inventory the user's image objects (owner RLS), but do not delete yet.
    //
    // A failed list must abort before the RPC: deleting an account without knowing
    // which non-cascading objects it owns would strand images with no cleanup path.
    let imagePaths = null;
    let listErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const found = [];
        for (let offset = 0; ; offset += 1000) {
          const { data: files, error } = await c.storage.from(IMAGE_BUCKET).list(uid, { limit: 1000, offset });
          if (error) throw new Error(error.message);
          (files || []).forEach((f) => found.push(uid + '/' + f.name));
          if (!files || files.length < 1000) break;
        }
        imagePaths = found;
        listErr = null;
        break;
      } catch (e) { listErr = e; }
    }
    if (listErr || !imagePaths) throw new Error('delete_images_inspect_error');
    // 2) Delete the account + database data via the definer RPC. This must
    // happen before the irreversible Storage sweep below.
    const { error } = await c.rpc('delete_own_account');
    if (error) throw new Error(error.message || 'delete failed');
    // 3) The signed JWT remains usable by Storage RLS for this request even
    // though its auth.users row is gone. A failure here can leave orphaned
    // objects, but it can no longer leave destroyed images on a live account.
    let sweepErr = null;
    if (imagePaths.length) {
      const pending = imagePaths.slice();
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          while (pending.length) {
            const batch = pending.slice(0, 1000);
            const { error: rmErr } = await c.storage.from(IMAGE_BUCKET).remove(batch);
            if (rmErr) throw new Error(rmErr.message);
            pending.splice(0, batch.length);
          }
          sweepErr = null;
          break;
        } catch (e) { sweepErr = e; }
      }
    }
    if (sweepErr) throw new Error('delete_images_cleanup_error');
    // 4) End the session + clear the device.
    try { await c.auth.signOut(); } catch (_) {}
    clearLocalUserData();
  }

  window.Cloud = {
    configured, ensureSdk, getSession, currentEmail,
    signUp, signIn, signOut, changePassword, resetPassword, onPasswordRecovery,
    pull, push, flush, onLocalChange, resume,
    snapshotLocal, recoveryInfo, recoveryFailedAt, restoreRecovery, isSettled,
    // Read-only view of this device's sync state, so the UI can finally SAY
    // "you have changes that have not reached the cloud" — neither flag was
    // exported before, which is why no screen could show it.
    syncState: () => {
      const uid = getLastUid();
      if (!uid) return { linked: false, dirty: false, stamp: '', version: null };
      return { linked: isLinked(uid), dirty: isDirty(uid), stamp: getStamp(uid), version: getVersion(uid) };
    },
    resolveOnLogin, chooseCloud, chooseLocal, bootSync, applyRemote,
    localHasData, // so the UI can tell an empty device from one that already has data
    // Has this device EVER been signed in and linked to an account? Used by the
    // mandatory-account gate to tell a brand-new install (must sign up) apart from
    // a known user whose token merely expired while offline (must NOT be locked
    // out of data that is already on their device).
    wasLinked: () => { const u = getLastUid(); return !!u && isLinked(u); },
    getClient: sb, // RLS-scoped client, exposed for auxiliary readers
    getUsername, checkUsername, setUsername,
    captcha: { mount: mountCaptcha, unmount: unmountCaptcha, token: captchaToken, reset: resetCaptcha, siteKey: CAPTCHA_SITE_KEY },
    touchLastSeen, getMyFlags, submitFeedback, reportError,
    pullCatalog,
    backupExerciseImage, restoreExerciseImage, removeExerciseImage,
    deleteAccount, clearLocalUserData,
  };
})();
