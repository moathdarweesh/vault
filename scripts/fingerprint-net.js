#!/usr/bin/env node
// THE FINGERPRINT NET — prove a refactor changed nothing.
//
//   node scripts/fingerprint-net.js matrix --tag before     # stage 2: the 20 views, ar/en × dark/light × 375/412
//   node scripts/fingerprint-net.js modals --tag before     # stage 3: every sheet and dialog, over a seeded fixture
//   …do the refactor step…
//   node scripts/fingerprint-net.js matrix --tag after
//   node scripts/fingerprint-net.js diff before after
//
//   (`capture` still records ONE cell — ar/dark/375 by default — for a quick look.)
//
// ⚠️ DELIBERATELY NOT NAMED test-*.js. scripts/test-all.js picks suites up by
// that filename pattern; this is a tool, not a suite, and it must never run as
// part of `npm test`. The CI smoke lane is a separate, small scripts/test-fingerprint.js.
//
// WHY THIS EXISTS. 0.29% of js/app.js is under direct unit assertion — 38 lines
// of 12,910 — and no test in this project looks at design. Every serious defect
// this month was found by measuring the rendered DOM by hand. This project has
// twice proved a refactor inert that way (504 computed-style fingerprints in
// v262, 110 in v314) and both times threw the tooling away afterwards. This is
// that technique, kept.
//
// THE ONE DECISION THAT MAKES IT WORKABLE: the record is KEYED ON STRUCTURAL
// POSITION and DIFFED ON FIELDS. If the key carried the class name, a class
// rename — the single most likely diff a maintainability refactor produces —
// would re-key every element and report N deleted / N added. That is the
// 500-diffs-nobody-reads failure, and it is a choice, not a fact.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { start, fence, ROOT } = require('./fp/server.js');
const VIEWS = require('./fp/views.js');
const PROPS = require('./fp/props.js');
const MODALS = require('./fp/modals.js');
const { seedFixture } = require('./fp/fixture.js');

const OUT = path.join(ROOT, '.fpnet');

/* Frozen instant. A UTC+ timezone ON PURPOSE: `new Date('2026-09-13')` parsing as
   UTC and returning the previous day is the bug class this codebase has hit five
   times, so the net stands where it fires. */
const FROZEN = new Date('2026-09-15T09:00:00.000Z');
const TZ = 'Asia/Riyadh';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, def) => {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : args[i + 1];
};

// ── the page-side capture ────────────────────────────────────────────────────
// Serialised into the browser. Everything it needs is passed in; it closes over
// nothing from Node.
function pageCapture(opts) {
  const { props, rootSel } = opts;
  const root = document.querySelector(rootSel);
  if (!root) return { error: 'no root for ' + rootSel };

  const els = [root, ...root.querySelectorAll('*')];

  // ⚠️ TWO PASSES, NEVER INTERLEAVED. Reading a rect after a style read forces a
  // layout per element and turns seconds into minutes.
  const rects = els.map((el) => el.getBoundingClientRect());
  const styles = els.map((el) => getComputedStyle(el));
  const rootRect = rects[0];

  // Generated ids are renamed in first-seen order rather than blanked: a flat
  // <id> would hide a REORDERING, which is a real defect class here (v331).
  const idMap = new Map();
  // Three id shapes reach the DOM: uid()'s `id-<base36>-<base36>`, crypto.randomUUID(),
  // and a bare base36 token from older paths (a notification log entry is one).
  // The bare one is matched only when it mixes letters AND digits and is 11-14
  // long, so ordinary words are never renamed.
  const ID_RE = /\b(?:id-[a-z0-9]+-[a-z0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=[a-z0-9]{11,14}\b)(?=[a-z0-9]*[0-9])(?=[a-z0-9]*[a-z])[a-z0-9]{11,14})\b/g;
  const maskIds = (s) => String(s).replace(ID_RE, (m) => {
    if (!idMap.has(m)) idMap.set(m, '<id:' + (idMap.size + 1) + '>');
    return idMap.get(m);
  });
  // Any ISO value CARRYING A TIME, and any wall clock. H:MM is NOT masked —
  // v347 made 4:59 content, and a refactor that breaks formatDuration must show.
  const maskTime = (s) => String(s)
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<ts>')
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, '<clock>');
  const clean = (s) => maskTime(maskIds(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()));

  // An identity matrix and `none` are the same thing; recording both makes every
  // run where a transition happened to be idle differ from one where it was not.
  const normTransform = (t) => {
    if (!t || t === 'none') return 'none';
    const m = t.match(/matrix\(([^)]+)\)/);
    if (!m) return t;
    const n = m[1].split(',').map((x) => Math.round(parseFloat(x) * 100) / 100);
    return n.join(',') === '1,0,0,1,0,0' ? 'none' : 'matrix(' + n.join(',') + ')';
  };

  const ATTRS = ['role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-expanded',
    'aria-selected', 'aria-controls', 'aria-current', 'aria-hidden', 'aria-live', 'aria-disabled',
    'tabindex', 'disabled', 'type', 'checked', 'for', 'alt', 'title', 'placeholder', 'inputmode',
    'dir', 'lang', 'hidden', 'open'];

  const pathOf = (el) => {
    const parts = [];
    let n = el;
    while (n && n !== root) {
      const p = n.parentElement;
      if (!p) break;
      const same = [...p.children].filter((c) => c.tagName === n.tagName);
      parts.unshift(n.tagName.toLowerCase() + '[' + same.indexOf(n) + ']');
      n = p;
    }
    return parts.join('/') || ':root';
  };

  // A short, readable accessible-name algorithm — not the full spec. The point is
  // that the DERIVED form is what the defects were about: v324's aria-label
  // REPLACING an element's whole text, and WCAG 2.5.3's label-in-name.
  const accNameOf = (el) => {
    const al = el.getAttribute('aria-label');
    if (al) return clean(al);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ');
      if (t.trim()) return clean(t);
    }
    const own = clean(el.textContent);
    if (own) return own;
    return clean(el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('placeholder') || '');
  };

  const out = [];
  for (let i = 0; i < els.length; i++) {
    const el = els[i], r = rects[i], cs = styles[i];
    const rec = {
      p: pathOf(el),
      tag: el.tagName.toLowerCase(),
      id: el.id ? clean(el.id) : '',
      cls: [...el.classList].sort().join(' '),
      // Direct text nodes ONLY. innerText would make every ancestor repeat its
      // descendants and turn one changed word into a diff on every ancestor.
      txt: clean([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ')),
      box: [Math.round((r.left - rootRect.left) * 2) / 2, Math.round((r.top - rootRect.top) * 2) / 2,
            Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2],
      s: {},
    };
    for (const a of ATTRS) if (el.hasAttribute(a)) rec['@' + a] = clean(el.getAttribute(a));
    for (const a of el.attributes) if (a.name.startsWith('data-')) rec['@' + a.name] = clean(a.value);
    const an = accNameOf(el);
    if (an) { rec.acc = an; rec.linkInName = rec.txt ? an.indexOf(rec.txt) !== -1 : null; }
    for (const pr of props) {
      let v = cs.getPropertyValue(pr);
      if (pr === 'transform') v = normTransform(v);
      rec.s[pr] = v;
    }
    // Cheap, proven: a parent that cannot hold its child is this owner's most
    // frequent complaint, and both existing browser suites already assert it inline.
    if (el.scrollWidth > el.clientWidth + 1) rec.overflowX = true;
    out.push(rec);
  }

  // Per-cell, once.
  const visible = root.innerText || '';
  return {
    els: out,
    n: out.length,
    // t() returns the KEY when a string is missing. Contract 5 proves a key
    // exists in both dictionaries; it cannot prove the rendered screen reached
    // it. v332: "The key still existed in both dictionaries, so contract 5
    // stayed green. Only reading the string catches it."
    rawKeys: (visible.match(/\b(?:cx|rec|sl|run|sd|auth|pi|rest|cardio|ntf|sc|tab|nav|notif)_[a-z0-9_]+\b/g) || []).slice(0, 8),
    // "A wrong key name returns '' and the icon vanishes silently, with no
    // error — this actually shipped once."
    emptySvg: [...root.querySelectorAll('svg')].filter((s) => !s.innerHTML.trim()).length,
    textLen: visible.trim().length,
    childCount: root.children.length,
    anims: (root.getAnimations ? root.getAnimations({ subtree: true }) : [])
      .map((a) => [a.animationName || (a.transitionProperty || '?'),
                   a.effect.getTiming().duration, a.effect.getTiming().delay].join(':')).sort(),
  };
}

// ── capture ──────────────────────────────────────────────────────────────────
// ── the shared pieces ────────────────────────────────────────────────────────
// One browser context = one (lang, theme, width). Views and sheets share it.
async function openContext(browser, origin, { lang, theme, width }) {
  const ctx = await browser.newContext({
    viewport: { width, height: 812 },
    // ⚠️ REDUCED MOTION IS THE DETERMINISM GUARANTEE, not a shortcut. Under it
    // the splash is never mounted, setupEmber() returns before it creates its
    // element, and the global clamp zeroes every duration AND (since v337)
    // every delay. There is no animation to be mid-way through, so the
    // fingerprint is a function of the DOM and the CSS alone.
    reducedMotion: 'reduce',
    colorScheme: theme === 'light' ? 'light' : 'dark',
    timezoneId: TZ,
    locale: lang === 'ar' ? 'ar-SA' : 'en-US',
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: FROZEN });
  const guard = await fence(page);

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  // Freeze randomness and PROVE nothing reached for it during a capture —
  // that turns "why did this flake" into an answer.
  await page.addInitScript(() => {
    let seed = 42;
    window.__fpRandomCalls = 0;
    Math.random = function () {
      window.__fpRandomCalls++;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  });

  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && window.__vltReady, null, { timeout: 15000 });

  /* ⚠️ ASSERT THE PRECONDITION; NEVER ASSUME IT. rAF, animationend and
     transitionend do not fire in a hidden or throttled document, and
     document.timeline freezes — so a net that waited on one would record the
     bug as the baseline. It does not degrade to a weaker check; it aborts.

     ⚠️ AND IT PROBES rAF DIRECTLY, NOT THE FRAME RATE. The first version asked
     whether document.timeline advanced more than 100ms over a 200ms wait. That
     is a frame-RATE question, and it has almost no margin: measured on an idle
     page the delta is 183–200ms, so a compositor stall of just over 100ms — an
     ordinary thing on a loaded CI runner — reads as "throttled" and aborts a
     healthy eight-context run. It failed CI exactly that way on the third
     context, with the first two green. What settle() actually depends on is
     that a rAF callback FIRES; that is what is asked now, raced on the NODE
     side (an in-page timer would be the faked clock racing itself), and
     retried a bounded number of times because a stall is transient and a
     hidden document is not. */
  for (let attempt = 1; ; attempt++) {
    await page.bringToFront();
    const visible = await page.evaluate(() => document.visibilityState);
    const rafFired = visible === 'visible' && await Promise.race([
      page.evaluate(() => new Promise((res) => requestAnimationFrame(() => res(true)))),
      new Promise((res) => setTimeout(() => res(false), 2000)),
    ]);
    if (rafFired) break;
    if (attempt >= 3) {
      throw new Error('fp: this document is hidden or throttled after ' + attempt + ' attempts (visibility=' + visible + ') — every timing assertion below would be vacuous');
    }
    await page.waitForTimeout(500);
  }

  await page.evaluate(({ lang, theme }) => {
    document.getElementById('splash')?.remove();
    try { closeModal(); } catch (_) {}
    try { hideAuthGate(); } catch (_) {}
    document.getElementById('onboard-gate')?.remove();
    DB.prefs.setOnboarded(); DB.prefs.setLang(lang); DB.prefs.setTheme(theme);
    applyLang(lang); applyTheme(theme);
  }, { lang, theme });

  return { ctx, page, errors, guard };
}

/* ⚠️ THE HANG LANE. The owner's condition on the whole refactor is «لا يعلّق
   التطبيق». A render that never returns is exactly that, and page.evaluate has
   NO default timeout — it would sit forever and the run would look "in
   progress" rather than failed. So every render is raced against a hard
   ceiling on the Node side. A hung page cannot be recovered (its main thread
   is gone), so a hang aborts the capture by name rather than continuing to
   record a page that no longer answers. */
async function timedRender(page, cellId, fn, arg) {
  try {
    return await Promise.race([
      page.evaluate(fn, arg),
      new Promise((_, rej) => setTimeout(() => rej(new Error('HUNG')), HANG_MS)),
    ]);
  } catch (e) {
    if (e.message === 'HUNG') throw new Error(cellId + ': the render did not return within ' + HANG_MS + 'ms — THE APP HUNG');
    throw e;
  }
}

/* SETTLE ON STATE, NEVER ON rAF. Two things are genuinely in flight after a
   synchronous render and neither is behaviour:
     · images — an onload handler adds `loaded`, so the class is a race;
     · any animation the reduced-motion clamp left at 0.01ms.
   Both are waited on by PREDICATE with a hard ceiling, so a hung image cannot
   hang the net. `complete` is true BEFORE the load event has dispatched, and
   the app's capture-phase load listener is what adds 'loaded' — so a loaded
   image is one that CARRIES the class, and a broken one (naturalWidth 0, the
   fence blocked it) is one that never will. Found only across eight contexts:
   5 of 160 cells flipped on it. */
async function settle(page, rootSel, opts) {
  /* ⚠️ THE APP'S OWN rAF FIRST, THE STATE PREDICATE SECOND. renderView schedules
     syncDetailTopTitle inside a requestAnimationFrame, and THAT toggles a class
     whose opacity then TRANSITIONS — so a predicate evaluated before the frame
     sees no animation at all, and a capture taken after it sees the transition
     mid-flight. Measured: .detail-top-title flipped 0<->1 in 4 of 40 cells
     between two captures of an unchanged tree. Waiting on rAF is forbidden as a
     BLIND wait (it never fires in a hidden document); openContext has already
     proved the timeline advances, and the timeout races it anyway. */
  await page.evaluate(() => new Promise((res) => {
    const done = () => res();
    setTimeout(done, 250);
    requestAnimationFrame(() => requestAnimationFrame(done));
  }));
  /* SETTLE ON STATE, NEVER ON rAF. Everything genuinely in flight after a render
     is waited on by PREDICATE with a hard ceiling, so a hung image or a stuck
     transition cannot hang the net:
       · images —  is true BEFORE the load event has dispatched, and the
         app's capture-phase load listener is what adds 'loaded'; a loaded image
         CARRIES the class, a broken one (naturalWidth 0, the fence blocked it)
         never will;
       · animations and transitions — PENDING counts as in flight, not only
         running: a 0.01ms transition under the reduced-motion clamp still needs a
         frame to start, and a capture before that frame reads its FROM value;
       · an own-overlay sheet (.sheet-overlay, .img-lightbox) reaches its resting
         state by adding .open inside a rAF, and the fake clock fakes rAF too —
         'open' is a state to wait for, never a frame to count;
       · autofocus — Chrome focuses a freshly inserted [autofocus] on a later
         rendering update; a capture that lands first records it unfocused. */
  await page.waitForFunction((sel) => {
    const rootEl = document.querySelector(sel);
    if (rootEl && rootEl.matches('.sheet-overlay, .img-lightbox') && !rootEl.classList.contains('open')) return false;
    const af = rootEl && rootEl.querySelector('[autofocus]');
    if (af && document.activeElement !== af) return false;
    const imgs = [...document.querySelectorAll(sel + ' img')];
    if (!imgs.every((i) => i.complete && (i.naturalWidth === 0 || i.classList.contains('loaded')))) return false;
    if (rootEl && rootEl.getAnimations && rootEl.getAnimations({ subtree: true }).some((a) => a.playState === 'running' || a.playState === 'pending')) return false;
    return true;
  }, rootSel, { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(30);   // flush microtasks
  /* FOCUS SETTLES WHEN IT STOPS MOVING. A sheet's first field is focused from a
     setTimeout — `grep 'focus(), ' js/app.js` yields 30, 40 and 60 ms, and a
     block-bodied one may differ, so check before lowering the floor — and the
     fake clock schedules those against the capture: the ring on a textarea
     flipped between two runs of an unchanged app. There is no event to wait
     for, so the lane waits for the STATE to hold still: a 400ms floor past the
     longest, then up to 20 samples 60ms apart, bounded at 1.6s. Sheets only. */
  if (opts && opts.focus) {
    await page.waitForTimeout(400);
    await page.evaluate(() => new Promise((res) => {
      let last = document.activeElement, same = 0, n = 0;
      const tick = () => {
        const cur = document.activeElement;
        same = cur === last ? same + 1 : 0; last = cur; n++;
        if (same >= 5 || n >= 20) return res();
        setTimeout(tick, 60);
      };
      setTimeout(tick, 60);
    }));
  }
}

/* The four free failure signals, verbatim for every cell of every lane. */
function cellProblems(cellId, cell) {
  // ⚠️ RETURN, do not fall through. pageCapture's early return for a missing
  // root carries ONLY { error } — no rawKeys, no childCount — so reading them
  // below threw a TypeError that aborted the whole run and pointed at this
  // file, instead of naming the cell whose overlay never mounted. The one
  // failure the lanes exist to report was the one that crashed them.
  if (cell.error) return [cellId + ': ' + cell.error];
  const problems = [];
  if (cell.newErrors.length) problems.push(cellId + ': ' + cell.newErrors.join(' | '));
  if (cell.childCount === 0) problems.push(cellId + ': rendered EMPTY (0 children) — the renderer threw or did nothing');
  if (cell.rawKeys.length) problems.push(cellId + ': raw i18n key(s) on screen: ' + cell.rawKeys.join(', '));
  if (cell.emptySvg) problems.push(cellId + ': ' + cell.emptySvg + ' empty <svg> — an icon name that is not an ICONS key renders nothing, silently');
  return problems;
}

/* A synchronous render past this is a visible freeze on a phone; past HANG_MS it
   is the thing the owner forbade. Both are deliberately generous — the net is
   here to catch a regression, not to benchmark. */
const SLOW_MS = 1500;
const HANG_MS = 8000;

// ── the views lane ───────────────────────────────────────────────────────────
async function captureContext(browser, origin, opts) {
  const { state, lang, theme, width, props } = opts;
  const cells = {}, problems = [], timings = [];
  const { ctx, page, errors, guard } = await openContext(browser, origin, { lang, theme, width });
  try {
    for (const v of VIEWS) {
      const cellId = state + '/' + lang + '/' + theme + '/' + width + '/' + v.view;
      const before = errors.length;
      const t = await timedRender(page, cellId, (view) => {
        const main = document.querySelector('.main');
        if (main) main.scrollTop = 0;
        const t0 = performance.now();
        navigate(view, {}, { fromPop: true });
        return performance.now() - t0;
      }, v.view);
      timings.push({ cell: cellId, ms: Math.round(t * 10) / 10 });
      if (t > SLOW_MS) problems.push(cellId + ': the render took ' + Math.round(t) + 'ms synchronously (ceiling ' + SLOW_MS + 'ms) — on a phone this is a visible freeze');
      await settle(page, '.view.active');
      const cell = await page.evaluate(pageCapture, { props, rootSel: '.view.active' });
      cell.renderMs = Math.round(t * 10) / 10;
      cell.newErrors = errors.slice(before);
      cells[cellId] = cell;
      problems.push(...cellProblems(cellId, cell));
    }
    const randomCalls = await page.evaluate(() => window.__fpRandomCalls);
    const reported = await page.evaluate(() => (window.__fpReportError || []).length);
    if (reported) problems.push(lang + '/' + theme + '/' + width + ': Cloud.reportError was called ' + reported + '× during the capture');
    const contained = guard.assertContained();
    return { cells, problems, randomCalls, contained, timings };
  } finally {
    await ctx.close();
  }
}

// ── the sheets lane (stage 3) ────────────────────────────────────────────────
// Every entry in scripts/fp/modals.js, opened over the seeded fixture, captured
// at #modal-root, then closed — and the close is asserted, because a sheet that
// will not leave is a defect the v341 review found live (.is-out corpses).
async function captureModals(browser, origin, opts) {
  const { lang, theme, width, props } = opts;
  const cells = {}, problems = [], timings = [];
  const { ctx, page, errors, guard } = await openContext(browser, origin, { lang, theme, width });
  try {
    const fx = await page.evaluate(seedFixture);
    for (const f of fx.failed) problems.push('fixture: ' + f + ' — the fixture must match the DB.* signature, or the sheet is captured over nothing');

    for (const m of MODALS.ENTRIES) {
      const cellId = 'modal/' + lang + '/' + theme + '/' + width + '/' + m.id;
      const before = errors.length;
      // a clean slate: no sheet from the previous entry, the host view up
      await page.evaluate((host) => { try { closeModal(); } catch (_) {} const r = document.getElementById('modal-root'); if (r) r.innerHTML = ''; navigate(host, {}, { fromPop: true }); }, m.host || 'home');
      await settle(page, '.view.active');
      const t = await timedRender(page, cellId, async ({ name, args, fixture, confirm }) => {
        const noop = () => {};
        const resolve = (a) => {
          if (a && typeof a === 'object' && 'v' in a) return a.v;
          if (a === '$noop') return noop;
          if (a === '$tmpl') return WORKOUT_TEMPLATES[0];
          if (a === '$lightbox') return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ff6a00"/></svg>');
          if (typeof a === 'string' && a[0] === '$') return fixture[a.slice(1)];
          return a;
        };
        let argv = args.map(resolve);
        if (confirm) argv = [{ ...argv[0], onConfirm: noop }];
        const t0 = performance.now();
        const r = window[name].apply(null, argv);
        if (r && typeof r.then === 'function') await r;
        return performance.now() - t0;
      }, { name: m.name, args: m.args, fixture: fx, confirm: !!m.confirm });
      timings.push({ cell: cellId, ms: Math.round(t * 10) / 10 });
      if (t > SLOW_MS) problems.push(cellId + ': opening took ' + Math.round(t) + 'ms (ceiling ' + SLOW_MS + 'ms)');
      const rootSel = m.root || '#modal-root';
      const overlaySel = m.root ? m.root : '#modal-root .modal-overlay';
      await page.waitForFunction((sel) => !!document.querySelector(sel), overlaySel, { timeout: 2000 }).catch(() => {});
      await settle(page, rootSel, { focus: true });
      const cell = await page.evaluate(pageCapture, { props, rootSel });
      cell.renderMs = Math.round(t * 10) / 10;
      cell.newErrors = errors.slice(before);
      cells[cellId] = cell;
      problems.push(...cellProblems(cellId, cell));
      // and it must CLOSE: the exit is a 320ms timer, so a sheet still there
      // after 2s is a corpse — and the report says WHAT is still there, because
      // "the same node with is-out" (a timer that never fired) and "a new sheet"
      // (something re-opened) are different defects.
      if (m.closeBy === 'remove') {
        await page.evaluate((sel) => { document.querySelectorAll(sel).forEach((el) => el.remove()); }, rootSel);
      } else {
        const left = await page.evaluate(() => {
          const before = document.querySelector('#modal-root .modal-overlay');
          try { closeModal(); } catch (e) { return { threw: String(e && e.message || e) }; }
          return { before: !!before };
        });
        if (left.threw) problems.push(cellId + ': closeModal() threw: ' + left.threw);
        const closed = await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), null, { timeout: 2000 }).then(() => true).catch(() => false);
        if (!closed) {
          const what = await page.evaluate(() => {
            const o = document.querySelector('#modal-root .modal-overlay');
            const title = o && (o.querySelector('.modal-title, .confirm-title, h2, h3') || {}).textContent;
            return { cls: o && o.className, title: (title || '').trim().slice(0, 50), pending: !!window.__modalExit };
          });
          problems.push(cellId + ': the sheet did not close — after 2s #modal-root still holds <' + what.cls + '> «' + what.title + '» (exit timer pending: ' + what.pending + ')');
        }
      }
    }
    const randomCalls = await page.evaluate(() => window.__fpRandomCalls);
    const reported = await page.evaluate(() => (window.__fpReportError || []).length);
    if (reported) problems.push('modal/' + lang + '/' + theme + '/' + width + ': Cloud.reportError was called ' + reported + '× during the capture');
    const contained = guard.assertContained();
    return { cells, problems, randomCalls, contained, timings, seeded: fx.seeded.length };
  } finally {
    await ctx.close();
  }
}

function writeRecord(tag, record, label) {
  fs.mkdirSync(OUT, { recursive: true });
  // ⚠️ THE LANE IS PART OF THE FILENAME, and that is not cosmetic. Both lanes
  // used to write <tag>.json, so capturing views and then sheets under one tag
  // left only the sheets — and the views evidence was gone with nothing said.
  // The diff guard below already refuses to compare a views record against a
  // sheets one; it simply never got the chance, because the second capture had
  // already eaten the first.
  fs.writeFileSync(path.join(OUT, recordFile(tag, record.lane)), JSON.stringify(record));
  const total = Object.values(record.cells).reduce((n, c) => n + (c.n || 0), 0);
  const cellCount = Object.keys(record.cells).length;
  console.log('fingerprint-net: ' + tag + ' — ' + label + ', ' + cellCount + ' cells, ' + total + ' elements, ' + record.props.length + ' properties each');
  console.log('  requests: ' + record.contained.blockedTotal + ' blocked (' + record.contained.blockedLive + ' to live hosts), 0 escaped');
  console.log('  Math.random during capture: ' + record.randomCalls);
  const slow = [...record.timings].sort((a, b) => b.ms - a.ms).slice(0, 3);
  console.log('  slowest renders: ' + slow.map((x) => x.cell.split('/').slice(1).join('/') + ' ' + x.ms + 'ms').join(' · '));
  if (record.problems.length) {
    console.log('\n  PROBLEMS (these are failures, not diffs):');
    for (const p of record.problems) console.log('    ✗ ' + p);
    process.exitCode = 1;
  } else {
    console.log('  no page errors, no empty cells, no raw keys, no empty icons, no slow or hung render');
  }
}

function propsFor(name) {
  if (name === 'all') return PROPS.ALL;
  if (name === 'stage1') return PROPS.STAGE1;
  throw new Error('--props must be stage1 or all');
}

async function withBrowser(state, fn) {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (_) { console.log('fingerprint-net: playwright is not installed here — skipping'); process.exit(0); }
  const srv = start(state === 'empty' ? 'out' : 'in');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try { return await fn(browser, origin); }
  finally { await browser.close(); await srv.close(); }
}

/* Stage 1 saw ONE cell of eight (ar/dark/375), so a step that broke the light
   theme, the English layout or a wider phone would have passed it. Both lanes
   run over this matrix: 8 contexts, one record, and `diff` treats the whole
   thing as one capture. */
const MATRIX = [];
for (const lang of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const width of [375, 412]) MATRIX.push({ lang, theme, width });

const CONTEXTS = {
  one: [{ lang: 'ar', theme: 'dark', width: 375 }],
  extremes: [{ lang: 'ar', theme: 'dark', width: 375 }, { lang: 'en', theme: 'light', width: 412 }],
  all: null,   // the full MATRIX
};
async function runMatrix(tag, state, props, laneFn, label, contexts, lane) {
  await withBrowser(state, async (browser, origin) => {
    const record = {
      tag, state, lane, contexts: contexts === null ? 'all' : contexts.length === 1 ? 'one' : 'extremes',
      lang: 'matrix', theme: 'matrix', width: 'matrix',
      at: FROZEN.toISOString(), tz: TZ,
      views: VIEWS.length, props,
      randomCalls: 0, contained: { escaped: 0, blockedLive: 0, blockedTotal: 0 }, problems: [], timings: [], cells: {},
    };
    for (const m of (contexts || MATRIX)) {
      const r = await laneFn(browser, origin, { state, ...m, props });
      Object.assign(record.cells, r.cells);
      record.problems.push(...r.problems);
      record.timings.push(...r.timings);
      record.randomCalls += r.randomCalls;
      record.contained.blockedLive += r.contained.blockedLive;
      record.contained.blockedTotal += r.contained.blockedTotal;
      process.stdout.write('  ' + m.lang + '/' + m.theme + '/' + m.width + ' ✓\n');
    }
    writeRecord(tag, record, label);
  });
}

// ── capture: one cell of the views matrix, for a quick look ─────────────────
async function capture() {
  const tag = flag('tag');
  if (!tag) throw new Error('capture needs --tag <name>');
  const state = flag('state', 'empty');
  const lang = flag('lang', 'ar');
  const theme = flag('theme', 'dark');
  const width = Number(flag('width', 375));
  const props = propsFor(flag('props', 'stage1'));
  await withBrowser(state, async (browser, origin) => {
    const r = await captureContext(browser, origin, { state, lang, theme, width, props });
    writeRecord(tag, {
      tag, state, lane: 'views', contexts: 'one', lang, theme, width,
      at: FROZEN.toISOString(), tz: TZ,
      views: VIEWS.length, props,
      randomCalls: r.randomCalls, contained: r.contained, problems: r.problems, timings: r.timings, cells: r.cells,
    }, VIEWS.length + ' views');
  });
}

// ── matrix: stage 2 — the views, eight contexts, every band ─────────────────
async function matrix() {
  const tag = flag('tag');
  if (!tag) throw new Error('matrix needs --tag <name>');
  const ctxs = CONTEXTS[flag('contexts', 'all')]; if (ctxs === undefined) throw new Error('--contexts must be one, extremes or all');
  await runMatrix(tag, flag('state', 'empty'), propsFor(flag('props', 'all')), captureContext, (ctxs || MATRIX).length + ' contexts × ' + VIEWS.length + ' views', ctxs, 'views');
}

// ── modals: stage 3 — the sheets and dialogs, eight contexts, every band ────
// Always over the signed-in stub ('full'): showChangePassword mounts the
// captcha through Cloud.captcha, which only the 'in' stub carries.
async function modals() {
  const tag = flag('tag');
  if (!tag) throw new Error('modals needs --tag <name>');
  const ctxs = CONTEXTS[flag('contexts', 'extremes')]; if (ctxs === undefined) throw new Error('--contexts must be one, extremes or all');
  await runMatrix(tag, 'full', propsFor(flag('props', 'all')), captureModals, (ctxs || MATRIX).length + ' contexts × ' + MODALS.ENTRIES.length + ' sheets', ctxs, 'sheets');
}

// ── diff ─────────────────────────────────────────────────────────────────────
const recordFile = (tag, lane) => tag + '.' + lane + '.json';

/* Which lanes were captured under this tag. A bare <tag> means "every lane
   under it", so `diff before after` compares views WITH sheets instead of
   whichever one the caller happened to run second. A record written before
   v360 is still readable as <tag>.json and is reported under its own lane. */
function lanesOf(tag) {
  const out = new Map();
  const legacy = path.join(OUT, tag + '.json');
  if (fs.existsSync(legacy)) { const r = JSON.parse(fs.readFileSync(legacy, 'utf8')); out.set(r.lane || 'views', r); }
  for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
    const m = new RegExp('^' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(\\w+)\\.json$').exec(f);
    if (m) out.set(m[1], JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
  }
  if (!out.size) throw new Error(`no capture tagged "${tag}" — run: node scripts/fingerprint-net.js matrix --tag ${tag}`);
  return out;
}

/* Compare every lane captured under both tags. A lane present on one side and
   not the other is a FAILURE, not a smaller report: "40/40 identical" over the
   sheets alone, printed for a change that moved a view, is the kind of green
   that is worse than a red. */
function diff() {
  const A = lanesOf(args[1]), B = lanesOf(args[2]);
  const lanes = [...new Set([...A.keys(), ...B.keys()])].sort();
  const missing = lanes.filter((l) => !A.has(l) || !B.has(l));
  if (missing.length) throw new Error(`lane(s) ${missing.join(', ')} were captured under only one of the two tags — capture both sides of every lane, or the comparison is silently partial`);
  let failed = 0;
  for (const lane of lanes) if (diffOne(A.get(lane), B.get(lane), lane)) failed++;
  if (lanes.length > 1) console.log(`\nfingerprint-net: ${lanes.length} lanes compared (${lanes.join(', ')})` + (failed ? ` — ${failed} with differences` : ' — nothing changed in any of them'));
  if (failed) process.exitCode = 1;
}

function diffOne(a, b, lane) {
  if (JSON.stringify(a.props) !== JSON.stringify(b.props)) throw new Error('the two captures recorded different property sets — they are not comparable');
  // `lane` and `contexts` are in this list because a views record and a sheets
  // record were silently comparable: a mistyped tag printed '160 removed, 106
  // added' instead of saying they are from different lanes.
  for (const k of ['lane', 'contexts', 'state', 'lang', 'theme', 'width']) {
    if (a[k] !== b[k]) throw new Error(`the two captures disagree on ${k} (${a[k]} vs ${b[k]}) — they are not comparable`);
  }

  const diffs = [];
  let identicalCells = 0, comparedEls = 0;
  const cellIds = [...new Set([...Object.keys(a.cells), ...Object.keys(b.cells)])].sort();

  for (const id of cellIds) {
    const ca = a.cells[id], cb = b.cells[id];
    if (!ca) { diffs.push({ cell: id, kind: 'cell-added' }); continue; }
    if (!cb) { diffs.push({ cell: id, kind: 'cell-removed' }); continue; }
    const byPath = (c) => new Map(c.els.map((e) => [e.p, e]));
    const ma = byPath(ca), mb = byPath(cb);
    const paths = [...new Set([...ma.keys(), ...mb.keys()])];
    let cellDiffs = 0;
    for (const p of paths) {
      const ea = ma.get(p), eb = mb.get(p);
      if (!ea) { diffs.push({ cell: id, p, kind: 'added', tag: eb.tag, cls: eb.cls }); cellDiffs++; continue; }
      if (!eb) { diffs.push({ cell: id, p, kind: 'removed', tag: ea.tag, cls: ea.cls }); cellDiffs++; continue; }
      comparedEls++;
      const keys = [...new Set([...Object.keys(ea), ...Object.keys(eb)])].filter((k) => k !== 's' && k !== 'p');
      for (const k of keys) {
        const va = JSON.stringify(ea[k]), vb = JSON.stringify(eb[k]);
        if (va !== vb) { diffs.push({ cell: id, p, kind: 'field', field: k, from: ea[k], to: eb[k] }); cellDiffs++; }
      }
      for (const pr of Object.keys(ea.s || {})) {
        if (ea.s[pr] !== (eb.s || {})[pr]) {
          diffs.push({ cell: id, p, kind: 'style', field: pr, from: ea.s[pr], to: (eb.s || {})[pr] });
          cellDiffs++;
        }
      }
    }
    if (!cellDiffs) identicalCells++;
  }

  console.log(`fingerprint-net: ${args[1]} → ${args[2]}  [${lane}]`);
  console.log(`  ${identicalCells}/${cellIds.length} cells identical · ${comparedEls} elements compared · ${diffs.length} differences`);

  if (!diffs.length) {
    console.log('  NOTHING CHANGED. The claim holds.');
    return false;
  }

  // Collapse: a class rename is ONE line covering N elements, not N lines.
  const groups = new Map();
  for (const d of diffs) {
    const key = [d.kind, d.field || '', JSON.stringify(d.from), JSON.stringify(d.to)].join(' ');
    if (!groups.has(key)) groups.set(key, { ...d, count: 0, cells: new Set(), sample: d.p, sampleCell: d.cell });
    const g = groups.get(key);
    g.count++; g.cells.add(d.cell);
  }
  const sorted = [...groups.values()].sort((x, y) => y.count - x.count);
  console.log('\n  UNEXPLAINED — grouped by (kind, field, from → to):\n');
  for (const g of sorted.slice(0, 40)) {
    const what = g.kind === 'field' || g.kind === 'style' ? `${g.kind}:${g.field}` : g.kind;
    console.log(`    ×${String(g.count).padStart(4)}  ${what}`);
    if (g.from !== undefined) console.log(`            ${JSON.stringify(g.from)}  →  ${JSON.stringify(g.to)}`);
    // Naming the screen is the first thing a reader needs; the first version of
    // this report said "1 cell" and left me grepping for which one.
    console.log(`            e.g. ${g.sampleCell}  ${g.sample}`);
    if (g.cells.size > 1) console.log(`            (and ${g.cells.size - 1} more cell${g.cells.size > 2 ? 's' : ''})`);
  }
  if (sorted.length > 40) console.log(`\n    …and ${sorted.length - 40} more groups`);
  console.log('\n  Every line above is a change this step did not declare.');
  return true;
}

// ── go ───────────────────────────────────────────────────────────────────────
// Guarded so the file can be REQUIRED for its record-path helpers without
// running a capture. scripts/test-fingerprint.js needs to know where a record
// lands, and a second spelling of that filename is exactly what broke it.
module.exports = { OUT, recordFile, lanesOf };

if (require.main === module) (async () => {
  try {
    if (cmd === 'capture') await capture();
    else if (cmd === 'matrix') await matrix();
    else if (cmd === 'modals') await modals();
    else if (cmd === 'diff') diff();
    else {
      console.log('usage:\n  node scripts/fingerprint-net.js capture --tag <name> [--state empty|full] [--lang ar|en] [--theme dark|light] [--width 375] [--props stage1|all]\n  node scripts/fingerprint-net.js matrix  --tag <name> [--state empty|full] [--props all|stage1] [--contexts all|extremes|one]   # the 20 views\n  node scripts/fingerprint-net.js modals  --tag <name> [--props all|stage1] [--contexts extremes|one|all]   # every sheet in fp/modals.js; extremes = ar/dark/375 + en/light/412\n  node scripts/fingerprint-net.js diff <before> <after>');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('fingerprint-net: ' + e.message);
    process.exitCode = 1;
  }
})();
