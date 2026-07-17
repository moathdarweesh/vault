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

const EXERCISE_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

function exerciseImageUrl(imageSlug) {
  if (!imageSlug) return '';
  return `${EXERCISE_IMAGE_BASE}/${imageSlug}/0.jpg`;
}

// ==========================================================================
// Machine illustrations — clean SVG silhouettes of gym machines (no people)
// Used for exercises whose `machineType` field is set. Returns a data URI
// that can be used as a CSS background-image.
// ==========================================================================
const MACHINE_SVG_BG = '#0c2733';
const MACHINE_SVG_STROKE = '#2dd4bf';

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
  { name: 'Assisted Pull-Up Machine',     category: 'Back',      machineType: 'assisted_pullup',     imageSlug: 'Machine_Assisted_Chin-Up' },
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


function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      lang: 'en',
      theme: 'dark',
      unit: 'kg',
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
    plan: { mode: 'rotation', cycle: [], trainingDays: [], anchor: null },
    supplements: [],
    supplementLogs: {},
    foodLogs: {},
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
function trainingDaysBetween(anchorStr, D, trainingDays) {
  const a = new Date(anchorStr + 'T00:00:00');
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d0 = new Date(D.getFullYear(), D.getMonth(), D.getDate());
  if (d0 <= a0) return 0;
  let count = 0;
  const cur = new Date(a0);
  let guard = 0;
  while (cur < d0 && guard++ < 4000) {
    if (trainingDays.indexOf(cur.getDay()) !== -1) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

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
  return { mode: 'rotation', cycle, trainingDays, anchor: todayISO() };
}

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
    parsed.supplementLogs = parsed.supplementLogs || {};
    parsed.foodLogs = parsed.foodLogs || {};
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch (err) {
    console.warn('Failed to load state, resetting', err);
    const fresh = defaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

let STATE = loadState();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  // Notify the cloud-sync layer (if present + logged in) to push the change.
  if (typeof window !== 'undefined' && window.Cloud && window.Cloud.onLocalChange) {
    window.Cloud.onLocalChange();
  }
}

// Re-read the whole state from localStorage. Used after cloud sync replaces the
// stored blob, so the in-memory STATE reflects the freshly pulled data.
function reloadState() {
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
    setLang(lang) { STATE.prefs.lang = lang; save(); },
    setTheme(theme) { STATE.prefs.theme = theme; save(); },
    setUnit(unit) { STATE.prefs.unit = unit === 'lb' ? 'lb' : 'kg'; save(); },
  },

  // ----- Workout plan — CONTINUOUS ROTATION -----
  // STATE.plan = { mode:'rotation', cycle:[{name,exerciseIds}], trainingDays:[dow], anchor:'YYYY-MM-DD' }.
  // The workout for a date = cycle[(training days elapsed since anchor) mod cycle.length];
  // rest days (weekday ∉ trainingDays) have no workout. The cycle rolls across weeks — never reset.
  plan: {
    get() { return STATE.plan || { mode: 'rotation', cycle: [], trainingDays: [], anchor: null }; },

    // THE single source of truth: what workout (or null=rest) falls on date D.
    workoutForDate(D) {
      const p = STATE.plan;
      if (!p || p.mode !== 'rotation' || !Array.isArray(p.cycle) || !p.cycle.length) return null;
      const td = Array.isArray(p.trainingDays) ? p.trainingDays : [];
      if (td.indexOf(D.getDay()) === -1) return null;              // rest day
      const anchor = p.anchor || todayISO();
      const a = new Date(anchor + 'T00:00:00');
      const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      const d0 = new Date(D.getFullYear(), D.getMonth(), D.getDate());
      if (d0 < a0) return null;                                    // before the plan started
      const elapsed = trainingDaysBetween(anchor, D, td);
      const len = p.cycle.length;
      return p.cycle[((elapsed % len) + len) % len];
    },

    // Replace the whole rotation (used by the schedule modal on template adopt).
    setRotation({ cycle, trainingDays, anchor }) {
      STATE.plan = {
        mode: 'rotation',
        cycle: (cycle || []).map((s) => ({ name: (s && s.name) || 'Workout', exerciseIds: Array.isArray(s && s.exerciseIds) ? s.exerciseIds.slice() : [] })),
        trainingDays: (trainingDays || []).slice().sort((a, b) => a - b),
        anchor: anchor || todayISO(),
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
      STATE.plan = { mode: 'rotation', cycle: [], trainingDays: [], anchor: todayISO() };
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
      h.data = data;
      h.syncedAt = Date.now();
      if (!Array.isArray(h.hidden)) h.hidden = [];
      STATE.health = h;
      save();
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
    add({ name, dose, color }) {
      const item = {
        id: uid(),
        name: name.trim(),
        dose: (dose || '').trim(),
        color: color || '#22d3ee',
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
      save();
      return s;
    },
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
      // Consecutive days ending today (or yesterday if not taken yet today)
      let count = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString().slice(0, 10);
      const start = new Date(today);
      if (!this.isTaken(supplementId, todayIso)) start.setDate(start.getDate() - 1);
      while (true) {
        const iso = start.toISOString().slice(0, 10);
        if (this.isTaken(supplementId, iso)) {
          count += 1;
          start.setDate(start.getDate() - 1);
        } else break;
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
        .sort((a, b) => (b.count - a.count) || (b.last || '').localeCompare(a.last || ''))
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
  importJSON(json) {
    try {
      const data = JSON.parse(json);
      if (!this._validateBlob(data)) return false;
      STATE = data;
      save();
      return true;
    } catch (e) {
      return false;
    }
  },
  resetAll() {
    STATE = defaultState();
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
      if (added) save();
      return added;
    },
  },

  // ----- Sessions (workout sets logged per exercise) -----
  sessions: {
    listByExercise(exerciseId) {
      return STATE.sessions
        .filter((s) => s.exerciseId === exerciseId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    },
    listAll() {
      return [...STATE.sessions].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
      );
    },
    lastForExercise(exerciseId, excludeId = null) {
      const list = this.listByExercise(exerciseId).filter((s) => s.id !== excludeId);
      return list[0] || null;
    },
    get(id) {
      return STATE.sessions.find((s) => s.id === id) || null;
    },
    add({ exerciseId, date, sets }) {
      const session = {
        id: uid(),
        exerciseId,
        date,
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
  },

  // ----- Cardio -----
  cardio: {
    list() {
      return [...STATE.cardio].sort((a, b) => b.date.localeCompare(a.date));
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
      return [...STATE.sleep].sort((a, b) => b.date.localeCompare(a.date));
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

// Localise dates to the UI language. 'ar-u-nu-latn' gives Arabic month names
// with LATIN digits, matching the app's number convention (fmtNum) and the
// home screen. Falls back to en-US.
function dateLocale() {
  try { return (STATE && STATE.prefs && STATE.prefs.lang === 'ar') ? 'ar-u-nu-latn' : 'en-US'; }
  catch (_) { return 'en-US'; }
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric' });
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

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + 'm';
  if (m === 0) return h + 'h';
  return h + 'h ' + m + 'm';
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
