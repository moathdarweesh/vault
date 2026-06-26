// Cloudflare Worker — calorie-chat backend for THE VAULT.
// Holds the Gemini API key as a secret so the app never sees it.
// The app POSTs { "text": "رز مع دجاج" } and gets back
// { name, calories, protein, carbs, fat }.
//
// Deploy: create a free Cloudflare Worker, paste this code, then add a secret
// named GEMINI_KEY with your free Gemini API key (Settings → Variables → Add
// secret). See backend/README.md for step-by-step.

const MODEL = 'gemini-2.5-flash';

// gemini-2.5-flash mis-handles a strict array responseSchema (returns empty for
// everything), so we drive the JSON shape with the prompt + examples instead.
const SYSTEM = [
  'You read a food-log message for a fitness app and reply with JSON only (no markdown).',
  'The user talks naturally and may mention several foods across meals (breakfast, lunch, dinner, snacks).',
  'Return: {"items":[{"name":string,"calories":number,"protein":number,"carbs":number,"fat":number}, ...]}',
  'Add one item per distinct food or drink the user ate, name = a short label in the user language,',
  'and estimate macros for the portion described (one typical serving if unspecified;',
  'calories in kcal, protein/carbs/fat in grams).',
  'If the message contains no food (a question, greeting, joke, or random text), return {"items":[]}.',
  'Examples:',
  'Input: "فطور بيض وخبز وغدا برجر" -> {"items":[{"name":"بيض وخبز","calories":280,"protein":16,"carbs":24,"fat":13},{"name":"برجر","calories":400,"protein":20,"carbs":40,"fat":18}]}',
  'Input: "كيف الطقس" -> {"items":[]}',
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
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
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
