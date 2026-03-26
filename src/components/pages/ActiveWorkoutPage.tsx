'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus, Minus, Timer, SkipForward, ChevronLeft, ChevronRight, Dumbbell, ArrowLeftRight, ExternalLink, Zap, StickyNote, Play } from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { db } from '@/lib/db/schema';
import { MUSCLE_COLORS } from '@/lib/types';
import type { Exercise } from '@/lib/types';
import { getYoutubeSearchUrl } from '@/lib/data/youtube-ids';

interface ActiveWorkoutPageProps { onComplete: () => void; }

export default function ActiveWorkoutPage({ onComplete }: ActiveWorkoutPageProps) {
  const {
    exercises, currentExerciseIndex, elapsedTime, totalVolume, totalSets,
    planName, dayName, sessionId,
    completeSet, updateSetWeight, updateSetReps,
    goToExercise, nextExercise, prevExercise,
    tickTimer, restTimerActive, restTimeRemaining, restTimeDuration,
    startRestTimer, stopRestTimer, tickRestTimer, endWorkout,
  } = useWorkoutStore();
  const { defaultRestTime, unitSystem, soundEnabled } = useUserStore();
  const [showNumpad, setShowNumpad] = useState<{ field: 'weight' | 'reps'; exerciseIdx: number; setIdx: number } | null>(null);
  const [numpadValue, setNumpadValue] = useState('0');
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [showSwap, setShowSwap] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showNotes, setShowNotes] = useState(false);
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

  // Rest timer sound
  useEffect(() => {
    if (restTimerActive && restTimeRemaining === 0 && soundEnabled) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => { const o2 = ctx.createOscillator(); o2.connect(gain); o2.frequency.value = 1100; o2.type = 'sine'; o2.start(); o2.stop(ctx.currentTime + 0.2); }, 350);
      } catch {}
    }
  }, [restTimeRemaining, restTimerActive, soundEnabled]);

  useEffect(() => {
    let wakeLock: any = null;
    const req = async () => { try { if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {} };
    req();
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  const currentExercise = exercises[currentExerciseIndex];
  const currentSetIndex = currentExercise?.sets.findIndex(s => !s.isComplete) ?? -1;
  const progress = exercises.length > 0 ? (exercises.filter(e => e.isComplete).length / exercises.length) * 100 : 0;

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCompleteSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    const exercise = exercises[exerciseIdx]; const set = exercise.sets[setIdx];
    const weight = set.weight || 0; const reps = set.reps || set.targetReps || 0;
    completeSet(exerciseIdx, setIdx, weight, reps);
    if (sessionId) {
      try { await db.sets.add({ sessionExerciseId: 0, sessionId, exerciseId: exercise.exerciseId, setNumber: setIdx + 1, setType: 'normal' as any, weight, reps, completedAt: new Date(), isWarmup: false, isPR: false }); } catch {}
    }
    startRestTimer(exercise.restTime || defaultRestTime);
    const updated = [...exercise.sets]; updated[setIdx] = { ...updated[setIdx], isComplete: true };
    if (updated.every(s => s.isComplete) && currentExerciseIndex < exercises.length - 1) setTimeout(() => nextExercise(), 600);
  }, [exercises, sessionId, completeSet, startRestTimer, defaultRestTime, currentExerciseIndex, nextExercise]);

  const handleFinish = async () => {
    if (sessionId) {
      await db.workoutSessions.update(sessionId, { completedAt: new Date(), duration: elapsedTime, totalVolume, totalSets, totalReps: exercises.reduce((a, e) => a + e.sets.filter(s => s.isComplete).reduce((acc, s) => acc + s.reps, 0), 0), isComplete: true });
    }
    onComplete();
  };

  const handleSwap = async () => {
    if (!currentExercise) return;
    try {
      const all = await db.exercises.toArray();
      const current = all.find(e => e.name.toLowerCase() === currentExercise.exerciseName.toLowerCase());
      if (!current) return;
      const suggestions = all.filter(e => e.name !== currentExercise.exerciseName && e.primaryMuscles.some(m => current.primaryMuscles.includes(m))).slice(0, 10);
      setSwapSuggestions(suggestions); setShowSwap(true);
    } catch {}
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
          <button onClick={() => endWorkout()} className="btn-ghost"><X size={16} /> Cancel</button>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>{dayName || planName}</div>
          <button onClick={handleFinish} style={{ background: 'var(--accent-green)', border: 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 10, padding: '8px 16px' }}>Finish</button>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
          <motion.div style={{ height: '100%', background: 'var(--gradient-fire)', borderRadius: 2 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: 'var(--text-muted)' }}>{currentExerciseIndex + 1}/{exercises.length}</span>
          <span className="font-mono" style={{ color: 'var(--accent-red)', fontWeight: 700 }}>⏱ {formatTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Exercise queue */}
      <div className="chip-scroll" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        {exercises.map((ex, idx) => (
          <button key={idx} onClick={() => goToExercise(idx)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 10, border: idx === currentExerciseIndex ? '2px solid var(--accent-red)' : '1px solid var(--border)', background: ex.isComplete ? 'rgba(16,232,154,0.06)' : 'var(--bg-glass)', color: ex.isComplete ? 'var(--accent-green)' : idx === currentExerciseIndex ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {ex.isComplete ? '✓ ' : ''}{ex.exerciseName.split(' ').slice(0, 3).join(' ')}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* GIF display */}
        {exerciseGif && !hasImgError && (
          <div style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14, background: '#0a0a14', position: 'relative', border: '1px solid var(--border)' }}>
            <img src={exerciseGif} alt={currentExercise.exerciseName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setImgErrors(prev => new Set(prev).add(currentExerciseIndex))} />
            <a href={getYoutubeSearchUrl(currentExercise.exerciseName)} target="_blank" rel="noopener noreferrer"
              style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(255,0,0,0.85)', borderRadius: 10, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4, color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer' }}>
              <Play size={10} fill="white" /> YouTube <ExternalLink size={9} />
            </a>
          </div>
        )}

        {/* Title + controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <h2 className="font-display" style={{ fontSize: 19, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.02em' }}>{currentExercise.exerciseName}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Set {currentSetIndex >= 0 ? currentSetIndex + 1 : '✓'} of {currentExercise.sets.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowNotes(true)} title="Notes" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--accent-yellow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={14} /></button>
            <button onClick={handleSwap} title="Swap" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--accent-purple)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeftRight size={14} /></button>
            <button onClick={prevExercise} disabled={currentExerciseIndex === 0} style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === 0 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>
            <button onClick={nextExercise} disabled={currentExerciseIndex === exercises.length - 1} style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === exercises.length - 1 ? 0.3 : 1 }}><ChevronRight size={16} /></button>
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
              <div style={{ width: 28, height: 28, borderRadius: 7, background: set.isComplete ? 'var(--accent-green)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, color: set.isComplete ? 'white' : 'var(--text-muted)' }}>
                {set.isComplete ? <Check size={12} /> : setIdx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div className="section-label" style={{ marginBottom: 2 }}>{unitSystem === 'metric' ? 'KG' : 'LBS'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Math.max(0, set.weight - 2.5))} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={10} /></button>
                  <button className="set-input" onClick={() => openNumpad('weight', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 56 }}>{set.weight}</button>
                  <button onClick={() => updateSetWeight(currentExerciseIndex, setIdx, set.weight + 2.5)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={10} /></button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="section-label" style={{ marginBottom: 2 }}>REPS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => updateSetReps(currentExerciseIndex, setIdx, Math.max(0, set.reps - 1))} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={10} /></button>
                  <button className="set-input" onClick={() => openNumpad('reps', currentExerciseIndex, setIdx)} style={{ cursor: 'pointer', width: 48 }}>{set.reps || set.targetReps}</button>
                  <button onClick={() => updateSetReps(currentExerciseIndex, setIdx, (set.reps || set.targetReps) + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={10} /></button>
                </div>
              </div>
              {!set.isComplete && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCompleteSet(currentExerciseIndex, setIdx)} style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--gradient-fire)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px var(--glow-red)' }}><Check size={16} /></motion.button>
              )}
            </motion.div>
          ))}
        </div>

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
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining - 15)} style={{ padding: '10px 18px', borderRadius: 'var(--r-sm)' }}>-15s</button>
                <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={stopRestTimer} style={{ padding: '12px 32px', width: 'auto', borderRadius: 'var(--r-sm)' }}><SkipForward size={16} /> Skip</motion.button>
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining + 15)} style={{ padding: '10px 18px', borderRadius: 'var(--r-sm)' }}>+15s</button>
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
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Workout Notes</h3>
              <textarea value={notes[currentExerciseIndex] || ''} onChange={e => setNotes(prev => ({ ...prev, [currentExerciseIndex]: e.target.value }))} placeholder="Add notes for this exercise..." rows={4}
                style={{ width: '100%', padding: 14, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              <button onClick={() => setShowNotes(false)} className="btn-primary" style={{ marginTop: 12, borderRadius: 'var(--r-md)' }}>Done</button>
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
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Swap Exercise</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {swapSuggestions.map(ex => (
                  <button key={ex.id} onClick={() => setShowSwap(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)' }}>
                    {ex.gifUrl && <img src={ex.gifUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{ex.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ex.primaryMuscles.join(', ')}</div>
                    </div>
                  </button>
                ))}
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
                  {[1, 2.5, 5, 10, 20].map(inc => <button key={inc} className="btn-secondary" onClick={() => setNumpadValue(prev => (parseFloat(prev) + inc).toString())} style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8 }}>+{inc}</button>)}
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
