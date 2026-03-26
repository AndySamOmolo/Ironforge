// Progressive Overload Engine
// Implements double progression (reps first, then weight) + deload logic

export interface ProgressionSuggestion {
  suggestedWeight: number;
  suggestedReps: number;
  reason: string;
  type: 'increase' | 'maintain' | 'deload';
  icon: string;
}

export interface ExerciseHistory {
  weight: number;
  reps: number;
  date: Date;
}

// Double progression: hit top of rep range → increase weight
export function getProgressionSuggestion(
  history: ExerciseHistory[],
  targetReps: number,
  isUpperBody: boolean = true,
  unitSystem: 'metric' | 'imperial' = 'metric'
): ProgressionSuggestion {
  if (history.length === 0) {
    return {
      suggestedWeight: 0,
      suggestedReps: targetReps,
      reason: 'Start light and focus on form',
      type: 'maintain',
      icon: '🎯',
    };
  }

  const lastSession = history[0]; // most recent
  const increment = isUpperBody
    ? (unitSystem === 'metric' ? 2.5 : 5)
    : (unitSystem === 'metric' ? 5 : 10);

  // Check for consecutive failures (deload trigger)
  const recentSessions = history.slice(0, 3);
  const failureCount = recentSessions.filter(s => s.reps < targetReps * 0.8).length;

  if (failureCount >= 3) {
    const deloadWeight = Math.round(lastSession.weight * 0.9 / increment) * increment;
    return {
      suggestedWeight: deloadWeight,
      suggestedReps: targetReps,
      reason: `Deload: 3 consecutive tough sessions. Drop to ${deloadWeight}${unitSystem === 'metric' ? 'kg' : 'lbs'} and build back up.`,
      type: 'deload',
      icon: '📉',
    };
  }

  // If hit or exceeded target reps → increase weight
  if (lastSession.reps >= targetReps) {
    const newWeight = lastSession.weight + increment;
    return {
      suggestedWeight: newWeight,
      suggestedReps: targetReps - 2,
      reason: `Great! You hit ${lastSession.reps} reps at ${lastSession.weight}${unitSystem === 'metric' ? 'kg' : 'lbs'}. Time to go up!`,
      type: 'increase',
      icon: '🚀',
    };
  }

  // Within target range → maintain weight, try for more reps
  return {
    suggestedWeight: lastSession.weight,
    suggestedReps: lastSession.reps + 1,
    reason: `Keep pushing! Hit ${lastSession.reps + 1}+ reps at this weight.`,
    type: 'maintain',
    icon: '💪',
  };
}

// Estimate 1RM using Epley formula: 1RM = weight × (1 + reps / 30)
export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

// Calculate strength level based on body weight and 1RM
export function getStrengthLevel(
  oneRM: number,
  bodyWeight: number,
  exerciseType: 'squat' | 'bench' | 'deadlift' | 'ohp' | 'row'
): { level: string; color: string; ratio: number } {
  const ratio = bodyWeight > 0 ? oneRM / bodyWeight : 0;

  // Standards vary by exercise
  const standards: Record<string, number[]> = {
    squat:    [0.75, 1.25, 1.75, 2.5],
    bench:    [0.5,  1.0,  1.5,  2.0],
    deadlift: [1.0,  1.5,  2.0,  3.0],
    ohp:      [0.35, 0.65, 1.0,  1.4],
    row:      [0.5,  0.85, 1.2,  1.65],
  };

  const thresholds = standards[exerciseType] || standards.bench;

  if (ratio < thresholds[0]) return { level: 'Beginner', color: '#6B7280', ratio };
  if (ratio < thresholds[1]) return { level: 'Novice', color: '#0EA5E9', ratio };
  if (ratio < thresholds[2]) return { level: 'Intermediate', color: '#22C55E', ratio };
  if (ratio < thresholds[3]) return { level: 'Advanced', color: '#F59E0B', ratio };
  return { level: 'Elite', color: '#EF4444', ratio };
}
