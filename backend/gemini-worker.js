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

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : 'https://moathdarweesh.github.io';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
async function callModel(model, key, req) {
  const chat = req.mode === 'chat';
  const isAudio = !!(req.audio && req.audio.data);
  const isImage = !!(req.image && req.image.data);

  const parts = [{ text: req.prompt || req.text || (isImage ? 'Identify the food in this photo.' : '') }];
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
// FAIL-SAFE: a MISSING token is rejected (blocks anonymous abuse), and an
// explicitly INVALID token (401/403) is rejected — but ANY other outcome (network
// error, unexpected status) FALLS OPEN and allows the request, so a transient
// Supabase hiccup can never take AI down for real users.
async function callerAllowed(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return false;                     // no token → block (anonymous)
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON },
    });
    if (r.status === 401 || r.status === 403) return false; // confirmed invalid
    return true;                                // 200 valid, or anything else → allow
  } catch (_) {
    return true;                               // verification unreachable → fail open
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight: reflect allowed origin.
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

    // Require an authenticated caller (see callerAllowed — fail-safe).
    if (!(await callerAllowed(request))) return json({ error: 'unauthorized' }, 401, origin);

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
