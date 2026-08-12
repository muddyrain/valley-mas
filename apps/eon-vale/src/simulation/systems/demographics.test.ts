import { describe, expect, it } from 'vitest';
import { birthPressure, calculateCarryingCapacity, resolveShortageStage } from './demographics';

describe('dynamic population capacity', () => {
  it('grows with housing and durable food production instead of a global cap', () => {
    const camp = calculateCarryingCapacity({
      housingCapacity: 24,
      completedFarms: 0,
      storedFood: 12,
      foodTrend: 0,
      safety: 1,
    });
    const town = calculateCarryingCapacity({
      housingCapacity: 72,
      completedFarms: 3,
      storedFood: 90,
      foodTrend: 2,
      safety: 1,
    });
    const besiegedTown = calculateCarryingCapacity({
      housingCapacity: 72,
      completedFarms: 3,
      storedFood: 90,
      foodTrend: 2,
      safety: 0.45,
    });

    expect(town).toBeGreaterThan(camp * 2);
    expect(besiegedTown).toBeLessThan(town);
    expect(town).toBeLessThanOrEqual(72);
  });

  it('slows births before a settlement reaches capacity', () => {
    const roomy = birthPressure({ population: 18, carryingCapacity: 40, storedFood: 35 });
    const crowded = birthPressure({ population: 37, carryingCapacity: 40, storedFood: 35 });
    const starving = birthPressure({ population: 18, carryingCapacity: 40, storedFood: 0 });

    expect(roomy).toBeGreaterThan(crowded);
    expect(crowded).toBe(0);
    expect(starving).toBe(0);
  });

  it('uses reserves and migration pressure before lethal starvation', () => {
    expect(resolveShortageStage({ storedFood: 30, population: 20, shortageTicks: 0 })).toBe(
      'stable',
    );
    expect(resolveShortageStage({ storedFood: 2, population: 20, shortageTicks: 240 })).toBe(
      'rationing',
    );
    expect(resolveShortageStage({ storedFood: 0, population: 20, shortageTicks: 800 })).toBe(
      'migration',
    );
    expect(resolveShortageStage({ storedFood: 0, population: 20, shortageTicks: 2_000 })).toBe(
      'famine',
    );
  });
});
