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
} from '@/lib/types';

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

  constructor() {
    super('IronForgeDB');

    this.version(1).stores({
      exercises: '++id, externalId, name, *primaryMuscles, equipment, category, level',
      workoutPlans: '++id, name, category, isCustom, createdAt',
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
    });
  }
}

export const db = new IronForgeDB();
