// Reminders for THE VAULT.
//
// Two delivery paths, one schedule (DB.notif.scheduleAll()):
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
    // Still DB.reminders on purpose: `sound` picks WHICH immutable OS channel to
    // post through, a delivery property. The SCHEDULE moved to DB.notif; this
    // did not need to, and moving it would mean recreating both channels.
    try { return DB.reminders.get().sound ? CH_ALERT : CH_QUIET; } catch (_) { return CH_ALERT; }
  }

  // THE WORDS COME FROM ONE PLACE — DB.notif.text() — and this file no longer
  // has an opinion about them.
  //
  // What used to live here was a second, poorer builder: it read only
  // `item.payload`, passed just {n}, and then STRIPPED every placeholder it had
  // not filled. Because this file feeds the OS notifications, the web
  // notifications and the catch-up — everything that actually reaches a phone —
  // '{cur} of {goal} ml' was delivered reading literally "of ml", while the good
  // builder in app.js was reachable only from the in-app bar. Two builders for
  // one sentence is how a defect hides in plain sight for months.
  function textFor(it) {
    try { return DB.notif.text(it); } catch (_) { return { title: '', body: '' }; }
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
    const txt = textFor(it);
    // Stash the exact words on the item so sync() can write them into the armed
    // manifest. Reconciliation replays THESE, not a re-render — the notification
    // really did say this, and re-rendering later would rewrite history the
    // moment a template or the UI language changed.
    it.title = txt.title;
    it.body = txt.body;
    it.lang = (DB.prefs.get().lang) || 'en';
    return {
      id: it.id,
      title: txt.title,
      body: txt.body,
      channelId: channelId(),
      // The plugin's fallback small icon is android.R.drawable.ic_dialog_info —
      // a fully opaque asset, and Android draws a small icon from its ALPHA
      // channel only, so the status bar showed a featureless white blob. This
      // names the white-on-transparent VAULT mark instead (res/drawable).
      smallIcon: 'ic_stat_vault',   // NEVER per-channel: the small mark is identity
      // Per channel (§1.2). These resolve to res/drawable/cat_<channel>_192.png,
      // which UNTIL NOW DID NOT EXIST: the generator writes them to icons/ with
      // HYPHENS (cat-train-192.png) for the web Notification path, and
      // build-www only copies icons/ into www/. Android needs underscores and
      // needs them in res/drawable, so getLargeIcon() was calling
      // decodeResource(res, 0) and getting null on every notification — silently,
      // because a missing large icon is not an error. Copied in now, but they are
      // a NATIVE resource: this one reaches nobody until a new APK is installed.
      largeIcon: 'cat_' + (it.channel || 'summary') + '_192',
      iconColor: '#FF6A00',
      // AN ABSOLUTE, DATED TRIGGER — not `{on:{hour,minute}}`.
      //
      // `on` with no date repeats daily FOREVER at that wall-clock time. But
      // every condition behind the item was evaluated for ONE day: is it a
      // training day, is the streak unextended, has the goal been met. So the
      // training alarm went on firing through rest days and the streak alarm
      // through a broken streak, until some foreground happened to re-sync.
      // A repeat cannot express "not on Thursday"; a dated one-shot can, and
      // DB.notif.scheduleAhead() arms one per day with that day's own answers.
      //
      // Seconds and milliseconds are pinned to 0 by _dateOf for the reason the
      // old `second: 0` existed: postponeTriggerIfNeeded compares with <=, so a
      // stray second from whenever sync() ran can push an alarm a full day out.
      //
      // The second thing this buys is observability. A daily repeat never leaves
      // getPending(), so "did it fire?" was unanswerable — which is why the app
      // could never show a history. A one-shot disappears when it fires.
      schedule: { at: DB.notif._dateOf(it.date, it.hour, it.minute), allowWhileIdle: true },
    };
  }

  // Cancel everything we own, then re-schedule from the current settings. Full
  // replace rather than diffing: the schedule is small, and a partial update is
  // how you end up with an orphaned alarm for a supplement that was deleted.
  async function sync() {
    if (!supported()) return { ok: false, reason: 'unsupported', count: 0 };
    try {
      await ensureChannels();
      bindListeners();
      // ONE SYSTEM. This used to read DB.reminders.schedule(), so the OS alarms
      // and the in-app reminders were computed from two different configs: an
      // Android user could be told about the same dose twice, and a channel
      // switched off on the notifications page still fired natively.
      // DB.notif.scheduleAll() is now the only place a reminder is decided, so
      // its guards — daily cap, wake window, yield order, per-channel switch —
      // finally apply to the native path too, which they never did before.
      DB.notif.migrateFromReminders();
      // Today plus the next ARM_DAYS days, each computed with ITS OWN
      // conditions. See notificationFor() for why this replaced a daily repeat.
      const items = DB.notif.scheduleAhead();

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

      // The SAME rule, for the empty case — which the old guard let through.
      // `if (!allowed && items.length)` only protected a permission loss; an
      // empty list fell straight into the orphan sweep below, which then
      // cancelled every armed alarm and returned "ok". And scheduleAhead() can
      // legitimately come back empty for a moment: the blob mid-pull, the day's
      // cap spent, every tag already sent. One such foreground disarmed the
      // device until the next successful sync.
      //
      // Nothing CONFIGURED is a real instruction to cancel. Nothing COMPUTED
      // while channels are still on is a transient, and the safe failure is to
      // leave the previous schedule alone.
      const cfgNow = DB.notif.get();
      const anyOn = Object.keys(cfgNow.channels).some((k) => cfgNow.channels[k].on);
      if (!items.length && anyOn) return { ok: false, reason: 'empty', count: 0 };

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
      if (!items.length) { DB.notif.armedSet([]); return { ok: true, count: 0 }; }
      // notificationFor() stamps title/body/lang onto each item as it builds it,
      // so the manifest is written AFTER the map, not before.
      const payload = items.map(notificationFor);
      await plugin().schedule({ notifications: payload });
      // What we handed the OS, so a later foreground can tell which of these
      // fired while the app was dead. See reconcile().
      DB.notif.armedSet(items);
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
    // The test lands in the log too, deliberately: the owner uses this button to
    // prove the pipe works, and seeing it appear proves the LOG works in the
    // same tap. Tag carries the clock so repeated tests each record.
    const logTest = () => {
      try {
        const now = new Date();
        DB.notif.logAdd({
          tag: 'test:' + now.getTime(), date: todayISO(),
          at: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
          channel: 'summary', title: tr('remind_test_title'), body: tr('remind_test_body'), path: 'test',
        });
      } catch (_) {}
    };
    if (!supported()) {
      // Web: prove the same thing with the browser's own notification. On Android
      // Chrome `new Notification()` is an ILLEGAL CONSTRUCTOR (it demands a
      // service worker, and this app deliberately unregisters those), so the
      // toast is the honest result there — not a failure.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification(tr('remind_test_title'), { body: tr('remind_test_body') }); logTest(); return { ok: true, path: 'web' }; } catch (_) {}
      }
      try { showToast(`${tr('remind_test_title')} · ${tr('remind_test_body')}`); logTest(); return { ok: true, path: 'toast' }; } catch (_) {}
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
      logTest();
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
    // What we would arm right now, across the whole ARM_DAYS horizon — this is
    // the number `pending` should match, so comparing them is the check.
    try { out.scheduled = DB.notif.scheduleAhead().length; } catch (_) {}
    try { out.armDays = DB.notif.ARM_DAYS; } catch (_) {}
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
    // includePast is the ONLY difference between "what is still coming" and
    // "what did I miss" — so both questions run the same guards, and the two
    // answers cannot drift apart.
    return DB.notif.scheduleForDate(day, { includePast: true }).filter((it) => {
      if (it.hour * 60 + it.minute > nowMin) return false;          // not due yet
      if (alreadySeen(day, it.id)) return false;                     // already nagged today
      // The "already satisfied" checks that used to live only here — water's
      // goal, a dose already ticked off — are inside scheduleForDate now, so
      // the OS alarms honour them too. They never did before: this filter was
      // the only place the water goal was consulted, which is why the phone
      // kept nagging after 2,500 ml while the toast politely stayed quiet.
      return true;
    });
  }

  // One toast, for the oldest outstanding item — never a queue of them.
  function catchUp() {
    // The gate used to be `DB.reminders.get().enabled` — a v208 flag that
    // defaults to false and is now written by nothing. A user who configured
    // everything on the notifications page got NO catch-up at all. The
    // per-channel switches inside scheduleForDate are the real gate.
    const list = missed();
    if (!list.length) return;
    const it = list[0];
    markSeen(todayISO(), it.id);
    const { title, body } = textFor(it);
    if (!title) return;
    // `it.channel`, not `it.kind`. `kind` belonged to the retired
    // DB.reminders.schedule() and is undefined on these items, so the old
    // ternary was always false and EVERY catch-up tap — water, training,
    // streak — opened the supplements screen.
    const dest = DB.notif.destFor(it.channel);
    const go = () => { try { navigate(dest.view, dest.context); } catch (_) {} };
    DB.notif.logAdd({ tag: it.tag, date: it.date, at: it.at, channel: it.channel, title, body, path: 'catchup' });
    // A real system notification when the browser has granted it; the toast is
    // the fallback, and is all a WebView without permission can do.
    try {
      if (!supported() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification(title, { body, tag: 'vault-' + it.id });
        n.onclick = () => { try { window.focus(); } catch (_) {} go(); };
        return;
      }
    } catch (_) {}
    try {
      showToast(`${title} · ${body}`, { actionLabel: tr('open'), onAction: go });
    } catch (_) {}
  }

  // ------------------------------------------------------------ reconcile ---
  //
  // Which of the alarms we armed actually fired while the app was dead? Nothing
  // in the app could answer that before, so there was no history to show.
  //
  // Primary source: getDeliveredNotifications() — what is genuinely sitting in
  // the shade right now, with ids. Definitive.
  // Fallback: the armed manifest. An entry that is no longer in getPending() and
  // whose time has passed must have fired. This ONLY works because the alarms
  // are dated one-shots now; a daily repeat never leaves getPending().
  //
  // The honest limit: the fallback cannot tell "delivered" from "Doze sat on it
  // and it never appeared", and a user who swipes the shade clears the primary
  // source. That is why `path` is recorded — it keeps the distinction for
  // debugging — and why it is not shown to the user, who cannot act on it.
  async function reconcile() {
    if (!supported()) return 0;
    let added = 0;
    const manifest = DB.notif.armedGet();
    if (!manifest.length) return 0;
    const byId = {};
    manifest.forEach((m) => { byId[m.id] = m; });

    try {
      if (typeof plugin().getDeliveredNotifications === 'function') {
        const d = await plugin().getDeliveredNotifications();
        ((d && d.notifications) || []).forEach((n) => {
          const m = byId[n.id];
          if (m && DB.notif.logAdd(Object.assign({}, m, { path: 'os' }))) added += 1;
        });
      }
    } catch (_) {}

    try {
      const p = await plugin().getPending();
      const pend = new Set(((p && p.notifications) || []).map((n) => n.id));
      const now = Date.now();
      manifest.forEach((m) => {
        if (pend.has(m.id)) return;                       // still armed, has not fired
        if (!m.date || !m.at) return;
        const h = Number(String(m.at).split(':')[0]) || 0;
        const mi = Number(String(m.at).split(':')[1]) || 0;
        if (DB.notif._dateOf(m.date, h, mi).getTime() > now) return;   // not due yet
        if (DB.notif.logAdd(Object.assign({}, m, { path: 'reconciled' }))) added += 1;
      });
    } catch (_) {}
    return added;
  }

  // ------------------------------------------------------------- listeners ---
  //
  // Both are pure JS on the plugin that is ALREADY installed — no new
  // permission, no new APK. Without them, tapping a real VAULT notification
  // just opened the app to Home and the app never learned a reminder had been
  // delivered at all.
  let listenersBound = false;
  function bindListeners() {
    // Lazy, not at file load: this file is evaluated before Capacitor has
    // necessarily injected window.Capacitor, so binding eagerly would silently
    // no-op on exactly the platform the listeners exist for. sync() runs at boot
    // and on every foreground, which is late enough and often enough.
    if (listenersBound || !supported() || typeof plugin().addListener !== 'function') return;
    listenersBound = true;
    try {
      plugin().addListener('localNotificationReceived', (n) => {
        const m = DB.notif.armedGet().find((x) => x.id === (n && n.id));
        if (m) DB.notif.logAdd(Object.assign({}, m, { path: 'os' }));
      });
    } catch (_) {}
    try {
      plugin().addListener('localNotificationActionPerformed', (e) => {
        const id = e && e.notification && e.notification.id;
        const m = DB.notif.armedGet().find((x) => x.id === id);
        if (!m) return;
        const rec = DB.notif.logAdd(Object.assign({}, m, { path: 'os', seen: true }));
        if (!rec) { try { DB.notif.logList().forEach((r) => { if (r.tag === m.tag) DB.notif.logMarkSeen(r.id); }); } catch (_) {} }
        const dest = DB.notif.destFor(m.channel);
        try { navigate(dest.view, dest.context); } catch (_) {}
      });
    } catch (_) {}
  }

  window.Notify = {
    isNative: supported, sync, ensurePermission, permissionState, gate, catchUp, missed,
    test, diagnose, exactAlarmState, requestExactAlarms, reconcile,
  };
})();
