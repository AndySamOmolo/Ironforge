'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus, Minus, Timer, SkipForward, ChevronLeft, ChevronRight, Dumbbell, ArrowLeftRight, ExternalLink, Zap, StickyNote, Play, Pause, AlertTriangle, BookOpen } from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { db } from '@/lib/db/schema';
import { MUSCLE_COLORS } from '@/lib/types';
import type { Exercise } from '@/lib/types';
import { getSwapSuggestions, calculatePlates } from '@/lib/utils/swapEngine';

interface ActiveWorkoutPageProps { onComplete: () => void; }

export default function ActiveWorkoutPage({ onComplete }: ActiveWorkoutPageProps) {
  const {
    exercises, currentExerciseIndex, elapsedTime, totalVolume, totalSets,
    planName, dayName, sessionId, isPaused,
    completeSet, updateSetWeight, updateSetReps,
    goToExercise, nextExercise, prevExercise,
    tickTimer, restTimerActive, restTimeRemaining, restTimeDuration,
    startRestTimer, stopRestTimer, tickRestTimer, endWorkout, togglePause,
  } = useWorkoutStore();
  const { defaultRestTime, unitSystem, soundEnabled, hapticEnabled, barWeight, dumbbellWeight } = useUserStore();
  const [showNumpad, setShowNumpad] = useState<{ field: 'weight' | 'reps'; exerciseIdx: number; setIdx: number } | null>(null);
  const [numpadValue, setNumpadValue] = useState('0');
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [showSwap, setShowSwap] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<{ exercise: Exercise; score: number; matchTags: string[]; category: string }[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showPlates, setShowPlates] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [exerciseInfo, setExerciseInfo] = useState<Exercise | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    let wakeLock: any = null;
    const req = async () => { try { if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {} };
    req();
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  // Load exercise info when current exercise changes
  useEffect(() => {
    const loadExerciseInfo = async () => {
      if (!currentExercise) return;
      try {
        const ex = await db.exercises.where('name').equalsIgnoreCase(currentExercise.exerciseName).first();
        if (!ex) {
          const keywords = currentExercise.exerciseName.toLowerCase().split(/\s+/).filter(k => k.length > 2);
          const candidates = await db.exercises.filter(e => {
            const eName = e.name.toLowerCase();
            return keywords.every(kw => eName.includes(kw));
          }).limit(3).toArray();
          setExerciseInfo(candidates[0] || null);
        } else {
          setExerciseInfo(ex);
        }
      } catch {
        setExerciseInfo(null);
      }
    };
    loadExerciseInfo();
  }, [currentExerciseIndex, exercises]);

  const currentExercise = exercises[currentExerciseIndex];
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

  const playFeedbackTone = useCallback((mode: 'set' | 'finish' | 'rest') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);

      const sequence = mode === 'finish'
        ? [660, 880, 1100]
        : mode === 'rest'
          ? [880, 1100]
          : [760];

      sequence.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const start = now + idx * 0.11;
        const stop = start + 0.09;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.connect(gain);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, stop);
        osc.start(start);
        osc.stop(stop);
      });
    } catch {}
  }, [soundEnabled]);

  // Rest timer feedback
  useEffect(() => {
    if (restTimerActive && restTimeRemaining === 0) {
      playFeedbackTone('rest');
      triggerHaptic('success');
    }
  }, [restTimeRemaining, restTimerActive, playFeedbackTone, triggerHaptic]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCompleteSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    const exercise = exercises[exerciseIdx]; const set = exercise.sets[setIdx];
    const weight = set.weight || 0; const reps = set.reps || set.targetReps || 0;
    completeSet(exerciseIdx, setIdx, weight, reps);
    playFeedbackTone('set');
    triggerHaptic('light');
    if (sessionId) {
      try { await db.sets.add({ sessionExerciseId: 0, sessionId, exerciseId: exercise.exerciseId, setNumber: setIdx + 1, setType: 'normal' as any, weight, reps, completedAt: new Date(), isWarmup: false, isPR: false }); } catch {}
    }
    startRestTimer(exercise.restTime || defaultRestTime);
    const updated = [...exercise.sets]; updated[setIdx] = { ...updated[setIdx], isComplete: true };
    if (updated.every(s => s.isComplete) && currentExerciseIndex < exercises.length - 1) setTimeout(() => nextExercise(), 600);
  }, [exercises, sessionId, completeSet, startRestTimer, defaultRestTime, currentExerciseIndex, nextExercise, playFeedbackTone, triggerHaptic]);

  const handleFinish = async () => {
    playFeedbackTone('finish');
    triggerHaptic('success');
    if (sessionId) {
      await db.workoutSessions.update(sessionId, { completedAt: new Date(), duration: elapsedTime, totalVolume, totalSets, totalReps: exercises.reduce((a, e) => a + e.sets.filter(s => s.isComplete).reduce((acc, s) => acc + s.reps, 0), 0), isComplete: true });
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
      const all = await db.exercises.toArray();
      const current = all.find(e => e.name.toLowerCase() === currentExercise.exerciseName.toLowerCase());
      if (!current) return;
      const sessionIds = exercises.map(e => e.exerciseId).filter(Boolean);
      const suggestions = await getSwapSuggestions(current, sessionIds);
      setSwapSuggestions(suggestions); setShowSwap(true);
    } catch {}
  };

  const doSwap = async (newEx: Exercise) => {
    const { swapExercise } = useWorkoutStore.getState();
    if (swapExercise) {
      swapExercise(currentExerciseIndex, {
        exerciseId: newEx.id || 0,
        exerciseName: newEx.name,
        imageUrl: newEx.gifUrl || newEx.imageUrls?.[0],
        gifUrl: newEx.gifUrl,
        sets: currentExercise.sets.map(s => ({ ...s, isComplete: false })),
        targetSets: currentExercise.targetSets,
        targetReps: currentExercise.targetReps,
        restTime: currentExercise.restTime,
        isComplete: false,
      });
    }
    // Persist swap to DB for future sessions
    if (planName && dayName) {
      try {
        // Remove existing swap for this exercise in this plan/day
        const existing = await db.exerciseSwaps
          .where('[planName+dayName+originalExerciseName]')
          .equals([planName, dayName, currentExercise.exerciseName])
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

  const openNumpad = (field: 'weight' | 'reps', eIdx: number, sIdx: number) => {
    const set = exercises[eIdx].sets[sIdx]; setNumpadValue(field === 'weight' ? set.weight.toString() : set.reps.toString());
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
  const hasImgError = imgErrors.has(currentExerciseIndex);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, background: 'rgba(7,7,16,0.95)', backdropFilter: 'blur(24px)', zIndex: 50, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={handleCancel} className="btn-cancel" style={{ minHeight: 40 }}><X size={16} /> Cancel</button>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>{dayName || planName}</div>
          <button onClick={handleFinish} className="btn-primary btn-high-contrast" style={{ fontSize: 13, fontWeight: 800, borderRadius: 12, padding: '10px 20px', minHeight: 40 }}>Finish</button>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
          <motion.div style={{ height: '100%', background: 'var(--gradient-fire)', borderRadius: 2 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{currentExerciseIndex + 1}/{exercises.length}</span>
          {/* Timer with pause button */}
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
        </div>
      </div>

      {/* Exercise queue */}
      <div className="chip-scroll" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        {exercises.map((ex, idx) => (
          <button key={idx} onClick={() => goToExercise(idx)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, border: idx === currentExerciseIndex ? '2px solid var(--accent-red)' : '1px solid var(--border)', background: ex.isComplete ? 'rgba(16,232,154,0.06)' : 'var(--bg-glass)', color: ex.isComplete ? 'var(--accent-green)' : idx === currentExerciseIndex ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 38 }}>
            {ex.isComplete ? '✓ ' : ''}{ex.exerciseName.split(' ').slice(0, 3).join(' ')}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom) + 120px)' }}>
        {/* GIF display — upscaled */}
        {exerciseGif && !hasImgError && (
          <div className="gif-upscale-container" style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14, background: '#0a0a14', position: 'relative', border: '1px solid var(--border)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(139,92,246,0.04) 0%, transparent 70%)', zIndex: 0 }} />
            <img
              src={exerciseGif} alt={currentExercise.exerciseName}
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', transform: 'scale(1.12)', transformOrigin: 'center', position: 'relative', zIndex: 1 }}
              onError={() => setImgErrors(prev => new Set(prev).add(currentExerciseIndex))}
            />
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4, zIndex: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse-dot 2s ease-in-out infinite' }} /> GIF
            </div>
          </div>
        )}

        {/* Title + controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <h2 className="font-display" style={{ fontSize: 19, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.02em' }}>{currentExercise.exerciseName}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Set {currentSetIndex >= 0 ? currentSetIndex + 1 : '✓'} of {currentExercise.sets.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowNotes(true)} title="Notes" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--accent-yellow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={16} /></button>
            <button onClick={handleSwap} title="Swap" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--accent-purple)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeftRight size={16} /></button>
            <button onClick={prevExercise} disabled={currentExerciseIndex === 0} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === 0 ? 0.3 : 1 }}><ChevronLeft size={18} /></button>
            <button onClick={nextExercise} disabled={currentExerciseIndex === exercises.length - 1} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === exercises.length - 1 ? 0.3 : 1 }}><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* Set dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
          {currentExercise.sets.map((set, i) => (
            <motion.div key={i} animate={{ scale: i === currentSetIndex ? 1.4 : 1 }} style={{ width: 10, height: 10, borderRadius: '50%', background: set.isComplete ? 'var(--accent-green)' : i === currentSetIndex ? 'transparent' : 'rgba(255,255,255,0.04)', border: i === currentSetIndex ? '2px solid var(--accent-red)' : set.isComplete ? 'none' : '1px solid var(--border-subtle)', boxShadow: set.isComplete ? '0 0 8px rgba(16,232,154,0.3)' : 'none' }} />
          ))}
        </div>

        {/* Sets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {currentExercise.sets.map((set, setIdx) => (
            <motion.div key={setIdx} layout className={`set-row ${set.isComplete ? 'completed' : ''}`} style={setIdx === currentSetIndex ? { borderColor: 'rgba(255,61,90,0.3)' } : {}}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: set.isComplete ? 'var(--accent-green)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, color: set.isComplete ? 'white' : 'var(--text-muted)' }}>
                {set.isComplete ? <Check size={14} /> : setIdx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div className="section-label" style={{ marginBottom: 3 }}>{unitSystem === 'metric' ? 'KG' : 'LBS'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Math.max(0, set.weight - 2.5))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={14} /></button>
                  <button className="set-input" onClick={() => openNumpad('weight', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 60, minHeight: 40 }}>{set.weight}</button>
                  <button onClick={() => updateSetWeight(currentExerciseIndex, setIdx, set.weight + 2.5)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={14} /></button>
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
          ))}
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
                        ? `Dumbbell default: ${dumbbellWeight}${unitSystem === 'metric' ? 'kg' : 'lbs'} each`
                        : `Bar: ${barWeight}${unitSystem === 'metric' ? 'kg' : 'lbs'} • Each side: ${((currentExercise.sets[currentSetIndex].weight - barWeight) / 2).toFixed(1)}${unitSystem === 'metric' ? 'kg' : 'lbs'}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {calculatePlates(currentExercise.sets[currentSetIndex].weight, barWeight).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: `${p.color}15`, border: `1px solid ${p.color}30`, borderRadius: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.plate}kg ×{p.count}</span>
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
          {[{ v: totalVolume.toLocaleString(), l: 'Volume', c: 'var(--accent-green)' }, { v: totalSets.toString(), l: 'Sets', c: 'var(--accent-purple)' }, { v: formatTime(elapsedTime), l: 'Time', c: 'var(--accent-orange)' }].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div className="section-label" style={{ fontSize: 9 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

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
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>End Workout?</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                  Your progress ({totalSets} sets, {totalVolume.toLocaleString()}kg volume) will be lost.
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
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining - 15)} style={{ padding: '12px 20px', borderRadius: 14, minHeight: 48 }}>-15s</button>
                <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={stopRestTimer} style={{ padding: '14px 36px', width: 'auto', borderRadius: 14, minHeight: 48 }}><SkipForward size={18} /> Skip</motion.button>
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining + 15)} style={{ padding: '12px 20px', borderRadius: 14, minHeight: 48 }}>+15s</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Modal — now with exercise info */}
      <AnimatePresence>
        {showNotes && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotes(false)}>
            <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{currentExercise.exerciseName}</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Exercise notes & instructions</p>

              {/* Exercise instructions from DB */}
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

              {/* Muscle targets */}
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

              {/* User notes */}
              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>YOUR NOTES</div>
                <textarea value={notes[currentExerciseIndex] || ''} onChange={e => setNotes(prev => ({ ...prev, [currentExerciseIndex]: e.target.value }))} placeholder="Add notes for this exercise..."  rows={3}
                  style={{ width: '100%', padding: 14, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <button onClick={() => setShowNotes(false)} className="btn-primary" style={{ borderRadius: 14, minHeight: 48 }}>Done</button>
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
              <div style={{ fontSize: 10, color: 'var(--accent-green)', marginBottom: 12 }}>✓ Swaps are remembered for future sessions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
                {['perfect', 'good', 'home', 'related'].map(cat => {
                  const items = swapSuggestions.filter(s => s.category === cat);
                  if (items.length === 0) return null;
                  const catLabel = { perfect: '🎯 Perfect Swaps', good: '🔄 Good Alternatives', home: '🏠 Home Alternatives', related: '➕ Related' }[cat];
                  return (
                    <div key={cat}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{catLabel}</div>
                      {items.map(({ exercise: ex, matchTags, score }) => (
                        <button key={ex.id} onClick={() => doSwap(ex)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)', marginBottom: 4, minHeight: 56 }}>
                          {ex.gifUrl && <img src={ex.gifUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{ex.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              {matchTags.slice(0, 3).map((tag, i) => (<span key={i} style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>{tag}</span>))}
                            </div>
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: `rgba(16,232,154,${score / 150})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>{score}</div>
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
                <div className="font-mono" style={{ fontSize: 42, fontWeight: 800 }}>{numpadValue}{showNumpad.field === 'weight' && <span style={{ fontSize: 16, color: 'var(--text-muted)' }}> {unitSystem === 'metric' ? 'kg' : 'lbs'}</span>}</div>
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
