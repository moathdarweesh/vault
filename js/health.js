// Health Connect bridge for THE VAULT.
// Talks to the native HealthConnectPlugin (see android/.../HealthConnectPlugin.kt).
// Everything here is a no-op on the web/PWA build — it only does real work when
// the app runs inside the Capacitor Android shell. Cached data (DB.health) lets
// the home screen show cards even between syncs / offline.
(function () {
  'use strict';

  const plugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.HealthConnect) || null;
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  const tr = (k) => (typeof t === 'function' ? t(k) : k);
  const ic = (name, size) => (typeof icon === 'function' ? icon(name, size || 20) : '');
  const fmt = (n) => (typeof fmtNum === 'function' ? fmtNum(n) : String(n));
  const round = (v, d) => (v == null ? null : (d ? Number(v).toFixed(d) : Math.round(v)));
  // Escape HTML for untrusted strings (e.g. native error messages from the plugin).
  const esc = (s) => typeof escapeHtml === 'function'
    ? escapeHtml(s)
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function startOfTodayMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function sleepValue(data) {
    const sleep = Array.isArray(data.sleep) ? data.sleep : [];
    if (!sleep.length) return null;
    const last = sleep.reduce((a, b) => (new Date(a.end) > new Date(b.end) ? a : b));
    const h = Math.floor(last.minutes / 60);
    const m = last.minutes % 60;
    return `${h}<span class="health-card-unit">${tr('unit_hr')}</span> ${m}<span class="health-card-unit">${tr('unit_min')}</span>`;
  }

  // Single source of truth for every metric: how to read it, label, icon, color.
  const METRICS = [
    { key: 'heartRate', icon: 'heartPulse', color: '#f87171', label: 'health_hr', unit: 'health_bpm', val: (d) => (d.heartRate && d.heartRate.latest != null ? fmt(d.heartRate.latest) : null) },
    { key: 'sleep', icon: 'moon', color: '#a78bfa', label: 'health_sleep', unit: '', val: sleepValue },
    { key: 'oxygen', icon: 'droplet', color: '#38bdf8', label: 'health_oxygen', unit: 'percent', val: (d) => (d.oxygen && d.oxygen.latest != null ? round(d.oxygen.latest) : null) },
    { key: 'calories', icon: 'flame', color: '#fb923c', label: 'health_calories', unit: 'health_kcal', val: (d) => (d.calories != null ? fmt(round(d.calories)) : null) },
    { key: 'distance', icon: 'run', color: '#34d399', label: 'health_distance', unit: 'health_km', val: (d) => round(d.distance, 2) },
    { key: 'vo2max', icon: 'chart', color: '#facc15', label: 'health_vo2', unit: 'health_vo2_unit', val: (d) => round(d.vo2max, 1) },
    { key: 'exercise', icon: 'dumbbell', color: '#f472b6', label: 'health_exercise', unit: 'health_min', val: (d) => (d.exercise && d.exercise.minutes != null ? d.exercise.minutes : null) },
    { key: 'power', icon: 'zap', color: '#fbbf24', label: 'health_power', unit: 'health_watt', val: (d) => round(d.power) },
    { key: 'speed', icon: 'bike', color: '#22d3ee', label: 'health_speed', unit: 'health_kmh', val: (d) => round(d.speed, 1) },
  ];

  const unitText = (u) => (!u ? '' : u === 'percent' ? '%' : tr(u));

  function cardHtml(m, data, withToggle) {
    const value = data ? m.val(data) : null;
    const hidden = (typeof DB !== 'undefined') && DB.health.isHidden(m.key);
    const valHtml = value == null
      ? '<span class="health-card-empty">—</span>'
      : `${value}${m.unit ? `<span class="health-card-unit">${unitText(m.unit)}</span>` : ''}`;
    const toggle = withToggle
      ? `<span class="health-card-toggle ${hidden ? '' : 'on'}">${ic(hidden ? 'plus' : 'check', 13)}</span>`
      : '';
    const cls = `health-card${withToggle ? ' selectable' : ''}${withToggle && hidden ? ' is-hidden' : ''}`;
    const attr = withToggle ? ` data-toggle="${m.key}" role="button"` : '';
    return `
      <div class="${cls}"${attr}>
        ${toggle}
        <div class="health-card-icon" style="background:var(--accent-soft);color:var(--accent)">${ic(m.icon)}</div>
        <div class="health-card-value num">${valHtml}</div>
        <div class="health-card-label">${tr(m.label)}</div>
      </div>`;
  }

  function gridHtml(data, opts) {
    opts = opts || {};
    const list = opts.onlyVisible ? METRICS.filter((m) => !DB.health.isHidden(m.key)) : METRICS;
    return `<div class="health-grid">${list.map((m) => cardHtml(m, data, opts.withToggle)).join('')}</div>`;
  }

  // ---------------------------------------------------------------- Home screen
  function homeSectionHtml() {
    if (typeof DB === 'undefined') return '';
    const h = DB.health.get();
    const data = h.data;
    const hasData = !!data;

    // Web with no cached data → don't clutter the home screen at all.
    if (!hasData && !isNative()) return '';

    const head = `
      <div class="health-home-head">
        <div class="section-title" style="margin:0">${tr('health_home')}</div>
        <div class="health-home-actions">
          <button class="health-home-btn" id="home-health-sync" aria-label="${tr('health_connect')}">${ic('refresh', 16)}</button>
          <button class="health-home-btn" id="home-health-edit" aria-label="${tr('health_section')}">${ic('settings', 16)}</button>
        </div>
      </div>`;

    let body;
    if (hasData) {
      const visible = METRICS.filter((m) => !DB.health.isHidden(m.key));
      body = visible.length
        ? gridHtml(data, { onlyVisible: true })
        : `<button class="health-connect-prompt" id="home-health-edit2">${ic('plus', 18)}<span>${tr('health_all_hidden')}</span></button>`;
    } else {
      // Native, never synced yet → invite to connect.
      body = `<button class="health-connect-prompt" id="home-health-connect">${ic('heartPulse', 18)}<span>${tr('health_connect')}</span></button>`;
    }

    return `<div class="home-health" id="home-health">${head}${body}</div>`;
  }

  function bindHomeSection() {
    const sync = document.getElementById('home-health-sync');
    if (sync) sync.addEventListener('click', homeSync);
    const connect = document.getElementById('home-health-connect');
    if (connect) connect.addEventListener('click', homeSync);
    [document.getElementById('home-health-edit'), document.getElementById('home-health-edit2')].forEach((b) => {
      if (b) b.addEventListener('click', open);
    });

    // Auto-refresh whenever the home screen renders (throttled in silentSync).
    if (isNative()) silentSync();
  }

  let lastSyncAt = 0;

  // Merge a fresh read over the cached data so a metric that comes back empty
  // (nothing logged yet today, or Samsung Health hasn't pushed it) never blanks
  // out a value the user already saw.
  function mergeData(oldD, newD) {
    if (!oldD) return newD || null;
    if (!newD) return oldD;
    const merged = Object.assign({}, oldD);
    METRICS.forEach((m) => {
      if (m.val(newD) != null) merged[m.key] = newD[m.key];
    });
    return merged;
  }

  // Write fresh Health Connect data into the app's own logs (sleep, …) so it
  // shows up in the records, not just the home cards. Deduped inside storage.
  function applyToLogs(data) {
    if (!data || typeof DB === 'undefined') return;
    // WAIT FOR THE FIRST CLOUD RECONCILIATION. These two writes go through
    // DB.*.save(), which flags the synced blob dirty — correctly, they are real
    // user data. But at boot this runs before bootSync's pull has resolved, and
    // a blob that is dirty for a reason the user never caused turns the next
    // reconciliation into a conflict dialog they cannot explain. Skipping is
    // free: silentSync() runs again on every foreground, so the import lands a
    // moment later with the same data and no race.
    try {
      if (window.Cloud && Cloud.isSettled && !Cloud.isSettled()) return;
    } catch (_) { /* no cloud layer at all → nothing to race */ }
    try { if (DB.sleep && DB.sleep.importFromHealth) DB.sleep.importFromHealth(data.sleep); } catch (_) { /* ignore */ }
    try { if (DB.cardio && DB.cardio.importFromHealth) DB.cardio.importFromHealth(data.exerciseSessions); } catch (_) { /* ignore */ }
  }

  // Re-render whichever screen a sync just changed, if it is the one on screen —
  // checked from the DOM so it works regardless of when the app sets currentView.
  // Home is not the only one: applyToLogs writes watch sessions straight into the
  // cardio and sleep logs, and those pages used to keep showing the pre-sync list
  // until you navigated away and back.
  function refreshActive() {
    if (typeof renderView !== 'function') return;
    ['home', 'cardio', 'sleep'].forEach((name) => {
      const v = document.querySelector(`.view[data-view="${name}"]`);
      if (v && v.classList.contains('active')) renderView(name);
    });
  }

  // Read + cache + import into logs + refresh the home cards.
  async function pull() {
    const fresh = await plugin().readData({ startTime: startOfTodayMs(), endTime: Date.now() });
    lastSyncAt = Date.now();
    DB.health.setData(mergeData(DB.health.get().data, fresh));
    applyToLogs(fresh);
    refreshActive();
  }

  // Pull fresh data without prompting (only if permission already granted).
  async function silentSync() {
    if (!isNative() || !plugin()) return;
    const now = Date.now();
    if (now - lastSyncAt < 20000) return; // throttle load + resume bursts
    lastSyncAt = now;
    try {
      const perm = await plugin().checkHealthPermissions();
      if (!perm || !perm.granted) return;
      await pull();
    } catch (_) { /* ignore */ }
  }

  // Runs on every app launch/resume: if permission is granted, sync silently;
  // if it's the very first launch and not granted, ask once — so the user never
  // has to open Settings to connect.
  async function autoStart() {
    if (!isNative() || !plugin()) return;
    try {
      const perm = await plugin().checkHealthPermissions();
      if (perm && perm.granted) { await pull(); return; }
      if (localStorage.getItem('hc_prompted')) return; // don't nag after a decline
      localStorage.setItem('hc_prompted', '1');
      const req = await plugin().requestHealthPermissions();
      if (req && req.granted) await pull();
    } catch (_) { /* ignore */ }
  }

  // Wait for the Capacitor bridge to be ready, then auto-start (native only).
  function bootstrap() {
    let tries = 0;
    const tick = () => {
      if (plugin()) { autoStart(); return; }
      if (++tries > 24) return; // ~6s, then give up (e.g. plain web build)
      setTimeout(tick, 250);
    };
    tick();
  }

  // Explicit sync from the home refresh / connect button (may prompt).
  async function homeSync() {
    if (!isNative() || !plugin()) { open(); return; }
    const btn = document.getElementById('home-health-sync');
    if (btn) btn.classList.add('spinning');
    try {
      const perm = await plugin().requestHealthPermissions();
      if (!perm || !perm.granted) { open(); return; }
      const fresh = await plugin().readData({ startTime: startOfTodayMs(), endTime: Date.now() });
      lastSyncAt = Date.now();
      DB.health.setData(mergeData(DB.health.get().data, fresh));
      applyToLogs(fresh);
      if (typeof showToast === 'function') showToast(tr('health_synced'));
      if (typeof renderView === 'function') renderView('home');
    } catch (e) {
      if (typeof showToast === 'function') showToast((e && e.message) || tr('health_no_data'));
      if (btn) btn.classList.remove('spinning');
    }
  }

  // ---------------------------------------------------------------- Settings modal
  function modalBody(data) {
    const grid = data
      ? gridHtml(data, { withToggle: true })
      : `<div class="health-msg">${tr('health_syncing')}</div>`;
    const hint = data ? `<div class="health-hint">${tr('health_toggle_hint')}</div>` : '';
    return grid + hint + actions(!!data);
  }

  function actions(refresh) {
    return `
      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-ghost" id="hc-open-settings">${tr('health_open_settings')}</button>
        <button class="btn btn-primary" id="hc-sync">${refresh ? tr('health_connect') : tr('health_connect_btn')}</button>
      </div>`;
  }

  function wireModal() {
    const body = document.getElementById('health-body');
    if (!body) return;
    const s = document.getElementById('hc-sync');
    if (s) s.addEventListener('click', sync);
    const o = document.getElementById('hc-open-settings');
    if (o) o.addEventListener('click', () => plugin() && plugin().openHealthConnectSettings().catch(() => {}));
    // Tap a card to show/hide it on the home screen.
    body.querySelectorAll('[data-toggle]').forEach((c) =>
      c.addEventListener('click', () => {
        DB.health.toggle(c.dataset.toggle);
        const data = DB.health.get().data;
        body.innerHTML = modalBody(data);
        wireModal();
      })
    );
  }

  async function sync() {
    const body = document.getElementById('health-body');
    if (body) body.innerHTML = `<div class="health-msg">${tr('health_syncing')}</div>`;
    try {
      const perm = await plugin().requestHealthPermissions();
      if (!perm || !perm.granted) {
        if (body) body.innerHTML = `<div class="health-msg">${tr('health_no_permission')}</div>` + actions(false);
        wireModal();
        return;
      }
      const fresh = await plugin().readData({ startTime: startOfTodayMs(), endTime: Date.now() });
      lastSyncAt = Date.now();
      const data = mergeData(DB.health.get().data, fresh);
      DB.health.setData(data);
      applyToLogs(fresh);
      if (body) body.innerHTML = modalBody(data);
      wireModal();
      if (typeof showToast === 'function') showToast(tr('health_synced'));
    } catch (e) {
      if (body) body.innerHTML = `<div class="health-msg">${esc((e && e.message) || tr('health_no_data'))}</div>` + actions(false);
      wireModal();
    }
  }

  function shell(inner) {
    return `
      <div class="modal-header">
        <div>
          <div class="modal-title">${tr('health_section')}</div>
          <div class="modal-subtitle">${tr('health_connect_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close>${ic('close', 18)}</button>
      </div>
      <div id="health-body">${inner}</div>`;
  }

  async function open() {
    if (typeof openModal !== 'function') return;

    const cached = (typeof DB !== 'undefined') ? DB.health.get().data : null;

    if (!isNative() || !plugin()) {
      // Web: still let the user customize which cached cards show on home.
      openModal(shell(cached ? modalBody(cached) : `<div class="health-msg">${tr('health_only_android')}</div>`));
      wireModal();
      return;
    }

    // Native: show cached data immediately (with toggles), then refresh.
    openModal(shell(cached ? modalBody(cached) : `<div class="health-msg">${tr('health_syncing')}</div>`));
    wireModal();
    try {
      const avail = await plugin().isAvailable();
      if (!avail || !avail.available) {
        const body = document.getElementById('health-body');
        if (body) body.innerHTML = `<div class="health-msg">${tr('health_unavailable')}</div>`;
        return;
      }
      await sync();
    } catch (e) {
      const body = document.getElementById('health-body');
      if (body && !cached) body.innerHTML = `<div class="health-msg">${esc((e && e.message) || tr('health_unavailable'))}</div>`;
    }
  }

  // Auto-sync whenever the app is brought back to the foreground.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') silentSync();
    });
    // Kick off the first sync (and one-time permission prompt) on launch.
    if (document.readyState === 'complete') bootstrap();
    else window.addEventListener('load', bootstrap);
  }

  // autoSync: safe to call from any view's render. No-op off-native, no-op without
  // permission, and throttled to once per 20s — so a screen can ask for fresh
  // watch data on open without prompting or hammering Health Connect.
  window.Health = { open, sync, autoSync: silentSync, isNative, homeSectionHtml, bindHomeSection };
})();
