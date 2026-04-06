import { ALL_REGIONS } from '../data/AnatomyModel';

const LARGE_MUSCLES = new Set(['quadriceps', 'hamstrings', 'glutes', 'lats', 'middle back', 'chest']);
const MEDIUM_MUSCLES = new Set(['shoulders', 'traps']);
const SMALL_MUSCLES = new Set(['biceps', 'triceps', 'calves', 'forearms']);
const CORE_MUSCLES = new Set(['abdominals', 'obliques', 'serratus', 'lower back']);

function muscleRecoveryConstantHours(muscle: string): number {
  if (LARGE_MUSCLES.has(muscle)) return 84;
  if (MEDIUM_MUSCLES.has(muscle)) return 66;
  if (SMALL_MUSCLES.has(muscle)) return 54;
  if (CORE_MUSCLES.has(muscle)) return 42;
  return 60;
}

export function calculateRecoveryPercentage(muscle: string, lastTrainedAt: number, nowMs: number): number {
  if (!lastTrainedAt || lastTrainedAt <= 0) return 100;
  const hoursSince = Math.max(0, (nowMs - lastTrainedAt) / (1000 * 60 * 60));
  const recovery = (hoursSince / muscleRecoveryConstantHours(muscle)) * 100;
  return Math.max(0, Math.min(100, recovery));
}

export function calculateDetraining(daysSinceTraining: number): number {
  if (daysSinceTraining <= 10) return 0;
  return Math.max(0, (daysSinceTraining - 10) * 0.5);
}

export function isStaleMuscle(lastTrainedAt: number, nowMs: number): boolean {
  if (!lastTrainedAt || lastTrainedAt <= 0) return true;
  const days = (nowMs - lastTrainedAt) / (1000 * 60 * 60 * 24);
  return days >= 9;
}

export function detectOvertraining(trainingEvents: number[], muscle: string): boolean {
  if (trainingEvents.length < 2) return false;
  const sorted = [...trainingEvents].sort((a, b) => a - b);
  const thresholdMs = muscleRecoveryConstantHours(muscle) * 0.7 * 60 * 60 * 1000;

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] < thresholdMs) {
      return true;
    }
  }

  return false;
}

export function inferMuscleFromRegion(regionId: string): string {
  const found = ALL_REGIONS.find(region => region.id === regionId);
  return found?.muscle || 'unknown';
}

export function getRecoveryConstantForMuscle(muscle: string): number {
  return muscleRecoveryConstantHours(muscle);
}
