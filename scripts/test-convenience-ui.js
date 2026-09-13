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
  console.log('PASS convenience UI: bilingual meals, half portion, dated log + undo, recipe quantities, shopping save/check, search/date navigation, recent changes, guided-run undo, plan-only restoration, recipe regression');
};
