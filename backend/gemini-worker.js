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
    isFood: { type: 'boolean' },
  },
  required: ['name', 'calories', 'protein', 'carbs', 'fat', 'isFood'],
  propertyOrdering: ['name', 'calories', 'protein', 'carbs', 'fat', 'isFood'],
};

const SYSTEM = [
  'You estimate nutrition for meals in a fitness app. Treat the user message as a food log entry.',
  'If it names ANY food, drink, dish, snack, or ingredient (in any language), it IS food:',
  'set name to a short label in the user language, estimate calories (kcal) and protein/carbs/fat',
  '(grams) for one typical serving or the stated portion, and set isFood=true.',
  'Default to isFood=true whenever the message could plausibly be food.',
  'ONLY when the message is clearly NOT edible (a question, greeting, joke, command, or random',
  'characters) set name="", every number 0, and isFood=false.',
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

    const isFood = obj.isFood !== false;
    return json({
      isFood,
      name: isFood ? String(obj.name || text).slice(0, 80) : '',
      calories: Math.max(0, Math.round(Number(obj.calories) || 0)),
      protein: Math.max(0, Math.round(Number(obj.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(obj.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(obj.fat) || 0)),
    }, 200);
  },
};
