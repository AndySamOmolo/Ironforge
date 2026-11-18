import { db } from '@/lib/db/schema';
import type { Exercise } from '@/lib/types';
import { matchesUserEquipment, sharesTargetMuscle, normalizeEquipmentName, getMovementStem } from './exerciseResolver';
import { hasGifExerciseMedia } from './exerciseMedia';

export interface SwapCandidate {
  exercise: Exercise;
  score: number;
  matchTags: string[];
  category: 'perfect' | 'good' | 'home' | 'related';
}

export async function getSwapSuggestions(
  originalExercise: Exercise,
  sessionExerciseIds: number[],
  userEquipment: string[] = [],
  recentExerciseIds: Set<number> = new Set()
): Promise<SwapCandidate[]> {
  const allExercises = await db.exercises.toArray();
  const originalMuscles = originalExercise.primaryMuscles?.map(m => m.toLowerCase()) || [];
  const originalSecondary = originalExercise.secondaryMuscles?.map(m => m.toLowerCase()) || [];
  const originalEquipment = normalizeEquipmentName(originalExercise.equipment);
  const originalStem = getMovementStem(originalExercise.name);
  const isOriginalStretch = (originalExercise.category || '').toLowerCase() === 'stretching' ||
    originalExercise.name.toLowerCase().includes('stretch');

  const candidates: SwapCandidate[] = [];
  const seenStems = new Set<string>([originalStem]);

  for (const candidate of allExercises) {
    if (candidate.id === originalExercise.id) continue;

    // Strictly enforce user's selected equipment so unselected equipment (e.g. cables) never appears
    if (userEquipment.length > 0 && !matchesUserEquipment(candidate, userEquipment)) {
      continue;
    }

    const candStem = getMovementStem(candidate.name);
    if (seenStems.has(candStem)) continue;

    const isCandStretch = (candidate.category || '').toLowerCase() === 'stretching' ||
      candidate.name.toLowerCase().includes('stretch');
    if (isOriginalStretch !== isCandStretch) continue;

    const candidateMuscles = candidate.primaryMuscles?.map(m => m.toLowerCase()) || [];
    const candidateSecondary = candidate.secondaryMuscles?.map(m => m.toLowerCase()) || [];
    const candidateEquipment = normalizeEquipmentName(candidate.equipment);

    // Must share at least one canonical primary or secondary muscle
    const primaryMatch = sharesTargetMuscle(candidateMuscles, originalMuscles);
    const secondaryMatch = !primaryMatch && (
      sharesTargetMuscle(candidateSecondary, originalMuscles) ||
      sharesTargetMuscle(candidateMuscles, originalSecondary)
    );

    if (!primaryMatch && !secondaryMatch) continue;

    let score = 45;
    const matchTags: string[] = [];

    if (primaryMatch) {
      score += 35;
      matchTags.push('✓ Same muscle');
    } else if (secondaryMatch) {
      score += 15;
      matchTags.push('✓ Secondary muscle');
    }

    // Equipment affinity (only among equipment the user actually has)
    if (candidateEquipment === originalEquipment) {
      score += 22;
      matchTags.push(`✓ ${candidateEquipment}`);
    } else {
      score += 14;
      matchTags.push(`✓ ${candidateEquipment}`);
    }

    // Same category / mechanic
    if (candidate.category === originalExercise.category) {
      score += 12;
    }
    if (candidate.mechanic && candidate.mechanic === originalExercise.mechanic) {
      score += 8;
    }

    // Similar difficulty
    const origDiff = originalExercise.level || 'intermediate';
    const candDiff = candidate.level || 'intermediate';
    if (origDiff === candDiff) score += 8;

    // Strongly prefer exercises with GIF as primary visual media
    if (hasGifExerciseMedia(candidate)) {
      score += 35;
      matchTags.push('🎬 GIF');
    }

    // Penalize if already in current workout session
    if (candidate.id && sessionExerciseIds.includes(candidate.id)) {
      score -= 60;
      matchTags.push('⚠ Already in workout');
    }

    // Slight bonus for fresh exercises not done in recent workouts
    if (candidate.id && !recentExerciseIds.has(candidate.id)) {
      score += 10;
      matchTags.push('✨ Fresh variation');
    }

    const isBodyweight = candidateEquipment === 'body weight';
    if (isBodyweight) matchTags.push('🏠 Bodyweight');

    let category: SwapCandidate['category'] = 'related';
    if (primaryMatch && candidateEquipment === originalEquipment) {
      category = 'perfect';
    } else if (primaryMatch && isBodyweight) {
      category = 'home';
    } else if (primaryMatch) {
      category = 'good';
    }

    seenStems.add(candStem);
    candidates.push({ exercise: candidate, score, matchTags, category });
  }

  candidates.sort((a, b) => b.score - a.score);

  const perfect = candidates.filter(c => c.category === 'perfect').slice(0, 6);
  const good = candidates.filter(c => c.category === 'good').slice(0, 6);
  const home = candidates.filter(c => c.category === 'home').slice(0, 5);
  const related = candidates.filter(c => c.category === 'related').slice(0, 4);

  return [...perfect, ...good, ...home, ...related];
}
