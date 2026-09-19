// ==========================================================================
// THE VAULT — THE PRESENTATION VOCABULARY
//
// The second file out of js/app.js, and the opposite kind of cut from the
// first. js/food.js was a DOMAIN, chosen for having no lateral edges. This is
// the FLOOR: the bottom of the call graph, the words every view is written in
// — format a number, escape a string, find an element, open a sheet.
//
// THE MEMBERSHIP RULE, and it is a contract, not a convention (see contract 39
// in scripts/check-contracts.js):
//
//   A member of this file may read and write `DB.prefs`, and touch NOTHING
//   else of DB — no Cloud, no Health/Notify/FoodAI/VaultUpdate, no navigate(),
//   no renderView(), no view function.
//
// ⚠️ `DB.prefs` IS THE ONE EXCEPTION, AND IT IS A MEASURED ONE, NOT A LOOPHOLE.
// t() — the single most-called name in the app — reads DB.prefs.get().lang,
// and every weight formatter reads DB.prefs.get().unit. Unit and language ARE
// presentation settings; user DATA is what this file must never reach. A rule
// of "no DB at all" would have been cleaner to say and false to keep, so the
// rule says what is actually true and contract 39 enforces exactly that.
//
// ⚠️ LOADS AFTER js/i18n.js AND js/catalog.js, BEFORE js/food.js AND js/app.js.
// It is safe in both directions for the same reason js/food.js is: every name
// it borrows from another script — I18N, ICONS, DB, startOfWeek — is read at
// CALL time, and its ten top-level bindings all initialise to literals. There
// is not one top-level statement in this file.
//
// WHAT IS DELIBERATELY NOT HERE:
//   setUiLanguage()  — it re-renders. Applying a language is vocabulary;
//                      deciding to repaint is the router's job. applyLang()
//                      moved, setUiLanguage() stayed.
//   vaultBar()       — it reaches the unified search and the undo ledger, so
//                      it is chrome wired to the shell, not a primitive.
//   the ntf bar      — showNotifBar/ntfMount/ntfBindGesture close cleanly, but
//                      exactly one caller opens them (deliver), inside one
//                      domain. A surface with one caller is not shared; it
//                      belongs to the notifications view whenever that moves.
//   isNativeShell()  — one caller, and it sits under exportBackupFile's own
//                      doc comment. Moving it would have split a comment from
//                      the function it documents.
// ==========================================================================

// The glyphs are filled, so there is nothing here to tune: no stroke width, no
// caps, no joins. The per-size stroke bands and the ICON_CAPS exception map that
// used to live here both died with the stroked set — a filled mass keeps its
// weight at any size on its own.
//
// Colour comes from the CONTAINER, not from here: base = currentColor, accent =
// --icon-accent (see the "VAULT Duotone icons" block in styles.css).
// The icon SET is data and lives in js/catalog.js; this is the renderer.
// Same split as t() and js/i18n.js.
function icon(name, size = 20) {
  const path = ICONS[name] || '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${path}</svg>`;
}

// ==========================================================================
// Weight unit conversions
// ==========================================================================
const KG_TO_LB = 2.20462;

function convertWeightForDisplay(kg) {
  const unit = (DB.prefs.get().unit) || 'kg';
  if (unit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2; // nearest 0.5 lb
  return kg;
}

function convertWeightToStorage(value) {
  // Convert user-entered value (in current unit) back to kg for storage
  const unit = (DB.prefs.get().unit) || 'kg';
  if (unit === 'lb') return Math.round((value / KG_TO_LB) * 100) / 100;
  return Number(value);
}

function unitLabel() {
  return ((DB.prefs.get().unit) || 'kg') === 'lb' ? 'lb' : 'kg';
}

function fmtWeight(kg) {
  return fmtNum(convertWeightForDisplay(kg));
}

// Dual-unit weight: shows primary unit (per user's pref) + the other unit beside it.
// Returns inline HTML: "<span>60</span><span>kg</span><span class="w-alt">132 lb</span>"
function fmtWeightDual(kg) {
  const primary = (DB.prefs.get().unit) || 'kg';
  const kgVal = Math.round(kg * 10) / 10;
  const lbVal = Math.round(kg * KG_TO_LB * 2) / 2;
  if (primary === 'lb') {
    return `<span class="w-num num">${fmtNum(lbVal)}</span><span class="w-unit">lb</span><span class="w-alt"><span class="num">${fmtNum(kgVal)}</span> kg</span>`;
  }
  return `<span class="w-num num">${fmtNum(kgVal)}</span><span class="w-unit">kg</span><span class="w-alt"><span class="num">${fmtNum(lbVal)}</span> lb</span>`;
}

// Dual-unit weight, rounded to whole numbers — used for big totals like volume.
function fmtWeightDualRound(kg) {
  const primary = (DB.prefs.get().unit) || 'kg';
  const kgVal = Math.round(kg);
  const lbVal = Math.round(kg * KG_TO_LB);
  if (primary === 'lb') {
    return `<span class="w-num num">${fmtNum(lbVal)}</span><span class="w-unit">lb</span><span class="w-alt"><span class="num">${fmtNum(kgVal)}</span> kg</span>`;
  }
  return `<span class="w-num num">${fmtNum(kgVal)}</span><span class="w-unit">kg</span><span class="w-alt"><span class="num">${fmtNum(lbVal)}</span> lb</span>`;
}

// Day-of-week name (0 = Sunday)
function dayName(dow, full = false) {
  const keys = full
    ? ['dow_sun_full', 'dow_mon_full', 'dow_tue_full', 'dow_wed_full', 'dow_thu_full', 'dow_fri_full', 'dow_sat_full']
    : ['dow_sun', 'dow_mon', 'dow_tue', 'dow_wed', 'dow_thu', 'dow_fri', 'dow_sat'];
  return t(keys[dow] || 'dow_sun');
}

// ==========================================================================
// i18n — the two dictionaries live in js/i18n.js, which loads before this file
// ==========================================================================

function t(key, fallback) {
  const lang = (DB.prefs.get().lang) || 'en';
  return (I18N[lang] && I18N[lang][key]) || (I18N.en && I18N.en[key]) || (fallback !== undefined ? fallback : key);
}

function categoryLabel(cat) { return t('cat_' + cat, cat); }

// Localized days-ago
function daysAgoLocalized(iso) {
  if (!iso) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  if (diff < 7) return diff + ' ' + t('days_ago');
  if (diff < 30) return Math.floor(diff / 7) + ' ' + t('weeks_ago');
  return Math.floor(diff / 30) + ' ' + t('months_ago');
}

// ==========================================================================
// Theme & language
// ==========================================================================
// Two modes, not thirteen skins. The eleven alternate palettes were removed in
// v210: each one carried its own accent, so switching away from `dark` quietly
// dropped the brand — the app had no look of its own, it had a dropdown. Dark
// and light are now the SAME identity on two surfaces (see BRAND.md).
// THEME_ALIAS maps every retired id onto the mode it most resembles, so a user
// whose stored (and cloud-synced) pref is `nebula` lands on dark, not on the
// silent fallback. storage.js migrates the stored value on load; this is the
// second line of defence for a pref that arrives from the cloud mid-session.
const THEMES = ['dark', 'light'];
const THEME_ALIAS = {
  forest: 'dark', ocean: 'dark', mocha: 'dark', olive: 'dark', aurora: 'dark',
  sunset: 'dark', nebula: 'dark', slate: 'dark', dusk: 'dark',
  sand: 'light', frost: 'light',
};

function normalizeTheme(theme) {
  if (THEMES.includes(theme)) return theme;
  // hasOwnProperty, not a bare lookup: THEME_ALIAS['constructor'] resolves up the
  // prototype chain to a FUNCTION, which is truthy — and a pref can arrive from a
  // hand-edited backup or the synced blob.
  if (Object.prototype.hasOwnProperty.call(THEME_ALIAS, theme)) return THEME_ALIAS[theme];
  return 'dark';
}

function applyTheme(theme) {
  theme = normalizeTheme(theme);
  document.body.classList.remove(...THEMES.map((t) => 'theme-' + t));
  document.body.classList.add('theme-' + theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  // Must track --bg EXACTLY or the phone paints a seam above the app. Dark's
  // --bg is pure black (the ramp warms the surfaces, never the void); light's
  // is the bone ground. Keep these two in step with styles.css and with the
  // static <meta> in index.html, which covers the frames before this runs.
  // ⚠️ WHILE THE VAULT DOOR IS UP, THE BAR BELONGS TO THE DOOR. This runs
  // during init(), before the door may open, and the door is black on every
  // theme — so a light-theme user was handed DARK status-bar icons painted
  // over black for the whole launch. Only the two SURFACE signals wait (this
  // meta and the native bar below); the body class is applied as always, or
  // the app would be in the wrong theme at the moment the leaves part.
  // The splash teardown calls applyTheme again, which is idempotent.
  const splashUp = !!document.getElementById('splash');
  const ground = theme === 'light' ? '#faf5f0' : '#000000';
  if (meta) meta.setAttribute('content', splashUp ? '#000000' : ground);
  // The <meta> above only reaches BROWSERS. Inside the APK the Android status
  // and gesture bars are driven by Capacitor's built-in SystemBars plugin,
  // whose DEFAULT style resolves from the OS NIGHT MODE — not from ours.
  //
  // That mismatch is the whole "the status bar disappeared" report: VAULT picks
  // its own theme, so a phone set to system-light got DARK icons painted over
  // VAULT's #000000 page. The bar was never hidden, it was camouflaged. Only we
  // know which theme is actually on screen, so only we can answer this.
  //
  // 'DARK' means a DARK BAR BACKGROUND, i.e. LIGHT icons — the inverse of what
  // the name suggests. Verified in SystemBars.java: it maps to
  // setAppearanceLightStatusBars(!style.equals("DARK")).
  //
  // No-op off-native. It also STICKS: setStyle stores the resolved value and
  // re-applies that (never DEFAULT) on a configuration change, so rotating the
  // phone or toggling the OS theme cannot take the bar back.
  try {
    const sb = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SystemBars;
    if (sb && sb.setStyle) {
      const style = theme === 'light' ? 'LIGHT' : 'DARK';
      const p = sb.setStyle({ style: splashUp ? 'DARK' : style });
      if (p && p.catch) p.catch(() => {});
    }
  } catch (_) {}
}

function applyLang(lang) {
  if (lang !== 'ar') lang = 'en';
  document.documentElement.lang = lang;
  document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  // Update bottom nav labels (they have data-t)
  const nav = {};
  document.querySelectorAll('[data-t]').forEach((el) => {
    el.textContent = t(el.dataset.t);
    nav[el.dataset.t] = el.textContent;
  });
  // Mirrored beside theme/lang for index.html's pre-paint script, so the next
  // cold start paints the nav in this language before app.js has loaded.
  try { DB.prefs.mirrorUi({ nav }); } catch (_) {}
}

// ==========================================================================
// DOM helpers
// ==========================================================================
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * A numeric value safe to drop into an HTML ATTRIBUTE, for fields that are
 * numbers by contract but arrive from somewhere untrusted — the synced blob, an
 * imported backup, an AI response. Escaping would also work, but coercion is
 * stricter: a number field can only ever be a number, so nothing survives that
 * could break out of the quotes in the first place.
 * Empty in, empty out, so a blank set row still renders as blank.
 */
function numAttr(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

function initialsOf(str) {
  const parts = (str || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Always render numbers using Latin digits (English), regardless of UI language
function fmtNum(n) {
  return Number(n).toLocaleString('en-US');
}

// "A", "A and B", "A, B and C" — in whichever language is loaded. The one call
// site that needed this used to join with a hard-coded Arabic waw, so English
// read "Upper Chest وSide Delts": an RTL character mid-sentence in an LTR run,
// which the browser reorders into something unreadable rather than dropping.
function joinNames(names) {
  if (names.length < 2) return names[0] || '';
  return names.slice(0, -1).join(t('list_sep')) + t('list_and') + names[names.length - 1];
}

// Resize a File/Blob image to a smaller JPEG data URL (keeps localStorage manageable)
function resizeImageToDataUrl(file, maxSize = 800, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

let toastTimeout = null;
// Fully tear the toast down: hide it, drop the interactive state, cancel the
// timer, and remove any pause/resume listeners left by an action toast. Safe to
// call anytime (navigation, view change, before showing a new toast).
function hideToast() {
  const tEl = $('#toast');
  if (!tEl) return;
  clearTimeout(toastTimeout);
  tEl.classList.remove('show');
  tEl.classList.remove('has-action');
  // `.toast.show .toast-action` already drops pointer-events, and showToast's own
  // `spent` flag refuses the handler — measured: a click after expiry fires
  // nothing. But a hidden toast is opacity:0, not display:none, so the button
  // stayed FOCUSABLE: a keyboard or switch user tabbed to the end of the page
  // and landed on an announced, invisible "Undo" that does nothing.
  const spentAction = tEl.querySelector('.toast-action');
  if (spentAction) { spentAction.tabIndex = -1; spentAction.setAttribute('aria-hidden', 'true'); }
  if (tEl.__toastCleanup) { try { tEl.__toastCleanup(); } catch (_) {} tEl.__toastCleanup = null; }
}
// Plain text toast, OR — when `opts.actionLabel`/`opts.onAction` are given — a
// toast with a tappable action (e.g. "Undo"). The action toast is interactive
// only while shown — `.toast.show .toast-action` is what scopes that, and the
// `.show` half is not optional: hideToast() leaves the button in the DOM, and a
// hidden toast is opacity:0 rather than display:none, so without the gate it stays
// hit-testable. It also pauses its auto-hide while hovered/focused (WCAG 2.2.1).
function showToast(msg, opts) {
  const tEl = $('#toast');
  hideToast();   // clean any prior (action) toast + listeners first
  if (opts && opts.actionLabel && typeof opts.onAction === 'function') {
    tEl.classList.add('has-action');
    tEl.innerHTML = `<span class="toast-msg"></span><button type="button" class="toast-action"></button>`;
    tEl.querySelector('.toast-msg').textContent = msg;
    const btn = tEl.querySelector('.toast-action');
    btn.textContent = opts.actionLabel;
    const dur = opts.duration || 5000;
    let spent = false;
    const arm = () => { clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { spent = true; hideToast(); }, dur); };
    const pause = () => { if (!spent) clearTimeout(toastTimeout); };
    const resume = () => { if (!spent) arm(); };
    btn.addEventListener('click', () => {
      if (spent) return;
      spent = true;
      hideToast();
      try { opts.onAction(); } catch (_) {}
    });
    tEl.addEventListener('mouseenter', pause);
    tEl.addEventListener('mouseleave', resume);
    tEl.addEventListener('focusin', pause);
    tEl.addEventListener('focusout', resume);
    tEl.__toastCleanup = () => {
      tEl.removeEventListener('mouseenter', pause);
      tEl.removeEventListener('mouseleave', resume);
      tEl.removeEventListener('focusin', pause);
      tEl.removeEventListener('focusout', resume);
    };
    tEl.classList.add('show');
    arm();
  } else {
    tEl.textContent = msg;
    tEl.classList.add('show');
    toastTimeout = setTimeout(() => tEl.classList.remove('show'), 1800);
  }
}

// ==========================================================================
// Modal System
// ==========================================================================
// dismissible:false is for a dialog that MUST be answered — currently only the
// sync conflict, where walking away leaves the device in a state whose next
// launch can silently overwrite real data.
// The timer that removes a sheet AFTER its exit plays. It is cancelled by any
// new openModal, because that call rewrites #modal-root and the old node is
// gone already — letting the timer survive would let it wipe the NEW sheet.
let __modalExit = null;

function openModal(innerHtml, { variant = 'sheet', dismissible = true } = {}) {
  if (__modalExit) { clearTimeout(__modalExit); __modalExit = null; }
  const root = $('#modal-root');
  // BEFORE the rewrite below, and only from OUTSIDE the root. Writing innerHTML
  // destroys the sheet that is currently open, so a capture taken after it is
  // either a detached node or <body> — and closeModal's document.contains()
  // check then hands focus to nothing. Keeping the OUTERMOST anchor means a
  // sheet that opens another sheet still returns to the control that started it.
  const opener = document.activeElement;
  if (opener instanceof HTMLElement && opener !== document.body && !root.contains(opener)) {
    __modalReturnFocus = opener;
  }
  root.innerHTML = `
    <div class="modal-overlay ${variant === 'confirm' ? 'confirm-overlay' : ''}">
      <div class="${variant === 'confirm' ? 'confirm-dialog' : 'modal'}" role="dialog" aria-modal="true" tabindex="-1">
        ${variant === 'sheet' ? '<div class="sheet-handle"></div>' : ''}
        ${innerHtml}
      </div>
    </div>
  `;
  const overlay = root.querySelector('.modal-overlay');
  overlay.dataset.dismissible = dismissible ? '1' : '0';

  // The sheet RISES on its own — `.modal` has run `sheetUp` since long before
  // the motion spec, and a second mechanism here would fight it. All that is
  // marked is that this IS a bottom sheet, so closeModal knows to play an exit
  // and the drag knows what it may throw away. A confirm dialog gets neither:
  // it is a question and it should already be there.
  if (variant === 'sheet' && window.VltMotion) {
    overlay.classList.add('vlt-sheet');
    if (dismissible) {
      const sheet = overlay.querySelector('.modal');
      // The drag only REPORTS a dismissal; closeModal still owns closing, so
      // there is one answer to "what is on screen" and not two.
      VltMotion.dragToDismiss(sheet, closeModal);
    }
  }
  overlay.addEventListener('click', (e) => {
    if (!dismissible) return;
    if (e.target === overlay) closeModal();
  });
  overlay.querySelectorAll('[data-close]').forEach((el) => {
    // Every icon-only close button gets a screen-reader name in one place.
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t('close'));
    el.addEventListener('click', () => closeModal());
  });
  // Move focus into the dialog so keyboard/SR users start inside it (unless a
  // field inside will self-focus via autofocus).
  if (!overlay.querySelector('[autofocus]')) overlay.querySelector('.modal, .confirm-dialog')?.focus();

  // FOCUS TRAP: keep Tab inside the dialog. Without this, tabbing past the last
  // control walks into the page BEHIND the modal — which is still fully
  // interactive — so a keyboard user can silently operate the obscured screen.
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  // A modal opened over another (chooser → picker) left the previous trap
  // listening; closeModal removes only the current one.
  if (__modalKeydown) { document.removeEventListener('keydown', __modalKeydown, true); __modalKeydown = null; }
  __modalKeydown = (e) => {
    if (e.key === 'Escape') {
      // A dialog that must be answered ignores Escape as well as the backdrop.
      if (overlay.dataset.dismissible === '0') { e.preventDefault(); return; }
      e.preventDefault(); closeModal(); return;
    }
    if (e.key !== 'Tab') return;
    const items = [...overlay.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };
  document.addEventListener('keydown', __modalKeydown, true);
  return overlay;
}

let __modalReturnFocus = null;
let __modalKeydown = null;

function closeModal() {
  if (__modalKeydown) { document.removeEventListener('keydown', __modalKeydown, true); __modalKeydown = null; }
  const root = $('#modal-root');
  const leaving = root.querySelector('.modal-overlay.vlt-sheet');

  // Focus goes back FIRST and synchronously. It must not wait on an animation:
  // a caller that closes and immediately opens another sheet, or navigates,
  // would otherwise land with focus on <body>.
  try { if (__modalReturnFocus && document.contains(__modalReturnFocus)) __modalReturnFocus.focus(); } catch (_) {}
  __modalReturnFocus = null;

  if (!leaving) { root.innerHTML = ''; return; }
  leaving.classList.add('is-out');
  if (__modalExit) clearTimeout(__modalExit);
  // +60ms of slack over the token, and the node identity is re-checked: if a
  // new sheet opened in the meantime this timer must not wipe it.
  const ms = (window.VltMotion ? VltMotion.token('--dur-fast', 260) : 260) + 60;
  __modalExit = setTimeout(() => {
    __modalExit = null;
    if (root.querySelector('.modal-overlay') === leaving) root.innerHTML = '';
  }, ms);
}

function confirmDialog({ title, text, onConfirm, confirmLabel, variant = 'danger' }) {
  if (!confirmLabel) confirmLabel = t('delete');
  const btnClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
  const overlay = openModal(`
    <div class="confirm-title">${escapeHtml(title)}</div>
    <div class="confirm-text">${escapeHtml(text)}</div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="${btnClass}" data-ok>${escapeHtml(confirmLabel)}</button>
    </div>
  `, { variant: 'confirm' });
  overlay.querySelector('[data-ok]').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// ==========================================================================
// THE MARK — "AJ" lockup (handoff 00-START-HERE §1). Supersedes THE CUT.
//
// Two half-plates flanking two stacked words: VAULT in cream over TRAIN in
// orange mono. The plates are not a new drawing — they are ICONS.dumbbell cut
// in half by a cropped viewBox, so if that icon ever changes the mark follows
// it automatically. The spec pins those two viewBox strings and forbids
// touching them, which is why they are literals here and not computed.
//
// ONLY TWO SIZES EXIST, per the spec: header (VAULT 11) and splash (VAULT 32).
// No intermediate sizes, so this takes a name rather than a number — a caller
// cannot invent a third by passing 18.
//
// The three proportions are locked to the VAULT size: plate = 1.35x,
// TRAIN = 0.5x, gap = 0.57x. They are computed here rather than written out
// twice so a future size cannot drift out of ratio.
// ==========================================================================
function brandLockup(size = 'header') {
  const v = size === 'splash' ? 32 : 11;      // VAULT font-size
  const plateH = Math.round(v * 1.35 * 10) / 10;
  const plateW = Math.round(plateH * (10 / 15) * 10) / 10;   // the spec's 10x15 aspect
  const sub = Math.round(v * 0.5 * 10) / 10;
  const gap = Math.round(v * 0.57 * 10) / 10;
  // RULE 5, restored. v264 changed this guard from `v >= 10` to `sub >= 11` and
  // called it a bug fix. It was the opposite: the handoff's floor is on the
  // VAULT size, not on the rendered sub size, and it says TRAIN at 5.5px WORKS —
  // "يعمل فقط بخط مونو وبتباعد .3em" — dropping it only below VAULT 10. The
  // header is VAULT 11, above the floor, and the spec pins the header at three
  // parts in three separate places: rule 5, the §1 markup comment
  // ("plateH 15 · VAULT 11 · TRAIN 5.5 · gap 6") and §4 ("بمقاس ١٥/١١/٥٫٥").
  // So v264 silently deleted a third of the wordmark from every header.
  //
  // The two conditions the spec attaches to 5.5px are real and are met:
  // styles.css .bl-sub sets 'JetBrains Mono' and letter-spacing .3em. A general
  // 11px minimum is the right rule for CONTENT; this is a wordmark, and
  // overriding the owner's approved identity on my own reading of a body-text
  // rule was the actual error.
  const showSub = v >= 10;
  return `
    <div dir="ltr" class="brand-lockup brand-${size}" style="gap:${gap}px">
      <svg viewBox="1.5 6 8 12" width="${plateW}" height="${plateH}" aria-hidden="true">
        <rect x="1.5" y="9" width="3" height="6" rx="1.2" fill="currentColor"/>
        <rect x="5.5" y="6" width="4" height="12" rx="1.6" fill="currentColor"/>
      </svg>
      <span class="bl-text">
        <span class="bl-name" style="font-size:${v}px">VAULT</span>
        ${showSub ? `<span class="bl-sub" style="font-size:${sub}px">TRAIN</span>` : ''}
      </span>
      <svg viewBox="14.5 6 8 12" width="${plateW}" height="${plateH}" aria-hidden="true">
        <rect x="14.5" y="6" width="4" height="12" rx="1.6" fill="currentColor"/>
        <rect x="19.5" y="9" width="3" height="6" rx="1.2" fill="currentColor"/>
      </svg>
    </div>`;
}

// ==========================================================================
// Helpers shared
// ==========================================================================
// Compact, icon-less empty state (the large graphic was dropped app-wide for a
// cleaner look). iconName is kept in the signature for call-site compatibility
// but is no longer rendered.
function emptyState({ iconName, title, text }) {
  return `
    <div class="empty">
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-text">${escapeHtml(text)}</div>
    </div>
  `;
}

// Full-screen image viewer. Tap anywhere (or the close button) to dismiss.
function openImageLightbox(src, alt) {
  // Defense in depth: the caller already filters via exerciseImgSrc, but a
  // reusable helper re-checks the scheme so a future caller can't skip it.
  if (!src || !/^(data:image\/|https?:\/\/)/i.test(src) || /["'<>`\\\s]/.test(src)) return;
  document.querySelector('.img-lightbox')?.remove();
  const prevFocus = document.activeElement;
  const label = alt || t('view_photo');
  const box = document.createElement('div');
  box.className = 'img-lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', label);
  box.innerHTML = `
    <button type="button" class="img-lightbox-close" aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button>
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" referrerpolicy="no-referrer">
  `;
  const close = () => { box.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  box.addEventListener('click', close);
  document.body.appendChild(box);
  requestAnimationFrame(() => { box.classList.add('open'); box.querySelector('.img-lightbox-close')?.focus(); });
}

function deltaBlock(current, previous, unit) {
  if (current === 0 && previous === 0) {
    return `<div class="compare-delta flat">${icon('minus', 16)} ${t('no_data_short')}</div>`;
  }
  if (current > previous) {
    return `<div class="compare-delta up">${icon('arrowUp', 16)} +${formatDelta(current - previous)}${unit ? ' ' + unit : ''}</div>`;
  }
  if (current < previous) {
    return `<div class="compare-delta down">${icon('arrowDown', 16)} -${formatDelta(previous - current)}${unit ? ' ' + unit : ''}</div>`;
  }
  return `<div class="compare-delta flat">${icon('minus', 16)} ${t('same_as_last_week')}</div>`;
}

// fmtNum, not toString: weekly tonnage deltas run into the thousands, and a bare
// "+3760" next to a value rendered as "6,460" reads as a different kind of number.
function formatDelta(n) { return fmtNum(Math.round(n * 10) / 10); }

// Count-up animation for hero/stat numerals (rAF, ease-out cubic).
// Respects prefers-reduced-motion and cancels a previous run on re-render
// so navigating away and back never leaks a frame callback.
function animateNum(el, target, opts) {
  const ms = (opts && opts.ms) || 600;
  const fmt = (opts && opts.fmt) || fmtNum;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = fmt(target);
    return;
  }
  if (el.__animNum) cancelAnimationFrame(el.__animNum);
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (p < 1) el.__animNum = requestAnimationFrame(step);
    else el.__animNum = null;
  };
  el.__animNum = requestAnimationFrame(step);
}
