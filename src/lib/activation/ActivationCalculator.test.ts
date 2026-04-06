import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  calculateLoadFactor,
  buildMuscleSummary,
  calculateRecoveryPercentage,
  calculateDetraining,
  computeComparisonDiff,
  fatigueMultiplier,
  rangeOfMotionMultiplier,
  temporalDecayMultiplier,
  type MuscleActivation,
} from './ActivationCalculator';
import { ALL_REGIONS } from '../data/AnatomyModel';

function emptyActivation(rawScore: number, regionId: string): MuscleActivation {
  return {
    regionId,
    rawScore,
    normalizedScore: 0,
    lastTrainedAt: 0,
    recoveryPercentage: 100,
    isStale: false,
    isOvertrained: false,
    detrainingPercentage: 0,
    contributingExercises: [],
  };
}

describe('ActivationCalculator properties', () => {
  it('fatigue multiplier is monotonic decreasing by set number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (a, b) => {
          const setA = Math.min(a, b);
          const setB = Math.max(a, b);
          expect(fatigueMultiplier(setA)).toBeGreaterThanOrEqual(fatigueMultiplier(setB));
        },
      ),
      { numRuns: 120 },
    );
  });

  it('temporal decay decreases as days ago increases', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 200, noNaN: true }),
        (a, b) => {
          const near = Math.min(a, b);
          const far = Math.max(a, b);
          expect(temporalDecayMultiplier(near)).toBeGreaterThanOrEqual(temporalDecayMultiplier(far));
        },
      ),
      { numRuns: 120 },
    );
  });

  it('isometric load factor scales with duration', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 300, noNaN: true }),
        fc.double({ min: 2, max: 120, noNaN: true }),
        fc.double({ min: 121, max: 360, noNaN: true }),
        (weight, shortDuration, longDuration) => {
          const shortLoad = calculateLoadFactor(weight, 1, shortDuration, 1, false);
          const longLoad = calculateLoadFactor(weight, 1, longDuration, 1, false);
          expect(longLoad).toBeGreaterThan(shortLoad);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('eccentric load factor is greater than concentric load factor', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 300, noNaN: true }),
        fc.double({ min: 1, max: 20, noNaN: true }),
        (weight, reps) => {
          const concentric = calculateLoadFactor(weight, reps, undefined, 1, false);
          const eccentric = calculateLoadFactor(weight, reps, undefined, 1, true);
          expect(eccentric).toBeGreaterThan(concentric);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('recovery percentage increases with time since training', () => {
    const now = Date.now();
    const recent = calculateRecoveryPercentage('chest', now - 12 * 60 * 60 * 1000, now);
    const older = calculateRecoveryPercentage('chest', now - 72 * 60 * 60 * 1000, now);
    expect(older).toBeGreaterThan(recent);
    expect(older).toBeLessThanOrEqual(100);
  });

  it('detraining stays zero through day 10 and increases afterwards', () => {
    expect(calculateDetraining(0)).toBe(0);
    expect(calculateDetraining(10)).toBe(0);
    expect(calculateDetraining(12)).toBeGreaterThan(0);
  });

  it('length-tension multiplier aligns with biomechanics assumptions', () => {
    expect(rangeOfMotionMultiplier('mid')).toBe(1);
    expect(rangeOfMotionMultiplier('shortened')).toBe(0.85);
    expect(rangeOfMotionMultiplier('stretched')).toBe(0.7);
  });

  it('comparison diff returns normalized deltas in [-1, 1]', () => {
    const current = new Map<string, MuscleActivation>();
    const baseline = new Map<string, MuscleActivation>();

    ALL_REGIONS.forEach((region, idx) => {
      current.set(region.id, emptyActivation(50 + idx, region.id));
      baseline.set(region.id, emptyActivation(30 + idx * 0.8, region.id));
    });

    const diff = computeComparisonDiff(current, baseline);

    expect(diff.size).toBe(ALL_REGIONS.length);
    for (const value of diff.values()) {
      expect(value.normalizedDelta).toBeGreaterThanOrEqual(-1);
      expect(value.normalizedDelta).toBeLessThanOrEqual(1);
    }
  });

  it('comparison diff direction matches the raw score delta sign', () => {
    const region = ALL_REGIONS[0];
    const current = new Map<string, MuscleActivation>();
    const baseline = new Map<string, MuscleActivation>();

    current.set(region.id, emptyActivation(80, region.id));
    baseline.set(region.id, emptyActivation(20, region.id));

    const diff = computeComparisonDiff(current, baseline);
    expect(diff.get(region.id)?.direction).toBe('increase');
  });

  it('muscle summary averages activation across a muscle group', () => {
    const chestRegions = ALL_REGIONS.filter(region => region.muscle === 'chest');
    const activationMap = new Map<string, MuscleActivation>();

    chestRegions.forEach((region, index) => {
      activationMap.set(region.id, {
        ...emptyActivation(index === 0 ? 1 : 0.2, region.id),
        normalizedScore: index === 0 ? 1 : 0.2,
      });
    });

    const summary = buildMuscleSummary(activationMap);

    expect(summary.chest).toBeGreaterThan(0.2);
    expect(summary.chest).toBeLessThan(1);
  });
});
