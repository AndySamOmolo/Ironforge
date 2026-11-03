'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play, Flame, ShieldCheck, Scale, Sparkles, Activity } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { ALL_EQUIPMENT, generateSmartWorkout, resolveWorkoutDayExercises } from '@/lib/utils/exerciseResolver';
import { calculateRecoveryPercentage } from '@/lib/activation/RecoveryTracker';
import { MUSCLE_COLORS, SetType, type WorkoutSession } from '@/lib/types';

type MuscleHeatmapProps = {
  sessions: WorkoutSession[];
};

type TimeRange = '7d' | '30d' | 'all';
type MapMode = 'activation' | 'recovery' | 'balance';
type ViewFilter = 'both' | 'front' | 'back';

interface AnatomicalMusclePart {
  id: string;
  muscle: string;
  headLabel: string;
  latinName: string;
  view: 'front' | 'back';
  d: string;
  fibers?: string;
}

const MUSCLE_METADATA: Record<
  string,
  { latin: string; role: string; heads: string[] }
> = {
  chest: {
    latin: 'Pectoralis Major & Minor',
    role: 'Horizontal pressing, humeral adduction & internal rotation',
    heads: ['Clavicular (Upper)', 'Sternocostal (Middle)', 'Costal (Lower)'],
  },
  shoulders: {
    latin: 'Deltoideus (Anterior, Lateral, Posterior)',
    role: 'Overhead pressing, shoulder abduction & rear-delt stabilization',
    heads: ['Anterior Deltoid', 'Lateral Deltoid Cap', 'Posterior Deltoid'],
  },
  biceps: {
    latin: 'Biceps Brachii & Brachialis',
    role: 'Elbow flexion & forearm supination',
    heads: ['Long Head (Outer Peak)', 'Short Head (Inner)', 'Brachialis'],
  },
  triceps: {
    latin: 'Triceps Brachii',
    role: 'Elbow extension & shoulder stability in pressing',
    heads: ['Lateral Head (Horseshoe)', 'Long Head', 'Medial Head'],
  },
  forearms: {
    latin: 'Brachioradialis & Flexor/Extensor Carpi',
    role: 'Grip crushing strength, wrist flexion & extension',
    heads: ['Brachioradialis', 'Wrist Flexors', 'Wrist Extensors'],
  },
  abdominals: {
    latin: 'Rectus Abdominis & Transversus',
    role: 'Spinal flexion, anti-extension & intra-abdominal bracing',
    heads: ['Upper Epigastric', 'Middle Umbilical', 'Lower Hypogastric'],
  },
  obliques: {
    latin: 'Obliquus Externus & Internus + Serratus',
    role: 'Trunk rotation, lateral flexion & ribcage protraction',
    heads: ['External Obliques', 'Serratus Anterior'],
  },
  traps: {
    latin: 'Trapezius (Upper, Middle, Lower)',
    role: 'Scapular elevation, retraction & upward rotation',
    heads: ['Upper Fibers', 'Middle Fibers', 'Lower Fibers'],
  },
  lats: {
    latin: 'Latissimus Dorsi & Teres Major',
    role: 'Vertical pulling, shoulder extension & V-taper width',
    heads: ['Upper Axillary Wing', 'Middle Sweep', 'Lower Thoracolumbar'],
  },
  'middle back': {
    latin: 'Rhomboideus Major/Minor & Infraspinatus',
    role: 'Scapular retraction, horizontal rowing & upper-back thickness',
    heads: ['Rhomboids', 'Infraspinatus & Teres Minor'],
  },
  'lower back': {
    latin: 'Erector Spinae (Iliocostalis & Longissimus)',
    role: 'Spinal extension, posture & posterior-chain rigidity',
    heads: ['Lumbar Erectors (Left & Right)'],
  },
  glutes: {
    latin: 'Gluteus Maximus & Gluteus Medius',
    role: 'Hip extension, external rotation & pelvic stabilization',
    heads: ['Gluteus Maximus', 'Gluteus Medius (Upper Shelf)'],
  },
  quadriceps: {
    latin: 'Quadriceps Femoris & Adductors',
    role: 'Knee extension, squatting power & hip flexion',
    heads: ['Rectus Femoris', 'Vastus Lateralis (Sweep)', 'Vastus Medialis (VMO Teardrop)', 'Adductors'],
  },
  hamstrings: {
    latin: 'Biceps Femoris, Semitendinosus & Semimembranosus',
    role: 'Hip hinge extension & knee flexion',
    heads: ['Biceps Femoris (Lateral)', 'Semitendinosus / Semimembranosus (Medial)'],
  },
  calves: {
    latin: 'Gastrocnemius, Soleus & Tibialis Anterior',
    role: 'Ankle plantarflexion, dorsiflexion & explosive propulsion',
    heads: ['Gastrocnemius Medial/Lateral', 'Soleus', 'Tibialis Anterior'],
  },
};

/**
 * High-precision sculpted anatomical SVG paths (viewBox="0 0 220 420", midline x = 110)
 */
const FRONT_ANATOMY_PARTS: AnatomicalMusclePart[] = [
  // Sternocleidomastoid & Upper Traps Collar
  {
    id: 'front_traps_l',
    muscle: 'traps',
    headLabel: 'Upper Trapezius & Neck (L)',
    latinName: 'Trapezius Descendens',
    view: 'front',
    d: 'M 97 52 C 92 58, 82 65, 69 70 L 86 73 C 94 69, 98 62, 101 54 Z',
    fibers: 'M 96 56 L 76 69 M 99 59 L 84 71',
  },
  {
    id: 'front_traps_r',
    muscle: 'traps',
    headLabel: 'Upper Trapezius & Neck (R)',
    latinName: 'Trapezius Descendens',
    view: 'front',
    d: 'M 123 52 C 128 58, 138 65, 151 70 L 134 73 C 126 69, 122 62, 119 54 Z',
    fibers: 'M 124 56 L 144 69 M 121 59 L 136 71',
  },

  // Anterior & Lateral Deltoids
  {
    id: 'front_shoulder_lateral_l',
    muscle: 'shoulders',
    headLabel: 'Lateral Deltoid (L)',
    latinName: 'Deltoideus Pars Acromialis',
    view: 'front',
    d: 'M 68 70 C 54 73, 46 84, 46 99 C 46 108, 50 115, 55 119 C 56 106, 61 90, 71 78 Z',
    fibers: 'M 64 75 C 54 84, 50 98, 53 113 M 60 80 C 52 90, 50 102, 54 115',
  },
  {
    id: 'front_shoulder_lateral_r',
    muscle: 'shoulders',
    headLabel: 'Lateral Deltoid (R)',
    latinName: 'Deltoideus Pars Acromialis',
    view: 'front',
    d: 'M 152 70 C 166 73, 174 84, 174 99 C 174 108, 170 115, 165 119 C 164 106, 159 90, 149 78 Z',
    fibers: 'M 156 75 C 166 84, 170 98, 167 113 M 160 80 C 168 90, 170 102, 166 115',
  },
  {
    id: 'front_shoulder_anterior_l',
    muscle: 'shoulders',
    headLabel: 'Anterior Deltoid (L)',
    latinName: 'Deltoideus Pars Clavicularis',
    view: 'front',
    d: 'M 71 71 C 62 80, 56 96, 55 116 C 61 114, 67 104, 73 91 C 76 83, 77 75, 71 71 Z',
    fibers: 'M 70 75 C 63 86, 60 99, 58 111 M 73 80 C 67 90, 63 101, 61 110',
  },
  {
    id: 'front_shoulder_anterior_r',
    muscle: 'shoulders',
    headLabel: 'Anterior Deltoid (R)',
    latinName: 'Deltoideus Pars Clavicularis',
    view: 'front',
    d: 'M 149 71 C 158 80, 164 96, 165 116 C 159 114, 153 104, 147 91 C 144 83, 143 75, 149 71 Z',
    fibers: 'M 150 75 C 157 86, 160 99, 162 111 M 147 80 C 153 90, 157 101, 159 110',
  },

  // Pectoralis Major — Clavicular (Upper), Sternocostal (Mid), Costal (Lower)
  {
    id: 'front_chest_upper_l',
    muscle: 'chest',
    headLabel: 'Upper Chest — Clavicular (L)',
    latinName: 'Pectoralis Major Pars Clavicularis',
    view: 'front',
    d: 'M 74 73 C 84 71, 97 72, 108 75 L 108 88 C 95 87, 81 89, 68 94 C 69 85, 71 78, 74 73 Z',
    fibers: 'M 106 78 C 94 77, 82 80, 72 86 M 106 84 C 94 83, 81 86, 70 91',
  },
  {
    id: 'front_chest_upper_r',
    muscle: 'chest',
    headLabel: 'Upper Chest — Clavicular (R)',
    latinName: 'Pectoralis Major Pars Clavicularis',
    view: 'front',
    d: 'M 146 73 C 136 71, 123 72, 112 75 L 112 88 C 125 87, 139 89, 152 94 C 151 85, 149 78, 146 73 Z',
    fibers: 'M 114 78 C 126 77, 138 80, 148 86 M 114 84 C 126 83, 139 86, 150 91',
  },
  {
    id: 'front_chest_middle_l',
    muscle: 'chest',
    headLabel: 'Mid Chest — Sternocostal (L)',
    latinName: 'Pectoralis Major Pars Sternocostalis',
    view: 'front',
    d: 'M 68 94 C 81 89, 95 87, 108 88 L 108 106 C 95 107, 80 108, 69 105 C 67 101, 67 97, 68 94 Z',
    fibers: 'M 106 93 C 93 93, 80 95, 70 99 M 106 99 C 93 100, 81 101, 70 103',
  },
  {
    id: 'front_chest_middle_r',
    muscle: 'chest',
    headLabel: 'Mid Chest — Sternocostal (R)',
    latinName: 'Pectoralis Major Pars Sternocostalis',
    view: 'front',
    d: 'M 152 94 C 139 89, 125 87, 112 88 L 112 106 C 125 107, 140 108, 151 105 C 153 101, 153 97, 152 94 Z',
    fibers: 'M 114 93 C 127 93, 140 95, 150 99 M 114 99 C 127 100, 139 101, 150 103',
  },
  {
    id: 'front_chest_lower_l',
    muscle: 'chest',
    headLabel: 'Lower Chest — Costal Border (L)',
    latinName: 'Pectoralis Major Pars Abdominalis',
    view: 'front',
    d: 'M 69 105 C 80 108, 95 107, 108 106 L 106 115 C 95 119, 80 119, 71 113 C 69 111, 69 108, 69 105 Z',
    fibers: 'M 105 110 C 94 114, 82 114, 72 110',
  },
  {
    id: 'front_chest_lower_r',
    muscle: 'chest',
    headLabel: 'Lower Chest — Costal Border (R)',
    latinName: 'Pectoralis Major Pars Abdominalis',
    view: 'front',
    d: 'M 151 105 C 140 108, 125 107, 112 106 L 114 115 C 125 119, 140 119, 149 113 C 151 111, 151 108, 151 105 Z',
    fibers: 'M 115 110 C 126 114, 138 114, 148 110',
  },

  // Biceps Brachii (Long Head & Short Head)
  {
    id: 'front_biceps_long_l',
    muscle: 'biceps',
    headLabel: 'Biceps Long Head (L)',
    latinName: 'Biceps Brachii Caput Longum',
    view: 'front',
    d: 'M 54 116 C 47 122, 43 136, 43 151 C 43 157, 46 161, 50 162 C 53 148, 55 131, 57 116 Z',
    fibers: 'M 53 121 C 48 133, 47 146, 48 158',
  },
  {
    id: 'front_biceps_long_r',
    muscle: 'biceps',
    headLabel: 'Biceps Long Head (R)',
    latinName: 'Biceps Brachii Caput Longum',
    view: 'front',
    d: 'M 166 116 C 173 122, 177 136, 177 151 C 177 157, 174 161, 170 162 C 167 148, 165 131, 163 116 Z',
    fibers: 'M 167 121 C 172 133, 173 146, 172 158',
  },
  {
    id: 'front_biceps_short_l',
    muscle: 'biceps',
    headLabel: 'Biceps Short Head (L)',
    latinName: 'Biceps Brachii Caput Breve',
    view: 'front',
    d: 'M 57 115 C 55 131, 53 148, 50 162 C 55 163, 60 158, 62 148 C 64 137, 64 123, 57 115 Z',
    fibers: 'M 59 121 C 60 134, 59 146, 55 158',
  },
  {
    id: 'front_biceps_short_r',
    muscle: 'biceps',
    headLabel: 'Biceps Short Head (R)',
    latinName: 'Biceps Brachii Caput Breve',
    view: 'front',
    d: 'M 163 115 C 165 131, 167 148, 170 162 C 165 163, 160 158, 158 148 C 156 137, 156 123, 163 115 Z',
    fibers: 'M 161 121 C 160 134, 161 146, 165 158',
  },

  // Forearms (Brachioradialis & Flexors)
  {
    id: 'front_forearms_l',
    muscle: 'forearms',
    headLabel: 'Brachioradialis & Flexors (L)',
    latinName: 'Brachioradialis & Flexor Carpi',
    view: 'front',
    d: 'M 42 163 C 36 174, 34 192, 33 214 L 44 216 C 50 198, 56 180, 58 164 Z',
    fibers: 'M 46 167 C 41 182, 38 197, 37 212 M 53 168 C 49 183, 45 198, 42 213',
  },
  {
    id: 'front_forearms_r',
    muscle: 'forearms',
    headLabel: 'Brachioradialis & Flexors (R)',
    latinName: 'Brachioradialis & Flexor Carpi',
    view: 'front',
    d: 'M 178 163 C 184 174, 186 192, 187 214 L 176 216 C 170 198, 164 180, 162 164 Z',
    fibers: 'M 174 167 C 179 182, 182 197, 183 212 M 167 168 C 171 183, 175 198, 178 213',
  },

  // Serratus Anterior & External Obliques
  {
    id: 'front_serratus_l',
    muscle: 'obliques',
    headLabel: 'Serratus Anterior (L)',
    latinName: 'Musculus Serratus Anterior',
    view: 'front',
    d: 'M 70 114 C 76 118, 83 121, 88 124 L 86 142 C 79 139, 73 133, 69 125 Z',
    fibers: 'M 71 119 L 85 126 M 71 125 L 85 133 M 72 131 L 84 139',
  },
  {
    id: 'front_serratus_r',
    muscle: 'obliques',
    headLabel: 'Serratus Anterior (R)',
    latinName: 'Musculus Serratus Anterior',
    view: 'front',
    d: 'M 150 114 C 144 118, 137 121, 132 124 L 134 142 C 141 139, 147 133, 151 125 Z',
    fibers: 'M 149 119 L 135 126 M 149 125 L 135 133 M 148 131 L 136 139',
  },
  {
    id: 'front_obliques_l',
    muscle: 'obliques',
    headLabel: 'External Obliques (L)',
    latinName: 'Musculus Obliquus Externus',
    view: 'front',
    d: 'M 72 140 C 78 143, 85 146, 90 150 L 92 194 C 83 190, 76 181, 74 168 Z',
    fibers: 'M 75 148 L 89 160 M 75 159 L 90 172 M 76 171 L 90 184',
  },
  {
    id: 'front_obliques_r',
    muscle: 'obliques',
    headLabel: 'External Obliques (R)',
    latinName: 'Musculus Obliquus Externus',
    view: 'front',
    d: 'M 148 140 C 142 143, 135 146, 130 150 L 128 194 C 137 190, 144 181, 146 168 Z',
    fibers: 'M 145 148 L 131 160 M 145 159 L 130 172 M 144 171 L 130 184',
  },

  // Rectus Abdominis (Sculpted 6-Pack Segments)
  {
    id: 'front_abs_upper',
    muscle: 'abdominals',
    headLabel: 'Upper Abdominals',
    latinName: 'Rectus Abdominis Superior',
    view: 'front',
    d: 'M 92 118 C 98 115, 104 115, 108 118 L 108 142 C 102 143, 95 142, 91 139 Z M 128 118 C 122 115, 116 115, 112 118 L 112 142 C 118 143, 125 142, 129 139 Z',
    fibers: 'M 92 130 L 108 131 M 112 131 L 128 130',
  },
  {
    id: 'front_abs_middle',
    muscle: 'abdominals',
    headLabel: 'Middle Abdominals',
    latinName: 'Rectus Abdominis Medius',
    view: 'front',
    d: 'M 91 144 L 108 145 L 108 168 L 92 166 Z M 129 144 L 112 145 L 112 168 L 128 166 Z',
    fibers: 'M 92 156 L 108 157 M 112 157 L 128 156',
  },
  {
    id: 'front_abs_lower',
    muscle: 'abdominals',
    headLabel: 'Lower Abdominals',
    latinName: 'Rectus Abdominis Inferior',
    view: 'front',
    d: 'M 92 170 L 108 171 L 108 202 C 100 200, 95 193, 92 170 Z M 128 170 L 112 171 L 112 202 C 120 200, 125 193, 128 170 Z',
    fibers: 'M 95 184 L 108 185 M 112 185 L 125 184',
  },

  // Quadriceps Femoris: Vastus Lateralis (Sweep), Rectus Femoris, Vastus Medialis (VMO), Adductors
  {
    id: 'front_quads_lateralis_l',
    muscle: 'quadriceps',
    headLabel: 'Vastus Lateralis — Quad Sweep (L)',
    latinName: 'Musculus Vastus Lateralis',
    view: 'front',
    d: 'M 73 198 C 63 218, 60 248, 65 282 C 68 292, 72 298, 76 300 C 74 270, 75 232, 82 202 Z',
    fibers: 'M 76 208 C 68 232, 66 258, 71 286 M 79 218 C 72 240, 70 264, 74 290',
  },
  {
    id: 'front_quads_lateralis_r',
    muscle: 'quadriceps',
    headLabel: 'Vastus Lateralis — Quad Sweep (R)',
    latinName: 'Musculus Vastus Lateralis',
    view: 'front',
    d: 'M 147 198 C 157 218, 160 248, 155 282 C 152 292, 148 298, 144 300 C 146 270, 145 232, 138 202 Z',
    fibers: 'M 144 208 C 152 232, 154 258, 149 286 M 141 218 C 148 240, 150 264, 146 290',
  },
  {
    id: 'front_quads_rectus_l',
    muscle: 'quadriceps',
    headLabel: 'Rectus Femoris — Center Quad (L)',
    latinName: 'Musculus Rectus Femoris',
    view: 'front',
    d: 'M 83 200 C 77 228, 75 264, 78 298 L 88 298 C 91 264, 92 228, 91 202 Z',
    fibers: 'M 85 206 L 80 248 M 85 206 L 89 248 M 84 236 L 79 278 M 84 236 L 88 278',
  },
  {
    id: 'front_quads_rectus_r',
    muscle: 'quadriceps',
    headLabel: 'Rectus Femoris — Center Quad (R)',
    latinName: 'Musculus Rectus Femoris',
    view: 'front',
    d: 'M 137 200 C 143 228, 145 264, 142 298 L 132 298 C 129 264, 128 228, 129 202 Z',
    fibers: 'M 135 206 L 140 248 M 135 206 L 131 248 M 136 236 L 141 278 M 136 236 L 132 278',
  },
  {
    id: 'front_quads_medialis_l',
    muscle: 'quadriceps',
    headLabel: 'Vastus Medialis — VMO Teardrop (L)',
    latinName: 'Musculus Vastus Medialis Obliquus',
    view: 'front',
    d: 'M 92 246 C 97 256, 102 272, 100 292 C 98 302, 92 306, 87 302 C 87 284, 89 264, 92 246 Z',
    fibers: 'M 91 258 C 96 268, 97 282, 93 296 M 89 270 C 94 278, 95 289, 90 299',
  },
  {
    id: 'front_quads_medialis_r',
    muscle: 'quadriceps',
    headLabel: 'Vastus Medialis — VMO Teardrop (R)',
    latinName: 'Musculus Vastus Medialis Obliquus',
    view: 'front',
    d: 'M 128 246 C 123 256, 118 272, 120 292 C 122 302, 128 306, 133 302 C 133 284, 131 264, 128 246 Z',
    fibers: 'M 129 258 C 124 268, 123 282, 127 296 M 131 270 C 126 278, 125 289, 130 299',
  },
  {
    id: 'front_adductors_l',
    muscle: 'quadriceps',
    headLabel: 'Inner Thigh Adductors & Sartorius (L)',
    latinName: 'Adductor Longus & Gracilis',
    view: 'front',
    d: 'M 92 203 L 105 212 C 104 230, 101 248, 93 254 C 91 236, 91 218, 92 203 Z',
    fibers: 'M 102 216 L 93 242',
  },
  {
    id: 'front_adductors_r',
    muscle: 'quadriceps',
    headLabel: 'Inner Thigh Adductors & Sartorius (R)',
    latinName: 'Adductor Longus & Gracilis',
    view: 'front',
    d: 'M 128 203 L 115 212 C 116 230, 119 248, 127 254 C 129 236, 129 218, 128 203 Z',
    fibers: 'M 118 216 L 127 242',
  },

  // Calves / Tibialis Anterior (Front Lower Leg)
  {
    id: 'front_calves_l',
    muscle: 'calves',
    headLabel: 'Tibialis Anterior & Medial Calf (L)',
    latinName: 'Tibialis Anterior & Gastrocnemius',
    view: 'front',
    d: 'M 73 320 C 67 338, 68 364, 74 388 L 88 388 C 94 364, 96 340, 91 320 Z',
    fibers: 'M 77 326 C 73 346, 74 366, 77 384 M 87 326 C 91 344, 90 364, 85 384',
  },
  {
    id: 'front_calves_r',
    muscle: 'calves',
    headLabel: 'Tibialis Anterior & Medial Calf (R)',
    latinName: 'Tibialis Anterior & Gastrocnemius',
    view: 'front',
    d: 'M 147 320 C 153 338, 152 364, 146 388 L 132 388 C 126 364, 124 340, 129 320 Z',
    fibers: 'M 143 326 C 147 346, 146 366, 143 384 M 133 326 C 129 344, 130 364, 135 384',
  },
];

const BACK_ANATOMY_PARTS: AnatomicalMusclePart[] = [
  // Trapezius — Upper, Middle, Lower Diamond
  {
    id: 'back_traps_upper',
    muscle: 'traps',
    headLabel: 'Upper Trapezius',
    latinName: 'Trapezius Pars Descendens',
    view: 'back',
    d: 'M 98 46 L 122 46 C 129 58, 140 66, 154 71 L 132 76 L 110 74 L 88 76 L 66 71 C 80 66, 91 58, 98 46 Z',
    fibers: 'M 104 52 L 76 71 M 116 52 L 144 71 M 106 60 L 84 74 M 114 60 L 136 74',
  },
  {
    id: 'back_traps_middle',
    muscle: 'traps',
    headLabel: 'Middle Trapezius',
    latinName: 'Trapezius Pars Transversa',
    view: 'back',
    d: 'M 86 76 L 110 74 L 134 76 L 128 96 L 110 98 L 92 96 Z',
    fibers: 'M 88 82 L 132 82 M 90 90 L 130 90',
  },
  {
    id: 'back_traps_lower',
    muscle: 'traps',
    headLabel: 'Lower Trapezius (V-Apex)',
    latinName: 'Trapezius Pars Ascendens',
    view: 'back',
    d: 'M 92 96 L 110 98 L 128 96 L 110 132 Z',
    fibers: 'M 96 101 L 110 124 L 124 101 M 101 108 L 110 128 L 119 108',
  },

  // Posterior Deltoids
  {
    id: 'back_shoulder_posterior_l',
    muscle: 'shoulders',
    headLabel: 'Posterior Deltoid (L)',
    latinName: 'Deltoideus Pars Spinalis',
    view: 'back',
    d: 'M 66 71 C 53 74, 46 85, 47 104 C 53 106, 63 99, 73 88 L 78 76 Z',
    fibers: 'M 73 77 C 63 83, 55 92, 50 101 M 75 83 C 66 89, 59 96, 54 103',
  },
  {
    id: 'back_shoulder_posterior_r',
    muscle: 'shoulders',
    headLabel: 'Posterior Deltoid (R)',
    latinName: 'Deltoideus Pars Spinalis',
    view: 'back',
    d: 'M 154 71 C 167 74, 174 85, 173 104 C 167 106, 157 99, 147 88 L 142 76 Z',
    fibers: 'M 147 77 C 157 83, 165 92, 170 101 M 145 83 C 154 89, 161 96, 166 103',
  },

  // Middle Back — Rhomboids, Infraspinatus & Teres Minor/Major
  {
    id: 'back_middle_rhomboids_l',
    muscle: 'middle back',
    headLabel: 'Rhomboids & Infraspinatus (L)',
    latinName: 'Rhomboideus & Infraspinatus',
    view: 'back',
    d: 'M 78 76 L 86 76 L 92 96 L 98 110 L 72 104 C 69 96, 72 85, 78 76 Z',
    fibers: 'M 88 84 L 73 94 M 92 94 L 74 102',
  },
  {
    id: 'back_middle_rhomboids_r',
    muscle: 'middle back',
    headLabel: 'Rhomboids & Infraspinatus (R)',
    latinName: 'Rhomboideus & Infraspinatus',
    view: 'back',
    d: 'M 142 76 L 134 76 L 128 96 L 122 110 L 148 104 C 151 96, 148 85, 142 76 Z',
    fibers: 'M 132 84 L 147 94 M 128 94 L 146 102',
  },

  // Latissimus Dorsi — Upper Wing, Middle Sweep, Lower Insertion
  {
    id: 'back_lats_upper_l',
    muscle: 'lats',
    headLabel: 'Upper Lats & Teres Major (L)',
    latinName: 'Latissimus Dorsi Superior',
    view: 'back',
    d: 'M 66 102 L 96 110 L 102 128 L 70 128 C 65 119, 64 110, 66 102 Z',
    fibers: 'M 68 109 L 96 118 M 70 119 L 99 125',
  },
  {
    id: 'back_lats_upper_r',
    muscle: 'lats',
    headLabel: 'Upper Lats & Teres Major (R)',
    latinName: 'Latissimus Dorsi Superior',
    view: 'back',
    d: 'M 154 102 L 124 110 L 118 128 L 150 128 C 155 119, 156 110, 154 102 Z',
    fibers: 'M 152 109 L 124 118 M 150 119 L 121 125',
  },
  {
    id: 'back_lats_middle_l',
    muscle: 'lats',
    headLabel: 'Middle Lats V-Sweep (L)',
    latinName: 'Latissimus Dorsi Medius',
    view: 'back',
    d: 'M 70 128 L 102 128 L 104 152 L 76 152 C 72 144, 70 136, 70 128 Z',
    fibers: 'M 72 135 L 102 140 M 75 145 L 103 149',
  },
  {
    id: 'back_lats_middle_r',
    muscle: 'lats',
    headLabel: 'Middle Lats V-Sweep (R)',
    latinName: 'Latissimus Dorsi Medius',
    view: 'back',
    d: 'M 150 128 L 118 128 L 116 152 L 144 152 C 148 144, 150 136, 150 128 Z',
    fibers: 'M 148 135 L 118 140 M 145 145 L 117 149',
  },
  {
    id: 'back_lats_lower_l',
    muscle: 'lats',
    headLabel: 'Lower Lats Insertion (L)',
    latinName: 'Latissimus Dorsi Inferior',
    view: 'back',
    d: 'M 76 152 L 100 152 L 96 176 C 86 172, 79 163, 76 152 Z',
    fibers: 'M 79 158 L 97 166',
  },
  {
    id: 'back_lats_lower_r',
    muscle: 'lats',
    headLabel: 'Lower Lats Insertion (R)',
    latinName: 'Latissimus Dorsi Inferior',
    view: 'back',
    d: 'M 144 152 L 120 152 L 124 176 C 134 172, 141 163, 144 152 Z',
    fibers: 'M 141 158 L 123 166',
  },

  // Erector Spinae (Lower Back)
  {
    id: 'back_lower_erectors_l',
    muscle: 'lower back',
    headLabel: 'Lumbar Erector Spinae (L)',
    latinName: 'Musculus Erector Spinae',
    view: 'back',
    d: 'M 97 144 L 108 144 L 108 188 L 93 186 C 94 171, 96 157, 97 144 Z',
    fibers: 'M 103 148 L 101 184 M 98 152 L 96 182',
  },
  {
    id: 'back_lower_erectors_r',
    muscle: 'lower back',
    headLabel: 'Lumbar Erector Spinae (R)',
    latinName: 'Musculus Erector Spinae',
    view: 'back',
    d: 'M 123 144 L 112 144 L 112 188 L 127 186 C 126 171, 124 157, 123 144 Z',
    fibers: 'M 117 148 L 119 184 M 122 152 L 124 182',
  },

  // Triceps Brachii — Lateral, Long & Medial Heads (Horseshoe)
  {
    id: 'back_triceps_lateral_l',
    muscle: 'triceps',
    headLabel: 'Triceps Lateral Head (L)',
    latinName: 'Triceps Brachii Caput Laterale',
    view: 'back',
    d: 'M 48 104 C 42 116, 41 133, 44 149 L 52 146 C 53 131, 54 116, 55 104 Z',
    fibers: 'M 51 108 C 46 120, 45 133, 47 145',
  },
  {
    id: 'back_triceps_lateral_r',
    muscle: 'triceps',
    headLabel: 'Triceps Lateral Head (R)',
    latinName: 'Triceps Brachii Caput Laterale',
    view: 'back',
    d: 'M 172 104 C 178 116, 179 133, 176 149 L 168 146 C 167 131, 166 116, 165 104 Z',
    fibers: 'M 169 108 C 174 120, 175 133, 173 145',
  },
  {
    id: 'back_triceps_long_l',
    muscle: 'triceps',
    headLabel: 'Triceps Long Head (L)',
    latinName: 'Triceps Brachii Caput Longum',
    view: 'back',
    d: 'M 55 103 C 54 118, 53 134, 52 148 L 61 151 C 64 137, 65 119, 63 102 Z',
    fibers: 'M 59 107 C 59 122, 58 136, 56 148',
  },
  {
    id: 'back_triceps_long_r',
    muscle: 'triceps',
    headLabel: 'Triceps Long Head (R)',
    latinName: 'Triceps Brachii Caput Longum',
    view: 'back',
    d: 'M 165 103 C 166 118, 167 134, 168 148 L 159 151 C 156 137, 155 119, 157 102 Z',
    fibers: 'M 161 107 C 161 122, 162 136, 164 148',
  },
  {
    id: 'back_triceps_medial_l',
    muscle: 'triceps',
    headLabel: 'Triceps Medial Head (L)',
    latinName: 'Triceps Brachii Caput Mediale',
    view: 'back',
    d: 'M 45 149 L 60 151 L 57 163 L 44 161 Z',
    fibers: 'M 52 151 L 50 161',
  },
  {
    id: 'back_triceps_medial_r',
    muscle: 'triceps',
    headLabel: 'Triceps Medial Head (R)',
    latinName: 'Triceps Brachii Caput Mediale',
    view: 'back',
    d: 'M 175 149 L 160 151 L 163 163 L 176 161 Z',
    fibers: 'M 168 151 L 170 161',
  },

  // Posterior Forearms (Extensors)
  {
    id: 'back_forearms_l',
    muscle: 'forearms',
    headLabel: 'Forearm Extensors (L)',
    latinName: 'Extensor Digitorum & Carpi',
    view: 'back',
    d: 'M 42 164 C 36 176, 34 194, 33 214 L 44 216 C 50 198, 55 180, 57 165 Z',
    fibers: 'M 48 168 L 38 212 M 53 169 L 42 213',
  },
  {
    id: 'back_forearms_r',
    muscle: 'forearms',
    headLabel: 'Forearm Extensors (R)',
    latinName: 'Extensor Digitorum & Carpi',
    view: 'back',
    d: 'M 178 164 C 184 176, 186 194, 187 214 L 176 216 C 170 198, 165 180, 163 165 Z',
    fibers: 'M 172 168 L 182 212 M 167 169 L 178 213',
  },

  // Gluteus Medius & Gluteus Maximus
  {
    id: 'back_glutes_medius_l',
    muscle: 'glutes',
    headLabel: 'Gluteus Medius — Upper Hip (L)',
    latinName: 'Musculus Gluteus Medius',
    view: 'back',
    d: 'M 75 184 C 82 182, 90 184, 96 188 L 92 200 L 71 198 C 71 192, 73 187, 75 184 Z',
    fibers: 'M 76 190 L 93 194',
  },
  {
    id: 'back_glutes_medius_r',
    muscle: 'glutes',
    headLabel: 'Gluteus Medius — Upper Hip (R)',
    latinName: 'Musculus Gluteus Medius',
    view: 'back',
    d: 'M 145 184 C 138 182, 130 184, 124 188 L 128 200 L 149 198 C 149 192, 147 187, 145 184 Z',
    fibers: 'M 144 190 L 127 194',
  },
  {
    id: 'back_glutes_maximus_l',
    muscle: 'glutes',
    headLabel: 'Gluteus Maximus (L)',
    latinName: 'Musculus Gluteus Maximus',
    view: 'back',
    d: 'M 71 198 C 82 195, 98 192, 108 196 L 108 228 C 96 234, 78 232, 69 220 C 66 212, 67 204, 71 198 Z',
    fibers: 'M 105 202 C 93 202, 81 206, 71 213 M 105 212 C 94 214, 82 218, 72 223',
  },
  {
    id: 'back_glutes_maximus_r',
    muscle: 'glutes',
    headLabel: 'Gluteus Maximus (R)',
    latinName: 'Musculus Gluteus Maximus',
    view: 'back',
    d: 'M 149 198 C 138 195, 122 192, 112 196 L 112 228 C 124 234, 142 232, 151 220 C 154 212, 153 204, 149 198 Z',
    fibers: 'M 115 202 C 127 202, 139 206, 149 213 M 115 212 C 126 214, 138 218, 148 223',
  },

  // Hamstrings — Biceps Femoris (Lateral) & Semitendinosus/Semimembranosus (Medial)
  {
    id: 'back_hamstrings_lateral_l',
    muscle: 'hamstrings',
    headLabel: 'Biceps Femoris — Outer Hamstring (L)',
    latinName: 'Biceps Femoris Caput Longum',
    view: 'back',
    d: 'M 70 226 C 65 248, 66 274, 71 300 L 83 300 C 84 274, 85 248, 86 229 Z',
    fibers: 'M 78 232 C 74 254, 74 276, 76 296',
  },
  {
    id: 'back_hamstrings_lateral_r',
    muscle: 'hamstrings',
    headLabel: 'Biceps Femoris — Outer Hamstring (R)',
    latinName: 'Biceps Femoris Caput Longum',
    view: 'back',
    d: 'M 150 226 C 155 248, 154 274, 149 300 L 137 300 C 136 274, 135 248, 134 229 Z',
    fibers: 'M 142 232 C 146 254, 146 276, 144 296',
  },
  {
    id: 'back_hamstrings_medial_l',
    muscle: 'hamstrings',
    headLabel: 'Semitendinosus — Inner Hamstring (L)',
    latinName: 'Semitendinosus & Semimembranosus',
    view: 'back',
    d: 'M 86 229 C 85 248, 84 274, 83 300 L 96 300 C 100 276, 102 250, 102 229 Z',
    fibers: 'M 94 233 C 94 254, 93 276, 90 296',
  },
  {
    id: 'back_hamstrings_medial_r',
    muscle: 'hamstrings',
    headLabel: 'Semitendinosus — Inner Hamstring (R)',
    latinName: 'Semitendinosus & Semimembranosus',
    view: 'back',
    d: 'M 134 229 C 135 248, 136 274, 137 300 L 124 300 C 120 276, 118 250, 118 229 Z',
    fibers: 'M 126 233 C 126 254, 127 276, 130 296',
  },

  // Calves — Gastrocnemius Twin Heads & Soleus
  {
    id: 'back_calves_l',
    muscle: 'calves',
    headLabel: 'Gastrocnemius & Soleus (L)',
    latinName: 'Musculus Triceps Surae',
    view: 'back',
    d: 'M 72 316 C 65 332, 66 352, 74 368 L 77 388 L 86 388 L 89 368 C 96 352, 97 332, 92 316 Z',
    fibers: 'M 82 318 L 82 362 M 74 326 C 71 338, 72 350, 77 362 M 90 326 C 93 338, 92 350, 87 362',
  },
  {
    id: 'back_calves_r',
    muscle: 'calves',
    headLabel: 'Gastrocnemius & Soleus (R)',
    latinName: 'Musculus Triceps Surae',
    view: 'back',
    d: 'M 148 316 C 155 332, 154 352, 146 368 L 143 388 L 134 388 L 131 368 C 124 352, 123 332, 128 316 Z',
    fibers: 'M 138 318 L 138 362 M 146 326 C 149 338, 148 350, 143 362 M 130 326 C 127 338, 128 350, 133 362',
  },
];

const ALL_ANATOMY_PARTS = [...FRONT_ANATOMY_PARTS, ...BACK_ANATOMY_PARTS];

const muscleAliases: Record<string, string> = {
  abs: 'abdominals',
  core: 'abdominals',
  waist: 'abdominals',
  pectorals: 'chest',
  delts: 'shoulders',
  deltoids: 'shoulders',
  quads: 'quadriceps',
  adductors: 'quadriceps',
  abductors: 'glutes',
  'upper back': 'middle back',
  back: 'middle back',
  spine: 'lower back',
  serratus: 'obliques',
  'serratus anterior': 'obliques',
  neck: 'traps',
  'levator scapulae': 'traps',
};

function normalizeMuscleName(name: string): string {
  const key = (name || '').trim().toLowerCase();
  return muscleAliases[key] || key;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const r = Number.parseInt(full.slice(0, 2), 16) || 120;
  const g = Number.parseInt(full.slice(2, 4), 16) || 100;
  const b = Number.parseInt(full.slice(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function blendHexColors(primary: string, secondary: string, weight: number): string {
  const blend = Math.max(0, Math.min(1, weight));
  const normalize = (value: string) => {
    const clean = value.replace('#', '');
    return clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  };

  const a = normalize(primary);
  const b = normalize(secondary);

  const toInt = (hex: string, i: number) => Number.parseInt(hex.slice(i, i + 2), 16) || 0;
  const r = Math.round(toInt(a, 0) * (1 - blend) + toInt(b, 0) * blend);
  const g = Math.round(toInt(a, 2) * (1 - blend) + toInt(b, 2) * blend);
  const bl = Math.round(toInt(a, 4) * (1 - blend) + toInt(b, 4) * blend);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * Computes an anatomical ecorché / thermal color based on map mode and score
 */
function getPartVisualColors(
  muscle: string,
  activation: number,
  recoveryPct: number,
  isStale: boolean,
  mode: MapMode
): { base: string; highlight: string; shadow: string; stroke: string; fillAlpha: number } {
  if (mode === 'recovery') {
    const recColor =
      recoveryPct >= 85
        ? '#10E89A' // Fresh & ready
        : recoveryPct >= 50
          ? '#FBBF24' // Recovering
          : '#FF3D5A'; // Fatigued
    return {
      base: recColor,
      highlight: blendHexColors(recColor, '#ffffff', 0.45),
      shadow: blendHexColors(recColor, '#090d16', 0.65),
      stroke: hexToRgba(recColor, 0.85),
      fillAlpha: 0.35 + (1 - recoveryPct / 100) * 0.45,
    };
  }

  if (mode === 'balance') {
    if (isStale || activation < 0.12) {
      return {
        base: '#F59E0B',
        highlight: '#FDE68A',
        shadow: '#451A03',
        stroke: '#FBBF24',
        fillAlpha: 0.42,
      };
    }
    return {
      base: '#10E89A',
      highlight: '#A7F3D0',
      shadow: '#064E3B',
      stroke: '#34D399',
      fillAlpha: 0.35 + activation * 0.45,
    };
  }

  // Default: Anatomical Ecorché + Thermal Activation Ramp
  const muscleColor = MUSCLE_COLORS[muscle] || '#FF4D6D';
  if (activation <= 0.04) {
    // Untrained baseline ecorché striated muscle tissue tone
    return {
      base: '#4A2C35',
      highlight: '#6E424E',
      shadow: '#1F1218',
      stroke: 'rgba(255, 190, 180, 0.22)',
      fillAlpha: 0.42,
    };
  }

  // Blend from natural crimson muscle fibers -> vibrant muscle accent -> incandescent peak
  const midColor = blendHexColors('#C92A42', muscleColor, 0.55);
  const hotColor = activation > 0.65
    ? blendHexColors(midColor, '#FFB703', (activation - 0.65) / 0.35)
    : midColor;

  return {
    base: hotColor,
    highlight: blendHexColors(hotColor, '#FFF3E6', 0.52),
    shadow: blendHexColors(hotColor, '#1A070C', 0.6),
    stroke: hexToRgba(blendHexColors(hotColor, '#FFFFFF', 0.35), 0.55 + activation * 0.45),
    fillAlpha: 0.48 + activation * 0.48,
  };
}

function AnatomicalFigure({
  view,
  parts,
  partScores,
  muscleRecovery,
  staleMuscles,
  selectedMuscle,
  selectedPart,
  mode,
  onSelectPart,
}: {
  view: 'front' | 'back';
  parts: AnatomicalMusclePart[];
  partScores: Record<string, number>;
  muscleRecovery: Record<string, number>;
  staleMuscles: Set<string>;
  selectedMuscle: string | null;
  selectedPart: AnatomicalMusclePart | null;
  mode: MapMode;
  onSelectPart: (part: AnatomicalMusclePart) => void;
}) {
  const isFront = view === 'front';
  const title = isFront ? 'Anterior (Front)' : 'Posterior (Back)';

  return (
    <div className="card" style={{ padding: 12, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Tap muscle to inspect</span>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          background:
            'radial-gradient(ellipse 80% 50% at 50% 15%, rgba(255, 90, 110, 0.10), transparent 70%), radial-gradient(ellipse 70% 45% at 50% 85%, rgba(124, 106, 255, 0.08), transparent 70%), linear-gradient(180deg, #0b0d18 0%, #06070d 100%)',
          padding: '6px 4px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox="0 0 220 420"
          width="100%"
          style={{ height: 'auto', maxHeight: 410, display: 'block', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.55))' }}
          role="img"
          aria-label={`${title} anatomical muscle map`}
        >
          <defs>
            {/* Volumetric Skin & Subsurface Ecorché Base */}
            <linearGradient id={`skin-base-${view}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#26293e" />
              <stop offset="45%" stopColor="#1b1e30" />
              <stop offset="100%" stopColor="#121422" />
            </linearGradient>

            <radialGradient id={`torso-volume-${view}`} cx="50%" cy="28%" r="65%">
              <stop offset="0%" stopColor="rgba(255, 235, 225, 0.14)" />
              <stop offset="55%" stopColor="rgba(30, 34, 56, 0.05)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0.48)" />
            </radialGradient>

            {/* Tendon & Fascia Aponeurosis Gradient */}
            <linearGradient id={`tendon-grad-${view}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(226, 232, 244, 0.26)" />
              <stop offset="50%" stopColor="rgba(180, 190, 212, 0.16)" />
              <stop offset="100%" stopColor="rgba(120, 130, 155, 0.08)" />
            </linearGradient>

            {/* Glow Filter for Peak Activated Muscles */}
            <filter id={`muscle-glow-${view}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Individual 3D Volumetric Gradients per Anatomical Part */}
            {parts.map((part) => {
              const val = partScores[part.id] || 0;
              const rec = muscleRecovery[part.muscle] ?? 100;
              const isStale = staleMuscles.has(part.muscle);
              const colors = getPartVisualColors(part.muscle, val, rec, isStale, mode);
              return (
                <radialGradient key={`grad-${part.id}`} id={`grad-${part.id}`} cx="42%" cy="32%" r="72%">
                  <stop offset="0%" stopColor={hexToRgba(colors.highlight, Math.min(1, colors.fillAlpha + 0.18))} />
                  <stop offset="48%" stopColor={hexToRgba(colors.base, colors.fillAlpha)} />
                  <stop offset="100%" stopColor={hexToRgba(colors.shadow, Math.min(1, colors.fillAlpha + 0.12))} />
                </radialGradient>
              );
            })}
          </defs>

          {/* Subtle Anatomical Grid Lines */}
          <line x1="110" y1="8" x2="110" y2="412" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" strokeWidth="0.8" />
          <ellipse cx="110" cy="407" rx="52" ry="6" fill="rgba(0,0,0,0.45)" />

          {/* ================= ANATOMICAL HUMAN SILHOUETTE & SKELETAL BASE ================= */}
          {/* Head, Cranium, Jaw & Ears */}
          <path
            d="M 110 11 C 99 11, 93 18, 93 28 C 91 29, 90 32, 92 35 C 93 42, 97 48, 103 51 L 117 51 C 123 48, 127 42, 128 35 C 130 32, 129 29, 127 28 C 127 18, 121 11, 110 11 Z"
            fill={`url(#skin-base-${view})`}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1"
          />
          {isFront ? (
            /* Facial anatomical planes (brow, nose bridge, jawline shadow) */
            <g stroke="rgba(255,255,255,0.12)" fill="none" strokeWidth="0.8">
              <path d="M 98 26 Q 104 24 108 26 M 112 26 Q 116 24 122 26" />
              <path d="M 110 26 L 110 35" />
              <path d="M 104 41 Q 110 43 116 41" />
            </g>
          ) : (
            /* Occipital cranial base & nuchal line */
            <path d="M 98 38 Q 110 43 122 38" stroke="rgba(255,255,255,0.14)" fill="none" strokeWidth="0.9" />
          )}

          {/* Neck & Trapezius Base */}
          <path
            d="M 100 49 L 96 60 L 66 70 L 154 70 L 124 60 L 120 49 Z"
            fill={`url(#skin-base-${view})`}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.9"
          />

          {/* Full Torso, Pelvis, Arms, Hands, Legs & Feet Base Silhouette */}
          <path
            d="
              M 66 70
              C 52 73, 45 84, 45 102
              C 44 122, 42 142, 41 162
              C 35 175, 33 194, 31 216
              L 26 232 C 25 237, 29 240, 34 238 L 43 220
              C 50 202, 56 182, 59 162
              C 63 145, 65 126, 68 112
              C 70 132, 73 154, 73 176
              C 71 190, 65 206, 63 230
              C 61 258, 65 286, 71 312
              C 66 332, 67 358, 74 390
              L 68 403 C 66 407, 72 409, 82 408 L 89 392
              C 96 364, 97 338, 93 312
              C 99 286, 103 252, 106 218
              L 110 214 L 114 218
              C 117 252, 121 286, 127 312
              C 123 338, 124 364, 131 392
              L 138 408 C 148 409, 154 407, 152 403 L 146 390
              C 153 358, 154 332, 149 312
              C 155 286, 159 258, 157 230
              C 155 206, 149 190, 147 176
              C 147 154, 150 132, 152 112
              C 155 126, 157 145, 161 162
              C 164 182, 170 202, 177 220
              L 186 238 C 191 240, 195 237, 194 232 L 189 216
              C 187 194, 185 175, 179 162
              C 178 142, 176 122, 175 102
              C 175 84, 168 73, 154 70
              Z
            "
            fill={`url(#skin-base-${view})`}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.1"
          />

          {/* Anatomical Tendon Sheets, Aponeuroses & Bony Landmarks */}
          {isFront ? (
            <g pointerEvents="none">
              {/* Clavicles (Collarbones) & Suprasternal Notch */}
              <path
                d="M 69 71 Q 89 68 105 73 Q 110 76 115 73 Q 131 68 151 71"
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
              {/* Sternum & Linea Alba */}
              <line x1="110" y1="75" x2="110" y2="202" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" />
              {/* Costal Arch & Inguinal V-Taper Line */}
              <path
                d="M 90 116 Q 110 112 130 116 M 74 176 Q 92 198 108 206 M 146 176 Q 128 198 112 206"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
                fill="none"
              />
              {/* Patella (Kneecaps) & Patellar Ligaments */}
              <ellipse cx="83" cy="308" rx="7" ry="6" fill={`url(#tendon-grad-${view})`} stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" />
              <ellipse cx="137" cy="308" rx="7" ry="6" fill={`url(#tendon-grad-${view})`} stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" />
              {/* Shin Bone (Tibia Crest) */}
              <path d="M 82 316 L 80 388 M 138 316 L 140 388" stroke="rgba(255,255,255,0.14)" strokeWidth="0.9" />
            </g>
          ) : (
            <g pointerEvents="none">
              {/* Thoracolumbar Fascia Diamond & Spinal Groove */}
              <path
                d="M 110 98 L 124 152 L 110 192 L 96 152 Z"
                fill={`url(#tendon-grad-${view})`}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.8"
              />
              <line x1="110" y1="48" x2="110" y2="194" stroke="rgba(0,0,0,0.5)" strokeWidth="1.6" />
              {/* Scapular Spine Landmarks */}
              <path d="M 68 78 Q 84 82 94 78 M 152 78 Q 136 82 126 78" stroke="rgba(255,255,255,0.2)" strokeWidth="1.1" fill="none" />
              {/* Popliteal Fossa (Back of Knee) & Achilles Tendons */}
              <path d="M 74 306 Q 84 310 94 306 M 126 306 Q 136 310 146 306" stroke="rgba(255,255,255,0.14)" strokeWidth="0.9" fill="none" />
              <path d="M 79 366 L 81 395 M 84 366 L 82 395 M 141 366 L 139 395 M 136 366 L 138 395" stroke="rgba(226,232,244,0.3)" strokeWidth="1.4" />
            </g>
          )}

          {/* ================= SCULPTED ANATOMICAL MUSCLE BELLIES & STRIATIONS ================= */}
          {parts.map((part) => {
            const val = partScores[part.id] || 0;
            const rec = muscleRecovery[part.muscle] ?? 100;
            const isStale = staleMuscles.has(part.muscle);
            const colors = getPartVisualColors(part.muscle, val, rec, isStale, mode);
            const isPartSelected = selectedPart?.id === part.id;
            const isMuscleSelected = selectedMuscle === part.muscle;
            const isHighlighted = isPartSelected || isMuscleSelected;

            return (
              <g
                key={part.id}
                onClick={() => onSelectPart(part)}
                style={{ cursor: 'pointer' }}
                filter={val > 0.65 || isHighlighted ? `url(#muscle-glow-${view})` : undefined}
              >
                <title>{`${part.headLabel} (${part.latinName}) — ${Math.round(val * 100)}% activation`}</title>

                {/* Main Sculpted Muscle Belly */}
                <path
                  d={part.d}
                  fill={`url(#grad-${part.id})`}
                  stroke={
                    isPartSelected
                      ? '#FFFFFF'
                      : isMuscleSelected
                        ? '#FDE68A'
                        : isStale && mode !== 'recovery'
                          ? '#F59E0B'
                          : colors.stroke
                  }
                  strokeWidth={isPartSelected ? 1.9 : isMuscleSelected ? 1.4 : val > 0.5 ? 1.05 : 0.75}
                  strokeDasharray={isStale && mode === 'balance' ? '3 1.5' : undefined}
                  strokeLinejoin="round"
                />

                {/* Pennation Muscle Fiber Striation Lines */}
                {part.fibers && (
                  <path
                    d={part.fibers}
                    fill="none"
                    stroke={
                      val > 0.1
                        ? hexToRgba(colors.highlight, 0.25 + val * 0.45)
                        : 'rgba(255, 210, 210, 0.12)'
                    }
                    strokeWidth={0.65}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* Subtle 3D Rim & Volume Overlay */}
          <rect x="30" y="10" width="160" height="400" fill={`url(#torso-volume-${view})`} pointerEvents="none" opacity="0.35" />
        </svg>
      </div>
    </div>
  );
}

export default function MuscleHeatmap({ sessions }: MuscleHeatmapProps) {
  const { equipment: userEquipment, barWeight, dumbbellWeight, defaultRestTime, unitSystem } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const [muscleScores, setMuscleScores] = useState<Record<string, number>>({});
  const [partRawScores, setPartRawScores] = useState<Record<string, number>>({});
  const [muscleSetCounts, setMuscleSetCounts] = useState<Record<string, number>>({});
  const [muscleVolumes, setMuscleVolumes] = useState<Record<string, number>>({});
  const [lastTrainedAt, setLastTrainedAt] = useState<Record<string, number>>({});
  const [muscleExerciseScores, setMuscleExerciseScores] = useState<Record<string, Record<string, number>>>({});
  const [range, setRange] = useState<TimeRange>('30d');
  const [mode, setMode] = useState<MapMode>('activation');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('both');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>('chest');
  const [selectedPart, setSelectedPart] = useState<AnatomicalMusclePart | null>(null);

  const filteredSessions = useMemo(() => {
    if (range === 'all') return sessions;
    const now = Date.now();
    const days = range === '7d' ? 7 : 30;
    const threshold = now - days * 24 * 60 * 60 * 1000;
    return sessions.filter(s => new Date(s.startedAt).getTime() >= threshold);
  }, [sessions, range]);

  useEffect(() => {
    const run = async () => {
      const sessionIds = sessions.map(s => s.id).filter((id): id is number => typeof id === 'number');
      const filteredSessionIds = new Set(
        filteredSessions.map(s => s.id).filter((id): id is number => typeof id === 'number')
      );
      if (!sessionIds.length) {
        setMuscleScores({});
        setPartRawScores({});
        setMuscleSetCounts({});
        setMuscleVolumes({});
        setLastTrainedAt({});
        setMuscleExerciseScores({});
        return;
      }

      const sets = await db.sets.where('sessionId').anyOf(sessionIds).toArray();
      const exerciseIds = [...new Set(sets.map(set => set.exerciseId).filter((id): id is number => typeof id === 'number'))];
      if (!exerciseIds.length) {
        setMuscleScores({});
        setPartRawScores({});
        return;
      }

      const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray();
      const byId = new Map<number, (typeof exercises)[number]>();
      exercises.forEach(ex => {
        if (typeof ex.id === 'number') byId.set(ex.id, ex);
      });

      const scores: Record<string, number> = {};
      const byPart: Record<string, number> = {};
      const setCounts: Record<string, number> = {};
      const volumes: Record<string, number> = {};
      const trainedAt: Record<string, number> = {};
      const details: Record<string, Record<string, number>> = {};
      const sessionDateMap = new Map<number, number>();

      sessions.forEach(session => {
        if (typeof session.id === 'number') {
          sessionDateMap.set(session.id, new Date(session.completedAt || session.startedAt).getTime());
        }
      });

      for (const set of sets) {
        const ex = byId.get(set.exerciseId);
        if (!ex) continue;

        const setTimestamp = set.completedAt
          ? new Date(set.completedAt).getTime()
          : (sessionDateMap.get(set.sessionId) || Date.now());
        const setVol = Math.max(0, (set.weight || 0) * (set.reps || 0));
        const loadFactor = Math.max(1, Math.sqrt(Math.max(1, setVol || (set.reps || 10) * 15)) / 3.2);
        const primary = (ex.primaryMuscles || []).map(normalizeMuscleName);
        const secondary = (ex.secondaryMuscles || []).map(normalizeMuscleName);
        const exNameLower = ex.name.toLowerCase();

        [...primary, ...secondary].forEach(m => {
          trainedAt[m] = Math.max(trainedAt[m] || 0, setTimestamp);
        });

        if (!filteredSessionIds.has(set.sessionId)) continue;

        primary.forEach(m => {
          const score = 1.3 * loadFactor;
          scores[m] = (scores[m] || 0) + score;
          setCounts[m] = (setCounts[m] || 0) + 1;
          volumes[m] = (volumes[m] || 0) + setVol;
          if (!details[m]) details[m] = {};
          details[m][ex.name] = (details[m][ex.name] || 0) + score;

          // Distribute across anatomical heads based on exercise movement biomechanics
          const matchingParts = ALL_ANATOMY_PARTS.filter(p => p.muscle === m);
          matchingParts.forEach(part => {
            let headBias = 1.0;
            if (m === 'chest') {
              if (exNameLower.includes('incline') && part.id.includes('upper')) headBias = 1.45;
              else if ((exNameLower.includes('decline') || exNameLower.includes('dip')) && part.id.includes('lower')) headBias = 1.45;
              else if (part.id.includes('middle')) headBias = 1.2;
            } else if (m === 'shoulders') {
              if ((exNameLower.includes('lateral') || exNameLower.includes('side') || exNameLower.includes('upright')) && part.id.includes('lateral')) headBias = 1.5;
              else if ((exNameLower.includes('rear') || exNameLower.includes('reverse') || exNameLower.includes('face pull')) && part.id.includes('posterior')) headBias = 1.55;
              else if (part.id.includes('anterior')) headBias = 1.25;
            } else if (m === 'quadriceps') {
              if ((exNameLower.includes('extension') || exNameLower.includes('sissy') || exNameLower.includes('lunge')) && part.id.includes('rectus')) headBias = 1.35;
              else if ((exNameLower.includes('hack') || exNameLower.includes('front squat')) && part.id.includes('lateralis')) headBias = 1.35;
              else if (part.id.includes('medialis')) headBias = 1.2;
            } else if (m === 'triceps') {
              if ((exNameLower.includes('overhead') || exNameLower.includes('skull')) && part.id.includes('long')) headBias = 1.45;
              else if (exNameLower.includes('pushdown') && part.id.includes('lateral')) headBias = 1.4;
            } else if (m === 'biceps') {
              if ((exNameLower.includes('incline') || exNameLower.includes('hammer')) && part.id.includes('long')) headBias = 1.4;
              else if ((exNameLower.includes('preacher') || exNameLower.includes('concentration')) && part.id.includes('short')) headBias = 1.4;
            } else if (m === 'abdominals') {
              if ((exNameLower.includes('leg raise') || exNameLower.includes('reverse crunch')) && part.id.includes('lower')) headBias = 1.45;
              else if (exNameLower.includes('crunch') && part.id.includes('upper')) headBias = 1.35;
            }
            byPart[part.id] = (byPart[part.id] || 0) + score * headBias;
          });
        });

        secondary.forEach(m => {
          const score = 0.65 * loadFactor;
          scores[m] = (scores[m] || 0) + score;
          volumes[m] = (volumes[m] || 0) + Math.round(setVol * 0.45);
          if (!details[m]) details[m] = {};
          details[m][ex.name] = (details[m][ex.name] || 0) + score;

          const matchingParts = ALL_ANATOMY_PARTS.filter(p => p.muscle === m);
          matchingParts.forEach(part => {
            byPart[part.id] = (byPart[part.id] || 0) + score;
          });
        });
      }

      setMuscleScores(scores);
      setPartRawScores(byPart);
      setMuscleSetCounts(setCounts);
      setMuscleVolumes(volumes);
      setLastTrainedAt(trainedAt);
      setMuscleExerciseScores(details);
    };

    run().catch(() => {
      setMuscleScores({});
      setPartRawScores({});
    });
  }, [sessions, filteredSessions]);

  const normalizedByMuscle = useMemo(() => {
    const entries = Object.entries(muscleScores);
    if (!entries.length) return {} as Record<string, number>;
    const max = entries.reduce((acc, [, value]) => Math.max(acc, value), 0);
    if (max <= 0) return {} as Record<string, number>;

    const out: Record<string, number> = {};
    entries.forEach(([muscle, value]) => {
      out[muscle] = Math.min(1, Math.pow(value / max, 0.78));
    });
    return out;
  }, [muscleScores]);

  const normalizedByPart = useMemo(() => {
    const out: Record<string, number> = {};
    const maxPart = Math.max(0.001, ...Object.values(partRawScores));
    for (const part of ALL_ANATOMY_PARTS) {
      const raw = partRawScores[part.id] || 0;
      const muscleBase = normalizedByMuscle[part.muscle] || 0;
      const partNorm = raw > 0 ? Math.min(1, Math.pow(raw / maxPart, 0.78)) : 0;
      out[part.id] = Math.max(partNorm, muscleBase * 0.85);
    }
    return out;
  }, [partRawScores, normalizedByMuscle]);

  const muscleRecovery = useMemo(() => {
    const now = Date.now();
    const out: Record<string, number> = {};
    for (const m of Object.keys(MUSCLE_METADATA)) {
      out[m] = Math.round(calculateRecoveryPercentage(m, lastTrainedAt[m] || 0, now));
    }
    return out;
  }, [lastTrainedAt]);

  const staleMuscles = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 9 * 24 * 60 * 60 * 1000;
    const stale = new Set<string>();
    const allMainMuscles = [
      'chest', 'shoulders', 'biceps', 'triceps', 'lats', 'middle back',
      'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals',
    ];
    for (const m of allMainMuscles) {
      const ts = lastTrainedAt[m] || 0;
      if (!ts || now - ts > staleThresholdMs) stale.add(m);
    }
    return stale;
  }, [lastTrainedAt]);

  const symmetryMetrics = useMemo(() => {
    const getScore = (m: string) => muscleScores[m] || 0;
    const pushScore = getScore('chest') + getScore('shoulders') + getScore('triceps') + getScore('quadriceps');
    const pullScore = getScore('lats') + getScore('middle back') + getScore('traps') + getScore('biceps') + getScore('hamstrings');
    const upperScore = getScore('chest') + getScore('shoulders') + getScore('lats') + getScore('middle back') + getScore('biceps') + getScore('triceps');
    const lowerScore = (getScore('quadriceps') + getScore('hamstrings') + getScore('glutes') + getScore('calves')) * 1.4;

    const pushPullPct = pushScore + pullScore > 0 ? Math.round((pushScore / (pushScore + pullScore)) * 100) : 50;
    const upperLowerPct = upperScore + lowerScore > 0 ? Math.round((upperScore / (upperScore + lowerScore)) * 100) : 50;

    return { pushPullPct, upperLowerPct };
  }, [muscleScores]);

  const selectedMuscleDetails = useMemo(() => {
    if (!selectedMuscle) return [] as Array<{ name: string; score: number }>;
    const byExercise = muscleExerciseScores[selectedMuscle] || {};
    return Object.entries(byExercise)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [muscleExerciseScores, selectedMuscle]);

  const selectedMuscleParts = useMemo(() => {
    if (!selectedMuscle) return [];
    const seenHeads = new Set<string>();
    return ALL_ANATOMY_PARTS.filter(p => {
      if (p.muscle !== selectedMuscle) return false;
      const baseHead = p.headLabel.replace(/\s*\([LR]\)$/i, '');
      if (seenHeads.has(baseHead)) return false;
      seenHeads.add(baseHead);
      return true;
    }).map(p => ({
      id: p.id,
      label: p.headLabel.replace(/\s*\([LR]\)$/i, ''),
      latin: p.latinName,
      score: Math.round((normalizedByPart[p.id] || 0) * 100),
    }));
  }, [selectedMuscle, normalizedByPart]);

  const handleSelectPart = (part: AnatomicalMusclePart) => {
    setSelectedPart(part);
    setSelectedMuscle(part.muscle);
  };

  const handleTrainMuscles = async (targets: string[], title: string) => {
    const allExercises = await db.exercises.toArray();
    const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
    const generated = generateSmartWorkout({
      targetMuscles: targets,
      exerciseCount: 5,
      setsPerExercise: 3,
      repsPerSet: 10,
      allExercises,
      userEquipment: equip,
      seed: Date.now(),
    });
    const dayExercises = generated.map((item, i) => ({
      exerciseId: 0,
      exerciseName: item.name,
      sets: item.sets,
      reps: item.reps,
      restTime: defaultRestTime || 90,
      setType: SetType.Normal,
      order: i,
    }));
    const resolved = resolveWorkoutDayExercises({
      dayExercises,
      allExercises,
      userEquipment: equip,
      barWeight,
      dumbbellWeight,
      varietySeed: 0,
      varietyLevel: 'low',
    });
    startWorkout('Anatomical Target', title, resolved);
  };

  const formatHoursSince = (ts: number) => {
    if (!ts) return 'Untrained';
    const hrs = Math.round((Date.now() - ts) / (1000 * 60 * 60));
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header & Controls */}
      <div className="card hero-gradient" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>3D Ecorché Anatomical Body Map</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
              54 sculpted muscle heads with pennation fiber striations, recovery readiness & symmetry diagnostics
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {([
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: 'all', label: 'ALL' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                className={range === opt.id ? 'btn-primary btn-high-contrast' : 'btn-secondary'}
                onClick={() => setRange(opt.id)}
                style={{ minHeight: 28, padding: '4px 10px', fontSize: 10, borderRadius: 8, width: 'auto' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Mode & View Switchers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              { id: 'activation' as const, label: 'Activation', icon: Flame },
              { id: 'recovery' as const, label: 'Recovery', icon: ShieldCheck },
              { id: 'balance' as const, label: 'Symmetry', icon: Scale },
            ]).map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`filter-chip ${mode === m.id ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: 11, minHeight: 32 }}
              >
                <m.icon size={12} /> {m.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-glass)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
            {([
              { id: 'both' as const, label: 'Dual' },
              { id: 'front' as const, label: 'Front' },
              { id: 'back' as const, label: 'Back' },
            ]).map(v => (
              <button
                key={v.id}
                onClick={() => setViewFilter(v.id)}
                style={{
                  padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  background: viewFilter === v.id ? 'var(--accent-purple)' : 'transparent',
                  color: viewFilter === v.id ? '#fff' : 'var(--text-muted)',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Anatomical Figures Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewFilter === 'both' ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          gap: 10,
        }}
      >
        {(viewFilter === 'both' || viewFilter === 'front') && (
          <AnatomicalFigure
            view="front"
            parts={FRONT_ANATOMY_PARTS}
            partScores={normalizedByPart}
            muscleRecovery={muscleRecovery}
            staleMuscles={staleMuscles}
            selectedMuscle={selectedMuscle}
            selectedPart={selectedPart}
            mode={mode}
            onSelectPart={handleSelectPart}
          />
        )}
        {(viewFilter === 'both' || viewFilter === 'back') && (
          <AnatomicalFigure
            view="back"
            parts={BACK_ANATOMY_PARTS}
            partScores={normalizedByPart}
            muscleRecovery={muscleRecovery}
            staleMuscles={staleMuscles}
            selectedMuscle={selectedMuscle}
            selectedPart={selectedPart}
            mode={mode}
            onSelectPart={handleSelectPart}
          />
        )}
      </div>

      {/* Quick Anatomical Muscle Selector Pills */}
      <div className="chip-scroll" style={{ marginBottom: 0 }}>
        {Object.keys(MUSCLE_METADATA).map(m => {
          const isSel = selectedMuscle === m;
          const act = Math.round((normalizedByMuscle[m] || 0) * 100);
          return (
            <button
              key={m}
              onClick={() => {
                setSelectedMuscle(m);
                setSelectedPart(null);
              }}
              className={`filter-chip ${isSel ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '6px 12px', textTransform: 'capitalize' }}
            >
              <span>{m}</span>
              <span style={{ opacity: 0.75, fontSize: 9 }}>{act}%</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Anatomical Muscle & Sub-Head Inspector */}
      {selectedMuscle && MUSCLE_METADATA[selectedMuscle] && (
        <div className="card" style={{ padding: 16, border: '1px solid var(--border-bright)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ fontSize: 17, fontWeight: 800, textTransform: 'capitalize' }}>
                  {selectedPart ? selectedPart.headLabel : selectedMuscle}
                </h4>
                <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent-purple)', fontSize: 10 }}>
                  {selectedPart ? selectedPart.latinName : MUSCLE_METADATA[selectedMuscle].latin}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {MUSCLE_METADATA[selectedMuscle].role}
              </p>
            </div>
            <button
              onClick={() => handleTrainMuscles([selectedMuscle], `${selectedMuscle.toUpperCase()} Hypertrophy Focus`)}
              className="btn-primary"
              style={{ width: 'auto', minHeight: 36, padding: '8px 14px', fontSize: 11, borderRadius: 10, flexShrink: 0 }}
            >
              <Play size={12} fill="white" /> Train {selectedMuscle}
            </button>
          </div>

          {/* 4-Metric Diagnostic Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              {
                label: 'Activation',
                value: `${Math.round((normalizedByMuscle[selectedMuscle] || 0) * 100)}%`,
                color: 'var(--accent-red)',
              },
              {
                label: 'Recovery',
                value: `${muscleRecovery[selectedMuscle] ?? 100}%`,
                color: (muscleRecovery[selectedMuscle] ?? 100) >= 80 ? 'var(--accent-green)' : 'var(--accent-yellow)',
              },
              {
                label: 'Sets Logged',
                value: `${muscleSetCounts[selectedMuscle] || 0}`,
                color: 'var(--accent-purple)',
              },
              {
                label: 'Last Trained',
                value: formatHoursSince(lastTrainedAt[selectedMuscle] || 0),
                color: 'var(--accent-cyan)',
              },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '8px 6px', background: 'var(--bg-glass)', borderRadius: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div className="font-mono" style={{ fontSize: 14, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Anatomical Head-by-Head Sub-Region Breakdown */}
          {selectedMuscleParts.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Anatomical Head & Fiber Subdivision</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedMuscleParts.map(head => (
                  <div key={head.id} style={{ padding: '7px 10px', borderRadius: 9, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{head.label}</span>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 700 }}>{head.score}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(4, head.score)}%`,
                          background: 'var(--gradient-fire)',
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Contributing Exercises */}
          {selectedMuscleDetails.length > 0 && (
            <div>
              <div className="section-label" style={{ marginBottom: 6 }}>Top Contributing Exercises ({range.toUpperCase()})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedMuscleDetails.map((row, idx) => (
                  <span
                    key={row.name}
                    style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 8,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize',
                    }}
                  >
                    {idx + 1}. {row.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Structural Symmetry & Recovery Balance Card */}
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={15} color="var(--accent-green)" /> Structural Symmetry & Recovery Balance
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} analyzed
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ padding: 10, background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              <span style={{ color: 'var(--accent-red)' }}>Push {symmetryMetrics.pushPullPct}%</span>
              <span style={{ color: 'var(--accent-green)' }}>Pull {100 - symmetryMetrics.pushPullPct}%</span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${symmetryMetrics.pushPullPct}%`, background: 'var(--accent-red)' }} />
              <div style={{ width: `${100 - symmetryMetrics.pushPullPct}%`, background: 'var(--accent-green)' }} />
            </div>
          </div>

          <div style={{ padding: 10, background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              <span style={{ color: 'var(--accent-purple)' }}>Upper {symmetryMetrics.upperLowerPct}%</span>
              <span style={{ color: 'var(--accent-yellow)' }}>Lower {100 - symmetryMetrics.upperLowerPct}%</span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${symmetryMetrics.upperLowerPct}%`, background: 'var(--accent-purple)' }} />
              <div style={{ width: `${100 - symmetryMetrics.upperLowerPct}%`, background: 'var(--accent-yellow)' }} />
            </div>
          </div>
        </div>

        {staleMuscles.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>
              Ready for priority volume:{' '}
              <strong style={{ color: 'var(--accent-yellow)', textTransform: 'capitalize' }}>
                {Array.from(staleMuscles).slice(0, 5).join(', ')}
              </strong>
            </div>
            <button
              onClick={() => handleTrainMuscles(Array.from(staleMuscles).slice(0, 5), 'Symmetry & Recovery Focus')}
              className="btn-primary"
              style={{ width: 'auto', minHeight: 38, padding: '8px 14px', fontSize: 11, borderRadius: 10 }}
            >
              <Sparkles size={13} /> Train Priority Muscles
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
