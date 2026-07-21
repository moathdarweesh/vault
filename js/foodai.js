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
  // full flash model — the lite variant is too weak and echoes the examples.
  const MODEL = 'gemini-2.5-flash';
  const endpoint = (key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const tr = (k) => (typeof t === 'function' ? t(k) : k);
  const ic = (n, s) => (typeof icon === 'function' ? icon(n, s || 20) : '');
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

  // A dropped connection surfaces as TypeError('Failed to fetch'/'Load failed').
  // Show the localized network message instead of the raw browser string; keep
  // already-localized errors (rate limit, etc.) as-is.
  function friendlyErr(e) {
    const m = (e && e.message) || '';
    if ((e && e.name === 'TypeError') || /failed to fetch|load failed|networkerror|network request/i.test(m)) {
      return tr('auth_err_network');
    }
    return m || tr('ai_error');
  }

  const KEY_STORE = 'gemini_api_key';
  const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch (_) { return ''; } };
  const setKey = (v) => { try { localStorage.setItem(KEY_STORE, (v || '').trim()); } catch (_) {} };
  const hasKey = () => !!getKey();

  // ---- result cache --------------------------------------------------------
  // The model RE-ESTIMATES on every call, so the same meal can come back with
  // slightly different numbers. We cache by normalized text so an identical
  // message always returns the SAME macros (and skips a network call).
  const CACHE_STORE = 'foodai_cache';
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
  // nested array schema). Mirrors backend/gemini-worker.js.
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

  const useProxy = () => !!PROXY_URL;
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
  const ready = () => useProxy() || hasKey();

  // Call the backend proxy (no key in the app) and return the macros. `image`
  // is an optional { mimeType, data(base64) } for photo-based analysis.
  async function analyzeViaProxy(text, image) {
    const payload = { text: String(text || '') };
    if (image) payload.image = image;
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
  function normalizeItem(d) {
    // Clamp to a sane range (calories ≤ 10000, macros ≤ 2000) so a bad/injected
    // value can't corrupt the user's totals.
    const clamp = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
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
    return { items: raw.map(normalizeItem).filter(isRealFood) };
  }

  // Public entry — checks the cache first so the SAME text always returns the
  // SAME macros, then falls back to the model and caches the result.
  async function analyze(text) {
    const cached = cacheGet(text);
    if (cached) return { items: cached };
    const result = await analyzeUncached(text);
    if (result && result.items && result.items.length) cacheSet(text, result.items);
    return result;
  }

  // Call Gemini and return { name, calories, protein, carbs, fat }.
  async function analyzeUncached(text) {
    if (useProxy()) return analyzeViaProxy(text);
    const key = getKey();
    if (!key) throw new Error(tr('ai_need_key'));
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: String(text) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    };
    const res = await fetch(endpoint(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const e = await res.json(); msg = (e.error && e.error.message) || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    const partText = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!partText) throw new Error(tr('ai_no_result'));
    const cleaned = String(partText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return toItems(JSON.parse(cleaned));
  }

  // Instruction sent WITH a photo. Tells the model to estimate the actual
  // PORTION from visual cues (so we don't need a worker redeploy — the worker
  // just forwards this text + the image to Gemini).
  function imagePrompt() {
    let lang = 'en';
    try { lang = (DB && DB.prefs && DB.prefs.get().lang) || 'en'; } catch (_) {}
    return [
      'Look at this food photo. Identify every distinct food and drink.',
      'ESTIMATE THE AMOUNT actually shown using visual cues — plate/bowl size, utensils, hands, the container, the number of pieces, and the visible volume/thickness.',
      'Calculate calories and macros for THAT estimated amount — not a generic single serving.',
      'Put the estimated amount inside each item\'s name (e.g. "2 slices pizza", "grilled chicken ~200g", "rice ~1.5 cup").',
      lang === 'ar' ? 'Write the names in Arabic.' : 'Write the names in English.',
    ].join(' ');
  }

  // Analyze a food PHOTO. `image` = { mimeType, data(base64) }. Not cached
  // (every photo is unique).
  async function analyzeImage(image) {
    if (useProxy()) return analyzeViaProxy(imagePrompt(), image);
    const key = getKey();
    if (!key) throw new Error(tr('ai_need_key'));
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [
        { text: imagePrompt() },
        { inline_data: { mime_type: image.mimeType, data: image.data } },
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    };
    const res = await fetch(endpoint(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const e = await res.json(); msg = (e.error && e.error.message) || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    const partText = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!partText) throw new Error(tr('ai_no_result'));
    const cleaned = String(partText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return toItems(JSON.parse(cleaned));
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
        </div>
        <div class="ai-macros">
          <span class="ai-macro cal"><b class="num" data-m="cal">${fmtNum(r.calories)}</b>${tr('cal')}</span>
          <span class="ai-macro pro"><b class="num" data-m="pro">${fmtNum(r.protein)}</b>g ${tr('protein_label')}</span>
          <span class="ai-macro carb"><b class="num" data-m="carb">${fmtNum(r.carbs)}</b>g ${tr('carbs_label')}</span>
          <span class="ai-macro fat"><b class="num" data-m="fat">${fmtNum(r.fat)}</b>g ${tr('fat_label')}</span>
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

  function keyPanelHtml() {
    return `
      <div class="ai-keypanel">
        <div class="ai-msg">${tr('ai_need_key')}</div>
        <ol class="ai-steps">
          <li>${tr('ai_key_step1')} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></li>
          <li>${tr('ai_key_step2')}</li>
        </ol>
        <input type="password" id="ai-key-input" placeholder="${tr('ai_key_label')}" value="${esc(getKey())}">
        <button class="btn btn-primary btn-block" id="ai-key-save">${tr('ai_save_key')}</button>
      </div>`;
  }

  function chatPanelHtml() {
    return `
      <div class="ai-results" id="ai-results"></div>
      <div class="ai-input-row">
        <button class="ai-photo-btn" id="ai-photo" aria-label="${tr('ai_photo')}">${ic('camera', 20)}</button>
        <input type="file" id="ai-file" accept="image/*" capture="environment" hidden>
        <input type="text" id="ai-input" placeholder="${tr('ai_chat_placeholder')}" autocomplete="off">
        <button class="btn btn-primary" id="ai-send">${ic('arrowUp', 18)}</button>
      </div>`;
  }

  function open(dateForLog) {
    if (typeof openModal !== 'function') return;
    logDate = dateForLog || (typeof todayISO === 'function' ? todayISO() : null);
    const results = {}; // cardId -> item
    const groups = {};  // messageId -> items[]
    let n = 0;

    openModal(`
      <div class="modal-header">
        <div>
          <div class="modal-title">${tr('ai_chat_title')}</div>
          <div class="modal-subtitle">${tr('ai_chat_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close>${ic('close', 18)}</button>
      </div>
      <div id="ai-body">${ready() ? chatPanelHtml() : keyPanelHtml()}</div>
    `);

    wire();

    function wire() {
      // Key panel
      const saveBtn = document.getElementById('ai-key-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const v = document.getElementById('ai-key-input').value;
          if (!v.trim()) { showToast(tr('ai_need_key')); return; }
          setKey(v);
          document.getElementById('ai-body').innerHTML = chatPanelHtml();
          wire();
        });
      }
      // Render the cards (or a decline) for one query — shared by text + photo.
      const showResult = (id, qHtml, items, box) => {
        const p = document.getElementById(id + '-p');
        if (!items.length) {
          if (p) p.innerHTML = qHtml + `<span class="ai-decline">${tr('ai_not_food')}</span>`;
        } else {
          groups[id] = items;
          const cards = items.map((it, i) => {
            const cid = id + '-' + i; results[cid] = it; return resultCardHtml(it, cid);
          }).join('');
          const addAll = items.length > 1
            ? `<button class="btn btn-ghost btn-block ai-add-all" data-addall="${id}">${ic('plus', 15)} ${tr('ai_add_all')} (${fmtNum(items.length)})</button>`
            : '';
          if (p) p.outerHTML = `<div class="ai-pending">${qHtml}</div>` + cards + addAll;
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
          const id = 'r' + (++n);
          const box = document.getElementById('ai-results');
          input.value = '';
          const qHtml = `<span class="ai-q">${esc(text)}</span>`;
          box.insertAdjacentHTML('beforeend', `<div class="ai-pending" id="${id}-p">${qHtml}<span class="ai-dots">${tr('ai_analyzing')}</span></div>`);
          box.scrollTop = box.scrollHeight;
          try {
            const { items } = await window.FoodAI.analyze(text);
            showResult(id, qHtml, items, box);
          } catch (e) {
            const p = document.getElementById(id + '-p');
            if (p) p.innerHTML = qHtml + `<span class="ai-err">${esc(friendlyErr(e))}</span>`;
          }
        };
        send.addEventListener('click', run);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        input.focus();

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
        }

        // Photo → calories
        const photoBtn = document.getElementById('ai-photo');
        const fileInput = document.getElementById('ai-file');
        if (photoBtn && fileInput) {
          photoBtn.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            const id = 'r' + (++n);
            const box = document.getElementById('ai-results');
            let qHtml = `<span class="ai-q">${tr('ai_photo')}</span>`;
            let image = null;
            try {
              const pic = await processImage(file);
              qHtml = `<img class="ai-photo-thumb" src="${pic.dataUrl}" alt="">`;
              image = pic.image;
            } catch (_) {}
            box.insertAdjacentHTML('beforeend', `<div class="ai-pending" id="${id}-p">${qHtml}<span class="ai-dots">${tr('ai_analyzing')}</span></div>`);
            box.scrollTop = box.scrollHeight;
            try {
              if (!image) throw new Error(tr('ai_error'));
              const { items } = await window.FoodAI.analyzeImage(image);
              showResult(id, qHtml, items, box);
            } catch (e) {
              const p = document.getElementById(id + '-p');
              if (p) p.innerHTML = qHtml + `<span class="ai-err">${esc(friendlyErr(e))}</span>`;
            }
          });
        }
      }
      bindAdds();
    }

    function logItem(it, mult) {
      if (!it || typeof DB === 'undefined') return;
      // Store the AI's estimate as the per-serving base and the chosen portion
      // as `servings`, so totals (macros × servings) count the adjusted amount
      // and the food-log row shows the "× N" the user picked.
      DB.foodLogs.add(logDate, {
        name: it.name, servings: mult || 1,
        calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
        source: 'ai',
      });
    }
    function refreshFoodLog() {
      // Refresh whichever nutrition screen is behind the chat so the user sees
      // what they added the moment they close it. The Food dashboard is the
      // primary screen now; the per-day foodlog is the secondary history view.
      if (typeof viewContext !== 'undefined') viewContext.foodLog = { date: logDate };
      if (typeof currentView !== 'undefined' && (currentView === 'foodlog' || currentView === 'food') && typeof renderView === 'function') {
        renderView(currentView);
      } else if (typeof navigate === 'function') {
        navigate('food');
      }
    }
    function markAdded(b) {
      b.disabled = true;
      b.innerHTML = ic('check', 15) + ' ' + tr('ai_added');
    }

    function bindAdds() {
      // Add one item
      document.querySelectorAll('#ai-results [data-add]').forEach((b) => {
        if (b.dataset.bound) return;
        b.dataset.bound = '1';
        b.addEventListener('click', () => {
          logItem(results[b.dataset.add], cardMult(b.closest('.ai-card')));
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
            logItem(results[addBtn.dataset.add], cardMult(addBtn.closest('.ai-card')));
            markAdded(addBtn);
          });
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
    if (useProxy()) {
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
    const key = getKey();
    if (!key) throw new Error(tr('ai_need_key'));
    const body = { contents: [{ parts: [{ text: String(prompt) }] }], generationConfig: { temperature: 0.4 } };
    const res = await fetch(endpoint(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const txt = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!txt) throw new Error(tr('ai_no_result'));
    return String(txt).trim();
  }

  // Open the chat straight on the photo picker (used by the add-sheet "photo").
  function openPhoto(dateForLog) {
    open(dateForLog);
    setTimeout(() => { const b = document.getElementById('ai-photo'); if (b) b.click(); }, 120);
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
    if (useProxy()) {
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
    const key = getKey();
    if (!key) throw new Error(tr('ai_need_key'));
    const body = {
      contents: [{ parts: [
        { text: VOICE_PROMPT },
        { inline_data: { mime_type: audio.mimeType, data: audio.data } },
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    };
    const res = await fetch(endpoint(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const partText = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!partText) throw new Error(tr('ai_no_result'));
    const cleaned = String(partText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return { items: toItems(parsed).items, transcript: parsed.transcript || '' };
  }

  window.FoodAI = { open, openPhoto, analyze, analyzeImage, analyzeAudio, ask, getKey, setKey, hasKey };
})();
