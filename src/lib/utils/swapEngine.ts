// Exercise Swap Engine
// Suggests alternative exercises based on muscle group, movement pattern, equipment, and difficulty

import { db } from '@/lib/db/schema';
import type { Exercise, SwapSuggestion } from '@/lib/types';

export async function getSwapSuggestions(
  currentExercise: Exercise,
  availableEquipment: string[],
  limit: number = 8
): Promise<SwapSuggestion[]> {
  const allExercises = await db.exercises.toArray();
  
  const suggestions: SwapSuggestion[] = [];
  
  for (const candidate of allExercises) {
    // Don't suggest the same exercise
    if (candidate.id === currentExercise.id) continue;
    
    let score = 0;
    const matchReasons: string[] = [];
    
    // Primary muscle match (highest weight)
    const primaryOverlap = currentExercise.primaryMuscles.filter(m =>
      candidate.primaryMuscles.includes(m)
    );
    if (primaryOverlap.length > 0) {
      score += primaryOverlap.length * 30;
      matchReasons.push(`Targets ${primaryOverlap.join(', ')}`);
    } else {
      continue; // Must match at least one primary muscle
    }
    
    // Secondary muscle overlap
    const secondaryOverlap = currentExercise.secondaryMuscles.filter(m =>
      candidate.secondaryMuscles.includes(m) || candidate.primaryMuscles.includes(m)
    );
    score += secondaryOverlap.length * 10;
    
    // Same force type (push/pull)
    if (currentExercise.force && candidate.force === currentExercise.force) {
      score += 15;
      matchReasons.push(`Same force (${candidate.force})`);
    }
    
    // Same mechanic (compound/isolation)
    if (currentExercise.mechanic && candidate.mechanic === currentExercise.mechanic) {
      score += 10;
      matchReasons.push(candidate.mechanic === 'compound' ? 'Compound' : 'Isolation');
    }
    
    // Same category
    if (currentExercise.category === candidate.category) {
      score += 8;
    }
    
    // Equipment compatibility
    if (candidate.equipment && availableEquipment.includes(candidate.equipment)) {
      score += 12;
    } else if (candidate.equipment === 'body only') {
      score += 8;
      matchReasons.push('No equipment needed');
    }
    
    // Same equipment bonus
    if (currentExercise.equipment === candidate.equipment) {
      score += 10;
      matchReasons.push(`Same equipment (${candidate.equipment})`);
    }
    
    // Same difficulty level
    if (currentExercise.level === candidate.level) {
      score += 5;
    }
    
    // Determine category
    let category: SwapSuggestion['category'] = 'related';
    if (score >= 70) category = 'perfect';
    else if (score >= 50) category = 'good';
    else if (candidate.equipment === 'body only' || candidate.equipment === null) category = 'home';
    
    suggestions.push({
      exercise: candidate,
      score,
      matchReasons: matchReasons.slice(0, 3),
      category,
    });
  }
  
  // Sort by score and return top suggestions
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, limit);
}

// Get swap suggestions grouped by category
export async function getGroupedSwapSuggestions(
  currentExercise: Exercise,
  availableEquipment: string[]
): Promise<Record<string, SwapSuggestion[]>> {
  const suggestions = await getSwapSuggestions(currentExercise, availableEquipment, 20);
  
  return {
    perfect: suggestions.filter(s => s.category === 'perfect').slice(0, 4),
    good: suggestions.filter(s => s.category === 'good').slice(0, 4),
    home: suggestions.filter(s => s.category === 'home').slice(0, 4),
    related: suggestions.filter(s => s.category === 'related').slice(0, 4),
  };
}
