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
  'If an IMAGE is given, identify every food/drink you can see and estimate the calories+macros for the portion shown — one item per distinct food.',
  'name = a short label in the user language; calories in kcal; protein, carbs, fat in grams —',
  'for the stated portion, or one typical serving if not stated.',
  'If there is no food at all (in the message or the image), output {"items":[]}.',
  'Shape: {"items":[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}',
  'Example: "تفاحة" -> {"items":[{"name":"تفاحة","calories":95,"protein":0,"carbs":25,"fat":0}]}',
  'Example: "فطور بيض وخبز وغدا برجر" -> {"items":[{"name":"بيض","calories":150,"protein":13,"carbs":1,"fat":11},{"name":"خبز","calories":80,"protein":3,"carbs":15,"fat":1},{"name":"برجر","calories":400,"protein":20,"carbs":40,"fat":18}]}',
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

// Call one Gemini model. Returns { ok, items } on success, or
// { rateLimited: true } on 429, or { error } on any other failure.
// `image` is an optional { mimeType, data(base64) } for photo analysis.
async function callModel(model, key, text, image) {
  const parts = [{ text: text || (image ? 'Identify the food in this photo.' : '') }];
  if (image && image.data) parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } });
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  };

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
  } catch (e) {
    return { error: 'upstream fetch failed' };
  }

  // 429 = quota for this model. 404 = model name not available. Either way,
  // let the caller try the next model in the list.
  if (res.status === 429 || res.status === 404) return { rateLimited: true };

  if (!res.ok) {
    // Log server-side for debugging but don't leak provider internals to the client.
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

  const cleaned = String(partText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let obj;
  try { obj = JSON.parse(cleaned); } catch (_) { return { error: 'parse error' }; }

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems.map((it) => ({
    name: String((it && it.name) || '').trim().slice(0, 80).replace(/[<>]/g, ''),
    calories: Math.max(0, Math.round(Number(it && it.calories) || 0)),
    protein: Math.max(0, Math.round(Number(it && it.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(it && it.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(it && it.fat) || 0)),
  })).filter((it) =>
    it.name && it.name.toUpperCase() !== 'NOT_FOOD' &&
    (it.calories > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0)
  );
  return { ok: true, items };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight: reflect allowed origin.
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

    const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_IMG = 1400000; // ~1MB decoded — plenty for a 1024px JPEG

    let text = '';
    let image = null;
    try {
      const body = await request.json();
      text = String(body.text || '').slice(0, 500);
      if (body.image && body.image.data) {
        const data = String(body.image.data);
        // Reject oversize images here, before forwarding to Gemini (returns 413).
        if (data.length > MAX_IMG) return json({ error: 'image too large' }, 413, origin);
        let mime = String(body.image.mimeType || 'image/jpeg').toLowerCase();
        if (OK_MIME.indexOf(mime) === -1) mime = 'image/jpeg';
        image = { mimeType: mime, data };
      }
    } catch (_) { /* ignore */ }
    if (!text.trim() && !image) return json({ error: 'no input' }, 400, origin);

    const key = env.GEMINI_KEY;
    if (!key) return json({ error: 'server misconfigured' }, 500, origin);

    // Try each model until one answers. Track whether failures were all quota.
    let lastError = null;
    let allRateLimited = true;
    for (const model of MODELS) {
      const r = await callModel(model, key, text, image);
      if (r.ok) return json({ items: r.items }, 200, origin);
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
