interface WorkoutWeightDefaults {
  equipment?: string | null;
  plannedWeight?: number | null;
  barWeight: number;
  dumbbellWeight: number;
}

export function getWorkoutStartingWeight({
  equipment,
  plannedWeight,
  barWeight,
  dumbbellWeight,
}: WorkoutWeightDefaults): number {
  if (typeof plannedWeight === 'number' && plannedWeight > 0) {
    return plannedWeight;
  }

  const normalizedEquipment = (equipment || '').toLowerCase();

  if (normalizedEquipment.includes('dumbbell')) {
    return dumbbellWeight;
  }

  if (
    normalizedEquipment.includes('barbell') ||
    normalizedEquipment.includes('smith') ||
    normalizedEquipment.includes('trap bar') ||
    normalizedEquipment.includes('ez bar')
  ) {
    return barWeight;
  }

  return 0;
}