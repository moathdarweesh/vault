// ==========================================================================
// THE VAULT — THE FOOD DOMAIN
//
// Extracted from js/app.js, which had grown to 13,000 lines of "all views and
// the router". Food is the FIRST domain to leave, and the choice was measured
// rather than picked: of the four domains it is the only one with ZERO lateral
// edges in either direction. It is entered through exactly 8 call sites, every
// one of them shell or router (renderView ×2, the unified search ×4,
// bootCatalog, showOnboarding), and it reaches outward to 23 names that are all
// shared primitives, the router, or chrome. Workout, by contrast, has 28
// inbound edges and owes lateral debt in three directions.
//
// ⚠️ THIS FILE LOADS BEFORE js/app.js, AND THAT IS NOT ARBITRARY. bootCatalog()
// calls setServerFoodCatalog() inside a bare `catch (_) {}` — so with this file
// AFTER app.js, the continuation after `await Cloud.pullCatalog()` can run in
// the microtask checkpoint at the end of app.js's own execution, the
// ReferenceError is swallowed, and the server food catalog silently never
// merges. Forever, with nothing to see. Contract 1 pins the order.
//
// ⚠️ AND IT HAS NO TOP-LEVEL DEPENDENCY ON ANYTHING. The three bindings below
// (FOOD_CAT_ORDER, SERVER_FOOD_PRESETS, _zxingPromise) initialise to literals,
// and there is not one top-level statement in this file. Every name it borrows
// — t, escapeHtml, icon, $, showToast, openModal, closeModal, confirmDialog,
// DB, Cloud, FoodAI — is read at CALL time, long after every script has run.
// That is what makes loading before app.js safe in the other direction too.
// ==========================================================================

const FOOD_CAT_ORDER = ['protein', 'carbs', 'legumes', 'dairy', 'fruit', 'veg', 'fats', 'meals', 'drinks'];
function foodPresetName(p) { return (DB.prefs.get().lang || 'en') === 'ar' ? p.ar : p.en; }
function foodPresetServing(p) { return (DB.prefs.get().lang || 'en') === 'ar' ? p.sa : p.s; }

// Admin-curated global foods (server `food_catalog`, pulled at boot — see
// bootCatalog()). Reshaped into the same { cat, en, ar, s, sa, cal, pro, carb }
// preset shape as FOOD_PRESETS so the quick-add picker can render/search/tap
// them identically. There's no separate admin ar/en pair, so both fields hold
// the single stored name (same pattern as any other untranslated user content
// in the app, e.g. custom exercise/food names). Grouped under its own "More"
// category so it never disturbs the curated built-in categories above.
let SERVER_FOOD_PRESETS = [];
function setServerFoodCatalog(rows) {
  try {
    SERVER_FOOD_PRESETS = (Array.isArray(rows) ? rows : [])
      .filter((f) => f && f.name)
      .map((f) => ({
        cat: 'more',
        en: String(f.name), ar: String(f.name),
        s: f.serving || '', sa: f.serving || '',
        cal: Number(f.calories) || 0, pro: Number(f.protein) || 0, carb: Number(f.carbs) || 0, f: Number(f.fat) || 0,
      }));
  } catch (_) { SERVER_FOOD_PRESETS = []; }
}
function allFoodPresets() { return SERVER_FOOD_PRESETS.length ? FOOD_PRESETS.concat(SERVER_FOOD_PRESETS) : FOOD_PRESETS; }
function allFoodCatOrder() { return SERVER_FOOD_PRESETS.length ? FOOD_CAT_ORDER.concat(['more']) : FOOD_CAT_ORDER; }


// The Food tab is now a DAILY NUTRITION DASHBOARD: today's targets, what's been
// eaten, and — the thing the user asked to see front and centre — what's still
// LEFT for the day. One "+" button (bottom-right) opens an animated sheet with
// every way to log food (voice, chat, photo, saved, manual). The old food
// "reference library" lives on as the "saved food" add-method.
function renderFood(el) {
  const date = todayISO();

  el.innerHTML = `
    ${vaultBar()}
    <div class="page-header">
      <div class="row-between">
        <div>
          <h1 class="page-title">${t('food')}</h1>
          <p class="page-subtitle">${escapeHtml(formatDate(date))}</p>
        </div>
        <!-- Both entry points are text links, in the slot that already held one.
             They used to be a .cx-tools row of two 44px ghost slabs directly under
             here, which cost 62px ABOVE the user's calories and pushed the water
             steppers under the bottom nav — and .link-btn is the idiom this
             stylesheet already names for exactly this job, 20px away.
             «وجباتي» is gone entirely: the food FAB's add-sheet already opens that
             same picker, so it was a second front door to one room. -->
        <div class="header-links">
          <button class="link-btn" data-shopping>${t('cx_shopping')}</button>
          <button class="link-btn" data-goto="foodlog">${t('food_history')} <span class="icon-mirror">${icon('chevronRight', 16)}</span></button>
        </div>
      </div>
    </div>
    <div id="nutri-host">${nutritionDashboardHtml(date)}</div>
  `;

  el.querySelector('[data-shopping]').onclick = openShoppingList;
  updateFoodShoppingLink();

  // todayISO() HERE, not the render-time `date`: rows now land on the day they
  // are written, so the repaint must show that same day.
  const rerender = () => { const h = $('#nutri-host', el); if (h) h.innerHTML = nutritionDashboardHtml(todayISO()); };

  // A single add button: the floating FAB (the top-bar action was a duplicate).
  // The FAB is a child of .app (index.html), outside the fading .view: while
  // the view carries its entrance transform it is the containing block for
  // absolute descendants, and the button used to land against the content and
  // snap into place 200 ms later. onclick, not addEventListener: the node lives
  // for the whole session and this runs on every render of Food.
  const fab = document.getElementById('food-fab');
  if (fab) {
    fab.innerHTML = icon('plus', 28);
    fab.setAttribute('aria-label', t('add'));
    fab.onclick = () => openAddSheet(null, rerender);   // null = today, resolved at log time
  }

  // Arriving from Home's food card with "add" intent — open the sheet straight
  // away, so one tap gets the user to the thing they actually came to do.
  // It opens here rather than at the call site because the sheet needs THIS
  // view's `rerender` closure; opening it from Home would hand it a callback
  // that repaints nothing. The flag is cleared immediately so returning to Food
  // by any other route (the nav, back) does not re-open the sheet.
  if (viewContext.openAdd) {
    viewContext.openAdd = false;
    openAddSheet(null, rerender);   // null = today, resolved at log time
  }

  const host = $('#nutri-host', el);
  host?.addEventListener('click', (e) => {
    const setup = e.target.closest('[data-setup-goal]');
    if (setup) { openCalculatorModal(rerender); return; }
    const edit = e.target.closest('[data-edit-goal]');
    if (edit) { openCalculatorModal(rerender); return; }
    const water = e.target.closest('[data-add-water]');
    if (water) {
      // todayISO() at WRITE time, not the render-time `date` two hundred lines up:
      // a phone left on this screen across midnight logged the morning's water
      // against yesterday. The repaint below already did this (see its comment);
      // the write did not.
      DB.water.add(todayISO(), parseInt(water.getAttribute('data-add-water'), 10) || 0);
      rerender();
      return;
    }
    // The calorie ring answers "how much is left"; the natural next question is
    // "left after WHAT", so tapping it opens today's log. It is checked LAST so
    // the controls sitting inside the hero — the edit pencil above, the water
    // steppers — keep their own behaviour and never fall through to a navigate.
    // renderFoodLog reads viewContext.foodLog, NOT viewContext.date — passing a
    // bare `date` here would silently land on today whatever day was open.
    if (e.target.closest('.nutri-hero')) { navigate('foodlog', { foodLog: { date: todayISO() } }); return; }
  });

  // The calorie goal is MANDATORY: if none is set, open the calculator straight
  // away when the Food page is shown. The short delay lets the view settle and
  // avoids opening if the user immediately navigates elsewhere.
  if (!DB.nutrition.hasTargets()) {
    setTimeout(() => {
      if (currentView === 'food' && !DB.nutrition.hasTargets() && !$('#modal-root').innerHTML.trim()) {
        openCalculatorModal(rerender);
      }
    }, 250);
  }
}

// The rings + remaining + today's list. Re-rendered on its own after any change.
function nutritionDashboardHtml(date) {
  const nut = DB.nutrition;
  const consumed = DB.foodLogs.totalsForDate(date);

  // Not set up yet → invite the user to build a target.
  if (!nut.hasTargets()) {
    return `
      <button class="nutri-setup" data-setup-goal>
        <div class="nutri-setup-icon">${icon('target', 22)}</div>
        <div class="nutri-setup-main">
          <div class="nutri-setup-title">${t('nutri_setup_title')}</div>
        </div>
      </button>
    `;
  }

  const waterMl = DB.water.get(date);
  const waterGoal = DB.water.goal();
  const waterPct = waterGoal > 0 ? Math.min(100, (waterMl / waterGoal) * 100) : 0;
  const waterCard = `
    <div class="water-card">
      <div class="water-head">
        <div class="water-title">${icon('droplet', 16)} <span>${t('water')}</span></div>
        <div class="water-nums"><span class="num">${fmtNum(waterMl)}</span> / <span class="num">${fmtNum(waterGoal)}</span> ${t('unit_ml')}</div>
      </div>
      <div class="water-bar"><span class="water-fill" style="width:${waterPct}%"></span></div>
      <div class="water-actions">
        <button class="water-cup" data-add-water="250"><span class="num">+250</span></button>
        <button class="water-cup" data-add-water="500"><span class="num">+500</span></button>
        <button class="water-cup water-cup-minus" data-add-water="-250" aria-label="${escapeHtml(t('water_undo'))}">${icon('minus', 16)}</button>
      </div>
    </div>`;

  const tgt = nut.get().targets;
  const calLeft = Math.round(tgt.calories - consumed.calories);
  const calPct = tgt.calories > 0 ? Math.min(100, (consumed.calories / tgt.calories) * 100) : 0;
  const over = calLeft < 0;

  // Calorie ring (SVG). r=54 → circumference ≈ 339.29.
  const C = 339.29;
  const dash = C * (calPct / 100);

  const macroBar = (key, label, cls) => {
    const c = Math.round(consumed[key] * 10) / 10;
    const g = tgt[key] || 0;
    const left = Math.round((g - c) * 10) / 10;
    const pct = g > 0 ? Math.min(100, (c / g) * 100) : 0;
    return `
      <div class="macro-track">
        <div class="macro-track-head">
          <span class="macro-track-name ${cls}">${label}</span>
          <span class="macro-track-nums"><span class="num">${fmtNum(c)}</span> / <span class="num">${fmtNum(g)}</span>g</span>
        </div>
        <div class="macro-track-bar"><span class="macro-track-fill ${cls}" style="width:${pct}%"></span></div>
        <div class="macro-track-left">${left >= 0 ? `${t('nutri_left')} <span class="num">${fmtNum(left)}</span>g` : `<span class="over">${t('nutri_over')} <span class="num">${fmtNum(-left)}</span>g</span>`}</div>
      </div>`;
  };

  return `
    <div class="nutri-hero">
      <button class="nutri-edit" data-edit-goal aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
      <div class="cal-ring-wrap">
        <svg class="cal-ring" viewBox="0 0 120 120">
          <circle class="cal-ring-bg" cx="60" cy="60" r="54"/>
          <circle class="cal-ring-fg ${over ? 'over' : ''}" cx="60" cy="60" r="54"
            stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="cal-ring-center">
          <div class="cal-ring-num num ${over ? 'over' : ''}">${fmtNum(Math.abs(calLeft))}</div>
          <div class="cal-ring-label">${over ? t('nutri_over') : t('nutri_left')}</div>
          <div class="cal-ring-sub"><span class="num">${fmtNum(Math.round(consumed.calories))}</span> / <span class="num">${fmtNum(tgt.calories)}</span> ${t('cal')}</div>
        </div>
      </div>
      <div class="macro-tracks">
        ${macroBar('protein', t('protein_label'), 'pro')}
        ${macroBar('carbs', t('carbs_label'), 'carb')}
        ${macroBar('fat', t('fat_label'), 'fat')}
      </div>
    </div>

    ${waterCard}
  `;
}

// Shared: log AI/voice/photo items to today and refresh the dashboard.
// `date` null = today — resolved HERE, when the rows are written, not when the
// sheet that led here was opened. A date captured at render time put a meal
// answered at 00:01 on yesterday.
function logNutritionItems(date, items, onDone) {
  const d = date || todayISO();
  (items || []).forEach((it) => DB.foodLogs.add(d, {
    name: it.name, servings: it.servings || 1,
    calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
    source: it.source || 'ai',
  }));
  if (typeof onDone === 'function') onDone();
}

// Lazy-load the vendored ZXing decoder (~330KB) only when the scanner actually
// needs it — i.e. a browser without the native BarcodeDetector. Cached after the
// first load. Keeps the app's initial payload lean.
let _zxingPromise = null;
function loadBarcodeLib() {
  if (typeof window !== 'undefined' && window.ZXing) return Promise.resolve(window.ZXing);
  if (_zxingPromise) return _zxingPromise;
  _zxingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/zxing.min.js?v=' + VAULT_BUILD;
    s.async = true;
    s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('zxing missing')));
    s.onerror = () => { _zxingPromise = null; reject(new Error('zxing load failed')); };
    document.head.appendChild(s);
  });
  return _zxingPromise;
}

// ===========================================================================
// Barcode scanner — CAMERA scan + Open Food Facts (free, no key). Two decode
// engines: the native BarcodeDetector (fast, Android) when present, else the
// vendored ZXing decoder (any browser with a camera). Manual number entry is
// always shown as a fallback. Scan a packaged food → per-100g nutrition → pick
// grams → log.
// ===========================================================================
function openBarcodeScanner(date, onSave) {
  // Camera scanning works via the native BarcodeDetector (Android) OR the
  // vendored ZXing decoder (any browser) — so it's offered whenever a camera is
  // available. Manual number entry is always shown as a fallback. Both paths
  // feed the same Open Food Facts lookup.
  const hasDetector = (typeof window !== 'undefined') && ('BarcodeDetector' in window);
  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const canScan = hasCamera;

  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_barcode')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="barcode-stage" id="bc-stage"${canScan ? '' : ' style="display:none"'}>
      <video id="bc-video" playsinline muted></video>
      <div class="barcode-frame"></div>
    </div>
    <div class="voice-status" id="bc-status">${canScan ? t('barcode_hint') : t('barcode_manual_hint')}</div>
    <div class="bc-manual">
      <input type="text" inputmode="numeric" id="bc-manual-input" autocomplete="off"
        placeholder="${escapeHtml(t('barcode_number_ph'))}">
      <button type="button" class="btn btn-primary" id="bc-manual-go">${t('barcode_lookup')}</button>
    </div>
    <div class="ai-results" id="bc-result"></div>
  `);
  const status = overlay.querySelector('#bc-status');
  const result = overlay.querySelector('#bc-result');
  const stage = overlay.querySelector('#bc-stage');
  const video = overlay.querySelector('#bc-video');
  let stream = null, scanning = false, detector = null, zxingReader = null;
  const triedUnknown = new Set();   // codes Open Food Facts didn't recognise — don't re-hit them

  const stop = () => {
    scanning = false;
    if (zxingReader) { try { zxingReader.reset(); } catch (_) {} zxingReader = null; }
    if (stream) { try { stream.getTracks().forEach((tk) => tk.stop()); } catch (_) {} stream = null; }
  };
  // Release the camera on ANY dismissal (X / backdrop / Escape) — same guard as voice.
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) {
    const mo = new MutationObserver(() => { if (!document.body.contains(overlay)) { stop(); mo.disconnect(); } });
    mo.observe(modalRoot, { childList: true, subtree: true });
  }
  const failToManual = (denied) => {
    stop();
    if (stage) stage.style.display = 'none';
    status.textContent = denied ? t('barcode_cam_denied_manual') : t('barcode_manual_hint');
    setTimeout(() => { try { overlay.querySelector('#bc-manual-input').focus(); } catch (_) {} }, 80);
  };

  // Look up ONE code on Open Food Facts. Returns true when a product with
  // calories was found and shown (scanning then stops); false otherwise.
  async function lookup(code) {
    scanning = false;                 // pause processing while we query
    status.textContent = t('barcode_looking');
    let product = null;
    let failed = false;   // a DNS failure, offline, a 5xx — none of them is "unknown barcode"
    try {
      const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' +
        encodeURIComponent(code) + '.json?fields=product_name,nutriments,serving_quantity,product_quantity');
      const data = await res.json();
      product = data && data.product;
    } catch (_) { failed = true; }
    if (!document.body.contains(overlay)) return true;
    const n = product && product.nutriments;
    const kcal100 = n && (n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : null);
    if (!product || !n || kcal100 == null) { status.textContent = t(failed ? 'auth_err_network' : 'barcode_not_found'); return false; }
    stop();                           // got a hit → release the camera
    if (stage) stage.style.display = 'none';
    showResult(product, n);
    return true;
  }

  // Native BarcodeDetector loop (Android). On an unknown code it's remembered
  // and scanning continues for a different one.
  async function scanLoopNative() {
    if (!scanning || !detector || !document.body.contains(overlay)) return;
    try {
      const codes = await detector.detect(video);
      const code = codes && codes.length && codes[0].rawValue ? String(codes[0].rawValue) : '';
      if (code && !triedUnknown.has(code)) {
        if (await lookup(code)) return;
        triedUnknown.add(code);
        scanning = true;
      }
    } catch (_) {}
    requestAnimationFrame(scanLoopNative);
  }

  // Manual number entry — always available; the fallback when camera scanning
  // isn't supported or the camera is denied.
  const manualInput = overlay.querySelector('#bc-manual-input');
  const manualGo = overlay.querySelector('#bc-manual-go');
  const doManual = () => {
    const code = String(manualInput.value || '').replace(/\D/g, '');
    if (code.length < 6) { status.textContent = t('barcode_invalid'); manualInput.focus(); return; }
    lookup(code);
  };
  manualGo.addEventListener('click', doManual);
  manualInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doManual(); } });

  // THE AMOUNT BOX STARTS AT THE PRODUCT'S OWN SERVING, not at 100 g. The
  // figures come per 100 g and used to be shown for exactly 100 g whatever
  // the product was — so a 30 g bar and a 330 ml can both opened as «100 غ»,
  // which read as the product being right and its weight wrong (owner report,
  // v391). Open Food Facts carries the serving the label states
  // (serving_quantity, grams or ml) and the package size (product_quantity);
  // the serving wins, a single-serve package is next, and 100 g is only the
  // fallback when the record says nothing. The box stays editable either way.
  function defaultGrams(product) {
    const serving = Number(product.serving_quantity);
    if (Number.isFinite(serving) && serving >= 1 && serving <= 1000) return Math.round(serving);
    const pack = Number(product.product_quantity);
    if (Number.isFinite(pack) && pack >= 1 && pack <= 400) return Math.round(pack);
    return 100;
  }

  function showResult(product, n) {
    const name = String(product.product_name || t('add_barcode')).slice(0, 80);
    const grams0 = defaultGrams(product);
    const per100 = {
      cal: Math.round(+n['energy-kcal_100g'] || 0),
      pro: Math.round((+n['proteins_100g'] || 0) * 10) / 10,
      carb: Math.round((+n['carbohydrates_100g'] || 0) * 10) / 10,
      fat: Math.round((+n['fat_100g'] || 0) * 10) / 10,
    };
    status.textContent = '';
    result.innerHTML = `
      <div class="bc-card">
        <div class="bc-name">${escapeHtml(name)}</div>
        <div class="bc-amount-row">
          <label class="form-label" for="bc-grams">${t('bc_amount')}</label>
          <input type="number" inputmode="numeric" id="bc-grams" value="${grams0}" min="1" step="10">
          <span class="bc-unit">${t('unit_g')}</span>
        </div>
        <div class="ai-macros" id="bc-macros"></div>
        <button class="btn btn-primary btn-block" id="bc-add">${icon('plus', 20)} ${t('ai_add_all')}</button>
      </div>`;
    const gramsInput = result.querySelector('#bc-grams');
    const macrosEl = result.querySelector('#bc-macros');
    const scaled = () => {
      const g = Math.max(1, parseInt(gramsInput.value, 10) || grams0);
      const f = g / 100;
      return {
        name: name + ' ~' + fmtNum(g) + t('unit_g'),
        calories: Math.round(per100.cal * f),
        protein: Math.round(per100.pro * f * 10) / 10,
        carbs: Math.round(per100.carb * f * 10) / 10,
        fat: Math.round(per100.fat * f * 10) / 10,
      };
    };
    const renderMacros = () => {
      const s = scaled();
      macrosEl.innerHTML =
        `<span class="ai-macro cal"><b class="num">${fmtNum(s.calories)}</b>${t('cal')}</span>` +
        `<span class="ai-macro pro"><b class="num">${fmtNum(s.protein)}</b>g ${t('protein_label')}</span>` +
        `<span class="ai-macro carb"><b class="num">${fmtNum(s.carbs)}</b>g ${t('carbs_label')}</span>` +
        `<span class="ai-macro fat"><b class="num">${fmtNum(s.fat)}</b>g ${t('fat_label')}</span>`;
    };
    renderMacros();
    gramsInput.addEventListener('input', renderMacros);
    result.querySelector('#bc-add').addEventListener('click', () => {
      logNutritionItems(date, [Object.assign(scaled(), { source: 'barcode' })], onSave);
      showToast(t('ai_added'));
      closeModal();
    });
  }

  // ----- pick a camera engine -----
  if (!hasCamera) { failToManual(false); return; }   // no camera at all → manual only

  // Engine A: native BarcodeDetector (fast) when the browser has it.
  if (hasDetector) {
    try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }); }
    catch (_) { try { detector = new BarcodeDetector(); } catch (__) { detector = null; } }
  }
  if (detector) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => { stream = s; video.srcObject = s; video.play().catch(() => {}); scanning = true; requestAnimationFrame(scanLoopNative); })
      .catch(() => failToManual(true));
    return;
  }

  // Engine B: ZXing decoder (works in any browser with a camera). Lazy-loaded.
  status.textContent = t('barcode_loading');
  loadBarcodeLib().then((ZX) => {
    if (!document.body.contains(overlay)) return;
    zxingReader = new ZX.BrowserMultiFormatReader();
    scanning = true;
    status.textContent = t('barcode_hint');
    return zxingReader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, async (res2) => {
      if (!scanning || !res2 || typeof res2.getText !== 'function') return;   // no barcode in this frame
      const code = String(res2.getText());
      if (triedUnknown.has(code)) return;
      if (await lookup(code)) return;   // found → shown + stopped
      triedUnknown.add(code);           // unknown → skip it, keep scanning
      scanning = true;
    });
  }).catch(() => failToManual(true));
}

// ===========================================================================
// Add sheet — one "+" opens an animated bottom sheet with every add method.
// ===========================================================================
// REPEAT YESTERDAY. Most days are not new days: the breakfast is the breakfast.
// Logging it again cost the whole capture path - chat, photo, barcode or a hunt
// through saved foods - for food the app already had, with the portions already
// decided.
//
// It is a LIST WITH CHOICES, never a "copy the day" button: nobody eats the
// same four things every day, and an all-or-nothing repeat would be wrong often
// enough to stop being used. NOTHING starts ticked (owner decision, v391 —
// «لا تجعل الديفلت كله مختار»; v376 had ticked everything): the person picks
// what they ate again, and the add button waits until something is picked.
//
// The portions come across verbatim (`servings`), which is the other half of
// "as they were" - a repeat that silently logged one serving of a 1.5-serving
// meal would be a different meal.
function openRepeatYesterday(date, onChange) {
  // todayISO() HERE, at the moment this opens - never a date captured by a
  // render that may have painted before midnight.
  const day = date || todayISO();
  const prevDay = addDaysISO(day, -1);
  const prev = DB.foodLogs.listForDate(prevDay);
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('fl_repeat_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    ${prev.length ? `
    <div class="cx-stack cx-list" id="ry-list">
      ${prev.map((e, i) => {
        const m = e.servings || 1;
        // .sl-tick is the ticked row this app already has - the shopping
        // list's - rather than a second one that merely resembles it. Its
        // checkbox is the app's own orange square (v330), not the browser's.
        return `<label class="sl-tick" data-ry-row="${i}">
          <input type="checkbox" data-ry="${i}">
          <span class="sl-text">
            <span class="sl-name">${escapeHtml(e.name)}${m !== 1 ? ` <span class="num">\u00d7 ${fmtNum(m)}</span>` : ''}</span>
            <span class="sl-amt"><span class="num">${fmtNum(Math.round(e.calories * m))}</span> ${t('cal')}</span>
          </span>
        </label>`;
      }).join('')}
    </div>
    <div class="cx-actions">
      <button type="button" class="btn btn-primary" id="ry-add">${t('fl_repeat_add')}</button>
    </div>` : `<div class="calc-preview-hint" style="text-align:center;padding:18px">${t('fl_repeat_empty')}</div>`}
  `);
  const addBtn = overlay.querySelector('#ry-add');
  // The button is live only while something is ticked — a filled button that
  // answers with «choose something first» is a button that does nothing.
  const syncAdd = () => { if (addBtn) addBtn.disabled = !overlay.querySelector('[data-ry]:checked'); };
  const list = overlay.querySelector('#ry-list');
  if (list) list.addEventListener('change', syncAdd);
  syncAdd();
  if (addBtn) addBtn.addEventListener('click', () => {
    if (addBtn.disabled) return;
    addBtn.disabled = true; setTimeout(syncAdd, 800);
    const picked = [...overlay.querySelectorAll('[data-ry]:checked')]
      .map((c) => prev[Number(c.dataset.ry)])
      .filter(Boolean)
      .map((e) => ({ name: e.name, servings: e.servings || 1, calories: e.calories, protein: e.protein,
        carbs: e.carbs, fat: e.fat || 0, source: e.source || 'saved' }));
    if (!picked.length) { showToast(t('fl_repeat_none')); return; }
    // ONE write for the whole selection, and the day is resolved again here:
    // the sheet can stand open across midnight.
    const result = DB.foodLogs.addMany(date || todayISO(), picked);
    if (!result.ok) { convenienceError(result); return; }
    closeModal();
    if (typeof onChange === 'function') onChange();
    offerUndo(t('fl_repeat_added').replace('{n}', fmtNum(picked.length)), result);
  });
}

function openAddSheet(date, onChange) {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('add-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'add-sheet-overlay';
  overlay.className = 'sheet-overlay';
  // A grid of consistent square tiles — one icon + label per tile.
  const tile = (m) => `
    <button class="add-tile" data-method="${m.k}">
      <span class="add-tile-icon ${m.k}">${icon(m.icon, 24)}</span>
      <span class="add-tile-title">${m.title}</span>
    </button>`;
  overlay.innerHTML = `
    <div class="add-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="add-sheet-title">${t('add_sheet_title')}</div>
      <div class="add-grid">
        ${DB.foodLogs.listForDate(addDaysISO(date || todayISO(), -1)).length ? `
        <button class="add-tile wide" data-method="repeat">
          <span class="add-tile-icon recipe">${icon('refresh', 24)}</span>
          <span class="add-tile-text"><span class="add-tile-title">${t('fl_repeat_title')}</span></span>
        </button>` : ''}
        ${tile({ k: 'voice', icon: 'mic', title: t('add_voice') })}
        ${tile({ k: 'chat', icon: 'message', title: t('add_chat') })}
        ${tile({ k: 'photo', icon: 'camera', title: t('add_photo') })}
        ${tile({ k: 'barcode', icon: 'barcode', title: t('add_barcode') })}
        ${tile({ k: 'saved', icon: 'utensils', title: t('add_saved') })}
        ${tile({ k: 'manual', icon: 'edit', title: t('add_manual') })}
        <button class="add-tile wide" data-method="recipe">
          <span class="add-tile-icon recipe">${icon('chart', 24)}</span>
          <span class="add-tile-text"><span class="add-tile-title">${t('add_recipe')}</span></span>
        </button>
      </div>
    </div>`;
  app.appendChild(overlay);
  // Next frame → add .open so the sheet transitions up smoothly.
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = (cb) => {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); if (typeof cb === 'function') cb(); }, 260);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); return; }
    const btn = e.target.closest('[data-method]');
    if (!btn) return;
    const method = btn.dataset.method;
    close(() => {
      if (method === 'repeat') openRepeatYesterday(date, onChange);
      else if (method === 'voice') openVoiceCapture(date, onChange);
      else if (method === 'chat' || method === 'photo') {
        // Runs from a detached 260 ms callback; foodai.js is the sixth script,
        // so it is checked here exactly like every other FoodAI site.
        if (!window.FoodAI) { showToast(t('ai_error')); return; }
        if (method === 'photo' && FoodAI.openPhoto) FoodAI.openPhoto(date); else FoodAI.open(date);
      }
      else if (method === 'barcode') openBarcodeScanner(date, onChange);
      else if (method === 'saved') openSavedFoodPicker(date, onChange);
      else if (method === 'manual') openManualFoodEntry(date, onChange);
      // Straight into the editor; saving lands on the recipes tab so the new
      // recipe can be logged with one tap.
      else if (method === 'recipe') openRecipeEditor(date, null, () => openSavedFoodPicker(date, onChange, 'recipes'));
    });
  });
}

function openCalculatorModal(onSave) {
  const nut = DB.nutrition;
  const p = Object.assign({}, nut.get().profile);
  let manual = nut.get().mode === 'manual';
  const curTargets = nut.get().targets;

  const activities = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
  const goals = ['cut', 'maintain', 'bulk'];

  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('calc_title')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div id="calc-body"></div>
  `);

  const body = overlay.querySelector('#calc-body');

  function calcFormHtml() {
    const seg = (name, opts, cur) => `
      <div class="seg" data-seg="${name}">
        ${opts.map((o) => `<button type="button" class="seg-btn ${cur === o.v ? 'active' : ''}" data-val="${o.v}">${o.label}</button>`).join('')}
      </div>`;
    return `
      <div class="form-group"><label class="form-label">${t('calc_sex')}</label>
        ${seg('sex', [{ v: 'male', label: t('calc_male') }, { v: 'female', label: t('calc_female') }], p.sex)}</div>
      <div class="calc-grid">
        <div class="form-group"><label class="form-label">${t('calc_age')}</label>
          <input type="number" inputmode="numeric" id="c-age" min="10" max="100" value="${numAttr(p.age)}" placeholder="25"></div>
        <div class="form-group"><label class="form-label">${t('calc_height')}</label>
          <input type="number" inputmode="numeric" id="c-height" min="100" max="230" value="${numAttr(p.heightCm)}" placeholder="175"></div>
        <div class="form-group"><label class="form-label">${t('calc_weight')}</label>
          <input type="number" inputmode="decimal" id="c-weight" min="30" max="300" value="${numAttr(p.weightKg)}" placeholder="75"></div>
      </div>
      <div class="form-group"><label class="form-label">${t('calc_activity')}</label>
        ${seg('activity', activities.map((a) => ({ v: a, label: t('activity_' + a) })), p.activity)}</div>
      <div class="form-group"><label class="form-label">${t('calc_goal')}</label>
        ${seg('goal', goals.map((g) => ({ v: g, label: t('goal_' + g) })), p.goal)}</div>
      <div class="calc-preview" id="calc-preview"></div>
      <button class="btn btn-primary btn-block" id="calc-save">${t('save')}</button>
      <button type="button" class="calc-switch" id="to-manual">${t('calc_use_manual')}</button>
    `;
  }

  function manualFormHtml() {
    return `
      <div class="calc-grid calc-grid-2">
        <div class="form-group"><label class="form-label">${t('calories')}</label>
          <input type="number" inputmode="numeric" id="m-cal" min="0" value="${numAttr(curTargets.calories)}" placeholder="2200"></div>
        <div class="form-group"><label class="form-label">${t('protein_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-pro" min="0" value="${numAttr(curTargets.protein)}" placeholder="160"></div>
        <div class="form-group"><label class="form-label">${t('carbs_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-carb" min="0" value="${numAttr(curTargets.carbs)}" placeholder="220"></div>
        <div class="form-group"><label class="form-label">${t('fat_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-fat" min="0" value="${numAttr(curTargets.fat)}" placeholder="60"></div>
      </div>
      <button class="btn btn-primary btn-block" id="calc-save-manual">${t('save')}</button>
      <button type="button" class="calc-switch" id="to-calc">${t('calc_use_calc')}</button>
    `;
  }

  function previewHtml() {
    const c = DB.nutrition.compute(p);
    if (!c) return `<div class="calc-preview-hint">${t('calc_fill_hint')}</div>`;
    const cell = (v, unit, label) => `<div class="calc-cell"><div class="calc-cell-v num">${fmtNum(v)}<span>${unit}</span></div><div class="calc-cell-l">${label}</div></div>`;
    return `
      <div class="calc-preview-grid">
        ${cell(c.calories, t('cal'), t('nutri_calories'))}
        ${cell(c.protein, 'g', t('protein_label'))}
        ${cell(c.carbs, 'g', t('carbs_label'))}
        ${cell(c.fat, 'g', t('fat_label'))}
      </div>
      <div class="calc-preview-hint">${t('calc_tdee')}: <span class="num">${fmtNum(c.tdee)}</span> ${t('cal')} · ${t('calc_bmr')}: <span class="num">${fmtNum(c.bmr)}</span></div>
    `;
  }

  function renderCalcForm() {
    body.innerHTML = calcFormHtml();
    const prev = body.querySelector('#calc-preview');
    const refresh = () => { if (prev) prev.innerHTML = previewHtml(); };
    refresh();
    body.querySelectorAll('[data-seg]').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('.seg-btn'); if (!b) return;
        seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        p[seg.dataset.seg] = b.dataset.val;
        refresh();
      });
    });
    ['c-age', 'c-height', 'c-weight'].forEach((id) => {
      const inp = body.querySelector('#' + id);
      inp?.addEventListener('input', () => {
        if (id === 'c-age') p.age = Number(inp.value) || null;
        if (id === 'c-height') p.heightCm = Number(inp.value) || null;
        if (id === 'c-weight') p.weightKg = Number(inp.value) || null;
        refresh();
      });
    });
    body.querySelector('#calc-save')?.addEventListener('click', () => {
      if (!DB.nutrition.compute(p)) { showToast(t('calc_fill_hint')); return; }
      DB.nutrition.setProfile(p);
      closeModal(); showToast(t('saved'));
      if (typeof onSave === 'function') onSave();
    });
    body.querySelector('#to-manual')?.addEventListener('click', () => { manual = true; draw(); });
  }

  function renderManualForm() {
    body.innerHTML = manualFormHtml();
    body.querySelector('#calc-save-manual')?.addEventListener('click', () => {
      const cal = Number(body.querySelector('#m-cal').value) || 0;
      if (cal <= 0) { showToast(t('calc_fill_hint')); return; }
      DB.nutrition.setTargets({
        calories: cal,
        protein: Number(body.querySelector('#m-pro').value) || 0,
        carbs: Number(body.querySelector('#m-carb').value) || 0,
        fat: Number(body.querySelector('#m-fat').value) || 0,
      });
      closeModal(); showToast(t('saved'));
      if (typeof onSave === 'function') onSave();
    });
    body.querySelector('#to-calc')?.addEventListener('click', () => { manual = false; draw(); });
  }

  const draw = () => { manual ? renderManualForm() : renderCalcForm(); };
  draw();
}

// ===========================================================================
// Manual quick-add: name + macros straight into today's log.
// ===========================================================================
function openManualFoodEntry(date, onSave) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('manual_food_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="form-group"><label class="form-label">${t('mf_quick_label')}</label>
      <textarea id="mf-quick" rows="2" placeholder="${escapeHtml(t('mf_quick_ph'))}"></textarea>
      <div class="form-hint" id="mf-quick-hint">${t('mf_quick_hint')}</div></div>
    <div class="form-group"><label class="form-label">${t('name')}</label>
      <input type="text" id="mf-name" placeholder="${t('manual_food_ph')}" autofocus></div>
    <div class="calc-grid calc-grid-2">
      <div class="form-group"><label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="numeric" id="mf-cal" min="0" placeholder="250"></div>
      <div class="form-group"><label class="form-label">${t('protein_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-pro" min="0" placeholder="20"></div>
      <div class="form-group"><label class="form-label">${t('carbs_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-carb" min="0" placeholder="30"></div>
      <div class="form-group"><label class="form-label">${t('fat_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-fat" min="0" placeholder="8"></div>
    </div>
    <label class="mf-keep"><input type="checkbox" id="mf-keep" checked>
      <span>${t('mf_keep_label')}</span></label>
    <button class="btn btn-primary btn-block" id="mf-save">${icon('plus', 20)} ${t('ai_add_to_log')}</button>
  `);

  const $q = overlay.querySelector('#mf-quick');
  const $hint = overlay.querySelector('#mf-quick-hint');
  const F = {
    name: overlay.querySelector('#mf-name'), cal: overlay.querySelector('#mf-cal'),
    pro: overlay.querySelector('#mf-pro'), carb: overlay.querySelector('#mf-carb'),
    fat: overlay.querySelector('#mf-fat'),
  };
  // Write the whole thing in one line and let it fill the boxes. This reuses the
  // SAME parser the chat uses (FoodAI.parseText), so "فول 1000 سعرة و55 جرام
  // بروتين" lands here identically — no second set of rules to drift apart, and
  // nothing is sent anywhere: it is pure local text matching.
  const applyQuick = () => {
    const raw = $q.value || '';
    if (!raw.trim()) { $hint.textContent = t('mf_quick_hint'); $hint.classList.remove('ok'); return; }
    const parsed = (window.FoodAI && FoodAI.parseText) ? FoodAI.parseText(raw) : null;
    const it = parsed && parsed.items && parsed.items[0];
    if (!it) { $hint.textContent = t('mf_quick_none'); $hint.classList.remove('ok'); return; }
    if (!F.name.value.trim() && it.name) F.name.value = it.name;
    F.cal.value = it.calories || '';
    F.pro.value = it.protein || '';
    F.carb.value = it.carbs || '';
    F.fat.value = it.fat || '';
    $hint.textContent = t('mf_quick_ok');
    $hint.classList.add('ok');
  };
  $q.addEventListener('input', debounce(applyQuick, 250));
  $q.addEventListener('change', applyQuick);

  // NO applyQuick() here. It used to run on save "to catch a paste that never
  // fired input" — but it unconditionally rewrites all four macro boxes, so it
  // threw away any figure the user had typed or corrected by hand, and with
  // "keep in my foods" ticked by default the reverted values were saved too and
  // came back on every later one-tap log. The input and change listeners above
  // already cover the paste case; a paste that fires neither cannot exist.
  overlay.querySelector('#mf-save').addEventListener('click', () => {
    const name = (F.name.value || '').trim();
    if (!name) { showToast(t('enter_name')); return; }
    const macros = {
      calories: Number(F.cal.value) || 0,
      protein: Number(F.pro.value) || 0,
      carbs: Number(F.carb.value) || 0,
      fat: Number(F.fat.value) || 0,
    };
    DB.foodLogs.add(date || todayISO(), { name, servings: 1, ...macros, source: 'manual' });
    // Keep it for next time, so the same meal is one tap from the saved picker
    // instead of being retyped. Skipped when an identically-named food already
    // exists, or the list fills with duplicates of whatever you eat most.
    let kept = false;
    if (overlay.querySelector('#mf-keep').checked) {
      const dup = DB.foods.list().some((f) => f.name.trim().toLowerCase() === name.toLowerCase());
      if (!dup) { DB.foods.add({ name, serving: '', ...macros }); kept = true; }
    }
    closeModal();
    showToast(kept ? t('mf_added_and_kept') : t('ai_added'));
    if (typeof onSave === 'function') onSave();
  });
}

// ===========================================================================
// RECIPE CALCULATOR — write the ingredients once, get the numbers.
// ===========================================================================
// Distinct from a meal bundle, and the difference is the whole point: a bundle
// RE-LOGS rows you already logged; a recipe COMPUTES a total from parts that
// were never log rows, then divides it into servings. "500 g chicken + 300 g
// rice + a spoon of oil, makes 4" is not expressible as a bundle.
//
// Every ingredient is its own row of separate fields, per the owner's brief:
// name, amount, and its four macros. The amount is a free-text LABEL ("200 غ",
// "3 حبات") and the four figures are for that amount, exactly as a person reads
// them off a label — rows are summed as typed. (v286–v290 treated the amount as
// a numeric multiplier: 200 g at 330 kcal totalled 66,000. Old multipliers are
// folded into the figures once, on load — see loadState.)
//
// Totals are never stored; DB.recipes.totals() derives them on read. A stored
// total silently disagrees with its own ingredients the moment one is edited.
// THE INGREDIENTS, TO COOK FROM. The card says what a serving COSTS; this says
// what goes IN — every ingredient with its amount exactly as it was typed
// («200 غ», «٣ حبات»), never parsed, never scaled, and no macros: at the
// stove the arithmetic is noise. One line above the list carries the one
// number a cook needs, how many servings it makes. The list itself holds no
// controls; «تعديل» below it is the way to change anything, and it returns
// to the picker the way the card's own pencil does.
function openRecipeView(date, rec, onSave) {
  // Re-read by id: the picker's copy can be older than an edit made since.
  const r = DB.recipes.list().find((x) => x.id === rec.id) || rec;
  const modal = convenienceModal(`
    <div class="modal-header"><h2 class="modal-title">${escapeHtml(r.name)}</h2><button class="icon-btn" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button></div>
    <div class="cx-stack">
      <div class="settings-hint"><span class="num">${fmtNum(r.servings)}</span> ${t('rec_u_serv')}</div>
      <div class="cx-list rec-view">${(r.items || []).map((it) => `<div class="cx-row"><span>${escapeHtml(it.name)}</span>${String(it.qty || '').trim() ? `<span class="num rec-view-qty" dir="auto">${escapeHtml(it.qty)}</span>` : ''}</div>`).join('')}</div>
      <button type="button" class="btn btn-ghost" data-edit-view>${t('rec_edit')}</button>
    </div>`);
  modal.querySelector('[data-edit-view]').addEventListener('click', () => {
    openRecipeEditor(date, r, () => openSavedFoodPicker(date, onSave, 'recipes'));
  });
}

function openRecipeEditor(date, existing, onDone) {
  // THE INGREDIENT LEDGER (v301). The sheet is a LIST, not a spreadsheet.
  //
  // One ingredient = one input line (name + amount + remove) and ONE read-only
  // summary line under it. The four figures are not inputs by default: they
  // arrive from the auto-fill machinery below and a tap on the summary opens a
  // well to override them. Per ingredient that is 4 visible controls and 0
  // captions, against 7 and 5 before — which is the whole point: the owner's
  // complaint was that the box does not fit what is in it.
  //
  // Two rules make it feel calm, and both are load-bearing:
  //   1. A ROW IS NEVER RE-RENDERED WHILE IT IS BEING USED. drawRows() runs at
  //      open and on undo-restore, nothing else. Everything after that patches
  //      the DOM in place through updateSummary()/fill()/drawTotals(), so no
  //      field loses focus, no caret moves, and no listener is ever re-bound
  //      (three delegated listeners on #rec-rows, bound once).
  //   2. THE SUMMARY LINE HAS THE SAME HEIGHT IN EVERY STATE, including empty
  //      (it holds the ghost hint there). A row above the one you are typing in
  //      changes its text, never its height, when figures land.
  var seq = 0;
  var newItem = function () { return { _id: ++seq, name: '', qty: '', calories: 0, protein: 0, carbs: 0, fat: 0 }; };
  var hasFigures = function (it) { return !!(Number(it.calories) || Number(it.protein) || Number(it.carbs) || Number(it.fat)); };
  var items = existing && existing.items ? existing.items.map(function (i) { return Object.assign({ _id: ++seq }, i); }) : [newItem()];
  var name = (existing && existing.name) || '';
  var servings = (existing && existing.servings) || 1;
  var saveWanted = false;

  // Arabic's dual and its 3-10 / 11+ split are real grammar. Used as the
  // servings input's aria-label — the one place the number is SPOKEN beside a
  // noun. It is not painted a second time: the digit is already on screen.
  var servLabel = function (n) {
    n = Math.max(1, parseInt(n, 10) || 1);
    if (n === 1) return t('rec_serv_1');
    if (n === 2) return t('rec_serv_2');
    return (n <= 10 ? t('rec_serv_n') : t('rec_serv_many')).replace('{n}', fmtNum(n));
  };

  var rowHtml = function (it) {
    var fld = function (f, cap, step, mode, hint) {
      return '<label class="rec-f"><span class="rec-cap">' + cap + '</span>' +
        '<input type="number" data-f="' + f + '" inputmode="' + mode + '" min="0" step="' + step + '"' +
        ' enterkeyhint="' + hint + '" aria-label="' + escapeHtml(cap) + '" value="' + numAttr(it[f]) + '"></label>';
    };
    return '<div class="rec-row" data-id="' + it._id + '" data-state="idle" data-src="">' +
      '<div class="rec-line">' +
        '<input type="text" class="rec-name" data-f="name" maxlength="60" enterkeyhint="next"' +
          ' placeholder="' + escapeHtml(t('rec_ing_name')) + '" aria-label="' + escapeHtml(t('rec_ing_name')) + '"' +
          ' value="' + escapeHtml(it.name || '') + '">' +
        // The amount is a free-text LABEL ("200 غ", "٣ حبات", "ملعقة زيت") — see
        // DB.recipes.totals. NOT inputmode=decimal: that keypad has no letters,
        // and parseGrams + the AI already read those amounts correctly.
        '<input type="text" class="rec-qty" data-f="qty" dir="auto" maxlength="24" enterkeyhint="next"' +
          ' placeholder="' + escapeHtml(t('rec_qty_ph')) + '" aria-label="' + escapeHtml(t('rec_qty')) + '"' +
          ' value="' + escapeHtml(String(it.qty == null ? '' : it.qty)) + '">' +
        '<button type="button" class="rec-del" data-del aria-label="' + escapeHtml(t('rec_del_ing')) + '">' + icon('trash', 16) + '</button>' +
      '</div>' +
      // No aria-label: it would REPLACE the content, and the content (the
      // figures and the source word) is exactly what a screen reader must read.
      '<button type="button" class="rec-sum" data-toggle aria-expanded="false" aria-controls="rec-more-' + it._id + '">' +
        '<span class="rec-sum-t"></span><span class="rec-sum-tag"></span>' +
        '<span class="rec-sum-ic">' + icon('edit', 14) + '</span>' +
      '</button>' +
      '<div class="rec-more" id="rec-more-' + it._id + '">' +
        fld('calories', t('cal'), '1', 'numeric', 'next') +
        fld('protein', t('protein_label'), '0.1', 'decimal', 'next') +
        fld('carbs', t('carbs_label'), '0.1', 'decimal', 'next') +
        fld('fat', t('fat_label'), '0.1', 'decimal', 'done') +
        '<div class="rec-more-foot" hidden>' +
          '<button type="button" class="rec-act" data-retry hidden>' + icon('refresh', 16) + ' ' + t('rec_retry') + '</button>' +
          '<button type="button" class="rec-act" data-recompute hidden>' + icon('refresh', 16) + ' ' + t('rec_recompute') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  // NO <datalist> HERE, deliberately. A suggestion list was tried and the owner
  // rejected it on sight: the field grew a dropdown arrow and read as "pick one
  // of the names I chose for you", when the promise of this screen is the
  // opposite — write ANY ingredient and its figures appear. localLookup already
  // matches whatever is typed against DB.foods, so the fast offline path is
  // taken anyway when the name happens to be one he has saved; it simply is not
  // advertised as a menu.

  var totalsCell = function (attr, key) {
    return '<span class="num"' + attr + '>0</span> ' + key;
  };
  var overlay = openModal('' +
    '<div class="modal-header">' +
      '<div><div class="modal-title">' + (existing ? escapeHtml(existing.name) : t('rec_new')) + '</div>' +
      '<div class="modal-subtitle" id="rec-sub">' + t('rec_sub') + '</div></div>' +
      '<button class="icon-btn icon-btn-tile" data-close>' + icon('close', 20) + '</button>' +
    '</div>' +
    '<input type="text" id="rec-name" class="input rec-name-top" maxlength="60" enterkeyhint="next" placeholder="' + escapeHtml(t('rec_name_ph')) + '" value="' + escapeHtml(name) + '">' +
    '<div id="rec-rows" class="rec-list"></div>' +
    '<button type="button" class="ledger-add rec-add" id="rec-add">' + icon('plus', 14) + ' <span>' + t('rec_add_ing') + '</span></button>' +
    '<div class="rec-totals" id="rec-totals">' +
      '<div class="rt-line"><span class="rt-k">' + t('rec_total') + '</span>' +
        '<span class="rt-v">' + totalsCell(' data-t="calories"', t('cal')) + ' · ' + totalsCell(' data-t="protein"', t('protein_label')) +
        ' · ' + totalsCell(' data-t="carbs"', t('carbs_label')) + ' · ' + totalsCell(' data-t="fat"', t('fat_label')) + '</span></div>' +
      '<div class="rt-serv"><span class="rt-serv-k">' + t('rec_servings') + '</span>' +
        '<span class="rt-step">' +
          '<button type="button" data-step="-1" aria-label="' + escapeHtml(t('rec_serv_less')) + '">' + icon('minus', 16) + '</button>' +
          '<input type="number" id="rec-servings" class="num" inputmode="numeric" min="1" max="99" step="1" value="' + numAttr(servings) + '" aria-label="' + escapeHtml(servLabel(servings)) + '">' +
          '<button type="button" data-step="1" aria-label="' + escapeHtml(t('rec_serv_more')) + '">' + icon('plus', 16) + '</button>' +
        '</span></div>' +
      '<div class="rt-line accent"><span class="rt-k">' + t('rec_per') + '</span>' +
        '<span class="rt-v"><span class="num rt-cal" data-p="calories">0</span> ' + t('cal') + ' · ' + totalsCell(' data-p="protein"', t('protein_label')) +
        ' · ' + totalsCell(' data-p="carbs"', t('carbs_label')) + ' · ' + totalsCell(' data-p="fat"', t('fat_label')) + '</span></div>' +
    '</div>' +
    '<div class="form-actions sticky-actions">' +
      '<button type="button" class="btn btn-primary" id="rec-save">' + t('rec_save') + '</button>' +
    '</div>');

  var host = overlay.querySelector('#rec-rows');
  // Items are addressed by their transient _id, NEVER by index: an index shifts
  // the moment a row above is deleted, and a reply that lands after that would
  // paint the chicken's figures onto the rice.
  var rowOf = function (it) { return it ? host.querySelector('.rec-row[data-id="' + it._id + '"]') : null; };
  var byId = function (id) { for (var i = 0; i < items.length; i++) if (items[i]._id === id) return items[i]; return null; };
  var itemOf = function (el) { var r = el.closest ? el.closest('.rec-row') : null; return r ? byId(Number(r.dataset.id)) : null; };

  // ---- ONE writer for the summary line -------------------------------------
  function figuresHtml(it) {
    var n = function (v) { return '<span class="num">' + fmtNum(Math.round(Number(v) || 0)) + '</span>'; };
    // Macros are rounded to WHOLE numbers on this line only (the well keeps the
    // decimal). That is what makes the string fit 354px without truncating;
    // the CSS ellipsis is a net, not the plan. Do not restore the decimals.
    return n(it.calories) + ' ' + t('cal') + ' · ' + n(it.protein) + ' ' + t('protein_label') +
      ' · ' + n(it.carbs) + ' ' + t('carbs_label') + ' · ' + n(it.fat) + ' ' + t('fat_label');
  }
  function updateSummary(it) {
    var row = rowOf(it); if (!row) return;
    var pending = it._auto === 'pending' || it._auto === 'sent';
    var failed = it._auto === 'fail';
    var done = !pending && !failed && (hasFigures(it) || it._manual);
    var state = pending ? 'pending' : failed ? 'fail' : done ? 'done' : 'idle';
    var src = done ? (it._src || 'saved') : '';
    row.dataset.state = state;
    row.dataset.src = src;
    if (it._why) row.dataset.why = it._why; else row.removeAttribute('data-why');
    var open = row.classList.contains('is-open');
    var txt = row.querySelector('.rec-sum-t');
    var tag = row.querySelector('.rec-sum-tag');
    var ic = row.querySelector('.rec-sum-ic');
    if (pending) txt.textContent = t('rec_st_pending');
    else if (failed) txt.textContent = it._why === 'signin' ? t('rec_st_signin') : t('rec_st_fail');
    else if (open) txt.textContent = done ? t('rec_src_' + src) : t('rec_src_empty');
    else if (done) txt.innerHTML = figuresHtml(it);
    else txt.textContent = t('rec_row_hint');
    // The source word is ALWAYS in the accessible name; only the estimate is
    // painted, so colour never carries meaning on its own.
    tag.textContent = done ? t('rec_tag_' + src) : '';
    tag.classList.toggle('sr-only', src !== 'ai');
    ic.innerHTML = open ? icon('check', 14) : icon('edit', 14);
    var retry = row.querySelector('[data-retry]');
    var recompute = row.querySelector('[data-recompute]');
    var canCompute = String(it.name || '').trim().length >= 3;
    retry.hidden = !failed;
    recompute.hidden = !(done && (src === 'manual' || src === 'saved') && canCompute);
    row.querySelector('.rec-more-foot').hidden = retry.hidden && recompute.hidden;
  }
  function setOpen(it, open) {
    var row = rowOf(it); if (!row) return;
    row.classList.toggle('is-open', !!open);
    row.querySelector('.rec-sum').setAttribute('aria-expanded', open ? 'true' : 'false');
    updateSummary(it);
    if (open) {
      var f = row.querySelector('[data-f="calories"]');
      if (f) f.focus();
      row.scrollIntoView({ block: 'nearest' });
      row.querySelector('.rec-more').scrollIntoView({ block: 'nearest' });
    }
  }
  function syncSubtitle() {
    var el = overlay.querySelector('#rec-sub');
    if (el) el.hidden = items.some(hasFigures);
  }

  // ---- rendering: whole rows only at open and on undo ----------------------
  function drawRows() {
    host.innerHTML = items.map(rowHtml).join('');
    items.forEach(updateSummary);
    drawTotals(); syncSubtitle();
  }
  function appendRow(it) { host.insertAdjacentHTML('beforeend', rowHtml(it)); updateSummary(it); }
  function addRow() {
    var it = newItem();
    items.push(it);
    appendRow(it);
    var inp = rowOf(it).querySelector('[data-f="name"]');
    inp.focus();
    rowOf(it).scrollIntoView({ block: 'nearest' });
    drawTotals(); syncSubtitle();
  }

  function drawTotals() {
    var n = Math.max(1, parseInt(overlay.querySelector('#rec-servings').value, 10) || 1);
    var rec = { servings: n, items: items };
    var tot = DB.recipes.totals(rec);
    var per = DB.recipes.perServing(rec);   // already rounded and clamped in storage.js — never divide here
    var put = function (sel, v) { var el = overlay.querySelector(sel); if (el) el.textContent = fmtNum(v); };
    put('[data-t="calories"]', Math.round(tot.calories));
    put('[data-t="protein"]', Math.round(tot.protein * 10) / 10);
    put('[data-t="carbs"]', Math.round(tot.carbs * 10) / 10);
    put('[data-t="fat"]', Math.round(tot.fat * 10) / 10);
    put('[data-p="calories"]', per.calories);
    put('[data-p="protein"]', per.protein);
    put('[data-p="carbs"]', per.carbs);
    put('[data-p="fat"]', per.fat);
  }

  // ---- AUTOMATIC FIGURES ---------------------------------------------------
  // The owner's ask: write the ingredient and its weight, the rest fills itself.
  // Order of preference per row: a food this user (or the curated catalog) already
  // holds with a gram serving — scaled, instant, offline; otherwise the AI, ONE
  // request for every row still waiting (the Worker's free quota is per day, so
  // eight ingredients must not be eight calls). A hand-typed figure wins forever
  // (_manual). The flags are transient: stripped on save.
  var autoTimer = null;
  var latinDigits = function (s) {
    return String(s || '').replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x6F0); }).replace(/\u066B/g, '.');
  };
  // '200 غ' / '200g' / '٢٠٠' / '0.5 كغ' → grams; anything else (cups, pieces) → null.
  // The LAST weight in the string counts ('١ كوب · ٢٥٠غ', 'سكوب · ٣٠غ', '200 g',
  // '0.5 كغ'). A bare number means grams for a typed quantity ('200'), but NOT for
  // a food's serving — '1' there is one piece, and scaling 100 g by it made a
  // 7,800-calorie egg.
  var parseGrams = function (s, requireUnit) {
    var str = latinDigits(s).trim().toLowerCase();
    var m = str.match(/(\d+(?:\.\d+)?)\s*(كغ|كجم|kg|غ|غم|جم|غرام|جرام|g|gr|gram|grams|مل|ml)\.?\s*$/);
    if (!m && !requireUnit) m = str.match(/^(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    var n = parseFloat(m[1]); if (!(n > 0)) return null;
    return /^(كغ|كجم|kg)$/.test(m[2] || '') ? n * 1000 : n;
  };
  var normName = function (s) { return String(s || '').trim().toLowerCase().replace(/[\u0640\u064B-\u0652]/g, '').replace(/\s+/g, ' '); };
  var localLookup = function (nameRaw, qtyRaw) {
    var name = normName(nameRaw); if (name.length < 2) return null;
    var foods = DB.foods.list();
    var food = foods.find(function (f) { return normName(f.name) === name; }) ||
               foods.find(function (f) { var n = normName(f.name); return n.length >= 3 && (n.indexOf(name) === 0 || name.indexOf(n) === 0); });
    if (!food) return null;
    // ⚠️ parseGrams() RETURNS null FOR TWO DIFFERENT STATES: «no amount was
    // given» and «an amount was given that is not grams» («٣ حبات», «٢ كوب»,
    // «ملعقة زيت» — the wordings this field deliberately invites). Only the FIRST
    // is a weightless row. Conflating them priced three potatoes as one — 90 kcal
    // instead of ~400, tagged «محسوبة لهذا الوزن», flowing through perServing into
    // the food log forever. Ask about the STRING, exactly as scheduleAuto does.
    var qty = String(qtyRaw == null ? '' : qtyRaw).trim();
    // NO AMOUNT AT ALL: the saved food's own serving IS the answer, exactly as
    // stored. This is the offline path for a weightless row — no model call.
    if (!qty) return { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat };
    // An amount that was typed but is not in grams must fall through to the model,
    // which is the only thing here that can read a count or a volume.
    var g = parseGrams(qty); if (!g) return null;
    var sg = parseGrams(food.serving, true); if (!sg) return null;   // a 'cup' or a bare '1' serving cannot be scaled by weight
    var k = g / sg;
    return { calories: food.calories * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
  };
  var setFieldValues = function (it) {
    var row = rowOf(it); if (!row) return;
    ['calories', 'protein', 'carbs', 'fat'].forEach(function (f) {
      var inp = row.querySelector('input[data-f="' + f + '"]');
      if (inp) inp.value = numAttr(it[f]);
    });
  };
  var fill = function (it, m, src) {
    if (!it) return;
    if (it._manual || (hasFigures(it) && it._auto !== 'done' && it._auto !== 'sent')) return;   // figures that are not ours stay
    it.calories = Math.round(m.calories || 0);
    it.protein = Math.round((m.protein || 0) * 10) / 10;
    it.carbs = Math.round((m.carbs || 0) * 10) / 10;
    it.fat = Math.round((m.fat || 0) * 10) / 10;
    it._auto = 'done'; it._src = src; it._why = null;
    setFieldValues(it);
    updateSummary(it);
  };
  var settle = function (it, state, why) { if (!it) return; it._auto = state; it._why = why || null; updateSummary(it); };
  function scheduleAuto(it, settled) {
    if (!it || it._manual) return;
    if (hasFigures(it) && it._auto !== 'done' && it._auto !== 'sent' && it._auto !== 'pending') return;   // a reopened recipe keeps its saved figures
    if (String(it.name || '').trim().length < 3) return;   // 'دج' is not an ingredient yet
    // THE WEIGHT IS OPTIONAL (v336). «حبة فليفلة» has no weight the user knows,
    // and requiring one is what made the field mandatory in practice: without it
    // this gate returned, nothing ever computed, and the save guard then refused
    // the row for having no figures.
    //
    // But a row whose weight is ABOUT to be typed must not spend a model call on
    // the name alone, so a weightless row waits for a different signal: the row
    // being LEFT (focusout, or save). That is the moment the user has
    // demonstrably declined to give one. Both paths arm the SAME timer, so rows
    // still batch into one request.
    if (!String(it.qty || '').trim() && !settled) return;
    // ⚠️ THE SETTLED PATH MAY ONLY START WORK THAT HAS NEVER BEEN DONE.
    // focusout and save are not edits — nothing about the row changed, the user
    // just left it. Re-arming a row that is finished, in flight, or already
    // carrying figures is wrong three separate ways, and all three were measured:
    //   · a row that legitimately computes to 0/0/0/0 (a zero-macro saved food —
    //     «ماء», «كولا دايت», «كرياتين») is !hasFigures forever, so trySave armed
    //     it, runAuto settled it, finishSaveIfWanted re-entered trySave, and it
    //     LOOPED — 66 model calls a minute against a quota shared by every user,
    //     and the recipe could never be saved.
    //   · merely passing focus through N finished rows cost N model calls, which
    //     is exactly the 'never one call per row' rule v299 exists to state.
    //   · tapping save while a request was out clobbered 'sent' back to 'pending'
    //     and sent the same row twice.
    // it._auto is truthy for every one of pending/sent/done/fail; the retry and
    // recompute buttons clear it to null first, which is what lets THEM through.
    if (settled && (hasFigures(it) || it._auto)) return;
    it._auto = 'pending'; it._why = null;
    updateSummary(it);
    clearTimeout(autoTimer);
    autoTimer = setTimeout(runAuto, 900);   // a pause in typing, not every keystroke
  }
  async function runAuto() {
    var pend = [];
    items.forEach(function (it) { if (it._auto === 'pending') { it._auto = 'sent'; pend.push({ id: it._id, key: it.name + '|' + it.qty }); } });   // 'sent': a later timer must not resend it
    if (!pend.length) return;
    var need = [];
    pend.forEach(function (x) {
      var it = byId(x.id); if (!it) return;
      var hit = localLookup(it.name, it.qty);
      if (hit) fill(it, hit, 'local'); else need.push(x);
    });
    drawTotals(); syncSubtitle();
    if (!need.length) { finishSaveIfWanted(true); return; }
    if (!(window.FoodAI && FoodAI.analyze)) { need.forEach(function (x) { settle(byId(x.id), 'fail', 'ai'); }); finishSaveIfWanted(false); return; }
    // Batches under the Worker's 500-character text limit, one line per row.
    var batches = [], cur = [], len = 0;
    need.forEach(function (x) {
      var it0 = byId(x.id); if (!it0) return;
      // A bare number is grams to parseGrams, so say so to the model too —
      // otherwise it is asked to price "200 دجاج".
      var q = String(it0.qty).trim();
      if (q && /^\d+(\.\d+)?$/.test(latinDigits(q))) q += ' ' + t('rec_g');
      var line = (q ? q + ' ' : '') + String(it0.name).trim();   // no weight: the name carries the amount («حبة فليفلة»)
      if (cur.length && len + line.length + 1 > 380) { batches.push(cur); cur = []; len = 0; }
      cur.push({ x: x, line: line }); len += line.length + 1;
    });
    if (cur.length) batches.push(cur);
    var failed = [], signin = false;
    for (var b = 0; b < batches.length; b++) {
      var batch = batches[b];
      var got = [];
      try {
        var res = await FoodAI.analyze(batch.map(function (p) { return p.line; }).join('\n'), { skipLocal: true });   // never the pasted-label parser: '30 g protein powder' is food, not a macro
        got = (res && res.items) || [];
      } catch (err) {
        if (/unauthorized|sign/i.test((err && err.message) || '')) signin = true;
        got = null;
      }
      if (!overlay.isConnected) return;   // the editor closed while the request was out
      batch.forEach(function (p, k) {
        var it = byId(p.x.id);
        // the row is gone, changed while we were away, or the user typed a figure: leave it
        if (!it || it._manual || it._auto !== 'sent' || (it.name + '|' + it.qty) !== p.x.key) return;
        var m = null;
        if (got) {
          if (got.length === batch.length) m = got[k];
          else { var n = normName(it.name); m = got.find(function (g) { var gn = normName(g.name); return gn && (gn.indexOf(n) !== -1 || n.indexOf(gn) !== -1); }) || null; }
        }
        if (m && (m.calories || m.protein || m.carbs || m.fat)) fill(it, m, 'ai');
        else { settle(it, 'fail', signin ? 'signin' : 'ai'); failed.push(it.name); }
      });
    }
    drawTotals(); syncSubtitle();
    if (signin) showToast(t('rec_auto_signin'));
    else if (failed.length) showToast(t('rec_auto_fail').replace('{name}', failed.join('، ')));
    finishSaveIfWanted(!failed.length && !signin);
  }

  // ---- delegated events: bound once, never re-bound ------------------------
  host.addEventListener('input', function (e) {
    var inp = e.target;
    var f = inp.dataset ? inp.dataset.f : null;
    if (!f) return;
    var it = itemOf(inp); if (!it) return;
    if (f === 'name' || f === 'qty') {
      it[f] = inp.value;
      scheduleAuto(it);
      updateSummary(it);
    } else {
      it[f] = parseFloat(inp.value) || 0;
      // A figure typed by hand is the user's number: never overwritten. Only
      // the explicit "compute again" button clears this.
      it._manual = true; it._auto = null; it._src = 'manual'; it._why = null;
      updateSummary(it);
    }
    saveWanted = false; setWaiting(false);
    drawTotals(); syncSubtitle();
  });
  host.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-toggle],[data-del],[data-retry],[data-recompute]') : null;
    if (!el) return;
    var it = itemOf(el); if (!it) return;
    if (el.hasAttribute('data-toggle')) { setOpen(it, !rowOf(it).classList.contains('is-open')); return; }
    if (el.hasAttribute('data-del')) { removeRow(it); return; }
    if (el.hasAttribute('data-retry')) { it._auto = null; it._why = null; scheduleAuto(it, true); return; }
    if (el.hasAttribute('data-recompute')) {
      it._manual = false; it._src = null; it._why = null; it._auto = null;
      it.calories = 0; it.protein = 0; it.carbs = 0; it.fat = 0;
      var row = rowOf(it);
      ['calories', 'protein', 'carbs', 'fat'].forEach(function (f) { var i2 = row.querySelector('input[data-f="' + f + '"]'); if (i2) i2.value = ''; });
      scheduleAuto(it, true); drawTotals(); syncSubtitle();
    }
  });
  // Leaving a row is what arms a WEIGHTLESS row's estimate — see scheduleAuto.
  // A null relatedTarget (tapped a non-focusable area, or the window lost focus)
  // counts as leaving: the row is not being worked on either way. Bound once,
  // like the other three; focusout bubbles, blur does not.
  host.addEventListener('focusout', function (e) {
    var row = e.target.closest ? e.target.closest('.rec-row') : null;
    if (!row) return;
    if (e.relatedTarget && row.contains(e.relatedTarget)) return;   // still inside this row
    var it = itemOf(row); if (!it) return;
    scheduleAuto(it, true);
  });
  host.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var inp = e.target; var f = inp.dataset ? inp.dataset.f : null;
    if (!f) return;
    e.preventDefault();   // there is no <form> here; this only moves focus
    var it = itemOf(inp); var row = rowOf(it); if (!it || !row) return;
    var focus = function (sel, node) { var el = (node || row).querySelector(sel); if (el) el.focus(); };
    if (f === 'name') { focus('[data-f="qty"]'); return; }
    if (f === 'qty') {
      var next = row.nextElementSibling;
      if (next) { var n2 = next.querySelector('[data-f="name"]'); if (n2) n2.focus(); }
      else addRow();
      return;
    }
    var order = ['calories', 'protein', 'carbs', 'fat'];
    var i = order.indexOf(f);
    if (i >= 0 && i < order.length - 1) focus('[data-f="' + order[i + 1] + '"]');
    else if (i === order.length - 1) { setOpen(it, false); focus('.rec-sum'); }
  });

  function removeRow(it) {
    var at = items.indexOf(it); if (at < 0) return;
    items.splice(at, 1);
    var row = rowOf(it); if (row) row.remove();
    // Never leave the sheet with zero rows — an empty editor gives the user
    // nothing to type into and no way back to a row.
    if (!items.length) { var fresh = newItem(); items.push(fresh); appendRow(fresh); }
    drawTotals(); syncSubtitle();
    showToast(t('rec_removed').replace('{name}', String(it.name || '').trim() || t('rec_ing_name')), {
      actionLabel: t('undo'),
      onAction: function () {
        // A row deleted mid-flight had its reply skipped, so it would come back
        // stuck on 'sent' and block every save with nothing on screen to explain
        // it. Re-arm it instead.
        if (it._auto === 'pending' || it._auto === 'sent') { it._auto = null; }
        items.splice(Math.min(at, items.length), 0, it);
        drawRows();
        scheduleAuto(it);
      },
    });
  }

  // ---- servings + save -----------------------------------------------------
  var servInput = overlay.querySelector('#rec-servings');
  servInput.addEventListener('input', function () {
    servInput.setAttribute('aria-label', servLabel(servInput.value));
    drawTotals();
  });
  overlay.querySelector('#rec-totals').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-step]') : null;
    if (!b) return;
    var v = Math.min(99, Math.max(1, (parseInt(servInput.value, 10) || 1) + Number(b.dataset.step)));
    servInput.value = v;
    servInput.setAttribute('aria-label', servLabel(v));
    drawTotals();
  });
  overlay.querySelector('#rec-add').addEventListener('click', addRow);
  overlay.querySelector('#rec-name').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var first = host.querySelector('[data-f="name"]');
    if (first) first.focus();
  });

  function setWaiting(on) {
    var b = overlay.querySelector('#rec-save');
    if (!b) return;
    b.classList.toggle('is-waiting', !!on);
    b.textContent = on ? t('rec_save_wait') : t('rec_save');
  }
  function finishSaveIfWanted(ok) {
    if (!saveWanted) return;
    saveWanted = false; setWaiting(false);
    if (ok) trySave();
  }
  function trySave() {
    var nm = overlay.querySelector('#rec-name').value.trim();
    var n = Math.max(1, parseInt(servInput.value, 10) || 1);
    // A row still being worked out must not be saved as zeros. Instead of a bare
    // refusal the intent is REMEMBERED, said out loud on the button, and spent
    // when the figures land — any keystroke cancels it.
    // Tapping save is leaving every row. On iOS a button does not take focus, so
    // focusout may never have fired for the row still under the thumb: arm any
    // weightless row here and let the pending branch below WAIT for it, instead
    // of refusing it for having no figures.
    items.forEach(function (it) { scheduleAuto(it, true); });   // scheduleAuto owns which rows may be armed
    var pend = items.filter(function (it) { return it._auto === 'pending' || it._auto === 'sent'; });
    if (pend.length) {
      saveWanted = true; setWaiting(true);
      var r = rowOf(pend[0]); if (r) r.scrollIntoView({ block: 'center' });
      showToast(t('rec_auto_wait'));
      return;
    }
    // DB.recipes.add's clean() keeps a row on 'name || calories || …', so a
    // NAMED row with four zeros saves as zeros and the recipe under-counts
    // forever — and perServing is what the food log receives. A row the user
    // deliberately zeroed carries _manual and passes.
    var blank = items.filter(function (it) { return String(it.name || '').trim() && !hasFigures(it) && !it._manual; });
    if (blank.length) {
      showToast(t('rec_need_figs').replace('{name}', String(blank[0].name).trim()));
      setOpen(blank[0], true);
      return;
    }
    var payload = { name: nm, servings: n, items: items.map(function (it) {
      var c = Object.assign({}, it);
      delete c._auto; delete c._manual; delete c._id; delete c._src; delete c._why;
      return c;
    }) };
    var made = existing ? DB.recipes.update(existing.id, payload) : DB.recipes.add(payload);
    if (!made) { showToast(t(DB.saveState().ok ? 'rec_need_ing' : 'sc_failed')); return; }
    closeModal();
    showToast(t('rec_saved'));
    if (typeof onDone === 'function') onDone();
  }
  overlay.querySelector('#rec-save').addEventListener('click', trySave);

  drawRows();
  // A new recipe wants the name; an existing one must NOT pop a keyboard over
  // figures the user came to read.
  if (!existing) setTimeout(function () { var el = overlay.querySelector('#rec-name'); if (el) el.focus(); }, 60);
}
// ===========================================================================
// Saved-food picker — the old "reference library" as an add-method. Search
// your saved foods + presets, tap to log to today. Long-press-free: tap = add.
// ===========================================================================
function openSavedFoodPicker(date, onSave, initialTab) {
  let query = '';
  let tab = (initialTab === 'recipes' || initialTab === 'bundles') ? initialTab : 'foods';
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_saved')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="sfp-tabs" role="tablist">
      <button type="button" class="sfp-tab${tab === 'foods' ? ' on' : ''}" id="sf-tab-foods" data-tab="foods" role="tab" aria-selected="${tab === 'foods'}" aria-controls="sf-list">${t('tab_saved_foods')}</button>
      <button type="button" class="sfp-tab${tab === 'bundles' ? ' on' : ''}" id="sf-tab-bundles" data-tab="bundles" role="tab" aria-selected="${tab === 'bundles'}" aria-controls="sf-list">${t('tab_bundles')}</button>
      <button type="button" class="sfp-tab${tab === 'recipes' ? ' on' : ''}" id="sf-tab-recipes" data-tab="recipes" role="tab" aria-selected="${tab === 'recipes'}" aria-controls="sf-list">${t('tab_recipes')}</button>
    </div>
    <div class="search-wrap" id="sf-search-wrap" style="margin-bottom:10px">
      ${icon('search', 20)}
      <input type="search" id="sf-search" placeholder="${t('search_foods')}">
    </div>
    <div class="picker-list" id="sf-list" role="tabpanel" aria-labelledby="sf-tab-${tab}"></div>
    <button class="btn btn-ghost btn-block" id="sf-new" style="margin-top:10px">${icon('plus', 20)} ${tab === 'bundles' ? t('bundle_new') : tab === 'recipes' ? t('rec_new') : t('saved_new')}</button>
  `);
  guardConvenienceModal(overlay);
  const listEl = overlay.querySelector('#sf-list');

  // ---- "My recipes" — the computed ones ------------------------------------
  function drawRecipes() {
    const q = String(query || '').trim().toLowerCase();
    const recs = DB.recipes.list().filter((r) => !q || String(r.name || '').toLowerCase().includes(q));
    if (!recs.length) {
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${DB.recipes.list().length ? t('no_matches_simple') : t('rec_empty')}</div>`;
      return;
    }
    listEl.innerHTML = recs.map((r) => {
      const per = DB.recipes.perServing(r);
      return `
      <div class="bundle-card">
        <button type="button" class="bundle-main" data-view-rec="${escapeHtml(r.id)}">
          <div class="bundle-name">${escapeHtml(r.name)}</div>
          <div class="bundle-meta"><span class="num">${fmtNum(r.items.length)}</span> ${t('rec_u_ing')} ·
            <span class="num">${fmtNum(r.servings)}</span> ${t('rec_u_serv')} ·
            <span class="num">${fmtNum(per.calories)}</span> ${t('cal')} ${t('rec_u_per')}</div>
        </button>
        <button type="button" class="btn btn-primary bundle-add" data-log-rec="${escapeHtml(r.id)}" aria-label="${escapeHtml(t('add'))}">${icon('plus', 16)}</button>
        <button type="button" class="icon-btn" data-edit-rec="${escapeHtml(r.id)}" aria-label="${escapeHtml(t('rec_edit'))}">${icon('edit', 16)}</button>
        <button type="button" class="icon-btn danger" data-del-rec="${escapeHtml(r.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
      </div>`;
    }).join('');

    // Logging a recipe logs ONE SERVING as a single row — not the ingredients.
    // The ingredients are how the number was reached; the meal you ate is the
    // row, and splitting it into six would make the day's list unreadable.
    listEl.querySelectorAll('[data-log-rec]').forEach((b) => b.addEventListener('click', () => {
      // The bundle button's own guard: a double-tap is two rows, and this
      // sheet stays open by design. 800ms blocks the repeat, not a later
      // deliberate second log of the same recipe.
      if (b.disabled) return;
      b.disabled = true; setTimeout(() => { b.disabled = false; }, 800);
      const r = DB.recipes.list().find((x) => x.id === b.dataset.logRec);
      if (!r) return;
      const per = DB.recipes.perServing(r);
      const result = DB.foodLogs.addMany(date || todayISO(), [{
        name: r.name, servings: 1,
        calories: per.calories, protein: per.protein, carbs: per.carbs, fat: per.fat,
        source: 'recipe',
      }]);
      if (!result.ok) { convenienceError(result); return; }
      if (typeof onSave === 'function') onSave();
      offerUndo(t('rec_logged').replace('{name}', r.name), result);
    }));
    // THE NAME IS THE DOOR to the ingredients — the meal card's precedent
    // (v314): a person at the stove wants the list, and the row already has
    // three controls.
    listEl.querySelectorAll('[data-view-rec]').forEach((b) => b.addEventListener('click', () => {
      const r = DB.recipes.list().find((x) => x.id === b.dataset.viewRec);
      if (r) openRecipeView(date, r, onSave);
    }));
    listEl.querySelectorAll('[data-edit-rec]').forEach((b) => b.addEventListener('click', () => {
      const r = DB.recipes.list().find((x) => x.id === b.dataset.editRec);
      if (r) openRecipeEditor(date, r, () => openSavedFoodPicker(date, onSave, 'recipes'));
    }));
    listEl.querySelectorAll('[data-del-rec]').forEach((b) => b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_recipe_q'), text: '', confirmLabel: t('delete'), variant: 'danger',
        onConfirm: () => {
          const result = DB.recipes.remove(b.dataset.delRec);
          if (!result.ok) { convenienceError(result); return; }
          // NOT drawRecipes(): the confirm sheet replaced #modal-root, so this
          // closure's listEl is detached and the picker is already gone.
          openSavedFoodPicker(date, onSave, 'recipes');
          offerUndo(t('rec_deleted'), result);
        },
      });
    }));
  }

  // ---- "My meals" — several foods, one tap (فطوري المعتاد) -----------------
  function drawBundles() {
    const bundles = DB.mealBundles.list().filter(b => DB.search.normalize(b.name).includes(DB.search.normalize(query)));
    if (!bundles.length) {
      // "You have no meals" and "your search matched none of your meals" are
      // different facts. The other two tabs already tell them apart.
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${DB.mealBundles.list().length ? t('no_matches_simple') : t('bundle_empty')}</div>`;
      return;
    }
    listEl.innerHTML = bundles.map((b) => {
      const kcal = b.items.reduce((n, it) => n + it.calories * (it.servings || 1), 0);
      return `
      <div class="bundle-card" data-bundle="${escapeHtml(b.id)}">
        ${b.favorite ? `<span class="bundle-star" aria-label="${escapeHtml(t('cx_favorite'))}">★</span>` : ''}
        <button type="button" class="bundle-main" data-edit-bundle="${escapeHtml(b.id)}"${b.favorite ? ` aria-label="${escapeHtml(b.name + ' — ' + t('cx_favorite') + ' — ' + fmtNum(b.items.length) + ' ' + t('bundle_items') + ' — ' + fmtNum(Math.round(kcal)) + ' ' + t('cal'))}"` : ''}>
          <div class="bundle-name">${escapeHtml(b.name)}</div>
          <div class="bundle-meta"><span class="num">${fmtNum(b.items.length)}</span> ${t('bundle_items')} · <span class="num">${fmtNum(Math.round(kcal))}</span> ${t('cal')}</div>
        </button>
        <button type="button" class="btn btn-ghost bundle-portion" data-portion-bundle="${escapeHtml(b.id)}" aria-label="${escapeHtml(t('cx_portion') + ' ×1')}"><span class="num">×1</span></button>
        <button type="button" class="btn btn-primary bundle-add" data-log-bundle="${escapeHtml(b.id)}" aria-label="${escapeHtml(t('add'))}">${icon('plus', 16)}</button>
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-log-bundle]').forEach((btn) => btn.addEventListener('click', () => {
      const b = DB.mealBundles.list().find((x) => x.id === btn.dataset.logBundle);
      if (!b) return;
      btn.disabled = true;
      const result = DB.mealBundles.log(b.id,date || todayISO(),1,uid());
      if (result.ok && onSave) onSave();
      offerUndo(t('cx_meal_logged'),result);
      setTimeout(() => { btn.disabled = false; },800);
    }));
    listEl.querySelectorAll('[data-portion-bundle]').forEach(btn => btn.onclick = () => { const bundle = DB.mealBundles.list().find(b => b.id === btn.dataset.portionBundle); if (bundle) openMealPortion(bundle,date,onSave); });
    listEl.querySelectorAll('[data-edit-bundle]').forEach(btn => btn.onclick = () => {
      const bundle = DB.mealBundles.list().find(b => b.id === btn.dataset.editBundle);
      if (bundle) openMealEditor(bundle, () => openSavedFoodPicker(date, onSave, 'bundles'));
    });
  }

  function draw() {
    const q = DB.search.normalize(query);
    const saved = DB.foods.list();
    const list = q ? saved.filter(f => DB.search.normalize(f.name).includes(q)) : saved;
    if (!list.length) {
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${saved.length ? t('no_matches_simple') : t('saved_empty')}</div>`;
      return;
    }
    listEl.innerHTML = list.map((f,i) => `<button type="button" class="picker-row" data-add-saved="${i}">
      <span class="picker-row-cat" style="background:var(--cat-arms)"></span>
      <span class="picker-row-name">${escapeHtml(f.name)} · <span class="num">${fmtNum(f.calories)}</span> ${t('cal')}</span>
      <span class="picker-row-check">${icon('plus',16)}</span></button>`).join('');
    listEl.querySelectorAll('[data-add-saved]').forEach(button => button.onclick = () => {
      if (button.disabled) return;
      button.disabled = true; setTimeout(() => { button.disabled = false; }, 800);   // same guard as the bundle button
      const f = list[Number(button.dataset.addSaved)];
      const result = DB.foodLogs.addMany(date || todayISO(),[{name:f.name,servings:1,calories:f.calories,protein:f.protein,carbs:f.carbs,fat:f.fat || 0,source:'saved'}]);
      if (!result.ok) { convenienceError(result); return; }
      button.querySelector('.picker-row-check').innerHTML = icon('check',16);
      button.classList.add('picked');
      if (onSave) onSave(); offerUndo(t('ai_added'),result);
    });
  }
  // draw() rebuilds the whole list, so a per-keystroke rebuild repeats the same
  // expensive work for every character.
  const drawSavedFoodSearch = debounce(draw, 150);
  overlay.querySelector('#sf-search').addEventListener('input', (e) => {
    query = e.target.value;
    // Route by tab: this used to redraw the SAVED-FOODS list regardless, so
    // typing on the recipes tab replaced the recipes with foods mid-word.
    if (tab === 'recipes') drawRecipes();
    else if (tab === 'bundles') drawBundles();
    else drawSavedFoodSearch();
  });
  const newBtn = overlay.querySelector('#sf-new');
  newBtn.addEventListener('click', () => {
    if (tab === 'bundles') { openMealEditor(null, () => openSavedFoodPicker(date, onSave, 'bundles')); return; }
    if (tab === 'recipes') { openRecipeEditor(date, null, () => openSavedFoodPicker(date, onSave, 'recipes')); return; }
    closeModal(); openFoodLibraryModal();
  });
  // The search box was built once, from the FOODS tab, and never changed — so on
  // Recipes the empty field still read "Search foods…" while the list under it held
  // recipes. Every per-tab surface is set here; the click handler and the first
  // render both call it, so they cannot drift.
  const applyTab = () => {
    overlay.querySelectorAll('.sfp-tab').forEach((x) => {
      const on = x.dataset.tab === tab;
      x.classList.toggle('on', on);
      x.setAttribute('aria-selected', String(on));
    });
    const panel = overlay.querySelector('#sf-list');
    if (panel) panel.setAttribute('aria-labelledby', 'sf-tab-' + tab);
    const input = overlay.querySelector('#sf-search');
    if (input) input.placeholder = tab === 'bundles' ? t('sfp_search_bundles') : tab === 'recipes' ? t('sfp_search_recipes') : t('search_foods');
    overlay.querySelector('#sf-search-wrap').style.display = '';
    newBtn.innerHTML = icon('plus', 20) + ' ' +
      (tab === 'bundles' ? t('bundle_new') : tab === 'recipes' ? t('rec_new') : t('saved_new'));
  };
  overlay.querySelectorAll('.sfp-tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    applyTab();
    if (tab === 'bundles') drawBundles();
    else if (tab === 'recipes') drawRecipes();
    else draw();
  }));
  applyTab();
  if (tab === 'bundles') drawBundles();
  else if (tab === 'recipes') drawRecipes();
  else draw();
}

// ===========================================================================
// AI coach — reads what's LEFT for the day and suggests what to eat to hit it.
// Reuses the FoodAI text model; no new backend.
// ===========================================================================
// DORMANT (v219) — the AI meal coach. Its entry point on the Food screen was
// removed at the owner's request ("not this feature for now"), so nothing calls
// this any more. The implementation, its modal styles and its ten translated
// strings are deliberately kept rather than deleted, because "for now" is not
// "never" and re-translating is the expensive part.
//
// TO RESTORE: put the button back after ${waterCard} in the nutrition panel and
// re-add the one delegated line `if (e.target.closest('[data-coach]')) { openCoach(date); return; }`
// above the [data-add-water] branch. Nothing else was touched.
function openCoach(date) {
  const tgt = DB.nutrition.get().targets;
  const c = DB.foodLogs.totalsForDate(date);
  const left = {
    calories: Math.max(0, Math.round(tgt.calories - c.calories)),
    protein: Math.max(0, Math.round(tgt.protein - c.protein)),
    carbs: Math.max(0, Math.round(tgt.carbs - c.carbs)),
    fat: Math.max(0, Math.round(tgt.fat - c.fat)),
  };
  const lang = DB.prefs.get().lang || 'en';
  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('coach_title')}</div>
        <div class="modal-subtitle">${t('coach_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="coach-remaining">
      <span>${t('nutri_left')}: <b class="num">${fmtNum(left.calories)}</b> ${t('cal')}</span>
      <span><b class="num">${fmtNum(left.protein)}</b>g ${t('protein_label')}</span>
    </div>
    <div id="coach-body" class="coach-body"><div class="ai-dots">${t('coach_thinking')}</div></div>
  `);
  const body = overlay.querySelector('#coach-body');
  const prompt = (lang === 'ar'
    ? `أنا أتتبع سعراتي. باقي لي اليوم: ${left.calories} سعرة، ${left.protein}غ بروتين، ${left.carbs}غ كارب، ${left.fat}غ دهون. اقترح ٣ وجبات أو سناكات واقعية تناسب المتبقي تقريباً، كل واحدة بسطر واحد مع سعراتها التقريبية. بالعربي، بدون مقدمة.`
    : `I track my macros. Remaining today: ${left.calories} kcal, ${left.protein}g protein, ${left.carbs}g carbs, ${left.fat}g fat. Suggest 3 realistic meals or snacks that fit the remainder, each on one line with approx calories. No preamble.`);
  // Already at / over the goal → no point asking the AI for "0 calories" of food.
  if (left.calories <= 50) { body.innerHTML = `<div class="coach-done">${t('coach_goal_met')}</div>`; return; }
  if (!window.FoodAI || !FoodAI.ask) { body.innerHTML = `<div class="ai-err">${t('coach_unavailable')}</div>`; return; }
  FoodAI.ask(prompt)
    .then((txt) => {
      // A blank reply usually means the AI backend isn't reachable yet (e.g. the
      // Worker hasn't been redeployed) — show a clear message, never an empty box.
      const clean = String(txt || '').trim();
      body.innerHTML = clean
        ? `<div class="coach-text">${escapeHtml(clean).replace(/\n/g, '<br>')}</div>`
        : `<div class="ai-err">${t('coach_unavailable')}</div>`;
    })
    .catch((e) => { body.innerHTML = `<div class="ai-err">${escapeHtml((e && e.message) || t('ai_error'))}</div>`; });
}

// ===========================================================================
// Voice capture — record, transcribe + analyse via FoodAI, add to today's log.
// getUserMedia works in a browser and in an Android WebView that has been
// granted RECORD_AUDIO (needs the newer APK). Every failure is caught and shown.
// ===========================================================================
function openVoiceCapture(date, onSave) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_voice')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="voice-stage" id="voice-stage">
      <button class="voice-mic" id="voice-mic" aria-label="${escapeHtml(t('voice_tap'))}">${icon('mic', 22)}</button>
      <div class="voice-status" id="voice-status">${t('voice_tap')}</div>
    </div>
    <div class="ai-results" id="voice-results"></div>
  `);
  const micBtn = overlay.querySelector('#voice-mic');
  const status = overlay.querySelector('#voice-status');
  const results = overlay.querySelector('#voice-results');
  let recorder = null, chunks = [], stream = null, recording = false;

  const setStatus = (s) => { if (status) status.textContent = s; };

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(t('voice_unsupported')); return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Give an honest, context-correct message. No mic hardware → say so. Else
      // it's a permission block, and the fix differs by platform: the installed
      // APP gets Android's own system prompt (allow it), while the BROWSER/PWA
      // controls the mic through the browser's own site settings.
      const name = err && err.name;
      const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
      setStatus((name === 'NotFoundError' || name === 'DevicesNotFoundError')
        ? t('voice_no_mic')
        : (isNative ? t('voice_denied') : t('voice_denied_web')));
      return;
    }
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onStop;
    recorder.start();
    recording = true;
    micBtn.classList.add('recording');
    setStatus(t('voice_listening'));
  }

  function stop() {
    if (recorder && recording) { recording = false; recorder.stop(); }
    if (stream) stream.getTracks().forEach((tk) => tk.stop());
    micBtn.classList.remove('recording');
  }

  async function onStop() {
    setStatus(t('voice_processing'));
    const blob = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
    if (!blob.size) { setStatus(t('voice_tap')); return; }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
      });
      const b64 = String(dataUrl).split(',')[1];
      const mimeType = String(dataUrl).slice(5, String(dataUrl).indexOf(';'));
      if (!window.FoodAI || !FoodAI.analyzeAudio) throw new Error(t('voice_unsupported'));
      const { items, transcript } = await FoodAI.analyzeAudio({ mimeType, data: b64 });
      if (!document.body.contains(overlay)) return; // modal was closed mid-request
      if (transcript) setStatus('“' + transcript + '”'); else setStatus(t('voice_tap'));
      if (!items || !items.length) { results.innerHTML = `<div class="ai-decline">${t('ai_not_food')}</div>`; return; }
      renderVoiceResults(items);
    } catch (e) {
      setStatus((window.FoodAI && FoodAI.friendlyErr) ? FoodAI.friendlyErr(e) : ((e && e.message) || t('ai_error')));
    }
  }

  function renderVoiceResults(items) {
    results.innerHTML = items.map((it, i) => `
      <div class="ai-card" data-vr="${i}" data-mult="1"
        data-bcal="${it.calories}" data-bpro="${it.protein}" data-bcarb="${it.carbs}" data-bfat="${it.fat}">
        <div class="ai-card-name">${escapeHtml(it.name)}</div>
        <div class="ai-portion">
          <button type="button" class="ai-portion-btn" data-step="-1" aria-label="${escapeHtml(t('portion_less'))}">${icon('minus', 16)}</button>
          <span class="ai-portion-val"><span class="num">1</span>×</span>
          <button type="button" class="ai-portion-btn" data-step="1" aria-label="${escapeHtml(t('portion_more'))}">${icon('plus', 16)}</button>
        </div>
        <div class="ai-macros">
          <span class="ai-macro cal"><b class="num" data-m="cal">${fmtNum(it.calories)}</b>${t('cal')}</span>
          <span class="ai-macro pro"><b class="num" data-m="pro">${fmtNum(it.protein)}</b>g ${t('protein_label')}</span>
          <span class="ai-macro carb"><b class="num" data-m="carb">${fmtNum(it.carbs)}</b>g ${t('carbs_label')}</span>
          <span class="ai-macro fat"><b class="num" data-m="fat">${fmtNum(it.fat)}</b>g ${t('fat_label')}</span>
        </div>
      </div>`).join('') +
      `<button class="btn btn-primary btn-block" id="voice-addall">${icon('plus', 20)} ${t('ai_add_all')} (${fmtNum(items.length)})</button>`;

    const applyPortion = (card) => {
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
    };
    // Bind the portion delegate ONCE. `results` (#voice-results) is a persistent
    // node — only its innerHTML is replaced — so re-recording used to stack a
    // second, third… listener on the same element, and one tap on +/− then moved
    // the portion by 0.25 × (number of recordings). It reads only DOM state, so a
    // single delegated listener serves every re-render.
    if (!results.dataset.portionBound) {
      results.dataset.portionBound = '1';
      results.addEventListener('click', (e) => {
        const btn = e.target.closest('.ai-portion-btn');
        if (!btn) return;
        const card = btn.closest('.ai-card');
        if (!card) return;
        let mult = (parseFloat(card.dataset.mult) || 1) + (parseInt(btn.dataset.step, 10) || 0) * 0.25;
        mult = Math.max(0.25, Math.min(20, Math.round(mult * 100) / 100));
        card.dataset.mult = mult;
        applyPortion(card);
      });
    }

    results.querySelector('#voice-addall').addEventListener('click', () => {
      const scaled = items.map((it, i) => {
        const card = results.querySelector(`.ai-card[data-vr="${i}"]`);
        const mult = card ? (parseFloat(card.dataset.mult) || 1) : 1;
        return Object.assign({}, it, { source: 'voice', servings: mult });
      });
      logNutritionItems(date, scaled, onSave);
      showToast(t('ai_added'));
      closeModal();
    });
  }

  micBtn.addEventListener('click', () => { recording ? stop() : start(); });
  // Stop the mic when the modal is dismissed by ANY path — the X button,
  // a backdrop tap, or the Escape key all clear #modal-root, so watch for the
  // overlay leaving the DOM and release the microphone then. (A click-only
  // listener missed backdrop/Escape, leaving the mic live — a privacy leak.)
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) {
    const mo = new MutationObserver(() => {
      if (!document.body.contains(overlay)) { stop(); mo.disconnect(); }
    });
    mo.observe(modalRoot, { childList: true, subtree: true });
  }
}

// Split a serving string ("١٠٠غ", "3 حبات", "1 slice") into a numeric amount
// and a unit label. Arabic-Indic digits are normalised. No leading number → 1.
function parseServing(serving) {
  const str = String(serving || '').trim();
  const norm = str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const m = norm.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (m) return { amount: parseFloat(m[1]), unit: m[2].trim() };
  return { amount: 1, unit: str };
}

function openFoodModal(foodId = null) {
  const existing = foodId ? DB.foods.list().find((f) => f.id === foodId) : null;
  const parsed = parseServing(existing ? existing.serving : '');
  const baseAmount = existing ? (parsed.amount || '') : '';
  const baseUnit = existing ? parsed.unit : '';
  // Per-unit macros — used to live-recalculate when the amount is edited.
  // All FOUR macros. Fat was left out, so changing 100 g → 200 g doubled
  // calories/protein/carbs and kept the old fat — then persisted it, and every
  // later one-tap add re-logged the wrong figure.
  const per = { cal: 0, pro: 0, carb: 0, fat: 0 };
  if (existing) {
    const a = parsed.amount || 1;
    per.cal = existing.calories / a;
    per.pro = existing.protein / a;
    per.carb = existing.carbs / a;
    per.fat = (existing.fat || 0) / a;
  }
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_food') : t('new_food')}</div>
        <div class="modal-subtitle">${t('food_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="food-name" placeholder="${t('ph_food_name')}" value="${existing ? escapeHtml(existing.name) : ''}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('amount_label')}</label>
        <input type="number" inputmode="decimal" id="food-amount" step="1" min="0" value="${numAttr(baseAmount)}" placeholder="100">
      </div>
      <div class="form-group">
        <label class="form-label">${t('serving_unit_label')}</label>
        <input type="text" id="food-unit" value="${escapeHtml(baseUnit)}" placeholder="${t('unit_hint')}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="decimal" id="food-cal" step="1" min="0" value="${numAttr(existing && existing.calories)}" placeholder="165">
      </div>
      <div class="form-group">
        <label class="form-label">${t('protein_g')}</label>
        <input type="number" inputmode="decimal" id="food-pro" step="0.1" min="0" value="${numAttr(existing && existing.protein)}" placeholder="31">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('carbs_g')}</label>
        <input type="number" inputmode="decimal" id="food-carb" step="0.1" min="0" value="${numAttr(existing && existing.carbs)}" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">${t('fat_label')} (g)</label>
        <input type="number" inputmode="decimal" id="food-fat" step="0.1" min="0" value="${numAttr(existing && existing.fat)}" placeholder="0">
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-food-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  // Edit the amount → live-recalculate calories/protein/carbs from per-unit.
  $('#food-amount')?.addEventListener('input', () => {
    const a = Number($('#food-amount').value);
    if (!a || (!per.cal && !per.pro && !per.carb && !per.fat)) return;
    $('#food-cal').value = Math.round(per.cal * a);
    $('#food-pro').value = Math.round(per.pro * a * 10) / 10;
    $('#food-carb').value = Math.round(per.carb * a * 10) / 10;
    const fatEl = $('#food-fat'); if (fatEl) fatEl.value = Math.round(per.fat * a * 10) / 10;
  });

  $('#save-food-btn').addEventListener('click', () => {
    const name = $('#food-name').value.trim();
    const amount = $('#food-amount').value.trim();
    const unit = $('#food-unit').value.trim();
    const serving = [amount, unit].filter(Boolean).join(' ');
    const calories = Number($('#food-cal').value);
    const protein = Number($('#food-pro').value);
    const carbs = Number($('#food-carb').value);
    const fat = Number($('#food-fat').value);
    if (!name) { showToast(t('enter_name')); return; }
    if (existing) {
      DB.foods.update(existing.id, { name, serving, calories, protein, carbs, fat });
      showToast(t('updated'));
    } else {
      DB.foods.add({ name, serving, calories, protein, carbs, fat });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });

  setTimeout(() => $('#food-name')?.focus(), 60);
}

// Quick-add picker: the built-in food catalog shown as small rectangular
// chips, grouped by category, searchable. Tapping a chip adds it to the
// reference list. A footer button falls back to the manual entry form.
function openFoodLibraryModal() {
  function buildSections() {
    const existing = new Set(DB.foods.list().map((f) => f.name.trim().toLowerCase()));
    const presets = allFoodPresets();
    return allFoodCatOrder().map((cat) => {
      const chips = presets
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p.cat === cat)
        .map(({ p, idx }) => {
          const name = foodPresetName(p);
          // Detect an already-added preset in EITHER language so switching the
          // UI language can't create a duplicate of the same food.
          const added = existing.has(name.trim().toLowerCase())
            || existing.has(String(p.en).trim().toLowerCase())
            || existing.has(String(p.ar).trim().toLowerCase());
          return `
            <button type="button" class="food-lib-chip${added ? ' added' : ''}" data-preset="${idx}" ${added ? 'disabled' : ''}>
              <span class="flc-name">${escapeHtml(name)}</span>
              <span class="flc-cal"><span class="num">${fmtNum(p.cal)}</span> ${t('cal')}</span>
              <span class="flc-check">${icon('check', 16)}</span>
            </button>`;
        }).join('');
      if (!chips) return '';
      return `
        <div class="food-lib-section">
          <div class="food-lib-cat">${t('fcat_' + cat)}</div>
          <div class="food-lib-grid">${chips}</div>
        </div>`;
    }).join('');
  }

  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('food_library_title')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="search-wrap food-lib-search">
      ${icon('search', 20)}
      <input type="search" id="food-lib-search" placeholder="${t('search_foods')}">
    </div>

    <div class="food-lib-body" id="food-lib-body">
      ${buildSections()}
      <div id="food-lib-empty" style="display:none">${emptyState({ iconName: 'search', title: t('no_matches_simple') })}</div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost btn-block" id="food-lib-manual">${icon('plus', 20)} ${t('add_manually')}</button>
    </div>
  `);

  const body = overlay.querySelector('#food-lib-body');
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.food-lib-chip');
    if (!btn || btn.classList.contains('added')) return;
    const p = allFoodPresets()[Number(btn.dataset.preset)];
    if (!p) return;
    // `fat` was missing here entirely, so every preset added a food with 0 fat
    // no matter what it actually contains — nuts, peanut butter and whole milk
    // all landed as fat-free, and the fat target on the Food screen could never
    // be filled from the library. Older presets carry no `f` yet; `|| 0` keeps
    // them behaving exactly as before.
    DB.foods.add({
      name: foodPresetName(p), serving: foodPresetServing(p),
      calories: p.cal, protein: p.pro, carbs: p.carb, fat: p.f || 0,
    });
    btn.classList.add('added');
    btn.disabled = true;
    showToast(t('saved'));
    renderView(currentView);
  });

  overlay.querySelector('#food-lib-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let anyVisible = false;
    overlay.querySelectorAll('.food-lib-chip').forEach((c) => {
      const nm = c.querySelector('.flc-name').textContent.toLowerCase();
      const show = !q || nm.includes(q);
      c.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });
    overlay.querySelectorAll('.food-lib-section').forEach((sec) => {
      const any = [...sec.querySelectorAll('.food-lib-chip')].some((c) => c.style.display !== 'none');
      sec.style.display = any ? '' : 'none';
    });
    const empty = overlay.querySelector('#food-lib-empty');
    if (empty) empty.style.display = anyVisible ? 'none' : '';
  });

  overlay.querySelector('#food-lib-manual').addEventListener('click', () => {
    closeModal();
    openFoodModal();
  });
}

function openMealEditor(existing = null, onSave = () => {}) {
  const owner = Cloud.getLastUid();
  const snapshot = existing && JSON.stringify(existing);
  let items = existing ? copyData(existing.items) : [];
  const foods = [...DB.foods.list(), ...DB.foodLogs.listForDate(todayISO())];
  const modal = convenienceModal(`${cxHeader('cx_meals')}<div class="cx-stack">
    <label>${t('cx_name')}<input class="input" id="cx-meal-name" maxlength="80" dir="auto" value="${escapeHtml(existing?.name || '')}"></label>
    <!-- .cx-row, because .cx-stack label is a flex COLUMN: a bare checkbox label
         put the box on its own line with its name stranded underneath in caption
         grey. .cx-stack label.cx-row restores the row, and the <span> is what
         picks up the flex:1 that .cx-row grants only to a span or a label. -->
    <label class="cx-row"><span>${t('cx_favorite')}</span><input type="checkbox" id="cx-favorite" ${existing?.favorite ? 'checked' : ''}></label>
    <div id="cx-meal-items"></div>
    <label>${t('cx_saved_food')}<select id="cx-food" class="input"><option value="">—</option>${foods.map((f,i) => `<option value="${i}">${escapeHtml(f.name)}</option>`).join('')}</select></label>
    <button class="btn btn-ghost" id="cx-food-add">${t('add')}</button>
    <button class="btn btn-primary" id="cx-meal-save">${t('save')}</button>
    ${existing ? `<button class="btn btn-danger" id="cx-meal-delete">${t('delete')}</button>` : ''}</div>`);
  const draw = () => {
    const kcal = (it) => `<span class="num">${escapeHtml(fmtNum(Math.round(Number(it.calories || 0) * Number(it.servings || 1))))}</span> ${escapeHtml(t('cal'))}`;
    modal.querySelector('#cx-meal-items').innerHTML = items.map((it,i) => `<div class="cx-row"><span>${escapeHtml(it.name)}<br><small data-kcal="${i}">${kcal(it)}</small></span>
      <label>${t('cx_portion')}<input class="input" type="number" min="0.25" max="20" step="0.25" data-portion="${i}" value="${Number(it.servings || 1)}"></label>
      <button class="icon-btn danger" data-remove="${i}" aria-label="${escapeHtml(t('delete'))}">${icon('trash',18)}</button></div>`).join('');
    // Patched in place rather than redrawn: a redraw on every keystroke would
    // take the caret out of the field being typed in.
    modal.querySelectorAll('[data-portion]').forEach(input => {
      const i = Number(input.dataset.portion), it = items[i];
      const cell = () => modal.querySelector(`[data-kcal="${i}"]`);
      const paint = (html) => { const el = cell(); if (el) el.innerHTML = html; };
      input.oninput = () => {
        // A number input reports '' for anything it cannot parse ('.', '-', 'abc'),
        // so this one test covers every unreadable state.
        const v = Number(input.value);
        const ok = input.value !== '' && Number.isFinite(v) && v > 0 && v <= 20;
        if (ok) it.servings = v;
        paint(ok ? kcal(it) : escapeHtml(t('cx_portion_unset')));
      };
      // Leaving the field CLAMPS rather than reverting. Typing 25 used to snap
      // silently back to the old figure and erase the hint in the same breath, so
      // nothing on screen recorded that anything had been refused; 20 on screen
      // says what happened. Only an unreadable field falls back to the last value.
      input.onchange = () => {
        const v = Number(input.value);
        if (input.value !== '' && Number.isFinite(v) && v > 0) it.servings = Math.min(20, Math.max(0.25, v));
        input.value = it.servings;
        paint(kcal(it));
      };
    });
    modal.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { items.splice(Number(b.dataset.remove),1); draw(); });
  };
  draw();
  modal.querySelector('#cx-food-add').onclick = () => {
    const index = modal.querySelector('#cx-food').value;
    if (index === '' || items.length >= 30) return;
    const food = foods[Number(index)];
    items.push({ name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, servings: food.servings || 1 }); draw();
  };
  modal.querySelector('#cx-meal-save').onclick = () => {
    if (owner !== Cloud.getLastUid() || existing && snapshot !== JSON.stringify(DB.mealBundles.list().find(b => b.id === existing.id))) { convenienceError({code:'STALE'}); return; }
    const result = DB.mealBundles.update(existing?.id || null, { name: modal.querySelector('#cx-meal-name').value, favorite: modal.querySelector('#cx-favorite').checked, items });
    if (!result.ok) { convenienceError(result); return; }
    closeModal(); onSave(); offerUndo(t('saved'), result);
  };
  // Deleting a saved meal used to be an icon on the card, one 8px gap from the
  // button that LOGS it. It belongs with the meal's other whole-object actions,
  // behind the deliberate step of opening it.
  modal.querySelector('#cx-meal-delete')?.addEventListener('click', () => {
    confirmDialog({
      title: t('delete_meal_q'), text: '', confirmLabel: t('delete'), variant: 'danger',
      onConfirm: () => {
        if (owner !== Cloud.getLastUid()) { convenienceError({ code: 'STALE' }); return; }
        const result = DB.mealBundles.remove(existing.id);
        if (!result.ok) { convenienceError(result); return; }
        closeModal(); onSave(); offerUndo(t('bundle_deleted'), result);
      },
    });
  });
}
function openMealPortion(bundle, date, onSave) {
  const owner = Cloud.getLastUid(), operationId = uid();
  const modal = convenienceModal(`${cxHeader('cx_meals')}<div class="cx-stack"><strong>${escapeHtml(bundle.name)}</strong>
    <label>${t('cx_date')}<input class="input" id="cx-log-date" type="date" value="${escapeHtml(date || todayISO())}"></label>
    <label>${t('cx_portion')}<input class="input" id="cx-log-portion" type="number" min="0.25" max="20" step="0.25" value="1"></label>
    <p id="cx-log-total" class="settings-hint"></p><button class="btn btn-primary" id="cx-log-meal">${t('add')}</button></div>`);
  const amount = modal.querySelector('#cx-log-portion');
  const preview = () => { modal.querySelector('#cx-log-total').textContent = fmtNum(Math.round(bundle.items.reduce((sum,it) => sum + it.calories * (it.servings || 1),0) * Number(amount.value))) + ' ' + t('cal'); };
  amount.oninput = preview; preview();
  modal.querySelector('#cx-log-meal').onclick = e => {
    if (owner !== Cloud.getLastUid() || JSON.stringify(bundle) !== JSON.stringify(DB.mealBundles.list().find(b => b.id === bundle.id))) { convenienceError({code:'STALE'}); return; }
    e.currentTarget.disabled = true;
    const result = DB.mealBundles.log(bundle.id, modal.querySelector('#cx-log-date').value, Number(amount.value), operationId);
    if (!result.ok) { e.currentTarget.disabled = false; convenienceError(result); return; }
    closeModal(); if (onSave) onSave(); offerUndo(t('cx_meal_logged'), result);
  };
}

// ===========================================================================
// THE ONE RUNNING SHOPPING LIST  (v329)
//
// «عدل الميزه من اساسها جذريا خليها اسهل وابسط وتاخذ المكونات من وصفاتي»
//
// It replaces FIVE sheets with one. The old route was: lists → create → set
// servings per source → a pencil → quantity + unit + a free-text "matching
// ingredient ID" + preparation → review → a seven-control editor per item →
// name the list → save → the checklist. Measured in the owner's own data before
// this was written: recipes carrying purchase data ZERO, ingredient IDs typed
// ZERO, lists ever saved ZERO. The machinery existed to let combine() merge, and
// combine() merged only on the one field nobody ever filled in.
//
// There is no create, no name, no list-of-lists. Recipes and meals are chips
// that pour their ingredient NAMES in. Amounts are the recipe's own words,
// carried as a caption and joined as text — never parsed, never scaled, never
// added up.
// ===========================================================================
function openShoppingList() {
  const owner = Cloud.getLastUid();
  const sources = [
    ...DB.recipes.list().map((x) => ({ id: x.id, name: x.name, type: 'recipe' })),
    ...DB.mealBundles.list().map((x) => ({ id: x.id, name: x.name, type: 'meal' })),
  ];
  // THE TWO NAMED BOXES (v332). «ليش ما نحطهم بخانه اسمها … عشان تكون ارتب».
  // Measured on the owner's own data at 375x812 BEFORE this was written: 10
  // sources wrapped to FIVE ragged rows — 212px, 34% of a 632px sheet — and the
  // first shopping item began at y=325, past half the screen, on the sheet whose
  // whole subject is the list.
  //
  // Grouping ALONE makes that WORSE: two headings ADD 2x44 + 2x8 = 104px to a
  // block already too tall, which is why the heading has to CLOSE. Shut, the
  // block is two 44px rows whatever the source count is — 96px at 10 sources and
  // 96px at 40.
  //
  // WHICH BOX IS OPEN IS DERIVED FROM THE LIST, ONCE, AT RENDER. An empty list is
  // the one moment filling it IS the task, so وجباتي opens itself and the pour
  // stays ONE tap; a list with items on it is a list he came to read, so both are
  // shut. draw() rewrites #sl-list only, so this is decided once and never
  // re-read — a box must never open or shut under the thumb. sl_empty is worded
  // to be true in BOTH states, which is what lets draw() stay untouched.
  const openType = sources.some((s) => s.type === 'meal') ? 'meal' : 'recipe';
  const srcOpen = !DB.shopping.get().items.length;
  // Both glyphs as LITERAL icon() calls so contract 23's scanner keeps covering
  // them: it reads icon('name'), never icon(cond ? 'a' : 'b').
  const SRC_GLYPH = { recipe: icon('utensils', 16), meal: icon('meal', 16) };
  // data-src stays the index into the FLAT sources array — the [data-src] handler
  // indexes sources[] directly, so a per-group index would silently pour the
  // wrong recipe in. map-then-filter keeps that index without depending on the
  // order the array was built in.
  const srcGroup = (type, label) => {
    const rows = sources.map((s, i) => [s, i]).filter(([s]) => s.type === type);
    if (!rows.length) return '';          // a box with nothing in it is not tidier
    const on = srcOpen && openType === type;
    return `<section class="sl-grp">
      <button type="button" class="sl-grp-head" aria-expanded="${on}" aria-controls="sl-grp-${type}">
        ${SRC_GLYPH[type]}<span class="sl-grp-name">${escapeHtml(label)}</span>
        <span class="num sl-grp-n">${fmtNum(rows.length)}</span>
        <span class="sl-grp-chev">${icon('arrowDown', 16)}</span>
      </button>
      <div class="sl-chips" id="sl-grp-${type}"${on ? '' : ' hidden'}>${rows.map(([s, i]) =>
        `<button type="button" class="sl-chip" data-src="${i}">${icon('plus', 14)}<span>${escapeHtml(s.name)}</span></button>`).join('')}</div>
    </section>`;
  };

  const modal = convenienceModal(`${cxHeader('cx_shopping')}<div class="cx-stack sl-sheet">
    ${sources.length ? `<div class="sl-sources">${srcGroup('recipe', t('tab_recipes'))}${srcGroup('meal', t('tab_bundles'))}</div>` : ''}
    <ul class="sl-list" id="sl-list"></ul>
    <div class="sl-compose">
      <input class="input" id="sl-new" maxlength="120" dir="auto" enterkeyhint="done" placeholder="${escapeHtml(t('sl_add_ph'))}">
      <button type="button" class="btn btn-primary sl-add" id="sl-add" aria-label="${escapeHtml(t('add'))}">${icon('plus', 20)}</button>
    </div>
    <div class="cx-actions sl-foot" hidden>
      <button type="button" class="btn btn-ghost" id="sl-clear-done">${t('sl_clear_done')}</button>
      <button type="button" class="btn btn-ghost" id="sl-clear-all">${t('sl_clear_all')}</button>
    </div>
  </div>`);

  const host = modal.querySelector('#sl-list');
  const foot = modal.querySelector('.sl-foot');
  const field = modal.querySelector('#sl-new');
  const mine = () => owner === Cloud.getLastUid();

  const rowHtml = (it) => `<li class="sl-row${it.checked ? ' is-done' : ''}" data-id="${escapeHtml(it.id)}">
      <label class="sl-tick">
        <input type="checkbox"${it.checked ? ' checked' : ''} data-tick>
        <span class="sl-text"><span class="sl-name">${escapeHtml(it.name)}</span>${
          it.amounts && it.amounts.length ? `<span class="sl-amt">${escapeHtml(it.amounts.join(' + '))}</span>` : ''}</span>
      </label>
      <button type="button" class="rec-del" data-del aria-label="${escapeHtml(t('delete') + ' — ' + it.name)}">${icon('trash', 16)}</button>
    </li>`;

  const draw = () => {
    const items = DB.shopping.get().items;
    host.innerHTML = items.length ? items.map(rowHtml).join('')
      : `<li class="sl-empty">${t('sl_empty')}</li>`;
    foot.hidden = !items.length;
    modal.querySelector('#sl-clear-done').disabled = !items.some((x) => x.checked);
    updateFoodShoppingLink();
  };
  draw();

  // ONE delegated listener for the whole list: rows are replaced on every
  // structural change, so a per-row binding would be rebound constantly.
  host.addEventListener('click', (e) => {
    if (!mine()) { convenienceError({ code: 'STALE' }); return; }
    const row = e.target.closest('.sl-row');
    if (!row) return;
    if (e.target.closest('[data-del]')) {
      const result = DB.shopping.removeItem(row.dataset.id);
      if (!result.ok) { convenienceError(result); return; }
      draw(); offerUndo(t('deleted'), result);
      return;
    }
    if (e.target.closest('[data-tick]')) {
      const result = DB.shopping.toggle(row.dataset.id);
      if (!result.ok) { convenienceError(result); draw(); return; }
      // A TICKED ROW NEVER MOVES. One class on one <li>, no redraw — the next
      // unticked item stays exactly where the eye already is, which is the whole
      // point in a supermarket aisle.
      row.classList.toggle('is-done', row.querySelector('[data-tick]').checked);
      modal.querySelector('#sl-clear-done').disabled = !DB.shopping.get().items.some((x) => x.checked);
    }
  });

  const addTyped = () => {
    const name = field.value.trim();
    if (!name || !mine()) return;
    const result = DB.shopping.addNames([{ name }]);
    if (!result.ok) { convenienceError(result); return; }
    field.value = '';
    draw();
    field.focus();
  };
  modal.querySelector('#sl-add').onclick = addTyped;
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } });

  // ONE OPEN BOX AT A TIME. Two open boxes is the 212px blob again with two
  // headings stacked on top of it — the thing being fixed. The panel is the
  // head's next sibling inside its own <section>, so no id lookup is needed.
  // Every chip is in the DOM from first paint and merely [hidden], so the
  // [data-src] bindings below are made once and survive every open and close.
  modal.querySelectorAll('.sl-grp-head').forEach((head) => head.addEventListener('click', () => {
    const opening = head.getAttribute('aria-expanded') !== 'true';
    modal.querySelectorAll('.sl-grp-head').forEach((h) => {
      const on = h === head && opening;
      h.setAttribute('aria-expanded', String(on));
      h.nextElementSibling.hidden = !on;
    });
  }));

  modal.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => {
    if (!mine()) { convenienceError({ code: 'STALE' }); return; }
    const s = sources[Number(b.dataset.src)];
    const result = DB.shopping.addFrom(s.type, s.id);
    if (!result.ok) { convenienceError(result); return; }
    draw();
    offerUndo(t('sl_added').replace('{n}', fmtNum(result.added || 0)), result);
  }));

  modal.querySelector('#sl-clear-done').onclick = () => {
    if (!mine()) { convenienceError({ code: 'STALE' }); return; }
    const result = DB.shopping.clearChecked();
    if (!result.ok) { convenienceError(result); return; }
    draw(); offerUndo(t('sl_cleared'), result);
  };
  modal.querySelector('#sl-clear-all').onclick = () => {
    confirmDialog({
      title: t('sl_clear_all_q'), text: '', confirmLabel: t('sl_clear_all'), variant: 'danger',
      onConfirm: () => {
        if (!mine()) { convenienceError({ code: 'STALE' }); return; }
        const result = DB.shopping.clearAll();
        if (!result.ok) { convenienceError(result); return; }
        draw(); offerUndo(t('sl_cleared'), result);
      },
    });
  };
}

// The Food header link carries the outstanding count, so the list says how much
// is left without being opened.
function updateFoodShoppingLink() {
  const link = document.querySelector('[data-shopping]');
  if (!link) return;
  const left = DB.shopping.get().items.filter((x) => !x.checked).length;
  link.innerHTML = escapeHtml(t('cx_shopping')) + (left ? ` <span class="num sl-count">${fmtNum(left)}</span>` : '');
}

function renderFoodLog(el) {
  const ctx = viewContext.foodLog || { date: todayISO() };
  viewContext.foodLog = ctx;

  const entries = DB.foodLogs.listForDate(ctx.date);
  const totals = DB.foodLogs.totalsForDate(ctx.date);
  const isToday = ctx.date === todayISO();

  const dayLabel = isToday ? t('today_totals') : formatDate(ctx.date);

  // One food-log row (also used when quick-add appends a single row live).
  // WHERE A FIGURE CAME FROM IS PART OF THE FIGURE. Every row has carried a
  // `source` since the day it was written - ai, voice, barcode, manual, recipe,
  // saved - and none of it has ever been drawn, so a number read off a package
  // and a number a model guessed looked exactly alike.
  //
  // Only the two that change how you should READ the number are labelled. A
  // tag on every row is five tags on five rows, which is noise; manual, saved
  // and recipe are the user's OWN figures and need no comment on themselves.
  // ⚠️ NO SOURCE TAG ON THE ROW. v376 painted «تقدير» / «من الملصق» beside the
  // name, and the owner named it as the example of text the user does not need:
  // it says where a figure came from, which changes nothing he can act on. The
  // `source` field is still stored on every row — nothing was lost from the
  // data, only from the screen.
  function foodRowHtml(e) {
    const m = e.servings || 1;
    return `
      <div class="food-log-row" data-food-row="${e.id}">
        <div class="food-log-main">
          <div class="food-log-name">
            ${escapeHtml(e.name)}
            ${m !== 1 ? `<span class="food-log-x num">× ${fmtNum(m)}</span>` : ''}
          </div>
          <div class="food-log-meta">
            <span><span class="num">${fmtNum(Math.round(e.calories * m))}</span> ${t('cal')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.protein * m * 10) / 10)}</span>g ${t('protein_label')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.carbs * m * 10) / 10)}</span>g ${t('carbs_label')}</span>
            ${e.fat ? `<span class="dot-sep"></span><span><span class="num">${fmtNum(Math.round(e.fat * m * 10) / 10)}</span>g ${t('fat_label')}</span>` : ''}
          </div>
        </div>
        <button class="icon-btn" data-edit-food="${escapeHtml(e.id)}" aria-label="${escapeHtml(t('fl_edit_title'))}">${icon('edit', 20)}</button>
        <button class="icon-btn danger" data-del-food="${escapeHtml(e.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 20)}</button>
      </div>
    `;
  }
  const items = entries.map(foodRowHtml).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="food" aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('food_log_title')}</div>
    </div>
    <h1 class="sr-only">${t('food_log_title')}</h1>

    <div class="day-nav">
      <!-- prev = back(◀), next = chevronRight(▶). These were swapped, so in
           English the "previous day" button pointed forwards. RTL is handled in
           CSS (body[dir="rtl"] .calendar-nav-btn svg), not by swapping icons. -->
      <button class="calendar-nav-btn" id="day-prev" aria-label="${t('prev_day')}">${icon('back', 20)}</button>
      <div class="day-nav-label">${escapeHtml(dayLabel)}</div>
      <button class="calendar-nav-btn" id="day-next" aria-label="${t('next_day')}" ${isToday ? 'disabled style="opacity:0.4"' : ''}>${icon('chevronRight', 20)}</button>
    </div>

    <div class="macro-totals">
      <div class="macro-total cal">
        <div class="macro-total-label">${t('calories')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.calories))}<span class="macro-total-unit">${t('cal')}</span></div>
      </div>
      <div class="macro-total pro">
        <div class="macro-total-label">${t('protein_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.protein * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
      <div class="macro-total carb">
        <div class="macro-total-label">${t('carbs_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.carbs * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
      <div class="macro-total fat">
        <div class="macro-total-label">${t('fat_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round((totals.fat || 0) * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
    </div>

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('logged_items')}</div>
      <button class="btn btn-primary" id="add-foodlog-btn">${icon('plus', 20)} ${t('add_food_log')}</button>
    </div>

    <div class="data-list" id="food-log-list" style="gap:6px">
      ${entries.length === 0
        ? emptyState({ iconName: 'apple', title: t('no_food_logged') })
        : items
      }
    </div>
  `;

  $('#day-prev', el).addEventListener('click', () => {
    ctx.date = addDaysISO(ctx.date, -1);
    renderFoodLog(el);
  });
  $('#day-next', el).addEventListener('click', () => {
    if (isToday) return;
    ctx.date = addDaysISO(ctx.date, 1);
    renderFoodLog(el);
  });

  // One add entry point: the same 5-method sheet used by the Food dashboard FAB,
  // logging to the day shown here (unifies the old separate 'AI' + 'Add Food').
  $('#add-foodlog-btn', el).addEventListener('click', () => openAddSheet(ctx.date, () => renderFoodLog(el)));

  // Refresh only the macro-totals block from current DB state.
  function refreshTotals() {
    const tt = DB.foodLogs.totalsForDate(ctx.date);
    const set = (sel, v) => { const n = $(sel, el); if (n) n.childNodes[0].nodeValue = v; };
    set('.macro-total.cal .macro-total-value', fmtNum(Math.round(tt.calories)));
    set('.macro-total.pro .macro-total-value', fmtNum(Math.round(tt.protein * 10) / 10));
    set('.macro-total.carb .macro-total-value', fmtNum(Math.round(tt.carbs * 10) / 10));
    set('.macro-total.fat .macro-total-value', fmtNum(Math.round((tt.fat || 0) * 10) / 10));
  }

  // EDIT IN PLACE. Until now a logged row could only be deleted: a wrong
  // portion meant re-photographing or re-recording the meal, while the AI
  // panel told the user to "correct it in the food log" — a correction that
  // did not exist. DB.foodLogs.update() had zero callers.
  function openFoodLogEditor(id) {
    const entry = DB.foodLogs.listForDate(ctx.date).find((x) => x.id === id);
    if (!entry) return;
    let mult = Number(entry.servings) || 1;
    const overlay = openModal(`
      <div class="modal-header">
        <div>
          <div class="modal-title">${t('fl_edit_title')}</div>
          <div class="modal-subtitle">${escapeHtml(entry.name)}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
      </div>
      <div class="form-group">
        <label class="form-label">${t('servings')}</label>
        <div class="fl-stepper">
          <button type="button" class="icon-btn" data-step="-1" aria-label="${escapeHtml(t('portion_less'))}">${icon('minus', 18)}</button>
          <span class="fl-stepper-val num" id="fl-mult">${fmtNum(mult)}</span>
          <button type="button" class="icon-btn" data-step="1" aria-label="${escapeHtml(t('portion_more'))}">${icon('plus', 18)}</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="fl-cal">${t('cal')}</label><input type="number" inputmode="decimal" id="fl-cal" step="1" min="0" value="${numAttr(entry.calories)}"></div>
        <div class="form-group"><label class="form-label" for="fl-pro">${t('protein_label')}</label><input type="number" inputmode="decimal" id="fl-pro" step="0.1" min="0" value="${numAttr(entry.protein)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="fl-carb">${t('carbs_label')}</label><input type="number" inputmode="decimal" id="fl-carb" step="0.1" min="0" value="${numAttr(entry.carbs)}"></div>
        <div class="form-group"><label class="form-label" for="fl-fat">${t('fat_label')}</label><input type="number" inputmode="decimal" id="fl-fat" step="0.1" min="0" value="${numAttr(entry.fat)}"></div>
      </div>
      <p class="calc-preview-hint">${t('fl_per_serving_hint')}</p>
      <button type="button" class="btn btn-primary btn-block" id="fl-save">${icon('check', 20)} ${t('save')}</button>
    `);
    overlay.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      // Same 0.25 steps and 0.25–20 bounds as the AI cards.
      mult = Math.max(0.25, Math.min(20, Math.round((mult + (Number(b.dataset.step) || 0) * 0.25) * 100) / 100));
      overlay.querySelector('#fl-mult').textContent = fmtNum(mult);
    }));
    overlay.querySelector('#fl-save').addEventListener('click', () => {
      const num = (sel) => { const v = parseFloat(overlay.querySelector(sel).value); return isFinite(v) && v >= 0 ? v : 0; };
      const updated = DB.foodLogs.update(ctx.date, id, {
        servings: mult, calories: num('#fl-cal'), protein: num('#fl-pro'), carbs: num('#fl-carb'), fat: num('#fl-fat'),
      });
      if (!updated) { closeModal(); return; }
      // Replace the row FIRST, then close: closeModal() returns focus to the
      // opener, and the opener is the pencil inside the row being replaced.
      const list = $('#food-log-list', el);
      const row = list.querySelector(`[data-food-row="${CSS.escape(id)}"]`);
      if (row) row.outerHTML = foodRowHtml(updated);
      refreshTotals();
      closeModal();
      try { list.querySelector(`[data-food-row="${CSS.escape(id)}"] [data-edit-food]`)?.focus(); } catch (_) {}
      offerUndo(t('fl_edited'));
    });
  }

  // Delegated edit + delete — append/remove keep working without rebinding.
  $('#food-log-list', el).addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-food]');
    if (editBtn) { openFoodLogEditor(editBtn.dataset.editFood); return; }
    const btn = e.target.closest('[data-del-food]');
    if (!btn) return;
    const result = DB.foodLogs.remove(ctx.date, btn.dataset.delFood);
    if (!result.ok) { convenienceError(result); return; }
    const row = btn.closest('[data-food-row]');
    if (row) row.remove();
    if (!$('#food-log-list', el).querySelector('[data-food-row]')) {
      $('#food-log-list', el).innerHTML = emptyState({ iconName: 'apple', title: t('no_food_logged') });
    }
    refreshTotals();
    offerUndo(t('food_removed'), result);
  });
}
