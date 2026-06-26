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
    isFood: { type: 'boolean' },
    name: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
  },
  required: ['isFood', 'name', 'calories', 'protein', 'carbs', 'fat'],
};

const SYSTEM = [
  'You are a nutrition estimator for a fitness app. The user sends one message.',
  'If the message describes a food or meal (Arabic or English), set isFood=true,',
  'set name to a short label of the meal in the same language, and estimate the TOTAL',
  'nutrition for the portion described — calories in kcal, protein/carbs/fat in grams',
  '(assume one typical serving if no portion is given).',
  'If the message is NOT about food (a question, greeting, joke, opinion, random text,',
  'or anything not edible), set isFood=false, name to "", and all numbers to 0.',
  'Never invent a meal that the user did not mention. Reply with the JSON object only.',
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
