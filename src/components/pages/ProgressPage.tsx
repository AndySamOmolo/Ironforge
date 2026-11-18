'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar, Clock, Dumbbell, TrendingUp, Trophy, Target, Zap, History, ChevronDown, ChevronRight, Trash2, Flame, Star, Activity } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import type { WorkoutSession, PersonalRecord } from '@/lib/types';
import { estimate1RM } from '@/lib/utils/progressionEngine';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, AreaChart, Area, LineChart, Line } from 'recharts';
import MuscleHeatmap from '@/components/ui/MuscleHeatmap';

type TabId = 'overview' | 'strength' | 'records' | 'body' | 'history';

interface SessionDetail {
  session: WorkoutSession;
  exercises: { name: string; sets: { weight: number; reps: number; setNumber: number; isPR?: boolean }[] }[];
}

function toLocalDateKey(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ProgressPage() {
  const { unitSystem } = useUserStore();
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'week' | 'month'>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [calendarView, setCalendarView] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [exerciseChartId, setExerciseChartId] = useState<number | null>(null);
  const [exerciseChartData, setExerciseChartData] = useState<{ date: string; weight: number; est1RM: number; volume: number }[]>([]);
  const [loggedExercises, setLoggedExercises] = useState<{ id: number; name: string; count: number }[]>([]);
  const PAGE_SIZE = 15;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const allSessions = await db.workoutSessions.orderBy('startedAt').reverse().toArray();
    setSessions(allSessions.filter(s => s.isComplete));
    const allPRs = await db.personalRecords.orderBy('date').reverse().toArray();
    setPrs(allPRs);

    try {
      const [allSets, exercises] = await Promise.all([
        db.sets.toArray(),
        db.exercises.toArray(),
      ]);
      const countByEx = new Map<number, number>();
      for (const s of allSets) {
        if (s.exerciseId) countByEx.set(s.exerciseId, (countByEx.get(s.exerciseId) || 0) + 1);
      }
      const exList = exercises
        .filter(e => e.id != null)
        .map(e => ({ id: e.id!, name: e.name, count: countByEx.get(e.id!) || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      setLoggedExercises(exList.slice(0, 150));
      if (exList.length > 0 && exList[0].count > 0 && !exerciseChartId) {
        loadExerciseChart(exList[0].id);
      }
    } catch {}
  };

  const loadSessionDetail = useCallback(async (session: WorkoutSession) => {
    if (!session.id) return;
    try {
      const sets = await db.sets.where('sessionId').equals(session.id).toArray();
      const exerciseIds = [...new Set(sets.map(s => s.exerciseId))];
      const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray();
      const exMap = new Map(exercises.map(e => [e.id!, e.name]));

      const grouped: Record<number, { name: string; sets: { weight: number; reps: number; setNumber: number; isPR?: boolean }[] }> = {};
      sets.forEach(s => {
        if (!grouped[s.exerciseId]) grouped[s.exerciseId] = { name: exMap.get(s.exerciseId) || 'Exercise', sets: [] };
        grouped[s.exerciseId].sets.push({ weight: s.weight, reps: s.reps, setNumber: s.setNumber, isPR: s.isPR });
      });
      Object.values(grouped).forEach(g => g.sets.sort((a, b) => a.setNumber - b.setNumber));
      setSessionDetail({ session, exercises: Object.values(grouped) });
    } catch { setSessionDetail(null); }
  }, []);

  const loadExerciseChart = useCallback(async (exerciseId: number) => {
    setExerciseChartId(exerciseId);
    try {
      const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
      if (sets.length === 0) {
        setExerciseChartData([]);
        return;
      }
      const sessionIds = [...new Set(sets.map(s => s.sessionId))];
      const sessionsForEx = sessionIds.length > 0
        ? await db.workoutSessions.where('id').anyOf(sessionIds).toArray()
        : [];
      const sessionDateMap = new Map(sessionsForEx.map(s => [s.id!, new Date(s.startedAt)]));

      const byDate: Record<string, { maxWeight: number; max1RM: number; totalVolume: number }> = {};
      sets.forEach(s => {
        const d = sessionDateMap.get(s.sessionId);
        if (!d) return;
        const key = toLocalDateKey(d);
        if (!byDate[key]) byDate[key] = { maxWeight: 0, max1RM: 0, totalVolume: 0 };
        byDate[key].maxWeight = Math.max(byDate[key].maxWeight, s.weight);
        byDate[key].max1RM = Math.max(byDate[key].max1RM, estimate1RM(s.weight, s.reps));
        byDate[key].totalVolume += s.weight * s.reps;
      });

      const data = Object.entries(byDate)
        .map(([date, v]) => ({ date, weight: v.maxWeight, est1RM: v.max1RM, volume: v.totalVolume }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setExerciseChartData(data);
      setExerciseChartId(exerciseId);
    } catch {}
  }, []);

  const handleDeleteSession = async (id: number) => {
    await db.workoutSessions.delete(id);
    await db.sessionExercises.where('sessionId').equals(id).delete();
    await db.sets.where('sessionId').equals(id).delete();
    await db.personalRecords.where('sessionId').equals(id).delete();
    setDeleteConfirm(null);
    setExpandedSession(null);
    loadData();
  };

  const filteredHistory = useMemo(() => {
    let filtered = sessions;
    if (selectedCalendarDate) {
      return sessions.filter(s => toLocalDateKey(s.startedAt) === selectedCalendarDate);
    }
    if (historyFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = sessions.filter(s => new Date(s.startedAt) >= weekAgo);
    } else if (historyFilter === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = sessions.filter(s => new Date(s.startedAt) >= monthAgo);
    }
    return filtered;
  }, [sessions, historyFilter, selectedCalendarDate]);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(0, (historyPage + 1) * PAGE_SIZE);
  }, [filteredHistory, historyPage]);

  const calendarData = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach(s => {
      const key = toLocalDateKey(s.startedAt);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [sessions]);

  const calendarWeeks = useMemo(() => {
    const weeks: { date: string; count: number; isToday: boolean }[][] = [];
    const now = new Date();
    const today = toLocalDateKey(now);
    for (let w = 11; w >= 0; w--) {
      const week: { date: string; count: number; isToday: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = toLocalDateKey(date);
        week.push({ date: key, count: calendarData.get(key) || 0, isToday: key === today });
      }
      weeks.push(week);
    }
    return weeks;
  }, [calendarData]);

  const weekStats = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekSessions = sessions.filter(s => new Date(s.startedAt) >= weekAgo);
    return {
      count: weekSessions.length,
      volume: weekSessions.reduce((a, s) => a + (s.totalVolume || 0), 0),
      duration: weekSessions.reduce((a, s) => a + (s.duration || 0), 0),
    };
  }, [sessions]);

  const { currentStreak, longestStreak, activeDays30d } = useMemo(() => {
    const dates = new Set(sessions.map(s => toLocalDateKey(s.startedAt)));
    let current = 0;
    const d = new Date();
    if (!dates.has(toLocalDateKey(d))) {
      d.setDate(d.getDate() - 1);
    }
    while (dates.has(toLocalDateKey(d))) {
      current++;
      d.setDate(d.getDate() - 1);
    }

    let longest = 0, streak = 0;
    const allDates = [...dates].map(ds => new Date(`${ds}T00:00:00`).getTime()).sort((a, b) => a - b);
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0 || allDates[i] - allDates[i - 1] <= 86400000 * 1.5) { streak++; } else { streak = 1; }
      longest = Math.max(longest, streak);
    }

    const thirtyAgo = Date.now() - 30 * 86400000;
    const active30 = [...dates].filter(ds => new Date(`${ds}T12:00:00`).getTime() >= thirtyAgo).length;

    return { currentStreak: current, longestStreak: longest, activeDays30d: active30 };
  }, [sessions]);

  const totalVolume = sessions.reduce((a, s) => a + (s.totalVolume || 0), 0);
  const totalDurationSec = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const totalSets = sessions.reduce((a, s) => a + (s.totalSets || 0), 0);
  const estTotalCalories = Math.round((totalDurationSec / 60) * 6.5 + totalSets * 11);
  const avgDuration = sessions.length > 0 ? Math.round(totalDurationSec / sessions.length / 60) : 0;

  const getWeeklyData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);

    return days.map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = toLocalDateKey(d);
      const daySessions = sessions.filter(s => toLocalDateKey(s.startedAt) === key);
      return {
        day,
        volume: daySessions.reduce((a, s) => a + (s.totalVolume || 0), 0),
        sets: daySessions.reduce((a, s) => a + (s.totalSets || 0), 0),
      };
    });
  };

  const getTrendData = () => {
    const weeks: { week: string; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const now = new Date();
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 86400000);
      const weekEnd = new Date(now.getTime() - i * 7 * 86400000);
      const weekSessions = sessions.filter(s => { const sd = new Date(s.startedAt); return sd >= weekStart && sd < weekEnd; });
      weeks.push({ week: `W${8 - i}`, volume: weekSessions.reduce((a, s) => a + (s.totalVolume || 0), 0) });
    }
    return weeks;
  };

  const fmtVol = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString();
  const fmtDur = (s: number) => { if (!s || s <= 0) return '0m'; const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

  const selectedExerciseName = loggedExercises.find(e => e.id === exerciseChartId)?.name || '';

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="icon-badge" style={{ background: 'rgba(0,229,160,0.1)', width: 38, height: 38, borderRadius: 10 }}>
            <BarChart3 size={18} color="var(--accent-green)" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Progress & Analytics</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Track your activity consistency, strength, records & 3D body map</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="chip-scroll" style={{ marginBottom: 16, paddingBottom: 4 }}>
        {([
          { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { id: 'body' as const, label: '3D Body Map', icon: Target },
          { id: 'history' as const, label: 'Activity Log', icon: History },
          { id: 'strength' as const, label: 'Strength', icon: TrendingUp },
          { id: 'records' as const, label: 'Records', icon: Trophy },
        ]).map(t => (
          <button key={t.id}
            className={`filter-chip ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════ OVERVIEW ════════ */}
      {tab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { icon: Dumbbell, value: sessions.length, label: 'Total Workouts', color: 'var(--accent-purple)', bg: 'rgba(124,106,255,0.08)' },
              { icon: Activity, value: `${activeDays30d}d`, label: 'Active Days (30D)', color: 'var(--accent-green)', bg: 'rgba(0,229,160,0.08)' },
              { icon: Clock, value: `${avgDuration}m`, label: `Avg Time (${fmtDur(totalDurationSec)} total)`, color: 'var(--accent-orange)', bg: 'rgba(255,140,66,0.08)' },
              { icon: Flame, value: `${currentStreak}d`, label: `Streak (Best: ${longestStreak}d)`, color: 'var(--accent-red)', bg: 'rgba(255,61,90,0.08)' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="stat-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="icon-badge" style={{ background: stat.bg, width: 32, height: 32, borderRadius: 8 }}>
                  <stat.icon size={16} color={stat.color} />
                </div>
                <div className="stat-value" style={{ fontSize: 22 }}>{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card" style={{ marginBottom: 16, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>This Week Volume (Mon–Sun, {unitLabel})</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getWeeklyData()} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={totalVolume === 0 ? [0, 1000] : ['auto', 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip contentStyle={{ background: 'var(--bg-sheet)', border: '1px solid var(--border-bright)', borderRadius: 12, fontSize: 12 }} />
                  <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF3B5C" stopOpacity={0.9} /><stop offset="100%" stopColor="#FF6B3D" stopOpacity={0.6} /></linearGradient></defs>
                  <Bar dataKey="volume" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card" style={{ marginBottom: 16, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Volume Trend (8 Weeks)</h3>
            <div style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getTrendData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={totalVolume === 0 ? [0, 1000] : ['auto', 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip contentStyle={{ background: 'var(--bg-sheet)', border: '1px solid var(--border-bright)', borderRadius: 12, fontSize: 12 }} />
                  <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C6AFF" stopOpacity={0.3} /><stop offset="100%" stopColor="#7C6AFF" stopOpacity={0.0} /></linearGradient></defs>
                  <Area type="monotone" dataKey="volume" stroke="#7C6AFF" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 4, fill: '#7C6AFF', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-red)', padding: 12 }}>
              <div className="stat-label">Total Volume</div>
              <div className="stat-value" style={{ color: 'var(--accent-red)', fontSize: 18 }}>{fmtVol(totalVolume)} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{unitLabel}</span></div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-orange)', padding: 12 }}>
              <div className="stat-label">Est. Burned</div>
              <div className="stat-value" style={{ color: 'var(--accent-orange)', fontSize: 18 }}>{fmtVol(estTotalCalories)} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>kcal</span></div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-yellow)', padding: 12 }}>
              <div className="stat-label">PRs Set</div>
              <div className="stat-value" style={{ color: 'var(--accent-yellow)', fontSize: 18 }}>{prs.length}</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ════════ HISTORY / ACTIVITY LOG ════════ */}
      {tab === 'history' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            <div className="stat-card" style={{ textAlign: 'center', padding: 10 }}>
              <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent-green)' }}>{weekStats.count}</div>
              <div className="stat-label">This Week</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center', padding: 10 }}>
              <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent-purple)' }}>{fmtVol(weekStats.volume)}</div>
              <div className="stat-label">Week Volume</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center', padding: 10 }}>
              <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent-orange)' }}>{fmtDur(weekStats.duration)}</div>
              <div className="stat-label">Week Time</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'month', 'week'] as const).map(f => (
                <button key={f} className={historyFilter === f && !selectedCalendarDate ? 'btn-primary btn-high-contrast' : 'btn-secondary'}
                  onClick={() => { setHistoryFilter(f); setSelectedCalendarDate(null); setHistoryPage(0); }}
                  style={{ minHeight: 32, padding: '5px 12px', fontSize: 11, borderRadius: 8, width: 'auto' }}>
                  {f === 'all' ? 'All' : f === 'month' ? '30D' : '7D'}
                </button>
              ))}
              {selectedCalendarDate && (
                <button
                  onClick={() => setSelectedCalendarDate(null)}
                  className="btn-secondary"
                  style={{ minHeight: 32, padding: '5px 10px', fontSize: 11, borderRadius: 8, color: 'var(--accent-yellow)' }}
                >
                  {selectedCalendarDate} ×
                </button>
              )}
            </div>
            <button className={calendarView ? 'btn-primary btn-high-contrast' : 'btn-secondary'}
              onClick={() => setCalendarView(!calendarView)}
              style={{ minHeight: 32, padding: '5px 12px', fontSize: 11, borderRadius: 8, width: 'auto' }}>
              <Calendar size={12} /> {calendarView ? 'Hide Grid' : '12W Grid'}
            </button>
          </div>

          {calendarView && (
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Last 12 Weeks (Tap a day to filter)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{activeDays30d} active days in last 30d</span>
              </div>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {week.map((day, di) => {
                      const isSel = selectedCalendarDate === day.date;
                      return (
                        <button
                          key={di}
                          onClick={() => setSelectedCalendarDate(isSel ? null : day.date)}
                          title={`${day.date}: ${day.count} workout${day.count !== 1 ? 's' : ''}`}
                          style={{
                            width: 16, height: 16, borderRadius: 3.5, padding: 0, cursor: 'pointer',
                            background: day.count === 0 ? 'var(--bg-glass)' : day.count === 1 ? 'var(--accent-green)' : 'var(--accent-red)',
                            opacity: day.count === 0 ? 0.24 : 0.65 + Math.min(day.count * 0.2, 0.35),
                            border: isSel ? '1.5px solid #ffffff' : day.isToday ? '1.5px solid var(--accent-purple)' : 'none',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>12 weeks ago</span>
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Today</span>
              </div>
              {selectedCalendarDate && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(124,106,255,0.12)', border: '1px solid rgba(124,106,255,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    📅 {new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {filteredHistory.length} workout{filteredHistory.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSelectedCalendarDate(null)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 999, padding: '3px 8px', color: 'var(--text-primary)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear ×
                  </button>
                </div>
              )}
            </div>
          )}

          {paginatedHistory.length === 0 ? (
            <div className="empty-state">
              <History size={48} color="var(--text-muted)" />
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>No workouts found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {selectedCalendarDate ? `No workouts logged on ${selectedCalendarDate}.` : 'Complete your first workout to see it here.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paginatedHistory.map((s) => {
                const isExpanded = expandedSession === s.id;
                return (
                  <motion.div key={s.id} layout className="card" style={{ overflow: 'hidden' }}>
                    <button onClick={() => {
                      if (isExpanded) { setExpandedSession(null); setSessionDetail(null); }
                      else { setExpandedSession(s.id!); loadSessionDetail(s); }
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none',
                      color: 'var(--text-primary)', cursor: 'pointer', padding: 0, textAlign: 'left',
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,232,154,0.08)', border: '1px solid rgba(16,232,154,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Dumbbell size={16} color="var(--accent-green)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{s.dayName || s.planName || 'Workout'}</span>
                          {s.rating && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--accent-yellow)' }}>
                              <Star size={10} fill="#FBBF24" color="#FBBF24" /> {s.rating}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(s.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {s.duration > 0 && ` • ${fmtDur(s.duration)}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtVol(s.totalVolume)}{unitLabel}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.totalSets} sets</div>
                      </div>
                      {isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                    </button>

                    <AnimatePresence>
                      {isExpanded && sessionDetail?.session.id === s.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden', borderTop: '1px solid var(--border-subtle)', marginTop: 12, paddingTop: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                            {[
                              { v: fmtDur(s.duration), l: 'Duration' },
                              { v: s.totalSets, l: 'Sets' },
                              { v: s.totalReps, l: 'Reps' },
                              { v: `${fmtVol(s.totalVolume)}${unitLabel}`, l: 'Volume' },
                            ].map((st, i) => (
                              <div key={i} style={{ textAlign: 'center', padding: 6, background: 'var(--bg-glass)', borderRadius: 8 }}>
                                <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{st.v}</div>
                                <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 600 }}>{st.l}</div>
                              </div>
                            ))}
                          </div>

                          {s.notes && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-glass)', padding: '8px 10px', borderRadius: 8, marginBottom: 10, fontStyle: 'italic' }}>
                              📝 {s.notes}
                            </div>
                          )}

                          {sessionDetail?.exercises.map((ex, ei) => (
                            <div key={ei} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{ex.name}</div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {ex.sets.map((set, si) => (
                                  <div key={si} style={{
                                    padding: '4px 8px', background: 'var(--bg-elevated)', borderRadius: 6,
                                    border: set.isPR ? '1px solid var(--accent-yellow)' : '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600,
                                  }}>
                                    <span style={{ color: 'var(--accent-purple)' }}>{set.weight}{unitLabel}</span>
                                    <span style={{ color: 'var(--text-muted)' }}> × </span>
                                    <span style={{ color: 'var(--accent-green)' }}>{set.reps}</span>
                                    {set.isPR && <span style={{ marginLeft: 4 }}>🏆</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            {deleteConfirm === s.id ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>Delete this session?</span>
                                <button onClick={() => handleDeleteSession(s.id!)} style={{ padding: '4px 10px', background: 'var(--accent-red)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, minHeight: 28 }}>No</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirm(s.id!)} style={{ padding: '4px 10px', background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.2)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Trash2 size={10} /> Delete
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {paginatedHistory.length < filteredHistory.length && (
                <button onClick={() => setHistoryPage(p => p + 1)} className="btn-secondary"
                  style={{ minHeight: 44, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  Load More ({filteredHistory.length - paginatedHistory.length} remaining)
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ════════ STRENGTH ════════ */}
      {tab === 'strength' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Exercise Strength & Estimated 1RM Progression</h3>
            <select onChange={(e) => { const id = parseInt(e.target.value); if (id) loadExerciseChart(id); }}
              value={exerciseChartId || ''}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, marginBottom: 12, outline: 'none' }}>
              <option value="">Select an exercise...</option>
              {loggedExercises.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name.replace(/\b\w/g, c => c.toUpperCase())}{ex.count > 0 ? ` (${ex.count} sets logged)` : ''}
                </option>
              ))}
            </select>

            {exerciseChartData.length > 1 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'capitalize' }}>
                  Max Weight & Est. 1RM ({unitLabel}) — {selectedExerciseName}
                </div>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip contentStyle={{ background: 'var(--bg-sheet)', border: '1px solid var(--border-bright)', borderRadius: 12, fontSize: 12 }} />
                      <Line type="monotone" dataKey="est1RM" name="Est. 1RM" stroke="#10E89A" strokeWidth={2} dot={{ r: 4, fill: '#10E89A' }} />
                      <Line type="monotone" dataKey="weight" name="Top Weight" stroke="#FF3B5C" strokeWidth={2} dot={{ r: 4, fill: '#FF3B5C' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {exerciseChartData.length <= 1 && exerciseChartId && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                Log at least 2 sessions with this exercise to display a trend line.
              </div>
            )}
          </div>

          <div className="card hero-gradient" style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Zap size={16} color="var(--accent-yellow)" />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Sessions</h3>
            </div>
            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Target size={36} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Complete workouts to track strength.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.slice(0, 8).map((s, i) => (
                  <div key={s.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 7 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,59,92,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Dumbbell size={14} color="var(--accent-red)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.dayName || s.planName || 'Workout'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtVol(s.totalVolume)}{unitLabel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ════════ RECORDS ════════ */}
      {tab === 'records' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {prs.length === 0 ? (
            <div className="empty-state">
              <Trophy size={48} color="var(--accent-yellow)" />
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>No PRs yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Personal records are automatically tracked and saved when you beat your previous best during a workout.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="card" style={{ padding: 14, marginBottom: 4, borderLeft: '3px solid var(--accent-yellow)' }}>
                <div className="stat-label">Total Personal Records</div>
                <div className="stat-value" style={{ color: 'var(--accent-yellow)', fontSize: 28 }}>{prs.length}</div>
              </div>
              {prs.map((pr, i) => (
                <motion.div key={pr.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255,209,102,0.15), rgba(255,140,66,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={18} color="var(--accent-yellow)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{pr.exerciseName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-yellow)' }}>{pr.weight}{unitLabel} × {pr.reps}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent-orange)' }}>Est 1RM: {Math.round(pr.estimated1RM)}{unitLabel}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ════════ 3D ANATOMICAL BODY MAP ════════ */}
      {tab === 'body' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <MuscleHeatmap sessions={sessions} />
        </motion.div>
      )}
    </div>
  );
}
