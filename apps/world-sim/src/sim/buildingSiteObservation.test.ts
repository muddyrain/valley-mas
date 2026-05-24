import { describe, expect, it } from 'vitest';
import {
  formatBuildingSiteObservationReport,
  observeBuildingSiteReport,
} from './buildingSiteObservation';

describe('building site observation harness', () => {
  it('summarizes multi-seed building placement diagnostics for manual tuning', () => {
    const report = observeBuildingSiteReport({
      ticks: 180,
    });

    expect(report.runs).toHaveLength(3);

    for (const run of report.runs) {
      const types = new Set(run.sites.map((site) => site.type));

      expect(types.has('house')).toBe(true);
      expect(types.has('storage')).toBe(true);
      expect(types.has('farm')).toBe(true);
      expect(run.sites.every((site) => site.centerDistance >= 0)).toBe(true);
      expect(run.sites.every((site) => site.nearestFoodDistance >= 0)).toBe(true);
      expect(run.sites.every((site) => site.sameTypeNearestDistance >= 0)).toBe(true);
      expect(
        run.sites
          .filter((site) => site.type === 'house')
          .every((site) => site.nearestStoneOrIronDistance >= 2.5),
      ).toBe(true);
      expect(
        run.sites
          .filter((site) => site.type === 'farm')
          .every((site) => !['stone', 'iron'].includes(site.resourceType ?? '')),
      ).toBe(true);
    }

    const formatted = formatBuildingSiteObservationReport(report);

    expect(formatted).toContain('type=farm');
    expect(formatted).toContain('center=');
    expect(formatted).toContain('food=');
    expect(formatted).toContain('stoneOrIron=');
    expect(formatted).toContain('resource=');
    expect(formatted).toContain('sameType=');
  });
});
