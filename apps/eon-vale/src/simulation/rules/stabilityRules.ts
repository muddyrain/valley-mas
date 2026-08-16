import type { FoodSourceKind, ResidentActivityCategory } from '@/shared/gameTypes';

export const FOOD_LOOP_RULES = Object.freeze({
  inventoryUnit: 'food',
  sourceKinds: ['farm', 'wild', 'meat', 'fish'] as const satisfies readonly FoodSourceKind[],
  storageSelection: 'lowest-reachable-navigation-cost',
  recipesInCurrentPhase: false,
});

export const TRAVEL_RATION_RULES = Object.freeze({
  // Residents gain roughly one meal of hunger while travelling 128 cells
  // (0.075 cell/tick versus 0.4 hunger/tick). Keep ration costs tied to that rate.
  distanceCellsPerMeal: 128,
  mealHungerThreshold: 680,
  mealHungerReduction: 680,
  settlementFoodReserve: 6,
  ordinaryWorkMaxOneWayCells: 48,
  rejectJourneyWithoutRations: true,
});

export function requiredTravelRations(distanceCells: number, memberCount: number): number {
  if (distanceCells <= 0 || memberCount <= 0) return 0;
  return (
    Math.ceil(distanceCells / TRAVEL_RATION_RULES.distanceCellsPerMeal) * Math.floor(memberCount)
  );
}

export function reservableTravelRations(
  availableFood: number,
  distanceCells: number,
  memberCount: number,
): number {
  const required = requiredTravelRations(distanceCells, memberCount);
  return availableFood >= required + TRAVEL_RATION_RULES.settlementFoodReserve ? required : 0;
}

export const KINGDOM_SURVIVAL_RULES = Object.freeze({
  active: 'living-citizens-and-populated-settlement',
  endangered: 'living-citizens-below-viable-population',
  exiled: 'living-citizens-without-populated-settlement',
  extinct: 'no-living-citizens',
  emptySettlementsBecomeAbandoned: true,
  crossKingdomAidInCurrentPhase: false,
} as const);

export const GROUP_ACTIVITY_RULES = Object.freeze({
  categories: [
    'survival',
    'production',
    'logistics',
    'military',
    'migration',
    'idle',
    'blocked',
  ] as const satisfies readonly ResidentActivityCategory[],
  alertMinimumResidents: 3,
  criticalHungerAlertThreshold: 950,
  failedTaskAlertTicks: 20,
  longFoodTripCells: 32,
});

export type StabilityScenarioId =
  | 'peace'
  | 'famine-recovery'
  | 'isolated-weak-kingdom'
  | 'two-kingdom-war'
  | 'long-expedition'
  | 'ocean-no-boat-baseline';

export const STABILITY_SCENARIOS = Object.freeze([
  { id: 'peace', seed: 'stability-peace' },
  { id: 'famine-recovery', seed: 'stability-famine-recovery' },
  { id: 'isolated-weak-kingdom', seed: 'stability-isolated-weak-kingdom' },
  { id: 'two-kingdom-war', seed: 'stability-two-kingdom-war' },
  { id: 'long-expedition', seed: 'stability-long-expedition' },
  { id: 'ocean-no-boat-baseline', seed: 'stability-ocean-no-boat' },
] as const satisfies readonly { id: StabilityScenarioId; seed: string }[]);
