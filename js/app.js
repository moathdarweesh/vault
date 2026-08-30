// ==========================================================================
// VAULT - Main App
// ==========================================================================

// Single source of truth for the shipped build. Used by the visible build label
// AND the feedback version tag so they can never drift apart.
//
// Derived from THIS script's own ?v=N when possible, so the label reports the
// build the browser actually LOADED rather than a literal that a missed bump can
// leave stale. That matters for bug reports: a user on a cached older bundle used
// to report the version the source *claims*, sending you hunting in the wrong
// build. The literal below is the fallback (file://, or a stripped query) and is
// still bumped by `npm run release` — see CLAUDE.md "CACHE WORKFLOW".
const VAULT_BUILD = (() => {
  const FALLBACK = 'v283';
  try {
    const src = (document.currentScript && document.currentScript.src) || '';
    const m = src.match(/[?&]v=(\d+)/);
    return m ? 'v' + m[1] : FALLBACK;
  } catch (_) { return FALLBACK; }
})();

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
  vault: '<rect x="2.6" y="9" width="2.8" height="6" rx="1.4" fill="currentColor" opacity=".55"/><rect x="7" y="5" width="2.8" height="14" rx="1.4" fill="currentColor"/><rect x="14.2" y="5" width="2.8" height="14" rx="1.4" fill="currentColor"/><rect x="18.6" y="9" width="2.8" height="6" rx="1.4" fill="currentColor" opacity=".55"/><rect x="10.6" y="7" width="2.8" height="10" rx="1.4" fill="var(--icon-accent,#ff6a00)"/>',
  vaultDoor: '<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="currentColor"/><circle cx="12" cy="12" r="4.4" fill="var(--icon-accent,#ff6a00)"/><rect x="11.1" y="3.8" width="1.8" height="3.2" rx=".9" fill="var(--icon-accent,#ff6a00)"/><rect x="11.1" y="17" width="1.8" height="3.2" rx=".9" fill="var(--icon-accent,#ff6a00)"/><rect x="3.8" y="11.1" width="3.2" height="1.8" rx=".9" fill="var(--icon-accent,#ff6a00)"/><rect x="17" y="11.1" width="3.2" height="1.8" rx=".9" fill="var(--icon-accent,#ff6a00)"/>',
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
  backspace: '<path d="M9.4 3.4h9.2a3 3 0 0 1 3 3v11.2a3 3 0 0 1-3 3H9.4a1.7 1.7 0 0 1-1.2-.5L1.6 13a1.4 1.4 0 0 1 0-2l6.6-7a1.7 1.7 0 0 1 1.2-.6Z" fill="currentColor"/><path d="m11.4 8.6 1.9-1.9 2.7 2.7 2.7-2.7 1.9 1.9-2.7 2.7 2.7 2.7-1.9 1.9-2.7-2.7-2.7 2.7-1.9-1.9 2.7-2.7Z" fill="var(--icon-accent,#ff6a00)"/>',

  // ——— cardio & movement ———
  run: '<path d="M14.6 7.6 8.4 11l2 3.8-4 6.4 2.8 1.6 4.6-7.2-1.4-2.6 3-1.6 3.4 2.2 1.6-2.6-4.2-2.8Z" fill="currentColor"/><circle cx="16.4" cy="4.6" r="2.7" fill="var(--icon-accent,#ff6a00)"/>',
  walk: '<path d="M11.2 7.4 8 13.4l2.4 2.2-1.8 5.8 2.8.8 2.2-7-1.6-1.8 1.6-2.4 2.4 1.8 1.4 3.6 2.6-1-1.8-4.6Z" fill="currentColor"/><circle cx="13" cy="4.2" r="2.7" fill="var(--icon-accent,#ff6a00)"/>',
  bike: '<path d="M5.6 12.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 2.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="currentColor"/><path d="M18.4 12.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 2.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="currentColor"/><path d="M9.2 5.6h4.6l4.8 10.6-2.2 1-4.2-9.2H9.2Z" fill="var(--icon-accent,#ff6a00)"/><path d="m12.6 7.4 2.4.6-2.6 8.8-2.4-.7Z" fill="var(--icon-accent,#ff6a00)"/>',
  treadmill: '<path d="M4.6 13.6h10.8a3.4 3.4 0 0 1 0 6.8H4.6a3.4 3.4 0 0 1 0-6.8Z" fill="currentColor"/><path d="M16.6 17.4V6.4h-4.4V4h6.8v13.4Z" fill="var(--icon-accent,#ff6a00)"/>',
  footprints: '<path d="M6.8 2.6c1.9 0 3.4 2.3 3.4 5.2S8.7 13 6.8 13 3.4 10.7 3.4 7.8 4.9 2.6 6.8 2.6Z" fill="currentColor"/><path d="M17.2 9.4c1.9 0 3.4 2.3 3.4 5.2s-1.5 5.2-3.4 5.2-3.4-2.3-3.4-5.2 1.5-5.2 3.4-5.2Z" fill="var(--icon-accent,#ff6a00)"/>',
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

// The glyphs are filled, so there is nothing here to tune: no stroke width, no
// caps, no joins. The per-size stroke bands and the ICON_CAPS exception map that
// used to live here both died with the stroked set — a filled mass keeps its
// weight at any size on its own.
//
// Colour comes from the CONTAINER, not from here: base = currentColor, accent =
// --icon-accent (see the "VAULT Duotone icons" block in styles.css).
function icon(name, size = 20) {
  const path = ICONS[name] || '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${path}</svg>`;
}
// ==========================================================================
// Workout templates (predefined)
// Each day's `exercises` are matched to user's library by name.
// ==========================================================================
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

// Server-provided "ready-made plans" (admin panel `preset_plans`, pulled at
// boot — see bootCatalog()). Same shape as a WORKOUT_TEMPLATES entry
// ({ id, name, description, days:[{name, exercises:[names]}] }) so they can
// flow through the exact same openScheduleModal()/DB.plan.applySchedule path.
// Starts empty so the templates browser is byte-for-byte unchanged offline or
// before the catalog has loaded (or is empty).
let SERVER_PRESET_PLANS = [];
function setServerPresetPlans(rows) {
  try {
    SERVER_PRESET_PLANS = (Array.isArray(rows) ? rows : [])
      .filter((p) => p && p.id && p.data && Array.isArray(p.data.days) && p.data.days.length)
      .map((p) => ({
        id: p.id,
        name: (p.name || 'Plan').toString(),
        description: (p.description || '').toString(),
        days: p.data.days
          .filter((d) => d && Array.isArray(d.exercises))
          .map((d) => ({ name: (d.name || 'Workout').toString(), exercises: d.exercises.filter((n) => typeof n === 'string') })),
      }))
      .filter((p) => p.days.length);
  } catch (_) { SERVER_PRESET_PLANS = []; }
}


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

const CATEGORY_FALLBACK_MUSCLES = {
  Chest: ['chest'],
  Back: ['lats', 'upper_back'],
  Legs: ['quads', 'hamstrings'],
  Shoulders: ['front_delts'],
  Arms: ['biceps', 'triceps'],
  Core: ['abs'],
  Other: [],
};

const MUSCLE_INFO = {
  chest:        { side: 'anterior',  order: 1 },
  upper_chest:  { side: 'anterior',  order: 2 },
  front_delts:  { side: 'anterior',  order: 3 },
  side_delts:   { side: 'anterior',  order: 4 },
  biceps:       { side: 'anterior',  order: 5 },
  forearms:     { side: 'anterior',  order: 6 },
  abs:          { side: 'anterior',  order: 7 },
  quads:        { side: 'anterior',  order: 8 },
  adductors:    { side: 'anterior',  order: 9 },
  upper_back:   { side: 'posterior', order: 1 },
  lats:         { side: 'posterior', order: 2 },
  traps:        { side: 'posterior', order: 3 },
  rear_delts:   { side: 'posterior', order: 4 },
  triceps:      { side: 'posterior', order: 5 },
  lower_back:   { side: 'posterior', order: 6 },
  glutes:       { side: 'posterior', order: 7 },
  hamstrings:   { side: 'posterior', order: 8 },
  calves:       { side: 'posterior', order: 9 },
};

function getMusclesForExercise(ex) {
  if (!ex) return [];
  const direct = EXERCISE_MUSCLES[ex.name];
  if (direct) return direct;
  return CATEGORY_FALLBACK_MUSCLES[ex.category] || [];
}

// Given a list of exercise IDs (or a list of exercise objects), return
// { anterior: [muscleKey, ...], posterior: [muscleKey, ...] } — deduped + sorted.
function groupMusclesFromExercises(exercises) {
  const seen = new Set();
  const ant = [];
  const post = [];
  exercises.forEach((ex) => {
    if (!ex) return;
    getMusclesForExercise(ex).forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      const info = MUSCLE_INFO[m];
      if (!info) return;
      const item = { key: m, order: info.order };
      if (info.side === 'anterior') ant.push(item);
      else post.push(item);
    });
  });
  ant.sort((a, b) => a.order - b.order);
  post.sort((a, b) => a.order - b.order);
  return { anterior: ant.map((x) => x.key), posterior: post.map((x) => x.key) };
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
// i18n - Translations
// ==========================================================================
const I18N = {
  en: {
    app_name: 'VAULT',
    // nav_train labels the Program tab (view id 'workouts'), not the exercise
    // browser — that moved to its own screen. See renderProgram.
    nav_home: 'Home', nav_train: 'Program', nav_cardio: 'Cardio', nav_food: 'Food', nav_sleep: 'Sleep',

    greet_morning: 'Good morning', greet_afternoon: 'Good afternoon', greet_evening: 'Good evening',

    cat_Chest: 'Chest', cat_Back: 'Back', cat_Legs: 'Legs',
    cat_Shoulders: 'Shoulders', cat_Arms: 'Arms', cat_Core: 'Core', cat_Other: 'Other',
    cat_All: 'All',

    // Muscle groups (for the planner)
    anterior: 'Anterior', posterior: 'Posterior',
    muscle_chest: 'Chest', muscle_upper_chest: 'Upper Chest',
    muscle_front_delts: 'Front Delts', muscle_side_delts: 'Side Delts', muscle_rear_delts: 'Rear Delts',
    muscle_biceps: 'Biceps', muscle_triceps: 'Triceps', muscle_forearms: 'Forearms',
    muscle_abs: 'Abs',
    muscle_upper_back: 'Upper Back', muscle_lats: 'Lats', muscle_traps: 'Traps',
    muscle_lower_back: 'Lower Back',
    muscle_quads: 'Quads', muscle_hamstrings: 'Hamstrings', muscle_glutes: 'Glutes', muscle_calves: 'Calves',
    muscle_adductors: 'Adductors',
    rest_day_muscles: 'No muscles scheduled',

    // Home
    streak_one_day: '1 day', streak_days: 'days',
    streak_active: 'Active streak — keep it going!',
    streak_start: 'Log a session to start your streak',
    workouts: 'Workouts', volume: 'Volume', cardio: 'Cardio', last_sleep: 'Last sleep', sleep_today: "Today's sleep",
    sessions_label: 'Sessions',
    sessions_this_week: 'sets this week',
    this_week: 'this week',
    muscle_focus: 'Muscle Focus',
    muscle_focus_sub: 'Sessions per muscle · last 7 days',

    // Train / Workouts
    train: 'Train', cardio_title: 'Cardio', food: 'Food', sleep: 'Sleep', compare: 'Compare', settings: 'Settings',
    library: 'Library',
    train_subtitle: 'Tap an exercise to log a session or view your history.',
    search_exercises: 'Search exercises…',
    new_exercise: 'New Exercise',
    new_exercise_sub: 'Add a custom exercise to your library.',
    add_custom: 'Add a custom one',
    my_exercises_short: 'My exercises', my_exercises_sub: 'The exercises you created.',
    ce_empty_title: 'No custom exercises yet', ce_empty_text: 'Tap "Add a custom one" to create your own exercise with a name, category and photo.',
    no_matches: 'No matches found',
    no_matches_hint: 'Try a different search term.',
    no_sessions_yet: 'No sets yet',
    custom: 'Custom',
    custom_exercise_label: 'CUSTOM EXERCISE',

    // Exercise detail
    log_session: 'Log Session',
    edit_session: 'Edit Session',
    log_session_tap: 'Tap "Log Session" to record your first set.',
    max_weight: 'Max Weight', max_reps: 'Max Reps', sessions_n: 'Sets',
    exercise: 'exercise', exercises: 'exercises',
    history: 'History',
    show_more: 'Show more',
    no_sessions: 'No sets yet',
    total_sets: 'Total Sets',
    pr: 'PR',
    volume_label: 'Volume',
    set_n: 'Set',
    reps: 'reps', weight_kg: 'kg',
    last_session: 'Last session',
    date: 'Date',
    sets: 'Sets',
    add_set: 'Add Set',
    set_min_one: 'At least one set is required',
    add_at_least_one: 'Add at least one set',
    session_saved: 'Session saved',
    session_updated: 'Session updated',
    session_deleted: 'Session deleted',
    delete_session_q: 'Delete session?',
    delete_session_text: 'This session will be permanently removed from your history.',
    delete_exercise_q: 'Delete exercise?',
    delete_exercise_text: 'This exercise and all its session history will be removed.',
    exercise_deleted: 'Exercise deleted',
    exercise_added: 'Exercise added',
    enter_name: 'Enter a name',
    name: 'Name', category: 'Category',
    save: 'Save', cancel: 'Cancel', update: 'Update', delete: 'Delete', edit: 'Edit', select: 'Select',
    unit: 'Unit', done: 'Done',
    // Reminders
    remind_title: 'Reminders',
    remind_sub: 'Supplement and water reminders.',
    remind_off: 'Off',
    remind_from: 'From', remind_to: 'To',
    remind_none: 'No reminders set',
    remind_times: 'Reminder times', remind_add_time: 'Add time',
    remind_denied: 'Notifications were not allowed.',
    remind_blocked: 'Notifications are blocked — turn them on in your phone settings.',
    remind_water_body: 'Time for a glass of water.',
    open: 'Open',
    remind_sound_off: 'Silent — drawer only',
    remind_test: 'Send a test alert', remind_test_sub: 'Arrives in about 5 seconds',
    remind_test_title: 'VAULT', remind_test_body: 'Test alert — reminders are working.',
    remind_test_sent: 'Test sent — watch your notification bar.',
    remind_test_failed: 'Could not send',
    remind_channel_alert: 'Reminders', remind_channel_quiet: 'Reminders (silent)',
    remind_channel_desc: 'Supplement and water reminders',
    remind_stat_perm_ok: 'Permission granted', remind_stat_perm_no: 'Permission not granted',
    remind_stat_mismatch: 'Android is holding {a} of the {b} we scheduled',
    remind_stat_off: 'Notifications are switched off for VAULT in Android settings.',
    remind_stat_queued: 'queued with Android',
    remind_exact_title: 'Exact timing is off',
    remind_exact_sub: 'Android may delay reminders. Tap to allow exact alarms.',
    remind_exact_ok: 'Exact timing allowed',
    remind_battery_title: 'Still nothing arriving?',
    remind_battery_sub: 'Battery saving can hold reminders back. Settings → Apps → VAULT → Battery → Unrestricted. On Samsung also: Settings → Battery → Background usage limits → remove VAULT from sleeping apps.',
    not_found: 'Not found', not_found_text: 'This exercise no longer exists.',

    // Cardio
    cardio_subtitle: 'Treadmill, walking, and cycling sessions.',
    no_cardio: 'No cardio yet',
    no_cardio_text: 'Log your first treadmill, walk, or ride with the button above.',
    close: 'Close',
    all_sessions: 'All Sessions',
    log: 'Log',
    log_cardio: 'Log Cardio', edit_cardio: 'Edit Cardio',
    cardio_quick: 'Quick log: type, duration, calories.',
    type: 'Type',
    duration_min: 'Duration (min)',
    calories: 'Calories',
    sessions_w: 'Sessions', minutes: 'Minutes',
    unit_hr: 'h', unit_min: 'min',
    enter_duration: 'Enter a duration',
    delete_cardio_q: 'Delete cardio session?',
    delete_cardio_text: 'This session will be removed from your history.',
    saved: 'Saved', updated: 'Updated', deleted: 'Deleted',
    treadmill: 'Treadmill', walking: 'Walking', running: 'Running', cycling: 'Cycling',
    new_cardio_type: 'New Cardio Type',
    new_cardio_type_sub: 'Create your own cardio activity.',
    cardio_type_name_ph: 'e.g. Stairs, Rowing',
    icon: 'Icon',
    enter_name: 'Enter a name',

    // Food
    // Nutrition dashboard
    nutri_setup_title: 'Set your daily goal',
    nutri_setup_text: 'Calculate your calories & macros to start tracking.',
    nutri_left: 'left',
    nutri_setup_cta: 'Set it up',
    nutri_over: 'over',
    nutri_calories: 'Calories',
    coach_title: 'AI Coach',
    coach_sub: 'What to eat to hit your remaining macros',
    coach_thinking: 'Thinking…',
    coach_unavailable: 'Coach is unavailable right now.',
    coach_goal_met: "You've hit your goal for today 🎉",
    add_sheet_title: 'Add food',
    add_voice: 'Voice', add_voice_sub: 'Say what you ate',
    add_chat: 'Chat', add_chat_sub: 'Type it — AI finds the calories',
    add_photo: 'Photo', add_photo_sub: 'Snap your meal',
    add_barcode: 'Barcode', bc_amount: 'Amount', unit_g: 'g',
    water: 'Water', unit_ml: 'ml', water_undo: 'Remove a cup',
    bodyweight: 'Weight', weight_add_first: 'Log your weight', weight_trend: 'Weight trend',
    weight_need_more: 'Log at least 2 days to see your trend', weight_placeholder: 'Today’s weight',
    weight_empty_hint: 'Log your weight regularly to track your progress',
    portion_less: 'Smaller portion', portion_more: 'Larger portion',
    onb_welcome_title: 'Welcome to VAULT', onb_welcome_sub: 'Your workouts and nutrition, in one place.',
    onb_feat_workouts: 'Plan & log every workout', onb_feat_ai: 'AI calories — photo, voice, or barcode',
    onb_feat_progress: 'Track weight, streaks & progress', onb_start: 'Get started',
    onb_unit_title: 'Choose your units', onb_unit_sub: 'You can change this later in Settings.',
    onb_unit_metric: 'Metric', onb_unit_imperial: 'Imperial',
    unit_kg_name: 'Kilograms', unit_lb_name: 'Pounds',
    onb_goal_title: 'Set your calorie goal', onb_goal_sub: 'A quick calculator builds your daily targets. You can skip and set it later.',
    onb_set_goal: 'Set my goal', onb_skip: 'Skip for now',
    barcode_hint: 'Point the camera at a barcode',
    barcode_looking: 'Looking it up…',
    barcode_not_found: 'Not found — try Photo or Manual.',
    barcode_loading: 'Starting the scanner…',
    barcode_manual_hint: 'Type the barcode number below',
    barcode_number_ph: 'Barcode number',
    barcode_lookup: 'Look up',
    barcode_invalid: 'Enter a valid barcode number',
    barcode_cam_denied_manual: 'Camera blocked — type the barcode number instead.',
    add_saved: 'Saved food', add_saved_sub: 'Pick from your foods',
    add_manual: 'Manual', add_manual_sub: 'Enter the numbers yourself',
    saved_new: 'Add a new saved food', saved_empty: 'No saved foods yet',
    calc_title: 'Calorie calculator', calc_sub: 'Mifflin-St Jeor — the gold standard',
    calc_mode_manual: 'Enter manually',
    calc_use_manual: 'Or enter the numbers manually', calc_use_calc: 'Use the calculator instead',
    calc_sex: 'Sex', calc_male: 'Male', calc_female: 'Female',
    calc_age: 'Age', calc_height: 'Height (cm)', calc_weight: 'Weight (kg)',
    calc_activity: 'Activity', calc_goal: 'Goal',
    activity_sedentary: 'Sedentary', activity_light: 'Light', activity_moderate: 'Moderate', activity_active: 'Active', activity_very_active: 'Very active',
    goal_cut: 'Cut', goal_maintain: 'Maintain', goal_bulk: 'Bulk',
    calc_tdee: 'Maintenance', calc_bmr: 'BMR', calc_fill_hint: 'Fill in age, height and weight.',
    manual_food_title: 'Add food', manual_food_ph: 'e.g. Chicken & rice',
    voice_tap: 'Tap to speak', voice_listening: 'Listening… tap to stop',
    voice_processing: 'Understanding…', voice_denied: 'Microphone blocked. Allow it when the system asks, then tap again.',
    voice_denied_web: 'Microphone blocked for this site. Enable it in your browser settings, then tap again.',
    voice_no_mic: 'No microphone found.',
    voice_unsupported: 'Voice needs the latest app build.',
    no_matches_simple: 'No matches',
    no_matches_text: 'Try a different search.',
    search_foods: 'Search foods…',
    add: 'Add',
    food_library_title: 'Add from Library',
    food_library_sub: 'Tap a food to add it to your list.',
    add_manually: 'Add manually',
    fcat_protein: 'Protein',
    fcat_carbs: 'Grains & Carbs',
    fcat_legumes: 'Legumes',
    fcat_dairy: 'Dairy',
    fcat_fruit: 'Fruits',
    fcat_veg: 'Vegetables',
    fcat_fats: 'Nuts & Fats',
    fcat_meals: 'Meals',
    fcat_drinks: 'Drinks',
    fcat_more: 'More',
    new_food: 'New Food', edit_food: 'Edit Food',
    food_quick: 'Macros per serving.',
    serving_hint: 'e.g. 100g, 1 cup',
    amount_label: 'Amount', serving_unit_label: 'Unit', unit_hint: 'g, ml, piece',
    ph_exercise_name: 'e.g. Bulgarian Split Squat', ph_food_name: 'e.g. Chicken Breast', ph_supplement_name: 'e.g. Creatine',
    view_photo: 'View photo',
    protein_g: 'Protein (g)', carbs_g: 'Carbs (g)',
    cal: 'cal', protein_label: 'protein', carbs_label: 'carbs', fat_label: 'fat',
    ai_chat_title: 'Calorie Chat', ai_chat_sub: 'Tell me what you ate — I log the calories',
    // Pasting a nutrition table: the figures are already there, so they are
    // USED, not re-estimated. See parseMacroText in js/foodai.js.
    img_error: 'Image error',
    ai_pasted_meal: 'Meal',
    ai_used_your_numbers: 'Used your numbers — nothing was estimated.',
    ai_untracked: '{fields} are not tracked by the app, so they were not saved.',
    ai_nut_cholesterol: 'Cholesterol', ai_nut_sodium: 'Sodium',
    ai_chat_placeholder: 'e.g. breakfast: eggs & bread, lunch: a burger',
    ai_add_all: 'Add all',
    ai_analyzing: 'calculating…',
    ai_photo: 'Photo',
    ai_no_result: 'No result — try rephrasing.',
    ai_add_to_log: 'Add to log',
    ai_added: 'Added',
    ai_error: 'Something went wrong',
    ai_rate_limit: 'The free AI service is busy right now — please try again in a minute.',
    ai_not_food: 'This chat is for food only — type a meal to calculate it.',

    // Auth / cloud sync
    auth_sub_in: 'Sign in to sync your data',
    auth_sub_up: 'Create an account to sync across devices',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_signin: 'Sign in',
    auth_signup: 'Create account',
    // Prefix only — the action next to it reuses auth_signup / auth_signin.
    auth_no_account: "Don't have an account?",
    auth_have_account: 'Already have an account?',
    auth_offline_grace: "You're offline — signed in on this device, so your data is available. Sync resumes when you reconnect.",
    username_title: 'Choose your username',
    username_sub: 'A unique handle others will know you by. Required to continue.',
    username_ph: 'username',
    username_rules: '3–20 characters · letters, numbers and _ only',
    username_save: 'Save username',
    username_checking: 'Checking…',
    username_available_msg: 'Available ✓',
    username_taken: 'That username is already taken',
    username_invalid: 'Use 3–20 letters, numbers or _',
    username_saved: 'Username set',
    update_title: 'A new version is available',
    update_get: 'Download',
    update_later: 'Later',
    web_update_title: 'A new version is ready',
    web_update_action: 'Update',
    feedback_title: 'Send feedback',
    feedback_sub: 'Suggestions or issues — we read every one',
    feedback_ph: 'Your suggestion or feedback…',
    feedback_send: 'Send',
    feedback_sent: 'Thanks! Your feedback was sent',
    feedback_empty: 'Please write something first',
    account_blocked_title: 'Account unavailable',
    account_disabled_msg: 'Your account has been disabled. Please contact support.',
    account_banned_msg: 'Your account has been suspended.',
    auth_forgot: 'Forgot password?',
    auth_reset_title: 'Reset password',
    auth_reset_sub: 'Enter your email and we’ll send you a link to set a new password.',
    auth_reset_send: 'Send reset link',
    auth_reset_sent: 'Check your email for the reset link',
    auth_signing: 'Please wait…',
    auth_checking: 'Checking…',
    auth_err_fields: 'Enter your email and password',
    auth_pw_short: 'Password must be at least 6 characters',
    auth_signup_check_email: 'Account created — confirm via the email we sent, then sign in.',
    auth_err_invalid: 'Wrong email or password',
    auth_err_exists: 'This email already has an account — sign in instead',
    auth_err_email: 'Enter a valid email',
    auth_err_network: 'Connection problem — check your internet',
    auth_err_generic: 'Could not sign in. Try again.',
    auth_not_signed: 'Not signed in',
    auth_signin_sub: 'Sign in to sync your data across devices',
    account: 'Account',
    account_synced_sub: 'Your data syncs automatically',
    sync_now: 'Sync now',
    sync_now_sub: 'Pull the latest and push your changes',
    synced: 'Synced',
    syncing: 'Syncing your data…',
    cloud_backup_kept: 'Your cloud backup was kept safe — the empty data did not sync.',
    logout: 'Log out',
    logout_sub: 'Sign out and clear this device',
    logout_confirm: 'You will be signed out and this device cleared. Your data is safe in your account — sign in again to restore it.',
    delete_account: 'Delete account',
    delete_account_sub: 'Permanently erase your account and all data',
    delete_account_confirm: 'This permanently deletes your account and ALL your data — workouts, nutrition, health, images — from every device and the cloud. This cannot be undone.',
    deleting_account: 'Deleting your account…',
    mf_quick_label: 'Write it in one line',
    mf_quick_ph: 'e.g. ful 1000 calories and 55 g protein',
    mf_quick_hint: 'Type the numbers and the boxes below fill themselves.',
    mf_quick_ok: 'Read your numbers — nothing was estimated.',
    mf_quick_none: 'No calories found yet — keep typing, or fill the boxes below.',
    mf_keep_label: 'Save to my foods for next time',
    mf_added_and_kept: 'Added, and saved to your foods',
    ai_photo_note_ph: 'Describe it (optional)',
    ai_photo_analyze: 'Analyze',
    ai_photo_note_hint: 'What is in it, how it was cooked, the oil — or exact calories if you know them.',
    delete_images_inspect_error: 'Could not inspect your stored images — nothing was deleted. Please try again.',
    delete_images_cleanup_error: 'Your account was deleted, but stored images could not be removed. Please try again.',
    privacy_policy: 'Privacy Policy & Terms',
    privacy_policy_sub: 'How your data is used',
    about_title: 'About',
    change_password: 'Change password',
    change_password_sub: 'Set a new password for this account',
    change_password_current: 'Current password',
    change_password_current_req: 'Enter your current password',
    change_password_wrong_current: 'Current password is incorrect',
    change_password_new: 'New password',
    change_password_confirm: 'Confirm new password',
    change_password_mismatch: 'Passwords do not match',
    change_password_done: 'Password changed',
    conflict_title: 'Existing data found',
    conflict_text: 'Your account already has saved data. Which version do you want to keep?',
    conflict_cloud: 'Keep account data',
    conflict_local: "Keep this device's data",

    // Sleep
    sleep_subtitle: 'Track when you sleep and wake up.',
    no_sleep_logged: 'No sleep logged',
    sleep_stages: 'Sleep stages', sleep_deep: 'Deep', sleep_light: 'Light', sleep_rem: 'REM', sleep_awake: 'Awake',
    sleep_efficiency: 'Sleep efficiency',
    sleep_q_excellent: 'Excellent', sleep_q_good: 'Good', sleep_q_fair: 'Fair',
    no_sleep_text: 'Tap "Log" to record your first night of sleep.',
    nights_logged: 'Logged',
    last_night: 'Last Night', avg_7d: '7-Day Avg',
    log_sleep: 'Log Sleep', edit_sleep: 'Edit Sleep',
    sleep_quick: 'The date is the morning you woke up.',
    sleep_time: 'Sleep Time', wake_time: 'Wake Time',
    total_sleep: 'Total sleep',
    fill_all_fields: 'Fill all fields',
    delete_sleep_q: 'Delete sleep entry?',
    delete_sleep_text: 'This entry will be removed from your log.',

    // Compare
    compare_title: 'Compare',
    weekly: 'Weekly',
    compare_subtitle: 'This week versus last week.',
    this_week_label: 'This week', last_week_label: 'Last week',
    not_enough_data: 'Not enough data yet',
    not_enough_data_text: 'Log sessions across two weeks to see your progress here.',
    not_enough_cardio: 'Log cardio across two weeks to see your progress.',
    not_enough_sleep: 'Log sleep across two weeks to see progress.',
    same_as_last_week: 'Same as last week',
    no_data_short: 'No data',
    need_both_weeks: 'Need data from both weeks',
    total_minutes: 'Total Minutes', calories_burned: 'Calories Burned',
    avg_sleep: 'Average Sleep', nights_logged_t: 'Nights Logged',

    // Settings
    settings_title: 'Settings',
    settings_subtitle: 'Customize language, theme, and manage your data.',
    language: 'Language',
    translate_ex_title: 'Exercise names', translate_ex_sub: 'Show built-in exercise names transliterated in Arabic, or keep them in English.',
    translate_ex_on: 'Arabic', translate_ex_off: 'English',
    theme: 'Theme',
    data: 'Data',
    theme_dark: 'Dark', theme_light: 'Light',
    export_data: 'Export Data', export_data_sub: 'Download a JSON backup',
    storage_error_title: 'Your data could not be saved',
    storage_full_text: 'This device has run out of storage space, so new entries are NOT being saved. Export a backup now, then free up space (removing custom exercise photos helps most — they are already backed up to your account).',
    storage_write_failed_text: 'Writing to this device failed, so new entries are NOT being saved. Export a backup now to be safe.',
    storage_unreadable_text: 'The data stored on this device could not be read, so the app is running in read-only mode to protect it. Nothing has been deleted. Sign in to restore from your account, or contact support before making changes.',
    import_data: 'Import Data', import_data_sub: 'Restore from a JSON backup',
    health_section: 'Health Connect',
    health_connect: 'Sync from Health Connect',
    health_connect_sub: 'Steps, heart rate, oxygen & sleep from your watch',
    health_only_android: 'Available only in the Android app',
    health_unavailable: 'Health Connect is not installed on this device',
    health_no_permission: 'Permission not granted',
    health_syncing: 'Syncing…',
    health_synced: 'Synced from Health Connect',
    from_watch: 'Watch',
    health_hr: 'Heart rate', health_oxygen: 'Blood oxygen', health_sleep: 'Sleep',
    health_no_data: 'No data in this range',
    health_connect_btn: 'Connect', health_open_settings: 'Open Health Connect',
    health_today: 'Today', health_bpm: 'bpm', health_min: 'min',
    health_calories: 'Calories', health_distance: 'Distance', health_vo2: 'VO₂ max',
    health_exercise: 'Exercise', health_power: 'Power', health_speed: 'Speed',
    health_kcal: 'kcal', health_km: 'km', health_kmh: 'km/h', health_watt: 'W', health_vo2_unit: 'ml/kg',
    health_home: 'Health', health_toggle_hint: 'Tap a card to show or hide it on your home screen.',
    health_all_hidden: 'All hidden — tap to choose cards',
    reset_data: 'Reset All Data', reset_data_sub: 'Delete everything and start fresh',
    reset_q: 'Reset all data?',
    reset_text: 'This will permanently delete all exercises, sessions, cardio, food, sleep, and settings.',
    reset_confirm: 'Reset',
    imported: 'Data imported',
    import_failed: 'Import failed: invalid file',

    // Recent/misc
    today: 'Today', yesterday: 'Yesterday',
    days_ago: 'days ago', weeks_ago: 'weeks ago', months_ago: 'months ago',

    // Exercise browser. (library_title/library_subtitle/browse_library went with
    // the unreachable `library` view; the browser reuses train/train_subtitle.)
    add_from_library: 'Add from Library',
    add_exercise: 'Add exercise',
    exercise_removed: 'Exercise removed',
    schedule_title: 'Your training days',
    schedule_days_label: 'training days',
    schedule_hint: 'Tap the days you want to train. Rest days stay empty, and the workouts are arranged across your training days in order.',
    training_days: 'Training days',
    rotation_cycle: 'Workout cycle',
    add_workout: 'Add workout',
    slot_editor_sub_new: 'Name it, then pick its exercises in the order you will train',
    rotation_preview: 'Next 7 days',
    min_logged: 'Minimum effort — done',
    min_logged_sub: '{what} · {n} minutes · streak intact',
    rest_logged_sub: 'See you tomorrow — same plan',
    rest_undo: 'Undo',
    anyway_start_named: 'Start — {name}',
    anyway_lagging_sub2: '{m} — not in this week’s plan',
    /* Joining a list of names is language work, not punctuation: the separator
       and the conjunction both change with the script. */
    list_sep: ', ',
    list_and: ' and ',
    rest_min_go: 'Start — {n} minutes',
    train_anyway: 'I could train today',
    anyway_title: 'Feeling up to it today?',
    anyway_body: 'Today is rest by design, and that is the point. But if you have energy to spare, take something light — without borrowing from tomorrow.',
    anyway_cardio: 'Light cardio',
    anyway_cardio_sub: 'A walk or a bike — it does not tax the muscle',
    anyway_lagging: 'A lagging muscle',
    anyway_tomorrow: "Tomorrow's workout, now",
    anyway_tomorrow_sub: 'Moves the plan a full day',
    anyway_keep_rest: 'No, I will finish my rest',
    anyway_moved: 'The plan moved a day forward.',
    anyway_undone: 'Back to a rest day. The plan is where it was.',
    program_moved: 'Today was pulled forward — the cycle moved a day.',
    anyway_no_exercise: 'No exercise in your list trains that muscle yet.',
    last_7_days: 'The last 7 days',
    day_nothing: 'Nothing recorded on this day.',
    day_body: 'Body',
    day_weight: 'Weight',
    day_water: 'Water',
    day_minimum: 'minimum',
    reorder_exercises: 'Reorder exercises',
    ro_done: 'Done',
    move_up: 'Move up',
    move_down: 'Move down',
    // Program tab (the plan & progression center)
    program_title: 'My Program',
    program_subtitle: 'Your cycle, your weekly volume, your records.',
    program_where: 'Where you are',
    program_next: 'Next training days',
    edit_cycle: 'Edit cycle',
    program_adherence: 'Adherence',
    program_new_prs: 'New records',
    last_set: 'Last set', set_label: 'Set',
    common_supplements: 'Common supplements', already_added: 'Already added',
    program_no_plan_title: 'No program yet',
    program_no_plan_sub: 'Pick a ready-made plan or build your own cycle.',
    program_build: 'Build my program',
    workout_label: 'Workout',
    view_all: 'View all',
    prev_month: 'Previous month',
    next_month: 'Next month',
    exercise_order: 'Exercise order',
    edit_workout: 'Edit workout',
    workout_name_ph: 'Workout name (e.g. Push)',
    remove_workout: 'Remove from cycle',
    workouts_label: 'workouts',
    tmpl_desc_ppl: 'Classic push / pull / legs split',
    tmpl_desc_upper_lower: 'Balanced upper / lower split',
    tmpl_desc_full_body: 'Full-body sessions',
    tmpl_desc_bro_split: 'Bodybuilding muscle split',
    preset_badge: 'Ready-made',
    ready_made_section: 'More ready-made plans',
    add_to_train: 'Add to Train',
    added: 'Added',

    // Image upload
    image_optional: 'Image (optional)',
    choose_image: 'Choose Image',
    take_photo: 'Take photo',
    change_image: 'Change',
    remove_image: 'Remove',
    image_hint: 'Pick a photo from your device. Stored locally.',

    // Planner
    planner_title: 'Workout Rotation',
    planner_subtitle: 'Your rolling workout cycle across training days.',
    today_plan: "Today's Plan",
    no_plan_today_sub: 'No exercises scheduled for today.',
    start_workout: 'Start Workout', guided_mode: 'Guided mode',
    today_workout: "Today's workout",
    first_workout_title: 'Ready to train?', first_workout_sub: 'Log your first workout to get started.',
    start_first_workout: 'Start your first workout',
    exercise_word: 'Exercise',
    of_word: 'of',
    last_time: 'Last time',
    first_time_no_record: 'First time — no record yet',
    sync_conflict_toast: 'This device has changes the cloud does not',
    sync_resolve: 'Resolve',
    sync_unsynced: 'Not backed up yet',
    sync_restore_title: 'Restore the copy from before the last sync?',
    sync_restore_text: 'A snapshot of this device was taken automatically just before the last sync replaced it. Restoring puts it back and uploads it.',
    sync_restore: 'Restore',
    sync_restored: 'Restored from the pre-sync copy',
    sync_restore_failed: 'Could not restore',
    conflict_warn_cloud: 'Keeping the cloud copy discards the changes made on this device.',
    ai_photo_title: 'Photo of your food',
    ai_photo_sub: 'Take a picture and I will estimate the calories',
    ai_capture: 'Take a photo',
    ai_capture_sub: 'Opens the camera',
    ai_gallery: 'From gallery',
    ai_gallery_sub: 'Pick an existing photo',
    run_best_weight: 'Best ever',
    sug_label: 'Suggested today',
    sug_up_reason: '2-for-2: you topped the range two sessions in a row — add weight, restart at {t}',
    sug_confirm_reason: 'You topped the range once — confirm it a second session before adding (2-for-2)',
    sug_rep_reason: 'Same weight — aim for one more rep',
    sug_hold_reason: 'Hold this weight until you reach {t} clean reps',
    sug_deload_reason: '{n} sessions under the range at this weight — drop ~10% and rebuild',
    sug_applied: 'Suggestion filled into the next set',
    tab_saved_foods: 'Foods',
    tab_bundles: 'My meals',
    bundle_new: 'New meal',
    bundle_name_ph: 'Meal name — e.g. My usual breakfast',
    bundle_pick_hint: 'Pick from what you logged on this day:',
    bundle_none_today: 'Nothing logged on this day yet — log the items once, then save them here as one meal.',
    bundle_save: 'Save meal',
    bundle_saved: 'Meal saved',
    bundle_deleted: 'Meal deleted',
    bundle_added: '{name} added — {n} items',
    bundle_items: 'items',
    bundle_empty: 'No saved meals yet. Log a day\'s items, then save them as one meal.',
    stats_open_chart: 'Open full progress',
    run_last_weight: 'Last session',
    ai_edit_values: 'Edit values',
    ai_edit_done: 'Done',
    ai_edited: 'Edited',
    resting: 'Rest',
    skip: 'Skip',
    previous: 'Previous',
    next: 'Next',
    finish: 'Finish',
    mark_set_done: 'Mark set done',
    done_col: 'Done',
    workout_summary: 'Workout Summary',
    save_session: 'Save Session',
    total_volume: 'Total Volume',
    back_to_workout: 'Back to workout',
    no_sets_to_save: 'Log at least one set first',
    exit_no_save: 'Exit',
    logged: 'Logged',
    logged_today: 'logged for this day',
    pick_exercises: 'Pick Exercises',
    rest_day: 'Rest',
    rest_today_title: 'Today is off',
    rest_today_on: 'Today is off. The cycle moves with you.',
    rest_today_off: "Today is back on.",
    rest_short: 'Rest',
    minutes_short: 'm',
    rest_is_the_plan: 'Rest is part of the plan — the muscle grows today, not yesterday.',
    // The sheet speaks in the user's voice, never the app's, and never threatens.
    rest_sheet_title_1: "So you can't train today",
    rest_sheet_body_1: "Understood — not every day is the same. Just keep this in mind: <b>don't take two in a row.</b> The first day is rest; the second is where a lapse begins. Today's streak counts anything you log, so anything at all keeps it.",
    rest_sheet_title_2: 'That would be two days in a row',
    rest_sheet_body_2: 'You rested yesterday. Take today too and the lapse starts here — and coming back gets heavier than the workout itself.',
    rest_streak_line: 'Your streak is {n} days — a day with nothing logged ends it',
    rest_do_what_i_can: "I'll do what I can",
    rest_full_rest: 'No, I need a full rest day',
    rest_full_again: 'Rest again — I accept the cost',
    rest_min_title: 'What can you manage today?',
    rest_min_sub: "Pick the smallest thing you can finish. What matters is that the line doesn't break.",
    rest_min_one: 'One exercise',
    rest_min_one_sub: 'The heaviest lift in the plan, 3 sets',
    rest_min_half: 'Half the session',
    rest_min_half_sub: 'The first two exercises and done',
    rest_min_walk: 'A walk, nothing else',
    rest_min_walk_sub: 'Logged as light cardio',
    rest_min_logged: 'Logged. The streak holds.',
    apply_template: 'Apply Template',
    clear_plan: 'Clear Plan',
    clear_plan_q: 'Clear the whole plan?',
    clear_plan_text: 'All scheduled days will be emptied. Your logged workouts stay.',
    plan_cleared: 'Plan cleared',
    day_saved: 'Day saved',
    day_cleared: 'Day cleared',
    set_deleted: 'Set deleted',
    undo: 'Undo',
    empty_day_drop: 'Rest day — tap + or drag an exercise here',
    remove_from_day: 'Remove from day',

    // Templates
    templates_title: 'Templates',
    templates_subtitle: 'Pick a program to pre-fill your weekly plan.',
    template_applied: 'Template applied',
    apply: 'Apply',

    // Days of week (short + full)
    dow_sun: 'Sun', dow_mon: 'Mon', dow_tue: 'Tue', dow_wed: 'Wed', dow_thu: 'Thu', dow_fri: 'Fri', dow_sat: 'Sat',
    dow_sun_full: 'Sunday', dow_mon_full: 'Monday', dow_tue_full: 'Tuesday', dow_wed_full: 'Wednesday',
    dow_thu_full: 'Thursday', dow_fri_full: 'Friday', dow_sat_full: 'Saturday',

    // Calendar
    calendar_title: 'Calendar',
    calendar_subtitle: 'Month view of your training activity.',
    no_activity_day: 'No activity this day',
    workouts_day: 'Workouts', cardio_day: 'Cardio', sleep_day: 'Sleep',

    // Supplements
    supplements_title: 'Supplements', todays_doses: "Today's doses",
    supplements_subtitle: 'Track daily doses and keep your streaks.',
    new_supplement: 'New Supplement',
    edit_supplement: 'Edit Supplement',
    supplement_name: 'Supplement Name',
    dose: 'Dose (optional)',
    color: 'Color',
    no_supplements: 'No supplements yet',
    no_supplements_text: 'Add the supplements you take (e.g. Creatine, Whey).',
    taken: 'Taken',
    not_taken: 'Not yet',
    streak: 'streak',
    delete_supplement_q: 'Delete supplement?',
    delete_supplement_text: 'This supplement and its history will be removed.',

    // Food log
    food_log_title: 'Daily Food', logged_items: 'Items',
    food_history: 'Food log',
    today_totals: 'Today',
    add_food_log: 'Add Food',
    no_food_logged: 'No food logged today',
    no_food_logged_text: 'Tap "Add Food" and pick from your reference list.',
    servings: 'Servings',
    food_added: 'Food logged',
    food_removed: 'Removed',
    take_all: 'Take all',
    all_taken: 'All marked as taken',
    prev_day: 'Previous day', next_day: 'Next day',

    // Variations (in exercise detail)

    // Chart
    progress_chart: 'Progress',
    max_weight_per_session: 'Max weight per session',
    no_chart_data: 'Log 2+ sets to see your progress chart.',

    // Muscle session history (tap a heatmap cell)
    // NOTE: a separate key from `sets` on purpose — the Arabic `sets` is the
    // definite "المجموعات", which reads wrong after a numeral ("3 المجموعات").
    ms_sets_label: 'sets',
    ms_sessions_logged: 'sessions logged',
    ms_empty_title: 'No sessions yet',
    ms_empty_text: 'Log a workout for this muscle group and it will show up here.',

    // Tools cards on home
    tools_section: 'Tools',
    supplements_card: 'Supplements',

    // Unit
    unit_label: 'Weight Unit',
    kg_label: 'Kilograms (kg)',
    lb_label: 'Pounds (lb)',

    // Navigation a11y
    back: 'Back',

    // Personal Records
    pr_card: 'Personal Records',
    compare_card: 'Compare',
    pr_card_sub: 'Your all-time bests',
    pr_view_title: 'Personal Records',
    pr_est_orm: 'Est. 1RM',
    pr_max_weight: 'Max weight',
    pr_empty_title: 'No records yet',
    pr_empty_text: 'Log a session to set your first PR.',
    pr_weight: 'New PR!',
    pr_orm: 'New PR!',
    pr_both: 'New PR!',

    // ---- Notifications (APPLY-notifications.md §4) -------------------------
    // Wording rules from the spec, and they are not decoration: title <= 38
    // chars or the OS truncates it; no exclamation marks, no praise, no threat,
    // no "tap here" (the action lives in the buttons); "not logged", never
    // "you missed" — zero guilt language; and the body carries a NUMBER from
    // the user's own data rather than a motivational sentence.
    // '{name}' is the workout slot's OWN name. The template used to bake the
    // word "Push", which is wrong data on a Legs day, in the one line the user
    // reads at a glance.
    notif_train_title: '{name} — {n} exercises',
    notif_train_body: 'Last time: {ex} {kg} kg × {reps}.',
    // Used when there is no previous set to quote, and when the alarm was armed
    // days ahead and "last time" would be stale by the hour it fires. A branch
    // picks a different key; it never passes a template with an empty hole.
    notif_train_body_first: 'Your first logged session starts here.',
    notif_train_body_plan: '{n} exercises in this session.',
    notif_supps_title: '{name}',
    notif_supps_body: 'Dose {i} of {n} today.',
    notif_water_title: '{cur} of {goal} ml',
    // NOT "{hours} hours left in your day" — that sentence talked about time
    // running out and was scheduled for the MORNING. Millilitres left is true
    // at any hour, and it is what the reminder is actually asking for.
    notif_water_body: '{left} ml to go — about {cups} cups.',
    notif_water_body_done: 'Goal reached for today.',
    notif_water_title_plan: 'Water — {goal} ml today',
    notif_water_body_plan: 'About {cups} cups across your day.',
    notif_food_title: '{meal} — {kcal} kcal left',
    notif_food_body: '{p} g protein still to go.',
    notif_food_body_nop: 'Protein target already met.',
    notif_food_title_plan: '{meal} — {kcal} kcal',
    notif_food_body_plan: '{p} g protein is the day’s target.',
    notif_streak_title: '{n}-day streak at risk',
    notif_streak_body: 'Any logged activity before midnight counts.',
    notif_summary_title: '{n} reminders today',
    notif_perm_title: 'Reminders, on your terms',
    notif_perm_body: 'Five reminders, all inside your day window, each one switchable on its own.',
    notif_perm_cta: 'Turn on reminders',
    // ---- Notifications settings + permission sheet (§7, §8) ---------------
    notif_settings_title: 'Notifications',
    notif_settings_of: '{n} of 5',
    notif_window_title: 'Your day window',
    notif_window_hint: 'Everything is scheduled inside this. Outside it, supplements and meals wait for the start and water is skipped — there is no separate quiet-hours setting because these hours are it.',
    notif_ch_train: 'Training',
    notif_ch_supps: 'Supplements',
    notif_ch_water: 'Water',
    notif_ch_food: 'Meals',
    notif_ch_streak: 'Streak',
    notif_sum_train_auto: 'Half an hour before your usual time',
    notif_sum_train_fixed: 'Every training day at {at}',
    notif_sum_supps: '{n} doses',
    notif_sum_supps_none: 'No doses yet',
    notif_sum_water: 'About every {n} h, spread across your window',
    notif_sum_food: '{n} meal times',
    notif_sum_food_none: 'No meal times yet',
    notif_sum_food_notarget: 'Silent until you set a calorie target',
    notif_sum_streak: 'Only when a streak of 7+ is at risk',
    notif_sum_off: 'Off',
    notif_train_mode_fixed: 'A fixed time',
    notif_train_mode_auto: 'Half an hour before my usual time',
    notif_supps_add: 'Add a dose',
    notif_supps_name: 'Name',
    notif_supps_time: 'Time',
    notif_supps_link: 'Supplement',
    notif_supps_link_none: 'Not linked',
    notif_supps_link_hint: 'Linked doses go quiet once you tick that supplement off.',
    notif_food_add: 'Add a meal time',
    notif_food_name: 'Meal',
    // ---- The activity sections (the page the owner asked for) --------------
    notif_today: 'Today',
    notif_arrived: 'Arrived',
    notif_upcoming: 'Coming up',
    notif_up_hint: 'Wording updates with your numbers.',
    notif_up_empty: 'Nothing else scheduled today.',
    notif_history: 'Earlier',
    notif_show_more: 'Show all',
    notif_log_empty_title: 'Nothing yet',
    notif_log_empty_text: 'Reminders you receive appear here, with the exact words they carried.',
    notif_clear_log: 'Clear history',
    notif_clear_log_sub: 'Removes the record on this device only.',
    notif_cleared: 'History cleared',
    notif_yesterday: 'Yesterday',
    notif_unseen: '{n} new',
    notif_dropped: '{n} held back — over your daily limit',
    // ---- The daily limit, now a setting rather than a silent guard ---------
    notif_cap_title: 'Daily limit',
    notif_cap_hint: 'Once this many have arrived, the rest of the day stays quiet. Water yields first, then meals.',
    notif_cap_auto: 'Auto',
    notif_cap_auto_sub: 'Three a day at first, six once you have two weeks of history',
    notif_cap_none: 'No limit',
    notif_arm_days: 'Armed for the next {n} days',
    notif_arm_hint: 'Open the app at least once a week to keep them armed.',
    // The rotation's two per-date lists, finally visible on the calendar and the
    // 7-day rail. "Moved in" / "Rest taken", not "extra" / "skipped" — the words
    // describe what the user DID, and neither carries a verdict.
    day_moved_in: 'Moved in',
    day_rest_taken: 'Rest taken',
    pg_volume_30d: 'Volume · 30 days',
    pg_sessions_30d: 'Sessions · 30 days',
    pg_days_unit: 'days',
    notif_every_hours: 'Every {n} hours',
    notif_sys_hint: 'Sound and vibration are the system’s, not the app’s.',
    notif_sys_open: 'Open system notification settings',
    notif_denied: 'Blocked by the system',
    notif_denied_sub: 'Turn notifications back on for VAULT in Android settings, then come back here.',
    notif_perm_l1: 'Only inside the hours you set.',
    notif_perm_l2: 'A daily limit you set yourself, low by default.',
    notif_perm_l3: 'Every channel switches off on its own.',
    notif_perm_l4: 'Logging something cancels its reminder.',
    notif_perm_later: 'Not now',
  },

  ar: {
    app_name: 'فولت',
    nav_home: 'الرئيسية', nav_train: 'برنامجي', nav_cardio: 'كارديو', nav_food: 'الأكل', nav_sleep: 'النوم',

    greet_morning: 'صباح الخير', greet_afternoon: 'نهارك سعيد', greet_evening: 'مساء الخير',

    cat_Chest: 'صدر', cat_Back: 'ظهر', cat_Legs: 'أرجل',
    cat_Shoulders: 'أكتاف', cat_Arms: 'ذراع', cat_Core: 'بطن', cat_Other: 'أخرى',
    cat_All: 'الكل',

    // Muscle groups (for the planner)
    anterior: 'أمامي', posterior: 'خلفي',
    muscle_chest: 'الصدر', muscle_upper_chest: 'الصدر العلوي',
    muscle_front_delts: 'الكتف الأمامي', muscle_side_delts: 'الكتف الجانبي', muscle_rear_delts: 'الكتف الخلفي',
    muscle_biceps: 'البايسبس', muscle_triceps: 'الترايسبس', muscle_forearms: 'الساعد',
    muscle_abs: 'البطن',
    muscle_upper_back: 'أعلى الظهر', muscle_lats: 'العضلة الجانبية', muscle_traps: 'الترابيس',
    muscle_lower_back: 'أسفل الظهر',
    muscle_quads: 'الكوادريسبس', muscle_hamstrings: 'الهامسترنغ', muscle_glutes: 'المؤخرة', muscle_calves: 'السمانة',
    muscle_adductors: 'المقربات',
    rest_day_muscles: 'لا يوجد عضلات مجدولة',

    streak_one_day: 'يوم',
    streak_days: 'يوم',
    streak_active: 'سلسلة نشطة — واصل!',
    streak_start: 'سجّل جلسة لبدء سلسلتك',
    workouts: 'التمارين', volume: 'الحجم', cardio: 'الكارديو', last_sleep: 'آخر نوم', sleep_today: 'نوم اليوم',
    sessions_label: 'الجلسات',
    sessions_this_week: 'مجموعة هذا الأسبوع',
    this_week: 'هذا الأسبوع',
    muscle_focus: 'تركيز العضلات',
    muscle_focus_sub: 'جلسات لكل عضلة · آخر 7 أيام',

    train: 'التمارين', cardio_title: 'الكارديو', food: 'الأكل', sleep: 'النوم', compare: 'المقارنة', settings: 'الإعدادات',
    library: 'المكتبة',
    train_subtitle: 'اضغط على تمرين لتسجيل جلسة جديدة أو مشاهدة السجل.',
    search_exercises: 'ابحث عن تمرين…',
    new_exercise: 'تمرين جديد',
    new_exercise_sub: 'أضف تمريناً مخصصاً لمكتبتك.',
    add_custom: 'أضف تمرينك الخاص',
    my_exercises_short: 'تماريني', my_exercises_sub: 'التمارين التي أنشأتها.',
    ce_empty_title: 'لا توجد تمارين خاصة بعد', ce_empty_text: 'اضغط "أضف تمرينك الخاص" لإنشاء تمرين باسم وتصنيف وصورة.',
    no_matches: 'لا توجد نتائج',
    no_matches_hint: 'جرّب كلمة بحث أخرى.',
    no_sessions_yet: 'لا توجد مجموعات بعد',
    custom: 'مخصص',
    custom_exercise_label: 'تمرين مخصص',

    log_session: 'سجّل جلسة',
    edit_session: 'تعديل الجلسة',
    log_session_tap: 'اضغط "سجّل جلسة" لتسجيل أول مجموعة.',
    max_weight: 'أقصى وزن', max_reps: 'أقصى تكرار', sessions_n: 'المجموعات',
    exercise: 'تمرين', exercises: 'تمارين',
    history: 'السجل',
    show_more: 'عرض المزيد',
    no_sessions: 'لا توجد مجموعات',
    total_sets: 'مجموع المجموعات',
    pr: 'رقم قياسي',
    volume_label: 'الحجم',
    set_n: 'مجموعة',
    reps: 'تكرار', weight_kg: 'كجم',
    last_session: 'آخر جلسة',
    date: 'التاريخ',
    sets: 'المجموعات',
    add_set: 'أضف مجموعة',
    set_min_one: 'مطلوب مجموعة واحدة على الأقل',
    add_at_least_one: 'أضف مجموعة على الأقل',
    session_saved: 'تم حفظ الجلسة',
    session_updated: 'تم تحديث الجلسة',
    session_deleted: 'تم حذف الجلسة',
    delete_session_q: 'حذف الجلسة؟',
    delete_session_text: 'ستُحذف هذه الجلسة نهائياً من سجلك.',
    delete_exercise_q: 'حذف التمرين؟',
    delete_exercise_text: 'سيُحذف هذا التمرين وكل سجل جلساته.',
    exercise_deleted: 'تم حذف التمرين',
    exercise_added: 'تمت إضافة التمرين',
    enter_name: 'أدخل اسماً',
    name: 'الاسم', category: 'الفئة',
    save: 'حفظ', cancel: 'إلغاء', update: 'تحديث', delete: 'حذف', edit: 'تعديل', select: 'اختيار',
    unit: 'الوحدة', done: 'تم',
    // التنبيهات
    remind_title: 'التنبيهات',
    remind_sub: 'تنبيهات المكمّلات والماء.',
    remind_off: 'متوقّفة',
    remind_from: 'من', remind_to: 'إلى',
    remind_none: 'لا توجد تنبيهات',
    remind_times: 'أوقات التذكير', remind_add_time: 'أضف وقتاً',
    remind_denied: 'لم يُسمح بالتنبيهات.',
    remind_blocked: 'التنبيهات محجوبة — فعّلها من إعدادات هاتفك.',
    remind_water_body: 'حان وقت كوب ماء.',
    open: 'فتح',
    remind_sound_off: 'صامت — في لوحة الإشعارات فقط',
    remind_test: 'أرسل تنبيهاً تجريبياً', remind_test_sub: 'يصل خلال خمس ثوانٍ تقريباً',
    remind_test_title: 'VAULT', remind_test_body: 'تنبيه تجريبي — التنبيهات تعمل.',
    remind_test_sent: 'أُرسل التنبيه — راقب شريط الإشعارات.',
    remind_test_failed: 'تعذّر الإرسال',
    remind_channel_alert: 'التنبيهات', remind_channel_quiet: 'التنبيهات (صامتة)',
    remind_channel_desc: 'تنبيهات المكمّلات والماء',
    remind_stat_perm_ok: 'الإذن ممنوح', remind_stat_perm_no: 'الإذن غير ممنوح',
    remind_stat_mismatch: 'أندرويد يحتفظ بـ{a} من {b} جدولناها',
    remind_stat_off: 'التنبيهات موقوفة لتطبيق VAULT في إعدادات أندرويد.',
    remind_stat_queued: 'مجدولة لدى أندرويد',
    remind_exact_title: 'التوقيت الدقيق متوقّف',
    remind_exact_sub: 'قد يؤخّر أندرويد التنبيهات. اضغط للسماح بالمنبّهات الدقيقة.',
    remind_exact_ok: 'التوقيت الدقيق مسموح',
    remind_battery_title: 'ما زال لا يصلك شيء؟',
    remind_battery_sub: 'قد يحجز توفير البطارية التنبيهات. الإعدادات ← التطبيقات ← VAULT ← البطارية ← بلا قيود. وفي أجهزة سامسونج أيضاً: الإعدادات ← البطارية ← حدود الاستخدام في الخلفية ← أزل VAULT من التطبيقات النائمة.',
    not_found: 'غير موجود', not_found_text: 'هذا التمرين لم يعد موجوداً.',

    cardio_subtitle: 'جلسات السير، المشي، والدراجة.',
    no_cardio: 'لا يوجد كارديو بعد',
    no_cardio_text: 'سجّل أول جلسة سير أو مشي أو دراجة بالزر فوق.',
    close: 'إغلاق',
    all_sessions: 'كل الجلسات',
    log: 'سجّل',
    log_cardio: 'سجّل كارديو', edit_cardio: 'تعديل الكارديو',
    cardio_quick: 'تسجيل سريع: النوع، المدة، السعرات.',
    type: 'النوع',
    duration_min: 'المدة (دقيقة)',
    calories: 'السعرات',
    sessions_w: 'الجلسات', minutes: 'الدقائق',
    unit_hr: 'س', unit_min: 'د',
    enter_duration: 'أدخل المدة',
    delete_cardio_q: 'حذف جلسة الكارديو؟',
    delete_cardio_text: 'ستُحذف هذه الجلسة من سجلك.',
    saved: 'تم الحفظ', updated: 'تم التحديث', deleted: 'تم الحذف',
    treadmill: 'سير', walking: 'مشي', running: 'جري', cycling: 'دراجة',
    new_cardio_type: 'نوع كارديو جديد',
    new_cardio_type_sub: 'أضف نشاط كارديو خاص فيك.',
    cardio_type_name_ph: 'مثلاً: درج، تجديف',
    icon: 'الأيقونة',
    enter_name: 'أدخل اسماً',

    // لوحة التغذية
    nutri_setup_title: 'حدّد هدفك اليومي',
    nutri_setup_text: 'احسب سعراتك وماكروزك لتبدأ المتابعة.',
    nutri_left: 'متبقّي',
    nutri_setup_cta: 'حدّده الآن',
    nutri_over: 'زيادة',
    nutri_calories: 'السعرات',
    coach_title: 'المدرّب الذكي',
    coach_sub: 'ماذا تأكل لتكمّل المتبقّي من ماكروزك',
    coach_thinking: 'أفكّر…',
    coach_unavailable: 'المدرّب غير متاح حالياً.',
    coach_goal_met: 'أكملت هدفك لهذا اليوم 🎉',
    add_sheet_title: 'إضافة أكل',
    add_voice: 'صوت', add_voice_sub: 'قُل ما أكلته',
    add_chat: 'محادثة', add_chat_sub: 'اكتبه — والذكاء يحسب السعرات',
    add_photo: 'صورة', add_photo_sub: 'صوّر وجبتك',
    add_barcode: 'باركود', bc_amount: 'الكمية', unit_g: 'غ',
    water: 'الماء', unit_ml: 'مل', water_undo: 'إزالة كوب',
    bodyweight: 'الوزن', weight_add_first: 'سجّل وزنك', weight_trend: 'منحنى الوزن',
    weight_need_more: 'سجّل يومين على الأقل لرؤية المنحنى', weight_placeholder: 'وزن اليوم',
    weight_empty_hint: 'سجّل وزنك بانتظام لمتابعة تقدّمك',
    portion_less: 'كمية أقل', portion_more: 'كمية أكثر',
    onb_welcome_title: 'مرحباً بك في VAULT', onb_welcome_sub: 'تمارينك وتغذيتك في مكان واحد.',
    onb_feat_workouts: 'خطّط وسجّل كل تمرين', onb_feat_ai: 'سعرات بالذكاء الاصطناعي — صورة أو صوت أو باركود',
    onb_feat_progress: 'تابع الوزن والإنجاز والتقدّم', onb_start: 'لنبدأ',
    onb_unit_title: 'اختر وحدة القياس', onb_unit_sub: 'يمكنك تغييرها لاحقاً من الإعدادات.',
    // The system, not the unit — the unit name is already the bold label above it.
    onb_unit_metric: 'النظام المتري', onb_unit_imperial: 'النظام الإمبراطوري',
    unit_kg_name: 'كيلوغرام', unit_lb_name: 'رطل',
    onb_goal_title: 'حدّد هدف السعرات', onb_goal_sub: 'حاسبة سريعة تبني أهدافك اليومية. يمكنك التخطّي وضبطها لاحقاً.',
    // 'التخطّي الآن' was the definite masdar — it reads as a heading, not an
    // action. A quiet 'لاحقاً' is the formal, idiomatic label for this button.
    onb_set_goal: 'تحديد هدفي', onb_skip: 'لاحقاً',
    barcode_hint: 'وجّه الكاميرا نحو الباركود',
    barcode_looking: 'أبحث عنه…',
    barcode_not_found: 'غير موجود — جرّب الصورة أو اليدوي.',
    barcode_loading: 'جارٍ تشغيل الماسح…',
    barcode_manual_hint: 'اكتب رقم الباركود في الأسفل',
    barcode_number_ph: 'رقم الباركود',
    barcode_lookup: 'بحث',
    barcode_invalid: 'أدخل رقم باركود صحيح',
    barcode_cam_denied_manual: 'الكاميرا محجوبة — اكتب رقم الباركود بدلاً من ذلك.',
    add_saved: 'أكل محفوظ', add_saved_sub: 'اختر من أطعمتك',
    add_manual: 'يدوي', add_manual_sub: 'أدخل الأرقام بنفسك',
    saved_new: 'أضف طعاماً محفوظاً جديداً', saved_empty: 'لا يوجد أكل محفوظ بعد',
    calc_title: 'حاسبة السعرات', calc_sub: 'معادلة Mifflin-St Jeor — المعيار الأدق',
    calc_mode_manual: 'إدخال يدوي',
    calc_use_manual: 'أو أدخِل الأرقام يدوياً', calc_use_calc: 'استخدِم الحاسبة بدلاً من ذلك',
    calc_sex: 'الجنس', calc_male: 'ذكر', calc_female: 'أنثى',
    calc_age: 'العمر', calc_height: 'الطول (سم)', calc_weight: 'الوزن (كغ)',
    calc_activity: 'النشاط', calc_goal: 'الهدف',
    activity_sedentary: 'خامل', activity_light: 'خفيف', activity_moderate: 'متوسط', activity_active: 'نشِط', activity_very_active: 'نشِط جداً',
    goal_cut: 'تنشيف', goal_maintain: 'ثبات', goal_bulk: 'تضخيم',
    calc_tdee: 'الثبات', calc_bmr: 'الأيض الأساسي', calc_fill_hint: 'أدخل العمر والطول والوزن.',
    manual_food_title: 'إضافة أكل', manual_food_ph: 'مثال: دجاج ورز',
    voice_tap: 'اضغط لتتكلّم', voice_listening: 'أستمع… اضغط للإيقاف',
    voice_processing: 'أفهم كلامك…', voice_denied: 'الميكروفون محجوب. اسمح به عند طلب النظام ثم اضغط مجدداً.',
    voice_denied_web: 'الميكروفون محجوب لهذا الموقع. فعّله من إعدادات المتصفح ثم اضغط مجدداً.',
    voice_no_mic: 'لا يوجد ميكروفون.',
    voice_unsupported: 'الصوت يحتاج آخر نسخة من التطبيق.',
    no_matches_simple: 'لا نتائج',
    no_matches_text: 'جرّب بحث مختلف.',
    search_foods: 'ابحث عن أكل…',
    add: 'أضف',
    food_library_title: 'أضف من المكتبة',
    food_library_sub: 'اضغط على أي طعام لإضافته إلى قائمتك.',
    add_manually: 'إضافة يدوية',
    fcat_protein: 'بروتين',
    fcat_carbs: 'نشويات',
    fcat_legumes: 'بقوليات',
    fcat_dairy: 'ألبان',
    fcat_fruit: 'فواكه',
    fcat_veg: 'خضار',
    fcat_fats: 'مكسرات ودهون',
    fcat_meals: 'وجبات',
    fcat_drinks: 'مشروبات',
    fcat_more: 'المزيد',
    new_food: 'أكل جديد', edit_food: 'تعديل الأكل',
    food_quick: 'المعدلات الغذائية لكل حصة.',
    serving_hint: 'مثلاً 100جم، كوب',
    amount_label: 'الكمية', serving_unit_label: 'الوحدة', unit_hint: 'غ، مل، حبة',
    ph_exercise_name: 'مثال: سكوات بلغاري', ph_food_name: 'مثال: صدر دجاج', ph_supplement_name: 'مثال: كرياتين',
    view_photo: 'عرض الصورة',
    protein_g: 'بروتين (جم)', carbs_g: 'كارب (جم)',
    cal: 'سعرة', protein_label: 'بروتين', carbs_label: 'كارب', fat_label: 'دهون',
    ai_chat_title: 'شات السعرات', ai_chat_sub: 'أخبرني بما تناولت — وأنا أسجّل السعرات',
    img_error: 'خطأ في الصورة',
    ai_pasted_meal: 'وجبة',
    ai_used_your_numbers: 'استُخدمت أرقامك كما هي — لم يُقدَّر شيء.',
    ai_untracked: '{fields} لا يتتبّعها التطبيق، فلم تُحفظ.',
    ai_nut_cholesterol: 'الكوليسترول', ai_nut_sodium: 'الصوديوم',
    ai_chat_placeholder: 'مثلاً: الفطور بيض وخبز، والغدا برجر',
    ai_add_all: 'أضف الكل',
    ai_analyzing: 'جارٍ الحساب…',
    ai_photo: 'صورة',
    ai_no_result: 'لا توجد نتيجة — جرّب صياغة أخرى.',
    ai_add_to_log: 'أضف للسجل',
    ai_added: 'تمت الإضافة',
    ai_error: 'صار خطأ',
    ai_rate_limit: 'خدمة الذكاء المجانية مشغولة حالياً — جرّب بعد دقيقة.',
    ai_not_food: 'هذا الشات للطعام فقط — اكتب وجبة لأحسبها.',

    // المصادقة / المزامنة السحابية
    auth_sub_in: 'سجّل دخولك لمزامنة بياناتك',
    auth_sub_up: 'أنشئ حساباً لمزامنة بياناتك بين الأجهزة',
    auth_email: 'البريد الإلكتروني',
    auth_password: 'كلمة السر',
    auth_signin: 'تسجيل الدخول',
    auth_signup: 'إنشاء حساب',
    // Were 'ما عندك حساب؟' / 'عندك حساب؟' — dialect. Formal MSA:
    auth_no_account: 'ليس لديك حساب؟',
    auth_have_account: 'لديك حساب بالفعل؟',
    auth_offline_grace: 'أنت دون اتصال — حسابك مسجَّل على هذا الجهاز، فبياناتك متاحة. تستأنف المزامنة عند عودة الاتصال.',
    username_title: 'اختر اسم المستخدم',
    username_sub: 'اسم فريد يُعرّفك أمام الآخرين. إلزامي للمتابعة.',
    username_ph: 'اسم_المستخدم',
    username_rules: '٣–٢٠ حرفًا · حروف إنجليزية وأرقام و _ فقط',
    username_save: 'حفظ الاسم',
    username_checking: 'جارٍ التحقّق…',
    username_available_msg: 'متاح ✓',
    username_taken: 'هذا الاسم محجوز',
    username_invalid: 'استخدم ٣–٢٠ من الحروف الإنجليزية والأرقام و _',
    username_saved: 'تم حفظ اسم المستخدم',
    update_title: 'يتوفّر إصدار جديد',
    update_get: 'تحميل',
    update_later: 'لاحقاً',
    web_update_title: 'يتوفّر إصدار جديد',
    web_update_action: 'تحديث',
    feedback_title: 'إرسال ملاحظة',
    feedback_sub: 'اقتراحات أو مشاكل — نقرأ كل رسالة',
    feedback_ph: 'اقتراحك أو ملاحظتك…',
    feedback_send: 'إرسال',
    feedback_sent: 'شكرًا! تم إرسال ملاحظتك',
    feedback_empty: 'اكتب شيئًا أولًا',
    account_blocked_title: 'الحساب غير متاح',
    account_disabled_msg: 'تم تعطيل حسابك. يرجى التواصل مع الدعم.',
    account_banned_msg: 'تم إيقاف حسابك.',
    auth_forgot: 'نسيت كلمة السر؟',
    auth_reset_title: 'استعادة كلمة السر',
    auth_reset_sub: 'أدخل بريدك ونرسل لك رابطاً لتعيين كلمة سر جديدة.',
    auth_reset_send: 'إرسال رابط الاستعادة',
    auth_reset_sent: 'تفقّد بريدك — أرسلنا لك رابط الاستعادة',
    auth_signing: 'لحظة…',
    auth_checking: 'جارٍ التحقق…',
    auth_err_fields: 'أدخل البريد وكلمة السر',
    auth_pw_short: 'كلمة السر 6 أحرف على الأقل',
    auth_signup_check_email: 'تم إنشاء الحساب — أكّد عبر الإيميل المُرسَل ثم سجّل دخول.',
    auth_err_invalid: 'البريد أو كلمة السر غير صحيحة',
    auth_err_exists: 'هذا البريد له حساب — سجّل دخول بدلاً من الإنشاء',
    auth_err_email: 'أدخل بريداً صحيحاً',
    auth_err_network: 'مشكلة اتصال — تأكد من الإنترنت',
    auth_err_generic: 'تعذّر تسجيل الدخول. حاول مرة أخرى.',
    auth_not_signed: 'غير مسجّل دخول',
    auth_signin_sub: 'سجّل دخول لمزامنة بياناتك بين الأجهزة',
    account: 'الحساب',
    account_synced_sub: 'بياناتك تتزامن تلقائياً',
    sync_now: 'زامِن الآن',
    sync_now_sub: 'اسحب آخر التغييرات وارفع تعديلاتك',
    synced: 'تمت المزامنة',
    syncing: 'جارٍ مزامنة بياناتك…',
    cloud_backup_kept: 'نسختك الاحتياطية في السحابة محفوظة — لم تُزامَن البيانات الفارغة.',
    logout: 'تسجيل الخروج',
    logout_sub: 'خروج ومسح هذا الجهاز',
    logout_confirm: 'سيتم تسجيل خروجك ومسح هذا الجهاز. بياناتك محفوظة في حسابك — سجّل الدخول مجدداً لاستعادتها.',
    delete_account: 'حذف الحساب',
    delete_account_sub: 'محو حسابك وكل بياناتك نهائياً',
    delete_account_confirm: 'سيُحذف حسابك وكل بياناتك نهائياً — التمارين والتغذية والصحة والصور — من كل الأجهزة والسحابة. لا يمكن التراجع.',
    deleting_account: 'جارٍ حذف حسابك…',
    mf_quick_label: 'اكتبها في سطر واحد',
    mf_quick_ph: 'مثال: فول 1000 سعرة و55 جم بروتين',
    mf_quick_hint: 'اكتب الأرقام وتُملأ الحقول بالأسفل تلقائياً.',
    mf_quick_ok: 'قُرئت أرقامك كما هي دون أي تقدير.',
    mf_quick_none: 'لم يُعثر على سعرات بعد — أكمل الكتابة أو املأ الحقول بالأسفل.',
    mf_keep_label: 'احفظها في أطعمتي للمرّات القادمة',
    mf_added_and_kept: 'أُضيفت وحُفظت في أطعمتك',
    ai_photo_note_ph: 'اشرح الصورة (اختياري)',
    ai_photo_analyze: 'حلّل',
    ai_photo_note_hint: 'ما مكوّناتها، وكيف طُهيت، والزيت المستخدم — أو السعرات الدقيقة إن كنت تعرفها.',
    delete_images_inspect_error: 'تعذّر فحص صورك المخزّنة — لم يُحذف أي شيء. حاول مجدداً.',
    delete_images_cleanup_error: 'حُذف حسابك، لكن تعذّر حذف الصور المخزّنة. حاول مجدداً.',
    privacy_policy: 'سياسة الخصوصية والشروط',
    privacy_policy_sub: 'كيف تُستخدم بياناتك',
    about_title: 'حول التطبيق',
    change_password: 'تغيير كلمة السر',
    change_password_sub: 'عيّن كلمة سر جديدة لهذا الحساب',
    change_password_current: 'كلمة السر الحالية',
    change_password_current_req: 'أدخل كلمة السر الحالية',
    change_password_wrong_current: 'كلمة السر الحالية غير صحيحة',
    change_password_new: 'كلمة السر الجديدة',
    change_password_confirm: 'تأكيد كلمة السر الجديدة',
    change_password_mismatch: 'كلمتا السر غير متطابقتين',
    change_password_done: 'تم تغيير كلمة السر',
    conflict_title: 'يوجد بيانات في حسابك',
    conflict_text: 'حسابك فيه بيانات محفوظة مسبقاً. أي نسخة تريد أن تبقي؟',
    conflict_cloud: 'إبقاء بيانات الحساب (السحابة)',
    conflict_local: 'إبقاء بيانات هذا الجهاز',

    sleep_subtitle: 'تتبّع متى تنام ومتى تصحى.',
    no_sleep_logged: 'لا يوجد نوم مسجّل',
    sleep_stages: 'مراحل النوم', sleep_deep: 'عميق', sleep_light: 'خفيف', sleep_rem: 'حركة العين (REM)', sleep_awake: 'استيقاظ',
    sleep_efficiency: 'كفاءة النوم',
    sleep_q_excellent: 'ممتاز', sleep_q_good: 'جيد', sleep_q_fair: 'متوسط',
    no_sleep_text: 'اضغط "سجّل" لتسجيل أول ليلة نوم.',
    nights_logged: 'مسجلة',
    last_night: 'آخر ليلة', avg_7d: 'متوسط 7 أيام',
    log_sleep: 'سجّل النوم', edit_sleep: 'تعديل النوم',
    sleep_quick: 'التاريخ هو الصباح الذي صحيت فيه.',
    sleep_time: 'وقت النوم', wake_time: 'وقت الصحيان',
    total_sleep: 'مدة النوم',
    fill_all_fields: 'يرجى ملء جميع الحقول',
    delete_sleep_q: 'حذف إدخال النوم؟',
    delete_sleep_text: 'سيُحذف هذا الإدخال من سجلك.',

    compare_title: 'المقارنة',
    weekly: 'أسبوعي',
    compare_subtitle: 'هذا الأسبوع مقارنة بالأسبوع الماضي.',
    this_week_label: 'هذا الأسبوع', last_week_label: 'الأسبوع الماضي',
    not_enough_data: 'لا توجد بيانات كافية',
    not_enough_data_text: 'سجّل جلسات عبر أسبوعين لمشاهدة تقدمك هنا.',
    not_enough_cardio: 'سجّل كارديو عبر أسبوعين لمشاهدة تقدمك.',
    not_enough_sleep: 'سجّل نوم عبر أسبوعين لمشاهدة التقدم.',
    same_as_last_week: 'نفس الأسبوع الماضي',
    no_data_short: 'لا بيانات',
    need_both_weeks: 'تحتاج بيانات من الأسبوعين',
    total_minutes: 'مجموع الدقائق', calories_burned: 'السعرات المحروقة',
    avg_sleep: 'متوسط النوم', nights_logged_t: 'الليالي المسجلة',

    settings_title: 'الإعدادات',
    settings_subtitle: 'خصّص اللغة والمظهر وأدر بياناتك.',
    language: 'اللغة',
    translate_ex_title: 'أسماء التمارين', translate_ex_sub: 'اعرض أسماء التمارين الجاهزة معرّبة، أو أبقِها بالإنجليزية.',
    translate_ex_on: 'عربي', translate_ex_off: 'إنجليزي',
    theme: 'المظهر',
    data: 'البيانات',
    theme_dark: 'داكن', theme_light: 'فاتح',
    export_data: 'تصدير البيانات', export_data_sub: 'تنزيل نسخة JSON احتياطية',
    storage_error_title: 'تعذّر حفظ بياناتك',
    storage_full_text: 'نفدت مساحة التخزين في هذا الجهاز، لذلك لا يتم حفظ الإدخالات الجديدة. صدّر نسخة احتياطية الآن، ثم فرّغ بعض المساحة (حذف صور التمارين المخصّصة هو الأجدى — فهي محفوظة أصلاً في حسابك).',
    storage_write_failed_text: 'فشلت الكتابة على هذا الجهاز، لذلك لا يتم حفظ الإدخالات الجديدة. صدّر نسخة احتياطية الآن للأمان.',
    storage_unreadable_text: 'تعذّرت قراءة البيانات المخزّنة على هذا الجهاز، لذلك يعمل التطبيق بوضع القراءة فقط لحمايتها. لم يُحذف أي شيء. سجّل الدخول لاستعادة بياناتك من حسابك، أو تواصل مع الدعم قبل إجراء أي تعديل.',
    import_data: 'استيراد البيانات', import_data_sub: 'استرجاع من نسخة JSON',
    health_section: 'هيلث كونيكت',
    health_connect: 'مزامنة من Health Connect',
    health_connect_sub: 'الخطوات والنبض والأكسجين والنوم من ساعتك',
    health_only_android: 'متاح فقط في تطبيق أندرويد',
    health_unavailable: 'Health Connect غير مثبّت على هذا الجهاز',
    health_no_permission: 'لم يتم منح الإذن',
    health_syncing: 'جارٍ المزامنة…',
    health_synced: 'تمت المزامنة من Health Connect',
    from_watch: 'الساعة',
    health_hr: 'النبض', health_oxygen: 'الأكسجين', health_sleep: 'النوم',
    health_no_data: 'لا توجد بيانات في هذه الفترة',
    health_connect_btn: 'ربط', health_open_settings: 'فتح Health Connect',
    health_today: 'اليوم', health_bpm: 'نبضة/د', health_min: 'دقيقة',
    health_calories: 'السعرات', health_distance: 'المسافة', health_vo2: 'VO₂ max',
    health_exercise: 'التمارين', health_power: 'الطاقة', health_speed: 'السرعة',
    health_kcal: 'سعرة', health_km: 'كم', health_kmh: 'كم/س', health_watt: 'واط', health_vo2_unit: 'مل/كغ',
    health_home: 'صحّتي', health_toggle_hint: 'اضغط على المربّع لإظهاره أو إخفائه من الشاشة الرئيسية.',
    health_all_hidden: 'الكل مخفي — اضغط لاختيار المربّعات',
    reset_data: 'إعادة تعيين الكل', reset_data_sub: 'حذف كل شي والبدء من جديد',
    reset_q: 'إعادة تعيين كل البيانات؟',
    reset_text: 'سيُحذف كل شي نهائياً: التمارين، الجلسات، الكارديو، الأكل، النوم، والإعدادات.',
    reset_confirm: 'تعيين',
    imported: 'تم الاستيراد',
    import_failed: 'فشل الاستيراد: الملف غير صالح',

    today: 'اليوم', yesterday: 'أمس',
    days_ago: 'أيام',
    weeks_ago: 'أسابيع',
    months_ago: 'أشهر',

    add_from_library: 'إضافة من المكتبة',
    add_exercise: 'أضف تمرين',
    exercise_removed: 'تمت إزالة التمرين',
    schedule_title: 'أيام تمرينك',
    schedule_days_label: 'أيام تمرين',
    schedule_hint: 'اختر الأيام التي تريد التمرّن فيها؛ تبقى أيام الراحة فارغة، وتُوزَّع التمارين على أيام تمرينك بالترتيب.',
    training_days: 'أيام التمرين',
    rotation_cycle: 'دورة التمارين',
    add_workout: 'إضافة تمرين',
    slot_editor_sub_new: 'سمِّه ثم اختر تمارينه بالترتيب الذي ستؤدّيه',
    rotation_preview: 'الأيام السبعة القادمة',
    min_logged: 'أقل مجهود — تم',
    min_logged_sub: '{what} · {n} دقائق · السلسلة سليمة',
    rest_logged_sub: 'نشوفك بكرة — بالخطة نفسها',
    rest_undo: 'تراجع',
    anyway_start_named: 'ابدأ — {name}',
    anyway_lagging_sub2: '{m} — ما دخلت خطة الأسبوع',
    /* The waw prefixes its word with no space after it, unlike "and" — so the
       conjunction carries its own spacing rather than the call site adding it. */
    list_sep: '، ',
    list_and: ' و',
    rest_min_go: 'ابدأ — {n} دقائق',
    train_anyway: 'ممكن أتمرّن اليوم',
    anyway_title: 'حاس إنك قادر اليوم؟',
    anyway_body: 'اليوم راحة بالخطة وهذا مقصود. بس لو عندك طاقة زيادة، خذ شي خفيف — بدون ما تسحب من تمرين بكرة.',
    anyway_cardio: 'كارديو خفيف',
    anyway_cardio_sub: 'مشي أو دراجة — ما يتعب العضلة',
    anyway_lagging: 'عضلة متأخّرة',
    anyway_tomorrow: 'تمرين بكرة من الآن',
    anyway_tomorrow_sub: 'يحرّك الخطة يوم كامل',
    anyway_keep_rest: 'لا، أكمل راحتي',
    anyway_moved: 'تحرّكت الخطة يومًا إلى الأمام.',
    anyway_undone: 'رجع يوم راحة، والخطة رجعت مكانها.',
    program_moved: 'سُحب اليوم إلى الأمام — تحرّكت الدورة يوماً.',
    anyway_no_exercise: 'ما في تمرين بقائمتك يشتغل على هذي العضلة.',
    last_7_days: 'آخر ٧ أيام',
    day_nothing: 'لا يوجد شيء مسجَّل في هذا اليوم.',
    day_body: 'الجسم',
    day_weight: 'الوزن',
    day_water: 'الماء',
    day_minimum: 'أقل مجهود',
    reorder_exercises: 'ترتيب التمارين',
    ro_done: 'تمّ',
    move_up: 'تحريك لأعلى',
    move_down: 'تحريك لأسفل',
    // تبويب البرنامج (مركز الخطة والتقدّم)
    program_title: 'برنامجي',
    program_subtitle: 'دورتك، وحجم عملك الأسبوعي، وأرقامك القياسية.',
    program_where: 'موضعك في الدورة',
    program_next: 'أيام التمرين القادمة',
    edit_cycle: 'تعديل الدورة',
    program_adherence: 'الالتزام',
    program_new_prs: 'أرقام جديدة',
    last_set: 'آخر مجموعة', set_label: 'المجموعة',
    common_supplements: 'مكمّلات شائعة', already_added: 'مضاف بالفعل',
    program_no_plan_title: 'لا يوجد برنامج بعد',
    program_no_plan_sub: 'اختر خطة جاهزة أو ابنِ دورتك الخاصة.',
    program_build: 'ابنِ برنامجي',
    workout_label: 'تمرين',
    view_all: 'عرض الكل',
    prev_month: 'الشهر السابق',
    next_month: 'الشهر التالي',
    exercise_order: 'ترتيب التمارين',
    edit_workout: 'تعديل التمرين',
    workout_name_ph: 'اسم التمرين (مثال: دفع)',
    remove_workout: 'إزالة من الدورة',
    workouts_label: 'تمارين',
    tmpl_desc_ppl: 'تقسيمة كلاسيكية: دفع / سحب / أرجل',
    tmpl_desc_upper_lower: 'تقسيمة متوازنة: علوي / سفلي',
    tmpl_desc_full_body: 'حصص للجسم كامل',
    tmpl_desc_bro_split: 'تقسيمة كمال الأجسام',
    preset_badge: 'جاهزة',
    ready_made_section: 'مزيد من الخطط الجاهزة',
    add_to_train: 'أضف للتمارين',
    added: 'مُضاف',

    image_optional: 'صورة (اختياري)',
    choose_image: 'اختر صورة',
    take_photo: 'التقاط صورة',
    change_image: 'تغيير',
    remove_image: 'إزالة',
    image_hint: 'اختر صورة من جهازك. تُحفظ محلياً.',

    planner_title: 'دورة التمرين',
    planner_subtitle: 'دورتك المتجددة عبر أيام التمرين.',
    today_plan: 'خطة اليوم',
    no_plan_today_sub: 'لا توجد تمارين مجدولة اليوم.',
    start_workout: 'ابدأ التمرين', guided_mode: 'الوضع الموجّه',
    today_workout: 'تمرين اليوم',
    first_workout_title: 'جاهز للتمرين؟', first_workout_sub: 'سجّل أول تمرين لتبدأ.',
    start_first_workout: 'ابدأ أول تمرين',
    exercise_word: 'تمرين',
    of_word: 'من',
    last_time: 'آخر مرة',
    first_time_no_record: 'أول مرة — لا يوجد سجل بعد',
    sync_conflict_toast: 'في هذا الجهاز تعديلات لم تصل السحابة',
    sync_resolve: 'حلّها',
    sync_unsynced: 'لم تُرفَع بعد',
    sync_restore_title: 'استعادة النسخة السابقة للمزامنة؟',
    sync_restore_text: 'أُخذت نسخة من هذا الجهاز تلقائياً قبل أن تستبدلها آخر مزامنة. الاستعادة تُرجعها وترفعها.',
    sync_restore: 'استعادة',
    sync_restored: 'تمت الاستعادة من نسخة ما قبل المزامنة',
    sync_restore_failed: 'تعذّرت الاستعادة',
    conflict_warn_cloud: 'الاحتفاظ بنسخة السحابة يتخلّى عن التعديلات التي جرت على هذا الجهاز.',
    ai_photo_title: 'صورة الأكل',
    ai_photo_sub: 'التقط صورة وسأقدّر السعرات',
    ai_capture: 'التقط صورة',
    ai_capture_sub: 'تفتح الكاميرا',
    ai_gallery: 'من المعرض',
    ai_gallery_sub: 'اختر صورة موجودة',
    run_best_weight: 'أعلى وزن',
    sug_label: 'اقتراح اليوم',
    sug_up_reason: 'قاعدة ٢-في-٢: بلغت أعلى المدى جلستين متتاليتين — زد الوزن وابدأ من {t}',
    sug_confirm_reason: 'بلغت أعلى المدى مرة — أكّدها جلسة ثانية قبل الزيادة (٢-في-٢)',
    sug_rep_reason: 'نفس الوزن — حاول تكراراً إضافياً',
    sug_hold_reason: 'ثبّت هذا الوزن حتى تبلغ {t} تكرارات نظيفة',
    sug_deload_reason: '{n} جلسات دون المدى على هذا الوزن — خفّف نحو ١٠٪ وأعد البناء',
    sug_applied: 'وُضع الاقتراح في المجموعة التالية',
    tab_saved_foods: 'أطعمة',
    tab_bundles: 'وجباتي',
    bundle_new: 'وجبة جديدة',
    bundle_name_ph: 'اسم الوجبة — مثلاً: فطوري المعتاد',
    bundle_pick_hint: 'اختر من أصناف هذا اليوم المسجّلة:',
    bundle_none_today: 'لا أصناف مسجّلة في هذا اليوم بعد — سجّلها مرة واحدة ثم احفظها هنا كوجبة.',
    bundle_save: 'حفظ الوجبة',
    bundle_saved: 'حُفظت الوجبة',
    bundle_deleted: 'حُذفت الوجبة',
    bundle_added: 'أُضيفت {name} — {n} أصناف',
    bundle_items: 'أصناف',
    bundle_empty: 'لا وجبات محفوظة بعد. سجّل أصناف يوم ثم احفظها كوجبة واحدة.',
    stats_open_chart: 'افتح التقدّم الكامل',
    run_last_weight: 'آخر وزن',
    ai_edit_values: 'تعديل القِيَم',
    ai_edit_done: 'تم',
    ai_edited: 'مُعدَّل',
    resting: 'راحة',
    skip: 'تخطّي',
    previous: 'السابق',
    next: 'التالي',
    finish: 'إنهاء',
    mark_set_done: 'إنهاء المجموعة',
    done_col: 'تمّ',
    workout_summary: 'ملخّص الجلسة',
    save_session: 'حفظ الجلسة',
    total_volume: 'إجمالي الحِمل',
    back_to_workout: 'العودة للتمرين',
    no_sets_to_save: 'سجّل مجموعة واحدة على الأقل',
    exit_no_save: 'خروج',
    logged: 'مُسجَّل',
    logged_today: 'مُسجَّل لهذا اليوم',
    pick_exercises: 'اختر تمارين',
    rest_day: 'راحة',
    rest_today_title: 'يوم راحة',
    rest_today_on: 'اليوم راحة. الدورة تتحرّك معك.',
    rest_today_off: 'عاد اليوم يوم تمرين.',
    rest_short: 'راحة',
    minutes_short: 'د',
    rest_is_the_plan: 'الراحة جزء من الخطة — العضلة تكبر اليوم لا أمس.',
    rest_sheet_title_1: 'للأسف ما حتقدر تتمرّن اليوم',
    rest_sheet_body_1: 'مفهوم، الأيام مو كلها زي بعضها. بس خلّ هذي بذهنك: <b>لا تسحب يومين ورا بعض.</b> اليوم الأول راحة، والثاني بداية انقطاع. والسلسلة اليوم تُحسب بالتسجيل — فأي شي مسجّل يبقيها.',
    rest_sheet_title_2: 'هذا ثاني يوم ورا بعض',
    rest_sheet_body_2: 'أمس أخذت راحة. لو أخذت اليوم كذلك، الانقطاع يبدأ من هنا — والرجعة تصير أثقل من التمرين نفسه.',
    rest_streak_line: 'سلسلتك {n} يوم — واليوم بلا تسجيل يقطعها',
    rest_do_what_i_can: 'راح أعمل الي بوسعي',
    rest_full_rest: 'لا، أحتاج راحة كاملة',
    rest_full_again: 'راحة ثانية — أتحمّل النتيجة',
    rest_min_title: 'وش تقدر عليه اليوم؟',
    rest_min_sub: 'اختر أقل شي تقدر تنهيه. المهم ما ينكسر الخط.',
    rest_min_one: 'تمرين واحد',
    rest_min_one_sub: 'أثقل حركة بالخطة، ٣ مجموعات',
    rest_min_half: 'نصف الجلسة',
    rest_min_half_sub: 'أول تمرينين وخلاص',
    rest_min_walk: 'مشي فقط',
    rest_min_walk_sub: 'يُحسب كارديو خفيف',
    rest_min_logged: 'سُجِّل. السلسلة سليمة.',
    apply_template: 'طبّق قالب',
    clear_plan: 'امسح الخطة',
    clear_plan_q: 'مسح كامل الخطة؟',
    clear_plan_text: 'كل الأيام المجدولة بتصير فاضية. جلساتك المسجّلة ما تتأثر.',
    plan_cleared: 'تم مسح الخطة',
    day_saved: 'تم حفظ اليوم',
    day_cleared: 'تم مسح اليوم',
    set_deleted: 'تم حذف المجموعة',
    undo: 'تراجع',
    empty_day_drop: 'يوم راحة — اضغط + أو اسحب تمرين لهون',
    remove_from_day: 'إزالة من اليوم',

    templates_title: 'القوالب',
    templates_subtitle: 'اختار برنامج يعبّي خطتك الأسبوعية.',
    template_applied: 'تم تطبيق القالب',
    apply: 'طبّق',

    dow_sun: 'أحد', dow_mon: 'اثنين', dow_tue: 'ثلاثاء', dow_wed: 'أربعاء', dow_thu: 'خميس', dow_fri: 'جمعة', dow_sat: 'سبت',
    dow_sun_full: 'الأحد', dow_mon_full: 'الاثنين', dow_tue_full: 'الثلاثاء', dow_wed_full: 'الأربعاء',
    dow_thu_full: 'الخميس', dow_fri_full: 'الجمعة', dow_sat_full: 'السبت',

    calendar_title: 'التقويم',
    calendar_subtitle: 'عرض شهري لنشاطك.',
    no_activity_day: 'لا يوجد نشاط في هذا اليوم',
    workouts_day: 'تمارين', cardio_day: 'كارديو', sleep_day: 'نوم',

    supplements_title: 'المكمّلات', todays_doses: 'جرعات اليوم',
    supplements_subtitle: 'تتبّع جرعاتك اليومية وحافظ على سلسلتك.',
    new_supplement: 'مكمّل جديد',
    edit_supplement: 'تعديل المكمّل',
    supplement_name: 'اسم المكمّل',
    dose: 'الجرعة (اختياري)',
    color: 'اللون',
    no_supplements: 'لا توجد مكمّلات بعد',
    no_supplements_text: 'أضف المكمّلات التي تتناولها (مثل: الكرياتين، الواي بروتين).',
    taken: 'مأخوذ',
    not_taken: 'ما أخذته بعد',
    streak: 'سلسلة',
    delete_supplement_q: 'حذف المكمّل؟',
    delete_supplement_text: 'المكمّل وسجله كله بينحذف.',

    food_log_title: 'الأكل اليومي', logged_items: 'الأصناف',
    food_history: 'سجل الأكل',
    today_totals: 'اليوم',
    add_food_log: 'أضف أكل',
    no_food_logged: 'ما سجّلت أكل اليوم',
    no_food_logged_text: 'اضغط "أضف أكل" واختر من قائمتك المرجعية.',
    servings: 'عدد الحصص',
    food_added: 'تم التسجيل',
    food_removed: 'تم الحذف',
    take_all: 'أخذ الكل',
    all_taken: 'تم تحديد الكل كمأخوذ',
    prev_day: 'يوم سابق', next_day: 'يوم تالي',


    progress_chart: 'التقدم',
    max_weight_per_session: 'أقصى وزن لكل جلسة',
    no_chart_data: 'سجّل مجموعتين أو أكثر لعرض رسم تقدّمك.',

    ms_sets_label: 'مجموعات',
    ms_sessions_logged: 'جلسة مسجّلة',
    ms_empty_title: 'لا توجد جلسات بعد',
    ms_empty_text: 'سجّل تمريناً لهذه العضلة وسيظهر هنا.',

    tools_section: 'أدوات',
    supplements_card: 'المكمّلات',

    unit_label: 'وحدة الوزن',
    // Formal MSA, not transliteration: كيلوغرام (not the dialectal كيلوجرام) and
    // رطل (not the borrowed باوند). See CLAUDE.md — the Arabic UI is فصحى.
    kg_label: 'كيلوغرام (kg)',
    lb_label: 'رطل (lb)',

    // Navigation a11y
    back: 'رجوع',

    // Personal Records
    pr_card: 'الأرقام القياسية',
    compare_card: 'قارن',
    pr_card_sub: 'أفضل أوزانك على الإطلاق',
    pr_view_title: 'الأرقام القياسية',
    pr_est_orm: '1RM تقديري',
    pr_max_weight: 'أعلى وزن',
    pr_empty_title: 'لا توجد أرقام قياسية بعد',
    pr_empty_text: 'سجّل جلسة لتضبط أول رقم قياسي.',
    pr_weight: 'رقم قياسي!',
    pr_orm: 'رقم قياسي!',
    pr_both: 'رقم قياسي!',

    // ---- الإشعارات (APPLY-notifications.md §4) ------------------------------
    // {name} اسم حصّة اليوم نفسها. كان القالب يخبز كلمة «دفع» حرفياً، وهي
    // معلومة خاطئة في يوم أرجل — في السطر الوحيد الذي يُقرأ بلمحة.
    notif_train_title: '{name} — {n} تمارين',
    notif_train_body: 'آخر مرة: {ex} {kg} كغم × {reps}.',
    notif_train_body_first: 'أول جلسة مسجّلة تبدأ من هنا.',
    notif_train_body_plan: '{n} تمارين في هذه الحصّة.',
    notif_supps_title: '{name}',
    notif_supps_body: 'الجرعة {i} من {n} اليوم.',
    notif_water_title: '{cur} من {goal} مل',
    // ليست «بقي {hours} ساعات على نهاية يومك» — تلك الجملة تتحدّث عن وقت ينفد
    // وكانت مجدولة صباحاً. المتبقّي بالملّيلتر صحيح في أي ساعة، وهو ما يطلبه
    // التذكير فعلاً.
    notif_water_body: 'بقي {left} مل — نحو {cups} أكواب.',
    notif_water_body_done: 'تحقّق هدف اليوم.',
    notif_water_title_plan: 'الماء — {goal} مل اليوم',
    notif_water_body_plan: 'نحو {cups} أكواب عبر يومك.',
    notif_food_title: '{meal} — بقي {kcal} سعرة',
    notif_food_body: 'ومتبقٍّ {p} غ بروتين.',
    notif_food_body_nop: 'تحقّق هدف البروتين.',
    notif_food_title_plan: '{meal} — {kcal} سعرة',
    notif_food_body_plan: '{p} غ بروتين هدف اليوم.',
    notif_streak_title: 'سلسلة {n} يوماً على المحك',
    notif_streak_body: 'أي نشاط مسجّل قبل منتصف الليل يكفي.',
    notif_summary_title: '{n} تذكيرات اليوم',
    notif_perm_title: 'نذكّرك بشروطك',
    notif_perm_body: 'خمسة تذكيرات فقط، كلها داخل نافذة يومك، وكل واحدة تُطفأ وحدها بأي وقت.',
    notif_perm_cta: 'فعّل التذكيرات',
    // ---- إعدادات الإشعارات وشيت الإذن (§7، §8) ----------------------------
    notif_settings_title: 'الإشعارات',
    notif_settings_of: '{n} من 5',   // Latin 5: every figure in the app goes through fmtNum, which is en-US
    notif_window_title: 'نافذة يومك',
    notif_window_hint: 'كل شيء يُجدول داخلها. خارجها تنتظر المكمّلات والوجبات حتى بدايتها ويسقط الماء — ولا يوجد إعداد منفصل لساعات الصمت لأن هذه الساعات هي هو.',
    notif_ch_train: 'التمرين',
    notif_ch_supps: 'المكمّلات',
    notif_ch_water: 'الماء',
    notif_ch_food: 'الوجبات',
    notif_ch_streak: 'السلسلة',
    notif_sum_train_auto: 'قبل موعدك المعتاد بنصف ساعة',
    notif_sum_train_fixed: 'كل يوم تمرين الساعة {at}',
    notif_sum_supps: '{n} جرعات',
    notif_sum_supps_none: 'لا جرعات بعد',
    notif_sum_water: 'كل {n} ساعات تقريباً، موزّعة على نافذتك',
    notif_sum_food: '{n} مواعيد وجبات',
    notif_sum_food_none: 'لا مواعيد وجبات بعد',
    notif_sum_food_notarget: 'صامتة حتى تحدّد هدف السعرات',
    notif_sum_streak: 'فقط حين تكون سلسلة ٧ أيام فأكثر على المحك',
    notif_sum_off: 'مطفأة',
    notif_train_mode_fixed: 'وقت ثابت',
    notif_train_mode_auto: 'قبل موعدي المعتاد بنصف ساعة',
    notif_supps_add: 'أضف جرعة',
    notif_supps_name: 'الاسم',
    notif_supps_time: 'الوقت',
    notif_supps_link: 'المكمّل',
    notif_supps_link_none: 'غير مرتبطة',
    notif_supps_link_hint: 'الجرعة المرتبطة تصمت حين تؤشّر على ذلك المكمّل.',
    notif_food_add: 'أضف موعد وجبة',
    notif_food_name: 'الوجبة',
    // ---- أقسام النشاط (الصفحة التي طلبها المالك) --------------------------
    notif_today: 'اليوم',
    notif_arrived: 'وصلت',
    notif_upcoming: 'قادمة',
    notif_up_hint: 'تتغيّر الصياغة مع أرقامك.',
    notif_up_empty: 'لا شيء آخر مجدول اليوم.',
    notif_history: 'سابقاً',
    notif_show_more: 'اعرض الكل',
    notif_log_empty_title: 'لا شيء بعد',
    notif_log_empty_text: 'التذكيرات التي تصلك تظهر هنا بنصّها كما وصلت تماماً.',
    notif_clear_log: 'امسح السجل',
    notif_clear_log_sub: 'يمسح السجل على هذا الجهاز وحده.',
    notif_cleared: 'مُسح السجل',
    notif_yesterday: 'أمس',
    notif_unseen: '{n} جديدة',
    notif_dropped: 'أُمسك {n} — تجاوز حدّك اليومي',
    // ---- الحدّ اليومي: صار إعداداً بدل حارس صامت --------------------------
    notif_cap_title: 'الحدّ اليومي',
    notif_cap_hint: 'حين يصل هذا العدد يهدأ باقي اليوم. الماء يتنازل أولاً ثم الوجبات.',
    notif_cap_auto: 'تلقائي',
    notif_cap_auto_sub: 'ثلاثة يومياً في البداية، وستة بعد أسبوعين من السجل',
    notif_cap_none: 'بلا حدّ',
    notif_arm_days: 'مُجهّزة لـ{n} أيام قادمة',
    notif_arm_hint: 'افتح التطبيق مرة أسبوعياً على الأقل لتبقى مُجهّزة.',
    day_moved_in: 'يوم مُقدَّم',
    day_rest_taken: 'راحة مأخوذة',
    pg_volume_30d: 'الحجم · 30 يوماً',
    pg_sessions_30d: 'الجلسات · 30 يوماً',
    pg_days_unit: 'يوم',
    notif_every_hours: 'كل {n} ساعات',
    notif_sys_hint: 'الصوت والاهتزاز من النظام لا من التطبيق.',
    notif_sys_open: 'افتح إعدادات إشعارات النظام',
    notif_denied: 'معطّلة من النظام',
    notif_denied_sub: 'أعِد تفعيل الإشعارات لتطبيق VAULT من إعدادات أندرويد ثم ارجع إلى هنا.',
    notif_perm_l1: 'داخل الساعات التي تحدّدها وحدها.',
    notif_perm_l2: 'حدّ يومي تضبطه بنفسك، ومنخفض افتراضياً.',
    notif_perm_l3: 'كل قناة تُطفأ وحدها.',
    notif_perm_l4: 'تسجيل الشيء يلغي تذكيره.',
    notif_perm_later: 'ليس الآن',
  },
};

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
  if (meta) meta.setAttribute('content', theme === 'light' ? '#faf5f0' : '#000000');
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
      const p = sb.setStyle({ style: theme === 'light' ? 'LIGHT' : 'DARK' });
      if (p && p.catch) p.catch(() => {});
    }
  } catch (_) {}
}

function applyLang(lang) {
  if (lang !== 'ar') lang = 'en';
  document.documentElement.lang = lang;
  document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  // Update bottom nav labels (they have data-t)
  document.querySelectorAll('[data-t]').forEach((el) => {
    el.textContent = t(el.dataset.t);
  });
}

// Switch the UI language and re-render everything that is currently on screen.
// applyLang alone only fixes `dir` and the [data-t] nav labels — every view and
// every open gate builds its text with t() at render time, so anything already
// rendered keeps the old language until it is rebuilt. The boot-time overlays
// matter most: the login gate and the first-run card are BOTH alive at once (the
// gate is stacked on top), so changing the language on the gate has to reach the
// card underneath it too.
function setUiLanguage(lang) {
  DB.prefs.setLang(lang);
  applyLang(lang);
  try { if (currentView) renderView(currentView); } catch (_) {}
  const onb = document.getElementById('onboard-gate');
  if (onb && onb.__render) { try { onb.__render(); } catch (_) {} }
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


// ===========================================================================
// §7 — THE PERMISSION SHEET. One chance, spent deliberately.
//
// Not on first open: a permission prompt before the app has done anything for
// you is a request with no case behind it, and on Android 13+ a dialog
// dismissed twice is hard-denied FOREVER. So it waits until after the first
// logged workout, when there is something concrete to remind you about, and it
// appears exactly once — `asked` is set on the way out either way.
//
// requestPermission() fires ONLY from the filled button. "Not now" must not
// call it: that is the whole point of asking in our own UI first, and a "not
// now" that burns the OS prompt would be worse than never asking.
// ===========================================================================
function openNotifPermSheet() {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('notif-perm-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'notif-perm-overlay';
  overlay.className = 'sheet-overlay';
  const line = (k) => `<div class="ntfp-line">${icon('check', 20)}<span>${t(k)}</span></div>`;
  overlay.innerHTML = `
    <div class="add-sheet ntfp-sheet" role="dialog" aria-modal="true"
         aria-label="${escapeHtml(t('notif_perm_title'))}">
      <div class="sheet-handle"></div>
      <div class="ntfp-icon">${icon('bell', 28)}</div>
      <div class="ntfp-head">
        <div class="ntfp-title">${t('notif_perm_title')}</div>
        <div class="ntfp-body">${t('notif_perm_body')}</div>
      </div>
      <div class="ntfp-lines">
        ${line('notif_perm_l1')}${line('notif_perm_l2')}${line('notif_perm_l3')}${line('notif_perm_l4')}
      </div>
      <div class="rest-sheet-actions">
        <button type="button" class="btn btn-primary btn-block ntfp-cta" data-allow>${t('notif_perm_cta')}</button>
        <button type="button" class="btn btn-ghost btn-block" data-later>${t('notif_perm_later')}</button>
      </div>
    </div>`;
  app.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    // Asked, whichever way it went. The sheet never reappears on its own — the
    // "turn on reminders" row on the notifications page is the only way back,
    // and it is shown exactly while the OS prompt is still winnable.
    DB.notif.setAsked();
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 260);
  };

  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay || e.target.closest('[data-later]')) { close(); return; }
    if (!e.target.closest('[data-allow]')) return;
    close();
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (_) {}
    // No test notification after enabling, by instruction: the first thing the
    // feature does must be something the user actually wanted.
    armNotifications();
    renderView('home');
  });
}

// Called after a session is logged. The gate is `asked`, not a counter, so this
// is safe to call from every save path.
function maybeAskNotifPermission() {
  try {
    if (DB.notif.get().asked) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') { DB.notif.setAsked(); return; }
    if (!DB.sessions.listAll().some((s) => s.sets && s.sets.length)) return;
    setTimeout(openNotifPermSheet, 700);   // let the save toast land first
  } catch (_) {}
}

// ===========================================================================
// §8 — THE NOTIFICATIONS PAGE. One screen, three sections, in this order:
//
//   TODAY     what already arrived, and what is still coming — the latter shown
//             with the EXACT words it will carry, at the exact minute. That is
//             the answer to "they are not scheduled correctly": you can read
//             the schedule instead of inferring it from what shows up.
//   EARLIER   the rolling history, which did not exist at all before. The only
//             two records the app kept were per-day dedupe sets that both reset
//             at midnight, so nothing could ever answer "what did I get?".
//   SETTINGS  the controls.
//
// Two things stay deliberately absent:
//   · no quiet-hours setting — quiet hours ARE the outside of the day window,
//     so a second control would be a second source of truth for one fact;
//   · no sound / priority / master-off — those belong to the OS, and copying
//     them here creates two switches where the system's always wins.
//
// The daily cap is no longer among them. It was withheld on the reasoning that
// "a guard offered as an option is a guard the user can switch off" — but a
// guard that silently deletes reminders is a guard the user experiences as a
// broken feature, and they cannot tell the two apart. It is a control now, and
// TODAY names what it held back.
// ===========================================================================

// "Show everything" for the history section. Module-level so a redraw inside the
// page (a toggle, a new dose) does not silently collapse a list the user just
// expanded.
let notifLogExpanded = false;

const NTF_CHANNEL_ICON = {
  train: 'dumbbell', supps: 'pill', water: 'droplet',
  food: 'utensils', streak: 'zap', summary: 'bell',
};

// today / yesterday / the date. A log grouped by raw ISO strings reads as data;
// this reads as a diary, which is what the section is.
function notifDayLabel(iso) {
  if (iso === todayISO()) return t('notif_today');
  if (iso === addDaysISO(todayISO(), -1)) return t('notif_yesterday');
  return formatDate(iso);
}

// One row, used by both the arrived list and the coming-up list. `upcoming`
// pulls it back visually: it has not happened yet, and it must not read as
// though it has.
function notifItemHtml(o) {
  return `
    <div class="ntfa-item${o.upcoming ? ' is-upcoming' : ''}"${o.channel ? ` data-open-ch="${escapeHtml(o.channel)}"` : ''}${o.logId ? ` data-log="${escapeHtml(o.logId)}"` : ''}>
      <span class="ntfa-node"></span>
      <span class="ntfa-time num" dir="ltr">${escapeHtml(o.at || '')}</span>
      <span class="ntfa-icon">${icon(NTF_CHANNEL_ICON[o.channel] || 'bell', 18)}</span>
      <span class="ntfa-main">
        <span class="ntfa-title">${escapeHtml(o.title || '')}</span>
        ${o.body ? `<span class="ntfa-body">${escapeHtml(o.body)}</span>` : ''}
      </span>
    </div>`;
}

// TODAY. Everything here is derived at render time from the same two sources
// the delivery paths use — the log and scheduleForDate — so the page cannot
// describe a schedule the app is not actually running.
function notifTodayHtml() {
  const today = todayISO();
  const arrived = DB.notif.logForDate(today);

  let upcoming = [];
  let dropped = 0;
  try {
    upcoming = DB.notif.scheduleForDate(today);
    // The same question without the ceiling. The difference is what the cap ate,
    // and naming it is the difference between a quiet guard and a broken app.
    dropped = Math.max(0, DB.notif.scheduleForDate(today, { noCap: true }).length - upcoming.length);
  } catch (_) {}

  const arrivedHtml = arrived.map((r) => notifItemHtml({
    at: r.at, channel: r.channel, title: r.title, body: r.body, logId: r.id,
  })).join('');

  const upcomingHtml = upcoming.map((it) => {
    let txt = { title: '', body: '' };
    try { txt = DB.notif.text(it); } catch (_) {}
    return notifItemHtml({ at: it.at, channel: it.channel, title: txt.title, body: txt.body, upcoming: true });
  }).join('');

  return `
    <div class="rot-section-title">${t('notif_today')}</div>
    <div class="card ntfa-group">
      ${arrived.length ? `<div class="ntfa-label">${t('notif_arrived')}</div>${arrivedHtml}` : ''}
      <div class="ntfa-label">${t('notif_upcoming')}</div>
      ${upcoming.length ? upcomingHtml : `<div class="ntfa-empty">${t('notif_up_empty')}</div>`}
      ${upcoming.length ? `<div class="ntfs-hint">${t('notif_up_hint')}</div>` : ''}
      ${dropped ? `<div class="ntfa-held">${icon('info', 16)} ${escapeHtml(t('notif_dropped').replace('{n}', fmtNum(dropped)))}</div>` : ''}
    </div>`;
}

// EARLIER. Grouped by day, newest first, today excluded (it is the section
// above). Seven groups then "show all" — a history that opens fully expanded is
// a wall, and one that cannot expand is a tease.
function notifHistoryHtml() {
  const today = todayISO();
  const all = DB.notif.logList().filter((r) => r.date !== today);
  if (!all.length) {
    return `
      <div class="rot-section-title">${t('notif_history')}</div>
      <div class="card ntfa-group">
        <div class="ntfa-empty">
          <div class="ntfa-empty-title">${t('notif_log_empty_title')}</div>
          <div class="ntfa-empty-text">${t('notif_log_empty_text')}</div>
        </div>
      </div>`;
  }
  const days = [];
  all.forEach((r) => { if (days.indexOf(r.date) === -1) days.push(r.date); });
  const shown = notifLogExpanded ? days : days.slice(0, 7);
  const groups = shown.map((d) => `
    <div class="ntfa-day">
      <div class="ntfa-label">${escapeHtml(notifDayLabel(d))}</div>
      ${all.filter((r) => r.date === d).map((r) => notifItemHtml({
        at: r.at, channel: r.channel, title: r.title, body: r.body, logId: r.id,
      })).join('')}
    </div>`).join('');

  return `
    <div class="rot-section-title">${t('notif_history')}</div>
    <div class="card ntfa-group">
      ${groups}
      ${shown.length < days.length ? `<button type="button" class="ntfs-add" id="ntfa-more">${t('notif_show_more')}</button>` : ''}
    </div>
    <button class="settings-action-row is-danger" id="ntfa-clear">
      <div class="settings-action-icon">${icon('trash', 20)}</div>
      <div class="settings-action-main">
        <div class="settings-action-title">${t('notif_clear_log')}</div>
        <div class="settings-action-sub">${t('notif_clear_log_sub')}</div>
      </div>
    </button>`;
}

function renderNotifications(el) {
  const cfg = DB.notif.get();
  const ch = cfg.channels;
  const denied = (typeof Notification !== 'undefined' && Notification.permission === 'denied');
  const hasTargets = DB.nutrition.hasTargets();

  const sub = (id) => {
    if (!ch[id].on) return t('notif_sum_off');
    switch (id) {
      case 'train': return ch.train.mode === 'auto'
        ? t('notif_sum_train_auto')
        : t('notif_sum_train_fixed').replace('{at}', ch.train.at);
      case 'supps': return ch.supps.doses.length
        ? t('notif_sum_supps').replace('{n}', fmtNum(ch.supps.doses.length))
        : t('notif_sum_supps_none');
      case 'water': return t('notif_sum_water').replace('{n}', fmtNum(Math.round(ch.water.everyMin / 60)));
      // Says out loud why it is silent. This channel had a full settings row, a
      // delay picker and translated text for a notification that no code path
      // could ever produce — it was configurable and mute.
      case 'food':
        if (!hasTargets) return t('notif_sum_food_notarget');
        return ch.food.meals.length
          ? t('notif_sum_food').replace('{n}', fmtNum(ch.food.meals.length))
          : t('notif_sum_food_none');
      default: return t('notif_sum_streak');
    }
  };
  const ICONS_FOR = NTF_CHANNEL_ICON;

  const row = (id, body) => `
    <div class="ntfs-row${ch[id].on ? '' : ' is-off'}">
      <div class="ntfs-head">
        <span class="ntfs-icon">${icon(ICONS_FOR[id], 22)}</span>
        <span class="ntfs-main">
          <span class="ntfs-title">${t('notif_ch_' + id)}</span>
          <span class="ntfs-sub">${escapeHtml(sub(id))}</span>
        </span>
        <button type="button" class="ntfs-switch${ch[id].on ? ' on' : ''}" role="switch"
                aria-checked="${ch[id].on}" aria-label="${escapeHtml(t('notif_ch_' + id))}"
                data-toggle="${id}"><span class="ntfs-knob"></span></button>
      </div>
      ${ch[id].on && body ? `<div class="ntfs-body">${body}</div>` : ''}
    </div>`;

  const trainBody = `
    <div class="ntfs-choice">
      <button type="button" class="ntfs-opt${ch.train.mode === 'auto' ? ' sel' : ''}" data-train-mode="auto">${t('notif_train_mode_auto')}</button>
      <button type="button" class="ntfs-opt${ch.train.mode === 'fixed' ? ' sel' : ''}" data-train-mode="fixed">${t('notif_train_mode_fixed')}</button>
    </div>
    ${ch.train.mode === 'fixed' ? `<input type="time" class="ntfs-time" value="${escapeHtml(ch.train.at)}" data-train-at>` : ''}`;

  // Doses and meal times are the same shape — {id, at, name} — so they get the
  // same editor. A dose can additionally be LINKED to a real supplement, which
  // is what lets it go quiet once that supplement is ticked off for the day.
  const timeList = (list, rmAttr, addAttr, addLabel) => `
    <div class="ntfs-doses">
      ${list.map((d) => `
        <div class="ntfs-dose">
          <span class="num" dir="ltr">${escapeHtml(d.at || '')}</span>
          <span class="ntfs-dose-name">${escapeHtml(d.name || '')}</span>
          ${d.suppId ? `<span class="ntfs-dose-link" title="${escapeHtml(t('notif_supps_link_hint'))}">${icon('check', 14)}</span>` : ''}
          <button type="button" class="icon-btn" ${rmAttr}="${escapeHtml(d.id)}"
                  aria-label="${escapeHtml(t('delete'))}">${icon('close', 16)}</button>
        </div>`).join('')}
      <button type="button" class="ntfs-add" ${addAttr}>${icon('plus', 20)} ${addLabel}</button>
    </div>`;

  const suppsBody = timeList(ch.supps.doses, 'data-rm-dose', 'data-add-dose', t('notif_supps_add'));

  const waterBody = `
    <div class="ntfs-choice">
      ${[1, 2, 3].map((h) => `<button type="button" class="ntfs-opt${Math.round(ch.water.everyMin / 60) === h ? ' sel' : ''}" data-water-h="${h}">${t('notif_every_hours').replace('{n}', fmtNum(h))}</button>`).join('')}
    </div>`;

  const foodBody = hasTargets
    ? timeList(ch.food.meals, 'data-rm-meal', 'data-add-meal', t('notif_food_add'))
    : `<div class="ntfs-hint">${t('notif_sum_food_notarget')}</div>`;

  const capOpt = (val, label) => `<button type="button" class="ntfs-opt${String(cfg.cap) === String(val) ? ' sel' : ''}" data-cap="${val}">${label}</button>`;

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="settings" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('notif_settings_title')}</div>
    </div>

    ${(!denied && typeof Notification !== 'undefined' && Notification.permission === 'default') ? `
      <button class="settings-action-row ntfs-enable" id="ntfs-enable">
        <div class="settings-action-icon">${icon('bell', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('notif_perm_cta')}</div>
          <div class="settings-action-sub">${t('notif_perm_body')}</div>
        </div>
      </button>` : ''}

    ${denied ? `
      <div class="ntfs-denied">
        <span class="ntfs-icon">${icon('bellOff', 22)}</span>
        <span class="ntfs-main">
          <span class="ntfs-title">${t('notif_denied')}</span>
          <span class="ntfs-sub">${t('notif_denied_sub')}</span>
        </span>
      </div>` : ''}

    ${notifTodayHtml()}

    ${notifHistoryHtml()}

    <div class="rot-section-title">${t('settings_title')}</div>

    <div class="card ntfs-window">
      <div class="ntfa-label">${t('notif_window_title')}</div>
      <div class="ntfs-window-row">
        <input type="time" class="ntfs-time num" value="${escapeHtml(cfg.window.start)}" data-win="start" aria-label="${escapeHtml(t('notif_window_title'))}">
        <span class="ntfs-window-dash"></span>
        <input type="time" class="ntfs-time num" value="${escapeHtml(cfg.window.end)}" data-win="end" aria-label="${escapeHtml(t('notif_window_title'))}">
      </div>
      <div class="ntfs-hint">${t('notif_window_hint')}</div>
    </div>

    <div class="card ntfs-list">
      ${row('train', trainBody)}
      ${row('supps', suppsBody)}
      ${row('water', waterBody)}
      ${row('food', foodBody)}
      ${row('streak', '')}
    </div>

    <div class="card ntfs-window">
      <div class="ntfa-label">${t('notif_cap_title')}</div>
      <div class="ntfs-choice">
        ${capOpt('auto', t('notif_cap_auto'))}
        ${capOpt(6, fmtNum(6))}
        ${capOpt(10, fmtNum(10))}
        ${capOpt('none', t('notif_cap_none'))}
      </div>
      <div class="ntfs-hint">${cfg.cap === 'auto' ? t('notif_cap_auto_sub') + ' — ' : ''}${t('notif_cap_hint')}</div>
    </div>

    <div class="ntfs-hint ntfs-foot">${escapeHtml(t('notif_arm_days').replace('{n}', fmtNum(DB.notif.ARM_DAYS)))} · ${t('notif_arm_hint')}</div>
    <div class="ntfs-hint ntfs-foot">${t('notif_sys_hint')}</div>
    <button class="settings-action-row" id="ntfs-sys">
      <div class="settings-action-icon">${icon('settings', 20)}</div>
      <div class="settings-action-main">
        <div class="settings-action-title">${t('notif_sys_open')}</div>
      </div>
    </button>
  `;

  // Opening the page IS reading it, so nothing stays "new" behind you.
  try { DB.notif.logMarkAllSeen(); } catch (_) {}

  // Notify.sync() as well as armNotifications(), and that omission was the whole
  // point of this page failing quietly: armNotifications only re-arms the IN-APP
  // setTimeout path. The OS alarms are armed by sync(), across a 7-day horizon —
  // so switching a channel off, moving the window, or adding a dose left the
  // NATIVE schedule running the OLD settings until some later foreground
  // happened to re-sync. The supplement editor has always called sync() on save;
  // the page dedicated to notification settings did not.
  const redraw = () => {
    armNotifications();
    try { if (window.Notify) Notify.sync(); } catch (_) {}
    renderNotifications(el);
  };

  el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.toggle;
    DB.notif.setChannel(id, { on: !DB.notif.get().channels[id].on });
    redraw();
  }));
  el.querySelectorAll('[data-train-mode]').forEach((b) => b.addEventListener('click', () => {
    DB.notif.setChannel('train', { mode: b.dataset.trainMode }); redraw();
  }));
  el.querySelector('[data-train-at]')?.addEventListener('change', (e) => {
    if (e.target.value) { DB.notif.setChannel('train', { at: e.target.value }); redraw(); }
  });
  el.querySelectorAll('[data-water-h]').forEach((b) => b.addEventListener('click', () => {
    DB.notif.setChannel('water', { everyMin: Number(b.dataset.waterH) * 60 }); redraw();
  }));
  el.querySelectorAll('[data-cap]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.cap;
    DB.notif.setCap(v === 'auto' || v === 'none' ? v : Number(v));
    redraw();
  }));
  el.querySelectorAll('[data-win]').forEach((i) => i.addEventListener('change', () => {
    if (i.value) { DB.notif.setWindow({ [i.dataset.win]: i.value }); redraw(); }
  }));
  el.querySelectorAll('[data-rm-dose]').forEach((b) => b.addEventListener('click', () => {
    const doses = DB.notif.get().channels.supps.doses.filter((d) => d.id !== b.dataset.rmDose);
    DB.notif.setChannel('supps', { doses }); redraw();
  }));
  el.querySelector('[data-add-dose]')?.addEventListener('click', () => {
    openTimeEntryModal({ kind: 'supps' }, (entry) => {
      const doses = DB.notif.get().channels.supps.doses.slice();
      // The id must be stable — the notification tag is built from it, so a
      // regenerated id would let the same dose notify twice in one day.
      doses.push(entry);
      DB.notif.setChannel('supps', { doses });
      redraw();
    });
  });
  el.querySelectorAll('[data-rm-meal]').forEach((b) => b.addEventListener('click', () => {
    const meals = DB.notif.get().channels.food.meals.filter((m) => m.id !== b.dataset.rmMeal);
    DB.notif.setChannel('food', { meals }); redraw();
  }));
  el.querySelector('[data-add-meal]')?.addEventListener('click', () => {
    openTimeEntryModal({ kind: 'food' }, (entry) => {
      const meals = DB.notif.get().channels.food.meals.slice();
      meals.push(entry);
      DB.notif.setChannel('food', { meals });
      redraw();
    });
  });
  // Tapping a logged or upcoming reminder goes where the reminder itself would
  // have gone — same destFor map, so the page and the notification agree.
  el.querySelectorAll('[data-open-ch]').forEach((r) => r.addEventListener('click', () => {
    notifOpen(r.dataset.openCh);
  }));
  $('#ntfa-more', el)?.addEventListener('click', () => { notifLogExpanded = true; renderNotifications(el); });
  $('#ntfa-clear', el)?.addEventListener('click', () => {
    DB.notif.logClear();
    notifLogExpanded = false;
    try { showToast(t('notif_cleared')); } catch (_) {}
    renderNotifications(el);
  });
  // The ONLY way back to the OS prompt after "not now". Without it that button
  // is a one-way door: the sheet never reopens by itself, so a user who
  // deferred once could never enable reminders from inside the app again.
  $('#ntfs-enable', el)?.addEventListener('click', () => openNotifPermSheet());
  // The native health check — permission state, what Android actually holds,
  // exact-alarm status, and a real test notification. Kept because every
  // failure on this path is INVISIBLE: a refused permission, a muted channel
  // and a battery optimiser sitting on the alarm all look identical to "the
  // feature is broken". It is reached only from here now, so there is one
  // entry point to notifications and one place that schedules them.
  $('#ntfs-sys', el)?.addEventListener('click', () => openRemindersModal());
}

// A time plus a name — for a supplement dose and for a meal alike, because they
// are the same record ({id, at, name}) and deserve the same editor rather than
// two that can drift.
//
// For a dose there is one more field: an optional link to a real supplement.
// That link is what makes "logging something cancels its reminder" true for
// more than water — scheduleForDate drops a linked dose once DB.supplements
// says it was taken. It is a PICKER, never a name match: matching by name is
// silently wrong the moment a supplement is renamed.
function openTimeEntryModal(opts, onSave) {
  const isSupp = opts.kind === 'supps';
  const supps = isSupp ? DB.supplements.list() : [];
  const overlay = openModal(`
    <div class="modal-title">${isSupp ? t('notif_supps_add') : t('notif_food_add')}</div>
    ${isSupp && supps.length ? `
      <div class="form-group">
        <label class="form-label" for="dose-link">${t('notif_supps_link')}</label>
        <select class="form-input" id="dose-link">
          <option value="">${escapeHtml(t('notif_supps_link_none'))}</option>
          ${supps.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || '')}</option>`).join('')}
        </select>
        <div class="ntfs-hint">${t('notif_supps_link_hint')}</div>
      </div>` : ''}
    <div class="form-group">
      <label class="form-label" for="dose-name">${isSupp ? t('notif_supps_name') : t('notif_food_name')}</label>
      <input type="text" class="form-input" id="dose-name" maxlength="40">
    </div>
    <div class="form-group">
      <label class="form-label" for="dose-at">${t('notif_supps_time')}</label>
      <input type="time" class="form-input num" id="dose-at" value="08:00">
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" data-ok>${t('save')}</button>
    </div>
  `);
  const link = overlay.querySelector('#dose-link');
  const nameInput = overlay.querySelector('#dose-name');
  // Picking a supplement fills the name, so the common case is one choice and
  // not two. Typing over it afterwards is still allowed — the link is what the
  // schedule uses, the name is only what the notification says.
  link?.addEventListener('change', () => {
    const s = supps.find((x) => x.id === link.value);
    if (s && !nameInput.value.trim()) nameInput.value = s.name || '';
  });
  overlay.querySelector('[data-ok]').addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    const at = overlay.querySelector('#dose-at').value || '';
    if (!name || !at) return;          // both required; the button just does nothing
    closeModal();
    onSave({ id: 'd' + Date.now().toString(36), at, name, suppId: (link && link.value) || null });
  });
  setTimeout(() => nameInput?.focus(), 40);
}

// ===========================================================================
// NOTIFICATION DELIVERY — APPLY-notifications.md §3.2
//
// The spec's shape, and the owner's decision: DB.notif.scheduleAll() is the
// single source of truth for WHAT and WHEN, and everything platform-specific
// lives behind this one function. Swapping the mechanism later — a push server,
// a different native plugin — touches deliver() and nothing above it.
//
// No service worker, by decision. index.html unregisters every service worker
// on load and that block is load-bearing: it is what rescues a device still on
// a pre-v109 bundled APK. So on the web the reminder arrives while the app is
// open, as the in-app bar (§5.1's rule, which says exactly that: app open ⇒ no
// system notification). The §5.2/§5.3 action buttons need a worker and are
// therefore not built; nothing here pretends otherwise.
// ===========================================================================

// One timer per scheduled item, cleared wholesale on re-arm so a settings
// change can never leave an orphan firing the old time.
let notifTimers = [];

// The text builder that used to live here has moved to DB.notif.text().
//
// It was the GOOD one — it read live DB data — but it was only ever reachable
// from the in-app bar, while notify.js carried a second, poorer builder that fed
// every notification that actually reached a phone. Two builders for one
// sentence. It lives in storage.js now because that file loads before both
// app.js and notify.js, so both can call it.

// Where a notification takes you when tapped — §5.3's destinations, minus the
// per-button rows, which need the worker we are not registering. The map itself
// is DB.notif.destFor(), because notify.js needs the same answer and its own
// copy had drifted into keying off a field these items never carried.
function notifOpen(channel) {
  const d = DB.notif.destFor(channel);
  navigate(d.view, d.context);
}

/**
 * Deliver ONE scheduled item. The only place that knows about platforms.
 * @param {{at:string, channel:string, tag:string, payload:object}} item
 */
function deliver(item) {
  if (!item || !item.channel) return;
  // The channel switch is checked HERE too, not only at schedule time: a user
  // can turn a channel off in the minutes between arming the timer and its
  // firing, and the spec is explicit that the switch is honoured before every
  // single send, without exception.
  const cfg = DB.notif.get();
  const ch = cfg.channels[item.channel];
  if (!ch || !ch.on) return;
  // READ, not consume. markSent() both tests and spends the tag, and it used to
  // be called here — before the visibility test and before the native
  // early-return below. On a native shell with the app backgrounded that burned
  // the tag AND a slot of the daily cap while displaying absolutely nothing, and
  // the OS alarm that did the real notifying recorded neither. The spend now
  // happens at each actual display site.
  if (DB.notif.alreadySent(item.tag)) return;
  // The water goal can be met between arming the timer and its firing. Re-check
  // here so a met goal drops the reminder WITHOUT spending the tag — a later
  // slot is then unaffected if the user somehow undoes the log.
  if (item.channel === 'water' && DB.water.get(todayISO()) >= DB.water.goal()) return;

  const { title, body } = DB.notif.text(item);
  if (!title) return;

  const record = (path) => DB.notif.logAdd({
    tag: item.tag, date: item.date || todayISO(), at: item.at,
    channel: item.channel, title, body, path,
  });

  // App visible → the bar, never a system notification.
  if (document.visibilityState === 'visible') {
    if (!DB.notif.markSent(item.tag)) return;    // the atomic compare-and-set
    record('bar');
    showNotifBar({ channel: item.channel, title, body, onOpen: () => notifOpen(item.channel) });
    return;
  }

  // Native shell, app not in front → deliberately nothing here, and NOTHING
  // SPENT. The tag and the cap slot survive for the OS alarm that will actually
  // deliver this, which is armed by Notify.sync() through the Capacitor plugin
  // — the thing that owns the channels, the permissions, the exact-alarm flags
  // and the boot receiver. A JS setTimeout in a backgrounded WebView is not an
  // alarm; sending from here would either do nothing or double up with the real
  // one. The delivery is recorded instead by the plugin's own listener and by
  // Notify.reconcile() on the next foreground.
  if (window.Notify && window.Notify.isNative && window.Notify.isNative()) return;

  // Web, backgrounded, permission already granted. Page-level Notification has
  // no action buttons — those need a service worker — so it carries the text
  // and the tap, which is what §5.1 leaves for this case anyway.
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      if (!DB.notif.markSent(item.tag)) return;
      record('web');
      const n = new Notification(title, {
        body,
        tag: item.tag,
        badge: 'icons/badge-96.png',
        icon: 'icons/cat-' + item.channel + '-192.png',
        silent: item.channel === 'water' || item.channel === 'food',
        lang: DB.prefs.get().lang || 'en',
        dir: (DB.prefs.get().lang === 'ar') ? 'rtl' : 'ltr',
      });
      n.onclick = () => { window.focus(); notifOpen(item.channel); n.close(); };
    }
  } catch (_) {}
}

/**
 * Arm today's remaining reminders. Safe to call as often as you like — it
 * clears every existing timer first, so a settings change re-arms cleanly
 * instead of stacking a second set on top of the first.
 */
function armNotifications() {
  notifTimers.forEach(clearTimeout);
  notifTimers = [];
  // The one-time v208 migration used to run ONLY from inside Notify.sync(),
  // after its `if (!supported()) return` bail — so on the web it never ran at
  // all: STATE.notif stayed null forever while get() kept handing back
  // un-persisted defaults, and every supplement time the user had already
  // configured was silently discarded. This function runs at boot on EVERY
  // platform, and the migration is idempotent (`if (STATE.notif) return false`).
  try { DB.notif.migrateFromReminders(); } catch (_) {}
  let items = [];
  // Today only. A setTimeout cannot outlive the session, so there is nothing to
  // gain from the multi-day horizon here — that is the native path's job.
  try { items = DB.notif.scheduleAll(); } catch (_) { return; }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  items.forEach((it) => {
    const [h, m] = String(it.at).split(':').map(Number);
    if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return;
    const delay = (h * 60 + m - nowMin) * 60000;
    // Past due is NOT fired retroactively. A reminder that arrives hours late
    // is worse than none: it asks for something the moment has passed for, and
    // it spends one of the day's six on nothing.
    if (delay <= 0) return;
    notifTimers.push(setTimeout(() => deliver(it), delay));
  });
  return notifTimers.length;
}

// ===========================================================================
// THE IN-APP NOTIFICATION BAR — APPLY-notifications.md §9
//
// When the app is OPEN a reminder must not become a system notification (§5.1);
// it becomes this. It is also the spec's single template for confirmations and
// errors, so the only things that vary are the icon and, for an error, the
// border colour. There is no green success variant by instruction — the icon
// already carries that — and no close button: three dismiss directions plus the
// 5s timeout are enough, and a button would steal touch area from the
// tap-to-open that is the bar's whole purpose.
//
// This does NOT replace showToast(). The toast grew an action button (the undo
// on a pulled-forward day, v229) and this bar is specified with no buttons at
// all, so folding one into the other would delete an affordance the owner asked
// for. They coexist: the toast is "you did something, here is the way back";
// the bar is "here is something you did not ask for right now".
// ===========================================================================

// One bar on screen at a time (§9.4). Held in a variable rather than queried
// from the DOM so a replacement can still read the outgoing bar's identity
// while it is animating away.
let ntfCurrent = null;
let ntfTimer = null;

const NTF_ICON = {
  train: 'dumbbell', supps: 'pill', water: 'droplet',
  food: 'utensils', streak: 'zap', summary: 'bell',
  ok: 'check', error: 'info',
};

/**
 * @param {{channel?:string, title:string, body?:string,
 *          kind?:'reminder'|'ok'|'error', onOpen?:function}} p
 */
function showNotifBar(p) {
  const host = document.querySelector('.app');
  if (!host || !p || !p.title) return;

  const kind = p.kind || 'reminder';
  const channel = p.channel || (kind === 'error' ? 'error' : 'ok');

  // Same channel, still on screen → swap the words, do not replay the entrance.
  // Re-animating for a changed number is motion carrying no information, and it
  // restarts a countdown the reader may be halfway through.
  if (ntfCurrent && ntfCurrent.el.isConnected && ntfCurrent.channel === channel) {
    ntfCurrent.el.querySelector('.ntf-title').textContent = p.title;
    const b = ntfCurrent.el.querySelector('.ntf-body');
    if (b) b.textContent = p.body || '';
    ntfCurrent.onOpen = p.onOpen;
    ntfArmTimer(ntfCurrent);
    return;
  }

  const spawn = () => ntfMount(host, p, kind, channel);
  if (ntfCurrent && ntfCurrent.el.isConnected) {
    const old = ntfCurrent;
    ntfCurrent = null;
    old.spent = true;
    clearTimeout(ntfTimer);
    old.el.classList.add('is-swap');
    old.el.style.transform = 'translateY(-24px)';
    old.el.style.opacity = '0';
    setTimeout(() => { old.el.remove(); spawn(); }, 120);
  } else {
    spawn();
  }
}

function ntfMount(host, p, kind, channel) {
  clearTimeout(ntfTimer);
  const el = document.createElement('div');
  el.className = 'ntf-bar is-enter' + (kind === 'error' ? ' is-error' : '');
  // An error interrupts; a confirmation must not. `alert` preempts a screen
  // reader mid-sentence, which is right for "no connection" and wrong for
  // "saved" — hence two roles rather than one.
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  el.innerHTML =
    '<span class="ntf-icon">' + icon(NTF_ICON[channel] || 'bell', 22) + '</span>' +
    '<span class="ntf-text"><span class="ntf-title"></span>' +
    (p.body ? '<span class="ntf-body"></span>' : '') + '</span>';
  el.querySelector('.ntf-title').textContent = p.title;
  if (p.body) el.querySelector('.ntf-body').textContent = p.body;
  host.appendChild(el);

  const state = { el, channel, onOpen: p.onOpen, spent: false };
  ntfCurrent = state;

  // Enter from OUTSIDE the top edge, not from just above its resting place: its
  // own top offset plus its height plus 12. Measured, because the height
  // depends on whether there is a body line.
  const rect = el.getBoundingClientRect();
  const from = -(rect.top + rect.height + 12);
  el.style.transform = 'translateY(' + from + 'px)';
  requestAnimationFrame(() => {
    el.classList.add('is-anim');
    el.classList.remove('is-enter');
    el.style.transform = 'translateY(0)';
    el.style.opacity = '1';
  });

  ntfBindGesture(state);
  ntfArmTimer(state);
  return state;
}

// 5s — and the countdown STOPS at the first pointerdown and never resumes.
// Someone who touched the bar is reading it; removing it on a schedule after
// that is the app overruling them.
function ntfArmTimer(state) {
  clearTimeout(ntfTimer);
  ntfTimer = setTimeout(() => ntfDismiss(state, 'y'), 5000);
}

function ntfBindGesture(state) {
  const el = state.el;
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, ty = 0, dragging = false;

  el.addEventListener('pointerdown', (e) => {
    if (state.spent) return;
    clearTimeout(ntfTimer);          // touched → the auto-dismiss is over
    dragging = true;
    x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
    dx = 0; ty = 0;
    el.classList.remove('is-anim', 'is-return');
    // Capture, or a fast drag that leaves the element stops delivering moves
    // and the bar freezes mid-gesture with no pointerup to release it.
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - x0;
    const raw = e.clientY - y0;
    // Up follows the finger 1:1; down is resisted to 14% — it moves just enough
    // to say "not this way" without implying downward is a dismissal.
    ty = raw < 0 ? raw : raw * 0.14;
    el.style.transform = 'translate(' + dx + 'px, ' + ty + 'px)';
    const op = 1 - Math.abs(dx) / 240 - Math.max(0, -ty) / 170;
    el.style.opacity = String(Math.max(0.15, op));
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    const moved = Math.hypot(dx, e.clientY - y0);
    // A tap is small AND quick. Distance alone would call a slow deliberate
    // press a tap; time alone would call a fast flick one.
    if (moved < 5 && Date.now() - t0 < 400) { ntfOpen(state); return; }
    // Both directions dismiss, and the threshold does not flip with the UI
    // language — the gesture is physical, not textual.
    if (Math.abs(dx) > 90) { ntfDismiss(state, 'x', dx > 0 ? 460 : -460); return; }
    if (ty < -56) { ntfDismiss(state, 'y'); return; }
    el.classList.add('is-return');
    el.style.transform = 'translate(0, 0)';
    el.style.opacity = '1';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function ntfOpen(state) {
  const fn = state.onOpen;
  ntfDismiss(state, 'y');
  if (typeof fn === 'function') { try { fn(); } catch (_) {} }
}

function ntfDismiss(state, axis, to) {
  if (!state || state.spent) return;
  state.spent = true;
  clearTimeout(ntfTimer);
  const el = state.el;
  el.classList.remove('is-anim', 'is-return');
  el.classList.add(axis === 'x' ? 'is-outx' : 'is-outy');
  el.style.transform = axis === 'x' ? 'translateX(' + to + 'px)' : 'translateY(-260px)';
  el.style.opacity = '0';
  setTimeout(() => {
    el.remove();
    if (ntfCurrent === state) ntfCurrent = null;
  }, axis === 'x' ? 220 : 200);
}

// call anytime (navigation, view change, before showing a new toast).
function hideToast() {
  const tEl = $('#toast');
  if (!tEl) return;
  clearTimeout(toastTimeout);
  tEl.classList.remove('show');
  tEl.classList.remove('has-action');
  if (tEl.__toastCleanup) { try { tEl.__toastCleanup(); } catch (_) {} tEl.__toastCleanup = null; }
}
// Plain text toast, OR — when `opts.actionLabel`/`opts.onAction` are given — a
// toast with a tappable action (e.g. "Undo"). The action toast is interactive
// only while shown (pointer-events are scoped to `.show` in CSS, and it fully
// tears down on hide) so a dismissed toast can never become an invisible
// tap-blocker. It also pauses its auto-hide while hovered/focused (WCAG 2.2.1).
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
function openModal(innerHtml, { variant = 'sheet', dismissible = true } = {}) {
  const root = $('#modal-root');
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
  overlay.addEventListener('click', (e) => {
    if (!dismissible) return;
    if (e.target === overlay) closeModal();
  });
  overlay.querySelectorAll('[data-close]').forEach((el) => {
    // Every icon-only close button gets a screen-reader name in one place.
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t('close'));
    el.addEventListener('click', () => closeModal());
  });
  // Remember what had focus so we can hand it back on close — otherwise closing a
  // dialog drops focus to <body> and a keyboard/screen-reader user is dumped at
  // the top of the page, losing their place in the list they were working through.
  __modalReturnFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;

  // Move focus into the dialog so keyboard/SR users start inside it (unless a
  // field inside will self-focus via autofocus).
  if (!overlay.querySelector('[autofocus]')) overlay.querySelector('.modal, .confirm-dialog')?.focus();

  // FOCUS TRAP: keep Tab inside the dialog. Without this, tabbing past the last
  // control walks into the page BEHIND the modal — which is still fully
  // interactive — so a keyboard user can silently operate the obscured screen.
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
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
  $('#modal-root').innerHTML = '';
  // Hand focus back to whatever opened the dialog.
  try { if (__modalReturnFocus && document.contains(__modalReturnFocus)) __modalReturnFocus.focus(); } catch (_) {}
  __modalReturnFocus = null;
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
  // Rule 5 + the 11px floor: below legibility the sub-word is dropped rather
  // than shrunk. The guard tested `v` — the VAULT size — instead of `sub`, the
  // size that actually renders, so the header (VAULT 11 → TRAIN 5.5) shipped an
  // illegible 5.5px smudge on five screens in both languages and both themes,
  // while the comment claimed it was protected. Test what renders: splash keeps
  // TRAIN at 16px, the header drops it.
  const showSub = sub >= 11;
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
// VAULT Top Bar
// ==========================================================================
function vaultBar({ action = '', actionLabel = '' } = {}) {
  return `
    <div class="vault-bar">
      <div class="vault-logo">${brandLockup('header')}</div>
      ${action ? `<button class="vault-action" id="vault-action"${actionLabel ? ` aria-label="${escapeHtml(actionLabel)}"` : ''}>${action}</button>` : '<span style="width:40px"></span>'}
    </div>
  `;
}

function bindVaultAction(handler) {
  // Each rendered view stays in the DOM (just hidden). Scope to the active
  // view so we don't bind the handler to a stale vault-action from a previous
  // view — that was making top-bar + buttons fire the wrong action.
  const btn = document.querySelector('.view.active #vault-action');
  if (btn && handler) btn.addEventListener('click', handler);
}

// ==========================================================================
// Router
// ==========================================================================
let currentView = 'home';
let viewContext = {};
// In-app navigation history so the Android hardware back button steps back one
// screen instead of quitting the app. Each entry is { view, context }.
let navStack = [{ view: 'home', context: {} }];

function navigate(view, context = {}, opts = {}) {
  // FLUSH A HALF-TYPED SET BEFORE THE SCREEN CHANGES. The guided-run inputs
  // commit on blur, but navigating away only hides the section — the focused
  // field is not reliably blurred when its container merely gets display:none,
  // so a number typed and then "backed out of" could be lost. Blurring here
  // fires that same commit handler; it is a no-op everywhere else.
  try {
    const ae = document.activeElement;
    if (ae && typeof ae.blur === 'function' && ae.closest?.('.run-set-row')) ae.blur();
  } catch (_) {}

  currentView = view;
  viewContext = context;

  document.querySelector('.img-lightbox')?.remove();
  // The food add-sheet lives on `.app` (not #modal-root) — clear it too so it
  // never lingers over another view after a nav.
  document.getElementById('add-sheet-overlay')?.remove();
  // Tear down the guided-workout rest timer so it never lingers over other views.
  if (typeof clearRestTimer === 'function') clearRestTimer();
  // Dismiss any lingering toast (e.g. an "Undo set" action toast) — its action
  // is scoped to the view it was raised from, so leaving cancels it.
  if (typeof hideToast === 'function') hideToast();

  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  // Publish the active view on <body>: .bottom-nav is a SIBLING of <main>, so
  // nothing rooted at .view can select it, and the guided-run screen needs to
  // opt out of the keyboard-open nav hide (see styles.css).
  document.body.dataset.view = view;

  // Which bottom-nav tab stays lit on a child screen. Everything reached FROM the
  // Program tab points back at it — the rotation editor and the records list moved
  // there out of Home's tool rail, and the exercise browser plus the muscle history
  // are only reachable through it now.
  const navMap = {
    home: 'home', workouts: 'workouts',
    exercises: 'workouts', 'exercise-detail': 'workouts', 'custom-exercises': 'workouts',
    planner: 'workouts', 'personal-records': 'workouts', 'muscle-sessions': 'workouts',
    cardio: 'cardio', food: 'food', sleep: 'sleep',
    compare: 'home', settings: 'home', calendar: 'home', supplements: 'home', foodlog: 'food',
    day: 'home', notifications: 'home',
  };
  const highlightView = navMap[view] || view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === highlightView));

  renderView(view);
  $('.main').scrollTop = 0;

  // Record the step for the back button — unless we got here BY going back.
  if (!opts.fromPop) {
    // Don't stack a duplicate of the screen we're already on. Tapping the bottom
    // nav re-navigates with an EMPTY context, so tab-hopping (Train → Food → Home
    // → Food …) used to push an entry every time — turning the Android hardware
    // back button into a dozens-of-presses walk before the app would exit, and
    // pinning every visited view's context (including whole session runState
    // objects) in memory for the life of the process.
    const top = navStack[navStack.length - 1];
    const isDupRoot = top && top.view === view && Object.keys(context || {}).length === 0
      && Object.keys(top.context || {}).length === 0;
    if (!isDupRoot) {
      navStack.push({ view, context });
      // Hard cap: a pathological session can't grow this without bound. Keep the
      // root entry so goBack() can still reach home.
      if (navStack.length > 40) navStack.splice(1, navStack.length - 40);
      try { history.pushState({ depth: navStack.length }, ''); } catch (_) {}
    }
  }
}

// Step back one screen inside the app. Returns true if it handled the back,
// false if we're at the root (caller should exit the app). A modal — or the
// auth gate — is dismissed first; otherwise we pop the nav history.
function goBack() {
  // A full-screen image lightbox lives on document.body (outside #modal-root),
  // so dismiss it first — otherwise "back" would navigate underneath it.
  const lb = document.querySelector('.img-lightbox');
  if (lb) { lb.remove(); return true; }
  // The food add-sheet lives on `.app`, not #modal-root — close it first so
  // "back" dismisses the sheet instead of popping the view (or exiting the app).
  const addSheet = document.getElementById('add-sheet-overlay');
  if (addSheet) { addSheet.remove(); return true; }
  if ($('#modal-root') && $('#modal-root').innerHTML.trim()) { closeModal(); return true; }
  if (document.getElementById('auth-gate')) return true; // don't slip behind login
  if (navStack.length > 1) {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    navigate(prev.view, prev.context, { fromPop: true });
    return true;
  }
  return false; // at the root (home)
}

// Browser back button (works in the web/preview). On Android the hardware back
// button does NOT drive web history, so it is wired separately below.
window.addEventListener('popstate', () => {
  if (goBack()) { try { history.pushState({ depth: navStack.length }, ''); } catch (_) {} }
});

// The cloud layer blocked a push that would have wiped a data-ful cloud backup
// with an empty local blob (e.g. right after a Reset). Reassure the user their
// backup is intact instead of leaving the divergence silent.
// A push was REFUSED because the row moved ahead of this device (another device,
// or this one after a missed pull). cloud.js correctly declines to clobber the
// newer copy — but it dispatched that decision to NOBODY, so the only place a
// conflict ever surfaced was bootSync at the next COLD start, which on a
// live-URL shell can be days away. In between, every push conflicts identically
// and the user is told nothing.
//
// NOT a modal: this can fire mid-set. A toast that offers the resolution, and a
// latch so the settings screen can keep showing it after the toast is gone.
let __conflictPending = false;
window.addEventListener('vault:push-conflict', () => {
  __conflictPending = true;
  try {
    showToast(t('sync_conflict_toast'), {
      actionLabel: t('sync_resolve'),
      duration: 8000,
      onAction: () => showConflictDialog(),
    });
  } catch (_) {}
});

window.addEventListener('vault:push-blocked', () => {
  try { showToast(t('cloud_backup_kept')); } catch (_) {}
});

// GLOBAL ERROR VISIBILITY.
//
// The app has ~77 empty `catch (_) {}` blocks and shipped for 189 builds with no
// error handler at all — and because every device loads the same live URL, a bad
// push reaches everyone at once with no signal back. These two listeners catch
// what escapes to the top level and hand it to Cloud.reportError (fire-and-forget,
// self-rate-limited, only for signed-in users, no user content).
//
// They deliberately do NOT show the user anything: an error toast on every stray
// rejection would be worse than the silence it replaces.
window.addEventListener('error', (e) => {
  try {
    if (!window.Cloud || !Cloud.reportError) return;
    const msg = (e && (e.message || (e.error && e.error.message))) || 'unknown error';
    Cloud.reportError('error', msg, e && e.filename, e && e.lineno);
  } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    if (!window.Cloud || !Cloud.reportError) return;
    const r = e && e.reason;
    const msg = (r && (r.message || String(r))) || 'unhandled rejection';
    Cloud.reportError('unhandledrejection', msg, null, null);
  } catch (_) {}
});

// Download the whole store as a JSON backup. Extracted from the Settings button
// so the storage-failure dialog can offer it too — that is the one moment the
// user most needs a copy off this device.
function exportBackupFile() {
  const json = DB.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = todayISO();  // local date — toISOString() would name the file with yesterday's date after ~21:00 in UTC+3
  a.href = url;
  a.download = `vault-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(t('export_data'));
}

// A write to localStorage failed — storage full, or the store is unreadable and
// we are deliberately running READ-ONLY. Either way the user MUST be told: the
// silent version of this looks like a working app that saves nothing, and every
// set logged afterwards is lost on reload.
// ONE alert per session was wrong. A full store does not heal itself: every
// write after the first keeps failing, and every one of them was silent — the
// app looked like it was working and saved nothing, which is exactly the
// "sometimes what I added disappears" report. Throttled, not spent: quiet for a
// minute so a render loop cannot spam, then it speaks again, because the next
// set the user logs is being lost too.
let __storageAlertedAt = 0;
window.addEventListener('vault:save-failed', (e) => {
  const now = Date.now();
  if (now - __storageAlertedAt < 60000) return;
  __storageAlertedAt = now;
  const quota = !!(e && e.detail && e.detail.quota);
  try {
    confirmDialog({
      title: t('storage_error_title'),
      text: quota ? t('storage_full_text') : t('storage_write_failed_text'),
      confirmLabel: t('export_data'),
      variant: 'danger',
      onConfirm: () => { try { exportBackupFile(); } catch (_) {} },
    });
  } catch (_) {
    try { showToast(t('storage_error_title')); } catch (__) {}
  }
});
window.addEventListener('vault:load-failed', () => {
  if (__storageAlerted) return;
  __storageAlerted = true;
  try {
    confirmDialog({
      title: t('storage_error_title'),
      text: t('storage_unreadable_text'),
      confirmLabel: t('close'),
      variant: 'danger',
      onConfirm: () => {},
    });
  } catch (_) {}
});

// Android hardware back button via the @capacitor/app plugin → same goBack(),
// and exit the app only at the root screen.
(function wireHardwareBack() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App || !App.addListener) return;
  App.addListener('backButton', () => {
    if (!goBack()) App.exitApp();
  });
})();

// iOS-style large-title behaviour: the sticky top bar shows its small title only
// AFTER the big <h1 class="page-title"> has scrolled out of view — so at the top
// of the page you never see the same title twice (big header + bar). Pages that
// have a bar but NO page-title (e.g. exercise-detail hero) keep the bar title
// always visible, since it's their only title.
function syncDetailTopTitle() {
  const view = document.querySelector('.view.active');
  const bar = view && view.querySelector('.detail-top');
  const barTitle = bar && bar.querySelector('.detail-top-title');
  if (!barTitle) return;
  const pageTitle = view.querySelector('.page-title');
  // Only collapse the bar title when it's REDUNDANT with the big page title
  // (same text). Pages whose bar shows something different (e.g. session-day's
  // weekday vs the workout name) — or that have no page title at all — keep the
  // bar title always visible.
  const redundant = pageTitle && pageTitle.textContent.trim() === barTitle.textContent.trim();
  if (!redundant) { bar.classList.add('show-title'); return; }
  const main = document.querySelector('.main');
  const threshold = (main ? main.getBoundingClientRect().top : 0) + 44; // bar height
  bar.classList.toggle('show-title', pageTitle.getBoundingClientRect().bottom <= threshold);
}

// Auto-hide the detail header (any bar with a back button): tuck it away while
// scrolling down, slide it back smoothly when scrolling up. One listener on the
// scroll container drives whichever view is active.
(function wireDetailTopAutoHide() {
  const main = document.querySelector('.main');
  if (!main) return;
  let lastY = 0;
  main.addEventListener('scroll', () => {
    const y = main.scrollTop;
    const bar = document.querySelector('.view.active .detail-top');
    if (bar) {
      const tuck = y > lastY && y > 64;                      // down & past the top → hide
      bar.classList.toggle('tuck', tuck);
      bar.inert = tuck;                                       // keep the hidden back button out of the tab order / AT
    }
    syncDetailTopTitle();
    lastY = y <= 0 ? 0 : y;
  }, { passive: true });
})();

function renderView(view) {
  const el = $(`.view[data-view="${view}"]`);
  // Unknown view → fall back to home instead of leaving a blank screen with no way
  // out. Reachable in one real way: a pushState entry in someone's history that
  // names a view a later build removed.
  if (!el) { if (view !== 'home') navigate('home', {}, { fromPop: true }); return; }
  switch (view) {
    case 'home': renderHome(el); break;
    // 'workouts' is the Program tab; the exercise browser is 'exercises' (which
    // took over the <section> slot of the old, unreachable 'library' view).
    case 'workouts': renderProgram(el); break;
    case 'exercises': renderExercises(el); break;
    case 'exercise-detail': renderExerciseDetail(el, viewContext.exerciseId); break;
    case 'cardio': renderCardio(el); break;
    case 'food': renderFood(el); break;
    case 'sleep': renderSleep(el); break;
    case 'compare': renderCompare(el); break;
    case 'settings': renderSettings(el); break;
    case 'planner': renderPlanner(el); break;
    case 'calendar': renderCalendar(el); break;
    case 'supplements': renderSupplements(el); break;
    case 'notifications': renderNotifications(el); break;
    case 'foodlog': renderFoodLog(el); break;
    case 'session-day': renderSessionDay(el); break;
    case 'session-run': renderSessionRun(el); break;
    case 'personal-records': renderPersonalRecords(el); break;
    case 'muscle-sessions': renderMuscleSessions(el); break;
    case 'custom-exercises': renderCustomExercises(el); break;
    case 'day': renderDay(el); break;
  }
  // Give every icon-only back button an accessible name, in one place.
  el.querySelectorAll('.back-btn:not([aria-label])').forEach((b) => b.setAttribute('aria-label', t('back')));
  // Set the sticky bar title's initial visibility for this freshly-rendered view.
  requestAnimationFrame(syncDetailTopTitle);
}

$('#bottom-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn) navigate(btn.dataset.view);
});

document.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) {
    e.preventDefault();
    navigate(goto.dataset.goto);
  }
});

// A back control that returns to the previous screen (wherever we came from),
// instead of a fixed destination.
document.addEventListener('click', (e) => {
  const back = e.target.closest('[data-back]');
  if (back) { e.preventDefault(); goBack(); }
});

// Escape closes the top-most transient layer (image lightbox, then modal) —
// keyboard parity with tapping the backdrop / hardware back.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const lb = document.querySelector('.img-lightbox');
  if (lb) { lb.remove(); return; }
  const root = $('#modal-root');
  // The GLOBAL Escape handler is a second door into closeModal() and would have
  // walked straight past the modal's own guard.
  if (root && root.querySelector('.modal-overlay[data-dismissible="0"]')) return;
  if (root && root.innerHTML.trim()) closeModal();
});

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

// ==========================================================================
// Personal Records helper
// ==========================================================================
function checkPR(exerciseId, prior, newSets) {
  // Cold-start: no toast on the very first session ever
  if (prior.sessionCount === 0) return null;

  // Compute new max weight and best Epley 1RM from the sets just saved
  let newMaxW = 0;
  let newBestORM = 0;
  newSets.forEach((s) => {
    if (s.weight > newMaxW) newMaxW = s.weight;
    if (s.reps > 0 && s.weight > 0) {
      const orm = s.weight * (1 + s.reps / 30);
      if (orm > newBestORM) newBestORM = orm;
    }
  });

  // Re-read the post-write snapshot
  const postBest = DB.sessions.prSnapshot(exerciseId);

  const wPR = postBest.maxWeight > prior.maxWeight && newMaxW >= postBest.maxWeight;
  const ormPR = postBest.bestORM > prior.bestORM && newBestORM >= postBest.bestORM;

  if (!wPR && !ormPR) return null;

  if (wPR && ormPR) {
    return t('pr_both') + ' ' + fmtWeight(postBest.maxWeight) + unitLabel()
      + ' · ' + t('pr_est_orm') + ' ' + fmtWeight(Math.round(postBest.bestORM)) + unitLabel();
  }
  if (wPR) {
    return t('pr_weight') + ' ' + fmtWeight(postBest.maxWeight) + unitLabel();
  }
  // ormPR only
  return t('pr_orm') + ' ' + t('pr_est_orm') + ' ' + fmtWeight(Math.round(postBest.bestORM)) + unitLabel();
}

// `sessions`/`cardio` are OPTIONAL and exist only so a caller that already holds
// those arrays can hand them over instead of paying for another copy+sort — this
// is called from renderHome, which has both in scope. Order is irrelevant here
// (everything goes straight into a Set of dates), so an unsorted array is fine.
function computeStreak(sessions, cardio) {
  sessions = sessions || DB.sessions.listAll();
  cardio = cardio || DB.cardio.list();
  const activeDates = new Set();
  sessions.forEach((s) => activeDates.add(s.date));
  cardio.forEach((c) => activeDates.add(c.date));
  if (activeDates.size === 0) return 0;

  let streak = 0;
  // Anchor and step entirely in LOCAL calendar-date space (todayISO / addDaysISO)
  // so it matches how activeDates is keyed (session/cardio .date are stored via
  // todayISO()). Using new Date().toISOString() here converted local-midnight to
  // UTC, shifting the anchor a day back in any timezone east of UTC (owner is
  // UTC+3), which made today's workout never match and undercounted the streak.
  let iso = todayISO();
  // If today has no activity yet, the streak is still alive counting from yesterday.
  if (!activeDates.has(iso)) iso = addDaysISO(iso, -1);

  while (activeDates.has(iso)) {
    streak += 1;
    iso = addDaysISO(iso, -1);
  }
  return streak;
}


function weekRanges() {
  const thisStart = startOfWeek(new Date());
  const thisEnd = new Date(thisStart); thisEnd.setDate(thisEnd.getDate() + 7);
  const lastStart = new Date(thisStart); lastStart.setDate(lastStart.getDate() - 7);
  const lastEnd = new Date(thisStart);
  return { thisStart, thisEnd, lastStart, lastEnd };
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

// ==========================================================================
// HOME VIEW
// ==========================================================================
function renderHome(el) {
  const now = new Date();
  const { thisStart, thisEnd } = weekRanges();

  const allSessions = DB.sessions.listAll();
  const weekSessions = allSessions.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
  const weekSetsCount = weekSessions.reduce((sum, s) => sum + s.sets.length, 0);
  const weekWorkoutDays = new Set(weekSessions.map((s) => s.date)).size;

  const allCardio = DB.cardio.list();
  const weekCardio = allCardio.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const cardioMinutes = weekCardio.reduce((sum, c) => sum + c.duration, 0);

  const lastSleep = DB.sleep.latest();
  // Home shows TODAY's TOTAL sleep (sum of every entry dated today — night +
  // any naps), formatted as "Xh Ym" — not one session shown as a confusing
  // decimal like "5.8".
  const sleepTodayMin = DB.sleep.list()
    .filter((s) => s.date === todayISO())
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  const streak = computeStreak(allSessions, allCardio);
  // First-run / empty signal — used to suppress the "wall of zeros" on Home.
  const hasAnyActivity = allSessions.length > 0 || allCardio.length > 0 || !!lastSleep;

  const hour = now.getHours();
  const greeting = hour < 12 ? t('greet_morning') : hour < 18 ? t('greet_afternoon') : t('greet_evening');
  const lang = DB.prefs.get().lang || 'en';
  const dayLabel = now.toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // The muscle heatmap moved to the Program tab (renderProgram) — it answers
  // "is my volume balanced across muscles", which is a programme question, and
  // keeping a second copy here is the duplication this redesign removed.
  const exercises = DB.exercises.list();

  // The LAST SET, not a mixed recent-activity feed. Two things were wrong with
  // that feed: it interleaved workouts, cardio and sleep (all three already have
  // their own cell in the stat strip above), and its workout row showed the
  // session's HEAVIEST weight — never the set actually performed last, which is
  // the number you want when you pick the bar back up.
  //
  // listAll() is newest-first, and a session's `sets` stay in the order they were
  // performed, so the last element of the newest non-empty session IS that set.
  const lastSession = allSessions.find((s) => s.sets && s.sets.length);
  const lastSet = lastSession ? lastSession.sets[lastSession.sets.length - 1] : null;
  const lastSetEx = lastSession ? DB.exercises.getById(lastSession.exerciseId) : null;

  const recentHtml = !lastSet ? '' : `
    <div class="section-title">${t('last_set')}</div>
    <button class="last-set-card" data-open-exercise="${escapeHtml(lastSession.exerciseId)}">
      <div class="last-set-top">
        <span class="last-set-icon" aria-hidden="true">${icon('dumbbell', 20)}</span>
        <span class="last-set-name">${escapeHtml(lastSetEx ? exDisplayName(lastSetEx) : t('workouts'))}</span>
      </div>
      <div class="last-set-figure">
        ${lastSet.weight > 0 ? `
          <span class="num">${fmtWeight(lastSet.weight)}</span><span class="last-set-unit">${unitLabel()}</span>
          <span class="last-set-x" aria-hidden="true">×</span>` : ''}
        <span class="num">${fmtNum(lastSet.reps)}</span><span class="last-set-unit">${t('reps')}</span>
      </div>
      <div class="last-set-meta">${t('set_label')} ${fmtNum(lastSession.sets.length)} · ${escapeHtml(daysAgoLocalized(lastSession.date))}</div>
    </button>
  `;

  // Twin of the workout hero, for nutrition. Same three-state shape: nothing set
  // up yet -> an invitation; set up -> today's number and how far through it you
  // are. Both land on the Food view, which already owns the goal setup, so this
  // card never has to duplicate that flow.
  const foodHeroHtml = (() => {
    if (!DB.nutrition.hasTargets()) {
      return `
        <button class="hero-card hero-first hero-food" id="home-food-hero">
          <div class="hero-eyebrow">${t('calories')}</div>
          <div class="hero-first-title">${t('nutri_setup_title')}</div>
          <div class="hero-first-sub">${t('nutri_setup_text')}</div>
          <div class="hero-cta">${icon('target', 20)}<span>${t('nutri_setup_cta')}</span></div>
        </button>`;
    }
    const tgt = DB.nutrition.get().targets;
    const eaten = DB.foodLogs.totalsForDate(todayISO());
    const left = Math.round(tgt.calories - eaten.calories);
    const over = left < 0;
    const pct = tgt.calories > 0 ? Math.min(100, Math.round((eaten.calories / tgt.calories) * 100)) : 0;
    return `
      <button class="hero-card hero-food" id="home-food-hero">
        <div class="hero-eyebrow">${t('calories')} · ${t('today')}</div>
        <div class="hero-numeral num ${over ? 'over' : ''}">${fmtNum(Math.abs(left))}</div>
        <div class="hero-meta">${over ? t('nutri_over') : t('nutri_left')} · <span class="num">${fmtNum(Math.round(eaten.calories))}</span> / <span class="num">${fmtNum(tgt.calories)}</span> ${t('cal')}</div>
        <div class="hero-bar"><span class="hero-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></span></div>
        <div class="hero-cta">${icon('utensils', 20)}<span>${t('food')}</span></div>
      </button>`;
  })();

  const streakUnit = streak === 1 ? t('streak_one_day') : t('streak_days');
  const streakLabel = streak > 0 ? t('streak_active') : t('streak_start');

  // Hero "Today" card — the flagship element of the redesigned home.
  // Plan scheduled today → plan name + muscles + a bold Start CTA.
  // No plan → this week's set count as a large count-up numeral.
  // workoutForDate already returns null for a day the user marked off, so ask
  // separately whether THAT is why — a declined day and an ordinary rest weekday
  // look identical from the return value but must not read the same on screen.
  const todayIsOff = DB.plan.isRest(now);
  const todayPlan = DB.plan.workoutForDate(now);   // continuous rotation → today's slot
  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const hasPlanToday = !!(todayPlan && todayPlan.exerciseIds && todayPlan.exerciseIds.length > 0);
  // Any plan at all (a non-empty rotation cycle)? Distinct from "a workout today"
  // — a plan can exist but land on a rest day. When there is NO plan, the Start
  // CTA sends the user to build/pick one instead of into an empty session.
  const planState = DB.plan.get();
  const hasAnyPlan = !!(planState && Array.isArray(planState.cycle) && planState.cycle.length > 0);

  // THE CONTROL — "Vault Rest Day" spec, option C (this superseded option A,
  // the split bar, which shipped in v218).
  //
  // Rest is pulled OUT of the action row entirely and pinned to the card's far
  // corner, beside the eyebrow: the furthest point on the card from the thumb's
  // arc, so it is hard to hit by accident and easy to find when looked for.
  // The workout button gets its full width back and becomes the only call on
  // the screen with nothing competing on its row.
  //
  // It carries a GREY border and no fill — all the orange belongs to training.
  // That makes it read as a status tag rather than a second button, which is
  // the intent, and it is why the capsule radius is allowed here: the identity
  // layer reserves capsules for TRANSIENT chips and forbids them on anything
  // holding state, which this does not.
  // Home does NOT carry the undo for a pulled-forward day. Undoing one moves the
  // whole rotation back, which is a PLAN edit, and the Program tab owns the
  // plan; Home's single job is starting today. The undo lives in the toast for
  // as long as it is up, and after that under "Where you are" in Program, next
  // to the cycle position it actually shifted.
  const restChipHtml =
    `<button class="rest-chip" id="home-rest-toggle" type="button">${t('rest_short')}</button>`;
  const fullCtaHtml = `
    <button class="hero-cta hero-cta-btn" id="home-start-workout" type="button">
      ${icon('dumbbell', 20)}<span>${t('today_workout')}</span>
    </button>`;

  const weekStripHtml = weekStrip(null, '', allSessions, allCardio);

  // TWO KINDS OF REST DAY, and they are not the same thing.
  //   · DECLINED  — the plan had a workout and the user said no. The way out is
  //     undo, because nobody needs persuading INTO training.
  //   · SCHEDULED — the plan itself says rest. There is nothing to undo, so the
  //     way out is the "train anyway" sheet, which offers something light that
  //     does not borrow from tomorrow.
  // Until now a scheduled rest day fell through to the week-count hero and said
  // nothing about rest at all.
  const scheduledRest = !todayIsOff && hasAnyPlan && !hasPlanToday && !DB.plan.workoutForDate(now);

  // SECTION 03 — THE ROW AFTER THE DECISION. A reduced session that has been
  // logged gets its own state: it is not "today is off", it is "minimum effort,
  // done", and the spec is explicit that it carries no reproach and no red mark.
  // allSessions is already in hand from the top of this render — listAll()
  // here was a fourth full copy+sort of the same array for a single filter.
  const minToday = allSessions
    .filter((s) => s.date === todayISO() && s.kind === 'minimum');

  let heroHtml = '';
  if (minToday.length) {
    const mins = minToday.length * 10;
    const what = minToday.length === 1 ? t('rest_min_one') : t('rest_min_half');
    heroHtml = `
      <div class="hero-card hero-rest">
        <div class="hero-eyebrow">${t('rest_day')} · ${escapeHtml(dayName(now.getDay(), true))}</div>
        <div class="hero-title">${t('min_logged')}</div>
        <div class="hero-meta">${escapeHtml(
          t('min_logged_sub').replace('{what}', what).replace('{n}', fmtNum(mins)))}</div>
      </div>
    `;
  } else if (todayIsOff || scheduledRest) {
    // Declined day. Say what it cost — nothing — because the whole reason the
    // rotation is continuous is that a missed day postpones rather than forfeits.
    const nextUp = (() => {
      const d = new Date(now);
      for (let i = 1; i <= 14; i++) {
        d.setDate(d.getDate() + 1);
        const w = DB.plan.workoutForDate(d);
        if (w) return { name: w.name, day: dayName(d.getDay(), true) };
      }
      return null;
    })();
    // THE INVERTED STATE. A rest day does not leave the screen empty: the same
    // slot turns around and offers the opposite. The solid orange disappears and
    // becomes an outline only — per the spec, "a filled colour promises a task,
    // and today there is no task". The undo stays available for the whole day.
    // TWO ROWS FROM SECTION 03, and the spec words them differently.
    //   SCHEDULED — "يوم راحة / لا يوجد عضلات مجدولة", the note, and the outline
    //     CTA. The solid orange drops to a line: a filled colour promises a
    //     task and today has none.
    //   REST LOGGED — "يوم راحة / نشوفك بكرة — بالخطة نفسها" and an Undo that
    //     stays visible the rest of the day. No reproach, no red mark.
    heroHtml = `
      <div class="hero-card hero-rest">
        <div class="hero-eyebrow">${t('rest_day')} · ${escapeHtml(dayName(now.getDay(), true))}</div>
        <div class="hero-title">${t('rest_today_title')}</div>
        <div class="hero-meta">${scheduledRest
          ? t('rest_day_muscles')
          : t('rest_logged_sub')}</div>
        ${scheduledRest ? `
        <div class="rest-note">
          <span class="rest-note-icon">${icon('bed', 22)}</span>
          <span>${t('rest_is_the_plan')}</span>
        </div>
        <button class="hero-ghost-cta" id="home-train-anyway" type="button">
          ${icon('dumbbell', 20)}<span>${t('train_anyway')}</span>
        </button>` : `
        <button class="hero-ghost-cta" id="home-undo-rest" type="button">
          ${icon('refresh', 20)}<span>${t('rest_undo')}</span>
        </button>`}
      </div>
    `;
  } else if (hasPlanToday) {
    const exObjs = todayPlan.exerciseIds.map((id) => exerciseById[id]).filter(Boolean);
    const muscles = groupMusclesFromExercises(exObjs);
    const sideRow = (label, keys, sideClass) => keys.length === 0 ? '' : `
      <div class="planner-side ${sideClass}">
        <span class="planner-side-label">${escapeHtml(label)}</span>
        <div class="planner-muscle-chips">
          ${keys.map((k) => `<span class="muscle-chip ${sideClass}">${escapeHtml(t('muscle_' + k))}</span>`).join('')}
        </div>
      </div>
    `;

    heroHtml = `
      <div class="hero-card">
        <div class="hero-eyebrow-row">
          <div class="hero-eyebrow">${t('today_plan')} · ${escapeHtml(dayName(now.getDay(), true))}</div>
          ${restChipHtml}
        </div>
        <div class="hero-title">${escapeHtml(todayPlan.name || t('start_workout'))}</div>
        <div class="hero-meta">${fmtNum(exObjs.length)} ${exObjs.length === 1 ? t('exercise') : t('exercises')} · ${fmtNum(weekSetsCount)} ${t('sessions_this_week')}</div>
        <div class="planner-day-muscles">
          ${sideRow(t('anterior'), muscles.anterior, 'anterior')}
          ${sideRow(t('posterior'), muscles.posterior, 'posterior')}
        </div>
        ${fullCtaHtml}
      </div>
    `;
  } else if (weekSetsCount > 0) {
    // Active this week but no plan today → keep the week count, but the CTA opens
    // today's session directly (session-day handles an empty/rest day itself).
    heroHtml = `
      <button class="hero-card" id="home-start-workout">
        <div class="hero-eyebrow">${t('this_week')} · ${escapeHtml(dayName(now.getDay(), true))}</div>
        <div class="hero-numeral num anim" data-count="${weekSetsCount}">0</div>
        <div class="hero-meta">${t('sessions_this_week')}</div>
        <div class="hero-cta">${icon('dumbbell', 20)}<span>${t('today_workout')}</span></div>
      </button>
    `;
  } else {
    // First run / inactive: no wall of zeros — one inviting CTA straight into today.
    heroHtml = `
      <button class="hero-card hero-first" id="home-start-workout">
        <div class="hero-eyebrow">${escapeHtml(dayName(now.getDay(), true))}</div>
        <div class="hero-first-title">${t('first_workout_title')}</div>
        <div class="hero-first-sub">${t('first_workout_sub')}</div>
        <div class="hero-cta">${icon('dumbbell', 20)}<span>${t('start_first_workout')}</span></div>
      </button>
    `;
  }

  el.innerHTML = `
    ${vaultBar({ action: icon('settings', 19), actionLabel: t('settings_title') })}

    <div class="home-head">
      <div class="home-head-text">
        <div class="home-hello">${escapeHtml(dayLabel)}</div>
        <div class="home-hero">${greeting}.</div>
      </div>
      ${streak > 0 ? `<button class="streak-chip" data-goto="calendar" aria-label="${escapeHtml(streakLabel)}">
        ${icon('flame', 16)}<span class="num">${streak}</span><span class="streak-chip-unit">${streakUnit}</span>
      </button>` : ''}
    </div>

    ${weekStripHtml}

    ${heroHtml}


    ${foodHeroHtml}

    ${hasAnyActivity ? `<div class="stat-strip">
      <button class="stat-cell" data-goto="workouts">
        <div class="stat-cell-value num"><span class="anim" data-count="${weekWorkoutDays}">0</span></div>
        <div class="stat-cell-label">${t('sessions_label')}</div>
      </button>
      <button class="stat-cell" data-goto="cardio">
        <div class="stat-cell-value num"><span class="anim" data-count="${cardioMinutes}">0</span><span class="unit">${t('unit_min')}</span></div>
        <div class="stat-cell-label">${t('cardio')}</div>
      </button>
      <button class="stat-cell" data-goto="sleep">
        <div class="stat-cell-value num">${sleepTodayMin > 0 ? escapeHtml(formatDuration(sleepTodayMin)) : '—'}</div>
        <div class="stat-cell-label">${t('sleep_today')}</div>
      </button>
    </div>` : ''}

    ${weightCardHtml()}

    ${typeof Health !== 'undefined' ? Health.homeSectionHtml() : ''}

    <div class="section-title">${t('tools_section')}</div>
    <div class="tool-rail">
      <!-- The plan and records pods moved to the Program tab, which now owns both.
           Calendar takes a pod because its only other entry point is the streak
           chip, which is not rendered at all while the streak is 0 — so a new
           user could not reach the calendar. -->
      <button class="tool-pod" data-goto="calendar">
        <div class="tool-pod-icon">${icon('calendar', 20)}</div>
        <div class="tool-pod-label">${t('calendar_title')}</div>
      </button>
      <button class="tool-pod" data-goto="compare">
        <div class="tool-pod-icon">${icon('columns', 20)}</div>
        <div class="tool-pod-label">${t('compare_card')}</div>
      </button>
      <button class="tool-pod" data-goto="supplements">
        <div class="tool-pod-icon">${icon('pill', 20)}</div>
        <div class="tool-pod-label">${t('supplements_card')}</div>
      </button>
    </div>

    ${recentHtml}

    <div style="text-align:center;opacity:.4;font-size:12px;margin:24px 0 8px;letter-spacing:.5px">VAULT · ${VAULT_BUILD}</div>
  `;

  // Count-up the hero/stat numerals (sleep is stored ×10 for one decimal)
  el.querySelectorAll('.anim[data-count]').forEach((n) => {
    const target = parseInt(n.dataset.count, 10) || 0;
    const fixed = n.dataset.fixed === '1';
    animateNum(n, target, fixed ? { fmt: (v) => (v / 10).toFixed(1) } : undefined);
  });

  bindVaultAction(() => navigate('settings'));
  // "Start Workout" hero card → straight into today's session logging.
  // Recompute the day at click time so it stays correct if Home was left open
  // across midnight.
  $('#home-start-workout', el)?.addEventListener('click', () => {
    // No plan set up yet → open the plan/schedules screen so the user picks a
    // ready-made plan or builds one, instead of landing in an empty session.
    if (!hasAnyPlan) { navigate('planner'); return; }
    navigate('session-day', { date: todayISO() });
  });
  // "Rest" no longer marks the day silently — it opens the sheet, which argues
  // one point and then offers a middle option. The day is only marked off if the
  // user chooses it there.
  // THE SHEET ARGUES ITS CASE ONCE A DAY. A second tap on Rest logs the day
  // straight away instead of replaying the same paragraph — repeating an
  // argument the user has already heard and rejected turns advice into nagging,
  // and nagging gets dismissed without reading. The gate lived in storage from
  // the start; nothing was calling it.
  $('#home-rest-toggle', el)?.addEventListener('click', () => {
    if (DB.plan.restPromptedToday()) {
      DB.plan.setRest(new Date(), true);
      showToast(t('rest_today_on'));
      renderView('home');
      return;
    }
    openRestSheet();
  });
  $('#home-train-anyway', el)?.addEventListener('click', () => openTrainAnywaySheet());
  // The inverted state's way back. Straight undo, no argument — nobody needs
  // persuading INTO training.
  $('#home-undo-rest', el)?.addEventListener('click', () => {
    DB.plan.setRest(new Date(), false);
    showToast(t('rest_today_off'));
    renderView('home');   // NOT renderHome() — it needs its view element
  });
  // One delegated listener for all seven chips rather than seven bindings.
  $('.wk-rail', el)?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-day]');
    if (chip) navigate('day', { dayDate: chip.dataset.day });
  });

  $('#home-food-hero', el)?.addEventListener('click', () => navigate('food', { openAdd: true }));
  const lastSetCard = $('.last-set-card', el);
  if (lastSetCard) lastSetCard.addEventListener('click', () =>
    navigate('exercise-detail', { exerciseId: lastSetCard.dataset.openExercise }));
  if (typeof Health !== 'undefined') Health.bindHomeSection();
  $('#home-weight', el)?.addEventListener('click', () => openWeightSheet());
}

// ==========================================================================
// Body-weight tracking — a per-day weight log with a trend chart. A signature
// feature of every serious nutrition/fitness app. Fully local (DB.bodyweight),
// kg-canonical, shown in the user's chosen unit.
// ==========================================================================
function weightSparkline(entries) {
  if (!entries || entries.length < 2) return '';
  const vals = entries.map((e) => e.kg);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const W = 64, H = 28, P = 3;
  const stepX = (W - P * 2) / (entries.length - 1);
  const coords = entries.map((e, i) => ({
    x: P + i * stepX,
    y: P + (H - P * 2) * (1 - (e.kg - min) / span),
  }));
  const d = coords.map((c, i) => (i === 0 ? `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` : `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)).join(' ');
  const last = coords[coords.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="weight-spark-svg" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5" fill="var(--accent)"/>
  </svg>`;
}

function weightCardHtml() {
  const entries = DB.bodyweight.list();
  const latest = entries.length ? entries[entries.length - 1] : null;
  let deltaHtml = '';
  if (entries.length >= 2) {
    const dKg = latest.kg - entries[entries.length - 2].kg;
    if (dKg !== 0) {
      const dir = dKg > 0 ? 'up' : 'down';
      const sign = dKg > 0 ? '+' : '−';
      deltaHtml = `<span class="weight-delta ${dir}">${sign}${fmtNum(convertWeightForDisplay(Math.abs(dKg)))} ${unitLabel()}</span>`;
    }
  }
  const spark = weightSparkline(entries.slice(-12));
  return `
    <button class="weight-card" id="home-weight">
      <div class="weight-card-icon icon-mirror">${icon('trendLine', 20)}</div>
      <div class="weight-card-main">
        <div class="weight-card-label">${t('bodyweight')}</div>
        <div class="weight-card-value">
          ${latest
            ? `<span class="num">${fmtWeight(latest.kg)}</span><span class="weight-card-unit">${unitLabel()}</span>${deltaHtml}`
            : `<span class="weight-card-empty">${t('weight_add_first')}</span>`}
        </div>
      </div>
      ${spark ? `<div class="weight-card-spark">${spark}</div>` : `<div class="weight-card-add">${icon('plus', 20)}</div>`}
    </button>`;
}

// The full trend chart shown inside the weight sheet. Reuses the .chart-card
// SVG line pattern used by the exercise-progress chart.
function weightTrendChartHtml(entries) {
  const pts = entries.slice(-30).map((e) => ({ value: convertWeightForDisplay(e.kg), date: e.date }));
  if (pts.length < 2) {
    return `<div class="chart-card">
      <div class="chart-head">
        <div class="chart-title">${t('weight_trend')}</div>
        ${pts.length ? `<div class="chart-latest num">${fmtNum(pts[0].value)} ${unitLabel()}</div>` : ''}
      </div>
      <div class="chart-empty">${t('weight_need_more')}</div>
    </div>`;
  }
  const W = 300, H = 110, PAD_X = 12, PAD_Y = 14;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const stepX = (W - PAD_X * 2) / (pts.length - 1);
  const coords = pts.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_Y + (H - PAD_Y * 2) * (1 - (p.value - min) / span),
  }));
  const pathD = coords.map((c, i) => (i === 0 ? `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` : `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)).join(' ');
  const areaD = pathD + ` L ${coords[coords.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${coords[0].x.toFixed(1)} ${H - PAD_Y} Z`;
  const last = coords[coords.length - 1];
  const totalDelta = pts[pts.length - 1].value - pts[0].value;
  const dCls = totalDelta > 0 ? 'up' : (totalDelta < 0 ? 'down' : 'flat');
  const dSign = totalDelta > 0 ? '+' : (totalDelta < 0 ? '−' : '');
  return `
    <div class="chart-card">
      <div class="chart-head">
        <div class="chart-title">${t('weight_trend')}</div>
        <div class="chart-latest num">${fmtNum(pts[pts.length - 1].value)} ${unitLabel()}</div>
      </div>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="weight-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${areaD}" fill="url(#weight-grad)"/>
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3" fill="var(--accent)"/>
      </svg>
      <div class="chart-foot">
        <span>${escapeHtml(formatDate(pts[0].date))}</span>
        ${totalDelta !== 0 ? `<span class="weight-delta ${dCls}">${dSign}${fmtNum(Math.abs(totalDelta))} ${unitLabel()}</span>` : ''}
        <span>${escapeHtml(formatDate(pts[pts.length - 1].date))}</span>
      </div>
    </div>`;
}

function openWeightSheet() {
  const body = () => {
    const entries = DB.bodyweight.list();
    const latest = entries.length ? entries[entries.length - 1] : null;
    const prefill = latest ? convertWeightForDisplay(latest.kg) : '';
    const history = entries.slice().reverse().slice(0, 40).map((e) => `
      <div class="weight-row">
        <span class="weight-row-date">${escapeHtml(formatDate(e.date))}</span>
        <span class="weight-row-val"><span class="num">${fmtWeight(e.kg)}</span> ${unitLabel()}</span>
        <button class="weight-row-del" data-del-weight="${escapeHtml(e.date)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
      </div>`).join('');
    return `
      ${weightTrendChartHtml(entries)}
      <div class="weight-log-row">
        <input id="weight-input" class="weight-input" type="number" inputmode="decimal" step="0.1" min="0"
          placeholder="${escapeHtml(t('weight_placeholder'))}" value="${prefill}" aria-label="${escapeHtml(t('bodyweight'))}" />
        <span class="weight-input-unit">${unitLabel()}</span>
        <button class="btn btn-primary" id="weight-save">${t('save')}</button>
      </div>
      ${entries.length ? `<div class="weight-history">${history}</div>` : `<div class="weight-empty-hint">${t('weight_empty_hint')}</div>`}
    `;
  };
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('bodyweight')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div id="weight-sheet-body">${body()}</div>
  `);
  const host = overlay.querySelector('#weight-sheet-body');
  const bind = () => {
    const saveBtn = overlay.querySelector('#weight-save');
    const input = overlay.querySelector('#weight-input');
    const doSave = () => {
      const val = parseFloat(input.value);
      if (!val || val <= 0) { input.focus(); return; }
      DB.bodyweight.log(todayISO(), convertWeightToStorage(val));
      host.innerHTML = body(); bind();
    };
    saveBtn?.addEventListener('click', doSave);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    host.querySelectorAll('[data-del-weight]').forEach((b) =>
      b.addEventListener('click', () => {
        DB.bodyweight.remove(b.getAttribute('data-del-weight'));
        host.innerHTML = body(); bind();
      })
    );
  };
  bind();
}

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

// The name to SHOW for an exercise. Never use this for storage, sync, or the
// image catalogue — those key off the raw `ex.name`.
function exDisplayName(ex) {
  if (!ex) return '';
  const raw = ex.name || '';
  if (ex.isCustom) return raw;                       // the user named it — leave it alone
  const prefs = DB.prefs.get();
  if ((prefs.lang || 'en') !== 'ar') return raw;
  if (prefs.translateExercises === false) return raw; // user turned exercise-name translation off
  return EXERCISE_NAME_AR[raw] || raw;
}

// Search should find an exercise by whichever name the user can see, so match
// the raw English name AND the displayed (possibly Arabic) one.
function exMatchesQuery(ex, q) {
  const s = String(q || '').toLowerCase();
  if (!s) return true;
  return (ex.name || '').toLowerCase().includes(s) || exDisplayName(ex).toLowerCase().includes(s);
}

// ==========================================================================
// Exercise card helpers
// ==========================================================================
function exerciseImgSrc(ex) {
  if (ex.customImage) {
    const v = String(ex.customImage);
    // Allow only safe schemes (data:image/* or https?://) AND reject any char
    // that could break out of an HTML attribute or a CSS url() context
    // (" ' < > ` \ or whitespace). This single guard protects every render
    // sink, so a poisoned imported/synced customImage can't inject markup.
    const schemeOk = /^data:image\//i.test(v) || /^https?:\/\//i.test(v);
    if (schemeOk && !/["'<>`\\\s]/.test(v)) return v;
    return '';
  }
  if (ex.imageSlug) return exerciseImageUrl(ex.imageSlug);
  return '';
}

// Back up a custom exercise's image to its durable cloud copy. Fire-and-forget:
// the base64 is already saved locally, so a failure here costs nothing and the
// login pass (syncExerciseImages) retries it.
function backupExerciseImageFor(exerciseId, dataUrl) {
  if (!exerciseId) return;
  if (!window.Cloud || !Cloud.backupExerciseImage) return;
  // REMOVAL: the user cleared the photo. Clearing only the local base64 is not
  // enough — syncExerciseImages() treats "no customImage but an imagePath" as a
  // LOST image and restores it from the bucket, so the deleted photo reappears on
  // the next boot. Drop the pointer (and the stored object) so the delete sticks.
  if (!dataUrl) {
    const ex = DB.exercises.getById(exerciseId);
    if (!ex || !ex.imagePath) return;
    DB.exercises.update(exerciseId, { imagePath: null });
    try {
      if (Cloud.removeExerciseImage) Cloud.removeExerciseImage(ex.imagePath).catch(() => {});
    } catch (_) {}
    return;
  }
  if (!/^data:image\//i.test(String(dataUrl))) return; // nothing new to upload
  Cloud.backupExerciseImage(exerciseId, dataUrl)
    .then((path) => { if (path) DB.exercises.update(exerciseId, { imagePath: path }); })
    .catch(() => {});
}

// Reconcile custom exercise images against their durable copies. Runs after
// login/sync and does two jobs:
//   1. uploads any custom image that has no backup yet (covers every image
//      that existed before this feature shipped), and
//   2. HEALS an exercise whose base64 was lost with the blob but whose backup
//      survived — the exact failure that once wiped every image.
// Best-effort and silent; never blocks the UI.
async function syncExerciseImages() {
  if (!window.Cloud || !Cloud.backupExerciseImage) return;
  let healed = 0;
  for (const ex of DB.exercises.list().filter((e) => e.isCustom)) {
    try {
      if (ex.customImage && !ex.imagePath) {
        const path = await Cloud.backupExerciseImage(ex.id, ex.customImage);
        if (path) DB.exercises.update(ex.id, { imagePath: path });
      } else if (!ex.customImage && ex.imagePath) {
        const dataUrl = await Cloud.restoreExerciseImage(ex.imagePath);
        if (dataUrl) { DB.exercises.update(ex.id, { customImage: dataUrl }); healed++; }
      }
    } catch (_) {}
  }
  if (healed) { try { renderView(currentView); } catch (_) {} }
}

// `stats` lets a caller rendering MANY cards hand in a row from one
// DB.sessions.statsByExercise() pass — without it every card re-scans the whole
// session list, and this grid rebuilds on every filter tap and every keystroke.
// Omitted for a one-off card, where a single scan is cheaper than a map.
function bentoCardHtml(ex, i, { showPR = true, toggle = null, stats = null } = {}) {
  const isWide = i % 5 === 0;
  if (!stats) stats = DB.sessions.bestStats(ex.id);
  const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
  const url = exerciseImgSrc(ex);
  const initials = escapeHtml(initialsOf(exDisplayName(ex)));

  let metaText;
  if (stats.totalSets > 0) {
    metaText = `${stats.totalSets} ${t('sets').toLowerCase()}`;
    if (stats.maxWeight > 0) metaText += ` · ${fmtWeight(stats.maxWeight)} ${unitLabel()}`;
  } else {
    metaText = t('no_sessions_yet');
  }

  const prBadge = showPR && stats.maxWeight > 0 && stats.totalSets >= 2
    ? `<div class="bento-pr">${icon('trophy', 16)} ${t('pr')} ${fmtWeight(stats.maxWeight)}${unitLabel()}</div>`
    : '';

  // Rendered as <span role="button">, NOT <button>: the card itself is a
  // <button>, and HTML forbids nesting buttons — the parser closes the card
  // early and spills the rest of the card (badges + content footer) out as
  // siblings. The span keeps the DOM intact; clicks/keys are delegated.
  const toggleBtn = toggle
    ? `<span class="bento-toggle ${toggle.added ? 'added' : ''}" data-toggle-ex="${escapeHtml(ex.id)}" role="button" tabindex="0" aria-label="${escapeHtml(toggle.added ? t('remove_image') : t('add_to_train'))}">${icon(toggle.added ? 'check' : 'plus', 16)}</span>`
    : '';

  // When the card is part of a list with a toggle (Library), mark cards that
  // are already in the user's Train list so they stand out clearly.
  const addedClass = toggle && toggle.added ? 'added' : '';
  const addedBadge = toggle && toggle.added
    ? `<div class="bento-added-stripe"><span class="bento-added-stripe-icon">${icon('check', 16)}</span><span>${t('added')}</span></div>`
    : '';

  let bgHtml;
  if (machineSvg) {
    // Machine: show the real photo on top of the blueprint SVG. If the photo
    // fails to load it removes itself and the SVG underneath shows through.
    bgHtml = `
      <div class="bento-card-bg machine-bg" data-cat="${escapeHtml(ex.category)}">
        ${machineSvg}
        ${url ? `<img class="machine-photo" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      </div>
    `;
  } else if (url) {
    bgHtml = `<div class="bento-card-bg" data-cat="${escapeHtml(ex.category)}" style="background-image:url('${escapeHtml(url)}')"></div>`;
  } else {
    bgHtml = `<div class="bento-card-bg fallback" data-cat="${escapeHtml(ex.category)}">${initials}</div>`;
  }

  return `
    <button class="bento-card ${isWide ? 'wide' : ''} ${addedClass}" data-exercise="${escapeHtml(ex.id)}">
      ${bgHtml}
      <div class="bento-card-name-tag" title="${escapeHtml(exDisplayName(ex))}">${escapeHtml(exDisplayName(ex))}</div>
      ${toggleBtn}
      ${!toggleBtn ? prBadge : ''}
      ${addedBadge}
      <div class="bento-card-content">
        <span class="bento-card-cat-mini ${escapeHtml(ex.category)}" data-cat="${escapeHtml(ex.category)}">${escapeHtml(categoryLabel(ex.category))}</span>
        <div class="bento-card-meta">${escapeHtml(metaText)}</div>
      </div>
    </button>
  `;
}

// ==========================================================================
// PROGRAM — the plan & progression centre. Bottom-nav tab, view id 'workouts'.
//
// This tab used to be an exercise browser with a COPY of Home's "start today's
// workout" button on top of it — the same navigate('session-day', today) call,
// minus Home's branch that opens the planner when no plan exists. That is why it
// felt purposeless: Home already owned starting a workout, so the tab was a
// library with a stray button.
//
// Nothing here is newly invented except the weekly tonnage. The parts of a real
// program screen already existed but were scattered: the rotation editor was one
// pod in Home's tool rail, records another, and the muscle heatmap and weekly
// counts were Home sections. This consolidates them so the tab answers one
// question — "what is my programme, and am I progressing?"
//
// The view id stays 'workouts': it is baked into index.html's <section>, the nav
// button, and every pushState entry already sitting in users' browser history.
// The editor deliberately stays its own screen (renderPlanner) so this page stays
// scannable and no working code had to be rewritten to move it.
// ==========================================================================
function renderProgram(el) {
  const plan = DB.plan.get() || { cycle: [], trainingDays: [], anchor: null };
  const cycle = Array.isArray(plan.cycle) ? plan.cycle : [];

  // Noon anchor: workoutForDate does date-only maths, and midnight ± a DST shift
  // can land on the previous day.
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const todayWorkout = DB.plan.workoutForDate(now);
  // Identity compare is safe: workoutForDate returns the actual cycle element.
  const currentIdx = todayWorkout ? cycle.indexOf(todayWorkout) : -1;

  // ---- Where you are in the cycle ------------------------------------------
  // Numbered chips, not arrows: an arrow glyph between chips points the wrong
  // way once the row lays out right-to-left in Arabic.
  // No exercise count on the chip: "1 Push 3" reads as if the 3 were part of the
  // workout's name. This strip answers "where am I in the cycle" — counts belong
  // in the editor, which already shows them per slot.
  const cycleHtml = cycle.map((slot, i) => `
      <div class="cycle-chip ${i === currentIdx ? 'current' : ''}">
        <span class="cycle-chip-num num">${fmtNum(i + 1)}</span>
        <span class="cycle-chip-name">${escapeHtml(slot.name || t('workout_label'))}</span>
      </div>`).join('');

  // ---- Next training days (rest days omitted — the planner's preview shows the
  // raw 7-day roll including rest; here only the days you actually train). -----
  //
  // The row count is YOUR week, not a constant. It was hard-coded to 4, so a
  // five-day schedule rendered four rows and the fifth weekday switched on in the
  // planner simply never appeared — this strip contradicted both the toggles two
  // screens away and the "/ 5" denominator printed directly below it.
  //
  // trainingDays.length is the very number "This week" divides by (weekPlanned,
  // below), so the two can no longer disagree. A cycle with no weekday switched
  // on falls back to 4, finds nothing — workoutForDate returns null on every
  // date — and the section drops out instead of printing an empty titled box.
  const wantDays = Math.min(7, (plan.trainingDays || []).length || 4);
  const nextDays = [];
  for (let i = 0; i < 28 && nextDays.length < wantDays; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const w = DB.plan.workoutForDate(d);
    if (w) nextDays.push({ iso: addDaysISO(todayISO(), i), dow: d.getDay(), w, isToday: i === 0 });
  }
  const nextHtml = nextDays.map(({ iso, dow, w, isToday }) => `
    <button type="button" class="schedule-prev-row" data-day-iso="${iso}">
      <span class="schedule-prev-day">${isToday ? t('today') : escapeHtml(dayName(dow, true))}</span>
      <span class="schedule-prev-arrow"></span>
      <span class="schedule-prev-workout">${escapeHtml(w.name || t('workout_label'))}</span>
    </button>`).join('');

  // ---- This week vs last week ----------------------------------------------
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();
  const allSessions = DB.sessions.listAll();
  const wk = allSessions.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
  const lw = allSessions.filter((s) => inRangeISO(s.date, lastStart, lastEnd));
  const daysOf = (list) => new Set(list.map((s) => s.date)).size;
  const setsOf = (list) => list.reduce((n, s) => n + (s.sets || []).length, 0);

  // Adherence — days trained out of days the rotation actually schedules this
  // week. Replaced weekly tonnage, which was a five-digit number (12,920) that
  // dominated the row, moved for reasons the user couldn't act on, and answered
  // no question they were asking. "3 / 5" answers the one this tab exists for.
  //
  // The denominator is trainingDays.length — how many days a week you intend to
  // train — NOT a workoutForDate() sweep of the week. workoutForDate returns null
  // for any date before the plan's anchor ("before the plan started"), which is
  // right for the rotation but wrong here: a plan created today would make the
  // six earlier days of this week unplanned and render "1 / 1".
  const weekPlanned = cycle.length ? (plan.trainingDays || []).length : 0;
  const doneNow = daysOf(wk);
  // Capped: training on a rest day should never render "6 / 5".
  const adherence = weekPlanned ? Math.min(doneNow, weekPlanned) : doneNow;

  // New records — exercises whose best weight this window beat their own best
  // from BEFORE it. Prior history is required, so a brand-new exercise is not
  // counted as a "record"; that would make trying something new look like progress.
  const newPrCount = (start, end) => {
    const byEx = {};
    allSessions.forEach((s) => { (byEx[s.exerciseId] = byEx[s.exerciseId] || []).push(s); });
    const best = (arr) => Math.max(0, ...arr.flatMap((s) => (s.sets || []).map((x) => Number(x.weight) || 0)));
    let n = 0;
    Object.values(byEx).forEach((list) => {
      const before = list.filter((s) => new Date(s.date + 'T12:00:00') < start);
      const within = list.filter((s) => inRangeISO(s.date, start, end));
      if (!before.length || !within.length) return;
      if (best(within) > best(before)) n++;
    });
    return n;
  };
  const prsNow = newPrCount(thisStart, thisEnd);

  // ---- Muscle volume, last 7 days (moved here from Home) -------------------
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0);
  const exIdToCat = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e.category]));
  const catCounts = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c, 0]));
  allSessions.forEach((s) => {
    if (new Date(s.date + 'T00:00:00') >= sevenDaysAgo) {
      const cat = exIdToCat[s.exerciseId];
      if (cat && catCounts[cat] !== undefined) catCounts[cat] += 1;
    }
  });
  const heatTotal = EXERCISE_CATEGORIES.reduce((sum, c) => sum + (catCounts[c] || 0), 0);
  const heatCells = EXERCISE_CATEGORIES.filter((c) => c !== 'Other').map((cat) => {
    const count = catCounts[cat] || 0;
    let lvl = 0;
    if (count >= 1) lvl = 1;
    if (count >= 3) lvl = 2;
    if (count >= 5) lvl = 3;
    if (count >= 8) lvl = 4;
    return `
      <button class="heat-cell lvl-${lvl}" data-muscle="${escapeHtml(cat)}" aria-label="${escapeHtml(categoryLabel(cat))}">
        <div class="heat-cell-name">${escapeHtml(categoryLabel(cat))}</div>
        <div class="heat-cell-count num">${count}</div>
      </button>`;
  }).join('');

  // ---- Top records (same filter as the full PR screen) ---------------------
  // One grouping pass instead of one full session scan per exercise — see
  // DB.sessions.statsByExercise(). This screen asks about the whole catalog.
  const prIndex = DB.sessions.statsByExercise();
  const prRows = DB.exercises.list()
    .map((ex) => {
      if (!ex) return null;
      const snap = prIndex[ex.id];
      if (!snap || snap.sessionCount === 0 || snap.maxWeight === 0) return null;
      return { ex, snap };
    })
    .filter(Boolean)
    .sort((a, b) => b.snap.bestORM - a.snap.bestORM)
    .slice(0, 3);

  el.innerHTML = `
    ${vaultBar({ action: icon('search', 20), actionLabel: t('search_exercises') })}

    <div class="page-header">
      <h1 class="page-title">${t('program_title')}</h1>
      <p class="page-subtitle">${t('program_subtitle')}</p>
    </div>

    ${cycle.length === 0 ? `
      ${emptyState({ iconName: 'calendar', title: t('program_no_plan_title'), text: t('program_no_plan_sub') })}
      <button class="btn btn-primary btn-block" data-goto="planner">${icon('plus', 20)} ${t('program_build')}</button>
    ` : `
      <div class="rot-section">
        <div class="rot-section-head">
          <div class="rot-section-title">${t('program_where')}</div>
          <button class="rot-section-action" data-goto="planner">${icon('edit', 16)} ${t('edit_cycle')}</button>
        </div>
        <div class="cycle-strip">${cycleHtml}</div>
        ${DB.plan.isExtra(todayISO()) ? `
          <!-- A day pulled forward shifted THIS strip by one, so the way back
               belongs beside it rather than on Home. The toast carries the undo
               while it is up; this is where it goes afterwards, and it stays
               until the day is over. --warn, not the accent and not red: the
               plan was moved, nothing went wrong. -->
          <div class="rot-moved">
            <span class="rot-moved-icon">${icon('refresh', 20)}</span>
            <span class="rot-moved-text">${t('program_moved')}</span>
            <!-- The short label is right HERE, where the line beside it already
                 says what happened. On Home it was wrong because the chip stood
                 alone and "Undo" named a verb with no object. -->
            <button class="btn btn-ghost rot-moved-undo" id="program-undo-extra" type="button">${t('rest_undo')}</button>
          </div>` : ''}
      </div>

      ${nextDays.length ? `
      <div class="rot-section">
        <div class="rot-section-title">${t('program_next')}</div>
        <div class="schedule-preview">${nextHtml}</div>
      </div>` : ''}
    `}

    <!-- Every block below is a .rot-section with a .rot-section-title. It used to
         mix two header systems on one screen — .section-title (700, plus a ::after
         rule) for "This week" and .rot-section-title (800, no rule) for the rest,
         so one heading had a horizontal line and the others did not. One system,
         one spacing rhythm. -->
    <div class="rot-section">
      <div class="rot-section-title">${t('this_week')}</div>
      <div class="stat-strip">
        <div class="stat-cell">
          <div class="stat-cell-value num">${fmtNum(adherence)}${weekPlanned ? `<span class="stat-cell-of">/${fmtNum(weekPlanned)}</span>` : ''}</div>
          <div class="stat-cell-label">${t('program_adherence')}</div>
          ${deltaBlock(doneNow, daysOf(lw), '')}
        </div>
        <div class="stat-cell">
          <div class="stat-cell-value num">${fmtNum(setsOf(wk))}</div>
          <div class="stat-cell-label">${t('sets')}</div>
          ${deltaBlock(setsOf(wk), setsOf(lw), '')}
        </div>
        <div class="stat-cell">
          <div class="stat-cell-value num">${fmtNum(prsNow)}</div>
          <div class="stat-cell-label">${t('program_new_prs')}</div>
          ${deltaBlock(prsNow, newPrCount(lastStart, lastEnd), '')}
        </div>
      </div>
    </div>

    ${heatTotal > 0 ? `
      <div class="rot-section">
        <div class="rot-section-title">${t('muscle_focus')}</div>
        <div class="rot-section-sub">${t('muscle_focus_sub')}</div>
        <div class="muscle-heatmap">
          <div class="heatmap-grid band">${heatCells}</div>
        </div>
      </div>` : ''}

    ${prRows.length ? `
      <div class="rot-section">
        <div class="rot-section-head">
          <div class="rot-section-title">${t('pr_view_title')}</div>
          <button class="rot-section-action" data-goto="personal-records">${t('view_all')}</button>
        </div>
        <div class="data-list">
          ${prRows.map(({ ex, snap }) => `
            <div class="data-row pr-row">
              <div class="data-icon custom" aria-hidden="true">${icon('trophy', 20)}</div>
              <div class="data-main">
                <div class="data-title">${escapeHtml(exDisplayName(ex))}</div>
                <div class="data-meta pr-stats">
                  <span>${escapeHtml(t('pr_max_weight'))}: <span class="num">${fmtWeight(snap.maxWeight)}${unitLabel()}</span></span>
                  <span class="dot-sep"></span>
                  <span>${escapeHtml(t('pr_est_orm'))}: <span class="num">${fmtWeight(Math.round(snap.bestORM))}${unitLabel()}</span></span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

  `;

  // (The full-width "Exercises" button that used to close this screen is gone.
  // Browsing the library is not a goal in itself — it is something you do IN
  // ORDER to add an exercise to a template, and that path already carries its
  // own picker with the whole library, a category filter and search
  // (openAddExerciseChooser → openSlotEditorModal). A second entry point at the
  // bottom of Program was a button whose answer to "what do I do here" was
  // "leave". The browser is still reachable — deliberately, since it is a real
  // screen — from the magnifier in this screen's top bar, bound just below.)

  // Top-bar magnifier → the exercise browser (its own screen since v198).
  bindVaultAction(() => navigate('exercises'));

  // Tap a day in "next training days" → open/log that day's session.
  el.querySelector('.schedule-preview')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-day-iso]');
    if (row) navigate('session-day', { date: row.dataset.dayIso });
  });

  // Tap a muscle → its full session history.
  el.querySelectorAll('[data-muscle]').forEach((b) =>
    b.addEventListener('click', () => navigate('muscle-sessions', { muscleCat: b.dataset.muscle }))
  );

  // Undo a pulled-forward day. The whole rotation slides back with it, and
  // exactly, because the cycle position is DERIVED from the date lists rather
  // than stored — removing the entry restores the previous schedule byte for
  // byte. Re-renders Program, not Home, since this is the screen it changed.
  $('#program-undo-extra', el)?.addEventListener('click', () => {
    DB.plan.setExtra(new Date(), false);
    showToast(t('anyway_undone'));
    renderView('workouts');
  });
}

// ==========================================================================
// EXERCISES — the browser. Every exercise (built-in + custom), searchable and
// category-filterable; tap any → its history / PRs / progress / logging. Custom
// management lives one tap away.
//
// Was the body of the Train tab (view id 'workouts'); moved to its own screen so
// that tab could become the program centre. It reuses the router + <section> slot
// of the old `library` view, which was 196 lines of unreachable duplicate of this
// same grid — nothing in the app ever navigated to it.
// ==========================================================================
function renderExercises(el) {
  const query = viewContext.workoutQuery || '';
  const filter = viewContext.workoutFilter || 'All';
  const searchOpen = !!viewContext.workoutSearchOpen;

  const filterPills = ['All', ...EXERCISE_CATEGORIES]
    .map((f) => `<button class="filter-pill ${f === filter ? 'active' : ''}" data-filter="${f}">${escapeHtml(categoryLabel(f))}</button>`)
    .join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="workouts" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('train')}</div>
    </div>

    <div class="page-header">
      <h1 class="page-title">${t('train')}</h1>
      <p class="page-subtitle">${t('train_subtitle')}</p>
    </div>

    <div class="exq-toolbar">
      ${searchOpen ? `
        <div class="search-wrap" style="flex:1">
          ${icon('search', 20)}
          <input type="search" id="workout-search" placeholder="${t('search_exercises')}" value="${escapeHtml(query)}">
        </div>
        <button class="icon-square" id="workout-search-close" aria-label="${escapeHtml(t('cancel'))}">${icon('close', 20)}</button>
      ` : `
        <button class="btn btn-ghost" data-goto="custom-exercises" style="flex:1">${t('my_exercises_short')}</button>
        <button class="icon-square" id="workout-search-open" aria-label="${escapeHtml(t('search_exercises'))}">${icon('search', 20)}</button>
      `}
    </div>

    <div class="filter-bar">${filterPills}</div>

    <div id="workout-grid"></div>
  `;

  // Rebuild ONLY the card grid (search/filter changes) — not the whole view.
  function updateWorkoutGrid() {
    const grid = $('#workout-grid', el);
    if (!grid) return;
    const q = (viewContext.workoutQuery || '').toLowerCase();
    const f = viewContext.workoutFilter || 'All';
    let filtered = DB.exercises.list();
    if (f !== 'All') filtered = filtered.filter((e) => e.category === f);
    if (q) filtered = filtered.filter((e) => exMatchesQuery(e, q));

    // Keep cards as an ARRAY so the "add" card can be spliced after the first
    // card without string-searching for '</button>' (which would break the day
    // a card gains a nested control).
    const gridStats = DB.sessions.statsByExercise();
    const cards = filtered.map((ex, i) =>
      bentoCardHtml(ex, i, { stats: gridStats[ex.id] || DB.sessions.emptyStats() }));

    const addCard = `
      <button class="bento-card bento-add" id="add-exercise-btn">
        ${icon('plus', 22)}
        <div>
          <div class="bento-add-title">${t('new_exercise')}</div>
          <div class="bento-add-sub">${t('add_custom')}</div>
        </div>
      </button>
    `;

    if (filtered.length === 0) {
      grid.innerHTML = emptyState({ iconName: 'search', title: t('no_matches'), text: t('no_matches_hint') });
    } else {
      cards.splice(1, 0, addCard); // after the first (wide) card
      grid.innerHTML = `<div class="bento-grid">${cards.join('')}</div>`;
    }
  }
  updateWorkoutGrid();

  // Compact square search: tap the magnifier to expand the search field, X to collapse.
  $('#workout-search-open', el)?.addEventListener('click', () => {
    viewContext.workoutSearchOpen = true;
    renderView('exercises');
    setTimeout(() => $('#workout-search')?.focus(), 30);
  });
  $('#workout-search-close', el)?.addEventListener('click', () => {
    viewContext.workoutSearchOpen = false;
    viewContext.workoutQuery = '';
    renderView('exercises');
  });

  // Debounced search → grid-only update (was a full view re-render per keystroke)
  const updateWorkoutSearch = debounce(updateWorkoutGrid, 150);
  $('#workout-search', el)?.addEventListener('input', (e) => {
    viewContext.workoutQuery = e.target.value;
    updateWorkoutSearch();
  });

  el.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      viewContext.workoutFilter = btn.dataset.filter;
      el.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      updateWorkoutGrid();
    })
  );

  // ONE delegated listener for the grid (cards + add button + empty-state CTAs),
  // attached once — no re-binding per keystroke.
  $('#workout-grid', el).addEventListener('click', (e) => {
    if (e.target.closest('#add-exercise-btn')) { openNewExerciseModal(); return; }
    const card = e.target.closest('[data-exercise]');
    if (card) navigate('exercise-detail', { exerciseId: card.dataset.exercise });
  });
}

// Small chooser shown by the session-day "Add exercise" button: pick from the
// library, or create a new custom exercise and drop it straight into this day.
// ===========================================================================
// THE LAST SEVEN DAYS — one rail, seven discs, today on the trailing edge.
//
// Seven days BACK rather than the calendar week: a Monday-anchored week shows
// one day of history on a Monday, which is exactly when someone is most likely
// to be looking back. This window always holds a full week of past.
//
// Each disc carries up to three dots — trained, ate, cardio — because a bare
// date says nothing about whether the day is worth opening. They are computed
// from the same records renderDay reads, so the rail can never promise a day
// that turns out empty.
//
// Shared by Home and by the day view itself, so moving day to day never
// requires going back first. `activeIso` marks the day being viewed; on Home
// nothing is active, because Home is not "a day", it is today's dashboard.
// ===========================================================================
// `variant` = 'compact' shrinks it for use INSIDE a sheet, where it is evidence
// rather than navigation. Same function, same data, same dots — the handoff is
// explicit that no second seven-day strip may exist in this project.
// `sessions`/`cardio` are optional for the same reason as computeStreak: both
// only become a Set of dates, so order does not matter and a caller holding the
// arrays should not pay for a second copy+sort.
function weekStrip(activeIso = null, variant = '', sessions, cardio) {
  const sessionDates = new Set((sessions || DB.sessions.listAll()).map((s) => s.date));
  const cardioDates = new Set((cardio || DB.cardio.list()).map((c) => c.date));
  const chips = [];
  for (let back = 6; back >= 0; back--) {
    const iso = addDaysISO(todayISO(), -back);
    const dd = new Date(iso + 'T12:00:00');
    const trained = sessionDates.has(iso);
    const ate = (DB.foodLogs.listForDate(iso) || []).length > 0;
    const didCardio = cardioDates.has(iso);
    // The rotation is CONTINUOUS and its position is derived, so a day that was
    // pulled forward or declined changes what every later day carries — and
    // until now nothing anywhere said so. The disc's border carries plan state;
    // the dots below carry what actually happened. Two questions, two signals.
    const moved = DB.plan.isExtra(iso);
    const skipped = !moved && DB.plan.isRest(iso);
    const cls = [
      back === 0 ? 'is-today' : '',
      activeIso === iso ? 'is-active' : '',
      moved ? 'is-moved' : '',
      skipped ? 'is-skipped' : '',
    ].filter(Boolean).join(' ');
    // The state goes in the LABEL too, not only in a colour — the border is the
    // whole signal here, and a border is invisible to a screen reader.
    const stateLabel = moved ? ' · ' + t('day_moved_in') : skipped ? ' · ' + t('day_rest_taken') : '';
    chips.push(`
      <button class="wk-chip${cls ? ' ' + cls : ''}" data-day="${iso}"
              ${activeIso === iso ? 'aria-current="date"' : ''}
              aria-label="${escapeHtml(formatDate(iso) + stateLabel)}">
        <span class="wk-dow">${escapeHtml(dayName(dd.getDay(), false))}</span>
        <span class="wk-disc">
          <span class="wk-num num">${fmtNum(dd.getDate())}</span>
        </span>
        <span class="wk-dots">
          ${trained ? '<i class="wk-dot train"></i>' : ''}
          ${ate ? '<i class="wk-dot eat"></i>' : ''}
          ${didCardio ? '<i class="wk-dot cardio"></i>' : ''}
        </span>
      </button>`);
  }
  return `<div class="wk-rail${variant === 'compact' ? ' wk-compact' : ''}" role="group"
    aria-label="${escapeHtml(t('last_7_days'))}">${chips.join('')}</div>`;
}

// ===========================================================================
// ONE DAY, EVERYTHING.
//
// Every other screen slices the data by TOPIC — food here, workouts there,
// weight somewhere else — which answers "how is my protein doing" but never
// "what did I actually do on Tuesday". This view is the other axis: one date,
// every kind of record, in the order a person recalls a day.
//
// It is READ-ONLY on purpose. Each section links to the screen that owns that
// data rather than editing in place, so there is still exactly one write path
// per kind of record and this screen can never disagree with them.
// ===========================================================================
function renderDay(el) {
  const iso = viewContext.dayDate || todayISO();
  const d = new Date(iso + 'T12:00:00');   // noon: date-only maths, DST-safe
  const isToday = iso === todayISO();

  const sessions = DB.sessions.listAll().filter((s) => s.date === iso);
  const cardio = DB.cardio.list().filter((c) => c.date === iso);
  const foods = DB.foodLogs.listForDate(iso);
  const totals = DB.foodLogs.totalsForDate(iso);
  const targets = DB.nutrition.get().targets;
  const bw = DB.bodyweight.list().find((b) => b.date === iso);
  const water = DB.water.get(iso);
  const sleep = DB.sleep.list().find((s) => s.date === iso);
  const sups = DB.supplements.list().filter((s) => DB.supplements.isTaken(s.id, iso));
  const plan = DB.plan.workoutForDate(d);
  const wasRest = DB.plan.isRest(d);

  const byId = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const totalSets = sessions.reduce((n, s) => n + s.sets.length, 0);
  const volume = sessions.reduce((n, s) =>
    n + s.sets.reduce((v, x) => v + (Number(x.reps) || 0) * (Number(x.weight) || 0), 0), 0);
  const isMinimum = sessions.length > 0 && sessions.every((s) => s.kind === 'minimum');

  const nothing = !sessions.length && !cardio.length && !foods.length && !bw && !water && !sleep && !sups.length;

  const section = (title, body, goto) => `
    <div class="day-section">
      <div class="day-section-head">
        <span class="day-section-title">${title}</span>
        ${goto ? `<button class="link-btn" data-goto="${goto}">${t('open')} <span class="icon-mirror">${icon('chevronRight', 16)}</span></button>` : ''}
      </div>
      ${body}
    </div>`;

  const stat = (label, value, unit) => `
    <div class="day-stat">
      <div class="day-stat-value num">${value}${unit ? `<span class="day-stat-unit">${unit}</span>` : ''}</div>
      <div class="day-stat-label">${label}</div>
    </div>`;

  el.innerHTML = `
    <div class="detail-top show-title">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(dayName(d.getDay(), true))}</div>
    </div>

    ${weekStrip(iso)}

    <div class="day-body ${viewContext.dayAnim || ''}">
    <div class="page-header">
      <div class="page-eyebrow">${isToday ? t('today') : escapeHtml(dayName(d.getDay(), true))}</div>
      <h1 class="page-title">${escapeHtml(formatDate(iso))}</h1>
      <p class="page-subtitle">${
        wasRest ? t('rest_today_title')
        : plan ? escapeHtml(plan.name || t('start_workout'))
        : t('rest_day')}</p>
    </div>

    ${nothing ? `
      <div class="day-empty">
        ${icon('calendar', 28)}
        <div>${t('day_nothing')}</div>
      </div>` : ''}

    ${sessions.length ? section(
      `${t('workout_label')}${isMinimum ? ` · <span class="day-tag">${t('day_minimum')}</span>` : ''}`,
      `<div class="day-stats">
         ${stat(t('exercises'), fmtNum(sessions.length))}
         ${stat(t('sets'), fmtNum(totalSets))}
         ${stat(t('volume'), fmtNum(Math.round(volume)), ' kg')}
       </div>
       <div class="day-rows">
         ${sessions.map((s) => {
           const ex = byId[s.exerciseId];
           const best = s.sets.reduce((m, x) => Math.max(m, Number(x.weight) || 0), 0);
           return `
             <div class="day-row">
               <span class="day-row-name">${escapeHtml(ex ? exDisplayName(ex) : t('exercise'))}</span>
               <span class="day-row-meta num">${fmtNum(s.sets.length)}×${best ? ` ${fmtNum(best)}kg` : ''}</span>
             </div>`;
         }).join('')}
       </div>`) : ''}

    ${cardio.length ? section(t('cardio'),
      `<div class="day-rows">
         ${cardio.map((c) => {
           const ty = DB.cardioTypes.findById(c.type);
           return `
             <div class="day-row">
               <span class="day-row-name">${escapeHtml(ty ? ty.label : c.type)}</span>
               <span class="day-row-meta num">${fmtNum(c.duration)} ${t('unit_min')}${c.calories ? ` · ${fmtNum(c.calories)} ${t('cal')}` : ''}</span>
             </div>`;
         }).join('')}
       </div>`) : ''}

    ${(foods.length || totals.calories) ? section(t('food'),
      `<div class="day-stats">
         ${stat(t('cal'), fmtNum(Math.round(totals.calories)), targets.calories ? ` / ${fmtNum(targets.calories)}` : '')}
         ${stat(t('protein_label'), fmtNum(Math.round(totals.protein)), 'g')}
         ${stat(t('carbs_label'), fmtNum(Math.round(totals.carbs)), 'g')}
         ${stat(t('fat_label'), fmtNum(Math.round(totals.fat)), 'g')}
       </div>
       <div class="day-rows">
         ${foods.slice(0, 8).map((f) => `
           <div class="day-row">
             <span class="day-row-name">${escapeHtml(f.name)}</span>
             <span class="day-row-meta num">${fmtNum(Math.round((f.calories || 0) * (f.servings || 1)))} ${t('cal')}</span>
           </div>`).join('')}
         ${foods.length > 8 ? `<div class="day-more">+${fmtNum(foods.length - 8)}</div>` : ''}
       </div>`, 'foodlog') : ''}

    ${(bw || water || sleep || sups.length) ? section(t('day_body'),
      `<div class="day-stats">
         ${bw ? stat(t('day_weight'), fmtNum(bw.kg), ' kg') : ''}
         ${water ? stat(t('day_water'), fmtNum(water), ' ml') : ''}
         ${sleep ? stat(t('sleep'), fmtNum(Math.round(sleep.durationMinutes / 6) / 10), ' h') : ''}
         ${sups.length ? stat(t('supplements_title'), fmtNum(sups.length)) : ''}
       </div>`) : ''}
    </div>
  `;

  // The rail is live here too, so you can walk the week without going back.
  // The animation is DIRECTION-AWARE: picking an earlier day slides the content
  // in from the past side, a later day from the future side, which is the only
  // thing that makes a transition read as movement along a timeline rather than
  // as a generic fade. It is set as a class on the next render and cleared after,
  // so a re-render for any other reason does not replay it.
  el.querySelector('.wk-rail')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-day]');
    if (!chip || chip.dataset.day === iso) return;
    viewContext.dayAnim = chip.dataset.day > iso ? 'from-next' : 'from-prev';
    viewContext.dayDate = chip.dataset.day;
    renderDay(el);
    // Clear so the class only ever describes THIS transition.
    viewContext.dayAnim = '';
  });

  el.querySelectorAll('[data-goto]').forEach((b) =>
    b.addEventListener('click', (e) => {
      // stopPropagation is load-bearing. There is a GLOBAL delegated
      // [data-goto] handler on document (see the router), so without this both
      // fire: this one navigates with the day's date context, and the global one
      // immediately navigates AGAIN with no context — wiping it. "Open" on a
      // past day therefore landed on today's food log instead of that day's.
      e.stopPropagation();
      const v = b.dataset.goto;
      // The food log owns its own date context; hand it this day, not today.
      navigate(v, v === 'foodlog' ? { foodLog: { date: iso } } : {});
    })
  );
}

// ===========================================================================
// REORDER THE DAY'S EXERCISES — its own sheet, not controls on every card.
//
// The first attempt put an up/down pair in each card's head, beside the delete
// button. It worked, but it charged EVERY card a permanent two-button tax for
// something the user does rarely, and it crowded a head that already carries a
// thumbnail, a name, a status pill and a delete. Reordering is a task, not a
// property of a row, so it gets a surface of its own: the cards go back to
// clean, and inside the sheet the arrows are the only thing on the line and can
// be large.
//
// Drag was considered and rejected twice over: HTML5 drag-and-drop does not
// fire on touch at all, and a pointer-events implementation inside a vertically
// scrolling list fights the scroll — the exact reason this list is not
// drag-sortable in the first place.
// ===========================================================================
function openReorderSheet(slotIdx, onDone) {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('reorder-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'reorder-sheet-overlay';
  overlay.className = 'sheet-overlay';

  // Work on a LOCAL copy and write once on close: the user can shuffle freely
  // without every intermediate arrangement being saved and synced.
  let ids = ((DB.plan.get().cycle || [])[slotIdx]?.exerciseIds || []).slice();
  const byId = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));

  const paint = () => {
    overlay.innerHTML = `
      <div class="add-sheet reorder-sheet" role="dialog" aria-modal="true"
           aria-label="${escapeHtml(t('reorder_exercises'))}">
        <div class="sheet-handle"></div>
        <div class="add-sheet-title">${t('reorder_exercises')}</div>
        <div class="reorder-list">
          ${ids.map((id, i) => {
            const ex = byId[id];
            return `
              <div class="reorder-row">
                <span class="reorder-num num">${fmtNum(i + 1)}</span>
                <span class="reorder-name">${escapeHtml(ex ? exDisplayName(ex) : id)}</span>
                <span class="reorder-arrows">
                  <button type="button" data-ro="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}
                          aria-label="${escapeHtml(t('move_up'))}">${icon('arrowUp', 20)}</button>
                  <button type="button" data-ro="${i}" data-dir="1" ${i === ids.length - 1 ? 'disabled' : ''}
                          aria-label="${escapeHtml(t('move_down'))}">${icon('arrowDown', 20)}</button>
                </span>
              </div>`;
          }).join('')}
        </div>
        <button type="button" class="btn btn-primary btn-block" data-ro-done>${t('ro_done')}</button>
      </div>`;
  };
  paint();
  app.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 260);
  };
  const commit = () => {
    // Written from the id list this sheet was opened with, so an exercise that
    // was deleted elsewhere is not resurrected and none is silently dropped.
    DB.plan.setSlotExercises(slotIdx, ids);
    close();
    if (typeof onDone === 'function') onDone();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { commit(); return; }          // tapping away saves
    if (e.target.closest('[data-ro-done]')) { commit(); return; }
    const b = e.target.closest('[data-ro]');
    if (!b) return;
    const from = Number(b.dataset.ro);
    const to = from + (Number(b.dataset.dir) || 0);
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    paint();
  });
}

// Add an exercise to a rotation cycle SLOT (slotIdx). When onAdd is supplied,
// both choices feed a view-level selection instead and leave the plan alone.
function openAddExerciseChooser(slotIdx, onAdd) {
  openModal(`
    <div class="modal-header">
      <div><div class="modal-title">${t('add_exercise')}</div></div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
      <button type="button" class="btn btn-ghost btn-block" id="ch-from-lib" style="justify-content:center;gap:8px;padding:16px;font-size:15px">${icon('dumbbell', 20)} ${t('add_from_library')}</button>
      <button type="button" class="btn btn-ghost btn-block" id="ch-new-ex" style="justify-content:center;gap:8px;padding:16px;font-size:15px">${icon('plus', 20)} ${t('new_exercise')}</button>
    </div>
  `);
  // Both replace this chooser via openModal — no explicit close needed.
  $('#ch-from-lib').addEventListener('click', () => openSlotEditorModal(slotIdx, onAdd));
  $('#ch-new-ex').addEventListener('click', () => {
    openNewExerciseModal(null, {
      onCreated: (ex) => {
        if (!ex || !ex.id) return;
        if (typeof onAdd === 'function') onAdd(ex.id);
        else if (slotIdx != null && slotIdx >= 0) DB.plan.addExerciseToSlot(slotIdx, ex.id);
      },
    });
  });
}

function openNewExerciseModal(exerciseId = null, opts = {}) {
  const existing = exerciseId ? DB.exercises.getById(exerciseId) : null;
  const categoryOptions = EXERCISE_CATEGORIES.map(
    (c) => `<option value="${c}" ${existing && existing.category === c ? 'selected' : ''}>${escapeHtml(categoryLabel(c))}</option>`
  ).join('');

  let pickedImage = existing ? (existing.customImage || null) : null;

  function previewHtml() {
    if (pickedImage) {
      const src = exerciseImgSrc({ customImage: pickedImage });
      if (src) return `<img src="${escapeHtml(src)}" alt="">`;
    }
    return icon('apple', 22);
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_session') : t('new_exercise')}</div>
        <div class="modal-subtitle">${t('new_exercise_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="ex-name" placeholder="${t('ph_exercise_name')}" value="${existing ? escapeHtml(existing.name) : ''}" autofocus>
    </div>

    <div class="form-group">
      <label class="form-label">${t('category')}</label>
      <select id="ex-category">${categoryOptions}</select>
    </div>

    <div class="form-group">
      <label class="form-label">${t('image_optional')}</label>
      <div class="image-uploader">
        <div class="image-actions">
          <button type="button" class="btn btn-ghost" id="ex-image-camera">${icon('camera', 20)} ${t('take_photo')}</button>
          <button type="button" class="btn btn-ghost" id="ex-image-pick">${pickedImage ? t('change_image') : t('choose_image')}</button>
          ${pickedImage ? `<button type="button" class="btn btn-danger" id="ex-image-clear">${t('remove_image')}</button>` : ''}
        </div>
      </div>
      <div class="image-hint">${t('image_hint')}</div>
      <input type="file" id="ex-image-file" accept="image/*" hidden>
      <input type="file" id="ex-image-camera-file" accept="image/*" capture="environment" hidden>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-exercise-btn">${existing ? t('save') : t('save')}</button>
    </div>
  `);

  function refreshPreview() {
    const prev = $('#ex-image-preview');
    if (prev) prev.innerHTML = previewHtml();
    const pickBtn = $('#ex-image-pick');
    if (pickBtn) pickBtn.textContent = pickedImage ? t('change_image') : t('choose_image');
    let clearBtn = $('#ex-image-clear');
    if (pickedImage && !clearBtn) {
      const actions = pickBtn?.parentElement;
      if (actions) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'btn btn-danger';
        c.id = 'ex-image-clear';
        c.textContent = t('remove_image');
        c.addEventListener('click', () => { pickedImage = null; refreshPreview(); });
        actions.appendChild(c);
      }
    } else if (!pickedImage && clearBtn) {
      clearBtn.remove();
    }
  }

  // Shared handler for both the gallery picker and the camera capture.
  async function handleImageFile(file) {
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 800, 0.78);
      pickedImage = dataUrl;
      refreshPreview();
    } catch (err) {
      showToast(t('img_error'));
    }
  }
  $('#ex-image-pick').addEventListener('click', () => $('#ex-image-file').click());
  $('#ex-image-file').addEventListener('change', (e) => handleImageFile(e.target.files && e.target.files[0]));
  // Camera: capture="environment" opens the rear camera directly on mobile.
  $('#ex-image-camera').addEventListener('click', () => $('#ex-image-camera-file').click());
  $('#ex-image-camera-file').addEventListener('change', (e) => handleImageFile(e.target.files && e.target.files[0]));
  const initialClear = $('#ex-image-clear');
  if (initialClear) {
    initialClear.addEventListener('click', () => { pickedImage = null; refreshPreview(); });
  }

  $('#save-exercise-btn').addEventListener('click', () => {
    const name = $('#ex-name').value.trim();
    const category = $('#ex-category').value;
    if (!name) { showToast(t('enter_name')); return; }
    // Editing a custom exercise has ALWAYS been possible — from its own detail
    // screen and from "My exercises". Neither is on the path you take to create
    // one: the chooser drops you straight back into the planner, so the exercise
    // you just typed a name for had no way back to that name. This carries the
    // way back with it, at the one moment the user is certainly looking for it.
    let justCreatedId = null;
    if (existing) {
      DB.exercises.update(existing.id, { name, category, customImage: pickedImage });
      backupExerciseImageFor(existing.id, pickedImage); // durable copy, best-effort
      showToast(t('updated'));
    } else {
      const created = DB.exercises.add({ name, category, customImage: pickedImage });
      backupExerciseImageFor(created.id, pickedImage); // durable copy, best-effort
      if (typeof opts.onCreated === 'function') opts.onCreated(created);
      justCreatedId = created.id;
    }
    closeModal();
    renderView(currentView);
    // AFTER closeModal: showToast() calls hideToast() first, and closing the
    // modal re-renders the view — raising the toast before either would show it
    // for an instant and then lose its listeners with the old DOM.
    if (justCreatedId) {
      showToast(t('exercise_added'), {
        actionLabel: t('edit'),
        onAction: () => openNewExerciseModal(justCreatedId),
      });
    }
  });

  setTimeout(() => $('#ex-name')?.focus(), 60);
}

// ==========================================================================
// EXERCISE DETAIL
// ==========================================================================
function renderExerciseDetail(el, exerciseId) {
  const ex = DB.exercises.getById(exerciseId);
  if (!ex) {
    el.innerHTML = emptyState({ title: t('not_found'), text: t('not_found_text') });
    return;
  }

  const sessions = DB.sessions.listByExercise(exerciseId);
  const stats = DB.sessions.bestStats(exerciseId, sessions);
  const best1rm = DB.sessions.bestOneRM(exerciseId, sessions); // Est. 1RM (kg), 0 if none
  const visibleSessions = viewContext.exerciseHistoryExpanded ? sessions : sessions.slice(0, 30);

  let prSessionId = null;
  let prWeight = 0;
  sessions.forEach((s) => s.sets.forEach((set) => {
    if (set.weight > prWeight) { prWeight = set.weight; prSessionId = s.id; }
  }));

  const imageUrl = exerciseImgSrc(ex);
  const heroHtml = imageUrl
    ? `
      <div class="detail-hero-wrap">
        <div class="detail-hero">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(exDisplayName(ex))}" referrerpolicy="no-referrer"
               onerror="this.closest('.detail-hero').classList.add('empty'); this.remove();">
        </div>
        <div class="detail-hero-overlay">
          <div class="detail-hero-name">${escapeHtml(exDisplayName(ex))}</div>
          <div class="detail-hero-cat pill cat-${escapeHtml(ex.category)}">${escapeHtml(categoryLabel(ex.category))}</div>
        </div>
      </div>
    `
    : `
      <div class="detail-hero-wrap">
        <div class="detail-hero empty">${ex.isCustom ? t('custom_exercise_label') : escapeHtml(categoryLabel(ex.category).toUpperCase())}</div>
        <div class="detail-hero-overlay">
          <div class="detail-hero-name">${escapeHtml(exDisplayName(ex))}</div>
          <div class="detail-hero-cat pill cat-${escapeHtml(ex.category)}">${escapeHtml(categoryLabel(ex.category))}</div>
        </div>
      </div>
    `;

  const sessionsHtml = visibleSessions.map((s) => {
    const volume = s.sets.reduce((tt, x) => tt + x.reps * x.weight, 0);
    const isPR = s.id === prSessionId;
    const setsHtml = s.sets.map((set, i) => {
      const isBest = isPR && set.weight === prWeight;
      return `
        <div class="sets-row ${isBest ? 'best' : ''}">
          <div class="sets-row-n">${t('set_n')} ${i + 1}</div>
          <div class="sets-row-reps">
            <span class="sets-row-num num">${escapeHtml(String(set.reps))}</span>
            <span class="sets-row-unit">${t('reps')}</span>
          </div>
          <div class="sets-row-weight">${fmtWeightDual(set.weight)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="session-card ${isPR ? 'pr' : ''}">
        <div class="session-card-header">
          <div>
            <div class="session-card-date">
              ${formatDate(s.date)}
              ${isPR ? `<span class="pill pr">${t('pr')}</span>` : ''}
            </div>
            <div class="session-card-ago">${daysAgoLocalized(s.date)}</div>
          </div>
          <div class="session-card-volume">
            <div class="session-card-volume-label">${t('volume_label')}</div>
            <div class="session-card-volume-value">${fmtWeightDualRound(volume)}</div>
          </div>
        </div>
        ${setsHtml}
        <div class="session-actions">
          <button class="icon-btn" data-edit-session="${escapeHtml(s.id)}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 20)}</button>
          <button class="icon-btn danger" data-delete-session="${escapeHtml(s.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 20)}</button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(exDisplayName(ex))}</div>
      ${ex.isCustom ? `<button class="icon-btn icon-btn-tile" id="edit-exercise-btn" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 20)}</button>
      <button class="icon-btn icon-btn-tile danger" id="delete-exercise-btn" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 20)}</button>` : ''}
    </div>

    ${heroHtml}

    <div class="stat-row stat-row-4">
      <div class="stat-box">
        <div class="stat-box-label">${t('max_weight')}</div>
        <div class="stat-box-value ${stats.maxWeight === 0 ? 'none' : 'accent'} num">
          ${stats.maxWeight > 0 ? fmtWeight(stats.maxWeight) : '—'}<span class="stat-box-unit">${stats.maxWeight > 0 ? unitLabel() : ''}</span>
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('max_reps')}</div>
        <div class="stat-box-value ${stats.maxReps === 0 ? 'none' : ''} num">
          ${stats.maxReps > 0 ? stats.maxReps : '—'}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('total_sets')}</div>
        <div class="stat-box-value ${stats.totalSets === 0 ? 'none' : ''} num">
          ${stats.totalSets > 0 ? fmtNum(stats.totalSets) : '—'}
        </div>
      </div>
      <button class="stat-box" data-goto="personal-records" aria-label="${escapeHtml(t('pr_card'))}">
        <div class="stat-box-label">${t('pr_est_orm')}</div>
        <div class="stat-box-value ${best1rm === 0 ? 'none' : 'accent'} num">
          ${best1rm > 0 ? fmtWeight(best1rm) : '—'}<span class="stat-box-unit">${best1rm > 0 ? unitLabel() : ''}</span>
        </div>
      </button>
    </div>

    ${chartHtmlForExercise(exerciseId, sessions)}

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('history')}</div>
      <button class="btn btn-primary" id="add-session-btn">${icon('plus', 20)} ${t('log_session')}</button>
    </div>

    ${sessions.length === 0
      ? emptyState({ iconName: 'dumbbell', title: t('no_sessions'), text: t('log_session_tap') })
      : `<div class="session-list">${sessionsHtml}</div>`
    }
  `;

  if (visibleSessions.length < sessions.length) {
    const showMore = document.createElement('button');
    showMore.type = 'button';
    showMore.className = 'btn btn-ghost btn-block';
    showMore.id = 'show-more-sessions';
    showMore.textContent = t('show_more');
    $('.session-list', el).after(showMore);
  }

  $('#add-session-btn', el).addEventListener('click', () => openSessionModal(exerciseId));
  $('#show-more-sessions', el)?.addEventListener('click', () => {
    viewContext.exerciseHistoryExpanded = true;
    renderExerciseDetail(el, exerciseId);
  });


  el.querySelectorAll('[data-edit-session]').forEach((b) =>
    b.addEventListener('click', () => openSessionModal(exerciseId, b.dataset.editSession))
  );
  el.querySelectorAll('[data-delete-session]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_session_q'),
        text: t('delete_session_text'),
        onConfirm: () => {
          DB.sessions.remove(b.dataset.deleteSession);
          showToast(t('session_deleted'));
          renderExerciseDetail(el, exerciseId);
        },
      });
    })
  );

  // Edit a custom exercise from its own detail page (was reachable only from the
  // separate "تماريني" screen) — edit + delete now live together.
  $('#edit-exercise-btn', el)?.addEventListener('click', () => openNewExerciseModal(exerciseId));

  const delBtn = $('#delete-exercise-btn', el);
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_exercise_q'),
        text: t('delete_exercise_text'),
        onConfirm: () => {
          DB.exercises.remove(exerciseId);
          showToast(t('exercise_deleted'));
          navigate('workouts');
        },
      });
    });
  }
}

function openSessionModal(exerciseId, sessionId = null) {
  const existing = sessionId ? DB.sessions.listByExercise(exerciseId).find((s) => s.id === sessionId) : null;
  const lastSession = DB.sessions.lastForExercise(exerciseId, sessionId);

  let sets = existing
    ? existing.sets.map((s) => ({ reps: s.reps, weight: s.weight }))
    : lastSession
    ? lastSession.sets.map((s) => ({ reps: s.reps, weight: s.weight }))
    : [{ reps: 10, weight: 0 }]; // start with one set; user adds/removes as needed

  const initialDate = existing ? existing.date : todayISO();

  // Per-session unit selector (starts from user pref, but can be toggled inside the modal).
  // Stored weight is always kg internally; this only affects what the user types/sees here.
  let modalUnit = (DB.prefs.get().unit) || 'kg';

  function modalConvertForDisplay(kg) {
    if (modalUnit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2;
    return Math.round(kg * 100) / 100;
  }
  function modalConvertToKg(value) {
    if (modalUnit === 'lb') return Math.round((value / KG_TO_LB) * 100) / 100;
    return Number(value);
  }

  function renderSetsEditor() {
    const editor = $('#sets-editor');
    if (!editor) return;
    // Update the unit-column header to match the current modal unit
    const unitColEl = document.querySelector('#sets-unit-col');
    if (unitColEl) unitColEl.textContent = modalUnit.toUpperCase();

    editor.innerHTML = sets.map((s, i) => {
      const wDisplay = s.weight === '' || s.weight == null ? '' : modalConvertForDisplay(Number(s.weight));
      return `
      <div class="set-edit-row" data-set-index="${i}">
        <div class="set-edit-n num">${i + 1}</div>
        <!-- numAttr, not the raw value: both fields come from the synced blob or
             an imported backup, and an unquoted-breakout string here would land
             inside an ATTRIBUTE in innerHTML. A number input can only hold a
             number, so coercing is both stricter and simpler than escaping. -->
        <input type="number" inputmode="numeric" step="1" min="0" placeholder="0" value="${numAttr(s.reps)}" data-field="reps">
        <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" value="${numAttr(wDisplay)}" data-field="weight">
        <button type="button" class="set-remove" data-remove-set="${i}" aria-label="${escapeHtml(t('delete'))}">${icon('close', 16)}</button>
      </div>
      `;
    }).join('');

    editor.querySelectorAll('.set-edit-row').forEach((row) => {
      const idx = Number(row.dataset.setIndex);
      row.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', () => {
          const v = inp.value;
          if (inp.dataset.field === 'weight') {
            sets[idx].weight = v === '' ? '' : modalConvertToKg(Number(v));
          } else {
            sets[idx][inp.dataset.field] = v === '' ? '' : Number(v);
          }
        });
      });
      row.querySelector('[data-remove-set]').addEventListener('click', () => {
        if (sets.length <= 1) { showToast(t('set_min_one')); return; }
        sets.splice(idx, 1);
        renderSetsEditor();
      });
    });
  }

  function setModalUnit(u) {
    if (u !== 'kg' && u !== 'lb') return;
    if (u === modalUnit) return;
    modalUnit = u;
    document.querySelectorAll('[data-modal-unit]').forEach((b) => {
      b.classList.toggle('active', b.dataset.modalUnit === modalUnit);
    });
    renderSetsEditor();
  }

  const ex = DB.exercises.getById(exerciseId);
  const lastPreview = lastSession ? `
    <div class="prev-session">
      <div class="prev-session-head">
        <span>${t('last_session')}</span>
        <span>${daysAgoLocalized(lastSession.date)}</span>
      </div>
      <div class="prev-session-sets">
        ${lastSession.sets.map((s) => `${escapeHtml(String(s.reps))} × ${fmtWeight(s.weight)}${unitLabel()}`).join(' · ')}
      </div>
    </div>
  ` : '';

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_session') : t('log_session')}</div>
        <div class="modal-subtitle">${escapeHtml(exDisplayName(ex))}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    ${lastPreview}

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="session-date" value="${escapeHtml(initialDate)}">
    </div>

    <div class="form-group">
      <div class="sets-label-row">
        <label class="form-label" style="margin:0">${t('sets')}</label>
        <div class="modal-unit-toggle" role="group" aria-label="${escapeHtml(t('unit'))}">
          <button type="button" data-modal-unit="kg" class="${modalUnit === 'kg' ? 'active' : ''}">KG</button>
          <button type="button" data-modal-unit="lb" class="${modalUnit === 'lb' ? 'active' : ''}">LB</button>
        </div>
      </div>
      <div class="sets-editor-head">
        <div>${t('set_n')}</div>
        <div>${t('reps')}</div>
        <div id="sets-unit-col">${modalUnit.toUpperCase()}</div>
        <div></div>
      </div>
      <div class="sets-editor" id="sets-editor"></div>
      <button type="button" class="set-add-btn" id="add-set-btn">${icon('plus', 16)} ${t('add_set')}</button>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-session-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  renderSetsEditor();

  document.querySelectorAll('[data-modal-unit]').forEach((b) =>
    b.addEventListener('click', () => setModalUnit(b.dataset.modalUnit))
  );

  $('#add-set-btn').addEventListener('click', () => {
    const last = sets[sets.length - 1];
    sets.push({ reps: last?.reps || 10, weight: last?.weight || 0 });
    renderSetsEditor();
  });

  $('#save-session-btn').addEventListener('click', () => {
    const date = $('#session-date').value || todayISO();
    const cleaned = sets
      .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
      .filter((s) => s.reps > 0 || s.weight > 0);
    if (cleaned.length === 0) { showToast(t('add_at_least_one')); return; }
    // Snapshot BEFORE write (full snapshot including the session being edited)
    const prior = DB.sessions.prSnapshot(exerciseId);
    if (existing) {
      DB.sessions.update(existing.id, { date, sets: cleaned });
    } else {
      DB.sessions.add({ exerciseId, date, sets: cleaned });
    }
    const prMsg = checkPR(exerciseId, prior, cleaned);
    if (prMsg) {
      showToast(prMsg);
    } else {
      showToast(existing ? t('session_updated') : t('session_saved'));
    }
    closeModal();
    renderView(currentView);
    maybeAskNotifPermission();
  });
}

// ==========================================================================
// CARDIO
// ==========================================================================
function renderCardio(el) {
  const list = DB.cardio.list();
  const { thisStart, thisEnd } = weekRanges();
  const weekItems = list.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const weekMin = weekItems.reduce((s, c) => s + c.duration, 0);
  const weekCal = weekItems.reduce((s, c) => s + c.calories, 0);

  const builtInClsMap = {
    treadmill: 'treadmill',
    walking: 'walking',
    running: 'running',
    cycling: 'cycling',
  };

  function resolveCardioType(typeId) {
    const def = DB.cardioTypes.findById(typeId);
    if (def) return { label: def.isCustom ? def.label : t(def.id), iconName: def.iconName, cls: builtInClsMap[def.id] || 'custom' };
    return { label: typeId, iconName: 'heart', cls: '' };
  }

  const items = list.map((c) => {
    const tm = resolveCardioType(c.type);
    return `
      <div class="data-row">
        <div class="data-icon ${tm.cls}">${icon(tm.iconName, 20)}</div>
        <div class="data-main">
          <div class="data-title">${escapeHtml(tm.label)}${c.source === 'health' ? `<span class="src-badge">${icon('refresh', 16)}${t('from_watch')}</span>` : ''}</div>
          <div class="data-meta">
            <span>${escapeHtml(daysAgoLocalized(c.date))}</span>
            <span class="dot-sep"></span>
            <!-- Coerced, not interpolated raw. These arrive from the synced
                 blob and from imported backups, both of which CLAUDE.md names
                 as untrusted, and they land in innerHTML — so a string field
                 carrying markup would execute. A number field can only ever be
                 a number; forcing that is stricter than escaping and cheaper. -->
            <span class="num">${fmtNum(Math.round(Number(c.duration) || 0))} ${t('minutes').toLowerCase()}</span>
            <span class="dot-sep"></span>
            <span class="num">${fmtNum(Math.round(Number(c.calories) || 0))} ${t('cal')}</span>
          </div>
        </div>
        <div class="data-actions">
          <button class="icon-btn" data-edit-cardio="${escapeHtml(c.id)}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-delete-cardio="${escapeHtml(c.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    ${vaultBar()}

    <div class="page-header">
      <div class="page-eyebrow">${t('this_week')}</div>
      <h1 class="page-title">${t('cardio')}</h1>
      <p class="page-subtitle">${t('cardio_subtitle')}</p>
    </div>

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-box-label">${t('sessions_w')}</div>
        <div class="stat-box-value num">${weekItems.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('minutes')}</div>
        <div class="stat-box-value num">${weekMin}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('calories')}</div>
        <div class="stat-box-value num">${weekCal}</div>
      </div>
    </div>

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('all_sessions')}</div>
      <button class="btn btn-primary" id="add-cardio-btn">${icon('plus', 20)} ${t('log')}</button>
    </div>

    ${list.length === 0
      ? emptyState({ iconName: 'run', title: t('no_cardio'), text: t('no_cardio_text') })
      : `<div class="data-list">${items}</div>`
    }
  `;

  // Single add button: the labeled "Log" button (the top-bar + was a duplicate).
  $('#add-cardio-btn', el).addEventListener('click', () => openCardioModal());
  el.querySelectorAll('[data-edit-cardio]').forEach((b) =>
    b.addEventListener('click', () => openCardioModal(b.dataset.editCardio))
  );
  el.querySelectorAll('[data-delete-cardio]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_cardio_q'),
        text: t('delete_cardio_text'),
        onConfirm: () => {
          DB.cardio.remove(b.dataset.deleteCardio);
          showToast(t('deleted'));
          renderCardio(el);
        },
      });
    })
  );

  // Pull the watch's newest exercise sessions on open. Health Connect sessions
  // already import into this very list (DB.cardio.importFromHealth, badged
  // "Watch"), but the only thing that ever triggered a sync was rendering HOME —
  // so opening Cardio directly showed whatever was cached last time. No-op on
  // web, no-op without permission, throttled to once per 20s; when it does bring
  // something new, Health re-renders this view itself.
  if (typeof Health !== 'undefined' && Health.autoSync) Health.autoSync();
}

function openCardioModal(cardioId = null) {
  const existing = cardioId ? DB.cardio.list().find((c) => c.id === cardioId) : null;
  let selectedType = existing ? existing.type : 'treadmill';

  function buildTypeOptionsHtml() {
    const all = DB.cardioTypes.allTypes();
    const opts = all.map((tt) => {
      const label = tt.isCustom ? tt.label : t(tt.id);
      const ic = tt.iconName || 'heart';
      // Icon in a tinted tile, like .tool-pod-icon everywhere else in the app — a
      // bare 20px glyph floating over a card is what made this grid look unfinished.
      return `
        <button type="button" class="type-option ${tt.id === selectedType ? 'active' : ''}" data-type="${escapeHtml(tt.id)}">
          <span class="type-option-icon" aria-hidden="true">${icon(ic, 22)}</span>
          <div class="type-option-label">${escapeHtml(label)}</div>
        </button>
      `;
    }).join('');
    return opts + `
      <button type="button" class="type-option type-option-add" id="cardio-add-type">
        ${icon('plus', 20)}
        <div class="type-option-label">${t('new_cardio_type')}</div>
      </button>
    `;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_cardio') : t('log_cardio')}</div>
        <div class="modal-subtitle">${t('cardio_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('type')}</label>
      <div class="type-selector" id="cardio-type-selector">${buildTypeOptionsHtml()}</div>
    </div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="cardio-date" value="${escapeHtml(existing ? existing.date : todayISO())}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('duration_min')}</label>
        <input type="number" inputmode="numeric" id="cardio-duration" step="1" min="0" value="${numAttr(existing && existing.duration)}" placeholder="30">
      </div>
      <div class="form-group">
        <label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="numeric" id="cardio-calories" step="1" min="0" value="${numAttr(existing && existing.calories)}" placeholder="250">
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-cardio-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  $('#cardio-type-selector').addEventListener('click', (e) => {
    if (e.target.closest('#cardio-add-type')) {
      openNewCardioTypeModal((created) => {
        // Re-render the selector and select the new type
        selectedType = created.id;
        $('#cardio-type-selector').innerHTML = buildTypeOptionsHtml();
      });
      return;
    }
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    selectedType = btn.dataset.type;
    $('#cardio-type-selector').querySelectorAll('.type-option').forEach((b) =>
      b.classList.toggle('active', b.dataset.type === selectedType)
    );
  });

  $('#save-cardio-btn').addEventListener('click', () => {
    const date = $('#cardio-date').value || todayISO();
    const duration = Number($('#cardio-duration').value);
    const calories = Number($('#cardio-calories').value);
    if (!duration || duration <= 0) { showToast(t('enter_duration')); return; }
    if (existing) {
      DB.cardio.update(existing.id, { type: selectedType, date, duration, calories });
      showToast(t('updated'));
    } else {
      DB.cardio.add({ type: selectedType, date, duration, calories });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });
}

// Modal: create a custom cardio type. Persists into DB.cardioTypes and is
// available immediately in the cardio type selector.
function openNewCardioTypeModal(onCreated) {
  let pickedIcon = 'heart';

  function iconChipsHtml() {
    return CARDIO_ICON_OPTIONS.map((nm) => `
      <button type="button" class="cardio-icon-chip ${nm === pickedIcon ? 'active' : ''}" data-cardio-icon="${nm}" aria-label="${nm}">
        ${icon(nm, 20)}
      </button>
    `).join('');
  }

  // We need to lay this on top of the existing modal (cardio modal). Use a
  // nested overlay so closing this only closes the new-type sub-modal.
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay nested';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">${t('new_cardio_type')}</div>
          <div class="modal-subtitle">${t('new_cardio_type_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-cardio-type-cancel aria-label="${escapeHtml(t('cancel'))}">${icon('close', 20)}</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t('name')}</label>
        <input type="text" id="cardio-type-name" placeholder="${t('cardio_type_name_ph')}">
      </div>

      <div class="form-group">
        <label class="form-label">${t('icon')}</label>
        <div class="cardio-icon-chips" id="cardio-type-icons">${iconChipsHtml()}</div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-cardio-type-cancel>${t('cancel')}</button>
        <button type="button" class="btn btn-primary" id="cardio-type-save">${t('save')}</button>
      </div>
    </div>
  `;
  $('#modal-root').appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.querySelectorAll('[data-cardio-type-cancel]').forEach((b) => b.addEventListener('click', close));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#cardio-type-icons').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cardio-icon]');
    if (!chip) return;
    pickedIcon = chip.dataset.cardioIcon;
    overlay.querySelectorAll('[data-cardio-icon]').forEach((b) =>
      b.classList.toggle('active', b.dataset.cardioIcon === pickedIcon)
    );
  });

  overlay.querySelector('#cardio-type-save').addEventListener('click', () => {
    const name = overlay.querySelector('#cardio-type-name').value.trim();
    if (!name) { showToast(t('enter_name')); return; }
    const created = DB.cardioTypes.add({ label: name, iconName: pickedIcon });
    if (!created) return;
    showToast(t('saved'));
    close();
    if (typeof onCreated === 'function') onCreated(created);
  });

  setTimeout(() => overlay.querySelector('#cardio-type-name')?.focus(), 30);
}

// ==========================================================================
// FOOD
// ==========================================================================

// Built-in catalog of common foods with pre-computed macros (per serving).
// Bilingual name + serving; calories/protein/carbs match the DB.foods shape.
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
const FOOD_CAT_ORDER = ['protein', 'carbs', 'legumes', 'dairy', 'fruit', 'veg', 'fats', 'meals', 'drinks'];
function foodPresetName(p) { return (DB.prefs.get().lang || 'en') === 'ar' ? p.ar : p.en; }
function foodPresetServing(p) { return (DB.prefs.get().lang || 'en') === 'ar' ? p.sa : p.s; }

// Admin-curated global foods (server `food_catalog`, pulled at boot — see
// bootCatalog()). Reshaped into the same { cat, en, ar, s, sa, cal, pro, carb }
// preset shape as FOOD_PRESETS so the quick-add picker can render/search/tap
// them identically. There's no separate admin ar/en pair, so both fields hold
// the single stored name (same pattern as any other untranslated user content
// in the app, e.g. custom exercise/food names). Grouped under its own "More"
// category so it never disturbs the curated built-in categories above.
let SERVER_FOOD_PRESETS = [];
function setServerFoodCatalog(rows) {
  try {
    SERVER_FOOD_PRESETS = (Array.isArray(rows) ? rows : [])
      .filter((f) => f && f.name)
      .map((f) => ({
        cat: 'more',
        en: String(f.name), ar: String(f.name),
        s: f.serving || '', sa: f.serving || '',
        cal: Number(f.calories) || 0, pro: Number(f.protein) || 0, carb: Number(f.carbs) || 0,
      }));
  } catch (_) { SERVER_FOOD_PRESETS = []; }
}
function allFoodPresets() { return SERVER_FOOD_PRESETS.length ? FOOD_PRESETS.concat(SERVER_FOOD_PRESETS) : FOOD_PRESETS; }
function allFoodCatOrder() { return SERVER_FOOD_PRESETS.length ? FOOD_CAT_ORDER.concat(['more']) : FOOD_CAT_ORDER; }


// The Food tab is now a DAILY NUTRITION DASHBOARD: today's targets, what's been
// eaten, and — the thing the user asked to see front and centre — what's still
// LEFT for the day. One "+" button (bottom-right) opens an animated sheet with
// every way to log food (voice, chat, photo, saved, manual). The old food
// "reference library" lives on as the "saved food" add-method.
function renderFood(el) {
  const date = todayISO();

  el.innerHTML = `
    ${vaultBar()}
    <div class="page-header">
      <div class="row-between">
        <div>
          <h1 class="page-title">${t('food')}</h1>
          <p class="page-subtitle">${escapeHtml(formatDate(date))}</p>
        </div>
        <button class="link-btn" data-goto="foodlog">${t('food_history')} <span class="icon-mirror">${icon('chevronRight', 16)}</span></button>
      </div>
    </div>
    <div id="nutri-host">${nutritionDashboardHtml(date)}</div>
    <button class="food-fab" id="food-fab" aria-label="${escapeHtml(t('add'))}">${icon('plus', 28)}</button>
  `;

  const rerender = () => { const h = $('#nutri-host', el); if (h) h.innerHTML = nutritionDashboardHtml(date); };

  // A single add button: the floating FAB (the top-bar action was a duplicate).
  $('#food-fab', el)?.addEventListener('click', () => openAddSheet(date, rerender));

  // Arriving from Home's food card with "add" intent — open the sheet straight
  // away, so one tap gets the user to the thing they actually came to do.
  // It opens here rather than at the call site because the sheet needs THIS
  // view's `rerender` closure; opening it from Home would hand it a callback
  // that repaints nothing. The flag is cleared immediately so returning to Food
  // by any other route (the nav, back) does not re-open the sheet.
  if (viewContext.openAdd) {
    viewContext.openAdd = false;
    openAddSheet(date, rerender);
  }

  const host = $('#nutri-host', el);
  host?.addEventListener('click', (e) => {
    const setup = e.target.closest('[data-setup-goal]');
    if (setup) { openCalculatorModal(rerender); return; }
    const edit = e.target.closest('[data-edit-goal]');
    if (edit) { openCalculatorModal(rerender); return; }
    const water = e.target.closest('[data-add-water]');
    if (water) {
      DB.water.add(date, parseInt(water.getAttribute('data-add-water'), 10) || 0);
      rerender();
      return;
    }
    // The calorie ring answers "how much is left"; the natural next question is
    // "left after WHAT", so tapping it opens today's log. It is checked LAST so
    // the controls sitting inside the hero — the edit pencil above, the water
    // steppers — keep their own behaviour and never fall through to a navigate.
    // renderFoodLog reads viewContext.foodLog, NOT viewContext.date — passing a
    // bare `date` here would silently land on today whatever day was open.
    if (e.target.closest('.nutri-hero')) { navigate('foodlog', { foodLog: { date } }); return; }
  });

  // The calorie goal is MANDATORY: if none is set, open the calculator straight
  // away when the Food page is shown. The short delay lets the view settle and
  // avoids opening if the user immediately navigates elsewhere.
  if (!DB.nutrition.hasTargets()) {
    setTimeout(() => {
      if (currentView === 'food' && !DB.nutrition.hasTargets() && !$('#modal-root').innerHTML.trim()) {
        openCalculatorModal(rerender);
      }
    }, 250);
  }
}

// The rings + remaining + today's list. Re-rendered on its own after any change.
function nutritionDashboardHtml(date) {
  const nut = DB.nutrition;
  const consumed = DB.foodLogs.totalsForDate(date);

  // Not set up yet → invite the user to build a target.
  if (!nut.hasTargets()) {
    return `
      <button class="nutri-setup" data-setup-goal>
        <div class="nutri-setup-icon">${icon('target', 22)}</div>
        <div class="nutri-setup-main">
          <div class="nutri-setup-title">${t('nutri_setup_title')}</div>
          <div class="nutri-setup-text">${t('nutri_setup_text')}</div>
        </div>
      </button>
    `;
  }

  const waterMl = DB.water.get(date);
  const waterGoal = DB.water.goal();
  const waterPct = waterGoal > 0 ? Math.min(100, (waterMl / waterGoal) * 100) : 0;
  const waterCard = `
    <div class="water-card">
      <div class="water-head">
        <div class="water-title">${icon('droplet', 16)} <span>${t('water')}</span></div>
        <div class="water-nums"><span class="num">${fmtNum(waterMl)}</span> / <span class="num">${fmtNum(waterGoal)}</span> ${t('unit_ml')}</div>
      </div>
      <div class="water-bar"><span class="water-fill" style="width:${waterPct}%"></span></div>
      <div class="water-actions">
        <button class="water-cup" data-add-water="250">+<span class="num">250</span></button>
        <button class="water-cup" data-add-water="500">+<span class="num">500</span></button>
        <button class="water-cup water-cup-minus" data-add-water="-250" aria-label="${escapeHtml(t('water_undo'))}">${icon('minus', 16)}</button>
      </div>
    </div>`;

  const tgt = nut.get().targets;
  const calLeft = Math.round(tgt.calories - consumed.calories);
  const calPct = tgt.calories > 0 ? Math.min(100, (consumed.calories / tgt.calories) * 100) : 0;
  const over = calLeft < 0;

  // Calorie ring (SVG). r=54 → circumference ≈ 339.29.
  const C = 339.29;
  const dash = C * (calPct / 100);

  const macroBar = (key, label, cls) => {
    const c = Math.round(consumed[key] * 10) / 10;
    const g = tgt[key] || 0;
    const left = Math.round((g - c) * 10) / 10;
    const pct = g > 0 ? Math.min(100, (c / g) * 100) : 0;
    return `
      <div class="macro-track">
        <div class="macro-track-head">
          <span class="macro-track-name ${cls}">${label}</span>
          <span class="macro-track-nums"><span class="num">${fmtNum(c)}</span> / <span class="num">${fmtNum(g)}</span>g</span>
        </div>
        <div class="macro-track-bar"><span class="macro-track-fill ${cls}" style="width:${pct}%"></span></div>
        <div class="macro-track-left">${left >= 0 ? `${t('nutri_left')} <span class="num">${fmtNum(left)}</span>g` : `<span class="over">${t('nutri_over')} <span class="num">${fmtNum(-left)}</span>g</span>`}</div>
      </div>`;
  };

  return `
    <div class="nutri-hero">
      <button class="nutri-edit" data-edit-goal aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
      <div class="cal-ring-wrap">
        <svg class="cal-ring" viewBox="0 0 120 120">
          <circle class="cal-ring-bg" cx="60" cy="60" r="54"/>
          <circle class="cal-ring-fg ${over ? 'over' : ''}" cx="60" cy="60" r="54"
            stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="cal-ring-center">
          <div class="cal-ring-num num ${over ? 'over' : ''}">${fmtNum(Math.abs(calLeft))}</div>
          <div class="cal-ring-label">${over ? t('nutri_over') : t('nutri_left')}</div>
          <div class="cal-ring-sub"><span class="num">${fmtNum(Math.round(consumed.calories))}</span> / <span class="num">${fmtNum(tgt.calories)}</span> ${t('cal')}</div>
        </div>
      </div>
      <div class="macro-tracks">
        ${macroBar('protein', t('protein_label'), 'pro')}
        ${macroBar('carbs', t('carbs_label'), 'carb')}
        ${macroBar('fat', t('fat_label'), 'fat')}
      </div>
    </div>

    ${waterCard}
  `;
}

// Shared: log AI/voice/photo items to today and refresh the dashboard.
function logNutritionItems(date, items, onDone) {
  (items || []).forEach((it) => DB.foodLogs.add(date, {
    name: it.name, servings: it.servings || 1,
    calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
    source: it.source || 'ai',
  }));
  if (typeof onDone === 'function') onDone();
}

// Lazy-load the vendored ZXing decoder (~330KB) only when the scanner actually
// needs it — i.e. a browser without the native BarcodeDetector. Cached after the
// first load. Keeps the app's initial payload lean.
let _zxingPromise = null;
function loadBarcodeLib() {
  if (typeof window !== 'undefined' && window.ZXing) return Promise.resolve(window.ZXing);
  if (_zxingPromise) return _zxingPromise;
  _zxingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/zxing.min.js?v=' + VAULT_BUILD;
    s.async = true;
    s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('zxing missing')));
    s.onerror = () => { _zxingPromise = null; reject(new Error('zxing load failed')); };
    document.head.appendChild(s);
  });
  return _zxingPromise;
}

// ===========================================================================
// Barcode scanner — CAMERA scan + Open Food Facts (free, no key). Two decode
// engines: the native BarcodeDetector (fast, Android) when present, else the
// vendored ZXing decoder (any browser with a camera). Manual number entry is
// always shown as a fallback. Scan a packaged food → per-100g nutrition → pick
// grams → log.
// ===========================================================================
function openBarcodeScanner(date, onSave) {
  // Camera scanning works via the native BarcodeDetector (Android) OR the
  // vendored ZXing decoder (any browser) — so it's offered whenever a camera is
  // available. Manual number entry is always shown as a fallback. Both paths
  // feed the same Open Food Facts lookup.
  const hasDetector = (typeof window !== 'undefined') && ('BarcodeDetector' in window);
  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const canScan = hasCamera;

  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_barcode')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="barcode-stage" id="bc-stage"${canScan ? '' : ' style="display:none"'}>
      <video id="bc-video" playsinline muted></video>
      <div class="barcode-frame"></div>
    </div>
    <div class="voice-status" id="bc-status">${canScan ? t('barcode_hint') : t('barcode_manual_hint')}</div>
    <div class="bc-manual">
      <input type="text" inputmode="numeric" id="bc-manual-input" autocomplete="off"
        placeholder="${escapeHtml(t('barcode_number_ph'))}">
      <button type="button" class="btn btn-primary" id="bc-manual-go">${t('barcode_lookup')}</button>
    </div>
    <div class="ai-results" id="bc-result"></div>
  `);
  const status = overlay.querySelector('#bc-status');
  const result = overlay.querySelector('#bc-result');
  const stage = overlay.querySelector('#bc-stage');
  const video = overlay.querySelector('#bc-video');
  let stream = null, scanning = false, detector = null, zxingReader = null;
  const triedUnknown = new Set();   // codes Open Food Facts didn't recognise — don't re-hit them

  const stop = () => {
    scanning = false;
    if (zxingReader) { try { zxingReader.reset(); } catch (_) {} zxingReader = null; }
    if (stream) { try { stream.getTracks().forEach((tk) => tk.stop()); } catch (_) {} stream = null; }
  };
  // Release the camera on ANY dismissal (X / backdrop / Escape) — same guard as voice.
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) {
    const mo = new MutationObserver(() => { if (!document.body.contains(overlay)) { stop(); mo.disconnect(); } });
    mo.observe(modalRoot, { childList: true, subtree: true });
  }
  const failToManual = (denied) => {
    stop();
    if (stage) stage.style.display = 'none';
    status.textContent = denied ? t('barcode_cam_denied_manual') : t('barcode_manual_hint');
    setTimeout(() => { try { overlay.querySelector('#bc-manual-input').focus(); } catch (_) {} }, 80);
  };

  // Look up ONE code on Open Food Facts. Returns true when a product with
  // calories was found and shown (scanning then stops); false otherwise.
  async function lookup(code) {
    scanning = false;                 // pause processing while we query
    status.textContent = t('barcode_looking');
    let product = null;
    try {
      const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' +
        encodeURIComponent(code) + '.json?fields=product_name,nutriments');
      const data = await res.json();
      product = data && data.product;
    } catch (_) {}
    if (!document.body.contains(overlay)) return true;
    const n = product && product.nutriments;
    const kcal100 = n && (n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : null);
    if (!product || !n || kcal100 == null) { status.textContent = t('barcode_not_found'); return false; }
    stop();                           // got a hit → release the camera
    if (stage) stage.style.display = 'none';
    showResult(product, n);
    return true;
  }

  // Native BarcodeDetector loop (Android). On an unknown code it's remembered
  // and scanning continues for a different one.
  async function scanLoopNative() {
    if (!scanning || !detector || !document.body.contains(overlay)) return;
    try {
      const codes = await detector.detect(video);
      const code = codes && codes.length && codes[0].rawValue ? String(codes[0].rawValue) : '';
      if (code && !triedUnknown.has(code)) {
        if (await lookup(code)) return;
        triedUnknown.add(code);
        scanning = true;
      }
    } catch (_) {}
    requestAnimationFrame(scanLoopNative);
  }

  // Manual number entry — always available; the fallback when camera scanning
  // isn't supported or the camera is denied.
  const manualInput = overlay.querySelector('#bc-manual-input');
  const manualGo = overlay.querySelector('#bc-manual-go');
  const doManual = () => {
    const code = String(manualInput.value || '').replace(/\D/g, '');
    if (code.length < 6) { status.textContent = t('barcode_invalid'); manualInput.focus(); return; }
    lookup(code);
  };
  manualGo.addEventListener('click', doManual);
  manualInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doManual(); } });

  function showResult(product, n) {
    const name = String(product.product_name || t('add_barcode')).slice(0, 80);
    const per100 = {
      cal: Math.round(+n['energy-kcal_100g'] || 0),
      pro: Math.round((+n['proteins_100g'] || 0) * 10) / 10,
      carb: Math.round((+n['carbohydrates_100g'] || 0) * 10) / 10,
      fat: Math.round((+n['fat_100g'] || 0) * 10) / 10,
    };
    status.textContent = '';
    result.innerHTML = `
      <div class="bc-card">
        <div class="bc-name">${escapeHtml(name)}</div>
        <div class="bc-amount-row">
          <label class="form-label" for="bc-grams">${t('bc_amount')}</label>
          <input type="number" inputmode="numeric" id="bc-grams" value="100" min="1" step="10">
          <span class="bc-unit">${t('unit_g')}</span>
        </div>
        <div class="ai-macros" id="bc-macros"></div>
        <button class="btn btn-primary btn-block" id="bc-add">${icon('plus', 20)} ${t('ai_add_all')}</button>
      </div>`;
    const gramsInput = result.querySelector('#bc-grams');
    const macrosEl = result.querySelector('#bc-macros');
    const scaled = () => {
      const g = Math.max(1, parseInt(gramsInput.value, 10) || 100);
      const f = g / 100;
      return {
        name: name + ' ~' + fmtNum(g) + t('unit_g'),
        calories: Math.round(per100.cal * f),
        protein: Math.round(per100.pro * f * 10) / 10,
        carbs: Math.round(per100.carb * f * 10) / 10,
        fat: Math.round(per100.fat * f * 10) / 10,
      };
    };
    const renderMacros = () => {
      const s = scaled();
      macrosEl.innerHTML =
        `<span class="ai-macro cal"><b class="num">${fmtNum(s.calories)}</b>${t('cal')}</span>` +
        `<span class="ai-macro pro"><b class="num">${fmtNum(s.protein)}</b>g ${t('protein_label')}</span>` +
        `<span class="ai-macro carb"><b class="num">${fmtNum(s.carbs)}</b>g ${t('carbs_label')}</span>` +
        `<span class="ai-macro fat"><b class="num">${fmtNum(s.fat)}</b>g ${t('fat_label')}</span>`;
    };
    renderMacros();
    gramsInput.addEventListener('input', renderMacros);
    result.querySelector('#bc-add').addEventListener('click', () => {
      logNutritionItems(date, [Object.assign(scaled(), { source: 'barcode' })], onSave);
      showToast(t('ai_added'));
      closeModal();
    });
  }

  // ----- pick a camera engine -----
  if (!hasCamera) { failToManual(false); return; }   // no camera at all → manual only

  // Engine A: native BarcodeDetector (fast) when the browser has it.
  if (hasDetector) {
    try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }); }
    catch (_) { try { detector = new BarcodeDetector(); } catch (__) { detector = null; } }
  }
  if (detector) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => { stream = s; video.srcObject = s; video.play().catch(() => {}); scanning = true; requestAnimationFrame(scanLoopNative); })
      .catch(() => failToManual(true));
    return;
  }

  // Engine B: ZXing decoder (works in any browser with a camera). Lazy-loaded.
  status.textContent = t('barcode_loading');
  loadBarcodeLib().then((ZX) => {
    if (!document.body.contains(overlay)) return;
    zxingReader = new ZX.BrowserMultiFormatReader();
    scanning = true;
    status.textContent = t('barcode_hint');
    return zxingReader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, async (res2) => {
      if (!scanning || !res2 || typeof res2.getText !== 'function') return;   // no barcode in this frame
      const code = String(res2.getText());
      if (triedUnknown.has(code)) return;
      if (await lookup(code)) return;   // found → shown + stopped
      triedUnknown.add(code);           // unknown → skip it, keep scanning
      scanning = true;
    });
  }).catch(() => failToManual(true));
}

// ===========================================================================
// Add sheet — one "+" opens an animated bottom sheet with every add method.
// ===========================================================================
function openAddSheet(date, onChange) {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('add-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'add-sheet-overlay';
  overlay.className = 'sheet-overlay';
  // A grid of consistent square tiles — one icon + label per tile.
  const tile = (m) => `
    <button class="add-tile" data-method="${m.k}">
      <span class="add-tile-icon ${m.k}">${icon(m.icon, 24)}</span>
      <span class="add-tile-title">${m.title}</span>
    </button>`;
  overlay.innerHTML = `
    <div class="add-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="add-sheet-title">${t('add_sheet_title')}</div>
      <div class="add-grid">
        ${tile({ k: 'voice', icon: 'mic', title: t('add_voice') })}
        ${tile({ k: 'chat', icon: 'message', title: t('add_chat') })}
        ${tile({ k: 'photo', icon: 'camera', title: t('add_photo') })}
        ${tile({ k: 'barcode', icon: 'barcode', title: t('add_barcode') })}
        ${tile({ k: 'saved', icon: 'utensils', title: t('add_saved') })}
        ${tile({ k: 'manual', icon: 'edit', title: t('add_manual') })}
      </div>
    </div>`;
  app.appendChild(overlay);
  // Next frame → add .open so the sheet transitions up smoothly.
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = (cb) => {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); if (typeof cb === 'function') cb(); }, 260);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); return; }
    const btn = e.target.closest('[data-method]');
    if (!btn) return;
    const method = btn.dataset.method;
    close(() => {
      if (method === 'voice') openVoiceCapture(date, onChange);
      else if (method === 'chat') FoodAI.open(date);
      else if (method === 'photo') FoodAI.openPhoto ? FoodAI.openPhoto(date) : FoodAI.open(date);
      else if (method === 'barcode') openBarcodeScanner(date, onChange);
      else if (method === 'saved') openSavedFoodPicker(date, onChange);
      else if (method === 'manual') openManualFoodEntry(date, onChange);
    });
  });
}

// ===========================================================================
// THE REST-DAY SHEET  ("Vault Rest Day" spec, section 02)
//
// The old control was a silent checkbox: press it and the day was gone with no
// resistance at all. This asks ONE question first, and carries the single rule
// that actually changes behaviour — DON'T TAKE TWO IN A ROW — then lets the user
// out through a middle option (least effort) rather than through zero.
//
// Copy rules from the spec, encoded here so they survive editing:
//   · The text speaks in the USER's voice, not the app's. "I'll do what I can"
//     is a promise he made, which is harder to walk back than a button labelled
//     "start a short workout".
//   · No threats and no red. Red is for deletion. The second-day-in-a-row case
//     takes GOLD — the same colour as the streak that is on the line.
//   · It appears once a day. Twice turns advice into nuisance, and nuisance gets
//     ignored. DB.plan.markRestPrompted() is the gate.
// ===========================================================================
function openRestSheet() {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('rest-sheet-overlay')?.remove();

  const todayIso = todayISO();
  // "Second day in a row" is asked of YESTERDAY's declared rest, not of whether
  // yesterday happened to be a scheduled non-training weekday — a Friday off in
  // a 5-day plan is the plan working, not a lapse.
  const secondInARow = DB.plan.isRest(addDaysISO(todayIso, -1));
  const streak = computeStreak();

  const overlay = document.createElement('div');
  overlay.id = 'rest-sheet-overlay';
  overlay.className = 'sheet-overlay';

  const stepOne = () => `
    <div class="rest-sheet-icon${secondInARow ? ' warn' : ''}">${icon(secondInARow ? 'flame' : 'moon', 28)}</div>
    <div class="rest-sheet-head">
      <div class="rest-sheet-title">${secondInARow ? t('rest_sheet_title_2') : t('rest_sheet_title_1')}</div>
      <div class="rest-sheet-body">${secondInARow ? t('rest_sheet_body_2') : t('rest_sheet_body_1')}</div>
    </div>
    ${secondInARow ? `
      <div class="rest-last7">
        <div class="l7-label">${t('last_7_days')}</div>
        ${weekStrip(null, 'compact')}
      </div>`
    : streak > 0 ? `
      <div class="rest-streak">
        ${icon('trophy', 22)}
        <div>${t('rest_streak_line')
          .replace('{n}', `<b class="num">${fmtNum(streak)}</b>`)}</div>
      </div>` : ''}
    <div class="rest-sheet-actions">
      <button class="btn btn-primary btn-block" data-rest="minimum">${t('rest_do_what_i_can')}</button>
      <button class="btn btn-ghost btn-block" data-rest="full">
        ${secondInARow ? t('rest_full_again') : t('rest_full_rest')}
      </button>
    </div>`;

  // Step 2 — the middle option. Three sizes of "something", so the answer to
  // "I can't do the session" is never forced to be "then nothing".
  const stepTwo = () => {
    const plan = DB.plan.workoutForDate(new Date());
    const byId = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
    const exObjs = (plan?.exerciseIds || []).map((id) => byId[id]).filter(Boolean);
    // "The heaviest movement in the plan" — by best estimated 1RM, which is the
    // only ranking the app already knows. Falls back to plan order when nothing
    // has been logged yet.
    const exerciseStats = DB.sessions.statsByExercise();
    const heaviest = exObjs.slice().sort(
      (a, b) => (exerciseStats[b.id]?.bestORM || 0) - (exerciseStats[a.id]?.bestORM || 0))[0] || exObjs[0];
    const opts = [];
    if (heaviest) {
      opts.push({ k: 'one', mins: 10, icon: 'dumbbell',
        title: t('rest_min_one'), sub: t('rest_min_one_sub') });
    }
    if (exObjs.length > 2) {
      opts.push({ k: 'half', mins: 20, icon: 'columns',
        title: t('rest_min_half'), sub: t('rest_min_half_sub') });
    }
    opts.push({ k: 'walk', mins: 15, icon: 'walk',
      title: t('rest_min_walk'), sub: t('rest_min_walk_sub') });

    // THE FIRST OPTION IS PRE-SELECTED AND A BUTTON CONFIRMS IT. Handing back a
    // bare list right after the user said "I'll do what I can" spends the
    // momentum that sentence just created — they have to decide again. Selected
    // by default, the whole step costs one tap.
    return effortStep(t('rest_min_title'), t('rest_min_sub'), opts, t('rest_min_go'));
  };

  // Shared by both sheets: same shape, opposite direction.
  function effortStep(title, sub, opts, goLabel) {
    return `
      <div class="rest-sheet-head">
        <div class="rest-sheet-title">${title}</div>
        <div class="rest-sheet-body">${sub}</div>
      </div>
      <div class="min-options">
        ${opts.map((o, i) => `
          <button class="min-option${i === 0 ? ' sel' : ''}" data-pick="${o.k}" data-mins="${o.mins}">
            <span class="min-badge num" dir="ltr">${fmtNum(o.mins)}${t('minutes_short')}</span>
            <span class="min-text">
              <span class="min-title">${o.title}</span>
              <span class="min-sub${o.cost ? ' is-cost' : ''}">${o.sub}</span>
            </span>
            <span class="min-check">${icon('check', 16)}</span>
          </button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" data-go>
        ${goLabel.replace('{n}', fmtNum(opts[0].mins))}
      </button>`;
  }

  const paint = (step) => {
    overlay.innerHTML = `
      <div class="add-sheet rest-sheet" role="dialog" aria-modal="true"
           aria-label="${escapeHtml(t('rest_sheet_title_1'))}">
        <div class="sheet-handle"></div>
        ${step === 1 ? stepOne() : stepTwo()}
      </div>`;
  };
  paint(1);
  app.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  DB.plan.markRestPrompted();

  const close = (cb) => {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); if (typeof cb === 'function') cb(); }, 260);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); return; }

    const step1 = e.target.closest('[data-rest]');
    if (step1) {
      if (step1.dataset.rest === 'minimum') { paint(2); return; }
      // Full rest. THIS is the only place the day is actually marked off.
      DB.plan.setRest(new Date(), true);
      close(() => { showToast(t('rest_today_on')); renderView('home'); });
      return;
    }

    // Selecting only MARKS the choice; the primary button commits it. The
    // button's label carries the chosen duration, so the commitment is stated
    // in the same words the user picked.
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      overlay.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('sel', b === pick));
      const go = overlay.querySelector('[data-go]');
      if (go) go.textContent = t('rest_min_go').replace('{n}', fmtNum(Number(pick.dataset.mins) || 10));
      return;
    }
    const go = e.target.closest('[data-go]');
    if (!go) return;
    const sel = overlay.querySelector('[data-pick].sel');
    if (!sel) return;
    close(() => startMinimumSession(sel.dataset.pick, Number(sel.dataset.mins) || 10));
  });
}

// ===========================================================================
// THE SCHEDULED REST DAY — the same sheet pointed the other way.
//
// On a day the PLAN calls rest there is nothing to undo, so "I could train
// today" does not simply flip a flag: it offers something light that does not
// borrow from tomorrow. The third option DOES borrow, and says so in gold —
// otherwise the button quietly burns the next session and the user finds out
// two days later.
// ===========================================================================
function openTrainAnywaySheet() {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('rest-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'rest-sheet-overlay';
  overlay.className = 'sheet-overlay';

  // Muscles this week's plan never touches. Read from the same helper the plan
  // card uses, so the two can never name different muscles for the same week.
  const lagging = (() => {
    const byId = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
    const planned = new Set();
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const w = DB.plan.workoutForDate(d);
      if (w) (w.exerciseIds || []).map((id) => byId[id]).filter(Boolean)
        .forEach((ex) => getMusclesForExercise(ex).forEach((m) => planned.add(m)));
      d.setDate(d.getDate() + 1);
    }
    // Compared against the app's OWN muscle vocabulary, not a hand-written list:
    // getMusclesForExercise returns these exact keys, so a muscle can never be
    // reported "lagging" under a name the rest of the app does not use.
    const ALL = ['chest', 'upper_chest', 'front_delts', 'side_delts', 'rear_delts',
      'biceps', 'triceps', 'lats', 'upper_back', 'traps', 'abs',
      'quads', 'hamstrings', 'glutes', 'calves'];
    return ALL.filter((m) => !planned.has(m)).slice(0, 2);
  })();

  const opts = [
    { k: 'cardio', mins: 20, title: t('anyway_cardio'), sub: t('anyway_cardio_sub') },
    ...(lagging.length ? [{ k: 'lag', mins: 15, title: t('anyway_lagging'),
        sub: t('anyway_lagging_sub2').replace('{m}', joinNames(
          lagging.map((m) => t('muscle_' + m, m)))) }] : []),
    { k: 'full', mins: 45, title: t('anyway_tomorrow'), sub: t('anyway_tomorrow_sub'), cost: true },
  ];

  overlay.innerHTML = `
    <div class="add-sheet rest-sheet" role="dialog" aria-modal="true"
         aria-label="${escapeHtml(t('anyway_title'))}">
      <div class="sheet-handle"></div>
      <div class="rest-sheet-icon go">${icon('zap', 28)}</div>
      <div class="rest-sheet-head">
        <div class="rest-sheet-title">${t('anyway_title')}</div>
        <div class="rest-sheet-body">${t('anyway_body')}</div>
      </div>
      <div class="min-options">
        ${opts.map((o, i) => `
          <button class="min-option${i === 0 ? ' sel' : ''}" data-pick="${o.k}" data-mins="${o.mins}">
            <span class="min-badge num" dir="ltr">${fmtNum(o.mins)}${t('minutes_short')}</span>
            <span class="min-text">
              <span class="min-title">${escapeHtml(o.title)}</span>
              <span class="min-sub${o.cost ? ' is-cost' : ''}">${escapeHtml(o.sub)}</span>
            </span>
            <span class="min-check">${icon('check', 16)}</span>
          </button>`).join('')}
      </div>
      <div class="rest-sheet-actions">
        <button class="btn btn-primary btn-block" data-go>${
          t('anyway_start_named').replace('{name}', escapeHtml(opts[0].title))}</button>
        <button class="btn btn-ghost btn-block" data-keep>${t('anyway_keep_rest')}</button>
      </div>
    </div>`;

  app.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = (cb) => {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); if (typeof cb === 'function') cb(); }, 260);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-keep]')) { close(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      overlay.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('sel', b === pick));
      const go = overlay.querySelector('[data-go]');
      const nm = pick.querySelector('.min-title');
      if (go && nm) go.textContent = t('anyway_start_named').replace('{name}', nm.textContent.trim());
      return;
    }
    if (!e.target.closest('[data-go]')) return;
    const sel = overlay.querySelector('[data-pick].sel');
    const kind = sel ? sel.dataset.pick : 'cardio';
    const mins = sel ? (Number(sel.dataset.mins) || 20) : 20;
    close(() => {
      if (kind === 'full') {
        // Pull today INTO the rotation. It then advances the cycle like any
        // training day, so today takes the session the next training day was
        // going to carry and everything after slides forward — the "moves the
        // plan a full day" the option warns about, actually performed.
        // This used to call setRest(today, false), which was a no-op: the sheet
        // only ever opens on a scheduled rest WEEKDAY, and such a day is not in
        // restDates to begin with. Nothing moved and the session screen it then
        // opened had no workout on it.
        DB.plan.setExtra(new Date(), true);
        showToast(t('anyway_moved'), {
          actionLabel: t('rest_undo'),
          onAction: () => {
            DB.plan.setExtra(new Date(), false);
            navigate('home');
            showToast(t('anyway_undone'));
          },
        });
        navigate('session-day', { date: todayISO() });
        return;
      }
      startMinimumSession(kind === 'lag' ? 'muscles' : 'walk', mins, { muscles: lagging });
    });
  });
}

// The three middle options resolve into the app's EXISTING logging paths rather
// than a parallel one: a reduced session goes through session-day exactly like a
// full one, and a walk is a cardio entry. Nothing here invents a second way to
// write a workout.
function startMinimumSession(kind, mins, opts) {
  // "Train a lagging muscle" has to pick BY MUSCLE, not from today's plan. It
  // used to route through the 'one' branch below, which takes the heaviest lift
  // out of the CURRENT day's slot — so on a scheduled rest day (the only day
  // this option is ever offered) the slot was null and the screen opened empty,
  // and on any other day it would have trained a muscle the plan already covers,
  // which is the opposite of what the option says.
  if (kind === 'muscles') {
    const want = (opts && opts.muscles) || [];
    const pool = DB.exercises.list().filter((ex) =>
      getMusclesForExercise(ex).some((m) => want.indexOf(m) !== -1));
    if (!pool.length) { showToast(t('anyway_no_exercise')); return; }
    // Familiar first: an exercise with history opens on the user's own numbers
    // instead of a blank row. bestOneRM is 0 for anything never logged, so this
    // degrades to "any exercise for that muscle" on a fresh install.
    const exerciseStats = DB.sessions.statsByExercise();
    const ranked = pool.slice().sort(
      (a, b) => (exerciseStats[b.id]?.bestORM || 0) - (exerciseStats[a.id]?.bestORM || 0));
    navigate('session-day', {
      date: todayISO(),
      sdOnly: ranked.slice(0, 2).map((e) => e.id),
      sdMinimum: true,
    });
    return;
  }
  if (kind === 'walk') {
    const type = (DB.cardioTypes.allTypes().find((c) => /walk|مشي/i.test(c.label || c.id)) || {}).id
      || (DB.cardioTypes.allTypes()[0] || {}).id;
    if (!type) { showToast(t('rest_min_walk')); return; }
    DB.cardio.add({ type, date: todayISO(), duration: mins, calories: 0 });
    showToast(t('rest_min_logged'));
    renderView('home');
    return;
  }

  const plan = DB.plan.workoutForDate(new Date());
  const ids = (plan?.exerciseIds || []).slice();
  if (!ids.length) { navigate('session-day', { date: todayISO() }); return; }

  let only;
  if (kind === 'one') {
    const exerciseStats = DB.sessions.statsByExercise();
    const byBest = ids.slice().sort(
      (a, b) => (exerciseStats[b]?.bestORM || 0) - (exerciseStats[a]?.bestORM || 0));
    only = [byBest[0]];
  } else {
    only = ids.slice(0, 2);
  }
  // sdOnly narrows the session screen to the chosen subset; sdMinimum tags every
  // set logged from it, so the day counts as a real (if reduced) workout in the
  // stats and in the streak.
  navigate('session-day', { date: todayISO(), sdOnly: only, sdMinimum: true });
}

// ===========================================================================
// Calorie / macro calculator (Mifflin-St Jeor). Live preview as the user edits.
// ===========================================================================
function openCalculatorModal(onSave) {
  const nut = DB.nutrition;
  const p = Object.assign({}, nut.get().profile);
  let manual = nut.get().mode === 'manual';
  const curTargets = nut.get().targets;

  const activities = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
  const goals = ['cut', 'maintain', 'bulk'];

  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('calc_title')}</div>
        <div class="modal-subtitle">${t('calc_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div id="calc-body"></div>
  `);

  const body = overlay.querySelector('#calc-body');

  function calcFormHtml() {
    const seg = (name, opts, cur) => `
      <div class="seg" data-seg="${name}">
        ${opts.map((o) => `<button type="button" class="seg-btn ${cur === o.v ? 'active' : ''}" data-val="${o.v}">${o.label}</button>`).join('')}
      </div>`;
    return `
      <div class="form-group"><label class="form-label">${t('calc_sex')}</label>
        ${seg('sex', [{ v: 'male', label: t('calc_male') }, { v: 'female', label: t('calc_female') }], p.sex)}</div>
      <div class="calc-grid">
        <div class="form-group"><label class="form-label">${t('calc_age')}</label>
          <input type="number" inputmode="numeric" id="c-age" min="10" max="100" value="${numAttr(p.age)}" placeholder="25"></div>
        <div class="form-group"><label class="form-label">${t('calc_height')}</label>
          <input type="number" inputmode="numeric" id="c-height" min="100" max="230" value="${numAttr(p.heightCm)}" placeholder="175"></div>
        <div class="form-group"><label class="form-label">${t('calc_weight')}</label>
          <input type="number" inputmode="decimal" id="c-weight" min="30" max="300" value="${numAttr(p.weightKg)}" placeholder="75"></div>
      </div>
      <div class="form-group"><label class="form-label">${t('calc_activity')}</label>
        ${seg('activity', activities.map((a) => ({ v: a, label: t('activity_' + a) })), p.activity)}</div>
      <div class="form-group"><label class="form-label">${t('calc_goal')}</label>
        ${seg('goal', goals.map((g) => ({ v: g, label: t('goal_' + g) })), p.goal)}</div>
      <div class="calc-preview" id="calc-preview"></div>
      <button class="btn btn-primary btn-block" id="calc-save">${t('save')}</button>
      <button type="button" class="calc-switch" id="to-manual">${t('calc_use_manual')}</button>
    `;
  }

  function manualFormHtml() {
    return `
      <div class="calc-grid calc-grid-2">
        <div class="form-group"><label class="form-label">${t('calories')}</label>
          <input type="number" inputmode="numeric" id="m-cal" min="0" value="${numAttr(curTargets.calories)}" placeholder="2200"></div>
        <div class="form-group"><label class="form-label">${t('protein_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-pro" min="0" value="${numAttr(curTargets.protein)}" placeholder="160"></div>
        <div class="form-group"><label class="form-label">${t('carbs_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-carb" min="0" value="${numAttr(curTargets.carbs)}" placeholder="220"></div>
        <div class="form-group"><label class="form-label">${t('fat_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-fat" min="0" value="${numAttr(curTargets.fat)}" placeholder="60"></div>
      </div>
      <button class="btn btn-primary btn-block" id="calc-save-manual">${t('save')}</button>
      <button type="button" class="calc-switch" id="to-calc">${t('calc_use_calc')}</button>
    `;
  }

  function previewHtml() {
    const c = DB.nutrition.compute(p);
    if (!c) return `<div class="calc-preview-hint">${t('calc_fill_hint')}</div>`;
    const cell = (v, unit, label) => `<div class="calc-cell"><div class="calc-cell-v num">${fmtNum(v)}<span>${unit}</span></div><div class="calc-cell-l">${label}</div></div>`;
    return `
      <div class="calc-preview-grid">
        ${cell(c.calories, t('cal'), t('nutri_calories'))}
        ${cell(c.protein, 'g', t('protein_label'))}
        ${cell(c.carbs, 'g', t('carbs_label'))}
        ${cell(c.fat, 'g', t('fat_label'))}
      </div>
      <div class="calc-preview-hint">${t('calc_tdee')}: <span class="num">${fmtNum(c.tdee)}</span> ${t('cal')} · ${t('calc_bmr')}: <span class="num">${fmtNum(c.bmr)}</span></div>
    `;
  }

  function renderCalcForm() {
    body.innerHTML = calcFormHtml();
    const prev = body.querySelector('#calc-preview');
    const refresh = () => { if (prev) prev.innerHTML = previewHtml(); };
    refresh();
    body.querySelectorAll('[data-seg]').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('.seg-btn'); if (!b) return;
        seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        p[seg.dataset.seg] = b.dataset.val;
        refresh();
      });
    });
    ['c-age', 'c-height', 'c-weight'].forEach((id) => {
      const inp = body.querySelector('#' + id);
      inp?.addEventListener('input', () => {
        if (id === 'c-age') p.age = Number(inp.value) || null;
        if (id === 'c-height') p.heightCm = Number(inp.value) || null;
        if (id === 'c-weight') p.weightKg = Number(inp.value) || null;
        refresh();
      });
    });
    body.querySelector('#calc-save')?.addEventListener('click', () => {
      if (!DB.nutrition.compute(p)) { showToast(t('calc_fill_hint')); return; }
      DB.nutrition.setProfile(p);
      closeModal(); showToast(t('saved'));
      if (typeof onSave === 'function') onSave();
    });
    body.querySelector('#to-manual')?.addEventListener('click', () => { manual = true; draw(); });
  }

  function renderManualForm() {
    body.innerHTML = manualFormHtml();
    body.querySelector('#calc-save-manual')?.addEventListener('click', () => {
      const cal = Number(body.querySelector('#m-cal').value) || 0;
      if (cal <= 0) { showToast(t('calc_fill_hint')); return; }
      DB.nutrition.setTargets({
        calories: cal,
        protein: Number(body.querySelector('#m-pro').value) || 0,
        carbs: Number(body.querySelector('#m-carb').value) || 0,
        fat: Number(body.querySelector('#m-fat').value) || 0,
      });
      closeModal(); showToast(t('saved'));
      if (typeof onSave === 'function') onSave();
    });
    body.querySelector('#to-calc')?.addEventListener('click', () => { manual = false; draw(); });
  }

  const draw = () => { manual ? renderManualForm() : renderCalcForm(); };
  draw();
}

// ===========================================================================
// Manual quick-add: name + macros straight into today's log.
// ===========================================================================
function openManualFoodEntry(date, onSave) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('manual_food_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="form-group"><label class="form-label">${t('mf_quick_label')}</label>
      <textarea id="mf-quick" rows="2" placeholder="${escapeHtml(t('mf_quick_ph'))}"></textarea>
      <div class="form-hint" id="mf-quick-hint">${t('mf_quick_hint')}</div></div>
    <div class="form-group"><label class="form-label">${t('name')}</label>
      <input type="text" id="mf-name" placeholder="${t('manual_food_ph')}" autofocus></div>
    <div class="calc-grid calc-grid-2">
      <div class="form-group"><label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="numeric" id="mf-cal" min="0" placeholder="250"></div>
      <div class="form-group"><label class="form-label">${t('protein_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-pro" min="0" placeholder="20"></div>
      <div class="form-group"><label class="form-label">${t('carbs_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-carb" min="0" placeholder="30"></div>
      <div class="form-group"><label class="form-label">${t('fat_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-fat" min="0" placeholder="8"></div>
    </div>
    <label class="mf-keep"><input type="checkbox" id="mf-keep" checked>
      <span>${t('mf_keep_label')}</span></label>
    <button class="btn btn-primary btn-block" id="mf-save">${icon('plus', 20)} ${t('ai_add_to_log')}</button>
  `);

  const $q = overlay.querySelector('#mf-quick');
  const $hint = overlay.querySelector('#mf-quick-hint');
  const F = {
    name: overlay.querySelector('#mf-name'), cal: overlay.querySelector('#mf-cal'),
    pro: overlay.querySelector('#mf-pro'), carb: overlay.querySelector('#mf-carb'),
    fat: overlay.querySelector('#mf-fat'),
  };
  // Write the whole thing in one line and let it fill the boxes. This reuses the
  // SAME parser the chat uses (FoodAI.parseText), so "فول 1000 سعرة و55 جرام
  // بروتين" lands here identically — no second set of rules to drift apart, and
  // nothing is sent anywhere: it is pure local text matching.
  const applyQuick = () => {
    const raw = $q.value || '';
    if (!raw.trim()) { $hint.textContent = t('mf_quick_hint'); $hint.classList.remove('ok'); return; }
    const parsed = (window.FoodAI && FoodAI.parseText) ? FoodAI.parseText(raw) : null;
    const it = parsed && parsed.items && parsed.items[0];
    if (!it) { $hint.textContent = t('mf_quick_none'); $hint.classList.remove('ok'); return; }
    if (!F.name.value.trim() && it.name) F.name.value = it.name;
    F.cal.value = it.calories || '';
    F.pro.value = it.protein || '';
    F.carb.value = it.carbs || '';
    F.fat.value = it.fat || '';
    $hint.textContent = t('mf_quick_ok');
    $hint.classList.add('ok');
  };
  $q.addEventListener('input', debounce(applyQuick, 250));
  $q.addEventListener('change', applyQuick);

  // NO applyQuick() here. It used to run on save "to catch a paste that never
  // fired input" — but it unconditionally rewrites all four macro boxes, so it
  // threw away any figure the user had typed or corrected by hand, and with
  // "keep in my foods" ticked by default the reverted values were saved too and
  // came back on every later one-tap log. The input and change listeners above
  // already cover the paste case; a paste that fires neither cannot exist.
  overlay.querySelector('#mf-save').addEventListener('click', () => {
    const name = (F.name.value || '').trim();
    if (!name) { showToast(t('enter_name')); return; }
    const macros = {
      calories: Number(F.cal.value) || 0,
      protein: Number(F.pro.value) || 0,
      carbs: Number(F.carb.value) || 0,
      fat: Number(F.fat.value) || 0,
    };
    DB.foodLogs.add(date, { name, servings: 1, ...macros, source: 'manual' });
    // Keep it for next time, so the same meal is one tap from the saved picker
    // instead of being retyped. Skipped when an identically-named food already
    // exists, or the list fills with duplicates of whatever you eat most.
    let kept = false;
    if (overlay.querySelector('#mf-keep').checked) {
      const dup = DB.foods.list().some((f) => f.name.trim().toLowerCase() === name.toLowerCase());
      if (!dup) { DB.foods.add({ name, serving: '', ...macros }); kept = true; }
    }
    closeModal();
    showToast(kept ? t('mf_added_and_kept') : t('ai_added'));
    if (typeof onSave === 'function') onSave();
  });
}

// ===========================================================================
// Saved-food picker — the old "reference library" as an add-method. Search
// your saved foods + presets, tap to log to today. Long-press-free: tap = add.
// ===========================================================================
function openSavedFoodPicker(date, onSave) {
  let query = '';
  let tab = 'foods';
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_saved')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="sfp-tabs" role="tablist">
      <button type="button" class="sfp-tab on" data-tab="foods" role="tab">${t('tab_saved_foods')}</button>
      <button type="button" class="sfp-tab" data-tab="bundles" role="tab">${t('tab_bundles')}</button>
    </div>
    <div class="search-wrap" id="sf-search-wrap" style="margin-bottom:10px">
      ${icon('search', 20)}
      <input type="search" id="sf-search" placeholder="${t('search_foods')}">
    </div>
    <div class="picker-list" id="sf-list"></div>
    <button class="btn btn-ghost btn-block" id="sf-new" style="margin-top:10px">${icon('plus', 20)} ${t('saved_new')}</button>
  `);
  const listEl = overlay.querySelector('#sf-list');

  // ---- "My meals" — several foods, one tap (فطوري المعتاد) -----------------
  function drawBundles() {
    const bundles = DB.mealBundles.list();
    if (!bundles.length) {
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${t('bundle_empty')}</div>`;
      return;
    }
    listEl.innerHTML = bundles.map((b) => {
      const kcal = b.items.reduce((n, it) => n + it.calories * (it.servings || 1), 0);
      return `
      <div class="bundle-card" data-bundle="${escapeHtml(b.id)}">
        <div class="bundle-main">
          <div class="bundle-name">${escapeHtml(b.name)}</div>
          <div class="bundle-meta"><span class="num">${fmtNum(b.items.length)}</span> ${t('bundle_items')} · <span class="num">${fmtNum(Math.round(kcal))}</span> ${t('cal')}</div>
        </div>
        <button type="button" class="btn btn-primary bundle-add" data-log-bundle="${escapeHtml(b.id)}">${icon('plus', 16)}</button>
        <button type="button" class="icon-btn danger bundle-del" data-del-bundle="${escapeHtml(b.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-log-bundle]').forEach((btn) => btn.addEventListener('click', () => {
      const b = DB.mealBundles.list().find((x) => x.id === btn.dataset.logBundle);
      if (!b) return;
      // Itemized, not summed: each food lands as its own log row so the day's
      // list stays editable piece by piece, exactly as if tapped one by one.
      b.items.forEach((it) => DB.foodLogs.add(date, {
        name: it.name, servings: it.servings || 1,
        calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
        source: 'bundle',
      }));
      showToast(t('bundle_added').replace('{name}', b.name).replace('{n}', fmtNum(b.items.length)));
      if (typeof onSave === 'function') onSave();
    }));
    listEl.querySelectorAll('[data-del-bundle]').forEach((btn) => btn.addEventListener('click', () => {
      confirmDialog({
        title: t('delete') + '؟', text: '', confirmLabel: t('delete'), variant: 'danger',
        onConfirm: () => { DB.mealBundles.remove(btn.dataset.delBundle); showToast(t('bundle_deleted')); drawBundles(); },
      });
    }));
  }

  // Creating a bundle starts from what THIS day already holds: log the items
  // once by any path (chat, photo, barcode, manual), then keep them as one
  // meal. A picker over the whole food library would be a second, worse form.
  function openBundleCreator() {
    const todays = DB.foodLogs.listForDate(date) || [];
    const inner = todays.length
      ? `<div class="calc-preview-hint" style="margin-bottom:8px">${t('bundle_pick_hint')}</div>
         <div class="bundle-pick">${todays.map((e, i) => `
           <label class="bundle-pick-row">
             <input type="checkbox" checked data-pick="${i}">
             <span class="bundle-pick-name">${escapeHtml(e.name)}</span>
             <span class="bundle-pick-kcal num">${fmtNum(Math.round((e.calories || 0) * (e.servings || 1)))} ${t('cal')}</span>
           </label>`).join('')}</div>
         <input type="text" id="bundle-name" class="input" placeholder="${escapeHtml(t('bundle_name_ph'))}" maxlength="60" style="margin:10px 0">
         <button class="btn btn-primary btn-block" id="bundle-save">${t('bundle_save')}</button>`
      : `<div class="calc-preview-hint" style="text-align:center;padding:18px">${t('bundle_none_today')}</div>`;
    const ov2 = openModal(`
      <div class="modal-header">
        <div class="modal-title">${t('bundle_new')}</div>
        <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
      </div>${inner}`);
    const saveBtn = ov2.querySelector('#bundle-save');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const items = [...ov2.querySelectorAll('[data-pick]')]
        .filter((c) => c.checked)
        .map((c) => todays[Number(c.dataset.pick)])
        .filter(Boolean);
      if (!items.length) return;
      const name = ov2.querySelector('#bundle-name').value.trim();
      const made = DB.mealBundles.add({ name, items });
      closeModal();
      showToast(made ? t('bundle_saved') : t('ai_error'));
      // Back into the picker, on the meals tab, so the new bundle is visible.
      openSavedFoodPicker(date, onSave);
    });
  }

  function draw() {
    const q = query.toLowerCase();
    const saved = DB.foods.list().map((f) => ({ name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat || 0, saved: true }));
    const list = q ? saved.filter((f) => f.name.toLowerCase().includes(q)) : saved;
    if (!list.length) {
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${DB.foods.list().length ? t('no_matches_simple') : t('saved_empty')}</div>`;
      return;
    }
    listEl.innerHTML = list.map((f, i) => `
      <button type="button" class="picker-row" data-add-saved="${i}">
        <span class="picker-row-cat" style="background:var(--cat-arms)"></span>
        <span class="picker-row-name">${escapeHtml(f.name)}
          <span style="color:var(--text-mute);font-weight:600;font-size:11px"> · <span class="num">${fmtNum(f.calories)}</span> ${t('cal')}</span>
        </span>
        <span class="picker-row-check">${icon('plus', 16)}</span>
      </button>`).join('');
    listEl.querySelectorAll('[data-add-saved]').forEach((b) => b.addEventListener('click', () => {
      const f = list[Number(b.dataset.addSaved)];
      DB.foodLogs.add(date, { name: f.name, servings: 1, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, source: 'saved' });
      showToast(t('ai_added'));
      b.querySelector('.picker-row-check').innerHTML = icon('check', 16);
      b.classList.add('picked');
      if (typeof onSave === 'function') onSave();
    }));
  }
  // draw() rebuilds the whole list, so a per-keystroke rebuild repeats the same
  // expensive work for every character.
  const drawSavedFoodSearch = debounce(draw, 150);
  overlay.querySelector('#sf-search').addEventListener('input', (e) => {
    query = e.target.value;
    drawSavedFoodSearch();
  });
  const newBtn = overlay.querySelector('#sf-new');
  newBtn.addEventListener('click', () => {
    if (tab === 'bundles') { openBundleCreator(); return; }
    closeModal(); openFoodLibraryModal();
  });
  overlay.querySelectorAll('.sfp-tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    overlay.querySelectorAll('.sfp-tab').forEach((x) => x.classList.toggle('on', x === b));
    overlay.querySelector('#sf-search-wrap').style.display = tab === 'bundles' ? 'none' : '';
    newBtn.innerHTML = tab === 'bundles'
      ? icon('plus', 20) + ' ' + t('bundle_new')
      : icon('plus', 20) + ' ' + t('saved_new');
    if (tab === 'bundles') drawBundles(); else draw();
  }));
  draw();
}

// ===========================================================================
// AI coach — reads what's LEFT for the day and suggests what to eat to hit it.
// Reuses the FoodAI text model; no new backend.
// ===========================================================================
// DORMANT (v219) — the AI meal coach. Its entry point on the Food screen was
// removed at the owner's request ("not this feature for now"), so nothing calls
// this any more. The implementation, its modal styles and its ten translated
// strings are deliberately kept rather than deleted, because "for now" is not
// "never" and re-translating is the expensive part.
//
// TO RESTORE: put the button back after ${waterCard} in the nutrition panel and
// re-add the one delegated line `if (e.target.closest('[data-coach]')) { openCoach(date); return; }`
// above the [data-add-water] branch. Nothing else was touched.
function openCoach(date) {
  const tgt = DB.nutrition.get().targets;
  const c = DB.foodLogs.totalsForDate(date);
  const left = {
    calories: Math.max(0, Math.round(tgt.calories - c.calories)),
    protein: Math.max(0, Math.round(tgt.protein - c.protein)),
    carbs: Math.max(0, Math.round(tgt.carbs - c.carbs)),
    fat: Math.max(0, Math.round(tgt.fat - c.fat)),
  };
  const lang = DB.prefs.get().lang || 'en';
  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('coach_title')}</div>
        <div class="modal-subtitle">${t('coach_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="coach-remaining">
      <span>${t('nutri_left')}: <b class="num">${fmtNum(left.calories)}</b> ${t('cal')}</span>
      <span><b class="num">${fmtNum(left.protein)}</b>g ${t('protein_label')}</span>
    </div>
    <div id="coach-body" class="coach-body"><div class="ai-dots">${t('coach_thinking')}</div></div>
  `);
  const body = overlay.querySelector('#coach-body');
  const prompt = (lang === 'ar'
    ? `أنا أتتبع سعراتي. باقي لي اليوم: ${left.calories} سعرة، ${left.protein}غ بروتين، ${left.carbs}غ كارب، ${left.fat}غ دهون. اقترح ٣ وجبات أو سناكات واقعية تناسب المتبقي تقريباً، كل واحدة بسطر واحد مع سعراتها التقريبية. بالعربي، بدون مقدمة.`
    : `I track my macros. Remaining today: ${left.calories} kcal, ${left.protein}g protein, ${left.carbs}g carbs, ${left.fat}g fat. Suggest 3 realistic meals or snacks that fit the remainder, each on one line with approx calories. No preamble.`);
  // Already at / over the goal → no point asking the AI for "0 calories" of food.
  if (left.calories <= 50) { body.innerHTML = `<div class="coach-done">${t('coach_goal_met')}</div>`; return; }
  if (!window.FoodAI || !FoodAI.ask) { body.innerHTML = `<div class="ai-err">${t('coach_unavailable')}</div>`; return; }
  FoodAI.ask(prompt)
    .then((txt) => {
      // A blank reply usually means the AI backend isn't reachable yet (e.g. the
      // Worker hasn't been redeployed) — show a clear message, never an empty box.
      const clean = String(txt || '').trim();
      body.innerHTML = clean
        ? `<div class="coach-text">${escapeHtml(clean).replace(/\n/g, '<br>')}</div>`
        : `<div class="ai-err">${t('coach_unavailable')}</div>`;
    })
    .catch((e) => { body.innerHTML = `<div class="ai-err">${escapeHtml((e && e.message) || t('ai_error'))}</div>`; });
}

// ===========================================================================
// Voice capture — record, transcribe + analyse via FoodAI, add to today's log.
// getUserMedia works in a browser and in an Android WebView that has been
// granted RECORD_AUDIO (needs the newer APK). Every failure is caught and shown.
// ===========================================================================
function openVoiceCapture(date, onSave) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_voice')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="voice-stage" id="voice-stage">
      <button class="voice-mic" id="voice-mic" aria-label="${escapeHtml(t('voice_tap'))}">${icon('mic', 22)}</button>
      <div class="voice-status" id="voice-status">${t('voice_tap')}</div>
    </div>
    <div class="ai-results" id="voice-results"></div>
  `);
  const micBtn = overlay.querySelector('#voice-mic');
  const status = overlay.querySelector('#voice-status');
  const results = overlay.querySelector('#voice-results');
  let recorder = null, chunks = [], stream = null, recording = false;

  const setStatus = (s) => { if (status) status.textContent = s; };

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(t('voice_unsupported')); return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Give an honest, context-correct message. No mic hardware → say so. Else
      // it's a permission block, and the fix differs by platform: the installed
      // APP gets Android's own system prompt (allow it), while the BROWSER/PWA
      // controls the mic through the browser's own site settings.
      const name = err && err.name;
      const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
      setStatus((name === 'NotFoundError' || name === 'DevicesNotFoundError')
        ? t('voice_no_mic')
        : (isNative ? t('voice_denied') : t('voice_denied_web')));
      return;
    }
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onStop;
    recorder.start();
    recording = true;
    micBtn.classList.add('recording');
    setStatus(t('voice_listening'));
  }

  function stop() {
    if (recorder && recording) { recording = false; recorder.stop(); }
    if (stream) stream.getTracks().forEach((tk) => tk.stop());
    micBtn.classList.remove('recording');
  }

  async function onStop() {
    setStatus(t('voice_processing'));
    const blob = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
    if (!blob.size) { setStatus(t('voice_tap')); return; }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
      });
      const b64 = String(dataUrl).split(',')[1];
      const mimeType = String(dataUrl).slice(5, String(dataUrl).indexOf(';'));
      if (!window.FoodAI || !FoodAI.analyzeAudio) throw new Error(t('voice_unsupported'));
      const { items, transcript } = await FoodAI.analyzeAudio({ mimeType, data: b64 });
      if (!document.body.contains(overlay)) return; // modal was closed mid-request
      if (transcript) setStatus('“' + transcript + '”'); else setStatus(t('voice_tap'));
      if (!items || !items.length) { results.innerHTML = `<div class="ai-decline">${t('ai_not_food')}</div>`; return; }
      renderVoiceResults(items);
    } catch (e) {
      setStatus((e && e.message) || t('ai_error'));
    }
  }

  function renderVoiceResults(items) {
    results.innerHTML = items.map((it, i) => `
      <div class="ai-card" data-vr="${i}" data-mult="1"
        data-bcal="${it.calories}" data-bpro="${it.protein}" data-bcarb="${it.carbs}" data-bfat="${it.fat}">
        <div class="ai-card-name">${escapeHtml(it.name)}</div>
        <div class="ai-portion">
          <button type="button" class="ai-portion-btn" data-step="-1" aria-label="${escapeHtml(t('portion_less'))}">${icon('minus', 16)}</button>
          <span class="ai-portion-val"><span class="num">1</span>×</span>
          <button type="button" class="ai-portion-btn" data-step="1" aria-label="${escapeHtml(t('portion_more'))}">${icon('plus', 16)}</button>
        </div>
        <div class="ai-macros">
          <span class="ai-macro cal"><b class="num" data-m="cal">${fmtNum(it.calories)}</b>${t('cal')}</span>
          <span class="ai-macro pro"><b class="num" data-m="pro">${fmtNum(it.protein)}</b>g ${t('protein_label')}</span>
          <span class="ai-macro carb"><b class="num" data-m="carb">${fmtNum(it.carbs)}</b>g ${t('carbs_label')}</span>
          <span class="ai-macro fat"><b class="num" data-m="fat">${fmtNum(it.fat)}</b>g ${t('fat_label')}</span>
        </div>
      </div>`).join('') +
      `<button class="btn btn-primary btn-block" id="voice-addall">${icon('plus', 20)} ${t('ai_add_all')} (${fmtNum(items.length)})</button>`;

    const applyPortion = (card) => {
      const mult = parseFloat(card.dataset.mult) || 1;
      const set = (k, base, dec) => {
        const n = card.querySelector('[data-m="' + k + '"]');
        if (n) n.textContent = fmtNum(dec ? Math.round(base * mult * 10) / 10 : Math.round(base * mult));
      };
      set('cal', +card.dataset.bcal, false);
      set('pro', +card.dataset.bpro, true);
      set('carb', +card.dataset.bcarb, true);
      set('fat', +card.dataset.bfat, true);
      const v = card.querySelector('.ai-portion-val .num');
      if (v) v.textContent = fmtNum(mult);
    };
    // Bind the portion delegate ONCE. `results` (#voice-results) is a persistent
    // node — only its innerHTML is replaced — so re-recording used to stack a
    // second, third… listener on the same element, and one tap on +/− then moved
    // the portion by 0.25 × (number of recordings). It reads only DOM state, so a
    // single delegated listener serves every re-render.
    if (!results.dataset.portionBound) {
      results.dataset.portionBound = '1';
      results.addEventListener('click', (e) => {
        const btn = e.target.closest('.ai-portion-btn');
        if (!btn) return;
        const card = btn.closest('.ai-card');
        if (!card) return;
        let mult = (parseFloat(card.dataset.mult) || 1) + (parseInt(btn.dataset.step, 10) || 0) * 0.25;
        mult = Math.max(0.25, Math.min(20, Math.round(mult * 100) / 100));
        card.dataset.mult = mult;
        applyPortion(card);
      });
    }

    results.querySelector('#voice-addall').addEventListener('click', () => {
      const scaled = items.map((it, i) => {
        const card = results.querySelector(`.ai-card[data-vr="${i}"]`);
        const mult = card ? (parseFloat(card.dataset.mult) || 1) : 1;
        return Object.assign({}, it, { source: 'voice', servings: mult });
      });
      logNutritionItems(date, scaled, onSave);
      showToast(t('ai_added'));
      closeModal();
    });
  }

  micBtn.addEventListener('click', () => { recording ? stop() : start(); });
  // Stop the mic when the modal is dismissed by ANY path — the X button,
  // a backdrop tap, or the Escape key all clear #modal-root, so watch for the
  // overlay leaving the DOM and release the microphone then. (A click-only
  // listener missed backdrop/Escape, leaving the mic live — a privacy leak.)
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) {
    const mo = new MutationObserver(() => {
      if (!document.body.contains(overlay)) { stop(); mo.disconnect(); }
    });
    mo.observe(modalRoot, { childList: true, subtree: true });
  }
}

// Split a serving string ("١٠٠غ", "3 حبات", "1 slice") into a numeric amount
// and a unit label. Arabic-Indic digits are normalised. No leading number → 1.
function parseServing(serving) {
  const str = String(serving || '').trim();
  const norm = str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const m = norm.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (m) return { amount: parseFloat(m[1]), unit: m[2].trim() };
  return { amount: 1, unit: str };
}

function openFoodModal(foodId = null) {
  const existing = foodId ? DB.foods.list().find((f) => f.id === foodId) : null;
  const parsed = parseServing(existing ? existing.serving : '');
  const baseAmount = existing ? (parsed.amount || '') : '';
  const baseUnit = existing ? parsed.unit : '';
  // Per-unit macros — used to live-recalculate when the amount is edited.
  const per = { cal: 0, pro: 0, carb: 0 };
  if (existing) {
    const a = parsed.amount || 1;
    per.cal = existing.calories / a;
    per.pro = existing.protein / a;
    per.carb = existing.carbs / a;
  }
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_food') : t('new_food')}</div>
        <div class="modal-subtitle">${t('food_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="food-name" placeholder="${t('ph_food_name')}" value="${existing ? escapeHtml(existing.name) : ''}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('amount_label')}</label>
        <input type="number" inputmode="decimal" id="food-amount" step="1" min="0" value="${numAttr(baseAmount)}" placeholder="100">
      </div>
      <div class="form-group">
        <label class="form-label">${t('serving_unit_label')}</label>
        <input type="text" id="food-unit" value="${escapeHtml(baseUnit)}" placeholder="${t('unit_hint')}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="decimal" id="food-cal" step="1" min="0" value="${numAttr(existing && existing.calories)}" placeholder="165">
      </div>
      <div class="form-group">
        <label class="form-label">${t('protein_g')}</label>
        <input type="number" inputmode="decimal" id="food-pro" step="0.1" min="0" value="${numAttr(existing && existing.protein)}" placeholder="31">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('carbs_g')}</label>
        <input type="number" inputmode="decimal" id="food-carb" step="0.1" min="0" value="${numAttr(existing && existing.carbs)}" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">${t('fat_label')} (g)</label>
        <input type="number" inputmode="decimal" id="food-fat" step="0.1" min="0" value="${numAttr(existing && existing.fat)}" placeholder="0">
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-food-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  // Edit the amount → live-recalculate calories/protein/carbs from per-unit.
  $('#food-amount')?.addEventListener('input', () => {
    const a = Number($('#food-amount').value);
    if (!a || (!per.cal && !per.pro && !per.carb)) return;
    $('#food-cal').value = Math.round(per.cal * a);
    $('#food-pro').value = Math.round(per.pro * a * 10) / 10;
    $('#food-carb').value = Math.round(per.carb * a * 10) / 10;
  });

  $('#save-food-btn').addEventListener('click', () => {
    const name = $('#food-name').value.trim();
    const amount = $('#food-amount').value.trim();
    const unit = $('#food-unit').value.trim();
    const serving = [amount, unit].filter(Boolean).join(' ');
    const calories = Number($('#food-cal').value);
    const protein = Number($('#food-pro').value);
    const carbs = Number($('#food-carb').value);
    const fat = Number($('#food-fat').value);
    if (!name) { showToast(t('enter_name')); return; }
    if (existing) {
      DB.foods.update(existing.id, { name, serving, calories, protein, carbs, fat });
      showToast(t('updated'));
    } else {
      DB.foods.add({ name, serving, calories, protein, carbs, fat });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });

  setTimeout(() => $('#food-name')?.focus(), 60);
}

// Quick-add picker: the built-in food catalog shown as small rectangular
// chips, grouped by category, searchable. Tapping a chip adds it to the
// reference list. A footer button falls back to the manual entry form.
function openFoodLibraryModal() {
  function buildSections() {
    const existing = new Set(DB.foods.list().map((f) => f.name.trim().toLowerCase()));
    const presets = allFoodPresets();
    return allFoodCatOrder().map((cat) => {
      const chips = presets
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p.cat === cat)
        .map(({ p, idx }) => {
          const name = foodPresetName(p);
          // Detect an already-added preset in EITHER language so switching the
          // UI language can't create a duplicate of the same food.
          const added = existing.has(name.trim().toLowerCase())
            || existing.has(String(p.en).trim().toLowerCase())
            || existing.has(String(p.ar).trim().toLowerCase());
          return `
            <button type="button" class="food-lib-chip${added ? ' added' : ''}" data-preset="${idx}" ${added ? 'disabled' : ''}>
              <span class="flc-name">${escapeHtml(name)}</span>
              <span class="flc-cal"><span class="num">${fmtNum(p.cal)}</span> ${t('cal')}</span>
              <span class="flc-check">${icon('check', 16)}</span>
            </button>`;
        }).join('');
      if (!chips) return '';
      return `
        <div class="food-lib-section">
          <div class="food-lib-cat">${t('fcat_' + cat)}</div>
          <div class="food-lib-grid">${chips}</div>
        </div>`;
    }).join('');
  }

  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('food_library_title')}</div>
        <div class="modal-subtitle">${t('food_library_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="search-wrap food-lib-search">
      ${icon('search', 20)}
      <input type="search" id="food-lib-search" placeholder="${t('search_foods')}">
    </div>

    <div class="food-lib-body" id="food-lib-body">
      ${buildSections()}
      <div id="food-lib-empty" style="display:none">${emptyState({ iconName: 'search', title: t('no_matches_simple'), text: t('no_matches_text') })}</div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost btn-block" id="food-lib-manual">${icon('plus', 20)} ${t('add_manually')}</button>
    </div>
  `);

  const body = overlay.querySelector('#food-lib-body');
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.food-lib-chip');
    if (!btn || btn.classList.contains('added')) return;
    const p = allFoodPresets()[Number(btn.dataset.preset)];
    if (!p) return;
    // `fat` was missing here entirely, so every preset added a food with 0 fat
    // no matter what it actually contains — nuts, peanut butter and whole milk
    // all landed as fat-free, and the fat target on the Food screen could never
    // be filled from the library. Older presets carry no `f` yet; `|| 0` keeps
    // them behaving exactly as before.
    DB.foods.add({
      name: foodPresetName(p), serving: foodPresetServing(p),
      calories: p.cal, protein: p.pro, carbs: p.carb, fat: p.f || 0,
    });
    btn.classList.add('added');
    btn.disabled = true;
    showToast(t('saved'));
    renderView(currentView);
  });

  overlay.querySelector('#food-lib-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let anyVisible = false;
    overlay.querySelectorAll('.food-lib-chip').forEach((c) => {
      const nm = c.querySelector('.flc-name').textContent.toLowerCase();
      const show = !q || nm.includes(q);
      c.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });
    overlay.querySelectorAll('.food-lib-section').forEach((sec) => {
      const any = [...sec.querySelectorAll('.food-lib-chip')].some((c) => c.style.display !== 'none');
      sec.style.display = any ? '' : 'none';
    });
    const empty = overlay.querySelector('#food-lib-empty');
    if (empty) empty.style.display = anyVisible ? 'none' : '';
  });

  overlay.querySelector('#food-lib-manual').addEventListener('click', () => {
    closeModal();
    openFoodModal();
  });
}

// ==========================================================================
// SLEEP
// ==========================================================================
// Derive a simple quality read from Health Connect sleep stages. Health Connect
// has no native "quality score", so this is computed from sleep efficiency (time
// asleep vs in bed) and the share of restorative deep+REM sleep.
function sleepQuality(stages) {
  if (!stages) return null;
  const deep = stages.deep || 0, light = stages.light || 0, rem = stages.rem || 0, awake = stages.awake || 0;
  const asleep = deep + light + rem;
  if (asleep <= 0) return null;
  const inBed = asleep + awake;
  const efficiency = inBed > 0 ? asleep / inBed : 1;
  const deepRem = (deep + rem) / asleep;
  let key = 'fair';
  if (efficiency >= 0.9 && deepRem >= 0.4) key = 'excellent';
  else if (efficiency >= 0.85 && deepRem >= 0.28) key = 'good';
  return { key, efficiency: Math.round(efficiency * 100) };
}

// Segmented sleep-stage bar (+ legend + quality, unless compact). Renders
// nothing when the entry has no stage data (e.g. a manual entry, or a source
// app that doesn't record stages).
function sleepStagesHtml(entry, opts) {
  const s = entry && entry.stages;
  if (!s) return '';
  const deep = s.deep || 0, light = s.light || 0, rem = s.rem || 0, awake = s.awake || 0;
  const total = deep + light + rem + awake;
  if (total <= 0) return '';
  const seg = (v, cls) => (v > 0 ? `<span class="sl-seg ${cls}" style="width:${(v / total * 100)}%"></span>` : '');
  const bar = `<div class="sl-bar">${seg(deep, 'deep')}${seg(rem, 'rem')}${seg(light, 'light')}${seg(awake, 'awake')}</div>`;
  if (opts && opts.compact) return `<div class="sl-bar-wrap">${bar}</div>`;
  const q = sleepQuality(s);
  const leg = (v, cls, label) => (v > 0
    ? `<div class="sl-leg-item"><span class="sl-dot ${cls}"></span><span class="sl-leg-label">${label}</span><span class="sl-leg-val num">${formatDuration(v)}</span></div>`
    : '');
  return `
    <div class="sleep-detail">
      <div class="sleep-detail-head">
        <div class="sleep-detail-title">${t('sleep_stages')}</div>
        ${q ? `<span class="sleep-quality q-${q.key}">${t('sleep_q_' + q.key)}</span>` : ''}
      </div>
      ${bar}
      <div class="sl-legend">
        ${leg(deep, 'deep', t('sleep_deep'))}
        ${leg(rem, 'rem', t('sleep_rem'))}
        ${leg(light, 'light', t('sleep_light'))}
        ${leg(awake, 'awake', t('sleep_awake'))}
      </div>
      ${q ? `<div class="sleep-eff">${t('sleep_efficiency')}: <span class="num">${q.efficiency}%</span></div>` : ''}
    </div>`;
}

function renderSleep(el) {
  const list = DB.sleep.list();
  const visibleSleep = viewContext.sleepHistoryExpanded ? list : list.slice(0, 30);
  const last7 = list.slice(0, 7);
  const avgMin = last7.length > 0
    ? Math.round(last7.reduce((s, x) => s + x.durationMinutes, 0) / last7.length)
    : 0;
  const latest = list[0];

  const items = visibleSleep.map((s) => `
    <div class="data-row">
      <div class="data-icon sleep">${icon('bed', 20)}</div>
      <div class="data-main">
        <div class="data-title">${formatDate(s.date)}${s.source === 'health' ? `<span class="src-badge">${icon('refresh', 16)}${t('from_watch')}</span>` : ''}</div>
        <div class="data-meta">
          <span class="num">${formatTime12(s.sleepTime)}</span>
          <span>→</span>
          <span class="num">${formatTime12(s.wakeTime)}</span>
        </div>
        ${sleepStagesHtml(s, { compact: true })}
      </div>
      <div class="data-value num">${formatDuration(s.durationMinutes)}</div>
      <div class="data-actions">
        <button class="icon-btn" data-edit-sleep="${escapeHtml(s.id)}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
        <button class="icon-btn danger" data-delete-sleep="${escapeHtml(s.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    ${vaultBar()}

    <div class="page-header">
      <div class="page-eyebrow">${t('nights_logged_t')}</div>
      <h1 class="page-title">${t('sleep')}</h1>
      <p class="page-subtitle">${t('sleep_subtitle')}</p>
    </div>

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-box-label">${t('last_night')}</div>
        <div class="stat-box-value ${latest ? 'accent' : 'none'} num">${latest ? formatDuration(latest.durationMinutes) : '—'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('avg_7d')}</div>
        <div class="stat-box-value ${avgMin > 0 ? '' : 'none'} num">${avgMin > 0 ? formatDuration(avgMin) : '—'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('nights_logged')}</div>
        <div class="stat-box-value num">${list.length}</div>
      </div>
    </div>

    ${latest ? `
      <!-- APPLY-vault.md §4: ONE card carries last night — duration in 34px
           mono, then the stage bar, then the times. Then two small cards, deep
           and efficiency. The three stat boxes above stay: they answer "how am
           I doing lately", which is a different question from "how was last
           night" and is what the rest of the list is about. -->
      <div class="card sleep-hero">
        <div class="sleep-hero-label">${t('last_night')}</div>
        <div class="sleep-hero-dur num" dir="ltr">${formatDuration(latest.durationMinutes)}</div>
        ${latest.stages ? sleepStagesHtml(latest, { compact: true }) : ''}
        <div class="sleep-hero-times">
          ${icon('moon', 16)}<span class="num" dir="ltr">${formatTime12(latest.sleepTime)}</span>
          <span aria-hidden="true">→</span>
          <span class="num" dir="ltr">${formatTime12(latest.wakeTime)}</span>
        </div>
      </div>
      ${latest.stages ? (() => {
        const q = sleepQuality(latest.stages);
        const deepMin = latest.stages.deep || 0;
        return `
          <div class="sleep-mini">
            <div class="card sleep-mini-card">
              <div class="sleep-mini-label">${t('sleep_deep')}</div>
              <div class="sleep-mini-value num" dir="ltr">${formatDuration(deepMin)}</div>
            </div>
            <div class="card sleep-mini-card">
              <div class="sleep-mini-label">${t('sleep_efficiency')}</div>
              <div class="sleep-mini-value num" dir="ltr">${q ? q.efficiency + '%' : '—'}</div>
            </div>
          </div>`;
      })() : ''}
    ` : ''}

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('history')}</div>
      <button class="btn btn-primary" id="add-sleep-btn">${icon('plus', 20)} ${t('log')}</button>
    </div>

    ${list.length === 0
      ? emptyState({ iconName: 'moon', title: t('no_sleep_logged'), text: t('no_sleep_text') })
      : `<div class="data-list">${items}</div>`
    }
  `;

  // Single add button: the labeled "Log" button (the top-bar + was a duplicate).
  if (visibleSleep.length < list.length) {
    const showMore = document.createElement('button');
    showMore.type = 'button';
    showMore.className = 'btn btn-ghost btn-block';
    showMore.id = 'show-more-sleep';
    showMore.textContent = t('show_more');
    $('.data-list', el).after(showMore);
  }

  $('#add-sleep-btn', el).addEventListener('click', () => openSleepModal());
  $('#show-more-sleep', el)?.addEventListener('click', () => {
    viewContext.sleepHistoryExpanded = true;
    renderSleep(el);
  });
  el.querySelectorAll('[data-edit-sleep]').forEach((b) =>
    b.addEventListener('click', () => openSleepModal(b.dataset.editSleep))
  );
  el.querySelectorAll('[data-delete-sleep]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_sleep_q'),
        text: t('delete_sleep_text'),
        onConfirm: () => {
          DB.sleep.remove(b.dataset.deleteSleep);
          showToast(t('deleted'));
          renderSleep(el);
        },
      });
    })
  );
}

function openSleepModal(sleepId = null) {
  const existing = sleepId ? DB.sleep.list().find((s) => s.id === sleepId) : null;
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_sleep') : t('log_sleep')}</div>
        <div class="modal-subtitle">${t('sleep_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="sleep-date" value="${escapeHtml(existing ? existing.date : todayISO())}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('sleep_time')}</label>
        <input type="time" id="sleep-start" value="${escapeHtml(existing ? existing.sleepTime : '23:00')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('wake_time')}</label>
        <input type="time" id="sleep-end" value="${escapeHtml(existing ? existing.wakeTime : '07:00')}">
      </div>
    </div>

    <div id="sleep-duration-preview" class="prev-session" style="margin-bottom:0">
      <div class="prev-session-head"><span>${t('total_sleep')}</span></div>
      <div class="prev-session-sets num" style="font-size:18px;font-weight:900;letter-spacing:-0.03em"></div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-sleep-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  function updatePreview() {
    const start = $('#sleep-start').value;
    const end = $('#sleep-end').value;
    const prev = $('#sleep-duration-preview .prev-session-sets');
    if (!start || !end) { prev.textContent = '—'; return; }
    const [sh, sm] = start.split(':').map(Number);
    const [wh, wm] = end.split(':').map(Number);
    let s = sh * 60 + sm;
    let e = wh * 60 + wm;
    if (e <= s) e += 24 * 60;
    prev.textContent = formatDuration(e - s);
  }
  updatePreview();
  $('#sleep-start').addEventListener('input', updatePreview);
  $('#sleep-end').addEventListener('input', updatePreview);

  $('#save-sleep-btn').addEventListener('click', () => {
    const date = $('#sleep-date').value;
    const sleepTime = $('#sleep-start').value;
    const wakeTime = $('#sleep-end').value;
    if (!date || !sleepTime || !wakeTime) { showToast(t('fill_all_fields')); return; }
    if (existing) {
      DB.sleep.update(existing.id, { date, sleepTime, wakeTime });
      showToast(t('updated'));
    } else {
      DB.sleep.add({ date, sleepTime, wakeTime });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });
}

// ==========================================================================
// COMPARE
// ==========================================================================

// ==========================================================================
// PROGRESS — APPLY-vault.md §4 ("التقدّم")
//
// The spec describes a progress screen with three things: ten weight bars that
// age from grey to orange, two cards (training volume, monthly count), and the
// streak card LAST in --up with a light line above its border.
//
// No such screen existed. Weight was a line chart inside a modal, volume lived
// on the Program tab and the streak on Home — the three facts that answer "am I
// getting anywhere" were in three different places, none of them together. This
// puts them on `compare`, which is already the app's progress screen (reached
// from Home, titled "compare", and about change over time) rather than adding a
// fourth destination that would duplicate all three.
//
// THE RAMP IS THE POINT: the newest bar is the accent and each older one steps
// back toward the surface. A flat set of ten bars makes the oldest reading as
// loud as today's, which is the opposite of what a trend is for.
// ==========================================================================
function progressSectionHtml() {
  const all = DB.bodyweight.list();          // oldest → newest
  const pts = all.slice(-10);                // the spec's ten
  const streak = computeStreak();

  let weightHtml = '';
  if (pts.length >= 2) {
    const kgs = pts.map((p) => p.kg);
    const min = Math.min(...kgs), max = Math.max(...kgs);
    // A flat span would divide by zero AND draw ten identical bars; give it a
    // floor so a steady weight reads as steady rather than as missing data.
    const span = Math.max(0.1, max - min);
    const first = kgs[0], last = kgs[kgs.length - 1];
    const delta = Math.round((last - first) * 10) / 10;
    const bars = pts.map((p, i) => {
      // 28%..100% of the track: even the lowest point keeps a visible stub, so
      // ten bars read as a series rather than as one bar and nine gaps.
      const h = 28 + ((p.kg - min) / span) * 72;
      const age = pts.length === 1 ? 1 : i / (pts.length - 1);   // 0 oldest → 1 newest
      return `<span class="pg-bar" style="height:${h.toFixed(1)}%;--age:${age.toFixed(3)}"
                    title="${escapeHtml(formatDate(p.date))} · ${fmtWeight(p.kg)}"></span>`;
    }).join('');
    weightHtml = `
      <div class="card pg-card">
        <div class="pg-head">
          <span class="rot-section-title">${t('bodyweight')}</span>
          <span class="pg-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''} num" dir="ltr">${
            delta > 0 ? '+' : ''}${fmtWeight(Math.abs(delta) === 0 ? 0 : delta)} ${unitLabel()}</span>
        </div>
        <div class="pg-bars">${bars}</div>
        <div class="pg-scale">
          <span class="num" dir="ltr">${escapeHtml(formatDateShort(pts[0].date))}</span>
          <span class="num" dir="ltr">${escapeHtml(formatDateShort(pts[pts.length - 1].date))}</span>
        </div>
      </div>`;
  }

  // Volume and count for the last 30 days — the spec's two cards.
  const since = addDaysISO(todayISO(), -30);
  const recent = DB.sessions.listAll().filter((s) => s.date >= since);
  let volume = 0;
  recent.forEach((s) => (s.sets || []).forEach((set) => {
    volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
  }));
  const monthCount = new Set(recent.filter((s) => (s.sets || []).length).map((s) => s.date)).size;

  const cardsHtml = `
    <div class="pg-two">
      <div class="card pg-mini">
        <div class="pg-mini-label">${t('pg_volume_30d')}</div>
        <div class="pg-mini-value num" dir="ltr">${fmtNum(Math.round(volume))}</div>
        <div class="pg-mini-unit">${unitLabel()}</div>
      </div>
      <div class="card pg-mini">
        <div class="pg-mini-label">${t('pg_sessions_30d')}</div>
        <div class="pg-mini-value num" dir="ltr">${fmtNum(monthCount)}</div>
        <div class="pg-mini-unit">${t('pg_days_unit')}</div>
      </div>
    </div>`;


  return weightHtml + cardsHtml;
}

// Rendered LAST on the screen, below the week-over-week tabs — the spec says the
// streak card is the final thing, and inside the progress block it would have
// sat fourth of seven. The weight bars stay at the top because they are the
// headline; the streak is the closing note.
//
// The spec calls this "the GOLDEN streak card" and then names --up, which is
// green here. The token wins over the adjective, exactly as it did for the
// rest-day sheet: a named token is unambiguous and a colour word is not.
function progressStreakHtml() {
  const streak = computeStreak();
  if (streak <= 0) return '';
  return `
    <div class="card pg-streak">
      <span class="pg-streak-icon">${icon('zap', 22)}</span>
      <span class="pg-streak-main">
        <span class="pg-streak-value num" dir="ltr">${fmtNum(streak)}</span>
        <span class="pg-streak-label">${streak === 1 ? t('streak_one_day') : t('streak_days')}</span>
      </span>
    </div>`;
}

function renderCompare(el) {
  const tab = viewContext.compareTab || 'workouts';

  const tabsHtml = `
    <div class="compare-tabs">
      <button class="compare-tab ${tab === 'workouts' ? 'active' : ''}" data-compare-tab="workouts">${t('workouts')}</button>
      <button class="compare-tab ${tab === 'cardio' ? 'active' : ''}" data-compare-tab="cardio">${t('cardio')}</button>
      <button class="compare-tab ${tab === 'sleep' ? 'active' : ''}" data-compare-tab="sleep">${t('sleep')}</button>
    </div>
  `;

  let contentHtml = '';
  if (tab === 'workouts') contentHtml = renderCompareWorkouts();
  if (tab === 'cardio') contentHtml = renderCompareCardio();
  if (tab === 'sleep') contentHtml = renderCompareSleep();

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('compare_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('weekly')}</div>
      <h1 class="page-title">${t('compare')}</h1>
      <p class="page-subtitle">${t('compare_subtitle')}</p>
    </div>

    ${progressSectionHtml()}
    ${tabsHtml}
    ${contentHtml}
    ${progressStreakHtml()}
  `;

  el.querySelectorAll('[data-compare-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      viewContext.compareTab = b.dataset.compareTab;
      renderCompare(el);
    })
  );

  el.querySelectorAll('[data-goto-exercise]').forEach((b) =>
    b.addEventListener('click', () => navigate('exercise-detail', { exerciseId: b.dataset.gotoExercise }))
  );
}

function renderCompareWorkouts() {
  const exercises = DB.exercises.list();
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();

  const cards = exercises.map((ex) => {
    const sessions = DB.sessions.listByExercise(ex.id);
    if (sessions.length === 0) return null;

    const thisW = sessions.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
    const lastW = sessions.filter((s) => inRangeISO(s.date, lastStart, lastEnd));

    const bestOf = (arr) => {
      let m = 0;
      arr.forEach((s) => s.sets.forEach((x) => { if (x.weight > m) m = x.weight; }));
      return m;
    };

    const thisBest = bestOf(thisW);
    const lastBest = bestOf(lastW);
    if (thisBest === 0 && lastBest === 0) return null;

    return `
      <button class="compare-card" data-goto-exercise="${escapeHtml(ex.id)}">
        <div class="compare-card-title">${escapeHtml(exDisplayName(ex))}</div>
        <div class="compare-weeks">
          <div class="compare-week">
            <div class="compare-week-label">${t('last_week_label')}</div>
            <div class="compare-week-value num">${lastBest > 0 ? fmtWeight(lastBest) : '—'}<span style="font-size:12px;color:var(--text-mute);font-weight:700;margin-left:3px">${lastBest > 0 ? unitLabel() : ''}</span></div>
            <div class="compare-week-sub">${fmtNum(lastW.reduce((s, x) => s + x.sets.length, 0))} ${t('sessions_n').toLowerCase()}</div>
          </div>
          <div class="compare-week">
            <div class="compare-week-label">${t('this_week_label')}</div>
            <div class="compare-week-value num">${thisBest > 0 ? fmtWeight(thisBest) : '—'}<span style="font-size:12px;color:var(--text-mute);font-weight:700;margin-left:3px">${thisBest > 0 ? unitLabel() : ''}</span></div>
            <div class="compare-week-sub">${fmtNum(thisW.reduce((s, x) => s + x.sets.length, 0))} ${t('sessions_n').toLowerCase()}</div>
          </div>
        </div>
        ${deltaBlock(convertWeightForDisplay(thisBest), convertWeightForDisplay(lastBest), unitLabel())}
      </button>
    `;
  }).filter(Boolean).join('');

  return cards || emptyState({
    iconName: 'dumbbell',
    title: t('not_enough_data'),
    text: t('not_enough_data_text'),
  });
}

function renderCompareCardio() {
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();
  const list = DB.cardio.list();
  const thisW = list.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const lastW = list.filter((c) => inRangeISO(c.date, lastStart, lastEnd));

  if (thisW.length === 0 && lastW.length === 0) {
    return emptyState({ iconName: 'run', title: t('not_enough_data'), text: t('not_enough_cardio') });
  }

  const thisMin = thisW.reduce((s, c) => s + c.duration, 0);
  const lastMin = lastW.reduce((s, c) => s + c.duration, 0);
  const thisCal = thisW.reduce((s, c) => s + c.calories, 0);
  const lastCal = lastW.reduce((s, c) => s + c.calories, 0);

  return `
    <div class="compare-card">
      <div class="compare-card-title">${t('total_minutes')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastMin}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisMin}</div></div>
      </div>
      ${deltaBlock(thisMin, lastMin, t('minutes').toLowerCase())}
    </div>

    <div class="compare-card">
      <div class="compare-card-title">${t('calories_burned')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastCal}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisCal}</div></div>
      </div>
      ${deltaBlock(thisCal, lastCal, t('cal'))}
    </div>

    <div class="compare-card">
      <div class="compare-card-title">${t('sessions_w')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastW.length}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisW.length}</div></div>
      </div>
      ${deltaBlock(thisW.length, lastW.length, '')}
    </div>
  `;
}

function renderCompareSleep() {
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();
  const list = DB.sleep.list();
  const thisW = list.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
  const lastW = list.filter((s) => inRangeISO(s.date, lastStart, lastEnd));

  if (thisW.length === 0 && lastW.length === 0) {
    return emptyState({ iconName: 'moon', title: t('not_enough_data'), text: t('not_enough_sleep') });
  }

  const avg = (arr) => arr.length === 0 ? 0 : Math.round(arr.reduce((s, x) => s + x.durationMinutes, 0) / arr.length);
  const thisAvg = avg(thisW);
  const lastAvg = avg(lastW);

  let delta;
  if (thisAvg === 0 || lastAvg === 0) {
    delta = `<div class="compare-delta flat">${icon('minus', 16)} ${t('need_both_weeks')}</div>`;
  } else if (thisAvg > lastAvg) {
    delta = `<div class="compare-delta up">${icon('arrowUp', 16)} +${formatDuration(thisAvg - lastAvg)}</div>`;
  } else if (thisAvg < lastAvg) {
    delta = `<div class="compare-delta down">${icon('arrowDown', 16)} -${formatDuration(lastAvg - thisAvg)}</div>`;
  } else {
    delta = `<div class="compare-delta flat">${icon('minus', 16)} ${t('same_as_last_week')}</div>`;
  }

  return `
    <div class="compare-card">
      <div class="compare-card-title">${t('avg_sleep')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastAvg > 0 ? formatDuration(lastAvg) : '—'}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisAvg > 0 ? formatDuration(thisAvg) : '—'}</div></div>
      </div>
      ${delta}
    </div>

    <div class="compare-card">
      <div class="compare-card-title">${t('nights_logged_t')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastW.length}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisW.length}</div></div>
      </div>
      ${deltaBlock(thisW.length, lastW.length, '')}
    </div>
  `;
}

// ==========================================================================
// SETTINGS
// ==========================================================================
// Two modes. With thirteen skins this needed a row that opened a modal grid;
// with two it is a segmented control shown in place — one tap instead of three,
// and the choice is visible without opening anything. Each option paints a real
// miniature of the mode it selects (page ground, a raised card, the accent) so
// the swatch is the thing itself rather than three abstract dots.
const MODE_LIST = [
  { id: 'dark', cls: 'mode-swatch-dark' },
  { id: 'light', cls: 'mode-swatch-light' },
];
function modeToggleHtml(currentTheme) {
  return `<div class="mode-toggle" role="radiogroup" aria-label="${escapeHtml(t('theme'))}">${MODE_LIST.map((m) => `
    <button class="mode-option ${currentTheme === m.id ? 'active' : ''}" data-theme="${m.id}"
            role="radio" aria-checked="${currentTheme === m.id}">
      <span class="mode-swatch ${m.cls}" aria-hidden="true"><span class="mode-swatch-card"></span><span class="mode-swatch-bar"></span></span>
      <span class="mode-name">${escapeHtml(t('theme_' + m.id))}</span>
    </button>`).join('')}</div>`;
}

function renderSettings(el) {
  const prefs = DB.prefs.get();
  const currentTheme = normalizeTheme(prefs.theme);
  const currentLang = prefs.lang || 'en';

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('settings_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${icon('settings', 16)}</div>
      <h1 class="page-title">${t('settings_title')}</h1>
      <p class="page-subtitle">${t('settings_subtitle')}</p>
    </div>

    ${(window.Cloud && Cloud.configured()) ? `
    <div class="settings-section" id="account-section">
      <div class="section-title" style="margin-top:0">${t('account')}</div>
      <div id="account-body">
        <button class="settings-action-row" style="cursor:default">
          <div class="settings-action-icon">${icon('globe', 20)}</div>
          <div class="settings-action-main">
            <div class="settings-action-title">${t('auth_checking')}</div>
          </div>
        </button>
      </div>
    </div>` : ''}

    <div class="settings-section">
      <div class="section-title"${(window.Cloud && Cloud.configured()) ? '' : ' style="margin-top:0"'}>${t('language')}</div>
      <div class="lang-toggle">
        <button class="lang-option ${currentLang === 'ar' ? 'active' : ''}" data-lang="ar">العربية</button>
        <button class="lang-option ${currentLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
      </div>
    </div>

    ${currentLang === 'ar' ? `
    <div class="settings-section">
      <div class="section-title">${t('translate_ex_title')}</div>
      <p class="settings-hint">${t('translate_ex_sub')}</p>
      <div class="lang-toggle">
        <button class="lang-option ${prefs.translateExercises !== false ? 'active' : ''}" data-translate-ex="1">${t('translate_ex_on')}</button>
        <button class="lang-option ${prefs.translateExercises === false ? 'active' : ''}" data-translate-ex="0">${t('translate_ex_off')}</button>
      </div>
    </div>` : ''}

    <div class="settings-section">
      <div class="section-title">${t('theme')}</div>
      ${modeToggleHtml(currentTheme)}
    </div>

    <div class="settings-section">
      <div class="section-title">${t('unit_label')}</div>
      <div class="unit-toggle">
        <button class="unit-option ${(prefs.unit || 'kg') === 'kg' ? 'active' : ''}" data-unit="kg">${t('kg_label')}</button>
        <button class="unit-option ${prefs.unit === 'lb' ? 'active' : ''}" data-unit="lb">${t('lb_label')}</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('health_section')}</div>
      <button class="settings-action-row" id="health-btn">
        <div class="settings-action-icon">${icon('heartPulse', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('health_connect')}</div>
          <div class="settings-action-sub">${t('health_connect_sub')}</div>
        </div>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('remind_title')}</div>
      <button class="settings-action-row" id="notifications-btn">
        <div class="settings-action-icon">${icon('bell', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('notif_settings_title')}</div>
          <div class="settings-action-sub">${(() => {
            const c = DB.notif.get().channels;
            const n = Object.keys(c).filter((k) => c[k].on).length;
            const unseen = (() => { try { return DB.notif.unseenCount(); } catch (_) { return 0; } })();
            const base = t('notif_settings_of').replace('{n}', fmtNum(n));
            return unseen ? base + ' · ' + escapeHtml(t('notif_unseen').replace('{n}', fmtNum(unseen))) : base;
          })()}</div>
        </div>
        ${(() => { try { return DB.notif.unseenCount() ? '<span class="ntfs-badge"></span>' : ''; } catch (_) { return ''; } })()}
        <span class="icon-mirror settings-action-chev">${icon('chevronRight', 16)}</span>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('feedback_title')}</div>
      <button class="settings-action-row" id="feedback-btn">
        <div class="settings-action-icon icon-mirror">${icon('send', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('feedback_title')}</div>
          <div class="settings-action-sub">${t('feedback_sub')}</div>
        </div>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('data')}</div>
      <button class="settings-action-row" id="export-btn">
        <div class="settings-action-icon">${icon('download', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('export_data')}</div>
          <div class="settings-action-sub">${t('export_data_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row" id="import-btn">
        <div class="settings-action-icon">${icon('upload', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('import_data')}</div>
          <div class="settings-action-sub">${t('import_data_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row is-danger" id="reset-btn">
        <div class="settings-action-icon">${icon('refresh', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('reset_data')}</div>
          <div class="settings-action-sub">${t('reset_data_sub')}</div>
        </div>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('about_title')}</div>
      <a class="settings-action-row" href="privacy.html?lang=${(DB.prefs.get().lang) || 'en'}" target="_blank" rel="noopener">
        <div class="settings-action-icon">${icon('info', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('privacy_policy')}</div>
          <div class="settings-action-sub">${t('privacy_policy_sub')}</div>
        </div>
      </a>
    </div>
  `;

  // Account (cloud sync) — populated async since the session check is async.
  if (window.Cloud && Cloud.configured()) populateAccount(el);

  // Exercise-name translation toggle (Arabic only)
  el.querySelectorAll('[data-translate-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setTranslateExercises(b.dataset.translateEx === '1');
      renderSettings(el);
      showToast(t('saved'));
    })
  );

  // Language buttons
  el.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setLang(b.dataset.lang);
      applyLang(b.dataset.lang);
      renderSettings(el);
    })
  );

  // Mode toggle — applies immediately, so the tap IS the preview.
  el.querySelectorAll('[data-theme]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setTheme(b.dataset.theme);
      applyTheme(b.dataset.theme);
      renderSettings(el);
    })
  );

  // Unit toggle
  el.querySelectorAll('[data-unit]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setUnit(b.dataset.unit);
      renderSettings(el);
    })
  );

  // Health Connect (provided by js/health.js — runs only inside the Android app)
  $('#health-btn', el)?.addEventListener('click', () => {
    if (window.Health && typeof window.Health.open === 'function') window.Health.open();
    else showToast(t('health_only_android'));
  });

  $('#notifications-btn', el)?.addEventListener('click', () => navigate('notifications'));

  // Feedback / suggestions
  $('#feedback-btn', el)?.addEventListener('click', showFeedback);

  // Export
  $('#export-btn', el).addEventListener('click', () => { exportBackupFile(); });

  // Import
  $('#import-btn', el).addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = DB.importJSON(reader.result);
        if (ok) {
          showToast(t('imported'));
          const p = DB.prefs.get();
          applyTheme(p.theme || 'dark');
          applyLang(p.lang || 'en');
          navigate('home');
        } else {
          showToast(t('import_failed'));
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // Reset
  $('#reset-btn', el).addEventListener('click', () => {
    confirmDialog({
      title: t('reset_q'),
      text: t('reset_text'),
      confirmLabel: t('reset_confirm'),
      onConfirm: () => {
        DB.resetAll();
        const p = DB.prefs.get();
        applyTheme(p.theme || 'dark');
        applyLang(p.lang || 'en');
        navigate('home');
        showToast(t('deleted'));
      },
    });
  });

}

// ==========================================================================
// Chart + Variations helpers (used in exercise detail)
// ==========================================================================
function chartHtmlForExercise(exerciseId, sessions) {
  // Plot max weight across the most recent up to 10 sessions (chronological order)
  sessions = sessions || DB.sessions.listByExercise(exerciseId);
  if (sessions.length < 2) {
    return `
      <div class="chart-card">
        <div class="chart-head">
          <div class="chart-title">${t('progress_chart')}</div>
        </div>
        <div class="chart-empty">${t('no_chart_data')}</div>
      </div>
    `;
  }

  // sessions are sorted desc by date; reverse for chronological
  const points = sessions
    .slice(0, 10)
    .reverse()
    .map((s) => {
      const maxW = Math.max(0, ...s.sets.map((x) => x.weight));
      return { date: s.date, value: maxW };
    })
    .filter((p) => p.value > 0);

  if (points.length < 2) {
    return `
      <div class="chart-card">
        <div class="chart-head">
          <div class="chart-title">${t('progress_chart')}</div>
        </div>
        <div class="chart-empty">${t('no_chart_data')}</div>
      </div>
    `;
  }

  const W = 300, H = 100, PAD_X = 12, PAD_Y = 12;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const stepX = (W - PAD_X * 2) / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_Y + (H - PAD_Y * 2) * (1 - (p.value - min) / span),
    v: p.value,
  }));

  const pathD = coords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
  const areaD = pathD + ` L ${coords[coords.length - 1].x} ${H - PAD_Y} L ${coords[0].x} ${H - PAD_Y} Z`;
  const dots = coords.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="3" fill="var(--accent)"/>`).join('');

  const latest = points[points.length - 1].value;

  return `
    <div class="chart-card">
      <div class="chart-head">
        <div class="chart-title">${t('max_weight_per_session')}</div>
        <div class="chart-latest num">${fmtWeight(latest)} ${unitLabel()}</div>
      </div>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#chart-grad)"/>
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
      </svg>
    </div>
  `;
}


// ==========================================================================
// PLANNER VIEW
// ==========================================================================
function renderPlanner(el) {
  const plan = DB.plan.get() || { mode: 'rotation', cycle: [], trainingDays: [], anchor: null };
  const cycle = plan.cycle || [];
  const trainingDays = plan.trainingDays || [];
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const dayOrder = [0, 1, 2, 3, 4, 5, 6];

  // Training-day pills (which weekdays you train; the others are rest).
  const daysHtml = dayOrder.map((d) =>
    `<button type="button" class="schedule-day ${trainingDays.indexOf(d) !== -1 ? 'active' : ''}" data-td="${d}">${escapeHtml(dayName(d, false))}</button>`
  ).join('');

  // The ordered CYCLE of workouts (Push → Pull → Legs …), rolled across days.
  const slotsHtml = cycle.length
    ? cycle.map((slot, i) => {
        const exObjs = (slot.exerciseIds || []).map((id) => exerciseById[id]).filter(Boolean);
        return `
          <div class="rot-slot" data-slot="${i}">
            <div class="rot-slot-head">
              <span class="rot-slot-num num">${fmtNum(i + 1)}</span>
              <span class="rot-slot-name">${escapeHtml(slot.name || 'Workout')}</span>
              <span class="rot-slot-meta">${fmtNum(exObjs.length)} ${exObjs.length === 1 ? t('exercise') : t('exercises')}</span>
              <span class="rot-slot-actions">
                <button type="button" class="icon-btn icon-btn-tile" data-up="${i}" aria-label="${t('move_up')}" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="icon-btn icon-btn-tile" data-down="${i}" aria-label="${t('move_down')}" ${i === cycle.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="icon-btn icon-btn-tile" data-edit="${i}" aria-label="${t('edit_workout')}">${icon('edit', 20)}</button>
              </span>
            </div>
            <div class="rot-slot-ex">${
              exObjs.length
                ? exObjs.map((ex) => `<span class="today-plan-chip">${escapeHtml(exDisplayName(ex))}</span>`).join('')
                : `<span class="planner-empty-hint">${t('empty_day_drop')}</span>`
            }</div>
          </div>`;
      }).join('')
    : `<div class="planner-empty-hint" style="padding:16px 2px">${t('no_plan_today_sub')}</div>`;

  // Rolling preview — the next 7 days computed from the REAL rotation.
  const start = new Date(); start.setHours(12, 0, 0, 0);
  const previewHtml = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = addDaysISO(todayISO(), i);
    const w = DB.plan.workoutForDate(d);
    return `
      <button type="button" class="schedule-prev-row ${w ? '' : 'rest'}" data-day-iso="${iso}">
        <span class="schedule-prev-day">${escapeHtml(dayName(d.getDay(), true))}</span>
        <span class="schedule-prev-arrow">${w ? '→' : ''}</span>
        <span class="schedule-prev-workout">${w ? escapeHtml(w.name) : t('rest_day')}</span>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('planner_title')}</div>
    </div>

    <div class="page-header">
      <h1 class="page-title">${t('planner_title')}</h1>
      <p class="page-subtitle">${t('planner_subtitle')}</p>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary" id="apply-template-btn" style="flex:1">${icon('plus', 20)} ${t('apply_template')}</button>
      ${cycle.length ? `<button class="btn btn-ghost" id="clear-plan-btn" aria-label="${escapeHtml(t('clear_plan'))}">${icon('trash', 20)}</button>` : ''}
    </div>

    <div class="rot-section">
      <div class="rot-section-title">${t('training_days')}</div>
      <div class="schedule-days">${daysHtml}</div>
    </div>

    <div class="rot-section">
      <div class="rot-section-title">${t('rotation_cycle')}</div>
      <div class="rot-slots">${slotsHtml}</div>
      <button class="btn btn-ghost btn-block" id="add-slot-btn" style="margin-top:10px">${icon('plus', 20)} ${t('add_workout')}</button>
    </div>

    <div class="rot-section">
      <div class="rot-section-title">${t('rotation_preview')}</div>
      <div class="schedule-preview">${previewHtml}</div>
    </div>
  `;

  $('#apply-template-btn', el)?.addEventListener('click', openTemplatesModal);
  $('#add-slot-btn', el)?.addEventListener('click', () => openSlotEditorModal(null));
  // Tap a day in the rolling preview → open/log that day's session.
  el.querySelector('.schedule-preview')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-day-iso]');
    if (row) navigate('session-day', { date: row.dataset.dayIso });
  });

  $('#clear-plan-btn', el)?.addEventListener('click', () => {
    confirmDialog({
      title: t('clear_plan_q'),
      text: t('clear_plan_text'),
      confirmLabel: t('clear_plan'),
      onConfirm: () => { DB.plan.clearAll(); showToast(t('plan_cleared')); renderPlanner(el); },
    });
  });

  // Toggle a training weekday.
  el.querySelectorAll('[data-td]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.td);
      const set = new Set(DB.plan.get().trainingDays || []);
      if (set.has(d)) set.delete(d); else set.add(d);
      DB.plan.setTrainingDays([...set]);
      renderPlanner(el);
    })
  );
  // Reorder / edit a cycle slot.
  el.querySelectorAll('[data-up]').forEach((b) =>
    b.addEventListener('click', () => { DB.plan.moveSlot(Number(b.dataset.up), Number(b.dataset.up) - 1); renderPlanner(el); })
  );
  el.querySelectorAll('[data-down]').forEach((b) =>
    b.addEventListener('click', () => { DB.plan.moveSlot(Number(b.dataset.down), Number(b.dataset.down) + 1); renderPlanner(el); })
  );
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openSlotEditorModal(Number(b.dataset.edit)))
  );
}

function openTemplatesModal() {
  const cards = WORKOUT_TEMPLATES.map((tmpl) => `
    <div class="compare-card" style="margin-bottom:8px">
      <div class="compare-card-title">${escapeHtml(tmpl.name)}</div>
      <div style="font-size:12px;color:var(--text-mute);margin-bottom:10px">${t('tmpl_desc_' + tmpl.id.replace(/-/g, '_'))} · <span class="num">${fmtNum(tmpl.days.length)}</span> ${t('workouts_label')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${tmpl.days.map((d) => `<span class="today-plan-chip">${escapeHtml(d.name)}</span>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" data-apply="${tmpl.id}">${t('apply')}</button>
    </div>
  `).join('');

  // Admin-curated "ready-made plans" (server preset_plans), additive to the
  // built-in templates above. Empty/offline → this whole block renders nothing.
  const serverCards = SERVER_PRESET_PLANS.map((tmpl) => `
    <div class="compare-card" style="margin-bottom:8px">
      <div class="compare-card-title">${escapeHtml(tmpl.name)} <span class="today-plan-chip" style="margin-inline-start:6px">${t('preset_badge')}</span></div>
      <div style="font-size:12px;color:var(--text-mute);margin-bottom:10px">${tmpl.description ? escapeHtml(tmpl.description) + ' · ' : ''}<span class="num">${fmtNum(tmpl.days.length)}</span> ${t('workouts_label')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${tmpl.days.map((d) => `<span class="today-plan-chip">${escapeHtml(d.name)}</span>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" data-apply-server="${tmpl.id}">${t('apply')}</button>
    </div>
  `).join('');

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('templates_title')}</div>
        <div class="modal-subtitle">${t('templates_subtitle')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    ${cards}
    ${serverCards ? `<div class="modal-subtitle" style="margin:14px 0 8px">${t('ready_made_section')}</div>${serverCards}` : ''}
  `);

  document.querySelectorAll('[data-apply]').forEach((b) =>
    b.addEventListener('click', () => {
      const tmpl = WORKOUT_TEMPLATES.find((x) => x.id === b.dataset.apply);
      if (!tmpl) return;
      openScheduleModal(tmpl);
    })
  );
  document.querySelectorAll('[data-apply-server]').forEach((b) =>
    b.addEventListener('click', () => {
      const tmpl = SERVER_PRESET_PLANS.find((x) => x.id === b.dataset.applyServer);
      if (!tmpl) return;
      openScheduleModal(tmpl);
    })
  );
}

// Step 2 of applying a template: let the user choose which weekdays are
// training days (the rest stay empty). The template's workouts are distributed
// across the chosen days IN ORDER, cycling if there are more training days than
// workouts (e.g. 5 chosen days with a 3-workout PPL → Push, Pull, Legs, Push,
// Pull). Defaults are seeded from the classic heuristic for the workout count.
function openScheduleModal(tmpl) {
  const workouts = tmpl.days;           // [{ name, exercises:[names] }]
  const M = workouts.length;
  const dayOrder = [0, 1, 2, 3, 4, 5, 6]; // Sun..Sat
  const defaults = M <= 3 ? [1, 3, 5]
    : M === 4 ? [1, 2, 4, 5]
    : M === 5 ? [1, 2, 3, 4, 5]
    : M === 6 ? [0, 1, 2, 3, 4, 5]
    : [0, 1, 2, 3, 4, 5, 6];
  const training = new Set(defaults);


  function renderPreview() {
    const box = $('#schedule-preview');
    if (!box) return;
    // Roll the cycle across the next 7 days from today (rest days skip) — shows
    // the continuous rotation the way it will actually run.
    const M = workouts.length;
    const start = new Date(); start.setHours(12, 0, 0, 0);
    let elapsed = 0;
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const isTraining = training.has(d.getDay());
      const w = (isTraining && M) ? workouts[elapsed % M] : null;
      if (isTraining) elapsed++;
      rows.push(`
        <div class="schedule-prev-row ${w ? '' : 'rest'}">
          <span class="schedule-prev-day">${escapeHtml(dayName(d.getDay(), true))}</span>
          <span class="schedule-prev-arrow">${w ? '→' : ''}</span>
          <span class="schedule-prev-workout">${w ? escapeHtml(w.name) : t('rest_day')}</span>
        </div>`);
    }
    box.innerHTML = rows.join('');
    const count = $('#schedule-count');
    if (count) count.textContent = fmtNum(training.size);
    const applyBtn = $('#schedule-apply');
    if (applyBtn) applyBtn.disabled = training.size === 0;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('schedule_title')}</div>
        <div class="modal-subtitle">${escapeHtml(tmpl.name)} · <span id="schedule-count" class="num">${fmtNum(training.size)}</span> ${t('schedule_days_label')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <p class="schedule-hint">${t('schedule_hint')}</p>
    <div class="schedule-days">
      ${dayOrder.map((d) => `<button type="button" class="schedule-day ${training.has(d) ? 'active' : ''}" data-day="${d}">${escapeHtml(dayName(d, false))}</button>`).join('')}
    </div>

    <div class="schedule-preview" id="schedule-preview"></div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="schedule-apply">${t('apply')}</button>
    </div>
  `);

  renderPreview();

  document.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.day);
      if (training.has(d)) training.delete(d); else training.add(d);
      b.classList.toggle('active');
      renderPreview();
    })
  );

  $('#schedule-apply').addEventListener('click', () => {
    if (training.size === 0) return;
    const byName = Object.fromEntries(DB.exercises.list().map((e) => [e.name, e]));
    // Build the ordered CYCLE (Push, Pull, Legs…) — no longer pinned to weekdays.
    const cycle = workouts.map((w) => {
      const ids = [];
      (w.exercises || []).forEach((nm) => {
        const ex = byName[nm];
        if (ex) { ids.push(ex.id); if (!ex.inMyList) DB.exercises.setInMyList(ex.id, true); }
      });
      return { name: w.name, exerciseIds: ids };
    });
    const trainingDays = dayOrder.filter((d) => training.has(d));
    DB.plan.setRotation({ cycle, trainingDays, anchor: todayISO() });
    closeModal();
    showToast(t('template_applied'));
    // A single decisive "apply" → save and return to Home, where the new plan
    // shows on the hero. (Don't strand the user in a sub-screen.)
    navigate('home');
  });
}

// Edit ONE workout in the rotation cycle. slotIdx = number (edit cycle[i]) or
// null/undefined (create a new workout appended to the cycle). onAdd switches
// the library sheet to one view-level pick, bypassing that plan save entirely.
function openSlotEditorModal(slotIdx, onAdd) {
  const cycle = (DB.plan.get() || {}).cycle || [];
  const isNew = (slotIdx == null || slotIdx < 0 || !cycle[slotIdx]);
  const slot = isNew ? { name: '', exerciseIds: [] } : cycle[slotIdx];
  const addOnly = typeof onAdd === 'function';
  // Ordered list of picked exercise ids — the order IS the exercise order the
  // user will train in (guided mode walks it top-to-bottom), so it's reorderable.
  let pickedOrder = addOnly ? [] : [...(slot.exerciseIds || [])];
  const hasPick = (id) => pickedOrder.indexOf(id) !== -1;
  let dayLabel = slot.name || '';
  let pickerQuery = '';
  let pickerCategory = 'All';

  const allExercises = DB.exercises.list();
  const exById = Object.fromEntries(allExercises.map((e) => [e.id, e]));

  function renderPickerList() {
    const container = $('#picker-list');
    if (!container) return;
    let list = allExercises;
    if (pickerCategory !== 'All') list = list.filter((e) => e.category === pickerCategory);
    if (pickerQuery) list = list.filter((e) => exMatchesQuery(e, pickerQuery));

    container.innerHTML = list.map((ex) => {
      const imgUrl = exerciseImgSrc(ex);
      // Small square thumbnail: the real exercise photo (remote dataset or a
      // custom image) sits on top of an initials fallback; if the photo fails
      // to load it removes itself and the initials show through.
      return `
      <button type="button" class="picker-row ${hasPick(ex.id) ? 'picked' : ''}" data-pick="${escapeHtml(ex.id)}">
        <span class="picker-row-thumb" data-cat="${escapeHtml(ex.category)}">
          <span class="picker-row-thumb-fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</span>
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        </span>
        <span class="picker-row-name">${escapeHtml(exDisplayName(ex))}</span>
        <span class="picker-row-check">${icon('check', 16)}</span>
      </button>
    `;
    }).join('');

    container.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.pick;
        if (addOnly) {
          onAdd(id);
          closeModal();
          renderView(currentView);
          return;
        }
        const at = pickedOrder.indexOf(id);
        if (at !== -1) pickedOrder.splice(at, 1);   // unpick
        else pickedOrder.push(id);                  // pick → appended to the end
        b.classList.toggle('picked');
        // Live count in the sheet header — the chosen list itself is on the
        // previous screen, so this is the only feedback that a tap registered.
        const c = document.getElementById('picker-count');
        if (c) c.textContent = fmtNum(pickedOrder.length);
      })
    );
  }

  // The ordered list of chosen exercises, with ↑/↓ reorder + remove. This is
  // what sets the training order for the day (used as-is by guided mode).
  function renderChosenList() {
    const wrap = $('#chosen-wrap');
    if (!wrap) return;
    if (!pickedOrder.length) { wrap.innerHTML = ''; return; }
    const rows = pickedOrder.map((id, i) => {
      const ex = exById[id];
      const nm = ex ? exDisplayName(ex) : id;
      return `
        <div class="chosen-row" data-chosen="${escapeHtml(id)}">
          <span class="chosen-num num">${fmtNum(i + 1)}</span>
          <span class="chosen-name">${escapeHtml(nm)}</span>
          <span class="chosen-actions">
            <button type="button" class="icon-btn icon-btn-tile" data-ord-up="${i}" aria-label="${t('move_up')}" ${i === 0 ? 'disabled' : ''}>${icon('arrowUp', 20)}</button>
            <button type="button" class="icon-btn icon-btn-tile" data-ord-down="${i}" aria-label="${t('move_down')}" ${i === pickedOrder.length - 1 ? 'disabled' : ''}>${icon('arrowDown', 20)}</button>
            <button type="button" class="icon-btn icon-btn-tile chosen-del" data-ord-del="${escapeHtml(id)}" aria-label="${t('delete')}">${icon('close', 20)}</button>
          </span>
        </div>`;
    }).join('');
    wrap.innerHTML = `
      <label class="form-label">${t('exercise_order')}</label>
      <div class="chosen-list">${rows}</div>`;

    wrap.querySelectorAll('[data-ord-up]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.ordUp);
        if (i > 0) { const tmp = pickedOrder[i - 1]; pickedOrder[i - 1] = pickedOrder[i]; pickedOrder[i] = tmp; renderChosenList(); }
      })
    );
    wrap.querySelectorAll('[data-ord-down]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.ordDown);
        if (i < pickedOrder.length - 1) { const tmp = pickedOrder[i + 1]; pickedOrder[i + 1] = pickedOrder[i]; pickedOrder[i] = tmp; renderChosenList(); }
      })
    );
    wrap.querySelectorAll('[data-ord-del]').forEach((b) =>
      b.addEventListener('click', () => {
        const at = pickedOrder.indexOf(b.dataset.ordDel);
        if (at !== -1) pickedOrder.splice(at, 1);
        renderChosenList();
        renderPickerList();   // reflect the unpick in the picker below
      })
    );
  }

  // ---- the exercise picker, as its OWN bottom sheet -------------------------
  //
  // It used to be a section crammed into the bottom of this same modal. That
  // forced THREE nested scroll areas (modal / chosen list / picker list) inside a
  // modal that could not itself scroll — a ~4,600px list squeezed into ~140px,
  // which is why the sheet felt stuck, rows collided with the action bar, and the
  // "remove" button ended up hidden behind exercise thumbnails.
  //
  // As a separate sheet each screen owns one scroll axis and the standard .modal
  // slide-up animation is reused, so it matches every other sheet in the app.
  function openPickerSheet() {
    const catPills = ['All', ...EXERCISE_CATEGORIES]
      .map((f) => `<button type="button" class="filter-pill ${f === pickerCategory ? 'active' : ''}" data-pick-cat="${escapeHtml(f)}">${escapeHtml(t('cat_' + f, f))}</button>`)
      .join('');

    openModal(`
      <div class="modal-header">
        <div>
          <div class="modal-title">${t('pick_exercises')}</div>
          <div class="modal-subtitle" id="picker-count">${fmtNum(pickedOrder.length)}</div>
        </div>
        <button class="icon-btn icon-btn-tile" id="picker-back" aria-label="${escapeHtml(t('back'))}">${icon('close', 20)}</button>
      </div>
      <div class="search-wrap" style="margin-bottom:8px">
        ${icon('search', 20)}
        <input type="search" id="picker-search" placeholder="${t('search_exercises')}">
      </div>
      <div class="filter-bar" style="margin: 0 0 10px">${catPills}</div>
      <div class="picker-list" id="picker-list"></div>
      <div class="form-actions sticky-actions">
        <button type="button" class="btn btn-primary btn-block" id="picker-done">${t('done')}</button>
      </div>
    `);

    renderPickerList();
    // A six-letter query otherwise rebuilds this whole list six times — and the
    // list can carry a few hundred entries, some with base64 photos, so each
    // rebuild re-parses a large HTML string and re-decodes those data URIs.
    const renderPickerSearch = debounce(renderPickerList, 150);
    $('#picker-search').addEventListener('input', (e) => {
      pickerQuery = e.target.value;
      renderPickerSearch();
    });
    document.querySelectorAll('[data-pick-cat]').forEach((b) =>
      b.addEventListener('click', () => {
        pickerCategory = b.dataset.pickCat;
        document.querySelectorAll('[data-pick-cat]').forEach((x) =>
          x.classList.toggle('active', x.dataset.pickCat === pickerCategory));
        renderPickerList();
      })
    );
    // Plan edits return to the editor because its name/order changes are still
    // unsaved; a view-level picker has no editor state to return to.
    const back = () => addOnly ? closeModal() : openEditor();
    $('#picker-back').addEventListener('click', back);
    $('#picker-done').addEventListener('click', back);
  }

  function openEditor() {
    openModal(`
      <div class="modal-header">
        <div>
          <div class="modal-title">${escapeHtml(dayLabel || t('add_workout'))}</div>
          <!-- On a NEW slot the title already says "Add workout" (the name is
               empty, so the title falls back to the same key) — echoing it here
               printed the identical sentence twice and made the sheet read as
               broken. The subtitle now carries the one thing a first-time user
               actually needs: what the two steps are. -->
          <div class="modal-subtitle">${isNew ? t('slot_editor_sub_new') : t('edit_workout')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t('name')}</label>
        <input type="text" id="day-name" placeholder="${t('workout_name_ph')}" value="${escapeHtml(dayLabel)}">
      </div>

      <div class="form-group" id="chosen-wrap"></div>

      <button type="button" class="btn btn-ghost btn-block" id="open-picker">${icon('plus', 16)} ${t('pick_exercises')}</button>

      <div class="form-actions sticky-actions">
        ${isNew ? '' : `<button type="button" class="btn btn-ghost day-rest-btn" id="day-clear-btn">${icon('trash', 16)} ${t('remove_workout')}</button>`}
        <button type="button" class="btn btn-primary" id="day-save-btn">${t('save')}</button>
      </div>
    `);

    renderChosenList();
    $('#day-name').addEventListener('input', (e) => { dayLabel = e.target.value; });
    $('#open-picker').addEventListener('click', openPickerSheet);
    $('#day-clear-btn')?.addEventListener('click', () => {
      if (!isNew) DB.plan.removeSlot(slotIdx);
      closeModal();
      showToast(t('day_cleared'));
      renderView(currentView);
    });
    $('#day-save-btn').addEventListener('click', onSave);
  }

  function onSave() {
    const ids = [...pickedOrder];   // preserve the user's chosen order
    const name = dayLabel.trim() || 'Workout';
    // Auto-add picked exercises to the user's Train list
    ids.forEach((id) => {
      const ex = DB.exercises.getById(id);
      if (ex && !ex.inMyList) DB.exercises.setInMyList(id, true);
    });
    if (isNew) {
      if (ids.length || dayLabel.trim()) {
        DB.plan.addSlot(name);
        DB.plan.setSlotExercises((DB.plan.get().cycle || []).length - 1, ids);
      }
    } else {
      DB.plan.setSlotName(slotIdx, name);
      DB.plan.setSlotExercises(slotIdx, ids);
    }
    closeModal();
    showToast(t('day_saved'));
    renderView(currentView);
  }

  if (addOnly) openPickerSheet();
  else openEditor();
}

// ==========================================================================
// SESSION DAY — log all the day's exercises in one page
// ==========================================================================
// Tapping a day in the Planner opens this view. It shows every exercise
// scheduled for that day as its own session card with inline reps/weight
// inputs. Saving a card writes a session for the chosen date — overwriting
// any existing session for the same exercise+date so the card stays a
// single source of truth for that day's training.
function renderSessionDay(el) {
  // The DATE drives everything (continuous rotation): resolve the workout for the
  // selected date + which cycle slot it is (for add/remove edits).
  if (!viewContext.sdDate) viewContext.sdDate = viewContext.date || todayISO();
  const sdDateObj = new Date(viewContext.sdDate + 'T12:00:00');
  const dow = sdDateObj.getDay();   // header label = the selected date's weekday
  const day = DB.plan.workoutForDate(sdDateObj);
  const slotIdx = day ? ((DB.plan.get().cycle || []).indexOf(day)) : -1;
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  // sdOnly narrows the day to a subset — the "least effort" route out of the
  // rest-day sheet. It is a VIEW filter, not a plan edit: the cycle slot still
  // holds every exercise, so tomorrow's plan and the planner are untouched, and
  // leaving the screen drops the filter with the rest of viewContext.
  const sdOnly = Array.isArray(viewContext.sdOnly) ? viewContext.sdOnly : null;
  const planIds = (day?.exerciseIds || []);
  // On a day the rotation calls REST there is no plan to narrow, yet the rest
  // sheet's "train a lagging muscle" route still has to put exercises on screen
  // — and a lagging muscle is by definition one the plan does not contain, so
  // it could never have been found by filtering. sdOnly starts as a FILTER over
  // the plan when there is one, but view-level additions can be outside that
  // plan and append after its selected ids. On a rest day the list is the whole
  // selection. Either way no slot is edited.
  const sdIds = sdOnly
    ? planIds.filter((id) => sdOnly.includes(id)).concat(sdOnly.filter((id) => !planIds.includes(id)))
    : planIds;
  const exObjs = sdIds.map((id) => exerciseById[id]).filter(Boolean);

  // Per-exercise local state for unsaved edits. Persists across re-renders
  // until the user navigates away.
  if (!viewContext.sdState) viewContext.sdState = {};
  const sdState = viewContext.sdState;

  // Modal-level unit (defaults to user's prefs unit, switchable per page)
  if (!viewContext.sdUnit) viewContext.sdUnit = (DB.prefs.get().unit) || 'kg';

  function modalConvertForDisplay(kg) {
    if (viewContext.sdUnit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2;
    return Math.round(kg * 100) / 100;
  }
  function modalConvertToKg(value) {
    if (viewContext.sdUnit === 'lb') return Math.round((Number(value) / KG_TO_LB) * 100) / 100;
    return Number(value);
  }

  // Find the existing logged session for an exercise on the chosen date (if any)
  function todaySessionFor(exId) {
    return DB.sessions
      .listByExercise(exId)
      .find((s) => s.date === viewContext.sdDate);
  }

  // Initialize state for an exercise the first time it's rendered. Pre-fills
  // sets from today's session (if already started) → otherwise from the most
  // recent session → otherwise three blank rows.
  function initState(exId) {
    if (sdState[exId]) {
      const cached = sdState[exId];
      // Re-validate a cached savedSessionId: the session may have been deleted
      // from the exercise-detail screen while we were away. Dropping the stale
      // id prevents a silent no-op "update" (data loss) and a false logged pill.
      if (cached.savedSessionId && !DB.sessions.get(cached.savedSessionId)) {
        cached.savedSessionId = null;
      }
      // The mirror case, and the dangerous one: a session APPEARED while we were
      // away. Guided mode logs through its own commitExercise, and the run's back
      // arrow returns here with the SAME context object, so this cache still says
      // "not logged" and still holds the values pre-filled from last week. The
      // card would then show those old sets with a live Save button, and Save
      // resolves the session by date — overwriting the workout just logged.
      // Adopt the row: its values too when the card is clean, its id alone when
      // the user has an unsaved edit here (their typing is not ours to discard,
      // but the screen must stop claiming the day is unlogged).
      if (!cached.savedSessionId) {
        const fresh = todaySessionFor(exId);
        if (fresh) {
          if (!cached.dirty) cached.sets = fresh.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
          cached.savedSessionId = fresh.id;
        }
      }
      return cached;
    }
    const today = todaySessionFor(exId);
    const last = DB.sessions.lastForExercise(exId);
    let sets;
    if (today) sets = today.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
    else if (last) sets = last.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
    else sets = [{ reps: '', weight: '' }]; // start with one empty set (faint "0" placeholders)
    sdState[exId] = { sets, savedSessionId: today ? today.id : null, dirty: false };
    return sdState[exId];
  }

  // REORDERING BEFORE THE GUIDED RUN. The run walks exObjs in order, so the
  // order the user sets here IS the order they will be taken through. It edits
  // the PLAN's cycle slot, not a view-local copy, so it persists to tomorrow's
  // session too — reordering is a decision about the workout, not about today.
  //
  // Hidden when there is nothing to reorder (one exercise), when the day is not
  // a real cycle slot (slotIdx -1, e.g. a date before the plan's anchor), and
  // when the list is FILTERED by sdOnly — the "least effort" route shows a
  // subset, and moving an item inside a subset cannot express a full-plan order.
  const canReorder = slotIdx >= 0 && exObjs.length > 1 && !sdOnly;

  function renderExerciseCard(ex) {
    const st = initState(ex.id);
    const url = exerciseImgSrc(ex);
    const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
    const isLogged = !!st.savedSessionId;
    // Show Save when the user edited (dirty) OR when an unlogged card is
    // pre-filled with real values (from last workout) so it can be confirmed
    // without a throwaway edit. A brand-new empty card stays clean.
    const hasValues = st.sets.some((s) => (Number(s.reps) || 0) > 0 || (Number(s.weight) || 0) > 0);
    const showSave = st.dirty || (!isLogged && hasValues);

    let bgHtml;
    if (machineSvg) {
      bgHtml = `<div class="sd-thumb machine-bg${url ? ' sd-thumb-zoom' : ''}"${url ? ` data-thumb-src="${escapeHtml(url)}"` : ''}>${machineSvg}${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;
    } else if (url) {
      bgHtml = `<div class="sd-thumb sd-thumb-zoom" data-thumb-src="${escapeHtml(url)}" style="background-image:url('${escapeHtml(url)}')"></div>`;
    } else {
      bgHtml = `<div class="sd-thumb fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</div>`;
    }

    const setsRows = st.sets.map((s, i) => {
      const wDisplay = (s.weight === '' || s.weight == null) ? '' : modalConvertForDisplay(Number(s.weight));
      return `
        <div class="sd-set-row" data-ex="${escapeHtml(ex.id)}" data-set="${i}">
          <div class="sd-set-n num">${i + 1}</div>
          <input type="number" inputmode="numeric" step="1" min="0" placeholder="0" value="${numAttr(s.reps)}" data-field="reps" aria-label="${escapeHtml(t('reps'))}">
          <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" value="${numAttr(wDisplay)}" data-field="weight" aria-label="${escapeHtml(viewContext.sdUnit)}">
          <button type="button" class="sd-set-remove" data-remove-set aria-label="${escapeHtml(t('delete'))}">${icon('close', 16)}</button>
        </div>
      `;
    }).join('');

    return `
      <div class="sd-card ${isLogged ? 'logged' : ''}" data-ex-card="${escapeHtml(ex.id)}">
        <div class="sd-card-head">
          ${bgHtml}
          <div class="sd-card-main">
            <div class="sd-card-name">${escapeHtml(exDisplayName(ex))}</div>
          </div>
          ${isLogged ? `<div class="sd-status-pill">${icon('check', 16)} ${t('logged')}</div>` : ''}
          <button type="button" class="icon-btn danger sd-remove-ex" data-remove-ex="${escapeHtml(ex.id)}" aria-label="${escapeHtml(t('remove_from_day'))}">${icon('trash', 20)}</button>
        </div>

        <div class="sd-sets-head">
          <div>${t('set_n')}</div>
          <div>${t('reps')}</div>
          <div>${viewContext.sdUnit.toUpperCase()}</div>
          <div></div>
        </div>
        <div class="sd-sets" data-ex-sets="${escapeHtml(ex.id)}">${setsRows}</div>

        <div class="sd-card-actions">
          <button type="button" class="btn btn-ghost sd-add-set-btn" data-add-set="${escapeHtml(ex.id)}">${icon('plus', 20)} ${t('add_set')}</button>
          <button type="button" class="btn btn-primary sd-save-btn${showSave ? '' : ' sd-hidden'}" data-save-ex="${escapeHtml(ex.id)}">${isLogged ? t('update') : t('save')}</button>
        </div>
      </div>
    `;
  }

  const totalEx = exObjs.length;
  const loggedCount = exObjs.filter((ex) => sdState[ex.id]?.savedSessionId || todaySessionFor(ex.id)).length;

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(dayName(dow, true))}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${escapeHtml(dayName(dow, true))}</div>
      <h1 class="page-title">${escapeHtml(day?.name || t('start_workout'))}</h1>
      <p class="page-subtitle">${fmtNum(loggedCount)} / ${fmtNum(totalEx)} ${t('logged_today')}</p>
    </div>

    <div class="sd-toolbar">
      <div class="form-group" style="flex:1;margin:0">
        <label class="form-label" for="sd-date">${t('date')}</label>
        <input type="date" id="sd-date" value="${escapeHtml(viewContext.sdDate)}">
      </div>
      <div class="modal-unit-toggle" role="group" aria-label="${escapeHtml(t('unit'))}">
        <button type="button" data-sd-unit="kg" aria-pressed="${viewContext.sdUnit === 'kg'}" class="${viewContext.sdUnit === 'kg' ? 'active' : ''}">KG</button>
        <button type="button" data-sd-unit="lb" aria-pressed="${viewContext.sdUnit === 'lb'}" class="${viewContext.sdUnit === 'lb' ? 'active' : ''}">LB</button>
      </div>
    </div>

    ${canReorder ? `
    <button type="button" class="sd-reorder-open" id="sd-reorder-open">
      ${icon('grip', 20)}<span>${t('reorder_exercises')}</span>
    </button>` : ''}

    ${totalEx > 0
      ? `<button type="button" class="sd-start-run icon-mirror" id="sd-start-run">${icon('play', 20)}<span>${t('guided_mode')}</span></button>`
      : ''
    }

    ${totalEx === 0
      ? emptyState({ iconName: 'dumbbell', title: t('rest_day'), text: t('no_plan_today_sub') })
      : `<div class="sd-list">${exObjs.map(renderExerciseCard).join('')}</div>`
    }

    <button type="button" class="btn btn-ghost btn-block" id="sd-add-ex" style="margin-top:12px">${icon('plus', 20)} ${t('add_exercise')}</button>
  `;

  // "Start Workout" → guided one-exercise-at-a-time mode. Carry the chosen date
  // and unit so the run logs against the same day/unit the user picked here.
  // The subset and the "minimum" tag travel with it: navigate() replaces
  // viewContext wholesale, so anything not named here is dropped. Without them
  // the run re-derived the day from the plan — on a rest day reached through
  // "train a lagging muscle" that plan is null, so the button led straight to a
  // "rest day, no workout" screen, and out of the reduced-session route it
  // reopened the whole day and logged it as a full one.
  $('#sd-start-run', el)?.addEventListener('click', () =>
    navigate('session-run', {
      date: viewContext.sdDate,
      unit: viewContext.sdUnit,
      runOnly: sdOnly,
      runMinimum: !!viewContext.sdMinimum,
    })
  );

  // ----- Bindings -----

  // Add an exercise: offer two choices — pick from the library, or create a
  // brand-new custom exercise (which is then added straight to this day).
  $('#sd-add-ex', el)?.addEventListener('click', () => openAddExerciseChooser(slotIdx, sdOnly ? (exId) => {
    const live = Array.isArray(viewContext.sdOnly) ? viewContext.sdOnly : [];
    if (!live.includes(exId)) viewContext.sdOnly = live.concat(exId);
  } : null));

  // Tap (or keyboard-activate) an exercise photo thumbnail to open it
  // full-screen. Made keyboard/SR reachable as a button.
  el.querySelectorAll('.sd-thumb-zoom').forEach((thumb) => {
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    if (!thumb.getAttribute('aria-label')) thumb.setAttribute('aria-label', t('view_photo'));
    const open = (e) => {
      e.stopPropagation();
      const name = thumb.closest('.sd-card')?.querySelector('.sd-card-name')?.textContent?.trim();
      openImageLightbox(thumb.dataset.thumbSrc, name);
    };
    thumb.addEventListener('click', open);
    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
  });

  // Tap an empty area of an exercise card → its full history (exercise-detail).
  // Ignore taps on inputs, buttons, and the photo (which has its own action).
  // For keyboard/SR users the exercise NAME is the reachable history button
  // (the card can't be one button — it contains the set inputs).
  el.querySelectorAll('.sd-card').forEach((card) => {
    const exId = card.dataset.exCard;
    card.addEventListener('click', (e) => {
      if (e.target.closest('input, button, [role="button"]')) return;
      if (exId) navigate('exercise-detail', { exerciseId: exId });
    });
    const nameEl = card.querySelector('.sd-card-name');
    if (nameEl && exId) {
      nameEl.setAttribute('role', 'button');
      nameEl.setAttribute('tabindex', '0');
      nameEl.setAttribute('aria-label', `${nameEl.textContent.trim()} — ${t('history')}`);
      const go = () => navigate('exercise-detail', { exerciseId: exId });
      nameEl.addEventListener('click', (e) => { e.stopPropagation(); go(); });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    }
  });

  // A filtered day drops the exercise from that view-level selection; a full
  // day edits its real cycle slot. Logged sessions in history are kept.
  $('#sd-reorder-open', el)?.addEventListener('click', () => openReorderSheet(slotIdx, () => renderSessionDay(el)));

  el.querySelectorAll('[data-remove-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      const exId = b.dataset.removeEx;
      if (sdOnly) viewContext.sdOnly = sdOnly.filter((id) => id !== exId);
      else DB.plan.removeExerciseFromSlot(slotIdx, exId);
      delete viewContext.sdState[exId];
      showToast(t('exercise_removed'));
      renderSessionDay(el);
    })
  );

  $('#sd-date', el)?.addEventListener('change', (e) => {
    viewContext.sdDate = e.target.value || todayISO();
    viewContext.sdState = {}; // re-init since date changed
    renderSessionDay(el);
  });

  el.querySelectorAll('[data-sd-unit]').forEach((b) =>
    b.addEventListener('click', () => {
      viewContext.sdUnit = b.dataset.sdUnit === 'lb' ? 'lb' : 'kg';
      renderSessionDay(el);
    })
  );

  // Set-row inputs (reps/weight) — write to sdState as the user types.
  el.querySelectorAll('.sd-set-row').forEach((row) => {
    const exId = row.dataset.ex;
    const idx = Number(row.dataset.set);
    row.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const v = inp.value;
        const st = initState(exId);
        if (inp.dataset.field === 'weight') {
          st.sets[idx].weight = v === '' ? '' : modalConvertToKg(v);
        } else {
          st.sets[idx][inp.dataset.field] = v === '' ? '' : Number(v);
        }
        st.dirty = true;
        // The card isn't re-rendered on keystroke, so reveal the save button here.
        row.closest('.sd-card')?.querySelector('.sd-save-btn')?.classList.remove('sd-hidden');
      });
    });
    row.querySelector('[data-remove-set]')?.addEventListener('click', () => {
      const st = initState(exId);
      if (st.sets.length <= 1) { showToast(t('set_min_one')); return; }
      st.sets.splice(idx, 1);
      st.dirty = true;
      renderSessionDay(el);
    });
  });

  // Add Set button per exercise
  el.querySelectorAll('[data-add-set]').forEach((b) =>
    b.addEventListener('click', () => {
      const exId = b.dataset.addSet;
      const st = initState(exId);
      const last = st.sets[st.sets.length - 1];
      // Copy the last row's values, preserving an intentional 0 (bodyweight).
      const keep = (v) => (v !== '' && v != null ? v : '');
      st.sets.push({ reps: keep(last?.reps), weight: keep(last?.weight) });
      st.dirty = true;
      renderSessionDay(el);
    })
  );

  // Save button per exercise — creates or updates the session for the chosen date
  el.querySelectorAll('[data-save-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      const exId = b.dataset.saveEx;
      const st = initState(exId);
      const cleaned = st.sets
        .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
        .filter((s) => s.reps > 0 || s.weight > 0);
      if (cleaned.length === 0) { showToast(t('add_at_least_one')); return; }

      // Prefer the in-memory savedSessionId, else look up in DB by date
      let existingId = st.savedSessionId;
      if (!existingId) {
        const existing = todaySessionFor(exId);
        if (existing) existingId = existing.id;
      }
      // Snapshot BEFORE write (full snapshot including the session being edited)
      const prior = DB.sessions.prSnapshot(exId);
      // Try to update the existing session; if it no longer exists (deleted
      // elsewhere), update() returns null and we create a fresh one instead of
      // silently losing the edit.
      let wasUpdate = false;
      if (existingId && DB.sessions.update(existingId, { date: viewContext.sdDate, sets: cleaned })) {
        wasUpdate = true;
      } else {
        // Tagged 'minimum' when this session came out of the rest-day sheet, so
        // a reduced day is still a REAL logged session — it counts in the stats
        // and it keeps the streak — while staying distinguishable from a full one.
        const created = DB.sessions.add({
          exerciseId: exId, date: viewContext.sdDate, sets: cleaned,
          kind: viewContext.sdMinimum ? 'minimum' : undefined,
        });
        st.savedSessionId = created.id;
      }
      const prMsg = checkPR(exId, prior, cleaned);
      if (prMsg) {
        showToast(prMsg);
      } else {
        showToast(wasUpdate ? t('session_updated') : t('session_saved'));
      }
      st.dirty = false;
      renderSessionDay(el);
      // §7: the permission sheet waits for the FIRST logged workout, so EVERY
      // save path calls this — there are THREE (here, guided mode's summary and
      // the exercise-detail modal), and wiring only this one meant a user who
      // logs through guided mode was never asked, ever. It self-gates on
      // `asked`, so calling it from all three is correct, not merely harmless.
      maybeAskNotifPermission();
    })
  );
}

// ==========================================================================
// GUIDED WORKOUT (session-run) — one exercise at a time, with rest timer
// ==========================================================================

// Default rest between sets, in seconds.
const REST_DEFAULT_SEC = 90;

// A single floating rest-timer bar lives on `.app` (not on the animated `.view`,
// so a view transform can't break its fixed positioning) and survives view
// re-renders. navigate() calls clearRestTimer() to tear it down.
let __restTimer = null;
let __restAudioCtx = null;   // created/unlocked on the "done" tap (a user gesture)
function clearRestTimer() {
  if (__restTimer) {
    clearInterval(__restTimer.id);
    // Drop the wake listener too — otherwise every rest period leaves one behind.
    if (__restTimer.onWake) document.removeEventListener('visibilitychange', __restTimer.onWake);
    __restTimer = null;
  }
  document.querySelector('.rest-timer')?.remove();
  document.body.classList.remove('rest-active');
}
// A short two-tone beep (a simple alarm — not music) when the rest ends. Uses
// the AudioContext unlocked during the "done" tap, so mobile autoplay policy
// doesn't mute it.
function playRestBeep() {
  try {
    const ctx = __restAudioCtx;
    if (!ctx) return;
    const tone = (at, freq) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.25);
    };
    tone(0, 880); tone(0.28, 880);
  } catch (_) {}
}
function startRestTimer(seconds) {
  clearRestTimer();
  const app = document.querySelector('.app');
  if (!app) return;
  // Unlock audio while we're inside the user's tap gesture so the end-beep can play.
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { if (!__restAudioCtx) __restAudioCtx = new AC(); if (__restAudioCtx.state === 'suspended') __restAudioCtx.resume(); }
  } catch (_) {}
  // WALL-CLOCK anchored. This used to decrement a counter once per setInterval
  // tick, but a phone that locks or backgrounds the tab throttles/suspends timers
  // — so the rest countdown effectively PAUSED in your pocket and you came back
  // to "1:12 remaining" after resting three minutes. Deriving `remaining` from a
  // real end timestamp makes the display correct the instant the screen wakes,
  // and lets us fire the end-of-rest alert immediately on resume.
  let endAt = Date.now() + Math.max(1, Math.round(seconds)) * 1000;
  const left = () => Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let remaining = left();
  const bar = document.createElement('div');
  bar.className = 'rest-timer';
  bar.setAttribute('role', 'timer');
  bar.innerHTML = `
    <button type="button" class="rest-timer-adj" data-rest-minus aria-label="−15s">−15</button>
    <div class="rest-timer-mid">
      <div class="rest-timer-label">${icon('clock', 16)} ${t('resting')}</div>
      <div class="rest-timer-count num">${fmt(remaining)}</div>
    </div>
    <button type="button" class="rest-timer-adj" data-rest-plus aria-label="+15s">+15</button>
    <button type="button" class="rest-timer-skip" data-rest-skip>${t('skip')}</button>
  `;
  app.appendChild(bar);
  // Reserve extra scroll space at the bottom so the guided-mode Next/Prev nav
  // can clear above the floating timer instead of hiding under it.
  document.body.classList.add('rest-active');
  const countEl = bar.querySelector('.rest-timer-count');
  const finish = () => {
    clearRestTimer();
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (_) {}
    playRestBeep();
  };
  const tick = () => {
    remaining = left();
    if (remaining <= 0) { finish(); return; }
    countEl.textContent = fmt(remaining);
  };
  const id = setInterval(tick, 250);   // re-derive often so a wake looks instant
  // Recompute the moment the screen comes back, so a rest that expired while the
  // phone was locked reports done immediately instead of on the next tick.
  const onWake = () => { if (document.visibilityState === 'visible') tick(); };
  document.addEventListener('visibilitychange', onWake);
  __restTimer = { id, onWake };
  bar.querySelector('[data-rest-minus]').addEventListener('click', () => {
    endAt = Math.max(Date.now() + 1000, endAt - 15000); tick();
  });
  bar.querySelector('[data-rest-plus]').addEventListener('click', () => {
    endAt += 15000; tick();
  });
  bar.querySelector('[data-rest-skip]').addEventListener('click', () => clearRestTimer());
}

function renderSessionRun(el) {
  // Resolve the workout by DATE (continuous rotation), like session-day.
  if (!viewContext.runDate) viewContext.runDate = viewContext.date || todayISO();
  const runDateObj = new Date(viewContext.runDate + 'T12:00:00');
  const dow = runDateObj.getDay();   // header label = the date's weekday
  const day = DB.plan.workoutForDate(runDateObj);
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  // Same shape as renderSessionDay's sdOnly: selected plan ids keep plan order,
  // while view-level additions outside the plan append. Both screens must
  // resolve to the same set, or the run walks a different workout than the one
  // its button was sitting on.
  const runOnly = Array.isArray(viewContext.runOnly) ? viewContext.runOnly : null;
  const runPlanIds = (day?.exerciseIds || []);
  const runIds = runOnly
    ? runPlanIds.filter((id) => runOnly.includes(id)).concat(runOnly.filter((id) => !runPlanIds.includes(id)))
    : runPlanIds;
  const exObjs = runIds.map((id) => exerciseById[id]).filter(Boolean);
  const totalEx = exObjs.length;

  // Persist run state across re-renders (until navigation replaces viewContext).
  if (!viewContext.runUnit) viewContext.runUnit = viewContext.unit || (DB.prefs.get().unit) || 'kg';
  if (viewContext.runIdx == null) viewContext.runIdx = 0;
  if (!viewContext.runState) viewContext.runState = {};
  if (!viewContext.runView) viewContext.runView = 'run';

  function convDisplay(kg) {
    if (viewContext.runUnit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2;
    return Math.round(kg * 100) / 100;
  }
  function convToKg(value) {
    if (viewContext.runUnit === 'lb') return Math.round((Number(value) / KG_TO_LB) * 100) / 100;
    return Number(value);
  }

  // Lazily init per-exercise sets. A FRESH log starts with EMPTY inputs and last
  // session's numbers as a ghost placeholder (`ph*`) — so there's nothing to
  // delete, tapping ✓ fills them in ("same as last time"), and an exercise you
  // don't touch logs nothing. Re-opening today's already-logged session shows
  // its real values for editing.
  function runInit(exId) {
    if (viewContext.runState[exId]) return viewContext.runState[exId];
    const today = DB.sessions.listByExercise(exId).find((s) => s.date === viewContext.runDate);
    const last = DB.sessions.lastForExercise(exId);
    let sets, savedId = null;
    if (today) {
      sets = today.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: false, phReps: s.reps, phWeight: s.weight }));
      savedId = today.id;
    } else if (last) {
      sets = last.sets.map((s) => ({ reps: '', weight: '', done: false, phReps: s.reps, phWeight: s.weight }));
    } else {
      sets = [{ reps: '', weight: '', done: false, phReps: '', phWeight: '' }];
    }
    viewContext.runState[exId] = { sets, savedSessionId: savedId };
    return viewContext.runState[exId];
  }

  // Persist one exercise's sets to the DB (add or update by date). Idempotent —
  // called when leaving an exercise and again on the final save, so a workout is
  // never lost if the app is closed mid-session.
  function commitExercise(exId, opts = {}) {
    const st = viewContext.runState[exId];
    if (!st) return false;
    const cleaned = st.sets
      .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
      .filter((s) => s.reps > 0 || s.weight > 0);
    let existingId = st.savedSessionId;
    if (!existingId) {
      const existing = DB.sessions.listByExercise(exId).find((s) => s.date === viewContext.runDate);
      if (existing) existingId = existing.id;
    }
    if (cleaned.length === 0) {
      if (opts.removeEmpty && existingId) {
        DB.sessions.remove(existingId);
        st.savedSessionId = null;
        delete st.prMsg;
        return true;
      }
      if (opts.warnEmpty) showToast(t('add_at_least_one'));
      return false;
    }
    // Snapshot the personal best BEFORE writing — the other two logging paths
    // (openSessionModal, renderSessionDay) both do this, but guided mode never
    // did, so a PR set here was stored yet never celebrated. Must be taken before
    // the write, or the new set is already inside the "previous" best.
    const prior = DB.sessions.prSnapshot(exId);
    if (existingId && DB.sessions.update(existingId, { date: viewContext.runDate, sets: cleaned })) {
      st.savedSessionId = existingId;
    } else {
      // Tagged 'minimum' when the run inherited a reduced day from the rest-day
      // sheet, matching renderSessionDay's save path — otherwise the same
      // reduced workout counts as a full one purely because it was logged
      // through guided mode instead of the cards.
      const created = DB.sessions.add({
        exerciseId: exId, date: viewContext.runDate, sets: cleaned,
        kind: viewContext.runMinimum ? 'minimum' : undefined,
      });
      st.savedSessionId = created.id;
    }
    // Stash rather than toast: a mid-workout toast would fight the rest-timer bar
    // (and [data-next] dismisses toasts on the way out). The summary screen shows
    // it once the workout is done.
    try {
      const msg = checkPR(exId, prior, cleaned);
      if (msg) st.prMsg = msg;
    } catch (_) {}
    return true;
  }

  // The two numbers the owner asked for, above the set-by-set recall: the
  // heaviest weight this exercise has EVER been trained at, and the heaviest
  // from the most recent session. Both are read from the same helpers the
  // exercise-detail screen uses, so the guided screen can never quote a number
  // that page contradicts.
  //
  // Rendered ONLY when there is history: on a first-ever exercise two cells
  // reading "—" are noise.
  //
  // These two cells REPLACED the old "Last time: 10×70 · 9×72.5" strip (the
  // owner: "this bar is not important now that we added the others"). Its
  // builder and its .run-last CSS were both removed with it (v275/v277).
  // The heaviest set of a list, with the reps that were done AT that weight —
  // NOT bestStats().maxReps, which is the most reps in any set and can belong to
  // a completely different, lighter one ("80 kg × 15" when the 15 was a 40 kg
  // set). Ties on weight go to the higher rep count, because 80×8 beats 80×6.
  function topSet(sets) {
    return (sets || []).reduce((b, x) => {
      const w = Number(x.weight) || 0, r = Number(x.reps) || 0;
      if (w <= 0 && r <= 0) return b;
      return (!b || w > b.w || (w === b.w && r > b.r)) ? { w, r } : b;
    }, null);
  }

  // ---- Next-weight suggestion — rebuilt on the literature (v281) ----------
  // The owner asked for the studies, then the rules. What they say:
  //
  //  WHEN — the 2-for-2 rule (NSCA; ACSM position stand 2009, PMID 19204579):
  //  raise the load only after beating the rep target on TWO CONSECUTIVE
  //  sessions. So the answer to 'how many sessions at one weight' is: at
  //  least two at the top of the range, usually more while reps climb.
  //
  //  HOW MUCH — ACSM: 2–10%, small/upper muscle groups at the low end,
  //  large/lower at the high end; NSCA's absolute form: upper ≈ +1–2.5 kg,
  //  lower ≈ +2.5–5 kg. Here: legs +5 kg once the lift is ≥50 kg (5–10%
  //  territory), otherwise +2.5 kg — the smallest real plate pair.
  //
  //  ZONE — 8–12 stays the working range. Schoenfeld's meta-analyses (2017
  //  PMID 28834797; 2021 PMID 33671664) show hypertrophy across a broad
  //  loading spectrum, so the zone is a practical anchor, not dogma.
  //
  //  STALL — plateau guidance: ~3 sessions stuck under the range at one
  //  weight → deload 5–10% and rebuild. Grinding forward instead is how
  //  people end up stuck at the same triple for months.
  //
  // All judged on the TOP set of each session (same topSet as the cells
  // above), so a drop set cannot fool any branch.
  function runSuggest(exId) {
    const hist = DB.sessions.listByExercise(exId);   // sorted date desc
    if (!hist.length) return null;
    const s1 = topSet(hist[0].sets);
    if (!s1 || !(s1.w > 0) || !(s1.r > 0)) return null;
    const LO = 8, HI = 12;
    const ex = DB.exercises.getById(exId);
    const inc = (ex && ex.category === 'legs' && s1.w >= 50) ? 5 : 2.5;
    const to25 = (x) => Math.round(x / 2.5) * 2.5;

    if (s1.r >= HI) {
      // 2-for-2: the increase needs the SECOND consecutive session at this
      // weight to also top the range. One great day is not a new baseline.
      const s2 = hist[1] ? topSet(hist[1].sets) : null;
      const confirmed = !!(s2 && s2.w === s1.w && s2.r >= HI);
      if (confirmed) return { w: to25(s1.w + inc), r: LO, key: 'sug_up_reason', vars: { t: LO } };
      return { w: s1.w, r: HI, key: 'sug_confirm_reason', vars: {} };
    }
    if (s1.r >= LO) return { w: s1.w, r: s1.r + 1, key: 'sug_rep_reason', vars: { t: s1.r + 1 } };

    // Under the range. Count how many CONSECUTIVE recent sessions sat under
    // it at this same weight; three is the stall signal the deload evidence
    // keys on.
    let stuck = 0;
    for (const s of hist) {
      const tp = topSet(s.sets);
      if (!tp || tp.w !== s1.w || tp.r >= LO) break;
      stuck++;
    }
    if (stuck >= 3) {
      let dw = Math.max(2.5, to25(s1.w * 0.9));
      if (dw >= s1.w) dw = Math.max(2.5, s1.w - 2.5);   // rounding must not undo the deload
      return { w: dw, r: LO, key: 'sug_deload_reason', vars: { n: stuck } };
    }
    return { w: s1.w, r: LO, key: 'sug_hold_reason', vars: { t: LO } };
  }

  function runSuggestHtml(exId) {
    const g = runSuggest(exId);
    if (!g) return '';
    const u = viewContext.runUnit.toUpperCase();
    const reason = Object.entries(g.vars).reduce((txt, [k, v]) => txt.replace('{' + k + '}', fmtNum(v)), t(g.key));
    return `
      <button type="button" class="run-suggest" data-sug-w="${g.w}" data-sug-r="${g.r}">
        <span class="run-suggest-label">${t('sug_label')}</span>
        <span class="run-suggest-figure num" dir="ltr">${fmtNum(convDisplay(g.w))}<b>${u}</b> × ${fmtNum(g.r)}</span>
        <span class="run-suggest-why">${reason}</span>
      </button>`;
  }

  function runStatsHtml(exId) {
    const all = DB.sessions.listByExercise(exId);
    // Best EVER: the heaviest single set across every session on record.
    const best = all.reduce((b, s) => {
      const t2 = topSet(s.sets);
      if (!t2) return b;
      return (!b || t2.w > b.w || (t2.w === b.w && t2.r > b.r)) ? t2 : b;
    }, null);
    // Last: the heaviest set of the most recent session — not its LAST set. A
    // drop set ends light, and "last weight 40" after a 90 top set reads as a
    // regression that never happened.
    const lastSession = DB.sessions.lastForExercise(exId);
    const last = lastSession ? topSet(lastSession.sets) : null;
    const u = viewContext.runUnit.toUpperCase();
    // ONE figure, not a stack: weight and reps belong side by side because they
    // describe a single set. This is the SAME shape the Home screen's "last set"
    // card already uses (.last-set-figure at app.js:3716) — "80 KG × 6 reps" —
    // so the two screens speak with one vocabulary instead of two.
    //
    // dir="ltr" on the figure: it is a numeric expression, and in an RTL page a
    // bare "80 KG × 6" lets the bidi algorithm reorder the run around the
    // neutral ×. Pinning the direction keeps the weight first in both languages,
    // which is what the label above it promises.
    const cell = (label, ts, cls) => {
      const has = !!(ts && ts.w > 0);
      return `
      <div class="run-stat ${cls}">
        <div class="run-stat-label">${label}</div>
        <div class="run-stat-figure" dir="ltr">${has ? `
          <span class="num">${fmtNum(convDisplay(ts.w))}</span><span class="run-stat-unit">${u}</span>
          ${ts.r > 0 ? `<span class="run-stat-x" aria-hidden="true">×</span><span class="num">${fmtNum(ts.r)}</span><span class="run-stat-unit">${t('reps')}</span>` : ''}
        ` : '<span class="run-stat-empty">—</span>'}</div>
      </div>`;
    };
    // The progress chart the owner asked to reach "from an easy place" has
    // existed on exercise-detail all along (chartHtmlForExercise). The easy
    // place is THIS strip: the two numbers people already look at are now the
    // door to the full history — instead of a second chart crowding the one
    // screen that must stay still.
    return `<button type="button" class="run-stats" data-open-detail="${exId}" aria-label="${escapeHtml(t('stats_open_chart'))}">
      ${cell(t('run_best_weight'), best, 'is-best')}
      ${cell(t('run_last_weight'), last, '')}
    </button>`;
  }


  // Guard: plan emptied while away.
  if (totalEx === 0) {
    el.innerHTML = `
      <div class="detail-top">
        <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
        <div class="detail-top-title">${escapeHtml(dayName(dow, true))}</div>
      </div>
      ${emptyState({ iconName: 'dumbbell', title: t('rest_day'), text: t('no_plan_today_sub') })}
    `;
    return;
  }

  // ----- SUMMARY SCREEN -----
  if (viewContext.runView === 'summary') {
    let totalSets = 0, totalVolume = 0;
    const rowsHtml = exObjs.map((ex) => {
      const st = runInit(ex.id);
      const done = st.sets
        .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
        .filter((s) => s.reps > 0 || s.weight > 0);
      if (done.length === 0) return '';
      done.forEach((s) => { totalSets += 1; totalVolume += s.reps * s.weight; });
      const setsStr = done
        .map((s) => `${fmtNum(s.reps)}×${fmtNum(convDisplay(s.weight))}`)
        .join('  ·  ');
      // Any personal best set during this run (stashed by commitExercise).
      const pr = st.prMsg ? `<div class="run-sum-pr">${escapeHtml(st.prMsg)}</div>` : '';
      return `
        <div class="run-sum-ex">
          <div class="run-sum-name">${escapeHtml(exDisplayName(ex))}</div>
          <div class="run-sum-sets num">${setsStr} <span class="run-sum-unit">${viewContext.runUnit.toUpperCase()}</span></div>
          ${pr}
        </div>`;
    }).join('');

    const nothing = totalSets === 0;
    el.innerHTML = `
      <div class="detail-top">
        <button class="back-btn" data-run-back aria-label="${escapeHtml(t('back_to_workout'))}">${icon('back', 20)}</button>
        <div class="detail-top-title">${escapeHtml(t('workout_summary'))}</div>
      </div>
      <div class="page-header">
        <h1 class="page-title">${escapeHtml(t('workout_summary'))}</h1>
        <p class="page-subtitle">${escapeHtml(dayName(dow, true))} · ${escapeHtml(day?.name || '')}</p>
      </div>
      ${nothing
        ? emptyState({ iconName: 'dumbbell', title: t('no_sessions'), text: t('no_sets_to_save') })
        : `<div class="run-summary">
             ${rowsHtml}
             <div class="run-sum-totals">
               <div class="run-sum-total"><span class="run-sum-total-n num">${fmtNum(totalSets)}</span><span class="run-sum-total-l">${t('total_sets')}</span></div>
               <div class="run-sum-total"><span class="run-sum-total-n num">${fmtNum(Math.round(totalVolume))}</span><span class="run-sum-total-l">${t('total_volume')} (${viewContext.runUnit.toUpperCase()})</span></div>
             </div>
           </div>`
      }
      <button type="button" class="btn btn-primary btn-block" data-run-save style="margin-top:16px">${nothing ? `<span class="icon-mirror">${icon('back', 20)}</span> ${t('exit_no_save')}` : `${icon('check', 20)} ${t('save_session')}`}</button>
    `;

    $('[data-run-back]', el)?.addEventListener('click', () => {
      viewContext.runView = 'run';
      renderSessionRun(el);
    });
    $('[data-run-save]', el)?.addEventListener('click', () => {
      let saved = 0;
      exObjs.forEach((ex) => { if (commitExercise(ex.id)) saved += 1; });
      // Nothing logged → there's nothing to save; don't trap the user with a
      // nag. Just leave the empty session and return Home (a direct navigate,
      // not goBack — goBack early-returns on any open modal/gate and could
      // otherwise leave the user stuck on the summary).
      if (saved === 0) { navigate('home'); return; }
      // Force the underlying session-day screens to re-init from the DB so the
      // freshly-logged sessions show as "logged" when we return.
      navStack.forEach((entry) => {
        if (entry.view === 'session-day' && entry.context) entry.context.sdState = {};
      });
      showToast(t('session_saved'));
      maybeAskNotifPermission();
      if (!goBack()) navigate('session-day', { dow });
    });
    return;
  }

  // ----- RUN SCREEN (current exercise) -----
  const idx = Math.min(viewContext.runIdx, totalEx - 1);
  viewContext.runIdx = idx;
  const ex = exObjs[idx];
  const st = runInit(ex.id);
  const isLast = idx === totalEx - 1;

  const url = exerciseImgSrc(ex);
  const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
  let mediaHtml;
  if (machineSvg) {
    mediaHtml = `<div class="run-ex-media machine-bg${url ? ' sd-thumb-zoom' : ''}"${url ? ` data-thumb-src="${escapeHtml(url)}"` : ''}>${machineSvg}${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;
  } else if (url) {
    mediaHtml = `<div class="run-ex-media sd-thumb-zoom" data-thumb-src="${escapeHtml(url)}" style="background-image:url('${escapeHtml(url)}')"></div>`;
  } else {
    mediaHtml = `<div class="run-ex-media fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</div>`;
  }

  const setsRows = st.sets.map((s, i) => {
    const wDisplay = (s.weight === '' || s.weight == null) ? '' : convDisplay(Number(s.weight));
    const repsVal = (s.reps === '' || s.reps == null) ? '' : s.reps;
    // Ghost hint = last time's numbers (raw digits — a <input type=number>
    // placeholder must not carry localized digits). Fallback to 0.
    const phReps = (s.phReps === '' || s.phReps == null) ? '0' : String(s.phReps);
    const phW = (s.phWeight === '' || s.phWeight == null) ? '0' : String(convDisplay(Number(s.phWeight)));
    return `
      <div class="run-set-row${s.done ? ' done' : ''}" data-set="${i}">
        <button type="button" class="run-set-del${st.sets.length > 1 ? '' : ' is-hidden'}" data-del-set aria-label="${escapeHtml(t('delete'))}"${st.sets.length > 1 ? '' : ' tabindex="-1" aria-hidden="true"'}>${icon('trash', 16)}</button>
        <div class="run-set-n num">${i + 1}</div>
        <input type="number" inputmode="numeric" step="1" min="0" placeholder="${numAttr(phReps)}" value="${numAttr(repsVal)}" data-field="reps" aria-label="${escapeHtml(t('reps'))}">
        <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="${numAttr(phW)}" value="${numAttr(wDisplay)}" data-field="weight" aria-label="${escapeHtml(viewContext.runUnit)}">
        <button type="button" class="run-set-done${s.done ? ' done' : ''}" data-done aria-label="${escapeHtml(t('mark_set_done'))}" aria-pressed="${!!s.done}">${icon('check', 20)}</button>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(day?.name || dayName(dow, true))}</div>
    </div>

    <div class="run-progress">
      <div class="run-progress-track"><span style="width:${Math.round(((idx + 1) / totalEx) * 100)}%"></span></div>
      <div class="run-progress-label">${t('exercise_word')} <span class="num">${fmtNum(idx + 1)}</span> ${t('of_word')} <span class="num">${fmtNum(totalEx)}</span></div>
    </div>

    <div class="run-ex">
      ${mediaHtml}
      <h1 class="run-ex-name">${escapeHtml(exDisplayName(ex))}</h1>
      ${runStatsHtml(ex.id)}
      ${runSuggestHtml(ex.id)}
    </div>

    <div class="run-sets-head">
      <div></div>
      <div>${t('set_n')}</div>
      <div>${t('reps')}</div>
      <div>${viewContext.runUnit.toUpperCase()}</div>
      <div class="run-head-done">${t('done_col')}</div>
    </div>
    <div class="run-sets">${setsRows}</div>
    <button type="button" class="btn btn-ghost run-addset" data-addset>${icon('plus', 20)} ${t('add_set')}</button>

    <!-- NO manual "rest 90s" button here, by the owner's call and on the
         evidence. APPLY-vault.md §4 asks for one, and v250 added it on the
         reasoning that startRestTimer() was "unreachable from the one screen you
         actually rest on". That reasoning was simply wrong: ticking a set done
         ALREADY starts the timer (see the [data-done] handler below), which is
         the moment a rest actually begins. The button asked the user to state
         something the app had already inferred from the action they just took.
         "Finish" remains the filled button: run-next reads Finish and stays
         .btn-primary on the last exercise. -->
    <div class="run-nav">
      <button type="button" class="btn btn-ghost run-prev" data-prev ${idx === 0 ? 'disabled' : ''}><span class="icon-mirror">${icon('back', 20)}</span> ${t('previous')}</button>
      <button type="button" class="btn btn-primary run-next" data-next>${isLast ? `${t('finish')} ${icon('check', 20)}` : `${t('next')} <span class="icon-mirror">${icon('chevronRight', 20)}</span>`}</button>
    </div>
  `;

  // A logged one-set session must still expose its set delete: that explicit
  // trash tap is the user's way to remove the session, with Undo below.
  if (st.sets.length === 1 && st.savedSessionId) {
    const deleteLast = $('[data-del-set]', el);
    deleteLast?.classList.remove('is-hidden');
    deleteLast?.removeAttribute('tabindex');
    deleteLast?.removeAttribute('aria-hidden');
  }

  // Photo zoom
  el.querySelectorAll('.sd-thumb-zoom').forEach((thumb) => {
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    if (!thumb.getAttribute('aria-label')) thumb.setAttribute('aria-label', t('view_photo'));
    const open = (e) => { e.stopPropagation(); openImageLightbox(thumb.dataset.thumbSrc, ex.name); };
    thumb.addEventListener('click', open);
    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
  });

  // Tapping the suggestion writes it into the first open set — as a TARGET the
  // user edits after actually lifting, exactly like the ghost placeholders.
  // Weight goes through the same kg conversion the manual input path uses.
  const statsBtn = $('.run-stats[data-open-detail]', el);
  if (statsBtn) statsBtn.addEventListener('click', () =>
    navigate('exercise-detail', { exerciseId: statsBtn.dataset.openDetail }));

  const sugBtn = $('.run-suggest', el);
  if (sugBtn) sugBtn.addEventListener('click', () => {
    const w = parseFloat(sugBtn.dataset.sugW);
    const r = parseInt(sugBtn.dataset.sugR, 10);
    if (!isFinite(w) || !isFinite(r)) return;
    let at = st.sets.findIndex((x) => !x.done && (x.reps === '' || x.reps == null) && (x.weight === '' || x.weight == null));
    if (at === -1) at = st.sets.findIndex((x) => !x.done);
    if (at === -1) return;                       // everything already done
    st.sets[at].weight = w;                      // state holds kg
    st.sets[at].reps = r;
    const row = el.querySelector('.run-set-row[data-set="' + at + '"]');
    if (row) {
      const wi = row.querySelector('[data-field="weight"]'); if (wi) wi.value = String(convDisplay(w));
      const ri = row.querySelector('[data-field="reps"]');   if (ri) ri.value = String(r);
    }
    commitExercise(ex.id);
    showToast(t('sug_applied'));
  });

  // Set inputs → write to state as the user types. Tapping an input selects its
  // content so a new number REPLACES the old one (no manual deleting).
  el.querySelectorAll('.run-set-row').forEach((row) => {
    const i = Number(row.dataset.set);
    row.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('focus', () => { try { inp.select(); } catch (_) {} });
      inp.addEventListener('input', () => {
        const v = inp.value;
        if (inp.dataset.field === 'weight') {
          st.sets[i].weight = v === '' ? '' : convToKg(v);
        } else {
          st.sets[i].reps = v === '' ? '' : Number(v);
        }
      });
      // WRITE IT THE MOMENT THE FIELD IS LEFT. `input` above only updates the
      // in-memory runState; until this was added, a number typed here reached
      // the database only when the user moved to another exercise or finished
      // the workout — so closing the app, or backing out mid-set, silently threw
      // the number away.
      //
      // On `change`, not on `input`: every keystroke would mean a localStorage
      // write plus a cloud dirty-flag on a blob that is synced whole, and "48"
      // would be persisted as 4 then 48. `change` on a number input fires when
      // the value is committed and focus leaves, which is exactly "typed it and
      // moved to something else". `blur` covers the case where the value did not
      // change but the row was completed by other means.
      inp.addEventListener('change', () => commitExercise(ex.id, { warnEmpty: true }));
      inp.addEventListener('blur', () => commitExercise(ex.id));
    });
    // ✓ Done → mark the set complete + start the rest timer. If the row is still
    // empty, fill it from the "last time" ghost — one tap = "same as last time".
    row.querySelector('[data-done]')?.addEventListener('click', () => {
      const set = st.sets[i];
      set.done = !set.done;
      if (set.done) {
        if ((set.reps === '' || set.reps == null) && set.phReps !== '' && set.phReps != null) {
          set.reps = Number(set.phReps);
          const r = row.querySelector('[data-field="reps"]'); if (r) r.value = String(set.reps);
        }
        if ((set.weight === '' || set.weight == null) && set.phWeight !== '' && set.phWeight != null) {
          set.weight = set.phWeight;
          const w = row.querySelector('[data-field="weight"]'); if (w) w.value = String(convDisplay(Number(set.weight)));
        }
        startRestTimer(REST_DEFAULT_SEC);
      } else {
        clearRestTimer();
      }
      row.classList.toggle('done', set.done);
      row.querySelector('[data-done]').classList.toggle('done', set.done);
      row.querySelector('[data-done]').setAttribute('aria-pressed', String(set.done));
      // Ticking a set is the strongest "I finished this" signal in the screen,
      // and it can fill the row from the ghost values without any field being
      // touched — so it must persist on its own, not wait for a blur.
      commitExercise(ex.id, { warnEmpty: true });
    });
    // Delete this set and persist immediately. A logged one-set exercise can be
    // removed this way too; Undo puts it back at its original position.
    row.querySelector('[data-del-set]')?.addEventListener('click', () => {
      if (st.sets.length <= 1 && !st.savedSessionId) return;
      const removed = st.sets[i];
      const removedAt = i;
      st.sets.splice(i, 1);
      commitExercise(ex.id, { removeEmpty: true });
      renderSessionRun(el);
      showToast(t('set_deleted'), {
        actionLabel: t('undo'),
        onAction: () => {
          const at = Math.min(removedAt, st.sets.length);
          st.sets.splice(at, 0, removed);
          commitExercise(ex.id);
          renderSessionRun(el);
        },
      });
    });
  });

  $('[data-addset]', el)?.addEventListener('click', () => {
    const prev = st.sets[st.sets.length - 1];
    const hint = (v, ph) => (v !== '' && v != null ? v : (ph != null ? ph : ''));
    // New set starts EMPTY, hinting the previous set (its typed value, else its
    // own ghost) so ✓ still means "same again" without anything to delete.
    st.sets.push({
      reps: '', weight: '', done: false,
      phReps: prev ? hint(prev.reps, prev.phReps) : '',
      phWeight: prev ? hint(prev.weight, prev.phWeight) : '',
    });
    renderSessionRun(el);
  });

  $('[data-prev]', el)?.addEventListener('click', () => {
    if (idx === 0) return;
    // Leaving this exercise ends its "Undo set" window — the toast restores into
    // THIS exercise's state, so it must not linger onto another exercise.
    hideToast();
    // Keep the rest timer running when moving between exercises (it lives on
    // .app and survives the re-render) — the user asked for it not to reset.
    commitExercise(ex.id);
    viewContext.runIdx = idx - 1;
    renderSessionRun(el);
  });

  $('[data-next]', el)?.addEventListener('click', () => {
    hideToast();   // end this exercise's Undo window before moving on
    // Keep the rest timer running when moving to the NEXT exercise (don't reset
    // on navigate); only tear it down when the workout is actually finished.
    commitExercise(ex.id);
    if (isLast) {
      clearRestTimer();
      viewContext.runView = 'summary';
    } else {
      viewContext.runIdx = idx + 1;
    }
    renderSessionRun(el);
  });
}

// ==========================================================================
// CALENDAR VIEW
// ==========================================================================
function renderCalendar(el) {
  const today = new Date();
  const ctx = viewContext.calendar || { year: today.getFullYear(), month: today.getMonth() };
  viewContext.calendar = ctx;

  const monthDate = new Date(ctx.year, ctx.month, 1);
  const firstDow = monthDate.getDay();
  const monthLabel = monthDate.toLocaleDateString(
    (DB.prefs.get().lang || 'en') === 'ar' ? 'ar-u-nu-latn' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  // The sets-per-day map that used to be built HERE was dead: buildGrid()
  // computes its own `byDate`, and nothing ever read this one. It cost a full
  // listAll() copy+sort plus one Date allocation per session on every open —
  // for a value that was thrown away. `firstDow`/`daysInMonth` went with it for
  // the same reason: buildGrid recomputes both.

  function lvlFor(count) {
    if (count <= 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  }

  const dowLabels = ['dow_sun', 'dow_mon', 'dow_tue', 'dow_wed', 'dow_thu', 'dow_fri', 'dow_sat']
    .map((k) => `<div class="calendar-dow">${escapeHtml(t(k))}</div>`).join('');

  // Build just the month grid + label — called on prev/next so month nav
  // repaints only the grid, not the whole view (header, legend stay put).
  function buildGrid() {
    const first = new Date(ctx.year, ctx.month, 1);
    const firstDowN = first.getDay();
    const daysN = new Date(ctx.year, ctx.month + 1, 0).getDate();
    // One un-sorted pass, matched on the ISO string's own prefix. listAll()
    // copies and sorts, and neither matters here — a date-keyed bucket does not
    // care about order — and a Date per session just to read back the month it
    // was already spelling out is work the string does for free.
    const monthPrefix = `${ctx.year}-${String(ctx.month + 1).padStart(2, '0')}-`;
    const byDate = {};
    (DB.getAll().sessions || []).forEach((s) => {
      if (!s || !s.date || s.date.lastIndexOf(monthPrefix, 0) !== 0) return;
      byDate[s.date] = (byDate[s.date] || 0) + ((s.sets && s.sets.length) || 0);
    });
    const empties = Array.from({ length: firstDowN }, () => `<div class="calendar-cell empty"></div>`).join('');
    const cells = Array.from({ length: daysN }, (_, i) => {
      const day = i + 1;
      const iso = `${ctx.year}-${String(ctx.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const lvl = lvlFor(byDate[iso] || 0);
      const isToday = today.getFullYear() === ctx.year && today.getMonth() === ctx.month && today.getDate() === day;
      // A pulled-forward or declined day is the only thing on this grid that is
      // about the PLAN rather than about what was logged, so it gets a corner
      // tick rather than another ring — `today` already owns the inset ring, and
      // a day can be both.
      const moved = DB.plan.isExtra(iso);
      const skipped = !moved && DB.plan.isRest(iso);
      const mark = moved ? ' is-moved' : skipped ? ' is-skipped' : '';
      const label = formatDate(iso) + (moved ? ' · ' + t('day_moved_in') : skipped ? ' · ' + t('day_rest_taken') : '');
      return `<button class="calendar-cell lvl-${lvl}${isToday ? ' today' : ''}${mark}"
              data-day-iso="${iso}" aria-label="${escapeHtml(label)}">${fmtNum(day)}</button>`;
    }).join('');
    return empties + cells;
  }

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('calendar_title')}</div>
    </div>

    <div class="page-header">
      <h1 class="page-title">${t('calendar_title')}</h1>
      <p class="page-subtitle">${t('calendar_subtitle')}</p>
    </div>

    <div class="calendar-head">
      <button class="calendar-nav-btn" id="cal-prev" aria-label="${escapeHtml(t('prev_month'))}">${icon('back', 20)}</button>
      <div class="calendar-month-label" id="cal-month-label">${escapeHtml(monthLabel)}</div>
      <button class="calendar-nav-btn" id="cal-next" aria-label="${escapeHtml(t('next_month'))}">${icon('chevronRight', 20)}</button>
    </div>

    <div class="calendar-dow-row">${dowLabels}</div>
    <div class="calendar-grid" id="calendar-grid">${buildGrid()}</div>

    <div class="calendar-legend">
      <span>—</span>
      <span class="calendar-legend-dot" style="background:var(--surface-2)"></span>
      <span class="calendar-legend-dot" style="background:rgba(var(--accent-rgb),0.18)"></span>
      <span class="calendar-legend-dot" style="background:rgba(var(--accent-rgb),0.32)"></span>
      <span class="calendar-legend-dot" style="background:rgba(var(--accent-rgb),0.55)"></span>
      <span class="calendar-legend-dot" style="background:var(--accent)"></span>
      <span>+</span>
    </div>

    <!-- A mark nobody can decode is decoration. Only rendered when the month
         actually contains one, so a user who has never moved a day never sees a
         legend for a thing they have never done. -->
    <div class="cal-plan-legend" id="cal-plan-legend"></div>
  `;

  function repaintMonth() {
    const label = $('#cal-month-label', el);
    const grid = $('#calendar-grid', el);
    if (label) label.textContent = new Date(ctx.year, ctx.month, 1)
      .toLocaleDateString((DB.prefs.get().lang || 'en') === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' });
    if (grid) grid.innerHTML = buildGrid();
    paintPlanLegend();
  }

  // Derived from the grid that was just built, so the legend can never claim a
  // mark the month does not contain.
  function paintPlanLegend() {
    const box = $('#cal-plan-legend', el);
    const grid = $('#calendar-grid', el);
    if (!box || !grid) return;
    const rows = [];
    if (grid.querySelector('.is-moved')) {
      rows.push(`<span class="cal-plan-key"><i class="cal-plan-tick moved"></i>${escapeHtml(t('day_moved_in'))}</span>`);
    }
    if (grid.querySelector('.is-skipped')) {
      rows.push(`<span class="cal-plan-key"><i class="cal-plan-tick skipped"></i>${escapeHtml(t('day_rest_taken'))}</span>`);
    }
    box.innerHTML = rows.join('');
  }
  paintPlanLegend();

  $('#cal-prev', el).addEventListener('click', () => {
    if (ctx.month === 0) { ctx.month = 11; ctx.year -= 1; } else ctx.month -= 1;
    repaintMonth();
  });
  $('#cal-next', el).addEventListener('click', () => {
    if (ctx.month === 11) { ctx.month = 0; ctx.year += 1; } else ctx.month += 1;
    repaintMonth();
  });

  // Delegated — cells are rebuilt on month nav, one listener survives.
  // Tapping a day opens that day's session (view / edit / log) instead of a
  // read-only popup — the calendar is no longer a dead end.
  $('#calendar-grid', el).addEventListener('click', (e) => {
    const cell = e.target.closest('[data-day-iso]');
    if (cell) navigate('session-day', { date: cell.dataset.dayIso });
  });
}


// ==========================================================================
// SUPPLEMENTS VIEW
// ==========================================================================
const SUPP_COLORS = ['#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#a855f7', '#fb923c', '#60a5fa', '#f87171'];

// Common supplements, so the usual ones are one tap instead of typed by hand.
// Names carry their own `ar` rather than going through t(): this is DATA (like
// the seeded exercises), not interface chrome, and 20 entries would otherwise add
// 40 translation keys that no other screen ever reads. Doses are the ordinary
// serving — always editable after the tap, and the manual fields stay open.
const SUPP_PRESETS = [
  { en: 'Whey Protein',  ar: 'بروتين واي',      dose: '30 g',    color: '#60a5fa' },
  { en: 'Creatine',      ar: 'كرياتين',          dose: '5 g',     color: '#22d3ee' },
  { en: 'Multivitamin',  ar: 'فيتامينات متعددة', dose: '1',       color: '#fbbf24' },
  { en: 'Vitamin D3',    ar: 'فيتامين د',        dose: '2000 IU', color: '#fbbf24' },
  { en: 'Omega-3',       ar: 'أوميغا ٣',         dose: '1000 mg', color: '#fb923c' },
  { en: 'Magnesium',     ar: 'مغنيسيوم',         dose: '400 mg',  color: '#a855f7' },
  { en: 'Zinc',          ar: 'زنك',              dose: '25 mg',   color: '#60a5fa' },
  { en: 'Vitamin C',     ar: 'فيتامين ج',        dose: '500 mg',  color: '#fb923c' },
  { en: 'Iron',          ar: 'حديد',             dose: '18 mg',   color: '#f87171' },
  { en: 'Caffeine',      ar: 'كافيين',           dose: '200 mg',  color: '#f87171' },
  { en: 'Pre-workout',   ar: 'ما قبل التمرين',   dose: '1 scoop', color: '#f472b6' },
  { en: 'Beta-Alanine',  ar: 'بيتا ألانين',      dose: '3 g',     color: '#f472b6' },
  { en: 'BCAA',          ar: 'أحماض أمينية BCAA', dose: '5 g',    color: '#34d399' },
  { en: 'EAA',           ar: 'أحماض أمينية EAA',  dose: '10 g',   color: '#34d399' },
  { en: 'Collagen',      ar: 'كولاجين',          dose: '10 g',    color: '#f472b6' },
  { en: 'L-Carnitine',   ar: 'إل-كارنيتين',      dose: '2 g',     color: '#22d3ee' },
  { en: 'Ashwagandha',   ar: 'أشواغاندا',        dose: '600 mg',  color: '#a855f7' },
  { en: 'Probiotic',     ar: 'بروبيوتيك',        dose: '1',       color: '#34d399' },
];

function suppPresetName(p) { return (DB.prefs.get().lang === 'ar') ? p.ar : p.en; }

function renderSupplements(el) {
  const list = DB.supplements.list();
  const todayIso = todayISO();

  // One supplement row — rebuilt in place on toggle (class + streak change),
  // so a tap never re-renders the whole list or resets the scroll position.
  function suppRowHtml(s) {
    const taken = DB.supplements.isTaken(s.id, todayIso);
    const streak = DB.supplements.streak(s.id);
    return `
      <div class="supp-row ${taken ? 'taken' : ''}" data-supp-row="${s.id}">
        <div class="supp-color" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(s.color) ? s.color : '#888888'}"></div>
        <div class="supp-main">
          <div class="supp-name">${escapeHtml(s.name)}</div>
          ${s.dose ? `<div class="supp-dose">${escapeHtml(s.dose)}</div>` : ''}
          ${streak > 0 ? `<div class="supp-streak">${icon('flame', 16)} ${fmtNum(streak)} ${t('days_ago').replace('ago', '').trim() || t('streak_days')} ${t('streak')}</div>` : ''}
        </div>
        <button class="supp-toggle ${taken ? 'taken' : ''}" data-toggle-supp="${s.id}" aria-label="${escapeHtml(taken ? t('taken') : t('not_taken'))}">
          ${icon(taken ? 'check' : 'plus', 18)}
        </button>
        <div class="data-actions">
          <button class="icon-btn" data-edit-supp="${s.id}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
        </div>
      </div>
    `;
  }

  const anyUntaken = list.some((s) => !DB.supplements.isTaken(s.id, todayIso));

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('supplements_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${escapeHtml(formatDate(todayIso))}</div>
      <h1 class="page-title">${t('supplements_title')}</h1>
      <p class="page-subtitle">${t('supplements_subtitle')}</p>
    </div>

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('todays_doses')}</div>
      <div style="display:flex;gap:8px">
        ${list.length > 0 ? `<button class="btn btn-ghost" id="take-all-btn" ${anyUntaken ? '' : 'disabled style="opacity:.5"'}>${icon('check', 20)} ${t('take_all')}</button>` : ''}
        <button class="btn btn-primary" id="add-supp-btn">${icon('plus', 20)} ${t('new_supplement')}</button>
      </div>
    </div>

    <div class="data-list" id="supp-list">
      ${list.length === 0
        ? emptyState({ iconName: 'pill', title: t('no_supplements'), text: t('no_supplements_text') })
        : list.map(suppRowHtml).join('')
      }
    </div>
  `;

  // Replace ONE supplement's row DOM in place from current DB state.
  function refreshSuppRow(id) {
    const row = el.querySelector(`[data-supp-row="${id}"]`);
    const s = DB.supplements.list().find((x) => x.id === id);
    if (!row || !s) return;
    row.outerHTML = suppRowHtml(s);
  }

  function syncTakeAllBtn() {
    const btn = $('#take-all-btn', el);
    if (!btn) return;
    const untaken = DB.supplements.list().some((s) => !DB.supplements.isTaken(s.id, todayIso));
    btn.disabled = !untaken;
    btn.style.opacity = untaken ? '' : '.5';
  }

  $('#add-supp-btn', el).addEventListener('click', () => openSupplementModal());

  $('#take-all-btn', el)?.addEventListener('click', () => {
    DB.supplements.list().forEach((s) => {
      if (!DB.supplements.isTaken(s.id, todayIso)) {
        DB.supplements.setTaken(s.id, todayIso, true);
        refreshSuppRow(s.id);
      }
    });
    syncTakeAllBtn();
    showToast(t('all_taken'));
  });

  // Delegated toggle + edit — in-place row refresh, no full re-render.
  $('#supp-list', el).addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-supp]');
    if (toggle) {
      const id = toggle.dataset.toggleSupp;
      const isTaken = DB.supplements.isTaken(id, todayIso);
      DB.supplements.setTaken(id, todayIso, !isTaken);
      refreshSuppRow(id);
      syncTakeAllBtn();
      showToast(!isTaken ? t('taken') : t('not_taken'));
      return;
    }
    const edit = e.target.closest('[data-edit-supp]');
    if (edit) openSupplementModal(edit.dataset.editSupp);
  });
}

// Reminders: the master switch, the water schedule, and a read-only summary of
// what is actually queued. Supplement times are edited on each supplement, so
// this screen never becomes a second place to define them.
function openRemindersModal() {
  const render = () => {
    openModal(`
      <div class="modal-header">
        <div>
          <div class="modal-title">${t('remind_title')}</div>
          <div class="modal-subtitle">${t('remind_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button>
      </div>

      <!-- The master switch and the water schedule USED to live here. They were
           removed when the schedule moved to DB.notif: sync() no longer reads
           reminders.enabled or reminders.water, so both controls had become
           inert — they would have written a value nothing consults and told the
           user something was on or off when it was neither. Scheduling is the
           notifications page now; this modal is the native health check only.

           THE STATUS BOX BELOW WAS MISSING. paintStatus() has always begun by
           looking up #rem-status and bailing when it is absent — and when the
           two controls were deleted, the element went with them. So the screen
           whose entire job is to explain why a reminder never arrived rendered
           a title, a test button, and nothing else. Every diagnosis it computes
           — permission state, what Android actually holds, the exact-alarm fix,
           the battery hint — was thrown away at that first line. -->
      <div class="rem-status" id="rem-status"></div>

      <button type="button" class="settings-action-row" id="rem-test" style="margin-top:8px">
        <div class="settings-action-icon icon-mirror">${icon('send', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('remind_test')}</div>
          <div class="settings-action-sub">${t('remind_test_sub')}</div>
        </div>
      </button>

      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-block" data-close>${t('done')}</button>
      </div>
    `);

    // Filled after paint: diagnose() has to cross the native bridge.
    const paintStatus = async () => {
      const box = $('#rem-status');
      if (!box || !window.Notify) return;
      const d = await Notify.diagnose();
      const rows = [];
      if (d.osEnabled === false) rows.push(`<div class="rem-status-row bad">${t('remind_stat_off')}</div>`);
      rows.push(`<div class="rem-status-row ${d.permission === 'granted' ? 'ok' : 'bad'}">${
        d.permission === 'granted' ? t('remind_stat_perm_ok') : t('remind_stat_perm_no')}</div>`);
      if (d.native && d.pending !== null) {
        rows.push(`<div class="rem-status-row ${d.pending ? 'ok' : ''}">${fmtNum(d.pending)} ${t('remind_stat_queued')}</div>`);
        // What we INTENDED vs what Android is holding. The two diverge whenever
        // the OS silently drops part of a schedule, and a screen that reports
        // only the intention looks healthy while nothing is armed. `+1` is the
        // test notification's own slot, which sync() never sweeps.
        if (d.scheduled && d.pending < d.scheduled) {
          rows.push(`<div class="rem-status-row bad">${escapeHtml(
            t('remind_stat_mismatch').replace('{a}', fmtNum(d.pending)).replace('{b}', fmtNum(d.scheduled)))}</div>`);
        }
        rows.push(`<div class="rem-status-row">${escapeHtml(
          t('notif_arm_days').replace('{n}', fmtNum(d.armDays || 7)))}</div>`);
      }
      // The single biggest reason a reminder never arrives. From Android 14 the
      // "Alarms & reminders" permission is DENIED by default, and the plugin then
      // re-arms each daily repeat with a plain non-wakeup alarm — which Doze can
      // hold indefinitely. It is one tap to fix and nothing was ever asking.
      if (d.exact === 'denied') {
        rows.push(`<button type="button" class="rem-status-row bad rem-status-action" id="rem-exact">
          <strong>${t('remind_exact_title')}</strong><span>${t('remind_exact_sub')}</span></button>`);
      } else if (d.exact === 'granted') {
        rows.push(`<div class="rem-status-row ok">${t('remind_exact_ok')}</div>`);
      }
      // Last resort, and deliberately last: an OEM battery restriction cannot be
      // detected or requested from here, only explained.
      if (d.native) {
        rows.push(`<div class="rem-status-row">
          <strong>${t('remind_battery_title')}</strong><span>${t('remind_battery_sub')}</span></div>`);
      }
      // diagnose() crossed the native bridge, so the modal may have closed while
      // we waited. Bail rather than write to a detached node — and bind INSIDE
      // `box`, not with a document-wide query, or a stale listener from the
      // previous modal ends up on the new one.
      if (!box.isConnected) return;
      box.innerHTML = rows.join('');
      box.querySelector('#rem-exact')?.addEventListener('click', async () => {
        await Notify.requestExactAlarms();
        paintStatus();
      });
    };
    paintStatus();

    // One reminder action at a time. Every handler below awaits the native
    // bridge, and a double-tap would otherwise interleave two syncs — leaving
    // alarms armed while the stored setting says "off".
    let busy = false;
    const once = (fn) => async (...a) => { if (busy) return; busy = true; try { await fn(...a); } finally { busy = false; } };

    // gate() is the ONLY prompt in this tap; Notify.test() then merely checks.
    // Asking twice in one press is how two dismissals — a permanent hard-deny on
    // Android 13+ — come out of a single button.
    $('#rem-test')?.addEventListener('click', once(async () => {
      if (window.Notify) await Notify.gate();
      const res = window.Notify ? await Notify.test() : { ok: false, reason: 'unsupported' };
      showToast(res.ok ? t('remind_test_sent') : `${t('remind_test_failed')} · ${res.reason}`);
      // The test lands in the log, so re-read the status: `pending` moved.
      paintStatus();
    }));
    // The handlers for #rem-sound and #rem-from/#rem-to/#rem-every used to sit
    // here. Their elements were deleted with the controls, so every one of them
    // was an `?.` against null — silently binding nothing. They are gone rather
    // than left as three more no-ops that read like working code.
  };
  render();
}

function openSupplementModal(id = null) {
  const existing = id ? DB.supplements.list().find((x) => x.id === id) : null;
  let pickedColor = existing ? existing.color : SUPP_COLORS[0];

  const swatches = SUPP_COLORS.map((c) => `
    <button type="button" class="color-swatch ${pickedColor === c ? 'active' : ''}" style="background:${c}" data-color="${c}"></button>
  `).join('');

  // Presets only when ADDING. On an edit they would silently overwrite the name
  // and dose the user came here to change.
  const taken = new Set(DB.supplements.list().map((s) => (s.name || '').trim().toLowerCase()));
  const presetsHtml = existing ? '' : `
    <div class="form-group">
      <label class="form-label">${t('common_supplements')}</label>
      <div class="supp-presets" id="supp-presets">
        ${SUPP_PRESETS.map((p, i) => {
          const already = taken.has(suppPresetName(p).toLowerCase()) || taken.has(p.en.toLowerCase());
          return `<button type="button" class="supp-preset${already ? ' added' : ''}" data-preset="${i}"${already ? ` title="${escapeHtml(t('already_added'))}"` : ''}>${escapeHtml(suppPresetName(p))}</button>`;
        }).join('')}
      </div>
    </div>`;

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_supplement') : t('new_supplement')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    ${presetsHtml}

    <div class="form-group">
      <label class="form-label">${t('supplement_name')}</label>
      <input type="text" id="supp-name" placeholder="${t('ph_supplement_name')}" value="${existing ? escapeHtml(existing.name) : ''}" autofocus>
    </div>

    <div class="form-group">
      <label class="form-label">${t('dose')}</label>
      <input type="text" id="supp-dose" placeholder="5 g" value="${existing ? escapeHtml(existing.dose || '') : ''}">
    </div>

    <div class="form-group">
      <label class="form-label">${t('color')}</label>
      <div class="color-swatches" id="color-swatches">${swatches}</div>
    </div>

    <div class="form-group">
      <label class="form-label">${t('remind_times')}</label>
      <div class="time-chips" id="supp-times"></div>
      <div class="time-add">
        <input type="time" id="supp-time-input" value="08:00">
        <button type="button" class="btn btn-ghost" id="supp-time-add">${icon('plus', 16)} ${t('remind_add_time')}</button>
      </div>
    </div>

    <div class="form-actions">
      ${existing ? `<button type="button" class="btn btn-danger" id="supp-delete" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 20)}</button>` : ''}
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="supp-save">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  let times = existing && Array.isArray(existing.times) ? existing.times.slice() : [];
  const paintTimes = () => {
    const host = $('#supp-times');
    if (!host) return;
    host.innerHTML = times.length
      ? times.slice().sort().map((tm) => `
          <span class="time-chip">${escapeHtml(tm)}
            <button type="button" class="time-chip-x" data-rm-time="${escapeHtml(tm)}" aria-label="${escapeHtml(t('delete'))}">${icon('close', 16)}</button>
          </span>`).join('')
      : `<span class="time-empty">${t('remind_none')}</span>`;
  };

  const paintSwatches = () => $('#color-swatches').querySelectorAll('[data-color]').forEach((x) =>
    x.classList.toggle('active', x.dataset.color === pickedColor));

  $('#color-swatches').addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (!sw) return;
    pickedColor = sw.dataset.color;
    paintSwatches();
  });

  paintTimes();
  $('#supp-time-add')?.addEventListener('click', async () => {
    const v = $('#supp-time-input').value;
    if (!v || times.indexOf(v) !== -1) return;   // ignore blanks and duplicates
    // Setting a time is asking to be reminded — so this is where the OS sheet
    // belongs, not buried in Settings behind a switch the user never found.
    // The time is kept either way: without the OS permission the reminder still
    // reaches them through the in-app catch-up.
    if (window.Notify) await Notify.gate();
    // The `DB.reminders.setEnabled(true)` that used to sit here is gone: it wrote
    // a v208 flag whose last reader (catchUp()'s gate) was removed in v251. What
    // actually makes this time fire is DB.notif.syncSuppDoses() on save.
    times.push(v);
    paintTimes();
  });
  $('#supp-times')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm-time]');
    if (!b) return;
    times = times.filter((x) => x !== b.dataset.rmTime);
    paintTimes();
  });

  // A preset FILLS the form, it does not submit it — the name, dose and colour
  // stay editable, which is what keeps the manual path intact.
  $('#supp-presets')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const p = SUPP_PRESETS[Number(btn.dataset.preset)];
    if (!p) return;
    $('#supp-name').value = suppPresetName(p);
    $('#supp-dose').value = p.dose;
    pickedColor = p.color;
    paintSwatches();
    $('#supp-presets').querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('picked', x === btn));
  });

  $('#supp-save').addEventListener('click', () => {
    const name = $('#supp-name').value.trim();
    const dose = $('#supp-dose').value.trim();
    if (!name) { showToast(t('enter_name')); return; }
    let suppId = existing ? existing.id : null;
    if (existing) {
      DB.supplements.update(existing.id, { name, dose, color: pickedColor, times });
      showToast(t('updated'));
    } else {
      const created = DB.supplements.add({ name, dose, color: pickedColor, times });
      suppId = created && created.id;
      showToast(t('saved'));
    }
    // The times set HERE now actually schedule. They used to be written to
    // `sup.times`, which the scheduler has never read — the notifications page
    // wrote to a different list — so a time set on a supplement saved, showed in
    // the UI, and silently never fired.
    try { DB.notif.syncSuppDoses(suppId, name, times); } catch (_) {}
    // Times changed → the alarm set is stale. No-op off-native.
    try { armNotifications(); } catch (_) {}
    try { if (window.Notify) Notify.sync(); } catch (_) {}
    closeModal();
    renderView(currentView);
  });

  if (existing) {
    $('#supp-delete').addEventListener('click', () => {
      confirmDialog({
        title: t('delete_supplement_q'),
        text: t('delete_supplement_text'),
        onConfirm: () => {
          DB.supplements.remove(existing.id);
          // Drop its derived doses too, or the supplement is gone and its
          // reminders keep arriving — an orphan alarm for a deleted thing is
          // exactly what sync()'s full-replace exists to prevent.
          try { DB.notif.syncSuppDoses(existing.id, '', []); } catch (_) {}
          try { armNotifications(); } catch (_) {}
          try { if (window.Notify) Notify.sync(); } catch (_) {}
          closeModal();
          showToast(t('deleted'));
          renderView(currentView);
        },
      });
    });
  }
}

// ==========================================================================
// FOOD LOG VIEW
// ==========================================================================
function renderFoodLog(el) {
  const ctx = viewContext.foodLog || { date: todayISO() };
  viewContext.foodLog = ctx;

  const entries = DB.foodLogs.listForDate(ctx.date);
  const totals = DB.foodLogs.totalsForDate(ctx.date);
  const isToday = ctx.date === todayISO();

  const dayLabel = isToday ? t('today_totals') : formatDate(ctx.date);

  // One food-log row (also used when quick-add appends a single row live).
  function foodRowHtml(e) {
    const m = e.servings || 1;
    return `
      <div class="food-log-row" data-food-row="${e.id}">
        <div class="food-log-main">
          <div class="food-log-name">
            ${escapeHtml(e.name)}
            ${m !== 1 ? `<span class="food-log-x num">× ${fmtNum(m)}</span>` : ''}
          </div>
          <div class="food-log-meta">
            <span><span class="num">${fmtNum(Math.round(e.calories * m))}</span> ${t('cal')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.protein * m * 10) / 10)}</span>g ${t('protein_label')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.carbs * m * 10) / 10)}</span>g ${t('carbs_label')}</span>
            ${e.fat ? `<span class="dot-sep"></span><span><span class="num">${fmtNum(Math.round(e.fat * m * 10) / 10)}</span>g ${t('fat_label')}</span>` : ''}
          </div>
        </div>
        <button class="icon-btn danger" data-del-food="${escapeHtml(e.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 20)}</button>
      </div>
    `;
  }
  const items = entries.map(foodRowHtml).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="food" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('food_log_title')}</div>
    </div>

    <div class="day-nav">
      <!-- prev = back(◀), next = chevronRight(▶). These were swapped, so in
           English the "previous day" button pointed forwards. RTL is handled in
           CSS (body[dir="rtl"] .calendar-nav-btn svg), not by swapping icons. -->
      <button class="calendar-nav-btn" id="day-prev" aria-label="${t('prev_day')}">${icon('back', 20)}</button>
      <div class="day-nav-label">${escapeHtml(dayLabel)}</div>
      <button class="calendar-nav-btn" id="day-next" aria-label="${t('next_day')}" ${isToday ? 'disabled style="opacity:0.4"' : ''}>${icon('chevronRight', 20)}</button>
    </div>

    <div class="macro-totals">
      <div class="macro-total cal">
        <div class="macro-total-label">${t('calories')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.calories))}<span class="macro-total-unit">${t('cal')}</span></div>
      </div>
      <div class="macro-total pro">
        <div class="macro-total-label">${t('protein_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.protein * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
      <div class="macro-total carb">
        <div class="macro-total-label">${t('carbs_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.carbs * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
      <div class="macro-total fat">
        <div class="macro-total-label">${t('fat_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round((totals.fat || 0) * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
    </div>

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('logged_items')}</div>
      <button class="btn btn-primary" id="add-foodlog-btn">${icon('plus', 20)} ${t('add_food_log')}</button>
    </div>

    <div class="data-list" id="food-log-list" style="gap:6px">
      ${entries.length === 0
        ? emptyState({ iconName: 'apple', title: t('no_food_logged'), text: t('no_food_logged_text') })
        : items
      }
    </div>
  `;

  $('#day-prev', el).addEventListener('click', () => {
    ctx.date = addDaysISO(ctx.date, -1);
    renderFoodLog(el);
  });
  $('#day-next', el).addEventListener('click', () => {
    if (isToday) return;
    ctx.date = addDaysISO(ctx.date, 1);
    renderFoodLog(el);
  });

  // One add entry point: the same 5-method sheet used by the Food dashboard FAB,
  // logging to the day shown here (unifies the old separate 'AI' + 'Add Food').
  $('#add-foodlog-btn', el).addEventListener('click', () => openAddSheet(ctx.date, () => renderFoodLog(el)));

  // Refresh only the macro-totals block from current DB state.
  function refreshTotals() {
    const tt = DB.foodLogs.totalsForDate(ctx.date);
    const set = (sel, v) => { const n = $(sel, el); if (n) n.childNodes[0].nodeValue = v; };
    set('.macro-total.cal .macro-total-value', fmtNum(Math.round(tt.calories)));
    set('.macro-total.pro .macro-total-value', fmtNum(Math.round(tt.protein * 10) / 10));
    set('.macro-total.carb .macro-total-value', fmtNum(Math.round(tt.carbs * 10) / 10));
    set('.macro-total.fat .macro-total-value', fmtNum(Math.round((tt.fat || 0) * 10) / 10));
  }

  // Delegated delete — append/remove keep working without rebinding.
  $('#food-log-list', el).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-food]');
    if (!btn) return;
    DB.foodLogs.remove(ctx.date, btn.dataset.delFood);
    const row = btn.closest('[data-food-row]');
    if (row) row.remove();
    if (!$('#food-log-list', el).querySelector('[data-food-row]')) {
      $('#food-log-list', el).innerHTML = emptyState({ iconName: 'apple', title: t('no_food_logged'), text: t('no_food_logged_text') });
    }
    refreshTotals();
    showToast(t('food_removed'));
  });
}


// ==========================================================================
// Initial boot
// ==========================================================================
// ==========================================================================
// Cloud auth gate (Supabase) — optional; app stays fully usable offline.
// ==========================================================================
let authMode = 'in'; // 'in' | 'up'

// Everything that has to follow a cloud PULL, i.e. after the whole blob was
// replaced by a copy from another device.
function refreshAfterSync() {
  const prefs = DB.prefs.get();
  applyTheme(prefs.theme || 'dark');
  applyLang(prefs.lang || 'en');
  renderView(currentView || 'home');
  // The pulled blob carries its own reminder settings and supplement times, and
  // the OS alarms still reflect the ones this device had a moment ago. Nothing
  // else re-arms them: the boot sync runs on a 1.5s timer that can fire before
  // the pull lands, so without this a phone can sit on a schedule the user
  // changed on their other device — or on none at all.
  try { if (window.Notify) Notify.sync(); } catch (_) {}
}

function hideAuthGate() {
  const g = document.getElementById('auth-gate');
  if (g) g.remove();
}

// Is the app running on the maintainer's own machine (dev server) rather than
// for real users? The account gate is mandatory in production, but during
// development it has to be possible to reach the app without signing in on every
// cleared install.
//
// Hostname is the ONLY signal used, deliberately. A flag in localStorage or a URL
// parameter would be settable by anyone on the live site — this cannot be, because
// moathdarweesh.github.io is not localhost. The button below is not merely hidden
// on production: it is never rendered into the DOM at all.
function isDevHost() {
  try {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
  } catch (_) { return false; }
}

function showAuthGate(mode) {
  authMode = mode || 'in';
  // Re-rendering (language switch, sign-in ⇄ sign-up) must not throw away what
  // the user already typed.
  const prev = document.getElementById('auth-gate');
  const keep = prev
    ? {
        email: (prev.querySelector('#auth-email') || {}).value || '',
        pw: (prev.querySelector('#auth-password') || {}).value || '',
      }
    : null;
  hideAuthGate();
  const up = authMode === 'up';
  const lang = (DB.prefs.get().lang === 'ar') ? 'ar' : 'en';
  const gate = document.createElement('div');
  gate.id = 'auth-gate';
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-lang" role="group" aria-label="${t('language')}">
        <button type="button" class="auth-lang-btn ${lang === 'ar' ? 'active' : ''}" data-setlang="ar" lang="ar" aria-pressed="${lang === 'ar'}">العربية</button>
        <button type="button" class="auth-lang-btn ${lang === 'en' ? 'active' : ''}" data-setlang="en" lang="en" aria-pressed="${lang === 'en'}">English</button>
      </div>
      <div class="auth-title">${brandLockup('splash')}</div>
      <div class="auth-sub">${up ? t('auth_sub_up') : t('auth_sub_in')}</div>
      <input type="email" id="auth-email" class="auth-input" placeholder="${t('auth_email')}" autocomplete="email" inputmode="email">
      <input type="password" id="auth-password" class="auth-input" placeholder="${t('auth_password')}" autocomplete="${up ? 'new-password' : 'current-password'}">
      <div class="auth-err" id="auth-err" role="alert"></div>
      <button class="btn btn-primary btn-block" id="auth-submit">${up ? t('auth_signup') : t('auth_signin')}</button>
      ${up ? '' : `<button class="auth-toggle" id="auth-forgot">${t('auth_forgot')}</button>`}
      <!-- Mode switch: one small line UNDER the form, the way every sign-in page
           does it. It replaced a top segmented control that gave sign-in and
           sign-up equal visual weight and pushed the actual form down. -->
      <div class="auth-switch">
        ${up ? t('auth_have_account') : t('auth_no_account')}
        <button type="button" data-mode="${up ? 'in' : 'up'}">${up ? t('auth_signin') : t('auth_signup')}</button>
      </div>
      <a class="auth-legal" href="privacy.html?lang=${(DB.prefs.get().lang) || 'en'}" target="_blank" rel="noopener">${t('privacy_policy')}</a>
      ${isDevHost() ? `<button class="auth-dev-skip" id="auth-dev-skip">skip (dev only)</button>` : ''}
    </div>`;
  document.body.appendChild(gate);

  if (keep) {
    document.getElementById('auth-email').value = keep.email;
    document.getElementById('auth-password').value = keep.pw;
  }

  // The ONLY language control in the whole first-run flow. Both labels always
  // stay in their own script so each is legible to the person who wants it, and
  // neither is ever a question the user has to answer to get past this screen.
  gate.querySelectorAll('[data-setlang]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.setlang === lang) return;
      setUiLanguage(b.dataset.setlang);
      showAuthGate(authMode); // rebuild this card in the new language
    })
  );

  const err = (msg) => { const e = document.getElementById('auth-err'); if (e) e.textContent = msg || ''; };
  const submit = document.getElementById('auth-submit');

  const run = async () => {
    const email = (document.getElementById('auth-email').value || '').trim();
    const pw = document.getElementById('auth-password').value || '';
    if (!email || !pw) { err(t('auth_err_fields')); return; }
    if (up && pw.length < 6) { err(t('auth_pw_short')); return; }
    err('');
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = t('auth_signing');
    try {
      const res = up ? await Cloud.signUp(email, pw) : await Cloud.signIn(email, pw);
      if (res.error) {
        err(translateAuthError(res.error));
        submit.disabled = false; submit.textContent = label;
        return;
      }
      if (up && !res.session) {
        // Email confirmation is required — no session yet.
        err(''); submit.disabled = false; submit.textContent = label;
        showToast(t('auth_signup_check_email'));
        showAuthGate('in');
        return;
      }
      await afterLogin();
    } catch (e) {
      err(translateAuthError((e && e.message) || ''));
      submit.disabled = false; submit.textContent = label;
    }
  };

  submit.addEventListener('click', run);
  document.getElementById('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  gate.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => { if (b.dataset.mode !== authMode) showAuthGate(b.dataset.mode); })
  );
  // No skip button in production: an account is REQUIRED (see bootCloud), and
  // nothing dismisses the gate except a successful sign-in/sign-up. The dev-only
  // escape below exists solely so the app is testable on localhost; isDevHost()
  // means it is never rendered on the live site.
  const devSkip = document.getElementById('auth-dev-skip');
  if (devSkip) devSkip.addEventListener('click', () => { hideAuthGate(); });
  const forgot = document.getElementById('auth-forgot');
  if (forgot) forgot.addEventListener('click', () => showForgotPassword(document.getElementById('auth-email').value));
}

// Mandatory unique username. Once a user is logged in AND online, they MUST pick
// a handle before using the app — even already-registered users. Enforced by a
// blocking gate (no skip). No-ops when offline or logged out so a solo/offline
// user is never locked out.
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
async function ensureUsername() {
  if (!window.Cloud || !Cloud.configured || !Cloud.configured() || !Cloud.getUsername) return;
  let info;
  try { info = await Cloud.getUsername(); } catch (_) { return; }
  if (!info || info.offline) return;   // couldn't verify → don't lock anyone out
  if (info.username) return;           // already chosen
  showUsernameGate();
}

function showUsernameGate() {
  if (document.getElementById('username-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'username-gate';
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-title">${t('username_title')}</div>
      <div class="auth-sub">${t('username_sub')}</div>
      <div class="uname-field">
        <span class="uname-at">@</span>
        <input type="text" id="uname-input" class="auth-input" placeholder="${t('username_ph')}"
               autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20">
      </div>
      <div class="uname-rules">${t('username_rules')}</div>
      <div class="auth-err" id="uname-msg" role="alert"></div>
      <button class="btn btn-primary btn-block" id="uname-save" disabled>${t('username_save')}</button>
    </div>`;
  document.body.appendChild(gate);

  const input = document.getElementById('uname-input');
  const save = document.getElementById('uname-save');
  const msgEl = document.getElementById('uname-msg');
  const msg = (txt, cls) => { msgEl.textContent = txt || ''; msgEl.className = 'auth-err' + (cls ? ' ' + cls : ''); };
  let timer = null, valid = false;
  const setValid = (v) => { valid = v; save.disabled = !v; };

  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (v !== input.value) input.value = v;
    setValid(false);
    clearTimeout(timer);
    if (!v) { msg(''); return; }
    if (!USERNAME_RE.test(v)) { msg(t('username_invalid'), 'err'); return; }
    msg(t('username_checking'), '');
    timer = setTimeout(async () => {
      const r = await Cloud.checkUsername(v);
      if (input.value.trim() !== v) return;            // typed more since
      if (r.offline) { msg(t('auth_err_network'), 'err'); return; }
      if (r.available) { msg(t('username_available_msg'), 'ok'); setValid(true); }
      else { msg(t('username_taken'), 'err'); }
    }, 350);
  });

  const claim = async () => {
    const v = input.value.trim();
    if (!USERNAME_RE.test(v)) { msg(t('username_invalid'), 'err'); return; }
    save.disabled = true;
    const label = save.textContent;
    save.textContent = t('auth_signing');
    const r = await Cloud.setUsername(v);
    if (r.ok) { gate.remove(); showToast(t('username_saved')); return; }
    save.textContent = label; save.disabled = false;
    if (r.taken) { msg(t('username_taken'), 'err'); setValid(false); }
    else if (r.error === 'offline') { msg(t('auth_err_network'), 'err'); }
    else { msg(t('username_invalid'), 'err'); }
  };
  save.addEventListener('click', claim);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && valid) claim(); });
  setTimeout(() => input.focus(), 60);
}

function showForgotPassword(prefillEmail) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('auth_reset_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="confirm-text" style="margin-bottom:12px">${t('auth_reset_sub')}</div>
    <input type="email" id="reset-email" class="auth-input" placeholder="${t('auth_email')}" value="${escapeHtml(prefillEmail || '')}" autocomplete="email" inputmode="email">
    <div class="auth-err" id="reset-err"></div>
    <button class="btn btn-primary btn-block" id="reset-send">${t('auth_reset_send')}</button>
  `, { variant: 'confirm' });
  const err = (m) => { const e = overlay.querySelector('#reset-err'); if (e) e.textContent = m || ''; };
  const btn = overlay.querySelector('#reset-send');
  btn.addEventListener('click', async () => {
    const email = (overlay.querySelector('#reset-email').value || '').trim();
    if (!email) { err(t('auth_err_email')); return; }
    err(''); btn.disabled = true; btn.textContent = t('auth_signing');
    try {
      const res = await Cloud.resetPassword(email);
      if (res.error) { err(translateAuthError(res.error)); btn.disabled = false; btn.textContent = t('auth_reset_send'); return; }
      closeModal();
      showToast(t('auth_reset_sent'));
    } catch (e) {
      err(translateAuthError((e && e.message) || '')); btn.disabled = false; btn.textContent = t('auth_reset_send');
    }
  });
}

// Map common Supabase auth errors to friendly localized text.
function translateAuthError(msg) {
  const m = String(msg).toLowerCase();
  if (m.includes('invalid login')) return t('auth_err_invalid');
  if (m.includes('already registered') || m.includes('already been registered')) return t('auth_err_exists');
  if (m.includes('password')) return t('auth_pw_short');
  if (m.includes('email')) return t('auth_err_email');
  if (m.includes('network') || m.includes('fetch')) return t('auth_err_network');
  return t('auth_err_generic');
}

async function afterLogin() {
  // How we reveal the app after a valid sign-in depends on whether THIS device
  // already holds the user's data:
  //   • Device already has data  → reveal immediately, reconcile in background
  //     (fast; there is no empty state to worry the user).
  //   • Fresh / empty device     → KEEP the gate up until the cloud pull lands,
  //     so the user sees their real data appear, NEVER a scary empty home that
  //     could make them panic-sync. (Blocking here is the safe default; the
  //     speed win only applies when it's risk-free.)
  const hasLocal = !!(Cloud.localHasData && Cloud.localHasData());
  if (hasLocal) { hideAuthGate(); showToast(t('syncing')); }
  ensureUsername();                                  // fire-and-forget
  if (Cloud.touchLastSeen) Cloud.touchLastSeen();
  enforceAccountStatus();
  try {
    const r = await Cloud.resolveOnLogin();
    if (r === 'conflict') { hideAuthGate(); showConflictDialog(); return; }
    hideAuthGate();
    refreshAfterSync();
    showToast(t('synced'));
    syncExerciseImages(); // back up / heal custom images, best-effort
  } catch (_) {
    hideAuthGate(); // never trap the user behind the gate on a transient error
  }
}

function showConflictDialog() {
  // THREE things were wrong with this dialog, and all three pointed the same way.
  //
  // 1. "Keep the cloud copy" was .btn-primary — the filled, visually default
  //    action — and it is the DESTRUCTIVE one for the person who is looking at
  //    this box, because they are here precisely for having unsynced local
  //    edits. Neither option is primary now; the choice is genuinely two-sided,
  //    and the cloud branch carries an explicit line saying what it discards.
  // 2. It was dismissible by backdrop tap and by Escape. Dismissing establishes
  //    no baseline, so the next launch could pull straight over the local data
  //    with nothing recorded to stop it. It now stays until answered.
  // 3. Either answer was unrecoverable. cloud.js snapshots the local blob
  //    immediately before any overwrite, so a wrong answer is undoable from
  //    Settings.
  const overlay = openModal(`
    <div class="confirm-title">${t('conflict_title')}</div>
    <div class="confirm-text">${t('conflict_text')}</div>
    <div class="confirm-text conflict-warn">${t('conflict_warn_cloud')}</div>
    <div class="form-actions" style="flex-direction:column;gap:8px">
      <button type="button" class="btn btn-ghost btn-block" data-keep="local">${t('conflict_local')}</button>
      <button type="button" class="btn btn-ghost btn-block" data-keep="cloud">${t('conflict_cloud')}</button>
    </div>
  `, { variant: 'confirm', dismissible: false });
  const finish = () => { __conflictPending = false; closeModal(); hideAuthGate(); refreshAfterSync(); showToast(t('synced')); ensureUsername(); };
  // Both branches used to call finish() unconditionally, so a chooseCloud that
  // silently failed still said "Synced" — leaving the user's explicit "keep the
  // account's data" decision UNEXECUTED while a later logout push clobbered the
  // very copy they chose to keep. On failure the dialog stays open so the choice
  // can be made again, and the toast tells the truth.
  const run = async (fn, btn) => {
    btn.disabled = true;
    let r; try { r = await fn(); } catch (_) { r = 'failed'; }
    btn.disabled = false;
    if (r === 'ok') finish();
    else showToast(t('auth_err_network'));
  };
  const cloudBtn = overlay.querySelector('[data-keep="cloud"]');
  const localBtn = overlay.querySelector('[data-keep="local"]');
  cloudBtn.addEventListener('click', () => run(Cloud.chooseCloud, cloudBtn));
  localBtn.addEventListener('click', () => run(Cloud.chooseLocal, localBtn));
}

function showChangePassword() {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('change_password')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <input type="password" id="cpw-current" class="auth-input" placeholder="${t('change_password_current')}" autocomplete="current-password">
    <input type="password" id="cpw-new" class="auth-input" placeholder="${t('change_password_new')}" autocomplete="new-password">
    <input type="password" id="cpw-confirm" class="auth-input" placeholder="${t('change_password_confirm')}" autocomplete="new-password">
    <div class="auth-err" id="cpw-err"></div>
    <button class="btn btn-primary btn-block" id="cpw-save">${t('save')}</button>
  `, { variant: 'confirm' });
  const err = (m) => { const e = overlay.querySelector('#cpw-err'); if (e) e.textContent = m || ''; };
  const btn = overlay.querySelector('#cpw-save');
  btn.addEventListener('click', async () => {
    const cur = overlay.querySelector('#cpw-current').value || '';
    const pw = overlay.querySelector('#cpw-new').value || '';
    const pw2 = overlay.querySelector('#cpw-confirm').value || '';
    if (!cur) { err(t('change_password_current_req')); return; }
    if (pw.length < 6) { err(t('auth_pw_short')); return; }
    if (pw !== pw2) { err(t('change_password_mismatch')); return; }
    err(''); btn.disabled = true; btn.textContent = t('auth_signing');
    try {
      const res = await Cloud.changePassword(pw, cur);
      if (res.error === 'reauth_failed') { err(t('change_password_wrong_current')); btn.disabled = false; btn.textContent = t('save'); return; }
      if (res.error) { err(translateAuthError(res.error)); btn.disabled = false; btn.textContent = t('save'); return; }
      closeModal();
      showToast(t('change_password_done'));
    } catch (e) {
      err(translateAuthError((e && e.message) || '')); btn.disabled = false; btn.textContent = t('save');
    }
  });
}

function showFeedback() {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('feedback_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="confirm-text" style="margin-bottom:12px">${t('feedback_sub')}</div>
    <textarea id="fb-msg" class="auth-input" rows="4" style="resize:vertical;min-height:96px" placeholder="${t('feedback_ph')}"></textarea>
    <div class="auth-err" id="fb-err"></div>
    <button class="btn btn-primary btn-block" id="fb-send">${t('feedback_send')}</button>
  `, { variant: 'confirm' });
  const err = (m) => { const e = overlay.querySelector('#fb-err'); if (e) e.textContent = m || ''; };
  const btn = overlay.querySelector('#fb-send');
  setTimeout(() => { const ta = overlay.querySelector('#fb-msg'); if (ta) ta.focus(); }, 60);
  btn.addEventListener('click', async () => {
    const msg = (overlay.querySelector('#fb-msg').value || '').trim();
    if (!msg) { err(t('feedback_empty')); return; }
    if (!window.Cloud || !Cloud.configured() || !Cloud.submitFeedback) { err(t('auth_err_network')); return; }
    err(''); btn.disabled = true; btn.textContent = t('auth_signing');
    try {
      const res = await Cloud.submitFeedback(msg, VAULT_BUILD);
      if (res && res.ok) { closeModal(); showToast(t('feedback_sent')); return; }
      err(res && res.error === 'offline' ? t('auth_err_network') : t('auth_err_generic'));
    } catch (_) { err(t('auth_err_generic')); }
    btn.disabled = false; btn.textContent = t('feedback_send');
  });
}

// Account status enforcement. An admin can disable/ban an account from the
// control panel; on boot the app reads the user's own flags and, if the account
// is not active, shows a blocking screen. Fails OPEN (never locks out on a
// network error / before any flag is set) — the default is an active user.
async function enforceAccountStatus() {
  if (!window.Cloud || !Cloud.configured() || !Cloud.getMyFlags) return;
  let flags;
  try { flags = await Cloud.getMyFlags(); } catch (_) { return; }
  if (!flags || flags.offline || flags.status === 'active') return;
  showBlockedGate(flags.status, flags.reason);
}

function showBlockedGate(status, reason) {
  if (document.getElementById('blocked-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'blocked-gate';
  gate.className = 'auth-gate';
  const msg = status === 'banned' ? t('account_banned_msg') : t('account_disabled_msg');
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-title">${t('account_blocked_title')}</div>
      <div class="auth-sub">${escapeHtml(msg)}</div>
      ${reason ? `<div class="uname-rules">${escapeHtml(reason)}</div>` : ''}
    </div>`;
  document.body.appendChild(gate);
}

async function populateAccount(el) {
  const body = el.querySelector('#account-body');
  if (!body) return;
  await Cloud.ensureSdk(); // load the Supabase SDK on demand
  let email = null;
  try { email = await Cloud.currentEmail(); } catch (_) {}
  if (email) {
    body.innerHTML = `
      <div class="settings-action-row" style="cursor:default">
        <div class="settings-action-icon">${icon('globe', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${escapeHtml(email)}</div>
          <div class="settings-action-sub">${t('account_synced_sub')}</div>
        </div>
      </div>
      <button class="settings-action-row" id="sync-now-btn">
        <div class="settings-action-icon">${icon('refresh', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('sync_now')}</div>
          <!-- The sub-line is the honest one now. isDirty/getStamp were never
               exported from cloud.js, so NO screen could tell the user their
               last set was still only on this phone; the app could only ever
               say "synced" after a button press and nothing in between. -->
          <div class="settings-action-sub">${(() => {
            const st = (window.Cloud && Cloud.syncState) ? Cloud.syncState() : null;
            if (st && st.dirty) return t('sync_unsynced');
            if (st && st.stamp) return `${t('sync_now_sub')} · ${escapeHtml(formatDateShort(st.stamp.slice(0, 10)))}`;
            return t('sync_now_sub');
          })()}</div>
        </div>
      </button>
      ${(() => {
        const rec = (window.Cloud && Cloud.recoveryInfo) ? Cloud.recoveryInfo() : null;
        if (!rec) return '';
        return `
      <button class="settings-action-row" id="sync-restore-btn">
        <div class="settings-action-icon">${icon('refresh', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('sync_restore')}</div>
          <div class="settings-action-sub">${escapeHtml(formatDateShort(String(rec.at).slice(0, 10)))}</div>
        </div>
      </button>`;
      })()}
      <button class="settings-action-row" id="change-pw-btn">
        <div class="settings-action-icon">${icon('settings', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('change_password')}</div>
          <div class="settings-action-sub">${t('change_password_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row is-danger" id="logout-btn">
        <div class="settings-action-icon icon-mirror" style="background:var(--red-bg);color:var(--red)">${icon('back', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('logout')}</div>
          <div class="settings-action-sub">${t('logout_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row is-danger" id="delete-account-btn">
        <div class="settings-action-icon" style="background:var(--red-bg);color:var(--red)">${icon('trash', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('delete_account')}</div>
          <div class="settings-action-sub">${t('delete_account_sub')}</div>
        </div>
      </button>`;
    $('#change-pw-btn', el)?.addEventListener('click', showChangePassword);
    $('#delete-account-btn', el)?.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_account'), text: t('delete_account_confirm'),
        confirmLabel: t('delete_account'), variant: 'danger',
        onConfirm: async () => {
          showToast(t('deleting_account'));
          try {
            await Cloud.deleteAccount();
            location.reload();   // fresh, empty state → auth gate
          } catch (e) { showToast(e && e.message ? t(e.message, e.message) : t('ai_error')); }
        },
      });
    });
    // Undo for the one action in the app that replaces everything at once.
    $('#sync-restore-btn', el)?.addEventListener('click', () => {
      confirmDialog({
        title: t('sync_restore_title'),
        text: t('sync_restore_text'),
        confirmLabel: t('sync_restore'),
        variant: 'danger',
        onConfirm: async () => {
          let ok = false;
          try { ok = await Cloud.restoreRecovery(); } catch (_) { ok = false; }
          showToast(ok ? t('sync_restored') : t('sync_restore_failed'));
          if (ok) { refreshAfterSync(); renderView(currentView); }
        },
      });
    });
    $('#sync-now-btn', el)?.addEventListener('click', async () => {
      showToast(t('auth_signing'));
      try {
        // Report what ACTUALLY happened. This used to say "Synced" for every
        // outcome — including a failed/offline push and an unresolved conflict —
        // so the user was told their data was safe when it was still only local.
        const r = await Cloud.bootSync();
        if (r === 'pulled') { refreshAfterSync(); showToast(t('synced')); }
        else if (r === 'pushed') showToast(t('synced'));
        else if (r === 'conflict') showConflictDialog();
        else showToast(t('auth_err_network'));   // 'offline' / anything else
      } catch (_) { showToast(t('auth_err_network')); }
    });
    $('#logout-btn', el)?.addEventListener('click', () => {
      confirmDialog({
        title: t('logout'), text: t('logout_confirm'), confirmLabel: t('logout'),
        onConfirm: async () => {
          // Push local data to the cloud FIRST, and only clear this device if it
          // is safely uploaded — otherwise logging out could lose unsynced
          // sessions. If the push fails/offline, keep the local data intact.
          // FAIL CLOSED: only the explicit 'ok' from push() means "this device's
          // data is in the cloud". Anything else — 'nosession' (offline/expired
          // token), 'blocked', 'conflict', or a throw — means the local data was
          // NOT uploaded, so we must keep it rather than clear it.
          let safe = false;
          try { safe = (await Cloud.push()) === 'ok'; } catch (_) { safe = false; }
          try { await Cloud.signOut(); } catch (_) {}
          if (safe) { try { Cloud.clearLocalUserData(); } catch (_) {} }
          location.reload();
        },
      });
    });
  } else {
    body.innerHTML = `
      <button class="settings-action-row" id="signin-btn">
        <div class="settings-action-icon">${icon('globe', 20)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('auth_not_signed')}</div>
          <div class="settings-action-sub">${t('auth_signin_sub')}</div>
        </div>
      </button>`;
    $('#signin-btn', el)?.addEventListener('click', () => showAuthGate('in'));
  }
}

// ==========================================================================
// PERSONAL RECORDS VIEW
// ==========================================================================
// Manage the exercises the user created themselves: list all custom exercises,
// add a new one, edit any (name / category / image), or delete. Add + edit reuse
// openNewExerciseModal (which re-renders currentView on save, so this refreshes).
function renderCustomExercises(el) {
  const customs = DB.exercises.list()
    .filter((e) => e.isCustom)
    .sort((a, b) => exDisplayName(a).localeCompare(exDisplayName(b)));

  const rows = customs.map((ex) => {
    const url = exerciseImgSrc(ex);
    return `
      <div class="data-row">
        <span class="ms-thumb" data-cat="${escapeHtml(ex.category)}">
          <span class="ms-thumb-fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</span>
          ${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        </span>
        <div class="data-main">
          <div class="data-title">${escapeHtml(exDisplayName(ex))}</div>
          <div class="data-meta">${escapeHtml(categoryLabel(ex.category))}</div>
        </div>
        <div class="data-actions">
          <button class="icon-btn" data-edit-custom="${ex.id}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-del-custom="${ex.id}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="workouts" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('my_exercises_short')}</div>
    </div>

    <div class="page-header">
      <div class="row-between">
        <div>
          <h1 class="page-title">${t('my_exercises_short')}</h1>
        </div>
        <button class="btn btn-primary" id="ce-add">${icon('plus', 20)} ${t('add_custom')}</button>
      </div>
    </div>

    ${customs.length === 0
      ? emptyState({ title: t('ce_empty_title'), text: t('ce_empty_text') })
      : `<div class="data-list">${rows}</div>`}
  `;

  $('#ce-add', el)?.addEventListener('click', () => openNewExerciseModal(null));
  el.querySelectorAll('[data-edit-custom]').forEach((b) =>
    b.addEventListener('click', () => openNewExerciseModal(b.dataset.editCustom)));
  el.querySelectorAll('[data-del-custom]').forEach((b) =>
    b.addEventListener('click', () => confirmDialog({
      title: t('delete_exercise_q'),
      text: t('delete_exercise_text'),
      confirmLabel: t('delete'),
      onConfirm: () => { DB.exercises.remove(b.dataset.delCustom); showToast(t('deleted')); renderView('custom-exercises'); },
    })));
}

// Every logged session for ONE muscle group, newest first, grouped by day.
// Reached by tapping a cell in the home muscle-focus heatmap: the cell shows a
// 7-day count, this shows the whole history behind it (the user asked for ALL
// the sessions, not just the ones inside the heatmap's window).
function renderMuscleSessions(el) {
  const cat = viewContext.muscleCat || 'Chest';
  const exById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const sessions = DB.sessions.listAll()
    .filter((s) => { const ex = exById[s.exerciseId]; return ex && ex.category === cat; })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const lang = DB.prefs.get().lang || 'en';
  const byDate = {};
  sessions.forEach((s) => { (byDate[s.date] = byDate[s.date] || []).push(s); });

  const groupsHtml = Object.keys(byDate).map((date) => {
    const label = new Date(date + 'T00:00:00').toLocaleDateString(
      lang === 'ar' ? 'ar-u-nu-latn' : 'en-US',
      { weekday: 'long', day: 'numeric', month: 'long' }
    );
    const cards = byDate[date].map((s) => {
      const ex = exById[s.exerciseId];
      const sets = (s.sets || []).filter((x) => x && (x.reps || x.weight));
      const best = sets.reduce((m, x) => Math.max(m, x.weight || 0), 0);
      const url = exerciseImgSrc(ex);
      const chips = sets.map((x) =>
        `<span class="ms-set"><span class="num">${fmtNum(x.reps || 0)}</span><span class="ms-x">×</span><span class="num">${fmtWeight(x.weight || 0)}</span></span>`
      ).join('');
      return `
        <button class="ms-card" data-open-ex="${ex.id}">
          <span class="ms-thumb" data-cat="${escapeHtml(ex.category)}">
            <span class="ms-thumb-fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</span>
            ${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
          </span>
          <span class="ms-main">
            <span class="ms-name">${escapeHtml(exDisplayName(ex))}</span>
            <span class="ms-meta">${fmtNum(sets.length)} ${escapeHtml(t('ms_sets_label'))}${best > 0 ? ` · ${escapeHtml(t('pr_max_weight'))} ${fmtWeight(best)}${unitLabel()}` : ''}</span>
            ${chips ? `<span class="ms-sets">${chips}</span>` : ''}
          </span>
        </button>
      `;
    }).join('');
    return `<div class="ms-group"><div class="ms-date">${escapeHtml(label)}</div>${cards}</div>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${t('back')}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(categoryLabel(cat))}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('muscle_focus')}</div>
      <h1 class="page-title">${escapeHtml(categoryLabel(cat))}</h1>
      <p class="page-subtitle"><span class="num">${fmtNum(sessions.length)}</span> ${escapeHtml(t('ms_sessions_logged'))}</p>
    </div>

    ${sessions.length === 0
      ? emptyState({ iconName: 'dumbbell', title: t('ms_empty_title'), text: t('ms_empty_text') })
      : `<div class="ms-list">${groupsHtml}</div>`}
  `;

  el.querySelectorAll('[data-open-ex]').forEach((b) =>
    b.addEventListener('click', () => navigate('exercise-detail', { exerciseId: b.dataset.openEx }))
  );
}

function renderPersonalRecords(el) {
  const exercises = DB.exercises.list();

  // Build rows: skip exercises with no sessions or bodyweight-only (maxWeight === 0); null-guard orphan ids
  // One grouping pass for the whole catalog — see DB.sessions.statsByExercise().
  const prIndex = DB.sessions.statsByExercise();
  const rows = exercises
    .map((ex) => {
      if (!ex) return null;
      const snap = prIndex[ex.id];
      if (!snap || snap.sessionCount === 0) return null;
      if (snap.maxWeight === 0) return null; // bodyweight-only exercises (push-ups, pull-ups, etc.)
      return { ex, snap };
    })
    .filter(Boolean)
    .sort((a, b) => a.ex.name.localeCompare(b.ex.name));

  const listHtml = rows.map(({ ex, snap }) => `
    <div class="data-row pr-row">
      <div class="data-icon custom" aria-hidden="true">${icon('trophy', 20)}</div>
      <div class="data-main">
        <div class="data-title">${escapeHtml(exDisplayName(ex))}</div>
        <div class="data-meta pr-stats">
          <span>${escapeHtml(t('pr_max_weight'))}: <span class="num">${fmtWeight(snap.maxWeight)}${unitLabel()}</span></span>
          <span class="dot-sep"></span>
          <span>${escapeHtml(t('pr_est_orm'))}: <span class="num">${fmtWeight(Math.round(snap.bestORM))}${unitLabel()}</span></span>
        </div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${t('back')}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('pr_view_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('tools_section')}</div>
      <h1 class="page-title">${t('pr_view_title')}</h1>
      <p class="page-subtitle">${t('pr_card_sub')}</p>
    </div>

    ${rows.length === 0
      ? emptyState({ iconName: 'trophy', title: t('pr_empty_title'), text: t('pr_empty_text') })
      : `<div class="data-list">${listHtml}</div>`
    }
  `;
}

async function bootCloud() {
  if (!window.Cloud || !Cloud.configured()) return; // not set up → local-only
  await Cloud.ensureSdk(); // load the Supabase SDK on demand
  // Opened from a password-reset link → let the user set a new password.
  Cloud.onPasswordRecovery(() => showChangePassword());
  let session = null;
  try { session = await Cloud.getSession(); } catch (_) {}
  if (!session) {
    // AN ACCOUNT IS REQUIRED — the gate has no skip and cannot be dismissed.
    //
    // ONE exception, and it is not a loophole: a user who is ALREADY signed in on
    // this device, whose token merely could not be refreshed because there is no
    // network (a gym basement is the normal case for this app), must not be
    // locked away from data that is sitting on their own phone. Requiring an
    // account is a product decision; holding someone's own workouts hostage to a
    // signal is not.
    //
    // The valve is deliberately narrow: it needs BOTH a device previously linked
    // to an account AND real local data AND the browser reporting offline. A
    // fresh install can never satisfy it, so sign-up stays mandatory. The next
    // launch with a connection re-runs this check and re-gates normally.
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    const known = !!(Cloud.wasLinked && Cloud.wasLinked()) && !!(Cloud.localHasData && Cloud.localHasData());
    if (offline && known) {
      try { showToast(t('auth_offline_grace')); } catch (_) {}
      return; // let them train; sync resumes when the connection does
    }
    showAuthGate('in');
    return;
  }
  // Already logged in — pick up any changes from other devices in the background.
  try {
    const r = await Cloud.bootSync();
    if (r === 'pulled') refreshAfterSync();
    else if (r === 'conflict') showConflictDialog(); // both sides changed → ask
  } catch (_) {}
  ensureUsername(); // enforce a handle for already-logged-in users too
  if (Cloud.touchLastSeen) Cloud.touchLastSeen();  // fire-and-forget activity stamp
  enforceAccountStatus();                          // block disabled/banned accounts
  syncExerciseImages();                            // back up / heal custom images
}

// ==========================================================================
// Admin-managed global catalog (Supabase `exercises` / `food_catalog` /
// `preset_plans` / `app_config`, written from admin.html) — pulled additively
// at boot so the app simply shows more when the owner adds content, and
// behaves exactly as it always has when a table is empty, unreachable, or the
// user is offline. Works logged-out too (these tables are public-read).
// Every step is independently wrapped so a failure here is silent and can
// NEVER block boot or break local/offline usage.
// ==========================================================================
async function bootCatalog() {
  if (!window.Cloud || !Cloud.pullCatalog) return;
  let catalog;
  try { catalog = await Cloud.pullCatalog(); } catch (_) { return; }
  if (!catalog) return;

  // a) Global exercises → merged into the library as ordinary (non-custom)
  // entries. DB.exercises.mergeGlobal dedupes by lowercased name, so calling
  // this on every boot is always safe and never creates duplicates.
  try {
    if (Array.isArray(catalog.exercises) && catalog.exercises.length && DB.exercises && DB.exercises.mergeGlobal) {
      const added = DB.exercises.mergeGlobal(catalog.exercises.map((g) => ({
        name: g && g.name,
        category: g && g.category,
        imageSlug: g && g.image_slug,
        machineType: g && g.machine_type,
      })));
      // Reflect immediately if the library happens to already be open.
      if (added && currentView === 'exercises') renderView('exercises');
    }
  } catch (_) {}

  // b) Ready-made plans → additive to the built-in templates browse.
  try { setServerPresetPlans(catalog.presets); } catch (_) {}

  // c) Global foods → additive to the quick-add picker.
  try { setServerFoodCatalog(catalog.foods); } catch (_) {}

  // d) Dismissible announcement banner + e) one-time default-unit seed.
  try { if (catalog.config) showAnnouncementBanner(catalog.config); } catch (_) {}
  try { if (catalog.config) seedDefaultUnitIfNew(catalog.config); } catch (_) {}
}

// Dismissible in-app banner for the admin's `app_config.announcement_*`.
// Localized per the current UI language; falls back to whichever language IS
// filled in if only one was set. Dismissal is remembered by the announcement's
// own text (not a version number), so editing the message shows it again, but
// re-showing the exact same text never nags a user who already dismissed it.
function showAnnouncementBanner(config) {
  if (!config || !config.announcement_active) return;
  const lang = (DB.prefs.get().lang) || 'en';
  const text = String(
    (lang === 'ar' ? config.announcement_ar : config.announcement_en)
    || config.announcement_en || config.announcement_ar || ''
  ).trim();
  if (!text) return;
  if (document.getElementById('announcement-banner')) return;
  // Dismissal is keyed on the announcement's identity — its updated_at stamp
  // (fallback: the text). So editing OR re-saving it in the admin panel bumps
  // updated_at and it shows again to everyone, even users who dismissed the
  // previous one; an untouched announcement stays dismissed.
  const DISMISS_KEY = 'vault_announcement_dismissed';
  const sig = String(config.updated_at || text);
  let dismissed = '';
  try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch (_) {}
  if (dismissed === sig) return;

  const el = document.createElement('div');
  el.id = 'announcement-banner';
  el.className = 'update-banner announcement-banner';
  el.innerHTML = `
    <div class="update-banner-main">
      <div class="update-banner-icon">${icon('info', 20)}</div>
      <div class="update-banner-text">
        <div class="update-banner-notes">${escapeHtml(text)}</div>
      </div>
    </div>
    <div class="update-banner-actions">
      <button type="button" class="icon-btn icon-btn-tile" id="announcement-dismiss" aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  // Best-effort: if the native-shell "new APK" banner is also showing (both
  // use the same fixed bottom slot), stack ours above it instead of
  // overlapping. Purely cosmetic — never affects function.
  let repositionObserver = null;
  const reposition = () => {
    const upd = document.getElementById('update-banner');
    if (upd && upd !== el) {
      el.style.bottom = `calc(var(--nav-h) + var(--safe-b) + var(--sp-3) + ${upd.offsetHeight + 12}px)`;
    } else {
      el.style.bottom = '';
    }
  };
  try {
    reposition();
    repositionObserver = new MutationObserver(reposition);
    repositionObserver.observe(document.body, { childList: true });
  } catch (_) {}

  el.querySelector('#announcement-dismiss').addEventListener('click', () => {
    try { localStorage.setItem(DISMISS_KEY, sig); } catch (_) {}
    if (repositionObserver) { try { repositionObserver.disconnect(); } catch (_) {} }
    el.classList.remove('show');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  });
}

// One-time seed of the weight-unit preference from the admin's
// `app_config.default_unit` — ONLY for a genuinely brand-new install (no
// logged data yet). An existing user's setup (even an untouched 'kg' default)
// is never overridden once they've started using the app. Guarded by a
// persisted flag so this is attempted at most once per install, ever.
function seedDefaultUnitIfNew(config) {
  if (!config || (config.default_unit !== 'kg' && config.default_unit !== 'lb')) return;
  const FLAG = 'vault_default_unit_seeded_v1';
  try { if (localStorage.getItem(FLAG)) return; } catch (_) { return; }
  try { localStorage.setItem(FLAG, '1'); } catch (_) { return; } // one-time, regardless of the outcome below
  try {
    const all = DB.getAll();
    const hasUserData = !!(
      (all.sessions && all.sessions.length) || (all.cardio && all.cardio.length) ||
      (all.sleep && all.sleep.length) || (all.foods && all.foods.length) ||
      (all.foodLogs && Object.keys(all.foodLogs).length) ||
      (all.supplements && all.supplements.length) ||
      (all.supplementLogs && Object.keys(all.supplementLogs).length) ||
      (all.exercises && all.exercises.some((e) => e && e.isCustom))
    );
    if (hasUserData) return; // not a brand-new user — never override their setup
    if ((all.prefs && all.prefs.unit) !== config.default_unit) {
      DB.prefs.setUnit(config.default_unit);
    }
  } catch (_) {}
}

// Fade newly-loaded images in smoothly. One capture listener covers every
// <img> in the app (load events don't bubble, so capture is required) —
// no per-render JS needed. CSS pairs .machine-photo/.detail-hero img with
// opacity 0 → .loaded 1.
document.addEventListener('load', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.target.classList.add('loaded');
}, true);

// ==========================================================================
// Mobile keyboard handling. When the on-screen keyboard opens it shrinks the
// (dynamic) viewport, which pulls the absolute bottom-nav up on top of the
// field being edited and can leave the field hidden behind the keyboard. We
// (1) flag `body.keyboard-open` so CSS slides the nav out of the way, and
// (2) scroll the focused field into the visible area above the keyboard.
// Detection compares the current viewport height to a remembered baseline —
// this covers BOTH keyboard modes: browsers that shrink only the visual
// viewport AND WebViews (the APK) that resize the whole window.
// ==========================================================================
function setupKeyboardHandling() {
  const vp = window.visualViewport;
  const curH = () => (vp ? vp.height : window.innerHeight);
  let baseH = curH();
  const root = document.documentElement;

  // Publish the VISIBLE viewport height so the CSS can shrink the app shell,
  // modals and gates to the area ABOVE the keyboard (only while it's open) —
  // otherwise `dvh` stays full-height in browsers and content/modals hide behind
  // the keyboard, which reads as everything getting crammed.
  // A keyboard cannot be open while nothing is focused. Requiring this SECOND
  // signal is what stops the height check from getting stuck.
  const typing = () => {
    const el = document.activeElement;
    return !!(el && el.matches && el.matches('input, textarea, [contenteditable="true"]'));
  };

  function evaluate() {
    const h = curH() || window.innerHeight;
    if (!h) return;                   // not laid out yet — don't publish a 0 height
    if (h > baseH) baseH = h;         // grow the baseline (browser chrome hiding, etc.)
    const shrunk = (baseH - h) > 120; // >120px shorter than the baseline
    // BUG THIS FIXES: the baseline only ever grew, so ANY genuine viewport shrink
    // — rotating, the browser chrome reappearing, a resized window — was read as
    // "keyboard is up" FOREVER, and the bottom nav stayed hidden (opacity 0,
    // pushed off-screen) until a reload. The nav vanishing with no keyboard in
    // sight is exactly that.
    const open = shrunk && typing();
    root.style.setProperty('--vvh', h + 'px');
    document.body.classList.toggle('keyboard-open', open);
    // With no field focused, whatever height we are at IS the true baseline.
    // Re-anchoring here lets the baseline SHRINK again, so the app can never get
    // stuck believing a keyboard it cannot see is still open.
    if (!typing()) baseH = h;
  }
  evaluate();
  // Orientation swaps portrait/landscape height — recapture the baseline so the
  // new (shorter, in landscape) height isn't mistaken for an open keyboard.
  function resetBaseline() {
    document.body.classList.remove('keyboard-open');
    setTimeout(() => { baseH = curH(); evaluate(); }, 350);
  }

  if (vp) vp.addEventListener('resize', evaluate);
  window.addEventListener('resize', evaluate);
  window.addEventListener('orientationchange', resetBaseline);
  // Re-check when focus enters or leaves a field. Blur is the reliable moment the
  // keyboard is dismissed — on some browsers no resize event follows it, which
  // would otherwise leave the nav hidden after closing a modal you typed in.
  document.addEventListener('focusin', () => setTimeout(evaluate, 60));
  document.addEventListener('focusout', () => setTimeout(evaluate, 60));

  // Keep the focused field visible above the keyboard. Wait for the keyboard to
  // animate in and settle the viewport before scrolling so we land in the right spot.
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('input, textarea, [contenteditable="true"]')) return;
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
    }, 320);
  });
}

// ==========================================================================
// FIRST-RUN ONBOARDING
// A short, elegant welcome shown ONCE to brand-new installs (empty state).
// Existing users are silently marked onboarded so they never see it. Ends by
// handing off to the real calorie calculator — no duplicated goal logic.
// ==========================================================================
// NO language step here, and no separate language gate before the login screen.
// Both existed, and both ran on the same fresh install — its own gate asked, then
// onboarding's step 0 asked the exact same question again seconds later. The
// language is now guessed from the phone's locale (storage.js detectLang) and
// corrected with the ar/en toggle on the login screen, so it is never a question.
function showOnboarding() {
  if (document.getElementById('onboard-gate')) return;
  let step = 0;
  const gate = document.createElement('div');
  gate.id = 'onboard-gate';
  gate.className = 'auth-gate onboard-gate';
  document.body.appendChild(gate);

  const finish = (openGoal) => {
    DB.prefs.setOnboarded();
    gate.remove();
    // Reflect the unit picked during onboarding.
    if (typeof renderView === 'function' && typeof currentView !== 'undefined' && currentView) {
      try { renderView(currentView); } catch (_) {}
    }
    if (openGoal && !DB.nutrition.hasTargets()) {
      openCalculatorModal(() => {
        if (typeof renderView === 'function' && currentView) { try { renderView(currentView); } catch (_) {} }
      });
    }
  };

  const render = () => {
    const unit = DB.prefs.get().unit || 'kg';
    const dots = [0, 1, 2].map((i) => `<span class="onb-dot ${i === step ? 'active' : ''}"></span>`).join('');
    let inner = '';
    if (step === 0) {
      inner = `
        <div class="onb-wordmark">${brandLockup('splash')}</div>
        <div class="onb-title">${t('onb_welcome_title')}</div>
        <div class="onb-sub">${t('onb_welcome_sub')}</div>
        <div class="onb-feats">
          <div class="onb-feat">${icon('dumbbell', 20)}<span>${t('onb_feat_workouts')}</span></div>
          <div class="onb-feat">${icon('sparkle', 20)}<span>${t('onb_feat_ai')}</span></div>
          <div class="onb-feat">${icon('chart', 20)}<span>${t('onb_feat_progress')}</span></div>
        </div>
        <button type="button" class="btn btn-primary btn-block" data-next>${t('onb_start')}</button>`;
    } else if (step === 1) {
      inner = `
        <div class="onb-logo">${icon('settings', 34)}</div>
        <div class="onb-title">${t('onb_unit_title')}</div>
        <div class="onb-sub">${t('onb_unit_sub')}</div>
        <div class="onb-units">
          <!-- Bare unit NAME in the bold line and the (kg)/(lb) code down in the
               sub-line: kg_label carries both, and both together wrap inside a
               ~150px card, stranding "(kg)" on a line of its own. -->
          <button type="button" class="onb-unit ${unit === 'kg' ? 'active' : ''}" data-unit="kg"><b>${t('unit_kg_name')}</b><span>${t('onb_unit_metric')} (kg)</span></button>
          <button type="button" class="onb-unit ${unit === 'lb' ? 'active' : ''}" data-unit="lb"><b>${t('unit_lb_name')}</b><span>${t('onb_unit_imperial')} (lb)</span></button>
        </div>
        <button type="button" class="btn btn-primary btn-block" data-next>${t('next')}</button>`;
    } else {
      inner = `
        <div class="onb-logo">${icon('target', 34)}</div>
        <div class="onb-title">${t('onb_goal_title')}</div>
        <div class="onb-sub">${t('onb_goal_sub')}</div>
        <button type="button" class="btn btn-primary btn-block" data-goal>${t('onb_set_goal')}</button>
        <button type="button" class="onb-skip" data-skip>${t('onb_skip')}</button>`;
    }
    gate.innerHTML = `<div class="auth-card onb-card">${inner}<div class="onb-dots">${dots}</div></div>`;

    gate.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => {
      DB.prefs.setUnit(b.dataset.unit);
      render();
    }));
    gate.querySelector('[data-next]')?.addEventListener('click', () => { step += 1; render(); });
    gate.querySelector('[data-goal]')?.addEventListener('click', () => finish(true));
    gate.querySelector('[data-skip]')?.addEventListener('click', () => finish(false));
  };
  // This card is built at boot but the login gate is stacked ON TOP of it, so the
  // language can change after it is already rendered. setUiLanguage() calls this.
  gate.__render = render;
  render();
}

(function init() {
  // Kick off the (large) Supabase SDK download in parallel with the first paint,
  // before anything awaits it — so the login gate / session check isn't blocked
  // on a cold download. Fire-and-forget; bootCloud awaits the same promise.
  try { if (window.Cloud && Cloud.ensureSdk && Cloud.configured && Cloud.configured()) Cloud.ensureSdk(); } catch (_) {}

  const prefs = DB.prefs.get();
  applyTheme(prefs.theme || 'dark');
  applyLang(prefs.lang || 'en');
  navigate('home', {}, { fromPop: true }); // root entry — don't grow history
  setupKeyboardHandling(); // hide the nav + keep the focused field above the keyboard

  // First-run welcome — brand-new installs only. Existing users (any real
  // history) are silently marked onboarded so an update never re-shows it.
  if (!DB.prefs.onboarded()) {
    const st = DB.getAll();
    const hasHistory = (st.sessions && st.sessions.length)
      || (st.cardio && st.cardio.length)
      || (st.foodLogs && Object.keys(st.foodLogs).length)
      || (st.bodyweight && st.bodyweight.length)
      || DB.nutrition.hasTargets();
    if (hasHistory) DB.prefs.setOnboarded();
    else { try { showOnboarding(); } catch (_) {} }
  }

  bootCloud();
  bootCatalog(); // best-effort admin-content pull; works logged-out too

  // Reminders. sync() re-arms the OS alarms (native only, no-op on web);
  // catchUp() surfaces anything that came due earlier today and was not done —
  // which is the ONLY delivery available on web and on any shell built before
  // the notifications plugin landed. Deferred so neither blocks first paint.
  //
  // armNotifications() is here because it was in NEITHER boot path. Its only two
  // callers were the permission sheet's Allow button and the notifications
  // page's redraw, so a normal session armed exactly zero in-app timers: the bar
  // could not appear, and on the web — where there is no OS alarm — that meant
  // reminders simply did not exist. It also runs the v208 migration, which was
  // similarly stranded behind sync()'s native-only bail.
  setTimeout(() => {
    try { armNotifications(); } catch (_) {}
    // reconcile() before sync(), and chained rather than merely ordered: sync()
    // rewrites the armed manifest that reconcile() reads to work out what fired
    // while the app was closed.
    try {
      if (window.Notify) {
        Promise.resolve(Notify.reconcile()).catch(() => {}).then(() => {
          try { Notify.sync(); Notify.catchUp(); } catch (_) {}
        });
      }
    } catch (_) {}
  }, 1500);

  // When the app is re-foregrounded (common on the APK — Android keeps it warm),
  // refresh without a full restart: pull admin content again (so a freshly
  // activated announcement appears) and re-check for a newer web build (shows a
  // tap-to-update banner). Both are best-effort and no-op when nothing changed.
  // Views that derive their date from "now" at RENDER time. If the app sits open
  // across midnight (the common case: left open overnight, opened at the gym next
  // morning) they keep showing — and logging to — YESTERDAY until something forces
  // a re-render. Views with a user-CHOSEN date (session-day, session-run) are
  // deliberately excluded: their date is an explicit choice, not "today".
  // `supplements` and `notifications` belong here too, and their absence was a
  // real bug rather than an omission of tidiness: renderSupplements derives
  // `todayIso` from todayISO() at RENDER time and every tick writes to that
  // captured date, so a phone left open overnight recorded the morning's doses
  // against YESTERDAY. The notifications page reads today's log and today's
  // remaining schedule the same way.
  // One place that acts on a background sync result, so foreground and reconnect
  // can never disagree about what "pulled" or "conflict" means. Quiet by design:
  // no toast on success — this fires whenever the app is opened, and "Synced"
  // every time is noise. Only a conflict, which needs an answer, speaks up.
  async function syncResume() {
    if (!window.Cloud || !Cloud.resume) return;
    let r; try { r = await Cloud.resume(); } catch (_) { return; }
    if (r === 'pulled') refreshAfterSync();
    else if (r === 'conflict') showConflictDialog();
  }
  // "Sync resumes when you reconnect" — app.js has promised this to the user in
  // both languages since the offline grace path was written, and NOTHING
  // implemented it: there was no online listener anywhere in the repo. Now there
  // is, so the sentence is true.
  window.addEventListener('online', () => { try { syncResume(); } catch (_) {} });

  const DATE_DERIVED_VIEWS = ['home', 'food', 'foodlog', 'supplements', 'notifications'];
  let __lastActiveDay = todayISO();

  // GOING AWAY is the other half of the guided-run auto-save. Android can kill a
  // backgrounded WebView without ever firing blur on the focused field, so the
  // last number typed would die with it. Blurring on the way OUT runs the same
  // commit handler while the page is still alive. This must sit before the
  // visible-only guard below, because it fires precisely when NOT visible.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') return;
    try {
      const ae = document.activeElement;
      if (ae && typeof ae.blur === 'function' && ae.closest?.('.run-set-row')) ae.blur();
    } catch (_) {}
  });

  // COMING BACK TO THE APP IS A SYNC POINT. It was not one: Cloud.bootSync() ran
  // exactly once per COLD start, and this is a live-URL Capacitor shell, so a
  // phone that is merely backgrounded never resynced at all. Everything logged
  // since the last cold start sat on the device — which is the "saving does not
  // reach the cloud" half of the report — and a conflict could not be discovered
  // either, because discovering one requires a pull.
  //
  // Cloud.resume() is throttled (20s) and returns early when offline, so this is
  // safe to hang off an event that fires on every glance at the phone.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    try { syncResume(); } catch (_) {}
    try { bootCatalog(); } catch (_) {}
    // Re-check on foreground: a reminder may have come due while the app slept.
    //
    // sync() as well as catchUp(), and not only for tidiness. When the plugin
    // re-arms a DAILY repeat after it fires, it uses a plain non-wakeup alarm
    // (TimedNotificationPublisher: `set(AlarmManager.RTC, …)` — RTC, not
    // RTC_WAKEUP, and allowWhileIdle dropped), which Doze can defer a long way.
    // Only the INITIAL arming goes through the wakeup-capable path. Re-syncing
    // on every foreground keeps every reminder on that first-fire path, so the
    // degraded repeat is rarely the one that has to deliver.
    //
    // It is also what keeps the dated alarms alive: they are one-shots across a
    // 7-day horizon, so every foreground pushes the horizon back out and re-bakes
    // TODAY's text against the user's current numbers.
    //
    // reconcile() runs FIRST, and must: sync() rewrites the armed manifest, and
    // reconcile reads that manifest to work out which alarms fired while the app
    // was dead. Reversed, every one of those deliveries is lost from the log.
    try { armNotifications(); } catch (_) {}
    try {
      if (window.Notify) {
        Promise.resolve(Notify.reconcile()).catch(() => {}).then(() => {
          try { Notify.sync(); Notify.catchUp(); } catch (_) {}
        });
      }
    } catch (_) {}
    try { if (window.VaultUpdate && VaultUpdate.checkWeb) VaultUpdate.checkWeb(); } catch (_) {}
    // Re-resolve the calendar day on every foreground.
    try {
      const now = todayISO();
      if (now !== __lastActiveDay) {
        __lastActiveDay = now;
        if (DATE_DERIVED_VIEWS.indexOf(currentView) !== -1) renderView(currentView);
      }
    } catch (_) {}
  });
})();
