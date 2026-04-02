'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, Dumbbell, Calendar, TrendingUp, Clock, Target, ChevronRight, Zap, Star, BarChart3, Quote } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUIStore } from '@/lib/store/uiStore';
import type { WorkoutSession, WorkoutPlan, WorkoutDay } from '@/lib/types';

const FITNESS_QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Gandhi" },
  { text: "The iron never lies to you. Two hundred pounds is always two hundred pounds.", author: "Henry Rollins" },
  { text: "No man has the right to be an amateur in the matter of physical training.", author: "Socrates" },
  { text: "The resistance that you fight physically in the gym strengthens you character.", author: "Arnold Schwarzenegger" },
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
  { text: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { text: "It never gets easier. You just get stronger.", author: "Unknown" },
  { text: "Sweat is just fat crying.", author: "Unknown" },
  { text: "If it doesn't challenge you, it doesn't change you.", author: "Fred DeVito" },
  { text: "Push yourself because no one else is going to do it for you.", author: "Unknown" },
  { text: "You don't have to be extreme, just consistent.", author: "Unknown" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "Once you see results, it becomes an addiction.", author: "Unknown" },
  { text: "The real workout starts when you want to stop.", author: "Ronnie Coleman" },
  { text: "Fall in love with taking care of yourself.", author: "Unknown" },
];

export default function HomePage() {
  const { name } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const { setActiveTab } = useUIStore();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [activePlanDays, setActivePlanDays] = useState<WorkoutDay[]>([]);
  const [stats, setStats] = useState({ totalWorkouts: 0, weekWorkouts: 0, streak: 0, totalVolume: 0, prsThisMonth: 0 });
  const [exerciseCount, setExerciseCount] = useState(0);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [lastWorkout, setLastWorkout] = useState<WorkoutSession | null>(null);

  const todayQuote = useMemo(() => {
    const day = Math.floor(Date.now() / 86400000) % FITNESS_QUOTES.length;
    return FITNESS_QUOTES[day];
  }, []);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const sessions = await db.workoutSessions.orderBy('startedAt').reverse().limit(10).toArray();
      // Only show completed sessions in recent activity
      const completedSessions = sessions.filter(s => s.isComplete);
      setRecentSessions(completedSessions);
      if (completedSessions.length > 0) setLastWorkout(completedSessions[0]);

      const allSessions = await db.workoutSessions.toArray();
      const completedAll = allSessions.filter(s => s.isComplete);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekSessions = completedAll.filter(s => s.startedAt >= weekAgo);

      // Calculate streak
      let streak = 0;
      const sessionDates = new Set(completedAll.map(s => new Date(s.startedAt).toDateString()));
      const d = new Date();
      // Start from today - if today has a workout, count it
      while (sessionDates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
      // If no workout today, check if yesterday was the last workout day
      if (streak === 0) {
        d.setDate(d.getDate() - 1);
        while (sessionDates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
      }

      // PRs this month
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthPRs = await db.personalRecords.filter(pr => new Date(pr.date) >= monthAgo).count();

      setStats({
        totalWorkouts: completedAll.length,
        weekWorkouts: weekSessions.length,
        streak,
        totalVolume: completedAll.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
        prsThisMonth: monthPRs,
      });

      // Heatmap: 16 weeks of workout activity (only completed)
      const heatmap = new Map<string, number>();
      completedAll.forEach(s => {
        const date = new Date(s.startedAt).toISOString().split('T')[0];
        heatmap.set(date, (heatmap.get(date) || 0) + 1);
      });
      setHeatmapData(heatmap);

      const plans = await db.workoutPlans.filter(p => !!p.isActive).first();
      if (plans) {
        setActivePlan(plans);
        const days = await db.workoutDays.where('planId').equals(plans.id!).sortBy('dayNumber');
        setActivePlanDays(days);
      }

      const count = await db.exercises.count();
      setExerciseCount(count);
    } catch {}
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickStart = async (day: WorkoutDay) => {
    if (!activePlan) return;

    // Load saved swaps
    let savedSwaps: Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }> = {};
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

    const exercises = await Promise.all(day.exercises.map(async (ex) => {
      // Check for saved swap
      const swap = savedSwaps[ex.exerciseName.toLowerCase()];
      if (swap) {
        const swappedEx = await db.exercises.get(swap.newExerciseId);
        if (swappedEx) {
          return {
            exerciseId: swappedEx.id || 0,
            exerciseName: swappedEx.name,
            imageUrl: swappedEx.gifUrl || swappedEx.imageUrls?.[0] || undefined,
            gifUrl: swappedEx.gifUrl || undefined,
            sets: Array.from({ length: ex.sets }, (_, i) => ({
              setNumber: i + 1, setType: ex.setType as any, weight: ex.weight || 0,
              reps: typeof ex.reps === 'number' ? ex.reps : 0, targetWeight: ex.weight || 0,
              targetReps: typeof ex.reps === 'number' ? ex.reps : 0, isComplete: false,
            })),
            targetSets: ex.sets, targetReps: ex.reps, restTime: ex.restTime, isComplete: false,
          };
        }
      }

      let dbEx = await db.exercises.where('name').equalsIgnoreCase(ex.exerciseName).first();
      if (!dbEx) {
        const keywords = ex.exerciseName.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        const candidates = await db.exercises.filter(e => {
          const eName = e.name.toLowerCase();
          return keywords.every(kw => eName.includes(kw)) || keywords.filter(kw => eName.includes(kw)).length >= Math.max(1, keywords.length - 1);
        }).limit(5).toArray();
        if (candidates.length > 0) {
          dbEx = candidates.sort((a, b) => Math.abs(a.name.length - ex.exerciseName.length) - Math.abs(b.name.length - ex.exerciseName.length))[0];
        }
      }
      return {
        exerciseId: dbEx?.id || 0,
        exerciseName: dbEx?.name || ex.exerciseName,
        imageUrl: dbEx?.gifUrl || dbEx?.imageUrls?.[0] || undefined,
        gifUrl: dbEx?.gifUrl || undefined,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          setNumber: i + 1, setType: ex.setType as any, weight: ex.weight || 0,
          reps: typeof ex.reps === 'number' ? ex.reps : 0, targetWeight: ex.weight || 0,
          targetReps: typeof ex.reps === 'number' ? ex.reps : 0, isComplete: false,
        })),
        targetSets: ex.sets, targetReps: ex.reps, restTime: ex.restTime, isComplete: false,
      };
    }));

    await db.workoutSessions.add({
      planId: activePlan.id, dayId: day.id, planName: activePlan.name, dayName: day.name,
      startedAt: new Date(), duration: 0, totalVolume: 0, totalSets: 0, totalReps: 0, isComplete: false,
    });

    startWorkout(activePlan.name, day.name, exercises);
  };

  // Generate heatmap grid (last 16 weeks)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const heatmapWeeks = useMemo(() => {
    const weeks: { date: string; count: number }[][] = [];
    const now = new Date();
    for (let w = 15; w >= 0; w--) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = date.toISOString().split('T')[0];
        week.push({ date: key, count: heatmapData.get(key) || 0 });
      }
      weeks.push(week);
    }
    return weeks;
  }, [heatmapData]);

  // Streak ring
  const streakDashOffset = Math.max(0, 251 - (251 * Math.min(stats.streak, 7) / 7));

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{greeting()}</div>
        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>
          <span className="gradient-text">{name}</span>
        </h1>
      </motion.div>

      {/* Streak Ring + Stats Row */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="hero-gradient" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Animated Streak Ring SVG */}
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
              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Day{stats.streak !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1 }}>
            {[
              { value: stats.weekWorkouts, label: 'This Week', color: 'var(--accent-purple)' },
              { value: stats.totalWorkouts, label: 'Total', color: 'var(--accent-yellow)' },
              { value: stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(0)}k` : stats.totalVolume, label: 'Volume kg', color: 'var(--accent-green)' },
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

      {/* Daily Quote */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="card" style={{ marginBottom: 20, padding: '16px 18px', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 10, right: 14, opacity: 0.06, fontSize: 48 }}>❝</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 6, position: 'relative', zIndex: 1 }}>
          &quot;{todayQuote.text}&quot;
        </p>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>
          — {todayQuote.author}
        </div>
      </motion.div>

      {/* Last Workout Summary */}
      {lastWorkout && lastWorkout.isComplete && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
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
              <span className="badge" style={{ background: 'rgba(16,232,154,0.08)', color: 'var(--accent-green)', fontSize: 10 }}>✓ Complete</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { val: lastWorkout.duration > 0 ? formatDuration(lastWorkout.duration) : '-', lbl: 'Duration' },
                { val: lastWorkout.totalSets || '-', lbl: 'Sets' },
                { val: lastWorkout.totalReps || '-', lbl: 'Reps' },
                { val: lastWorkout.totalVolume > 0 ? `${(lastWorkout.totalVolume / 1000).toFixed(1)}k` : '-', lbl: 'Volume' },
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
          style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Quick Start</h2>
            <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Zap size={10} /> {activePlan.name}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activePlanDays.map((day, i) => (
              <motion.button key={day.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                className="card" onClick={() => handleQuickStart(day)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid var(--border-subtle)', minHeight: 64 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'white', fontFamily: "'JetBrains Mono'" }}>
                    D{day.dayNumber}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{day.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{day.exercises.length} exercises</div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </motion.button>
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
            Choose a workout program to get started
          </p>
          <button className="btn-primary btn-high-contrast" onClick={() => setActiveTab('plans')} style={{ maxWidth: 260, margin: '0 auto', minHeight: 48, borderRadius: 14, fontSize: 15, fontWeight: 800 }}>
            <Dumbbell size={16} /> Browse Plans
          </button>
        </motion.div>
      )}

      {/* Workout Heatmap */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        style={{ marginBottom: 24 }}>
        <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>Activity</h2>
        <div className="card" style={{ padding: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((day, di) => {
                  const isToday = day.date === today;
                  return (
                    <div key={di} title={`${day.date}: ${day.count} workout${day.count !== 1 ? 's' : ''}`}
                      style={{
                        width: 14, height: 14, borderRadius: 3,
                        background: day.count === 0 ? 'var(--bg-glass)' : day.count === 1 ? 'var(--accent-green)' : day.count >= 2 ? 'var(--accent-red)' : 'var(--accent-yellow)',
                        opacity: day.count === 0 ? 0.3 : 0.6 + Math.min(day.count * 0.2, 0.4),
                        border: isToday ? '1.5px solid var(--accent-purple)' : 'none',
                        boxShadow: isToday ? '0 0 4px var(--glow-purple)' : 'none',
                      }} />
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>16 weeks ago</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Less</span>
              {[0.3, 0.5, 0.7, 1].map((o, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? 'var(--bg-glass)' : 'var(--accent-green)', opacity: o }} />
              ))}
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>More</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Feature Cards */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { icon: Dumbbell, label: 'Exercises', count: exerciseCount, color: 'var(--accent-red)', tab: 'exercises' as const },
          { icon: BarChart3, label: 'Progress', count: stats.totalWorkouts, color: 'var(--accent-purple)', tab: 'progress' as const },
          { icon: Calendar, label: 'Plans', count: '12+', color: 'var(--accent-green)', tab: 'plans' as const },
          { icon: Star, label: 'Profile', count: '', color: 'var(--accent-yellow)', tab: 'profile' as const },
        ].map((item, i) => (
          <motion.button key={i} className="card" onClick={() => setActiveTab(item.tab)}
            style={{ padding: 16, textAlign: 'left', cursor: 'pointer', width: '100%', border: '1px solid var(--border-subtle)', minHeight: 80 }}
            whileTap={{ scale: 0.97 }}>
            <item.icon size={20} color={item.color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</div>
            {item.count && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.count} {item.label === 'Exercises' ? 'with GIFs' : item.label === 'Progress' ? 'sessions' : 'programs'}</div>}
          </motion.button>
        ))}
      </motion.div>

      {/* Recent Workouts */}
      {recentSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.slice(0, 5).map((session) => (
              <div key={session.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 }}>
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
                  </div>
                </div>
                {session.totalVolume > 0 && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>{session.totalVolume.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>KG</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
