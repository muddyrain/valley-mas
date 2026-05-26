import { describe, expect, it } from 'vitest';
import { formatRebellionObservationReport, observeRebellionReport } from './rebellionObservation';

describe('PR-12G rebellion observation report', () => {
  it('summarizes rebellion preparation, split, and civil-war timing', () => {
    const report = observeRebellionReport({
      seeds: ['rebellion-observation-test'],
      ticks: 180,
    });
    const [run] = report.runs;

    expect(run.firstLowLoyaltyTick).toBeDefined();
    expect(run.firstPrepareRebellionTick).toBeDefined();
    expect(run.splitTick).toBeDefined();
    expect(run.warDeclaredTick).toBeDefined();
    expect(run.firstArmyFormedTick).toBeDefined();
    expect(run.rebelVillageId).toBeDefined();
    expect(run.parentKingdomId).toBeDefined();
    expect(run.rebelKingdomId).toBeDefined();
    expect(run.supporterCount).toBeGreaterThanOrEqual(1);
    expect(run.parentPopulationAfter).toBeGreaterThan(0);
    expect(run.rebelPopulationAfter).toBeGreaterThan(0);
    expect(run.parentSoldiersAfter).toBeGreaterThan(0);
    expect(run.rebelSoldiersAfter).toBeGreaterThan(0);
    expect(formatRebellionObservationReport(report)).toContain('split=');
    expect(formatRebellionObservationReport(report)).toContain('power=');
  });
});
