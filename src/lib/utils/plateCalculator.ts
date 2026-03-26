// Plate Calculator
// Calculates optimal plate combinations for a given target weight

export interface PlateResult {
  plates: { weight: number; count: number }[];
  totalWeight: number;
  barWeight: number;
  perSide: { weight: number; count: number }[];
  isExact: boolean;
}

// Standard plate sets
const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

export function calculatePlates(
  targetWeight: number,
  barWeight: number = 20,
  unitSystem: 'metric' | 'imperial' = 'metric',
  availablePlates?: number[]
): PlateResult {
  const plates = availablePlates || (unitSystem === 'metric' ? METRIC_PLATES : IMPERIAL_PLATES);
  
  const weightToLoad = targetWeight - barWeight;
  
  if (weightToLoad <= 0) {
    return {
      plates: [],
      totalWeight: barWeight,
      barWeight,
      perSide: [],
      isExact: targetWeight === barWeight,
    };
  }

  const perSideWeight = weightToLoad / 2;
  const perSide: { weight: number; count: number }[] = [];
  let remaining = perSideWeight;

  for (const plate of plates) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      perSide.push({ weight: plate, count });
      remaining -= count * plate;
      remaining = Math.round(remaining * 100) / 100; // fix floating point
    }
  }

  const totalPlates = perSide.map(p => ({
    weight: p.weight,
    count: p.count * 2,
  }));

  const actualLoaded = perSide.reduce((acc, p) => acc + p.weight * p.count, 0) * 2;

  return {
    plates: totalPlates,
    totalWeight: barWeight + actualLoaded,
    barWeight,
    perSide,
    isExact: Math.abs(remaining) < 0.01,
  };
}

// Format plate layout as visual string
export function formatPlateLayout(result: PlateResult, unitSystem: 'metric' | 'imperial' = 'metric'): string {
  const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
  if (result.perSide.length === 0) {
    return `Bar only (${result.barWeight}${unit})`;
  }
  
  const plates = result.perSide
    .map(p => `${p.count}×${p.weight}${unit}`)
    .join(' + ');
  
  return `${plates} per side`;
}

// Get plate colors for visual display
export function getPlateColor(weight: number, unitSystem: 'metric' | 'imperial' = 'metric'): string {
  if (unitSystem === 'metric') {
    switch (weight) {
      case 25: return '#FF3D5A';  // Red
      case 20: return '#3B82F6';  // Blue
      case 15: return '#F59E0B';  // Yellow
      case 10: return '#22C55E';  // Green
      case 5: return '#F5F5F7';   // White
      case 2.5: return '#EF4444'; // Red small
      case 1.25: return '#A78BFA'; // Purple small
      default: return '#6B7280';
    }
  } else {
    switch (weight) {
      case 45: return '#3B82F6';
      case 35: return '#F59E0B';
      case 25: return '#22C55E';
      case 10: return '#F5F5F7';
      case 5: return '#6B7280';
      case 2.5: return '#A78BFA';
      default: return '#6B7280';
    }
  }
}
