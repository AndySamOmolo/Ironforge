'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '@/lib/db';
import { WorkoutSession, PersonalRecord, MuscleGroup, Exercise } from '@/lib/types';
import { useUserStore } from '@/lib/store/userStore';
import { Trophy, TrendingUp, Calendar, Dumbbell, Clock, Flame, Activity, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import MuscleHeatmap from '@/components/ui/MuscleHeatmap';

type SubTab = 'overview' | 'muscles' | 'log' | 'records';

export default function ProgressPage() {
  const { profile } = useUserStore();
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [prFilter, setPrFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    const allSessions = await db.workoutSessions.where('completed').equals(1).toArray().catch(async () => {
      const all = await db.workoutSessions.toArray();
      return all.filter((s) => s.completed);
    });
    allSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    setSessions(allSessions);

    const allPRs = await db.personalRecords.orderBy('achievedAt').reverse().toArray();
    setPRs(allPRs);

    const allEx = await db.exercises.toArray();
    const map: Record<string, Exercise> = {};
    allEx.forEach((e) => { map[e.name.toLowerCase()] = e; });
    setExerciseMap(map);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Overview stats
  const totalWorkouts = sessions.length;
  const totalVolume = useMemo(() => sessions.reduce((s, w) => s + (w.totalVolume || 0), 0), [sessions]);
  const totalDuration = useMemo(() => sessions.reduce((s, w) => s + (w.duration || 0), 0), [sessions]);
  const totalSets = useMemo(() => sessions.reduce((s, w) =>
    s + w.exercises.reduce((es, e) => es + e.sets.filter((st) => st.completed).length, 0), 0), [sessions]);
  const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts / 60) : 0;

  // This week stats (Monday start, consistent with HomePage)
  const weekStats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = sessions.filter((s) => new Date(s.startTime) >= weekStart);
    return {
      workouts: thisWeek.length,
      volume: thisWeek.reduce((s, w) => s + (w.totalVolume || 0), 0),
      sets: thisWeek.reduce((s, w) => s + w.exercises.reduce((es, e) => es + e.sets.filter((st) => st.completed).length, 0), 0),
      duration: thisWeek.reduce((s, w) => s + (w.duration || 0), 0),
    };
  }, [sessions]);

  // Weekly volume chart (last 8 weeks)
  const weeklyChart = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; volume: number; workouts: number; sets: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(now.getDate() - w * 7 - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const matching = sessions.filter((s) => {
        const d = new Date(s.startTime);
        return d >= start && d < end;
      });
      const vol = matching.reduce((s, m) => s + (m.totalVolume || 0), 0);
      const sets = matching.reduce((s, m) => s + m.exercises.reduce((es, e) => es + e.sets.filter((st) => st.completed).length, 0), 0);
      weeks.push({
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume: Math.round(vol),
        workouts: matching.length,
        sets,
      });
    }
    return weeks;
  }, [sessions]);

  // Muscle heatmap data (last 7 days)
  const muscleVolumes = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = sessions.filter((s) => new Date(s.startTime) >= cutoff);
    const counts: Record<string, number> = {};
    recent.forEach((s) => {
      s.exercises.forEach((ex) => {
        const completedSets = ex.sets.filter((st) => st.completed).length;
        if (completedSets === 0) return;
        const found = exerciseMap[ex.exerciseName.toLowerCase()];
        if (found) {
          found.primaryMuscles.forEach((m) => { counts[m] = (counts[m] || 0) + completedSets; });
          found.secondaryMuscles.forEach((m) => { counts[m] = (counts[m] || 0) + completedSets * 0.4; });
        }
      });
    });
    const maxSets = Math.max(...Object.values(counts), 1);
    const normalized: Partial<Record<MuscleGroup, number>> = {};
    Object.entries(counts).forEach(([m, v]) => {
      normalized[m as MuscleGroup] = Math.min(1, v / Math.max(maxSets, 12));
    });
    return normalized;
  }, [sessions, exerciseMap]);

  // Top trained muscles (all time)
  const topMuscles = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      s.exercises.forEach((ex) => {
        const completedSets = ex.sets.filter((st) => st.completed).length;
        const found = exerciseMap[ex.exerciseName.toLowerCase()];
        if (found) {
          found.primaryMuscles.forEach((m) => { counts[m] = (counts[m] || 0) + completedSets; });
        }
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [sessions, exerciseMap]);

  // Calendar heatmap (last 12 weeks)
  const calendarWeeks = useMemo(() => {
    const today = new Date();
    const weeks: { date: Date; count: number; volume: number }[][] = [];
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));

    for (let w = 11; w >= 0; w--) {
      const week: { date: Date; count: number; volume: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(endOfWeek);
        cellDate.setDate(endOfWeek.getDate() - w * 7 - (6 - d));
        cellDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(cellDate);
        nextDate.setDate(cellDate.getDate() + 1);
        const daySessions = sessions.filter((s) => {
          const st = new Date(s.startTime);
          return st >= cellDate && st < nextDate;
        });
        week.push({
          date: cellDate,
          count: daySessions.length,
          volume: daySessions.reduce((s, w) => s + (w.totalVolume || 0), 0),
        });
      }
      weeks.push(week);
    }
    return weeks;
  }, [sessions]);

  // Filtered sessions for log
  const filteredSessions = useMemo(() => {
    if (!selectedDateFilter) return sessions;
    return sessions.filter((s) => {
      const d = new Date(s.startTime).toISOString().split('T')[0];
      return d === selectedDateFilter;
    });
  }, [sessions, selectedDateFilter]);

  // Unique exercises in PRs
  const prExercises = useMemo(() => {
    const names = new Set(prs.map((p) => p.exerciseName));
    return Array.from(names);
  }, [prs]);

  const filteredPRs = useMemo(() => {
    if (prFilter === 'all') return prs;
    return prs.filter((p) => p.exerciseName === prFilter);
  }, [prs, prFilter]);

  // Best PR per exercise
  const bestPRsByExercise = useMemo(() => {
    const best: Record<string, PersonalRecord> = {};
    prs.forEach((p) => {
      if (!best[p.exerciseName] || p.estimated1RM > best[p.exerciseName].estimated1RM) {
        best[p.exerciseName] = p;
      }
    });
    return Object.values(best).sort((a, b) => b.estimated1RM - a.estimated1RM);
  }, [prs]);

  const fmtDur = (s: number) => {
    if (!s || s <= 0) return '0m';
    const m = Math.max(1, Math.round(s / 60));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title animate-in" style={{ marginBottom: 4 }}>Progress</h1>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 14 }}>
        Track muscle activation, volume & personal records
      </p>

      {/* Sub-navigation */}
      <div className="chip-scroll" style={{ marginBottom: 18 }}>
        {([
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'muscles', label: 'Muscle Map', icon: Activity },
          { id: 'log', label: 'Activity Log', icon: Calendar },
          { id: 'records', label: 'Records', icon: Trophy },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`chip ${subTab === t.id ? 'active' : ''}`} onClick={() => setSubTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════ OVERVIEW ═══════ */}
      {subTab === 'overview' && (
        <div className="animate-in">
          {/* Lifetime Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            <div className="stat-card" style={{ textAlign: 'left', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Dumbbell size={15} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.62rem', color: 'var(--success)', fontWeight: 600 }}>+{weekStats.workouts} this wk</span>
              </div>
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>{totalWorkouts}</div>
              <div className="stat-label">Total Workouts</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'left', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Flame size={15} color="#f59e0b" />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{totalSets} sets</span>
              </div>
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                {totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : Math.round(totalVolume)}
              </div>
              <div className="stat-label">Volume ({profile.weightUnit})</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'left', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Clock size={15} color="#06b6d4" />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{fmtDur(totalDuration)} total</span>
              </div>
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>{avgDuration}m</div>
              <div className="stat-label">Avg Time</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'left', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Trophy size={15} color="#eab308" />
                <span style={{ fontSize: '0.62rem', color: 'var(--warning)', fontWeight: 600 }}>{prExercises.length} lifts</span>
              </div>
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>{prs.length}</div>
              <div className="stat-label">Personal Records</div>
            </div>
          </div>

          {/* Weekly Volume Chart */}
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color="var(--accent-primary)" /> Weekly Volume Trend
              </h3>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Last 8 weeks ({profile.weightUnit})</span>
            </div>
            <div style={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={weeklyChart}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: '#55556a', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={totalVolume === 0 ? [0, 1000] : ['auto', 'auto']}
                    tick={{ fill: '#55556a', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{ background: '#161622', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: '0.75rem' }}
                    labelStyle={{ color: '#8b8b9e' }}
                    formatter={(val) => [`${Number(val ?? 0).toLocaleString()} ${profile.weightUnit}`, 'Volume']}
                  />
                  <Area type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={2.5} fill="url(#volGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              {totalVolume === 0 && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none', paddingBottom: 18,
                }}>
                  <span style={{
                    background: 'rgba(18, 18, 28, 0.85)', border: '1px solid var(--border-glass)',
                    padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', color: 'var(--text-tertiary)',
                  }}>
                    Complete your first session to plot weekly volume
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Top Muscles Bar Breakdown */}
          {topMuscles.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>Most Trained Muscles</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topMuscles.map(([muscle, sets]) => {
                  const maxSets = topMuscles[0][1] || 1;
                  const pct = Math.round((sets / maxSets) * 100);
                  return (
                    <div key={muscle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{muscle}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{Math.round(sets)} sets</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, borderRadius: 3,
                          background: 'var(--accent-gradient)', transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ MUSCLE MAP ═══════ */}
      {subTab === 'muscles' && (
        <div className="animate-in">
          <div className="card" style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="var(--accent-primary)" /> Weekly Muscle Activation
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Anatomical heat map from your last 7 days of training
                </p>
              </div>
            </div>
            <MuscleHeatmap
              muscleVolumes={muscleVolumes}
              sessions={sessions}
              exercises={Object.values(exerciseMap)}
              bodyweightKg={profile.weightUnit === 'lbs' ? 75 : 75}
            />
          </div>
        </div>
      )}

      {/* ═══════ ACTIVITY LOG ═══════ */}
      {subTab === 'log' && (
        <div className="animate-in">
          {/* This Week Summary Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            <div className="stat-card" style={{ padding: '10px 8px' }}>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{weekStats.workouts}</div>
              <div className="stat-label">This Week</div>
            </div>
            <div className="stat-card" style={{ padding: '10px 8px' }}>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{weekStats.sets}</div>
              <div className="stat-label">Week Sets</div>
            </div>
            <div className="stat-card" style={{ padding: '10px 8px' }}>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{fmtDur(weekStats.duration)}</div>
              <div className="stat-label">Week Time</div>
            </div>
          </div>

          {/* 12-Week Consistency Heatmap */}
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700 }}>12-Week Activity</h3>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)' }}>Tap any date square to filter</span>
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
              {calendarWeeks.map((week, wIdx) => (
                <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                  {week.map((day, dIdx) => {
                    const iso = day.date.toISOString().split('T')[0];
                    const isSelected = selectedDateFilter === iso;
                    const intensity = day.count === 0 ? 0 : day.count === 1 ? 0.55 : 1;
                    return (
                      <div
                        key={dIdx}
                        onClick={() => setSelectedDateFilter(isSelected ? null : iso)}
                        title={`${day.date.toLocaleDateString()} — ${day.count} workout(s)`}
                        style={{
                          aspectRatio: '1', borderRadius: 3, cursor: 'pointer',
                          background: intensity === 0
                            ? 'rgba(255,255,255,0.05)'
                            : intensity < 1
                              ? 'rgba(99, 102, 241, 0.5)'
                              : '#6366f1',
                          border: isSelected ? '1.5px solid #ffffff' : '1px solid rgba(255,255,255,0.03)',
                          boxShadow: isSelected ? '0 0 8px rgba(99, 102, 241, 0.55)' : undefined,
                          transition: 'transform 0.12s',
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Active Date Filter Banner */}
            {selectedDateFilter && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.73rem',
              }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  📅 {new Date(`${selectedDateFilter}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} — {filteredSessions.length} workout{filteredSessions.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setSelectedDateFilter(null)}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 'var(--radius-full)',
                    color: 'var(--text-primary)', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}
                >
                  Clear <X size={11} />
                </button>
              </div>
            )}
          </div>

          {/* Detailed Session Cards */}
          {filteredSessions.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <Calendar size={28} />
              <p style={{ fontSize: '0.82rem' }}>
                {selectedDateFilter
                  ? `No workouts logged on ${new Date(`${selectedDateFilter}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
                  : 'No workouts found yet. Start a session to build your log!'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredSessions.map((s) => {
                const isOpen = expandedSession === s.id;
                const completedSets = s.exercises.reduce((sum, e) => sum + e.sets.filter((st) => st.completed).length, 0);
                return (
                  <div key={s.id} className="card" style={{ padding: '12px 14px' }}>
                    <div onClick={() => setExpandedSession(isOpen ? null : (s.id ?? null))} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.dayName || s.planName}</div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', marginTop: 2 }}>
                          {new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {s.exercises.length} exercises • {completedSets} sets
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent-secondary)' }}>{fmtDur(s.duration)}</div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)' }}>
                            {s.totalVolume > 0 ? `${Math.round(s.totalVolume).toLocaleString()} ${profile.weightUnit}` : 'Done'}
                          </div>
                        </div>
                        {isOpen ? <ChevronUp size={15} color="var(--text-tertiary)" /> : <ChevronDown size={15} color="var(--text-tertiary)" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {s.exercises.map((ex, i) => {
                          const doneSets = ex.sets.filter((st) => st.completed);
                          if (doneSets.length === 0) return null;
                          return (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'capitalize', marginBottom: 4 }}>{ex.exerciseName}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {doneSets.map((st, j) => (
                                  <span key={j} style={{
                                    fontSize: '0.68rem', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                    background: 'rgba(99, 102, 241, 0.08)', color: 'var(--text-secondary)', fontWeight: 600,
                                  }}>
                                    {st.weight > 0 ? `${st.weight}${profile.weightUnit} × ${st.reps}` : `${st.reps} reps`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ RECORDS ═══════ */}
      {subTab === 'records' && (
        <div className="animate-in">
          {/* Best All-Time Lifts */}
          {bestPRsByExercise.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>
                🏆 All-Time Best per Exercise
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {bestPRsByExercise.slice(0, 6).map((pr) => (
                  <div key={pr.id || pr.exerciseName} className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'capitalize', marginBottom: 6, lineHeight: 1.2,
                      display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {pr.exerciseName}
                    </div>
                    <div className="num" style={{ fontSize: '1.15rem', color: 'var(--warning)' }}>
                      {pr.weight}<span style={{ fontSize: '0.72rem' }}> {profile.weightUnit}</span> × {pr.reps}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Est. 1RM: <strong style={{ color: 'var(--text-secondary)' }}>{pr.estimated1RM} {profile.weightUnit}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter by Exercise */}
          {prExercises.length > 1 && (
            <div className="chip-scroll" style={{ marginBottom: 12 }}>
              <button className={`chip ${prFilter === 'all' ? 'active' : ''}`} onClick={() => setPrFilter('all')}>All ({prs.length})</button>
              {prExercises.map((name) => (
                <button key={name} className={`chip ${prFilter === name ? 'active' : ''}`} onClick={() => setPrFilter(name)} style={{ textTransform: 'capitalize' }}>
                  {name}
                </button>
              ))}
            </div>
          )}

          {filteredPRs.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <Trophy size={28} />
              <p style={{ fontSize: '0.82rem' }}>Complete workouts with weights to automatically set PRs!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredPRs.map((pr, i) => (
                <div key={pr.id || i} className="card" style={{ padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize' }}>{pr.exerciseName}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>
                      {new Date(pr.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-warning">🏆 {pr.weight}{profile.weightUnit} × {pr.reps}</span>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.64rem', marginTop: 2 }}>
                      e1RM: {pr.estimated1RM} {profile.weightUnit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
