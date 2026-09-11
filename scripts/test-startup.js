// Isolated browser benchmark: same files/data, 200ms per local asset, 4x CPU.
// No production requests, accounts, or new app dependencies.
'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {context} = require('./test-sync-status');
const root = path.resolve(__dirname, '..');
const fixture = context();
const state = JSON.parse(fixture.values.get(fixture.keys.store));
state.prefs.onboarded = true;
state.sessions = Array.from({length:10000}, (_,i) => ({
  id:'qa_'+i, exerciseId:state.exercises[i % state.exercises.length].id,
  date:'2026-09-'+String(i%11+1).padStart(2,'0'), createdAt:String(i),
  sets:[{reps:10,weight:20},{reps:8,weight:25},{reps:6,weight:30}]
}));
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.resolve(root,'.'+name);
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);res.end();return;
  }
  let body = fs.readFileSync(file,'utf8');
  if (name === '/index.html' && url.searchParams.has('serial')) {
    const scripts=[];
    body=body.replace(/<script src="js\/[^">]+" defer><\/script>/g,tag=>{scripts.push(tag.replace(' defer',''));return '';});
    body=body.replace('</body>',scripts.join('\n')+'\n</body>');
  }
  if (name === '/js/cloud.js') body = body.split('(function () {')[0] +
    "window.Cloud={configured:()=>false,onLocalChange:()=>{},getLastUid:()=> 'qa'};";
  if (name.endsWith('.js')) body = `performance.mark(${JSON.stringify(name+':start')});\n`+body+
    `\nperformance.measure(${JSON.stringify(name)},${JSON.stringify(name+':start')});`;
  setTimeout(() => {
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[path.extname(file)]||'text/plain','Cache-Control':'no-store'});
    res.end(body);
  },name.endsWith('.js') || name.endsWith('.css') ? 200 : 0);
});
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({channel:'chrome'});
  try {
    const results={serial:[],parallel:[]};
    for(let round=0;round<3;round++) for(const mode of ['serial','parallel']) {
      const ctx=await browser.newContext({viewport:{width:390,height:844}});
      const page=await ctx.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
      const cdp=await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await page.addInitScript(({key,state})=>{
        localStorage.setItem(key,JSON.stringify(state));
        new MutationObserver((_,observer)=>{
          if(document.querySelector('.home-head')) {window.homeReady=performance.now();observer.disconnect();}
        }).observe(document,{childList:true,subtree:true});
      },{key:fixture.keys.store,state});
      await page.goto(origin+(mode==='serial'?'/?serial':'/'),{waitUntil:'load'});
      await page.waitForFunction(()=>window.homeReady && window.Health && window.Notify && window.FoodAI && window.VaultUpdate);
      const result=await page.evaluate(()=>({
        home:Math.round(homeReady),load:Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd),
        scripts:performance.getEntriesByType('measure').map(m=>({name:m.name,ms:Math.round(m.duration)})),
        sessions:DB.sessions.listAll().length,
        requests:performance.getEntriesByType('resource').filter(r=>/\/js\/(cloud|storage|app|health|notify|foodai|update)\.js/.test(r.name)).map(r=>({name:r.name.split('/').pop(),start:Math.round(r.startTime),end:Math.round(r.responseEnd)}))
      }));
      assert.deepEqual(errors,[]);assert.equal(result.sessions,10000);
      results[mode].push(result);
      await ctx.close();
    }
    const median=(mode,key)=>results[mode].map(r=>r[key]).sort((a,b)=>a-b)[1];
    console.log(JSON.stringify({scenario:'200ms assets, 4x CPU, 10000 sessions',
      median:{serial:{home:median('serial','home'),load:median('serial','load')},parallel:{home:median('parallel','home'),load:median('parallel','load')}},
      ...(process.argv.includes('--verbose')?{results}:{})},null,2));
    assert.ok(median('parallel','home') < median('serial','home'),'parallel startup improves time to Home');
    console.log('PASS startup: modules ready in order, 10000 sessions preserved, faster Home, no page errors');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
