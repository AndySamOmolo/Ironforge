'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Plus, Minus, SkipForward, ChevronLeft, ChevronRight, Dumbbell,
  ArrowLeftRight, ExternalLink, StickyNote, Play, Pause, AlertTriangle,
  BookOpen, Trash2, Search, TrendingUp, Minimize2, Maximize2, Sun, RotateCcw, Timer,
} from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { notifyRestComplete } from '@/lib/store/reminderStore';
import { db } from '@/lib/db/schema';
import { MUSCLE_COLORS, SetType } from '@/lib/types';
import type { Exercise } from '@/lib/types';
import { getSwapSuggestions } from '@/lib/utils/swapEngine';
import { calculatePlates } from '@/lib/utils/plateCalculator';
import { getProgressionSuggestion, estimate1RM, type ProgressionSuggestion } from '@/lib/utils/progressionEngine';
import { matchesUserEquipment } from '@/lib/utils/exerciseResolver';
import { getWorkoutStartingWeight, createKeepScreenAwakeController } from '@/lib/utils/workoutDefaults';
import { getYoutubeSearchUrl, getVideoSearchOptions } from '@/lib/data/youtube-ids';
import {
  getPrimaryExerciseImage,
  getExerciseImageFrames,
  getExerciseGifUrl,
  hasAnimatedExerciseMedia,
  hasGifExerciseMedia,
} from '@/lib/utils/exerciseMedia';
import ExerciseMedia from '@/components/ui/ExerciseMedia';
import { ChipScrollBar } from '@/components/ui/CustomSelect';

interface ActiveWorkoutPageProps { onComplete: () => void; }

const SET_TYPE_BADGE: Record<string, { label: string; color: string; bg: string; title: string }> = {
  [SetType.Normal]: { label: '', color: 'var(--text-muted)', bg: 'var(--bg-elevated)', title: 'Normal Set (tap to change)' },
  [SetType.Warmup]: { label: 'W', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', title: 'Warmup Set' },
  [SetType.DropSet]: { label: 'D', color: '#A855F7', bg: 'rgba(168,85,247,0.16)', title: 'Drop Set' },
  [SetType.Failure]: { label: 'F', color: '#FF3D5A', bg: 'color-mix(in srgb, var(--accent-red) 16%, transparent)', title: 'To Failure' },
  [SetType.AMRAP]: { label: 'A', color: '#22D3EE', bg: 'rgba(34,211,238,0.16)', title: 'AMRAP Set' },
};

export default function ActiveWorkoutPage({ onComplete }: ActiveWorkoutPageProps) {
  const {
    exercises, currentExerciseIndex, elapsedTime, totalVolume, totalSets,
    planName, dayName, sessionId, isPaused,
    completeSet, uncompleteSet, updateSetWeight, updateSetReps, updateExerciseNote,
    cycleSetType, addSet, removeSet,
    goToExercise, nextExercise, prevExercise,
    addExercise, removeExercise,
    tickTimer, restTimerActive, restTimeRemaining, restTimeDuration,
    startRestTimer, stopRestTimer, tickRestTimer, endWorkout, togglePause,
    addPR, setSessionId, completeWorkoutSession, minimizeWorkout, resetTimer,
  } = useWorkoutStore();
  const {
    defaultRestTime,
    unitSystem,
    soundEnabled,
    hapticEnabled,
    barWeight,
    dumbbellWeight,
    equipment: userEquipment,
    weightIncrement,
    autoAdvance,
    autoStartRest,
    restTimerEnabled,
    keepScreenOn,
    showTimer,
    countdownSound,
    notificationsEnabled,
  } = useUserStore();

  const [showNumpad, setShowNumpad] = useState<{ field: 'weight' | 'reps'; exerciseIdx: number; setIdx: number } | null>(null);
  const [numpadValue, setNumpadValue] = useState('0');
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [activeMediaMode, setActiveMediaMode] = useState<'gif' | 'animated-images' | 'static-image' | 'none'>('gif');
  const [showSwap, setShowSwap] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<{ exercise: Exercise; score: number; matchTags: string[]; category: string }[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [allCatalog, setAllCatalog] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showPlates, setShowPlates] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [restMinimized, setRestMinimized] = useState(false);
  const [gifExpanded, setGifExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('ironforge_gif_expanded_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number>(1);
  const toggleGifExpanded = useCallback(() => {
    setGifExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('ironforge_gif_expanded_v1', String(next));
      } catch {}
      return next;
    });
  }, []);
  const [showRestBar, setShowRestBar] = useState(false);
  const [screenAwakeLocked, setScreenAwakeLocked] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [exerciseInfo, setExerciseInfo] = useState<Exercise | null>(null);
  const [historicalBest1RM, setHistoricalBest1RM] = useState<number>(0);
  const [lastBestSet, setLastBestSet] = useState<{ weight: number; reps: number } | null>(null);
  const [overloadTip, setOverloadTip] = useState<ProgressionSuggestion | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFinishingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Close open modals on Escape key press (A11Y-02)
  useEffect(() => {
    if (!showNumpad && !showSwap && !showNotes && !showCancelConfirm && !showAddExercise) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showNumpad) setShowNumpad(null);
        else if (showSwap) setShowSwap(false);
        else if (showNotes) setShowNotes(false);
        else if (showCancelConfirm) setShowCancelConfirm(false);
        else if (showAddExercise) setShowAddExercise(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNumpad, showSwap, showNotes, showCancelConfirm, showAddExercise]);

  const stepWeight = weightIncrement && weightIncrement > 0 ? weightIncrement : 2.5;
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  useEffect(() => {
    timerRef.current = setInterval(() => tickTimer(), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tickTimer]);

  useEffect(() => {
    if (restTimerActive) {
      restTimerRef.current = setInterval(() => tickRestTimer(), 1000);
      return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
    } else {
      setRestMinimized(false);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    }
  }, [restTimerActive, tickRestTimer]);

  // Multi-layered Screen Wake Lock controller so the screen never turns off mid-workout
  useEffect(() => {
    if (keepScreenOn === false) {
      setScreenAwakeLocked(false);
      return;
    }
    const controller = createKeepScreenAwakeController((locked) => {
      setScreenAwakeLocked(locked);
    });
    controller.start();
    return () => {
      controller.stop();
    };
  }, [keepScreenOn]);

  const currentExercise = exercises[currentExerciseIndex];

  // Load exercise info, historical PRs, and progressive overload suggestion when current exercise changes
  useEffect(() => {
    let cancelled = false;
    const loadExerciseInfoAndHistory = async () => {
      if (!currentExercise) return;
      try {
        let ex = currentExercise.exerciseId ? await db.exercises.get(currentExercise.exerciseId) : undefined;
        if (!ex) {
          ex = await db.exercises.where('name').equalsIgnoreCase(currentExercise.exerciseName).first();
        }
        if (cancelled) return;
        setExerciseInfo(ex || null);
        setMediaAspectRatio(1);

        const exId = ex?.id || currentExercise.exerciseId;
        if (exId) {
          const [pastSets, pastPRs] = await Promise.all([
            db.sets.where('exerciseId').equals(exId).toArray(),
            db.personalRecords.where('exerciseId').equals(exId).toArray(),
          ]);
          if (cancelled) return;

          let max1RM = 0;
          let bestSet: { weight: number; reps: number } | null = null;

          for (const pr of pastPRs) {
            if (pr.estimated1RM > max1RM) {
              max1RM = pr.estimated1RM;
              bestSet = { weight: pr.weight, reps: pr.reps };
            }
          }
          for (const s of pastSets) {
            if (s.isWarmup) continue;
            const e1rm = estimate1RM(s.weight, s.reps);
            if (e1rm > max1RM) {
              max1RM = e1rm;
              bestSet = { weight: s.weight, reps: s.reps };
            }
          }

          setHistoricalBest1RM(max1RM);
          setLastBestSet(bestSet);

          const validSets = pastSets
            .filter(s => !s.isWarmup && s.weight > 0 && s.reps > 0)
            .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

          if (validSets.length > 0) {
            const targetRepsNum = typeof currentExercise.targetReps === 'number' ? currentExercise.targetReps : 10;
            const isUpper = !ex?.primaryMuscles?.some(m => ['quads', 'quadriceps', 'hamstrings', 'glutes', 'calves'].includes(m.toLowerCase()));
            const suggestion = getProgressionSuggestion(
              validSets.slice(0, 5).map(s => ({ weight: s.weight, reps: s.reps, date: new Date(s.completedAt || Date.now()) })),
              targetRepsNum,
              isUpper,
              unitSystem
            );
            setOverloadTip(suggestion);
          } else {
            setOverloadTip(null);
          }
        } else {
          setHistoricalBest1RM(0);
          setLastBestSet(null);
          setOverloadTip(null);
        }
      } catch {
        if (!cancelled) setExerciseInfo(null);
      }
    };
    loadExerciseInfoAndHistory();
    return () => { cancelled = true; };
  }, [currentExerciseIndex, currentExercise?.exerciseId, currentExercise?.exerciseName, currentExercise?.targetReps, unitSystem]);

  const currentSetIndex = currentExercise?.sets.findIndex(s => !s.isComplete) ?? -1;
  const progress = exercises.length > 0 ? (exercises.filter(e => e.isComplete).length / exercises.length) * 100 : 0;

  const currentPlateCalc = useMemo(
    () =>
      currentSetIndex >= 0 && currentExercise?.sets[currentSetIndex]?.weight > 0
        ? calculatePlates(currentExercise.sets[currentSetIndex].weight, barWeight, unitSystem)
        : null,
    [currentSetIndex, currentExercise, barWeight, unitSystem]
  );

  const triggerHaptic = useCallback((mode: 'light' | 'success' = 'light') => {
    if (!hapticEnabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (mode === 'success') {
      navigator.vibrate([20, 30, 20]);
      return;
    }
    navigator.vibrate(14);
  }, [hapticEnabled]);

  const playFeedbackTone = useCallback((mode: 'set' | 'finish' | 'rest' | 'tick' | 'pr') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);

      const sequence = mode === 'finish' || mode === 'pr'
        ? [660, 880, 1100, 1320]
        : mode === 'rest'
          ? [880, 1100]
          : mode === 'tick'
            ? [540]
            : [760];

      sequence.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const start = now + idx * 0.1;
        const stop = start + (mode === 'tick' ? 0.05 : 0.09);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.connect(gain);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(mode === 'tick' ? 0.08 : 0.14, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, stop);
        osc.start(start);
        osc.stop(stop);
      });
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    if (restTimerActive && restTimeRemaining === 0) {
      playFeedbackTone('rest');
      triggerHaptic('success');
      if (notificationsEnabled) {
        void notifyRestComplete(exercises[currentExerciseIndex]?.exerciseName);
      }
    } else if (restTimerActive && countdownSound && restTimeRemaining > 0 && restTimeRemaining <= 3) {
      playFeedbackTone('tick');
    }
  }, [restTimeRemaining, restTimerActive, countdownSound, playFeedbackTone, triggerHaptic, notificationsEnabled, exercises, currentExerciseIndex]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCompleteSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    const exercise = exercises[exerciseIdx];
    const set = exercise.sets[setIdx];
    const weight = set.weight || 0;
    const reps = set.reps || set.targetReps || 0;

    const isWarmup = set.setType === SetType.Warmup;
    const currentSet1RM = !isWarmup && weight > 0 && reps > 0 ? estimate1RM(weight, reps) : 0;
    const sessionBest1RM = exercise.sets.reduce((max, s, idx) => {
      if (idx === setIdx || !s.isComplete || s.setType === SetType.Warmup) return max;
      return Math.max(max, estimate1RM(s.weight || 0, s.reps || 0));
    }, historicalBest1RM);

    const isNewPR = currentSet1RM > 0 && currentSet1RM > sessionBest1RM;

    completeSet(exerciseIdx, setIdx, weight, reps, isNewPR);

    if (isNewPR) {
      addPR(exercise.exerciseName, weight, reps);
      playFeedbackTone('pr');
      triggerHaptic('success');
    } else {
      playFeedbackTone('set');
      triggerHaptic('light');
    }

    if (autoStartRest && restTimerEnabled) {
      setRestMinimized(false);
      startRestTimer(exercise.restTime || defaultRestTime);
    }
    const updated = [...exercise.sets];
    updated[setIdx] = { ...updated[setIdx], isComplete: true };
    if (autoAdvance && updated.every(s => s.isComplete) && currentExerciseIndex < exercises.length - 1) {
      setTimeout(() => nextExercise(), 600);
    }
  }, [exercises, completeSet, startRestTimer, defaultRestTime, currentExerciseIndex, nextExercise, playFeedbackTone, triggerHaptic, autoStartRest, restTimerEnabled, autoAdvance, historicalBest1RM, addPR]);

  const handleFinish = async () => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    setIsFinishing(true);

    const hasCompletedSets = exercises.some(ex => ex.sets.some(s => s.isComplete));
    if (!hasCompletedSets) {
      setShowCancelConfirm(true);
      isFinishingRef.current = false;
      setIsFinishing(false);
      return;
    }

    try {
      playFeedbackTone('finish');
      triggerHaptic('success');

      const completedSetEntries = exercises.flatMap((exercise, exOrder) =>
        exercise.sets
          .filter(set => set.isComplete)
          .map((set, setIndex) => ({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            orderIndex: exOrder,
            setNumber: setIndex + 1,
            setType: (set.setType || SetType.Normal) as SetType,
            weight: set.weight || 0,
            reps: set.reps || 0,
            isWarmup: set.setType === SetType.Warmup,
            isPR: Boolean(set.isPR),
          }))
      );
      const now = new Date();
      const startedAt = new Date(now.getTime() - elapsedTime * 1000);
      const computedTotalReps = completedSetEntries.reduce((sum, set) => sum + set.reps, 0);
      const computedTotalSets = completedSetEntries.length;

      const combinedNotes = exercises
        .map((ex, idx) => {
          const text = ex.notes ?? notes[idx] ?? '';
          return text.trim().length > 0 ? `${ex.exerciseName || 'Exercise'}: ${text.trim()}` : '';
        })
        .filter(Boolean)
        .join(' | ');

      const currentSessionId = useWorkoutStore.getState().sessionId || sessionId;
      let savedSessionId = currentSessionId || 0;
      const recordedPRs: Array<{ exerciseName: string; weight: number; reps: number }> = [];

      await db.transaction('rw', [db.workoutSessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
        savedSessionId = currentSessionId
          ? currentSessionId
          : await db.workoutSessions.add({
              planName,
              dayName,
              startedAt,
              completedAt: now,
              duration: elapsedTime,
              totalVolume,
              totalSets: computedTotalSets,
              totalReps: computedTotalReps,
              notes: combinedNotes || undefined,
              isComplete: true,
            });

        if (currentSessionId) {
          await db.workoutSessions.update(savedSessionId, {
            completedAt: now,
            duration: elapsedTime,
            totalVolume,
            totalSets: computedTotalSets,
            totalReps: computedTotalReps,
            notes: combinedNotes || undefined,
            isComplete: true,
          });
          await db.sets.where('sessionId').equals(savedSessionId).delete();
          await db.sessionExercises.where('sessionId').equals(savedSessionId).delete();
          await db.personalRecords.where('sessionId').equals(savedSessionId).delete();
        }

        if (completedSetEntries.length > 0) {
          const sessionExIdByOrder = new Map<number, number>();
          for (let exOrder = 0; exOrder < exercises.length; exOrder++) {
            const ex = exercises[exOrder];
            if (!ex.sets.some(s => s.isComplete)) continue;
            const seId = await db.sessionExercises.add({
              sessionId: savedSessionId,
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              wasSwapped: Boolean(ex.originalExerciseName && ex.originalExerciseName !== ex.exerciseName),
              orderIndex: exOrder,
              notes: ex.notes?.trim() || undefined,
            });
            sessionExIdByOrder.set(exOrder, seId);
          }

          await db.sets.bulkAdd(
            completedSetEntries.map(set => ({
              sessionExerciseId: sessionExIdByOrder.get(set.orderIndex) || 0,
              sessionId: savedSessionId,
              exerciseId: set.exerciseId,
              setNumber: set.setNumber,
              setType: set.setType,
              weight: set.weight,
              reps: set.reps,
              completedAt: now,
              isWarmup: set.isWarmup,
              isPR: set.isPR,
            }))
          );

          const bestByExercise = new Map<number, { exerciseId: number; exerciseName: string; weight: number; reps: number; estimated1RM: number }>();
          for (const s of completedSetEntries) {
            if (s.isWarmup || s.weight <= 0 || s.reps <= 0 || !s.exerciseId) continue;
            const est1RM = estimate1RM(s.weight, s.reps);
            const existing = bestByExercise.get(s.exerciseId);
            if (!existing || est1RM > existing.estimated1RM) {
              bestByExercise.set(s.exerciseId, {
                exerciseId: s.exerciseId,
                exerciseName: s.exerciseName,
                weight: s.weight,
                reps: s.reps,
                estimated1RM: est1RM,
              });
            }
          }

          for (const [exId, candidate] of bestByExercise.entries()) {
            const prevPRs = await db.personalRecords.where('exerciseId').equals(exId).toArray();
            const prevMax = prevPRs.reduce((m, r) => Math.max(m, r.estimated1RM || 0), 0);
            if (candidate.estimated1RM > prevMax) {
              await db.personalRecords.add({
                exerciseId: candidate.exerciseId,
                exerciseName: candidate.exerciseName,
                weight: candidate.weight,
                reps: candidate.reps,
                estimated1RM: candidate.estimated1RM,
                date: now,
                sessionId: savedSessionId,
              });
              recordedPRs.push({
                exerciseName: candidate.exerciseName,
                weight: candidate.weight,
                reps: candidate.reps,
              });
            }
          }
        }
      });

      setSessionId(savedSessionId);
      for (const pr of recordedPRs) {
        addPR(pr.exerciseName, pr.weight, pr.reps);
      }

      // Immediately mark workout as inactive & clear active snapshot so Back button never re-enters ActiveWorkoutPage
      completeWorkoutSession(savedSessionId);
      onComplete();
    } catch (err) {
      console.error('Failed to finish workout:', err);
      window.alert('Could not save workout. Please try tapping Finish again.');
      isFinishingRef.current = false;
      setIsFinishing(false);
    }
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const confirmCancel = () => {
    endWorkout();
    setShowCancelConfirm(false);
  };

  const handleSwap = async () => {
    if (!currentExercise) return;
    try {
      const [all, recentSets] = await Promise.all([
        db.exercises.toArray(),
        db.sets.orderBy('completedAt').reverse().limit(100).toArray(),
      ]);
      const current = all.find(e => e.id === currentExercise.exerciseId) ||
        all.find(e => e.name.toLowerCase() === currentExercise.exerciseName.toLowerCase());
      if (!current) return;
      const sessionIds = exercises.map(e => e.exerciseId).filter(Boolean);
      const recentIds = new Set(recentSets.map(s => s.exerciseId).filter(Boolean));
      const suggestions = await getSwapSuggestions(current, sessionIds, userEquipment, recentIds);
      setSwapSuggestions(suggestions);
      setShowSwap(true);
    } catch {}
  };

  const doSwap = async (newEx: Exercise) => {
    const { swapExercise } = useWorkoutStore.getState();
    const startW = getWorkoutStartingWeight({
      equipment: newEx.equipment,
      barWeight,
      dumbbellWeight,
    });
    if (swapExercise) {
      swapExercise(currentExerciseIndex, {
        exerciseId: newEx.id || 0,
        exerciseName: newEx.name,
        imageUrl: getPrimaryExerciseImage(newEx),
        gifUrl: getExerciseGifUrl(newEx),
        mediaFrames: getExerciseImageFrames(newEx),
        sets: currentExercise.sets.map(s => ({ ...s, weight: s.weight || startW, isComplete: false, isPR: false })),
        targetSets: currentExercise.targetSets,
        targetReps: currentExercise.targetReps,
        restTime: currentExercise.restTime,
        isComplete: false,
      });
    }
    if (planName && dayName) {
      try {
        const slotOriginalName = currentExercise.originalExerciseName || currentExercise.exerciseName;
        const existing = await db.exerciseSwaps
          .where('planName')
          .equals(planName)
          .filter(s =>
            s.dayName === dayName &&
            (s.originalExerciseName.toLowerCase() === slotOriginalName.toLowerCase() ||
             s.originalExerciseName.toLowerCase() === currentExercise.exerciseName.toLowerCase())
          )
          .first();
        if (existing?.id) {
          await db.exerciseSwaps.update(existing.id, {
            originalExerciseName: slotOriginalName,
            newExerciseId: newEx.id || 0,
            newExerciseName: newEx.name,
            newGifUrl: getExerciseGifUrl(newEx),
            swappedAt: new Date(),
          });
        } else {
          await db.exerciseSwaps.add({
            planName,
            dayName,
            originalExerciseName: slotOriginalName,
            newExerciseId: newEx.id || 0,
            newExerciseName: newEx.name,
            newGifUrl: getExerciseGifUrl(newEx),
            swappedAt: new Date(),
          });
        }
      } catch (err) {
        console.warn('Failed to persist swap:', err);
      }
    }
    setShowSwap(false);
  };

  const openAddExerciseModal = async () => {
    if (allCatalog.length === 0) {
      const all = await db.exercises.toArray();
      setAllCatalog(all);
    }
    setShowAddExercise(true);
  };

  const filteredAddCatalog = useMemo(() => {
    let list = allCatalog.filter(e => matchesUserEquipment(e, userEquipment));
    if (addSearch.trim()) {
      const q = addSearch.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscles?.some(m => m.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => Number(hasGifExerciseMedia(b)) - Number(hasGifExerciseMedia(a)));
    return list.slice(0, 60);
  }, [allCatalog, userEquipment, addSearch]);

  const handleAddExerciseToWorkout = (ex: Exercise) => {
    const startW = getWorkoutStartingWeight({
      equipment: ex.equipment,
      barWeight,
      dumbbellWeight,
    });
    addExercise({
      exerciseId: ex.id || 0,
      exerciseName: ex.name,
      imageUrl: getPrimaryExerciseImage(ex),
      gifUrl: getExerciseGifUrl(ex),
      mediaFrames: getExerciseImageFrames(ex),
      sets: Array.from({ length: 3 }, (_, i) => ({
        setNumber: i + 1,
        setType: SetType.Normal,
        weight: startW,
        reps: 10,
        targetWeight: startW,
        targetReps: 10,
        isComplete: false,
      })),
      targetSets: 3,
      targetReps: 10,
      restTime: defaultRestTime || 90,
      isComplete: false,
    });
    setShowAddExercise(false);
    setAddSearch('');
  };

  const openNumpad = (field: 'weight' | 'reps', eIdx: number, sIdx: number) => {
    const set = exercises[eIdx].sets[sIdx];
    setNumpadValue(field === 'weight' ? set.weight.toString() : set.reps.toString());
    setShowNumpad({ field, exerciseIdx: eIdx, setIdx: sIdx });
  };

  const handleNumpadInput = (key: string) => {
    if (key === 'C') setNumpadValue('0');
    else if (key === '←') setNumpadValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    else if (key === '.') { if (!numpadValue.includes('.')) setNumpadValue(prev => prev + '.'); }
    else if (key === '✓') {
      if (showNumpad) {
        const v = parseFloat(numpadValue) || 0;
        if (showNumpad.field === 'weight') {
          updateSetWeight(showNumpad.exerciseIdx, showNumpad.setIdx, Math.min(1500, Math.max(0, v)));
        } else {
          updateSetReps(showNumpad.exerciseIdx, showNumpad.setIdx, Math.min(999, Math.max(0, Math.round(v))));
        }
        setShowNumpad(null);
      }
    } else {
      setNumpadValue(prev => {
        if (prev.length >= 6) return prev;
        return prev === '0' ? key : prev + key;
      });
    }
  };

  // Strictly separate primary GIF from backup static image frames so GIFs are always primary
  // and multi-frame static images animate continuously when no GIF exists or GIF fails
  const primaryGifUrl = useMemo(() => {
    if (!currentExercise) return undefined;
    return getExerciseGifUrl({
      gifUrl: currentExercise.gifUrl || exerciseInfo?.gifUrl,
      imageUrls: [],
      images: [],
    });
  }, [currentExercise, exerciseInfo]);

  const backupFrames = useMemo(() => {
    if (!currentExercise) return [];
    const fromActive = currentExercise.mediaFrames || [];
    if (fromActive.length > 0) return fromActive;
    if (exerciseInfo) {
      return getExerciseImageFrames(exerciseInfo);
    }
    if (currentExercise.imageUrl && !primaryGifUrl) {
      return [currentExercise.imageUrl];
    }
    return [];
  }, [currentExercise, exerciseInfo, primaryGifUrl]);

  if (!currentExercise) {
    return <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><Dumbbell size={48} color="var(--text-dim)" style={{ marginBottom: 16 }} /><h2>No exercises</h2><button className="btn-secondary" onClick={() => endWorkout()} style={{ marginTop: 16 }}>Go Back</button></div>
    </div>;
  }

  const mediaErrorKey = `${currentExercise.exerciseId || 0}_${currentExercise.exerciseName}`;
  const hasImgError = imgErrors.has(mediaErrorKey);
  const hasVisualMedia = Boolean(primaryGifUrl) || backupFrames.length > 0 || (exerciseInfo?.images?.length || 0) > 0;

  return (
    <div className="active-workout-container" style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Compact Sticky Top Header */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-sheet)', backdropFilter: 'blur(24px)', zIndex: 50, padding: '8px 12px 6px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {/* Left: Minimize + End */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              onClick={minimizeWorkout}
              className="btn-secondary"
              title="Minimize workout to browse app"
              aria-label="Minimize workout"
              style={{ width: 'auto', minHeight: 32, padding: '5px 9px', fontSize: 11, fontWeight: 700, borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Minimize2 size={12} />
            </button>
            <button
              onClick={handleCancel}
              className="btn-cancel"
              style={{ minHeight: 32, padding: '5px 8px', fontSize: 10.5, borderRadius: 9 }}
              title="End or discard workout"
              aria-label="End workout"
            >
              <X size={12} />
            </button>
          </div>

          {/* Center: Workout Name + Inline Stopwatch Pill + Rest Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dayName || planName}
            </div>
            {showTimer !== false && (
              <button
                type="button"
                onClick={togglePause}
                title={isPaused ? 'Tap to start/resume timer' : 'Tap to pause timer'}
                className="font-mono"
                style={{
                  minHeight: 28,
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: isPaused ? 'color-mix(in srgb, var(--accent-yellow) 12%, transparent)' : 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                  border: isPaused ? '1px solid color-mix(in srgb, var(--accent-yellow) 30%, transparent)' : '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)',
                  color: isPaused ? 'var(--accent-yellow)' : 'var(--accent-green)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {isPaused ? <Play size={10} fill="currentColor" /> : <Pause size={10} />}
                {formatTime(elapsedTime)}
              </button>
            )}
            {restTimerEnabled && (
              <button
                type="button"
                onClick={() => setShowRestBar((prev) => !prev)}
                title="Toggle rest timer presets"
                aria-label="Rest timer presets"
                style={{
                  minHeight: 28,
                  padding: '3px 7px',
                  borderRadius: 8,
                  background: showRestBar || restTimerActive ? 'color-mix(in srgb, var(--accent-purple) 18%, transparent)' : 'var(--bg-glass)',
                  border: showRestBar || restTimerActive ? '1px solid var(--accent-purple)' : '1px solid var(--border)',
                  color: showRestBar || restTimerActive ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10.5,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <Timer size={11} />
                {restTimerActive ? `${restTimeRemaining}s` : 'Rest'}
              </button>
            )}
          </div>

          {/* Right: Finish */}
          <button
            onClick={handleFinish}
            disabled={isFinishing}
            className="btn-primary"
            style={{ fontSize: 11, fontWeight: 800, borderRadius: 9, padding: '5px 12px', minHeight: 32, width: 'auto', textShadow: 'none', boxShadow: 'none', opacity: isFinishing ? 0.6 : 1, flexShrink: 0 }}
          >
            {isFinishing ? 'Saving...' : 'Finish'}
          </button>
        </div>

        {/* Slim Progress Bar */}
        <div style={{ height: 2.5, background: 'var(--bg-track)', borderRadius: 2 }}>
          <motion.div style={{ height: '100%', background: 'var(--gradient-fire)', borderRadius: 2 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>

        {/* On-Demand Collapsible Rest Timer Drawer */}
        <AnimatePresence>
          {restTimerEnabled && showRestBar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Timer size={11} color="var(--accent-purple)" /> Quick Rest:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[30, 60, 90, 120, 180].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => { setRestMinimized(false); startRestTimer(sec); setShowRestBar(false); }}
                      style={{
                        padding: '3px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        background: restTimerActive && restTimeDuration === sec ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                        border: restTimerActive && restTimeDuration === sec ? 'none' : '1px solid var(--border)',
                        color: restTimerActive && restTimeDuration === sec ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                    </button>
                  ))}
                  {elapsedTime > 0 && (
                    <button
                      onClick={() => {
                        if (elapsedTime < 10 || window.confirm('Reset workout timer to 00:00?')) {
                          resetTimer();
                        }
                      }}
                      title="Reset workout timer"
                      aria-label="Reset workout timer"
                      style={{
                        padding: '3px 7px', borderRadius: 7, border: '1px solid var(--border)',
                        background: 'var(--bg-glass)', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: 9.5, fontWeight: 700,
                      }}
                    >
                      Reset ⏱
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Slim Exercise Queue Strip */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
        <ChipScrollBar
          dropdownTitle="Workout Exercises"
          ariaLabel="Workout exercise queue"
          style={{ marginBottom: 0 }}
          chipStyle={{ fontSize: 11.5, padding: '5px 11px', minHeight: 32, textTransform: 'capitalize' }}
          items={exercises.map((ex, idx) => ({
            id: `${idx}-${ex.exerciseName}`,
            label: `${ex.isComplete ? '✓ ' : `${idx + 1}. `}${ex.exerciseName.split(' ').slice(0, 3).join(' ')}`,
            isActive: idx === currentExerciseIndex,
            onClick: () => goToExercise(idx),
          }))}
          trailingAction={
            <button
              type="button"
              onClick={openAddExerciseModal}
              style={{
                flexShrink: 0, padding: '5px 10px', borderRadius: 999,
                border: '1px dashed var(--accent-purple)', background: 'color-mix(in srgb, var(--accent-purple) 8%, transparent)',
                color: 'var(--accent-purple)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 3, minHeight: 32,
              }}
            >
              <Plus size={12} /> Add
            </button>
          }
        />
      </div>

      <div style={{ padding: '10px 12px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom) + 90px)' }}>
        {/* Unified Exercise Hero Card (Compact Side-by-Side GIF + Title + Set Dots + Action Tools, tap GIF to expand) */}
        <div
          className="card"
          style={{
            padding: 11,
            marginBottom: 10,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: gifExpanded ? 'column' : 'row',
            alignItems: gifExpanded ? 'stretch' : 'center',
            gap: 12,
          }}
        >
          {hasVisualMedia && !hasImgError && (
            <div
              onClick={toggleGifExpanded}
              role="button"
              tabIndex={0}
              aria-label={gifExpanded ? 'Collapse exercise animation' : 'Expand exercise animation'}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGifExpanded(); } }}
              className="gif-upscale-container"
              style={{
                width: gifExpanded ? '100%' : 112,
                height: gifExpanded ? 'auto' : 112,
                aspectRatio: gifExpanded ? `${Math.min(1.45, Math.max(0.85, mediaAspectRatio))}` : '1 / 1',
                maxHeight: gifExpanded ? '48vh' : 112,
                margin: gifExpanded ? '0 auto' : undefined,
                borderRadius: 14,
                overflow: 'hidden',
                background: '#ffffff',
                position: 'relative',
                border: '1px solid var(--border-bright)',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <ExerciseMedia
                gifUrl={primaryGifUrl}
                imageUrls={backupFrames}
                images={exerciseInfo?.images}
                alt={currentExercise.exerciseName}
                loading="eager"
                frameIntervalMs={700}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: gifExpanded ? 'contain' : 'cover',
                  imageRendering: 'auto',
                  display: 'block',
                  background: '#ffffff',
                  position: 'relative',
                  zIndex: 1,
                }}
                onNaturalAspectRatio={(ratio) => {
                  if (Number.isFinite(ratio) && ratio > 0.4 && ratio < 2.5) {
                    setMediaAspectRatio(ratio);
                  }
                }}
                onMediaModeChange={setActiveMediaMode}
                onExhausted={() => setImgErrors(prev => new Set(prev).add(mediaErrorKey))}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 7,
                  left: 7,
                  background: 'rgba(10, 12, 20, 0.78)',
                  backdropFilter: 'blur(6px)',
                  borderRadius: 999,
                  padding: '3px 8px',
                  fontSize: 8.5,
                  fontWeight: 800,
                  color: '#34D399',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  zIndex: 2,
                  letterSpacing: 0.4,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399' }} />
                {activeMediaMode === 'gif' ? 'GIF' : 'DEMO'}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 7,
                  right: 7,
                  background: 'rgba(10, 12, 20, 0.78)',
                  backdropFilter: 'blur(6px)',
                  borderRadius: 9,
                  width: 28,
                  height: 28,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                {gifExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </div>
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6 }}>
            {/* Meta Row: Ex Counter + Equipment + Set Progress Dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>Ex {currentExerciseIndex + 1}/{exercises.length}</span>
                {exerciseInfo?.equipment && (
                  <span style={{ color: 'var(--accent-purple)', textTransform: 'capitalize' }}>• {exerciseInfo.equipment}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {currentExercise.sets.map((set, i) => (
                  <span
                    key={i}
                    style={{
                      width: 7.5,
                      height: 7.5,
                      borderRadius: '50%',
                      background: set.isComplete ? 'var(--accent-green)' : i === currentSetIndex ? 'var(--accent-red)' : 'var(--bg-track)',
                      boxShadow: set.isComplete ? '0 0 6px color-mix(in srgb, var(--accent-green) 40%, transparent)' : i === currentSetIndex ? '0 0 6px var(--glow-red)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Exercise Title */}
            <h2 className="font-display" style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.02em', textTransform: 'capitalize', lineHeight: 1.2, margin: 0 }}>
              {currentExercise.exerciseName}
            </h2>

            {/* Set Counter + Personal Best */}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>Set {currentSetIndex >= 0 ? currentSetIndex + 1 : '✓'} of {currentExercise.sets.length}</span>
              {lastBestSet && (
                <span style={{ color: 'var(--accent-yellow)', fontWeight: 700, fontSize: 10.5 }}>
                  🏆 Best: {lastBestSet.weight}{unitLabel} × {lastBestSet.reps}
                </span>
              )}
            </div>

            {/* Compact Action Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <button onClick={() => setShowNotes(true)} title="Notes & Form Guide" aria-label="Notes & Instructions" style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-yellow) 25%, transparent)', color: 'var(--accent-yellow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={14} /></button>
              <button onClick={handleSwap} title="Swap Exercise" aria-label="Swap Exercise" style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-purple) 25%, transparent)', color: 'var(--accent-purple)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeftRight size={14} /></button>
              {exercises.length > 1 && (
                <button
                  onClick={() => {
                    if (currentExercise.sets.some(s => s.isComplete) || currentExercise.notes?.trim()) {
                      if (!window.confirm(`Remove ${currentExercise.exerciseName} from this workout?`)) return;
                    }
                    removeExercise(currentExerciseIndex);
                  }}
                  title="Remove Exercise"
                  aria-label="Remove Exercise"
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)', color: 'var(--accent-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button onClick={prevExercise} aria-label="Previous exercise" disabled={currentExerciseIndex === 0} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === 0 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>
                <button onClick={nextExercise} aria-label="Next exercise" disabled={currentExerciseIndex === exercises.length - 1} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === exercises.length - 1 ? 0.3 : 1 }}><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Progressive Overload Suggestion Banner (Compact) */}
        {overloadTip && overloadTip.suggestedWeight > 0 && (
          <div className="card" style={{ padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)', background: 'color-mix(in srgb, var(--accent-green) 5%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
              <TrendingUp size={14} color="var(--accent-green)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {overloadTip.icon} Target: {overloadTip.suggestedWeight}{unitLabel} × {overloadTip.suggestedReps} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({overloadTip.reason})</span>
              </div>
            </div>
            <button
              onClick={() => {
                updateSetWeight(currentExerciseIndex, 0, overloadTip.suggestedWeight);
                updateSetReps(currentExerciseIndex, 0, overloadTip.suggestedReps);
              }}
              className="btn-secondary"
              style={{ padding: '4px 9px', fontSize: 10.5, fontWeight: 700, borderRadius: 7, minHeight: 26, flexShrink: 0 }}
            >
              Apply
            </button>
          </div>
        )}

        {/* Single Column Header Strip for Sets */}
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 44px', alignItems: 'center', gap: 6, padding: '0 8px 4px', fontSize: 9.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          <span>Set</span>
          <span style={{ textAlign: 'center' }}>{unitLabel} (±{stepWeight})</span>
          <span style={{ textAlign: 'center' }}>Reps</span>
          <span style={{ textAlign: 'right' }}>Log</span>
        </div>

        {/* Compact Single-Line Set Logging Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {currentExercise.sets.map((set, setIdx) => {
            const typeInfo = SET_TYPE_BADGE[set.setType || SetType.Normal] || SET_TYPE_BADGE[SetType.Normal];
            return (
              <motion.div
                key={setIdx}
                layout
                className={`set-row ${set.isComplete ? 'completed' : ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 1fr 44px',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 8px',
                  ...(setIdx === currentSetIndex ? { borderColor: 'color-mix(in srgb, var(--accent-red) 38%, transparent)' } : {}),
                }}
              >
                <button
                  onClick={() => set.isComplete ? uncompleteSet(currentExerciseIndex, setIdx) : cycleSetType(currentExerciseIndex, setIdx)}
                  title={set.isComplete ? 'Tap to uncheck set' : `${typeInfo.title} (tap to cycle Warmup/Drop/Failure/AMRAP)`}
                  aria-label={set.isComplete ? `Uncheck set ${setIdx + 1}` : `Set ${setIdx + 1}: ${typeInfo.title}`}
                  style={{
                    width: 32, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: set.isComplete ? 'var(--accent-green)' : typeInfo.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 800, flexShrink: 0,
                    color: set.isComplete ? '#06120e' : typeInfo.color,
                  }}
                >
                  {set.isComplete ? <Check size={14} strokeWidth={3} /> : (typeInfo.label || setIdx + 1)}
                </button>

                {/* Weight Stepper */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <button aria-label={`Decrease set ${setIdx + 1} weight`} onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Math.max(0, Number((set.weight - stepWeight).toFixed(2))))} style={{ width: 28, height: 34, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={12} /></button>
                  <button className="set-input" onClick={() => openNumpad('weight', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 54, minHeight: 34, padding: '4px 2px', fontSize: 14.5 }}>{set.weight}</button>
                  <button aria-label={`Increase set ${setIdx + 1} weight`} onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Number((set.weight + stepWeight).toFixed(2)))} style={{ width: 28, height: 34, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={12} /></button>
                </div>

                {/* Reps Stepper */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <button aria-label={`Decrease set ${setIdx + 1} reps`} onClick={() => updateSetReps(currentExerciseIndex, setIdx, Math.max(0, set.reps - 1))} style={{ width: 28, height: 34, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={12} /></button>
                  <button className="set-input" onClick={() => openNumpad('reps', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 46, minHeight: 34, padding: '4px 2px', fontSize: 14.5 }}>{set.reps || set.targetReps}</button>
                  <button aria-label={`Increase set ${setIdx + 1} reps`} onClick={() => updateSetReps(currentExerciseIndex, setIdx, (set.reps || set.targetReps) + 1)} style={{ width: 28, height: 34, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={12} /></button>
                </div>

                {/* Complete / Status Button */}
                {!set.isComplete ? (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleCompleteSet(currentExerciseIndex, setIdx)}
                    className="complete-set-btn"
                    aria-label={`Complete set ${setIdx + 1}`}
                    style={{ width: 44, minHeight: 34, borderRadius: 9, padding: 0 }}
                  >
                    <Check size={15} strokeWidth={2.8} />
                  </motion.button>
                ) : (
                  <button
                    type="button"
                    onClick={() => uncompleteSet(currentExerciseIndex, setIdx)}
                    aria-label={`Undo set ${setIdx + 1}`}
                    style={{
                      width: 44,
                      height: 34,
                      borderRadius: 9,
                      border: '1px solid color-mix(in srgb, var(--accent-green) 35%, transparent)',
                      background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                      color: 'var(--accent-green)',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {set.isPR ? '🏆' : '✓'}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Add / Remove Set Controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button
            onClick={() => addSet(currentExerciseIndex)}
            className="btn-secondary"
            style={{ flex: 1, minHeight: 40, padding: '8px 12px', fontSize: 12, fontWeight: 700, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={14} /> Add Set
          </button>
          {currentExercise.sets.length > 1 && (
            <button
              onClick={() => removeSet(currentExerciseIndex, currentExercise.sets.length - 1)}
              className="btn-ghost"
              style={{ minHeight: 40, padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Minus size={14} /> Remove Set
            </button>
          )}
        </div>

        {/* Plate Calculator */}
        {currentPlateCalc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 14 }}>
            <button onClick={() => setShowPlates(!showPlates)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, minHeight: 44 }}>
              <span>🏋️ Plate Calculator</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{showPlates ? '▲' : '▼'}</span>
            </button>
            <AnimatePresence>
              {showPlates && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '0 0 var(--r-sm) var(--r-sm)', border: '1px solid var(--border)', borderTop: 'none' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {exerciseInfo?.equipment?.toLowerCase().includes('dumbbell')
                        ? `Dumbbell default: ${dumbbellWeight}${unitLabel} each`
                        : `Bar: ${barWeight}${unitLabel} • Each side: ${((currentExercise.sets[currentSetIndex].weight - barWeight) / 2).toFixed(1)}${unitLabel}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {currentPlateCalc.perSide.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: `${p.color}15`, border: `1px solid ${p.color}30`, borderRadius: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.plate}{unitLabel} ×{p.count}</span>
                        </div>
                      ))}
                      {currentPlateCalc.perSide.length === 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empty bar</span>
                      )}
                    </div>
                    {!currentPlateCalc.isExact && currentPlateCalc.perSide.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--accent-yellow)', marginTop: 6 }}>
                        Closest loadable: {currentPlateCalc.totalWeight}{unitLabel}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Stats footer */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 14, background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-subtle)' }}>
          {[{ v: `${totalVolume.toLocaleString()} ${unitLabel}`, l: 'Volume', c: 'var(--accent-green)' }, { v: totalSets.toString(), l: 'Sets', c: 'var(--accent-purple)' }, { v: formatTime(elapsedTime), l: 'Time', c: 'var(--accent-orange)' }].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 15, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div className="section-label" style={{ fontSize: 9 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Minimized Floating Rest Timer Bar (allows watching animated GIFs while resting) */}
      <AnimatePresence>
        {restTimerActive && restMinimized && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: 'fixed', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))',
              zIndex: 120, background: 'var(--bg-floating)', backdropFilter: 'blur(20px)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 35%, transparent)', borderRadius: 16, padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            <div
              onClick={() => setRestMinimized(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}
            >
              <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: restTimeRemaining > 10 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {restTimeRemaining}s
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Resting • Tap to expand</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{currentExercise.exerciseName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => startRestTimer(restTimeRemaining + 15)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11, minHeight: 34, borderRadius: 8 }}>+15s</button>
              <button onClick={stopRestTimer} className="btn-primary" style={{ padding: '6px 12px', fontSize: 11, minHeight: 34, borderRadius: 8, width: 'auto' }}>Skip</button>
              <button onClick={() => setRestMinimized(false)} className="btn-ghost" style={{ padding: 6, minHeight: 34 }} title="Expand timer" aria-label="Expand timer"><Maximize2 size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Exercise Mid-Workout Modal */}
      <AnimatePresence>
        {showAddExercise && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddExercise(false)}>
            <motion.div className="modal-content" role="dialog" aria-modal="true" aria-label="Add Exercise to Workout" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Add Exercise to Workout</h3>
                <button onClick={() => setShowAddExercise(false)} aria-label="Close modal" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="search-bar" value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search by name or muscle..." style={{ paddingLeft: 36 }} />
              </div>
              <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredAddCatalog.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No exercises match your search and equipment filter.
                  </div>
                ) : (
                  filteredAddCatalog.map(ex => (
                    <button key={ex.id} onClick={() => handleAddExerciseToWorkout(ex)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12,
                      cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)',
                    }}>
                      <ExerciseMedia gifUrl={ex.gifUrl} imageUrls={ex.imageUrls} images={ex.images} alt={ex.name} style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{ex.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ex.equipment} • {ex.primaryMuscles.join(', ')}</div>
                      </div>
                      {hasGifExerciseMedia(ex) && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)' }}>GIF</span>
                      )}
                      <Plus size={16} color="var(--accent-green)" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelConfirm(false)}>
            <motion.div className="modal-content" role="dialog" aria-modal="true" aria-label="Discard Workout Confirmation" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <button
                onClick={() => setShowCancelConfirm(false)}
                aria-label="Close modal"
                style={{ position: 'absolute', top: 18, right: 18, width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
              <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <AlertTriangle size={26} color="var(--accent-red)" />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Discard Workout?</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                  Your progress ({totalSets} sets, {totalVolume.toLocaleString()}{unitLabel} volume) will be permanently discarded.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary" style={{ minHeight: 48, borderRadius: 14, fontSize: 13, fontWeight: 700 }}>
                    Keep Training
                  </button>
                  <button onClick={confirmCancel} className="btn-cancel" style={{ minHeight: 48, borderRadius: 14, fontSize: 13, fontWeight: 800, justifyContent: 'center' }}>
                    End & Discard
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rest Timer Fullscreen Overlay */}
      <AnimatePresence>
        {restTimerActive && !restMinimized && (
          <motion.div className="rest-timer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ textAlign: 'center', width: '100%', maxWidth: 360, padding: '0 20px' }}>
              <div className="section-label" style={{ fontSize: 14, marginBottom: 4 }}>REST</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, textTransform: 'capitalize' }}>{currentExercise.exerciseName}</div>
              <div className="progress-ring-container" style={{ width: 200, height: 200, margin: '0 auto' }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="88" fill="none" stroke="var(--bg-track)" strokeWidth="6" />
                  <circle cx="100" cy="100" r="88" fill="none" stroke={restTimeRemaining > 10 ? 'var(--accent-green)' : restTimeRemaining > 5 ? 'var(--accent-yellow)' : 'var(--accent-red)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88 * (1 - restTimeRemaining / Math.max(1, restTimeDuration))} transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
                </svg>
                <div className="progress-ring-text"><div className="font-mono" style={{ fontSize: 52, fontWeight: 800 }}>{restTimeRemaining}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>sec</div></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => startRestTimer(Math.max(5, restTimeRemaining - 15))} style={{ padding: '12px 20px', borderRadius: 14, minHeight: 48 }}>-15s</button>
                <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={stopRestTimer} style={{ padding: '14px 36px', width: 'auto', borderRadius: 14, minHeight: 48 }}><SkipForward size={18} /> Skip</motion.button>
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining + 15)} style={{ padding: '12px 20px', borderRadius: 14, minHeight: 48 }}>+15s</button>
              </div>
              <button
                onClick={() => setRestMinimized(true)}
                className="btn-ghost"
                style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}
              >
                <Minimize2 size={14} /> Minimize to View Exercise Demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Modal */}
      <AnimatePresence>
        {showNotes && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotes(false)}>
            <motion.div className="modal-content" role="dialog" aria-modal="true" aria-label="Exercise Notes and Instructions" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 2, textTransform: 'capitalize' }}>{currentExercise.exerciseName}</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Exercise notes & instructions</p>
                </div>
                <button onClick={() => setShowNotes(false)} aria-label="Close modal" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <a
                  href={getYoutubeSearchUrl(currentExercise.exerciseName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: '1 1 160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none',
                    background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.15)',
                    color: '#FF4444', fontWeight: 600, fontSize: 12,
                  }}
                >
                  <ExternalLink size={12} /> Watch on YouTube
                </a>
                {getVideoSearchOptions(currentExercise.exerciseName).slice(1).map(opt => (
                  <a
                    key={opt.label}
                    href={opt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none', textAlign: 'center',
                      background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                      fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ExternalLink size={10} /> {opt.label}
                  </a>
                ))}
              </div>

              {exerciseInfo?.instructions && exerciseInfo.instructions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <BookOpen size={14} color="var(--accent-purple)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-purple)' }}>How to Perform</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    {exerciseInfo.instructions.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--gradient-ocean)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, color: 'white' }}>{i + 1}</div>
                        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', flex: 1 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exerciseInfo?.primaryMuscles && exerciseInfo.primaryMuscles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {exerciseInfo.primaryMuscles.map(m => {
                    const color = MUSCLE_COLORS[m.toLowerCase()] || '#888';
                    return <span key={m} className="badge" style={{ background: `${color}14`, color, border: `1px solid ${color}28`, fontWeight: 700, fontSize: 10 }}>● {m}</span>;
                  })}
                  {exerciseInfo.equipment && (
                    <span className="badge badge-muscle" style={{ textTransform: 'capitalize', fontSize: 10 }}>🏋️ {exerciseInfo.equipment}</span>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>YOUR NOTES (SAVED WITH WORKOUT)</div>
                <textarea value={currentExercise.notes ?? notes[currentExerciseIndex] ?? ''} onChange={e => { const val = e.target.value; setNotes(prev => ({ ...prev, [currentExerciseIndex]: val })); updateExerciseNote(currentExerciseIndex, val); }} placeholder="Add form cues, seat settings, or notes..." rows={3}
                  style={{ width: '100%', padding: 14, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <button onClick={() => setShowNotes(false)} className="btn-primary" style={{ borderRadius: 14, minHeight: 46, textShadow: 'none', boxShadow: 'none' }}>Save Note</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Modal */}
      <AnimatePresence>
        {showSwap && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSwap(false)}>
            <motion.div className="modal-content" role="dialog" aria-modal="true" aria-label="Swap Exercise" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Swap Exercise</h3>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'capitalize' }}>Swapping: {currentExercise?.exerciseName}</div>
                </div>
                <button onClick={() => setShowSwap(false)} aria-label="Close modal" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent-green)', marginBottom: 12 }}>
                ✓ Filtered to your selected equipment ({userEquipment.length} items) • GIFs prioritized
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
                {['perfect', 'good', 'home', 'related'].map(cat => {
                  const items = swapSuggestions.filter(s => s.category === cat);
                  if (items.length === 0) return null;
                  const catLabel = { perfect: '🎯 Same Equipment & Muscle', good: '🔄 Other Selected Equipment', home: '🏠 Bodyweight Alternatives', related: '➕ Secondary Muscle' }[cat];
                  return (
                    <div key={cat}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{catLabel}</div>
                      {items.map(({ exercise: ex, matchTags, score }) => (
                        <button key={ex.id} onClick={() => doSwap(ex)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)', marginBottom: 4, minHeight: 56 }}>
                          <ExerciseMedia
                            gifUrl={ex.gifUrl}
                            imageUrls={ex.imageUrls}
                            images={ex.images}
                            alt={ex.name}
                            style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{ex.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                              {matchTags.filter(t => !t.toLowerCase().includes('gif')).slice(0, 3).map((tag, i) => (
                                <span key={i} style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, textTransform: 'capitalize' }}>{tag}</span>
                              ))}
                            </div>
                          </div>
                          {hasGifExerciseMedia(ex) ? (
                            <div style={{ fontSize: 9, color: 'var(--accent-green)', fontWeight: 700 }}>GIF</div>
                          ) : hasAnimatedExerciseMedia(ex) ? (
                            <div style={{ fontSize: 9, color: 'var(--accent-cyan)', fontWeight: 700 }}>ANIM</div>
                          ) : null}
                          <div style={{ padding: '4px 7px', borderRadius: 7, background: `color-mix(in srgb, var(--accent-green) ${Math.round(Math.min(95, Math.max(25, (score / 160) * 100)))}%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-on-mint)', flexShrink: 0 }}>{Math.min(99, Math.max(72, Math.round(score / 1.85)))}%</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Numpad */}
      <AnimatePresence>
        {showNumpad && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNumpad(null)}>
            <motion.div className="modal-content" role="dialog" aria-modal="true" aria-label={showNumpad.field === 'weight' ? 'Enter Weight' : 'Enter Reps'} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <button onClick={() => setShowNumpad(null)} aria-label="Close modal" style={{ position: 'absolute', top: 18, right: 18, width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 4 }}>{showNumpad.field === 'weight' ? 'WEIGHT' : 'REPS'}</div>
                <div className="font-mono" style={{ fontSize: 42, fontWeight: 800 }}>{numpadValue}{showNumpad.field === 'weight' && <span style={{ fontSize: 16, color: 'var(--text-muted)' }}> {unitLabel}</span>}</div>
              </div>
              {showNumpad.field === 'weight' && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                  {[1, 2.5, 5, 10, 20].map(inc => <button key={inc} className="btn-secondary" onClick={() => setNumpadValue(prev => (parseFloat(prev) + inc).toString())} style={{ padding: '9px 14px', fontSize: 13, borderRadius: 10, minHeight: 40 }}>+{inc}</button>)}
                </div>
              )}
              <div className="numpad-grid">
                {['1','2','3','4','5','6','7','8','9', showNumpad.field === 'weight' ? '.' : 'C','0','←'].map(key => <button key={key} className="numpad-key" onClick={() => handleNumpadInput(key)}>{key}</button>)}
                {showNumpad.field === 'weight' && (
                  <button className="numpad-key" onClick={() => handleNumpadInput('C')} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>Clear</button>
                )}
                <motion.button whileTap={{ scale: 0.95 }} className="numpad-key action" onClick={() => handleNumpadInput('✓')} style={{ gridColumn: showNumpad.field === 'weight' ? 'span 2' : '1 / -1' }}>Done</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
