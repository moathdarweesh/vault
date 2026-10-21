#!/usr/bin/env node
// The schedule import from SEVERAL photos or ONE PDF (v424), driven in a real
// browser: Program → «Edit cycle» → the import button opens the sheet; the file
// input takes several files (photos or a PDF) and the camera one photo; every
// picked page is a tile in reading order — a numbered thumbnail, or the PDF as
// a row with its name and size — each with a remove button; a PDF replaces the
// photos and a photo replaces the PDF; the seventh photo is refused with
// «up to 6», a PDF over 6 MB by its size, a file of another kind by its kind;
// «قراءة الجدول» posts `pages` in order for two or more photos or a PDF and the
// OLD `image` shape for one photo (a Worker from before v424 still serves it);
// an old Worker's 400 'no input' on `pages` reads «not available right now»;
// the review draws the fixture's days and its source shows every page, each a
// button that opens the page FULL SIZE in the lightbox (the tile itself draws a
// small picture, the lightbox the very bytes the Worker was sent); a pick
// holding photos AND a PDF, or two PDFs, is refused whole; and the strip wraps
// at 375 and at 320 under «Larger text» with every remove button 44 px
// effective.
//
// Same harness as scripts/test-shared-recipes-ui.js (scripts/fp/server.js): the
// repo over loopback on a free port, js/cloud.js replaced by the 'in' stub (a
// session with a user, which read() needs), and a route filter that aborts
// every request that is not 127.0.0.1. The Worker's host is routed to a stub
// that answers from a queue each case fills — fulfil only, never continue — so
// nothing leaves the machine, and the fence proves it afterwards. The REAL
// js/foodai.js builds every request, so the wire format the Worker reads is
// asserted here too. Playwright is external (npm i --no-save playwright eslint@9 globals).
//
// THE FILES ARE BUILT HERE, never fetched: a PNG encoder of a few lines (one
// colour per page, so two pages' JPEGs differ and their order is checkable), a
// minimal %PDF-1.4 of one page padded by a stream to the size a case wants, and
// a text file. Every expectation comes from the case's own fixture and every
// string through t(): the same assertions run in AR/dark and EN/light.
//
// Every assertion was seen to fail on a defect planted IN MEMORY (the suite run
// with fs.readFileSync patched for one file, the tree untouched and hash-equal
// afterwards), in both passes, each caught by the assertion written for it:
// js/app.js — `multiple` off the input, application/pdf off its accept, the
// read button enabled with no page, a tile numbered from 0, the remove label
// without its number, the remove splicing the next tile, a new page put first,
// a cap of 7, the seventh not said, a PDF beside the photos, the PDF name
// printed raw, the size divided wrong, no glyph on the file tile, the PDF cap
// ten times too large, a .txt accepted, the %PDF test dropped, the review's
// source showing the first page alone; js/foodai.js — one photo sent as
// `pages`, two sent as `image`, the pages reversed, a PDF alone sent as
// `image`, the old Worker's refusal flattened into «صار خطأ»; styles.css — the
// strip not wrapping, the halo dropped, a tile not 96, the remove button not
// 36, the RTL mirror of the remove button or of the number dropped (caught in
// the Arabic pass alone, an Arabic-only defect), the ellipsis dropped; and the
// review's fixes — the source tile not a button, the lightbox opened on the
// small picture (two photos, and one), the tile drawn with the full picture,
// the lightbox binding dropped, the lightbox named without its number, the
// mixed pick taken, two PDFs not refused, the view button under 44. 38
// plants, 38 caught; the runner and its list live beside the spec, outside
// the repo. v426 (cases 14–18, the save that never demands what the user
// already did) added its own plants the same way: an unmatched row left '',
// the category select kept hidden, the read row's category not Other, the
// planner not opened, the repeat's note not appended, the refusal's place
// dropped (the general line), the number left as «{n}», the finger not moved,
// the sets fault unplaced, the empty strip answered with the general line.
//
// Standalone: it runs itself behind the require.main guard and is required by
// no other suite. QA_ONLY=<words> re-runs the cases whose name contains them.
'use strict';
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const WORKER_HOST = 'vault-calories.moathdarweesh2000.workers.dev';
const SHEET = '#modal-root .modal-overlay:not(.is-out) .plan-import-body';
// The limits BY THE SPEC (v424 §2), never read from js/app.js.
const MAX_PAGES = 6, PDF_MAX = 6000000;
// The most a case may take: the waits inside it are 15–30 s each, so a case
// that passes this is stuck, not slow.
const CASE_MS = 90000;

// ── the files ───────────────────────────────────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
// A w×h PNG (8-bit RGB, no filter), valid for Chrome's decoder: one colour, or
// a colour per pixel from `at(x, y)`.
function png(w, h, rgb, at) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const [r, g, b] = at ? at(x, y) : rgb; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// A one-page %PDF-1.4 with a correct xref, padded by a stream of `pad` bytes.
function pdf(pad) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'];
  if (pad) objs.push(`<< /Length ${pad} >>\nstream\n${' '.repeat(pad)}\nendstream`);
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Root 1 0 R /Size ${objs.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const COLOURS = [[220, 40, 40], [40, 160, 60], [40, 80, 220], [230, 180, 20], [120, 40, 160], [20, 170, 170], [90, 90, 90]];
const photo = (i) => ({ name: `page-${i + 1}.png`, mimeType: 'image/png', buffer: png(24, 32, COLOURS[i % COLOURS.length]) });
const photos = (n) => Array.from({ length: n }, (_, i) => photo(i));
const XSS_NAME = 'sched<img src=x onerror="window.__xss=1">.pdf';
const SMALL_PDF = { name: 'schedule.pdf', mimeType: 'application/pdf', buffer: pdf(150000) };
// A page the size of a real photo (1000 × 1400): a table — rules every 40 px
// and some filled cells — whose full-size JPEG runs past 100,000 chars while
// its 192 px tile stays near 13,000 (measured), so the strip's small picture
// and the lightbox's full one are told apart by size as well as by bytes.
const BIG_PHOTO = { name: 'page-table.png', mimeType: 'image/png', buffer: png(1000, 1400, null, (x, y) => (x % 40 < 2 || y % 40 < 2 ? [20, 20, 20] : ((x >> 5) * 7 + (y >> 5) * 3) % 5 === 0 ? [60, 60, 60] : [250, 248, 244])) };

// What the Worker answers: two workouts, three exercises, one with no sets.
const FIXTURE = { days: [
  { name: 'Push', exercises: [{ name: 'Bench Press', sets: 4, reps: '8–12', notes: 'Rest 90 s' }, { name: 'Cable press', sets: 3, reps: '10', notes: '' }] },
  { name: 'Legs', exercises: [{ name: 'Squat', sets: null, reps: '10 / 8 / 6', notes: '' }] },
] };

// ── the page kit ────────────────────────────────────────────────────────────
async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
    colorScheme: theme,
    timezoneId: 'Asia/Riyadh',
    locale: lang === 'ar' ? 'ar-SA' : 'en-US',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  // THE WORKER STUB — registered after the fence, so it wins for this host.
  // Fulfil only: the handler never calls route.continue().
  const worker = { queue: [], calls: [] };
  await page.route((url) => url.hostname === WORKER_HOST, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = null;
    try { body = req.postDataJSON(); } catch (_) { body = null; }
    worker.calls.push(body);
    const next = worker.queue.shift() || { status: 200, body: { plan: FIXTURE } };
    return route.fulfill({ status: next.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(next.body) });
  });
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && typeof DB !== 'undefined' && typeof FoodAI !== 'undefined');
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked();
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    // Program draws «Edit cycle» only over a plan.
    const ex = DB.exercises.list()[0];
    DB.plan.setRotation({ cycle: [{ name: 'Push', exerciseIds: [ex.id] }], trainingDays: [0, 2, 4] });
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = (view) => ev((view) => {
    try { closeModal(); } catch (_) {}
    const r = document.getElementById('modal-root'); if (r) r.innerHTML = '';
    hideToast();
    document.querySelector('.img-lightbox')?.remove();
    document.body.classList.remove('text-lg');
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, {});
  }, view);
  const fresh = () => { worker.queue.length = 0; worker.calls.length = 0; };
  const tr = (key) => ev((k) => t(k), key);
  // THE DOOR: Program → «Edit cycle» → the import button, the sheet up.
  const openSheet = async () => {
    await reset('workouts');
    await page.click('.view.active[data-view="workouts"] .prg-edit[data-goto="planner"]');
    await page.waitForSelector('.view.active[data-view="planner"] .plan-import-entry');
    await page.click('.view.active[data-view="planner"] .plan-import-entry');
    await page.waitForSelector(SHEET + ' [data-pi-file]', { state: 'attached' });   // the input is hidden by design
  };
  // Hand the picker files and wait for the pick to end (the pick button is
  // disabled for exactly as long as a page is being prepared).
  const give = async (files, which = 'file') => {
    await page.setInputFiles(SHEET + (which === 'cam' ? ' [data-pi-cam-file]' : ' [data-pi-file]'), files);
    await page.waitForFunction((sel) => { const b = document.querySelector(sel + ' [data-pi-pick]'); return b && !b.disabled; }, SHEET, { timeout: 15000 });
  };
  // Tap «قراءة الجدول» and wait for the review or an error.
  const read = async () => {
    await page.click(SHEET + ' [data-pi-read]');
    await page.waitForFunction((sel) => {
      const b = document.querySelector(sel); if (!b) return false;
      const e = b.querySelector('[data-pi-error]');
      return !!b.querySelector('[data-pi-form]') || (e && !e.hidden);
    }, SHEET, { timeout: 15000 });
  };
  // SAVE: tap «حفظ الجدول» and wait for the sheet to go (the planner opens) or
  // for an error to show. A shown error from an earlier attempt is hidden
  // first, so the wait reads THIS attempt's answer.
  const save = async () => {
    await ev((sel) => { const e = document.querySelector(sel + ' [data-pi-error]'); if (e) e.hidden = true; }, SHEET);
    await page.click(SHEET + ' [data-pi-save]');
    await page.waitForFunction((sel) => { const b = document.querySelector(sel); if (!b) return true; const e = b.querySelector('[data-pi-error]'); return !!(e && !e.hidden); }, SHEET, { timeout: 15000 });
  };
  // THE SOURCE FULL SIZE: open the review's <details> if it is closed, tap the
  // tile's button, read the lightbox (its picture, its name), close it with the
  // lightbox's own button. null when the tile is no button at all.
  const viewFull = async (i) => {
    await ev(() => { const d = document.querySelector('#modal-root .plan-import-source'); if (d && !d.open) d.open = true; });
    if (!(await ev((i) => !!document.querySelector('#modal-root [data-pi-view="' + i + '"]'), i))) return null;
    await page.click(SHEET + ` [data-pi-view="${i}"]`);
    const lb = await ev(() => { const lb = document.querySelector('.img-lightbox'); if (!lb) return null; const img = lb.querySelector('img'); return { src: img ? img.src : null, label: lb.getAttribute('aria-label') }; });
    if (!lb) return null;
    await page.click('.img-lightbox-close');
    lb.closed = await ev(() => !document.querySelector('.img-lightbox'));
    return lb;
  };
  return { ctx, page, ev, reset, errors, guard, lang, theme, worker, fresh, tr, openSheet, give, read, save, viewFull };
}

// ── in-page readers ─────────────────────────────────────────────────────────
// THE SHEET as drawn: its title, the picker's inputs, the tiles in order (kind,
// number, thumbnail, alt, the PDF's name and size, the remove button and its
// label, the review's view button and its label), the buttons, the shown
// error, the hints, and — once read — the review's days, rows and source strip.
function readSheet() {
  const m = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
  if (!m) return null;
  const body = m.querySelector('.plan-import-body');
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const tile = (el) => {
    const img = el.querySelector('img'), rm = el.querySelector('[data-pi-drop]'), nm = el.querySelector('.plan-import-file-name'), vb = el.querySelector('[data-pi-view]');
    const r = el.getBoundingClientRect(), rtl = getComputedStyle(el).direction === 'rtl';
    // Which corner a part sits on, in READING terms: 'end' is the left in RTL.
    const corner = (x) => {
      if (!x) return null;
      const b = x.getBoundingClientRect();
      const nearStart = rtl ? b.right >= r.right - 8 : b.left <= r.left + 8, nearEnd = rtl ? b.left <= r.left + 8 : b.right >= r.right - 8;
      return (b.top <= r.top + 8 ? 'top' : b.bottom >= r.bottom - 8 ? 'bottom' : 'mid') + '-' + (nearStart ? 'start' : nearEnd ? 'end' : 'mid');
    };
    return {
      rmCorner: corner(rm), numCorner: corner(el.querySelector('.plan-import-page-num')),
      kind: el.classList.contains('plan-import-file') ? 'pdf' : 'image', idx: el.dataset.piPage,
      src: img ? img.src : null, alt: img ? img.alt : null, num: txt(el.querySelector('.plan-import-page-num')),
      name: txt(nm), nameChildren: nm ? nm.children.length : 0, size: txt(el.querySelector('.plan-import-file-size')),
      glyph: !!el.querySelector(':scope > svg') && !!el.querySelector(':scope > svg').innerHTML,
      remove: rm ? { label: rm.getAttribute('aria-label'), disabled: rm.disabled, tag: rm.tagName, w: Math.round(rm.getBoundingClientRect().width), h: Math.round(rm.getBoundingClientRect().height) } : null,
      view: vb ? { label: vb.getAttribute('aria-label'), tag: vb.tagName, w: Math.round(vb.getBoundingClientRect().width), h: Math.round(vb.getBoundingClientRect().height) } : null,
      w: Math.round(r.width), h: Math.round(r.height),
    };
  };
  const file = body.querySelector('[data-pi-file]'), cam = body.querySelector('[data-pi-cam-file]');
  const err = body.querySelector('[data-pi-error]'), rd = body.querySelector('[data-pi-read]');
  const form = body.querySelector('[data-pi-form]');
  // Where the finger is: a field's id, a weekday button, or the element's tag.
  const a = document.activeElement;
  return {
    title: txt(m.querySelector('.modal-title')),
    active: a ? (a.id || (a.hasAttribute('data-pi-weekday') ? 'weekday:' + a.dataset.piWeekday : a.tagName)) : null,
    tiles: [...body.querySelectorAll(':scope > .plan-import-pages .plan-import-page')].map(tile),
    placeholder: !!body.querySelector('.plan-import-placeholder'),
    file: file ? { accept: file.getAttribute('accept'), multiple: file.multiple } : null,
    cam: cam ? { accept: cam.getAttribute('accept'), multiple: cam.multiple, capture: cam.getAttribute('capture') } : null,
    pick: txt(body.querySelector('[data-pi-pick]')), camera: txt(body.querySelector('[data-pi-camera]')),
    error: err && !err.hidden ? txt(err) : null,
    read: rd ? { text: txt(rd), disabled: rd.disabled } : null,
    hints: [...body.querySelectorAll('.plan-import-hint')].map(txt),
    xss: window.__xss || null,
    review: form ? {
      days: [...form.querySelectorAll('[data-pi-day]')].map((s) => ({ name: s.querySelector('[data-day-name]').value,
        rows: [...s.querySelectorAll('[data-pi-row]')].map((r) => ({ name: r.querySelector('[data-field="name"]').value, sets: r.querySelector('[data-field="sets"]').value, reps: r.querySelector('[data-field="reps"]').value, notes: r.querySelector('[data-field="notes"]').value,
          exerciseId: r.querySelector('[data-field="exerciseId"]').value, categoryShown: !r.querySelector('[data-pi-category]').hidden, category: r.querySelector('[data-field="category"]').value })) })),
      summary: txt(body.querySelector('.plan-import-source summary')),
      source: [...body.querySelectorAll('.plan-import-source .plan-import-page')].map(tile),
    } : null,
  };
}
// LAYOUT, «Larger text» as asked: the strip's box, whether the tiles wrap into
// more than one row, every element of the strip inside the modal side to side,
// no sideways scroll on the modal or the page, each tile's size, and for every
// remove button its EFFECTIVE hit box — the eight points 21 px from its centre
// (a 44 box less one) each hit-tested to the button or something inside it.
function layoutOf(lg) {
  document.body.classList.toggle('text-lg', lg);
  const modal = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
  const strip = modal.querySelector('.plan-import-body > .plan-import-pages');
  const mb = modal.getBoundingClientRect(), sb = strip.getBoundingClientRect();
  const tiles = [...strip.querySelectorAll('.plan-import-page')];
  const rows = new Set(tiles.map((el) => Math.round(el.getBoundingClientRect().top))).size;
  const spills = [];
  for (const el of strip.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.left < mb.left - 1 || r.right > mb.right + 1)) spills.push(`${el.getAttribute('class') || el.tagName} ${Math.round(r.left)}–${Math.round(r.right)} outside ${Math.round(mb.left)}–${Math.round(mb.right)}`);
  }
  const hits = tiles.map((el) => {
    const btn = el.querySelector('[data-pi-drop]');
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const probes = [[-21, -21], [0, -21], [21, -21], [-21, 0], [21, 0], [-21, 21], [0, 21], [21, 21]];
    const miss = probes.filter(([dx, dy]) => { const hit = document.elementFromPoint(cx + dx, cy + dy); return !(hit && (hit === btn || btn.contains(hit))); });
    return { drawn: [Math.round(r.width), Math.round(r.height)], miss: miss.map(([dx, dy]) => `${dx},${dy}`) };
  });
  return {
    stripW: Math.round(sb.width), modalW: Math.round(mb.width), rows, spills,
    modalScroll: modal.scrollWidth > modal.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    tiles: tiles.map((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)]),
    hits,
  };
}
const b64 = (src) => src.slice(src.indexOf(',') + 1);
const sizeText = (page, bytes) => page.evaluate((n) => fmtNum(Math.max(0.1, Math.round(n / 1e5) / 10)) + ' ' + t('rx_mb'), bytes);

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  ['1 the door: Program → Edit cycle → the import button; the picker takes several photos or a PDF, the camera one photo; nothing to read yet', async ({ ev, tr, openSheet }) => {
    await openSheet();
    const s = await ev(readSheet);
    assert.equal(s.title, await tr('pi_title'), 'the sheet is titled «import from photos or a PDF»');
    assert.ok(s.placeholder && s.tiles.length === 0, 'no page picked: the placeholder, no tile');
    assert.equal(s.file.multiple, true, 'the file input takes SEVERAL files');
    assert.equal(s.file.accept, 'image/jpeg,image/png,image/webp,application/pdf,.pdf', 'and photos or a PDF: ' + s.file.accept);
    assert.equal(s.cam.multiple, false, 'the camera input adds ONE photo');
    assert.equal(s.cam.accept + ' ' + s.cam.capture, 'image/jpeg,image/png,image/webp environment', 'the camera takes a photo only, from the back camera');
    assert.equal(s.pick, await tr('pi_pick_images'), 'the pick button says photos or a PDF');
    assert.ok(s.camera.includes(await tr('take_photo')), 'the camera button: ' + s.camera);
    assert.deepEqual([s.read.text, s.read.disabled], [await tr('pi_read'), true], '«read schedule» is drawn and disabled with no page');
    assert.deepEqual(s.hints.slice(0, 2), [await tr('pi_privacy'), await tr('pi_limits')], 'the privacy line and the limits (6 photos or one PDF) under the buttons');
  }],

  ['2 two photos → two numbered tiles in order, each with its remove button; read enabled', async ({ ev, tr, page, openSheet, give }) => {
    await openSheet();
    await give(photos(2));
    const s = await ev(readSheet);
    assert.equal(s.tiles.length, 2, 'two tiles: ' + JSON.stringify(s.tiles.map((x) => x.kind)));
    assert.ok(!s.placeholder, 'the placeholder is gone');
    assert.deepEqual(s.tiles.map((x) => x.kind), ['image', 'image']);
    assert.deepEqual(s.tiles.map((x) => x.num), ['1', '2'], 'numbered 1 and 2 in Latin digits: ' + JSON.stringify(s.tiles.map((x) => x.num)));
    assert.deepEqual(s.tiles.map((x) => x.idx), ['0', '1'], 'in order');
    assert.ok(s.tiles.every((x) => /^data:image\/jpeg;base64,/.test(x.src)), 'each thumbnail is the prepared JPEG');
    assert.notEqual(b64(s.tiles[0].src), b64(s.tiles[1].src), 'two different pages');
    const pageWord = await tr('pi_page'), removeWord = await tr('pi_remove_page');
    assert.deepEqual(s.tiles.map((x) => x.alt), [pageWord.replace('{n}', '1'), pageWord.replace('{n}', '2')], 'each thumbnail is named «page n»');
    assert.deepEqual(s.tiles.map((x) => x.remove && x.remove.label), [removeWord.replace('{n}', '1'), removeWord.replace('{n}', '2')], 'each remove button says which page it removes');
    assert.ok(s.tiles.every((x) => x.remove && x.remove.tag === 'BUTTON' && !x.remove.disabled), 'a real, live button on each tile');
    assert.deepEqual(s.tiles.map((x) => x.rmCorner), ['top-end', 'top-end'], 'the remove button sits on the tile\'s top END corner (the left in Arabic): ' + JSON.stringify(s.tiles.map((x) => x.rmCorner)));
    assert.deepEqual(s.tiles.map((x) => x.numCorner), ['bottom-start', 'bottom-start'], 'the number on the bottom START corner: ' + JSON.stringify(s.tiles.map((x) => x.numCorner)));
    assert.deepEqual([s.read.text, s.read.disabled], [await tr('pi_read'), false], '«read schedule» is live');
    assert.equal(s.error, null, 'no error');
    assert.equal(await page.evaluate((sel) => document.querySelector(sel + ' [data-pi-file]').multiple, SHEET), true, 'the picker is redrawn still taking several files');
  }],

  ['3 remove the first → one tile numbered 1, the second photo', async ({ ev, tr, page, openSheet, give }) => {
    await openSheet();
    await give(photos(2));
    const before = await ev(readSheet);
    await page.click(SHEET + ' [data-pi-drop="0"]');
    const s = await ev(readSheet);
    assert.equal(s.tiles.length, 1, 'one tile left');
    assert.equal(s.tiles[0].num, '1', 'numbered 1 again');
    assert.equal(s.tiles[0].remove.label, (await tr('pi_remove_page')).replace('{n}', '1'), 'its remove button says page 1');
    assert.equal(b64(s.tiles[0].src), b64(before.tiles[1].src), 'and it is the SECOND photo — the first was removed');
    assert.equal(s.read.disabled, false, 'still something to read');
    await page.click(SHEET + ' [data-pi-drop="0"]');
    const e = await ev(readSheet);
    assert.ok(e.placeholder && e.tiles.length === 0 && e.read.disabled, 'remove the last: the placeholder is back and nothing to read');
  }],

  ['4 add one → order kept', async ({ ev, openSheet, give }) => {
    await openSheet();
    await give(photos(2));
    const before = await ev(readSheet);
    await give([photo(2)]);
    const s = await ev(readSheet);
    assert.equal(s.tiles.length, 3, 'three tiles');
    assert.deepEqual(s.tiles.map((x) => x.num), ['1', '2', '3']);
    assert.deepEqual(s.tiles.slice(0, 2).map((x) => b64(x.src)), before.tiles.map((x) => b64(x.src)), 'the first two are where they were');
    assert.ok(!before.tiles.some((x) => b64(x.src) === b64(s.tiles[2].src)), 'the new page is third');
    await give([photo(3)], 'cam');
    const c = await ev(readSheet);
    assert.equal(c.tiles.length, 4, 'the camera adds one more, fourth');
    assert.deepEqual(c.tiles.slice(0, 3).map((x) => b64(x.src)), s.tiles.map((x) => b64(x.src)), 'after the three');
  }],

  ['5 seven files → six tiles and «up to 6»', async ({ ev, tr, openSheet, give }) => {
    await openSheet();
    await give(photos(7));
    const s = await ev(readSheet);
    assert.equal(s.tiles.length, MAX_PAGES, 'six tiles, not seven: ' + s.tiles.length);
    assert.deepEqual(s.tiles.map((x) => x.num), ['1', '2', '3', '4', '5', '6']);
    assert.equal(s.error, await tr('pi_too_many'), 'and the seventh is said: «up to 6 photos»');
    assert.equal(s.read.disabled, false, 'the six can be read');
    await give([photo(0)]);
    const t2 = await ev(readSheet);
    assert.equal(t2.tiles.length, MAX_PAGES, 'a seventh picked later is refused too');
    assert.equal(t2.error, await tr('pi_too_many'));
  }],

  ['6 a PDF → one file tile with its name (escaped) and size; the photos gone; a photo after it replaces the PDF', async ({ ev, tr, page, openSheet, give }) => {
    await openSheet();
    await give(photos(2));
    await give([SMALL_PDF]);
    const s = await ev(readSheet);
    assert.equal(s.tiles.length, 1, 'ONE tile — the photos are gone: ' + JSON.stringify(s.tiles.map((x) => x.kind)));
    assert.equal(s.tiles[0].kind, 'pdf', 'the file tile');
    assert.equal(s.tiles[0].name, SMALL_PDF.name, 'its name');
    assert.equal(s.tiles[0].size, await sizeText(page, SMALL_PDF.buffer.length), 'its size in MB, one decimal, Latin digits: ' + s.tiles[0].size);
    assert.ok(s.tiles[0].glyph, 'the document glyph');
    assert.equal(s.tiles[0].num, null, 'no number on a lone file');
    assert.equal(s.tiles[0].remove.label, (await tr('pi_remove_page')).replace('{n}', '1'), 'a remove button');
    assert.equal(s.read.disabled, false, 'readable');
    // A name is untrusted text: printed, never parsed.
    await give([{ name: XSS_NAME, mimeType: 'application/pdf', buffer: pdf(0) }]);
    const x = await ev(readSheet);
    assert.equal(x.tiles[0].name, XSS_NAME, 'the name is printed as it is');
    assert.equal(x.tiles[0].nameChildren, 0, 'and holds no element');
    assert.equal(x.xss, null, 'nothing ran');
    assert.equal(x.tiles[0].size, await sizeText(page, pdf(0).length), 'a tiny file never reads «0 MB»: ' + x.tiles[0].size);
    // The kinds never mix: a photo picked now replaces the PDF.
    await give([photo(0)]);
    const p = await ev(readSheet);
    assert.deepEqual(p.tiles.map((x) => x.kind), ['image'], 'a photo after a PDF stands alone');
    assert.equal(p.tiles[0].num, '1');
    // Photos AND a PDF in one pick, or two PDFs: the whole pick is refused by
    // name and the strip does not move — the loop would otherwise keep
    // whichever came last and drop the rest unsaid.
    await give([photo(1), SMALL_PDF]);
    const q = await ev(readSheet);
    assert.equal(q.error, await tr('pi_mixed'), 'photos and a PDF together: «choose photos or one PDF, not both»: ' + q.error);
    assert.deepEqual(q.tiles.map((x) => [x.kind, x.src]), p.tiles.map((x) => [x.kind, x.src]), 'and the strip is as it was: ' + JSON.stringify(q.tiles.map((x) => x.kind)));
    await give([SMALL_PDF, { name: 'second.pdf', mimeType: 'application/pdf', buffer: pdf(0) }]);
    const q2 = await ev(readSheet);
    assert.equal(q2.error, await tr('pi_mixed'), 'two PDFs in one pick: refused the same way: ' + q2.error);
    assert.deepEqual(q2.tiles.map((x) => [x.kind, x.src]), p.tiles.map((x) => [x.kind, x.src]), 'the strip still as it was: ' + JSON.stringify(q2.tiles.map((x) => x.kind)));
  }],

  ['7 a PDF of 7 MB → refused by size', async ({ ev, tr, openSheet, give }) => {
    await openSheet();
    await give(photos(1));
    await give([{ name: 'big.pdf', mimeType: 'application/pdf', buffer: pdf(7000000) }]);
    const s = await ev(readSheet);
    assert.equal(s.error, await tr('pi_pdf_big'), '«choose a PDF up to 6 MB»: ' + s.error);
    assert.deepEqual(s.tiles.map((x) => x.kind), ['image'], 'the photo picked before stays');
    assert.ok(pdf(7000000).length > PDF_MAX, 'setup: the file is over the cap');
  }],

  ['8 a .txt → refused; a .pdf that is not a PDF → refused', async ({ ev, tr, openSheet, give }) => {
    await openSheet();
    await give(photos(1));
    await give([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bench 4x10') }]);
    let s = await ev(readSheet);
    assert.equal(s.error, await tr('pi_bad_file'), 'a text file: «choose JPG, PNG, WebP or a PDF»: ' + s.error);
    assert.equal(s.tiles.length, 1, 'the photo stays');
    await give([photo(1), { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
    s = await ev(readSheet);
    assert.equal(s.error, await tr('pi_bad_file'), 'a text file among photos refuses the pick');
    assert.equal(s.tiles.length, 1, 'and none of that pick is taken');
    await give([{ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf') }]);
    s = await ev(readSheet);
    assert.equal(s.error, await tr('pi_bad_file'), 'a .pdf whose first bytes are not %PDF: refused');
    assert.deepEqual(s.tiles.map((x) => x.kind), ['image'], 'the photo stays');
  }],

  ['9 read two photos → pages of two in order; the review renders the days; the source shows every page, each opening full size', async ({ ev, tr, page, worker, openSheet, give, read, viewFull }) => {
    await openSheet();
    await give([BIG_PHOTO, photo(1)]);
    const picked = await ev(readSheet);
    await read();
    assert.equal(worker.calls.length, 1, 'ONE request');
    const body = worker.calls[0];
    assert.equal(Object.keys(body).join(','), 'mode,pages', 'the new shape, and nothing else: ' + Object.keys(body).join(','));
    assert.equal(body.mode, 'workout-plan');
    assert.equal(body.pages.length, 2, 'two pages');
    assert.deepEqual(body.pages.map((p) => p.mimeType), ['image/jpeg', 'image/jpeg']);
    assert.ok(body.pages.every((p) => /^[A-Za-z0-9+/]+=*$/.test(p.data)), 'each page a base64 JPEG');
    const lens = body.pages.map((p) => p.data.length);
    assert.ok(Math.max(...lens) > 40000 && Math.max(...lens) > Math.min(...lens) * 4, 'setup: one page is the big table, the other the small square: ' + lens.join(', '));
    const s = await ev(readSheet);
    assert.ok(s.review, 'the review is up: ' + (s.error || ''));
    assert.equal(s.title, await tr('pi_review'));
    assert.deepEqual(s.review.days.map((d) => d.name), FIXTURE.days.map((d) => d.name), 'the fixture\'s days');
    assert.deepEqual(s.review.days.map((d) => d.rows.map((r) => r.name)), FIXTURE.days.map((d) => d.exercises.map((e) => e.name)), 'and its exercises');
    assert.deepEqual(s.review.days[0].rows.map((r) => r.sets + '|' + r.reps + '|' + r.notes), ['4|8–12|Rest 90 s', '3|10|'], 'sets, reps and notes as read');
    assert.equal(s.review.days[1].rows[0].sets, '', 'sets the model did not read stay blank');
    assert.equal(s.review.summary, await tr('pi_source'), 'the source is «view the source»');
    assert.deepEqual(s.review.source.map((x) => b64(x.src)), picked.tiles.map((x) => b64(x.src)), 'and shows EVERY page in order');
    assert.deepEqual(s.review.source.map((x) => x.num), ['1', '2'], 'numbered');
    assert.ok(s.review.source.every((x) => !x.remove), 'with no remove buttons');
    // THE SOURCE OPENS FULL SIZE. Each tile is a button named «page n» that
    // opens the lightbox on that page — the FULL picture, the very bytes the
    // Worker was sent, in the strip's order — while the tile itself carries a
    // small one (a redraw would otherwise re-serialise megabytes into 96 px
    // boxes). v309 showed its one photo at 320 px; a 96 px cover-cropped tile
    // cannot be checked against, which is what pi_review_hint asks for.
    await page.click(SHEET + ' .plan-import-source summary');
    const open = await ev(readSheet);
    const pageWord = await tr('pi_page');
    assert.ok(open.review.source.every((x) => x.view && x.view.tag === 'BUTTON'), 'each source tile is a button: ' + JSON.stringify(open.review.source.map((x) => x.view)));
    assert.deepEqual(open.review.source.map((x) => x.view.label), [pageWord.replace('{n}', '1'), pageWord.replace('{n}', '2')], 'named «page n»');
    assert.ok(open.review.source.every((x) => x.view.w >= 44 && x.view.h >= 44), 'a 44 px target at least: ' + JSON.stringify(open.review.source.map((x) => [x.view.w, x.view.h])));
    for (const i of [0, 1]) {
      const lb = await viewFull(i);
      assert.ok(lb, `tapping source tile ${i + 1} opens the lightbox`);
      assert.equal(lb.label, pageWord.replace('{n}', String(i + 1)), 'the lightbox is named «page n»: ' + lb.label);
      assert.equal(b64(lb.src), body.pages[i].data, `and shows page ${i + 1} full size — the bytes the Worker was sent, in the strip's order`);
      assert.notEqual(lb.src, open.review.source[i].src, `the tile of page ${i + 1} carries a smaller picture, not the full one`);
      assert.ok(open.review.source[i].src.length < 40000, `the tile's picture is small: ${open.review.source[i].src.length} chars`);
      assert.equal(lb.closed, true, 'the close button closes it');
    }
  }],

  ['10 read one photo → the old image shape', async ({ ev, worker, openSheet, give, read, viewFull }) => {
    await openSheet();
    await give(photos(1));
    await read();
    const body = worker.calls[0];
    assert.equal(Object.keys(body).join(','), 'mode,image', 'one photo travels as `image`, the shape a Worker from before v424 serves: ' + Object.keys(body).join(','));
    assert.equal(body.image.mimeType, 'image/jpeg');
    assert.ok(/^[A-Za-z0-9+/]+=*$/.test(body.image.data), 'a base64 JPEG');
    const s = await ev(readSheet);
    assert.ok(s.review && s.review.days.length === FIXTURE.days.length, 'and the review is up');
    assert.equal(s.review.source.length, 1, 'the source shows the one page');
    const lb = await viewFull(0);
    assert.ok(lb, 'the one source tile opens the lightbox');
    assert.equal(b64(lb.src), body.image.data, 'on the page the Worker was sent, full size');
    assert.notEqual(lb.src, s.review.source[0].src, 'while the tile carries a smaller picture');
  }],

  ['11 read a PDF → pages of one, application/pdf', async ({ ev, worker, openSheet, give, read }) => {
    await openSheet();
    await give([SMALL_PDF]);
    await read();
    const body = worker.calls[0];
    assert.equal(Object.keys(body).join(','), 'mode,pages', 'a PDF alone is `pages` of one: ' + Object.keys(body).join(','));
    assert.equal(body.pages.length, 1);
    assert.equal(body.pages[0].mimeType, 'application/pdf');
    assert.ok(body.pages[0].data.startsWith('JVBERi'), 'the data begins with %PDF in base64');
    assert.equal(body.pages[0].data, SMALL_PDF.buffer.toString('base64'), 'the file whole, as it is');
    const s = await ev(readSheet);
    assert.ok(s.review, 'the review is up: ' + (s.error || ''));
    assert.deepEqual(s.review.source.map((x) => [x.kind, x.name]), [['pdf', SMALL_PDF.name]], 'the source shows the file tile');
  }],

  ['12 an old Worker (400 no input on pages) → not available right now', async ({ ev, tr, worker, openSheet, give, read }) => {
    await openSheet();
    await give(photos(2));
    worker.queue.push({ status: 400, body: { error: 'no input' } });
    await read();
    const s = await ev(readSheet);
    assert.equal(s.review, null, 'no review');
    assert.equal(s.error, await tr('pi_unavailable'), '«not available right now», not «could not be read»: ' + s.error);
    assert.equal(s.tiles.length, 2, 'the pages stay picked');
    assert.equal(s.read.disabled, false, 'and can be read again');
    // The same answer to the OLD shape is the ordinary error: that Worker does serve it.
    worker.queue.push({ status: 400, body: { error: 'no input' } });
    await ev(() => document.querySelector('#modal-root [data-pi-drop="1"]').click());
    await read();
    const o = await ev(readSheet);
    assert.equal(o.error, await tr('pi_error'), 'one photo refused by its Worker: «could not be read»: ' + o.error);
  }],

  ['13 layout at 375 and 320 with «Larger text»: tiles wrap, no sideways overflow, every remove button 44 effective', async ({ ev, page, openSheet, give }) => {
    await openSheet();
    await give(photos(6));
    for (const [w, lg] of [[375, false], [375, true], [320, true]]) {
      await page.setViewportSize({ width: w, height: 812 });
      const l = await ev(layoutOf, lg);
      const at = `${w}px${lg ? ' + text-lg' : ''}`;
      assert.ok(l.rows >= 2, `${at}: six tiles wrap into rows (${l.rows})`);
      assert.deepEqual(l.spills, [], `${at}: nothing of the strip leaves the sheet side to side`);
      assert.ok(!l.modalScroll && !l.pageScroll, `${at}: no sideways scroll (modal ${l.modalScroll}, page ${l.pageScroll})`);
      assert.ok(l.tiles.every(([tw, th]) => tw === 96 && th === 96), `${at}: every tile 96 × 96: ${JSON.stringify(l.tiles)}`);
      assert.ok(l.hits.every((h) => h.drawn[0] === 36 && h.drawn[1] === 36), `${at}: the remove button is drawn 36: ${JSON.stringify(l.hits.map((h) => h.drawn))}`);
      assert.ok(l.hits.every((h) => h.miss.length === 0), `${at}: every remove button is 44 effective — misses: ${JSON.stringify(l.hits.map((h) => h.miss))}`);
    }
    // The PDF row at 320 under «Larger text»: the name is cut with an ellipsis, never the sheet.
    await give([{ name: 'a-very-long-schedule-file-name-that-does-not-fit-on-one-line-at-all.pdf', mimeType: 'application/pdf', buffer: pdf(0) }]);
    const f = await ev(() => {
      document.body.classList.add('text-lg');
      const modal = document.querySelector('#modal-root .modal-overlay:not(.is-out) .modal');
      const el = modal.querySelector('.plan-import-file'), nm = el.querySelector('.plan-import-file-name');
      const r = el.getBoundingClientRect(), m = modal.getBoundingClientRect();
      return { inside: r.left >= m.left - 1 && r.right <= m.right + 1, cut: nm.scrollWidth > nm.clientWidth + 1, ellipsis: getComputedStyle(nm).textOverflow, modalScroll: modal.scrollWidth > modal.clientWidth + 1, h: Math.round(r.height) };
    });
    assert.ok(f.inside && !f.modalScroll, '320 + text-lg: the file row stays inside the sheet');
    assert.ok(f.cut && f.ellipsis === 'ellipsis', 'a long name is cut with an ellipsis: ' + JSON.stringify(f));
    assert.ok(f.h >= 64, 'the row is at least 64 tall: ' + f.h);
    await page.setViewportSize({ width: 375, height: 812 });
  }],

  // ── THE SAVE NEVER DEMANDS WHAT THE USER ALREADY DID (v426) ────────────────
  // The owner saved a complete draft and read «name every day, link every
  // exercise to the library…» — all done. A name the library does not hold
  // now reads «new» with its category shown, Save takes it (the exercise is
  // created, category Other, and the planner opens); an exercise listed twice
  // in one workout saves as ONE with the sets summed and the repeat noted on
  // the second row; and what still refuses names the day, the row and the
  // field, and puts the finger on it.
  ['14 an unmatched name reads «new» with its category shown; Save takes the draft: the planner opens, the exercise exists, category Other', async ({ ev, page, openSheet, give, read, save }) => {
    await openSheet();
    await give(photos(1));
    await read();
    const s = await ev(readSheet);
    assert.ok(s.review, 'the review is up: ' + (s.error || ''));
    const rows = s.review.days[0].rows;
    const benchId = await ev(() => DB.exercises.list().find((e) => e.name === 'Bench Press').id);
    assert.equal(rows[0].exerciseId, benchId, 'a name the library holds is linked to it');
    assert.equal(rows[0].categoryShown, false, 'and shows no category select');
    assert.equal(rows[1].exerciseId, 'new', 'a name the library does not hold reads «new» — no tap needed: ' + JSON.stringify(rows[1].exerciseId));
    assert.equal(rows[1].categoryShown, true, 'with the category select shown');
    assert.equal(rows[1].category, 'Other', 'at Other');
    const before = await ev(() => DB.plan.get().cycle.length);
    await save();
    const after = await ev((sel) => {
      const c = DB.plan.get().cycle, ex = DB.exercises.list().find((e) => e.name === 'Cable press') || null;
      return { sheet: !!document.querySelector(sel), view: document.querySelector('.view.active')?.dataset.view, cycle: c.length,
        ex: ex && { isCustom: ex.isCustom, category: ex.category }, inSlot: !!ex && c[c.length - 2].exerciseIds.includes(ex.id) };
    }, SHEET);
    assert.equal(after.sheet, false, 'the sheet closed — nothing was demanded');
    assert.equal(after.view, 'planner', 'the planner opens: ' + after.view);
    assert.equal(after.cycle, before + FIXTURE.days.length, 'the workouts joined the cycle');
    assert.deepEqual(after.ex, { isCustom: true, category: 'Other' }, 'the exercise exists in the library, custom, category Other: ' + JSON.stringify(after.ex));
    assert.equal(after.inSlot, true, 'and the Push workout carries it');
  }],

  ['15 an exercise listed twice in one workout saves as one: sets summed, reps from the first, the notes joined and the repeat noted', async ({ ev, tr, worker, openSheet, give, read, save }) => {
    await openSheet();
    await give(photos(1));
    worker.queue.push({ status: 200, body: { plan: { days: [{ name: 'Push', exercises: [
      { name: 'Bench Press', sets: 3, reps: '8', notes: 'heavy' },
      { name: 'Pallof press', sets: 2, reps: '10', notes: '' },
      { name: 'Bench Press', sets: 2, reps: '12', notes: '' },
      { name: 'pallof press', sets: 1, reps: '', notes: 'slow' },
    ] }] } } });
    await read();
    const s = await ev(readSheet);
    assert.ok(s.review && s.review.days[0].rows.length === 4, 'the review shows the four rows as read');
    await save();
    const note = await tr('pi_merged_note');
    const got = await ev((sel) => {
      const c = DB.plan.get().cycle, slot = c[c.length - 1];
      return { sheet: !!document.querySelector(sel), ids: slot.exerciseIds, targets: slot.targets, names: slot.exerciseIds.map((id) => DB.exercises.getById(id)?.name),
        pallofs: DB.exercises.list().filter((e) => /pallof/i.test(e.name)).length };
    }, SHEET);
    assert.equal(got.sheet, false, 'saved — a repeat is never refused');
    assert.deepEqual(got.names, ['Bench Press', 'Pallof press'], 'two slot entries, not four, each at its first position: ' + JSON.stringify(got.names));
    assert.equal(got.pallofs, 1, 'the two spellings of the new name are one exercise');
    assert.deepEqual(got.targets[got.ids[0]], { sets: 5, reps: '8', notes: 'heavy · ' + note }, 'the library pair: sets summed, reps from the first, the notes joined and the repeat noted: ' + JSON.stringify(got.targets[got.ids[0]]));
    assert.deepEqual(got.targets[got.ids[1]], { sets: 3, reps: '10', notes: 'slow · ' + note }, 'the new pair likewise (same name by fold): ' + JSON.stringify(got.targets[got.ids[1]]));
  }],

  ['16 a cleared day name → «name workout 2» with its number, the finger on that field; a cleared row name → «workout 1: an exercise has no name», the finger on it; the draft stays', async ({ ev, tr, page, openSheet, give, read, save }) => {
    await openSheet();
    await give(photos(1));
    await read();
    await page.fill(SHEET + ' #pi-day-1', '');
    await save();
    let s = await ev(readSheet);
    assert.ok(s && s.review, 'the review stays up with the draft');
    const two = await ev(() => fmtNum(2)), one = await ev(() => fmtNum(1));
    assert.equal(s.error, (await tr('pi_err_day_name')).replace('{n}', two), 'ONE line naming the workout by number, the number filled in: ' + s.error);
    assert.equal(s.active, 'pi-day-1', 'and the finger lands on that name field: ' + s.active);
    await page.fill(SHEET + ' #pi-day-1', 'Legs');
    await page.fill(SHEET + ' #pi-0-1-name', '');
    await save();
    s = await ev(readSheet);
    assert.equal(s.error, (await tr('pi_err_row_name')).replace('{n}', one), 'a nameless row: the line names its workout: ' + s.error);
    assert.equal(s.active, 'pi-0-1-name', 'and the finger lands on that row\'s name: ' + s.active);
    assert.equal(s.review.days.length, FIXTURE.days.length, 'the draft is still whole');
  }],

  ['17 sets «ab» → «workout 1, exercise 2: sets are 1–20 or blank», the finger on that field', async ({ ev, tr, page, openSheet, give, read, save }) => {
    await openSheet();
    await give(photos(1));
    await read();
    await page.fill(SHEET + ' #pi-0-1-sets', 'ab');
    await save();
    const s = await ev(readSheet);
    assert.ok(s && s.review, 'the review stays up');
    const one = await ev(() => fmtNum(1)), two = await ev(() => fmtNum(2));
    assert.equal(s.error, (await tr('pi_err_sets')).replace('{n}', one).replace('{m}', two), 'the line names the workout and the exercise, both figures filled in: ' + s.error);
    assert.equal(s.active, 'pi-0-1-sets', 'and the finger lands on that sets field: ' + s.active);
  }],

  ['18 no training day → «choose your training days», the finger on the strip', async ({ ev, tr, openSheet, give, read, save }) => {
    await openSheet();
    await give(photos(1));
    await read();
    await ev(() => document.querySelectorAll('#modal-root [data-pi-weekday].active').forEach((b) => b.click()));
    assert.equal(await ev(() => document.querySelectorAll('#modal-root [data-pi-weekday].active').length), 0, 'setup: every weekday off');
    await save();
    const s = await ev(readSheet);
    assert.ok(s && s.review, 'the review stays up');
    assert.equal(s.error, await tr('pi_err_days'), 'its own line, not the general one: ' + s.error);
    assert.ok(/^weekday:/.test(s.active || ''), 'and the finger lands on the weekday strip: ' + s.active);
  }],
];

async function run() {
  const srv = start('in');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;   // QA_ONLY=<words>: re-run one case while planting a defect
        let watchdog = null;
        try {
          kit.fresh();
          // A case that hangs fails here, named, instead of holding the pool.
          await Promise.race([fn({ ...kit, browser, origin }), new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error(`the case ran past ${CASE_MS / 1000} s`)), CASE_MS); })]);
          passed++; console.log(`  ok    ${lang}/${theme}  ${name}`);
        } catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
        finally { clearTimeout(watchdog); }
        await kit.reset('home').catch(() => {});
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  plan import UI: ${failures.length} failed`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  plan import UI (${passed} cases, AR/dark + EN/light, 375px): the schedule from several photos or one PDF (v424) — the door from Program, a picker of several files, numbered tiles in order with their remove buttons, the kinds never mixed, the seventh and the oversize PDF and the wrong kind each refused by name, a pick holding both kinds refused whole, pages in order on the wire and the old image shape for one photo, an old Worker named, the review and its source opening each page full size, the strip at 375 and 320 under «Larger text»; and (v426) an unmatched name saved as new with no tap, a repeat merged with its note, a refusal naming the day, row and field with the finger on it`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
