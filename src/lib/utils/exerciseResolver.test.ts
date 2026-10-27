import { describe, it, expect } from 'vitest';
import {
  matchesUserEquipment,
  getExerciseRequiredEquipment,
  resolveWorkoutDayExercises,
  generateSmartWorkout,
} from './exerciseResolver';
import type { Exercise, WorkoutDayExercise } from '@/lib/types';
import { SetType } from '@/lib/types';

const MOCK_EXERCISES: Exercise[] = [
  {
    id: 1,
    externalId: 'ex1',
    name: 'Cable Fly',
    force: 'push',
    level: 'intermediate',
    mechanic: 'isolation',
    equipment: 'cable',
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['shoulders'],
    instructions: ['Step 1'],
    category: 'strength',
    images: [],
    imageUrls: [],
  },
  {
    id: 2,
    externalId: 'ex2',
    name: 'inverse leg curl (on pull-up cable machine)',
    force: 'pull',
    level: 'intermediate',
    mechanic: 'isolation',
    equipment: 'body weight', // Mislabeled in raw DB, name says cable!
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    instructions: ['Step 1'],
    category: 'strength',
    images: [],
    imageUrls: [],
  },
  {
    id: 3,
    externalId: 'ex3',
    name: 'Dumbbell Fly',
    force: 'push',
    level: 'intermediate',
    mechanic: 'isolation',
    equipment: 'dumbbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    instructions: ['Step 1'],
    category: 'strength',
    images: [],
    imageUrls: [],
  },
  {
    id: 4,
    externalId: 'ex4',
    name: 'Incline Dumbbell Fly',
    force: 'push',
    level: 'intermediate',
    mechanic: 'isolation',
    equipment: 'dumbbell',
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['shoulders'],
    instructions: ['Step 1'],
    category: 'strength',
    images: [],
    imageUrls: [],
  },
  {
    id: 5,
    externalId: 'ex5',
    name: 'Push-Up',
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'body weight',
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['triceps'],
    instructions: ['Step 1'],
    category: 'strength',
    images: [],
    imageUrls: [],
  },
];

describe('exerciseResolver equipment filtering & anti-repetition', () => {
  it('detects cable requirement even when raw equipment field is mislabeled', () => {
    expect(getExerciseRequiredEquipment(MOCK_EXERCISES[0])).toContain('cable');
    expect(getExerciseRequiredEquipment(MOCK_EXERCISES[1])).toContain('cable');
    expect(matchesUserEquipment(MOCK_EXERCISES[0], ['dumbbell', 'body weight'])).toBe(false);
    expect(matchesUserEquipment(MOCK_EXERCISES[1], ['dumbbell', 'body weight'])).toBe(false);
    expect(matchesUserEquipment(MOCK_EXERCISES[2], ['dumbbell', 'body weight'])).toBe(true);
  });

  it('replaces cable exercises with non-repeating dumbbell/bodyweight alternatives when cable is not selected', () => {
    const dayExercises: WorkoutDayExercise[] = [
      { exerciseId: 0, exerciseName: 'cable fly', sets: 3, reps: 12, restTime: 90, setType: SetType.Normal, order: 0 },
      { exerciseId: 0, exerciseName: 'cable crossover', sets: 3, reps: 12, restTime: 90, setType: SetType.Normal, order: 1 },
    ];

    const resolved = resolveWorkoutDayExercises({
      dayExercises,
      allExercises: MOCK_EXERCISES,
      userEquipment: ['dumbbell', 'body weight'],
      barWeight: 20,
      dumbbellWeight: 10,
      varietySeed: 0,
      varietyLevel: 'medium',
    });

    expect(resolved).toHaveLength(2);
    expect(resolved[0].exerciseName.toLowerCase()).not.toContain('cable');
    expect(resolved[1].exerciseName.toLowerCase()).not.toContain('cable');
    // Must not repeat the same exercise within the same day
    expect(resolved[0].exerciseId).not.toBe(resolved[1].exerciseId);
  });

  it('generates smart workouts strictly matching selected equipment', () => {
    const generated = generateSmartWorkout({
      targetMuscles: ['chest'],
      exerciseCount: 2,
      allExercises: MOCK_EXERCISES,
      userEquipment: ['dumbbell', 'body weight'],
    });
    expect(generated).toHaveLength(2);
    expect(generated[0].name).not.toBe(generated[1].name);
    for (const item of generated) {
      expect(item.name.toLowerCase()).not.toContain('cable');
    }
  });
});
