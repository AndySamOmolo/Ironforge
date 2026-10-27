'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Plus, Minus, SkipForward, ChevronLeft, ChevronRight, Dumbbell,
  ArrowLeftRight, ExternalLink, StickyNote, Play, Pause, AlertTriangle,
  BookOpen, Trophy, Trash2, Search, TrendingUp,
} from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { db } from '@/lib/db/schema';
import { MUSCLE_COLORS, SetType } from '@/lib/types';
import type { Exercise } from '@/lib/types';
import { getSwapSuggestions, calculatePlates } from '@/lib/utils/swapEngine';
import { getProgressionSuggestion, estimate1RM, type ProgressionSuggestion } from '@/lib/utils/progressionEngine';
import { matchesUserEquipment } from '@/lib/utils/exerciseResolver';
import { getWorkoutStartingWeight } from '@/lib/utils/workoutDefaults';
import { getYoutubeSearchUrl, getVideoSearchOptions } from '@/lib/data/youtube-ids';
import { getPrimaryExerciseImage, getExerciseImageFrames, hasAnimatedExerciseMedia } from '@/lib/utils/exerciseMedia';
import ExerciseMedia from '@/components/ui/ExerciseMedia';

interface ActiveWorkoutPageProps { onComplete: () => void; }

const SET_TYPE_BADGE: Record<string, { label: string; color: string; bg: string; title: string }> = {
  [SetType.Normal]: { label: '', color: 'var(--text-muted)', bg: 'var(--bg-elevated)', title: 'Normal Set (tap to change)' },
  [SetType.Warmup]: { label: 'W', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', title: 'Warmup Set' },
  [SetType.DropSet]: { label: 'D', color: '#A855F7', bg: 'rgba(168,85,247,0.16)', title: 'Drop Set' },
  [SetType.Failure]: { label: 'F', color: '#FF3D5A', bg: 'rgba(255,61,90,0.16)', title: 'To Failure' },
  [SetType.AMRAP]: { label: 'A', color: '#22D3EE', bg: 'rgba(34,211,238,0.16)', title: 'AMRAP Set' },
};

export default function ActiveWorkoutPage({ onComplete }: ActiveWorkoutPageProps) {
  const {
    exercises, currentExerciseIndex, elapsedTime, totalVolume, totalSets,
    planName, dayName, sessionId, isPaused,
    completeSet, uncompleteSet, updateSetWeight, updateSetReps,
    cycleSetType, addSet, removeSet,
    goToExercise, nextExercise, prevExercise,
    addExercise, removeExercise,
    tickTimer, restTimerActive, restTimeRemaining, restTimeDuration,
    startRestTimer, stopRestTimer, tickRestTimer, endWorkout, togglePause,
    addPR, setSessionId,
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
  } = useUserStore();

  const [showNumpad, setShowNumpad] = useState<{ field: 'weight' | 'reps'; exerciseIdx: number; setIdx: number } | null>(null);
  const [numpadValue, setNumpadValue] = useState('0');
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [showSwap, setShowSwap] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<{ exercise: Exercise; score: number; matchTags: string[]; category: string }[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [allCatalog, setAllCatalog] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showPlates, setShowPlates] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [exerciseInfo, setExerciseInfo] = useState<Exercise | null>(null);
  const [historicalBest1RM, setHistoricalBest1RM] = useState<number>(0);
  const [lastBestSet, setLastBestSet] = useState<{ weight: number; reps: number } | null>(null);
  const [overloadTip, setOverloadTip] = useState<ProgressionSuggestion | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    } else { if (restTimerRef.current) clearInterval(restTimerRef.current); }
  }, [restTimerActive, tickRestTimer]);

  useEffect(() => {
    if (!keepScreenOn) return;
    let wakeLock: any = null;
    const req = async () => { try { if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {} };
    req();
    return () => { if (wakeLock) wakeLock.release(); };
  }, [keepScreenOn]);

  const currentExercise = exercises[currentExerciseIndex];

  // Load exercise info, historical PRs, and progressive overload suggestion when current exercise changes
  useEffect(() => {
    const loadExerciseInfoAndHistory = async () => {
      if (!currentExercise) return;
      try {
        let ex = currentExercise.exerciseId ? await db.exercises.get(currentExercise.exerciseId) : undefined;
        if (!ex) {
          ex = await db.exercises.where('name').equalsIgnoreCase(currentExercise.exerciseName).first();
        }
        setExerciseInfo(ex || null);

        const exId = ex?.id || currentExercise.exerciseId;
        if (exId) {
          const [pastSets, pastPRs] = await Promise.all([
            db.sets.where('exerciseId').equals(exId).toArray(),
            db.personalRecords.where('exerciseId').equals(exId).toArray(),
          ]);

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
        setExerciseInfo(null);
      }
    };
    loadExerciseInfoAndHistory();
  }, [currentExerciseIndex, exercises, currentExercise, unitSystem]);

  const currentSetIndex = currentExercise?.sets.findIndex(s => !s.isComplete) ?? -1;
  const progress = exercises.length > 0 ? (exercises.filter(e => e.isComplete).length / exercises.length) * 100 : 0;

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
      const ctx = new AudioCtx();
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
    } else if (restTimerActive && countdownSound && restTimeRemaining > 0 && restTimeRemaining <= 3) {
      playFeedbackTone('tick');
    }
  }, [restTimeRemaining, restTimerActive, countdownSound, playFeedbackTone, triggerHaptic]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCompleteSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    const exercise = exercises[exerciseIdx];
    const set = exercise.sets[setIdx];
    const weight = set.weight || 0;
    const reps = set.reps || set.targetReps || 0;

    // Check if this set beats the historical 1RM AND any completed set in the current exercise
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
      startRestTimer(exercise.restTime || defaultRestTime);
    }
    const updated = [...exercise.sets];
    updated[setIdx] = { ...updated[setIdx], isComplete: true };
    if (autoAdvance && updated.every(s => s.isComplete) && currentExerciseIndex < exercises.length - 1) {
      setTimeout(() => nextExercise(), 600);
    }
  }, [exercises, completeSet, startRestTimer, defaultRestTime, currentExerciseIndex, nextExercise, playFeedbackTone, triggerHaptic, autoStartRest, restTimerEnabled, autoAdvance, historicalBest1RM, addPR]);

  const handleFinish = async () => {
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

    const combinedNotes = Object.entries(notes)
      .filter(([, text]) => text && text.trim().length > 0)
      .map(([idx, text]) => `${exercises[Number(idx)]?.exerciseName || 'Exercise'}: ${text.trim()}`)
      .join(' | ');

    const savedSessionId = sessionId
      ? sessionId
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

    setSessionId(savedSessionId);

    if (sessionId) {
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
    }

    if (completedSetEntries.length > 0) {
      await db.sets.bulkAdd(
        completedSetEntries.map(set => ({
          sessionExerciseId: 0,
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

      // Persist new Personal Records to db.personalRecords
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
          addPR(candidate.exerciseName, candidate.weight, candidate.reps);
        }
      }
    }
    onComplete();
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
        gifUrl: newEx.gifUrl,
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
        const existing = await db.exerciseSwaps
          .where('planName')
          .equals(planName)
          .filter(s => s.dayName === dayName && s.originalExerciseName.toLowerCase() === currentExercise.exerciseName.toLowerCase())
          .first();
        if (existing?.id) {
          await db.exerciseSwaps.update(existing.id, {
            newExerciseId: newEx.id || 0,
            newExerciseName: newEx.name,
            newGifUrl: newEx.gifUrl,
            swappedAt: new Date(),
          });
        } else {
          await db.exerciseSwaps.add({
            planName,
            dayName,
            originalExerciseName: currentExercise.exerciseName,
            newExerciseId: newEx.id || 0,
            newExerciseName: newEx.name,
            newGifUrl: newEx.gifUrl,
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
      gifUrl: ex.gifUrl,
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
        showNumpad.field === 'weight' ? updateSetWeight(showNumpad.exerciseIdx, showNumpad.setIdx, v) : updateSetReps(showNumpad.exerciseIdx, showNumpad.setIdx, Math.round(v));
        setShowNumpad(null);
      }
    } else setNumpadValue(prev => prev === '0' ? key : prev + key);
  };

  if (!currentExercise) {
    return <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><Dumbbell size={48} color="var(--text-dim)" style={{ marginBottom: 16 }} /><h2>No exercises</h2><button className="btn-secondary" onClick={() => endWorkout()} style={{ marginTop: 16 }}>Go Back</button></div>
    </div>;
  }

  const exerciseGif = currentExercise.gifUrl || currentExercise.imageUrl;
  const exerciseMediaFrames = currentExercise.mediaFrames || [];
  const hasVisualMedia = Boolean(exerciseGif) || exerciseMediaFrames.length > 0;
  const showAnimatedBadge = Boolean(currentExercise.gifUrl) || exerciseMediaFrames.length > 1;
  const hasImgError = imgErrors.has(currentExerciseIndex);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-sheet)', backdropFilter: 'blur(24px)', zIndex: 50, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={handleCancel} className="btn-cancel" style={{ minHeight: 40 }}><X size={16} /> Cancel</button>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>{dayName || planName}</div>
          <button onClick={handleFinish} className="btn-primary" style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: '6px 12px', minHeight: 34, width: 'auto', color: '#fff', textShadow: 'none', boxShadow: 'none' }}>Finish</button>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
          <motion.div style={{ height: '100%', background: 'var(--gradient-fire)', borderRadius: 2 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Exercise {currentExerciseIndex + 1} of {exercises.length}</span>
          {showTimer !== false && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={togglePause}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isPaused ? 'rgba(16,232,154,0.12)' : 'rgba(255,61,90,0.08)',
                  border: `1px solid ${isPaused ? 'rgba(16,232,154,0.25)' : 'rgba(255,61,90,0.15)'}`,
                  color: isPaused ? 'var(--accent-green)' : 'var(--accent-red)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
              </button>
              <span className="font-mono" style={{
                color: isPaused ? 'var(--accent-yellow)' : 'var(--accent-red)',
                fontWeight: 700, fontSize: 13,
                animation: isPaused ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
              }}>
                ⏱ {formatTime(elapsedTime)}
                {isPaused && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.8 }}>PAUSED</span>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Exercise queue + Add Exercise */}
      <div className="chip-scroll" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        {exercises.map((ex, idx) => (
          <button key={idx} onClick={() => goToExercise(idx)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, border: idx === currentExerciseIndex ? '2px solid var(--accent-red)' : '1px solid var(--border)', background: ex.isComplete ? 'rgba(16,232,154,0.06)' : 'var(--bg-glass)', color: ex.isComplete ? 'var(--accent-green)' : idx === currentExerciseIndex ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 38, textTransform: 'capitalize' }}>
            {ex.isComplete ? '✓ ' : ''}{ex.exerciseName.split(' ').slice(0, 3).join(' ')}
          </button>
        ))}
        <button
          onClick={openAddExerciseModal}
          style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: 12,
            border: '1px dashed var(--accent-purple)', background: 'rgba(139,92,246,0.08)',
            color: 'var(--accent-purple)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, minHeight: 38,
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div style={{ padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom) + 120px)' }}>
        {/* GIF display — upscaled */}
        {hasVisualMedia && !hasImgError && (
          <div className="gif-upscale-container" style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14, background: '#0a0a14', position: 'relative', border: '1px solid var(--border)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(139,92,246,0.04) 0%, transparent 70%)', zIndex: 0 }} />
            <ExerciseMedia
              gifUrl={currentExercise.gifUrl || exerciseGif}
              imageUrls={exerciseMediaFrames.length > 0 ? exerciseMediaFrames : (exerciseGif ? [exerciseGif] : [])}
              alt={currentExercise.exerciseName}
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', transform: 'scale(1.12)', transformOrigin: 'center', position: 'relative', zIndex: 1 }}
              onExhausted={() => setImgErrors(prev => new Set(prev).add(currentExerciseIndex))}
            />
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4, zIndex: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse-dot 2s ease-in-out infinite' }} /> {showAnimatedBadge ? 'ANIMATED' : 'IMAGE'}
            </div>
          </div>
        )}

        {/* Title + controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 className="font-display" style={{ fontSize: 19, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>{currentExercise.exerciseName}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Set {currentSetIndex >= 0 ? currentSetIndex + 1 : '✓'} of {currentExercise.sets.length}</span>
              {exerciseInfo?.equipment && <span style={{ color: 'var(--accent-purple)', textTransform: 'capitalize' }}>• {exerciseInfo.equipment}</span>}
              {lastBestSet && (
                <span style={{ color: 'var(--accent-yellow)', fontWeight: 700, fontSize: 11 }}>
                  🏆 Best: {lastBestSet.weight}{unitLabel} × {lastBestSet.reps}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowNotes(true)} title="Notes & Instructions" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--accent-yellow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={16} /></button>
            <button onClick={handleSwap} title="Swap Exercise (Equipment-Filtered)" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--accent-purple)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeftRight size={16} /></button>
            {exercises.length > 1 && (
              <button onClick={() => removeExercise(currentExerciseIndex)} title="Remove Exercise" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.2)', color: 'var(--accent-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={15} /></button>
            )}
            <button onClick={prevExercise} disabled={currentExerciseIndex === 0} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === 0 ? 0.3 : 1 }}><ChevronLeft size={18} /></button>
            <button onClick={nextExercise} disabled={currentExerciseIndex === exercises.length - 1} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === exercises.length - 1 ? 0.3 : 1 }}><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* Progressive Overload Suggestion Banner */}
        {overloadTip && overloadTip.suggestedWeight > 0 && (
          <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid rgba(16,232,154,0.22)', background: 'rgba(16,232,154,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <TrendingUp size={16} color="var(--accent-green)" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {overloadTip.icon} Target: {overloadTip.suggestedWeight}{unitLabel} × {overloadTip.suggestedReps}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{overloadTip.reason}</div>
              </div>
            </div>
            <button
              onClick={() => {
                updateSetWeight(currentExerciseIndex, 0, overloadTip.suggestedWeight);
                updateSetReps(currentExerciseIndex, 0, overloadTip.suggestedReps);
              }}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, borderRadius: 8, minHeight: 32, flexShrink: 0 }}
            >
              Apply
            </button>
          </div>
        )}

        {/* Set dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
          {currentExercise.sets.map((set, i) => (
            <motion.div key={i} animate={{ scale: i === currentSetIndex ? 1.4 : 1 }} style={{ width: 10, height: 10, borderRadius: '50%', background: set.isComplete ? 'var(--accent-green)' : i === currentSetIndex ? 'transparent' : 'rgba(255,255,255,0.04)', border: i === currentSetIndex ? '2px solid var(--accent-red)' : set.isComplete ? 'none' : '1px solid var(--border-subtle)', boxShadow: set.isComplete ? '0 0 8px rgba(16,232,154,0.3)' : 'none' }} />
          ))}
        </div>

        {/* Sets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {currentExercise.sets.map((set, setIdx) => {
            const typeInfo = SET_TYPE_BADGE[set.setType || SetType.Normal] || SET_TYPE_BADGE[SetType.Normal];
            return (
              <motion.div key={setIdx} layout className={`set-row ${set.isComplete ? 'completed' : ''}`} style={setIdx === currentSetIndex ? { borderColor: 'rgba(255,61,90,0.3)' } : {}}>
                <button
                  onClick={() => set.isComplete ? uncompleteSet(currentExerciseIndex, setIdx) : cycleSetType(currentExerciseIndex, setIdx)}
                  title={set.isComplete ? 'Tap to uncheck set' : typeInfo.title}
                  style={{
                    width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: set.isComplete ? 'var(--accent-green)' : typeInfo.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, flexShrink: 0,
                    color: set.isComplete ? 'white' : typeInfo.color,
                  }}
                >
                  {set.isComplete ? <Check size={14} /> : (typeInfo.label || setIdx + 1)}
                </button>
                <div style={{ flex: 1 }}>
                  <div className="section-label" style={{ marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{unitLabel.toUpperCase()} (±{stepWeight})</span>
                    {set.isPR && <span style={{ color: 'var(--accent-yellow)', fontWeight: 800 }}>🏆 PR</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Math.max(0, Number((set.weight - stepWeight).toFixed(2))))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={14} /></button>
                    <button className="set-input" onClick={() => openNumpad('weight', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 60, minHeight: 40 }}>{set.weight}</button>
                    <button onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Number((set.weight + stepWeight).toFixed(2)))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={14} /></button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="section-label" style={{ marginBottom: 3 }}>REPS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => updateSetReps(currentExerciseIndex, setIdx, Math.max(0, set.reps - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={14} /></button>
                    <button className="set-input" onClick={() => openNumpad('reps', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 52, minHeight: 40 }}>{set.reps || set.targetReps}</button>
                    <button onClick={() => updateSetReps(currentExerciseIndex, setIdx, (set.reps || set.targetReps) + 1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={14} /></button>
                  </div>
                </div>
                {!set.isComplete && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCompleteSet(currentExerciseIndex, setIdx)}
                    className="complete-set-btn"
                    aria-label={`Complete set ${setIdx + 1}`}
                  >
                    <Check size={16} />
                    <span>Done</span>
                  </motion.button>
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
        {currentSetIndex >= 0 && currentExercise.sets[currentSetIndex]?.weight > 0 && (
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
                      {calculatePlates(currentExercise.sets[currentSetIndex].weight, barWeight).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: `${p.color}15`, border: `1px solid ${p.color}30`, borderRadius: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.plate}{unitLabel} ×{p.count}</span>
                        </div>
                      ))}
                      {calculatePlates(currentExercise.sets[currentSetIndex].weight, barWeight).length === 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empty bar</span>
                      )}
                    </div>
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

      {/* Add Exercise Mid-Workout Modal */}
      <AnimatePresence>
        {showAddExercise && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddExercise(false)}>
            <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Add Exercise to Workout</h3>
                <button onClick={() => setShowAddExercise(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="search-bar" value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search by name or muscle..." style={{ paddingLeft: 36 }} />
              </div>
              <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredAddCatalog.map(ex => (
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
                    <Plus size={16} color="var(--accent-green)" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelConfirm(false)}>
            <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} style={{ maxHeight: '40dvh' }}>
              <div className="modal-handle" />
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <AlertTriangle size={28} color="var(--accent-red)" />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Discard Workout?</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                  Your progress ({totalSets} sets, {totalVolume.toLocaleString()}{unitLabel} volume) will be discarded.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary" style={{ flex: 1, minHeight: 48, borderRadius: 14 }}>
                    Continue Workout
                  </button>
                  <button onClick={confirmCancel} className="btn-cancel" style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
                    End & Discard
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rest Timer */}
      <AnimatePresence>
        {restTimerActive && (
          <motion.div className="rest-timer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="section-label" style={{ fontSize: 14, marginBottom: 4 }}>REST</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{currentExercise.exerciseName}</div>
              <div className="progress-ring-container" style={{ width: 200, height: 200, margin: '0 auto' }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                  <circle cx="100" cy="100" r="88" fill="none" stroke={restTimeRemaining > 10 ? 'var(--accent-green)' : restTimeRemaining > 5 ? 'var(--accent-yellow)' : 'var(--accent-red)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88 * (1 - restTimeRemaining / restTimeDuration)} transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
                </svg>
                <div className="progress-ring-text"><div className="font-mono" style={{ fontSize: 52, fontWeight: 800 }}>{restTimeRemaining}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>sec</div></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => startRestTimer(Math.max(5, restTimeRemaining - 15))} style={{ padding: '12px 20px', borderRadius: 14, minHeight: 48 }}>-15s</button>
                <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={stopRestTimer} style={{ padding: '14px 36px', width: 'auto', borderRadius: 14, minHeight: 48 }}><SkipForward size={18} /> Skip</motion.button>
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining + 15)} style={{ padding: '12px 20px', borderRadius: 14, minHeight: 48 }}>+15s</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Modal */}
      <AnimatePresence>
        {showNotes && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotes(false)}>
            <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, textTransform: 'capitalize' }}>{currentExercise.exerciseName}</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Exercise notes & instructions</p>

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
                {getVideoSearchOptions(currentExercise.exerciseName).slice(1, 3).map(opt => (
                  <a
                    key={opt.label}
                    href={opt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none', textAlign: 'center',
                      background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                      fontSize: 10, fontWeight: 600,
                    }}
                  >
                    {opt.label}
                  </a>
                ))}
              </div>

              {exerciseInfo?.instructions && exerciseInfo.instructions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <BookOpen size={14} color="var(--accent-purple)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-purple)' }}>How to Perform</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border)', maxHeight: '35vh', overflowY: 'auto' }}>
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
                <textarea value={notes[currentExerciseIndex] || ''} onChange={e => setNotes(prev => ({ ...prev, [currentExerciseIndex]: e.target.value }))} placeholder="Add form cues, seat settings, or notes..." rows={3}
                  style={{ width: '100%', padding: 14, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <button onClick={() => setShowNotes(false)} className="btn-primary" style={{ borderRadius: 14, minHeight: 46, color: '#fff', textShadow: 'none', boxShadow: 'none' }}>Save Note</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Modal */}
      <AnimatePresence>
        {showSwap && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSwap(false)}>
            <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Swap Exercise</h3>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Swapping: {currentExercise?.exerciseName}</div>
              <div style={{ fontSize: 10, color: 'var(--accent-green)', marginBottom: 12 }}>
                ✓ Filtered to your selected equipment ({userEquipment.length} items) & remembered for future sessions
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
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              {matchTags.slice(0, 3).map((tag, i) => (<span key={i} style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>{tag}</span>))}
                            </div>
                          </div>
                          {hasAnimatedExerciseMedia(ex) && (
                            <div style={{ fontSize: 9, color: 'var(--accent-green)', fontWeight: 700 }}>ANIM</div>
                          )}
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: `rgba(16,232,154,${Math.min(1, score / 140)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>{score}</div>
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
            <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
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
                <motion.button whileTap={{ scale: 0.95 }} className="numpad-key action" onClick={() => handleNumpadInput('✓')} style={{ gridColumn: '1 / -1' }}>Done</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
