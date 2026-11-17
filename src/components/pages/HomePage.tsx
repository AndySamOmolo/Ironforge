'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Dumbbell, Calendar, Target, ChevronRight, ChevronDown, Zap,
  Star, BarChart3, Shuffle, Check, Activity, Timer, Play, Pause, RotateCcw,
} from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUIStore } from '@/lib/store/uiStore';
import type { WorkoutSession, WorkoutPlan, WorkoutDay, Exercise } from '@/lib/types';
import { resolveWorkoutDayExercises, generateSmartWorkout, ALL_EQUIPMENT } from '@/lib/utils/exerciseResolver';

const FITNESS_QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Gandhi" },
  { text: "The iron never lies to you. Two hundred pounds is always two hundred pounds.", author: "Henry Rollins" },
  { text: "No man has the right to be an amateur in the matter of physical training.", author: "Socrates" },
  { text: "The resistance that you fight physically in the gym strengthens your character.", author: "Arnold Schwarzenegger" },
  { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
  { text: "The last three or four reps is what makes the muscle grow.", author: "Arnold Schwarzenegger" },
  { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Arnold Schwarzenegger" },
  { text: "If something stands between you and your success, move it.", author: "Dwayne Johnson" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The clock is ticking. Are you becoming the person you want to be?", author: "Greg Plitt" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "What hurts today makes you stronger tomorrow.", author: "Jay Cutler" },
  { text: "I don't stop when I'm tired. I stop when I'm done.", author: "David Goggins" },
  { text: "Be stronger than your strongest excuse.", author: "Unknown" },
  { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
  { text: "Winners never quit, and quitters never win.", author: "Vince Lombardi" },
  { text: "Motivation gets you started. Habit keeps you going.", author: "Jim Ryun" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
];

export function toLocalDateKey(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type DayActivitySummary = {
  dateKey: string;
  count: number;
  volume: number;
  sets: number;
  durationSec: number;
  sessions: WorkoutSession[];
};


/**
 * Standalone Gym Timer & Stopwatch Card on the Home Dashboard with an explicit "Start Timer" button,
 * Countdown presets (30s, 60s, 90s, 120s, 180s), and Stopwatch mode.
 */
function HomeGymTimerCard() {
  const [timerMode, setTimerMode] = useState<'countdown' | 'stopwatch'>('countdown');
  const [presetSec, setPresetSec] = useState<number>(90);
  const [seconds, setSeconds] = useState<number>(90);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds(prev => {
        if (timerMode === 'countdown') {
          if (prev <= 1) {
            setRunning(false);
            try {
              const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const w = window as any;
                if (!w.__ironforgeAudioCtx || w.__ironforgeAudioCtx.state === 'closed') {
                  w.__ironforgeAudioCtx = new AudioCtx();
                }
                const ctx = w.__ironforgeAudioCtx as AudioContext;
                if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = 880;
                osc.connect(gain);
                gain.connect(ctx.destination);
                gain.gain.setValueAtTime(0.14, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
              }
            } catch {}
            return 0;
          }
          return prev - 1;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, timerMode]);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleStart = () => {
    if (!running && timerMode === 'countdown' && seconds === 0) {
      setSeconds(presetSec);
    }
    setRunning(prev => !prev);
  };

  const handleReset = () => {
    setRunning(false);
    setSeconds(timerMode === 'countdown' ? presetSec : 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="card"
      style={{
        padding: 16,
        marginBottom: 20,
        border: running ? '1px solid rgba(16,232,154,0.4)' : '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: running ? 'rgba(16,232,154,0.14)' : 'rgba(255,61,90,0.12)',
            color: running ? 'var(--accent-green)' : 'var(--accent-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Timer size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Gym Timer &amp; Stopwatch</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {timerMode === 'countdown' ? 'Rest & interval countdown' : 'Elapsed conditioning stopwatch'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-glass)', padding: 3, borderRadius: 9, border: '1px solid var(--border-subtle)' }}>
          {([
            { id: 'countdown' as const, label: 'Timer' },
            { id: 'stopwatch' as const, label: 'Stopwatch' },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => {
                setRunning(false);
                setTimerMode(m.id);
                setSeconds(m.id === 'countdown' ? presetSec : 0);
              }}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: timerMode === m.id ? 'var(--accent-purple)' : 'transparent',
                color: timerMode === m.id ? '#fff' : 'var(--text-muted)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: timerMode === 'countdown' ? 12 : 0 }}>
        <div className="font-mono" style={{ fontSize: 32, fontWeight: 800, color: running ? 'var(--accent-green)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {fmt(seconds)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleStart}
            className="btn-primary"
            style={{
              width: 'auto', minHeight: 42, padding: '10px 18px', fontSize: 12, borderRadius: 12,
              background: running ? 'var(--gradient-ocean)' : 'var(--gradient-fire)',
            }}
          >
            {running ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            <span>{running ? 'Pause Timer' : 'Start Timer'}</span>
          </button>
          <button
            onClick={handleReset}
            className="btn-secondary"
            style={{ minHeight: 42, padding: '10px 14px', fontSize: 12, borderRadius: 12 }}
            title="Reset timer"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {timerMode === 'countdown' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[30, 60, 90, 120, 180].map(sec => (
            <button
              key={sec}
              onClick={() => {
                setPresetSec(sec);
                setSeconds(sec);
                setRunning(false);
              }}
              className={`filter-chip ${presetSec === sec ? 'active' : ''}`}
              style={{ padding: '5px 11px', fontSize: 11, minHeight: 30, flex: '1 1 auto' }}
            >
              {sec < 60 ? `${sec}s` : `${sec / 60}m`}
            </button>
          ))}
          <button
            onClick={() => setSeconds(s => s + 15)}
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: 11, minHeight: 30, borderRadius: 999 }}
          >
            +15s
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function HomePage() {
  const name = useUserStore(s => s.name);
  const barWeight = useUserStore(s => s.barWeight);
  const dumbbellWeight = useUserStore(s => s.dumbbellWeight);
  const userEquipment = useUserStore(s => s.equipment);
  const exerciseVariety = useUserStore(s => s.exerciseVariety);
  const showDailyQuote = useUserStore(s => s.showDailyQuote);
  const showActivityHeatmap = useUserStore(s => s.showActivityHeatmap);
  const showFeatureCards = useUserStore(s => s.showFeatureCards);
  const showLastWorkout = useUserStore(s => s.showLastWorkout);
  const unitSystem = useUserStore(s => s.unitSystem);

  const startWorkout = useWorkoutStore(s => s.startWorkout);
  const setActiveTab = useUIStore(s => s.setActiveTab);

  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [activePlanDays, setActivePlanDays] = useState<WorkoutDay[]>([]);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    weekWorkouts: 0,
    streak: 0,
    bestStreak: 0,
    totalVolume: 0,
    prsThisMonth: 0,
    activeDays30d: 0,
    weekDurationSec: 0,
    weekSets: 0,
    weekVolume: 0,
  });
  const [exerciseCount, setExerciseCount] = useState(0);
  const [planCount, setPlanCount] = useState(17);
  const [activityByDate, setActivityByDate] = useState<Map<string, DayActivitySummary>>(new Map());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toLocalDateKey(new Date()));
  const [heatmapMetric, setHeatmapMetric] = useState<'workouts' | 'volume' | 'duration'>('workouts');
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [expandedSets, setExpandedSets] = useState<{ name: string; sets: { weight: number; reps: number; isPR?: boolean }[] }[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(false);
  const [lastWorkout, setLastWorkout] = useState<WorkoutSession | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [recentExerciseIds, setRecentExerciseIds] = useState<Set<number>>(new Set());
  const heatmapScrollRef = useRef<HTMLDivElement>(null);

  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lb';

  const todayQuote = useMemo(() => {
    const day = Math.floor(Date.now() / 86400000) % FITNESS_QUOTES.length;
    return FITNESS_QUOTES[day];
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (heatmapScrollRef.current) {
      heatmapScrollRef.current.scrollLeft = heatmapScrollRef.current.scrollWidth;
    }
  }, [activityByDate]);

  const loadDashboard = async () => {
    try {
      const allSessions = await db.workoutSessions.orderBy('startedAt').reverse().toArray();
      const completedAll = allSessions.filter(s => s.isComplete);
      setRecentSessions(completedAll.slice(0, 10));
      if (completedAll.length > 0) setLastWorkout(completedAll[0]);

      // Start of current week (Monday)
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);

      const weekSessions = completedAll.filter(s => new Date(s.startedAt) >= startOfWeek);

      // Daily Activity Map (local timezone keys)
      const byDate = new Map<string, DayActivitySummary>();
      for (const s of completedAll) {
        const key = toLocalDateKey(s.startedAt);
        const existing = byDate.get(key) || {
          dateKey: key,
          count: 0,
          volume: 0,
          sets: 0,
          durationSec: 0,
          sessions: [],
        };
        existing.count += 1;
        existing.volume += s.totalVolume || 0;
        existing.sets += s.totalSets || 0;
        existing.durationSec += s.duration || 0;
        existing.sessions.push(s);
        byDate.set(key, existing);
      }
      setActivityByDate(byDate);

      // Current & Best Streak
      let streak = 0;
      const cursor = new Date();
      if (!byDate.has(toLocalDateKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (byDate.has(toLocalDateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      let bestStreak = 0;
      let runStreak = 0;
      const sortedDateKeys = Array.from(byDate.keys()).sort();
      for (let i = 0; i < sortedDateKeys.length; i++) {
        if (i === 0) {
          runStreak = 1;
        } else {
          const prevDate = new Date(`${sortedDateKeys[i - 1]}T00:00:00`);
          const currDate = new Date(`${sortedDateKeys[i]}T00:00:00`);
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
          runStreak = diffDays === 1 ? runStreak + 1 : 1;
        }
        bestStreak = Math.max(bestStreak, runStreak);
      }

      // Active days in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeDays30d = Array.from(byDate.keys()).filter(k => new Date(`${k}T12:00:00`) >= thirtyDaysAgo).length;

      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthPRs = await db.personalRecords.filter(pr => new Date(pr.date) >= monthAgo).count();

      setStats({
        totalWorkouts: completedAll.length,
        weekWorkouts: weekSessions.length,
        streak,
        bestStreak,
        totalVolume: completedAll.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
        prsThisMonth: monthPRs,
        activeDays30d,
        weekDurationSec: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        weekSets: weekSessions.reduce((sum, s) => sum + (s.totalSets || 0), 0),
        weekVolume: weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
      });

      const [plansList, catalog, recentSets] = await Promise.all([
        db.workoutPlans.toArray(),
        db.exercises.toArray(),
        db.sets.orderBy('completedAt').reverse().limit(120).toArray(),
      ]);
      setPlanCount(plansList.length || 17);
      const active = plansList.find(p => !!p.isActive) || null;
      setActivePlan(active);
      if (active?.id) {
        const days = await db.workoutDays.where('planId').equals(active.id).sortBy('dayNumber');
        setActivePlanDays(days);
      } else {
        setActivePlanDays([]);
      }

      setAllExercises(catalog);
      setExerciseCount(catalog.length);
      setRecentExerciseIds(new Set(recentSets.map(s => s.exerciseId).filter(Boolean)));
    } catch {}
  };

  const toggleExpandSession = async (session: WorkoutSession) => {
    if (!session.id) return;
    if (expandedSessionId === session.id) {
      setExpandedSessionId(null);
      setExpandedSets([]);
      return;
    }
    setExpandedSessionId(session.id);
    setIsLoadingSets(true);
    try {
      const sets = await db.sets.where('sessionId').equals(session.id).toArray();
      const exMap = new Map(allExercises.filter(e => e.id != null).map(e => [e.id!, e.name]));
      const grouped: Record<number, { name: string; sets: { weight: number; reps: number; isPR?: boolean }[] }> = {};
      for (const s of sets) {
        if (!grouped[s.exerciseId]) {
          grouped[s.exerciseId] = { name: exMap.get(s.exerciseId) || 'Exercise', sets: [] };
        }
        grouped[s.exerciseId].sets.push({ weight: s.weight, reps: s.reps, isPR: s.isPR });
      }
      setExpandedSets(Object.values(grouped));
    } catch {
      setExpandedSets([]);
    }
    setIsLoadingSets(false);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.max(1, Math.round(seconds / 60));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const getRelativeTime = (date: Date) => {
    const todayKey = toLocalDateKey(new Date());
    const targetKey = toLocalDateKey(date);
    if (todayKey === targetKey) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (toLocalDateKey(yesterday) === targetKey) return 'Yesterday';
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days} days ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickStart = async (day: WorkoutDay, extraSeed = 0) => {
    if (!activePlan) return;

    const savedSwaps: Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }> = {};
    try {
      const swaps = await db.exerciseSwaps.where('planName').equals(activePlan.name).filter(s => s.dayName === day.name).toArray();
      for (const swap of swaps) {
        savedSwaps[swap.originalExerciseName.toLowerCase()] = {
          newExerciseId: swap.newExerciseId,
          newExerciseName: swap.newExerciseName,
          newGifUrl: swap.newGifUrl,
        };
      }
    } catch {}

    const catalog = allExercises.length > 0 ? allExercises : await db.exercises.toArray();
    const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
    const seed = stats.totalWorkouts + day.dayNumber * 2 + extraSeed;

    const exercises = resolveWorkoutDayExercises({
      dayExercises: day.exercises,
      allExercises: catalog,
      userEquipment: equip,
      barWeight,
      dumbbellWeight,
      savedSwaps,
      recentExerciseIds,
      varietySeed: seed,
      varietyLevel: exerciseVariety || 'medium',
    });

    startWorkout(activePlan.name, day.name, exercises);
  };

  const handleSurpriseWorkout = async () => {
    const catalog = allExercises.length > 0 ? allExercises : await db.exercises.toArray();
    const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
    const generated = generateSmartWorkout({
      targetMuscles: ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'biceps', 'triceps'],
      exerciseCount: 6,
      setsPerExercise: 3,
      repsPerSet: 10,
      allExercises: catalog,
      userEquipment: equip,
      recentExerciseIds,
      seed: Date.now(),
    });
    const dayExercises = generated.map((item, i) => ({
      exerciseId: 0,
      exerciseName: item.name,
      sets: item.sets,
      reps: item.reps,
      restTime: 90,
      setType: 'normal' as any,
      order: i,
    }));
    const exercises = resolveWorkoutDayExercises({
      dayExercises,
      allExercises: catalog,
      userEquipment: equip,
      barWeight,
      dumbbellWeight,
      recentExerciseIds,
      varietySeed: 0,
      varietyLevel: 'low',
    });
    startWorkout('Smart Mix', 'Full Body Express', exercises);
  };

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  // Current week Mon–Sun strip
  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return labels.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const key = toLocalDateKey(d);
      const summary = activityByDate.get(key);
      return {
        label,
        dayNum: d.getDate(),
        dateKey: key,
        isToday: key === todayKey,
        count: summary?.count || 0,
        volume: summary?.volume || 0,
      };
    });
  }, [activityByDate, todayKey]);

  // 16-Week Calendar Grid with per-column aligned Month Headers
  const heatmapWeeks = useMemo(() => {
    const weeks: {
      monthHeader: string;
      days: { date: string; monthShort: string; summary: DayActivitySummary }[];
    }[] = [];
    const now = new Date();
    let lastMonth = '';

    for (let w = 15; w >= 0; w--) {
      const days: { date: string; monthShort: string; summary: DayActivitySummary }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = toLocalDateKey(date);
        const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
        const summary = activityByDate.get(key) || {
          dateKey: key,
          count: 0,
          volume: 0,
          sets: 0,
          durationSec: 0,
          sessions: [],
        };
        days.push({ date: key, monthShort, summary });
      }
      const firstDayMonth = days[0].monthShort;
      const monthHeader = firstDayMonth !== lastMonth ? firstDayMonth : '';
      if (firstDayMonth !== lastMonth) {
        lastMonth = firstDayMonth;
      }
      weeks.push({ monthHeader, days });
    }
    return weeks;
  }, [activityByDate]);

  const weeklyGoalTarget = activePlan?.daysPerWeek || 4;
  const activeWeekDaysCount = currentWeekDays.filter(d => d.count > 0).length;
  const estWeekCalories = Math.round((stats.weekDurationSec / 60) * 6.5 + stats.weekSets * 11);
  const selectedDaySummary = activityByDate.get(selectedDateKey);

  // Streak ring
  const streakDashOffset = Math.max(0, 251 - (251 * Math.min(stats.streak, 7) / 7));

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 3 }}>{greeting()}</div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span className="gradient-text">{name}</span>
          </h1>
        </div>
        <button
          onClick={handleSurpriseWorkout}
          className="btn-secondary"
          style={{ padding: '10px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
          title="Generate a fresh equipment-matched workout"
        >
          <Shuffle size={13} color="var(--accent-purple)" /> Quick Mix
        </button>
      </motion.div>

      {/* Streak Ring + Stats Row */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        className="hero-gradient" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
            <svg width="84" height="84" viewBox="0 0 86 86">
              <circle cx="43" cy="43" r="38" fill="none" stroke="var(--border-subtle)" strokeWidth="4.5" />
              <motion.circle
                cx="43" cy="43" r="38" fill="none" stroke="var(--accent-red)" strokeWidth="5"
                strokeDasharray="251" strokeDashoffset={streakDashOffset} strokeLinecap="round"
                initial={{ strokeDashoffset: 251 }} animate={{ strokeDashoffset: streakDashOffset }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                transform="rotate(-90 43 43)" style={{ filter: 'drop-shadow(0 0 6px var(--glow-red))' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{stats.streak}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>
                Day{stats.streak !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, flex: 1 }}>
            {[
              { value: `${activeWeekDaysCount}/${weeklyGoalTarget}`, label: 'Week Goal', color: 'var(--accent-purple)' },
              { value: stats.totalWorkouts, label: 'Workouts', color: 'var(--accent-yellow)' },
              { value: stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(0)}k` : stats.totalVolume, label: `Vol (${unitLabel})`, color: 'var(--accent-green)' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '6px 2px' }}>
                <div className="font-mono" style={{ fontSize: 19, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div className="section-label" style={{ marginTop: 5, fontSize: 9 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Quick Gym Timer & Stopwatch Card with Explicit Start Timer Button */}
      <HomeGymTimerCard />

      {/* Activity & Consistency Tracker */}
      {showActivityHeatmap !== false && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
          style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={16} color="var(--accent-green)" /> Activity Tracker
            </h2>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { id: 'workouts' as const, label: 'Sessions' },
                { id: 'volume' as const, label: 'Volume' },
                { id: 'duration' as const, label: 'Time' },
              ]).map(m => (
                <button
                  key={m.id}
                  onClick={() => setHeatmapMetric(m.id)}
                  style={{
                    padding: '4px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: heatmapMetric === m.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    border: heatmapMetric === m.id ? 'none' : '1px solid var(--border-subtle)',
                    color: heatmapMetric === m.id ? 'var(--on-accent-text)' : 'var(--text-muted)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            {/* Current Week Mon-Sun Interactive Tracker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  This Week ({activeWeekDaysCount} of {weeklyGoalTarget} days active)
                </span>
                <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-orange)' }}>
                  🔥 ~{estWeekCalories.toLocaleString()} kcal
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 10 }}>
                {currentWeekDays.map((d) => {
                  const isActive = d.count > 0;
                  const isSelected = selectedDateKey === d.dateKey;
                  return (
                    <button
                      key={d.dateKey}
                      onClick={() => setSelectedDateKey(d.dateKey)}
                      style={{
                        padding: '8px 2px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                        background: isActive ? 'rgba(16,232,154,0.12)' : 'var(--bg-glass)',
                        border: isSelected
                          ? '1.5px solid var(--accent-purple)'
                          : d.isToday
                            ? '1.5px solid var(--accent-red)'
                            : isActive
                              ? '1px solid rgba(16,232,154,0.35)'
                              : '1px solid var(--border-subtle)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: d.isToday ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                        {d.label}
                      </span>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: isActive ? 'var(--accent-green)' : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#06120e' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                      }}>
                        {isActive ? <Check size={13} strokeWidth={3} /> : d.dayNum}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Weekly Metrics Strip */}
              <div className="responsive-stats-4">
                {[
                  { label: 'Active Time', value: stats.weekDurationSec > 0 ? formatDuration(stats.weekDurationSec) : '0m', color: 'var(--accent-cyan)' },
                  { label: 'Week Sets', value: stats.weekSets.toString(), color: 'var(--accent-purple)' },
                  { label: '30D Active', value: `${stats.activeDays30d}d`, color: 'var(--accent-green)' },
                  { label: 'Best Streak', value: `${stats.bestStreak}d`, color: 'var(--accent-yellow)' },
                ].map((m, idx) => (
                  <div key={idx} style={{ padding: '7px 4px', background: 'var(--bg-glass)', borderRadius: 9, textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <div className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 16-Week Interactive Heatmap with Column-Aligned Month Labels */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 114, paddingBottom: 2, fontSize: 8, color: 'var(--text-muted)', fontWeight: 700 }}>
                  <span>Sun</span>
                  <span>Wed</span>
                  <span>Sat</span>
                </div>

                <div
                  ref={heatmapScrollRef}
                  style={{
                    display: 'flex',
                    gap: 4,
                    overflowX: 'auto',
                    flex: 1,
                    justifyContent: 'space-between',
                    paddingBottom: 2,
                    scrollbarWidth: 'none',
                  }}
                >
                  {heatmapWeeks.map((weekCol, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                      <div style={{ height: 13, fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                        {weekCol.monthHeader}
                      </div>
                      {weekCol.days.map((day, di) => {
                        const isToday = day.date === todayKey;
                        const isSelected = day.date === selectedDateKey;
                        const s = day.summary;
                        const hasActivity = s.count > 0;

                        let intensity = 0;
                        if (hasActivity) {
                          if (heatmapMetric === 'workouts') intensity = Math.min(1, s.count / 2);
                          else if (heatmapMetric === 'volume') intensity = Math.min(1, s.volume / 8000);
                          else intensity = Math.min(1, s.durationSec / 3600);
                        }

                        return (
                          <button
                            key={di}
                            onClick={() => setSelectedDateKey(day.date)}
                            title={`${day.date}: ${s.count} workout${s.count !== 1 ? 's' : ''}, ${s.volume.toLocaleString()}${unitLabel}`}
                            aria-label={`${day.date}: ${s.count} workouts`}
                            style={{
                              width: 14, height: 14, borderRadius: 3.5, padding: 0, cursor: 'pointer',
                              background: !hasActivity
                                ? 'var(--bg-input)'
                                : intensity >= 0.75
                                  ? 'var(--accent-green)'
                                  : intensity >= 0.4
                                    ? 'var(--accent-cyan)'
                                    : 'var(--accent-purple)',
                              opacity: !hasActivity ? 0.4 : 0.7 + intensity * 0.3,
                              border: isSelected
                                ? '1.5px solid var(--text-primary)'
                                : isToday
                                  ? '1.5px solid var(--accent-red)'
                                  : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Date Activity Inspector */}
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedDateKey === todayKey ? 'Today' : new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedDaySummary && selectedDaySummary.count > 0
                      ? `${selectedDaySummary.sessions.map(s => s.dayName || s.planName || 'Workout').join(', ')} • ${selectedDaySummary.sets} sets • ${selectedDaySummary.volume.toLocaleString()}${unitLabel}`
                      : 'Rest day — no workouts logged on this date'}
                  </div>
                </div>
                {selectedDaySummary && selectedDaySummary.count > 0 ? (
                  <span className="badge" style={{ background: 'rgba(16,232,154,0.12)', color: 'var(--accent-green)', fontSize: 10, flexShrink: 0 }}>
                    {formatDuration(selectedDaySummary.durationSec)}
                  </span>
                ) : (
                  <button onClick={handleSurpriseWorkout} className="btn-secondary" style={{ padding: '6px 10px', fontSize: 10, minHeight: 30, borderRadius: 8, flexShrink: 0 }}>
                    Train Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Daily Quote */}
      {showDailyQuote !== false && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card" style={{ marginBottom: 20, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, right: 14, opacity: 0.06, fontSize: 48, pointerEvents: 'none' }}>❝</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 6, position: 'relative', zIndex: 1 }}>
            &ldquo;{todayQuote.text}&rdquo;
          </p>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>
            — {todayQuote.author}
          </div>
        </motion.div>
      )}

      {/* Last Workout Summary */}
      {showLastWorkout !== false && lastWorkout && lastWorkout.isComplete && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
          style={{ marginBottom: 20 }}>
          <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>Last Workout</h2>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{lastWorkout.dayName || lastWorkout.planName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {getRelativeTime(lastWorkout.startedAt)}
                </div>
              </div>
              <span className="badge" style={{ background: 'rgba(16,232,154,0.1)', color: 'var(--accent-green)', fontSize: 10 }}>✓ Complete</span>
            </div>
            <div className="responsive-stats-4">
              {[
                { val: lastWorkout.duration > 0 ? formatDuration(lastWorkout.duration) : '-', lbl: 'Duration' },
                { val: lastWorkout.totalSets || '-', lbl: 'Sets' },
                { val: lastWorkout.totalReps || '-', lbl: 'Reps' },
                { val: lastWorkout.totalVolume > 0 ? `${(lastWorkout.totalVolume / 1000).toFixed(1)}k` : '-', lbl: 'Volume' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)' }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Start — Active Plan */}
      {activePlan && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Quick Start</h2>
            <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Zap size={10} /> {activePlan.name}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activePlanDays.map((day, i) => (
              <motion.div key={day.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14 + i * 0.03 }}
                className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', minHeight: 64, padding: '12px 16px' }}>
                <button
                  onClick={() => handleQuickStart(day, 0)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--on-accent-text)', fontFamily: 'var(--font-jetbrains), monospace', flexShrink: 0 }}>
                    D{day.dayNumber}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{day.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{day.exercises.length} exercises • Balanced &amp; equipment-filtered</div>
                  </div>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleQuickStart(day, Math.floor(Math.random() * 50) + 1)}
                    title="Start with varied exercises"
                    className="btn-secondary"
                    style={{ borderRadius: 10, padding: '8px 10px', fontSize: 11, fontWeight: 700, minHeight: 36 }}
                  >
                    <Shuffle size={12} /> Vary
                  </button>
                  <button
                    onClick={() => handleQuickStart(day, 0)}
                    aria-label={`Start ${day.name}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4 }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* No active plan */}
      {!activePlan && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card" style={{ marginBottom: 24, textAlign: 'center', padding: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--gradient-ocean)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Target size={24} color="white" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Active Plan</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Choose a balanced workout program to get started
          </p>
          <button
            className="btn-primary"
            onClick={() => setActiveTab('plans')}
            style={{ maxWidth: 240, margin: '0 auto', minHeight: 46, borderRadius: 14, width: 'auto', padding: '12px 24px' }}
          >
            <Dumbbell size={16} />
            <span>Browse Plans</span>
          </button>
        </motion.div>
      )}

      {/* Feature Cards */}
      {showFeatureCards !== false && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { icon: Dumbbell, label: 'Exercises', count: exerciseCount, suffix: 'in catalog', color: 'var(--accent-red)', tab: 'exercises' as const },
            { icon: BarChart3, label: 'Progress & Body Map', count: stats.totalWorkouts, suffix: 'sessions', color: 'var(--accent-purple)', tab: 'progress' as const },
            { icon: Calendar, label: 'Balanced Plans', count: planCount, suffix: 'programs', color: 'var(--accent-green)', tab: 'plans' as const },
            { icon: Star, label: 'Profile & Tools', count: '', suffix: '24 themes & calculators', color: 'var(--accent-yellow)', tab: 'profile' as const },
          ].map((item, i) => (
            <motion.button key={i} className="card" onClick={() => setActiveTab(item.tab)}
              style={{ padding: 16, textAlign: 'left', cursor: 'pointer', width: '100%', minHeight: 82 }}
              whileTap={{ scale: 0.97 }}>
              <item.icon size={20} color={item.color} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {item.count !== '' ? `${item.count.toLocaleString()} ${item.suffix}` : item.suffix}
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Interactive Recent Activity Feed */}
      {recentSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.slice(0, 6).map((session) => {
              const isExpanded = expandedSessionId === session.id;
              return (
                <div key={session.id} className="card" style={{ padding: 14 }}>
                  <button
                    onClick={() => toggleExpandSession(session)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,232,154,0.08)', border: '1px solid rgba(16,232,154,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Trophy size={16} color="var(--accent-green)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.dayName || session.planName || 'Quick Workout'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {getRelativeTime(session.startedAt)}
                        {session.duration > 0 && ` • ${formatDuration(session.duration)}`}
                        {session.totalSets > 0 && ` • ${session.totalSets} sets`}
                      </div>
                    </div>
                    {session.totalVolume > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>{session.totalVolume.toLocaleString()}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{unitLabel.toUpperCase()}</div>
                      </div>
                    )}
                    {isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
                      >
                        {session.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 8 }}>
                            📝 {session.notes}
                          </div>
                        )}
                        {isLoadingSets ? (
                          <div className="skeleton" style={{ height: 42, width: '100%' }} />
                        ) : (
                          expandedSets.map((ex, i) => (
                            <div key={i} style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', marginBottom: 3 }}>{ex.name}</div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {ex.sets.map((st, si) => (
                                  <span key={si} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                    {st.weight}{unitLabel} × {st.reps} {st.isPR ? '🏆' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
