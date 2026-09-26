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
  for (const c of FOOD_BODY) await c.run(page);
  for (const c of RECIPE_IMPORT) await c.run(page);
  await routerHome(page);
  await designA11y(page);
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

// ---- review 2026-09-25 · batch 3: food and body, driven with real clicks ------
// Every case FAILED on v397 before its fix, and says in its message what v397
// did instead. Each one sets up what it needs and puts back what it replaced, so
// they run in any order — scratch runners run them one at a time to show each
// failure on its own. Open Food Facts and the Worker are faked with page.route;
// the camera and the microphone are a canvas stream and an oscillator.
const toastText = (page) => page.evaluate(() => {
  const el = document.querySelector('.toast.show');
  return el ? (el.querySelector('.toast-msg') || el).textContent.trim() : null;
});
const tr = (page, key) => page.evaluate((k) => t(k), key);
const fresh = (page) => page.evaluate(() => { closeModal(); hideToast(); document.getElementById('add-sheet-overlay')?.remove(); navigate('food'); });
// A fake camera and microphone: tracks are recorded so a case can read whether
// the app stopped them. `delay` holds the permission prompt open.
async function installMedia(page, delay) {
  await page.evaluate((delay) => {
    window.qaMedia = { tracks: [], detects: 0, codes: [], delay };
    window.qaMediaSaved = window.qaMediaSaved || { gum: navigator.mediaDevices.getUserMedia, bd: window.BarcodeDetector };
    navigator.mediaDevices.getUserMedia = (c) => new Promise((resolve) => {
      const make = () => {
        let s;
        if (c && c.audio) {
          const ac = new AudioContext(), osc = ac.createOscillator(), dst = ac.createMediaStreamDestination();
          osc.connect(dst); osc.start(); s = dst.stream;
        } else {
          const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
          cv.getContext('2d').fillRect(0, 0, 4, 4); s = cv.captureStream(10);
        }
        window.qaMedia.tracks.push(...s.getTracks());
        resolve(s);
      };
      if (window.qaMedia.delay) setTimeout(make, window.qaMedia.delay); else make();
    });
    window.BarcodeDetector = class { async detect() { window.qaMedia.detects++; return window.qaMedia.codes.map((code) => ({ rawValue: code })); } };
  }, delay || 0);
}
async function restoreMedia(page) {
  await page.evaluate(() => {
    const s = window.qaMediaSaved; if (!s) return;
    navigator.mediaDevices.getUserMedia = s.gum;
    if (s.bd) window.BarcodeDetector = s.bd; else delete window.BarcodeDetector;
    delete window.qaMediaSaved;
  });
}
async function openFrom(page, method) {
  await fresh(page);
  await page.locator('#food-fab').click();
  await page.locator(`[data-method="${method}"]`).click();
}
// Open Food Facts, faked: 1111111 and 2222222 are products (2222222 fails on the
// NETWORK the first time it is asked for), anything else is unknown.
async function fakeOFF(page) {
  const off = { attempts: {} };
  const product = (name, kcal) => ({ product: { product_name: name, serving_quantity: 45, nutriments: { 'energy-kcal_100g': kcal, proteins_100g: 6, carbohydrates_100g: 55, fat_100g: 30 } } });
  const match = (url) => url.hostname === 'world.openfoodfacts.org';
  const handler = (route) => {
    const code = (route.request().url().split('/product/')[1] || '').split('.json')[0];
    off.attempts[code] = (off.attempts[code] || 0) + 1;
    if (code === '2222222' && off.attempts[code] === 1) return route.abort('internetdisconnected');
    const body = code === '1111111' ? product('QA bar', 540) : code === '2222222' ? product('QA crisps', 520) : { status: 0 };
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  };
  await page.route(match, handler);
  off.done = () => page.unroute(match, handler);
  return off;
}

const FOOD_BODY = [
  { name: 'recipe: Enter on the last amount, then Save (bugs:food-body#1, features:food#1)', async run(page) {
    await fresh(page);
    await page.evaluate(() => openSavedFoodPicker(null, null, 'recipes'));
    await page.locator('#sf-new').click();
    await page.locator('#rec-name').fill('QA stew');
    const row = page.locator('#rec-rows .rec-row').first();
    await row.locator('[data-f="name"]').fill('QA chicken');
    await row.locator('[data-toggle]').click();
    await row.locator('[data-f="calories"]').fill('330');
    await row.locator('[data-f="qty"]').fill('200 g');
    await row.locator('[data-f="qty"]').press('Enter');
    assert.equal(await page.locator('#rec-rows .rec-row').count(), 2, 'setup: Enter on the last amount adds an empty row');
    await page.locator('#rec-save').click();
    const said = await toastText(page);
    const saved = await page.evaluate(() => DB.recipes.list().find((r) => r.name === 'QA stew') || null);
    assert.ok(saved, 'a recipe with a trailing empty row saves — v397 refused it with ' + JSON.stringify(said));
    assert.equal(saved.items.length, 1, 'and the empty row is not an ingredient');
    assert.equal(said, await tr(page, 'rec_saved'));
  } },
  { name: 'recipe: a row with figures and no name (bugs:food-body#1)', async run(page) {
    await fresh(page);
    await page.evaluate(() => openSavedFoodPicker(null, null, 'recipes'));
    await page.locator('#sf-new').click();
    await page.locator('#rec-name').fill('QA nameless');
    const rows = page.locator('#rec-rows .rec-row');
    await rows.nth(0).locator('[data-f="name"]').fill('QA rice');
    await rows.nth(0).locator('[data-toggle]').click();
    await rows.nth(0).locator('[data-f="calories"]').fill('200');
    await page.locator('#rec-add').click();
    await rows.nth(1).locator('[data-toggle]').click();
    await rows.nth(1).locator('[data-f="calories"]').fill('50');
    await page.locator('#rec-save').click();
    const said = await toastText(page);
    assert.equal(said, await tr(page, 'rec_need_name'), 'a row with figures but no name is named as the problem — v397 said ' + JSON.stringify(said));
    assert.equal(await page.evaluate(() => DB.recipes.list().some((r) => r.name === 'QA nameless')), false, 'and nothing is saved');
    assert.equal(await page.evaluate(() => (document.activeElement && document.activeElement.dataset.f) || ''), 'name', 'the cursor lands in the name it is missing');
  } },
  { name: 'meal portion: the ceiling is named, a future date is refused (features:food#6, bugs:food-body#10)', async run(page) {
    await fresh(page);
    const bid = await page.evaluate(() => DB.mealBundles.update(null, { name: 'QA big meal', items: [{ name: 'QA grilled', servings: 5, calories: 165, protein: 31, carbs: 0, fat: 4 }] }).entity.id);
    await page.evaluate(() => openSavedFoodPicker(null, null, 'bundles'));
    await page.locator(`[data-portion-bundle="${bid}"]`).click();
    const today = await page.evaluate(() => todayISO());
    const before = await page.evaluate((d) => DB.foodLogs.listForDate(d).length, today);
    const cap = (await tr(page, 'cx_portion_cap')).replace('{n}', '4');
    await page.locator('#cx-log-portion').fill('5');
    assert.equal(await page.locator('#cx-log-total').innerText(), cap, 'the preview says the ceiling instead of a total it cannot log');
    await page.locator('#cx-log-meal').click();
    const said = await toastText(page);
    assert.equal(said, cap, 'Add names the ceiling — v397 said ' + JSON.stringify(said));
    assert.equal(await page.evaluate((d) => DB.foodLogs.listForDate(d).length, today), before, 'and logs nothing');
    const tomorrow = await page.evaluate(() => addDaysISO(todayISO(), 1));
    await page.locator('#cx-log-portion').fill('1');
    await page.locator('#cx-log-date').fill(tomorrow);
    await page.locator('#cx-log-meal').click();
    assert.equal(await toastText(page), await tr(page, 'date_future'), 'a date still to come is refused');
    assert.equal(await page.evaluate((d) => DB.foodLogs.listForDate(d).length, tomorrow), 0, 'v397 logged the meal to a day the food log cannot open');
    await page.locator('#cx-log-date').fill(today);
    await page.locator('#cx-log-portion').fill('4');
    await page.locator('#cx-log-meal').click();
    assert.equal(await page.evaluate((d) => DB.foodLogs.listForDate(d).length, today), before + 1, 'at the ceiling it logs');
  } },
  { name: 'manual entry and the food sheet: a negative figure is refused (features:food#4)', async run(page) {
    await openFrom(page, 'manual');
    const today = await page.evaluate(() => todayISO());
    const logs = await page.evaluate((d) => DB.foodLogs.listForDate(d).length, today);
    const foods = await page.evaluate(() => DB.foods.list().length);
    await page.locator('#mf-name').fill('QA minus');
    await page.locator('#mf-cal').fill('-300');
    await page.locator('#mf-save').click();
    const said = await toastText(page);
    assert.equal(said, await tr(page, 'food_negative'), 'a negative figure is refused by name — v397 logged -300 kcal and kept it in My foods');
    assert.equal(await page.evaluate((d) => DB.foodLogs.listForDate(d).length, today), logs, 'nothing is logged');
    assert.equal(await page.evaluate(() => DB.foods.list().length), foods, 'nothing is kept');
    await page.locator('#mf-cal').fill('300');
    await page.locator('#mf-save').click();
    assert.equal(await page.evaluate((d) => DB.foodLogs.listForDate(d).some((x) => x.name === 'QA minus' && x.calories === 300), today), true, 'the corrected figure logs');
    await page.evaluate(() => { closeModal(); hideToast(); openFoodModal(); });
    await page.locator('#food-name').fill('QA minus saved');
    await page.locator('#food-cal').fill('-20');
    await page.locator('#save-food-btn').click();
    assert.equal(await toastText(page), await tr(page, 'food_negative'), 'the saved-food sheet refuses it too');
    assert.equal(await page.evaluate(() => DB.foods.list().some((f) => f.name === 'QA minus saved')), false);
  } },
  { name: 'barcode: a typed code that is not found keeps the camera scanning (bugs:food-body#6)', async run(page) {
    await installMedia(page, 0);
    const off = await fakeOFF(page);
    try {
      await openFrom(page, 'barcode');
      await page.waitForFunction(() => window.qaMedia.detects > 2);
      await page.locator('#bc-manual-input').fill('9999999');
      await page.locator('#bc-manual-go').click();
      await page.waitForFunction((txt) => document.querySelector('#bc-status').textContent === txt, await tr(page, 'barcode_not_found'));
      const n0 = await page.evaluate(() => window.qaMedia.detects);
      await page.waitForTimeout(600);
      const n1 = await page.evaluate(() => window.qaMedia.detects);
      assert.ok(n1 - n0 >= 5, `the camera still reads frames after a typed miss — v397 ended its loop for good (${n0} → ${n1})`);
    } finally { await off.done(); await page.evaluate(() => closeModal()); await restoreMedia(page); }
  } },
  { name: 'barcode: a code that failed on the network is tried again (bugs:food-body#6)', async run(page) {
    await installMedia(page, 0);
    const off = await fakeOFF(page);
    try {
      await openFrom(page, 'barcode');
      await page.waitForFunction(() => window.qaMedia.detects > 2);
      await page.evaluate(() => { window.qaMedia.codes = ['2222222']; });
      const shown = await page.locator('#bc-add').waitFor({ timeout: 7000 }).then(() => true, () => false);
      assert.ok(shown, 'a code whose lookup failed on the network is looked up again once it can be — v397 filed it as unknown and never asked again');
      assert.ok((await page.locator('#bc-result').innerText()).includes('QA crisps'));
      assert.equal(off.attempts['2222222'], 2, 'once to fail, once to find — not a request every frame while offline');
    } finally { await off.done(); await page.evaluate(() => closeModal()); await restoreMedia(page); }
  } },
  { name: 'barcode: a miss clears the previous product (features:food#3)', async run(page) {
    await installMedia(page, 0);
    const off = await fakeOFF(page);
    try {
      await openFrom(page, 'barcode');
      await page.locator('#bc-manual-input').fill('1111111');
      await page.locator('#bc-manual-go').click();
      await page.locator('#bc-add').waitFor();
      await page.locator('#bc-manual-input').fill('9999999');
      await page.locator('#bc-manual-go').click();
      await page.waitForFunction((txt) => document.querySelector('#bc-status').textContent === txt, await tr(page, 'barcode_not_found'));
      assert.equal(await page.locator('#bc-add').count(), 0, "a code that is not found leaves no product on screen — v397 kept the last product's card and its Add button live");
    } finally { await off.done(); await page.evaluate(() => closeModal()); await restoreMedia(page); }
  } },
  { name: 'barcode: a camera that arrives after the sheet closed is stopped (bugs:food-body#4)', async run(page) {
    await installMedia(page, 1500);
    try {
      await openFrom(page, 'barcode');
      await page.locator('#modal-root .modal-header [data-close]').click();
      await page.waitForTimeout(1900);
      const states = await page.evaluate(() => window.qaMedia.tracks.map((tk) => tk.readyState));
      assert.ok(states.length > 0, 'setup: the camera arrived');
      assert.deepEqual(states, states.map(() => 'ended'), 'a camera granted after the sheet closed is switched off — v397 left it running: ' + JSON.stringify(states));
    } finally { await restoreMedia(page); }
  } },
  { name: 'voice: closing the sheet mid-recording uploads nothing (bugs:food-body#3)', async run(page) {
    await installMedia(page, 0);
    await page.evaluate(() => { window.qaVoice = 0; window.qaAnalyze = FoodAI.analyzeAudio; FoodAI.analyzeAudio = async () => { window.qaVoice++; return { items: [], transcript: '' }; }; });
    try {
      await openFrom(page, 'voice');
      const recording = () => page.waitForFunction(() => document.querySelector('#voice-mic').classList.contains('recording'));
      await page.locator('#voice-mic').click();
      await recording();
      await page.waitForTimeout(600);
      await page.locator('#voice-mic').click();
      const sent = await page.waitForFunction(() => window.qaVoice === 1, null, { timeout: 5000 }).then(() => true, () => false);
      assert.ok(sent, 'setup: stopping with the sheet open sends the recording (so the harness records real audio)');
      await page.locator('#voice-mic').click();
      await recording();
      await page.waitForTimeout(600);
      await page.locator('#modal-root .modal-header [data-close]').click();
      await page.waitForTimeout(1500);
      assert.equal(await page.evaluate(() => window.qaVoice), 1, 'closing the sheet mid-recording sends nothing — v397 uploaded the speech the user walked away from');
      const live = await page.evaluate(() => window.qaMedia.tracks.filter((tk) => tk.readyState === 'live').length);
      assert.equal(live, 0, 'and the microphone is off');
    } finally { await page.evaluate(() => { FoodAI.analyzeAudio = window.qaAnalyze; }); await restoreMedia(page); }
  } },
  { name: 'voice: a microphone that arrives after the sheet closed is stopped (bugs:food-body#4)', async run(page) {
    await installMedia(page, 1500);
    try {
      await openFrom(page, 'voice');
      await page.locator('#voice-mic').click();
      await page.locator('#modal-root .modal-header [data-close]').click();
      await page.waitForTimeout(1900);
      const states = await page.evaluate(() => window.qaMedia.tracks.map((tk) => tk.readyState));
      assert.ok(states.length > 0, 'setup: the microphone arrived');
      assert.deepEqual(states, states.map(() => 'ended'), 'a microphone granted after the sheet closed is switched off — v397 started recording into nothing: ' + JSON.stringify(states));
    } finally { await restoreMedia(page); }
  } },
  { name: "recipe: the AI's daily limit is said, not «could not work out» (bugs:food-body#12)", async run(page) {
    const match = (url) => url.hostname === 'vault-calories.moathdarweesh2000.workers.dev';
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const handler = (route) => route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 429, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: 'daily limit', code: 'DAILY_LIMIT' }) });
    await page.route(match, handler);
    try {
      await fresh(page);
      await page.evaluate(() => openSavedFoodPicker(null, null, 'recipes'));
      await page.locator('#sf-new').click();
      const row = page.locator('#rec-rows .rec-row').first();
      await row.locator('[data-f="name"]').fill('QA lentils');
      await row.locator('[data-f="qty"]').fill('200 g');
      await page.waitForFunction(() => document.querySelector('#rec-rows .rec-row').dataset.state === 'fail', null, { timeout: 6000 });
      const said = await toastText(page);
      assert.equal(said, await tr(page, 'ai_daily_limit'), 'a refusal that lasts until midnight says so — v397 said ' + JSON.stringify(said));
    } finally { await page.unroute(match, handler); await page.evaluate(() => closeModal()); }
  } },
  { name: 'logout: an upload that failed signs nobody out (features:body-home-settings#6)', async run(page) {
    await page.evaluate(() => {
      window.qaCalls = [];
      window.qaCloudSaved = {};
      const stub = { configured: () => true, ensureSdk: async () => {}, currentEmail: async () => 'qa@example.com',
        recoveryInfo: () => null, recoveryFailedAt: () => '',
        flush: async () => { window.qaCalls.push('flush'); return 'nosession'; },
        signOut: async () => { window.qaCalls.push('signOut'); }, clearLocalUserData: () => { window.qaCalls.push('clear'); } };
      for (const k of Object.keys(stub)) { window.qaCloudSaved[k] = Cloud[k]; Cloud[k] = stub[k]; }
      closeModal(); hideToast(); navigate('settings');
    });
    try {
      await page.locator('#logout-btn').click();
      await page.locator('#modal-root .confirm-dialog [data-ok]').click();
      await page.waitForTimeout(700);
      const stayed = await page.evaluate(() => (Array.isArray(window.qaCalls) ? window.qaCalls.slice() : null)).catch(() => null);
      assert.ok(stayed && stayed.includes('flush'), 'after a failed upload the page is still this session — v397 signed out and reloaded without a word');
      const title = await tr(page, 'logout_unsynced_t');
      const refused = await page.locator('#modal-root .confirm-title').filter({ hasText: title }).waitFor({ timeout: 4000 }).then(() => true, () => false);
      assert.ok(refused, 'a failed upload is said, and the choice is the user\'s — v397 signed out and reloaded without a word');
      assert.deepEqual(await page.evaluate(() => window.qaCalls), ['flush'], 'nobody is signed out and nothing is cleared');
      await page.locator('#modal-root .confirm-dialog [data-close]').click();
      assert.deepEqual(await page.evaluate(() => window.qaCalls), ['flush'], 'Cancel keeps the account signed in');
    } finally {
      await page.evaluate(() => { for (const k of Object.keys(window.qaCloudSaved || {})) Cloud[k] = window.qaCloudSaved[k]; closeModal(); hideToast(); navigate('home'); });
    }
  } },
];
module.exports.FOOD_BODY = FOOD_BODY;

// ---- «استخراج وصفة» · commit B, driven with real clicks ------------------------
// The Worker is faked with page.route ONLY (never the real one): every POST is
// recorded as the Worker would receive it and answered by `reply`. Each case
// signs in (Cloud.getSession — the harness's Cloud has none) and puts it back.
const RX_STUB = { name: 'QA pasta', servings: 2, items: [
  { name: 'spaghetti', qty: '200 g', calories: 742, protein: 26, carbs: 150, fat: 3 },
  { name: 'olive oil', qty: '2 tbsp', calories: 239, protein: 0, carbs: 0, fat: 27 },
  { name: 'salt', qty: '~1 tsp', calories: 0, protein: 0, carbs: 0, fat: 0 }] };
async function rxKit(page) {
  const kit = { bodies: [], reply: () => ({ status: 200, body: { recipe: RX_STUB } }), hold: null };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const match = (url) => url.hostname === 'vault-calories.moathdarweesh2000.workers.dev';
  const handler = async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    kit.bodies.push(route.request().postData() || '');
    if (kit.hold) { kit.held = route; kit.hold(); return; }
    const r = kit.reply(kit.bodies.length);
    return route.fulfill({ status: r.status, contentType: 'application/json', headers: cors, body: JSON.stringify(r.body) });
  };
  await page.route(match, handler);
  await page.evaluate(() => { window.qaGetSession = Cloud.getSession; Cloud.getSession = async () => ({ user: { id: 'qa' }, access_token: 'qa-token' }); });
  kit.last = () => JSON.parse(kit.bodies[kit.bodies.length - 1]);
  kit.done = async () => {
    await page.unroute(match, handler);
    await page.evaluate(() => { if (window.qaGetSession) Cloud.getSession = window.qaGetSession; else delete Cloud.getSession; delete window.qaGetSession; closeModal(); hideToast(); });
  };
  return kit;
}
// Open the import from «وصفاتي» the way a thumb does, and pick a source tile.
async function rxOpen(page, source) {
  await fresh(page);
  await page.evaluate(() => openSavedFoodPicker(null, null, 'recipes'));
  await page.locator('#sf-import').click();
  if (source) await page.locator(`[data-rx-pick="${source}"]`).click();
}
const rxError = (page) => page.locator('[data-rx-error]:not([hidden])').waitFor({ timeout: 15000 }).then(() => page.locator('[data-rx-error]').innerText(), () => null);
// A JPEG's size, read from its SOF marker in Node (fetch('data:') is blocked by connect-src).
function jpegSize(b64) {
  const b = Buffer.from(b64, 'base64');
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
// A WAV's header and its loudest sample, read in Node.
function wavInfo(b64) {
  const b = Buffer.from(b64, 'base64');
  let peak = 0;
  for (let i = 44; i + 1 < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)));
  return { riff: b.toString('latin1', 0, 4), wave: b.toString('latin1', 8, 12), fmt: b.readUInt16LE(20), ch: b.readUInt16LE(22),
    rate: b.readUInt32LE(24), bits: b.readUInt16LE(34), data: b.toString('latin1', 36, 40), bytes: b.readUInt32LE(40), peak };
}
const NOT_RECIPE_FIELDS = ['text', 'prompt', 'image', 'audio'];
// A 2-second clip made IN THE PAGE: a canvas whose colour and number change every
// frame (captureStream) and a 440 Hz tone (an oscillator into a stream
// destination), recorded by MediaRecorder as WebM. A MediaRecorder WebM carries
// no cues, so its duration reads Infinity — the fallback path is exercised too.
async function rxMakeWebm(page) {
  await page.keyboard.press('Shift');   // user activation, so the AudioContext may run
  return page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
    const g = cv.getContext('2d');
    const ac = new AudioContext(); await ac.resume();
    const osc = ac.createOscillator(), amp = ac.createGain(), dst = ac.createMediaStreamDestination();
    osc.frequency.value = 440; amp.gain.value = 0.4; osc.connect(amp); amp.connect(dst); osc.start();
    let f = 0;
    const draw = () => { g.fillStyle = 'hsl(' + ((f * 47) % 360) + ',80%,50%)'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#fff'; g.font = '64px sans-serif'; g.fillText(String(f++), 40, 150); };
    draw(); const tick = setInterval(draw, 66);
    const stream = new MediaStream([...cv.captureStream(15).getVideoTracks(), ...dst.stream.getAudioTracks()]);
    const type = ['video/webm;codecs=vp8,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x));
    const rec = new MediaRecorder(stream, { mimeType: type }), chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    rec.start(250);
    await new Promise((r) => setTimeout(r, 2000));
    rec.stop(); await stopped;
    clearInterval(tick); osc.stop();
    const state = ac.state; await ac.close();
    const blob = new Blob(chunks, { type: 'video/webm' });
    // What a <video> reports for it before anything seeks: Infinity is the case
    // decomposeVideo's fallback exists for, so the case says whether it ran.
    const probe = document.createElement('video'), src = URL.createObjectURL(blob);
    const duration0 = await new Promise((r) => { probe.onloadedmetadata = () => r(String(probe.duration)); probe.onerror = () => r('error'); probe.muted = true; probe.src = src; });
    URL.revokeObjectURL(src); probe.removeAttribute('src');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { state, type, duration0, size: bytes.length, b64: btoa(bin) };
  });
}
// The editor a successful import hands over: RX_STUB, field by field, as a draft
// to review — and one save writes one recipe holding only the stored fields.
async function rxEditorChecks(page) {
  // First, while it is up: a plain toast lasts 1.8 s.
  assert.equal(await toastText(page), await tr(page, 'rx_review_toast'), 'the toast asks for a review');
  assert.equal((await page.locator('#modal-root .modal-title').innerText()).trim(), await tr(page, 'rx_review_title'), 'the editor is titled as a review');
  assert.equal(await page.locator('#rec-name').inputValue(), RX_STUB.name);
  assert.equal(await page.locator('#rec-servings').inputValue(), String(RX_STUB.servings));
  const rows = page.locator('#rec-rows .rec-row');
  assert.equal(await rows.count(), RX_STUB.items.length, 'one row per ingredient');
  assert.equal(await rows.nth(0).getAttribute('data-src'), 'ai', 'a figure the model gave is marked as its estimate');
  assert.equal((await rows.nth(0).locator('.rec-sum-tag').innerText()).trim(), await tr(page, 'rec_tag_ai'));
  assert.equal(await rows.nth(0).locator('[data-f="qty"]').inputValue(), RX_STUB.items[0].qty, 'the amount as the source wrote it');
  assert.equal(await rows.nth(2).getAttribute('data-state'), 'done', 'a zero row (salt) is settled — seeded as entered, never refused as «no figures»');
  const kcal = RX_STUB.items.reduce((n, it) => n + it.calories, 0);
  assert.equal((await page.locator('#rec-totals [data-t="calories"]').innerText()).trim(), await page.evaluate((n) => fmtNum(n), kcal), 'the totals are the stub\'s');
  const before = await page.evaluate(() => DB.recipes.list().length);
  await page.locator('#rec-save').click();
  assert.equal(await toastText(page), await tr(page, 'rec_saved'));
  const saved = await page.evaluate((name) => DB.recipes.list().filter((r) => r.name === name), RX_STUB.name);
  assert.equal(await page.evaluate(() => DB.recipes.list().length), before + 1, 'ONE new recipe');
  const got = saved[saved.length - 1];
  assert.equal(got.items.length, RX_STUB.items.length);
  for (const it of got.items) assert.equal(Object.keys(it).sort().join(','), 'calories,carbs,fat,id,name,protein,qty', 'an ingredient stores exactly its fields — no _src/_auto/_manual/note: ' + Object.keys(it).join(','));
  assert.equal(got.servings, RX_STUB.servings);
  await page.evaluate((id) => DB.recipes.remove(id), got.id);
}

const RECIPE_IMPORT = [
  { name: 'B1 «استخراج وصفة» is offered on the recipes tab only', async run(page) {
    await fresh(page);
    await page.evaluate(() => openSavedFoodPicker(null, null, 'foods'));
    const btn = page.locator('#sf-import');
    assert.equal(await btn.count(), 1, 'the picker carries #sf-import — v399 has none (' + (await btn.count()) + ')');
    assert.equal(await btn.isVisible(), false, 'not on the foods tab');
    await page.locator('.sfp-tab[data-tab="recipes"]').click();
    assert.equal(await btn.isVisible(), true, 'on the recipes tab');
    assert.equal((await btn.innerText()).trim(), await tr(page, 'rx_title'));
    await page.locator('.sfp-tab[data-tab="bundles"]').click();
    assert.equal(await btn.isVisible(), false, 'not on the meals tab');
    await page.evaluate(() => closeModal());
  } },
  { name: 'B2 a gallery clip: stills + a WAV + the caption go, the file never does; the editor opens prefilled and saves', async run(page) {
    const kit = await rxKit(page);
    try {
      const clip = await rxMakeWebm(page);
      assert.equal(clip.state, 'running', 'setup: the AudioContext ran, so the clip has a soundtrack (' + clip.type + ', ' + clip.size + ' bytes)');
      assert.equal(clip.duration0, 'Infinity', 'setup: a MediaRecorder WebM reports no duration, so the Infinity fallback is what reads it');
      await rxOpen(page);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-rx-pick="video"]').click()]);
      await chooser.setFiles({ name: 'qa-clip.webm', mimeType: 'video/webm', buffer: Buffer.from(clip.b64, 'base64') });
      const caption = 'QA caption: 200 g spaghetti, 2 tbsp olive oil, salt';
      await page.locator('#rx-text').fill(caption);
      await page.locator('[data-rx-go]').click();
      const opened = await page.locator('#rec-rows .rec-row').first().waitFor({ timeout: 45000 }).then(() => true, () => false);
      assert.ok(opened, 'the editor opens with the recipe — sheet said ' + JSON.stringify(await page.locator('#modal-root').innerText().catch(() => '')));
      assert.equal(kit.bodies.length, 1, 'ONE request');
      const raw = kit.bodies[0], body = JSON.parse(raw);
      assert.equal(Object.keys(body).join(','), 'mode,lang,frames,recipeAudio,recipeText', 'recipe fields only');
      for (const k of NOT_RECIPE_FIELDS) assert.ok(!(k in body), 'no generic ' + k);
      assert.ok(!raw.includes('GkXfo'), 'the WebM itself (its EBML header) was never sent');
      assert.ok(body.frames.length >= 2 && body.frames.length <= 10, '2–10 stills (RX_FRAMES): ' + body.frames.length);
      for (const f of body.frames) {
        const s = jpegSize(f.data);
        assert.ok(f.mimeType === 'image/jpeg' && s && Math.max(s.w, s.h) <= 768, 'a JPEG still no larger than 768 px: ' + f.mimeType + ' ' + JSON.stringify(s));
      }
      const w = wavInfo(body.recipeAudio.data);
      assert.equal([body.recipeAudio.mimeType, w.riff, w.wave, w.fmt, w.ch, w.rate, w.bits, w.data].join(' '), 'audio/wav RIFF WAVE 1 1 16000 16 data', 'a 16 kHz mono PCM16 WAV');
      assert.ok(Math.abs(w.bytes - 64000) <= 16000, 'about two seconds of it: ' + w.bytes + ' bytes');
      assert.ok(w.peak > 1000, 'and the tone is in it (peak ' + w.peak + ')');
      assert.equal(body.recipeText, caption, 'the caption travels as recipeText');
      await rxEditorChecks(page, kit);
    } finally { await kit.done(); }
  } },
  { name: 'B3 an OLD Worker is «not available yet», never a recipe', async run(page) {
    const kit = await rxKit(page);
    try {
      const count = await page.evaluate(() => DB.recipes.list().length);
      for (const [status, body] of [[200, { items: [{ name: 'pasta', calories: 300, protein: 10, carbs: 60, fat: 2 }] }], [400, { error: 'no input' }]]) {
        kit.reply = () => ({ status, body });
        await rxOpen(page, 'text');
        await page.locator('#rx-text').fill('200 g pasta, olive oil');
        await page.locator('[data-rx-go]').click();
        assert.equal(await rxError(page), await tr(page, 'rx_unavailable'), 'an old Worker answering ' + status + ' ' + JSON.stringify(body) + ' reads «not available yet»');
        assert.equal(await page.locator('#rec-rows').count(), 0, 'and no editor opens');
        assert.equal(await page.locator('[data-rx-retry]').isVisible(), false, 'nor is «try again» offered — it would only ask again');
      }
      assert.equal(await page.evaluate(() => DB.recipes.list().length), count, 'nothing is saved');
    } finally { await kit.done(); }
  } },
  { name: 'B4 text alone and an image alone send only their own field', async run(page) {
    const kit = await rxKit(page);
    try {
      await rxOpen(page, 'text');
      await page.locator('[data-rx-go]').click();
      assert.equal(await toastText(page), await tr(page, 'rx_need_text'), 'an empty text is refused on the phone');
      assert.equal(kit.bodies.length, 0, 'with no request');
      await page.locator('#rx-text').fill('Garlic pasta for 2: 200 g spaghetti, 2 tbsp olive oil, salt');
      await page.locator('[data-rx-go]').click();
      await page.locator('#rec-rows .rec-row').first().waitFor({ timeout: 15000 });
      assert.equal(Object.keys(kit.last()).join(','), 'mode,lang,recipeText', 'text alone: ' + Object.keys(kit.last()).join(','));
      const png = await page.evaluate(async () => {
        const cv = document.createElement('canvas'); cv.width = 2000; cv.height = 1000;
        const g = cv.getContext('2d'); g.fillStyle = '#d94'; g.fillRect(0, 0, 2000, 1000); g.fillStyle = '#fff'; g.font = '120px sans-serif'; g.fillText('200 g rice', 200, 500);
        const b = await new Promise((r) => cv.toBlob(r, 'image/png'));
        const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        return btoa(s);
      });
      await rxOpen(page);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-rx-pick="image"]').click()]);
      await chooser.setFiles({ name: 'qa-card.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
      await page.locator('[data-rx-go]').click();
      await page.locator('#rec-rows .rec-row').first().waitFor({ timeout: 15000 });
      const b = kit.last(), s = jpegSize(b.frames[0].data);
      assert.equal(Object.keys(b).join(','), 'mode,lang,frames', 'an image alone: ' + Object.keys(b).join(','));
      assert.ok(b.frames.length === 1 && b.frames[0].mimeType === 'image/jpeg' && s && Math.max(s.w, s.h) <= 1600, 'one JPEG, 1600 px at most: ' + JSON.stringify(s));
    } finally { await kit.done(); }
  } },
  { name: 'B5 the link tile sends {link} alone; a host the Worker never reads is refused on the phone; LINK_BLOCKED is said', async run(page) {
    const kit = await rxKit(page);
    try {
      await rxOpen(page, 'link');
      await page.locator('#rx-link').fill('https://example.com/my-recipe');
      await page.locator('[data-rx-go]').click();
      assert.equal(await toastText(page), await tr(page, 'rx_link_unsupported'), 'a host outside the eleven is refused before any request');
      assert.equal(kit.bodies.length, 0, 'with no request spent');
      kit.reply = () => ({ status: 502, body: { error: 'service unavailable', code: 'LINK_BLOCKED' } });
      await page.locator('#rx-link').fill('  https://youtu.be/dQw4w9WgXcQ  ');
      await page.locator('[data-rx-go]').click();
      assert.equal(await rxError(page), await tr(page, 'rx_link_blocked'), 'a link the Worker could not reach says so, and what to do instead');
      const b = kit.last();
      assert.equal(Object.keys(b).join(','), 'mode,lang,link', 'the link travels alone: ' + Object.keys(b).join(','));
      assert.equal(b.link, 'https://youtu.be/dQw4w9WgXcQ', 'trimmed, otherwise as typed — the Worker rebuilds the URL itself');
      assert.equal(await page.locator('#rec-rows').count(), 0, 'and no editor opens');
    } finally { await kit.done(); }
  } },
  { name: 'B6 cancel mid-flight aborts the request; no editor, no toast', async run(page) {
    const kit = await rxKit(page);
    const failed = [];
    const onFail = (req) => { if (req.url().includes('workers.dev')) failed.push(req.failure() && req.failure().errorText); };
    page.on('requestfailed', onFail);
    try {
      const arrived = new Promise((r) => { kit.hold = r; });
      await rxOpen(page, 'text');
      await page.locator('#rx-text').fill('200 g pasta');
      await page.locator('[data-rx-go]').click();
      await arrived;
      await page.locator('[data-rx-cancel]').click();
      await page.waitForTimeout(400);
      try { await kit.held.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ recipe: RX_STUB }) }); } catch (_) { /* the page already dropped it */ }
      await page.waitForTimeout(600);
      assert.ok(failed.length === 1, 'the request was aborted by the page (requestfailed): ' + JSON.stringify(failed));
      assert.equal(await page.locator('#rec-rows').count(), 0, 'no editor opens after a cancel');
      assert.notEqual(await toastText(page), await tr(page, 'rx_review_toast'), 'and no review toast');
      assert.equal(await page.locator('#modal-root .modal-overlay:not(.is-out)').count(), 0, 'the sheet is gone');
    } finally { page.off('requestfailed', onFail); kit.hold = null; await kit.done(); }
  } },
  { name: 'B7 a recipe with no name is refused BY NAME (rec_need_title), a draft\'s cursor goes to it', async run(page) {
    await fresh(page);
    await page.evaluate(() => openRecipeEditor(null, null, () => {}));
    const row = page.locator('#rec-rows .rec-row').first();
    await row.locator('[data-f="name"]').fill('QA rice');
    await row.locator('[data-toggle]').click();
    await row.locator('[data-f="calories"]').fill('300');
    await page.locator('#rec-save').click();
    const said = await toastText(page);
    assert.equal(said, await tr(page, 'rec_need_title'), 'a nameless recipe is refused for its name — v399 said ' + JSON.stringify(said));
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'rec-name', 'and the cursor goes to the name');
    const kit = await rxKit(page);
    try {
      kit.reply = () => ({ status: 200, body: { recipe: Object.assign({}, RX_STUB, { name: '' }) } });
      await rxOpen(page, 'text');
      await page.locator('#rx-text').fill('200 g spaghetti, olive oil, salt');
      await page.locator('[data-rx-go]').click();
      await page.locator('#rec-rows .rec-row').first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'rec-name', 'a draft with no name opens on its name');
      await page.locator('#rec-save').click();
      assert.equal(await toastText(page), await tr(page, 'rec_need_title'), 'and saving it asks for one');
    } finally { await kit.done(); }
  } },
];
module.exports.RECIPE_IMPORT = RECIPE_IMPORT;


// ---- v398 · THE ROUTER, HOME AND THE NOTICES (batch 2b) ----------------------
// Every case below FAILED on v397 before its fix, and the failure it printed is
// quoted beside it. Clicks are Playwright's (hit-tested, actionable); the
// Android hardware Back is `if (!goBack()) App.exitApp()`, so it is driven by
// calling goBack() exactly as that listener calls it.
async function routerHomeKit(page) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const ids = await ev(() => DB.exercises.list().filter((e) => !e.isCustom).map((e) => e.id));
  const today = await ev(() => todayISO());
  const origin = new URL(page.url()).origin;
  const toastNow = () => ev(() => {
    const el = document.querySelector('.toast.show');
    return el ? { msg: (el.querySelector('.toast-msg') || el).textContent.trim(), undo: !!el.querySelector('.toast-action') } : null;
  });
  // The root is Home with nothing on top of it: the state a cold launch leaves.
  const reset = (view) => ev((view) => {
    try { closeModal(); } catch (_) {}
    hideToast();
    document.querySelectorAll('.app > .sheet-overlay').forEach((s) => s.remove());
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view && view !== 'home') navigate(view);
  }, view || 'home');
  const sheetUp = () => page.waitForFunction(() => !!document.querySelector('.app > .sheet-overlay.open'), null, { timeout: 2000 });
  const sheetGone = () => page.waitForFunction(() => !document.querySelector('.app > .sheet-overlay'), null, { timeout: 1500 }).then(() => true, () => false);
  // Back is swallowed while the launch door is up (goBack's first line), so a
  // case run behind it would be reading the door, not the sheet.
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 6000 });
  await ev(() => { closeModal(); hideToast(); DB.notif.setAsked(); DB.prefs.setUnit('kg'); DB.prefs.setLang('en'); applyLang('en'); DB.prefs.setExNames('translit'); });
  const A = ids[20], B = ids[21];
  const rotation = (name, exIds, days) => ev(({ name, exIds, days, today }) => DB.plan.setRotation({ cycle: [{ name, exerciseIds: exIds }], trainingDays: days, anchor: today }), { name, exIds, days: days || [0, 1, 2, 3, 4, 5, 6], today });

  return { page, ev, ids, today, origin, toastNow, reset, sheetUp, sheetGone, A, B, rotation };
}

// One case per finding, in the order of the batch. A list, so each can be run
// on its own against the unfixed tree to read what it printed there.
const routerHomeCases = [
  ["Back vs the five sheets that live on .app, not #modal-root", async ({ page, ev, today, reset, sheetUp, sheetGone, A, B, rotation }) => {
    // ── Back vs the five sheets that live on .app, not #modal-root ─────────────
    // goBack() knew the add-sheet alone. On Home — the root — Back returned
    // false with the rest, train-anyway, reorder or permission sheet open, and
    // the APK called App.exitApp() under it; anywhere else it popped the screen
    // and left the sheet floating over the next one. v397, the rest sheet: on
    // Home {handled:false,view:'home',left:1}; on Settings
    // {handled:true,view:'home',sameDepth:false,left:1}; the same for the other
    // three, and the permission sheet's ask unspent.
    await rotation('QA sheets', [A, B]);
    for (const name of ['rest', 'train-anyway', 'reorder', 'notif-perm', 'add-sheet']) {
      for (const where of ['home', 'settings']) {
        await reset(where);
        await ev((name) => {
          // the permission sheet's own close is what spends its one ask
          if (name === 'notif-perm') STATE.notif = Object.assign(DB.notif.get(), { asked: false });
          ({ rest: () => openRestSheet(), 'train-anyway': () => openTrainAnywaySheet(),
            reorder: () => openReorderSheet(0, () => {}), 'notif-perm': () => openNotifPermSheet(),
            'add-sheet': () => openAddSheet(null, () => {}) })[name]();
        }, name);
        await sheetUp();
        const r = await ev(() => { const depth = navStack.length; const handled = goBack(); return { handled, view: currentView, sameDepth: navStack.length === depth }; });
        await sheetGone();
        r.left = await ev(() => document.querySelectorAll('.app > .sheet-overlay').length);
        const want = { handled: true, view: where, sameDepth: true, left: 0 };
        if (name === 'notif-perm') { r.asked = await ev(() => DB.notif.get().asked); want.asked = true; }
        assert.deepEqual(r, want, `Back with the ${name} sheet open on ${where} closes the sheet through its own close and keeps the screen (the Android listener exits on false): ` + JSON.stringify(r));
      }
    }
    // …and Escape, the keyboard's Back, skipped them the same way (v397: it stayed up).
    await reset('home');
    await ev(() => openRestSheet());
    await sheetUp();
    await page.keyboard.press('Escape');
    assert.equal(await sheetGone(), true, 'Escape closes the rest sheet');
    // A navigation left them over the next screen. It closes each through the
    // same hook: the reorder, which writes once on close, is KEPT, and its onDone
    // does not repaint the screen being left. v397: {left:1, order:[A,B], onDone:0}.
    {
      await reset('home');
      const r = await ev(async ({ today }) => {
        window.qaReorderDone = 0;
        navigate('session-day', { date: today });
        openReorderSheet(0, () => { window.qaReorderDone++; });
        document.querySelector('#reorder-sheet-overlay [data-ro="0"][data-dir="1"]').click();   // A below B
        navigate('home');
        return { left: document.querySelectorAll('.app > .sheet-overlay').length, order: DB.plan.get().cycle[0].exerciseIds, onDone: window.qaReorderDone };
      }, { today });
      assert.deepEqual(r, { left: 0, order: [B, A], onDone: 0 }, 'a navigation closes the reorder sheet through its commit and does not run its onDone against the screen it left: ' + JSON.stringify(r));
    }
  }],
  ["«Tomorrow's workout, today» keeps its Undo", async ({ page, ev, today, toastNow, reset, A }) => {
    // ── «Tomorrow's workout, today» keeps its Undo ──────────────────────────────
    // The toast was raised BEFORE navigate('session-day'), and navigate() hides
    // any toast it finds. v397: the toast read null on session-day.
    {
      await ev(({ A, today }) => {
        const dow = new Date(today + 'T12:00:00').getDay();
        DB.plan.setRotation({ cycle: [{ name: 'QA anyway', exerciseIds: [A] }], trainingDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== dow), anchor: addDaysISO(today, -14) });
        DB.plan.setRest(new Date(), false); DB.plan.setExtra(new Date(), false);
      }, { A, today });
      await reset('home');
      await page.locator('.view.active #home-train-anyway').click();
      await page.locator('#rest-sheet-overlay [data-pick="full"]').click();
      await page.locator('#rest-sheet-overlay [data-go]').click();
      await page.waitForFunction(() => currentView === 'session-day', null, { timeout: 2000 });
      const tt = await toastNow();
      assert.deepEqual(tt, { msg: await ev(() => t('anyway_moved')), undo: true }, 'pulling tomorrow forward offers its Undo on the screen it lands on: ' + JSON.stringify(tt));
      await page.locator('.toast.show .toast-action').click();
      assert.deepEqual(await ev(() => [DB.plan.isExtra(new Date()), currentView]), [false, 'home'], 'and the Undo puts the rotation back');
    }
  }],
  ["a back arrow goes BACK", async ({ page, ev, reset, A, B, rotation }) => {
    // ── a back arrow goes BACK ──────────────────────────────────────────────────
    // Child screens navigated forward to a fixed view: from Program the planner's
    // arrow landed on Home, from the exercise browser «My exercises» landed on
    // Program, each a history entry deeper. v397: ['home', 4].
    {
      await rotation('QA back', [A, B]);
      await reset('workouts');
      await page.locator('.view.active [data-goto="planner"]').first().click();
      let depth = await ev(() => navStack.length);
      await page.locator('.view.active .back-btn').first().click();
      let at = await ev(() => [currentView, navStack.length]);
      assert.deepEqual(at, ['workouts', depth - 1], 'the planner\'s back arrow returns to Program and pops its entry: ' + JSON.stringify(at));
      await page.locator('.view.active [data-vault-action]').click();
      await page.locator('.view.active [data-goto="custom-exercises"]').click();
      depth = await ev(() => navStack.length);
      await page.locator('.view.active .back-btn').first().click();
      at = await ev(() => [currentView, navStack.length]);
      assert.deepEqual(at, ['exercises', depth - 1], '«My exercises»\' back arrow returns to the exercise browser: ' + JSON.stringify(at));
      // The food log is opened from a past day as well as from Food; its arrow
      // went to Food whichever way the user came. Finisher, on the tree before
      // its fix: ['food', 4].
      const past = await ev(() => { const d = addDaysISO(todayISO(), -3); DB.foodLogs.add(d, { name: 'QA day food', servings: 1, calories: 100 }); return d; });
      await reset('home');
      await ev((d) => navigate('day', { dayDate: d }), past);
      await page.locator('.view.active .day-section [data-goto="foodlog"]').click();
      assert.deepEqual(await ev(() => [currentView, viewContext.foodLog && viewContext.foodLog.date]), ['foodlog', past], 'setup: «Open» on a past day lands on that day\'s food log');
      depth = await ev(() => navStack.length);
      await page.locator('.view.active .back-btn').first().click();
      at = await ev(() => [currentView, navStack.length]);
      assert.deepEqual(at, ['day', depth - 1], 'the food log\'s back arrow returns to the day it was opened from: ' + JSON.stringify(at));
    }
  }],
  ["a plan day's name reads in Arabic wherever it is printed", async ({ ev, today, A, B }) => {
    // ── a plan day's name reads in Arabic wherever it is printed ────────────────
    // planDayName() translated Program and the planner; Home's hero, session-day,
    // the run, its summary, the day view and the slot editor printed the stored
    // «Push». v397: every one of them 'Push', and the reminder too.
    {
      const got = await ev(({ A, B, today }) => {
        DB.prefs.setLang('ar'); applyLang('ar'); DB.prefs.setExNames('translit');
        DB.plan.setRotation({ cycle: [{ name: 'Push', exerciseIds: [A, B] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today });
        for (const id of [A, B]) DB.sessions.listByExercise(id).filter((s) => s.date === today).forEach((s) => DB.sessions.remove(s.id));
        const txt = (sel) => { const el = document.querySelector('.view.active ' + sel); return el ? el.textContent.trim() : '(none)'; };
        const out = { want: PLAN_DAY_AR.Push };
        navigate('home'); out.home = txt('.hero-title');
        navigate('session-day', { date: today }); out.sessionDay = txt('.page-title');
        navigate('day', { dayDate: today }); out.day = txt('.page-subtitle');
        navigate('session-run', { date: today }); out.run = txt('.detail-top-title');
        navigate('session-run', { date: today, runView: 'summary' }); out.summary = txt('.page-subtitle').split(' · ').pop();
        navigate('planner'); openSlotEditorModal(0);
        out.slotEditor = (document.querySelector('#modal-root .modal-title') || { textContent: '(none)' }).textContent.trim();
        closeModal();
        out.reminder = DB.notif.text({ channel: 'train', date: today, payload: { name: 'Push', n: 2 } }).title.includes(PLAN_DAY_AR.Push);
        DB.prefs.setLang('en'); applyLang('en');
        return out;
      }, { A, B, today });
      const w = got.want;
      assert.deepEqual(got, { want: w, home: w, sessionDay: w, day: w, run: w, summary: w, slotEditor: w, reminder: true }, 'a built-in day name reads in Arabic on every screen that prints it, and in the training reminder: ' + JSON.stringify(got));
    }
  }],
  ["the Arabic search folds hamza, alef, taa marbuta and yaa", async ({ page, ev, today, reset, A, rotation }) => {
    // ── the Arabic search folds hamza, alef, taa marbuta and yaa ────────────────
    // exMatchesQuery only lowercased: «إنكلاين» found the incline lifts and the
    // bare-alef «انكلاين» — how most people type it — found none, in the browser
    // and in the swap sheet. v397: 'DB.search.fold is not a function', 0 hits, 0 rows.
    {
      const fold = await ev(() => (typeof DB.search.fold !== 'function' ? 'DB.search.fold is not a function' : [
        DB.search.fold('إنكلاين') === DB.search.fold('انكلاين'),
        DB.search.fold('آلة') === DB.search.fold('الة'),
        DB.search.fold('مَقْعَد'),
        DB.search.fold('بــنش'),
        DB.search.fold('تمرينة') === DB.search.fold('تمرينه'),
        DB.search.fold('على') === DB.search.fold('علي'),
        DB.search.fold('ٱلظهر') === DB.search.fold('الظهر'),
        DB.search.normalize('فراخ') === DB.search.normalize('دجاج'),   // normalize still carries the food synonyms…
        DB.search.fold('فراخ') === DB.search.fold('دجاج'),             // …and the fold does not: they are food, not exercises
      ]));
      assert.deepEqual(fold, [true, true, 'مقعد', 'بنش', true, true, true, true, false], 'DB.search.fold is the one character fold, and normalize is fold plus the food synonyms: ' + JSON.stringify(fold));
      await ev(() => { DB.prefs.setLang('ar'); applyLang('ar'); });
      await reset('exercises');
      await page.locator('.view.active #workout-search-open').click();
      await page.locator('.view.active #workout-search').fill('انكلاين');
      await page.waitForTimeout(400);   // the grid's 150 ms debounce, then its repaint
      const hits = await ev(() => [...document.querySelectorAll('.view.active #workout-grid [data-exercise]')].map((c) => c.textContent));
      assert.ok(hits.length > 0 && hits.every((h) => /إنكلاين/.test(h)), 'the bare-alef «انكلاين» finds the incline lifts, which are spelled with a hamza: ' + hits.length + ' hits');
      await rotation('QA swap', [A]);
      await ev(({ today }) => { hideToast(); navigate('session-run', { date: today }); }, { today });
      await page.locator('.view.active [data-ex-menu]').click();
      await page.locator('#modal-root [data-swap]').click();
      await page.locator('#swap-search').fill('انكلاين');
      await page.waitForTimeout(400);   // the swap list's 150 ms debounce
      assert.ok(await ev(() => document.querySelectorAll('#swap-list [data-pick]').length) > 0, 'and so does the swap sheet, through the same matcher');
      await ev(() => { closeModal(); DB.prefs.setLang('en'); applyLang('en'); });
    }
  }],
  ["the 30-day volume is in the unit it is labelled with", async ({ ev, ids }) => {
    // ── the 30-day volume is in the unit it is labelled with ────────────────────
    // It summed stored kilograms and printed them beside «lb». v397: '500' lb for 1,102.
    {
      const r = await ev((id) => {
        DB.sessions.add({ exerciseId: id, date: todayISO(), sets: [{ reps: 10, weight: 50 }] });   // a volume of its own, whatever ran before
        DB.prefs.setUnit('lb');
        navigate('compare');
        const since = addDaysISO(todayISO(), -30);
        let kg = 0;
        DB.sessions.listAll().filter((s) => s.date >= since).forEach((s) => (s.sets || []).forEach((x) => { kg += (Number(x.weight) || 0) * (Number(x.reps) || 0); }));
        const out = {
          shown: (document.querySelector('.view.active .pg-mini-value') || {}).textContent,
          unit: (document.querySelector('.view.active .pg-mini-unit') || {}).textContent,
          want: fmtNum(Math.round(kg * KG_TO_LB)), kg: fmtNum(Math.round(kg)),
        };
        DB.prefs.setUnit('kg');
        return out;
      }, ids[24]);
      assert.notEqual(r.kg, r.want, 'setup: there is a volume to convert');
      assert.deepEqual([r.shown, r.unit], [r.want, 'lb'], 'the 30-day volume is converted to the unit printed beside it: ' + JSON.stringify(r));
    }
  }],
  ["the one-day view: the day's sleep as a clock reading, in the user's units", async ({ ev }) => {
    // ── the one-day view: the day's sleep as a clock reading, in the user's units ──
    // It showed the FIRST entry as «7 h» (a hard-coded English unit, a decimal the
    // owner has banned) where Home adds the night and the nap; its weight was
    // «80 kg» under the lb preference; and a built-in cardio type kept its
    // English label in the Arabic UI. v397: sleep '7 h', weight '80 kg', cardio false.
    {
      const r = await ev(() => {
        const d = addDaysISO(todayISO(), -2);
        DB.prefs.setUnit('lb');
        DB.sleep.list().filter((s) => s.date === d).forEach((s) => DB.sleep.remove(s.id));
        DB.sleep.add({ date: d, sleepTime: '23:00', wakeTime: '06:00' });   // the night: 7:00
        DB.sleep.add({ date: d, sleepTime: '14:00', wakeTime: '15:30' });   // and a nap: 1:30
        DB.bodyweight.log(d, 80);
        DB.cardio.list().filter((c) => c.date === d).forEach((c) => DB.cardio.remove(c.id));
        DB.cardio.add({ type: 'walking', date: d, duration: 30, calories: 0 });
        navigate('day', { dayDate: d });
        const stats = Object.fromEntries([...document.querySelectorAll('.view.active .day-stat')].map((s) => [s.querySelector('.day-stat-label').textContent.trim(), s.querySelector('.day-stat-value').textContent.trim()]));
        const out = { sleep: stats[t('sleep')], weight: stats[t('day_weight')], wantWeight: fmtWeight(80) + ' lb' };
        DB.prefs.setUnit('kg');
        DB.prefs.setLang('ar'); applyLang('ar');
        navigate('day', { dayDate: d });
        out.cardio = [...document.querySelectorAll('.view.active .day-row-name')].map((n) => n.textContent.trim()).includes(t('walking'));
        DB.prefs.setLang('en'); applyLang('en');
        return out;
      });
      assert.deepEqual([r.sleep, r.weight, r.cardio], ['8:30', r.wantWeight, true], 'the day view adds every sleep entry as H:MM, shows the weight in the preferred unit and names a built-in cardio in the UI language: ' + JSON.stringify(r));
    }
  }],
  ["the conflict dialog runs ONE choice", async ({ page, ev, reset }) => {
    // ── the conflict dialog runs ONE choice ─────────────────────────────────────
    // run() disabled only the card that was tapped, so «keep this device» and
    // «keep the cloud» could run together and leave the two copies opposite
    // while saying «Synced». v397: {calls:{local:1,cloud:1}} — both ran.
    {
      await reset('settings');
      await ev(() => {
        window.qaCalls = { local: 0, cloud: 0 };
        Cloud.chooseLocal = () => { window.qaCalls.local++; return new Promise((res) => { window.qaResolveLocal = res; }); };
        Cloud.chooseCloud = async () => { window.qaCalls.cloud++; return 'ok'; };
        showConflictDialog();
      });
      await page.locator('#modal-root [data-keep="local"]').click();
      await page.locator('#modal-root [data-keep="cloud"]').click({ force: true });   // the thumb that changed its mind does not wait for an enabled button
      const mid = await ev(() => ({ calls: Object.assign({}, window.qaCalls), disabled: [...document.querySelectorAll('#modal-root .choice[data-keep]')].map((b) => b.disabled) }));
      assert.deepEqual(mid, { calls: { local: 1, cloud: 0 }, disabled: [true, true] }, 'the first choice disables both cards and the second tap starts nothing: ' + JSON.stringify(mid));
      await ev(() => window.qaResolveLocal('failed'));
      await page.waitForFunction(() => [...document.querySelectorAll('#modal-root .choice[data-keep]')].every((b) => !b.disabled), null, { timeout: 2000 });
      await page.locator('#modal-root [data-keep="cloud"]').click();
      await page.waitForFunction(() => !document.querySelector('#modal-root .choice[data-keep]'), null, { timeout: 2000 });
      assert.deepEqual(await ev(() => window.qaCalls), { local: 1, cloud: 1 }, 'a failed choice gives both cards back, and the other one then runs once');
      await ev(() => { delete Cloud.chooseLocal; delete Cloud.chooseCloud; hideToast(); });
    }
  }],
  ["boot-time sheets: the weekly review opens on Home over nothing", async ({ ev, ids }) => {
    // ── boot-time sheets: the weekly review opens on Home over nothing ──────────
    // It rose at load + 400 ms over whatever the user had already reached (the tap
    // meant for «الوضع الموجّه» closed it), spent its once-a-week stamp there, and
    // replaced dialogs that must be answered — one #modal-root, one innerHTML.
    // v397: every probe {review:true, spent:true}; a lesser openModal replaced
    // the conflict dialog (refused:false, conflictUp:false).
    {
      await ev(({ id }) => { const r = weekRanges(); DB.sessions.add({ exerciseId: id, date: isoOf(r.lastStart), sets: [{ reps: 8, weight: 60 }] }); }, { id: ids[22] });
      const probe = (setup) => ev((setup) => {
        try { closeModal(); } catch (_) {}
        document.querySelectorAll('.qa-gate, .app > .sheet-overlay').forEach((g) => g.remove());
        DB.prefs.setReviewSeen(null); DB.prefs.setReviewOff(false);
        navStack = [{ view: 'home', context: {} }];
        navigate('home', {}, { fromPop: true });
        if (setup === 'elsewhere') navigate('session-day', { date: todayISO() });
        if (setup === 'held') { Cloud.chooseLocal = () => new Promise(() => {}); showConflictDialog(); }
        if (setup === 'unreadable') { __storageAlerted = false; showUnreadableDialog(); }
        if (setup === 'gate') { const g = document.createElement('div'); g.className = 'auth-gate qa-gate'; document.body.appendChild(g); }
        if (setup === 'sheet') openRestSheet();
        const before = DB.prefs.reviewSeen();
        openWeeklyReview();
        const top = document.querySelector('#modal-root .modal-overlay:not(.is-out)');
        const out = { review: !!document.querySelector('#modal-root #wr-done'), spent: DB.prefs.reviewSeen() !== before };
        if (setup === 'held' || setup === 'unreadable') out.stillUp = !!(top && top.querySelector(setup === 'held' ? '.choice[data-keep]' : '[data-ok]'));
        document.querySelectorAll('.qa-gate, .app > .sheet-overlay').forEach((g) => g.remove());
        try { closeModal(); } catch (_) {}
        delete Cloud.chooseLocal;
        return out;
      }, setup);
      const where = { elsewhere: 'the user already on another screen', gate: 'a gate up', sheet: 'a sheet open' };
      for (const setup of ['elsewhere', 'gate', 'sheet']) {
        const got = await probe(setup);
        assert.deepEqual(got, { review: false, spent: false }, `the weekly review does not open — nor spend its week — with ${where[setup]}: ` + JSON.stringify(got));
      }
      for (const setup of ['held', 'unreadable']) {
        const got = await probe(setup);
        assert.deepEqual(got, { review: false, spent: false, stillUp: true }, `the weekly review never replaces the ${setup === 'held' ? 'conflict' : 'unreadable-storage'} dialog: ` + JSON.stringify(got));
      }
      assert.deepEqual(await probe('home'), { review: true, spent: true }, 'on Home with nothing open it opens, once');
      // …and no lesser sheet may replace a must-answer dialog, whoever opens it;
      // one must-answer dialog may replace another (the duplicate hold's stages).
      const held = await ev(() => {
        Cloud.chooseLocal = () => new Promise(() => {});
        showConflictDialog();
        const lesser = openModal('<div class="modal-title">QA lesser</div>');
        const out = { refused: lesser === null, conflictUp: !!document.querySelector('#modal-root .choice[data-keep]') };
        closeModal(); delete Cloud.chooseLocal;
        showDuplicateAccountDialog();
        document.getElementById('dup-account-continue').click();
        out.stage2 = !!document.getElementById('dup-account-release');
        document.getElementById('dup-account-back').click();
        out.stage1 = !!document.getElementById('dup-account-signout');
        closeModal(); __duplicateHeld = false;
        return out;
      });
      assert.deepEqual(held, { refused: true, conflictUp: true, stage2: true, stage1: true }, 'openModal refuses to put a lesser sheet over a must-answer dialog, and the hold\'s own two stages still replace each other: ' + JSON.stringify(held));
    }
  }],
  ["the review's improvement line", async ({ ev, ids }) => {
    // ── the review's improvement line ───────────────────────────────────────────
    // weekRanges() returns Dates; addDaysISO() got one and returned 'NaN-NaN-NaN',
    // so the «rose by» line never rendered — and an exclusive end at lastStart - 1
    // would have dropped the week before's last day anyway, which is where the
    // earlier figure is seeded. v397: only «1 of 7 sessions» and the suggestion.
    {
      const r = await ev(({ id }) => {
        try { closeModal(); } catch (_) {}
        const { lastStart } = weekRanges();
        const dayBefore = new Date(lastStart); dayBefore.setDate(dayBefore.getDate() - 1);
        DB.sessions.listByExercise(id).forEach((s) => DB.sessions.remove(s.id));
        DB.sessions.add({ exerciseId: id, date: isoOf(dayBefore), sets: [{ reps: 5, weight: 20 }] });
        DB.sessions.add({ exerciseId: id, date: isoOf(lastStart), sets: [{ reps: 5, weight: 200 }] });
        DB.prefs.setReviewSeen(null); DB.prefs.setReviewOff(false);
        navStack = [{ view: 'home', context: {} }];
        navigate('home', {}, { fromPop: true });
        openWeeklyReview();
        const lines = [...document.querySelectorAll('#modal-root .wr-line')].map((l) => l.textContent.trim());
        closeModal();
        return { lines, name: exDisplayName(DB.exercises.getById(id)) };
      }, { id: ids[23] });
      assert.ok(r.lines.some((l) => l.includes(r.name)), 'the weekly review names its one comparable improvement, the figure from the last day of the week before included: ' + JSON.stringify(r.lines));
    }
  }],
  ["a time picked in the supplement sheet is the time saved", async ({ page, ev, reset }) => {
    // ── a time picked in the supplement sheet is the time saved ─────────────────
    // times[] was filled by «أضف وقتاً» alone, so a time set and saved became a
    // supplement with no reminder. v397: {times:[], doses:[]}.
    {
      await reset('supplements');
      await page.locator('.view.active #add-supp-btn').click();
      await page.locator('#supp-name').fill('QA reminder supp');
      await page.locator('#supp-time-input').fill('21:30');
      await page.locator('#supp-save').click();
      const r = await ev(() => { const s = DB.supplements.list().find((x) => x.name === 'QA reminder supp'); return { times: s ? s.times : null, doses: DB.notif.get().channels.supps.doses.filter((d) => s && d.suppId === s.id).map((d) => d.at) }; });
      assert.deepEqual(r, { times: ['21:30'], doses: ['21:30'] }, 'the picked time is saved with the supplement and armed: ' + JSON.stringify(r));
      await page.locator('.view.active #add-supp-btn').click();
      await page.locator('#supp-name').fill('QA quiet supp');
      await page.locator('#supp-save').click();
      assert.deepEqual(await ev(() => (DB.supplements.list().find((x) => x.name === 'QA quiet supp') || {}).times), [], 'and the field\'s own 08:00 is a default, not a choice: an untouched field adds no reminder');
      await ev(() => hideToast());
    }
  }],
  ["deleting a custom exercise takes its photo off the server", async ({ page, ev, reset }) => {
    // ── deleting a custom exercise takes its photo off the server ───────────────
    // Both delete paths removed the exercise locally and left {uid}/{id}.jpg in
    // the bucket for good; and the exercise page's delete left that page on the
    // stack, so Back landed on «Not found». v397: removed [], back 'exercise-detail'.
    {
      await ev(() => { window.qaRemoved = []; Cloud.removeExerciseImage = async (p) => { window.qaRemoved.push(p); return true; }; });
      await reset('workouts');
      const one = await ev(() => { const ex = DB.exercises.add({ name: 'QA photo one', category: 'Chest', imagePath: 'qa/one.jpg' }); navigate('exercise-detail', { exerciseId: ex.id }); return ex.id; });
      await page.locator('.view.active #delete-exercise-btn').click();
      await page.locator('#modal-root [data-ok]').click();
      await page.waitForFunction(() => window.qaRemoved.length >= 1, null, { timeout: 2000 }).catch(() => {});
      const afterPage = await ev((one) => { const gone = !DB.exercises.getById(one); goBack(); return { gone, removed: window.qaRemoved.slice(), back: currentView }; }, one);
      assert.deepEqual(afterPage, { gone: true, removed: ['qa/one.jpg'], back: 'home' }, 'the exercise page\'s delete removes the photo from the bucket, and Back does not return to the deleted page: ' + JSON.stringify(afterPage));
      await reset('custom-exercises');
      const two = await ev(() => { const ex = DB.exercises.add({ name: 'QA photo two', category: 'Chest', imagePath: 'qa/two.jpg' }); renderView('custom-exercises'); return ex.id; });
      await page.locator(`.view.active [data-edit-custom="${two}"]`).click();
      await page.locator('#delete-exercise-sheet-btn').click();
      await page.locator('#modal-root .confirm-dialog [data-ok]').click();
      await page.waitForFunction(() => window.qaRemoved.length >= 2, null, { timeout: 2000 }).catch(() => {});
      assert.deepEqual(await ev((two) => [!DB.exercises.getById(two), window.qaRemoved.slice()], two), [true, ['qa/one.jpg', 'qa/two.jpg']], 'and so does the edit sheet\'s delete');
      await ev(() => { delete Cloud.removeExerciseImage; hideToast(); });
    }
  }],
  ["a pull that brings an existing account clears the first-run card", async ({ page, origin }) => {
    // ── a pull that brings an existing account clears the first-run card ───────
    // init() decides from the local store before any pull, so a fresh device
    // showed onboarding under the login card and kept it after the account's own
    // data arrived. v397: {gate:true, onboarded:false, sessions:1}.
    {
      const ctx2 = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
      const p2 = await ctx2.newPage();
      const errs = [];
      p2.on('pageerror', (e) => errs.push(e.message));
      await p2.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
      await p2.goto(origin + '/');
      await p2.waitForFunction(() => typeof navigate === 'function' && window.__vltReady);
      assert.equal(await p2.evaluate(() => !!document.getElementById('onboard-gate')), true, 'setup: a fresh install shows the first-run card');
      const got = await p2.evaluate(async () => {
        const blob = JSON.parse(DB.exportJSON());
        blob.sessions = [{ id: 'qa-pulled-1', exerciseId: blob.exercises[0].id, date: todayISO(), sets: [{ reps: 5, weight: 50 }], createdAt: new Date().toISOString() }];
        Cloud.resolveOnLogin = async () => { DB.importJSON(JSON.stringify(blob)); return 'pulled'; };
        await afterLogin();
        return { gate: !!document.getElementById('onboard-gate'), onboarded: DB.prefs.onboarded(), sessions: DB.sessions.listAll().length };
      });
      assert.deepEqual(got, { gate: false, onboarded: true, sessions: 1 }, 'signing in to an account with history clears the first-run card and flags the device onboarded: ' + JSON.stringify(got));
      assert.deepEqual(errs, []);
      await ctx2.close();
    }
  }],
  ["the widget's launch url is spent once per launch", async ({ page, origin }) => {
    // ── the widget's launch url is spent once per launch ───────────────────────
    // getLaunchUrl() returns the ORIGINAL launch for the life of the Activity
    // (@capacitor/android Bridge.java assigns intentUri once, in its constructor;
    // onNewIntent never touches it), and the replay guard was in memory — so the
    // post-release reload, the account-switch reload and the resume banner each
    // ran the widget's action again. v397: 250 ml became 500 on one reload.
    {
      const ctx3 = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
      await ctx3.addInitScript(() => {
        const on = {};
        window.qaAppListeners = on;
        window.Capacitor = { Plugins: { App: {
          addListener(name, fn) { (on[name] = on[name] || []).push(fn); return { remove() {} }; },
          getLaunchUrl: async () => ({ url: 'thevault://quick/water250' }),
          exitApp() {},
        } } };
      });
      const p3 = await ctx3.newPage();
      const errs = [];
      p3.on('pageerror', (e) => errs.push(e.message));
      await p3.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
      const water = () => p3.evaluate(() => DB.water.get(todayISO()));
      await p3.goto(origin + '/');
      await p3.waitForFunction(() => typeof navigate === 'function' && DB.water.get(todayISO()) === 250, null, { timeout: 6000 });
      await p3.reload();
      await p3.waitForFunction(() => typeof navigate === 'function' && window.__vltReady);
      await p3.waitForTimeout(1500);   // past load + 400 ms, when the launch url is read
      assert.equal(await water(), 250, 'a reload inside the same launch does not pour the widget\'s cup again');
      await p3.evaluate(() => (window.qaAppListeners.appUrlOpen || []).forEach((fn) => fn({ url: 'thevault://quick/water250' })));
      assert.equal(await water(), 500, 'and a later widget tap, which arrives through appUrlOpen, is a new cup');
      assert.deepEqual(errs, []);
      await ctx3.close();
    }
  }],
  ["the permission sheet repaints the screen it was opened from", async ({ page, ev, reset, sheetUp }) => {
    // ── the permission sheet repaints the screen it was opened from ────────────
    // Its «allow» repainted Home, so opened from the reminders page it left that
    // page stale behind it. v397: renders ['home'].
    {
      await reset('notifications');
      await ev(() => {
        STATE.notif = Object.assign(DB.notif.get(), { asked: false });
        window.qaRenders = [];
        window.qaRenderView = renderView;
        window.renderView = function (v) { window.qaRenders.push(v); return window.qaRenderView.apply(this, arguments); };
        openNotifPermSheet();
      });
      await sheetUp();
      await page.locator('#notif-perm-overlay [data-allow]').click();
      await page.waitForFunction(() => window.qaRenders.length > 0, null, { timeout: 2000 }).catch(() => {});
      const renders = await ev(() => { window.renderView = window.qaRenderView; return window.qaRenders.slice(); });
      assert.deepEqual(renders, ['notifications'], 'allowing reminders repaints the screen the sheet was opened from: ' + JSON.stringify(renders));
    }
  }],
];

async function routerHome(page) {
  const kit = await routerHomeKit(page);
  for (const [, run] of routerHomeCases) await run(kit);
  const { ev } = kit;
  await ev(() => { closeModal(); hideToast(); DB.prefs.setLang('en'); applyLang('en'); DB.prefs.setUnit('kg'); navigate('home'); });
  console.log('PASS router, Home and the notices (v398): Back and Escape close the five .app sheets through their own close, a navigation commits the reorder, the pulled-forward day keeps its Undo, back arrows go back, day names in Arabic, the Arabic fold, the volume and the day view in the user\'s units, one conflict choice, the review on Home over nothing and never over a must-answer dialog, its improvement line, the picked supplement time, the photo off the bucket, onboarding cleared by a pull, the widget url spent once, the permission sheet repaints its own screen');
}


// ---- batches 5 and 8 · DESIGN SYSTEM, ACCESSIBILITY, THE MUSCLE HISTORY ------
// Every case below FAILED on v398 before its fix, and what it printed there is
// quoted beside it. Clicks and keys are Playwright's (hit-tested, trusted), so
// focus moves the way it moves for a keyboard, a switch or TalkBack.
async function designA11yKit(page) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 6000 });
  await ev(() => {
    closeModal(); hideToast(); DB.notif.setAsked(); DB.prefs.setUnit('kg'); DB.prefs.setLang('en'); applyLang('en');
    DB.prefs.setTextLg(false); document.body.classList.remove('text-lg');
    // Food opens the calculator over itself while no calorie goal is set.
    if (!(DB.nutrition.get().targets || {}).calories) DB.nutrition.setTargets({ calories: 2000, protein: 120, carbs: 220, fat: 60 });
  });
  const reset = (view, ctx) => ev(({ view, ctx }) => {
    try { closeModal(); } catch (_) {}
    hideToast();
    document.querySelectorAll('.app > .sheet-overlay').forEach((s) => s.remove());
    navStack = [{ view: 'home', context: {} }];
    navigate('home', {}, { fromPop: true });
    if (view !== 'home') navigate(view, ctx);
  }, { view: view || 'home', ctx: ctx || {} });
  // Where focus is, spelled the way the failure messages print it.
  const focusAt = (sel) => ev((sel) => {
    const a = document.activeElement, o = sel && document.querySelector(sel);
    const at = !a || a === document.body ? 'body' : a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (typeof a.className === 'string' && a.className.trim() ? '.' + a.className.trim().split(/\s+/)[0] : '');
    return { inside: !!o && o.contains(a), at };
  }, sel);
  const frame = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const sheetOpen = () => page.waitForFunction(() => { const s = document.querySelector('.app > .sheet-overlay'); return !!s && s.classList.contains('open'); }, null, { timeout: 2000 });
  const ids = await ev(() => DB.exercises.list().filter((e) => !e.isCustom).map((e) => e.id));
  const today = await ev(() => todayISO());
  await ev(({ ids, today }) => DB.plan.setRotation({ cycle: [{ name: 'QA a11y', exerciseIds: ids.slice(30, 33) }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: today }), { ids, today });
  return { page, ev, reset, focusAt, frame, sheetOpen, ids, today };
}

const designA11yCases = [
  ['an [autofocus] sheet takes focus on every opening', async ({ page, ev, reset, focusAt, frame }) => {
    // HTML honours [autofocus] once per document, and openModal skipped its own
    // focus whenever a sheet carried one — so once any sheet had spent the flag,
    // focus stayed behind every later one. v398: the supplement sheet
    // ["button#add-supp-btn.btn" x3], the manual-food sheet ["body","body"], and
    // a forward Tab from outside went to button.nav-btn (only Shift+Tab was
    // pulled back in).
    await reset('supplements');
    const supp = [];
    for (let i = 0; i < 3; i++) {
      await page.locator('#add-supp-btn').click();
      await page.waitForSelector('#modal-root .modal-overlay #supp-name');
      await frame();
      supp.push((await focusAt('#modal-root .modal-overlay')).at);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay:not(.is-out)'));
    }
    assert.deepEqual(supp, ['input#supp-name', 'input#supp-name', 'input#supp-name'], 'every opening of the supplement sheet lands on its name field: ' + JSON.stringify(supp));
    await reset('food');
    const mf = [];
    for (let i = 0; i < 2; i++) {
      await ev(() => openManualFoodEntry(todayISO(), () => {}));
      await page.waitForSelector('#modal-root #mf-name');
      await frame();
      mf.push((await focusAt('#modal-root .modal-overlay')).at);
      await ev(() => closeModal());
    }
    assert.deepEqual(mf, ['input#mf-name', 'input#mf-name'], 'the manual-food sheet lands on its name field every time: ' + JSON.stringify(mf));
    // Focus put outside an open sheet: a forward Tab comes back in, as Shift+Tab did.
    await ev(() => openManualFoodEntry(todayISO(), () => {}));
    await page.waitForSelector('#modal-root #mf-name');
    await ev(() => document.querySelector('#bottom-nav .nav-btn').focus());
    await page.keyboard.press('Tab');
    const tab = await focusAt('#modal-root .modal-overlay');
    await ev(() => closeModal());
    assert.ok(tab.inside, 'a Tab pressed with focus outside the open sheet lands inside it, not on the page behind: ' + tab.at);
  }],

  ['the five sheets on .app take focus, keep it, and give it back', async ({ page, ev, reset, focusAt, frame, sheetOpen }) => {
    // Built outside openModal, they had none of its focus handling. v398, all
    // five: {"opened":false,"out":["Tab → button.nav-btn",…]} — focus left on
    // the opener and Tab walking the page behind — and after Escape focus was
    // on body, or wherever the Tabs had left it (rest: button.vault-action).
    const got = {}, want = {};
    for (const name of ['add-sheet', 'rest', 'train-anyway', 'reorder', 'notif-perm']) {
      await reset({ 'add-sheet': 'food', 'notif-perm': 'notifications' }[name] || 'home');
      let anchor = 'button#food-fab.food-fab';
      if (name === 'add-sheet') await page.locator('#food-fab').click();
      else {
        anchor = await ev((name) => {
          const a = document.querySelector('#bottom-nav .nav-btn');
          a.focus();
          if (name === 'notif-perm') STATE.notif = Object.assign(DB.notif.get(), { asked: false });
          ({ rest: () => openRestSheet(), 'train-anyway': () => openTrainAnywaySheet(),
            reorder: () => openReorderSheet(0, () => {}), 'notif-perm': () => openNotifPermSheet() })[name]();
          return 'button.' + a.className.trim().split(/\s+/)[0];
        }, name);
      }
      await sheetOpen();
      await frame();
      const r = { opened: (await focusAt('.app > .sheet-overlay')).inside, out: [] };
      for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
        await page.keyboard.press(key);
        const f = await focusAt('.app > .sheet-overlay');
        if (!f.inside) r.out.push(key + ' → ' + f.at);
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.app > .sheet-overlay'), null, { timeout: 1500 }).catch(() => {});
      r.gone = await ev(() => !document.querySelector('.app > .sheet-overlay'));
      r.back = (await focusAt(null)).at;
      r.out = r.out.slice(0, 3);
      got[name] = r;
      want[name] = { opened: true, out: [], gone: true, back: anchor };
    }
    assert.deepEqual(got, want, 'each .app sheet moves focus in, keeps Tab and Shift+Tab inside, and hands focus back to its opener on Escape: ' + JSON.stringify(got));
    // A repaint inside a sheet keeps focus in it: the reorder arrows rebuild the
    // list, and the rest sheet's second step replaces the first. v398:
    // {"reorder":{"inside":false,"at":"body"},"rest":false}.
    const repaint = {};
    await reset('home');
    await ev(() => { document.querySelector('#bottom-nav .nav-btn').focus(); openReorderSheet(0, () => {}); });
    await sheetOpen();
    await ev(() => document.querySelector('#reorder-sheet-overlay [data-ro="0"][data-dir="1"]').focus());
    await page.keyboard.press('Enter');
    repaint.reorder = await focusAt('#reorder-sheet-overlay');
    await page.keyboard.press('Escape');
    await reset('home');
    await ev(() => { document.querySelector('#bottom-nav .nav-btn').focus(); openRestSheet(); });
    await sheetOpen();
    await ev(() => document.querySelector('#rest-sheet-overlay [data-rest="minimum"]').focus());
    await page.keyboard.press('Enter');
    repaint.rest = (await focusAt('#rest-sheet-overlay')).inside;
    await page.keyboard.press('Escape');
    assert.deepEqual(repaint, { reorder: { inside: true, at: 'button' }, rest: true }, 'a sheet that repaints itself keeps focus inside it (the moved row\'s arrow; the new step): ' + JSON.stringify(repaint));
  }],

  ['every field in a sheet is named by its caption, not its placeholder', async ({ page, ev, reset, ids, today }) => {
    // The captions are sibling <label class="form-label"> tags with no for= and
    // no wrapping, so TalkBack read the date field as «edit box» and the calorie
    // field as «edit box, 165». v398 printed 44 fields, first: session-new
    // input#session-date "", session-new input[number] "PLACEHOLDER:0",
    // new-exercise select#ex-category "", food-new input#food-cal
    // "PLACEHOLDER:165" … change-password input#cpw-confirm, notifications
    // input[ntfs-time] "".
    const sheets = [
      ['session-new', 'openSessionModal', [ids[0]], 'exercise-detail', { exerciseId: ids[0] }],
      ['new-exercise', 'openNewExerciseModal', [null], 'exercises'],
      ['cardio-new', 'openCardioModal', [], 'cardio'],
      ['cardio-type-new', 'openNewCardioTypeModal', ['$noop'], 'cardio'],
      ['sleep-new', 'openSleepModal', [], 'sleep'],
      ['supplement-new', 'openSupplementModal', [], 'supplements'],
      ['food-new', 'openFoodModal', [], 'food'],
      ['calculator', 'openCalculatorModal', ['$noop'], 'food'],
      ['manual-food', 'openManualFoodEntry', ['$today', '$noop'], 'food'],
      ['food-library', 'openFoodLibraryModal', [], 'food'],
      ['saved-foods', 'openSavedFoodPicker', ['$today', '$noop', 'foods'], 'food'],
      ['recipe-new', 'openRecipeEditor', ['$today', null, '$noop'], 'food'],
      ['shopping', 'openShoppingList', [], 'food'],
      ['slot-editor', 'openSlotEditorModal', [0], 'planner'],
      ['exercise-picker', 'openSlotEditorModal', [0, '$noop'], 'planner'],
      ['time-entry-food', 'openTimeEntryModal', [{ kind: 'food' }, '$noop'], 'notifications'],
      ['feedback', 'showFeedback', [], 'settings'],
      ['change-password', 'showChangePassword', [false], 'settings'],
    ];
    const unnamed = (root) => ev((root) => {
      const accName = (el) => {
        const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
        const lb = el.getAttribute('aria-labelledby');
        if (lb) { const x = lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim(); if (x) return x; }
        if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
        const pl = el.closest('label'); if (pl && pl.textContent.trim()) return pl.textContent.trim();
        if (el.title) return el.title;
        return el.placeholder ? 'PLACEHOLDER:' + el.placeholder : '';
      };
      // the top-most one: a sheet that is leaving lingers under the next for its exit
      const ov = [...document.querySelectorAll(root)].filter((o) => !o.classList.contains('is-out')).pop();
      if (!ov) return ['(nothing open)'];
      return [...ov.querySelectorAll('input, select, textarea')]
        .filter((el) => el.type !== 'hidden' && el.getClientRects().length)
        .map((el) => { const n = accName(el); return !n || n.startsWith('PLACEHOLDER:') ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '[' + (el.className || el.type) + ']') + ' ' + JSON.stringify(n) : null; })
        .filter(Boolean);
    }, root);
    const bad = [];
    for (const [id, fn, args, host, ctx] of sheets) {
      await reset(host, ctx);
      const threw = await ev(({ fn, args, today }) => {
        try { window[fn].apply(null, args.map((a) => (a === '$noop' ? () => {} : a === '$today' ? today : a))); return null; } catch (e) { return String(e.message); }
      }, { fn, args, today });
      if (threw) { bad.push(id + ' threw ' + threw); continue; }
      (await unnamed('#modal-root .modal-overlay')).forEach((x) => bad.push(id + ' ' + x));
      // The calculator has two modes, each with its own fields: read the other one too.
      if (id === 'calculator' && await page.locator('#modal-root #to-calc, #modal-root #to-manual').count()) {
        await page.locator('#modal-root #to-calc, #modal-root #to-manual').first().click();
        (await unnamed('#modal-root .modal-overlay')).forEach((x) => bad.push(id + ' (other mode) ' + x));
      }
    }
    // The fixed reminder time lives on a view, not in a sheet.
    const mode = await ev(() => { const m = DB.notif.get().channels.train.mode; DB.notif.setChannel('train', { mode: 'fixed' }); return m; });
    await reset('notifications');
    (await unnamed('.view.active')).forEach((x) => bad.push('notifications ' + x));
    await ev((mode) => DB.notif.setChannel('train', { mode }), mode);
    assert.deepEqual(bad, [], 'every visible field is named by its caption (label[for], a wrapping label or aria-label), never by nothing or its placeholder: ' + JSON.stringify(bad));
  }],

  ['a chosen option says so to a screen reader', async ({ page, ev, reset }) => {
    // The option groups marked the choice with a CSS class alone; the theme
    // picker on the same screen used role=radio + aria-checked. v398:
    // {"unit":["kg=null","lb=null"],"textlg":["0=null","1=null"],"lang":[…null],
    // "groups":["null:false" x4],"nav":[],"pills":["All=null",…],
    // "swatches":["null unnamed" x4],"leak":7,"day":[null,null]} — the last two
    // are the schedule sheet binding its day toggle to Home's seven week chips.
    const state = (sel, key) => ev(({ sel, key }) => [...document.querySelectorAll(sel)].map((b) => b.dataset[key] + '=' + (b.getAttribute('aria-checked') || b.getAttribute('aria-pressed'))), { sel, key });
    const got = {};
    await reset('settings');
    await page.locator('.view.active [data-unit="lb"]').click();
    got.unit = await state('.view.active [data-unit]', 'unit');
    await page.locator('.view.active [data-unit="kg"]').click();
    await page.locator('.view.active [data-textlg="1"]').click();
    got.textlg = await state('.view.active [data-textlg]', 'textlg');
    await page.locator('.view.active [data-textlg="0"]').click();
    got.lang = await state('.view.active [data-lang]', 'lang');
    got.groups = await ev(() => [...document.querySelectorAll('.view.active .lang-toggle, .view.active .unit-toggle')].map((g) => g.getAttribute('role') + ':' + !!g.getAttribute('aria-label')));
    got.nav = await ev(() => [...document.querySelectorAll('#bottom-nav .nav-btn')].filter((b) => b.getAttribute('aria-current') === 'page').map((b) => b.dataset.view));
    await reset('exercises');
    await page.locator('.view.active .filter-pill').nth(1).click();
    got.pills = (await state('.view.active .filter-pill', 'filter')).slice(0, 3);
    await reset('supplements');
    await ev(() => openSupplementModal());
    await page.locator('#color-swatches [data-color]').nth(2).click();
    got.swatches = await ev(() => [...document.querySelectorAll('#color-swatches [data-color]')].map((b) => (b.getAttribute('aria-checked') || 'null') + (b.getAttribute('aria-label') ? '' : ' unnamed')).slice(0, 4));
    await reset('planner');
    got.leak = await ev(() => {
      const orig = EventTarget.prototype.addEventListener, bound = [];
      EventTarget.prototype.addEventListener = function (type) { if (type === 'click' && this instanceof Element) bound.push(this); return orig.apply(this, arguments); };
      try { openScheduleModal(WORKOUT_TEMPLATES[0]); } finally { EventTarget.prototype.addEventListener = orig; }
      const ov = document.querySelector('#modal-root .modal-overlay');
      return bound.filter((el) => !ov.contains(el)).length;
    });
    const day = page.locator('#modal-root .schedule-day').first();
    const before = await day.getAttribute('aria-pressed');
    await day.click();
    got.day = [before, await day.getAttribute('aria-pressed')];
    await ev(() => closeModal());
    const want = {
      unit: ['kg=false', 'lb=true'], textlg: ['0=false', '1=true'], lang: ['ar=false', 'en=true'],
      groups: got.groups.map(() => 'radiogroup:true'), nav: ['home'],
      pills: got.pills.map((x, i) => x.split('=')[0] + '=' + (i === 1)), swatches: ['false', 'false', 'true', 'false'],
      leak: 0, day: got.day[0] === 'true' ? ['true', 'false'] : ['false', 'true'],
    };
    assert.deepEqual(got, want, 'each option group names its choice (aria-checked in a named radiogroup, aria-pressed for day toggles, aria-current on the lit tab), and the schedule sheet binds only its own days: ' + JSON.stringify(got));
  }],

  ['a year of one muscle opens on the newest days, the rest on demand', async ({ page, ev, reset, today }) => {
    // renderMuscleSessions drew every session ever logged for the muscle — 526
    // at a year of data: 12,838 nodes, ~1 s a render at 4x CPU, again on every
    // Back. v398: 80 seeded sessions rendered {"first":{"cards":80,"more":false}}.
    const seed = await ev((today) => {
      const exById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
      const byCat = {};
      DB.exercises.list().filter((e) => !e.isCustom).forEach((e) => { (byCat[e.category] = byCat[e.category] || []).push(e.id); });
      const count = {};
      DB.sessions.listAll().forEach((s) => { const c = exById[s.exerciseId] && exById[s.exerciseId].category; if (c) count[c] = (count[c] || 0) + 1; });
      const cat = Object.keys(byCat).filter((c) => byCat[c].length >= 2).sort((a, b) => (count[a] || 0) - (count[b] || 0))[0];
      const made = [];
      for (let d = 1; d <= 40; d++) for (let k = 0; k < 2; k++) made.push(DB.sessions.add({ exerciseId: byCat[cat][k], date: addDaysISO(today, -d), sets: [{ reps: 8, weight: 40 + d }] }).id);
      const mine = DB.sessions.listAll().filter((s) => exById[s.exerciseId] && exById[s.exerciseId].category === cat);
      const perDay = {};
      mine.forEach((s) => { perDay[s.date] = (perDay[s.date] || 0) + 1; });
      let first = 0;
      for (const d of Object.keys(perDay).sort().reverse()) { if (first >= 30) break; first += perDay[d]; }
      return { cat, made, total: mine.length, first };
    }, today);
    await reset('muscle-sessions', { muscleCat: seed.cat });
    const read = () => ev(() => ({ cards: document.querySelectorAll('.view.active .ms-card').length, more: !!document.querySelector('.view.active #ms-show-more') }));
    const got = { first: await read() };
    if (got.first.more) {
      await page.locator('.view.active #ms-show-more').click();
      got.all = await read();
      got.all.focus = await ev(() => !!document.activeElement && document.activeElement.classList.contains('ms-card'));
      await page.locator('.view.active .ms-card').last().click();
      await ev(() => goBack());
      got.back = await read();
    }
    await ev((made) => made.forEach((id) => DB.sessions.remove(id)), seed.made);
    await reset('home');
    assert.deepEqual(got, {
      first: { cards: seed.first, more: true },
      all: { cards: seed.total, more: false, focus: true },
      back: { cards: seed.total, more: false },
    }, `a muscle with ${seed.total} sessions opens on its newest days (${seed.first} cards, no day split) with «show more», which appends the rest, focuses the first new card and survives a Back: ` + JSON.stringify(got));
  }],

  ['every control on the list is at least 44 by 44 where a finger lands', async ({ page, ev, reset, ids, today }) => {
    // ux-audit's reach scan: from the centre outward (26px each way),
    // elementFromPoint must still be the control or its ::after halo. v398, 25
    // entries: .nutri-edit 32x32 reaches 33x33, the water cups 37 tall,
    // .link-btn 37 tall, .weight-row-del 34x34, .set-remove 38x38, #to-calc 32
    // tall, the exercise photo buttons 36, .sfp-tab 36, .bundle-main 42,
    // #rec-servings and #rec-view-servings 52x36, the reorder arrows 40x40,
    // .ntfs-opt 36 tall (the «6» chip 38x36), #day-prev 44x41,
    // .sd-add-set-btn 36, .schedule-prev-row 41.
    const reach = (sel) => ev((sel) => {
      const vw = innerWidth, vh = innerHeight, out = [];
      for (const el of document.querySelectorAll(sel)) {
        if (!el.getClientRects().length || el.disabled) continue;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const own = (h) => !!h && (h === el || el.contains(h));
        const run = (dx, dy) => { let d = 0; for (let k = 1; k <= 26; k++) { const x = cx + dx * k, y = cy + dy * k; if (x < 0 || y < 0 || x >= vw || y >= vh || !own(document.elementFromPoint(x, y))) break; d = k; } return d; };
        if (!own(document.elementFromPoint(cx, cy))) { out.push(sel + ' unhittable'); continue; }
        const w = run(-1, 0) + run(1, 0) + 1, h = run(0, -1) + run(0, 1) + 1;
        if (w < 44 || h < 44) out.push(sel + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' reaches ' + w + 'x' + h);
      }
      return out;
    }, sel);
    const settle = () => page.waitForTimeout(450);
    const small = [];
    const scan = async (sels) => { for (const s of sels) small.push(...await reach(s)); };
    await ev((today) => {
      DB.water.add(today, 250);
      for (let i = 0; i < 4; i++) DB.bodyweight.log(addDaysISO(today, -i), 80 + i);
      if (!DB.recipes.list().length) DB.recipes.add({ name: 'QA a11y recipe', servings: 2, items: [{ name: 'Rice', qty: '200 g', calories: 260, protein: 5, carbs: 56, fat: 1 }] });
      if (!DB.mealBundles.list().length) DB.mealBundles.update(null, { name: 'QA a11y meal', items: [{ name: 'Eggs', calories: 140, protein: 12, carbs: 1, fat: 10, servings: 2 }] });
    }, today);
    await reset('food'); await settle();
    await scan(['.view.active .nutri-edit', '.view.active .water-cup', '.view.active .link-btn']);
    await ev(() => openWeightSheet()); await settle();
    await scan(['#modal-root .weight-row-del']);
    await ev((id) => openSessionModal(id), ids[0]); await settle();
    await scan(['#modal-root .set-remove', '#modal-root [data-modal-unit]']);
    await ev(() => openCalculatorModal(() => {})); await settle();
    await scan(['#modal-root #to-calc', '#modal-root #to-manual']);
    await ev(() => openNewExerciseModal(null)); await settle();
    await scan(['#modal-root #ex-image-camera', '#modal-root #ex-image-pick']);
    await ev((today) => openSavedFoodPicker(today, () => {}, 'bundles'), today); await settle();
    await scan(['#modal-root .sfp-tab', '#modal-root .bundle-main']);
    await ev((today) => openRecipeEditor(today, null, () => {}), today); await settle();
    await scan(['#modal-root #rec-servings']);
    await ev((today) => openRecipeView(today, DB.recipes.list()[0], () => {}), today); await settle();
    await scan(['#modal-root #rec-view-servings']);
    await reset('home');
    await ev(() => openReorderSheet(0, () => {})); await settle();
    await scan(['#reorder-sheet-overlay .reorder-arrows button']);
    await reset('notifications'); await settle();
    await scan(['.view.active .ntfs-opt']);
    await reset('foodlog', { foodLog: { date: today } }); await settle();
    await scan(['.view.active #day-prev', '.view.active #day-next']);
    await reset('session-day', { sdDate: today }); await settle();
    await scan(['.view.active .sd-add-set-btn']);
    await reset('workouts'); await settle();
    await scan(['.view.active .schedule-prev-row']);
    await reset('home');
    assert.deepEqual([...new Set(small)], [], 'every listed control reaches 44x44 from its centre (its own box or its ::after halo): ' + JSON.stringify([...new Set(small)]));
  }],

  ['«Larger text» enlarges the figures, units, calendar and set tables', async ({ page, ev, reset, ids, today }) => {
    // body.text-lg raised only the --fs-* tokens while 306 font sizes were px
    // literals, so most of what a user reads kept its size. v398:
    // [".calendar-cell:not(.empty) 13 → 13", ".section-title 11 → 11",
    // ".settings-action-title 14 → 14", ".w-unit 11 → 11", ".w-alt 11 → 11",
    // ".sets-row-num 13 → 13", ".fig-row-num 26 → 26"] (.stat-box-value, already
    // on a token, is the control that grew).
    const seeded = await ev(({ id, today }) => {
      const before = new Set(DB.sleep.list().map((s) => s.id));
      const s = DB.sessions.add({ exerciseId: id, date: today, sets: [{ reps: 8, weight: 60 }] });
      DB.sleep.add({ date: today, sleepTime: '23:00', wakeTime: '07:00' });
      return { session: s && s.id, sleep: DB.sleep.list().map((x) => x.id).filter((x) => !before.has(x)) };
    }, { id: ids[0], today });
    const probes = [
      ['calendar', {}, '.calendar-cell:not(.empty)'],
      ['settings', {}, '.section-title'],
      ['settings', {}, '.settings-action-title'],
      ['exercise-detail', { exerciseId: ids[0] }, '.w-unit'],
      ['exercise-detail', { exerciseId: ids[0] }, '.w-alt'],
      ['exercise-detail', { exerciseId: ids[0] }, '.sets-row-num'],
      ['exercise-detail', { exerciseId: ids[0] }, '.stat-box-value'],
      ['sleep', {}, '.fig-row-num'],
    ];
    const sizes = async () => {
      const out = {};
      for (const [view, ctx, sel] of probes) {
        await reset(view, ctx);
        out[sel] = await ev((sel) => { const el = [...document.querySelectorAll('.view.active ' + sel)].find((n) => n.getClientRects().length); return el ? parseFloat(getComputedStyle(el).fontSize) : null; }, sel);
      }
      return out;
    };
    const normal = await sizes();
    await reset('settings');
    await page.locator('.view.active [data-textlg="1"]').click();
    const large = await sizes();
    await reset('settings');
    await page.locator('.view.active [data-textlg="0"]').click();
    await ev((seeded) => { if (seeded.session) DB.sessions.remove(seeded.session); seeded.sleep.forEach((id) => DB.sleep.remove(id)); }, seeded);
    const same = Object.keys(normal).filter((k) => !(normal[k] && large[k] > normal[k])).map((k) => k + ' ' + normal[k] + ' → ' + large[k]);
    assert.deepEqual(same, [], '«Larger text» makes each of these strictly larger: ' + JSON.stringify(same));
  }],
];

async function designA11y(page) {
  const kit = await designA11yKit(page);
  for (const [, run] of designA11yCases) await run(kit);
  await kit.ev(() => { closeModal(); hideToast(); DB.prefs.setTextLg(false); document.body.classList.remove('text-lg'); navigate('home'); });
  console.log('PASS design system, accessibility and the muscle history (batches 5, 8): an [autofocus] sheet takes focus every time, the five .app sheets take, keep and return focus, every field is named by its caption, a chosen option says so, a year of one muscle opens on its newest days, the listed controls reach 44x44, «Larger text» reaches the figures');
}
