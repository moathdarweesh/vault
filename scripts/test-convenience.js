'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {context} = require('./test-sync-status');
const state = context(), {c} = state, db = c.DB;
const run = code => vm.runInContext(code,c);
const json = value => JSON.stringify(value);
const date = '2026-09-10';
const food = {name:'شوفان',servings:2,calories:100,protein:5,carbs:12,fat:3};
const meal = db.mealBundles.add({name:'فُطوري',items:[food,{...food,name:'حليب',servings:1}]});
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
const preview = db.shopping.preview([{type:'recipe',id:recipe.id,servings:2}]);
assert.equal(preview.items[0].quantity,100);
const combined = db.shopping.combine([
 {name:'Rice',quantity:500,unit:'g',ingredientId:'rice',preparation:'raw',sourceRefs:[]},
 {name:'Rice',quantity:1,unit:'kg',ingredientId:'rice',preparation:'raw',sourceRefs:[]},
 {name:'Rice',quantity:200,unit:'ml',ingredientId:'rice',preparation:'raw',sourceRefs:[]},
 {name:'Rice',quantity:200,unit:'g',ingredientId:'rice',preparation:'cooked',sourceRefs:[]},
 {name:'Rice',quantity:null,unit:'',sourceRefs:[]}
]);
assert.equal(combined.length,4); assert.equal(combined[0].quantity,1500);
let shopping = db.shopping.save({name:'week',items:combined});
assert.equal(shopping.ok,true);
const savedList = json(shopping.entity);
db.recipes.remove(recipe.id);
assert.equal(json(db.shopping.list()[0]),savedList,'source deletion cannot rewrite shopping snapshot');
assert.equal(db.shopping.save({...shopping.entity,name:'other'},'old').code,'STALE');
assert.equal(db.search.normalize('إِفْطَار ۱۲٣'),'افطار 123');
assert.ok(db.search.query('فطوري').some(x=>x.type==='meal'));
assert.equal(db.search.query('١٠/٠٩/٢٠٢٦')[0].date,date);
assert.equal(db.search.query('03/04').some(x=>x.type==='date'),false);
assert.equal(db.search.query('2026-02-30').some(x=>x.type==='date'),false);
db.recipes.add({name:'legacy metadata',servings:4,items:[{...food,qty:'200 غ',purchase:{quantity:200,unit:'g',ingredientId:'rice',preparation:'raw'}}]});
const snapshot = run('JSON.stringify(STATE)');
state.values.set(state.keys.store,snapshot+' ');
assert.equal(db.shopping.remove(shopping.entity.id).code,'STALE','another tab changed storage');
run('reloadState()'); assert.equal(db.undo.list().length,0);
assert.equal(db.shopping.list().length,1);
assert.equal(db._idsSafe({...JSON.parse(snapshot),shoppingLists:[{id:'bad"',items:[]}]}),false);

// Pin v309: HEAD moves after release and would silently test the new client against itself.
const compatibilityBaseline = '7e6ac93bbb9eb4cdce993645962113a8f44d3c8a';
const oldStorage = execFileSync('git',['show',`${compatibilityBaseline}:js/storage.js`],{encoding:'utf8'});
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

// Search includes 10k records without a persistent index or query log.
run(`STATE.foodLogs['${date}']=Array.from({length:10000},(_,i)=>({id:'food_'+i,name:'Test meal '+i,calories:1,servings:1}))`);
const start = performance.now(); const hits = db.search.query('Test meal 99'); const elapsed = performance.now()-start;
assert.ok(hits.length>0 && hits.length<=60);
console.log(`PASS convenience: atomic meals, quota rollback, scoped undo, account/tab isolation, recipes, units, snapshots, Arabic dates, legacy round-trip, plan restoration; 10k search ${elapsed.toFixed(1)}ms`);
