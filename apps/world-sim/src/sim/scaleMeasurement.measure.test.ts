import { describe, expect, it } from 'vitest';
import {
  formatScaleMeasurement,
  measureScaleScenarios,
  SCALE_MEASUREMENT_SCENARIOS,
} from './scaleMeasurement';

describe('PR-11 scale measurement report', () => {
  it('prints the scale measurement table for manual bottleneck decisions', () => {
    const results = measureScaleScenarios();

    for (const result of results) {
      console.info(formatScaleMeasurement(result));
    }

    expect(results).toHaveLength(SCALE_MEASUREMENT_SCENARIOS.length);
    expect(results.every((result) => result.population > 0)).toBe(true);
  });
});
