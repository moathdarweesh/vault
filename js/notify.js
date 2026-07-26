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

  // ---------------------------------------------------------------- channels ---
  //
  // Android 8+ takes sound, vibration and heads-up behaviour from the CHANNEL,
  // not from the notification. Left alone, the plugin invents a channel called
  // "Default" at IMPORTANCE_DEFAULT — which lands silently in the drawer with no
  // banner, and gives the user a settings entry named "Default" they cannot
  // recognise. So we declare our own.
  //
  // A channel is IMMUTABLE once created: importance, sound and vibration can
  // never be changed afterwards, only the name and description. That is why
  // "sound on/off" is two channels rather than one channel edited in place, and
  // why the ids carry a version suffix — changing the behaviour later means
  // publishing a NEW id, not editing this one.
  // Outside hashId()'s range (0..1999999999) so it can never collide with a real
  // reminder, and inside Java's int range.
  const TEST_ID = 2000000001;
  const CH_ALERT = 'vault-reminders-v1';   // IMPORTANCE_HIGH: banner + sound + vibrate
  const CH_QUIET = 'vault-reminders-quiet-v1';  // IMPORTANCE_LOW: drawer only, silent
  let channelsReady = false;

  async function ensureChannels() {
    if (!supported() || channelsReady) return;
    try {
      await plugin().createChannel({
        id: CH_ALERT,
        name: tr('remind_channel_alert'),
        description: tr('remind_channel_desc'),
        importance: 4,          // IMPORTANCE_HIGH — heads-up banner + sound
        visibility: 1,          // VISIBILITY_PUBLIC — readable on the lock screen
        vibration: true,
        lights: true,
        lightColor: '#FF6A00',
        // No `sound` key on purpose: a NotificationChannel with no explicit URI
        // uses the phone's own default notification tone, which is what the user
        // has already chosen system-wide. Naming a bundled file here would
        // override that choice AND require the file to ship in res/raw.
      });
      await plugin().createChannel({
        id: CH_QUIET,
        name: tr('remind_channel_quiet'),
        description: tr('remind_channel_desc'),
        importance: 2,          // IMPORTANCE_LOW — visible in the drawer, no sound
        visibility: 1,
        vibration: false,
        lights: false,
      });
      channelsReady = true;
    } catch (_) { /* pre-Oreo, or a shell without the plugin: schedule anyway */ }
  }

  function channelId() {
    try { return DB.reminders.get().sound ? CH_ALERT : CH_QUIET; } catch (_) { return CH_ALERT; }
  }

  function bodyFor(item) {
    if (item.kind === 'water') return tr('remind_water_body');
    return item.dose ? `${item.name} · ${item.dose}` : item.name;
  }
  function titleFor(item) {
    return item.kind === 'water' ? tr('remind_water_title') : tr('remind_supp_title');
  }

  // ---------------------------------------------------------------- native ---

  // Has the OS already answered, without asking again?
  async function permissionState() {
    if (supported()) {
      try { return (await plugin().checkPermissions()).display; } catch (_) { return 'denied'; }
    }
    // Web: the browser's own Notification permission. Used so the in-app path can
    // raise a real system notification while the tab is alive, instead of a toast.
    if (typeof Notification !== 'undefined') return Notification.permission; // granted|denied|default
    return 'unsupported';
  }

  // Show the SYSTEM permission dialog. Safe to call from any reminder-related
  // control: the OS shows the sheet only the first time and afterwards returns
  // the remembered answer silently, so this never becomes a nag.
  async function ensurePermission() {
    if (supported()) {
      try {
        let p = await plugin().checkPermissions();
        if (p.display !== 'granted') p = await plugin().requestPermissions();
        return p.display === 'granted';
      } catch (_) { return false; }
    }
    if (typeof Notification !== 'undefined') {
      try {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        return (await Notification.requestPermission()) === 'granted';
      } catch (_) { return false; }
    }
    return false;
  }

  // The single gate every reminder control goes through. Its job is to RAISE THE
  // SYSTEM DIALOG at the moment the user touches anything reminder-related — not
  // to veto the action. Refusing the OS permission only costs the alerts that
  // fire while the app is closed; the in-app catch-up needs no permission at all,
  // so callers proceed either way and this just explains the limitation.
  async function gate() {
    const before = await permissionState();
    if (before === 'granted') return true;
    if (before === 'unsupported') return true;   // nothing to ask; in-app toasts still work
    const ok = await ensurePermission();
    if (!ok) {
      // 'denied' before we asked means the OS will not show the sheet again.
      try { showToast(before === 'denied' ? tr('remind_blocked') : tr('remind_denied')); } catch (_) {}
    }
    return ok;
  }

  // Android 12+ hands out on-the-minute alarms as a separate, revocable setting.
  // Without it the plugin falls back to an inexact alarm, which Doze can defer by
  // a long way — the reminder still arrives, just late. Worth surfacing, not
  // worth blocking on.
  async function exactAlarmState() {
    if (!supported() || typeof plugin().checkExactNotificationSetting !== 'function') return 'unsupported';
    try { return (await plugin().checkExactNotificationSetting()).exact_alarm; } catch (_) { return 'unsupported'; }
  }
  async function requestExactAlarms() {
    if (!supported() || typeof plugin().changeExactNotificationSetting !== 'function') return false;
    try { return (await plugin().changeExactNotificationSetting()).exact_alarm === 'granted'; } catch (_) { return false; }
  }

  function notificationFor(it) {
    return {
      id: it.id,
      title: titleFor(it),
      body: bodyFor(it),
      channelId: channelId(),
      // The plugin's fallback small icon is android.R.drawable.ic_dialog_info —
      // a fully opaque asset, and Android draws a small icon from its ALPHA
      // channel only, so the status bar showed a featureless white blob. This
      // names the white-on-transparent VAULT mark instead (res/drawable).
      smallIcon: 'ic_stat_vault',
      iconColor: '#FF6A00',
      // `on` with no date field = repeat daily at this local wall-clock time,
      // which is what survives DST. An absolute timestamp would drift.
      //
      // `second: 0` is NOT decoration. DateMatch.buildNextTriggerTime zeroes the
      // millisecond and nothing else, so an omitted second leaves whatever second
      // sync() happened to run at baked into the trigger — and postponeTriggerIfNeeded
      // compares with <=, so an alarm armed at 09:00:40 for 09:00 gets pushed a
      // FULL DAY forward. Pinning it to :00 makes the trigger deterministic.
      // (`unit` is already HOUR_OF_DAY by the time `second` is read, so this
      // cannot turn the daily repeat into a per-minute one.)
      schedule: { on: { hour: it.hour, minute: it.minute, second: 0 }, allowWhileIdle: true },
    };
  }

  // Cancel everything we own, then re-schedule from the current settings. Full
  // replace rather than diffing: the schedule is small, and a partial update is
  // how you end up with an orphaned alarm for a supplement that was deleted.
  async function sync() {
    if (!supported()) return { ok: false, reason: 'unsupported', count: 0 };
    try {
      await ensureChannels();
      const items = DB.reminders.schedule();

      // CHECK, never REQUEST. sync() runs unattended — on boot, after a cloud
      // pull, on every settings change — and on Android 13+ a POST_NOTIFICATIONS
      // dialog that the user dismisses twice is hard-denied FOREVER. Burning the
      // one prompt the OS grants us with no user gesture behind it is how the
      // permission gets permanently lost. Asking belongs to gate(), which is only
      // ever reached from a tap.
      const allowed = (await permissionState()) === 'granted';

      // DECIDE BEFORE DESTROYING. Cancelling first looks harmless — we are about
      // to re-arm anyway — but it is only safe when we know a replacement will
      // actually be armed. A cloud pull that restores an older blob with
      // reminders disabled, or a momentary permission loss, would otherwise wipe
      // every live alarm and arm nothing in its place, silently. Bailing out
      // here leaves the previous schedule running, which is the safe failure.
      if (!allowed && items.length) return { ok: false, reason: 'denied', count: 0 };

      // CANCEL ONLY WHAT WILL NOT BE RE-ARMED. `cancel()` calls
      // dismissVisibleNotification(), so it does not just drop the alarm — it
      // pulls the notification OUT OF THE SHADE. Cancelling an id we are about to
      // re-schedule therefore buys nothing and costs the user an unread reminder
      // every time the app is opened. Scheduling the same id replaces its alarm
      // on its own (same PendingIntent, FLAG_CANCEL_CURRENT), so the cancel is
      // only needed for genuine orphans — a supplement that was deleted.
      const wanted = new Set(items.map((it) => it.id));
      wanted.add(TEST_ID);   // never sweep away a test the user just fired
      const pending = await plugin().getPending();
      const orphans = ((pending && pending.notifications) || []).filter((n) => !wanted.has(n.id));
      if (orphans.length) await plugin().cancel({ notifications: orphans.map((n) => ({ id: n.id })) });
      if (!items.length) return { ok: true, count: 0 };
      await plugin().schedule({ notifications: items.map(notificationFor) });
      // Report what ANDROID holds, not what we asked for. The two diverge whenever
      // the OS drops part of a schedule, and a screen that shows the intention
      // looks healthy while nothing is armed.
      let armed = items.length;
      try { const p = await plugin().getPending(); armed = (p && p.notifications || []).length; } catch (_) {}
      return { ok: true, count: armed, requested: items.length };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'error', count: 0 };
    }
  }

  // Fire one real notification a few seconds from now, through the very same
  // channel and icon the reminders use. This exists because every other failure
  // mode here is INVISIBLE: a rejected permission, a channel the user muted, a
  // battery optimiser holding the alarm — all of them look identical to "the
  // feature is broken". A test that either arrives or names its error turns the
  // whole path into something the owner can check in ten seconds.
  async function test() {
    if (!supported()) {
      // Web: prove the same thing with the browser's own notification. On Android
      // Chrome `new Notification()` is an ILLEGAL CONSTRUCTOR (it demands a
      // service worker, and this app deliberately unregisters those), so the
      // toast is the honest result there — not a failure.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification(tr('remind_test_title'), { body: tr('remind_test_body') }); return { ok: true, path: 'web' }; } catch (_) {}
      }
      try { showToast(`${tr('remind_test_title')} · ${tr('remind_test_body')}`); return { ok: true, path: 'toast' }; } catch (_) {}
      return { ok: false, reason: 'unsupported', path: 'web' };
    }
    try {
      await ensureChannels();
      // CHECK, do not REQUEST. The caller already ran gate(), which is the one
      // place allowed to raise the OS sheet. Asking a second time inside the same
      // tap is how two dismissals — and therefore a PERMANENT hard-deny on
      // Android 13+ — happen from a single button press.
      if ((await permissionState()) !== 'granted') return { ok: false, reason: 'denied', path: 'native' };
      await plugin().schedule({
        notifications: [{
          id: TEST_ID,
          title: tr('remind_test_title'),
          body: tr('remind_test_body'),
          channelId: channelId(),
          smallIcon: 'ic_stat_vault',
          iconColor: '#FF6A00',
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        }],
      });
      return { ok: true, path: 'native' };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'error', path: 'native' };
    }
  }

  // Everything the reminders screen needs to tell the user WHY nothing arrived.
  async function diagnose() {
    const out = {
      native: supported(),
      permission: await permissionState(),
      osEnabled: null,      // notifications switched off for the whole app
      exact: 'unsupported', // on-the-minute delivery
      pending: null,        // what Android actually holds for us
      scheduled: 0,         // what our own settings say there should be
      sound: true,
    };
    try { out.scheduled = DB.reminders.schedule().length; } catch (_) {}
    try { out.sound = DB.reminders.get().sound; } catch (_) {}
    if (!supported()) return out;
    try { out.osEnabled = (await plugin().areEnabled()).value; } catch (_) {}
    out.exact = await exactAlarmState();
    try { const p = await plugin().getPending(); out.pending = (p && p.notifications || []).length; } catch (_) {}
    return out;
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
    // A real system notification when the browser has granted it; the toast is
    // the fallback, and is all a WebView without permission can do.
    try {
      if (!supported() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification(titleFor(it), { body: bodyFor(it), tag: 'vault-' + it.id });
        n.onclick = () => { try { window.focus(); navigate(it.kind === 'water' ? 'food' : 'supplements'); } catch (_) {} };
        return;
      }
    } catch (_) {}
    try {
      showToast(`${titleFor(it)} · ${bodyFor(it)}`, {
        actionLabel: tr('open'),
        onAction: () => navigate(it.kind === 'water' ? 'food' : 'supplements'),
      });
    } catch (_) {}
  }

  window.Notify = {
    isNative: supported, sync, ensurePermission, permissionState, gate, catchUp, missed,
    test, diagnose, exactAlarmState, requestExactAlarms,
  };
})();
