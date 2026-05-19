import { describe, expect, it } from 'vitest';
import {
  formatScaleMeasurement,
  measureScaleScenario,
  SCALE_MEASUREMENT_SCENARIOS,
} from './scaleMeasurement';

describe('scale measurement harness', () => {
  it('measures simulation and projection phases without hard performance thresholds', () => {
    const result = measureScaleScenario({
      seed: 'scale-harness-smoke',
      width: 64,
      height: 64,
      initialUnits: 320,
      warmupTicks: 2,
      measuredTicks: 4,
      viewport: { x: 12, y: 12, width: 18, height: 18, paddingTiles: 1 },
    });

    expect(result.scenario.initialUnits).toBe(320);
    expect(result.population).toBeGreaterThan(0);
    expect(result.timings.createWorldMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.averageStepMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.fullProjectionMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.viewportProjectionMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.total).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.updateUnits).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.spatialIndexRebuild).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.rebuildVillageResidentsIndex).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.updateVillageResidents).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.updateVillageEconomy).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.updateUnitNeeds).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.nearbyFoodLookup).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.nearestFoodLookup).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.unitMovement).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.reproduction).toBeGreaterThanOrEqual(0);
    expect(result.timings.phaseAverageMs.unitBehaviorCandidates).toBeGreaterThan(0);
    expect(result.timings.phaseAverageMs.unitBehaviorUpdates).toBeGreaterThan(0);
    expect(result.timings.phaseAverageMs.unitBehaviorUpdates).toBeLessThan(
      result.timings.phaseAverageMs.unitBehaviorCandidates,
    );
    expect(result.timings.slowestPhase.name).toBeTruthy();
    expect(result.timings.slowestPhase.averageMs).toBeGreaterThanOrEqual(0);
    expect(result.counts.full.tiles).toBe(64 * 64);
    expect(result.counts.viewport.tiles).toBeLessThan(result.counts.full.tiles);
    expect(result.counts.viewport.units).toBeLessThanOrEqual(result.counts.full.units);
    expect(result.counts.global.population).toBe(result.counts.full.units);
    expect(result.counts.global.population).toBe(result.counts.viewport.populationStat);
  });

  it('formats the measurement as a compact table row for manual PR-11 runs', () => {
    const result = measureScaleScenario({
      seed: 'scale-harness-format',
      width: 32,
      height: 32,
      initialUnits: 80,
      warmupTicks: 1,
      measuredTicks: 1,
      viewport: { x: 0, y: 0, width: 10, height: 10 },
    });

    expect(formatScaleMeasurement(result)).toContain('scale-harness-format');
    expect(formatScaleMeasurement(result)).toContain('avgStepMs');
    expect(formatScaleMeasurement(result)).toContain('slowest=');
    expect(formatScaleMeasurement(result)).toContain('behaviorUpdates=');
  });

  it('defines PR-11 target scenarios separately from fast smoke coverage', () => {
    expect(SCALE_MEASUREMENT_SCENARIOS.map((scenario) => scenario.initialUnits)).toEqual([
      1000, 3000, 5000, 10000,
    ]);
    expect(SCALE_MEASUREMENT_SCENARIOS.every((scenario) => scenario.measuredTicks > 0)).toBe(true);
  });
});
