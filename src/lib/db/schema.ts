import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  WorkoutPlan,
  WorkoutDay,
  WorkoutSession,
  SessionExercise,
  WorkoutSet,
  PersonalRecord,
  BodyWeight,
  Measurement,
  NutritionLog,
  WaterLog,
  UserProfile,
  WorkoutReminder,
} from '@/lib/types';

export interface ExerciseSwap {
  id?: number;
  planName: string;
  dayName: string;
  originalExerciseName: string;
  newExerciseId: number;
  newExerciseName: string;
  newGifUrl?: string;
  swappedAt: Date;
}

export class IronForgeDB extends Dexie {
  exercises!: Table<Exercise>;
  workoutPlans!: Table<WorkoutPlan>;
  workoutDays!: Table<WorkoutDay>;
  workoutSessions!: Table<WorkoutSession>;
  sessionExercises!: Table<SessionExercise>;
  sets!: Table<WorkoutSet>;
  personalRecords!: Table<PersonalRecord>;
  bodyWeight!: Table<BodyWeight>;
  measurements!: Table<Measurement>;
  nutritionLogs!: Table<NutritionLog>;
  waterLogs!: Table<WaterLog>;
  userProfile!: Table<UserProfile>;
  exerciseSwaps!: Table<ExerciseSwap>;
  workoutReminders!: Table<WorkoutReminder>;

  constructor() {
    super('IronForgeDB');

    // Single comprehensive version to avoid upgrade chain issues on Android
    this.version(4).stores({
      exercises: '++id, externalId, name, *primaryMuscles, equipment, category, level',
      workoutPlans: '++id, name, category, isCustom, isActive, createdAt',
      workoutDays: '++id, planId, dayNumber',
      workoutSessions: '++id, planId, dayId, startedAt, completedAt, isComplete',
      sessionExercises: '++id, sessionId, exerciseId, orderIndex',
      sets: '++id, sessionExerciseId, sessionId, exerciseId, completedAt',
      personalRecords: '++id, exerciseId, date, estimated1RM',
      bodyWeight: '++id, date',
      measurements: '++id, date',
      nutritionLogs: '++id, date, meal',
      waterLogs: '++id, date',
      userProfile: '++id',
      exerciseSwaps: '++id, planName, dayName',
    });

    this.version(5).stores({
      exercises: '++id, externalId, name, *primaryMuscles, equipment, category, level',
      workoutPlans: '++id, name, category, isCustom, isActive, createdAt',
      workoutDays: '++id, planId, dayNumber',
      workoutSessions: '++id, planId, dayId, startedAt, completedAt, isComplete, planName',
      sessionExercises: '++id, sessionId, exerciseId, orderIndex',
      sets: '++id, sessionExerciseId, sessionId, exerciseId, completedAt',
      personalRecords: '++id, exerciseId, date, estimated1RM',
      bodyWeight: '++id, date',
      measurements: '++id, date',
      nutritionLogs: '++id, date, meal',
      waterLogs: '++id, date',
      userProfile: '++id',
      exerciseSwaps: '++id, planName, dayName, [planName+dayName], originalExerciseName, newExerciseId, swappedAt',
      workoutReminders: '++id, dayOfWeek, isEnabled',
    });

    this.version(6).stores({
      exercises: '++id, externalId, name, *primaryMuscles, equipment, category, level',
      workoutPlans: '++id, name, category, isCustom, isActive, createdAt',
      workoutDays: '++id, planId, dayNumber',
      workoutSessions: '++id, startedAt, completedAt, isComplete, planName',
      sessionExercises: '++id, sessionId, exerciseId, orderIndex',
      sets: '++id, sessionExerciseId, sessionId, exerciseId, completedAt',
      personalRecords: '++id, exerciseId, date, estimated1RM',
      bodyWeight: '++id, date',
      measurements: '++id, date',
      nutritionLogs: '++id, date, meal',
      waterLogs: '++id, date',
      userProfile: '++id',
      exerciseSwaps: '++id, planName, dayName, [planName+dayName], originalExerciseName, newExerciseId, swappedAt',
      workoutReminders: '++id, dayOfWeek, isEnabled',
    });
  }
}

let dbInstance: IronForgeDB | null = null;

export function getDB(): IronForgeDB {
  if (!dbInstance) {
    dbInstance = new IronForgeDB();
  }
  return dbInstance;
}

// Reset the DB instance (for retry after failures)
export async function resetDB(allowDestructiveDelete = false): Promise<IronForgeDB> {
  if (dbInstance) {
    try { dbInstance.close(); } catch {}
  }
  dbInstance = null;
  try {
    const newDb = getDB();
    await newDb.open();
    return newDb;
  } catch (err) {
    if (allowDestructiveDelete === true) {
      console.error('DB open failed, attempting delete + recreate:', err);
      try {
        await Dexie.delete('IronForgeDB');
      } catch {}
      dbInstance = null;
      const freshDb = getDB();
      await freshDb.open();
      return freshDb;
    }
    console.error('DB open failed without destructive delete permission:', err);
    throw err;
  }
}

export const db = getDB();
