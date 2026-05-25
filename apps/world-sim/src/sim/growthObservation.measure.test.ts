import { describe, expect, it } from 'vitest';
import {
  formatGrowthObservation,
  formatGrowthObservationReport,
  formatSatelliteObservationReport,
  formatWindmillSupportObservationReport,
  observeEarlySettlement,
  observeEarlySettlementReport,
  observeSatelliteSettlementReport,
  observeWindmillSupportReport,
} from './growthObservation';

describe('PR-12F early settlement observation report', () => {
  it('prints deterministic early-growth snapshots for manual balance decisions', () => {
    const snapshots = observeEarlySettlement();

    for (const snapshot of snapshots) {
      console.info(formatGrowthObservation(snapshot));
    }

    expect(snapshots.some((snapshot) => snapshot.phase === 'camp')).toBe(true);
    expect(snapshots.some((snapshot) => snapshot.phase === 'hamlet')).toBe(true);
  });

  it('prints multi-seed phase diagnostics for hamlet-to-village tuning', () => {
    const report = observeEarlySettlementReport({ ticks: 150, sampleEvery: 10 });

    console.info(formatGrowthObservationReport(report));

    expect(report.runs.length).toBeGreaterThan(1);
    expect(report.runs.every((run) => run.phaseFirstTicks.hamlet !== undefined)).toBe(true);
  });

  it('prints isolated windmill support diagnostics for food tuning', () => {
    const report = observeWindmillSupportReport({ ticks: 240 });

    console.info(formatWindmillSupportObservationReport(report));

    expect(report.runs.length).toBeGreaterThan(1);
    expect(report.runs.every((run) => run.finalFoodReserveBalance >= 0)).toBe(true);
  });

  it('prints satellite expansion timing diagnostics for frontier tuning', () => {
    const report = observeSatelliteSettlementReport({ ticks: 260 });

    console.info(formatSatelliteObservationReport(report));

    expect(report.runs.length).toBeGreaterThan(1);
    expect(report.runs.every((run) => run.satelliteFoundedTick !== undefined)).toBe(true);
  });
});
