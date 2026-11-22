// The local harness server, shared by every browser-driven check.
//
// Lifted verbatim out of scripts/test-sync-status-ui.js so the fingerprint net,
// that suite and any future one all serve the app the SAME way. Four jobs, and
// each one is load-bearing:
//
//   1. serve the repo over loopback, refusing any path that escapes the root;
//   2. rewrite js/cloud.js to a stub, so nothing ever authenticates;
//   3. hand the caller a route filter that ABORTS every non-loopback request;
//   4. draw the app in ITS OWN faces, from the files the repo carries, so a
//      text-fit check measures the same faces on every machine (brandFaces,
//      at the foot of this file).
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

/* ⚠️ RETURN SHAPES MUST MATCH js/cloud.js, NOT JUST NAMES. getUsername used to
   return the STRING 'fpuser' where the real one returns { username, offline } —
   so ensureUsername() read info.username as undefined and mounted the username
   gate (class auth-gate, z-index 1000) over every 'in' capture. Nothing noticed
   for two weeks because the net reads computed styles and never hit-tests; the
   first elementFromPoint (scripts/ux-audit.js) answered 'auth-gate' for every
   button on the page. A stub is a promise about a surface the harness cannot
   load — keep the shape, not only the name.

/* The three states the app can boot into. `configured:false` is the one the
   existing suite uses — the auth gate never mounts. The other two exist because
   a screen nobody renders is a screen nobody protects.
   pullSharedRecipes answers null in all three (v419): the suggestions card
   arrives AFTER the first paint, so a stub that answered rows would put an
   async element into every Food capture; the suites that test it stub it
   themselves, in the page. */
const STUBS = {
  // signed out, cloud not configured: no gate, no network, no session
  out: `
    window.qaCloud={status:'pending',dirty:false,online:true,stamp:'',confirmedAt:''};
    window.Cloud={getLastUid:()=>null,configured:()=>false,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>'synced',flush:async()=>'ok',
      backupExerciseImage:async()=>null,bootSync:async()=>null,changePassword:async()=>({ok:false,error:'fp-stub'}),checkPlanRestoreVersion:async()=>({ok:false,code:'fp-stub'}),checkUsername:async()=>null,chooseCloud:async()=>null,chooseLocal:async()=>null,clearLocalUserData:()=>{},currentEmail:async()=>'fp@example.invalid',deleteAccount:async()=>({ok:false,error:'fp-stub'}),ensureSdk:async()=>null,getMyFlags:async()=>null,getSession:async()=>null,getUsername:async()=>null,isSettled:()=>true,listPlanHistory:async()=>null,localHasData:()=>false,onPasswordRecovery:()=>{},pullCatalog:async()=>null,pullSharedRecipes:async()=>null,getSharedRecipeItems:async()=>null,withdrawSharedRecipe:async()=>({ok:false,error:'fp-stub'}),pushOnce:async()=>null,readPlanHistory:async()=>({ok:false,code:'fp-stub'}),recoveryFailedAt:()=>'',recoveryInfo:()=>null,removeExerciseImage:async()=>null,resetPassword:async()=>({ok:false,error:'fp-stub'}),resolveOnLogin:async()=>null,restoreExerciseImage:async()=>null,restoreRecovery:async()=>false,setUsername:async()=>null,signIn:async()=>({ok:false,error:'fp-stub'}),signOut:async()=>({ok:false,error:'fp-stub'}),signUp:async()=>({ok:false,error:'fp-stub'}),snapshotLocal:()=>true,submitFeedback:async()=>({ok:true}),touchLastSeen:async()=>null,wasLinked:()=>true,
      reportError:function(){window.__fpReportError=(window.__fpReportError||[]);window.__fpReportError.push([].slice.call(arguments));}};`,
  // the login card itself — configured, but no session
  gate: `
    window.qaCloud={status:'signedout',dirty:false,online:true,stamp:'',confirmedAt:''};
    window.Cloud={getLastUid:()=>null,configured:()=>true,ensureSdk:async()=>true,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>'nosession',flush:async()=>'nosession',
      getSession:async()=>null,
      captcha:{mount:async()=>{},token:async()=>'fp-token',reset:()=>{}},
      backupExerciseImage:async()=>null,bootSync:async()=>null,changePassword:async()=>({ok:false,error:'fp-stub'}),checkPlanRestoreVersion:async()=>({ok:false,code:'fp-stub'}),checkUsername:async()=>null,chooseCloud:async()=>null,chooseLocal:async()=>null,clearLocalUserData:()=>{},currentEmail:async()=>'fp@example.invalid',deleteAccount:async()=>({ok:false,error:'fp-stub'}),getMyFlags:async()=>null,getUsername:async()=>null,isSettled:()=>true,listPlanHistory:async()=>null,localHasData:()=>false,onPasswordRecovery:()=>{},pullCatalog:async()=>null,pullSharedRecipes:async()=>null,getSharedRecipeItems:async()=>null,withdrawSharedRecipe:async()=>({ok:false,error:'fp-stub'}),pushOnce:async()=>null,readPlanHistory:async()=>({ok:false,code:'fp-stub'}),recoveryFailedAt:()=>'',recoveryInfo:()=>null,removeExerciseImage:async()=>null,resetPassword:async()=>({ok:false,error:'fp-stub'}),resolveOnLogin:async()=>null,restoreExerciseImage:async()=>null,restoreRecovery:async()=>false,setUsername:async()=>null,signIn:async()=>({ok:false,error:'fp-stub'}),signOut:async()=>({ok:false,error:'fp-stub'}),signUp:async()=>({ok:false,error:'fp-stub'}),snapshotLocal:()=>true,submitFeedback:async()=>({ok:true}),touchLastSeen:async()=>null,wasLinked:()=>true,
      reportError:function(){window.__fpReportError=(window.__fpReportError||[]);window.__fpReportError.push([].slice.call(arguments));}};`,
  // signed in, everything already in sync — the state most screens are seen in
  in: `
    window.qaCloud={status:'synced',dirty:false,online:true,stamp:'2026-09-01T00:00:00.000Z',confirmedAt:'2026-09-01T00:00:00.000Z'};
    window.Cloud={getLastUid:()=>'fp-user',configured:()=>true,ensureSdk:async()=>true,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>'synced',flush:async()=>'ok',push:async()=>'ok',
      getSession:async()=>({user:{id:'fp-user',email:'fp@example.invalid'}}),
      getUsername:async()=>({username:'fpuser',offline:false}),checkUsername:async()=>({available:true,offline:false}),setUsername:async()=>({ok:true}),
      getMyFlags:async()=>({role:'user',status:'active'}),touchLastSeen:async()=>{},
      pullCatalog:async()=>({exercises:null,cardio:null,foods:null,presets:null,config:null}),
      pullSharedRecipes:async()=>null,getSharedRecipeItems:async()=>null,withdrawSharedRecipe:async()=>({ok:false,error:'fp-stub'}),
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
async function fence(page, { faces = true } = {}) {
  const allowed = [], blocked = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:')) { allowed.push(url); return route.continue(); }
    blocked.push(url);
    return route.abort();
  });
  if (faces) await brandFaces(page);
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

/* THE APP'S OWN FACES (2026-11-22). The fence aborts the two font hosts, so a
   fenced page used to draw the app in whatever the machine falls back to: Segoe
   UI on the owner's PC, DejaVu Sans on GitHub's runner. A suite that measures
   whether TEXT FITS A BOX then measured a face that is not the app's, and a
   different one on each machine: on CI the suites step was red on every commit
   from v415 on while green here. On v442's run, five suites; serving DejaVu to
   the page reproduced each of their failing figures on this PC to the tenth of
   a pixel («121.5px × 1.12 = 136.1», «121.1px at x1.12, chord 111.0px»), so the
   runner's face was the whole difference. In the app's own faces all five pass.

   The repo already carries those faces, for the Android widgets. brandFaces()
   registers them under the brand's own names from this server (loopback: the
   fence and the app's CSP both admit it) at the start of every document, and
   page.goto / page.reload resolve only once they have loaded. fence() calls it,
   so every fenced page draws the app in the SAME faces on every machine, the
   brand's own; a page behind its own route filter calls brandFaces(page)
   itself, BEFORE its first goto. A face that does not load, or has not loaded
   in 15 s, is an error at that goto, never a silent fall back to the machine's.

   WHAT IS EXACT. Plex 400 and 600: these files' advances equal the faces a
   browser loads from the font host to 0.00 px (19 strings, both scripts,
   measured with the two hosts admitted). The mono: 0.6 em a figure in the
   repo's 500 and 700 files and in the host's 500 and 700 (digits measured; the
   host's 400, which the 500 file stands in for, was not: the face is
   fixed-pitch by design).
   WHAT IS NOT. The repo has NO Plex Medium and NO Plex Bold: a 500 line is
   drawn in the 400 file and a 700 line in the 600 file, NARROWER than the truth
   by up to 4.2 % and 2.7 % (the same 19 strings). So:
     · a check that compares a measured WIDTH with a box multiplies the width
       by window.__fpGap(el): the largest allowance among the text of `el` that
       is not set in the mono — 1.045 for a weight between 400 and 600, 1.03
       above 600, else 1;
     · a check that reads a LAYOUT RESULT cannot be widened: a line count, a
       scrollWidth against a clientWidth, one box's edge against another's. It
       is exact at 400 and 600 and lenient by up to that much for Plex text at
       500 and 700. (On the day of the change the fit suites were run once in
       the true faces as well, hosts admitted: they pass. The release notes
       name them.)
   Adding the two missing files would retire FACE_GAP and window.__fpGap; no
   figure at 400, 600 or in the mono would move. Contract 83 (four faces, the
   Plex ranges, FACE_GAP, the __fpGap calls) and the face lists asserted in
   test-food-log-ui.js and test-sync-status-ui.js are rewritten with them.

   WHAT STILL DIFFERS between machines, and from a phone:
     · a glyph the brand faces do not carry (an emoji, Arabic set in the mono's
       stack) comes from the machine's fallback, as it does on a phone;
     · these are the FULL fonts. A glyph they carry that the host's subsets do
       not serve (an arrow, a check mark) is drawn in the brand face here and
       in a phone's own face there: the same on every machine, not the phone's;
     · the browser build. The files are the same everywhere; the engine that
       lays them out is whichever Chrome the machine has. */
const FACE_DIR = '/android/app/src/main/res/font/';
const BRAND_FACES = [
  ['IBM Plex Sans Arabic', '400 500', 'vault_sans.ttf'],
  ['IBM Plex Sans Arabic', '600 700', 'vault_sans_bold.ttf'],
  ['JetBrains Mono', '400 500', 'vault_mono_medium.ttf'],
  ['JetBrains Mono', '700', 'vault_mono_bold.ttf'],
];
const FACE_GAP = { medium: 1.045, bold: 1.03 };
// What a record was drawn in, in one string: the fingerprint net refuses to diff two records that disagree on it.
const FACES_ID = BRAND_FACES.map((f) => f.join(' ')).join(' | ');
const FACE_WAIT_MS = 15000;

/* Runs IN THE PAGE, before any of its scripts. Serialised; closes over nothing. */
function installFaces({ dir, faces, gap, wait }) {
  if (!/^http:\/\/127\.0\.0\.1:/.test(location.origin) || window.__fpFaces) return;
  window.__fpGap = function (el) {
    let k = 1;
    for (const e of [el].concat(Array.from(el.querySelectorAll('*')))) {
      if (!Array.from(e.childNodes).some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue;
      const cs = getComputedStyle(e);
      if (/JetBrains Mono/.test(cs.fontFamily)) continue;
      const w = Number(cs.fontWeight) || 400;
      k = Math.max(k, w > 600 ? gap.bold : (w > 400 && w < 600 ? gap.medium : 1));
    }
    return k;
  };
  const loaded = Promise.all(faces.map(([family, weight, file]) => {
    const face = new FontFace(family, 'url(' + dir + file + ')', { weight });
    document.fonts.add(face);
    return face.load();
  })).then(() => true, (e) => String((e && e.message) || e));
  window.__fpFaces = Promise.race([loaded, new Promise((done) => setTimeout(() => done('not loaded after ' + wait + ' ms'), wait))]);
}

async function brandFaces(page) {
  await page.addInitScript(installFaces, { dir: FACE_DIR, faces: BRAND_FACES, gap: FACE_GAP, wait: FACE_WAIT_MS });
  for (const nav of ['goto', 'reload']) {
    const real = page[nav].bind(page);
    page[nav] = async (...args) => {
      const res = await real(...args);
      if (page.url().startsWith('http://127.0.0.1:')) {
        const ok = await page.evaluate(() => window.__fpFaces);
        if (ok !== true) throw new Error(`fp: the app's own faces did not load from ${FACE_DIR} (${ok})`);
      }
      return res;
    };
  }
}

module.exports = { start, fence, brandFaces, ROOT, STUBS, BRAND_FACES, FACE_DIR, FACE_GAP, FACES_ID };
