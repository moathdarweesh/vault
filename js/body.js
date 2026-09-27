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
// ⚠️ THE LATERAL EDGES IN — measured (v401), not one as this header said until
// then. Beside the router's renderCardio/renderSleep, js/app.js reaches three
// names here from five callers: resolveCardioType() from renderProgram, renderHome
// and renderDay (every screen that prints a cardio row names it the same way);
// openCardioScheduleModal() from renderProgram (Program is where cardio is
// SCHEDULED, v315); weightCardHtml() and openWeightSheet() from renderHome, and
// openWeightSheet() again from runQuickAction and the unified search (the weight
// quick actions). Each is this domain's own surface, used where it is shown;
// inventing an indirection to hide them would buy nothing. v410 adds one more:
// openGoalModal() from renderSettings — the two goals (cardio minutes a week,
// sleep minutes a night) are this domain's, and Settings offers the same sheet
// the heroes' goal buttons open, so a default that feels imposed is found in
// two places and edited through one.
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
  if (def) return { label: def.isCustom ? def.label : t(def.id), iconName: def.iconName, cls: builtInClsMap[def.id] || 'cardio-custom' };
  return { label: typeId, iconName: 'heart', cls: '' };
}

// THE NEWEST RECORD: the latest DATE, and within that day the row written
// LAST. DB.cardio.list() and DB.sleep.list() are stable sorts by date alone
// and add() pushes, so list[0] is the day's FIRST row — a walk then a run left
// «سجّل» wearing the walk, and a night corrected by adding a second row kept
// the ring on the older one. createdAt decides; on a tie (or a row from an old
// blob without one) the store's own order does, where the later-written row
// sits later. renderSleep's byNight applies the same rule to every date.
function newestRecord(list) {
  let best = null, bestAt = '';
  for (const c of list) {
    if (c.date !== list[0].date) break;
    const at = String(c.createdAt || '');
    if (!best || at >= bestAt) { best = c; bestAt = at; }
  }
  return best;
}

// THE TRACK (v410) — seven wells under one figure: the Cardio hero's week
// (the Sleep hero took the food log's ring instead). `cols` are the seven days
// in order, each { label, segs: [minutes…], hit, today, future }; `scale` is
// the minutes that fill a well and `line` the pace or goal in the same unit.
// The bars are formed by the data and coloured by state: accent when the day
// reached the line (.is-hit), --surface-3 when it did not, an empty well (a
// step toward the ground from the card, in both themes) when nothing was
// logged, a dimmed well for a day still to come. Two sessions on one day stack
// as two segments with a seam in the well's own colour, so «two walks» shows
// without a label. Every bar carries --k, its
// column, for the arrival stagger; --v and --b are its height and its base.
// Nothing here is tappable — no border, no control; the exact figures live in
// the ledger under it. The goal line comes first in the DOM (z-index lifts it
// over the bars) so the seven wells stay :nth-child-addressable. A day past the
// scale (the caller caps it) fills its well to the top and stops there — the
// figure above and the ledger below still say the whole of it.
function trackHtml({ cols, scale, line, met, ariaLabel }) {
  const pct = (v) => Math.round(v / scale * 1000) / 10;
  const wells = cols.map((c, k) => {
    let base = 0;
    const segs = c.segs.map((v) => {
      const seg = Math.min(v, scale - base);
      if (seg <= 0) return '';
      const h = `<span class="trk-bar${c.hit ? ' is-hit' : ''}" style="--v:${pct(seg)}%;--b:${pct(base)}%;--k:${k}"></span>`;
      base += seg;
      return h;
    }).join('');
    return `<span class="trk-col${c.future ? ' is-future' : ''}">${segs}</span>`;
  }).join('');
  const days = cols.map((c) => `<span class="trk-day${c.today ? ' is-today' : ''}${c.future ? ' is-future' : ''}">${escapeHtml(c.label)}</span>`).join('');
  return `
    <div class="trk-bars${met ? ' is-met' : ''}" role="img" aria-label="${escapeHtml(ariaLabel)}"><span class="trk-goal" style="bottom:${pct(line)}%"></span>${wells}</div>
    <div class="trk-days" aria-hidden="true">${days}</div>`;
}

// The seven short weekday labels for a run of ISO days, today's marked.
function trackDayLabel(iso) { return dayName(new Date(iso + 'T12:00:00').getDay()); }

// Minutes as a reader SAYS them, for an aria-label: «د» is the eye's unit and
// a screen reader spells it as the letter dāl. Arabic counts one, two, 3–10
// and 11+ differently (the rest_min_go_n / _many ladder).
function spokenMinutes(n) {
  const k = n === 1 ? 'trk_min_1' : n === 2 ? 'trk_min_2' : n <= 10 ? 'trk_min_n' : 'trk_min_many';
  return t(k).replace('{n}', fmtNum(n));
}

// ONE sheet for both goals (v410). Cardio is minutes a week (30–1200, the
// WHO's 150 by default); sleep is entered in hours (4–12, in halves) and
// stored as minutes. Opened from each hero's goal button and from the two
// Settings rows; the view that opened it repaints on save.
function openGoalModal(kind) {
  const sleep = kind === 'sleep';
  const val = sleep ? DB.prefs.sleepGoal() / 60 : DB.prefs.cardioGoal();
  const lo = sleep ? 4 : 30, hi = sleep ? 12 : 1200;
  // The view the sheet was opened from (the hero's button or the Settings
  // row): the repaint on save rebuilds that button, so focus is handed to its
  // successor rather than left on <body>.
  const from = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.view') : null;
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t(sleep ? 'sleep_goal' : 'cardio_goal')}</div>
        <div class="modal-subtitle">${t(sleep ? 'goal_hint_sleep' : 'goal_hint_cardio')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 20)}</button>
    </div>
    <div class="form-group">
      <label class="form-label" for="goal-input">${t(sleep ? 'goal_hours' : 'goal_min_week')}</label>
      <input type="number" id="goal-input" inputmode="${sleep ? 'decimal' : 'numeric'}" min="${lo}" max="${hi}" step="${sleep ? 0.5 : 5}" value="${val}"${sleep ? ' aria-describedby="goal-live"' : ''}>
      ${sleep ? `<div class="goal-live num" id="goal-live" aria-live="polite">${formatDuration(Math.round(val * 60))}</div>` : ''}
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="goal-save">${t('save')}</button>
    </div>
  `);
  $('#goal-save').addEventListener('click', () => {
    const n = Number($('#goal-input').value);
    // The store clamps (DB.prefs.set*Goal) — the sheet says so instead: «3»
    // used to save as 4:00 with nothing on screen to say why.
    if (!Number.isFinite(n) || n < lo || n > hi) {
      showToast(t('goal_range').replace('{a}', fmtNum(lo)).replace('{b}', fmtNum(hi)));
      $('#goal-input').focus();
      return;
    }
    if (sleep) DB.prefs.setSleepGoal(Math.round(n * 60)); else DB.prefs.setCardioGoal(n);
    closeModal();
    renderView(currentView);
    const back = from && from.querySelector(sleep ? '#sleep-goal-btn, [data-goal="sleep"]' : '#cardio-goal-btn, [data-goal="cardio"]');
    if (back) back.focus({ preventScroll: true });
  });
  // The goal is SHOWN as H:MM everywhere and typed as hours («7.5»): the line
  // under the field reads the hours back the way the hero will show them.
  if (sleep) {
    $('#goal-input').addEventListener('input', () => {
      const n = Number($('#goal-input').value);
      $('#goal-live').textContent = $('#goal-input').value !== '' && Number.isFinite(n) && n > 0 ? formatDuration(Math.round(n * 60)) : '—';
    });
  }
  setTimeout(() => $('#goal-input')?.focus(), 30);
}

function renderCardio(el) {
  const list = DB.cardio.list();
  const { thisStart, thisEnd } = weekRanges();
  const weekItems = list.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  // Coerced as they are summed, like the rows below: loadState makes every
  // stored figure a number, and a total printed into innerHTML does not rely
  // on it — one string turned `s + c.duration` into concatenated markup.
  const weekMin = weekItems.reduce((s, c) => s + (Number(c.duration) || 0), 0);
  const weekCal = weekItems.reduce((s, c) => s + (Number(c.calories) || 0), 0);

  // THE INSTRUMENT (v410): the week's minutes as one figure over a seven-column
  // track, against a weekly goal. The pace line is the goal spread over the
  // week (ceil(goal ÷ 7)); the scale is twice the pace or the biggest day,
  // whichever is larger, so the line sits mid-height on an ordinary week —
  // CAPPED at four times the pace, so one long ride cannot press every other
  // day into a sliver (a day past the cap fills its well; trackHtml clamps it).
  const goal = DB.prefs.cardioGoal();
  const pace = Math.ceil(goal / 7);
  const todayIso = todayISO();
  const byDay = {};
  weekItems.forEach((c) => { const m = Math.round(Number(c.duration) || 0); if (m > 0) (byDay[c.date] = byDay[c.date] || []).push(m); });
  const cols = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(thisStart); d.setDate(d.getDate() + i);
    const iso = isoOf(d);
    const segs = byDay[iso] || [];
    const sum = segs.reduce((a, b) => a + b, 0);
    cols.push({ label: trackDayLabel(iso), segs, sum, hit: sum >= pace, today: iso === todayIso, future: iso > todayIso });
  }
  const scale = Math.min(Math.max(2 * pace, ...cols.map((c) => c.sum)), 4 * pace);
  const met = weekMin >= goal;
  const weekEnd = new Date(thisEnd); weekEnd.setDate(weekEnd.getDate() - 1);
  // A day still to come is not «nothing»: the label reads only the days that
  // have happened (the future wells are dimmed for the eye).
  const trackAria = t('trk_aria_cardio') + ': ' + cols.filter((c) => !c.future).map((c) => `${c.label} ${c.sum ? spokenMinutes(c.sum) : t('trk_none')}`).join(t('list_sep'));
  // The sheet opens on the type of the newest session; «سجّل» wears its glyph
  // so the door says what it will preselect.
  const lastUsed = (newestRecord(list) || {}).type;
  const lastType = resolveCardioType(DB.cardioTypes.findById(lastUsed) ? lastUsed : 'treadmill');
  const latinUnit = !/[\u0600-\u06FF]/.test(t('unit_min'));

  const cardioDays = viewContext.cardioDays || 7;
  // THE FIGURE ROW (v395), the sleep row's shape: the minutes first, the type
  // and its calories beside them, the type's own tile at the end. The row is
  // the door to the session's sheet and delete lives inside it (v394).
  //
  // Coerced, not interpolated raw: duration and calories arrive from the synced
  // blob and from imported backups, both untrusted, and land in innerHTML — a
  // number field can only ever be a number, which is stricter than escaping.
  // unit_min («د»), never t('minutes') — that is the COLUMN LABEL «الدقائق», and
  // after a numeral the definite article is not Arabic (the v383 trap). A zero
  // calorie figure (a manual walk logged without one) is not drawn: «0 سعرة»
  // is not a fact about the walk.
  const renderCardioEntry = (c) => {
    const tm = resolveCardioType(c.type);
    const min = Math.round(Number(c.duration) || 0);
    const cal = Math.round(Number(c.calories) || 0);
    const watch = c.source === 'health';
    // The name reads the way the row reads: the figure, then the type.
    const label = `${formatDate(c.date)} — ${fmtNum(min)} ${t('unit_min')} — ${tm.label}${cal > 0 ? ` — ${fmtNum(cal)} ${t('cal')}` : ''}${watch ? ` — ${t('from_watch')}` : ''}`;
    return `
      <button type="button" class="data-row fig-row" data-edit-cardio="${escapeHtml(c.id)}" aria-label="${escapeHtml(label)}">
        <div class="fig-row-main">
          ${figRowFig(fmtNum(min), t('unit_min'))}
          <div class="fig-row-text">
            <div class="fig-row-title">${escapeHtml(tm.label)}</div>
            ${cal > 0 || watch ? `<div class="fig-row-sub">${cal > 0 ? `<span class="num">${fmtNum(cal)}</span> ${t('cal')}` : ''}${cal > 0 && watch ? ' · ' : ''}${watch ? escapeHtml(t('from_watch')) : ''}</div>` : ''}
          </div>
          <div class="data-icon ${tm.cls} fig-row-tile" aria-hidden="true">${icon(tm.iconName, 18)}</div>
        </div>
      </button>
    `;
  };
  const cardioLedger = dayLedgerHtml({ entries: list, days: cardioDays, renderEntry: renderCardioEntry, emptyText: t('ledger_no_cardio'), addAttr: 'data-ledger-cardio' });

  el.innerHTML = `
    ${vaultBar()}

    <div class="page-header">
      <h1 class="page-title">${t('cardio')}</h1>
    </div>

    <div class="card trk-hero">
      <div class="trk-cap">
        <span class="trk-range" dir="auto">${escapeHtml(formatDateShort(isoOf(thisStart)))} – ${escapeHtml(formatDateShort(isoOf(weekEnd)))}</span>
        <button type="button" class="trk-goal-btn" id="cardio-goal-btn" aria-label="${escapeHtml(t('cardio_goal') + ' ' + fmtNum(goal) + ' ' + t('unit_min'))}">${t('cardio_goal')} <span class="num">${fmtNum(goal)}</span> ${t('unit_min')}</button>
      </div>
      <div class="trk-fig">
        <span class="trk-val"${latinUnit ? ' dir="ltr"' : ''}><span class="num trk-num">${fmtNum(weekMin)}</span><span class="trk-unit">${escapeHtml(t('unit_min'))}</span></span>
        <span class="trk-deltas"><span class="trk-delta${met ? ' is-met' : ''}">${met ? t('goal_met') : t('goal_left').replace('{n}', fmtNum(goal - weekMin))}</span></span>
      </div>
      <!-- Labelled figures, the label FIRST: «٤ الجلسات» put the article after
           a numeral (the v383 trap); «الجلسات 4» is a label and its value. -->
      <div class="trk-readouts">
        <span class="trk-ro"><span class="trk-ro-lab">${t('sessions_w')}</span><span class="num trk-ro-val">${fmtNum(weekItems.length)}</span></span>
        <span class="trk-ro"><span class="trk-ro-lab">${t('calories')}</span><span class="num trk-ro-val">${fmtNum(weekCal)}</span></span>
      </div>
      ${trackHtml({ cols, scale, line: pace, met, ariaLabel: trackAria })}
    </div>

    <!-- With no session at all, the hero at zero and «سجّل» already say it:
         no «all sessions» header over nothing, no sentence, no door to older
         days that are just as empty. -->
    <div class="row-between mb-16">
      ${list.length ? `<div class="section-title" style="margin:0">${t('all_sessions')}</div>` : ''}
      <button class="btn btn-primary" id="add-cardio-btn" aria-label="${escapeHtml(t('log') + ' — ' + lastType.label)}">${icon(lastType.iconName, 18)} ${t('log')}</button>
    </div>

    ${!list.length ? '' : cardioLedger.empty
      ? emptyState({ title: t('ledger_empty_cardio') })
      : `<div class="ledger">${cardioLedger.html}</div>`}
    ${list.length && cardioLedger.more ? `<button type="button" class="btn btn-ghost btn-block" id="more-cardio-days">${t('ledger_older')}</button>` : ''}
  `;
  $('#more-cardio-days', el)?.addEventListener('click', () => { viewContext.cardioDays = cardioDays + 7; renderCardio(el); });
  el.querySelectorAll('[data-ledger-cardio]').forEach((b) => b.addEventListener('click', () => openCardioModal(null, b.dataset.ledgerCardio)));

  // Single add button: the labeled "Log" button (the top-bar + was a duplicate).
  $('#add-cardio-btn', el).addEventListener('click', () => openCardioModal());
  $('#cardio-goal-btn', el).addEventListener('click', () => openGoalModal('cardio'));
  el.querySelectorAll('[data-edit-cardio]').forEach((b) =>
    b.addEventListener('click', () => openCardioModal(b.dataset.editCardio))
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
  // Fewer taps (v410): a new session opens on the type of the NEWEST session,
  // not always the treadmill — a walker's log is open → digits → save. A type
  // deleted since falls back to the first built-in.
  const lastUsed = (newestRecord(DB.cardio.list()) || {}).type;
  let selectedType = existing ? existing.type : (DB.cardioTypes.findById(lastUsed) ? lastUsed : 'treadmill');

  // The grid holds only OPTIONS (role=radiogroup); the add control sits under
  // it on its own line, so it never strands itself in a hole of the grid. On
  // the sheet's first paint the checked tile's glyph plays one settle
  // (.ed-pick) so «this is the one» is read before the first tap; a rebuild
  // after adding a type shows its final state with no replay.
  function buildTypeOptionsHtml(settle) {
    const all = DB.cardioTypes.allTypes();
    return all.map((tt) => {
      const label = tt.isCustom ? tt.label : t(tt.id);
      const ic = tt.iconName || 'heart';
      const on = tt.id === selectedType;
      return `
        <button type="button" class="type-option ${on ? 'active' : ''}${on && settle ? ' ed-pick' : ''}" role="radio" aria-checked="${on}" data-type="${escapeHtml(tt.id)}">
          <span class="type-option-icon" aria-hidden="true">${icon(ic, 22)}</span>
          <div class="type-option-label">${escapeHtml(label)}</div>
        </button>
      `;
    }).join('');
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
      <div class="type-selector" id="cardio-type-selector" role="radiogroup" aria-label="${escapeHtml(t('type'))}">${buildTypeOptionsHtml(true)}</div>
      <button type="button" class="type-option-add" id="cardio-add-type">${icon('plus', 16)} <span>${t('new_type')}</span></button>
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
      ${existing ? `<button type="button" class="btn btn-danger" id="delete-cardio-btn">${t('delete')}</button>` : ''}
      <button type="button" class="btn btn-primary" id="save-cardio-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  // Delete lives here since v395 (the ledger row carries no controls) — the
  // sleep sheet's shape exactly: confirmDialog replaces #modal-root, the
  // ledger repaints through the router, and focus lands on «سجّل» because the
  // repaint detached the row closeModal() had just focused.
  $('#delete-cardio-btn')?.addEventListener('click', () => {
    if (!existing) return;
    confirmDialog({
      title: t('delete_cardio_q'),
      text: t('delete_cardio_text'),
      onConfirm: () => {
        DB.cardio.remove(existing.id);
        showToast(t('deleted'));
        renderView(currentView);
        const home = document.getElementById('add-cardio-btn');
        if (home) home.focus({ preventScroll: true });
      },
    });
  });

  $('#cardio-add-type').addEventListener('click', () => {
    openNewCardioTypeModal((created) => {
      // Re-render the selector and select the new type
      selectedType = created.id;
      $('#cardio-type-selector').innerHTML = buildTypeOptionsHtml(false);
    });
  });
  // The tiles are toggled IN PLACE, never rebuilt: the tint spreading from
  // --surface-3 to the solid accent plate is a transition, and a transition
  // only runs on a node that stays.
  $('#cardio-type-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    selectedType = btn.dataset.type;
    $('#cardio-type-selector').querySelectorAll('.type-option[data-type]').forEach((b) =>
      setChosen(b, b.dataset.type === selectedType)
    );
  });
  // A NEW session: focus lands in the minutes, the one field a walk needs (the
  // new-type sheet's own pattern for its name field). An existing one is
  // opened to be read or deleted as often as edited — raising the keyboard
  // there covered the tiles and the delete/save row.
  if (!existing) setTimeout(() => $('#cardio-duration')?.focus(), 30);

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
    <button type="button" class="type-option ${tt.id === selectedType ? 'active' : ''}" role="radio" aria-checked="${tt.id === selectedType}" data-type="${escapeHtml(tt.id)}">
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
      <div class="type-selector" id="cs-type" role="radiogroup" aria-label="${escapeHtml(t('type'))}">${typeOptions()}</div>
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
    overlay.querySelectorAll('#cs-type [data-type]').forEach((x) => setChosen(x, x === b));
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
        // The row that opened this sheet is a door since v395, and the repaint
        // just detached it — land on the list's add control, not <body>.
        const home = document.querySelector('#cardio-sched-list [data-cardio-sched-add]');
        if (home) home.focus({ preventScroll: true });
        offerUndo(t('cardio_sched_deleted'), result);
      },
    });
  });
}

// An icon chip's accessible name. The ids are code words («heartPulse», «zap»)
// and the chips used to be named with them — read aloud in English on the
// Arabic sheet. A literal key per id, so contract 5 sees every one of them.
function cardioIconName(id) {
  switch (id) {
    case 'run': return t('running');
    case 'walk': return t('walking');
    case 'bike': return t('cycling');
    case 'treadmill': return t('treadmill');
    case 'heart': return t('cardio_icon_heart');
    case 'heartPulse': return t('cardio_icon_pulse');
    case 'flame': return t('cardio_icon_flame');
    case 'zap': return t('cardio_icon_zap');
    case 'clock': return t('cardio_icon_clock');
    default: return t('icon');
  }
}

function openNewCardioTypeModal(onCreated) {
  let pickedIcon = 'heart';

  function iconChipsHtml() {
    return CARDIO_ICON_OPTIONS.map((nm) => `
      <button type="button" class="cardio-icon-chip ${nm === pickedIcon ? 'active' : ''}" role="radio" aria-checked="${nm === pickedIcon}" data-cardio-icon="${nm}" aria-label="${escapeHtml(cardioIconName(nm))}">
        ${icon(nm, 20)}
      </button>
    `).join('');
  }

  // We need to lay this on top of the existing modal (cardio modal). Use a
  // nested overlay so closing this only closes the new-type sub-modal.
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay nested';
  overlay.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="cardio-type-title">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="cardio-type-title">${t('new_cardio_type')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-cardio-type-cancel aria-label="${escapeHtml(t('cancel'))}">${icon('close', 20)}</button>
      </div>

      <div class="form-group">
        <!-- for= by hand: this sub-sheet is appended to #modal-root beside the
             cardio sheet, not through openModal, so labelSheetFields never sees it. -->
        <label class="form-label" for="cardio-type-name">${t('name')}</label>
        <input type="text" id="cardio-type-name" placeholder="${t('cardio_type_name_ph')}">
      </div>

      <div class="form-group">
        <label class="form-label">${t('icon')}</label>
        <div class="cardio-icon-chips" id="cardio-type-icons" role="radiogroup" aria-label="${escapeHtml(t('icon'))}">${iconChipsHtml()}</div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-cardio-type-cancel>${t('cancel')}</button>
        <button type="button" class="btn btn-primary" id="cardio-type-save">${t('save')}</button>
      </div>
    </div>
  `;
  $('#modal-root').appendChild(overlay);
  // The sixth sheet built outside openModal (contract 64): focus in, Tab kept
  // inside, Escape closes THIS sheet (not the cardio sheet under it), and focus
  // goes back to the «new type» tile — by id if the selector repainted.
  const release = holdSheetFocus(overlay, { onEscape: () => close() });

  function close() { release(); overlay.remove(); }

  overlay.querySelectorAll('[data-cardio-type-cancel]').forEach((b) => b.addEventListener('click', close));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#cardio-type-icons').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cardio-icon]');
    if (!chip) return;
    pickedIcon = chip.dataset.cardioIcon;
    overlay.querySelectorAll('[data-cardio-icon]').forEach((b) =>
      setChosen(b, b.dataset.cardioIcon === pickedIcon)
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

// The stage bar as the bottom EDGE of a ledger row — no radius, no wrap, 4px
// (v394). Renders nothing when the entry has no stage data (a manual entry, or
// a source app that doesn't record stages); the caller then draws the empty
// track, so every row keeps one shape and an empty edge honestly says «no stage
// data» rather than painting a fill that means nothing. (The v389 compact bar
// and the legend card went with the v410 hero, which reads deep and efficiency
// as its own rows.)
function sleepStagesHtml(entry) {
  const s = entry && entry.stages;
  if (!s) return '';
  const deep = s.deep || 0, light = s.light || 0, rem = s.rem || 0, awake = s.awake || 0;
  const total = deep + light + rem + awake;
  if (total <= 0) return '';
  const seg = (v, cls) => (v > 0 ? `<span class="sl-seg ${cls}" style="width:${(v / total * 100)}%"></span>` : '');
  return `<div class="sl-bar sl-edge">${seg(deep, 'deep')}${seg(rem, 'rem')}${seg(light, 'light')}${seg(awake, 'awake')}</div>`;
}

function renderSleep(el) {
  const list = DB.sleep.list();
  const sleepDays = viewContext.sleepDays || 7;
  // One night per date: the row written LAST (newestRecord's rule — createdAt,
  // then store order). list[0] was the date's FIRST row, so a night corrected
  // by adding a second row kept the ring, the verdict and the average on the
  // older one.
  const byNight = {};
  list.forEach((s) => { const cur = byNight[s.date]; if (!cur || String(s.createdAt || '') >= String(cur.createdAt || '')) byNight[s.date] = s; });
  const latest = list.length ? byNight[list[0].date] : null;

  // THE RING (v410 — the owner, mid-build: «أريد نفس التغيير الذي حصل بصفحة
  // الأكل يحصل هنا من ناحية التصميم»). The food log's miniature, for last
  // night: ONE card, a 144px ring drawn with the calorie ring's own classes
  // (r=54, C=339.29) and filled by last night against the sleep goal, the
  // duration in its centre with the verdict under it as ONE line (the gap in
  // the same line: «دون الهدف بـ0:30»). Beside it, compact rows in the
  // .macro-track idiom: the bed → wake range (one ltr run), the 7-night
  // average with its delta, and — when the watch sent stages — deep and
  // efficiency as two short bars. No 7-night track: the ledger under the card
  // already lists the nights, and the owner reads extra boxes as crowding.
  // Less sleep is information and more is not a fault: nothing here is ever
  // --danger, the ring carries no .over and its fill stops at the goal.
  const goal = DB.prefs.sleepGoal();
  const C = 339.29;
  const latestMin = latest ? Math.max(0, Math.round(Number(latest.durationMinutes) || 0)) : 0;
  const dash = C * Math.min(1, latestMin / goal);
  const gap = latestMin - goal;
  const verdict = !latest ? '' : gap === 0 ? t('sleep_on_goal')
    : (gap < 0 ? t('sleep_short_by') : t('sleep_over_by')).replace('{v}', formatDuration(Math.abs(gap)));
  // The average: the recorded nights among the seven calendar nights BEFORE
  // the ring's night (one per date, byNight). Last night is left out, so «0:30
  // over your average» compares it with the nights it is measured against, not
  // with an average that already holds it. An average needs two nights: one
  // would only repeat a ledger row, and with none the row is not drawn.
  const prior = [];
  if (latest) {
    for (let i = 1; i <= 7; i++) {
      const n = byNight[addDaysISO(latest.date, -i)];
      const m = n ? Math.max(0, Math.round(Number(n.durationMinutes) || 0)) : 0;
      if (m > 0) prior.push(m);
    }
  }
  const avgMin = prior.length >= 2 ? Math.round(prior.reduce((a, b) => a + b, 0) / prior.length) : 0;
  const vsAvg = avgMin && latestMin !== avgMin
    ? t(latestMin > avgMin ? 'avg_up' : 'avg_down').replace('{v}', formatDuration(Math.abs(latestMin - avgMin)))
    : '';
  const st = latest && latest.stages ? latest.stages : null;
  const q = st ? sleepQuality(st) : null;
  const asleep = st ? (Number(st.deep) || 0) + (Number(st.light) || 0) + (Number(st.rem) || 0) : 0;
  const deepMin = st ? Math.max(0, Number(st.deep) || 0) : 0;
  const deepPct = asleep > 0 ? Math.round(deepMin / asleep * 1000) / 10 : 0;

  // One row per night, under its day header (the header carries the date).
  //
  // THE NUMBER FIRST (v394, the owner's pick of three on a design canvas). The
  // v389 row put five things in one line — a range that wrapped, a caption, a
  // bar, the figure, two buttons — and measured 128px. This is 76: the
  // duration is the row's identity at title size in the first column, the
  // range sits beside it on ONE line (still one ltr run — v374/v389: a range
  // has an order, and each time is a word that must not break), «من الساعة»
  // under it only when the night came from the watch, the tile shrinks to the
  // end of the row, and the stage bar is the card's own bottom EDGE.
  //
  // The row holds NO controls: it IS the control. The whole row opens the
  // night's sheet, and delete lives inside that sheet — the meal card's
  // precedent (v314), the recipe view's (v391). A per-row pencil and bin were
  // what made two rows of the same kind not line up, and 44px halos on 32px
  // controls were half of the row's height.
  const sleepEdgeHtml = (s) => sleepStagesHtml(s) || '<div class="sl-bar sl-edge"></div>';
  // THE NAME SAYS WHAT THE NUMERALS ARE. The row's text is three unlabelled
  // figures — «7:30 11:10 PM 7:05 AM» — and a screen reader cannot tell the
  // duration from a third clock time, nor which time is which; two nights with
  // the same times on different dates would read identically. The label
  // carries every visible string (label-in-name, v324) plus the words the eye
  // gets from position: the date, «مدة النوم», «وقت النوم», «وقت الاستيقاظ».
  const sleepRowLabel = (s) => `${formatDate(s.date)} — ${t('total_sleep')} ${formatDuration(s.durationMinutes)} — ${t('sleep_time')} ${formatTime12(s.sleepTime)} — ${t('wake_time')} ${formatTime12(s.wakeTime)}${s.source === 'health' ? ` — ${t('from_watch')}` : ''}`;
  const renderSleepEntry = (s) => `
    <button type="button" class="data-row fig-row" data-edit-sleep="${escapeHtml(s.id)}" aria-label="${escapeHtml(sleepRowLabel(s))}">
      <div class="fig-row-main">
        ${figRowFig(formatDuration(s.durationMinutes))}
        <div class="fig-row-text">
          <div class="num time-range fig-row-range" dir="ltr"><span class="time-word">${formatTime12(s.sleepTime)}</span> <span aria-hidden="true">→</span> <span class="time-word">${formatTime12(s.wakeTime)}</span></div>
          ${s.source === 'health' ? `<div class="fig-row-sub">${escapeHtml(t('from_watch'))}</div>` : ''}
        </div>
        <div class="data-icon sleep fig-row-tile">${icon('bed', 18)}</div>
      </div>
      ${sleepEdgeHtml(s)}
    </button>
  `;
  const sleepLedger = dayLedgerHtml({ entries: list, days: sleepDays, renderEntry: renderSleepEntry, emptyText: t('ledger_no_sleep'), addAttr: 'data-ledger-sleep' });

  // The rows beside the ring. The bed → wake range and «من الساعة» are NOT
  // here: the ledger's first row, right under the card, reads that very night
  // with both (no redundant text). With no row to show — no night, or one
  // manual night with nothing to average — the log button takes the column.
  const rowsHtml = !latest ? '' : `${avgMin ? `
          <div class="macro-track">
            <div class="macro-track-head"><span class="macro-track-name">${t('avg_7n')}</span><span class="macro-track-nums num">${formatDuration(avgMin)}</span></div>
            ${vsAvg ? `<div class="macro-track-left">${vsAvg}</div>` : ''}
          </div>` : ''}${asleep > 0 ? `
          <div class="macro-track">
            <div class="macro-track-head"><span class="macro-track-name">${t('sleep_deep')}</span><span class="macro-track-nums num">${formatDuration(deepMin)}</span></div>
            <div class="macro-track-bar"><span class="macro-track-fill" style="width:${deepPct}%"></span></div>
          </div>` : ''}${q ? `
          <div class="macro-track">
            <div class="macro-track-head"><span class="macro-track-name">${t('sleep_efficiency')}</span><span class="macro-track-nums num">${q.efficiency}%</span></div>
            <div class="macro-track-bar"><span class="macro-track-fill" style="width:${q.efficiency}%"></span></div>
          </div>` : ''}`;
  const logBtn = `<button class="btn btn-primary" id="add-sleep-btn">${icon('plus', 20)} ${t('log')}</button>`;

  el.innerHTML = `
    ${vaultBar()}

    <div class="page-header">
      <h1 class="page-title">${t('sleep')}</h1>
    </div>

    <!-- ONE card (v410): the caption row (the one word of context, the
         night's quality word beside it, and the goal control — the night's
         date is NOT repeated, the first ledger row under it already says
         «اليوم» and the date), then the ring beside its rows. With no night at
         all the ring is empty, the verdict is absent and the log button takes
         the rows' place — no sentence repeating what the page already says. -->
    <div class="card slp-mini">
      <div class="trk-cap">
        <span class="trk-cap-lab">${t('last_night')}${q ? `<span class="slp-q"> · ${t('sleep_q_' + q.key)}</span>` : ''}</span>
        <button type="button" class="trk-goal-btn" id="sleep-goal-btn" aria-label="${escapeHtml(t('sleep_goal') + ' ' + formatDuration(goal))}">${t('sleep_goal')} <span class="num">${formatDuration(goal)}</span></button>
      </div>
      <div class="slp-body">
        <div class="slp-ring">
          <svg class="cal-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="cal-ring-bg" cx="60" cy="60" r="54"/>
            <circle class="cal-ring-fg${dash > 0 ? '' : ' is-empty'}" cx="60" cy="60" r="54"
              stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
          </svg>
          <div class="cal-ring-center">
            <div class="cal-ring-num num${latest ? '' : ' is-none'}">${latest ? formatDuration(latestMin) : '—'}</div>
            ${latest ? `<div class="cal-ring-label slp-verdict${gap === 0 ? ' is-met' : ''}">${escapeHtml(verdict)}</div>` : ''}
          </div>
        </div>
        <div class="slp-rows">${rowsHtml || logBtn}</div>
      </div>
    </div>

    <!-- With no night at all the empty ring and «سجّل» say it once: no
         «السجل» header over nothing, no sentence, no door to older days. -->
    ${list.length ? `
    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('history')}</div>
      ${rowsHtml ? logBtn : ''}
    </div>

    ${sleepLedger.empty
      ? emptyState({ title: t('ledger_empty_sleep') })
      : `<div class="ledger">${sleepLedger.html}</div>`}
    ${sleepLedger.more ? `<button type="button" class="btn btn-ghost btn-block" id="more-sleep-days">${t('ledger_older')}</button>` : ''}` : ''}
  `;

  $('#add-sleep-btn', el).addEventListener('click', () => openSleepModal());
  $('#sleep-goal-btn', el).addEventListener('click', () => openGoalModal('sleep'));
  $('#more-sleep-days', el)?.addEventListener('click', () => { viewContext.sleepDays = sleepDays + 7; renderSleep(el); });
  el.querySelectorAll('[data-ledger-sleep]').forEach((b) => b.addEventListener('click', () => openSleepModal(null, b.dataset.ledgerSleep)));
  el.querySelectorAll('[data-edit-sleep]').forEach((b) =>
    b.addEventListener('click', () => openSleepModal(b.dataset.editSleep))
  );
}

function openSleepModal(sleepId = null, presetDate = null) {
  const existing = sleepId ? DB.sleep.list().find((s) => s.id === sleepId) : null;
  // Fewer taps (v410): a new night opens on LAST night's times, not a fixed
  // 23:00 → 07:00 — a regular sleeper logs a night as date → save.
  const all = DB.sleep.list();
  const latest = existing || newestRecord(all);
  // …and on the newest DATE with no night yet. It used to open on today even
  // when today was logged, preset to that very night's times, so one tap on
  // Save wrote the same night twice (DB.sleep.add keeps every row). A ledger
  // day's own + passes its empty date.
  let newDate = presetDate;
  if (!existing && !newDate) {
    const have = new Set(all.map((s) => s.date));
    let i = 0;
    while (i < 366 && have.has(ledgerDayIso(i))) i++;
    newDate = ledgerDayIso(i);
  }
  const defStart = latest && latest.sleepTime ? latest.sleepTime : '23:00';
  const defEnd = latest && latest.wakeTime ? latest.wakeTime : '07:00';
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
      <input type="date" id="sleep-date" max="${todayISO()}" value="${escapeHtml(existing ? existing.date : newDate)}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('sleep_time')}</label>
        <input type="time" id="sleep-start" value="${escapeHtml(defStart)}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('wake_time')}</label>
        <input type="time" id="sleep-end" value="${escapeHtml(defEnd)}">
      </div>
    </div>

    <div id="sleep-duration-preview" class="prev-session" style="margin-bottom:0">
      <div class="prev-session-head"><span>${t('total_sleep')}</span></div>
      <div class="prev-session-sets sleep-total-fig num"></div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      ${existing ? `<button type="button" class="btn btn-danger" id="delete-sleep-btn">${t('delete')}</button>` : ''}
      <button type="button" class="btn btn-primary" id="save-sleep-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  // Delete lives here since v394 (the row carries no controls). confirmDialog
  // REPLACES #modal-root, so this sheet is gone either way — the meal editor's
  // precedent — and the ledger is repainted through the router, not a captured
  // element.
  $('#delete-sleep-btn')?.addEventListener('click', () => {
    if (!existing) return;
    confirmDialog({
      title: t('delete_sleep_q'),
      text: t('delete_sleep_text'),
      onConfirm: () => {
        DB.sleep.remove(existing.id);
        showToast(t('deleted'));
        renderView(currentView);
        // closeModal() handed focus back to the row this sheet was opened from,
        // and the repaint just detached it — land on the ledger's one stable
        // control instead of <body>.
        const home = document.getElementById('add-sleep-btn');
        if (home) home.focus({ preventScroll: true });
      },
    });
  });

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
