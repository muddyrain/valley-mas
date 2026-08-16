import { describe, expect, it } from 'vitest';
import { createWorldSimulation } from '../core/worldSimulation';
import { STABILITY_SCENARIOS } from '../rules/stabilityRules';
import { createStabilityScenarioReport } from './stabilityReport';

describe('fixed stability scenario reports', () => {
  it.each(STABILITY_SCENARIOS)('creates deterministic before/after reports for $id', (scenario) => {
    const first = createWorldSimulation({ seed: scenario.seed, initialHumans: 24 });
    const second = createWorldSimulation({ seed: scenario.seed, initialHumans: 24 });
    const before = createStabilityScenarioReport(first.state, scenario.id, 'before');
    for (let tick = 0; tick < 40; tick += 1) {
      first.step();
      second.step();
    }
    const after = createStabilityScenarioReport(first.state, scenario.id, 'after');
    const repeated = createStabilityScenarioReport(second.state, scenario.id, 'after');

    expect(after).toEqual(repeated);
    expect(before.phase).toBe('before');
    expect(after.phase).toBe('after');
    expect(after.tick).toBeGreaterThan(before.tick);
    expect(after).toMatchObject({
      criticalHungerResidents: expect.any(Number),
      blockedResidents: expect.any(Number),
      failedTaskResidents: expect.any(Number),
      sustainedFailureResidents: expect.any(Number),
      longFoodTripResidents: expect.any(Number),
    });
  });
});
