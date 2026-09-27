// THE ADMIN CONSOLE, DRIVEN (v408). admin.html is a standalone page with no
// js/ imports, so none of the app's suites ever loaded it — and it shipped two
// screens that threw «dayOf is not defined» on their first row (feedback and
// roles: the helper lived inside renderUsers). This drives it for real over a
// STUBBED Supabase SDK that records every request, served by scripts/fp/server.js
// on port 0 with the network fenced to 127.0.0.1, and asserts:
//   · signed out: the login shell renders with no page error;
//   · signed in: every centre renders with no page error;
//   · every .range() read carries an .order() (stable pages, database#13);
//   · client_errors is read by KEYSET (.lt on id, 1000 a page, stops short);
//   · feedback and audit_log load their newest 500 and page older by keyset —
//     feedback on (created_at, id), so a tie at the page edge loses no row;
//   · a catalog or settings write re-reads ONE table, not loadAll();
//   · framed by another origin (or sandboxed) it hides and builds no client.
// `--admin <file>` serves another admin.html (e.g. an older one) to show what
// the checks catch. Uses the externally provided Playwright + Chrome.
'use strict';
const path = require('path'), fs = require('fs');
const req = require('module').createRequire(path.join(__dirname, '..', 'package.json'));
const { chromium } = req('playwright');
const { start, fence } = req('./scripts/fp/server.js');
const ai = process.argv.indexOf('--admin');
const ADMIN_OVERRIDE = ai > 0 ? fs.readFileSync(process.argv[ai + 1], 'utf8') : null;

// The stub SDK: window.supabase.createClient -> a client that records every request in
// window.__reqs and answers from in-page tables, honouring order / range / lt / or / limit / eq.
const SDK = (signedIn) => `(function(){
  var pad=function(n,w){ n=String(n); while(n.length<w) n='0'+n; return n; };
  function ts(i){ var t=new Date(Date.UTC(2026,8,27,12,0,0)-i*60000).toISOString(); return t.replace('Z','')+'123+00:00'; }
  var T={
    profiles:[1,2,3].map(function(i){return {user_id:'u'+i,username:'user'+i,created_at:ts(9000+i),last_seen:ts(i)};}),
    user_flags:[1,2,3].map(function(i){return {user_id:'u'+i,role:i===1?'admin':'user',status:'active',reason:null};}),
    vault_data:[1,2,3].map(function(i){return {user_id:'u'+i,unit:'kg'};}),
    exercises:[1,2,3,4,5].map(function(i){return {id:'e'+i,name:'Exercise '+i,category:'Chest',owner_id:null,deleted_at:null};}),
    cardio_types:[{id:'c1',label:'Run',owner_id:null,deleted_at:null}],
    food_catalog:[{id:'f1',name:'Dates',serving:'100g',calories:277,protein:2,carbs:75,fat:0,deleted_at:null}],
    preset_plans:[{id:'p1',name:'PPL',description:'',data:{days:[]},position:1}],
    app_config:[{id:1,default_unit:'kg',announcement_ar:'',announcement_en:'',announcement_active:false}],
    admins:[{user_id:'u1'}],
    feedback:[], audit_log:[], client_errors:[]
  };
  // 700 feedback rows, newest first by created_at; rows 499 and 500 SHARE a created_at, so a cut on
  // created_at alone would drop one of them at the page boundary.
  for(var i=0;i<700;i++) T.feedback.push({id:'fb-'+pad(i,4),user_id:'u'+(1+i%3),username:'user'+(1+i%3),message:'m'+i,context:null,status:i%5?'resolved':'open',created_at:ts(i===500?499:i)});
  for(var j=1;j<=1200;j++) T.audit_log.push({id:j,actor:'u1',action:'food.upsert',target:null,detail:{n:j},created_at:ts(2000-j)});
  for(var k=1;k<=2500;k++) T.client_errors.push({id:k,user_id:'u1',build:'405',kind:'error',msg:'e'+k,src:'app.js',line:k,created_at:ts(5000-k)});
  window.__T=T; window.__reqs=[]; window.__created=0;
  function cmp(a,b){ return a<b?-1:a>b?1:0; }
  function serve(q){
    var rec={table:q.t,kind:q.kind,ops:q.ops.map(function(o){return o[0]+'('+JSON.stringify(o[1]).slice(1,-1)+')';})};
    window.__reqs.push(rec);
    if(q.kind!=='select'){
      if(q.t==='feedback'&&q.kind==='update'){ var id=(q.ops.filter(function(o){return o[0]==='eq';})[0]||[])[1]; T.feedback.forEach(function(r){ if(id&&r.id===id[1]) Object.assign(r,q.payload); }); }
      return {data:null,error:null};
    }
    var rows=(T[q.t]||[]).slice();
    q.ops.forEach(function(o){
      var m=o[0],a=o[1];
      if(m==='eq') rows=rows.filter(function(r){return r[a[0]]==a[1];});
      if(m==='is') rows=rows.filter(function(r){return r[a[0]]===a[1];});
      if(m==='lt') rows=rows.filter(function(r){return r[a[0]]<a[1];});
      if(m==='or'){
        var mm=/^(\\w+)\\.lt\\."([^"]+)",and\\((\\w+)\\.eq\\."([^"]+)",(\\w+)\\.lt\\."([^"]+)"\\)$/.exec(a[0]);
        if(!mm) throw new Error('stub: unparsed or() '+a[0]);
        rows=rows.filter(function(r){ return r[mm[1]]<mm[2] || (r[mm[3]]===mm[4] && r[mm[5]]<mm[6]); });
      }
    });
    var orders=q.ops.filter(function(o){return o[0]==='order';});
    if(orders.length) rows.sort(function(x,y){ for(var i=0;i<orders.length;i++){ var c=orders[i][1][0], asc=!(orders[i][1][1]&&orders[i][1][1].ascending===false); var d=cmp(x[c],y[c]); if(d) return asc?d:-d; } return 0; });
    q.ops.forEach(function(o){ if(o[0]==='range') rows=rows.slice(o[1][0],o[1][1]+1); if(o[0]==='limit') rows=rows.slice(0,o[1][0]); });
    if(q.single) return {data:rows[0]||null,error:null};
    return {data:rows,error:null};
  }
  function Q(t){ this.t=t; this.ops=[]; this.kind='select'; }
  ['select','order','range','lt','or','limit','eq','is','in','gte','lte','neq'].forEach(function(m){ Q.prototype[m]=function(){ this.ops.push([m,[].slice.call(arguments)]); return this; }; });
  Q.prototype.update=function(p){ this.kind='update'; this.payload=p; return this; };
  Q.prototype.insert=function(p){ this.kind='insert'; this.payload=p; return this; };
  Q.prototype.upsert=function(p){ this.kind='upsert'; this.payload=p; return this; };
  Q.prototype.maybeSingle=function(){ this.single=true; return this; };
  Q.prototype.then=function(ok,no){ var self=this; return Promise.resolve().then(function(){return serve(self);}).then(ok,no); };
  var session=${signedIn ? "{access_token:'x',user:{id:'u1',email:'owner@example.invalid'}}" : 'null'};
  window.supabase={createClient:function(){ window.__created++; return {
    from:function(t){ return new Q(t); },
    rpc:function(name,args){
      window.__reqs.push({table:'rpc:'+name,kind:'rpc',ops:[JSON.stringify(args||{})]});
      var d=null;
      if(name==='is_admin') d=true;
      else if(name==='admin_user_stats') d=[{user_id:'u1',sessions:3,sets:9,volume:100,foods:0,sleeps:0,cardio:0,custom:0,week_done:1,training_days:3,plan_name:'PPL'}];
      else if(name==='admin_activity') d={sess_today:1,sess_week:3,top_ex:[],cat_dist:{},recent:[]};
      else if(name==='admin_upsert_food'){ var id=args.p_id||('f'+(T.food_catalog.length+1)); T.food_catalog=T.food_catalog.filter(function(r){return r.id!==id;}).concat([{id:id,name:args.p_name,serving:args.p_serving,calories:args.p_cal,protein:args.p_pro,carbs:args.p_carb,fat:args.p_fat||0,deleted_at:null}]); d=id; }
      else if(name==='admin_set_config'){ T.app_config[0].announcement_ar=args.p_ar||''; d=null; }
      return Promise.resolve({data:d,error:null});
    },
    auth:{
      getSession:function(){ return Promise.resolve({data:{session:session}}); },
      onAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; },
      signOut:function(){ session=null; return Promise.resolve({error:null}); },
      signInWithPassword:function(){ return Promise.resolve({error:{message:'stub'}}); },
      resetPasswordForEmail:function(){ return Promise.resolve({error:null}); },
      updateUser:function(){ return Promise.resolve({error:null}); }
    }
  }; }};
})();`;

async function open(browser, origin, signedIn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text()); });
  const net = await fence(page);
  await page.route('**/js/vendor/supabase.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: SDK(signedIn) }));
  if (ADMIN_OVERRIDE) await page.route('**/admin.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: ADMIN_OVERRIDE }));
  return { page, errors, net };
}
const reqs = (page) => page.evaluate(() => window.__reqs.splice(0));
const settle = (page) => page.waitForTimeout(150);

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  // LNA would refuse the cross-origin framing test itself (a route-fulfilled parent has no address space).
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'] });
  const results = [];
  try {
    // 1. signed out: the login shell
    {
      const { page, errors, net } = await open(browser, origin, false);
      await page.goto(origin + '/admin.html');
      await page.waitForSelector('#login:not(.hidden)');
      await settle(page);
      results.push({ name: 'signed out: the login shell renders, no page error', ok: errors.length === 0 && await page.isVisible('#panel-login'), why: errors.join(' | ') });
      net.assertContained(); await page.close();
    }
    // 2. signed in: the shell, the loads, the centers, the writes
    {
      const { page, errors, net } = await open(browser, origin, true);
      await page.goto(origin + '/admin.html');
      await page.waitForSelector('#app:not(.hidden)');
      await page.waitForFunction(() => window.__reqs && !/جارٍ التحميل/.test(document.querySelector('#center').textContent) && document.querySelector('#center').children.length > 0);
      await settle(page);
      let r = await reqs(page);
      const unordered = r.filter((q) => q.ops.some((o) => o.startsWith('range(')) && !q.ops.some((o) => o.startsWith('order(')));
      results.push({ name: 'every .range() request the console sent carries an .order()', ok: unordered.length === 0, why: unordered.map((q) => q.table).join(',') });
      const ce = r.filter((q) => q.table === 'client_errors');
      results.push({ name: 'client_errors: 3 keyset pages (1000+1000+500), .lt on pages 2-3, no .range', ok: ce.length === 3 && ce.every((q) => q.ops.includes('limit(1000)') && !q.ops.some((o) => o.startsWith('range('))) && !ce[0].ops.some((o) => o.startsWith('lt(')) && ce[1].ops.includes('lt("id",1501)') && ce[2].ops.includes('lt("id",501)'), why: JSON.stringify(ce.map((q) => q.ops)) });
      for (const t of ['feedback', 'audit_log']) { const q = r.filter((x) => x.table === t); results.push({ name: `${t}: one newest page of 500 at load`, ok: q.length === 1 && q[0].ops.includes('limit(500)') && !q[0].ops.some((o) => o.startsWith('range(')), why: JSON.stringify(q.map((x) => x.ops)) }); }
      // errors center: every row arrived
      await page.click('[data-center="errors"]'); await settle(page);
      const cnt = await page.textContent('.p2count');
      results.push({ name: 'the errors center holds all 2,500 rows', ok: /2,500 من 2,500/.test(cnt), why: cnt });
      // feedback: 500, «عرض الأقدم», then 700 with no duplicate and none dropped at the tie
      await page.click('[data-center="feedback"]'); await settle(page);
      let n = await page.$$eval('.fb-item', (x) => x.length);
      const btn1 = await page.$('[data-older="feedback"]');
      await reqs(page);
      if (btn1) { await btn1.click(); await page.waitForFunction(() => document.querySelectorAll('.fb-item').length > 500); await settle(page); }
      r = await reqs(page);
      const ids = await page.$$eval('.fb-item', (x) => x.map((e) => e.getAttribute('data-fid')));
      results.push({ name: 'feedback: 500, then «عرض الأقدم» -> 700 unique rows (the shared created_at at the boundary kept), button gone', ok: n === 500 && !!btn1 && ids.length === 700 && new Set(ids).size === 700 && ids.includes('fb-0499') && ids.includes('fb-0500') && !(await page.$('[data-older="feedback"]')) && r.length === 1 && r[0].ops.some((o) => o.startsWith('or(')), why: `first ${n}, then ${ids.length} (${new Set(ids).size} unique), older req ${JSON.stringify(r.map((q) => q.ops))}` });
      // audit: 500 -> 1000 -> 1200
      await page.click('[data-center="audit"]'); await settle(page);
      const counts = [await page.$$eval('#center tbody tr', (x) => x.length)];
      for (let i = 0; i < 2; i++) { const b = await page.$('[data-older="audit_log"]'); if (!b) break; const before = counts[counts.length - 1]; await b.click(); await page.waitForFunction((k) => document.querySelectorAll('#center tbody tr').length > k, before); await settle(page); counts.push(await page.$$eval('#center tbody tr', (x) => x.length)); }
      results.push({ name: 'audit log: 500 -> 1000 -> 1200, then no button', ok: counts.join() === '500,1000,1200' && !(await page.$('[data-older="audit_log"]')), why: counts.join() });
      // a catalog write re-reads ONE table
      await page.click('[data-center="catalog"]'); await settle(page);
      await page.click('[data-tab="foods"]'); await settle(page);
      await page.click('#head-actions .abtn.pri'); await page.waitForSelector('#fd-name');
      await page.fill('#fd-name', 'Oats'); await page.fill('#fd-cal', '389');
      await reqs(page);
      await page.click('.adm-save'); await page.waitForFunction(() => /Oats/.test(document.querySelector('#center').textContent)); await settle(page);
      r = await reqs(page);
      const kinds = r.map((q) => q.table + (q.kind === 'select' || q.kind === 'rpc' ? '' : ':' + q.kind));
      results.push({ name: 'a food save = the RPC + ONE food_catalog read (no admin RPCs, no other table)', ok: kinds.join() === 'rpc:admin_upsert_food,food_catalog', why: kinds.join() });
      // settings
      await page.click('[data-center="settings"]'); await settle(page);
      await page.fill('#cfg-ar', 'مرحبًا'); await reqs(page);
      await page.click('#cfg-save'); await page.waitForTimeout(400);
      r = await reqs(page);
      results.push({ name: 'a settings save = the RPC + ONE app_config read', ok: r.map((q) => q.table).join() === 'rpc:admin_set_config,app_config', why: r.map((q) => q.table).join() });
      // every other center renders
      for (const c of ['dashboard', 'users', 'analytics', 'presets', 'admins']) { await page.click(`[data-center="${c}"]`); await settle(page); }
      results.push({ name: 'signed in: every center rendered with no page error', ok: errors.length === 0, why: errors.join(' | ') });
      const fenceOut = net.assertContained();
      results.push({ name: 'nothing left 127.0.0.1', ok: true, why: JSON.stringify(fenceOut) });
      await page.close();
    }
    // 3. framed (a cross-origin parent, and a sandboxed frame): hidden, and no client built
    for (const sandbox of ['', ' sandbox="allow-scripts allow-same-origin"']) {
      const { page, errors, net } = await open(browser, origin, true);
      const other = origin.replace('127.0.0.1', 'localhost');
      await page.route(other + '/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><body style="margin:0"><iframe id="f" src="${origin}/admin.html"${sandbox} style="width:900px;height:700px"></iframe></body>` }));
      const failed = []; page.on('requestfailed', (q) => failed.push(q.url() + ' ' + (q.failure() && q.failure().errorText))); page.on('response', (s) => { if (s.url().includes('admin.html')) failed.push('RESP ' + s.status() + ' ' + s.url()); });
      await page.goto(other + '/frame.html').catch(() => {});
      await page.waitForTimeout(1200);
      const topUrl = page.url();
      let framed = null;
      const f = page.frames().find((x) => x.url().includes('/admin.html') && x !== page.mainFrame());
      if (f) framed = await f.evaluate(() => ({ hidden: document.documentElement.hidden, created: window.__created, reqs: (window.__reqs || []).length })).catch((e) => ({ err: e.message }));
      const busted = topUrl.includes('/admin.html');
      results.push({ name: `framed${sandbox ? ' (sandboxed)' : ''}: the console busts out or stays hidden with no client`, ok: busted || (framed && framed.hidden === true && !framed.created && !framed.reqs), why: `top=${topUrl} frames=${page.frames().map((x) => x.url()).join(' ; ')} frame=${JSON.stringify(framed)} errors=${errors.join(' | ')} blocked=${net.blocked.join(' ')} failed=${failed.join(' ; ')}` });
      await page.close();
    }
  } finally { await browser.close(); await srv.close(); }
  const all = await Promise.all(results);
  let bad = 0;
  for (const x of all) { if (!x.ok) bad++; console.log((x.ok ? 'PASS ' : 'FAIL ') + x.name + (x.ok && x.why && (x.name.startsWith('nothing') || x.name.startsWith('framed')) ? ' ' + x.why : '') + (x.ok ? '' : '  — ' + x.why)); }
  console.log(bad ? `\nFAIL admin console: ${bad} of ${all.length} checks failed` : `\nPASS admin console: ${all.length} checks — login shell, every centre, ordered ranges, keyset paging (client_errors, feedback across a created_at tie, audit_log), one-table reloads after a write, framed = hidden with no client`);
  process.exitCode = bad ? 1 : 0;
}
if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });