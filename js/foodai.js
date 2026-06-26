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

  // Free-tier model. If Google retires it, change this one line.
  const MODEL = 'gemini-2.5-flash';
  const endpoint = (key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const tr = (k) => (typeof t === 'function' ? t(k) : k);
  const ic = (n, s) => (typeof icon === 'function' ? icon(n, s || 20) : '');
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

  const KEY_STORE = 'gemini_api_key';
  const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch (_) { return ''; } };
  const setKey = (v) => { try { localStorage.setItem(KEY_STORE, (v || '').trim()); } catch (_) {} };
  const hasKey = () => !!getKey();

  // Prompt-driven JSON (no strict schema — gemini-2.5-flash mis-handles the
  // nested array schema). Mirrors backend/gemini-worker.js.
  const SYSTEM = [
    'You read a food-log message for a fitness app and reply with JSON only (no markdown).',
    'The user talks naturally and may mention several foods across meals.',
    'Return: {"items":[{"name":string,"calories":number,"protein":number,"carbs":number,"fat":number}, ...]}',
    'Add one item per distinct food/drink, name = a short label in the user language, macros for the',
    'portion (one typical serving if unspecified; calories kcal, protein/carbs/fat grams).',
    'If no food, return {"items":[]}.',
    'Input: "فطور بيض وخبز وغدا برجر" -> {"items":[{"name":"بيض وخبز","calories":280,"protein":16,"carbs":24,"fat":13},{"name":"برجر","calories":400,"protein":20,"carbs":40,"fat":18}]}',
    'Input: "كيف الطقس" -> {"items":[]}',
  ].join(' ');

  const useProxy = () => !!PROXY_URL;
  // Ready to chat = either a backend proxy is configured, or the user saved a key.
  const ready = () => useProxy() || hasKey();

  // Call the backend proxy (no key in the app) and return the macros.
  async function analyzeViaProxy(text) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return toItems(data);
  }

  // Clean one food item.
  function normalizeItem(d) {
    const calories = Math.max(0, Math.round(Number(d && d.calories) || 0));
    const protein = Math.max(0, Math.round(Number(d && d.protein) || 0));
    const carbs = Math.max(0, Math.round(Number(d && d.carbs) || 0));
    const fat = Math.max(0, Math.round(Number(d && d.fat) || 0));
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

  // Call Gemini and return { name, calories, protein, carbs, fat }.
  async function analyze(text) {
    if (useProxy()) return analyzeViaProxy(text);
    const key = getKey();
    if (!key) throw new Error(tr('ai_need_key'));
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: String(text) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
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

  // ---------------------------------------------------------------- UI
  let logDate = null; // which day "add to log" writes to

  function resultCardHtml(r, id) {
    return `
      <div class="ai-card" data-result="${id}">
        <div class="ai-card-name">${esc(r.name)}</div>
        <div class="ai-macros">
          <span class="ai-macro cal"><b class="num">${fmtNum(r.calories)}</b>${tr('cal')}</span>
          <span class="ai-macro pro"><b class="num">${fmtNum(r.protein)}</b>g ${tr('protein_label')}</span>
          <span class="ai-macro carb"><b class="num">${fmtNum(r.carbs)}</b>g ${tr('carbs_label')}</span>
          <span class="ai-macro fat"><b class="num">${fmtNum(r.fat)}</b>g ${tr('fat_label')}</span>
        </div>
        <button class="btn btn-primary btn-block ai-add" data-add="${id}">${ic('plus', 15)} ${tr('ai_add_to_log')}</button>
      </div>`;
  }

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
          box.insertAdjacentHTML('beforeend', `<div class="ai-pending" id="${id}-p"><span class="ai-q">${esc(text)}</span><span class="ai-dots">${tr('ai_analyzing')}</span></div>`);
          box.scrollTop = box.scrollHeight;
          try {
            const { items } = await window.FoodAI.analyze(text);
            const p = document.getElementById(id + '-p');
            if (!items.length) {
              // No food found — politely decline instead of showing fake numbers.
              if (p) p.innerHTML = `<span class="ai-q">${esc(text)}</span><span class="ai-decline">${tr('ai_not_food')}</span>`;
            } else {
              groups[id] = items;
              const cards = items.map((it, i) => {
                const cid = id + '-' + i;
                results[cid] = it;
                return resultCardHtml(it, cid);
              }).join('');
              const addAll = items.length > 1
                ? `<button class="btn btn-ghost btn-block ai-add-all" data-addall="${id}">${ic('plus', 15)} ${tr('ai_add_all')} (${fmtNum(items.length)})</button>`
                : '';
              if (p) p.outerHTML = `<div class="ai-pending"><span class="ai-q">${esc(text)}</span></div>` + cards + addAll;
              bindAdds();
            }
            box.scrollTop = box.scrollHeight;
          } catch (e) {
            const p = document.getElementById(id + '-p');
            if (p) p.innerHTML = `<span class="ai-q">${esc(text)}</span><span class="ai-err">${esc((e && e.message) || tr('ai_error'))}</span>`;
          }
        };
        send.addEventListener('click', run);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        input.focus();
      }
      bindAdds();
    }

    function logItem(it) {
      if (!it || typeof DB === 'undefined') return;
      DB.foodLogs.add(logDate, {
        name: it.name, servings: 1,
        calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
        source: 'ai',
      });
    }
    function refreshFoodLog() {
      if (typeof currentView !== 'undefined' && currentView === 'foodlog' && typeof renderView === 'function') {
        renderView('foodlog');
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
          logItem(results[b.dataset.add]);
          showToast(tr('ai_added'));
          markAdded(b);
          refreshFoodLog();
        });
      });
      // Add every item from one message
      document.querySelectorAll('#ai-results [data-addall]').forEach((b) => {
        if (b.dataset.bound) return;
        b.dataset.bound = '1';
        b.addEventListener('click', () => {
          const items = groups[b.dataset.addall] || [];
          items.forEach(logItem);
          showToast(tr('ai_added'));
          markAdded(b);
          // disable the per-item buttons in this group too
          (document.querySelectorAll(`#ai-results [data-add^="${b.dataset.addall}-"]`) || []).forEach(markAdded);
          refreshFoodLog();
        });
      });
    }
  }

  window.FoodAI = { open, analyze, getKey, setKey, hasKey };
})();
