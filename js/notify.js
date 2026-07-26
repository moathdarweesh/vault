// Reminders for THE VAULT.
//
// Two delivery paths, one schedule (DB.reminders.schedule()):
//
//   NATIVE  — @capacitor/local-notifications, inside the Android shell. Real
//             alarms that fire with the app closed. Requires a NEW APK, because
//             a Capacitor plugin is a native change; the live-URL shell cannot
//             pick it up from a git push like ordinary JS.
//   IN-APP  — everywhere else (web, and any shell built before the plugin
//             landed). No alarm can fire while the app is shut, so instead we
//             catch up on open: anything that came due today and was not logged
//             is surfaced once, as a toast.
//
// The in-app path is NOT a downgraded copy of the native one — it answers a
// different question ("what did I miss?") and stays useful on the APK too.
(function () {
  'use strict';

  const plugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const supported = () => !!(isNative() && plugin());

  const tr = (k) => (typeof t === 'function' ? t(k) : k);
  const SEEN_KEY = 'vault_reminder_seen';   // per-day, per-item "already nagged" marks

  function bodyFor(item) {
    if (item.kind === 'water') return tr('remind_water_body');
    return item.dose ? `${item.name} · ${item.dose}` : item.name;
  }
  function titleFor(item) {
    return item.kind === 'water' ? tr('remind_water_title') : tr('remind_supp_title');
  }

  // ---------------------------------------------------------------- native ---

  async function ensurePermission() {
    if (!supported()) return false;
    try {
      let p = await plugin().checkPermissions();
      if (p.display !== 'granted') p = await plugin().requestPermissions();
      return p.display === 'granted';
    } catch (_) { return false; }
  }

  // Cancel everything we own, then re-schedule from the current settings. Full
  // replace rather than diffing: the schedule is small, and a partial update is
  // how you end up with an orphaned alarm for a supplement that was deleted.
  async function sync() {
    if (!supported()) return { ok: false, reason: 'unsupported' };
    try {
      const pending = await plugin().getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await plugin().cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
      const items = DB.reminders.schedule();
      if (!items.length) return { ok: true, count: 0 };
      if (!(await ensurePermission())) return { ok: false, reason: 'denied' };
      await plugin().schedule({
        notifications: items.map((it) => ({
          id: it.id,
          title: titleFor(it),
          body: bodyFor(it),
          // `on` with no date field = repeat daily at this local wall-clock time,
          // which is what survives DST. An absolute timestamp would drift.
          schedule: { on: { hour: it.hour, minute: it.minute }, allowWhileIdle: true },
        })),
      });
      return { ok: true, count: items.length };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'error' };
    }
  }

  // ---------------------------------------------------------------- in-app ---

  function seenMap() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (_) { return {}; }
  }
  function markSeen(day, key) {
    const m = seenMap();
    if (m.day !== day) { m.day = day; m.keys = []; }
    m.keys = m.keys || [];
    if (m.keys.indexOf(key) === -1) m.keys.push(key);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (_) {}
  }
  function alreadySeen(day, key) {
    const m = seenMap();
    return m.day === day && (m.keys || []).indexOf(key) !== -1;
  }

  // Anything due earlier today and still not done. Water counts as done once the
  // day's goal is met; a supplement once it is ticked off for today.
  function missed() {
    const day = todayISO();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return DB.reminders.schedule().filter((it) => {
      if (it.hour * 60 + it.minute > nowMin) return false;          // not due yet
      if (alreadySeen(day, it.id)) return false;                     // already nagged today
      if (it.kind === 'water') return DB.water.get(day) < DB.water.goal();
      return !DB.supplements.isTaken(it.refId, day);
    });
  }

  // One toast, for the oldest outstanding item — never a queue of them.
  function catchUp() {
    if (!DB.reminders.get().enabled) return;
    const list = missed();
    if (!list.length) return;
    const it = list[0];
    markSeen(todayISO(), it.id);
    try {
      showToast(`${titleFor(it)} · ${bodyFor(it)}`, {
        actionLabel: tr('open'),
        onAction: () => navigate(it.kind === 'water' ? 'food' : 'supplements'),
      });
    } catch (_) {}
  }

  window.Notify = { isNative: supported, sync, ensurePermission, catchUp, missed };
})();
