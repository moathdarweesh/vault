// Cloudflare Worker — calorie-chat backend for THE VAULT.
// Holds the Gemini API key as a secret so the app never sees it.
// The app POSTs { "text": "رز مع دجاج" } and gets back
// { name, calories, protein, carbs, fat }.
//
// Deploy: create a free Cloudflare Worker, paste this code, then add a secret
// named GEMINI_KEY with your free Gemini API key (Settings → Variables → Add
// secret). See backend/README.md for step-by-step.

const MODEL = 'gemini-2.5-flash';

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
  },
  required: ['name', 'calories', 'protein', 'carbs', 'fat'],
};

const SYSTEM = [
  'You estimate nutrition for a fitness app food log.',
  'If the user message names any food, drink, dish, snack, or ingredient (any language),',
  'set name to a short label in the user language and estimate calories (kcal) and',
  'protein/carbs/fat (grams) for one typical serving or the stated portion.',
  'If the message is NOT food (a question, greeting, joke, command, or random text),',
  'set name to exactly "NOT_FOOD" and every number to 0.',
  'Reply with the JSON object only.',
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
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
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

    let obj;
    try { obj = JSON.parse(partText); } catch (_) { return json({ error: 'parse error' }, 502); }

    const calories = Math.max(0, Math.round(Number(obj.calories) || 0));
    const protein = Math.max(0, Math.round(Number(obj.protein) || 0));
    const carbs = Math.max(0, Math.round(Number(obj.carbs) || 0));
    const fat = Math.max(0, Math.round(Number(obj.fat) || 0));
    const nameRaw = String(obj.name || '').trim();
    const isFood = nameRaw.toUpperCase() !== 'NOT_FOOD' &&
      (calories > 0 || protein > 0 || carbs > 0 || fat > 0);
    return json({
      isFood,
      name: isFood ? (nameRaw || text).slice(0, 80) : '',
      calories, protein, carbs, fat,
    }, 200);
  },
};
