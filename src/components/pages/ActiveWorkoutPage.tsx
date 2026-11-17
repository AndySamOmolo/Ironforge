'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/db';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { Exercise } from '@/lib/types';
import { getSwapRecommendations, SwapRecommendation } from '@/lib/utils/swapEngine';
import { hasExerciseMedia } from '@/lib/utils/exerciseMedia';
import ExerciseMedia from '@/components/ui/ExerciseMedia';
import {
  Play, Pause, Check, Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  Clock, X, Volume2, VolumeX, StickyNote, Sparkles, Dumbbell, Eye, EyeOff, Sun,
  ChevronDown, Maximize2, ExternalLink,
} from 'lucide-react';

export default function ActiveWorkoutPage() {
  const {
    planId, dayId, planName, exercises, currentExerciseIndex, elapsedSeconds,
    isPaused, restTimerSeconds, restTimerActive, restTimerTarget,
    togglePause, tick, setCurrentExercise, completeSet, updateSetWeight,
    updateSetReps, addSet, removeSet, swapExercise, addExercise,
    startRestTimer, stopRestTimer, setExerciseNotes, finishWorkout, cancelWorkout,
    minimizeWorkout,
  } = useWorkoutStore();
  const { profile, setKeepScreenAwake } = useUserStore();

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapRecs, setSwapRecs] = useState<SwapRecommendation[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(profile.restTimerSound ?? true);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDemo, setShowDemo] = useState(true);
  const [showFullscreenMedia, setShowFullscreenMedia] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [activeMediaMode, setActiveMediaMode] = useState<'gif' | 'animated-images' | 'static-image' | 'none'>('none');
  const [currentExerciseData, setCurrentExerciseData] = useState<Exercise | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const currentEx = exercises[currentExerciseIndex];
  const weightStep = profile.defaultWeightIncrement || 2.5;

  // Screen Wake Lock API + Native Android Flag Keep Screen On bridge
  useEffect(() => {
    let mounted = true;
    const syncWakeLock = async () => {
      try {
        const w = window as unknown as { IronForgeNative?: { setKeepScreenOn?: (enabled: boolean) => void } };
        if (w.IronForgeNative?.setKeepScreenOn) {
          w.IronForgeNative.setKeepScreenOn(Boolean(profile.keepScreenAwake));
        }
      } catch {
        // Ignore bridge errors outside Android WebView
      }

      if (!profile.keepScreenAwake) {
        if (wakeLockRef.current) {
          try { await wakeLockRef.current.release(); } catch { /* ignore */ }
          wakeLockRef.current = null;
        }
        if (mounted) setWakeLockActive(false);
        return;
      }

      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          wakeLockRef.current = await nav.wakeLock.request('screen');
          if (mounted) setWakeLockActive(true);
        } else if (mounted) {
          setWakeLockActive(true);
        }
      } catch {
        if (mounted) setWakeLockActive(false);
      }
    };

    syncWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && profile.keepScreenAwake) {
        syncWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      try {
        const w = window as unknown as { IronForgeNative?: { setKeepScreenOn?: (enabled: boolean) => void } };
        w.IronForgeNative?.setKeepScreenOn?.(false);
      } catch {
        // ignore
      }
    };
  }, [profile.keepScreenAwake]);

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => { tick(); }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  // Beep + haptic when rest timer finishes
  useEffect(() => {
    if (restTimerSeconds === 0 && !restTimerActive && restTimerTarget > 0) {
      if (soundEnabled) {
        try {
          if (!audioRef.current) audioRef.current = new AudioContext();
          const ctx = audioRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.3;
          osc.start();
          setTimeout(() => { osc.stop(); }, 300);
        } catch { /* audio not available */ }
      }
      if ((profile.restTimerVibrate ?? true) && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  }, [restTimerSeconds, restTimerActive, restTimerTarget, soundEnabled, profile.restTimerVibrate]);

  // Load current exercise data from DB for GIF / instructions
  useEffect(() => {
    setMediaFailed(false);
    if (!currentEx) { setCurrentExerciseData(null); return; }
    (async () => {
      let found: Exercise | undefined;
      if (currentEx.exerciseId) {
        found = await db.exercises.get(currentEx.exerciseId);
      }
      if (!found) {
        const all = await db.exercises.toArray();
        const nameLower = currentEx.exerciseName.toLowerCase();
        found = all.find((e) => e.name.toLowerCase() === nameLower) ||
                all.find((e) => e.name.toLowerCase().includes(nameLower) || nameLower.includes(e.name.toLowerCase()));
      }
      setCurrentExerciseData(found || null);
    })();
  }, [currentEx, currentExerciseIndex]);

  // Open Swap Modal
  const handleOpenSwap = useCallback(async () => {
    if (!currentEx) return;
    const all = await db.exercises.toArray();
    setAllExercises(all);

    const target: Exercise = currentExerciseData || {
      id: currentEx.exerciseId,
      name: currentEx.exerciseName,
      primaryMuscles: currentEx.primaryMuscles as Exercise['primaryMuscles'],
      secondaryMuscles: [],
      equipment: (currentEx.equipment || 'barbell') as Exercise['equipment'],
      category: 'strength',
      instructions: [],
      tips: [],
      videoLinks: [],
      isCustom: false,
      isFavorite: false,
    };
    const workoutNames = exercises.map((e) => e.exerciseName);
    const recs = getSwapRecommendations(target, all, workoutNames);
    setSwapRecs(recs);
    setShowSwapModal(true);
  }, [currentEx, currentExerciseData, exercises]);

  const handleOpenAdd = async () => {
    const all = await db.exercises.toArray();
    setAllExercises(all);
    setShowAddExercise(true);
  };

  const handleSelectAddExercise = (ex: Exercise) => {
    addExercise({
      exerciseId: ex.id || 0,
      exerciseName: ex.name,
      primaryMuscles: ex.primaryMuscles,
      equipment: ex.equipment,
      gifUrl: ex.gifUrl,
      imageUrls: ex.imageUrls,
      sets: [
        { setNumber: 1, weight: 0, reps: 10, completed: false, type: 'normal', isPR: false },
        { setNumber: 2, weight: 0, reps: 10, completed: false, type: 'normal', isPR: false },
        { setNumber: 3, weight: 0, reps: 10, completed: false, type: 'normal', isPR: false },
      ],
      restTimer: profile.restTimerDefault,
      notes: '',
    });
    setShowAddExercise(false);
    setExerciseSearch('');
  };

  // Finish and save workout + detect PRs
  const handleFinishWorkout = async () => {
    let totalVol = 0;
    const newPRs: { exerciseName: string; weight: number; reps: number; e1rm: number }[] = [];

    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (s.completed && s.weight > 0 && s.reps > 0) {
          totalVol += s.weight * s.reps;
          const e1rm = Math.round(s.weight * (1 + s.reps / 30));
          const existingPRs = await db.personalRecords
            .where('exerciseName').equals(ex.exerciseName.toLowerCase()).toArray();
          const bestExisting = existingPRs.reduce((max, p) => Math.max(max, p.estimated1RM), 0);
          if (e1rm > bestExisting) {
            await db.personalRecords.add({
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName.toLowerCase(),
              weight: s.weight,
              reps: s.reps,
              estimated1RM: e1rm,
              achievedAt: new Date(),
            });
            newPRs.push({ exerciseName: ex.exerciseName, weight: s.weight, reps: s.reps, e1rm });
          }
        }
      }
    }

    await db.workoutSessions.add({
      planId: planId || 0,
      planName: planName.split(' — ')[0] || 'Quick Workout',
      dayId: dayId || 0,
      dayName: planName.split(' — ')[1] || planName,
      startTime: new Date(Date.now() - elapsedSeconds * 1000),
      endTime: new Date(),
      duration: elapsedSeconds,
      exercises: exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sets: e.sets,
        notes: e.notes,
      })),
      totalVolume: totalVol,
      notes: '',
      completed: true,
    });

    sessionStorage.setItem('lastWorkoutSummary', JSON.stringify({
      planName,
      duration: elapsedSeconds,
      totalVolume: totalVol,
      exerciseCount: exercises.length,
      setsCompleted: exercises.reduce((s, e) => s + e.sets.filter((st) => st.completed).length, 0),
      newPRs,
    }));

    finishWorkout();
    window.dispatchEvent(new CustomEvent('workout-completed'));
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSetsCompleted = exercises.reduce((s, e) => s + e.sets.filter((st) => st.completed).length, 0);
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const progressPct = totalSets > 0 ? (totalSetsCompleted / totalSets) * 100 : 0;

  const mediaCandidate = {
    gifUrl: currentEx?.gifUrl || currentExerciseData?.gifUrl,
    imageUrls: currentEx?.imageUrls?.length ? currentEx.imageUrls : currentExerciseData?.imageUrls,
    images: currentExerciseData?.images,
  };
  const canRenderMedia = hasExerciseMedia(mediaCandidate) && !mediaFailed && profile.exerciseMediaSize !== 'hidden';
  const mediaHeight = profile.exerciseMediaSize === 'compact' ? 140 : profile.exerciseMediaSize === 'large' ? 245 : 190;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Consolidated Safe-Area Top Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, padding: 'calc(max(env(safe-area-inset-top, 20px), 20px) + 6px) 14px 10px',
        background: 'rgba(9, 9, 15, 0.94)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border-glass)',
      }}>
        {/* Row 1: Minimize | Workout Name | Finish */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            onClick={minimizeWorkout}
            title="Minimize workout to browse Plans, Exercises, or Progress"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-full)', padding: '6px 11px', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
            }}
          >
            <ChevronDown size={14} /> Minimize
          </button>

          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 800, fontSize: '0.84rem', letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {planName}
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => setShowFinishConfirm(true)}
            style={{ padding: '7px 14px', fontSize: '0.75rem', flexShrink: 0 }}
          >
            Finish
          </button>
        </div>

        {/* Row 2: Exercise Counter | Awake Toggle | Elapsed Timer | End Session */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            Ex {Math.min(currentExerciseIndex + 1, Math.max(1, exercises.length))} of {exercises.length} • {totalSetsCompleted}/{totalSets} sets
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setKeepScreenAwake(!profile.keepScreenAwake)}
              title={profile.keepScreenAwake ? 'Screen wake lock active (tap to disable)' : 'Keep screen awake disabled (tap to enable)'}
              style={{
                background: profile.keepScreenAwake ? 'rgba(234, 179, 8, 0.14)' : 'rgba(255,255,255,0.04)',
                border: profile.keepScreenAwake ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '3px 8px',
                fontSize: '0.62rem',
                fontWeight: 700,
                color: profile.keepScreenAwake ? '#facc15' : 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Sun size={10} /> {profile.keepScreenAwake && wakeLockActive ? 'Awake' : 'Sleep OK'}
            </button>

            <button
              onClick={togglePause}
              style={{
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)',
                borderRadius: 'var(--radius-full)', padding: '3px 9px', cursor: 'pointer',
                color: 'var(--accent-secondary)', fontSize: '0.7rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
              aria-label={isPaused ? 'Resume workout timer' : 'Pause workout timer'}
            >
              <Clock size={11} />
              <span className="num">{formatTime(elapsedSeconds)}</span>
              {isPaused ? <Play size={10} /> : <Pause size={10} />}
            </button>

            <button
              onClick={() => setShowCancelConfirm(true)}
              title="Discard workout"
              style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-full)', padding: '3px 8px', color: 'var(--danger)',
                cursor: 'pointer', fontSize: '0.64rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3,
              }}
            >
              <X size={11} /> End
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: 'var(--accent-gradient)', borderRadius: 2,
            transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>
      </div>

      {/* Rest Timer Banner */}
      {restTimerActive && (
        <div className="animate-scale" style={{
          margin: '12px 16px 0', padding: '14px 16px', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.12))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Rest Timer
            </div>
            <div className="num" style={{ fontSize: '1.75rem', color: 'var(--text-primary)' }}>
              {formatTime(restTimerSeconds)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[60, 90, 120, 180].map((t) => (
              <button key={t} className={`chip ${restTimerTarget === t ? 'active' : ''}`}
                onClick={() => startRestTimer(t)} style={{ padding: '4px 8px', fontSize: '0.68rem' }}>
                {t}s
              </button>
            ))}
            <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button className="btn-secondary" onClick={stopRestTimer} style={{ padding: '5px 10px', fontSize: '0.72rem' }}>Skip</button>
          </div>
        </div>
      )}

      {/* Exercise Pill Navigation */}
      {exercises.length > 0 && (
        <div className="chip-scroll" style={{ padding: '12px 16px' }}>
          {exercises.map((ex, idx) => {
            const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
            return (
              <button
                key={idx}
                className={`chip ${idx === currentExerciseIndex ? 'active' : ''}`}
                onClick={() => setCurrentExercise(idx)}
                style={{
                  textTransform: 'capitalize',
                  borderColor: allDone ? 'var(--success)' : undefined,
                  color: allDone && idx !== currentExerciseIndex ? 'var(--success)' : undefined,
                }}
              >
                {allDone && '✓ '}{ex.exerciseName.length > 20 ? ex.exerciseName.slice(0, 18) + '…' : ex.exerciseName}
              </button>
            );
          })}
          <button className="chip" onClick={handleOpenAdd} style={{ color: 'var(--accent-primary)', borderColor: 'rgba(99,102,241,0.3)' }}>
            <Plus size={12} /> Add
          </button>
        </div>
      )}

      {/* Current Exercise Content */}
      {currentEx ? (
        <div style={{ padding: '0 16px' }}>
          {/* Exercise Header & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'capitalize', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {currentEx.exerciseName}
              </h2>
              <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                {currentEx.primaryMuscles.map((m) => (
                  <span key={m} className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{m}</span>
                ))}
                {currentEx.equipment && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {currentEx.equipment}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                className="btn-secondary"
                onClick={() => setShowDemo(!showDemo)}
                style={{ padding: '7px 10px', fontSize: '0.75rem' }}
                title="Toggle exercise demonstration"
              >
                {showDemo ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setNoteText(currentEx.notes); setShowNotes(true); }}
                style={{ padding: '7px 10px', fontSize: '0.75rem' }}
                title="Notes & Form Guide"
              >
                <StickyNote size={14} />
              </button>
              <button className="btn-secondary" onClick={handleOpenSwap} style={{ padding: '7px 11px', fontSize: '0.75rem' }}>
                <RefreshCw size={13} /> Swap
              </button>
            </div>
          </div>

          {/* Animated Exercise Demonstration Card (GIF primary, animated frames fallback, form tips fallback) */}
          {showDemo && (
            <div className="card" style={{
              marginBottom: 14, padding: 0, overflow: 'hidden',
              background: 'rgba(17, 17, 25, 0.7)', border: '1px solid var(--border-glass)',
            }}>
              {canRenderMedia ? (
                <div style={{
                  width: '100%', height: mediaHeight, position: 'relative',
                  background: 'radial-gradient(circle at center, rgba(248, 250, 252, 0.94), rgba(226, 232, 240, 0.9))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ExerciseMedia
                    gifUrl={mediaCandidate.gifUrl}
                    imageUrls={mediaCandidate.imageUrls}
                    images={mediaCandidate.images}
                    alt={currentEx.exerciseName}
                    loading="eager"
                    frameIntervalMs={700}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                    onMediaModeChange={setActiveMediaMode}
                    onExhausted={() => setMediaFailed(true)}
                  />
                  {/* Expand to Fullscreen Button */}
                  <button
                    onClick={() => setShowFullscreenMedia(true)}
                    title="Expand exercise demonstration"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: '5px 8px', borderRadius: 'var(--radius-full)',
                      background: 'rgba(15, 23, 42, 0.82)', color: '#e2e8f0',
                      border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <Maximize2 size={11} /> Expand
                  </button>
                  <span style={{
                    position: 'absolute', bottom: 8, right: 8,
                    padding: '3px 8px', borderRadius: 'var(--radius-full)',
                    background: 'rgba(15, 23, 42, 0.84)', fontSize: '0.62rem',
                    color: 'var(--accent-secondary)', fontWeight: 700,
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                  }}>
                    {activeMediaMode === 'gif'
                      ? 'ANIMATED GIF'
                      : activeMediaMode === 'animated-images'
                      ? 'ANIMATED FRAMES'
                      : 'FORM PREVIEW'}
                  </span>
                </div>
              ) : (
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Dumbbell size={18} color="var(--accent-primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Quick Form Guide
                      </span>
                      <span className="badge" style={{ fontSize: '0.56rem', padding: '1px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-tertiary)' }}>
                        FORM GUIDE
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                      {currentExerciseData?.instructions?.[0] || 'Control the eccentric phase, brace your core, and move through a full pain-free range of motion.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Set Table Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '34px 1fr 1fr 78px',
            gap: 8, padding: '6px 10px', color: 'var(--text-tertiary)', fontSize: '0.66rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <span>Set</span>
            <span style={{ textAlign: 'center' }}>{profile.weightUnit.toUpperCase()}</span>
            <span style={{ textAlign: 'center' }}>Reps</span>
            <span style={{ textAlign: 'right' }}>Status</span>
          </div>

          {/* Sets Rows — Distinct Outlined "Done" Pill vs Completed Green Pill (No accidental adjacent delete X) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
            {currentEx.sets.map((s, sIdx) => (
              <div
                key={sIdx}
                className="card"
                style={{
                  padding: profile.setRowStyle === 'compact' ? '6px 10px' : profile.setRowStyle === 'tall' ? '14px 12px' : '10px 10px',
                  display: 'grid',
                  gridTemplateColumns: '34px 1fr 1fr 78px',
                  gap: 8,
                  alignItems: 'center',
                  background: s.completed ? 'rgba(16, 185, 129, 0.08)' : undefined,
                  borderColor: s.completed ? 'rgba(16, 185, 129, 0.28)' : undefined,
                }}
              >
                <span className="num" style={{
                  fontWeight: 700, fontSize: '0.8rem',
                  color: s.completed ? 'var(--success)' : 'var(--text-tertiary)',
                  textAlign: 'center',
                }}>
                  {s.setNumber}
                </span>

                {/* Weight Input with +/- steppers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    onClick={() => updateSetWeight(currentExerciseIndex, sIdx, Math.max(0, s.weight - weightStep))}
                    style={{
                      width: 26, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    }}
                  >−</button>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    style={{ textAlign: 'center', padding: '6px 2px', fontSize: '0.85rem', fontWeight: 700, minWidth: 0 }}
                    value={s.weight || ''}
                    placeholder="0"
                    onChange={(e) => updateSetWeight(currentExerciseIndex, sIdx, Number(e.target.value))}
                  />
                  <button
                    onClick={() => updateSetWeight(currentExerciseIndex, sIdx, s.weight + weightStep)}
                    style={{
                      width: 26, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    }}
                  >+</button>
                </div>

                {/* Reps Input with +/- steppers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    onClick={() => updateSetReps(currentExerciseIndex, sIdx, Math.max(0, s.reps - 1))}
                    style={{
                      width: 26, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    }}
                  >−</button>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    style={{ textAlign: 'center', padding: '6px 2px', fontSize: '0.85rem', fontWeight: 700, minWidth: 0 }}
                    value={s.reps || ''}
                    placeholder="0"
                    onChange={(e) => updateSetReps(currentExerciseIndex, sIdx, Number(e.target.value))}
                  />
                  <button
                    onClick={() => updateSetReps(currentExerciseIndex, sIdx, s.reps + 1)}
                    style={{
                      width: 26, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    }}
                  >+</button>
                </div>

                {/* Clear Complete Set Action Pill (Unchecked = Outlined Circle + "Done", Checked = Solid Green + "✓ Done") */}
                <button
                  onClick={() => {
                    const wasCompleted = s.completed;
                    completeSet(currentExerciseIndex, sIdx);
                    if (!wasCompleted && (profile.autoRestTimer ?? true)) {
                      startRestTimer(currentEx.restTimer || profile.restTimerDefault);
                    }
                  }}
                  style={{
                    height: 34,
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: s.completed ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--border-glass)',
                    background: s.completed ? 'var(--success)' : 'rgba(255,255,255,0.04)',
                    color: s.completed ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                  }}
                  aria-label={s.completed ? `Mark set ${s.setNumber} incomplete` : `Complete set ${s.setNumber}`}
                >
                  {s.completed ? (
                    <>
                      <Check size={13} strokeWidth={2.6} /> Done
                    </>
                  ) : (
                    <>
                      <span style={{
                        width: 11, height: 11, borderRadius: '50%',
                        border: '1.5px solid var(--text-tertiary)', display: 'inline-block',
                      }} />
                      Done
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Add / Remove Set Row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className="btn-secondary" onClick={() => addSet(currentExerciseIndex)} style={{ flex: 1, padding: 10, fontSize: '0.8rem' }}>
              <Plus size={14} /> Add Set
            </button>
            {currentEx.sets.length > 1 && (
              <button
                className="btn-secondary"
                onClick={() => removeSet(currentExerciseIndex, currentEx.sets.length - 1)}
                style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--danger)' }}
                title="Remove last set"
              >
                <Trash2 size={14} /> Remove Set
              </button>
            )}
          </div>

          {/* Prev / Next Exercise Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button
              className="btn-secondary"
              disabled={currentExerciseIndex === 0}
              onClick={() => setCurrentExercise(currentExerciseIndex - 1)}
              style={{ flex: 1, opacity: currentExerciseIndex === 0 ? 0.3 : 1 }}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="btn-primary"
              disabled={currentExerciseIndex >= exercises.length - 1}
              onClick={() => setCurrentExercise(currentExerciseIndex + 1)}
              style={{ flex: 1, opacity: currentExerciseIndex >= exercises.length - 1 ? 0.3 : 1 }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <p style={{ marginBottom: 16 }}>No exercises in this session yet.</p>
          <button className="btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add Exercise
          </button>
        </div>
      )}

      {/* Fullscreen Demonstration Lightbox Modal */}
      {showFullscreenMedia && currentEx && canRenderMedia && (
        <div className="modal-overlay" onClick={() => setShowFullscreenMedia(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'capitalize' }}>{currentEx.exerciseName}</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                  {currentEx.primaryMuscles.join(', ')} • {currentEx.equipment}
                </span>
              </div>
              <button onClick={() => setShowFullscreenMedia(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{
              width: '100%', height: 320, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              background: 'radial-gradient(circle at center, rgba(248, 250, 252, 0.96), rgba(226, 232, 240, 0.92))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-glass)', marginBottom: 12,
            }}>
              <ExerciseMedia
                gifUrl={mediaCandidate.gifUrl}
                imageUrls={mediaCandidate.imageUrls}
                images={mediaCandidate.images}
                alt={currentEx.exerciseName}
                loading="eager"
                frameIntervalMs={650}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }}
              />
            </div>
            {currentExerciseData?.instructions && currentExerciseData.instructions.length > 0 && (
              <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {currentExerciseData.instructions.slice(0, 4).map((step, idx) => (
                  <li key={idx} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* Smart Swap Modal (Displays % Match instead of raw score integers) */}
      {showSwapModal && (
        <div className="modal-overlay" onClick={() => setShowSwapModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="var(--accent-primary)" /> Smart Swap
              </h2>
              <button onClick={() => setShowSwapModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: 14 }}>
              Ranked by biomechanics, primary muscle overlap & equipment
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {swapRecs.map((rec, i) => {
                const matchPct = Math.min(99, Math.max(72, Math.round(rec.matchScore / 1.95)));
                return (
                  <div
                    key={i}
                    className="card"
                    style={{ cursor: 'pointer', padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}
                    onClick={() => {
                      swapExercise(currentExerciseIndex, {
                        exerciseId: rec.exercise.id || 0,
                        exerciseName: rec.exercise.name,
                        primaryMuscles: rec.exercise.primaryMuscles,
                        equipment: rec.exercise.equipment,
                        gifUrl: rec.exercise.gifUrl,
                        imageUrls: rec.exercise.imageUrls,
                        sets: currentEx.sets.map((s) => ({ ...s, completed: false })),
                        restTimer: currentEx.restTimer,
                        notes: '',
                      });
                      setShowSwapModal(false);
                    }}
                  >
                    {hasExerciseMedia(rec.exercise) && (
                      <div style={{
                        width: 52, height: 52, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                        background: 'rgba(248, 250, 252, 0.92)', flexShrink: 0,
                      }}>
                        <ExerciseMedia
                          gifUrl={rec.exercise.gifUrl}
                          imageUrls={rec.exercise.imageUrls}
                          images={rec.exercise.images}
                          alt={rec.exercise.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.exercise.name}
                        </span>
                        <span className="badge badge-accent" style={{ flexShrink: 0 }}>{matchPct}% Match</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {rec.reasons.map((r, j) => (
                          <span key={j} style={{
                            fontSize: '0.62rem', padding: '2px 7px', borderRadius: 'var(--radius-full)',
                            background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                            textTransform: 'capitalize',
                          }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Add Exercise</h2>
              <button onClick={() => setShowAddExercise(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <input className="input" style={{ marginBottom: 12 }} placeholder="Search exercises..." value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} />
            <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allExercises
                .filter((e) => !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
                  e.primaryMuscles.some((m) => m.toLowerCase().includes(exerciseSearch.toLowerCase())))
                .slice(0, 30)
                .map((ex) => (
                  <div key={ex.id} onClick={() => handleSelectAddExercise(ex)}
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {hasExerciseMedia(ex) && (
                        <div style={{ width: 38, height: 38, borderRadius: 6, overflow: 'hidden', background: 'rgba(248,250,252,0.92)', flexShrink: 0 }}>
                          <ExerciseMedia
                            gifUrl={ex.gifUrl}
                            imageUrls={ex.imageUrls}
                            images={ex.images}
                            alt={ex.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                          {ex.primaryMuscles.join(', ')} • {ex.equipment}
                        </div>
                      </div>
                    </div>
                    <Plus size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Notes & Full Form Instructions Modal (Single unified scroll container, no nested scroll-in-scroll trap) */}
      {showNotes && currentEx && (
        <div className="modal-overlay" onClick={() => setShowNotes(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, textTransform: 'capitalize' }}>{currentEx.exerciseName}</h2>
              <button onClick={() => setShowNotes(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {currentExerciseData && currentExerciseData.instructions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>How to Perform</h4>
                <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {currentExerciseData.instructions.map((step, idx) => (
                    <li key={idx} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Video tutorials */}
            {currentExerciseData && currentExerciseData.videoLinks && currentExerciseData.videoLinks.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Video Guides</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {currentExerciseData.videoLinks.map((v, idx) => (
                    <a
                      key={idx}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chip"
                      style={{ textDecoration: 'none', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      ▶ {v.creator} <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <h4 style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Session Notes</h4>
            <textarea
              className="input"
              rows={3}
              placeholder="Add notes for this exercise (grip width, seat setting, RPE)..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{ resize: 'vertical', marginBottom: 12 }}
            />
            <button className="btn-primary" onClick={() => { setExerciseNotes(currentExerciseIndex, noteText); setShowNotes(false); }} style={{ width: '100%' }}>
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Finish Confirm Modal */}
      {showFinishConfirm && (
        <div className="modal-overlay" onClick={() => setShowFinishConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Finish Workout?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20 }}>
              {totalSetsCompleted} of {totalSets} sets completed ({formatTime(elapsedSeconds)})
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setShowFinishConfirm(false)} style={{ flex: 1 }}>Continue</button>
              <button className="btn-primary" onClick={handleFinishWorkout} style={{ flex: 1 }}>
                <Check size={16} /> Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>End or Minimize Workout?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 18 }}>
              You can minimize this workout to keep your timer and sets active while browsing the app, or discard it completely.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn-primary"
                onClick={() => { setShowCancelConfirm(false); minimizeWorkout(); }}
                style={{ width: '100%', padding: 12 }}
              >
                <ChevronDown size={16} /> Minimize & Keep Progress
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setShowCancelConfirm(false)} style={{ flex: 1 }}>Resume</button>
                <button className="btn-danger" onClick={cancelWorkout} style={{ flex: 1 }}>Discard Session</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
