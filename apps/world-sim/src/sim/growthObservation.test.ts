import { describe, expect, it } from 'vitest';
import {
  formatGrowthObservation,
  formatGrowthObservationReport,
  formatSatelliteObservationReport,
  observeEarlySettlement,
  observeEarlySettlementReport,
  observeSatelliteSettlementReport,
} from './growthObservation';

describe('early settlement growth observation harness', () => {
  it('produces deterministic snapshots that reveal camp-to-hamlet progression', () => {
    const options = { seed: 'growth-observation-smoke', ticks: 100, sampleEvery: 10 };
    const first = observeEarlySettlement(options);
    const second = observeEarlySettlement(options);

    expect(second).toEqual(first);
    expect(first.some((snapshot) => snapshot.villageId)).toBe(true);
    expect(first.some((snapshot) => snapshot.phase === 'camp')).toBe(true);
    expect(first.some((snapshot) => snapshot.phase === 'hamlet')).toBe(true);
  });

  it('formats one balance-reading row with the growth signals that matter', () => {
    const snapshots = observeEarlySettlement({
      seed: 'growth-observation-format',
      ticks: 100,
      sampleEvery: 10,
    });
    const hamlet = snapshots.find((snapshot) => snapshot.phase === 'hamlet');

    expect(hamlet).toBeDefined();
    expect(formatGrowthObservation(hamlet!)).toContain('phase=hamlet');
    expect(formatGrowthObservation(hamlet!)).toContain('plan=');
    expect(formatGrowthObservation(hamlet!)).toContain('population=');
    expect(formatGrowthObservation(hamlet!)).toContain('housing=');
    expect(formatGrowthObservation(hamlet!)).toContain('food=');
    expect(formatGrowthObservation(hamlet!)).toContain('wood=');
    expect(formatGrowthObservation(hamlet!)).toContain('buildings=');
    expect(formatGrowthObservation(hamlet!)).toContain('territory=');
  });

  it('summarizes multiple seeds with phase timing, event, and building diagnostics', () => {
    const report = observeEarlySettlementReport({
      seeds: ['growth-diagnosis-a', 'growth-diagnosis-b'],
      ticks: 130,
      sampleEvery: 10,
    });

    expect(report.runs).toHaveLength(2);
    expect(report.runs.map((run) => run.seed)).toEqual([
      'growth-diagnosis-a',
      'growth-diagnosis-b',
    ]);

    for (const run of report.runs) {
      expect(run.phaseFirstTicks.camp).toBeGreaterThanOrEqual(1);
      expect(run.phaseFirstTicks.hamlet).toBeGreaterThan(run.phaseFirstTicks.camp ?? 0);
      expect(run.finalSnapshot.phase).toBeDefined();
      expect(run.finalSnapshot.buildings).toBeGreaterThan(0);
      if (run.finalSnapshot.phase === 'hamlet') {
        expect(run.missingVillageBuildings.length).toBeGreaterThan(0);
      }
      expect(
        run.missingVillageBuildings.every((building) =>
          ['house', 'storage', 'farm'].includes(building),
        ),
      ).toBe(true);
      expect(
        run.recentEventSummaries.some((summary) => summary.includes('village_phase_changed')),
      ).toBe(true);
    }

    expect(formatGrowthObservationReport(report)).toContain('growth-diagnosis-a');
    expect(formatGrowthObservationReport(report)).toContain('firstHamlet=');
    expect(formatGrowthObservationReport(report)).toContain('missing=');
    expect(formatGrowthObservationReport(report)).toContain('events=');
  });

  it('shows the basic house-storage-farm chain reaching village within the early observation window', () => {
    const report = observeEarlySettlementReport({
      seeds: ['growth-farm-leg-a', 'growth-farm-leg-b', 'growth-farm-leg-c'],
      ticks: 150,
      sampleEvery: 10,
    });

    for (const run of report.runs) {
      expect(run.phaseFirstTicks.village).toBeDefined();
      expect(run.phaseFirstTicks.village).toBeLessThanOrEqual(150);
      expect(run.finalSnapshot.phase).not.toBe('hamlet');
      expect(run.missingVillageBuildings).not.toContain('farm');
      expect(
        run.recentEventSummaries.some((summary) => summary.includes('building_built:farm')),
      ).toBe(true);
    }
  });

  it('summarizes satellite expansion timing for manual frontier tuning', () => {
    const report = observeSatelliteSettlementReport({
      seeds: ['growth-satellite-a', 'growth-satellite-b'],
      ticks: 260,
    });

    expect(report.runs).toHaveLength(2);

    for (const run of report.runs) {
      expect(run.firstExpansionStatusTick).toBeGreaterThan(0);
      expect(['prepare_expansion', 'waiting_population_pressure']).toContain(
        run.firstExpansionStatusPlan,
      );
      expect(run.firstPrepareExpansionTick).toBeGreaterThanOrEqual(
        run.firstExpansionStatusTick ?? 0,
      );
      expect(run.satelliteFoundedTick).toBeGreaterThan(run.firstExpansionStatusTick ?? 0);
      expect(run.expansionLeadTicks).toBeGreaterThanOrEqual(60);
      expect(run.villageCount).toBeGreaterThanOrEqual(2);
      expect(run.parentPopulationAfter).toBeGreaterThan(0);
      expect(run.childPopulation).toBe(8);
      expect(run.parentFoodInventory).toBeGreaterThanOrEqual(0);
      expect(run.parentWoodInventory).toBeGreaterThanOrEqual(0);
    }

    const formatted = formatSatelliteObservationReport(report);

    expect(formatted).toContain('firstExpansionStatus=');
    expect(formatted).toContain('expansionLead=');
    expect(formatted).toContain('satelliteFounded=');
    expect(formatted).toContain('childPopulation=');
  });
});
