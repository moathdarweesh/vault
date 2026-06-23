// Health Connect bridge for THE VAULT.
// Talks to the native HealthConnectPlugin (see android/.../HealthConnectPlugin.kt).
// Everything here is a no-op on the web/PWA build — it only does real work when
// the app runs inside the Capacitor Android shell.
(function () {
  'use strict';

  const plugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.HealthConnect) || null;
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  // Local fallback for t() in case it isn't ready (it always is by call time).
  const tr = (k) => (typeof t === 'function' ? t(k) : k);

  function startOfTodayMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function fmt(n) {
    return typeof fmtNum === 'function' ? fmtNum(n) : String(n);
  }

  const ic = (name) => (typeof icon === 'function' ? icon(name, 20) : '');

  function card(iconName, label, value, unit, color) {
    const val = value == null
      ? '<span class="health-card-empty">—</span>'
      : `${value}${unit ? `<span class="health-card-unit">${unit}</span>` : ''}`;
    return `
      <div class="health-card">
        <div class="health-card-icon" style="background:${color}1f;color:${color}">${ic(iconName)}</div>
        <div class="health-card-value num">${val}</div>
        <div class="health-card-label">${label}</div>
      </div>`;
  }

  function renderResults(data) {
    const hr = data.heartRate || {};
    const ox = data.oxygen || {};
    const sleep = Array.isArray(data.sleep) ? data.sleep : [];
    // Most recent sleep session, formatted as "7h 20m"
    let sleepStr = null;
    if (sleep.length) {
      const last = sleep.reduce((a, b) => (new Date(a.end) > new Date(b.end) ? a : b));
      const h = Math.floor(last.minutes / 60);
      const m = last.minutes % 60;
      sleepStr = `${h}<span class="health-card-unit">h</span> ${m}<span class="health-card-unit">m</span>`;
    }
    return `
      <div class="health-grid">
        ${card('footprints', tr('health_steps'), data.steps != null ? fmt(data.steps) : null, '', '#34d399')}
        ${card('heartPulse', tr('health_hr'), hr.latest != null ? fmt(hr.latest) : null, tr('health_bpm'), '#f87171')}
        ${card('droplet', tr('health_oxygen'), ox.latest != null ? Math.round(ox.latest) : null, '%', '#38bdf8')}
        ${card('moon', tr('health_sleep'), sleepStr, '', '#a78bfa')}
      </div>`;
  }

  function bodyHtml(inner) {
    return `
      <div class="modal-header">
        <div>
          <div class="modal-title">${tr('health_section')}</div>
          <div class="modal-subtitle">${tr('health_connect_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close>${typeof icon === 'function' ? icon('close', 18) : '✕'}</button>
      </div>
      <div id="health-body">${inner}</div>`;
  }

  async function sync() {
    const body = document.getElementById('health-body');
    if (body) body.innerHTML = `<div class="health-msg">${tr('health_syncing')}</div>`;
    try {
      const perm = await plugin().requestHealthPermissions();
      if (!perm || !perm.granted) {
        if (body) body.innerHTML = `<div class="health-msg">${tr('health_no_permission')}</div>` + connectBtn();
        wire();
        return;
      }
      const now = Date.now();
      const data = await plugin().readData({
        startTime: Math.min(startOfTodayMs(), now - 36 * 3600 * 1000), // catch last night's sleep
        endTime: now,
      });
      if (body) body.innerHTML = `<div class="health-stats">${renderResults(data)}</div>` + connectBtn(true);
      wire();
      if (typeof showToast === 'function') showToast(tr('health_synced'));
    } catch (e) {
      if (body) body.innerHTML = `<div class="health-msg">${(e && e.message) || tr('health_no_data')}</div>` + connectBtn();
      wire();
    }
  }

  function connectBtn(refresh) {
    const label = refresh ? tr('health_connect') : tr('health_connect_btn');
    return `
      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-ghost" id="hc-open-settings">${tr('health_open_settings')}</button>
        <button class="btn btn-primary" id="hc-sync">${label}</button>
      </div>`;
  }

  function wire() {
    const s = document.getElementById('hc-sync');
    if (s) s.addEventListener('click', sync);
    const o = document.getElementById('hc-open-settings');
    if (o) o.addEventListener('click', () => plugin() && plugin().openHealthConnectSettings().catch(() => {}));
  }

  async function open() {
    if (typeof openModal !== 'function') return;

    if (!isNative() || !plugin()) {
      openModal(bodyHtml(`<div class="health-msg">${tr('health_only_android')}</div>`));
      return;
    }

    openModal(bodyHtml(`<div class="health-msg">${tr('health_syncing')}</div>`));
    try {
      const avail = await plugin().isAvailable();
      if (!avail || !avail.available) {
        const body = document.getElementById('health-body');
        if (body) body.innerHTML = `<div class="health-msg">${tr('health_unavailable')}</div>`;
        return;
      }
      // Available → go straight into permission + sync flow.
      await sync();
    } catch (e) {
      const body = document.getElementById('health-body');
      if (body) body.innerHTML = `<div class="health-msg">${(e && e.message) || tr('health_unavailable')}</div>`;
    }
  }

  window.Health = { open, sync, isNative };
})();
