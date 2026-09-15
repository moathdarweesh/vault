#!/usr/bin/env node
// THE FINGERPRINT NET — prove a refactor changed nothing.
//
//   node scripts/fingerprint-net.js matrix --tag before     # stage 2: ar/en × dark/light × 375/412, every band
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
// ── one context = one (state, lang, theme, width) ────────────────────────────
// Everything a single cell of the matrix needs, and nothing that outlives it.
// \`capture\` runs one; \`matrix\` runs eight in the same browser.
async function captureContext(browser, origin, opts) {
  const { state, lang, theme, width, props } = opts;
  const cells = {};
  const problems = [];
  const timings = [];

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
  try {
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

    // ⚠️ ASSERT THE PRECONDITION; NEVER ASSUME IT. rAF, animationend and
    // transitionend do not fire in a hidden or throttled document, and
    // document.timeline freezes — so a net that waited on one would record the
    // bug as the baseline. It does not degrade to a weaker check; it aborts.
    await page.bringToFront();
    const live = await page.evaluate(async () => {
      const t0 = document.timeline.currentTime;
      await new Promise((r) => setTimeout(r, 200));
      return {
        visible: document.visibilityState === 'visible',
        timelineAdvanced: document.timeline.currentTime - t0 > 100,
      };
    });
    if (!live.visible || !live.timelineAdvanced) {
      throw new Error('fp: this document is hidden or throttled — every timing assertion below would be vacuous');
    }

    await page.evaluate(({ lang, theme }) => {
      document.getElementById('splash')?.remove();
      try { closeModal(); } catch (_) {}
      try { hideAuthGate(); } catch (_) {}
      document.getElementById('onboard-gate')?.remove();
      DB.prefs.setOnboarded(); DB.prefs.setLang(lang); DB.prefs.setTheme(theme);
      applyLang(lang); applyTheme(theme);
    }, { lang, theme });

    for (const v of VIEWS) {
      const cellId = state + '/' + lang + '/' + theme + '/' + width + '/' + v.view;
      const before = errors.length;

      /* ⚠️ THE HANG LANE. The owner's condition on the whole refactor is «لا يعلّق
         التطبيق». A render that never returns is exactly that, and page.evaluate
         has NO default timeout — it would sit forever and the run would look
         "in progress" rather than failed. So the render is raced against a hard
         ceiling on the Node side. A hung page cannot be recovered (its main
         thread is gone), so a hang aborts the capture by name rather than
         continuing to record a page that no longer answers. */
      let t;
      try {
        t = await Promise.race([
          page.evaluate((view) => {
            const main = document.querySelector('.main');
            if (main) main.scrollTop = 0;
            const t0 = performance.now();
            navigate(view, {}, { fromPop: true });
            return performance.now() - t0;
          }, v.view),
          new Promise((_, rej) => setTimeout(() => rej(new Error('HUNG')), HANG_MS)),
        ]);
      } catch (e) {
        if (e.message === 'HUNG') throw new Error(cellId + ': the render did not return within ' + HANG_MS + 'ms — THE APP HUNG');
        throw e;
      }
      timings.push({ cell: cellId, ms: Math.round(t * 10) / 10 });
      if (t > SLOW_MS) problems.push(cellId + ': the render took ' + Math.round(t) + 'ms synchronously (ceiling ' + SLOW_MS + 'ms) — on a phone this is a visible freeze');

      /* SETTLE ON STATE, NEVER ON rAF. Two things are genuinely in flight after a
         synchronous render and neither is behaviour:
           · images — an onload handler adds \`loaded\`, so the class is a race;
           · any animation the reduced-motion clamp left at 0.01ms.
         Both are waited on by PREDICATE with a hard ceiling, so a hung image
         cannot hang the net. */
      await page.waitForFunction(() => {
        const imgs = [...document.querySelectorAll(".view.active img")];
        // complete is true BEFORE the load event has dispatched, and the app's
        // capture-phase load listener is what adds 'loaded' — so a loaded image
        // is one that CARRIES the class, and a broken one (naturalWidth 0, the
        // fence blocked it) is one that never will. Both are states; neither is
        // a wait on an event. Found only across eight contexts: 5 cells flipped.
        if (!imgs.every((i) => i.complete && (i.naturalWidth === 0 || i.classList.contains('loaded')))) return false;
        const el = document.querySelector(".view.active");
        if (el && el.getAnimations && el.getAnimations({ subtree: true }).some((a) => a.playState === "running")) return false;
        return true;
      }, null, { timeout: 2000 }).catch(() => {});
      /* ⚠️ AND ONE BOUNDED rAF, BECAUSE THE APP ITSELF DEFERS TO ONE.
         renderView schedules syncDetailTopTitle in a requestAnimationFrame, so
         whether the detail-top title had faded in was a RACE — it was the last
         noise source left, and it flipped opacity 1<->0 between two captures of
         an unchanged app. Waiting on rAF is forbidden as a BLIND wait (it never
         fires in a hidden document); here the precondition check above has
         already proved the timeline advances, and the race guards it anyway. */
      await page.evaluate(() => new Promise((res) => {
        const done = () => res();
        setTimeout(done, 250);
        requestAnimationFrame(() => requestAnimationFrame(done));
      }));
      await page.waitForTimeout(30);   // flush microtasks
      const cell = await page.evaluate(pageCapture, { props, rootSel: '.view.active' });
      cell.renderMs = Math.round(t * 10) / 10;
      cell.newErrors = errors.slice(before);
      cells[cellId] = cell;

      if (cell.error) problems.push(cellId + ': ' + cell.error);
      if (cell.newErrors.length) problems.push(cellId + ': ' + cell.newErrors.join(' | '));
      if (cell.childCount === 0) problems.push(cellId + ': rendered EMPTY (0 children) — the renderer threw or did nothing');
      if (cell.rawKeys.length) problems.push(cellId + ': raw i18n key(s) on screen: ' + cell.rawKeys.join(', '));
      if (cell.emptySvg) problems.push(cellId + ': ' + cell.emptySvg + ' empty <svg> — an icon name that is not an ICONS key renders nothing, silently');
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

/* A synchronous render past this is a visible freeze on a phone; past HANG_MS it
   is the thing the owner forbade. Both are deliberately generous — the net is
   here to catch a regression, not to benchmark. */
const SLOW_MS = 1500;
const HANG_MS = 8000;

function writeRecord(tag, record, label) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, tag + '.json'), JSON.stringify(record));
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
    console.log('  no page errors, no empty views, no raw keys, no empty icons, no slow or hung render');
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

// ── capture: one cell of the matrix ─────────────────────────────────────────
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
      tag, state, lang, theme, width,
      at: FROZEN.toISOString(), tz: TZ,
      views: VIEWS.length, props,
      randomCalls: r.randomCalls, contained: r.contained, problems: r.problems, timings: r.timings, cells: r.cells,
    }, VIEWS.length + ' views');
  });
}

// ── matrix: stage 2 — both languages, both themes, two widths ───────────────
// Stage 1 saw ONE cell of eight (ar/dark/375), so a step that broke the light
// theme, the English layout or a wider phone would have passed it. The matrix is
// the minimum a refactor step has to clear before it ships: 8 contexts × 20
// views in one browser, one record, and \`diff\` treats the whole thing as one
// capture. Every property band is on by default here — the reason STAGE1 was a
// subset (a human reading the first baseline) no longer applies.
const MATRIX = [];
for (const lang of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const width of [375, 412]) MATRIX.push({ lang, theme, width });

async function matrix() {
  const tag = flag('tag');
  if (!tag) throw new Error('matrix needs --tag <name>');
  const state = flag('state', 'empty');
  const props = propsFor(flag('props', 'all'));

  await withBrowser(state, async (browser, origin) => {
    const record = {
      tag, state, lang: 'matrix', theme: 'matrix', width: 'matrix',
      at: FROZEN.toISOString(), tz: TZ,
      views: VIEWS.length, props,
      randomCalls: 0, contained: { escaped: 0, blockedLive: 0, blockedTotal: 0 }, problems: [], timings: [], cells: {},
    };
    for (const m of MATRIX) {
      const r = await captureContext(browser, origin, { state, ...m, props });
      Object.assign(record.cells, r.cells);
      record.problems.push(...r.problems);
      record.timings.push(...r.timings);
      record.randomCalls += r.randomCalls;
      record.contained.blockedLive += r.contained.blockedLive;
      record.contained.blockedTotal += r.contained.blockedTotal;
      process.stdout.write('  ' + m.lang + '/' + m.theme + '/' + m.width + ' ✓\n');
    }
    writeRecord(tag, record, MATRIX.length + ' contexts × ' + VIEWS.length + ' views');
  });
}

// ── diff ─────────────────────────────────────────────────────────────────────
function loadTag(tag) {
  const f = path.join(OUT, tag + '.json');
  if (!fs.existsSync(f)) throw new Error(`no capture tagged "${tag}" — run: node scripts/fingerprint-net.js capture --tag ${tag}`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function diff() {
  const a = loadTag(args[1]), b = loadTag(args[2]);
  if (JSON.stringify(a.props) !== JSON.stringify(b.props)) throw new Error('the two captures recorded different property sets — they are not comparable');
  for (const k of ['state', 'lang', 'theme', 'width']) {
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

  console.log(`fingerprint-net: ${args[1]} → ${args[2]}`);
  console.log(`  ${identicalCells}/${cellIds.length} cells identical · ${comparedEls} elements compared · ${diffs.length} differences`);

  if (!diffs.length) {
    console.log('\n  NOTHING CHANGED. The claim holds.');
    return;
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
  process.exitCode = 1;
}

// ── go ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (cmd === 'capture') await capture();
    else if (cmd === 'matrix') await matrix();
    else if (cmd === 'diff') diff();
    else {
      console.log('usage:\n  node scripts/fingerprint-net.js capture --tag <name> [--state empty|full] [--lang ar|en] [--theme dark|light] [--width 375] [--props stage1|all]\n  node scripts/fingerprint-net.js matrix  --tag <name> [--state empty|full] [--props all|stage1]   # 8 contexts × 20 views, one record\n  node scripts/fingerprint-net.js diff <before> <after>');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('fingerprint-net: ' + e.message);
    process.exitCode = 1;
  }
})();
