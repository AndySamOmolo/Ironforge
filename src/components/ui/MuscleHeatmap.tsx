'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/db/schema';
import { MUSCLE_COLORS, type WorkoutSession } from '@/lib/types';

type MuscleHeatmapProps = {
  sessions: WorkoutSession[];
};

type TimeRange = '7d' | '30d' | 'all';

type Region = {
  id: string;
  muscle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
};

const FRONT_REGIONS: Region[] = [
  { id: 'front_shoulders_l', muscle: 'shoulders', x: 44, y: 42, w: 22, h: 18, rx: 9 },
  { id: 'front_shoulders_r', muscle: 'shoulders', x: 134, y: 42, w: 22, h: 18, rx: 9 },
  { id: 'front_chest_l', muscle: 'chest', x: 60, y: 64, w: 30, h: 26, rx: 10 },
  { id: 'front_chest_r', muscle: 'chest', x: 110, y: 64, w: 30, h: 26, rx: 10 },
  { id: 'front_biceps_l', muscle: 'biceps', x: 38, y: 78, w: 16, h: 38, rx: 8 },
  { id: 'front_biceps_r', muscle: 'biceps', x: 146, y: 78, w: 16, h: 38, rx: 8 },
  { id: 'front_forearms_l', muscle: 'forearms', x: 34, y: 118, w: 14, h: 42, rx: 7 },
  { id: 'front_forearms_r', muscle: 'forearms', x: 152, y: 118, w: 14, h: 42, rx: 7 },
  { id: 'front_abs', muscle: 'abdominals', x: 80, y: 98, w: 40, h: 62, rx: 12 },
  { id: 'front_obliques_l', muscle: 'obliques', x: 60, y: 100, w: 16, h: 58, rx: 8 },
  { id: 'front_obliques_r', muscle: 'obliques', x: 124, y: 100, w: 16, h: 58, rx: 8 },
  { id: 'front_quads_l', muscle: 'quadriceps', x: 74, y: 168, w: 24, h: 76, rx: 10 },
  { id: 'front_quads_r', muscle: 'quadriceps', x: 102, y: 168, w: 24, h: 76, rx: 10 },
  { id: 'front_calves_l', muscle: 'calves', x: 74, y: 252, w: 20, h: 58, rx: 10 },
  { id: 'front_calves_r', muscle: 'calves', x: 106, y: 252, w: 20, h: 58, rx: 10 },
];

const BACK_REGIONS: Region[] = [
  { id: 'back_traps', muscle: 'traps', x: 82, y: 52, w: 36, h: 20, rx: 10 },
  { id: 'back_shoulders_l', muscle: 'shoulders', x: 44, y: 42, w: 22, h: 18, rx: 9 },
  { id: 'back_shoulders_r', muscle: 'shoulders', x: 134, y: 42, w: 22, h: 18, rx: 9 },
  { id: 'back_triceps_l', muscle: 'triceps', x: 38, y: 78, w: 16, h: 38, rx: 8 },
  { id: 'back_triceps_r', muscle: 'triceps', x: 146, y: 78, w: 16, h: 38, rx: 8 },
  { id: 'back_middle', muscle: 'middle back', x: 74, y: 74, w: 52, h: 54, rx: 12 },
  { id: 'back_lats_l', muscle: 'lats', x: 50, y: 86, w: 24, h: 70, rx: 11 },
  { id: 'back_lats_r', muscle: 'lats', x: 126, y: 86, w: 24, h: 70, rx: 11 },
  { id: 'back_lower', muscle: 'lower back', x: 82, y: 130, w: 36, h: 34, rx: 10 },
  { id: 'back_glutes_l', muscle: 'glutes', x: 76, y: 166, w: 24, h: 28, rx: 10 },
  { id: 'back_glutes_r', muscle: 'glutes', x: 100, y: 166, w: 24, h: 28, rx: 10 },
  { id: 'back_hamstrings_l', muscle: 'hamstrings', x: 74, y: 198, w: 24, h: 62, rx: 10 },
  { id: 'back_hamstrings_r', muscle: 'hamstrings', x: 102, y: 198, w: 24, h: 62, rx: 10 },
  { id: 'back_calves_l', muscle: 'calves', x: 74, y: 262, w: 20, h: 54, rx: 10 },
  { id: 'back_calves_r', muscle: 'calves', x: 106, y: 262, w: 20, h: 54, rx: 10 },
];

const ALL_REGIONS = [...FRONT_REGIONS, ...BACK_REGIONS];

const muscleAliases: Record<string, string> = {
  abs: 'abdominals',
  core: 'abdominals',
  pectorals: 'chest',
  delts: 'shoulders',
  deltoids: 'shoulders',
  quads: 'quadriceps',
  'upper back': 'middle back',
  back: 'middle back',
  spine: 'lower back',
};

function normalizeMuscleName(name: string): string {
  const key = name.trim().toLowerCase();
  return muscleAliases[key] || key;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function BodyFigure({
  title,
  regions,
  intensity,
  staleMuscles,
  selectedMuscle,
  onSelectMuscle,
}: {
  title: string;
  regions: Region[];
  intensity: Record<string, number>;
  staleMuscles: Set<string>;
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string) => void;
}) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>{title}</div>
      <div style={{
        borderRadius: 14,
        border: '1px solid var(--border-subtle)',
        background: 'radial-gradient(circle at 50% 0%, rgba(124,106,255,0.15), rgba(10,12,24,0.5))',
        padding: 8,
      }}>
        <svg viewBox="0 0 200 330" width="100%" height="330" role="img" aria-label={`${title} muscle activation`}>
          <defs>
            <linearGradient id="body-base" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>
          </defs>

          <circle cx="100" cy="26" r="18" fill="url(#body-base)" stroke="rgba(255,255,255,0.16)" />
          <rect x="76" y="44" width="48" height="124" rx="20" fill="url(#body-base)" stroke="rgba(255,255,255,0.16)" />
          <rect x="48" y="56" width="24" height="118" rx="12" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <rect x="128" y="56" width="24" height="118" rx="12" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <rect x="74" y="166" width="24" height="148" rx="12" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <rect x="102" y="166" width="24" height="148" rx="12" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />

          {regions.map(region => {
            const value = intensity[region.id] || 0;
            const normalizedMuscle = normalizeMuscleName(region.muscle);
            const color = MUSCLE_COLORS[normalizedMuscle] || '#7C6AFF';
            const alpha = 0.08 + value * 0.88;
            const isStale = staleMuscles.has(normalizedMuscle);
            const isSelected = selectedMuscle === normalizedMuscle;
            return (
              <rect
                key={region.id}
                x={region.x}
                y={region.y}
                width={region.w}
                height={region.h}
                rx={region.rx || 8}
                fill={hexToRgba(color, alpha)}
                stroke={isSelected ? '#ffffff' : isStale ? '#F59E0B' : hexToRgba(color, Math.min(1, alpha + 0.18))}
                strokeWidth={isSelected ? 2 : value > 0.6 ? 1.4 : 1}
                strokeDasharray={isStale ? '3 2' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectMuscle(normalizedMuscle)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function MuscleHeatmap({ sessions }: MuscleHeatmapProps) {
  const [muscleScores, setMuscleScores] = useState<Record<string, number>>({});
  const [lastTrainedAt, setLastTrainedAt] = useState<Record<string, number>>({});
  const [muscleExerciseScores, setMuscleExerciseScores] = useState<Record<string, Record<string, number>>>({});
  const [range, setRange] = useState<TimeRange>('30d');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (range === 'all') return sessions;
    const now = Date.now();
    const days = range === '7d' ? 7 : 30;
    const threshold = now - days * 24 * 60 * 60 * 1000;
    return sessions.filter(s => new Date(s.startedAt).getTime() >= threshold);
  }, [sessions, range]);

  useEffect(() => {
    const run = async () => {
      const sessionIds = sessions.map(s => s.id).filter((id): id is number => typeof id === 'number');
      const filteredSessionIds = new Set(
        filteredSessions.map(s => s.id).filter((id): id is number => typeof id === 'number'),
      );
      if (!sessionIds.length) {
        setMuscleScores({});
        setLastTrainedAt({});
        setMuscleExerciseScores({});
        return;
      }

      const sets = await db.sets.where('sessionId').anyOf(sessionIds).toArray();
      const exerciseIds = [...new Set(sets.map(set => set.exerciseId).filter((id): id is number => typeof id === 'number'))];
      if (!exerciseIds.length) {
        setMuscleScores({});
        return;
      }

      const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray();
      const byId = new Map<number, (typeof exercises)[number]>();
      exercises.forEach(ex => {
        if (typeof ex.id === 'number') byId.set(ex.id, ex);
      });

      const scores: Record<string, number> = {};
      const trainedAt: Record<string, number> = {};
      const details: Record<string, Record<string, number>> = {};
      const sessionDateMap = new Map<number, number>();
      sessions.forEach(session => {
        if (typeof session.id === 'number') {
          sessionDateMap.set(session.id, new Date(session.completedAt || session.startedAt).getTime());
        }
      });

      for (const set of sets) {
        const ex = byId.get(set.exerciseId);
        if (!ex) continue;

        const setTimestamp = set.completedAt ? new Date(set.completedAt).getTime() : (sessionDateMap.get(set.sessionId) || Date.now());

        const loadFactor = Math.max(1, Math.sqrt(Math.max(1, set.weight * set.reps)) / 3.2);
        const primary = (ex.primaryMuscles || []).map(normalizeMuscleName);
        const secondary = (ex.secondaryMuscles || []).map(normalizeMuscleName);

        [...primary, ...secondary].forEach(m => {
          trainedAt[m] = Math.max(trainedAt[m] || 0, setTimestamp);
        });

        if (!filteredSessionIds.has(set.sessionId)) continue;

        primary.forEach(m => {
          const score = 1.25 * loadFactor;
          scores[m] = (scores[m] || 0) + score;
          if (!details[m]) details[m] = {};
          details[m][ex.name] = (details[m][ex.name] || 0) + score;
        });
        secondary.forEach(m => {
          const score = 0.7 * loadFactor;
          scores[m] = (scores[m] || 0) + score;
          if (!details[m]) details[m] = {};
          details[m][ex.name] = (details[m][ex.name] || 0) + score;
        });
      }

      setMuscleScores(scores);
      setLastTrainedAt(trainedAt);
      setMuscleExerciseScores(details);
    };

    run().catch(() => setMuscleScores({}));
  }, [sessions, filteredSessions]);

  const normalizedByMuscle = useMemo(() => {
    const entries = Object.entries(muscleScores);
    if (!entries.length) return {} as Record<string, number>;
    const max = entries.reduce((acc, [, value]) => Math.max(acc, value), 0);
    if (max <= 0) return {} as Record<string, number>;

    const out: Record<string, number> = {};
    entries.forEach(([muscle, value]) => {
      out[muscle] = Math.min(1, value / max);
    });
    return out;
  }, [muscleScores]);

  const intensityByRegion = useMemo(() => {
    const out: Record<string, number> = {};
    ALL_REGIONS.forEach(region => {
      const key = normalizeMuscleName(region.muscle);
      out[region.id] = normalizedByMuscle[key] || 0;
    });
    return out;
  }, [normalizedByMuscle]);

  const topMuscles = useMemo(() => {
    return Object.entries(normalizedByMuscle)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [normalizedByMuscle]);

  const staleMuscles = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 9 * 24 * 60 * 60 * 1000;
    const stale = new Set<string>();
    Object.entries(lastTrainedAt).forEach(([muscle, timestamp]) => {
      if (now - timestamp > staleThresholdMs) stale.add(muscle);
    });
    return stale;
  }, [lastTrainedAt]);

  const selectedMuscleDetails = useMemo(() => {
    if (!selectedMuscle) return [] as Array<{ name: string; score: number }>;
    const byExercise = muscleExerciseScores[selectedMuscle] || {};
    return Object.entries(byExercise)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [muscleExerciseScores, selectedMuscle]);

  if (!sessions.length) {
    return (
      <div className="empty-state" style={{ padding: 30 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>Heatmap</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No workout data yet</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          Complete workouts to reveal a muscle activation map based on your completed sets.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card hero-gradient" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Muscle Activation Heatmap</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              Built from your completed workout sets and exercise muscle targeting.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {([
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: 'all', label: 'ALL' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                className={range === opt.id ? 'btn-primary btn-high-contrast' : 'btn-secondary'}
                onClick={() => setRange(opt.id)}
                style={{ minHeight: 30, padding: '6px 10px', fontSize: 11, borderRadius: 9 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          {filteredSessions.length} completed sessions in selected range
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <BodyFigure
          title="Front"
          regions={FRONT_REGIONS}
          intensity={intensityByRegion}
          staleMuscles={staleMuscles}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={setSelectedMuscle}
        />
        <BodyFigure
          title="Back"
          regions={BACK_REGIONS}
          intensity={intensityByRegion}
          staleMuscles={staleMuscles}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={setSelectedMuscle}
        />
      </div>

      <div className="card" style={{ padding: 12, borderStyle: 'dashed' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Recovery Bias Overlay</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Dashed orange outlines indicate muscles not trained in the last 9 days.
          {staleMuscles.size > 0 && (
            <span> Prioritize one of these soon: {Array.from(staleMuscles).slice(0, 6).join(', ')}.</span>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Top Trained Muscles</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {topMuscles.map(([muscle, value]) => {
            const color = MUSCLE_COLORS[muscle] || '#7C6AFF';
            return (
              <div key={muscle} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 8, background: 'var(--bg-glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{muscle}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(value * 100)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(6, Math.round(value * 100))}%`, background: `linear-gradient(90deg, ${hexToRgba(color, 0.55)}, ${hexToRgba(color, 0.95)})` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedMuscle && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'capitalize' }}>{selectedMuscle} exercise contributors</div>
            <button className="btn-secondary" onClick={() => setSelectedMuscle(null)} style={{ minHeight: 30, padding: '6px 10px', fontSize: 11 }}>
              Clear
            </button>
          </div>
          {selectedMuscleDetails.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No exercise details found in selected range.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedMuscleDetails.map((row, idx) => (
                <div key={row.name} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 10px', background: 'var(--bg-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{idx + 1}. {row.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(row.score * 10) / 10}</div>
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
