'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {context} = require('./test-sync-status');
const state = context(), {c} = state, db = c.DB;
const run = code => vm.runInContext(code,c);
const json = value => JSON.stringify(value);
const date = '2026-09-10';
const food = {name:'شوفان',servings:2,calories:100,protein:5,carbs:12,fat:3};
// update(null, …), which is what the APP calls — mealBundles.add() was a thin
// wrapper around exactly this and no shipped code ever reached it, so a suite
// that used it was testing a path that could not regress for a user.
const meal = db.mealBundles.update(null,{name:'فُطوري',items:[food,{...food,name:'حليب',servings:1}]}).entity;
assert.ok(meal.id);
db.undo.clear();
let calls = 0; c.Cloud.onLocalChange = () => {calls++;};
const result = db.mealBundles.log(meal.id,date,0.5,'meal_operation');
assert.equal(result.ok,true); assert.equal(calls,1);
assert.equal(db.foodLogs.totalsForDate(date).calories,150);
assert.equal(db.foodLogs.listForDate(date).length,2);
assert.equal(db.mealBundles.log(meal.id,date,0.5,'meal_operation').changed,false);
assert.equal(calls,1);
const logged = json(db.foodLogs.listForDate(date));
db.mealBundles.update(meal.id,{name:'new',items:[{...food,calories:900}]});
assert.equal(json(db.foodLogs.listForDate(date)),logged,'past records are snapshots');
assert.equal(db.undo.apply(db.undo.list()[0].token).ok,true);
db.foodLogs.add(date,{...food,name:'unrelated'});
assert.equal(db.undo.apply(result.undoToken).ok,true,'undo only created meal rows');
assert.equal(db.foodLogs.listForDate(date).length,1);
const before = run('JSON.stringify(STATE)'), beforeCalls = calls;
state.fail('QuotaExceededError');
assert.equal(db.mealBundles.log(meal.id,date,1).ok,false);
assert.equal(run('JSON.stringify(STATE)'),before,'quota rollback preserves all memory');
assert.equal(calls,beforeCalls,'no cloud notification on failed transaction');
state.fail('');
const s = db.sessions.add({exerciseId:db.exercises.list()[0].id,date,sets:[{weight:50,reps:10},{weight:60,reps:8}]});
db.undo.clear();
db.sessions.update(s.id,{sets:[{weight:55,reps:10}]});
assert.equal(db.undo.apply(db.undo.list()[0].token).ok,true);
assert.equal(db.sessions.get(s.id).sets.length,2);
db.sessions.update(s.id,{sets:[{weight:70,reps:10}]});
const token = db.undo.list()[0].token;
run(`STATE.sessions.find(x=>x.id===${JSON.stringify(s.id)}).sets[0].weight=80`);
assert.equal(db.undo.apply(token).code,'STALE');
state.account('bob'); assert.equal(db.undo.list().length,0);
state.account('alice'); run('save()');
const recipe = db.recipes.add({name:'rice',servings:4,items:[{...food,qty:'200 غ',purchase:{quantity:200,unit:'g',ingredientId:'rice',preparation:'raw'}}]});
const totals = json(db.recipes.totals(recipe)); const priorCalls = calls;
const edited = db.recipes.update(recipe.id,{name:'rice edited'});
assert.equal(calls,priorCalls+1,'recipe edit writes once');
assert.equal(json(db.recipes.totals(edited)),totals,'quantity does not multiply nutrition');
// ---- THE ONE RUNNING SHOPPING LIST (v329) --------------------------------
// An empty list is NEVER materialised: hasUserData() counts shoppingLists.length,
// so a list created on first render would make a fresh install read as "has data"
// and defeat the empty-device guard.
assert.equal(db.shopping.get().items.length,0,'starts empty');
assert.equal(run('(STATE.shoppingLists||[]).length'),0,'an empty list is not written to the blob');

// A recipe contributes NAME + its own qty TEXT. Nothing is parsed or scaled.
assert.equal(db.shopping.addFrom('recipe',recipe.id).ok,true);
let sl = db.shopping.get();
assert.equal(sl.items.length,1);
assert.equal(sl.items[0].name,food.name);
assert.equal(json(sl.items[0].amounts),json(['200 غ']),'the recipe\'s own words, verbatim');
assert.equal(run('(STATE.shoppingLists||[]).length'),1,'now it exists');

// Merging is by NORMALISED name and the amounts JOIN — they are never added up.
// combine()'s old law ("never a name guess") was about ARITHMETIC; joining text
// computes nothing, so a name match is safe here for the first time.
assert.equal(db.shopping.addNames([{name:food.name,amount:'كوب'},{name:'خبز'}]).ok,true);
sl = db.shopping.get();
assert.equal(sl.items.length,2,'same name merged, new name added');
assert.equal(json(sl.items[0].amounts),json(['200 غ','كوب']),'amounts join, never sum');
// A duplicate wording is not repeated.
db.shopping.addNames([{name:food.name,amount:'كوب'}]);
assert.equal(db.shopping.get().items[0].amounts.length,2,'a repeated wording is not appended twice');

// A tick does NOT enter undo history: twenty of them would flush the undo list
// of every change that actually matters.
const undoBefore = db.undo.list().length;
const firstId = db.shopping.get().items[0].id;
assert.equal(db.shopping.toggle(firstId).ok,true);
assert.equal(db.shopping.get().items[0].checked,true);
assert.equal(db.undo.list().length,undoBefore,'a tick is not an undoable change');

// Re-adding a name you already have un-ticks it — you need it again.
db.shopping.addNames([{name:food.name}]);
assert.equal(db.shopping.get().items[0].checked,false,'re-adding un-ticks');

// A saved list is a SNAPSHOT: deleting the recipe cannot rewrite it.
const beforeDelete = json(db.shopping.get());
db.recipes.remove(recipe.id);
assert.equal(json(db.shopping.get()),beforeDelete,'source deletion cannot rewrite the list');

// Removing the last item drops the list from the blob again.
for (const it of db.shopping.get().items) db.shopping.removeItem(it.id);
assert.equal(run('(STATE.shoppingLists||[]).length'),0,'the list is dropped when it empties');
db.shopping.addNames([{name:'زيت'}]);

// The validator tolerates a LEGACY shape arriving from a device on an older build.
assert.equal(db._validateBlob({exercises:[],shoppingLists:[{id:'a',name:'week',items:[{id:'b',name:'Rice',quantity:500,unit:'g'}]}]}),true,'legacy shape still validates');
assert.equal(db._validateBlob({exercises:[],shoppingLists:[{id:'a',items:[{id:'b',name:'Rice',amounts:['200 غ']}]}]}),true,'new shape validates');
assert.equal(db._validateBlob({exercises:[],shoppingLists:[{id:'a',items:[{id:'b',name:'Rice',amounts:'nope'}]}]}),false,'amounts must be an array');
assert.equal(db.search.normalize('إِفْطَار ۱۲٣'),'افطار 123');
assert.ok(db.search.query('فطوري').some(x=>x.type==='meal'));
assert.equal(db.search.query('١٠/٠٩/٢٠٢٦')[0].date,date);
assert.equal(db.search.query('03/04').some(x=>x.type==='date'),false);
assert.equal(db.search.query('2026-02-30').some(x=>x.type==='date'),false);
db.recipes.add({name:'legacy metadata',servings:4,items:[{...food,qty:'200 غ',purchase:{quantity:200,unit:'g',ingredientId:'rice',preparation:'raw'}}]});
const snapshot = run('JSON.stringify(STATE)');
state.values.set(state.keys.store,snapshot+' ');
assert.equal(db.shopping.addNames([{name:'ملح'}]).code,'STALE','another tab changed storage');
run('reloadState()'); assert.equal(db.undo.list().length,0);
assert.equal(db.shopping.get().items.length,1,'the list survived the reload');
assert.equal(db._idsSafe({...JSON.parse(snapshot),shoppingLists:[{id:'bad"',items:[]}]}),false);

// Pin v309: HEAD moves after release and would silently test the new client against itself.
const compatibilityBaseline = '7e6ac93bbb9eb4cdce993645962113a8f44d3c8a';
// A shallow clone (CI's default) has no such commit and `git show` dies with a
// message that names the path, not the cause. Say the cause.
let oldStorage;
try { oldStorage = execFileSync('git',['show',`${compatibilityBaseline}:js/storage.js`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
catch (e) { throw new Error(`this suite replays js/storage.js from commit ${compatibilityBaseline.slice(0,7)} (v309) and that commit is not in this clone — a shallow checkout; CI needs fetch-depth: 0. git said: ${String(e.stderr||e.message).trim()}`); }
const old = context(); old.values.set(old.keys.store,snapshot);
const legacy = { ...old.c, window:null }; legacy.window=legacy;
vm.createContext(legacy); vm.runInContext(oldStorage,legacy); vm.runInContext('DB.prefs.setTheme("light")',legacy);
const oldRoundTrip = JSON.parse(old.values.get(old.keys.store));
assert.equal(json(oldRoundTrip.shoppingLists),json(JSON.parse(snapshot).shoppingLists));
assert.equal(json(oldRoundTrip.mealBundles),json(JSON.parse(snapshot).mealBundles));
assert.equal(json(oldRoundTrip.recipes),json(JSON.parse(snapshot).recipes));

// Plan-only restoration, reference repair, stale protection, undo dependencies.
const basePlan = json(db.plan.get());
const baseExercises = json(db.exercises.list().map(e=>({id:e.id,name:e.name,category:e.category})));
const baseLogs = json(db.foodLogs.listForDate(date)), baseSessions = json(db.sessions.listAll());
const restore = db.plan.restorePrevious({plan:{cycle:[{name:'Old',exerciseIds:['missing'],targets:{missing:{sets:3,reps:'8',notes:''}}}],trainingDays:[1,3]},exercises:[{id:'missing',name:'Custom historic',category:'Chest'}],mappings:{missing:'new'},expectedPlan:basePlan,expectedExercises:baseExercises,keepExceptions:false});
assert.equal(restore.ok,true);
assert.equal(db.plan.get().cycle[0].targets[db.plan.get().cycle[0].exerciseIds[0]].sets,3);
assert.equal(json(db.foodLogs.listForDate(date)),baseLogs); assert.equal(json(db.sessions.listAll()),baseSessions);
assert.equal(db.undo.apply(restore.undoToken).ok,true); assert.equal(json(db.plan.get()),basePlan);

// ---- A SET IS EDITED, NEVER REBUILT (v397) --------------------------------
// loadState keeps a set's unknown fields (v396); the WRITE paths rebuilt every
// set from reps/weight/done, so the first edit of a set's reps erased whatever
// a newer build had put on it — and the next push carried the loss everywhere.
{
  const exId = db.exercises.list()[2].id;
  const kept = db.sessions.add({exerciseId:exId,date,sets:[{reps:8,weight:40,rpe:8,tempo:'3-1-1'},{reps:8,weight:40}]});
  assert.equal(db.sessions.get(kept.id).sets[0].rpe,8,'add keeps a per-set field it does not know');
  const stored = db.sessions.get(kept.id).sets[0];
  db.sessions.update(kept.id,{sets:[{...stored,reps:10},{reps:6,weight:45}]});
  const edited = db.sessions.get(kept.id).sets;
  assert.equal(edited[0].reps,10);
  assert.equal(edited[0].rpe,8,'an unknown per-set field survives an edit of its reps');
  assert.equal(edited[0].tempo,'3-1-1');
  assert.equal(json(Object.keys(edited[1]).sort()),json(['reps','weight']),'a set that carried nothing gains nothing');
  // `done` is still stored only as its exception, whatever the editor passes.
  db.sessions.update(kept.id,{sets:[{...edited[0],done:true}]});
  assert.equal('done' in db.sessions.get(kept.id).sets[0],false,'done:true is the default and is not stored');
  db.sessions.update(kept.id,{sets:[{...edited[0],done:false}]});
  assert.equal(db.sessions.get(kept.id).sets[0].done,false,'done:false is');
  db.sessions.remove(kept.id);
}

// ---- AN EXERCISE THAT IS GONE TAKES ITS UNDO WITH IT (v397) ----------------
// DB.exercises.remove purges its sessions with a raw save, outside the ledger.
// An earlier 'session_deleted' entry still passed apply()'s STALE check (the
// session reads null, and its `after` IS null), so Recent changes re-inserted
// a session whose exercise no longer existed: counted in streaks, weekly sets
// and the calendar, with no page left to delete it from.
{
  const custom = db.exercises.add({name:'QA orphan',category:'Chest'});
  const s1 = db.sessions.add({exerciseId:custom.id,date,sets:[{reps:5,weight:20}]});
  const gone = db.sessions.remove(s1.id);
  assert.equal(gone.ok,true);
  db.exercises.remove(custom.id);
  assert.equal(db.undo.apply(gone.undoToken).ok,false,'undoing the deletion is refused once the exercise is gone');
  assert.equal(db.sessions.listAll().some(x=>x.exerciseId===custom.id),false,'no orphan session comes back');
}

// ---- THE UNDO ON A TOAST UNDOES THE WRITE IT ANNOUNCES (v397) --------------
// offerUndo bound its button to the NEWEST ledger entry whenever its caller
// passed no result — and a write that changed nothing records no entry. So
// "Set deleted · Undo" after removing an EMPTY row undid the set logged before
// it; "Edited · Undo" after an unchanged save brought back a meal deleted an
// hour earlier. offerUndo and withUndo are read out of the shipped app.js by
// name (the way test-run-list reads the run's functions) and run here against
// this context's real DB, with the toast recorded instead of shown.
{
  const APP = fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8').split(/\r?\n/);
  const pick = (name) => {
    const at = APP.findIndex(l => l.startsWith(`function ${name}(`));
    assert.ok(at !== -1, `${name} is not a top-level function in js/app.js — did it move?`);
    const end = APP.findIndex((l, i) => i > at && l === '}');
    return APP.slice(at, end + 1).join('\n');
  };
  const shown = [];
  c.t = key => key;
  c.showToast = (message, opts) => shown.push({message, opts});
  c.convenienceError = () => shown.push({message:'error'});
  c.applyConvenienceUndo = token => db.undo.apply(token);
  run(pick('offerUndo'));
  const exA = db.exercises.list()[3].id, exB = db.exercises.list()[4].id;
  const a = db.sessions.add({exerciseId:exA,date,sets:[{reps:10,weight:60}]});
  const b = db.sessions.add({exerciseId:exB,date,sets:[{reps:5,weight:30}]});
  db.sessions.remove(b.id);   // the newest entry is now somebody else's change
  shown.length = 0;
  run(`offerUndo('session_updated')`);
  assert.equal(shown.length,0,'offerUndo with no write to name offers NOTHING — the newest entry belongs to another change');
  run(pick('withUndo'));
  run(`offerUndo('session_updated', withUndo(() => DB.sessions.update(${json(a.id)}, {sets:[{reps:10,weight:60}]})))`);
  assert.equal(shown.length,0,'a save that changed nothing records nothing, so it offers nothing');
  run(`offerUndo('session_updated', withUndo(() => DB.sessions.update(${json(a.id)}, {sets:[{reps:12,weight:60}]})))`);
  assert.equal(shown.length,1,'a save that changed something offers its own entry');
  shown[0].opts.onAction();
  assert.equal(db.sessions.get(a.id).sets[0].reps,10,'taking it undoes that save');
  assert.equal(db.sessions.get(b.id),null,'and leaves the earlier deletion alone');
  // A write that returns its changeSlice result names its entry itself.
  shown.length = 0;
  const removed = db.sessions.remove(a.id);
  run(`offerUndo('session_deleted', ${json(removed)})`);
  assert.equal(shown.length,1);
  shown[0].opts.onAction();
  assert.ok(db.sessions.get(a.id),'the result\'s own undoToken is the one offered');
  shown.length = 0;
  run(`offerUndo('x', {ok:true, changed:false})`);
  assert.equal(shown.length,0,'an unchanged result offers nothing');
  db.sessions.remove(a.id);
  // The food log's editor, the reviewer's own sequence: delete row A, then
  // save row B unchanged. Its toast offered Undo, and the Undo brought A back.
  const fd = '2026-09-11';
  const rowA = db.foodLogs.add(fd,{...food,name:'row A'}), rowB = db.foodLogs.add(fd,{...food,name:'row B'});
  assert.equal(db.foodLogs.remove(fd,rowA.id).ok,true);
  shown.length = 0;
  run(`offerUndo('fl_edited', withUndo(() => DB.foodLogs.update(${json(fd)}, ${json(rowB.id)}, {servings:${rowB.servings}})))`);
  assert.equal(shown.length,0,'an unchanged food-log save offers no Undo — the newest entry is the deleted row');
  assert.equal(db.foodLogs.listForDate(fd).some(x=>x.id===rowA.id),false,'and the deleted row stays deleted');
}

// ---- THE ROTATION KEEPS ITS PLACE WHEN IT IS EDITED (v397) -----------------
// The position is DERIVED: elapsed training days since the anchor, counted
// with the CURRENT weekdays, indexed into the CURRENT cycle. So a weekday
// toggle recounted the whole past as if it had always applied, and adding or
// removing a workout changed `elapsed % length` — today's workout jumped by an
// arbitrary offset. Its own context: these edits rebuild the plan.
{
  const p = context(), pdb = p.c.DB, prun = code => vm.runInContext(code, p.c);
  const today = prun('todayISO()');
  const iso = n => prun(`addDaysISO(todayISO(), ${n})`);
  const at = d => { const w = pdb.plan.workoutForDate(new Date(d + 'T12:00:00')); return w ? w.name : null; };
  const dow = d => new Date(d + 'T12:00:00').getDay();
  const slot = name => ({name, exerciseIds:[]});
  const ALL = [0,1,2,3,4,5,6];
  pdb.plan.setRotation({cycle:[slot('Push'),slot('Pull'),slot('Legs')],trainingDays:ALL,anchor:iso(-10)});
  assert.equal(at(today),'Pull','ten training days since the anchor: 10 % 3');
  // Drop yesterday's weekday: the ten days behind today now count as eight.
  pdb.plan.setTrainingDays(ALL.filter(d => d !== dow(iso(-1))));
  assert.equal(at(today),'Pull','a weekday toggle keeps today\'s workout');
  assert.equal(at(iso(1)),'Legs','and the next training day carries the next one');
  pdb.plan.addSlot('Arms');
  assert.equal(at(today),'Pull','adding a workout keeps today\'s');
  assert.equal(json([1,2,3].map(n => at(iso(n)))),json(['Legs','Arms','Push']),'and the new one joins the sequence where it was added');
  pdb.plan.removeSlot(0);
  assert.equal(at(today),'Pull','removing an EARLIER workout keeps today\'s');
  const r = pdb.plan.removeSlot(0);
  assert.equal(at(today),'Legs','removing TODAY\'S workout gives today the one after it');
  // «Remove from cycle» is one tap on a whole workout; it is undoable now.
  assert.equal(r && r.ok,true,'removeSlot answers with its write');
  assert.equal(pdb.undo.apply(r.undoToken).ok,true,'and that write can be undone');
  assert.equal(json(pdb.plan.get().cycle.map(s => s.name)),json(['Pull','Legs','Arms']));
  assert.equal(at(today),'Pull','undone byte for byte — today included');
  // A plan built BY HAND starts on its FIRST workout. The load path used to
  // stamp an empty plan's anchor with the day the app loaded, and the first
  // slot added counted from that stale day.
  pdb.plan.clearAll();
  prun(`STATE.plan.anchor = addDaysISO(todayISO(), -20); save()`);
  pdb.plan.addSlot('Push'); pdb.plan.addSlot('Pull'); pdb.plan.addSlot('Legs');
  pdb.plan.setTrainingDays(ALL);
  assert.equal(at(today),'Push','a hand-built rotation starts today on its first workout');
  assert.equal(at(iso(1)),'Pull');
  // And a fresh store does not invent an anchor for a plan that has no workouts.
  pdb.resetAll(); prun('reloadState()');
  assert.equal(pdb.plan.get().anchor,null,'an empty plan has no anchor to count from');
}

// ---- ONE READING OF AN AMOUNT (review 2026-09-25) --------------------------
// bugs:food-body#2 · features:food#7 · bugs:food-body#11. The recipe editor's
// weight reader and the ingredients sheet's scaler read one free-text field,
// and read a comma two ways. On v397: parseGrams('0,5 كغ') was 5000 — a saved
// food scaled ten times over with no model call — '1,000 g' was nothing, and
// recScaleQty('1,000 g', 0.5) was '0.5 g', '1/2 كوب' at double '2/2 كوب'.
// The REAL js/food.js runs here; it has no top-level statement but constants.
{
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','food.js'),'utf8'), c);
  const g = (s, unit) => run(`parseGrams(${json(s)}, ${!!unit})`);
  assert.equal(g('0,5 كغ'), 500, "a decimal comma is half a kilo, not 5 kg");
  assert.equal(g('1,5 kg'), 1500);
  assert.equal(g('٠,٥ كغ'), 500, 'with Arabic-Indic digits too');
  assert.equal(g('٠٫٥ كغ'), 500, 'and the Arabic decimal separator, as before');
  assert.equal(g('1,000 g'), 1000, 'three digits after a comma are a thousands group');
  assert.equal(g('1,5000 g'), null, 'a comma neither rule reads is not a weight — the model is asked instead');
  assert.equal(g('200 غ'), 200);
  assert.equal(g('٢٠٠'), 200, 'a bare typed number is grams');
  assert.equal(g('١ كوب · ٢٥٠غ'), 250, 'the LAST weight counts');
  assert.equal(g('1', true), null, "a food's bare serving of 1 is a piece, not a gram");
  assert.equal(g('٣ حبات'), null, 'a count is not a weight');
  const sc = (q, f) => run(`recScaleQty(${json(q)}, ${f})`);
  assert.equal(sc('1,000 g', 0.5), '500 g', 'the scaler reads the same thousands group');
  assert.equal(sc('0,5 كغ', 2), '1 كغ', 'and the same decimal comma');
  assert.equal(sc('1,5000 g', 2), '1,5000 g', 'a comma it cannot read leaves the amount as written');
  assert.equal(sc('1/2 كوب', 2), '1 كوب', 'a fraction scales as ONE value');
  assert.equal(sc('٣ حبات', 0.5), '1.5 حبات', 'v392 unchanged: a leading Arabic-Indic number');
  assert.equal(sc('١ كيلو', 1.25), '1.25 كيلو');
  assert.equal(sc('رشّة', 2), 'رشّة', 'no number, nothing moves');
  assert.equal(sc('200 غ', 1), '200 غ', 'at its own count the string is untouched');
}

// ---- A FIGURE IS NEVER NEGATIVE (features:food#4) ---------------------------
// Manual entry took Number(field) || 0 with no floor, and a typed minus sign —
// min="0" does not stop one — logged -300 kcal and kept it in My foods: the
// ring credited the day back on every one-tap re-log. foodLogs.update and
// cleanMealItems already held 0–100000; the two add() doors hold it now too.
{
  const fd = '2026-09-12';
  const row = db.foodLogs.add(fd, {name:'QA minus', servings:1, calories:-300, protein:-5, carbs:'x', fat:1e9});
  assert.equal(row.calories, 0, 'a negative calorie figure is not stored — v397 stored -300');
  assert.equal(row.protein, 0);
  assert.equal(row.carbs, 0, 'nor a figure that is not a number');
  assert.equal(row.fat, 100000, 'nor an absurd one');
  assert.equal(db.foodLogs.add(fd, {name:'QA minus servings', servings:-2, calories:100}).servings, 1, 'a negative serving count is not a multiplier');
  assert.ok(db.foodLogs.totalsForDate(fd).calories >= 0, 'so the day can never be credited');
  const f = db.foods.add({name:'QA minus food', serving:'', calories:-300, protein:-1, carbs:2, fat:3});
  assert.equal(f.calories, 0, 'nor is one kept in My foods — v397 kept -300');
  assert.equal(f.protein, 0);
  assert.equal(f.carbs, 2, 'an honest figure is kept exactly');
  const u = db.foods.update(f.id, {calories:-50, protein:12});
  assert.equal(u.calories, 0, 'and an edit cannot put one back');
  assert.equal(u.protein, 12);
}

// ---- A MEAL'S PORTION HAS A CEILING, AND IT IS NAMED (features:food#6) ------
// log() multiplies each item's servings by the portion and cleanMealItems
// refuses a row above 20 servings — so an item ×5 at portion 5 was refused as
// VALIDATION, which the sheet shows as «check the limits», after previewing
// the total as if it were fine. maxPortion() is the ceiling the sheet now
// shows; log() refuses above it with its own code.
{
  const big = db.mealBundles.update(null, {name:'QA big', items:[{...food, servings:5}, {...food, name:'small', servings:1}]}).entity;
  const d = '2026-09-13';
  const over = db.mealBundles.log(big.id, d, 5);
  assert.equal(over.code, 'PORTION', 'above the ceiling the refusal names the portion — v397 said VALIDATION');
  assert.equal(over.max, 4, 'and carries the ceiling: 20 servings ÷ the largest item (×5)');
  assert.equal(db.mealBundles.maxPortion(big.id), 4);
  assert.equal(db.mealBundles.log(big.id, d, 4).ok, true, 'the ceiling itself logs');
  assert.equal(db.mealBundles.log(big.id, d, 4.25).code, 'PORTION');
  const odd = db.mealBundles.update(null, {name:'QA odd', items:[{...food, servings:3}]}).entity;
  assert.equal(db.mealBundles.maxPortion(odd.id), 6.5, "floored to the sheet's 0.25 step (20 ÷ 3 = 6.67)");
  const tiny = db.mealBundles.update(null, {name:'QA tiny', items:[{...food, servings:0.25}]}).entity;
  assert.equal(db.mealBundles.maxPortion(tiny.id), 20, "and never above the portion's own limit");
  assert.equal(db.mealBundles.maxPortion('no-such-meal'), 0);
}

// Search includes 10k records without a persistent index or query log.
run(`STATE.foodLogs['${date}']=Array.from({length:10000},(_,i)=>({id:'food_'+i,name:'Test meal '+i,calories:1,servings:1}))`);
const start = performance.now(); const hits = db.search.query('Test meal 99'); const elapsed = performance.now()-start;
assert.ok(hits.length>0 && hits.length<=60);
console.log(`PASS convenience: atomic meals, quota rollback, scoped undo, account/tab isolation, recipes, units, snapshots, Arabic dates, legacy round-trip, plan restoration, one reading of an amount (decimal comma, thousands, fraction), no negative figure through either add door, a meal portion's named ceiling; 10k search ${elapsed.toFixed(1)}ms`);
