'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/db';
import { useUserStore } from '@/lib/store/userStore';
import { useUIStore } from '@/lib/store/uiStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { WorkoutPlan, WorkoutDay, WorkoutSession, PersonalRecord } from '@/lib/types';
import { Play, Flame, Trophy, Calendar, Clock, ChevronRight, Dumbbell, Sparkles, Timer, RotateCcw, Pause, Scale, Droplets, Plus, Minus } from 'lucide-react';
import { buildResolvedActiveExercises, ensureStarterPlan } from '@/lib/utils/exerciseResolver';

export default function HomePage() {
  const { profile, streak, setStreak } = useUserStore();
  const { setCurrentTab } = useUIStore();
  const { startWorkout, isActive: workoutIsActive, isMinimized: workoutIsMinimized, resumeWorkout } = useWorkoutStore();
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [planDays, setPlanDays] = useState<WorkoutDay[]>([]);
  const [plansCount, setPlansCount] = useState<number>(19);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [nextDayIndex, setNextDayIndex] = useState(0);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [selectedActivityDay, setSelectedActivityDay] = useState<{ date: string; count: number; volume: number } | null>(null);

  // Daily Check-in state (Body Weight & Hydration)
  const [todayWeight, setTodayWeight] = useState<string>('');
  const [weightSavedMsg, setWeightSavedMsg] = useState<string>('');
  const [waterGlasses, setWaterGlasses] = useState<number>(0);

  // Standalone Gym Timer & Stopwatch state
  const [clockMode, setClockMode] = useState<'timer' | 'stopwatch'>('timer');
  const [timerPreset, setTimerPreset] = useState<number>(90);
  const [timerRemaining, setTimerRemaining] = useState<number>(90);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [stopwatchElapsed, setStopwatchElapsed] = useState<number>(0);
  const [stopwatchRunning, setStopwatchRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([180, 90, 180]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const interval = setInterval(() => {
      setStopwatchElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  const loadData = useCallback(async () => {
    const totalPlans = await db.workoutPlans.count();
    if (totalPlans > 0) setPlansCount(totalPlans);

    const plans = await db.workoutPlans.toArray();
    const active = plans.find((p) => p.isActive) || null;
    setActivePlan(active);
    if (active?.id) {
      const days = await db.workoutDays.where('planId').equals(active.id).sortBy('dayNumber');
      setPlanDays(days);
      const lastSession = await db.workoutSessions.where('planId').equals(active.id).last();
      if (lastSession && days.length > 0) {
        const lastIdx = days.findIndex((d) => d.id === lastSession.dayId);
        setNextDayIndex((lastIdx + 1) % days.length);
      } else {
        setNextDayIndex(0);
      }
    } else {
      setPlanDays([]);
    }

    const sessions = await db.workoutSessions.orderBy('startTime').reverse().limit(10).toArray();
    setRecentSessions(sessions);

    const allSess = await db.workoutSessions.toArray();
    setAllSessions(allSess);

    // Current week (Monday start)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = allSess.filter((s) => new Date(s.startTime) >= weekStart && s.completed);
    setWeekWorkouts(thisWeek.length);

    // Streak calculation
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const nextDate = new Date(checkDate);
      nextDate.setDate(checkDate.getDate() + 1);
      const has = allSess.some((s) => {
        const st = new Date(s.startTime);
        return st >= checkDate && st < nextDate && s.completed;
      });
      if (has) currentStreak++;
      else if (i > 0) break;
    }
    setStreak(currentStreak);

    const records = await db.personalRecords.orderBy('achievedAt').reverse().limit(5).toArray();
    setPRs(records);

    // Load today's weight & hydration
    const todayKey = new Date().toISOString().split('T')[0];
    const latestMetric = await db.bodyMetrics.orderBy('recordedAt').last();
    if (latestMetric?.weight) {
      setTodayWeight(String(latestMetric.weight));
    }
    if (typeof window !== 'undefined') {
      const savedWater = localStorage.getItem(`ironforge-water-${todayKey}`);
      setWaterGlasses(savedWater ? parseInt(savedWater, 10) || 0 : 0);
    }
  }, [setStreak]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTodayWeight = async () => {
    const val = parseFloat(todayWeight);
    if (!val || val <= 0) return;
    await db.bodyMetrics.add({ weight: val, recordedAt: new Date() });
    setWeightSavedMsg(`Logged ${val} ${profile.weightUnit}`);
    setTimeout(() => setWeightSavedMsg(''), 2500);
  };

  const handleAdjustWater = (delta: number) => {
    const todayKey = new Date().toISOString().split('T')[0];
    const next = Math.max(0, Math.min(20, waterGlasses + delta));
    setWaterGlasses(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ironforge-water-${todayKey}`, String(next));
    }
  };

  const handleStartNextWorkout = async () => {
    let targetPlan = activePlan;
    let targetDays = planDays;

    if (!targetPlan) {
      const starter = await ensureStarterPlan();
      targetPlan = starter.plan;
      targetDays = starter.days;
      setActivePlan(starter.plan);
      setPlanDays(starter.days);
    }

    if (targetPlan && targetDays.length > 0) {
      const day = targetDays[nextDayIndex] || targetDays[0];
      const activeExercises = await buildResolvedActiveExercises(day.exercises);
      startWorkout(targetPlan.id!, day.id!, `${targetPlan.name} — ${day.name}`, activeExercises);
    }
  };

  const handleQuickWorkout = () => {
    startWorkout(0, 0, 'Quick Workout', []);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const m = Math.max(1, Math.round(seconds / 60));
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const nextDay = planDays[nextDayIndex];
  const streakGoal = profile.weeklyGoal || 4;
  const streakPct = Math.min(1, weekWorkouts / streakGoal);

  return (
    <div className="page-container">
      {/* Greeting & Streak Ring */}
      <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ minWidth: 0, paddingRight: 12 }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{getGreeting()}</p>
          <h1 className="page-title" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</h1>
        </div>
        <div
          className="streak-ring"
          title={`${streak} day workout streak (${weekWorkouts}/${streakGoal} weekly goal)`}
          style={{ flexShrink: 0, width: 64, height: 64 }}
        >
          <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="26" fill="none" stroke="url(#streakGrad)" strokeWidth="4"
              strokeDasharray={`${streakPct * 163.36} 163.36`} strokeLinecap="round"
            />
            <defs>
              <linearGradient id="streakGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Flame size={13} color="#f59e0b" />
              <span className="num" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{streak}</span>
            </div>
            <span style={{ fontSize: '0.46rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginTop: 2 }}>STREAK</span>
          </div>
        </div>
      </div>

      {/* Primary Hero: Active Plan Quick Start OR Choose Plan Onboarding (Placed Above the Fold) */}
      {activePlan && nextDay ? (
        <div className="card-Featured animate-in stagger-1" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative', zIndex: 1 }}>
            <div>
              <span className="badge badge-accent" style={{ marginBottom: 8, display: 'inline-flex' }}>
                <Sparkles size={10} /> Next Up • Day {nextDayIndex + 1} of {planDays.length}
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{nextDay.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 2 }}>{activePlan.name}</p>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: 600 }}>
              {nextDay.exercises.length} exercises
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16, position: 'relative', zIndex: 1 }}>
            {nextDay.exercises.slice(0, 4).map((ex, i) => (
              <span key={i} style={{
                background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 'var(--radius-full)',
                fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.04)',
              }}>{ex.exerciseName}</span>
            ))}
            {nextDay.exercises.length > 4 && (
              <span style={{
                background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 'var(--radius-full)',
                fontSize: '0.68rem', color: 'var(--accent-secondary)', fontWeight: 600,
              }}>+{nextDay.exercises.length - 4} more</span>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={workoutIsActive && workoutIsMinimized ? resumeWorkout : handleStartNextWorkout}
            style={{ width: '100%', padding: '13px', fontSize: '0.9rem', position: 'relative', zIndex: 1 }}
          >
            <Play size={17} fill="white" /> {workoutIsActive && workoutIsMinimized ? 'Resume Active Workout' : 'Start Workout'}
          </button>
        </div>
      ) : (
        <div className="card-Featured animate-in stagger-1" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-lg)',
              background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Dumbbell size={22} color="var(--accent-primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <span className="badge badge-accent" style={{ marginBottom: 4, display: 'inline-flex' }}>
                <Sparkles size={10} /> Ready to Train
              </span>
              <h3 style={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: '-0.01em' }}>No Active Workout Plan</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: 2 }}>
                Choose from {plansCount} balanced programs or launch a session now
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative', zIndex: 1 }}>
            <button className="btn-primary" onClick={() => setCurrentTab('plans')} style={{ padding: '11px 12px', fontSize: '0.82rem' }}>
              Browse {plansCount} Plans
            </button>
            <button className="btn-secondary" onClick={handleStartNextWorkout} style={{ padding: '11px 12px', fontSize: '0.82rem' }}>
              <Play size={14} /> Quick Start PPL
            </button>
          </div>
        </div>
      )}

      {/* Weekly Progress Row */}
      <div className="animate-in stagger-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div className="stat-card" style={{ padding: '12px 8px' }}>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            {weekWorkouts}<span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>/{streakGoal}</span>
          </div>
          <div className="stat-label" style={{ fontSize: '0.62rem' }}>This Week</div>
        </div>
        <div className="stat-card" style={{ padding: '12px 8px' }}>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{allSessions.filter(s => s.completed).length}</div>
          <div className="stat-label" style={{ fontSize: '0.62rem' }}>Workouts</div>
        </div>
        <div className="stat-card" style={{ padding: '12px 8px' }}>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{prs.length}</div>
          <div className="stat-label" style={{ fontSize: '0.62rem' }}>PRs Set</div>
        </div>
      </div>

      {/* Standalone Gym Timer & Stopwatch */}
      <div className="card animate-in stagger-2" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Timer size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Gym Timer & Stopwatch</span>
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-full)', padding: 2, border: '1px solid var(--border-glass)' }}>
            <button
              onClick={() => setClockMode('timer')}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                fontSize: '0.68rem', fontWeight: 700,
                background: clockMode === 'timer' ? 'var(--accent-gradient)' : 'transparent',
                color: clockMode === 'timer' ? 'white' : 'var(--text-tertiary)',
              }}
            >
              Timer
            </button>
            <button
              onClick={() => setClockMode('stopwatch')}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                fontSize: '0.68rem', fontWeight: 700,
                background: clockMode === 'stopwatch' ? 'var(--accent-gradient)' : 'transparent',
                color: clockMode === 'stopwatch' ? 'white' : 'var(--text-tertiary)',
              }}
            >
              Stopwatch
            </button>
          </div>
        </div>

        {clockMode === 'timer' ? (
          <>
            <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
              <div className="num" style={{ fontSize: '2.1rem', color: timerRunning ? 'var(--accent-secondary)' : 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                {formatClock(timerRemaining)}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {timerRunning ? 'Countdown running' : 'Select duration or start rest timer'}
              </div>
            </div>

            {/* Duration Presets (Strictly separated from +15s modifier) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 10 }}>
              {[
                { label: '30s', sec: 30 },
                { label: '1m', sec: 60 },
                { label: '1.5m', sec: 90 },
                { label: '2m', sec: 120 },
                { label: '3m', sec: 180 },
              ].map((p) => (
                <button
                  key={p.sec}
                  onClick={() => {
                    setTimerPreset(p.sec);
                    setTimerRemaining(p.sec);
                    setTimerRunning(false);
                  }}
                  style={{
                    padding: '6px 4px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    fontSize: '0.7rem', fontWeight: 700,
                    background: timerPreset === p.sec ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.03)',
                    color: timerPreset === p.sec ? 'var(--accent-secondary)' : 'var(--text-tertiary)',
                    border: timerPreset === p.sec ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--border-subtle)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  if (timerRemaining === 0) setTimerRemaining(timerPreset);
                  setTimerRunning((r) => !r);
                }}
                style={{ padding: '9px 14px', fontSize: '0.78rem' }}
              >
                {timerRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} fill="white" /> Start Timer</>}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setTimerRemaining((prev) => prev + 15)}
                title="Add 15 seconds"
                style={{ padding: '9px 11px', fontSize: '0.74rem', fontWeight: 700 }}
              >
                +15s
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setTimerRunning(false); setTimerRemaining(timerPreset); }}
                title="Reset timer"
                style={{ padding: '9px 11px', fontSize: '0.74rem' }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', padding: '6px 0 12px' }}>
              <div className="num" style={{ fontSize: '2.1rem', color: stopwatchRunning ? 'var(--success)' : 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                {formatClock(stopwatchElapsed)}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {stopwatchRunning ? 'Stopwatch active' : 'Ready to time sets, planks, or conditioning'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
              <button
                className="btn-primary"
                onClick={() => setStopwatchRunning((r) => !r)}
                style={{ padding: '9px 14px', fontSize: '0.78rem' }}
              >
                {stopwatchRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} fill="white" /> {stopwatchElapsed > 0 ? 'Resume' : 'Start Stopwatch'}</>}
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setStopwatchRunning(false); setStopwatchElapsed(0); }}
                style={{ padding: '9px 12px', fontSize: '0.74rem' }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </>
        )}
      </div>

      {/* Quick Daily Check-In: Body Weight & Hydration */}
      <div className="card animate-in stagger-2" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Daily Check-In</span>
          <button
            onClick={() => setCurrentTab('profile')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
          >
            All Tools →
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 10 }}>
          {/* Body Weight Quick Input */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '9px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 6 }}>
              <Scale size={12} color="var(--accent-secondary)" /> Body Weight ({profile.weightUnit})
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder={profile.weightUnit === 'kg' ? '75.0' : '165'}
                value={todayWeight}
                onChange={(e) => setTodayWeight(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '0.78rem', minWidth: 0, flex: 1 }}
              />
              <button
                className="btn-primary"
                onClick={handleSaveTodayWeight}
                style={{ padding: '6px 10px', fontSize: '0.7rem', flexShrink: 0 }}
              >
                Save
              </button>
            </div>
            {weightSavedMsg && (
              <div style={{ fontSize: '0.62rem', color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                ✓ {weightSavedMsg}
              </div>
            )}
          </div>

          {/* Hydration Quick Counter */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '9px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Droplets size={12} color="#38bdf8" /> Hydration
              </span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{waterGlasses}/8</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <button
                onClick={() => handleAdjustWater(-1)}
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Remove glass of water"
              >
                <Minus size={12} />
              </button>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {(waterGlasses * 0.25).toFixed(2)}L
              </span>
              <button
                onClick={() => handleAdjustWater(1)}
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56,189,248,0.35)',
                  background: 'rgba(56,189,248,0.12)', color: '#38bdf8', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Add glass of water"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Consistency Activity Tracker */}
      <div className="card animate-in stagger-2" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Activity Tracker</span>
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            Last 16 Weeks • {allSessions.filter(s => s.completed).length} total
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gap: 3, paddingTop: 2, fontSize: '0.55rem', color: 'var(--text-tertiary)', lineHeight: '11px' }}>
            <span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span>
          </div>
          <div className="hide-scrollbar" style={{ flex: 1, overflowX: 'auto', paddingBottom: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 3, minWidth: 230 }}>
              {Array.from({ length: 16 }, (_, weekIdx) => (
                <div key={weekIdx} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gap: 3 }}>
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const todayDow = (today.getDay() + 6) % 7;
                    const daysAgo = (15 - weekIdx) * 7 + (todayDow - dayIdx);
                    const cellDate = new Date(today);
                    cellDate.setDate(today.getDate() - daysAgo);
                    const nextDate = new Date(cellDate);
                    nextDate.setDate(cellDate.getDate() + 1);
                    const isFuture = daysAgo < 0;

                    const daySessions = isFuture ? [] : allSessions.filter((s) => {
                      const d = new Date(s.startTime);
                      return d >= cellDate && d < nextDate && s.completed;
                    });
                    const count = daySessions.length;
                    const vol = daySessions.reduce((acc, s) => acc + (s.totalVolume || 0), 0);
                    const dateLabel = cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const isSelected = selectedActivityDay?.date === dateLabel;

                    const bg = isFuture
                      ? 'transparent'
                      : count === 0
                      ? 'rgba(255,255,255,0.05)'
                      : count === 1
                      ? 'rgba(99,102,241,0.55)'
                      : '#818cf8';

                    return (
                      <div
                        key={dayIdx}
                        onClick={() => !isFuture && setSelectedActivityDay({ date: dateLabel, count, volume: Math.round(vol) })}
                        title={isFuture ? '' : `${dateLabel}: ${count} workout${count !== 1 ? 's' : ''}`}
                        style={{
                          width: '100%',
                          height: 11,
                          borderRadius: 3,
                          background: bg,
                          border: isSelected
                            ? '1.5px solid #ffffff'
                            : daysAgo === 0
                            ? '1px solid var(--accent-secondary)'
                            : '1px solid rgba(255,255,255,0.03)',
                          cursor: isFuture ? 'default' : 'pointer',
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '0.66rem', color: 'var(--text-tertiary)' }}>
          <span>
            {selectedActivityDay
              ? `${selectedActivityDay.date}: ${selectedActivityDay.count} workout${selectedActivityDay.count !== 1 ? 's' : ''}${selectedActivityDay.volume > 0 ? ` • ${selectedActivityDay.volume.toLocaleString()} ${profile.weightUnit}` : ''}`
              : 'Tap any day square to inspect activity'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Less</span>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: 'rgba(255,255,255,0.05)', display: 'inline-block' }} />
            <span style={{ width: 9, height: 9, borderRadius: 2, background: 'rgba(99,102,241,0.55)', display: 'inline-block' }} />
            <span style={{ width: 9, height: 9, borderRadius: 2, background: '#818cf8', display: 'inline-block' }} />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="animate-in stagger-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
        <button className="card" onClick={handleQuickWorkout} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border-glass)', padding: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-md)',
            background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
          }}>
            <Play size={16} color="var(--accent-primary)" />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Quick Session</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', marginTop: 2 }}>Freestyle workout</div>
        </button>
        <button className="card" onClick={() => setCurrentTab('plans')} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border-glass)', padding: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-md)',
            background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
          }}>
            <Calendar size={16} color="#a855f7" />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{plansCount} Balanced Plans</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', marginTop: 2 }}>Switch or customize</div>
        </button>
      </div>

      {/* Recent PRs */}
      {prs.length > 0 && (
        <div className="animate-in stagger-3" style={{ marginBottom: 22 }}>
          <div className="section-header">
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={15} color="#f59e0b" /> Personal Records
            </h3>
            <button onClick={() => setCurrentTab('progress')} style={{
              background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600,
            }}>
              All <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prs.slice(0, 3).map((pr, i) => (
              <div key={pr.id || i} className="card" style={{ padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize' }}>{pr.exerciseName}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>
                    {new Date(pr.achievedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-warning">
                    🏆 {pr.weight}{profile.weightUnit} × {pr.reps}
                  </span>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem', marginTop: 2 }}>
                    e1RM: {pr.estimated1RM}{profile.weightUnit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      <div className="animate-in stagger-4">
        <div className="section-header">
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={15} color="var(--text-secondary)" /> Recent Activity
          </h3>
          {recentSessions.length > 0 && (
            <button onClick={() => setCurrentTab('progress')} style={{
              background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600,
            }}>
              History <ChevronRight size={13} />
            </button>
          )}
        </div>
        {recentSessions.length === 0 ? (
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <Dumbbell size={28} />
            <p style={{ fontSize: '0.82rem' }}>No workouts logged yet. Tap Start Workout above to begin!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentSessions.slice(0, 5).map((s, i) => (
              <div key={s.id || i} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{s.dayName || s.planName}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>
                      {new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {s.exercises.length} exercises
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent-secondary)' }}>
                      {formatDuration(s.duration)}
                    </div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.66rem' }}>
                      {s.totalVolume > 0 ? `${Math.round(s.totalVolume).toLocaleString()} ${profile.weightUnit}` : 'Done'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
