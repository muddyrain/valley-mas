import { describe, expect, it } from 'vitest';
import { formatRebellionObservationReport, observeRebellionReport } from './rebellionObservation';

describe('PR-12G rebellion observation report', () => {
  it('prints multi-seed rebellion and civil-war timing diagnostics for tuning', () => {
    const report = observeRebellionReport({ ticks: 180 });

    console.info(formatRebellionObservationReport(report));

    expect(report.runs.length).toBeGreaterThan(1);
    expect(report.runs.every((run) => run.splitTick !== undefined)).toBe(true);
    expect(report.runs.every((run) => run.warDeclaredTick !== undefined)).toBe(true);
  });
});
