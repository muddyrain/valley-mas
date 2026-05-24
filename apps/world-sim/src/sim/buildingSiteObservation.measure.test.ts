import { describe, expect, it } from 'vitest';
import {
  formatBuildingSiteObservationReport,
  observeBuildingSiteReport,
} from './buildingSiteObservation';

describe('PR-12F building site observation report', () => {
  it('prints multi-seed building placement diagnostics for manual tuning', () => {
    const report = observeBuildingSiteReport({ ticks: 180 });

    console.info(formatBuildingSiteObservationReport(report));

    expect(report.runs.length).toBeGreaterThan(1);
    expect(report.runs.every((run) => run.sites.some((site) => site.type === 'farm'))).toBe(true);
  });
});
