// TYPED WORK AND STORED ROWS ARE NOT LOST TO ONE PRESS (v433) — in real Chrome.
//
//   node scripts/test-data-safety-ui.js            # ar/dark + en/light, 375px
//   QA_ONLY=<words> node scripts/test-data-safety-ui.js
//
// WHY THIS EXISTS. Three losses, each one press wide, stood in the app for as
// long as the sheets did: a sheet holding unsaved typing was thrown away by any
// of six doors without a word; a weight entry and an exercise on a plan day
// were erased with no way back; the notification log with no question. Contract
// 80 holds the WIRING (every door reaches the one guard, the deletes are
// undoable writes); this suite holds what the user meets: the first press on a
// dirty sheet is refused and says why, the second closes, a clean sheet and a
// Save are never asked, the Undo puts the row back without wiping the sets
// being typed beside it.
//
// Every case drives the doors the way a thumb does (a click, a key, Back, a
// mouse drag), never the guard's own functions.
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start, fence } = require('./fp/server.js');

const ONLY = process.env.QA_ONLY || '';
const LIVE = '#modal-root .modal-overlay:not(.is-out)';

async function openPage(browser, origin, { lang, theme }) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: theme, timezoneId: 'Asia/Riyadh', locale: lang === 'ar' ? 'ar-SA' : 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const guard = await fence(page);
  await page.goto(origin + '/');
  await page.waitForFunction(() => typeof navigate === 'function' && window.__vltReady, null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 9000 }).catch(() => {});
  await page.evaluate(({ lang, theme }) => {
    DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded(); DB.notif.setAsked(); DB.prefs.setUnit('kg');
    applyLang(lang); applyTheme(theme); hideAuthGate();
    document.getElementById('onboard-gate')?.remove();
    const ex = DB.exercises.list()[0];
    DB.sessions.add({ exerciseId: ex.id, date: addDaysISO(todayISO(), -2), sets: [{ reps: 8, weight: 40 }] });
    navigate('home');
  }, { lang, theme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { ctx, page, ev, errors, guard, lang, theme };
}

// A clean screen: nothing in #modal-root (a leaving sheet may still be there for
// its exit; the next open swaps over it), no toast, the named view.
const reset = (kit, view, ctx) => kit.ev(({ view, ctx }) => {
  try { closeModal(); } catch (_) {}
  hideToast();
  document.querySelectorAll('.app > .sheet-overlay').forEach((s) => s.remove());
  navStack = [{ view: 'home', context: {} }];
  navigate('home', {}, { fromPop: true });
  if (view !== 'home') navigate(view, ctx);
}, { view: view || 'home', ctx: ctx || {} });
const up = (kit) => kit.ev((sel) => !!document.querySelector(sel), LIVE);
const gone = (kit) => kit.page.waitForFunction((sel) => !document.querySelector(sel), LIVE, { timeout: 3000 }).then(() => true, () => false);
const toastNow = (kit) => kit.ev(() => {
  const el = document.querySelector('.toast.show');
  return el ? { msg: (el.querySelector('.toast-msg') || el).textContent.trim(), undo: !!el.querySelector('.toast-action') } : null;
});
const tr = (kit, key) => kit.ev((k) => t(k), key);
const pause = (kit, ms) => kit.page.waitForTimeout(ms);
const REFLEX = 450;   // past DIRTY_REFLEX (400 ms): a second press that is a decision, not the first one arriving twice

// The six doors a user has. Escape counts once here: the sheet's own trap takes
// it, and the global handler behind it is held by contract 80.
const DOORS = {
  x: (kit) => kit.page.locator(LIVE + ' .modal-header [data-close]').click(),
  escape: (kit) => kit.page.keyboard.press('Escape'),
  back: async (kit) => {
    const r = await kit.ev(() => { const depth = navStack.length; const handled = goBack(); return { handled, sameDepth: navStack.length === depth }; });
    assert.deepEqual(r, { handled: true, sameDepth: true }, 'Back is HANDLED (the APK must not exit) and the stack is untouched');
  },
  backdrop: async (kit) => {
    const top = await kit.ev((sel) => document.querySelector(sel + ' .modal').getBoundingClientRect().top, LIVE);
    assert.ok(top > 24, 'the sheet leaves backdrop above it to tap: ' + top);
    await kit.page.mouse.click(187, 8);
  },
  drag: async (kit) => {
    const box = await kit.ev((sel) => { const r = document.querySelector(sel + ' .modal').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 7 }; }, LIVE);
    await kit.page.mouse.move(box.x, box.y);
    await kit.page.mouse.down();
    for (let i = 1; i <= 8; i++) await kit.page.mouse.move(box.x, box.y + i * 25);
    await kit.page.mouse.up();
  },
};
// The manual-food sheet: six plain fields, no row machinery, a Save that needs two of them.
// `fresh`: wait for the last sheet to be gone first, so this one RISES (a sheet
// opened over a leaving one swaps in with no entrance — and the drag must be
// measured on a sheet that has an entrance to replay).
const openManual = async (kit, typed, fresh) => {
  await reset(kit, 'food');
  if (fresh) await kit.page.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), null, { timeout: 3000 });
  await kit.ev(() => { openManualFoodEntry(todayISO(), () => {}); });
  if (typed) await kit.page.locator(LIVE + ' #mf-name').fill(typed);
  await pause(kit, fresh ? 460 : 380);   // past the backdrop's own 350 ms rule; a fresh sheet: past its 400 ms rise too
};

const CASES = [
  ['a clean sheet closes on ONE press of every door', async (kit) => {
    for (const door of Object.keys(DOORS)) {
      await openManual(kit, '', door === 'drag');
      await DOORS[door](kit);
      assert.ok(await gone(kit), `an untouched sheet closes at once by ${door}`);
      assert.equal(await toastNow(kit), null, `and ${door} says nothing`);
    }
  }],
  ['a dirty sheet refuses every door once, says why, and closes on the second press', async (kit) => {
    const said = await tr(kit, 'sheet_dirty_close');
    for (const door of Object.keys(DOORS)) {
      await openManual(kit, 'QA typed', door === 'drag');
      await DOORS[door](kit);
      await pause(kit, 60);
      assert.equal(await up(kit), true, `the first ${door} leaves the sheet up`);
      assert.equal(await kit.ev(() => document.getElementById('mf-name').value), 'QA typed', `and what was typed is still there after ${door}`);
      assert.deepEqual(await toastNow(kit), { msg: said, undo: false }, `the first ${door} says why`);
      await pause(kit, REFLEX);
      if (door === 'drag') {
        const rest = await kit.ev((sel) => { const m = document.querySelector(sel + ' .modal'); return { swap: m.parentElement.classList.contains('vlt-swap'), dragging: m.classList.contains('dragging'), settling: m.classList.contains('settling'), y: Math.round(new DOMMatrix(getComputedStyle(m).transform).m42), running: m.getAnimations().filter((a) => a.playState === 'running').length }; }, LIVE);
        assert.deepEqual(rest, { swap: false, dragging: false, settling: false, y: 0, running: 0 }, 'a refused throw on a FRESH sheet springs back to rest and does not replay the rise');
      }
      await DOORS[door](kit);
      assert.ok(await gone(kit), `the second ${door} closes it`);
      assert.equal(await toastNow(kit), null, `and the second ${door} takes the instruction with it`);
    }
  }],
  ['the warning: a reflex second press is ignored, it outlives 1.8 s, an edit or a lost toast is warned afresh', async (kit) => {
    const said = await tr(kit, 'sheet_dirty_close');
    await openManual(kit, 'QA typed');
    await kit.page.keyboard.press('Escape');
    await kit.page.keyboard.press('Escape');
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'a second press inside the reflex window is the same press twice: ignored');
    await pause(kit, 2000);
    assert.deepEqual(await toastNow(kit), { msg: said, undo: false }, 'the instruction is still up 2 s later (a plain toast lasts 1.8 s)');
    await pause(kit, 3400);
    assert.deepEqual(await toastNow(kit), { msg: said, undo: false }, 'and 5.4 s later: there is no clock on the answer');
    // More typing withdraws the warning: the next press is the FIRST press about the sheet as it now is.
    await kit.page.locator(LIVE + ' #mf-cal').fill('250');
    await kit.page.keyboard.press('Escape');
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'after more typing the next press warns afresh instead of discarding');
    // The warning no longer on screen (another toast, a navigation): the press that follows cannot count as the answer to it.
    await pause(kit, REFLEX);
    await kit.ev(() => hideToast());
    await kit.page.keyboard.press('Escape');
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'with the instruction gone the next press warns again');
    assert.deepEqual(await toastNow(kit), { msg: said, undo: false });
    await pause(kit, REFLEX);
    await kit.page.keyboard.press('Escape');
    assert.ok(await gone(kit), 'and the press after that closes');
  }],
  ['a held key is one press: Escape kept down does not answer its own warning', async (kit) => {
    await openManual(kit, 'QA typed');
    await kit.page.keyboard.down('Escape');
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'the press is refused');
    await pause(kit, REFLEX);
    await kit.page.keyboard.down('Escape');   // a second down with no up between: the OS auto-repeat (repeat: true)
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'the repeat of a held Escape is not the confirming press');
    assert.equal(await kit.ev(() => document.getElementById('mf-name').value), 'QA typed');
    await kit.page.keyboard.up('Escape');
    await kit.page.keyboard.press('Escape');
    assert.ok(await gone(kit), 'a NEW press after the key is let go is the answer');
  }],
  ['a Save and a close by code are never asked', async (kit) => {
    const before = await kit.ev(() => DB.foodLogs.listForDate(todayISO()).length);
    await openManual(kit, 'QA saved');
    await kit.page.locator(LIVE + ' #mf-cal').fill('250');
    await kit.page.locator(LIVE + ' #mf-save').click();
    assert.ok(await gone(kit), 'Save closes the sheet at once');
    assert.equal(await kit.ev(() => DB.foodLogs.listForDate(todayISO()).length), before + 1, 'and the food is logged');
    assert.notEqual((await toastNow(kit) || {}).msg, await tr(kit, 'sheet_dirty_close'), 'with no «unsaved» warning');
    await openManual(kit, 'QA typed');
    await kit.ev(() => closeModal());
    assert.ok(await gone(kit), 'closeModal() — a hand-over, an owner change, a test reset — closes a dirty sheet unasked');
  }],
  ['the session sheet: prefilled is not dirty; a changed figure is, on the labelled Cancel too; a control pressed withdraws the warning', async (kit) => {
    const exId = await kit.ev(() => DB.exercises.list()[0].id);
    await reset(kit, 'home');
    await kit.ev((id) => openSessionModal(id), exId);
    assert.equal(await kit.ev((sel) => document.querySelector(sel + ' #sets-editor input[data-field="reps"]').value, LIVE), '8', 'the sheet opens prefilled from the last session');
    await kit.page.keyboard.press('Escape');
    assert.ok(await gone(kit), 'a prefilled, untouched session sheet closes at once');
    await reset(kit, 'home');
    await kit.ev((id) => openSessionModal(id), exId);
    await kit.page.locator(LIVE + ' #sets-editor input[data-field="reps"]').first().fill('12');
    const cancel = kit.page.locator(LIVE + ' .form-actions [data-close]');
    await cancel.click();
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'Cancel beside Save is a way out like the X: the first press is refused');
    assert.equal((await toastNow(kit) || {}).msg, await tr(kit, 'sheet_dirty_close'));
    await pause(kit, REFLEX);
    await kit.page.locator(LIVE + ' #add-set-btn').click();
    await cancel.click();
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'a set added after the warning: the next press warns afresh');
    await pause(kit, REFLEX);
    await cancel.click();
    assert.ok(await gone(kit), 'and the one after closes');
    assert.equal(await kit.ev((id) => DB.sessions.listByExercise(id).length, exId), 1, 'nothing was saved by a discard');
  }],
  ['the meal editor and the recipe editor: a saved one opened and closed untouched is clean; an edit is dirty', async (kit) => {
    const ids = await kit.ev(() => {
      if (!DB.mealBundles.list().some((b) => b.name === 'QA meal')) DB.mealBundles.update(null, { name: 'QA meal', favorite: false, items: [{ name: 'QA item', calories: 100, protein: 5, carbs: 10, fat: 2, servings: 1 }] });
      if (!DB.recipes.list().some((r) => r.name === 'QA rec')) DB.recipes.add({ name: 'QA rec', servings: 2, items: [{ name: 'oats', qty: '80 g', calories: 300, protein: 10, carbs: 54, fat: 5 }] });
      return { meal: DB.mealBundles.list().find((b) => b.name === 'QA meal').id, rec: DB.recipes.list().find((r) => r.name === 'QA rec').id };
    });
    const said = await tr(kit, 'sheet_dirty_close');
    const openMeal = async () => { await reset(kit, 'food'); await kit.ev((id) => openMealEditor(DB.mealBundles.list().find((b) => b.id === id)), ids.meal); };
    const openRec = async () => { await reset(kit, 'food'); await kit.ev((id) => openRecipeEditor(null, DB.recipes.list().find((r) => r.id === id), () => {}), ids.rec); await kit.page.locator(LIVE + ' #rec-rows .rec-row').first().waitFor({ timeout: 4000 }); };
    const X = () => kit.page.locator(LIVE + ' .modal-header [data-close]').click();

    await openMeal();
    assert.equal(await kit.ev((sel) => document.querySelector(sel + ' [data-portion]').inputMode, LIVE), 'decimal', 'a portion of 1.5 gets the decimal keyboard');
    await X();
    assert.ok(await gone(kit), 'a saved meal opened and closed untouched closes at once');
    await openMeal();
    await kit.page.locator(LIVE + ' #cx-favorite').click();
    await X();
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'a meal with its favourite box changed is dirty');
    assert.equal((await toastNow(kit) || {}).msg, said);
    // The instruction stands until answered, so the sheet makes room for it: Save stays pressable.
    // By RECTANGLES, not by hit-testing: a plain toast lets taps through, so it
    // can lie on a button and hide its label while the button still answers.
    // Measured without the room: the toast (y 691–732) lay on Save (694–738).
    assert.deepEqual(await kit.ev((sel) => {
      const m = document.querySelector(sel + ' .modal'); m.scrollTop = m.scrollHeight;
      const tr = document.getElementById('toast').getBoundingClientRect();
      return [...m.querySelectorAll('button')].filter((b) => b.offsetParent !== null).filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > tr.top && r.top < tr.bottom && r.right > tr.left && r.left < tr.right; }).map((b) => b.id || b.className);
    }, LIVE), [], 'the instruction lies on none of the sheet\'s buttons: the sheet makes room for it');

    await openRec();
    await X();
    assert.ok(await gone(kit), 'a saved recipe opened and closed untouched closes at once');
    await openRec();
    await kit.page.locator(LIVE + ' #rec-name').fill('QA rec renamed');
    await X();
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'a renamed recipe is dirty');
    assert.equal((await toastNow(kit) || {}).msg, said);
    await pause(kit, REFLEX);
    await X();
    assert.ok(await gone(kit));
    assert.equal(await kit.ev((id) => DB.recipes.list().find((r) => r.id === id).name, ids.rec), 'QA rec', 'the discard saved nothing');

    // A lone import draft is held by NOTHING else: unsaved work from the moment it opens.
    const draft = { name: 'QA draft', servings: 1, items: [{ name: 'rice', qty: '100 g', calories: 130, protein: 2, carbs: 28, fat: 0 }] };
    await reset(kit, 'food');
    await kit.ev((d) => openRecipeEditor(null, d, () => {}), draft);
    await kit.page.locator(LIVE + ' #rec-rows .rec-row').first().waitFor({ timeout: 4000 });
    await X();
    await pause(kit, 60);
    assert.equal(await up(kit), true, 'a single imported draft, untouched, still refuses the first close');
    assert.equal((await toastNow(kit) || {}).msg, said);
    await pause(kit, REFLEX);
    await X();
    assert.ok(await gone(kit));
    // …while a draft the dish chooser still holds (it passes onClose) closes at once.
    await reset(kit, 'food');
    await kit.ev((d) => openRecipeEditor(null, d, () => {}, { onClose: () => {} }), draft);
    await kit.page.locator(LIVE + ' #rec-rows .rec-row').first().waitFor({ timeout: 4000 });
    await X();
    assert.ok(await gone(kit), 'a chooser dish opened and closed untouched closes at once');
  }],
  ['deleting a weight entry offers Undo, and the Undo puts it back', async (kit) => {
    await reset(kit, 'home');
    const before = await kit.ev(() => {
      DB.bodyweight.list().forEach((e) => DB.bodyweight.remove(e.date));
      DB.undo.clear();
      for (let i = 0; i < 3; i++) DB.bodyweight.log(addDaysISO(todayISO(), -i), 80 + i);
      openWeightSheet();
      return JSON.stringify(DB.bodyweight.list());
    });
    await kit.page.locator(LIVE + ' [data-del-weight]').first().click();
    assert.equal(await kit.ev(() => DB.bodyweight.list().length), 2, 'the entry is deleted');
    assert.deepEqual(await toastNow(kit), { msg: await tr(kit, 'weight_deleted'), undo: true }, 'and the toast names the deletion and offers Undo');
    assert.deepEqual(await kit.ev((sel) => { const o = document.querySelector(sel); return { up: !!o, rows: o ? o.querySelectorAll('.weight-row').length : -1 }; }, LIVE), { up: true, rows: 2 }, 'the sheet stays, repainted');
    await kit.page.locator('.toast.show .toast-action').click();
    assert.equal(await kit.ev(() => JSON.stringify(DB.bodyweight.list())), before, 'Undo restores the entry exactly');
  }],
  ['removing an exercise from a plan day offers Undo, and the Undo keeps the sets typed on the card beside it', async (kit) => {
    const ids = await kit.ev(() => {
      const [a, b] = DB.exercises.list().map((e) => e.id);
      DB.plan.setRotation({ cycle: [{ name: 'QA day', exerciseIds: [a, b] }], trainingDays: [0, 1, 2, 3, 4, 5, 6], anchor: todayISO() });
      DB.undo.clear();
      return { a, b, today: todayISO() };
    });
    await reset(kit, 'session-day', { date: ids.today });
    const typed = kit.page.locator(`[data-ex-card="${ids.b}"] .sd-set-row input[data-field="reps"]`).first();
    await typed.fill('13');
    await kit.page.locator(`[data-ex-card="${ids.a}"] .sd-set-row input[data-field="reps"]`).first().fill('7');
    await kit.page.locator(`[data-ex-card="${ids.a}"] [data-remove-ex]`).click();
    assert.deepEqual(await kit.ev(() => DB.plan.get().cycle[0].exerciseIds), [ids.b], 'the exercise left the day');
    assert.deepEqual(await toastNow(kit), { msg: await tr(kit, 'exercise_removed'), undo: true }, 'and the toast offers Undo');
    await kit.page.locator('.toast.show .toast-action').click();
    assert.deepEqual(await kit.ev(() => DB.plan.get().cycle[0].exerciseIds), [ids.a, ids.b], 'Undo puts it back, in place');
    assert.equal(await kit.page.locator(`[data-ex-card="${ids.a}"]`).count(), 1, 'its card is drawn again');
    assert.equal(await kit.page.locator(`[data-ex-card="${ids.b}"] .sd-set-row input[data-field="reps"]`).first().inputValue(), '13', 'and the set typed on the other card is still there');
    assert.equal(await kit.page.locator(`[data-ex-card="${ids.a}"] .sd-set-row input[data-field="reps"]`).first().inputValue(), '7', 'and so is the set typed on the card that was removed and put back');
  }],
  ['clearing the notification log asks first', async (kit) => {
    // Yesterday's: «Earlier» (and its clear row) lists the days before today.
    await kit.ev(() => { DB.notif.logClear(); for (let i = 0; i < 2; i++) DB.notif.logAdd({ tag: 'qa:' + i, date: addDaysISO(todayISO(), -1), at: '09:0' + i, title: 'QA ' + i, body: 'QA body', channel: 'summary' }); });
    await reset(kit, 'notifications');
    const count = () => kit.ev(() => DB.notif.logList(50).length);
    assert.equal(await count(), 2);
    await kit.page.locator('#ntfa-clear').click();
    assert.equal(await kit.page.locator(LIVE + ' .confirm-dialog').count(), 1, 'the tap raises a question');
    assert.equal(await kit.ev((sel) => { const d = document.querySelector(sel + ' .confirm-dialog'), n = document.getElementById(d.getAttribute('aria-labelledby') || ''); return n ? n.textContent.trim() : null; }, LIVE), await tr(kit, 'notif_clear_log_confirm'), 'and the dialog is NAMED by its question');
    assert.equal(await count(), 2, 'and erases nothing yet');
    await kit.page.locator(LIVE + ' [data-close]').click();
    assert.ok(await gone(kit));
    assert.equal(await count(), 2, 'Cancel keeps the history');
    await kit.page.locator('#ntfa-clear').click();
    await kit.page.locator(LIVE + ' [data-ok]').click();
    assert.equal(await count(), 0, 'the confirmation clears it');
    assert.deepEqual(await toastNow(kit), { msg: await tr(kit, 'notif_cleared'), undo: false });
    assert.deepEqual(await kit.ev(() => ({ button: !!document.getElementById('ntfa-clear'), focus: !!document.activeElement && document.activeElement.hasAttribute('data-back') })), { button: false, focus: true }, 'the row is gone with the history, and focus lands on the way back, not <body>');
  }],
  ['an edit opens on the dialog and raises no keyboard; a new item opens on its name; the fields carry their caps', async (kit) => {
    const ids = await kit.ev(() => {
      if (!DB.exercises.list().some((e) => e.name === 'QA custom')) DB.exercises.add({ name: 'QA custom', category: 'Chest' });
      if (!DB.supplements.list().some((s) => s.name === 'QA supp')) DB.supplements.add({ name: 'QA supp', dose: '5 g', times: [] });
      if (!DB.foods.list().some((f) => f.name === 'QA food')) DB.foods.add({ name: 'QA food', serving: '100 g', calories: 100, protein: 1, carbs: 1, fat: 1 });
      return { ex: DB.exercises.list().find((e) => e.name === 'QA custom').id, supp: DB.supplements.list().find((s) => s.name === 'QA supp').id, food: DB.foods.list().find((f) => f.name === 'QA food').id };
    });
    const focus = async (open, arg) => {
      await reset(kit, 'home');
      await kit.ev(({ open, arg }) => { window[open](arg || undefined); }, { open, arg });
      await pause(kit, 160);   // past the 60 ms deferred focus the food editor keeps for a new item
      return kit.ev((sel) => { const a = document.activeElement, o = document.querySelector(sel); return a === o.querySelector('.modal') ? 'dialog' : (a && a.id) || (a && a.tagName); }, LIVE);
    };
    assert.equal(await focus('openNewExerciseModal', ids.ex), 'dialog', 'editing an exercise does not take the name field');
    assert.equal(await focus('openNewExerciseModal'), 'ex-name', 'a new exercise does');
    assert.equal(await kit.ev(() => document.getElementById('ex-name').maxLength), 100);
    assert.equal(await focus('openSupplementModal', ids.supp), 'dialog', 'editing a supplement does not take the name field');
    assert.equal(await focus('openSupplementModal'), 'supp-name', 'a new supplement does');
    assert.deepEqual(await kit.ev(() => [document.getElementById('supp-name').maxLength, document.getElementById('supp-dose').maxLength]), [40, 40]);
    assert.equal(await focus('openFoodModal', ids.food), 'dialog', 'editing a saved food does not take the name field');
    assert.equal(await focus('openFoodModal'), 'food-name', 'a new food does');
    assert.deepEqual(await kit.ev(() => [document.getElementById('food-name').maxLength, document.getElementById('food-unit').maxLength]), [80, 24]);
    // The deferred focus takes the caret only from the dialog: a field taken inside its 60 ms keeps it.
    await reset(kit, 'home');
    await kit.ev((sel) => { openFoodModal(); document.querySelector(sel + ' #food-unit').focus(); }, LIVE);
    await pause(kit, 160);
    assert.equal(await kit.ev(() => document.activeElement && document.activeElement.id), 'food-unit', 'a field tapped at once keeps its caret');
    assert.equal(await kit.ev(() => document.documentElement.getAttribute('translate')), 'no', 'the page tells a browser translator to leave the bilingual app alone');
  }],
];

async function run() {
  const srv = start('out');
  const origin = await srv.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  let passed = 0;
  try {
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      const kit = await openPage(browser, origin, { lang, theme });
      for (const [name, fn] of CASES) {
        if (ONLY && !name.includes(ONLY)) continue;
        try { await fn(kit); passed++; console.log(`  ok    ${lang}/${theme}  ${name}`); }
        catch (e) { failures.push(`${lang}/${theme}  ${name}: ${e.message}`); console.log(`  FAIL  ${lang}/${theme}  ${name}\n        ${e.message.split('\n')[0]}`); }
      }
      if (kit.errors.length) failures.push(`${lang}/${theme} page errors: ${kit.errors.join(' | ')}`);
      kit.guard.assertContained();
      await kit.ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  if (failures.length) { console.error(`FAIL  data safety UI: ${failures.length} failure(s)`); failures.forEach((f) => console.error('  - ' + f)); process.exitCode = 1; return; }
  console.log(`PASS  data safety UI (${passed} cases, AR/dark + EN/light, 375px): a dirty sheet refuses each of five doors once, says why and closes on the second press; a clean sheet, a Save and a code close are never asked; the warning has no clock, ignores a reflex or held press and is renewed by an edit or a lost toast; the weight and plan-exercise deletes offer an Undo that keeps typed sets; the log clear asks first; an edit opens on the dialog`);
}

if (require.main === module) run().catch((e) => { console.error(e); process.exitCode = 1; });
