import { ALL_REGIONS, type MuscleRegion } from './AnatomyModel';

export type ExerciseTarget = {
  regionId: string;
  coefficient: number;
  isPrimary: boolean;
};

export type ExerciseBiomechanics = {
  stabilizationFactor: number;
  rangeOfMotion: 'shortened' | 'mid' | 'stretched';
  tempoSensitivity: number;
  eccentricEmphasis: boolean;
};

export type ExerciseTargeting = {
  exerciseName: string;
  targets: ExerciseTarget[];
  biomechanics: ExerciseBiomechanics;
};

type ExercisePattern = {
  pattern: RegExp;
  targeting: Omit<ExerciseTargeting, 'exerciseName'>;
};

const REGIONS_BY_ID = new Map(ALL_REGIONS.map(region => [region.id, region]));

function validTargets(targets: ExerciseTarget[]): ExerciseTarget[] {
  return targets.filter(target => REGIONS_BY_ID.has(target.regionId));
}

function targets(...entries: Array<[string, number, boolean]>): ExerciseTarget[] {
  return validTargets(entries.map(([regionId, coefficient, isPrimary]) => ({ regionId, coefficient, isPrimary })));
}

const FREE_WEIGHT_BIOMECH: ExerciseBiomechanics = {
  stabilizationFactor: 1.15,
  rangeOfMotion: 'mid',
  tempoSensitivity: 1,
  eccentricEmphasis: false,
};

const MACHINE_BIOMECH: ExerciseBiomechanics = {
  stabilizationFactor: 1,
  rangeOfMotion: 'mid',
  tempoSensitivity: 0.8,
  eccentricEmphasis: false,
};

const PATTERNS: ExercisePattern[] = [
  // 1. Incline Chest Presses & Incline Push-Ups (must precede generic bench/dumbbell press)
  {
    pattern: /(incline.*(?:bench|press|push-?up|fly|flye)|low\s+incline\s+press)/i,
    targeting: {
      targets: targets(
        ['front_chest_upper_l', 1.3, true],
        ['front_chest_upper_r', 1.3, true],
        ['front_chest_middle_l', 0.8, false],
        ['front_chest_middle_r', 0.8, false],
        ['front_chest_lower_l', 0.4, false],
        ['front_chest_lower_r', 0.4, false],
        ['front_shoulder_anterior_l', 0.85, false],
        ['front_shoulder_anterior_r', 0.85, false],
        ['back_triceps_long_l', 0.7, false],
        ['back_triceps_long_r', 0.7, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 2. Overhead / Shoulder / Arnold / Military / Pike / Handstand / Planche Presses
  {
    pattern: /(overhead\s+press|shoulder\s+press|military\s+press|push\s+press|arnold.*press|pike(?:-to-cobra)?\s+push-?up|handstand(?:\s+push-?ups?)?|planche)/i,
    targeting: {
      targets: targets(
        ['front_shoulder_anterior_l', 1.25, true],
        ['front_shoulder_anterior_r', 1.25, true],
        ['front_shoulder_lateral_l', 1.05, true],
        ['front_shoulder_lateral_r', 1.05, true],
        ['front_chest_upper_l', 0.75, false],
        ['front_chest_upper_r', 0.75, false],
        ['back_triceps_long_l', 0.85, false],
        ['back_triceps_long_r', 0.85, false],
        ['front_abs_middle', 0.65, false],
        ['front_obliques_l', 0.45, false],
        ['front_obliques_r', 0.45, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 3. Decline Chest Presses
  {
    pattern: /(decline.*(?:bench|press|push-?up|fly|flye))/i,
    targeting: {
      targets: targets(
        ['front_chest_lower_l', 1.25, true],
        ['front_chest_lower_r', 1.25, true],
        ['front_chest_middle_l', 0.85, false],
        ['front_chest_middle_r', 0.85, false],
        ['front_chest_upper_l', 0.45, false],
        ['front_chest_upper_r', 0.45, false],
        ['back_triceps_long_l', 0.68, false],
        ['back_triceps_long_r', 0.68, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 4. Triceps Extensions, Pushdowns, Skull Crushers, Dips & Diamond/Close-Grip Push-Ups
  {
    pattern: /(triceps?\s+pushdown|rope\s+pushdown|cable\s+pushdown|skull\s*crusher|overhead\s+triceps?|triceps?\s+extension|diamond\s+push-?up|close-?grip\s+push-?up|\bdips?\b)/i,
    targeting: {
      targets: targets(
        ['back_triceps_long_l', 1.15, true],
        ['back_triceps_long_r', 1.15, true],
        ['back_triceps_lateral_l', 1.1, true],
        ['back_triceps_lateral_r', 1.1, true],
        ['back_triceps_medial_l', 0.95, false],
        ['back_triceps_medial_r', 0.95, false],
        ['front_chest_lower_l', 0.55, false],
        ['front_chest_lower_r', 0.55, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 5. Flat Chest Bench Presses, Flyes, Crossovers, Landmine Press & Standard/Archer Push-Ups
  {
    pattern: /(flat\s+bench|bench\s+press|dumbbell\s+press|barbell\s+press|chest\s+press|landmine\s+press|cable\s+fly|dumbbell\s+fly|cable\s+crossover|pec\s+deck|\bpush-?ups?\b)/i,
    targeting: {
      targets: targets(
        ['front_chest_middle_l', 1.15, true],
        ['front_chest_middle_r', 1.15, true],
        ['front_chest_upper_l', 0.95, false],
        ['front_chest_upper_r', 0.95, false],
        ['front_chest_lower_l', 0.75, false],
        ['front_chest_lower_r', 0.75, false],
        ['front_shoulder_anterior_l', 0.82, false],
        ['front_shoulder_anterior_r', 0.82, false],
        ['back_triceps_lateral_l', 0.66, false],
        ['back_triceps_lateral_r', 0.66, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 6. Lateral & Front Deltoid Raises
  {
    pattern: /(lateral\s+raise|side\s+raise|front\s+raise|deltoid\s+raise|iron\s+cross)/i,
    targeting: {
      targets: targets(
        ['front_shoulder_lateral_l', 1.35, true],
        ['front_shoulder_lateral_r', 1.35, true],
        ['back_shoulder_posterior_l', 0.45, false],
        ['back_shoulder_posterior_r', 0.45, false],
        ['front_shoulder_anterior_l', 0.65, false],
        ['front_shoulder_anterior_r', 0.65, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 7. Rear Delts & Face Pulls
  {
    pattern: /(rear\s+delt|reverse\s+fly|face\s+pull)/i,
    targeting: {
      targets: targets(
        ['back_shoulder_posterior_l', 1.25, true],
        ['back_shoulder_posterior_r', 1.25, true],
        ['back_traps_middle', 0.9, false],
        ['back_traps_upper', 0.65, false],
        ['back_middle_rhomboids', 0.95, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 8. Vertical Pulling, Muscle-Ups, Levers, Pullovers & Straight-Arm Pulldowns
  {
    pattern: /(pull\s*-?\s*up|chin\s*-?\s*up|muscle\s*-?\s*up|front\s+lever|back\s+lever|lat\s*pull\s*down|reverse\s+grip\s+lat\s+pulldown|straight\s+arm\s+pulldown|pullover)/i,
    targeting: {
      targets: targets(
        ['back_lats_upper_l', 1.2, true],
        ['back_lats_upper_r', 1.2, true],
        ['back_lats_middle_l', 1.1, true],
        ['back_lats_middle_r', 1.1, true],
        ['back_lats_lower_l', 0.95, false],
        ['back_lats_lower_r', 0.95, false],
        ['front_biceps_long_l', 0.9, false],
        ['front_biceps_long_r', 0.9, false],
        ['front_biceps_short_l', 0.8, false],
        ['front_biceps_short_r', 0.8, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 9. Horizontal Rows (including Inverted Row)
  {
    pattern: /(barbell\s+row|dumbbell\s+row|t-?bar\s+row|seated\s+row|cable\s+row|machine\s+row|inverted\s+row|bent\s+over\s+row|pendlay\s+row)/i,
    targeting: {
      targets: targets(
        ['back_middle_rhomboids', 1.2, true],
        ['back_middle_mid_traps', 1.15, true],
        ['back_lats_middle_l', 1, false],
        ['back_lats_middle_r', 1, false],
        ['back_lats_upper_l', 0.75, false],
        ['back_lats_upper_r', 0.75, false],
        ['back_traps_lower', 0.7, false],
        ['front_biceps_long_l', 0.75, false],
        ['front_biceps_long_r', 0.75, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 10. Deadlifts, Kettlebell Swings, Back Extensions & Supermans
  {
    pattern: /(deadlift|romanian\s+deadlift|rdl|stiff\s+leg\s+deadlift|kettlebell\s+swing|back\s+extension|hyperextension|\bsuperman\b|good\s+morning)/i,
    targeting: {
      targets: targets(
        ['back_hamstrings_l', 1.2, true],
        ['back_hamstrings_r', 1.2, true],
        ['back_glutes_maximus_l', 1.15, true],
        ['back_glutes_maximus_r', 1.15, true],
        ['back_lower_erectors_l', 1.05, false],
        ['back_lower_erectors_r', 1.05, false],
        ['front_abs_middle', 0.9, false],
        ['front_obliques_l', 0.75, false],
        ['front_obliques_r', 0.75, false],
        ['front_forearms_l', 0.5, false],
        ['front_forearms_r', 0.5, false]
      ),
      biomechanics: {
        ...FREE_WEIGHT_BIOMECH,
        rangeOfMotion: 'stretched',
        eccentricEmphasis: true,
      },
    },
  },
  // 11. Squats, Pistol Squats, Lunges, Split Squats, Step-Ups & Leg Press
  {
    pattern: /(squat|pistol|front\s+squat|back\s+squat|goblet\s+squat|hack\s+squat|leg\s+press|\blunges?\b|walking\s+lunge|step-?up|burpee|high\s+knees|jumping\s+jack|stationary\s+bike)/i,
    targeting: {
      targets: targets(
        ['front_quads_rectus_femoris_l', 1.2, true],
        ['front_quads_rectus_femoris_r', 1.2, true],
        ['front_quads_vastus_lateralis_l', 1.1, true],
        ['front_quads_vastus_lateralis_r', 1.1, true],
        ['back_glutes_maximus_l', 1.05, false],
        ['back_glutes_maximus_r', 1.05, false],
        ['back_hamstrings_l', 0.8, false],
        ['back_hamstrings_r', 0.8, false],
        ['front_abs_middle', 0.65, false],
        ['front_obliques_l', 0.5, false],
        ['front_obliques_r', 0.5, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 12. Leg Extension
  {
    pattern: /(leg\s+extension|quad\s+stretch)/i,
    targeting: {
      targets: targets(
        ['front_quads_rectus_femoris_l', 1.3, true],
        ['front_quads_rectus_femoris_r', 1.3, true],
        ['front_quads_vastus_lateralis_l', 1.15, false],
        ['front_quads_vastus_lateralis_r', 1.15, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 13. Leg Curl / Hamstrings (must precede generic curl)
  {
    pattern: /(leg\s+curl|hamstring\s+curl|nordic\s+curl|hamstring\s+stretch)/i,
    targeting: {
      targets: targets(
        ['back_hamstrings_l', 1.35, true],
        ['back_hamstrings_r', 1.35, true],
        ['back_glutes_maximus_l', 0.5, false],
        ['back_glutes_maximus_r', 0.5, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 14. Hip Thrust & Glute Bridge
  {
    pattern: /(hip\s+thrust|glute\s+bridge|single\s+leg\s+bridge|hip\s+stretch)/i,
    targeting: {
      targets: targets(
        ['back_glutes_maximus_l', 1.35, true],
        ['back_glutes_maximus_r', 1.35, true],
        ['back_hamstrings_l', 0.7, false],
        ['back_hamstrings_r', 0.7, false],
        ['back_lower_erectors_l', 0.5, false],
        ['back_lower_erectors_r', 0.5, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  // 15. Calves
  {
    pattern: /(calf\s+raise|standing\s+calf|seated\s+calf|donkey\s+calf|calf\s+stretch)/i,
    targeting: {
      targets: targets(
        ['front_calves_l', 1.3, true],
        ['front_calves_r', 1.3, true],
        ['back_calves_l', 1.2, true],
        ['back_calves_r', 1.2, true]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 16. Biceps Curls (Barbell, Dumbbell, Incline, Hammer, Preacher, Concentration, EZ-Bar)
  {
    pattern: /(biceps?\s+curl|barbell\s+curl|dumbbell\s+curl|incline\s+curl|hammer\s+curl|preacher\s+curl|concentration\s+curl|ez-?bar.*curl|spider\s+curl)/i,
    targeting: {
      targets: targets(
        ['front_biceps_long_l', 1.2, true],
        ['front_biceps_long_r', 1.2, true],
        ['front_biceps_short_l', 1.25, true],
        ['front_biceps_short_r', 1.25, true],
        ['front_forearms_l', 0.85, false],
        ['front_forearms_r', 0.85, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 17. Planks, L-Sits & Isometric Core
  {
    pattern: /(plank|l-?sit|side\s+bridge|hollow\s+hold|ab\s+wheel|dead\s+bug|copenhagen\s+plank|mountain\s+climber|suitcase\s+carry)/i,
    targeting: {
      targets: targets(
        ['front_abs_upper', 1.1, true],
        ['front_abs_middle', 1.15, true],
        ['front_abs_lower', 1.15, true],
        ['front_obliques_l', 0.95, false],
        ['front_obliques_r', 0.95, false],
        ['back_lower_erectors_l', 0.6, false],
        ['back_lower_erectors_r', 0.6, false]
      ),
      biomechanics: {
        stabilizationFactor: 1.1,
        rangeOfMotion: 'mid',
        tempoSensitivity: 1.2,
        eccentricEmphasis: false,
      },
    },
  },
  // 18. Dynamic Abs, Leg Raises, Hanging Pike & Jackknife
  {
    pattern: /(crunch|sit\s*-?\s*up|leg\s+raise|knee\s+raise|hanging\s+pike|jackknife)/i,
    targeting: {
      targets: targets(
        ['front_abs_upper', 1.15, true],
        ['front_abs_middle', 1.1, true],
        ['front_abs_lower', 1.25, true],
        ['front_obliques_l', 0.55, false],
        ['front_obliques_r', 0.55, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  // 19. Obliques & Rotational Core
  {
    pattern: /(wood\s*chop|russian\s+twist|pallof\s+press|landmine\s+rotation)/i,
    targeting: {
      targets: targets(
        ['front_obliques_l', 1.2, true],
        ['front_obliques_r', 1.2, true],
        ['front_abs_middle', 0.95, false],
        ['front_abs_lower', 0.9, false],
        ['back_lower_erectors_l', 0.6, false],
        ['back_lower_erectors_r', 0.6, false]
      ),
      biomechanics: {
        stabilizationFactor: 1.15,
        rangeOfMotion: 'mid',
        tempoSensitivity: 1,
        eccentricEmphasis: false,
      },
    },
  },
  // 20. Shrugs & Shoulder Stretch
  {
    pattern: /(shrug|barbell\s+shrug|dumbbell\s+shrug|shoulder\s+stretch)/i,
    targeting: {
      targets: targets(
        ['back_traps_upper', 1.35, true],
        ['back_traps_middle', 0.95, false],
        ['back_shoulder_posterior_l', 0.45, false],
        ['back_shoulder_posterior_r', 0.45, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
];

export function resolveExerciseTargeting(exerciseName: string): ExerciseTargeting | null {
  const cleanName = exerciseName.toLowerCase().trim();
  const match = PATTERNS.find(entry => entry.pattern.test(cleanName));

  if (!match) {
    return null;
  }

  return {
    exerciseName,
    targets: match.targeting.targets,
    biomechanics: match.targeting.biomechanics,
  };
}

export function getRegionsForMuscle(muscle: string): MuscleRegion[] {
  return ALL_REGIONS.filter(region => region.muscle === muscle);
}
