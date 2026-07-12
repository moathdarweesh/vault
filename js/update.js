// Update delivery for THE VAULT.
//
// Two independent jobs, both driven off the same same-origin version.json:
//
//  1) WEB auto-update (runs on web AND inside the APK WebView).
//     The app loads index.html from the LIVE URL, which GitHub Pages caches for
//     up to 10 minutes. That stale ENTRY html is why a `?v=N` bump doesn't reach
//     devices — the browser keeps serving the old index.html that still points at
//     the old scripts. Here we fetch version.json FRESH (no-store), read its
//     `web` build, compare it to THIS page's build (parsed from our own ?v=N),
//     and — if newer — reload the entry html with a cache-busting query so the
//     freshest index.html and its ?v=N scripts load. Seamless on boot; a tap-to-
//     update banner on resume. Fail-safe: if we cannot read our own build we do
//     nothing, and four guards make a reload loop impossible.
//
//  2) NATIVE APK nudge (native only). If the manifest lists a higher apk.build
//     than the installed versionCode, show a dismissible "download new APK"
//     banner. Only relevant when the native shell itself changed.
//
// Best-effort and fully silent on any failure — it can never block the app.
(function () {
  'use strict';

  // Capture our own <script> src NOW (currentScript is null inside callbacks).
  var SELF_SRC = '';
  try { SELF_SRC = (document.currentScript && document.currentScript.src) || ''; } catch (_) {}

  var MANIFEST_URL = 'version.json';                // same origin as the app
  var DISMISS_KEY = 'vault_update_dismissed_build'; // APK "Later", per build
  var TIMEOUT_MS = 8000;
  var DELAY_MS = 5000;                              // native nudge: wait past first paint

  // ---- shared helpers -------------------------------------------------------
  function tr(k) { return (typeof t === 'function') ? t(k) : k; }
  function esc(s) {
    var v = (s == null) ? '' : String(s);
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isAr() {
    try { return (DB.prefs.get().lang || 'en') === 'ar'; } catch (_) { return document.documentElement.lang === 'ar'; }
  }
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  function appPlugin() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) || null;
  }

  // Fetch the WHOLE manifest, always fresh (bypass every cache layer).
  function fetchJson() {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(MANIFEST_URL + '?_=' + Date.now(), { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { if (timer) clearTimeout(timer); return res.ok ? res.json() : null; })
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }

  // ================= 1) WEB auto-update =====================================
  // Our own build, parsed from the ?v=N on this script's URL. 0 = unknown.
  function currentWebBuild() {
    var m = String(SELF_SRC).match(/[?&]v=(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function withParam(name, val) {
    try { var u = new URL(location.href); u.searchParams.set(name, String(val)); return u.toString(); }
    catch (_) { return location.pathname + '?' + name + '=' + val; }
  }
  function reloadTo(latest) {
    try { location.replace(withParam('u', latest)); }
    catch (_) { try { location.reload(); } catch (__) {} }
  }
  function checkWebUpdate(trigger) {
    var cur = currentWebBuild();
    if (!cur) return;                                  // can't read our build -> do nothing (fail safe)
    fetchJson().then(function (j) {
      var latest = j ? parseInt(j.web, 10) : NaN;
      if (isNaN(latest) || latest <= cur) return;      // no web field / already current
      if (String(location.search).indexOf('u=' + latest) !== -1) return; // already reloaded to this target
      if (trigger === 'resume') { showWebBanner(latest); return; }
      // boot: seamless auto-reload, at most once per session per target.
      var gk = 'vault_wr_' + latest;
      try { if (sessionStorage.getItem(gk)) return; sessionStorage.setItem(gk, '1'); } catch (_) { return; }
      reloadTo(latest);
    }).catch(function () {});
  }
  function showWebBanner(latest) {
    if (document.getElementById('web-update-banner')) return;
    var el = document.createElement('div');
    el.id = 'web-update-banner';
    el.className = 'update-banner';
    el.innerHTML =
      '<div class="update-banner-main">' +
        '<div class="update-banner-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>' +
        '</div>' +
        '<div class="update-banner-text">' +
          '<div class="update-banner-title">' + esc(tr('web_update_title')) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="update-banner-actions">' +
        '<button type="button" class="update-banner-later">' + esc(tr('update_later')) + '</button>' +
        '<button type="button" class="update-banner-get">' + esc(tr('web_update_action')) + '</button>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    el.querySelector('.update-banner-later').addEventListener('click', function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    });
    el.querySelector('.update-banner-get').addEventListener('click', function () { reloadTo(latest); });
  }

  // ================= 2) NATIVE APK nudge ====================================
  function installedBuild() {
    var App = appPlugin();
    if (!App || !App.getInfo) return Promise.resolve(null);
    return App.getInfo().then(function (info) {
      var n = parseInt(info && info.build, 10);     // Android: build === versionCode
      return isNaN(n) ? null : n;
    }).catch(function () { return null; });
  }
  function openLink(url) {
    if (!url) return;
    try { window.open(url, '_blank'); } catch (_) { try { location.href = url; } catch (__) {} }
  }
  function showApkBanner(apk) {
    if (document.getElementById('update-banner')) return;
    var notes = esc(isAr() ? (apk.notes_ar || '') : (apk.notes_en || ''));
    var ver = esc(apk.version || apk.build || '');
    var el = document.createElement('div');
    el.id = 'update-banner';
    el.className = 'update-banner';
    el.innerHTML =
      '<div class="update-banner-main">' +
        '<div class="update-banner-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>' +
        '</div>' +
        '<div class="update-banner-text">' +
          '<div class="update-banner-title">' + esc(tr('update_title')) + (ver ? ' · ' + ver : '') + '</div>' +
          (notes ? '<div class="update-banner-notes">' + notes + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="update-banner-actions">' +
        '<button type="button" class="update-banner-later">' + esc(tr('update_later')) + '</button>' +
        '<button type="button" class="update-banner-get">' + esc(tr('update_get')) + '</button>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    el.querySelector('.update-banner-later').addEventListener('click', function () {
      try { localStorage.setItem(DISMISS_KEY, String(apk.build)); } catch (_) {}
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    });
    el.querySelector('.update-banner-get').addEventListener('click', function () { openLink(apk.url); });
  }
  function check() {
    if (!isNative()) return;                          // web freshness is handled by checkWebUpdate
    Promise.all([installedBuild(), fetchJson()]).then(function (r) {
      var installed = r[0], j = r[1], apk = j && j.apk;
      if (installed == null || !apk || typeof apk.build !== 'number') return;
      if (apk.build <= installed) return;               // already current
      var dismissed = null;
      try { dismissed = parseInt(localStorage.getItem(DISMISS_KEY), 10); } catch (_) {}
      if (dismissed === apk.build) return;              // tapped "Later" for this build
      showApkBanner(apk);
    }).catch(function () {});
  }

  // ---- scheduling -----------------------------------------------------------
  function schedule() {
    checkWebUpdate('boot');        // fast, seamless web-content refresh (web + APK WebView)
    setTimeout(check, DELAY_MS);   // native APK nudge (no-op on web)
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') schedule();
  else window.addEventListener('DOMContentLoaded', schedule);

  // Exposed so app.js can re-check on resume (foreground) without a full restart.
  window.VaultUpdate = { check: check, checkWeb: function () { checkWebUpdate('resume'); } };
})();
