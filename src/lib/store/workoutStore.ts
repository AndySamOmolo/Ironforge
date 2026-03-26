import { create } from 'zustand';
import type { ActiveExercise, ActiveSet, SetType } from '@/lib/types';

interface WorkoutState {
  isActive: boolean;
  sessionId: number | null;
  planName: string;
  dayName: string;
  exercises: ActiveExercise[];
  currentExerciseIndex: number;
  elapsedTime: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  restTimerActive: boolean;
  restTimeRemaining: number;
  restTimeDuration: number;
  newPRs: { exerciseName: string; weight: number; reps: number }[];

  startWorkout: (planName: string, dayName: string, exercises: ActiveExercise[]) => void;
  endWorkout: () => void;
  setSessionId: (id: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number, weight: number, reps: number) => void;
  updateSetWeight: (exerciseIndex: number, setIndex: number, weight: number) => void;
  updateSetReps: (exerciseIndex: number, setIndex: number, reps: number) => void;
  goToExercise: (index: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;
  addExercise: (exercise: ActiveExercise) => void;
  removeExercise: (index: number) => void;
  startRestTimer: (duration: number) => void;
  stopRestTimer: () => void;
  tickTimer: () => void;
  tickRestTimer: () => void;
  addPR: (exerciseName: string, weight: number, reps: number) => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  isActive: false,
  sessionId: null,
  planName: '',
  dayName: '',
  exercises: [],
  currentExerciseIndex: 0,
  elapsedTime: 0,
  totalVolume: 0,
  totalSets: 0,
  totalReps: 0,
  restTimerActive: false,
  restTimeRemaining: 0,
  restTimeDuration: 0,
  newPRs: [],

  startWorkout: (planName, dayName, exercises) => set({
    isActive: true,
    planName,
    dayName,
    exercises,
    currentExerciseIndex: 0,
    elapsedTime: 0,
    totalVolume: 0,
    totalSets: 0,
    totalReps: 0,
    restTimerActive: false,
    restTimeRemaining: 0,
    newPRs: [],
  }),

  endWorkout: () => set({
    isActive: false,
    sessionId: null,
    exercises: [],
    currentExerciseIndex: 0,
    elapsedTime: 0,
    restTimerActive: false,
  }),

  setSessionId: (id) => set({ sessionId: id }),

  completeSet: (exerciseIndex, setIndex, weight, reps) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], weight, reps, isComplete: true };
    exercise.sets = sets;
    
    const allComplete = sets.every(s => s.isComplete);
    exercise.isComplete = allComplete;
    exercises[exerciseIndex] = exercise;

    const volume = weight * reps;
    
    return {
      exercises,
      totalVolume: state.totalVolume + volume,
      totalSets: state.totalSets + 1,
      totalReps: state.totalReps + reps,
    };
  }),

  updateSetWeight: (exerciseIndex, setIndex, weight) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], weight };
    exercise.sets = sets;
    exercises[exerciseIndex] = exercise;
    return { exercises };
  }),

  updateSetReps: (exerciseIndex, setIndex, reps) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], reps };
    exercise.sets = sets;
    exercises[exerciseIndex] = exercise;
    return { exercises };
  }),

  goToExercise: (index) => set({ currentExerciseIndex: index }),
  
  nextExercise: () => set((state) => ({
    currentExerciseIndex: Math.min(state.currentExerciseIndex + 1, state.exercises.length - 1),
  })),

  prevExercise: () => set((state) => ({
    currentExerciseIndex: Math.max(state.currentExerciseIndex - 1, 0),
  })),

  addExercise: (exercise) => set((state) => ({
    exercises: [...state.exercises, exercise],
  })),

  removeExercise: (index) => set((state) => {
    const exercises = state.exercises.filter((_, i) => i !== index);
    return {
      exercises,
      currentExerciseIndex: Math.min(state.currentExerciseIndex, exercises.length - 1),
    };
  }),

  startRestTimer: (duration) => set({
    restTimerActive: true,
    restTimeRemaining: duration,
    restTimeDuration: duration,
  }),

  stopRestTimer: () => set({
    restTimerActive: false,
    restTimeRemaining: 0,
  }),

  tickTimer: () => set((state) => ({
    elapsedTime: state.elapsedTime + 1,
  })),

  tickRestTimer: () => set((state) => {
    const remaining = state.restTimeRemaining - 1;
    if (remaining <= 0) {
      return { restTimerActive: false, restTimeRemaining: 0 };
    }
    return { restTimeRemaining: remaining };
  }),

  addPR: (exerciseName, weight, reps) => set((state) => ({
    newPRs: [...state.newPRs, { exerciseName, weight, reps }],
  })),
}));
