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
  var DISMISS_KEY = VAULT_KEYS.updateDismissed; // APK "Later", per build (registry: js/cloud.js)
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
      var gk = VAULT_KEYS.webReloadGuard + latest;
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
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.4a9.6 9.6 0 1 0 9.6 9.6h-2.8A6.8 6.8 0 1 1 12 5.2Z" fill="currentColor"/><path d="M12 2.4a9.5 9.5 0 0 1 6.4 2.4V2.2h2.8v7.2H14V6.6h3.2A6.7 6.7 0 0 0 12 5.2Z" fill="var(--icon-accent,#ff6a00)"/></svg>' +
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
    // Must trigger a MAIN-FRAME navigation (not window.open, which the Capacitor
    // WebView ignores). Capacitor's shouldOverrideUrlLoading then hands any URL on
    // a DIFFERENT host than the app to the phone's external browser via an Intent,
    // where the OS download manager fetches the APK — so apk.url MUST be cross-
    // origin (e.g. raw.githubusercontent.com), never the app's own Pages host, or
    // the WebView would try to render the binary in-place and nothing happens.
    // Runs inside the "download" tap, so it counts as a user gesture. On the plain
    // web this just points the tab at the file, which the browser downloads.
    try {
      var a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
    } catch (_) {
      try { location.href = url; } catch (__) {}
    }
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
          '<svg viewBox="0 0 24 24" fill="none"><path d="M10.6 6h2.8v15h-2.8Z" fill="currentColor"/><path d="M12 2.8 19.4 10.2l-2 2-5.4-5.4-5.4 5.4-2-2Z" fill="var(--icon-accent,#ff6a00)"/></svg>' +
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
