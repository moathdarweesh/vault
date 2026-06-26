// Cloudflare Worker — calorie-chat backend for THE VAULT.
// Holds the Gemini API key as a secret so the app never sees it.
// The app POSTs { "text": "رز مع دجاج" } and gets back
// { name, calories, protein, carbs, fat }.
//
// Deploy: create a free Cloudflare Worker, paste this code, then add a secret
// named GEMINI_KEY with your free Gemini API key (Settings → Variables → Add
// secret). See backend/README.md for step-by-step.

const MODEL = 'gemini-2.5-flash';

// No strict responseSchema (the model mis-handles the nested array). Drive the
// JSON shape with the prompt + examples instead.
const SYSTEM = [
  'You convert a user food message into JSON for a calorie tracker. Output JSON only — no markdown.',
  'List every food or drink mentioned in the message, one object per item — treat each as something the user ate.',
  'NEVER add a food that is not in the message. NEVER skip a food that is in the message. One food = one item.',
  'name = a short label in the user language; calories in kcal; protein, carbs, fat in grams —',
  'for the stated portion, or one typical serving if not stated.',
  'If the message has no food at all (a question, greeting, chit-chat, or random text), output {"items":[]}.',
  'Shape: {"items":[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}',
  'Example: "تفاحة" -> {"items":[{"name":"تفاحة","calories":95,"protein":0,"carbs":25,"fat":0}]}',
  'Example: "فطور بيض وخبز وغدا برجر" -> {"items":[{"name":"بيض","calories":150,"protein":13,"carbs":1,"fat":11},{"name":"خبز","calories":80,"protein":3,"carbs":15,"fat":1},{"name":"برجر","calories":400,"protein":20,"carbs":40,"fat":18}]}',
  'Example: "مرحبا كيفك" -> {"items":[]}',
].join(' ');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let text = '';
    try {
      const body = await request.json();
      text = String(body.text || '').slice(0, 500);
    } catch (_) { /* ignore */ }
    if (!text.trim()) return json({ error: 'no text' }, 400);

    const key = env.GEMINI_KEY;
    if (!key) return json({ error: 'server not configured (missing GEMINI_KEY)' }, 500);

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    };

    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
      );
    } catch (e) {
      return json({ error: 'upstream fetch failed' }, 502);
    }

    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const e = await res.json(); msg = (e.error && e.error.message) || msg; } catch (_) {}
      return json({ error: msg }, 502);
    }

    const data = await res.json();
    const partText = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!partText) return json({ error: 'no result' }, 502);

    // Strip any accidental ```json fences, then parse.
    const cleaned = String(partText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let obj;
    try { obj = JSON.parse(cleaned); } catch (_) { return json({ error: 'parse error' }, 502); }

    const rawItems = Array.isArray(obj.items) ? obj.items : [];
    const items = rawItems.map((it) => ({
      name: String((it && it.name) || '').trim().slice(0, 80),
      calories: Math.max(0, Math.round(Number(it && it.calories) || 0)),
      protein: Math.max(0, Math.round(Number(it && it.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(it && it.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(it && it.fat) || 0)),
    })).filter((it) =>
      it.name && it.name.toUpperCase() !== 'NOT_FOOD' &&
      (it.calories > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0)
    );
    return json({ items }, 200);
  },
};
