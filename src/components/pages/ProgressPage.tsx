'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Calendar, Clock, Dumbbell, TrendingUp, Trophy, Target, Zap } from 'lucide-react';
import { db } from '@/lib/db/schema';
import type { WorkoutSession, PersonalRecord } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import MuscleHeatmap from '@/components/ui/MuscleHeatmap';

export default function ProgressPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [tab, setTab] = useState<'overview' | 'strength' | 'records' | 'body'>('overview');
  const [timeFrame, setTimeFrame] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const allSessions = await db.workoutSessions.orderBy('startedAt').reverse().toArray();
    // Only use completed sessions for stats
    setSessions(allSessions.filter(s => s.isComplete));
    const allPRs = await db.personalRecords.orderBy('date').reverse().toArray();
    setPrs(allPRs);
  };

  const thisWeekSessions = sessions.filter(s => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return new Date(s.startedAt) >= weekAgo;
  });

  const totalVolume = sessions.reduce((a, s) => a + (s.totalVolume || 0), 0);
  const avgDuration = sessions.length > 0 ? Math.round(sessions.reduce((a, s) => a + s.duration, 0) / sessions.length / 60) : 0;

  // Weekly volume chart data
  const getWeeklyData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    return days.map((day, i) => {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay() + i);
      const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
      const daySessions = sessions.filter(s => {
        const sd = new Date(s.startedAt);
        return sd >= dayStart && sd <= dayEnd;
      });
      return { day, volume: daySessions.reduce((a, s) => a + (s.totalVolume || 0), 0), sets: daySessions.reduce((a, s) => a + (s.totalSets || 0), 0), workouts: daySessions.length };
    });
  };

  // 8-week trend data
  const getTrendData = () => {
    const weeks: { week: string; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const now = new Date();
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekSessions = sessions.filter(s => {
        const sd = new Date(s.startedAt);
        return sd >= weekStart && sd < weekEnd;
      });
      weeks.push({
        week: `W${8 - i}`,
        volume: weekSessions.reduce((a, s) => a + (s.totalVolume || 0), 0),
      });
    }
    return weeks;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="icon-badge" style={{ background: 'rgba(0,229,160,0.1)', width: 38, height: 38, borderRadius: 10 }}>
            <BarChart3 size={18} color="var(--accent-green)" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Progress</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Track your journey
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 20 }}>
        {([
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'strength', label: 'Strength', icon: TrendingUp },
          { id: 'records', label: 'Records', icon: Trophy },
          { id: 'body', label: 'Body', icon: Target },
        ] as const).map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'btn-primary btn-high-contrast' : 'btn-secondary'}
            onClick={() => setTab(t.id)}
            style={{
              textTransform: 'none',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 44,
              borderRadius: 12,
            }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { icon: Dumbbell, value: sessions.length, label: 'Total', color: 'var(--accent-purple)', bg: 'rgba(124,106,255,0.08)' },
              { icon: Calendar, value: thisWeekSessions.length, label: 'This Week', color: 'var(--accent-green)', bg: 'rgba(0,229,160,0.08)' },
              { icon: Clock, value: `${avgDuration}m`, label: 'Avg Duration', color: 'var(--accent-orange)', bg: 'rgba(255,140,66,0.08)' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="stat-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="icon-badge" style={{ background: stat.bg, width: 32, height: 32, borderRadius: 8 }}>
                  <stat.icon size={16} color={stat.color} />
                </div>
                <div className="stat-value" style={{ fontSize: 22 }}>{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Weekly Volume Chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card" style={{ marginBottom: 16, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Weekly Volume (kg)</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getWeeklyData()} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-sheet)', border: '1px solid var(--border-bright)', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                    itemStyle={{ color: 'var(--accent-red)' }}
                  />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF3B5C" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#FF6B3D" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="volume" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Volume Trend */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card" style={{ marginBottom: 16, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Volume Trend (8 weeks)</h3>
            <div style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getTrendData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip contentStyle={{ background: 'var(--bg-sheet)', border: '1px solid var(--border-bright)', borderRadius: 12, fontSize: 12 }} />
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C6AFF" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7C6AFF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="volume" stroke="#7C6AFF" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 4, fill: '#7C6AFF', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Total Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-red)' }}>
              <div className="stat-label">Total Volume</div>
              <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{formatVolume(totalVolume)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span></div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-yellow)' }}>
              <div className="stat-label">Personal Records</div>
              <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>{prs.length}</div>
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'strength' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card hero-gradient" style={{ marginBottom: 16, padding: 20, textAlign: 'center' }}>
            <Zap size={32} color="var(--accent-yellow)" style={{ marginBottom: 8 }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Strength Tracking</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              Complete more workouts to see your strength progress.<br />
              We track your estimated 1RM for all exercises.
            </p>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state">
              <Target size={48} color="var(--text-muted)" />
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>No data yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Complete your first workout to start tracking strength.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.slice(0, 10).map((s, i) => (
                <div key={s.id || i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,59,92,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Dumbbell size={18} color="var(--accent-red)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.planName || s.dayName || 'Workout'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)' }}>{formatVolume(s.totalVolume)} kg</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.totalSets} sets</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'records' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {prs.length === 0 ? (
            <div className="empty-state">
              <Trophy size={48} color="var(--accent-yellow)" />
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>No PRs yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Personal records are automatically tracked when you beat your previous best weight × reps for any exercise.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prs.map((pr, i) => (
                <motion.div key={pr.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255,209,102,0.15), rgba(255,140,66,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={18} color="var(--accent-yellow)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{pr.exerciseName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-yellow)' }}>{pr.weight}kg × {pr.reps}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent-orange)' }}>1RM: {Math.round(pr.estimated1RM)}kg</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'body' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <MuscleHeatmap sessions={sessions} />
        </motion.div>
      )}
    </div>
  );
}
