import { create } from 'zustand';
import { SetType, type ActiveExercise } from '@/lib/types';

const STORAGE_KEY = 'ironforge_active_workout_v1';

let noteSaveTimeout: ReturnType<typeof setTimeout> | null = null;

const SET_TYPE_ORDER: SetType[] = [
  SetType.Normal,
  SetType.Warmup,
  SetType.DropSet,
  SetType.Failure,
  SetType.AMRAP,
];

interface PersistedWorkoutSnapshot {
  isActive: boolean;
  isPaused: boolean;
  isMinimized?: boolean;
  sessionId: number | null;
  planName: string;
  dayName: string;
  exercises: ActiveExercise[];
  currentExerciseIndex: number;
  elapsedTime: number;
  lastTickAt?: number | null;
  restTimerActive?: boolean;
  restTimeRemaining?: number;
  restTimeDuration?: number;
  restEndTimeMs?: number | null;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  newPRs: { exerciseName: string; weight: number; reps: number }[];
}

function saveSnapshot(state: Partial<PersistedWorkoutSnapshot>) {
  if (typeof window === 'undefined') return;
  try {
    if (!state.isActive) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
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

function estimateSet1RM(weight: number, reps: number): number {
  if (!weight || weight <= 0 || !reps || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
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
  isPaused: boolean;
  isMinimized: boolean;
  sessionId: number | null;
  planName: string;
  dayName: string;
  exercises: ActiveExercise[];
  currentExerciseIndex: number;
  elapsedTime: number;
  lastTickAt: number | null;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  restTimerActive: boolean;
  restTimeRemaining: number;
  restTimeDuration: number;
  restEndTimeMs: number | null;
  newPRs: { exerciseName: string; weight: number; reps: number }[];

  startWorkout: (planName: string, dayName: string, exercises: ActiveExercise[]) => void;
  restoreWorkoutIfAny: () => void;
  completeWorkoutSession: (id: number) => void;
  endWorkout: () => void;
  setSessionId: (id: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number, weight: number, reps: number, isPR?: boolean) => void;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  updateSetWeight: (exerciseIndex: number, setIndex: number, weight: number) => void;
  updateSetReps: (exerciseIndex: number, setIndex: number, reps: number) => void;
  updateExerciseNote: (exerciseIndex: number, note: string) => void;
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
  stopRestTimer: () => void;
  tickTimer: () => void;
  tickRestTimer: () => void;
  addPR: (exerciseName: string, weight: number, reps: number) => void;
  setNewPRs: (prs: { exerciseName: string; weight: number; reps: number }[]) => void;
  syncExercisePRs: (exerciseIndex: number, historicalBest1RM: number) => boolean;
  togglePause: () => void;
  minimizeWorkout: () => void;
  resumeWorkout: () => void;
  resetTimer: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  isActive: false,
  isPaused: false,
  isMinimized: false,
  sessionId: null,
  planName: '',
  dayName: '',
  exercises: [],
  currentExerciseIndex: 0,
  elapsedTime: 0,
  lastTickAt: null,
  totalVolume: 0,
  totalSets: 0,
  totalReps: 0,
  restTimerActive: false,
  restTimeRemaining: 0,
  restTimeDuration: 0,
  restEndTimeMs: null,
  newPRs: [],

  startWorkout: (planName, dayName, exercises) => {
    const current = get();
    if (current.isActive && typeof window !== 'undefined') {
      const completedSets = current.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.isComplete).length, 0);
      if (completedSets > 0 && !window.confirm('You have an active workout in progress with completed sets. Replace it with a new workout?')) {
        return;
      }
    }
    if (noteSaveTimeout) {
      clearTimeout(noteSaveTimeout);
      noteSaveTimeout = null;
    }
    const nextState = {
      isActive: true,
      isPaused: true,
      isMinimized: false,
      sessionId: null,
      planName,
      dayName,
      exercises,
      currentExerciseIndex: 0,
      elapsedTime: 0,
      lastTickAt: null,
      totalVolume: 0,
      totalSets: 0,
      totalReps: 0,
      restTimerActive: false,
      restTimeRemaining: 0,
      restTimeDuration: 0,
      restEndTimeMs: null,
      newPRs: [],
    };
    saveSnapshot(nextState);
    set(nextState);
  },

  restoreWorkoutIfAny: () => {
    const snap = loadSnapshot();
    if (snap && snap.isActive) {
      const now = Date.now();
      const isPaused = Boolean(snap.isPaused);
      let elapsedTime = snap.elapsedTime || 0;
      if (!isPaused && snap.lastTickAt && now > snap.lastTickAt) {
        elapsedTime += Math.floor((now - snap.lastTickAt) / 1000);
      }

      let restTimerActive = Boolean(snap.restTimerActive);
      let restTimeRemaining = snap.restTimeRemaining || 0;
      const restEndTimeMs = snap.restEndTimeMs ?? null;
      if (restTimerActive && restEndTimeMs) {
        const diffSec = Math.ceil((restEndTimeMs - now) / 1000);
        if (diffSec > 0) {
          restTimeRemaining = diffSec;
        } else {
          restTimerActive = false;
          restTimeRemaining = 0;
        }
      }

      set({
        isActive: true,
        isPaused,
        isMinimized: Boolean(snap.isMinimized),
        sessionId: snap.sessionId ?? null,
        planName: snap.planName || 'Workout',
        dayName: snap.dayName || '',
        exercises: snap.exercises || [],
        currentExerciseIndex: snap.currentExerciseIndex || 0,
        elapsedTime,
        lastTickAt: isPaused ? null : now,
        restTimerActive,
        restTimeRemaining,
        restTimeDuration: snap.restTimeDuration || 0,
        restEndTimeMs: restTimerActive ? restEndTimeMs : null,
        totalVolume: snap.totalVolume || 0,
        totalSets: snap.totalSets || 0,
        totalReps: snap.totalReps || 0,
        newPRs: snap.newPRs || [],
      });
    }
  },

  completeWorkoutSession: (id) => {
    if (noteSaveTimeout) {
      clearTimeout(noteSaveTimeout);
      noteSaveTimeout = null;
      saveSnapshot(get());
    }
    saveSnapshot({ isActive: false });
    set({
      isActive: false,
      isPaused: false,
      isMinimized: false,
      lastTickAt: null,
      restTimerActive: false,
      restTimeRemaining: 0,
      restEndTimeMs: null,
      sessionId: id,
    });
  },

  endWorkout: () => {
    if (noteSaveTimeout) {
      clearTimeout(noteSaveTimeout);
      noteSaveTimeout = null;
      saveSnapshot(get());
    }
    saveSnapshot({ isActive: false });
    set({
      isActive: false,
      isPaused: false,
      isMinimized: false,
      sessionId: null,
      exercises: [],
      currentExerciseIndex: 0,
      elapsedTime: 0,
      lastTickAt: null,
      totalVolume: 0,
      totalSets: 0,
      totalReps: 0,
      newPRs: [],
      restTimerActive: false,
      restTimeRemaining: 0,
      restEndTimeMs: null,
    });
  },

  setSessionId: (id) => set((state) => {
    const next = { ...state, sessionId: id };
    saveSnapshot(next);
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

    const now = Date.now();
    const totals = recomputeTotals(exercises);
    const next = { ...state, isPaused: false, lastTickAt: state.lastTickAt || now, exercises, ...totals };
    saveSnapshot(next);
    return { isPaused: false, lastTickAt: state.lastTickAt || now, exercises, ...totals };
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
    saveSnapshot(next);
    return { exercises, ...totals };
  }),

  updateSetWeight: (exerciseIndex, setIndex, weight) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    const safeWeight = Math.max(0, Math.min(1500, Number.isFinite(weight) ? weight : 0));
    if (setIndex === 0 && !sets[0]?.isComplete) {
      const prevSet0Weight = sets[0]?.weight;
      exercise.sets = sets.map((s, idx) =>
        idx === 0 || (!s.isComplete && s.weight === prevSet0Weight)
          ? { ...s, weight: safeWeight }
          : s
      );
    } else {
      sets[setIndex] = { ...sets[setIndex], weight: safeWeight };
      exercise.sets = sets;
    }
    exercises[exerciseIndex] = exercise;
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals });
    return { exercises, ...totals };
  }),

  updateSetReps: (exerciseIndex, setIndex, reps) => set((state) => {
    const exercises = [...state.exercises];
    const exercise = { ...exercises[exerciseIndex] };
    const sets = [...exercise.sets];
    const safeReps = Math.max(0, Math.min(999, Number.isFinite(reps) ? Math.round(reps) : 0));
    if (setIndex === 0 && !sets[0]?.isComplete) {
      const prevSet0Reps = sets[0]?.reps;
      exercise.sets = sets.map((s, idx) =>
        idx === 0 || (!s.isComplete && s.reps === prevSet0Reps)
          ? { ...s, reps: safeReps }
          : s
      );
    } else {
      sets[setIndex] = { ...sets[setIndex], reps: safeReps };
      exercise.sets = sets;
    }
    exercises[exerciseIndex] = exercise;
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals });
    return { exercises, ...totals };
  }),

  updateExerciseNote: (exerciseIndex, note) => set((state) => {
    if (!state.exercises[exerciseIndex]) return {};
    const exercises = [...state.exercises];
    exercises[exerciseIndex] = { ...exercises[exerciseIndex], notes: note };
    if (noteSaveTimeout) {
      clearTimeout(noteSaveTimeout);
    }
    noteSaveTimeout = setTimeout(() => {
      noteSaveTimeout = null;
      saveSnapshot(get());
    }, 250);
    return { exercises };
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
    saveSnapshot({ ...state, exercises });
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
    saveSnapshot({ ...state, exercises });
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
    saveSnapshot({ ...state, exercises, ...totals });
    return { exercises, ...totals };
  }),

  goToExercise: (index) => set((state) => {
    saveSnapshot({ ...state, currentExerciseIndex: index });
    return { currentExerciseIndex: index };
  }),

  nextExercise: () => set((state) => {
    const nextIdx = Math.min(state.currentExerciseIndex + 1, state.exercises.length - 1);
    saveSnapshot({ ...state, currentExerciseIndex: nextIdx });
    return { currentExerciseIndex: nextIdx };
  }),

  prevExercise: () => set((state) => {
    const prevIdx = Math.max(state.currentExerciseIndex - 1, 0);
    saveSnapshot({ ...state, currentExerciseIndex: prevIdx });
    return { currentExerciseIndex: prevIdx };
  }),

  addExercise: (exercise) => set((state) => {
    const exercises = [...state.exercises, exercise];
    const currentExerciseIndex = exercises.length - 1;
    saveSnapshot({ ...state, exercises, currentExerciseIndex });
    return { exercises, currentExerciseIndex };
  }),

  removeExercise: (index) => set((state) => {
    if (state.exercises.length <= 1) return {};
    const exercises = state.exercises.filter((_, i) => i !== index);
    const currentExerciseIndex = Math.min(state.currentExerciseIndex, exercises.length - 1);
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, currentExerciseIndex, ...totals });
    return { exercises, currentExerciseIndex, ...totals };
  }),

  swapExercise: (index, newExercise) => set((state) => {
    const exercises = [...state.exercises];
    const prevEx = exercises[index];
    exercises[index] = {
      ...newExercise,
      originalExerciseName: prevEx?.originalExerciseName || prevEx?.exerciseName || newExercise.originalExerciseName,
      notes: prevEx?.notes || newExercise.notes,
    };
    const totals = recomputeTotals(exercises);
    saveSnapshot({ ...state, exercises, ...totals });
    return { exercises, ...totals };
  }),

  startRestTimer: (duration) => set((state) => {
    const safeDur = Math.max(1, duration);
    const restEndTimeMs = Date.now() + safeDur * 1000;
    const next = {
      ...state,
      restTimerActive: true,
      restTimeRemaining: safeDur,
      restTimeDuration: safeDur,
      restEndTimeMs,
    };
    saveSnapshot(next);
    return {
      restTimerActive: true,
      restTimeRemaining: safeDur,
      restTimeDuration: safeDur,
      restEndTimeMs,
    };
  }),

  stopRestTimer: () => set((state) => {
    const next = {
      ...state,
      restTimerActive: false,
      restTimeRemaining: 0,
      restEndTimeMs: null,
    };
    saveSnapshot(next);
    return {
      restTimerActive: false,
      restTimeRemaining: 0,
      restEndTimeMs: null,
    };
  }),

  tickTimer: () => set((state) => {
    if (state.isPaused) return {};
    const now = Date.now();
    const deltaSec = state.lastTickAt ? Math.max(1, Math.round((now - state.lastTickAt) / 1000)) : 1;
    const elapsedTime = state.elapsedTime + deltaSec;
    if (elapsedTime % 5 === 0 || deltaSec > 1) {
      saveSnapshot({ ...state, elapsedTime, lastTickAt: now });
    }
    return { elapsedTime, lastTickAt: now };
  }),

  tickRestTimer: () => set((state) => {
    if (!state.restTimerActive) return {};
    const now = Date.now();
    const remaining = state.restEndTimeMs
      ? Math.max(0, Math.ceil((state.restEndTimeMs - now) / 1000))
      : Math.max(0, state.restTimeRemaining - 1);
    if (remaining <= 0) {
      saveSnapshot({ ...state, restTimerActive: false, restTimeRemaining: 0, restEndTimeMs: null });
      return { restTimerActive: false, restTimeRemaining: 0, restEndTimeMs: null };
    }
    return { restTimeRemaining: remaining };
  }),

  addPR: (exerciseName, weight, reps) => set((state) => {
    const filtered = state.newPRs.filter(p => p.exerciseName !== exerciseName);
    const newPRs = [...filtered, { exerciseName, weight, reps }];
    saveSnapshot({ ...state, newPRs });
    return { newPRs };
  }),

  setNewPRs: (prs) => set((state) => {
    const deduped: { exerciseName: string; weight: number; reps: number }[] = [];
    for (const pr of prs) {
      const idx = deduped.findIndex(p => p.exerciseName === pr.exerciseName);
      if (idx >= 0) deduped[idx] = pr;
      else deduped.push(pr);
    }
    saveSnapshot({ ...state, newPRs: deduped });
    return { newPRs: deduped };
  }),

  syncExercisePRs: (exerciseIndex, historicalBest1RM) => {
    let hasRecord = false;
    set((state) => {
      const targetEx = state.exercises[exerciseIndex];
      if (!targetEx) return {};

      let best1RM = historicalBest1RM || 0;
      let bestSetIdx = -1;
      let bestWeight = 0;
      let bestReps = 0;

      targetEx.sets.forEach((s, idx) => {
        if (!s.isComplete || s.setType === SetType.Warmup) return;
        const est = estimateSet1RM(s.weight || 0, s.reps || 0);
        if (est > best1RM) {
          best1RM = est;
          bestSetIdx = idx;
          bestWeight = s.weight || 0;
          bestReps = s.reps || 0;
        }
      });

      hasRecord = bestSetIdx >= 0;

      const exercises = [...state.exercises];
      const updatedSets = targetEx.sets.map((s, idx) => ({
        ...s,
        isPR: hasRecord && idx === bestSetIdx,
      }));
      exercises[exerciseIndex] = { ...targetEx, sets: updatedSets };

      const filteredPRs = state.newPRs.filter(p => p.exerciseName !== targetEx.exerciseName);
      const newPRs = hasRecord
        ? [...filteredPRs, { exerciseName: targetEx.exerciseName, weight: bestWeight, reps: bestReps }]
        : filteredPRs;

      const totals = recomputeTotals(exercises);
      saveSnapshot({ ...state, exercises, newPRs, ...totals });
      return { exercises, newPRs, ...totals };
    });
    return hasRecord;
  },

  togglePause: () => set((state) => {
    const isPaused = !state.isPaused;
    const lastTickAt = isPaused ? null : Date.now();
    saveSnapshot({ ...state, isPaused, lastTickAt });
    return { isPaused, lastTickAt };
  }),

  minimizeWorkout: () => set((state) => {
    saveSnapshot({ ...state, isMinimized: true });
    return { isMinimized: true };
  }),

  resumeWorkout: () => set((state) => {
    saveSnapshot({ ...state, isMinimized: false });
    return { isMinimized: false };
  }),

  resetTimer: () => set((state) => {
    saveSnapshot({ ...state, elapsedTime: 0, isPaused: true, lastTickAt: null });
    return { elapsedTime: 0, isPaused: true, lastTickAt: null };
  }),
}));
