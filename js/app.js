// ==========================================================================
// THE VAULT - Main App
// ==========================================================================

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
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>',
  backspace: '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
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
    save: 'Save', cancel: 'Cancel', update: 'Update', delete: 'Delete', select: 'Select',
    unit: 'Unit', done: 'Done',
    not_found: 'Not found', not_found_text: 'This exercise no longer exists.',

    // Cardio
    cardio_subtitle: 'Treadmill, walking, and cycling sessions.',
    no_cardio: 'No cardio yet',
    no_cardio_text: 'Log your first treadmill, walk, or ride with the button above.',
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
    no_foods_yet: 'No foods yet',
    no_foods_text: 'Build your personal reference of foods you eat regularly.',
    no_matches_simple: 'No matches',
    no_matches_text: 'Try a different search.',
    reference_items: 'Reference',
    search_foods: 'Search foods…',
    add: 'Add',
    new_food: 'New Food', edit_food: 'Edit Food',
    food_quick: 'Macros per serving.',
    serving_opt: 'Serving (optional)', serving_hint: 'e.g. 100g, 1 cup',
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
    ai_no_result: 'No result — try rephrasing.',
    ai_add_to_log: 'Add to log',
    ai_added: 'Added',
    ai_error: 'Something went wrong',
    ai_not_food: 'This chat is for food only — type a meal to calculate it.',

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
    streak_start: 'سجّل جلسة عشان تبدأ سلسلتك',
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
    save: 'حفظ', cancel: 'إلغاء', update: 'تحديث', delete: 'حذف', select: 'اختيار',
    unit: 'الوحدة', done: 'تم',
    not_found: 'غير موجود', not_found_text: 'هذا التمرين لم يعد موجوداً.',

    cardio_subtitle: 'جلسات السير، المشي، والدراجة.',
    no_cardio: 'لا يوجد كارديو بعد',
    no_cardio_text: 'سجّل أول جلسة سير أو مشي أو دراجة بالزر فوق.',
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
    no_foods_yet: 'لا يوجد أكل بعد',
    no_foods_text: 'ابنِ قائمتك المرجعية للأكل اللي تأكله عادة.',
    no_matches_simple: 'لا نتائج',
    no_matches_text: 'جرّب بحث مختلف.',
    reference_items: 'مرجع',
    search_foods: 'ابحث عن أكل…',
    add: 'أضف',
    new_food: 'أكل جديد', edit_food: 'تعديل الأكل',
    food_quick: 'المعدلات الغذائية لكل حصة.',
    serving_opt: 'الحصة (اختياري)', serving_hint: 'مثلاً 100جم، كوب',
    protein_g: 'بروتين (جم)', carbs_g: 'كارب (جم)',
    delete_food_q: 'حذف الأكل؟',
    delete_food_text: 'سيُحذف هذا الأكل من قائمتك المرجعية.',
    cal: 'سعرة', protein_label: 'بروتين', carbs_label: 'كارب', fat_label: 'دهون',
    ai_chat_btn: 'ذكاء', ai_chat_title: 'شات السعرات', ai_chat_sub: 'احكيلي شو أكلت — وأنا أسجّل السعرات',
    ai_chat_placeholder: 'مثلاً: الفطور بيض وخبز، والغدا برجر',
    ai_add_all: 'أضف الكل',
    ai_need_key: 'بدّو مفتاح Google Gemini مجاني (مرّة وحدة).',
    ai_key_step1: 'احصل على مفتاح مجاني من',
    ai_key_step2: 'الصقه تحت — بيتخزّن على جهازك فقط.',
    ai_key_label: 'مفتاح Gemini',
    ai_save_key: 'حفظ المفتاح',
    ai_analyzing: 'جارٍ الحساب…',
    ai_no_result: 'ما في نتيجة — جرّب صياغة ثانية.',
    ai_add_to_log: 'أضف للسجل',
    ai_added: 'تمت الإضافة',
    ai_error: 'صار خطأ',
    ai_not_food: 'هذا الشات للطعام فقط — اكتب وجبة لأحسبها.',

    sleep_subtitle: 'تتبّع متى تنام ومتى تصحى.',
    no_sleep_logged: 'لا يوجد نوم مسجّل',
    no_sleep_text: 'اضغط "سجّل" لتسجيل أول ليلة نوم.',
    nights_log: 'سجّل', nights_logged: 'مسجلة',
    last_night: 'آخر ليلة', avg_7d: 'متوسط 7 أيام',
    log_sleep: 'سجّل النوم', edit_sleep: 'تعديل النوم',
    sleep_quick: 'التاريخ هو الصباح الذي صحيت فيه.',
    sleep_time: 'وقت النوم', wake_time: 'وقت الصحيان',
    total_sleep: 'مدة النوم',
    fill_all_fields: 'عبّي كل الخانات',
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
    library_subtitle: 'تصفّح كل التمارين وأضف اللي تسويها.',
    browse_library: 'تصفّح المكتبة',
    add_from_library: 'إضافة من المكتبة',
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
    change_image: 'تغيير',
    remove_image: 'إزالة',
    image_hint: 'اختر صورة من جهازك. تُحفظ محلياً.',

    planner_title: 'الخطة الأسبوعية',
    planner_subtitle: 'حدّد وش تتمرن كل يوم في الأسبوع.',
    today_plan: 'خطة اليوم',
    no_plan_today: 'يوم راحة',
    no_plan_today_sub: 'ما في تمارين مجدولة اليوم.',
    start_workout: 'ابدأ التمرين',
    edit_day: 'تعديل اليوم',
    logged: 'مُسجَّل',
    logged_today: 'مُسجَّل لهذا اليوم',
    day_name_placeholder: 'مثلاً: صدر، ظهر',
    pick_exercises: 'اختر تمارين',
    no_exercises_picked: 'ما اخترت تمارين بعد',
    rest_day: 'راحة',
    plan_empty: 'خطتك الأسبوعية فاضية',
    plan_empty_sub: 'طبّق قالب جاهز أو ابنها يوم بيوم.',
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

    dow_sun: 'الأحد', dow_mon: 'الاثنين', dow_tue: 'الثلاثاء', dow_wed: 'الأربعاء', dow_thu: 'الخميس', dow_fri: 'الجمعة', dow_sat: 'السبت',
    dow_sun_full: 'الأحد', dow_mon_full: 'الاثنين', dow_tue_full: 'الثلاثاء', dow_wed_full: 'الأربعاء',
    dow_thu_full: 'الخميس', dow_fri_full: 'الجمعة', dow_sat_full: 'السبت',

    calendar_title: 'التقويم',
    calendar_subtitle: 'عرض شهري لنشاطك.',
    no_activity_day: 'ما في نشاط هذا اليوم',
    workouts_day: 'تمارين', cardio_day: 'كارديو', sleep_day: 'نوم',

    supplements_title: 'المكمّلات',
    supplements_subtitle: 'تتبّع جرعاتك اليومية وحافظ على سلسلتك.',
    new_supplement: 'مكمّل جديد',
    edit_supplement: 'تعديل المكمّل',
    supplement_name: 'اسم المكمّل',
    dose: 'الجرعة (اختياري)',
    color: 'اللون',
    no_supplements: 'ما في مكمّلات بعد',
    no_supplements_text: 'أضف المكمّلات اللي تاخذها (مثلاً: كرياتين، واي).',
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
    empty_food_list: 'قائمتك المرجعية فاضية',
    empty_food_list_text: 'روح لـ "الأكل" وضيف أكلاتك أول.',
    go_to_food: 'روح للأكل',
    prev_day: 'يوم سابق', next_day: 'يوم تالي',

    variations: 'تمارين بديلة',
    variations_sub: 'حركات مشابهة تضرب نفس العضلات.',

    progress_chart: 'التقدم',
    max_weight_per_session: 'أقصى وزن لكل جلسة',
    no_chart_data: 'سجّل مجموعتين فأكثر عشان تشوف رسم تقدّمك.',

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
      <div class="${variant === 'confirm' ? 'confirm-dialog' : 'modal'}">
        ${variant === 'sheet' ? '<div class="sheet-handle"></div>' : ''}
        ${innerHtml}
      </div>
    </div>
  `;
  const overlay = root.querySelector('.modal-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', () => closeModal())
  );
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
function vaultBar({ action = '' } = {}) {
  return `
    <div class="vault-bar">
      <div class="vault-logo">
        <span class="vault-logo-mark">${icon('vault', 22)}</span>
        <span>${t('app_name')}</span>
      </div>
      ${action ? `<button class="vault-action" id="vault-action">${action}</button>` : '<span style="width:40px"></span>'}
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

function navigate(view, context = {}) {
  currentView = view;
  viewContext = context;

  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));

  const navMap = {
    home: 'home', workouts: 'workouts', library: 'workouts', 'exercise-detail': 'workouts',
    cardio: 'cardio', food: 'food', sleep: 'sleep',
    compare: 'home', settings: 'home',
    planner: 'home', calendar: 'home', supplements: 'home', foodlog: 'home',
  };
  const highlightView = navMap[view] || view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === highlightView));

  renderView(view);
  $('.main').scrollTop = 0;
}

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
  }
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
    return `
      <div class="heat-cell lvl-${lvl}">
        <div class="heat-cell-name">${escapeHtml(categoryLabel(cat))}</div>
        <div class="heat-cell-count num">${count}</div>
      </div>
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
          <div class="recent-item-icon data-icon ${r.iconCls}">${icon(r.iconName, 16)}</div>
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

  // Today's plan card
  const todayDow = String(now.getDay());
  const todayPlan = (DB.plan.get() || {})[todayDow];
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));

  let todayPlanHtml = '';
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

    todayPlanHtml = `
      <button class="today-plan" data-goto="planner" style="width:100%;display:block;text-align:left">
        <div class="today-plan-head">
          <div class="today-plan-eyebrow">${t('today_plan')}</div>
          <div class="today-plan-day">${escapeHtml(dayName(now.getDay(), true))}</div>
        </div>
        <div class="today-plan-name">${escapeHtml(todayPlan.name || t('start_workout'))}</div>
        <div class="today-plan-meta">${fmtNum(exObjs.length)} ${exObjs.length === 1 ? t('exercise') : t('exercises')}</div>
        <div class="planner-day-muscles" style="margin-top:10px">
          ${sideRow(t('anterior'), muscles.anterior, 'anterior')}
          ${sideRow(t('posterior'), muscles.posterior, 'posterior')}
        </div>
      </button>
    `;
  } else {
    todayPlanHtml = `
      <button class="today-plan" data-goto="planner" style="width:100%;display:block">
        <div class="today-plan-head">
          <div class="today-plan-eyebrow">${t('today_plan')}</div>
          <div class="today-plan-day">${escapeHtml(dayName(now.getDay(), true))}</div>
        </div>
        <div class="today-plan-rest">
          <div class="today-plan-rest-title">${t('no_plan_today')}</div>
          <div class="today-plan-rest-sub">${t('no_plan_today_sub')}</div>
        </div>
      </button>
    `;
  }

  el.innerHTML = `
    ${vaultBar({ action: icon('settings', 20) })}

    <div class="home-hello">${escapeHtml(dayLabel)}</div>
    <div class="home-hero">${greeting}.</div>

    <div class="streak-banner">
      <div class="streak-icon">${icon('flame', 24)}</div>
      <div class="streak-text">
        <div class="streak-number num">${streak}<span class="unit">${streakUnit}</span></div>
        <div class="streak-label">${escapeHtml(streakLabel)}</div>
      </div>
    </div>

    ${todayPlanHtml}

    <div class="stat-grid">
      <button class="stat-tile" data-goto="workouts">
        <div class="stat-tile-head">
          <div class="stat-tile-label">${t('workouts')}</div>
          <div class="stat-tile-icon">${icon('dumbbell', 15)}</div>
        </div>
        <div class="stat-tile-value num">${fmtNum(weekSetsCount)}</div>
        <div class="stat-tile-sub">${t('sessions_this_week')}</div>
      </button>

      <button class="stat-tile" data-goto="workouts">
        <div class="stat-tile-head">
          <div class="stat-tile-label">${t('sessions_label')}</div>
          <div class="stat-tile-icon">${icon('calendar', 15)}</div>
        </div>
        <div class="stat-tile-value num">${fmtNum(weekWorkoutDays)}</div>
        <div class="stat-tile-sub">${t('this_week')}</div>
      </button>

      <button class="stat-tile" data-goto="cardio">
        <div class="stat-tile-head">
          <div class="stat-tile-label">${t('cardio')}</div>
          <div class="stat-tile-icon">${icon('run', 15)}</div>
        </div>
        <div class="stat-tile-value num">${cardioMinutes}<span class="unit">${t('minutes').slice(0, 3).toLowerCase()}</span></div>
        <div class="stat-tile-sub">${t('this_week')}</div>
      </button>

      <button class="stat-tile" data-goto="sleep">
        <div class="stat-tile-head">
          <div class="stat-tile-label">${t('last_sleep')}</div>
          <div class="stat-tile-icon">${icon('moon', 15)}</div>
        </div>
        <div class="stat-tile-value num">${sleepHours != null ? sleepHours : '—'}${sleepHours != null ? '<span class="unit">h</span>' : ''}</div>
        <div class="stat-tile-sub">${escapeHtml(sleepSub)}</div>
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
      <div class="heatmap-grid">${heatCells}</div>
    </div>

    <div class="section-title">${t('tools_section')}</div>
    <div class="tools-grid">
      <button class="tool-card" data-goto="planner">
        <div class="tool-card-icon">${icon('calendar', 18)}</div>
        <div>
          <div class="tool-card-title">${t('plan_card')}</div>
          <div class="tool-card-sub">${t('plan_card_sub')}</div>
        </div>
      </button>
      <button class="tool-card" data-goto="calendar">
        <div class="tool-card-icon">${icon('chart', 18)}</div>
        <div>
          <div class="tool-card-title">${t('calendar_card')}</div>
          <div class="tool-card-sub">${t('calendar_card_sub')}</div>
        </div>
      </button>
      <button class="tool-card" data-goto="supplements">
        <div class="tool-card-icon">${icon('zap', 18)}</div>
        <div>
          <div class="tool-card-title">${t('supplements_card')}</div>
          <div class="tool-card-sub">${t('supplements_card_sub')}</div>
        </div>
      </button>
      <button class="tool-card" data-goto="foodlog">
        <div class="tool-card-icon">${icon('utensils', 18)}</div>
        <div>
          <div class="tool-card-title">${t('food_log_card')}</div>
          <div class="tool-card-sub">${t('food_log_card_sub')}</div>
        </div>
      </button>
    </div>

    <button class="cta-card" data-goto="compare">
      <div class="cta-card-icon">${icon('chart', 20)}</div>
      <div style="flex:1;min-width:0">
        <div class="cta-card-title">${t('compare_progress')}</div>
        <div class="cta-card-sub">${t('compare_progress_sub')}</div>
      </div>
      <div class="cta-card-chev">${icon('chevronRight', 18)}</div>
    </button>

    ${recentHtml}
  `;

  bindVaultAction(() => navigate('settings'));
  if (typeof Health !== 'undefined') Health.bindHomeSection();
}

// ==========================================================================
// Exercise card helpers
// ==========================================================================
function exerciseImgSrc(ex) {
  if (ex.customImage) return ex.customImage;
  if (ex.imageSlug) return exerciseImageUrl(ex.imageSlug);
  return '';
}

function bentoCardHtml(ex, i, { showPR = true, toggle = null } = {}) {
  const isWide = i % 5 === 0;
  const stats = DB.sessions.bestStats(ex.id);
  const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
  const url = exerciseImgSrc(ex);
  const initials = escapeHtml(initialsOf(ex.name));

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

  const toggleBtn = toggle
    ? `<button class="bento-toggle ${toggle.added ? 'added' : ''}" data-toggle-ex="${ex.id}" aria-label="${escapeHtml(toggle.added ? t('remove_image') : t('add_to_train'))}">${icon(toggle.added ? 'check' : 'plus', 16)}</button>`
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
        ${url ? `<img class="machine-photo" src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      </div>
    `;
  } else if (url) {
    bgHtml = `<div class="bento-card-bg" data-cat="${escapeHtml(ex.category)}" style="background-image:url('${url}')"></div>`;
  } else {
    bgHtml = `<div class="bento-card-bg fallback" data-cat="${escapeHtml(ex.category)}">${initials}</div>`;
  }

  return `
    <button class="bento-card ${isWide ? 'wide' : ''} ${addedClass}" data-exercise="${ex.id}">
      ${bgHtml}
      <div class="bento-card-name-tag" title="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</div>
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

  const query = (viewContext.workoutQuery || '').toLowerCase();
  const filter = viewContext.workoutFilter || 'All';

  let filtered = myList;
  if (filter !== 'All') filtered = filtered.filter((e) => e.category === filter);
  if (query) filtered = filtered.filter((e) => e.name.toLowerCase().includes(query));

  const filterPills = ['All', ...EXERCISE_CATEGORIES]
    .map((f) => `<button class="filter-pill ${f === filter ? 'active' : ''}" data-filter="${f}">${escapeHtml(categoryLabel(f))}</button>`)
    .join('');

  const cards = filtered.map((ex, i) => bentoCardHtml(ex, i)).join('');

  const addCard = `
    <button class="bento-card bento-add" id="add-exercise-btn">
      ${icon('plus', 26)}
      <div>
        <div class="bento-add-title">${t('new_exercise')}</div>
        <div class="bento-add-sub">${t('add_custom')}</div>
      </div>
    </button>
  `;

  let gridHtml;
  if (filtered.length === 0 && myList.length === 0) {
    // Truly empty: show empty-state CTA to browse library
    gridHtml = `
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
    gridHtml = emptyState({ iconName: 'search', title: t('no_matches'), text: t('no_matches_hint') });
  } else {
    const parts = cards.split('</button>').filter(Boolean);
    const first = parts[0] + '</button>';
    const rest = parts.slice(1).map((p) => p + '</button>').join('');
    gridHtml = `<div class="bento-grid">${first}${addCard}${rest}</div>`;
  }

  el.innerHTML = `
    ${vaultBar({ action: icon('chart', 20) })}

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

    ${gridHtml}
  `;

  // Vault top action → open Library
  bindVaultAction(() => navigate('library'));

  $('#workout-search', el)?.addEventListener('input', (e) => {
    viewContext.workoutQuery = e.target.value;
    renderWorkouts(el);
    const s = $('#workout-search', el);
    if (s) { s.focus(); const pos = e.target.value.length; s.setSelectionRange(pos, pos); }
  });

  el.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      viewContext.workoutFilter = btn.dataset.filter;
      renderWorkouts(el);
    })
  );

  el.querySelectorAll('#add-exercise-btn').forEach((b) =>
    b.addEventListener('click', openNewExerciseModal)
  );

  // The "Add from Library" buttons on the Train page navigate to Library in
  // pick mode — tapping any exercise there adds it directly to Train.
  el.querySelectorAll('[data-library-pick]').forEach((b) =>
    b.addEventListener('click', () => navigate('library', { libraryPickMode: true }))
  );

  el.querySelectorAll('[data-exercise]').forEach((btn) =>
    btn.addEventListener('click', () => navigate('exercise-detail', { exerciseId: btn.dataset.exercise }))
  );
}

// ==========================================================================
// LIBRARY - browse all exercises grouped by category, with add/remove toggle
// ==========================================================================
function renderLibrary(el) {
  const exercises = DB.exercises.list();
  const query = (viewContext.libraryQuery || '').toLowerCase();
  const filter = viewContext.libraryFilter || 'All';
  const pickMode = !!viewContext.libraryPickMode;
  const addedCount = exercises.filter((e) => e.inMyList).length;

  let filtered = exercises;
  if (filter !== 'All') filtered = filtered.filter((e) => e.category === filter);
  if (query) filtered = filtered.filter((e) => e.name.toLowerCase().includes(query));

  const filterPills = ['All', ...EXERCISE_CATEGORIES]
    .map((f) => `<button class="filter-pill ${f === filter ? 'active' : ''}" data-filter="${f}">${escapeHtml(categoryLabel(f))}</button>`)
    .join('');

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

    ${filtered.length === 0
      ? emptyState({ iconName: 'search', title: t('no_matches'), text: t('no_matches_hint') })
      : groupsHtml
    }
  `;

  // In pick mode, mark the body so we can style cards differently (cursor, hover)
  document.body.classList.toggle('library-pick-mode', pickMode);

  $('#library-search', el)?.addEventListener('input', (e) => {
    viewContext.libraryQuery = e.target.value;
    renderLibrary(el);
    const s = $('#library-search', el);
    if (s) { s.focus(); const pos = e.target.value.length; s.setSelectionRange(pos, pos); }
  });

  el.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      viewContext.libraryFilter = btn.dataset.filter;
      renderLibrary(el);
    })
  );

  // Toggle add/remove (must stop propagation so card click doesn't fire)
  el.querySelectorAll('[data-toggle-ex]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = btn.dataset.toggleEx;
      const ex = DB.exercises.getById(id);
      if (!ex) return;
      const newState = !ex.inMyList;
      DB.exercises.setInMyList(id, newState);
      showToast(newState ? t('added_to_train') : t('removed_from_train'));
      renderLibrary(el);
    })
  );

  // Done button — exits pick mode and returns to Train
  el.querySelectorAll('[data-pick-done]').forEach((b) =>
    b.addEventListener('click', () => {
      viewContext.libraryPickMode = false;
      document.body.classList.remove('library-pick-mode');
      navigate('workouts');
    })
  );

  el.querySelectorAll('[data-exercise]').forEach((btn) =>
    btn.addEventListener('click', () => {
      // In pick mode the whole card adds/removes the exercise from Train.
      // Otherwise, navigate to the exercise detail page.
      if (pickMode) {
        const id = btn.dataset.exercise;
        const ex = DB.exercises.getById(id);
        if (!ex) return;
        const newState = !ex.inMyList;
        DB.exercises.setInMyList(id, newState);
        showToast(newState ? t('added_to_train') : t('removed_from_train'));
        renderLibrary(el);
      } else {
        navigate('exercise-detail', { exerciseId: btn.dataset.exercise });
      }
    })
  );
}

function openNewExerciseModal(exerciseId = null) {
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
      <input type="text" id="ex-name" placeholder="Bulgarian Split Squat" value="${existing ? escapeHtml(existing.name) : ''}" autofocus>
    </div>

    <div class="form-group">
      <label class="form-label">${t('category')}</label>
      <select id="ex-category">${categoryOptions}</select>
    </div>

    <div class="form-group">
      <label class="form-label">${t('image_optional')}</label>
      <div class="image-uploader">
        <div class="image-preview" id="ex-image-preview">${previewHtml()}</div>
        <div class="image-actions">
          <button type="button" class="btn btn-ghost" id="ex-image-pick">${pickedImage ? t('change_image') : t('choose_image')}</button>
          ${pickedImage ? `<button type="button" class="btn btn-danger" id="ex-image-clear">${t('remove_image')}</button>` : ''}
        </div>
      </div>
      <div class="image-hint">${t('image_hint')}</div>
      <input type="file" id="ex-image-file" accept="image/*" hidden>
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

  $('#ex-image-pick').addEventListener('click', () => $('#ex-image-file').click());
  $('#ex-image-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 800, 0.78);
      pickedImage = dataUrl;
      refreshPreview();
    } catch (err) {
      showToast('Image error');
    }
  });
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
      showToast(t('updated'));
    } else {
      DB.exercises.add({ name, category, customImage: pickedImage });
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
          <img src="${imageUrl}" alt="${escapeHtml(ex.name)}" referrerpolicy="no-referrer"
               onerror="this.closest('.detail-hero').classList.add('empty'); this.remove();">
        </div>
        <div class="detail-hero-overlay">
          <div class="detail-hero-name">${escapeHtml(ex.name)}</div>
          <div class="detail-hero-cat pill cat-${ex.category}">${escapeHtml(categoryLabel(ex.category))}</div>
        </div>
      </div>
    `
    : `
      <div class="detail-hero-wrap">
        <div class="detail-hero empty">${ex.isCustom ? t('custom_exercise_label') : escapeHtml(categoryLabel(ex.category).toUpperCase())}</div>
        <div class="detail-hero-overlay">
          <div class="detail-hero-name">${escapeHtml(ex.name)}</div>
          <div class="detail-hero-cat pill cat-${ex.category}">${escapeHtml(categoryLabel(ex.category))}</div>
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
            <span class="sets-row-num num">${set.reps}</span>
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
      <button class="back-btn" data-goto="workouts">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(ex.name)}</div>
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
    : [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }];

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
        ${lastSession.sets.map((s) => `${s.reps} × ${fmtWeight(s.weight)}${unitLabel()}`).join(' · ')}
      </div>
    </div>
  ` : '';

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${existing ? t('edit_session') : t('log_session')}</div>
        <div class="modal-subtitle">${escapeHtml(ex.name)}</div>
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
    if (existing) {
      DB.sessions.update(existing.id, { date, sets: cleaned });
      showToast(t('session_updated'));
    } else {
      DB.sessions.add({ exerciseId, date, sets: cleaned });
      showToast(t('session_saved'));
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
    ${vaultBar({ action: icon('plus', 20) })}

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
function renderFood(el) {
  const list = DB.foods.list();
  const query = (viewContext.foodQuery || '').toLowerCase();
  const filtered = query ? list.filter((f) => f.name.toLowerCase().includes(query)) : list;

  const items = filtered.map((f) => `
    <div class="data-row">
      <div class="data-icon food">${icon('utensils', 20)}</div>
      <div class="data-main">
        <div class="data-title">
          ${escapeHtml(f.name)}
          ${f.serving ? `<span style="color:var(--text-mute);font-weight:500;font-size:12px">· ${escapeHtml(f.serving)}</span>` : ''}
        </div>
        <div class="macro-row">
          <span class="macro-chip"><span class="num">${f.calories}</span><span class="macro-label">${t('cal')}</span></span>
          <span class="macro-chip"><span class="num">${f.protein}</span>g<span class="macro-label">${t('protein_label')}</span></span>
          <span class="macro-chip"><span class="num">${f.carbs}</span>g<span class="macro-label">${t('carbs_label')}</span></span>
        </div>
      </div>
      <div class="data-actions">
        <button class="icon-btn" data-edit-food="${f.id}">${icon('edit', 15)}</button>
        <button class="icon-btn danger" data-delete-food="${f.id}">${icon('trash', 15)}</button>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    ${vaultBar({ action: icon('plus', 20) })}

    <div class="page-header">
      <div class="page-eyebrow">${t('reference_items')} · ${list.length}</div>
      <h1 class="page-title">${t('food')}</h1>
      <p class="page-subtitle">${t('food_subtitle')}</p>
    </div>

    <div class="toolbar" style="display:flex;gap:10px;margin-bottom:14px">
      <div class="search-wrap">
        ${icon('search', 18)}
        <input type="search" id="food-search" placeholder="${t('search_foods')}" value="${escapeHtml(query)}">
      </div>
      <button class="btn btn-primary" id="add-food-btn">${icon('plus', 16)} ${t('add')}</button>
    </div>

    ${filtered.length === 0
      ? emptyState({
          iconName: 'apple',
          title: list.length === 0 ? t('no_foods_yet') : t('no_matches_simple'),
          text: list.length === 0 ? t('no_foods_text') : t('no_matches_text'),
        })
      : `<div class="data-list">${items}</div>`
    }
  `;

  bindVaultAction(() => openFoodModal());
  $('#food-search', el).addEventListener('input', (e) => {
    viewContext.foodQuery = e.target.value;
    renderFood(el);
    const s = $('#food-search', el);
    if (s) { s.focus(); s.setSelectionRange(e.target.value.length, e.target.value.length); }
  });
  $('#add-food-btn', el).addEventListener('click', () => openFoodModal());
  el.querySelectorAll('[data-edit-food]').forEach((b) =>
    b.addEventListener('click', () => openFoodModal(b.dataset.editFood))
  );
  el.querySelectorAll('[data-delete-food]').forEach((b) =>
    b.addEventListener('click', () => {
      confirmDialog({
        title: t('delete_food_q'),
        text: t('delete_food_text'),
        onConfirm: () => {
          DB.foods.remove(b.dataset.deleteFood);
          showToast(t('deleted'));
          renderFood(el);
        },
      });
    })
  );
}

function openFoodModal(foodId = null) {
  const existing = foodId ? DB.foods.list().find((f) => f.id === foodId) : null;
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
      <input type="text" id="food-name" placeholder="Chicken Breast" value="${existing ? escapeHtml(existing.name) : ''}">
    </div>

    <div class="form-group">
      <label class="form-label">${t('serving_opt')}</label>
      <input type="text" id="food-serving" placeholder="${t('serving_hint')}" value="${existing ? escapeHtml(existing.serving) : ''}">
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

    <div class="form-group">
      <label class="form-label">${t('carbs_g')}</label>
      <input type="number" inputmode="decimal" id="food-carb" step="0.1" min="0" value="${existing ? existing.carbs : ''}" placeholder="0">
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
      <button type="button" class="btn btn-primary" id="save-food-btn">${existing ? t('update') : t('save')}</button>
    </div>
  `);

  $('#save-food-btn').addEventListener('click', () => {
    const name = $('#food-name').value.trim();
    const serving = $('#food-serving').value.trim();
    const calories = Number($('#food-cal').value);
    const protein = Number($('#food-pro').value);
    const carbs = Number($('#food-carb').value);
    if (!name) { showToast(t('enter_name')); return; }
    if (existing) {
      DB.foods.update(existing.id, { name, serving, calories, protein, carbs });
      showToast(t('updated'));
    } else {
      DB.foods.add({ name, serving, calories, protein, carbs });
      showToast(t('saved'));
    }
    closeModal();
    renderView(currentView);
  });

  setTimeout(() => $('#food-name')?.focus(), 60);
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
    ${vaultBar({ action: icon('plus', 20) })}

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
        <div class="compare-card-title">${escapeHtml(ex.name)}</div>
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
    { id: 'dark', name: t('theme_dark'), sub: t('theme_dark_sub'), cls: 'theme-preview-dark', dots: ['#2dd4bf', '#0c1f28', '#90a8b2'] },
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

    <div class="settings-section">
      <div class="section-title" style="margin-top:0">${t('language')}</div>
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

  // Language buttons
  el.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setLang(b.dataset.lang);
      applyLang(b.dataset.lang);
      renderSettings(el);
    })
  );

  // Theme cards
  el.querySelectorAll('[data-theme]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.prefs.setTheme(b.dataset.theme);
      applyTheme(b.dataset.theme);
      renderSettings(el);
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
  const plan = DB.plan.get() || {};
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const today = new Date().getDay();

  // Display order: Sun, Mon, ... Sat
  const dayOrder = [0, 1, 2, 3, 4, 5, 6];

  const hasAnyPlan = Object.values(plan).some((d) => d && d.exerciseIds && d.exerciseIds.length > 0);

  // A single draggable exercise row inside a day.
  const exRow = (ex, dow) => `
    <div class="planner-ex-row" data-exid="${ex.id}" data-dow="${dow}">
      <span class="planner-ex-grip" aria-label="drag">${icon('grip', 18)}</span>
      <span class="planner-ex-cat" data-cat="${escapeHtml(ex.category)}"></span>
      <span class="planner-ex-name">${escapeHtml(ex.name)}</span>
      <button class="planner-ex-remove" data-remove="${ex.id}" data-rdow="${dow}" aria-label="${t('remove_from_day')}">${icon('close', 14)}</button>
    </div>
  `;

  const dayCards = dayOrder.map((dow) => {
    const day = plan[String(dow)];
    const isToday = dow === today;
    const exObjs = (day?.exerciseIds || []).map((id) => exerciseById[id]).filter(Boolean);
    const exCount = exObjs.length;
    const hasPlan = !!day && (exCount > 0 || !!(day.name && day.name.trim()));

    const body = exCount > 0
      ? `<div class="planner-ex-list" data-daylist="${dow}">${exObjs.map((ex) => exRow(ex, dow)).join('')}</div>`
      : `<div class="planner-ex-list empty" data-daylist="${dow}"><div class="planner-empty-hint">${t('empty_day_drop')}</div></div>`;

    return `
      <div class="planner-day ${hasPlan ? 'has-plan' : ''} ${isToday ? 'today' : ''}" data-day="${dow}">
        <div class="planner-day-head">
          ${hasPlan ? `<span class="planner-day-grip" data-daygrip="${dow}" aria-label="${t('move_day')}">${icon('grip', 16)}</span>` : ''}
          <button class="planner-day-open" data-day-open="${dow}">
            <div class="planner-day-dot"></div>
            <div class="planner-day-main">
              <div class="planner-day-name">${escapeHtml(dayName(dow, true))}${isToday ? ' · ' + t('today').toUpperCase() : ''}</div>
              <div class="planner-day-title ${hasPlan ? '' : 'empty'}">${escapeHtml(day?.name || t('rest_day'))}</div>
            </div>
            ${exCount > 0 ? `<div class="planner-day-count num">${fmtNum(exCount)}</div>` : ''}
          </button>
          <button class="planner-day-add" data-day-add="${dow}" aria-label="${t('add')}">${icon('plus', 18)}</button>
        </div>
        ${body}
      </div>
    `;
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

    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button class="btn btn-primary" id="apply-template-btn" style="flex:1">${icon('plus', 16)} ${t('apply_template')}</button>
      ${hasAnyPlan ? `<button class="btn btn-ghost" id="clear-plan-btn">${icon('trash', 16)}</button>` : ''}
    </div>

    ${hasAnyPlan ? `<div class="planner-drag-hint">${icon('grip', 14)} ${t('drag_to_move')}</div>` : ''}

    <div class="planner-list">${dayCards}</div>
  `;

  $('#apply-template-btn', el)?.addEventListener('click', openTemplatesModal);

  $('#clear-plan-btn', el)?.addEventListener('click', () => {
    confirmDialog({
      title: t('clear_plan_q'),
      text: t('clear_plan_text'),
      confirmLabel: t('clear_plan'),
      onConfirm: () => {
        DB.plan.clearAll();
        showToast(t('plan_cleared'));
        renderPlanner(el);
      },
    });
  });

  // Tap a day's header:
  //   - if it has exercises → open the workout-session page (edit available there)
  //   - if it's empty (rest day) → open the editor so the user can add exercises
  el.querySelectorAll('[data-day-open]').forEach((b) =>
    b.addEventListener('click', () => {
      const dow = Number(b.dataset.dayOpen);
      const day = (DB.plan.get() || {})[String(dow)];
      if (day && day.exerciseIds && day.exerciseIds.length > 0) {
        navigate('session-day', { dow });
      } else {
        openDayEditorModal(dow);
      }
    })
  );

  // Quick "+" on each day opens the picker straight for that day.
  el.querySelectorAll('[data-day-add]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openDayEditorModal(Number(b.dataset.dayAdd));
    })
  );

  // Remove a single exercise from a day.
  el.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      DB.plan.removeExercise(Number(b.dataset.rdow), b.dataset.remove);
      renderPlanner(el);
    })
  );

  setupPlannerDrag(el);
}

// Pointer-based drag-and-drop for the planner. Works with both mouse and
// touch. Listeners are attached to the persistent view element once; they
// re-query the live DOM on each event so they survive re-renders.
function setupPlannerDrag(el) {
  if (el._plannerDragInit) return;
  el._plannerDragInit = true;

  const scroller = el.closest('.main') || document.scrollingElement || document.documentElement;
  let drag = null;
  let scrollRAF = null;
  let scrollDir = 0;

  function stopAutoScroll() {
    scrollDir = 0;
    if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
  }
  function autoScrollTick() {
    if (!drag || scrollDir === 0) { scrollRAF = null; return; }
    scroller.scrollTop += scrollDir * 11;
    scrollRAF = requestAnimationFrame(autoScrollTick);
  }
  function maybeAutoScroll(clientY) {
    const r = scroller.getBoundingClientRect();
    const edge = 72;
    if (clientY < r.top + edge) scrollDir = -1;
    else if (clientY > r.bottom - edge) scrollDir = 1;
    else scrollDir = 0;
    if (scrollDir !== 0 && !scrollRAF) scrollRAF = requestAnimationFrame(autoScrollTick);
    if (scrollDir === 0) stopAutoScroll();
  }

  // Position the placeholder inside a target list and compute the insert index.
  function positionPlaceholder(list, clientY) {
    const rows = [...list.querySelectorAll('.planner-ex-row')].filter(
      (r) => r !== drag.row && r.style.display !== 'none'
    );
    let before = null;
    for (const r of rows) {
      const rb = r.getBoundingClientRect();
      if (clientY < rb.top + rb.height / 2) { before = r; break; }
    }
    if (before) {
      list.insertBefore(drag.placeholder, before);
    } else {
      const hint = list.querySelector('.planner-empty-hint');
      if (hint) list.insertBefore(drag.placeholder, hint);
      else list.appendChild(drag.placeholder);
    }
    const seq = [...list.children].filter(
      (n) => n === drag.placeholder ||
        (n.classList.contains('planner-ex-row') && n !== drag.row && n.style.display !== 'none')
    );
    drag.targetIndex = seq.indexOf(drag.placeholder);
  }

  el.addEventListener('pointerdown', (e) => {
    // Whole-day drag (grip on the day header) — moves the entire day's plan.
    const dayGrip = e.target.closest('.planner-day-grip');
    if (dayGrip) {
      const card = dayGrip.closest('.planner-day');
      if (!card) return;
      e.preventDefault();

      const rect = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      ghost.classList.add('planner-day-ghost');
      ghost.style.width = rect.width + 'px';
      ghost.style.left = rect.left + 'px';
      ghost.style.top = rect.top + 'px';
      document.body.appendChild(ghost);

      drag = {
        mode: 'day',
        fromDow: dayGrip.dataset.daygrip,
        card, ghost,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        targetDow: null,
      };

      card.classList.add('day-drag-source');
      document.body.classList.add('planner-dragging');
      try { dayGrip.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    // Single-exercise drag (grip on a row).
    const grip = e.target.closest('.planner-ex-grip');
    if (!grip) return;
    const row = grip.closest('.planner-ex-row');
    if (!row) return;
    e.preventDefault();

    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    ghost.classList.add('planner-ex-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);

    const ph = document.createElement('div');
    ph.className = 'planner-ex-placeholder';

    drag = {
      mode: 'row',
      exId: row.dataset.exid,
      fromDow: row.dataset.dow,
      row, ghost, placeholder: ph,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      targetDow: row.dataset.dow,
      targetIndex: null,
    };

    row.parentNode.insertBefore(ph, row.nextSibling);
    row.style.display = 'none';
    document.body.classList.add('planner-dragging');
    try { grip.setPointerCapture(e.pointerId); } catch (_) {}
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
    drag.ghost.style.top = (e.clientY - drag.offsetY) + 'px';

    const below = document.elementFromPoint(e.clientX, e.clientY);
    const dayCard = below && below.closest('.planner-day');

    if (drag.mode === 'day') {
      // Highlight a different day as the swap target.
      el.querySelectorAll('.planner-day.drop-target').forEach((d) => d.classList.remove('drop-target'));
      if (dayCard && dayCard.dataset.day !== String(drag.fromDow)) {
        drag.targetDow = dayCard.dataset.day;
        dayCard.classList.add('drop-target');
      } else {
        drag.targetDow = null;
      }
    } else if (dayCard) {
      const list = dayCard.querySelector('.planner-ex-list');
      if (list) {
        drag.targetDow = dayCard.dataset.day;
        positionPlaceholder(list, e.clientY);
        el.querySelectorAll('.planner-day.drop-target').forEach((d) => d.classList.remove('drop-target'));
        dayCard.classList.add('drop-target');
      }
    }
    maybeAutoScroll(e.clientY);
  });

  function finish() {
    if (!drag) return;
    const mode = drag.mode;
    const { fromDow, targetDow } = drag;
    drag.ghost.remove();
    document.body.classList.remove('planner-dragging');
    el.querySelectorAll('.planner-day.drop-target').forEach((d) => d.classList.remove('drop-target'));
    el.querySelectorAll('.planner-day.day-drag-source').forEach((d) => d.classList.remove('day-drag-source'));
    stopAutoScroll();

    if (mode === 'day') {
      const valid = targetDow != null && String(targetDow) !== String(fromDow);
      drag = null;
      if (valid) {
        DB.plan.swapDays(fromDow, targetDow);
        showToast(t('day_moved'));
        renderPlanner(el);
      }
      return;
    }

    // Single-exercise drag
    const { exId, targetIndex } = drag;
    if (drag.placeholder.parentNode) drag.placeholder.remove();
    drag.row.style.display = '';
    const crossDay = String(targetDow) !== String(fromDow);
    const reordered = targetIndex != null;
    drag = null;

    if (targetDow != null && (crossDay || reordered)) {
      DB.plan.moveExercise(fromDow, targetDow, exId, targetIndex);
      if (crossDay) showToast(t('exercise_moved'));
      renderPlanner(el);
    }
  }

  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

function openTemplatesModal() {
  const cards = WORKOUT_TEMPLATES.map((tmpl) => `
    <div class="compare-card" style="margin-bottom:8px">
      <div class="compare-card-title">${escapeHtml(tmpl.name)}</div>
      <div style="font-size:12px;color:var(--text-mute);margin-bottom:10px">${escapeHtml(tmpl.description)} · ${fmtNum(tmpl.days.length)} ${tmpl.days.length === 1 ? 'day' : 'days'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${tmpl.days.map((d) => `<span class="today-plan-chip">${escapeHtml(d.name)}</span>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" data-apply="${tmpl.id}">${t('apply')}</button>
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
  `);

  document.querySelectorAll('[data-apply]').forEach((b) =>
    b.addEventListener('click', () => {
      const tmpl = WORKOUT_TEMPLATES.find((x) => x.id === b.dataset.apply);
      if (!tmpl) return;
      // Map exercise names to user's exercise IDs (and add to inMyList if not already)
      const allEx = DB.exercises.list();
      const byName = Object.fromEntries(allEx.map((e) => [e.name, e]));
      const days = tmpl.days.map((d) => {
        const ids = [];
        d.exercises.forEach((nm) => {
          const ex = byName[nm];
          if (ex) {
            ids.push(ex.id);
            if (!ex.inMyList) DB.exercises.setInMyList(ex.id, true);
          }
        });
        return { name: d.name, exerciseIds: ids };
      });
      DB.plan.applyTemplate(days);
      closeModal();
      showToast(t('template_applied'));
      renderView(currentView);
    })
  );
}

function openDayEditorModal(dow) {
  const plan = DB.plan.get() || {};
  const day = plan[String(dow)] || { name: '', exerciseIds: [] };
  let pickedIds = new Set(day.exerciseIds || []);
  let dayLabel = day.name || '';
  let pickerQuery = '';
  let pickerCategory = 'All';

  const allExercises = DB.exercises.list();

  function renderPickerList() {
    const container = $('#picker-list');
    if (!container) return;
    let list = allExercises;
    if (pickerCategory !== 'All') list = list.filter((e) => e.category === pickerCategory);
    if (pickerQuery) list = list.filter((e) => e.name.toLowerCase().includes(pickerQuery.toLowerCase()));

    container.innerHTML = list.map((ex) => `
      <button type="button" class="picker-row ${pickedIds.has(ex.id) ? 'picked' : ''}" data-pick="${ex.id}">
        <span class="picker-row-cat" data-cat="${escapeHtml(ex.category)}"></span>
        <span class="picker-row-name">${escapeHtml(ex.name)}</span>
        <span class="picker-row-check">${icon('check', 14)}</span>
      </button>
    `).join('');

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
        <div class="modal-title">${escapeHtml(window.dayName ? window.dayName(dow, true) : '')}</div>
        <div class="modal-subtitle">${t('edit_day')}</div>
      </div>
      <button class="icon-btn icon-btn-tile" data-close>${icon('close', 18)}</button>
    </div>

    <div class="form-group">
      <label class="form-label">${t('name')}</label>
      <input type="text" id="day-name" placeholder="${t('day_name_placeholder')}" value="${escapeHtml(dayLabel)}">
    </div>

    <div class="form-group">
      <label class="form-label">${t('pick_exercises')}</label>
      <div class="search-wrap" style="margin-bottom:8px">
        ${icon('search', 18)}
        <input type="search" id="picker-search" placeholder="${t('search_exercises')}">
      </div>
      <div class="filter-bar" style="margin: 0 0 10px">${catPills}</div>
      <div class="picker-list" id="picker-list"></div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-danger" id="day-clear-btn">${icon('trash', 14)} ${t('rest_day')}</button>
      <button type="button" class="btn btn-primary" id="day-save-btn">${t('save')}</button>
    </div>
  `);

  // Set the modal title to the actual day name
  const titleEl = document.querySelector('#modal-root .modal-title');
  if (titleEl) titleEl.textContent = dayName(dow, true);

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

  $('#day-clear-btn').addEventListener('click', () => {
    DB.plan.clearDay(dow);
    closeModal();
    showToast(t('day_cleared'));
    renderView(currentView);
  });

  $('#day-save-btn').addEventListener('click', () => {
    const ids = [...pickedIds];
    if (ids.length === 0 && !dayLabel.trim()) {
      DB.plan.clearDay(dow);
    } else {
      DB.plan.setDay(dow, { name: dayLabel.trim() || 'Workout', exerciseIds: ids });
      // Auto-add picked exercises to user's Train list
      ids.forEach((id) => {
        const ex = DB.exercises.getById(id);
        if (ex && !ex.inMyList) DB.exercises.setInMyList(id, true);
      });
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
  const dow = Number(viewContext.dow);
  const plan = DB.plan.get() || {};
  const day = plan[String(dow)];
  const exerciseById = Object.fromEntries(DB.exercises.list().map((e) => [e.id, e]));
  const exObjs = (day?.exerciseIds || []).map((id) => exerciseById[id]).filter(Boolean);

  // Per-exercise local state for unsaved edits. Persists across re-renders
  // until the user navigates away.
  if (!viewContext.sdState) viewContext.sdState = {};
  const sdState = viewContext.sdState;

  // Date stored on viewContext so the user's pick survives re-renders
  if (!viewContext.sdDate) viewContext.sdDate = todayISO();

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
    if (sdState[exId]) return sdState[exId];
    const today = todaySessionFor(exId);
    const last = DB.sessions.lastForExercise(exId);
    let sets;
    if (today) sets = today.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
    else if (last) sets = last.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
    else sets = [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }];
    sdState[exId] = { sets, savedSessionId: today ? today.id : null, dirty: false };
    return sdState[exId];
  }

  function renderExerciseCard(ex) {
    const st = initState(ex.id);
    const url = exerciseImgSrc(ex);
    const machineSvg = ex.machineType ? machineSvgFor(ex.machineType) : '';
    const last = DB.sessions.lastForExercise(ex.id, st.savedSessionId);
    const lastPreview = last
      ? last.sets.map((s) => `${s.reps}×${fmtNum(modalConvertForDisplay(s.weight))}${viewContext.sdUnit}`).join(' · ')
      : t('no_sessions_yet');
    const isLogged = !!st.savedSessionId;

    let bgHtml;
    if (machineSvg) {
      bgHtml = `<div class="sd-thumb machine-bg">${machineSvg}${url ? `<img src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;
    } else if (url) {
      bgHtml = `<div class="sd-thumb" style="background-image:url('${url}')"></div>`;
    } else {
      bgHtml = `<div class="sd-thumb fallback">${escapeHtml(initialsOf(ex.name))}</div>`;
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
            <div class="sd-card-name">${escapeHtml(ex.name)}</div>
            <div class="sd-card-last">${escapeHtml(lastPreview)}</div>
          </div>
          ${isLogged ? `<div class="sd-status-pill">${icon('check', 12)} ${t('logged')}</div>` : ''}
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
          <button type="button" class="btn btn-primary sd-save-btn" data-save-ex="${ex.id}">${isLogged ? t('update') : t('save')}</button>
        </div>
      </div>
    `;
  }

  const totalEx = exObjs.length;
  const loggedCount = exObjs.filter((ex) => sdState[ex.id]?.savedSessionId || todaySessionFor(ex.id)).length;

  el.innerHTML = `
    <div class="detail-top">
      <button class="back-btn" data-goto="planner">${icon('back', 20)}</button>
      <div class="detail-top-title">${escapeHtml(dayName(dow, true))}</div>
      <button class="icon-btn icon-btn-tile" id="sd-edit-day" aria-label="${escapeHtml(t('edit_day'))}">${icon('edit', 18)}</button>
    </div>

    <div class="page-header">
      <div class="page-eyebrow">${escapeHtml(dayName(dow, true))}</div>
      <h1 class="page-title">${escapeHtml(day?.name || t('start_workout'))}</h1>
      <p class="page-subtitle">${fmtNum(loggedCount)} / ${fmtNum(totalEx)} ${t('logged_today')}</p>
    </div>

    <div class="sd-toolbar">
      <div class="form-group" style="flex:1;margin:0">
        <label class="form-label" style="font-size:10px">${t('date')}</label>
        <input type="date" id="sd-date" value="${viewContext.sdDate}">
      </div>
      <div class="modal-unit-toggle" role="group" aria-label="${escapeHtml(t('unit'))}">
        <button type="button" data-sd-unit="kg" class="${viewContext.sdUnit === 'kg' ? 'active' : ''}">KG</button>
        <button type="button" data-sd-unit="lb" class="${viewContext.sdUnit === 'lb' ? 'active' : ''}">LB</button>
      </div>
    </div>

    ${totalEx === 0
      ? emptyState({ iconName: 'dumbbell', title: t('rest_day'), text: t('no_plan_today_sub') })
      : `<div class="sd-list">${exObjs.map(renderExerciseCard).join('')}</div>`
    }
  `;

  // ----- Bindings -----

  $('#sd-edit-day', el)?.addEventListener('click', () => openDayEditorModal(dow));

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
      st.sets.push({ reps: last?.reps || 10, weight: last?.weight || 0 });
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
      if (existingId) {
        DB.sessions.update(existingId, { date: viewContext.sdDate, sets: cleaned });
        showToast(t('session_updated'));
      } else {
        const created = DB.sessions.add({ exerciseId: exId, date: viewContext.sdDate, sets: cleaned });
        st.savedSessionId = created.id;
        showToast(t('session_saved'));
      }
      st.dirty = false;
      renderSessionDay(el);
    })
  );
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

  // Empty cells before the first day
  const empties = Array.from({ length: firstDow }, () => `<div class="calendar-cell empty"></div>`).join('');
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${ctx.year}-${String(ctx.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = setsByDate[iso] || 0;
    const lvl = lvlFor(count);
    const isToday = today.getFullYear() === ctx.year && today.getMonth() === ctx.month && today.getDate() === day;
    return `<button class="calendar-cell lvl-${lvl} ${isToday ? 'today' : ''}" data-day-iso="${iso}">${fmtNum(day)}</button>`;
  }).join('');

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
      <div class="calendar-month-label">${escapeHtml(monthLabel)}</div>
      <button class="calendar-nav-btn" id="cal-next">${icon('chevronRight', 18)}</button>
    </div>

    <div class="calendar-dow-row">${dowLabels}</div>
    <div class="calendar-grid">${empties}${cells}</div>

    <div class="calendar-legend">
      <span>—</span>
      <span class="calendar-legend-dot" style="background:var(--surface-2)"></span>
      <span class="calendar-legend-dot" style="background:rgba(45,212,191,0.18)"></span>
      <span class="calendar-legend-dot" style="background:rgba(45,212,191,0.32)"></span>
      <span class="calendar-legend-dot" style="background:rgba(45,212,191,0.55)"></span>
      <span class="calendar-legend-dot" style="background:var(--accent)"></span>
      <span>+</span>
    </div>
  `;

  $('#cal-prev', el).addEventListener('click', () => {
    if (ctx.month === 0) { ctx.month = 11; ctx.year -= 1; } else ctx.month -= 1;
    renderCalendar(el);
  });
  $('#cal-next', el).addEventListener('click', () => {
    if (ctx.month === 11) { ctx.month = 0; ctx.year += 1; } else ctx.month += 1;
    renderCalendar(el);
  });

  el.querySelectorAll('[data-day-iso]').forEach((b) =>
    b.addEventListener('click', () => openCalendarDayModal(b.dataset.dayIso))
  );
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
          <div class="data-icon ${c.type}">${icon(c.type === 'cycling' ? 'bike' : c.type === 'walking' ? 'walk' : 'treadmill', 18)}</div>
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

  const items = list.map((s) => {
    const taken = DB.supplements.isTaken(s.id, todayIso);
    const streak = DB.supplements.streak(s.id);
    return `
      <div class="supp-row ${taken ? 'taken' : ''}">
        <div class="supp-color" style="background:${escapeHtml(s.color)}"></div>
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
  }).join('');

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
      <button class="btn btn-primary" id="add-supp-btn">${icon('plus', 16)} ${t('new_supplement')}</button>
    </div>

    ${list.length === 0
      ? emptyState({ iconName: 'zap', title: t('no_supplements'), text: t('no_supplements_text') })
      : `<div class="data-list">${items}</div>`
    }
  `;

  $('#add-supp-btn', el).addEventListener('click', () => openSupplementModal());

  el.querySelectorAll('[data-toggle-supp]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.toggleSupp;
      const isTaken = DB.supplements.isTaken(id, todayIso);
      DB.supplements.setTaken(id, todayIso, !isTaken);
      showToast(!isTaken ? t('taken') : t('not_taken'));
      renderSupplements(el);
    })
  );

  el.querySelectorAll('[data-edit-supp]').forEach((b) =>
    b.addEventListener('click', () => openSupplementModal(b.dataset.editSupp))
  );
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
      <input type="text" id="supp-name" placeholder="Creatine" value="${existing ? escapeHtml(existing.name) : ''}" autofocus>
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

  const items = entries.map((e) => {
    const m = e.servings || 1;
    return `
      <div class="food-log-row">
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
  }).join('');

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

    <div class="row-between mb-16">
      <div class="section-title" style="margin:0">${t('food_log_title')}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="ai-food-btn">${icon('zap', 16)} ${t('ai_chat_btn')}</button>
        <button class="btn btn-primary" id="add-foodlog-btn">${icon('plus', 16)} ${t('add_food_log')}</button>
      </div>
    </div>

    ${entries.length === 0
      ? emptyState({ iconName: 'apple', title: t('no_food_logged'), text: t('no_food_logged_text') })
      : `<div class="data-list" style="gap:6px">${items}</div>`
    }
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

  el.querySelectorAll('[data-del-food]').forEach((b) =>
    b.addEventListener('click', () => {
      DB.foodLogs.remove(ctx.date, b.dataset.delFood);
      showToast(t('food_removed'));
      renderFoodLog(el);
    })
  );
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
(function init() {
  const prefs = DB.prefs.get();
  applyTheme(prefs.theme || 'dark');
  applyLang(prefs.lang || 'en');
  navigate('home');
})();
