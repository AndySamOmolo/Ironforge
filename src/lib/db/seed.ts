import { db } from './schema';
import type { Exercise, WorkoutPlan, WorkoutDay, UserProfile } from '@/lib/types';

const EXERCISEDB_API = 'https://exercisedb-api.vercel.app/api/v1/exercises';

export async function seedDatabase(
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  onProgress?.('Initializing IronForge...', 5);

  // Seed exercises from bootstrapping-lab exercisedb API
  await seedExercises(onProgress);

  // Seed workout programs
  onProgress?.('Creating workout programs...', 85);
  await seedWorkoutPrograms();

  // Seed user profile
  onProgress?.('Setting up profile...', 95);
  const defaultProfile: Omit<UserProfile, 'id'> = {
    name: 'Athlete',
    unitSystem: 'metric',
    barWeight: 20,
    equipment: ['barbell', 'dumbbell', 'cable', 'body weight', 'machine', 'leverage machine'],
    defaultRestTime: 90,
    restTimerEnabled: true,
    soundEnabled: true,
    hapticEnabled: true,
    notificationsEnabled: false,
    theme: 'dark',
    isSeeded: true,
  };

  await db.userProfile.put(defaultProfile as UserProfile);
  onProgress?.('Setup complete!', 100);
}

async function seedExercises(
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  const allExercises: Omit<Exercise, 'id'>[] = [];
  let page = 0;
  const limit = 200;
  let hasMore = true;

  while (hasMore) {
    onProgress?.(`Fetching exercises (${allExercises.length}+)...`, Math.min(10 + page * 8, 75));
    try {
      const res = await fetch(`${EXERCISEDB_API}?limit=${limit}&offset=${page * limit}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      const data = json.data || json;

      if (!Array.isArray(data) || data.length === 0) { hasMore = false; break; }

      for (const raw of data) {
        allExercises.push({
          externalId: raw.exerciseId || raw.id || `ex_${allExercises.length}`,
          name: raw.name || 'Unknown',
          force: null,
          level: 'intermediate',
          mechanic: null,
          equipment: (raw.equipments || [])[0] || null,
          primaryMuscles: raw.targetMuscles || [],
          secondaryMuscles: raw.secondaryMuscles || [],
          instructions: (raw.instructions || []).map((s: string) => s.replace(/^Step:\d+\s*/i, '')),
          category: 'strength',
          images: [],
          imageUrls: [],
          gifUrl: raw.gifUrl || undefined,
          youtubeId: undefined,
          tips: [],
          commonMistakes: [],
        });
      }

      if (data.length < limit) { hasMore = false; }
      page++;

      // Small delay to be kind to the API
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.warn('ExerciseDB fetch error at page', page, err);
      hasMore = false;
    }
  }

  if (allExercises.length === 0) {
    // Fallback minimal exercises
    onProgress?.('Using fallback exercises...', 60);
    allExercises.push(...getMinimalExercises());
  }

  onProgress?.(`Saving ${allExercises.length} exercises...`, 80);
  // Bulk add in chunks
  const chunkSize = 200;
  for (let i = 0; i < allExercises.length; i += chunkSize) {
    const chunk = allExercises.slice(i, i + chunkSize);
    await db.exercises.bulkAdd(chunk as Exercise[]);
  }

  console.log(`Seeded ${allExercises.length} exercises with animated GIFs`);
}

async function seedWorkoutPrograms(): Promise<void> {
  const programs: { plan: Omit<WorkoutPlan, 'id'>; days: Omit<WorkoutDay, 'id' | 'planId'>[] }[] = [
    {
      plan: { name: 'Push / Pull / Legs', description: 'Classic 6-day hypertrophy split for intermediate lifters.', category: 'Hypertrophy', difficulty: 'intermediate', daysPerWeek: 6, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Push A', exercises: buildDay(['barbell bench press', 'overhead press', 'incline dumbbell press', 'cable fly', 'tricep pushdown', 'overhead tricep extension'], [4,4,3,3,3,3], [8,8,10,12,12,12]) },
        { dayNumber: 2, name: 'Pull A', exercises: buildDay(['barbell row', 'pull up', 'seated cable row', 'face pull', 'barbell curl', 'hammer curl'], [4,4,3,3,3,3], [8,8,10,15,10,10]) },
        { dayNumber: 3, name: 'Legs A', exercises: buildDay(['barbell squat', 'leg press', 'walking lunge', 'leg curl', 'calf raise'], [4,4,3,3,4], [8,10,10,12,15]) },
        { dayNumber: 4, name: 'Push B', exercises: buildDay(['dumbbell bench press', 'arnold press', 'cable crossover', 'dips', 'skull crusher'], [4,4,3,3,3], [10,10,12,10,12]) },
        { dayNumber: 5, name: 'Pull B', exercises: buildDay(['deadlift', 'lat pulldown', 'dumbbell row', 'reverse fly', 'incline curl'], [4,4,3,3,3], [6,10,10,12,10]) },
        { dayNumber: 6, name: 'Legs B', exercises: buildDay(['front squat', 'romanian deadlift', 'hack squat', 'leg extension', 'seated calf raise'], [4,4,3,3,4], [8,10,10,12,15]) },
      ],
    },
    {
      plan: { name: 'Upper / Lower Split', description: '4-day strength-focused split alternating upper and lower body.', category: 'Strength', difficulty: 'intermediate', daysPerWeek: 4, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Upper A', exercises: buildDay(['barbell bench press', 'barbell row', 'overhead press', 'pull up', 'tricep pushdown', 'barbell curl'], [4,4,3,3,3,3], [6,6,8,8,10,10]) },
        { dayNumber: 2, name: 'Lower A', exercises: buildDay(['barbell squat', 'romanian deadlift', 'leg press', 'leg curl', 'calf raise'], [4,4,3,3,4], [6,8,10,10,15]) },
        { dayNumber: 3, name: 'Upper B', exercises: buildDay(['incline dumbbell press', 'seated cable row', 'dumbbell shoulder press', 'lat pulldown', 'dips', 'hammer curl'], [4,4,3,3,3,3], [8,8,10,10,10,10]) },
        { dayNumber: 4, name: 'Lower B', exercises: buildDay(['deadlift', 'front squat', 'hack squat', 'seated calf raise'], [4,3,3,4], [5,8,10,15]) },
      ],
    },
    {
      plan: { name: 'StrongLifts 5×5', description: 'Classic beginner strength program. 3 compound lifts, 3 days.', category: 'Powerlifting', difficulty: 'beginner', daysPerWeek: 3, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Workout A', exercises: buildDay(['barbell squat', 'barbell bench press', 'barbell row'], [5,5,5], [5,5,5]) },
        { dayNumber: 2, name: 'Workout B', exercises: buildDay(['barbell squat', 'overhead press', 'deadlift'], [5,5,1], [5,5,5]) },
      ],
    },
    {
      plan: { name: 'Bro Split (5-Day)', description: 'Classic bodybuilder split. One muscle group per day for maximum volume.', category: 'Hypertrophy', difficulty: 'intermediate', daysPerWeek: 5, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Chest', exercises: buildDay(['barbell bench press', 'incline dumbbell press', 'cable fly', 'cable crossover', 'dips', 'push up'], [4,4,3,3,3,2], [8,10,12,15,10,20]) },
        { dayNumber: 2, name: 'Back', exercises: buildDay(['deadlift', 'barbell row', 'lat pulldown', 'seated cable row', 'straight arm pulldown'], [4,4,3,3,3], [5,8,10,10,12]) },
        { dayNumber: 3, name: 'Shoulders', exercises: buildDay(['overhead press', 'arnold press', 'lateral raise', 'face pull', 'front raise', 'barbell shrug'], [4,4,4,3,3,4], [8,10,12,15,12,10]) },
        { dayNumber: 4, name: 'Arms', exercises: buildDay(['barbell curl', 'tricep pushdown', 'hammer curl', 'skull crusher', 'preacher curl', 'dips'], [4,4,3,3,3,3], [8,10,10,10,12,10]) },
        { dayNumber: 5, name: 'Legs', exercises: buildDay(['barbell squat', 'leg press', 'romanian deadlift', 'leg extension', 'leg curl', 'calf raise'], [4,4,3,3,3,4], [8,10,10,12,12,15]) },
      ],
    },
    {
      plan: { name: 'Starting Strength', description: 'Mark Rippetoe\'s novice barbell program. Simple and effective.', category: 'Powerlifting', difficulty: 'beginner', daysPerWeek: 3, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Day A', exercises: buildDay(['barbell squat', 'overhead press', 'deadlift'], [3,3,1], [5,5,5]) },
        { dayNumber: 2, name: 'Day B', exercises: buildDay(['barbell squat', 'barbell bench press', 'barbell row'], [3,3,3], [5,5,5]) },
      ],
    },
    {
      plan: { name: 'PHUL (Power/Hypertrophy)', description: 'Power Hypertrophy Upper Lower — combines strength and size.', category: 'Hypertrophy', difficulty: 'intermediate', daysPerWeek: 4, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Upper Power', exercises: buildDay(['barbell bench press', 'barbell row', 'overhead press', 'pull up', 'barbell curl', 'tricep pushdown'], [4,4,3,3,3,3], [5,5,6,6,8,8]) },
        { dayNumber: 2, name: 'Lower Power', exercises: buildDay(['barbell squat', 'deadlift', 'leg press', 'leg curl', 'calf raise'], [4,4,3,3,4], [5,5,8,8,10]) },
        { dayNumber: 3, name: 'Upper Hypertrophy', exercises: buildDay(['incline dumbbell press', 'seated cable row', 'dumbbell shoulder press', 'lat pulldown', 'cable fly', 'hammer curl', 'skull crusher'], [4,4,3,3,3,3,3], [10,10,10,10,12,12,12]) },
        { dayNumber: 4, name: 'Lower Hypertrophy', exercises: buildDay(['front squat', 'romanian deadlift', 'hack squat', 'leg extension', 'leg curl', 'seated calf raise'], [4,3,3,3,3,4], [10,10,12,12,12,15]) },
      ],
    },
    {
      plan: { name: 'Bodyweight Home', description: 'No equipment needed. Do it anywhere, anytime.', category: 'Bodyweight', difficulty: 'beginner', daysPerWeek: 3, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Push', exercises: buildDay(['push up', 'diamond push up', 'dips', 'mountain climber', 'plank'], [4,3,3,3,3], [15,12,10,20,30]) },
        { dayNumber: 2, name: 'Pull', exercises: buildDay(['pull up', 'chin up', 'bodyweight squat', 'superman', 'hanging leg raise'], [4,3,3,3,3], [8,8,20,12,10]) },
        { dayNumber: 3, name: 'Legs & Core', exercises: buildDay(['bodyweight squat', 'lunge', 'calf raise', 'crunch', 'bicycle crunch'], [4,3,4,3,3], [20,12,20,20,20]) },
      ],
    },
    {
      plan: { name: 'Arms Specialization', description: 'Dedicated arm program for bigger biceps and triceps.', category: 'Hypertrophy', difficulty: 'intermediate', daysPerWeek: 4, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Chest & Triceps', exercises: buildDay(['barbell bench press', 'incline dumbbell press', 'cable fly', 'tricep pushdown', 'skull crusher', 'dips'], [4,4,3,4,3,3], [8,10,12,10,10,10]) },
        { dayNumber: 2, name: 'Back & Biceps', exercises: buildDay(['barbell row', 'lat pulldown', 'seated cable row', 'barbell curl', 'hammer curl', 'preacher curl'], [4,4,3,4,3,3], [8,10,10,8,10,10]) },
        { dayNumber: 3, name: 'Legs & Shoulders', exercises: buildDay(['barbell squat', 'leg press', 'leg curl', 'overhead press', 'lateral raise', 'calf raise'], [4,3,3,3,3,4], [8,10,12,8,12,15]) },
        { dayNumber: 4, name: 'Arms Blast', exercises: buildDay(['barbell curl', 'tricep pushdown', 'incline curl', 'skull crusher', 'concentration curl', 'dips'], [4,4,3,3,3,3], [8,10,10,10,12,8]) },
      ],
    },
    {
      plan: { name: 'Powerlifting Peaking', description: 'Competition prep: SBD with heavy singles and accessories.', category: 'Powerlifting', difficulty: 'expert', daysPerWeek: 4, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Heavy Squat', exercises: buildDay(['barbell squat', 'front squat', 'leg press', 'leg extension', 'plank'], [5,3,3,3,3], [3,5,8,10,30]) },
        { dayNumber: 2, name: 'Heavy Bench', exercises: buildDay(['barbell bench press', 'incline dumbbell press', 'dips', 'skull crusher', 'face pull'], [5,3,3,3,3], [3,8,8,10,15]) },
        { dayNumber: 3, name: 'Heavy Deadlift', exercises: buildDay(['deadlift', 'romanian deadlift', 'barbell row', 'barbell shrug', 'back extension'], [5,3,3,3,3], [3,6,8,8,12]) },
        { dayNumber: 4, name: 'Accessory', exercises: buildDay(['overhead press', 'pull up', 'lateral raise', 'barbell curl', 'tricep pushdown'], [4,4,3,3,3], [6,8,12,10,12]) },
      ],
    },
    {
      plan: { name: 'Full Body 3x', description: 'Efficient 3-day program hitting all major muscle groups each session.', category: 'Strength', difficulty: 'beginner', daysPerWeek: 3, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Full Body A', exercises: buildDay(['barbell squat', 'barbell bench press', 'barbell row', 'overhead press', 'barbell curl', 'plank'], [4,4,4,3,3,3], [8,8,8,8,10,30]) },
        { dayNumber: 2, name: 'Full Body B', exercises: buildDay(['deadlift', 'incline dumbbell press', 'pull up', 'dumbbell shoulder press', 'skull crusher', 'hanging leg raise'], [4,4,4,3,3,3], [6,10,8,10,10,12]) },
        { dayNumber: 3, name: 'Full Body C', exercises: buildDay(['front squat', 'dumbbell bench press', 'seated cable row', 'arnold press', 'hammer curl', 'crunch'], [4,4,4,3,3,3], [8,10,10,10,10,20]) },
      ],
    },
    {
      plan: { name: 'HIIT Conditioning', description: 'High-intensity interval training for conditioning and fat loss.', category: 'Cardio', difficulty: 'intermediate', daysPerWeek: 3, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'HIIT A', exercises: buildDay(['burpee', 'mountain climber', 'jumping jack', 'high knees', 'push up'], [4,4,4,4,3], [12,20,30,30,15]) },
        { dayNumber: 2, name: 'HIIT B', exercises: buildDay(['bodyweight squat', 'push up', 'plank', 'jumping jack', 'crunch'], [4,4,3,4,3], [20,15,30,30,20]) },
      ],
    },
    {
      plan: { name: 'Mobility & Recovery', description: 'Daily mobility work for recovery and injury prevention.', category: 'Mobility', difficulty: 'beginner', daysPerWeek: 7, isCustom: false, isActive: false, createdAt: new Date(), updatedAt: new Date() },
      days: [
        { dayNumber: 1, name: 'Full Body Stretch', exercises: buildDay(['hip stretch', 'hamstring stretch', 'shoulder stretch', 'quad stretch', 'calf stretch'], [2,2,2,2,2], [30,30,30,30,30]) },
      ],
    },
  ];

  for (const { plan, days } of programs) {
    const planId = await db.workoutPlans.add(plan as WorkoutPlan);
    for (const day of days) {
      await db.workoutDays.add({ ...day, planId } as WorkoutDay);
    }
  }
}

function buildDay(names: string[], sets: number[], reps: number[]): any[] {
  return names.map((name, i) => ({
    exerciseId: 0,
    exerciseName: name,
    sets: sets[i],
    reps: reps[i],
    restTime: 90,
    setType: 'normal',
    order: i,
  }));
}

function getMinimalExercises(): Omit<Exercise, 'id'>[] {
  return [
    { externalId: 'bench', name: 'Barbell Bench Press', force: 'push', level: 'intermediate', mechanic: 'compound', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'], instructions: ['Lie on a flat bench.', 'Grip the barbell wider than shoulder-width.', 'Lower to chest.', 'Press up.'], category: 'strength', images: [], imageUrls: [], gifUrl: undefined, tips: [], commonMistakes: [] },
    { externalId: 'squat', name: 'Barbell Squat', force: 'push', level: 'intermediate', mechanic: 'compound', equipment: 'barbell', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings'], instructions: ['Place barbell on upper back.', 'Squat until thighs are parallel.', 'Stand back up.'], category: 'strength', images: [], imageUrls: [], gifUrl: undefined, tips: [], commonMistakes: [] },
    { externalId: 'deadlift', name: 'Deadlift', force: 'pull', level: 'intermediate', mechanic: 'compound', equipment: 'barbell', primaryMuscles: ['lower back'], secondaryMuscles: ['glutes', 'hamstrings', 'quadriceps'], instructions: ['Stand with hip-width feet.', 'Grip bar.', 'Drive through heels.', 'Lower back to floor.'], category: 'strength', images: [], imageUrls: [], gifUrl: undefined, tips: [], commonMistakes: [] },
  ];
}
