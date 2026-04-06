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
  {
    pattern: /(incline\s+bench|incline\s+press|low\s+incline\s+press)/i,
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
  {
    pattern: /(flat\s+bench|bench\s+press|dumbbell\s+press|barbell\s+press)/i,
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
  {
    pattern: /(decline\s+bench|decline\s+press)/i,
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
  {
    pattern: /(overhead\s+press|shoulder\s+press|military\s+press|push\s+press)/i,
    targeting: {
      targets: targets(
        ['front_shoulder_anterior_l', 1.2, true],
        ['front_shoulder_anterior_r', 1.2, true],
        ['front_shoulder_lateral_l', 1.05, true],
        ['front_shoulder_lateral_r', 1.05, true],
        ['back_triceps_long_l', 0.85, false],
        ['back_triceps_long_r', 0.85, false],
        ['front_abs_middle', 0.6, false],
        ['front_obliques_l', 0.45, false],
        ['front_obliques_r', 0.45, false]
      ),
      biomechanics: FREE_WEIGHT_BIOMECH,
    },
  },
  {
    pattern: /(lateral\s+raise|side\s+raise)/i,
    targeting: {
      targets: targets(
        ['front_shoulder_lateral_l', 1.35, true],
        ['front_shoulder_lateral_r', 1.35, true],
        ['back_shoulder_posterior_l', 0.45, false],
        ['back_shoulder_posterior_r', 0.45, false],
        ['front_shoulder_anterior_l', 0.4, false],
        ['front_shoulder_anterior_r', 0.4, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
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
  {
    pattern: /(pull\s*up|chin\s*up|lat\s*pull\s*down)/i,
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
  {
    pattern: /(barbell\s+row|dumbbell\s+row|t-?bar\s+row|seated\s+row|cable\s+row|machine\s+row)/i,
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
  {
    pattern: /(deadlift|romanian\s+deadlift|rdl|stiff\s+leg\s+deadlift)/i,
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
  {
    pattern: /(squat|front\s+squat|back\s+squat|goblet\s+squat|hack\s+squat|leg\s+press)/i,
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
  {
    pattern: /(leg\s+extension)/i,
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
  {
    pattern: /(leg\s+curl|hamstring\s+curl|nordic\s+curl)/i,
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
  {
    pattern: /(hip\s+thrust|glute\s+bridge)/i,
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
  {
    pattern: /(calf\s+raise|standing\s+calf|seated\s+calf)/i,
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
  {
    pattern: /(biceps\s+curl|hammer\s+curl|preacher\s+curl|concentration\s+curl)/i,
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
  {
    pattern: /(triceps\s+pushdown|skull\s*crusher|overhead\s+triceps|dip)/i,
    targeting: {
      targets: targets(
        ['back_triceps_long_l', 1.15, true],
        ['back_triceps_long_r', 1.15, true],
        ['back_triceps_lateral_l', 1.1, true],
        ['back_triceps_lateral_r', 1.1, true],
        ['back_triceps_medial_l', 0.95, false],
        ['back_triceps_medial_r', 0.95, false],
        ['front_chest_lower_l', 0.5, false],
        ['front_chest_lower_r', 0.5, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
  {
    pattern: /(plank|hollow\s+hold|ab\s+wheel|dead\s+bug|copenhagen\s+plank)/i,
    targeting: {
      targets: targets(
        ['front_abs_upper', 1.1, true],
        ['front_abs_middle', 1.15, true],
        ['front_abs_lower', 1.05, true],
        ['front_obliques_l', 0.9, false],
        ['front_obliques_r', 0.9, false],
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
  {
    pattern: /(crunch|sit\s*up|leg\s+raise|hanging\s+knee\s+raise)/i,
    targeting: {
      targets: targets(
        ['front_abs_upper', 1.15, true],
        ['front_abs_middle', 1.1, true],
        ['front_abs_lower', 1.25, true],
        ['front_obliques_l', 0.5, false],
        ['front_obliques_r', 0.5, false]
      ),
      biomechanics: MACHINE_BIOMECH,
    },
  },
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
  {
    pattern: /(shrug|barbell\s+shrug|dumbbell\s+shrug)/i,
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
