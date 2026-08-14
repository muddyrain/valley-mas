import type { DeathCauseCounts } from '@/shared/gameTypes';

const TICKS_PER_YEAR = 720;

export const DEFAULT_250_YEAR_TIMEOUT_MS = 900_000;
export const DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS = 25;

export interface Population250YearGateConfig {
  timeoutMs: number;
  reportIntervalYears: number;
}

export interface LongWorldSegmentInput {
  seed: string;
  startTick: number;
  endTick: number;
  elapsedMs: number;
  humans: number;
  children: number;
  reproductiveAdults: number;
  elders: number;
  animals: number;
  carcasses: number;
  villages: number;
  buildings: number;
  entitySlots: number;
  pathQueue: number;
  storedFood: number;
  carryingCapacity: number;
  births: number;
  deaths: number;
  deathCauses: DeathCauseCounts;
  huntTasks: number;
  butcherTasks: number;
  fishTasks: number;
  butcheredMeat: number;
  fishCaught: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.floor(parsed);
  return integer > 0 ? integer : fallback;
}

export function resolvePopulation250YearGateConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Population250YearGateConfig {
  return {
    timeoutMs: positiveInteger(environment.EON_250_YEAR_TIMEOUT_MS, DEFAULT_250_YEAR_TIMEOUT_MS),
    reportIntervalYears: positiveInteger(
      environment.EON_250_YEAR_REPORT_INTERVAL_YEARS,
      DEFAULT_250_YEAR_REPORT_INTERVAL_YEARS,
    ),
  };
}

export function createLongWorldSegmentReport(input: LongWorldSegmentInput) {
  const ticks = input.endTick - input.startTick;
  if (ticks <= 0) throw new Error('Long-world segment must advance at least one tick.');
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) {
    throw new Error('Long-world segment elapsed time must be a non-negative finite number.');
  }
  return {
    seed: input.seed,
    startYear: Number((input.startTick / TICKS_PER_YEAR).toFixed(2)),
    endYear: Number((input.endTick / TICKS_PER_YEAR).toFixed(2)),
    ticks,
    elapsedMs: Number(input.elapsedMs.toFixed(2)),
    averageTickMs: Number((input.elapsedMs / ticks).toFixed(4)),
    humans: input.humans,
    children: input.children,
    reproductiveAdults: input.reproductiveAdults,
    elders: input.elders,
    animals: input.animals,
    carcasses: input.carcasses,
    villages: input.villages,
    buildings: input.buildings,
    entitySlots: input.entitySlots,
    pathQueue: input.pathQueue,
    storedFood: Number(input.storedFood.toFixed(2)),
    carryingCapacity: input.carryingCapacity,
    births: input.births,
    deaths: input.deaths,
    deathCauses: { ...input.deathCauses },
    huntTasks: input.huntTasks,
    butcherTasks: input.butcherTasks,
    fishTasks: input.fishTasks,
    butcheredMeat: input.butcheredMeat,
    fishCaught: input.fishCaught,
  };
}
