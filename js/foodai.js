// AI calorie chat for THE VAULT — describe a meal in plain Arabic/English and
// get calories + macros, then log them. Uses Google's free Gemini API.
// The API key is the user's own free key, stored only on-device (localStorage),
// never bundled in the repo.
(function () {
  'use strict';

  // Backend proxy (Cloudflare Worker) that holds the Gemini key server-side.
  // When set, the app calls this instead of Gemini directly — the user never
  // enters a key and just sees the chat. Leave '' to use the per-user key flow.
  const PROXY_URL = 'https://vault-calories.moathdarweesh2000.workers.dev';

  // Free-tier model (direct-key path only; the proxy tries several). Keep the
  const tr = (k) => (typeof t === 'function' ? t(k) : k);
  const ic = (n, s) => (typeof icon === 'function' ? icon(n, s || 20) : '');
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

  // A dropped connection surfaces as TypeError('Failed to fetch'/'Load failed').
  // Show the localized network message instead of the raw browser string; keep
  // already-localized errors (rate limit, etc.) as-is.
  // Also maps the Worker's fixed English error constants (they are protocol,
  // not prose): 'unauthorized' → sign-in hint, 'too large' → too large, and
  // everything else it emits → the generic AI error. Exported on FoodAI so the
  // voice panel in app.js can use it instead of printing e.message raw.
  // THE WORKER'S ERROR VOCABULARY, as the client understands it. Compared on
  // every commit against every `error: '…'` the Worker can return
  // (scripts/check-contracts.js), after lower-casing and turning '_' into ' ' —
  // the Worker says both 'rate limited' and 'rate_limited', and the second used
  // to reach the screen raw.
  const WORKER_ERR_RE = /^(unauthorized|rate limited|image too large|audio too large|too large|service unavailable|server misconfigured|upstream|no result|parse error|method not allowed|no input|http \d+)/;
  function friendlyErr(e) {
    const raw = (e && e.message) || '';
    const m = raw.toLowerCase().replace(/_/g, ' ');
    if ((e && e.name === 'TypeError') || /failed to fetch|load failed|networkerror|network request/i.test(m)) {
      return tr('auth_err_network');
    }
    if (/^unauthorized$/.test(m)) return tr('ai_err_signin');
    if (/too large/.test(m)) return tr('ai_err_too_large');
    if (/^rate limited/.test(m)) return tr('ai_err_busy');
    if (WORKER_ERR_RE.test(m)) return tr('ai_error');
    return raw || tr('ai_error');
  }

  // ---- result cache --------------------------------------------------------
  // The model RE-ESTIMATES on every call, so the same meal can come back with
  // slightly different numbers. We cache by normalized text so an identical
  // message always returns the SAME macros (and skips a network call).
  const CACHE_STORE = VAULT_KEYS.foodaiCache;
  const normKey = (text) =>
    String(text)
      .trim()
      .toLowerCase()
      .replace(/[ـً-ْ]/g, '') // strip Arabic tatweel + tashkeel
      .replace(/\s+/g, ' ');
  function cacheGet(text) {
    try { const m = JSON.parse(localStorage.getItem(CACHE_STORE) || '{}'); return m[normKey(text)] || null; }
    catch (_) { return null; }
  }
  function cacheSet(text, items) {
    try {
      const m = JSON.parse(localStorage.getItem(CACHE_STORE) || '{}');
      m[normKey(text)] = items;
      const keys = Object.keys(m);
      if (keys.length > 500) delete m[keys[0]]; // keep it bounded
      localStorage.setItem(CACHE_STORE, JSON.stringify(m));
    } catch (_) {}
  }

  // Prompt-driven JSON (no strict schema — gemini-2.5-flash mis-handles the
  // nested array schema). Mirrors backend/worker/gemini-worker.js.
  const SYSTEM = [
    'You convert a user food message into JSON for a calorie tracker. Output JSON only — no markdown.',
    'List every food or drink mentioned in the message, one object per item — treat each as something the user ate.',
    'NEVER add a food that is not in the message. NEVER skip a food that is in the message. One food = one item.',
    'If an IMAGE is given, identify every food/drink you can see and estimate the calories+macros for the portion shown — one item per distinct food.',
    'name = a short label in the user language; calories in kcal; protein, carbs, fat in grams —',
    'for the stated portion, or one typical serving if not stated.',
    'If there is no food at all (in the message or the image), output {"items":[]}.',
    'Example: "تفاحة" -> {"items":[{"name":"تفاحة","calories":95,"protein":0,"carbs":25,"fat":0}]}',
    'Example: "فطور بيض وخبز وغدا برجر" -> {"items":[{"name":"بيض","calories":150,"protein":13,"carbs":1,"fat":11},{"name":"خبز","calories":80,"protein":3,"carbs":15,"fat":1},{"name":"برجر","calories":400,"protein":20,"carbs":40,"fat":18}]}',
    'Example: "مرحبا كيفك" -> {"items":[]}',
  ].join(' ');

  // Attach the signed-in user's Supabase access token so the Worker can require an
  // authenticated caller (blocks anonymous quota/cost abuse). Best-effort: logged
  // out or pre-token we omit it, and the Worker is designed to fall open on any
  // verification uncertainty so this can never break AI for a real user.
  async function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    try {
      if (window.Cloud && Cloud.getSession) {
        const s = await Cloud.getSession();
        if (s && s.access_token) h['Authorization'] = 'Bearer ' + s.access_token;
      }
    } catch (_) {}
    return h;
  }
  // Ready to chat = either a backend proxy is configured, or the user saved a key.
  // Call the backend proxy (no key in the app) and return the macros. `image`
  // is an optional { mimeType, data(base64) } for photo-based analysis.
  async function analyzeViaProxy(text, image) {
    // A photo's instruction travels as `prompt`: the Worker keeps 1200 characters
    // of that (`req.prompt || req.text` in the non-chat modes) but only 500 of
    // `text`, and imagePrompt() with a full 400-character note is ~1170. Sent as
    // `text`, the note — the ground truth that outranks the picture — was the
    // part cut off. check-contracts measures both against the Worker's caps.
    const payload = image ? { text: '', prompt: String(text || ''), image } : { text: String(text || '') };
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Quota hit on every free model — surface a friendly message.
      if (res.status === 429 || (data && (data.code === 'RATE_LIMIT' || data.error === 'rate_limited'))) {
        throw new Error(tr('ai_rate_limit'));
      }
      throw new Error((data && data.error) || ('HTTP ' + res.status));
    }
    return toItems(data);
  }

  // Clean one food item.
  function normalizeItem(d, keepDecimals) {
    // Clamp to a sane range (calories ≤ 10000, macros ≤ 2000) so a bad/injected
    // value can't corrupt the user's totals.
    //
    // keepDecimals is for figures the USER supplied verbatim (a pasted label).
    // Rounding an estimate is honest — the model's "35.5" was never precise. But
    // rounding a number someone copied off a package to 36 quietly contradicts
    // the one thing this path promises, which is that their figures are used as
    // written. One decimal, because that is the precision labels actually carry.
    const round = keepDecimals ? ((n) => Math.round(n * 10) / 10) : Math.round;
    const clamp = (v, max) => Math.min(max, Math.max(0, round(Number(v) || 0)));
    const calories = clamp(d && d.calories, 10000);
    const protein = clamp(d && d.protein, 2000);
    const carbs = clamp(d && d.carbs, 2000);
    const fat = clamp(d && d.fat, 2000);
    const name = String((d && d.name) || '').trim();
    return { name: name.slice(0, 80), calories, protein, carbs, fat };
  }
  const isRealFood = (it) =>
    it.name && it.name.toUpperCase() !== 'NOT_FOOD' &&
    (it.calories > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0);

  // Turn any worker/model response into { items: [...] }. Supports the new
  // multi-item shape and the legacy single-object shape.
  function toItems(data) {
    let raw = [];
    if (Array.isArray(data.items)) raw = data.items;
    else if (data && (data.name !== undefined || data.calories !== undefined)) raw = [data];
    // `(d) => normalizeItem(d)`, NOT `.map(normalizeItem)`. map passes the INDEX
    // as the second argument, which normalizeItem now reads as `keepDecimals` —
    // so a bare reference would round item 0 and keep decimals on every item
    // after it. A model estimate is never precise enough to deserve a decimal.
    return { items: raw.map((d) => normalizeItem(d)).filter(isRealFood) };
  }

  // ==========================================================================
  // PASTED NUTRITION LABELS — read the numbers, do not re-guess them.
  //
  // When the text ALREADY carries the figures (a copied nutrition table, a label
  // photographed and OCR'd elsewhere, a reply from another app), sending it to
  // the model is worse than useless: it costs a round trip, it can come back
  // with DIFFERENT numbers than the ones on the page, and it needs a network.
  // The user asked for exactly this — "let me write the calories and it just
  // computes them" — so an explicit figure wins over an estimate, always.
  //
  // Handles the shape a real paste actually has: markdown table pipes, the "~"
  // approximation sign, colons, newlines, Arabic and English labels, Arabic-Indic
  // digits, and units written as جم / غ / g / mg / ملغ.
  //
  // NOTE ON CHOLESTEROL AND SODIUM: they are parsed only so they can be REPORTED
  // as untracked. DB.foodLogs stores six fields — name, servings, calories,
  // protein, carbs, fat — and nothing else. Silently swallowing two numbers the
  // user deliberately typed would be worse than saying so.
  // ==========================================================================
  const AR_DIGITS = /[٠-٩۰-۹]/g;
  function westernDigits(s) {
    return String(s).replace(AR_DIGITS, (d) => {
      const c = d.charCodeAt(0);
      return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
    });
  }

  // Longest-first so "كربوهيدرات" cannot be shadowed by a shorter alias, and so
  // "سعرات حرارية" matches before "سعرات".
  const MACRO_LABELS = [
    ['calories', ['سعرات حرارية', 'سعرة حرارية', 'السعرات', 'سعرات', 'سعره', 'سعرة', 'طاقة', 'calories', 'calorie', 'energy', 'kcal', 'cal']],
    ['protein',  ['البروتين', 'بروتين', 'protein', 'prot']],
    // "carbs" before "carb"; Arabic spellings vary in the ه/ة and the ي.
    ['carbs',    ['الكربوهيدرات', 'الكاربوهيدرات', 'كربوهيدرات', 'كاربوهيدرات', 'نشويات', 'الكارب', 'كارب', 'carbohydrates', 'carbohydrate', 'carbs', 'carb']],
    ['fat',      ['الدهون', 'دهون', 'دهن', 'الدهنيات', 'fats', 'fat']],
    // Parsed to be reported, never stored.
    ['cholesterol', ['كوليسترول', 'كولسترول', 'cholesterol']],
    ['sodium',      ['الصوديوم', 'صوديوم', 'ملح', 'sodium', 'salt']],
  ];

  function parseMacroText(raw) {
    if (!raw) return null;
    const text = westernDigits(raw).toLowerCase();
    const found = {};
    // MATCHING, and why it is not a regex per label.
    //
    // People write the number on EITHER side of its label:
    //   label first  — "سعرات 1000"  / "calories: 500"   (a pasted table)
    //   number first — "1000 سعرة"   / "500 calories"    (a sentence)
    // Only the table form used to parse, so "أكلت فول فيه 1000 سعرة و55 جرام
    // بروتين" — the way anyone actually types it — fell through to the model and
    // came back re-estimated, throwing away the numbers the user had just given.
    //
    // Accepting both directions per label independently is not enough: in
    // "سعرات 1000 بروتين 55" the 1000 sits one space from BOTH labels, so each
    // regex claims it and protein comes out as 1000. The real rule is that a
    // number belongs to exactly ONE label. So: collect every number and every
    // label occurrence with positions, score each legal pairing by the gap
    // between them, then assign greedily from the tightest pair outward, never
    // reusing a number. Nearest-unclaimed, not nearest.
    const numbers = [];
    // A separator followed by EXACTLY three digits (and no fourth) is a thousands
    // group, not a decimal point: "1,200 calories" was read as 1.2 kcal and logged
    // that way, under the banner that says nothing was estimated. Strip those
    // first, then a remaining [.,] with one or two digits is a real decimal.
    for (const m of text.matchAll(/[0-9]+(?:[.,][0-9]{3}(?![0-9]))*(?:[.,][0-9]{1,2}(?![0-9]))?/gu)) {
      const raw = m[0].replace(/[.,]([0-9]{3})(?![0-9])/g, '$1').replace(',', '.');
      numbers.push({ v: parseFloat(raw), s: m.index, e: m.index + m[0].length });
    }
    // A gap may hold separators (pipes, colons, "~", "≈", spaces) but never a
    // word — a gap that could hold a word is prose, not a table cell. That is
    // what stops "how many calories in 100g rice?" parsing as a 100-kcal meal.
    // One unit word is allowed between a number and the label that follows it
    // ("55 جرام بروتين", "30 g protein").
    const SEP_ONLY = /^[^\p{L}0-9\n]{0,12}$/u;
    // `[^\S\n]*`, NOT `\s*`: \s includes the newline, so a number could bind
    // FORWARD across a line break while SEP_ONLY (which excludes \n) refused to
    // bind backward across one. That asymmetry is what made
    // "Protein 15\nCarbs 14\nFat 39\nCalories 540" report 39 calories — the 39
    // on the previous line was nearer to "Calories" than its own 540.
    const UNIT_THEN_SEP = /^[^\S\n]*(g|gm|gr|kg|mg|kcal|cal|غ|جم|جرام|غرام|قرام|ملغ|كيلو)?[^\p{L}0-9\n]{0,3}$/u;
    const pairs = [];
    MACRO_LABELS.forEach(([key, aliases]) => {
      aliases.forEach((alias) => {
        const a = alias.toLowerCase();
        for (let i = text.indexOf(a); i !== -1; i = text.indexOf(a, i + 1)) {
          const ls = i, le = i + a.length;
          numbers.forEach((n, ni) => {
            if (n.e <= ls) {                       // number ... label
              const between = text.slice(n.e, ls);
              const m = between.match(UNIT_THEN_SEP);
              // A UNIT between the number and the label is the STRONGEST binding
              // there is — "18 جرام بروتين" names its own measure — so it ranks
              // ahead of bare adjacency instead of being penalised by the unit's
              // own length. Without this, "18 جرام بروتين 15 جرام دهون" gave
              // protein 15: the 15 sat one space after the label and outranked
              // the 18 that the phrase actually measures.
              if (m) pairs.push({ key, ni, rank: m[1] ? 0 : 2, d: between.length });
            } else if (le <= n.s) {                // label ... number
              const between = text.slice(le, n.s);
              if (SEP_ONLY.test(between)) pairs.push({ key, ni, rank: 1, d: between.length });
            }
          });
        }
      });
    });
    // DIRECTION OUTRANKS DISTANCE, and distance only breaks ties within a rank.
    //   0 — a number carrying its own unit, then the label ("18 جرام بروتين").
    //       The phrase names its own measure; nothing binds tighter.
    //   1 — label then number ("Calories: 540", "سعرات | ~276"). How every
    //       nutrition panel is written, so it beats a bare number that merely
    //       happens to sit closer on the other side.
    //   2 — bare number then label ("1000 سعرة"). Real, but the weakest claim.
    // Scoring by raw gap alone read "calories 250 fat 8 carbs 30 protein 12" as
    // protein 30 / carbs 8 — every value shifted one label to the left, because
    // each label's own number was one space away in BOTH directions and the tie
    // fell whichever way the scan happened to reach first.
    pairs.sort((x, y) => (x.rank - y.rank) || (x.d - y.d));
    const usedNum = new Set();
    pairs.forEach((p) => {
      if (found[p.key] !== undefined || usedNum.has(p.ni)) return;
      found[p.key] = numbers[p.ni].v;
      usedNum.add(p.ni);
    });
    // Calories are the signal. Without an explicit calorie figure this is a
    // description ("two eggs and toast"), which is the model's job, not ours.
    if (!(found.calories > 0)) return null;
    // And one figure alone is not a table. A nutrition panel always names a
    // second macro next to its calories; a sentence that happens to contain the
    // word "calories" and a number does not. Requiring the pair is what keeps
    // this parser to the paste it was built for instead of hijacking chat.
    if (!['protein', 'carbs', 'fat', 'cholesterol', 'sodium'].some((k) => found[k] > 0)) return null;

    // A name, if the paste carried one: the first line that holds no digits and
    // no macro label. Otherwise a neutral label rather than a wrong guess.
    let name = '';
    westernDigits(raw).split('\n').some((line) => {
      const clean = line.replace(/[|*#>_`~-]/g, ' ').trim();
      if (!clean || /[0-9]/.test(clean)) return false;
      if (MACRO_LABELS.some(([, al]) => al.some((a) => clean.toLowerCase().includes(a.toLowerCase())))) return false;
      name = clean.slice(0, 80);
      return true;
    });
    // A ONE-LINE entry has no clean line to take — "فول مدمس 1000 سعرة و55 جرام
    // بروتين" is all one line and every line holds a digit, so the loop above
    // finds nothing and the meal used to be filed as the generic "وجبة". Strip
    // out what the parser already consumed — the numbers, the macro labels and
    // the units — and whatever words are left ARE the food's name.
    if (!name) {
      const units = 'g|gm|gr|kg|mg|kcal|cal|غ|جم|جرام|غرام|قرام|ملغ|كيلو';
      let rest = westernDigits(raw);
      MACRO_LABELS.forEach(([, aliases]) => {
        // longest alias first, or "سعرات" leaves "حرارية" stranded behind
        [...aliases].sort((a, b) => b.length - a.length).forEach((a) => {
          rest = rest.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
        });
      });
      rest = rest
        .replace(/[0-9]+(?:[.,][0-9]+)?/g, ' ')
        .replace(new RegExp('(?:^|\\s)(?:' + units + ')(?![\\p{L}0-9])', 'giu'), ' ')
        .replace(/[|*#>_`~\-،,.:؛;()\[\]]/g, ' ')
        // leftover connectors that are not part of a dish name
        .replace(/(?:^|\s)(?:و|في|فيه|فيها|من|مع|اكلت|أكلت|شربت|and|with|of|ate|had|drank|approx|about|~|≈)(?=\s|$)/giu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (rest.length >= 2) name = rest.slice(0, 80);
    }

    const item = normalizeItem({
      name: name || tr('ai_pasted_meal'),
      calories: found.calories,
      protein: found.protein,
      carbs: found.carbs,
      fat: found.fat,
    }, true);   // the user's own figures — do not round them away
    // Whatever the app cannot store, named so the caller can say so out loud.
    const untracked = ['cholesterol', 'sodium'].filter((k) => found[k] > 0);
    return { items: [item], parsed: 'local', untracked };
  }

  // Public entry — an explicit figure in the text wins, then the cache (so the
  // SAME text always returns the SAME macros), then the model.
  // opts.skipLocal: do not try the pasted-label parser first — the recipe editor
  // sends '30 g protein powder' lines, which that parser reads as a macro.
  async function analyze(text, opts) {
    if (!(opts && opts.skipLocal)) { const local = parseMacroText(text); if (local) return local; }
    const cached = cacheGet(text);
    if (cached) return { items: cached };
    const result = await analyzeUncached(text);
    if (result && result.items && result.items.length) cacheSet(text, result.items);
    return result;
  }

  // Call the Worker and return { name, calories, protein, carbs, fat }.
  //
  // v277: the personal-API-key path that used to follow this line is GONE, and
  // not because it was tidied — it was UNREACHABLE. useProxy() compared a
  // hardcoded constant, so the moment the Cloudflare Worker became the fixed
  // route (and every user has an account that authenticates to it), the key
  // panel, localStorage key store, and four direct-to-Google fallbacks could
  // never run again. Deleting them also deletes the only UI in the app that
  // ever invited a user to paste a secret.
  async function analyzeUncached(text) {
    return analyzeViaProxy(text);
  }

  // Instruction sent WITH a photo. Tells the model to estimate the actual
  // PORTION from visual cues (so we don't need a worker redeploy — the worker
  // just forwards this text + the image to Gemini).
  // `note` is what the USER typed about their own photo. A picture cannot show
  // what is inside a dish, how it was cooked, or the oil in it, and guessing at
  // those is where a photo estimate goes most wrong. When the user says it, it
  // OUTRANKS the model's reading of the image -- they were holding the plate.
  function imagePrompt(note) {
    let lang = 'en';
    try { lang = (DB && DB.prefs && DB.prefs.get().lang) || 'en'; } catch (_) {}
    return [
      'Look at this food photo. Identify every distinct food and drink.',
      note ? ('The person who took this photo describes it as: "' + String(note).slice(0, 400) +
              '". TREAT THAT AS GROUND TRUTH: it may name the dish, the ingredients, the cooking method, ' +
              'the oil used, or the portion. Where it conflicts with what you think you see, FOLLOW THE ' +
              'DESCRIPTION. If it states explicit calories or macros, use those numbers exactly.') : '',
      'ESTIMATE THE AMOUNT actually shown using visual cues — plate/bowl size, utensils, hands, the container, the number of pieces, and the visible volume/thickness.',
      'Calculate calories and macros for THAT estimated amount — not a generic single serving.',
      'Put the estimated amount inside each item\'s name (e.g. "2 slices pizza", "grilled chicken ~200g", "rice ~1.5 cup").',
      lang === 'ar' ? 'Write the names in Arabic.' : 'Write the names in English.',
    ].join(' ');
  }

  // Analyze a food PHOTO. `image` = { mimeType, data(base64) }. Not cached
  // (every photo is unique).
  async function analyzeImage(image, note) {
    return analyzeViaProxy(imagePrompt(note), image);
  }

  // Downscale a picked image file to a JPEG (max 1024px, q0.7) so the upload
  // stays small. Returns { dataUrl (for the thumbnail), image: { mimeType, data } }.
  function processImage(file, maxDim, quality) {
    maxDim = maxDim || 1024; quality = quality || 0.7;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (Math.max(w, h) > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: dataUrl, image: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------- UI
  let logDate = null; // which day "add to log" writes to

  function resultCardHtml(r, id) {
    return `
      <div class="ai-card" data-result="${id}" data-mult="1"
        data-bcal="${r.calories}" data-bpro="${r.protein}" data-bcarb="${r.carbs}" data-bfat="${r.fat}">
        <div class="ai-card-name">${esc(r.name)}</div>
        <div class="ai-portion">
          <button type="button" class="ai-portion-btn" data-step="-1" aria-label="${tr('portion_less')}">${ic('minus', 16)}</button>
          <span class="ai-portion-val"><span class="num">1</span>×</span>
          <button type="button" class="ai-portion-btn" data-step="1" aria-label="${tr('portion_more')}">${ic('plus', 16)}</button>
          <button type="button" class="ai-edit-toggle" data-edit-card aria-label="${tr('ai_edit_values')}">${ic('edit', 16)}</button>
        </div>
        <div class="ai-macros">
          <span class="ai-macro cal"><b class="num" data-m="cal">${fmtNum(r.calories)}</b>${tr('cal')}</span>
          <span class="ai-macro pro"><b class="num" data-m="pro">${fmtNum(r.protein)}</b>g ${tr('protein_label')}</span>
          <span class="ai-macro carb"><b class="num" data-m="carb">${fmtNum(r.carbs)}</b>g ${tr('carbs_label')}</span>
          <span class="ai-macro fat"><b class="num" data-m="fat">${fmtNum(r.fat)}</b>g ${tr('fat_label')}</span>
          <span class="ai-edited-pill">${tr('ai_edited')}</span>
        </div>
        <!-- The estimate is a starting point, not a verdict. type="number" with
             a plain value attribute and NO localized digits: an <input type=number>
             silently rejects Arabic-Indic numerals, which would blank the field
             the moment it rendered in Arabic. -->
        <div class="ai-edit">
          <label class="ai-edit-f"><span>${tr('cal')}</span><input type="number" inputmode="numeric" step="1" min="0" data-e="cal"></label>
          <label class="ai-edit-f"><span>${tr('protein_label')}</span><input type="number" inputmode="decimal" step="0.1" min="0" data-e="pro"></label>
          <label class="ai-edit-f"><span>${tr('carbs_label')}</span><input type="number" inputmode="decimal" step="0.1" min="0" data-e="carb"></label>
          <label class="ai-edit-f"><span>${tr('fat_label')}</span><input type="number" inputmode="decimal" step="0.1" min="0" data-e="fat"></label>
          <button type="button" class="btn btn-ghost ai-edit-done" data-edit-done>${tr('ai_edit_done')}</button>
        </div>
        <button class="btn btn-primary btn-block ai-add" data-add="${id}">${ic('plus', 15)} ${tr('ai_add_to_log')}</button>
      </div>`;
  }

  // Recompute one card's shown macros from its base × the current multiplier.
  // Shared by the chat + photo result cards. The base (1×) macros live in the
  // card's data-* so the estimate is never lost as the user adjusts the portion.
  function applyPortion(card) {
    const mult = parseFloat(card.dataset.mult) || 1;
    const set = (k, base, dec) => {
      const n = card.querySelector('[data-m="' + k + '"]');
      if (n) n.textContent = fmtNum(dec ? Math.round(base * mult * 10) / 10 : Math.round(base * mult));
    };
    set('cal', +card.dataset.bcal, false);
    set('pro', +card.dataset.bpro, true);
    set('carb', +card.dataset.bcarb, true);
    set('fat', +card.dataset.bfat, true);
    const v = card.querySelector('.ai-portion-val .num');
    if (v) v.textContent = fmtNum(mult);
  }
  function cardMult(card) { return card ? (parseFloat(card.dataset.mult) || 1) : 1; }

  // TWO MODES, ONE PANEL.
  //
  // The owner asked why the calorie CHAT has a camera in it. The honest answer
  // was that "Photo" was never a screen: openPhoto() opened the chat and then
  // synthetically clicked that little camera 120ms later. So picking "صورة" from
  // the add sheet landed you in a sheet headed "Calorie chat" with a text box,
  // and a file picker appeared over it. The camera was the feature; the tile
  // just pressed it for you.
  //
  // Now they are genuinely separate. Chat is text. Photo is a photo screen with
  // one large capture target and no text row. Both render their results into the
  // same #ai-results, so every result card, portion stepper and macro editor is
  // shared — the split is in the input, not in the machinery.
  function chatPanelHtml(mode) {
    if (mode === 'photo') {
      return `
      <div class="ai-results" id="ai-results"></div>
      <div class="ai-capture-row">
        <button type="button" class="ai-capture" id="ai-capture-cam">
          <span class="ai-capture-icon">${ic('camera', 28)}</span>
          <span class="ai-capture-title">${tr('ai_capture')}</span>
          <span class="ai-capture-sub">${tr('ai_capture_sub')}</span>
        </button>
        <button type="button" class="ai-capture" id="ai-capture-gal">
          <span class="ai-capture-icon">${ic('gallery', 28)}</span>
          <span class="ai-capture-title">${tr('ai_gallery')}</span>
          <span class="ai-capture-sub">${tr('ai_gallery_sub')}</span>
        </button>
      </div>
      <!-- TWO inputs because ONE cannot serve both destinations: on Android,
           capture="environment" jumps STRAIGHT to the camera and the gallery
           is never offered — which is exactly what the owner reported. The
           capture-less twin opens the system picker instead. -->
      <input type="file" id="ai-file-cam" accept="image/*" capture="environment" hidden>
      <input type="file" id="ai-file-gal" accept="image/*" hidden>`;
    }
    return `
      <div class="ai-results" id="ai-results"></div>
      <div class="ai-input-row">
        <input type="text" id="ai-input" placeholder="${tr('ai_chat_placeholder')}" autocomplete="off">
        <button class="btn btn-primary" id="ai-send">${ic('arrowUp', 18)}</button>
      </div>`;
  }

  function open(dateForLog, opts) {
    if (typeof openModal !== 'function') return;
    const mode = (opts && opts.mode === 'photo') ? 'photo' : 'chat';
    // null = "today", resolved by dateNow() at the moment a row is WRITTEN. A
    // date frozen here was the day the sheet opened: a meal answered at 00:01
    // for a question asked at 23:56 landed on yesterday.
    logDate = dateForLog || null;
    const results = {}; // cardId -> item
    const queryText = {}; // groupId -> the message that produced it (cache key)
    const groupSource = {}; // groupId -> 'local' when the figures were the user's own
    const editedGroups = new Set(); // groups corrected in THIS panel (not a persisted flag)
    const foldedGroups = new Set(); // groups whose bases absorbed a portion multiplier
    const groupOf = (cid) => String(cid).slice(0, String(cid).lastIndexOf('-'));
    // LOCAL calendar date, never toISOString(): that is the UTC bug this
    // project has hit three times.
    const dateNow = () => {
      if (logDate) return logDate;
      if (typeof todayISO === 'function') return todayISO();
      const d = new Date(), z = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    };
    const groups = {};  // messageId -> items[]
    // Row ids carry a per-open stamp: a reply that arrives for a panel the user
    // has closed used to find the SAME id in the re-opened panel and overwrite
    // the new question's row with the old answer.
    const stamp = Date.now().toString(36);
    let n = 0;

    openModal(`
      <div class="modal-header">
        <div>
          <div class="modal-title">${mode === 'photo' ? tr('ai_photo_title') : tr('ai_chat_title')}</div>
          <div class="modal-subtitle">${mode === 'photo' ? tr('ai_photo_sub') : tr('ai_chat_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close>${ic('close', 18)}</button>
      </div>
      <div id="ai-body" class="ai-mode-${mode}">${chatPanelHtml(mode)}</div>
    `);

    wire();

    function wire() {
      // Render the cards (or a decline) for one query — shared by text + photo.
      const showResult = (id, qHtml, items, box, meta) => {
        const p = document.getElementById(id + '-p');
        if (!items.length) {
          if (p) p.innerHTML = qHtml + `<span class="ai-decline">${tr('ai_not_food')}</span>`;
        } else {
          groups[id] = items;
          groupSource[id] = meta && meta.parsed;
          const cards = items.map((it, i) => {
            const cid = id + '-' + i; results[cid] = it; return resultCardHtml(it, cid);
          }).join('');
          const addAll = items.length > 1
            ? `<button class="btn btn-ghost btn-block ai-add-all" data-addall="${id}">${ic('plus', 15)} ${tr('ai_add_all')} (${fmtNum(items.length)})</button>`
            : '';
          // Two notes, and only when they are true. The first says the figures
          // are the user's OWN — nothing was estimated, so the numbers on the
          // card are the numbers they typed. The second names anything the app
          // cannot store, because quietly dropping a value someone deliberately
          // entered is the kind of small lie that costs trust.
          let note = '';
          if (meta && meta.parsed === 'local') {
            note += `<div class="ai-note">${ic('check', 14)} ${tr('ai_used_your_numbers')}</div>`;
            if (meta.untracked && meta.untracked.length) {
              const names = meta.untracked.map((k) => tr('ai_nut_' + k));
              note += `<div class="ai-note ai-note-warn">${ic('info', 14)} ${esc(
                tr('ai_untracked').replace('{fields}', joinNames ? joinNames(names) : names.join(', ')))}</div>`;
            }
          }
          if (p) p.outerHTML = `<div class="ai-pending">${qHtml}</div>` + note + cards + addAll;
          bindAdds();
        }
        box.scrollTop = box.scrollHeight;
      };

      // Chat panel
      const send = document.getElementById('ai-send');
      const input = document.getElementById('ai-input');
      if (send && input) {
        const run = async () => {
          const text = input.value.trim();
          if (!text) return;
          const id = 'r' + stamp + '_' + (++n);
          queryText[id] = text;
          const box = document.getElementById('ai-results');
          input.value = '';
          const qHtml = `<span class="ai-q">${esc(text)}</span>`;
          box.insertAdjacentHTML('beforeend', `<div class="ai-pending" id="${id}-p">${qHtml}<span class="ai-dots">${tr('ai_analyzing')}</span></div>`);
          box.scrollTop = box.scrollHeight;
          try {
            const res = await window.FoodAI.analyze(text);
            showResult(id, qHtml, res.items, box, res);
          } catch (e) {
            const p = document.getElementById(id + '-p');
            if (p) p.innerHTML = qHtml + `<span class="ai-err">${esc(friendlyErr(e))}</span>`;
          }
        };
        send.addEventListener('click', run);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        input.focus();
      }

      // EVERYTHING BELOW IS MODE-INDEPENDENT and must not sit inside the
      // if(send && input) guard above: photo mode has no text row, and when it
      // did sit there the capture tile, the portion stepper AND the macro editor
      // were all silently dead in photo mode — the guard was written when chat
      // was the only face this panel had.
      {
        // Portion stepper (delegated once) — +/- adjusts the card's multiplier
        // in 0.25 steps and live-recomputes its macros before the user commits.
        const resultsBox = document.getElementById('ai-results');
        if (resultsBox && !resultsBox.dataset.portionBound) {
          resultsBox.dataset.portionBound = '1';
          resultsBox.addEventListener('click', (e) => {
            const btn = e.target.closest('.ai-portion-btn');
            if (!btn) return;
            const card = btn.closest('.ai-card');
            if (!card) return;
            const step = parseInt(btn.dataset.step, 10) || 0;
            let mult = (parseFloat(card.dataset.mult) || 1) + step * 0.25;
            mult = Math.max(0.25, Math.min(20, Math.round(mult * 100) / 100));
            card.dataset.mult = mult;
            applyPortion(card);
          });

          // ----- CORRECT THE ESTIMATE ---------------------------------------
          // The portion stepper can only scale all four macros together. It
          // cannot say "the calories are right but it was 55 g of protein, not
          // 30" — and that is the correction people actually need to make.
          //
          // logItem() reads results[cid], NOT the card, so a change that only
          // touched the DOM would show the corrected number and log the AI's.
          // Every write below goes to BOTH, and results[cid] is the same object
          // reference stored at showResult(), so "Add all" picks it up too.
          const MACRO_FIELD = { cal: 'calories', pro: 'protein', carb: 'carbs', fat: 'fat' };
          const baseOf = (c, k) => Number(c.dataset['b' + k]) || 0;

          // Opening the editor FOLDS the multiplier into the bases once, so the
          // four boxes show exactly what will be logged. Folding per keystroke
          // instead would rescale the three fields the user had not touched.
          const openEdit = (card) => {
            const mult = parseFloat(card.dataset.mult) || 1;
            if (mult !== 1) {
              ['cal', 'pro', 'carb', 'fat'].forEach((k) => {
                const v = k === 'cal'
                  ? Math.round(baseOf(card, k) * mult)
                  : Math.round(baseOf(card, k) * mult * 10) / 10;
                card.dataset['b' + k] = v;
                const it = results[card.dataset.result];
                if (it) it[MACRO_FIELD[k]] = v;
              });
              card.dataset.mult = 1;
              foldedGroups.add(groupOf(card.dataset.result));   // bases are no longer the 1× answer
            }
            card.querySelectorAll('.ai-edit input[data-e]').forEach((inp) => {
              inp.value = String(baseOf(card, inp.dataset.e));
            });
            card.classList.add('is-editing');
            applyPortion(card);
            const first = card.querySelector('.ai-edit input[data-e]');
            if (first) setTimeout(() => { first.focus(); first.select(); }, 40);
          };

          resultsBox.addEventListener('click', (e) => {
            const card = e.target.closest('.ai-card');
            if (!card) return;
            if (e.target.closest('[data-edit-card]')) {
              if (card.classList.contains('is-editing')) card.classList.remove('is-editing');
              else openEdit(card);
              return;
            }
            if (e.target.closest('[data-edit-done]')) card.classList.remove('is-editing');
          });

          resultsBox.addEventListener('input', (e) => {
            const inp = e.target.closest('.ai-edit input[data-e]');
            if (!inp) return;
            const card = inp.closest('.ai-card');
            if (!card) return;
            const k = inp.dataset.e;
            // An empty box means "still typing", not "zero" — leave the stored
            // value alone until there is a number, or the row would flash 0
            // between clearing the field and typing the replacement.
            if (inp.value.trim() === '') return;
            let v = parseFloat(inp.value);
            if (!isFinite(v) || v < 0) return;
            v = k === 'cal' ? Math.round(v) : Math.round(v * 10) / 10;
            card.dataset['b' + k] = v;
            const it = results[card.dataset.result];
            if (it) { it[MACRO_FIELD[k]] = v; it.edited = true; editedGroups.add(groupOf(card.dataset.result)); }
            card.classList.add('is-edited');
            applyPortion(card);
          });
        }

        // Photo → calories. Camera and gallery are separate tiles feeding
        // separate inputs (see the markup note), but everything downstream of
        // the chosen file is one shared handler. Chat mode renders neither
        // tile, so bindPicker simply finds nothing there.
        const bindPicker = (btnId, inputId) => {
          const pickBtn = document.getElementById(btnId);
          const fileInput = document.getElementById(inputId);
          if (!pickBtn || !fileInput) return;
          pickBtn.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            const id = 'r' + stamp + '_' + (++n);
            const box = document.getElementById('ai-results');
            let qHtml = `<span class="ai-q">${tr('ai_photo')}</span>`;
            let image = null;
            try {
              const pic = await processImage(file);
              qHtml = `<img class="ai-photo-thumb" src="${pic.dataUrl}" alt="">`;
              image = pic.image;
            } catch (_) {}
            // OFFER TO EXPLAIN THE PHOTO before spending the call. A picture
            // cannot show what is inside a dish, how it was cooked, or the oil
            // in it, and that is exactly where a photo estimate goes wrong. So
            // the shot lands with a note box and an analyse button; the note is
            // optional and Enter or the button sends either way.
            box.insertAdjacentHTML('beforeend',
              `<div class="ai-pending ai-photo-ask" id="${id}-p">${qHtml}
                 <div class="ai-note-wrap">
                   <input type="text" class="ai-note-input" id="${id}-note" placeholder="${esc(tr('ai_photo_note_ph'))}" maxlength="400">
                   <button class="ai-note-go" id="${id}-go">${esc(tr('ai_photo_analyze'))}</button>
                 </div>
                 <div class="ai-note-hint">${esc(tr('ai_photo_note_hint'))}</div>
               </div>`);
            box.scrollTop = box.scrollHeight;
            const noteEl = document.getElementById(id + '-note');
            const goEl = document.getElementById(id + '-go');
            if (noteEl) noteEl.focus();
            let sent = false;
            const go = async () => {
              if (sent) return;                    // double-tap must not spend two calls
              sent = true;
              const note = (noteEl && noteEl.value || '').trim();
              const shown = note ? `${qHtml}<span class="ai-q">${esc(note)}</span>` : qHtml;
              const p0 = document.getElementById(id + '-p');
              if (p0) { p0.classList.remove('ai-photo-ask'); p0.innerHTML = `${shown}<span class="ai-dots">${tr('ai_analyzing')}</span>`; }
              try {
                if (!image) throw new Error(tr('ai_error'));
                const { items } = await window.FoodAI.analyzeImage(image, note);
                showResult(id, shown, items, box);
              } catch (e) {
                const p = document.getElementById(id + '-p');
                if (p) p.innerHTML = shown + `<span class="ai-err">${esc(friendlyErr(e))}</span>`;
              }
            };
            if (goEl) goEl.addEventListener('click', go);
            if (noteEl) noteEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
          });
        };
        bindPicker('ai-capture-cam', 'ai-file-cam');
        bindPicker('ai-capture-gal', 'ai-file-gal');
      }
      bindAdds();
    }

    // The cache promises "the same text returns the same macros". Once the
    // user has corrected an estimate and logged it, the corrected figures ARE
    // the right answer for that text — so they become the cached one. Without
    // this the pencil had to be used again every single day for a repeat meal.
    // Only for model answers (a local parse is the user's own numbers already)
    // and only for text queries (photos have no key).
    function writeBackCache(cid) {
      try {
        const gid = String(cid).slice(0, String(cid).lastIndexOf('-'));
        const text = queryText[gid];
        const items = groups[gid];
        if (!text || !items || !items.length || groupSource[gid] === 'local') return;
        // Only a correction made in THIS panel counts (`edited` also rides in
        // from a cached answer written earlier), and never after a portion was
        // folded into the bases — that would cache a 2× plate as the 1× answer.
        if (!editedGroups.has(gid) || foldedGroups.has(gid)) return;
        cacheSet(text, items.map((x) => { const c = Object.assign({}, x); delete c.edited; return c; }));
      } catch (_) {}
    }
    function logItem(it, mult) {
      if (!it || typeof DB === 'undefined') return;
      // Store the AI's estimate as the per-serving base and the chosen portion
      // as `servings`, so totals (macros × servings) count the adjusted amount
      // and the food-log row shows the "× N" the user picked.
      DB.foodLogs.add(dateNow(), {
        name: it.name, servings: mult || 1,
        calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
        source: 'ai',
      });
    }
    function refreshFoodLog() {
      // Refresh whichever nutrition screen is behind the chat so the user sees
      // what they added the moment they close it. The Food dashboard is the
      // primary screen now; the per-day foodlog is the secondary history view.
      if (typeof viewContext !== 'undefined') viewContext.foodLog = { date: dateNow() };
      if (typeof currentView !== 'undefined' && (currentView === 'foodlog' || currentView === 'food') && typeof renderView === 'function') {
        renderView(currentView);
      } else if (typeof navigate === 'function') {
        navigate('food');
      }
    }
    function markAdded(b) {
      b.disabled = true;
      b.innerHTML = ic('check', 15) + ' ' + tr('ai_added');
      // The row is in the log now. Leaving the pencil live would invite an edit
      // that changes the card and not the entry just created — a logged row is
      // corrected in the food log, not here.
      const card = b.closest('.ai-card');
      if (card) { card.classList.remove('is-editing'); card.classList.add('is-added'); }
    }

    function bindAdds() {
      // Add one item
      document.querySelectorAll('#ai-results [data-add]').forEach((b) => {
        if (b.dataset.bound) return;
        b.dataset.bound = '1';
        b.addEventListener('click', () => {
          logItem(results[b.dataset.add], cardMult(b.closest('.ai-card')));
          writeBackCache(b.dataset.add);
          showToast(tr('ai_added'));
          markAdded(b);
          refreshFoodLog();
        });
      });
      // Add every item from one message — each at its own card's chosen portion.
      document.querySelectorAll('#ai-results [data-addall]').forEach((b) => {
        if (b.dataset.bound) return;
        b.dataset.bound = '1';
        b.addEventListener('click', () => {
          (document.querySelectorAll(`#ai-results [data-add^="${b.dataset.addall}-"]`) || []).forEach((addBtn) => {
            // Skip anything the user already added individually. markAdded()
            // disables the per-item button, so `disabled` is the added marker —
            // without this check, "Add all" logged those items a SECOND time and
            // silently double-counted the day's calories.
            if (addBtn.disabled) return;
            logItem(results[addBtn.dataset.add], cardMult(addBtn.closest('.ai-card')));
            markAdded(addBtn);
          });
          writeBackCache(b.dataset.addall + '-0');
          showToast(tr('ai_added'));
          markAdded(b);
          refreshFoodLog();
        });
      });
    }
  }

  // ---- free-form ask (AI coach) -------------------------------------------
  // Plain text in → plain text out. Used by the nutrition coach to suggest
  // meals that fit the day's remaining macros. Bypasses the JSON food parser.
  async function ask(prompt) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ text: String(prompt || ''), mode: 'chat' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) throw new Error(tr('ai_rate_limit'));
      throw new Error((data && data.error) || ('HTTP ' + res.status));
    }
    // Worker may answer as {reply} (chat mode) or fall back to the items shape.
    if (data && typeof data.reply === 'string') return data.reply.trim();
    if (data && Array.isArray(data.items)) {
      return data.items.map((i) => `• ${i.name} — ${i.calories} ${tr('cal')}`).join('\n');
    }
    throw new Error(tr('ai_no_result'));
  }

  // Open the chat straight on the photo picker (used by the add-sheet "photo").
  // A real mode now, not "open the chat and press its camera for the user".
  // The old synthetic click also raced the render: a slow frame and the button
  // was not there yet, so the tile silently did nothing but open a chat box.
  function openPhoto(dateForLog) {
    open(dateForLog, { mode: 'photo' });
  }

  // ---- voice → food --------------------------------------------------------
  // `audio` = { mimeType, data(base64) }. Gemini transcribes AND extracts the
  // foods in one call. The proxy forwards the audio; the direct-key path sends
  // it inline. Returns { items, transcript }.
  const VOICE_PROMPT = [
    'The user SPOKE this audio to log what they ate. Transcribe it, then list every food/drink mentioned.',
    'Output JSON only: {"transcript":"<what was said>","items":[{"name","calories","protein","carbs","fat"}]}.',
    'For each item, first ESTIMATE its portion weight in grams (use the amount said if any; otherwise infer a realistic portion), then base calories+macros on that weight — never 0 for a real food.',
    'name in the user\'s language INCLUDING the estimated portion, e.g. "دجاج مشوي ~150غ"; calories kcal; protein/carbs/fat grams for that portion.',
    'If no food was said, items = [].',
  ].join(' ');

  async function analyzeAudio(audio) {
    if (!audio || !audio.data) throw new Error(tr('ai_error'));
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ audio: audio, prompt: VOICE_PROMPT }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) throw new Error(tr('ai_rate_limit'));
      throw new Error((data && data.error) || ('HTTP ' + res.status));
    }
    return { items: toItems(data).items, transcript: (data && data.transcript) || '' };
  }

  // parseText is parseMacroText exposed deliberately: the manual entry form
  // fills its boxes with it, and it must be the SAME rules the chat uses or the
  // two drift into disagreeing about the same sentence. Pure local matching —
  // it sends nothing anywhere.
  window.FoodAI = { open, openPhoto, analyze, analyzeImage, analyzeAudio, ask, friendlyErr,
                    parseText: parseMacroText };
})();
