// ==========================================================================
// Gym Tracker - Storage Layer
// Persists everything to localStorage under a single key.
// ==========================================================================

const STORAGE_KEY = 'gym_tracker_v1';
const SCHEMA_VERSION = 1;

// Image slugs reference the free-exercise-db on GitHub.
// URL pattern: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{slug}/0.jpg
const SEED_EXERCISES = [
  // The big three
  { name: 'Squat', category: 'Legs', imageSlug: 'Barbell_Squat' },
  { name: 'Bench Press', category: 'Chest', imageSlug: 'Barbell_Bench_Press_-_Medium_Grip' },
  { name: 'Deadlift', category: 'Back', imageSlug: 'Barbell_Deadlift' },

  // Chest
  { name: 'Incline Bench Press', category: 'Chest', imageSlug: 'Barbell_Incline_Bench_Press_-_Medium_Grip' },
  { name: 'Dumbbell Press', category: 'Chest', imageSlug: 'Dumbbell_Bench_Press' },
  { name: 'Dumbbell Fly', category: 'Chest', imageSlug: 'Dumbbell_Flyes' },
  { name: 'Push Up', category: 'Chest', imageSlug: 'Pushups' },

  // Back
  { name: 'Barbell Row', category: 'Back', imageSlug: 'Bent_Over_Barbell_Row' },
  { name: 'Pull Up', category: 'Back', imageSlug: 'Pullups' },
  { name: 'Dumbbell Row', category: 'Back', imageSlug: 'One-Arm_Dumbbell_Row' },

  // Legs
  { name: 'Front Squat', category: 'Legs', imageSlug: 'Front_Barbell_Squat' },
  { name: 'Romanian Deadlift', category: 'Legs', imageSlug: 'Romanian_Deadlift' },
  { name: 'Lunges', category: 'Legs', imageSlug: 'Dumbbell_Lunges' },
  { name: 'Calf Raise', category: 'Legs', imageSlug: 'Standing_Barbell_Calf_Raise' },

  // Shoulders
  { name: 'Overhead Press', category: 'Shoulders', imageSlug: 'Standing_Military_Press' },
  { name: 'Lateral Raise', category: 'Shoulders', imageSlug: 'Side_Lateral_Raise' },
  { name: 'Front Raise', category: 'Shoulders', imageSlug: 'Front_Dumbbell_Raise' },
  { name: 'Rear Delt Fly', category: 'Shoulders', imageSlug: 'Bent_Over_Low-Pulley_Side_Lateral' },
  { name: 'Shrugs', category: 'Shoulders', imageSlug: 'Barbell_Shrug' },

  // Arms
  { name: 'Barbell Curl', category: 'Arms', imageSlug: 'Barbell_Curl' },
  { name: 'EZ Bar Curl', category: 'Arms', imageSlug: 'EZ-Bar_Curl' },
  { name: 'Dumbbell Curl', category: 'Arms', imageSlug: 'Dumbbell_Bicep_Curl' },
  { name: 'Incline Dumbbell Curl', category: 'Arms', imageSlug: 'Incline_Dumbbell_Curl' },
  { name: 'Hammer Curl', category: 'Arms', imageSlug: 'Hammer_Curls' },
  { name: 'Concentration Curl', category: 'Arms', imageSlug: 'Concentration_Curls' },
  { name: 'Spider Curl', category: 'Arms', imageSlug: 'Spider_Curl' },
  { name: 'Reverse Curl', category: 'Arms', imageSlug: 'Reverse_Barbell_Curl' },
  { name: 'Chin-Up', category: 'Arms', imageSlug: 'Chin-Up' },
  { name: 'Tricep Pushdown', category: 'Arms', imageSlug: 'Triceps_Pushdown' },
  { name: 'Tricep Extension', category: 'Arms', imageSlug: 'Standing_Dumbbell_Triceps_Extension' },
  { name: 'Dips', category: 'Arms', imageSlug: 'Dips_-_Triceps_Version' },

  // Core
  { name: 'Plank', category: 'Core', imageSlug: 'Plank' },
  { name: 'Crunches', category: 'Core', imageSlug: 'Crunches' },
  { name: 'Leg Raise', category: 'Core', imageSlug: 'Hanging_Leg_Raise' },
  { name: 'Russian Twist', category: 'Core', imageSlug: 'Russian_Twist' },

  // Machines live in MACHINE_SEED below (each with a clean blueprint + photo).
];

// Exercise photos are BUNDLED inside the app under assets/ex/<slug>.jpg, so the
// library renders from our own origin — no dependency on the external image host,
// and the browser caches them for offline use. Any slug that isn't bundled (e.g.
// an admin-catalog extra added later) still falls back to the remote source so it
// isn't left blank. BUNDLED_EX_SLUGS is derived from the seed catalogs below.
const EXERCISE_IMAGE_LOCAL = 'assets/ex';
const EXERCISE_IMAGE_REMOTE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

function exerciseImageUrl(imageSlug) {
  if (!imageSlug) return '';
  if (BUNDLED_EX_SLUGS.has(imageSlug)) return `${EXERCISE_IMAGE_LOCAL}/${imageSlug}.jpg`;
  return `${EXERCISE_IMAGE_REMOTE}/${imageSlug}/0.jpg`;
}

// ==========================================================================
// Machine illustrations — clean SVG silhouettes of gym machines (no people)
// Used for exercises whose `machineType` field is set. Returns a data URI
// that can be used as a CSS background-image.
// ==========================================================================
// The last two colours in the app from the retired teal era: a navy plate with a
// #2dd4bf line, on the most-repeated surface in the product (every exercise card
// in the grid). Re-cut to the identity — a warm near-black plate from the surface
// ramp, and a warm neutral line at 5.49:1 on it. Deliberately NOT the accent: a
// whole grid of orange blueprints is the "accent as wallpaper" failure the v210
// pass removed. These are computed at render time, so changing them here repaints
// every card immediately; nothing is cached.
const MACHINE_SVG_BG = '#140f0a';
const MACHINE_SVG_STROKE = '#948878';

function machineSvgFor(type) {
  const bg = MACHINE_SVG_BG;
  const s = MACHINE_SVG_STROKE;
  const head = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 180' preserveAspectRatio='xMidYMid slice'><rect width='240' height='180' fill='${bg}'/><g stroke='${s}' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'>`;
  const tail = `</g></svg>`;

  // Each shape: stylized blueprint of the machine. Distinct silhouettes per type.
  const shapes = {
    chest_press:
      // Bench (back + seat), pivoting arms with handles, weight stack on right
      `<path d='M70 130 L70 70 L100 60'/><path d='M40 130 L120 130 L120 150 L40 150 Z'/><circle cx='100' cy='75' r='4'/><line x1='100' y1='75' x2='160' y2='55'/><circle cx='160' cy='55' r='6'/><line x1='100' y1='75' x2='160' y2='95'/><circle cx='160' cy='95' r='6'/><rect x='190' y='55' width='30' height='110'/><line x1='190' y1='80' x2='220' y2='80'/><line x1='190' y1='110' x2='220' y2='110'/><line x1='190' y1='140' x2='220' y2='140'/>`,

    pec_deck:
      // Vertical seat with two pads pivoting forward (front view)
      `<line x1='120' y1='40' x2='120' y2='130'/><path d='M100 130 L140 130 L140 150 L100 150 Z'/><circle cx='120' cy='80' r='4'/><line x1='120' y1='80' x2='65' y2='65'/><rect x='40' y='50' width='10' height='35' fill='${s}'/><line x1='120' y1='80' x2='175' y2='65'/><rect x='190' y='50' width='10' height='35' fill='${s}'/><line x1='75' y1='160' x2='165' y2='160'/>`,

    shoulder_press:
      // Vertical seat with handles overhead
      `<path d='M100 150 L100 90 L80 80'/><path d='M70 150 L130 150 L130 170 L70 170 Z'/><circle cx='100' cy='90' r='4'/><line x1='100' y1='90' x2='90' y2='40'/><circle cx='90' cy='40' r='5'/><line x1='100' y1='90' x2='130' y2='40'/><circle cx='130' cy='40' r='5'/><rect x='180' y='50' width='28' height='110'/><line x1='180' y1='75' x2='208' y2='75'/><line x1='180' y1='100' x2='208' y2='100'/><line x1='180' y1='125' x2='208' y2='125'/><line x1='180' y1='150' x2='208' y2='150'/>`,

    lateral_raise:
      // Seat with pads on swivels going up-out (deltoid raise)
      `<path d='M100 130 L100 70'/><path d='M80 130 L130 130 L130 155 L80 155 Z'/><circle cx='100' cy='80' r='4'/><line x1='100' y1='80' x2='55' y2='40'/><line x1='40' y1='32' x2='60' y2='40' stroke-width='5'/><line x1='100' y1='80' x2='150' y2='40'/><line x1='145' y1='32' x2='165' y2='40' stroke-width='5'/><rect x='180' y='60' width='28' height='100'/><line x1='180' y1='85' x2='208' y2='85'/><line x1='180' y1='115' x2='208' y2='115'/><line x1='180' y1='145' x2='208' y2='145'/>`,

    rear_delt_fly:
      // Seat with chest pad, arms extending behind (reverse fly machine)
      `<line x1='120' y1='40' x2='120' y2='130'/><path d='M100 130 L140 130 L140 150 L100 150 Z'/><line x1='100' y1='80' x2='130' y2='80' stroke-width='5'/><circle cx='120' cy='80' r='4'/><line x1='120' y1='80' x2='180' y2='100'/><circle cx='185' cy='100' r='5'/><line x1='120' y1='80' x2='60' y2='100'/><circle cx='55' cy='100' r='5'/><line x1='80' y1='160' x2='160' y2='160'/>`,

    lat_pulldown:
      // Vertical column, pulley at top with cable to bar, knee pad below
      `<line x1='40' y1='30' x2='40' y2='160'/><circle cx='90' cy='40' r='6'/><line x1='90' y1='46' x2='90' y2='95'/><line x1='55' y1='95' x2='125' y2='95'/><line x1='55' y1='95' x2='55' y2='105'/><line x1='125' y1='95' x2='125' y2='105'/><path d='M70 145 L130 145 L130 165 L70 165 Z'/><line x1='75' y1='130' x2='125' y2='130' stroke-width='5'/><rect x='180' y='80' width='28' height='80'/><line x1='180' y1='100' x2='208' y2='100'/><line x1='180' y1='125' x2='208' y2='125'/><line x1='180' y1='150' x2='208' y2='150'/>`,

    seated_row:
      // Bench with footrest in front, low cable to handle
      `<path d='M40 100 L100 100 L100 120 L40 120 Z'/><line x1='100' y1='110' x2='160' y2='110'/><circle cx='160' cy='110' r='6'/><rect x='180' y='100' width='28' height='60'/><line x1='180' y1='120' x2='208' y2='120'/><line x1='180' y1='140' x2='208' y2='140'/><rect x='30' y='130' width='25' height='40' fill='${s}' opacity='0.4'/>`,

    leg_press:
      // Angled platform sled
      `<line x1='30' y1='160' x2='130' y2='40'/><line x1='30' y1='160' x2='30' y2='140'/><rect x='100' y='30' width='50' height='14' transform='rotate(-50 125 37)' fill='${s}' opacity='0.3'/><line x1='40' y1='150' x2='75' y2='110'/><line x1='75' y1='110' x2='110' y2='75'/><circle cx='75' cy='110' r='6'/><line x1='30' y1='160' x2='150' y2='160'/><line x1='150' y1='160' x2='150' y2='140'/><rect x='180' y='80' width='28' height='80'/><line x1='180' y1='105' x2='208' y2='105'/><line x1='180' y1='130' x2='208' y2='130'/>`,

    leg_extension:
      // Seat with leg pivot pad in front
      `<path d='M40 80 L40 130'/><path d='M40 130 L100 130 L100 150 L40 150 Z'/><line x1='100' y1='130' x2='160' y2='100'/><line x1='150' y1='90' x2='170' y2='110' stroke-width='6'/><circle cx='100' cy='130' r='4'/><rect x='180' y='60' width='28' height='100'/><line x1='180' y1='85' x2='208' y2='85'/><line x1='180' y1='115' x2='208' y2='115'/><line x1='180' y1='145' x2='208' y2='145'/>`,

    leg_curl:
      // Lying / seated bench with calf pad rolling down
      `<path d='M40 90 L130 90 L130 110 L40 110 Z'/><line x1='130' y1='100' x2='180' y2='130'/><line x1='170' y1='120' x2='185' y2='140' stroke-width='6'/><circle cx='130' cy='100' r='4'/><rect x='180' y='40' width='28' height='60'/><line x1='180' y1='60' x2='208' y2='60'/><line x1='180' y1='80' x2='208' y2='80'/>`,

    hack_squat:
      // Standing angled sled with shoulder pads
      `<line x1='40' y1='160' x2='160' y2='40'/><line x1='130' y1='70' x2='180' y2='100'/><rect x='100' y='40' width='50' height='14' transform='rotate(-50 125 47)' fill='${s}' opacity='0.3'/><line x1='40' y1='160' x2='180' y2='160'/><line x1='180' y1='160' x2='180' y2='100'/><circle cx='130' cy='70' r='5'/><rect x='195' y='80' width='25' height='80'/><line x1='195' y1='100' x2='220' y2='100'/><line x1='195' y1='130' x2='220' y2='130'/>`,

    hip_abductor:
      // Seat with two leg pads spreading outward
      `<line x1='120' y1='40' x2='120' y2='90'/><path d='M90 90 L150 90 L150 110 L90 110 Z'/><line x1='100' y1='110' x2='60' y2='150'/><line x1='50' y1='140' x2='70' y2='160' stroke-width='6'/><line x1='140' y1='110' x2='180' y2='150'/><line x1='170' y1='140' x2='190' y2='160' stroke-width='6'/><line x1='80' y1='170' x2='160' y2='170'/>`,

    hip_adductor:
      // Seat with two leg pads pushing inward (knees together)
      `<line x1='120' y1='40' x2='120' y2='90'/><path d='M90 90 L150 90 L150 110 L90 110 Z'/><line x1='100' y1='110' x2='110' y2='160'/><line x1='100' y1='150' x2='120' y2='170' stroke-width='6'/><line x1='140' y1='110' x2='130' y2='160'/><line x1='120' y1='150' x2='140' y2='170' stroke-width='6'/><line x1='60' y1='170' x2='180' y2='170'/>`,

    preacher_curl:
      // Seat with angled arm pad and bar
      `<path d='M40 140 L110 140 L110 160 L40 160 Z'/><path d='M110 140 L160 90 L195 90'/><line x1='195' y1='90' x2='195' y2='75'/><circle cx='195' cy='70' r='5'/><line x1='180' y1='70' x2='210' y2='70'/><rect x='200' y='110' width='25' height='60'/><line x1='200' y1='130' x2='225' y2='130'/><line x1='200' y1='150' x2='225' y2='150'/>`,

    triceps_dip:
      // Seat with handles at sides, footrest below
      `<line x1='90' y1='30' x2='90' y2='100'/><path d='M70 100 L130 100 L130 120 L70 120 Z'/><line x1='65' y1='90' x2='65' y2='130'/><circle cx='65' cy='80' r='5'/><line x1='135' y1='90' x2='135' y2='130'/><circle cx='135' cy='80' r='5'/><rect x='80' y='150' width='40' height='10' fill='${s}' opacity='0.4'/><rect x='180' y='60' width='28' height='100'/><line x1='180' y1='85' x2='208' y2='85'/><line x1='180' y1='115' x2='208' y2='115'/><line x1='180' y1='145' x2='208' y2='145'/>`,

    ab_crunch:
      // Seat with chest pad and overhead handles
      `<line x1='90' y1='30' x2='90' y2='110'/><path d='M70 110 L130 110 L130 130 L70 130 Z'/><line x1='80' y1='50' x2='130' y2='50' stroke-width='5'/><circle cx='80' cy='40' r='5'/><circle cx='130' cy='40' r='5'/><line x1='80' y1='40' x2='80' y2='50'/><line x1='130' y1='40' x2='130' y2='50'/><rect x='180' y='60' width='28' height='100'/><line x1='180' y1='85' x2='208' y2='85'/><line x1='180' y1='115' x2='208' y2='115'/><line x1='180' y1='145' x2='208' y2='145'/>`,
    smith_machine:
      // Two vertical rails with a loaded barbell, bench below
      `<line x1='68' y1='28' x2='68' y2='162'/><line x1='172' y1='28' x2='172' y2='162'/><line x1='52' y1='82' x2='188' y2='82'/><circle cx='60' cy='82' r='10'/><circle cx='180' cy='82' r='10'/><path d='M88 130 L152 130 L152 150 L88 150 Z'/><line x1='100' y1='150' x2='100' y2='165'/><line x1='140' y1='150' x2='140' y2='165'/>`,

    incline_chest_press:
      // Inclined seat back, handles forward, weight stack on right
      `<line x1='72' y1='152' x2='98' y2='78'/><path d='M52 152 L112 152 L112 168 L52 168 Z'/><circle cx='98' cy='84' r='4'/><line x1='98' y1='84' x2='152' y2='68'/><circle cx='157' cy='66' r='6'/><line x1='98' y1='96' x2='152' y2='96'/><circle cx='157' cy='96' r='6'/><rect x='186' y='54' width='28' height='112'/><line x1='186' y1='80' x2='214' y2='80'/><line x1='186' y1='112' x2='214' y2='112'/><line x1='186' y1='144' x2='214' y2='144'/>`,

    cable_crossover:
      // Two tall towers, pulleys at top, cables to handles meeting centre
      `<rect x='28' y='28' width='22' height='134'/><rect x='190' y='28' width='22' height='134'/><circle cx='39' cy='40' r='5'/><circle cx='201' cy='40' r='5'/><line x1='39' y1='45' x2='102' y2='92'/><line x1='201' y1='45' x2='138' y2='92'/><circle cx='104' cy='95' r='4'/><circle cx='136' cy='95' r='4'/><line x1='28' y1='70' x2='50' y2='70'/><line x1='28' y1='100' x2='50' y2='100'/><line x1='190' y1='70' x2='212' y2='70'/><line x1='190' y1='100' x2='212' y2='100'/>`,

    cable_tower:
      // Single adjustable cable column with high pulley and bar
      `<rect x='178' y='28' width='28' height='134'/><circle cx='192' cy='40' r='6'/><line x1='192' y1='46' x2='118' y2='72'/><line x1='92' y1='72' x2='144' y2='72' stroke-width='5'/><line x1='178' y1='72' x2='206' y2='72'/><line x1='178' y1='98' x2='206' y2='98'/><line x1='178' y1='124' x2='206' y2='124'/><line x1='178' y1='150' x2='206' y2='150'/>`,

    t_bar_row:
      // Angled lever bar with a loaded plate and handles, floor pivot
      `<line x1='40' y1='152' x2='186' y2='64'/><circle cx='40' cy='152' r='5'/><circle cx='172' cy='72' r='13'/><line x1='92' y1='124' x2='118' y2='108' stroke-width='5'/><line x1='30' y1='166' x2='150' y2='166'/><line x1='58' y1='138' x2='58' y2='166'/>`,

    assisted_pullup:
      // Tall frame, overhead handles, knee-assist platform, stack
      `<line x1='50' y1='28' x2='50' y2='162'/><line x1='150' y1='28' x2='150' y2='162'/><line x1='50' y1='34' x2='150' y2='34'/><line x1='82' y1='34' x2='82' y2='56'/><line x1='118' y1='34' x2='118' y2='56'/><circle cx='82' cy='59' r='4'/><circle cx='118' cy='59' r='4'/><rect x='80' y='96' width='40' height='12' fill='${s}'/><rect x='180' y='70' width='26' height='92'/><line x1='180' y1='96' x2='206' y2='96'/><line x1='180' y1='128' x2='206' y2='128'/>`,

    back_extension:
      // 45-degree angled hip pad with ankle brace at the foot
      `<line x1='48' y1='160' x2='162' y2='58'/><rect x='92' y='92' width='42' height='12' transform='rotate(-42 113 98)' fill='${s}'/><line x1='150' y1='58' x2='172' y2='58' stroke-width='5'/><line x1='42' y1='160' x2='80' y2='160'/><line x1='54' y1='150' x2='54' y2='170'/><line x1='70' y1='150' x2='70' y2='170'/>`,

    hip_thrust:
      // Bench pad low, padded bar across the hips, plates on the bar
      `<rect x='38' y='118' width='92' height='12' fill='${s}' opacity='0.5'/><line x1='48' y1='130' x2='48' y2='156'/><line x1='120' y1='130' x2='120' y2='156'/><line x1='66' y1='92' x2='168' y2='92'/><circle cx='168' cy='92' r='11'/><circle cx='62' cy='92' r='11'/><rect x='96' y='98' width='40' height='13' fill='${s}'/>`,

    standing_calf:
      // Upright frame, shoulder pads on top, raised foot platform
      `<line x1='58' y1='38' x2='58' y2='160'/><line x1='182' y1='38' x2='182' y2='160'/><line x1='58' y1='50' x2='182' y2='50'/><rect x='95' y='56' width='50' height='12' fill='${s}'/><line x1='112' y1='68' x2='112' y2='138'/><line x1='128' y1='68' x2='128' y2='138'/><rect x='90' y='138' width='60' height='14'/>`,

    seated_calf:
      // Seat with knee pad over the thighs, foot platform in front
      `<path d='M48 88 L48 142'/><path d='M48 142 L100 142 L100 160 L48 160 Z'/><rect x='92' y='96' width='46' height='12' fill='${s}'/><line x1='100' y1='142' x2='162' y2='152'/><rect x='150' y='150' width='30' height='13'/>`,
  };

  const body = shapes[type] || shapes.chest_press;
  return head + body + tail;
}

function machineImageUrl(machineType) {
  if (!machineType) return '';
  const svg = machineSvgFor(machineType);
  // Base64 is the most universally-supported data URI form for SVG.
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// New machine entries (replace any existing entries with the listed names —
// see MACHINE_OLD_NAMES below). Each has both a real photo (imageSlug) and
// a vector blueprint (machineType) used as a fallback.
const MACHINE_SEED = [
  // ---- Chest ----
  { name: 'Chest Press Machine',          category: 'Chest',     machineType: 'chest_press',         imageSlug: 'Leverage_Chest_Press' },
  { name: 'Incline Chest Press Machine',  category: 'Chest',     machineType: 'incline_chest_press', imageSlug: 'Leverage_Incline_Chest_Press' },
  { name: 'Pec Deck Machine',             category: 'Chest',     machineType: 'pec_deck',            imageSlug: 'Butterfly' },
  { name: 'Cable Crossover',              category: 'Chest',     machineType: 'cable_crossover',     imageSlug: 'Cable_Crossover' },
  { name: 'Smith Machine Bench Press',    category: 'Chest',     machineType: 'smith_machine',       imageSlug: 'Smith_Machine_Bench_Press' },
  // ---- Shoulders ----
  { name: 'Shoulder Press Machine',       category: 'Shoulders', machineType: 'shoulder_press',      imageSlug: 'Seated_Cable_Shoulder_Press' },
  { name: 'Smith Machine Shoulder Press', category: 'Shoulders', machineType: 'smith_machine',       imageSlug: 'Smith_Machine_Overhead_Shoulder_Press' },
  { name: 'Lateral Raise Machine',        category: 'Shoulders', machineType: 'lateral_raise',       imageSlug: 'Side_Lateral_Raise' },
  { name: 'Cable Lateral Raise',          category: 'Shoulders', machineType: 'cable_tower',         imageSlug: 'Side_Lateral_Raise' },
  { name: 'Rear Delt Fly Machine',        category: 'Shoulders', machineType: 'rear_delt_fly',       imageSlug: 'Reverse_Machine_Flyes' },
  { name: 'Face Pull',                    category: 'Shoulders', machineType: 'cable_tower',         imageSlug: 'Face_Pull' },
  { name: 'Cable Upright Row',            category: 'Shoulders', machineType: 'cable_tower',         imageSlug: 'Upright_Cable_Row' },
  { name: 'Cable Shrug',                  category: 'Shoulders', machineType: 'cable_tower',         imageSlug: 'Cable_Shrugs' },
  // ---- Back ----
  { name: 'Lat Pulldown Machine',         category: 'Back',      machineType: 'lat_pulldown',        imageSlug: 'Wide-Grip_Lat_Pulldown' },
  { name: 'Seated Row Machine',           category: 'Back',      machineType: 'seated_row',          imageSlug: 'Seated_Cable_Rows' },
  { name: 'T-Bar Row Machine',            category: 'Back',      machineType: 't_bar_row',           imageSlug: 'T-Bar_Row_with_Handle' },
  { name: 'Iso-Lateral Row',              category: 'Back',      machineType: 't_bar_row',           imageSlug: 'Leverage_Iso_Row' },
  { name: 'Assisted Pull-Up Machine',     category: 'Back',      machineType: 'assisted_pullup',     imageSlug: 'Band_Assisted_Pull-Up' },
  { name: 'Back Extension',               category: 'Back',      machineType: 'back_extension',      imageSlug: 'Hyperextensions_With_No_Hyperextension_Bench' },
  // ---- Legs ----
  { name: 'Leg Press Machine',            category: 'Legs',      machineType: 'leg_press',           imageSlug: 'Leg_Press' },
  { name: 'Hack Squat Machine',           category: 'Legs',      machineType: 'hack_squat',          imageSlug: 'Hack_Squat' },
  { name: 'Smith Machine Squat',          category: 'Legs',      machineType: 'smith_machine',       imageSlug: 'Smith_Machine_Squat' },
  { name: 'Leg Extension Machine',        category: 'Legs',      machineType: 'leg_extension',       imageSlug: 'Leg_Extensions' },
  { name: 'Leg Curl Machine',             category: 'Legs',      machineType: 'leg_curl',            imageSlug: 'Lying_Leg_Curls' },
  { name: 'Seated Leg Curl',              category: 'Legs',      machineType: 'leg_curl',            imageSlug: 'Seated_Leg_Curl' },
  { name: 'Hip Abductor Machine',         category: 'Legs',      machineType: 'hip_abductor',        imageSlug: 'Thigh_Abductor' },
  { name: 'Hip Adductor Machine',         category: 'Legs',      machineType: 'hip_adductor',        imageSlug: 'Thigh_Adductor' },
  { name: 'Hip Thrust Machine',           category: 'Legs',      machineType: 'hip_thrust',          imageSlug: 'Barbell_Hip_Thrust' },
  { name: 'Calf Raise Machine',           category: 'Legs',      machineType: 'standing_calf',       imageSlug: 'Standing_Calf_Raises' },
  { name: 'Seated Calf Raise',            category: 'Legs',      machineType: 'seated_calf',         imageSlug: 'Seated_Calf_Raise' },
  // ---- Arms ----
  { name: 'Preacher Curl Machine',        category: 'Arms',      machineType: 'preacher_curl',       imageSlug: 'Preacher_Curl' },
  { name: 'Cable Curl',                   category: 'Arms',      machineType: 'cable_tower',         imageSlug: 'Standing_Biceps_Cable_Curl' },
  { name: 'Triceps Dip Machine',          category: 'Arms',      machineType: 'triceps_dip',         imageSlug: 'Dips_-_Triceps_Version' },
  { name: 'Assisted Dip Machine',         category: 'Arms',      machineType: 'assisted_pullup',     imageSlug: 'Dips_-_Triceps_Version' },
  { name: 'Cable Triceps Pushdown',       category: 'Arms',      machineType: 'cable_tower',         imageSlug: 'Triceps_Pushdown' },
  { name: 'Overhead Cable Triceps',       category: 'Arms',      machineType: 'cable_tower',         imageSlug: 'Cable_Rope_Overhead_Triceps_Extension' },
  // ---- Core ----
  { name: 'Ab Crunch Machine',            category: 'Core',      machineType: 'ab_crunch',           imageSlug: 'Ab_Crunch_Machine' },
  { name: 'Cable Crunch',                 category: 'Core',      machineType: 'cable_tower',         imageSlug: 'Cable_Crunch' },
];

// Old/legacy seed names that the new machine list supersedes — these get
// removed during migration so the user doesn't end up with duplicates.
const MACHINE_OLD_NAMES = new Set([
  'Chest Press Machine', 'Pec Deck',
  'Shoulder Press Machine', 'Reverse Pec Deck',
  'Lat Pulldown', 'Seated Row',
  'Leg Press', 'Leg Extension', 'Leg Curl',
  'Hack Squat', 'Hip Abductor', 'Hip Adductor',
  'Preacher Curl', 'Ab Crunch Machine',
]);
const MACHINE_NEW_NAMES = new Set(MACHINE_SEED.map((m) => m.name));

// Every image slug whose photo ships inside the app (downloaded into assets/ex/).
// exerciseImageUrl() serves these from the local folder and everything else from
// the remote host. Keep in sync: a new seed with a new imageSlug must also have
// its jpg bundled under assets/ex/.
const BUNDLED_EX_SLUGS = new Set(
  [...SEED_EXERCISES, ...MACHINE_SEED].map((e) => e.imageSlug).filter(Boolean)
);

const EXERCISE_CATEGORIES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];

const CARDIO_TYPES = [
  { id: 'treadmill', label: 'Treadmill', iconName: 'treadmill' },
  { id: 'walking',   label: 'Walking',   iconName: 'walk' },
  { id: 'running',   label: 'Running',   iconName: 'run' },
  { id: 'cycling',   label: 'Cycling',   iconName: 'bike' },
];

const CARDIO_ICON_OPTIONS = ['run', 'walk', 'bike', 'treadmill', 'heart', 'heartPulse', 'flame', 'zap', 'clock'];

function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

// Starting UI language for a BRAND-NEW install. The app deliberately never ASKS
// which language to use (the login screen carries an ar/en toggle instead), so
// this guess is the only thing standing between an Arabic speaker and an English
// first screen. Consulted ONLY when building a fresh state — an existing user's
// saved `prefs.lang` is never overridden by the phone's locale.
// Starting THEME for a brand-new install, from the phone's own light/dark setting
// — the same principle as detectLang: don't ask for something the device already
// knows. Only consulted when building a fresh state; an existing user's chosen
// theme is never overridden. There are exactly two: dark and light (v210 cut the
// eleven alternate skins, each of which carried its own accent and so dropped the
// brand on every switch). Settings offers that pair and nothing else.
function pad2(n) { return String(n).padStart(2, '0'); }

// Comparators for ISO date / timestamp strings.
//
// These are ASCII and fixed-width, so `<` and `>` order them EXACTLY as
// localeCompare does — at roughly a tenth of the cost, because localeCompare
// routes every single comparison through the ICU collator. Sorting 2,000
// sessions makes ~22,000 comparisons, and these lists are re-sorted on most
// renders, so it is the multiplier under every other hot path in the app.
//
// NAMES DELIBERATELY STILL USE localeCompare (supplements, exercises, foods).
// Those are user-facing strings that are frequently Arabic, where code-point
// order is simply wrong — "ياسمين" would sort after "أحمد" by accident rather
// than by alphabet. Speed is not worth a mis-sorted list the user reads.
function isoAsc(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function isoDesc(a, b) { return a < b ? 1 : a > b ? -1 : 0; }

// Small stable integer id from a string — the native notification plugin keys
// everything by int, and reusing the same id lets a re-sync REPLACE an alarm
// instead of stacking a duplicate.
function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000;
}

// Retired colour skins (v210) → the mode each one most resembles. Only the two
// pale skins map to light; every other one was a dark surface.
const LEGACY_THEME_MAP = {
  forest: 'dark', ocean: 'dark', mocha: 'dark', olive: 'dark', aurora: 'dark',
  sunset: 'dark', nebula: 'dark', slate: 'dark', dusk: 'dark',
  sand: 'light', frost: 'light',
};

// The one way to read that map. A plain `MAP[theme]` reaches Object.prototype,
// so a tampered backup carrying theme:"constructor" resolves to a FUNCTION —
// which JSON.stringify then drops, taking the key with it. Everything that is
// not a known retired id or 'light' collapses to 'dark'.
function canonicalTheme(theme) {
  if (Object.prototype.hasOwnProperty.call(LEGACY_THEME_MAP, theme)) return LEGACY_THEME_MAP[theme];
  return theme === 'light' ? 'light' : 'dark';
}

function detectTheme() {
  try {
    return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  } catch (_) { return 'dark'; }
}

function detectLang() {
  try {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ''];
    return list.some((l) => String(l).toLowerCase().startsWith('ar')) ? 'ar' : 'en';
  } catch (_) { return 'en'; }
}


function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      lang: detectLang(),
      theme: detectTheme(),
      unit: 'kg',
      translateExercises: true,   // Arabic UI: transliterate built-in exercise names
    },
    exercises: [
      ...SEED_EXERCISES.map((e) => ({
        id: uid(),
        name: e.name,
        category: e.category,
        imageSlug: e.imageSlug || null,
        machineType: null,
        customImage: null,
        isCustom: false,
        inMyList: false,
        createdAt: new Date().toISOString(),
      })),
      ...MACHINE_SEED.map((m) => ({
        id: uid(),
        name: m.name,
        category: m.category,
        imageSlug: m.imageSlug || null,
        machineType: m.machineType,
        customImage: null,
        isCustom: false,
        inMyList: false,
        createdAt: new Date().toISOString(),
      })),
    ],
    sessions: [],
    cardio: [],
    cardioTypes: [], // user-defined custom cardio types (built-ins live in CARDIO_TYPES)
    foods: [],
    sleep: [],
    // Workout plan — a CONTINUOUS ROTATION: an ordered cycle of workouts rolled
    // across training days (never reset weekly). See migratePlan()/DB.plan.
    plan: { mode: 'rotation', cycle: [], trainingDays: [], anchor: null, restDates: [], extraDates: [], restPromptAt: null },
    supplements: [],
    // Reminder settings. Times are LOCAL "HH:MM" strings, never timestamps: a
    // reminder means "08:00 wherever you are", so it must survive a timezone
    // change and DST without shifting.
    reminders: { enabled: false, water: { on: false, from: '09:00', to: '21:00', everyMin: 120 } },
    // Notification config (APPLY-notifications.md §2). The per-day cap ledger
    // is NOT here — it is device-local; see DB.notif.
    notif: null,
    supplementLogs: {},
    foodLogs: {},
    water: {}, // per-day water intake in ml, keyed by YYYY-MM-DD
    bodyweight: [], // [{ date:'YYYY-MM-DD', kg }] — one entry per day
    // Nutrition targets. `mode:'off'` → the Food page shows the "set up your
    // goal" prompt. When set, `targets` holds the daily goals the dashboard
    // counts down from; `profile` remembers the calculator inputs so the user
    // can re-open and tweak. All computed by DB.nutrition (Mifflin-St Jeor).
    nutrition: defaultNutrition(),
    health: { data: null, syncedAt: 0, hidden: [] },
  };
}

function defaultNutrition() {
  return {
    mode: 'off',                 // 'off' | 'calc' | 'manual'
    profile: {
      sex: 'male',               // 'male' | 'female'
      age: null,
      heightCm: null,
      weightKg: null,
      activity: 'moderate',      // sedentary|light|moderate|active|very_active
      goal: 'maintain',          // cut | maintain | bulk
    },
    targets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

// Count training-weekday dates x with anchor <= x < D (date-only). Used to find
// the rotation position: each elapsed training day advances one cycle slot.
//
// `rest` is the set of YYYY-MM-DD dates the user marked "not going today". They
// are skipped here, and that single line is the whole postpone behaviour: a day
// that does not count as elapsed does not advance the cycle, so the workout it
// would have carried lands on the next real training day and everything after
// it slides by one. Nothing is lost and nothing needs rescheduling — which is
// the point of a continuous rotation, as opposed to a fixed weekly grid where
// the same skip would simply forfeit that workout.
// `extra` is the MIRROR of `rest`: dates the user pulled INTO the rotation even
// though their weekday is not a training day. Counting one here is what slides
// everything after it forward — today takes the workout the next training day
// was going to carry, that day takes the one after, and the cycle stays intact.
// It is the same mechanism as a skip, run in the other direction.
function trainingDaysBetween(anchorStr, D, trainingDays, rest, extra) {
  const a = new Date(anchorStr + 'T00:00:00');
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d0 = new Date(D.getFullYear(), D.getMonth(), D.getDate());
  if (d0 <= a0) return 0;
  let count = 0;
  const cur = new Date(a0);
  let guard = 0;
  while (cur < d0 && guard++ < 4000) {
    const iso = isoOf(cur);
    const scheduled = trainingDays.indexOf(cur.getDay()) !== -1 || !!(extra && extra[iso]);
    if (scheduled && !(rest && rest[iso])) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Date -> 'YYYY-MM-DD' using LOCAL fields. Never toISOString(): that converts to
// UTC first, so east of Greenwich an evening date comes back as the next day.
function isoOf(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// A date list as a lookup object, tolerating a missing/!array field.
function dateSet(p, field) {
  const out = {};
  const list = p && Array.isArray(p[field]) ? p[field] : [];
  for (let i = 0; i < list.length; i++) out[list[i]] = true;
  return out;
}
function restMap(p) { return dateSet(p, 'restDates'); }
function extraMap(p) { return dateSet(p, 'extraDates'); }

// Convert a legacy day-of-week plan grid (or a missing/partial plan) into the
// rotation model. Distinct workouts in Sun→Sat order (first occurrence wins)
// become the cycle; the days that had a workout become the training days; the
// anchor defaults to today. Idempotent for an already-rotation plan.
function migratePlan(plan) {
  if (plan && plan.mode === 'rotation') {
    return {
      mode: 'rotation',
      cycle: (Array.isArray(plan.cycle) ? plan.cycle : []).map((s) => ({
        name: (s && s.name) || 'Workout',
        exerciseIds: Array.isArray(s && s.exerciseIds) ? s.exerciseIds.slice() : [],
      })),
      trainingDays: Array.isArray(plan.trainingDays) ? plan.trainingDays.slice() : [],
      anchor: plan.anchor || todayISO(),
      // This runs on EVERY load, not just on the legacy grid, and it rebuilds the
      // object field by field — so anything omitted here is silently erased from
      // the saved blob on the next write. restDates predates nothing: an existing
      // user simply has no such field, hence the [] default.
      restDates: Array.isArray(plan.restDates) ? plan.restDates.slice() : [],
      extraDates: Array.isArray(plan.extraDates) ? plan.extraDates.slice() : [],
      restPromptAt: plan.restPromptAt || null,
    };
  }
  const grid = plan || {};
  const cycle = [], trainingDays = [], seen = {};
  for (let dow = 0; dow < 7; dow++) {
    const day = grid[String(dow)];
    if (day && Array.isArray(day.exerciseIds) && day.exerciseIds.length) {
      trainingDays.push(dow);
      const nm = day.name || 'Workout';
      const key = nm.toLowerCase();
      if (!seen[key]) { seen[key] = true; cycle.push({ name: nm, exerciseIds: day.exerciseIds.slice() }); }
    }
  }
  return { mode: 'rotation', cycle, trainingDays, anchor: todayISO(), restDates: [], extraDates: [], restPromptAt: null };
}

// Set when the stored blob could not be parsed. While true the app runs
// READ-ONLY: every write is refused so the unreadable-but-possibly-recoverable
// bytes on disk are never replaced by an empty default state. Cleared only by a
// DELIBERATE whole-blob replacement (cloud pull / backup restore / reset).
let STATE_LOAD_FAILED = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = defaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw);
    parsed.prefs = parsed.prefs || { lang: 'en', theme: 'dark', unit: 'kg' };
    if (!parsed.prefs.lang) parsed.prefs.lang = 'en';
    if (!parsed.prefs.theme) parsed.prefs.theme = 'dark';
    if (!parsed.prefs.unit) parsed.prefs.unit = 'kg';
    // Drop any leftover PIN/recovery fields from earlier versions
    if (parsed.prefs.pinHash !== undefined) delete parsed.prefs.pinHash;
    if (parsed.prefs.pinSalt !== undefined) delete parsed.prefs.pinSalt;
    if (parsed.prefs.pinSetAt !== undefined) delete parsed.prefs.pinSetAt;
    if (parsed.prefs.autoLock !== undefined) delete parsed.prefs.autoLock;
    if (parsed.prefs.securityQuestion !== undefined) delete parsed.prefs.securityQuestion;
    if (parsed.prefs.securityAnswerHash !== undefined) delete parsed.prefs.securityAnswerHash;
    if (parsed.prefs.securityAnswerSalt !== undefined) delete parsed.prefs.securityAnswerSalt;
    parsed.exercises = parsed.exercises || [];
    parsed.sessions = parsed.sessions || [];
    parsed.cardio = parsed.cardio || [];
    parsed.cardioTypes = parsed.cardioTypes || [];
    parsed.foods = parsed.foods || [];
    parsed.sleep = parsed.sleep || [];
    parsed.plan = migratePlan(parsed.plan);   // legacy dow-grid → continuous rotation
    parsed.supplements = parsed.supplements || [];
    parsed.reminders = parsed.reminders || { enabled: false, water: { on: false, from: '09:00', to: '21:00', everyMin: 120 } };
    parsed.supplementLogs = parsed.supplementLogs || {};
    parsed.foodLogs = parsed.foodLogs || {};
    parsed.water = parsed.water || {};
    parsed.bodyweight = Array.isArray(parsed.bodyweight) ? parsed.bodyweight : [];
    // Nutrition targets (added later) — backfill for existing users.
    if (!parsed.nutrition || typeof parsed.nutrition !== 'object') {
      parsed.nutrition = defaultNutrition();
    } else {
      const dn = defaultNutrition();
      parsed.nutrition.mode = parsed.nutrition.mode || 'off';
      parsed.nutrition.profile = Object.assign(dn.profile, parsed.nutrition.profile || {});
      parsed.nutrition.targets = Object.assign(dn.targets, parsed.nutrition.targets || {});
    }
    parsed.health = parsed.health || { data: null, syncedAt: 0, hidden: [] };
    if (!Array.isArray(parsed.health.hidden)) parsed.health.hidden = [];

    // Migration: backfill missing fields + add any new seed exercises
    const seedByName = Object.fromEntries(SEED_EXERCISES.map((e) => [e.name, e]));
    let migrated = false;

    // v210 cut the eleven alternate skins down to the two brand modes. This has
    // to REWRITE the stored value, not just correct it in memory: the blob is
    // synced whole, so a `nebula` left in localStorage keeps travelling to the
    // cloud and back and every future load has to keep guessing. Hence the
    // `migrated` flag below — that is what persists it. The two pale skins land
    // on light; everything else was a dark surface.
    {
      const want = canonicalTheme(parsed.prefs.theme);
      if (parsed.prefs.theme !== want) { parsed.prefs.theme = want; migrated = true; }
    }

    // Build a set of exerciseIds that have logged sessions (used for inMyList migration)
    const exercisesWithSessions = new Set((parsed.sessions || []).map((s) => s.exerciseId));

    parsed.exercises.forEach((ex) => {
      if (ex.imageSlug === undefined) { ex.imageSlug = null; migrated = true; }
      if (ex.customImage === undefined) { ex.customImage = null; migrated = true; }
      if (ex.imagePath === undefined) { ex.imagePath = null; migrated = true; }
      if (ex.machineType === undefined) { ex.machineType = null; migrated = true; }

      const seed = seedByName[ex.name];
      if (!ex.isCustom && seed && !ex.imageSlug && seed.imageSlug) {
        ex.imageSlug = seed.imageSlug;
        migrated = true;
      }

      // inMyList: custom exercises and ones the user has already used go to "my list"
      if (ex.inMyList === undefined) {
        ex.inMyList = !!ex.isCustom || exercisesWithSessions.has(ex.id);
        migrated = true;
      }
    });

    // Drop the legacy machine names that have been superseded (only when there
    // isn't an entry already using the new name).
    const beforeCount = parsed.exercises.length;
    parsed.exercises = parsed.exercises.filter((ex) => {
      if (ex.isCustom) return true;
      if (MACHINE_OLD_NAMES.has(ex.name) && !MACHINE_NEW_NAMES.has(ex.name)) return false;
      return true;
    });
    if (parsed.exercises.length !== beforeCount) migrated = true;

    // Refresh existing entries to point at the new machine illustrations, or add
    // them if missing. Idempotent — safe to run on every load.
    const exByName = Object.fromEntries(parsed.exercises.map((e) => [e.name, e]));
    MACHINE_SEED.forEach((m) => {
      const existing = exByName[m.name];
      if (existing && !existing.isCustom) {
        if (existing.machineType !== m.machineType) { existing.machineType = m.machineType; migrated = true; }
        if (existing.imageSlug !== (m.imageSlug || null)) { existing.imageSlug = m.imageSlug || null; migrated = true; }
        if (existing.category !== m.category) { existing.category = m.category; migrated = true; }
      } else if (!existing) {
        parsed.exercises.push({
          id: uid(),
          name: m.name,
          category: m.category,
          imageSlug: m.imageSlug || null,
          machineType: m.machineType,
          customImage: null,
          isCustom: false,
          inMyList: false,
          createdAt: new Date().toISOString(),
        });
        migrated = true;
      }
    });

    // Add any seed exercises that are missing for this user (new ones added in updates)
    const existingSeedNames = new Set(
      parsed.exercises.filter((e) => !e.isCustom).map((e) => e.name)
    );
    SEED_EXERCISES.forEach((seed) => {
      if (!existingSeedNames.has(seed.name)) {
        parsed.exercises.push({
          id: uid(),
          name: seed.name,
          category: seed.category,
          imageSlug: seed.imageSlug || null,
          machineType: null,
          customImage: null,
          isCustom: false,
          inMyList: false,
          createdAt: new Date().toISOString(),
        });
        migrated = true;
      }
    });

    if (migrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (_) {
        // Deliberately swallowed, and deliberately NOT rethrown into the outer
        // catch: that catch means "this blob is unreadable" and would quarantine
        // a healthy one. The migration already applied in memory.
      }
    }

    return parsed;
  } catch (err) {
    // DO NOT overwrite the stored blob here. It may well be recoverable — a
    // truncated write, a quota-failed partial, a transient JSON error — and
    // replacing it with defaultState() is exactly how a recoverable glitch
    // becomes PERMANENT data loss (and then syncs that loss to the cloud).
    //
    // Instead: quarantine a copy, run READ-ONLY (save()/saveLocal() refuse to
    // write while this flag is set), and tell the app so it can warn the user.
    STATE_LOAD_FAILED = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(STORAGE_KEY + '__corrupt', raw);
    } catch (_) { /* quarantine is best-effort; never block the boot */ }
    console.error('[VAULT] Stored data could not be parsed — running READ-ONLY to protect it.', err);
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vault:load-failed'));
    } catch (_) {}
    return defaultState();   // in-memory only — never persisted while READ-ONLY
  }
}

let STATE = loadState();

// The one low-level write. Returns true when the bytes actually landed.
//
// Two failure modes are handled here rather than at ~55 call sites:
//   READ-ONLY  — the stored blob failed to parse; writing would destroy it.
//   QUOTA      — localStorage is full; the write throws. Silently swallowing
//                that means the app looks like it is saving while persisting
//                NOTHING, and every set logged afterwards is lost on reload.
function writeStore() {
  if (STATE_LOAD_FAILED) {
    console.error('[VAULT] Refusing to write: stored data is unreadable (READ-ONLY mode).');
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    return true;
  } catch (err) {
    const quota = err && (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
    console.error('[VAULT] Save FAILED' + (quota ? ' (storage full)' : ''), err);
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vault:save-failed', { detail: { quota: !!quota } }));
      }
    } catch (_) {}
    return false;
  }
}

function save() {
  if (!writeStore()) return;
  // Notify the cloud-sync layer (if present + logged in) to push the change.
  if (typeof window !== 'undefined' && window.Cloud && window.Cloud.onLocalChange) {
    window.Cloud.onLocalChange();
  }
}

// Persist WITHOUT telling the sync layer anything changed.
//
// Only for HOUSEKEEPING writes — data the device re-derives for itself (a Health
// Connect cache refresh, the global-exercise merge, the onboarding flag). These
// used to go through save(), which sets the sync "dirty" flag. On boot that
// happens BEFORE bootSync's network pull resolves, so bootSync would see
// `remoteNewer && isDirty` and report a CONFLICT that the user never caused —
// and choosing "Keep this device" then force-pushes over a NEWER cloud blob,
// skipping the empty-blob guard and the version compare. That is the same class
// of silent overwrite that once destroyed every custom exercise image.
//
// Nothing is lost by not flagging: these values are re-derivable, and they ride
// along in the payload of the next genuine user edit.
function saveLocal() {
  writeStore();
}

// Re-read the whole state from localStorage. Used after cloud sync replaces the
// stored blob, so the in-memory STATE reflects the freshly pulled data.
function reloadState() {
  // A cloud pull / backup restore / reset has DELIBERATELY replaced the stored
  // blob, so clear READ-ONLY mode first and let loadState() re-decide. Without
  // this, a device that once hit a corrupt blob could never be recovered — even
  // by pulling a known-good copy from the cloud.
  STATE_LOAD_FAILED = false;
  STATE = loadState();
}

// ==========================================================================
// Public API
// ==========================================================================

const DB = {
  // For Compare page / debugging
  getAll() { return STATE; },

  // ----- User preferences -----
  prefs: {
    get() { return STATE.prefs || { lang: 'en', theme: 'dark', unit: 'kg' }; },
    // No `langPicked` companion flag any more: nothing needs to know whether the
    // choice was deliberate, because the app never asks. A fresh install gets
    // detectLang() and the login screen's ar/en toggle changes it.
    setLang(lang) { STATE.prefs.lang = lang; save(); },
    setTheme(theme) { STATE.prefs.theme = canonicalTheme(theme); save(); },
    setUnit(unit) { STATE.prefs.unit = unit === 'lb' ? 'lb' : 'kg'; save(); },
    setTranslateExercises(on) { STATE.prefs.translateExercises = !!on; save(); },
    // First-run welcome flow: true once the user has seen (or skipped) it.
    onboarded() { return !!(STATE.prefs && STATE.prefs.onboarded); },
    // Housekeeping: set during boot (app.js auto-flags existing users so an update
    // never re-shows onboarding), which is BEFORE bootCloud resolves — flagging the
    // blob dirty here is what manufactured false sync conflicts. It still reaches
    // the cloud, riding along with the next genuine edit (see saveLocal).
    setOnboarded() { STATE.prefs.onboarded = true; saveLocal(); },
  },

  // ----- Workout plan — CONTINUOUS ROTATION -----
  // STATE.plan = { mode:'rotation', cycle:[{name,exerciseIds}], trainingDays:[dow], anchor:'YYYY-MM-DD' }.
  // The workout for a date = cycle[(training days elapsed since anchor) mod cycle.length];
  // rest days (weekday ∉ trainingDays) have no workout. The cycle rolls across weeks — never reset.
  plan: {
    get() { return STATE.plan || { mode: 'rotation', cycle: [], trainingDays: [], anchor: null, restDates: [], extraDates: [], restPromptAt: null }; },

    // THE single source of truth: what workout (or null=rest) falls on date D.
    workoutForDate(D) {
      const p = STATE.plan;
      if (!p || p.mode !== 'rotation' || !Array.isArray(p.cycle) || !p.cycle.length) return null;
      const td = Array.isArray(p.trainingDays) ? p.trainingDays : [];
      const iso = isoOf(D);
      const extra = extraMap(p);
      // The weekday check yields to an extra day — that is the ONLY thing that
      // lets a scheduled rest weekday carry a workout. It used to return here
      // unconditionally, which is why "train tomorrow's session now" could not
      // work no matter what it wrote: the answer for today was decided before
      // any per-date list was consulted.
      if (td.indexOf(D.getDay()) === -1 && !extra[iso]) return null;   // scheduled rest weekday
      const rest = restMap(p);
      if (rest[iso]) return null;                                  // user took this day off
      const anchor = p.anchor || todayISO();
      const a = new Date(anchor + 'T00:00:00');
      const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      const d0 = new Date(D.getFullYear(), D.getMonth(), D.getDate());
      if (d0 < a0) return null;                                    // before the plan started
      const elapsed = trainingDaysBetween(anchor, D, td, rest, extra);
      const len = p.cycle.length;
      return p.cycle[((elapsed % len) + len) % len];
    },

    // ----- "not going today" -----
    // A day the user opted out of. It is NOT the same as a non-training weekday:
    // this one was scheduled and was declined, so it also has to stop advancing
    // the cycle (see trainingDaysBetween) or the workout it carried is forfeited.
    isRest(D) {
      const p = STATE.plan;
      if (!p) return false;
      return !!restMap(p)[typeof D === 'string' ? D : isoOf(D)];
    },
    setRest(D, on) {
      const iso = typeof D === 'string' ? D : isoOf(D);
      if (!STATE.plan) return false;
      if (!Array.isArray(STATE.plan.restDates)) STATE.plan.restDates = [];
      const list = STATE.plan.restDates;
      const at = list.indexOf(iso);
      if (on && at === -1) list.push(iso);
      else if (!on && at !== -1) list.splice(at, 1);
      else return this.isRest(iso);                    // no change, no write
      // Opposites: declaring a rest clears a day pulled in earlier (see setExtra).
      if (on && Array.isArray(STATE.plan.extraDates)) {
        const x = STATE.plan.extraDates.indexOf(iso);
        if (x !== -1) STATE.plan.extraDates.splice(x, 1);
      }
      // Unbounded growth would bloat a blob that is synced whole on every save,
      // but the cutoff CANNOT be a rolling year. The position in the cycle is
      // derived by walking from the plan's ANCHOR, so a rest date from three
      // years ago is still counted on every render — dropping it makes that day
      // count as elapsed again and shifts today and every future day forward by
      // one slot, with the entry that would undo it already deleted. Only dates
      // before the anchor are unreachable by the walk, and only those are safe
      // to drop. Sorted so the prune is a cheap prefix drop.
      list.sort();
      const cutoff = STATE.plan.anchor || todayISO();
      while (list.length && list[0] < cutoff) list.shift();
      save();
      return this.isRest(iso);
    },
    toggleRest(D) { return this.setRest(D, !this.isRest(D)); },

    // ----- "training today after all" — the mirror of the two above -----
    // A weekday that is NOT in the rotation, pulled in for this one date. It
    // advances the cycle exactly like a normal training day, so the session it
    // takes is the one the next training day was going to carry and the whole
    // plan slides forward by a day. Nothing is skipped and nothing is lost.
    isExtra(D) {
      const p = STATE.plan;
      if (!p) return false;
      return !!extraMap(p)[typeof D === 'string' ? D : isoOf(D)];
    },
    setExtra(D, on) {
      const iso = typeof D === 'string' ? D : isoOf(D);
      if (!STATE.plan) return false;
      if (!Array.isArray(STATE.plan.extraDates)) STATE.plan.extraDates = [];
      const list = STATE.plan.extraDates;
      const at = list.indexOf(iso);
      if (on && at === -1) list.push(iso);
      else if (!on && at !== -1) list.splice(at, 1);
      else return this.isExtra(iso);                   // no change, no write
      // The two lists are opposites, so a date must never sit in both: "I am
      // training today" has to clear "I am not training today", or the rest
      // entry silently wins in workoutForDate and the pull-forward does nothing.
      if (on && Array.isArray(STATE.plan.restDates)) {
        const r = STATE.plan.restDates.indexOf(iso);
        if (r !== -1) STATE.plan.restDates.splice(r, 1);
      }
      // Anchor-relative, not a rolling year — see the note in setRest(). A
      // dropped extraDate is counted the same way in reverse: the walk stops
      // seeing a day it used to count, and everything after it slides back.
      list.sort();
      const cutoff = STATE.plan.anchor || todayISO();
      while (list.length && list[0] < cutoff) list.shift();
      save();
      return this.isExtra(iso);
    },

    // ----- the rest-day sheet's once-a-day gate -----
    // The sheet argues a case; arguing it twice in one day turns advice into
    // nuisance, and nuisance gets ignored. One ISO date, not a list — only
    // "was it already shown TODAY" is ever asked.
    restPromptedToday() { return !!STATE.plan && STATE.plan.restPromptAt === todayISO(); },
    markRestPrompted() {
      if (!STATE.plan) return;
      if (STATE.plan.restPromptAt === todayISO()) return;   // no write, no sync churn
      STATE.plan.restPromptAt = todayISO();
      saveLocal();   // a UI nag-guard, not user data — must not flag the blob dirty
    },

    // Replace the whole rotation (used by the schedule modal on template adopt).
    setRotation({ cycle, trainingDays, anchor }) {
      STATE.plan = {
        mode: 'rotation',
        cycle: (cycle || []).map((s) => ({ name: (s && s.name) || 'Workout', exerciseIds: Array.isArray(s && s.exerciseIds) ? s.exerciseIds.slice() : [] })),
        trainingDays: (trainingDays || []).slice().sort((a, b) => a - b),
        anchor: anchor || todayISO(),
        // Carried over, not reset. This also rebuilds the object field by field,
        // and a day the user has already declared off (tomorrow, say) is a fact
        // about their week, not about which template they picked.
        restDates: Array.isArray(STATE.plan && STATE.plan.restDates) ? STATE.plan.restDates.slice() : [],
        // Carried for the same reason as restDates: a day already pulled into
        // the rotation is a fact about the user's week, not about the template.
        extraDates: Array.isArray(STATE.plan && STATE.plan.extraDates) ? STATE.plan.extraDates.slice() : [],
        restPromptAt: (STATE.plan && STATE.plan.restPromptAt) || null,
      };
      save();
    },
    setTrainingDays(days) {
      STATE.plan.trainingDays = (days || []).slice().sort((a, b) => a - b);
      if (!STATE.plan.anchor) STATE.plan.anchor = todayISO();
      save();
    },
    // ----- cycle-slot editing (planner) -----
    addSlot(name) {
      if (!Array.isArray(STATE.plan.cycle)) STATE.plan.cycle = [];
      STATE.plan.cycle.push({ name: name || 'Workout', exerciseIds: [] });
      if (!STATE.plan.anchor) STATE.plan.anchor = todayISO();
      save();
    },
    removeSlot(i) {
      if (Array.isArray(STATE.plan.cycle)) { STATE.plan.cycle.splice(i, 1); save(); }
    },
    moveSlot(from, to) {
      const c = STATE.plan.cycle;
      if (!Array.isArray(c) || from < 0 || from >= c.length) return;
      to = Math.max(0, Math.min(to, c.length - 1));
      const [it] = c.splice(from, 1);
      c.splice(to, 0, it);
      save();
    },
    setSlotName(i, name) {
      const s = STATE.plan.cycle && STATE.plan.cycle[i];
      if (s) { s.name = name || 'Workout'; save(); }
    },
    setSlotExercises(i, ids) {
      const s = STATE.plan.cycle && STATE.plan.cycle[i];
      if (s) { s.exerciseIds = (ids || []).slice(); save(); }
    },
    addExerciseToSlot(i, exId) {
      const s = STATE.plan.cycle && STATE.plan.cycle[i];
      if (s && s.exerciseIds.indexOf(exId) === -1) { s.exerciseIds.push(exId); save(); }
    },
    removeExerciseFromSlot(i, exId) {
      const s = STATE.plan.cycle && STATE.plan.cycle[i];
      if (s) { s.exerciseIds = s.exerciseIds.filter((id) => id !== exId); save(); }
    },
    clearAll() {
      STATE.plan = { mode: 'rotation', cycle: [], trainingDays: [], anchor: todayISO(), restDates: [], extraDates: [], restPromptAt: null };
      save();
    },
  },

  // ----- Health Connect (Android) -----
  // Caches the last sync so the home screen can show cards offline, plus the
  // per-metric show/hide preferences for the home screen.
  health: {
    get() { return STATE.health || { data: null, syncedAt: 0, hidden: [] }; },
    setData(data) {
      const h = STATE.health || { hidden: [] };
      // Change-detect: a Health Connect re-read that returns the SAME numbers must
      // not rewrite the blob at all. Without this, every boot/foreground sync
      // touched storage (and used to flag the blob dirty) for no actual change.
      const same = JSON.stringify(h.data) === JSON.stringify(data);
      if (same && h.syncedAt) return;
      h.data = data;
      h.syncedAt = Date.now();
      if (!Array.isArray(h.hidden)) h.hidden = [];
      STATE.health = h;
      // Housekeeping: a device-local cache of data Health Connect owns. Never a
      // reason to flag the blob dirty (see saveLocal).
      saveLocal();
    },
    isHidden(key) { return (STATE.health?.hidden || []).includes(key); },
    toggle(key) {
      const h = STATE.health || { data: null, syncedAt: 0, hidden: [] };
      const set = new Set(h.hidden || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      h.hidden = [...set];
      STATE.health = h;
      save();
    },
  },

  // ----- Supplements -----
  supplements: {
    list() { return [...(STATE.supplements || [])].sort((a, b) => a.name.localeCompare(b.name)); },
    add({ name, dose, color, times }) {
      const item = {
        id: uid(),
        name: name.trim(),
        dose: (dose || '').trim(),
        color: color || '#22d3ee',
        times: Array.isArray(times) ? times.slice() : [],   // local "HH:MM" reminder times
        createdAt: new Date().toISOString(),
      };
      STATE.supplements.push(item);
      save();
      return item;
    },
    update(id, data) {
      const s = STATE.supplements.find((x) => x.id === id);
      if (!s) return null;
      if (data.name != null) s.name = data.name.trim();
      if (data.dose != null) s.dose = (data.dose || '').trim();
      if (data.color != null) s.color = data.color;
      // This whitelist silently DROPS any field it doesn't name — reminder times
      // saved fine on a new supplement and vanished on an edit until this line.
      if (Array.isArray(data.times)) s.times = data.times.slice();
      save();
      return s;
    },
    setTimes(id, times) { return this.update(id, { times: Array.isArray(times) ? times : [] }); },
    remove(id) {
      STATE.supplements = STATE.supplements.filter((s) => s.id !== id);
      // Also clean logs for this supplement
      Object.keys(STATE.supplementLogs).forEach((d) => {
        if (STATE.supplementLogs[d] && STATE.supplementLogs[d][id]) {
          delete STATE.supplementLogs[d][id];
        }
      });
      save();
    },
    isTaken(supplementId, date) {
      const day = STATE.supplementLogs[date];
      return !!(day && day[supplementId]);
    },
    setTaken(supplementId, date, taken) {
      if (!STATE.supplementLogs[date]) STATE.supplementLogs[date] = {};
      if (taken) STATE.supplementLogs[date][supplementId] = true;
      else delete STATE.supplementLogs[date][supplementId];
      save();
    },
    streak(supplementId) {
      // Consecutive days ending today (or yesterday if not taken yet today).
      //
      // Walks the LOCAL calendar via todayISO()/addDaysISO(), which is the same
      // calendar every WRITE uses. This used to build the date with
      // `new Date().setHours(0,0,0,0)` + `.toISOString()`, whose UTC conversion
      // returns the PREVIOUS day anywhere east of UTC (e.g. UTC+3) — so the
      // streak read one day short and today's dose appeared to do nothing until
      // the next day. Third occurrence of this bug class in the codebase.
      let count = 0;
      let iso = todayISO();
      if (!this.isTaken(supplementId, iso)) iso = addDaysISO(iso, -1);
      while (this.isTaken(supplementId, iso)) {
        count += 1;
        iso = addDaysISO(iso, -1);
      }
      return count;
    },
  },

  // ----- Daily food log (date-keyed) -----
  foodLogs: {
    listForDate(date) {
      return STATE.foodLogs[date] || [];
    },
    add(date, entry) {
      // entry: { foodId, name, servings, calories, protein, carbs, fat, source }
      if (!STATE.foodLogs[date]) STATE.foodLogs[date] = [];
      const item = {
        id: uid(),
        foodId: entry.foodId || null,
        name: entry.name,
        servings: Number(entry.servings) || 1,
        calories: Number(entry.calories) || 0,
        protein: Number(entry.protein) || 0,
        carbs: Number(entry.carbs) || 0,
        fat: Number(entry.fat) || 0,
        source: entry.source || null,
        addedAt: new Date().toISOString(),
      };
      STATE.foodLogs[date].push(item);
      save();
      return item;
    },
    update(date, id, data) {
      const list = STATE.foodLogs[date] || [];
      const it = list.find((x) => x.id === id);
      if (!it) return null;
      if (data.servings != null) it.servings = Number(data.servings);
      if (data.calories != null) it.calories = Number(data.calories);
      if (data.protein != null) it.protein = Number(data.protein);
      if (data.carbs != null) it.carbs = Number(data.carbs);
      if (data.fat != null) it.fat = Number(data.fat);
      save();
      return it;
    },
    remove(date, id) {
      STATE.foodLogs[date] = (STATE.foodLogs[date] || []).filter((x) => x.id !== id);
      if (STATE.foodLogs[date].length === 0) delete STATE.foodLogs[date];
      save();
    },
    totalsForDate(date) {
      const list = this.listForDate(date);
      return list.reduce(
        (acc, x) => {
          const m = x.servings || 1;
          acc.calories += (x.calories || 0) * m;
          acc.protein += (x.protein || 0) * m;
          acc.carbs += (x.carbs || 0) * m;
          acc.fat += (x.fat || 0) * m;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
    },
    // Most-frequently-logged foods across ALL dates — derived on demand, no
    // new storage. Keyed by foodId when present, else lowercased name so
    // AI/manual entries of the same food still group. Each result carries the
    // macros + servings from its MOST RECENT logging (by addedAt) so a one-tap
    // re-add reproduces the last real entry. Excludes anything already logged
    // on `excludeDate` so the quick-add rail doesn't suggest today's foods.
    frequent(limit = 6, excludeDate = null) {
      const excludeKeys = new Set(
        (excludeDate ? (STATE.foodLogs[excludeDate] || []) : []).map(
          (e) => e.foodId || ('name:' + (e.name || '').toLowerCase())
        )
      );
      const map = {};
      Object.keys(STATE.foodLogs).forEach((date) => {
        (STATE.foodLogs[date] || []).forEach((e) => {
          const key = e.foodId || ('name:' + (e.name || '').toLowerCase());
          if (!e.name) return;
          if (!map[key]) map[key] = { key, count: 0, last: null, entry: null };
          map[key].count += 1;
          const at = e.addedAt || (date + 'T00:00:00');
          if (!map[key].last || at > map[key].last) {
            map[key].last = at;
            map[key].entry = e;
          }
        });
      });
      return Object.values(map)
        .filter((m) => !excludeKeys.has(m.key))
        .sort((a, b) => (b.count - a.count) || isoDesc(a.last || '', b.last || ''))
        .slice(0, limit)
        .map((m) => ({
          foodId: m.entry.foodId || null,
          name: m.entry.name,
          servings: m.entry.servings || 1,
          calories: m.entry.calories || 0,
          protein: m.entry.protein || 0,
          carbs: m.entry.carbs || 0,
          fat: m.entry.fat || 0,
          source: m.entry.source || null,
          count: m.count,
        }));
    },
  },

  // ===== Body weight log — one entry per day, kg canonical =====
  bodyweight: {
    list() {
      return (STATE.bodyweight || []).slice().sort((a, b) => isoAsc(a.date, b.date));
    },
    latest() {
      const l = this.list();
      return l.length ? l[l.length - 1] : null;
    },
    // Upsert today's (or any date's) weight. Same date overwrites — one point/day.
    log(date, kg) {
      const v = Math.round((Number(kg) || 0) * 10) / 10;
      if (v <= 0) return;
      if (!STATE.bodyweight) STATE.bodyweight = [];
      const existing = STATE.bodyweight.find((e) => e.date === date);
      if (existing) existing.kg = v;
      else STATE.bodyweight.push({ date, kg: v });
      save();
    },
    remove(date) {
      if (!STATE.bodyweight) return;
      STATE.bodyweight = STATE.bodyweight.filter((e) => e.date !== date);
      save();
    },
  },

  // ===== Water intake (per-day ml) =====
  water: {
    GOAL_ML: 2500, // default daily goal
    CUP_ML: 250,   // one cup / glass
    get(date) { return Math.max(0, (STATE.water && STATE.water[date]) || 0); },
    goal() { return this.GOAL_ML; },
    add(date, ml) {
      if (!STATE.water) STATE.water = {};
      STATE.water[date] = Math.max(0, this.get(date) + (Number(ml) || 0));
      save();
      return STATE.water[date];
    },
  },

  // ===== Nutrition targets / calorie calculator =====
  // Numbers come from the Mifflin-St Jeor equation (the current evidence-based
  // standard), NOT from an AI guess — deterministic and accurate. AI is used
  // for LOGGING (chat/photo/voice) and coaching, not for the target maths.
  nutrition: {
    // Activity multipliers applied to BMR to get TDEE (maintenance calories).
    ACTIVITY: { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 },
    // Calorie adjustment + protein target (g per kg bodyweight) per goal.
    GOAL: {
      cut:      { kcal: 0.80, protein: 2.2 },
      maintain: { kcal: 1.00, protein: 2.0 },
      bulk:     { kcal: 1.10, protein: 1.8 },
    },
    get() { return STATE.nutrition || defaultNutrition(); },
    hasTargets() {
      const n = this.get();
      return n.mode !== 'off' && n.targets && n.targets.calories > 0;
    },
    // Pure calculator — returns the computed targets for a profile without
    // saving, so the UI can preview live as the user edits the form.
    compute(profile) {
      const p = profile || {};
      const kg = Number(p.weightKg) || 0;
      const cm = Number(p.heightCm) || 0;
      const age = Number(p.age) || 0;
      if (kg <= 0 || cm <= 0 || age <= 0) return null;
      // Mifflin-St Jeor BMR
      let bmr = 10 * kg + 6.25 * cm - 5 * age + (p.sex === 'female' ? -161 : 5);
      const tdee = bmr * (this.ACTIVITY[p.activity] || 1.55);
      const g = this.GOAL[p.goal] || this.GOAL.maintain;
      const calories = Math.round(tdee * g.kcal);
      const protein = Math.round(kg * g.protein);          // g/kg bodyweight
      const fat = Math.round((calories * 0.25) / 9);        // 25% of kcal
      const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
      return { calories, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee) };
    },
    // Save the calculator profile and store the computed targets.
    setProfile(profile) {
      const n = this.get();
      n.profile = Object.assign({}, n.profile, profile);
      const c = this.compute(n.profile);
      if (c) { n.targets = { calories: c.calories, protein: c.protein, carbs: c.carbs, fat: c.fat }; n.mode = 'calc'; }
      STATE.nutrition = n;
      save();
      return n;
    },
    // Manual override — the user types the four numbers directly.
    setTargets(targets) {
      const n = this.get();
      n.targets = {
        calories: Math.max(0, Math.round(Number(targets.calories) || 0)),
        protein: Math.max(0, Math.round(Number(targets.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(targets.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(targets.fat) || 0)),
      };
      n.mode = 'manual';
      STATE.nutrition = n;
      save();
      return n;
    },
    clear() { STATE.nutrition = defaultNutrition(); save(); },
  },

  // ----- Bulk export / import (for backup) -----
  exportJSON() {
    return JSON.stringify(STATE, null, 2);
  },
  // Validate that a parsed blob has the expected shape before we accept it.
  // Lenient: only requires what must exist; optional arrays are checked only
  // when present (older backups may lack newer keys and still import fine).
  _validateBlob(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!Array.isArray(data.exercises)) return false;
    if ('sessions' in data && !Array.isArray(data.sessions)) return false;
    if ('cardio' in data && !Array.isArray(data.cardio)) return false;
    if ('supplements' in data && !Array.isArray(data.supplements)) return false;
    return true;
  },
  // Reject a blob whose entity IDs are not the safe charset our uid() produces.
  // IDs are interpolated into HTML `data-*` attributes across the render layer, so
  // an id like `"><img onerror=...>` from a hand-crafted import/backup would be an
  // attribute-breakout XSS. App-generated ids are always [A-Za-z0-9_-]; anything
  // else can only come from a tampered file, so we refuse the whole import.
  _idsSafe(data) {
    const ID = /^[A-Za-z0-9_-]{1,64}$/;
    const ok = (v) => v == null || (typeof v === 'string' && ID.test(v));
    const listOk = (arr, keys) => !Array.isArray(arr) || arr.every((r) => !r || keys.every((k) => ok(r[k])));
    if (!listOk(data.exercises, ['id'])) return false;
    if (!listOk(data.sessions, ['id', 'exerciseId'])) return false;
    if (!listOk(data.cardio, ['id', 'type'])) return false;
    if (!listOk(data.cardioTypes, ['id'])) return false;
    if (!listOk(data.sleep, ['id'])) return false;
    if (!listOk(data.foods, ['id'])) return false;
    if (!listOk(data.supplements, ['id'])) return false;
    const fl = data.foodLogs;
    if (fl && typeof fl === 'object' && !Array.isArray(fl)) {
      for (const d of Object.keys(fl)) if (!listOk(fl[d], ['id', 'foodId'])) return false;
    }
    const sl = data.supplementLogs;
    if (sl && typeof sl === 'object' && !Array.isArray(sl)) {
      for (const d of Object.keys(sl)) {
        const day = sl[d];
        if (day && typeof day === 'object') for (const sid of Object.keys(day)) if (!ok(sid)) return false;
      }
    }
    return true;
  },
  importJSON(json) {
    try {
      const data = JSON.parse(json);
      if (!this._validateBlob(data)) return false;
      if (!this._idsSafe(data)) return false;   // block attribute-breakout XSS via tampered ids

      // GO IN THROUGH THE SAME DOOR AS A CLOUD PULL: write the raw blob, then
      // let loadState() re-read it. This used to do `STATE = data; save();`,
      // which skipped every backfill loadState performs — and _validateBlob
      // deliberately only insists on `exercises`, so a legitimate backup can be
      // missing `prefs`, `cardio`, `sessions`, `foods`… Restoring one left
      // STATE.cardio undefined and the Cardio tab threw "not iterable"; a
      // missing `prefs` made every setter throw, which killed the mode toggle
      // outright. Routing through loadState() also picks up the schema
      // migrations for free — including the v210 clamp that rewrites a retired
      // theme id, which a backup taken before v210 still carries.
      //
      // Written with a bare setItem, not writeStore(): writeStore refuses while
      // READ-ONLY is set, and a restore is precisely the DELIBERATE whole-blob
      // replacement that is supposed to lift READ-ONLY. reloadState() clears the
      // flag and lets loadState() re-decide from the new bytes.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_) {
        return false;   // quota / private mode — say so rather than report success
      }
      reloadState();
      // The restored blob is now the device's truth and has to reach the cloud.
      if (typeof window !== 'undefined' && window.Cloud && window.Cloud.onLocalChange) {
        window.Cloud.onLocalChange();
      }
      return true;
    } catch (e) {
      return false;
    }
  },
  resetAll() {
    STATE = defaultState();
    STATE_LOAD_FAILED = false;   // a reset is a deliberate replacement — see importJSON
    save();
  },

  // ----- Exercises -----
  exercises: {
    list() {
      return [...STATE.exercises].sort((a, b) => {
        if (a.category !== b.category) {
          return EXERCISE_CATEGORIES.indexOf(a.category) - EXERCISE_CATEGORIES.indexOf(b.category);
        }
        return a.name.localeCompare(b.name);
      });
    },
    getById(id) {
      return STATE.exercises.find((e) => e.id === id);
    },
    add({ name, category, customImage, imagePath }) {
      const ex = {
        id: uid(),
        name: name.trim(),
        category: category || 'Other',
        imageSlug: null,
        customImage: customImage || null,
        // Storage path of the durable backup copy of customImage (set once the
        // upload lands — see Cloud.backupExerciseImage / syncExerciseImages).
        imagePath: imagePath || null,
        isCustom: true,
        inMyList: true,
        createdAt: new Date().toISOString(),
      };
      STATE.exercises.push(ex);
      save();
      return ex;
    },
    update(id, data) {
      const ex = STATE.exercises.find((x) => x.id === id);
      if (!ex) return null;
      if (data.name != null) ex.name = data.name.trim();
      if (data.category != null) ex.category = data.category;
      if (data.customImage !== undefined) ex.customImage = data.customImage;
      if (data.imagePath !== undefined) ex.imagePath = data.imagePath;
      save();
      return ex;
    },
    remove(id) {
      STATE.exercises = STATE.exercises.filter((e) => e.id !== id);
      STATE.sessions = STATE.sessions.filter((s) => s.exerciseId !== id);
      save();
    },
    setInMyList(id, value) {
      const ex = STATE.exercises.find((x) => x.id === id);
      if (!ex) return null;
      ex.inMyList = !!value;
      save();
      return ex;
    },
    // Merge admin-curated GLOBAL exercises (pulled from Supabase, owner_id IS
    // NULL) into this device's library as ordinary, non-custom entries — same
    // shape as the built-in seed/machine catalog above. Additive + idempotent:
    // skips any name already present (case-insensitive) so calling this again
    // on every boot never duplicates and never touches what the user already
    // has. isCustom stays false so js/tables.js keeps mapping these by name to
    // the shared global catalog instead of re-uploading them as this user's
    // own customs. `list` items: { name, category, imageSlug, machineType }.
    mergeGlobal(list) {
      if (!Array.isArray(list) || !list.length) return 0;
      const existing = new Set(STATE.exercises.map((e) => (e.name || '').trim().toLowerCase()));
      let added = 0;
      list.forEach((g) => {
        const name = ((g && g.name) || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (existing.has(key)) return;
        existing.add(key);
        STATE.exercises.push({
          id: uid(),
          name,
          category: EXERCISE_CATEGORIES.includes(g.category) ? g.category : 'Other',
          imageSlug: g.imageSlug || null,
          machineType: g.machineType || null,
          customImage: null,
          isCustom: false,
          inMyList: false,
          createdAt: new Date().toISOString(),
        });
        added++;
      });
      // Housekeeping: the global catalog is admin-owned and re-pulled on every
      // boot, so merging it must never flag the blob dirty (see saveLocal).
      if (added) saveLocal();
      return added;
    },
  },

  // ----- Sessions (workout sets logged per exercise) -----
  sessions: {
    listByExercise(exerciseId) {
      return STATE.sessions
        .filter((s) => s.exerciseId === exerciseId)
        .sort((a, b) => isoDesc(a.date, b.date) || isoDesc(a.createdAt, b.createdAt));
    },
    listAll() {
      return [...STATE.sessions].sort(
        (a, b) => isoDesc(a.date, b.date) || isoDesc(a.createdAt, b.createdAt)
      );
    },
    lastForExercise(exerciseId, excludeId = null) {
      const list = this.listByExercise(exerciseId).filter((s) => s.id !== excludeId);
      return list[0] || null;
    },
    get(id) {
      return STATE.sessions.find((s) => s.id === id) || null;
    },
    // `kind` is optional and today only ever 'minimum' — the reduced session the
    // rest-day sheet offers instead of nothing. It is written ONLY when present,
    // so the millions of ordinary sessions do not each carry a null field: the
    // blob is serialised whole and uploaded on every save.
    add({ exerciseId, date, sets, kind }) {
      const session = {
        id: uid(),
        exerciseId,
        date,
        ...(kind ? { kind } : {}),
        sets: sets.map((s) => ({
          reps: Number(s.reps) || 0,
          weight: Number(s.weight) || 0,
        })),
        createdAt: new Date().toISOString(),
      };
      STATE.sessions.push(session);
      save();
      return session;
    },
    update(id, { date, sets }) {
      const s = STATE.sessions.find((x) => x.id === id);
      if (!s) return null;
      if (date) s.date = date;
      if (sets) {
        s.sets = sets.map((x) => ({ reps: Number(x.reps) || 0, weight: Number(x.weight) || 0 }));
      }
      save();
      return s;
    },
    remove(id) {
      STATE.sessions = STATE.sessions.filter((s) => s.id !== id);
      save();
    },
    // Best stats across all sessions of an exercise
    bestStats(exerciseId) {
      const list = this.listByExercise(exerciseId);
      let maxWeight = 0;
      let maxReps = 0;
      let maxVolume = 0;
      let totalSets = 0;
      list.forEach((s) => {
        let sessionVol = 0;
        s.sets.forEach((set) => {
          if (set.weight > maxWeight) maxWeight = set.weight;
          if (set.reps > maxReps) maxReps = set.reps;
          sessionVol += set.reps * set.weight;
          totalSets += 1;
        });
        if (sessionVol > maxVolume) maxVolume = sessionVol;
      });
      return { maxWeight, maxReps, maxVolume, totalSets, sessionCount: list.length };
    },
    // Returns the best Epley 1RM (kg) across all sets of all sessions for an
    // exercise. Must scan raw per-set values because maxWeight and maxReps in
    // bestStats() can come from DIFFERENT sets, making the naive product wrong.
    bestOneRM(exerciseId) {
      let best = 0;
      this.listByExercise(exerciseId).forEach((s) => {
        (s.sets || []).forEach((set) => {
          if (set.reps > 0 && set.weight > 0) {
            const orm = set.weight * (1 + set.reps / 30);
            if (orm > best) best = orm;
          }
        });
      });
      return best; // 0 if no valid sets
    },
    // Snapshot of both PR values, optionally excluding one session id (edit path).
    // Returns { maxWeight, bestORM, sessionCount } for the exercise.
    prSnapshot(exerciseId, excludeId = null) {
      const sessions = excludeId
        ? this.listByExercise(exerciseId).filter((s) => s.id !== excludeId)
        : this.listByExercise(exerciseId);
      let maxWeight = 0, bestORM = 0;
      sessions.forEach((s) => {
        (s.sets || []).forEach((set) => {
          if (set.weight > maxWeight) maxWeight = set.weight;
          if (set.reps > 0 && set.weight > 0) {
            const orm = set.weight * (1 + set.reps / 30);
            if (orm > bestORM) bestORM = orm;
          }
        });
      });
      return { maxWeight, bestORM, sessionCount: sessions.length };
    },
    // ONE pass over every session, grouped by exercise, carrying everything
    // bestStats() and prSnapshot() return. Those three each re-filter the WHOLE
    // session list for one exercise — and listByExercise() sorts the match too,
    // which none of them need — so a screen asking about every exercise ran one
    // full scan plus one throwaway sort PER exercise. Measured at roughly fifty
    // times the cost of this single grouping pass on a real-sized log, on the
    // three screens that do exactly that: Program's top records, Personal
    // Records, and the exercise grid (which rebuilds on every filter tap and
    // every keystroke). The per-exercise functions stay as they are for the
    // single-exercise callers — the save paths — where one scan beats a map.
    statsByExercise() {
      const idx = Object.create(null);
      STATE.sessions.forEach((s) => {
        let e = idx[s.exerciseId];
        if (!e) e = idx[s.exerciseId] = this.emptyStats();
        e.sessionCount += 1;
        let vol = 0;
        (s.sets || []).forEach((set) => {
          const w = Number(set.weight) || 0, r = Number(set.reps) || 0;
          if (w > e.maxWeight) e.maxWeight = w;
          if (r > e.maxReps) e.maxReps = r;
          vol += r * w;
          e.totalSets += 1;
          // Epley, per SET: maxWeight and maxReps can come from different sets,
          // so the product of the two maxima is not a real lift.
          if (r > 0 && w > 0) {
            const orm = w * (1 + r / 30);
            if (orm > e.bestORM) e.bestORM = orm;
          }
        });
        if (vol > e.maxVolume) e.maxVolume = vol;
      });
      return idx;
    },
    // The zero row, so a caller can look up an exercise with no sessions at all
    // without a null test at every use site.
    emptyStats() {
      return { maxWeight: 0, maxReps: 0, maxVolume: 0, totalSets: 0, sessionCount: 0, bestORM: 0 };
    },
  },

  // ----- Reminders -----

  // =========================================================================
  // NOTIFICATIONS — APPLY-notifications.md §2, §3, §6
  //
  // The spec asks for one key, `localStorage['vault.notif.v1']`, holding the
  // whole thing. It is split here, deliberately, along the line between a
  // PREFERENCE and a COUNTER:
  //
  //   · the config (window, channels) lives in the blob, reached through DB.*
  //     like everything else. Writing it straight to localStorage would break
  //     this project's one hard storage rule AND would mean the reminder times
  //     you set on the phone never reach the web, because only the blob syncs.
  //   · `day` — today's date, count and sent tags — stays device-local, and
  //     that is not a shortcut. It is the daily-cap ledger. Syncing it would let
  //     a cap spent on the phone silence the laptop, which is the opposite of
  //     what a per-device cap means.
  //
  // The SHAPE the spec specifies is kept exactly; only where each half is
  // written changes.
  // =========================================================================
  notif: {
    DAY_KEY: 'vault.notif.day.v1',
    // The delivered-notification LOG. Device-local for the same reason the day
    // ledger is, and one more: it records what THIS DEVICE actually showed. A
    // reminder that arrived on the phone was never seen on the laptop, so
    // syncing the log would make the laptop's history a lie. Config syncs
    // (a time set on the phone must reach the web); the record of what was
    // shown does not.
    LOG_KEY: 'vault.notif.log.v1',
    LOG_MAX: 120,
    // What sync() last armed, so a foreground can tell which of those alarms
    // fired while the app was dead. See Notify.reconcile().
    ARMED_KEY: 'vault.notif.armed.v1',
    // How many days ahead the native path arms. Owner's choice.
    //
    // This is the number that replaced an UNBOUNDED daily repeat. `{on:{hour,
    // minute}}` repeats forever at a wall-clock time, but every condition was
    // evaluated for the day it was armed — so the training alarm fired on rest
    // days and the streak alarm fired on a broken streak, until the next
    // foreground. Concrete dated alarms can express "not on Thursday"; a
    // repeat cannot. The cost is that they EXPIRE: go this many days without
    // opening the app and reminders stop until you do.
    ARM_DAYS: 7,
    // A runaway guard, not a policy. 7 days x a cap of 6 is 42; Android drops a
    // schedule that gets silly rather than erroring, so cap it well above the
    // real worst case and trim from the FURTHEST day first.
    MAX_ARMED: 60,
    MAX_WATER_SLOTS: 12,

    // ONE-TIME MIGRATION from the v208 DB.reminders config. Without it, "one
    // system" would silently discard every supplement time and water setting a
    // user had already configured — they would open the new page and find it
    // empty. Runs once: the marker is DB.notif existing at all.
    migrateFromReminders() {
      if (STATE.notif) return false;
      let r = null;
      try { r = DB.reminders.get(); } catch (_) { return false; }
      const next = this.defaults();
      if (r && r.enabled) {
        const doses = [];
        (STATE.supplements || []).forEach((sup) => {
          (sup.times || []).forEach((hhmm, i) => {
            doses.push({ id: 's' + sup.id + '_' + i, at: hhmm, name: sup.name || '' });
          });
        });
        next.channels.supps.doses = doses;
        next.channels.water.on = !!(r.water && r.water.on);
        if (r.water && r.water.everyMin) next.channels.water.everyMin = r.water.everyMin;
        if (r.water && r.water.from) next.window.start = r.water.from;
        if (r.water && r.water.to) next.window.end = r.water.to;
        // They had already granted permission for the old system, so do not ask
        // again — that would spend the one OS prompt on someone who said yes.
        next.asked = true;
      }
      STATE.notif = next;
      saveLocal();   // a derivation from data already in the blob, not new user data
      return true;
    },

    defaults() {
      return {
        asked: false,
        window: { start: '07:00', end: '23:30' },
        // 'auto' keeps the derived 3-then-6 ramp. A number overrides it; 'none'
        // removes the ceiling entirely. Exposed on the settings page by the
        // owner's decision — a guard that silently drops reminders is a guard
        // the user experiences as "it doesn't work".
        cap: 'auto',
        channels: {
          train: { on: true, mode: 'auto', at: '09:00', offsetMin: 30 },
          supps: { on: true, doses: [] },
          water: { on: true, everyMin: 120 },
          // `meals` mirrors `supps.doses` exactly — {id, at, name} — because the
          // owner sets the times. That is also what finally gives {meal} a data
          // source: the app has no meal-window concept anywhere (the only
          // "meal" string in the codebase is a food-CATEGORY label), so this
          // template could never have been filled from anything else.
          food: { on: true, meals: [] },
          streak: { on: true },
        },
      };
    },

    // Same discipline as DB.reminders: get() fixes the shape, every setter
    // writes the WHOLE object back, so no setter can drop a sibling's field.
    get() {
      const d = this.defaults();
      const n = STATE.notif || {};
      const c = n.channels || {};
      // `cap` arrived after the first shipped shape, so an older blob has no
      // field at all — which must read as 'auto', not as 0.
      let cap = n.cap;
      if (cap !== 'none' && !(Number(cap) > 0)) cap = 'auto';
      return {
        asked: !!n.asked,
        cap,
        window: Object.assign(d.window, n.window || {}),
        channels: {
          train: Object.assign(d.channels.train, c.train || {}),
          supps: Object.assign(d.channels.supps, c.supps || {}, {
            doses: Array.isArray((c.supps || {}).doses) ? c.supps.doses.slice() : [],
          }),
          water: Object.assign(d.channels.water, c.water || {}),
          // The old shape was {on, delayMin} — a delay after a "meal window"
          // that never existed in the app. It is dropped rather than migrated:
          // there is no time to derive from it. `on` carries over untouched, so
          // a user who switched the channel off stays switched off.
          food: Object.assign(d.channels.food, c.food || {}, {
            meals: Array.isArray((c.food || {}).meals) ? c.food.meals.slice() : [],
          }),
          streak: Object.assign(d.channels.streak, c.streak || {}),
        },
      };
    },
    setAsked() { STATE.notif = Object.assign(this.get(), { asked: true }); save(); },
    setCap(v) {
      const cur = this.get();
      cur.cap = (v === 'none' || Number(v) > 0) ? v : 'auto';
      STATE.notif = cur;
      save();
    },

    // Project a supplement's OWN times into the dose list.
    //
    // There were two supplement-time UIs writing to two different stores: the
    // supplement editor wrote `sup.times`, which the scheduler never reads, and
    // the notifications page wrote channels.supps.doses, which it does. So a
    // time set on the supplement itself did nothing at all — it saved, it
    // displayed, and it never notified.
    //
    // Derived doses are marked `auto` and are replaced wholesale on every save,
    // so editing or deleting a time on the supplement is reflected exactly.
    // Doses added by hand on the notifications page carry no `auto` flag and are
    // never touched. They come out LINKED, which is what lets them fall silent
    // once the supplement is ticked off for the day.
    syncSuppDoses(suppId, name, times) {
      if (!suppId) return;
      const cur = this.get();
      const kept = cur.channels.supps.doses.filter((d) => {
        // Sweep only what THIS function owns: the doses it derived last time,
        // which it is about to rebuild. The `auto` test is load-bearing — on
        // `d.suppId === suppId` alone, a dose the user typed on the reminders
        // page and merely LINKED to this supplement was deleted the next time
        // they edited that supplement, silently and with no way back.
        if (d.auto && d.suppId === suppId) return false;
        // Also sweep the un-linked ids minted by migrateFromReminders(), or the
        // migrated copy and the derived one would both fire for the same dose.
        return String(d.id || '').indexOf('s' + suppId + '_') !== 0;
      });
      (times || []).forEach((at) => {
        if (!at) return;
        kept.push({ id: 's' + suppId + '_' + at, at, name: name || '', suppId, auto: true });
      });
      this.setChannel('supps', { doses: kept });
    },
    setWindow(patch) {
      const cur = this.get();
      STATE.notif = Object.assign(cur, { window: Object.assign(cur.window, patch || {}) });
      save();
    },
    setChannel(id, patch) {
      const cur = this.get();
      if (!cur.channels[id]) return;
      cur.channels[id] = Object.assign(cur.channels[id], patch || {});
      STATE.notif = cur;
      save();
    },

    // ----- today's ledger (device-local, see the note above) ----------------
    day() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(this.DAY_KEY) || 'null'); } catch (_) { d = null; }
      const today = todayISO();
      if (!d || d.date !== today) d = { date: today, count: 0, sent: [] };
      return d;
    },
    _writeDay(d) {
      try { localStorage.setItem(this.DAY_KEY, JSON.stringify(d)); } catch (_) {}
    },
    markSent(tag) {
      const d = this.day();
      if (d.sent.indexOf(tag) !== -1) return false;   // the tag IS the dedupe
      d.sent.push(tag);
      d.count += 1;
      this._writeDay(d);
      return true;
    },
    alreadySent(tag) { return this.day().sent.indexOf(tag) !== -1; },

    // The cap is 6, or 3 while the account is under 14 days old — a new user
    // judges the app by its first week, and six a day in that week reads as
    // noise before any of it has proved useful. Not exposed as a setting.
    dailyCap(iso) {
      const set = this.get().cap;
      if (set === 'none') return Infinity;
      if (Number(set) > 0) return Number(set);
      const first = (STATE.sessions || []).concat(STATE.cardio || [])
        .map((s) => s.date).filter(Boolean).sort()[0];
      if (!first) return 3;
      // Measured against the DAY BEING SCHEDULED, not against now: arming a week
      // ahead crosses the 14-day line, and a day on the far side of it deserves
      // the cap it will actually have when it arrives.
      const on = this._dateOf(iso || todayISO()).getTime();
      const age = Math.floor((on - this._dateOf(first).getTime()) / 864e5);
      return age < 14 ? 3 : 6;
    },

    // ----- the wake window --------------------------------------------------
    // start > end means it crosses midnight (14:00 -> 06:00), so the test has
    // to be an OR rather than a range. Getting this wrong silently drops every
    // reminder for anyone on a night schedule.
    inWindow(hhmm) {
      const w = this.get().window;
      const t = this._min(hhmm), a = this._min(w.start), b = this._min(w.end);
      return a <= b ? (t >= a && t <= b) : (t >= a || t <= b);
    },

    // ----- small shared helpers ---------------------------------------------

    _min(hhmm) {
      const p = String(hhmm).split(':');
      return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
    },
    _hhmm(min) {
      const m = ((Math.round(min) % 1440) + 1440) % 1440;
      return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
    },

    // The ONE writer of at/hour/minute. They used to be set in two places — the
    // item was built with all three, then the out-of-window deferral rewrote
    // only `at`. The in-app path reads `at` and the native path reads
    // hour/minute, so a deferred dose armed the OS alarm for the ORIGINAL time,
    // outside the window it had just been moved out of. One writer means they
    // can no longer disagree.
    _setAt(it, hhmm) {
      it.at = hhmm;
      it.hour = Math.floor(this._min(hhmm) / 60);
      it.minute = this._min(hhmm) % 60;
      return it;
    },

    // Numeric constructor, deliberately. `new Date('2026-08-04')` parses as UTC
    // and `toISOString()` converts back — both shift the day for anyone east of
    // UTC, which is the bug class CLAUDE.md records happening three times.
    _dateOf(iso, h, m) {
      const p = String(iso).split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), h || 0, m || 0, 0, 0);
    },

    // Same definition computeStreak() uses: any session or cardio row on that
    // calendar day.
    _activityOn(iso) {
      if ((STATE.sessions || []).some((s) => s.date === iso)) return true;
      return (STATE.cardio || []).some((c) => c.date === iso);
    },

    // Consecutive active days ending the day BEFORE `iso`.
    //
    // Not computeStreak(): that one counts today when today has activity, so
    // asking it "is the streak at risk?" on a day you already trained returns a
    // healthy number and the last-call alarm fires anyway. What the streak
    // channel needs is the run that is standing there UNEXTENDED — which is
    // exactly the run ending yesterday.
    _streakEndingBefore(iso) {
      let n = 0;
      let cur = addDaysISO(iso, -1);
      while (this._activityOn(cur) && n < 3650) { n += 1; cur = addDaysISO(cur, -1); }
      return n;
    },

    // Pull a fixed time inside the wake window. Without this, a user whose day
    // ends at 18:00 is scheduled a 19:30 streak reminder and then has it dropped
    // by the window guard — the channel is on, configured, and silent forever.
    _clampToWindow(hhmm) {
      const w = this.get().window;
      const a = this._min(w.start), b = this._min(w.end), t = this._min(hhmm);
      if (a > b) {
        // Crosses midnight (22:00 -> 06:00). Inside is t >= a OR t <= b, so the
        // OUTSIDE band is (b, a) — the WIDEST part of the day, not the narrowest.
        // Returning hhmm unchanged here handed the window guard a 09:00 that it
        // then dropped, leaving the train and streak channels switched on,
        // configured, and permanently silent for anyone on a night schedule.
        if (t >= a || t <= b) return hhmm;
        // Outside: snap to whichever edge is nearer around the clock, keeping the
        // same 30-minute lead before the window closes that the day case uses.
        return (t - b) <= (a - t) ? this._hhmm(Math.max(0, b - 30)) : this._hhmm(a);
      }
      if (t >= a && t <= b) return hhmm;
      return this._hhmm(t > b ? Math.max(a, b - 30) : a);
    },

    // Where a reminder takes you when tapped. ONE map — it used to exist twice,
    // and the copy in notify.js keyed off `it.kind`, a field these items have
    // never carried, so every catch-up tap silently went to `supplements`.
    destFor(channel) {
      const map = {
        train: { view: 'session-day', context: { date: todayISO() } },
        supps: { view: 'supplements' },
        water: { view: 'food' },
        food: { view: 'food' },
        streak: { view: 'home' },
      };
      return map[channel] || { view: 'home' };
    },

    // ----- §3: the schedule -------------------------------------------------
    //
    // Returns the reminders for ONE calendar date, already past every guard in
    // §6. It computes and nothing else: no sending, no timers, no platform
    // knowledge. That is what lets the executor be swapped without touching any
    // of this.
    //
    // PER DATE, not "today", and that is the whole point. Every condition here
    // — is it a training day, is the streak unextended, has the goal been met —
    // is a property of a SPECIFIC day. The native path used to arm an unbounded
    // daily repeat from a single day's answers, so a Monday rest day inherited
    // Sunday's training alarm forever.
    //
    // opts.includePast / opts.includeSent relax the two guards that only make
    // sense for "what is still coming". Notify.missed() asks the opposite
    // question and passes includePast — so there is one code path, not two that
    // can drift.
    scheduleForDate(iso, opts) {
      const o = opts || {};
      const out = [];
      const cfg = this.get();
      const ch = cfg.channels;
      const today = todayISO();
      const isToday = iso === today;
      const D = this._dateOf(iso);
      const dayOffset = Math.round((D.getTime() - this._dateOf(today).getTime()) / 864e5);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      // Every item carries BOTH shapes: `at`/`channel`/`payload` for the in-app
      // path, and `id`/`hour`/`minute` for the Capacitor plugin, which keys
      // notifications by INTEGER id. The id is derived from the tag, and the tag
      // carries the DATE and the TIME rather than an index — so it is stable
      // across runs and across a re-distribution, which is what lets a re-sync
      // REPLACE an alarm instead of orphaning it and arming a duplicate.
      const push = (at, channel, tag, payload) => {
        out.push(this._setAt({ date: iso, dayOffset, channel, tag, payload, id: hashId(tag) }, at));
      };

      // -- train ------------------------------------------------------------
      // Training days only, and never on a scheduled rest day — asked of THIS
      // date, so a rest day genuinely produces nothing.
      const workout = DB.plan.workoutForDate(D);
      if (ch.train.on && workout) {
        let at = ch.train.at || '09:00';
        if (ch.train.mode === 'auto') {
          // `createdAt`, not a start time — sessions do not record one. It is
          // the moment the set was logged, which happens during or right after
          // the workout, so its time-of-day is the closest thing the data has
          // to "when do they train". Checked: no session field named startedAt
          // exists anywhere, so averaging that would have silently found zero
          // samples and fallen back to 09:00 forever.
          const times = (STATE.sessions || [])
            .filter((s) => s.createdAt).slice(-10).map((s) => new Date(s.createdAt))
            .filter((d) => !isNaN(d));
          if (times.length >= 3) {
            const avg = times.reduce((a, d) => a + d.getHours() * 60 + d.getMinutes(), 0) / times.length;
            const mins = Math.max(0, Math.round(avg) - (Number(ch.train.offsetMin) || 30));
            at = this._hhmm(mins);
          }
          // Under three logged sessions there is no habit to infer, so the spec
          // fixes 09:00 rather than averaging one data point into a guess.
        }
        push(this._clampToWindow(at), 'train', 'train:' + iso,
          { name: workout.name || '', n: (workout.exerciseIds || []).length });
      }

      // -- supps -------------------------------------------------------------
      // One per configured dose, at its own time. No time is ever suggested.
      if (ch.supps.on) {
        ch.supps.doses.forEach((d, i) => {
          if (!d || !d.at) return;
          // A dose linked to a real supplement goes quiet once it is ticked off.
          // This is the promise on the permission sheet — "logging something
          // cancels its reminder" — finally being true for more than water.
          if (isToday && d.suppId && DB.supplements.isTaken(d.suppId, iso)) return;
          push(d.at, 'supps', 'supps:' + (d.id || i) + ':' + iso,
            { name: d.name || '', i: i + 1, n: ch.supps.doses.length, suppId: d.suppId || null });
        });
      }

      // -- food --------------------------------------------------------------
      // Times the owner sets, exactly like a supplement dose. Silent with no
      // calorie target — a "you have N kcal left" with no N is the defect this
      // whole rebuild exists to remove — and silent once today's target is met.
      if (ch.food.on && DB.nutrition.hasTargets()) {
        const goalKcal = Number((DB.nutrition.get().targets || {}).calories) || 0;
        const eaten = isToday ? (DB.foodLogs.totalsForDate(iso).calories || 0) : 0;
        if (!isToday || eaten < goalKcal) {
          ch.food.meals.forEach((m, i) => {
            if (!m || !m.at) return;
            push(m.at, 'food', 'food:' + (m.id || i) + ':' + iso,
              { name: m.name || '', i: i + 1, n: ch.food.meals.length });
          });
        }
      }

      // -- streak -------------------------------------------------------------
      // All the conditions the old comment promised and only one of which was
      // implemented: a streak worth protecting, NOTHING LOGGED TODAY, and a time
      // that is actually inside the user's own window. Today only — whether a
      // future day will be "at risk" is unknowable, and arming it would be a
      // guess dressed as a fact.
      if (ch.streak.on && isToday && !this._activityOn(iso)) {
        const run = this._streakEndingBefore(iso);
        if (run >= 7) push(this._clampToWindow('19:30'), 'streak', 'streak:' + iso, { n: run });
      }

      // §6 guards, applied here so no caller can forget one.
      const kept = out.filter((it) => {
        if (isToday && !o.includeSent && this.alreadySent(it.tag)) return false;
        // Outside the wake window: supps and food defer to window.start (via
        // _setAt, so hour/minute move with it), everything else is dropped.
        if (!this.inWindow(it.at)) {
          if (it.channel !== 'supps' && it.channel !== 'food') return false;
          this._setAt(it, cfg.window.start);
        }
        // Past due is dropped BEFORE the cap is counted. It used to be dropped
        // by the caller, after — so opening the app in the evening spent the
        // whole day's allowance on reminders whose moment had already gone.
        if (isToday && !o.includePast && this._min(it.at) <= nowMin) return false;
        return true;
      });

      // Over the cap, food yields first; train/supps/streak never do. (Water is
      // not in this list because it is no longer generate-then-trim — see below.)
      // noCap lets the notifications page compute how many were HELD BACK, by
      // asking the same question twice. Without it the cap does its work
      // invisibly, which is a large part of why the schedule felt broken.
      const cap = o.noCap ? Infinity : this.dailyCap(iso);
      const room = Math.max(0, cap - (isToday && !o.noCap ? this.day().count : 0));
      const rank = { food: 1, train: 9, supps: 9, streak: 9 };
      while (kept.length > room) {
        let victim = -1, worst = 9;
        for (let i = kept.length - 1; i >= 0; i--) {
          const r = rank[kept[i].channel];
          if (r < worst) { worst = r; victim = i; }
        }
        if (victim === -1 || worst === 9) break;   // nothing left that may yield
        kept.splice(victim, 1);
      }

      // -- water --------------------------------------------------------------
      // Water yields to every other channel, so it is generated LAST, into
      // whatever room is left. It is also DISTRIBUTED rather than stepped.
      //
      // The old loop stepped from window.start and stopped after 5, which with
      // the defaults died at 15:00 and never reached the 23:30 the user had set.
      // Raising the 5 could not fix it either: the cap then evicted the LATEST
      // slots first, truncating coverage back to the morning by another route.
      // Distributing n slots evenly inside the window means whatever count
      // survives still covers the whole day, which is the thing the user asked
      // for when they set the window.
      const goal = (DB.water && DB.water.goal) ? DB.water.goal() : 0;
      if (ch.water.on && goal > 0 && !(isToday && DB.water.get(iso) >= goal)) {
        const a = this._min(cfg.window.start), b = this._min(cfg.window.end);
        const span = (b >= a) ? (b - a) : (b + 1440 - a);
        const step = Math.max(30, Number(ch.water.everyMin) || 120);
        const free = Math.max(0, room - kept.length);
        const n = Math.min(Math.max(1, Math.round(span / step)), this.MAX_WATER_SLOTS, free);
        const waterStart = out.length;   // where water begins IN `out`, not in `kept`
        for (let k = 1; k <= n; k++) {
          // Deliberately strictly INSIDE the window: a reminder at the exact
          // minute the day starts is noise, and one at the minute it ends is
          // too late to act on. Rounded to 5 so it reads as a time, not a
          // computation.
          const at = this._hhmm(a + Math.round((span * k) / (n + 1) / 5) * 5);
          const tag = 'water:' + iso + ':' + at;
          if (isToday && !o.includeSent && this.alreadySent(tag)) continue;
          if (isToday && !o.includePast && this._min(at) <= nowMin) continue;
          push(at, 'water', tag, { slot: k, n });
        }
        // push() appends to `out`, not `kept` — move the new ones across.
        out.slice(waterStart).forEach((it) => kept.push(it));
      }

      return kept.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
    },

    // Back-compat: everything that only ever meant "today".
    scheduleAll(opts) { return this.scheduleForDate(todayISO(), opts); },

    // What the NATIVE path arms: today plus the next `days` days, each computed
    // with its own conditions. Trimmed from the FURTHEST day first, so losing
    // the tail costs day 7 and never day 1.
    scheduleAhead(days) {
      const n = Math.max(0, days == null ? this.ARM_DAYS : days);
      let all = [];
      for (let i = 0; i <= n; i++) {
        try { all = all.concat(this.scheduleForDate(addDaysISO(todayISO(), i))); } catch (_) {}
      }
      if (all.length > this.MAX_ARMED) {
        all.sort((a, b) => (a.dayOffset - b.dayOffset) || (a.at < b.at ? -1 : 1));
        all = all.slice(0, this.MAX_ARMED);
      }
      return all;
    },

    // ----- §4: the words ----------------------------------------------------
    //
    // ONE builder, and every delivery path calls it. There used to be two: this
    // logic (in app.js) which read live DB data, and a second in notify.js which
    // read only `item.payload` and then STRIPPED any placeholder it could not
    // fill. The second one fed the OS notifications, the web notifications and
    // the catch-up — i.e. everything that actually reached a phone — so
    // '{cur} of {goal} ml' arrived reading literally "of ml", and
    // '{hours} hours left in your day' arrived at 09:00 with no number in it.
    //
    // THE RULE THAT KEEPS IT GONE: nothing is stripped. Every branch fills every
    // placeholder its key declares, and where a value is genuinely unavailable
    // it selects a DIFFERENT key rather than passing a template with a hole. A
    // stray '{' in the output is now a visible defect instead of a swallowed
    // one — which is exactly how the old one hid for so long.
    _fill(key, vars) {
      const tr = (typeof t === 'function') ? t : (k) => k;
      let s = tr(key);
      Object.keys(vars || {}).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
      return s;
    },

    /**
     * @param {object} item  one item from scheduleForDate()
     * @param {'live'|'plan'} [mode]  defaults from the item's own date.
     *   'live' — today. Read the user's numbers as they stand right now.
     *   'plan' — a day armed in advance. Its words are baked when the alarm is
     *            set, so they must be true at ANY hour of that day: the plan,
     *            the target, never "as of now" arithmetic.
     * @returns {{title:string, body:string}}
     */
    text(item, mode) {
      const tr = (typeof t === 'function') ? t : (k) => k;
      const num = (typeof fmtNum === 'function') ? fmtNum : ((n) => String(n));
      const it = item || {};
      const p = it.payload || {};
      const iso = it.date || todayISO();
      const live = (mode || (iso === todayISO() ? 'live' : 'plan')) === 'live';
      const F = (k, v) => this._fill(k, v || {});

      switch (it.channel) {
        case 'train': {
          // "Push" used to be baked into the template, which is simply wrong
          // data on a Legs day — in the one line the user reads at a glance.
          const day = p.name != null ? null : DB.plan.workoutForDate(this._dateOf(iso));
          const name = p.name || (day && day.name) || tr('notif_ch_train');
          const n = p.n != null ? p.n : ((day && day.exerciseIds) ? day.exerciseIds.length : 0);
          const title = F('notif_train_title', { name, n: num(n) });
          if (!live) return { title, body: F('notif_train_body_plan', { n: num(n) }) };
          // Last performed set, derived exactly as Home derives it: listAll() is
          // newest-first and a session's sets stay in performed order, so the
          // last element of the newest non-empty session IS the set they
          // finished on.
          const ls = DB.sessions.listAll().find((x) => x.sets && x.sets.length);
          const set = ls ? ls.sets[ls.sets.length - 1] : null;
          const ex = ls ? DB.exercises.getById(ls.exerciseId) : null;
          if (!set || !ex) return { title, body: F('notif_train_body_first', {}) };
          const exName = (typeof exDisplayName === 'function') ? exDisplayName(ex) : (ex.name || '');
          return { title, body: F('notif_train_body', { ex: exName, kg: num(set.weight || 0), reps: num(set.reps || 0) }) };
        }

        case 'supps':
          return {
            title: F('notif_supps_title', { name: p.name || tr('notif_ch_supps') }),
            body: F('notif_supps_body', { i: num(p.i || 1), n: num(p.n || 1) }),
          };

        case 'water': {
          const goal = DB.water.goal();
          const cup = DB.water.CUP_ML || 250;
          if (!live) {
            return {
              title: F('notif_water_title_plan', { goal: num(goal) }),
              body: F('notif_water_body_plan', { cups: num(Math.ceil(goal / cup)) }),
            };
          }
          const cur = DB.water.get(iso);
          const left = Math.max(0, goal - cur);
          const title = F('notif_water_title', { cur: num(cur), goal: num(goal) });
          // No {hours}, by removal rather than by fixing the number. The old
          // sentence talked about time running out and was scheduled for the
          // MORNING; millilitres left is true at any hour, and it is the thing
          // the reminder is actually asking for.
          if (left <= 0) return { title, body: F('notif_water_body_done', {}) };
          return { title, body: F('notif_water_body', { left: num(left), cups: num(Math.ceil(left / cup)) }) };
        }

        case 'food': {
          const meal = p.name || tr('notif_ch_food');
          const tg = DB.nutrition.get().targets || {};
          const goalK = Math.round(Number(tg.calories) || 0);
          const goalP = Math.round(Number(tg.protein) || 0);
          if (!live) {
            return {
              title: F('notif_food_title_plan', { meal, kcal: num(goalK) }),
              body: F('notif_food_body_plan', { p: num(goalP) }),
            };
          }
          const tot = DB.foodLogs.totalsForDate(iso);
          const kcal = Math.max(0, Math.round(goalK - (tot.calories || 0)));
          const prot = Math.max(0, Math.round(goalP - (tot.protein || 0)));
          const title = F('notif_food_title', { meal, kcal: num(kcal) });
          if (prot <= 0) return { title, body: F('notif_food_body_nop', {}) };
          return { title, body: F('notif_food_body', { p: num(prot) }) };
        }

        case 'streak':
          return {
            title: F('notif_streak_title', { n: num(p.n || 0) }),
            body: F('notif_streak_body', {}),
          };

        default:
          return { title: F('notif_summary_title', { n: num(1) }), body: '' };
      }
    },

    // ----- the delivered-notification log -----------------------------------
    //
    // What this device actually SHOWED, so the notifications page can answer
    // "what did I get?" — a question nothing in the app could answer before,
    // because the only two records were per-day dedupe sets that both reset at
    // midnight. Device-local for the reason stated at LOG_KEY.
    //
    // Every write path funnels through logAdd, which dedupes on `tag`: the paths
    // race by design (the OS alarm fires AND a foreground reconciles it), and
    // one reminder must appear once.
    _readLog() {
      try {
        const v = JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]');
        return Array.isArray(v) ? v : [];
      } catch (_) { return []; }
    },
    _writeLog(list) {
      try { localStorage.setItem(this.LOG_KEY, JSON.stringify(list.slice(0, this.LOG_MAX))); } catch (_) {}
    },
    logAdd(rec) {
      // Must never throw: it is called from inside notification delivery, and a
      // logging failure that breaks the reminder is worse than no log.
      try {
        if (!rec || !rec.tag) return null;
        const list = this._readLog();
        if (list.some((x) => x.tag === rec.tag)) return null;
        const full = {
          id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          tag: rec.tag,
          date: rec.date || todayISO(),
          at: rec.at || '',
          ts: rec.ts || Date.now(),
          channel: rec.channel || 'summary',
          title: rec.title || '',
          body: rec.body || '',
          // Stored, not re-rendered later: the notification really did say this,
          // and a record that re-renders would silently rewrite history when a
          // template or the UI language changes.
          lang: rec.lang || ((DB.prefs.get().lang) || 'en'),
          path: rec.path || 'bar',
          seen: !!rec.seen,
        };
        list.unshift(full);
        this._writeLog(list);
        return full;
      } catch (_) { return null; }
    },
    logList(limit) {
      const l = this._readLog();
      return limit ? l.slice(0, limit) : l;
    },
    logForDate(iso) { return this._readLog().filter((x) => x.date === iso); },
    logHas(tag) { return this._readLog().some((x) => x.tag === tag); },
    logMarkSeen(id) {
      const l = this._readLog();
      let hit = false;
      l.forEach((x) => { if (x.id === id && !x.seen) { x.seen = true; hit = true; } });
      if (hit) this._writeLog(l);
    },
    logMarkAllSeen() {
      const l = this._readLog();
      if (!l.some((x) => !x.seen)) return;
      l.forEach((x) => { x.seen = true; });
      this._writeLog(l);
    },
    unseenCount() { return this._readLog().filter((x) => !x.seen).length; },
    logClear() { try { localStorage.removeItem(this.LOG_KEY); } catch (_) {} },

    // The manifest of what sync() last handed to the OS. Reconciliation compares
    // it against getPending() to learn which alarms fired while the app was
    // dead — only possible because the alarms are one-shots now: a daily repeat
    // never leaves getPending(), so "did it fire?" was unobservable.
    armedSet(list) {
      try {
        localStorage.setItem(this.ARMED_KEY, JSON.stringify((list || []).map((it) => ({
          tag: it.tag, id: it.id, date: it.date, at: it.at, channel: it.channel,
          title: it.title || '', body: it.body || '', lang: it.lang || '',
        }))));
      } catch (_) {}
    },
    armedGet() {
      try {
        const v = JSON.parse(localStorage.getItem(this.ARMED_KEY) || '[]');
        return Array.isArray(v) ? v : [];
      } catch (_) { return []; }
    },
  },
  reminders: {
    get() {
      const r = STATE.reminders || {};
      return {
        enabled: !!r.enabled,
        // Sound defaults ON: a reminder you cannot hear is a reminder you miss.
        // `!== false` so an older blob with no field at all still gets sound.
        sound: r.sound !== false,
        water: Object.assign({ on: false, from: '09:00', to: '21:00', everyMin: 120 }, r.water || {}),
      };
    },
    // NO SETTERS, deliberately — this namespace is READ-ONLY legacy now.
    //
    // What was here and why it is gone (v254):
    //   schedule()   the v208 alarm builder. DB.notif.scheduleForDate() replaced
    //                it at v242 and nothing has called this since; by v253 the
    //                only two mentions left in the repo were comments ABOUT it.
    //   setSound()   zero callers — the sound toggle it wrote lived in the
    //   setWater()   reminders modal, and both controls were deleted when
    //                scheduling moved to DB.notif.
    //   setEnabled() one caller, which set a flag that nothing read. The last
    //                real consumer was catchUp()'s gate, removed in v251 because
    //                the flag defaults to false and left in-app catch-up dead for
    //                every user who configured the new page.
    //
    // get() STAYS, and its full shape with it, for two live reasons:
    //   · `sound` picks which of the two IMMUTABLE OS channels a notification is
    //     posted through (js/notify.js channelId()). Nothing can change it any
    //     more — by the design rule that sound belongs to the OS, not to a second
    //     switch in the app — so it is effectively pinned to the alert channel.
    //     Kept because the two channels are real and the quiet one is one line
    //     away if that decision is ever revisited.
    //   · migrateFromReminders() reads `enabled`, `water.on/from/to/everyMin` to
    //     carry a pre-v210 user's settings into DB.notif. That runs ONCE per
    //     install, and an install that has never opened since v208 still needs
    //     it, so the fields cannot be dropped from the shape.
  },

  // ----- Cardio -----
  cardio: {
    list() {
      return [...STATE.cardio].sort((a, b) => isoDesc(a.date, b.date));
    },
    add({ type, date, duration, calories }) {
      const entry = {
        id: uid(),
        type,
        date,
        duration: Number(duration) || 0,
        calories: Number(calories) || 0,
        createdAt: new Date().toISOString(),
      };
      STATE.cardio.push(entry);
      save();
      return entry;
    },
    update(id, data) {
      const c = STATE.cardio.find((x) => x.id === id);
      if (!c) return null;
      Object.assign(c, {
        type: data.type ?? c.type,
        date: data.date ?? c.date,
        duration: data.duration != null ? Number(data.duration) : c.duration,
        calories: data.calories != null ? Number(data.calories) : c.calories,
      });
      save();
      return c;
    },
    remove(id) {
      STATE.cardio = STATE.cardio.filter((c) => c.id !== id);
      save();
    },
    // Import cardio exercise sessions read from Health Connect. The plugin maps
    // each session's exercise type to one of our cardio type ids. Deduped by the
    // session start time; manual entries are untouched.
    importFromHealth(sessions) {
      if (!Array.isArray(sessions) || !sessions.length) return 0;
      const pad = (n) => String(n).padStart(2, '0');
      const seen = new Set(STATE.cardio.map((c) => c.hcKey).filter(Boolean));
      let added = 0;
      sessions.forEach((s) => {
        if (!s || !s.start || !s.type || seen.has(s.start)) return;
        const end = new Date(s.end || s.start);
        if (isNaN(end.getTime())) return;
        const date = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
        STATE.cardio.push({
          id: uid(),
          type: s.type,
          date,
          duration: Number(s.minutes) || 0,
          calories: Number(s.calories) || 0,
          source: 'health',
          hcKey: s.start,
          createdAt: new Date().toISOString(),
        });
        seen.add(s.start);
        added++;
      });
      if (added) save();
      return added;
    },
  },

  // ----- Custom cardio types -----
  // Built-in types live in CARDIO_TYPES (treadmill / walking / running / cycling).
  // Users can add their own via this API; everything is merged in `allTypes()`.
  cardioTypes: {
    list() {
      return [...STATE.cardioTypes];
    },
    allTypes() {
      // Built-ins first, then user-defined
      return [...CARDIO_TYPES, ...STATE.cardioTypes];
    },
    findById(id) {
      return CARDIO_TYPES.find((t) => t.id === id) || STATE.cardioTypes.find((t) => t.id === id) || null;
    },
    add({ label, iconName }) {
      const trimmed = (label || '').trim();
      if (!trimmed) return null;
      const entry = {
        id: 'custom-' + uid(),
        label: trimmed,
        iconName: iconName || 'heart',
        isCustom: true,
        createdAt: new Date().toISOString(),
      };
      STATE.cardioTypes.push(entry);
      save();
      return entry;
    },
    remove(id) {
      STATE.cardioTypes = STATE.cardioTypes.filter((t) => t.id !== id);
      save();
    },
  },

  // ----- Foods (reference list only) -----
  foods: {
    list() {
      return [...STATE.foods].sort((a, b) => a.name.localeCompare(b.name));
    },
    add({ name, serving, calories, protein, carbs, fat }) {
      const food = {
        id: uid(),
        name: name.trim(),
        serving: (serving || '').trim(),
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        createdAt: new Date().toISOString(),
      };
      STATE.foods.push(food);
      save();
      return food;
    },
    update(id, data) {
      const f = STATE.foods.find((x) => x.id === id);
      if (!f) return null;
      Object.assign(f, {
        name: data.name?.trim() ?? f.name,
        serving: data.serving?.trim() ?? f.serving,
        calories: data.calories != null ? Number(data.calories) : f.calories,
        protein: data.protein != null ? Number(data.protein) : f.protein,
        carbs: data.carbs != null ? Number(data.carbs) : f.carbs,
        fat: data.fat != null ? Number(data.fat) : (f.fat || 0),
      });
      save();
      return f;
    },
    remove(id) {
      STATE.foods = STATE.foods.filter((f) => f.id !== id);
      save();
    },
  },

  // ----- Sleep -----
  sleep: {
    list() {
      return [...STATE.sleep].sort((a, b) => isoDesc(a.date, b.date));
    },
    latest() {
      return this.list()[0] || null;
    },
    add({ date, sleepTime, wakeTime }) {
      const duration = computeSleepMinutes(sleepTime, wakeTime);
      const entry = {
        id: uid(),
        date,
        sleepTime,
        wakeTime,
        durationMinutes: duration,
        createdAt: new Date().toISOString(),
      };
      STATE.sleep.push(entry);
      save();
      return entry;
    },
    update(id, { date, sleepTime, wakeTime }) {
      const s = STATE.sleep.find((x) => x.id === id);
      if (!s) return null;
      if (date) s.date = date;
      if (sleepTime) s.sleepTime = sleepTime;
      if (wakeTime) s.wakeTime = wakeTime;
      s.durationMinutes = computeSleepMinutes(s.sleepTime, s.wakeTime);
      save();
      return s;
    },
    remove(id) {
      STATE.sleep = STATE.sleep.filter((s) => s.id !== id);
      save();
    },
    // Import sleep sessions read from Health Connect into the log. Deduped by
    // the session start time (hcKey) so re-syncing never creates duplicates.
    // Manual entries are left untouched. Returns how many were newly added.
    importFromHealth(sessions) {
      if (!Array.isArray(sessions) || !sessions.length) return 0;
      const pad = (n) => String(n).padStart(2, '0');
      const byKey = {};
      STATE.sleep.forEach((s) => { if (s.hcKey) byKey[s.hcKey] = s; });
      let added = 0, changed = false;
      sessions.forEach((s) => {
        if (!s || !s.start || !s.end) return;
        const existing = byKey[s.start];
        if (existing) {
          // Already imported — but backfill sleep stages onto it if this newer
          // read carries them (e.g. after the stages-capable app build).
          if (s.stages && !existing.stages) { existing.stages = s.stages; changed = true; }
          return;
        }
        const start = new Date(s.start);
        const end = new Date(s.end);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
        const date = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
        STATE.sleep.push({
          id: uid(),
          date,
          sleepTime: pad(start.getHours()) + ':' + pad(start.getMinutes()),
          wakeTime: pad(end.getHours()) + ':' + pad(end.getMinutes()),
          durationMinutes: s.minutes != null ? s.minutes : Math.round((end - start) / 60000),
          stages: s.stages || null,   // { deep, light, rem, awake } minutes, or null
          source: 'health',
          hcKey: s.start,
          createdAt: new Date().toISOString(),
        });
        byKey[s.start] = true;
        added++;
      });
      if (added || changed) save();
      return added;
    },
  },
};

// Re-read STATE from localStorage (after cloud sync swaps in pulled data).
DB.reload = reloadState;

// ==========================================================================
// Helpers exposed for the UI layer
// ==========================================================================

function computeSleepMinutes(sleepTime, wakeTime) {
  // sleepTime / wakeTime are "HH:MM"; assume wake is after sleep (cross midnight ok)
  if (!sleepTime || !wakeTime) return 0;
  const [sh, sm] = sleepTime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let start = sh * 60 + sm;
  let end = wh * 60 + wm;
  if (end <= start) end += 24 * 60;
  return end - start;
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Add (or subtract) whole days to a 'YYYY-MM-DD' string and return the result in
// the SAME calendar (local) — never via toISOString(), whose UTC conversion rolls
// a local-midnight date back a day in any timezone east of UTC (e.g. UTC+3),
// which made the day steppers skip/stick.
function addDaysISO(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Localise dates to the UI language. 'ar-u-nu-latn' gives Arabic month names
// with LATIN digits, matching the app's number convention (fmtNum) and the
// home screen. Falls back to en-US.
function dateLocale() {
  try { return (STATE && STATE.prefs && STATE.prefs.lang === 'ar') ? 'ar-u-nu-latn' : 'en-US'; }
  catch (_) { return 'en-US'; }
}
// toLocaleDateString rebuilds the whole Intl.DateTimeFormat machinery on every
// call — measured at ~55µs against ~3.5µs for a reused formatter's .format(),
// and these two run once per row on screens that render hundreds of rows (an
// exercise's full history, the sleep log). Cached by locale so switching the UI
// language still switches the month names; two entries is the whole cache.
const DATE_FMT = { long: {}, short: {} };
function dateFmt(kind) {
  const loc = dateLocale();
  let f = DATE_FMT[kind][loc];
  if (!f) {
    const opts = kind === 'long'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric' };
    try { f = new Intl.DateTimeFormat(loc, opts); }
    catch (_) { f = new Intl.DateTimeFormat('en-US', opts); }
    DATE_FMT[kind][loc] = f;
  }
  return f;
}
function formatDate(iso) {
  if (!iso) return '';
  return dateFmt('long').format(new Date(iso + 'T00:00:00'));
}

function formatDateShort(iso) {
  if (!iso) return '';
  return dateFmt('short').format(new Date(iso + 'T00:00:00'));
}

function daysAgo(iso) {
  if (!iso) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return diff + ' days ago';
  if (diff < 30) return Math.floor(diff / 7) + ' weeks ago';
  return Math.floor(diff / 30) + ' months ago';
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start of week
  d.setDate(d.getDate() - diff);
  return d;
}

function inRangeISO(iso, start, end) {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  return d >= start && d < end;
}

// Localised hour/minute abbreviations. Arabic: س = ساعة, د = دقيقة. English: h/m.
// (Slicing a translated word like "الدقائق" to 3 chars produced garbage "الد",
//  so durations use these fixed abbreviations instead.)
function durUnits() {
  const ar = !!(STATE && STATE.prefs && STATE.prefs.lang === 'ar');
  return ar ? { h: 'س', m: 'د' } : { h: 'h', m: 'm' };
}
function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const u = durUnits();
  if (h === 0) return m + u.m;
  if (m === 0) return h + u.h;
  return h + u.h + ' ' + m + u.m;
}

function formatTime12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

// Expose helpers on window for app.js
window.DB = DB;
window.EXERCISE_CATEGORIES = EXERCISE_CATEGORIES;
window.CARDIO_TYPES = CARDIO_TYPES;
window.CARDIO_ICON_OPTIONS = CARDIO_ICON_OPTIONS;
window.todayISO = todayISO;
window.addDaysISO = addDaysISO;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.daysAgo = daysAgo;
window.startOfWeek = startOfWeek;
window.inRangeISO = inRangeISO;
window.formatDuration = formatDuration;
window.formatTime12 = formatTime12;
window.uid = uid;
window.exerciseImageUrl = exerciseImageUrl;
window.machineImageUrl = machineImageUrl;
window.machineSvgFor = machineSvgFor;
