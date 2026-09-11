// Explicit opt-in: creates two temporary accounts, tests ONLY their rows, then deletes them.
// Uses the normal Turnstile flow; credentials/tokens remain in process memory.
'use strict';
if (!process.argv.includes('--live')) throw new Error('Pass --live to authorize temporary live test accounts.');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const origin = 'https://moathdarweesh.github.io/vault/';
const created = [];
async function main() {
  const browser = await chromium.launch({channel:'chrome',headless:!process.argv.includes('--headed')});
  async function pageForTest() {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', message => { if (message.text().includes('Turnstile')) console.log(message.text().slice(0,300)); });
    await page.route(origin+'**', async route => {
      const name = new URL(route.request().url()).pathname.replace('/vault/','');
      if (!name) return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="captcha"></div><script src="js/vendor/supabase.js"></script><script src="js/cloud.js"></script><script src="js/storage.js"></script></body></html>'});
      if (['js/vendor/supabase.js','js/cloud.js','js/storage.js'].includes(name)) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'..',name),'utf8')});
      return route.abort();
    });
    await page.goto(origin);
    await page.waitForFunction(()=>window.DB && window.Cloud);
    return page;
  }
  async function signup() {
    const page = await pageForTest();
    const email = 'vault-qa-'+randomUUID()+'@example.com', password = randomUUID()+'Aa9!';
    const cloud = fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8');
    const url = cloud.match(/const SUPABASE_URL = '([^']+)'/)[1], key = cloud.match(/const SUPABASE_ANON_KEY = '([^']+)'/)[1];
    const automatic = await page.evaluate(async ({url,key})=>{
      const response=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});
      const settings=await response.json();return settings.mailer_autoconfirm===true && !settings.disable_signup;
    },{url,key});
    assert.ok(automatic,'Do not create an account needing email confirmation');
    const result = await page.evaluate(async ({email,password})=>{
      await Cloud.captcha.mount(document.getElementById('captcha'));
      const token=await Cloud.captcha.token(25000);
      if(!token) return {error:'CAPTCHA_NOT_SOLVED'};
      const result=await Cloud.signUp(email,password,token);
      return {error:result.error || null,id:result.user?.id,session:!!result.session};
    },{email,password});
    if(result.id) created.push({page,id:result.id});
    assert.ok(!result.error,result.error || 'signup'); assert.ok(result.session,'Immediate session required');
    assert.equal(await page.evaluate(()=>Cloud.resolveOnLogin()),'pushed');
    return page;
  }
  try {
    const a=await signup(); console.log('Temporary account A ready');
    const b=await signup(); console.log('Temporary account B ready');
    const own = await a.evaluate(async ()=>{
      const meal=DB.mealBundles.add({name:'QA live meal',items:[{name:'QA ingredient',servings:1,calories:100,protein:5,carbs:10,fat:2}]});
      const logged=DB.mealBundles.log(meal.id,todayISO(),0.5);
      const shopping=DB.shopping.save({name:'QA live list',items:[{name:'QA ingredient',quantity:100,unit:'g'}]});
      return {ok:logged.ok&&shopping.ok,pushed:await Cloud.flush(),uid:Cloud.getLastUid()};
    });
    assert.equal(own.ok,true); assert.equal(own.pushed,'ok');
    const history=await a.evaluate(()=>Cloud.listPlanHistory());assert.equal(history.ok,true);assert.ok(history.rows.length>0);
    const leaked=await b.evaluate(async uid=>{
      const c=Cloud.getClient();
      const current=await c.from('vault_data').select('user_id').eq('user_id',uid);
      const history=await c.from('vault_data_history').select('id').eq('user_id',uid);
      return {current:current.data,history:history.data,errors:!!current.error||!!history.error};
    },own.uid);
    assert.deepEqual(leaked,{current:[],history:[],errors:false});
    const read=await a.evaluate(id=>Cloud.readPlanHistory(id),history.rows[0].id);assert.equal(read.ok,true);
    // Second isolated device, same test account; no password/captcha bypass.
    // Reusing its own issued session is the ordinary SDK session transport.
    const session=await a.evaluate(async()=>{const s=await Cloud.getSession();return {access_token:s.access_token,refresh_token:s.refresh_token};});
    const second=await pageForTest();
    const adopted=await second.evaluate(async session=>{
      const auth=await Cloud.getClient().auth.setSession(session);if(auth.error)return 'auth-error';
      return Cloud.chooseCloud();
    },session);assert.equal(adopted,'ok');
    assert.equal(await second.evaluate(()=>DB.shopping.list()[0].name),'QA live list');
    assert.equal(await a.evaluate(async()=>{DB.mealBundles.update(DB.mealBundles.list()[0].id,{name:'QA latest'});return Cloud.flush();}),'ok');
    const conflict=await second.evaluate(async()=>{DB.mealBundles.update(DB.mealBundles.list()[0].id,{name:'QA stale device'});return Cloud.flush();});
    assert.equal(conflict,'conflict');
    const retained=await a.evaluate(async()=>{const row=await Cloud.pull();return row.data.mealBundles[0].name;});
    assert.equal(retained,'QA latest');
    await second.context().close();
    console.log('PASS LIVE: own-account writes/history, cross-account RLS, reload on second device, stale-version conflict without overwrite');
  } finally {
    let failures=0;
    for(const {page,id} of created.reverse()) {
      try {await page.evaluate(()=>Cloud.deleteAccount());console.log('Temporary account deleted');}
      catch(error){failures++;console.error('Cleanup failed for test account '+id+': '+error.message);}
    }
    await browser.close();
    if(failures) throw new Error('Temporary-account cleanup incomplete');
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
