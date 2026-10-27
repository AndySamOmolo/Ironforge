'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { ALL_EQUIPMENT, generateSmartWorkout, resolveWorkoutDayExercises } from '@/lib/utils/exerciseResolver';
import { MUSCLE_COLORS, SetType, type WorkoutSession } from '@/lib/types';

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
  { id: 'front_shoulders_l', muscle: 'shoulders', x: 48, y: 50, w: 24, h: 20, rx: 10 },
  { id: 'front_shoulders_r', muscle: 'shoulders', x: 128, y: 50, w: 24, h: 20, rx: 10 },
  { id: 'front_chest_l', muscle: 'chest', x: 66, y: 76, w: 30, h: 24, rx: 10 },
  { id: 'front_chest_r', muscle: 'chest', x: 104, y: 76, w: 30, h: 24, rx: 10 },
  { id: 'front_biceps_l', muscle: 'biceps', x: 40, y: 88, w: 16, h: 40, rx: 8 },
  { id: 'front_biceps_r', muscle: 'biceps', x: 144, y: 88, w: 16, h: 40, rx: 8 },
  { id: 'front_forearms_l', muscle: 'forearms', x: 34, y: 132, w: 14, h: 44, rx: 7 },
  { id: 'front_forearms_r', muscle: 'forearms', x: 152, y: 132, w: 14, h: 44, rx: 7 },
  { id: 'front_abs', muscle: 'abdominals', x: 84, y: 108, w: 32, h: 66, rx: 12 },
  { id: 'front_obliques_l', muscle: 'obliques', x: 66, y: 112, w: 14, h: 60, rx: 8 },
  { id: 'front_obliques_r', muscle: 'obliques', x: 120, y: 112, w: 14, h: 60, rx: 8 },
  { id: 'front_quads_l', muscle: 'quadriceps', x: 75, y: 194, w: 24, h: 90, rx: 11 },
  { id: 'front_quads_r', muscle: 'quadriceps', x: 101, y: 194, w: 24, h: 90, rx: 11 },
  { id: 'front_calves_l', muscle: 'calves', x: 79, y: 286, w: 15, h: 34, rx: 10 },
  { id: 'front_calves_r', muscle: 'calves', x: 106, y: 286, w: 15, h: 34, rx: 10 },
];

const BACK_REGIONS: Region[] = [
  { id: 'back_traps', muscle: 'traps', x: 84, y: 58, w: 32, h: 20, rx: 10 },
  { id: 'back_shoulders_l', muscle: 'shoulders', x: 48, y: 50, w: 24, h: 20, rx: 10 },
  { id: 'back_shoulders_r', muscle: 'shoulders', x: 128, y: 50, w: 24, h: 20, rx: 10 },
  { id: 'back_triceps_l', muscle: 'triceps', x: 40, y: 88, w: 16, h: 40, rx: 8 },
  { id: 'back_triceps_r', muscle: 'triceps', x: 144, y: 88, w: 16, h: 40, rx: 8 },
  { id: 'back_middle', muscle: 'middle back', x: 78, y: 86, w: 44, h: 52, rx: 12 },
  { id: 'back_lats_l', muscle: 'lats', x: 54, y: 96, w: 24, h: 76, rx: 11 },
  { id: 'back_lats_r', muscle: 'lats', x: 122, y: 96, w: 24, h: 76, rx: 11 },
  { id: 'back_lower', muscle: 'lower back', x: 84, y: 144, w: 32, h: 34, rx: 10 },
  { id: 'back_glutes_l', muscle: 'glutes', x: 76, y: 184, w: 24, h: 30, rx: 11 },
  { id: 'back_glutes_r', muscle: 'glutes', x: 100, y: 184, w: 24, h: 30, rx: 11 },
  { id: 'back_hamstrings_l', muscle: 'hamstrings', x: 76, y: 216, w: 22, h: 68, rx: 11 },
  { id: 'back_hamstrings_r', muscle: 'hamstrings', x: 102, y: 216, w: 22, h: 68, rx: 11 },
  { id: 'back_calves_l', muscle: 'calves', x: 81, y: 287, w: 14, h: 33, rx: 10 },
  { id: 'back_calves_r', muscle: 'calves', x: 105, y: 287, w: 14, h: 33, rx: 10 },
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

function blendHexColors(primary: string, secondary: string, weight: number): string {
  const blend = Math.max(0, Math.min(1, weight));
  const normalize = (value: string) => {
    const clean = value.replace('#', '');
    return clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  };

  const a = normalize(primary);
  const b = normalize(secondary);

  const toInt = (hex: string, i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  const r = Math.round(toInt(a, 0) * (1 - blend) + toInt(b, 0) * blend);
  const g = Math.round(toInt(a, 2) * (1 - blend) + toInt(b, 2) * blend);
  const bl = Math.round(toInt(a, 4) * (1 - blend) + toInt(b, 4) * blend);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function buildMuscleShapePath(region: Region, inset = 1): string {
  const width = region.w * inset;
  const height = region.h * inset;
  const x = region.x + (region.w - width) / 2;
  const y = region.y + (region.h - height) / 2;
  const left = x;
  const right = x + width;
  const top = y;
  const bottom = y + height;
  const midX = x + width / 2;
  const midY = y + height / 2;

  if (region.muscle === 'chest') {
    return [
      `M ${left} ${top + height * 0.22}`,
      `C ${left} ${top + height * 0.04}, ${midX - width * 0.22} ${top}, ${midX} ${top + height * 0.05}`,
      `C ${midX + width * 0.22} ${top}, ${right} ${top + height * 0.04}, ${right} ${top + height * 0.24}`,
      `C ${right} ${top + height * 0.52}, ${midX + width * 0.13} ${bottom}, ${midX} ${bottom - height * 0.03}`,
      `C ${midX - width * 0.13} ${bottom}, ${left} ${top + height * 0.5}, ${left} ${top + height * 0.22}`,
      'Z',
    ].join(' ');
  }

  if (region.muscle === 'shoulders') {
    return [
      `M ${midX} ${top}`,
      `C ${right} ${top + height * 0.1}, ${right} ${midY - height * 0.12}, ${right} ${midY}`,
      `C ${right} ${bottom - height * 0.18}, ${midX + width * 0.2} ${bottom}, ${midX} ${bottom}`,
      `C ${midX - width * 0.2} ${bottom}, ${left} ${bottom - height * 0.18}, ${left} ${midY}`,
      `C ${left} ${midY - height * 0.12}, ${left} ${top + height * 0.1}, ${midX} ${top}`,
      'Z',
    ].join(' ');
  }

  if (region.muscle === 'biceps' || region.muscle === 'triceps' || region.muscle === 'forearms' || region.muscle === 'calves') {
    return [
      `M ${midX - width * 0.16} ${top}`,
      `C ${left} ${top + height * 0.12}, ${left} ${midY - height * 0.12}, ${left} ${midY}`,
      `C ${left} ${bottom - height * 0.18}, ${midX - width * 0.12} ${bottom}, ${midX} ${bottom}`,
      `C ${midX + width * 0.12} ${bottom}, ${right} ${bottom - height * 0.18}, ${right} ${midY}`,
      `C ${right} ${midY - height * 0.12}, ${right} ${top + height * 0.12}, ${midX + width * 0.16} ${top}`,
      'Z',
    ].join(' ');
  }

  if (region.muscle === 'abdominals') {
    return [
      `M ${midX - width * 0.32} ${top + height * 0.04}`,
      `C ${midX - width * 0.4} ${top + height * 0.14}, ${midX - width * 0.22} ${top}, ${midX} ${top + height * 0.05}`,
      `C ${midX + width * 0.22} ${top}, ${midX + width * 0.4} ${top + height * 0.14}, ${midX + width * 0.32} ${top + height * 0.04}`,
      `C ${midX + width * 0.28} ${midY}, ${midX + width * 0.16} ${bottom}, ${midX} ${bottom}`,
      `C ${midX - width * 0.16} ${bottom}, ${midX - width * 0.28} ${midY}, ${midX - width * 0.32} ${top + height * 0.04}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${midX - width * 0.28} ${top + height * 0.12}`,
    `C ${left} ${top}, ${left} ${bottom - height * 0.18}, ${midX} ${bottom}`,
    `C ${right} ${bottom - height * 0.18}, ${right} ${top}, ${midX + width * 0.28} ${top + height * 0.12}`,
    'Z',
  ].join(' ');
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
  const isFront = title === 'Front';
  const rotationByRegion: Record<string, number> = {
    front_biceps_l: -14,
    front_biceps_r: 14,
    front_forearms_l: -10,
    front_forearms_r: 10,
    back_triceps_l: -14,
    back_triceps_r: 14,
    front_obliques_l: -10,
    front_obliques_r: 10,
    front_shoulders_l: -12,
    front_shoulders_r: 12,
    back_shoulders_l: -12,
    back_shoulders_r: 12,
    back_lats_l: -8,
    back_lats_r: 8,
    front_quads_l: -4,
    front_quads_r: 4,
    back_hamstrings_l: -5,
    back_hamstrings_r: 5,
  };

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
              <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0.11)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
            </linearGradient>
            <radialGradient id="anatomy-shade" cx="50%" cy="20%" r="80%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="65%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
            </radialGradient>
            {regions.map(region => {
              const value = intensity[region.id] || 0;
              const normalizedMuscle = normalizeMuscleName(region.muscle);
              const color = MUSCLE_COLORS[normalizedMuscle] || '#7C6AFF';
              const activeColor = blendHexColors(color, '#ff4a4a', Math.min(0.65, value * 0.85));
              const highlight = blendHexColors(activeColor, '#fff4ec', 0.52);
              const low = blendHexColors(activeColor, '#220d0a', 0.45);
              const gradId = `region-grad-${title}-${region.id}`;
              const sheenId = `region-sheen-${title}-${region.id}`;
              return (
                <g key={`defs-${title}-${region.id}`}>
                  <radialGradient id={gradId} cx="40%" cy="34%" r="76%">
                    <stop offset="0%" stopColor={hexToRgba(highlight, 0.28 + value * 0.52)} />
                    <stop offset="42%" stopColor={hexToRgba(activeColor, 0.24 + value * 0.62)} />
                    <stop offset="100%" stopColor={hexToRgba(low, 0.34 + value * 0.5)} />
                  </radialGradient>
                  <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hexToRgba('#ffffff', Math.min(0.36, value * 0.36))} />
                    <stop offset="48%" stopColor={hexToRgba('#ffffff', 0)} />
                    <stop offset="100%" stopColor={hexToRgba('#000000', Math.min(0.16, value * 0.18))} />
                  </linearGradient>
                </g>
              );
            })}
          </defs>

          <circle cx="100" cy="24" r="18" fill="url(#body-base)" stroke="rgba(255,255,255,0.2)" />
          <path d="M92 40 Q100 47 108 40 L110 49 L90 49 Z" fill="url(#body-base)" stroke="rgba(255,255,255,0.13)" />

          <path
            d={
              isFront
                ? "M62 54 Q72 46 84 48 L116 48 Q128 46 138 54 Q146 62 146 80 L146 122 Q145 144 132 162 Q122 176 116 192 L84 192 Q78 176 68 162 Q55 144 54 122 L54 80 Q54 62 62 54 Z"
                : "M60 56 Q70 48 84 50 L116 50 Q130 48 140 56 Q147 64 146 84 L144 126 Q141 152 126 172 Q116 184 116 196 L84 196 Q84 184 74 172 Q59 152 56 126 L54 84 Q53 64 60 56 Z"
            }
            fill="url(#body-base)"
            stroke="rgba(255,255,255,0.17)"
          />
          <path d="M55 78 Q44 88 46 112 L48 160 Q48 176 58 186 Q66 192 72 188 L70 162 Q66 130 67 98 Q67 86 63 76 Z" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <path d="M145 78 Q156 88 154 112 L152 160 Q152 176 142 186 Q134 192 128 188 L130 162 Q134 130 133 98 Q133 86 137 76 Z" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <path d="M86 192 Q78 204 76 224 L74 312 Q74 322 83 322 L95 322 Q100 322 100 314 L100 224 Q99 205 92 192 Z" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <path d="M114 192 Q122 204 124 224 L126 312 Q126 322 117 322 L105 322 Q100 322 100 314 L100 224 Q101 205 108 192 Z" fill="url(#body-base)" stroke="rgba(255,255,255,0.12)" />
          <path d="M100 62 L100 188" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          <ellipse cx="100" cy="120" rx="48" ry="82" fill="url(#anatomy-shade)" />

          {regions.map(region => {
            const value = intensity[region.id] || 0;
            const normalizedMuscle = normalizeMuscleName(region.muscle);
            const color = MUSCLE_COLORS[normalizedMuscle] || '#7C6AFF';
            const alpha = 0.4 + value * 0.6;
            let displayColor = color;
            if (value > 0.5) {
              const shift = Math.min(1, (value - 0.5) * 2);
              const r = parseInt(color.slice(1, 3), 16);
              const g = parseInt(color.slice(3, 5), 16);
              const b = parseInt(color.slice(5, 7), 16);
              const newR = Math.round(Math.min(255, r + (255 - r) * shift * 0.7));
              const newG = Math.round(g * (1 - shift * 0.5));
              const newB = Math.round(b * (1 - shift * 0.5));
              displayColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
            }
            const isStale = staleMuscles.has(normalizedMuscle);
            const isSelected = selectedMuscle === normalizedMuscle;
            const cx = region.x + region.w / 2;
            const cy = region.y + region.h / 2;
            const rotate = rotationByRegion[region.id] || 0;
            const regionPath = buildMuscleShapePath(region);
            const gradId = `region-grad-${title}-${region.id}`;
            const sheenId = `region-sheen-${title}-${region.id}`;
            return (
              <g key={region.id} style={{ cursor: 'pointer' }} onClick={() => onSelectMuscle(normalizedMuscle)}>
                <path
                  d={regionPath}
                  fill={value < 0.12 ? hexToRgba(displayColor, 0.2 + value * 0.3) : `url(#${gradId})`}
                  stroke={isSelected ? '#ffffff' : isStale ? '#F59E0B' : hexToRgba(displayColor, Math.min(1, alpha + 0.3))}
                  strokeWidth={isSelected ? 2.1 : value > 0.6 ? 1.4 : 1}
                  strokeDasharray={isStale ? '3 2' : undefined}
                  transform={`rotate(${rotate} ${cx} ${cy})`}
                />
                {value > 0.1 && (
                  <path
                    d={regionPath}
                    fill={`url(#${sheenId})`}
                    stroke="none"
                    transform={`rotate(${rotate} ${cx} ${cy})`}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function MuscleHeatmap({ sessions }: MuscleHeatmapProps) {
  const { equipment: userEquipment, barWeight, dumbbellWeight, defaultRestTime } = useUserStore();
  const { startWorkout } = useWorkoutStore();
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
    const allMainMuscles = ['chest', 'shoulders', 'biceps', 'triceps', 'lats', 'middle back', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'];
    for (const m of allMainMuscles) {
      const ts = lastTrainedAt[m] || 0;
      if (!ts || now - ts > staleThresholdMs) stale.add(m);
    }
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

  const handleTrainStaleMuscles = async () => {
    const targets = staleMuscles.size > 0 ? Array.from(staleMuscles).slice(0, 5) : ['chest', 'back', 'shoulders', 'quads'];
    const allExercises = await db.exercises.toArray();
    const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
    const generated = generateSmartWorkout({
      targetMuscles: targets,
      exerciseCount: 5,
      setsPerExercise: 3,
      repsPerSet: 10,
      allExercises,
      userEquipment: equip,
      seed: Date.now(),
    });
    const dayExercises = generated.map((item, i) => ({
      exerciseId: 0,
      exerciseName: item.name,
      sets: item.sets,
      reps: item.reps,
      restTime: defaultRestTime || 90,
      setType: SetType.Normal,
      order: i,
    }));
    const resolved = resolveWorkoutDayExercises({
      dayExercises,
      allExercises,
      userEquipment: equip,
      barWeight,
      dumbbellWeight,
      varietySeed: 0,
      varietyLevel: 'low',
    });
    startWorkout('Recovery & Balance', 'Untrained Muscle Focus', resolved);
  };

  if (!sessions.length) {
    return (
      <div className="empty-state" style={{ padding: 30 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔥</div>
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

      <div className="card" style={{ padding: 14, borderStyle: 'dashed', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Recovery & Balance Overlay</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Dashed orange outlines indicate muscles not trained in the last 9 days.
            {staleMuscles.size > 0 && (
              <span> Prioritize: <strong style={{ color: 'var(--accent-yellow)', textTransform: 'capitalize' }}>{Array.from(staleMuscles).slice(0, 5).join(', ')}</strong>.</span>
            )}
          </div>
        </div>
        {staleMuscles.size > 0 && (
          <button onClick={handleTrainStaleMuscles} className="btn-primary" style={{ minHeight: 42, padding: '10px 16px', fontSize: 12, borderRadius: 12 }}>
            <Play size={14} fill="white" /> Train Untrained Muscles Now
          </button>
        )}
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
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{idx + 1}. {row.name}</div>
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
