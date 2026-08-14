import { describe, expect, it } from 'vitest';
import {
  createLongWorldSegmentReport,
  DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS,
  DEFAULT_250_YEAR_TIMEOUT_MS,
  resolvePopulation250YearGateConfig,
} from './longWorldGate';

describe('long-world gate configuration', () => {
  it('keeps the demographic gate timeout separate from the product performance budget', () => {
    expect(resolvePopulation250YearGateConfig({})).toEqual({
      timeoutMs: DEFAULT_250_YEAR_TIMEOUT_MS,
      reportIntervalYears: DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS,
    });
    expect(DEFAULT_250_YEAR_TIMEOUT_MS).toBe(900_000);
    expect(DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS).toBe(25);
  });

  it('accepts positive overrides and rejects invalid gate values', () => {
    expect(
      resolvePopulation250YearGateConfig({
        EON_250_YEAR_TIMEOUT_MS: '1200000',
        EON_250_YEAR_REPORT_INTERVAL_YEARS: '10',
      }),
    ).toEqual({ timeoutMs: 1_200_000, reportIntervalYears: 10 });
    expect(
      resolvePopulation250YearGateConfig({
        EON_250_YEAR_TIMEOUT_MS: '0.5',
        EON_250_YEAR_REPORT_INTERVAL_YEARS: '0.5',
      }),
    ).toEqual({
      timeoutMs: DEFAULT_250_YEAR_TIMEOUT_MS,
      reportIntervalYears: DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS,
    });
    expect(
      resolvePopulation250YearGateConfig({
        EON_250_YEAR_TIMEOUT_MS: 'not-a-number',
        EON_250_YEAR_REPORT_INTERVAL_YEARS: '0',
      }),
    ).toEqual({
      timeoutMs: DEFAULT_250_YEAR_TIMEOUT_MS,
      reportIntervalYears: DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS,
    });
  });
});

describe('long-world segment reporting', () => {
  it('normalizes elapsed wall time into a comparable per-tick sample', () => {
    expect(
      createLongWorldSegmentReport({
        seed: 'segmented-world',
        startTick: 0,
        endTick: 18_000,
        elapsedMs: 45_000.126,
        humans: 160,
        children: 42,
        reproductiveAdults: 58,
        elders: 24,
        animals: 72,
        carcasses: 4,
        villages: 3,
        buildings: 24,
        entitySlots: 420,
        pathQueue: 12,
        storedFood: 240.126,
        carryingCapacity: 220,
        births: 180,
        deaths: 92,
        deathCauses: { age: 48, hunger: 32, disease: 8, violence: 4, disaster: 0 },
        huntTasks: 2,
        butcherTasks: 1,
        fishTasks: 3,
        butcheredMeat: 64,
        fishCaught: 18,
      }),
    ).toEqual({
      seed: 'segmented-world',
      startYear: 0,
      endYear: 25,
      ticks: 18_000,
      elapsedMs: 45_000.13,
      averageTickMs: 2.5,
      humans: 160,
      children: 42,
      reproductiveAdults: 58,
      elders: 24,
      animals: 72,
      carcasses: 4,
      villages: 3,
      buildings: 24,
      entitySlots: 420,
      pathQueue: 12,
      storedFood: 240.13,
      carryingCapacity: 220,
      births: 180,
      deaths: 92,
      deathCauses: { age: 48, hunger: 32, disease: 8, violence: 4, disaster: 0 },
      huntTasks: 2,
      butcherTasks: 1,
      fishTasks: 3,
      butcheredMeat: 64,
      fishCaught: 18,
    });
  });

  it('rejects empty segments', () => {
    expect(() =>
      createLongWorldSegmentReport({
        seed: 'empty-world',
        startTick: 20,
        endTick: 20,
        elapsedMs: 0,
        humans: 0,
        children: 0,
        reproductiveAdults: 0,
        elders: 0,
        animals: 0,
        carcasses: 0,
        villages: 0,
        buildings: 0,
        entitySlots: 0,
        pathQueue: 0,
        storedFood: 0,
        carryingCapacity: 0,
        births: 0,
        deaths: 0,
        deathCauses: { age: 0, hunger: 0, disease: 0, violence: 0, disaster: 0 },
        huntTasks: 0,
        butcherTasks: 0,
        fishTasks: 0,
        butcheredMeat: 0,
        fishCaught: 0,
      }),
    ).toThrow('Long-world segment must advance at least one tick.');
  });
});
