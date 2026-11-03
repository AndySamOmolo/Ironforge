import type { Exercise, WorkoutDayExercise, ActiveExercise, WorkoutDay } from '@/lib/types';
import { getWorkoutStartingWeight } from './workoutDefaults';
import { getPrimaryExerciseImage, getExerciseImageFrames, getExerciseGifUrl, hasGifExerciseMedia } from './exerciseMedia';

export const ALL_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'body weight',
  'machine',
  'leverage machine',
  'smith machine',
  'band',
  'kettlebell',
  'ez barbell',
  'olympic barbell',
  'trap bar',
  'medicine ball',
  'stability ball',
  'bosu ball',
  'foam roll',
] as const;

export const EQUIPMENT_PRESETS: { id: string; label: string; icon: string; items: string[] }[] = [
  {
    id: 'full-gym',
    label: 'Full Gym',
    icon: '🏋️',
    items: [...ALL_EQUIPMENT],
  },
  {
    id: 'free-weights',
    label: 'Barbell + DB',
    icon: '💪',
    items: ['barbell', 'dumbbell', 'ez barbell', 'body weight', 'band'],
  },
  {
    id: 'dumbbells-only',
    label: 'Dumbbells + Body',
    icon: '🔩',
    items: ['dumbbell', 'body weight'],
  },
  {
    id: 'home-bands',
    label: 'Home (DB + Bands + KB)',
    icon: '🏠',
    items: ['dumbbell', 'band', 'kettlebell', 'body weight', 'stability ball', 'foam roll'],
  },
  {
    id: 'bodyweight',
    label: 'Bodyweight Only',
    icon: '🤸',
    items: ['body weight'],
  },
];

const EQUIPMENT_ALIAS_MAP: Record<string, string> = {
  'body only': 'body weight',
  'bodyweight': 'body weight',
  'body weight': 'body weight',
  'none': 'body weight',
  'bands': 'band',
  'band': 'band',
  'resistance band': 'band',
  'kettlebells': 'kettlebell',
  'kettlebell': 'kettlebell',
  'e-z curl bar': 'ez barbell',
  'ez barbell': 'ez barbell',
  'ez bar': 'ez barbell',
  'ez-bar': 'ez barbell',
  'exercise ball': 'stability ball',
  'stability ball': 'stability ball',
  'swiss ball': 'stability ball',
  'physioball': 'stability ball',
  'roller': 'foam roll',
  'wheel roller': 'foam roll',
  'foam roll': 'foam roll',
  'sled machine': 'machine',
  'stepmill machine': 'machine',
  'skierg machine': 'machine',
  'elliptical machine': 'machine',
  'stationary bike': 'machine',
  'upper body ergometer': 'machine',
  'machine': 'machine',
  'leverage machine': 'leverage machine',
  'smith machine': 'smith machine',
  'barbell': 'barbell',
  'olympic barbell': 'olympic barbell',
  'trap bar': 'trap bar',
  'dumbbell': 'dumbbell',
  'cable': 'cable',
  'medicine ball': 'medicine ball',
  'bosu ball': 'bosu ball',
  'assisted': 'body weight',
  'weighted': 'body weight',
};

export function normalizeEquipmentName(raw?: string | null): string {
  if (!raw) return 'body weight';
  const cleaned = raw.trim().toLowerCase();
  return EQUIPMENT_ALIAS_MAP[cleaned] || cleaned;
}

export function normalizeEquipmentList(equipmentList: string[]): string[] {
  const set = new Set<string>();
  for (const item of equipmentList || []) {
    const norm = normalizeEquipmentName(item);
    if (norm) set.add(norm);
  }
  return Array.from(set);
}

/**
 * Inspects both the exercise's equipment field AND its name to detect all required equipment.
 * Prevents mislabeled database entries (e.g. cable exercises labeled as body weight) from leaking through.
 */
export function getExerciseRequiredEquipment(
  exercise: Pick<Exercise, 'equipment' | 'name'> & { equipments?: string[] }
): string[] {
  const name = (exercise.name || '').toLowerCase();
  const rawList = Array.isArray(exercise.equipments) && exercise.equipments.length > 0
    ? exercise.equipments
    : [exercise.equipment || 'body weight'];

  const required = new Set<string>();
  for (const raw of rawList) {
    required.add(normalizeEquipmentName(raw));
  }

  // Name-level strict equipment guards
  if (/\bcable\b/.test(name)) {
    required.delete('body weight');
    required.add('cable');
  }
  if (/\bsmith\b/.test(name)) {
    required.delete('machine');
    required.delete('barbell');
    required.add('smith machine');
  }
  if (/\blever\b/.test(name) && !name.includes('front lever') && !name.includes('back lever')) {
    required.delete('barbell');
    required.delete('body weight');
    required.add('leverage machine');
  }
  if (/\b(?:ez-bar|ez bar|e-z curl bar)\b/.test(name)) {
    required.delete('barbell');
    required.add('ez barbell');
  } else if (/\bbarbell\b/.test(name)) {
    required.add('barbell');
  }
  if (/\bdumbbell\b/.test(name) && !name.includes('off of a dumbbell')) {
    required.add('dumbbell');
  }
  if (/\bkettlebell\b/.test(name)) {
    required.add('kettlebell');
  }
  if (/\b(?:band|bands|banded)\b/.test(name) && !name.includes('it band')) {
    required.add('band');
  }
  if (/\bmedicine ball\b/.test(name)) {
    required.add('medicine ball');
  }
  if (/\b(?:stability|exercise|swiss|physio)\s*ball\b/.test(name)) {
    required.add('stability ball');
  }
  if (/\bbosu\b/.test(name)) {
    required.add('bosu ball');
  }
  if (/\b(?:trx|suspended)\b/.test(name)) {
    required.delete('body weight');
    required.add('other');
  }

  if (required.size > 1 && required.has('body weight')) {
    required.delete('body weight');
  }

  return Array.from(required);
}

/**
 * Strictly checks whether an exercise can be performed with the user's selected equipment.
 */
export function matchesUserEquipment(
  exercise: Pick<Exercise, 'equipment' | 'name'> & { equipments?: string[] },
  userEquipment: string[]
): boolean {
  if (!userEquipment || userEquipment.length === 0) {
    return true;
  }
  const allowedSet = new Set(normalizeEquipmentList(userEquipment));
  const required = getExerciseRequiredEquipment(exercise);
  return required.every((req) => allowedSet.has(req));
}

// Canonical muscle groups to unify ExerciseDB and Free-Exercise-DB naming
const MUSCLE_SYNONYM_GROUPS: Record<string, string[]> = {
  chest: ['chest', 'pectorals', 'serratus anterior', 'serratus'],
  back: ['back', 'lats', 'upper back', 'middle back', 'traps'],
  lats: ['lats', 'back', 'upper back', 'middle back'],
  'upper back': ['upper back', 'middle back', 'back', 'traps', 'lats'],
  'lower back': ['lower back', 'spine'],
  shoulders: ['shoulders', 'delts', 'deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  quads: ['quads', 'quadriceps'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes', 'abductors', 'adductors'],
  calves: ['calves'],
  abs: ['abs', 'abdominals', 'obliques', 'core', 'waist'],
  traps: ['traps', 'upper back', 'neck'],
  cardio: ['cardio', 'cardiovascular system'],
  neck: ['neck', 'levator scapulae', 'traps'],
};

export function getCanonicalMuscleGroup(muscle: string): string {
  const m = (muscle || '').trim().toLowerCase();
  for (const [canon, synonyms] of Object.entries(MUSCLE_SYNONYM_GROUPS)) {
    if (canon === m || synonyms[0] === m) return canon;
  }
  if (m === 'pectorals' || m === 'serratus anterior') return 'chest';
  if (m === 'delts' || m === 'deltoids') return 'shoulders';
  if (m === 'quadriceps') return 'quads';
  if (m === 'abdominals' || m === 'waist') return 'abs';
  if (m === 'middle back') return 'upper back';
  if (m === 'spine') return 'lower back';
  if (m === 'cardiovascular system') return 'cardio';
  return m;
}

export function getExpandedMuscles(muscles: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of muscles || []) {
    const m = raw.trim().toLowerCase();
    out.add(m);
    const canon = getCanonicalMuscleGroup(m);
    out.add(canon);
    const group = MUSCLE_SYNONYM_GROUPS[canon] || MUSCLE_SYNONYM_GROUPS[m];
    if (group) {
      for (const s of group) out.add(s);
    }
  }
  return out;
}

export function sharesTargetMuscle(exMuscles: string[], targetMuscles: string[]): boolean {
  const expandedTargets = getExpandedMuscles(targetMuscles);
  return (exMuscles || []).some((m) => expandedTargets.has(m.trim().toLowerCase()));
}

interface MovementProfile {
  muscles: string[];
  keywords: string[];
  preferredNames: string[];
  avoidKeywords?: string[];
  isStretch?: boolean;
}

const MOVEMENT_PROFILES: Record<string, MovementProfile> = {
  'barbell bench press': {
    muscles: ['chest', 'pectorals'],
    keywords: ['bench press', 'chest press', 'floor press', 'push-up', 'push up'],
    preferredNames: [
      'barbell bench press',
      'barbell wide bench press',
      'barbell guillotine bench press',
      'Barbell Bench Press - Medium Grip',
      'dumbbell bench press',
      'smith bench press',
      'lever chest press',
      'push-up',
    ],
    avoidKeywords: ['sit-up', 'crunch', 'skull', 'preacher', 'calf'],
  },
  'dumbbell bench press': {
    muscles: ['chest', 'pectorals'],
    keywords: ['dumbbell bench press', 'bench press', 'floor press', 'chest press', 'push-up'],
    preferredNames: [
      'dumbbell bench press',
      'Dumbbell Bench Press',
      'dumbbell neutral grip bench press',
      'dumbbell around pullover',
      'dumbbell fly',
      'barbell bench press',
      'push-up',
      'deep push-up',
    ],
    avoidKeywords: ['sit-up', 'crunch', 'curl'],
  },
  'incline dumbbell press': {
    muscles: ['chest', 'pectorals'],
    keywords: ['incline bench press', 'incline dumbbell press', 'incline press', 'incline push-up', 'incline fly'],
    preferredNames: [
      'dumbbell incline bench press',
      'dumbbell incline hammer press',
      'Incline Dumbbell Press',
      'barbell incline bench press',
      'incline push-up',
      'dumbbell incline fly',
      'smith incline bench press',
      'lever incline chest press',
    ],
    avoidKeywords: ['curl', 'row', 'shrug', 'sit-up'],
  },
  'incline push-up': {
    muscles: ['chest', 'pectorals', 'triceps'],
    keywords: ['incline push-up', 'incline push up', 'push-up'],
    preferredNames: [
      'incline push-up',
      'incline close-grip push-up',
      'push-up',
      'wide hand push up',
    ],
    avoidKeywords: ['suspended', 'trx'],
  },
  'cable fly': {
    muscles: ['chest', 'pectorals'],
    keywords: ['fly', 'flye', 'crossover', 'pullover', 'around the worlds', 'pec', 'push-up'],
    preferredNames: [
      'cable middle fly',
      'cable incline fly',
      'cable low fly',
      'dumbbell fly',
      'dumbbell incline fly',
      'dumbbell decline fly',
      'Dumbbell Flyes',
      'lever seated fly',
      'push-up',
      'wide hand push up',
    ],
    avoidKeywords: ['curl', 'reverse fly', 'rear delt', 'row', 'crunch'],
  },
  'cable crossover': {
    muscles: ['chest', 'pectorals'],
    keywords: ['crossover', 'cross over', 'fly', 'flye', 'decline', 'pullover', 'push-up'],
    preferredNames: [
      'cable standing up straight crossovers',
      'cable upper chest crossovers',
      'Cable Crossover',
      'dumbbell decline fly',
      'dumbbell incline fly',
      'dumbbell pullover',
      'clock push-up',
      'decline push-up',
    ],
    avoidKeywords: ['curl', 'reverse', 'row', 'crunch'],
  },
  'overhead press': {
    muscles: ['shoulders', 'delts'],
    keywords: ['overhead press', 'shoulder press', 'military press', 'standing press', 'push press', 'pike push'],
    preferredNames: [
      'barbell seated overhead press',
      'barbell standing close grip military press',
      'dumbbell standing overhead press',
      'dumbbell seated shoulder press',
      'Standing Military Press',
      'Seated Barbell Military Press',
      'Dumbbell Shoulder Press',
      'kettlebell seated press',
      'pike-to-cobra push-up',
    ],
    avoidKeywords: ['chest', 'bench', 'calf', 'crunch', 'squat'],
  },
  'dumbbell shoulder press': {
    muscles: ['shoulders', 'delts'],
    keywords: ['dumbbell shoulder press', 'shoulder press', 'seated press', 'arnold press', 'overhead press'],
    preferredNames: [
      'dumbbell seated shoulder press',
      'dumbbell standing overhead press',
      'dumbbell one arm shoulder press',
      'Dumbbell Shoulder Press',
      'dumbbell arnold press',
      'barbell seated overhead press',
      'pike-to-cobra push-up',
    ],
    avoidKeywords: ['chest', 'bench', 'shrug', 'curl'],
  },
  'arnold press': {
    muscles: ['shoulders', 'delts'],
    keywords: ['arnold', 'shoulder press', 'dumbbell press', 'overhead press', 'deltoid'],
    preferredNames: [
      'dumbbell arnold press',
      'Arnold Dumbbell Press',
      'dumbbell seated shoulder press',
      'Dumbbell Shoulder Press',
      'barbell upright row',
      'handstand push-up',
    ],
    avoidKeywords: ['chest', 'bench', 'leg', 'crunch'],
  },
  'pike push up': {
    muscles: ['shoulders', 'delts', 'triceps'],
    keywords: ['pike', 'handstand', 'shoulder', 'push-up'],
    preferredNames: [
      'pike-to-cobra push-up',
      'exercise ball pike push up',
      'decline push-up',
      'incline push-up',
    ],
    avoidKeywords: ['crunch', 'leg'],
  },
  'lateral raise': {
    muscles: ['shoulders', 'delts'],
    keywords: ['lateral raise', 'side lateral', 'deltoid raise', 'raise'],
    preferredNames: [
      'dumbbell lateral raise',
      'dumbbell seated lateral raise',
      'cable lateral raise',
      'Side Lateral Raise',
      'Alternating Deltoid Raise',
      'barbell upright row',
      'band lateral raise',
    ],
    avoidKeywords: ['leg', 'calf', 'hanging', 'hip', 'crunch'],
  },
  'front raise': {
    muscles: ['shoulders', 'delts'],
    keywords: ['front raise', 'anterior', 'deltoid raise', 'shoulder raise'],
    preferredNames: [
      'dumbbell front raise',
      'barbell front raise',
      'cable front raise',
      'Front Dumbbell Raise',
      'Alternating Deltoid Raise',
      'Front Plate Raise',
      'band front raise',
    ],
    avoidKeywords: ['leg', 'calf', 'hanging', 'crunch'],
  },
  'face pull': {
    muscles: ['shoulders', 'delts', 'upper back'],
    keywords: ['face pull', 'rear delt', 'reverse fly', 'band pull apart', 'external rotation'],
    preferredNames: [
      'cable rear delt row (with rope)',
      'cable kneeling rear delt row (with rope) (male)',
      'dumbbell rear delt row_shoulder',
      'dumbbell seated bent-over rear delt raise',
      'barbell rear delt row',
      'band standing rear delt row',
      'Face Pull',
      'inverted row',
    ],
    avoidKeywords: ['chest', 'leg', 'squat', 'crunch'],
  },
  'reverse fly': {
    muscles: ['shoulders', 'delts', 'upper back'],
    keywords: ['reverse fly', 'rear delt', 'bent-over rear', 'posterior'],
    preferredNames: [
      'dumbbell rear fly',
      'dumbbell lying rear lateral raise',
      'dumbbell rotation reverse fly',
      'cable rear delt row (with rope)',
      'cable supine reverse fly',
      'barbell rear delt row',
      'Seated Bent-Over Rear Delt Raise',
      'inverted row with straps',
    ],
    avoidKeywords: ['chest', 'pectoral', 'leg', 'crunch'],
  },
  'tricep pushdown': {
    muscles: ['triceps'],
    keywords: ['pushdown', 'triceps pushdown', 'triceps extension', 'kickback', 'close-grip', 'dip'],
    preferredNames: [
      'cable pushdown',
      'cable pushdown (with rope attachment)',
      'cable triceps pushdown (v-bar)',
      'Triceps Pushdown',
      'dumbbell kickback',
      'barbell close-grip bench press',
      'close-grip push-up',
      'bench dip on floor',
      'band side triceps extension',
    ],
    avoidKeywords: ['biceps', 'leg', 'calf', 'lat'],
  },
  'overhead tricep extension': {
    muscles: ['triceps'],
    keywords: ['overhead triceps', 'triceps extension', 'french press', 'seated triceps', 'lying triceps'],
    preferredNames: [
      'dumbbell seated triceps extension',
      'dumbbell standing triceps extension',
      'barbell seated overhead triceps extension',
      'cable overhead triceps extension (rope attachment)',
      'ez barbell seated triceps extension',
      'Standing Dumbbell Triceps Extension',
      'bodyweight kneeling triceps extension',
    ],
    avoidKeywords: ['biceps', 'leg', 'back', 'hip'],
  },
  'skull crusher': {
    muscles: ['triceps'],
    keywords: ['skull', 'lying triceps', 'decline triceps', 'close-grip', 'triceps press'],
    preferredNames: [
      'barbell lying triceps extension skull crusher',
      'barbell decline close grip to skull press',
      'dumbbell lying triceps extension',
      'EZ-Bar Skullcrusher',
      'Lying Triceps Press',
      'Band Skull Crusher',
      'diamond push-up',
    ],
    avoidKeywords: ['biceps', 'leg', 'crunch'],
  },
  'dips': {
    muscles: ['triceps', 'chest', 'pectorals'],
    keywords: ['dip', 'tricep dip', 'chest dip', 'bench dip', 'close-grip'],
    preferredNames: [
      'triceps dip',
      'chest dip',
      'bench dip on floor',
      'three bench dip',
      'Bench Dips',
      'close-grip push-up',
      'dumbbell decline bench press',
    ],
    avoidKeywords: ['neck', 'leg', 'hip'],
  },
  'barbell row': {
    muscles: ['upper back', 'middle back', 'lats', 'back'],
    keywords: ['bent over row', 'barbell row', 'pendlay row', 'incline bench row', 'row'],
    preferredNames: [
      'barbell bent over row',
      'barbell reverse grip bent over row',
      'barbell incline row',
      'barbell pendlay row',
      'Bent Over Barbell Row',
      'dumbbell bent over row',
      'inverted row',
    ],
    avoidKeywords: ['sit-up', 'crunch', 'press', 'curl', 'calf'],
  },
  'dumbbell row': {
    muscles: ['upper back', 'middle back', 'lats', 'back'],
    keywords: ['one-arm dumbbell row', 'dumbbell row', 'bent over row', 'row'],
    preferredNames: [
      'dumbbell bent over row',
      'dumbbell one arm bent-over row',
      'dumbbell incline row',
      'dumbbell palm rotational bent over row',
      'One-Arm Dumbbell Row',
      'Bent Over Two-Dumbbell Row',
      'barbell bent over row',
      'inverted row',
    ],
    avoidKeywords: ['side bend', 'sit-up', 'crunch', 'press', 'curl'],
  },
  'dumbbell pullover': {
    muscles: ['lats', 'chest', 'pectorals', 'back'],
    keywords: ['pullover', 'dumbbell pullover', 'straight arm'],
    preferredNames: [
      'dumbbell pullover',
      'dumbbell around pullover',
      'barbell pullover',
      'cable straight arm pulldown',
      'pull-up',
    ],
    avoidKeywords: ['crunch', 'leg'],
  },
  'inverted row': {
    muscles: ['upper back', 'middle back', 'lats', 'back'],
    keywords: ['inverted row', 'bodyweight row', 'row'],
    preferredNames: [
      'inverted row',
      'inverted row bent knees',
      'inverted row on bench',
      'inverted row v. 2',
      'pull-up',
    ],
    avoidKeywords: ['crunch', 'press'],
  },
  'seated cable row': {
    muscles: ['upper back', 'middle back', 'lats', 'back'],
    keywords: ['seated row', 'cable row', 'bent over row', 'row', 'inverted row'],
    preferredNames: [
      'cable seated row',
      'cable low seated row',
      'Seated Cable Rows',
      'dumbbell bent over row',
      'barbell bent over row',
      'lever seated row',
      'inverted row',
    ],
    avoidKeywords: ['crunch', 'sit-up', 'neck', 'press', 'squat'],
  },
  'lat pulldown': {
    muscles: ['lats', 'back'],
    keywords: ['pulldown', 'pull-up', 'pull up', 'chin-up', 'pullover'],
    preferredNames: [
      'cable pulldown',
      'cable pulldown (pro lat bar)',
      'cable wide grip lat pulldown behind neck',
      'lever front pulldown',
      'Wide-Grip Lat Pulldown',
      'pull-up',
      'dumbbell pullover',
      'barbell pullover',
      'chin-up',
    ],
    avoidKeywords: ['stretch', 'wall', 'crunch', 'triceps'],
  },
  'straight arm pulldown': {
    muscles: ['lats', 'back'],
    keywords: ['straight arm pulldown', 'pullover', 'pulldown', 'lat'],
    preferredNames: [
      'cable straight arm pulldown',
      'dumbbell pullover',
      'barbell pullover',
      'Straight-Arm Pulldown',
      'Bent-Arm Dumbbell Pullover',
      'Bent-Arm Barbell Pullover',
      'pull-up',
    ],
    avoidKeywords: ['stretch', 'wall', 'crunch'],
  },
  'pull up': {
    muscles: ['lats', 'back', 'upper back'],
    keywords: ['pull-up', 'pull up', 'chin-up', 'wide grip pull'],
    preferredNames: [
      'pull-up',
      'wide grip pull-up',
      'archer pull up',
      'Pullups',
      'chin-up',
      'inverted row',
      'dumbbell pullover',
    ],
    avoidKeywords: ['stretch', 'wall', 'cable', 'squat'],
  },
  'chin up': {
    muscles: ['lats', 'biceps', 'back'],
    keywords: ['chin-up', 'chin up', 'pull-up', 'underhand'],
    preferredNames: [
      'chin-up',
      'narrow grip pull-up',
      'mixed grip chin-up',
      'Chin-Up',
      'pull-up',
      'inverted row',
    ],
    avoidKeywords: ['stretch', 'neck', 'crunch'],
  },
  'barbell curl': {
    muscles: ['biceps'],
    keywords: ['barbell curl', 'biceps curl', 'curl'],
    preferredNames: [
      'barbell curl',
      'barbell wide-grip standing biceps curl',
      'ez barbell curl',
      'dumbbell biceps curl',
      'Barbell Curl',
      'Dumbbell Bicep Curl',
      'chin-up',
    ],
    avoidKeywords: ['leg', 'hamstring', 'wrist', 'finger', 'crunch', 'sit-up'],
  },
  'hammer curl': {
    muscles: ['biceps', 'forearms'],
    keywords: ['hammer curl', 'neutral grip', 'cross body hammer', 'biceps curl'],
    preferredNames: [
      'dumbbell hammer curl',
      'dumbbell cross body hammer curl',
      'Hammer Curls',
      'Alternate Hammer Curl',
      'Cross Body Hammer Curl',
      'barbell reverse curl',
      'chin-up',
    ],
    avoidKeywords: ['sledge', 'sit-up', 'crunch', 'leg', 'finger'],
  },
  'incline curl': {
    muscles: ['biceps'],
    keywords: ['incline biceps curl', 'incline dumbbell curl', 'incline curl', 'biceps curl'],
    preferredNames: [
      'dumbbell incline biceps curl',
      'dumbbell incline hammer curls',
      'Incline Dumbbell Curl',
      'Alternate Incline Dumbbell Curl',
      'dumbbell standing biceps curl',
      'barbell drag curl',
      'chin-up',
    ],
    avoidKeywords: ['finger', 'wrist', 'leg', 'hamstring', 'bench press'],
  },
  'preacher curl': {
    muscles: ['biceps'],
    keywords: ['preacher curl', 'concentration curl', 'spider curl', 'biceps curl'],
    preferredNames: [
      'barbell preacher curl',
      'dumbbell preacher curl',
      'ez barbell spider curl',
      'Preacher Curl',
      'One Arm Dumbbell Preacher Curl',
      'dumbbell concentration curl',
      'barbell close-grip standing curl',
    ],
    avoidKeywords: ['finger', 'wrist', 'leg', 'crunch'],
  },
  'concentration curl': {
    muscles: ['biceps'],
    keywords: ['concentration curl', 'biceps curl', 'waiter curl', 'preacher curl'],
    preferredNames: [
      'dumbbell concentration curl',
      'dumbbell standing concentration curl',
      'dumbbell alternate biceps curl',
      'Concentration Curls',
      'barbell curl',
      'chin-up',
    ],
    avoidKeywords: ['finger', 'wrist', 'leg', 'crunch'],
  },
  'barbell squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['barbell squat', 'full squat', 'high bar squat', 'back squat', 'goblet squat', 'squat'],
    preferredNames: [
      'barbell full squat',
      'barbell high bar squat',
      'barbell low bar squat',
      'Barbell Squat',
      'Barbell Full Squat',
      'dumbbell squat',
      'dumbbell goblet squat',
      'jump squat',
    ],
    avoidKeywords: ['stretch', 'bosu', 'sit-up', 'snatch'],
  },
  'goblet squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['goblet squat', 'dumbbell squat', 'kettlebell goblet squat', 'squat'],
    preferredNames: [
      'dumbbell goblet squat',
      'kettlebell goblet squat',
      'dumbbell squat',
      'Goblet Squat',
      'barbell full squat',
      'jump squat',
    ],
    avoidKeywords: ['stretch', 'bosu', 'sit-up'],
  },
  'front squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['front squat', 'zercher squat', 'goblet squat', 'hack squat', 'squat'],
    preferredNames: [
      'barbell front squat',
      'barbell clean-grip front squat',
      'barbell zercher squat',
      'dumbbell goblet squat',
      'Front Barbell Squat',
      'Front Squat (Clean Grip)',
      'sissy squat',
    ],
    avoidKeywords: ['bosu', 'stretch', 'clean and press'],
  },
  'hack squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['hack squat', 'split squat', 'step-up', 'squat'],
    preferredNames: [
      'sled hack squat',
      'barbell hack squat',
      'smith hack squat',
      'Hack Squat',
      'Barbell Hack Squat',
      'dumbbell bulgarian split squat',
      'dumbbell step-up',
      'sissy squat',
    ],
    avoidKeywords: ['stretch', 'all fours'],
  },
  'leg press': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['leg press', 'sled 45', 'split squat', 'step-up', 'squat'],
    preferredNames: [
      'sled 45° leg press',
      'sled 45° leg press (side pov)',
      'lever seated leg press',
      'smith leg press',
      'Leg Press',
      'dumbbell bulgarian split squat',
      'barbell split squat',
      'dumbbell squat',
      'single-leg squat',
    ],
    avoidKeywords: ['stretch', 'all fours', 'calf'],
  },
  'leg extension': {
    muscles: ['quads', 'quadriceps'],
    keywords: ['leg extension', 'sissy squat', 'step-up', 'split squat', 'lunge'],
    preferredNames: [
      'lever leg extension',
      'lever one leg extension',
      'Leg Extensions',
      'sissy squat',
      'dumbbell step-up',
      'barbell step-up',
      'dumbbell lunge',
    ],
    avoidKeywords: ['stretch', 'triceps', 'kick', 'push-up'],
  },
  'leg curl': {
    muscles: ['hamstrings'],
    keywords: ['leg curl', 'hamstring curl', 'glute-ham', 'romanian deadlift', 'stiff leg'],
    preferredNames: [
      'lever lying leg curl',
      'lever seated leg curl',
      'dumbbell lying femoral',
      'Seated Leg Curl',
      'Lying Leg Curls',
      'Lying Dumbbell Leg Curl',
      'barbell good morning',
      'glute-ham raise',
    ],
    avoidKeywords: ['finger', 'wrist', 'biceps', 'stretch'],
  },
  'hamstring curl': {
    muscles: ['hamstrings'],
    keywords: ['leg curl', 'hamstring', 'glute-ham', 'stiff-legged', 'good morning'],
    preferredNames: [
      'lever lying leg curl',
      'lever seated leg curl',
      'dumbbell lying femoral',
      'Lying Leg Curls',
      'Seated Leg Curl',
      'dumbbell stiff leg deadlift',
      'barbell good morning',
      'glute-ham raise',
    ],
    avoidKeywords: ['finger', 'wrist', 'biceps', 'stretch'],
  },
  'deadlift': {
    muscles: ['hamstrings', 'glutes', 'lower back', 'spine'],
    keywords: ['deadlift', 'sumo deadlift', 'rack pull', 'hip thrust', 'glute bridge'],
    preferredNames: [
      'barbell deadlift',
      'barbell sumo deadlift',
      'dumbbell deadlift',
      'kettlebell sumo deadlift',
      'Barbell Deadlift',
      'Sumo Deadlift',
      'single leg glute bridge',
    ],
    avoidKeywords: ['push-up', 'kick', 'stretch', 'upright row'],
  },
  'romanian deadlift': {
    muscles: ['hamstrings', 'glutes'],
    keywords: ['romanian deadlift', 'stiff leg deadlift', 'stiff-legged', 'good morning', 'hip thrust'],
    preferredNames: [
      'barbell romanian deadlift',
      'dumbbell romanian deadlift',
      'barbell stiff leg deadlift',
      'dumbbell stiff leg deadlift',
      'Romanian Deadlift',
      'Stiff-Legged Dumbbell Deadlift',
      'single leg deadlift',
    ],
    avoidKeywords: ['stretch', 'push-up'],
  },
  'dumbbell stiff leg deadlift': {
    muscles: ['hamstrings', 'glutes'],
    keywords: ['stiff leg deadlift', 'romanian deadlift', 'straight leg deadlift'],
    preferredNames: [
      'dumbbell stiff leg deadlift',
      'dumbbell straight leg deadlift',
      'dumbbell romanian deadlift',
      'barbell romanian deadlift',
      'single leg deadlift',
    ],
    avoidKeywords: ['stretch', 'push-up'],
  },
  'barbell glute bridge': {
    muscles: ['glutes', 'hamstrings'],
    keywords: ['glute bridge', 'hip thrust', 'pelvic tilt'],
    preferredNames: [
      'barbell glute bridge',
      'barbell glute bridge two legs on bench (male)',
      'glute bridge two legs on bench (male)',
      'low glute bridge on floor',
      'single leg glute bridge',
    ],
    avoidKeywords: ['stretch'],
  },
  'glute bridge': {
    muscles: ['glutes', 'hamstrings'],
    keywords: ['glute bridge', 'hip thrust', 'bridge'],
    preferredNames: [
      'low glute bridge on floor',
      'glute bridge two legs on bench (male)',
      'glute bridge march',
      'single leg glute bridge',
      'barbell glute bridge',
    ],
    avoidKeywords: ['stretch', 'neck'],
  },
  'walking lunge': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['walking lunge', 'lunge', 'split squat', 'rear lunge'],
    preferredNames: [
      'walking lunge',
      'dumbbell walking lunge',
      'barbell walking lunge',
      'dumbbell lunge',
      'barbell lunge',
      'Dumbbell Lunges',
      'bodyweight rear lunge',
    ],
    avoidKeywords: ['stretch'],
  },
  'lunge': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['lunge', 'split squat', 'step-up'],
    preferredNames: [
      'bodyweight forward lunge',
      'walking lunge',
      'dumbbell lunge',
      'barbell lunge',
      'dumbbell rear lunge',
      'Dumbbell Lunges',
    ],
    avoidKeywords: ['stretch'],
  },
  'dumbbell step-up': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['step-up', 'step up', 'split squat', 'lunge'],
    preferredNames: [
      'dumbbell step-up',
      'dumbbell step-up split squat',
      'dumbbell step-up lunge',
      'barbell step-up',
      'walking lunge',
    ],
    avoidKeywords: ['stretch'],
  },
  'calf raise': {
    muscles: ['calves'],
    keywords: ['calf raise', 'standing calf', 'rocking leg calf', 'donkey calf'],
    preferredNames: [
      'barbell standing calf raise',
      'dumbbell standing calf raise',
      'lever standing calf raise',
      'one leg floor calf raise',
      'standing calf raises',
      'Standing Calf Raises',
      'Standing Dumbbell Calf Raise',
    ],
    avoidKeywords: ['stretch'],
  },
  'seated calf raise': {
    muscles: ['calves'],
    keywords: ['seated calf raise', 'calf raise', 'seated one leg calf'],
    preferredNames: [
      'barbell seated calf raise',
      'dumbbell seated one leg calf raise',
      'lever seated calf raise',
      'Seated Calf Raise',
      'Barbell Seated Calf Raise',
      'barbell standing calf raise',
    ],
    avoidKeywords: ['stretch'],
  },
  'barbell shrug': {
    muscles: ['traps'],
    keywords: ['shrug', 'scaption', 'upright row'],
    preferredNames: [
      'barbell shrug',
      'dumbbell shrug',
      'barbell behind the back shrug',
      'cable shrug',
      'Barbell Shrug',
      'Dumbbell Shrug',
      'incline scapula push up',
    ],
    avoidKeywords: ['stretch', 'crunch'],
  },
  'dumbbell shrug': {
    muscles: ['traps'],
    keywords: ['dumbbell shrug', 'shrug', 'scaption'],
    preferredNames: [
      'dumbbell shrug',
      'dumbbell decline shrug',
      'barbell shrug',
      'cable shrug',
      'incline scapula push up',
    ],
    avoidKeywords: ['stretch', 'crunch'],
  },
  'back extension': {
    muscles: ['lower back', 'spine', 'glutes', 'hamstrings'],
    keywords: ['hyperextension', 'back extension', 'good morning', 'superman', 'pelvic tilt'],
    preferredNames: [
      'hyperextension (on bench)',
      'hyperextension',
      'barbell good morning',
      'Hyperextensions (Back Extensions)',
      'Good Morning',
      'Superman',
      'dumbbell stiff leg deadlift',
    ],
    avoidKeywords: ['triceps', 'skull', 'leg extension'],
  },
  'push up': {
    muscles: ['chest', 'pectorals', 'triceps'],
    keywords: ['push-up', 'push up', 'incline push-up', 'wide hand push up'],
    preferredNames: [
      'push-up',
      'incline push-up',
      'wide hand push up',
      'decline push-up',
      'Pushups',
    ],
    avoidKeywords: ['suspended', 'trx', 'inside leg kick'],
  },
  'diamond push up': {
    muscles: ['triceps', 'chest'],
    keywords: ['diamond push-up', 'close-grip push-up', 'narrow push-up'],
    preferredNames: [
      'diamond push-up',
      'close-grip push-up',
      'incline close-grip push-up',
      'Close-Grip Push-Up',
    ],
    avoidKeywords: ['suspended', 'trx'],
  },
  'bodyweight squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['bodyweight squat', 'jump squat', 'sissy squat', 'pistol squat'],
    preferredNames: [
      'jump squat',
      'sissy squat',
      'single-leg squat (pistol) male',
      'Bodyweight Squat',
    ],
    avoidKeywords: ['barbell', 'dumbbell', 'cable', 'smith', 'stretch'],
  },
  'plank': {
    muscles: ['abs', 'abdominals'],
    keywords: ['plank', 'front plank', 'side plank', 'bridge'],
    preferredNames: [
      'front plank with twist',
      'power point plank',
      'bodyweight incline side plank',
      'Plank',
      'side plank',
      'reverse plank',
    ],
    avoidKeywords: ['weighted'],
  },
  'crunch': {
    muscles: ['abs', 'abdominals'],
    keywords: ['crunch', 'sit-up', 'curl-up'],
    preferredNames: [
      'crunch floor',
      'reverse crunch',
      'oblique crunches floor',
      'tuck crunch',
      'Crunches',
    ],
    avoidKeywords: ['cable', 'weighted', 'machine'],
  },
  'bicycle crunch': {
    muscles: ['abs', 'abdominals'],
    keywords: ['bicycle', 'air bike', 'alternate heel touchers', 'oblique crunch', 'russian twist'],
    preferredNames: [
      'alternate heel touchers',
      'oblique crunches floor',
      'russian twist',
      'Air Bike',
      'Cross-Body Crunch',
    ],
    avoidKeywords: ['weighted', 'barbell', 'cable'],
  },
  'hanging leg raise': {
    muscles: ['abs', 'abdominals'],
    keywords: ['hanging leg raise', 'hanging knee raise', 'lying leg raise', 'leg pull-in'],
    preferredNames: [
      'hanging leg raise',
      'hanging straight leg raise',
      'flat bench lying leg raise',
      'Hanging Leg Raise',
      'Flat Bench Lying Leg Raise',
    ],
    avoidKeywords: ['assisted', 'throw down'],
  },
  'mountain climber': {
    muscles: ['abs', 'abdominals', 'cardio'],
    keywords: ['mountain climber', 'Cross-Body Mountain', 'high knee'],
    preferredNames: [
      'mountain climber',
      'cross body mountain climber',
      'Mountain Climbers',
    ],
  },
  'burpee': {
    muscles: ['cardio', 'cardiovascular system', 'quads'],
    keywords: ['burpee', 'squat thrust', 'jump squat'],
    preferredNames: ['burpee', 'jack burpee', 'jump squat'],
  },
  'jumping jack': {
    muscles: ['cardio', 'cardiovascular system'],
    keywords: ['jumping jack', 'star jump', 'astride jumps', 'skater'],
    preferredNames: ['astride jumps (male)', 'star jump (male)', 'semi squat jump (male)', 'jack burpee'],
  },
  'high knees': {
    muscles: ['cardio', 'cardiovascular system', 'quads'],
    keywords: ['high knee', 'run', 'sprint', 'skip'],
    preferredNames: ['high knee against wall', 'run', 'short stride run', 'Split Jump'],
    avoidKeywords: ['barbell', 'dumbbell', 'cable'],
  },
  'superman': {
    muscles: ['lower back', 'spine'],
    keywords: ['superman', 'hyperextension', 'bird dog'],
    preferredNames: ['hyperextension (on bench)', 'pelvic tilt into bridge', 'Superman'],
  },
  'hip stretch': {
    muscles: ['glutes', 'quads', 'hamstrings', 'adductors'],
    keywords: ['hip', 'groin', 'glute stretch', 'lunge stretch', 'piriformis'],
    preferredNames: [
      'seated glute stretch',
      'seated piriformis stretch',
      'rocking frog stretch',
      'Groin and Back Stretch',
      'Kneeling Hip Flexor',
      'Seated Glute',
      'Lying Glute',
      'Butterfly',
    ],
    isStretch: true,
    avoidKeywords: ['neck'],
  },
  'hamstring stretch': {
    muscles: ['hamstrings'],
    keywords: ['hamstring stretch', '90/90 hamstring', 'toe touch', 'hamstring'],
    preferredNames: [
      'hamstring stretch',
      '90/90 Hamstring',
      'Standing Hamstring and Calf Stretch',
      'Seated Floor Hamstring Stretch',
    ],
    isStretch: true,
  },
  'shoulder stretch': {
    muscles: ['shoulders', 'delts'],
    keywords: ['shoulder stretch', 'arm crossover', 'posterior shoulder'],
    preferredNames: [
      'rear deltoid stretch',
      'chest and front of shoulder stretch',
      'Shoulder Stretch',
      'Kneeling Forearm Stretch',
      'Seated Front Deltoid',
      'Chair Upper Body Stretch',
    ],
    isStretch: true,
  },
  'quad stretch': {
    muscles: ['quads', 'quadriceps'],
    keywords: ['quad stretch', 'quadriceps stretch', 'kneeling quad'],
    preferredNames: [
      'lying (side) quads stretch',
      'All Fours Quad Stretch',
      'On Your Side Quad Stretch',
      'Standing Pelvic Tilt',
    ],
    isStretch: true,
  },
  'calf stretch': {
    muscles: ['calves'],
    keywords: ['calf stretch', 'gastrocnemius', 'achilles', 'calves stretch'],
    preferredNames: [
      'seated calf stretch (male)',
      'calf stretch with hands against wall',
      'Standing Gastrocnemius Calf Stretch',
      'Seated Calf Stretch',
      'Calf Stretch Hands Against Wall',
    ],
    isStretch: true,
  },
};

function isStretchExercise(ex: Exercise): boolean {
  const cat = (ex.category || '').toLowerCase();
  const name = (ex.name || '').toLowerCase();
  if (cat === 'stretching') return true;
  if (name.includes('stretch') || name.includes('pose') || name.includes('smr') || name.includes('one arm against wall')) {
    return true;
  }
  return false;
}

/**
 * Extracts a normalized "movement stem" so very close variants (e.g. "barbell curl" vs "Barbell Curl")
 * are never both picked in the same workout day.
 */
export function getMovementStem(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\((?:male|female|v\.\s*\d+|version\s*\d+)\)/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ResolveWorkoutOptions {
  allExercises: Exercise[];
  userEquipment: string[];
  barWeight: number;
  dumbbellWeight: number;
  savedSwaps?: Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }>;
  recentExerciseIds?: Set<number>;
  varietySeed?: number;
  varietyLevel?: 'low' | 'medium' | 'high';
}

/**
 * Resolves a single planned exercise into the best matching Exercise from the catalog
 * that strictly satisfies `userEquipment`, prioritizes GIF-backed exercises first (using static
 * image exercises as a backup only if no GIF match exists), and avoids duplicates.
 */
export function findBestExerciseMatch(
  plannedName: string,
  allExercises: Exercise[],
  userEquipment: string[],
  usedIds: Set<number>,
  usedStems: Set<string>,
  recentExerciseIds: Set<number> = new Set(),
  slotVarietySeed: number = 0,
  varietyLevel: 'low' | 'medium' | 'high' = 'medium'
): Exercise | undefined {
  const cleanTarget = plannedName.trim().toLowerCase();
  const profile = MOVEMENT_PROFILES[cleanTarget];
  const wantStretch = Boolean(profile?.isStretch || cleanTarget.includes('stretch'));

  // 1. Filter catalog strictly by user's selected equipment and unused in current workout
  const equipmentValid = allExercises.filter((ex) => {
    if (!matchesUserEquipment(ex, userEquipment)) return false;
    if (ex.id && usedIds.has(ex.id)) return false;
    const stem = getMovementStem(ex.name);
    if (usedStems.has(stem)) return false;
    if (!wantStretch && isStretchExercise(ex)) return false;
    if (wantStretch && !isStretchExercise(ex)) return false;
    return true;
  });

  if (equipmentValid.length === 0) {
    const fallbackPool = allExercises.filter(
      (ex) => matchesUserEquipment(ex, userEquipment) && (!ex.id || !usedIds.has(ex.id))
    );
    const gifFallback = fallbackPool.find((ex) => hasGifExerciseMedia(ex));
    return gifFallback || fallbackPool[0] || allExercises[0];
  }

  // 2. If varietyLevel is 'low', check if exact name with a GIF is available first
  if (varietyLevel === 'low' && slotVarietySeed === 0) {
    const exactGif = equipmentValid.find(
      (e) => e.name.toLowerCase() === cleanTarget && hasGifExerciseMedia(e)
    );
    if (exactGif && (!exactGif.id || !recentExerciseIds.has(exactGif.id))) {
      return exactGif;
    }
  }

  // 3. Score all equipment-valid candidates
  const targetTokens = cleanTarget
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['barbell', 'dumbbell', 'cable', 'machine', 'lever', 'smith', 'band'].includes(w));

  const inferredMuscles: string[] = profile?.muscles ? [...profile.muscles] : [];
  if (inferredMuscles.length === 0) {
    const refEx = allExercises.find((e) => e.name.toLowerCase() === cleanTarget) ||
      allExercises.find((e) => e.name.toLowerCase().includes(cleanTarget));
    if (refEx?.primaryMuscles) {
      inferredMuscles.push(...refEx.primaryMuscles);
    }
  }

  const scored: { ex: Exercise; score: number; hasGif: boolean }[] = [];

  for (const ex of equipmentValid) {
    const exName = ex.name.toLowerCase();
    let score = 0;

    if (profile?.avoidKeywords?.some((bad) => exName.includes(bad))) {
      continue;
    }

    const muscleMatch = inferredMuscles.length === 0 || sharesTargetMuscle(ex.primaryMuscles || [], inferredMuscles);
    const secondaryMatch = inferredMuscles.length > 0 && sharesTargetMuscle(ex.secondaryMuscles || [], inferredMuscles);

    if (!muscleMatch && !secondaryMatch) {
      continue;
    }

    if (muscleMatch) score += 60;
    else if (secondaryMatch) score += 25;

    if (exName === cleanTarget) {
      score += 80;
    }

    if (profile?.preferredNames) {
      const prefIdx = profile.preferredNames.findIndex((p) => p.toLowerCase() === exName);
      if (prefIdx !== -1) {
        score += Math.max(40, 84 - prefIdx * 6);
      } else if (profile.preferredNames.some((p) => exName.includes(p.toLowerCase()))) {
        score += 35;
      }
    }

    if (profile?.keywords) {
      for (const kw of profile.keywords) {
        if (exName.includes(kw.toLowerCase())) {
          score += 30;
          break;
        }
      }
    }

    if (targetTokens.length > 0) {
      const matchedTokens = targetTokens.filter((t) => exName.includes(t)).length;
      score += matchedTokens * 22;
    }

    // Prioritize GIFs as primary media, with static images as backup
    const hasGif = hasGifExerciseMedia(ex);
    if (hasGif) {
      score += 65;
    } else if ((ex.imageUrls && ex.imageUrls.length > 0) || (ex.images && ex.images.length > 0)) {
      score += 8;
    }

    if (ex.instructions && ex.instructions.length > 0) {
      score += 5;
    }

    if (ex.id && recentExerciseIds.has(ex.id)) {
      score -= varietyLevel === 'high' ? 45 : varietyLevel === 'medium' ? 28 : 12;
    }

    scored.push({ ex, score, hasGif });
  }

  if (scored.length === 0) {
    for (const ex of equipmentValid) {
      if (inferredMuscles.length === 0 || sharesTargetMuscle(ex.primaryMuscles || [], inferredMuscles)) {
        const hasGif = hasGifExerciseMedia(ex);
        let score = 50 + (hasGif ? 65 : 0);
        if (ex.id && recentExerciseIds.has(ex.id)) score -= 25;
        scored.push({ ex, score, hasGif });
      }
    }
  }

  if (scored.length === 0) {
    const gifPool = equipmentValid.filter((ex) => hasGifExerciseMedia(ex));
    const pool = gifPool.length > 0 ? gifPool : equipmentValid;
    return pool[Math.abs(slotVarietySeed) % pool.length];
  }

  scored.sort((a, b) => b.score - a.score);

  const bestScore = scored[0].score;
  const scoreWindow = varietyLevel === 'high' ? 45 : varietyLevel === 'medium' ? 30 : 12;
  const maxPoolSize = varietyLevel === 'high' ? 10 : varietyLevel === 'medium' ? 6 : 2;

  const candidatesInWindow = scored.filter((item) => item.score >= bestScore - scoreWindow);
  const gifCandidates = candidatesInWindow.filter((item) => item.hasGif);
  const effectivePool = (gifCandidates.length > 0 ? gifCandidates : candidatesInWindow).slice(0, maxPoolSize);

  const chosenIndex = Math.abs(slotVarietySeed) % effectivePool.length;
  return effectivePool[chosenIndex].ex;
}

/**
 * Resolves all exercises for a workout day sequentially, ensuring:
 * 1. 100% compliance with `userEquipment` (even for saved swaps)
 * 2. Zero duplicate exercises within the same workout day
 * 3. Primary GIF URLs populated alongside backup image frames (`mediaFrames`)
 */
export function resolveWorkoutDayExercises({
  dayExercises,
  allExercises,
  userEquipment,
  barWeight,
  dumbbellWeight,
  savedSwaps = {},
  recentExerciseIds = new Set(),
  varietySeed = 0,
  varietyLevel = 'medium',
}: ResolveWorkoutOptions & { dayExercises: WorkoutDayExercise[] }): ActiveExercise[] {
  const usedIds = new Set<number>();
  const usedStems = new Set<string>();
  const activeExercises: ActiveExercise[] = [];

  dayExercises.forEach((ex, idx) => {
    const swapKey = ex.exerciseName.toLowerCase();
    const savedSwap = savedSwaps[swapKey];

    let chosenEx: Exercise | undefined;

    if (savedSwap && varietySeed === 0) {
      const candidateSwap = allExercises.find((e) => e.id === savedSwap.newExerciseId) ||
        allExercises.find((e) => e.name.toLowerCase() === savedSwap.newExerciseName.toLowerCase());
      if (
        candidateSwap &&
        matchesUserEquipment(candidateSwap, userEquipment) &&
        (!candidateSwap.id || !usedIds.has(candidateSwap.id)) &&
        !usedStems.has(getMovementStem(candidateSwap.name))
      ) {
        chosenEx = candidateSwap;
      }
    }

    if (!chosenEx) {
      const slotSeed = varietySeed + idx * 3;
      chosenEx = findBestExerciseMatch(
        ex.exerciseName,
        allExercises,
        userEquipment,
        usedIds,
        usedStems,
        recentExerciseIds,
        slotSeed,
        varietyLevel
      );
    }

    if (chosenEx) {
      if (chosenEx.id) usedIds.add(chosenEx.id);
      usedStems.add(getMovementStem(chosenEx.name));
    }

    const startingWeight = getWorkoutStartingWeight({
      equipment: chosenEx?.equipment,
      plannedWeight: ex.weight,
      barWeight,
      dumbbellWeight,
    });

    const parsedReps = typeof ex.reps === 'number'
      ? ex.reps
      : Number.parseInt(String(ex.reps), 10) || 10;

    activeExercises.push({
      exerciseId: chosenEx?.id || 0,
      exerciseName: chosenEx?.name || ex.exerciseName,
      imageUrl: chosenEx ? getPrimaryExerciseImage(chosenEx) : undefined,
      gifUrl: chosenEx ? getExerciseGifUrl(chosenEx) : undefined,
      mediaFrames: chosenEx ? getExerciseImageFrames(chosenEx) : [],
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        setType: ex.setType as any,
        weight: startingWeight,
        reps: parsedReps,
        targetWeight: ex.weight || startingWeight,
        targetReps: parsedReps,
        isComplete: false,
      })),
      targetSets: ex.sets,
      targetReps: ex.reps,
      restTime: ex.restTime,
      isComplete: false,
    });
  });

  return activeExercises;
}

/**
 * Generates a balanced, non-repeating workout across the requested target muscle groups,
 * alternating antagonistic muscle groups and prioritizing compound & GIF-backed exercises.
 */
export function generateSmartWorkout({
  targetMuscles,
  exerciseCount = 6,
  setsPerExercise = 3,
  repsPerSet = 10,
  allExercises,
  userEquipment,
  recentExerciseIds = new Set(),
  seed = Date.now(),
}: {
  targetMuscles: string[];
  exerciseCount?: number;
  setsPerExercise?: number;
  repsPerSet?: number;
  allExercises: Exercise[];
  userEquipment: string[];
  recentExerciseIds?: Set<number>;
  seed?: number;
}): { name: string; sets: number; reps: number; equipment: string; primaryMuscle: string }[] {
  const validPool = allExercises.filter(
    (ex) => matchesUserEquipment(ex, userEquipment) && !isStretchExercise(ex)
  );

  const usedIds = new Set<number>();
  const usedStems = new Set<string>();
  const results: { name: string; sets: number; reps: number; equipment: string; primaryMuscle: string }[] = [];

  // Order muscles so large/compound groups come first and antagonistic pairs alternate
  const PRIORITY_ORDER = [
    'quads', 'quadriceps', 'hamstrings', 'glutes', 'chest', 'back', 'lats', 'upper back',
    'shoulders', 'traps', 'biceps', 'triceps', 'calves', 'abs', 'abdominals', 'forearms',
  ];

  const baseMuscles = targetMuscles.length > 0
    ? [...targetMuscles].sort((a, b) => {
        const ia = PRIORITY_ORDER.indexOf(a.toLowerCase());
        const ib = PRIORITY_ORDER.indexOf(b.toLowerCase());
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
    : ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'abs'];

  for (let i = 0; i < exerciseCount; i++) {
    const targetMuscle = baseMuscles[i % baseMuscles.length];
    const candidates = validPool.filter((ex) => {
      if (ex.id && usedIds.has(ex.id)) return false;
      if (usedStems.has(getMovementStem(ex.name))) return false;
      return sharesTargetMuscle(ex.primaryMuscles || [], [targetMuscle]);
    });

    if (candidates.length === 0) continue;

    // Prefer GIF-backed exercises first; only use image-only backups if no GIF candidate exists
    const gifCandidates = candidates.filter((ex) => hasGifExerciseMedia(ex));
    const poolToScore = gifCandidates.length > 0 ? gifCandidates : candidates;

    const scored = poolToScore.map((ex, idx) => {
      let score = 50;
      if (hasGifExerciseMedia(ex)) score += 60;
      if (ex.mechanic === 'compound' && i < Math.ceil(exerciseCount * 0.6)) score += 18;
      if (ex.instructions && ex.instructions.length > 0) score += 8;
      if (ex.id && recentExerciseIds.has(ex.id)) score -= 35;
      const hash = Math.abs((seed + i * 31 + idx * 17) % 29);
      score += hash;
      return { ex, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const picked = scored[0].ex;
    if (picked.id) usedIds.add(picked.id);
    usedStems.add(getMovementStem(picked.name));

    results.push({
      name: picked.name,
      sets: setsPerExercise,
      reps: repsPerSet,
      equipment: picked.equipment || 'body weight',
      primaryMuscle: picked.primaryMuscles?.[0] || targetMuscle,
    });
  }

  return results;
}

export interface PlanMuscleBalanceSummary {
  categories: {
    id: 'push' | 'pull' | 'legs' | 'arms' | 'core';
    label: string;
    sets: number;
    percentage: number;
    color: string;
  }[];
  totalSets: number;
  balanceScore: number; // 0-100
}

/**
 * Computes the body-part volume distribution across all days of a workout plan.
 */
export function analyzePlanMuscleBalance(
  days: WorkoutDay[],
  allExercises: Exercise[]
): PlanMuscleBalanceSummary {
  const bucketSets: Record<'push' | 'pull' | 'legs' | 'arms' | 'core', number> = {
    push: 0,
    pull: 0,
    legs: 0,
    arms: 0,
    core: 0,
  };

  const classifyExercise = (name: string): 'push' | 'pull' | 'legs' | 'arms' | 'core' => {
    const clean = name.trim().toLowerCase();
    const profile = MOVEMENT_PROFILES[clean];
    const muscles = profile?.muscles ||
      allExercises.find((e) => e.name.toLowerCase() === clean)?.primaryMuscles ||
      [];
    const joined = `${clean} ${muscles.join(' ')}`.toLowerCase();

    if (/squat|lunge|leg press|leg extension|leg curl|hamstring|deadlift|romanian|glute|hip thrust|calf|quad|step-up|hip stretch/.test(joined)) {
      return 'legs';
    }
    if (/plank|crunch|leg raise|mountain climber|ab |abs|abdominals|oblique|sit-up/.test(joined)) {
      return 'core';
    }
    if (/curl|tricep|skull crusher|pushdown|preacher|kickback|bicep|forearm/.test(joined)) {
      return 'arms';
    }
    if (/row|pull up|pull-up|chin up|chin-up|pulldown|face pull|reverse fly|shrug|back extension|superman|lat|rhomboid|trap/.test(joined)) {
      return 'pull';
    }
    return 'push';
  };

  for (const day of days) {
    for (const ex of day.exercises || []) {
      const cat = classifyExercise(ex.exerciseName);
      bucketSets[cat] += Math.max(1, ex.sets || 3);
    }
  }

  const totalSets = Object.values(bucketSets).reduce((a, b) => a + b, 0) || 1;
  const meta: { id: 'push' | 'pull' | 'legs' | 'arms' | 'core'; label: string; color: string }[] = [
    { id: 'push', label: 'Chest & Delts', color: '#FF3D5A' },
    { id: 'pull', label: 'Back & Traps', color: '#10E89A' },
    { id: 'legs', label: 'Legs & Glutes', color: '#F59E0B' },
    { id: 'arms', label: 'Biceps & Triceps', color: '#8B5CF6' },
    { id: 'core', label: 'Abs & Core', color: '#38BDF8' },
  ];

  const categories = meta.map((m) => ({
    ...m,
    sets: bucketSets[m.id],
    percentage: Math.round((bucketSets[m.id] / totalSets) * 100),
  }));

  // Evaluate push/pull/legs balance ratio
  const activeBuckets = Object.values(bucketSets).filter((v) => v > 0).length;
  const pushPullRatio =
    bucketSets.push > 0 && bucketSets.pull > 0
      ? Math.min(bucketSets.push, bucketSets.pull) / Math.max(bucketSets.push, bucketSets.pull)
      : 0.7;
  const legsRatio = bucketSets.legs > 0 ? Math.min(1, (bucketSets.legs / totalSets) / 0.22) : 0.6;
  const balanceScore = Math.min(
    100,
    Math.round(50 + pushPullRatio * 25 + legsRatio * 15 + Math.min(activeBuckets, 5) * 2)
  );

  return { categories, totalSets, balanceScore };
}
