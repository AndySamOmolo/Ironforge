'use client';

import { useMemo, useState } from 'react';
import { Exercise, MuscleGroup, WorkoutSession } from '@/lib/types';
import { calculateWeeklyMuscleActivation, ColorBlindMode, TimeWindow } from '@/lib/activation/ActivationCalculator';
import { ALL_REGIONS, ANTERIOR_REGIONS, POSTERIOR_REGIONS, MuscleRegion } from '@/lib/data/AnatomyModel';
import { getActivationFill, getLegendGradient } from '@/lib/rendering/VisualRenderer';
import { Eye, Sparkles } from 'lucide-react';

interface Props {
  muscleVolumes: Partial<Record<MuscleGroup, number>>;
  sessions?: WorkoutSession[];
  exercises?: Exercise[];
  bodyweightKg?: number;
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pectorals (Chest)',
  back: 'Upper & Mid Back',
  shoulders: 'Deltoids (Shoulders)',
  biceps: 'Biceps Brachii',
  triceps: 'Triceps Brachii',
  forearms: 'Forearms & Brachioradialis',
  quadriceps: 'Quadriceps Femoris',
  hamstrings: 'Hamstrings & Biceps Femoris',
  glutes: 'Gluteus Maximus & Medius',
  calves: 'Gastrocnemius & Soleus',
  abdominals: 'Abdominals & Obliques',
  traps: 'Trapezius',
  lats: 'Latissimus Dorsi',
  'lower back': 'Erector Spinae (Lower Back)',
};

const SAMPLE_PREVIEW_ACTIVATION: Record<MuscleGroup, number> = {
  chest: 92,
  lats: 84,
  shoulders: 78,
  quadriceps: 88,
  biceps: 68,
  triceps: 74,
  glutes: 64,
  hamstrings: 58,
  back: 76,
  traps: 52,
  abdominals: 62,
  calves: 46,
  forearms: 42,
  'lower back': 48,
};

const ANTERIOR_OUTLINE = `
  M 100 10
  C 113 10, 121 19, 121 31
  C 121 41, 115 49, 111 53
  L 114 60
  C 128 63, 146 68, 156 79
  C 164 89, 166 106, 164 123
  C 167 139, 171 159, 173 177
  L 179 191
  C 181 197, 176 204, 170 202
  L 164 188
  C 159 170, 154 148, 149 130
  L 145 106
  C 141 124, 136 146, 133 166
  C 138 179, 141 193, 140 212
  C 143 238, 141 268, 136 294
  C 139 318, 138 349, 132 374
  L 135 389
  L 117 391
  L 118 374
  C 114 348, 113 321, 115 294
  C 111 266, 108 238, 106 214
  L 100 210
  L 94 214
  C 92 238, 89 266, 85 294
  C 87 321, 86 348, 82 374
  L 83 391
  L 65 389
  L 68 374
  C 62 349, 61 318, 64 294
  C 59 268, 57 238, 60 212
  C 59 193, 62 179, 67 166
  C 64 146, 59 124, 55 106
  L 51 130
  C 46 148, 41 170, 36 188
  L 30 202
  C 24 204, 19 197, 21 191
  L 27 177
  C 29 159, 33 139, 36 123
  C 34 106, 36 89, 44 79
  C 54 68, 72 63, 86 60
  L 89 53
  C 85 49, 79 41, 79 31
  C 79 19, 87 10, 100 10 Z
`;

function AnatomyCanvas({
  title,
  subtitle,
  regions,
  selectedMuscle,
  onSelect,
  getRegionPct,
  colorBlindMode,
  staleChecker,
  overtrainChecker,
}: {
  title: string;
  subtitle: string;
  regions: MuscleRegion[];
  selectedMuscle: MuscleGroup | null;
  onSelect: (m: MuscleGroup) => void;
  getRegionPct: (r: MuscleRegion) => number;
  colorBlindMode: ColorBlindMode;
  staleChecker: (m: MuscleGroup) => boolean;
  overtrainChecker: (m: MuscleGroup) => boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 145, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ marginBottom: 8, textAlign: 'center' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>{subtitle}</div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: 195,
        background: 'radial-gradient(ellipse at 50% 35%, rgba(99,102,241,0.09) 0%, rgba(15,15,24,0.6) 68%, rgba(10,10,16,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 18,
        padding: '10px 6px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 28px rgba(0,0,0,0.35)',
      }}>
        <svg viewBox="0 0 200 402" style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}>
          <defs>
            <linearGradient id={`silGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.055)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.025)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.045)" />
            </linearGradient>

            <pattern id={`hatch-${title}`} width="5" height="5" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
            </pattern>

            <filter id={`muscleGlow-${title}`} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Base anatomical silhouette */}
          <path
            d={ANTERIOR_OUTLINE}
            fill={`url(#silGrad-${title})`}
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="1.15"
            strokeLinejoin="round"
          />

          {/* Subtle anatomical center line & clavicular/pelvic landmarks */}
          <line x1="100" y1="58" x2="100" y2="205" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" strokeDasharray="2 3" />
          <path d="M 65 65 Q 100 72 135 65" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

          {/* Muscle belly regions */}
          {regions.map((region) => {
            const pct = getRegionPct(region);
            const active = pct > 5;
            const high = pct >= 65;
            const isSelected = selectedMuscle === region.muscle;
            const fill = getActivationFill(pct, colorBlindMode);
            const stale = staleChecker(region.muscle);
            const over = overtrainChecker(region.muscle);

            return (
              <g
                key={region.id}
                onClick={() => onSelect(region.muscle)}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${region.label}: ${Math.round(pct)}% activation`}</title>
                <path
                  d={region.path}
                  fill={fill}
                  stroke={
                    isSelected
                      ? '#ffffff'
                      : over
                      ? '#ef4444'
                      : stale
                      ? '#60a5fa'
                      : active
                      ? 'rgba(255,255,255,0.42)'
                      : 'rgba(255,255,255,0.12)'
                  }
                  strokeWidth={isSelected ? 1.85 : active ? 0.95 : 0.65}
                  strokeLinejoin="round"
                  filter={high || isSelected ? `url(#muscleGlow-${title})` : undefined}
                  style={{ transition: 'fill 260ms ease, stroke 180ms ease, stroke-width 180ms ease' }}
                />

                {/* Muscle fiber striation lines */}
                {region.fiberLines?.map((fiber, idx) => (
                  <path
                    key={idx}
                    d={fiber}
                    fill="none"
                    stroke={active ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.07)'}
                    strokeWidth={0.55}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}

                {/* High-activation hatch overlay for accessibility */}
                {pct >= 75 && (
                  <path
                    d={region.path}
                    fill={`url(#hatch-${title})`}
                    opacity={0.32}
                    style={{ pointerEvents: 'none' }}
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

export default function MuscleHeatmap({ muscleVolumes, sessions = [], exercises = [], bodyweightKg = 75 }: Props) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d');
  const [colorBlindMode, setColorBlindMode] = useState<ColorBlindMode>('standard');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>('chest');
  const [showSampleWhenEmpty, setShowSampleWhenEmpty] = useState<boolean>(true);

  const hasLoggedWorkouts = sessions.length > 0;
  const isSampleActive = !hasLoggedWorkouts && showSampleWhenEmpty;

  const model = useMemo(() => {
    if (sessions.length > 0 && exercises.length > 0) {
      return calculateWeeklyMuscleActivation({
        sessions,
        exercises,
        bodyweightKg,
        timeWindow,
        colorBlindMode,
      });
    }

    const fallbackActivation: Record<MuscleGroup, number> = {
      chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, forearms: 0,
      quadriceps: 0, hamstrings: 0, glutes: 0, calves: 0, abdominals: 0, traps: 0, lats: 0, 'lower back': 0,
    };

    (Object.keys(fallbackActivation) as MuscleGroup[]).forEach((m) => {
      if (isSampleActive) {
        fallbackActivation[m] = SAMPLE_PREVIEW_ACTIVATION[m] || 50;
      } else {
        fallbackActivation[m] = Math.round(Math.max(0, Math.min(1, muscleVolumes[m] || 0)) * 100);
      }
    });

    const regionPct: Record<string, number> = {};
    ALL_REGIONS.forEach((r) => {
      regionPct[r.id] = fallbackActivation[r.muscle] || 0;
    });

    const details = (Object.keys(fallbackActivation) as MuscleGroup[]).reduce((acc, m) => {
      const act = fallbackActivation[m];
      // Clamp recovery strictly to 0-100%, and compute realistic sample recovery when Sample Preview is active
      const sampleRec = isSampleActive ? Math.max(45, Math.min(100, 100 - Math.round(act * 0.42))) : 100;
      const sampleSets = isSampleActive ? Math.max(4, Math.round(act / 9)) : 0;
      acc[m] = {
        muscle: m,
        rawScore: act,
        normalizedScore: act,
        effectiveSets: sampleSets,
        volumeLoad: isSampleActive ? sampleSets * 540 : 0,
        lastTrainedAt: isSampleActive ? Date.now() - 36 * 3600 * 1000 : null,
        recoveryPercentage: sampleRec,
        stale: !isSampleActive,
        overtrained: false,
        synergyBonus: 0,
        topExercises: isSampleActive ? [{ name: 'Sample Hypertrophy Block', score: act }] : [],
      };
      return acc;
    }, {} as ReturnType<typeof calculateWeeklyMuscleActivation>['details']);

    return {
      musclePercentages: fallbackActivation,
      regionPercentages: regionPct,
      details,
      overallScore: Math.round(Object.values(fallbackActivation).reduce((a, b) => a + b, 0) / 14),
    };
  }, [sessions, exercises, bodyweightKg, timeWindow, colorBlindMode, muscleVolumes, isSampleActive]);

  const getRegionPct = (r: MuscleRegion) => model.regionPercentages[r.id] ?? model.musclePercentages[r.muscle] ?? 0;

  const sortedMuscles = useMemo(() => {
    return (Object.keys(MUSCLE_LABELS) as MuscleGroup[]).sort(
      (a, b) => (model.musclePercentages[b] || 0) - (model.musclePercentages[a] || 0)
    );
  }, [model.musclePercentages]);

  const activeSelection = selectedMuscle || sortedMuscles[0] || 'chest';
  const selectedDetail = model.details[activeSelection];
  const clampedRecovery = selectedDetail ? Math.max(0, Math.min(100, Math.round(selectedDetail.recoveryPercentage))) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Sample Preview Banner when 0 sessions are logged */}
      {!hasLoggedWorkouts && (
        <div style={{
          width: '100%', marginBottom: 12, padding: '9px 12px', borderRadius: 'var(--radius-md)',
          background: isSampleActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
          border: isSampleActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <Sparkles size={13} color="var(--accent-primary)" />
            <span>
              {isSampleActive
                ? 'Showing Sample Hypertrophy Preview (0 workouts logged)'
                : 'Showing 0% Untrained Baseline'}
            </span>
          </div>
          <button
            onClick={() => setShowSampleWhenEmpty((prev) => !prev)}
            style={{
              padding: '4px 9px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-glass)',
              background: 'rgba(255,255,255,0.06)', color: 'var(--accent-secondary)', fontSize: '0.66rem',
              fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
            }}
          >
            <Eye size={11} /> {isSampleActive ? 'Show 0% Baseline' : 'Sample Preview'}
          </button>
        </div>
      )}

      {/* Time Window & Palette Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['7d', '14d', '30d', 'all'] as TimeWindow[]).map((w) => (
            <button
              key={w}
              className={`chip ${timeWindow === w ? 'active' : ''}`}
              onClick={() => setTimeWindow(w)}
              style={{ padding: '4px 10px', fontSize: '0.68rem' }}
            >
              {w === 'all' ? 'All-Time' : w.toUpperCase()}
            </button>
          ))}
        </div>

        <select
          className="input"
          value={colorBlindMode}
          onChange={(e) => setColorBlindMode(e.target.value as ColorBlindMode)}
          style={{ width: 'auto', padding: '4px 10px', fontSize: '0.68rem', height: 28 }}
          aria-label="Heatmap palette"
        >
          <option value="standard">Thermal Spectrum</option>
          <option value="ecorche">Crimson Ecorché</option>
          <option value="deuteranopia">Deuteranopia Safe</option>
          <option value="protanopia">Protanopia Safe</option>
          <option value="tritanopia">Tritanopia Safe</option>
        </select>
      </div>

      {/* Dual Anterior / Posterior Anatomical Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, width: '100%', flexWrap: 'wrap' }}>
        <AnatomyCanvas
          title="Anterior"
          subtitle="Front Musculature"
          regions={ANTERIOR_REGIONS}
          selectedMuscle={activeSelection}
          onSelect={setSelectedMuscle}
          getRegionPct={getRegionPct}
          colorBlindMode={colorBlindMode}
          staleChecker={(m) => Boolean(model.details[m]?.stale)}
          overtrainChecker={(m) => Boolean(model.details[m]?.overtrained)}
        />
        <AnatomyCanvas
          title="Posterior"
          subtitle="Back Musculature"
          regions={POSTERIOR_REGIONS}
          selectedMuscle={activeSelection}
          onSelect={setSelectedMuscle}
          getRegionPct={getRegionPct}
          colorBlindMode={colorBlindMode}
          staleChecker={(m) => Boolean(model.details[m]?.stale)}
          overtrainChecker={(m) => Boolean(model.details[m]?.overtrained)}
        />
      </div>

      {/* Sequential Intensity Scale Legend */}
      <div style={{ width: '100%', marginTop: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.025)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', color: 'var(--text-tertiary)', marginBottom: 5, fontWeight: 600 }}>
          <span>0% Untrained</span>
          <span>25% Light</span>
          <span>50% Moderate</span>
          <span>75% High</span>
          <span>100% Peak</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: getLegendGradient(colorBlindMode) }} />
      </div>

      {/* Quick Muscle Selector Pills (Placed directly above the Selected Muscle Inspector Card) */}
      <div className="chip-scroll" style={{ width: '100%', marginTop: 12 }}>
        {sortedMuscles.map((m) => {
          const pct = Math.round(model.musclePercentages[m] || 0);
          return (
            <button
              key={m}
              className={`chip ${activeSelection === m ? 'active' : ''}`}
              onClick={() => setSelectedMuscle(m)}
              style={{ fontSize: '0.68rem', padding: '5px 10px', textTransform: 'capitalize' }}
            >
              {m} • {pct}%
            </button>
          );
        })}
      </div>

      {/* Selected Muscle Inspector Card */}
      {selectedDetail && (
        <div style={{
          width: '100%',
          marginTop: 10,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {MUSCLE_LABELS[activeSelection]}
                </span>
                {isSampleActive && (
                  <span className="badge badge-accent" style={{ fontSize: '0.56rem', padding: '2px 6px' }}>Sample</span>
                )}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                {selectedDetail.lastTrainedAt
                  ? isSampleActive
                    ? 'Sample preview • ~36h since stimulus'
                    : `Last trained ${new Date(selectedDetail.lastTrainedAt).toLocaleDateString()}`
                  : 'No logged sets in selected window'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                {Math.round(selectedDetail.normalizedScore)}%
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Activation</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', padding: '8px 10px', borderRadius: 10 }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Effective Sets</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{selectedDetail.effectiveSets}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', padding: '8px 10px', borderRadius: 10 }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Recovery</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: clampedRecovery >= 85 ? 'var(--success)' : 'var(--warning)' }}>
                {clampedRecovery}%
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', padding: '8px 10px', borderRadius: 10 }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Status</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: selectedDetail.overtrained ? 'var(--danger)' : selectedDetail.stale ? '#60a5fa' : 'var(--success)' }}>
                {selectedDetail.overtrained ? 'High Fatigue' : selectedDetail.stale ? 'Untrained' : 'Optimal'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
