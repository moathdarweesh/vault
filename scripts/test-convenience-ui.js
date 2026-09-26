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
  await routerHome(page);
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
