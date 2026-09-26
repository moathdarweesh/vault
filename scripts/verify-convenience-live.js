// Explicit opt-in: creates two temporary accounts, probes ONLY their rows and
// folders, then deletes them. Uses the normal Turnstile flow; credentials and
// tokens remain in process memory. NOT part of any gate.
//
// THE PROBE LEDGER (access-control audit 2026-09-27). Every isolation question
// below is registered by NAME and must be answered by name, or the run FAILS
// at the end — the previous version called `Cloud.getClient()`, which
// js/cloud.js no longer exports, and threw before proving anything; and even
// when it ran it asked only whether B could SELECT A's blob. Now, as B against
// A's rows: the blob and its history (read), an UPDATE and an UPSERT with A's
// user_id and an INSERT into A's history (write), A's folder in the image
// bucket (list / download / upload), profiles / user_flags / feedback /
// client_errors (read), the admin RPCs (expect 'not authorized'), and every
// door without a session (anon). The probe clients are built IN THE PAGE from
// the same URL and publishable key js/cloud.js ships, with the token pinned as
// a header — nothing reaches into Cloud's own client.
'use strict';
if (!process.argv.includes('--live')) throw new Error('Pass --live to authorize temporary live test accounts.');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const origin = 'https://moathdarweesh.github.io/vault/';
const created = [];

const PROBES = ['read-blob', 'read-history', 'write-update', 'write-upsert', 'write-history',
  'storage-list', 'storage-download', 'storage-upload',
  'read-profiles', 'read-flags', 'read-feedback', 'read-errors', 'rpc-admin', 'anon', 'row-intact'];
const answered = new Set();
function answer(name, ok, detail) {
  if (!PROBES.includes(name)) throw new Error('unregistered probe: ' + name);
  if (!ok) throw new Error('PROBE ' + name + ' FAILED: ' + detail);
  answered.add(name);
  console.log('  probe ' + name + ': ok' + (detail ? ' — ' + detail : ''));
}
const say = (r) => JSON.stringify(r).slice(0, 200);
const refused = (r) => !!(r.error && (r.error.code === '42501' || /row-level security|permission denied|not authorized|violates/i.test(r.error.message || '')));
const empty = (r) => !r.error && Array.isArray(r.data) && r.data.length === 0;

async function main() {
  const browser = await chromium.launch({channel: 'chrome', headless: !process.argv.includes('--headed')});
  const cloud = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf8');
  const url = cloud.match(/const SUPABASE_URL = '([^']+)'/)[1], key = cloud.match(/const SUPABASE_ANON_KEY = '([^']+)'/)[1];
  async function pageForTest() {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', message => { if (message.text().includes('Turnstile')) console.log(message.text().slice(0, 300)); });
    await page.route(origin + '**', async route => {
      const name = new URL(route.request().url()).pathname.replace('/vault/', '');
      if (!name) return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body><div id="captcha"></div><script src="js/vendor/supabase.js"></script><script src="js/cloud.js"></script><script src="js/storage.js"></script></body></html>'});
      if (['js/vendor/supabase.js', 'js/cloud.js', 'js/storage.js'].includes(name)) return route.fulfill({contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, '..', name), 'utf8')});
      return route.abort();
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.DB && window.Cloud);
    return page;
  }
  async function signup() {
    const page = await pageForTest();
    const email = 'vault-qa-' + randomUUID() + '@example.com', password = randomUUID() + 'Aa9!';
    const automatic = await page.evaluate(async ({url, key}) => {
      const response = await fetch(url + '/auth/v1/settings', {headers: {apikey: key}});
      const settings = await response.json(); return settings.mailer_autoconfirm === true && !settings.disable_signup;
    }, {url, key});
    assert.ok(automatic, 'Do not create an account needing email confirmation');
    const result = await page.evaluate(async ({email, password}) => {
      await Cloud.captcha.mount(document.getElementById('captcha'));
      const token = await Cloud.captcha.token(25000);
      if (!token) return {error: 'CAPTCHA_NOT_SOLVED'};
      const result = await Cloud.signUp(email, password, token);
      return {error: result.error || null, id: result.user?.id, session: !!result.session};
    }, {email, password});
    if (result.id) created.push({page, id: result.id});
    assert.ok(!result.error, result.error || 'signup'); assert.ok(result.session, 'Immediate session required');
    assert.equal(await page.evaluate(() => Cloud.resolveOnLogin()), 'pushed');
    return page;
  }
  try {
    const a = await signup(); console.log('Temporary account A ready');
    const b = await signup(); console.log('Temporary account B ready');
    const own = await a.evaluate(async () => {
      const meal = DB.mealBundles.add({name: 'QA live meal', items: [{name: 'QA ingredient', servings: 1, calories: 100, protein: 5, carbs: 10, fat: 2}]});
      const logged = DB.mealBundles.log(meal.id, todayISO(), 0.5);
      const shopping = DB.shopping.save({name: 'QA live list', items: [{name: 'QA ingredient', quantity: 100, unit: 'g'}]});
      return {ok: logged.ok && shopping.ok, pushed: await Cloud.flush(), uid: Cloud.getLastUid()};
    });
    assert.equal(own.ok, true); assert.equal(own.pushed, 'ok');
    const history = await a.evaluate(() => Cloud.listPlanHistory()); assert.equal(history.ok, true); assert.ok(history.rows.length > 0);

    // ── B, against A's rows, folder and the admin doors; and anon ────────────
    const probe = await b.evaluate(async ({url, key, uid}) => {
      const session = await Cloud.getSession();
      const as = (tok) => window.supabase.createClient(url, key, {
        auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
        global: {headers: tok ? {Authorization: 'Bearer ' + tok} : {}},
      });
      const me = as(session.access_token), anon = as(null);
      const r = async (p) => {
        try { const x = await p; return {data: x.data, error: x.error ? {code: x.error.code || x.error.statusCode || '', message: x.error.message || String(x.error)} : null}; }
        catch (e) { return {data: null, error: {code: '', message: String((e && e.message) || e)}}; }
      };
      const out = {me: session.user.id};
      out.readBlob = await r(me.from('vault_data').select('user_id').eq('user_id', uid));
      out.readHistory = await r(me.from('vault_data_history').select('id').eq('user_id', uid));
      out.update = await r(me.from('vault_data').update({data: {probe: 'B'}}).eq('user_id', uid).select('user_id'));
      out.upsert = await r(me.from('vault_data').upsert({user_id: uid, data: {probe: 'B'}}, {onConflict: 'user_id'}).select('user_id'));
      out.history = await r(me.from('vault_data_history').insert({user_id: uid, data: {probe: 'B'}, version: 1}).select('id'));
      out.storageList = await r(me.storage.from('exercise-images').list(uid));
      out.storageDownload = await r(me.storage.from('exercise-images').download(uid + '/probe.jpg'));
      out.storageUpload = await r(me.storage.from('exercise-images').upload(uid + '/probe.jpg', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {type: 'image/jpeg'}), {upsert: true}));
      out.profiles = await r(me.from('profiles').select('user_id').eq('user_id', uid));
      out.flags = await r(me.from('user_flags').select('user_id').eq('user_id', uid));
      out.feedback = await r(me.from('feedback').select('id').eq('user_id', uid));
      out.errors = await r(me.from('client_errors').select('id').eq('user_id', uid));
      out.rpc = {};
      for (const [name, args] of [['admin_user_stats', {}], ['admin_activity', {}], ['admin_prune_client_errors', {p_days: 30}],
        ['admin_set_status', {target: uid, new_status: 'disabled'}], ['admin_set_role', {target: uid, new_role: 'admin'}]]) out.rpc[name] = await r(me.rpc(name, args));
      out.anon = {
        blob: await r(anon.from('vault_data').select('user_id').limit(1)),
        history: await r(anon.from('vault_data_history').select('id').limit(1)),
        isAdmin: await r(anon.rpc('is_admin')),
        username: await r(anon.rpc('username_available', {candidate: 'probe'})),
        storage: await r(anon.storage.from('exercise-images').list(uid)),
      };
      return out;
    }, {url, key, uid: own.uid});
    assert.notEqual(probe.me, own.uid, 'B is a different account');
    answer('read-blob', empty(probe.readBlob), say(probe.readBlob));
    answer('read-history', empty(probe.readHistory), say(probe.readHistory));
    answer('write-update', refused(probe.update) || empty(probe.update), say(probe.update));
    answer('write-upsert', refused(probe.upsert), say(probe.upsert));
    answer('write-history', refused(probe.history), say(probe.history));
    answer('storage-list', empty(probe.storageList) || !!probe.storageList.error, say(probe.storageList));
    answer('storage-download', !!probe.storageDownload.error, say(probe.storageDownload));
    answer('storage-upload', !!probe.storageUpload.error, say(probe.storageUpload));
    answer('read-profiles', empty(probe.profiles) || refused(probe.profiles), say(probe.profiles));
    answer('read-flags', empty(probe.flags) || refused(probe.flags), say(probe.flags));
    answer('read-feedback', empty(probe.feedback) || refused(probe.feedback), say(probe.feedback));
    answer('read-errors', empty(probe.errors) || refused(probe.errors), say(probe.errors));
    const rpcBad = Object.entries(probe.rpc).filter(([, r]) => !(r.error && /not authorized|permission denied/i.test(r.error.message || '')));
    answer('rpc-admin', rpcBad.length === 0, rpcBad.length ? say(Object.fromEntries(rpcBad)) : Object.keys(probe.rpc).join(', ') + ' all refused');
    const an = probe.anon;
    const anonOk = (empty(an.blob) || refused(an.blob)) && (empty(an.history) || refused(an.history)) && !!an.isAdmin.error && !!an.username.error && (empty(an.storage) || !!an.storage.error);
    answer('anon', anonOk, say(an));
    // A's row, read back by A: none of the writes above changed a byte of it.
    const intact = await a.evaluate(async () => { const row = await Cloud.pull(); return row && row.data && row.data.mealBundles && row.data.mealBundles[0] && row.data.mealBundles[0].name; });
    answer('row-intact', intact === 'QA live meal', String(intact));

    const read = await a.evaluate(id => Cloud.readPlanHistory(id), history.rows[0].id); assert.equal(read.ok, true);
    // Second isolated device, same test account; no password/captcha bypass.
    // Reusing its own issued session is the ordinary SDK session transport: a
    // helper client persists it under the SDK's own key, which Cloud's client
    // reads on its next getSession().
    const session = await a.evaluate(async () => { const s = await Cloud.getSession(); return {access_token: s.access_token, refresh_token: s.refresh_token}; });
    const second = await pageForTest();
    const adopted = await second.evaluate(async ({url, key, session}) => {
      const helper = window.supabase.createClient(url, key, {auth: {persistSession: true, autoRefreshToken: false, detectSessionInUrl: false}});
      const auth = await helper.auth.setSession(session); if (auth.error) return 'auth-error';
      if (!(await Cloud.getSession())) return 'not-adopted';
      return Cloud.chooseCloud();
    }, {url, key, session}); assert.equal(adopted, 'ok');
    assert.equal(await second.evaluate(() => DB.shopping.list()[0].name), 'QA live list');
    assert.equal(await a.evaluate(async () => { DB.mealBundles.update(DB.mealBundles.list()[0].id, {name: 'QA latest'}); return Cloud.flush(); }), 'ok');
    const conflict = await second.evaluate(async () => { DB.mealBundles.update(DB.mealBundles.list()[0].id, {name: 'QA stale device'}); return Cloud.flush(); });
    assert.equal(conflict, 'conflict');
    const retained = await a.evaluate(async () => { const row = await Cloud.pull(); return row.data.mealBundles[0].name; });
    assert.equal(retained, 'QA latest');
    await second.context().close();
    const missing = PROBES.filter((p) => !answered.has(p));
    if (missing.length) throw new Error('probes that never ran: ' + missing.join(', '));
    console.log('PASS LIVE: own-account writes/history; as B against A — read, update/upsert/history-insert, bucket list/download/upload, profiles/flags/feedback/errors, five admin RPCs — and anon, all refused (' + answered.size + '/' + PROBES.length + ' probes answered); reload on second device; stale-version conflict without overwrite');
  } finally {
    let failures = 0;
    for (const {page, id} of created.reverse()) {
      try { await page.evaluate(() => Cloud.deleteAccount()); console.log('Temporary account deleted'); }
      catch (error) { failures++; console.error('Cleanup failed for test account ' + id + ': ' + error.message); }
    }
    await browser.close();
    if (failures) throw new Error('Temporary-account cleanup incomplete');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
