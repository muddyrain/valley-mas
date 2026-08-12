import {
  type DeathCauseCounts,
  type PopulationDiagnostics,
  ResidentSex,
  type ShortageStage,
} from '@/shared/gameTypes';

export interface CapacityInputs {
  housingCapacity: number;
  completedFarms: number;
  storedFood: number;
  foodTrend: number;
  safety: number;
}

export function calculateCarryingCapacity({
  housingCapacity,
  completedFarms,
  storedFood,
  foodTrend,
  safety,
}: CapacityInputs): number {
  const naturalSupport = 12;
  const farmSupport = completedFarms * 24;
  const reserveSupport = Math.min(18, Math.floor(Math.max(0, storedFood) / 4));
  const trendSupport = Math.max(-8, Math.min(12, Math.round(foodTrend * 4)));
  const foodCapacity = Math.max(4, naturalSupport + farmSupport + reserveSupport + trendSupport);
  return Math.max(
    2,
    Math.floor(Math.min(Math.max(2, housingCapacity), foodCapacity) * Math.max(0.35, safety)),
  );
}

export function birthPressure({
  population,
  carryingCapacity,
  storedFood,
}: {
  population: number;
  carryingCapacity: number;
  storedFood: number;
}): number {
  if (storedFood < 4 || carryingCapacity <= 0) return 0;
  const occupancy = population / carryingCapacity;
  if (occupancy >= 0.9) return 0;
  if (occupancy <= 0.58) return 1;
  return Math.max(0, (0.9 - occupancy) / 0.32);
}

export function chooseNewbornSex({
  femaleChildren,
  maleChildren,
  randomValue,
}: {
  femaleChildren: number;
  maleChildren: number;
  randomValue: number;
}): ResidentSex {
  if (femaleChildren < maleChildren) return ResidentSex.Female;
  if (maleChildren < femaleChildren) return ResidentSex.Male;
  return randomValue < 0.5 ? ResidentSex.Female : ResidentSex.Male;
}

export function resolveShortageStage({
  storedFood,
  population,
  shortageTicks,
}: {
  storedFood: number;
  population: number;
  shortageTicks: number;
}): ShortageStage {
  if (population <= 0 || storedFood / population >= 0.5) return 'stable';
  if (shortageTicks < 720) return 'rationing';
  if (shortageTicks < 1_800) return 'migration';
  return 'famine';
}

export function emptyDeathCauses(): DeathCauseCounts {
  return { age: 0, hunger: 0, disease: 0, violence: 0, disaster: 0 };
}

export function createPopulationDiagnostics(): PopulationDiagnostics {
  return {
    totalBirths: 0,
    totalDeaths: 0,
    totalMigrations: 0,
    birthsThisYear: 0,
    deathsThisYear: 0,
    migrationsThisYear: 0,
    birthsLastYear: 0,
    deathsLastYear: 0,
    migrationsLastYear: 0,
    deathCauses: emptyDeathCauses(),
    deathCausesThisYear: emptyDeathCauses(),
    carryingCapacity: 0,
    housingCapacity: 0,
    storedFood: 0,
    children: 0,
    adults: 0,
    elders: 0,
    trend: 0,
    history: [],
  };
}
