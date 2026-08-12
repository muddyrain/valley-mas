export const POPULATION_BALANCE_RULES = Object.freeze({
  healthyMinimumRatio: 0.6,
  healthyMaximumRatio: 0.85,
  interventionRatio: 0.45,
  minimumViableVillagePopulation: 6,
});

export type PopulationBalanceStatus =
  | 'no-capacity'
  | 'intervention'
  | 'below-target'
  | 'healthy'
  | 'above-target';

export function classifyPopulationBalance(
  population: number,
  carryingCapacity: number,
): PopulationBalanceStatus {
  if (carryingCapacity <= 0) return 'no-capacity';
  const ratio = population / carryingCapacity;
  if (ratio < POPULATION_BALANCE_RULES.interventionRatio) return 'intervention';
  if (ratio < POPULATION_BALANCE_RULES.healthyMinimumRatio) return 'below-target';
  if (ratio <= POPULATION_BALANCE_RULES.healthyMaximumRatio) return 'healthy';
  return 'above-target';
}
