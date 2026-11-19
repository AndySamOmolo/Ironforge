'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Dumbbell, Calendar, Target, ChevronRight, ChevronDown, Zap,
  Star, BarChart3, Shuffle, Check, Activity,
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

function toLocalDateKey(dateInput: Date | string | number): string {
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

export default function HomePage() {
  const {
    name,
    barWeight,
    dumbbellWeight,
    equipment: userEquipment,
    exerciseVariety,
    showDailyQuote,
    showActivityHeatmap,
    showFeatureCards,
    showLastWorkout,
    unitSystem,
  } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const { setActiveTab } = useUIStore();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [activePlanDays, setActivePlanDays] = useState<WorkoutDay[]>([]);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    weekWorkouts: 0,
    streak: 0,
    bestStreak: 0,
    totalVolume: 0,
    totalDurationSec: 0,
    prsThisMonth: 0,
    activeDays30d: 0,
    weekDurationSec: 0,
    weekSets: 0,
    weekVolume: 0,
    monthVolume: 0,
    monthDurationSec: 0,
  });
  const [exerciseCount, setExerciseCount] = useState(0);
  const [plansCount, setPlansCount] = useState(25);
  const [activityByDate, setActivityByDate] = useState<Map<string, DayActivitySummary>>(new Map());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toLocalDateKey(new Date()));
  const [heatmapMetric, setHeatmapMetric] = useState<'workouts' | 'volume' | 'duration'>('workouts');
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [expandedSets, setExpandedSets] = useState<{ name: string; sets: { weight: number; reps: number; isPR?: boolean }[] }[]>([]);
  const [lastWorkout, setLastWorkout] = useState<WorkoutSession | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [recentExerciseIds, setRecentExerciseIds] = useState<Set<number>>(new Set());

  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const todayQuote = useMemo(() => {
    const day = Math.floor(Date.now() / 86400000) % FITNESS_QUOTES.length;
    return FITNESS_QUOTES[day];
  }, []);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const allSessions = await db.workoutSessions.orderBy('startedAt').reverse().toArray();
      const completedAll = allSessions.filter(s => s.isComplete);
      setRecentSessions(completedAll.slice(0, 10));
      if (completedAll.length > 0) setLastWorkout(completedAll[0]);

      // Start of current week (Sunday, aligned with 16-week Sun-Sat heatmap)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
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

      // Active days & totals in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeDays30d = Array.from(byDate.keys()).filter(k => new Date(`${k}T12:00:00`) >= thirtyDaysAgo).length;
      const monthSessions = completedAll.filter(s => new Date(s.startedAt) >= thirtyDaysAgo);

      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthPRs = await db.personalRecords.where('date').aboveOrEqual(monthAgo).count();

      setStats({
        totalWorkouts: completedAll.length,
        weekWorkouts: weekSessions.length,
        streak,
        bestStreak,
        totalVolume: completedAll.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
        totalDurationSec: completedAll.reduce((sum, s) => sum + (s.duration || 0), 0),
        prsThisMonth: monthPRs,
        activeDays30d,
        weekDurationSec: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        weekSets: weekSessions.reduce((sum, s) => sum + (s.totalSets || 0), 0),
        weekVolume: weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
        monthVolume: monthSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
        monthDurationSec: monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      });

      const totalPlans = await db.workoutPlans.count();
      if (totalPlans > 0) setPlansCount(totalPlans);
      const plans = await db.workoutPlans.filter(p => !!p.isActive).first();
      if (plans) {
        setActivePlan(plans);
        const days = await db.workoutDays.where('planId').equals(plans.id!).sortBy('dayNumber');
        setActivePlanDays(days);
      }

      const [catalog, recentSets] = await Promise.all([
        db.exercises.toArray(),
        db.sets.orderBy('completedAt').reverse().limit(120).toArray(),
      ]);
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
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
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

  // Current week Sun–Sat strip (aligned with 16-week Sun–Sat heatmap)
  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return labels.map((label, idx) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + idx);
      const key = toLocalDateKey(d);
      const summary = activityByDate.get(key);
      return {
        label,
        dayNum: d.getDate(),
        dateKey: key,
        isToday: key === todayKey,
        count: summary?.count || 0,
        volume: summary?.volume || 0,
        durationSec: summary?.durationSec || 0,
        sets: summary?.sets || 0,
      };
    });
  }, [activityByDate, todayKey]);

  // 16-Week Calendar Grid with Month Headers
  const { heatmapWeeks, monthHeaders } = useMemo(() => {
    const weeks: { date: string; monthShort: string; summary: DayActivitySummary }[][] = [];
    const headers: { label: string; weekIndex: number }[] = [];
    const now = new Date();
    // Anchor end of grid to Saturday of the current week so row d=0 is always Sun and d=6 is Sat
    const endSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
    let lastMonth = '';

    for (let w = 15; w >= 0; w--) {
      const week: { date: string; monthShort: string; summary: DayActivitySummary }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(endSaturday);
        date.setDate(endSaturday.getDate() - (w * 7 + (6 - d)));
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
        week.push({ date: key, monthShort, summary });
      }
      const firstDayMonth = week[0].monthShort;
      if (firstDayMonth !== lastMonth) {
        headers.push({ label: firstDayMonth, weekIndex: 15 - w });
        lastMonth = firstDayMonth;
      }
      weeks.push(week);
    }
    return { heatmapWeeks: weeks, monthHeaders: headers };
  }, [activityByDate]);

  const weeklyGoalTarget = activePlan?.daysPerWeek || 4;
  const activeWeekDaysCount = currentWeekDays.filter(d => d.count > 0).length;
  const estWeekCalories = Math.round((stats.weekDurationSec / 60) * 6.5 + stats.weekSets * 11);
  const selectedDaySummary = activityByDate.get(selectedDateKey);

  // Streak ring
  const streakDashOffset = Math.max(0, 251 - (251 * Math.min(stats.streak, 7) / 7));

  const activeDays = activePlanDays;
  const nextUpIdx = activeDays.length > 0 ? stats.totalWorkouts % activeDays.length : 0;

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{greeting()}</div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            <span className="gradient-text">{name}</span>
          </h1>
        </div>
        <button
          onClick={handleSurpriseWorkout}
          className="btn-secondary"
          style={{ padding: '9px 13px', borderRadius: 12, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minHeight: 38 }}
          title="Generate a fresh equipment-matched workout"
        >
          <Shuffle size={13} color="var(--accent-purple)" /> Quick Mix
        </button>
      </motion.div>

      {/* Streak Ring + Stats Row */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        className="hero-gradient" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 86, height: 86, flexShrink: 0 }}>
            <svg width="86" height="86" viewBox="0 0 86 86">
              <circle cx="43" cy="43" r="38" fill="none" stroke="var(--border)" strokeWidth="4" />
              <motion.circle cx="43" cy="43" r="38" fill="none" stroke="var(--accent-red)" strokeWidth="4.5"
                strokeDasharray="251" strokeDashoffset={streakDashOffset} strokeLinecap="round"
                initial={{ strokeDashoffset: 251 }} animate={{ strokeDashoffset: streakDashOffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                transform="rotate(-90 43 43)" style={{ filter: 'drop-shadow(0 0 6px var(--glow-red))' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{stats.streak}</span>
              <span style={{ fontSize: 7.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>Day Streak</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1 }}>
            {[
              { value: `${activeWeekDaysCount}/${weeklyGoalTarget}`, label: 'Week Goal', color: 'var(--accent-purple)' },
              { value: stats.totalWorkouts, label: 'Workouts', color: 'var(--accent-yellow)' },
              { value: stats.totalVolume >= 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}K` : Math.round(stats.totalVolume), label: `Volume ${unitLabel}`, color: 'var(--accent-green)' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
                style={{ textAlign: 'center' }}>
                <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div className="section-label" style={{ marginTop: 4, fontSize: 9 }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Above-the-Fold Active Plan / Onboarding Banner */}
      {!activePlan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="card" style={{ marginBottom: 18, padding: 16, border: '1px solid color-mix(in srgb, var(--accent-red) 28%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-ocean)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Target size={20} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>No Active Plan Selected</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Choose from {plansCount} balanced programs or tap Quick Mix above
              </div>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => setActiveTab('plans')}
            style={{ width: 'auto', minHeight: 38, padding: '8px 14px', fontSize: 11, fontWeight: 800, borderRadius: 10, flexShrink: 0, color: 'var(--text-on-accent)', boxShadow: 'none', textShadow: 'none' }}
          >
            Browse Plans
          </button>
        </motion.div>
      )}

      {/* Upgraded Activity & Consistency Tracker */}
      {showActivityHeatmap !== false && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{ marginBottom: 16 }}>
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
                    padding: '4px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: heatmapMetric === m.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    border: heatmapMetric === m.id ? 'none' : '1px solid var(--border)',
                    color: heatmapMetric === m.id ? 'var(--text-on-accent)' : 'var(--text-muted)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 15, border: '1px solid var(--border-subtle)' }}>
            {/* Current Week Sun-Sat Interactive Tracker (Adapts to Sessions / Volume / Time tab) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {heatmapMetric === 'workouts'
                    ? `This Week: ${activeWeekDaysCount} of ${weeklyGoalTarget} days active`
                    : heatmapMetric === 'volume'
                      ? `This Week Volume: ${stats.weekVolume.toLocaleString()} ${unitLabel}`
                      : `This Week Active Time: ${formatDuration(stats.weekDurationSec)}`}
                </span>
                <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: heatmapMetric === 'volume' ? 'var(--accent-green)' : heatmapMetric === 'duration' ? 'var(--accent-cyan)' : 'var(--accent-orange)' }}>
                  {heatmapMetric === 'workouts'
                    ? `🔥 ~${estWeekCalories.toLocaleString()} kcal`
                    : heatmapMetric === 'volume'
                      ? `🏋️ ${stats.weekSets} sets logged`
                      : `⏱ Avg ${stats.weekWorkouts > 0 ? formatDuration(Math.round(stats.weekDurationSec / stats.weekWorkouts)) : '0m'}/sess`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 10 }}>
                {currentWeekDays.map((d) => {
                  const isActive = d.count > 0;
                  const isSelected = selectedDateKey === d.dateKey;
                  const daySubValue =
                    heatmapMetric === 'workouts'
                      ? (d.count > 0 ? `${d.count}x` : '–')
                      : heatmapMetric === 'volume'
                        ? (d.volume >= 1000 ? `${(d.volume / 1000).toFixed(1)}K` : d.volume > 0 ? `${Math.round(d.volume)}` : `0${unitLabel}`)
                        : (d.durationSec > 0 ? formatDuration(d.durationSec) : '0m');

                  return (
                    <button
                      key={d.dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(d.dateKey)}
                      aria-label={`${d.label} ${d.dateKey}: ${d.count} workout${d.count !== 1 ? 's' : ''}`}
                      style={{
                        padding: '7px 2px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                        background: isActive ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--bg-input)',
                        border: isSelected
                          ? '1.5px solid var(--accent-purple)'
                          : d.isToday
                            ? '1.5px solid var(--accent-red)'
                            : isActive
                              ? '1px solid color-mix(in srgb, var(--accent-green) 35%, transparent)'
                              : '1px solid var(--border-subtle)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: d.isToday ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                        {d.label}
                      </span>
                      <div style={{
                        width: 23, height: 23, borderRadius: '50%',
                        background: isActive ? 'var(--accent-green)' : 'var(--bg-subtle-fill)',
                        color: isActive ? 'var(--text-on-mint)' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10.5, fontWeight: 800,
                      }}>
                        {isActive ? <Check size={12} strokeWidth={3} /> : d.dayNum}
                      </div>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 8.5,
                          fontWeight: 700,
                          color: isActive
                            ? heatmapMetric === 'volume'
                              ? 'var(--accent-green)'
                              : heatmapMetric === 'duration'
                                ? 'var(--accent-cyan)'
                                : 'var(--text-primary)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {daySubValue}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic 4-Tile Metrics Strip (Switches immediately with Sessions / Volume / Time) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(heatmapMetric === 'volume'
                  ? [
                      { label: `Week ${unitLabel.toUpperCase()}`, value: stats.weekVolume >= 1000 ? `${(stats.weekVolume / 1000).toFixed(1)}K` : `${Math.round(stats.weekVolume)}`, color: 'var(--accent-green)' },
                      { label: `30D ${unitLabel.toUpperCase()}`, value: stats.monthVolume >= 1000 ? `${(stats.monthVolume / 1000).toFixed(1)}K` : `${Math.round(stats.monthVolume)}`, color: 'var(--accent-cyan)' },
                      { label: 'Avg / Lift', value: stats.totalWorkouts > 0 ? (stats.totalVolume / stats.totalWorkouts >= 1000 ? `${(stats.totalVolume / stats.totalWorkouts / 1000).toFixed(1)}K` : `${Math.round(stats.totalVolume / stats.totalWorkouts)}`) : '0', color: 'var(--accent-purple)' },
                      { label: `Total ${unitLabel.toUpperCase()}`, value: stats.totalVolume >= 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}K` : `${Math.round(stats.totalVolume)}`, color: 'var(--accent-yellow)' },
                    ]
                  : heatmapMetric === 'duration'
                    ? [
                        { label: 'Week Time', value: stats.weekDurationSec > 0 ? formatDuration(stats.weekDurationSec) : '0m', color: 'var(--accent-cyan)' },
                        { label: '30D Time', value: stats.monthDurationSec > 0 ? formatDuration(stats.monthDurationSec) : '0m', color: 'var(--accent-green)' },
                        { label: 'Avg Length', value: stats.totalWorkouts > 0 ? formatDuration(Math.round(stats.totalDurationSec / stats.totalWorkouts)) : '0m', color: 'var(--accent-purple)' },
                        { label: 'Total Time', value: stats.totalDurationSec > 0 ? formatDuration(stats.totalDurationSec) : '0m', color: 'var(--accent-yellow)' },
                      ]
                    : [
                        { label: 'Week Goal', value: `${activeWeekDaysCount}/${weeklyGoalTarget}`, color: 'var(--accent-cyan)' },
                        { label: 'Week Sets', value: stats.weekSets.toString(), color: 'var(--accent-purple)' },
                        { label: '30D Active', value: `${stats.activeDays30d}d`, color: 'var(--accent-green)' },
                        { label: 'Best Streak', value: `${stats.bestStreak}d`, color: 'var(--accent-yellow)' },
                      ]
                ).map((m, idx) => (
                  <div key={idx} style={{ padding: '7px 4px', background: 'var(--bg-input)', borderRadius: 9, textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <div className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 16-Week Interactive Heatmap */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, paddingLeft: 26, paddingRight: 8 }}>
                  {monthHeaders.map((mh, idx) => (
                    <span key={idx} style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 700 }}>{mh.label}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                  <span>
                    {heatmapMetric === 'workouts' ? '0' : heatmapMetric === 'volume' ? `0${unitLabel}` : '0m'}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bg-track)', border: '1px solid var(--border-subtle)' }} />
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-purple)' }} />
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-cyan)' }} />
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-green)' }} />
                  <span>
                    {heatmapMetric === 'workouts' ? '2+ sess' : heatmapMetric === 'volume' ? `8K+ ${unitLabel}` : '60m+'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', alignItems: 'center', paddingRight: 2, fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1 }}>
                  <span>Sun</span>
                  <span />
                  <span>Tue</span>
                  <span />
                  <span>Thu</span>
                  <span />
                  <span>Sat</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))', gap: 3.5, flex: 1 }}>
                  {heatmapWeeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                      {week.map((day, di) => {
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

                        const cellBg = !hasActivity
                          ? 'var(--bg-track)'
                          : intensity >= 0.75
                            ? 'var(--accent-green)'
                            : intensity >= 0.4
                              ? 'var(--accent-cyan)'
                              : 'var(--accent-purple)';

                        return (
                          <button
                            key={di}
                            type="button"
                            className="activity-heatmap-cell"
                            onClick={() => setSelectedDateKey(day.date)}
                            aria-label={`${day.date}: ${s.count} workout${s.count !== 1 ? 's' : ''}, ${s.volume.toLocaleString()} ${unitLabel}`}
                            title={`${day.date}: ${s.count} workout${s.count !== 1 ? 's' : ''}, ${s.volume.toLocaleString()} ${unitLabel}`}
                            style={{
                              background: cellBg,
                              border: isSelected
                                ? '1.5px solid var(--text-primary)'
                                : isToday
                                  ? '1.5px solid var(--accent-red)'
                                  : hasActivity
                                    ? '1px solid var(--border-bright)'
                                    : '1px solid var(--border-subtle)',
                              boxShadow: isSelected
                                ? '0 0 8px var(--glow-purple)'
                                : hasActivity && intensity >= 0.75
                                  ? '0 0 6px var(--glow-green)'
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
              <div style={{ marginTop: 11, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>
                      {selectedDateKey === todayKey ? 'Today' : new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="badge" style={{ fontSize: 9, padding: '1px 7px', background: 'var(--bg-glass)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)' }}>
                      {heatmapMetric === 'workouts' ? 'Sessions View' : heatmapMetric === 'volume' ? 'Volume View' : 'Time View'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selectedDaySummary && selectedDaySummary.count > 0
                      ? heatmapMetric === 'volume'
                        ? `Volume: ${selectedDaySummary.volume.toLocaleString()} ${unitLabel} across ${selectedDaySummary.sets} sets (${selectedDaySummary.sessions.map(s => s.dayName || s.planName || 'Workout').join(', ')})`
                        : heatmapMetric === 'duration'
                          ? `Active Time: ${formatDuration(selectedDaySummary.durationSec)} across ${selectedDaySummary.count} session${selectedDaySummary.count !== 1 ? 's' : ''} (${selectedDaySummary.sets} sets)`
                          : `${selectedDaySummary.sessions.map(s => s.dayName || s.planName || 'Workout').join(', ')} • ${selectedDaySummary.sets} sets • ${selectedDaySummary.volume.toLocaleString()} ${unitLabel}`
                      : heatmapMetric === 'volume'
                        ? `0 ${unitLabel} lifted on this date — tap Train Now to log volume`
                        : heatmapMetric === 'duration'
                          ? '0m active training time on this date — tap Train Now to start'
                          : 'Rest day — no workouts logged on this date'}
                  </div>
                </div>
                {selectedDaySummary && selectedDaySummary.count > 0 ? (
                  <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-green) 14%, transparent)', color: 'var(--accent-green)', fontSize: 10, fontWeight: 800 }}>
                    {heatmapMetric === 'volume'
                      ? `${selectedDaySummary.volume.toLocaleString()} ${unitLabel}`
                      : heatmapMetric === 'duration'
                        ? formatDuration(selectedDaySummary.durationSec)
                        : `${selectedDaySummary.count} sess`}
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
          className="card" style={{ marginBottom: 20, padding: '16px 18px', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, right: 14, opacity: 0.06, fontSize: 48 }}>❝</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 6, position: 'relative', zIndex: 1 }}>
            &quot;{todayQuote.text}&quot;
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
          <div className="card" style={{ padding: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{lastWorkout.dayName || lastWorkout.planName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {getRelativeTime(lastWorkout.startedAt)}
                </div>
              </div>
              <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', color: 'var(--accent-green)', fontSize: 10 }}>✓ Complete</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { val: lastWorkout.duration > 0 ? formatDuration(lastWorkout.duration) : '-', lbl: 'Duration' },
                { val: lastWorkout.totalSets || '-', lbl: 'Sets' },
                { val: lastWorkout.totalReps || '-', lbl: 'Reps' },
                { val: lastWorkout.totalVolume >= 1000 ? `${(lastWorkout.totalVolume / 1000).toFixed(1)}K` : lastWorkout.totalVolume > 0 ? `${Math.round(lastWorkout.totalVolume)}` : '-', lbl: 'Volume' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-glass)', borderRadius: 8 }}>
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
          style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Quick Start</h2>
            <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)', color: 'var(--accent-purple)', border: '1px solid color-mix(in srgb, var(--accent-purple) 20%, transparent)' }}>
              <Zap size={10} /> {activePlan.name}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeDays.map((day, i) => {
              const isNextUp = i === nextUpIdx;
              return (
                <motion.div key={day.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                    border: isNextUp ? '1.5px solid color-mix(in srgb, var(--accent-green) 45%, transparent)' : '1px solid var(--border-subtle)',
                    minHeight: 64, padding: '12px 16px',
                  }}>
                  <button
                    onClick={() => handleQuickStart(day, 0)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  >
                    <div className={`day-badge ${isNextUp ? 'day-badge--next' : ''}`}>
                      <span className="day-badge__eyebrow">DAY</span>
                      <span className="day-badge__num">{String(day.dayNumber).padStart(2, '0')}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.25 }}>
                        <span>{day.name}</span>
                        {isNextUp && (
                          <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: 'var(--accent-green)', border: '1px solid color-mix(in srgb, var(--accent-green) 35%, transparent)', fontSize: 9, fontWeight: 800, letterSpacing: 0.5, padding: '2px 7px' }}>
                            NEXT UP
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{day.exercises.length} exercises • Equipment matched</div>
                    </div>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button
                      onClick={() => handleQuickStart(day, Math.floor(Math.random() * 50) + 1)}
                      title="Start with varied exercises"
                      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)', borderRadius: 10, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Shuffle size={12} /> Vary
                    </button>
                    <button
                      onClick={() => handleQuickStart(day, 0)}
                      aria-label={`Start ${day.name}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Feature Cards */}
      {showFeatureCards !== false && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { icon: Dumbbell, label: 'Exercises', count: exerciseCount, color: 'var(--accent-red)', tab: 'exercises' as const },
            { icon: BarChart3, label: 'Progress & Body Map', count: stats.totalWorkouts, color: 'var(--accent-purple)', tab: 'progress' as const },
            { icon: Calendar, label: 'Balanced Plans', count: String(plansCount), color: 'var(--accent-green)', tab: 'plans' as const },
            { icon: Star, label: 'Profile & Tools', count: '', color: 'var(--accent-yellow)', tab: 'profile' as const },
          ].map((item, i) => (
            <motion.button key={i} className="card" onClick={() => setActiveTab(item.tab)}
              style={{ padding: 16, textAlign: 'left', cursor: 'pointer', width: '100%', border: '1px solid var(--border-subtle)', minHeight: 80 }}
              whileTap={{ scale: 0.97 }}>
              <item.icon size={20} color={item.color} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</div>
              {item.count !== '' && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.count} {item.label === 'Exercises' ? 'in catalog' : item.label.startsWith('Progress') ? 'sessions' : 'programs'}</div>}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Interactive Recent Activity Feed */}
      {recentSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                        style={{ overflow: 'hidden', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}
                      >
                        {session.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 8 }}>
                            📝 {session.notes}
                          </div>
                        )}
                        {expandedSets.map((ex, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', marginBottom: 3 }}>{ex.name}</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {ex.sets.map((st, si) => (
                                <span key={si} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                  {st.weight}{unitLabel} × {st.reps} {st.isPR ? '🏆' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
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
