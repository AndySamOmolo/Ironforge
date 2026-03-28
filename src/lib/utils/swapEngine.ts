import { db } from '@/lib/db/schema';
import type { Exercise } from '@/lib/types';

interface SwapCandidate {
  exercise: Exercise;
  score: number;
  matchTags: string[];
  category: 'perfect' | 'good' | 'home' | 'related';
}

export async function getSwapSuggestions(
  originalExercise: Exercise,
  sessionExerciseIds: number[],
  userEquipment: string[] = []
): Promise<SwapCandidate[]> {
  const allExercises = await db.exercises.toArray();
  const originalMuscles = originalExercise.primaryMuscles?.map(m => m.toLowerCase()) || [];
  const originalEquipment = (originalExercise.equipment || '').toLowerCase();

  const candidates: SwapCandidate[] = [];

  for (const candidate of allExercises) {
    if (candidate.id === originalExercise.id) continue;

    const candidateMuscles = candidate.primaryMuscles?.map(m => m.toLowerCase()) || [];
    const candidateEquipment = (candidate.equipment || '').toLowerCase();

    // Must share at least one primary muscle
    const sharedMuscles = originalMuscles.filter(m => candidateMuscles.includes(m));
    if (sharedMuscles.length === 0) continue;

    let score = 50;
    const matchTags: string[] = [];

    // Same primary muscle
    if (sharedMuscles.length > 0) {
      score += 30;
      matchTags.push('✓ Same muscle');
    }

    // Same equipment
    if (candidateEquipment === originalEquipment) {
      score += 25;
      matchTags.push('✓ Same equipment');
    } else if (userEquipment.length > 0 && userEquipment.some(eq => candidateEquipment.includes(eq.toLowerCase()))) {
      score += 10;
      matchTags.push('✓ Available equipment');
    }

    // Same category
    if (candidate.category === originalExercise.category) {
      score += 15;
    }

    // Similar difficulty
    const origDiff = originalExercise.level || 'intermediate';
    const candDiff = candidate.level || 'intermediate';
    if (origDiff === candDiff) score += 10;

    // Penalize if already in session
    if (sessionExerciseIds.includes(candidate.id!)) {
      score -= 40;
      matchTags.push('⚠ Already in workout');
    }

    // Bodyweight bonus for "home" alternatives
    const isBodyweight = candidateEquipment.includes('body weight');
    if (isBodyweight) matchTags.push('🏠 Bodyweight');

    // Categorize
    let category: SwapCandidate['category'] = 'related';
    if (sharedMuscles.length > 0 && candidateEquipment === originalEquipment) {
      category = 'perfect';
    } else if (sharedMuscles.length > 0) {
      category = 'good';
    }
    if (isBodyweight && sharedMuscles.length > 0) {
      category = 'home';
    }

    candidates.push({ exercise: candidate, score, matchTags, category });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Limit results per category
  const perfect = candidates.filter(c => c.category === 'perfect').slice(0, 5);
  const good = candidates.filter(c => c.category === 'good').slice(0, 5);
  const home = candidates.filter(c => c.category === 'home').slice(0, 4);
  const related = candidates.filter(c => c.category === 'related').slice(0, 3);

  return [...perfect, ...good, ...home, ...related];
}

export function calculatePlates(targetWeight: number, barWeight: number = 20): { plate: number; count: number; color: string }[] {
  const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const plateColors: Record<number, string> = {
    25: '#EF4444', 20: '#3B82F6', 15: '#FBBF24', 10: '#10B981',
    5: '#8B5CF6', 2.5: '#EC4899', 1.25: '#6B7280',
  };

  let perSide = (targetWeight - barWeight) / 2;
  if (perSide <= 0) return [];

  const result: { plate: number; count: number; color: string }[] = [];
  for (const plate of availablePlates) {
    if (perSide >= plate) {
      const count = Math.floor(perSide / plate);
      result.push({ plate, count, color: plateColors[plate] || '#888' });
      perSide -= count * plate;
    }
  }
  return result;
}

export function getProgressionSuggestion(
  lastWeight: number,
  lastReps: number,
  targetReps: number,
  isCompound: boolean
): { suggestedWeight: number; message: string } {
  const increment = isCompound ? 2.5 : 1;

  if (lastReps >= targetReps) {
    return {
      suggestedWeight: lastWeight + increment,
      message: `You hit ${lastReps} reps last time — try +${increment}kg! 🚀`,
    };
  } else if (lastReps >= targetReps * 0.8) {
    return {
      suggestedWeight: lastWeight,
      message: `Keep ${lastWeight}kg — hit your rep target first`,
    };
  } else {
    return {
      suggestedWeight: Math.max(0, lastWeight * 0.9),
      message: `Deload suggested — you hit ${lastReps}/${targetReps} reps`,
    };
  }
}
