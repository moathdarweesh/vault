#!/usr/bin/env node
// WHEN THE AI FAILS, NOTHING THE USER GAVE IT IS LOST — and one tap sends it
// again. Driven in a real browser against the three ways to ask the AI for a
// meal: the typed chat, the photo (with its note) and the voice recording.
//
// Before this, js/foodai.js run() cleared the box BEFORE the call, so a
// timeout or a busy Worker cost the whole typed meal; the photo path replaced
// its pending block with the error, so the plate had to be shot again; the
// voice sheet dropped the recording. Up to WORKER_DEADLINE_MS (90 s) the only
// feedback was a still «جارٍ الحساب…».
//
// What each case pins:
//   · a failure that a second try can fix (a 502, a dropped/timed-out request)
//     restores the typed text and puts ONE «أعد المحاولة» beside the error;
//     the retry resends exactly what was kept (the same text, the same image
//     bytes + note, the same recording) and the answer lands in the same row;
//   · a failure a retry cannot fix (the daily limit, not signed in, an
//     unreadable image, a file too large) shows no button — and still keeps
//     the typed text;
//   · after about 8 s of waiting on a photo, one calm line says photos can
//     take up to a minute, and it leaves with the answer;
//   · the fixer's pass (the review of 2026-09-27): the upstream RATE_LIMIT —
//     billed to the daily budget before it is answered — draws the button OFF
//     for the minute its sentence names; the timeout sentence beside a button
//     drops its own «try again»; a photo that was never prepared offers no
//     retry; a keyboard retry keeps focus inside the sheet; failures and the
//     slow line are written into a live region that exists, empty, from the
//     first paint (#ai-live, and #voice-status / #voice-retry). Each of these
//     was seen failing on the builder's tree, or on a planted defect where an
//     earlier assertion in the same case masked it.
//
// THE WORKER IS NEVER CALLED. The harness (scripts/fp/server.js) aborts every
// request that is not 127.0.0.1, and on top of that fence this suite routes the
// Worker's host to a stub that answers from a queue each case fills (a 502 then
// a 200, an aborted request, a DAILY_LIMIT body …). `fulfill`/`abort` only —
// the handler never calls route.continue(), so nothing can leave the machine.
//
// Standalone: it runs itself behind the require.main guard. QA_ONLY=<words>
// re-runs one case while planting a defect.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const WORKER_HOST = 'vault-calories.moathdarweesh2000.workers.dev';

// A real 1×1 PNG (decodes in processImage) and bytes that are not an image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const NOT_IMAGE = Buffer.from('this is not a picture of anything at all');
const FOOD = { items: [{ name: 'Boiled egg', calories: 155, protein: 13, carbs: 1, fat: 11 }] };
const VOICE = { transcript: 'two boiled eggs', items: [{ name: 'Boiled egg', calories: 155, protein: 13, carbs: 1, fat: 11 }] };
const BAD_GATEWAY = { status: 502, body: { error: 'upstream' } };
const DAILY = { status: 429, body: { error: 'daily limit', code: 'DAILY_LIMIT' } };

// ── the page kit ────────────────────────────────────────────────────────────
async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    colorScheme: theme,
    timezoneId: 'Asia/Riyadh',
    locale: lang === 'ar' ? 'ar-SA' : 'en-US',
    permissions: ['microphone'],
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The fence aborts fonts and the live hosts, and the stub answers 4xx/5xx on
  // purpose; Chrome logs each as a resource error.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  // THE WORKER STUB — registered after the fence, so it wins for this host.
  const worker = { queue: [], calls: [] };
  await page.route((url) => url.hostname === WORKER_HOST, async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = null;
    try { body = req.postDataJSON(); } catch (_) { body = null; }
    worker.calls.push(body);
    const next = worker.queue.shift() || { status: 500, body: { error: 'upstream' } };
    if (next.delay) await new Promise((r) => setTimeout(r, next.delay));
    if (next.abort) return route.abort(next.abort);
    return route.fulfill({ status: next.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(next.body) });
  });
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && typeof DB !== 'undefined' && typeof FoodAI !== 'undefined');
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked();
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = (view, ctx) => ev(({ view, ctx }) => {
    try { closeModal(); } catch (_) {}
    hideToast();
    document.querySelectorAll('#modal-root .modal-overlay.nested').forEach((s) => s.remove());
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx || {});
  }, { view, ctx });
  const settled = () => page.waitForFunction(() => !document.querySelector('.view.active.enter, .view.active .enter'), null, { timeout: 3000 });
  const fresh = () => { worker.queue.length = 0; worker.calls.length = 0; };
  return { ctx, page, ev, reset, settled, errors, guard, lang, theme, worker, fresh };
}

// What the chat panel shows right now, read in the page.
const chatLook = () => {
  const box = document.getElementById('ai-results');
  const errs = [...box.querySelectorAll('.ai-err')];
  const retries = [...box.querySelectorAll('.ai-retry')];
  return {
    input: (document.getElementById('ai-input') || {}).value,
    err: errs.map((e) => e.textContent.trim()),
    retries: retries.length,
    retryLabel: retries[0] ? retries[0].textContent.trim() : null,
    retryBesideErr: retries.every((b) => !!b.closest('.ai-pending') && !!b.closest('.ai-pending').querySelector('.ai-err')),
    cards: box.querySelectorAll('.ai-card').length,
    questions: [...box.querySelectorAll('.ai-q')].map((q) => q.textContent.trim()),
    thumbs: box.querySelectorAll('.ai-photo-thumb').length,
    slow: [...box.querySelectorAll('.ai-slow')].map((s) => s.textContent.trim()),
    want: { retry: t('ai_retry'), error: t('ai_error'), network: t('auth_err_network'), daily: t('ai_daily_limit'),
      signin: t('ai_err_signin'), large: t('ai_err_too_large'), unreadable: t('ai_err_image_read'), slowPhoto: t('ai_slow_photo') },
  };
};

async function openChat({ ev, reset, settled, page }) {
  await reset('food'); await settled().catch(() => {});
  await ev(() => FoodAI.open(null));
  await page.waitForSelector('#ai-input');
}
async function openPhoto({ ev, reset, settled, page }) {
  await reset('food'); await settled().catch(() => {});
  await ev(() => FoodAI.openPhoto(null));
  await page.waitForSelector('#ai-file-gal', { state: 'attached' });
}
async function pickPhoto(page, buffer, mimeType, note) {
  await page.setInputFiles('#ai-file-gal', { name: 'plate.' + (mimeType === 'image/png' ? 'png' : 'jpg'), mimeType, buffer });
  await page.waitForSelector('#ai-results .ai-note-input');
  if (note) await page.locator('#ai-results .ai-note-input').fill(note);
  await page.locator('#ai-results .ai-note-go').click();
}

// ── the cases ───────────────────────────────────────────────────────────────
const CASES = [
  ['chat: a 502 keeps the typed meal in the box, ONE retry beside the error resends it, the answer lands in the same row', async (kit) => {
    const { page, ev, worker, fresh, lang } = kit;
    fresh();
    const text = 'two boiled eggs and toast ' + lang;
    await openChat(kit);
    worker.queue.push(BAD_GATEWAY, { status: 200, body: FOOD });
    await page.locator('#ai-input').fill(text);
    await page.locator('#ai-send').click();
    await page.waitForSelector('#ai-results .ai-err');
    let g = await ev(chatLook);
    assert.equal(g.input, text, 'the typed meal is back in the box');
    assert.deepEqual(g.err, [g.want.error], 'the error is said once');
    assert.equal(g.retries, 1, 'one retry button');
    assert.equal(g.retryLabel, g.want.retry, 'it says «' + g.want.retry + '»');
    assert.equal(g.retryBesideErr, true, 'the retry sits in the failed row, beside its error');
    await page.locator('#ai-results .ai-retry').click();
    await page.waitForSelector('#ai-results .ai-card');
    g = await ev(chatLook);
    assert.equal(g.cards, 1, 'the retry\'s answer is on screen');
    assert.equal(g.retries, 0, 'the button left with the error'); assert.deepEqual(g.err, []);
    assert.deepEqual(g.questions, [text], 'the same row, not a second question');
    assert.equal(g.input, '', 'the box is emptied once the meal was answered');
    assert.equal(worker.calls.length, 2, 'two Worker calls: the failure and the retry');
    assert.equal(worker.calls[1].text, text, 'the retry resent the exact text');
  }],

  ['chat: a request that times out keeps the text, and sending the restored text again reuses the failed row', async (kit) => {
    const { page, ev, worker, fresh, lang } = kit;
    fresh();
    const text = 'a bowl of lentil soup ' + lang;
    await openChat(kit);
    worker.queue.push({ abort: 'timedout' }, { status: 200, body: FOOD });
    await page.locator('#ai-input').fill(text);
    await page.locator('#ai-input').press('Enter');
    await page.waitForSelector('#ai-results .ai-err');
    let g = await ev(chatLook);
    assert.equal(g.input, text, 'the typed meal is back in the box');
    assert.deepEqual(g.err, [g.want.network], 'the dropped request is named as the connection');
    assert.equal(g.retries, 1, 'a dropped request is worth a retry');
    await page.locator('#ai-input').press('Enter');   // the user sends the restored text instead of tapping the button
    await page.waitForSelector('#ai-results .ai-card');
    g = await ev(chatLook);
    assert.deepEqual(g.questions, [text], 'one row for one meal, however it was resent');
    assert.equal(g.cards, 1); assert.equal(g.retries, 0); assert.equal(g.input, '');
    assert.equal(worker.calls.length, 2);
    assert.equal(worker.calls[1].text, text);
  }],

  ['chat: the daily limit and a signed-out caller keep the text but offer no retry', async (kit) => {
    const { page, ev, worker, fresh, lang } = kit;
    fresh();
    await openChat(kit);
    const text = 'grilled chicken with rice ' + lang;
    worker.queue.push(DAILY);
    await page.locator('#ai-input').fill(text);
    await page.locator('#ai-send').click();
    await page.waitForSelector('#ai-results .ai-err');
    let g = await ev(chatLook);
    assert.deepEqual(g.err, [g.want.daily], 'the daily limit is named');
    assert.equal(g.retries, 0, 'a retry cannot beat the daily limit');
    assert.equal(g.input, text, 'the text is kept all the same');
    // Not signed in: the Worker refuses the caller.
    const text2 = 'a cup of yogurt ' + lang;
    worker.queue.push({ status: 401, body: { error: 'unauthorized' } });
    await page.locator('#ai-input').fill(text2);
    await page.locator('#ai-send').click();
    await page.waitForFunction(() => document.querySelectorAll('#ai-results .ai-err').length === 2);
    g = await ev(chatLook);
    assert.equal(g.err[1], g.want.signin, 'not signed in is named');
    assert.equal(g.retries, 0, 'a retry cannot sign anyone in');
    assert.equal(g.input, text2);
    assert.equal(worker.calls.length, 2);
  }],

  ['chat: the upstream RATE_LIMIT holds the button off for the minute its sentence names — a tap now would spend a daily slot on the same quota', async (kit) => {
    // The Worker answers RATE_LIMIT only AFTER it has charged the caller's
    // daily budget (every model refused), and the sentence beside the button
    // says «try again in a minute». A live «أعد المحاولة» contradicted it.
    const { page, ev, worker, fresh, lang } = kit;
    fresh();
    await openChat(kit);
    worker.queue.push({ status: 429, body: { error: 'rate_limited', code: 'RATE_LIMIT' } });
    await page.locator('#ai-input').fill('a plate of hummus ' + lang);
    await page.locator('#ai-send').click();
    await page.waitForSelector('#ai-results .ai-err');
    const g = await ev(() => { const b = document.querySelector('#ai-results .ai-retry'); return { n: document.querySelectorAll('#ai-results .ai-retry').length, off: !!(b && b.disabled), err: document.querySelector('#ai-results .ai-err').textContent.trim(), want: t('ai_rate_limit') }; });
    assert.equal(g.err, g.want, 'the busy sentence');
    assert.equal(g.n, 1, 'the button is there, for when the minute is up');
    assert.equal(g.off, true, 'and it is off until then');
    await page.locator('#ai-results .ai-retry').click({ force: true });
    await page.waitForTimeout(150);
    assert.equal(worker.calls.length, 1, 'a tap inside the minute sends nothing');
  }],

  ['chat: a timed-out answer says «try again» once — the sentence beside the button carries no call of its own', async (kit) => {
    // friendlyErr's timeout sentence ends «— أعد المحاولة», and the button
    // beside it reads «أعد المحاولة»: the same words twice (v387).
    const { page, ev, fresh, lang } = kit;
    fresh();
    await openChat(kit);
    await ev(() => { window.__qaAnalyze = FoodAI.analyze; FoodAI.analyze = () => Promise.reject(new DOMException('deadline', 'TimeoutError')); });
    try {
      await page.locator('#ai-input').fill('a slow question ' + lang);
      await page.locator('#ai-send').click();
      await page.waitForSelector('#ai-results .ai-err');
      const g = await ev(() => {
        const row = document.querySelector('#ai-results .ai-err').closest('.ai-pending');
        const text = row.textContent.toLowerCase(), word = t('ai_retry').toLowerCase();
        return { n: text.split(word).length - 1, retries: row.querySelectorAll('.ai-retry').length, text: row.textContent.trim() };
      });
      assert.equal(g.retries, 1, 'a timeout is worth a retry');
      assert.equal(g.n, 1, '«try again» is said once in the row: ' + g.text);
    } finally { await ev(() => { FoodAI.analyze = window.__qaAnalyze; }); }
  }],

  ['chat: «try again» by keyboard keeps focus in the sheet — on the row while it asks, on the new button if it fails again, in the sheet when it lands; and a live region says the failure', async (kit) => {
    const { page, ev, worker, fresh, lang } = kit;
    fresh();
    await openChat(kit);
    const live0 = await ev(() => { const l = document.querySelector('#modal-root [aria-live]'); window.__qaLive = l; return !!l && !l.textContent.trim(); });
    assert.equal(live0, true, 'an empty live region exists before anything is said');
    worker.queue.push(BAD_GATEWAY, { ...BAD_GATEWAY, delay: 700 }, { status: 200, body: FOOD });
    await page.locator('#ai-input').fill('rice and lentils ' + lang);
    await page.locator('#ai-send').click();
    await page.waitForSelector('#ai-results .ai-retry');
    const said = await ev(() => ({ same: document.querySelector('#modal-root [aria-live]') === window.__qaLive && window.__qaLive.isConnected, text: window.__qaLive.textContent.trim(), want: t('ai_error') }));
    assert.equal(said.same, true, 'the same live region, not a new one inserted already filled');
    assert.ok(said.text.includes(said.want), 'the live region says the failure: «' + said.text + '»');
    const where = () => ev(() => ({ inModal: !!document.activeElement?.closest('#modal-root'), tag: document.activeElement?.tagName, retry: !!document.activeElement?.matches('.ai-retry') }));
    await page.locator('#ai-results .ai-retry').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    let f = await where();
    assert.equal(f.inModal, true, 'mid-request focus stays in the sheet (was ' + f.tag + ')');
    await page.waitForSelector('#ai-results .ai-retry:not([disabled])');
    f = await where();
    assert.equal(f.retry, true, 'a second failure puts focus on its new button (was ' + f.tag + ')');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ai-results .ai-card');
    f = await where();
    assert.equal(f.inModal, true, 'after the answer focus is still in the sheet (was ' + f.tag + ')');
    assert.equal(worker.calls.length, 3);
  }],

  ['FoodAI.canRetry says yes to what a second try can fix and no to the rest', async ({ ev }) => {
    const g = await ev(() => {
      const err = (msg, name) => { const e = new Error(msg); if (name) e.name = name; return e; };
      if (typeof FoodAI.canRetry !== 'function') return null;
      return {
        timeout: FoodAI.canRetry(err('timeout', 'TimeoutError')),
        network: FoodAI.canRetry(new TypeError('Failed to fetch')),
        upstream: FoodAI.canRetry(err('upstream')),
        busy: FoodAI.canRetry(err('rate limited')),
        signin: FoodAI.canRetry(err('unauthorized')),
        unreadable: FoodAI.canRetry(err('image load failed')),
        pixels: FoodAI.canRetry(err('image too large')),
        audio: FoodAI.canRetry(err('audio too large')),
        daily: FoodAI.canRetry(err('daily limit')),
      };
    });
    assert.ok(g, 'FoodAI exports canRetry');
    assert.deepEqual(g, { timeout: true, network: true, upstream: true, busy: true, signin: false, unreadable: false, pixels: false, audio: false, daily: false });
  }],

  ['photo: a 502 keeps the picture and the note, and the retry resends the same image with the same note', async (kit) => {
    const { page, ev, worker, fresh } = kit;
    fresh();
    await openPhoto(kit);
    worker.queue.push(BAD_GATEWAY, { status: 200, body: FOOD });
    const note = 'fried in olive oil';
    await pickPhoto(page, PNG, 'image/png', note);
    await page.waitForSelector('#ai-results .ai-err');
    let g = await ev(chatLook);
    assert.equal(g.thumbs, 1, 'the photo is still in the row');
    assert.deepEqual(g.questions, [note], 'the note is still in the row');
    assert.deepEqual(g.err, [g.want.error]);
    assert.equal(g.retries, 1, 'one retry button'); assert.equal(g.retryBesideErr, true);
    await page.locator('#ai-results .ai-retry').click();
    await page.waitForSelector('#ai-results .ai-card');
    g = await ev(chatLook);
    assert.equal(g.cards, 1); assert.equal(g.retries, 0); assert.equal(g.thumbs, 1, 'one photo row, not two');
    assert.equal(worker.calls.length, 2);
    assert.ok(worker.calls[0].image && worker.calls[0].image.data, 'the first call carried the image');
    assert.equal(worker.calls[1].image.data, worker.calls[0].image.data, 'the retry resent the same image bytes');
    assert.ok(String(worker.calls[1].prompt).includes(note), 'and the same note');
  }],

  ['photo: an unreadable image and a too-large answer offer no retry', async (kit) => {
    const { page, ev, worker, fresh } = kit;
    fresh();
    await openPhoto(kit);
    await pickPhoto(page, NOT_IMAGE, 'image/jpeg', '');
    await page.waitForSelector('#ai-results .ai-err');
    let g = await ev(chatLook);
    assert.deepEqual(g.err, [g.want.unreadable], 'the unreadable image is named');
    assert.equal(g.retries, 0, 'the same bytes will not decode on a second try');
    assert.equal(worker.calls.length, 0, 'nothing was sent');
    worker.queue.push({ status: 413, body: { error: 'image too large' } });
    await pickPhoto(page, PNG, 'image/png', '');
    await page.waitForFunction(() => document.querySelectorAll('#ai-results .ai-err').length === 2);
    g = await ev(chatLook);
    assert.equal(g.err[1], g.want.large, 'too large is named');
    assert.equal(g.retries, 0, 'the same file is as large on a second try');
    assert.equal(worker.calls.length, 1);
  }],

  ['photo: a picture that could not be prepared for another reason (no canvas) offers no retry — there is nothing to send again', async (kit) => {
    // processImage rejected with a TypeError (a canvas API missing on an old
    // WebView); canRetry said yes to TypeError, and every tap failed the same
    // way locally without sending anything.
    const { page, ev, worker, fresh } = kit;
    fresh();
    await openPhoto(kit);
    await ev(() => { window.__qaGetContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = () => null; });
    try {
      await pickPhoto(page, PNG, 'image/png', '');
      await page.waitForSelector('#ai-results .ai-err');
      const g = await ev(chatLook);
      assert.equal(g.retries, 0, 'no image was made, so no retry is offered');
      assert.equal(worker.calls.length, 0, 'and nothing was sent');
    } finally { await ev(() => { HTMLCanvasElement.prototype.getContext = window.__qaGetContext; }); }
  }],

  ['photo: after about 8 s of waiting one calm line says photos can take up to a minute, and it leaves with the answer', async (kit) => {
    const { page, ev, worker, fresh } = kit;
    fresh();
    await openPhoto(kit);
    worker.queue.push({ status: 200, body: FOOD, delay: 10500 });
    const t0 = Date.now();
    await pickPhoto(page, PNG, 'image/png', '');
    await page.waitForTimeout(4000);
    let g = await ev(chatLook);
    assert.deepEqual(g.slow, [], 'nothing extra in the first seconds');
    await page.waitForSelector('#ai-results .ai-slow', { timeout: 8000 });
    const at = Date.now() - t0;
    assert.ok(at >= 7500, 'the line waits about 8 s (' + at + ' ms)');
    g = await ev(chatLook);
    assert.deepEqual(g.slow, [g.want.slowPhoto], 'one line, the photo sentence');
    const live = await ev(() => { const l = document.querySelector('#modal-root [aria-live]'); return { text: l ? l.textContent.trim() : null, filledStatus: document.querySelectorAll('#ai-results .ai-slow[role="status"]').length }; });
    assert.equal(live.text, g.want.slowPhoto, 'the sheet\'s live region says it too');
    assert.equal(live.filledStatus, 0, 'no status node inserted already filled (often never read)');
    await page.waitForSelector('#ai-results .ai-card', { timeout: 15000 });
    g = await ev(chatLook);
    assert.deepEqual(g.slow, [], 'the line leaves with the answer');
    assert.equal(g.cards, 1);
  }],

  ['voice: a 502 keeps the recording and the retry resends it; the daily limit offers no retry', async (kit) => {
    const { page, ev, worker, fresh, reset, settled } = kit;
    fresh();
    await reset('food'); await settled().catch(() => {});
    await ev(() => openVoiceCapture(null, () => {}));
    await page.waitForSelector('#voice-mic');
    assert.equal(await ev(() => document.getElementById('voice-status').getAttribute('aria-live')), 'polite', 'the status line is a live region from the start');
    const record = async () => {
      await page.locator('#voice-mic').click();
      await page.waitForSelector('#voice-mic.recording', { timeout: 5000 });
      await page.waitForTimeout(800);
      await page.locator('#voice-mic').click();
    };
    const look = () => ev(() => {
      const stage = document.querySelector('#modal-root .modal-overlay:last-child') || document;
      const retries = [...stage.querySelectorAll('.ai-retry')];
      return {
        status: (document.getElementById('voice-status') || {}).textContent,
        retries: retries.length, label: retries[0] ? retries[0].textContent.trim() : null,
        cards: document.querySelectorAll('#voice-results .ai-card').length,
        want: { error: t('ai_error'), retry: t('ai_retry'), daily: t('ai_daily_limit'), processing: t('voice_processing') },
      };
    });
    worker.queue.push(BAD_GATEWAY, { status: 200, body: VOICE });
    await record();
    await page.waitForFunction(() => document.getElementById('voice-status').textContent === t('ai_error'), null, { timeout: 15000 });
    let g = await look();
    assert.equal(g.retries, 1, 'one retry button'); assert.equal(g.label, g.want.retry);
    assert.equal(worker.calls.length, 1);
    assert.ok(worker.calls[0].audio && worker.calls[0].audio.data, 'the first call carried the recording');
    await page.locator('#modal-root .ai-retry').click();
    await page.waitForSelector('#voice-results .ai-card', { timeout: 15000 });
    g = await look();
    assert.equal(g.cards, 1, 'the retry\'s answer is on screen'); assert.equal(g.retries, 0, 'the button left with the error');
    assert.equal(worker.calls.length, 2);
    assert.equal(worker.calls[1].audio.data, worker.calls[0].audio.data, 'the retry resent the same recording');
    // The daily limit: a new recording, no button.
    worker.queue.push(DAILY);
    await record();
    await page.waitForFunction(() => document.getElementById('voice-status').textContent === t('ai_daily_limit'), null, { timeout: 15000 });
    g = await look();
    assert.equal(g.retries, 0, 'a retry cannot beat the daily limit');
    assert.equal(worker.calls.length, 3);
    // The upstream RATE_LIMIT: the same rule as the chat — the button waits out the minute.
    worker.queue.push({ status: 429, body: { error: 'rate_limited', code: 'RATE_LIMIT' } });
    await record();
    await page.waitForFunction(() => document.getElementById('voice-status').textContent === t('ai_rate_limit'), null, { timeout: 15000 });
    const off = await ev(() => { const b = document.querySelector('#voice-retry .ai-retry'); return b ? b.disabled : null; });
    assert.equal(off, true, 'the voice retry is off for the minute its sentence names');
  }],
];

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const failures = [];
  let passed = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;   // QA_ONLY=<words>: re-run one case while planting a defect
        try { await fn({ ...kit, browser, origin }); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  AI retry UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  AI retry UI (${passed} cases, AR/dark + EN/light, 375px, the Worker stubbed): a 502 or a dropped request keeps the typed meal in the box and puts ONE «أعد المحاولة» beside the error that resends the exact text into the same row (and sending the restored text reuses that row); the photo keeps its picture and note and the retry resends the same image bytes and note; the voice sheet keeps the recording and resends it; the daily limit, a signed-out caller, an unreadable image and a too-large file offer no retry; after ~8 s on a photo one calm line says photos can take up to a minute, and it leaves with the answer; the upstream RATE_LIMIT holds the button off for its minute (chat and voice); a timeout says «try again» once; a photo never prepared offers no retry; a keyboard retry keeps focus in the sheet; failures and the slow line are written into a live region present from the start`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
