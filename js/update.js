// Update-availability checker for THE VAULT (native APK shell only).
//
// The app now loads its web content from the LIVE site, so ordinary updates
// (text, features, styling) reach every user automatically with no reinstall.
// This file only nudges the user to install a NEW APK in the RARE case where
// the native shell itself changed (e.g. a new native plugin / permission).
//
// How it works: read the installed APK's versionCode via @capacitor/app, fetch
// the version manifest (version.json, same-origin), and if the manifest lists a
// higher apk.build than the installed one, show a dismissible banner linking to
// the Drive download. Best-effort and fully silent on any failure — it can never
// break the app or block usage. No-op on the plain web build (always latest).
(function () {
  'use strict';

  var MANIFEST_URL = 'version.json';               // same origin as the app
  var DISMISS_KEY = 'vault_update_dismissed_build'; // remember "Later" per build
  var TIMEOUT_MS = 8000;
  var DELAY_MS = 5000;                              // wait past first paint / login

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  function appPlugin() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) || null;
  }
  function tr(k) { return (typeof t === 'function') ? t(k) : k; }
  function esc(s) {
    var v = (s == null) ? '' : String(s);
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isAr() {
    try { return (DB.prefs.get().lang || 'en') === 'ar'; } catch (_) { return document.documentElement.lang === 'ar'; }
  }

  function installedBuild() {
    var App = appPlugin();
    if (!App || !App.getInfo) return Promise.resolve(null);
    return App.getInfo().then(function (info) {
      var n = parseInt(info && info.build, 10);     // Android: build === versionCode
      return isNaN(n) ? null : n;
    }).catch(function () { return null; });
  }

  function fetchManifest() {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(MANIFEST_URL + '?_=' + Date.now(), { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { if (timer) clearTimeout(timer); return res.ok ? res.json() : null; })
      .then(function (j) { return (j && j.apk) ? j.apk : null; })
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }

  function openLink(url) {
    if (!url) return;
    try { window.open(url, '_blank'); } catch (_) { try { location.href = url; } catch (__) {} }
  }

  function showBanner(apk) {
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
    if (!isNative()) return;                          // web build is always up to date
    Promise.all([installedBuild(), fetchManifest()]).then(function (r) {
      var installed = r[0], apk = r[1];
      if (installed == null || !apk || typeof apk.build !== 'number') return;
      if (apk.build <= installed) return;               // already current
      var dismissed = null;
      try { dismissed = parseInt(localStorage.getItem(DISMISS_KEY), 10); } catch (_) {}
      if (dismissed === apk.build) return;              // user tapped "Later" for this build
      showBanner(apk);
    }).catch(function () {});
  }

  function schedule() { setTimeout(check, DELAY_MS); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') schedule();
  else window.addEventListener('DOMContentLoaded', schedule);

  window.VaultUpdate = { check: check };
})();
