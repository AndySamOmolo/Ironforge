'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Plus, Minus, SkipForward, ChevronLeft, ChevronRight, ChevronDown, Dumbbell,
  ArrowLeftRight, ExternalLink, StickyNote, Play, Pause, AlertTriangle,
  BookOpen, Trash2, Search, TrendingUp, Minimize2, Maximize2, Sun, Timer, RotateCcw,
} from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { db } from '@/lib/db/schema';
import { MUSCLE_COLORS, SetType } from '@/lib/types';
import type { Exercise } from '@/lib/types';
import { getSwapSuggestions } from '@/lib/utils/swapEngine';
import { calculatePlates, getPlateColor } from '@/lib/utils/plateCalculator';
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

interface ActiveWorkoutPageProps { onComplete: () => void; }

const SET_TYPE_BADGE: Record<string, { label: string; color: string; bg: string; title: string }> = {
  [SetType.Normal]: { label: '', color: 'var(--text-muted)', bg: 'var(--bg-elevated)', title: 'Normal Set (tap to cycle type)' },
  [SetType.Warmup]: { label: 'W', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', title: 'Warmup Set' },
  [SetType.DropSet]: { label: 'D', color: '#A855F7', bg: 'rgba(168,85,247,0.16)', title: 'Drop Set' },
  [SetType.Failure]: { label: 'F', color: '#FF3D5A', bg: 'rgba(255,61,90,0.16)', title: 'To Failure' },
  [SetType.AMRAP]: { label: 'A', color: '#22D3EE', bg: 'rgba(34,211,238,0.16)', title: 'AMRAP Set' },
};

// Shared singleton AudioContext so WebViews never hit hardware context limits
let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function formatWorkoutSeconds(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Isolated leaf subscriber for the header stopwatch so 1Hz ticks never re-render ActiveWorkoutPage.
 */
function WorkoutHeaderStopwatch() {
  const elapsedTime = useWorkoutStore(s => s.elapsedTime);
  const isPaused = useWorkoutStore(s => s.isPaused);
  const togglePause = useWorkoutStore(s => s.togglePause);
  const resetElapsedTime = useWorkoutStore(s => s.resetElapsedTime);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="font-mono" style={{
        color: isPaused ? 'var(--accent-yellow)' : 'var(--accent-red)',
        fontWeight: 800, fontSize: 13,
      }}>
        ⏱ {formatWorkoutSeconds(elapsedTime)}
      </span>
      <button
        onClick={togglePause}
        aria-label={isPaused ? 'Start workout timer' : 'Pause workout timer'}
        style={{
          minHeight: 30, padding: '4px 10px', borderRadius: 8,
          background: isPaused ? 'rgba(16,232,154,0.16)' : 'rgba(255,61,90,0.10)',
          border: `1px solid ${isPaused ? 'rgba(16,232,154,0.38)' : 'rgba(255,61,90,0.24)'}`,
          color: isPaused ? 'var(--accent-green)' : 'var(--accent-red)',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em',
        }}
      >
        {isPaused ? <Play size={11} fill="currentColor" /> : <Pause size={11} />}
        <span>{isPaused ? 'Start Timer' : 'Pause'}</span>
      </button>
      {elapsedTime > 0 && (
        <button
          onClick={resetElapsedTime}
          aria-label="Reset workout stopwatch"
          title="Reset stopwatch to 00:00"
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RotateCcw size={11} />
        </button>
      )}
    </div>
  );
}

/**
 * Isolated leaf subscriber for the footer elapsed time counter.
 */
function WorkoutFooterElapsedStat() {
  const elapsedTime = useWorkoutStore(s => s.elapsedTime);
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="font-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-orange)' }}>
        {formatWorkoutSeconds(elapsedTime)}
      </div>
      <div className="section-label" style={{ fontSize: 9 }}>Time</div>
    </div>
  );
}

/**
 * Isolated leaf subscriber for the Rest Timer (both Fullscreen Overlay and Minimized Floating Bar).
 */
/**
 * Always-accessible Rest & Interval Timer Control Bar with an explicit "Start Timer" button,
 * preset duration chips (30s, 60s, 90s, 120s, 180s), and live Pause / Resume / Reset controls.
 */
function WorkoutRestTimerBar({ defaultSeconds }: { defaultSeconds: number }) {
  const restTimerActive = useWorkoutStore(s => s.restTimerActive);
  const restTimerPaused = useWorkoutStore(s => s.restTimerPaused);
  const restTimeRemaining = useWorkoutStore(s => s.restTimeRemaining);
  const restTimeDuration = useWorkoutStore(s => s.restTimeDuration);
  const startRestTimer = useWorkoutStore(s => s.startRestTimer);
  const toggleRestPause = useWorkoutStore(s => s.toggleRestPause);
  const resetRestTimer = useWorkoutStore(s => s.resetRestTimer);
  const stopRestTimer = useWorkoutStore(s => s.stopRestTimer);

  const [presetSeconds, setPresetSeconds] = useState<number>(defaultSeconds || 90);

  useEffect(() => {
    if (defaultSeconds && defaultSeconds > 0) {
      setPresetSeconds(defaultSeconds);
    }
  }, [defaultSeconds]);

  const pct = restTimerActive && restTimeDuration > 0
    ? Math.max(0, Math.min(100, ((restTimeDuration - restTimeRemaining) / restTimeDuration) * 100))
    : 0;

  return (
    <div className="card" style={{ padding: '12px 14px', border: restTimerActive ? '1px solid rgba(16,232,154,0.38)' : '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: restTimerActive ? 'rgba(16,232,154,0.14)' : 'rgba(139,92,246,0.12)',
            color: restTimerActive ? 'var(--accent-green)' : 'var(--accent-purple)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Timer size={16} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
              {restTimerActive
                ? restTimerPaused
                  ? `Rest Timer Paused (${formatWorkoutSeconds(restTimeRemaining)})`
                  : `Resting • ${formatWorkoutSeconds(restTimeRemaining)} left`
                : 'Rest & Interval Timer'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {restTimerActive ? `Target: ${restTimeDuration}s countdown` : 'Pick duration and tap Start Timer anytime'}
            </div>
          </div>
        </div>

        {!restTimerActive ? (
          <button
            onClick={() => startRestTimer(presetSeconds)}
            className="btn-primary"
            style={{ width: 'auto', minHeight: 38, padding: '8px 16px', fontSize: 12, borderRadius: 10, flexShrink: 0 }}
          >
            <Play size={13} fill="currentColor" /> Start Timer ({presetSeconds}s)
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={toggleRestPause}
              className={restTimerPaused ? 'btn-primary' : 'btn-secondary'}
              style={{ width: 'auto', minHeight: 34, padding: '6px 12px', fontSize: 11, borderRadius: 9 }}
            >
              {restTimerPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
              <span>{restTimerPaused ? 'Start' : 'Pause'}</span>
            </button>
            <button
              onClick={resetRestTimer}
              className="btn-secondary"
              style={{ minHeight: 34, padding: '6px 10px', fontSize: 11, borderRadius: 9 }}
              title="Reset countdown"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              onClick={stopRestTimer}
              className="btn-cancel"
              style={{ minHeight: 34, padding: '6px 10px', fontSize: 11, borderRadius: 9 }}
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {restTimerActive && (
        <div className="progress-bar" style={{ height: 6, marginBottom: 10 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${100 - pct}%`,
              background: restTimeRemaining > 10 ? 'var(--gradient-mint)' : 'var(--gradient-fire)',
              transition: 'width 0.9s linear',
            }}
          />
        </div>
      )}

      {/* Duration Preset Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {[30, 60, 90, 120, 180].map(sec => {
          const isSel = (restTimerActive ? restTimeDuration : presetSeconds) === sec;
          return (
            <button
              key={sec}
              onClick={() => {
                setPresetSeconds(sec);
                if (restTimerActive) startRestTimer(sec);
              }}
              className={`filter-chip ${isSel ? 'active' : ''}`}
              style={{ padding: '5px 11px', fontSize: 11, minHeight: 30, flex: '1 1 auto' }}
            >
              {sec < 60 ? `${sec}s` : `${sec / 60}m (${sec}s)`}
            </button>
          );
        })}
        <button
          onClick={() => {
            const next = Math.max(15, (restTimerActive ? restTimeRemaining : presetSeconds) + 15);
            setPresetSeconds(next);
            if (restTimerActive) startRestTimer(next);
          }}
          className="btn-secondary"
          style={{ padding: '5px 10px', fontSize: 11, minHeight: 30, borderRadius: 999 }}
        >
          +15s
        </button>
      </div>
    </div>
  );
}

/**
 * Isolated leaf subscriber for the Rest Timer (both Fullscreen Overlay and Minimized Floating Bar).
 */
function RestTimerLeaf({
  exerciseName,
  restMinimized,
  setRestMinimized,
  playFeedbackTone,
  triggerHaptic,
  countdownSound,
}: {
  exerciseName: string;
  restMinimized: boolean;
  setRestMinimized: (val: boolean) => void;
  playFeedbackTone: (mode: 'set' | 'finish' | 'rest' | 'tick' | 'pr') => void;
  triggerHaptic: (mode?: 'light' | 'success') => void;
  countdownSound: boolean;
}) {
  const restTimerActive = useWorkoutStore(s => s.restTimerActive);
  const restTimerPaused = useWorkoutStore(s => s.restTimerPaused);
  const restTimeRemaining = useWorkoutStore(s => s.restTimeRemaining);
  const restTimeDuration = useWorkoutStore(s => s.restTimeDuration);
  const startRestTimer = useWorkoutStore(s => s.startRestTimer);
  const toggleRestPause = useWorkoutStore(s => s.toggleRestPause);
  const resetRestTimer = useWorkoutStore(s => s.resetRestTimer);
  const stopRestTimer = useWorkoutStore(s => s.stopRestTimer);
  const prevRemainingRef = useRef(restTimeRemaining);

  useEffect(() => {
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = restTimeRemaining;

    if (prev > 0 && restTimeRemaining === 0) {
      playFeedbackTone('rest');
      triggerHaptic('success');
    } else if (restTimerActive && !restTimerPaused && countdownSound && restTimeRemaining > 0 && restTimeRemaining <= 3) {
      playFeedbackTone('tick');
    }
  }, [restTimeRemaining, restTimerActive, restTimerPaused, countdownSound, playFeedbackTone, triggerHaptic]);

  return (
    <>
      <AnimatePresence>
        {restTimerActive && restMinimized && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: 'fixed', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))',
              maxWidth: 520, margin: '0 auto',
              zIndex: 120, background: 'var(--bg-overlay)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16,232,154,0.38)', borderRadius: 16, padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            }}
          >
            <div
              onClick={() => setRestMinimized(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}
            >
              <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: restTimerPaused ? 'var(--accent-yellow)' : restTimeRemaining > 10 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {restTimeRemaining}s
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>
                  {restTimerPaused ? 'Rest Paused • Tap to expand' : 'Resting • Tap to expand'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                  {exerciseName}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={toggleRestPause}
                className={restTimerPaused ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 10px', fontSize: 11, minHeight: 34, borderRadius: 8, width: 'auto' }}
              >
                {restTimerPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
                <span>{restTimerPaused ? 'Start' : 'Pause'}</span>
              </button>
              <button onClick={() => startRestTimer(restTimeRemaining + 15)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11, minHeight: 34, borderRadius: 8 }}>+15s</button>
              <button onClick={stopRestTimer} className="btn-cancel" style={{ padding: '6px 10px', fontSize: 11, minHeight: 34, borderRadius: 8 }}>Skip</button>
              <button onClick={() => setRestMinimized(false)} className="btn-ghost" style={{ padding: 6, minHeight: 34 }} title="Expand timer"><Maximize2 size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {restTimerActive && !restMinimized && (
          <motion.div className="rest-timer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ textAlign: 'center', width: '100%', maxWidth: 380, padding: '0 20px' }}>
              <div className="section-label" style={{ fontSize: 14, marginBottom: 4 }}>
                {restTimerPaused ? 'REST TIMER (PAUSED)' : 'REST TIMER'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, textTransform: 'capitalize', fontWeight: 600 }}>{exerciseName}</div>
              <div className="progress-ring-container" style={{ width: 200, height: 200, margin: '0 auto' }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
                  <circle
                    cx="100"
                    cy="100"
                    r="88"
                    fill="none"
                    stroke={restTimerPaused ? 'var(--accent-yellow)' : restTimeRemaining > 10 ? 'var(--accent-green)' : restTimeRemaining > 5 ? 'var(--accent-yellow)' : 'var(--accent-red)'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 88}
                    strokeDashoffset={2 * Math.PI * 88 * (1 - restTimeRemaining / Math.max(1, restTimeDuration))}
                    transform="rotate(-90 100 100)"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
                  />
                </svg>
                <div className="progress-ring-text">
                  <div className="font-mono" style={{ fontSize: 52, fontWeight: 800 }}>{restTimeRemaining}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{restTimerPaused ? 'paused' : 'seconds'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={() => startRestTimer(Math.max(5, restTimeRemaining - 15))} style={{ padding: '12px 16px', borderRadius: 14, minHeight: 48 }}>-15s</button>
                <button
                  className={restTimerPaused ? 'btn-primary' : 'btn-secondary'}
                  onClick={toggleRestPause}
                  style={{ padding: '12px 22px', width: 'auto', borderRadius: 14, minHeight: 48 }}
                >
                  {restTimerPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} />}
                  <span>{restTimerPaused ? 'Start Timer' : 'Pause'}</span>
                </button>
                <button className="btn-secondary" onClick={resetRestTimer} style={{ padding: '12px 16px', borderRadius: 14, minHeight: 48 }} title="Reset timer">
                  <RotateCcw size={16} />
                </button>
                <button className="btn-secondary" onClick={() => startRestTimer(restTimeRemaining + 15)} style={{ padding: '12px 16px', borderRadius: 14, minHeight: 48 }}>+15s</button>
              </div>
              <div style={{ marginTop: 12 }}>
                <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" onClick={stopRestTimer} style={{ padding: '12px 32px', width: 'auto', borderRadius: 14, minHeight: 46 }}>
                  <SkipForward size={16} /> Skip Rest
                </motion.button>
              </div>
              <button
                onClick={() => setRestMinimized(true)}
                className="btn-ghost"
                style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}
              >
                <Minimize2 size={14} /> Minimize to View Exercise Demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function ActiveWorkoutPage({ onComplete }: ActiveWorkoutPageProps) {
  // Atomic Zustand selectors (no elapsedTime or restTimeRemaining subscription in parent!)
  const exercises = useWorkoutStore(s => s.exercises);
  const currentExerciseIndex = useWorkoutStore(s => s.currentExerciseIndex);
  const totalVolume = useWorkoutStore(s => s.totalVolume);
  const totalSets = useWorkoutStore(s => s.totalSets);
  const planName = useWorkoutStore(s => s.planName);
  const dayName = useWorkoutStore(s => s.dayName);
  const sessionId = useWorkoutStore(s => s.sessionId);

  const completeSet = useWorkoutStore(s => s.completeSet);
  const uncompleteSet = useWorkoutStore(s => s.uncompleteSet);
  const updateSetWeight = useWorkoutStore(s => s.updateSetWeight);
  const updateSetReps = useWorkoutStore(s => s.updateSetReps);
  const cycleSetType = useWorkoutStore(s => s.cycleSetType);
  const addSet = useWorkoutStore(s => s.addSet);
  const removeSet = useWorkoutStore(s => s.removeSet);
  const goToExercise = useWorkoutStore(s => s.goToExercise);
  const nextExercise = useWorkoutStore(s => s.nextExercise);
  const prevExercise = useWorkoutStore(s => s.prevExercise);
  const addExercise = useWorkoutStore(s => s.addExercise);
  const removeExercise = useWorkoutStore(s => s.removeExercise);
  const startRestTimer = useWorkoutStore(s => s.startRestTimer);
  const endWorkout = useWorkoutStore(s => s.endWorkout);
  const setMinimized = useWorkoutStore(s => s.setMinimized);
  const addPR = useWorkoutStore(s => s.addPR);
  const setSessionId = useWorkoutStore(s => s.setSessionId);
  const completeWorkoutSession = useWorkoutStore(s => s.completeWorkoutSession);

  const defaultRestTime = useUserStore(s => s.defaultRestTime);
  const unitSystem = useUserStore(s => s.unitSystem);
  const soundEnabled = useUserStore(s => s.soundEnabled);
  const hapticEnabled = useUserStore(s => s.hapticEnabled);
  const barWeight = useUserStore(s => s.barWeight);
  const dumbbellWeight = useUserStore(s => s.dumbbellWeight);
  const userEquipment = useUserStore(s => s.equipment);
  const weightIncrement = useUserStore(s => s.weightIncrement);
  const autoAdvance = useUserStore(s => s.autoAdvance);
  const autoStartRest = useUserStore(s => s.autoStartRest);
  const restTimerEnabled = useUserStore(s => s.restTimerEnabled);
  const keepScreenOn = useUserStore(s => s.keepScreenOn);
  const showTimer = useUserStore(s => s.showTimer);
  const countdownSound = useUserStore(s => s.countdownSound);

  const [showNumpad, setShowNumpad] = useState<{ field: 'weight' | 'reps'; exerciseIdx: number; setIdx: number } | null>(null);
  const [numpadValue, setNumpadValue] = useState('0');
  const [numpadFresh, setNumpadFresh] = useState(true);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [activeMediaMode, setActiveMediaMode] = useState<'gif' | 'animated-images' | 'static-image' | 'none'>('gif');
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<{ exercise: Exercise; score: number; matchTags: string[]; category: string }[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [allCatalog, setAllCatalog] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showPlates, setShowPlates] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [confirmRemoveEx, setConfirmRemoveEx] = useState(false);
  const [restMinimized, setRestMinimized] = useState(false);
  const [screenAwakeLocked, setScreenAwakeLocked] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [exerciseInfo, setExerciseInfo] = useState<Exercise | null>(null);
  const [historicalBest1RM, setHistoricalBest1RM] = useState<number>(0);
  const [lastBestSet, setLastBestSet] = useState<{ weight: number; reps: number } | null>(null);
  const [overloadTip, setOverloadTip] = useState<ProgressionSuggestion | null>(null);
  const isFinishingRef = useRef(false);

  const stepWeight = weightIncrement && weightIncrement > 0 ? weightIncrement : 2.5;
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

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
    setConfirmRemoveEx(false);
    const loadExerciseInfoAndHistory = async () => {
      if (!currentExercise) return;
      try {
        let ex = currentExercise.exerciseId ? await db.exercises.get(currentExercise.exerciseId) : undefined;
        if (!ex) {
          ex = await db.exercises.where('name').equalsIgnoreCase(currentExercise.exerciseName).first();
        }
        if (cancelled) return;
        setExerciseInfo(ex || null);

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

  const triggerHaptic = useCallback((mode: 'light' | 'success' = 'light') => {
    if (!hapticEnabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (mode === 'success') {
      navigator.vibrate([20, 30, 20]);
      return;
    }
    navigator.vibrate(14);
  }, [hapticEnabled]);

  const playFeedbackTone = useCallback((mode: 'set' | 'finish' | 'rest' | 'tick' | 'pr') => {
    if (!soundEnabled) return;
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    try {
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

  const handleCompleteSet = useCallback(async (exerciseIdx: number, setIdx: number) => {
    const exercise = exercises[exerciseIdx];
    const set = exercise.sets[setIdx];
    if (set.isComplete) {
      uncompleteSet(exerciseIdx, setIdx);
      triggerHaptic('light');
      return;
    }

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
      setTimeout(() => nextExercise(), 550);
    }
  }, [exercises, completeSet, uncompleteSet, startRestTimer, defaultRestTime, currentExerciseIndex, nextExercise, playFeedbackTone, triggerHaptic, autoStartRest, restTimerEnabled, autoAdvance, historicalBest1RM, addPR]);

  const handleFinish = async () => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    setIsFinishing(true);

    try {
      playFeedbackTone('finish');
      triggerHaptic('success');

      const liveState = useWorkoutStore.getState();
      const currentElapsedTime = liveState.elapsedTime;

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
      const startedAt = new Date(now.getTime() - currentElapsedTime * 1000);
      const computedTotalReps = completedSetEntries.reduce((sum, set) => sum + set.reps, 0);
      const computedTotalSets = completedSetEntries.length;

      const combinedNotes = Object.entries(notes)
        .filter(([, text]) => text && text.trim().length > 0)
        .map(([idx, text]) => `${exercises[Number(idx)]?.exerciseName || 'Exercise'}: ${text.trim()}`)
        .join(' | ');

      const currentSessionId = liveState.sessionId || sessionId;

      const savedSessionId = currentSessionId
        ? currentSessionId
        : await db.workoutSessions.add({
            planName,
            dayName,
            startedAt,
            completedAt: now,
            duration: currentElapsedTime,
            totalVolume,
            totalSets: computedTotalSets,
            totalReps: computedTotalReps,
            notes: combinedNotes || undefined,
            isComplete: true,
          });

      setSessionId(savedSessionId);

      if (currentSessionId) {
        await db.workoutSessions.update(savedSessionId, {
          completedAt: now,
          duration: currentElapsedTime,
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

      // Persist sessionExercises records and map their IDs to sets
      const sessionExIdByOrder = new Map<number, number>();
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        if (!ex.sets.some(s => s.isComplete)) continue;
        const seId = await db.sessionExercises.add({
          sessionId: savedSessionId,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          wasSwapped: false,
          orderIndex: i,
          notes: notes[i]?.trim() || undefined,
        });
        sessionExIdByOrder.set(i, seId);
      }

      if (completedSetEntries.length > 0) {
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
            addPR(candidate.exerciseName, candidate.weight, candidate.reps);
          }
        }
      }

      completeWorkoutSession(savedSessionId);
      onComplete();
    } catch (err) {
      console.error('Failed to finish workout:', err);
      isFinishingRef.current = false;
      setIsFinishing(false);
    }
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
        const existing = await db.exerciseSwaps
          .where('planName')
          .equals(planName)
          .filter(s => s.dayName === dayName && s.originalExerciseName.toLowerCase() === currentExercise.exerciseName.toLowerCase())
          .first();
        if (existing?.id) {
          await db.exerciseSwaps.update(existing.id, {
            newExerciseId: newEx.id || 0,
            newExerciseName: newEx.name,
            newGifUrl: getExerciseGifUrl(newEx),
            swappedAt: new Date(),
          });
        } else {
          await db.exerciseSwaps.add({
            planName,
            dayName,
            originalExerciseName: currentExercise.exerciseName,
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
    const initial = field === 'weight' ? set.weight : (set.reps || set.targetReps);
    setNumpadValue(String(initial));
    setNumpadFresh(true);
    setShowNumpad({ field, exerciseIdx: eIdx, setIdx: sIdx });
  };

  const handleNumpadInput = (key: string) => {
    if (key === 'C') {
      setNumpadValue('0');
      setNumpadFresh(false);
    } else if (key === '←') {
      setNumpadFresh(false);
      setNumpadValue(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (key === '.') {
      if (numpadFresh) {
        setNumpadValue('0.');
        setNumpadFresh(false);
      } else if (!numpadValue.includes('.')) {
        setNumpadValue(prev => prev + '.');
      }
    } else if (key === '✓') {
      if (showNumpad) {
        const v = Math.max(0, parseFloat(numpadValue) || 0);
        if (showNumpad.field === 'weight') {
          updateSetWeight(showNumpad.exerciseIdx, showNumpad.setIdx, v);
        } else {
          updateSetReps(showNumpad.exerciseIdx, showNumpad.setIdx, Math.max(1, Math.round(v)));
        }
        setShowNumpad(null);
      }
    } else {
      // First digit typed after opening numpad replaces existing value cleanly
      if (numpadFresh) {
        setNumpadValue(key);
        setNumpadFresh(false);
      } else {
        setNumpadValue(prev => (prev === '0' ? key : prev + key));
      }
    }
  };

  const adjustNumpadDelta = (delta: number) => {
    setNumpadFresh(false);
    setNumpadValue(prev => {
      const current = parseFloat(prev) || 0;
      const next = Math.max(0, Number((current + delta).toFixed(2)));
      return String(next);
    });
  };

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

  const activePlateTargetWeight = useMemo(() => {
    if (!currentExercise) return 0;
    const idx = currentSetIndex >= 0 ? currentSetIndex : 0;
    return currentExercise.sets[idx]?.weight || 0;
  }, [currentExercise, currentSetIndex]);

  const plateBreakdown = useMemo(() => {
    if (activePlateTargetWeight <= 0) return null;
    return calculatePlates(activePlateTargetWeight, barWeight, unitSystem);
  }, [activePlateTargetWeight, barWeight, unitSystem]);

  if (!currentExercise) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Dumbbell size={48} color="var(--text-dim)" style={{ marginBottom: 16 }} />
          <h2>No exercises</h2>
          <button className="btn-secondary" onClick={() => endWorkout()} style={{ marginTop: 16 }}>Go Back</button>
        </div>
      </div>
    );
  }

  const mediaErrorKey = `${currentExercise.exerciseId || 0}_${currentExercise.exerciseName}`;
  const hasImgError = imgErrors.has(mediaErrorKey);
  const hasVisualMedia = Boolean(primaryGifUrl) || backupFrames.length > 0 || (exerciseInfo?.images?.length || 0) > 0;

  return (
    <div className="workout-page-shell">
      {/* Sticky Top Bar with Safe-Area Inset */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'color-mix(in srgb, var(--bg-sheet) 92%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        zIndex: 50,
        padding: 'max(10px, env(safe-area-inset-top)) 16px 10px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setMinimized(true)}
              className="btn-secondary"
              style={{ minHeight: 36, padding: '6px 10px', borderRadius: 10, fontSize: 11 }}
              title="Minimize workout to browse app"
            >
              <ChevronDown size={15} /> Minimize
            </button>
            <button onClick={() => setShowCancelConfirm(true)} className="btn-cancel" style={{ minHeight: 36, padding: '6px 10px', fontSize: 11 }}>
              <X size={14} /> End
            </button>
          </div>

          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em', textAlign: 'center', flex: 1, padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dayName || planName}
          </div>

          <button
            onClick={handleFinish}
            disabled={isFinishing}
            className="btn-primary"
            style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: '6px 14px', minHeight: 36, width: 'auto', opacity: isFinishing ? 0.6 : 1 }}
          >
            {isFinishing ? 'Saving...' : 'Finish'}
          </button>
        </div>

        <div className="progress-bar" style={{ height: 4 }}>
          <motion.div className="progress-bar-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              Exercise {currentExerciseIndex + 1} of {exercises.length}
            </span>
            {keepScreenOn !== false && (
              <span
                title={screenAwakeLocked ? 'Screen Wake Lock active' : 'Keep screen awake enabled'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                  background: 'rgba(16,232,154,0.1)', color: 'var(--accent-green)',
                  border: '1px solid rgba(16,232,154,0.22)',
                }}
              >
                <Sun size={9} /> Awake
              </span>
            )}
          </div>
          {showTimer !== false && <WorkoutHeaderStopwatch />}
        </div>
      </div>

      {/* Exercise Queue Strip + Add Exercise */}
      <div className="chip-scroll" style={{ padding: '8px 16px', marginBottom: 0, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
        {exercises.map((ex, idx) => (
          <button
            key={idx}
            onClick={() => goToExercise(idx)}
            style={{
              flexShrink: 0, padding: '7px 13px', borderRadius: 12,
              border: idx === currentExerciseIndex ? '2px solid var(--accent-red)' : '1px solid var(--border-subtle)',
              background: ex.isComplete ? 'rgba(16,232,154,0.08)' : 'var(--bg-glass)',
              color: ex.isComplete ? 'var(--accent-green)' : idx === currentExerciseIndex ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36, textTransform: 'capitalize',
            }}
          >
            {ex.isComplete ? '✓ ' : ''}{ex.exerciseName.split(' ').slice(0, 3).join(' ')}
          </button>
        ))}
        <button
          onClick={openAddExerciseModal}
          style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 12,
            border: '1px dashed var(--accent-purple)', background: 'rgba(139,92,246,0.08)',
            color: 'var(--accent-purple)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, minHeight: 36,
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Responsive Split Content Area */}
      <div className="workout-split-grid" style={{ padding: 16, paddingBottom: 'calc(24px + env(safe-area-inset-bottom) + 110px)' }}>
        {/* Left Pane (Sticky on Tablet/Desktop): Exercise Media + Overload Tip + Plate Calculator */}
        <div className="workout-media-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasVisualMedia && !hasImgError && (
            <div
              className="gif-upscale-container"
              style={{
                width: '100%',
                height: mediaExpanded ? 340 : 215,
                borderRadius: 'var(--r-lg)',
                overflow: 'hidden',
                background: 'var(--bg-media)',
                position: 'relative',
                border: '1px solid var(--border-subtle)',
                transition: 'height 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(139,92,246,0.05) 0%, transparent 70%)', zIndex: 0 }} />
              <ExerciseMedia
                gifUrl={primaryGifUrl}
                imageUrls={backupFrames}
                images={exerciseInfo?.images}
                alt={currentExercise.exerciseName}
                loading="eager"
                frameIntervalMs={700}
                style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto', position: 'relative', zIndex: 1 }}
                onMediaModeChange={setActiveMediaMode}
                onExhausted={() => setImgErrors(prev => new Set(prev).add(mediaErrorKey))}
              />
              <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 5, zIndex: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                {activeMediaMode === 'gif'
                  ? 'LIVE GIF'
                  : activeMediaMode === 'animated-images'
                    ? 'ANIMATED FRAMES'
                    : 'DEMO IMAGE'}
              </div>
              <button
                onClick={() => setMediaExpanded(prev => !prev)}
                aria-label={mediaExpanded ? 'Compact exercise demo' : 'Expand exercise demo'}
                style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 2,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8,
                  color: '#ffffff', padding: '5px 8px', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                {mediaExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{mediaExpanded ? 'Compact' : 'Expand'}</span>
              </button>
            </div>
          )}

          {/* Progressive Overload Suggestion Banner */}
          {overloadTip && overloadTip.suggestedWeight > 0 && (
            <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid rgba(16,232,154,0.25)', background: 'rgba(16,232,154,0.05)' }}>
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
        </div>

        {/* Right Pane: Title, Controls, Set Logger & Plate Calculator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Title + Navigation & Action Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="font-display" style={{ fontSize: 19, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
                {currentExercise.exerciseName}
              </h2>
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

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setShowNotes(true)} title="Notes & Form Guide" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)', color: 'var(--accent-yellow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StickyNote size={16} /></button>
              <button onClick={handleSwap} title="Swap Exercise (Equipment-Filtered)" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.22)', color: 'var(--accent-purple)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeftRight size={16} /></button>
              <button onClick={prevExercise} disabled={currentExerciseIndex === 0} aria-label="Previous exercise" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === 0 ? 0.3 : 1 }}><ChevronLeft size={18} /></button>
              <button onClick={nextExercise} disabled={currentExerciseIndex === exercises.length - 1} aria-label="Next exercise" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentExerciseIndex === exercises.length - 1 ? 0.3 : 1 }}><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Column Headers for Single-Line Set Logger */}
          <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1.15fr) minmax(0, 1fr) 44px auto', gap: 6, padding: '0 10px' }}>
            <span className="section-label" style={{ textAlign: 'center' }}>SET</span>
            <span className="section-label" style={{ textAlign: 'center' }}>{unitLabel.toUpperCase()} (±{stepWeight})</span>
            <span className="section-label" style={{ textAlign: 'center' }}>REPS</span>
            <span className="section-label" style={{ textAlign: 'center' }}>DONE</span>
            <span />
          </div>

          {/* Single-Line Zero-Shift Sets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentExercise.sets.map((set, setIdx) => {
              const typeInfo = SET_TYPE_BADGE[set.setType || SetType.Normal] || SET_TYPE_BADGE[SetType.Normal];
              return (
                <div
                  key={setIdx}
                  className={`set-row ${set.isComplete ? 'completed' : ''}`}
                  style={setIdx === currentSetIndex ? { borderColor: 'var(--border-active)' } : {}}
                >
                  {/* Set Number / Set Type Cycle Badge */}
                  <button
                    onClick={() => cycleSetType(currentExerciseIndex, setIdx)}
                    title={typeInfo.title}
                    style={{
                      width: 32, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: typeInfo.bg,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, flexShrink: 0,
                      color: typeInfo.color,
                    }}
                  >
                    <span>{typeInfo.label || setIdx + 1}</span>
                    {set.isPR && <span style={{ fontSize: 8, lineHeight: 1 }}>🏆</span>}
                  </button>

                  {/* Weight Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 }}>
                    <button
                      onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Math.max(0, Number((set.weight - stepWeight).toFixed(2))))}
                      aria-label="Decrease weight"
                      style={{ width: 30, height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      className="set-input"
                      onClick={() => openNumpad('weight', currentExerciseIndex, setIdx)}
                      style={{ cursor: 'pointer', flex: 1, minWidth: 44, padding: '4px 4px' }}
                    >
                      {set.weight}
                    </button>
                    <button
                      onClick={() => updateSetWeight(currentExerciseIndex, setIdx, Number((set.weight + stepWeight).toFixed(2)))}
                      aria-label="Increase weight"
                      style={{ width: 30, height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Reps Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 }}>
                    <button
                      onClick={() => updateSetReps(currentExerciseIndex, setIdx, Math.max(1, (set.reps || set.targetReps) - 1))}
                      aria-label="Decrease reps"
                      style={{ width: 30, height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      className="set-input"
                      onClick={() => openNumpad('reps', currentExerciseIndex, setIdx)}
                      style={{ cursor: 'pointer', flex: 1, minWidth: 38, padding: '4px 4px' }}
                    >
                      {set.reps || set.targetReps}
                    </button>
                    <button
                      onClick={() => updateSetReps(currentExerciseIndex, setIdx, (set.reps || set.targetReps) + 1)}
                      aria-label="Increase reps"
                      style={{ width: 30, height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Always-Mounted Complete / Undo Button (Zero Layout Shift!) */}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleCompleteSet(currentExerciseIndex, setIdx)}
                    className={`complete-set-btn ${set.isComplete ? 'is-done' : ''}`}
                    aria-label={set.isComplete ? `Unmark set ${setIdx + 1}` : `Complete set ${setIdx + 1}`}
                    title={set.isComplete ? 'Tap to uncheck set' : 'Complete set'}
                  >
                    <Check size={17} strokeWidth={2.8} />
                  </motion.button>

                  {/* Optional Per-Row Delete Set Button */}
                  {currentExercise.sets.length > 1 ? (
                    <button
                      onClick={() => removeSet(currentExerciseIndex, setIdx)}
                      aria-label={`Delete set ${setIdx + 1}`}
                      title="Delete this set"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={13} />
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </div>

          {/* Add Set & Safe Remove Exercise Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => addSet(currentExerciseIndex)}
              className="btn-secondary"
              style={{ flex: 1, minHeight: 40, padding: '8px 12px', fontSize: 12, fontWeight: 700, borderRadius: 10 }}
            >
              <Plus size={14} /> Add Set
            </button>
            {exercises.length > 1 && (
              confirmRemoveEx ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => { removeExercise(currentExerciseIndex); setConfirmRemoveEx(false); }}
                    className="btn-cancel"
                    style={{ minHeight: 40, padding: '8px 12px', fontSize: 11, borderRadius: 10 }}
                  >
                    Confirm Drop
                  </button>
                  <button
                    onClick={() => setConfirmRemoveEx(false)}
                    className="btn-ghost"
                    style={{ minHeight: 40, padding: '8px 10px', fontSize: 11 }}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemoveEx(true)}
                  className="btn-ghost"
                  style={{ minHeight: 40, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Trash2 size={13} /> Drop Exercise
                </button>
              )
            )}
          </div>

          {/* Interactive Rest & Interval Timer Bar with Explicit Start Timer Button */}
          <WorkoutRestTimerBar defaultSeconds={currentExercise.restTime || defaultRestTime || 90} />

          {/* Unit-Aware Plate Calculator */}
          {plateBreakdown && activePlateTargetWeight > 0 && (
            <div>
              <button
                onClick={() => setShowPlates(!showPlates)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-glass)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, minHeight: 42,
                }}
              >
                <span>🏋️ Plate Calculator ({activePlateTargetWeight}{unitLabel})</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{showPlates ? '▲' : '▼'}</span>
              </button>
              <AnimatePresence>
                {showPlates && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '0 0 var(--r-sm) var(--r-sm)', border: '1px solid var(--border-subtle)', borderTop: 'none' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {exerciseInfo?.equipment?.toLowerCase().includes('dumbbell')
                          ? `Dumbbell default: ${dumbbellWeight}${unitLabel} each`
                          : `Bar: ${barWeight}${unitLabel} • Each side: ${Math.max(0, (activePlateTargetWeight - barWeight) / 2).toFixed(1)}${unitLabel}`}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {plateBreakdown.perSide.map((p, i) => {
                          const pColor = getPlateColor(p.weight, unitSystem);
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', background: `${pColor}18`, border: `1px solid ${pColor}38`, borderRadius: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: pColor }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: pColor }}>{p.weight}{unitLabel} ×{p.count}</span>
                            </div>
                          );
                        })}
                        {plateBreakdown.perSide.length === 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empty bar ({barWeight}{unitLabel})</span>
                        )}
                      </div>
                      {!plateBreakdown.isExact && activePlateTargetWeight > barWeight && (
                        <div style={{ fontSize: 10, color: 'var(--accent-yellow)', marginTop: 6 }}>
                          Nearest loadable weight with standard plates: {plateBreakdown.totalWeight}{unitLabel}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Live Session Stats Footer */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 14, background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)' }}>{totalVolume.toLocaleString()} {unitLabel}</div>
              <div className="section-label" style={{ fontSize: 9 }}>Volume</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-purple)' }}>{totalSets}</div>
              <div className="section-label" style={{ fontSize: 9 }}>Sets</div>
            </div>
            <WorkoutFooterElapsedStat />
          </div>
        </div>
      </div>

      {/* Isolated Rest Timer Leaf Component */}
      <RestTimerLeaf
        exerciseName={currentExercise.exerciseName}
        restMinimized={restMinimized}
        setRestMinimized={setRestMinimized}
        playFeedbackTone={playFeedbackTone}
        triggerHaptic={triggerHaptic}
        countdownSound={countdownSound}
      />

      {/* Add Exercise Mid-Workout Modal */}
      <AnimatePresence>
        {showAddExercise && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddExercise(false)}>
            <motion.div
              className="modal-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 450) setShowAddExercise(false);
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Add Exercise to Workout</h3>
                <button onClick={() => setShowAddExercise(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="search-bar" value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search by name or muscle..." style={{ paddingLeft: 36 }} />
              </div>
              <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredAddCatalog.map(ex => (
                  <button key={ex.id} onClick={() => handleAddExerciseToWorkout(ex)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 12,
                    cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)',
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--bg-media)', flexShrink: 0 }}>
                      <ExerciseMedia gifUrl={ex.gifUrl} imageUrls={ex.imageUrls} images={ex.images} alt={ex.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{ex.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ex.equipment} • {ex.primaryMuscles.join(', ')}</div>
                    </div>
                    {hasGifExerciseMedia(ex) && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)' }}>GIF</span>
                    )}
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
            <motion.div
              className="modal-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 450) setShowCancelConfirm(false);
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <AlertTriangle size={28} color="var(--accent-red)" />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Discard Workout?</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                  Your progress ({totalSets} sets, {totalVolume.toLocaleString()}{unitLabel} volume) will be discarded. You can also minimize the workout to keep it running in the background.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary" style={{ flex: 1, minHeight: 48, borderRadius: 14 }}>
                    Keep Training
                  </button>
                  <button onClick={() => { endWorkout(); setShowCancelConfirm(false); }} className="btn-cancel" style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
                    End &amp; Discard
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes & Instructions Modal */}
      <AnimatePresence>
        {showNotes && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotes(false)}>
            <motion.div
              className="modal-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 450) setShowNotes(false);
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, textTransform: 'capitalize' }}>{currentExercise.exerciseName}</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Exercise notes &amp; instructions</p>

              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <a
                  href={getYoutubeSearchUrl(currentExercise.exerciseName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: '1 1 160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none',
                    background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,0,0,0.18)',
                    color: '#FF5555', fontWeight: 600, fontSize: 12,
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
                      background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border-subtle)', maxHeight: '32vh', overflowY: 'auto' }}>
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
                    const color = '#EF4444';
                    return <span key={m} className="badge" style={{ background: `${color}14`, color, border: `1px solid ${color}28`, fontWeight: 700, fontSize: 10 }}>● {m}</span>;
                  })}
                  {exerciseInfo.equipment && (
                    <span className="badge badge-muscle" style={{ textTransform: 'capitalize', fontSize: 10 }}>🏋️ {exerciseInfo.equipment}</span>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>YOUR NOTES (SAVED WITH WORKOUT)</div>
                <textarea
                  value={notes[currentExerciseIndex] || ''}
                  onChange={e => setNotes(prev => ({ ...prev, [currentExerciseIndex]: e.target.value }))}
                  placeholder="Add form cues, seat settings, or notes..."
                  rows={3}
                  style={{ width: '100%', padding: 14, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <button onClick={() => setShowNotes(false)} className="btn-primary" style={{ borderRadius: 14, minHeight: 46 }}>Save Note</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Modal */}
      <AnimatePresence>
        {showSwap && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSwap(false)}>
            <motion.div
              className="modal-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 450) setShowSwap(false);
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Swap Exercise</h3>
                <button onClick={() => setShowSwap(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Swapping: {currentExercise?.exerciseName}</div>
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
                        <button key={ex.id} onClick={() => doSwap(ex)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)', marginBottom: 4, minHeight: 56 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--bg-media)', flexShrink: 0 }}>
                            <ExerciseMedia
                              gifUrl={ex.gifUrl}
                              imageUrls={ex.imageUrls}
                              images={ex.images}
                              alt={ex.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{ex.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              {matchTags.slice(0, 3).map((tag, i) => (<span key={i} style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>{tag}</span>))}
                            </div>
                          </div>
                          {hasGifExerciseMedia(ex) ? (
                            <div style={{ fontSize: 9, color: 'var(--accent-green)', fontWeight: 700 }}>GIF</div>
                          ) : hasAnimatedExerciseMedia(ex) ? (
                            <div style={{ fontSize: 9, color: 'var(--accent-cyan)', fontWeight: 700 }}>ANIM</div>
                          ) : null}
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

      {/* First-Keystroke Auto-Replace Numpad */}
      <AnimatePresence>
        {showNumpad && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNumpad(null)}>
            <motion.div
              className="modal-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 450) setShowNumpad(null);
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 4 }}>
                  {showNumpad.field === 'weight' ? `SET ${showNumpad.setIdx + 1} WEIGHT (${unitLabel.toUpperCase()})` : `SET ${showNumpad.setIdx + 1} REPS`}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 40,
                    fontWeight: 800,
                    display: 'inline-block',
                    padding: '2px 14px',
                    borderRadius: 12,
                    background: numpadFresh ? 'color-mix(in srgb, var(--accent-purple) 18%, transparent)' : 'transparent',
                    border: numpadFresh ? '1px dashed var(--accent-purple)' : '1px solid transparent',
                  }}
                >
                  {numpadValue}
                  {showNumpad.field === 'weight' && <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4 }}>{unitLabel}</span>}
                </div>
                {numpadFresh && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    Type new value to replace, or tap +/- below to adjust
                  </div>
                )}
              </div>

              {showNumpad.field === 'weight' ? (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  {[-5, -2.5, 1, 2.5, 5, 10].map(inc => (
                    <button
                      key={inc}
                      className="btn-secondary"
                      onClick={() => adjustNumpadDelta(inc)}
                      style={{ padding: '7px 11px', fontSize: 12, borderRadius: 10, minHeight: 36 }}
                    >
                      {inc > 0 ? `+${inc}` : inc}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  {[-2, -1, 1, 2, 5].map(inc => (
                    <button
                      key={inc}
                      className="btn-secondary"
                      onClick={() => adjustNumpadDelta(inc)}
                      style={{ padding: '7px 12px', fontSize: 12, borderRadius: 10, minHeight: 36 }}
                    >
                      {inc > 0 ? `+${inc}` : inc}
                    </button>
                  ))}
                </div>
              )}

              <div className="numpad-grid">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', showNumpad.field === 'weight' ? '.' : 'C', '0', '←'].map(key => (
                  <button key={key} className="numpad-key" onClick={() => handleNumpadInput(key)}>
                    {key}
                  </button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="numpad-key action"
                  onClick={() => handleNumpadInput('✓')}
                  style={{ gridColumn: '1 / -1' }}
                >
                  Apply {showNumpad.field === 'weight' ? 'Weight' : 'Reps'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
