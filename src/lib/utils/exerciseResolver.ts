import type { Exercise, WorkoutDayExercise, ActiveExercise } from '@/lib/types';
import { getWorkoutStartingWeight } from './workoutDefaults';
import { getPrimaryExerciseImage, getExerciseImageFrames } from './exerciseMedia';

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
      'Barbell Bench Press - Medium Grip',
      'barbell wide bench press',
      'dumbbell bench press',
      'barbell guillotine bench press',
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
    keywords: ['incline dumbbell press', 'incline bench press', 'incline press', 'incline push-up', 'incline fly'],
    preferredNames: [
      'Incline Dumbbell Press',
      'dumbbell incline bench press',
      'dumbbell incline hammer press',
      'barbell incline bench press',
      'incline push-up',
      'dumbbell incline fly',
      'smith incline bench press',
      'lever incline chest press',
    ],
    avoidKeywords: ['curl', 'row', 'shrug', 'sit-up'],
  },
  'cable fly': {
    muscles: ['chest', 'pectorals'],
    keywords: ['fly', 'flye', 'crossover', 'pullover', 'around the worlds', 'pec', 'push-up'],
    preferredNames: [
      'cable middle fly',
      'cable incline fly',
      'cable low fly',
      'dumbbell fly',
      'Dumbbell Flyes',
      'dumbbell incline fly',
      'dumbbell decline fly',
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
      'Cable Crossover',
      'cable standing up straight crossovers',
      'cable upper chest crossovers',
      'dumbbell decline fly',
      'Incline Dumbbell Flyes',
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
      'barbell standing military press',
      'barbell seated overhead press',
      'Standing Military Press',
      'Seated Barbell Military Press',
      'Dumbbell Shoulder Press',
      'dumbbell standing overhead press',
      'Barbell Shoulder Press',
      'kettlebell seated press',
      'pike push-up',
    ],
    avoidKeywords: ['chest', 'bench', 'calf', 'crunch', 'squat'],
  },
  'dumbbell shoulder press': {
    muscles: ['shoulders', 'delts'],
    keywords: ['dumbbell shoulder press', 'shoulder press', 'seated press', 'arnold press', 'overhead press'],
    preferredNames: [
      'Dumbbell Shoulder Press',
      'dumbbell seated shoulder press',
      'dumbbell standing overhead press',
      'dumbbell one arm shoulder press',
      'Arnold Dumbbell Press',
      'barbell seated overhead press',
      'pike push-up',
    ],
    avoidKeywords: ['chest', 'bench', 'shrug', 'curl'],
  },
  'arnold press': {
    muscles: ['shoulders', 'delts'],
    keywords: ['arnold', 'shoulder press', 'dumbbell press', 'overhead press', 'deltoid'],
    preferredNames: [
      'Arnold Dumbbell Press',
      'dumbbell arnold press',
      'dumbbell seated shoulder press',
      'Dumbbell Shoulder Press',
      'Alternating Deltoid Raise',
      'barbell upright row',
      'handstand push-up',
    ],
    avoidKeywords: ['chest', 'bench', 'leg', 'crunch'],
  },
  'lateral raise': {
    muscles: ['shoulders', 'delts'],
    keywords: ['lateral raise', 'side lateral', 'deltoid raise', 'raise'],
    preferredNames: [
      'dumbbell lateral raise',
      'Side Lateral Raise',
      'dumbbell seated lateral raise',
      'Alternating Deltoid Raise',
      'cable lateral raise',
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
      'Front Dumbbell Raise',
      'barbell front raise',
      'Alternating Deltoid Raise',
      'cable front raise',
      'Front Plate Raise',
      'band front raise',
    ],
    avoidKeywords: ['leg', 'calf', 'hanging', 'crunch'],
  },
  'face pull': {
    muscles: ['shoulders', 'delts', 'upper back'],
    keywords: ['face pull', 'rear delt', 'reverse fly', 'band pull apart', 'external rotation'],
    preferredNames: [
      'Face Pull',
      'cable rear delt row (with rope)',
      'dumbbell rear delt row_shoulder',
      'dumbbell seated bent-over rear delt raise',
      'Seated Bent-Over Rear Delt Raise',
      'barbell rear delt row',
      'Band Pull Apart',
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
      'Seated Bent-Over Rear Delt Raise',
      'cable rear delt row (with rope)',
      'cable supine reverse fly',
      'barbell rear delt row',
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
      'Triceps Pushdown',
      'dumbbell kickback',
      'Tricep Dumbbell Kickback',
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
      'Standing Dumbbell Triceps Extension',
      'barbell seated overhead triceps extension',
      'cable overhead triceps extension (rope attachment)',
      'ez barbell seated triceps extension',
      'bodyweight kneeling triceps extension',
    ],
    avoidKeywords: ['biceps', 'leg', 'back', 'hip'],
  },
  'skull crusher': {
    muscles: ['triceps'],
    keywords: ['skull', 'lying triceps', 'decline triceps', 'close-grip', 'triceps press'],
    preferredNames: [
      'barbell lying triceps extension skull crusher',
      'EZ-Bar Skullcrusher',
      'dumbbell lying triceps extension',
      'barbell decline close grip to skull press',
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
      'Bench Dips',
      'three bench dip',
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
      'Bent Over Barbell Row',
      'barbell reverse grip bent over row',
      'barbell incline row',
      'barbell pendlay row',
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
      'One-Arm Dumbbell Row',
      'Bent Over Two-Dumbbell Row',
      'dumbbell incline row',
      'dumbbell palm rotational bent over row',
      'barbell bent over row',
      'inverted row',
    ],
    avoidKeywords: ['side bend', 'sit-up', 'crunch', 'press', 'curl'],
  },
  'seated cable row': {
    muscles: ['upper back', 'middle back', 'lats', 'back'],
    keywords: ['seated row', 'cable row', 'bent over row', 'row', 'inverted row'],
    preferredNames: [
      'cable seated row',
      'Seated Cable Rows',
      'cable low seated row',
      'dumbbell bent over row',
      'Bent Over Two-Dumbbell Row',
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
      'Wide-Grip Lat Pulldown',
      'cable wide grip lat pulldown behind neck',
      'lever front pulldown',
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
      'Straight-Arm Pulldown',
      'dumbbell pullover',
      'Bent-Arm Dumbbell Pullover',
      'barbell pullover',
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
      'Pullups',
      'wide grip pull-up',
      'archer pull up',
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
      'Chin-Up',
      'narrow grip pull-up',
      'mixed grip chin-up',
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
      'Barbell Curl',
      'barbell wide-grip standing biceps curl',
      'ez barbell curl',
      'dumbbell biceps curl',
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
      'Hammer Curls',
      'dumbbell cross body hammer curl',
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
      'Incline Dumbbell Curl',
      'Alternate Incline Dumbbell Curl',
      'dumbbellIncline Hammer Curls',
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
      'Preacher Curl',
      'barbell preacher curl',
      'dumbbell preacher curl',
      'One Arm Dumbbell Preacher Curl',
      'ez barbell spider curl',
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
      'Concentration Curls',
      'dumbbell standing concentration curl',
      'dumbbell alternate biceps curl',
      'barbell curl',
      'chin-up',
    ],
    avoidKeywords: ['finger', 'wrist', 'leg', 'crunch'],
  },
  'barbell squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['barbell squat', 'full squat', 'high bar squat', 'back squat', 'goblet squat', 'squat'],
    preferredNames: [
      'Barbell Squat',
      'barbell full squat',
      'Barbell Full Squat',
      'barbell high bar squat',
      'barbell low bar squat',
      'dumbbell squat',
      'dumbbell goblet squat',
      'Bodyweight Squat',
    ],
    avoidKeywords: ['stretch', 'bosu', 'sit-up', 'snatch'],
  },
  'front squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['front squat', 'zercher squat', 'goblet squat', 'hack squat', 'squat'],
    preferredNames: [
      'barbell front squat',
      'Front Barbell Squat',
      'Front Squat (Clean Grip)',
      'barbell zercher squat',
      'dumbbell goblet squat',
      'Goblet Squat',
      'sissy squat',
    ],
    avoidKeywords: ['bosu', 'stretch', 'clean and press'],
  },
  'hack squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['hack squat', 'split squat', 'step-up', 'squat'],
    preferredNames: [
      'Hack Squat',
      'barbell hack squat',
      'Barbell Hack Squat',
      ' sled hack squat',
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
      'Leg Press',
      'sled 45° leg press',
      'lever seated leg press',
      'smith leg press',
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
      'Leg Extensions',
      'lever leg extension',
      'lever one leg extension',
      'sissy squat',
      'dumbbell step-up',
      'barbell step-up',
      'dumbbell lunges',
    ],
    avoidKeywords: ['stretch', 'triceps', 'kick', 'push-up'],
  },
  'leg curl': {
    muscles: ['hamstrings'],
    keywords: ['leg curl', 'hamstring curl', 'glute-ham', 'romanian deadlift', 'stiff leg'],
    preferredNames: [
      'Seated Leg Curl',
      'Lying Leg Curls',
      'lever lying leg curl',
      'lever seated leg curl',
      'dumbbell lying femoral',
      'Lying Dumbbell Leg Curl',
      'barbell good morning',
      'glute-ham raise',
      'natural glute ham raise',
    ],
    avoidKeywords: ['finger', 'wrist', 'biceps', 'stretch'],
  },
  'hamstring curl': {
    muscles: ['hamstrings'],
    keywords: ['leg curl', 'hamstring', 'glute-ham', 'stiff-legged', 'good morning'],
    preferredNames: [
      'Lying Leg Curls',
      'lever lying leg curl',
      'Seated Leg Curl',
      'dumbbell lying femoral',
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
      'Barbell Deadlift',
      'barbell sumo deadlift',
      'Sumo Deadlift',
      'dumbbell deadlift',
      'kettlebell sumo deadlift',
      'single leg glute bridge',
    ],
    avoidKeywords: ['push-up', 'kick', 'stretch', 'upright row'],
  },
  'romanian deadlift': {
    muscles: ['hamstrings', 'glutes'],
    keywords: ['romanian deadlift', 'stiff leg deadlift', 'stiff-legged', 'good morning', 'hip thrust'],
    preferredNames: [
      'Romanian Deadlift',
      'barbell romanian deadlift',
      'dumbbell romanian deadlift',
      'Stiff-Legged Dumbbell Deadlift',
      'barbell stiff leg deadlift',
      'single leg deadlift',
    ],
    avoidKeywords: ['stretch', 'push-up'],
  },
  'walking lunge': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['walking lunge', 'lunge', 'split squat', 'rear lunge'],
    preferredNames: [
      'walking lunge',
      'dumbbell walking lunge',
      'barbell walking lunge',
      'Dumbbell Lunges',
      'barbell lunge',
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
      'Dumbbell Lunges',
      'barbell lunge',
      'dumbbell rear lunge',
    ],
    avoidKeywords: ['stretch'],
  },
  'calf raise': {
    muscles: ['calves'],
    keywords: ['calf raise', 'standing calf', 'rocking leg calf', 'donkey calf'],
    preferredNames: [
      'standing calf raises',
      'Standing Calf Raises',
      'barbell standing calf raise',
      'dumbbell standing calf raise',
      'Standing Dumbbell Calf Raise',
      'lever standing calf raise',
      'one leg floor calf raise',
    ],
    avoidKeywords: ['stretch'],
  },
  'seated calf raise': {
    muscles: ['calves'],
    keywords: ['seated calf raise', 'calf raise', 'seated one leg calf'],
    preferredNames: [
      'Seated Calf Raise',
      'barbell seated calf raise',
      'Barbell Seated Calf Raise',
      'dumbbell seated one leg calf raise',
      'lever seated calf raise',
      'standing calf raises',
    ],
    avoidKeywords: ['stretch'],
  },
  'barbell shrug': {
    muscles: ['traps'],
    keywords: ['shrug', 'scaption', 'upright row'],
    preferredNames: [
      'barbell shrug',
      'Barbell Shrug',
      'dumbbell shrug',
      'Dumbbell Shrug',
      'barbell behind the back shrug',
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
      'Hyperextensions (Back Extensions)',
      'barbell good morning',
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
      'Pushups',
      'incline push-up',
      'wide hand push up',
      'decline push-up',
    ],
    avoidKeywords: ['suspended', 'trx', 'inside leg kick'],
  },
  'diamond push up': {
    muscles: ['triceps', 'chest'],
    keywords: ['diamond push-up', 'close-grip push-up', 'narrow push-up'],
    preferredNames: [
      'diamond push-up',
      'close-grip push-up',
      'Close-Grip Push-Up',
      'incline close-grip push-up',
    ],
    avoidKeywords: ['suspended', 'trx'],
  },
  'bodyweight squat': {
    muscles: ['quads', 'quadriceps', 'glutes'],
    keywords: ['bodyweight squat', 'jump squat', 'sissy squat', 'pistol squat'],
    preferredNames: [
      'Bodyweight Squat',
      'jump squat',
      'sissy squat',
      'single-leg squat (pistol) male',
    ],
    avoidKeywords: ['barbell', 'dumbbell', 'cable', 'smith', 'stretch'],
  },
  'plank': {
    muscles: ['abs', 'abdominals'],
    keywords: ['plank', 'front plank', 'side plank', 'bridge'],
    preferredNames: [
      'Plank',
      'front plank with twist',
      'side plank',
      'reverse plank',
    ],
    avoidKeywords: ['weighted'],
  },
  'crunch': {
    muscles: ['abs', 'abdominals'],
    keywords: ['crunch', 'sit-up', 'curl-up'],
    preferredNames: [
      'Crunches',
      'crunch floor',
      'reverse crunch',
      'oblique crunches floor',
      'tuck crunch',
    ],
    avoidKeywords: ['cable', 'weighted', 'machine'],
  },
  'bicycle crunch': {
    muscles: ['abs', 'abdominals'],
    keywords: ['bicycle', 'air bike', 'alternate heel touchers', 'oblique crunch', 'russian twist'],
    preferredNames: [
      'Air Bike',
      'alternate heel touchers',
      'oblique crunches floor',
      'russian twist',
      'Cross-Body Crunch',
    ],
    avoidKeywords: ['weighted', 'barbell', 'cable'],
  },
  'hanging leg raise': {
    muscles: ['abs', 'abdominals'],
    keywords: ['hanging leg raise', 'hanging knee raise', 'lying leg raise', 'leg pull-in'],
    preferredNames: [
      'hanging leg raise',
      'Hanging Leg Raise',
      'hanging straight leg raise',
      'flat bench lying leg raise',
      'Flat Bench Lying Leg Raise',
    ],
    avoidKeywords: ['assisted', 'throw down'],
  },
  'mountain climber': {
    muscles: ['abs', 'abdominals', 'cardio'],
    keywords: ['mountain climber', 'Cross-Body Mountain', 'high knee'],
    preferredNames: [
      'mountain climber',
      'Mountain Climbers',
      'cross body mountain climber',
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
    preferredNames: ['Superman', 'pelvic tilt into bridge', 'hyperextension (on bench)'],
  },
  'hip stretch': {
    muscles: ['glutes', 'quads', 'hamstrings', 'adductors'],
    keywords: ['hip', 'groin', 'glute stretch', 'lunge stretch', 'piriformis'],
    preferredNames: [
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
      'Standing Gastrocnemius Calf Stretch',
      'Seated Calf Stretch',
      'Calf Stretch Hands Against Wall',
      'standing calves',
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
  varietySeed?: number; // Used to rotate variations across days/workouts/shuffles
  varietyLevel?: 'low' | 'medium' | 'high';
}

/**
 * Resolves a single planned exercise into the best matching Exercise from the catalog
 * that strictly satisfies `userEquipment` and has not already been used in the current workout.
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
    // Fallback if all exercises for this equipment were exhausted: allow any unused equipment-valid exercise
    const fallbackPool = allExercises.filter(
      (ex) => matchesUserEquipment(ex, userEquipment) && (!ex.id || !usedIds.has(ex.id))
    );
    return fallbackPool[0] || allExercises[0];
  }

  // 2. If varietyLevel is 'low', check if exact name or preferredName is available first
  if (varietyLevel === 'low' && slotVarietySeed === 0) {
    const exact = equipmentValid.find((e) => e.name.toLowerCase() === cleanTarget);
    if (exact && (!exact.id || !recentExerciseIds.has(exact.id))) {
      return exact;
    }
  }

  // 3. Score all equipment-valid candidates
  const targetTokens = cleanTarget
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['barbell', 'dumbbell', 'cable', 'machine', 'lever', 'smith', 'band'].includes(w));

  const inferredMuscles: string[] = profile?.muscles ? [...profile.muscles] : [];
  if (inferredMuscles.length === 0) {
    // Infer muscle from any exercise in DB matching the planned name
    const refEx = allExercises.find((e) => e.name.toLowerCase() === cleanTarget) ||
      allExercises.find((e) => e.name.toLowerCase().includes(cleanTarget));
    if (refEx?.primaryMuscles) {
      inferredMuscles.push(...refEx.primaryMuscles);
    }
  }

  const scored: { ex: Exercise; score: number }[] = [];

  for (const ex of equipmentValid) {
    const exName = ex.name.toLowerCase();
    let score = 0;

    // Avoid-keyword filter
    if (profile?.avoidKeywords?.some((bad) => exName.includes(bad))) {
      continue;
    }

    // Target muscle compatibility
    const muscleMatch = inferredMuscles.length === 0 || sharesTargetMuscle(ex.primaryMuscles || [], inferredMuscles);
    const secondaryMatch = inferredMuscles.length > 0 && sharesTargetMuscle(ex.secondaryMuscles || [], inferredMuscles);

    if (!muscleMatch && !secondaryMatch) {
      continue;
    }

    if (muscleMatch) score += 60;
    else if (secondaryMatch) score += 25;

    // Exact match bonus
    if (exName === cleanTarget) {
      score += 85;
    }

    // Preferred curated variation bonus
    if (profile?.preferredNames) {
      const prefIdx = profile.preferredNames.findIndex((p) => p.toLowerCase() === exName);
      if (prefIdx !== -1) {
        score += Math.max(40, 80 - prefIdx * 6);
      } else if (profile.preferredNames.some((p) => exName.includes(p.toLowerCase()))) {
        score += 35;
      }
    }

    // Movement keyword bonus
    if (profile?.keywords) {
      for (const kw of profile.keywords) {
        if (exName.includes(kw.toLowerCase())) {
          score += 30;
          break;
        }
      }
    }

    // Token overlap bonus
    if (targetTokens.length > 0) {
      const matchedTokens = targetTokens.filter((t) => exName.includes(t)).length;
      score += matchedTokens * 22;
    }

    // Media availability bonus (prefer exercises with GIFs or image frames)
    if (ex.gifUrl && ex.gifUrl.trim().length > 0) {
      score += 12;
    } else if (ex.imageUrls && ex.imageUrls.length > 0) {
      score += 6;
    }

    // Instructions availability bonus
    if (ex.instructions && ex.instructions.length > 0) {
      score += 5;
    }

    // Anti-repetition penalty if recently performed in prior sessions
    if (ex.id && recentExerciseIds.has(ex.id)) {
      score -= varietyLevel === 'high' ? 45 : varietyLevel === 'medium' ? 28 : 12;
    }

    scored.push({ ex, score });
  }

  // If no candidate passed strict muscle+keyword filter, relax to any equipment-valid exercise sharing the muscle group
  if (scored.length === 0) {
    for (const ex of equipmentValid) {
      if (inferredMuscles.length === 0 || sharesTargetMuscle(ex.primaryMuscles || [], inferredMuscles)) {
        let score = 50;
        if (ex.gifUrl) score += 10;
        if (ex.id && recentExerciseIds.has(ex.id)) score -= 25;
        scored.push({ ex, score });
      }
    }
  }

  if (scored.length === 0) {
    return equipmentValid[slotVarietySeed % equipmentValid.length];
  }

  scored.sort((a, b) => b.score - a.score);

  // Build top candidate pool for variety rotation so exercises don't repeat monotonically
  const bestScore = scored[0].score;
  const scoreWindow = varietyLevel === 'high' ? 45 : varietyLevel === 'medium' ? 30 : 12;
  const maxPoolSize = varietyLevel === 'high' ? 10 : varietyLevel === 'medium' ? 6 : 2;

  const topPool = scored
    .filter((item) => item.score >= bestScore - scoreWindow)
    .slice(0, maxPoolSize);

  const chosenIndex = Math.abs(slotVarietySeed) % topPool.length;
  return topPool[chosenIndex].ex;
}

/**
 * Resolves all exercises for a workout day sequentially, ensuring:
 * 1. 100% compliance with `userEquipment` (even for saved swaps)
 * 2. Zero duplicate exercises within the same workout day
 * 3. Variety across days/sessions via `varietySeed` and `recentExerciseIds`
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

    // Only honor a saved swap if its equipment is STILL selected by the user and not already used today
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

    activeExercises.push({
      exerciseId: chosenEx?.id || 0,
      exerciseName: chosenEx?.name || ex.exerciseName,
      imageUrl: chosenEx ? getPrimaryExerciseImage(chosenEx) : undefined,
      gifUrl: chosenEx?.gifUrl || undefined,
      mediaFrames: chosenEx ? getExerciseImageFrames(chosenEx) : [],
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        setType: ex.setType as any,
        weight: startingWeight,
        reps: typeof ex.reps === 'number' ? ex.reps : 0,
        targetWeight: ex.weight || startingWeight,
        targetReps: typeof ex.reps === 'number' ? ex.reps : 0,
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
 * Generates a fresh, non-repeating workout for a list of target muscle groups using only the user's selected equipment.
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

  const muscles = targetMuscles.length > 0 ? targetMuscles : ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'biceps', 'triceps'];

  for (let i = 0; i < exerciseCount; i++) {
    const targetMuscle = muscles[i % muscles.length];
    const candidates = validPool.filter((ex) => {
      if (ex.id && usedIds.has(ex.id)) return false;
      if (usedStems.has(getMovementStem(ex.name))) return false;
      return sharesTargetMuscle(ex.primaryMuscles || [], [targetMuscle]);
    });

    if (candidates.length === 0) continue;

    // Sort candidates: prefer exercises not in recentExerciseIds and with animated media
    const scored = candidates.map((ex, idx) => {
      let score = 50;
      if (ex.gifUrl) score += 15;
      if (ex.instructions && ex.instructions.length > 0) score += 8;
      if (ex.id && recentExerciseIds.has(ex.id)) score -= 35;
      // Add deterministic pseudo-random spread from seed so every generation is fresh
      const hash = ((seed + i * 31 + idx * 17) % 29);
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
