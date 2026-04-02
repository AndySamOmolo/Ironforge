// ===== ENUMS =====

export enum MuscleGroup {
  Chest = 'chest',
  Back = 'back',
  Shoulders = 'shoulders',
  Biceps = 'biceps',
  Triceps = 'triceps',
  Forearms = 'forearms',
  Abs = 'abdominals',
  Obliques = 'obliques',
  Quads = 'quadriceps',
  Hamstrings = 'hamstrings',
  Glutes = 'glutes',
  Calves = 'calves',
  Cardio = 'cardio',
  Traps = 'traps',
  Lats = 'lats',
  LowerBack = 'lower back',
  MiddleBack = 'middle back',
  Neck = 'neck',
  Adductors = 'adductors',
  Abductors = 'abductors',
}

export enum Equipment {
  Barbell = 'barbell',
  Dumbbell = 'dumbbell',
  Cable = 'cable',
  Machine = 'machine',
  Bodyweight = 'body only',
  Kettlebell = 'kettlebells',
  ResistanceBand = 'bands',
  FoamRoll = 'foam roll',
  MedicineBall = 'medicine ball',
  ExerciseBall = 'exercise ball',
  EZBar = 'e-z curl bar',
  Other = 'other',
  None = 'none',
}

export enum MovementPattern {
  PushHorizontal = 'push_horizontal',
  PushVertical = 'push_vertical',
  PullHorizontal = 'pull_horizontal',
  PullVertical = 'pull_vertical',
  Squat = 'squat',
  Hinge = 'hinge',
  Carry = 'carry',
  Core = 'core',
  Isolation = 'isolation',
  Cardio = 'cardio',
  Stretch = 'stretch',
}

export enum SetType {
  Normal = 'normal',
  Warmup = 'warmup',
  DropSet = 'dropset',
  Superset = 'superset',
  AMRAP = 'amrap',
  Timed = 'timed',
  Failure = 'failure',
  RestPause = 'restpause',
}

export enum ForceType {
  Push = 'push',
  Pull = 'pull',
  Static = 'static',
}

export enum Difficulty {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'expert',
}

export enum ExerciseCategory {
  Strength = 'strength',
  Stretching = 'stretching',
  Plyometrics = 'plyometrics',
  Strongman = 'strongman',
  Powerlifting = 'powerlifting',
  Cardio = 'cardio',
  OlympicWeightlifting = 'olympic weightlifting',
}

// ===== DATABASE ENTITIES =====

export interface Exercise {
  id?: number;
  externalId: string; // from free-exercise-db
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[]; // relative paths like "Bench_Press/0.jpg"
  imageUrls: string[]; // full URLs
  gifUrl?: string; // from ExerciseDB API
  youtubeId?: string;
  tips?: string[];
  commonMistakes?: string[];
}

export interface WorkoutPlan {
  id?: number;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  daysPerWeek: number;
  isCustom: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutDay {
  id?: number;
  planId: number;
  dayNumber: number;
  name: string;
  exercises: WorkoutDayExercise[];
}

export interface WorkoutDayExercise {
  exerciseId: number;
  exerciseName: string;
  sets: number;
  reps: number | string; // string for "AMRAP", "30s", etc.
  weight?: number;
  restTime: number; // seconds
  setType: SetType;
  order: number;
}

export interface WorkoutSession {
  id?: number;
  planId?: number;
  dayId?: number;
  planName?: string;
  dayName?: string;
  startedAt: Date;
  completedAt?: Date;
  duration: number; // seconds
  totalVolume: number; // kg
  totalSets: number;
  totalReps: number;
  notes?: string;
  rating?: number; // 1-5
  isComplete: boolean;
}

export interface SessionExercise {
  id?: number;
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  originalExerciseId?: number;
  wasSwapped: boolean;
  orderIndex: number;
  notes?: string;
}

export interface WorkoutSet {
  id?: number;
  sessionExerciseId: number;
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  setType: SetType;
  weight: number;
  reps: number;
  duration?: number;
  rpe?: number;
  completedAt?: Date;
  isWarmup: boolean;
  isPR: boolean;
}

export interface PersonalRecord {
  id?: number;
  exerciseId: number;
  exerciseName: string;
  weight: number;
  reps: number;
  estimated1RM: number;
  date: Date;
  sessionId: number;
}

export interface BodyWeight {
  id?: number;
  date: Date;
  weight: number;
  unit: 'kg' | 'lbs';
  note?: string;
}

export interface Measurement {
  id?: number;
  date: Date;
  chest?: number;
  waist?: number;
  hips?: number;
  leftArm?: number;
  rightArm?: number;
  leftThigh?: number;
  rightThigh?: number;
  neck?: number;
  shoulders?: number;
}

export interface NutritionLog {
  id?: number;
  date: Date;
  meal: string;
  food: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface WaterLog {
  id?: number;
  date: Date;
  glasses: number;
}

export interface UserProfile {
  id?: number;
  name: string;
  age?: number;
  height?: number;
  weight?: number;
  goal?: string;
  experience?: string;
  equipment: string[];
  unitSystem: 'metric' | 'imperial';
  barWeight: number;
  dumbbellWeight?: number;
  defaultRestTime: number;
  restTimerEnabled: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  notificationsEnabled: boolean;
  theme: string;
  isSeeded: boolean;
}

// ===== UI TYPES =====

export interface ActiveExercise {
  exerciseId: number;
  exerciseName: string;
  imageUrl?: string;
  gifUrl?: string;
  sets: ActiveSet[];
  targetSets: number;
  targetReps: number | string;
  restTime: number;
  previousBest?: { weight: number; reps: number; date: string };
  isComplete: boolean;
}

export interface ActiveSet {
  setNumber: number;
  setType: SetType;
  weight: number;
  reps: number;
  targetWeight: number;
  targetReps: number;
  isComplete: boolean;
  rpe?: number;
  isPR?: boolean;
}

export interface SwapSuggestion {
  exercise: Exercise;
  score: number;
  matchReasons: string[];
  category: 'perfect' | 'good' | 'home' | 'related';
}

// ===== MUSCLE COLOR MAP =====

export const MUSCLE_COLORS: Record<string, string> = {
  chest: '#FF6B6B',
  pectorals: '#FF6B6B',
  back: '#4ECDC4',
  'upper back': '#4ECDC4',
  shoulders: '#A78BFA',
  delts: '#A78BFA',
  deltoids: '#A78BFA',
  biceps: '#60A5FA',
  triceps: '#34D399',
  forearms: '#6EE7B7',
  abdominals: '#F97316',
  abs: '#F97316',
  obliques: '#F97316',
  core: '#F97316',
  quadriceps: '#F59E0B',
  quads: '#F59E0B',
  hamstrings: '#EF4444',
  glutes: '#EC4899',
  calves: '#8B5CF6',
  cardio: '#0EA5E9',
  'cardiovascular system': '#0EA5E9',
  traps: '#0EA5E9',
  lats: '#10B981',
  'lower back': '#4ECDC4',
  'middle back': '#4ECDC4',
  spine: '#4ECDC4',
  neck: '#A78BFA',
  adductors: '#EC4899',
  abductors: '#EC4899',
  'rotator cuff': '#A78BFA',
  'hip flexors': '#EC4899',
  serratus: '#FF6B6B',
  'serratus anterior': '#FF6B6B',
};
