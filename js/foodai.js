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

  // Force the model to return exactly the fields we need.
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
    'You are a nutrition estimator for a fitness app.',
    'The user describes a meal in Arabic or English (e.g. "رز مع دجاج").',
    'Estimate the TOTAL nutrition for the portion described — calories in kcal,',
    'protein/carbs/fat in grams. If no portion is given, assume one typical serving.',
    'The "name" field: a short label of the meal in the SAME language as the input.',
    'Reply with the JSON object only.',
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
    return {
      name: String(data.name || text).slice(0, 80),
      calories: Math.max(0, Math.round(Number(data.calories) || 0)),
      protein: Math.max(0, Math.round(Number(data.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(data.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(data.fat) || 0)),
    };
  }

  // Call Gemini and return { name, calories, protein, carbs, fat }.
  async function analyze(text) {
    if (useProxy()) return analyzeViaProxy(text);
    const key = getKey();
    if (!key) throw new Error(tr('ai_need_key'));
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: String(text) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
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
    const obj = JSON.parse(partText);
    return {
      name: String(obj.name || text).slice(0, 80),
      calories: Math.max(0, Math.round(Number(obj.calories) || 0)),
      protein: Math.max(0, Math.round(Number(obj.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(obj.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(obj.fat) || 0)),
    };
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
    const results = {}; // id -> result
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
            const r = await window.FoodAI.analyze(text);
            results[id] = r;
            const p = document.getElementById(id + '-p');
            if (p) p.outerHTML = `<div class="ai-pending"><span class="ai-q">${esc(text)}</span></div>` + resultCardHtml(r, id);
            bindAdds();
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

    function bindAdds() {
      document.querySelectorAll('#ai-results [data-add]').forEach((b) => {
        if (b.dataset.bound) return;
        b.dataset.bound = '1';
        b.addEventListener('click', () => {
          const r = results[b.dataset.add];
          if (!r || typeof DB === 'undefined') return;
          DB.foodLogs.add(logDate, {
            name: r.name, servings: 1,
            calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat,
            source: 'ai',
          });
          showToast(tr('ai_added'));
          b.disabled = true;
          b.innerHTML = ic('check', 15) + ' ' + tr('ai_added');
          if (typeof currentView !== 'undefined' && currentView === 'foodlog' && typeof renderView === 'function') {
            renderView('foodlog');
          }
        });
      });
    }
  }

  window.FoodAI = { open, analyze, getKey, setKey, hasKey };
})();
