import {
  type Building,
  BuildingType,
  type ConstructionPriority,
  EntityKind,
  Profession,
  ResourceNodeKind,
  type Resources,
  type Village,
  type WorldState,
} from '@/shared/gameTypes';
import { findResourceNodesInRadius } from '../resources/resourceNodes';
import { HUNTING_RULES } from '../rules/ecologyRules';
import { nextVillageTierRequirement } from '../systems/economy';
import { BARRACKS_GUARD_SLOTS } from './settlementCapabilities';

const RESOURCE_KEYS = [
  'food',
  'wood',
  'stone',
  'metal',
  'gold',
  'tools',
  'equipment',
] as const satisfies readonly (keyof Resources)[];

const WORK_SLOTS: Partial<Record<BuildingType, number>> = {
  [BuildingType.Barracks]: BARRACKS_GUARD_SLOTS,
  [BuildingType.Farm]: 3,
  [BuildingType.LoggingCamp]: 3,
  [BuildingType.Mine]: 3,
  [BuildingType.Workshop]: 2,
};

function operationalBuildings(state: WorldState, village: Village): Building[] {
  return village.buildingIds.flatMap((buildingId) => {
    const building = state.buildings[buildingId - 1];
    return building?.completed && building.health > 0 ? [building] : [];
  });
}

function matchingWorkplace(profession: Profession): BuildingType | null {
  if (profession === Profession.Farmer) {
    return BuildingType.Farm;
  }
  if (profession === Profession.Woodcutter) return BuildingType.LoggingCamp;
  if (profession === Profession.Miner) return BuildingType.Mine;
  if (profession === Profession.Blacksmith) return BuildingType.Workshop;
  if (profession === Profession.Guard) return BuildingType.Barracks;
  return null;
}

export function recalculateVillageOperations(state: WorldState, village: Village): void {
  const buildings = operationalBuildings(state, village);
  const storageCount = buildings.filter(
    (building) => building.type === BuildingType.Storage,
  ).length;
  const homeCount = buildings.filter((building) => building.type === BuildingType.Home).length;
  const categoryCapacity = 40 + storageCount * 120;
  village.storageCapacity = categoryCapacity;
  if (!village.operationsInitialized) {
    village.campHousingCapacity = Math.max(
      village.campHousingCapacity,
      village.housingCapacity - homeCount * 8,
    );
    village.operationsInitialized = true;
  }
  village.housingCapacity = village.campHousingCapacity + homeCount * 8;
  for (const key of RESOURCE_KEYS) {
    village.storageCapacityByKind[key] = categoryCapacity;
    const available = Math.max(0, categoryCapacity - village.resources[key]);
    const recovered = Math.min(available, village.outdoorStockpile[key]);
    if (recovered > 0) {
      village.resources[key] += recovered;
      village.outdoorStockpile[key] -= recovered;
    }
    const overflow = Math.max(0, village.resources[key] - categoryCapacity);
    if (overflow <= 0) continue;
    village.resources[key] -= overflow;
    village.outdoorStockpile[key] += overflow;
    if (village.outdoorSinceTicks[key] === 0) village.outdoorSinceTicks[key] = state.tick;
  }
  for (const buildingId of village.buildingIds) {
    const building = state.buildings[buildingId - 1];
    if (!building) continue;
    building.workSlots =
      building.completed && building.health > 0 ? (WORK_SLOTS[building.type] ?? 0) : 0;
    building.assignedWorkerIds = building.assignedWorkerIds.filter(
      (entityId) =>
        building.workSlots > 0 &&
        state.entities.active[entityId] === 1 &&
        state.entities.workBuildingIds[entityId] === building.id,
    );
    if (building.assignedWorkerIds.length > building.workSlots) {
      for (const entityId of building.assignedWorkerIds.slice(building.workSlots)) {
        state.entities.workBuildingIds[entityId] = 0;
      }
      building.assignedWorkerIds.length = building.workSlots;
    }
  }
}

export function assignVillageHomesAndWorkplaces(state: WorldState, village: Village): void {
  recalculateVillageOperations(state, village);
  const homes = operationalBuildings(state, village).filter(
    (building) => building.type === BuildingType.Home,
  );
  const residents: number[] = [];
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (
      state.entities.active[entityId] === 1 &&
      state.entities.kind[entityId] === EntityKind.Human &&
      state.entities.villageIds[entityId] === village.id
    ) {
      residents.push(entityId);
      state.entities.homeBuildingIds[entityId] = 0;
      state.entities.workBuildingIds[entityId] = 0;
    }
  }
  const families = new Map<number, number[]>();
  for (const entityId of residents) {
    const familyId = state.entities.familyIds[entityId] || 0x8000_0000 + entityId;
    const family = families.get(familyId) ?? [];
    family.push(entityId);
    families.set(familyId, family);
  }
  const homeOccupancy = new Map<number, number>();
  for (const family of [...families.values()].sort((left, right) => right.length - left.length)) {
    let cursor = 0;
    while (cursor < family.length) {
      const home = homes.find((candidate) => (homeOccupancy.get(candidate.id) ?? 0) < 8);
      if (!home) break;
      const available = 8 - (homeOccupancy.get(home.id) ?? 0);
      for (const entityId of family.slice(cursor, cursor + available)) {
        state.entities.homeBuildingIds[entityId] = home.id;
      }
      cursor += available;
      homeOccupancy.set(
        home.id,
        8 - available + Math.min(available, family.length - (cursor - available)),
      );
    }
  }

  const workplaces = operationalBuildings(state, village).filter(
    (building) => (WORK_SLOTS[building.type] ?? 0) > 0,
  );
  const needsHunter =
    village.health > 0 &&
    village.population > 0 &&
    village.resources.food <
      Math.max(
        HUNTING_RULES.minimumFoodReserve,
        village.population * HUNTING_RULES.foodShortagePerResident,
      ) &&
    !residents.some((entityId) => state.entities.professions[entityId] === Profession.Hunter);
  if (needsHunter) {
    const hunter = residents.find(
      (entityId) =>
        (state.entities.age[entityId] ?? 0) >= 16 &&
        (state.entities.professions[entityId] === Profession.Hauler ||
          state.entities.professions[entityId] === Profession.Builder ||
          state.entities.professions[entityId] === Profession.Forager),
    );
    if (hunter !== undefined) state.entities.professions[hunter] = Profession.Hunter;
  }
  if (
    workplaces.some((building) => building.type === BuildingType.Workshop) &&
    !residents.some((entityId) => state.entities.professions[entityId] === Profession.Blacksmith)
  ) {
    const apprentice = residents.find(
      (entityId) =>
        (state.entities.age[entityId] ?? 0) >= 16 &&
        (state.entities.professions[entityId] === Profession.Hauler ||
          state.entities.professions[entityId] === Profession.Builder),
    );
    if (apprentice !== undefined) state.entities.professions[apprentice] = Profession.Blacksmith;
  }
  for (const workplace of workplaces) workplace.assignedWorkerIds.length = 0;
  for (const entityId of residents) {
    const type = matchingWorkplace(state.entities.professions[entityId] as Profession);
    if (type === null) continue;
    const workplace = workplaces.find(
      (candidate) =>
        candidate.type === type && candidate.assignedWorkerIds.length < candidate.workSlots,
    );
    if (!workplace) continue;
    workplace.assignedWorkerIds.push(entityId);
    state.entities.workBuildingIds[entityId] = workplace.id;
  }
}

export function advanceVillageGuardTraining(state: WorldState, village: Village): number {
  if (state.tick % 120 !== 0) return 0;
  let trained = 0;
  for (const buildingId of village.buildingIds) {
    const barracks = state.buildings[buildingId - 1];
    if (!barracks?.completed || barracks.health <= 0 || barracks.type !== BuildingType.Barracks) {
      continue;
    }
    for (const entityId of barracks.assignedWorkerIds) {
      if (
        state.entities.active[entityId] !== 1 ||
        state.entities.villageIds[entityId] !== village.id ||
        state.entities.professions[entityId] !== Profession.Guard ||
        Math.hypot(
          (state.entities.positionsX[entityId] ?? 0) - barracks.x,
          (state.entities.positionsZ[entityId] ?? 0) - barracks.z,
        ) > 3
      ) {
        continue;
      }
      state.entities.experience[entityId] = Math.min(
        0xffff_ffff,
        (state.entities.experience[entityId] ?? 0) + 12,
      );
      state.entities.contribution[entityId] = Math.min(
        0xffff_ffff,
        (state.entities.contribution[entityId] ?? 0) + 4,
      );
      state.entities.levels[entityId] = Math.min(
        10,
        1 + Math.floor(Math.sqrt((state.entities.experience[entityId] ?? 0) / 70)),
      );
      const task = state.entities.tasks[entityId];
      if (task?.type === 'guard') {
        task.phase = 'work';
        task.requiredProgress = 120;
        task.progress = (task.progress + 12) % task.requiredProgress;
        task.leaseUntilTick = state.tick + 120;
      }
      trained += 1;
    }
  }
  return trained;
}

export function decayOutdoorStockpiles(state: WorldState, village: Village): Partial<Resources> {
  const losses: Partial<Resources> = {};
  const villageCell = Math.floor(village.z) * state.map.size + Math.max(0, Math.floor(village.x));
  if ((state.map.fire[villageCell] ?? 0) > 80) {
    for (const key of ['food', 'wood'] as const) {
      const before = village.outdoorStockpile[key];
      village.outdoorStockpile[key] = Math.max(0, before - Math.ceil(before * 0.25));
      losses[key] = before - village.outdoorStockpile[key];
    }
  }
  if (state.tick % 720 === 0) {
    const foodExposed = state.tick - village.outdoorSinceTicks.food;
    if (village.outdoorStockpile.food > 0 && foodExposed >= 180) {
      const before = village.outdoorStockpile.food;
      village.outdoorStockpile.food = Math.floor(before * 0.5);
      losses.food = (losses.food ?? 0) + before - village.outdoorStockpile.food;
    }
    const woodExposed = state.tick - village.outdoorSinceTicks.wood;
    if (village.outdoorStockpile.wood > 0 && woodExposed >= 720) {
      const before = village.outdoorStockpile.wood;
      village.outdoorStockpile.wood = Math.floor(before * 0.9);
      losses.wood = (losses.wood ?? 0) + before - village.outdoorStockpile.wood;
    }
  }
  for (const key of RESOURCE_KEYS) {
    if (village.outdoorStockpile[key] <= 0) village.outdoorSinceTicks[key] = 0;
  }
  return losses;
}

export interface ConstructionDecision {
  type: BuildingType;
  decision: string;
  overrideReason: string;
}

export function selectNextBuildingType(
  state: WorldState,
  village: Village,
): ConstructionDecision | null {
  const operational = operationalBuildings(state, village);
  const count = (type: BuildingType) =>
    operational.filter((building) => building.type === type).length;
  const hasNearbyMetal = findResourceNodesInRadius(
    state.resourceNodes,
    village.x,
    village.z,
    48,
  ).some((nodeId) => state.resourceNodes.kind[nodeId] === ResourceNodeKind.Metal);
  const productionType =
    count(BuildingType.LoggingCamp) === 0
      ? BuildingType.LoggingCamp
      : count(BuildingType.Mine) === 0 && hasNearbyMetal
        ? BuildingType.Mine
        : BuildingType.Workshop;
  const nextRequirement = nextVillageTierRequirement(village.tier);
  const developmentType =
    nextRequirement && village.population >= nextRequirement.population
      ? (Object.entries(nextRequirement.buildings).find(
          ([type, required]) => count(Number(type) as BuildingType) < (required ?? 0),
        )?.[0] ?? null)
      : null;
  if (village.resources.food <= Math.max(4, village.population)) {
    return {
      type: BuildingType.Farm,
      decision: '文明优先保障食物',
      overrideReason:
        village.constructionPriority === 'food' || village.constructionPriority === 'automatic'
          ? ''
          : '断粮风险覆盖玩家优先级',
    };
  }
  const automaticDecision: ConstructionDecision | null =
    count(BuildingType.TownCenter) === 0
      ? { type: BuildingType.TownCenter, decision: '建立村庄调度中心', overrideReason: '' }
      : village.housingCapacity < village.population ||
          (village.carryingCapacity > 0 &&
            village.population / village.carryingCapacity >= 0.82 &&
            village.housingCapacity < Math.ceil(village.population / 0.72))
        ? { type: BuildingType.Home, decision: '补足居民住房', overrideReason: '' }
        : count(BuildingType.Farm) <= Math.floor(village.population / 12)
          ? { type: BuildingType.Farm, decision: '扩大食物生产', overrideReason: '' }
          : count(BuildingType.Storage) === 0
            ? { type: BuildingType.Storage, decision: '保护聚落库存', overrideReason: '' }
            : developmentType !== null
              ? {
                  type: Number(developmentType) as BuildingType,
                  decision: '推进聚落发展条件',
                  overrideReason: '',
                }
              : count(BuildingType.LoggingCamp) === 0
                ? {
                    type: BuildingType.LoggingCamp,
                    decision: '建立木材生产端点',
                    overrideReason: '',
                  }
                : count(BuildingType.Workshop) === 0 ||
                    (count(BuildingType.Mine) === 0 && hasNearbyMetal)
                  ? { type: productionType, decision: '建立生产工作端点', overrideReason: '' }
                  : null;
  if (village.constructionPriority === 'automatic') return automaticDecision;
  if (village.constructionPriority === 'defense') {
    const defensiveType = [BuildingType.Barracks, BuildingType.Wall, BuildingType.Watchtower].find(
      (type) => count(type) === 0,
    );
    return defensiveType === undefined
      ? null
      : { type: defensiveType, decision: '玩家优先防御', overrideReason: '' };
  }
  const decisions: Record<
    Exclude<ConstructionPriority, 'automatic' | 'defense'>,
    ConstructionDecision
  > = {
    housing: { type: BuildingType.Home, decision: '玩家优先住房', overrideReason: '' },
    storage: { type: BuildingType.Storage, decision: '玩家优先储粮', overrideReason: '' },
    food: { type: BuildingType.Farm, decision: '玩家优先食物', overrideReason: '' },
    production: {
      type: productionType,
      decision: '玩家优先生产',
      overrideReason: '',
    },
  };
  return decisions[village.constructionPriority];
}
