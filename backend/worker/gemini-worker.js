// Cloudflare Worker — calorie-chat backend for THE VAULT.
// Holds the Gemini API key as a secret so the app never sees it.
// The app POSTs { "text": "رز مع دجاج" } and gets back { items: [...] }.
//
// Deploy: create a free Cloudflare Worker, paste this code, then add a secret
// named GEMINI_KEY with your free Gemini API key (Settings → Variables → Add
// secret). See backend/README.md for step-by-step.

// Free-tier models tried IN ORDER. If one is out of its daily/minute quota
// (429) or unavailable (404), the Worker falls through to the next. Ordered by
// QUALITY first — the lite model is too weak (it echoes the examples), so it is
// only a last resort. gemini-2.0-flash is the high-quota safety net once
// gemini-2.5-flash hits its small daily free limit.
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
];

// No strict responseSchema (the model mis-handles the nested array). Drive the
// JSON shape with the prompt + examples instead.
const SYSTEM = [
  'You convert a user food message into JSON for a calorie tracker. Output JSON only — no markdown.',
  'List every food or drink mentioned in the message, one object per item — treat each as something the user ate.',
  'NEVER add a food that is not in the message. NEVER skip a food that is in the message. One food = one item.',
  'If an IMAGE is given, identify every food/drink you can see — one item per distinct food.',
  'For EVERY item you MUST first ESTIMATE the portion weight in grams: use the amount the user stated if given;',
  'otherwise infer a realistic portion — from a photo use visual cues (plate/utensil size, food density, how full it looks).',
  'Then compute calories (kcal) and protein/carbs/fat (grams) FOR THAT estimated weight — never leave them at 0 for a real food.',
  'name = a short label in the user language that INCLUDES the estimated portion, e.g. "برجر ~200غ", "أرز ~150غ", "تفاحة ~180غ".',
  'If there is no food at all (in the message or the image), output {"items":[]}.',
  'Shape: {"items":[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}',
  'Example: "تفاحة" -> {"items":[{"name":"تفاحة ~180غ","calories":95,"protein":0,"carbs":25,"fat":0}]}',
  'Example: "فطور بيض وخبز وغدا برجر" -> {"items":[{"name":"بيض ~100غ","calories":155,"protein":13,"carbs":1,"fat":11},{"name":"خبز ~60غ","calories":160,"protein":6,"carbs":30,"fat":2},{"name":"برجر ~220غ","calories":550,"protein":28,"carbs":42,"fat":28}]}',
  'Example: "مرحبا كيفك" -> {"items":[]}',
].join(' ');

// Origins allowed to call this Worker.
// NOTE: if the AI stops working on the Android phone, check that the
// Capacitor WebView origin (typically https://localhost for Android) is in
// this list and redeploy. The current set covers: GitHub Pages prod,
// Capacitor Android (https://localhost), and local dev variants.
const ALLOWED_ORIGINS = new Set([
  'https://moathdarweesh.github.io',
  'https://localhost',
  'http://localhost',
  'http://localhost:8080',
]);

// Local development on ANY port: the preview tool starts dev-server.js on 8090
// (.claude/launch.json, autoPort) and a hand-started one sits on 8080. The fixed
// list admitted only 8080, so the preview's AI calls failed with "Failed to
// fetch". scripts/check-contracts.js tests every configured port against this.
const LOCAL_DEV_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

function corsHeaders(requestOrigin) {
  const origin = (ALLOWED_ORIGINS.has(requestOrigin) || LOCAL_DEV_ORIGIN.test(requestOrigin || ''))
    ? requestOrigin
    : 'https://moathdarweesh.github.io';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Authorization is REQUIRED here: the client sends a Supabase bearer token,
    // and a cross-origin request carrying Authorization triggers a CORS preflight
    // that fails (browser shows "Failed to fetch") unless the header is allowed.
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(obj, status, requestOrigin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(requestOrigin) },
  });
}

function clampItems(rawItems) {
  const clamp = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  return (Array.isArray(rawItems) ? rawItems : []).map((it) => ({
    name: String((it && it.name) || '').trim().slice(0, 80).replace(/[<>]/g, ''),
    calories: clamp(it && it.calories, 10000),
    protein: clamp(it && it.protein, 2000),
    carbs: clamp(it && it.carbs, 2000),
    fat: clamp(it && it.fat, 2000),
  })).filter((it) =>
    it.name && it.name.toUpperCase() !== 'NOT_FOOD' &&
    (it.calories > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0)
  );
}

// Call one Gemini model. `req` = { text, image, audio, prompt, mode }.
//   - mode 'chat' → free-form text answer, returns { ok, reply }.
//   - audio present → voice: transcribe + extract, returns { ok, transcript, items }.
//   - otherwise → food/photo, returns { ok, items }.
// Returns { rateLimited: true } on 429/404, or { error } on any other failure.
// The only instruction chat mode ever runs under. Not overridable by the client.
const CHAT_SYSTEM = [
  'You are the nutrition and training coach inside a fitness app called VAULT.',
  'Answer ONLY questions about food, calories, macros, meals, hydration, sleep, training, recovery and body weight.',
  'If the message is about anything else, reply with one short sentence saying you can only help with nutrition and training.',
  'Reply in the language of the message. Be concise: at most 120 words, no markdown headings.',
  'Never claim to be a doctor; for medical questions advise seeing a professional.',
].join(' ');

async function callModel(model, key, req) {
  const chat = req.mode === 'chat';
  const isAudio = !!(req.audio && req.audio.data);
  const isImage = !!(req.image && req.image.data);

  // Chat mode takes the caller's TEXT as the user turn and nothing else: the
  // client-supplied prompt is honoured only for audio (the voice instruction),
  // never as a free-form system prompt. Without this, any signed-in account had
  // an unconstrained Gemini relay on the owner's key.
  const userText = chat ? req.text : (req.prompt || req.text);
  const parts = [{ text: userText || (isImage ? 'Identify the food in this photo.' : '') }];
  if (isImage) parts.push({ inline_data: { mime_type: req.image.mimeType || 'image/jpeg', data: req.image.data } });
  if (isAudio) parts.push({ inline_data: { mime_type: req.audio.mimeType || 'audio/webm', data: req.audio.data } });

  const body = {
    contents: [{ parts }],
    generationConfig: chat
      ? { temperature: 0.4 }
      : { responseMimeType: 'application/json', temperature: 0 },
  };
  // Food/photo use the strict JSON SYSTEM prompt; audio + chat carry their own
  // instruction in `prompt`, so they don't get the food-only system prompt.
  if (!chat && !isAudio) body.systemInstruction = { parts: [{ text: SYSTEM }] };
  // Chat gets a FIXED coach instruction from the server. It scopes the model to
  // nutrition and training questions and tells it to decline anything else.
  if (chat) body.systemInstruction = { parts: [{ text: CHAT_SYSTEM }] };

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
  } catch (e) {
    return { error: 'upstream fetch failed' };
  }

  if (res.status === 429 || res.status === 404) return { rateLimited: true };

  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const e = await res.json(); msg = (e.error && e.error.message) || msg; } catch (_) {}
    console.error('[gemini-worker] upstream error:', msg);
    return { error: 'upstream_error' };
  }

  const data = await res.json();
  const partText = data && data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!partText) return { error: 'no result' };

  // Chat mode: return the raw text answer (capped), no JSON parsing.
  if (chat) return { ok: true, reply: String(partText).slice(0, 1200) };

  const cleaned = String(partText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let obj;
  try { obj = JSON.parse(cleaned); } catch (_) { return { error: 'parse error' }; }

  const items = clampItems(obj.items);
  if (isAudio) {
    const transcript = String(obj.transcript || '').slice(0, 300).replace(/[<>]/g, '');
    return { ok: true, transcript, items };
  }
  return { ok: true, items };
}

// Supabase (public values — the anon key is safe to ship) used only to VALIDATE a
// caller's access token. CORS is not access control: a scripted non-browser caller
// with any Origin still reaches the Worker, so without this one actor can drain the
// shared Gemini quota / rack up cost. We require an authenticated caller.
const SUPABASE_URL = 'https://ilmusnuchqlpirywonzx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_ZBR2VENMP2O_K2YTMePCsw_NfLC9FSI';

// Validate the caller's Supabase JWT by asking Supabase who it belongs to.
//
// FAIL-SAFE, but no longer fail-OPEN on everything:
//   - missing token                  → block (anonymous abuse)
//   - a DEFINITIVE 4xx (400/401/403/404/422) → block. Previously only 401/403
//     blocked and every other status fell through to "allow", so any other 4xx
//     Supabase returned for a malformed/garbage token silently authorised it.
//   - 429 (auth endpoint throttled)  → allow. This is NOT a statement about the
//     token: Supabase is rate-limiting us, and treating it as "invalid" would
//     lock a legitimate signed-in user out of AI during a traffic spike. Rate
//     limited by Cloudflare's caller IP below, not by an unverified token.
//   - 5xx or a network error         → allow. This is the case the fail-open was
//     written for: a genuine Supabase outage must not take AI down for real users.
//   - a 200 with no usable user id   → allow through the same IP bucket. A
//     malformed success body is not proof that the caller's token is invalid,
//     but it must never create an unlimited null-key path.
//
// Returns { allowed, userId } — the id is what the rate limiter below keys on, so
// one authenticated account cannot drain the shared Gemini quota for everyone.
// During an auth-service anomaly, userId carries the edge-observed IP key instead.
function outageRateKey(request) {
  // Cloudflare supplies/overwrites this header at the edge. Unlike bearer-token
  // suffixes, a caller cannot mint a fresh bucket by changing request text.
  return 'outage-ip:' + (request.headers.get('CF-Connecting-IP') || 'unknown');
}

async function callerAllowed(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { allowed: false, userId: null };
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON },
    });
    // 429 is Supabase throttling US, not a verdict on the token — fall through to
    // the transient branch below instead of locking the user out.
    if (r.status >= 400 && r.status < 500 && r.status !== 429) {
      return { allowed: false, userId: null };
    }
    if (r.ok) {
      let userId = null;
      try { const u = await r.json(); userId = (u && u.id) || null; } catch (_) {}
      return { allowed: true, userId: userId || outageRateKey(request) };
    }
    // 429/5xx → Supabase is unwell, not the caller. Keep the availability
    // tradeoff, but share one bucket per edge-observed IP so rotating arbitrary
    // bearer junk cannot turn the outage into an unlimited Gemini relay.
    return { allowed: true, userId: outageRateKey(request) };
  } catch (_) {
    return { allowed: true, userId: outageRateKey(request) };  // unreachable → capped allow
  }
}

// Per-caller burst limit. ⚠️ MEASURED INEFFECTIVE, kept only because it costs
// nothing: the counter lives in one isolate's memory, and the identical gate
// above refused 0 of 100 requests from one IP in 12 seconds before it was
// replaced by the binding. Treat this as documentation of intent, never as a
// control you can rely on. The real bound on a determined caller is the durable
// daily budget in Postgres — see budgetAllows.
const RATE_MAX = 30;              // requests per window per caller
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const rateBuckets = new Map();
// The gate BEFORE the Supabase auth lookup. Without it every unauthenticated
// request costs a subrequest, so a loop of junk bearer tokens spends the
// Worker's 100,000/day free budget — and turns the AI off for everyone —
// without ever holding an account.
//
// ⚠️ THIS MUST NOT BE A Map. The first version of this function was one, and it
// was measured against the deployed Worker: 100 POSTs from a single IP over one
// keep-alive connection in 12 seconds, and a 60-per-minute limit refused
// exactly NONE of them. Cloudflare spreads requests across isolates and each
// gets its own memory, so an in-isolate counter is an illusion of protection —
// it reads as a rate limit in review and is not one. `rateLimited` below is the
// same shape and the same illusion; the DURABLE per-user and global day budget
// in Postgres (budgetAllows) is what actually bounds a determined caller.
//
// env.RATE_LIMITER is Cloudflare's own rate-limiting binding: shared across
// isolates, free, and declared in wrangler.toml. It fails OPEN — a binding that
// is missing or erroring must not lock the app out of its own AI.
async function ipFlooding(request, env) {
  const limiter = env && env.RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== 'function') return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await limiter.limit({ key: ip });
    return !success;
  } catch (_) {
    return false;
  }
}

// THE DURABLE ONE. `rateBuckets` below lives in isolate memory: every PoP and
// every cold start has its own copy, so it cannot bound a DAY's spend of the
// one Gemini key everybody shares — one account looping this endpoint used to
// exhaust the free quota and switch the AI off for every user until midnight.
// Postgres is the shared store this app already has. `ai_budget_take` (migration
// 26) counts per user and globally per UTC day, SECURITY DEFINER, and is called
// with the CALLER'S OWN token, so the row is attributed by auth.uid() and cannot
// be forged. Fail-OPEN on a network/5xx failure (the same availability trade the
// auth check makes) and fail-CLOSED only on an explicit refusal.
async function budgetAllows(request) {
  const raw = request.headers.get('Authorization') || '';
  if (!raw.startsWith('Bearer ')) return { ok: true };           // no token: nobody to bill
  // REBUILD the header from the parsed token. callerAllowed trims, so
  // `Bearer  <valid token>` (two spaces) passes the auth check while PostgREST
  // rejects the malformed header — and this function fails open, which would
  // skip the daily budget for anyone who noticed.
  const token = raw.slice(7).trim();
  if (!token) return { ok: true };
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/ai_budget_take', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: '{}',                                                 // both limits keep their SQL defaults
    });
    if (!r.ok) return { ok: true };                               // the RPC is missing or unwell: do not lock the app out
    const v = await r.json();
    if (v && v.allowed === false) return { ok: false, reason: v.reason || 'daily' };
    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}

function rateLimited(userId) {
  if (!userId) return true; // invariant guard: an allowed caller must have a key
  const now = Date.now();
  const b = rateBuckets.get(userId);
  if (!b || now - b.start >= RATE_WINDOW_MS) {
    rateBuckets.set(userId, { start: now, n: 1 });
    if (rateBuckets.size > 5000) {   // bound memory on a long-lived isolate
      for (const [k, v] of rateBuckets) if (now - v.start >= RATE_WINDOW_MS) rateBuckets.delete(k);
    }
    return false;
  }
  b.n += 1;
  return b.n > RATE_MAX;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight: reflect allowed origin.
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

    // Cheapest gate first: an IP flood is refused before it can cost a Supabase
    // subrequest. Then the token, then the per-minute burst, then the durable
    // daily budget — each one more expensive than the last.
    if (await ipFlooding(request, env)) return json({ error: 'rate limited' }, 429, origin);
    const caller = await callerAllowed(request);
    if (!caller.allowed) return json({ error: 'unauthorized' }, 401, origin);
    if (rateLimited(caller.userId)) return json({ error: 'rate limited' }, 429, origin);

    const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const OK_AUDIO = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/m4a', 'audio/3gpp'];
    const MAX_IMG = 1400000;   // ~1MB decoded — plenty for a 1024px JPEG
    const MAX_AUDIO = 8000000; // ~6MB decoded — a short voice clip is far smaller

    let text = '';
    let image = null;
    let audio = null;
    let prompt = '';
    let mode = '';
    try {
      const body = await request.json();
      text = String(body.text || '').slice(0, 500);
      prompt = String(body.prompt || '').slice(0, 1200);
      mode = body.mode === 'chat' ? 'chat' : '';
      if (body.image && body.image.data) {
        const data = String(body.image.data);
        if (data.length > MAX_IMG) return json({ error: 'image too large' }, 413, origin);
        let mime = String(body.image.mimeType || 'image/jpeg').toLowerCase();
        if (OK_MIME.indexOf(mime) === -1) mime = 'image/jpeg';
        image = { mimeType: mime, data };
      }
      if (body.audio && body.audio.data) {
        const data = String(body.audio.data);
        if (data.length > MAX_AUDIO) return json({ error: 'audio too large' }, 413, origin);
        let mime = String(body.audio.mimeType || 'audio/webm').toLowerCase();
        // Normalise codec-suffixed types (e.g. "audio/webm;codecs=opus").
        mime = mime.split(';')[0].trim();
        if (OK_AUDIO.indexOf(mime) === -1) mime = 'audio/webm';
        audio = { mimeType: mime, data };
      }
    } catch (_) { /* ignore */ }
    if (!text.trim() && !image && !audio) return json({ error: 'no input' }, 400, origin);

    const key = env.GEMINI_KEY;
    if (!key) return json({ error: 'server misconfigured' }, 500, origin);

    // The durable daily budget is spent HERE — after the body is known to be
    // valid and just before the upstream call. Taken any earlier, a malformed
    // request that never reaches Gemini still burns a slot, and sixty empty
    // POSTs would exhaust an account's day without costing the key anything.
    const budget = await budgetAllows(request);
    if (!budget.ok) return json({ error: 'daily limit', code: 'DAILY_LIMIT' }, 429, origin);

    const req = { text, image, audio, prompt, mode };

    // Try each model until one answers. Track whether failures were all quota.
    let lastError = null;
    let allRateLimited = true;
    for (const model of MODELS) {
      const r = await callModel(model, key, req);
      if (r.ok) {
        if (mode === 'chat') return json({ reply: r.reply }, 200, origin);
        if (audio) return json({ transcript: r.transcript, items: r.items }, 200, origin);
        return json({ items: r.items }, 200, origin);
      }
      if (r.rateLimited) { lastError = 'rate_limited'; continue; }
      allRateLimited = false;
      lastError = r.error;
    }

    // Every model failed. Use 429 + a clear code for quota so the app can show
    // a friendly "try again later" message instead of a raw English error.
    if (allRateLimited) return json({ error: 'rate_limited', code: 'RATE_LIMIT' }, 429, origin);
    // Generic 502 — don't leak the internal error string to the client.
    console.error('[gemini-worker] all models failed, last error:', lastError);
    return json({ error: 'service unavailable' }, 502, origin);
  },
};
