import { describe, expect, it, vi } from 'vitest';
import { formatBalanceReport, runBalanceProbe } from '../src/core/sim';

describe('balance report probe', () => {
  it('summarizes multiple seeds for early snowball and spawn-band diagnostics', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const report = runBalanceProbe({
        seeds: ['balance-probe-a', 'balance-probe-b', 'balance-probe-c', 'balance-probe-d'],
        provinceCount: 1000,
        maxYears: 100,
        checkpointYears: [0, 25, 50, 100],
        bounds: { width: 1200, height: 800 },
      });

      console.info(formatBalanceReport(report));

      expect(report.seedReports).toHaveLength(4);
      expect(report.averageLandRatio).toBeGreaterThan(0.35);
      expect(report.averageLandRatio).toBeLessThan(0.85);
      expect(report.averageYear50LargestShare).toBeGreaterThan(0.12);
      expect(report.maxYear50LargestShare).toBeLessThanOrEqual(0.42);
      expect(report.averageFinalLiveCount).toBeGreaterThan(1);
      expect(report.averageOwnerChurnRegions).toBeGreaterThan(0);
      expect(
        report.seedReports.every((seedReport) => seedReport.factions.length === 8),
      ).toBe(true);
      expect(
        report.seedReports.every((seedReport) =>
          seedReport.samples.some((sample) => sample.year === 50),
        ),
      ).toBe(true);
      expect(
        report.seedReports.some(
          (seedReport) => seedReport.edgeStartCount > 0 || seedReport.centerStartCount > 0,
        ),
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  }, 45_000);
});
