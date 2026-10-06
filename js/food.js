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
  // «اقتراحات» (v419): the dashboard painted from memory above; the community
  // list arrives (or does not) after it, and only the card is drawn again.
  // Scoped to THIS render's view — never `.view.active` from inside a render.
  loadSharedRecipes().then((changed) => { if (changed) shrRepaint($('#nutri-host', el)); });
  // Automatic sharing (v420): whatever of the user's own recipes is not
  // published yet is queued from here — the Food tab is where its one-time
  // notice belongs. It only queues; runAutoShare() checks every gate itself.
  // Background work never breaks a render: a throw in there would leave the
  // dashboard painted with none of its handlers.
  try { autoShareBackfill(); } catch (_) {}
  host?.addEventListener('click', (e) => {
    // The suggestions card's three controls, ABOVE the hero's catch-all at the
    // end: the card sits outside .nutri-hero, and these branches return first
    // so no edit to that test can ever turn a period tap into opening the log.
    const shrBtn = e.target.closest('[data-shr-period]');
    if (shrBtn) {
      const p = shrBtn.getAttribute('data-shr-period');
      if (!SHR_PERIODS.includes(p)) return;
      SHR_PICK = { period: p, clock: mealPeriodFor(new Date()) };
      shrRepaint(host);
      // The card was redrawn under the finger: focus goes back to the button pressed.
      const again = host.querySelector('[data-shr-period="' + p + '"]');
      if (again) again.focus({ preventScroll: true });
      return;
    }
    const shrRow = e.target.closest('[data-shr-open]');
    if (shrRow) {
      shrOpen(suggestionPool().find((x) => x.id === shrRow.getAttribute('data-shr-open')), rerender);
      return;
    }
    if (e.target.closest('[data-shr-more]')) {
      const period = shrPeriod(new Date());
      openSharedSuggestions(rankSuggestions(suggestionPool(), period, shrGauge()), period, rerender);
      return;
    }
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
    // The food log reads its day from ctx.date, like every dated screen
    // (contract 67 refuses the old private spellings).
    if (e.target.closest('.nutri-hero')) { navigate('foodlog', { date: todayISO() }); return; }
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

// THE ONE ARITHMETIC behind the calorie ring and the macro tracks. The Food
// tab's hero and the log's miniature (nutritionMiniHtml) both draw from this,
// so a percentage, a dash or a rounding can never differ between the two.
// r=54 → circumference ≈ 339.29; `dash` is the filled arc in those units.
function nutritionGauge(date) {
  const tgt = DB.nutrition.get().targets;
  // totalsForDate sums rows AS STORED, and rows written before the v396 clamp
  // can carry a typed minus or a non-number: -300 made calPct negative, and a
  // negative stroke-dasharray is INVALID SVG, which paints a FULL ring; 'abc'
  // summed to NaN and printed «NaN». Every figure is coerced here, once, for
  // both callers: a finite number no lower than 0, else 0.
  const raw = DB.foodLogs.totalsForDate(date);
  const eaten = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0; };
  const consumed = { calories: eaten(raw.calories), protein: eaten(raw.protein), carbs: eaten(raw.carbs), fat: eaten(raw.fat) };
  const pct = (c, g) => (g > 0 ? Math.max(0, Math.min(100, (c / g) * 100)) : 0);
  const calLeft = Math.round(tgt.calories - consumed.calories);
  const calPct = pct(consumed.calories, tgt.calories);
  const C = 339.29;
  const dash = C * (calPct / 100);
  const macro = (key) => {
    const c = Math.round(consumed[key] * 10) / 10;
    const g = tgt[key] || 0;
    return { c, g, left: Math.round((g - c) * 10) / 10, pct: pct(c, g) };
  };
  return {
    tgt, calEaten: Math.round(consumed.calories), calLeft, over: calLeft < 0, C, dash,
    // .cal-ring-fg is round-capped, so a dash of 0 still paints a DOT of one
    // stroke-width at 12 o'clock; `empty` switches that stroke off (.is-empty).
    empty: dash < 0.5,
    macros: { protein: macro('protein'), carbs: macro('carbs'), fat: macro('fat') },
  };
}

// The rings + remaining + today's list. Re-rendered on its own after any change.
function nutritionDashboardHtml(date) {
  const nut = DB.nutrition;

  // Not set up yet → invite the user to build a target. The suggestions card
  // follows it, ranked without a «calories left» (there is no target to leave).
  if (!nut.hasTargets()) {
    return `
      <button class="nutri-setup" data-setup-goal>
        <div class="nutri-setup-icon">${icon('target', 22)}</div>
        <div class="nutri-setup-main">
          <div class="nutri-setup-title">${t('nutri_setup_title')}</div>
        </div>
      </button>
      ${sharedCardHtml(null)}
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

  // The ring and track arithmetic lives in nutritionGauge, shared with the
  // log's miniature, so the two can never disagree about a figure.
  const gauge = nutritionGauge(date);
  const { tgt, calLeft, over, dash, C } = gauge;

  const macroBar = (key, label, cls) => {
    const { c, g, left, pct } = gauge.macros[key];
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
          <circle class="cal-ring-fg ${over ? 'over' : ''}${gauge.empty ? ' is-empty' : ''}" cx="60" cy="60" r="54"
            stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="cal-ring-center">
          <div class="cal-ring-num num ${over ? 'over' : ''}">${fmtNum(Math.abs(calLeft))}</div>
          <div class="cal-ring-label">${over ? t('nutri_over') : t('nutri_left')}</div>
          <div class="cal-ring-sub"><span class="num">${fmtNum(gauge.calEaten)}</span> / <span class="num">${fmtNum(tgt.calories)}</span> ${t('cal')}</div>
        </div>
      </div>
      <div class="macro-tracks">
        ${macroBar('protein', t('protein_label'), 'pro')}
        ${macroBar('carbs', t('carbs_label'), 'carb')}
        ${macroBar('fat', t('fat_label'), 'fat')}
      </div>
    </div>

    ${waterCard}${sharedCardHtml(gauge)}
  `;
}

// THE LOG'S MINIATURE OF THE HERO (owner's request, 2026-09-27): the ring and
// the three tracks drawn small for the day the log is showing, with the eaten
// rows under it. On a CLOSED day (before today) the big figure is the day's
// VERDICT — how far under or over the target it ended — and the label says
// which; today it is the hero's own left/over. Same arithmetic (nutritionGauge),
// same ring/track classes, so the stroke and hue rules apply unchanged.
// The verdict is measured against the CURRENT targets, not the target that
// stood on that day — none is stored per day, so a changed goal rewrites every
// past verdict (kept on purpose, v405: a per-day target is a schema change).
// No pencil, no water card, no third «left» line, and nothing that names the
// day: .day-nav already shows it. Not a target — the hero opens the log; the
// log's own card opens nothing.
function nutritionMiniHtml(date, opts) {
  const closed = !!(opts && opts.closed);
  const g = nutritionGauge(date);
  // A closed day that ended EXACTLY on its target is «on target», not «0 under».
  const verdict = g.over ? 'fl_day_over' : g.calLeft === 0 ? 'fl_day_on' : 'fl_day_under';
  const label = closed ? t(verdict) : t(g.over ? 'nutri_over' : 'nutri_left');
  const track = (key, name, cls) => {
    const m = g.macros[key];
    return `
      <div class="macro-track">
        <div class="macro-track-head">
          <span class="macro-track-name ${cls}">${name}</span>
          <span class="macro-track-nums"><span class="num">${fmtNum(m.c)}</span> / <span class="num">${fmtNum(m.g)}</span>g</span>
        </div>
        <div class="macro-track-bar"><span class="macro-track-fill ${cls}" style="width:${m.pct}%"></span></div>
      </div>`;
  };
  return `
    <div class="nutri-mini${closed ? ' closed' : ''}">
      <div class="nutri-mini-ring">
        <svg class="cal-ring" viewBox="0 0 120 120">
          <circle class="cal-ring-bg" cx="60" cy="60" r="54"/>
          <circle class="cal-ring-fg${g.over ? ' over' : ''}${g.empty ? ' is-empty' : ''}" cx="60" cy="60" r="54"
            stroke-dasharray="${g.dash.toFixed(1)} ${g.C.toFixed(1)}" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="cal-ring-center">
          <div class="cal-ring-num num${g.over ? ' over' : ''}">${fmtNum(Math.abs(g.calLeft))}</div>
          <div class="cal-ring-label">${label}</div>
          <div class="cal-ring-sub"><span class="num">${fmtNum(g.calEaten)}</span> / <span class="num">${fmtNum(g.tgt.calories)}</span></div>
        </div>
      </div>
      <div class="nutri-mini-tracks">
        ${track('protein', t('protein_label'), 'pro')}
        ${track('carbs', t('carbs_label'), 'carb')}
        ${track('fat', t('fat_label'), 'fat')}
      </div>
    </div>`;
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

  // Look up ONE code on Open Food Facts. It answers what happened, because the
  // two misses are different facts:
  //   'found'   a product with calories is shown; scanning stops
  //   'unknown' the database has no such product — skip it for this sheet
  //   'failed'  the NETWORK failed (offline, DNS, a 5xx) — nothing is known
  //             about the code, so it is only POSTPONED. Filed as unknown, the
  //             same product could never be looked up again, however long the
  //             camera was held on it once the connection came back.
  //   'busy'    another lookup is out (the camera's and a typed one can meet);
  //             nothing was changed
  //   'gone'    the sheet closed while the request was out
  let lookingUp = false;
  async function lookup(code) {
    if (lookingUp) return 'busy';
    lookingUp = true;
    scanning = false;                 // pause processing while we query
    // A card is only ever on screen for the code that produced it. Kept, the
    // last product's card and its Add button stayed live under «not found»,
    // and one tap logged the wrong food.
    result.innerHTML = '';
    status.textContent = t('barcode_looking');
    let product = null;
    let failed = false;
    try {
      const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' +
        encodeURIComponent(code) + '.json?fields=product_name,nutriments,serving_quantity,product_quantity');
      const data = await res.json();
      product = data && data.product;
    } catch (_) { failed = true; }
    finally { lookingUp = false; }
    if (!document.body.contains(overlay)) return 'gone';
    const n = product && product.nutriments;
    const kcal100 = n && (n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : null);
    if (!product || !n || kcal100 == null) { status.textContent = t(failed ? 'auth_err_network' : 'barcode_not_found'); return failed ? 'failed' : 'unknown'; }
    // FOUND, BUT NOT A NUMBER (pentest, 2026-09-27). Open Food Facts is crowd
    // data: a calorie field of «abc» or a negative one became NaN here, passed
    // the null check above, and the card offered the product at 0 kcal with a
    // live Add — a wrong figure logged in one tap, with no word said. Say what
    // happened instead, and leave Photo and Manual as the way on.
    if (!Number.isFinite(kcal100) || kcal100 < 0) { status.textContent = t('barcode_unreadable'); return 'unknown'; }
    stop();                           // got a hit → release the camera
    if (stage) stage.style.display = 'none';
    showResult(product, n);
    return 'found';
  }
  // What the camera remembers about a miss, so it does not re-ask on every
  // frame: an unknown code for the rest of the sheet, a failed one for 2 s.
  const retryAt = new Map();
  const skipCode = (code) => triedUnknown.has(code) || (retryAt.get(code) || 0) > Date.now();
  const noteMiss = (code, outcome) => {
    if (outcome === 'unknown') triedUnknown.add(code);
    else if (outcome === 'failed') retryAt.set(code, Date.now() + 2000);
  };

  // Native BarcodeDetector loop (Android). `loopAlive` is true while a frame of
  // it is scheduled or running, so a restart can never start a second loop
  // beside one that is still going.
  let loopAlive = false;
  const startLoop = () => { if (detector && !loopAlive) { loopAlive = true; requestAnimationFrame(scanLoopNative); } };
  async function scanLoopNative() {
    if (!scanning || !detector || !document.body.contains(overlay)) { loopAlive = false; return; }
    try {
      const codes = await detector.detect(video);
      const code = codes && codes.length && codes[0].rawValue ? String(codes[0].rawValue) : '';
      if (code && !skipCode(code)) {
        const outcome = await lookup(code);
        if (outcome === 'found' || outcome === 'gone') { loopAlive = false; return; }
        if (outcome !== 'busy') { noteMiss(code, outcome); scanning = true; }
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
    if (code.length < 6) { result.innerHTML = ''; status.textContent = t('barcode_invalid'); manualInput.focus(); return; }
    // A typed miss must not end the camera. lookup() pauses both engines, and
    // only the camera's own callers used to resume them — so after one typed
    // «not found» the preview kept running and nothing was decoded again. The
    // camera is resumed only if it is still live (stop() and failToManual()
    // null the stream and the reader); ZXing's callback needs only the flag.
    lookup(code).then((outcome) => {
      if ((outcome === 'unknown' || outcome === 'failed') && (stream || zxingReader) && document.body.contains(overlay)) {
        scanning = true;
        startLoop();
      }
    });
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
      .then((s) => {
        // The permission prompt can outlast the sheet. Closed while it was up,
        // the camera arrived to nobody and ran on behind no screen — stop() had
        // already run and could not see it. It is switched off here instead.
        if (!document.body.contains(overlay)) { s.getTracks().forEach((tk) => tk.stop()); return; }
        stream = s; video.srcObject = s; video.play().catch(() => {}); scanning = true; startLoop();
      })
      .catch(() => failToManual(true));
    return;
  }

  // Engine B: ZXing decoder (works in any browser with a camera). Lazy-loaded.
  status.textContent = t('barcode_loading');
  loadBarcodeLib().then((ZX) => {
    if (!document.body.contains(overlay)) return;
    const reader = zxingReader = new ZX.BrowserMultiFormatReader();
    scanning = true;
    status.textContent = t('barcode_hint');
    return reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, async (res2) => {
      if (!scanning || !res2 || typeof res2.getText !== 'function') return;   // no barcode in this frame
      const code = String(res2.getText());
      if (skipCode(code)) return;
      const outcome = await lookup(code);
      if (outcome === 'found' || outcome === 'gone' || outcome === 'busy') return;
      noteMiss(code, outcome);          // unknown → skip it; failed → try again shortly
      scanning = true;
    }).then(() => {
      // The native path's race, here: a camera granted after the sheet closed
      // is attached to the reader AFTER stop() reset it, so it is reset again.
      if (!document.body.contains(overlay)) { try { reader.reset(); } catch (_) {} }
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
// enough to stop being used. The default is never «everything» (owner decision,
// v391 — «لا تجعل الديفلت كله مختار»; v376 had ticked everything). What IS
// ticked (the owner's ranked UX list, 2026-09-27) is the meal of THIS time of
// day: yesterday's rows logged within two hours, either side, of this moment
// one day earlier. A usual breakfast is then three taps, not seven; anything
// else is still one tick away, and Add still offers Undo. With nothing near now
// nothing is ticked, and the add button waits as before — and when EVERY row
// would be ticked, none is: a whole day logged in one write (a previous repeat,
// or a day logged at night) shares one stamp, and ticking it all is exactly
// the «everything» default v391 refused.
//
// The portions come across verbatim (`servings`), which is the other half of
// "as they were" - a repeat that silently logged one serving of a 1.5-serving
// meal would be a different meal.
//
// Whether a stamp, moved ONE CALENDAR DAY forward, lies within `win` minutes of
// `now` — elapsed time, never clock minutes on a circle. At 00:30 yesterday's
// 23:30 is the snack eaten an hour ago, not this time yesterday; and a row
// back-filled onto yesterday this morning is stamped today, a day from any
// «now» it could match. A missing or unreadable stamp is never near: a row the
// app cannot place in the day is not guessed into the meal.
function foodNearNow(stamp, now = new Date(), win = 120) {
  const at = stamp ? new Date(stamp) : null;
  if (!at || Number.isNaN(at.getTime())) return false;
  at.setDate(at.getDate() + 1);          // the same local clock time, a day on
  return Math.abs(now.getTime() - at.getTime()) <= win * 60000;
}
function openRepeatYesterday(date, onChange) {
  // todayISO() HERE, at the moment this opens - never a date captured by a
  // render that may have painted before midnight.
  const day = date || todayISO();
  const prevDay = addDaysISO(day, -1);
  const prev = DB.foodLogs.listForDate(prevDay);
  const now = new Date();
  const near = prev.map((e) => foodNearNow(e.addedAt, now));
  if (near.length && near.every(Boolean)) near.fill(false);   // never «everything» (v391)
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
          <input type="checkbox" data-ry="${i}"${near[i] ? ' checked' : ''}>
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

// RECENTLY EATEN. Food logged from a photo, the chat, the voice or a barcode was
// never kept for reuse, so eating the same meal again meant the capture again —
// another AI call from the daily budget and a fresh estimate that could differ.
// These are the distinct items (same name + calories per serving) of the last
// `days` days, most eaten first, the most recent breaking a tie, each carried as
// its NEWEST row so a tap repeats exactly what was logged last time, portion
// included. Derived from the log on every open: nothing new is stored.
function recentFoods(limit = 5, days = 14) {
  const today = todayISO(), seen = new Map();
  let order = 0;
  for (let i = 0; i < days; i++) {
    const rows = DB.foodLogs.listForDate(addDaysISO(today, -i));
    for (let j = rows.length - 1; j >= 0; j--) {
      const e = rows[j];
      if (!e || !e.name) continue;
      const key = DB.search.fold(e.name) + '|' + (Number(e.calories) || 0);
      const hit = seen.get(key);
      if (hit) hit.count++;
      else seen.set(key, { row: e, count: 1, order: order++ });
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.order - b.order).slice(0, limit).map((x) => x.row);
}
// One serving of a catalogue dish, in the ONE meal write, fat included (a
// preset without `f` logs zero fat, never undefined). The search sheet and the
// saved-food picker both log through here; the caller offers the Undo.
function logFoodPreset(date, p) {
  if (!p) return { ok: false, code: 'VALIDATION' };
  return DB.foodLogs.addMany(date || todayISO(), [{ name: foodPresetName(p), servings: 1, calories: p.cal, protein: p.pro,
    carbs: p.carb, fat: p.f || 0, source: 'catalog' }]);
}

function openAddSheet(date, onChange) {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('add-sheet-overlay')?.remove();
  const recent = recentFoods();

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
    <div class="add-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="${escapeHtml(t('add_sheet_title'))}">
      <div class="sheet-handle"></div>
      <div class="add-sheet-title">${t('add_sheet_title')}</div>
      ${recent.length ? `<div class="add-recent">
        <div class="add-recent-label" id="add-recent-label">${t('fl_recent')}</div>
        <div class="add-recent-row" role="group" aria-labelledby="add-recent-label">
          ${recent.map((e, i) => `<button type="button" class="add-recent-chip" data-recent="${i}">
            <span class="add-recent-name" dir="auto">${escapeHtml(e.name)}</span>
            <span class="add-recent-cal"><span class="num">${fmtNum(Math.round((Number(e.calories) || 0) * (e.servings || 1)))}</span> ${t('cal')}</span>
          </button>`).join('')}
        </div>
      </div>` : ''}
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
  const release = holdSheetFocus(overlay);

  // One close, however many exits race for it (a second tile tapped inside the
  // exit used to open a second sheet). Focus goes back to the opener first, so
  // a method's sheet opened from the callback returns there when it closes.
  const close = (cb) => {
    if (overlay.__closed) return;
    overlay.__closed = true;
    release();
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); if (typeof cb === 'function') cb(); }, 260);
  };
  // Back, Escape and a navigation close it through here, so its focus is let
  // go too — the router's fallback only removed the node.
  overlay.__close = () => close();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); return; }
    const again = e.target.closest('[data-recent]');
    if (again) {
      // One tap = one write, the day resolved NOW (the sheet can stand open
      // across midnight), the newest row's portion and figures verbatim.
      if (overlay.__closed) return;
      const r = recent[Number(again.dataset.recent)];
      if (!r) return;
      const result = DB.foodLogs.addMany(date || todayISO(), [{ name: r.name, servings: r.servings || 1, calories: r.calories,
        protein: r.protein, carbs: r.carbs, fat: r.fat || 0, source: r.source || 'saved' }]);
      if (!result.ok) { convenienceError(result); return; }
      close();
      if (typeof onChange === 'function') onChange();
      offerUndo(t('fl_recent_logged').replace('{name}', r.name), result);
      return;
    }
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
    // A segment is one choice among a few: a radiogroup named by its caption.
    const seg = (name, opts, cur, caption) => `
      <div class="seg" data-seg="${name}" role="radiogroup" aria-label="${escapeHtml(caption)}">
        ${opts.map((o) => `<button type="button" class="seg-btn ${cur === o.v ? 'active' : ''}" role="radio" aria-checked="${cur === o.v}" data-val="${o.v}">${o.label}</button>`).join('')}
      </div>`;
    return `
      <div class="form-group"><label class="form-label">${t('calc_sex')}</label>
        ${seg('sex', [{ v: 'male', label: t('calc_male') }, { v: 'female', label: t('calc_female') }], p.sex, t('calc_sex'))}</div>
      <div class="calc-grid">
        <div class="form-group"><label class="form-label">${t('calc_age')}</label>
          <input type="number" inputmode="numeric" id="c-age" min="10" max="100" value="${numAttr(p.age)}" placeholder="25"></div>
        <div class="form-group"><label class="form-label">${t('calc_height')}</label>
          <input type="number" inputmode="numeric" id="c-height" min="100" max="230" value="${numAttr(p.heightCm)}" placeholder="175"></div>
        <div class="form-group"><label class="form-label">${t('calc_weight')}</label>
          <input type="number" inputmode="decimal" id="c-weight" min="30" max="300" value="${numAttr(p.weightKg)}" placeholder="75"></div>
      </div>
      <div class="form-group"><label class="form-label">${t('calc_activity')}</label>
        ${seg('activity', activities.map((a) => ({ v: a, label: t('activity_' + a) })), p.activity, t('calc_activity'))}</div>
      <div class="form-group"><label class="form-label">${t('calc_goal')}</label>
        ${seg('goal', goals.map((g) => ({ v: g, label: t('goal_' + g) })), p.goal, t('calc_goal'))}</div>
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
        seg.querySelectorAll('.seg-btn').forEach((x) => setChosen(x, x === b));
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
    // min="0" does not stop a typed minus sign, and -300 kcal logged here was
    // counted BACK into the day — and, with «keep» ticked by default, kept in My
    // foods to do it again on every one-tap log. Refused by name before anything
    // is written: DB.foodLogs.add would clamp it to 0, a different wrong number.
    if (Object.values(macros).some((v) => v < 0)) { showToast(t('food_negative')); return; }
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

// ONE READING OF A NUMBER IN AN AMOUNT. The editor's weight reader (parseGrams)
// and the ingredients sheet's scaler (recScaleQty) read the same free-text
// field, and they read a comma two ways: «0,5 كغ» was half a kilo to the
// scaler and 5 kg to parseGrams — the comma stopped the number, the weight
// regex matched «5 كغ» on its own, and a saved food was scaled ten times over
// with no model call to catch it — while «1,000 g» was 1 g to the scaler. A
// comma between digits is a THOUSANDS separator when exactly three digits
// follow it and a DECIMAL mark when one or two do, for both readers; any other
// comma is not part of a number. (Hoisted out of openRecipeEditor, where both
// were closure vars, so that one rule has one spelling and can be tested.)
function latinDigits(s) {
  return String(s || '').replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x6F0)).replace(/\u066B/g, '.')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
}
// '200 غ' / '200g' / '٢٠٠' / '0.5 كغ' / '0,5 كغ' → grams; anything else (cups,
// pieces) → null. The LAST weight in the string counts ('١ كوب · ٢٥٠غ',
// 'سكوب · ٣٠غ', '200 g'). A bare number means grams for a typed quantity ('200'),
// but NOT for a food's serving — '1' there is one piece, and scaling 100 g by it
// made a 7,800-calorie egg. The number must START where it is read (the
// lookbehind): a comma neither rule above reads («1,5000 g») would otherwise
// leave its tail to match on its own, and part of a number is not a weight —
// that string goes to the model instead.
function parseGrams(s, requireUnit) {
  const str = latinDigits(s).trim().toLowerCase();
  let m = str.match(/(?<![\d.,])(\d+(?:\.\d+)?)\s*(كغ|كجم|kg|غ|غم|جم|غرام|جرام|g|gr|gram|grams|مل|ml)\.?\s*$/);
  if (!m && !requireUnit) m = str.match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]); if (!(n > 0)) return null;
  return /^(كغ|كجم|kg)$/.test(m[2] || '') ? n * 1000 : n;
}

// THE INGREDIENTS, TO COOK FROM. The card says what a serving COSTS; this says
// what goes IN — every ingredient with its amount exactly as it was typed
// («200 غ», «٣ حبات»), never parsed, never scaled, and no macros: at the
// stove the arithmetic is noise. One line above the list carries the one
// number a cook needs, how many servings it makes. The list itself holds no
// controls; «تعديل» below it is the way to change anything, and it returns
// to the picker the way the card's own pencil does.
// SAME RECIPE, DIFFERENT AMOUNTS (owner, v392: «بدي نفس الوصفة وكميات غير»).
// The servings stepper at the top of the sheet is a SCALER for today's cooking,
// not an edit: nothing is written to the recipe. An amount is free text, so
// only its leading number moves — «200 غ» at 2 of 4 servings is «100 غ»,
// «٣ حبات» is «1.5 حبات», «رشّة ملح» is left exactly as written — and at the
// recipe's own count every amount is the original string again.
function recScaleQty(qty, factor) {
  const s = String(qty || '');
  if (factor === 1) return s;
  // The whole leading number, read by latinDigits' comma rule: «1,000 g» at
  // half is «500 g» (every comma used to be a decimal: «0.5 g»), a comma that
  // rule cannot read leaves the string as written, and «a/b» is ONE value —
  // «1/2 كوب» at double is «1 كوب», not «2/2 كوب».
  const m = s.match(/[0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,\u066B][0-9\u0660-\u0669\u06F0-\u06F9]+)*(?:\/[0-9\u0660-\u0669\u06F0-\u06F9]+)?/);
  if (!m) return s;
  const parts = latinDigits(m[0]).split('/');
  const n = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(parts[0]);
  if (!Number.isFinite(n)) return s;
  const v = Math.round(n * factor * 100) / 100;
  return s.slice(0, m.index) + String(v) + s.slice(m.index + m[0].length);
}

// Arabic's dual and its 3-10 / 11+ split are real grammar: one literal key per
// form, so «مكوّنان» never reads «2 مكوّنان». `html` wraps the figure in .num
// (a dictionary string is ours, so only the figure is inserted).
// The ledger's meta line: each part is ONE unbreakable unit («٢٦ بروتين» never
// splits), and every part after the first carries its «·» glued to its front.
// The only break is the plain space BEFORE a dot, so a wrapped line never ends
// on a bare «·» (the v411 review measured «… ٧ دهون ·» over a lone «تقدير»).
// Parts are HTML: each caller escapes what it inserts.
const recJoin = (parts) => parts.filter(Boolean).map((p, i) => '<span class="rec-nw">' + (i ? '·\u00a0' : '') + p + '</span>').join(' ');
const recCount = (n) => Math.max(1, parseInt(n, 10) || 1);
const recFig = (s, n, html) => s.replace('{n}', html ? '<span class="num">' + fmtNum(n) + '</span>' : fmtNum(n));
function recServLabel(n, html) {
  n = recCount(n);
  return recFig(n === 1 ? t('rec_serv_1') : n === 2 ? t('rec_serv_2') : n <= 10 ? t('rec_serv_n') : t('rec_serv_many'), n, html);
}
function recIngLabel(n, html) {
  n = recCount(n);
  return recFig(n === 1 ? t('rec_ing_1') : n === 2 ? t('rec_ing_2') : n <= 10 ? t('rec_ing_n') : t('rec_ing_many'), n, html);
}
// What a saved ingredient row holds: the editor's transient flags never reach
// storage (cleanMealItems copies every extra field it is handed).
function recStoredItem(it) {
  const c = Object.assign({}, it);
  delete c._auto; delete c._manual; delete c._zero; delete c._wasZero; delete c._id; delete c._src; delete c._why;
  return c;
}

// One ingredient's figures FOR THE AMOUNT SHOWN — «٣٣٠ سعرة · ٦٢ بروتين · …»,
// the card's own spelling (shrNum, shrMacros) — at `f` times its stored
// amount, so the scaler moves them with the amounts and the two never disagree.
function recItemFigsHtml(it, f) {
  const k = Number.isFinite(f) && f > 0 ? f : 1;
  const x = (v) => (Number(v) || 0) * k;
  return recJoin([shrNum(x(it && it.calories)) + ' ' + t('cal'), ...shrMacros({ protein: x(it && it.protein), carbs: x(it && it.carbs), fat: x(it && it.fat) })]);
}
// The ingredient rows of a recipe sheet: the name, and the amount exactly as
// written (a [data-qty] span bindRecScaler rewrites). Shared by the user's own
// recipe view and a suggestion's sheet («اقتراحات», v419). `withFigs` adds
// each ingredient's figures under its line ([data-figs], scaled too): the
// suggestion sheets say what every ingredient costs (the owner, v421); the
// user's own recipe view keeps the stove's silence.
function recViewRowsHtml(items, withFigs) {
  return (items || []).map((it, i) => `<div class="cx-row${withFigs ? ' has-figs' : ''}"><span>${escapeHtml(it.name)}</span>${String(it.qty || '').trim() ? `<span class="num rec-view-qty" dir="auto" data-qty="${i}">${escapeHtml(it.qty)}</span>` : ''}${withFigs ? `<span class="rec-view-figs" data-figs="${i}">${recItemFigsHtml(it, 1)}</span>` : ''}</div>`).join('');
}
// The servings stepper as a SCALER (v392): `items` is read at paint time, so a
// sheet whose ingredients arrive later hands the array it fills and calls the
// returned paint() once they are drawn. Nothing is written anywhere.
function bindRecScaler(modal, input, items, base) {
  // Rewrites the amount spans in place — the rows never re-render, so the eye
  // stays where it was and the stepper keeps focus.
  const paint = () => {
    // parseInt alone: a 0 typed or stepped down to is a NUMBER, and `|| base` would read it as blank and jump to 4.
    const raw = parseInt(input.value, 10);
    const n = Number.isFinite(raw) ? Math.min(99, Math.max(1, raw)) : base;
    if (String(n) !== input.value) input.value = String(n);
    const f = n / base;
    modal.querySelectorAll('[data-qty]').forEach((el) => {
      const it = (items || [])[Number(el.dataset.qty)];
      el.textContent = recScaleQty(it && it.qty, f);
    });
    // The figures under an ingredient follow its amount (a suggestion's sheet).
    modal.querySelectorAll('[data-figs]').forEach((el) => {
      const it = (items || [])[Number(el.dataset.figs)];
      if (it) el.innerHTML = recItemFigsHtml(it, f);
    });
  };
  modal.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const cur = parseInt(input.value, 10);
    input.value = String((Number.isFinite(cur) ? cur : base) + Number(b.dataset.step));
    paint();
  }));
  input.addEventListener('input', paint);
  input.addEventListener('change', paint);
  return paint;
}

// `opts.log` (v421): the view opened from the «اقتراحات اليوم» card, where the
// user's own recipe is the FIRST row — and a row there is a meal to eat, so the
// view carries «سجّل حصّة» first: ONE serving, whatever the scaler shows, as
// the picker's «+» logs it. The picker opens the view without it (its rows
// keep their own «+»), so that view is unchanged. Every redraw of the view
// from inside it hands `opts` on, and «تعديل» from the card lands back on Food
// (onSave), not in the saved-food picker the card never opened.
function openRecipeView(date, rec, onSave, opts) {
  // Re-read by id: the picker's copy can be older than an edit made since.
  const r = DB.recipes.list().find((x) => x.id === rec.id) || rec;
  const base = Math.max(1, Number(r.servings) || 1);
  const logHere = !!(opts && opts.log);
  // «شاركها» needs the share call; «أزل من المشاركة» is offered whenever the
  // recipe carries the marker, so a published copy can always be taken down.
  const canShare = !!(window.FoodAI && typeof FoodAI.shareRecipe === 'function');
  // What the share button is DRAWN as: read again at the tap (see its handler).
  const drewShared = !!r.shared;
  const modal = openModal(`
    <div class="modal-header"><h2 class="modal-title">${escapeHtml(r.name)}</h2><button class="icon-btn" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button></div>
    <div class="cx-stack">
      <div class="rt-serv"><span class="rt-serv-k">${t('rec_servings')}</span>
        <span class="rt-step">
          <button type="button" data-step="-1" aria-label="${escapeHtml(t('rec_serv_less'))}">${icon('minus', 16)}</button>
          <input type="number" id="rec-view-servings" class="num" inputmode="numeric" min="1" max="99" step="1" value="${base}" aria-label="${escapeHtml(t('rec_servings'))}">
          <button type="button" data-step="1" aria-label="${escapeHtml(t('rec_serv_more'))}">${icon('plus', 16)}</button>
        </span></div>
      <div class="cx-list rec-view">${recViewRowsHtml(r.items)}</div>
      <div class="cx-actions">${logHere ? `<button type="button" class="btn btn-primary" data-log-view>${t('shr_log')}</button>` : ''}
        <button type="button" class="btn btn-ghost" data-edit-view>${t('rec_edit')}</button>
        ${r.shared || canShare ? `<button type="button" class="btn btn-ghost" data-share-view>${r.shared ? t('shr_unshare') : t('shr_share')}</button>` : ''}
      </div>
    </div>`);
  // null under a dialog that must be answered (openModal's hold).
  if (!modal) return;
  guardConvenienceModal(modal);
  bindRecScaler(modal, modal.querySelector('#rec-view-servings'), r.items || [], base);
  // «سجّل حصّة» (opts.log): the picker's «+» body — ONE SERVING as a single
  // row, the recipe read again by id (an edit or a delete since this sheet was
  // drawn wins), the bundle button's 800 ms guard against a double tap (a flag:
  // `disabled` on the focused button would drop focus to <body> on a refusal).
  const logBtn = modal.querySelector('[data-log-view]');
  let logBusy = false;
  if (logBtn) logBtn.addEventListener('click', () => {
    if (logBusy) return;
    logBusy = true; setTimeout(() => { logBusy = false; }, 800);
    const cur = DB.recipes.list().find((x) => x.id === r.id);
    if (!cur) { convenienceError({ ok: false, code: 'STALE' }); return; }
    const per = DB.recipes.perServing(cur);
    const result = DB.foodLogs.addMany(date || todayISO(), [{
      name: cur.name, servings: 1,
      calories: per.calories, protein: per.protein, carbs: per.carbs, fat: per.fat,
      source: 'recipe',
    }]);
    if (!result.ok) { convenienceError(result); return; }
    closeModal();
    if (typeof onSave === 'function') onSave();
    // A function, never a string, as the replacement: a name may hold «$&».
    offerUndo(t('rec_logged').replace('{name}', () => cur.name), result);
  });
  modal.querySelector('[data-edit-view]').addEventListener('click', () => {
    openRecipeEditor(date, r, logHere ? () => { if (typeof onSave === 'function') onSave(); } : () => openSavedFoodPicker(date, onSave, 'recipes'));
  });
  const shareBtn = modal.querySelector('[data-share-view]');
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    if (shareBtn.disabled) return;
    // Re-read by id: the marker is the truth, not what this sheet drew.
    const cur = DB.recipes.list().find((x) => x.id === r.id);
    if (!cur) { convenienceError({ ok: false, code: 'STALE' }); return; }
    // THE MARKER MOVED UNDER THIS SHEET (v420): automatic sharing published the
    // recipe while the button still read «شاركها» — or a pull took the marker
    // away under «أزل من المشاركة». The button no longer says what a tap would
    // do (a tap on «شاركها» would WITHDRAW the recipe), so the tap does nothing
    // but draw the view again, with the button that is true now.
    if (!!cur.shared !== drewShared) { openRecipeView(date, cur, onSave, opts); return; }
    if (!cur.shared) { openShareRecipe(cur, () => openRecipeView(date, cur, onSave, opts)); return; }
    if (!(window.Cloud && typeof Cloud.withdrawSharedRecipe === 'function')) { showToast(t('shr_withdraw_failed')); return; }
    shareBtn.disabled = true;
    const owner = Cloud.getLastUid();
    // «Not automatically» BEFORE the request (v420): an automatic re-share in
    // flight then takes its own fresh copy down (runAutoShare's approve branch
    // reads noAuto) instead of writing a marker this handler would clear
    // without withdrawing it. And a recipe with neither the marker nor this
    // flag is one automatic sharing would publish again by itself: if the
    // marker then fails to clear, the flag still stands and nothing is re-sent.
    const kept = DB.recipes.setNoAuto(cur.id, true);
    if (!kept || !kept.ok) { shareBtn.disabled = false; convenienceError(kept); return; }
    let res = null;
    try { res = await Cloud.withdrawSharedRecipe(cur.shared.id); } catch (_) { res = null; }
    // Another account signed in meanwhile: this blob is not the one asked about.
    if (Cloud.getLastUid() !== owner) return;
    // A refusal WITH a reason keeps the marker: the copy is still published.
    // {ok:false} with NO error is the database answering «nothing of yours by
    // that id» — already gone (a lost reply after an earlier withdraw, or the
    // owner removed it) — so the marker is cleared exactly as on success.
    if (!res || (!res.ok && res.error)) {
      // Still published: automatic sharing may follow it again — the flag goes
      // back to what it was before this tap.
      if (kept.changed) DB.recipes.setNoAuto(cur.id, false);
      shareBtn.disabled = false;
      showToast(res && res.error === 'offline' ? t('auth_err_network') : res && res.error === 'signin' ? t('shr_signin') : t('shr_withdraw_failed'));
      return;
    }
    const w = DB.recipes.setShared(cur.id, null);
    if (!w || !w.ok) { shareBtn.disabled = false; convenienceError(w); return; }
    // The list in memory (a 5-minute throttle, a 30-minute cache) still holds
    // the copy just withdrawn, and with the marker gone nothing leaves it out
    // any more: it would come back on the card as another user's recipe — the
    // user's own, with «أبلِغ» on it. It leaves now, as a reported row does.
    // `cur` is the recipe as it was BEFORE this write: its marker names the copy.
    shrForget(cur.shared.id);
    if (modal.isConnected && !modal.classList.contains('is-out')) openRecipeView(date, cur, onSave, opts);
    showToast(t('shr_withdrawn'));
  });
}

function openRecipeEditor(date, existing, onDone, opts) {
  // THE LEDGER (v411; the v301 list before it). «مش منظمة، زحمة» — the owner.
  //
  // One ingredient = ONE FIGURE ROW with no control painted on it: the kcal in
  // mono at the start, the name, one muted line (amount · macros). The row IS
  // the control: a tap swaps it, in place, for a compact EDIT STRIP (name and
  // amount, the four figures, the trash and «تم»), and only one strip is ever
  // open (openId). Servings and the totals are ONE bar on top of the sticky
  // Save, so the figure the food log receives is always on screen. An empty
  // recipe is two tiles, not a blank row.
  //
  // Two rules make it feel calm, and both are load-bearing:
  //   1. A ROW IS NEVER RE-RENDERED WHILE IT IS BEING USED. A strip is built
  //      once when it opens and replaced once when it closes; everything in
  //      between patches it in place (fill() → setFieldValues(), and
  //      updateSummary() touches only its two action buttons), so no field
  //      loses focus and no caret moves. The listeners on #rec-rows are
  //      delegated and bound once.
  //   2. A ROW AT REST CHANGES TEXT, NOT HEIGHT, when its figures land: the
  //      figure slot holds «—» or «…» until then, «تقدير» rides under the kcal
  //      in that fixed column, and the sub line (amount · three whole macros)
  //      is one line at 360px in both languages (measured). Only «Larger text»
  //      on a phone under 360px wraps it, and then as whole units (recJoin).
  var seq = 0;
  var newItem = function () { return { _id: ++seq, name: '', qty: '', calories: 0, protein: 0, carbs: 0, fat: 0 }; };
  var hasFigures = function (it) { return !!(Number(it.calories) || Number(it.protein) || Number(it.carbs) || Number(it.fat)); };
  // A new recipe opens on the two tiles, never on a phantom empty row.
  // A NAMED ROW WITH FOUR ZEROS (salt, water) is a deliberate zero, however it
  // arrives: an import's draft marks it so, and a SAVED recipe carries no mark at
  // all (recStoredItem strips them), so without this a reopened recipe armed the
  // row on Save, spent a model call the Worker answers with nothing, and was then
  // refused as «no figures» (the v416 review, F1). _zero says the zero came from
  // the import or from storage, not from the user: a name or amount edit lifts it
  // and the row is estimated like any other (F3). A figure typed by hand is
  // _manual alone and stays the user's. THE TRADE-OFF, named: storage cannot
  // tell a deliberate zero from a row saved before the named-zero guard (v398)
  // whose estimate had failed, so such a legacy row now reopens as a settled
  // zero; its name edit still re-estimates it.
  var items = existing && existing.items ? existing.items.map(function (i) {
    var it = Object.assign({ _id: ++seq }, i);
    if (String(it.name || '').trim() && !hasFigures(it)) { it._manual = true; it._zero = true; }
    return it;
  }) : [];
  var name = (existing && existing.name) || '';
  var servings = (existing && existing.servings) || 1;
  var saveWanted = false;
  var openId = null;      // the one row whose edit strip is open
  var view = 'per';       // the bar's reading while servings > 1: 'per' | 'total'
  var saved = false;      // set before a closeModal that hands the screen on (a save, the import): opts.onClose stays quiet
  var lastPer = null;     // the per-serving kcal last painted, for the one colour step
  var reduced = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  // A DRAFT is `existing` without an id: what «استخراج وصفة» hands over for
  // review (openRecipeImport). It is titled as a review, its note (what the
  // import could not use) stays under the title, and its save is an ADD.
  var isDraft = !!(existing && !existing.id);
  var draftNote = isDraft && existing.note ? String(existing.note) : '';

  // The servings input's aria-label — the one place the number is SPOKEN beside
  // a noun. It is not painted a second time: the digit is already on screen.
  var servLabel = function (n) { return recServLabel(n); };

  // state (idle · pending · fail · done) and source (local · ai · manual ·
  // saved), derived from the transient flags. _manual is a SOURCE, not a state:
  // a row the user deliberately zeroed reads done/manual.
  var rowState = function (it) {
    var pending = it._auto === 'pending' || it._auto === 'sent';
    var failed = it._auto === 'fail';
    var done = !pending && !failed && (hasFigures(it) || it._manual);
    return { state: pending ? 'pending' : failed ? 'fail' : done ? 'done' : 'idle', src: done ? (it._src || 'saved') : '' };
  };
  // THE ROW AT REST: the figure first (figRowFig, the app's list idiom), the
  // name, one muted line. Macros are WHOLE numbers here (the strip keeps the
  // decimal): that is what keeps the line whole at 354px. «تقدير» sits UNDER
  // the kcal, in the figure's fixed column: at the end of the sub line it
  // wrapped alone onto a second line at 360px, so a row grew 72 → 88 the moment
  // its estimate landed (the v411 review).
  var doorInner = function (it) {
    var st = rowState(it);
    var n = function (v) { return '<span class="num">' + fmtNum(Math.round(Number(v) || 0)) + '</span>'; };
    var nm = String(it.name || '').trim(), q = String(it.qty == null ? '' : it.qty).trim();
    var said = function (s) { return ['<span class="rec-sub-t">' + escapeHtml(s) + '</span>']; };
    var sub = st.state === 'pending' ? said(t('rec_st_pending'))
      : st.state === 'fail' ? said(it._why === 'signin' ? t('rec_st_signin') : t('rec_st_fail'))
      : st.state === 'done' ? [n(it.protein) + '\u00a0' + t('protein_label'), n(it.carbs) + '\u00a0' + t('carbs_label'), n(it.fat) + '\u00a0' + t('fat_label')]
      : said(t('rec_row_hint'));
    // The source word is ALWAYS in the accessible name; only the estimate is
    // painted, so colour never carries meaning on its own.
    var fig = figRowFig(st.state === 'done' ? fmtNum(Math.round(Number(it.calories) || 0)) : st.state === 'pending' ? '…' : '—', st.state === 'done' ? t('cal') : '');
    if (st.state === 'done' && st.src === 'ai') fig = fig.replace(/<\/div>$/, '<span class="rec-tag">' + t('rec_tag_ai') + '</span></div>');
    var sr = st.state === 'done' && st.src !== 'ai' ? '<span class="sr-only"> · ' + t('rec_tag_' + st.src) + '</span>' : '';
    return '<div class="fig-row-main">' + fig +
      '<div class="fig-row-text"><span class="fig-row-title' + (nm ? '' : ' is-ghost') + '" dir="auto">' + escapeHtml(nm || t('rec_ing_name')) + '</span>' +
      // The amount is words as often as digits («٣ أكواب»), so it keeps the text
      // face: .num's mono spaces Arabic letters apart.
      '<span class="fig-row-sub">' + recJoin([q ? '<span class="rec-qty-t" dir="auto">' + escapeHtml(q) + '</span>' : ''].concat(sub)) + sr + '</span></div></div>';
  };
  // No aria-label on the door: the content (figure, name, amounts, the source
  // word) is exactly what a screen reader must read. No aria-expanded either:
  // the door never exists open — the strip REPLACES it, and the strip is a
  // group named by its ingredient, so the reader says which row is being edited.
  var doorHtml = function (it) {
    return '<button type="button" class="data-row fig-row rec-door" data-open>' + doorInner(it) + '</button>';
  };
  var stripName = function (it) { return String(it.name || '').trim() || t('rec_ing_name'); };
  var rowHtml = function (it) {
    return '<div class="rec-row" data-id="' + it._id + '" data-state="idle" data-src="">' + doorHtml(it) + '</div>';
  };
  // THE EDIT STRIP: line 1 name + amount, line 2 the four figures, line 3 the
  // trash at the start and «تم» at the end — a fixed-height line whatever the
  // row's state, so opening and settling never move line 1.
  var stripHtml = function (it) {
    var fld = function (f, cap, step, mode, hint) {
      return '<label class="rec-f"><span class="rec-cap">' + cap + '</span>' +
        '<input type="number" data-f="' + f + '" inputmode="' + mode + '" min="0" step="' + step + '"' +
        // A row with no figures yet shows empty cells, never four literal zeros
        // (typing after the 0 read «0410»); the caption is the cue. A figure the
        // user set, zero included, is shown as set.
        ' enterkeyhint="' + hint + '" aria-label="' + escapeHtml(cap) + '" value="' + (hasFigures(it) || it._manual ? numAttr(it[f]) : '') + '"></label>';
    };
    // tabindex -1: a tap on a row moves focus INTO its strip (a screen reader
    // lands inside it, on a group named by the ingredient) without raising a
    // keyboard over the figures.
    return '<div class="rec-strip" tabindex="-1" role="group" aria-label="' + escapeHtml(stripName(it)) + '">' +
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
      '</div>' +
      '<div class="rec-figs">' +
        fld('calories', t('cal'), '1', 'numeric', 'next') +
        fld('protein', t('protein_label'), '0.1', 'decimal', 'next') +
        fld('carbs', t('carbs_label'), '0.1', 'decimal', 'next') +
        fld('fat', t('fat_label'), '0.1', 'decimal', 'done') +
      '</div>' +
      '<div class="rec-strip-foot">' +
        '<button type="button" class="rec-del" data-del aria-label="' + escapeHtml(t('rec_del_ing')) + '">' + icon('trash', 16) + '</button>' +
        '<span class="rec-strip-gap"></span>' +
        // The AI's part in this row, said where it acts (v416, owner: «خلّي فيه
        // شي يدل على التحليل بالذكاء الاصطناعي»): the sparkle «استخراج وصفة»
        // wears, pulsing while the figures are out, then naming them as its
        // estimate. A failed row says it through its retry instead, so the two
        // never stand side by side. updateSummary is the one writer.
        '<span class="rec-ai" data-ai-status role="status" hidden>' + icon('sparkle', 16) + '<span class="rec-ai-t"></span></span>' +
        '<button type="button" class="rec-act" data-retry hidden>' + icon('sparkle', 16) + ' ' + t('rec_retry_ai') + '</button>' +
        '<button type="button" class="rec-act" data-recompute hidden>' + icon('refresh', 16) + ' ' + t('rec_recompute') + '</button>' +
        '<button type="button" class="btn btn-ghost rec-done" data-done>' + t('rec_row_done') + '</button>' +
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

  // The bar's four visible figures follow the chosen reading; the eight
  // [data-t]/[data-p] cells hold both readings, every one of them in the DOM.
  var shown = function (f, key) { return '<span class="num" data-show="' + f + '">0</span>\u00a0' + key; };
  var cells = ['calories', 'protein', 'carbs', 'fat'].map(function (f) { return '<span data-t="' + f + '">0</span><span data-p="' + f + '">0</span>'; }).join('');
  var overlay = openModal('' +
    '<div class="modal-header">' +
      '<div><div class="modal-title">' + (existing && existing.id ? escapeHtml(existing.name) : isDraft ? t('rx_review_title') : t('rec_new')) + '</div>' +
      // A draft's note stays: it says what the import could not use (the sound,
      // or all but its first seconds), and a 1.8 s toast is too short for that.
      (draftNote ? '<div class="modal-subtitle" id="rec-sub">' + escapeHtml(draftNote) + '</div>' : '') + '</div>' +
      '<button class="icon-btn icon-btn-tile" data-close>' + icon('close', 20) + '</button>' +
    '</div>' +
    '<input type="text" id="rec-name" class="input rec-name-top" maxlength="60" enterkeyhint="next" placeholder="' + escapeHtml(t('rec_name_ph')) + '" aria-label="' + escapeHtml(t('rec_name_ph')) + '" value="' + escapeHtml(name) + '">' +
    '<div id="rec-rows" class="rec-list"></div>' +
    '<button type="button" class="ledger-add rec-add" id="rec-add">' + icon('plus', 14) + ' <span>' + t('rec_add_ing') + '</span></button>' +
    '<div class="rec-foot">' +
      // ONE bar: the servings stepper, the reading (only when it has two), and
      // the figure the food log will receive. No border: the bar is not a control.
      '<div class="rec-bar" id="rec-totals">' +
        '<div class="rec-bar-top">' +
          '<span class="rt-step">' +
            '<button type="button" data-step="-1" aria-label="' + escapeHtml(t('rec_serv_less')) + '">' + icon('minus', 16) + '</button>' +
            '<input type="number" id="rec-servings" class="num" inputmode="numeric" min="1" max="99" step="1" value="' + numAttr(servings) + '" aria-label="' + escapeHtml(servLabel(servings)) + '">' +
            '<button type="button" data-step="1" aria-label="' + escapeHtml(t('rec_serv_more')) + '">' + icon('plus', 16) + '</button>' +
          '</span>' +
          '<div class="rec-reading" role="group" aria-label="' + escapeHtml(t('rec_view_group')) + '" hidden>' +
            '<button type="button" data-reading="per" aria-pressed="true">' + t('rec_per') + '</button>' +
            '<button type="button" data-reading="total" aria-pressed="false">' + t('rec_total') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="rec-bar-figs">' +
          '<span class="rec-bar-val"><span class="num rec-bar-kcal" data-show="calories">0</span><span class="rec-bar-unit">' + t('cal') + '</span></span>' +
          '<span class="rec-bar-macros">' + recJoin([shown('protein', t('protein_label')), shown('carbs', t('carbs_label')), shown('fat', t('fat_label'))]) + '</span>' +
        '</div>' +
        '<div class="rec-bar-data" hidden>' + cells + '</div>' +
      '</div>' +
      '<div class="form-actions sticky-actions">' +
        '<button type="button" class="btn btn-primary" id="rec-save">' + t('rec_save') + '</button>' +
      '</div>' +
    '</div>');

  if (!overlay) return;   // a dialog that must be answered is up
  var host = overlay.querySelector('#rec-rows');
  // Items are addressed by their transient _id, NEVER by index: an index shifts
  // the moment a row above is deleted, and a reply that lands after that would
  // paint the chicken's figures onto the rice.
  var rowOf = function (it) { return it ? host.querySelector('.rec-row[data-id="' + it._id + '"]') : null; };
  var byId = function (id) { for (var i = 0; i < items.length; i++) if (items[i]._id === id) return items[i]; return null; };
  var itemOf = function (el) { var r = el.closest ? el.closest('.rec-row') : null; return r ? byId(Number(r.dataset.id)) : null; };
  var scroller = function () {
    for (var el = host.parentElement; el && el !== document.body; el = el.parentElement) { var o = getComputedStyle(el).overflowY; if (o === 'auto' || o === 'scroll') return el; }
    return null;
  };

  // ---- ONE writer for a row's state ----------------------------------------
  // At rest it repaints the door's content. In EDIT it touches only the strip's
  // two action buttons: the strip holds a caret and is never rebuilt under it.
  function updateSummary(it) {
    var row = rowOf(it); if (!row) return;
    var st = rowState(it);
    row.dataset.state = st.state;
    row.dataset.src = st.src;
    if (it._why) row.dataset.why = it._why; else row.removeAttribute('data-why');
    if (row.classList.contains('is-edit')) {
      var retry = row.querySelector('[data-retry]'), recompute = row.querySelector('[data-recompute]');
      var canCompute = String(it.name || '').trim().length >= 3;
      if (retry) retry.hidden = st.state !== 'fail';
      if (recompute) recompute.hidden = !(st.state === 'done' && (st.src === 'manual' || st.src === 'saved') && canCompute);
      var ai = row.querySelector('[data-ai-status]');
      if (ai) {
        var aiSays = st.state === 'pending' ? t('rec_ai_pending') : st.state === 'done' && st.src === 'ai' ? t('rec_ai_done') : '';
        ai.hidden = !aiSays;
        ai.classList.toggle('is-busy', st.state === 'pending');
        var aiT = ai.querySelector('.rec-ai-t');
        if (aiT && aiT.textContent !== aiSays) aiT.textContent = aiSays;   // unchanged text is not re-announced
      }
      return;
    }
    var door = row.querySelector('.rec-door');
    if (door) door.innerHTML = doorInner(it);
  }
  // Opens ONE row's strip (closing any other). `focusSel` names the field that
  // takes the caret — the name for a row just added, the kcal cell for a row the
  // save refused; a plain tap focuses the strip itself and raises no keyboard.
  function openRow(it, focusSel) {
    if (!it) return;
    if (openId !== null && openId !== it._id) closeRow(byId(openId), false);
    var row = rowOf(it); if (!row) return;
    if (!row.classList.contains('is-edit')) {
      openId = it._id;
      row.classList.add('is-edit');
      row.innerHTML = stripHtml(it);
      updateSummary(it);
    }
    var target = row.querySelector(focusSel || '.rec-strip');
    if (target) target.focus({ preventScroll: true });
    reveal(it);
    // Again once the strip has grown to its full height (the 180 ms open).
    if (!reduced()) setTimeout(function () { reveal(it); }, 200);
  }
  // THE STICKY FOOT (the bar and Save, ~200px) sits OVER the bottom of the
  // list, and scrollIntoView ignores it: a strip opened at the end of a long
  // recipe put «تم» under the bar, and with the keyboard up the field being
  // typed in too (the v411 review, 360×360). This scrolls the sheet so the open
  // strip — or, when it is taller than the room left, the field holding the
  // caret — sits between the sheet's top and the foot (and the keyboard, which
  // visualViewport reports). On a short viewport (the keyboard up) the bar
  // folds to its figure line while a strip is open: the stepper is not what is
  // being typed, and the room is.
  function fitFoot() {
    var vv = window.visualViewport;
    overlay.classList.toggle('rec-tight', openId !== null && (vv ? vv.height : window.innerHeight) < 600);
    var sc = scroller(), foot = overlay.querySelector('.rec-foot');
    // The browser's own focus scroll (the keyboard rising) honours this.
    if (sc && foot) sc.style.scrollPaddingBottom = foot.offsetHeight + 'px';
  }
  function reveal(it) {
    var row = rowOf(it); if (!row || !row.classList.contains('is-edit') || !overlay.isConnected) return;
    fitFoot();
    var sc = scroller(); if (!sc) return;
    var foot = overlay.querySelector('.rec-foot'), vv = window.visualViewport;
    var top = Math.max(sc.getBoundingClientRect().top, vv ? vv.offsetTop : 0) + 8;
    var bottom = Math.min(foot ? foot.getBoundingClientRect().top : Infinity, vv ? vv.offsetTop + vv.height : window.innerHeight) - 8;
    var r = row.getBoundingClientRect(), a = document.activeElement;
    var f = a && a.tagName === 'INPUT' && row.contains(a) ? a.getBoundingClientRect() : null;
    var box = r.height <= bottom - top || !f ? r : f;
    var dy = box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : box.top < top ? box.top - top : 0;
    if (dy) sc.scrollTop += dy;
  }
  // Closes a strip back into its door. A row that holds nothing at all is not
  // kept: it was an «add» that was not used, and it is dropped without a word.
  // A committed row is a row LEFT, so a weightless one is armed here (the
  // settled path of scheduleAuto) instead of waiting for a focusout.
  function closeRow(it, focusDoor) {
    if (!it) { openId = null; return; }
    if (openId === it._id) openId = null;
    var row = rowOf(it);
    if (!row || !row.classList.contains('is-edit')) return;
    if (!String(it.name || '').trim() && !String(it.qty || '').trim() && !hasFigures(it) && !it._manual) {
      var at = items.indexOf(it); if (at >= 0) items.splice(at, 1);
      row.remove();
      if (!items.length) renderEmpty();
      syncAdd(); drawTotals(); fitFoot();
      if (focusDoor) { var a = overlay.querySelector(items.length ? '#rec-add' : '#rec-add-first'); if (a) a.focus({ preventScroll: true }); }
      return;
    }
    row.classList.remove('is-edit');
    row.innerHTML = doorHtml(it);
    updateSummary(it);
    scheduleAuto(it, true);
    fitFoot();
    if (focusDoor) { var d = row.querySelector('.rec-door'); if (d) d.focus({ preventScroll: true }); }
  }

  // ---- rendering: whole rows only at open and on undo ----------------------
  // THE EMPTY RECIPE: two tiles (the import sheet's own tile shape), not a
  // blank row. The import is offered for a NEW recipe only: an edit and an
  // imported draft already hold their ingredients.
  function renderEmpty() {
    openId = null;
    var tile = function (attrs, ic, title, sub) {
      return '<button type="button" class="ai-capture" ' + attrs + '><span class="ai-capture-icon">' + icon(ic, 28) + '</span>' +
        '<span class="rx-tile-text"><span class="ai-capture-title">' + title + '</span><span class="ai-capture-sub">' + sub + '</span></span></button>';
    };
    host.innerHTML = '<div class="rec-empty ai-capture-row rx-tiles">' +
      tile('id="rec-add-first" data-add', 'plus', t('rec_add_ing'), t('rec_empty_add_sub')) +
      (existing ? '' : tile('id="rec-import"', 'sparkle', t('rec_empty_import'), t('rec_empty_import_sub'))) + '</div>';
  }
  // «أضف مكوّنًا» under the list: absent in the empty state (the tile is the
  // add) and at the 30-row cap (a state the user can see needs no toast).
  function syncAdd() {
    var add = overlay.querySelector('#rec-add');
    if (add) add.hidden = !items.length || items.length >= 30;
  }
  function drawRows() {
    openId = null;
    if (!items.length) renderEmpty();
    else { host.innerHTML = items.map(rowHtml).join(''); items.forEach(updateSummary); }
    syncAdd(); drawTotals();
  }
  function appendRow(it) { host.insertAdjacentHTML('beforeend', rowHtml(it)); updateSummary(it); }
  function addRow() {
    if (items.length >= 30) return;
    if (openId !== null) closeRow(byId(openId), false);
    if (!items.length) host.innerHTML = '';   // the tiles give way to the list
    var it = newItem();
    items.push(it);
    appendRow(it);
    openRow(it, '[data-f="name"]');
    syncAdd(); drawTotals();
  }

  function drawTotals(fromReply) {
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
    // At one serving the two readings are the same number, so the choice is
    // not offered and nothing names it. Per serving is the default: it is what
    // logging the recipe writes.
    var seg = overlay.querySelector('.rec-reading');
    seg.hidden = n === 1;
    if (n === 1) view = 'per';
    seg.querySelectorAll('[data-reading]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.reading === view ? 'true' : 'false'); });
    var whole = view === 'total';
    ['calories', 'protein', 'carbs', 'fat'].forEach(function (f) {
      put('[data-show="' + f + '"]', whole ? (f === 'calories' ? Math.round(tot[f]) : Math.round(tot[f] * 10) / 10) : per[f]);
    });
    var kc = overlay.querySelector('.rec-bar-kcal');
    kc.classList.toggle('is-whole', whole);
    // One colour step when a reply moves the logged figure — no counting, no bounce.
    if (fromReply && !whole && lastPer !== null && per.calories !== lastPer && !reduced()) {
      kc.classList.remove('is-bump'); void kc.offsetWidth; kc.classList.add('is-bump');
    }
    lastPer = per.calories;
  }

  // ---- AUTOMATIC FIGURES ---------------------------------------------------
  // The owner's ask: write the ingredient and its weight, the rest fills itself.
  // Order of preference per row: a food this user (or the curated catalog) already
  // holds with a gram serving — scaled, instant, offline; otherwise the AI, ONE
  // request for every row still waiting (the Worker's free quota is per day, so
  // eight ingredients must not be eight calls). A hand-typed figure wins forever
  // (_manual). The flags are transient: stripped on save.
  var autoTimer = null;
  // latinDigits() and parseGrams() live at module scope now, above recScaleQty:
  // the scaler reads the same field, and the two must agree on what a comma is.
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
    drawTotals(true);
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
    var failed = [], signin = false, firstErr = null;
    for (var b = 0; b < batches.length; b++) {
      var batch = batches[b];
      var got = [];
      try {
        var res = await FoodAI.analyze(batch.map(function (p) { return p.line; }).join('\n'), { skipLocal: true });   // never the pasted-label parser: '30 g protein powder' is food, not a macro
        got = (res && res.items) || [];
      } catch (err) {
        if (/unauthorized|sign/i.test((err && err.message) || '')) signin = true;
        firstErr = firstErr || err;
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
        if (m && (m.calories || m.protein || m.carbs || m.fat)) { it._wasZero = false; fill(it, m, 'ai'); }
        // A row renamed from one zero to another («salt» → «sea salt»): the
        // service ANSWERED and priced it at nothing (the Worker drops an
        // all-zero row). That is the AI's zero, settled as a zero — not a
        // failure the named-zero guard then refuses. An error is still a failure.
        else if (it._wasZero && got) { it._wasZero = false; it._manual = true; it._zero = true; it._auto = null; it._src = 'ai'; it._why = null; updateSummary(it); }
        else { settle(it, 'fail', signin ? 'signin' : 'ai'); failed.push(it.name); }
      });
    }
    drawTotals(true);
    // A refusal with a REASON says the reason. The daily limit lasts until
    // midnight, and «could not work out X — type its figures by hand» hid that,
    // as it hid a timeout or a dropped connection. Anything unspecific keeps
    // the per-row line, which at least names the rows.
    var why = firstErr && window.FoodAI && FoodAI.friendlyErr ? FoodAI.friendlyErr(firstErr) : '';
    var named = why && ['ai_daily_limit', 'ai_rate_limit', 'ai_err_busy', 'ai_err_timeout', 'ai_err_service', 'auth_err_network'].some(function (k) { return why === t(k); });
    if (signin) showToast(t('rec_auto_signin'));
    else if (failed.length) showToast(named ? why : t('rec_auto_fail').replace('{name}', failed.join('، ')));
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
      // A zero the import or storage set (_zero) described the OLD row: once
      // its NAME changes it is estimated again (F3). An amount alone does not
      // lift it — two teaspoons of salt are still zero, and lifting it sent a
      // call the Worker answers with nothing, then refused the Save (the
      // review of the fixes). _wasZero lets an answered zero settle as one.
      if (it._zero && f === 'name') { it._zero = false; it._wasZero = true; it._manual = false; it._auto = null; it._src = null; it._why = null; }
      if (f === 'name') { var grp = inp.closest('.rec-strip'); if (grp) grp.setAttribute('aria-label', stripName(it)); }
      scheduleAuto(it);
      updateSummary(it);
    } else {
      it[f] = parseFloat(inp.value) || 0;
      // A figure typed by hand is the user's number: never overwritten. Only
      // the explicit "compute again" button clears this.
      it._manual = true; it._zero = false; it._wasZero = false; it._auto = null; it._src = 'manual'; it._why = null;
      updateSummary(it);
    }
    saveWanted = false; setWaiting(false);
    drawTotals();
  });
  host.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-open],[data-done],[data-del],[data-retry],[data-recompute],[data-add],#rec-import') : null;
    if (!el) return;
    if (el.hasAttribute('data-add')) { addRow(); return; }
    // The editor closes FIRST, and the import is handed the SAME onDone, so the
    // draft it brings back saves to where this sheet's own save would have gone.
    if (el.id === 'rec-import') { saved = true; closeModal(); openRecipeImport(date, onDone); return; }
    var it = itemOf(el); if (!it) return;
    if (el.hasAttribute('data-open')) { openRow(it); return; }
    if (el.hasAttribute('data-done')) { closeRow(it, true); return; }
    if (el.hasAttribute('data-del')) { removeRow(it); return; }
    if (el.hasAttribute('data-retry')) { it._auto = null; it._why = null; scheduleAuto(it, true); return; }
    if (el.hasAttribute('data-recompute')) {
      it._manual = false; it._zero = false; it._wasZero = false; it._src = null; it._why = null; it._auto = null;
      it.calories = 0; it.protein = 0; it.carbs = 0; it.fat = 0;
      var row = rowOf(it);
      ['calories', 'protein', 'carbs', 'fat'].forEach(function (f) { var i2 = row.querySelector('input[data-f="' + f + '"]'); if (i2) i2.value = ''; });
      scheduleAuto(it, true); drawTotals();
    }
  });
  // Leaving a row is what arms a WEIGHTLESS row's estimate — see scheduleAuto.
  // A null relatedTarget (tapped a non-focusable area, or the window lost focus)
  // counts as leaving: the row is not being worked on either way. Bound once,
  // like the other three; focusout bubbles, blur does not.
  host.addEventListener('focusin', function (e) {
    var it = openId !== null ? itemOf(e.target) : null;
    if (it && it._id === openId) reveal(it);
  });
  // The keyboard rising or falling moves the foot's top: the open strip follows.
  var onViewport = function () { if (openId !== null && overlay.isConnected) reveal(byId(openId)); };
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewport);
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
    var focus = function (sel) { var el = row.querySelector(sel); if (el) el.focus(); };
    // A blank name goes nowhere, silently: its placeholder already says what is missing.
    var blankName = !String(it.name || '').trim();
    if (f === 'name') { if (!blankName) focus('[data-f="qty"]'); return; }
    // Enter on the amount COMMITS the row and opens the next one on its name,
    // in one keystroke, so a recipe is typed name ⏎ amount ⏎ name ⏎ … and the
    // keyboard never drops. The last row grows a fresh one.
    if (f === 'qty') {
      if (blankName) { focus('[data-f="name"]'); return; }
      var next = row.nextElementSibling ? itemOf(row.nextElementSibling) : null;
      // At the 30-row cap there is no next row to open: the committed row's own
      // door takes the focus, so it never falls to <body> with the keyboard.
      var full = !next && items.length >= 30;
      closeRow(it, full);
      if (next) openRow(next, '[data-f="name"]'); else if (!full) addRow();
      return;
    }
    var order = ['calories', 'protein', 'carbs', 'fat'];
    var i = order.indexOf(f);
    if (i >= 0 && i < order.length - 1) focus('[data-f="' + order[i + 1] + '"]');
    else if (i === order.length - 1) closeRow(it, true);
  });
  // Escape inside an open strip closes the STRIP, not the sheet. openModal's own
  // Escape listener is a capture on document; this one is a capture on window,
  // which runs first. It leaves with the sheet (the observer below).
  var onEscape = function (e) {
    if (e.key !== 'Escape' || openId === null || !overlay.isConnected) return;
    var row = rowOf(byId(openId));
    if (!row || !row.contains(document.activeElement)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    closeRow(byId(openId), true);
  };
  window.addEventListener('keydown', onEscape, true);

  function removeRow(it) {
    var at = items.indexOf(it); if (at < 0) return;
    items.splice(at, 1);
    if (openId === it._id) openId = null;
    var row = rowOf(it);
    // Focus must not fall to <body> with the row (the trash is inside it): it
    // goes to the next row's door, else the one before, else — the last row
    // gone — the add tile the empty state brings back.
    var had = !!row && (row.contains(document.activeElement) || document.activeElement === document.body);
    var near = items[at] || items[at - 1] || null;
    var nearDoor = near && rowOf(near) ? rowOf(near).querySelector('.rec-door') : null;
    if (row) row.removeAttribute('data-id');   // no reply (and no focusout) may land on a row that is leaving
    // The last row leaves the empty state (its two tiles), never a fresh blank row.
    var gone = function () {
      if (row) row.remove();
      if (!items.length && !host.querySelector('.rec-row')) renderEmpty();
      syncAdd();
      if (had && !nearDoor) { var a = overlay.querySelector(items.length ? '#rec-add' : '#rec-add-first'); if (a) a.focus({ preventScroll: true }); }
    };
    if (had && nearDoor) nearDoor.focus({ preventScroll: true });
    if (row && !reduced()) {
      // The row folds away (160 ms) before it is removed; under reduced motion it simply goes.
      row.style.maxHeight = row.offsetHeight + 'px'; void row.offsetHeight;
      row.classList.add('is-leaving'); row.style.maxHeight = '0px';
      setTimeout(gone, 170);
    } else gone();
    fitFoot();
    drawTotals();
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
    var pick = e.target.closest ? e.target.closest('[data-reading]') : null;
    if (pick) { view = pick.dataset.reading === 'total' ? 'total' : 'per'; drawTotals(); return; }
    var b = e.target.closest ? e.target.closest('[data-step]') : null;
    if (!b) return;
    var v = Math.min(99, Math.max(1, (parseInt(servInput.value, 10) || 1) + Number(b.dataset.step)));
    servInput.value = v;
    servInput.setAttribute('aria-label', servLabel(v));
    drawTotals();
  });
  overlay.querySelector('#rec-add').addEventListener('click', addRow);
  // Enter on the recipe's name goes on to the first ingredient — a new one
  // when there is none yet.
  overlay.querySelector('#rec-name').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!items.length) addRow(); else openRow(items[0], '[data-f="name"]');
  });

  function setWaiting(on) {
    var b = overlay.querySelector('#rec-save');
    if (!b) return;
    b.classList.toggle('is-waiting', !!on);
    b.textContent = on ? t('rec_save_wait') : t('rec_save');
  }
  function finishSaveIfWanted(ok) {
    // A sheet that has left (closed, or on its way out) saves nothing: its
    // trySave would add a recipe the user walked away from and close whatever
    // sheet is on top now (the dish chooser).
    if (!saveWanted || !overlay.isConnected || overlay.classList.contains('is-out')) { saveWanted = false; return; }
    saveWanted = false; setWaiting(false);
    if (ok) trySave();
  }
  function trySave() {
    var nm = overlay.querySelector('#rec-name').value.trim();
    // A recipe with no name is refused BY NAME. DB.recipes refuses it anyway,
    // and the old fall-through said «add at least one ingredient with numbers»
    // over a sheet full of them — the draft an import hands over often has none.
    if (!nm) {
      showToast(t('rec_need_title'));
      var ne = overlay.querySelector('#rec-name'); if (ne) ne.focus();
      return;
    }
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
    // A row with NEITHER a name NOR a figure is not an ingredient: it is the
    // empty row that Enter on the last amount, «+ add ingredient» and
    // removeRow's safety row all create. cleanMealItems refuses the WHOLE list
    // when one item has no name — that protects the blob, and it stays — so
    // sending that row made an ordinary recipe unsaveable behind «add at least
    // one ingredient with numbers». It is dropped from what is SENT, never from
    // the screen, so a save refused below leaves every row where it was.
    var kept = items.filter(function (it) { return String(it.name || '').trim() || hasFigures(it); });
    // A row WITH figures and no name would be refused the same way: it is named
    // as the problem instead, and the cursor goes to the name it is missing.
    var nameless = kept.filter(function (it) { return !String(it.name || '').trim(); });
    if (nameless.length) {
      showToast(t('rec_need_name'));
      openRow(nameless[0], '[data-f="name"]');
      return;
    }
    // cleanMealItems accepts a NAMED row with four zeros, so such a row would
    // save as zeros and the recipe under-count forever — and perServing is what
    // the food log receives. A row the user deliberately zeroed carries _manual
    // and passes.
    var blank = kept.filter(function (it) { return !hasFigures(it) && !it._manual; });
    if (blank.length) {
      showToast(t('rec_need_figs').replace('{name}', String(blank[0].name).trim()));
      openRow(blank[0], '[data-f="calories"]');
      return;
    }
    var payload = { name: nm, servings: n, items: kept.map(recStoredItem) };
    // A draft has no id: it is ADDED. (It used to work only because
    // update(undefined) happens to create a recipe.)
    var made = existing && existing.id ? DB.recipes.update(existing.id, payload) : DB.recipes.add(payload);
    if (!made) { showToast(t(DB.saveState().ok ? 'rec_need_ing' : 'sc_failed')); return; }
    saved = true;
    // Automatic sharing (v420), trigger 1 of 3: a saved recipe — new or edited
    // — is queued; autoShareWants() decides whether anything is sent for it.
    queueAutoShare([made.id]);
    closeModal();
    // Back in the dish chooser (opts.onClose), the saved card's «حُفظت» is the
    // confirmation: a toast there covered the very mark it repeats.
    if (!(opts && typeof opts.onClose === 'function')) showToast(t('rec_saved'));
    // The saved recipe rides along: the dish chooser marks its card with it.
    if (typeof onDone === 'function') onDone(made);
  }
  overlay.querySelector('#rec-save').addEventListener('click', trySave);

  // The sheet leaving (closeModal marks it .is-out, or a new sheet replaces it)
  // takes the Escape listener with it — and, when the caller asked, says so:
  // the dish chooser comes back when a dish is closed without being saved.
  // Only when nothing else took the screen: a sheet that replaced this one keeps it.
  var watch = new MutationObserver(function () {
    if (overlay.isConnected && !overlay.classList.contains('is-out')) return;
    watch.disconnect();
    // A Save still waiting for a figure leaves with the sheet: the timer would
    // otherwise fire ~0.9 s later and save the dish the user just closed.
    clearTimeout(autoTimer); autoTimer = null; saveWanted = false;
    window.removeEventListener('keydown', onEscape, true);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', onViewport);
    if (saved || !(opts && typeof opts.onClose === 'function')) return;
    if (document.querySelector('#modal-root .modal-overlay:not(.is-out)')) return;
    opts.onClose();
  });
  watch.observe(document.getElementById('modal-root'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  drawRows();
  // A new recipe wants the name; an existing one must NOT pop a keyboard over
  // figures the user came to read — nor must a draft that already has a name.
  if (!existing || (isDraft && !name)) setTimeout(function () { var el = overlay.querySelector('#rec-name'); if (el) el.focus(); }, 60);
}
// ===========================================================================
// «استخراج وصفة» — a recipe from a gallery clip, a link, a photo or pasted
// text, handed to the recipe editor as a DRAFT to review before it is saved.
// Three stages in ONE closure (contract 36 sees one open*): the source sheet,
// the confirm stage (the same sheet re-rendered), and a HELD processing sheet
// that only its own cancel closes. The clip is read on the phone
// (FoodAI.decomposeVideo) — the file itself never leaves it — and the one
// Worker call is FoodAI.analyzeRecipe.
// ===========================================================================
function openRecipeImport(date, onDone) {
  const owner = Cloud.getLastUid();
  const VIDEO_EXT = /\.(mp4|m4v|mov|webm|3gpp?|mkv)$/i;
  const TILES = [['video', 'play', t('rx_src_video'), t('rx_src_video_sub')], ['link', 'globe', t('rx_src_link'), t('rx_src_link_sub')],
    ['image', 'gallery', t('rx_src_image'), t('rx_src_image_sub')], ['text', 'edit', t('rx_src_text'), t('rx_src_text_sub')]];
  const overlay = openModal(`
    <div class="modal-header"><div class="modal-title">${t('rx_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button></div>
    <div class="rx-body"></div>`);
  if (!overlay) return;   // a dialog that must be answered is up
  guardConvenienceModal(overlay);
  const body = overlay.querySelector('.rx-body');
  let source = null, pick = null;   // pick: { file } for a clip, { pic } for a prepared photo
  // Bumped by every stage drawn and every file chosen: a photo still being
  // prepared when the user has moved on (a newer photo, the text tile) is
  // dropped when it lands, never drawn over the newer choice.
  let pickSeq = 0;

  // A re-render replaces the control that had focus, so each stage hands it on
  // (`refocus`): the sheet's first control, never <body>. The first render
  // leaves it to openModal, which focuses the dialog itself.
  function drawSources(refocus) {
    source = null; pick = null; pickSeq++;
    body.innerHTML = `<div class="ai-capture-row rx-tiles">${TILES.map(([kind, ic, title, sub]) => `
        <button type="button" class="ai-capture" data-rx-pick="${kind}">
          <span class="ai-capture-icon">${icon(ic, 28)}</span>
          <span class="rx-tile-text"><span class="ai-capture-title">${title}</span><span class="ai-capture-sub">${sub}</span></span>
        </button>`).join('')}</div>
      <!-- No capture attribute: both go to the system picker, which needs no permission. -->
      <input type="file" accept="video/*" data-rx-file="video" hidden>
      <input type="file" accept="image/*" data-rx-file="image" hidden>
      <p class="rx-hint">${t('rx_privacy')}</p>`;
    body.querySelectorAll('[data-rx-pick]').forEach((b) => b.addEventListener('click', () => {
      const kind = b.dataset.rxPick;
      if (kind === 'video' || kind === 'image') { body.querySelector(`[data-rx-file="${kind}"]`).click(); return; }
      source = kind; drawConfirm();
    }));
    body.querySelectorAll('[data-rx-file]').forEach((input) => input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      chosen(input.dataset.rxFile, file);
    }));
    if (refocus === true) body.querySelector('[data-rx-pick]').focus();
  }
  async function chosen(kind, file) {
    if (!file || !overlay.isConnected) return;
    if (kind === 'video') {
      // Android hands over content:// files with no type at all: the name decides then.
      if (!/^video\//.test(file.type || '') && !VIDEO_EXT.test(file.name || '')) { showToast(t('rx_bad_file')); return; }
      source = 'video'; pick = { file }; drawConfirm();
      return;
    }
    // A photo is prepared NOW, so the confirm stage shows exactly what will be read.
    if (!window.FoodAI) { showToast(t('rx_unavailable')); return; }
    const mine = ++pickSeq;
    let pic = null;
    try { pic = await FoodAI.recipeImage(file); } catch (e) { if (overlay.isConnected && mine === pickSeq) showToast(window.FoodAI ? FoodAI.friendlyErr(e) : t('rx_error')); return; }
    if (!overlay.isConnected || mine !== pickSeq) return;
    source = 'image'; pick = { pic }; drawConfirm();
  }

  function drawConfirm() {
    pickSeq++;
    const field = (label, ph, rows) => `<label class="form-label" for="rx-text">${label}</label>
      <textarea id="rx-text" class="rx-text" maxlength="3000" dir="auto" rows="${rows}" placeholder="${escapeHtml(ph)}"></textarea>`;
    const mb = pick && pick.file ? Math.max(0.1, Math.round(pick.file.size / 104857.6) / 10) : 0;   // never «0 MB»
    body.innerHTML = (source === 'video'
      // The unit OUTSIDE .num: .num is an ltr island, and «ميغابايت» inside it
      // would read before its figure in Arabic.
      ? `<div class="rx-file">${icon('play', 20)}<span dir="auto">${escapeHtml(pick.file.name || '')}</span><span class="rx-size"><span class="num">${fmtNum(mb)}</span> ${t('rx_mb')}</span></div>` + field(t('rx_caption_label'), t('rx_caption_ph'), 3)
      : source === 'image' ? `<div class="rx-preview"><img src="${pick.pic.dataUrl}" alt=""></div>`
      : source === 'link' ? `<label class="form-label" for="rx-link">${t('rx_link_label')}</label>
        <input id="rx-link" class="rx-link" type="url" inputmode="url" dir="ltr" maxlength="2048" autocomplete="off" placeholder="${escapeHtml(t('rx_link_ph'))}">
        <p class="rx-hint" id="rx-link-yt" data-rx-yt hidden>${t('rx_link_yt_note')}</p>`
      : field(t('rx_text_label'), t('rx_text_ph'), 8)) + `
      <div class="rx-actions">
        <button type="button" class="btn btn-ghost" data-rx-back>${t('back')}</button>
        <button type="button" class="btn btn-primary" data-rx-go>${t('rx_go')}</button>
      </div>`;
    body.querySelector('[data-rx-back]').addEventListener('click', () => drawSources(true));
    body.querySelector('[data-rx-go]').addEventListener('click', go);
    // The Worker reads a YouTube video's first five minutes only (end_offset
    // 300 s): a dish after that never reaches the chooser, so a YouTube link
    // says so while it is being pasted (the v416 review, W-5).
    const linkEl = body.querySelector('#rx-link');
    // The field is DESCRIBED by the note only while it shows: aria-describedby
    // reads a hidden node's text too, so a TikTok link was announced with the
    // YouTube limit (the review of the fixes).
    if (linkEl) linkEl.addEventListener('input', () => {
      const yt = !!(window.FoodAI && FoodAI.rxLinkKind(linkEl.value) === 'youtube');
      body.querySelector('[data-rx-yt]').hidden = !yt;
      if (yt) linkEl.setAttribute('aria-describedby', 'rx-link-yt'); else linkEl.removeAttribute('aria-describedby');
    });
    // The field a text or a link source is FOR takes the cursor; a clip's caption
    // is optional (no keyboard for it), so focus goes to «استخرج الوصفة» there.
    const first = source === 'link' ? body.querySelector('#rx-link') : source === 'text' ? body.querySelector('#rx-text') : body.querySelector('[data-rx-go]');
    if (first) first.focus();
  }
  function go() {
    const textEl = body.querySelector('#rx-text'), linkEl = body.querySelector('#rx-link');
    const text = textEl ? textEl.value.trim() : '';
    if (source === 'text' && !text) { showToast(t('rx_need_text')); textEl.focus(); return; }
    let link = '';
    if (source === 'link') {
      link = linkEl.value.trim();
      if (!link) { showToast(t('rx_need_link')); linkEl.focus(); return; }
      // Refused HERE, before anything is spent: a host the Worker never reads.
      if (!(window.FoodAI && FoodAI.rxLinkKind(link))) { showToast(t('rx_link_unsupported')); linkEl.focus(); return; }
    }
    process({ source, file: pick && pick.file, pic: pick && pick.pic, text, link });
  }

  // The Worker's answer, rebuilt FIELD BY FIELD — never spread: cleanMealItems
  // copies every extra field of an item into storage. A row whose four figures
  // are all 0 (salt, water) is seeded as entered by hand (_manual), or the
  // named-zero guard would refuse almost every imported recipe on its first save.
  function draftOf(r, notes) {
    const num = (v, dec) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? (dec ? Math.round(n * 10) / 10 : Math.round(n)) : 0; };
    const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
    const items = (Array.isArray(r.items) ? r.items : []).slice(0, 30).map((it) => {
      const row = { name: txt(it && it.name, 60), qty: txt(it && it.qty, 24), calories: num(it && it.calories),
        protein: num(it && it.protein, true), carbs: num(it && it.carbs, true), fat: num(it && it.fat, true), _src: 'ai', _auto: 'done' };
      if (!row.calories && !row.protein && !row.carbs && !row.fat) { row._manual = true; row._zero = true; }   // _zero: an edit lifts it (openRecipeEditor)
      return row;
    }).filter((row) => row.name);
    const s = Math.round(Number(r.servings));
    return { name: txt(r.name, 60), servings: s >= 1 ? Math.min(99, s) : 1, items,
      note: (notes || []).map((n) => t(n.key).replace('{n}', fmtNum(n.n || 0))).join(' ') };
  }
  // THE HELD SHEET. dismissible:false holds it: the backdrop, Escape and Back do
  // not close it, and no timer-raised sheet may replace it. Closing it any other
  // way (a held dialog replacing it, a logout) aborts the work through the
  // observer; its own cancel aborts it directly.
  function process(job) {
    let controller = null, serial = 0, kept = null;   // kept: the clip's stills and sound — «أعد المحاولة» only re-sends them
    const held = openModal(`
      <div class="modal-header"><div class="modal-title">${t('rx_working')}</div>
        <button type="button" class="icon-btn icon-btn-tile" data-rx-cancel aria-label="${escapeHtml(t('cancel'))}">${icon('close', 20)}</button></div>
      <div class="rx-preview" data-rx-host aria-hidden="true"></div>
      <div class="rx-meter" aria-hidden="true"><span class="rx-meter-fill"></span></div>
      <p class="rx-step" data-rx-step role="status" aria-live="polite">${t('rx_step_prep')}</p>
      <p class="rx-hint">${t('rx_keep_open')}</p>
      <p class="rx-error" data-rx-error role="alert" tabindex="-1" hidden></p>
      <div class="rx-actions" data-rx-fail hidden>
        <button type="button" class="btn btn-ghost" data-rx-back>${t('back')}</button>
        <button type="button" class="btn btn-primary" data-rx-retry>${t('rec_retry')}</button>
      </div>`, { dismissible: false });
    if (!held) return;
    guardConvenienceModal(held);
    const $h = (sel) => held.querySelector(sel);
    const step = (text, p) => { $h('[data-rx-step]').textContent = text; if (p != null) $h('.rx-meter-fill').style.setProperty('--rx-p', String(p)); };
    const stop = () => { serial++; if (controller) controller.abort(); };
    const observer = new MutationObserver(() => { if (!held.isConnected) { stop(); observer.disconnect(); } });
    observer.observe(document.getElementById('modal-root'), { childList: true });
    const leave = () => { stop(); observer.disconnect(); closeModal(); };
    $h('[data-rx-cancel]').addEventListener('click', leave);
    $h('[data-rx-back]').addEventListener('click', () => { leave(); openRecipeImport(date, onDone); });
    $h('[data-rx-retry]').addEventListener('click', () => run());
    async function run() {
      const token = ++serial;
      controller = new AbortController();
      const signal = controller.signal;
      // «أعد المحاولة» hides the row it sits in: focus that was there (or on the
      // alert) goes to the sheet itself, never to <body> outside the held dialog.
      const was = document.activeElement;
      const lost = !!was && ($h('[data-rx-fail]').contains(was) || $h('[data-rx-error]').contains(was));
      $h('[data-rx-error]').hidden = true; $h('[data-rx-fail]').hidden = true;
      if (lost) held.querySelector('[role="dialog"]')?.focus({ preventScroll: true });
      try {
        step(t('rx_step_prep'), 0.02);
        if (!window.FoodAI) throw new Error(t('rx_unavailable'));
        const session = await Cloud.getSession?.();
        if (!(session && session.user && session.user.id)) throw new Error(t('ai_err_signin'));
        if (token !== serial) return;
        let input;
        if (job.source === 'video') {
          const onProgress = (p) => {
            if (token !== serial) return;
            if (p.step === 'frames') step(t('rx_step_frames').replace('{n}', fmtNum(p.n)).replace('{total}', fmtNum(p.total)), 0.05 + 0.6 * p.n / p.total);
            else step(t('rx_step_audio'), 0.7);
          };
          if (!window.FoodAI) throw new Error(t('rx_unavailable'));
          if (!kept) kept = await FoodAI.decomposeVideo(job.file, { host: $h('[data-rx-host]'), signal, onProgress });
          input = { frames: kept.frames, audio: kept.audio, text: job.text };
        } else if (job.source === 'image') input = { frames: [job.pic.image] };
        else if (job.source === 'link') input = { link: job.link };
        else input = { text: job.text };
        if (token !== serial) return;
        step(job.source === 'link' ? t('rx_step_link') : t('rx_step_send'), 0.85);
        if (!window.FoodAI) throw new Error(t('rx_unavailable'));
        const got = await FoodAI.analyzeRecipe(input, signal);
        if (token !== serial || !held.isConnected) return;
        // EVERY dish the source held, each its own draft — never merged (v411).
        const recipes = got && Array.isArray(got.recipes) ? got.recipes : [];
        const drafts = recipes.map((r) => draftOf(r || {}, kept ? kept.notes : [])).filter((d) => d.items.length);
        if (!drafts.length) throw new Error(t('rx_empty'));
        // Another account signed in while this was out: hand it nothing.
        if (owner !== Cloud.getLastUid()) { leave(); return; }
        observer.disconnect();
        // closeModal() FIRST: while the held sheet is up, an ordinary openModal is refused.
        closeModal();
        // Two or more: the user chooses. One: straight to the editor, as before.
        if (drafts.length > 1) { openRecipeChooser(date, drafts, onDone); return; }
        openRecipeEditor(date, drafts[0], onDone);
        showToast(t('rx_review_toast'));
      } catch (e) { failed(e, token); }
    }
    // A failure is said in the sheet (role=alert), with «رجوع» and — only where
    // asking again could change the answer — «أعد المحاولة».
    function failed(e, token) {
      if (token !== serial || !held.isConnected || (e && e.name === 'AbortError')) return;
      // fetch() fails as a TypeError («Failed to fetch», «Load failed»), which
      // friendlyErr rightly calls a connection problem; any OTHER TypeError is a
      // fault of ours, and «check your internet» would send the user off wrong.
      const ours = e && e.name === 'TypeError' && !/failed to fetch|load failed|networkerror|network request/i.test(e.message || '');
      const said0 = ours ? t('rx_error') : window.FoodAI ? FoodAI.friendlyErr(e) : ((e && e.message) || t('rx_error'));
      const said = said0 === t('ai_error') ? t('rx_error') : said0;
      const final = [t('rx_empty'), t('rx_unavailable'), t('ai_daily_limit'), t('ai_err_signin'),
        t('rx_video_unreadable'), t('rx_video_long'), t('rx_link_unsupported')].indexOf(said) !== -1;
      step('', 0);
      const err = $h('[data-rx-error]');
      err.textContent = said; err.hidden = false;
      $h('[data-rx-fail]').hidden = false;
      // style.display, not [hidden]: .btn sets its own display (the v332 trap).
      $h('[data-rx-retry]').style.display = final ? 'none' : '';
      err.focus();
    }
    run();
  }
  drawSources();
}
// ===========================================================================
// MORE THAN ONE DISH (v411) — «مقطع الفيديو ممكن يكون فيه وصفتين وهو هنا
// يدمجها بوصفة واحدة». The Worker answers every distinct dish as its own
// recipe; this sheet lets the user choose. One card = one figure row (the row
// IS the control): the per-serving kcal, the dish, «n مكوّنات · n حصص». A tap
// reviews that dish in the editor, and the chooser comes back after the save —
// the card marked «حُفظت» — or after a close without one. «احفظ الكل» saves
// every dish still unsaved, each as its own recipe, with trySave's field rules.
// `onDone` (where the import's save lands) runs once, when the chooser is left
// with at least one dish saved: it opens a sheet of its own, so running it
// after every dish would bury the chooser under it.
// ===========================================================================
function openRecipeChooser(date, drafts, onDone) {
  const list = (Array.isArray(drafts) ? drafts : []).filter((d) => d && Array.isArray(d.items) && d.items.length);
  if (list.length < 2) { if (list.length) openRecipeEditor(date, list[0], onDone); return; }
  const nameOf = (d, i) => String(d.name || '').trim() || t('rx_dish_unnamed').replace('{n}', fmtNum(i + 1));
  const title = list.length === 2 ? t('rx_pick_title_2') : t('rx_pick_title_n').replace('{n}', fmtNum(list.length));
  const card = (d, i) => {
    // A SAVED dish is read back from storage: its editor may have renamed it,
    // changed its servings or dropped rows, and the card describes the recipe
    // that exists, never the draft it came from (the v411 review).
    const rec = d._savedId ? DB.recipes.list().find((r) => r.id === d._savedId) : null;
    const src = rec || d;
    const items = Array.isArray(src.items) ? src.items : [];
    const per = DB.recipes.perServing({ servings: src.servings, items });
    const s = Math.max(1, Number(src.servings) || 1);
    // One serving names nothing the user chose, so the servings half is left out.
    const sub = recJoin([recIngLabel(items.length, true), s > 1 ? recServLabel(s, true) : '', d._saved ? t('rx_dish_saved') : '']);
    return `<button type="button" class="data-row fig-row rx-dish${d._saved ? ' is-done' : ''}" data-i="${i}">
      <div class="fig-row-main">${figRowFig(fmtNum(per.calories), t('cal'))}
        <div class="fig-row-text"><span class="fig-row-title" dir="auto">${escapeHtml(rec ? rec.name : nameOf(d, i))}</span><span class="fig-row-sub">${sub}</span></div>
      </div></button>`;
  };
  // Each drawing of the sheet has its own flag: set when THAT sheet hands the
  // screen on (to a dish's editor, to its own redraw, to a finished save-all),
  // which is not the user leaving it. The observer fires after the swap, so one
  // shared flag would already have been reset by the new sheet.
  let cur = null;
  const draw = () => {
    if (cur) cur.handoff = true;
    const me = cur = { handoff: false };
    // One dish left: the button saves that one, and says so (the list holds two
    // or more, so one left means another was saved).
    const left = list.filter((d) => !d._saved).length;
    const overlay = openModal(`
      <div class="modal-header"><div><div class="modal-title">${title}</div><div class="modal-subtitle">${t('rx_pick_sub')}</div></div>
        <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button></div>
      <div class="rx-dishes">${list.map(card).join('')}</div>
      ${left ? `<button type="button" class="btn btn-ghost btn-block rx-pick-all" id="rx-pick-all">${left === 1 ? t('rx_pick_left') : t('rx_pick_all')}</button>` : ''}`);
    if (!overlay) return;   // a dialog that must be answered is up
    guardConvenienceModal(overlay);
    // Leaving the chooser (its close, Back, Escape, the backdrop) with a dish
    // saved hands over to where the import's save lands — once.
    const watch = new MutationObserver(() => {
      if (overlay.isConnected && !overlay.classList.contains('is-out')) return;
      watch.disconnect();
      if (me.handoff || !list.some((d) => d._saved) || typeof onDone !== 'function') return;
      if (document.querySelector('#modal-root .modal-overlay:not(.is-out)')) return;
      onDone();
    });
    watch.observe(document.getElementById('modal-root'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    overlay.querySelectorAll('.rx-dish').forEach((b) => b.addEventListener('click', () => {
      const d = list[Number(b.dataset.i)]; if (!d) return;
      me.handoff = true;
      closeModal();
      const back = () => draw();
      const rec = d._saved ? DB.recipes.list().find((r) => r.id === d._savedId) : null;
      if (rec) { openRecipeEditor(date, rec, back, { onClose: back }); return; }
      openRecipeEditor(date, d, (made) => { d._saved = true; d._savedId = made && made.id; back(); }, { onClose: back });
    }));
    const all = overlay.querySelector('#rx-pick-all');
    if (all) all.addEventListener('click', () => {
      if (all.classList.contains('is-waiting')) return;
      all.classList.add('is-waiting');
      let ok = 0, bad = 0;
      const madeIds = [];
      // In order, every one attempted: a refused write leaves its card unmarked.
      list.forEach((d, i) => {
        if (d._saved) return;
        const made = DB.recipes.add({ name: nameOf(d, i), servings: Math.max(1, Number(d.servings) || 1), items: d.items.map(recStoredItem) });
        if (made) { d._saved = true; d._savedId = made.id; madeIds.push(made.id); ok++; } else bad++;
      });
      // Automatic sharing (v420), trigger 2 of 3: the recipes THIS tap made.
      queueAutoShare(madeIds);
      if (bad) {
        draw();
        // Saved + refused ≤ 4 dishes, so a partial save names one, two or three.
        showToast(!ok ? t(DB.saveState().ok ? 'rec_need_ing' : 'sc_failed')
          : ok === 1 ? t('rx_saved_some_1') : ok === 2 ? t('rx_saved_some_2') : t('rx_saved_some_n').replace('{n}', fmtNum(ok)));
        return;
      }
      me.handoff = true;
      closeModal();
      if (typeof onDone === 'function') onDone();
      showToast(ok === 1 ? t('rec_saved') : ok === 2 ? t('rx_saved_all_2') : t('rx_saved_all_n').replace('{n}', fmtNum(ok)));
    });
    // Back from a save, the next dish still to review is under the thumb.
    const next = list.some((d) => d._saved) && overlay.querySelector('.rx-dish:not(.is-done)');
    if (next) next.focus({ preventScroll: true });
  };
  draw();
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
    <div class="sfp-actions">
      <button class="btn btn-ghost btn-block" id="sf-new">${icon('plus', 20)} ${tab === 'bundles' ? t('bundle_new') : tab === 'recipes' ? t('rec_new') : t('saved_new')}</button>
      <button type="button" class="btn btn-ghost btn-block" id="sf-import">${icon('sparkle', 20)} ${t('rx_title')}</button>
    </div>
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
          <div class="bundle-meta">${recIngLabel(r.items.length, true)} · ${recServLabel(r.servings, true)} ·
            <span class="num">${fmtNum(per.calories)}</span> ${t('cal')} ${t('rec_u_per')}${r.shared ? ' · ' + t('shr_tag_shared') : ''}</div>
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
      // A shared recipe's published copy outlives it (v419): the question says so.
      const doomed = DB.recipes.list().find((x) => x.id === b.dataset.delRec);
      confirmDialog({
        title: t('delete_recipe_q'), text: doomed && doomed.shared ? t('shr_del_note') : '', confirmLabel: t('delete'), variant: 'danger',
        onConfirm: () => {
          const result = DB.recipes.remove(b.dataset.delRec);
          if (!result.ok) { convenienceError(result); return; }
          // NOT drawRecipes(): the confirm sheet replaced #modal-root, so this
          // closure's listEl is detached and the picker is already gone.
          openSavedFoodPicker(date, onSave, 'recipes');
          offerUndo(t('rec_deleted'), result);
          // An Undo on the recipes slice is on offer for 10 s: a marker written
          // under it by automatic sharing would turn that Undo STALE (v420).
          autoShareHold(11000);
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
    // While searching, the food catalogue follows as the LAST group, matched
    // by the same folding as the top-bar search (DB.search.catalog) and never
    // repeating a food already saved. Without a query the tab is the user's own
    // list only — the catalogue is 219 dishes, not a list to scroll.
    const cat = q ? DB.search.catalog(query) : [];
    if (!list.length && !cat.length) {
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${saved.length ? t('no_matches_simple') : t('saved_empty')}</div>`;
      return;
    }
    listEl.innerHTML = list.map((f,i) => `<button type="button" class="picker-row" data-add-saved="${i}">
      <span class="picker-row-cat" style="background:var(--cat-arms)"></span>
      <span class="picker-row-name">${escapeHtml(f.name)} · <span class="num">${fmtNum(f.calories)}</span> ${t('cal')}</span>
      <span class="picker-row-check">${icon('plus',16)}</span></button>`).join('')
      + (cat.length ? `<h3 class="sfp-cat-head">${t('cx_catalog')}</h3>` + cat.map((r,i) => `<button type="button" class="picker-row" data-add-cat="${i}">
      <span class="picker-row-cat" style="background:var(--cat-legs)"></span>
      <span class="picker-row-name">${escapeHtml(r.name)} · <span class="num">${fmtNum(r.preset.cal)}</span> ${t('cal')}</span>
      <span class="picker-row-check">${icon('plus',16)}</span></button>`).join('') : '');
    // THE DOUBLE-TAP GUARD MUST NOT BLUR THE ROW. `disabled` on the focused
    // button dropped keyboard focus to <body>; a flag + aria-disabled refuses
    // the second press for 800 ms and leaves focus where it was.
    const pressOnce = (button) => {
      if (button.__busy) return false;
      button.__busy = true; button.setAttribute('aria-disabled', 'true');
      setTimeout(() => { button.__busy = false; button.removeAttribute('aria-disabled'); }, 800);
      return true;
    };
    listEl.querySelectorAll('[data-add-cat]').forEach(button => button.onclick = () => {
      if (!pressOnce(button)) return;
      const r = cat[Number(button.dataset.addCat)];
      const result = logFoodPreset(date || todayISO(), r && r.preset);
      if (!result.ok) { convenienceError(result); return; }
      button.querySelector('.picker-row-check').innerHTML = icon('check',16);
      button.classList.add('picked');
      if (onSave) onSave(); offerUndo(t('rec_logged').replace('{name}', r.name), result);
    });
    listEl.querySelectorAll('[data-add-saved]').forEach(button => button.onclick = () => {
      if (!pressOnce(button)) return;   // the bundle button's guard, without the blur
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
  // «استخراج وصفة» — a recipe from a clip, a link, a photo or text, on the
  // recipes tab only (applyTab). Saving the draft returns here, like «وصفة جديدة».
  const importBtn = overlay.querySelector('#sf-import');
  importBtn.addEventListener('click', () => openRecipeImport(date, () => openSavedFoodPicker(date, onSave, 'recipes')));
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
    // The field's NAME follows the tab with its placeholder: a placeholder is
    // not a name, and a search box named by nothing reads as «edit box».
    if (input) input.setAttribute('aria-label', input.placeholder = tab === 'bundles' ? t('sfp_search_bundles') : tab === 'recipes' ? t('sfp_search_recipes') : t('search_foods'));
    overlay.querySelector('#sf-search-wrap').style.display = '';
    newBtn.innerHTML = icon('plus', 20) + ' ' +
      (tab === 'bundles' ? t('bundle_new') : tab === 'recipes' ? t('rec_new') : t('saved_new'));
    // style.display, NOT [hidden]: .btn sets its own display, which beats the
    // UA's [hidden] rule at any specificity (the v332 trap).
    importBtn.style.display = tab === 'recipes' ? '' : 'none';
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
// MEAL SUGGESTIONS — «اقتراحات اليوم» (v419; the three sources since v421)
//
// The Food tab's card that answers «what do I eat today?» — there from the
// first day, under the water card — filled from three sources in this order
// (suggestionPool): the user's OWN recipes, the recipes other users share
// (each reviewed by the AI before the Worker published it — FoodAI.shareRecipe,
// migration 35; since v420 a saved recipe is shared by itself: AUTOMATIC
// SHARING, further down), and a READY set of everyday meals that ships with
// the app (SUGGESTION_PRESETS in js/catalog.js, composed of the catalogue's
// own entries and priced from them here — suggestionItems — with no AI call,
// no account and no network). Four meal periods; the clock's is pressed, and a
// tap on another holds until the clock moves into the next period. Three rows
// for the period — the best-ranked of each source, so a new user sees ready
// meals and a user with recipes sees their own first (shrCardOrder) — ranked by
// what fits the calories still left (when a target exists), then by protein
// per kcal, then the newer; «show more» lists the whole period under three
// captions. A tap opens the row: an own recipe as everywhere (openRecipeView);
// a community recipe or a ready meal in the suggestion sheet — one serving's
// figures, every ingredient with its amount AND its figures (read on the tap
// for a community recipe; a ready meal carries them), «Log a serving», «Save
// to my recipes», and a report for a community recipe alone.
//
// THE LIST IS OTHER PEOPLE'S TEXT. Cloud.pullSharedRecipes copies each row
// field by field; cleanSharedRecipes is the one judge of the values — an unsafe
// id, a nameless row, a figure that is not one, no period it suits: DROPPED,
// never repaired — and every name is escaped where it is drawn. It lives in
// memory only, never in the blob (the food_catalog precedent). Every row of
// the three sources passes the same judge (cleanSuggestion) before the card
// reads it. The user's own published recipes (the `shared` marker,
// DB.recipes.setShared) appear ONCE, as their own — the feed's copy is left
// out — and an own row the sheet still meets (the harness) offers neither a
// copy nor a report (shrIsOwn).
// ===========================================================================
const SHR_PERIODS = ['breakfast', 'lunch', 'snack', 'dinner'];
// The cleaned community list; null until a pull has answered with a list.
let SHARED_RECIPES = null;
// When the last pull started (the 5-minute throttle) and the one in flight.
let __sharedAt = 0, __sharedPending = null;
// A period the user pressed, with the clock's period when they pressed it.
let SHR_PICK = null;
// Recipes reported this session leave the card at once.
const SHR_HIDDEN = {};

// The meal period an hour falls in: 5–10 breakfast, 11–15 lunch, 16–18 a
// snack, the rest dinner. Duck-typed on getHours() so a test can pass a clock.
function mealPeriodFor(now) {
  const h = now && typeof now.getHours === 'function' ? now.getHours() : new Date().getHours();
  return h >= 5 && h <= 10 ? 'breakfast' : h >= 11 && h <= 15 ? 'lunch' : h >= 16 && h <= 18 ? 'snack' : 'dinner';
}
// The period the card shows: the user's pick while the clock is still in the
// period it was made in, else the clock's own.
function shrPeriod(now) {
  const clock = mealPeriodFor(now);
  return SHR_PICK && SHR_PICK.clock === clock && SHR_PERIODS.includes(SHR_PICK.period) ? SHR_PICK.period : clock;
}
// A literal ternary, never t('shr_meal_' + p): each key stays a whole quoted
// literal that contracts 5 and 38 can see.
function shrMealName(p) {
  return p === 'breakfast' ? t('shr_meal_breakfast') : p === 'lunch' ? t('shr_meal_lunch') : p === 'snack' ? t('shr_meal_snack') : t('shr_meal_dinner');
}
// The period's recipes, best first: those that fit the calories left (only
// when there is a target — `gauge` is nutritionGauge's, or null), then protein
// per kcal, then the newer. A new array; the rows are never touched.
function rankSuggestions(list, period, gauge) {
  const left = gauge && typeof gauge.calLeft === 'number' && Number.isFinite(gauge.calLeft) ? Math.max(0, gauge.calLeft) : null;
  const fit = (r) => (left !== null && Number(r.kcal) <= left ? 1 : 0);
  const dense = (r) => (Number(r.kcal) > 0 ? Number(r.protein) / Number(r.kcal) : 0);
  const at = (r) => String(r.created_at || '');
  return (Array.isArray(list) ? list : []).filter((r) => r && Array.isArray(r.meals) && r.meals.includes(period))
    .sort((a, b) => (fit(b) - fit(a)) || (dense(b) - dense(a)) || (at(b) > at(a) ? 1 : at(b) < at(a) ? -1 : 0));
}
// One untrusted string: whole characters (wellFormedText), no control
// characters, one space between words, cut at `n` without halving an emoji.
function shrText(v, n) {
  let s = wellFormedText(typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > n) s = wellFormedText(s.slice(0, n)).trim();
  return s;
}
// One untrusted figure: a finite number from 0 to 100000, else null (the row
// is dropped — a figure that is not one is never clamped into one).
function shrFig(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
}
// ONE ingredient, FIELD BY FIELD — the only place a shared item is built, for
// the list's rows, a sheet's ingredients and the copy «Save» writes. Spreading
// the server's object would carry whatever it holds (an id, an editor flag)
// into the user's blob, where cleanMealItems keeps every extra field.
function shrItem(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  const name = shrText(it.name, 80);
  const f = [shrFig(it.calories), shrFig(it.protein), shrFig(it.carbs), shrFig(it.fat)];
  if (!name || f.some((x) => x === null)) return null;
  return { name, qty: shrText(it.qty, 24), calories: f[0], protein: f[1], carbs: f[2], fat: f[3] };
}
// A list of ingredients, 1–30, every one valid — or null.
function shrItems(list) {
  if (!Array.isArray(list) || !list.length || list.length > 30) return null;
  const out = list.map(shrItem);
  return out.every(Boolean) ? out : null;
}
// The rows as the card may draw them. Idempotent: cleaning its own output
// changes nothing. A row with no `items` key (every list row) keeps none; a
// row that carries items keeps them only when they are valid, else it goes.
function cleanSharedRecipes(rows) {
  const out = [], seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (out.length >= 200) break;
    if (!r || typeof r !== 'object' || Array.isArray(r) || !entityIdSafe(r.id) || seen.has(r.id)) continue;
    const name = shrText(r.name, 80);
    const meals = SHR_PERIODS.filter((p) => Array.isArray(r.meals) && r.meals.includes(p));
    const f = [shrFig(r.kcal), shrFig(r.protein), shrFig(r.carbs), shrFig(r.fat)];
    if (!name || !meals.length || f.some((x) => x === null)) continue;
    const s = Math.round(Number(r.servings));
    const row = { id: r.id, lang: r.lang === 'ar' || r.lang === 'en' ? r.lang : '', name,
      servings: Number.isFinite(s) ? Math.min(99, Math.max(1, s)) : 1, meals,
      kcal: f[0], protein: f[1], carbs: f[2], fat: f[3],
      created_at: typeof r.created_at === 'string' && r.created_at.length <= 40 ? r.created_at : '' };
    if (r.items !== undefined) {
      const items = shrItems(r.items);
      if (!items) continue;
      row.items = items;
    }
    seen.add(r.id);
    out.push(row);
  }
  return out;
}
// What the card may suggest: the community list minus what the user reported
// this session. Their OWN published recipes stay in it (v420).
function sharedPool() {
  if (!Array.isArray(SHARED_RECIPES) || !SHARED_RECIPES.length) return [];
  return SHARED_RECIPES.filter((r) => !Object.prototype.hasOwnProperty.call(SHR_HIDDEN, r.id));
}
// A PUBLISHED COPY THIS DEVICE JUST TOOK DOWN leaves the card at once (v421),
// as a reported row does: the list in memory keeps it until the next pull (a
// 5-minute throttle, a 30-minute cache), and with no marker naming it any more
// the user's own recipe would be suggested a second time as another user's.
// «أزل من المشاركة» (openRecipeView) and an Undo that withdraws what it left
// behind (applyConvenienceUndo, js/app.js, through shrOrphanedIds) both call
// this — app.js never writes this file's state by name.
function shrForget(id) {
  if (typeof id === 'string' && id) SHR_HIDDEN[id] = true;
}
// Is that community row the user's OWN published recipe? Its id is the id a
// local marker holds.
function shrIsOwn(id) {
  return DB.recipes.list().some((x) => !!(x && x.shared && x.shared.id === id));
}

// ---- THE READY MEALS (v421) -------------------------------------------------
// The grams a catalogue serving NAMES ('100g' → 100, '1 cup · 243g' → 243,
// '100g cooked' → 100), or null for a unit serving ('1 egg', '1 tbsp',
// '250ml'). NOT parseGrams: that one wants the weight LAST and reads ml as
// grams, so it answers null for '100g cooked' and 250 for '250ml' — an entry's
// unit is decided by what its serving names, and scripts/test-shared-recipes.js
// (case J) reads it the same way.
function servingGrams(s) {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*g(?![A-Za-z])/);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
// A ready meal's ingredients as recipe items {id, name, qty, calories, protein,
// carbs, fat}. Each item of SUGGESTION_PRESETS names ONE catalogue entry (its
// exact `en`) and an amount — `g` grams of a serving that names grams, or `n`
// of a unit serving — and the figures are the entry's × that scale, by
// DB.recipes.perServing's rounding (kcal whole, macros to 0.1), so a corrected
// entry corrects every meal. The name and the amount read in the UI language,
// and EVERY amount is ONE figure in grams — or millilitres for a liquid — «١٥٠
// غ» / '150 g', «٢٥٠ مل» / '250 ml' (the owner: every ingredient «محسوب
// السعرات والغرامات»): a unit is n × the weight of one serving
// (SERVING_WEIGHTS, js/catalog.js), so the scaler, which moves an amount's
// leading number alone (recScaleQty), moves every amount with its figures. A
// unit entry with no weight there keeps its own serving label (sa/s, «٢ ×» in
// front when more than one) — never reached: case J refuses one. null when ANY
// item fails to resolve — a meal missing an ingredient would show figures
// nothing in it accounts for.
function suggestionItems(preset) {
  const ar = (DB.prefs.get().lang || 'en') === 'ar';
  // Latin digits in both languages (ui.js's rule for every computed figure):
  // the figures line beside each amount is fmtNum's Latin, and the scaler
  // writes Latin — an Arabic-Indic amount switched script at the first step.
  const digits = (v) => String(v);
  const list = preset && typeof preset === 'object' && Array.isArray(preset.items) ? preset.items : [];
  if (!list.length) return null;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const entry = it && typeof it === 'object' ? FOOD_PRESETS.find((p) => p.en === it.en) : null;
    if (!entry) return null;
    const grams = servingGrams(entry.s);
    let scale, qty;
    if (grams !== null && it.n === undefined && Number.isFinite(it.g) && it.g > 0) {
      scale = it.g / grams;
      qty = digits(it.g) + ' ' + t('unit_g');
    } else if (grams === null && it.g === undefined && Number.isInteger(it.n) && it.n > 0) {
      scale = it.n;
      const w = typeof SERVING_WEIGHTS === 'object' && SERVING_WEIGHTS && Object.prototype.hasOwnProperty.call(SERVING_WEIGHTS, entry.en) ? SERVING_WEIGHTS[entry.en] : null;
      qty = w && Number.isFinite(w.g) && w.g > 0 ? digits(Math.round(it.n * w.g)) + ' ' + t('unit_g')
        : w && Number.isFinite(w.ml) && w.ml > 0 ? digits(Math.round(it.n * w.ml)) + ' ' + t('unit_ml')
        : (it.n > 1 ? digits(it.n) + ' × ' : '') + String((ar ? entry.sa : entry.s) || '');
    } else return null;
    const f = DB.recipes.perServing({ servings: 1, items: [{ calories: entry.cal * scale, protein: entry.pro * scale, carbs: entry.carb * scale, fat: entry.f * scale }] });
    out.push({ id: preset.id + '-' + (i + 1), name: foodPresetName(entry), qty, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat });
  }
  return out;
}
// ONE POOL ROW, CLEANED — the three sources read alike, judged alike:
// {id, src, name, servings, meals, kcal, protein, carbs, fat, items?, recId?,
// created_at?}. A community row is cleanSharedRecipes' verdict with its
// source named; an own recipe ('mine:' + its id, `recId`) or a ready meal
// ('builtin:' + its id) must carry its items and a safe id behind the prefix.
// A row that is not one is null — dropped, never repaired, as a feed row.
function cleanSuggestion(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const src = r.src === 'mine' || r.src === 'builtin' ? r.src : 'community';
  if (src === 'community') {
    const c = cleanSharedRecipes([r])[0];
    return c ? Object.assign({ src }, c) : null;
  }
  const tail = typeof r.id === 'string' && r.id.slice(0, src.length + 1) === src + ':' ? r.id.slice(src.length + 1) : '';
  const name = shrText(r.name, 80);
  const meals = SHR_PERIODS.filter((p) => Array.isArray(r.meals) && r.meals.includes(p));
  const f = [shrFig(r.kcal), shrFig(r.protein), shrFig(r.carbs), shrFig(r.fat)];
  const items = shrItems(r.items);
  if (!entityIdSafe(tail) || !name || !meals.length || f.some((x) => x === null) || !items) return null;
  if (src === 'mine' && !entityIdSafe(r.recId)) return null;
  const s = Math.round(Number(r.servings));
  const row = { id: src + ':' + tail, src, name, servings: Number.isFinite(s) ? Math.min(99, Math.max(1, s)) : 1, meals, kcal: f[0], protein: f[1], carbs: f[2], fat: f[3], items };
  if (src === 'mine') row.recId = r.recId;
  if (typeof r.created_at === 'string' && r.created_at && r.created_at.length <= 40) row.created_at = r.created_at;
  return row;
}
// EVERY ROW THE CARD MAY DRAW, from the three sources in this order: the
// user's own recipes (every one with at least one well-formed ingredient —
// one serving's figures by DB.recipes.perServing; the periods of the feed's
// copy when the recipe is published and the list holds it, else every period),
// the community's (sharedPool, minus the user's own published copies — those
// are already here as `mine`), and the ready meals (one serving each, the sum
// of suggestionItems). Each row through cleanSuggestion. Never a throw: a
// blob row that is not a recipe is skipped — this is read from a render — and
// so is a row whose figures cannot be worked out (a dependency that throws, as
// DB.recipes.perServing may): the card is drawn INSIDE the dashboard, whose
// handlers are bound after it, so a throw here would leave Food painted and
// dead (test-shared-recipes-ui.js case 20, the v420 rule).
// A COPY THE USER SAVED STANDS IN FOR THE ROW IT WAS SAVED FROM, on the card
// and in «show more» alike (the same meal twice — the copy heading the card,
// its original a row below — tells nothing): a ready meal's copy (origin
// 'builtin') is matched by its figures — one serving, the same per-serving
// kcal and macros, as many ingredients — because its name is in the language
// it was saved in; a community recipe's (origin 'shared') by its name (folded),
// its servings and its kcal within 1. The original is left out and the copy
// takes its periods (a published marker's feed row still wins). An EDITED copy
// no longer matches and stands beside its source: it is another meal now.
function suggestionPool() {
  const feed = sharedPool();
  const ar = (DB.prefs.get().lang || 'en') === 'ar';
  const presets = typeof SUGGESTION_PRESETS === 'undefined' || !Array.isArray(SUGGESTION_PRESETS) ? [] : SUGGESTION_PRESETS;
  // The ready meals priced FIRST: an own copy below may stand in for one.
  const ready = [];
  for (const p of presets) {
    try {
      const items = suggestionItems(p);
      if (!items) continue;
      const per = DB.recipes.perServing({ servings: 1, items });
      ready.push({ id: 'builtin:' + p.id, src: 'builtin', name: ar ? p.ar : p.en, servings: 1, meals: p.meals,
        kcal: per.calories, protein: per.protein, carbs: per.carbs, fat: per.fat, items });
    } catch (_) { /* skipped: its figures cannot be read */ }
  }
  const recs = DB.recipes.list().filter((rec) => rec && typeof rec === 'object');
  // The feed rows already here as the user's own: every published copy (its
  // marker) — and, below, every row a saved copy stands in for.
  const own = new Set(recs.map((rec) => (rec.shared && typeof rec.shared === 'object' ? rec.shared.id : null)).filter(Boolean));
  const taken = new Set();   // the ready meals a saved copy stands in for
  const fold = (s) => shrText(s, 80).toLowerCase();
  const rows = [];
  for (const rec of recs) {
    const marker = rec.shared && typeof rec.shared === 'object' ? rec.shared.id : null;
    const items = (Array.isArray(rec.items) ? rec.items : []).map(shrItem).filter(Boolean);
    if (!items.length) continue;
    const pub = marker ? feed.find((r) => r.id === marker) : null;
    try {
      const per = DB.recipes.perServing({ servings: rec.servings, items });
      let twin = null;
      if (rec.origin === 'builtin' && Number(rec.servings) === 1) {
        twin = ready.find((b) => !taken.has(b.id) && b.items.length === items.length && b.kcal === per.calories && b.protein === per.protein && b.carbs === per.carbs && b.fat === per.fat) || null;
        if (twin) taken.add(twin.id);
      } else if (rec.origin === 'shared') {
        // All four figures: two users' recipes can share a name, servings and
        // kcal (the feed is newest first, so `find` took the wrong one). The
        // server prices a row with perServing's own rounding: a real copy matches.
        const near = (a, b) => Math.abs(Number(a) - b) <= 1;
        twin = feed.find((r) => !own.has(r.id) && fold(r.name) === fold(rec.name) && Number(r.servings) === Number(rec.servings)
          && near(r.kcal, per.calories) && near(r.protein, per.protein) && near(r.carbs, per.carbs) && near(r.fat, per.fat)) || null;
        if (twin) own.add(twin.id);
      }
      rows.push({ id: 'mine:' + rec.id, src: 'mine', recId: rec.id, name: rec.name, servings: rec.servings, meals: pub ? pub.meals : twin ? twin.meals : SHR_PERIODS,
        kcal: per.calories, protein: per.protein, carbs: per.carbs, fat: per.fat, items, created_at: rec.createdAt });
    } catch (_) { /* skipped: its figures cannot be read */ }
  }
  for (const r of feed) if (!own.has(r.id)) rows.push(Object.assign({ src: 'community' }, r));
  for (const b of ready) if (!taken.has(b.id)) rows.push(b);
  return rows.map(cleanSuggestion).filter(Boolean);
}
// THE CARD'S ORDER for a period: the best-ranked row of each source — mine,
// then community, then builtin, each when it exists — then the rest by rank.
// A new user sees ready meals; a user with recipes sees their own first
// without the others leaving. A new array, as rankSuggestions'.
function shrCardOrder(pool, period, gauge) {
  const ranked = rankSuggestions(pool, period, gauge);
  const heads = ['mine', 'community', 'builtin'].map((s) => ranked.find((r) => r.src === s)).filter(Boolean);
  return heads.concat(ranked.filter((r) => !heads.includes(r)));
}
// A tap on a row: the user's own recipe opens as it does everywhere
// (openRecipeView, by its id — the row is a reading of it, not the recipe),
// with «سجّل حصّة» on it (opts.log): a suggestion is a meal to eat, and the
// card's first row must not be the one row nobody can log from; a community
// recipe or a ready meal opens the suggestion sheet.
function shrOpen(r, onSave) {
  if (!r) return;
  if (r.src === 'mine') {
    const rec = DB.recipes.list().find((x) => x && x.id === r.recId);
    if (rec) openRecipeView(null, rec, onSave, { log: true });   // null = today, resolved at log time
    return;
  }
  openSharedRecipe(r, null, onSave);   // null = today, resolved at log time
}
// The caption of a source — a literal ternary, never t('shr_src_' + src):
// each key stays a whole quoted literal that contracts 5 and 38 can see.
function shrSrcCaption(src) {
  return src === 'mine' ? t('shr_src_mine') : src === 'community' ? t('shr_src_community') : t('shr_src_builtin');
}
// The copy «Save to my recipes» writes: name, servings and the six fields of
// each ingredient. No id anywhere — DB.recipes.add gives the recipe and every
// row their own — and never a `shared` marker: a copy is not a publication.
// `origin` is what DB.recipes.add stores so that automatic sharing never
// publishes the copy back as the user's own: 'builtin' for a ready meal (the
// pool's `src`, v421), else always the literal 'shared' (v420), whatever
// `origin` the row itself carries.
function shrCopyDraft(r) {
  const s = Math.round(Number(r && r.servings));
  return { name: shrText(r && r.name, 80), servings: Number.isFinite(s) ? Math.min(99, Math.max(1, s)) : 1,
    items: (r && Array.isArray(r.items) ? r.items : []).map(shrItem).filter(Boolean), origin: r && r.src === 'builtin' ? 'builtin' : 'shared' };
}
// THE CANONICAL FORM of a recipe's content: its name, its servings and, per
// ingredient, the name, the amount and the four figures — as DB.recipes stores
// them. No id, no stamp, no marker: two recipes that read alike ARE alike.
// The one spelling behind «is that copy already saved?» and the signature.
function shrCanon(rec) {
  const x = rec && typeof rec === 'object' ? rec : {};
  return [String(x.name || '').trim(), Number(x.servings) || 1, (Array.isArray(x.items) ? x.items : []).map((it) => {
    const i = it && typeof it === 'object' ? it : {};
    return [String(i.name || '').trim(), String(i.qty || '').trim(), Number(i.calories) || 0, Number(i.protein) || 0, Number(i.carbs) || 0, Number(i.fat) || 0];
  })];
}
// A recipe's content in 8 lowercase hex characters: FNV-1a (32-bit) over the
// canonical form's JSON, one UTF-16 unit at a time. It rides on the marker
// (`shared.sig`, the content AS PUBLISHED), so an edit is told from a
// published recipe on every device. ALWAYS 8 characters — DB.recipes.setShared
// drops any other shape, and a marker with no sig reads as up to date.
function shrSig(rec) {
  const s = JSON.stringify(shrCanon(rec));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
// Is that copy already among the user's recipes? Same name, servings and
// ingredients, as DB.recipes stores them.
function shrCopyExists(r) {
  const d = shrCopyDraft(r);
  if (!d.name || !d.items.length) return false;
  const want = JSON.stringify(shrCanon(d));
  return DB.recipes.list().some((x) => JSON.stringify(shrCanon(x)) === want);
}
// Pull the community list into memory. Resolves whether what the card would
// draw changed. One pull at a time (a second caller shares it), at most one
// per five minutes — stamped BEFORE the call, like bootCatalog — unless
// `opts.force`; `opts.fresh` asks Cloud past its own 30-minute cache. A Cloud
// without the call, or an answer that is not a list, keeps what is in memory.
function loadSharedRecipes(opts) {
  const force = !!(opts && opts.force);
  if (!(window.Cloud && typeof Cloud.pullSharedRecipes === 'function')) return Promise.resolve(false);
  if (__sharedPending) return force ? __sharedPending.then(() => loadSharedRecipes(opts)) : __sharedPending;
  if (!force && __sharedAt && Date.now() - __sharedAt < 5 * 60 * 1000) return Promise.resolve(false);
  __sharedAt = Date.now();
  const p = Promise.resolve()
    .then(() => Cloud.pullSharedRecipes({ fresh: !!(opts && opts.fresh) }))
    .then((rows) => {
      if (!Array.isArray(rows)) return false;
      const next = cleanSharedRecipes(rows);
      const changed = JSON.stringify(next) !== JSON.stringify(SHARED_RECIPES);
      SHARED_RECIPES = next;
      return changed;
    }, () => false);
  __sharedPending = p;
  p.then(() => { if (__sharedPending === p) __sharedPending = null; });
  return p;
}
// The «calories left» the card ranks by: today's gauge, or none without a target.
function shrGauge() {
  return DB.nutrition.hasTargets() ? nutritionGauge(todayISO()) : null;
}
// A figure in mono, rounded: the card and the sheet read alike.
function shrNum(v) {
  return '<span class="num">' + fmtNum(Math.round(Number(v) || 0)) + '</span>';
}
// The three macros as the recipe ledger writes them («٣٠ بروتين»), for recJoin.
function shrMacros(r) {
  return [shrNum(r.protein) + ' ' + t('protein_label'), shrNum(r.carbs) + ' ' + t('carbs_label'), shrNum(r.fat) + ' ' + t('fat_label')];
}
// One suggestion: the figure row (v395), a door to the row's sheet. Its source
// rides on data-shr-src; a caption over the name says «من وصفاتي» or «من
// المستخدمين» where that informs (a ready meal says nothing — the default),
// and `bare` leaves it off under a group caption that already says it.
function shrRowHtml(r, bare) {
  const cap = !bare && (r.src === 'mine' || r.src === 'community') ? `<span class="shr-src">${shrSrcCaption(r.src)}</span>` : '';
  return `<button type="button" class="data-row fig-row shr-row" data-shr-open="${escapeHtml(r.id)}" data-shr-src="${escapeHtml(r.src)}">
      <div class="fig-row-main">${figRowFig(fmtNum(Math.round(Number(r.kcal) || 0)), t('cal'))}
        <div class="fig-row-text">${cap}<span class="fig-row-title" dir="auto">${escapeHtml(r.name)}</span><span class="fig-row-sub">${recJoin(shrMacros(r))}</span></div>
      </div></button>`;
}
// The card — never '' since v421: the ready meals mean there is always
// something to suggest (shr_none stays for a period that somehow has no row).
function sharedCardHtml(gauge) {
  const period = shrPeriod(new Date());
  const ranked = shrCardOrder(suggestionPool(), period, gauge);
  return `
    <div class="card shr-card" id="shr-card">
      <div class="shr-head">
        <h2 class="shr-title">${icon('utensils', 16)}<span>${t('shr_title')}</span></h2>
        ${ranked.length > 3 ? `<button type="button" class="link-btn" data-shr-more>${t('show_more')}</button>` : ''}
      </div>
      <div class="shr-periods">${SHR_PERIODS.map((p) => `<button type="button" class="shr-period" data-shr-period="${p}" aria-pressed="${p === period}">${shrMealName(p)}</button>`).join('')}</div>
      ${ranked.length ? `<div class="shr-rows">${ranked.slice(0, 3).map((r) => shrRowHtml(r)).join('')}</div>` : `<p class="shr-empty">${t('shr_none')}</p>`}
    </div>`;
}
// Redraw the card alone — a period tap, the list arriving — where the
// dashboard puts it: after the water card, or after the setup button.
function shrRepaint(host) {
  if (!host) return;
  const html = sharedCardHtml(shrGauge());
  const old = host.querySelector('#shr-card');
  if (old) { old.outerHTML = html; return; }
  const after = host.querySelector('.water-card') || host.querySelector('.nutri-setup');
  if (after) after.insertAdjacentHTML('afterend', html);
  else host.insertAdjacentHTML('beforeend', html);
}

// ONE SUGGESTION'S SHEET — a community recipe, or a ready meal (a row whose
// `src` is 'builtin', v421): its name, one serving's figures, the ingredients
// with their amounts and figures (read on the tap for a community recipe; a
// ready meal carries its own, so nothing is fetched and nothing is busy), the
// servings scaler (amounts and their figures only — the log is one serving, as
// the picker's «+» is), «Log a serving» (source 'shared' or 'builtin'), «Save
// to my recipes» (a copy whose origin says where it came from), and a report
// for a community recipe alone — nobody reports a ready meal.
// The user's OWN published recipe (v420) is a row like any other to log from,
// but it is already in their recipes — the save button is spent from the
// start — and nobody reports themselves: that row's sheet has no report.
function openSharedRecipe(rec, date, onSave) {
  const builtin = !!(rec && rec.src === 'builtin');
  const r = builtin ? cleanSuggestion(rec) : cleanSharedRecipes([rec])[0];
  if (!r) return;
  const own = !builtin && shrIsOwn(r.id);
  // What the log row names: a ready meal by the preset's id behind the prefix.
  const sourceId = builtin ? r.id.slice('builtin:'.length) : r.id;
  const figs = (p) => `<span class="shr-figs-k">${t('rec_per')}</span> ${recJoin([shrNum(p.kcal) + ' ' + t('cal'), ...shrMacros(p)])}`;
  const overlay = openModal(`
    <div class="modal-header"><h2 class="modal-title" dir="auto">${escapeHtml(r.name)}</h2><button class="icon-btn" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button></div>
    <div class="cx-stack">
      <p class="shr-figs" id="shr-figs">${figs(r)}</p>
      <div class="rt-serv"><span class="rt-serv-k">${t('rec_servings')}</span>
        <span class="rt-step">
          <button type="button" data-step="-1" aria-label="${escapeHtml(t('rec_serv_less'))}">${icon('minus', 16)}</button>
          <input type="number" id="shr-servings" class="num" inputmode="numeric" min="1" max="99" step="1" value="${r.servings}" aria-label="${escapeHtml(t('rec_servings'))}">
          <button type="button" data-step="1" aria-label="${escapeHtml(t('rec_serv_more'))}">${icon('plus', 16)}</button>
        </span></div>
      ${builtin ? `<div class="cx-list rec-view" id="shr-items">${recViewRowsHtml(r.items, true)}</div>`
        : `<div class="cx-list rec-view" id="shr-items" aria-busy="true"><div class="cx-row"><span>${t('cx_loading')}</span></div></div>`}
      <div class="cx-actions">
        <button type="button" class="btn btn-primary" id="shr-log">${t('shr_log')}</button>
        <button type="button" class="btn btn-ghost" id="shr-save" disabled>${own ? t('shr_in_recipes') : t('shr_save')}</button>
      </div>
      ${own || builtin ? '' : `<button type="button" class="link-btn shr-report" id="shr-report">${t('shr_report')}</button>`}
    </div>`);
  // null under a dialog that must be answered (openModal's hold).
  if (!overlay) return;
  guardConvenienceModal(overlay);
  const items = [];
  const paint = bindRecScaler(overlay, overlay.querySelector('#shr-servings'), items, r.servings);
  const listEl = overlay.querySelector('#shr-items');
  const saveBtn = overlay.querySelector('#shr-save');
  let full = null;
  const markSaved = () => {
    const had = document.activeElement === saveBtn;
    saveBtn.disabled = true;
    saveBtn.textContent = t('shr_in_recipes');
    // A disabled button drops keyboard focus to <body>; it stays in the sheet.
    if (had) overlay.querySelector('.modal')?.focus({ preventScroll: true });
  };
  // The ingredients are in: drawn with their figures, the scaler told, the
  // serving's figures re-derived from them (by the same rounding the server
  // used), and the copy offered unless it is already among the recipes.
  const settle = (got) => {
    items.push(...got);
    full = { ...r, items: got };
    listEl.innerHTML = recViewRowsHtml(items, true);
    paint();
    const per = DB.recipes.perServing(full);
    overlay.querySelector('#shr-figs').innerHTML = figs({ kcal: per.calories, protein: per.protein, carbs: per.carbs, fat: per.fat });
    if (own || shrCopyExists(full)) markSaved(); else saveBtn.disabled = false;
  };
  if (builtin) settle(r.items);
  else Promise.resolve()
    .then(() => (window.Cloud && typeof Cloud.getSharedRecipeItems === 'function' ? Cloud.getSharedRecipeItems(r.id) : null))
    .catch(() => null)
    .then((raw) => {
      if (!overlay.isConnected) return;
      listEl.removeAttribute('aria-busy');
      const got = shrItems(raw);
      if (!got) {
        listEl.innerHTML = `<div class="cx-row"><span>${navigator.onLine === false ? t('auth_err_network') : t('ai_error')}</span></div>`;
        return;
      }
      settle(got);
    });

  // ONE SERVING, ONE ROW — whatever the scaler shows (it moves amounts only).
  let logging = false;
  overlay.querySelector('#shr-log').addEventListener('click', () => {
    if (logging) return;
    logging = true;
    const result = DB.foodLogs.addMany(date || todayISO(), [{
      name: r.name, servings: 1,
      calories: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat,
      source: builtin ? 'builtin' : 'shared', sourceId,
    }]);
    if (!result.ok) { logging = false; convenienceError(result); return; }
    closeModal();
    if (typeof onSave === 'function') onSave();
    // A function, never a string, as the replacement: another user's name may
    // hold «$&» or «$1», which a replacement STRING would expand.
    offerUndo(t('rec_logged').replace('{name}', () => r.name), result);
  });
  saveBtn.addEventListener('click', () => {
    if (saveBtn.disabled || !full) return;
    if (shrCopyExists(full)) { markSaved(); return; }
    const w = withUndo(() => {
      const made = DB.recipes.add(shrCopyDraft(full));
      // A READY MEAL'S COPY is never published by itself — on THIS build
      // autoShareWants refuses any `origin`, but v420 refuses only 'shared',
      // and a phone still on v420 that pulls this blob would publish the copy
      // as the user's own recipe. v420 already refuses `noAuto`, so the copy
      // carries it from birth (outside the ledger, carried into this Undo's
      // snapshot by carryRecipeField). A hand share still lifts it.
      if (made && builtin) DB.recipes.setNoAuto(made.id, true);
      return made;
    });
    if (!w.value) { showToast(DB.saveState().ok ? t('rec_need_ing') : t('sc_failed')); return; }
    markSaved();
    offerUndo(t('shr_saved'), w);
    // That Undo is on the recipes slice: automatic sharing writes no marker
    // under it for its 10 s, or the Undo would answer STALE (v420).
    autoShareHold(11000);
    // The card behind follows at once: the copy now stands in for the row it
    // was saved from (suggestionPool), so a card still drawing that row would
    // hold a door that opens nothing.
    if (typeof onSave === 'function') onSave();
  });
  const reportBtn = overlay.querySelector('#shr-report');
  if (reportBtn) reportBtn.addEventListener('click', () => openSharedReport(r, onSave));
}

// «show more»: every suggestion of the period, in rank order, grouped under
// the three source captions — the groups that have rows, in the pool's order
// (mine, community, builtin); a row under its caption carries none of its own.
// A caption tells groups apart, so ONE group (day one: the ready meals alone)
// is drawn bare, with no caption at all — a lone «اقتراحات جاهزة» over every
// row would distinguish nothing and repeat the title's «اقتراحات».
function openSharedSuggestions(rows, period, onSave) {
  const list = (Array.isArray(rows) ? rows : []).map(cleanSuggestion).filter(Boolean);
  const groups = ['mine', 'community', 'builtin'].map((src) => [src, list.filter((r) => r.src === src)]).filter(([, g]) => g.length);
  const captioned = groups.length > 1;
  const overlay = openModal(`
    <div class="modal-header"><div><h2 class="modal-title">${t('shr_title')}</h2><div class="modal-subtitle">${shrMealName(period)}</div></div>
      <button class="icon-btn" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button></div>
    <div class="shr-list">${groups.map(([src, g]) => `${captioned ? `<p class="shr-src shr-group" data-shr-group="${src}">${shrSrcCaption(src)}</p>` : ''}<div class="shr-rows">${g.map((r) => shrRowHtml(r, true)).join('')}</div>`).join('')}</div>`);
  if (!overlay) return;
  guardConvenienceModal(overlay);
  overlay.querySelectorAll('[data-shr-open]').forEach((b) => b.addEventListener('click', () => shrOpen(list.find((x) => x.id === b.dataset.shrOpen), onSave)));
}

// «Report this recipe»: three reasons, sent as one feedback row whose context
// names the recipe (`recipe-report:<id>`) — the owner's inbox reads it, and the
// recipe leaves this user's card at once.
function openSharedReport(rec, onDone) {
  const r = cleanSharedRecipes([rec])[0];
  if (!r) return;
  const overlay = openModal(`
    <div class="modal-header"><div><h2 class="modal-title">${t('shr_report_title')}</h2><div class="modal-subtitle" dir="auto">${escapeHtml(r.name)}</div></div>
      <button class="icon-btn" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button></div>
    <div class="cx-stack">
      <button type="button" class="btn btn-ghost" data-shr-reason="not_food">${t('shr_reason_not_food')}</button>
      <button type="button" class="btn btn-ghost" data-shr-reason="offensive">${t('shr_reason_offensive')}</button>
      <button type="button" class="btn btn-ghost" data-shr-reason="wrong_figures">${t('shr_reason_wrong')}</button>
      <p class="auth-err" id="shr-rep-err" role="alert"></p>
    </div>`);
  if (!overlay) return;
  guardConvenienceModal(overlay);
  const err = overlay.querySelector('#shr-rep-err');
  let busy = false;
  overlay.querySelectorAll('[data-shr-reason]').forEach((b) => b.addEventListener('click', async () => {
    const reason = b.dataset.shrReason;
    if (busy || !['not_food', 'offensive', 'wrong_figures'].includes(reason)) return;
    err.textContent = '';
    if (!(window.Cloud && typeof Cloud.submitFeedback === 'function' && typeof Cloud.getSession === 'function')) { err.textContent = t('shr_report_failed'); return; }
    busy = true;
    let session = null;
    try { session = await Cloud.getSession(); } catch (_) {}
    if (!session) { busy = false; err.textContent = t('shr_signin'); return; }
    const owner = Cloud.getLastUid();
    let res = null;
    try { res = await Cloud.submitFeedback(reason, 'recipe-report:' + r.id); } catch (_) {}
    busy = false;
    if (Cloud.getLastUid() !== owner) return;
    if (res && res.ok) SHR_HIDDEN[r.id] = true;   // sent: it leaves the card even if this sheet is gone
    if (!overlay.isConnected || overlay.classList.contains('is-out')) return;
    if (res && res.ok) { closeModal(); if (typeof onDone === 'function') onDone(); showToast(t('shr_reported')); return; }
    err.textContent = res && res.error === 'ratelimit' ? t('feedback_too_many') : res && res.error === 'offline' ? t('auth_err_network') : t('shr_report_failed');
  }));
}

// «شاركها»: what sharing means, in four lines, then one request. The AI's
// verdict comes back as a CODE and is said in one translated sentence; an
// approval writes the marker {id, at, sig} (DB.recipes.setShared), so the view
// offers «أزل من المشاركة» on every device. It stays beside automatic sharing
// (v420) — for a recipe the user took out of sharing, for a signed-in user who
// turned automatic sharing off — and the fourth line says which holds: the
// published copy follows later edits only while automatic sharing is on AND
// the recipe is the user's own (a copy saved from the list or of a ready meal
// — any `origin` — is one autoShareWants never follows, so its line says the
// copy stays).
function openShareRecipe(rec, onBack) {
  const overlay = openModal(`
    <div class="modal-header"><div><h2 class="modal-title">${t('shr_share_title')}</h2><div class="modal-subtitle" dir="auto">${escapeHtml(rec.name)}</div></div>
      <button class="icon-btn" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button></div>
    <div class="cx-stack" id="shr-share-body">
      <div class="cx-list shr-terms"><p>${t('shr_term_review')}</p><p>${t('shr_term_anon')}</p><p>${t('shr_term_withdraw')}</p><p>${DB.prefs.autoShare() && rec.origin === undefined ? t('shr_term_follow') : t('shr_term_copy')}</p></div>
      <p class="auth-err" id="shr-share-err" role="alert"></p>
      <button type="button" class="btn btn-primary" id="shr-send">${t('shr_send')}</button>
    </div>`);
  if (!overlay) return;
  guardConvenienceModal(overlay);
  const body = overlay.querySelector('#shr-share-body');
  const err = overlay.querySelector('#shr-share-err');
  const send = overlay.querySelector('#shr-send');
  const onScreen = () => overlay.isConnected && !overlay.classList.contains('is-out');
  const back = () => { closeModal(); if (typeof onBack === 'function') onBack(); };
  // A rejection or a refusal: the code in one sentence — an unknown code says
  // only that it was not accepted — and «OK» back to the recipe.
  const drawVerdict = (reason) => {
    // t()'s fallback '' — a code the dictionaries do not know prints nothing.
    const why = t('shr_rej_' + reason, '');
    body.innerHTML = `<div role="alert"><p class="shr-verdict">${t('shr_rejected')}</p>${why ? `<p class="shr-reason">${escapeHtml(why)}</p>` : ''}</div>
      <button type="button" class="btn btn-primary" id="shr-ok">${t('shr_ok')}</button>`;
    const ok = body.querySelector('#shr-ok');
    ok.addEventListener('click', back);
    ok.focus({ preventScroll: true });
  };
  send.addEventListener('click', async () => {
    if (send.disabled) return;
    err.textContent = '';
    if (!(window.FoodAI && typeof FoodAI.shareRecipe === 'function')) { err.textContent = t('shr_unavailable'); return; }
    const cur = DB.recipes.list().find((x) => x.id === rec.id);
    if (!cur) { err.textContent = t('cx_stale'); return; }
    // The server keeps whole servings (1–99); a scaled recipe says so first.
    if (!Number.isInteger(Number(cur.servings))) { err.textContent = t('shr_whole_servings'); return; }
    let session = null;
    try { session = window.Cloud && typeof Cloud.getSession === 'function' ? await Cloud.getSession() : null; } catch (_) {}
    if (!session) { err.textContent = t('shr_signin'); return; }
    send.disabled = true;
    send.textContent = t('shr_sending');
    const owner = Cloud.getLastUid();
    // The content AS SENT, named before the await: an edit made during the
    // review must read as «changed since it was published» (v420).
    const sig = shrSig(cur);
    let res = null;
    try {
      res = await FoodAI.shareRecipe(cur);
    } catch (e) {
      if (!onScreen() || Cloud.getLastUid() !== owner) return;
      err.textContent = window.FoodAI && typeof FoodAI.friendlyErr === 'function' ? FoodAI.friendlyErr(e) : t('ai_error');
      send.disabled = false;
      send.textContent = t('shr_send');
      return;
    }
    // Another account signed in meanwhile: nothing is written to its blob.
    if (Cloud.getLastUid() !== owner) return;
    if (res && res.verdict === 'approve') {
      // Written even if the sheet was closed during the review: the copy IS
      // published, and without its marker the view could never take it down.
      // «Not automatically» is cleared first (v420): the user asked for this
      // recipe to be shared, so it follows its edits again like any other.
      DB.recipes.setNoAuto(cur.id, false);
      // The marker as it stands NOW (automatic sharing may have written one
      // while this review ran): a replaced copy leaves the card, as in runAutoShare.
      const prev = DB.recipes.list().find((x) => x.id === cur.id);
      const w = DB.recipes.setShared(cur.id, { id: res.id, at: new Date().toISOString(), sig });
      if (w && w.ok && prev && prev.shared && prev.shared.id && prev.shared.id !== res.id) shrForget(prev.shared.id);
      if (!w || !w.ok) {
        // A copy no marker points at could not be withdrawn from the app.
        if (window.Cloud && typeof Cloud.withdrawSharedRecipe === 'function') Promise.resolve().then(() => Cloud.withdrawSharedRecipe(res.id)).catch(() => {});
        if (onScreen()) closeModal();
        convenienceError(w);
        return;
      }
      if (onScreen()) back();
      showToast(res.name && res.name !== cur.name ? t('shr_published_as').replace('{name}', () => res.name) : t('shr_published'));
      return;
    }
    if (!onScreen()) return;
    drawVerdict(res && res.reason);
  });
}

// ===========================================================================
// AUTOMATIC SHARING (v420) — «أي وصفة حدا حطها تتشارك على طول»
//
// Every recipe a signed-in user saves is sent for the same review as «شاركها»
// and published without their name, unless they turn that off (Settings, or
// «أوقِفها» on the one-time notice). Nothing on the server changed for it: a
// request still spends one unit of the day's AI budget and the database keeps
// its caps. So THE CLIENT IS FRUGAL — one request at a time, a gap between
// two, a ceiling per day per device, a pause when the server says «enough for
// today», and a recipe a review refused is not sent again until it changes.
//
// WHAT IS SENT is decided by autoShareWants() alone, from three fields the
// recipe carries (js/storage.js): the marker's `sig` — the content AS
// PUBLISHED, which an edit moves shrSig() away from — `noAuto` (the user took
// it out of sharing) and `origin: 'shared'` (a copy of someone else's recipe).
// What a review refused, the day's count and a pause live on the DEVICE
// (VAULT_KEYS.shareAuto), never in the blob.
//
// THREE TRIGGERS, and only these: the editor's save, the import chooser's
// «احفظ الكل», and a render of Food (the backfill). A trigger only QUEUES ids;
// runAutoShare() takes one recipe per step and reads every gate again each
// time. Turning the setting ON sends nothing by itself.
// ===========================================================================
const SHR_AUTO_DELAY = 1500;                 // ms from a trigger to the first step
const SHR_AUTO_NOTICE_MS = 12000;            // the one-time notice stays this long, and the first request waits for it
const SHR_AUTO_GAP = 4000;                   // ms between two requests
const SHR_AUTO_DAY_MAX = 12;                 // requests per local day, per device
const SHR_AUTO_PAUSE_MS = 6 * 3600 * 1000;   // after «the daily limit» — the database's, or the AI budget's
const SHR_AUTO_TRIED_MAX = 100;              // refusals remembered per device, the newest kept
// The ids waiting · the ONE timer · a step in flight · «stopped until the app
// is opened again» · when a pending Undo on the recipes slice ends · whether
// the one rate-limit wait of this session is spent · when the gap after the
// last request ends · the one-time notice's own button, while it may still be
// on screen · when that notice was raised (its window is counted from here).
let __autoQueue = [], __autoTimer = null, __autoBusy = false, __autoOff = false, __autoHoldUntil = 0, __autoRetried = false,
  __autoNextAt = 0, __autoNoticeBtn = null, __autoNoticeAt = 0;

// The account this device's ledger belongs to: the last signed-in uid, or ''.
function shrAutoUid() {
  return String((window.Cloud && typeof Cloud.getLastUid === 'function' && Cloud.getLastUid()) || '');
}
// THIS DEVICE'S LEDGER for the signed-in account — {uid, day, n, until, tried}
// — read CLEAN every time: another account's object is ignored (the next save
// replaces it), a count from another day is zero, a pause never reaches
// further than one pause from now (a clock set forward, then back), and
// `tried` keeps {sig, reason, at} under a safe recipe id and nothing else.
function shrAutoStore() {
  const uid = shrAutoUid();
  const out = { uid, day: todayISO(), n: 0, until: 0, tried: {} };
  let o = null;
  try { o = JSON.parse(localStorage.getItem(VAULT_KEYS.shareAuto) || 'null'); } catch (_) { o = null; }   // eslint-disable-line vault/no-direct-storage-in-views -- a per-DEVICE ledger from the registry, never blob state (v420)
  if (!uid || !o || typeof o !== 'object' || Array.isArray(o) || o.uid !== uid) return out;
  if (o.day === out.day && Number.isFinite(o.n) && o.n > 0) out.n = Math.floor(o.n);
  if (Number.isFinite(o.until) && o.until > 0) out.until = Math.min(o.until, Date.now() + SHR_AUTO_PAUSE_MS);
  const tried = o.tried && typeof o.tried === 'object' && !Array.isArray(o.tried) ? o.tried : {};
  for (const id of Object.keys(tried)) {
    const x = tried[id];
    if (id === '__proto__' || !entityIdSafe(id) || !x || typeof x !== 'object' || typeof x.sig !== 'string') continue;
    out.tried[id] = { sig: x.sig, reason: typeof x.reason === 'string' ? x.reason : '', at: Number(x.at) || 0 };
  }
  return out;
}
// Write it back — only as the account it was READ for (a ledger read before an
// account change is dropped, never stamped with the new uid), under the day
// its count belongs to, keeping the newest SHR_AUTO_TRIED_MAX refusals.
// Answers whether it was written: a storage that refuses is survived, and the
// engine sends nothing it could not count first.
function shrAutoSave(o) {
  const uid = shrAutoUid();
  if (!uid || !o || typeof o !== 'object' || o.uid !== uid) return false;
  let tried = o.tried && typeof o.tried === 'object' && !Array.isArray(o.tried) ? o.tried : {};
  const ids = Object.keys(tried);
  if (ids.length > SHR_AUTO_TRIED_MAX) {
    ids.sort((a, b) => (Number(tried[b] && tried[b].at) || 0) - (Number(tried[a] && tried[a].at) || 0));
    tried = Object.fromEntries(ids.slice(0, SHR_AUTO_TRIED_MAX).map((id) => [id, tried[id]]));
  }
  try {
    localStorage.setItem(VAULT_KEYS.shareAuto, JSON.stringify({ uid, day: o.day, n: o.n, until: o.until, tried }));   // eslint-disable-line vault/no-direct-storage-in-views -- the per-DEVICE ledger, see shrAutoStore
    return true;
  } catch (_) { return false; }
}
// DOES AUTOMATIC SHARING WANT THIS RECIPE SENT? Only when all of it holds: it
// was not taken out of sharing, it is the user's own — a recipe that carries an
// `origin` AT ALL (a copy from the community list, 'shared'; a copy of a ready
// meal, 'builtin'; whatever a blob may bring) is never theirs to publish — its
// servings are whole and it has calories (the Worker refuses the rest before
// its budget), it is unpublished or was EDITED since it was published, and no
// review has already refused this very content on this device. A marker with
// no sig — v419's «شاركها», or another build's — counts as up to date: what
// it published cannot be compared, and a guess would re-send every old recipe.
// `store` is the device ledger when the caller already read it (a backfill
// asks about every recipe).
function autoShareWants(rec, store) {
  if (!rec || typeof rec !== 'object' || rec.noAuto || rec.origin !== undefined) return false;
  // A row that is not one (an imported or pulled blob may hold a null): never
  // wanted, and never a throw — this question is asked from a render.
  if (!Array.isArray(rec.items) || !rec.items.every((it) => it && typeof it === 'object')) return false;
  if (!Number.isInteger(Number(rec.servings)) || !(DB.recipes.totals(rec).calories > 0)) return false;
  const sig = shrSig(rec), mark = rec.shared;
  if (mark && (mark.sig === undefined || mark.sig === null || mark.sig === sig)) return false;
  const tried = (store && store.tried) || shrAutoStore().tried;
  const refused = Object.prototype.hasOwnProperty.call(tried, rec.id) ? tried[rec.id] : null;
  return !(refused && refused.sig === sig);
}
// A trigger: the ids join the queue (once each) and ONE timer is armed — none
// while a step is in flight, which arms the next one itself. The gap after a
// request holds for a trigger too: a recipe saved a second after one left
// starts its own a whole SHR_AUTO_GAP after it, never SHR_AUTO_DELAY (bounded
// by the gap, so a clock set back cannot park the queue).
function queueAutoShare(ids) {
  for (const id of Array.isArray(ids) ? ids : []) if (typeof id === 'string' && id && !__autoQueue.includes(id)) __autoQueue.push(id);
  if (__autoQueue.length && !__autoTimer && !__autoBusy) {
    __autoTimer = setTimeout(runAutoShare, Math.max(SHR_AUTO_DELAY, Math.min(SHR_AUTO_GAP, __autoNextAt - Date.now())));
  }
}
// An Undo on the recipes slice was just offered: for `ms` nothing is sent and
// no marker is written. The marker is written outside the undo ledger, so it
// changes the slice under the Undo, which would then answer STALE.
function autoShareHold(ms) {
  __autoHoldUntil = Math.max(__autoHoldUntil, Date.now() + Math.max(0, Number(ms) || 0));
}
// ONE STEP: every gate, then at most ONE recipe sent and its answer acted on.
// Never two requests in flight (__autoBusy); the next step is armed
// SHR_AUTO_GAP later. A closed gate stops it quietly and empties the queue —
// the next trigger builds it again from the recipes themselves.
async function runAutoShare() {
  clearTimeout(__autoTimer);
  __autoTimer = null;
  if (__autoBusy) return;
  __autoBusy = true;
  let sent = false;   // did THIS step send a request?
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // The gates that need no await, read again after every await below.
  const open = () => !__autoOff && DB.prefs.autoShare()
    && !!(window.FoodAI && typeof FoodAI.shareRecipe === 'function')
    && !!(window.Cloud && typeof Cloud.configured === 'function' && Cloud.configured())
    && navigator.onLine !== false && !(DB.loadFailed && DB.loadFailed())
    && (typeof Cloud.isSettled !== 'function' || Cloud.isSettled());
  // Answers the wait before the next step, or null: stop.
  const step = async () => {
    if (!open()) return null;
    let session = null;
    try { session = typeof Cloud.getSession === 'function' ? await Cloud.getSession() : null; } catch (_) {}
    // THE SESSION MUST OWN THE STORE (the pushOnce rule): whoever LAST_UID
    // names owns the recipes on this device, and a different session holding
    // it — a 'duplicate' or 'held' device, another account's session in the
    // tab — sends nothing of theirs under its own token.
    if (!session || !session.user || session.user.id !== Cloud.getLastUid() || !open()) return null;
    // The device ledger: an account to count for (a request that could not be
    // counted is never sent, so without one nothing may even be announced), no
    // pause, room left in the day.
    const store = shrAutoStore();
    if (!store.uid || store.until > Date.now() || store.n >= SHR_AUTO_DAY_MAX) return null;
    // THE ONE-TIME NOTICE IS STILL ON SCREEN. A toast's timer pauses under a
    // pointer or the keyboard's focus (WCAG 2.2.1), so the notice can outlive
    // its window — and while «أوقِفها» is on offer nothing is sent under it.
    // Its own button tells: any other toast replaces that element. It is
    // «seen» only once it ENDED on screen — its whole window run out with the
    // page visible, or its button tapped (the onAction below). A notice that
    // was replaced, hidden by a navigation, or under a hidden page is raised
    // again, and nothing is sent until one has run its whole window on screen.
    const toastEl = document.getElementById('toast');
    const toastUp = !!(toastEl && toastEl.classList.contains('show'));
    const hidden = document.visibilityState === 'hidden';
    if (__autoNoticeBtn) {
      const up = toastUp && __autoNoticeBtn.isConnected;
      if (up && !hidden) return 1000;        // still on offer: look again in a second
      if (up) hideToast();                   // the page went away under it: it starts over
      else if (!hidden && Date.now() - __autoNoticeAt >= SHR_AUTO_NOTICE_MS) DB.prefs.setAutoShareSeen();
      __autoNoticeBtn = null;
    }
    if (hidden && !DB.prefs.autoShareSeen()) return SHR_AUTO_GAP;
    // The two WAITS sit below the notice block on purpose: a wait skips the
    // rest of the step, and the block above is the notice's only observer — a
    // notice displaced while a wait held the step would otherwise be stamped
    // «seen» later for a window nobody saw. Neither wait sends or writes.
    // A pull or a push is on the wire: the setting and the markers may be about
    // to change under this step — wait, keep the queue, read every gate again.
    if (typeof Cloud.syncState === 'function' && Cloud.syncState().status === 'syncing') return SHR_AUTO_GAP;
    // An Undo on the recipes slice is still on offer: nothing moves under it.
    if (Date.now() < __autoHoldUntil) return __autoHoldUntil - Date.now();
    // The next recipe that is still wanted, re-read: the queue holds ids only.
    let cur = null;
    while (__autoQueue.length && !cur) {
      const id = __autoQueue.shift();
      const r = DB.recipes.list().find((x) => x.id === id);
      if (autoShareWants(r, store)) cur = r;
    }
    if (!cur) return null;
    // THE ONE-TIME NOTICE, before the first request this account ever sends
    // from here: what happens, and «أوقِفها» for as long as it shows. Nothing
    // is sent in that window, and the gates are read again after it. It never
    // replaces a toast that carries an action (an Undo): it waits its turn.
    if (!DB.prefs.autoShareSeen()) {
      __autoQueue.unshift(cur.id);
      if (toastUp && toastEl.classList.contains('has-action')) return SHR_AUTO_GAP;
      showToast(t('shr_auto_notice'), { duration: SHR_AUTO_NOTICE_MS, actionLabel: t('shr_auto_stop'), onAction: () => {
        DB.prefs.setAutoShare(false);
        // The user answered it: the notice is seen, and never shown again.
        DB.prefs.setAutoShareSeen();
        // Nothing is left running: the queue is emptied and the window's
        // timer dropped, so turning it on again starts from a trigger.
        __autoQueue.length = 0;
        clearTimeout(__autoTimer);
        __autoTimer = null;
        if (currentView === 'settings') renderView('settings');   // its row says «متوقفة» at once
        showToast(t('shr_auto_stopped'));
      } });
      __autoNoticeBtn = toastEl ? toastEl.querySelector('.toast-action') : null;
      // Not «seen» yet: that is stamped above, once the window has run out on
      // screen. Meanwhile the notice is looked at every second.
      __autoNoticeAt = Date.now();
      return 1000;
    }
    // js/foodai.js loads after this file: the check sits beside the call (contract 26).
    if (!(window.FoodAI && typeof FoodAI.shareRecipe === 'function')) return null;
    // The content AS SENT is named before the await, and the request is
    // COUNTED before it leaves: a reload mid-request cannot spend the day's
    // ceiling twice, and a ledger that cannot be written sends nothing.
    const owner = Cloud.getLastUid(), sig = shrSig(cur);
    store.n += 1;
    if (!shrAutoSave(store)) return null;
    let res = null;
    sent = true;
    try {
      res = await FoodAI.shareRecipe(cur);
    } catch (e) {
      // Another account signed in meanwhile: its ledger is not this one's to write.
      if (Cloud.getLastUid() !== owner) return null;
      // «Try again in a minute»: waited out ONCE, the recipe back at the head.
      if (e && e.retryAfter && !e.noRetry && !__autoRetried) { __autoRetried = true; __autoQueue.unshift(cur.id); return e.retryAfter; }
      // Anything else — no network, a deadline, a Worker without the mode —
      // stops automatic sharing until the app is opened again. The AI's day
      // budget (noRetry) is also REMEMBERED, so the next opening does not ask.
      __autoOff = true;
      if (e && e.noRetry) { const s = shrAutoStore(); s.until = Date.now() + SHR_AUTO_PAUSE_MS; shrAutoSave(s); }
      return null;
    }
    // Another account signed in meanwhile: nothing is written to its blob.
    if (Cloud.getLastUid() !== owner) return null;
    if (res && res.verdict === 'approve') {
      while (Date.now() < __autoHoldUntil) await pause(__autoHoldUntil - Date.now());
      if (Cloud.getLastUid() !== owner) return null;
      // Taken out of sharing while the review ran («أزل من المشاركة» sets
      // noAuto): the user's answer stands — no marker, and the fresh copy
      // comes down with the same call a failed marker write makes. Automatic
      // sharing turned OFF while the review ran (Settings, or a pull) is
      // treated the same — except for a recipe that already had a marker: the
      // server replaced its old copy, so the new id must be kept, or the
      // published copy loses its only handle in the app.
      const now = DB.recipes.list().find((x) => x.id === cur.id);
      const w = now && (now.noAuto || (!DB.prefs.autoShare() && !now.shared)) ? null : DB.recipes.setShared(cur.id, { id: res.id, at: new Date().toISOString(), sig });
      if (!w || !w.ok) {
        // A copy no marker points at could never be withdrawn from the app.
        if (typeof Cloud.withdrawSharedRecipe === 'function') Promise.resolve().then(() => Cloud.withdrawSharedRecipe(res.id)).catch(() => {});
        // STALE is about that one recipe (deleted meanwhile, or another window
        // wrote first). A device that cannot WRITE keeps no marker for any
        // recipe: it stops until the app is opened again.
        if (w && w.code !== 'STALE') { __autoOff = true; return null; }
        return SHR_AUTO_GAP;
      }
      // A RE-share: the server REPLACED the old copy (one row per author and
      // recipe, migration 35), so the old id is gone there — and gone from the
      // card now, or a stale list would draw it beside the user's own row.
      if (now && now.shared && now.shared.id && now.shared.id !== res.id) shrForget(now.shared.id);
      // The user's own recipe is a suggestion now: the list is read past both
      // caches and the card alone is drawn again. No toast per recipe.
      loadSharedRecipes({ force: true, fresh: true }).then((changed) => {
        const host = $('#nutri-host');
        if (changed && host) shrRepaint(host);
      });
      return SHR_AUTO_GAP;
    }
    const reason = res && typeof res.reason === 'string' ? res.reason : '';
    // The database's own daily cap: a pause this device remembers.
    if (res && res.verdict === 'refused' && reason === 'daily_limit') {
      const s = shrAutoStore(); s.until = Date.now() + SHR_AUTO_PAUSE_MS; shrAutoSave(s);
      return null;
    }
    // The moderator said no, or the account may not share: THIS content is
    // not sent again from this device (an edit changes its sig).
    if (res && (res.verdict === 'reject' || (res.verdict === 'refused' && reason === 'blocked'))) {
      const s = shrAutoStore(); s.tried[cur.id] = { sig, reason, at: Date.now() }; shrAutoSave(s);
      if (res.verdict === 'reject') return SHR_AUTO_GAP;
    }
    // «blocked», the cap on held recipes, «unavailable», or an answer this
    // build does not know: until the app is opened again; nothing remembered
    // beyond the line above.
    __autoOff = true;
    return null;
  };
  let wait = null;
  // A step that throws is a defect, never a reason to keep asking the server.
  try { wait = await step(); } catch (_) { wait = null; __autoOff = true; }
  __autoBusy = false;
  // The gap runs from the ANSWER, and the next trigger reads it (queueAutoShare).
  if (sent) __autoNextAt = Date.now() + SHR_AUTO_GAP;
  // A stopped engine FORGETS a notice it can no longer watch: a stop (the
  // setting off, offline, another account, a pause) while the notice was up
  // must not stamp it «seen» at the next run for a window nobody saw.
  if (wait === null) { __autoQueue.length = 0; __autoNoticeBtn = null; __autoNoticeAt = 0; return; }
  if (__autoQueue.length) __autoTimer = setTimeout(runAutoShare, Math.max(0, wait));
}
// Trigger 3 of 3 — a render of Food: every recipe automatic sharing still
// wants is queued. Asked only when a step could run at all (the setting, an
// account, no pause, room in the day), so a render arms no timer for nothing.
function autoShareBackfill() {
  if (__autoOff || !DB.prefs.autoShare() || !(window.Cloud && typeof Cloud.configured === 'function' && Cloud.configured())) return;
  const store = shrAutoStore();
  if (!store.uid || store.until > Date.now() || store.n >= SHR_AUTO_DAY_MAX) return;
  queueAutoShare(DB.recipes.list().filter((r) => autoShareWants(r, store)).map((r) => r.id));
}
// THE PUBLISHED COPIES AN UNDO LEAVES BEHIND. The marker and `noAuto` are
// written outside the undo ledger and CARRIED into its snapshots of the
// recipes slice (js/storage.js carryRecipeField), so every Undo stays
// applicable after automatic sharing published something — and the Undo of an
// ADD made before the recipe was published then removes a recipe whose copy is
// up with nothing left in the app to hold its id. `before` and `after` are the
// recipes list on either side of that Undo; the answer is the marker ids of
// the recipes present (with a marker) in `before` and absent from `after`,
// which applyConvenienceUndo (js/app.js) withdraws. Pure: it reads nothing.
// Deleting a recipe by hand is another matter — its copy stays (spec 3.6).
function shrOrphanedIds(before, after) {
  const kept = new Set((Array.isArray(after) ? after : []).map((r) => r && r.id));
  return (Array.isArray(before) ? before : [])
    .filter((r) => r && r.shared && typeof r.shared.id === 'string' && r.shared.id && !kept.has(r.id))
    .map((r) => r.shared.id);
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
  // The Arabic prompt asks for فصحى in so many words: the Worker's chat prompt
  // says "Reply in the language of the message", and a model answers in the
  // register it is addressed in (this one used to say «باقي لي … سناكات … بالعربي»).
  const prompt = (lang === 'ar'
    ? `أتتبّع سعراتي، والمتبقّي لي اليوم: ${left.calories} سعرة، و${left.protein} غ بروتين، و${left.carbs} غ كربوهيدرات، و${left.fat} غ دهون. اقترح ثلاث وجبات أو وجبات خفيفة واقعية تناسب المتبقّي تقريباً، كلّ منها في سطر مع سعراتها التقريبية. اكتب بالعربية الفصحى، دون مقدمة.`
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
    .catch((e) => { body.innerHTML = `<div class="ai-err">${escapeHtml((window.FoodAI && FoodAI.friendlyErr) ? FoodAI.friendlyErr(e) : ((e && e.message) || t('ai_error')))}</div>`; });
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
      <div class="voice-status" id="voice-status" aria-live="polite">${t('voice_tap')}</div>
      <div class="voice-retry" id="voice-retry" aria-live="polite"></div>
    </div>
    <div class="ai-results" id="voice-results"></div>
  `);
  const micBtn = overlay.querySelector('#voice-mic');
  const status = overlay.querySelector('#voice-status');
  const results = overlay.querySelector('#voice-results');
  // Under the status: the calm «up to a minute» line while an answer is slow,
  // or «أعد المحاولة» after a failure a second try can fix. Never both.
  const retrySlot = overlay.querySelector('#voice-retry');
  let recorder = null, chunks = [], stream = null, recording = false, retried = false;

  const setStatus = (s) => { if (status) status.textContent = s; };
  const setSlot = (html) => { if (retrySlot) retrySlot.innerHTML = html; };

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
    // The permission prompt can outlast the sheet. Closed while it was up, the
    // microphone arrived to nobody and a recorder was started on it — stop()
    // had already run and could not see it. It is released before one exists.
    if (!document.body.contains(overlay)) { stream.getTracks().forEach((tk) => tk.stop()); stream = null; return; }
    chunks = [];
    setSlot('');   // a new recording replaces the one kept for a retry
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
    // THE SHEET IS GONE, so the user walked away from this recording: it is not
    // encoded and it is not sent. Every dismissal (X, backdrop, Escape) removes
    // the overlay BEFORE the observer's stop() makes the recorder fire this, so
    // the check needs no state of its own — and it comes before the upload. It
    // used to come after: speech the user had discarded reached the model and
    // spent a call of the shared daily budget on an answer thrown away.
    if (!document.body.contains(overlay)) { chunks = []; return; }
    setStatus(t('voice_processing'));
    const blob = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
    if (!blob.size) { setStatus(t('voice_tap')); return; }
    let audio;
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
      });
      const b64 = String(dataUrl).split(',')[1];
      const mimeType = String(dataUrl).slice(5, String(dataUrl).indexOf(';'));
      if (!window.FoodAI || !FoodAI.analyzeAudio) throw new Error(t('voice_unsupported'));
      audio = { mimeType, data: b64 };
    } catch (e) {
      setStatus((window.FoodAI && FoodAI.friendlyErr) ? FoodAI.friendlyErr(e) : ((e && e.message) || t('ai_error')));
      return;
    }
    if (!document.body.contains(overlay)) return;   // closed while the recording was being encoded
    await sendAudio(audio);
  }

  // ONE SEND OF ONE RECORDING. The recording is kept in this closure through a
  // failure: «أعد المحاولة» resends the same audio instead of asking the user
  // to say the meal again — when FoodAI.canRetry says a second try can help.
  async function sendAudio(audio) {
    setStatus(t('voice_processing'));
    setSlot('');
    const slow = setTimeout(() => {
      // The slot is a live region from the sheet's first paint, so the line
      // written into it is read; a status node inserted filled often is not.
      if (document.body.contains(overlay)) setSlot(`<div class="ai-slow">${escapeHtml(t('ai_slow'))}</div>`);
    }, 8000);
    try {
      const { items, transcript } = await FoodAI.analyzeAudio(audio);
      clearTimeout(slow);
      if (!document.body.contains(overlay)) return; // modal was closed mid-request
      setSlot('');
      if (transcript) setStatus('“' + transcript + '”'); else setStatus(t('voice_tap'));
      if (!items || !items.length) { results.innerHTML = `<div class="ai-decline">${t('ai_not_food')}</div>`; return; }
      renderVoiceResults(items);
    } catch (e) {
      clearTimeout(slow);
      // foodai.js's rules, not a copy: whether a retry can help, how long it
      // waits (the busy answers say «in a minute» and the button keeps that),
      // and the sentence beside it, which carries no «try again» of its own.
      const ai = window.FoodAI;
      const again = !!(ai && ai.canRetry && ai.canRetry(e));
      setStatus(ai && ai.errText ? ai.errText(e, again) : (ai && ai.friendlyErr) ? ai.friendlyErr(e) : ((e && e.message) || t('ai_error')));
      setSlot('');
      if (again) {
        const wait = ai.retryWait ? ai.retryWait(e) : 0;
        setSlot(`<button type="button" class="btn btn-ghost ai-retry" data-retry${wait ? ' disabled' : ''}>${icon('refresh', 16)} ${escapeHtml(t('ai_retry'))}</button>`);
        const b = retrySlot.querySelector('[data-retry]');
        if (wait) setTimeout(() => { if (b.isConnected) b.disabled = false; }, wait);
        // A keyboard retry keeps its place: the mic holds focus while it asks
        // (the slot is emptied), and a new failure hands it to the new button.
        if (retried && document.activeElement === micBtn) b.focus({ preventScroll: true });
        retried = false;
        b.addEventListener('click', () => {
          if (b.disabled) return;
          const had = document.activeElement === b;
          b.disabled = true;
          if (had) { retried = true; micBtn.focus({ preventScroll: true }); }
          sendAudio(audio);
        });
      }
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
    if ([calories, protein, carbs, fat].some((v) => v < 0)) { showToast(t('food_negative')); return; }   // as the manual entry: refused, never saved as a credit
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
      <input type="search" id="food-lib-search" placeholder="${t('search_foods')}" aria-label="${escapeHtml(t('search_foods'))}">
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
  // THE CEILING storage holds the portion to (DB.mealBundles.maxPortion): each
  // item's servings × the portion must stay within 20, so an item ×5 caps it at
  // 4, not at 20. It is the input's max, and it is SAID in place of the total
  // once passed — the preview used to price a portion that Add then refused as
  // «check the name, quantities and limits», which points at nothing on screen.
  const cap = DB.mealBundles.maxPortion(bundle.id) || 20;
  const capText = () => t('cx_portion_cap').replace('{n}', fmtNum(cap));
  const modal = convenienceModal(`${cxHeader('cx_meals')}<div class="cx-stack"><strong>${escapeHtml(bundle.name)}</strong>
    <label>${t('cx_date')}<input class="input" id="cx-log-date" type="date" max="${todayISO()}" value="${escapeHtml(date || todayISO())}"></label>
    <label>${t('cx_portion')}<input class="input" id="cx-log-portion" type="number" min="0.25" max="${cap}" step="0.25" value="1"></label>
    <p id="cx-log-total" class="settings-hint"></p><button class="btn btn-primary" id="cx-log-meal">${t('add')}</button></div>`);
  const amount = modal.querySelector('#cx-log-portion');
  const preview = () => {
    const out = modal.querySelector('#cx-log-total');
    if (Number(amount.value) > cap) { out.textContent = capText(); return; }
    out.textContent = fmtNum(Math.round(bundle.items.reduce((sum,it) => sum + it.calories * (it.servings || 1),0) * Number(amount.value))) + ' ' + t('cal');
  };
  amount.oninput = preview; preview();
  modal.querySelector('#cx-log-meal').onclick = e => {
    if (owner !== Cloud.getLastUid() || JSON.stringify(bundle) !== JSON.stringify(DB.mealBundles.list().find(b => b.id === bundle.id))) { convenienceError({code:'STALE'}); return; }
    // The day is read at the TAP, and a day still to come is refused as every
    // other log sheet refuses it: the food log cannot open a future day, so a
    // meal logged there was unreachable. `max` alone does not stop a typed date.
    const day = modal.querySelector('#cx-log-date').value;
    if (day > todayISO()) { showToast(t('date_future')); return; }
    if (Number(amount.value) > cap) { showToast(capText()); return; }
    e.currentTarget.disabled = true;
    const result = DB.mealBundles.log(bundle.id, day, Number(amount.value), operationId);
    if (!result.ok) { e.currentTarget.disabled = false; if (result.code === 'PORTION') showToast(capText()); else convenienceError(result); return; }
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
      <input class="input" id="sl-new" maxlength="120" dir="auto" enterkeyhint="done" placeholder="${escapeHtml(t('sl_add_ph'))}" aria-label="${escapeHtml(t('sl_add_ph'))}">
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
  // The day arrives on ctx.date (contract 67); the day arrows below move it in place.
  if (!viewContext.date) viewContext.date = todayISO();
  const ctx = viewContext;

  const entries = DB.foodLogs.listForDate(ctx.date);
  const totals = DB.foodLogs.totalsForDate(ctx.date);
  const isToday = ctx.date === todayISO();
  // A day before today is CLOSED: its card reads as a record (the verdict),
  // not a live gauge. Today, and any later day, reads as the hero does.
  const closed = ctx.date < todayISO();
  // What SHAPE this render drew: the miniature (targets set) or the four tiles.
  // refreshTotals asks again and re-renders when either this or `closed` has
  // moved since — targets set from another tab while the row editor was open
  // (the store-adopted repaint skips an open sheet), or midnight passing while
  // the log stayed on screen (the visibilitychange repaint never fires then).
  const withTargets = DB.nutrition.hasTargets();

  const dayLabel = isToday ? t('today_totals') : formatDate(ctx.date);
  const emptyLine = () => emptyState({ iconName: 'apple', title: t(isToday ? 'no_food_logged' : 'no_food_logged_day') });

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
    // A legacy unclamped row (a typed minus, a non-number) prints as 0, the
    // way DB.foodLogs.totalsForDate counts it — never «-300» or «NaN».
    const fig = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
    const m = fig(e.servings) || 1;
    return `
      <div class="food-log-row" data-food-row="${e.id}">
        <div class="food-log-main">
          <div class="food-log-name">
            ${escapeHtml(e.name)}
            ${m !== 1 ? `<span class="food-log-x num">× ${fmtNum(m)}</span>` : ''}
          </div>
          <div class="food-log-meta">
            <span><span class="num">${fmtNum(Math.round(fig(e.calories) * m))}</span> ${t('cal')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(fig(e.protein) * m * 10) / 10)}</span>g ${t('protein_label')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(fig(e.carbs) * m * 10) / 10)}</span>g ${t('carbs_label')}</span>
            ${fig(e.fat) ? `<span class="dot-sep"></span><span><span class="num">${fmtNum(Math.round(fig(e.fat) * m * 10) / 10)}</span>g ${t('fat_label')}</span>` : ''}
          </div>
        </div>
        <button class="icon-btn" data-edit-food="${escapeHtml(e.id)}" aria-label="${escapeHtml(t('fl_edit_title'))}">${icon('edit', 20)}</button>
        <button class="icon-btn danger" data-del-food="${escapeHtml(e.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 20)}</button>
      </div>
    `;
  }
  const items = entries.map(foodRowHtml).join('');

  // show-title in the template: the log has no .page-title (its h1 is sr-only),
  // so the bar title is never redundant — and the arrows, the add sheet and
  // refreshTotals re-render here without renderView's syncDetailTopTitle.
  el.innerHTML = `
    <div class="detail-top show-title">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
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

    ${DB.nutrition.hasTargets() ? `<div id="fl-summary">${nutritionMiniHtml(ctx.date, { closed })}</div>` : `
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
    </div>`}

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('logged_items')}</div>
      <button class="btn btn-primary" id="add-foodlog-btn">${icon('plus', 20)} ${t('add_food_log')}</button>
    </div>

    <div class="data-list" id="food-log-list" style="gap:6px">
      ${entries.length === 0 ? emptyLine() : items}
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

  // Refresh only the summary from current DB state: with targets the
  // miniature is redrawn whole (one string, no partial patching); without,
  // the four tiles keep their text-node patching. If the SHAPE has moved since
  // this render (targets appeared or went; the day closed at midnight), the
  // summary on screen is the wrong one to patch: render the day again, so the
  // header, the card and the empty line all follow.
  function refreshTotals() {
    const now = todayISO();
    if (DB.nutrition.hasTargets() !== withTargets || (ctx.date < now) !== closed || (ctx.date === now) !== isToday) { renderFoodLog(el); return; }
    if (withTargets) {
      const host = $('#fl-summary', el);
      if (host) host.innerHTML = nutritionMiniHtml(ctx.date, { closed });
      return;
    }
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
      // withUndo: update() answers with the row, not the write, and a save that
      // changed nothing records no entry — its toast used to offer the NEWEST
      // one instead, so "Edited · Undo" brought back a meal deleted earlier.
      const written = withUndo(() => DB.foodLogs.update(ctx.date, id, {
        servings: mult, calories: num('#fl-cal'), protein: num('#fl-pro'), carbs: num('#fl-carb'), fat: num('#fl-fat'),
      }));
      const updated = written.value;
      if (!updated) { closeModal(); return; }
      // Replace the row FIRST, then close: closeModal() returns focus to the
      // opener, and the opener is the pencil inside the row being replaced.
      const list = $('#food-log-list', el);
      const row = list.querySelector(`[data-food-row="${CSS.escape(id)}"]`);
      if (row) row.outerHTML = foodRowHtml(updated);
      refreshTotals();
      closeModal();
      // Re-query: refreshTotals may have re-rendered the whole day (the shape
      // moved), which detaches `list` — focus the pencil in the LIVE list.
      try { $('#food-log-list', el).querySelector(`[data-food-row="${CSS.escape(id)}"] [data-edit-food]`)?.focus(); } catch (_) {}
      offerUndo(t('fl_edited'), written);
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
      $('#food-log-list', el).innerHTML = emptyLine();
    }
    refreshTotals();
    offerUndo(t('food_removed'), result);
  });
}
