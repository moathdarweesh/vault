// ==========================================================================
// THE CATALOG — the app's static data, and nothing else
// ==========================================================================
// Lifted out of js/app.js, which is documented as "ALL views/rendering + the
// router". None of this is either: it is the icon set, the workout templates,
// the muscle map, the two exercise-name maps and the food presets — 570 lines
// that never change at runtime and that no view needs to read line by line.
//
// ⚠️ THIS FILE MUST LOAD BEFORE js/app.js, for the same reason js/i18n.js does:
// a top-level `const` in a classic script lives in the shared global LEXICAL
// scope, so app.js can read these — but only once this script has executed.
// Contract 1 enforces the order.
//
// Three contracts read this file rather than app.js now: the exercise-name
// maps must agree with each other and with the seeds (13), the seven glyphs
// duplicated in index.html and update.js must match their masters (22), and
// every icon('name') in the scripts must be a key here (23).
// ==========================================================================

// ==========================================================================
// Icons
// ==========================================================================
// VAULT Duotone (v3) — FILLED two-layer glyphs, no stroke anywhere.
//
// Every glyph is two masses on the same 24 grid: the base in `currentColor`
// (so it follows whatever colour its container already sets) and the accent in
// `var(--icon-accent)`. That is the whole system — a state change recolours a
// MASS rather than a 2px line, which is why an active tab now reads instantly.
//
// This replaced the stroked "VAULT Machined" set: because there is no stroke,
// the three per-size stroke-width bands and the ICON_CAPS exception map are
// gone, and ONE path set reads correctly at 16px and at 40px. It also removes
// the known defect where the bottom nav hard-coded stroke-width 2/2.4 at 22px
// and rendered ~14% heavier than the same glyph elsewhere.
//
// `apple` and `palette` survive as aliases at the bottom, so no call site broke.
const ICONS = {
  // ——— core & nav ———
  home: '<path d="M12 2.6 1.8 11.2h3.4v10.2h13.6V11.2h3.4Z" fill="currentColor"/><path d="M9.2 21.4V15.4h5.6v6Z" fill="var(--icon-accent,#ff6a00)"/>',
  // Five-bar field: the outer pair sits back at 55% opacity, the inner pair full
  // currentColor, the centre bar takes the accent — three tones, one colour token.
  calendar: '<rect x="6.8" y="1.8" width="2.6" height="4.4" rx="1.3" fill="currentColor"/><rect x="14.6" y="1.8" width="2.6" height="4.4" rx="1.3" fill="currentColor"/><path d="M2.6 9.6h18.8v8.4a3.4 3.4 0 0 1-3.4 3.4H6a3.4 3.4 0 0 1-3.4-3.4Z" fill="currentColor"/><path d="M6 4.2h12a3.4 3.4 0 0 1 3.4 3.4v2H2.6v-2A3.4 3.4 0 0 1 6 4.2Z" fill="var(--icon-accent,#ff6a00)"/>',
  chart: '<rect x="2.4" y="19.4" width="19.2" height="2.4" rx="1.2" fill="currentColor"/><rect x="4.4" y="12.4" width="4.2" height="5.6" rx="1.4" fill="currentColor"/><rect x="15.4" y="9.4" width="4.2" height="8.6" rx="1.4" fill="currentColor"/><rect x="9.9" y="5.4" width="4.2" height="12.6" rx="1.4" fill="var(--icon-accent,#ff6a00)"/>',
  dumbbell: '<rect x="1.5" y="9" width="3" height="6" rx="1.2" fill="currentColor"/><rect x="5.5" y="6" width="4" height="12" rx="1.6" fill="currentColor"/><rect x="14.5" y="6" width="4" height="12" rx="1.6" fill="currentColor"/><rect x="19.5" y="9" width="3" height="6" rx="1.2" fill="currentColor"/><rect x="9.5" y="10.4" width="5" height="3.2" fill="var(--icon-accent,#ff6a00)"/>',
  moon: '<path d="M21.4 15.2A9.4 9.4 0 0 1 8.8 2.6 9.4 9.4 0 1 0 21.4 15.2Z" fill="currentColor"/><circle cx="17.6" cy="5.2" r="1.7" fill="var(--icon-accent,#ff6a00)"/><circle cx="21" cy="9.8" r="1" fill="var(--icon-accent,#ff6a00)"/>',
  bed: '<path d="M2.4 7.6h2.8v6H18a3.6 3.6 0 0 1 3.6 3.6v4.2h-2.8v-3.4H5.2v3.4H2.4Z" fill="currentColor"/><rect x="6.2" y="8.8" width="5.6" height="3.6" rx="1.8" fill="var(--icon-accent,#ff6a00)"/>',
  utensils: '<rect x="8.9" y="10.4" width="2.4" height="11" rx="1.2" fill="currentColor"/><path d="M17.8 21.4h-2.4v-7.6c-1.5-.5-2.4-2.2-2.4-4.8 0-3.6 1.7-6.2 3.4-6.2h1.4Z" fill="currentColor"/><path d="M6 2.6h1.9v4.6h1.2V2.6H11v4.6h1.2V2.6h1.9v5.2a4 4 0 0 1-8 0Z" fill="var(--icon-accent,#ff6a00)"/>',
  meal: '<path d="M2.4 11.2h19.2c-.5 5-4.6 8.8-9.6 8.8s-9.1-3.8-9.6-8.8Z" fill="currentColor"/><path d="M8.6 8.4c0-1.8 1.6-1.8 1.6-3.6h1.6c0 2.4-1.6 2.4-1.6 3.6Z" fill="var(--icon-accent,#ff6a00)"/><path d="M13.2 8.4c0-1.8 1.6-1.8 1.6-3.6h1.6c0 2.4-1.6 2.4-1.6 3.6Z" fill="var(--icon-accent,#ff6a00)"/>',
  heart: '<path d="M12 21.3S2.6 15.8 2.6 9.6a4.9 4.9 0 0 1 9.4-2Z" fill="currentColor"/><path d="M12 7.6a4.9 4.9 0 0 1 9.4 2c0 6.2-9.4 11.7-9.4 11.7Z" fill="var(--icon-accent,#ff6a00)"/>',
  heartPulse: '<path d="M12 21.3S2.6 15.8 2.6 9.6a4.9 4.9 0 0 1 9.4-2 4.9 4.9 0 0 1 9.4 2c0 6.2-9.4 11.7-9.4 11.7Z" fill="currentColor"/><path d="M1.6 11h5.6l1.8-3 2.8 5.6 2-3.4h8.6v2.4h-7.2l-3.6 6-2.8-5.6-.6 1H1.6Z" fill="var(--icon-accent,#ff6a00)"/>',

  // ——— actions ———
  plus: '<path d="M4 10.6h16v2.8H4Z" fill="currentColor"/><path d="M10.6 4h2.8v16h-2.8Z" fill="var(--icon-accent,#ff6a00)"/>',
  minus: '<path d="M4 10.6h10.4v2.8H4Z" fill="currentColor"/><path d="M14.4 10.6H20v2.8h-5.6Z" fill="var(--icon-accent,#ff6a00)"/>',
  close: '<path d="M6.3 4.3 19.7 17.7l-2 2L4.3 6.3Z" fill="currentColor"/><path d="M17.7 4.3 19.7 6.3 6.3 19.7l-2-2Z" fill="var(--icon-accent,#ff6a00)"/>',
  back: '<path d="M15.4 2.6 17.4 4.6 8.6 13.4 6.6 11.4Z" fill="currentColor"/><path d="M6.6 12.6 8.6 10.6 17.4 19.4 15.4 21.4Z" fill="var(--icon-accent,#ff6a00)"/>',
  chevronRight: '<path d="M8.6 2.6 6.6 4.6 15.4 13.4 17.4 11.4Z" fill="currentColor"/><path d="M17.4 12.6 15.4 10.6 6.6 19.4 8.6 21.4Z" fill="var(--icon-accent,#ff6a00)"/>',
  trash: '<path d="M6 7.4h12l-.9 12.2a2.4 2.4 0 0 1-2.4 2.2H9.3a2.4 2.4 0 0 1-2.4-2.2Z" fill="currentColor"/><path d="M9.4 2.6h5.2a1.5 1.5 0 0 1 1.5 1.5v.9H20v2.4H4V5h3.9v-.9a1.5 1.5 0 0 1 1.5-1.5Z" fill="var(--icon-accent,#ff6a00)"/>',
  edit: '<path d="M2.8 21.2v-4.6L13.8 5.6l4.6 4.6L7.4 21.2Z" fill="currentColor"/><path d="M15.4 4 16.8 2.6a2.8 2.8 0 0 1 4 4L19.4 8Z" fill="var(--icon-accent,#ff6a00)"/>',
  check: '<path d="M9.4 18.6 7.3 16.5 18.4 5l2.2 2.2Z" fill="currentColor"/><path d="M9.4 18.6 3.4 12.6l2.2-2.2 5.9 5.9Z" fill="var(--icon-accent,#ff6a00)"/>',
  search: '<path d="M10.4 2.8a7.6 7.6 0 1 0 0 15.2 7.6 7.6 0 0 0 0-15.2Zm0 2.9a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Z" fill="currentColor"/><path d="m15.7 17.7 2-2 4.1 4.1-2 2Z" fill="var(--icon-accent,#ff6a00)"/>',
  arrowUp: '<path d="M10.6 6h2.8v15h-2.8Z" fill="currentColor"/><path d="M12 2.8 19.4 10.2l-2 2-5.4-5.4-5.4 5.4-2-2Z" fill="var(--icon-accent,#ff6a00)"/>',
  arrowDown: '<path d="M10.6 3h2.8v15h-2.8Z" fill="currentColor"/><path d="M12 21.2 4.6 13.8l2-2 5.4 5.4 5.4-5.4 2 2Z" fill="var(--icon-accent,#ff6a00)"/>',
  grip: '<circle cx="9" cy="6.6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="17.4" r="1.5" fill="currentColor"/><circle cx="15" cy="6.6" r="1.5" fill="var(--icon-accent,#ff6a00)"/><circle cx="15" cy="12" r="1.5" fill="var(--icon-accent,#ff6a00)"/><circle cx="15" cy="17.4" r="1.5" fill="var(--icon-accent,#ff6a00)"/>',
  play: '<path d="M7.6 4.4a1.4 1.4 0 0 1 2.1-1.2l6.5 4.7v8.2l-6.5 4.7a1.4 1.4 0 0 1-2.1-1.2Z" fill="currentColor"/><path d="M16.2 7.9l3.1 2.3a1.4 1.4 0 0 1 0 2.3l-3.1 2.3Z" fill="var(--icon-accent,#ff6a00)"/>',
  send: '<path d="M21.6 2.4 2.4 9.8l7.4 3.8Z" fill="currentColor"/><path d="M21.6 2.4 13.8 21.6l-3.8-7.4Z" fill="var(--icon-accent,#ff6a00)"/>',

  // ——— cardio & movement ———
  run: '<path d="M14.6 7.6 8.4 11l2 3.8-4 6.4 2.8 1.6 4.6-7.2-1.4-2.6 3-1.6 3.4 2.2 1.6-2.6-4.2-2.8Z" fill="currentColor"/><circle cx="16.4" cy="4.6" r="2.7" fill="var(--icon-accent,#ff6a00)"/>',
  walk: '<path d="M11.2 7.4 8 13.4l2.4 2.2-1.8 5.8 2.8.8 2.2-7-1.6-1.8 1.6-2.4 2.4 1.8 1.4 3.6 2.6-1-1.8-4.6Z" fill="currentColor"/><circle cx="13" cy="4.2" r="2.7" fill="var(--icon-accent,#ff6a00)"/>',
  bike: '<path d="M5.6 12.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 2.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="currentColor"/><path d="M18.4 12.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 2.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="currentColor"/><path d="M9.2 5.6h4.6l4.8 10.6-2.2 1-4.2-9.2H9.2Z" fill="var(--icon-accent,#ff6a00)"/><path d="m12.6 7.4 2.4.6-2.6 8.8-2.4-.7Z" fill="var(--icon-accent,#ff6a00)"/>',
  treadmill: '<path d="M4.6 13.6h10.8a3.4 3.4 0 0 1 0 6.8H4.6a3.4 3.4 0 0 1 0-6.8Z" fill="currentColor"/><path d="M16.6 17.4V6.4h-4.4V4h6.8v13.4Z" fill="var(--icon-accent,#ff6a00)"/>',
  columns: '<rect x="3.4" y="3.4" width="6.4" height="17.2" rx="2.6" fill="currentColor"/><rect x="14.2" y="9.4" width="6.4" height="11.2" rx="2.6" fill="var(--icon-accent,#ff6a00)"/>',

  // ——— data & body ———
  droplet: '<path d="M12 2.4s6.6 6.8 6.6 10.8a6.6 6.6 0 0 1-13.2 0C5.4 9.2 12 2.4 12 2.4Z" fill="currentColor"/><path d="M12 19.8a6.6 6.6 0 0 0 6.6-6.6h-3.2A3.4 3.4 0 0 1 12 16.6Z" fill="var(--icon-accent,#ff6a00)"/>',
  flame: '<path d="M12 1.8c.4 4 3.4 5.4 3.4 9 0 1.6-.9 2.8-2 3.2.5-2.4-.6-4.2-1.8-5.2.2 3-1.6 4.2-2.8 4.2-1 0-1.8-.8-1.8-2-1.4 1.4-2.4 3.2-2.4 5.2 0 3.6 3 6.6 7.4 6.6s7.4-3.2 7.4-7.2c0-6-5.6-8.2-7.4-13.8Z" fill="currentColor"/><path d="M12 22.2c2.6 0 4.4-1.9 4.4-4.2 0-2.6-2.4-3.6-3.2-6-.8 2-3.4 3-3.4 5.6 0 2.4 1.6 4.6 2.2 4.6Z" fill="var(--icon-accent,#ff6a00)"/>',
  clock: '<path d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm0 2.8a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6Z" fill="currentColor"/><path d="M10.8 6.4h2.4v5.2l3.4 2-1.2 2-4.6-2.8Z" fill="var(--icon-accent,#ff6a00)"/>',
  pill: '<path d="M6 7.6h12a4.4 4.4 0 0 1 0 8.8H6a4.4 4.4 0 0 1 0-8.8Z" fill="currentColor"/><path d="M12 7.6h6a4.4 4.4 0 0 1 0 8.8h-6Z" fill="var(--icon-accent,#ff6a00)"/>',
  target: '<path d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm0 2.8a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6Z" fill="currentColor"/><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="var(--icon-accent,#ff6a00)"/>',
  trendLine: '<path d="m2.6 15.4 6.4-6.4 3.6 3.6 7-7 2 2-9 9-3.6-3.6-4.4 4.4Z" fill="currentColor"/><path d="M14.4 4.4h7.2v7.2h-2.8V7.2h-4.4Z" fill="var(--icon-accent,#ff6a00)"/>',
  // Picture frame + accent mountain/sun — the "pick from gallery" affordance.
  gallery: '<rect x="2.6" y="4.2" width="18.8" height="15.6" rx="3" fill="currentColor"/><path d="M5.6 16.6 9.8 11.6l3.2 3.6 2.4-2.6 3 4Z" fill="var(--icon-accent,#ff6a00)"/><circle cx="8.7" cy="8.7" r="1.7" fill="var(--icon-accent,#ff6a00)"/>',
  camera: '<path d="M8.6 3.4h6.8l1.6 3H19a3.4 3.4 0 0 1 3.4 3.4v7.4a3.4 3.4 0 0 1-3.4 3.4H5a3.4 3.4 0 0 1-3.4-3.4V9.8A3.4 3.4 0 0 1 5 6.4h2Z" fill="currentColor"/><circle cx="12" cy="13.4" r="3.8" fill="var(--icon-accent,#ff6a00)"/>',
  barcode: '<rect x="2.6" y="4.6" width="2.4" height="14.8" rx=".8" fill="currentColor"/><rect x="6.6" y="4.6" width="1.4" height="14.8" rx=".7" fill="currentColor"/><rect x="13.4" y="4.6" width="1.4" height="14.8" rx=".7" fill="currentColor"/><rect x="16.4" y="4.6" width="2.4" height="14.8" rx=".8" fill="currentColor"/><rect x="20.2" y="4.6" width="1.4" height="14.8" rx=".7" fill="currentColor"/><rect x="9.6" y="4.6" width="2.4" height="14.8" rx=".8" fill="var(--icon-accent,#ff6a00)"/>',
  zap: '<path d="M13.6 1.8 3.6 14.4h6.2L9 22.2 20.4 9.6h-6.4Z" fill="var(--icon-accent,#ff6a00)"/>',

  // ——— system ———
  settings: '<rect x="2.6" y="6.4" width="18.8" height="3.2" rx="1.6" fill="currentColor"/><rect x="2.6" y="14.4" width="18.8" height="3.2" rx="1.6" fill="currentColor"/><circle cx="15.4" cy="8" r="3.4" fill="var(--icon-accent,#ff6a00)"/><circle cx="8.6" cy="16" r="3.4" fill="var(--icon-accent,#ff6a00)"/>',
  globe: '<path d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm0 2.6a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z" fill="currentColor"/><path d="M3.6 10.6h16.8v2.8H3.6Z" fill="currentColor"/><path d="M12 2.4c2.9 2.9 4.4 6.1 4.4 9.6S14.9 18.7 12 21.6c-2.9-2.9-4.4-6.1-4.4-9.6S9.1 5.3 12 2.4Zm0 4.2c-1.2 1.6-1.8 3.4-1.8 5.4s.6 3.8 1.8 5.4c1.2-1.6 1.8-3.4 1.8-5.4s-.6-3.8-1.8-5.4Z" fill="var(--icon-accent,#ff6a00)"/>',
  swatches: '<rect x="3.4" y="3.4" width="7.6" height="7.6" rx="2.4" fill="currentColor"/><rect x="13" y="3.4" width="7.6" height="7.6" rx="2.4" fill="currentColor"/><rect x="3.4" y="13" width="7.6" height="7.6" rx="2.4" fill="currentColor"/><rect x="13" y="13" width="7.6" height="7.6" rx="2.4" fill="var(--icon-accent,#ff6a00)"/>',
  download: '<path d="M2.6 16.4h2.8V19h13.2v-2.6h2.8V21.8H2.6Z" fill="currentColor"/><path d="M10.6 2.6h2.8v8.6l3.6-3.6 2 2L12 16.6 5 9.6l2-2 3.6 3.6Z" fill="var(--icon-accent,#ff6a00)"/>',
  upload: '<path d="M2.6 16.4h2.8V19h13.2v-2.6h2.8V21.8H2.6Z" fill="currentColor"/><path d="M13.4 15.4h-2.8V6.8L7 10.4l-2-2L12 1.4l7 7-2 2-3.6-3.6Z" fill="var(--icon-accent,#ff6a00)"/>',
  refresh: '<path d="M12 2.4a9.6 9.6 0 1 0 9.6 9.6h-2.8A6.8 6.8 0 1 1 12 5.2Z" fill="currentColor"/><path d="M12 2.4a9.5 9.5 0 0 1 6.4 2.4V2.2h2.8v7.2H14V6.6h3.2A6.7 6.7 0 0 0 12 5.2Z" fill="var(--icon-accent,#ff6a00)"/>',
  info: '<path d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm0 2.8a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6Z" fill="currentColor"/><circle cx="12" cy="7.8" r="1.4" fill="var(--icon-accent,#ff6a00)"/><rect x="10.7" y="10.2" width="2.6" height="6.6" rx="1.3" fill="var(--icon-accent,#ff6a00)"/>',
  message: '<path d="M6 3.4h12a3.4 3.4 0 0 1 3.4 3.4v8.6a3.4 3.4 0 0 1-3.4 3.4H8.6l-6 4.2V6.8A3.4 3.4 0 0 1 6 3.4Z" fill="currentColor"/><circle cx="8.4" cy="11" r="1.5" fill="var(--icon-accent,#ff6a00)"/><circle cx="12" cy="11" r="1.5" fill="var(--icon-accent,#ff6a00)"/><circle cx="15.6" cy="11" r="1.5" fill="var(--icon-accent,#ff6a00)"/>',
  mic: '<path d="M4.6 10.4h2.8v1.8a4.6 4.6 0 0 0 9.2 0v-1.8h2.8v1.8a7.4 7.4 0 0 1-6 7.3v1.9h2.4v2.4H8.2v-2.4h2.4v-1.9a7.4 7.4 0 0 1-6-7.3Z" fill="currentColor"/><rect x="8.6" y="1.6" width="6.8" height="12.4" rx="3.4" fill="var(--icon-accent,#ff6a00)"/>',
  bell: '<path d="M12 1.8a6.8 6.8 0 0 1 6.8 6.8v5l2 3.2H3.2l2-3.2v-5A6.8 6.8 0 0 1 12 1.8Z" fill="currentColor"/><path d="M8.8 18.6h6.4a3.2 3.2 0 0 1-6.4 0Z" fill="var(--icon-accent,#ff6a00)"/>',
  bellOff: '<path d="M12 1.8a6.8 6.8 0 0 1 6.8 6.8v5l2 3.2H3.2l2-3.2v-5A6.8 6.8 0 0 1 12 1.8Zm-3.2 16.8h6.4a3.2 3.2 0 0 1-6.4 0Z" fill="currentColor"/><path d="m3.4 1.6 19 19-2 2-19-19Z" fill="var(--icon-accent,#ff6a00)"/>',
  trophy: '<path d="M6.4 4.6h-3.4v3a4.2 4.2 0 0 0 3.4 4.1V9.1a1.7 1.7 0 0 1-1-1.5V7h1Z" fill="currentColor"/><path d="M17.6 4.6H21v3a4.2 4.2 0 0 1-3.4 4.1V9.1a1.7 1.7 0 0 0 1-1.5V7h-1Z" fill="currentColor"/><rect x="10.7" y="13.8" width="2.6" height="4.4" fill="currentColor"/><rect x="7.2" y="18.2" width="9.6" height="2.8" rx="1.4" fill="currentColor"/><path d="M6.2 2.6h11.6v6.2a5.8 5.8 0 0 1-11.6 0Z" fill="var(--icon-accent,#ff6a00)"/>',
  sparkle: '<path d="M12 1.6c.5 4.8 2.5 6.8 7.3 7.3-4.8.5-6.8 2.5-7.3 7.3-.5-4.8-2.5-6.8-7.3-7.3 4.8-.5 6.8-2.5 7.3-7.3Z" fill="var(--icon-accent,#ff6a00)"/><path d="M18.2 15c.2 2.4 1.2 3.4 3.6 3.6-2.4.2-3.4 1.2-3.6 3.6-.2-2.4-1.2-3.4-3.6-3.6 2.4-.2 3.4-1.2 3.6-3.6Z" fill="currentColor"/>',
};

// Back-compat aliases — old call sites keep working.
ICONS.apple = ICONS.meal;
ICONS.palette = ICONS.swatches;

// ==========================================================================
// Workout templates (predefined)
// Each day's `exercises` are matched to user's library by name.
// ==========================================================================
// The workout-day names the four templates ship with, for DISPLAY only.
//
// ⚠️ THE NAME IS STORED IN THE PLAN, NOT READ BACK FROM HERE. Adopting a
// template writes `{ name: w.name }` into the cycle, so translating the
// catalog literal would fix only plans adopted afterwards and would freeze
// whichever language was current at adoption into the user's own data. A
// display map is the same decision exDisplayName() already makes for
// exercises: it repairs every plan ever adopted, and a day the user renamed
// is simply not in the map and passes through untouched.
//
// The muscle words are the app's own (cat_Chest / cat_Back / cat_Legs /
// cat_Shoulders / cat_Arms), so the chips and the exercise filter agree.
const PLAN_DAY_AR = {
  'Push': 'دفع', 'Pull': 'سحب', 'Legs': 'أرجل',
  'Upper A': 'علوي أ', 'Lower A': 'سفلي أ', 'Upper B': 'علوي ب', 'Lower B': 'سفلي ب',
  'Day A': 'يوم أ', 'Day B': 'يوم ب', 'Day C': 'يوم ج',
  'Chest': 'صدر', 'Back': 'ظهر', 'Shoulders': 'أكتاف', 'Arms': 'ذراع',
};

const WORKOUT_TEMPLATES = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: '3-day classic split',
    days: [
      { name: 'Push', exercises: ['Bench Press', 'Overhead Press', 'Incline Bench Press', 'Lateral Raise', 'Tricep Pushdown'] },
      { name: 'Pull', exercises: ['Deadlift', 'Pull Up', 'Barbell Row', 'Dumbbell Curl', 'Hammer Curl'] },
      { name: 'Legs', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press Machine', 'Leg Curl Machine', 'Calf Raise'] },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: '4-day balanced split',
    days: [
      { name: 'Upper A', exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Pull Up', 'Dumbbell Curl', 'Tricep Pushdown'] },
      { name: 'Lower A', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press Machine', 'Leg Curl Machine', 'Calf Raise'] },
      { name: 'Upper B', exercises: ['Incline Bench Press', 'Lat Pulldown Machine', 'Dumbbell Press', 'Seated Row Machine', 'Hammer Curl', 'Overhead Cable Triceps'] },
      { name: 'Lower B', exercises: ['Deadlift', 'Front Squat', 'Hack Squat Machine', 'Leg Extension Machine', 'Seated Calf Raise'] },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: '3 full-body workouts',
    days: [
      { name: 'Day A', exercises: ['Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Plank'] },
      { name: 'Day B', exercises: ['Deadlift', 'Incline Bench Press', 'Pull Up', 'Lateral Raise', 'Crunches'] },
      { name: 'Day C', exercises: ['Leg Press Machine', 'Dumbbell Press', 'Lat Pulldown Machine', 'Dumbbell Curl', 'Tricep Pushdown'] },
    ],
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    description: '5-day bodybuilding split',
    days: [
      { name: 'Chest', exercises: ['Bench Press', 'Incline Bench Press', 'Dumbbell Press', 'Dumbbell Fly', 'Cable Crossover'] },
      { name: 'Back', exercises: ['Deadlift', 'Pull Up', 'Barbell Row', 'Lat Pulldown Machine', 'Seated Row Machine'] },
      { name: 'Legs', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press Machine', 'Leg Curl Machine', 'Calf Raise'] },
      { name: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly Machine', 'Shrugs'] },
      { name: 'Arms', exercises: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Tricep Extension', 'Triceps Dip Machine'] },
    ],
  },
];

// ==========================================================================
// Muscle groups — anterior / posterior mapping
// ==========================================================================
// Each exercise -> primary muscle keys. Custom/unmatched exercises fall back
// to a category-based default.
const EXERCISE_MUSCLES = {
  'Squat': ['quads', 'glutes'],
  'Bench Press': ['chest', 'front_delts', 'triceps'],
  'Deadlift': ['hamstrings', 'glutes', 'lower_back', 'lats'],
  'Incline Bench Press': ['upper_chest', 'front_delts', 'triceps'],
  'Dumbbell Press': ['chest', 'front_delts', 'triceps'],
  'Dumbbell Fly': ['chest'],
  'Push Up': ['chest', 'front_delts', 'triceps'],
  'Barbell Row': ['lats', 'upper_back'],
  'Pull Up': ['lats', 'biceps'],
  'Lat Pulldown': ['lats', 'biceps'],
  'Dumbbell Row': ['lats', 'upper_back'],
  'Seated Row': ['lats', 'upper_back'],
  'Front Squat': ['quads', 'glutes'],
  'Leg Press': ['quads', 'glutes'],
  'Leg Curl': ['hamstrings'],
  'Leg Extension': ['quads'],
  'Romanian Deadlift': ['hamstrings', 'glutes'],
  'Lunges': ['quads', 'glutes'],
  'Calf Raise': ['calves'],
  'Overhead Press': ['front_delts', 'triceps'],
  'Lateral Raise': ['side_delts'],
  'Front Raise': ['front_delts'],
  'Rear Delt Fly': ['rear_delts'],
  'Shrugs': ['traps'],
  'Barbell Curl': ['biceps'],
  'EZ Bar Curl': ['biceps'],
  'Dumbbell Curl': ['biceps'],
  'Incline Dumbbell Curl': ['biceps'],
  'Hammer Curl': ['biceps', 'forearms'],
  'Concentration Curl': ['biceps'],
  'Spider Curl': ['biceps'],
  'Reverse Curl': ['biceps', 'forearms'],
  'Chin-Up': ['biceps', 'lats'],
  'Tricep Pushdown': ['triceps'],
  'Tricep Extension': ['triceps'],
  'Dips': ['triceps', 'chest'],
  'Plank': ['abs'],
  'Crunches': ['abs'],
  'Leg Raise': ['abs'],
  'Russian Twist': ['abs'],
  'Chest Press Machine': ['chest', 'triceps'],
  'Incline Chest Press Machine': ['upper_chest', 'front_delts'],
  'Pec Deck Machine': ['chest'],
  'Cable Crossover': ['chest'],
  'Smith Machine Bench Press': ['chest', 'triceps'],
  'Lat Pulldown Machine': ['lats', 'biceps'],
  'Seated Row Machine': ['lats', 'upper_back'],
  'T-Bar Row Machine': ['lats', 'upper_back'],
  'Iso-Lateral Row': ['lats', 'upper_back'],
  'Back Extension': ['lower_back', 'glutes'],
  'Leg Press Machine': ['quads', 'glutes'],
  'Leg Extension Machine': ['quads'],
  'Leg Curl Machine': ['hamstrings'],
  'Hack Squat Machine': ['quads', 'glutes'],
  'Smith Machine Squat': ['quads', 'glutes'],
  'Seated Leg Curl': ['hamstrings'],
  'Seated Calf Raise': ['calves'],
  'Calf Raise Machine': ['calves'],
  'Hip Abductor Machine': ['glutes'],
  'Hip Adductor Machine': ['adductors'],
  'Shoulder Press Machine': ['front_delts'],
  'Lateral Raise Machine': ['side_delts'],
  'Rear Delt Fly Machine': ['rear_delts'],
  'Smith Machine Shoulder Press': ['front_delts'],
  'Face Pull': ['rear_delts'],
  'Cable Upright Row': ['side_delts', 'traps'],
  'Cable Shrug': ['traps'],
  'Preacher Curl Machine': ['biceps'],
  'Cable Curl': ['biceps'],
  'Triceps Dip Machine': ['triceps', 'chest'],
  'Overhead Cable Triceps': ['triceps'],
  'Ab Crunch Machine': ['abs'],
};

// ==========================================================================
// Exercise display names
// Built-in exercises are STORED with their English name (that name is the key
// the cloud/mirror and the image catalogue match on, so it must never change).
// For display only, Arabic shows a transliteration of the same name.
// Exercises the user created themselves are NEVER re-labelled — they chose that
// name, so `isCustom` is returned verbatim in both languages. Anything missing
// from the map falls back to the English name.
// ==========================================================================
const EXERCISE_NAME_AR = {
  'Squat': 'سكوات',
  'Bench Press': 'بنش برس',
  'Deadlift': 'ديدليفت',
  'Incline Bench Press': 'إنكلاين بنش برس',
  'Dumbbell Press': 'دمبل برس',
  'Dumbbell Fly': 'دمبل فلاي',
  'Push Up': 'بوش أب',
  'Barbell Row': 'باربل رو',
  'Pull Up': 'بول أب',
  'Dumbbell Row': 'دمبل رو',
  'Front Squat': 'فرونت سكوات',
  'Romanian Deadlift': 'رومانيان ديدليفت',
  'Lunges': 'لانجز',
  'Calf Raise': 'كالف رايز',
  'Overhead Press': 'أوفرهيد برس',
  'Lateral Raise': 'لاترال رايز',
  'Front Raise': 'فرونت رايز',
  'Rear Delt Fly': 'ريّر دلت فلاي',
  'Shrugs': 'شرَجز',
  'Barbell Curl': 'باربل كيرل',
  'EZ Bar Curl': 'إي زد بار كيرل',
  'Dumbbell Curl': 'دمبل كيرل',
  'Incline Dumbbell Curl': 'إنكلاين دمبل كيرل',
  'Hammer Curl': 'هامر كيرل',
  'Concentration Curl': 'كونسنتريشن كيرل',
  'Spider Curl': 'سبايدر كيرل',
  'Reverse Curl': 'ريفيرس كيرل',
  'Chin-Up': 'تشين أب',
  'Tricep Pushdown': 'ترايسبس بوش داون',
  'Tricep Extension': 'ترايسبس إكستنشن',
  'Dips': 'ديبس',
  'Plank': 'بلانك',
  'Crunches': 'كرانشز',
  'Leg Raise': 'ليج رايز',
  'Russian Twist': 'رشن تويست',
  'Chest Press Machine': 'تشست برس ماشين',
  'Incline Chest Press Machine': 'إنكلاين تشست برس ماشين',
  'Pec Deck Machine': 'بيك ديك ماشين',
  'Cable Crossover': 'كيبل كروس أوفر',
  'Smith Machine Bench Press': 'سميث بنش برس',
  'Shoulder Press Machine': 'شولدر برس ماشين',
  'Smith Machine Shoulder Press': 'سميث شولدر برس',
  'Lateral Raise Machine': 'لاترال رايز ماشين',
  'Cable Lateral Raise': 'كيبل لاترال رايز',
  'Rear Delt Fly Machine': 'ريّر دلت فلاي ماشين',
  'Face Pull': 'فيس بول',
  'Cable Upright Row': 'كيبل أب رايت رو',
  'Cable Shrug': 'كيبل شرَج',
  'Lat Pulldown Machine': 'لات بول داون ماشين',
  'Seated Row Machine': 'سيتد رو ماشين',
  'T-Bar Row Machine': 'تي بار رو ماشين',
  'Iso-Lateral Row': 'أيزو لاترال رو',
  'Assisted Pull-Up Machine': 'أسستد بول أب ماشين',
  'Back Extension': 'باك إكستنشن',
  'Leg Press Machine': 'ليج برس ماشين',
  'Hack Squat Machine': 'هاك سكوات ماشين',
  'Smith Machine Squat': 'سميث سكوات',
  'Leg Extension Machine': 'ليج إكستنشن ماشين',
  'Leg Curl Machine': 'ليج كيرل ماشين',
  'Seated Leg Curl': 'سيتد ليج كيرل',
  'Hip Abductor Machine': 'هيب أبدكتر ماشين',
  'Hip Adductor Machine': 'هيب أدكتر ماشين',
  'Hip Thrust Machine': 'هيب ثرست ماشين',
  'Calf Raise Machine': 'كالف رايز ماشين',
  'Seated Calf Raise': 'سيتد كالف رايز',
  'Preacher Curl Machine': 'بريتشر كيرل ماشين',
  'Cable Curl': 'كيبل كيرل',
  'Triceps Dip Machine': 'ترايسبس ديب ماشين',
  'Assisted Dip Machine': 'أسستد ديب ماشين',
  'Cable Triceps Pushdown': 'كيبل ترايسبس بوش داون',
  'Overhead Cable Triceps': 'أوفرهيد كيبل ترايسبس',
  'Ab Crunch Machine': 'آب كرانش ماشين',
  'Cable Crunch': 'كيبل كرانش',
};

// TRANSLATED, not transliterated — the third choice for exercise names
// (prefs.exNames === 'ar'). Formal terms; a machine is جهاز, ثلاثية الرؤوس
// for triceps, الكابل for cable. Kept in step with EXERCISE_NAME_AR above: the
// patch that introduced it refuses a key on one side that is missing on the other.
const EXERCISE_NAME_AR_FULL = {
  'Squat': 'القرفصاء بالبار',
  'Bench Press': 'ضغط الصدر بالبار',
  'Deadlift': 'الرفعة الميتة',
  'Incline Bench Press': 'ضغط الصدر المائل بالبار',
  'Dumbbell Press': 'ضغط الصدر بالدمبل',
  'Dumbbell Fly': 'تفتيح الصدر بالدمبل',
  'Push Up': 'الضغط الأرضي',
  'Barbell Row': 'التجديف بالبار',
  'Pull Up': 'العقلة',
  'Dumbbell Row': 'التجديف بالدمبل',
  'Front Squat': 'القرفصاء الأمامية',
  'Romanian Deadlift': 'الرفعة الميتة الرومانية',
  'Lunges': 'الطعنات',
  'Calf Raise': 'رفع السمانة',
  'Overhead Press': 'ضغط الكتف فوق الرأس',
  'Lateral Raise': 'الرفرفة الجانبية',
  'Front Raise': 'الرفرفة الأمامية',
  'Rear Delt Fly': 'تفتيح الكتف الخلفي',
  'Shrugs': 'هزّ الكتفين',
  'Barbell Curl': 'ثني الذراع بالبار',
  'EZ Bar Curl': 'ثني الذراع بالبار المعقوف',
  'Dumbbell Curl': 'ثني الذراع بالدمبل',
  'Incline Dumbbell Curl': 'ثني الذراع بالدمبل على المقعد المائل',
  'Hammer Curl': 'ثني الذراع بقبضة المطرقة',
  'Concentration Curl': 'ثني الذراع المركّز',
  'Spider Curl': 'ثني الذراع منبطحاً على المقعد المائل',
  'Reverse Curl': 'ثني الذراع بالقبضة المعكوسة',
  'Chin-Up': 'العقلة بالقبضة المعكوسة',
  'Tricep Pushdown': 'دفع ثلاثية الرؤوس للأسفل',
  'Tricep Extension': 'مدّ ثلاثية الرؤوس',
  'Dips': 'الغطس على المتوازيين',
  'Plank': 'تثبيت الجذع (بلانك)',
  'Crunches': 'انثناء البطن',
  'Leg Raise': 'رفع الساقين',
  'Russian Twist': 'الالتفاف الروسي',
  'Chest Press Machine': 'جهاز ضغط الصدر',
  'Incline Chest Press Machine': 'جهاز ضغط الصدر المائل',
  'Pec Deck Machine': 'جهاز تفتيح الصدر',
  'Cable Crossover': 'تقاطع الكابل للصدر',
  'Smith Machine Bench Press': 'ضغط الصدر على جهاز سميث',
  'Shoulder Press Machine': 'جهاز ضغط الكتف',
  'Smith Machine Shoulder Press': 'ضغط الكتف على جهاز سميث',
  'Lateral Raise Machine': 'جهاز الرفرفة الجانبية',
  'Cable Lateral Raise': 'الرفرفة الجانبية بالكابل',
  'Rear Delt Fly Machine': 'جهاز تفتيح الكتف الخلفي',
  'Face Pull': 'سحب الكابل نحو الوجه',
  'Cable Upright Row': 'التجديف العمودي بالكابل',
  'Cable Shrug': 'هزّ الكتفين بالكابل',
  'Lat Pulldown Machine': 'جهاز السحب العلوي',
  'Seated Row Machine': 'جهاز التجديف جالساً',
  'T-Bar Row Machine': 'جهاز التجديف بالبار T',
  'Iso-Lateral Row': 'التجديف أحادي الجانب',
  'Assisted Pull-Up Machine': 'جهاز العقلة المساعدة',
  'Back Extension': 'مدّ الظهر',
  'Leg Press Machine': 'جهاز دفع الأرجل',
  'Hack Squat Machine': 'جهاز القرفصاء المائلة',
  'Smith Machine Squat': 'القرفصاء على جهاز سميث',
  'Leg Extension Machine': 'جهاز مدّ الساقين',
  'Leg Curl Machine': 'جهاز ثني الساقين',
  'Seated Leg Curl': 'ثني الساقين جالساً',
  'Hip Abductor Machine': 'جهاز إبعاد الوركين',
  'Hip Adductor Machine': 'جهاز تقريب الوركين',
  'Hip Thrust Machine': 'جهاز دفع الورك',
  'Calf Raise Machine': 'جهاز رفع السمانة',
  'Seated Calf Raise': 'رفع السمانة جالساً',
  'Preacher Curl Machine': 'جهاز ثني الذراع على المسند',
  'Cable Curl': 'ثني الذراع بالكابل',
  'Triceps Dip Machine': 'جهاز الغطس لثلاثية الرؤوس',
  'Assisted Dip Machine': 'جهاز الغطس المساعد',
  'Cable Triceps Pushdown': 'دفع ثلاثية الرؤوس بالكابل للأسفل',
  'Overhead Cable Triceps': 'مدّ ثلاثية الرؤوس بالكابل فوق الرأس',
  'Ab Crunch Machine': 'جهاز انثناء البطن',
  'Cable Crunch': 'انثناء البطن بالكابل',
};

// ==========================================================================
// FOOD
// ==========================================================================

// Built-in catalog of common foods with pre-computed macros (per serving).
// Bilingual name + serving; calories/protein/carbs match the DB.foods shape.
// WHAT PEOPLE CALL FOOD IS NOT WHAT THE CATALOGUE CALLS IT. Measured against
// the app's own 219 presets with 24 ordinary Arabic queries: 17 found
// something and SEVEN found nothing - and not for one reason but two. Five are
// genuine synonyms (a different word for the same food), and the sixth and
// seventh were the letter fold below.
//
// KEYS ARE THE FOLDED FORM - after DB.search.normalize has done its work, so
// after ة becomes ه and أ becomes ا. Writing a key in its unfolded spelling
// makes an entry that can never match, silently.
//
// ⚠️ لبن AND حليب ARE NOT MERGED, DELIBERATELY. In the Gulf and the Levant لبن
// is yoghurt or buttermilk; in Egypt it is milk. A synonym that is only a
// synonym in some dialects is a WRONG ANSWER for the rest, and both words
// already find their own rows. A map like this earns its bytes only where the
// two words name the same food everywhere.
const FOOD_SYNONYMS = {
  'فراخ': 'دجاج',        // Egyptian for chicken
  'بطاطس': 'بطاطا',      // the other spelling of potato
  'بندوره': 'طماطم',     // Levantine for tomato
  'عيش': 'خبز',          // Egyptian for bread
  'معكرونه': 'مكرونه',   // the other spelling of pasta
  'جبنه': 'جبن',         // the catalogue's own word is the bare stem
};

const FOOD_PRESETS = [
  // Protein
  { cat: 'protein', en: 'Chicken Breast', ar: 'صدر دجاج', s: '100g', sa: '١٠٠غ', cal: 165, pro: 31, carb: 0, f: 4.6 },
  { cat: 'protein', en: 'Chicken Thigh', ar: 'فخذ دجاج', s: '100g', sa: '١٠٠غ', cal: 209, pro: 26, carb: 0, f: 11.7 },
  { cat: 'protein', en: 'Tuna (canned)', ar: 'تونة معلبة', s: '100g', sa: '١٠٠غ', cal: 116, pro: 26, carb: 0, f: 1.3 },
  { cat: 'protein', en: 'Egg', ar: 'بيضة', s: '1 egg', sa: 'بيضة', cal: 78, pro: 6, carb: 1, f: 5.6 },
  { cat: 'protein', en: 'Beef (lean)', ar: 'لحم بقري', s: '100g', sa: '١٠٠غ', cal: 250, pro: 26, carb: 0, f: 16.2 },
  { cat: 'protein', en: 'Salmon', ar: 'سلمون', s: '100g', sa: '١٠٠غ', cal: 208, pro: 20, carb: 0, f: 14.2 },
  { cat: 'protein', en: 'Shrimp', ar: 'روبيان', s: '100g', sa: '١٠٠غ', cal: 99, pro: 24, carb: 0, f: 0.3 },
  { cat: 'protein', en: 'Turkey Breast', ar: 'صدر ديك رومي', s: '100g', sa: '١٠٠غ', cal: 135, pro: 30, carb: 0, f: 1.7 },
  // Supplements and the packaged protein people actually buy. Serving sizes are
  // the ones printed on the tub or wrapper — a "scoop", a "bar" — because that
  // is the unit the user measures in; asking them to convert to 100g is how a
  // food log stops being used. Figures are typical of the category rather than
  // of one brand, and the portion stepper is there for the rest.
  { cat: 'protein', en: 'Whey Protein (scoop)', ar: 'واي بروتين (سكوب)', s: '1 scoop · 30g', sa: 'سكوب · ٣٠غ', cal: 120, pro: 24, carb: 3, f: 1.5 },
  { cat: 'protein', en: 'Whey Isolate (scoop)', ar: 'واي أيزوليت (سكوب)', s: '1 scoop · 30g', sa: 'سكوب · ٣٠غ', cal: 115, pro: 27, carb: 1, f: 0.5 },
  { cat: 'protein', en: 'Casein (scoop)', ar: 'كازين (سكوب)', s: '1 scoop · 33g', sa: 'سكوب · ٣٣غ', cal: 120, pro: 24, carb: 4, f: 1 },
  { cat: 'protein', en: 'Mass Gainer (scoop)', ar: 'ماس جينر (سكوب)', s: '1 scoop · 100g', sa: 'سكوب · ١٠٠غ', cal: 380, pro: 20, carb: 70, f: 3 },
  { cat: 'protein', en: 'Protein Bar', ar: 'بروتين بار', s: '1 bar · 60g', sa: 'قطعة · ٦٠غ', cal: 210, pro: 20, carb: 21, f: 7 },
  { cat: 'protein', en: 'Protein Shake (ready)', ar: 'مشروب بروتين جاهز', s: '1 bottle · 330ml', sa: 'عبوة · ٣٣٠مل', cal: 160, pro: 30, carb: 5, f: 2 },
  { cat: 'protein', en: 'BCAA / EAA', ar: 'بي سي إيه إيه', s: '1 scoop', sa: 'سكوب', cal: 10, pro: 0, carb: 1, f: 0 },
  { cat: 'protein', en: 'Creatine', ar: 'كرياتين', s: '5g', sa: '٥غ', cal: 0, pro: 0, carb: 0, f: 0 },
  { cat: 'protein', en: 'Egg Whites', ar: 'بياض بيض', s: '100g', sa: '١٠٠غ', cal: 52, pro: 11, carb: 1, f: 0 },
  { cat: 'protein', en: 'Greek Yoghurt (0%)', ar: 'زبادي يوناني خالي الدسم', s: '170g', sa: '١٧٠غ', cal: 100, pro: 17, carb: 6, f: 0 },
  { cat: 'protein', en: 'Cottage Cheese', ar: 'جبن قريش', s: '100g', sa: '١٠٠غ', cal: 98, pro: 11, carb: 3, f: 4.3 },
  { cat: 'protein', en: 'Full-Fat Labneh', ar: 'لبنة كاملة الدسم', s: '100g', sa: '١٠٠غ', cal: 174, pro: 8, carb: 6, f: 13 },
  { cat: 'protein', en: 'Tuna in Water (can)', ar: 'تونة بالماء (علبة)', s: '1 can · 80g', sa: 'علبة · ٨٠غ', cal: 90, pro: 20, carb: 0, f: 1 },
  { cat: 'protein', en: 'Sardines (can)', ar: 'سردين (علبة)', s: '1 can · 90g', sa: 'علبة · ٩٠غ', cal: 190, pro: 22, carb: 0, f: 11 },
  { cat: 'protein', en: 'Natural Peanut Butter', ar: 'زبدة فول سوداني طبيعية', s: '1 tbsp · 16g', sa: 'ملعقة · ١٦غ', cal: 95, pro: 4, carb: 3, f: 8 },
  { cat: 'protein', en: 'Lamb (lean)', ar: 'لحم غنم', s: '100g', sa: '١٠٠غ', cal: 258, pro: 25, carb: 0, f: 17 },
  { cat: 'protein', en: 'Liver', ar: 'كبدة', s: '100g', sa: '١٠٠غ', cal: 165, pro: 26, carb: 4, f: 4.4 },
  { cat: 'protein', en: 'Kabab / Kofta', ar: 'كباب / كفتة', s: '100g', sa: '١٠٠غ', cal: 215, pro: 18, carb: 2, f: 15 },
  { cat: 'protein', en: 'Shawarma (chicken)', ar: 'شاورما دجاج', s: '100g', sa: '١٠٠غ', cal: 190, pro: 22, carb: 3, f: 10 },
  { cat: 'protein', en: 'Boiled Eggs', ar: 'بيض مسلوق', s: '2 eggs · 100g', sa: '٢ بيضة · ١٠٠غ', cal: 156, pro: 13, carb: 1, f: 11.1 },
  { cat: 'protein', en: 'Scrambled Eggs', ar: 'بيض مخفوق', s: '2 eggs · 120g', sa: '٢ بيضة · ١٢٠غ', cal: 190, pro: 13, carb: 2, f: 14.4 },
  { cat: 'protein', en: 'Tuna in Oil (can)', ar: 'تونة بالزيت (علبة)', s: '1 can · 80g', sa: '١ علبة · ٨٠غ', cal: 160, pro: 20, carb: 0, f: 8.9 },
  { cat: 'protein', en: 'Canned Chicken Breast', ar: 'صدر دجاج معلب', s: '100g', sa: '١٠٠غ', cal: 130, pro: 25, carb: 1, f: 2.9 },
  { cat: 'protein', en: 'Grilled Chicken Breast', ar: 'صدر دجاج مشوي', s: '150g', sa: '١٥٠غ', cal: 248, pro: 46, carb: 0, f: 7.1 },
  { cat: 'protein', en: 'Roasted Chicken with Skin', ar: 'دجاج مشوي مع الجلد', s: '100g', sa: '١٠٠غ', cal: 239, pro: 27, carb: 0, f: 14.6 },
  { cat: 'protein', en: 'Lean Ground Beef', ar: 'لحم بقري مفروم قليل الدهن', s: '100g', sa: '١٠٠غ', cal: 217, pro: 26, carb: 0, f: 12.6 },
  { cat: 'protein', en: 'Grilled Beef Steak', ar: 'شريحة لحم بقري مشوية', s: '150g', sa: '١٥٠غ', cal: 330, pro: 42, carb: 0, f: 18 },
  { cat: 'protein', en: 'Grilled Lamb Kebab', ar: 'كباب لحم مشوي', s: '1 skewer · 120g', sa: '١ سيخ · ١٢٠غ', cal: 258, pro: 22, carb: 2, f: 18 },
  { cat: 'protein', en: 'Grilled Chicken Kebab', ar: 'كباب دجاج مشوي', s: '1 skewer · 120g', sa: '١ سيخ · ١٢٠غ', cal: 210, pro: 28, carb: 4, f: 9.1 },
  { cat: 'protein', en: 'Turkey Slices', ar: 'شرائح ديك رومي', s: '100g', sa: '١٠٠غ', cal: 110, pro: 21, carb: 3, f: 1.6 },
  { cat: 'protein', en: 'Grilled Tilapia', ar: 'بلطي مشوي', s: '100g', sa: '١٠٠غ', cal: 128, pro: 26, carb: 0, f: 2.7 },
  { cat: 'protein', en: 'Grilled White Fish', ar: 'سمك أبيض مشوي', s: '100g', sa: '١٠٠غ', cal: 110, pro: 23, carb: 0, f: 2 },
  { cat: 'protein', en: 'Protein Cookie', ar: 'بسكويت بروتين', s: '1 cookie · 75g', sa: '١ قطعة · ٧٥غ', cal: 260, pro: 20, carb: 30, f: 6.7 },
  { cat: 'protein', en: 'Chocolate Protein Bar', ar: 'لوح بروتين بالشوكولاتة', s: '1 bar · 60g', sa: '١ لوح · ٦٠غ', cal: 220, pro: 20, carb: 22, f: 5.8 },
  { cat: 'protein', en: 'Clear Whey Protein', ar: 'بروتين مصل الحليب الصافي', s: '1 scoop · 25g', sa: '١ سكوب · ٢٥غ', cal: 90, pro: 20, carb: 1, f: 0 },
  { cat: 'protein', en: 'Plant Protein Powder', ar: 'مسحوق بروتين نباتي', s: '1 scoop · 30g', sa: '١ سكوب · ٣٠غ', cal: 120, pro: 22, carb: 4, f: 1.8 },
  { cat: 'protein', en: 'Protein Pudding', ar: 'بودينغ عالي البروتين', s: '1 tub · 200g', sa: '١ عبوة · ٢٠٠غ', cal: 154, pro: 20, carb: 13, f: 2.4 },
  { cat: 'protein', en: 'Liquid Egg Whites', ar: 'بياض بيض سائل', s: '1 cup · 243g', sa: '١ كوب · ٢٤٣غ', cal: 126, pro: 27, carb: 2, f: 0 },
  { cat: 'protein', en: 'Chicken Sausage', ar: 'نقانق دجاج', s: '100g', sa: '١٠٠غ', cal: 180, pro: 16, carb: 3, f: 11.6 },
  // Grains & Carbs
  { cat: 'carbs', en: 'White Rice', ar: 'رز أبيض', s: '100g', sa: '١٠٠غ', cal: 130, pro: 3, carb: 28, f: 0.3 },
  { cat: 'carbs', en: 'Brown Rice', ar: 'رز بني', s: '100g', sa: '١٠٠غ', cal: 111, pro: 3, carb: 23, f: 0.8 },
  { cat: 'carbs', en: 'White Bread', ar: 'خبز أبيض', s: '1 slice', sa: 'شريحة', cal: 80, pro: 3, carb: 15, f: 0.9 },
  { cat: 'carbs', en: 'Arabic Bread', ar: 'خبز عربي', s: '1 loaf', sa: 'رغيف', cal: 165, pro: 5, carb: 33, f: 1.4 },
  { cat: 'carbs', en: 'Pasta', ar: 'مكرونة', s: '100g', sa: '١٠٠غ', cal: 131, pro: 5, carb: 25, f: 1.2 },
  { cat: 'carbs', en: 'Oats', ar: 'شوفان', s: '40g', sa: '٤٠غ', cal: 150, pro: 5, carb: 27, f: 2.4 },
  { cat: 'carbs', en: 'Potato', ar: 'بطاطا', s: '100g', sa: '١٠٠غ', cal: 90, pro: 2, carb: 20, f: 0 },
  { cat: 'carbs', en: 'Sweet Potato', ar: 'بطاطا حلوة', s: '100g', sa: '١٠٠غ', cal: 90, pro: 2, carb: 20, f: 0 },
  { cat: 'carbs', en: 'Cooked Basmati Rice', ar: 'رز بسمتي مطبوخ', s: '1 cup · 158g', sa: '١ كوب · ١٥٨غ', cal: 205, pro: 4, carb: 45, f: 0.4 },
  { cat: 'carbs', en: 'Kabsa Rice', ar: 'رز كبسة', s: '1 cup · 200g', sa: '١ كوب · ٢٠٠غ', cal: 300, pro: 5, carb: 55, f: 6.7 },
  { cat: 'carbs', en: 'Mandi Rice', ar: 'رز مندي', s: '1 cup · 200g', sa: '١ كوب · ٢٠٠غ', cal: 290, pro: 5, carb: 54, f: 6 },
  { cat: 'carbs', en: 'Bukhari Rice', ar: 'رز بخاري', s: '1 cup · 200g', sa: '١ كوب · ٢٠٠غ', cal: 320, pro: 6, carb: 57, f: 7.6 },
  { cat: 'carbs', en: 'Tamees Bread', ar: 'خبز تميس', s: '1 loaf · 150g', sa: '١ رغيف · ١٥٠غ', cal: 400, pro: 12, carb: 78, f: 4.4 },
  { cat: 'carbs', en: 'Whole-Wheat Tamees', ar: 'تميس بر', s: '1 loaf · 150g', sa: '١ رغيف · ١٥٠غ', cal: 375, pro: 13, carb: 70, f: 4.8 },
  { cat: 'carbs', en: 'Whole-Wheat Bread', ar: 'خبز قمح كامل', s: '1 slice · 35g', sa: '١ شريحة · ٣٥غ', cal: 90, pro: 4, carb: 16, f: 1.1 },
  { cat: 'carbs', en: 'High-Protein Bread', ar: 'خبز عالي البروتين', s: '2 slices · 70g', sa: '٢ شريحة · ٧٠غ', cal: 180, pro: 15, carb: 20, f: 4.4 },
  { cat: 'carbs', en: 'High-Protein Pasta', ar: 'مكرونة عالية البروتين', s: '100g cooked', sa: '١٠٠غ مطبوخة', cal: 150, pro: 10, carb: 24, f: 1.6 },
  { cat: 'carbs', en: 'Cooked Quinoa', ar: 'كينوا مطبوخة', s: '1 cup · 185g', sa: '١ كوب · ١٨٥غ', cal: 222, pro: 8, carb: 39, f: 3.8 },
  { cat: 'carbs', en: 'Plain Rice Cakes', ar: 'كعك أرز سادة', s: '2 cakes · 18g', sa: '٢ قطعة · ١٨غ', cal: 70, pro: 1, carb: 15, f: 0.5 },
  { cat: 'carbs', en: 'Rolled Oats', ar: 'شوفان ملفوف', s: '50g', sa: '٥٠غ', cal: 190, pro: 6, carb: 34, f: 3.3 },
  { cat: 'carbs', en: 'Instant Oats (plain)', ar: 'شوفان سريع التحضير سادة', s: '40g', sa: '٤٠غ', cal: 152, pro: 5, carb: 27, f: 2.7 },
  { cat: 'carbs', en: 'Overnight Oats', ar: 'شوفان منقوع بالحليب', s: '1 jar · 250g', sa: '١ عبوة · ٢٥٠غ', cal: 310, pro: 14, carb: 48, f: 6.9 },
  { cat: 'carbs', en: 'Cooked Bulgur', ar: 'برغل مطبوخ', s: '1 cup · 182g', sa: '١ كوب · ١٨٢غ', cal: 165, pro: 6, carb: 34, f: 0.6 },
  { cat: 'carbs', en: 'Flour Tortilla Wrap', ar: 'خبز تورتيلا', s: '1 wrap · 70g', sa: '١ رغيف · ٧٠غ', cal: 210, pro: 6, carb: 36, f: 4.7 },
  // Legumes
  { cat: 'legumes', en: 'Foul (Fava Beans)', ar: 'فول', s: '100g', sa: '١٠٠غ', cal: 110, pro: 8, carb: 15, f: 2 },
  { cat: 'legumes', en: 'Hummus', ar: 'حمص بالطحينة', s: '100g', sa: '١٠٠غ', cal: 166, pro: 8, carb: 14, f: 8.7 },
  { cat: 'legumes', en: 'Lentils', ar: 'عدس', s: '100g', sa: '١٠٠غ', cal: 116, pro: 9, carb: 20, f: 0 },
  { cat: 'legumes', en: 'Chickpeas', ar: 'حمص حب', s: '100g', sa: '١٠٠غ', cal: 164, pro: 9, carb: 27, f: 2.2 },
  { cat: 'legumes', en: 'Foul Medames with Olive Oil', ar: 'فول مدمس بزيت الزيتون', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 310, pro: 16, carb: 42, f: 8.7 },
  { cat: 'legumes', en: 'Foul with Egg', ar: 'فول بالبيض', s: '1 plate · 300g', sa: '١ طبق · ٣٠٠غ', cal: 390, pro: 23, carb: 43, f: 14 },
  { cat: 'legumes', en: 'Lentil Soup', ar: 'شوربة عدس', s: '1 cup · 240ml', sa: '١ كوب · ٢٤٠مل', cal: 180, pro: 10, carb: 30, f: 2.2 },
  { cat: 'legumes', en: 'Red Lentil Dal', ar: 'عدس أحمر مطبوخ', s: '1 cup · 200g', sa: '١ كوب · ٢٠٠غ', cal: 230, pro: 14, carb: 36, f: 3.3 },
  { cat: 'legumes', en: 'Cooked Black Beans', ar: 'فاصوليا سوداء مطبوخة', s: '1 cup · 172g', sa: '١ كوب · ١٧٢غ', cal: 230, pro: 15, carb: 41, f: 0.7 },
  { cat: 'legumes', en: 'Cooked Kidney Beans', ar: 'فاصوليا حمراء مطبوخة', s: '1 cup · 177g', sa: '١ كوب · ١٧٧غ', cal: 225, pro: 15, carb: 40, f: 0.6 },
  { cat: 'legumes', en: 'White Bean Stew', ar: 'يخنة فاصوليا بيضاء', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 280, pro: 15, carb: 42, f: 5.8 },
  { cat: 'legumes', en: 'Cooked Edamame', ar: 'فول صويا أخضر مطبوخ', s: '1 cup · 155g', sa: '١ كوب · ١٥٥غ', cal: 190, pro: 18, carb: 14, f: 6.9 },
  // Dairy
  { cat: 'dairy', en: 'Milk', ar: 'حليب', s: '250ml', sa: '٢٥٠مل', cal: 122, pro: 8, carb: 12, f: 4.7 },
  { cat: 'dairy', en: 'Greek Yogurt', ar: 'زبادي يوناني', s: '170g', sa: '١٧٠غ', cal: 100, pro: 17, carb: 6, f: 0.9 },
  { cat: 'dairy', en: 'Yogurt', ar: 'لبن زبادي', s: '170g', sa: '١٧٠غ', cal: 95, pro: 9, carb: 12, f: 1.2 },
  { cat: 'dairy', en: 'Cheddar Cheese', ar: 'جبن شيدر', s: '30g', sa: '٣٠غ', cal: 120, pro: 7, carb: 1, f: 9.8 },
  { cat: 'dairy', en: 'Labneh', ar: 'لبنة', s: '30g', sa: '٣٠غ', cal: 60, pro: 3, carb: 2, f: 4.4 },
  { cat: 'dairy', en: 'Low-Fat Milk', ar: 'حليب قليل الدسم', s: '250ml', sa: '٢٥٠مل', cal: 105, pro: 9, carb: 12, f: 2.3 },
  { cat: 'dairy', en: 'Skim Milk', ar: 'حليب خالي الدسم', s: '250ml', sa: '٢٥٠مل', cal: 90, pro: 9, carb: 13, f: 0.2 },
  { cat: 'dairy', en: 'Full-Fat Laban', ar: 'لبن كامل الدسم', s: '250ml', sa: '٢٥٠مل', cal: 150, pro: 8, carb: 12, f: 7.8 },
  { cat: 'dairy', en: 'Low-Fat Laban', ar: 'لبن قليل الدسم', s: '250ml', sa: '٢٥٠مل', cal: 105, pro: 8, carb: 13, f: 2.3 },
  { cat: 'dairy', en: 'Ayran', ar: 'عيران', s: '250ml', sa: '٢٥٠مل', cal: 80, pro: 4, carb: 8, f: 3.6 },
  { cat: 'dairy', en: 'Flavoured Greek Yogurt', ar: 'زبادي يوناني منكّه', s: '170g', sa: '١٧٠غ', cal: 140, pro: 15, carb: 18, f: 0.9 },
  { cat: 'dairy', en: 'Low-Fat Labneh', ar: 'لبنة قليلة الدسم', s: '100g', sa: '١٠٠غ', cal: 120, pro: 9, carb: 7, f: 6.2 },
  { cat: 'dairy', en: 'Low-Fat Cottage Cheese', ar: 'جبن قريش قليل الدسم', s: '100g', sa: '١٠٠غ', cal: 82, pro: 12, carb: 4, f: 2 },
  { cat: 'dairy', en: 'Plain Skyr', ar: 'سكير سادة', s: '170g', sa: '١٧٠غ', cal: 105, pro: 18, carb: 7, f: 0.6 },
  { cat: 'dairy', en: 'Feta Cheese', ar: 'جبن فيتا', s: '30g', sa: '٣٠غ', cal: 80, pro: 4, carb: 1, f: 6.7 },
  { cat: 'dairy', en: 'Halloumi Cheese', ar: 'جبن حلوم', s: '50g', sa: '٥٠غ', cal: 160, pro: 11, carb: 1, f: 12.4 },
  { cat: 'dairy', en: 'Jameed', ar: 'جميد', s: '30g', sa: '٣٠غ', cal: 100, pro: 8, carb: 3, f: 6.2 },
  // Fruits
  { cat: 'fruit', en: 'Banana', ar: 'موز', s: '1 medium', sa: 'حبة', cal: 115, pro: 1, carb: 27, f: 0 },
  { cat: 'fruit', en: 'Apple', ar: 'تفاح', s: '1 medium', sa: 'حبة', cal: 100, pro: 0, carb: 25, f: 0 },
  { cat: 'fruit', en: 'Orange', ar: 'برتقال', s: '1 medium', sa: 'حبة', cal: 65, pro: 1, carb: 15, f: 0 },
  { cat: 'fruit', en: 'Dates', ar: 'تمر', s: '3 pieces', sa: '٣ حبات', cal: 65, pro: 0, carb: 16, f: 0 },
  { cat: 'fruit', en: 'Grapes', ar: 'عنب', s: '100g', sa: '١٠٠غ', cal: 75, pro: 1, carb: 17, f: 0 },
  { cat: 'fruit', en: 'Strawberry', ar: 'فراولة', s: '100g', sa: '١٠٠غ', cal: 32, pro: 1, carb: 7, f: 0 },
  { cat: 'fruit', en: 'Ajwa Dates', ar: 'تمر عجوة', s: '3 pieces · 24g', sa: '٣ حبات · ٢٤غ', cal: 70, pro: 0, carb: 17, f: 0 },
  { cat: 'fruit', en: 'Sukkari Dates', ar: 'تمر سكري', s: '3 pieces · 30g', sa: '٣ حبات · ٣٠غ', cal: 90, pro: 1, carb: 21, f: 0 },
  { cat: 'fruit', en: 'Khalas Dates', ar: 'تمر خلاص', s: '3 pieces · 30g', sa: '٣ حبات · ٣٠غ', cal: 85, pro: 1, carb: 20, f: 0 },
  { cat: 'fruit', en: 'Safawi Dates', ar: 'تمر صفاوي', s: '3 pieces · 30g', sa: '٣ حبات · ٣٠غ', cal: 80, pro: 0, carb: 20, f: 0 },
  { cat: 'fruit', en: 'Mabroom Dates', ar: 'تمر مبروم', s: '3 pieces · 30g', sa: '٣ حبات · ٣٠غ', cal: 85, pro: 1, carb: 20, f: 0 },
  { cat: 'fruit', en: 'Medjool Dates', ar: 'تمر مجدول', s: '2 pieces · 48g', sa: '٢ حبة · ٤٨غ', cal: 140, pro: 1, carb: 34, f: 0 },
  { cat: 'fruit', en: 'Watermelon', ar: 'بطيخ', s: '2 cups · 300g', sa: '٢ كوب · ٣٠٠غ', cal: 100, pro: 2, carb: 23, f: 0 },
  { cat: 'fruit', en: 'Mango', ar: 'مانجو', s: '1 cup · 165g', sa: '١ كوب · ١٦٥غ', cal: 105, pro: 1, carb: 25, f: 0 },
  { cat: 'fruit', en: 'Pomegranate Arils', ar: 'حب رمان', s: '1 cup · 174g', sa: '١ كوب · ١٧٤غ', cal: 145, pro: 3, carb: 33, f: 0 },
  { cat: 'fruit', en: 'Pineapple', ar: 'أناناس', s: '1 cup · 165g', sa: '١ كوب · ١٦٥غ', cal: 95, pro: 1, carb: 22, f: 0 },
  { cat: 'fruit', en: 'Blueberries', ar: 'توت أزرق', s: '100g', sa: '١٠٠غ', cal: 60, pro: 1, carb: 14, f: 0 },
  { cat: 'fruit', en: 'Raspberries', ar: 'توت العليق', s: '100g', sa: '١٠٠غ', cal: 52, pro: 1, carb: 12, f: 0 },
  { cat: 'fruit', en: 'Kiwi', ar: 'كيوي', s: '2 medium · 150g', sa: '٢ حبة متوسطة · ١٥٠غ', cal: 100, pro: 2, carb: 22, f: 0 },
  { cat: 'fruit', en: 'Pear', ar: 'كمثرى', s: '1 medium · 178g', sa: '١ حبة متوسطة · ١٧٨غ', cal: 115, pro: 1, carb: 27, f: 0 },
  { cat: 'fruit', en: 'Peach', ar: 'خوخ', s: '1 medium · 150g', sa: '١ حبة متوسطة · ١٥٠غ', cal: 60, pro: 1, carb: 14, f: 0 },
  // Vegetables
  { cat: 'veg', en: 'Cucumber', ar: 'خيار', s: '100g', sa: '١٠٠غ', cal: 16, pro: 1, carb: 3, f: 0 },
  { cat: 'veg', en: 'Tomato', ar: 'طماطم', s: '100g', sa: '١٠٠غ', cal: 18, pro: 1, carb: 3, f: 0 },
  { cat: 'veg', en: 'Mixed Salad', ar: 'سلطة خضراء', s: '100g', sa: '١٠٠غ', cal: 20, pro: 1, carb: 4, f: 0 },
  { cat: 'veg', en: 'Broccoli', ar: 'بروكلي', s: '100g', sa: '١٠٠غ', cal: 34, pro: 2, carb: 6, f: 0 },
  { cat: 'veg', en: 'Carrot', ar: 'جزر', s: '100g', sa: '١٠٠غ', cal: 45, pro: 1, carb: 10, f: 0 },
  { cat: 'veg', en: 'Cooked Spinach', ar: 'سبانخ مطبوخة', s: '1 cup · 180g', sa: '١ كوب · ١٨٠غ', cal: 50, pro: 5, carb: 7, f: 0 },
  { cat: 'veg', en: 'Cauliflower', ar: 'قرنبيط', s: '100g', sa: '١٠٠غ', cal: 30, pro: 2, carb: 5, f: 0 },
  { cat: 'veg', en: 'Zucchini', ar: 'كوسا', s: '100g', sa: '١٠٠غ', cal: 17, pro: 1, carb: 3, f: 0 },
  { cat: 'veg', en: 'Roasted Eggplant', ar: 'باذنجان مشوي', s: '100g', sa: '١٠٠غ', cal: 40, pro: 1, carb: 9, f: 0 },
  { cat: 'veg', en: 'Cooked Okra', ar: 'بامية مطبوخة', s: '1 cup · 160g', sa: '١ كوب · ١٦٠غ', cal: 60, pro: 3, carb: 12, f: 0 },
  { cat: 'veg', en: 'Cooked Molokhia', ar: 'ملوخية مطبوخة', s: '1 cup · 200g', sa: '١ كوب · ٢٠٠غ', cal: 90, pro: 6, carb: 12, f: 2 },
  { cat: 'veg', en: 'Cooked Green Beans', ar: 'فاصوليا خضراء مطبوخة', s: '1 cup · 125g', sa: '١ كوب · ١٢٥غ', cal: 50, pro: 2, carb: 10, f: 0 },
  { cat: 'veg', en: 'Bell Pepper', ar: 'فلفل رومي', s: '100g', sa: '١٠٠غ', cal: 31, pro: 1, carb: 6, f: 0 },
  { cat: 'veg', en: 'Lettuce', ar: 'خس', s: '100g', sa: '١٠٠غ', cal: 16, pro: 1, carb: 3, f: 0 },
  { cat: 'veg', en: 'Fattoush', ar: 'فتوش', s: '1 bowl · 200g', sa: '١ طبق · ٢٠٠غ', cal: 180, pro: 4, carb: 20, f: 9.3 },
  { cat: 'veg', en: 'Tabbouleh', ar: 'تبولة', s: '1 cup · 160g', sa: '١ كوب · ١٦٠غ', cal: 180, pro: 5, carb: 24, f: 7.1 },
  // Nuts & Fats
  { cat: 'fats', en: 'Almonds', ar: 'لوز', s: '30g', sa: '٣٠غ', cal: 173, pro: 6, carb: 6, f: 15 },
  { cat: 'fats', en: 'Peanut Butter', ar: 'زبدة فول سوداني', s: '1 tbsp', sa: 'ملعقة', cal: 94, pro: 4, carb: 3, f: 8 },
  { cat: 'fats', en: 'Olive Oil', ar: 'زيت زيتون', s: '1 tbsp', sa: 'ملعقة', cal: 119, pro: 0, carb: 0, f: 13.2 },
  { cat: 'fats', en: 'Avocado', ar: 'أفوكادو', s: '100g', sa: '١٠٠غ', cal: 160, pro: 2, carb: 9, f: 14.7 },
  { cat: 'fats', en: 'Tahini', ar: 'طحينة', s: '1 tbsp · 15g', sa: '١ ملعقة · ١٥غ', cal: 89, pro: 3, carb: 3, f: 8.1 },
  { cat: 'fats', en: 'Tahini Halawa', ar: 'حلاوة طحينية', s: '30g', sa: '٣٠غ', cal: 160, pro: 4, carb: 16, f: 9 },
  { cat: 'fats', en: 'Almond Butter', ar: 'زبدة لوز', s: '1 tbsp · 16g', sa: '١ ملعقة · ١٦غ', cal: 98, pro: 3, carb: 3, f: 9 },
  { cat: 'fats', en: 'Cashews', ar: 'كاجو', s: '30g', sa: '٣٠غ', cal: 166, pro: 5, carb: 9, f: 13 },
  { cat: 'fats', en: 'Walnuts', ar: 'جوز', s: '30g', sa: '٣٠غ', cal: 196, pro: 5, carb: 4, f: 19.5 },
  { cat: 'fats', en: 'Pistachios', ar: 'فستق', s: '30g', sa: '٣٠غ', cal: 168, pro: 6, carb: 8, f: 13.5 },
  { cat: 'fats', en: 'Peanuts', ar: 'فول سوداني', s: '30g', sa: '٣٠غ', cal: 170, pro: 8, carb: 5, f: 14.7 },
  { cat: 'fats', en: 'Mixed Nuts', ar: 'مكسرات مشكلة', s: '30g', sa: '٣٠غ', cal: 180, pro: 6, carb: 6, f: 15.5 },
  { cat: 'fats', en: 'Pumpkin Seeds', ar: 'بذور اليقطين', s: '30g', sa: '٣٠غ', cal: 170, pro: 9, carb: 4, f: 14.7 },
  { cat: 'fats', en: 'Sunflower Seeds', ar: 'بذور دوار الشمس', s: '30g', sa: '٣٠غ', cal: 175, pro: 6, carb: 6, f: 15.5 },
  { cat: 'fats', en: 'Chia Seeds', ar: 'بذور الشيا', s: '2 tbsp · 28g', sa: '٢ ملعقة · ٢٨غ', cal: 138, pro: 5, carb: 12, f: 8.7 },
  { cat: 'fats', en: 'Ground Flaxseed', ar: 'بذور كتان مطحونة', s: '2 tbsp · 14g', sa: '٢ ملعقة · ١٤غ', cal: 75, pro: 3, carb: 4, f: 5.9 },
  // Meals
  { cat: 'meals', en: 'Shawarma Wrap', ar: 'شاورما', s: '1 wrap', sa: 'سندويش', cal: 350, pro: 20, carb: 30, f: 16.7 },
  { cat: 'meals', en: 'Burger', ar: 'برجر', s: '1 burger', sa: 'حبة', cal: 295, pro: 17, carb: 24, f: 14.6 },
  { cat: 'meals', en: 'Pizza Slice', ar: 'بيتزا', s: '1 slice', sa: 'شريحة', cal: 285, pro: 12, carb: 36, f: 10.3 },
  { cat: 'meals', en: 'French Fries', ar: 'بطاطا مقلية', s: '100g', sa: '١٠٠غ', cal: 312, pro: 3, carb: 41, f: 15.1 },
  { cat: 'meals', en: 'Areekah', ar: 'عريكة', s: '1 small bowl · 150g', sa: '١ طبق صغير · ١٥٠غ', cal: 460, pro: 8, carb: 75, f: 15.4 },
  { cat: 'meals', en: 'Southern Aseedah', ar: 'عصيدة جنوبية', s: '1 small bowl · 200g', sa: '١ طبق صغير · ٢٠٠غ', cal: 500, pro: 8, carb: 96, f: 12.2 },
  { cat: 'meals', en: 'Sago Dessert', ar: 'ساقو', s: '1 small bowl · 150g', sa: '١ طبق صغير · ١٥٠غ', cal: 375, pro: 15, carb: 56, f: 10.5 },
  { cat: 'meals', en: 'Jamriyah', ar: 'جمرية', s: '1 piece · 150g', sa: '١ قطعة · ١٥٠غ', cal: 365, pro: 8, carb: 54, f: 14.5 },
  { cat: 'meals', en: 'Mansaf', ar: 'منسف', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 840, pro: 43, carb: 57, f: 46.4 },
  { cat: 'meals', en: 'Marasee', ar: 'مراصيع', s: '1 piece · 50g', sa: '١ قطعة · ٥٠غ', cal: 115, pro: 4, carb: 21, f: 2.2 },
  { cat: 'meals', en: 'Hininy', ar: 'حنيني', s: '1 small bowl · 150g', sa: '١ طبق صغير · ١٥٠غ', cal: 295, pro: 5, carb: 56, f: 7.6 },
  { cat: 'meals', en: 'Masoub', ar: 'معصوب', s: '1 plate · 300g', sa: '١ طبق · ٣٠٠غ', cal: 540, pro: 11, carb: 105, f: 12.2 },
  { cat: 'meals', en: 'Sayadiyah', ar: 'صيادية', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 605, pro: 33, carb: 93, f: 9.7 },
  { cat: 'meals', en: 'Mantu', ar: 'منتو', s: '4 pieces · 120g', sa: '٤ حبات · ١٢٠غ', cal: 195, pro: 8, carb: 26, f: 6.4 },
  { cat: 'meals', en: 'Mutabbaq', ar: 'مطبق', s: '1 piece · 250g', sa: '١ قطعة · ٢٥٠غ', cal: 392, pro: 18, carb: 40, f: 17.4 },
  { cat: 'meals', en: 'Lamb Kabsa', ar: 'كبسة لحم', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 480, pro: 25, carb: 54, f: 17.4 },
  { cat: 'meals', en: 'Hasawi Rice with Meat', ar: 'رز حساوي باللحم', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 338, pro: 18, carb: 42, f: 11.1 },
  { cat: 'meals', en: 'Hail Kibbeh', ar: 'كبيبة حائل', s: '3 pieces · 150g', sa: '٣ حبات · ١٥٠غ', cal: 190, pro: 8, carb: 27, f: 6.1 },
  { cat: 'meals', en: 'Shish Barak', ar: 'شيش برك', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 315, pro: 12, carb: 35, f: 13.6 },
  { cat: 'meals', en: 'Madoos', ar: 'معدوس', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 315, pro: 10, carb: 46, f: 10.4 },
  { cat: 'meals', en: 'Haneeth with Rice', ar: 'حنيذ مع الأرز', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 440, pro: 45, carb: 44, f: 6.9 },
  { cat: 'meals', en: 'Jareesh', ar: 'جريش', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 300, pro: 13, carb: 39, f: 9.8 },
  { cat: 'meals', en: 'Temmn Rice Dish', ar: 'تمن', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 295, pro: 14, carb: 37, f: 10.1 },
  { cat: 'meals', en: 'Raqsh', ar: 'رقش', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 290, pro: 18, carb: 15, f: 18 },
  { cat: 'meals', en: 'Saleeg', ar: 'سليق', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 280, pro: 16, carb: 28, f: 10.8 },
  { cat: 'meals', en: 'Chicken Kabsa', ar: 'كبسة دجاج', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 380, pro: 18, carb: 51, f: 11.4 },
  { cat: 'meals', en: 'Lamb Mandi', ar: 'مندي لحم', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 365, pro: 19, carb: 39, f: 13.7 },
  { cat: 'meals', en: 'Chicken Mandi', ar: 'مندي دجاج', s: '1 plate · 350g', sa: '١ طبق · ٣٥٠غ', cal: 420, pro: 28, carb: 52, f: 11.1 },
  { cat: 'meals', en: 'Tharid', ar: 'ثريد', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 250, pro: 15, carb: 23, f: 11.3 },
  { cat: 'meals', en: 'Margoog', ar: 'مرقوق', s: '1 bowl · 300g', sa: '١ طبق · ٣٠٠غ', cal: 270, pro: 12, carb: 33, f: 10.8 },
  { cat: 'meals', en: 'Harees', ar: 'هريس', s: '1 cup · 250g', sa: '١ كوب · ٢٥٠غ', cal: 350, pro: 18, carb: 45, f: 10.9 },
  { cat: 'meals', en: 'Chicken Shawarma Sandwich', ar: 'سندويش شاورما دجاج', s: '1 sandwich · 250g', sa: '١ سندويش · ٢٥٠غ', cal: 500, pro: 30, carb: 45, f: 22.2 },
  { cat: 'meals', en: 'Beef Shawarma Sandwich', ar: 'سندويش شاورما لحم', s: '1 sandwich · 250g', sa: '١ سندويش · ٢٥٠غ', cal: 550, pro: 28, carb: 45, f: 28.7 },
  { cat: 'meals', en: 'Falafel Sandwich', ar: 'سندويش فلافل', s: '1 sandwich · 250g', sa: '١ سندويش · ٢٥٠غ', cal: 480, pro: 15, carb: 65, f: 17.8 },
  { cat: 'meals', en: 'Falafel Pieces', ar: 'حبات فلافل', s: '4 pieces · 100g', sa: '٤ حبات · ١٠٠غ', cal: 330, pro: 13, carb: 32, f: 16.7 },
  { cat: 'meals', en: 'Cheese Manakish', ar: 'منقوشة جبن', s: '1 piece · 200g', sa: '١ قطعة · ٢٠٠غ', cal: 620, pro: 22, carb: 70, f: 28 },
  { cat: 'meals', en: 'Zaatar Manakish', ar: 'منقوشة زعتر', s: '1 piece · 180g', sa: '١ قطعة · ١٨٠غ', cal: 480, pro: 12, carb: 65, f: 19.1 },
  { cat: 'meals', en: 'Shakshuka', ar: 'شكشوكة', s: '1 plate · 300g', sa: '١ طبق · ٣٠٠غ', cal: 350, pro: 18, carb: 20, f: 22 },
  { cat: 'meals', en: 'Chicken Samosa', ar: 'سمبوسة دجاج', s: '2 pieces · 100g', sa: '٢ حبة · ١٠٠غ', cal: 260, pro: 10, carb: 30, f: 11.1 },
  { cat: 'meals', en: 'Cheese Samosa', ar: 'سمبوسة جبن', s: '2 pieces · 100g', sa: '٢ حبة · ١٠٠غ', cal: 290, pro: 9, carb: 28, f: 15.8 },
  { cat: 'meals', en: 'Fried Kibbeh', ar: 'كبة مقلية', s: '2 pieces · 120g', sa: '٢ حبة · ١٢٠غ', cal: 310, pro: 14, carb: 28, f: 15.8 },
  { cat: 'meals', en: 'Chicken over Rice', ar: 'دجاج مع الأرز', s: '1 plate · 450g', sa: '١ طبق · ٤٥٠غ', cal: 750, pro: 42, carb: 90, f: 24.7 },
  { cat: 'meals', en: 'Lamb over Rice', ar: 'لحم مع الأرز', s: '1 plate · 450g', sa: '١ طبق · ٤٥٠غ', cal: 850, pro: 38, carb: 92, f: 36.7 },
  { cat: 'meals', en: 'Mixed Grilled Kebab Plate', ar: 'مشاوي مشكلة', s: '1 plate · 300g', sa: '١ طبق · ٣٠٠غ', cal: 650, pro: 55, carb: 18, f: 39.8 },
  { cat: 'meals', en: 'Chicken Burger', ar: 'برجر دجاج', s: '1 burger · 200g', sa: '١ حبة · ٢٠٠غ', cal: 420, pro: 25, carb: 42, f: 16.9 },
  { cat: 'meals', en: 'Cheeseburger', ar: 'برجر بالجبن', s: '1 burger · 220g', sa: '١ حبة · ٢٢٠غ', cal: 520, pro: 29, carb: 43, f: 25.8 },
  { cat: 'meals', en: 'Fried Chicken Breast Piece', ar: 'قطعة صدر دجاج مقلي', s: '1 piece · 180g', sa: '١ قطعة · ١٨٠غ', cal: 450, pro: 38, carb: 20, f: 24.2 },
  { cat: 'meals', en: 'Fried Chicken Drumsticks', ar: 'أفخاذ دجاج مقلية', s: '2 pieces · 180g', sa: '٢ قطعة · ١٨٠غ', cal: 430, pro: 32, carb: 18, f: 25.6 },
  { cat: 'meals', en: 'Fried Chicken Wings', ar: 'أجنحة دجاج مقلية', s: '6 pieces · 240g', sa: '٦ قطع · ٢٤٠غ', cal: 620, pro: 45, carb: 25, f: 37.8 },
  { cat: 'meals', en: 'Pepperoni Pizza Slice', ar: 'شريحة بيتزا بيبروني', s: '1 slice · 120g', sa: '١ شريحة · ١٢٠غ', cal: 330, pro: 14, carb: 35, f: 14.9 },
  { cat: 'meals', en: 'Margherita Pizza Slice', ar: 'شريحة بيتزا مارغريتا', s: '1 slice · 110g', sa: '١ شريحة · ١١٠غ', cal: 270, pro: 12, carb: 34, f: 9.6 },
  { cat: 'meals', en: 'Chicken Wrap', ar: 'لفافة دجاج', s: '1 wrap · 250g', sa: '١ لفافة · ٢٥٠غ', cal: 450, pro: 30, carb: 45, f: 16.7 },
  { cat: 'meals', en: 'Club Sandwich', ar: 'ساندويتش كلوب', s: '1 sandwich · 300g', sa: '١ ساندويتش · ٣٠٠غ', cal: 650, pro: 35, carb: 55, f: 32.2 },
  { cat: 'meals', en: 'Luqaimat', ar: 'لقيمات', s: '6 pieces · 120g', sa: '٦ حبات · ١٢٠غ', cal: 430, pro: 5, carb: 65, f: 16.7 },
  { cat: 'meals', en: 'Kunafa', ar: 'كنافة', s: '1 piece · 150g', sa: '١ قطعة · ١٥٠غ', cal: 450, pro: 10, carb: 55, f: 21.1 },
  { cat: 'meals', en: 'Basbousa', ar: 'بسبوسة', s: '1 piece · 100g', sa: '١ قطعة · ١٠٠غ', cal: 360, pro: 6, carb: 50, f: 15.1 },
  // Drinks
  { cat: 'drinks', en: 'Orange Juice', ar: 'عصير برتقال', s: '250ml', sa: '٢٥٠مل', cal: 112, pro: 2, carb: 26, f: 0 },
  { cat: 'drinks', en: 'Cola', ar: 'كولا', s: '330ml', sa: '٣٣٠مل', cal: 140, pro: 0, carb: 35, f: 0 },
  { cat: 'drinks', en: 'Saudi Arabic Coffee', ar: 'قهوة سعودية', s: '1 small cup · 60ml', sa: '١ فنجان · ٦٠مل', cal: 2, pro: 0, carb: 0, f: 0 },
  { cat: 'drinks', en: 'Karak Tea', ar: 'شاي كرك', s: '1 cup · 250ml', sa: '١ كوب · ٢٥٠مل', cal: 160, pro: 5, carb: 25, f: 4.4 },
  { cat: 'drinks', en: 'Black Tea', ar: 'شاي أسود', s: '1 cup · 250ml', sa: '١ كوب · ٢٥٠مل', cal: 2, pro: 0, carb: 0, f: 0 },
  { cat: 'drinks', en: 'Sweet Mint Tea', ar: 'شاي بالنعناع محلى', s: '1 cup · 250ml', sa: '١ كوب · ٢٥٠مل', cal: 80, pro: 0, carb: 20, f: 0 },
  { cat: 'drinks', en: 'Lemon Mint Juice', ar: 'عصير ليمون بالنعناع', s: '1 glass · 300ml', sa: '١ كوب · ٣٠٠مل', cal: 160, pro: 1, carb: 39, f: 0 },
  { cat: 'drinks', en: 'Mango Juice', ar: 'عصير مانجو', s: '250ml', sa: '٢٥٠مل', cal: 150, pro: 1, carb: 36, f: 0 },
  { cat: 'drinks', en: 'Diet Cola', ar: 'كولا دايت', s: '1 can · 330ml', sa: '١ علبة · ٣٣٠مل', cal: 0, pro: 0, carb: 0, f: 0 },
  { cat: 'drinks', en: 'Energy Drink', ar: 'مشروب طاقة', s: '1 can · 250ml', sa: '١ علبة · ٢٥٠مل', cal: 110, pro: 0, carb: 27, f: 0 },
];

