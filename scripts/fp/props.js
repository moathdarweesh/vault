// The computed-style properties the net records, in bands.
//
// The full ~340 are noise: -webkit-* aliases, values derived from the box, and
// dozens that no defect in this project has ever lived in. Every band below is
// here because a RECORDED defect lives in it, and the scar is named — so the
// next person can argue with the list instead of guessing at it.
'use strict';

const BANDS = {
  /* --text-muted vs --text-mute painting at full strength (v314); color:transparent
     hiding only one of two duotone masses (v337); accent-color painting only the
     CHECKED box (v330); a <button> with no color measuring 2.23:1 (v200). */
  ink: ['color', 'background-color', '-webkit-text-fill-color', 'opacity', 'fill', 'stroke', 'accent-color'],

  /* Zeroing --card-border drops the edge from nine components; `.cx-list > :first-child`
     takes off ONLY the top edge and leaves a box open (v328); the 2:1 corner law;
     v340's three radius fixes. */
  edge: ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
         'border-top-color', 'border-bottom-color',
         'border-top-left-radius', 'border-top-right-radius',
         'border-bottom-left-radius', 'border-bottom-right-radius'],

  /* --elev-1 is the ONLY edge --surface-1 has on --bg at ~1.08:1 (v318); the nav's
     blur, measured and then deleted permanently (v341). */
  elevation: ['box-shadow', 'backdrop-filter'],

  /* The 11px floor (24 declarations were under it); .page-title 26 not 32;
     text-align:start never left; inputs >= 16px or iOS focus-zoom returns. */
  type: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
         'text-transform', 'text-align'],

  /* [hidden] losing to an author display — TWICE (v332); .cx-stack label stacking a
     tick row to 71px (v329); .vault-bar space-between with three children (v314);
     white-space:normal without height:auto spilling a button (v316). */
  flow: ['display', 'position', 'visibility', 'flex-direction', 'justify-content',
         'align-items', 'flex-wrap', 'gap', 'white-space'],

  /* A spent toast staying focusable (v331); .is-out corpses eating taps (v341);
     .view.vlt-ghost at (0,2,0) beating .view.active (v341); and the big one —
     a CHANGED animation-name starts a NEW animation (v342). */
  motion: ['pointer-events', 'overflow', 'z-index', 'transform', 'animation-name', 'transition-property'],
};

/* Stage 1 records a twelve-property subset: enough to catch the defect classes the
   first refactor steps can actually cause (a moved rule, a lost token, a changed
   display), small enough that the first baseline is readable by a human. The full
   set switches on at stage 2. */
const STAGE1 = [
  'color', 'background-color', 'opacity',
  'border-top-width', 'border-top-color',
  'border-top-left-radius', 'border-bottom-right-radius',
  'font-size', 'font-weight', 'line-height',
  'display', 'position', 'pointer-events',
];

const ALL = Object.values(BANDS).flat();

/* Fonts are blocked by the fence (correctly — a net that reaches the network is
   not deterministic), so the app under test renders in system-ui, which differs
   between Windows, macOS and the CI runner. Anything whose value depends on the
   FACE is therefore excluded from the committed CI baseline and kept only in the
   local before/after lane. That is the honest line between "the same machine ten
   minutes apart" and "any machine, any month". */
const FONT_DEPENDENT = ['font-family', 'line-height', 'letter-spacing'];

module.exports = { BANDS, ALL, STAGE1, FONT_DEPENDENT };
