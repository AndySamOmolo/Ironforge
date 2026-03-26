'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, Dumbbell, Calendar, TrendingUp, Clock, Target, ChevronRight, Zap, Star, BarChart3 } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUIStore } from '@/lib/store/uiStore';
import type { WorkoutSession, WorkoutPlan, WorkoutDay } from '@/lib/types';

export default function HomePage() {
  const { name } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const { setActiveTab } = useUIStore();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [activePlanDays, setActivePlanDays] = useState<WorkoutDay[]>([]);
  const [stats, setStats] = useState({ totalWorkouts: 0, weekWorkouts: 0, streak: 0, totalVolume: 0 });
  const [exerciseCount, setExerciseCount] = useState(0);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const sessions = await db.workoutSessions.orderBy('startedAt').reverse().limit(5).toArray();
      setRecentSessions(sessions);

      const allSessions = await db.workoutSessions.where('isComplete').equals(1).toArray();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekSessions = allSessions.filter(s => s.startedAt >= weekAgo);

      // Calculate streak
      let streak = 0;
      const sessionDates = new Set(allSessions.filter(s => s.isComplete).map(s => new Date(s.startedAt).toDateString()));
      const d = new Date();
      while (sessionDates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }

      setStats({
        totalWorkouts: allSessions.length,
        weekWorkouts: weekSessions.length,
        streak,
        totalVolume: allSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
      });

      const plans = await db.workoutPlans.where('isActive').equals(1).first();
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickStart = async (day: WorkoutDay) => {
    if (!activePlan) return;
    const exercises = await Promise.all(day.exercises.map(async (ex) => {
      const dbEx = await db.exercises.where('name').equalsIgnoreCase(ex.exerciseName).first();
      return {
        exerciseId: dbEx?.id || 0,
        exerciseName: ex.exerciseName,
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

    const sessionId = await db.workoutSessions.add({
      planId: activePlan.id, dayId: day.id, planName: activePlan.name, dayName: day.name,
      startedAt: new Date(), duration: 0, totalVolume: 0, totalSets: 0, totalReps: 0, isComplete: false,
    });

    startWorkout(exercises, activePlan.name, day.name, sessionId);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{greeting()}</div>
        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>
          <span className="gradient-text">{name}</span>
        </h1>
      </motion.div>

      {/* Hero Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="hero-gradient" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { icon: Flame, value: stats.streak, label: 'Streak', color: 'var(--accent-red)', suffix: '🔥' },
            { icon: Calendar, value: stats.weekWorkouts, label: 'This Week', color: 'var(--accent-purple)' },
            { icon: Trophy, value: stats.totalWorkouts, label: 'Workouts', color: 'var(--accent-yellow)' },
            { icon: TrendingUp, value: stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(0)}k` : stats.totalVolume, label: 'Volume kg', color: 'var(--accent-green)' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
              style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {stat.value}{stat.suffix || ''}
              </div>
              <div className="section-label" style={{ marginTop: 4, fontSize: 9 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Start — Active Plan */}
      {activePlan && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
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
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
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
          <button className="btn-primary" onClick={() => setActiveTab('plans')} style={{ maxWidth: 260, margin: '0 auto' }}>
            <Dumbbell size={16} /> Browse Plans
          </button>
        </motion.div>
      )}

      {/* Feature Cards */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { icon: Dumbbell, label: 'Exercises', count: exerciseCount, color: 'var(--accent-red)', tab: 'exercises' as const },
          { icon: BarChart3, label: 'Progress', count: stats.totalWorkouts, color: 'var(--accent-purple)', tab: 'progress' as const },
          { icon: Calendar, label: 'Plans', count: '12+', color: 'var(--accent-green)', tab: 'plans' as const },
          { icon: Star, label: 'Profile', count: '', color: 'var(--accent-yellow)', tab: 'profile' as const },
        ].map((item, i) => (
          <motion.button key={i} className="card" onClick={() => setActiveTab(item.tab)}
            style={{ padding: 16, textAlign: 'left', cursor: 'pointer', width: '100%', border: '1px solid var(--border-subtle)' }}
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
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' }}>Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.slice(0, 5).map((session, i) => (
              <div key={session.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: session.isComplete ? 'rgba(16,232,154,0.08)' : 'rgba(255,61,90,0.08)', border: `1px solid ${session.isComplete ? 'rgba(16,232,154,0.2)' : 'rgba(255,61,90,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {session.isComplete ? <Trophy size={16} color="var(--accent-green)" /> : <Clock size={16} color="var(--accent-red)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session.dayName || session.planName || 'Quick Workout'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(session.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
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
