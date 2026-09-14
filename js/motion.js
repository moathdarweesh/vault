/* THE VAULT — motion primitives.
 *
 * From APPLY-motion.md. Loads BEFORE app.js (contract 1 fixes the order) and
 * publishes `window.VltMotion`; it reads no other module, so it can sit
 * anywhere ahead of app.js.
 *
 * THE RULE ABOVE ALL OTHERS: motion EXPLAINS, it does not decorate. Every
 * function here says one thing — where a thing came from, what a touch did,
 * where something went. A helper that says nothing does not belong in this file.
 *
 * ⚠️ THE SPEC'S CLASS NAMES ARE NOT THIS APP'S CLASS NAMES. Every selector in
 * the handoff (.screen, .tab-indicator, .btn-secondary, .row-tappable,
 * .toggle-knob, .sheet, .bar-fill) matched ZERO rules in styles.css — the real
 * vocabulary is .view, .nav-btn, .btn-ghost, .data-row, .ntfs-switch, .modal
 * and .run-progress-fill. The spec's VALUES and RULES are kept exactly; only
 * the names are translated. Pasting it verbatim would have shipped ~120 lines
 * of CSS that style nothing and a module nothing calls.
 */
window.VltMotion = (function () {
  'use strict';

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Read a duration token so JS timing can never drift from the stylesheet.
     Under reduced motion the tokens are 0ms, so every caller degrades for free
     instead of each one testing the media query itself. */
  function token(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? (/\bs$/.test(v) && !/ms$/.test(v) ? n * 1000 : n) : fallback;
  }

  /* ── STAGGERED ENTRY ──────────────────────────────────────────────────────
     First render of a screen only. `data-entered` is the guard and it lives on
     the ELEMENT, so a re-render that reuses the node cannot replay it — which
     is the whole difference between "this screen just arrived" and "this screen
     was always here".

     The cap is expressed in CSS as calc(min(var(--i), 5) * 140ms): past the
     sixth child everything lands together. Without a cap a twenty-row list
     makes the reader wait three seconds for a list that is already there. */
  function stagger(el) {
    if (!el || el.dataset.entered) return;
    el.dataset.entered = '1';
    if (reduced()) return;            // nothing to animate; the guard is still set
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) kids[i].style.setProperty('--i', i);
    el.classList.add('enter');

    /* ⚠️ THE CLEANUP MUST NOT DEPEND ON `animationend`. Measured: the class
       survived and a LATER re-render of the same screen replayed the whole
       stagger at once, every child at delay 0 — because the children are
       replaced by the re-render and the new ones still match `.enter > *`.

       Two ways animationend never arrives: a hidden or backgrounded document
       (no frames, so no animation events at all), and a re-render that removes
       the animating children before they finish — which is ordinary here, since
       every save re-renders the view. A timer fires in both cases.

       The window is the real one: the last child starts at min(n-1,5) steps and
       runs for one duration. */
    const steps = Math.min(Math.max(kids.length - 1, 0), 5);
    const total = steps * token('--stagger', 140) + token('--dur-base', 400) + 120;
    const done = () => {
      el.classList.remove('enter');
      const now = el.children;
      for (let i = 0; i < now.length; i++) now[i].style.removeProperty('--i');
    };
    clearTimeout(el.__vltEnter);
    el.__vltEnter = setTimeout(done, total);
  }

  /* ── COUNT UP ─────────────────────────────────────────────────────────────
     requestAnimationFrame, never setInterval: a timer drifts and keeps firing
     in a background tab, and this number is on screen for under a second.

     easeInOutQuart matches --ease-inout, so a counter and the bar beside it
     arrive together instead of one overtaking the other. */
  function count(node, from, to, opts) {
    opts = opts || {};
    if (!node) return;
    const fmt = opts.fmt || ((n) => String(Math.round(n)));
    const dur = reduced() ? 0 : (opts.dur || 900);
    if (!dur) { node.textContent = fmt(to); return; }

    // A second call on the same node must not race the first.
    if (node.__vltCount) cancelAnimationFrame(node.__vltCount);
    const t0 = performance.now();
    const tick = (t) => {
      let p = Math.min(1, (t - t0) / dur);
      p = p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
      node.textContent = fmt(from + (to - from) * p);
      if (p < 1) node.__vltCount = requestAnimationFrame(tick);
      else node.__vltCount = null;
    };
    node.__vltCount = requestAnimationFrame(tick);
  }

  /* A progress bar is scaleX only — never width, which lays out. `--p` is a
     0..1 ratio and the CSS owns the duration and the origin (right, in RTL). */
  function bar(node, p) {
    if (!node) return;
    node.style.setProperty('--p', String(Math.max(0, Math.min(1, Number(p) || 0))));
  }

  /* ── ACHIEVEMENT PULSE ────────────────────────────────────────────────────
     The glyph pops and a ring leaves. `wrap` must be position:relative — the
     ring is absolutely placed inside it. The ring removes itself; it is the one
     element here that is created at runtime, so leaving it behind would
     accumulate one node per workout saved. */
  function pulse(wrap) {
    if (!wrap || reduced()) return;
    // getElementsByTagName, not querySelector('svg'): contract 15's scanner reads
    // a BARE word inside querySelector as an id, because this app's own $()
    // helper accepts $('modal-root') meaning #modal-root. The ambiguity is real
    // and it is mine, not the checker's — so say TAG and mean tag.
    const svg = wrap.getElementsByTagName('svg')[0];
    if (svg) {
      svg.classList.remove('zap-pop');
      void svg.offsetWidth;                     // restart the animation
      svg.classList.add('zap-pop');
    }
    const ring = document.createElement('div');
    ring.className = 'pulse-ring';
    wrap.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    // Belt to that brace: if the animation never fires (display:none, a paused
    // document), the ring would live forever.
    setTimeout(() => ring.remove(), 1200);
  }

  /* ── NUMBER FLIP ──────────────────────────────────────────────────────────
     The old digit leaves upward and the new arrives from below. ONLY for a
     number the user just changed — never for one a background sync moved,
     which must simply be true (rule 10). */
  function numFlip(node, txt) {
    if (!node) return;
    txt = String(txt);
    if (reduced() || node.textContent === txt) { node.textContent = txt; return; }
    const old = node.textContent;
    node.classList.add('numflip');
    // textContent on both spans: this is user data and must never be parsed.
    const a = document.createElement('span'); a.className = 'old'; a.textContent = old;
    const b = document.createElement('span'); b.className = 'new'; b.textContent = txt;
    node.textContent = '';
    node.append(a, b);
    const settle = () => {
      node.classList.remove('numflip');
      node.textContent = txt;
    };
    b.addEventListener('animationend', settle, { once: true });
    setTimeout(settle, token('--dur-base', 400) + 260);
  }

  /* ── SHEETS ───────────────────────────────────────────────────────────────
     Drag-to-dismiss on the app's real sheet (.modal inside .modal-overlay).
     It does NOT open or close anything itself — openModal/closeModal own that,
     and a second owner would be two sources of truth for what is on screen.
     This only reports "the user threw it down past the threshold".

     Downward only: an upward drag is a scroll gesture, and the sheets in this
     app scroll. It also refuses to start inside a scrolled region, so dragging
     a long list does not close the sheet under it. */
  function dragToDismiss(el, onDismiss) {
    if (!el || typeof onDismiss !== 'function') return;
    const THRESHOLD = 120;                      // the spec's number
    let y0 = 0, dy = 0, down = false, id = null;

    const scrolledAncestor = (node) => {
      for (let n = node; n && n !== el; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return true;
      }
      return el.scrollTop > 0;
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // A control is being pressed, not the sheet dragged.
      if (e.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
      if (scrolledAncestor(e.target)) return;
      down = true; id = e.pointerId; y0 = e.clientY; dy = 0;
    });

    el.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== id) return;
      const d = e.clientY - y0;
      if (d <= 0) { dy = 0; el.style.transform = ''; return; }
      if (dy === 0 && d < 6) return;            // let a tap stay a tap
      if (dy === 0) {
        el.classList.add('dragging');
        // setPointerCapture throws on a pointer the element does not own — a
        // synthetic event, or a pointer already released. Unguarded it aborted
        // the rest of this handler, leaving `.dragging` on with no transform:
        // a sheet with its animation suspended and nothing moving it.
        try { el.setPointerCapture(id); } catch (_) {}
      }
      dy = d;
      el.style.transform = 'translateY(' + dy + 'px)';
    });

    const release = (e) => {
      if (!down || (e && e.pointerId !== id)) return;
      down = false;
      if (dy > THRESHOLD) {
        el.classList.remove('dragging');
        el.style.transform = '';
        onDismiss();
      } else if (dy > 0) {
        /* ⚠️ DO NOT HAND IT BACK TO THE BARE RULE. `.dragging` suspends the
           entrance with `animation: none`; simply dropping that class RESTARTS
           sheetUp — the same restart idiom pulse() uses on purpose — so a drag
           the user abandoned replayed the whole 400ms entrance from off-screen.
           `.settling` keeps the animation suspended and springs the inline
           transform back instead. Dropped on a TIMER: transitionend does not
           fire in a hidden document, and a sheet stuck in .settling could never
           be dragged again. */
        el.classList.remove('dragging');
        el.classList.add('settling');
        el.style.transform = '';
        clearTimeout(el.__vltSettle);
        el.__vltSettle = setTimeout(() => {
          el.classList.remove('settling');
        }, token('--dur-fast', 260) + 60);
      } else {
        el.classList.remove('dragging');
        el.style.transform = '';
      }
      dy = 0; id = null;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  /* One slide at a time, and its teardown travels WITH it. `__slideDone` is the
     pending cleanup; flushSlide() runs it now rather than dropping it.

     There is much less to tear down than there was: the outgoing view is no
     longer pinned or animated, so a lost cleanup can strand nothing but a
     spent class on the view you are looking at. The discipline is kept
     anyway — the class has to come off, or the slide cannot play again. */
  let __slideTimer = null;
  let __slideDone = null;
  function flushSlide() {
    clearTimeout(__slideTimer);
    __slideTimer = null;
    if (__slideDone) __slideDone();
  }
  /* Everything a slide puts on a node, taken off in one place — so the teardown
     and the defensive sweep can never disagree about what a slide leaves. */
  function clearSlideMarks(el) {
    if (!el) return;
    el.classList.remove('vlt-in');
    el.style.removeProperty('--dir');
    // removeProperty leaves an empty style="" behind. Strip it, so a view that
    // carries nothing cannot be matched by a [style] selector later.
    if (!el.getAttribute('style')) el.removeAttribute('style');
  }

  /* ── TAB SWITCHING ───────────────────────────────────────────────────────
     CALL THIS BEFORE THE CALLER TOGGLES `.active`, and that is now the ONLY
     ordering rule left: navigate() resolves the leaving view with
     `document.querySelector('.view.active')`, so after the toggle that lookup
     returns the ARRIVING view, `from === to`, and no slide runs at all.
     Nothing is measured here and nothing is pinned any more — v342 deleted the
     ghost, so there is no rectangle to read and no geometry to restore.

     `dir` is +1 or -1 and already carries the RTL flip, so one keyframe pair
     serves both directions and both writing systems.

     The class and the inline `--dir` are undone by a TIMER, not by
     animationend: animation events do not fire in a hidden or backgrounded
     document, and a view left wearing `vlt-in` would replay the slide the next
     time it is shown by a navigation that is not a tab switch. */
  function switchTab(o) {
    o = o || {};
    const from = o.from, to = o.to, btn = o.btn;
    if (!to) return;
    const dir = (o.dir < 0 ? -1 : 1) * (document.body.dir === 'rtl' ? -1 : 1);

    if (btn) {
      btn.classList.add('vlt-pulse');
      setTimeout(() => btn.classList.remove('vlt-pulse'), 500);
    }
    if (reduced() || !from || from === to) return;

    /* ⚠️ ONLY THE ARRIVING SCREEN MOVES. THE ONE YOU LEFT IS NOT SHOWN AT ALL.

       v340 slid the outgoing view out as a GHOST — pinned position:fixed at the
       rectangle it already held, drifting 22% and fading to .4. Measured live at
       mid-slide: the ghost sat at z-index 1 with opacity 0.7 while the arriving
       view was z-index auto and TRANSPARENT, so the screen you were leaving was
       painted ON TOP of the screen you were opening, and you read both at once.
       The owner named it exactly: «بيضل فيه أثر من الصفحة الأولى».

       Stacking the ghost underneath would have been the iOS answer, but the
       instruction was «دون أثر الصفحة التي قبل الانتقال» — so the ghost is gone,
       not re-ordered. The outgoing view loses `.active` one line later in
       navigate() and simply stops being displayed; the arriving view slides in
       over the app`s own --bg-grad.

       What this deletes is worth as much as what it fixes: with nothing pinned,
       there is no rectangle to read, no inline geometry to restore, and no
       cleanup that can be abandoned — the v341 stranded-ghost class of bug has
       no surface left to happen on. */
    flushSlide();

    // A view must never enter a slide still wearing the last one.
    for (const v of document.querySelectorAll('.view.vlt-in')) clearSlideMarks(v);

    to.style.setProperty('--dir', String(dir));
    to.classList.add('vlt-in');

    const ms = token('--dur-slide', 500) + 50 + 90;
    // The cleanup is kept as a CLOSURE beside its timer, so the next slide can
    // run it instead of merely cancelling it.
    __slideDone = () => {
      __slideDone = null;
      clearSlideMarks(to);
    };
    clearTimeout(__slideTimer);
    __slideTimer = setTimeout(() => { if (__slideDone) __slideDone(); }, ms);
  }

  return { stagger, count, bar, pulse, numFlip, dragToDismiss, switchTab, reduced, token };
})();
