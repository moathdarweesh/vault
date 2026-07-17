// ==========================================================================
// THE VAULT - Main App
// ==========================================================================

// Single source of truth for the shipped build. Used by the visible build
// label AND the feedback version tag so they can never drift apart. Keep this
// equal to the ?v=N cache markers (see CLAUDE.md "CACHE WORKFLOW").
const VAULT_BUILD = 'v128';

// ==========================================================================
// Icons
// ==========================================================================
const ICONS = {
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  grip: '<line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="16" x2="20" y2="16"/>',
  droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  chart: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  dumbbell: '<path d="M4 9v6"/><path d="M7 7v10"/><path d="M10 10v4"/><path d="M14 10v4"/><path d="M17 7v10"/><path d="M20 9v6"/><path d="M10 12h4"/>',
  vault: '<path d="M4 8v8"/><path d="M8 6v12"/><path d="M11 9v6"/><path d="M14 9v6"/><path d="M17 6v12"/><path d="M20 8v8"/><path d="M11 12h3"/>',
  vaultDoor: '<rect x="3" y="3" width="18" height="18" rx="3.5"/><circle cx="12" cy="12" r="3.8"/><path d="M12 8.2V6"/><path d="M12 18v-2.2"/><path d="M8.2 12H6"/><path d="M18 12h-2.2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  run: '<circle cx="14" cy="4" r="2"/><path d="m4.5 22 3.5-7 4-2 4 5 4 1"/><path d="m12 13-4-2 1-4"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
  apple: '<path d="M12 10c-3 0-6 2-6 6s3 6 6 6 6-3 6-6-3-6-6-6Z"/><path d="M10 10c0-2 1-4 2-5"/><path d="M14 5c-.5.5-1 1.2-1.4 2"/>',
  home: '<path d="M3 12 12 3l9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m9 22 1.5-6 3-2 3 5 4 1"/><path d="m10 16-3-3 1-3"/>',
  bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17 11 7l3 7"/><circle cx="14" cy="6" r="1"/><path d="M14 7v3l-3 4"/>',
  treadmill: '<rect x="2" y="14" width="20" height="6" rx="1.5"/><path d="M5 14V9a2 2 0 0 1 2-2h2"/><path d="M9 7V5"/><circle cx="9" cy="3.5" r="1"/><path d="M5 20l-1.5 2"/><path d="M19 20l1.5 2"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  heartPulse: '<path d="M19 14c1.5-1.5 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h6.28"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>',
  backspace: '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.2"/>',
};

function icon(name, size = 20) {
  const path = ICONS[name] || '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

// ==========================================================================
// Workout templates (predefined)
// Each day's `exercises` are matched to user's library by name.
// ==========================================================================
const WORKOUT_TEMPLATES = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: '3-day classic split',
    days: [
      { name: 'Push', exercises: ['Bench Press', 'Overhead Press', 'Incline Bench Press', 'Lateral Raise', 'Tricep Pushdown'] },
      { name: 'Pull', exercises: ['Deadlift', 'Pull Up', 'Barbell Row', 'Dumbbell Curl', 'Hammer Curl'] },
      { name: 'Legs', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press Machine', 'Leg Curl Machine', 'Calf Raise'] },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: '4-day balanced split',
    days: [
      { name: 'Upper A', exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Pull Up', 'Dumbbell Curl', 'Tricep Pushdown'] },
      { name: 'Lower A', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press Machine', 'Leg Curl Machine', 'Calf Raise'] },
      { name: 'Upper B', exercises: ['Incline Bench Press', 'Lat Pulldown Machine', 'Dumbbell Press', 'Seated Row Machine', 'Hammer Curl', 'Overhead Cable Triceps'] },
      { name: 'Lower B', exercises: ['Deadlift', 'Front Squat', 'Hack Squat Machine', 'Leg Extension Machine', 'Seated Calf Raise'] },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: '3 full-body workouts',
    days: [
      { name: 'Day A', exercises: ['Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Plank'] },
      { name: 'Day B', exercises: ['Deadlift', 'Incline Bench Press', 'Pull Up', 'Lateral Raise', 'Crunches'] },
      { name: 'Day C', exercises: ['Leg Press Machine', 'Dumbbell Press', 'Lat Pulldown Machine', 'Dumbbell Curl', 'Tricep Pushdown'] },
    ],
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    description: '5-day bodybuilding split',
    days: [
      { name: 'Chest', exercises: ['Bench Press', 'Incline Bench Press', 'Dumbbell Press', 'Dumbbell Fly', 'Cable Crossover'] },
      { name: 'Back', exercises: ['Deadlift', 'Pull Up', 'Barbell Row', 'Lat Pulldown Machine', 'Seated Row Machine'] },
      { name: 'Legs', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press Machine', 'Leg Curl Machine', 'Calf Raise'] },
      { name: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly Machine', 'Shrugs'] },
      { name: 'Arms', exercises: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Tricep Extension', 'Triceps Dip Machine'] },
    ],
  },
];

// Server-provided "ready-made plans" (admin panel `preset_plans`, pulled at
// boot — see bootCatalog()). Same shape as a WORKOUT_TEMPLATES entry
// ({ id, name, description, days:[{name, exercises:[names]}] }) so they can
// flow through the exact same openScheduleModal()/DB.plan.applySchedule path.
// Starts empty so the templates browser is byte-for-byte unchanged offline or
// before the catalog has loaded (or is empty).
let SERVER_PRESET_PLANS = [];
function setServerPresetPlans(rows) {
  try {
    SERVER_PRESET_PLANS = (Array.isArray(rows) ? rows : [])
      .filter((p) => p && p.id && p.data && Array.isArray(p.data.days) && p.data.days.length)
      .map((p) => ({
        id: p.id,
        name: (p.name || 'Plan').toString(),
        description: (p.description || '').toString(),
        days: p.data.days
          .filter((d) => d && Array.isArray(d.exercises))
          .map((d) => ({ name: (d.name || 'Workout').toString(), exercises: d.exercises.filter((n) => typeof n === 'string') })),
      }))
      .filter((p) => p.days.length);
  } catch (_) { SERVER_PRESET_PLANS = []; }
}

// Exercise variations - alternative names for similar movements (case-sensitive name lookup)
const EXERCISE_VARIATIONS = {
  'Bench Press': ['Dumbbell Press', 'Incline Bench Press', 'Push Up', 'Chest Press Machine'],
  'Squat': ['Front Squat', 'Leg Press Machine', 'Hack Squat Machine', 'Smith Machine Squat'],
  'Deadlift': ['Romanian Deadlift', 'T-Bar Row Machine', 'Barbell Row'],
  'Overhead Press': ['Shoulder Press Machine', 'Smith Machine Shoulder Press', 'Lateral Raise'],
  'Barbell Row': ['Seated Row Machine', 'Lat Pulldown Machine', 'Iso-Lateral Row', 'Dumbbell Row'],
  'Pull Up': ['Lat Pulldown Machine', 'Seated Row Machine', 'Iso-Lateral Row'],
  'Lat Pulldown Machine': ['Pull Up', 'Iso-Lateral Row', 'Seated Row Machine'],
  'Seated Row Machine': ['Barbell Row', 'Iso-Lateral Row', 'Lat Pulldown Machine'],
  'Leg Press Machine': ['Squat', 'Hack Squat Machine', 'Lunges'],
  'Leg Curl Machine': ['Seated Leg Curl', 'Romanian Deadlift'],
  'Leg Extension Machine': ['Squat', 'Hack Squat Machine'],
  'Hack Squat Machine': ['Squat', 'Leg Press Machine', 'Front Squat'],
  'Dumbbell Press': ['Bench Press', 'Incline Bench Press', 'Chest Press Machine'],
  'Incline Bench Press': ['Bench Press', 'Incline Chest Press Machine', 'Dumbbell Press'],
  'Dumbbell Fly': ['Pec Deck Machine', 'Cable Crossover'],
  'Cable Crossover': ['Pec Deck Machine', 'Dumbbell Fly'],
  'Pec Deck Machine': ['Dumbbell Fly', 'Cable Crossover'],
  'Lateral Raise': ['Lateral Raise Machine', 'Cable Upright Row', 'Front Raise', 'Shoulder Press Machine'],
  'Lateral Raise Machine': ['Lateral Raise', 'Cable Upright Row', 'Shoulder Press Machine'],
  'Front Raise': ['Lateral Raise', 'Overhead Press'],
  'Rear Delt Fly': ['Rear Delt Fly Machine', 'Face Pull'],
  'Rear Delt Fly Machine': ['Rear Delt Fly', 'Face Pull'],
  'Shrugs': ['Cable Shrug'],
  'Barbell Curl': ['EZ Bar Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl Machine', 'Cable Curl'],
  'EZ Bar Curl': ['Barbell Curl', 'Preacher Curl Machine', 'Reverse Curl'],
  'Dumbbell Curl': ['Barbell Curl', 'Incline Dumbbell Curl', 'Hammer Curl', 'Concentration Curl'],
  'Incline Dumbbell Curl': ['Dumbbell Curl', 'Spider Curl', 'Concentration Curl'],
  'Concentration Curl': ['Dumbbell Curl', 'Spider Curl', 'Preacher Curl Machine'],
  'Spider Curl': ['Concentration Curl', 'Preacher Curl Machine', 'Incline Dumbbell Curl'],
  'Reverse Curl': ['Barbell Curl', 'Hammer Curl'],
  'Chin-Up': ['Pull Up', 'Lat Pulldown Machine', 'Barbell Curl'],
  'Preacher Curl Machine': ['Barbell Curl', 'EZ Bar Curl', 'Dumbbell Curl', 'Cable Curl'],
  'Hammer Curl': ['Dumbbell Curl', 'Reverse Curl', 'Barbell Curl'],
  'Tricep Pushdown': ['Overhead Cable Triceps', 'Tricep Extension', 'Triceps Dip Machine'],
  'Tricep Extension': ['Tricep Pushdown', 'Overhead Cable Triceps'],
  'Triceps Dip Machine': ['Tricep Pushdown', 'Tricep Extension', 'Dips'],
  'Dips': ['Triceps Dip Machine', 'Tricep Pushdown', 'Bench Press'],
  'Plank': ['Crunches', 'Leg Raise', 'Russian Twist'],
  'Crunches': ['Ab Crunch Machine', 'Leg Raise', 'Russian Twist'],
  'Ab Crunch Machine': ['Crunches', 'Leg Raise', 'Russian Twist'],
  'Calf Raise': ['Seated Calf Raise', 'Calf Raise Machine'],
  'Romanian Deadlift': ['Deadlift', 'Leg Curl Machine', 'Seated Leg Curl'],
  'Push Up': ['Bench Press', 'Dumbbell Press'],
  'Hip Abductor Machine': ['Hip Adductor Machine', 'Squat'],
  'Hip Adductor Machine': ['Hip Abductor Machine', 'Squat'],
};

// ==========================================================================
// Muscle groups — anterior / posterior mapping
// ==========================================================================
// Each exercise -> primary muscle keys. Custom/unmatched exercises fall back
// to a category-based default.
const EXERCISE_MUSCLES = {
  'Squat': ['quads', 'glutes'],
  'Bench Press': ['chest', 'front_delts', 'triceps'],
  'Deadlift': ['hamstrings', 'glutes', 'lower_back', 'lats'],
  'Incline Bench Press': ['upper_chest', 'front_delts', 'triceps'],
  'Dumbbell Press': ['chest', 'front_delts', 'triceps'],
  'Dumbbell Fly': ['chest'],
  'Push Up': ['chest', 'front_delts', 'triceps'],
  'Barbell Row': ['lats', 'upper_back'],
  'Pull Up': ['lats', 'biceps'],
  'Lat Pulldown': ['lats', 'biceps'],
  'Dumbbell Row': ['lats', 'upper_back'],
  'Seated Row': ['lats', 'upper_back'],
  'Front Squat': ['quads', 'glutes'],
  'Leg Press': ['quads', 'glutes'],
  'Leg Curl': ['hamstrings'],
  'Leg Extension': ['quads'],
  'Romanian Deadlift': ['hamstrings', 'glutes'],
  'Lunges': ['quads', 'glutes'],
  'Calf Raise': ['calves'],
  'Overhead Press': ['front_delts', 'triceps'],
  'Lateral Raise': ['side_delts'],
  'Front Raise': ['front_delts'],
  'Rear Delt Fly': ['rear_delts'],
  'Shrugs': ['traps'],
  'Barbell Curl': ['biceps'],
  'EZ Bar Curl': ['biceps'],
  'Dumbbell Curl': ['biceps'],
  'Incline Dumbbell Curl': ['biceps'],
  'Hammer Curl': ['biceps', 'forearms'],
  'Concentration Curl': ['biceps'],
  'Spider Curl': ['biceps'],
  'Reverse Curl': ['biceps', 'forearms'],
  'Chin-Up': ['biceps', 'lats'],
  'Tricep Pushdown': ['triceps'],
  'Tricep Extension': ['triceps'],
  'Dips': ['triceps', 'chest'],
  'Plank': ['abs'],
  'Crunches': ['abs'],
  'Leg Raise': ['abs'],
  'Russian Twist': ['abs'],
  'Chest Press Machine': ['chest', 'triceps'],
  'Incline Chest Press Machine': ['upper_chest', 'front_delts'],
  'Pec Deck Machine': ['chest'],
  'Cable Crossover': ['chest'],
  'Smith Machine Bench Press': ['chest', 'triceps'],
  'Lat Pulldown Machine': ['lats', 'biceps'],
  'Seated Row Machine': ['lats', 'upper_back'],
  'T-Bar Row Machine': ['lats', 'upper_back'],
  'Iso-Lateral Row': ['lats', 'upper_back'],
  'Back Extension': ['lower_back', 'glutes'],
  'Leg Press Machine': ['quads', 'glutes'],
  'Leg Extension Machine': ['quads'],
  'Leg Curl Machine': ['hamstrings'],
  'Hack Squat Machine': ['quads', 'glutes'],
  'Smith Machine Squat': ['quads', 'glutes'],
  'Seated Leg Curl': ['hamstrings'],
  'Seated Calf Raise': ['calves'],
  'Calf Raise Machine': ['calves'],
  'Hip Abductor Machine': ['glutes'],
  'Hip Adductor Machine': ['adductors'],
  'Shoulder Press Machine': ['front_delts'],
  'Lateral Raise Machine': ['side_delts'],
  'Rear Delt Fly Machine': ['rear_delts'],
  'Smith Machine Shoulder Press': ['front_delts'],
  'Face Pull': ['rear_delts'],
  'Cable Upright Row': ['side_delts', 'traps'],
  'Cable Shrug': ['traps'],
  'Preacher Curl Machine': ['biceps'],
  'Cable Curl': ['biceps'],
  'Triceps Dip Machine': ['triceps', 'chest'],
  'Overhead Cable Triceps': ['triceps'],
  'Ab Crunch Machine': ['abs'],
};

const CATEGORY_FALLBACK_MUSCLES = {
  Chest: ['chest'],
  Back: ['lats', 'upper_back'],
  Legs: ['quads', 'hamstrings'],
  Shoulders: ['front_delts'],
  Arms: ['biceps', 'triceps'],
  Core: ['abs'],
  Other: [],
};

const MUSCLE_INFO = {
  chest:        { side: 'anterior',  order: 1 },
  upper_chest:  { side: 'anterior',  order: 2 },
  front_delts:  { side: 'anterior',  order: 3 },
  side_delts:   { side: 'anterior',  order: 4 },
  biceps:       { side: 'anterior',  order: 5 },
  forearms:     { side: 'anterior',  order: 6 },
  abs:          { side: 'anterior',  order: 7 },
  quads:        { side: 'anterior',  order: 8 },
  adductors:    { side: 'anterior',  order: 9 },
  upper_back:   { side: 'posterior', order: 1 },
  lats:         { side: 'posterior', order: 2 },
  traps:        { side: 'posterior', order: 3 },
  rear_delts:   { side: 'posterior', order: 4 },
  triceps:      { side: 'posterior', order: 5 },
  lower_back:   { side: 'posterior', order: 6 },
  glutes:       { side: 'posterior', order: 7 },
  hamstrings:   { side: 'posterior', order: 8 },
  calves:       { side: 'posterior', order: 9 },
};

function getMusclesForExercise(ex) {
  if (!ex) return [];
  const direct = EXERCISE_MUSCLES[ex.name];
  if (direct) return direct;
  return CATEGORY_FALLBACK_MUSCLES[ex.category] || [];
}

// Given a list of exercise IDs (or a list of exercise objects), return
// { anterior: [muscleKey, ...], posterior: [muscleKey, ...] } — deduped + sorted.
function groupMusclesFromExercises(exercises) {
  const seen = new Set();
  const ant = [];
  const post = [];
  exercises.forEach((ex) => {
    if (!ex) return;
    getMusclesForExercise(ex).forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      const info = MUSCLE_INFO[m];
      if (!info) return;
      const item = { key: m, order: info.order };
      if (info.side === 'anterior') ant.push(item);
      else post.push(item);
    });
  });
  ant.sort((a, b) => a.order - b.order);
  post.sort((a, b) => a.order - b.order);
  return { anterior: ant.map((x) => x.key), posterior: post.map((x) => x.key) };
}

// ==========================================================================
// Weight unit conversions
// ==========================================================================
const KG_TO_LB = 2.20462;

function convertWeightForDisplay(kg) {
  const unit = (DB.prefs.get().unit) || 'kg';
  if (unit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2; // nearest 0.5 lb
  return kg;
}

function convertWeightToStorage(value) {
  // Convert user-entered value (in current unit) back to kg for storage
  const unit = (DB.prefs.get().unit) || 'kg';
  if (unit === 'lb') return Math.round((value / KG_TO_LB) * 100) / 100;
  return Number(value);
}

function unitLabel() {
  return ((DB.prefs.get().unit) || 'kg') === 'lb' ? 'lb' : 'kg';
}

function fmtWeight(kg) {
  return fmtNum(convertWeightForDisplay(kg));
}

// Dual-unit weight: shows primary unit (per user's pref) + the other unit beside it.
// Returns inline HTML: "<span>60</span><span>kg</span><span class="w-alt">132 lb</span>"
function fmtWeightDual(kg) {
  const primary = (DB.prefs.get().unit) || 'kg';
  const kgVal = Math.round(kg * 10) / 10;
  const lbVal = Math.round(kg * KG_TO_LB * 2) / 2;
  if (primary === 'lb') {
    return `<span class="w-num num">${fmtNum(lbVal)}</span><span class="w-unit">lb</span><span class="w-alt"><span class="num">${fmtNum(kgVal)}</span> kg</span>`;
  }
  return `<span class="w-num num">${fmtNum(kgVal)}</span><span class="w-unit">kg</span><span class="w-alt"><span class="num">${fmtNum(lbVal)}</span> lb</span>`;
}

// Dual-unit weight, rounded to whole numbers — used for big totals like volume.
function fmtWeightDualRound(kg) {
  const primary = (DB.prefs.get().unit) || 'kg';
  const kgVal = Math.round(kg);
  const lbVal = Math.round(kg * KG_TO_LB);
  if (primary === 'lb') {
    return `<span class="w-num num">${fmtNum(lbVal)}</span><span class="w-unit">lb</span><span class="w-alt"><span class="num">${fmtNum(kgVal)}</span> kg</span>`;
  }
  return `<span class="w-num num">${fmtNum(kgVal)}</span><span class="w-unit">kg</span><span class="w-alt"><span class="num">${fmtNum(lbVal)}</span> lb</span>`;
}

// Day-of-week name (0 = Sunday)
function dayName(dow, full = false) {
  const keys = full
    ? ['dow_sun_full', 'dow_mon_full', 'dow_tue_full', 'dow_wed_full', 'dow_thu_full', 'dow_fri_full', 'dow_sat_full']
    : ['dow_sun', 'dow_mon', 'dow_tue', 'dow_wed', 'dow_thu', 'dow_fri', 'dow_sat'];
  return t(keys[dow] || 'dow_sun');
}

// ==========================================================================
// i18n - Translations
// ==========================================================================
const I18N = {
  en: {
    app_name: 'THE VAULT',
    nav_home: 'Home', nav_train: 'Train', nav_cardio: 'Cardio', nav_food: 'Food', nav_sleep: 'Sleep',

    greet_morning: 'Good morning', greet_afternoon: 'Good afternoon', greet_evening: 'Good evening',

    cat_Chest: 'Chest', cat_Back: 'Back', cat_Legs: 'Legs',
    cat_Shoulders: 'Shoulders', cat_Arms: 'Arms', cat_Core: 'Core', cat_Other: 'Other',
    cat_All: 'All',

    // Muscle groups (for the planner)
    anterior: 'Anterior', posterior: 'Posterior',
    muscle_chest: 'Chest', muscle_upper_chest: 'Upper Chest',
    muscle_front_delts: 'Front Delts', muscle_side_delts: 'Side Delts', muscle_rear_delts: 'Rear Delts',
    muscle_biceps: 'Biceps', muscle_triceps: 'Triceps', muscle_forearms: 'Forearms',
    muscle_abs: 'Abs',
    muscle_upper_back: 'Upper Back', muscle_lats: 'Lats', muscle_traps: 'Traps',
    muscle_lower_back: 'Lower Back',
    muscle_quads: 'Quads', muscle_hamstrings: 'Hamstrings', muscle_glutes: 'Glutes', muscle_calves: 'Calves',
    muscle_adductors: 'Adductors',
    rest_day_muscles: 'No muscles scheduled',

    // Home
    streak_one_day: '1 day', streak_days: 'days',
    streak_active: 'Active streak — keep it going!',
    streak_start: 'Log a session to start your streak',
    workouts: 'Workouts', volume: 'Volume', cardio: 'Cardio', last_sleep: 'Last sleep',
    sessions_label: 'Sessions',
    sessions_this_week: 'sets this week',
    total_this_week: 'total this week',
    this_week: 'this week',
    no_data: 'no data yet',
    muscle_focus: 'Muscle Focus',
    muscle_focus_sub: 'Sessions per muscle · last 7 days',
    compare_progress: 'Compare Progress',
    compare_progress_sub: 'Week-over-week trends across all activity.',
    recent_activity: 'Recent Activity',

    // Train / Workouts
    train: 'Train', cardio_title: 'Cardio', food: 'Food', sleep: 'Sleep', compare: 'Compare', settings: 'Settings',
    library: 'Library',
    train_subtitle: 'Tap an exercise to log a session or view your history.',
    search_exercises: 'Search exercises…',
    new_exercise: 'New Exercise',
    new_exercise_sub: 'Add a custom exercise to your library.',
    add_custom: 'Add a custom one',
    no_exercises_cat: 'No exercises in this category',
    no_exercises_cat_hint: 'Try a different filter or add a custom exercise.',
    no_matches: 'No matches found',
    no_matches_hint: 'Try a different search term.',
    no_sessions_yet: 'No sets yet',
    custom: 'Custom',
    custom_exercise_label: 'CUSTOM EXERCISE',

    // Exercise detail
    log_session: 'Log Session',
    edit_session: 'Edit Session',
    log_session_tap: 'Tap "Log Session" to record your first set.',
    max_weight: 'Max Weight', max_reps: 'Max Reps', sessions_n: 'Sets',
    exercise: 'exercise', exercises: 'exercises',
    history: 'History',
    sets_logged: 'sets logged', no_sessions: 'No sets yet',
    total_sets: 'Total Sets',
    pr: 'PR',
    volume_label: 'Volume',
    set_n: 'Set',
    reps: 'reps', weight_kg: 'kg',
    last_session: 'Last session',
    date: 'Date',
    sets: 'Sets',
    add_set: 'Add Set',
    set_min_one: 'At least one set is required',
    add_at_least_one: 'Add at least one set',
    session_saved: 'Session saved',
    session_updated: 'Session updated',
    session_deleted: 'Session deleted',
    delete_session_q: 'Delete session?',
    delete_session_text: 'This session will be permanently removed from your history.',
    delete_exercise_q: 'Delete exercise?',
    delete_exercise_text: 'This exercise and all its session history will be removed.',
    exercise_deleted: 'Exercise deleted',
    exercise_added: 'Exercise added',
    enter_name: 'Enter a name',
    name: 'Name', category: 'Category',
    save: 'Save', cancel: 'Cancel', update: 'Update', delete: 'Delete', edit: 'Edit', select: 'Select',
    unit: 'Unit', done: 'Done',
    not_found: 'Not found', not_found_text: 'This exercise no longer exists.',

    // Cardio
    cardio_subtitle: 'Treadmill, walking, and cycling sessions.',
    no_cardio: 'No cardio yet',
    no_cardio_text: 'Log your first treadmill, walk, or ride with the button above.',
    close: 'Close',
    all_sessions: 'All Sessions',
    log: 'Log',
    log_cardio: 'Log Cardio', edit_cardio: 'Edit Cardio',
    cardio_quick: 'Quick log: type, duration, calories.',
    type: 'Type',
    duration_min: 'Duration (min)',
    calories: 'Calories',
    sessions_w: 'Sessions', minutes: 'Minutes',
    enter_duration: 'Enter a duration',
    delete_cardio_q: 'Delete cardio session?',
    delete_cardio_text: 'This session will be removed from your history.',
    saved: 'Saved', updated: 'Updated', deleted: 'Deleted',
    treadmill: 'Treadmill', walking: 'Walking', running: 'Running', cycling: 'Cycling',
    new_cardio_type: 'New Cardio Type',
    new_cardio_type_sub: 'Create your own cardio activity.',
    cardio_type_name_ph: 'e.g. Stairs, Rowing',
    icon: 'Icon',
    enter_name: 'Enter a name',

    // Food
    food_subtitle: 'Your personal reference of foods and their macros.',
    // Nutrition dashboard
    nutri_setup_title: 'Set your daily goal',
    nutri_setup_text: 'Calculate your calories & macros to start tracking.',
    nutri_left: 'left',
    nutri_over: 'over',
    nutri_calories: 'Calories',
    nutri_today: "Today's food",
    nutri_empty_title: 'Nothing logged yet',
    nutri_empty_text: 'Tap + to add what you ate today.',
    coach_title: 'AI Coach',
    coach_sub: 'What to eat to hit your remaining macros',
    coach_thinking: 'Thinking…',
    coach_unavailable: 'Coach is unavailable right now.',
    add_sheet_title: 'Add food',
    add_voice: 'Voice', add_voice_sub: 'Say what you ate',
    add_chat: 'Chat', add_chat_sub: 'Type it — AI finds the calories',
    add_photo: 'Photo', add_photo_sub: 'Snap your meal',
    add_saved: 'Saved food', add_saved_sub: 'Pick from your foods',
    add_manual: 'Manual', add_manual_sub: 'Enter the numbers yourself',
    saved_new: 'Add a new saved food', saved_empty: 'No saved foods yet',
    calc_title: 'Calorie calculator', calc_sub: 'Mifflin-St Jeor — the gold standard',
    calc_mode_calc: 'Calculate', calc_mode_manual: 'Enter manually',
    calc_sex: 'Sex', calc_male: 'Male', calc_female: 'Female',
    calc_age: 'Age', calc_height: 'Height (cm)', calc_weight: 'Weight (kg)',
    calc_activity: 'Activity', calc_goal: 'Goal',
    activity_sedentary: 'Sedentary', activity_light: 'Light', activity_moderate: 'Moderate', activity_active: 'Active', activity_very_active: 'Very active',
    goal_cut: 'Cut', goal_maintain: 'Maintain', goal_bulk: 'Bulk',
    calc_tdee: 'Maintenance', calc_bmr: 'BMR', calc_fill_hint: 'Fill in age, height and weight.',
    manual_food_title: 'Add food', manual_food_ph: 'e.g. Chicken & rice',
    voice_tap: 'Tap to speak', voice_listening: 'Listening… tap to stop',
    voice_processing: 'Understanding…', voice_denied: 'Microphone access denied.',
    voice_unsupported: 'Voice needs the latest app build.',
    no_foods_yet: 'No foods yet',
    no_foods_text: 'Build your personal reference of foods you eat regularly.',
    no_matches_simple: 'No matches',
    no_matches_text: 'Try a different search.',
    reference_items: 'Reference',
    search_foods: 'Search foods…',
    add: 'Add',
    food_library_title: 'Add from Library',
    food_library_sub: 'Tap a food to add it to your list.',
    add_manually: 'Add manually',
    fcat_protein: 'Protein',
    fcat_carbs: 'Grains & Carbs',
    fcat_legumes: 'Legumes',
    fcat_dairy: 'Dairy',
    fcat_fruit: 'Fruits',
    fcat_veg: 'Vegetables',
    fcat_fats: 'Nuts & Fats',
    fcat_meals: 'Meals',
    fcat_drinks: 'Drinks',
    fcat_more: 'More',
    new_food: 'New Food', edit_food: 'Edit Food',
    food_quick: 'Macros per serving.',
    serving_opt: 'Serving (optional)', serving_hint: 'e.g. 100g, 1 cup',
    amount_label: 'Amount', serving_unit_label: 'Unit', unit_hint: 'g, ml, piece',
    ph_exercise_name: 'e.g. Bulgarian Split Squat', ph_food_name: 'e.g. Chicken Breast', ph_supplement_name: 'e.g. Creatine',
    view_photo: 'View photo',
    protein_g: 'Protein (g)', carbs_g: 'Carbs (g)',
    delete_food_q: 'Delete food?',
    delete_food_text: 'This food will be removed from your reference list.',
    cal: 'cal', protein_label: 'protein', carbs_label: 'carbs', fat_label: 'fat',
    ai_chat_btn: 'AI', ai_chat_title: 'Calorie Chat', ai_chat_sub: 'Tell me what you ate — I log the calories',
    ai_chat_placeholder: 'e.g. breakfast: eggs & bread, lunch: a burger',
    ai_add_all: 'Add all',
    ai_need_key: 'A free Google Gemini API key is needed (one-time).',
    ai_key_step1: 'Get a free key from',
    ai_key_step2: 'Paste it below — it stays on your device only.',
    ai_key_label: 'Gemini API key',
    ai_save_key: 'Save key',
    ai_analyzing: 'calculating…',
    ai_photo: 'Photo',
    ai_no_result: 'No result — try rephrasing.',
    ai_add_to_log: 'Add to log',
    ai_added: 'Added',
    ai_error: 'Something went wrong',
    ai_rate_limit: 'The free AI service is busy right now — please try again in a minute.',
    ai_not_food: 'This chat is for food only — type a meal to calculate it.',

    // Auth / cloud sync
    auth_sub_in: 'Sign in to sync your data',
    auth_sub_up: 'Create an account to sync across devices',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_signin: 'Sign in',
    auth_signup: 'Create account',
    auth_toggle_to_up: "Don't have an account? Create one",
    auth_toggle_to_in: 'Already have an account? Sign in',
    auth_skip: 'Continue without an account',
    username_title: 'Choose your username',
    username_sub: 'A unique handle others will know you by. Required to continue.',
    username_ph: 'username',
    username_rules: '3–20 characters · letters, numbers and _ only',
    username_save: 'Save username',
    username_checking: 'Checking…',
    username_available_msg: 'Available ✓',
    username_taken: 'That username is already taken',
    username_invalid: 'Use 3–20 letters, numbers or _',
    username_saved: 'Username set',
    update_title: 'A new version is available',
    update_get: 'Download',
    update_later: 'Later',
    web_update_title: 'A new version is ready',
    web_update_action: 'Update',
    feedback_title: 'Send feedback',
    feedback_sub: 'Suggestions or issues — we read every one',
    feedback_ph: 'Your suggestion or feedback…',
    feedback_send: 'Send',
    feedback_sent: 'Thanks! Your feedback was sent',
    feedback_empty: 'Please write something first',
    account_blocked_title: 'Account unavailable',
    account_disabled_msg: 'Your account has been disabled. Please contact support.',
    account_banned_msg: 'Your account has been suspended.',
    auth_forgot: 'Forgot password?',
    auth_reset_title: 'Reset password',
    auth_reset_sub: 'Enter your email and we’ll send you a link to set a new password.',
    auth_reset_send: 'Send reset link',
    auth_reset_sent: 'Check your email for the reset link',
    auth_signing: 'Please wait…',
    auth_checking: 'Checking…',
    auth_err_fields: 'Enter your email and password',
    auth_pw_short: 'Password must be at least 6 characters',
    auth_signup_check_email: 'Account created — confirm via the email we sent, then sign in.',
    auth_err_invalid: 'Wrong email or password',
    auth_err_exists: 'This email already has an account — sign in instead',
    auth_err_email: 'Enter a valid email',
    auth_err_network: 'Connection problem — check your internet',
    auth_err_generic: 'Could not sign in. Try again.',
    auth_not_signed: 'Not signed in',
    auth_signin_sub: 'Sign in to sync your data across devices',
    account: 'Account',
    account_synced_sub: 'Your data syncs automatically',
    sync_now: 'Sync now',
    sync_now_sub: 'Pull the latest and push your changes',
    synced: 'Synced',
    syncing: 'Syncing your data…',
    cloud_backup_kept: 'Your cloud backup was kept safe — the empty data did not sync.',
    logout: 'Log out',
    logout_sub: 'Stop syncing on this device',
    logout_confirm: 'Your data stays on this device. Sign in again anytime to resume syncing.',
    change_password: 'Change password',
    change_password_sub: 'Set a new password for this account',
    change_password_new: 'New password',
    change_password_confirm: 'Confirm new password',
    change_password_mismatch: 'Passwords do not match',
    change_password_done: 'Password changed',
    conflict_title: 'Existing data found',
    conflict_text: 'Your account already has saved data. Which version do you want to keep?',
    conflict_cloud: 'Keep account data',
    conflict_local: "Keep this device's data",

    // Sleep
    sleep_subtitle: 'Track when you sleep and wake up.',
    no_sleep_logged: 'No sleep logged',
    no_sleep_text: 'Tap "Log" to record your first night of sleep.',
    nights_log: 'Log', nights_logged: 'Logged',
    last_night: 'Last Night', avg_7d: '7-Day Avg',
    log_sleep: 'Log Sleep', edit_sleep: 'Edit Sleep',
    sleep_quick: 'The date is the morning you woke up.',
    sleep_time: 'Sleep Time', wake_time: 'Wake Time',
    total_sleep: 'Total sleep',
    fill_all_fields: 'Fill all fields',
    delete_sleep_q: 'Delete sleep entry?',
    delete_sleep_text: 'This entry will be removed from your log.',

    // Compare
    compare_title: 'Compare',
    weekly: 'Weekly',
    compare_subtitle: 'This week versus last week.',
    this_week_label: 'This week', last_week_label: 'Last week',
    not_enough_data: 'Not enough data yet',
    not_enough_data_text: 'Log sessions across two weeks to see your progress here.',
    not_enough_cardio: 'Log cardio across two weeks to see your progress.',
    not_enough_sleep: 'Log sleep across two weeks to see progress.',
    same_as_last_week: 'Same as last week',
    no_data_short: 'No data',
    need_both_weeks: 'Need data from both weeks',
    total_minutes: 'Total Minutes', calories_burned: 'Calories Burned',
    avg_sleep: 'Average Sleep', nights_logged_t: 'Nights Logged',

    // Settings
    settings_title: 'Settings',
    settings_subtitle: 'Customize language, theme, and manage your data.',
    language: 'Language',
    theme: 'Theme',
    data: 'Data',
    theme_dark: 'Dark Vault', theme_dark_sub: 'Teal on black',
    theme_light: 'Light Clean', theme_light_sub: 'Crisp white',
    theme_forest: 'Forest', theme_forest_sub: 'Pine & moss',
    theme_ocean: 'Ocean', theme_ocean_sub: 'Deep marine',
    theme_sand: 'Sand', theme_sand_sub: 'Warm desert',
    theme_mocha: 'Mocha', theme_mocha_sub: 'Coffee earth',
    theme_olive: 'Olive', theme_olive_sub: 'Army green',
    theme_aurora: 'Aurora Glass', theme_aurora_sub: 'Pink & violet',
    theme_sunset: 'Sunset', theme_sunset_sub: 'Warm amber',
    theme_nebula: 'Nebula', theme_nebula_sub: 'Deep violet',
    theme_slate: 'Slate', theme_slate_sub: 'Stone & bronze',
    theme_frost: 'Frost', theme_frost_sub: 'Cool sky',
    theme_dusk: 'Dusk', theme_dusk_sub: 'Muted plum',
    export_data: 'Export Data', export_data_sub: 'Download a JSON backup',
    import_data: 'Import Data', import_data_sub: 'Restore from a JSON backup',
    health_section: 'Health Connect',
    health_connect: 'Sync from Health Connect',
    health_connect_sub: 'Steps, heart rate, oxygen & sleep from your watch',
    health_only_android: 'Available only in the Android app',
    health_unavailable: 'Health Connect is not installed on this device',
    health_no_permission: 'Permission not granted',
    health_syncing: 'Syncing…',
    health_synced: 'Synced from Health Connect',
    from_watch: 'Watch',
    health_steps: 'Steps', health_hr: 'Heart rate', health_oxygen: 'Blood oxygen', health_sleep: 'Sleep',
    health_no_data: 'No data in this range',
    health_connect_btn: 'Connect', health_open_settings: 'Open Health Connect',
    health_last_night: 'Last night', health_today: 'Today', health_bpm: 'bpm', health_min: 'min',
    health_calories: 'Calories', health_distance: 'Distance', health_vo2: 'VO₂ max',
    health_exercise: 'Exercise', health_power: 'Power', health_speed: 'Speed',
    health_kcal: 'kcal', health_km: 'km', health_kmh: 'km/h', health_watt: 'W', health_vo2_unit: 'ml/kg',
    health_home: 'Health', health_toggle_hint: 'Tap a card to show or hide it on your home screen.',
    health_all_hidden: 'All hidden — tap to choose cards',
    reset_data: 'Reset All Data', reset_data_sub: 'Delete everything and start fresh',
    reset_q: 'Reset all data?',
    reset_text: 'This will permanently delete all exercises, sessions, cardio, food, sleep, and settings.',
    reset_confirm: 'Reset',
    imported: 'Data imported',
    import_failed: 'Import failed: invalid file',

    // Recent/misc
    today: 'Today', yesterday: 'Yesterday',
    days_ago: 'days ago', weeks_ago: 'weeks ago', months_ago: 'months ago',

    // Library / Train list
    library_title: 'Library',
    library_subtitle: 'Browse all exercises and add the ones you do.',
    browse_library: 'Browse Library',
    add_from_library: 'Add from Library',
    add_exercise: 'Add exercise',
    exercise_removed: 'Exercise removed',
    schedule_title: 'Your training days',
    schedule_days_label: 'training days',
    schedule_hint: 'Tap the days you want to train. Rest days stay empty, and the workouts are arranged across your training days in order.',
    training_days: 'Training days',
    rotation_cycle: 'Workout cycle',
    add_workout: 'Add workout',
    rotation_preview: 'Next 7 days',
    move_up: 'Move up',
    move_down: 'Move down',
    edit_workout: 'Edit workout',
    workout_name_ph: 'Workout name (e.g. Push)',
    remove_workout: 'Remove from cycle',
    workouts_label: 'workouts',
    tmpl_desc_ppl: 'Classic push / pull / legs split',
    tmpl_desc_upper_lower: 'Balanced upper / lower split',
    tmpl_desc_full_body: 'Full-body sessions',
    tmpl_desc_bro_split: 'Bodybuilding muscle split',
    preset_badge: 'Ready-made',
    ready_made_section: 'More ready-made plans',
    pick_mode_title: 'Tap to add to Train',
    pick_mode_sub: 'Tap any exercise to add or remove it instantly.',
    add_to_train: 'Add to Train',
    in_train: 'In Train',
    train_empty_title: 'Your Train list is empty',
    train_empty_text: 'Browse the Library and tap the + on any exercise to add it here.',
    added_to_train: 'Added to Train',
    removed_from_train: 'Removed from Train',
    added: 'Added',

    // Image upload
    image_optional: 'Image (optional)',
    choose_image: 'Choose Image',
    take_photo: 'Take photo',
    change_image: 'Change',
    remove_image: 'Remove',
    image_hint: 'Pick a photo from your device. Stored locally.',

    // Planner
    planner_title: 'Weekly Plan',
    planner_subtitle: 'Set what you train each day of the week.',
    today_plan: "Today's Plan",
    no_plan_today: 'Rest day',
    no_plan_today_sub: 'No exercises scheduled for today.',
    start_workout: 'Start Workout',
    exercise_word: 'Exercise',
    of_word: 'of',
    last_time: 'Last time',
    first_time_no_record: 'First time — no record yet',
    resting: 'Rest',
    skip: 'Skip',
    previous: 'Previous',
    next: 'Next',
    finish: 'Finish',
    mark_set_done: 'Mark set done',
    done_col: 'Done',
    workout_summary: 'Workout Summary',
    save_session: 'Save Session',
    total_volume: 'Total Volume',
    back_to_workout: 'Back to workout',
    no_sets_to_save: 'Log at least one set first',
    edit_day: 'Edit Day',
    logged: 'Logged',
    logged_today: 'logged for this day',
    day_name_placeholder: 'e.g. Push, Chest Day',
    pick_exercises: 'Pick Exercises',
    no_exercises_picked: 'No exercises picked yet',
    rest_day: 'Rest',
    plan_empty: 'Your weekly plan is empty',
    plan_empty_sub: 'Apply a template or build it yourself day by day.',
    apply_template: 'Apply Template',
    clear_plan: 'Clear Plan',
    clear_plan_q: 'Clear the whole plan?',
    clear_plan_text: 'All scheduled days will be emptied. Your logged workouts stay.',
    plan_cleared: 'Plan cleared',
    day_saved: 'Day saved',
    day_cleared: 'Day cleared',
    drag_to_move: 'Hold ⠿ and drag to move exercises between days',
    empty_day_drop: 'Rest day — tap + or drag an exercise here',
    exercise_moved: 'Exercise moved',
    remove_from_day: 'Remove from day',
    move_day: 'Drag to move the whole day',
    day_moved: 'Day moved',

    // Templates
    templates_title: 'Templates',
    templates_subtitle: 'Pick a program to pre-fill your weekly plan.',
    template_applied: 'Template applied',
    apply: 'Apply',

    // Days of week (short + full)
    dow_sun: 'Sun', dow_mon: 'Mon', dow_tue: 'Tue', dow_wed: 'Wed', dow_thu: 'Thu', dow_fri: 'Fri', dow_sat: 'Sat',
    dow_sun_full: 'Sunday', dow_mon_full: 'Monday', dow_tue_full: 'Tuesday', dow_wed_full: 'Wednesday',
    dow_thu_full: 'Thursday', dow_fri_full: 'Friday', dow_sat_full: 'Saturday',

    // Calendar
    calendar_title: 'Calendar',
    calendar_subtitle: 'Month view of your training activity.',
    no_activity_day: 'No activity this day',
    workouts_day: 'Workouts', cardio_day: 'Cardio', sleep_day: 'Sleep',

    // Supplements
    supplements_title: 'Supplements',
    supplements_subtitle: 'Track daily doses and keep your streaks.',
    new_supplement: 'New Supplement',
    edit_supplement: 'Edit Supplement',
    supplement_name: 'Supplement Name',
    dose: 'Dose (optional)',
    color: 'Color',
    no_supplements: 'No supplements yet',
    no_supplements_text: 'Add the supplements you take (e.g. Creatine, Whey).',
    taken: 'Taken',
    not_taken: 'Not yet',
    streak: 'streak',
    delete_supplement_q: 'Delete supplement?',
    delete_supplement_text: 'This supplement and its history will be removed.',

    // Food log
    food_log_title: 'Daily Food',
    food_log_subtitle: 'Log foods from your reference list.',
    today_totals: 'Today',
    add_food_log: 'Add Food',
    pick_from_library: 'Pick from your list',
    add_to_log: 'Add to Log',
    no_food_logged: 'No food logged today',
    no_food_logged_text: 'Tap "Add Food" and pick from your reference list.',
    servings: 'Servings',
    calories_per_serving: 'Calories per serving',
    protein_per_serving: 'Protein per serving (g)',
    carbs_per_serving: 'Carbs per serving (g)',
    food_added: 'Food logged',
    food_removed: 'Removed',
    quick_add: 'Quick add',
    take_all: 'Take all',
    all_taken: 'All marked as taken',
    empty_food_list: 'Your reference list is empty',
    empty_food_list_text: 'Go to Food and add your foods first.',
    go_to_food: 'Go to Food',
    prev_day: 'Previous day', next_day: 'Next day',

    // Variations (in exercise detail)
    variations: 'Alternatives',
    variations_sub: 'Similar moves that hit the same muscles.',

    // Chart
    progress_chart: 'Progress',
    max_weight_per_session: 'Max weight per session',
    no_chart_data: 'Log 2+ sets to see your progress chart.',

    // Muscle session history (tap a heatmap cell)
    // NOTE: a separate key from `sets` on purpose — the Arabic `sets` is the
    // definite "المجموعات", which reads wrong after a numeral ("3 المجموعات").
    ms_sets_label: 'sets',
    ms_sessions_logged: 'sessions logged',
    ms_empty_title: 'No sessions yet',
    ms_empty_text: 'Log a workout for this muscle group and it will show up here.',

    // Tools cards on home
    tools_section: 'Tools',
    plan_card: 'Weekly Plan',
    plan_card_sub: 'Today & schedule',
    calendar_card: 'Calendar',
    calendar_card_sub: 'Activity history',
    supplements_card: 'Supplements',
    supplements_card_sub: 'Daily checklist',
    food_log_card: 'Daily Food',
    food_log_card_sub: 'Log meals',

    // Unit
    unit_label: 'Weight Unit',
    kg_label: 'Kilograms (kg)',
    lb_label: 'Pounds (lb)',

    // Navigation a11y
    back: 'Back',

    // Personal Records
    pr_card: 'Personal Records',
    compare_card: 'Compare',
    pr_card_sub: 'Your all-time bests',
    pr_view_title: 'Personal Records',
    pr_est_orm: 'Est. 1RM',
    pr_max_weight: 'Max weight',
    pr_empty_title: 'No records yet',
    pr_empty_text: 'Log a session to set your first PR.',
    pr_weight: 'New PR!',
    pr_orm: 'New PR!',
    pr_both: 'New PR!',
  },

  ar: {
    app_name: 'ذا فولت',
    nav_home: 'الرئيسية', nav_train: 'تمارين', nav_cardio: 'كارديو', nav_food: 'الأكل', nav_sleep: 'النوم',

    greet_morning: 'صباح الخير', greet_afternoon: 'نهارك سعيد', greet_evening: 'مساء الخير',

    cat_Chest: 'صدر', cat_Back: 'ظهر', cat_Legs: 'أرجل',
    cat_Shoulders: 'أكتاف', cat_Arms: 'ذراع', cat_Core: 'بطن', cat_Other: 'أخرى',
    cat_All: 'الكل',

    // Muscle groups (for the planner)
    anterior: 'أمامي', posterior: 'خلفي',
    muscle_chest: 'الصدر', muscle_upper_chest: 'الصدر العلوي',
    muscle_front_delts: 'الكتف الأمامي', muscle_side_delts: 'الكتف الجانبي', muscle_rear_delts: 'الكتف الخلفي',
    muscle_biceps: 'البايسبس', muscle_triceps: 'الترايسبس', muscle_forearms: 'الساعد',
    muscle_abs: 'البطن',
    muscle_upper_back: 'أعلى الظهر', muscle_lats: 'العضلة الجانبية', muscle_traps: 'الترابيس',
    muscle_lower_back: 'أسفل الظهر',
    muscle_quads: 'الكوادريسبس', muscle_hamstrings: 'الهامسترنغ', muscle_glutes: 'المؤخرة', muscle_calves: 'السمانة',
    muscle_adductors: 'المقربات',
    rest_day_muscles: 'لا يوجد عضلات مجدولة',

    streak_one_day: 'يوم',
    streak_days: 'يوم',
    streak_active: 'سلسلة نشطة — واصل!',
    streak_start: 'سجّل جلسة لبدء سلسلتك',
    workouts: 'التمارين', volume: 'الحجم', cardio: 'الكارديو', last_sleep: 'آخر نوم',
    sessions_label: 'الجلسات',
    sessions_this_week: 'مجموعة هذا الأسبوع',
    total_this_week: 'مجموع هذا الأسبوع',
    this_week: 'هذا الأسبوع',
    no_data: 'لا توجد بيانات',
    muscle_focus: 'تركيز العضلات',
    muscle_focus_sub: 'جلسات لكل عضلة · آخر 7 أيام',
    compare_progress: 'قارن تقدمك',
    compare_progress_sub: 'مقارنة أسبوعية لكل الأنشطة.',
    recent_activity: 'النشاط الأخير',

    train: 'التمارين', cardio_title: 'الكارديو', food: 'الأكل', sleep: 'النوم', compare: 'المقارنة', settings: 'الإعدادات',
    library: 'المكتبة',
    train_subtitle: 'اضغط على تمرين لتسجيل جلسة جديدة أو مشاهدة السجل.',
    search_exercises: 'ابحث عن تمرين…',
    new_exercise: 'تمرين جديد',
    new_exercise_sub: 'أضف تمريناً مخصصاً لمكتبتك.',
    add_custom: 'أضف تمرينك الخاص',
    no_exercises_cat: 'لا توجد تمارين في هذه الفئة',
    no_exercises_cat_hint: 'جرّب فلتر مختلف أو أضف تمريناً مخصصاً.',
    no_matches: 'لا توجد نتائج',
    no_matches_hint: 'جرّب كلمة بحث أخرى.',
    no_sessions_yet: 'لا توجد مجموعات بعد',
    custom: 'مخصص',
    custom_exercise_label: 'تمرين مخصص',

    log_session: 'سجّل جلسة',
    edit_session: 'تعديل الجلسة',
    log_session_tap: 'اضغط "سجّل جلسة" لتسجيل أول مجموعة.',
    max_weight: 'أقصى وزن', max_reps: 'أقصى تكرار', sessions_n: 'المجموعات',
    exercise: 'تمرين', exercises: 'تمارين',
    history: 'السجل',
    sets_logged: 'مجموعة مسجلة', no_sessions: 'لا توجد مجموعات',
    total_sets: 'مجموع المجموعات',
    pr: 'رقم قياسي',
    volume_label: 'الحجم',
    set_n: 'مجموعة',
    reps: 'تكرار', weight_kg: 'كجم',
    last_session: 'آخر جلسة',
    date: 'التاريخ',
    sets: 'المجموعات',
    add_set: 'أضف مجموعة',
    set_min_one: 'مطلوب مجموعة واحدة على الأقل',
    add_at_least_one: 'أضف مجموعة على الأقل',
    session_saved: 'تم حفظ الجلسة',
    session_updated: 'تم تحديث الجلسة',
    session_deleted: 'تم حذف الجلسة',
    delete_session_q: 'حذف الجلسة؟',
    delete_session_text: 'ستُحذف هذه الجلسة نهائياً من سجلك.',
    delete_exercise_q: 'حذف التمرين؟',
    delete_exercise_text: 'سيُحذف هذا التمرين وكل سجل جلساته.',
    exercise_deleted: 'تم حذف التمرين',
    exercise_added: 'تمت إضافة التمرين',
    enter_name: 'أدخل اسماً',
    name: 'الاسم', category: 'الفئة',
    save: 'حفظ', cancel: 'إلغاء', update: 'تحديث', delete: 'حذف', edit: 'تعديل', select: 'اختيار',
    unit: 'الوحدة', done: 'تم',
    not_found: 'غير موجود', not_found_text: 'هذا التمرين لم يعد موجوداً.',

    cardio_subtitle: 'جلسات السير، المشي، والدراجة.',
    no_cardio: 'لا يوجد كارديو بعد',
    no_cardio_text: 'سجّل أول جلسة سير أو مشي أو دراجة بالزر فوق.',
    close: 'إغلاق',
    all_sessions: 'كل الجلسات',
    log: 'سجّل',
    log_cardio: 'سجّل كارديو', edit_cardio: 'تعديل الكارديو',
    cardio_quick: 'تسجيل سريع: النوع، المدة، السعرات.',
    type: 'النوع',
    duration_min: 'المدة (دقيقة)',
    calories: 'السعرات',
    sessions_w: 'الجلسات', minutes: 'الدقائق',
    enter_duration: 'أدخل المدة',
    delete_cardio_q: 'حذف جلسة الكارديو؟',
    delete_cardio_text: 'ستُحذف هذه الجلسة من سجلك.',
    saved: 'تم الحفظ', updated: 'تم التحديث', deleted: 'تم الحذف',
    treadmill: 'سير', walking: 'مشي', running: 'جري', cycling: 'دراجة',
    new_cardio_type: 'نوع كارديو جديد',
    new_cardio_type_sub: 'أضف نشاط كارديو خاص فيك.',
    cardio_type_name_ph: 'مثلاً: درج، تجديف',
    icon: 'الأيقونة',
    enter_name: 'أدخل اسماً',

    food_subtitle: 'مرجعك الشخصي للأكل ومعدلاته الغذائية.',
    // لوحة التغذية
    nutri_setup_title: 'حدّد هدفك اليومي',
    nutri_setup_text: 'احسب سعراتك وماكروزك لتبدأ المتابعة.',
    nutri_left: 'متبقّي',
    nutri_over: 'زيادة',
    nutri_calories: 'السعرات',
    nutri_today: 'أكل اليوم',
    nutri_empty_title: 'لم تُسجّل شيئاً بعد',
    nutri_empty_text: 'اضغط + لإضافة ما أكلته اليوم.',
    coach_title: 'المدرّب الذكي',
    coach_sub: 'ماذا تأكل لتكمّل المتبقّي من ماكروزك',
    coach_thinking: 'أفكّر…',
    coach_unavailable: 'المدرّب غير متاح حالياً.',
    add_sheet_title: 'إضافة أكل',
    add_voice: 'صوت', add_voice_sub: 'قُل ما أكلته',
    add_chat: 'محادثة', add_chat_sub: 'اكتبه — والذكاء يحسب السعرات',
    add_photo: 'صورة', add_photo_sub: 'صوّر وجبتك',
    add_saved: 'أكل محفوظ', add_saved_sub: 'اختر من أطعمتك',
    add_manual: 'يدوي', add_manual_sub: 'أدخل الأرقام بنفسك',
    saved_new: 'أضف طعاماً محفوظاً جديداً', saved_empty: 'لا يوجد أكل محفوظ بعد',
    calc_title: 'حاسبة السعرات', calc_sub: 'معادلة Mifflin-St Jeor — المعيار الأدق',
    calc_mode_calc: 'احسب', calc_mode_manual: 'إدخال يدوي',
    calc_sex: 'الجنس', calc_male: 'ذكر', calc_female: 'أنثى',
    calc_age: 'العمر', calc_height: 'الطول (سم)', calc_weight: 'الوزن (كغ)',
    calc_activity: 'النشاط', calc_goal: 'الهدف',
    activity_sedentary: 'خامل', activity_light: 'خفيف', activity_moderate: 'متوسط', activity_active: 'نشِط', activity_very_active: 'نشِط جداً',
    goal_cut: 'تنشيف', goal_maintain: 'ثبات', goal_bulk: 'تضخيم',
    calc_tdee: 'الثبات', calc_bmr: 'الأيض الأساسي', calc_fill_hint: 'أدخل العمر والطول والوزن.',
    manual_food_title: 'إضافة أكل', manual_food_ph: 'مثال: دجاج ورز',
    voice_tap: 'اضغط لتتكلّم', voice_listening: 'أستمع… اضغط للإيقاف',
    voice_processing: 'أفهم كلامك…', voice_denied: 'رُفض الوصول للميكروفون.',
    voice_unsupported: 'الصوت يحتاج آخر نسخة من التطبيق.',
    no_foods_yet: 'لا يوجد أكل بعد',
    no_foods_text: 'أنشئ قائمتك المرجعية بالأطعمة التي تتناولها عادةً.',
    no_matches_simple: 'لا نتائج',
    no_matches_text: 'جرّب بحث مختلف.',
    reference_items: 'مرجع',
    search_foods: 'ابحث عن أكل…',
    add: 'أضف',
    food_library_title: 'أضف من المكتبة',
    food_library_sub: 'اضغط على أي طعام لإضافته إلى قائمتك.',
    add_manually: 'إضافة يدوية',
    fcat_protein: 'بروتين',
    fcat_carbs: 'نشويات',
    fcat_legumes: 'بقوليات',
    fcat_dairy: 'ألبان',
    fcat_fruit: 'فواكه',
    fcat_veg: 'خضار',
    fcat_fats: 'مكسرات ودهون',
    fcat_meals: 'وجبات',
    fcat_drinks: 'مشروبات',
    fcat_more: 'المزيد',
    new_food: 'أكل جديد', edit_food: 'تعديل الأكل',
    food_quick: 'المعدلات الغذائية لكل حصة.',
    serving_opt: 'الحصة (اختياري)', serving_hint: 'مثلاً 100جم، كوب',
    amount_label: 'الكمية', serving_unit_label: 'الوحدة', unit_hint: 'غ، مل، حبة',
    ph_exercise_name: 'مثال: سكوات بلغاري', ph_food_name: 'مثال: صدر دجاج', ph_supplement_name: 'مثال: كرياتين',
    view_photo: 'عرض الصورة',
    protein_g: 'بروتين (جم)', carbs_g: 'كارب (جم)',
    delete_food_q: 'حذف الأكل؟',
    delete_food_text: 'سيُحذف هذا الأكل من قائمتك المرجعية.',
    cal: 'سعرة', protein_label: 'بروتين', carbs_label: 'كارب', fat_label: 'دهون',
    ai_chat_btn: 'ذكاء', ai_chat_title: 'شات السعرات', ai_chat_sub: 'أخبرني بما تناولت — وأنا أسجّل السعرات',
    ai_chat_placeholder: 'مثلاً: الفطور بيض وخبز، والغدا برجر',
    ai_add_all: 'أضف الكل',
    ai_need_key: 'يلزم مفتاح Google Gemini مجاني (لمرة واحدة).',
    ai_key_step1: 'احصل على مفتاح مجاني من',
    ai_key_step2: 'الصقه في الأسفل — يُخزَّن على جهازك فقط.',
    ai_key_label: 'مفتاح Gemini',
    ai_save_key: 'حفظ المفتاح',
    ai_analyzing: 'جارٍ الحساب…',
    ai_photo: 'صورة',
    ai_no_result: 'لا توجد نتيجة — جرّب صياغة أخرى.',
    ai_add_to_log: 'أضف للسجل',
    ai_added: 'تمت الإضافة',
    ai_error: 'صار خطأ',
    ai_rate_limit: 'خدمة الذكاء المجانية مشغولة حالياً — جرّب بعد دقيقة.',
    ai_not_food: 'هذا الشات للطعام فقط — اكتب وجبة لأحسبها.',

    // المصادقة / المزامنة السحابية
    auth_sub_in: 'سجّل دخولك لمزامنة بياناتك',
    auth_sub_up: 'أنشئ حساباً لمزامنة بياناتك بين الأجهزة',
    auth_email: 'البريد الإلكتروني',
    auth_password: 'كلمة السر',
    auth_signin: 'تسجيل الدخول',
    auth_signup: 'إنشاء حساب',
    auth_toggle_to_up: 'ما عندك حساب؟ أنشئ واحد',
    auth_toggle_to_in: 'عندك حساب؟ سجّل دخول',
    auth_skip: 'المتابعة بدون حساب',
    username_title: 'اختر اسم المستخدم',
    username_sub: 'اسم فريد يُعرّفك أمام الآخرين. إلزامي للمتابعة.',
    username_ph: 'اسم_المستخدم',
    username_rules: '٣–٢٠ حرفًا · حروف إنجليزية وأرقام و _ فقط',
    username_save: 'حفظ الاسم',
    username_checking: 'جارٍ التحقّق…',
    username_available_msg: 'متاح ✓',
    username_taken: 'هذا الاسم محجوز',
    username_invalid: 'استخدم ٣–٢٠ من الحروف الإنجليزية والأرقام و _',
    username_saved: 'تم حفظ اسم المستخدم',
    update_title: 'يتوفّر إصدار جديد',
    update_get: 'تحميل',
    update_later: 'لاحقاً',
    web_update_title: 'يتوفّر إصدار جديد',
    web_update_action: 'تحديث',
    feedback_title: 'إرسال ملاحظة',
    feedback_sub: 'اقتراحات أو مشاكل — نقرأ كل رسالة',
    feedback_ph: 'اقتراحك أو ملاحظتك…',
    feedback_send: 'إرسال',
    feedback_sent: 'شكرًا! تم إرسال ملاحظتك',
    feedback_empty: 'اكتب شيئًا أولًا',
    account_blocked_title: 'الحساب غير متاح',
    account_disabled_msg: 'تم تعطيل حسابك. يرجى التواصل مع الدعم.',
    account_banned_msg: 'تم إيقاف حسابك.',
    auth_forgot: 'نسيت كلمة السر؟',
    auth_reset_title: 'استعادة كلمة السر',
    auth_reset_sub: 'أدخل بريدك ونرسل لك رابطاً لتعيين كلمة سر جديدة.',
    auth_reset_send: 'إرسال رابط الاستعادة',
    auth_reset_sent: 'تفقّد بريدك — أرسلنا لك رابط الاستعادة',
    auth_signing: 'لحظة…',
    auth_checking: 'جارٍ التحقق…',
    auth_err_fields: 'أدخل البريد وكلمة السر',
    auth_pw_short: 'كلمة السر 6 أحرف على الأقل',
    auth_signup_check_email: 'تم إنشاء الحساب — أكّد عبر الإيميل المُرسَل ثم سجّل دخول.',
    auth_err_invalid: 'البريد أو كلمة السر غير صحيحة',
    auth_err_exists: 'هذا البريد له حساب — سجّل دخول بدلاً من الإنشاء',
    auth_err_email: 'أدخل بريداً صحيحاً',
    auth_err_network: 'مشكلة اتصال — تأكد من الإنترنت',
    auth_err_generic: 'تعذّر تسجيل الدخول. حاول مرة أخرى.',
    auth_not_signed: 'غير مسجّل دخول',
    auth_signin_sub: 'سجّل دخول لمزامنة بياناتك بين الأجهزة',
    account: 'الحساب',
    account_synced_sub: 'بياناتك تتزامن تلقائياً',
    sync_now: 'زامِن الآن',
    sync_now_sub: 'اسحب آخر التغييرات وارفع تعديلاتك',
    synced: 'تمت المزامنة',
    syncing: 'جارٍ مزامنة بياناتك…',
    cloud_backup_kept: 'نسختك الاحتياطية في السحابة محفوظة — لم تُزامَن البيانات الفارغة.',
    logout: 'تسجيل الخروج',
    logout_sub: 'إيقاف المزامنة على هذا الجهاز',
    logout_confirm: 'بياناتك تبقى على هذا الجهاز. سجّل دخول مجدداً في أي وقت لاستئناف المزامنة.',
    change_password: 'تغيير كلمة السر',
    change_password_sub: 'عيّن كلمة سر جديدة لهذا الحساب',
    change_password_new: 'كلمة السر الجديدة',
    change_password_confirm: 'تأكيد كلمة السر الجديدة',
    change_password_mismatch: 'كلمتا السر غير متطابقتين',
    change_password_done: 'تم تغيير كلمة السر',
    conflict_title: 'يوجد بيانات في حسابك',
    conflict_text: 'حسابك فيه بيانات محفوظة مسبقاً. أي نسخة تريد أن تبقي؟',
    conflict_cloud: 'إبقاء بيانات الحساب (السحابة)',
    conflict_local: 'إبقاء بيانات هذا الجهاز',

    sleep_subtitle: 'تتبّع متى تنام ومتى تصحى.',
    no_sleep_logged: 'لا يوجد نوم مسجّل',
    no_sleep_text: 'اضغط "سجّل" لتسجيل أول ليلة نوم.',
    nights_log: 'سجّل', nights_logged: 'مسجلة',
    last_night: 'آخر ليلة', avg_7d: 'متوسط 7 أيام',
    log_sleep: 'سجّل النوم', edit_sleep: 'تعديل النوم',
    sleep_quick: 'التاريخ هو الصباح الذي صحيت فيه.',
    sleep_time: 'وقت النوم', wake_time: 'وقت الصحيان',
    total_sleep: 'مدة النوم',
    fill_all_fields: 'يرجى ملء جميع الحقول',
    delete_sleep_q: 'حذف إدخال النوم؟',
    delete_sleep_text: 'سيُحذف هذا الإدخال من سجلك.',

    compare_title: 'المقارنة',
    weekly: 'أسبوعي',
    compare_subtitle: 'هذا الأسبوع مقارنة بالأسبوع الماضي.',
    this_week_label: 'هذا الأسبوع', last_week_label: 'الأسبوع الماضي',
    not_enough_data: 'لا توجد بيانات كافية',
    not_enough_data_text: 'سجّل جلسات عبر أسبوعين لمشاهدة تقدمك هنا.',
    not_enough_cardio: 'سجّل كارديو عبر أسبوعين لمشاهدة تقدمك.',
    not_enough_sleep: 'سجّل نوم عبر أسبوعين لمشاهدة التقدم.',
    same_as_last_week: 'نفس الأسبوع الماضي',
    no_data_short: 'لا بيانات',
    need_both_weeks: 'تحتاج بيانات من الأسبوعين',
    total_minutes: 'مجموع الدقائق', calories_burned: 'السعرات المحروقة',
    avg_sleep: 'متوسط النوم', nights_logged_t: 'الليالي المسجلة',

    settings_title: 'الإعدادات',
    settings_subtitle: 'خصّص اللغة والمظهر وأدر بياناتك.',
    language: 'اللغة',
    theme: 'المظهر',
    data: 'البيانات',
    theme_dark: 'Dark Vault', theme_dark_sub: 'تركواز على أسود',
    theme_light: 'Light Clean', theme_light_sub: 'أبيض نظيف',
    theme_forest: 'Forest', theme_forest_sub: 'صنوبر وطحلب',
    theme_ocean: 'Ocean', theme_ocean_sub: 'أزرق بحري عميق',
    theme_sand: 'Sand', theme_sand_sub: 'صحراوي دافئ',
    theme_mocha: 'Mocha', theme_mocha_sub: 'بُني قهوة',
    theme_olive: 'Olive', theme_olive_sub: 'زيتي عسكري',
    theme_aurora: 'Aurora Glass', theme_aurora_sub: 'وردي وبنفسجي',
    theme_sunset: 'Sunset', theme_sunset_sub: 'كهرماني دافئ',
    theme_nebula: 'Nebula', theme_nebula_sub: 'بنفسجي عميق',
    theme_slate: 'Slate', theme_slate_sub: 'حجري وبرونزي',
    theme_frost: 'Frost', theme_frost_sub: 'سماء باردة',
    theme_dusk: 'Dusk', theme_dusk_sub: 'برقوقي هادئ',
    export_data: 'تصدير البيانات', export_data_sub: 'تنزيل نسخة JSON احتياطية',
    import_data: 'استيراد البيانات', import_data_sub: 'استرجاع من نسخة JSON',
    health_section: 'هيلث كونيكت',
    health_connect: 'مزامنة من Health Connect',
    health_connect_sub: 'الخطوات والنبض والأكسجين والنوم من ساعتك',
    health_only_android: 'متاح فقط في تطبيق أندرويد',
    health_unavailable: 'Health Connect غير مثبّت على هذا الجهاز',
    health_no_permission: 'لم يتم منح الإذن',
    health_syncing: 'جارٍ المزامنة…',
    health_synced: 'تمت المزامنة من Health Connect',
    from_watch: 'الساعة',
    health_steps: 'الخطوات', health_hr: 'النبض', health_oxygen: 'الأكسجين', health_sleep: 'النوم',
    health_no_data: 'لا توجد بيانات في هذه الفترة',
    health_connect_btn: 'ربط', health_open_settings: 'فتح Health Connect',
    health_last_night: 'الليلة الماضية', health_today: 'اليوم', health_bpm: 'نبضة/د', health_min: 'دقيقة',
    health_calories: 'السعرات', health_distance: 'المسافة', health_vo2: 'VO₂ max',
    health_exercise: 'التمارين', health_power: 'الطاقة', health_speed: 'السرعة',
    health_kcal: 'سعرة', health_km: 'كم', health_kmh: 'كم/س', health_watt: 'واط', health_vo2_unit: 'مل/كغ',
    health_home: 'صحّتي', health_toggle_hint: 'اضغط على المربّع لإظهاره أو إخفائه من الشاشة الرئيسية.',
    health_all_hidden: 'الكل مخفي — اضغط لاختيار المربّعات',
    reset_data: 'إعادة تعيين الكل', reset_data_sub: 'حذف كل شي والبدء من جديد',
    reset_q: 'إعادة تعيين كل البيانات؟',
    reset_text: 'سيُحذف كل شي نهائياً: التمارين، الجلسات، الكارديو، الأكل، النوم، والإعدادات.',
    reset_confirm: 'تعيين',
    imported: 'تم الاستيراد',
    import_failed: 'فشل الاستيراد: الملف غير صالح',

    today: 'اليوم', yesterday: 'أمس',
    days_ago: 'أيام',
    weeks_ago: 'أسابيع',
    months_ago: 'أشهر',

    library_title: 'المكتبة',
    library_subtitle: 'تصفّح جميع التمارين وأضف ما تمارسه.',
    browse_library: 'تصفّح المكتبة',
    add_from_library: 'إضافة من المكتبة',
    add_exercise: 'أضف تمرين',
    exercise_removed: 'تمت إزالة التمرين',
    schedule_title: 'أيام تمرينك',
    schedule_days_label: 'أيام تمرين',
    schedule_hint: 'اختر الأيام التي تريد التمرّن فيها؛ تبقى أيام الراحة فارغة، وتُوزَّع التمارين على أيام تمرينك بالترتيب.',
    training_days: 'أيام التمرين',
    rotation_cycle: 'دورة التمارين',
    add_workout: 'إضافة تمرين',
    rotation_preview: 'الأيام السبعة القادمة',
    move_up: 'تحريك لأعلى',
    move_down: 'تحريك لأسفل',
    edit_workout: 'تعديل التمرين',
    workout_name_ph: 'اسم التمرين (مثال: دفع)',
    remove_workout: 'إزالة من الدورة',
    workouts_label: 'تمارين',
    tmpl_desc_ppl: 'تقسيمة كلاسيكية: دفع / سحب / أرجل',
    tmpl_desc_upper_lower: 'تقسيمة متوازنة: علوي / سفلي',
    tmpl_desc_full_body: 'حصص للجسم كامل',
    tmpl_desc_bro_split: 'تقسيمة كمال الأجسام',
    preset_badge: 'جاهزة',
    ready_made_section: 'مزيد من الخطط الجاهزة',
    pick_mode_title: 'اضغط على التمرين لإضافته',
    pick_mode_sub: 'كل ضغطة تضيف أو تشيل التمرين من قائمة التدريب فوراً.',
    add_to_train: 'أضف للتمارين',
    in_train: 'مضاف',
    train_empty_title: 'قائمة تمارينك فاضية',
    train_empty_text: 'تصفّح المكتبة واضغط + على أي تمرين لإضافته هنا.',
    added_to_train: 'تمت الإضافة',
    removed_from_train: 'تمت الإزالة',
    added: 'مُضاف',

    image_optional: 'صورة (اختياري)',
    choose_image: 'اختر صورة',
    take_photo: 'التقاط صورة',
    change_image: 'تغيير',
    remove_image: 'إزالة',
    image_hint: 'اختر صورة من جهازك. تُحفظ محلياً.',

    planner_title: 'الخطة الأسبوعية',
    planner_subtitle: 'حدّد تمرين كل يوم في الأسبوع.',
    today_plan: 'خطة اليوم',
    no_plan_today: 'يوم راحة',
    no_plan_today_sub: 'لا توجد تمارين مجدولة اليوم.',
    start_workout: 'ابدأ التمرين',
    exercise_word: 'تمرين',
    of_word: 'من',
    last_time: 'آخر مرة',
    first_time_no_record: 'أول مرة — لا يوجد سجل بعد',
    resting: 'راحة',
    skip: 'تخطّي',
    previous: 'السابق',
    next: 'التالي',
    finish: 'إنهاء',
    mark_set_done: 'إنهاء المجموعة',
    done_col: 'تمّ',
    workout_summary: 'ملخّص الجلسة',
    save_session: 'حفظ الجلسة',
    total_volume: 'إجمالي الحِمل',
    back_to_workout: 'العودة للتمرين',
    no_sets_to_save: 'سجّل مجموعة واحدة على الأقل',
    edit_day: 'تعديل اليوم',
    logged: 'مُسجَّل',
    logged_today: 'مُسجَّل لهذا اليوم',
    day_name_placeholder: 'مثلاً: صدر، ظهر',
    pick_exercises: 'اختر تمارين',
    no_exercises_picked: 'لم تختر أي تمارين بعد',
    rest_day: 'راحة',
    plan_empty: 'خطتك الأسبوعية فاضية',
    plan_empty_sub: 'طبّق قالبًا جاهزًا أو ابنِها يومًا بيوم.',
    apply_template: 'طبّق قالب',
    clear_plan: 'امسح الخطة',
    clear_plan_q: 'مسح كامل الخطة؟',
    clear_plan_text: 'كل الأيام المجدولة بتصير فاضية. جلساتك المسجّلة ما تتأثر.',
    plan_cleared: 'تم مسح الخطة',
    day_saved: 'تم حفظ اليوم',
    day_cleared: 'تم مسح اليوم',
    drag_to_move: 'امسك ⠿ واسحب لنقل التمارين بين الأيام',
    empty_day_drop: 'يوم راحة — اضغط + أو اسحب تمرين لهون',
    exercise_moved: 'تم نقل التمرين',
    remove_from_day: 'إزالة من اليوم',
    move_day: 'اسحب لنقل اليوم كامل',
    day_moved: 'تم نقل اليوم',

    templates_title: 'القوالب',
    templates_subtitle: 'اختار برنامج يعبّي خطتك الأسبوعية.',
    template_applied: 'تم تطبيق القالب',
    apply: 'طبّق',

    dow_sun: 'أحد', dow_mon: 'اثنين', dow_tue: 'ثلاثاء', dow_wed: 'أربعاء', dow_thu: 'خميس', dow_fri: 'جمعة', dow_sat: 'سبت',
    dow_sun_full: 'الأحد', dow_mon_full: 'الاثنين', dow_tue_full: 'الثلاثاء', dow_wed_full: 'الأربعاء',
    dow_thu_full: 'الخميس', dow_fri_full: 'الجمعة', dow_sat_full: 'السبت',

    calendar_title: 'التقويم',
    calendar_subtitle: 'عرض شهري لنشاطك.',
    no_activity_day: 'لا يوجد نشاط في هذا اليوم',
    workouts_day: 'تمارين', cardio_day: 'كارديو', sleep_day: 'نوم',

    supplements_title: 'المكمّلات',
    supplements_subtitle: 'تتبّع جرعاتك اليومية وحافظ على سلسلتك.',
    new_supplement: 'مكمّل جديد',
    edit_supplement: 'تعديل المكمّل',
    supplement_name: 'اسم المكمّل',
    dose: 'الجرعة (اختياري)',
    color: 'اللون',
    no_supplements: 'لا توجد مكمّلات بعد',
    no_supplements_text: 'أضف المكمّلات التي تتناولها (مثل: الكرياتين، الواي بروتين).',
    taken: 'مأخوذ',
    not_taken: 'ما أخذته بعد',
    streak: 'سلسلة',
    delete_supplement_q: 'حذف المكمّل؟',
    delete_supplement_text: 'المكمّل وسجله كله بينحذف.',

    food_log_title: 'الأكل اليومي',
    food_log_subtitle: 'سجّل أكلك من قائمتك المرجعية.',
    today_totals: 'اليوم',
    add_food_log: 'أضف أكل',
    pick_from_library: 'اختر من قائمتك',
    add_to_log: 'أضف للسجل',
    no_food_logged: 'ما سجّلت أكل اليوم',
    no_food_logged_text: 'اضغط "أضف أكل" واختر من قائمتك المرجعية.',
    servings: 'عدد الحصص',
    calories_per_serving: 'السعرات لكل حصة',
    protein_per_serving: 'البروتين لكل حصة (جم)',
    carbs_per_serving: 'الكارب لكل حصة (جم)',
    food_added: 'تم التسجيل',
    food_removed: 'تم الحذف',
    quick_add: 'إضافة سريعة',
    take_all: 'أخذ الكل',
    all_taken: 'تم تحديد الكل كمأخوذ',
    empty_food_list: 'قائمتك المرجعية فاضية',
    empty_food_list_text: 'روح لـ "الأكل" وضيف أكلاتك أول.',
    go_to_food: 'روح للأكل',
    prev_day: 'يوم سابق', next_day: 'يوم تالي',

    variations: 'تمارين بديلة',
    variations_sub: 'حركات مشابهة تضرب نفس العضلات.',

    progress_chart: 'التقدم',
    max_weight_per_session: 'أقصى وزن لكل جلسة',
    no_chart_data: 'سجّل مجموعتين أو أكثر لعرض رسم تقدّمك.',

    ms_sets_label: 'مجموعات',
    ms_sessions_logged: 'جلسة مسجّلة',
    ms_empty_title: 'لا توجد جلسات بعد',
    ms_empty_text: 'سجّل تمريناً لهذه العضلة وسيظهر هنا.',

    tools_section: 'أدوات',
    plan_card: 'الخطة الأسبوعية',
    plan_card_sub: 'اليوم والجدول',
    calendar_card: 'التقويم',
    calendar_card_sub: 'سجل النشاط',
    supplements_card: 'المكمّلات',
    supplements_card_sub: 'قائمة يومية',
    food_log_card: 'الأكل اليومي',
    food_log_card_sub: 'سجّل وجباتك',

    unit_label: 'وحدة الوزن',
    kg_label: 'كيلوجرام (kg)',
    lb_label: 'باوند (lb)',

    // Navigation a11y
    back: 'رجوع',

    // Personal Records
    pr_card: 'الأرقام القياسية',
    compare_card: 'قارن',
    pr_card_sub: 'أفضل أوزانك على الإطلاق',
    pr_view_title: 'الأرقام القياسية',
    pr_est_orm: '1RM تقديري',
    pr_max_weight: 'أعلى وزن',
    pr_empty_title: 'لا توجد أرقام قياسية بعد',
    pr_empty_text: 'سجّل جلسة لتضبط أول رقم قياسي.',
    pr_weight: 'رقم قياسي!',
    pr_orm: 'رقم قياسي!',
    pr_both: 'رقم قياسي!',
  },
};

function t(key, fallback) {
  const lang = (DB.prefs.get().lang) || 'en';
  return (I18N[lang] && I18N[lang][key]) || (I18N.en && I18N.en[key]) || (fallback !== undefined ? fallback : key);
}

function categoryLabel(cat) { return t('cat_' + cat, cat); }

// Localized days-ago
function daysAgoLocalized(iso) {
  if (!iso) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  if (diff < 7) return diff + ' ' + t('days_ago');
  if (diff < 30) return Math.floor(diff / 7) + ' ' + t('weeks_ago');
  return Math.floor(diff / 30) + ' ' + t('months_ago');
}

// ==========================================================================
// Theme & language
// ==========================================================================
const THEMES = ['dark', 'light', 'forest', 'ocean', 'sand', 'mocha', 'olive', 'aurora', 'sunset', 'nebula', 'slate', 'frost', 'dusk'];

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'dark';
  document.body.classList.remove(...THEMES.map((t) => 'theme-' + t));
  document.body.classList.add('theme-' + theme);
  const themeColorMap = {
    dark: '#06141b',
    light: '#f6f8fa',
    forest: '#0a1812',
    ocean: '#0a1929',
    sand: '#fbf6ee',
    mocha: '#1c1411',
    olive: '#14170c',
    aurora: '#0b0821',
    sunset: '#1a0f14',
    nebula: '#070714',
    slate: '#1a1a1c',
    frost: '#eef2f7',
    dusk: '#1c1620',
  };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColorMap[theme]);
}

function applyLang(lang) {
  if (lang !== 'ar') lang = 'en';
  document.documentElement.lang = lang;
  document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  // Update bottom nav labels (they have data-t)
  document.querySelectorAll('[data-t]').forEach((el) => {
    el.textContent = t(el.dataset.t);
  });
}

// ==========================================================================
// DOM helpers
// ==========================================================================
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initialsOf(str) {
  const parts = (str || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Always render numbers using Latin digits (English), regardless of UI language
function fmtNum(n) {
  return Number(n).toLocaleString('en-US');
}

// Resize a File/Blob image to a smaller JPEG data URL (keeps localStorage manageable)
function resizeImageToDataUrl(file, maxSize = 800, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

let toastTimeout = null;
function showToast(msg) {
  const tEl = $('#toast');
  tEl.textContent = msg;
  tEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => tEl.classList.remove('show'), 1800);
}

// ==========================================================================
// Modal System
// ==========================================================================
function openModal(innerHtml, { variant = 'sheet' } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-overlay ${variant === 'confirm' ? 'confirm-overlay' : ''}">
      <div class="${variant === 'confirm' ? 'confirm-dialog' : 'modal'}" role="dialog" aria-modal="true" tabindex="-1">
        ${variant === 'sheet' ? '<div class="sheet-handle"></div>' : ''}
        ${innerHtml}
      </div>
    </div>
  `;
  const overlay = root.querySelector('.modal-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelectorAll('[data-close]').forEach((el) => {
    // Every icon-only close button gets a screen-reader name in one place.
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t('close'));
    el.addEventListener('click', () => closeModal());
  });
  // Move focus into the dialog so keyboard/SR users start inside it (unless a
  // field inside will self-focus via autofocus).
  if (!overlay.querySelector('[autofocus]')) overlay.querySelector('.modal, .confirm-dialog')?.focus();
  return overlay;
}

function closeModal() { $('#modal-root').innerHTML = ''; }

function confirmDialog({ title, text, onConfirm, confirmLabel, variant = 'danger' }) {
  if (!confirmLabel) confirmLabel = t('delete');
  const btnClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
  const overlay = openModal(`
    <div class="confirm-title">${escapeHtml(title)}</div>
    <div class="confirm-text">${escapeHtml(text)}</div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="${btnClass}" data-ok>${escapeHtml(confirmLabel)}</button>
    </div>
  `, { variant: 'confirm' });
  overlay.querySelector('[data-ok]').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// ==========================================================================
// VAULT Top Bar
// ==========================================================================
function vaultBar({ action = '', actionLabel = '' } = {}) {
  return `
    <div class="vault-bar">
      <div class="vault-logo">
        <span class="vault-logo-mark">${icon('vault', 22)}</span>
        <span>${t('app_name')}</span>
      </div>
      ${action ? `<button class="vault-action" id="vault-action"${actionLabel ? ` aria-label="${escapeHtml(actionLabel)}"` : ''}>${action}</button>` : '<span style="width:40px"></span>'}
    </div>
  `;
}

function bindVaultAction(handler) {
  // Each rendered view stays in the DOM (just hidden). Scope to the active
  // view so we don't bind the handler to a stale vault-action from a previous
  // view — that was making top-bar + buttons fire the wrong action.
  const btn = document.querySelector('.view.active #vault-action');
  if (btn && handler) btn.addEventListener('click', handler);
}

// ==========================================================================
// Router
// ==========================================================================
let currentView = 'home';
let viewContext = {};
// In-app navigation history so the Android hardware back button steps back one
// screen instead of quitting the app. Each entry is { view, context }.
let navStack = [{ view: 'home', context: {} }];

function navigate(view, context = {}, opts = {}) {
  currentView = view;
  viewContext = context;

  // The Food view mounts a floating AI-chat bar on `.app`; clear it on every
  // navigation so it never lingers over other views (renderFood re-mounts it).
  if (typeof unmountFoodAiBar === 'function') unmountFoodAiBar();
  document.querySelector('.img-lightbox')?.remove();
  // The food add-sheet lives on `.app` (not #modal-root) — clear it too so it
  // never lingers over another view after a nav.
  document.getElementById('add-sheet-overlay')?.remove();
  // Tear down the guided-workout rest timer so it never lingers over other views.
  if (typeof clearRestTimer === 'function') clearRestTimer();

  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));

  const navMap = {
    home: 'home', workouts: 'workouts', library: 'workouts', 'exercise-detail': 'workouts',
    cardio: 'cardio', food: 'food', sleep: 'sleep',
    compare: 'home', settings: 'home',
    planner: 'home', calendar: 'home', supplements: 'home', foodlog: 'home',
    'personal-records': 'home',
  };
  const highlightView = navMap[view] || view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === highlightView));

  renderView(view);
  $('.main').scrollTop = 0;

  // Record the step for the back button — unless we got here BY going back.
  if (!opts.fromPop) {
    navStack.push({ view, context });
    try { history.pushState({ depth: navStack.length }, ''); } catch (_) {}
  }
}

// Step back one screen inside the app. Returns true if it handled the back,
// false if we're at the root (caller should exit the app). A modal — or the
// auth gate — is dismissed first; otherwise we pop the nav history.
function goBack() {
  // A full-screen image lightbox lives on document.body (outside #modal-root),
  // so dismiss it first — otherwise "back" would navigate underneath it.
  const lb = document.querySelector('.img-lightbox');
  if (lb) { lb.remove(); return true; }
  // The food add-sheet lives on `.app`, not #modal-root — close it first so
  // "back" dismisses the sheet instead of popping the view (or exiting the app).
  const addSheet = document.getElementById('add-sheet-overlay');
  if (addSheet) { addSheet.remove(); return true; }
  if ($('#modal-root') && $('#modal-root').innerHTML.trim()) { closeModal(); return true; }
  if (document.getElementById('auth-gate')) return true; // don't slip behind login
  if (navStack.length > 1) {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    navigate(prev.view, prev.context, { fromPop: true });
    return true;
  }
  return false; // at the root (home)
}

// Browser back button (works in the web/preview). On Android the hardware back
// button does NOT drive web history, so it is wired separately below.
window.addEventListener('popstate', () => {
  if (goBack()) { try { history.pushState({ depth: navStack.length }, ''); } catch (_) {} }
});

// The cloud layer blocked a push that would have wiped a data-ful cloud backup
// with an empty local blob (e.g. right after a Reset). Reassure the user their
// backup is intact instead of leaving the divergence silent.
window.addEventListener('vault:push-blocked', () => {
  try { showToast(t('cloud_backup_kept')); } catch (_) {}
});

// Android hardware back button via the @capacitor/app plugin → same goBack(),
// and exit the app only at the root screen.
(function wireHardwareBack() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App || !App.addListener) return;
  App.addListener('backButton', () => {
    if (!goBack()) App.exitApp();
  });
})();

// Auto-hide the detail header (any bar with a back button): tuck it away while
// scrolling down, slide it back smoothly when scrolling up. One listener on the
// scroll container drives whichever view is active.
(function wireDetailTopAutoHide() {
  const main = document.querySelector('.main');
  if (!main) return;
  let lastY = 0;
  main.addEventListener('scroll', () => {
    const y = main.scrollTop;
    const bar = document.querySelector('.view.active .detail-top');
    if (bar) {
      const tuck = y > lastY && y > 64;                      // down & past the top → hide
      bar.classList.toggle('tuck', tuck);
      bar.inert = tuck;                                       // keep the hidden back button out of the tab order / AT
    }
    lastY = y <= 0 ? 0 : y;
  }, { passive: true });
})();

function renderView(view) {
  const el = $(`.view[data-view="${view}"]`);
  if (!el) return;
  switch (view) {
    case 'home': renderHome(el); break;
    case 'workouts': renderWorkouts(el); break;
    case 'library': renderLibrary(el); break;
    case 'exercise-detail': renderExerciseDetail(el, viewContext.exerciseId); break;
    case 'cardio': renderCardio(el); break;
    case 'food': renderFood(el); break;
    case 'sleep': renderSleep(el); break;
    case 'compare': renderCompare(el); break;
    case 'settings': renderSettings(el); break;
    case 'planner': renderPlanner(el); break;
    case 'calendar': renderCalendar(el); break;
    case 'supplements': renderSupplements(el); break;
    case 'foodlog': renderFoodLog(el); break;
    case 'session-day': renderSessionDay(el); break;
    case 'session-run': renderSessionRun(el); break;
    case 'personal-records': renderPersonalRecords(el); break;
    case 'muscle-sessions': renderMuscleSessions(el); break;
  }
  // Give every icon-only back button an accessible name, in one place.
  el.querySelectorAll('.back-btn:not([aria-label])').forEach((b) => b.setAttribute('aria-label', t('back')));
}

$('#bottom-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn) navigate(btn.dataset.view);
});

document.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) {
    e.preventDefault();
    navigate(goto.dataset.goto);
  }
});

// A back control that returns to the previous screen (wherever we came from),
// instead of a fixed destination.
document.addEventListener('click', (e) => {
  const back = e.target.closest('[data-back]');
  if (back) { e.preventDefault(); goBack(); }
});

// Escape closes the top-most transient layer (image lightbox, then modal) —
// keyboard parity with tapping the backdrop / hardware back.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const lb = document.querySelector('.img-lightbox');
  if (lb) { lb.remove(); return; }
  const root = $('#modal-root');
  if (root && root.innerHTML.trim()) closeModal();
});

// ==========================================================================
// Helpers shared
// ==========================================================================
function emptyState({ iconName = 'dumbbell', title, text }) {
  return `
    <div class="empty">
      <div class="empty-icon">${icon(iconName, 52)}</div>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-text">${escapeHtml(text)}</div>
    </div>
  `;
}

// Full-screen image viewer. Tap anywhere (or the close button) to dismiss.
function openImageLightbox(src, alt) {
  // Defense in depth: the caller already filters via exerciseImgSrc, but a
  // reusable helper re-checks the scheme so a future caller can't skip it.
  if (!src || !/^(data:image\/|https?:\/\/)/i.test(src) || /["'<>`\\\s]/.test(src)) return;
  document.querySelector('.img-lightbox')?.remove();
  const prevFocus = document.activeElement;
  const label = alt || t('view_photo');
  const box = document.createElement('div');
  box.className = 'img-lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', label);
  box.innerHTML = `
    <button type="button" class="img-lightbox-close" aria-label="${escapeHtml(t('close'))}">${icon('close', 22)}</button>
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" referrerpolicy="no-referrer">
  `;
  const close = () => { box.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  box.addEventListener('click', close);
  document.body.appendChild(box);
  requestAnimationFrame(() => { box.classList.add('open'); box.querySelector('.img-lightbox-close')?.focus(); });
}

// ==========================================================================
// Personal Records helper
// ==========================================================================
function checkPR(exerciseId, prior, newSets) {
  // Cold-start: no toast on the very first session ever
  if (prior.sessionCount === 0) return null;

  // Compute new max weight and best Epley 1RM from the sets just saved
  let newMaxW = 0;
  let newBestORM = 0;
  newSets.forEach((s) => {
    if (s.weight > newMaxW) newMaxW = s.weight;
    if (s.reps > 0 && s.weight > 0) {
      const orm = s.weight * (1 + s.reps / 30);
      if (orm > newBestORM) newBestORM = orm;
    }
  });

  // Re-read the post-write snapshot
  const postBest = DB.sessions.prSnapshot(exerciseId);

  const wPR = postBest.maxWeight > prior.maxWeight && newMaxW >= postBest.maxWeight;
  const ormPR = postBest.bestORM > prior.bestORM && newBestORM >= postBest.bestORM;

  if (!wPR && !ormPR) return null;

  if (wPR && ormPR) {
    return t('pr_both') + ' ' + fmtWeight(postBest.maxWeight) + unitLabel()
      + ' · ' + t('pr_est_orm') + ' ' + fmtWeight(Math.round(postBest.bestORM)) + unitLabel();
  }
  if (wPR) {
    return t('pr_weight') + ' ' + fmtWeight(postBest.maxWeight) + unitLabel();
  }
  // ormPR only
  return t('pr_orm') + ' ' + t('pr_est_orm') + ' ' + fmtWeight(Math.round(postBest.bestORM)) + unitLabel();
}

function computeStreak() {
  const sessions = DB.sessions.listAll();
  const cardio = DB.cardio.list();
  const activeDates = new Set();
  sessions.forEach((s) => activeDates.add(s.date));
  cardio.forEach((c) => activeDates.add(c.date));
  if (activeDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const d = new Date(today);
  if (!activeDates.has(todayIso)) d.setDate(d.getDate() - 1);

  while (true) {
    const iso = d.toISOString().slice(0, 10);
    if (activeDates.has(iso)) { streak += 1; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function totalVolumeThisWeek() {
  const { thisStart, thisEnd } = weekRanges();
  const sessions = DB.sessions.listAll().filter((s) => inRangeISO(s.date, thisStart, thisEnd));
  let total = 0;
  sessions.forEach((s) => s.sets.forEach((x) => { total += x.reps * x.weight; }));
  return Math.round(total);
}

function weekRanges() {
  const thisStart = startOfWeek(new Date());
  const thisEnd = new Date(thisStart); thisEnd.setDate(thisEnd.getDate() + 7);
  const lastStart = new Date(thisStart); lastStart.setDate(lastStart.getDate() - 7);
  const lastEnd = new Date(thisStart);
  return { thisStart, thisEnd, lastStart, lastEnd };
}

function deltaBlock(current, previous, unit) {
  if (current === 0 && previous === 0) {
    return `<div class="compare-delta flat">${icon('minus', 14)} ${t('no_data_short')}</div>`;
  }
  if (current > previous) {
    return `<div class="compare-delta up">${icon('arrowUp', 14)} +${formatDelta(current - previous)}${unit ? ' ' + unit : ''}</div>`;
  }
  if (current < previous) {
    return `<div class="compare-delta down">${icon('arrowDown', 14)} -${formatDelta(previous - current)}${unit ? ' ' + unit : ''}</div>`;
  }
  return `<div class="compare-delta flat">${icon('minus', 14)} ${t('same_as_last_week')}</div>`;
}

function formatDelta(n) { return (Math.round(n * 10) / 10).toString(); }

// Count-up animation for hero/stat numerals (rAF, ease-out cubic).
// Respects prefers-reduced-motion and cancels a previous run on re-render
// so navigating away and back never leaks a frame callback.
function animateNum(el, target, opts) {
  const ms = (opts && opts.ms) || 600;
  const fmt = (opts && opts.fmt) || fmtNum;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = fmt(target);
    return;
  }
  if (el.__animNum) cancelAnimationFrame(el.__animNum);
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (p < 1) el.__animNum = requestAnimationFrame(step);
    else el.__animNum = null;
  };
  el.__animNum = requestAnimationFrame(step);
}

// ==========================================================================
// HOME VIEW
// ==========================================================================
function renderHome(el) {
  const now = new Date();
  const { thisStart, thisEnd } = weekRanges();

  const allSessions = DB.sessions.listAll();
  const weekSessions = allSessions.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
  const weekSetsCount = weekSessions.reduce((sum, s) => sum + s.sets.length, 0);
  const weekWorkoutDays = new Set(weekSessions.map((s) => s.date)).size;

  const allCardio = DB.cardio.list();
  const weekCardio = allCardio.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const cardioMinutes = weekCardio.reduce((sum, c) => sum + c.duration, 0);

  const lastSleep = DB.sleep.latest();
  const sleepHours = lastSleep ? (lastSleep.durationMinutes / 60).toFixed(1) : null;
  const sleepSub = lastSleep ? daysAgoLocalized(lastSleep.date) : t('no_data');

  const streak = computeStreak();

  const hour = now.getHours();
  const greeting = hour < 12 ? t('greet_morning') : hour < 18 ? t('greet_afternoon') : t('greet_evening');
  const lang = DB.prefs.get().lang || 'en';
  const dayLabel = now.toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Muscle heatmap
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0);
  const exercises = DB.exercises.list();
  const exIdToCat = Object.fromEntries(exercises.map((e) => [e.id, e.category]));
  const catCounts = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c, 0]));
  allSessions.forEach((s) => {
    const d = new Date(s.date + 'T00:00:00');
    if (d >= sevenDaysAgo) {
      const cat = exIdToCat[s.exerciseId];
      if (cat && catCounts[cat] !== undefined) catCounts[cat] += 1;
    }
  });

  const heatCells = EXERCISE_CATEGORIES.filter((c) => c !== 'Other').map((cat) => {
    const count = catCounts[cat] || 0;
    let lvl = 0;
    if (count >= 1) lvl = 1;
    if (count >= 3) lvl = 2;
    if (count >= 5) lvl = 3;
    if (count >= 8) lvl = 4;
    // A real <button>: tapping a muscle opens its full session history.
    return `
      <button class="heat-cell lvl-${lvl}" data-muscle="${escapeHtml(cat)}" aria-label="${escapeHtml(categoryLabel(cat))}">
        <div class="heat-cell-name">${escapeHtml(categoryLabel(cat))}</div>
        <div class="heat-cell-count num">${count}</div>
      </button>
    `;
  }).join('');

  // Recent
  const recent = [
    ...allSessions.slice(0, 5).map((s) => {
      const ex = DB.exercises.getById(s.exerciseId);
      const maxW = Math.max(0, ...s.sets.map((x) => x.weight));
      return {
        date: s.date, createdAt: s.createdAt,
        iconName: 'dumbbell', iconCls: 'workout',
        title: ex ? ex.name : t('workouts'),
        meta: `${s.sets.length} ${t('sets').toLowerCase()}`,
        value: maxW > 0 ? `${fmtWeight(maxW)} ${unitLabel()}` : `${s.sets.reduce((tt, x) => tt + x.reps, 0)} ${t('reps')}`,
      };
    }),
    ...allCardio.slice(0, 5).map((c) => ({
      date: c.date, createdAt: c.createdAt,
      iconName: c.type === 'cycling' ? 'bike' : c.type === 'walking' ? 'walk' : 'treadmill',
      iconCls: c.type,
      title: t(c.type),
      meta: `${c.duration} ${t('minutes').toLowerCase()}`,
      value: `${c.calories} ${t('cal')}`,
    })),
    ...DB.sleep.list().slice(0, 5).map((s) => ({
      date: s.date, createdAt: s.createdAt,
      iconName: 'bed', iconCls: 'sleep',
      title: t('sleep'),
      meta: `${formatTime12(s.sleepTime)} → ${formatTime12(s.wakeTime)}`,
      value: formatDuration(s.durationMinutes),
    })),
  ].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  }).slice(0, 5);

  const recentHtml = recent.length === 0 ? '' : `
    <div class="section-title">${t('recent_activity')}</div>
    <div class="recent-list">
      ${recent.map((r) => `
        <div class="recent-item">
          <div class="recent-item-icon data-icon ${escapeHtml(r.iconCls)}">${icon(r.iconName, 16)}</div>
          <div class="recent-item-main">
            <div class="recent-item-title">${escapeHtml(r.title)}</div>
            <div class="recent-item-meta">${escapeHtml(daysAgoLocalized(r.date))} · ${escapeHtml(r.meta)}</div>
          </div>
          <div class="recent-item-value num">${escapeHtml(r.value)}</div>
        </div>
      `).join('')}
    </div>
  `;

  const streakUnit = streak === 1 ? t('streak_one_day') : t('streak_days');
  const streakLabel = streak > 0 ? t('streak_active') : t('streak_start');

  // Hero "Today" card — the flagship element of the redesigned home.
  // Plan scheduled today → plan name + muscles + a bold Start CTA.
  // No plan → this week's set count as a large count-up numeral.
  const todayPlan = DB.plan.workoutForDate(now);   // continuous rotation → today's slot
  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]));

  let heroHtml = '';
  if (todayPlan && todayPlan.exerciseIds && todayPlan.exerciseIds.length > 0) {
    const exObjs = todayPlan.exerciseIds.map((id) => exerciseById[id]).filter(Boolean);
    const muscles = groupMusclesFromExercises(exObjs);
    const sideRow = (label, keys, sideClass) => keys.length === 0 ? '' : `
      <div class="planner-side ${sideClass}">
        <span class="planner-side-label">${escapeHtml(label)}</span>
        <div class="planner-muscle-chips">
          ${keys.map((k) => `<span class="muscle-chip ${sideClass}">${escapeHtml(t('muscle_' + k))}</span>`).join('')}
        </div>
      </div>
    `;

    heroHtml = `
      <button class="hero-card" id="home-start-workout">
        <div class="hero-eyebrow">${t('today_plan')} · ${escapeHtml(dayName(now.getDay(), true))}</div>
        <div class="hero-title">${escapeHtml(todayPlan.name || t('start_workout'))}</div>
        <div class="hero-meta">${fmtNum(exObjs.length)} ${exObjs.length === 1 ? t('exercise') : t('exercises')} · ${fmtNum(weekSetsCount)} ${t('sessions_this_week')}</div>
        <div class="planner-day-muscles">
          ${sideRow(t('anterior'), muscles.anterior, 'anterior')}
          ${sideRow(t('posterior'), muscles.posterior, 'posterior')}
        </div>
        <div class="hero-cta">${icon('dumbbell', 18)}<span>${t('start_workout')}</span></div>
      </button>
    `;
  } else {
    heroHtml = `
      <button class="hero-card" data-goto="planner">
        <div class="hero-eyebrow">${t('this_week')} · ${escapeHtml(dayName(now.getDay(), true))}</div>
        <div class="hero-numeral num anim" data-count="${weekSetsCount}">0</div>
        <div class="hero-meta">${t('sessions_this_week')}</div>
        <div class="hero-cta ghost"><span>${t('no_plan_today_sub')}</span></div>
      </button>
    `;
  }

  el.innerHTML = `
    ${vaultBar({ action: icon('settings', 20), actionLabel: t('settings_title') })}

    <div class="home-head">
      <div class="home-head-text">
        <div class="home-hello">${escapeHtml(dayLabel)}</div>
        <div class="home-hero">${greeting}.</div>
      </div>
      <button class="streak-chip" data-goto="calendar" aria-label="${escapeHtml(streakLabel)}">
        ${icon('flame', 16)}<span class="num">${streak}</span><span class="streak-chip-unit">${streakUnit}</span>
      </button>
    </div>

    ${heroHtml}

    <div class="stat-strip">
      <button class="stat-cell" data-goto="workouts">
        <div class="stat-cell-value num"><span class="anim" data-count="${weekWorkoutDays}">0</span></div>
        <div class="stat-cell-label">${t('sessions_label')}</div>
      </button>
      <button class="stat-cell" data-goto="cardio">
        <div class="stat-cell-value num"><span class="anim" data-count="${cardioMinutes}">0</span><span class="unit">${t('minutes').slice(0, 3).toLowerCase()}</span></div>
        <div class="stat-cell-label">${t('cardio')}</div>
      </button>
      <button class="stat-cell" data-goto="sleep">
        <div class="stat-cell-value num">${sleepHours != null ? `<span class="anim" data-count="${Math.round(parseFloat(sleepHours) * 10)}" data-fixed="1">0</span><span class="unit">h</span>` : '—'}</div>
        <div class="stat-cell-label">${t('last_sleep')}</div>
      </button>
    </div>

    ${typeof Health !== 'undefined' ? Health.homeSectionHtml() : ''}

    <div class="muscle-heatmap">
      <div class="heatmap-head">
        <div>
          <div class="heatmap-title">${t('muscle_focus')}</div>
          <div class="heatmap-sub">${t('muscle_focus_sub')}</div>
        </div>
      </div>
      <div class="heatmap-grid band">${heatCells}</div>
    </div>

    <div class="section-title">${t('tools_section')}</div>
    <div class="tool-rail">
      <button class="tool-pod" data-goto="planner">
        <div class="tool-pod-icon">${icon('calendar', 18)}</div>
        <div class="tool-pod-label">${t('plan_card')}</div>
      </button>
      <button class="tool-pod" data-goto="calendar">
        <div class="tool-pod-icon">${icon('chart', 18)}</div>
        <div class="tool-pod-label">${t('calendar_card')}</div>
      </button>
      <button class="tool-pod" data-goto="personal-records">
        <div class="tool-pod-icon" aria-hidden="true">${icon('trophy', 18)}</div>
        <div class="tool-pod-label">${t('pr_card')}</div>
      </button>
    </div>

    ${recentHtml}

    <div style="text-align:center;opacity:.4;font-size:12px;margin:24px 0 8px;letter-spacing:.5px">THE VAULT · ${VAULT_BUILD}</div>
  `;

  // Count-up the hero/stat numerals (sleep is stored ×10 for one decimal)
  el.querySelectorAll('.anim[data-count]').forEach((n) => {
    const target = parseInt(n.dataset.count, 10) || 0;
    const fixed = n.dataset.fixed === '1';
    animateNum(n, target, fixed ? { fmt: (v) => (v / 10).toFixed(1) } : undefined);
  });

  bindVaultAction(() => navigate('settings'));
  // "Start Workout" hero card → straight into today's session logging.
  // Recompute the day at click time so it stays correct if Home was left open
  // across midnight.
  $('#home-start-workout', el)?.addEventListener('click', () =>
    navigate('session-day', { date: todayISO() })
  );
  // Tap a muscle in the focus heatmap → its full session history.
  el.querySelectorAll('[data-muscle]').forEach((b) =>
    b.addEventListener('click', () => navigate('muscle-sessions', { muscleCat: b.dataset.muscle }))
  );
  if (typeof Health !== 'undefined') Health.bindHomeSection();
}

// ==========================================================================
// Exercise display names
// Built-in exercises are STORED with their English name (that name is the key
// the cloud/mirror and the image catalogue match on, so it must never change).
// For display only, Arabic shows a transliteration of the same name.
// Exercises the user created themselves are NEVER re-labelled — they chose that
// name, so `isCustom` is returned verbatim in both languages. Anything missing
// from the map falls back to the English name.
// ==========================================================================
const EXERCISE_NAME_AR = {
  'Squat': 'سكوات',
  'Bench Press': 'بنش برس',
  'Deadlift': 'ديدليفت',
  'Incline Bench Press': 'إنكلاين بنش برس',
  'Dumbbell Press': 'دمبل برس',
  'Dumbbell Fly': 'دمبل فلاي',
  'Push Up': 'بوش أب',
  'Barbell Row': 'باربل رو',
  'Pull Up': 'بول أب',
  'Dumbbell Row': 'دمبل رو',
  'Front Squat': 'فرونت سكوات',
  'Romanian Deadlift': 'رومانيان ديدليفت',
  'Lunges': 'لانجز',
  'Calf Raise': 'كالف رايز',
  'Overhead Press': 'أوفرهيد برس',
  'Lateral Raise': 'لاترال رايز',
  'Front Raise': 'فرونت رايز',
  'Rear Delt Fly': 'ريّر دلت فلاي',
  'Shrugs': 'شرَجز',
  'Barbell Curl': 'باربل كيرل',
  'EZ Bar Curl': 'إي زد بار كيرل',
  'Dumbbell Curl': 'دمبل كيرل',
  'Incline Dumbbell Curl': 'إنكلاين دمبل كيرل',
  'Hammer Curl': 'هامر كيرل',
  'Concentration Curl': 'كونسنتريشن كيرل',
  'Spider Curl': 'سبايدر كيرل',
  'Reverse Curl': 'ريفيرس كيرل',
  'Chin-Up': 'تشين أب',
  'Tricep Pushdown': 'ترايسبس بوش داون',
  'Tricep Extension': 'ترايسبس إكستنشن',
  'Dips': 'ديبس',
  'Plank': 'بلانك',
  'Crunches': 'كرانشز',
  'Leg Raise': 'ليج رايز',
  'Russian Twist': 'رشن تويست',
  'Chest Press Machine': 'تشست برس ماشين',
  'Incline Chest Press Machine': 'إنكلاين تشست برس ماشين',
  'Pec Deck Machine': 'بيك ديك ماشين',
  'Cable Crossover': 'كيبل كروس أوفر',
  'Smith Machine Bench Press': 'سميث بنش برس',
  'Shoulder Press Machine': 'شولدر برس ماشين',
  'Smith Machine Shoulder Press': 'سميث شولدر برس',
  'Lateral Raise Machine': 'لاترال رايز ماشين',
  'Cable Lateral Raise': 'كيبل لاترال رايز',
  'Rear Delt Fly Machine': 'ريّر دلت فلاي ماشين',
  'Face Pull': 'فيس بول',
  'Cable Upright Row': 'كيبل أب رايت رو',
  'Cable Shrug': 'كيبل شرَج',
  'Lat Pulldown Machine': 'لات بول داون ماشين',
  'Seated Row Machine': 'سيتد رو ماشين',
  'T-Bar Row Machine': 'تي بار رو ماشين',
  'Iso-Lateral Row': 'أيزو لاترال رو',
  'Assisted Pull-Up Machine': 'أسستد بول أب ماشين',
  'Back Extension': 'باك إكستنشن',
  'Leg Press Machine': 'ليج برس ماشين',
  'Hack Squat Machine': 'هاك سكوات ماشين',
  'Smith Machine Squat': 'سميث سكوات',
  'Leg Extension Machine': 'ليج إكستنشن ماشين',
  'Leg Curl Machine': 'ليج كيرل ماشين',
  'Seated Leg Curl': 'سيتد ليج كيرل',
  'Hip Abductor Machine': 'هيب أبدكتر ماشين',
  'Hip Adductor Machine': 'هيب أدكتر ماشين',
  'Hip Thrust Machine': 'هيب ثرست ماشين',
  'Calf Raise Machine': 'كالف رايز ماشين',
  'Seated Calf Raise': 'سيتد كالف رايز',
  'Preacher Curl Machine': 'بريتشر كيرل ماشين',
  'Cable Curl': 'كيبل كيرل',
  'Triceps Dip Machine': 'ترايسبس ديب ماشين',
  'Assisted Dip Machine': 'أسستد ديب ماشين',
  'Cable Triceps Pushdown': 'كيبل ترايسبس بوش داون',
  'Overhead Cable Triceps': 'أوفرهيد كيبل ترايسبس',
  'Ab Crunch Machine': 'آب كرانش ماشين',
  'Cable Crunch': 'كيبل كرانش',
};

// The name to SHOW for an exercise. Never use this for storage, sync, or the
// image catalogue — those key off the raw `ex.name`.
function exDisplayName(ex) {
  if (!ex) return '';
  const raw = ex.name || '';
  if (ex.isCustom) return raw;                       // the user named it — leave it alone
  if (((DB.prefs.get().lang) || 'en') !== 'ar') return raw;
  return EXERCISE_NAME_AR[raw] || raw;
}

// Search should find an exercise by whichever name the user can see, so match
// the raw English name AND the displayed (possibly Arabic) one.
function exMatchesQuery(ex, q) {
  const s = String(q || '').toLowerCase();
  if (!s) return true;
  return (ex.name || '').toLowerCase().includes(s) || exDisplayName(ex).toLowerCase().includes(s);
}

// ==========================================================================
// Exercise card helpers
// ==========================================================================
function exerciseImgSrc(ex) {
  if (ex.customImage) {
    const v = String(ex.customImage);
    // Allow only safe schemes (data:image/* or https?://) AND reject any char
    // that could break out of an HTML attribute or a CSS url() context
    // (" ' < > ` \ or whitespace). This single guard protects every render
    // sink, so a poisoned imported/synced customImage can't inject markup.
    const schemeOk = /^data:image\//i.test(v) || /^https?:\/\//i.test(v);
    if (schemeOk && !/["'<>`\\\s]/.test(v)) return v;
    return '';
  }
  if (ex.imageSlug) return exerciseImageUrl(ex.imageSlug);
  return '';
}

// Back up a custom exercise's image to its durable cloud copy. Fire-and-forget:
// the base64 is already saved locally, so a failure here costs nothing and the
// login pass (syncExerciseImages) retries it.
function backupExerciseImageFor(exerciseId, dataUrl) {
  if (!exerciseId || !dataUrl) return;
  if (!/^data:image\//i.test(String(dataUrl))) return; // nothing new to upload
  if (!window.Cloud || !Cloud.backupExerciseImage) return;
  Cloud.backupExerciseImage(exerciseId, dataUrl)
    .then((path) => { if (path) DB.exercises.update(exerciseId, { imagePath: path }); })
    .catch(() => {});
}

// Reconcile custom exercise images against their durable copies. Runs after
// login/sync and does two jobs:
//   1. uploads any custom image that has no backup yet (covers every image
//      that existed before this feature shipped), and
//   2. HEALS an exercise whose base64 was lost with the blob but whose backup
//      survived — the exact failure that once wiped every image.
// Best-effort and silent; never blocks the UI.
async function syncExerciseImages() {
  if (!window.Cloud || !Cloud.backupExerciseImage) return;
  let healed = 0;
  for (const ex of DB.exercises.list().filter((e) => e.isCustom)) {
    try {
      if (ex.customImage && !ex.imagePath) {
        const path = await Cloud.backupExerciseImage(ex.id, ex.customImage);
        if (path) DB.exercises.update(ex.id, { imagePath: path });
      } else if (!ex.customImage && ex.imagePath) {
        const dataUrl = await Cloud.restoreExerciseImage(ex.imagePath);
        if (dataUrl) { DB.exercises.update(ex.id, { customImage: dataUrl }); healed++; }
      }
    } catch (_) {}
  }
  if (healed) { try { renderView(currentView); } catch (_) {} }
}

function bentoCardHtml(ex, i, { showPR = true, toggle = null } = {}) {
  const isWide = i % 5 === 0;
  const stats = DB.sessions.bestStats(ex.id);
  const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
  const url = exerciseImgSrc(ex);
  const initials = escapeHtml(initialsOf(exDisplayName(ex)));

  let metaText;
  if (stats.totalSets > 0) {
    metaText = `${stats.totalSets} ${t('sets').toLowerCase()}`;
    if (stats.maxWeight > 0) metaText += ` · ${fmtWeight(stats.maxWeight)} ${unitLabel()}`;
  } else {
    metaText = t('no_sessions_yet');
  }

  const prBadge = showPR && stats.maxWeight > 0 && stats.totalSets >= 2
    ? `<div class="bento-pr">${icon('trophy', 10)} ${t('pr')} ${fmtWeight(stats.maxWeight)}${unitLabel()}</div>`
    : '';

  // Rendered as <span role="button">, NOT <button>: the card itself is a
  // <button>, and HTML forbids nesting buttons — the parser closes the card
  // early and spills the rest of the card (badges + content footer) out as
  // siblings. The span keeps the DOM intact; clicks/keys are delegated.
  const toggleBtn = toggle
    ? `<span class="bento-toggle ${toggle.added ? 'added' : ''}" data-toggle-ex="${ex.id}" role="button" tabindex="0" aria-label="${escapeHtml(toggle.added ? t('remove_image') : t('add_to_train'))}">${icon(toggle.added ? 'check' : 'plus', 16)}</span>`
    : '';

  // When the card is part of a list with a toggle (Library), mark cards that
  // are already in the user's Train list so they stand out clearly.
  const addedClass = toggle && toggle.added ? 'added' : '';
  const addedBadge = toggle && toggle.added
    ? `<div class="bento-added-stripe"><span class="bento-added-stripe-icon">${icon('check', 13)}</span><span>${t('added')}</span></div>`
    : '';

  let bgHtml;
  if (machineSvg) {
    // Machine: show the real photo on top of the blueprint SVG. If the photo
    // fails to load it removes itself and the SVG underneath shows through.
    bgHtml = `
      <div class="bento-card-bg machine-bg" data-cat="${escapeHtml(ex.category)}">
        ${machineSvg}
        ${url ? `<img class="machine-photo" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      </div>
    `;
  } else if (url) {
    bgHtml = `<div class="bento-card-bg" data-cat="${escapeHtml(ex.category)}" style="background-image:url('${escapeHtml(url)}')"></div>`;
  } else {
    bgHtml = `<div class="bento-card-bg fallback" data-cat="${escapeHtml(ex.category)}">${initials}</div>`;
  }

  return `
    <button class="bento-card ${isWide ? 'wide' : ''} ${addedClass}" data-exercise="${ex.id}">
      ${bgHtml}
      <div class="bento-card-name-tag" title="${escapeHtml(exDisplayName(ex))}">${escapeHtml(exDisplayName(ex))}</div>
      ${toggleBtn}
      ${!toggleBtn ? prBadge : ''}
      ${addedBadge}
      <div class="bento-card-content">
        <span class="bento-card-cat-mini ${escapeHtml(ex.category)}" data-cat="${escapeHtml(ex.category)}">${escapeHtml(categoryLabel(ex.category))}</span>
        <div class="bento-card-meta">${escapeHtml(metaText)}</div>
      </div>
    </button>
  `;
}

// ==========================================================================
// TRAIN (user's selected exercises)
// ==========================================================================
function renderWorkouts(el) {
  const all = DB.exercises.list();
  const myList = all.filter((e) => e.inMyList);
  const query = viewContext.workoutQuery || '';
  const filter = viewContext.workoutFilter || 'All';

  const filterPills = ['All', ...EXERCISE_CATEGORIES]
    .map((f) => `<button class="filter-pill ${f === filter ? 'active' : ''}" data-filter="${f}">${escapeHtml(categoryLabel(f))}</button>`)
    .join('');

  // Shell renders ONCE — search box and filter bar survive list updates, so
  // the keyboard never loses focus and no cursor-restore hack is needed.
  el.innerHTML = `
    ${vaultBar({ action: icon('chart', 20), actionLabel: t('library_title') })}

    <div class="page-header">
      <div class="page-eyebrow">${t('library')} · ${fmtNum(myList.length)}</div>
      <h1 class="page-title">${t('train')}</h1>
      <p class="page-subtitle">${t('train_subtitle')}</p>
    </div>

    <div class="toolbar" style="display:flex;gap:10px;margin-bottom:14px">
      <div class="search-wrap">
        ${icon('search', 18)}
        <input type="search" id="workout-search" placeholder="${t('search_exercises')}" value="${escapeHtml(query)}">
      </div>
      <button class="btn btn-accent train-add-btn" data-library-pick aria-label="${escapeHtml(t('add_from_library'))}">${icon('plus', 18)} <span>${t('add_from_library')}</span></button>
    </div>

    ${myList.length > 0 ? `<div class="filter-bar">${filterPills}</div>` : ''}

    <div id="workout-grid"></div>
  `;

  // Rebuild ONLY the card grid (search/filter changes) — not the whole view.
  function updateWorkoutGrid() {
    const grid = $('#workout-grid', el);
    if (!grid) return;
    const q = (viewContext.workoutQuery || '').toLowerCase();
    const f = viewContext.workoutFilter || 'All';
    const mine = DB.exercises.list().filter((e) => e.inMyList);

    let filtered = mine;
    if (f !== 'All') filtered = filtered.filter((e) => e.category === f);
    if (q) filtered = filtered.filter((e) => exMatchesQuery(e, q));

    // Keep cards as an ARRAY so the "add" card can be spliced after the first
    // card without string-searching for '</button>' (which would break the day
    // a card gains a nested control).
    const cards = filtered.map((ex, i) => bentoCardHtml(ex, i));

    const addCard = `
      <button class="bento-card bento-add" id="add-exercise-btn">
        ${icon('plus', 26)}
        <div>
          <div class="bento-add-title">${t('new_exercise')}</div>
          <div class="bento-add-sub">${t('add_custom')}</div>
        </div>
      </button>
    `;

    if (filtered.length === 0 && mine.length === 0) {
      // Truly empty: show empty-state CTA to browse library
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-icon">${icon('dumbbell', 52)}</div>
          <div class="empty-title">${t('train_empty_title')}</div>
          <div class="empty-text">${t('train_empty_text')}</div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:18px;flex-wrap:wrap">
            <button class="btn btn-accent" data-library-pick>${icon('plus', 16)} ${t('add_from_library')}</button>
            <button class="btn btn-ghost" id="add-exercise-btn">${icon('plus', 16)} ${t('add_custom')}</button>
          </div>
        </div>
      `;
    } else if (filtered.length === 0) {
      grid.innerHTML = emptyState({ iconName: 'search', title: t('no_matches'), text: t('no_matches_hint') });
    } else {
      cards.splice(1, 0, addCard); // after the first (wide) card
      grid.innerHTML = `<div class="bento-grid">${cards.join('')}</div>`;
    }
  }
  updateWorkoutGrid();

  // Vault top action → open Library
  bindVaultAction(() => navigate('library'));

  // Debounced search → grid-only update (was a full view re-render per keystroke)
  let searchTimer = null;
  $('#workout-search', el)?.addEventListener('input', (e) => {
    viewContext.workoutQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateWorkoutGrid, 150);
  });

  el.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      viewContext.workoutFilter = btn.dataset.filter;
      el.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      updateWorkoutGrid();
    })
  );

  // ONE delegated listener for the grid (cards + add button + empty-state CTAs),
  // attached once — no re-binding per keystroke.
  $('#workout-grid', el).addEventListener('click', (e) => {
    if (e.target.closest('#add-exercise-btn')) { openNewExerciseModal(); return; }
    if (e.target.closest('[data-library-pick]')) { navigate('library', { libraryPickMode: true }); return; }
    const card = e.target.closest('[data-exercise]');
    if (card) navigate('exercise-detail', { exerciseId: card.dataset.exercise });
  });

  // The toolbar's "Add from Library" button lives outside the grid.
  el.querySelectorAll('.toolbar [data-library-pick]').forEach((b) =>
    b.addEventListener('click', () => navigate('library', { libraryPickMode: true }))
  );
}

// ==========================================================================
// LIBRARY - browse all exercises grouped by category, with add/remove toggle
// ==========================================================================
function renderLibrary(el) {
  const exercises = DB.exercises.list();
  const query = viewContext.libraryQuery || '';
  const filter = viewContext.libraryFilter || 'All';
  const pickMode = !!viewContext.libraryPickMode;
  const addedCount = exercises.filter((e) => e.inMyList).length;

  const filterPills = ['All', ...EXERCISE_CATEGORIES]
    .map((f) => `<button class="filter-pill ${f === filter ? 'active' : ''}" data-filter="${f}">${escapeHtml(categoryLabel(f))}</button>`)
    .join('');

  const topBar = pickMode
    ? `
      <div class="detail-top">
        <button class="back-btn" data-pick-done aria-label="${escapeHtml(t('done'))}">${icon('back', 20)}</button>
        <div class="detail-top-title">${t('add_from_library')}</div>
        <button class="btn btn-primary" data-pick-done style="height:36px;padding:0 14px;font-size:13px">${t('done')}</button>
      </div>
    `
    : `
      <div class="detail-top">
        <button class="back-btn" data-goto="workouts">${icon('back', 20)}</button>
        <div class="detail-top-title">${t('library_title')}</div>
      </div>
    `;

  const headerBlock = pickMode
    ? `
      <div class="pick-banner">
        <div class="pick-banner-icon">${icon('plus', 22)}</div>
        <div class="pick-banner-main">
          <div class="pick-banner-title">${t('pick_mode_title')}</div>
          <div class="pick-banner-sub">${t('pick_mode_sub')}</div>
        </div>
        <div class="pick-banner-count num">${fmtNum(addedCount)}</div>
      </div>
    `
    : `
      <div class="page-header">
        <div class="page-eyebrow">${fmtNum(exercises.length)}</div>
        <h1 class="page-title">${t('library_title')}</h1>
        <p class="page-subtitle">${t('library_subtitle')}</p>
      </div>
    `;

  // Shell renders ONCE — search box and filter bar are never rebuilt, so the
  // keyboard keeps focus and no cursor-restore hack is needed.
  el.innerHTML = `
    ${topBar}

    ${headerBlock}

    <div class="toolbar" style="display:flex;gap:10px;margin-bottom:14px">
      <div class="search-wrap">
        ${icon('search', 18)}
        <input type="search" id="library-search" placeholder="${t('search_exercises')}" value="${escapeHtml(query)}">
      </div>
    </div>

    <div class="filter-bar">${filterPills}</div>

    <div id="library-list"></div>
  `;

  // In pick mode, mark the body so we can style cards differently (cursor, hover)
  document.body.classList.toggle('library-pick-mode', pickMode);

  // Rebuild ONLY the grouped card list — called on search/filter changes.
  function updateLibraryList() {
    const list = $('#library-list', el);
    if (!list) return;
    const q = (viewContext.libraryQuery || '').toLowerCase();
    const f = viewContext.libraryFilter || 'All';

    let filtered = DB.exercises.list();
    if (f !== 'All') filtered = filtered.filter((x) => x.category === f);
    if (q) filtered = filtered.filter((x) => exMatchesQuery(x, q));

    // Group filtered exercises by category, in EXERCISE_CATEGORIES order
    const grouped = {};
    filtered.forEach((ex) => {
      if (!grouped[ex.category]) grouped[ex.category] = [];
      grouped[ex.category].push(ex);
    });

    const groupsHtml = EXERCISE_CATEGORIES
      .filter((cat) => grouped[cat] && grouped[cat].length > 0)
      .map((cat) => {
        const items = grouped[cat].map((ex, i) =>
          bentoCardHtml(ex, i, { showPR: false, toggle: { added: !!ex.inMyList } })
        ).join('');
        return `
          <div class="lib-section">
            <div class="lib-section-head">
              <h2 class="lib-section-title" data-cat="${cat}">${escapeHtml(categoryLabel(cat))}</h2>
              <span class="lib-section-count num">${fmtNum(grouped[cat].length)}</span>
            </div>
            <div class="bento-grid">${items}</div>
          </div>
        `;
      })
      .join('');

    list.innerHTML = filtered.length === 0
      ? emptyState({ iconName: 'search', title: t('no_matches'), text: t('no_matches_hint') })
      : groupsHtml;
  }
  updateLibraryList();

  // Debounced search → list-only update (was a full 100+ card re-render per keystroke)
  let searchTimer = null;
  $('#library-search', el)?.addEventListener('input', (e) => {
    viewContext.libraryQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateLibraryList, 150);
  });

  el.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      viewContext.libraryFilter = btn.dataset.filter;
      el.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      updateLibraryList();
    })
  );

  // Flip ONE card's added-state in place — no list re-render, scroll preserved.
  function setCardAdded(id, added) {
    el.querySelectorAll(`.bento-card[data-exercise="${id}"]`).forEach((card) => {
      card.classList.toggle('added', added);
      const tBtn = card.querySelector('[data-toggle-ex]');
      if (tBtn) {
        tBtn.classList.toggle('added', added);
        tBtn.innerHTML = icon(added ? 'check' : 'plus', 16);
        tBtn.setAttribute('aria-label', added ? t('remove_image') : t('add_to_train'));
      }
      const stripe = card.querySelector('.bento-added-stripe');
      if (added && !stripe) {
        card.insertAdjacentHTML('beforeend',
          `<div class="bento-added-stripe"><span class="bento-added-stripe-icon">${icon('check', 13)}</span><span>${t('added')}</span></div>`);
      } else if (!added && stripe) {
        stripe.remove();
      }
    });
    const count = $('.pick-banner-count', el);
    if (count) count.textContent = fmtNum(DB.exercises.list().filter((x) => x.inMyList).length);
  }

  function toggleExercise(id) {
    const ex = DB.exercises.getById(id);
    if (!ex) return;
    const newState = !ex.inMyList;
    DB.exercises.setInMyList(id, newState);
    showToast(newState ? t('added_to_train') : t('removed_from_train'));
    setCardAdded(id, newState);
  }

  // ONE delegated click listener for the whole list (was 100+ per-card
  // listeners re-attached on every keystroke). Preserves all three behaviors:
  // toggle button, pick-mode whole-card toggle, normal navigate-to-detail.
  $('#library-list', el).addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-toggle-ex]');
    if (toggleBtn) {
      e.stopPropagation();
      e.preventDefault();
      toggleExercise(toggleBtn.dataset.toggleEx);
      return;
    }
    const card = e.target.closest('[data-exercise]');
    if (!card) return;
    if (pickMode) toggleExercise(card.dataset.exercise);
    else navigate('exercise-detail', { exerciseId: card.dataset.exercise });
  });

  // Keyboard support for the span-based toggle (role="button")
  $('#library-list', el).addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const toggleBtn = e.target.closest('[data-toggle-ex]');
    if (toggleBtn) {
      e.preventDefault();
      toggleExercise(toggleBtn.dataset.toggleEx);
    }
  });

  // Done button — exits pick mode and returns to Train
  el.querySelectorAll('[data-pick-done]').forEach((b) =>
    b.addEventListener('click', () => {
      viewContext.libraryPickMode = false;
      document.body.classList.remove('library-pick-mode');
      navigate('workouts');
    })
  );
}

// Small chooser shown by the session-day "Add exercise" button: pick from the
// library, or create a new custom exercise and drop it straight into this day.
// Add an exercise to a rotation cycle SLOT (slotIdx). Two ways: pick from the
// library (opens the slot editor) or create a brand-new custom exercise.
function openAddExerciseChooser(slotIdx) {
  openModal(`
    <div class="modal-header">
      <div><div class="modal-title">${t('add_exercise')}</div></div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
      <button type="button" class="btn btn-ghost btn-block" id="ch-from-lib" style="justify-content:center;gap:8px;padding:16px;font-size:15px">${icon('dumbbell', 18)} ${t('add_from_library')}</button>
      <button type="button" class="btn btn-ghost btn-block" id="ch-new-ex" style="justify-content:center;gap:8px;padding:16px;font-size:15px">${icon('plus', 18)} ${t('new_exercise')}</button>
    </div>
  `);
  // Both replace this chooser via openModal — no explicit close needed.
  $('#ch-from-lib').addEventListener('click', () => openSlotEditorModal(slotIdx));
  $('#ch-new-ex').addEventListener('click', () => {
    openNewExerciseModal(null, {
      onCreated: (ex) => {
        if (!ex || !ex.id) return;
        if (slotIdx != null && slotIdx >= 0) DB.plan.addExerciseToSlot(slotIdx, ex.id);
      },
    });
  });
}

function openNewExerciseModal(exerciseId = null, opts = {}) {
  const existing = exerciseId ? DB.exercises.getById(exerciseId) : null;
  const categoryOptions = EXERCISE_CATEGORIES.map(
    (c) => `<option value="${c}" ${existing && existing.category === c ? 'selected' : ''}>${escapeHtml(categoryLabel(c))}</option>`
  ).join('');

  let pickedImage = existing ? (existing.customImage || null) : null;

  function previewHtml() {
    if (pickedImage) {
      return `<img src="${pickedImage}" alt="">`;
    }
    return icon('apple', 22);
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_session') : t('new_exercise')}</div>
        <div class="modal-subtitle">${t('new_exercise_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="ex-name" placeholder="${t('ph_exercise_name')}" value="${existing ? escapeHtml(existing.name) : ''}" autofocus>
    </div>

    <div class="form-group">
      <label class="form-label">${t('category')}</label>
      <select id="ex-category">${categoryOptions}</select>
    </div>

    <div class="form-group">
      <label class="form-label">${t('image_optional')}</label>
      <div class="image-uploader">
        <div class="image-actions">
          <button type="button" class="btn btn-ghost" id="ex-image-camera">${icon('camera', 16)} ${t('take_photo')}</button>
          <button type="button" class="btn btn-ghost" id="ex-image-pick">${pickedImage ? t('change_image') : t('choose_image')}</button>
          ${pickedImage ? `<button type="button" class="btn btn-danger" id="ex-image-clear">${t('remove_image')}</button>` : ''}
        </div>
      </div>
      <div class="image-hint">${t('image_hint')}</div>
      <input type="file" id="ex-image-file" accept="image/*" hidden>
      <input type="file" id="ex-image-camera-file" accept="image/*" capture="environment" hidden>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-exercise-btn">${existing ? t('save') : t('save')}</button>
    </div>
  `);

  function refreshPreview() {
    const prev = $('#ex-image-preview');
    if (prev) prev.innerHTML = previewHtml();
    const pickBtn = $('#ex-image-pick');
    if (pickBtn) pickBtn.textContent = pickedImage ? t('change_image') : t('choose_image');
    let clearBtn = $('#ex-image-clear');
    if (pickedImage && !clearBtn) {
      const actions = pickBtn?.parentElement;
      if (actions) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'btn btn-danger';
        c.id = 'ex-image-clear';
        c.textContent = t('remove_image');
        c.addEventListener('click', () => { pickedImage = null; refreshPreview(); });
        actions.appendChild(c);
      }
    } else if (!pickedImage && clearBtn) {
      clearBtn.remove();
    }
  }

  // Shared handler for both the gallery picker and the camera capture.
  async function handleImageFile(file) {
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 800, 0.78);
      pickedImage = dataUrl;
      refreshPreview();
    } catch (err) {
      showToast('Image error');
    }
  }
  $('#ex-image-pick').addEventListener('click', () => $('#ex-image-file').click());
  $('#ex-image-file').addEventListener('change', (e) => handleImageFile(e.target.files && e.target.files[0]));
  // Camera: capture="environment" opens the rear camera directly on mobile.
  $('#ex-image-camera').addEventListener('click', () => $('#ex-image-camera-file').click());
  $('#ex-image-camera-file').addEventListener('change', (e) => handleImageFile(e.target.files && e.target.files[0]));
  const initialClear = $('#ex-image-clear');
  if (initialClear) {
    initialClear.addEventListener('click', () => { pickedImage = null; refreshPreview(); });
  }

  $('#save-exercise-btn').addEventListener('click', () => {
    const name = $('#ex-name').value.trim();
    const category = $('#ex-category').value;
    if (!name) { showToast(t('enter_name')); return; }
    if (existing) {
      DB.exercises.update(existing.id, { name, category, customImage: pickedImage });
      backupExerciseImageFor(existing.id, pickedImage); // durable copy, best-effort
      showToast(t('updated'));
    } else {
      const created = DB.exercises.add({ name, category, customImage: pickedImage });
      backupExerciseImageFor(created.id, pickedImage); // durable copy, best-effort
      if (typeof opts.onCreated === 'function') opts.onCreated(created);
      showToast(t('exercise_added'));
    }
    closeModal();
    renderView(currentView);
  });

  setTimeout(() => $('#ex-name')?.focus(), 60);
}

// ==========================================================================
// EXERCISE DETAIL
// ==========================================================================
function renderExerciseDetail(el, exerciseId) {
  const ex = DB.exercises.getById(exerciseId);
  if (!ex) {
    el.innerHTML = emptyState({ title: t('not_found'), text: t('not_found_text') });
    return;
  }

  const sessions = DB.sessions.listByExercise(exerciseId);
  const stats = DB.sessions.bestStats(exerciseId);

  let prSessionId = null;
  let prWeight = 0;
  sessions.forEach((s) => s.sets.forEach((set) => {
    if (set.weight > prWeight) { prWeight = set.weight; prSessionId = s.id; }
  }));

  const imageUrl = exerciseImgSrc(ex);
  const heroHtml = imageUrl
    ? `
      <div class="detail-hero-wrap">
        <div class="detail-hero">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(exDisplayName(ex))}" referrerpolicy="no-referrer"
               onerror="this.closest('.detail-hero').classList.add('empty'); this.remove();">
        </div>
        <div class="detail-hero-overlay">
          <div class="detail-hero-name">${escapeHtml(exDisplayName(ex))}</div>
          <div class="detail-hero-cat pill cat-${escapeHtml(ex.category)}">${escapeHtml(categoryLabel(ex.category))}</div>
        </div>
      </div>
    `
    : `
      <div class="detail-hero-wrap">
        <div class="detail-hero empty">${ex.isCustom ? t('custom_exercise_label') : escapeHtml(categoryLabel(ex.category).toUpperCase())}</div>
        <div class="detail-hero-overlay">
          <div class="detail-hero-name">${escapeHtml(exDisplayName(ex))}</div>
          <div class="detail-hero-cat pill cat-${escapeHtml(ex.category)}">${escapeHtml(categoryLabel(ex.category))}</div>
        </div>
      </div>
    `;

  const sessionsHtml = sessions.map((s) => {
    const volume = s.sets.reduce((tt, x) => tt + x.reps * x.weight, 0);
    const isPR = s.id === prSessionId;
    const setsHtml = s.sets.map((set, i) => {
      const isBest = isPR && set.weight === prWeight;
      return `
        <div class="sets-row ${isBest ? 'best' : ''}">
          <div class="sets-row-n">${t('set_n')} ${i + 1}</div>
          <div class="sets-row-reps">
            <span class="sets-row-num num">${escapeHtml(String(set.reps))}</span>
            <span class="sets-row-unit">${t('reps')}</span>
          </div>
          <div class="sets-row-weight">${fmtWeightDual(set.weight)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="session-card ${isPR ? 'pr' : ''}">
        <div class="session-card-header">
          <div>
            <div class="session-card-date">
              ${formatDate(s.date)}
              ${isPR ? `<span class="pill pr">${t('pr')}</span>` : ''}
            </div>
            <div class="session-card-ago">${daysAgoLocalized(s.date)}</div>
          </div>
          <div class="session-card-volume">
            <div class="session-card-volume-label">${t('volume_label')}</div>
            <div class="session-card-volume-value">${fmtWeightDualRound(volume)}</div>
          </div>
        </div>
        ${setsHtml}
        <div class="session-actions">
          <button class="icon-btn" data-edit-session="${s.id}">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-delete-session="${s.id}">${icon('trash', 16)}</button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-back>${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(exDisplayName(ex))}</div>
      ${ex.isCustom ? `<button class="icon-btn icon-btn-tile danger" id="delete-exercise-btn">${icon('trash', 16)}</button>` : ''}
    </div>

    ${heroHtml}

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-box-label">${t('max_weight')}</div>
        <div class="stat-box-value ${stats.maxWeight === 0 ? 'none' : 'accent'} num">
          ${stats.maxWeight > 0 ? fmtWeight(stats.maxWeight) : '—'}<span class="stat-box-unit">${stats.maxWeight > 0 ? unitLabel() : ''}</span>
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('max_reps')}</div>
        <div class="stat-box-value ${stats.maxReps === 0 ? 'none' : ''} num">
          ${stats.maxReps > 0 ? stats.maxReps : '—'}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">${t('total_sets')}</div>
        <div class="stat-box-value ${stats.totalSets === 0 ? 'none' : ''} num">
          ${stats.totalSets > 0 ? fmtNum(stats.totalSets) : '—'}
        </div>
      </div>
    </div>

    ${chartHtmlForExercise(exerciseId)}

    ${variationsHtmlForExercise(ex)}

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('history')}</div>
      <button class="btn btn-primary" id="add-session-btn">${icon('plus', 16)} ${t('log_session')}</button>
    </div>

    ${sessions.length === 0
      ? emptyState({ iconName: 'dumbbell', title: t('no_sessions'), text: t('log_session_tap') })
      : `<div class="session-list">${sessionsHtml}</div>`
    }
  `;

  $('#add-session-btn', el).addEventListener('click', () => openSessionModal(exerciseId));

  el.querySelectorAll('[data-goto-alt]').forEach((b) =>
    b.addEventListener('click', () => navigate('exercise-detail', { exerciseId: b.dataset.gotoAlt }))
  );

  el.querySelectorAll('[data-edit-session]').forEach((b) =>
    b.addEventListener('click', () => openSessionModal(exerciseId, b.dataset.editSession))
  );
  el.querySelectorAll('[data-delete-session]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_session_q'),
        text: t('delete_session_text'),
        onConfirm: () => {
          DB.sessions.remove(b.dataset.deleteSession);
          showToast(t('session_deleted'));
          renderExerciseDetail(el, exerciseId);
        },
      });
    })
  );

  const delBtn = $('#delete-exercise-btn', el);
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_exercise_q'),
        text: t('delete_exercise_text'),
        onConfirm: () => {
          DB.exercises.remove(exerciseId);
          showToast(t('exercise_deleted'));
          navigate('workouts');
        },
      });
    });
  }
}

function openSessionModal(exerciseId, sessionId = null) {
  const existing = sessionId ? DB.sessions.listByExercise(exerciseId).find((s) => s.id === sessionId) : null;
  const lastSession = DB.sessions.lastForExercise(exerciseId, sessionId);

  let sets = existing
    ? existing.sets.map((s) => ({ reps: s.reps, weight: s.weight }))
    : lastSession
    ? lastSession.sets.map((s) => ({ reps: s.reps, weight: s.weight }))
    : [{ reps: 10, weight: 0 }]; // start with one set; user adds/removes as needed

  const initialDate = existing ? existing.date : todayISO();

  // Per-session unit selector (starts from user pref, but can be toggled inside the modal).
  // Stored weight is always kg internally; this only affects what the user types/sees here.
  let modalUnit = (DB.prefs.get().unit) || 'kg';

  function modalConvertForDisplay(kg) {
    if (modalUnit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2;
    return Math.round(kg * 100) / 100;
  }
  function modalConvertToKg(value) {
    if (modalUnit === 'lb') return Math.round((value / KG_TO_LB) * 100) / 100;
    return Number(value);
  }

  function renderSetsEditor() {
    const editor = $('#sets-editor');
    if (!editor) return;
    // Update the unit-column header to match the current modal unit
    const unitColEl = document.querySelector('#sets-unit-col');
    if (unitColEl) unitColEl.textContent = modalUnit.toUpperCase();

    editor.innerHTML = sets.map((s, i) => {
      const wDisplay = s.weight === '' || s.weight == null ? '' : modalConvertForDisplay(Number(s.weight));
      return `
      <div class="set-edit-row" data-set-index="${i}">
        <div class="set-edit-n num">${i + 1}</div>
        <input type="number" inputmode="numeric" step="1" min="0" placeholder="0" value="${s.reps || ''}" data-field="reps">
        <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" value="${wDisplay || ''}" data-field="weight">
        <button type="button" class="set-remove" data-remove-set="${i}">${icon('close', 16)}</button>
      </div>
      `;
    }).join('');

    editor.querySelectorAll('.set-edit-row').forEach((row) => {
      const idx = Number(row.dataset.setIndex);
      row.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', () => {
          const v = inp.value;
          if (inp.dataset.field === 'weight') {
            sets[idx].weight = v === '' ? '' : modalConvertToKg(Number(v));
          } else {
            sets[idx][inp.dataset.field] = v === '' ? '' : Number(v);
          }
        });
      });
      row.querySelector('[data-remove-set]').addEventListener('click', () => {
        if (sets.length <= 1) { showToast(t('set_min_one')); return; }
        sets.splice(idx, 1);
        renderSetsEditor();
      });
    });
  }

  function setModalUnit(u) {
    if (u !== 'kg' && u !== 'lb') return;
    if (u === modalUnit) return;
    modalUnit = u;
    document.querySelectorAll('[data-modal-unit]').forEach((b) => {
      b.classList.toggle('active', b.dataset.modalUnit === modalUnit);
    });
    renderSetsEditor();
  }

  const ex = DB.exercises.getById(exerciseId);
  const lastPreview = lastSession ? `
    <div class="prev-session">
      <div class="prev-session-head">
        <span>${t('last_session')}</span>
        <span>${daysAgoLocalized(lastSession.date)}</span>
      </div>
      <div class="prev-session-sets">
        ${lastSession.sets.map((s) => `${escapeHtml(String(s.reps))} × ${fmtWeight(s.weight)}${unitLabel()}`).join(' · ')}
      </div>
    </div>
  ` : '';

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_session') : t('log_session')}</div>
        <div class="modal-subtitle">${escapeHtml(exDisplayName(ex))}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    ${lastPreview}

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="session-date" value="${initialDate}">
    </div>

    <div class="form-group">
      <div class="sets-label-row">
        <label class="form-label" style="margin:0">${t('sets')}</label>
        <div class="modal-unit-toggle" role="group" aria-label="${escapeHtml(t('unit'))}">
          <button type="button" data-modal-unit="kg" class="${modalUnit === 'kg' ? 'active' : ''}">KG</button>
          <button type="button" data-modal-unit="lb" class="${modalUnit === 'lb' ? 'active' : ''}">LB</button>
        </div>
      </div>
      <div class="sets-editor-head">
        <div>${t('set_n')}</div>
        <div>${t('reps')}</div>
        <div id="sets-unit-col">${modalUnit.toUpperCase()}</div>
        <div></div>
      </div>
      <div class="sets-editor" id="sets-editor"></div>
      <button type="button" class="set-add-btn" id="add-set-btn">${icon('plus', 14)} ${t('add_set')}</button>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-session-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  renderSetsEditor();

  document.querySelectorAll('[data-modal-unit]').forEach((b) =>
    b.addEventListener('click', () => setModalUnit(b.dataset.modalUnit))
  );

  $('#add-set-btn').addEventListener('click', () => {
    const last = sets[sets.length - 1];
    sets.push({ reps: last?.reps || 10, weight: last?.weight || 0 });
    renderSetsEditor();
  });

  $('#save-session-btn').addEventListener('click', () => {
    const date = $('#session-date').value || todayISO();
    const cleaned = sets
      .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
      .filter((s) => s.reps > 0 || s.weight > 0);
    if (cleaned.length === 0) { showToast(t('add_at_least_one')); return; }
    // Snapshot BEFORE write (full snapshot including the session being edited)
    const prior = DB.sessions.prSnapshot(exerciseId);
    if (existing) {
      DB.sessions.update(existing.id, { date, sets: cleaned });
    } else {
      DB.sessions.add({ exerciseId, date, sets: cleaned });
    }
    const prMsg = checkPR(exerciseId, prior, cleaned);
    if (prMsg) {
      showToast(prMsg);
    } else {
      showToast(existing ? t('session_updated') : t('session_saved'));
    }
    closeModal();
    renderView(currentView);
  });
}

// ==========================================================================
// CARDIO
// ==========================================================================
function renderCardio(el) {
  const list = DB.cardio.list();
  const { thisStart, thisEnd } = weekRanges();
  const weekItems = list.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const weekMin = weekItems.reduce((s, c) => s + c.duration, 0);
  const weekCal = weekItems.reduce((s, c) => s + c.calories, 0);

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

  const items = list.map((c) => {
    const tm = resolveCardioType(c.type);
    return `
      <div class="data-row">
        <div class="data-icon ${tm.cls}">${icon(tm.iconName, 20)}</div>
        <div class="data-main">
          <div class="data-title">${escapeHtml(tm.label)}${c.source === 'health' ? `<span class="src-badge">${icon('refresh', 11)}${t('from_watch')}</span>` : ''}</div>
          <div class="data-meta">
            <span>${escapeHtml(daysAgoLocalized(c.date))}</span>
            <span class="dot-sep"></span>
            <span class="num">${c.duration} ${t('minutes').toLowerCase()}</span>
            <span class="dot-sep"></span>
            <span class="num">${c.calories} ${t('cal')}</span>
          </div>
        </div>
        <div class="data-actions">
          <button class="icon-btn" data-edit-cardio="${c.id}">${icon('edit', 15)}</button>
          <button class="icon-btn danger" data-delete-cardio="${c.id}">${icon('trash', 15)}</button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    ${vaultBar({ action: icon('plus', 20), actionLabel: t('add') })}

    <div class="page-header">
      <div class="page-eyebrow">${t('this_week')} · ${weekItems.length}</div>
      <h1 class="page-title">${t('cardio')}</h1>
      <p class="page-subtitle">${t('cardio_subtitle')}</p>
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
      <button class="btn btn-primary" id="add-cardio-btn">${icon('plus', 16)} ${t('log')}</button>
    </div>

    ${list.length === 0
      ? emptyState({ iconName: 'run', title: t('no_cardio'), text: t('no_cardio_text') })
      : `<div class="data-list">${items}</div>`
    }
  `;

  bindVaultAction(() => openCardioModal());
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
}

function openCardioModal(cardioId = null) {
  const existing = cardioId ? DB.cardio.list().find((c) => c.id === cardioId) : null;
  let selectedType = existing ? existing.type : 'treadmill';

  function buildTypeOptionsHtml() {
    const all = DB.cardioTypes.allTypes();
    const opts = all.map((tt) => {
      const label = tt.isCustom ? tt.label : t(tt.id);
      const ic = tt.iconName || 'heart';
      return `
        <button type="button" class="type-option ${tt.id === selectedType ? 'active' : ''}" data-type="${tt.id}">
          ${icon(ic, 22)}
          <div class="type-option-label">${escapeHtml(label)}</div>
        </button>
      `;
    }).join('');
    return opts + `
      <button type="button" class="type-option type-option-add" id="cardio-add-type">
        ${icon('plus', 22)}
        <div class="type-option-label">${t('new_cardio_type')}</div>
      </button>
    `;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_cardio') : t('log_cardio')}</div>
        <div class="modal-subtitle">${t('cardio_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('type')}</label>
      <div class="type-selector" id="cardio-type-selector">${buildTypeOptionsHtml()}</div>
    </div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="cardio-date" value="${existing ? existing.date : todayISO()}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('duration_min')}</label>
        <input type="number" inputmode="numeric" id="cardio-duration" step="1" min="0" value="${existing ? existing.duration : ''}" placeholder="30">
      </div>
      <div class="form-group">
        <label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="numeric" id="cardio-calories" step="1" min="0" value="${existing ? existing.calories : ''}" placeholder="250">
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
          <div class="modal-subtitle">${t('new_cardio_type_sub')}</div>
        </div>
        <button class="icon-btn icon-btn-tile" data-cardio-type-cancel>${icon('close', 18)}</button>
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
// FOOD
// ==========================================================================

// Built-in catalog of common foods with pre-computed macros (per serving).
// Bilingual name + serving; calories/protein/carbs match the DB.foods shape.
const FOOD_PRESETS = [
  // Protein
  { cat: 'protein', en: 'Chicken Breast', ar: 'صدر دجاج', s: '100g', sa: '١٠٠غ', cal: 165, pro: 31, carb: 0 },
  { cat: 'protein', en: 'Chicken Thigh', ar: 'فخذ دجاج', s: '100g', sa: '١٠٠غ', cal: 209, pro: 26, carb: 0 },
  { cat: 'protein', en: 'Tuna (canned)', ar: 'تونة معلبة', s: '100g', sa: '١٠٠غ', cal: 116, pro: 26, carb: 0 },
  { cat: 'protein', en: 'Egg', ar: 'بيضة', s: '1 egg', sa: 'بيضة', cal: 78, pro: 6, carb: 1 },
  { cat: 'protein', en: 'Beef (lean)', ar: 'لحم بقري', s: '100g', sa: '١٠٠غ', cal: 250, pro: 26, carb: 0 },
  { cat: 'protein', en: 'Salmon', ar: 'سلمون', s: '100g', sa: '١٠٠غ', cal: 208, pro: 20, carb: 0 },
  { cat: 'protein', en: 'Shrimp', ar: 'روبيان', s: '100g', sa: '١٠٠غ', cal: 99, pro: 24, carb: 0 },
  { cat: 'protein', en: 'Turkey Breast', ar: 'صدر ديك رومي', s: '100g', sa: '١٠٠غ', cal: 135, pro: 30, carb: 0 },
  // Grains & Carbs
  { cat: 'carbs', en: 'White Rice', ar: 'رز أبيض', s: '100g', sa: '١٠٠غ', cal: 130, pro: 3, carb: 28 },
  { cat: 'carbs', en: 'Brown Rice', ar: 'رز بني', s: '100g', sa: '١٠٠غ', cal: 111, pro: 3, carb: 23 },
  { cat: 'carbs', en: 'White Bread', ar: 'خبز أبيض', s: '1 slice', sa: 'شريحة', cal: 80, pro: 3, carb: 15 },
  { cat: 'carbs', en: 'Arabic Bread', ar: 'خبز عربي', s: '1 loaf', sa: 'رغيف', cal: 165, pro: 5, carb: 33 },
  { cat: 'carbs', en: 'Pasta', ar: 'مكرونة', s: '100g', sa: '١٠٠غ', cal: 131, pro: 5, carb: 25 },
  { cat: 'carbs', en: 'Oats', ar: 'شوفان', s: '40g', sa: '٤٠غ', cal: 150, pro: 5, carb: 27 },
  { cat: 'carbs', en: 'Potato', ar: 'بطاطا', s: '100g', sa: '١٠٠غ', cal: 87, pro: 2, carb: 20 },
  { cat: 'carbs', en: 'Sweet Potato', ar: 'بطاطا حلوة', s: '100g', sa: '١٠٠غ', cal: 86, pro: 2, carb: 20 },
  // Legumes
  { cat: 'legumes', en: 'Foul (Fava Beans)', ar: 'فول', s: '100g', sa: '١٠٠غ', cal: 110, pro: 8, carb: 15 },
  { cat: 'legumes', en: 'Hummus', ar: 'حمص بالطحينة', s: '100g', sa: '١٠٠غ', cal: 166, pro: 8, carb: 14 },
  { cat: 'legumes', en: 'Lentils', ar: 'عدس', s: '100g', sa: '١٠٠غ', cal: 116, pro: 9, carb: 20 },
  { cat: 'legumes', en: 'Chickpeas', ar: 'حمص حب', s: '100g', sa: '١٠٠غ', cal: 164, pro: 9, carb: 27 },
  // Dairy
  { cat: 'dairy', en: 'Milk', ar: 'حليب', s: '250ml', sa: '٢٥٠مل', cal: 122, pro: 8, carb: 12 },
  { cat: 'dairy', en: 'Greek Yogurt', ar: 'زبادي يوناني', s: '170g', sa: '١٧٠غ', cal: 100, pro: 17, carb: 6 },
  { cat: 'dairy', en: 'Yogurt', ar: 'لبن زبادي', s: '170g', sa: '١٧٠غ', cal: 95, pro: 9, carb: 12 },
  { cat: 'dairy', en: 'Cheddar Cheese', ar: 'جبن شيدر', s: '30g', sa: '٣٠غ', cal: 120, pro: 7, carb: 1 },
  { cat: 'dairy', en: 'Labneh', ar: 'لبنة', s: '30g', sa: '٣٠غ', cal: 60, pro: 3, carb: 2 },
  // Fruits
  { cat: 'fruit', en: 'Banana', ar: 'موز', s: '1 medium', sa: 'حبة', cal: 105, pro: 1, carb: 27 },
  { cat: 'fruit', en: 'Apple', ar: 'تفاح', s: '1 medium', sa: 'حبة', cal: 95, pro: 0, carb: 25 },
  { cat: 'fruit', en: 'Orange', ar: 'برتقال', s: '1 medium', sa: 'حبة', cal: 62, pro: 1, carb: 15 },
  { cat: 'fruit', en: 'Dates', ar: 'تمر', s: '3 pieces', sa: '٣ حبات', cal: 60, pro: 0, carb: 16 },
  { cat: 'fruit', en: 'Grapes', ar: 'عنب', s: '100g', sa: '١٠٠غ', cal: 69, pro: 1, carb: 18 },
  { cat: 'fruit', en: 'Strawberry', ar: 'فراولة', s: '100g', sa: '١٠٠غ', cal: 32, pro: 1, carb: 8 },
  // Vegetables
  { cat: 'veg', en: 'Cucumber', ar: 'خيار', s: '100g', sa: '١٠٠غ', cal: 15, pro: 1, carb: 4 },
  { cat: 'veg', en: 'Tomato', ar: 'طماطم', s: '100g', sa: '١٠٠غ', cal: 18, pro: 1, carb: 4 },
  { cat: 'veg', en: 'Mixed Salad', ar: 'سلطة خضراء', s: '100g', sa: '١٠٠غ', cal: 20, pro: 1, carb: 4 },
  { cat: 'veg', en: 'Broccoli', ar: 'بروكلي', s: '100g', sa: '١٠٠غ', cal: 34, pro: 3, carb: 7 },
  // Nuts & Fats
  { cat: 'fats', en: 'Almonds', ar: 'لوز', s: '30g', sa: '٣٠غ', cal: 173, pro: 6, carb: 6 },
  { cat: 'fats', en: 'Peanut Butter', ar: 'زبدة فول سوداني', s: '1 tbsp', sa: 'ملعقة', cal: 94, pro: 4, carb: 3 },
  { cat: 'fats', en: 'Olive Oil', ar: 'زيت زيتون', s: '1 tbsp', sa: 'ملعقة', cal: 119, pro: 0, carb: 0 },
  { cat: 'fats', en: 'Avocado', ar: 'أفوكادو', s: '100g', sa: '١٠٠غ', cal: 160, pro: 2, carb: 9 },
  // Meals
  { cat: 'meals', en: 'Shawarma Wrap', ar: 'شاورما', s: '1 wrap', sa: 'سندويش', cal: 350, pro: 20, carb: 30 },
  { cat: 'meals', en: 'Burger', ar: 'برجر', s: '1 burger', sa: 'حبة', cal: 295, pro: 17, carb: 24 },
  { cat: 'meals', en: 'Pizza Slice', ar: 'بيتزا', s: '1 slice', sa: 'شريحة', cal: 285, pro: 12, carb: 36 },
  { cat: 'meals', en: 'French Fries', ar: 'بطاطا مقلية', s: '100g', sa: '١٠٠غ', cal: 312, pro: 3, carb: 41 },
  // Drinks
  { cat: 'drinks', en: 'Orange Juice', ar: 'عصير برتقال', s: '250ml', sa: '٢٥٠مل', cal: 112, pro: 2, carb: 26 },
  { cat: 'drinks', en: 'Cola', ar: 'كولا', s: '330ml', sa: '٣٣٠مل', cal: 139, pro: 0, carb: 35 },
];
const FOOD_CAT_ORDER = ['protein', 'carbs', 'legumes', 'dairy', 'fruit', 'veg', 'fats', 'meals', 'drinks'];
function foodPresetName(p) { return (DB.prefs.get().lang || 'en') === 'ar' ? p.ar : p.en; }
function foodPresetServing(p) { return (DB.prefs.get().lang || 'en') === 'ar' ? p.sa : p.s; }

// Admin-curated global foods (server `food_catalog`, pulled at boot — see
// bootCatalog()). Reshaped into the same { cat, en, ar, s, sa, cal, pro, carb }
// preset shape as FOOD_PRESETS so the quick-add picker can render/search/tap
// them identically. There's no separate admin ar/en pair, so both fields hold
// the single stored name (same pattern as any other untranslated user content
// in the app, e.g. custom exercise/food names). Grouped under its own "More"
// category so it never disturbs the curated built-in categories above.
let SERVER_FOOD_PRESETS = [];
function setServerFoodCatalog(rows) {
  try {
    SERVER_FOOD_PRESETS = (Array.isArray(rows) ? rows : [])
      .filter((f) => f && f.name)
      .map((f) => ({
        cat: 'more',
        en: String(f.name), ar: String(f.name),
        s: f.serving || '', sa: f.serving || '',
        cal: Number(f.calories) || 0, pro: Number(f.protein) || 0, carb: Number(f.carbs) || 0,
      }));
  } catch (_) { SERVER_FOOD_PRESETS = []; }
}
function allFoodPresets() { return SERVER_FOOD_PRESETS.length ? FOOD_PRESETS.concat(SERVER_FOOD_PRESETS) : FOOD_PRESETS; }
function allFoodCatOrder() { return SERVER_FOOD_PRESETS.length ? FOOD_CAT_ORDER.concat(['more']) : FOOD_CAT_ORDER; }

// The AI-chat CTA floats above the bottom nav. It is mounted on `.app`
// (a sibling of the nav) rather than inside the Food view, because the view
// carries a `fadeUp` transform — and a transformed ancestor turns any
// position:fixed descendant into position:absolute, which would misplace it.
function unmountFoodAiBar() {
  document.querySelector('.app > #food-ai-cta')?.remove();
}
function mountFoodAiBar() {
  const app = document.querySelector('.app');
  if (!app) return;
  unmountFoodAiBar();
  const bar = document.createElement('button');
  bar.className = 'cta-card cta-floating';
  bar.id = 'food-ai-cta';
  bar.innerHTML = `
    <div class="cta-card-icon">${icon('zap', 20)}</div>
    <div style="flex:1;min-width:0">
      <div class="cta-card-title">${t('ai_chat_title')}</div>
      <div class="cta-card-sub">${t('ai_chat_sub')}</div>
    </div>
    <div class="cta-card-chev">${icon('chevronRight', 18)}</div>
  `;
  bar.addEventListener('click', () => {
    if (window.FoodAI) window.FoodAI.open(typeof todayISO === 'function' ? todayISO() : null);
  });
  app.appendChild(bar);
}

// The Food tab is now a DAILY NUTRITION DASHBOARD: today's targets, what's been
// eaten, and — the thing the user asked to see front and centre — what's still
// LEFT for the day. One "+" button (bottom-right) opens an animated sheet with
// every way to log food (voice, chat, photo, saved, manual). The old food
// "reference library" lives on as the "saved food" add-method.
function renderFood(el) {
  const date = todayISO();

  el.innerHTML = `
    ${vaultBar({ action: icon('plus', 20), actionLabel: t('add') })}
    <div class="page-header">
      <h1 class="page-title">${t('food')}</h1>
      <p class="page-subtitle">${escapeHtml(formatDate(date))}</p>
    </div>
    <div id="nutri-host">${nutritionDashboardHtml(date)}</div>
    <button class="food-fab" id="food-fab" aria-label="${escapeHtml(t('add'))}">${icon('plus', 22)}</button>
  `;

  const rerender = () => { const h = $('#nutri-host', el); if (h) h.innerHTML = nutritionDashboardHtml(date); };

  // Top-bar "+" and the floating FAB both open the add sheet.
  bindVaultAction(() => openAddSheet(date, rerender));
  $('#food-fab', el)?.addEventListener('click', () => openAddSheet(date, rerender));

  const host = $('#nutri-host', el);
  host?.addEventListener('click', (e) => {
    const setup = e.target.closest('[data-setup-goal]');
    if (setup) { openCalculatorModal(rerender); return; }
    const edit = e.target.closest('[data-edit-goal]');
    if (edit) { openCalculatorModal(rerender); return; }
    const coach = e.target.closest('[data-coach]');
    if (coach) { openCoach(date); return; }
    const del = e.target.closest('[data-del-food]');
    if (del) { DB.foodLogs.remove(date, del.dataset.delFood); showToast(t('deleted')); rerender(); return; }
  });

  // The calorie goal is MANDATORY: if none is set, open the calculator straight
  // away when the Food page is shown. The short delay lets the view settle and
  // avoids opening if the user immediately navigates elsewhere.
  if (!DB.nutrition.hasTargets()) {
    setTimeout(() => {
      if (currentView === 'food' && !DB.nutrition.hasTargets() && !$('#modal-root').innerHTML.trim()) {
        openCalculatorModal(rerender);
      }
    }, 250);
  }
}

// The rings + remaining + today's list. Re-rendered on its own after any change.
function nutritionDashboardHtml(date) {
  const nut = DB.nutrition;
  const consumed = DB.foodLogs.totalsForDate(date);
  const entries = DB.foodLogs.listForDate(date);

  // Not set up yet → invite the user to build a target.
  if (!nut.hasTargets()) {
    return `
      <button class="nutri-setup" data-setup-goal>
        <div class="nutri-setup-icon">${icon('zap', 26)}</div>
        <div class="nutri-setup-main">
          <div class="nutri-setup-title">${t('nutri_setup_title')}</div>
          <div class="nutri-setup-text">${t('nutri_setup_text')}</div>
        </div>
      </button>
      ${todayLogHtml(entries)}
    `;
  }

  const tgt = nut.get().targets;
  const calLeft = Math.round(tgt.calories - consumed.calories);
  const calPct = tgt.calories > 0 ? Math.min(100, (consumed.calories / tgt.calories) * 100) : 0;
  const over = calLeft < 0;

  // Calorie ring (SVG). r=54 → circumference ≈ 339.29.
  const C = 339.29;
  const dash = C * (calPct / 100);

  const macroBar = (key, label, cls) => {
    const c = Math.round(consumed[key] * 10) / 10;
    const g = tgt[key] || 0;
    const left = Math.round((g - c) * 10) / 10;
    const pct = g > 0 ? Math.min(100, (c / g) * 100) : 0;
    return `
      <div class="macro-track">
        <div class="macro-track-head">
          <span class="macro-track-name ${cls}">${label}</span>
          <span class="macro-track-nums"><span class="num">${fmtNum(c)}</span> / <span class="num">${fmtNum(g)}</span>g</span>
        </div>
        <div class="macro-track-bar"><span class="macro-track-fill ${cls}" style="width:${pct}%"></span></div>
        <div class="macro-track-left">${left >= 0 ? `${t('nutri_left')} <span class="num">${fmtNum(left)}</span>g` : `<span class="over">${t('nutri_over')} <span class="num">${fmtNum(-left)}</span>g</span>`}</div>
      </div>`;
  };

  return `
    <div class="nutri-hero">
      <button class="nutri-edit" data-edit-goal aria-label="${escapeHtml(t('edit'))}">${icon('edit', 16)}</button>
      <div class="cal-ring-wrap">
        <svg class="cal-ring" viewBox="0 0 120 120">
          <circle class="cal-ring-bg" cx="60" cy="60" r="54"/>
          <circle class="cal-ring-fg ${over ? 'over' : ''}" cx="60" cy="60" r="54"
            stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="cal-ring-center">
          <div class="cal-ring-num num ${over ? 'over' : ''}">${fmtNum(Math.abs(calLeft))}</div>
          <div class="cal-ring-label">${over ? t('nutri_over') : t('nutri_left')}</div>
          <div class="cal-ring-sub"><span class="num">${fmtNum(Math.round(consumed.calories))}</span> / <span class="num">${fmtNum(tgt.calories)}</span> ${t('cal')}</div>
        </div>
      </div>
      <div class="macro-tracks">
        ${macroBar('protein', t('protein_label'), 'pro')}
        ${macroBar('carbs', t('carbs_label'), 'carb')}
        ${macroBar('fat', t('fat_label'), 'fat')}
      </div>
    </div>

    <button class="nutri-coach" data-coach>
      <div class="cta-card-icon">${icon('zap', 18)}</div>
      <div style="flex:1;min-width:0;text-align:start">
        <div class="cta-card-title">${t('coach_title')}</div>
        <div class="cta-card-sub">${t('coach_sub')}</div>
      </div>
    </button>

    ${todayLogHtml(entries)}
  `;
}

function todayLogHtml(entries) {
  if (!entries.length) {
    // Compact, icon-less empty state (the big empty-state graphic was removed).
    return `<div class="section-title" style="margin:22px 0 10px">${t('nutri_today')}</div>` +
      `<div class="nutri-empty">
         <div class="nutri-empty-title">${t('nutri_empty_title')}</div>
         <div class="nutri-empty-text">${t('nutri_empty_text')}</div>
       </div>`;
  }
  const rows = entries.map((e) => {
    const m = e.servings || 1;
    return `
      <div class="food-log-row" data-food-row="${e.id}">
        <div class="food-log-main">
          <div class="food-log-name">${escapeHtml(e.name)}${m !== 1 ? `<span class="food-log-x num"> × ${fmtNum(m)}</span>` : ''}</div>
          <div class="food-log-meta">
            <span><span class="num">${fmtNum(Math.round(e.calories * m))}</span> ${t('cal')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.protein * m * 10) / 10)}</span>g ${t('protein_label')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.carbs * m * 10) / 10)}</span>g ${t('carbs_label')}</span>
            ${e.fat ? `<span class="dot-sep"></span><span><span class="num">${fmtNum(Math.round(e.fat * m * 10) / 10)}</span>g ${t('fat_label')}</span>` : ''}
          </div>
        </div>
        <button class="icon-btn danger" data-del-food="${e.id}" aria-label="${escapeHtml(t('delete'))}">${icon('trash', 15)}</button>
      </div>`;
  }).join('');
  return `<div class="section-title" style="margin:22px 0 10px">${t('nutri_today')}</div><div class="food-log-list">${rows}</div>`;
}

// Shared: log AI/voice/photo items to today and refresh the dashboard.
function logNutritionItems(date, items, onDone) {
  (items || []).forEach((it) => DB.foodLogs.add(date, {
    name: it.name, servings: 1,
    calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
    source: it.source || 'ai',
  }));
  if (typeof onDone === 'function') onDone();
}

// ===========================================================================
// Add sheet — one "+" opens an animated bottom sheet with every add method.
// ===========================================================================
function openAddSheet(date, onChange) {
  const app = document.querySelector('.app');
  if (!app) return;
  document.getElementById('add-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'add-sheet-overlay';
  overlay.className = 'sheet-overlay';
  // A grid of consistent square tiles — one icon + label per tile.
  const tile = (m) => `
    <button class="add-tile" data-method="${m.k}">
      <span class="add-tile-icon ${m.k}">${icon(m.icon, 24)}</span>
      <span class="add-tile-title">${m.title}</span>
    </button>`;
  overlay.innerHTML = `
    <div class="add-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="add-sheet-title">${t('add_sheet_title')}</div>
      <div class="add-grid">
        ${tile({ k: 'voice', icon: 'mic', title: t('add_voice') })}
        ${tile({ k: 'chat', icon: 'zap', title: t('add_chat') })}
        ${tile({ k: 'photo', icon: 'camera', title: t('add_photo') })}
        ${tile({ k: 'saved', icon: 'utensils', title: t('add_saved') })}
        ${tile({ k: 'manual', icon: 'edit', title: t('add_manual') })}
      </div>
    </div>`;
  app.appendChild(overlay);
  // Next frame → add .open so the sheet transitions up smoothly.
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = (cb) => {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); if (typeof cb === 'function') cb(); }, 260);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { close(); return; }
    const btn = e.target.closest('[data-method]');
    if (!btn) return;
    const method = btn.dataset.method;
    close(() => {
      if (method === 'voice') openVoiceCapture(date, onChange);
      else if (method === 'chat') FoodAI.open(date);
      else if (method === 'photo') FoodAI.openPhoto ? FoodAI.openPhoto(date) : FoodAI.open(date);
      else if (method === 'saved') openSavedFoodPicker(date, onChange);
      else if (method === 'manual') openManualFoodEntry(date, onChange);
    });
  });
}

// ===========================================================================
// Calorie / macro calculator (Mifflin-St Jeor). Live preview as the user edits.
// ===========================================================================
function openCalculatorModal(onSave) {
  const nut = DB.nutrition;
  const p = Object.assign({}, nut.get().profile);
  let manual = nut.get().mode === 'manual';
  const curTargets = nut.get().targets;

  const activities = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
  const goals = ['cut', 'maintain', 'bulk'];

  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('calc_title')}</div>
        <div class="modal-subtitle">${t('calc_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="calc-modewrap">
      <button class="calc-modebtn ${!manual ? 'active' : ''}" data-mode="calc">${t('calc_mode_calc')}</button>
      <button class="calc-modebtn ${manual ? 'active' : ''}" data-mode="manual">${t('calc_mode_manual')}</button>
    </div>

    <div id="calc-body"></div>
  `);

  const body = overlay.querySelector('#calc-body');

  function calcFormHtml() {
    const seg = (name, opts, cur) => `
      <div class="seg" data-seg="${name}">
        ${opts.map((o) => `<button type="button" class="seg-btn ${cur === o.v ? 'active' : ''}" data-val="${o.v}">${o.label}</button>`).join('')}
      </div>`;
    return `
      <div class="form-group"><label class="form-label">${t('calc_sex')}</label>
        ${seg('sex', [{ v: 'male', label: t('calc_male') }, { v: 'female', label: t('calc_female') }], p.sex)}</div>
      <div class="calc-grid">
        <div class="form-group"><label class="form-label">${t('calc_age')}</label>
          <input type="number" inputmode="numeric" id="c-age" min="10" max="100" value="${p.age || ''}" placeholder="25"></div>
        <div class="form-group"><label class="form-label">${t('calc_height')}</label>
          <input type="number" inputmode="numeric" id="c-height" min="100" max="230" value="${p.heightCm || ''}" placeholder="175"></div>
        <div class="form-group"><label class="form-label">${t('calc_weight')}</label>
          <input type="number" inputmode="decimal" id="c-weight" min="30" max="300" value="${p.weightKg || ''}" placeholder="75"></div>
      </div>
      <div class="form-group"><label class="form-label">${t('calc_activity')}</label>
        ${seg('activity', activities.map((a) => ({ v: a, label: t('activity_' + a) })), p.activity)}</div>
      <div class="form-group"><label class="form-label">${t('calc_goal')}</label>
        ${seg('goal', goals.map((g) => ({ v: g, label: t('goal_' + g) })), p.goal)}</div>
      <div class="calc-preview" id="calc-preview"></div>
      <button class="btn btn-primary btn-block" id="calc-save">${t('save')}</button>
    `;
  }

  function manualFormHtml() {
    return `
      <div class="calc-grid calc-grid-2">
        <div class="form-group"><label class="form-label">${t('calories')}</label>
          <input type="number" inputmode="numeric" id="m-cal" min="0" value="${curTargets.calories || ''}" placeholder="2200"></div>
        <div class="form-group"><label class="form-label">${t('protein_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-pro" min="0" value="${curTargets.protein || ''}" placeholder="160"></div>
        <div class="form-group"><label class="form-label">${t('carbs_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-carb" min="0" value="${curTargets.carbs || ''}" placeholder="220"></div>
        <div class="form-group"><label class="form-label">${t('fat_label')} (g)</label>
          <input type="number" inputmode="numeric" id="m-fat" min="0" value="${curTargets.fat || ''}" placeholder="60"></div>
      </div>
      <button class="btn btn-primary btn-block" id="calc-save-manual">${t('save')}</button>
    `;
  }

  function previewHtml() {
    const c = DB.nutrition.compute(p);
    if (!c) return `<div class="calc-preview-hint">${t('calc_fill_hint')}</div>`;
    const cell = (v, unit, label) => `<div class="calc-cell"><div class="calc-cell-v num">${fmtNum(v)}<span>${unit}</span></div><div class="calc-cell-l">${label}</div></div>`;
    return `
      <div class="calc-preview-grid">
        ${cell(c.calories, t('cal'), t('nutri_calories'))}
        ${cell(c.protein, 'g', t('protein_label'))}
        ${cell(c.carbs, 'g', t('carbs_label'))}
        ${cell(c.fat, 'g', t('fat_label'))}
      </div>
      <div class="calc-preview-hint">${t('calc_tdee')}: <span class="num">${fmtNum(c.tdee)}</span> ${t('cal')} · ${t('calc_bmr')}: <span class="num">${fmtNum(c.bmr)}</span></div>
    `;
  }

  function renderCalcForm() {
    body.innerHTML = calcFormHtml();
    const prev = body.querySelector('#calc-preview');
    const refresh = () => { if (prev) prev.innerHTML = previewHtml(); };
    refresh();
    body.querySelectorAll('[data-seg]').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('.seg-btn'); if (!b) return;
        seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        p[seg.dataset.seg] = b.dataset.val;
        refresh();
      });
    });
    ['c-age', 'c-height', 'c-weight'].forEach((id) => {
      const inp = body.querySelector('#' + id);
      inp?.addEventListener('input', () => {
        if (id === 'c-age') p.age = Number(inp.value) || null;
        if (id === 'c-height') p.heightCm = Number(inp.value) || null;
        if (id === 'c-weight') p.weightKg = Number(inp.value) || null;
        refresh();
      });
    });
    body.querySelector('#calc-save')?.addEventListener('click', () => {
      if (!DB.nutrition.compute(p)) { showToast(t('calc_fill_hint')); return; }
      DB.nutrition.setProfile(p);
      closeModal(); showToast(t('saved'));
      if (typeof onSave === 'function') onSave();
    });
  }

  function renderManualForm() {
    body.innerHTML = manualFormHtml();
    body.querySelector('#calc-save-manual')?.addEventListener('click', () => {
      const cal = Number(body.querySelector('#m-cal').value) || 0;
      if (cal <= 0) { showToast(t('calc_fill_hint')); return; }
      DB.nutrition.setTargets({
        calories: cal,
        protein: Number(body.querySelector('#m-pro').value) || 0,
        carbs: Number(body.querySelector('#m-carb').value) || 0,
        fat: Number(body.querySelector('#m-fat').value) || 0,
      });
      closeModal(); showToast(t('saved'));
      if (typeof onSave === 'function') onSave();
    });
  }

  const draw = () => { manual ? renderManualForm() : renderCalcForm(); };
  overlay.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    manual = b.dataset.mode === 'manual';
    overlay.querySelectorAll('.calc-modebtn').forEach((x) => x.classList.toggle('active', x === b));
    draw();
  }));
  draw();
}

// ===========================================================================
// Manual quick-add: name + macros straight into today's log.
// ===========================================================================
function openManualFoodEntry(date, onSave) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('manual_food_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div class="form-group"><label class="form-label">${t('name')}</label>
      <input type="text" id="mf-name" placeholder="${t('manual_food_ph')}" autofocus></div>
    <div class="calc-grid calc-grid-2">
      <div class="form-group"><label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="numeric" id="mf-cal" min="0" placeholder="250"></div>
      <div class="form-group"><label class="form-label">${t('protein_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-pro" min="0" placeholder="20"></div>
      <div class="form-group"><label class="form-label">${t('carbs_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-carb" min="0" placeholder="30"></div>
      <div class="form-group"><label class="form-label">${t('fat_label')} (g)</label>
        <input type="number" inputmode="decimal" id="mf-fat" min="0" placeholder="8"></div>
    </div>
    <button class="btn btn-primary btn-block" id="mf-save">${icon('plus', 15)} ${t('ai_add_to_log')}</button>
  `);
  overlay.querySelector('#mf-save').addEventListener('click', () => {
    const name = (overlay.querySelector('#mf-name').value || '').trim();
    if (!name) { showToast(t('enter_name')); return; }
    DB.foodLogs.add(date, {
      name, servings: 1,
      calories: Number(overlay.querySelector('#mf-cal').value) || 0,
      protein: Number(overlay.querySelector('#mf-pro').value) || 0,
      carbs: Number(overlay.querySelector('#mf-carb').value) || 0,
      fat: Number(overlay.querySelector('#mf-fat').value) || 0,
      source: 'manual',
    });
    closeModal(); showToast(t('ai_added'));
    if (typeof onSave === 'function') onSave();
  });
}

// ===========================================================================
// Saved-food picker — the old "reference library" as an add-method. Search
// your saved foods + presets, tap to log to today. Long-press-free: tap = add.
// ===========================================================================
function openSavedFoodPicker(date, onSave) {
  let query = '';
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_saved')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div class="search-wrap" style="margin-bottom:10px">
      ${icon('search', 18)}
      <input type="search" id="sf-search" placeholder="${t('search_foods')}">
    </div>
    <div class="picker-list" id="sf-list"></div>
    <button class="btn btn-ghost btn-block" id="sf-new" style="margin-top:10px">${icon('plus', 15)} ${t('saved_new')}</button>
  `);
  const listEl = overlay.querySelector('#sf-list');

  function draw() {
    const q = query.toLowerCase();
    const saved = DB.foods.list().map((f) => ({ name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat || 0, saved: true }));
    const list = q ? saved.filter((f) => f.name.toLowerCase().includes(q)) : saved;
    if (!list.length) {
      listEl.innerHTML = `<div class="calc-preview-hint" style="text-align:center;padding:18px">${DB.foods.list().length ? t('no_matches_simple') : t('saved_empty')}</div>`;
      return;
    }
    listEl.innerHTML = list.map((f, i) => `
      <button type="button" class="picker-row" data-add-saved="${i}">
        <span class="picker-row-cat" style="background:var(--cat-arms)"></span>
        <span class="picker-row-name">${escapeHtml(f.name)}
          <span style="color:var(--text-mute);font-weight:600;font-size:11px"> · <span class="num">${fmtNum(f.calories)}</span> ${t('cal')}</span>
        </span>
        <span class="picker-row-check">${icon('plus', 14)}</span>
      </button>`).join('');
    listEl.querySelectorAll('[data-add-saved]').forEach((b) => b.addEventListener('click', () => {
      const f = list[Number(b.dataset.addSaved)];
      DB.foodLogs.add(date, { name: f.name, servings: 1, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, source: 'saved' });
      showToast(t('ai_added'));
      b.querySelector('.picker-row-check').innerHTML = icon('check', 14);
      b.classList.add('picked');
      if (typeof onSave === 'function') onSave();
    }));
  }
  overlay.querySelector('#sf-search').addEventListener('input', (e) => { query = e.target.value; draw(); });
  overlay.querySelector('#sf-new').addEventListener('click', () => { closeModal(); openFoodLibraryModal(); });
  draw();
}

// ===========================================================================
// AI coach — reads what's LEFT for the day and suggests what to eat to hit it.
// Reuses the FoodAI text model; no new backend.
// ===========================================================================
function openCoach(date) {
  const tgt = DB.nutrition.get().targets;
  const c = DB.foodLogs.totalsForDate(date);
  const left = {
    calories: Math.max(0, Math.round(tgt.calories - c.calories)),
    protein: Math.max(0, Math.round(tgt.protein - c.protein)),
    carbs: Math.max(0, Math.round(tgt.carbs - c.carbs)),
    fat: Math.max(0, Math.round(tgt.fat - c.fat)),
  };
  const lang = DB.prefs.get().lang || 'en';
  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('coach_title')}</div>
        <div class="modal-subtitle">${t('coach_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div class="coach-remaining">
      <span>${t('nutri_left')}: <b class="num">${fmtNum(left.calories)}</b> ${t('cal')}</span>
      <span><b class="num">${fmtNum(left.protein)}</b>g ${t('protein_label')}</span>
    </div>
    <div id="coach-body" class="coach-body"><div class="ai-dots">${t('coach_thinking')}</div></div>
  `);
  const body = overlay.querySelector('#coach-body');
  const prompt = (lang === 'ar'
    ? `أنا أتتبع سعراتي. باقي لي اليوم: ${left.calories} سعرة، ${left.protein}غ بروتين، ${left.carbs}غ كارب، ${left.fat}غ دهون. اقترح ٣ وجبات أو سناكات واقعية تناسب المتبقي تقريباً، كل واحدة بسطر واحد مع سعراتها التقريبية. بالعربي، بدون مقدمة.`
    : `I track my macros. Remaining today: ${left.calories} kcal, ${left.protein}g protein, ${left.carbs}g carbs, ${left.fat}g fat. Suggest 3 realistic meals or snacks that fit the remainder, each on one line with approx calories. No preamble.`);
  if (!window.FoodAI || !FoodAI.ask) { body.innerHTML = `<div class="ai-err">${t('coach_unavailable')}</div>`; return; }
  FoodAI.ask(prompt)
    .then((txt) => { body.innerHTML = `<div class="coach-text">${escapeHtml(txt).replace(/\n/g, '<br>')}</div>`; })
    .catch((e) => { body.innerHTML = `<div class="ai-err">${escapeHtml((e && e.message) || t('ai_error'))}</div>`; });
}

// ===========================================================================
// Voice capture — record, transcribe + analyse via FoodAI, add to today's log.
// getUserMedia works in a browser and in an Android WebView that has been
// granted RECORD_AUDIO (needs the newer APK). Every failure is caught and shown.
// ===========================================================================
function openVoiceCapture(date, onSave) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('add_voice')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div class="voice-stage" id="voice-stage">
      <button class="voice-mic" id="voice-mic" aria-label="${escapeHtml(t('voice_tap'))}">${icon('mic', 34)}</button>
      <div class="voice-status" id="voice-status">${t('voice_tap')}</div>
    </div>
    <div class="ai-results" id="voice-results"></div>
  `);
  const micBtn = overlay.querySelector('#voice-mic');
  const status = overlay.querySelector('#voice-status');
  const results = overlay.querySelector('#voice-results');
  let recorder = null, chunks = [], stream = null, recording = false;

  const setStatus = (s) => { if (status) status.textContent = s; };

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(t('voice_unsupported')); return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (_) { setStatus(t('voice_denied')); return; }
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onStop;
    recorder.start();
    recording = true;
    micBtn.classList.add('recording');
    setStatus(t('voice_listening'));
  }

  function stop() {
    if (recorder && recording) { recording = false; recorder.stop(); }
    if (stream) stream.getTracks().forEach((tk) => tk.stop());
    micBtn.classList.remove('recording');
  }

  async function onStop() {
    setStatus(t('voice_processing'));
    const blob = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
    if (!blob.size) { setStatus(t('voice_tap')); return; }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
      });
      const b64 = String(dataUrl).split(',')[1];
      const mimeType = String(dataUrl).slice(5, String(dataUrl).indexOf(';'));
      if (!window.FoodAI || !FoodAI.analyzeAudio) throw new Error(t('voice_unsupported'));
      const { items, transcript } = await FoodAI.analyzeAudio({ mimeType, data: b64 });
      if (!document.body.contains(overlay)) return; // modal was closed mid-request
      if (transcript) setStatus('“' + transcript + '”'); else setStatus(t('voice_tap'));
      if (!items || !items.length) { results.innerHTML = `<div class="ai-decline">${t('ai_not_food')}</div>`; return; }
      renderVoiceResults(items);
    } catch (e) {
      setStatus((e && e.message) || t('ai_error'));
    }
  }

  function renderVoiceResults(items) {
    results.innerHTML = items.map((it, i) => `
      <div class="ai-card" data-vr="${i}">
        <div class="ai-card-name">${escapeHtml(it.name)}</div>
        <div class="ai-macros">
          <span class="ai-macro cal"><b class="num">${fmtNum(it.calories)}</b>${t('cal')}</span>
          <span class="ai-macro pro"><b class="num">${fmtNum(it.protein)}</b>g ${t('protein_label')}</span>
          <span class="ai-macro carb"><b class="num">${fmtNum(it.carbs)}</b>g ${t('carbs_label')}</span>
          <span class="ai-macro fat"><b class="num">${fmtNum(it.fat)}</b>g ${t('fat_label')}</span>
        </div>
      </div>`).join('') +
      `<button class="btn btn-primary btn-block" id="voice-addall">${icon('plus', 15)} ${t('ai_add_all')} (${fmtNum(items.length)})</button>`;
    results.querySelector('#voice-addall').addEventListener('click', () => {
      logNutritionItems(date, items.map((it) => Object.assign({}, it, { source: 'voice' })), onSave);
      showToast(t('ai_added'));
      closeModal();
    });
  }

  micBtn.addEventListener('click', () => { recording ? stop() : start(); });
  // Stop the mic when the modal is dismissed by ANY path — the X button,
  // a backdrop tap, or the Escape key all clear #modal-root, so watch for the
  // overlay leaving the DOM and release the microphone then. (A click-only
  // listener missed backdrop/Escape, leaving the mic live — a privacy leak.)
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) {
    const mo = new MutationObserver(() => {
      if (!document.body.contains(overlay)) { stop(); mo.disconnect(); }
    });
    mo.observe(modalRoot, { childList: true, subtree: true });
  }
}

// Split a serving string ("١٠٠غ", "3 حبات", "1 slice") into a numeric amount
// and a unit label. Arabic-Indic digits are normalised. No leading number → 1.
function parseServing(serving) {
  const str = String(serving || '').trim();
  const norm = str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const m = norm.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (m) return { amount: parseFloat(m[1]), unit: m[2].trim() };
  return { amount: 1, unit: str };
}

function openFoodModal(foodId = null) {
  const existing = foodId ? DB.foods.list().find((f) => f.id === foodId) : null;
  const parsed = parseServing(existing ? existing.serving : '');
  const baseAmount = existing ? (parsed.amount || '') : '';
  const baseUnit = existing ? parsed.unit : '';
  // Per-unit macros — used to live-recalculate when the amount is edited.
  const per = { cal: 0, pro: 0, carb: 0 };
  if (existing) {
    const a = parsed.amount || 1;
    per.cal = existing.calories / a;
    per.pro = existing.protein / a;
    per.carb = existing.carbs / a;
  }
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_food') : t('new_food')}</div>
        <div class="modal-subtitle">${t('food_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="food-name" placeholder="${t('ph_food_name')}" value="${existing ? escapeHtml(existing.name) : ''}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('amount_label')}</label>
        <input type="number" inputmode="decimal" id="food-amount" step="1" min="0" value="${baseAmount}" placeholder="100">
      </div>
      <div class="form-group">
        <label class="form-label">${t('serving_unit_label')}</label>
        <input type="text" id="food-unit" value="${escapeHtml(baseUnit)}" placeholder="${t('unit_hint')}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('calories')}</label>
        <input type="number" inputmode="decimal" id="food-cal" step="1" min="0" value="${existing ? existing.calories : ''}" placeholder="165">
      </div>
      <div class="form-group">
        <label class="form-label">${t('protein_g')}</label>
        <input type="number" inputmode="decimal" id="food-pro" step="0.1" min="0" value="${existing ? existing.protein : ''}" placeholder="31">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('carbs_g')}</label>
        <input type="number" inputmode="decimal" id="food-carb" step="0.1" min="0" value="${existing ? existing.carbs : ''}" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">${t('fat_label')} (g)</label>
        <input type="number" inputmode="decimal" id="food-fat" step="0.1" min="0" value="${existing ? (existing.fat || '') : ''}" placeholder="0">
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-food-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  // Edit the amount → live-recalculate calories/protein/carbs from per-unit.
  $('#food-amount')?.addEventListener('input', () => {
    const a = Number($('#food-amount').value);
    if (!a || (!per.cal && !per.pro && !per.carb)) return;
    $('#food-cal').value = Math.round(per.cal * a);
    $('#food-pro').value = Math.round(per.pro * a * 10) / 10;
    $('#food-carb').value = Math.round(per.carb * a * 10) / 10;
  });

  $('#save-food-btn').addEventListener('click', () => {
    const name = $('#food-name').value.trim();
    const amount = $('#food-amount').value.trim();
    const unit = $('#food-unit').value.trim();
    const serving = [amount, unit].filter(Boolean).join(' ');
    const calories = Number($('#food-cal').value);
    const protein = Number($('#food-pro').value);
    const carbs = Number($('#food-carb').value);
    const fat = Number($('#food-fat').value);
    if (!name) { showToast(t('enter_name')); return; }
    if (existing) {
      DB.foods.update(existing.id, { name, serving, calories, protein, carbs, fat });
      showToast(t('updated'));
    } else {
      DB.foods.add({ name, serving, calories, protein, carbs, fat });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });

  setTimeout(() => $('#food-name')?.focus(), 60);
}

// Quick-add picker: the built-in food catalog shown as small rectangular
// chips, grouped by category, searchable. Tapping a chip adds it to the
// reference list. A footer button falls back to the manual entry form.
function openFoodLibraryModal() {
  function buildSections() {
    const existing = new Set(DB.foods.list().map((f) => f.name.trim().toLowerCase()));
    const presets = allFoodPresets();
    return allFoodCatOrder().map((cat) => {
      const chips = presets
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p.cat === cat)
        .map(({ p, idx }) => {
          const name = foodPresetName(p);
          // Detect an already-added preset in EITHER language so switching the
          // UI language can't create a duplicate of the same food.
          const added = existing.has(name.trim().toLowerCase())
            || existing.has(String(p.en).trim().toLowerCase())
            || existing.has(String(p.ar).trim().toLowerCase());
          return `
            <button type="button" class="food-lib-chip${added ? ' added' : ''}" data-preset="${idx}" ${added ? 'disabled' : ''}>
              <span class="flc-name">${escapeHtml(name)}</span>
              <span class="flc-cal"><span class="num">${fmtNum(p.cal)}</span> ${t('cal')}</span>
              <span class="flc-check">${icon('check', 14)}</span>
            </button>`;
        }).join('');
      if (!chips) return '';
      return `
        <div class="food-lib-section">
          <div class="food-lib-cat">${t('fcat_' + cat)}</div>
          <div class="food-lib-grid">${chips}</div>
        </div>`;
    }).join('');
  }

  const overlay = openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('food_library_title')}</div>
        <div class="modal-subtitle">${t('food_library_sub')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="search-wrap food-lib-search">
      ${icon('search', 18)}
      <input type="search" id="food-lib-search" placeholder="${t('search_foods')}">
    </div>

    <div class="food-lib-body" id="food-lib-body">
      ${buildSections()}
      <div id="food-lib-empty" style="display:none">${emptyState({ iconName: 'search', title: t('no_matches_simple'), text: t('no_matches_text') })}</div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost btn-block" id="food-lib-manual">${icon('plus', 16)} ${t('add_manually')}</button>
    </div>
  `);

  const body = overlay.querySelector('#food-lib-body');
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.food-lib-chip');
    if (!btn || btn.classList.contains('added')) return;
    const p = allFoodPresets()[Number(btn.dataset.preset)];
    if (!p) return;
    DB.foods.add({ name: foodPresetName(p), serving: foodPresetServing(p), calories: p.cal, protein: p.pro, carbs: p.carb });
    btn.classList.add('added');
    btn.disabled = true;
    showToast(t('saved'));
    renderView(currentView);
  });

  overlay.querySelector('#food-lib-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let anyVisible = false;
    overlay.querySelectorAll('.food-lib-chip').forEach((c) => {
      const nm = c.querySelector('.flc-name').textContent.toLowerCase();
      const show = !q || nm.includes(q);
      c.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });
    overlay.querySelectorAll('.food-lib-section').forEach((sec) => {
      const any = [...sec.querySelectorAll('.food-lib-chip')].some((c) => c.style.display !== 'none');
      sec.style.display = any ? '' : 'none';
    });
    const empty = overlay.querySelector('#food-lib-empty');
    if (empty) empty.style.display = anyVisible ? 'none' : '';
  });

  overlay.querySelector('#food-lib-manual').addEventListener('click', () => {
    closeModal();
    openFoodModal();
  });
}

// ==========================================================================
// SLEEP
// ==========================================================================
function renderSleep(el) {
  const list = DB.sleep.list();
  const last7 = list.slice(0, 7);
  const avgMin = last7.length > 0
    ? Math.round(last7.reduce((s, x) => s + x.durationMinutes, 0) / last7.length)
    : 0;
  const latest = list[0];

  const items = list.map((s) => `
    <div class="data-row">
      <div class="data-icon sleep">${icon('bed', 20)}</div>
      <div class="data-main">
        <div class="data-title">${formatDate(s.date)}${s.source === 'health' ? `<span class="src-badge">${icon('refresh', 11)}${t('from_watch')}</span>` : ''}</div>
        <div class="data-meta">
          <span class="num">${formatTime12(s.sleepTime)}</span>
          <span>→</span>
          <span class="num">${formatTime12(s.wakeTime)}</span>
        </div>
      </div>
      <div class="data-value num">${formatDuration(s.durationMinutes)}</div>
      <div class="data-actions">
        <button class="icon-btn" data-edit-sleep="${s.id}">${icon('edit', 15)}</button>
        <button class="icon-btn danger" data-delete-sleep="${s.id}">${icon('trash', 15)}</button>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    ${vaultBar({ action: icon('plus', 20), actionLabel: t('add') })}

    <div class="page-header">
      <div class="page-eyebrow">${t('nights_log')} · ${list.length}</div>
      <h1 class="page-title">${t('sleep')}</h1>
      <p class="page-subtitle">${t('sleep_subtitle')}</p>
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

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('history')}</div>
      <button class="btn btn-primary" id="add-sleep-btn">${icon('plus', 16)} ${t('log')}</button>
    </div>

    ${list.length === 0
      ? emptyState({ iconName: 'moon', title: t('no_sleep_logged'), text: t('no_sleep_text') })
      : `<div class="data-list">${items}</div>`
    }
  `;

  bindVaultAction(() => openSleepModal());
  $('#add-sleep-btn', el).addEventListener('click', () => openSleepModal());
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

function openSleepModal(sleepId = null) {
  const existing = sleepId ? DB.sleep.list().find((s) => s.id === sleepId) : null;
  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_sleep') : t('log_sleep')}</div>
        <div class="modal-subtitle">${t('sleep_quick')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="sleep-date" value="${existing ? existing.date : todayISO()}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('sleep_time')}</label>
        <input type="time" id="sleep-start" value="${existing ? existing.sleepTime : '23:00'}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('wake_time')}</label>
        <input type="time" id="sleep-end" value="${existing ? existing.wakeTime : '07:00'}">
      </div>
    </div>

    <div id="sleep-duration-preview" class="prev-session" style="margin-bottom:0">
      <div class="prev-session-head"><span>${t('total_sleep')}</span></div>
      <div class="prev-session-sets num" style="font-size:18px;font-weight:900;letter-spacing:-0.03em"></div>
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

// ==========================================================================
// COMPARE
// ==========================================================================
function renderCompare(el) {
  const tab = viewContext.compareTab || 'workouts';

  const tabsHtml = `
    <div class="compare-tabs">
      <button class="compare-tab ${tab === 'workouts' ? 'active' : ''}" data-compare-tab="workouts">${t('workouts')}</button>
      <button class="compare-tab ${tab === 'cardio' ? 'active' : ''}" data-compare-tab="cardio">${t('cardio')}</button>
      <button class="compare-tab ${tab === 'sleep' ? 'active' : ''}" data-compare-tab="sleep">${t('sleep')}</button>
    </div>
  `;

  let contentHtml = '';
  if (tab === 'workouts') contentHtml = renderCompareWorkouts();
  if (tab === 'cardio') contentHtml = renderCompareCardio();
  if (tab === 'sleep') contentHtml = renderCompareSleep();

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('compare_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('weekly')}</div>
      <h1 class="page-title">${t('compare')}</h1>
      <p class="page-subtitle">${t('compare_subtitle')}</p>
    </div>

    ${tabsHtml}
    ${contentHtml}
  `;

  el.querySelectorAll('[data-compare-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      viewContext.compareTab = b.dataset.compareTab;
      renderCompare(el);
    })
  );

  el.querySelectorAll('[data-goto-exercise]').forEach((b) =>
    b.addEventListener('click', () => navigate('exercise-detail', { exerciseId: b.dataset.gotoExercise }))
  );
}

function renderCompareWorkouts() {
  const exercises = DB.exercises.list();
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();

  const cards = exercises.map((ex) => {
    const sessions = DB.sessions.listByExercise(ex.id);
    if (sessions.length === 0) return null;

    const thisW = sessions.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
    const lastW = sessions.filter((s) => inRangeISO(s.date, lastStart, lastEnd));

    const bestOf = (arr) => {
      let m = 0;
      arr.forEach((s) => s.sets.forEach((x) => { if (x.weight > m) m = x.weight; }));
      return m;
    };

    const thisBest = bestOf(thisW);
    const lastBest = bestOf(lastW);
    if (thisBest === 0 && lastBest === 0) return null;

    return `
      <button class="compare-card" data-goto-exercise="${ex.id}">
        <div class="compare-card-title">${escapeHtml(exDisplayName(ex))}</div>
        <div class="compare-weeks">
          <div class="compare-week">
            <div class="compare-week-label">${t('last_week_label')}</div>
            <div class="compare-week-value num">${lastBest > 0 ? fmtWeight(lastBest) : '—'}<span style="font-size:12px;color:var(--text-mute);font-weight:700;margin-left:3px">${lastBest > 0 ? unitLabel() : ''}</span></div>
            <div class="compare-week-sub">${fmtNum(lastW.reduce((s, x) => s + x.sets.length, 0))} ${t('sessions_n').toLowerCase()}</div>
          </div>
          <div class="compare-week">
            <div class="compare-week-label">${t('this_week_label')}</div>
            <div class="compare-week-value num">${thisBest > 0 ? fmtWeight(thisBest) : '—'}<span style="font-size:12px;color:var(--text-mute);font-weight:700;margin-left:3px">${thisBest > 0 ? unitLabel() : ''}</span></div>
            <div class="compare-week-sub">${fmtNum(thisW.reduce((s, x) => s + x.sets.length, 0))} ${t('sessions_n').toLowerCase()}</div>
          </div>
        </div>
        ${deltaBlock(convertWeightForDisplay(thisBest), convertWeightForDisplay(lastBest), unitLabel())}
      </button>
    `;
  }).filter(Boolean).join('');

  return cards || emptyState({
    iconName: 'dumbbell',
    title: t('not_enough_data'),
    text: t('not_enough_data_text'),
  });
}

function renderCompareCardio() {
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();
  const list = DB.cardio.list();
  const thisW = list.filter((c) => inRangeISO(c.date, thisStart, thisEnd));
  const lastW = list.filter((c) => inRangeISO(c.date, lastStart, lastEnd));

  if (thisW.length === 0 && lastW.length === 0) {
    return emptyState({ iconName: 'run', title: t('not_enough_data'), text: t('not_enough_cardio') });
  }

  const thisMin = thisW.reduce((s, c) => s + c.duration, 0);
  const lastMin = lastW.reduce((s, c) => s + c.duration, 0);
  const thisCal = thisW.reduce((s, c) => s + c.calories, 0);
  const lastCal = lastW.reduce((s, c) => s + c.calories, 0);

  return `
    <div class="compare-card">
      <div class="compare-card-title">${t('total_minutes')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastMin}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisMin}</div></div>
      </div>
      ${deltaBlock(thisMin, lastMin, t('minutes').toLowerCase())}
    </div>

    <div class="compare-card">
      <div class="compare-card-title">${t('calories_burned')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastCal}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisCal}</div></div>
      </div>
      ${deltaBlock(thisCal, lastCal, t('cal'))}
    </div>

    <div class="compare-card">
      <div class="compare-card-title">${t('sessions_w')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastW.length}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisW.length}</div></div>
      </div>
      ${deltaBlock(thisW.length, lastW.length, '')}
    </div>
  `;
}

function renderCompareSleep() {
  const { thisStart, thisEnd, lastStart, lastEnd } = weekRanges();
  const list = DB.sleep.list();
  const thisW = list.filter((s) => inRangeISO(s.date, thisStart, thisEnd));
  const lastW = list.filter((s) => inRangeISO(s.date, lastStart, lastEnd));

  if (thisW.length === 0 && lastW.length === 0) {
    return emptyState({ iconName: 'moon', title: t('not_enough_data'), text: t('not_enough_sleep') });
  }

  const avg = (arr) => arr.length === 0 ? 0 : Math.round(arr.reduce((s, x) => s + x.durationMinutes, 0) / arr.length);
  const thisAvg = avg(thisW);
  const lastAvg = avg(lastW);

  let delta;
  if (thisAvg === 0 || lastAvg === 0) {
    delta = `<div class="compare-delta flat">${icon('minus', 14)} ${t('need_both_weeks')}</div>`;
  } else if (thisAvg > lastAvg) {
    delta = `<div class="compare-delta up">${icon('arrowUp', 14)} +${formatDuration(thisAvg - lastAvg)}</div>`;
  } else if (thisAvg < lastAvg) {
    delta = `<div class="compare-delta down">${icon('arrowDown', 14)} -${formatDuration(lastAvg - thisAvg)}</div>`;
  } else {
    delta = `<div class="compare-delta flat">${icon('minus', 14)} ${t('same_as_last_week')}</div>`;
  }

  return `
    <div class="compare-card">
      <div class="compare-card-title">${t('avg_sleep')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastAvg > 0 ? formatDuration(lastAvg) : '—'}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisAvg > 0 ? formatDuration(thisAvg) : '—'}</div></div>
      </div>
      ${delta}
    </div>

    <div class="compare-card">
      <div class="compare-card-title">${t('nights_logged_t')}</div>
      <div class="compare-weeks">
        <div class="compare-week"><div class="compare-week-label">${t('last_week_label')}</div><div class="compare-week-value num">${lastW.length}</div></div>
        <div class="compare-week"><div class="compare-week-label">${t('this_week_label')}</div><div class="compare-week-value num">${thisW.length}</div></div>
      </div>
      ${deltaBlock(thisW.length, lastW.length, '')}
    </div>
  `;
}

// ==========================================================================
// SETTINGS
// ==========================================================================
function renderSettings(el) {
  const prefs = DB.prefs.get();
  const currentTheme = prefs.theme || 'dark';
  const currentLang = prefs.lang || 'en';

  const themeCards = [
    { id: 'dark', name: t('theme_dark'), sub: t('theme_dark_sub'), cls: 'theme-preview-dark', dots: ['#5b8def', '#000000', '#a3a3a3'] },
    { id: 'light', name: t('theme_light'), sub: t('theme_light_sub'), cls: 'theme-preview-light', dots: ['#0d9488', '#f6f8fa', '#475569'] },
    { id: 'forest', name: t('theme_forest'), sub: t('theme_forest_sub'), cls: 'theme-preview-forest', dots: ['#86efac', '#173727', '#4ade80'] },
    { id: 'ocean', name: t('theme_ocean'), sub: t('theme_ocean_sub'), cls: 'theme-preview-ocean', dots: ['#38bdf8', '#112439', '#22d3ee'] },
    { id: 'sand', name: t('theme_sand'), sub: t('theme_sand_sub'), cls: 'theme-preview-sand', dots: ['#c2410c', '#fbf6ee', '#3d2c18'] },
    { id: 'mocha', name: t('theme_mocha'), sub: t('theme_mocha_sub'), cls: 'theme-preview-mocha', dots: ['#e7c8a0', '#322620', '#d2ad7d'] },
    { id: 'olive', name: t('theme_olive'), sub: t('theme_olive_sub'), cls: 'theme-preview-olive', dots: ['#bef264', '#272c19', '#a3e635'] },
    { id: 'aurora', name: t('theme_aurora'), sub: t('theme_aurora_sub'), cls: 'theme-preview-aurora', dots: ['#ec4899', '#8b5cf6', '#22d3ee'] },
    { id: 'sunset', name: t('theme_sunset'), sub: t('theme_sunset_sub'), cls: 'theme-preview-sunset', dots: ['#fb923c', '#be185d', '#fef3e7'] },
    { id: 'nebula', name: t('theme_nebula'), sub: t('theme_nebula_sub'), cls: 'theme-preview-nebula', dots: ['#a855f7', '#6366f1', '#22d3ee'] },
    { id: 'slate', name: t('theme_slate'), sub: t('theme_slate_sub'), cls: 'theme-preview-slate', dots: ['#d4a373', '#2c2c30', '#a3e635'] },
    { id: 'frost', name: t('theme_frost'), sub: t('theme_frost_sub'), cls: 'theme-preview-frost', dots: ['#475569', '#eef2f7', '#0891b2'] },
    { id: 'dusk', name: t('theme_dusk'), sub: t('theme_dusk_sub'), cls: 'theme-preview-dusk', dots: ['#d9a5b2', '#322638', '#a3a3ff'] },
  ].map((tm) => `
    <button class="theme-card ${currentTheme === tm.id ? 'active' : ''}" data-theme="${tm.id}">
      <div class="theme-preview ${tm.cls}">
        <div class="theme-preview-name">${escapeHtml(tm.name)}</div>
        <div class="theme-preview-dots">
          ${tm.dots.map((c) => `<span class="theme-preview-dot" style="background:${c}"></span>`).join('')}
        </div>
      </div>
      ${currentTheme === tm.id ? `<div class="theme-check">${icon('check', 12)}</div>` : ''}
    </button>
  `).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('settings_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${icon('settings', 14)}</div>
      <h1 class="page-title">${t('settings_title')}</h1>
      <p class="page-subtitle">${t('settings_subtitle')}</p>
    </div>

    ${(window.Cloud && Cloud.configured()) ? `
    <div class="settings-section" id="account-section">
      <div class="section-title" style="margin-top:0">${t('account')}</div>
      <div id="account-body">
        <button class="settings-action-row" style="cursor:default">
          <div class="settings-action-icon">${icon('globe', 18)}</div>
          <div class="settings-action-main">
            <div class="settings-action-title">${t('auth_checking')}</div>
          </div>
        </button>
      </div>
    </div>` : ''}

    <div class="settings-section">
      <div class="section-title"${(window.Cloud && Cloud.configured()) ? '' : ' style="margin-top:0"'}>${t('language')}</div>
      <div class="lang-toggle">
        <button class="lang-option ${currentLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
        <button class="lang-option ${currentLang === 'ar' ? 'active' : ''}" data-lang="ar">العربية</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('theme')}</div>
      <div class="theme-grid">${themeCards}</div>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('unit_label')}</div>
      <div class="unit-toggle">
        <button class="unit-option ${(prefs.unit || 'kg') === 'kg' ? 'active' : ''}" data-unit="kg">${t('kg_label')}</button>
        <button class="unit-option ${prefs.unit === 'lb' ? 'active' : ''}" data-unit="lb">${t('lb_label')}</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('health_section')}</div>
      <button class="settings-action-row" id="health-btn">
        <div class="settings-action-icon">${icon('heartPulse', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('health_connect')}</div>
          <div class="settings-action-sub">${t('health_connect_sub')}</div>
        </div>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('feedback_title')}</div>
      <button class="settings-action-row" id="feedback-btn">
        <div class="settings-action-icon">${icon('send', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('feedback_title')}</div>
          <div class="settings-action-sub">${t('feedback_sub')}</div>
        </div>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">${t('data')}</div>
      <button class="settings-action-row" id="export-btn">
        <div class="settings-action-icon">${icon('download', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('export_data')}</div>
          <div class="settings-action-sub">${t('export_data_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row" id="import-btn">
        <div class="settings-action-icon">${icon('upload', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('import_data')}</div>
          <div class="settings-action-sub">${t('import_data_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row" id="reset-btn" style="color:var(--red)">
        <div class="settings-action-icon" style="background:var(--red-bg);color:var(--red)">${icon('refresh', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('reset_data')}</div>
          <div class="settings-action-sub">${t('reset_data_sub')}</div>
        </div>
      </button>
    </div>
  `;

  // Account (cloud sync) — populated async since the session check is async.
  if (window.Cloud && Cloud.configured()) populateAccount(el);

  // Language buttons
  el.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setLang(b.dataset.lang);
      applyLang(b.dataset.lang);
      renderSettings(el);
    })
  );

  // Theme cards — apply live (body class swap) and move the active state /
  // checkmark in place, no full settings re-render (keeps scroll position).
  el.querySelectorAll('[data-theme]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setTheme(b.dataset.theme);
      applyTheme(b.dataset.theme);
      el.querySelectorAll('[data-theme]').forEach((card) => {
        const on = card === b;
        card.classList.toggle('active', on);
        const existing = card.querySelector('.theme-check');
        if (on && !existing) {
          card.insertAdjacentHTML('beforeend', `<div class="theme-check">${icon('check', 12)}</div>`);
        } else if (!on && existing) {
          existing.remove();
        }
      });
    })
  );

  // Unit toggle
  el.querySelectorAll('[data-unit]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setUnit(b.dataset.unit);
      renderSettings(el);
    })
  );

  // Health Connect (provided by js/health.js — runs only inside the Android app)
  $('#health-btn', el)?.addEventListener('click', () => {
    if (window.Health && typeof window.Health.open === 'function') window.Health.open();
    else showToast(t('health_only_android'));
  });

  // Feedback / suggestions
  $('#feedback-btn', el)?.addEventListener('click', showFeedback);

  // Export
  $('#export-btn', el).addEventListener('click', () => {
    const json = DB.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `vault-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('export_data'));
  });

  // Import
  $('#import-btn', el).addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = DB.importJSON(reader.result);
        if (ok) {
          showToast(t('imported'));
          const p = DB.prefs.get();
          applyTheme(p.theme || 'dark');
          applyLang(p.lang || 'en');
          navigate('home');
        } else {
          showToast(t('import_failed'));
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // Reset
  $('#reset-btn', el).addEventListener('click', () => {
    confirmDialog({
      title: t('reset_q'),
      text: t('reset_text'),
      confirmLabel: t('reset_confirm'),
      onConfirm: () => {
        DB.resetAll();
        const p = DB.prefs.get();
        applyTheme(p.theme || 'dark');
        applyLang(p.lang || 'en');
        navigate('home');
        showToast(t('deleted'));
      },
    });
  });

}

// ==========================================================================
// Chart + Variations helpers (used in exercise detail)
// ==========================================================================
function chartHtmlForExercise(exerciseId) {
  // Plot max weight across the most recent up to 10 sessions (chronological order)
  const sessions = DB.sessions.listByExercise(exerciseId);
  if (sessions.length < 2) {
    return `
      <div class="chart-card">
        <div class="chart-head">
          <div class="chart-title">${t('progress_chart')}</div>
        </div>
        <div class="chart-empty">${t('no_chart_data')}</div>
      </div>
    `;
  }

  // sessions are sorted desc by date; reverse for chronological
  const points = sessions
    .slice(0, 10)
    .reverse()
    .map((s) => {
      const maxW = Math.max(0, ...s.sets.map((x) => x.weight));
      return { date: s.date, value: maxW };
    })
    .filter((p) => p.value > 0);

  if (points.length < 2) {
    return `
      <div class="chart-card">
        <div class="chart-head">
          <div class="chart-title">${t('progress_chart')}</div>
        </div>
        <div class="chart-empty">${t('no_chart_data')}</div>
      </div>
    `;
  }

  const W = 300, H = 100, PAD_X = 12, PAD_Y = 12;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const stepX = (W - PAD_X * 2) / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_Y + (H - PAD_Y * 2) * (1 - (p.value - min) / span),
    v: p.value,
  }));

  const pathD = coords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
  const areaD = pathD + ` L ${coords[coords.length - 1].x} ${H - PAD_Y} L ${coords[0].x} ${H - PAD_Y} Z`;
  const dots = coords.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="3" fill="var(--accent)"/>`).join('');

  const latest = points[points.length - 1].value;

  return `
    <div class="chart-card">
      <div class="chart-head">
        <div class="chart-title">${t('max_weight_per_session')}</div>
        <div class="chart-latest num">${fmtWeight(latest)} ${unitLabel()}</div>
      </div>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#chart-grad)"/>
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
      </svg>
    </div>
  `;
}

function variationsHtmlForExercise(ex) {
  // Look up by name; fallback to 3 random others in same category
  let names = EXERCISE_VARIATIONS[ex.name];
  const all = DB.exercises.list();
  let alts = [];

  if (names && names.length > 0) {
    const byName = Object.fromEntries(all.map((e) => [e.name, e]));
    alts = names.map((n) => byName[n]).filter(Boolean).filter((e) => e.id !== ex.id);
  }

  if (alts.length === 0) {
    alts = all.filter((e) => e.category === ex.category && e.id !== ex.id).slice(0, 3);
  }

  if (alts.length === 0) return '';

  const rows = alts.slice(0, 5).map((alt) => `
    <div class="variation-row">
      <span class="variation-cat-dot" data-cat="${escapeHtml(alt.category)}"></span>
      <span class="variation-name">${escapeHtml(alt.name)}</span>
      <button type="button" class="variation-select" data-goto-alt="${alt.id}" aria-label="${escapeHtml(t('select'))}">${t('select')} ${icon('chevronRight', 14)}</button>
    </div>
  `).join('');

  return `
    <div class="section-title">${t('variations')}</div>
    <p style="font-size:12px;color:var(--text-mute);margin-top:-6px;margin-bottom:10px">${t('variations_sub')}</p>
    <div class="variation-list" style="margin-bottom:18px">${rows}</div>
  `;
}

// ==========================================================================
// PLANNER VIEW
// ==========================================================================
function renderPlanner(el) {
  const plan = DB.plan.get() || { mode: 'rotation', cycle: [], trainingDays: [], anchor: null };
  const cycle = plan.cycle || [];
  const trainingDays = plan.trainingDays || [];
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const dayOrder = [0, 1, 2, 3, 4, 5, 6];

  // Training-day pills (which weekdays you train; the others are rest).
  const daysHtml = dayOrder.map((d) =>
    `<button type="button" class="schedule-day ${trainingDays.indexOf(d) !== -1 ? 'active' : ''}" data-td="${d}">${escapeHtml(dayName(d, false))}</button>`
  ).join('');

  // The ordered CYCLE of workouts (Push → Pull → Legs …), rolled across days.
  const slotsHtml = cycle.length
    ? cycle.map((slot, i) => {
        const exObjs = (slot.exerciseIds || []).map((id) => exerciseById[id]).filter(Boolean);
        return `
          <div class="rot-slot" data-slot="${i}">
            <div class="rot-slot-head">
              <span class="rot-slot-num num">${fmtNum(i + 1)}</span>
              <span class="rot-slot-name">${escapeHtml(slot.name || 'Workout')}</span>
              <span class="rot-slot-meta">${fmtNum(exObjs.length)} ${exObjs.length === 1 ? t('exercise') : t('exercises')}</span>
              <span class="rot-slot-actions">
                <button type="button" class="icon-btn icon-btn-tile" data-up="${i}" aria-label="${t('move_up')}" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="icon-btn icon-btn-tile" data-down="${i}" aria-label="${t('move_down')}" ${i === cycle.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="icon-btn icon-btn-tile" data-edit="${i}" aria-label="${t('edit_workout')}">${icon('edit', 16)}</button>
              </span>
            </div>
            <div class="rot-slot-ex">${
              exObjs.length
                ? exObjs.map((ex) => `<span class="today-plan-chip">${escapeHtml(exDisplayName(ex))}</span>`).join('')
                : `<span class="planner-empty-hint">${t('empty_day_drop')}</span>`
            }</div>
          </div>`;
      }).join('')
    : `<div class="planner-empty-hint" style="padding:16px 2px">${t('no_plan_today_sub')}</div>`;

  // Rolling preview — the next 7 days computed from the REAL rotation.
  const start = new Date(); start.setHours(12, 0, 0, 0);
  const previewHtml = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const w = DB.plan.workoutForDate(d);
    return `
      <div class="schedule-prev-row ${w ? '' : 'rest'}">
        <span class="schedule-prev-day">${escapeHtml(dayName(d.getDay(), true))}</span>
        <span class="schedule-prev-arrow">${w ? '→' : ''}</span>
        <span class="schedule-prev-workout">${w ? escapeHtml(w.name) : t('rest_day')}</span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('planner_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('library')}</div>
      <h1 class="page-title">${t('planner_title')}</h1>
      <p class="page-subtitle">${t('planner_subtitle')}</p>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary" id="apply-template-btn" style="flex:1">${icon('plus', 16)} ${t('apply_template')}</button>
      ${cycle.length ? `<button class="btn btn-ghost" id="clear-plan-btn">${icon('trash', 16)}</button>` : ''}
    </div>

    <div class="rot-section">
      <div class="rot-section-title">${t('training_days')}</div>
      <div class="schedule-days">${daysHtml}</div>
    </div>

    <div class="rot-section">
      <div class="rot-section-title">${t('rotation_cycle')}</div>
      <div class="rot-slots">${slotsHtml}</div>
      <button class="btn btn-ghost btn-block" id="add-slot-btn" style="margin-top:10px">${icon('plus', 16)} ${t('add_workout')}</button>
    </div>

    <div class="rot-section">
      <div class="rot-section-title">${t('rotation_preview')}</div>
      <div class="schedule-preview">${previewHtml}</div>
    </div>
  `;

  $('#apply-template-btn', el)?.addEventListener('click', openTemplatesModal);
  $('#add-slot-btn', el)?.addEventListener('click', () => openSlotEditorModal(null));

  $('#clear-plan-btn', el)?.addEventListener('click', () => {
    confirmDialog({
      title: t('clear_plan_q'),
      text: t('clear_plan_text'),
      confirmLabel: t('clear_plan'),
      onConfirm: () => { DB.plan.clearAll(); showToast(t('plan_cleared')); renderPlanner(el); },
    });
  });

  // Toggle a training weekday.
  el.querySelectorAll('[data-td]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.td);
      const set = new Set(DB.plan.get().trainingDays || []);
      if (set.has(d)) set.delete(d); else set.add(d);
      DB.plan.setTrainingDays([...set]);
      renderPlanner(el);
    })
  );
  // Reorder / edit a cycle slot.
  el.querySelectorAll('[data-up]').forEach((b) =>
    b.addEventListener('click', () => { DB.plan.moveSlot(Number(b.dataset.up), Number(b.dataset.up) - 1); renderPlanner(el); })
  );
  el.querySelectorAll('[data-down]').forEach((b) =>
    b.addEventListener('click', () => { DB.plan.moveSlot(Number(b.dataset.down), Number(b.dataset.down) + 1); renderPlanner(el); })
  );
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openSlotEditorModal(Number(b.dataset.edit)))
  );
}

function openTemplatesModal() {
  const cards = WORKOUT_TEMPLATES.map((tmpl) => `
    <div class="compare-card" style="margin-bottom:8px">
      <div class="compare-card-title">${escapeHtml(tmpl.name)}</div>
      <div style="font-size:12px;color:var(--text-mute);margin-bottom:10px">${t('tmpl_desc_' + tmpl.id.replace(/-/g, '_'))} · <span class="num">${fmtNum(tmpl.days.length)}</span> ${t('workouts_label')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${tmpl.days.map((d) => `<span class="today-plan-chip">${escapeHtml(d.name)}</span>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" data-apply="${tmpl.id}">${t('apply')}</button>
    </div>
  `).join('');

  // Admin-curated "ready-made plans" (server preset_plans), additive to the
  // built-in templates above. Empty/offline → this whole block renders nothing.
  const serverCards = SERVER_PRESET_PLANS.map((tmpl) => `
    <div class="compare-card" style="margin-bottom:8px">
      <div class="compare-card-title">${escapeHtml(tmpl.name)} <span class="today-plan-chip" style="margin-inline-start:6px">${t('preset_badge')}</span></div>
      <div style="font-size:12px;color:var(--text-mute);margin-bottom:10px">${tmpl.description ? escapeHtml(tmpl.description) + ' · ' : ''}<span class="num">${fmtNum(tmpl.days.length)}</span> ${t('workouts_label')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${tmpl.days.map((d) => `<span class="today-plan-chip">${escapeHtml(d.name)}</span>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" data-apply-server="${tmpl.id}">${t('apply')}</button>
    </div>
  `).join('');

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('templates_title')}</div>
        <div class="modal-subtitle">${t('templates_subtitle')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    ${cards}
    ${serverCards ? `<div class="modal-subtitle" style="margin:14px 0 8px">${t('ready_made_section')}</div>${serverCards}` : ''}
  `);

  document.querySelectorAll('[data-apply]').forEach((b) =>
    b.addEventListener('click', () => {
      const tmpl = WORKOUT_TEMPLATES.find((x) => x.id === b.dataset.apply);
      if (!tmpl) return;
      openScheduleModal(tmpl);
    })
  );
  document.querySelectorAll('[data-apply-server]').forEach((b) =>
    b.addEventListener('click', () => {
      const tmpl = SERVER_PRESET_PLANS.find((x) => x.id === b.dataset.applyServer);
      if (!tmpl) return;
      openScheduleModal(tmpl);
    })
  );
}

// Step 2 of applying a template: let the user choose which weekdays are
// training days (the rest stay empty). The template's workouts are distributed
// across the chosen days IN ORDER, cycling if there are more training days than
// workouts (e.g. 5 chosen days with a 3-workout PPL → Push, Pull, Legs, Push,
// Pull). Defaults are seeded from the classic heuristic for the workout count.
function openScheduleModal(tmpl) {
  const workouts = tmpl.days;           // [{ name, exercises:[names] }]
  const M = workouts.length;
  const dayOrder = [0, 1, 2, 3, 4, 5, 6]; // Sun..Sat
  const defaults = M <= 3 ? [1, 3, 5]
    : M === 4 ? [1, 2, 4, 5]
    : M === 5 ? [1, 2, 3, 4, 5]
    : M === 6 ? [0, 1, 2, 3, 4, 5]
    : [0, 1, 2, 3, 4, 5, 6];
  const training = new Set(defaults);

  // Selected training days (in Sun..Sat order) → workout assigned cyclically.
  function assignment() {
    const sel = dayOrder.filter((d) => training.has(d));
    return sel.map((dow, i) => ({ dow, workout: workouts[i % M] }));
  }

  function renderPreview() {
    const box = $('#schedule-preview');
    if (!box) return;
    // Roll the cycle across the next 7 days from today (rest days skip) — shows
    // the continuous rotation the way it will actually run.
    const M = workouts.length;
    const start = new Date(); start.setHours(12, 0, 0, 0);
    let elapsed = 0;
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const isTraining = training.has(d.getDay());
      const w = (isTraining && M) ? workouts[elapsed % M] : null;
      if (isTraining) elapsed++;
      rows.push(`
        <div class="schedule-prev-row ${w ? '' : 'rest'}">
          <span class="schedule-prev-day">${escapeHtml(dayName(d.getDay(), true))}</span>
          <span class="schedule-prev-arrow">${w ? '→' : ''}</span>
          <span class="schedule-prev-workout">${w ? escapeHtml(w.name) : t('rest_day')}</span>
        </div>`);
    }
    box.innerHTML = rows.join('');
    const count = $('#schedule-count');
    if (count) count.textContent = fmtNum(training.size);
    const applyBtn = $('#schedule-apply');
    if (applyBtn) applyBtn.disabled = training.size === 0;
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('schedule_title')}</div>
        <div class="modal-subtitle">${escapeHtml(tmpl.name)} · <span id="schedule-count" class="num">${fmtNum(training.size)}</span> ${t('schedule_days_label')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <p class="schedule-hint">${t('schedule_hint')}</p>
    <div class="schedule-days">
      ${dayOrder.map((d) => `<button type="button" class="schedule-day ${training.has(d) ? 'active' : ''}" data-day="${d}">${escapeHtml(dayName(d, false))}</button>`).join('')}
    </div>

    <div class="schedule-preview" id="schedule-preview"></div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="schedule-apply">${t('apply')}</button>
    </div>
  `);

  renderPreview();

  document.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.day);
      if (training.has(d)) training.delete(d); else training.add(d);
      b.classList.toggle('active');
      renderPreview();
    })
  );

  $('#schedule-apply').addEventListener('click', () => {
    if (training.size === 0) return;
    const byName = Object.fromEntries(DB.exercises.list().map((e) => [e.name, e]));
    // Build the ordered CYCLE (Push, Pull, Legs…) — no longer pinned to weekdays.
    const cycle = workouts.map((w) => {
      const ids = [];
      (w.exercises || []).forEach((nm) => {
        const ex = byName[nm];
        if (ex) { ids.push(ex.id); if (!ex.inMyList) DB.exercises.setInMyList(ex.id, true); }
      });
      return { name: w.name, exerciseIds: ids };
    });
    const trainingDays = dayOrder.filter((d) => training.has(d));
    DB.plan.setRotation({ cycle, trainingDays, anchor: todayISO() });
    closeModal();
    showToast(t('template_applied'));
    renderView(currentView);
  });
}

// Edit ONE workout in the rotation cycle. slotIdx = number (edit cycle[i]) or
// null/undefined (create a new workout appended to the cycle).
function openSlotEditorModal(slotIdx) {
  const cycle = (DB.plan.get() || {}).cycle || [];
  const isNew = (slotIdx == null || slotIdx < 0 || !cycle[slotIdx]);
  const slot = isNew ? { name: '', exerciseIds: [] } : cycle[slotIdx];
  let pickedIds = new Set(slot.exerciseIds || []);
  let dayLabel = slot.name || '';
  let pickerQuery = '';
  let pickerCategory = 'All';

  const allExercises = DB.exercises.list();

  function renderPickerList() {
    const container = $('#picker-list');
    if (!container) return;
    let list = allExercises;
    if (pickerCategory !== 'All') list = list.filter((e) => e.category === pickerCategory);
    if (pickerQuery) list = list.filter((e) => exMatchesQuery(e, pickerQuery));

    container.innerHTML = list.map((ex) => {
      const imgUrl = exerciseImgSrc(ex);
      // Small square thumbnail: the real exercise photo (remote dataset or a
      // custom image) sits on top of an initials fallback; if the photo fails
      // to load it removes itself and the initials show through.
      return `
      <button type="button" class="picker-row ${pickedIds.has(ex.id) ? 'picked' : ''}" data-pick="${ex.id}">
        <span class="picker-row-thumb" data-cat="${escapeHtml(ex.category)}">
          <span class="picker-row-thumb-fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</span>
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        </span>
        <span class="picker-row-name">${escapeHtml(exDisplayName(ex))}</span>
        <span class="picker-row-check">${icon('check', 14)}</span>
      </button>
    `;
    }).join('');

    container.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.pick;
        if (pickedIds.has(id)) pickedIds.delete(id);
        else pickedIds.add(id);
        b.classList.toggle('picked');
      })
    );
  }

  const catPills = ['All', ...EXERCISE_CATEGORIES]
    .map((f) => `<button type="button" class="filter-pill ${f === pickerCategory ? 'active' : ''}" data-pick-cat="${f}">${escapeHtml(t('cat_' + f, f))}</button>`)
    .join('');

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${escapeHtml(dayLabel || t('add_workout'))}</div>
        <div class="modal-subtitle">${isNew ? t('add_workout') : t('edit_workout')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="day-name" placeholder="${t('workout_name_ph')}" value="${escapeHtml(dayLabel)}">
    </div>

    <div class="form-group picker-group">
      <label class="form-label">${t('pick_exercises')}</label>
      <div class="search-wrap" style="margin-bottom:8px">
        ${icon('search', 18)}
        <input type="search" id="picker-search" placeholder="${t('search_exercises')}">
      </div>
      <div class="filter-bar" style="margin: 0 0 10px">${catPills}</div>
      <div class="picker-list" id="picker-list"></div>
    </div>

    <div class="form-actions sticky-actions">
      ${isNew ? '' : `<button type="button" class="btn btn-ghost day-rest-btn" id="day-clear-btn">${icon('trash', 14)} ${t('remove_workout')}</button>`}
      <button type="button" class="btn btn-primary" id="day-save-btn">${t('save')}</button>
    </div>
  `);

  // Flex layout: only the exercise list scrolls; the Save bar stays pinned.
  document.querySelector('#modal-root .modal')?.classList.add('modal-day-editor');

  renderPickerList();

  $('#day-name').addEventListener('input', (e) => { dayLabel = e.target.value; });

  $('#picker-search').addEventListener('input', (e) => {
    pickerQuery = e.target.value;
    renderPickerList();
  });

  document.querySelectorAll('[data-pick-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      pickerCategory = b.dataset.pickCat;
      document.querySelectorAll('[data-pick-cat]').forEach((x) =>
        x.classList.toggle('active', x.dataset.pickCat === pickerCategory)
      );
      renderPickerList();
    })
  );

  $('#day-clear-btn')?.addEventListener('click', () => {
    if (!isNew) DB.plan.removeSlot(slotIdx);
    closeModal();
    showToast(t('day_cleared'));
    renderView(currentView);
  });

  $('#day-save-btn').addEventListener('click', () => {
    const ids = [...pickedIds];
    const name = dayLabel.trim() || 'Workout';
    // Auto-add picked exercises to the user's Train list
    ids.forEach((id) => {
      const ex = DB.exercises.getById(id);
      if (ex && !ex.inMyList) DB.exercises.setInMyList(id, true);
    });
    if (isNew) {
      if (ids.length || dayLabel.trim()) {
        DB.plan.addSlot(name);
        DB.plan.setSlotExercises((DB.plan.get().cycle || []).length - 1, ids);
      }
    } else {
      DB.plan.setSlotName(slotIdx, name);
      DB.plan.setSlotExercises(slotIdx, ids);
    }
    closeModal();
    showToast(t('day_saved'));
    renderView(currentView);
  });
}

// ==========================================================================
// SESSION DAY — log all the day's exercises in one page
// ==========================================================================
// Tapping a day in the Planner opens this view. It shows every exercise
// scheduled for that day as its own session card with inline reps/weight
// inputs. Saving a card writes a session for the chosen date — overwriting
// any existing session for the same exercise+date so the card stays a
// single source of truth for that day's training.
function renderSessionDay(el) {
  // The DATE drives everything (continuous rotation): resolve the workout for the
  // selected date + which cycle slot it is (for add/remove edits).
  if (!viewContext.sdDate) viewContext.sdDate = viewContext.date || todayISO();
  const sdDateObj = new Date(viewContext.sdDate + 'T12:00:00');
  const dow = sdDateObj.getDay();   // header label = the selected date's weekday
  const day = DB.plan.workoutForDate(sdDateObj);
  const slotIdx = day ? ((DB.plan.get().cycle || []).indexOf(day)) : -1;
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const exObjs = (day?.exerciseIds || []).map((id) => exerciseById[id]).filter(Boolean);

  // Per-exercise local state for unsaved edits. Persists across re-renders
  // until the user navigates away.
  if (!viewContext.sdState) viewContext.sdState = {};
  const sdState = viewContext.sdState;

  // Modal-level unit (defaults to user's prefs unit, switchable per page)
  if (!viewContext.sdUnit) viewContext.sdUnit = (DB.prefs.get().unit) || 'kg';

  function modalConvertForDisplay(kg) {
    if (viewContext.sdUnit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2;
    return Math.round(kg * 100) / 100;
  }
  function modalConvertToKg(value) {
    if (viewContext.sdUnit === 'lb') return Math.round((Number(value) / KG_TO_LB) * 100) / 100;
    return Number(value);
  }

  // Find the existing logged session for an exercise on the chosen date (if any)
  function todaySessionFor(exId) {
    return DB.sessions
      .listByExercise(exId)
      .find((s) => s.date === viewContext.sdDate);
  }

  // Initialize state for an exercise the first time it's rendered. Pre-fills
  // sets from today's session (if already started) → otherwise from the most
  // recent session → otherwise three blank rows.
  function initState(exId) {
    if (sdState[exId]) {
      const cached = sdState[exId];
      // Re-validate a cached savedSessionId: the session may have been deleted
      // from the exercise-detail screen while we were away. Dropping the stale
      // id prevents a silent no-op "update" (data loss) and a false logged pill.
      if (cached.savedSessionId && !DB.sessions.get(cached.savedSessionId)) {
        cached.savedSessionId = null;
      }
      return cached;
    }
    const today = todaySessionFor(exId);
    const last = DB.sessions.lastForExercise(exId);
    let sets;
    if (today) sets = today.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
    else if (last) sets = last.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
    else sets = [{ reps: '', weight: '' }]; // start with one empty set (faint "0" placeholders)
    sdState[exId] = { sets, savedSessionId: today ? today.id : null, dirty: false };
    return sdState[exId];
  }

  function renderExerciseCard(ex) {
    const st = initState(ex.id);
    const url = exerciseImgSrc(ex);
    const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
    const isLogged = !!st.savedSessionId;
    // Show Save when the user edited (dirty) OR when an unlogged card is
    // pre-filled with real values (from last workout) so it can be confirmed
    // without a throwaway edit. A brand-new empty card stays clean.
    const hasValues = st.sets.some((s) => (Number(s.reps) || 0) > 0 || (Number(s.weight) || 0) > 0);
    const showSave = st.dirty || (!isLogged && hasValues);

    let bgHtml;
    if (machineSvg) {
      bgHtml = `<div class="sd-thumb machine-bg${url ? ' sd-thumb-zoom' : ''}"${url ? ` data-thumb-src="${escapeHtml(url)}"` : ''}>${machineSvg}${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;
    } else if (url) {
      bgHtml = `<div class="sd-thumb sd-thumb-zoom" data-thumb-src="${escapeHtml(url)}" style="background-image:url('${escapeHtml(url)}')"></div>`;
    } else {
      bgHtml = `<div class="sd-thumb fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</div>`;
    }

    const setsRows = st.sets.map((s, i) => {
      const wDisplay = (s.weight === '' || s.weight == null) ? '' : modalConvertForDisplay(Number(s.weight));
      return `
        <div class="sd-set-row" data-ex="${ex.id}" data-set="${i}">
          <div class="sd-set-n num">${i + 1}</div>
          <input type="number" inputmode="numeric" step="1" min="0" placeholder="0" value="${s.reps || ''}" data-field="reps" aria-label="${t('reps')}">
          <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" value="${wDisplay || ''}" data-field="weight" aria-label="${viewContext.sdUnit}">
          <button type="button" class="sd-set-remove" data-remove-set>${icon('close', 14)}</button>
        </div>
      `;
    }).join('');

    return `
      <div class="sd-card ${isLogged ? 'logged' : ''}" data-ex-card="${ex.id}">
        <div class="sd-card-head">
          ${bgHtml}
          <div class="sd-card-main">
            <div class="sd-card-name">${escapeHtml(exDisplayName(ex))}</div>
          </div>
          ${isLogged ? `<div class="sd-status-pill">${icon('check', 12)} ${t('logged')}</div>` : ''}
          <button type="button" class="icon-btn danger sd-remove-ex" data-remove-ex="${ex.id}" aria-label="${escapeHtml(t('remove_from_day'))}">${icon('trash', 15)}</button>
        </div>

        <div class="sd-sets-head">
          <div>${t('set_n')}</div>
          <div>${t('reps')}</div>
          <div>${viewContext.sdUnit.toUpperCase()}</div>
          <div></div>
        </div>
        <div class="sd-sets" data-ex-sets="${ex.id}">${setsRows}</div>

        <div class="sd-card-actions">
          <button type="button" class="btn btn-ghost sd-add-set-btn" data-add-set="${ex.id}">${icon('plus', 14)} ${t('add_set')}</button>
          <button type="button" class="btn btn-primary sd-save-btn${showSave ? '' : ' sd-hidden'}" data-save-ex="${ex.id}">${isLogged ? t('update') : t('save')}</button>
        </div>
      </div>
    `;
  }

  const totalEx = exObjs.length;
  const loggedCount = exObjs.filter((ex) => sdState[ex.id]?.savedSessionId || todaySessionFor(ex.id)).length;

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(dayName(dow, true))}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${escapeHtml(dayName(dow, true))}</div>
      <h1 class="page-title">${escapeHtml(day?.name || t('start_workout'))}</h1>
      <p class="page-subtitle">${fmtNum(loggedCount)} / ${fmtNum(totalEx)} ${t('logged_today')}</p>
    </div>

    <div class="sd-toolbar">
      <div class="form-group" style="flex:1;margin:0">
        <label class="form-label" for="sd-date" style="font-size:10px">${t('date')}</label>
        <input type="date" id="sd-date" value="${viewContext.sdDate}">
      </div>
      <div class="modal-unit-toggle" role="group" aria-label="${escapeHtml(t('unit'))}">
        <button type="button" data-sd-unit="kg" aria-pressed="${viewContext.sdUnit === 'kg'}" class="${viewContext.sdUnit === 'kg' ? 'active' : ''}">KG</button>
        <button type="button" data-sd-unit="lb" aria-pressed="${viewContext.sdUnit === 'lb'}" class="${viewContext.sdUnit === 'lb' ? 'active' : ''}">LB</button>
      </div>
    </div>

    ${totalEx > 0
      ? `<button type="button" class="sd-start-run" id="sd-start-run">${icon('dumbbell', 20)}<span>${t('start_workout')}</span></button>`
      : ''
    }

    ${totalEx === 0
      ? emptyState({ iconName: 'dumbbell', title: t('rest_day'), text: t('no_plan_today_sub') })
      : `<div class="sd-list">${exObjs.map(renderExerciseCard).join('')}</div>`
    }

    <button type="button" class="btn btn-ghost btn-block" id="sd-add-ex" style="margin-top:12px">${icon('plus', 16)} ${t('add_exercise')}</button>
  `;

  // "Start Workout" → guided one-exercise-at-a-time mode. Carry the chosen date
  // and unit so the run logs against the same day/unit the user picked here.
  $('#sd-start-run', el)?.addEventListener('click', () =>
    navigate('session-run', { date: viewContext.sdDate, unit: viewContext.sdUnit })
  );

  // ----- Bindings -----

  // Add an exercise: offer two choices — pick from the library, or create a
  // brand-new custom exercise (which is then added straight to this day).
  $('#sd-add-ex', el)?.addEventListener('click', () => openAddExerciseChooser(slotIdx));

  // Tap (or keyboard-activate) an exercise photo thumbnail to open it
  // full-screen. Made keyboard/SR reachable as a button.
  el.querySelectorAll('.sd-thumb-zoom').forEach((thumb) => {
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    if (!thumb.getAttribute('aria-label')) thumb.setAttribute('aria-label', t('view_photo'));
    const open = (e) => {
      e.stopPropagation();
      const name = thumb.closest('.sd-card')?.querySelector('.sd-card-name')?.textContent?.trim();
      openImageLightbox(thumb.dataset.thumbSrc, name);
    };
    thumb.addEventListener('click', open);
    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
  });

  // Tap an empty area of an exercise card → its full history (exercise-detail).
  // Ignore taps on inputs, buttons, and the photo (which has its own action).
  // For keyboard/SR users the exercise NAME is the reachable history button
  // (the card can't be one button — it contains the set inputs).
  el.querySelectorAll('.sd-card').forEach((card) => {
    const exId = card.dataset.exCard;
    card.addEventListener('click', (e) => {
      if (e.target.closest('input, button, [role="button"]')) return;
      if (exId) navigate('exercise-detail', { exerciseId: exId });
    });
    const nameEl = card.querySelector('.sd-card-name');
    if (nameEl && exId) {
      nameEl.setAttribute('role', 'button');
      nameEl.setAttribute('tabindex', '0');
      nameEl.setAttribute('aria-label', `${nameEl.textContent.trim()} — ${t('history')}`);
      const go = () => navigate('exercise-detail', { exerciseId: exId });
      nameEl.addEventListener('click', (e) => { e.stopPropagation(); go(); });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    }
  });

  // Remove one exercise from this day, inline. Clears its unsaved set state so
  // it doesn't linger, then re-renders. Logged sessions in history are kept.
  el.querySelectorAll('[data-remove-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      const exId = b.dataset.removeEx;
      DB.plan.removeExerciseFromSlot(slotIdx, exId);
      delete viewContext.sdState[exId];
      showToast(t('exercise_removed'));
      renderSessionDay(el);
    })
  );

  $('#sd-date', el)?.addEventListener('change', (e) => {
    viewContext.sdDate = e.target.value || todayISO();
    viewContext.sdState = {}; // re-init since date changed
    renderSessionDay(el);
  });

  el.querySelectorAll('[data-sd-unit]').forEach((b) =>
    b.addEventListener('click', () => {
      viewContext.sdUnit = b.dataset.sdUnit === 'lb' ? 'lb' : 'kg';
      renderSessionDay(el);
    })
  );

  // Set-row inputs (reps/weight) — write to sdState as the user types.
  el.querySelectorAll('.sd-set-row').forEach((row) => {
    const exId = row.dataset.ex;
    const idx = Number(row.dataset.set);
    row.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const v = inp.value;
        const st = initState(exId);
        if (inp.dataset.field === 'weight') {
          st.sets[idx].weight = v === '' ? '' : modalConvertToKg(v);
        } else {
          st.sets[idx][inp.dataset.field] = v === '' ? '' : Number(v);
        }
        st.dirty = true;
        // The card isn't re-rendered on keystroke, so reveal the save button here.
        row.closest('.sd-card')?.querySelector('.sd-save-btn')?.classList.remove('sd-hidden');
      });
    });
    row.querySelector('[data-remove-set]')?.addEventListener('click', () => {
      const st = initState(exId);
      if (st.sets.length <= 1) { showToast(t('set_min_one')); return; }
      st.sets.splice(idx, 1);
      st.dirty = true;
      renderSessionDay(el);
    });
  });

  // Add Set button per exercise
  el.querySelectorAll('[data-add-set]').forEach((b) =>
    b.addEventListener('click', () => {
      const exId = b.dataset.addSet;
      const st = initState(exId);
      const last = st.sets[st.sets.length - 1];
      // Copy the last row's values, preserving an intentional 0 (bodyweight).
      const keep = (v) => (v !== '' && v != null ? v : '');
      st.sets.push({ reps: keep(last?.reps), weight: keep(last?.weight) });
      st.dirty = true;
      renderSessionDay(el);
    })
  );

  // Save button per exercise — creates or updates the session for the chosen date
  el.querySelectorAll('[data-save-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      const exId = b.dataset.saveEx;
      const st = initState(exId);
      const cleaned = st.sets
        .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
        .filter((s) => s.reps > 0 || s.weight > 0);
      if (cleaned.length === 0) { showToast(t('add_at_least_one')); return; }

      // Prefer the in-memory savedSessionId, else look up in DB by date
      let existingId = st.savedSessionId;
      if (!existingId) {
        const existing = todaySessionFor(exId);
        if (existing) existingId = existing.id;
      }
      // Snapshot BEFORE write (full snapshot including the session being edited)
      const prior = DB.sessions.prSnapshot(exId);
      // Try to update the existing session; if it no longer exists (deleted
      // elsewhere), update() returns null and we create a fresh one instead of
      // silently losing the edit.
      let wasUpdate = false;
      if (existingId && DB.sessions.update(existingId, { date: viewContext.sdDate, sets: cleaned })) {
        wasUpdate = true;
      } else {
        const created = DB.sessions.add({ exerciseId: exId, date: viewContext.sdDate, sets: cleaned });
        st.savedSessionId = created.id;
      }
      const prMsg = checkPR(exId, prior, cleaned);
      if (prMsg) {
        showToast(prMsg);
      } else {
        showToast(wasUpdate ? t('session_updated') : t('session_saved'));
      }
      st.dirty = false;
      renderSessionDay(el);
    })
  );
}

// ==========================================================================
// GUIDED WORKOUT (session-run) — one exercise at a time, with rest timer
// ==========================================================================

// Default rest between sets, in seconds.
const REST_DEFAULT_SEC = 90;

// A single floating rest-timer bar lives on `.app` (not on the animated `.view`,
// so a view transform can't break its fixed positioning) and survives view
// re-renders. navigate() calls clearRestTimer() to tear it down.
let __restTimer = null;
function clearRestTimer() {
  if (__restTimer) { clearInterval(__restTimer.id); __restTimer = null; }
  document.querySelector('.rest-timer')?.remove();
}
function startRestTimer(seconds) {
  clearRestTimer();
  const app = document.querySelector('.app');
  if (!app) return;
  let remaining = Math.max(1, Math.round(seconds));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const bar = document.createElement('div');
  bar.className = 'rest-timer';
  bar.setAttribute('role', 'timer');
  bar.innerHTML = `
    <button type="button" class="rest-timer-adj" data-rest-minus aria-label="−15s">−15</button>
    <div class="rest-timer-mid">
      <div class="rest-timer-label">${icon('clock', 14)} ${t('resting')}</div>
      <div class="rest-timer-count num">${fmt(remaining)}</div>
    </div>
    <button type="button" class="rest-timer-adj" data-rest-plus aria-label="+15s">+15</button>
    <button type="button" class="rest-timer-skip" data-rest-skip>${t('skip')}</button>
  `;
  app.appendChild(bar);
  const countEl = bar.querySelector('.rest-timer-count');
  const id = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearRestTimer();
      try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (_) {}
      return;
    }
    countEl.textContent = fmt(remaining);
  }, 1000);
  __restTimer = { id };
  bar.querySelector('[data-rest-minus]').addEventListener('click', () => {
    remaining = Math.max(1, remaining - 15); countEl.textContent = fmt(remaining);
  });
  bar.querySelector('[data-rest-plus]').addEventListener('click', () => {
    remaining += 15; countEl.textContent = fmt(remaining);
  });
  bar.querySelector('[data-rest-skip]').addEventListener('click', () => clearRestTimer());
}

function renderSessionRun(el) {
  // Resolve the workout by DATE (continuous rotation), like session-day.
  if (!viewContext.runDate) viewContext.runDate = viewContext.date || todayISO();
  const runDateObj = new Date(viewContext.runDate + 'T12:00:00');
  const dow = runDateObj.getDay();   // header label = the date's weekday
  const day = DB.plan.workoutForDate(runDateObj);
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const exObjs = (day?.exerciseIds || []).map((id) => exerciseById[id]).filter(Boolean);
  const totalEx = exObjs.length;

  // Persist run state across re-renders (until navigation replaces viewContext).
  if (!viewContext.runUnit) viewContext.runUnit = viewContext.unit || (DB.prefs.get().unit) || 'kg';
  if (viewContext.runIdx == null) viewContext.runIdx = 0;
  if (!viewContext.runState) viewContext.runState = {};
  if (!viewContext.runView) viewContext.runView = 'run';

  function convDisplay(kg) {
    if (viewContext.runUnit === 'lb') return Math.round(kg * KG_TO_LB * 2) / 2;
    return Math.round(kg * 100) / 100;
  }
  function convToKg(value) {
    if (viewContext.runUnit === 'lb') return Math.round((Number(value) / KG_TO_LB) * 100) / 100;
    return Number(value);
  }

  // Lazily init per-exercise sets: resume today's logged session, else pre-fill
  // from the last session's numbers (as targets), else one empty row.
  function runInit(exId) {
    if (viewContext.runState[exId]) return viewContext.runState[exId];
    const today = DB.sessions.listByExercise(exId).find((s) => s.date === viewContext.runDate);
    const last = DB.sessions.lastForExercise(exId);
    let sets, savedId = null;
    if (today) {
      // Prefill values from today's logged session, but the "done" check is a
      // live in-session action — always start unchecked when entering the run.
      sets = today.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: false }));
      savedId = today.id;
    } else if (last) {
      sets = last.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: false }));
    } else {
      sets = [{ reps: '', weight: '', done: false }];
    }
    viewContext.runState[exId] = { sets, savedSessionId: savedId };
    return viewContext.runState[exId];
  }

  // Persist one exercise's sets to the DB (add or update by date). Idempotent —
  // called when leaving an exercise and again on the final save, so a workout is
  // never lost if the app is closed mid-session.
  function commitExercise(exId) {
    const st = viewContext.runState[exId];
    if (!st) return false;
    const cleaned = st.sets
      .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
      .filter((s) => s.reps > 0 || s.weight > 0);
    if (cleaned.length === 0) return false;
    let existingId = st.savedSessionId;
    if (!existingId) {
      const existing = DB.sessions.listByExercise(exId).find((s) => s.date === viewContext.runDate);
      if (existing) existingId = existing.id;
    }
    if (existingId && DB.sessions.update(existingId, { date: viewContext.runDate, sets: cleaned })) {
      st.savedSessionId = existingId;
    } else {
      const created = DB.sessions.add({ exerciseId: exId, date: viewContext.runDate, sets: cleaned });
      st.savedSessionId = created.id;
    }
    return true;
  }

  function lastPerfLine(exId) {
    const last = DB.sessions.lastForExercise(exId);
    if (!last) return `<div class="run-last run-last--empty">${t('first_time_no_record')}</div>`;
    const u = viewContext.runUnit.toUpperCase();
    const parts = last.sets
      .map((s) => `${fmtNum(s.reps)}×${fmtNum(convDisplay(s.weight))}`)
      .join('  ·  ');
    return `<div class="run-last">${t('last_time')}: <span class="run-last-sets num">${parts}</span> <span class="run-last-unit">${u}</span></div>`;
  }

  // Guard: plan emptied while away.
  if (totalEx === 0) {
    el.innerHTML = `
      <div class="detail-top">
        <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
        <div class="detail-top-title">${escapeHtml(dayName(dow, true))}</div>
      </div>
      ${emptyState({ iconName: 'dumbbell', title: t('rest_day'), text: t('no_plan_today_sub') })}
    `;
    return;
  }

  // ----- SUMMARY SCREEN -----
  if (viewContext.runView === 'summary') {
    let totalSets = 0, totalVolume = 0;
    const rowsHtml = exObjs.map((ex) => {
      const st = runInit(ex.id);
      const done = st.sets
        .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 }))
        .filter((s) => s.reps > 0 || s.weight > 0);
      if (done.length === 0) return '';
      done.forEach((s) => { totalSets += 1; totalVolume += s.reps * s.weight; });
      const setsStr = done
        .map((s) => `${fmtNum(s.reps)}×${fmtNum(convDisplay(s.weight))}`)
        .join('  ·  ');
      return `
        <div class="run-sum-ex">
          <div class="run-sum-name">${escapeHtml(exDisplayName(ex))}</div>
          <div class="run-sum-sets num">${setsStr} <span class="run-sum-unit">${viewContext.runUnit.toUpperCase()}</span></div>
        </div>`;
    }).join('');

    const nothing = totalSets === 0;
    el.innerHTML = `
      <div class="detail-top">
        <button class="back-btn" data-run-back aria-label="${escapeHtml(t('back_to_workout'))}">${icon('back', 20)}</button>
        <div class="detail-top-title">${escapeHtml(t('workout_summary'))}</div>
      </div>
      <div class="page-header">
        <h1 class="page-title">${escapeHtml(t('workout_summary'))}</h1>
        <p class="page-subtitle">${escapeHtml(dayName(dow, true))} · ${escapeHtml(day?.name || '')}</p>
      </div>
      ${nothing
        ? emptyState({ iconName: 'dumbbell', title: t('no_sessions'), text: t('no_sets_to_save') })
        : `<div class="run-summary">
             ${rowsHtml}
             <div class="run-sum-totals">
               <div class="run-sum-total"><span class="run-sum-total-n num">${fmtNum(totalSets)}</span><span class="run-sum-total-l">${t('total_sets')}</span></div>
               <div class="run-sum-total"><span class="run-sum-total-n num">${fmtNum(Math.round(totalVolume))}</span><span class="run-sum-total-l">${t('total_volume')} (${viewContext.runUnit.toUpperCase()})</span></div>
             </div>
           </div>`
      }
      <button type="button" class="btn btn-primary btn-block" data-run-save style="margin-top:16px">${icon('check', 16)} ${t('save_session')}</button>
    `;

    $('[data-run-back]', el)?.addEventListener('click', () => {
      viewContext.runView = 'run';
      renderSessionRun(el);
    });
    $('[data-run-save]', el)?.addEventListener('click', () => {
      let saved = 0;
      exObjs.forEach((ex) => { if (commitExercise(ex.id)) saved += 1; });
      if (saved === 0) { showToast(t('no_sets_to_save')); return; }
      // Force the underlying session-day screens to re-init from the DB so the
      // freshly-logged sessions show as "logged" when we return.
      navStack.forEach((entry) => {
        if (entry.view === 'session-day' && entry.context) entry.context.sdState = {};
      });
      showToast(t('session_saved'));
      if (!goBack()) navigate('session-day', { dow });
    });
    return;
  }

  // ----- RUN SCREEN (current exercise) -----
  const idx = Math.min(viewContext.runIdx, totalEx - 1);
  viewContext.runIdx = idx;
  const ex = exObjs[idx];
  const st = runInit(ex.id);
  const isLast = idx === totalEx - 1;

  const url = exerciseImgSrc(ex);
  const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
  let mediaHtml;
  if (machineSvg) {
    mediaHtml = `<div class="run-ex-media machine-bg${url ? ' sd-thumb-zoom' : ''}"${url ? ` data-thumb-src="${escapeHtml(url)}"` : ''}>${machineSvg}${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;
  } else if (url) {
    mediaHtml = `<div class="run-ex-media sd-thumb-zoom" data-thumb-src="${escapeHtml(url)}" style="background-image:url('${escapeHtml(url)}')"></div>`;
  } else {
    mediaHtml = `<div class="run-ex-media fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</div>`;
  }

  const setsRows = st.sets.map((s, i) => {
    const wDisplay = (s.weight === '' || s.weight == null) ? '' : convDisplay(Number(s.weight));
    return `
      <div class="run-set-row${s.done ? ' done' : ''}" data-set="${i}">
        <div class="run-set-n num">${i + 1}</div>
        <input type="number" inputmode="numeric" step="1" min="0" placeholder="0" value="${s.reps || ''}" data-field="reps" aria-label="${t('reps')}">
        <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" value="${wDisplay || ''}" data-field="weight" aria-label="${viewContext.runUnit}">
        <button type="button" class="run-set-done${s.done ? ' done' : ''}" data-done aria-label="${escapeHtml(t('mark_set_done'))}" aria-pressed="${!!s.done}">${icon('check', 16)}</button>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-back aria-label="${escapeHtml(t('back'))}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(day?.name || dayName(dow, true))}</div>
    </div>

    <div class="run-progress">
      <div class="run-progress-track"><span style="width:${Math.round(((idx + 1) / totalEx) * 100)}%"></span></div>
      <div class="run-progress-label">${t('exercise_word')} <span class="num">${fmtNum(idx + 1)}</span> ${t('of_word')} <span class="num">${fmtNum(totalEx)}</span></div>
    </div>

    <div class="run-ex">
      ${mediaHtml}
      <h1 class="run-ex-name">${escapeHtml(exDisplayName(ex))}</h1>
      ${lastPerfLine(ex.id)}
    </div>

    <div class="run-sets-head">
      <div>${t('set_n')}</div>
      <div>${t('reps')}</div>
      <div>${viewContext.runUnit.toUpperCase()}</div>
      <div class="run-head-done">${t('done_col')}</div>
    </div>
    <div class="run-sets">${setsRows}</div>
    <button type="button" class="btn btn-ghost run-addset" data-addset>${icon('plus', 14)} ${t('add_set')}</button>

    <div class="run-nav">
      <button type="button" class="btn btn-ghost run-prev" data-prev ${idx === 0 ? 'disabled' : ''}>${icon('back', 16)} ${t('previous')}</button>
      <button type="button" class="btn btn-primary run-next" data-next>${isLast ? `${t('finish')} ${icon('check', 16)}` : `${t('next')} ${icon('chevronRight', 16)}`}</button>
    </div>
  `;

  // Photo zoom
  el.querySelectorAll('.sd-thumb-zoom').forEach((thumb) => {
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    if (!thumb.getAttribute('aria-label')) thumb.setAttribute('aria-label', t('view_photo'));
    const open = (e) => { e.stopPropagation(); openImageLightbox(thumb.dataset.thumbSrc, ex.name); };
    thumb.addEventListener('click', open);
    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
  });

  // Set inputs → write to state as the user types.
  el.querySelectorAll('.run-set-row').forEach((row) => {
    const i = Number(row.dataset.set);
    row.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const v = inp.value;
        if (inp.dataset.field === 'weight') {
          st.sets[i].weight = v === '' ? '' : convToKg(v);
        } else {
          st.sets[i].reps = v === '' ? '' : Number(v);
        }
      });
    });
    // ✓ Done → mark the set complete and start the rest timer.
    row.querySelector('[data-done]')?.addEventListener('click', () => {
      st.sets[i].done = !st.sets[i].done;
      row.classList.toggle('done', st.sets[i].done);
      row.querySelector('[data-done]').classList.toggle('done', st.sets[i].done);
      row.querySelector('[data-done]').setAttribute('aria-pressed', String(st.sets[i].done));
      if (st.sets[i].done) startRestTimer(REST_DEFAULT_SEC);
      else clearRestTimer();
    });
  });

  $('[data-addset]', el)?.addEventListener('click', () => {
    const last = st.sets[st.sets.length - 1];
    const keep = (v) => (v !== '' && v != null ? v : '');
    st.sets.push({ reps: keep(last?.reps), weight: keep(last?.weight), done: false });
    renderSessionRun(el);
  });

  $('[data-prev]', el)?.addEventListener('click', () => {
    if (idx === 0) return;
    clearRestTimer();
    commitExercise(ex.id);
    viewContext.runIdx = idx - 1;
    renderSessionRun(el);
  });

  $('[data-next]', el)?.addEventListener('click', () => {
    clearRestTimer();
    commitExercise(ex.id);
    if (isLast) {
      viewContext.runView = 'summary';
    } else {
      viewContext.runIdx = idx + 1;
    }
    renderSessionRun(el);
  });
}

// ==========================================================================
// CALENDAR VIEW
// ==========================================================================
function renderCalendar(el) {
  const today = new Date();
  const ctx = viewContext.calendar || { year: today.getFullYear(), month: today.getMonth() };
  viewContext.calendar = ctx;

  const monthDate = new Date(ctx.year, ctx.month, 1);
  const firstDow = monthDate.getDay();
  const daysInMonth = new Date(ctx.year, ctx.month + 1, 0).getDate();
  const monthLabel = monthDate.toLocaleDateString(
    (DB.prefs.get().lang || 'en') === 'ar' ? 'ar-u-nu-latn' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  // Compute sets-per-day for this month
  const setsByDate = {};
  DB.sessions.listAll().forEach((s) => {
    const d = new Date(s.date + 'T00:00:00');
    if (d.getFullYear() === ctx.year && d.getMonth() === ctx.month) {
      setsByDate[s.date] = (setsByDate[s.date] || 0) + s.sets.length;
    }
  });

  function lvlFor(count) {
    if (count <= 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  }

  const dowLabels = ['dow_sun', 'dow_mon', 'dow_tue', 'dow_wed', 'dow_thu', 'dow_fri', 'dow_sat']
    .map((k) => `<div class="calendar-dow">${escapeHtml(t(k))}</div>`).join('');

  // Build just the month grid + label — called on prev/next so month nav
  // repaints only the grid, not the whole view (header, legend stay put).
  function buildGrid() {
    const first = new Date(ctx.year, ctx.month, 1);
    const firstDowN = first.getDay();
    const daysN = new Date(ctx.year, ctx.month + 1, 0).getDate();
    const byDate = {};
    DB.sessions.listAll().forEach((s) => {
      const d = new Date(s.date + 'T00:00:00');
      if (d.getFullYear() === ctx.year && d.getMonth() === ctx.month) {
        byDate[s.date] = (byDate[s.date] || 0) + s.sets.length;
      }
    });
    const empties = Array.from({ length: firstDowN }, () => `<div class="calendar-cell empty"></div>`).join('');
    const cells = Array.from({ length: daysN }, (_, i) => {
      const day = i + 1;
      const iso = `${ctx.year}-${String(ctx.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const lvl = lvlFor(byDate[iso] || 0);
      const isToday = today.getFullYear() === ctx.year && today.getMonth() === ctx.month && today.getDate() === day;
      return `<button class="calendar-cell lvl-${lvl} ${isToday ? 'today' : ''}" data-day-iso="${iso}">${fmtNum(day)}</button>`;
    }).join('');
    return empties + cells;
  }

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('calendar_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('library')}</div>
      <h1 class="page-title">${t('calendar_title')}</h1>
      <p class="page-subtitle">${t('calendar_subtitle')}</p>
    </div>

    <div class="calendar-head">
      <button class="calendar-nav-btn" id="cal-prev">${icon('back', 18)}</button>
      <div class="calendar-month-label" id="cal-month-label">${escapeHtml(monthLabel)}</div>
      <button class="calendar-nav-btn" id="cal-next">${icon('chevronRight', 18)}</button>
    </div>

    <div class="calendar-dow-row">${dowLabels}</div>
    <div class="calendar-grid" id="calendar-grid">${buildGrid()}</div>

    <div class="calendar-legend">
      <span>—</span>
      <span class="calendar-legend-dot" style="background:var(--surface-2)"></span>
      <span class="calendar-legend-dot" style="background:rgba(var(--accent-rgb),0.18)"></span>
      <span class="calendar-legend-dot" style="background:rgba(var(--accent-rgb),0.32)"></span>
      <span class="calendar-legend-dot" style="background:rgba(var(--accent-rgb),0.55)"></span>
      <span class="calendar-legend-dot" style="background:var(--accent)"></span>
      <span>+</span>
    </div>
  `;

  function repaintMonth() {
    const label = $('#cal-month-label', el);
    const grid = $('#calendar-grid', el);
    if (label) label.textContent = new Date(ctx.year, ctx.month, 1)
      .toLocaleDateString((DB.prefs.get().lang || 'en') === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' });
    if (grid) grid.innerHTML = buildGrid();
  }

  $('#cal-prev', el).addEventListener('click', () => {
    if (ctx.month === 0) { ctx.month = 11; ctx.year -= 1; } else ctx.month -= 1;
    repaintMonth();
  });
  $('#cal-next', el).addEventListener('click', () => {
    if (ctx.month === 11) { ctx.month = 0; ctx.year += 1; } else ctx.month += 1;
    repaintMonth();
  });

  // Delegated — cells are rebuilt on month nav, one listener survives.
  $('#calendar-grid', el).addEventListener('click', (e) => {
    const cell = e.target.closest('[data-day-iso]');
    if (cell) openCalendarDayModal(cell.dataset.dayIso);
  });
}

function openCalendarDayModal(iso) {
  const sessions = DB.sessions.listAll().filter((s) => s.date === iso);
  const cardio = DB.cardio.list().filter((c) => c.date === iso);
  const sleep = DB.sleep.list().find((s) => s.date === iso);
  const exById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));

  let html = '';
  if (sessions.length > 0) {
    html += `<div class="section-title" style="margin-top:0">${t('workouts_day')}</div>`;
    html += '<div class="data-list">';
    sessions.forEach((s) => {
      const ex = exById[s.exerciseId];
      const totalSets = s.sets.length;
      const maxW = Math.max(0, ...s.sets.map((x) => x.weight));
      html += `
        <div class="data-row">
          <div class="data-icon workout">${icon('dumbbell', 18)}</div>
          <div class="data-main">
            <div class="data-title">${escapeHtml(ex ? ex.name : '?')}</div>
            <div class="data-meta">
              <span class="num">${fmtNum(totalSets)} ${t('sets').toLowerCase()}</span>
              ${maxW > 0 ? `<span class="dot-sep"></span><span class="num">${fmtWeight(maxW)} ${unitLabel()}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  if (cardio.length > 0) {
    html += `<div class="section-title">${t('cardio_day')}</div><div class="data-list">`;
    cardio.forEach((c) => {
      html += `
        <div class="data-row">
          <div class="data-icon ${escapeHtml(c.type)}">${icon(c.type === 'cycling' ? 'bike' : c.type === 'walking' ? 'walk' : 'treadmill', 18)}</div>
          <div class="data-main">
            <div class="data-title">${escapeHtml(t(c.type))}</div>
            <div class="data-meta">
              <span class="num">${fmtNum(c.duration)} ${t('minutes').toLowerCase()}</span>
              <span class="dot-sep"></span>
              <span class="num">${fmtNum(c.calories)} ${t('cal')}</span>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  if (sleep) {
    html += `<div class="section-title">${t('sleep_day')}</div><div class="data-list">`;
    html += `
      <div class="data-row">
        <div class="data-icon sleep">${icon('bed', 18)}</div>
        <div class="data-main">
          <div class="data-title">${formatTime12(sleep.sleepTime)} → ${formatTime12(sleep.wakeTime)}</div>
          <div class="data-meta"><span class="num">${formatDuration(sleep.durationMinutes)}</span></div>
        </div>
      </div>
    `;
    html += '</div>';
  }

  if (!html) {
    html = emptyState({ iconName: 'calendar', title: t('no_activity_day'), text: '' });
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${formatDate(iso)}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    ${html}
  `);
}

// ==========================================================================
// SUPPLEMENTS VIEW
// ==========================================================================
const SUPP_COLORS = ['#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#a855f7', '#fb923c', '#60a5fa', '#f87171'];

function renderSupplements(el) {
  const list = DB.supplements.list();
  const todayIso = todayISO();

  // One supplement row — rebuilt in place on toggle (class + streak change),
  // so a tap never re-renders the whole list or resets the scroll position.
  function suppRowHtml(s) {
    const taken = DB.supplements.isTaken(s.id, todayIso);
    const streak = DB.supplements.streak(s.id);
    return `
      <div class="supp-row ${taken ? 'taken' : ''}" data-supp-row="${s.id}">
        <div class="supp-color" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(s.color) ? s.color : '#888888'}"></div>
        <div class="supp-main">
          <div class="supp-name">${escapeHtml(s.name)}</div>
          ${s.dose ? `<div class="supp-dose">${escapeHtml(s.dose)}</div>` : ''}
          ${streak > 0 ? `<div class="supp-streak">${icon('flame', 12)} ${fmtNum(streak)} ${t('days_ago').replace('ago', '').trim() || t('streak_days')} ${t('streak')}</div>` : ''}
        </div>
        <button class="supp-toggle ${taken ? 'taken' : ''}" data-toggle-supp="${s.id}" aria-label="${escapeHtml(taken ? t('taken') : t('not_taken'))}">
          ${icon(taken ? 'check' : 'plus', 22)}
        </button>
        <div class="data-actions">
          <button class="icon-btn" data-edit-supp="${s.id}">${icon('edit', 15)}</button>
        </div>
      </div>
    `;
  }

  const anyUntaken = list.some((s) => !DB.supplements.isTaken(s.id, todayIso));

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('supplements_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${escapeHtml(formatDate(todayIso))}</div>
      <h1 class="page-title">${t('supplements_title')}</h1>
      <p class="page-subtitle">${t('supplements_subtitle')}</p>
    </div>

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('supplements_title')}</div>
      <div style="display:flex;gap:8px">
        ${list.length > 0 ? `<button class="btn btn-ghost" id="take-all-btn" ${anyUntaken ? '' : 'disabled style="opacity:.5"'}>${icon('check', 16)} ${t('take_all')}</button>` : ''}
        <button class="btn btn-primary" id="add-supp-btn">${icon('plus', 16)} ${t('new_supplement')}</button>
      </div>
    </div>

    <div class="data-list" id="supp-list">
      ${list.length === 0
        ? emptyState({ iconName: 'zap', title: t('no_supplements'), text: t('no_supplements_text') })
        : list.map(suppRowHtml).join('')
      }
    </div>
  `;

  // Replace ONE supplement's row DOM in place from current DB state.
  function refreshSuppRow(id) {
    const row = el.querySelector(`[data-supp-row="${id}"]`);
    const s = DB.supplements.list().find((x) => x.id === id);
    if (!row || !s) return;
    row.outerHTML = suppRowHtml(s);
  }

  function syncTakeAllBtn() {
    const btn = $('#take-all-btn', el);
    if (!btn) return;
    const untaken = DB.supplements.list().some((s) => !DB.supplements.isTaken(s.id, todayIso));
    btn.disabled = !untaken;
    btn.style.opacity = untaken ? '' : '.5';
  }

  $('#add-supp-btn', el).addEventListener('click', () => openSupplementModal());

  $('#take-all-btn', el)?.addEventListener('click', () => {
    DB.supplements.list().forEach((s) => {
      if (!DB.supplements.isTaken(s.id, todayIso)) {
        DB.supplements.setTaken(s.id, todayIso, true);
        refreshSuppRow(s.id);
      }
    });
    syncTakeAllBtn();
    showToast(t('all_taken'));
  });

  // Delegated toggle + edit — in-place row refresh, no full re-render.
  $('#supp-list', el).addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-supp]');
    if (toggle) {
      const id = toggle.dataset.toggleSupp;
      const isTaken = DB.supplements.isTaken(id, todayIso);
      DB.supplements.setTaken(id, todayIso, !isTaken);
      refreshSuppRow(id);
      syncTakeAllBtn();
      showToast(!isTaken ? t('taken') : t('not_taken'));
      return;
    }
    const edit = e.target.closest('[data-edit-supp]');
    if (edit) openSupplementModal(edit.dataset.editSupp);
  });
}

function openSupplementModal(id = null) {
  const existing = id ? DB.supplements.list().find((x) => x.id === id) : null;
  let pickedColor = existing ? existing.color : SUPP_COLORS[0];

  const swatches = SUPP_COLORS.map((c) => `
    <button type="button" class="color-swatch ${pickedColor === c ? 'active' : ''}" style="background:${c}" data-color="${c}"></button>
  `).join('');

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_supplement') : t('new_supplement')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('supplement_name')}</label>
      <input type="text" id="supp-name" placeholder="${t('ph_supplement_name')}" value="${existing ? escapeHtml(existing.name) : ''}" autofocus>
    </div>

    <div class="form-group">
      <label class="form-label">${t('dose')}</label>
      <input type="text" id="supp-dose" placeholder="5 g" value="${existing ? escapeHtml(existing.dose || '') : ''}">
    </div>

    <div class="form-group">
      <label class="form-label">${t('color')}</label>
      <div class="color-swatches" id="color-swatches">${swatches}</div>
    </div>

    <div class="form-actions">
      ${existing ? `<button type="button" class="btn btn-danger" id="supp-delete">${icon('trash', 14)}</button>` : ''}
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="supp-save">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  $('#color-swatches').addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (!sw) return;
    pickedColor = sw.dataset.color;
    $('#color-swatches').querySelectorAll('[data-color]').forEach((x) =>
      x.classList.toggle('active', x.dataset.color === pickedColor)
    );
  });

  $('#supp-save').addEventListener('click', () => {
    const name = $('#supp-name').value.trim();
    const dose = $('#supp-dose').value.trim();
    if (!name) { showToast(t('enter_name')); return; }
    if (existing) {
      DB.supplements.update(existing.id, { name, dose, color: pickedColor });
      showToast(t('updated'));
    } else {
      DB.supplements.add({ name, dose, color: pickedColor });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });

  if (existing) {
    $('#supp-delete').addEventListener('click', () => {
      confirmDialog({
        title: t('delete_supplement_q'),
        text: t('delete_supplement_text'),
        onConfirm: () => {
          DB.supplements.remove(existing.id);
          closeModal();
          showToast(t('deleted'));
          renderView(currentView);
        },
      });
    });
  }
}

// ==========================================================================
// FOOD LOG VIEW
// ==========================================================================
function renderFoodLog(el) {
  const ctx = viewContext.foodLog || { date: todayISO() };
  viewContext.foodLog = ctx;

  const entries = DB.foodLogs.listForDate(ctx.date);
  const totals = DB.foodLogs.totalsForDate(ctx.date);
  const isToday = ctx.date === todayISO();

  const dayLabel = isToday ? t('today_totals') : formatDate(ctx.date);

  // One food-log row (also used when quick-add appends a single row live).
  function foodRowHtml(e) {
    const m = e.servings || 1;
    return `
      <div class="food-log-row" data-food-row="${e.id}">
        <div class="food-log-main">
          <div class="food-log-name">
            ${escapeHtml(e.name)}
            ${m !== 1 ? `<span class="food-log-x num">× ${fmtNum(m)}</span>` : ''}
          </div>
          <div class="food-log-meta">
            <span><span class="num">${fmtNum(Math.round(e.calories * m))}</span> ${t('cal')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.protein * m * 10) / 10)}</span>g ${t('protein_label')}</span>
            <span class="dot-sep"></span>
            <span><span class="num">${fmtNum(Math.round(e.carbs * m * 10) / 10)}</span>g ${t('carbs_label')}</span>
            ${e.fat ? `<span class="dot-sep"></span><span><span class="num">${fmtNum(Math.round(e.fat * m * 10) / 10)}</span>g ${t('fat_label')}</span>` : ''}
          </div>
        </div>
        <button class="icon-btn danger" data-del-food="${e.id}">${icon('trash', 15)}</button>
      </div>
    `;
  }
  const items = entries.map(foodRowHtml).join('');

  // Quick-add rail: most-logged foods, minus ones already on this day.
  const frequent = DB.foodLogs.frequent(6, ctx.date);
  const quickAddHtml = frequent.length === 0 ? '' : `
    <div class="section-title" style="margin:18px 0 10px">${t('quick_add')}</div>
    <div class="quick-add-rail" id="quick-add-rail">
      ${frequent.map((f, i) => `
        <button class="quick-add-chip" data-quick-idx="${i}">
          <span class="quick-add-name">${escapeHtml(f.name)}</span>
          <span class="quick-add-cal num">${fmtNum(Math.round(f.calories * (f.servings || 1)))} ${t('cal')}</span>
        </button>
      `).join('')}
    </div>
  `;

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('food_log_title')}</div>
    </div>

    <div class="page-header">
      <h1 class="page-title">${t('food_log_title')}</h1>
      <p class="page-subtitle">${t('food_log_subtitle')}</p>
    </div>

    <div class="day-nav">
      <button class="calendar-nav-btn" id="day-prev" aria-label="${t('prev_day')}">${icon('back', 18)}</button>
      <div class="day-nav-label">${escapeHtml(dayLabel)}</div>
      <button class="calendar-nav-btn" id="day-next" aria-label="${t('next_day')}" ${isToday ? 'disabled style="opacity:0.4"' : ''}>${icon('chevronRight', 18)}</button>
    </div>

    <div class="macro-totals">
      <div class="macro-total cal">
        <div class="macro-total-label">${t('calories')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.calories))}<span class="macro-total-unit">${t('cal')}</span></div>
      </div>
      <div class="macro-total pro">
        <div class="macro-total-label">${t('protein_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.protein * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
      <div class="macro-total carb">
        <div class="macro-total-label">${t('carbs_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round(totals.carbs * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
      <div class="macro-total fat">
        <div class="macro-total-label">${t('fat_label')}</div>
        <div class="macro-total-value num">${fmtNum(Math.round((totals.fat || 0) * 10) / 10)}<span class="macro-total-unit">g</span></div>
      </div>
    </div>

    ${quickAddHtml}

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('food_log_title')}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="ai-food-btn">${icon('zap', 16)} ${t('ai_chat_btn')}</button>
        <button class="btn btn-primary" id="add-foodlog-btn">${icon('plus', 16)} ${t('add_food_log')}</button>
      </div>
    </div>

    <div class="data-list" id="food-log-list" style="gap:6px">
      ${entries.length === 0
        ? emptyState({ iconName: 'apple', title: t('no_food_logged'), text: t('no_food_logged_text') })
        : items
      }
    </div>
  `;

  $('#day-prev', el).addEventListener('click', () => {
    const d = new Date(ctx.date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    ctx.date = d.toISOString().slice(0, 10);
    renderFoodLog(el);
  });
  $('#day-next', el).addEventListener('click', () => {
    if (isToday) return;
    const d = new Date(ctx.date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    ctx.date = d.toISOString().slice(0, 10);
    renderFoodLog(el);
  });

  $('#add-foodlog-btn', el).addEventListener('click', () => openFoodPickerModal(ctx.date));
  $('#ai-food-btn', el)?.addEventListener('click', () => {
    if (window.FoodAI) window.FoodAI.open(ctx.date);
  });

  // Refresh only the macro-totals block from current DB state.
  function refreshTotals() {
    const tt = DB.foodLogs.totalsForDate(ctx.date);
    const set = (sel, v) => { const n = $(sel, el); if (n) n.childNodes[0].nodeValue = v; };
    set('.macro-total.cal .macro-total-value', fmtNum(Math.round(tt.calories)));
    set('.macro-total.pro .macro-total-value', fmtNum(Math.round(tt.protein * 10) / 10));
    set('.macro-total.carb .macro-total-value', fmtNum(Math.round(tt.carbs * 10) / 10));
    set('.macro-total.fat .macro-total-value', fmtNum(Math.round((tt.fat || 0) * 10) / 10));
  }

  // Quick-add: one tap re-logs a frequent food with its last-used serving, and
  // appends a single row + updates totals — no full view re-render (no flash).
  $('#quick-add-rail', el)?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-quick-idx]');
    if (!chip) return;
    const src = frequent[Number(chip.dataset.quickIdx)];
    if (!src) return;
    const entry = DB.foodLogs.add(ctx.date, {
      foodId: src.foodId, name: src.name, servings: src.servings,
      calories: src.calories, protein: src.protein, carbs: src.carbs, fat: src.fat,
      source: 'quick',
    });
    // Drop the empty-state placeholder if this is the first row of the day.
    const list = $('#food-log-list', el);
    if (list.querySelector('.empty')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', foodRowHtml(entry));
    refreshTotals();
    chip.remove(); // it's now on today's list — stop suggesting it
    showToast(t('food_added'));
  });

  // Delegated delete — append/remove keep working without rebinding.
  $('#food-log-list', el).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-food]');
    if (!btn) return;
    DB.foodLogs.remove(ctx.date, btn.dataset.delFood);
    const row = btn.closest('[data-food-row]');
    if (row) row.remove();
    if (!$('#food-log-list', el).querySelector('[data-food-row]')) {
      $('#food-log-list', el).innerHTML = emptyState({ iconName: 'apple', title: t('no_food_logged'), text: t('no_food_logged_text') });
    }
    refreshTotals();
    showToast(t('food_removed'));
  });
}

function openFoodPickerModal(date) {
  const foods = DB.foods.list();
  if (foods.length === 0) {
    openModal(`
      <div class="modal-header">
        <div><div class="modal-title">${t('empty_food_list')}</div></div>
        <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
      </div>
      <p style="color:var(--text-mute);font-size:13px;margin-bottom:18px">${t('empty_food_list_text')}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
        <button type="button" class="btn btn-primary" id="goto-food-btn">${t('go_to_food')}</button>
      </div>
    `);
    $('#goto-food-btn').addEventListener('click', () => { closeModal(); navigate('food'); });
    return;
  }

  let pickerQuery = '';
  function renderList() {
    const list = pickerQuery
      ? foods.filter((f) => f.name.toLowerCase().includes(pickerQuery.toLowerCase()))
      : foods;
    const container = $('#food-picker-list');
    if (!container) return;
    container.innerHTML = list.map((f) => `
      <button type="button" class="picker-row" data-pick-food="${f.id}">
        <span class="picker-row-cat" style="background:var(--cat-arms)"></span>
        <span class="picker-row-name">
          ${escapeHtml(f.name)}
          ${f.serving ? `<span style="color:var(--text-mute);font-weight:500;font-size:11px"> · ${escapeHtml(f.serving)}</span>` : ''}
        </span>
        <span style="font-size:11px;color:var(--text-mute);font-weight:600" class="num">${fmtNum(f.calories)} ${t('cal')}</span>
      </button>
    `).join('');

    container.querySelectorAll('[data-pick-food]').forEach((b) =>
      b.addEventListener('click', () => {
        const food = foods.find((x) => x.id === b.dataset.pickFood);
        if (food) openFoodLogEntryModal(date, food);
      })
    );
  }

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${t('pick_from_library')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <div class="search-wrap">
        ${icon('search', 18)}
        <input type="search" id="food-picker-search" placeholder="${t('search_foods')}">
      </div>
    </div>

    <div class="picker-list" id="food-picker-list"></div>
  `);

  renderList();
  $('#food-picker-search').addEventListener('input', (e) => {
    pickerQuery = e.target.value;
    renderList();
  });
}

function openFoodLogEntryModal(date, food) {
  let servings = 1;
  let calories = food.calories;
  let protein = food.protein;
  let carbs = food.carbs;

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${escapeHtml(food.name)}</div>
        ${food.serving ? `<div class="modal-subtitle">${escapeHtml(food.serving)}</div>` : ''}
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('servings')}</label>
      <input type="number" inputmode="decimal" id="fl-servings" step="0.5" min="0.5" value="1">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('calories_per_serving')}</label>
        <input type="number" inputmode="decimal" id="fl-cal" step="1" min="0" value="${food.calories}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('protein_per_serving')}</label>
        <input type="number" inputmode="decimal" id="fl-pro" step="0.1" min="0" value="${food.protein}">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">${t('carbs_per_serving')}</label>
      <input type="number" inputmode="decimal" id="fl-carb" step="0.1" min="0" value="${food.carbs}">
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="fl-save">${t('add_to_log')}</button>
    </div>
  `);

  $('#fl-save').addEventListener('click', () => {
    servings = Number($('#fl-servings').value) || 1;
    calories = Number($('#fl-cal').value) || 0;
    protein = Number($('#fl-pro').value) || 0;
    carbs = Number($('#fl-carb').value) || 0;
    DB.foodLogs.add(date, {
      foodId: food.id,
      name: food.name,
      servings, calories, protein, carbs,
    });
    closeModal();
    showToast(t('food_added'));
    renderView(currentView);
  });
}


// ==========================================================================
// Initial boot
// ==========================================================================
// ==========================================================================
// Cloud auth gate (Supabase) — optional; app stays fully usable offline.
// ==========================================================================
let authMode = 'in'; // 'in' | 'up'

function refreshAfterSync() {
  const prefs = DB.prefs.get();
  applyTheme(prefs.theme || 'dark');
  applyLang(prefs.lang || 'en');
  renderView(currentView || 'home');
}

function hideAuthGate() {
  const g = document.getElementById('auth-gate');
  if (g) g.remove();
}

function showAuthGate(mode) {
  authMode = mode || 'in';
  hideAuthGate();
  const up = authMode === 'up';
  const gate = document.createElement('div');
  gate.id = 'auth-gate';
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-title">THE VAULT</div>
      <div class="auth-seg">
        <button class="auth-seg-btn ${up ? '' : 'active'}" data-mode="in">${t('auth_signin')}</button>
        <button class="auth-seg-btn ${up ? 'active' : ''}" data-mode="up">${t('auth_signup')}</button>
      </div>
      <div class="auth-sub">${up ? t('auth_sub_up') : t('auth_sub_in')}</div>
      <input type="email" id="auth-email" class="auth-input" placeholder="${t('auth_email')}" autocomplete="email" inputmode="email">
      <input type="password" id="auth-password" class="auth-input" placeholder="${t('auth_password')}" autocomplete="${up ? 'new-password' : 'current-password'}">
      <div class="auth-err" id="auth-err" role="alert"></div>
      <button class="btn btn-primary btn-block" id="auth-submit">${up ? t('auth_signup') : t('auth_signin')}</button>
      ${up ? '' : `<button class="auth-toggle" id="auth-forgot">${t('auth_forgot')}</button>`}
      <button class="auth-skip" id="auth-skip">${t('auth_skip')}</button>
    </div>`;
  document.body.appendChild(gate);

  const err = (msg) => { const e = document.getElementById('auth-err'); if (e) e.textContent = msg || ''; };
  const submit = document.getElementById('auth-submit');

  const run = async () => {
    const email = (document.getElementById('auth-email').value || '').trim();
    const pw = document.getElementById('auth-password').value || '';
    if (!email || !pw) { err(t('auth_err_fields')); return; }
    if (up && pw.length < 6) { err(t('auth_pw_short')); return; }
    err('');
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = t('auth_signing');
    try {
      const res = up ? await Cloud.signUp(email, pw) : await Cloud.signIn(email, pw);
      if (res.error) {
        err(translateAuthError(res.error));
        submit.disabled = false; submit.textContent = label;
        return;
      }
      if (up && !res.session) {
        // Email confirmation is required — no session yet.
        err(''); submit.disabled = false; submit.textContent = label;
        showToast(t('auth_signup_check_email'));
        showAuthGate('in');
        return;
      }
      await afterLogin();
    } catch (e) {
      err(translateAuthError((e && e.message) || ''));
      submit.disabled = false; submit.textContent = label;
    }
  };

  submit.addEventListener('click', run);
  document.getElementById('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  gate.querySelectorAll('.auth-seg-btn').forEach((b) =>
    b.addEventListener('click', () => { if (b.dataset.mode !== authMode) showAuthGate(b.dataset.mode); })
  );
  document.getElementById('auth-skip').addEventListener('click', () => { hideAuthGate(); });
  const forgot = document.getElementById('auth-forgot');
  if (forgot) forgot.addEventListener('click', () => showForgotPassword(document.getElementById('auth-email').value));
}

// Mandatory unique username. Once a user is logged in AND online, they MUST pick
// a handle before using the app — even already-registered users. Enforced by a
// blocking gate (no skip). No-ops when offline or logged out so a solo/offline
// user is never locked out.
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
async function ensureUsername() {
  if (!window.Cloud || !Cloud.configured || !Cloud.configured() || !Cloud.getUsername) return;
  let info;
  try { info = await Cloud.getUsername(); } catch (_) { return; }
  if (!info || info.offline) return;   // couldn't verify → don't lock anyone out
  if (info.username) return;           // already chosen
  showUsernameGate();
}

function showUsernameGate() {
  if (document.getElementById('username-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'username-gate';
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-title">${t('username_title')}</div>
      <div class="auth-sub">${t('username_sub')}</div>
      <div class="uname-field">
        <span class="uname-at">@</span>
        <input type="text" id="uname-input" class="auth-input" placeholder="${t('username_ph')}"
               autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20">
      </div>
      <div class="uname-rules">${t('username_rules')}</div>
      <div class="auth-err" id="uname-msg" role="alert"></div>
      <button class="btn btn-primary btn-block" id="uname-save" disabled>${t('username_save')}</button>
    </div>`;
  document.body.appendChild(gate);

  const input = document.getElementById('uname-input');
  const save = document.getElementById('uname-save');
  const msgEl = document.getElementById('uname-msg');
  const msg = (txt, cls) => { msgEl.textContent = txt || ''; msgEl.className = 'auth-err' + (cls ? ' ' + cls : ''); };
  let timer = null, valid = false;
  const setValid = (v) => { valid = v; save.disabled = !v; };

  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (v !== input.value) input.value = v;
    setValid(false);
    clearTimeout(timer);
    if (!v) { msg(''); return; }
    if (!USERNAME_RE.test(v)) { msg(t('username_invalid'), 'err'); return; }
    msg(t('username_checking'), '');
    timer = setTimeout(async () => {
      const r = await Cloud.checkUsername(v);
      if (input.value.trim() !== v) return;            // typed more since
      if (r.offline) { msg(t('auth_err_network'), 'err'); return; }
      if (r.available) { msg(t('username_available_msg'), 'ok'); setValid(true); }
      else { msg(t('username_taken'), 'err'); }
    }, 350);
  });

  const claim = async () => {
    const v = input.value.trim();
    if (!USERNAME_RE.test(v)) { msg(t('username_invalid'), 'err'); return; }
    save.disabled = true;
    const label = save.textContent;
    save.textContent = t('auth_signing');
    const r = await Cloud.setUsername(v);
    if (r.ok) { gate.remove(); showToast(t('username_saved')); return; }
    save.textContent = label; save.disabled = false;
    if (r.taken) { msg(t('username_taken'), 'err'); setValid(false); }
    else if (r.error === 'offline') { msg(t('auth_err_network'), 'err'); }
    else { msg(t('username_invalid'), 'err'); }
  };
  save.addEventListener('click', claim);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && valid) claim(); });
  setTimeout(() => input.focus(), 60);
}

function showForgotPassword(prefillEmail) {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('auth_reset_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div class="confirm-text" style="margin-bottom:12px">${t('auth_reset_sub')}</div>
    <input type="email" id="reset-email" class="auth-input" placeholder="${t('auth_email')}" value="${escapeHtml(prefillEmail || '')}" autocomplete="email" inputmode="email">
    <div class="auth-err" id="reset-err"></div>
    <button class="btn btn-primary btn-block" id="reset-send">${t('auth_reset_send')}</button>
  `, { variant: 'confirm' });
  const err = (m) => { const e = overlay.querySelector('#reset-err'); if (e) e.textContent = m || ''; };
  const btn = overlay.querySelector('#reset-send');
  btn.addEventListener('click', async () => {
    const email = (overlay.querySelector('#reset-email').value || '').trim();
    if (!email) { err(t('auth_err_email')); return; }
    err(''); btn.disabled = true; btn.textContent = t('auth_signing');
    try {
      const res = await Cloud.resetPassword(email);
      if (res.error) { err(translateAuthError(res.error)); btn.disabled = false; btn.textContent = t('auth_reset_send'); return; }
      closeModal();
      showToast(t('auth_reset_sent'));
    } catch (e) {
      err(translateAuthError((e && e.message) || '')); btn.disabled = false; btn.textContent = t('auth_reset_send');
    }
  });
}

// Map common Supabase auth errors to friendly localized text.
function translateAuthError(msg) {
  const m = String(msg).toLowerCase();
  if (m.includes('invalid login')) return t('auth_err_invalid');
  if (m.includes('already registered') || m.includes('already been registered')) return t('auth_err_exists');
  if (m.includes('password')) return t('auth_pw_short');
  if (m.includes('email')) return t('auth_err_email');
  if (m.includes('network') || m.includes('fetch')) return t('auth_err_network');
  return t('auth_err_generic');
}

async function afterLogin() {
  // How we reveal the app after a valid sign-in depends on whether THIS device
  // already holds the user's data:
  //   • Device already has data  → reveal immediately, reconcile in background
  //     (fast; there is no empty state to worry the user).
  //   • Fresh / empty device     → KEEP the gate up until the cloud pull lands,
  //     so the user sees their real data appear, NEVER a scary empty home that
  //     could make them panic-sync. (Blocking here is the safe default; the
  //     speed win only applies when it's risk-free.)
  const hasLocal = !!(Cloud.localHasData && Cloud.localHasData());
  if (hasLocal) { hideAuthGate(); showToast(t('syncing')); }
  ensureUsername();                                  // fire-and-forget
  if (Cloud.touchLastSeen) Cloud.touchLastSeen();
  enforceAccountStatus();
  try {
    const r = await Cloud.resolveOnLogin();
    if (r === 'conflict') { hideAuthGate(); showConflictDialog(); return; }
    hideAuthGate();
    refreshAfterSync();
    showToast(t('synced'));
    syncExerciseImages(); // back up / heal custom images, best-effort
  } catch (_) {
    hideAuthGate(); // never trap the user behind the gate on a transient error
  }
}

function showConflictDialog() {
  const overlay = openModal(`
    <div class="confirm-title">${t('conflict_title')}</div>
    <div class="confirm-text">${t('conflict_text')}</div>
    <div class="form-actions" style="flex-direction:column;gap:8px">
      <button type="button" class="btn btn-primary btn-block" data-keep="cloud">${t('conflict_cloud')}</button>
      <button type="button" class="btn btn-ghost btn-block" data-keep="local">${t('conflict_local')}</button>
    </div>
  `, { variant: 'confirm' });
  const finish = () => { closeModal(); hideAuthGate(); refreshAfterSync(); showToast(t('synced')); ensureUsername(); };
  overlay.querySelector('[data-keep="cloud"]').addEventListener('click', async () => { await Cloud.chooseCloud(); finish(); });
  overlay.querySelector('[data-keep="local"]').addEventListener('click', async () => { await Cloud.chooseLocal(); finish(); });
}

function showChangePassword() {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('change_password')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <input type="password" id="cpw-new" class="auth-input" placeholder="${t('change_password_new')}" autocomplete="new-password">
    <input type="password" id="cpw-confirm" class="auth-input" placeholder="${t('change_password_confirm')}" autocomplete="new-password">
    <div class="auth-err" id="cpw-err"></div>
    <button class="btn btn-primary btn-block" id="cpw-save">${t('save')}</button>
  `, { variant: 'confirm' });
  const err = (m) => { const e = overlay.querySelector('#cpw-err'); if (e) e.textContent = m || ''; };
  const btn = overlay.querySelector('#cpw-save');
  btn.addEventListener('click', async () => {
    const pw = overlay.querySelector('#cpw-new').value || '';
    const pw2 = overlay.querySelector('#cpw-confirm').value || '';
    if (pw.length < 6) { err(t('auth_pw_short')); return; }
    if (pw !== pw2) { err(t('change_password_mismatch')); return; }
    err(''); btn.disabled = true; btn.textContent = t('auth_signing');
    try {
      const res = await Cloud.changePassword(pw);
      if (res.error) { err(translateAuthError(res.error)); btn.disabled = false; btn.textContent = t('save'); return; }
      closeModal();
      showToast(t('change_password_done'));
    } catch (e) {
      err(translateAuthError((e && e.message) || '')); btn.disabled = false; btn.textContent = t('save');
    }
  });
}

function showFeedback() {
  const overlay = openModal(`
    <div class="modal-header">
      <div class="modal-title">${t('feedback_title')}</div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>
    <div class="confirm-text" style="margin-bottom:12px">${t('feedback_sub')}</div>
    <textarea id="fb-msg" class="auth-input" rows="4" style="resize:vertical;min-height:96px" placeholder="${t('feedback_ph')}"></textarea>
    <div class="auth-err" id="fb-err"></div>
    <button class="btn btn-primary btn-block" id="fb-send">${t('feedback_send')}</button>
  `, { variant: 'confirm' });
  const err = (m) => { const e = overlay.querySelector('#fb-err'); if (e) e.textContent = m || ''; };
  const btn = overlay.querySelector('#fb-send');
  setTimeout(() => { const ta = overlay.querySelector('#fb-msg'); if (ta) ta.focus(); }, 60);
  btn.addEventListener('click', async () => {
    const msg = (overlay.querySelector('#fb-msg').value || '').trim();
    if (!msg) { err(t('feedback_empty')); return; }
    if (!window.Cloud || !Cloud.configured() || !Cloud.submitFeedback) { err(t('auth_err_network')); return; }
    err(''); btn.disabled = true; btn.textContent = t('auth_signing');
    try {
      const res = await Cloud.submitFeedback(msg, VAULT_BUILD);
      if (res && res.ok) { closeModal(); showToast(t('feedback_sent')); return; }
      err(res && res.error === 'offline' ? t('auth_err_network') : t('auth_err_generic'));
    } catch (_) { err(t('auth_err_generic')); }
    btn.disabled = false; btn.textContent = t('feedback_send');
  });
}

// Account status enforcement. An admin can disable/ban an account from the
// control panel; on boot the app reads the user's own flags and, if the account
// is not active, shows a blocking screen. Fails OPEN (never locks out on a
// network error / before any flag is set) — the default is an active user.
async function enforceAccountStatus() {
  if (!window.Cloud || !Cloud.configured() || !Cloud.getMyFlags) return;
  let flags;
  try { flags = await Cloud.getMyFlags(); } catch (_) { return; }
  if (!flags || flags.offline || flags.status === 'active') return;
  showBlockedGate(flags.status, flags.reason);
}

function showBlockedGate(status, reason) {
  if (document.getElementById('blocked-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'blocked-gate';
  gate.className = 'auth-gate';
  const msg = status === 'banned' ? t('account_banned_msg') : t('account_disabled_msg');
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-title">${t('account_blocked_title')}</div>
      <div class="auth-sub">${escapeHtml(msg)}</div>
      ${reason ? `<div class="uname-rules">${escapeHtml(reason)}</div>` : ''}
    </div>`;
  document.body.appendChild(gate);
}

async function populateAccount(el) {
  const body = el.querySelector('#account-body');
  if (!body) return;
  await Cloud.ensureSdk(); // load the Supabase SDK on demand
  let email = null;
  try { email = await Cloud.currentEmail(); } catch (_) {}
  if (email) {
    body.innerHTML = `
      <div class="settings-action-row" style="cursor:default">
        <div class="settings-action-icon">${icon('globe', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${escapeHtml(email)}</div>
          <div class="settings-action-sub">${t('account_synced_sub')}</div>
        </div>
      </div>
      <button class="settings-action-row" id="sync-now-btn">
        <div class="settings-action-icon">${icon('refresh', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('sync_now')}</div>
          <div class="settings-action-sub">${t('sync_now_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row" id="change-pw-btn">
        <div class="settings-action-icon">${icon('settings', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('change_password')}</div>
          <div class="settings-action-sub">${t('change_password_sub')}</div>
        </div>
      </button>
      <button class="settings-action-row" id="logout-btn" style="color:var(--red)">
        <div class="settings-action-icon" style="background:var(--red-bg);color:var(--red)">${icon('back', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('logout')}</div>
          <div class="settings-action-sub">${t('logout_sub')}</div>
        </div>
      </button>`;
    $('#change-pw-btn', el)?.addEventListener('click', showChangePassword);
    $('#sync-now-btn', el)?.addEventListener('click', async () => {
      showToast(t('auth_signing'));
      try {
        const r = await Cloud.bootSync();
        if (r === 'pulled') refreshAfterSync();
        showToast(t('synced'));
      } catch (_) { showToast(t('auth_err_network')); }
    });
    $('#logout-btn', el)?.addEventListener('click', () => {
      confirmDialog({
        title: t('logout'), text: t('logout_confirm'), confirmLabel: t('logout'),
        onConfirm: async () => { await Cloud.signOut(); showAuthGate('in'); },
      });
    });
  } else {
    body.innerHTML = `
      <button class="settings-action-row" id="signin-btn">
        <div class="settings-action-icon">${icon('globe', 18)}</div>
        <div class="settings-action-main">
          <div class="settings-action-title">${t('auth_not_signed')}</div>
          <div class="settings-action-sub">${t('auth_signin_sub')}</div>
        </div>
      </button>`;
    $('#signin-btn', el)?.addEventListener('click', () => showAuthGate('in'));
  }
}

// ==========================================================================
// PERSONAL RECORDS VIEW
// ==========================================================================
// Every logged session for ONE muscle group, newest first, grouped by day.
// Reached by tapping a cell in the home muscle-focus heatmap: the cell shows a
// 7-day count, this shows the whole history behind it (the user asked for ALL
// the sessions, not just the ones inside the heatmap's window).
function renderMuscleSessions(el) {
  const cat = viewContext.muscleCat || 'Chest';
  const exById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const sessions = DB.sessions.listAll()
    .filter((s) => { const ex = exById[s.exerciseId]; return ex && ex.category === cat; })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const lang = DB.prefs.get().lang || 'en';
  const byDate = {};
  sessions.forEach((s) => { (byDate[s.date] = byDate[s.date] || []).push(s); });

  const groupsHtml = Object.keys(byDate).map((date) => {
    const label = new Date(date + 'T00:00:00').toLocaleDateString(
      lang === 'ar' ? 'ar-u-nu-latn' : 'en-US',
      { weekday: 'long', day: 'numeric', month: 'long' }
    );
    const cards = byDate[date].map((s) => {
      const ex = exById[s.exerciseId];
      const sets = (s.sets || []).filter((x) => x && (x.reps || x.weight));
      const best = sets.reduce((m, x) => Math.max(m, x.weight || 0), 0);
      const url = exerciseImgSrc(ex);
      const chips = sets.map((x) =>
        `<span class="ms-set"><span class="num">${fmtNum(x.reps || 0)}</span><span class="ms-x">×</span><span class="num">${fmtWeight(x.weight || 0)}</span></span>`
      ).join('');
      return `
        <button class="ms-card" data-open-ex="${ex.id}">
          <span class="ms-thumb" data-cat="${escapeHtml(ex.category)}">
            <span class="ms-thumb-fallback">${escapeHtml(initialsOf(exDisplayName(ex)))}</span>
            ${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
          </span>
          <span class="ms-main">
            <span class="ms-name">${escapeHtml(exDisplayName(ex))}</span>
            <span class="ms-meta">${fmtNum(sets.length)} ${escapeHtml(t('ms_sets_label'))}${best > 0 ? ` · ${escapeHtml(t('pr_max_weight'))} ${fmtWeight(best)}${unitLabel()}` : ''}</span>
            ${chips ? `<span class="ms-sets">${chips}</span>` : ''}
          </span>
        </button>
      `;
    }).join('');
    return `<div class="ms-group"><div class="ms-date">${escapeHtml(label)}</div>${cards}</div>`;
  }).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${t('back')}">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(categoryLabel(cat))}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('muscle_focus')}</div>
      <h1 class="page-title">${escapeHtml(categoryLabel(cat))}</h1>
      <p class="page-subtitle"><span class="num">${fmtNum(sessions.length)}</span> ${escapeHtml(t('ms_sessions_logged'))}</p>
    </div>

    ${sessions.length === 0
      ? emptyState({ iconName: 'dumbbell', title: t('ms_empty_title'), text: t('ms_empty_text') })
      : `<div class="ms-list">${groupsHtml}</div>`}
  `;

  el.querySelectorAll('[data-open-ex]').forEach((b) =>
    b.addEventListener('click', () => navigate('exercise-detail', { exerciseId: b.dataset.openEx }))
  );
}

function renderPersonalRecords(el) {
  const exercises = DB.exercises.list();

  // Build rows: skip exercises with no sessions or bodyweight-only (maxWeight === 0); null-guard orphan ids
  const rows = exercises
    .map((ex) => {
      if (!ex) return null;
      const snap = DB.sessions.prSnapshot(ex.id);
      if (snap.sessionCount === 0) return null;
      if (snap.maxWeight === 0) return null; // bodyweight-only exercises (push-ups, pull-ups, etc.)
      return { ex, snap };
    })
    .filter(Boolean)
    .sort((a, b) => a.ex.name.localeCompare(b.ex.name));

  const listHtml = rows.map(({ ex, snap }) => `
    <div class="data-row pr-row">
      <div class="data-icon custom" aria-hidden="true">${icon('trophy', 20)}</div>
      <div class="data-main">
        <div class="data-title">${escapeHtml(exDisplayName(ex))}</div>
        <div class="data-meta pr-stats">
          <span>${escapeHtml(t('pr_max_weight'))}: <span class="num">${fmtWeight(snap.maxWeight)}${unitLabel()}</span></span>
          <span class="dot-sep"></span>
          <span>${escapeHtml(t('pr_est_orm'))}: <span class="num">${fmtWeight(Math.round(snap.bestORM))}${unitLabel()}</span></span>
        </div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="home" aria-label="${t('back')}">${icon('back', 20)}</button>
      <div class="detail-top-title">${t('pr_view_title')}</div>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${t('tools_section')}</div>
      <h1 class="page-title">${t('pr_view_title')}</h1>
      <p class="page-subtitle">${t('pr_card_sub')}</p>
    </div>

    ${rows.length === 0
      ? emptyState({ iconName: 'trophy', title: t('pr_empty_title'), text: t('pr_empty_text') })
      : `<div class="data-list">${listHtml}</div>`
    }
  `;
}

async function bootCloud() {
  if (!window.Cloud || !Cloud.configured()) return; // not set up → local-only
  await Cloud.ensureSdk(); // load the Supabase SDK on demand
  // Opened from a password-reset link → let the user set a new password.
  Cloud.onPasswordRecovery(() => showChangePassword());
  let session = null;
  try { session = await Cloud.getSession(); } catch (_) {}
  if (!session) { showAuthGate('in'); return; }
  // Already logged in — pick up any changes from other devices in the background.
  try {
    const r = await Cloud.bootSync();
    if (r === 'pulled') refreshAfterSync();
    else if (r === 'conflict') showConflictDialog(); // both sides changed → ask
  } catch (_) {}
  ensureUsername(); // enforce a handle for already-logged-in users too
  if (Cloud.touchLastSeen) Cloud.touchLastSeen();  // fire-and-forget activity stamp
  enforceAccountStatus();                          // block disabled/banned accounts
  syncExerciseImages();                            // back up / heal custom images
}

// ==========================================================================
// Admin-managed global catalog (Supabase `exercises` / `food_catalog` /
// `preset_plans` / `app_config`, written from admin.html) — pulled additively
// at boot so the app simply shows more when the owner adds content, and
// behaves exactly as it always has when a table is empty, unreachable, or the
// user is offline. Works logged-out too (these tables are public-read).
// Every step is independently wrapped so a failure here is silent and can
// NEVER block boot or break local/offline usage.
// ==========================================================================
async function bootCatalog() {
  if (!window.Cloud || !Cloud.pullCatalog) return;
  let catalog;
  try { catalog = await Cloud.pullCatalog(); } catch (_) { return; }
  if (!catalog) return;

  // a) Global exercises → merged into the library as ordinary (non-custom)
  // entries. DB.exercises.mergeGlobal dedupes by lowercased name, so calling
  // this on every boot is always safe and never creates duplicates.
  try {
    if (Array.isArray(catalog.exercises) && catalog.exercises.length && DB.exercises && DB.exercises.mergeGlobal) {
      const added = DB.exercises.mergeGlobal(catalog.exercises.map((g) => ({
        name: g && g.name,
        category: g && g.category,
        imageSlug: g && g.image_slug,
        machineType: g && g.machine_type,
      })));
      // Reflect immediately if the library happens to already be open.
      if (added && currentView === 'library') renderView('library');
    }
  } catch (_) {}

  // b) Ready-made plans → additive to the built-in templates browse.
  try { setServerPresetPlans(catalog.presets); } catch (_) {}

  // c) Global foods → additive to the quick-add picker.
  try { setServerFoodCatalog(catalog.foods); } catch (_) {}

  // d) Dismissible announcement banner + e) one-time default-unit seed.
  try { if (catalog.config) showAnnouncementBanner(catalog.config); } catch (_) {}
  try { if (catalog.config) seedDefaultUnitIfNew(catalog.config); } catch (_) {}
}

// Dismissible in-app banner for the admin's `app_config.announcement_*`.
// Localized per the current UI language; falls back to whichever language IS
// filled in if only one was set. Dismissal is remembered by the announcement's
// own text (not a version number), so editing the message shows it again, but
// re-showing the exact same text never nags a user who already dismissed it.
function showAnnouncementBanner(config) {
  if (!config || !config.announcement_active) return;
  const lang = (DB.prefs.get().lang) || 'en';
  const text = String(
    (lang === 'ar' ? config.announcement_ar : config.announcement_en)
    || config.announcement_en || config.announcement_ar || ''
  ).trim();
  if (!text) return;
  if (document.getElementById('announcement-banner')) return;
  // Dismissal is keyed on the announcement's identity — its updated_at stamp
  // (fallback: the text). So editing OR re-saving it in the admin panel bumps
  // updated_at and it shows again to everyone, even users who dismissed the
  // previous one; an untouched announcement stays dismissed.
  const DISMISS_KEY = 'vault_announcement_dismissed';
  const sig = String(config.updated_at || text);
  let dismissed = '';
  try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch (_) {}
  if (dismissed === sig) return;

  const el = document.createElement('div');
  el.id = 'announcement-banner';
  el.className = 'update-banner announcement-banner';
  el.innerHTML = `
    <div class="update-banner-main">
      <div class="update-banner-icon">${icon('info', 20)}</div>
      <div class="update-banner-text">
        <div class="update-banner-notes">${escapeHtml(text)}</div>
      </div>
    </div>
    <div class="update-banner-actions">
      <button type="button" class="icon-btn icon-btn-tile" id="announcement-dismiss" aria-label="${escapeHtml(t('close'))}">${icon('close', 16)}</button>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  // Best-effort: if the native-shell "new APK" banner is also showing (both
  // use the same fixed bottom slot), stack ours above it instead of
  // overlapping. Purely cosmetic — never affects function.
  let repositionObserver = null;
  const reposition = () => {
    const upd = document.getElementById('update-banner');
    if (upd && upd !== el) {
      el.style.bottom = `calc(var(--nav-h) + var(--safe-b) + var(--sp-3) + ${upd.offsetHeight + 12}px)`;
    } else {
      el.style.bottom = '';
    }
  };
  try {
    reposition();
    repositionObserver = new MutationObserver(reposition);
    repositionObserver.observe(document.body, { childList: true });
  } catch (_) {}

  el.querySelector('#announcement-dismiss').addEventListener('click', () => {
    try { localStorage.setItem(DISMISS_KEY, sig); } catch (_) {}
    if (repositionObserver) { try { repositionObserver.disconnect(); } catch (_) {} }
    el.classList.remove('show');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  });
}

// One-time seed of the weight-unit preference from the admin's
// `app_config.default_unit` — ONLY for a genuinely brand-new install (no
// logged data yet). An existing user's setup (even an untouched 'kg' default)
// is never overridden once they've started using the app. Guarded by a
// persisted flag so this is attempted at most once per install, ever.
function seedDefaultUnitIfNew(config) {
  if (!config || (config.default_unit !== 'kg' && config.default_unit !== 'lb')) return;
  const FLAG = 'vault_default_unit_seeded_v1';
  try { if (localStorage.getItem(FLAG)) return; } catch (_) { return; }
  try { localStorage.setItem(FLAG, '1'); } catch (_) { return; } // one-time, regardless of the outcome below
  try {
    const all = DB.getAll();
    const hasUserData = !!(
      (all.sessions && all.sessions.length) || (all.cardio && all.cardio.length) ||
      (all.sleep && all.sleep.length) || (all.foods && all.foods.length) ||
      (all.foodLogs && Object.keys(all.foodLogs).length) ||
      (all.supplements && all.supplements.length) ||
      (all.supplementLogs && Object.keys(all.supplementLogs).length) ||
      (all.exercises && all.exercises.some((e) => e && e.isCustom))
    );
    if (hasUserData) return; // not a brand-new user — never override their setup
    if ((all.prefs && all.prefs.unit) !== config.default_unit) {
      DB.prefs.setUnit(config.default_unit);
    }
  } catch (_) {}
}

// Fade newly-loaded images in smoothly. One capture listener covers every
// <img> in the app (load events don't bubble, so capture is required) —
// no per-render JS needed. CSS pairs .machine-photo/.detail-hero img with
// opacity 0 → .loaded 1.
document.addEventListener('load', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.target.classList.add('loaded');
}, true);

// ==========================================================================
// Mobile keyboard handling. When the on-screen keyboard opens it shrinks the
// (dynamic) viewport, which pulls the absolute bottom-nav up on top of the
// field being edited and can leave the field hidden behind the keyboard. We
// (1) flag `body.keyboard-open` so CSS slides the nav out of the way, and
// (2) scroll the focused field into the visible area above the keyboard.
// Detection compares the current viewport height to a remembered baseline —
// this covers BOTH keyboard modes: browsers that shrink only the visual
// viewport AND WebViews (the APK) that resize the whole window.
// ==========================================================================
function setupKeyboardHandling() {
  const vp = window.visualViewport;
  const curH = () => (vp ? vp.height : window.innerHeight);
  let baseH = curH();

  function evaluate() {
    const h = curH();
    if (h > baseH) baseH = h;         // grow the baseline (browser chrome hiding, etc.)
    const open = (baseH - h) > 120;   // >120px shorter than the baseline ⇒ keyboard is up
    document.body.classList.toggle('keyboard-open', open);
  }
  // Orientation swaps portrait/landscape height — recapture the baseline so the
  // new (shorter, in landscape) height isn't mistaken for an open keyboard.
  function resetBaseline() {
    document.body.classList.remove('keyboard-open');
    setTimeout(() => { baseH = curH(); evaluate(); }, 350);
  }

  if (vp) vp.addEventListener('resize', evaluate);
  window.addEventListener('resize', evaluate);
  window.addEventListener('orientationchange', resetBaseline);

  // Keep the focused field visible above the keyboard. Wait for the keyboard to
  // animate in and settle the viewport before scrolling so we land in the right spot.
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('input, textarea, [contenteditable="true"]')) return;
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
    }, 320);
  });
}

(function init() {
  // Kick off the (large) Supabase SDK download in parallel with the first paint,
  // before anything awaits it — so the login gate / session check isn't blocked
  // on a cold download. Fire-and-forget; bootCloud awaits the same promise.
  try { if (window.Cloud && Cloud.ensureSdk && Cloud.configured && Cloud.configured()) Cloud.ensureSdk(); } catch (_) {}

  const prefs = DB.prefs.get();
  applyTheme(prefs.theme || 'dark');
  applyLang(prefs.lang || 'en');
  navigate('home', {}, { fromPop: true }); // root entry — don't grow history
  setupKeyboardHandling(); // hide the nav + keep the focused field above the keyboard
  bootCloud();
  bootCatalog(); // best-effort admin-content pull; works logged-out too

  // When the app is re-foregrounded (common on the APK — Android keeps it warm),
  // refresh without a full restart: pull admin content again (so a freshly
  // activated announcement appears) and re-check for a newer web build (shows a
  // tap-to-update banner). Both are best-effort and no-op when nothing changed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    try { bootCatalog(); } catch (_) {}
    try { if (window.VaultUpdate && VaultUpdate.checkWeb) VaultUpdate.checkWeb(); } catch (_) {}
  });
})();
