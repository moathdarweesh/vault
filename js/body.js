// ==========================================================================
// THE VAULT — THE BODY DOMAIN: SLEEP, BODY WEIGHT, CARDIO
//
// The third file out of js/app.js. js/food.js was a domain with no lateral
// edges; js/ui.js was the floor. This is the rest of what the body DID, as
// opposed to what was planned (the program) or eaten (food): a night of sleep,
// a morning weight, a cardio session. All three are day entries — one row per
// calendar day — which is why they share a renderer.
//
// ⚠️ THE THREE GO TOGETHER BECAUSE dayLedgerHtml HAS EXACTLY TWO CALLERS, and
// they are renderSleep and renderCardio. Split sleep from cardio and that
// renderer has to stay behind in app.js as a shared helper forever; kept
// together it is INTERNAL to this file. A boundary is better when it turns a
// shared helper into a private one, and worse when it does the reverse.
//
// ⚠️ ONE LATERAL EDGE IN, AND IT IS THE FEATURE, NOT DEBT. renderProgram calls
// resolveCardioType() and openCardioScheduleModal() — the Program screen is
// where cardio is SCHEDULED (v315), and resolveCardioType was lifted to module
// scope in that release precisely because Program and Home both render a cardio
// row. Inventing an indirection to hide that edge would buy nothing.
//
// Everything it reaches outward is shell, router or a shared primitive:
// renderView, navigate, currentView, viewContext, weekRanges, offerUndo,
// convenienceError, and the js/ui.js vocabulary. Nothing here reaches into
// another domain, and there is not one top-level statement in the file — so a
// pure move is safe and the load order is free. It sits after js/ui.js, whose
// names it borrows at CALL time.
// ==========================================================================

// ==========================================================================
// Body-weight tracking — a per-day weight log with a trend chart. A signature
// feature of every serious nutrition/fitness app. Fully local (DB.bodyweight),
// kg-canonical, shown in the user's chosen unit.
// ==========================================================================
function weightSparkline(entries) {
  if (!entries || entries.length < 2) return '';
  const vals = entries.map((e) => e.kg);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const W = 64, H = 28, P = 3;
  const stepX = (W - P * 2) / (entries.length - 1);
  const coords = entries.map((e, i) => ({
    x: P + i * stepX,
    y: P + (H - P * 2) * (1 - (e.kg - min) / span),
  }));
  const d = coords.map((c, i) => (i === 0 ? `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` : `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)).join(' ');
  const last = coords[coords.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="weight-spark-svg" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5" fill="var(--accent)"/>
  </svg>`;
}

function weightCardHtml() {
  const entries = DB.bodyweight.list();
  const latest = entries.length ? entries[entries.length - 1] : null;
  let deltaHtml = '';
  if (entries.length >= 2) {
    const dKg = latest.kg - entries[entries.length - 2].kg;
    if (dKg !== 0) {
      const dir = dKg > 0 ? 'up' : 'down';
      const sign = dKg > 0 ? '+' : '−';
      deltaHtml = `<span class="weight-delta ${dir}">${sign}${fmtNum(convertWeightForDisplay(Math.abs(dKg)))} ${unitLabel()}</span>`;
    }
  }
  const spark = weightSparkline(entries.slice(-12));
  return `
    <button class="weight-card" id="home-weight">
      <div class="weight-card-icon icon-mirror">${icon('trendLine', 20)}</div>
      <div class="weight-card-main">
        <div class="weight-card-label">${t('bodyweight')}</div>
        <div class="weight-card-value">
          ${latest
            ? `<span class="num">${fmtWeight(latest.kg)}</span><span class="weight-card-unit">${unitLabel()}</span>${deltaHtml}`
            : `<span class="weight-card-empty">${t('weight_add_first')}</span>`}
        </div>
      </div>
      ${spark ? `<div class="weight-card-spark">${spark}</div>` : `<div class="weight-card-add">${icon('plus', 20)}</div>`}
    </button>`;
}

// The full trend chart shown inside the weight sheet. Reuses the .chart-card
// SVG line pattern used by the exercise-progress chart.
function weightTrendChartHtml(entries) {
  const pts = entries.slice(-30).map((e) => ({ value: convertWeightForDisplay(e.kg), date: e.date }));
  if (pts.length < 2) {
    return `<div class="chart-card">
      <div class="chart-head">
        <div class="chart-title">${t('weight_trend')}</div>
        ${pts.length ? `<div class="chart-latest num">${fmtNum(pts[0].value)} ${unitLabel()}</div>` : ''}
      </div>
      <div class="chart-empty">${t('weight_need_more')}</div>
    </div>`;
  }
  const W = 300, H = 110, PAD_X = 12, PAD_Y = 14;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const stepX = (W - PAD_X * 2) / (pts.length - 1);
  const coords = pts.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_Y + (H - PAD_Y * 2) * (1 - (p.value - min) / span),
  }));
  const pathD = coords.map((c, i) => (i === 0 ? `M ${c.x.toFixed(1)} ${c.y.toFixed(1)}` : `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)).join(' ');
  const areaD = pathD + ` L ${coords[coords.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${coords[0].x.toFixed(1)} ${H - PAD_Y} Z`;
  const last = coords[coords.length - 1];
  const totalDelta = pts[pts.length - 1].value - pts[0].value;
  const dCls = totalDelta > 0 ? 'up' : (totalDelta < 0 ? 'down' : 'flat');
  const dSign = totalDelta > 0 ? '+' : (totalDelta < 0 ? '−' : '');
  return `
    <div class="chart-card">
      <div class="chart-head">
        <div class="chart-title">${t('weight_trend')}</div>
        <div class="chart-latest num">${fmtNum(pts[pts.length - 1].value)} ${unitLabel()}</div>
      </div>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="weight-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${areaD}" fill="url(#weight-grad)"/>
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3" fill="var(--accent)"/>
      </svg>
      <div class="chart-foot">
        <span>${escapeHtml(formatDate(pts[0].date))}</span>
        ${totalDelta !== 0 ? `<span class="weight-delta ${dCls}">${dSign}${fmtNum(Math.abs(totalDelta))} ${unitLabel()}</span>` : ''}
        <span>${escapeHtml(formatDate(pts[pts.length - 1].date))}</span>
      </div>
    </div>`;
}

function openWeightSheet() {
  const body = () => {
    const entries = DB.bodyweight.list();
    const latest = entries.length ? entries[entries.length - 1] : null;
    const prefill = latest ? convertWeightForDisplay(latest.kg) : '';
    const history = entries.slice().reverse().slice(0, 40).map((e) => `
      <div class="weight-row">
        <span class="weight-row-date">${escapeHtml(formatDate(e.date))}</span>
        <span class="weight-row-val"><span class="num">${fmtWeight(e.kg)}</span> ${unitLabel()}</span>
        <button class="weight-row-del" data-del-weight="${escapeHtml(e.date)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
      </div>`).join('');
    return `
      ${weightTrendChartHtml(entries)}
      <div class="weight-log-row">
        <input id="weight-input" class="weight-input" type="number" inputmode="decimal" step="0.1" min="0"
          placeholder="${escapeHtml(t('weight_placeholder'))}" value="${prefill}" aria-label="${escapeHtml(t('bodyweight'))}" />
        <span class="weight-input-unit">${unitLabel()}</span>
        <button class="btn btn-primary" id="weight-save">${t('save')}</button>
      </div>
      ${entries.length ? `<div class="weight-history">${history}</div>` : ''}
    `;
  };
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('bodyweight')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div id="weight-sheet-body">${body()}</div>
  `);
  const host = overlay.querySelector('#weight-sheet-body');
  const bind = () => {
    const saveBtn = overlay.querySelector('#weight-save');
    const input = overlay.querySelector('#weight-input');
    const doSave = () => {
      const val = parseFloat(input.value);
      if (!val || val <= 0) { input.focus(); return; }
      DB.bodyweight.log(todayISO(), convertWeightToStorage(val));
      host.innerHTML = body(); bind();
      refreshCaller();
    };
    saveBtn?.addEventListener('click', doSave);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    host.querySelectorAll('[data-del-weight]').forEach((b) =>
      b.addEventListener('click', () => {
        DB.bodyweight.remove(b.getAttribute('data-del-weight'));
        host.innerHTML = body(); bind();
        refreshCaller();
      })
    );
  };
  bind();
}

// ==========================================================================
// CARDIO
// ==========================================================================
// DAY LEDGER — the sleep and cardio histories, one row per DAY, newest first.
// The owner's ask: the days themselves must be visible, and a day with nothing
// logged must say so in words — not vanish from a list that shows only entries.
// Each empty day carries a + that opens the log modal ON that date.
function ledgerDayIso(daysBack) {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - daysBack);
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}
function ledgerDayLabel(iso, daysBack) {
  if (daysBack === 0) return t('today');
  if (daysBack === 1) return t('yesterday');
  const keys = ['dow_sun_full', 'dow_mon_full', 'dow_tue_full', 'dow_wed_full', 'dow_thu_full', 'dow_fri_full', 'dow_sat_full'];
  return t(keys[new Date(iso + 'T12:00:00').getDay()]);
}
function dayLedgerHtml({ entries, days, renderEntry, emptyText, addAttr }) {
  const byDate = {};
  entries.forEach((x) => { (byDate[x.date] = byDate[x.date] || []).push(x); });
  const rows = [];
  // Anything dated AFTER today (a mistyped year, a picker slip) is still shown —
  // above today — so it can be edited or deleted; it used to be unreachable.
  const todayIso = ledgerDayIso(0);
  [...new Set(entries.filter((x) => x.date > todayIso).map((x) => x.date))].sort().reverse().forEach((iso) => {
    rows.push(`
      <div class="ledger-day is-future">
        <div class="ledger-date"><span class="ledger-dow">${escapeHtml(formatDate(iso))}</span><span class="ledger-num">${escapeHtml(t('date_future_tag'))}</span></div>
        <div class="data-list">${byDate[iso].map(renderEntry).join('')}</div>
      </div>`);
  });
  for (let d = 0; d < days; d++) {
    const iso = ledgerDayIso(d);
    const list = byDate[iso] || [];
    rows.push(`
      <div class="ledger-day${list.length ? '' : ' is-empty'}">
        <div class="ledger-date">
          <span class="ledger-dow">${escapeHtml(ledgerDayLabel(iso, d))}</span>
          <span class="ledger-num">${escapeHtml(formatDate(iso))}</span>
        </div>
        ${list.length
          ? `<div class="data-list">${list.map(renderEntry).join('')}</div>`
          : `<button type="button" class="ledger-add" ${addAttr}="${iso}">${icon('plus', 14)} <span>${escapeHtml(emptyText)}</span></button>`}
      </div>`);
  }
  const windowStart = ledgerDayIso(days - 1);
  const older = entries.filter((x) => x.date < windowStart).length;
  // ⚠️ AN EMPTY DAY IS INFORMATION ONLY AS A GAP. Between days that have
  // something, "nothing on the 17th" is a fact worth a row and a + to fill it.
  // With nothing in the window at all it is one sentence repeated `days` times,
  // under a heading that says «all sessions» and over three stat boxes already
  // reading 0 — which is what the owner saw and called illogical. The caller
  // shows one empty state instead. Nothing about the populated case changes.
  const empty = !entries.some((x) => x.date >= windowStart);
  return { html: rows.join(''), more: older > 0 || days < 28, empty };
}
// Module scope, not nested in renderCardio: the Program tab and Home both render
// a cardio row now, and a second copy of this mapping would be an agreement
// between three call sites with nothing keeping them equal.
const builtInClsMap = {
  treadmill: 'treadmill',
  walking: 'walking',
  running: 'running',
  cycling: 'cycling',
};

function resolveCardioType(typeId) {
  const def = DB.cardioTypes.findById(typeId);
  if (def) return { label: def.isCustom ? def.label : t(def.id), iconName: def.iconName, cls: builtInClsMap[def.id] || 'custom' };
  return { label: typeId, iconName: 'heart', cls: '' };
}

function renderCardio(el) {
  const list = DB.cardio.list();
  const { thisStart, thisEnd } = weekRanges();
  const weekItems = list.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const weekMin = weekItems.reduce((s, c) => s + c.duration, 0);
  const weekCal = weekItems.reduce((s, c) => s + c.calories, 0);

  const cardioDays = viewContext.cardioDays || 7;
  const renderCardioEntry = (c) => {
    const tm = resolveCardioType(c.type);
    return `
      <div class="data-row">
        <div class="data-icon ${tm.cls}">${icon(tm.iconName, 20)}</div>
        <div class="data-main">
          <div class="data-title">${escapeHtml(tm.label)}</div>
          <div class="data-meta">
            <!-- The day header above the row carries the date now.
                 Coerced, not interpolated raw. These arrive from the synced
                 blob and from imported backups, both of which CLAUDE.md names
                 as untrusted, and they land in innerHTML — so a string field
                 carrying markup would execute. A number field can only ever be
                 a number; forcing that is stricter than escaping and cheaper. -->
            <!-- unit_min («د»), the same noun every other cardio figure in the app
                 uses — t('minutes') is the COLUMN LABEL «الدقائق», and after a numeral
                 the definite article is not Arabic (the v383 «20 المجموعات» trap). -->
            <span class="num">${fmtNum(Math.round(Number(c.duration) || 0))} ${t('unit_min')}</span>
            <span class="dot-sep"></span>
            <span class="num">${fmtNum(Math.round(Number(c.calories) || 0))} ${t('cal')}</span>
            ${c.source === 'health' ? `<span class="dot-sep"></span><span>${escapeHtml(t('from_watch'))}</span>` : ''}
          </div>
        </div>
        <div class="data-actions">
          <button class="icon-btn" data-edit-cardio="${escapeHtml(c.id)}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-delete-cardio="${escapeHtml(c.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
        </div>
      </div>
    `;
  };
  const cardioLedger = dayLedgerHtml({ entries: list, days: cardioDays, renderEntry: renderCardioEntry, emptyText: t('ledger_no_cardio'), addAttr: 'data-ledger-cardio' });

  el.innerHTML = `
    ${vaultBar()}

    <div class="page-header">
      <div class="page-eyebrow">${t('this_week')}</div>
      <h1 class="page-title">${t('cardio')}</h1>
    </div>

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-box-label">${t('sessions_w')}</div>
        <div class="stat-box-value num">${weekItems.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('minutes')}</div>
        <div class="stat-box-value num">${weekMin}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('calories')}</div>
        <div class="stat-box-value num">${weekCal}</div>
      </div>
    </div>

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('all_sessions')}</div>
      <button class="btn btn-primary" id="add-cardio-btn">${icon('plus', 20)} ${t('log')}</button>
    </div>

    ${cardioLedger.empty
      ? emptyState({ title: t('ledger_empty_cardio') })
      : `<div class="ledger">${cardioLedger.html}</div>`}
    ${cardioLedger.more ? `<button type="button" class="btn btn-ghost btn-block" id="more-cardio-days">${t('ledger_older')}</button>` : ''}
  `;
  $('#more-cardio-days', el)?.addEventListener('click', () => { viewContext.cardioDays = cardioDays + 7; renderCardio(el); });
  el.querySelectorAll('[data-ledger-cardio]').forEach((b) => b.addEventListener('click', () => openCardioModal(null, b.dataset.ledgerCardio)));

  // Single add button: the labeled "Log" button (the top-bar + was a duplicate).
  $('#add-cardio-btn', el).addEventListener('click', () => openCardioModal());
  el.querySelectorAll('[data-edit-cardio]').forEach((b) =>
    b.addEventListener('click', () => openCardioModal(b.dataset.editCardio))
  );
  el.querySelectorAll('[data-delete-cardio]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_cardio_q'),
        text: t('delete_cardio_text'),
        onConfirm: () => {
          DB.cardio.remove(b.dataset.deleteCardio);
          showToast(t('deleted'));
          renderCardio(el);
        },
      });
    })
  );

  // Pull the watch's newest exercise sessions on open. Health Connect sessions
  // already import into this very list (DB.cardio.importFromHealth, badged
  // "Watch"), but the only thing that ever triggered a sync was rendering HOME —
  // so opening Cardio directly showed whatever was cached last time. No-op on
  // web, no-op without permission, throttled to once per 20s; when it does bring
  // something new, Health re-renders this view itself.
  if (typeof Health !== 'undefined' && Health.autoSync) Health.autoSync();
}

function openCardioModal(cardioId = null, presetDate = null) {
  const existing = cardioId ? DB.cardio.list().find((c) => c.id === cardioId) : null;
  let selectedType = existing ? existing.type : 'treadmill';

  function buildTypeOptionsHtml() {
    const all = DB.cardioTypes.allTypes();
    const opts = all.map((tt) => {
      const label = tt.isCustom ? tt.label : t(tt.id);
      const ic = tt.iconName || 'heart';
      // Icon in a tinted tile, like .tool-pod-icon everywhere else in the app — a
      // bare 20px glyph floating over a card is what made this grid look unfinished.
      return `
        <button type="button" class="type-option ${tt.id === selectedType ? 'active' : ''}" data-type="${escapeHtml(tt.id)}">
          <span class="type-option-icon" aria-hidden="true">${icon(ic, 22)}</span>
          <div class="type-option-label">${escapeHtml(label)}</div>
        </button>
      `;
    }).join('');
    return opts + `
      <button type="button" class="type-option type-option-add" id="cardio-add-type">
        ${icon('plus', 20)}
        <div class="type-option-label">${t('new_cardio_type')}</div>
      </button>
    `;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_cardio') : t('log_cardio')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('type')}</label>
      <div class="type-selector" id="cardio-type-selector">${buildTypeOptionsHtml()}</div>
    </div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="cardio-date" max="${todayISO()}" value="${escapeHtml(existing ? existing.date : (presetDate || todayISO()))}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('duration_min')}</label>
        <input type="number" inputmode="numeric" id="cardio-duration" step="1" min="0" value="${numAttr(existing && existing.duration)}" placeholder="30">
      </div>
      <div class="form-group">
        <label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="numeric" id="cardio-calories" step="1" min="0" value="${numAttr(existing && existing.calories)}" placeholder="250">
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-cardio-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  $('#cardio-type-selector').addEventListener('click', (e) => {
    if (e.target.closest('#cardio-add-type')) {
      openNewCardioTypeModal((created) => {
        // Re-render the selector and select the new type
        selectedType = created.id;
        $('#cardio-type-selector').innerHTML = buildTypeOptionsHtml();
      });
      return;
    }
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    selectedType = btn.dataset.type;
    $('#cardio-type-selector').querySelectorAll('.type-option').forEach((b) =>
      b.classList.toggle('active', b.dataset.type === selectedType)
    );
  });

  $('#save-cardio-btn').addEventListener('click', () => {
    const date = $('#cardio-date').value || todayISO();
    if (date > todayISO()) { showToast(t('date_future')); return; }
    const duration = Number($('#cardio-duration').value);
    const calories = Number($('#cardio-calories').value);
    if (!duration || duration <= 0) { showToast(t('enter_duration')); return; }
    if (existing) {
      DB.cardio.update(existing.id, { type: selectedType, date, duration, calories });
      showToast(t('updated'));
    } else {
      DB.cardio.add({ type: selectedType, date, duration, calories });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });
}

// Modal: create a custom cardio type. Persists into DB.cardioTypes and is
// available immediately in the cardio type selector.

// Schedule cardio: which one, which weekdays, how long. Deliberately NOT
// openCardioModal — that one LOGS a finished session and is hard-capped at today.
function openCardioScheduleModal(id = null) {
  const existing = id ? DB.cardioPlan.list().find((r) => r.id === id) : null;
  if (id && !existing) { showToast(t('cx_stale')); return; }
  let selectedType = existing ? existing.type : (DB.cardioTypes.allTypes()[0] || {}).id;
  const days = new Set(existing ? existing.days : []);

  const typeOptions = () => DB.cardioTypes.allTypes().map((tt) => `
    <button type="button" class="type-option ${tt.id === selectedType ? 'active' : ''}" data-type="${escapeHtml(tt.id)}">
      <span class="type-option-icon" aria-hidden="true">${icon(tt.iconName || 'heart', 22)}</span>
      <div class="type-option-label">${escapeHtml(tt.isCustom ? tt.label : t(tt.id))}</div>
    </button>`).join('');

  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${existing ? t('cardio_sched') : t('cardio_sched_add')}</div>
      <button class="icon-btn icon-btn-tile" data-close aria-label="${escapeHtml(t('close'))}">${icon('close', 20)}</button>
    </div>
    <div class="form-group">
      <label class="form-label">${t('type')}</label>
      <div class="type-selector" id="cs-type">${typeOptions()}</div>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cardio_sched_days')}</label>
      <div class="schedule-days" id="cs-days">${weekOrder().map((d) => `
        <button type="button" class="schedule-day ${days.has(d) ? 'active' : ''}" data-csd="${d}"
                aria-pressed="${days.has(d)}">${escapeHtml(dayName(d, true))}</button>`).join('')}</div>
    </div>
    <div class="form-group">
      <label class="form-label" for="cs-duration">${t('duration_min')}</label>
      <input type="number" inputmode="numeric" id="cs-duration" step="1" min="1" placeholder="30"
             value="${numAttr(existing && existing.duration)}">
    </div>
    <div class="form-actions">
      <button class="btn btn-primary btn-block" id="cs-save">${t('save')}</button>
      ${existing ? `<button class="btn btn-danger btn-block" id="cs-delete">${t('delete')}</button>` : ''}
    </div>`);

  overlay.querySelector('#cs-type').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    selectedType = b.dataset.type;
    overlay.querySelectorAll('#cs-type [data-type]').forEach((x) => x.classList.toggle('active', x === b));
  });
  overlay.querySelector('#cs-days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-csd]');
    if (!b) return;
    const d = Number(b.dataset.csd);
    if (days.has(d)) days.delete(d); else days.add(d);
    b.classList.toggle('active', days.has(d));
    b.setAttribute('aria-pressed', days.has(d));
  });
  overlay.querySelector('#cs-save').addEventListener('click', () => {
    const duration = Number(overlay.querySelector('#cs-duration').value);
    const payload = { type: selectedType, days: [...days], duration };
    const result = existing ? DB.cardioPlan.update(existing.id, payload) : DB.cardioPlan.add(payload);
    if (!result.ok) {
      showToast(result.code === 'LIMIT' ? t('cardio_sched_limit')
        : result.code === 'STALE' ? t('cx_stale') : t('cardio_sched_need'));
      return;
    }
    closeModal();
    renderView(currentView);
    offerUndo(t('cardio_sched_saved'), result);
  });
  overlay.querySelector('#cs-delete')?.addEventListener('click', () => {
    confirmDialog({
      title: t('delete_cardio_sched_q'), text: '', confirmLabel: t('delete'), variant: 'danger',
      onConfirm: () => {
        // Removing the schedule never touches the cardio LOG: sessions already
        // performed are history, and history is not the schedule's to erase.
        const result = DB.cardioPlan.remove(existing.id);
        if (!result.ok) { convenienceError(result); return; }
        closeModal();
        renderView(currentView);
        offerUndo(t('cardio_sched_deleted'), result);
      },
    });
  });
}

function openNewCardioTypeModal(onCreated) {
  let pickedIcon = 'heart';

  function iconChipsHtml() {
    return CARDIO_ICON_OPTIONS.map((nm) => `
      <button type="button" class="cardio-icon-chip ${nm === pickedIcon ? 'active' : ''}" data-cardio-icon="${nm}" aria-label="${nm}">
        ${icon(nm, 20)}
      </button>
    `).join('');
  }

  // We need to lay this on top of the existing modal (cardio modal). Use a
  // nested overlay so closing this only closes the new-type sub-modal.
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay nested';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">${t('new_cardio_type')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-cardio-type-cancel aria-label="${escapeHtml(t('cancel'))}">${icon('close', 20)}</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t('name')}</label>
        <input type="text" id="cardio-type-name" placeholder="${t('cardio_type_name_ph')}">
      </div>

      <div class="form-group">
        <label class="form-label">${t('icon')}</label>
        <div class="cardio-icon-chips" id="cardio-type-icons">${iconChipsHtml()}</div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-cardio-type-cancel>${t('cancel')}</button>
        <button type="button" class="btn btn-primary" id="cardio-type-save">${t('save')}</button>
      </div>
    </div>
  `;
  $('#modal-root').appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.querySelectorAll('[data-cardio-type-cancel]').forEach((b) => b.addEventListener('click', close));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#cardio-type-icons').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cardio-icon]');
    if (!chip) return;
    pickedIcon = chip.dataset.cardioIcon;
    overlay.querySelectorAll('[data-cardio-icon]').forEach((b) =>
      b.classList.toggle('active', b.dataset.cardioIcon === pickedIcon)
    );
  });

  overlay.querySelector('#cardio-type-save').addEventListener('click', () => {
    const name = overlay.querySelector('#cardio-type-name').value.trim();
    if (!name) { showToast(t('enter_name')); return; }
    const created = DB.cardioTypes.add({ label: name, iconName: pickedIcon });
    if (!created) return;
    showToast(t('saved'));
    close();
    if (typeof onCreated === 'function') onCreated(created);
  });

  setTimeout(() => overlay.querySelector('#cardio-type-name')?.focus(), 30);
}

// ==========================================================================
// SLEEP
// ==========================================================================
// Derive a simple quality read from Health Connect sleep stages. Health Connect
// has no native "quality score", so this is computed from sleep efficiency (time
// asleep vs in bed) and the share of restorative deep+REM sleep.
function sleepQuality(stages) {
  if (!stages) return null;
  const deep = stages.deep || 0, light = stages.light || 0, rem = stages.rem || 0, awake = stages.awake || 0;
  const asleep = deep + light + rem;
  if (asleep <= 0) return null;
  const inBed = asleep + awake;
  const efficiency = inBed > 0 ? asleep / inBed : 1;
  const deepRem = (deep + rem) / asleep;
  let key = 'fair';
  if (efficiency >= 0.9 && deepRem >= 0.4) key = 'excellent';
  else if (efficiency >= 0.85 && deepRem >= 0.28) key = 'good';
  return { key, efficiency: Math.round(efficiency * 100) };
}

// Segmented sleep-stage bar (+ legend + quality, unless compact). Renders
// nothing when the entry has no stage data (e.g. a manual entry, or a source
// app that doesn't record stages).
function sleepStagesHtml(entry, opts) {
  const s = entry && entry.stages;
  if (!s) return '';
  const deep = s.deep || 0, light = s.light || 0, rem = s.rem || 0, awake = s.awake || 0;
  const total = deep + light + rem + awake;
  if (total <= 0) return '';
  const seg = (v, cls) => (v > 0 ? `<span class="sl-seg ${cls}" style="width:${(v / total * 100)}%"></span>` : '');
  const bar = `<div class="sl-bar">${seg(deep, 'deep')}${seg(rem, 'rem')}${seg(light, 'light')}${seg(awake, 'awake')}</div>`;
  if (opts && opts.compact) return `<div class="sl-bar-wrap">${bar}</div>`;
  const q = sleepQuality(s);
  const leg = (v, cls, label) => (v > 0
    ? `<div class="sl-leg-item"><span class="sl-dot ${cls}"></span><span class="sl-leg-label">${label}</span><span class="sl-leg-val num">${formatDuration(v)}</span></div>`
    : '');
  return `
    <div class="sleep-detail">
      <div class="sleep-detail-head">
        <div class="sleep-detail-title">${t('sleep_stages')}</div>
        ${q ? `<span class="sleep-quality q-${q.key}">${t('sleep_q_' + q.key)}</span>` : ''}
      </div>
      ${bar}
      <div class="sl-legend">
        ${leg(deep, 'deep', t('sleep_deep'))}
        ${leg(rem, 'rem', t('sleep_rem'))}
        ${leg(light, 'light', t('sleep_light'))}
        ${leg(awake, 'awake', t('sleep_awake'))}
      </div>
      ${q ? `<div class="sleep-eff">${t('sleep_efficiency')}: <span class="num">${q.efficiency}%</span></div>` : ''}
    </div>`;
}

function renderSleep(el) {
  const list = DB.sleep.list();
  const sleepDays = viewContext.sleepDays || 7;
  const last7 = list.slice(0, 7);
  const avgMin = last7.length > 0
    ? Math.round(last7.reduce((s, x) => s + x.durationMinutes, 0) / last7.length)
    : 0;
  const latest = list[0];

  // One row per night, under its day header (the header carries the date).
  const renderSleepEntry = (s) => `
    <div class="data-row">
      <div class="data-icon sleep">${icon('bed', 20)}</div>
      <div class="data-main">
        <!-- ⚠️ ONE ltr RUN, NOT THREE FLEX ITEMS. .data-title is a non-wrapping
             flex row, so as three items the range could not wrap between the
             times: each time broke INSIDE itself instead («11:10» over «PM»),
             and anything after them was pushed clean out of the column into the
             middle of the row — which is where the «الساعة» badge used to land.
             A range is one object with an order (v374), and each time is a
             word that must not break. -->
        <div class="data-title"><span class="num time-range" dir="ltr"><span class="time-word">${formatTime12(s.sleepTime)}</span> <span aria-hidden="true">→</span> <span class="time-word">${formatTime12(s.wakeTime)}</span></span></div>
        <div class="data-meta">
          <span>${escapeHtml(t('total_sleep'))}</span>
          ${s.source === 'health' ? `<span class="dot-sep"></span><span>${escapeHtml(t('from_watch'))}</span>` : ''}
        </div>
        ${sleepStagesHtml(s, { compact: true })}
      </div>
      <div class="data-value num">${formatDuration(s.durationMinutes)}</div>
      <div class="data-actions">
        <button class="icon-btn" data-edit-sleep="${escapeHtml(s.id)}" aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
        <button class="icon-btn danger" data-delete-sleep="${escapeHtml(s.id)}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 16)}</button>
      </div>
    </div>
  `;
  const sleepLedger = dayLedgerHtml({ entries: list, days: sleepDays, renderEntry: renderSleepEntry, emptyText: t('ledger_no_sleep'), addAttr: 'data-ledger-sleep' });

  el.innerHTML = `
    ${vaultBar()}

    <div class="page-header">
      <div class="page-eyebrow">${t('nights_logged_t')}</div>
      <h1 class="page-title">${t('sleep')}</h1>
    </div>

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-box-label">${t('last_night')}</div>
        <div class="stat-box-value ${latest ? 'accent' : 'none'} num">${latest ? formatDuration(latest.durationMinutes) : '—'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('avg_7d')}</div>
        <div class="stat-box-value ${avgMin > 0 ? '' : 'none'} num">${avgMin > 0 ? formatDuration(avgMin) : '—'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('nights_logged')}</div>
        <div class="stat-box-value num">${list.length}</div>
      </div>
    </div>

    ${latest ? `
      <!-- APPLY-vault.md §4: ONE card carries last night — duration in 34px
           mono, then the stage bar, then the times. Then two small cards, deep
           and efficiency. The three stat boxes above stay: they answer "how am
           I doing lately", which is a different question from "how was last
           night" and is what the rest of the list is about. -->
      <div class="card sleep-hero">
        <div class="sleep-hero-label">${t('last_night')}</div>
        <div class="sleep-hero-dur num" dir="ltr">${formatDuration(latest.durationMinutes)}</div>
        ${latest.stages ? sleepStagesHtml(latest, { compact: true }) : ''}
        <!-- The SAME range idiom as the ledger row below it (v389): one ltr run,
             not three flex items. As three items an RTL row laid them right to
             left with the arrow still pointing right, so the hero read
             «6:40 AM → 11:05 PM» — wake before sleep — directly above a row that
             read the opposite. A range has an order; the arrow points along it. -->
        <div class="sleep-hero-times">
          ${icon('moon', 16)}<span class="num time-range" dir="ltr"><span class="time-word">${formatTime12(latest.sleepTime)}</span> <span aria-hidden="true">→</span> <span class="time-word">${formatTime12(latest.wakeTime)}</span></span>
        </div>
      </div>
      ${latest.stages ? (() => {
        const q = sleepQuality(latest.stages);
        const deepMin = latest.stages.deep || 0;
        return `
          <div class="sleep-mini">
            <div class="card sleep-mini-card">
              <div class="sleep-mini-label">${t('sleep_deep')}</div>
              <div class="sleep-mini-value num" dir="ltr">${formatDuration(deepMin)}</div>
            </div>
            <div class="card sleep-mini-card">
              <div class="sleep-mini-label">${t('sleep_efficiency')}</div>
              <div class="sleep-mini-value num" dir="ltr">${q ? q.efficiency + '%' : '—'}</div>
            </div>
          </div>`;
      })() : ''}
    ` : ''}

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('history')}</div>
      <button class="btn btn-primary" id="add-sleep-btn">${icon('plus', 20)} ${t('log')}</button>
    </div>

    ${sleepLedger.empty
      ? emptyState({ title: t('ledger_empty_sleep') })
      : `<div class="ledger">${sleepLedger.html}</div>`}
    ${sleepLedger.more ? `<button type="button" class="btn btn-ghost btn-block" id="more-sleep-days">${t('ledger_older')}</button>` : ''}
  `;

  $('#add-sleep-btn', el).addEventListener('click', () => openSleepModal());
  $('#more-sleep-days', el)?.addEventListener('click', () => { viewContext.sleepDays = sleepDays + 7; renderSleep(el); });
  el.querySelectorAll('[data-ledger-sleep]').forEach((b) => b.addEventListener('click', () => openSleepModal(null, b.dataset.ledgerSleep)));
  el.querySelectorAll('[data-edit-sleep]').forEach((b) =>
    b.addEventListener('click', () => openSleepModal(b.dataset.editSleep))
  );
  el.querySelectorAll('[data-delete-sleep]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_sleep_q'),
        text: t('delete_sleep_text'),
        onConfirm: () => {
          DB.sleep.remove(b.dataset.deleteSleep);
          showToast(t('deleted'));
          renderSleep(el);
        },
      });
    })
  );
}

function openSleepModal(sleepId = null, presetDate = null) {
  const existing = sleepId ? DB.sleep.list().find((s) => s.id === sleepId) : null;
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_sleep') : t('log_sleep')}</div>
        <div class="modal-subtitle">${t('sleep_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="sleep-date" max="${todayISO()}" value="${escapeHtml(existing ? existing.date : (presetDate || todayISO()))}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('sleep_time')}</label>
        <input type="time" id="sleep-start" value="${escapeHtml(existing ? existing.sleepTime : '23:00')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('wake_time')}</label>
        <input type="time" id="sleep-end" value="${escapeHtml(existing ? existing.wakeTime : '07:00')}">
      </div>
    </div>

    <div id="sleep-duration-preview" class="prev-session" style="margin-bottom:0">
      <div class="prev-session-head"><span>${t('total_sleep')}</span></div>
      <div class="prev-session-sets num" style="font-size:18px;font-weight:700;letter-spacing:-0.03em"></div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-sleep-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  function updatePreview() {
    const start = $('#sleep-start').value;
    const end = $('#sleep-end').value;
    const prev = $('#sleep-duration-preview .prev-session-sets');
    if (!start || !end) { prev.textContent = '—'; return; }
    const [sh, sm] = start.split(':').map(Number);
    const [wh, wm] = end.split(':').map(Number);
    let s = sh * 60 + sm;
    let e = wh * 60 + wm;
    if (e <= s) e += 24 * 60;
    prev.textContent = formatDuration(e - s);
  }
  updatePreview();
  $('#sleep-start').addEventListener('input', updatePreview);
  $('#sleep-end').addEventListener('input', updatePreview);

  $('#save-sleep-btn').addEventListener('click', () => {
    const date = $('#sleep-date').value;
    if (date > todayISO()) { showToast(t('date_future')); return; }
    const sleepTime = $('#sleep-start').value;
    const wakeTime = $('#sleep-end').value;
    if (!date || !sleepTime || !wakeTime) { showToast(t('fill_all_fields')); return; }
    if (existing) {
      DB.sleep.update(existing.id, { date, sleepTime, wakeTime });
      showToast(t('updated'));
    } else {
      DB.sleep.add({ date, sleepTime, wakeTime });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });
}
