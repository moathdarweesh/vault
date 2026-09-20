// The sheets and dialogs — every top-level `open*` in the view scripts
// (js/ui.js, js/body.js, js/food.js, js/app.js) plus the five dialogs, and the
// arguments each one needs to open over the seeded fixture.
//
// ⚠️ A SHEET THAT IS NOT IN THIS LIST IS OUTSIDE THE NET. The matrix (stage 2)
// navigates VIEWS; most of what the food domain does lives in sheets, and a
// moved sheet that broke would have passed it. Contract 36 compares this file
// against the `function open*(` declarations in every view script: a new opener
// either joins the net here or is named in SKIP with a reason, or the commit
// fails.
//
// Arguments are TOKENS resolved inside the page at capture time:
//   '$today' '$exerciseId' … — a field of the seeded fixture (scripts/fp/fixture.js)
//   '$noop'                  — () => {}
//   '$tmpl'                  — WORKOUT_TEMPLATES[0]
//   '$lightbox'              — an inline SVG data: URL
//   { v: … }                 — a literal
// `host` is the view the sheet is opened from (some read the current view).
'use strict';

const ENTRIES = [
  // Six sheets are NOT #modal-root sheets: they append their own overlay to .app
  // (the sheet-overlay family) or to body (the lightbox), so each names its root
  // and is closed by removing it — there is no closeModal() path for them.
  { id: 'notif-perm', name: 'openNotifPermSheet', args: [], host: 'notifications', root: '#notif-perm-overlay', closeBy: 'remove' },
  { id: 'time-entry-supps', name: 'openTimeEntryModal', args: [{ v: { kind: 'supps' } }, '$noop'], host: 'notifications' },
  { id: 'time-entry-food', name: 'openTimeEntryModal', args: [{ v: { kind: 'food' } }, '$noop'], host: 'notifications' },
  { id: 'lightbox', name: 'openImageLightbox', args: ['$lightbox', { v: 'photo' }], host: 'exercises', root: '.img-lightbox', closeBy: 'remove' },
  { id: 'weight', name: 'openWeightSheet', args: [], host: 'home' },
  { id: 'weekly-review', name: 'openWeeklyReview', args: [], host: 'home' },
  { id: 'repeat-yesterday', name: 'openRepeatYesterday', args: ['$today', '$noop'], host: 'food' },
  { id: 'reorder', name: 'openReorderSheet', args: [{ v: 0 }, '$noop'], host: 'planner', root: '#reorder-sheet-overlay', closeBy: 'remove' },
  { id: 'add-exercise-chooser', name: 'openAddExerciseChooser', args: [{ v: 0 }, '$noop'], host: 'planner' },
  { id: 'new-exercise', name: 'openNewExerciseModal', args: [{ v: null }], host: 'exercises' },
  { id: 'edit-exercise', name: 'openNewExerciseModal', args: ['$exerciseId'], host: 'exercises' },
  { id: 'session-new', name: 'openSessionModal', args: ['$exerciseId'], host: 'exercise-detail' },
  { id: 'session-edit', name: 'openSessionModal', args: ['$exerciseId', '$sessionId'], host: 'exercise-detail' },
  { id: 'cardio-new', name: 'openCardioModal', args: [], host: 'cardio' },
  { id: 'cardio-edit', name: 'openCardioModal', args: ['$cardioId'], host: 'cardio' },
  { id: 'cardio-schedule-new', name: 'openCardioScheduleModal', args: [], host: 'workouts' },
  { id: 'cardio-schedule-edit', name: 'openCardioScheduleModal', args: ['$cardioPlanId'], host: 'workouts' },
  { id: 'cardio-type-new', name: 'openNewCardioTypeModal', args: ['$noop'], host: 'cardio' },
  { id: 'add-sheet', name: 'openAddSheet', args: ['$today', '$noop'], host: 'food', root: '#add-sheet-overlay', closeBy: 'remove' },
  { id: 'rest', name: 'openRestSheet', args: [], host: 'home', root: '#rest-sheet-overlay', closeBy: 'remove' },
  { id: 'train-anyway', name: 'openTrainAnywaySheet', args: [], host: 'home', root: '#rest-sheet-overlay', closeBy: 'remove' },
  { id: 'calculator', name: 'openCalculatorModal', args: ['$noop'], host: 'food' },
  { id: 'manual-food', name: 'openManualFoodEntry', args: ['$today', '$noop'], host: 'food' },
  { id: 'recipe-new', name: 'openRecipeEditor', args: ['$today', { v: null }, '$noop'], host: 'food' },
  { id: 'recipe-edit', name: 'openRecipeEditor', args: ['$today', '$recipe', '$noop'], host: 'food' },
  { id: 'saved-foods', name: 'openSavedFoodPicker', args: ['$today', '$noop', { v: 'foods' }], host: 'food' },
  { id: 'saved-recipes', name: 'openSavedFoodPicker', args: ['$today', '$noop', { v: 'recipes' }], host: 'food' },
  { id: 'saved-bundles', name: 'openSavedFoodPicker', args: ['$today', '$noop', { v: 'bundles' }], host: 'food' },
  { id: 'food-new', name: 'openFoodModal', args: [], host: 'food' },
  { id: 'food-edit', name: 'openFoodModal', args: ['$foodId'], host: 'food' },
  { id: 'food-library', name: 'openFoodLibraryModal', args: [], host: 'food' },
  { id: 'sleep-new', name: 'openSleepModal', args: [], host: 'sleep' },
  { id: 'sleep-edit', name: 'openSleepModal', args: ['$sleepId'], host: 'sleep' },
  { id: 'recent-changes', name: 'openRecentChanges', args: [], host: 'settings' },
  { id: 'search', name: 'openUnifiedSearch', args: [], host: 'home' },
  { id: 'search-day', name: 'openSearchDay', args: ['$today'], host: 'home' },
  { id: 'meal-new', name: 'openMealEditor', args: [], host: 'food' },
  { id: 'meal-edit', name: 'openMealEditor', args: ['$bundle'], host: 'food' },
  { id: 'meal-portion', name: 'openMealPortion', args: ['$bundle', '$today', '$noop'], host: 'food' },
  { id: 'shopping', name: 'openShoppingList', args: [], host: 'food' },
  { id: 'previous-programs', name: 'openPreviousPrograms', args: [], host: 'workouts' },
  { id: 'plan-image-import', name: 'openPlanImageImport', args: [], host: 'planner' },
  { id: 'plan-targets', name: 'openPlanTargetsEditor', args: [{ v: 0 }], host: 'workouts' },
  { id: 'templates', name: 'openTemplatesModal', args: [], host: 'planner' },
  { id: 'schedule', name: 'openScheduleModal', args: ['$tmpl'], host: 'planner' },
  { id: 'slot-editor', name: 'openSlotEditorModal', args: [{ v: 0 }, '$noop'], host: 'planner' },
  { id: 'reminders', name: 'openRemindersModal', args: [], host: 'settings' },
  { id: 'supplement-new', name: 'openSupplementModal', args: [], host: 'supplements' },
  { id: 'supplement-edit', name: 'openSupplementModal', args: ['$supplementId'], host: 'supplements' },
  // the dialogs
  { id: 'confirm', name: 'confirmDialog', args: [{ v: { title: 'Delete this?', text: 'It cannot be undone.' } }], host: 'settings', confirm: true },
  { id: 'unreadable', name: 'showUnreadableDialog', args: [], host: 'settings' },
  { id: 'conflict', name: 'showConflictDialog', args: [], host: 'settings' },
  { id: 'change-password', name: 'showChangePassword', args: [{ v: false }], host: 'settings' },
  { id: 'change-password-recovery', name: 'showChangePassword', args: [{ v: true }], host: 'settings' },
  { id: 'feedback', name: 'showFeedback', args: [], host: 'settings' },
];

/* Named, with the reason, so contract 36 can tell "left out on purpose" from
   "forgotten". Each one is a real gap in the net, stated rather than hidden. */
const SKIP = {
  openModal: 'the primitive every entry above goes through, not a sheet of its own (js/ui.js)',
  openBarcodeScanner: 'needs a camera (getUserMedia) — a device-only surface; the fence would block the stream anyway',
  openVoiceCapture: 'needs a microphone — device-only',
  openCoach: 'DORMANT by owner decision (v219): nothing calls it, so nothing can regress by moving it',
  openPreviousProgramPreview: 'takes an internal preview object built by openPreviousPrograms from cloud history the stub returns empty',
};

module.exports = { ENTRIES, SKIP };
