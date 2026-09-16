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
  function stagger(el, dir) {
    if (!el || el.dataset.entered) return;
    el.dataset.entered = '1';
    if (reduced()) return;            // nothing to animate; the guard is still set

    /* A TAB SWITCH ARRIVES FROM THE SIDE; EVERY OTHER ARRIVAL RISES.

       `dir` is the tab ORDER (+1 later, -1 earlier) and carries no writing
       direction of its own, so the RTL flip is applied here — the last place
       before it becomes a physical translate. --ey drops to a token lift
       because the motion is sideways now; keeping the full 24px would make
       each card travel a diagonal nobody asked for.

       This replaced a full-frame slide in v346: a frame can only slide in
       from off-screen, and with no outgoing view behind it that left the
       screen empty for half a second. */
    /* ⚠️ WRITTEN EVERY TIME, NEVER LEFT TO A PREVIOUS ARRIVAL. The host is a
       PERSISTENT node — the same `.view` element for the life of the app — so
       setting these only when `dir` is truthy left the last tab switch`s
       sideways offset on it, and the next directionless arrival at that view
       replayed a direction it had not moved in. */
    const d = dir ? (dir < 0 ? -1 : 1) * (document.body.dir === 'rtl' ? -1 : 1) : 0;
    el.style.setProperty('--ex', d * 26 + 'px');
    el.style.setProperty('--ey', d ? '6px' : '24px');
    el.style.setProperty('--step', d ? 'var(--stagger-fast)' : 'var(--stagger)');

    /* PERSISTENT CHROME IS SKIPPED, NOT JUST EXEMPTED. The CSS above refuses to
       animate `.vault-bar` / `.detail-top`, but they are still CHILDREN — and
       numbering them would spend index 0 on something that does not move, so
       the first real card would start a whole step late. That is a new wait,
       in the change whose entire purpose was to stop the screen looking late. */
    const kids = el.children;
    let n = 0;
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].classList.contains('vault-bar') || kids[i].classList.contains('detail-top')) {
        kids[i].style.removeProperty('--i');
        continue;
      }
      kids[i].style.setProperty('--i', n++);
    }
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
    // The window is the one the cards actually use: the cap, the step the host
    // chose, and one duration.
    const steps = Math.min(Math.max(n - 1, 0), 5);
    const step = d ? token('--stagger-fast', 60) : token('--stagger', 140);
    const total = steps * step + token('--dur-base', 400) + 120;
    const done = () => {
      el.classList.remove('enter');
      el.style.removeProperty('--ex');
      el.style.removeProperty('--ey');
      el.style.removeProperty('--step');
      if (!el.getAttribute('style')) el.removeAttribute('style');
      const now = el.children;
      for (let i = 0; i < now.length; i++) now[i].style.removeProperty('--i');
    };
    clearTimeout(el.__vltEnter);
    el.__vltEnter = setTimeout(done, total);
  }

  /* ── COUNT UP ─────────────────────────────────────────────────────────────
     requestAnimationFrame, never setInterval: a timer drifts and keeps firing
     in a background tab, and this number is on screen for under a second.

  /* ── 2, 5 and 6 of APPLY-motion.md WERE BUILT AND NEVER CALLED ───────────
     count() (number count-up), bar() (a progress fill), pulse() (the
     achievement ring) and numFlip() were exported here and reached by nothing
     — measured: zero `VltMotion.count|bar|pulse|numFlip` anywhere in the ten
     scripts or the four pages, and .vlt-bar-fill was never applied by ANY file,
     so it was unreachable even from bar(). Their CSS went with them (styles.css
     sections 2, 5 and 6, and four @keyframes). The section numbers that survive
     are left as they were rather than renumbered, so this note explains the gap.

     They are recoverable from git if the spec is ever finished; what is not
     recoverable is the hour someone spends deciding whether an uncalled export
     is load-bearing. */

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

  /* ── TAB SWITCHING ───────────────────────────────────────────────────────

     THIS ONLY ANSWERS THE TOUCH NOW. The screen change itself is the child
     stagger that renderView arms, with the tab direction handed to it — see
     stagger() above and block 1 of the motion CSS.

     ⚠️ THE FRAME USED TO SLIDE, AND THAT IS WHAT MADE THE SCREEN GO BLACK.
     v340 slid the arriving `.view` in from translateX(100%) over an outgoing
     view pinned behind it; v342 deleted that ghost because it painted ON TOP
     of the arriving screen and the owner read both at once. What was left was
     a frame sliding in over nothing: measured on a real home -> food switch,
     50ms of delay with the new screen entirely off-screen and the old one
     already display:none, and full coverage only at 550ms. A frame can only
     arrive from off-screen, so the void is not a bug in the slide — it IS the
     slide. Moving the cards instead of the frame is the only shape that keeps
     a sense of direction without ever displacing anything off the screen.

     What that deleted: the pin, the rectangle read, the ghost class, the
     slide keyframes, the per-slide cleanup closure and its timer. The v341
     lesson those existed to carry is worth keeping even though its code is
     gone — ONE TIMER FOR N CONCURRENT ELEMENTS IS NOT A DEBOUNCE: cancelling
     a shared timer does not cancel the work, it abandons it. Anything that
     schedules per-element teardown here must keep the cleanup as a closure
     beside its timer and RUN it rather than drop it. */
  /* CALL OFF AN ENTRANCE THAT HAS BEEN OVERTAKEN.

     ⚠️ A RE-RENDER INSIDE THE STAGGER WINDOW REPLAYS IT AT DELAY 0. The class
     lives on the host, which SURVIVES an innerHTML rewrite of its own contents
     — so the brand-new children match `.enter > *`, have no `--i`, and all
     animate together from 26px and opacity 0. Every save in this app re-renders
     the current view, and after v346 that is reachable right after a tab tap.
     The entrance is moot once the content it was introducing has been replaced.

     Same shape as the animationend lesson above: the cleanup cannot be left to
     the timer alone, because the thing being cleaned up is gone before it. */
  function cancelStagger(el) {
    if (!el || !el.classList.contains('enter')) return;
    clearTimeout(el.__vltEnter);
    el.classList.remove('enter');
    for (const k of ['--ex', '--ey', '--step']) el.style.removeProperty(k);
    if (!el.getAttribute('style')) el.removeAttribute('style');
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) kids[i].style.removeProperty('--i');
  }

  function switchTab(o) {
    o = o || {};
    const btn = o.btn;
    if (!btn) return;
    // 500ms --ease-back, so the tab is still answering while the cards land.
    btn.classList.add('vlt-pulse');
    clearTimeout(btn.__vltPulse);
    btn.__vltPulse = setTimeout(() => btn.classList.remove('vlt-pulse'), 500);
  }
  return { stagger, cancelStagger, dragToDismiss, switchTab, reduced, token };
})();
