// The local harness server, shared by every browser-driven check.
//
// Lifted verbatim out of scripts/test-sync-status-ui.js so the fingerprint net,
// that suite and any future one all serve the app the SAME way. Three jobs, and
// each one is load-bearing:
//
//   1. serve the repo over loopback, refusing any path that escapes the root;
//   2. rewrite js/cloud.js to a stub, so nothing ever authenticates;
//   3. hand the caller a route filter that ABORTS every non-loopback request.
//
// ⚠️ (3) IS THE ENFORCEMENT, NOT A CONVENTION. The owner's real project ref is
// in the shipped js/cloud.js. A stub is a promise; an aborted route is a fact —
// even a coding mistake in a harness cannot reach the live database, the Worker
// or Turnstile. Every caller must install it, and the net asserts afterwards
// that nothing but 127.0.0.1 was ever allowed.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/* The three states the app can boot into. `configured:false` is the one the
   existing suite uses — the auth gate never mounts. The other two exist because
   a screen nobody renders is a screen nobody protects. */
const STUBS = {
  // signed out, cloud not configured: no gate, no network, no session
  out: `
    window.qaCloud={status:'pending',dirty:false,online:true,stamp:'',confirmedAt:''};
    window.Cloud={getLastUid:()=>null,configured:()=>false,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>'synced',flush:async()=>'ok',
      backupExerciseImage:async()=>null,bootSync:async()=>null,changePassword:async()=>({ok:false,error:'fp-stub'}),checkPlanRestoreVersion:async()=>({ok:false,code:'fp-stub'}),checkUsername:async()=>null,chooseCloud:async()=>null,chooseLocal:async()=>null,clearLocalUserData:()=>{},currentEmail:async()=>'fp@example.invalid',deleteAccount:async()=>({ok:false,error:'fp-stub'}),ensureSdk:async()=>null,getMyFlags:async()=>null,getSession:async()=>null,getUsername:async()=>null,isSettled:()=>true,listPlanHistory:async()=>null,localHasData:()=>false,onPasswordRecovery:()=>{},pullCatalog:async()=>null,pushOnce:async()=>null,readPlanHistory:async()=>({ok:false,code:'fp-stub'}),recoveryFailedAt:()=>'',recoveryInfo:()=>null,removeExerciseImage:async()=>null,resetPassword:async()=>({ok:false,error:'fp-stub'}),resolveOnLogin:async()=>null,restoreExerciseImage:async()=>null,restoreRecovery:async()=>false,setUsername:async()=>null,signIn:async()=>({ok:false,error:'fp-stub'}),signOut:async()=>({ok:false,error:'fp-stub'}),signUp:async()=>({ok:false,error:'fp-stub'}),snapshotLocal:()=>true,submitFeedback:async()=>({ok:true}),touchLastSeen:async()=>null,wasLinked:()=>true,
      reportError:function(){window.__fpReportError=(window.__fpReportError||[]);window.__fpReportError.push([].slice.call(arguments));}};`,
  // the login card itself — configured, but no session
  gate: `
    window.qaCloud={status:'signedout',dirty:false,online:true,stamp:'',confirmedAt:''};
    window.Cloud={getLastUid:()=>null,configured:()=>true,ensureSdk:async()=>true,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>'nosession',flush:async()=>'nosession',
      getSession:async()=>null,
      captcha:{mount:async()=>{},token:async()=>'fp-token',reset:()=>{}},
      backupExerciseImage:async()=>null,bootSync:async()=>null,changePassword:async()=>({ok:false,error:'fp-stub'}),checkPlanRestoreVersion:async()=>({ok:false,code:'fp-stub'}),checkUsername:async()=>null,chooseCloud:async()=>null,chooseLocal:async()=>null,clearLocalUserData:()=>{},currentEmail:async()=>'fp@example.invalid',deleteAccount:async()=>({ok:false,error:'fp-stub'}),getMyFlags:async()=>null,getUsername:async()=>null,isSettled:()=>true,listPlanHistory:async()=>null,localHasData:()=>false,onPasswordRecovery:()=>{},pullCatalog:async()=>null,pushOnce:async()=>null,readPlanHistory:async()=>({ok:false,code:'fp-stub'}),recoveryFailedAt:()=>'',recoveryInfo:()=>null,removeExerciseImage:async()=>null,resetPassword:async()=>({ok:false,error:'fp-stub'}),resolveOnLogin:async()=>null,restoreExerciseImage:async()=>null,restoreRecovery:async()=>false,setUsername:async()=>null,signIn:async()=>({ok:false,error:'fp-stub'}),signOut:async()=>({ok:false,error:'fp-stub'}),signUp:async()=>({ok:false,error:'fp-stub'}),snapshotLocal:()=>true,submitFeedback:async()=>({ok:true}),touchLastSeen:async()=>null,wasLinked:()=>true,
      reportError:function(){window.__fpReportError=(window.__fpReportError||[]);window.__fpReportError.push([].slice.call(arguments));}};`,
  // signed in, everything already in sync — the state most screens are seen in
  in: `
    window.qaCloud={status:'synced',dirty:false,online:true,stamp:'2026-09-01T00:00:00.000Z',confirmedAt:'2026-09-01T00:00:00.000Z'};
    window.Cloud={getLastUid:()=>'fp-user',configured:()=>true,ensureSdk:async()=>true,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>'synced',flush:async()=>'ok',push:async()=>'ok',
      getSession:async()=>({user:{id:'fp-user',email:'fp@example.invalid'}}),
      getUsername:async()=>'fpuser',checkUsername:async()=>true,setUsername:async()=>({ok:true}),
      getMyFlags:async()=>({role:'user',status:'active'}),touchLastSeen:async()=>{},
      pullCatalog:async()=>({exercises:null,cardio:null,foods:null,presets:null,config:null}),
      listPlanHistory:async()=>[],
      captcha:{mount:async()=>{},token:async()=>'fp-token',reset:()=>{}},
      backupExerciseImage:async()=>null,bootSync:async()=>null,changePassword:async()=>({ok:false,error:'fp-stub'}),checkPlanRestoreVersion:async()=>({ok:false,code:'fp-stub'}),chooseCloud:async()=>null,chooseLocal:async()=>null,clearLocalUserData:()=>{},currentEmail:async()=>'fp@example.invalid',deleteAccount:async()=>({ok:false,error:'fp-stub'}),isSettled:()=>true,localHasData:()=>false,onPasswordRecovery:()=>{},pushOnce:async()=>null,readPlanHistory:async()=>({ok:false,code:'fp-stub'}),recoveryFailedAt:()=>'',recoveryInfo:()=>null,removeExerciseImage:async()=>null,resetPassword:async()=>({ok:false,error:'fp-stub'}),resolveOnLogin:async()=>null,restoreExerciseImage:async()=>null,restoreRecovery:async()=>false,signIn:async()=>({ok:false,error:'fp-stub'}),signOut:async()=>({ok:false,error:'fp-stub'}),signUp:async()=>({ok:false,error:'fp-stub'}),snapshotLocal:()=>true,submitFeedback:async()=>({ok:true}),wasLinked:()=>true,
      reportError:function(){window.__fpReportError=(window.__fpReportError||[]);window.__fpReportError.push([].slice.call(arguments));}};`,
};

/** Start the harness server. `mode` picks which Cloud stub js/cloud.js becomes. */
function start(mode = 'out') {
  const stub = STUBS[mode];
  if (!stub) throw new Error(`fp/server: unknown mode ${mode}`);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.resolve(ROOT, '.' + name);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    let body = fs.readFileSync(file);
    // Keep everything above the IIFE (the VAULT_KEYS registry lives there and
    // storage.js reads it), replace the module body with the stub.
    if (name === '/js/cloud.js') body = body.toString().split('(function () {')[0] + stub;
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
  return {
    server,
    async listen() {
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      return `http://127.0.0.1:${server.address().port}`;
    },
    close() { return new Promise((r) => server.close(r)); },
  };
}

/* Install the route filter AND record what happened, so the run can prove it
   never left the machine. A net that silently aborted a live write is not
   evidence that it never intended one. */
async function fence(page) {
  const allowed = [], blocked = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:')) { allowed.push(url); return route.continue(); }
    blocked.push(url);
    return route.abort();
  });
  return {
    allowed, blocked,
    /** Throws if anything outside loopback was ever allowed through. */
    assertContained() {
      const escaped = allowed.filter((u) => !u.startsWith('http://127.0.0.1:'));
      if (escaped.length) throw new Error('fp: a request escaped the fence: ' + escaped.join(', '));
      const live = blocked.filter((u) => /supabase\.co|workers\.dev|challenges\.cloudflare\.com|googleapis|gstatic|openfoodfacts/.test(u));
      return { escaped: 0, blockedLive: live.length, blockedTotal: blocked.length };
    },
  };
}

module.exports = { start, fence, ROOT, STUBS };
