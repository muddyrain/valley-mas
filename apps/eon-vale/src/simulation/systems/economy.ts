import {
  type Building,
  BuildingType,
  ResourceNodeKind,
  type Village,
  VillageTier,
  type WorldState,
} from '@/shared/gameTypes';
import { findResourceNodesInRadius, removeResourceNode } from '../resources/resourceNodes';

const BUILDING_COSTS: Record<BuildingType, { wood: number; stone: number; progress: number }> = {
  [BuildingType.TownCenter]: { wood: 20, stone: 8, progress: 140 },
  [BuildingType.Home]: { wood: 12, stone: 2, progress: 100 },
  [BuildingType.Farm]: { wood: 8, stone: 0, progress: 80 },
  [BuildingType.Storage]: { wood: 16, stone: 5, progress: 120 },
  [BuildingType.Barracks]: { wood: 24, stone: 12, progress: 160 },
  [BuildingType.Road]: { wood: 3, stone: 2, progress: 45 },
  [BuildingType.LoggingCamp]: { wood: 14, stone: 2, progress: 100 },
  [BuildingType.Mine]: { wood: 16, stone: 10, progress: 135 },
  [BuildingType.Workshop]: { wood: 20, stone: 8, progress: 145 },
  [BuildingType.CouncilHall]: { wood: 28, stone: 18, progress: 190 },
  [BuildingType.Wall]: { wood: 8, stone: 16, progress: 90 },
  [BuildingType.Watchtower]: { wood: 18, stone: 14, progress: 130 },
};

export interface VillageTierRequirement {
  tier: VillageTier;
  population: number;
  buildings: Partial<Record<BuildingType, number>>;
}

export const VILLAGE_TIER_REQUIREMENTS: readonly VillageTierRequirement[] = [
  {
    tier: VillageTier.Hamlet,
    population: 12,
    buildings: {
      [BuildingType.TownCenter]: 1,
      [BuildingType.Home]: 1,
      [BuildingType.Farm]: 1,
    },
  },
  {
    tier: VillageTier.Town,
    population: 25,
    buildings: {
      [BuildingType.TownCenter]: 1,
      [BuildingType.Home]: 2,
      [BuildingType.Storage]: 1,
      [BuildingType.Farm]: 2,
      [BuildingType.LoggingCamp]: 1,
      [BuildingType.Workshop]: 1,
      [BuildingType.Barracks]: 1,
    },
  },
  {
    tier: VillageTier.CityState,
    population: 45,
    buildings: {
      [BuildingType.TownCenter]: 1,
      [BuildingType.Home]: 4,
      [BuildingType.Storage]: 2,
      [BuildingType.Farm]: 2,
      [BuildingType.LoggingCamp]: 1,
      [BuildingType.Workshop]: 1,
      [BuildingType.Barracks]: 1,
      [BuildingType.CouncilHall]: 1,
      [BuildingType.Wall]: 1,
      [BuildingType.Watchtower]: 1,
    },
  },
] as const;

function buildingCounts(types: readonly BuildingType[]): Map<BuildingType, number> {
  const counts = new Map<BuildingType, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  return counts;
}

export function meetsVillageTierRequirement(
  population: number,
  types: readonly BuildingType[],
  requirement: VillageTierRequirement,
): boolean {
  if (population < requirement.population) return false;
  const counts = buildingCounts(types);
  return Object.entries(requirement.buildings).every(
    ([type, required]) => (counts.get(Number(type) as BuildingType) ?? 0) >= (required ?? 0),
  );
}

export function evaluateVillageTier(
  population: number,
  operationalBuildingTypes: readonly BuildingType[],
): VillageTier {
  for (const requirement of [...VILLAGE_TIER_REQUIREMENTS].reverse()) {
    if (meetsVillageTierRequirement(population, operationalBuildingTypes, requirement)) {
      return requirement.tier;
    }
  }
  return VillageTier.Camp;
}

export function nextVillageTierRequirement(tier: VillageTier): VillageTierRequirement | null {
  return VILLAGE_TIER_REQUIREMENTS.find((requirement) => requirement.tier === tier + 1) ?? null;
}

export function startConstruction(
  state: WorldState,
  village: Village,
  type: BuildingType,
  x: number,
  z: number,
): Building | null {
  const cost = BUILDING_COSTS[type];
  if (
    type === BuildingType.Mine &&
    !findResourceNodesInRadius(state.resourceNodes, x, z, 10).some(
      (nodeId) => state.resourceNodes.kind[nodeId] === ResourceNodeKind.Metal,
    )
  ) {
    return null;
  }
  if (village.resources.wood < cost.wood || village.resources.stone < cost.stone) return null;
  village.resources.wood -= cost.wood;
  village.resources.stone -= cost.stone;
  const building: Building = {
    id: state.buildings.length + 1,
    villageId: village.id,
    type,
    x,
    z,
    stage: 0,
    progress: 0,
    requiredProgress: cost.progress,
    health: 100,
    completed: false,
    constructionPhase: 'delivery',
    reservedWood: cost.wood,
    reservedStone: cost.stone,
    deliveredWood: 0,
    deliveredStone: 0,
    inTransitWood: 0,
    inTransitStone: 0,
    clearNodeIds: findResourceNodesInRadius(
      state.resourceNodes,
      x + 0.5,
      z + 0.5,
      type === BuildingType.TownCenter ? 4.5 : type === BuildingType.Road ? 0.65 : 1.25,
    ),
    assignedWorkerIds: [],
    workSlots: 0,
  };
  if (building.clearNodeIds.length > 0) building.constructionPhase = 'clearing';
  state.buildings.push(building);
  village.buildingIds.push(building.id);
  return building;
}

export function advanceConstruction(state: WorldState): void {
  for (const building of state.buildings) {
    if (building.completed || building.health <= 0) continue;
    const ratio = building.progress / building.requiredProgress;
    building.stage = ratio >= 1 ? 2 : ratio >= 0.36 ? 1 : 0;
  }
}

export function clearConstructionSite(state: WorldState, building: Building): boolean {
  if (building.completed || building.constructionPhase !== 'clearing') return false;
  while (building.clearNodeIds.length > 0) {
    const nodeId = building.clearNodeIds.shift();
    if (nodeId === undefined || state.resourceNodes.active[nodeId] !== 1) continue;
    const removed = removeResourceNode(state.resourceNodes, nodeId);
    const village = state.villages.find((candidate) => candidate.id === building.villageId);
    if (village) {
      if (removed.kind === ResourceNodeKind.Tree) village.resources.wood += removed.amount;
      else if (removed.kind === ResourceNodeKind.Stone) village.resources.stone += removed.amount;
      else village.resources.metal += removed.amount;
    }
    if (building.clearNodeIds.length === 0) building.constructionPhase = 'delivery';
    return true;
  }
  building.constructionPhase = 'delivery';
  return false;
}

export function deliverConstructionResources(
  building: Building,
  wood: number,
  stone: number,
): { wood: number; stone: number } {
  if (building.completed || building.constructionPhase !== 'delivery') return { wood: 0, stone: 0 };
  const deliveredWood = Math.min(
    Math.max(0, Math.round(wood)),
    building.reservedWood - building.deliveredWood,
  );
  const deliveredStone = Math.min(
    Math.max(0, Math.round(stone)),
    building.reservedStone - building.deliveredStone,
  );
  building.deliveredWood += deliveredWood;
  building.deliveredStone += deliveredStone;
  building.inTransitWood = Math.max(0, building.inTransitWood - deliveredWood);
  building.inTransitStone = Math.max(0, building.inTransitStone - deliveredStone);
  if (
    building.deliveredWood >= building.reservedWood &&
    building.deliveredStone >= building.reservedStone
  ) {
    building.constructionPhase = 'building';
  }
  return { wood: deliveredWood, stone: deliveredStone };
}

export function applyConstructionWork(
  state: WorldState,
  building: Building,
  amount: number,
): number {
  if (building.completed || building.health <= 0 || building.constructionPhase !== 'building') {
    return 0;
  }
  const before = building.progress;
  building.progress = Math.min(building.requiredProgress, building.progress + Math.max(0, amount));
  const ratio = building.progress / building.requiredProgress;
  building.stage = ratio >= 1 ? 2 : ratio >= 0.36 ? 1 : 0;
  if (ratio >= 1) {
    building.completed = true;
    building.constructionPhase = 'complete';
    const village = state.villages.find((candidate) => candidate.id === building.villageId);
    if (village) {
      if (building.type === BuildingType.Home) village.housingCapacity += 8;
      if (building.type === BuildingType.Storage) village.storageCapacity += 120;
    }
  }
  return building.progress - before;
}

export function clampResources(village: Village): void {
  village.resources.food = Math.max(0, Math.min(village.storageCapacity, village.resources.food));
  village.resources.wood = Math.max(0, Math.min(village.storageCapacity, village.resources.wood));
  village.resources.stone = Math.max(0, Math.min(village.storageCapacity, village.resources.stone));
  village.resources.metal = Math.max(0, Math.min(village.storageCapacity, village.resources.metal));
  village.resources.gold = Math.max(0, Math.min(village.storageCapacity, village.resources.gold));
  village.resources.tools = Math.max(0, Math.min(village.storageCapacity, village.resources.tools));
  village.resources.equipment = Math.max(
    0,
    Math.min(village.storageCapacity, village.resources.equipment),
  );
}
