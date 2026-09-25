// Invoked by test-sync-status-ui.js against its isolated, offline-only server.
'use strict';
const assert = require('node:assert/strict');
module.exports = async function testConvenienceUI(page) {
  await page.evaluate(() => {
    DB.nutrition.setTargets({calories:2000,protein:120,carbs:220,fat:60});
    DB.foods.add({name:'QA oats',calories:100,protein:5,carbs:15,fat:2});
    DB.recipes.add({name:'QA rice',servings:4,items:[{name:'Rice',qty:'200 g',calories:300,protein:5,carbs:60,fat:1}]});
  });
  for (const [lang,theme] of [['ar','dark'],['en','light']]) {
    await page.evaluate(({lang,theme}) => {closeModal();DB.prefs.setLang(lang);DB.prefs.setTheme(theme);applyLang(lang);applyTheme(theme);navigate('food');}, {lang,theme});
    // v316 removed the «وجباتي» header link: the food FAB's add-sheet is the one
    // door to this picker now. Drive that route, not the deleted one.
    await page.locator('#food-fab').click();
    await page.locator('[data-method="saved"]').click();
    await page.locator('.sfp-tab[data-tab="bundles"]').click();
    await page.locator('#sf-new').click();
    await page.locator('#cx-meal-name').fill('QA breakfast '+lang);
    await page.locator('#cx-food').selectOption('0');
    await page.locator('#cx-food-add').click();
    await page.locator('#cx-favorite').check();
    await page.locator('#cx-meal-save').click();
    const card = page.locator('.bundle-card').filter({hasText:'QA breakfast '+lang});
    if (process.env.QA_SCREENSHOT_DIR) await page.locator('.modal').screenshot({path:require('node:path').join(process.env.QA_SCREENSHOT_DIR,`meals-${lang}.png`)});
    await card.locator('[data-portion-bundle]').click();
    await page.locator('#cx-log-date').fill('2026-09-09');
    await page.locator('#cx-log-portion').fill('0.5');
    await page.locator('#cx-log-meal').click();
    assert.equal(await page.evaluate(()=>DB.foodLogs.totalsForDate('2026-09-09').calories),50);
    await page.locator('.toast-action').click();
    assert.equal(await page.evaluate(()=>DB.foodLogs.listForDate('2026-09-09').length),0);
    // ---- THE SHOPPING LIST, as v329 rebuilt it and v332 reshaped it ---------
    // This block used to drive FIVE sheets that no longer exist (#cx-shopping-new,
    // the purchase ledger, the preview, the list name). It kept 'passing' in
    // review and failing in reality because nothing ever ran it - see test-all.js.
    await page.evaluate(() => DB.shopping.clearAll());
    await page.locator('[data-shopping]').click();
    // Two named boxes over the list. WHICH one is open is DERIVED from the list
    // being empty, so open the recipes box explicitly rather than assuming.
    const recipesBox = page.locator('.sl-grp').filter({has: page.locator('#sl-grp-recipe')}).locator('.sl-grp-head');
    if (await recipesBox.getAttribute('aria-expanded') !== 'true') await recipesBox.click();
    await page.locator('#sl-grp-recipe .sl-chip').filter({hasText:'QA rice'}).click();
    // The recipe's ingredient NAMES arrive, carrying the recipe's own wording as a
    // caption. Nothing is parsed, scaled or summed.
    const poured = await page.evaluate(() => DB.shopping.get().items);
    assert.equal(poured.length, 1, lang+' one ingredient poured');
    assert.equal(poured[0].name, 'Rice');
    assert.deepEqual(poured[0].amounts, ['200 g'], lang+' the recipe own words, verbatim');
    // Ticking never moves the row and never enters undo history.
    const undoBefore = await page.evaluate(() => DB.undo.list().length);
    await page.locator('.sl-row [data-tick]').first().check();
    assert.equal(await page.evaluate(() => DB.shopping.get().items[0].checked), true, lang+' ticked');
    assert.equal(await page.evaluate(() => DB.undo.list().length), undoBefore, lang+' a tick is not undoable');
    // The composer adds a typed item; the footer appears only with items on it.
    await page.locator('#sl-new').fill('QA salt '+lang);
    await page.locator('#sl-add').click();
    const names = await page.evaluate(() => DB.shopping.get().items.map(i=>i.name));
    assert.ok(names.includes('QA salt '+lang), lang+' typed item added');
    assert.ok(await page.locator('.sl-foot').isVisible(), lang+' the footer shows with items');
    const size = await page.locator('.modal').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
    assert.ok(size.scroll<=size.width+1,lang+' shopping overflow');
    if (process.env.QA_SCREENSHOT_DIR) await page.locator('.modal').screenshot({path:require('node:path').join(process.env.QA_SCREENSHOT_DIR,`shopping-${lang}.png`)});
    await page.locator('.modal [data-close]').click();
    await page.locator('.view.active [data-unified-search]').click();
    await page.locator('#cx-query').fill('QA breakfast '+lang);
    await page.waitForSelector('[data-result]');
    assert.ok((await page.locator('#cx-results').innerText()).includes('QA breakfast '+lang));
    await page.locator('[data-result]').first().click();
    assert.equal(await page.locator('#cx-meal-name').inputValue(),'QA breakfast '+lang);
    await page.locator('.modal [data-close]').click();
    await page.evaluate(()=>navigate('settings'));
    await page.locator('[data-recent-changes]').click();
    assert.ok(await page.locator('[data-undo]').count()>0);
    await page.locator('.modal [data-close]').click();
    // Recipe tab regression: all controls must render with their own IDs.
    await page.evaluate(()=>openSavedFoodPicker(null,null,'recipes'));
    assert.ok(await page.locator('[data-edit-rec]').count()>0);
    await page.locator('.modal [data-close]').click();
    // Real guided-run DOM: undo must rebuild the draft from restored storage.
    await page.evaluate(() => {
      const ex = DB.exercises.list()[0];
      DB.sessions.listByExercise(ex.id).filter(s=>s.date===todayISO()).forEach(s=>DB.sessions.remove(s.id));
      window.qaSession = DB.sessions.add({exerciseId:ex.id,date:todayISO(),sets:[{weight:50,reps:10},{weight:60,reps:8}]});
      DB.undo.clear();
      navigate('session-run',{date:todayISO(),runOnly:[ex.id],runDate:todayISO(),runIdx:0,runState:{},runView:'exercise'});
    });
    await page.locator('.view.active [data-del-set]').first().click();
    assert.equal(await page.evaluate(()=>DB.sessions.get(qaSession.id).sets.length),1);
    await page.locator('.toast-action').click();
    assert.equal(await page.evaluate(()=>DB.sessions.get(qaSession.id).sets.length),2);
    assert.equal(await page.locator('.view.active [data-del-set]').count(),2);
    await page.evaluate(()=>navigate('food'));
    // Date search routes to the selected date rather than silently using today.
    await page.locator('.view.active [data-unified-search]').click();
    await page.locator('#cx-query').fill('2026-09-09');
    await page.locator('[data-result]').first().click();
    await page.locator('#cx-day-food').click();
    assert.equal(await page.evaluate(()=>viewContext.foodLog.date),'2026-09-09');
    await page.evaluate(()=>{
      Cloud.listPlanHistory=async()=>({ok:true,rows:[{id:1,version:1,replaced_at:'2026-09-09'}]});
      Cloud.readPlanHistory=async()=>({ok:true,owner:'qa',version:1,plan:{cycle:[{name:'QA historical',exerciseIds:[DB.exercises.list()[0].id]}],trainingDays:[1,3]},exercises:DB.exercises.list()});
      Cloud.checkPlanRestoreVersion=async()=>true; Cloud.snapshotLocal=()=>true;
      window.qaBeforeLogs=JSON.stringify(DB.foodLogs.listForDate('2026-09-09'));
      navigate('settings');
    });
    await page.locator('[data-plan-history]').click();
    await page.locator('[data-history]').click();
    await page.locator('#cx-restore-plan').click();
    assert.equal(await page.evaluate(()=>DB.plan.get().cycle[0].name),'QA historical');
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.foodLogs.listForDate('2026-09-09'))===qaBeforeLogs),true);
    await page.locator('.toast-action').click();
  }
  await workoutCore(page);
  console.log('PASS convenience UI: bilingual meals, half portion, dated log + undo, recipe quantities, shopping save/check, search/date navigation, recent changes, guided-run undo, plan-only restoration, recipe regression, and the workout core (v397): undo names its write, the PR is seen, the suggestion is a target, records judged against history, the trash works unlogged, a half-typed row, the day as logged, the swap survives, the reorder write, the rest-day add, undoable remove, the template asks, sets edited not rebuilt');
};

// ---- v397 · THE WORKOUT CORE, driven with real clicks -----------------------
// Every case below FAILED on v396 before its fix; each assertion says what it
// proves. The clicks are Playwright's (hit-tested, actionable), so a control
// that is covered or dead fails here the way it fails a thumb.
async function workoutCore(page) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => {
    closeModal(); hideToast();
    document.getElementById('reorder-sheet-overlay')?.remove();
    // The first logged workout asks for notifications 700ms later; that sheet
    // is not what these cases drive, and it would cover what they do.
    DB.notif.setAsked();
    DB.prefs.setUnit('kg');
  });
  const ids = await ev(() => DB.exercises.list().map((e) => e.id));
  const today = await ev(() => todayISO());
  const clearEx = (id) => ev((id) => DB.sessions.listByExercise(id).forEach((s) => DB.sessions.remove(s.id)), id);
  const toastNow = () => ev(() => {
    const el = document.querySelector('.toast.show');
    return el ? { msg: (el.querySelector('.toast-msg') || el).textContent.trim(), undo: !!el.querySelector('.toast-action') } : null;
  });
  const setsOf = (id, date) => ev(({ id, date }) => (DB.sessions.listByExercise(id).find((s) => s.date === date) || { sets: [] }).sets.map((s) => [s.reps, s.weight]), { id, date });
  const row = (i) => `.view.active .run-set-row[data-set="${i}"]`;

  // Undo that reverses the wrong thing: deleting an EMPTY row wrote nothing,
  // so the Undo on its toast was bound to the entry before it — the set just
  // logged. Taking it deleted that set.
  {
    const id = ids[1]; await clearEx(id);
    await ev(({ id, today }) => {
      DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -3), sets: [{ reps: 10, weight: 40 }, { reps: 10, weight: 40 }, { reps: 10, weight: 40 }] });
      window.qaLogged = DB.sessions.add({ exerciseId: id, date: today, sets: [{ reps: 10, weight: 60 }] });
      window.qaHead = DB.undo.list()[0].token;
      hideToast();
      navigate('session-run', { date: today, runOnly: [id] });
    }, { id, today });
    assert.equal(await page.locator('.view.active .run-set-row').count(), 3, 'setup: the logged set and two planned rows');
    await page.locator(row(2) + ' [data-del-set]').click();
    assert.equal(await page.locator('.view.active .run-set-row').count(), 2, 'the empty row is gone');
    assert.equal((await toastNow() || {}).undo || false, false, 'deleting an EMPTY row offers no Undo: the newest entry is the set logged before it, and taking it deleted that set');
    assert.deepEqual(await ev(() => [DB.undo.list()[0].token === window.qaHead, DB.sessions.get(window.qaLogged.id).sets.length]), [true, 1], 'and nothing was written');
  }

  // The trash on an exercise with nothing logged yet did nothing: no session,
  // no rows with numbers, so the write "failed" and the splice was put back.
  {
    const id = ids[1];
    await ev(({ id, today }) => { DB.sessions.listByExercise(id).filter((s) => s.date === today).forEach((s) => DB.sessions.remove(s.id)); hideToast(); navigate('session-run', { date: today, runOnly: [id] }); }, { id, today });
    assert.equal(await page.locator('.view.active .run-set-row').count(), 3, 'setup: three rows planned from last time, nothing logged');
    await page.locator(row(2) + ' [data-del-set]').click();
    assert.equal(await page.locator('.view.active .run-set-row').count(), 2, 'a planned row can be trimmed before anything is logged');
    assert.deepEqual(await setsOf(id, today), [], 'and trimming it wrote nothing');
    assert.equal((await toastNow() || {}).undo || false, false, 'so there is nothing to undo');
  }

  // The suggestion is a TARGET. Its tap used to commit it as a performed set —
  // phantom history, the streak, and a PR for a lift never done.
  {
    const id = ids[1];   // history: three sets of 10 × 40, so today's suggestion is 40 × 11
    await ev(({ id, today }) => { hideToast(); navigate('session-run', { date: today, runOnly: [id] }); }, { id, today });
    await page.locator('.view.active .run-suggest').click();
    assert.deepEqual(await setsOf(id, today), [], 'tapping the suggestion writes no set');
    assert.deepEqual(await ev(() => [...document.querySelectorAll('.view.active .run-set-row[data-set="0"] input')].map((i) => [i.value, i.placeholder])),
      [['', '11'], ['', '40']], 'it fills the row the way a ghost does');
    await ev(() => hideToast());
    await page.locator(row(0) + ' [data-done]').click();
    assert.deepEqual(await setsOf(id, today), [[11, 40]], 'the ✓ is what logs it');
    const tt = await toastNow();
    assert.equal(tt && tt.msg, await ev(() => t('run_sug_saved')), 'and its toast says the numbers were the suggestion, with Undo');
    assert.equal(tt.undo, true);
    await ev(() => { clearRestTimer(); hideToast(); });   // the ✓ started a rest
  }

  // Records are judged against HISTORY — not against this session's own
  // earlier sets, and not against a figure since corrected.
  {
    const id = ids[2]; await clearEx(id);
    await ev(({ id, today }) => { hideToast(); navigate('session-run', { date: today, runOnly: [id] }); }, { id, today });
    await page.locator(row(0) + ' [data-field="reps"]').fill('10');
    await page.locator(row(0) + ' [data-field="weight"]').fill('60');
    await page.locator(row(0) + ' [data-done]').click();
    await page.locator('.view.active [data-addset]').click();
    await page.locator(row(1) + ' [data-field="reps"]').fill('10');
    await page.locator(row(1) + ' [data-field="weight"]').fill('62.5');
    await page.locator(row(1) + ' [data-done]').click();
    await page.locator('.view.active [data-next]').click();   // the only exercise: Finish
    assert.equal(await page.locator('.view.active .run-summary').count(), 1, 'setup: the summary');
    assert.equal(await page.locator('.view.active .run-sum-pr').count(), 0, 'a FIRST-EVER session has no record to beat, however its sets climb');
  }
  {
    const id = ids[3]; await clearEx(id);
    await ev(({ id, today }) => { DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -2), sets: [{ reps: 5, weight: 100 }] }); hideToast(); navigate('session-run', { date: today, runOnly: [id] }); }, { id, today });
    const reps = page.locator(row(0) + ' [data-field="reps"]'), weight = page.locator(row(0) + ' [data-field="weight"]');
    // Each field-leave commits on the next tick; wait for the DATABASE, or the
    // typo can be overwritten before it is ever written and nothing is tested.
    const stored = (w) => page.waitForFunction(({ id, today, w }) => ((DB.sessions.listByExercise(id).find((s) => s.date === today) || { sets: [] }).sets[0] || {}).weight === w, { id, today, w });
    await reps.fill('5');
    await weight.fill('1000');
    await reps.click();          // leaving the field commits it: 1000 is a record
    await stored(1000);
    await weight.fill('100');
    await reps.click();          // and so does the correction
    await stored(100);
    assert.deepEqual(await setsOf(id, today), [[5, 100]], 'setup: the corrected figure is what is stored');
    await page.locator('.view.active [data-next]').click();
    assert.equal(await page.locator('.view.active .run-sum-pr').count(), 0, 'a record that was a typo, since corrected, is not in the summary');
  }

  // The PR message was painted over by «Session saved · Undo» in the same
  // tick, on both direct logging paths. One toast carries both now.
  {
    const id = ids[4]; await clearEx(id);
    await ev(({ id, today }) => { DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -4), sets: [{ reps: 10, weight: 50 }] }); hideToast(); navigate('exercise-detail', { exerciseId: id }); }, { id, today });
    await page.locator('.view.active #add-session-btn').click();
    await page.locator('#sets-editor .set-edit-row[data-set-index="0"] [data-field="weight"]').fill('60');
    await page.locator('#save-session-btn').click();
    const tt = await toastNow();
    assert.ok(tt && tt.msg.startsWith(await ev(() => t('pr_weight'))), 'the exercise page announces the PR: ' + JSON.stringify(tt));
    assert.equal(tt.undo, true, 'on the toast that carries the Undo');
  }
  {
    const id = ids[5]; await clearEx(id);
    await ev(({ id, today }) => { DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -4), sets: [{ reps: 10, weight: 50 }] }); hideToast(); navigate('session-day', { date: today, sdOnly: [id] }); }, { id, today });
    const card = `.view.active [data-ex-card="${id}"]`;
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="reps"]`).fill('10');
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="weight"]`).fill('60');
    await page.locator(`${card} [data-save-ex]`).click();
    const tt = await toastNow();
    assert.ok(tt && tt.msg.startsWith(await ev(() => t('pr_weight'))), 'session-day announces the PR it used to vibrate for in silence: ' + JSON.stringify(tt));
    assert.equal(tt.undo, true);
  }
  {
    // A first-ever card, saved and then saved again heavier, is still a first session.
    const id = ids[6]; await clearEx(id);
    await ev(({ id, today }) => { hideToast(); navigate('session-day', { date: today, sdOnly: [id] }); }, { id, today });
    const card = `.view.active [data-ex-card="${id}"]`;
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="reps"]`).fill('10');
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="weight"]`).fill('60');
    await page.locator(`${card} [data-save-ex]`).click();
    await ev(() => hideToast());
    // EVERY toast raised is recorded, not only the one left standing: a PR
    // raised and painted over in the same tick is still a PR claimed.
    await ev(() => {
      window.qaToasts = []; window.qaShowToast = showToast;
      window.showToast = function (m, o) { window.qaToasts.push(String(m)); return window.qaShowToast.call(this, m, o); };
    });
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="weight"]`).fill('62.5');
    await page.locator(`${card} [data-save-ex]`).click();
    const raised = await ev(() => { window.showToast = window.qaShowToast; return window.qaToasts; });
    const pr = await ev(() => t('pr_weight'));
    assert.deepEqual(raised.filter((m) => m.startsWith(pr)), [], 're-saving a first-ever card heavier is not a record: ' + JSON.stringify(raised));
    assert.equal((await toastNow() || {}).msg, await ev(() => t('session_updated')));
  }

  // A row given only its reps was stored with weight 0 while the field still
  // showed last time's weight, and the logged card kept the unsaved ghosts.
  {
    const id = ids[7]; await clearEx(id);
    await ev(({ id, today }) => { DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -4), sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 42.5 }] }); hideToast(); navigate('session-day', { date: today, sdOnly: [id] }); }, { id, today });
    const card = `.view.active [data-ex-card="${id}"]`;
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="reps"]`).fill('9');
    await page.locator(`${card} [data-save-ex]`).click();
    assert.deepEqual(await setsOf(id, today), [[9, 40]], 'a half-typed row takes the other figure from the ghost beside it');
    assert.equal(await page.locator(`${card} .sd-set-row`).count(), 1, 'and the logged card shows what was saved, not the ghost rows under it');
  }

  // A calendar day opened a session-day built from the CURRENT rotation only:
  // a session logged before the plan's anchor was on no card at all.
  {
    const id = ids[8]; await clearEx(id);
    const past = await ev(({ id, today }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA', exerciseIds: [] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today });
      const d = addDaysISO(today, -3);
      DB.sessions.add({ exerciseId: id, date: d, sets: [{ reps: 6, weight: 70 }] });
      hideToast(); navigate('calendar');
      return d;
    }, { id, today });
    if (past.slice(0, 7) !== today.slice(0, 7)) await page.locator('.view.active #cal-prev').click();
    await page.locator(`.view.active [data-day-iso="${past}"]`).click();
    assert.equal(await page.locator(`.view.active [data-ex-card="${id}"].logged`).count(), 1, 'a day before the plan began shows the training logged on it');
  }

  // A swap lived in viewContext: leave the run and the substitute, with its
  // logged set, was on neither screen, and the exercise it replaced was back.
  {
    const A = ids[10], B = ids[11], X = ids[12];
    for (const id of [A, B, X]) await clearEx(id);
    await ev(({ A, B, today }) => { DB.plan.setRotation({ cycle: [{ name: 'QA swap', exerciseIds: [A, B] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today }); hideToast(); navigate('session-day', { date: today }); }, { A, B, today });
    await page.locator('.view.active #sd-start-run').click();
    await page.locator('.view.active [data-ex-menu]').click();
    await page.locator('#modal-root [data-swap]').click();
    await page.locator(`#swap-list [data-pick="${X}"]`).click();
    await ev(() => hideToast());
    await page.locator(row(0) + ' [data-field="reps"]').fill('8');
    await page.locator(row(0) + ' [data-field="weight"]').fill('30');
    await page.locator(row(0) + ' [data-done]').click();
    await ev(({ today }) => { hideToast(); navigate('home'); navigate('session-day', { date: today }); }, { today });
    assert.equal(await page.locator(`.view.active [data-ex-card="${X}"].logged`).count(), 1, 'after the run is left, the substitute and its set are on the day');
    assert.equal(await page.locator(`.view.active [data-ex-card="${A}"]`).count(), 0, 'and the exercise it replaced today is not back');
    await page.locator('.view.active #sd-start-run').click();
    assert.equal(await ev(() => document.querySelector('.view.active .run-ex-name').textContent), await ev((X) => exDisplayName(DB.exercises.getById(X)), X), 'the run reopens on the substitute, where it was');
    assert.equal(await page.locator('.view.active .run-set-row.done').count(), 1, 'with its set');
    // The ✓ above started a rest; leaving the run floats it over every view.
    await ev(() => { clearRestTimer(); hideToast(); navigate('home'); });
  }

  // The reorder sheet wrote the list it OPENED with on any close: a no-move
  // close still saved and synced, and an exercise removed meanwhile came back.
  {
    const A = ids[10], B = ids[11], C = ids[13];
    await ev(({ A, B, C, today }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA order', exerciseIds: [A, B, C] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today });
      window.qaSlotWrites = 0;
      window.qaSetSlot = DB.plan.setSlotExercises;
      DB.plan.setSlotExercises = function (...a) { window.qaSlotWrites++; return window.qaSetSlot.apply(this, a); };
      hideToast(); navigate('session-day', { date: today });
    }, { A, B, C, today });
    await page.locator('.view.active #sd-reorder-open').click();
    await page.locator('#reorder-sheet-overlay [data-ro-done]').click();
    assert.equal(await ev(() => window.qaSlotWrites), 0, 'opening the reorder sheet and closing it without a move writes nothing');
  }
  {
    const A = ids[10], B = ids[11], C = ids[13];
    await ev(({ A, B, C, today }) => {
      DB.plan.setSlotExercises = window.qaSetSlot;
      DB.plan.setRotation({ cycle: [{ name: 'QA order', exerciseIds: [A, B, C] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today });
      hideToast(); navigate('session-day', { date: today });
    }, { A, B, C, today });
    await page.locator('.view.active #sd-reorder-open').click();
    await page.locator('#reorder-sheet-overlay [data-ro="0"][data-dir="1"]').click();
    await ev((C) => window.qaSetSlot.call(DB.plan, 0, DB.plan.get().cycle[0].exerciseIds.filter((x) => x !== C)), C);   // another window removed C
    await page.locator('#reorder-sheet-overlay [data-ro-done]').click();
    assert.deepEqual(await ev(() => DB.plan.get().cycle[0].exerciseIds), [B, A], 'the move is kept, and the exercise removed meanwhile is not resurrected');
    await ev(() => { DB.plan.setSlotExercises = window.qaSetSlot; });
    await page.locator('#reorder-sheet-overlay').waitFor({ state: 'detached' });   // it leaves on a 260ms exit
  }

  // «Add exercise» on a rest day opened the rotation's «Add workout» editor,
  // whose Save appended a slot and moved every day after it.
  {
    const id = ids[14];
    await ev(({ today }) => {
      const dow = new Date(today + 'T12:00:00').getDay();
      DB.plan.setRotation({ cycle: [{ name: 'QA rest', exerciseIds: [] }], trainingDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== dow), anchor: today });
      hideToast(); navigate('session-day', { date: today });
    }, { today });
    await page.locator('.view.active #sd-add-ex').click();
    await page.locator('#ch-from-lib').click();
    assert.equal(await page.locator('#modal-root #day-save-btn').count(), 0, 'a rest day\'s «Add exercise» does not open the rotation editor');
    await page.locator(`#picker-list [data-pick="${id}"]`).click();
    assert.equal(await ev(() => DB.plan.get().cycle.length), 1, 'the rotation is untouched');
    assert.equal(await page.locator(`.view.active [data-ex-card="${id}"]`).count(), 1, 'and the exercise is on the day');
  }

  // «Remove from cycle» deleted a whole workout in one tap, and a template
  // replaced a hand-built plan without a word.
  {
    await ev(({ today }) => { DB.plan.setRotation({ cycle: [{ name: 'QA one', exerciseIds: [] }, { name: 'QA two', exerciseIds: [] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today }); hideToast(); navigate('planner'); }, { today });
    await page.locator('.view.active [data-edit="1"]').click();
    await page.locator('#modal-root #day-clear-btn').click();
    assert.equal(await ev(() => DB.plan.get().cycle.length), 1, 'setup: the workout is removed');
    const tt = await toastNow();
    assert.ok(tt && tt.undo, '«Remove from cycle» offers Undo: ' + JSON.stringify(tt));
    await page.locator('.toast.show .toast-action').click();
    assert.deepEqual(await ev(() => DB.plan.get().cycle.map((s) => s.name)), ['QA one', 'QA two'], 'and the Undo puts it back');
  }
  {
    await ev(({ A, today }) => { DB.plan.setRotation({ cycle: [{ name: 'QA mine', exerciseIds: [A] }], trainingDays: [1, 3, 5], anchor: today }); closeModal(); hideToast(); navigate('planner'); }, { A: ids[1], today });
    await page.locator('.view.active #apply-template-btn').click();
    await page.locator('#modal-root [data-apply]').first().click();
    await page.locator('#modal-root #schedule-apply').click();
    assert.equal(await page.locator('#modal-root .confirm-title').count(), 1, 'a template over a plan that holds exercises asks before it replaces it');
    await page.locator('#modal-root .confirm-dialog [data-close]').click();
    assert.equal(await ev(() => DB.plan.get().cycle[0].name), 'QA mine', 'and Cancel keeps the plan');
    await page.locator('.view.active #apply-template-btn').click();
    await page.locator('#modal-root [data-apply]').first().click();
    await page.locator('#modal-root #schedule-apply').click();
    await page.locator('#modal-root .confirm-dialog [data-ok]').click();
    assert.notEqual(await ev(() => DB.plan.get().cycle[0].name), 'QA mine', 'and confirming replaces it');
    assert.equal(await ev(() => currentView), 'home', 'then lands on Home, as Apply always has');
  }

  // Every editor rebuilt a set from reps/weight/done, erasing whatever else a
  // newer build had put on it. They edit it now.
  {
    const id = ids[15]; await clearEx(id);
    const sid = await ev(({ id, today }) => {
      const s = DB.sessions.add({ exerciseId: id, date: today, sets: [{ reps: 10, weight: 50 }] });
      STATE.sessions.find((x) => x.id === s.id).sets[0].rpe = 8;   // a field this build does not know
      save();
      hideToast(); navigate('session-run', { date: today, runOnly: [id] });
      return s.id;
    }, { id, today });
    const kept = () => ev((sid) => { const x = DB.sessions.get(sid).sets[0]; return [x.reps, x.rpe]; }, sid);
    await page.locator(row(0) + ' [data-field="reps"]').fill('12');
    await page.locator(row(0) + ' [data-field="weight"]').click();   // leaving the field commits it
    await page.waitForTimeout(80);
    assert.deepEqual(await kept(), [12, 8], 'the guided run edits the set, it does not rebuild it');
    await ev(({ id, today }) => { hideToast(); navigate('session-day', { date: today, sdOnly: [id] }); }, { id, today });
    const card = `.view.active [data-ex-card="${id}"]`;
    await page.locator(`${card} .sd-set-row[data-set="0"] [data-field="reps"]`).fill('11');
    await page.locator(`${card} [data-save-ex]`).click();
    assert.deepEqual(await kept(), [11, 8], 'and so does session-day');
    await ev(({ id }) => { hideToast(); navigate('exercise-detail', { exerciseId: id }); }, { id });
    await page.locator(`.view.active [data-edit-session="${sid}"]`).click();
    await page.locator('#sets-editor .set-edit-row[data-set-index="0"] [data-field="reps"]').fill('9');
    await page.locator('#save-session-btn').click();
    assert.deepEqual(await kept(), [9, 8], 'and so does the exercise page\'s editor');
  }

  // A day that carries training logged OFF its slot: the reorder sheet orders
  // the SLOT, so it is offered only when the slot has more than one exercise,
  // and the logged-only card has no «remove from day» — it has no slot or
  // selection to be removed from.
  {
    const A = ids[16], Z = ids[17];
    for (const id of [A, Z]) await clearEx(id);
    await ev(({ A, Z, today }) => {
      DB.plan.setRotation({ cycle: [{ name: 'QA single', exerciseIds: [A] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today });
      DB.sessions.add({ exerciseId: Z, date: today, sets: [{ reps: 12, weight: 20 }] });
      hideToast(); navigate('session-day', { date: today });
    }, { A, Z, today });
    assert.equal(await page.locator(`.view.active [data-ex-card="${Z}"].logged`).count(), 1, 'setup: the logged extra is on the day');
    assert.equal(await page.locator('.view.active #sd-reorder-open').count(), 0, 'a one-exercise slot offers no reorder, whatever else was logged');
    assert.equal(await page.locator(`.view.active [data-ex-card="${Z}"] [data-remove-ex]`).count(), 0, 'a card on the day only because it was logged there has no «remove from day»');
    assert.equal(await page.locator(`.view.active [data-ex-card="${A}"] [data-remove-ex]`).count(), 1, 'the slot\'s own card keeps it');
  }

  // The exercise page's sheet can be switched to lb; its PR line was worded
  // in the preference instead — "68.04kg" over rows the user typed in lb.
  {
    const id = ids[9]; await clearEx(id);
    await ev(({ id, today }) => { DB.sessions.add({ exerciseId: id, date: addDaysISO(today, -4), sets: [{ reps: 10, weight: 50 }] }); hideToast(); navigate('exercise-detail', { exerciseId: id }); }, { id, today });
    await page.locator('.view.active #add-session-btn').click();
    await page.locator('#modal-root [data-modal-unit="lb"]').click();
    await page.locator('#sets-editor .set-edit-row[data-set-index="0"] [data-field="weight"]').fill('150');
    await page.locator('#save-session-btn').click();
    const tt = await toastNow();
    assert.ok(tt && tt.msg.startsWith(await ev(() => t('pr_weight'))) && /lb/.test(tt.msg) && !/kg/.test(tt.msg), 'the PR is worded in the unit the sheet was showing: ' + JSON.stringify(tt));
  }

  // A new workout with no name and no exercises saves nothing — and said
  // «Day saved».
  {
    await ev(({ today }) => { DB.plan.setRotation({ cycle: [{ name: 'QA kept', exerciseIds: [] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today }); hideToast(); navigate('planner'); }, { today });
    await page.locator('.view.active #add-slot-btn').click();
    await page.locator('#modal-root #day-save-btn').click();
    assert.equal(await ev(() => DB.plan.get().cycle.length), 1, 'setup: nothing was added');
    assert.notEqual((await toastNow() || {}).msg, await ev(() => t('day_saved')), 'and nothing claims it was saved');
  }
  await ev(() => { closeModal(); hideToast(); navigate('home'); });
}
