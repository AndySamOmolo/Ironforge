import { db } from '../db/schema';
import { ALL_REGIONS, getAdjacentRegions } from '../data/AnatomyModel';
import { getRegionsForMuscle, resolveExerciseTargeting } from '../data/ExerciseTargetingDatabase';
import {
  calculateDetraining,
  calculateRecoveryPercentage,
  detectOvertraining,
  inferMuscleFromRegion,
  isStaleMuscle,
} from './RecoveryTracker';
import type { WorkoutSession } from '../types';

export type HeatmapRange = '7d' | '30d' | 'all';

export type ExerciseContribution = {
  name: string;
  score: number;
};

export type MuscleActivation = {
  regionId: string;
  rawScore: number;
  normalizedScore: number;
  lastTrainedAt: number;
  recoveryPercentage: number;
  isStale: boolean;
  isOvertrained: boolean;
  detrainingPercentage: number;
  contributingExercises: ExerciseContribution[];
};

export { calculateRecoveryPercentage, calculateDetraining } from './RecoveryTracker';

const DAY_MS = 24 * 60 * 60 * 1000;
const DECAY_CONSTANT_DAYS = 14;
const SPILLOVER_COEFFICIENT = 0.3;

const MUSCLE_ALIASES: Record<string, string> = {
  abs: 'abdominals',
  core: 'abdominals',
  pectorals: 'chest',
  delts: 'shoulders',
  deltoids: 'shoulders',
  quads: 'quadriceps',
  back: 'middle back',
  'upper back': 'middle back',
  spine: 'lower back',
};

function normalizeMuscleName(name: string): string {
  const key = name.trim().toLowerCase();
  return MUSCLE_ALIASES[key] || key;
}

function rangeThresholdMs(range: HeatmapRange, nowMs: number): number {
  if (range === 'all') return Number.NEGATIVE_INFINITY;
  const days = range === '7d' ? 7 : 30;
  return nowMs - days * DAY_MS;
}

export function calculateLoadFactor(
  weight: number,
  reps: number,
  durationSeconds: number | undefined,
  tempoMultiplier = 1,
  eccentricEmphasis = false,
): number {
  const w = Math.max(0, weight);
  const r = Math.max(0, reps);

  const isIsometric = (durationSeconds || 0) > 0 && r <= 1;
  const base = isIsometric
    ? Math.sqrt(Math.max(1, w * Math.max(1, durationSeconds || 0))) / 2.5
    : Math.sqrt(Math.max(1, w * Math.max(1, r))) / 3.2;

  const eccentricMultiplier = eccentricEmphasis ? 1.3 : 1;
  return Math.max(0.2, base * tempoMultiplier * eccentricMultiplier);
}

export function rangeOfMotionMultiplier(rangeOfMotion: 'shortened' | 'mid' | 'stretched'): number {
  if (rangeOfMotion === 'stretched') return 0.7;
  if (rangeOfMotion === 'shortened') return 0.85;
  return 1;
}

export function fatigueMultiplier(setNumber: number): number {
  return Math.pow(0.95, Math.max(0, setNumber - 1));
}

export function temporalDecayMultiplier(daysAgo: number): number {
  return Math.exp(-Math.max(0, daysAgo) / DECAY_CONSTANT_DAYS);
}

function addScore(
  scoreByRegion: Record<string, number>,
  regionId: string,
  score: number,
): void {
  scoreByRegion[regionId] = (scoreByRegion[regionId] || 0) + score;
}

function addContribution(
  regionExerciseScores: Record<string, Record<string, number>>,
  regionId: string,
  exerciseName: string,
  score: number,
): void {
  if (!regionExerciseScores[regionId]) {
    regionExerciseScores[regionId] = {};
  }
  regionExerciseScores[regionId][exerciseName] = (regionExerciseScores[regionId][exerciseName] || 0) + score;
}

export async function computeActivations(
  sessions: WorkoutSession[],
  range: HeatmapRange,
  nowMs = Date.now(),
): Promise<Map<string, MuscleActivation>> {
  const result = new Map<string, MuscleActivation>();
  const sessionIds = sessions.map(session => session.id).filter((id): id is number => typeof id === 'number');

  for (const region of ALL_REGIONS) {
    result.set(region.id, {
      regionId: region.id,
      rawScore: 0,
      normalizedScore: 0,
      lastTrainedAt: 0,
      recoveryPercentage: 100,
      isStale: true,
      isOvertrained: false,
      detrainingPercentage: 0,
      contributingExercises: [],
    });
  }

  if (!sessionIds.length) {
    return result;
  }

  const cutoff = rangeThresholdMs(range, nowMs);

  try {
    const sets = await db.sets.where('sessionId').anyOf(sessionIds).toArray();
    const exerciseIds = [...new Set(sets.map(set => set.exerciseId).filter((id): id is number => typeof id === 'number'))];
    const exercises = exerciseIds.length ? await db.exercises.where('id').anyOf(exerciseIds).toArray() : [];

    const exerciseById = new Map<number, (typeof exercises)[number]>();
    exercises.forEach(ex => {
      if (typeof ex.id === 'number') {
        exerciseById.set(ex.id, ex);
      }
    });

    const sessionTimestampById = new Map<number, number>();
    sessions.forEach(session => {
      if (typeof session.id === 'number') {
        sessionTimestampById.set(
          session.id,
          new Date(session.completedAt || session.startedAt).getTime(),
        );
      }
    });

    const scoreByRegion: Record<string, number> = {};
    const regionLastTrained: Record<string, number> = {};
    const regionTrainingEvents: Record<string, number[]> = {};
    const regionExerciseScores: Record<string, Record<string, number>> = {};
    const regionSetCounter: Record<string, number> = {};

    for (const set of sets) {
      const exercise = exerciseById.get(set.exerciseId);
      if (!exercise) continue;

      const setTimestamp = set.completedAt
        ? new Date(set.completedAt).getTime()
        : (sessionTimestampById.get(set.sessionId) || nowMs);

      if (setTimestamp < cutoff) {
        continue;
      }

      const targeting = resolveExerciseTargeting(exercise.name);
      const tempoMultiplier = targeting ? Math.max(0.85, targeting.biomechanics.tempoSensitivity) : 1;
      const baseLoad = calculateLoadFactor(
        set.weight,
        set.reps,
        set.duration,
        tempoMultiplier,
        Boolean(targeting?.biomechanics.eccentricEmphasis),
      );

      const daysAgo = (nowMs - setTimestamp) / DAY_MS;
      const temporal = temporalDecayMultiplier(daysAgo);

      if (targeting) {
        const romMultiplier = rangeOfMotionMultiplier(targeting.biomechanics.rangeOfMotion);
        for (const target of targeting.targets) {
          regionSetCounter[target.regionId] = (regionSetCounter[target.regionId] || 0) + 1;
          const fatigue = fatigueMultiplier(regionSetCounter[target.regionId]);

          const targetScore = baseLoad
            * target.coefficient
            * targeting.biomechanics.stabilizationFactor
            * romMultiplier
            * temporal
            * fatigue;

          addScore(scoreByRegion, target.regionId, targetScore);
          addContribution(regionExerciseScores, target.regionId, exercise.name, targetScore);
          regionLastTrained[target.regionId] = Math.max(regionLastTrained[target.regionId] || 0, setTimestamp);

          if (!regionTrainingEvents[target.regionId]) {
            regionTrainingEvents[target.regionId] = [];
          }
          regionTrainingEvents[target.regionId].push(setTimestamp);

          // Spillover to adjacent regions to simulate anatomical proximity.
          const adjacent = getAdjacentRegions(target.regionId);
          for (const adjacentRegion of adjacent) {
            const spilloverScore = targetScore * SPILLOVER_COEFFICIENT;
            addScore(scoreByRegion, adjacentRegion.id, spilloverScore);
            addContribution(regionExerciseScores, adjacentRegion.id, exercise.name, spilloverScore);
            regionLastTrained[adjacentRegion.id] = Math.max(regionLastTrained[adjacentRegion.id] || 0, setTimestamp);

            if (!regionTrainingEvents[adjacentRegion.id]) {
              regionTrainingEvents[adjacentRegion.id] = [];
            }
            regionTrainingEvents[adjacentRegion.id].push(setTimestamp);
          }
        }

        continue;
      }

      const primary = (exercise.primaryMuscles || []).map(normalizeMuscleName);
      const secondary = (exercise.secondaryMuscles || []).map(normalizeMuscleName);

      const primaryWeight = 1.25;
      const secondaryWeight = 0.7;

      for (const muscle of primary) {
        const regions = getRegionsForMuscle(muscle);
        if (!regions.length) continue;
        const perRegion = (baseLoad * primaryWeight * temporal) / regions.length;

        for (const region of regions) {
          regionSetCounter[region.id] = (regionSetCounter[region.id] || 0) + 1;
          const fatigue = fatigueMultiplier(regionSetCounter[region.id]);
          const score = perRegion * fatigue;
          addScore(scoreByRegion, region.id, score);
          addContribution(regionExerciseScores, region.id, exercise.name, score);
          regionLastTrained[region.id] = Math.max(regionLastTrained[region.id] || 0, setTimestamp);
          if (!regionTrainingEvents[region.id]) {
            regionTrainingEvents[region.id] = [];
          }
          regionTrainingEvents[region.id].push(setTimestamp);
        }
      }

      for (const muscle of secondary) {
        const regions = getRegionsForMuscle(muscle);
        if (!regions.length) continue;
        const perRegion = (baseLoad * secondaryWeight * temporal) / regions.length;

        for (const region of regions) {
          regionSetCounter[region.id] = (regionSetCounter[region.id] || 0) + 1;
          const fatigue = fatigueMultiplier(regionSetCounter[region.id]);
          const score = perRegion * fatigue;
          addScore(scoreByRegion, region.id, score);
          addContribution(regionExerciseScores, region.id, exercise.name, score);
          regionLastTrained[region.id] = Math.max(regionLastTrained[region.id] || 0, setTimestamp);
          if (!regionTrainingEvents[region.id]) {
            regionTrainingEvents[region.id] = [];
          }
          regionTrainingEvents[region.id].push(setTimestamp);
        }
      }
    }

    const maxRaw = Math.max(0, ...Object.values(scoreByRegion));

    for (const region of ALL_REGIONS) {
      const rawScore = scoreByRegion[region.id] || 0;
      const lastTrainedAt = regionLastTrained[region.id] || 0;
      const normalizedScore = maxRaw > 0 ? Math.min(1, rawScore / maxRaw) : 0;
      const recoveryPercentage = calculateRecoveryPercentage(region.muscle, lastTrainedAt, nowMs);
      const stale = isStaleMuscle(lastTrainedAt, nowMs);
      const daysSinceTraining = lastTrainedAt > 0 ? (nowMs - lastTrainedAt) / DAY_MS : Number.POSITIVE_INFINITY;
      const detrainingPercentage = Number.isFinite(daysSinceTraining)
        ? calculateDetraining(daysSinceTraining)
        : 0;

      const overtrained = detectOvertraining(regionTrainingEvents[region.id] || [], region.muscle);

      const contributions = Object.entries(regionExerciseScores[region.id] || {})
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      result.set(region.id, {
        regionId: region.id,
        rawScore,
        normalizedScore,
        lastTrainedAt,
        recoveryPercentage,
        isStale: stale,
        isOvertrained: overtrained,
        detrainingPercentage,
        contributingExercises: contributions,
      });
    }

    return result;
  } catch (error) {
    console.error('Failed to compute muscle activations', error);
    return result;
  }
}

export function buildMuscleSummary(activationMap: Map<string, MuscleActivation>): Record<string, number> {
  const totals: Record<string, { sum: number; count: number }> = {};

  for (const activation of activationMap.values()) {
    const muscle = inferMuscleFromRegion(activation.regionId);
    if (!totals[muscle]) {
      totals[muscle] = { sum: 0, count: 0 };
    }

    totals[muscle].sum += activation.normalizedScore;
    totals[muscle].count += 1;
  }

  const summary: Record<string, number> = {};

  for (const [muscle, aggregate] of Object.entries(totals)) {
    summary[muscle] = aggregate.count > 0 ? aggregate.sum / aggregate.count : 0;
  }

  return summary;
}

export type RegionComparisonDelta = {
  regionId: string;
  deltaRawScore: number;
  normalizedDelta: number;
  direction: 'increase' | 'decrease' | 'neutral';
};

export function computeComparisonDiff(
  current: Map<string, MuscleActivation>,
  baseline: Map<string, MuscleActivation>,
): Map<string, RegionComparisonDelta> {
  const out = new Map<string, RegionComparisonDelta>();
  const deltas: number[] = [];

  for (const region of ALL_REGIONS) {
    const currentRaw = current.get(region.id)?.rawScore || 0;
    const baselineRaw = baseline.get(region.id)?.rawScore || 0;
    deltas.push(currentRaw - baselineRaw);
  }

  const maxAbs = Math.max(1e-6, ...deltas.map(value => Math.abs(value)));

  for (const region of ALL_REGIONS) {
    const currentRaw = current.get(region.id)?.rawScore || 0;
    const baselineRaw = baseline.get(region.id)?.rawScore || 0;
    const deltaRawScore = currentRaw - baselineRaw;
    const normalizedDelta = Math.max(-1, Math.min(1, deltaRawScore / maxAbs));
    out.set(region.id, {
      regionId: region.id,
      deltaRawScore,
      normalizedDelta,
      direction: deltaRawScore > 0 ? 'increase' : deltaRawScore < 0 ? 'decrease' : 'neutral',
    });
  }

  return out;
}
