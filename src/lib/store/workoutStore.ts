import { create } from 'zustand';
import { SetType, type ActiveExercise } from '@/lib/types';

const STORAGE_KEY = 'ironforge_active_workout_v1';

const SET_TYPE_ORDER: SetType[] = [
  SetType.Normal,
  SetType.Warmup,
  SetType.DropSet,
  SetType.Failure,
  SetType.AMRAP,
];

interface PersistedWorkoutSnapshot {
  isActive: boolean;
  isMinimized?: boolean;
  isPaused: boolean;
  sessionId: number | null;
  planName: string;
  dayName: string;
  exercises: ActiveExercise[];
  currentExerciseIndex: number;
  elapsedTime: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  newPRs: { exerciseName: string; weight: number; reps: number }[];
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function saveSnapshot(state: Partial<PersistedWorkoutSnapshot>, immediate = false) {
  if (typeof window === 'undefined') return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const writeNow = () => {
    try {
      if (!state.isActive) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  };

  if (immediate || !state.isActive) {
    writeNow();
  } else {
    debounceTimer = setTimeout(writeNow, 220);
  }
}

function loadSnapshot(): Partial<PersistedWorkoutSnapshot> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.isActive && Array.isArray(parsed.exercises) && parsed.exercises.length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}

function recomputeTotals(exercises: ActiveExercise[]) {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.isComplete) {
        totalVolume += (s.weight || 0) * (s.reps || 0);
        totalSets += 1;
        totalReps += s.reps || 0;
      }
    }
  }
  return { totalVolume, totalSets, totalReps };
}

interface WorkoutState {
  isActive: boolean;
  isMinimized: boolean;
  isPaused: boolean;
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
  restTimerPaused: boolean;
  restTimeRemaining: number;
  restTimeDuration: number;
  newPRs: { exerciseName: string; weight: number; reps: number }[];

  startWorkout: (planName: string, dayName: string, exercises: ActiveExercise[]) => void;
  restoreWorkoutIfAny: () => void;
  setMinimized: (minimized: boolean) => void;
  completeWorkoutSession: (id: number) => void;
  endWorkout: () => void;
  setSessionId: (id: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number, weight: number, reps: number, isPR?: boolean) => void;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  updateSetWeight: (exerciseIndex: number, setIndex: number, weight: number) => void;
  updateSetReps: (exerciseIndex: number, setIndex: number, reps: number) => void;
  cycleSetType: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  goToExercise: (index: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;
  addExercise: (exercise: ActiveExercise) => void;
  removeExercise: (index: number) => void;
  swapExercise: (index: number, newExercise: ActiveExercise) => void;
  startRestTimer: (duration: number) => void;
  toggleRestPause: () => void;
  resetRestTimer: () => void;
  stopRestTimer: () => void;
  tickTimer: () => void;
  tickRestTimer: () => void;
  addPR: (exerciseName: string, weight: number, reps: number) => void;
  togglePause: () => void;
  resetElapsedTime: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  isActive: false,
  isMinimized: false,
  isPaused: false,
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
  restTimerPaused: false,
  restTimeRemaining: 0,
  restTimeDuration: 90,
  newPRs: [],

  startWorkout: (planName, dayName, exercises) => {
    const nextState = {
      isActive: true,
      isMinimized: false,
      isPaused: false,
      sessionId: null,
      planName,
      dayName,
      exercises,
      currentExerciseIndex: 0,
      elapsedTime: 0,
      totalVolume: 0,
      totalSets: 0,
      totalReps: 0,
      restTimerActive: false,
      restTimerPaused: false,
      restTimeRemaining: 0,
      restTimeDuration: exercises[0]?.restTime || 90,
      newPRs: [],
    };
    saveSnapshot(nextState, true);
    set(nextState);
  },

  restoreWorkoutIfAny: () => {
    const snap = loadSnapshot();
    if (snap && snap.isActive) {
      set({
        isActive: true,
        isMinimized: Boolean(snap.isMinimized),
        isPaused: Boolean(snap.isPaused),
        sessionId: snap.sessionId ?? null,
        planName: snap.planName || 'Workout',
        dayName: snap.dayName || '',
        exercises: snap.exercises || [],
        currentExerciseIndex: snap.currentExerciseIndex || 0,
        elapsedTime: snap.elapsedTime || 0,
        totalVolume: snap.totalVolume || 0,
        totalSets: snap.totalSets || 0,
        totalReps: snap.totalReps || 0,
        newPRs: snap.newPRs || [],
      });
    }
  },

  setMinimized: (isMinimized) => set((state) => {
    saveSnapshot({ ...state, isMinimized }, true);
    return { isMinimized };
  }),

  completeWorkoutSession: (id) => {
    saveSnapshot({ isActive: false }, true);
    set({
      isActive: false,
      isMinimized: false,
      isPaused: false,
      restTimerActive: false,
      restTimerPaused: false,
      restTimeRemaining: 0,
      sessionId: id,
    });
  },

  endWorkout: () => {
    saveSnapshot({ isActive: false }, true);
    set({
      isActive: false,
      isMinimized: false,
      isPaused: false,
      sessionId: null,
      exercises: [],
      currentExerciseIndex: 0,
      elapsedTime: 0,
      totalVolume: 0,
      totalSets: 0,
      totalReps: 0,
      newPRs: [],
      restTimerActive: false,
      restTimerPaused: false,
      restTimeRemaining: 0,
    });
  },

  setSessionId: (id) => set((state) => {
    const next = { ...state, sessionId: id };
    saveSnapshot(next, true);
    return { sessionId: id };
  }),

  completeSet: (exerciseIndex, setIndex, weight, reps, isPR = false) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], weight, reps, isComplete: true, isPR };
    exercise.sets = sets;
    exercise.isComplete = sets.every(s => s.isComplete);
    exercises[exerciseIndex] = exercise;

    const totals = recomputeTotals(exercises);
    const next = { ...state, exercises, ...totals };
    saveSnapshot(next, true);
    return { exercises, ...totals };
  }),

  uncompleteSet: (exerciseIndex, setIndex) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], isComplete: false, isPR: false };
    exercise.sets = sets;
    exercise.isComplete = sets.every(s => s.isComplete);
    exercises[exerciseIndex] = exercise;

    const totals = recomputeTotals(exercises);
    const next = { ...state, exercises, ...totals };
    saveSnapshot(next, true);
    return { exercises, ...totals };
  }),

  updateSetWeight: (exerciseIndex, setIndex, weight) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    const previousFirstWeight = sets[0]?.weight;

    if (setIndex === 0) {
      exercise.sets = sets.map((s, idx) => {
        if (idx === 0) return { ...s, weight };
        if (!s.isComplete && s.weight === previousFirstWeight) {
          return { ...s, weight };
        }
        return s;
      });
    } else {
      sets[setIndex] = { ...sets[setIndex], weight };
      exercise.sets = sets;
    }
    exercises[exerciseIndex] = exercise;
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals }, false);
    return { exercises, ...totals };
  }),

  updateSetReps: (exerciseIndex, setIndex, reps) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    const previousFirstReps = sets[0]?.reps;

    if (setIndex === 0) {
      exercise.sets = sets.map((s, idx) => {
        if (idx === 0) return { ...s, reps };
        if (!s.isComplete && s.reps === previousFirstReps) {
          return { ...s, reps };
        }
        return s;
      });
    } else {
      sets[setIndex] = { ...sets[setIndex], reps };
      exercise.sets = sets;
    }
    exercises[exerciseIndex] = exercise;
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals }, false);
    return { exercises, ...totals };
  }),

  cycleSetType: (exerciseIndex, setIndex) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    const currentType = sets[setIndex].setType || SetType.Normal;
    const nextIdx = (SET_TYPE_ORDER.indexOf(currentType) + 1) % SET_TYPE_ORDER.length;
    sets[setIndex] = { ...sets[setIndex], setType: SET_TYPE_ORDER[nextIdx] };
    exercise.sets = sets;
    exercises[exerciseIndex] = exercise;
    saveSnapshot({ ...state, exercises }, false);
    return { exercises };
  }),

  addSet: (exerciseIndex) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    const lastSet = sets[sets.length - 1];
    const newSet = {
      setNumber: sets.length + 1,
      setType: SetType.Normal,
      weight: lastSet ? lastSet.weight : 0,
      reps: lastSet ? (lastSet.reps || lastSet.targetReps) : 10,
      targetWeight: lastSet ? lastSet.targetWeight : 0,
      targetReps: lastSet ? lastSet.targetReps : 10,
      isComplete: false,
    };
    exercise.sets = [...sets, newSet];
    exercise.targetSets = exercise.sets.length;
    exercise.isComplete = false;
    exercises[exerciseIndex] = exercise;
    saveSnapshot({ ...state, exercises }, true);
    return { exercises };
  }),

  removeSet: (exerciseIndex, setIndex) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    if (exercise.sets.length <= 1) return {};
    const sets = exercise.sets
      .filter((_, idx) => idx !== setIndex)
      .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    exercise.sets = sets;
    exercise.targetSets = sets.length;
    exercise.isComplete = sets.every(s => s.isComplete);
    exercises[exerciseIndex] = exercise;
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals }, true);
    return { exercises, ...totals };
  }),

  goToExercise: (index) => set((state) => {
    saveSnapshot({ ...state, currentExerciseIndex: index }, false);
    return { currentExerciseIndex: index };
  }),

  nextExercise: () => set((state) => {
    const nextIdx = Math.min(state.currentExerciseIndex + 1, state.exercises.length - 1);
    saveSnapshot({ ...state, currentExerciseIndex: nextIdx }, false);
    return { currentExerciseIndex: nextIdx };
  }),

  prevExercise: () => set((state) => {
    const prevIdx = Math.max(state.currentExerciseIndex - 1, 0);
    saveSnapshot({ ...state, currentExerciseIndex: prevIdx }, false);
    return { currentExerciseIndex: prevIdx };
  }),

  addExercise: (exercise) => set((state) => {
    const exercises = [...state.exercises, exercise];
    const currentExerciseIndex = exercises.length - 1;
    saveSnapshot({ ...state, exercises, currentExerciseIndex }, true);
    return { exercises, currentExerciseIndex };
  }),

  removeExercise: (index) => set((state) => {
    if (state.exercises.length <= 1) return {};
    const exercises = state.exercises.filter((_, i) => i !== index);
    const currentExerciseIndex = Math.min(state.currentExerciseIndex, exercises.length - 1);
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, currentExerciseIndex, ...totals }, true);
    return { exercises, currentExerciseIndex, ...totals };
  }),

  swapExercise: (index, newExercise) => set((state) => {
    const exercises = [...state.exercises];
    exercises[index] = newExercise;
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals }, true);
    return { exercises, ...totals };
  }),

  startRestTimer: (duration) => set({
    restTimerActive: true,
    restTimerPaused: false,
    restTimeRemaining: Math.max(1, duration),
    restTimeDuration: Math.max(1, duration),
  }),

  toggleRestPause: () => set((state) => ({
    restTimerPaused: !state.restTimerPaused,
  })),

  resetRestTimer: () => set((state) => ({
    restTimerActive: true,
    restTimerPaused: false,
    restTimeRemaining: state.restTimeDuration || 90,
  })),

  stopRestTimer: () => set({
    restTimerActive: false,
    restTimerPaused: false,
    restTimeRemaining: 0,
  }),

  tickTimer: () => set((state) => {
    if (state.isPaused || !state.isActive) return {};
    const elapsedTime = state.elapsedTime + 1;
    if (elapsedTime % 5 === 0) {
      saveSnapshot({ ...state, elapsedTime }, false);
    }
    return { elapsedTime };
  }),

  tickRestTimer: () => set((state) => {
    if (!state.restTimerActive || state.restTimerPaused) return {};
    const remaining = state.restTimeRemaining - 1;
    if (remaining <= 0) {
      return { restTimerActive: false, restTimerPaused: false, restTimeRemaining: 0 };
    }
    return { restTimeRemaining: remaining };
  }),

  addPR: (exerciseName, weight, reps) => set((state) => {
    const filtered = state.newPRs.filter(p => p.exerciseName !== exerciseName);
    const newPRs = [...filtered, { exerciseName, weight, reps }];
    saveSnapshot({ ...state, newPRs }, true);
    return { newPRs };
  }),

  togglePause: () => set((state) => {
    const isPaused = !state.isPaused;
    saveSnapshot({ ...state, isPaused }, true);
    return { isPaused };
  }),

  resetElapsedTime: () => set((state) => {
    saveSnapshot({ ...state, elapsedTime: 0 }, true);
    return { elapsedTime: 0 };
  }),
}));
