import {
  AgentState,
  BuildingType,
  CarriedResourceKind,
  type DeathCause,
  DiplomacyState,
  type EntityArrays,
  EntityKind,
  type PioneerExpedition,
  Profession,
  ResidentRole,
  ResidentSex,
  type ResidentTaskReason,
  type ResidentTaskTargetKind,
  type ResidentTaskType,
  ResourceNodeKind,
  ResourceNodeStage,
  TerrainType,
  type Village,
  VillageTier,
  type WorldEvent,
  type WorldPreset,
  type WorldState,
} from '@/shared/gameTypes';
import { createSeededRandom, randomInt, stableNoise } from '@/shared/random';
import { type RecordWorldEventInput, recordWorldEvent } from '../history/worldHistory';
import {
  formKingdoms,
  refreshKingdomCapital,
  resolveKingdomExtinctions,
  setDiplomacy,
} from '../kingdoms/kingdoms';
import { planOrganicBuildingSite, traceVillageRoad } from '../kingdoms/settlementPlanning';
import { generateWorldMap, navigationCostForTerrain } from '../map/generateWorldMap';
import { markMapCellDirty } from '../map/mapDirty';
import { createFlowField, type FlowField, nextFlowCell } from '../navigation/flowField';
import { isWalkable, setCellCost, toCell } from '../navigation/grid';
import { PathQueue } from '../navigation/pathQueue';
import {
  constrainNavigationStep,
  overlapsMatureTreeTrunk,
  pathRemainsTraversable,
  resolveTreeTrunkCollision,
  traversalSpeedMultiplier,
} from '../navigation/traversal';
import { findNearestGridResource, harvestGridResource } from '../resources/resourceGrid';
import {
  collectResourceForCarrier,
  depositCarriedResource,
  villageNeedsResource,
} from '../resources/resourceLogistics';
import {
  advanceResourceRegrowth,
  findNearestAvailableResourceNode,
  findResourceNodesInRadius,
  generateResourceNodes,
  reserveResourceNode,
  resourceNodeAvoidance,
} from '../resources/resourceNodes';
import {
  ANIMAL_LIFECYCLE_RULES,
  ECOLOGY_BALANCE_RULES,
  FISHING_RULES,
  HUNTING_RULES,
} from '../rules/ecologyRules';
import {
  createDefaultWorldLaws,
  WORLD_LAW_CATALOG,
  type WorldLawId,
} from '../rules/worldLawCatalog';
import { WATCHTOWER_DAMAGE, WATCHTOWER_RANGE } from '../settlements/settlementCapabilities';
import {
  advanceVillageGuardTraining,
  assignVillageHomesAndWorkplaces,
  decayOutdoorStockpiles,
  selectNextBuildingType,
} from '../settlements/settlementOperations';
import { findPreferredPlanningSite } from '../settlements/spatialPlanning';
import {
  birthPressure,
  calculateCarryingCapacity,
  chooseNewbornSex,
  createPopulationDiagnostics,
  emptyDeathCauses,
  resolveShortageStage,
} from '../systems/demographics';
import {
  ANIMAL_SPECIES,
  ANIMAL_SPECIES_NAMES,
  createEcologyDiagnostics,
  decayAnimalCarcasses,
  habitatCells,
  recordAnimalBirth,
  recordAnimalDeath,
  refreshEcologyDiagnostics,
  speciesCapacity,
  speciesReturnGroup,
} from '../systems/ecology';
import {
  advanceConstruction,
  applyConstructionWork,
  clampResources,
  clearConstructionSite,
  deliverConstructionResources,
  evaluateVillageTier,
  startConstruction,
} from '../systems/economy';
import { stepEnvironment } from '../systems/environment';
import { selectUtilityState } from '../systems/needs';
import {
  beginResidentTask,
  completeResidentTask,
  failResidentTask,
  renewResidentTaskLease,
  suspendResidentTask,
} from '../tasks/residentTasks';
import {
  advanceTerritoryClaims,
  canVillageUseTerritoryCell,
  createTerritoryState,
  territoryVillageIdAtCell,
} from '../territory/territory';

const MAX_ENTITIES = 1_200;
const NO_TARGET = 0xffff_ffff;
const NO_ENTITY = 0xffff_ffff;
const FIRST_NAMES = [
  '黎安',
  '禾青',
  '弥夏',
  '岚生',
  '朔宁',
  '松原',
  '溪月',
  '白果',
  '云栖',
  '星野',
];
const VILLAGE_NAMES = ['苔溪', '谷灯', '曦丘', '雾松', '白桦', '风禾', '石湾', '月沼'];

export interface CreateWorldOptions {
  seed: string;
  initialHumans?: number;
  mapSize?: number;
  preset?: WorldPreset;
}

export interface WorldSimulation {
  state: WorldState;
  metrics: {
    completedPaths: number;
    pathQueue: number;
  };
  step(): void;
  spawn(kind: EntityKind, x: number, z: number, count?: number): number[];
  ensureVillageAt(x: number, z: number, population: number): Village;
  setWorldLaw(law: WorldLawId, enabled: boolean): void;
}

function createEntityArrays(capacity = MAX_ENTITIES): EntityArrays {
  const targetCells = new Uint32Array(capacity);
  targetCells.fill(NO_TARGET);
  const resourceTargetIds = new Uint32Array(capacity);
  resourceTargetIds.fill(NO_TARGET);
  const homeBuildingIds = new Uint32Array(capacity);
  const workBuildingIds = new Uint32Array(capacity);
  const partnerIds = new Uint32Array(capacity);
  const parentAIds = new Uint32Array(capacity);
  const parentBIds = new Uint32Array(capacity);
  partnerIds.fill(NO_ENTITY);
  parentAIds.fill(NO_ENTITY);
  parentBIds.fill(NO_ENTITY);
  return {
    capacity,
    count: 0,
    lifeIds: new Uint32Array(capacity),
    active: new Uint8Array(capacity),
    kind: new Uint8Array(capacity),
    positionsX: new Float32Array(capacity),
    positionsZ: new Float32Array(capacity),
    headings: new Float32Array(capacity),
    health: new Uint16Array(capacity),
    hunger: new Uint16Array(capacity),
    energy: new Uint16Array(capacity),
    age: new Uint16Array(capacity),
    sex: new Uint8Array(capacity),
    familyIds: new Uint32Array(capacity),
    partnerIds,
    parentAIds,
    parentBIds,
    lastBirthTicks: new Uint32Array(capacity),
    malnutrition: new Uint16Array(capacity),
    expeditionIds: new Uint16Array(capacity),
    states: new Uint8Array(capacity),
    professions: new Uint8Array(capacity),
    villageIds: new Uint16Array(capacity),
    kingdomIds: new Uint16Array(capacity),
    targetCells,
    traits: new Uint8Array(capacity),
    speed: new Float32Array(capacity),
    infected: new Uint8Array(capacity),
    blessed: new Uint16Array(capacity),
    enraged: new Uint16Array(capacity),
    experience: new Uint32Array(capacity),
    contribution: new Uint32Array(capacity),
    levels: new Uint8Array(capacity),
    roles: new Uint8Array(capacity),
    weaponTiers: new Uint8Array(capacity),
    armorTiers: new Uint8Array(capacity),
    carriedResourceKinds: new Uint8Array(capacity),
    carriedResources: new Uint8Array(capacity),
    resourceTargetIds,
    homeBuildingIds,
    workBuildingIds,
    names: [],
    tasks: Array.from({ length: capacity }, () => null),
    suspendedTasks: Array.from({ length: capacity }, () => null),
    paths: Array.from({ length: capacity }, () => null),
  };
}

function collectReferencedEntitySlots(state: WorldState): Uint8Array {
  const referenced = new Uint8Array(state.entities.count);
  for (let candidateId = 0; candidateId < state.entities.count; candidateId += 1) {
    if (!state.entities.active[candidateId]) continue;
    for (const entityId of [
      state.entities.partnerIds[candidateId],
      state.entities.parentAIds[candidateId],
      state.entities.parentBIds[candidateId],
    ]) {
      if (entityId !== undefined && entityId < referenced.length) referenced[entityId] = 1;
    }
  }
  for (const kingdom of state.kingdoms) {
    if (!kingdom.extinct && kingdom.leaderId < referenced.length) {
      referenced[kingdom.leaderId] = 1;
    }
  }
  for (const expedition of state.expeditions) {
    for (const entityId of expedition.memberIds) {
      if (entityId < referenced.length) referenced[entityId] = 1;
    }
  }
  return referenced;
}

function acquireEntitySlot(state: WorldState, referenced: Uint8Array | null): number {
  if (state.entities.count < state.entities.capacity) {
    const entityId = state.entities.count;
    state.entities.count += 1;
    return entityId;
  }
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (!state.entities.active[entityId] && referenced?.[entityId] !== 1) {
      return entityId;
    }
  }
  return -1;
}

function findNearestWalkable(state: WorldState, x: number, z: number): number {
  const size = state.map.size;
  for (let radius = 0; radius < size / 2; radius += 1) {
    for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
        const nextX = Math.max(0, Math.min(size - 1, Math.round(x + offsetX)));
        const nextZ = Math.max(0, Math.min(size - 1, Math.round(z + offsetZ)));
        const cell = toCell(state.map.navigation, nextX, nextZ);
        if (
          isWalkable(state.map.navigation, cell) &&
          !overlapsMatureTreeTrunk(state.resourceNodes, nextX + 0.5, nextZ + 0.5)
        )
          return cell;
      }
    }
  }
  return 0;
}

function syncTreeNavigationCosts(state: WorldState): void {
  const matureTreeCells = new Uint8Array(state.map.terrain.length);
  for (let nodeId = 0; nodeId < state.resourceNodes.count; nodeId += 1) {
    if (
      state.resourceNodes.active[nodeId] !== 1 ||
      state.resourceNodes.kind[nodeId] !== ResourceNodeKind.Tree ||
      state.resourceNodes.stage[nodeId] !== ResourceNodeStage.Mature
    ) {
      continue;
    }
    const x = Math.floor(state.resourceNodes.positionsX[nodeId] ?? 0);
    const z = Math.floor(state.resourceNodes.positionsZ[nodeId] ?? 0);
    if (x < 0 || z < 0 || x >= state.map.size || z >= state.map.size) continue;
    matureTreeCells[z * state.map.size + x] = 1;
  }
  for (let cell = 0; cell < state.map.terrain.length; cell += 1) {
    const baseCost = navigationCostForTerrain(
      state.map.terrain[cell] as TerrainType,
      (state.map.roads[cell] ?? 0) > 0,
    );
    const cost = baseCost > 0 && matureTreeCells[cell] ? Math.max(12, baseCost) : baseCost;
    if (state.map.navigation.cost[cell] === cost) continue;
    setCellCost(
      state.map.navigation,
      cell % state.map.size,
      Math.floor(cell / state.map.size),
      cost,
    );
  }
}

function findNearestTerrain(state: WorldState, x: number, z: number, terrain: TerrainType): number {
  const size = state.map.size;
  for (let radius = 0; radius < size; radius += 1) {
    for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
        const nextX = Math.max(0, Math.min(size - 1, Math.round(x + offsetX)));
        const nextZ = Math.max(0, Math.min(size - 1, Math.round(z + offsetZ)));
        const cell = nextZ * size + nextX;
        if (state.map.terrain[cell] === terrain) return cell;
      }
    }
  }
  return 0;
}

function addEvent(
  state: WorldState,
  kind: WorldEvent['kind'],
  message: string,
  details: Partial<Omit<RecordWorldEventInput, 'kind' | 'message'>> = {},
): void {
  const category =
    kind === 'kingdom' ||
    kind === 'kingdom-founded' ||
    kind === 'kingdom-extinct' ||
    kind === 'war' ||
    kind === 'peace'
      ? 'kingdom'
      : kind === 'birth' ||
          kind === 'death' ||
          kind === 'promotion' ||
          kind === 'family' ||
          kind === 'migration' ||
          kind === 'equipment' ||
          kind === 'population-peak'
        ? 'population'
        : kind === 'ecology' || kind === 'extinction'
          ? 'ecology'
          : kind === 'disaster' || kind === 'famine'
            ? 'disaster'
            : kind.startsWith('village') || kind === 'construction' || kind === 'conquest'
              ? 'village'
              : 'world';
  const significant = ![
    'birth',
    'death',
    'promotion',
    'equipment',
    'construction',
    'village',
  ].includes(kind);
  recordWorldEvent(state, {
    kind,
    category,
    message,
    archive: significant,
    notification: significant,
    ...details,
  });
}

function grantResidentProgress(state: WorldState, entityId: number, amount: number): void {
  if (
    !state.entities.active[entityId] ||
    state.entities.kind[entityId] !== EntityKind.Human ||
    amount <= 0
  ) {
    return;
  }
  state.entities.experience[entityId] = Math.min(
    0xffff_ffff,
    (state.entities.experience[entityId] ?? 0) + amount,
  );
  state.entities.contribution[entityId] = Math.min(
    0xffff_ffff,
    (state.entities.contribution[entityId] ?? 0) + Math.max(1, Math.floor(amount / 2)),
  );
  state.entities.levels[entityId] = Math.min(
    10,
    1 + Math.floor(Math.sqrt((state.entities.experience[entityId] ?? 0) / 70)),
  );
}

function assignResidentRoles(state: WorldState): void {
  const previousRoles = state.entities.roles.slice(0, state.entities.count);
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (!state.entities.active[entityId] || state.entities.kind[entityId] !== EntityKind.Human)
      continue;
    const level = state.entities.levels[entityId] ?? 1;
    state.entities.roles[entityId] =
      level >= 7
        ? state.entities.professions[entityId] === Profession.Guard
          ? ResidentRole.Veteran
          : ResidentRole.Master
        : ResidentRole.Citizen;
  }

  const bestResident = (ids: number[]) =>
    ids.reduce((best, entityId) => {
      const score =
        (state.entities.contribution[entityId] ?? 0) +
        (state.entities.levels[entityId] ?? 1) * 120 -
        (state.entities.age[entityId] ?? 0);
      const bestScore =
        best < 0
          ? -1
          : (state.entities.contribution[best] ?? 0) +
            (state.entities.levels[best] ?? 1) * 120 -
            (state.entities.age[best] ?? 0);
      return score > bestScore ? entityId : best;
    }, -1);

  for (const village of state.villages) {
    const residents: number[] = [];
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        state.entities.active[entityId] &&
        state.entities.kind[entityId] === EntityKind.Human &&
        state.entities.villageIds[entityId] === village.id
      ) {
        residents.push(entityId);
      }
    }
    const leader = bestResident(residents);
    if (leader >= 0) state.entities.roles[leader] = ResidentRole.Leader;
  }

  for (const kingdom of state.kingdoms) {
    if (kingdom.extinct) continue;
    const members: number[] = [];
    const guards: number[] = [];
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!state.entities.active[entityId] || state.entities.kingdomIds[entityId] !== kingdom.id)
        continue;
      members.push(entityId);
      if (state.entities.professions[entityId] === Profession.Guard) guards.push(entityId);
    }
    const king = members.includes(kingdom.leaderId) ? kingdom.leaderId : bestResident(members);
    if (king >= 0) {
      kingdom.leaderId = king;
      state.entities.roles[king] = ResidentRole.King;
    }
    const captain = bestResident(guards.filter((entityId) => entityId !== king));
    if (captain >= 0) state.entities.roles[captain] = ResidentRole.Captain;
  }

  const roleLabels = ['居民', '老兵', '大师', '队长', '领主', '国王'];
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    const previousRole = previousRoles[entityId] ?? ResidentRole.Citizen;
    const nextRole = state.entities.roles[entityId] ?? ResidentRole.Citizen;
    if (!state.entities.active[entityId] || nextRole <= previousRole) continue;
    const villageId = state.entities.villageIds[entityId] ?? 0;
    const kingdomId = state.entities.kingdomIds[entityId] ?? 0;
    addEvent(
      state,
      'promotion',
      `${state.entities.names[entityId] || '一名居民'}成为${roleLabels[nextRole] || '重要人物'}`,
      {
        category: 'population',
        archive: false,
        notification: false,
        entityIds: [entityId],
        villageIds: villageId > 0 ? [villageId] : [],
        kingdomIds: kingdomId > 0 ? [kingdomId] : [],
      },
    );
  }
}

function makeVillage(
  state: WorldState,
  x: number,
  z: number,
  population: number,
  founderIds: number[] = [],
): Village {
  const id = state.villages.length + 1;
  const village: Village = {
    id,
    name: VILLAGE_NAMES[(id - 1) % VILLAGE_NAMES.length] ?? `聚落 ${id}`,
    x,
    z,
    population,
    tier: VillageTier.Camp,
    health: 1_000,
    resources: {
      food: Math.max(48, population * 6),
      wood: 22,
      stone: 8,
      metal: 0,
      gold: 4,
      tools: 2,
      equipment: 0,
    },
    storageCapacity: 180,
    storageCapacityByKind: {
      food: 40,
      wood: 40,
      stone: 40,
      metal: 40,
      gold: 40,
      tools: 40,
      equipment: 40,
    },
    outdoorStockpile: { food: 0, wood: 0, stone: 0, metal: 0, gold: 0, tools: 0, equipment: 0 },
    outdoorSinceTicks: { food: 0, wood: 0, stone: 0, metal: 0, gold: 0, tools: 0, equipment: 0 },
    housingCapacity: 5,
    campHousingCapacity: 5,
    operationsInitialized: false,
    kingdomId: 0,
    buildingIds: [],
    foundedAtTick: state.tick,
    carryingCapacity: population + 5,
    foodProduction: 0,
    foodProducedSinceUpdate: 0,
    foodConsumption: 0,
    foodTrend: 0,
    shortageTicks: 0,
    peakPopulation: population,
    lastRecordedPopulationPeak: population,
    lastShortageStage: 'stable',
    abandonedAtTick: 0,
    lastBirthTick: state.tick,
    pioneerReadyAtTick: state.tick + 1_440,
    constructionPriority: 'automatic',
    constructionDecision: '根据聚落当前需求自动建设',
    constructionOverrideReason: '',
    captureKingdomId: 0,
    captureProgress: 0,
  };
  state.villages.push(village);
  addEvent(state, 'village-founded', `${village.name}建立了营地`, {
    category: 'village',
    archive: true,
    notification: true,
    entityIds: founderIds,
    villageIds: [village.id],
    locationCell: Math.floor(z) * state.map.size + Math.floor(x),
  });
  return village;
}

function createInitialState(options: CreateWorldOptions): WorldState {
  const map = generateWorldMap(
    options.seed,
    options.mapSize ?? 256,
    options.preset ?? 'archipelago',
  );
  const state: WorldState = {
    version: 12,
    seed: options.seed,
    tick: 0,
    year: 1,
    map,
    resourceNodes: generateResourceNodes(map, options.seed),
    territory: createTerritoryState(map.size),
    entities: createEntityArrays(),
    villages: [],
    kingdoms: [],
    buildings: [],
    settings: { speed: 1, quality: 'high', overlay: 'none' },
    events: [],
    favoriteLifeIds: [],
    nextRequestId: 0,
    nextTaskId: 0,
    nextEventId: 0,
    nextLifeId: 0,
    forcedPeaceUntil: 0,
    population: createPopulationDiagnostics(),
    worldLaws: createDefaultWorldLaws(),
    ecology: createEcologyDiagnostics(),
    carcasses: [],
    nextCarcassId: 0,
    humanExtinctSinceTick: 0,
    wars: [],
    truces: [],
    expeditions: [],
    nextFamilyId: 0,
    nextExpeditionId: 0,
  };
  syncTreeNavigationCosts(state);
  return state;
}

const FOUNDER_AGE_CYCLE = [
  3, 7, 11, 14, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 39, 42, 46, 50, 55, 60, 64,
] as const;

function initializeFounderCohort(state: WorldState, population: number): void {
  for (let entityId = 0; entityId < population; entityId += 1) {
    state.entities.sex[entityId] = entityId % 2 === 0 ? ResidentSex.Female : ResidentSex.Male;
    state.entities.age[entityId] = FOUNDER_AGE_CYCLE[entityId % FOUNDER_AGE_CYCLE.length] ?? 24;
  }
}

function isLivingHuman(state: WorldState, entityId: number): boolean {
  return Boolean(
    state.entities.active[entityId] && state.entities.kind[entityId] === EntityKind.Human,
  );
}

function villageHasOperationalMine(state: WorldState, village: Village): boolean {
  return village.buildingIds.some((buildingId) => {
    const building = state.buildings[buildingId - 1];
    return building?.completed && building.type === BuildingType.Mine && building.health > 0;
  });
}

function villageHasOperationalFarm(state: WorldState, village: Village): boolean {
  return village.buildingIds.some((buildingId) => {
    const building = state.buildings[buildingId - 1];
    return building?.completed && building.type === BuildingType.Farm && building.health > 0;
  });
}

function resourceNodeTerritoryOwner(state: WorldState, nodeId: number): number {
  const x = Math.floor(state.resourceNodes.positionsX[nodeId] ?? -1);
  const z = Math.floor(state.resourceNodes.positionsZ[nodeId] ?? -1);
  return territoryVillageIdAtCell(state, z * state.map.size + x);
}

function findNearestVillageResourceNode(
  state: WorldState,
  villageId: number,
  x: number,
  z: number,
  kind: ResourceNodeKind,
  maxRadius: number,
): number {
  const findByOwner = (ownerVillageId: number) =>
    findNearestAvailableResourceNode(
      state.resourceNodes,
      x,
      z,
      kind,
      state.tick,
      maxRadius,
      (nodeId) => resourceNodeTerritoryOwner(state, nodeId) === ownerVillageId,
    );
  const owned = villageId > 0 ? findByOwner(villageId) : -1;
  return owned >= 0 ? owned : findByOwner(0);
}

function findNearestVillageGridResource(
  state: WorldState,
  villageId: number,
  origin: number,
  maxRadius: number,
): number {
  const findByOwner = (ownerVillageId: number) =>
    findNearestGridResource(
      state.map,
      origin,
      'food',
      maxRadius,
      false,
      (cell) => territoryVillageIdAtCell(state, cell) === ownerVillageId,
    );
  const owned = villageId > 0 ? findByOwner(villageId) : -1;
  return owned >= 0 ? owned : findByOwner(0);
}

function recordResidentDeath(state: WorldState, entityId: number, cause: DeathCause): void {
  if (!isLivingHuman(state, entityId)) return;
  const task = state.entities.tasks[entityId];
  if (task && task.phase !== 'complete' && task.phase !== 'failed') {
    failResidentTask(task, state.tick, '居民已死亡');
    if (task.targetKind === 'resource-node') {
      state.resourceNodes.reservedBy[task.targetId] = 0;
      state.resourceNodes.reservedUntil[task.targetId] = 0;
    }
  }
  const suspendedTask = state.entities.suspendedTasks[entityId];
  if (suspendedTask && suspendedTask.phase !== 'complete' && suspendedTask.phase !== 'failed') {
    failResidentTask(suspendedTask, state.tick, '居民已死亡');
    if (suspendedTask.targetKind === 'resource-node') {
      state.resourceNodes.reservedBy[suspendedTask.targetId] = 0;
      state.resourceNodes.reservedUntil[suspendedTask.targetId] = 0;
    }
  }
  if (
    state.entities.states[entityId] === AgentState.Haul &&
    (state.entities.carriedResources[entityId] ?? 0) > 0
  ) {
    const building = state.buildings.find(
      (candidate) =>
        candidate.villageId === state.entities.villageIds[entityId] &&
        candidate.constructionPhase === 'delivery',
    );
    const amount = state.entities.carriedResources[entityId] ?? 0;
    if (building && state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.Wood) {
      building.inTransitWood = Math.max(0, building.inTransitWood - amount);
    }
    if (building && state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.Stone) {
      building.inTransitStone = Math.max(0, building.inTransitStone - amount);
    }
    state.entities.carriedResources[entityId] = 0;
    state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.None;
  }
  state.entities.active[entityId] = 0;
  state.population.totalDeaths += 1;
  state.population.deathsThisYear += 1;
  state.population.deathCauses[cause] += 1;
  state.population.deathCausesThisYear[cause] += 1;
  const partnerId = state.entities.partnerIds[entityId] ?? NO_ENTITY;
  if (partnerId !== NO_ENTITY && state.entities.partnerIds[partnerId] === entityId) {
    state.entities.partnerIds[partnerId] = NO_ENTITY;
  }
  const labels: Record<DeathCause, string> = {
    age: '走完了一生',
    hunger: '死于长期饥荒',
    disease: '死于疾病',
    violence: '死于袭击',
    disaster: '死于灾害',
  };
  const villageId = state.entities.villageIds[entityId] ?? 0;
  const kingdomId = state.entities.kingdomIds[entityId] ?? 0;
  addEvent(state, 'death', `${state.entities.names[entityId] || '一名居民'}${labels[cause]}`, {
    category: cause === 'disaster' ? 'disaster' : 'population',
    archive: false,
    notification: false,
    entityIds: [entityId],
    villageIds: villageId > 0 ? [villageId] : [],
    kingdomIds: kingdomId > 0 ? [kingdomId] : [],
    locationCell: entityCell(state, entityId),
  });
}

function refreshPopulationDiagnostics(state: WorldState): void {
  let children = 0;
  let adults = 0;
  let elders = 0;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (!isLivingHuman(state, entityId)) continue;
    const age = state.entities.age[entityId] ?? 0;
    if (age < 16) children += 1;
    else if (age < 60) adults += 1;
    else elders += 1;
  }
  state.population.children = children;
  state.population.adults = adults;
  state.population.elders = elders;
  state.population.carryingCapacity = state.villages.reduce(
    (sum, village) =>
      sum + (village.health > 0 && village.population > 0 ? village.carryingCapacity : 0),
    0,
  );
  state.population.housingCapacity = state.villages.reduce(
    (sum, village) =>
      sum + (village.health > 0 && village.population > 0 ? village.housingCapacity : 0),
    0,
  );
  state.population.storedFood = state.villages.reduce(
    (sum, village) =>
      sum + (village.health > 0 && village.population > 0 ? village.resources.food : 0),
    0,
  );
  state.population.trend = state.population.birthsLastYear - state.population.deathsLastYear;
}

function closePopulationYear(state: WorldState): void {
  refreshPopulationDiagnostics(state);
  const population = state.population.children + state.population.adults + state.population.elders;
  state.population.history.push({
    year: state.year,
    population,
    births: state.population.birthsThisYear,
    deaths: state.population.deathsThisYear,
    migrations: state.population.migrationsThisYear,
    carryingCapacity: state.population.carryingCapacity,
  });
  if (state.population.history.length > 48) {
    state.population.history.splice(0, state.population.history.length - 48);
  }
  state.population.birthsLastYear = state.population.birthsThisYear;
  state.population.deathsLastYear = state.population.deathsThisYear;
  state.population.migrationsLastYear = state.population.migrationsThisYear;
  state.population.birthsThisYear = 0;
  state.population.deathsThisYear = 0;
  state.population.migrationsThisYear = 0;
  state.population.deathCausesThisYear = emptyDeathCauses();
  state.population.trend = state.population.birthsLastYear - state.population.deathsLastYear;
}

export function createWorldSimulation(options: CreateWorldOptions): WorldSimulation {
  const state = createInitialState(options);
  const simulation = createWorldSimulationFromState(state);
  const population = state.map.preset === 'ocean' ? 0 : (options.initialHumans ?? 72);
  const size = state.map.size;
  const anchors = [
    [size * 0.3, size * 0.5],
    [size * 0.7, size * 0.47],
    [size * 0.52, size * 0.7],
  ] as const;
  for (let id = 0; id < population; id += 1) {
    const anchor = anchors[id % anchors.length] as readonly [number, number];
    simulation.spawn(EntityKind.Human, anchor[0], anchor[1]);
  }
  initializeFounderCohort(state, population);
  const wildlife: Array<readonly [EntityKind, number, number, number]> = [
    [EntityKind.Chicken, size * 0.38, size * 0.42, 10],
    [EntityKind.Sheep, size * 0.58, size * 0.38, 8],
    [EntityKind.Cow, size * 0.46, size * 0.6, 6],
    [EntityKind.Deer, size * 0.64, size * 0.62, 10],
    [EntityKind.Wolf, size * 0.28, size * 0.32, 5],
    [EntityKind.Bear, size * 0.72, size * 0.7, 3],
    [EntityKind.Fish, size * 0.5, size * 0.5, 18],
  ];
  if (state.map.preset !== 'ocean') {
    for (const [kind, x, z, count] of wildlife) simulation.spawn(kind, x, z, count);
  }
  refreshEcologyDiagnostics(state);
  return simulation;
}

export function createWorldSimulationFromState(state: WorldState): WorldSimulation {
  syncTreeNavigationCosts(state);
  const random = createSeededRandom(`${state.seed}:simulation`);
  const pathQueue = new PathQueue();
  const metrics = { completedPaths: 0, pathQueue: 0 };
  const flowFields = new Map<number, { version: number; target: number; field: FlowField }>();

  const spawn = (kind: EntityKind, x: number, z: number, count = 1): number[] => {
    const spawned: number[] = [];
    const referenced =
      state.entities.count >= state.entities.capacity ? collectReferencedEntitySlots(state) : null;
    for (let index = 0; index < count; index += 1) {
      const entityId = acquireEntitySlot(state, referenced);
      if (entityId < 0) break;
      state.nextLifeId += 1;
      state.entities.lifeIds[entityId] = state.nextLifeId;
      const spawnRandom =
        kind === EntityKind.Fish
          ? createSeededRandom(`${state.seed}:fish:${state.nextLifeId}`)
          : random;
      const spawnX = x + (spawnRandom() - 0.5) * 5;
      const spawnZ = z + (spawnRandom() - 0.5) * 5;
      const cell =
        kind === EntityKind.Fish
          ? findNearestTerrain(state, spawnX, spawnZ, TerrainType.Ocean)
          : findNearestWalkable(state, spawnX, spawnZ);
      state.entities.active[entityId] = 1;
      state.entities.kind[entityId] = kind;
      state.entities.positionsX[entityId] =
        (cell % state.map.size) + 0.5 + (spawnRandom() - 0.5) * 0.4;
      state.entities.positionsZ[entityId] =
        Math.floor(cell / state.map.size) + 0.5 + (spawnRandom() - 0.5) * 0.4;
      if (
        kind !== EntityKind.Fish &&
        overlapsMatureTreeTrunk(
          state.resourceNodes,
          state.entities.positionsX[entityId] ?? 0,
          state.entities.positionsZ[entityId] ?? 0,
        )
      ) {
        for (let attempt = 0; attempt < 16; attempt += 1) {
          const angle = (attempt / 16) * Math.PI * 2;
          const candidateX = (state.entities.positionsX[entityId] ?? 0) + Math.cos(angle) * 0.34;
          const candidateZ = (state.entities.positionsZ[entityId] ?? 0) + Math.sin(angle) * 0.34;
          const candidateCell = Math.floor(candidateZ) * state.map.size + Math.floor(candidateX);
          if (
            isWalkable(state.map.navigation, candidateCell) &&
            !overlapsMatureTreeTrunk(state.resourceNodes, candidateX, candidateZ)
          ) {
            state.entities.positionsX[entityId] = candidateX;
            state.entities.positionsZ[entityId] = candidateZ;
            break;
          }
        }
      }
      state.entities.health[entityId] = 1_000;
      state.entities.headings[entityId] = 0;
      state.entities.hunger[entityId] = randomInt(spawnRandom, 80, 420);
      state.entities.energy[entityId] = randomInt(spawnRandom, 600, 1_000);
      const lifecycle = ANIMAL_LIFECYCLE_RULES[kind as keyof typeof ANIMAL_LIFECYCLE_RULES];
      state.entities.age[entityId] =
        kind === EntityKind.Human
          ? randomInt(spawnRandom, 18, 40)
          : randomInt(spawnRandom, 1, Math.max(1, Math.min(12, lifecycle.lifespanYears - 2)));
      state.entities.sex[entityId] = entityId % 2;
      state.entities.familyIds[entityId] = 0;
      state.entities.partnerIds[entityId] = NO_ENTITY;
      state.entities.parentAIds[entityId] = NO_ENTITY;
      state.entities.parentBIds[entityId] = NO_ENTITY;
      state.entities.lastBirthTicks[entityId] = 0;
      state.entities.malnutrition[entityId] = 0;
      state.entities.expeditionIds[entityId] = 0;
      state.entities.resourceTargetIds[entityId] = NO_TARGET;
      state.entities.homeBuildingIds[entityId] = 0;
      state.entities.workBuildingIds[entityId] = 0;
      state.entities.carriedResources[entityId] = 0;
      state.entities.carriedResourceKinds[entityId] = 0;
      state.entities.states[entityId] = AgentState.Wander;
      state.entities.professions[entityId] = entityId % 7;
      state.entities.villageIds[entityId] = 0;
      state.entities.kingdomIds[entityId] = 0;
      state.entities.targetCells[entityId] = NO_TARGET;
      state.entities.levels[entityId] = 1;
      state.entities.roles[entityId] = ResidentRole.Citizen;
      state.entities.infected[entityId] = 0;
      state.entities.blessed[entityId] = 0;
      state.entities.enraged[entityId] = 0;
      state.entities.experience[entityId] = 0;
      state.entities.contribution[entityId] = 0;
      state.entities.weaponTiers[entityId] = 0;
      state.entities.armorTiers[entityId] = 0;
      state.entities.traits[entityId] = randomInt(spawnRandom, 0, 7);
      state.entities.speed[entityId] =
        kind === EntityKind.Human ? 1.25 + (entityId % 9) * 0.025 : 1.45;
      state.entities.names[entityId] =
        kind === EntityKind.Human
          ? `${FIRST_NAMES[entityId % FIRST_NAMES.length]}·${Math.floor(entityId / FIRST_NAMES.length) + 1}`
          : `${EntityKind[kind]} ${entityId + 1}`;
      state.entities.paths[entityId] = null;
      state.entities.tasks[entityId] = null;
      state.entities.suspendedTasks[entityId] = null;
      if (kind !== EntityKind.Human) {
        const diagnostics = state.ecology.species[kind];
        if (diagnostics) diagnostics.everPresent = true;
      }
      spawned.push(entityId);
    }
    return spawned;
  };

  const ensureVillageAt = (x: number, z: number, population: number): Village =>
    makeVillage(state, x, z, population);

  const requestPath = (entityId: number, destinationCell: number, priority: number): void => {
    const startCell = entityCell(state, entityId);
    if (!isWalkable(state.map.navigation, destinationCell)) return;
    if (startCell === destinationCell) {
      if (state.entities.kind[entityId] === EntityKind.Human) {
        completeEntityAction(state, entityId, destinationCell);
      }
      return;
    }
    state.nextRequestId += 1;
    state.entities.targetCells[entityId] = destinationCell;
    pathQueue.enqueue({
      requestId: state.nextRequestId,
      agentId: entityId,
      startCell,
      destinationCell,
      priority,
      mapVersion: state.map.navigation.mapVersion,
      requestedAtTick: state.tick,
    });
  };

  const villageNeedsWildFood = (village: Village): boolean =>
    village.resources.food <
    Math.max(
      HUNTING_RULES.minimumFoodReserve,
      village.population * HUNTING_RULES.foodShortagePerResident,
    );

  const findAvailableCarcass = (entityId: number): WorldState['carcasses'][number] | null => {
    let nearest: WorldState['carcasses'][number] | null = null;
    let nearestDistance: number = HUNTING_RULES.huntRange;
    const x = state.entities.positionsX[entityId] ?? 0;
    const z = state.entities.positionsZ[entityId] ?? 0;
    for (const carcass of state.carcasses) {
      if (
        carcass.meatRemaining <= 0 ||
        carcass.decayAtTick <= state.tick ||
        (carcass.reservedByEntityId !== null &&
          carcass.reservedByEntityId !== entityId &&
          carcass.reservedUntilTick >= state.tick)
      ) {
        continue;
      }
      const distance = Math.hypot(carcass.x - x, carcass.z - z);
      if (distance >= nearestDistance) continue;
      nearest = carcass;
      nearestDistance = distance;
    }
    return nearest;
  };

  const findHuntPrey = (hunterId: number): number => {
    let nearest = -1;
    let nearestDistance: number = HUNTING_RULES.huntRange;
    const hunterX = state.entities.positionsX[hunterId] ?? 0;
    const hunterZ = state.entities.positionsZ[hunterId] ?? 0;
    const reservedPreyIds = new Set<number>();
    for (let otherId = 0; otherId < state.entities.count; otherId += 1) {
      if (otherId === hunterId || state.entities.active[otherId] !== 1) continue;
      const task = state.entities.tasks[otherId];
      if (
        task?.type === 'hunt' &&
        task.targetKind === 'entity' &&
        task.phase !== 'complete' &&
        task.phase !== 'failed'
      ) {
        reservedPreyIds.add(task.targetId);
      }
    }
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!state.entities.active[entityId]) continue;
      const kind = state.entities.kind[entityId] as EntityKind;
      if (
        kind !== EntityKind.Chicken &&
        kind !== EntityKind.Sheep &&
        kind !== EntityKind.Cow &&
        kind !== EntityKind.Deer
      ) {
        continue;
      }
      if ((state.entities.age[entityId] ?? 0) < HUNTING_RULES.minimumPreyAge) continue;
      if (reservedPreyIds.has(entityId)) continue;
      const distance = Math.hypot(
        (state.entities.positionsX[entityId] ?? 0) - hunterX,
        (state.entities.positionsZ[entityId] ?? 0) - hunterZ,
      );
      if (distance >= nearestDistance) continue;
      nearest = entityId;
      nearestDistance = distance;
    }
    return nearest;
  };

  const findShoreCellForFish = (fishId: number): number => {
    const fishX = Math.floor(state.entities.positionsX[fishId] ?? 0);
    const fishZ = Math.floor(state.entities.positionsZ[fishId] ?? 0);
    for (let radius = 1; radius <= FISHING_RULES.shoreRange; radius += 1) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
          const x = fishX + offsetX;
          const z = fishZ + offsetZ;
          if (x < 0 || z < 0 || x >= state.map.size || z >= state.map.size) continue;
          const cell = z * state.map.size + x;
          if (
            isWalkable(state.map.navigation, cell) &&
            !overlapsMatureTreeTrunk(state.resourceNodes, x + 0.5, z + 0.5)
          ) {
            return cell;
          }
        }
      }
    }
    return -1;
  };

  const findFishingTarget = (fisherId: number): { fishId: number; shoreCell: number } | null => {
    let target: { fishId: number; shoreCell: number } | null = null;
    let nearestDistance: number = HUNTING_RULES.huntRange;
    const fisherX = state.entities.positionsX[fisherId] ?? 0;
    const fisherZ = state.entities.positionsZ[fisherId] ?? 0;
    const reservedFishIds = new Set<number>();
    for (let otherId = 0; otherId < state.entities.count; otherId += 1) {
      if (otherId === fisherId || state.entities.active[otherId] !== 1) continue;
      const task = state.entities.tasks[otherId];
      if (
        task?.type === 'fish' &&
        task.targetKind === 'entity' &&
        task.phase !== 'complete' &&
        task.phase !== 'failed'
      ) {
        reservedFishIds.add(task.targetId);
      }
    }
    for (let fishId = 0; fishId < state.entities.count; fishId += 1) {
      if (state.entities.active[fishId] !== 1 || state.entities.kind[fishId] !== EntityKind.Fish) {
        continue;
      }
      if (reservedFishIds.has(fishId)) continue;
      const shoreCell = findShoreCellForFish(fishId);
      if (shoreCell < 0) continue;
      const distance = Math.hypot(
        (shoreCell % state.map.size) + 0.5 - fisherX,
        Math.floor(shoreCell / state.map.size) + 0.5 - fisherZ,
      );
      if (distance >= nearestDistance) continue;
      target = { fishId, shoreCell };
      nearestDistance = distance;
    }
    return target;
  };

  const chooseTarget = (entityId: number): void => {
    const current = entityCell(state, entityId);
    const currentX = current % state.map.size;
    const currentZ = Math.floor(current / state.map.size);
    const stateValue = state.entities.states[entityId] as AgentState;
    let target = -1;
    if (stateValue === AgentState.FindFood) {
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      const storage = state.buildings.find(
        (candidate) =>
          candidate.villageId === village?.id &&
          candidate.type === BuildingType.Storage &&
          candidate.completed &&
          candidate.health > 0,
      );
      if (village)
        target = findNearestWalkable(state, storage?.x ?? village.x, storage?.z ?? village.z);
      else target = findNearestGridResource(state.map, current, 'food');
    } else if (stateValue === AgentState.GatherWood || stateValue === AgentState.GatherStone) {
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      const preferredKind =
        stateValue === AgentState.GatherWood
          ? ResourceNodeKind.Tree
          : village && villageNeedsResource(village, ResourceNodeKind.Stone)
            ? ResourceNodeKind.Stone
            : village && villageHasOperationalMine(state, village)
              ? ResourceNodeKind.Metal
              : ResourceNodeKind.Stone;
      const nodeId = findNearestVillageResourceNode(
        state,
        village?.id ?? 0,
        state.entities.positionsX[entityId] ?? currentX,
        state.entities.positionsZ[entityId] ?? currentZ,
        preferredKind,
        48,
      );
      if (
        nodeId >= 0 &&
        reserveResourceNode(state.resourceNodes, nodeId, entityId, state.tick, 60)
      ) {
        state.entities.resourceTargetIds[entityId] = nodeId;
        target = findNearestWalkable(
          state,
          state.resourceNodes.positionsX[nodeId] ?? currentX,
          state.resourceNodes.positionsZ[nodeId] ?? currentZ,
        );
      }
    } else if (stateValue === AgentState.Eat || stateValue === AgentState.Rest) {
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      const homeId = state.entities.homeBuildingIds[entityId] ?? 0;
      const home = homeId > 0 ? state.buildings[homeId - 1] : undefined;
      if (village) {
        target = findNearestWalkable(
          state,
          home?.completed && home.health > 0 ? home.x : village.x,
          home?.completed && home.health > 0 ? home.z : village.z,
        );
      }
    } else if (stateValue === AgentState.Home) {
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      if (village) {
        const storage = state.buildings.find(
          (candidate) =>
            candidate.villageId === village.id &&
            candidate.type === BuildingType.Storage &&
            candidate.completed,
        );
        target = findNearestWalkable(state, storage?.x ?? village.x, storage?.z ?? village.z);
      }
    } else if (stateValue === AgentState.Haul) {
      const villageId = state.entities.villageIds[entityId] ?? 0;
      const village = state.villages.find((candidate) => candidate.id === villageId);
      const building = state.buildings.find(
        (candidate) =>
          candidate.villageId === villageId && candidate.constructionPhase === 'delivery',
      );
      if (building) {
        if ((state.entities.carriedResources[entityId] ?? 0) === 0) {
          const storage = state.buildings.find(
            (candidate) =>
              candidate.villageId === villageId &&
              candidate.type === BuildingType.Storage &&
              candidate.completed &&
              candidate.health > 0,
          );
          target = findNearestWalkable(
            state,
            storage?.x ?? village?.x ?? currentX,
            storage?.z ?? village?.z ?? currentZ,
          );
        } else {
          target = findNearestWalkable(state, building.x, building.z);
        }
      }
    } else if (stateValue === AgentState.Build) {
      const villageId = state.entities.villageIds[entityId] ?? 0;
      const building = state.buildings.find(
        (candidate) => candidate.villageId === villageId && !candidate.completed,
      );
      if (building)
        target = toCell(state.map.navigation, Math.floor(building.x), Math.floor(building.z));
    } else if (stateValue === AgentState.Farm) {
      const villageId = state.entities.villageIds[entityId] ?? 0;
      if (state.entities.professions[entityId] === Profession.Forager) {
        target = findNearestVillageGridResource(state, villageId, current, 48);
      }
      const farm = state.buildings.find(
        (candidate) =>
          candidate.villageId === villageId &&
          candidate.type === BuildingType.Farm &&
          candidate.completed,
      );
      if (farm && target < 0) {
        const farmX = Math.floor(farm.x);
        const farmZ = Math.floor(farm.z);
        const cells: number[] = [];
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const cell = toCell(state.map.navigation, farmX + offsetX, farmZ + offsetZ);
            if (isWalkable(state.map.navigation, cell)) cells.push(cell);
          }
        }
        target =
          cells.find((cell) => (state.map.crops[cell] ?? 0) >= 180) ??
          cells.find((cell) => (state.map.crops[cell] ?? 0) === 0) ??
          toCell(state.map.navigation, farmX, farmZ);
      }
    } else if (stateValue === AgentState.Craft) {
      const workplaceId = state.entities.workBuildingIds[entityId] ?? 0;
      const workshop = workplaceId > 0 ? state.buildings[workplaceId - 1] : undefined;
      if (workshop?.completed && workshop.health > 0) {
        const village = state.villages.find(
          (candidate) => candidate.id === state.entities.villageIds[entityId],
        );
        const storage = state.buildings.find(
          (candidate) =>
            candidate.villageId === village?.id &&
            candidate.type === BuildingType.Storage &&
            candidate.completed &&
            candidate.health > 0,
        );
        const carryingInputs =
          state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.CraftInputs;
        target = findNearestWalkable(
          state,
          carryingInputs || state.entities.tasks[entityId]?.phase === 'work'
            ? workshop.x
            : (storage?.x ?? village?.x ?? workshop.x),
          carryingInputs || state.entities.tasks[entityId]?.phase === 'work'
            ? workshop.z
            : (storage?.z ?? village?.z ?? workshop.z),
        );
      }
    } else if (stateValue === AgentState.Guard) {
      const workplaceId = state.entities.workBuildingIds[entityId] ?? 0;
      const barracks = workplaceId > 0 ? state.buildings[workplaceId - 1] : undefined;
      if (barracks?.completed && barracks.health > 0 && barracks.type === BuildingType.Barracks) {
        target = findNearestWalkable(state, barracks.x, barracks.z);
      }
    } else if (stateValue === AgentState.Hunt) {
      const task = state.entities.tasks[entityId];
      const currentPrey =
        task?.type === 'hunt' &&
        task.targetKind === 'entity' &&
        state.entities.active[task.targetId] === 1
          ? task.targetId
          : -1;
      const preyId = currentPrey >= 0 ? currentPrey : findHuntPrey(entityId);
      if (preyId < 0) {
        if (task) failResidentTask(task, state.tick, '附近没有可达的成年猎物');
        state.entities.states[entityId] = AgentState.Idle;
        return;
      }
      target = findNearestWalkable(
        state,
        state.entities.positionsX[preyId] ?? currentX,
        state.entities.positionsZ[preyId] ?? currentZ,
      );
      if (task) {
        task.targetKind = 'entity';
        task.targetId = preyId;
        task.targetCell = target;
        task.phase = 'travel';
        task.progress = 0;
        renewResidentTaskLease(task, state.tick);
      }
    } else if (stateValue === AgentState.Butcher) {
      const task = state.entities.tasks[entityId];
      const currentCarcass =
        task?.type === 'butcher' && task.targetKind === 'carcass'
          ? state.carcasses.find((carcass) => carcass.id === task.targetId)
          : undefined;
      const carcass = currentCarcass ?? findAvailableCarcass(entityId);
      if (!carcass) {
        if (task) failResidentTask(task, state.tick, '附近没有可处理的动物尸体');
        state.entities.states[entityId] = AgentState.Idle;
        return;
      }
      carcass.reservedByEntityId = entityId;
      carcass.reservedUntilTick = state.tick + 120;
      target = findNearestWalkable(state, carcass.x, carcass.z);
      if (task) {
        task.targetKind = 'carcass';
        task.targetId = carcass.id;
        task.targetCell = target;
        task.phase = 'travel';
        task.progress = 0;
        renewResidentTaskLease(task, state.tick);
      }
    } else if (stateValue === AgentState.Fish) {
      const task = state.entities.tasks[entityId];
      const currentFishId =
        task?.type === 'fish' &&
        task.targetKind === 'entity' &&
        state.entities.active[task.targetId] === 1 &&
        state.entities.kind[task.targetId] === EntityKind.Fish
          ? task.targetId
          : -1;
      const fishingTarget =
        currentFishId >= 0
          ? { fishId: currentFishId, shoreCell: findShoreCellForFish(currentFishId) }
          : findFishingTarget(entityId);
      if (!fishingTarget || fishingTarget.shoreCell < 0) {
        if (task) failResidentTask(task, state.tick, '附近岸线没有可捕捞的鱼群');
        state.entities.states[entityId] = AgentState.Idle;
        return;
      }
      target = fishingTarget.shoreCell;
      if (task) {
        task.targetKind = 'entity';
        task.targetId = fishingTarget.fishId;
        task.targetCell = target;
        task.phase = 'travel';
        task.progress = 0;
        renewResidentTaskLease(task, state.tick);
      }
    }
    if (target < 0) {
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      if (stateValue === AgentState.Guard) target = current;
      else if (village) target = findNearestWalkable(state, village.x, village.z);
      else {
        const x = Math.max(1, Math.min(state.map.size - 2, currentX + randomInt(random, -10, 10)));
        const z = Math.max(1, Math.min(state.map.size - 2, currentZ + randomInt(random, -10, 10)));
        target = findNearestWalkable(state, x, z);
      }
    }
    requestPath(
      entityId,
      target,
      stateValue === AgentState.Flee
        ? 10
        : stateValue === AgentState.FindFood || stateValue === AgentState.Hunt
          ? 6
          : 2,
    );
  };

  const syncResidentTask = (entityId: number): void => {
    const agentState = state.entities.states[entityId] as AgentState;
    const currentTask = state.entities.tasks[entityId];
    if (currentTask?.phase === 'failed' && state.tick - currentTask.finishedAtTick < 60) {
      return;
    }
    const targetCell = state.entities.targetCells[entityId] ?? NO_TARGET;
    const resourceTargetId = state.entities.resourceTargetIds[entityId] ?? NO_TARGET;
    const villageId = state.entities.villageIds[entityId] ?? 0;
    const profession = state.entities.professions[entityId] as Profession;
    const hunger = state.entities.hunger[entityId] ?? 0;
    const energy = state.entities.energy[entityId] ?? 0;
    let type: ResidentTaskType = 'idle';
    let reason: ResidentTaskReason = 'none';
    let targetKind: ResidentTaskTargetKind = targetCell === NO_TARGET ? 'none' : 'cell';
    let targetId = targetCell === NO_TARGET ? 0 : targetCell;
    let expectedResult = '等待新的村庄职责';
    let requiredProgress = 1;

    if (agentState === AgentState.FindFood || agentState === AgentState.Eat) {
      type = 'eat';
      reason = hunger >= 900 ? 'critical-hunger' : 'hunger';
      expectedResult = '取得一餐并缓解饥饿';
    } else if (agentState === AgentState.Rest) {
      type = 'sleep';
      reason = energy <= 120 ? 'critical-fatigue' : 'fatigue';
      expectedResult = '回到住所休息至精力恢复';
    } else if (agentState === AgentState.GatherWood || agentState === AgentState.GatherStone) {
      type = 'gather';
      reason =
        agentState === AgentState.GatherWood
          ? 'village-needs-wood'
          : profession === Profession.Miner
            ? 'village-needs-metal'
            : 'village-needs-stone';
      targetKind = resourceTargetId === NO_TARGET ? targetKind : 'resource-node';
      targetId = resourceTargetId === NO_TARGET ? targetId : resourceTargetId;
      const resourceKind =
        resourceTargetId === NO_TARGET
          ? ResourceNodeKind.Stone
          : (state.resourceNodes.kind[resourceTargetId] as ResourceNodeKind);
      expectedResult =
        resourceKind === ResourceNodeKind.Tree
          ? '采集并运回木材'
          : resourceKind === ResourceNodeKind.Metal
            ? '开采并运回金属'
            : '采集并运回石料';
      requiredProgress =
        resourceKind === ResourceNodeKind.Tree
          ? 36
          : resourceKind === ResourceNodeKind.Metal
            ? 72
            : 48;
    } else if (
      agentState === AgentState.Home &&
      currentTask &&
      (currentTask.type === 'gather' ||
        currentTask.type === 'farm' ||
        currentTask.type === 'craft' ||
        currentTask.type === 'butcher' ||
        currentTask.type === 'fish')
    ) {
      type = currentTask.type;
      reason = currentTask.reason;
      targetKind = currentTask.targetKind;
      targetId = currentTask.targetId;
      expectedResult = currentTask.expectedResult;
      requiredProgress = currentTask.requiredProgress;
    } else if (agentState === AgentState.Haul || agentState === AgentState.Home) {
      type = 'haul';
      reason = 'village-construction';
      const building = state.buildings.find(
        (candidate) =>
          candidate.villageId === villageId && candidate.constructionPhase === 'delivery',
      );
      if (building) {
        const storage = state.buildings.find(
          (candidate) =>
            candidate.villageId === villageId &&
            candidate.type === BuildingType.Storage &&
            candidate.completed &&
            candidate.health > 0,
        );
        targetKind = 'building';
        targetId =
          agentState === AgentState.Haul &&
          (state.entities.carriedResources[entityId] ?? 0) === 0 &&
          storage
            ? storage.id
            : building.id;
      }
      expectedResult =
        agentState === AgentState.Haul && (state.entities.carriedResources[entityId] ?? 0) === 0
          ? '从仓储取得预留材料并送到工地'
          : '把预留材料送到工地';
    } else if (agentState === AgentState.Build || agentState === AgentState.Repair) {
      type = 'build';
      reason = 'village-construction';
      const building = state.buildings.find(
        (candidate) => candidate.villageId === villageId && !candidate.completed,
      );
      if (building) {
        targetKind = 'building';
        targetId = building.id;
        requiredProgress = building.requiredProgress;
      }
      expectedResult = '推进聚落建筑施工';
    } else if (agentState === AgentState.Farm) {
      type = 'farm';
      reason = 'village-needs-food';
      const foragingCell =
        profession === Profession.Forager &&
        targetCell !== NO_TARGET &&
        (state.map.resourceFood[targetCell] ?? 0) > 0 &&
        canVillageUseTerritoryCell(state, villageId, targetCell);
      if (foragingCell) {
        targetKind = 'cell';
        targetId = targetCell;
        expectedResult = '采集野外食物并送回聚落';
      } else {
        const farm = state.buildings.find(
          (candidate) =>
            candidate.villageId === villageId &&
            candidate.type === BuildingType.Farm &&
            candidate.completed &&
            candidate.health > 0,
        );
        if (farm) {
          targetKind = 'building';
          targetId = farm.id;
        }
        expectedResult = '完成农务并把食物送回聚落';
      }
      requiredProgress = 36;
    } else if (agentState === AgentState.Craft) {
      type = 'craft';
      reason = 'village-needs-tools';
      const workshopId = state.entities.workBuildingIds[entityId] ?? 0;
      if (workshopId > 0) {
        targetKind = 'building';
        targetId = workshopId;
      }
      expectedResult = '消耗木材和金属制作工具';
      requiredProgress = 72;
    } else if (agentState === AgentState.Flee) {
      type = 'flee';
      reason = 'danger';
      expectedResult = '离开当前危险区域';
    } else if (agentState === AgentState.Guard) {
      type = 'guard';
      reason = 'professional-duty';
      const barracksId = state.entities.workBuildingIds[entityId] ?? 0;
      const barracks = barracksId > 0 ? state.buildings[barracksId - 1] : undefined;
      if (barracks?.completed && barracks.health > 0 && barracks.type === BuildingType.Barracks) {
        targetKind = 'building';
        targetId = barracks.id;
        requiredProgress = 120;
        expectedResult = '在兵营完成训练并保持聚落战备';
      } else {
        expectedResult = '守卫聚落和边境';
      }
    } else if (agentState === AgentState.Hunt) {
      type = 'hunt';
      reason = 'village-needs-food';
      if (currentTask?.type === 'hunt' && currentTask.targetKind === 'entity') {
        targetKind = 'entity';
        targetId = currentTask.targetId;
      } else {
        targetKind = 'none';
        targetId = 0;
      }
      requiredProgress = HUNTING_RULES.attackIntervalTicks;
      expectedResult = '追踪并猎杀至少三岁的野生动物';
    } else if (agentState === AgentState.Butcher) {
      type = 'butcher';
      reason = 'village-needs-food';
      if (currentTask?.type === 'butcher' && currentTask.targetKind === 'carcass') {
        targetKind = 'carcass';
        targetId = currentTask.targetId;
      } else {
        targetKind = 'none';
        targetId = 0;
      }
      requiredProgress = HUNTING_RULES.butcherTicks;
      expectedResult = '屠宰新鲜尸体并把肉送回聚落';
    } else if (agentState === AgentState.Fish) {
      type = 'fish';
      reason = 'village-needs-food';
      if (currentTask?.type === 'fish' && currentTask.targetKind === 'entity') {
        targetKind = 'entity';
        targetId = currentTask.targetId;
      } else {
        targetKind = 'none';
        targetId = 0;
      }
      requiredProgress = FISHING_RULES.workTicks;
      expectedResult = '在陆地岸边捕捞真实鱼群并送回聚落';
    }

    const canContinue =
      currentTask &&
      currentTask.phase !== 'complete' &&
      currentTask.phase !== 'failed' &&
      currentTask.type === type &&
      (currentTask.targetId === targetId ||
        currentTask.phase === 'work' ||
        currentTask.phase === 'delivery');
    const task = canContinue
      ? currentTask
      : beginResidentTask(++state.nextTaskId, state.tick, {
          type,
          reason,
          targetKind,
          targetId,
          targetCell: targetCell === NO_TARGET ? entityCell(state, entityId) : targetCell,
          expectedResult,
          requiredProgress,
        });
    task.reason = reason;
    if (task.phase !== 'work' && task.phase !== 'delivery' && targetCell !== NO_TARGET) {
      task.targetCell = targetCell;
    }
    if (
      agentState === AgentState.Home &&
      (task.type === 'gather' || task.type === 'farm' || task.type === 'craft')
    )
      task.phase = 'delivery';
    else if (state.entities.paths[entityId]) task.phase = 'travel';
    else if (task.phase === 'reserved' || task.phase === 'suspended') task.phase = 'reserved';
    renewResidentTaskLease(task, state.tick);
    state.entities.tasks[entityId] = task;
    if (task.targetKind === 'resource-node' && task.targetId !== NO_TARGET) {
      state.resourceNodes.reservedBy[task.targetId] = entityId + 1;
      state.resourceNodes.reservedUntil[task.targetId] = task.leaseUntilTick;
    }
  };

  const expeditionForResident = (entityId: number): PioneerExpedition | undefined => {
    const expeditionId = state.entities.expeditionIds[entityId] ?? 0;
    return expeditionId > 0
      ? state.expeditions.find((expedition) => expedition.id === expeditionId)
      : undefined;
  };

  const pairVillageFamilies = (villageId: number): void => {
    const unpairedWomen: number[] = [];
    const unpairedMen: number[] = [];
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        !isLivingHuman(state, entityId) ||
        state.entities.villageIds[entityId] !== villageId ||
        state.entities.partnerIds[entityId] !== NO_ENTITY ||
        state.entities.expeditionIds[entityId]
      ) {
        continue;
      }
      const age = state.entities.age[entityId] ?? 0;
      if (age < 18 || age > 58) continue;
      if (state.entities.sex[entityId] === ResidentSex.Female && age <= 44) {
        unpairedWomen.push(entityId);
      } else if (state.entities.sex[entityId] === ResidentSex.Male) {
        unpairedMen.push(entityId);
      }
    }
    const pairs = Math.min(unpairedWomen.length, unpairedMen.length);
    for (let index = 0; index < pairs; index += 1) {
      const first = unpairedWomen[index];
      const second = unpairedMen[index];
      if (first === undefined || second === undefined) continue;
      state.nextFamilyId += 1;
      state.entities.partnerIds[first] = second;
      state.entities.partnerIds[second] = first;
      state.entities.familyIds[first] = state.nextFamilyId;
      state.entities.familyIds[second] = state.nextFamilyId;
      const village = state.villages.find((candidate) => candidate.id === villageId);
      addEvent(
        state,
        'family',
        `${state.entities.names[first]}与${state.entities.names[second]}结为伴侣`,
        {
          category: 'population',
          archive: false,
          notification: false,
          entityIds: [first, second],
          villageIds: [villageId],
          kingdomIds: village?.kingdomId ? [village.kingdomId] : [],
        },
      );
    }
  };

  const tryVillageBirth = (village: Village, assigned: number): void => {
    if (
      !state.worldLaws.humanReproduction ||
      state.tick % 180 !== 0 ||
      state.tick - village.lastBirthTick < 120
    )
      return;
    const pressure = birthPressure({
      population: assigned,
      carryingCapacity: village.carryingCapacity,
      storedFood: village.resources.food,
    });
    if (pressure <= 0 || random() > 0.28 + pressure * 0.68) return;
    pairVillageFamilies(village.id);
    const mothers: number[] = [];
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        !isLivingHuman(state, entityId) ||
        state.entities.villageIds[entityId] !== village.id ||
        state.entities.sex[entityId] !== ResidentSex.Female ||
        state.entities.expeditionIds[entityId]
      ) {
        continue;
      }
      const age = state.entities.age[entityId] ?? 0;
      const partnerId = state.entities.partnerIds[entityId] ?? NO_ENTITY;
      const lastBirth = state.entities.lastBirthTicks[entityId] ?? 0;
      if (
        age >= 18 &&
        age <= 44 &&
        partnerId !== NO_ENTITY &&
        isLivingHuman(state, partnerId) &&
        state.entities.villageIds[partnerId] === village.id &&
        (lastBirth === 0 || state.tick - lastBirth >= 720)
      ) {
        mothers.push(entityId);
      }
    }
    const mother = mothers[Math.floor(random() * mothers.length)];
    if (mother === undefined) return;
    const father = state.entities.partnerIds[mother] ?? NO_ENTITY;
    if (father === NO_ENTITY) return;
    const newborn = spawn(
      EntityKind.Human,
      (state.entities.positionsX[mother] ?? village.x) + (random() - 0.5),
      (state.entities.positionsZ[mother] ?? village.z) + (random() - 0.5),
    )[0];
    if (newborn === undefined) return;
    state.entities.age[newborn] = 0;
    state.entities.villageIds[newborn] = village.id;
    state.entities.kingdomIds[newborn] = village.kingdomId;
    state.entities.parentAIds[newborn] = mother;
    state.entities.parentBIds[newborn] = father;
    state.entities.familyIds[newborn] = state.entities.familyIds[mother] ?? 0;
    let femaleChildren = 0;
    let maleChildren = 0;
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        !isLivingHuman(state, entityId) ||
        entityId === newborn ||
        (state.entities.age[entityId] ?? 0) >= 18 ||
        state.entities.kingdomIds[entityId] !== village.kingdomId
      ) {
        continue;
      }
      if (state.entities.sex[entityId] === ResidentSex.Female) femaleChildren += 1;
      else maleChildren += 1;
    }
    state.entities.sex[newborn] = chooseNewbornSex({
      femaleChildren,
      maleChildren,
      randomValue: random(),
    });
    state.entities.lastBirthTicks[mother] = state.tick;
    village.lastBirthTick = state.tick;
    village.resources.food = Math.max(0, village.resources.food - 2);
    state.population.totalBirths += 1;
    state.population.birthsThisYear += 1;
    addEvent(
      state,
      'birth',
      `${state.entities.names[mother]}与${state.entities.names[father]}的孩子出生于${village.name}`,
      {
        category: 'population',
        archive: false,
        notification: false,
        entityIds: [newborn, mother, father],
        villageIds: [village.id],
        kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
        locationCell: entityCell(state, newborn),
      },
    );
  };

  const findPioneerDestination = (village: Village): number => {
    let bestCell = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let attempt = 0; attempt < 72; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 18 + random() * Math.min(28, state.map.size * 0.16);
      const cell = findNearestWalkable(
        state,
        village.x + Math.cos(angle) * distance,
        village.z + Math.sin(angle) * distance,
      );
      const x = cell % state.map.size;
      const z = Math.floor(cell / state.map.size);
      if (state.villages.some((candidate) => Math.hypot(candidate.x - x, candidate.z - z) < 15)) {
        continue;
      }
      let resources = 0;
      for (let dz = -4; dz <= 4; dz += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const sampleX = Math.max(0, Math.min(state.map.size - 1, x + dx));
          const sampleZ = Math.max(0, Math.min(state.map.size - 1, z + dz));
          const sample = sampleZ * state.map.size + sampleX;
          resources +=
            Math.min(2, state.map.resourceFood[sample] ?? 0) +
            Math.min(1, state.map.resourceWood[sample] ?? 0);
        }
      }
      const terrain = state.map.terrain[cell] as TerrainType;
      const terrainScore =
        terrain === TerrainType.Grass ? 18 : terrain === TerrainType.Forest ? 10 : 0;
      const score = resources + terrainScore - Math.abs(distance - 24) * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestCell = cell;
      }
    }
    return bestCell;
  };

  const tryLaunchPioneerExpedition = (village: Village, assigned: number): void => {
    if (
      state.tick < village.pioneerReadyAtTick ||
      state.tick % 360 !== 0 ||
      state.villages.length + state.expeditions.length >= 12 ||
      assigned < 22 ||
      village.carryingCapacity <= 0 ||
      assigned / village.carryingCapacity < 0.88 ||
      village.resources.food < 10
    ) {
      return;
    }
    const residents: number[] = [];
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        !isLivingHuman(state, entityId) ||
        state.entities.villageIds[entityId] !== village.id ||
        state.entities.expeditionIds[entityId] ||
        (state.entities.carriedResources[entityId] ?? 0) > 0 ||
        (state.entities.age[entityId] ?? 0) < 18 ||
        (state.entities.age[entityId] ?? 0) > 42
      ) {
        continue;
      }
      residents.push(entityId);
    }
    const selected: number[] = [];
    for (const resident of residents) {
      const partner = state.entities.partnerIds[resident] ?? NO_ENTITY;
      if (
        selected.length >= 8 ||
        selected.includes(resident) ||
        partner === NO_ENTITY ||
        !residents.includes(partner)
      ) {
        continue;
      }
      selected.push(resident, partner);
    }
    if (selected.length < 6) return;
    const targetCell = findPioneerDestination(village);
    if (targetCell < 0) return;
    state.nextExpeditionId += 1;
    const expedition: PioneerExpedition = {
      id: state.nextExpeditionId,
      originVillageId: village.id,
      kingdomId: village.kingdomId,
      memberIds: selected.slice(0, 8),
      targetX: (targetCell % state.map.size) + 0.5,
      targetZ: Math.floor(targetCell / state.map.size) + 0.5,
      targetCell,
      startedAtTick: state.tick,
      supplies: 8,
    };
    for (const memberId of expedition.memberIds) {
      state.entities.expeditionIds[memberId] = expedition.id;
      state.entities.paths[memberId] = null;
      state.entities.targetCells[memberId] = targetCell;
    }
    village.resources.food -= expedition.supplies;
    village.pioneerReadyAtTick = state.tick + 2_880;
    state.expeditions.push(expedition);
    addEvent(state, 'migration', `${village.name}派出了一支拓荒队`, {
      category: 'population',
      archive: false,
      notification: false,
      entityIds: expedition.memberIds,
      villageIds: [village.id],
      kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
      locationCell: targetCell,
    });
  };

  const tryLaunchPopulationRelocation = (): void => {
    if (state.tick % 720 !== 0) return;
    const relocatingIds = new Set(state.expeditions.flatMap((expedition) => expedition.memberIds));
    const villageResidents = new Map<number, number[]>();
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!isLivingHuman(state, entityId) || relocatingIds.has(entityId)) continue;
      const villageId = state.entities.villageIds[entityId] ?? 0;
      if (!villageId) continue;
      const residents = villageResidents.get(villageId) ?? [];
      residents.push(entityId);
      villageResidents.set(villageId, residents);
    }
    const crowdedVillages = state.villages
      .filter((village) => {
        const population = villageResidents.get(village.id)?.length ?? 0;
        return (
          village.health > 0 &&
          village.kingdomId > 0 &&
          village.carryingCapacity > 0 &&
          population / village.carryingCapacity >= 0.85
        );
      })
      .sort(
        (first, second) =>
          (villageResidents.get(second.id)?.length ?? 0) / second.carryingCapacity -
            (villageResidents.get(first.id)?.length ?? 0) / first.carryingCapacity ||
          first.id - second.id,
      );
    for (const source of crowdedVillages) {
      const sourceResidents = villageResidents.get(source.id) ?? [];
      const mothers = sourceResidents.filter((entityId) => {
        const age = state.entities.age[entityId] ?? 0;
        const partnerId = state.entities.partnerIds[entityId] ?? NO_ENTITY;
        return (
          state.entities.sex[entityId] === ResidentSex.Female &&
          age >= 18 &&
          age <= 40 &&
          partnerId !== NO_ENTITY &&
          sourceResidents.includes(partnerId) &&
          !state.entities.expeditionIds[partnerId] &&
          !state.entities.expeditionIds[entityId]
        );
      });
      for (const mother of mothers) {
        const father = state.entities.partnerIds[mother] ?? NO_ENTITY;
        const children = sourceResidents.filter(
          (entityId) =>
            (state.entities.age[entityId] ?? 0) < 18 &&
            ((state.entities.parentAIds[entityId] === mother &&
              state.entities.parentBIds[entityId] === father) ||
              (state.entities.parentAIds[entityId] === father &&
                state.entities.parentBIds[entityId] === mother)),
        );
        const family = [mother, father, ...children];
        if (
          family.some(
            (entityId) =>
              state.entities.expeditionIds[entityId] ||
              (state.entities.carriedResources[entityId] ?? 0) > 0,
          )
        ) {
          continue;
        }
        const destinations = state.villages
          .filter((candidate) => {
            const population = villageResidents.get(candidate.id)?.length ?? 0;
            return (
              candidate.id !== source.id &&
              candidate.health > 0 &&
              candidate.kingdomId === source.kingdomId &&
              candidate.carryingCapacity - population >= family.length &&
              population / Math.max(1, candidate.carryingCapacity) <= 0.45
            );
          })
          .sort(
            (first, second) =>
              (villageResidents.get(first.id)?.length ?? 0) / first.carryingCapacity -
                (villageResidents.get(second.id)?.length ?? 0) / second.carryingCapacity ||
              Math.hypot(first.x - source.x, first.z - source.z) -
                Math.hypot(second.x - source.x, second.z - source.z) ||
              first.id - second.id,
          );
        let destination: Village | undefined;
        let targetCell = -1;
        for (const candidate of destinations) {
          const candidateCell = findNearestWalkable(state, candidate.x, candidate.z);
          const field = createFlowField(state.map.navigation, candidateCell);
          if ((field.distance[entityCell(state, mother)] ?? 0xffff_ffff) === 0xffff_ffff) continue;
          destination = candidate;
          targetCell = candidateCell;
          break;
        }
        if (!destination || targetCell < 0) continue;
        state.nextExpeditionId += 1;
        const relocation: PioneerExpedition = {
          id: state.nextExpeditionId,
          originVillageId: source.id,
          destinationVillageId: destination.id,
          kingdomId: source.kingdomId,
          memberIds: family,
          targetX: (targetCell % state.map.size) + 0.5,
          targetZ: Math.floor(targetCell / state.map.size) + 0.5,
          targetCell,
          startedAtTick: state.tick,
          supplies: 0,
        };
        for (const memberId of family) {
          state.entities.expeditionIds[memberId] = relocation.id;
          state.entities.paths[memberId] = null;
          state.entities.targetCells[memberId] = targetCell;
        }
        state.expeditions.push(relocation);
        addEvent(
          state,
          'migration',
          `${state.entities.names[mother] || '一名居民'}一家启程迁往${destination.name}`,
          {
            category: 'population',
            archive: false,
            notification: false,
            entityIds: family,
            villageIds: [source.id, destination.id],
            kingdomIds: [source.kingdomId],
            locationCell: targetCell,
          },
        );
        return;
      }
    }
    const smallVillages = state.villages
      .filter(
        (village) =>
          village.health > 0 &&
          village.kingdomId > 0 &&
          (villageResidents.get(village.id)?.length ?? 0) > 0 &&
          (villageResidents.get(village.id)?.length ?? 0) <= 8,
      )
      .sort(
        (first, second) =>
          (villageResidents.get(first.id)?.length ?? 0) -
            (villageResidents.get(second.id)?.length ?? 0) || first.id - second.id,
      );
    const isAvailableAdult = (entityId: number): boolean => {
      const age = state.entities.age[entityId] ?? 0;
      return (
        state.entities.partnerIds[entityId] === NO_ENTITY &&
        (state.entities.carriedResources[entityId] ?? 0) === 0 &&
        age >= 18 &&
        (state.entities.sex[entityId] === ResidentSex.Female ? age <= 44 : age <= 58)
      );
    };
    for (const source of smallVillages) {
      const sourceAdults = (villageResidents.get(source.id) ?? []).filter(isAvailableAdult);
      for (const residentId of sourceAdults) {
        const residentSex = state.entities.sex[residentId] as ResidentSex;
        const destinations = state.villages
          .filter(
            (candidate) =>
              candidate.id !== source.id &&
              candidate.health > 0 &&
              candidate.kingdomId === source.kingdomId &&
              (villageResidents.get(candidate.id) ?? []).some(
                (candidateId) =>
                  isAvailableAdult(candidateId) && state.entities.sex[candidateId] !== residentSex,
              ),
          )
          .sort(
            (first, second) =>
              Math.hypot(first.x - source.x, first.z - source.z) -
                Math.hypot(second.x - source.x, second.z - source.z) || first.id - second.id,
          );
        let destination: Village | undefined;
        let targetCell = -1;
        for (const candidate of destinations) {
          const candidateCell = findNearestWalkable(state, candidate.x, candidate.z);
          const field = createFlowField(state.map.navigation, candidateCell);
          if ((field.distance[entityCell(state, residentId)] ?? 0xffff_ffff) === 0xffff_ffff) {
            continue;
          }
          destination = candidate;
          targetCell = candidateCell;
          break;
        }
        if (!destination || targetCell < 0) continue;
        state.nextExpeditionId += 1;
        const relocation: PioneerExpedition = {
          id: state.nextExpeditionId,
          originVillageId: source.id,
          destinationVillageId: destination.id,
          kingdomId: source.kingdomId,
          memberIds: [residentId],
          targetX: (targetCell % state.map.size) + 0.5,
          targetZ: Math.floor(targetCell / state.map.size) + 0.5,
          targetCell,
          startedAtTick: state.tick,
          supplies: 0,
        };
        state.entities.expeditionIds[residentId] = relocation.id;
        state.entities.paths[residentId] = null;
        state.entities.targetCells[residentId] = targetCell;
        state.expeditions.push(relocation);
        addEvent(
          state,
          'migration',
          `${state.entities.names[residentId] || '一名居民'}从${source.name}启程迁居${destination.name}`,
          {
            category: 'population',
            archive: false,
            notification: false,
            entityIds: [residentId],
            villageIds: [source.id, destination.id],
            kingdomIds: [source.kingdomId],
            locationCell: targetCell,
          },
        );
        return;
      }
    }
  };

  const updatePioneerExpeditions = (): void => {
    for (let index = state.expeditions.length - 1; index >= 0; index -= 1) {
      const expedition = state.expeditions[index];
      if (!expedition) continue;
      const living = expedition.memberIds.filter((entityId) => isLivingHuman(state, entityId));
      const destination = expedition.destinationVillageId
        ? state.villages.find(
            (village) =>
              village.id === expedition.destinationVillageId &&
              village.health > 0 &&
              village.kingdomId === expedition.kingdomId,
          )
        : undefined;
      const minimumLiving = expedition.destinationVillageId ? 1 : 4;
      if (living.length < minimumLiving || (expedition.destinationVillageId && !destination)) {
        for (const memberId of living) state.entities.expeditionIds[memberId] = 0;
        state.expeditions.splice(index, 1);
        continue;
      }
      const cacheKey = 20_000 + expedition.id;
      let cached = flowFields.get(cacheKey);
      if (
        !cached ||
        cached.version !== state.map.navigation.mapVersion ||
        cached.target !== expedition.targetCell
      ) {
        cached = {
          version: state.map.navigation.mapVersion,
          target: expedition.targetCell,
          field: createFlowField(state.map.navigation, expedition.targetCell),
        };
        flowFields.set(cacheKey, cached);
      }
      let arrived = 0;
      for (const memberId of living) {
        const distance = Math.hypot(
          expedition.targetX - (state.entities.positionsX[memberId] ?? 0),
          expedition.targetZ - (state.entities.positionsZ[memberId] ?? 0),
        );
        state.entities.states[memberId] = AgentState.Haul;
        if (distance <= 2.5) {
          arrived += 1;
          continue;
        }
        const nextCell = nextFlowCell(cached.field, entityCell(state, memberId));
        moveTowardCell(state, memberId, nextCell, 0.075);
      }
      if (arrived < (destination ? living.length : Math.ceil(living.length * 0.75))) continue;
      if (destination) {
        const leadResidentName = state.entities.names[living[0] || 0] || '一名居民';
        for (const memberId of living) {
          state.entities.villageIds[memberId] = destination.id;
          state.entities.kingdomIds[memberId] = destination.kingdomId;
          state.entities.expeditionIds[memberId] = 0;
          state.entities.targetCells[memberId] = NO_TARGET;
        }
        state.population.totalMigrations += living.length;
        state.population.migrationsThisYear += living.length;
        addEvent(state, 'migration', `${leadResidentName}迁入了${destination.name}`, {
          category: 'population',
          archive: false,
          notification: false,
          entityIds: living,
          villageIds: [expedition.originVillageId, destination.id],
          kingdomIds: destination.kingdomId > 0 ? [destination.kingdomId] : [],
          locationCell: expedition.targetCell,
        });
        const origin = state.villages.find(
          (candidate) => candidate.id === expedition.originVillageId,
        );
        if (origin && countVillageResidents(state, origin.id) === 0) {
          origin.abandonedAtTick = state.tick;
          addEvent(state, 'village-merged', `${origin.name}撤并入${destination.name}`, {
            category: 'village',
            archive: true,
            notification: true,
            entityIds: living,
            villageIds: [origin.id, destination.id],
            kingdomIds: destination.kingdomId > 0 ? [destination.kingdomId] : [],
            locationCell: expedition.targetCell,
          });
        }
        state.expeditions.splice(index, 1);
        continue;
      }
      const village = makeVillage(
        state,
        expedition.targetX,
        expedition.targetZ,
        living.length,
        living,
      );
      village.kingdomId = expedition.kingdomId;
      village.resources.wood = 12;
      village.resources.stone = 4;
      const bootstrapProfessions = [
        Profession.Forager,
        Profession.Farmer,
        Profession.Builder,
      ] as const;
      for (let memberIndex = 0; memberIndex < living.length; memberIndex += 1) {
        const memberId = living[memberIndex];
        if (memberId === undefined) continue;
        state.entities.villageIds[memberId] = village.id;
        state.entities.kingdomIds[memberId] = expedition.kingdomId;
        state.entities.expeditionIds[memberId] = 0;
        state.entities.targetCells[memberId] = NO_TARGET;
        const bootstrapProfession = bootstrapProfessions[memberIndex];
        if (bootstrapProfession !== undefined) {
          state.entities.professions[memberId] = bootstrapProfession;
        }
      }
      const kingdom = state.kingdoms.find((candidate) => candidate.id === expedition.kingdomId);
      if (kingdom && !kingdom.villageIds.includes(village.id)) {
        kingdom.villageIds.push(village.id);
        refreshKingdomCapital(state, kingdom);
      }
      state.population.totalMigrations += living.length;
      state.population.migrationsThisYear += living.length;
      state.expeditions.splice(index, 1);
    }
  };

  const decideResidents = (): void => {
    const decisionSlices = state.entities.count >= 900 ? 16 : state.entities.count >= 500 ? 10 : 5;
    const needScale = decisionSlices / 5;
    for (
      let entityId = state.tick % decisionSlices;
      entityId < state.entities.count;
      entityId += decisionSlices
    ) {
      if (!state.entities.active[entityId] || state.entities.kind[entityId] !== EntityKind.Human)
        continue;
      state.entities.hunger[entityId] = Math.min(
        1_000,
        (state.entities.hunger[entityId] ?? 0) + Math.round(2 * needScale),
      );
      state.entities.energy[entityId] = Math.max(
        0,
        (state.entities.energy[entityId] ?? 0) - Math.max(1, Math.round(needScale)),
      );
      if ((state.entities.blessed[entityId] ?? 0) > 0) state.entities.blessed[entityId] -= 1;
      if ((state.entities.enraged[entityId] ?? 0) > 0) state.entities.enraged[entityId] -= 1;
      const previousState = state.entities.states[entityId] as AgentState;
      const wasHauling = previousState === AgentState.Haul;
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      if (expeditionForResident(entityId)) continue;
      const cell = entityCell(state, entityId);
      const danger = (state.map.fire[cell] ?? 0) > 80 || (state.map.plague[cell] ?? 0) > 80 ? 1 : 0;
      const profession = state.entities.professions[entityId] as Profession;
      const currentTask = state.entities.tasks[entityId];
      let nextState = selectUtilityState({
        hunger: state.entities.hunger[entityId] ?? 0,
        energy: state.entities.energy[entityId] ?? 0,
        danger,
        hasWork: state.entities.villageIds[entityId] > 0,
        isGuard: profession === Profession.Guard,
      });
      if (
        state.entities.tasks[entityId]?.type === 'sleep' &&
        state.entities.tasks[entityId]?.phase === 'work' &&
        (state.entities.energy[entityId] ?? 0) < 850
      ) {
        nextState = AgentState.Rest;
      }
      if (
        state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.Food &&
        (state.entities.carriedResources[entityId] ?? 0) > 0
      ) {
        nextState = AgentState.Eat;
      }
      if ((state.entities.age[entityId] ?? 0) < 16 && nextState === AgentState.Build) {
        nextState = state.entities.energy[entityId] < 300 ? AgentState.Rest : AgentState.Wander;
      }
      if (
        nextState === AgentState.Build &&
        wasHauling &&
        village?.buildingIds.some(
          (buildingId) => state.buildings[buildingId - 1]?.constructionPhase === 'delivery',
        )
      ) {
        nextState = AgentState.Haul;
      }
      if (
        nextState === AgentState.Build &&
        currentTask &&
        (currentTask.type === 'hunt' ||
          currentTask.type === 'butcher' ||
          currentTask.type === 'fish') &&
        currentTask.phase !== 'complete' &&
        currentTask.phase !== 'failed'
      ) {
        nextState = previousState;
      }
      if (nextState === AgentState.Build && profession !== Profession.Builder) {
        if (profession === Profession.Hunter && village && villageNeedsWildFood(village)) {
          const searchDue =
            state.tick % HUNTING_RULES.searchIntervalTicks ===
            entityId % HUNTING_RULES.searchIntervalTicks;
          if (!searchDue) nextState = AgentState.Wander;
          else if (findAvailableCarcass(entityId)) nextState = AgentState.Butcher;
          else if (findHuntPrey(entityId) >= 0) nextState = AgentState.Hunt;
          else nextState = AgentState.Wander;
        } else if (
          profession === Profession.Woodcutter &&
          village &&
          (!village.buildingIds.some((buildingId) => {
            const building = state.buildings[buildingId - 1];
            return (
              building?.completed &&
              building.health > 0 &&
              building.type === BuildingType.LoggingCamp
            );
          }) ||
            state.buildings[(state.entities.workBuildingIds[entityId] ?? 0) - 1]?.type ===
              BuildingType.LoggingCamp) &&
          villageNeedsResource(village, ResourceNodeKind.Tree)
        ) {
          nextState = AgentState.GatherWood;
        } else if (
          profession === Profession.Miner &&
          village &&
          (villageNeedsResource(village, ResourceNodeKind.Stone) ||
            (villageHasOperationalMine(state, village) &&
              villageNeedsResource(village, ResourceNodeKind.Metal)))
        ) {
          nextState = AgentState.GatherStone;
        } else if (
          profession === Profession.Forager &&
          village &&
          village.resources.food < 36 + village.population * 4
        ) {
          const forageCell = findNearestVillageGridResource(state, village.id, cell, 48);
          if (forageCell >= 0) nextState = AgentState.Farm;
          else if (
            villageNeedsWildFood(village) &&
            state.tick % FISHING_RULES.searchIntervalTicks ===
              entityId % FISHING_RULES.searchIntervalTicks &&
            findFishingTarget(entityId)
          )
            nextState = AgentState.Fish;
          else if (villageHasOperationalFarm(state, village)) nextState = AgentState.Farm;
          else nextState = AgentState.Wander;
        } else if (profession === Profession.Farmer && state.entities.workBuildingIds[entityId] > 0)
          nextState = AgentState.Farm;
        else if (
          profession === Profession.Blacksmith &&
          state.entities.workBuildingIds[entityId] > 0
        )
          nextState = AgentState.Craft;
        else nextState = AgentState.Haul;
      }
      if ((state.entities.carriedResources[entityId] ?? 0) > 0) {
        const carryingCraftInputs =
          state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.CraftInputs;
        const survivalState =
          nextState === AgentState.FindFood ||
          nextState === AgentState.Rest ||
          nextState === AgentState.Flee;
        if (carryingCraftInputs && !survivalState) nextState = AgentState.Craft;
        else if (!carryingCraftInputs) nextState = wasHauling ? AgentState.Haul : AgentState.Home;
      }
      const finishingSafePhase =
        currentTask &&
        currentTask.phase !== 'complete' &&
        currentTask.phase !== 'failed' &&
        (currentTask.phase === 'travel' ||
          currentTask.phase === 'work' ||
          currentTask.phase === 'delivery');
      if (
        finishingSafePhase &&
        ((nextState === AgentState.FindFood && (state.entities.hunger[entityId] ?? 0) < 900) ||
          (nextState === AgentState.Rest && (state.entities.energy[entityId] ?? 0) > 120))
      ) {
        nextState = previousState;
      }
      if (nextState !== previousState) {
        const task = state.entities.tasks[entityId];
        let survivalPreempted = false;
        if (task && task.phase !== 'complete' && task.phase !== 'failed') {
          if ((state.entities.hunger[entityId] ?? 0) >= 900) {
            suspendResidentTask(task, state.tick, 'critical-hunger');
            state.entities.suspendedTasks[entityId] = task;
            state.entities.tasks[entityId] = null;
            survivalPreempted = true;
          } else if ((state.entities.energy[entityId] ?? 0) <= 120) {
            suspendResidentTask(task, state.tick, 'critical-fatigue');
            state.entities.suspendedTasks[entityId] = task;
            state.entities.tasks[entityId] = null;
            survivalPreempted = true;
          } else if (danger > 0) {
            suspendResidentTask(task, state.tick, 'danger');
            state.entities.suspendedTasks[entityId] = task;
            state.entities.tasks[entityId] = null;
            survivalPreempted = true;
          }
        }
        if (survivalPreempted) {
          state.entities.paths[entityId] = null;
          state.entities.targetCells[entityId] = NO_TARGET;
        }
      }
      state.entities.states[entityId] = nextState;
      if (nextState !== AgentState.Idle && nextState !== AgentState.Rest) {
        grantResidentProgress(state, entityId, 1);
      }
      syncResidentTask(entityId);
      const target = state.entities.targetCells[entityId] ?? NO_TARGET;
      const activeTask = state.entities.tasks[entityId];
      if (
        activeTask?.phase !== 'work' &&
        (!state.entities.paths[entityId] ||
          target === NO_TARGET ||
          !isWalkable(state.map.navigation, target))
      ) {
        chooseTarget(entityId);
      }
      syncResidentTask(entityId);
    }
  };

  const processPaths = (): void => {
    const results = pathQueue.process(
      state.map.navigation,
      state.entities.count >= 900 ? 6 : state.entities.count >= 700 ? 8 : 16,
    );
    metrics.completedPaths += results.length;
    metrics.pathQueue = pathQueue.size;
    for (const result of results) {
      if (!state.entities.active[result.agentId]) continue;
      if (result.path.length > 1) {
        state.entities.paths[result.agentId] = {
          cells: result.path,
          cursor: 1,
          mapVersion: state.map.navigation.mapVersion,
        };
      } else if (result.path.length === 1) {
        completeEntityAction(state, result.agentId, result.destinationCell);
      } else {
        state.entities.targetCells[result.agentId] = NO_TARGET;
        const task = state.entities.tasks[result.agentId];
        if (task && task.phase !== 'complete' && task.phase !== 'failed') {
          failResidentTask(task, state.tick, '目的地不可达');
          if (task.targetKind === 'resource-node') {
            state.resourceNodes.reservedBy[task.targetId] = 0;
            state.resourceNodes.reservedUntil[task.targetId] = 0;
          }
        }
      }
    }
  };

  const updateAnimals = (): void => {
    const findPredatorPrey = (predatorId: number, radius: number): number => {
      const animalPrey = findNearestEntity(
        state,
        predatorId,
        [EntityKind.Chicken, EntityKind.Sheep, EntityKind.Cow, EntityKind.Deer],
        radius,
      );
      if (animalPrey >= 0) return animalPrey;
      const hunger = state.entities.hunger[predatorId] ?? 0;
      const nearVillage = state.villages.some(
        (village) =>
          village.health > 0 &&
          Math.hypot(
            village.x - (state.entities.positionsX[predatorId] ?? 0),
            village.z - (state.entities.positionsZ[predatorId] ?? 0),
          ) < 12,
      );
      if (hunger < 920 || nearVillage) return -1;
      return findNearestEntity(state, predatorId, [EntityKind.Human], radius);
    };
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!state.entities.active[entityId]) continue;
      const kind = state.entities.kind[entityId] as EntityKind;
      if (kind === EntityKind.Human) continue;
      const lifecycle = ANIMAL_LIFECYCLE_RULES[kind as keyof typeof ANIMAL_LIFECYCLE_RULES];
      const currentCell = entityCell(state, entityId);
      if (state.tick % 4 === entityId % 4) {
        state.entities.hunger[entityId] = Math.min(
          1_000,
          (state.entities.hunger[entityId] ?? 0) + 1,
        );
      }
      if (
        state.worldLaws.hunger &&
        (state.entities.hunger[entityId] ?? 0) >= 1_000 &&
        state.tick % 20 === entityId % 20
      ) {
        state.entities.health[entityId] = Math.max(
          0,
          (state.entities.health[entityId] ?? 0) - lifecycle.starvationDamage,
        );
        if ((state.entities.health[entityId] ?? 0) === 0) {
          recordAnimalDeath(state, entityId, 'hunger');
          continue;
        }
      }
      if (state.tick % 10 === entityId % 10) {
        if (kind === EntityKind.Fish) {
          const currentX = currentCell % state.map.size;
          const currentZ = Math.floor(currentCell / state.map.size);
          const directionOffset = Math.floor(stableNoise(state.tick * 131 + entityId * 977) * 4);
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const direction = (directionOffset + attempt) % 4;
            const candidateX = currentX + (direction === 0 ? -1 : direction === 1 ? 1 : 0);
            const candidateZ = currentZ + (direction === 2 ? -1 : direction === 3 ? 1 : 0);
            if (
              candidateX < 0 ||
              candidateZ < 0 ||
              candidateX >= state.map.size ||
              candidateZ >= state.map.size
            ) {
              continue;
            }
            const target = candidateZ * state.map.size + candidateX;
            const terrain = state.map.terrain[target];
            if (terrain !== TerrainType.Ocean && terrain !== TerrainType.ShallowOcean) continue;
            state.entities.targetCells[entityId] = target;
            break;
          }
          if (
            state.tick % FISHING_RULES.habitatFeedingIntervalTicks ===
              entityId % FISHING_RULES.habitatFeedingIntervalTicks &&
            (state.entities.hunger[entityId] ?? 0) > 0
          ) {
            const fishDiagnostics = state.ecology.species[EntityKind.Fish];
            const habitatPressure = Math.max(
              1,
              (fishDiagnostics?.count ?? 1) / Math.max(1, fishDiagnostics?.capacity ?? 1),
            );
            const hungerReduction = Math.max(
              1,
              Math.round(
                FISHING_RULES.habitatFeedingHungerReduction /
                  habitatPressure ** FISHING_RULES.habitatFeedingPressureExponent,
              ),
            );
            state.entities.hunger[entityId] = Math.max(
              0,
              (state.entities.hunger[entityId] ?? 0) - hungerReduction,
            );
            state.entities.states[entityId] = AgentState.Eat;
          } else {
            state.entities.states[entityId] = AgentState.Wander;
          }
        } else if (
          kind === EntityKind.Chicken ||
          kind === EntityKind.Sheep ||
          kind === EntityKind.Cow ||
          kind === EntityKind.Deer
        ) {
          const predator = findNearestEntity(
            state,
            entityId,
            [EntityKind.Wolf, EntityKind.Bear],
            7,
          );
          const danger =
            (state.map.fire[currentCell] ?? 0) > 40 || (state.map.plague[currentCell] ?? 0) > 40;
          if (predator >= 0 || danger) {
            const threatX =
              predator >= 0
                ? (state.entities.positionsX[predator] ?? 0)
                : currentCell % state.map.size;
            const threatZ =
              predator >= 0
                ? (state.entities.positionsZ[predator] ?? 0)
                : Math.floor(currentCell / state.map.size);
            const awayX = (state.entities.positionsX[entityId] ?? 0) - threatX;
            const awayZ = (state.entities.positionsZ[entityId] ?? 0) - threatZ;
            const length = Math.max(0.1, Math.hypot(awayX, awayZ));
            state.entities.targetCells[entityId] = findNearestWalkable(
              state,
              (state.entities.positionsX[entityId] ?? 0) + (awayX / length) * 9,
              (state.entities.positionsZ[entityId] ?? 0) + (awayZ / length) * 9,
            );
            state.entities.states[entityId] = AgentState.Flee;
          } else {
            const foodCell = findNearestGridResource(state.map, currentCell, 'food', 22, true);
            state.entities.targetCells[entityId] = foodCell >= 0 ? foodCell : currentCell;
            state.entities.states[entityId] = AgentState.FindFood;
          }
        } else {
          const prey = findPredatorPrey(entityId, 22);
          if (prey >= 0) {
            state.entities.targetCells[entityId] = entityCell(state, prey);
            state.entities.states[entityId] = AgentState.Chase;
          } else {
            state.entities.targetCells[entityId] = findNearestWalkable(
              state,
              (state.entities.positionsX[entityId] ?? 0) + randomInt(random, -8, 8),
              (state.entities.positionsZ[entityId] ?? 0) + randomInt(random, -8, 8),
            );
            state.entities.states[entityId] = AgentState.Wander;
          }
        }
      }

      const target = state.entities.targetCells[entityId];
      if (target === undefined || target === NO_TARGET) continue;
      if (
        kind === EntityKind.Fish &&
        state.map.terrain[target] !== TerrainType.Ocean &&
        state.map.terrain[target] !== TerrainType.ShallowOcean
      ) {
        continue;
      }
      if (kind === EntityKind.Fish) {
        moveTowardCell(
          state,
          entityId,
          target,
          (state.entities.speed[entityId] ?? 1.3) * 0.045,
          true,
        );
      } else if (!state.entities.paths[entityId]) {
        requestPath(
          entityId,
          target,
          state.entities.states[entityId] === AgentState.Flee
            ? 9
            : state.entities.states[entityId] === AgentState.Chase
              ? 7
              : 1,
        );
      }
      const targetX = (target % state.map.size) + 0.5;
      const targetZ = Math.floor(target / state.map.size) + 0.5;
      const arrived =
        Math.hypot(
          targetX - (state.entities.positionsX[entityId] ?? 0),
          targetZ - (state.entities.positionsZ[entityId] ?? 0),
        ) < (kind === EntityKind.Fish ? 0.48 : 0.9);
      if (!arrived) continue;
      state.entities.paths[entityId] = null;
      if (
        (kind === EntityKind.Chicken ||
          kind === EntityKind.Sheep ||
          kind === EntityKind.Cow ||
          kind === EntityKind.Deer) &&
        (state.map.resourceFood[target] ?? 0) > 0
      ) {
        state.map.resourceFood[target] -= 1;
        markMapCellDirty(state.map, target);
        state.entities.hunger[entityId] = Math.max(0, (state.entities.hunger[entityId] ?? 0) - 500);
        state.entities.states[entityId] = AgentState.Eat;
      }
      if (
        state.worldLaws.animalPredation &&
        (kind === EntityKind.Wolf || kind === EntityKind.Bear)
      ) {
        const prey = findPredatorPrey(entityId, 1.4);
        if (prey >= 0) {
          state.entities.states[entityId] = AgentState.Attack;
          state.entities.health[prey] = Math.max(
            0,
            (state.entities.health[prey] ?? 0) - (kind === EntityKind.Bear ? 18 : 10),
          );
          state.entities.hunger[entityId] = Math.max(
            0,
            (state.entities.hunger[entityId] ?? 0) - 220,
          );
          if ((state.entities.health[prey] ?? 0) === 0) {
            if (state.entities.kind[prey] === EntityKind.Human) {
              recordResidentDeath(state, prey, 'violence');
            } else {
              recordAnimalDeath(state, prey, 'predation');
            }
          }
        }
      }
      state.entities.targetCells[entityId] = NO_TARGET;
    }
  };

  const updateAnimalEcology = (): void => {
    if (!state.worldLaws.animalReproduction) return;
    for (const kind of ANIMAL_SPECIES) {
      const diagnostics = state.ecology.species[kind];
      if (diagnostics && state.tick - diagnostics.lastReturnTick < 720) continue;
      const members: number[] = [];
      for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
        if (state.entities.active[entityId] && state.entities.kind[entityId] === kind) {
          members.push(entityId);
        }
      }
      const cap = speciesCapacity(state, kind);
      if (members.length < 2 || members.length >= cap) continue;
      const lifecycle = ANIMAL_LIFECYCLE_RULES[kind];
      const breedingMembers = members.filter(
        (entityId) =>
          (state.entities.age[entityId] ?? 0) >= lifecycle.maturityYears &&
          (state.entities.hunger[entityId] ?? 0) <= lifecycle.maximumBreedingHunger + 120,
      );
      const females = breedingMembers.filter(
        (entityId) => state.entities.sex[entityId] === ResidentSex.Female,
      );
      const hasMale = breedingMembers.some(
        (entityId) => state.entities.sex[entityId] === ResidentSex.Male,
      );
      if (females.length === 0 || !hasMale) continue;
      const capacityPressure = members.length / Math.max(1, cap);
      const chance = lifecycle.reproductionChance * Math.max(0.2, 1 - capacityPressure);
      if (stableNoise(state.tick * 17 + kind * 101 + members.length) >= chance) continue;
      const parent =
        females[
          Math.floor(
            (kind === EntityKind.Fish
              ? stableNoise(state.tick * 37 + kind * 211 + females.length)
              : random()) * females.length,
          )
        ];
      if (parent === undefined) continue;
      const newborn = spawn(
        kind,
        state.entities.positionsX[parent] ?? 0,
        state.entities.positionsZ[parent] ?? 0,
      )[0];
      if (newborn !== undefined) {
        state.entities.age[newborn] = 0;
        recordAnimalBirth(state, kind);
      }
    }
    refreshEcologyDiagnostics(state);
    for (const kind of ANIMAL_SPECIES) {
      const diagnostics = state.ecology.species[kind];
      if (!diagnostics || diagnostics.count > 0) continue;
      if (state.ecology.extinctSinceTicks[kind] === state.tick) {
        addEvent(state, 'extinction', `${ANIMAL_SPECIES_NAMES[kind]}在荒野中灭绝`, {
          category: 'ecology',
          archive: true,
          notification: true,
        });
      }
    }
  };

  const findNaturalReturnCell = (kind: EntityKind): number => {
    const candidates = habitatCells(state, kind);
    if (candidates.length === 0) return -1;
    const stride = Math.max(1, Math.floor(candidates.length / 192));
    let bestCell = candidates[0] ?? -1;
    let bestDistance = -1;
    for (let index = 0; index < candidates.length; index += stride) {
      const cell = candidates[index];
      if (cell === undefined) continue;
      const x = cell % state.map.size;
      const z = Math.floor(cell / state.map.size);
      let nearestSettlement = state.map.size;
      for (const village of state.villages) {
        if (village.health <= 0) continue;
        nearestSettlement = Math.min(nearestSettlement, Math.hypot(village.x - x, village.z - z));
      }
      if (nearestSettlement > bestDistance) {
        bestDistance = nearestSettlement;
        bestCell = cell;
      }
    }
    return bestCell;
  };

  const updateNaturalAnimalReturn = (): void => {
    refreshEcologyDiagnostics(state);
    if (!state.worldLaws.naturalAnimalReturn) return;
    for (const kind of ANIMAL_SPECIES) {
      const diagnostics = state.ecology.species[kind];
      if (
        !diagnostics?.everPresent ||
        diagnostics.capacity <= 0 ||
        diagnostics.count >
          Math.max(
            0,
            Math.floor(diagnostics.capacity * ECOLOGY_BALANCE_RULES.naturalReturnThresholdRatio),
          ) ||
        state.tick < (state.ecology.nextReturnTicks[kind] ?? 0)
      ) {
        continue;
      }
      const cell = findNaturalReturnCell(kind);
      if (cell < 0) continue;
      const [minimum, maximum] = speciesReturnGroup(kind);
      const desired =
        kind === EntityKind.Fish
          ? randomInt(
              () => stableNoise(state.tick * 41 + kind * 313 + diagnostics.deaths),
              minimum,
              maximum,
            )
          : randomInt(random, minimum, maximum);
      const count = Math.min(desired, Math.max(0, diagnostics.capacity - diagnostics.count));
      if (count <= 0) continue;
      const wasExtinct = diagnostics.count === 0;
      const spawned = spawn(kind, cell % state.map.size, Math.floor(cell / state.map.size), count);
      if (spawned.length === 0) continue;
      diagnostics.lastReturnTick = state.tick;
      state.ecology.nextReturnTicks[kind] =
        state.tick +
        (kind === EntityKind.Fish
          ? randomInt(
              () => stableNoise(state.tick * 43 + kind * 317 + diagnostics.births),
              ...ECOLOGY_BALANCE_RULES.naturalReturnCooldownTicks,
            )
          : randomInt(random, ...ECOLOGY_BALANCE_RULES.naturalReturnCooldownTicks));
      if (wasExtinct) addEvent(state, 'ecology', `${ANIMAL_SPECIES_NAMES[kind]}重新出现在荒野中`);
    }
    refreshEcologyDiagnostics(state);
  };

  const updateCivilizationRestart = (): void => {
    let humans = 0;
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (isLivingHuman(state, entityId)) humans += 1;
    }
    if (humans > 0) {
      state.humanExtinctSinceTick = 0;
      return;
    }
    if (!state.humanExtinctSinceTick) state.humanExtinctSinceTick = state.tick;
    if (!state.worldLaws.civilizationRestart || state.tick - state.humanExtinctSinceTick < 14_400) {
      return;
    }
    const cell = findNearestWalkable(state, state.map.size / 2, state.map.size / 2);
    const x = (cell % state.map.size) + 0.5;
    const z = Math.floor(cell / state.map.size) + 0.5;
    const founders = spawn(EntityKind.Human, x, z, 8);
    if (founders.length !== 8) return;
    const ages = [18, 20, 22, 24, 26, 28, 30, 34] as const;
    const village = makeVillage(state, x, z, founders.length, founders);
    village.lastBirthTick = state.tick + 720;
    founders.forEach((entityId, index) => {
      state.entities.sex[entityId] = index % 2 === 0 ? ResidentSex.Female : ResidentSex.Male;
      state.entities.age[entityId] = ages[index] ?? 24;
      state.entities.villageIds[entityId] = village.id;
    });
    state.humanExtinctSinceTick = 0;
    addEvent(state, 'awakening', `${village.name}迎来了八位文明奠基者`);
    refreshPopulationDiagnostics(state);
  };

  const advanceCropsAndResidentWork = (): void => {
    for (const building of state.buildings) {
      if (!building.completed || building.health <= 0 || building.type !== BuildingType.Farm) {
        continue;
      }
      const farmX = Math.floor(building.x);
      const farmZ = Math.floor(building.z);
      for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const x = Math.max(0, Math.min(state.map.size - 1, farmX + offsetX));
          const z = Math.max(0, Math.min(state.map.size - 1, farmZ + offsetZ));
          const cell = toCell(state.map.navigation, x, z);
          if ((state.map.crops[cell] ?? 0) > 0 && (state.map.crops[cell] ?? 0) < 180) {
            state.map.crops[cell] += 1;
            if (state.tick % 12 === 0) markMapCellDirty(state.map, cell);
          }
        }
      }
    }

    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!isLivingHuman(state, entityId)) continue;
      const suspended = state.entities.suspendedTasks[entityId];
      if (suspended && state.tick > suspended.leaseUntilTick) {
        failResidentTask(suspended, state.tick, '中断后预留已过期');
        if (suspended.targetKind === 'resource-node') {
          state.resourceNodes.reservedBy[suspended.targetId] = 0;
          state.resourceNodes.reservedUntil[suspended.targetId] = 0;
        }
        state.entities.suspendedTasks[entityId] = null;
      }
      const task = state.entities.tasks[entityId];
      if (!task) continue;
      if (task.phase === 'suspended' && state.tick > task.leaseUntilTick) {
        failResidentTask(task, state.tick, '中断后预留已过期');
        if (task.targetKind === 'resource-node') {
          state.resourceNodes.reservedBy[task.targetId] = 0;
          state.resourceNodes.reservedUntil[task.targetId] = 0;
        }
        continue;
      }
      if (task.phase !== 'work') continue;
      const agentState = state.entities.states[entityId] as AgentState;
      if (agentState === AgentState.Hunt) {
        const preyId = task.targetKind === 'entity' ? task.targetId : -1;
        if (
          preyId < 0 ||
          state.entities.active[preyId] !== 1 ||
          (state.entities.age[preyId] ?? 0) < HUNTING_RULES.minimumPreyAge
        ) {
          failResidentTask(task, state.tick, '猎物已经离开或不符合狩猎年龄');
          state.entities.states[entityId] = AgentState.Idle;
          continue;
        }
        const distance = Math.hypot(
          (state.entities.positionsX[preyId] ?? 0) - (state.entities.positionsX[entityId] ?? 0),
          (state.entities.positionsZ[preyId] ?? 0) - (state.entities.positionsZ[entityId] ?? 0),
        );
        if (distance > 1.4) {
          const targetCell = findNearestWalkable(
            state,
            state.entities.positionsX[preyId] ?? 0,
            state.entities.positionsZ[preyId] ?? 0,
          );
          task.phase = 'travel';
          task.targetCell = targetCell;
          state.entities.paths[entityId] = null;
          requestPath(entityId, targetCell, 7);
          renewResidentTaskLease(task, state.tick);
          continue;
        }
        task.progress += 1;
        renewResidentTaskLease(task, state.tick);
        if (task.progress < HUNTING_RULES.attackIntervalTicks) continue;
        task.progress = 0;
        const damage =
          HUNTING_RULES.baseHuntDamage + (state.entities.weaponTiers[entityId] ?? 0) * 4;
        state.entities.health[preyId] = Math.max(0, (state.entities.health[preyId] ?? 0) - damage);
        if ((state.entities.health[preyId] ?? 0) > 0) continue;
        const carcass = recordAnimalDeath(state, preyId, 'hunting');
        if (carcass) {
          carcass.reservedByEntityId = entityId;
          carcass.reservedUntilTick = state.tick + 120;
        }
        completeResidentTask(task, state.tick);
        state.entities.states[entityId] = AgentState.Butcher;
        state.entities.paths[entityId] = null;
        state.entities.targetCells[entityId] = NO_TARGET;
        grantResidentProgress(state, entityId, 8);
        continue;
      }
      if (agentState === AgentState.Butcher) {
        const carcass =
          task.targetKind === 'carcass'
            ? state.carcasses.find((candidate) => candidate.id === task.targetId)
            : undefined;
        if (!carcass || carcass.meatRemaining <= 0 || carcass.decayAtTick <= state.tick) {
          failResidentTask(task, state.tick, '动物尸体已经腐烂或被处理');
          state.entities.states[entityId] = AgentState.Idle;
          continue;
        }
        carcass.reservedByEntityId = entityId;
        carcass.reservedUntilTick = state.tick + 120;
        task.progress += 1;
        task.requiredProgress = HUNTING_RULES.butcherTicks;
        renewResidentTaskLease(task, state.tick);
        if (task.progress < task.requiredProgress) continue;
        const amount = Math.min(HUNTING_RULES.maximumCarriedMeat, carcass.meatRemaining);
        carcass.meatRemaining -= amount;
        carcass.reservedByEntityId = null;
        carcass.reservedUntilTick = 0;
        state.ecology.butcheredMeat += amount;
        state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Food;
        state.entities.carriedResources[entityId] = amount;
        task.phase = 'delivery';
        task.expectedResult = '把屠宰所得肉类送入聚落仓储';
        state.entities.states[entityId] = AgentState.Home;
        state.entities.paths[entityId] = null;
        state.entities.targetCells[entityId] = NO_TARGET;
        grantResidentProgress(state, entityId, 8);
        continue;
      }
      if (agentState === AgentState.Fish) {
        const fishId = task.targetKind === 'entity' ? task.targetId : -1;
        const fisherCell = entityCell(state, entityId);
        if (
          fishId < 0 ||
          state.entities.active[fishId] !== 1 ||
          state.entities.kind[fishId] !== EntityKind.Fish
        ) {
          failResidentTask(task, state.tick, '目标鱼群已经离开或被捕捞');
          state.entities.states[entityId] = AgentState.Idle;
          continue;
        }
        if (!isWalkable(state.map.navigation, fisherCell)) {
          failResidentTask(task, state.tick, '捕鱼者没有站在可通行岸地');
          state.entities.states[entityId] = AgentState.Idle;
          continue;
        }
        const fishDistance = Math.hypot(
          (state.entities.positionsX[fishId] ?? 0) - (state.entities.positionsX[entityId] ?? 0),
          (state.entities.positionsZ[fishId] ?? 0) - (state.entities.positionsZ[entityId] ?? 0),
        );
        if (fishDistance > FISHING_RULES.shoreRange + 0.75) {
          failResidentTask(task, state.tick, '鱼群已经游出岸边捕捞范围');
          state.entities.states[entityId] = AgentState.Idle;
          continue;
        }
        task.progress += 1;
        task.requiredProgress = FISHING_RULES.workTicks;
        renewResidentTaskLease(task, state.tick);
        if (task.progress < task.requiredProgress) continue;
        recordAnimalDeath(state, fishId, 'hunting', { leaveCarcass: false });
        state.ecology.fishCaught += 1;
        state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Food;
        state.entities.carriedResources[entityId] = FISHING_RULES.catchFood;
        task.phase = 'delivery';
        task.expectedResult = '把岸边捕获的鱼送入聚落仓储';
        state.entities.states[entityId] = AgentState.Home;
        state.entities.paths[entityId] = null;
        state.entities.targetCells[entityId] = NO_TARGET;
        grantResidentProgress(state, entityId, 8);
        continue;
      }
      if (agentState === AgentState.Rest) {
        const cell = entityCell(state, entityId);
        if ((state.map.fire[cell] ?? 0) > 80 || (state.map.plague[cell] ?? 0) > 80) {
          suspendResidentTask(task, state.tick, 'danger');
          state.entities.states[entityId] = AgentState.Flee;
          continue;
        }
        const homeId = state.entities.homeBuildingIds[entityId] ?? 0;
        const home = homeId > 0 ? state.buildings[homeId - 1] : undefined;
        const recovery = home?.completed && home.health > 0 ? 4 : 2;
        state.entities.energy[entityId] = Math.min(
          1_000,
          (state.entities.energy[entityId] ?? 0) + recovery,
        );
        task.progress = state.entities.energy[entityId] ?? 0;
        task.requiredProgress = 850;
        renewResidentTaskLease(task, state.tick);
        if ((state.entities.energy[entityId] ?? 0) >= 850) {
          completeResidentTask(task, state.tick);
          state.entities.states[entityId] = AgentState.Idle;
          resumeSuspendedResidentTask(state, entityId);
        }
        continue;
      }
      if (agentState === AgentState.GatherWood || agentState === AgentState.GatherStone) {
        const nodeId = state.entities.resourceTargetIds[entityId] ?? NO_TARGET;
        if (
          nodeId === NO_TARGET ||
          state.resourceNodes.active[nodeId] !== 1 ||
          (state.resourceNodes.amount[nodeId] ?? 0) <= 0
        ) {
          failResidentTask(task, state.tick, '资源目标已经耗尽');
          state.resourceNodes.reservedBy[nodeId] = 0;
          state.resourceNodes.reservedUntil[nodeId] = 0;
          state.entities.resourceTargetIds[entityId] = NO_TARGET;
          continue;
        }
        task.progress += 1;
        renewResidentTaskLease(task, state.tick);
        state.resourceNodes.reservedUntil[nodeId] = task.leaseUntilTick;
        if (task.progress < task.requiredProgress) continue;
        const output = state.resourceNodes.kind[nodeId] === ResourceNodeKind.Metal ? 2 : 3;
        if (collectResourceForCarrier(state, entityId, nodeId, state.tick, output) <= 0) {
          failResidentTask(task, state.tick, '资源采集失败');
          state.resourceNodes.reservedBy[nodeId] = 0;
          state.resourceNodes.reservedUntil[nodeId] = 0;
          continue;
        }
        task.phase = 'delivery';
        state.entities.states[entityId] = AgentState.Home;
        state.entities.resourceTargetIds[entityId] = NO_TARGET;
        state.entities.targetCells[entityId] = NO_TARGET;
        state.entities.paths[entityId] = null;
        grantResidentProgress(state, entityId, 6);
        continue;
      }
      if (agentState === AgentState.Farm) {
        const cell = task.targetCell;
        const profession = state.entities.professions[entityId] as Profession;
        if (profession === Profession.Forager && task.targetKind === 'cell') {
          task.progress += 1;
          renewResidentTaskLease(task, state.tick);
          if (task.progress < 36) continue;
          const villageId = state.entities.villageIds[entityId] ?? 0;
          if (!canVillageUseTerritoryCell(state, villageId, cell)) {
            failResidentTask(task, state.tick, '野外食物已归属其他聚落');
            continue;
          }
          const amount = harvestGridResource(state.map, cell, 'food');
          if (amount <= 0) {
            failResidentTask(task, state.tick, '野外食物已经耗尽');
            continue;
          }
          state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Food;
          state.entities.carriedResources[entityId] = amount;
          task.phase = 'delivery';
          state.entities.states[entityId] = AgentState.Home;
          state.entities.targetCells[entityId] = NO_TARGET;
          state.entities.paths[entityId] = null;
          markMapCellDirty(state.map, cell);
          continue;
        }
        const crop = state.map.crops[cell] ?? 0;
        if (crop > 0 && crop < 180) {
          failResidentTask(task, state.tick, '作物尚未成熟');
          state.entities.states[entityId] = AgentState.Idle;
          continue;
        }
        task.progress += 1;
        task.requiredProgress = crop >= 180 ? 36 : 24;
        renewResidentTaskLease(task, state.tick);
        if (task.progress < task.requiredProgress) continue;
        if (crop >= 180) {
          state.map.crops[cell] = 0;
          state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Food;
          state.entities.carriedResources[entityId] = 4;
          task.phase = 'delivery';
          state.entities.states[entityId] = AgentState.Home;
          state.entities.targetCells[entityId] = NO_TARGET;
          state.entities.paths[entityId] = null;
        } else {
          state.map.crops[cell] = 1;
          completeResidentTask(task, state.tick);
          state.entities.states[entityId] = AgentState.Idle;
        }
        markMapCellDirty(state.map, cell);
        grantResidentProgress(state, entityId, 6);
        continue;
      }
      if (agentState === AgentState.Build) {
        const building = state.buildings[task.targetId - 1];
        if (!building || building.health <= 0) {
          failResidentTask(task, state.tick, '工地已被摧毁');
          continue;
        }
        if (building.constructionPhase === 'clearing') {
          clearConstructionSite(state, building);
          renewResidentTaskLease(task, state.tick);
          continue;
        }
        if (building.constructionPhase === 'delivery') {
          completeResidentTask(task, state.tick);
          state.entities.states[entityId] = AgentState.Haul;
          continue;
        }
        const applied = applyConstructionWork(state, building, 1);
        task.progress = Math.min(task.requiredProgress, task.progress + applied);
        renewResidentTaskLease(task, state.tick);
        if (building.completed) {
          completeResidentTask(task, state.tick);
          state.entities.states[entityId] = AgentState.Idle;
        }
        continue;
      }
      if (agentState === AgentState.Craft) {
        if (task.phase !== 'work') continue;
        task.progress += 1;
        renewResidentTaskLease(task, state.tick);
        if (task.progress < task.requiredProgress) continue;
        state.entities.carriedResourceKinds[entityId] =
          task.reason === 'village-needs-equipment'
            ? CarriedResourceKind.Equipment
            : CarriedResourceKind.Tools;
        state.entities.carriedResources[entityId] = 1;
        task.phase = 'delivery';
        state.entities.states[entityId] = AgentState.Home;
        state.entities.targetCells[entityId] = NO_TARGET;
        state.entities.paths[entityId] = null;
        grantResidentProgress(state, entityId, 8);
      }
    }
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!isLivingHuman(state, entityId)) continue;
      const task = state.entities.tasks[entityId];
      if (!task || task.phase !== 'delivery' || state.entities.states[entityId] !== AgentState.Home)
        continue;
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      if (!village) continue;
      const storage = state.buildings.find(
        (candidate) =>
          candidate.villageId === village.id &&
          candidate.type === BuildingType.Storage &&
          candidate.completed &&
          candidate.health > 0,
      );
      const destinationX = (storage?.x ?? village.x) + 0.5;
      const destinationZ = (storage?.z ?? village.z) + 0.5;
      if (
        Math.hypot(
          destinationX - (state.entities.positionsX[entityId] ?? 0),
          destinationZ - (state.entities.positionsZ[entityId] ?? 0),
        ) <= 0.8
      ) {
        completeEntityAction(state, entityId, entityCell(state, entityId));
      }
    }
  };

  const moveEntities = (): void => {
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!state.entities.active[entityId]) continue;
      const path = state.entities.paths[entityId];
      if (!path) continue;
      if (path.mapVersion !== state.map.navigation.mapVersion) {
        const currentCell = entityCell(state, entityId);
        if (!pathRemainsTraversable(state.map.navigation, currentCell, path.cells, path.cursor)) {
          state.entities.paths[entityId] = null;
          if (state.entities.kind[entityId] === EntityKind.Human) {
            state.entities.targetCells[entityId] = NO_TARGET;
          }
          continue;
        }
        path.mapVersion = state.map.navigation.mapVersion;
      }
      const targetCell = path.cells[path.cursor];
      if (targetCell === undefined || !isWalkable(state.map.navigation, targetCell)) {
        state.entities.paths[entityId] = null;
        state.entities.targetCells[entityId] = NO_TARGET;
        continue;
      }
      const targetX = (targetCell % state.map.size) + 0.5;
      const targetZ = Math.floor(targetCell / state.map.size) + 0.5;
      const dx = targetX - (state.entities.positionsX[entityId] ?? 0);
      const dz = targetZ - (state.entities.positionsZ[entityId] ?? 0);
      const distance = Math.hypot(dx, dz);
      const arrivalRadius = state.entities.kind[entityId] === EntityKind.Human ? 0.52 : 0.18;
      if (distance < arrivalRadius) {
        path.cursor += 1;
        if (path.cursor >= path.cells.length) {
          state.entities.paths[entityId] = null;
          if (state.entities.kind[entityId] === EntityKind.Human) {
            completeEntityAction(state, entityId, targetCell);
          }
        }
        continue;
      }
      const speed = (state.entities.speed[entityId] ?? 1.2) * 0.05;
      moveTowardCell(state, entityId, targetCell, Math.min(speed, distance));
    }
  };

  const formSettlements = (): void => {
    if (state.villages.length >= 6) return;
    const zones = new Map<number, number[]>();
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        !state.entities.active[entityId] ||
        state.entities.kind[entityId] !== EntityKind.Human ||
        state.entities.villageIds[entityId]
      )
        continue;
      const zone = Math.min(
        2,
        Math.floor(((state.entities.positionsX[entityId] ?? 0) / state.map.size) * 3),
      );
      const group = zones.get(zone) ?? [];
      group.push(entityId);
      zones.set(zone, group);
    }
    for (const group of zones.values()) {
      if (group.length < 8) continue;
      const x =
        group.reduce((sum, id) => sum + (state.entities.positionsX[id] ?? 0), 0) / group.length;
      const z =
        group.reduce((sum, id) => sum + (state.entities.positionsZ[id] ?? 0), 0) / group.length;
      const village = makeVillage(state, x, z, group.length, group);
      for (const entityId of group) state.entities.villageIds[entityId] = village.id;
    }
  };

  const updateEconomy = (): void => {
    for (const village of state.villages) {
      if (village.health <= 0) continue;
      assignVillageHomesAndWorkplaces(state, village);
      advanceVillageGuardTraining(state, village);
      const outdoorLosses = decayOutdoorStockpiles(state, village);
      const lostFood = outdoorLosses.food ?? 0;
      const lostWood = outdoorLosses.wood ?? 0;
      if (lostFood > 0 || lostWood > 0) {
        addEvent(
          state,
          'village',
          `${village.name}的露天积存损失：食物 ${lostFood}，木材 ${lostWood}`,
        );
      }
      const assigned = countVillageResidents(state, village.id);
      const previousPopulation = village.population;
      village.population = assigned;
      if (assigned > village.peakPopulation) village.peakPopulation = assigned;
      const significantPeak =
        assigned >= 10 &&
        (assigned >= village.lastRecordedPopulationPeak + 10 ||
          assigned >= Math.ceil(village.lastRecordedPopulationPeak * 1.25));
      if (significantPeak) {
        village.lastRecordedPopulationPeak = assigned;
        addEvent(state, 'population-peak', `${village.name}人口达到新高峰：${assigned} 人`, {
          category: 'population',
          archive: true,
          notification: false,
          villageIds: [village.id],
          kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
          locationCell: Math.floor(village.z) * state.map.size + Math.floor(village.x),
        });
      }
      if (previousPopulation > 0 && assigned === 0 && village.abandonedAtTick === 0) {
        village.abandonedAtTick = state.tick;
        addEvent(state, 'village-abandoned', `${village.name}已无人定居`, {
          category: 'village',
          archive: true,
          notification: true,
          villageIds: [village.id],
          kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
          locationCell: Math.floor(village.z) * state.map.size + Math.floor(village.x),
        });
      } else if (assigned > 0) {
        village.abandonedAtTick = 0;
      }
      const operationalBuildingTypes = village.buildingIds.flatMap((buildingId) => {
        const building = state.buildings[buildingId - 1];
        return building?.completed && building.health > 0 ? [building.type] : [];
      });
      const completed = operationalBuildingTypes.length;
      const previousTier = village.tier;
      village.tier = evaluateVillageTier(village.population, operationalBuildingTypes);
      if (village.tier > previousTier) {
        const tierLabel = ['营地', '村落', '城镇', '城邦'][village.tier] || '聚落';
        addEvent(state, 'village-upgrade', `${village.name}发展为${tierLabel}`, {
          category: 'village',
          archive: true,
          notification: true,
          villageIds: [village.id],
          kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
          locationCell: Math.floor(village.z) * state.map.size + Math.floor(village.x),
        });
      }
      if (assigned === 0) continue;
      const completedFarms = village.buildingIds.filter((id) => {
        const building = state.buildings[id - 1];
        return building?.completed && building.type === BuildingType.Farm;
      }).length;
      const foodProduced = village.foodProducedSinceUpdate;
      village.foodProducedSinceUpdate = 0;
      const expectedConsumption = assigned / 28;
      village.foodProduction = village.foodProduction * 0.8 + foodProduced * 0.2;
      village.foodConsumption = village.foodConsumption * 0.8 + expectedConsumption * 0.2;
      village.foodTrend = village.foodProduction - village.foodConsumption;
      if (state.tick % 100 === 0) {
        village.resources.gold += Math.max(1, Math.floor(assigned / 20));
      }
      if (village.resources.equipment > 0) {
        let recipient = -1;
        for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
          if (
            !state.entities.active[entityId] ||
            state.entities.villageIds[entityId] !== village.id ||
            state.entities.professions[entityId] !== Profession.Guard
          ) {
            continue;
          }
          if (
            recipient < 0 ||
            (state.entities.weaponTiers[entityId] ?? 0) <
              (state.entities.weaponTiers[recipient] ?? 0)
          ) {
            recipient = entityId;
          }
        }
        if (recipient >= 0 && (state.entities.weaponTiers[recipient] ?? 0) < 3) {
          state.entities.weaponTiers[recipient] += 1;
          if ((state.entities.weaponTiers[recipient] ?? 0) >= 2) {
            state.entities.armorTiers[recipient] = Math.min(
              3,
              (state.entities.armorTiers[recipient] ?? 0) + 1,
            );
          }
          village.resources.equipment -= 1;
          const recipientName = state.entities.names[recipient] || '一名士兵';
          addEvent(state, 'equipment', `${recipientName}获得了新装备`, {
            category: 'population',
            archive: false,
            notification: false,
            entityIds: [recipient],
            villageIds: [village.id],
            kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
          });
        }
      }
      const unfinished = village.buildingIds.some((id) => !state.buildings[id - 1]?.completed);
      if (!unfinished) planVillageBuilding(state, village, completed);
      clampResources(village);
      const kingdom = state.kingdoms.find((candidate) => candidate.id === village.kingdomId);
      const atWar = kingdom
        ? Object.values(kingdom.relations).some((relation) => relation === DiplomacyState.War)
        : false;
      const safety = Math.max(0.45, Math.min(1, village.health / 1_000)) * (atWar ? 0.72 : 1);
      village.carryingCapacity = calculateCarryingCapacity({
        housingCapacity: village.housingCapacity,
        completedFarms,
        storedFood: village.resources.food,
        foodTrend: village.foodTrend,
        safety,
      });
      const shortageStage = resolveShortageStage({
        storedFood: village.resources.food,
        population: assigned,
        shortageTicks: village.shortageTicks,
      });
      village.shortageTicks =
        shortageStage === 'stable'
          ? Math.max(0, village.shortageTicks - 60)
          : village.shortageTicks + 20;
      if (shortageStage === 'famine' && village.lastShortageStage !== 'famine') {
        addEvent(state, 'famine', `${village.name}进入饥荒`, {
          category: 'disaster',
          archive: true,
          notification: true,
          villageIds: [village.id],
          kingdomIds: village.kingdomId > 0 ? [village.kingdomId] : [],
          locationCell: Math.floor(village.z) * state.map.size + Math.floor(village.x),
        });
      }
      village.lastShortageStage = shortageStage;
      pairVillageFamilies(village.id);
      tryVillageBirth(village, assigned);
      tryLaunchPioneerExpedition(village, assigned);
    }
    tryLaunchPopulationRelocation();
    assignResidentRoles(state);
    refreshPopulationDiagnostics(state);
  };

  const updateDiplomacy = (): void => {
    formKingdoms(state);
    assignResidentRoles(state);
    for (const kingdom of state.kingdoms) {
      kingdom.militaryPower = countKingdomGuards(state, kingdom.id);
    }
    const active = state.kingdoms.filter((kingdom) => !kingdom.extinct);
    if (state.tick > 700 && state.tick >= state.forcedPeaceUntil && active.length >= 2) {
      const first = active[0];
      const second = active[1];
      const underTruce = state.truces.some(
        (truce) =>
          truce.untilTick > state.tick &&
          ((truce.firstKingdomId === first?.id && truce.secondKingdomId === second?.id) ||
            (truce.firstKingdomId === second?.id && truce.secondKingdomId === first?.id)),
      );
      if (first && second && !underTruce && first.relations[second.id] === DiplomacyState.Peace) {
        setDiplomacy(state, first.id, second.id, DiplomacyState.War);
        const warId = `${Math.min(first.id, second.id)}:${Math.max(first.id, second.id)}:${state.tick}`;
        addEvent(state, 'war', `${first.name}向${second.name}宣战`, {
          category: 'kingdom',
          archive: true,
          notification: true,
          kingdomIds: [first.id, second.id],
          war: { id: warId, label: `${first.name}—${second.name}战争` },
        });
      }
    }
  };

  const ensureWarCampaign = (firstKingdomId: number, secondKingdomId: number) => {
    const firstId = Math.min(firstKingdomId, secondKingdomId);
    const secondId = Math.max(firstKingdomId, secondKingdomId);
    const existing = state.wars.find(
      (war) => war.firstKingdomId === firstId && war.secondKingdomId === secondId,
    );
    if (existing) return existing;
    const campaign = {
      firstKingdomId: firstId,
      secondKingdomId: secondId,
      startedAtTick: state.tick,
      initialMilitaryPower: {
        [firstId]: Math.max(1, countKingdomGuards(state, firstId)),
        [secondId]: Math.max(1, countKingdomGuards(state, secondId)),
      },
      lastProgressTick: state.tick,
      capturedVillageIds: [],
      score: { [firstId]: 0, [secondId]: 0 },
      fatigue: { [firstId]: 0, [secondId]: 0 },
    };
    state.wars.push(campaign);
    return campaign;
  };

  const endWar = (firstKingdomId: number, secondKingdomId: number, reason: string): void => {
    const first = state.kingdoms.find((kingdom) => kingdom.id === firstKingdomId);
    const second = state.kingdoms.find((kingdom) => kingdom.id === secondKingdomId);
    if (first) first.relations[secondKingdomId] = DiplomacyState.Peace;
    if (second) second.relations[firstKingdomId] = DiplomacyState.Peace;
    const campaign = state.wars.find(
      (war) =>
        war.firstKingdomId === Math.min(firstKingdomId, secondKingdomId) &&
        war.secondKingdomId === Math.max(firstKingdomId, secondKingdomId),
    );
    state.wars = state.wars.filter(
      (war) =>
        !(
          war.firstKingdomId === Math.min(firstKingdomId, secondKingdomId) &&
          war.secondKingdomId === Math.max(firstKingdomId, secondKingdomId)
        ),
    );
    state.truces = state.truces.filter(
      (truce) =>
        !(
          truce.firstKingdomId === Math.min(firstKingdomId, secondKingdomId) &&
          truce.secondKingdomId === Math.max(firstKingdomId, secondKingdomId)
        ),
    );
    state.truces.push({
      firstKingdomId: Math.min(firstKingdomId, secondKingdomId),
      secondKingdomId: Math.max(firstKingdomId, secondKingdomId),
      untilTick: state.tick + 10_800,
    });
    const firstName = first?.name ?? '一方';
    const secondName = second?.name ?? '另一方';
    addEvent(state, 'peace', `${firstName}与${secondName}停战：${reason}`, {
      category: 'kingdom',
      archive: true,
      notification: true,
      kingdomIds: [firstKingdomId, secondKingdomId],
      war: campaign
        ? {
            id: `${campaign.firstKingdomId}:${campaign.secondKingdomId}:${campaign.startedAtTick}`,
            label: `${firstName}—${secondName}战争`,
          }
        : undefined,
    });
  };

  const nearestEnemyGuard = (entityId: number, candidates: number[], radius: number): number => {
    let nearest = -1;
    let nearestDistance = radius;
    for (const candidateId of candidates) {
      if (!state.entities.active[candidateId]) continue;
      const distance = Math.hypot(
        (state.entities.positionsX[candidateId] ?? 0) - (state.entities.positionsX[entityId] ?? 0),
        (state.entities.positionsZ[candidateId] ?? 0) - (state.entities.positionsZ[entityId] ?? 0),
      );
      if (distance < nearestDistance) {
        nearest = candidateId;
        nearestDistance = distance;
      }
    }
    return nearest;
  };

  const attackGuard = (
    attackerId: number,
    defenderId: number,
    campaign: ReturnType<typeof ensureWarCampaign>,
  ): void => {
    const distance = Math.hypot(
      (state.entities.positionsX[defenderId] ?? 0) - (state.entities.positionsX[attackerId] ?? 0),
      (state.entities.positionsZ[defenderId] ?? 0) - (state.entities.positionsZ[attackerId] ?? 0),
    );
    if (distance > 1.35) {
      state.entities.states[attackerId] = AgentState.Chase;
      moveTowardCell(state, attackerId, entityCell(state, defenderId), 0.1);
      return;
    }
    state.entities.states[attackerId] = AgentState.Attack;
    if ((Math.floor(state.tick / 2) + attackerId) % 4 !== 0) return;
    const weapon = state.entities.weaponTiers[attackerId] ?? 0;
    const armor = state.entities.armorTiers[defenderId] ?? 0;
    const damage = Math.max(
      10,
      24 + weapon * 7 + (state.entities.enraged[attackerId] ? 8 : 0) - armor * 4,
    );
    state.entities.health[defenderId] = Math.max(
      0,
      (state.entities.health[defenderId] ?? 0) - damage,
    );
    campaign.lastProgressTick = state.tick;
    const attackerKingdomId = state.entities.kingdomIds[attackerId] ?? 0;
    campaign.score[attackerKingdomId] = (campaign.score[attackerKingdomId] ?? 0) + damage;
    if ((state.entities.health[defenderId] ?? 0) <= 0) {
      recordResidentDeath(state, defenderId, 'violence');
      campaign.score[attackerKingdomId] = (campaign.score[attackerKingdomId] ?? 0) + 100;
    }
  };

  const captureVillage = (
    village: Village,
    attackerKingdomId: number,
    campaign: ReturnType<typeof ensureWarCampaign>,
  ): void => {
    const defenderKingdomId = village.kingdomId;
    if (!defenderKingdomId || defenderKingdomId === attackerKingdomId) return;
    const defender = state.kingdoms.find((kingdom) => kingdom.id === defenderKingdomId);
    const attacker = state.kingdoms.find((kingdom) => kingdom.id === attackerKingdomId);
    if (!attacker) return;
    if (defender) defender.villageIds = defender.villageIds.filter((id) => id !== village.id);
    if (!attacker.villageIds.includes(village.id)) attacker.villageIds.push(village.id);
    village.kingdomId = attackerKingdomId;
    village.abandonedAtTick = 0;
    village.captureKingdomId = 0;
    village.captureProgress = 0;
    village.health = Math.max(650, village.health);
    if (defender) refreshKingdomCapital(state, defender);
    refreshKingdomCapital(state, attacker);
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (state.entities.active[entityId] && state.entities.villageIds[entityId] === village.id) {
        state.entities.kingdomIds[entityId] = attackerKingdomId;
      }
    }
    campaign.capturedVillageIds.push(village.id);
    campaign.score[attackerKingdomId] = (campaign.score[attackerKingdomId] ?? 0) + 1_000;
    campaign.lastProgressTick = state.tick;
    const defenderName = defender ? defender.name : '失守一方';
    addEvent(state, 'conquest', `${attacker.name}占领了${village.name}`, {
      category: 'village',
      archive: true,
      notification: true,
      villageIds: [village.id],
      kingdomIds: [attackerKingdomId, defenderKingdomId],
      war: {
        id: `${campaign.firstKingdomId}:${campaign.secondKingdomId}:${campaign.startedAtTick}`,
        label: `${attacker.name}—${defenderName}战争`,
      },
      locationCell: Math.floor(village.z) * state.map.size + Math.floor(village.x),
    });
  };

  const guardPower = (guardsByKingdom: Map<number, number[]>, kingdomId: number): number => {
    let power = 0;
    for (const entityId of guardsByKingdom.get(kingdomId) ?? []) {
      if (!state.entities.active[entityId]) continue;
      power += Math.round((state.entities.health[entityId] ?? 0) / 100);
    }
    return power;
  };

  const updateWarCampaignFatigue = (guardsByKingdom: Map<number, number[]>): void => {
    for (const campaign of [...state.wars]) {
      const first = state.kingdoms.find((kingdom) => kingdom.id === campaign.firstKingdomId);
      const second = state.kingdoms.find((kingdom) => kingdom.id === campaign.secondKingdomId);
      if (!first || !second || first.extinct || second.extinct) {
        endWar(campaign.firstKingdomId, campaign.secondKingdomId, '一方已无力继续战争');
        continue;
      }
      const duration = state.tick - campaign.startedAtTick;
      for (const kingdomId of [campaign.firstKingdomId, campaign.secondKingdomId]) {
        const initial = Math.max(1, campaign.initialMilitaryPower[kingdomId] ?? 1);
        const remaining = guardPower(guardsByKingdom, kingdomId);
        campaign.fatigue[kingdomId] = Math.min(
          100,
          Math.round((duration / 14_400) * 60 + (1 - remaining / initial) * 40),
        );
      }
      const depleted = [campaign.firstKingdomId, campaign.secondKingdomId].some((kingdomId) => {
        const initial = Math.max(1, campaign.initialMilitaryPower[kingdomId] ?? 1);
        return guardPower(guardsByKingdom, kingdomId) < initial * 0.4;
      });
      const noProgress = state.tick - campaign.lastProgressTick >= 3_600;
      const negotiated =
        duration >= 3_600 && (depleted || campaign.capturedVillageIds.length > 0 || noProgress);
      if (duration >= 14_400 || negotiated) {
        endWar(
          campaign.firstKingdomId,
          campaign.secondKingdomId,
          duration >= 14_400 ? '战争已持续二十年' : '双方因战损与疲劳议和',
        );
      }
    }
    state.truces = state.truces.filter((truce) => truce.untilTick > state.tick);
  };

  const updateWatchtowerDefense = (guardsByKingdom: Map<number, number[]>): void => {
    if (state.tick % 12 !== 0) return;
    for (const village of state.villages) {
      const defender = state.kingdoms.find(
        (kingdom) => kingdom.id === village.kingdomId && !kingdom.extinct,
      );
      if (!defender) continue;
      const enemyKingdomIds = Object.entries(defender.relations).flatMap(([kingdomId, relation]) =>
        relation === DiplomacyState.War ? [Number(kingdomId)] : [],
      );
      if (enemyKingdomIds.length === 0) continue;
      const watchtowers = village.buildingIds.flatMap((buildingId) => {
        const building = state.buildings[buildingId - 1];
        return building?.completed &&
          building.health > 0 &&
          building.type === BuildingType.Watchtower
          ? [building]
          : [];
      });
      for (const watchtower of watchtowers) {
        let targetId = -1;
        let nearestDistanceSquared = WATCHTOWER_RANGE * WATCHTOWER_RANGE;
        for (const enemyKingdomId of enemyKingdomIds) {
          for (const entityId of guardsByKingdom.get(enemyKingdomId) ?? []) {
            if (!state.entities.active[entityId]) continue;
            const deltaX = (state.entities.positionsX[entityId] ?? 0) - watchtower.x;
            const deltaZ = (state.entities.positionsZ[entityId] ?? 0) - watchtower.z;
            const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
            if (distanceSquared >= nearestDistanceSquared) continue;
            targetId = entityId;
            nearestDistanceSquared = distanceSquared;
          }
        }
        if (targetId < 0) continue;
        const attackerKingdomId = state.entities.kingdomIds[targetId] ?? 0;
        const before = state.entities.health[targetId] ?? 0;
        state.entities.health[targetId] = Math.max(0, before - WATCHTOWER_DAMAGE);
        const campaign = ensureWarCampaign(defender.id, attackerKingdomId);
        campaign.lastProgressTick = state.tick;
        campaign.score[defender.id] =
          (campaign.score[defender.id] ?? 0) + Math.min(before, WATCHTOWER_DAMAGE);
        if ((state.entities.health[targetId] ?? 0) <= 0) {
          recordResidentDeath(state, targetId, 'violence');
          campaign.score[defender.id] = (campaign.score[defender.id] ?? 0) + 100;
        }
      }
    }
  };

  const updateWar = (): void => {
    const guardsByKingdom = new Map<number, number[]>();
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (
        !state.entities.active[entityId] ||
        state.entities.kind[entityId] !== EntityKind.Human ||
        state.entities.professions[entityId] !== Profession.Guard
      ) {
        continue;
      }
      const kingdomId = state.entities.kingdomIds[entityId] ?? 0;
      const guards = guardsByKingdom.get(kingdomId) ?? [];
      guards.push(entityId);
      guardsByKingdom.set(kingdomId, guards);
    }
    for (const kingdom of state.kingdoms) {
      for (const [enemyId, relation] of Object.entries(kingdom.relations)) {
        if (relation === DiplomacyState.War && kingdom.id < Number(enemyId)) {
          ensureWarCampaign(kingdom.id, Number(enemyId));
        }
      }
    }
    updateWatchtowerDefense(guardsByKingdom);
    for (const kingdom of state.kingdoms) {
      if (kingdom.extinct) continue;
      const enemyId = Number(
        Object.entries(kingdom.relations).find(
          ([, relation]) => relation === DiplomacyState.War,
        )?.[0] ?? 0,
      );
      if (!enemyId) continue;
      const enemy = state.kingdoms.find(
        (candidate) => candidate.id === enemyId && !candidate.extinct,
      );
      const targetVillage = state.villages.find(
        (village) => enemy?.villageIds.includes(village.id) && village.health > 0,
      );
      if (!targetVillage) continue;
      const campaign = ensureWarCampaign(kingdom.id, enemyId);
      const targetCell = findNearestWalkable(state, targetVillage.x, targetVillage.z);
      const defendersRemainNearVillage = (guardsByKingdom.get(enemyId) ?? []).some((defenderId) => {
        if (state.entities.active[defenderId] !== 1) return false;
        const deltaX = (state.entities.positionsX[defenderId] ?? 0) - targetVillage.x;
        const deltaZ = (state.entities.positionsZ[defenderId] ?? 0) - targetVillage.z;
        return deltaX * deltaX + deltaZ * deltaZ <= 64;
      });
      const targetWalls = targetVillage.buildingIds.flatMap((buildingId) => {
        const building = state.buildings[buildingId - 1];
        return building?.completed && building.health > 0 && building.type === BuildingType.Wall
          ? [building]
          : [];
      });
      let targetWallIndex = 0;
      let cached = flowFields.get(kingdom.id);
      if (
        !cached ||
        cached.version !== state.map.navigation.mapVersion ||
        cached.target !== targetCell
      ) {
        cached = {
          version: state.map.navigation.mapVersion,
          target: targetCell,
          field: createFlowField(state.map.navigation, targetCell),
        };
        flowFields.set(kingdom.id, cached);
      }
      for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
        if (
          !state.entities.active[entityId] ||
          state.entities.kingdomIds[entityId] !== kingdom.id ||
          state.entities.professions[entityId] !== Profession.Guard
        ) {
          continue;
        }
        const enemyGuards = guardsByKingdom.get(enemyId) ?? [];
        const enemyGuard = nearestEnemyGuard(entityId, enemyGuards, 12);
        if (enemyGuard >= 0) {
          attackGuard(entityId, enemyGuard, campaign);
          continue;
        }
        const distance = Math.hypot(
          targetVillage.x - (state.entities.positionsX[entityId] ?? 0),
          targetVillage.z - (state.entities.positionsZ[entityId] ?? 0),
        );
        const guardCell = entityCell(state, entityId);
        const insideTargetTerritory =
          territoryVillageIdAtCell(state, guardCell) === targetVillage.id;
        if (insideTargetTerritory || (state.territory.revision === 0 && distance <= 2.1)) {
          state.entities.states[entityId] = AgentState.Attack;
          if (defendersRemainNearVillage) continue;
          while (
            targetWallIndex < targetWalls.length &&
            (targetWalls[targetWallIndex]?.health ?? 0) <= 0
          ) {
            targetWallIndex += 1;
          }
          const targetWall = targetWalls[targetWallIndex];
          if (targetWall && targetWall.health > 0) {
            targetVillage.captureKingdomId = kingdom.id;
            targetVillage.captureProgress = 0;
            const before = targetWall.health;
            const weapon = state.entities.weaponTiers[entityId] ?? 0;
            const siegeDamage = 0.75 + weapon * 0.25;
            targetWall.health = Math.max(0, targetWall.health - siegeDamage);
            campaign.lastProgressTick = state.tick;
            campaign.score[kingdom.id] =
              (campaign.score[kingdom.id] ?? 0) + Math.min(before, siegeDamage);
            if (before > 0 && targetWall.health <= 0) {
              addEvent(state, 'village', `${targetVillage.name}的城墙已被攻破`, {
                category: 'village',
                archive: true,
                notification: true,
                villageIds: [targetVillage.id],
                kingdomIds: [kingdom.id, targetVillage.kingdomId],
                locationCell:
                  Math.floor(targetVillage.z) * state.map.size + Math.floor(targetVillage.x),
              });
            }
            continue;
          }
          if (targetVillage.captureKingdomId !== kingdom.id) {
            targetVillage.captureKingdomId = kingdom.id;
            targetVillage.captureProgress = 0;
          }
          targetVillage.captureProgress = (targetVillage.captureProgress ?? 0) + 0.45;
          targetVillage.health = Math.max(650, targetVillage.health - 0.12);
          campaign.lastProgressTick = state.tick;
          if (state.tick % 12 === 0) {
            const building = state.buildings.find(
              (candidate) => candidate.villageId === targetVillage.id && candidate.health > 65,
            );
            if (building) building.health = Math.max(65, building.health - 0.5);
          }
          if ((targetVillage.captureProgress ?? 0) >= 100) {
            captureVillage(targetVillage, kingdom.id, campaign);
          }
          continue;
        }
        state.entities.states[entityId] = AgentState.Chase;
        state.entities.paths[entityId] = null;
        const currentCell = entityCell(state, entityId);
        const nextCell = nextFlowCell(cached.field, currentCell);
        moveTowardCell(state, entityId, nextCell, 0.09);
      }
    }
    resolveKingdomExtinctions(state);
    updateWarCampaignFatigue(guardsByKingdom);
  };

  const step = (): void => {
    state.tick += 1;
    state.year = 1 + Math.floor(state.tick / 720);
    decideResidents();
    processPaths();
    updatePioneerExpeditions();
    moveEntities();
    advanceCropsAndResidentWork();
    updateAnimals();
    decayAnimalCarcasses(state);
    advanceConstruction(state);
    if (state.tick % 2 === 0) updateWar();
    if (state.tick % 20 === 0) {
      stepEnvironment(state);
      advanceResourceRegrowth(state.resourceNodes, state.map, state.tick, 96);
      updateEconomy();
      applyEnvironmentDamage(state);
    }
    if (state.tick % 60 === 0) {
      formSettlements();
      advanceTerritoryClaims(state);
    }
    if (state.tick % 100 === 0) updateDiplomacy();
    if (state.tick % 200 === 0) {
      updateAnimalEcology();
      syncTreeNavigationCosts(state);
    }
    if (state.tick % 360 === 0) {
      updateNaturalAnimalReturn();
      updateCivilizationRestart();
    }
    if (state.tick % 720 === 0) {
      for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
        if (!state.entities.active[entityId]) continue;
        state.entities.age[entityId] = Math.min(255, (state.entities.age[entityId] ?? 0) + 1);
        if (state.entities.kind[entityId] !== EntityKind.Human) {
          const kind = state.entities.kind[entityId] as keyof typeof ANIMAL_LIFECYCLE_RULES;
          if (
            state.worldLaws.naturalOldAge &&
            (state.entities.age[entityId] ?? 0) > ANIMAL_LIFECYCLE_RULES[kind].lifespanYears
          ) {
            recordAnimalDeath(state, entityId, 'age');
          }
          continue;
        }
        const lifespan = 78 + ((state.entities.traits[entityId] ?? 0) % 12);
        if (
          !state.worldLaws.naturalOldAge ||
          (state.entities.age[entityId] ?? 0) <= lifespan ||
          state.entities.blessed[entityId]
        )
          continue;
        recordResidentDeath(state, entityId, 'age');
      }
      closePopulationYear(state);
    }
  };

  const setWorldLaw = (law: WorldLawId, enabled: boolean): void => {
    if (state.worldLaws[law] === enabled) return;
    state.worldLaws[law] = enabled;
    addEvent(
      state,
      'law',
      `世界法则“${WORLD_LAW_CATALOG[law].title}”已${enabled ? '开启' : '关闭'}`,
    );
  };

  return { state, metrics, step, spawn, ensureVillageAt, setWorldLaw };
}

function entityCell(state: WorldState, entityId: number): number {
  const x = Math.max(
    0,
    Math.min(state.map.size - 1, Math.floor(state.entities.positionsX[entityId] ?? 0)),
  );
  const z = Math.max(
    0,
    Math.min(state.map.size - 1, Math.floor(state.entities.positionsZ[entityId] ?? 0)),
  );
  return toCell(state.map.navigation, x, z);
}

function resumeSuspendedResidentTask(state: WorldState, entityId: number): boolean {
  const suspended = state.entities.suspendedTasks[entityId];
  if (!suspended || suspended.leaseUntilTick < state.tick) return false;
  suspended.phase = 'reserved';
  suspended.suspendedUntilTick = 0;
  suspended.suspensionReason = null;
  renewResidentTaskLease(suspended, state.tick);
  state.entities.tasks[entityId] = suspended;
  state.entities.suspendedTasks[entityId] = null;
  state.entities.targetCells[entityId] = NO_TARGET;
  return true;
}

function completeEntityAction(state: WorldState, entityId: number, cell: number): void {
  const village = state.villages.find(
    (candidate) => candidate.id === state.entities.villageIds[entityId],
  );
  const currentState = state.entities.states[entityId] as AgentState;
  const task = state.entities.tasks[entityId];
  if (currentState === AgentState.FindFood) {
    if (village) {
      if (village.resources.food < 1) {
        if (task) failResidentTask(task, state.tick, '村庄缺粮');
        state.entities.states[entityId] = AgentState.Idle;
      } else {
        village.resources.food -= 1;
        if ((state.entities.hunger[entityId] ?? 0) >= 900) {
          state.entities.hunger[entityId] = Math.max(
            0,
            (state.entities.hunger[entityId] ?? 0) - 680,
          );
          state.entities.malnutrition[entityId] = Math.max(
            0,
            (state.entities.malnutrition[entityId] ?? 0) - 80,
          );
          state.entities.states[entityId] = AgentState.Eat;
          if (task) completeResidentTask(task, state.tick);
          resumeSuspendedResidentTask(state, entityId);
        } else {
          state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Food;
          state.entities.carriedResources[entityId] = 1;
          state.entities.states[entityId] = AgentState.Eat;
          if (task) {
            task.phase = 'delivery';
            renewResidentTaskLease(task, state.tick);
          }
        }
      }
    } else if (
      canVillageUseTerritoryCell(state, state.entities.villageIds[entityId] ?? 0, cell) &&
      harvestGridResource(state.map, cell, 'food')
    ) {
      markMapCellDirty(state.map, cell);
      state.entities.hunger[entityId] = Math.max(0, (state.entities.hunger[entityId] ?? 0) - 620);
      state.entities.states[entityId] = AgentState.Eat;
      if (task) completeResidentTask(task, state.tick);
    }
  }
  if (
    currentState === AgentState.Eat &&
    state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.Food &&
    (state.entities.carriedResources[entityId] ?? 0) > 0
  ) {
    state.entities.carriedResources[entityId] = 0;
    state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.None;
    state.entities.hunger[entityId] = Math.max(0, (state.entities.hunger[entityId] ?? 0) - 680);
    state.entities.malnutrition[entityId] = Math.max(
      0,
      (state.entities.malnutrition[entityId] ?? 0) - 80,
    );
    if (task) completeResidentTask(task, state.tick);
    resumeSuspendedResidentTask(state, entityId);
  }
  if (currentState === AgentState.Rest) {
    if (task) {
      task.phase = 'work';
      renewResidentTaskLease(task, state.tick);
    }
  }
  if (currentState === AgentState.Guard && task) {
    task.phase = 'work';
    renewResidentTaskLease(task, state.tick);
  }
  if (
    (currentState === AgentState.Hunt ||
      currentState === AgentState.Butcher ||
      currentState === AgentState.Fish) &&
    task
  ) {
    task.phase = 'work';
    renewResidentTaskLease(task, state.tick);
  }
  if (currentState === AgentState.GatherWood || currentState === AgentState.GatherStone) {
    if (task) {
      task.phase = 'work';
      renewResidentTaskLease(task, state.tick);
    }
  }
  if (currentState === AgentState.Home && village) {
    depositCarriedResource(state, entityId);
    state.entities.states[entityId] = AgentState.Idle;
    if (task) completeResidentTask(task, state.tick);
  }
  if (currentState === AgentState.Farm && village) {
    if (task) {
      task.phase = 'work';
      task.requiredProgress = (state.map.crops[cell] ?? 0) >= 180 ? 36 : 24;
      renewResidentTaskLease(task, state.tick);
    }
  }
  if (currentState === AgentState.Craft && village && task) {
    const equipment = village.resources.tools >= Math.max(2, Math.ceil(village.population / 10));
    const wood = equipment ? 2 : 1;
    const metal = equipment ? 3 : 2;
    const carryingInputs =
      state.entities.carriedResourceKinds[entityId] === CarriedResourceKind.CraftInputs;
    if (!carryingInputs && (village.resources.wood < wood || village.resources.metal < metal)) {
      failResidentTask(task, state.tick, '工坊缺少木材或金属');
      state.entities.states[entityId] = AgentState.Idle;
    } else if (!carryingInputs) {
      village.resources.wood -= wood;
      village.resources.metal -= metal;
      state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.CraftInputs;
      state.entities.carriedResources[entityId] = 1;
      task.phase = 'delivery';
      const workshopId = state.entities.workBuildingIds[entityId] ?? 0;
      const workshop = workshopId > 0 ? state.buildings[workshopId - 1] : undefined;
      if (workshop) {
        task.targetKind = 'building';
        task.targetId = workshop.id;
        task.targetCell = findNearestWalkable(state, workshop.x, workshop.z);
      }
      task.expectedResult = '把工坊材料送到工作台';
      renewResidentTaskLease(task, state.tick);
    } else {
      state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.None;
      state.entities.carriedResources[entityId] = 0;
      task.phase = 'work';
      task.progress = 0;
      task.requiredProgress = equipment ? 108 : 72;
      task.expectedResult = equipment ? '制作一件装备并送入仓储' : '制作一件工具并送入仓储';
      task.reason = equipment ? 'village-needs-equipment' : 'village-needs-tools';
      renewResidentTaskLease(task, state.tick);
    }
  }
  if (currentState === AgentState.Build) {
    const building = state.buildings.find(
      (candidate) => candidate.villageId === village?.id && !candidate.completed,
    );
    if (building && task) {
      task.phase = 'work';
      renewResidentTaskLease(task, state.tick);
    }
  }
  if (currentState === AgentState.Haul) {
    const building = state.buildings.find(
      (candidate) =>
        candidate.villageId === village?.id && candidate.constructionPhase === 'delivery',
    );
    if (building) {
      const amount = state.entities.carriedResources[entityId] ?? 0;
      const kind = state.entities.carriedResourceKinds[entityId] as CarriedResourceKind;
      if (amount === 0) {
        const remainingWood = Math.max(
          0,
          building.reservedWood - building.deliveredWood - building.inTransitWood,
        );
        const remainingStone = Math.max(
          0,
          building.reservedStone - building.deliveredStone - building.inTransitStone,
        );
        if (remainingWood > 0) {
          const loaded = Math.min(12, remainingWood);
          state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Wood;
          state.entities.carriedResources[entityId] = loaded;
          building.inTransitWood += loaded;
        } else if (remainingStone > 0) {
          const loaded = Math.min(12, remainingStone);
          state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Stone;
          state.entities.carriedResources[entityId] = loaded;
          building.inTransitStone += loaded;
        }
        if (task) {
          task.phase = 'delivery';
          task.targetKind = 'building';
          task.targetId = building.id;
          task.targetCell = findNearestWalkable(state, building.x, building.z);
          task.expectedResult = '把预留材料送到工地';
          renewResidentTaskLease(task, state.tick);
        }
      } else {
        deliverConstructionResources(
          building,
          kind === CarriedResourceKind.Wood ? amount : 0,
          kind === CarriedResourceKind.Stone ? amount : 0,
        );
        state.entities.carriedResources[entityId] = 0;
        state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.None;
        if (task) completeResidentTask(task, state.tick);
      }
    }
  }
  if (
    currentState === AgentState.GatherWood ||
    currentState === AgentState.GatherStone ||
    currentState === AgentState.Farm ||
    currentState === AgentState.Build ||
    currentState === AgentState.Haul
  ) {
    grantResidentProgress(state, entityId, currentState === AgentState.Build ? 10 : 6);
  }
  state.entities.paths[entityId] = null;
  state.entities.targetCells[entityId] = NO_TARGET;
}

function countVillageResidents(state: WorldState, villageId: number): number {
  let count = 0;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (state.entities.active[entityId] && state.entities.villageIds[entityId] === villageId)
      count += 1;
  }
  return count;
}

function findNearestEntity(
  state: WorldState,
  sourceId: number,
  kinds: EntityKind[],
  radius: number,
): number {
  let nearest = -1;
  let nearestDistance = radius;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (entityId === sourceId || !state.entities.active[entityId]) continue;
    if (!kinds.includes(state.entities.kind[entityId] as EntityKind)) continue;
    const distance = Math.hypot(
      (state.entities.positionsX[entityId] ?? 0) - (state.entities.positionsX[sourceId] ?? 0),
      (state.entities.positionsZ[entityId] ?? 0) - (state.entities.positionsZ[sourceId] ?? 0),
    );
    if (distance < nearestDistance) {
      nearest = entityId;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function countKingdomGuards(state: WorldState, kingdomId: number): number {
  let power = 0;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (
      state.entities.active[entityId] &&
      state.entities.kingdomIds[entityId] === kingdomId &&
      state.entities.professions[entityId] === Profession.Guard
    ) {
      power += Math.round((state.entities.health[entityId] ?? 0) / 100);
    }
  }
  return power;
}

function planVillageBuilding(state: WorldState, village: Village, _completed: number): void {
  const decision = selectNextBuildingType(state, village);
  if (!decision) return;
  const { type } = decision;
  village.constructionDecision = decision.decision;
  village.constructionOverrideReason = decision.overrideReason;
  const occupied = village.buildingIds.flatMap((buildingId) => {
    const building = state.buildings[buildingId - 1];
    return building ? [{ x: building.x, z: building.z }] : [];
  });
  const typeIndex = village.buildingIds.filter(
    (buildingId) => state.buildings[buildingId - 1]?.type === type,
  ).length;
  let site = planOrganicBuildingSite(
    state.map,
    { x: village.x, z: village.z },
    type,
    typeIndex,
    occupied,
  );
  site = findPreferredPlanningSite(state, village, type, occupied) ?? site;
  if (type === BuildingType.Mine) {
    const veinId = findNearestVillageResourceNode(
      state,
      village.id,
      village.x,
      village.z,
      ResourceNodeKind.Metal,
      48,
    );
    if (veinId < 0) return;
    const approachCell = findNearestWalkable(
      state,
      (state.resourceNodes.positionsX[veinId] ?? village.x) + 2,
      state.resourceNodes.positionsZ[veinId] ?? village.z,
    );
    site = { x: approachCell % state.map.size, z: Math.floor(approachCell / state.map.size) };
  }
  const { x, z } = site;
  const building = startConstruction(state, village, type, x, z);
  if (!building) return;
  const roadCells = traceVillageRoad(state.map, { x: village.x, z: village.z }, { x, z });
  for (const cell of roadCells) {
    for (const nodeId of findResourceNodesInRadius(
      state.resourceNodes,
      (cell % state.map.size) + 0.5,
      Math.floor(cell / state.map.size) + 0.5,
      0.58,
    )) {
      if (!building.clearNodeIds.includes(nodeId)) building.clearNodeIds.push(nodeId);
    }
    state.map.roads[cell] = 1;
    markMapCellDirty(state.map, cell);
    state.map.navigation.cost[cell] = navigationCostForTerrain(
      state.map.terrain[cell] as TerrainType,
      true,
    );
  }
  if (building.clearNodeIds.length > 0) building.constructionPhase = 'clearing';
  if (type === BuildingType.Farm) {
    for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const cropX = Math.max(0, Math.min(state.map.size - 1, x + offsetX));
        const cropZ = Math.max(0, Math.min(state.map.size - 1, z + offsetZ));
        const cell = cropZ * state.map.size + cropX;
        if (isWalkable(state.map.navigation, cell)) {
          state.map.crops[cell] = 24;
          markMapCellDirty(state.map, cell);
        }
      }
    }
  }
}

function moveTowardCell(
  state: WorldState,
  entityId: number,
  cell: number,
  speed: number,
  aquatic = false,
): void {
  const targetX = (cell % state.map.size) + 0.5;
  const targetZ = Math.floor(cell / state.map.size) + 0.5;
  const dx = targetX - (state.entities.positionsX[entityId] ?? 0);
  const dz = targetZ - (state.entities.positionsZ[entityId] ?? 0);
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const avoidance =
    state.entities.kind[entityId] !== EntityKind.Human &&
    distance > 0.9 &&
    (state.tick + entityId) % 4 === 0
      ? resourceNodeAvoidance(
          state.resourceNodes,
          state.entities.positionsX[entityId] ?? 0,
          state.entities.positionsZ[entityId] ?? 0,
          0.72,
        )
      : { x: 0, z: 0 };
  const directionX = dx / distance + avoidance.x * 0.18;
  const directionZ = dz / distance + avoidance.z * 0.18;
  const directionLength = Math.max(0.001, Math.hypot(directionX, directionZ));
  const fromX = state.entities.positionsX[entityId] ?? 0;
  const fromZ = state.entities.positionsZ[entityId] ?? 0;
  const currentCell = entityCell(state, entityId);
  const heightDelta =
    (state.map.height[cell] ?? state.map.height[currentCell] ?? 0) -
    (state.map.height[currentCell] ?? 0);
  const multiplier = aquatic
    ? 1
    : traversalSpeedMultiplier({
        terrain: state.map.terrain[cell] as TerrainType,
        road: (state.map.roads[cell] ?? 0) > 0,
        heightDelta,
        carrying: (state.entities.carriedResources[entityId] ?? 0) > 0,
      });
  const distanceStep = Math.min(speed * multiplier, distance);
  const candidateX = fromX + (directionX / directionLength) * distanceStep;
  const candidateZ = fromZ + (directionZ / directionLength) * distanceStep;
  const directX = fromX + (dx / distance) * distanceStep;
  const directZ = fromZ + (dz / distance) * distanceStep;
  const candidates = aquatic
    ? [{ x: candidateX, z: candidateZ }]
    : [
        { x: candidateX, z: candidateZ },
        { x: directX, z: directZ },
        { x: fromX + Math.sign(dx) * Math.min(Math.abs(dx), distanceStep), z: fromZ },
        { x: fromX, z: fromZ + Math.sign(dz) * Math.min(Math.abs(dz), distanceStep) },
      ];
  let constrained = { x: fromX, z: fromZ, blocked: true };
  for (const candidate of candidates) {
    const navigationStep = aquatic
      ? isAquaticStep(state, fromX, fromZ, candidate.x, candidate.z)
      : constrainNavigationStep(state.map.navigation, fromX, fromZ, candidate.x, candidate.z);
    if (navigationStep.blocked) continue;
    const collisionStep = aquatic
      ? navigationStep
      : resolveTreeTrunkCollision(
          state.resourceNodes,
          fromX,
          fromZ,
          navigationStep.x,
          navigationStep.z,
        );
    if (collisionStep.blocked) continue;
    const verifiedStep = aquatic
      ? collisionStep
      : constrainNavigationStep(
          state.map.navigation,
          fromX,
          fromZ,
          collisionStep.x,
          collisionStep.z,
        );
    if (verifiedStep.blocked) continue;
    constrained = verifiedStep;
    break;
  }
  state.entities.positionsX[entityId] = constrained.x;
  state.entities.positionsZ[entityId] = constrained.z;
  state.entities.headings[entityId] = Math.atan2(dx, dz);
}

function isAquaticStep(
  state: WorldState,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number; blocked: boolean } {
  const distance = Math.hypot(toX - fromX, toZ - fromZ);
  const samples = Math.max(1, Math.ceil(distance / 0.18));
  for (let sample = 1; sample <= samples; sample += 1) {
    const ratio = sample / samples;
    const x = fromX + (toX - fromX) * ratio;
    const z = fromZ + (toZ - fromZ) * ratio;
    const cellX = Math.floor(x);
    const cellZ = Math.floor(z);
    if (cellX < 0 || cellZ < 0 || cellX >= state.map.size || cellZ >= state.map.size) {
      return { x: fromX, z: fromZ, blocked: true };
    }
    const terrain = state.map.terrain[cellZ * state.map.size + cellX] as TerrainType;
    if (terrain !== TerrainType.DeepOcean && terrain !== TerrainType.ShallowOcean) {
      return { x: fromX, z: fromZ, blocked: true };
    }
  }
  return { x: toX, z: toZ, blocked: false };
}

function applyEnvironmentDamage(state: WorldState): void {
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (!state.entities.active[entityId]) continue;
    const cell = entityCell(state, entityId);
    const burning = (state.map.fire[cell] ?? 0) > 80;
    const diseased =
      (state.map.plague[cell] ?? 0) > 80 || Boolean(state.entities.infected[entityId]);
    if (burning)
      state.entities.health[entityId] = Math.max(0, (state.entities.health[entityId] ?? 0) - 25);
    if (diseased) {
      state.entities.infected[entityId] = Math.min(
        255,
        (state.entities.infected[entityId] ?? 0) + 5,
      );
      state.entities.health[entityId] = Math.max(0, (state.entities.health[entityId] ?? 0) - 3);
      if (stableNoise(state.tick + entityId * 19) > 0.9) {
        state.map.plague[cell] = Math.max(state.map.plague[cell] ?? 0, 90);
      }
      markMapCellDirty(state.map, cell);
    }
    const hungry = state.worldLaws.hunger && (state.entities.hunger[entityId] ?? 0) >= 990;
    if (hungry && state.entities.kind[entityId] === EntityKind.Human) {
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      const shortage = resolveShortageStage({
        storedFood: village?.resources.food ?? 0,
        population: village?.population ?? 1,
        shortageTicks: village?.shortageTicks ?? 1_800,
      });
      state.entities.malnutrition[entityId] = Math.min(
        1_000,
        (state.entities.malnutrition[entityId] ?? 0) +
          (shortage === 'famine' ? 18 : shortage === 'migration' ? 7 : 2),
      );
      if (shortage === 'famine' && (state.entities.malnutrition[entityId] ?? 0) >= 120) {
        state.entities.health[entityId] = Math.max(0, (state.entities.health[entityId] ?? 0) - 8);
      }
    } else if (state.worldLaws.hunger) {
      state.entities.malnutrition[entityId] = Math.max(
        0,
        (state.entities.malnutrition[entityId] ?? 0) - 10,
      );
    }
    if ((state.entities.health[entityId] ?? 0) !== 0) continue;
    if (state.entities.kind[entityId] !== EntityKind.Human) {
      recordAnimalDeath(state, entityId, burning ? 'disaster' : diseased ? 'disease' : 'hunger');
      continue;
    }
    const cause: DeathCause = burning
      ? 'disaster'
      : diseased
        ? 'disease'
        : hungry
          ? 'hunger'
          : 'violence';
    recordResidentDeath(state, entityId, cause);
  }
}
