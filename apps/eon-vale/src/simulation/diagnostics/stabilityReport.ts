import type {
  FoodSourceCounts,
  KingdomLifeStatus,
  ResidentActivityCategory,
  WorldState,
} from '@/shared/gameTypes';
import { EntityKind } from '@/shared/gameTypes';
import { kingdomLifeStatus } from '../kingdoms/kingdoms';
import { deriveGroupActivity } from '../observation/activityDiagnostics';
import { GROUP_ACTIVITY_RULES, type StabilityScenarioId } from '../rules/stabilityRules';

export type StabilityReportPhase = 'before' | 'after';

export interface StabilityScenarioReport {
  scenarioId: StabilityScenarioId;
  phase: StabilityReportPhase;
  tick: number;
  year: number;
  humans: number;
  storedFood: number;
  foodSources: FoodSourceCounts;
  kingdoms: Record<KingdomLifeStatus, number>;
  activities: Record<ResidentActivityCategory, number>;
  anomalyGroups: number;
  criticalHungerResidents: number;
  blockedResidents: number;
  failedTaskResidents: number;
  sustainedFailureResidents: number;
  longFoodTripResidents: number;
}

export function createStabilityScenarioReport(
  state: WorldState,
  scenarioId: StabilityScenarioId,
  phase: StabilityReportPhase,
): StabilityScenarioReport {
  let humans = 0;
  let criticalHungerResidents = 0;
  let failedTaskResidents = 0;
  let sustainedFailureResidents = 0;
  let longFoodTripResidents = 0;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (
      state.entities.active[entityId] === 1 &&
      (state.entities.health[entityId] ?? 0) > 0 &&
      state.entities.kind[entityId] === EntityKind.Human
    ) {
      humans += 1;
      if (
        (state.entities.hunger[entityId] ?? 0) >= GROUP_ACTIVITY_RULES.criticalHungerAlertThreshold
      ) {
        criticalHungerResidents += 1;
      }
      const task = state.entities.tasks[entityId] ?? state.entities.suspendedTasks[entityId];
      if (task?.phase === 'failed') {
        failedTaskResidents += 1;
        if (state.tick - task.finishedAtTick >= GROUP_ACTIVITY_RULES.failedTaskAlertTicks) {
          sustainedFailureResidents += 1;
        }
      }
      if (task?.type === 'eat') {
        const currentX = Math.floor(state.entities.positionsX[entityId] ?? 0);
        const currentZ = Math.floor(state.entities.positionsZ[entityId] ?? 0);
        const targetX = task.targetCell % state.map.size;
        const targetZ = Math.floor(task.targetCell / state.map.size);
        if (
          Math.abs(targetX - currentX) + Math.abs(targetZ - currentZ) >=
          GROUP_ACTIVITY_RULES.longFoodTripCells
        ) {
          longFoodTripResidents += 1;
        }
      }
    }
  }
  const activity = deriveGroupActivity(state, {});
  const activities = Object.fromEntries(
    activity.categories.map(({ category, count }) => [category, count]),
  ) as Record<ResidentActivityCategory, number>;
  const kingdomCounts: Record<KingdomLifeStatus, number> = {
    active: 0,
    endangered: 0,
    exiled: 0,
    extinct: 0,
  };
  for (const kingdom of state.kingdoms) kingdomCounts[kingdomLifeStatus(state, kingdom)] += 1;
  const foodSources = state.villages.reduce<FoodSourceCounts>(
    (sum, village) => ({
      farm: sum.farm + village.foodSources.farm,
      wild: sum.wild + village.foodSources.wild,
      meat: sum.meat + village.foodSources.meat,
      fish: sum.fish + village.foodSources.fish,
    }),
    { farm: 0, wild: 0, meat: 0, fish: 0 },
  );
  return {
    scenarioId,
    phase,
    tick: state.tick,
    year: state.year,
    humans,
    storedFood: state.villages.reduce((sum, village) => sum + village.resources.food, 0),
    foodSources,
    kingdoms: kingdomCounts,
    activities,
    anomalyGroups: activity.alerts.length,
    criticalHungerResidents,
    blockedResidents: activities.blocked,
    failedTaskResidents,
    sustainedFailureResidents,
    longFoodTripResidents,
  };
}
