/**
 * AnatomyModel - Enhanced muscle region definitions with anatomical subdivisions
 * 
 * This module defines 54 muscle regions across front and back views with:
 * - Anatomically accurate positioning and sizing
 * - Fiber direction (rotation angles)
 * - Depth layering for overlapping muscles
 * - Adjacent region mapping for spillover activation
 */

export interface MuscleRegion {
  id: string;
  muscle: string;
  subdivision?: string;
  side?: 'left' | 'right';
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  rotation: number;
  depth: number;
  adjacentRegions: string[];
}

export interface SideMuscleRegion extends Omit<MuscleRegion, 'side'> {
  side: 'left';
  sourceMuscle?: string;
}

/**
 * FRONT_REGIONS - 28 subdivided muscle regions for front view
 * 
 * Anatomical organization:
 * - Chest: upper/middle/lower × L/R (6 regions)
 * - Shoulders: anterior/lateral × L/R (4 regions)
 * - Biceps: long head/short head × L/R (4 regions)
 * - Forearms: L/R (2 regions)
 * - Abs: upper/middle/lower (3 regions)
 * - Obliques: L/R (2 regions)
 * - Serratus: L/R (2 regions)
 * - Quads: rectus femoris/vastus lateralis × L/R (4 regions)
 * - Calves: L/R (2 regions)
 */
export const FRONT_REGIONS: MuscleRegion[] = [
  // Chest subdivisions (6 regions)
  {
    id: 'front_chest_upper_l',
    muscle: 'chest',
    subdivision: 'upper',
    side: 'left',
    x: 66,
    y: 72,
    w: 16,
    h: 14,
    rx: 8,
    rotation: -8,
    depth: 3,
    adjacentRegions: ['front_chest_middle_l', 'front_chest_upper_r', 'front_shoulder_anterior_l'],
  },
  {
    id: 'front_chest_upper_r',
    muscle: 'chest',
    subdivision: 'upper',
    side: 'right',
    x: 118,
    y: 72,
    w: 16,
    h: 14,
    rx: 8,
    rotation: 8,
    depth: 3,
    adjacentRegions: ['front_chest_middle_r', 'front_chest_upper_l', 'front_shoulder_anterior_r'],
  },
  {
    id: 'front_chest_middle_l',
    muscle: 'chest',
    subdivision: 'middle',
    side: 'left',
    x: 68,
    y: 86,
    w: 18,
    h: 16,
    rx: 9,
    rotation: -6,
    depth: 3,
    adjacentRegions: ['front_chest_upper_l', 'front_chest_lower_l', 'front_chest_middle_r'],
  },
  {
    id: 'front_chest_middle_r',
    muscle: 'chest',
    subdivision: 'middle',
    side: 'right',
    x: 114,
    y: 86,
    w: 18,
    h: 16,
    rx: 9,
    rotation: 6,
    depth: 3,
    adjacentRegions: ['front_chest_upper_r', 'front_chest_lower_r', 'front_chest_middle_l'],
  },
  {
    id: 'front_chest_lower_l',
    muscle: 'chest',
    subdivision: 'lower',
    side: 'left',
    x: 72,
    y: 102,
    w: 16,
    h: 12,
    rx: 8,
    rotation: -4,
    depth: 3,
    adjacentRegions: ['front_chest_middle_l', 'front_chest_lower_r', 'front_abs_upper'],
  },
  {
    id: 'front_chest_lower_r',
    muscle: 'chest',
    subdivision: 'lower',
    side: 'right',
    x: 112,
    y: 102,
    w: 16,
    h: 12,
    rx: 8,
    rotation: 4,
    depth: 3,
    adjacentRegions: ['front_chest_middle_r', 'front_chest_lower_l', 'front_abs_upper'],
  },

  // Shoulder subdivisions (4 regions)
  {
    id: 'front_shoulder_anterior_l',
    muscle: 'shoulders',
    subdivision: 'anterior',
    side: 'left',
    x: 54,
    y: 54,
    w: 18,
    h: 16,
    rx: 9,
    rotation: -12,
    depth: 4,
    adjacentRegions: ['front_shoulder_lateral_l', 'front_chest_upper_l', 'front_biceps_long_l'],
  },
  {
    id: 'front_shoulder_anterior_r',
    muscle: 'shoulders',
    subdivision: 'anterior',
    side: 'right',
    x: 128,
    y: 54,
    w: 18,
    h: 16,
    rx: 9,
    rotation: 12,
    depth: 4,
    adjacentRegions: ['front_shoulder_lateral_r', 'front_chest_upper_r', 'front_biceps_long_r'],
  },
  {
    id: 'front_shoulder_lateral_l',
    muscle: 'shoulders',
    subdivision: 'lateral',
    side: 'left',
    x: 42,
    y: 58,
    w: 14,
    h: 18,
    rx: 7,
    rotation: -18,
    depth: 5,
    adjacentRegions: ['front_shoulder_anterior_l', 'front_biceps_long_l'],
  },
  {
    id: 'front_shoulder_lateral_r',
    muscle: 'shoulders',
    subdivision: 'lateral',
    side: 'right',
    x: 144,
    y: 58,
    w: 14,
    h: 18,
    rx: 7,
    rotation: 18,
    depth: 5,
    adjacentRegions: ['front_shoulder_anterior_r', 'front_biceps_long_r'],
  },

  // Biceps subdivisions (4 regions)
  {
    id: 'front_biceps_long_l',
    muscle: 'biceps',
    subdivision: 'long_head',
    side: 'left',
    x: 40,
    y: 84,
    w: 12,
    h: 32,
    rx: 6,
    rotation: -14,
    depth: 6,
    adjacentRegions: ['front_biceps_short_l', 'front_shoulder_anterior_l', 'front_forearms_l'],
  },
  {
    id: 'front_biceps_long_r',
    muscle: 'biceps',
    subdivision: 'long_head',
    side: 'right',
    x: 148,
    y: 84,
    w: 12,
    h: 32,
    rx: 6,
    rotation: 14,
    depth: 6,
    adjacentRegions: ['front_biceps_short_r', 'front_shoulder_anterior_r', 'front_forearms_r'],
  },
  {
    id: 'front_biceps_short_l',
    muscle: 'biceps',
    subdivision: 'short_head',
    side: 'left',
    x: 52,
    y: 88,
    w: 10,
    h: 28,
    rx: 5,
    rotation: -10,
    depth: 6,
    adjacentRegions: ['front_biceps_long_l', 'front_chest_upper_l', 'front_forearms_l'],
  },
  {
    id: 'front_biceps_short_r',
    muscle: 'biceps',
    subdivision: 'short_head',
    side: 'right',
    x: 138,
    y: 88,
    w: 10,
    h: 28,
    rx: 5,
    rotation: 10,
    depth: 6,
    adjacentRegions: ['front_biceps_long_r', 'front_chest_upper_r', 'front_forearms_r'],
  },

  // Forearms (2 regions)
  {
    id: 'front_forearms_l',
    muscle: 'forearms',
    side: 'left',
    x: 34,
    y: 132,
    w: 14,
    h: 44,
    rx: 7,
    rotation: -10,
    depth: 7,
    adjacentRegions: ['front_biceps_long_l', 'front_biceps_short_l'],
  },
  {
    id: 'front_forearms_r',
    muscle: 'forearms',
    side: 'right',
    x: 152,
    y: 132,
    w: 14,
    h: 44,
    rx: 7,
    rotation: 10,
    depth: 7,
    adjacentRegions: ['front_biceps_long_r', 'front_biceps_short_r'],
  },

  // Abdominals subdivisions (3 regions)
  {
    id: 'front_abs_upper',
    muscle: 'abdominals',
    subdivision: 'upper',
    x: 84,
    y: 108,
    w: 32,
    h: 20,
    rx: 10,
    rotation: 0,
    depth: 2,
    adjacentRegions: ['front_abs_middle', 'front_chest_lower_l', 'front_chest_lower_r', 'front_obliques_l', 'front_obliques_r'],
  },
  {
    id: 'front_abs_middle',
    muscle: 'abdominals',
    subdivision: 'middle',
    x: 84,
    y: 128,
    w: 32,
    h: 22,
    rx: 10,
    rotation: 0,
    depth: 2,
    adjacentRegions: ['front_abs_upper', 'front_abs_lower', 'front_obliques_l', 'front_obliques_r'],
  },
  {
    id: 'front_abs_lower',
    muscle: 'abdominals',
    subdivision: 'lower',
    x: 84,
    y: 150,
    w: 32,
    h: 24,
    rx: 10,
    rotation: 0,
    depth: 2,
    adjacentRegions: ['front_abs_middle', 'front_obliques_l', 'front_obliques_r'],
  },

  // Obliques (2 regions)
  {
    id: 'front_obliques_l',
    muscle: 'obliques',
    side: 'left',
    x: 66,
    y: 112,
    w: 14,
    h: 60,
    rx: 8,
    rotation: -10,
    depth: 1,
    adjacentRegions: ['front_abs_upper', 'front_abs_middle', 'front_abs_lower', 'front_serratus_l'],
  },
  {
    id: 'front_obliques_r',
    muscle: 'obliques',
    side: 'right',
    x: 120,
    y: 112,
    w: 14,
    h: 60,
    rx: 8,
    rotation: 10,
    depth: 1,
    adjacentRegions: ['front_abs_upper', 'front_abs_middle', 'front_abs_lower', 'front_serratus_r'],
  },

  // Serratus (2 regions)
  {
    id: 'front_serratus_l',
    muscle: 'serratus',
    side: 'left',
    x: 60,
    y: 96,
    w: 10,
    h: 28,
    rx: 5,
    rotation: -15,
    depth: 4,
    adjacentRegions: ['front_obliques_l', 'front_chest_middle_l'],
  },
  {
    id: 'front_serratus_r',
    muscle: 'serratus',
    side: 'right',
    x: 130,
    y: 96,
    w: 10,
    h: 28,
    rx: 5,
    rotation: 15,
    depth: 4,
    adjacentRegions: ['front_obliques_r', 'front_chest_middle_r'],
  },

  // Quadriceps subdivisions (4 regions)
  {
    id: 'front_quads_rectus_femoris_l',
    muscle: 'quadriceps',
    subdivision: 'rectus_femoris',
    side: 'left',
    x: 80,
    y: 194,
    w: 14,
    h: 90,
    rx: 7,
    rotation: -4,
    depth: 5,
    adjacentRegions: ['front_quads_vastus_lateralis_l', 'front_quads_rectus_femoris_r'],
  },
  {
    id: 'front_quads_rectus_femoris_r',
    muscle: 'quadriceps',
    subdivision: 'rectus_femoris',
    side: 'right',
    x: 106,
    y: 194,
    w: 14,
    h: 90,
    rx: 7,
    rotation: 4,
    depth: 5,
    adjacentRegions: ['front_quads_vastus_lateralis_r', 'front_quads_rectus_femoris_l'],
  },
  {
    id: 'front_quads_vastus_lateralis_l',
    muscle: 'quadriceps',
    subdivision: 'vastus_lateralis',
    side: 'left',
    x: 68,
    y: 198,
    w: 12,
    h: 86,
    rx: 6,
    rotation: -8,
    depth: 6,
    adjacentRegions: ['front_quads_rectus_femoris_l'],
  },
  {
    id: 'front_quads_vastus_lateralis_r',
    muscle: 'quadriceps',
    subdivision: 'vastus_lateralis',
    side: 'right',
    x: 120,
    y: 198,
    w: 12,
    h: 86,
    rx: 6,
    rotation: 8,
    depth: 6,
    adjacentRegions: ['front_quads_rectus_femoris_r'],
  },

  // Calves (2 regions)
  {
    id: 'front_calves_l',
    muscle: 'calves',
    side: 'left',
    x: 79,
    y: 286,
    w: 15,
    h: 34,
    rx: 10,
    rotation: -2,
    depth: 7,
    adjacentRegions: ['front_calves_r'],
  },
  {
    id: 'front_calves_r',
    muscle: 'calves',
    side: 'right',
    x: 106,
    y: 286,
    w: 15,
    h: 34,
    rx: 10,
    rotation: 2,
    depth: 7,
    adjacentRegions: ['front_calves_l'],
  },
];

/**
 * BACK_REGIONS - 26 subdivided muscle regions for back view
 * 
 * Anatomical organization:
 * - Traps: upper/middle/lower (3 regions)
 * - Shoulders: posterior × L/R (2 regions)
 * - Triceps: long/lateral/medial × L/R (6 regions)
 * - Middle Back: rhomboids/mid_traps (2 regions)
 * - Lats: upper/middle/lower × L/R (6 regions)
 * - Lower Back: erectors × L/R (2 regions)
 * - Glutes: maximus × L/R (2 regions)
 * - Hamstrings: L/R (2 regions)
 * - Calves: L/R (2 regions)
 */
export const BACK_REGIONS: MuscleRegion[] = [
  // Trapezius subdivisions (3 regions)
  {
    id: 'back_traps_upper',
    muscle: 'traps',
    subdivision: 'upper',
    x: 84,
    y: 54,
    w: 32,
    h: 16,
    rx: 10,
    rotation: 0,
    depth: 4,
    adjacentRegions: ['back_traps_middle', 'back_shoulder_posterior_l', 'back_shoulder_posterior_r'],
  },
  {
    id: 'back_traps_middle',
    muscle: 'traps',
    subdivision: 'middle',
    x: 86,
    y: 70,
    w: 28,
    h: 18,
    rx: 9,
    rotation: 0,
    depth: 3,
    adjacentRegions: ['back_traps_upper', 'back_traps_lower', 'back_middle_rhomboids'],
  },
  {
    id: 'back_traps_lower',
    muscle: 'traps',
    subdivision: 'lower',
    x: 88,
    y: 88,
    w: 24,
    h: 14,
    rx: 8,
    rotation: 0,
    depth: 3,
    adjacentRegions: ['back_traps_middle', 'back_middle_rhomboids', 'back_lats_upper_l', 'back_lats_upper_r'],
  },

  // Shoulder posterior (2 regions)
  {
    id: 'back_shoulder_posterior_l',
    muscle: 'shoulders',
    subdivision: 'posterior',
    side: 'left',
    x: 54,
    y: 54,
    w: 18,
    h: 16,
    rx: 9,
    rotation: -12,
    depth: 5,
    adjacentRegions: ['back_traps_upper', 'back_triceps_long_l', 'back_lats_upper_l'],
  },
  {
    id: 'back_shoulder_posterior_r',
    muscle: 'shoulders',
    subdivision: 'posterior',
    side: 'right',
    x: 128,
    y: 54,
    w: 18,
    h: 16,
    rx: 9,
    rotation: 12,
    depth: 5,
    adjacentRegions: ['back_traps_upper', 'back_triceps_long_r', 'back_lats_upper_r'],
  },

  // Triceps subdivisions (6 regions)
  {
    id: 'back_triceps_long_l',
    muscle: 'triceps',
    subdivision: 'long_head',
    side: 'left',
    x: 42,
    y: 84,
    w: 10,
    h: 32,
    rx: 5,
    rotation: -14,
    depth: 6,
    adjacentRegions: ['back_triceps_lateral_l', 'back_shoulder_posterior_l'],
  },
  {
    id: 'back_triceps_long_r',
    muscle: 'triceps',
    subdivision: 'long_head',
    side: 'right',
    x: 148,
    y: 84,
    w: 10,
    h: 32,
    rx: 5,
    rotation: 14,
    depth: 6,
    adjacentRegions: ['back_triceps_lateral_r', 'back_shoulder_posterior_r'],
  },
  {
    id: 'back_triceps_lateral_l',
    muscle: 'triceps',
    subdivision: 'lateral_head',
    side: 'left',
    x: 52,
    y: 88,
    w: 9,
    h: 28,
    rx: 4,
    rotation: -10,
    depth: 7,
    adjacentRegions: ['back_triceps_long_l', 'back_triceps_medial_l'],
  },
  {
    id: 'back_triceps_lateral_r',
    muscle: 'triceps',
    subdivision: 'lateral_head',
    side: 'right',
    x: 139,
    y: 88,
    w: 9,
    h: 28,
    rx: 4,
    rotation: 10,
    depth: 7,
    adjacentRegions: ['back_triceps_long_r', 'back_triceps_medial_r'],
  },
  {
    id: 'back_triceps_medial_l',
    muscle: 'triceps',
    subdivision: 'medial_head',
    side: 'left',
    x: 48,
    y: 96,
    w: 8,
    h: 24,
    rx: 4,
    rotation: -8,
    depth: 8,
    adjacentRegions: ['back_triceps_lateral_l'],
  },
  {
    id: 'back_triceps_medial_r',
    muscle: 'triceps',
    subdivision: 'medial_head',
    side: 'right',
    x: 144,
    y: 96,
    w: 8,
    h: 24,
    rx: 4,
    rotation: 8,
    depth: 8,
    adjacentRegions: ['back_triceps_lateral_r'],
  },

  // Middle back (2 regions)
  {
    id: 'back_middle_rhomboids',
    muscle: 'middle back',
    subdivision: 'rhomboids',
    x: 82,
    y: 82,
    w: 36,
    h: 28,
    rx: 10,
    rotation: 0,
    depth: 2,
    adjacentRegions: ['back_traps_middle', 'back_traps_lower', 'back_lats_upper_l', 'back_lats_upper_r'],
  },
  {
    id: 'back_middle_mid_traps',
    muscle: 'middle back',
    subdivision: 'mid_traps',
    x: 84,
    y: 76,
    w: 32,
    h: 20,
    rx: 9,
    rotation: 0,
    depth: 3,
    adjacentRegions: ['back_traps_middle', 'back_middle_rhomboids'],
  },

  // Latissimus dorsi subdivisions (6 regions)
  {
    id: 'back_lats_upper_l',
    muscle: 'lats',
    subdivision: 'upper',
    side: 'left',
    x: 58,
    y: 96,
    w: 20,
    h: 28,
    rx: 10,
    rotation: -8,
    depth: 1,
    adjacentRegions: ['back_lats_middle_l', 'back_traps_lower', 'back_middle_rhomboids'],
  },
  {
    id: 'back_lats_upper_r',
    muscle: 'lats',
    subdivision: 'upper',
    side: 'right',
    x: 122,
    y: 96,
    w: 20,
    h: 28,
    rx: 10,
    rotation: 8,
    depth: 1,
    adjacentRegions: ['back_lats_middle_r', 'back_traps_lower', 'back_middle_rhomboids'],
  },
  {
    id: 'back_lats_middle_l',
    muscle: 'lats',
    subdivision: 'middle',
    side: 'left',
    x: 56,
    y: 124,
    w: 22,
    h: 32,
    rx: 11,
    rotation: -6,
    depth: 1,
    adjacentRegions: ['back_lats_upper_l', 'back_lats_lower_l'],
  },
  {
    id: 'back_lats_middle_r',
    muscle: 'lats',
    subdivision: 'middle',
    side: 'right',
    x: 122,
    y: 124,
    w: 22,
    h: 32,
    rx: 11,
    rotation: 6,
    depth: 1,
    adjacentRegions: ['back_lats_upper_r', 'back_lats_lower_r'],
  },
  {
    id: 'back_lats_lower_l',
    muscle: 'lats',
    subdivision: 'lower',
    side: 'left',
    x: 60,
    y: 156,
    w: 20,
    h: 24,
    rx: 10,
    rotation: -4,
    depth: 1,
    adjacentRegions: ['back_lats_middle_l', 'back_lower_erectors_l'],
  },
  {
    id: 'back_lats_lower_r',
    muscle: 'lats',
    subdivision: 'lower',
    side: 'right',
    x: 120,
    y: 156,
    w: 20,
    h: 24,
    rx: 10,
    rotation: 4,
    depth: 1,
    adjacentRegions: ['back_lats_middle_r', 'back_lower_erectors_r'],
  },

  // Lower back erectors (2 regions)
  {
    id: 'back_lower_erectors_l',
    muscle: 'lower back',
    subdivision: 'erectors',
    side: 'left',
    x: 84,
    y: 144,
    w: 16,
    h: 34,
    rx: 8,
    rotation: 0,
    depth: 2,
    adjacentRegions: ['back_lower_erectors_r', 'back_lats_lower_l', 'back_glutes_maximus_l'],
  },
  {
    id: 'back_lower_erectors_r',
    muscle: 'lower back',
    subdivision: 'erectors',
    side: 'right',
    x: 100,
    y: 144,
    w: 16,
    h: 34,
    rx: 8,
    rotation: 0,
    depth: 2,
    adjacentRegions: ['back_lower_erectors_l', 'back_lats_lower_r', 'back_glutes_maximus_r'],
  },

  // Glutes (2 regions)
  {
    id: 'back_glutes_maximus_l',
    muscle: 'glutes',
    subdivision: 'maximus',
    side: 'left',
    x: 76,
    y: 184,
    w: 24,
    h: 30,
    rx: 11,
    rotation: -2,
    depth: 3,
    adjacentRegions: ['back_glutes_maximus_r', 'back_lower_erectors_l', 'back_hamstrings_l'],
  },
  {
    id: 'back_glutes_maximus_r',
    muscle: 'glutes',
    subdivision: 'maximus',
    side: 'right',
    x: 100,
    y: 184,
    w: 24,
    h: 30,
    rx: 11,
    rotation: 2,
    depth: 3,
    adjacentRegions: ['back_glutes_maximus_l', 'back_lower_erectors_r', 'back_hamstrings_r'],
  },

  // Hamstrings (2 regions)
  {
    id: 'back_hamstrings_l',
    muscle: 'hamstrings',
    side: 'left',
    x: 76,
    y: 216,
    w: 22,
    h: 68,
    rx: 11,
    rotation: -5,
    depth: 4,
    adjacentRegions: ['back_hamstrings_r', 'back_glutes_maximus_l', 'back_calves_l'],
  },
  {
    id: 'back_hamstrings_r',
    muscle: 'hamstrings',
    side: 'right',
    x: 102,
    y: 216,
    w: 22,
    h: 68,
    rx: 11,
    rotation: 5,
    depth: 4,
    adjacentRegions: ['back_hamstrings_l', 'back_glutes_maximus_r', 'back_calves_r'],
  },

  // Calves (2 regions)
  {
    id: 'back_calves_l',
    muscle: 'calves',
    side: 'left',
    x: 81,
    y: 287,
    w: 14,
    h: 33,
    rx: 10,
    rotation: -2,
    depth: 5,
    adjacentRegions: ['back_calves_r', 'back_hamstrings_l'],
  },
  {
    id: 'back_calves_r',
    muscle: 'calves',
    side: 'right',
    x: 105,
    y: 287,
    w: 14,
    h: 33,
    rx: 10,
    rotation: 2,
    depth: 5,
    adjacentRegions: ['back_calves_l', 'back_hamstrings_r'],
  },
];

/**
 * SIDE_REGIONS - Lateral profile regions for optional side-view rendering.
 *
 * These regions are intentionally not included in ALL_REGIONS to avoid
 * changing activation score normalization for existing front/back views.
 */
export const SIDE_REGIONS: SideMuscleRegion[] = [
  {
    id: 'side_delts',
    muscle: 'shoulders',
    subdivision: 'lateral',
    side: 'left',
    x: 82,
    y: 54,
    w: 18,
    h: 16,
    rx: 8,
    rotation: 8,
    depth: 6,
    adjacentRegions: ['side_triceps', 'side_serratus'],
  },
  {
    id: 'side_triceps',
    muscle: 'triceps',
    side: 'left',
    x: 88,
    y: 82,
    w: 12,
    h: 36,
    rx: 6,
    rotation: 10,
    depth: 6,
    adjacentRegions: ['side_delts', 'side_forearms'],
  },
  {
    id: 'side_biceps',
    muscle: 'biceps',
    side: 'left',
    x: 74,
    y: 86,
    w: 10,
    h: 32,
    rx: 5,
    rotation: 10,
    depth: 7,
    adjacentRegions: ['side_forearms', 'side_chest'],
  },
  {
    id: 'side_forearms',
    muscle: 'forearms',
    side: 'left',
    x: 84,
    y: 120,
    w: 10,
    h: 42,
    rx: 5,
    rotation: 8,
    depth: 7,
    adjacentRegions: ['side_biceps', 'side_triceps'],
  },
  {
    id: 'side_chest',
    muscle: 'chest',
    subdivision: 'middle',
    side: 'left',
    x: 74,
    y: 76,
    w: 20,
    h: 18,
    rx: 9,
    rotation: 4,
    depth: 4,
    adjacentRegions: ['side_serratus', 'side_abs'],
  },
  {
    id: 'side_serratus',
    muscle: 'serratus',
    side: 'left',
    x: 92,
    y: 96,
    w: 10,
    h: 22,
    rx: 5,
    rotation: 20,
    depth: 5,
    adjacentRegions: ['side_obliques', 'side_chest'],
  },
  {
    id: 'side_obliques',
    muscle: 'obliques',
    side: 'left',
    x: 88,
    y: 118,
    w: 12,
    h: 52,
    rx: 6,
    rotation: 12,
    depth: 4,
    adjacentRegions: ['side_abs', 'side_serratus'],
  },
  {
    id: 'side_abs',
    muscle: 'abdominals',
    subdivision: 'middle',
    side: 'left',
    x: 76,
    y: 110,
    w: 14,
    h: 56,
    rx: 7,
    rotation: 4,
    depth: 3,
    adjacentRegions: ['side_obliques', 'side_quads'],
  },
  {
    id: 'side_lats',
    muscle: 'lats',
    subdivision: 'middle',
    side: 'left',
    x: 96,
    y: 98,
    w: 16,
    h: 54,
    rx: 8,
    rotation: 6,
    depth: 2,
    adjacentRegions: ['side_lower_back', 'side_obliques'],
  },
  {
    id: 'side_lower_back',
    muscle: 'lower back',
    side: 'left',
    x: 100,
    y: 146,
    w: 14,
    h: 28,
    rx: 7,
    rotation: 4,
    depth: 2,
    adjacentRegions: ['side_lats', 'side_glutes'],
  },
  {
    id: 'side_glutes',
    muscle: 'glutes',
    side: 'left',
    x: 92,
    y: 182,
    w: 22,
    h: 28,
    rx: 10,
    rotation: 6,
    depth: 4,
    adjacentRegions: ['side_hamstrings', 'side_lower_back'],
  },
  {
    id: 'side_hamstrings',
    muscle: 'hamstrings',
    side: 'left',
    x: 94,
    y: 214,
    w: 18,
    h: 68,
    rx: 8,
    rotation: 4,
    depth: 4,
    adjacentRegions: ['side_calves', 'side_glutes'],
  },
  {
    id: 'side_quads',
    muscle: 'quadriceps',
    side: 'left',
    x: 78,
    y: 198,
    w: 16,
    h: 84,
    rx: 8,
    rotation: 2,
    depth: 5,
    adjacentRegions: ['side_abs', 'side_calves'],
  },
  {
    id: 'side_calves',
    muscle: 'calves',
    side: 'left',
    x: 98,
    y: 286,
    w: 12,
    h: 34,
    rx: 8,
    rotation: 2,
    depth: 5,
    adjacentRegions: ['side_hamstrings', 'side_quads'],
  },
];

/**
 * ALL_REGIONS - Combined array of all 54 muscle regions
 */
export const ALL_REGIONS: MuscleRegion[] = [...FRONT_REGIONS, ...BACK_REGIONS];
const ALL_LOOKUP_REGIONS: MuscleRegion[] = [...ALL_REGIONS, ...SIDE_REGIONS];

/**
 * Helper function to get a region by ID
 */
export function getRegionById(regionId: string): MuscleRegion | undefined {
  return ALL_LOOKUP_REGIONS.find(region => region.id === regionId);
}

/**
 * Helper function to get all regions for a specific muscle
 */
export function getRegionsByMuscle(muscleName: string): MuscleRegion[] {
  return ALL_REGIONS.filter(region => region.muscle === muscleName);
}

/**
 * Helper function to get all regions for a specific view
 */
export function getRegionsByView(view: 'front' | 'back' | 'side'): MuscleRegion[] {
  if (view === 'front') return FRONT_REGIONS;
  if (view === 'back') return BACK_REGIONS;
  return SIDE_REGIONS;
}

/**
 * Helper function to get adjacent regions for a given region ID
 */
export function getAdjacentRegions(regionId: string): MuscleRegion[] {
  const region = getRegionById(regionId);
  if (!region) return [];
  
  return region.adjacentRegions
    .map(adjId => getRegionById(adjId))
    .filter((r): r is MuscleRegion => r !== undefined);
}

/**
 * Region count validation
 */
export const REGION_COUNTS = {
  front: FRONT_REGIONS.length,
  back: BACK_REGIONS.length,
  total: ALL_REGIONS.length,
};

// Verify we have the expected 56 regions (29 front + 27 back)
if (REGION_COUNTS.total !== 56) {
  console.warn(
    `Expected 56 total regions, but found ${REGION_COUNTS.total} ` +
    `(${REGION_COUNTS.front} front + ${REGION_COUNTS.back} back)`
  );
}
