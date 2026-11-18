// Plate Calculator
// Calculates optimal plate combinations for a given target weight in metric or imperial units

export interface PlateItem {
  weight: number;
  plate: number;
  count: number;
  color: string;
}

export interface PlateResult {
  plates: PlateItem[];
  totalWeight: number;
  barWeight: number;
  perSide: PlateItem[];
  isExact: boolean;
}

// Standard plate sets
const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

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
      case 45: return '#3B82F6';  // Blue
      case 35: return '#F59E0B';  // Yellow
      case 25: return '#22C55E';  // Green
      case 10: return '#F5F5F7';  // White
      case 5: return '#EF4444';   // Red small
      case 2.5: return '#A78BFA'; // Purple small
      default: return '#6B7280';
    }
  }
}

export function calculatePlates(
  targetWeight: number,
  barWeight: number = 20,
  unitSystem: 'metric' | 'imperial' = 'metric',
  availablePlates?: number[]
): PlateResult {
  const safeTarget = Math.min(Math.max(0, Number.isFinite(targetWeight) ? targetWeight : 0), 1500);
  const safeBar = Math.max(0, Number.isFinite(barWeight) ? barWeight : 20);
  const plates = availablePlates || (unitSystem === 'metric' ? METRIC_PLATES : IMPERIAL_PLATES);

  const weightToLoad = safeTarget - safeBar;

  if (weightToLoad <= 0) {
    return {
      plates: [],
      totalWeight: safeBar,
      barWeight: safeBar,
      perSide: [],
      isExact: safeTarget === safeBar,
    };
  }

  const perSideWeight = weightToLoad / 2;
  const perSide: PlateItem[] = [];
  let remaining = perSideWeight;

  for (const plate of plates) {
    if (plate <= 0) continue;
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      const color = getPlateColor(plate, unitSystem);
      perSide.push({ weight: plate, plate, count, color });
      remaining -= count * plate;
      remaining = Math.round(remaining * 100) / 100;
    }
  }

  const totalPlates = perSide.map(p => ({
    ...p,
    count: p.count * 2,
  }));

  const actualLoaded = perSide.reduce((acc, p) => acc + p.weight * p.count, 0) * 2;

  return {
    plates: totalPlates,
    totalWeight: safeBar + actualLoaded,
    barWeight: safeBar,
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
