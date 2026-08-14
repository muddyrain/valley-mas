import { BuildingType, type Village, type WorldState } from '@/shared/gameTypes';

export const BARRACKS_GUARD_SLOTS = 4;
export const COUNCIL_HALL_REACH_BONUS = 2;
export const COUNCIL_HALL_CLAIM_BONUS = 8;
export const WATCHTOWER_REACH_BONUS = 1;
export const WATCHTOWER_RANGE = 14;
export const WATCHTOWER_DAMAGE = 18;

export interface SettlementCapabilities {
  barracks: number;
  councilHalls: number;
  walls: number;
  watchtowers: number;
  guardTrainingSlots: number;
  territoryReachBonus: number;
  claimStrengthBonus: number;
  captureBlockers: number;
  watchRange: number;
  watchDamage: number;
}

export function resolveSettlementCapabilities(
  state: WorldState,
  village: Village,
): SettlementCapabilities {
  const counts = new Map<BuildingType, number>();
  for (const buildingId of village.buildingIds) {
    const building = state.buildings[buildingId - 1];
    if (!building?.completed || building.health <= 0) continue;
    counts.set(building.type, (counts.get(building.type) ?? 0) + 1);
  }
  const barracks = counts.get(BuildingType.Barracks) ?? 0;
  const councilHalls = counts.get(BuildingType.CouncilHall) ?? 0;
  const walls = counts.get(BuildingType.Wall) ?? 0;
  const watchtowers = counts.get(BuildingType.Watchtower) ?? 0;
  return {
    barracks,
    councilHalls,
    walls,
    watchtowers,
    guardTrainingSlots: barracks * BARRACKS_GUARD_SLOTS,
    territoryReachBonus:
      councilHalls * COUNCIL_HALL_REACH_BONUS + watchtowers * WATCHTOWER_REACH_BONUS,
    claimStrengthBonus: councilHalls * COUNCIL_HALL_CLAIM_BONUS,
    captureBlockers: walls,
    watchRange: watchtowers > 0 ? WATCHTOWER_RANGE : 0,
    watchDamage: watchtowers * WATCHTOWER_DAMAGE,
  };
}
