// Isolated browser QA for the real UI + FoodAI + Worker protocol. No production
// accounts, network AI calls or user storage. Run, then open 127.0.0.1:8097.
// All mock code is served from this loopback-only development server.
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let scenario = 'success', requests = 0;
const fixture = { days: [
  { name: 'Push / دفع', exercises: [
    { name: 'Bench Press', sets: 4, reps: '8–12', notes: 'Rest 90 sec' },
    { name: 'Test cable press', sets: 3, reps: '10', notes: '<img src=x onerror=alert(1)> — review printed notes' },
  ] },
  { name: 'Legs / أرجل', exercises: [{ name: 'Squat', sets: null, reps: '10 / 8 / 6', notes: 'Sets unclear' }] },
] };
const workerContext = { Request, Response, Headers, console, setTimeout, clearTimeout, AbortController,
  fetch: async (url) => {
    if (url.includes('/auth/v1/user')) return Response.json({ id: 'fixture-user' });
    if (url.includes('/rpc/ai_budget_take')) return Response.json({ allowed: scenario !== 'quota' });
    const data = scenario === 'empty' ? { days: [] } : fixture;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] });
  },
};
vm.createContext(workerContext);
vm.runInContext(read('backend/worker/gemini-worker.js').replace('export default', 'globalThis.worker ='), workerContext);
const setup = `
  if (!DB.sessions.listAll().length) {
    DB.prefs.setOnboarded(); DB.prefs.setLang('en'); DB.prefs.setTheme('dark');
    const ex = DB.exercises.list()[0];
    DB.plan.setRotation({cycle:[{name:'Original cycle',exerciseIds:[ex.id]}],trainingDays:[0,1,2,3,4,5,6]});
    DB.sessions.add({exerciseId:ex.id,date:addDaysISO(todayISO(),-1),sets:[{reps:8,weight:40}]});
  }
  const qaFetch = window.fetch.bind(window);
  window.fetch = (url, options) => String(url).includes('vault-calories.') ? qaFetch('/__analyze', options) : qaFetch(url, options);
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div'); bar.id = 'qa-toolbar';
    bar.style.cssText = 'position:fixed;top:0;left:0;z-index:20000;background:#fff;color:#111;padding:4px;font:12px sans-serif;max-width:100%';
    const add = (name, action) => {const b=document.createElement('button');b.textContent=name;b.style.cssText='font:12px sans-serif;color:#111;margin:2px';b.onclick=action;bar.append(b);};
    add('QA Planner',()=>navigate('planner'));
    add('QA Arabic',()=>{DB.prefs.setLang('ar');applyLang('ar');navigate('planner')});
    add('QA English',()=>{DB.prefs.setLang('en');applyLang('en');navigate('planner')});
    add('QA Light',()=>{DB.prefs.setTheme('light');applyTheme('light')});
    add('QA Run',()=>navigate('session-run',{date:todayISO(),runOnly:DB.plan.get().cycle[0].exerciseIds}));
    for(const name of ['success','empty','quota','error','slow']) add('QA '+name,()=>qaFetch('/__case?'+name));
    add('QA State',()=>{let p=document.getElementById('qa-state');if(!p){p=document.createElement('pre');p.id='qa-state';p.style.cssText='position:fixed;inset:110px 8px 80px;background:white;color:black;overflow:auto;z-index:30000;font:12px monospace;white-space:pre-wrap';document.body.append(p);p.onclick=()=>p.remove();}p.textContent=JSON.stringify({plan:DB.plan.get(),sessions:DB.sessions.listAll(),customs:DB.exercises.list().filter(e=>e.name==='Test cable press')},null,2)});
    document.body.append(bar);navigate('planner');
  });`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8097');
  if (url.pathname === '/__case') { scenario = url.search.slice(1); res.end(scenario); return; }
  if (url.pathname === '/__analyze') {
    requests++; let body = ''; for await (const chunk of req) body += chunk;
    console.log('Analysis request', requests, 'scenario', scenario);
    if (scenario === 'error') { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"service unavailable"}'); return; }
    if (scenario === 'slow') await new Promise((r) => setTimeout(r, 4000));
    const result = await workerContext.worker.fetch(new Request('https://worker.test', { method: 'POST', headers: req.headers, body }),
      { GEMINI_KEY: 'fixture-key', RATE_LIMITER: { limit: async () => ({ success: true }) } });
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text()); return;
  }
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!/^\/(?:index\.html|styles\.css|version\.json|manifest\.json|js\/[\w./-]+|icons\/[\w./-]+)$/.test(pathname)) { res.writeHead(404); res.end(); return; }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  let data = fs.readFileSync(file);
  if (pathname === '/js/cloud.js') data = read('js/cloud.js').split('(function () {')[0] + `window.Cloud={configured:()=>false,getSession:async()=>({access_token:'fixture-token',user:{id:'fixture-user'}}),onLocalChange:()=>{}};`;
  if (pathname === '/index.html') data = data.toString().replace(/<script src="js\/app.js/, '<script>' + setup + '</script><script src="js/app.js');
  const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(data);
});
server.listen(8097, '127.0.0.1', () => console.log('Isolated plan-import QA: http://127.0.0.1:8097'));
