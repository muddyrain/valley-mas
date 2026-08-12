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
  ResourceNodeKind,
  TerrainType,
  type Village,
  VillageTier,
  type WorldEvent,
  type WorldPreset,
  type WorldState,
} from '@/shared/gameTypes';
import { createSeededRandom, randomInt, stableNoise } from '@/shared/random';
import { formKingdoms, resolveKingdomExtinctions, setDiplomacy } from '../kingdoms/kingdoms';
import { planOrganicBuildingSite, traceVillageRoad } from '../kingdoms/settlementPlanning';
import { generateWorldMap } from '../map/generateWorldMap';
import { markMapCellDirty } from '../map/mapDirty';
import { createFlowField, type FlowField, nextFlowCell } from '../navigation/flowField';
import { isWalkable, toCell } from '../navigation/grid';
import { PathQueue } from '../navigation/pathQueue';
import { findNearestGridResource, harvestGridResource } from '../resources/resourceGrid';
import {
  collectResourceForCarrier,
  depositCarriedResource,
  villageNeedsResource,
} from '../resources/resourceLogistics';
import {
  advanceResourceRegrowth,
  findNearestAvailableResourceNode,
  generateResourceNodes,
  reserveResourceNode,
  resourceNodeAvoidance,
} from '../resources/resourceNodes';
import {
  birthPressure,
  calculateCarryingCapacity,
  createPopulationDiagnostics,
  emptyDeathCauses,
  resolveShortageStage,
} from '../systems/demographics';
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
  step(): void;
  spawn(kind: EntityKind, x: number, z: number, count?: number): number[];
  ensureVillageAt(x: number, z: number, population: number): Village;
}

function createEntityArrays(capacity = MAX_ENTITIES): EntityArrays {
  const targetCells = new Uint32Array(capacity);
  targetCells.fill(NO_TARGET);
  const resourceTargetIds = new Uint32Array(capacity);
  resourceTargetIds.fill(NO_TARGET);
  const partnerIds = new Uint32Array(capacity);
  const parentAIds = new Uint32Array(capacity);
  const parentBIds = new Uint32Array(capacity);
  partnerIds.fill(NO_ENTITY);
  parentAIds.fill(NO_ENTITY);
  parentBIds.fill(NO_ENTITY);
  return {
    capacity,
    count: 0,
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
    names: [],
    paths: Array.from({ length: capacity }, () => null),
  };
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
        if (isWalkable(state.map.navigation, cell)) return cell;
      }
    }
  }
  return 0;
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

function addEvent(state: WorldState, kind: WorldEvent['kind'], message: string): void {
  state.nextEventId += 1;
  state.events.push({ id: state.nextEventId, tick: state.tick, kind, message });
  if (state.events.length > 30) state.events.splice(0, state.events.length - 30);
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
}

function makeVillage(state: WorldState, x: number, z: number, population: number): Village {
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
      food: Math.max(36, population * 3),
      wood: 22,
      stone: 8,
      metal: 0,
      gold: 4,
      tools: 2,
      equipment: 0,
    },
    storageCapacity: 180,
    housingCapacity: population + 5,
    kingdomId: 0,
    buildingIds: [],
    foundedAtTick: state.tick,
    carryingCapacity: population + 5,
    foodProduction: 0,
    foodConsumption: 0,
    foodTrend: 0,
    shortageTicks: 0,
    lastBirthTick: state.tick,
    pioneerReadyAtTick: state.tick + 1_440,
  };
  state.villages.push(village);
  addEvent(state, 'village', `${village.name}建立了营地`);
  return village;
}

function createInitialState(options: CreateWorldOptions): WorldState {
  const map = generateWorldMap(
    options.seed,
    options.mapSize ?? 256,
    options.preset ?? 'archipelago',
  );
  return {
    version: 4,
    seed: options.seed,
    tick: 0,
    year: 1,
    map,
    resourceNodes: generateResourceNodes(map, options.seed),
    entities: createEntityArrays(),
    villages: [],
    kingdoms: [],
    buildings: [],
    settings: { speed: 1, quality: 'high', overlay: 'none' },
    events: [],
    nextRequestId: 0,
    nextEventId: 0,
    forcedPeaceUntil: 0,
    population: createPopulationDiagnostics(),
    expeditions: [],
    nextFamilyId: 0,
    nextExpeditionId: 0,
  };
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

function recordResidentDeath(state: WorldState, entityId: number, cause: DeathCause): void {
  if (!isLivingHuman(state, entityId)) return;
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
  addEvent(state, 'death', `${state.entities.names[entityId] || '一名居民'}${labels[cause]}`);
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
    (sum, village) => sum + (village.health > 0 ? village.carryingCapacity : 0),
    0,
  );
  state.population.housingCapacity = state.villages.reduce(
    (sum, village) => sum + (village.health > 0 ? village.housingCapacity : 0),
    0,
  );
  state.population.storedFood = state.villages.reduce(
    (sum, village) => sum + (village.health > 0 ? village.resources.food : 0),
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
  ];
  if (state.map.preset !== 'ocean') {
    for (const [kind, x, z, count] of wildlife) simulation.spawn(kind, x, z, count);
  }
  return simulation;
}

export function createWorldSimulationFromState(state: WorldState): WorldSimulation {
  const random = createSeededRandom(`${state.seed}:simulation`);
  const pathQueue = new PathQueue();
  const flowFields = new Map<number, { version: number; target: number; field: FlowField }>();

  const spawn = (kind: EntityKind, x: number, z: number, count = 1): number[] => {
    const spawned: number[] = [];
    for (
      let index = 0;
      index < count && state.entities.count < state.entities.capacity;
      index += 1
    ) {
      const entityId = state.entities.count;
      const spawnX = x + (random() - 0.5) * 5;
      const spawnZ = z + (random() - 0.5) * 5;
      const cell =
        kind === EntityKind.Fish
          ? findNearestTerrain(state, spawnX, spawnZ, TerrainType.Ocean)
          : findNearestWalkable(state, spawnX, spawnZ);
      state.entities.count += 1;
      state.entities.active[entityId] = 1;
      state.entities.kind[entityId] = kind;
      state.entities.positionsX[entityId] = (cell % state.map.size) + 0.5 + (random() - 0.5) * 0.4;
      state.entities.positionsZ[entityId] =
        Math.floor(cell / state.map.size) + 0.5 + (random() - 0.5) * 0.4;
      state.entities.health[entityId] = 1_000;
      state.entities.hunger[entityId] = randomInt(random, 80, 420);
      state.entities.energy[entityId] = randomInt(random, 600, 1_000);
      state.entities.age[entityId] =
        kind === EntityKind.Human ? randomInt(random, 18, 40) : randomInt(random, 1, 12);
      state.entities.sex[entityId] = entityId % 2;
      state.entities.familyIds[entityId] = 0;
      state.entities.partnerIds[entityId] = NO_ENTITY;
      state.entities.parentAIds[entityId] = NO_ENTITY;
      state.entities.parentBIds[entityId] = NO_ENTITY;
      state.entities.lastBirthTicks[entityId] = 0;
      state.entities.malnutrition[entityId] = 0;
      state.entities.expeditionIds[entityId] = 0;
      state.entities.resourceTargetIds[entityId] = NO_TARGET;
      state.entities.carriedResources[entityId] = 0;
      state.entities.carriedResourceKinds[entityId] = 0;
      state.entities.states[entityId] = AgentState.Wander;
      state.entities.professions[entityId] = entityId % 7;
      state.entities.levels[entityId] = 1;
      state.entities.roles[entityId] = ResidentRole.Citizen;
      state.entities.traits[entityId] = randomInt(random, 0, 7);
      state.entities.speed[entityId] =
        kind === EntityKind.Human ? 1.25 + (entityId % 9) * 0.025 : 1.45;
      state.entities.names[entityId] =
        kind === EntityKind.Human
          ? `${FIRST_NAMES[entityId % FIRST_NAMES.length]}·${Math.floor(entityId / FIRST_NAMES.length) + 1}`
          : `${EntityKind[kind]} ${entityId + 1}`;
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
      completeEntityAction(state, entityId, destinationCell);
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

  const chooseTarget = (entityId: number): void => {
    const current = entityCell(state, entityId);
    const currentX = current % state.map.size;
    const currentZ = Math.floor(current / state.map.size);
    const stateValue = state.entities.states[entityId] as AgentState;
    let target = -1;
    if (stateValue === AgentState.FindFood)
      target = findNearestGridResource(state.map, current, 'food');
    else if (stateValue === AgentState.GatherWood || stateValue === AgentState.GatherStone) {
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
      const nodeId = findNearestAvailableResourceNode(
        state.resourceNodes,
        state.entities.positionsX[entityId] ?? currentX,
        state.entities.positionsZ[entityId] ?? currentZ,
        preferredKind,
        state.tick,
        48,
      );
      if (
        nodeId >= 0 &&
        reserveResourceNode(state.resourceNodes, nodeId, entityId, state.tick, 900)
      ) {
        state.entities.resourceTargetIds[entityId] = nodeId;
        target = findNearestWalkable(
          state,
          state.resourceNodes.positionsX[nodeId] ?? currentX,
          state.resourceNodes.positionsZ[nodeId] ?? currentZ,
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
      const building = state.buildings.find(
        (candidate) =>
          candidate.villageId === villageId && candidate.constructionPhase === 'delivery',
      );
      if (building) {
        if ((state.entities.carriedResources[entityId] ?? 0) === 0) {
          const remainingWood = Math.max(
            0,
            building.reservedWood - building.deliveredWood - building.inTransitWood,
          );
          const remainingStone = Math.max(
            0,
            building.reservedStone - building.deliveredStone - building.inTransitStone,
          );
          if (remainingWood > 0) {
            const amount = Math.min(12, remainingWood);
            state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Wood;
            state.entities.carriedResources[entityId] = amount;
            building.inTransitWood += amount;
          } else if (remainingStone > 0) {
            const amount = Math.min(12, remainingStone);
            state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.Stone;
            state.entities.carriedResources[entityId] = amount;
            building.inTransitStone += amount;
          }
        }
        target = findNearestWalkable(state, building.x, building.z);
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
        target = findNearestGridResource(state.map, current, 'food', 48);
      }
      const farm = state.buildings.find(
        (candidate) =>
          candidate.villageId === villageId &&
          candidate.type === BuildingType.Farm &&
          candidate.completed,
      );
      if (farm && target < 0)
        target = toCell(state.map.navigation, Math.floor(farm.x), Math.floor(farm.z));
    }
    if (target < 0) {
      const x = Math.max(1, Math.min(state.map.size - 2, currentX + randomInt(random, -10, 10)));
      const z = Math.max(1, Math.min(state.map.size - 2, currentZ + randomInt(random, -10, 10)));
      target = findNearestWalkable(state, x, z);
    }
    requestPath(
      entityId,
      target,
      stateValue === AgentState.Flee ? 10 : stateValue === AgentState.FindFood ? 6 : 2,
    );
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
    }
  };

  const tryVillageBirth = (village: Village, assigned: number): void => {
    if (state.tick % 180 !== 0 || state.tick - village.lastBirthTick < 120) return;
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
    state.entities.lastBirthTicks[mother] = state.tick;
    village.lastBirthTick = state.tick;
    village.resources.food = Math.max(0, village.resources.food - 2);
    state.population.totalBirths += 1;
    state.population.birthsThisYear += 1;
    addEvent(
      state,
      'birth',
      `${state.entities.names[mother]}与${state.entities.names[father]}的孩子出生于${village.name}`,
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
    addEvent(state, 'village', `${village.name}派出了一支拓荒队`);
  };

  const updatePioneerExpeditions = (): void => {
    for (let index = state.expeditions.length - 1; index >= 0; index -= 1) {
      const expedition = state.expeditions[index];
      if (!expedition) continue;
      const living = expedition.memberIds.filter((entityId) => isLivingHuman(state, entityId));
      if (living.length < 4) {
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
      if (arrived < Math.ceil(living.length * 0.75)) continue;
      const village = makeVillage(state, expedition.targetX, expedition.targetZ, living.length);
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
      if (kingdom && !kingdom.villageIds.includes(village.id)) kingdom.villageIds.push(village.id);
      state.population.totalMigrations += living.length;
      state.population.migrationsThisYear += living.length;
      addEvent(state, 'village', `${village.name}由${living.length}名拓荒者建立`);
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
      const village = state.villages.find(
        (candidate) => candidate.id === state.entities.villageIds[entityId],
      );
      if (
        (state.entities.hunger[entityId] ?? 0) >= 640 &&
        village &&
        village.resources.food >= 0.4
      ) {
        village.resources.food -= 0.4;
        state.entities.hunger[entityId] = Math.max(0, (state.entities.hunger[entityId] ?? 0) - 680);
        state.entities.malnutrition[entityId] = Math.max(
          0,
          (state.entities.malnutrition[entityId] ?? 0) - 80,
        );
        state.entities.states[entityId] = AgentState.Eat;
      }
      if (expeditionForResident(entityId)) continue;
      const cell = entityCell(state, entityId);
      const danger = (state.map.fire[cell] ?? 0) > 80 || (state.map.plague[cell] ?? 0) > 80 ? 1 : 0;
      const profession = state.entities.professions[entityId] as Profession;
      let nextState = selectUtilityState({
        hunger: state.entities.hunger[entityId] ?? 0,
        energy: state.entities.energy[entityId] ?? 0,
        danger,
        hasWork: state.entities.villageIds[entityId] > 0,
        isGuard: profession === Profession.Guard,
      });
      if ((state.entities.age[entityId] ?? 0) < 16 && nextState === AgentState.Build) {
        nextState = state.entities.energy[entityId] < 300 ? AgentState.Rest : AgentState.Wander;
      }
      if (nextState === AgentState.Build && profession !== Profession.Builder) {
        if (
          profession === Profession.Woodcutter &&
          village &&
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
          nextState = AgentState.Farm;
        } else if (profession === Profession.Farmer) nextState = AgentState.Farm;
        else nextState = AgentState.Haul;
      }
      if ((state.entities.carriedResources[entityId] ?? 0) > 0) {
        nextState =
          state.entities.states[entityId] === AgentState.Haul ? AgentState.Haul : AgentState.Home;
      }
      if (nextState === AgentState.Rest) {
        state.entities.energy[entityId] = Math.min(
          1_000,
          (state.entities.energy[entityId] ?? 0) + 16,
        );
      }
      state.entities.states[entityId] = nextState;
      if (nextState !== AgentState.Idle && nextState !== AgentState.Rest) {
        grantResidentProgress(state, entityId, 1);
      }
      const target = state.entities.targetCells[entityId] ?? NO_TARGET;
      if (target === NO_TARGET || !isWalkable(state.map.navigation, target)) chooseTarget(entityId);
    }
  };

  const processPaths = (): void => {
    for (const result of pathQueue.process(
      state.map.navigation,
      state.entities.count >= 900 ? 6 : state.entities.count >= 700 ? 8 : 16,
    )) {
      if (!state.entities.active[result.agentId]) continue;
      if (result.path.length > 1) {
        state.entities.paths[result.agentId] = {
          cells: result.path,
          cursor: 1,
          mapVersion: state.map.navigation.mapVersion,
        };
      } else state.entities.targetCells[result.agentId] = NO_TARGET;
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
      const currentCell = entityCell(state, entityId);
      state.entities.hunger[entityId] = Math.min(1_000, (state.entities.hunger[entityId] ?? 0) + 1);
      if (state.tick % 10 === entityId % 10) {
        if (kind === EntityKind.Fish) {
          const neighbours = [
            currentCell - 1,
            currentCell + 1,
            currentCell - state.map.size,
            currentCell + state.map.size,
          ].filter((cell) => cell >= 0 && state.map.terrain[cell] === TerrainType.Ocean);
          const target = neighbours[Math.floor(random() * neighbours.length)];
          if (target !== undefined) state.entities.targetCells[entityId] = target;
          state.entities.states[entityId] = AgentState.Wander;
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
            const foodCell = findNearestGridResource(state.map, currentCell, 'food');
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
      if (kind === EntityKind.Fish && state.map.terrain[target] !== TerrainType.Ocean) continue;
      moveTowardCell(state, entityId, target, (state.entities.speed[entityId] ?? 1.3) * 0.045);
      const targetX = (target % state.map.size) + 0.5;
      const targetZ = Math.floor(target / state.map.size) + 0.5;
      const arrived =
        Math.hypot(
          targetX - (state.entities.positionsX[entityId] ?? 0),
          targetZ - (state.entities.positionsZ[entityId] ?? 0),
        ) < 0.48;
      if (!arrived) continue;
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
      if (kind === EntityKind.Wolf || kind === EntityKind.Bear) {
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
        }
      }
      state.entities.targetCells[entityId] = NO_TARGET;
    }
  };

  const updateAnimalEcology = (): void => {
    const species = [
      EntityKind.Chicken,
      EntityKind.Sheep,
      EntityKind.Cow,
      EntityKind.Deer,
      EntityKind.Wolf,
      EntityKind.Bear,
    ];
    for (const kind of species) {
      const members: number[] = [];
      for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
        if (state.entities.active[entityId] && state.entities.kind[entityId] === kind) {
          members.push(entityId);
        }
      }
      const cap = kind === EntityKind.Wolf || kind === EntityKind.Bear ? 18 : 48;
      if (members.length < 2 || members.length >= cap) continue;
      if (stableNoise(state.tick * 17 + kind * 101 + members.length) < 0.58) continue;
      const parent = members[Math.floor(random() * members.length)];
      if (parent === undefined) continue;
      const newborn = spawn(
        kind,
        state.entities.positionsX[parent] ?? 0,
        state.entities.positionsZ[parent] ?? 0,
      )[0];
      if (newborn !== undefined) state.entities.age[newborn] = 0;
    }
  };

  const moveEntities = (): void => {
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (!state.entities.active[entityId]) continue;
      const path = state.entities.paths[entityId];
      if (!path) continue;
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
      if (distance < 0.18) {
        path.cursor += 1;
        if (path.cursor >= path.cells.length) completeEntityAction(state, entityId, targetCell);
        continue;
      }
      const speed = (state.entities.speed[entityId] ?? 1.2) * 0.05;
      const avoidance =
        distance > 0.9 && (state.tick + entityId) % 4 === 0
          ? resourceNodeAvoidance(
              state.resourceNodes,
              state.entities.positionsX[entityId] ?? 0,
              state.entities.positionsZ[entityId] ?? 0,
              0.72,
            )
          : { x: 0, z: 0 };
      const directionX = dx / Math.max(0.001, distance) + avoidance.x * 0.18;
      const directionZ = dz / Math.max(0.001, distance) + avoidance.z * 0.18;
      const directionLength = Math.max(0.001, Math.hypot(directionX, directionZ));
      state.entities.positionsX[entityId] +=
        (directionX / directionLength) * Math.min(speed, distance);
      state.entities.positionsZ[entityId] +=
        (directionZ / directionLength) * Math.min(speed, distance);
      state.entities.headings[entityId] = Math.atan2(dx, dz);
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
      const village = makeVillage(state, x, z, group.length);
      for (const entityId of group) state.entities.villageIds[entityId] = village.id;
    }
  };

  const updateEconomy = (): void => {
    for (const village of state.villages) {
      if (village.health <= 0) continue;
      const assigned = countVillageResidents(state, village.id);
      if (assigned > 0) village.population = assigned;
      const completed = village.buildingIds.reduce((count, buildingId) => {
        return count + (state.buildings[buildingId - 1]?.completed ? 1 : 0);
      }, 0);
      const previousTier = village.tier;
      village.tier = evaluateVillageTier(village.population, completed);
      if (village.tier > previousTier)
        addEvent(state, 'village', `${village.name}发展为${VillageTier[village.tier]}`);
      if (assigned === 0) continue;
      const completedFarms = village.buildingIds.filter((id) => {
        const building = state.buildings[id - 1];
        return building?.completed && building.type === BuildingType.Farm;
      }).length;
      const foodProduced = completedFarms;
      const expectedConsumption = assigned / 28;
      village.resources.food += foodProduced;
      village.foodProduction = village.foodProduction * 0.8 + foodProduced * 0.2;
      village.foodConsumption = village.foodConsumption * 0.8 + expectedConsumption * 0.2;
      village.foodTrend = village.foodProduction - village.foodConsumption;
      const completedWorkshops = village.buildingIds.filter((id) => {
        const building = state.buildings[id - 1];
        return building?.completed && building.type === BuildingType.Workshop;
      }).length;
      if (state.tick % 100 === 0) {
        village.resources.gold += Math.max(1, Math.floor(assigned / 20));
        for (let workshop = 0; workshop < completedWorkshops; workshop += 1) {
          if (village.resources.metal < 2 || village.resources.wood < 1) break;
          village.resources.metal -= 2;
          village.resources.wood -= 1;
          if ((state.tick / 100 + workshop) % 2 === 0) village.resources.tools += 1;
          else village.resources.equipment += 1;
        }
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
          addEvent(state, 'equipment', `${recipientName}获得了新装备`);
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
      pairVillageFamilies(village.id);
      tryVillageBirth(village, assigned);
      tryLaunchPioneerExpedition(village, assigned);
    }
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
      if (first && second && first.relations[second.id] === DiplomacyState.Peace) {
        setDiplomacy(state, first.id, second.id, DiplomacyState.War);
        addEvent(state, 'war', `${first.name}向${second.name}宣战`);
      }
    }
  };

  const updateWar = (): void => {
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
      const targetCell = findNearestWalkable(state, targetVillage.x, targetVillage.z);
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
        const distance = Math.hypot(
          targetVillage.x - (state.entities.positionsX[entityId] ?? 0),
          targetVillage.z - (state.entities.positionsZ[entityId] ?? 0),
        );
        if (distance <= 2.1) {
          state.entities.states[entityId] = AgentState.Attack;
          const damage = state.entities.enraged[entityId] ? 0.2 : 0.08;
          targetVillage.health = Math.max(0, targetVillage.health - damage);
          const building = state.buildings.find(
            (candidate) => candidate.villageId === targetVillage.id && candidate.health > 0,
          );
          if (building) building.health = Math.max(0, building.health - damage * 0.45);
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
  };

  const step = (): void => {
    state.tick += 1;
    state.year = 1 + Math.floor(state.tick / 720);
    decideResidents();
    processPaths();
    updatePioneerExpeditions();
    moveEntities();
    updateAnimals();
    advanceConstruction(state);
    updateWar();
    if (state.tick % 20 === 0) {
      stepEnvironment(state);
      advanceResourceRegrowth(state.resourceNodes, state.map, state.tick, 96);
      updateEconomy();
      applyEnvironmentDamage(state);
    }
    if (state.tick % 60 === 0) formSettlements();
    if (state.tick % 100 === 0) updateDiplomacy();
    if (state.tick % 800 === 0) updateAnimalEcology();
    if (state.tick % 720 === 0) {
      for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
        if (!state.entities.active[entityId]) continue;
        state.entities.age[entityId] = Math.min(255, (state.entities.age[entityId] ?? 0) + 1);
        if (state.entities.kind[entityId] !== EntityKind.Human) continue;
        const lifespan = 78 + ((state.entities.traits[entityId] ?? 0) % 12);
        if ((state.entities.age[entityId] ?? 0) <= lifespan || state.entities.blessed[entityId])
          continue;
        recordResidentDeath(state, entityId, 'age');
      }
      closePopulationYear(state);
    }
  };

  return { state, step, spawn, ensureVillageAt };
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

function completeEntityAction(state: WorldState, entityId: number, cell: number): void {
  const village = state.villages.find(
    (candidate) => candidate.id === state.entities.villageIds[entityId],
  );
  const currentState = state.entities.states[entityId] as AgentState;
  if (currentState === AgentState.FindFood && harvestGridResource(state.map, cell, 'food')) {
    markMapCellDirty(state.map, cell);
    state.entities.hunger[entityId] = Math.max(0, (state.entities.hunger[entityId] ?? 0) - 620);
    state.entities.states[entityId] = AgentState.Eat;
  }
  if (currentState === AgentState.GatherWood || currentState === AgentState.GatherStone) {
    const nodeId = state.entities.resourceTargetIds[entityId] ?? NO_TARGET;
    if (nodeId !== NO_TARGET && collectResourceForCarrier(state, entityId, nodeId) > 0) {
      state.entities.states[entityId] = AgentState.Home;
    }
    state.entities.resourceTargetIds[entityId] = NO_TARGET;
  }
  if (currentState === AgentState.Home && village) {
    depositCarriedResource(state, entityId);
    state.entities.states[entityId] = AgentState.Haul;
  }
  if (currentState === AgentState.Farm && village) {
    if (state.entities.professions[entityId] === Profession.Forager) {
      village.resources.food += harvestGridResource(state.map, cell, 'food');
    } else {
      village.resources.food += 1;
      state.map.crops[cell] = Math.min(255, (state.map.crops[cell] ?? 0) + 4);
    }
    markMapCellDirty(state.map, cell);
  }
  if (currentState === AgentState.Build) {
    const building = state.buildings.find(
      (candidate) => candidate.villageId === village?.id && !candidate.completed,
    );
    if (building?.constructionPhase === 'clearing') clearConstructionSite(state, building);
    else if (building) applyConstructionWork(state, building, 40);
  }
  if (currentState === AgentState.Haul) {
    const building = state.buildings.find(
      (candidate) =>
        candidate.villageId === village?.id && candidate.constructionPhase === 'delivery',
    );
    if (building) {
      const amount = state.entities.carriedResources[entityId] ?? 0;
      const kind = state.entities.carriedResourceKinds[entityId] as CarriedResourceKind;
      deliverConstructionResources(
        building,
        kind === CarriedResourceKind.Wood ? amount : 0,
        kind === CarriedResourceKind.Stone ? amount : 0,
      );
      state.entities.carriedResources[entityId] = 0;
      state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.None;
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

function planVillageBuilding(state: WorldState, village: Village, completed: number): void {
  const sequence = [
    BuildingType.TownCenter,
    BuildingType.Home,
    BuildingType.Farm,
    BuildingType.Storage,
    BuildingType.Road,
    BuildingType.LoggingCamp,
    BuildingType.Home,
    BuildingType.Mine,
    BuildingType.Workshop,
    BuildingType.Barracks,
    BuildingType.Farm,
    BuildingType.Home,
    BuildingType.Road,
    BuildingType.Watchtower,
    BuildingType.CouncilHall,
    BuildingType.Home,
    BuildingType.Farm,
  ];
  if (completed >= sequence.length) return;
  const type = sequence[completed] ?? BuildingType.Home;
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
  if (type === BuildingType.Mine) {
    const veinId = findNearestAvailableResourceNode(
      state.resourceNodes,
      village.x,
      village.z,
      ResourceNodeKind.Metal,
      state.tick,
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
    state.map.roads[cell] = 1;
    markMapCellDirty(state.map, cell);
    state.map.navigation.cost[cell] = 1;
  }
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

function moveTowardCell(state: WorldState, entityId: number, cell: number, speed: number): void {
  const targetX = (cell % state.map.size) + 0.5;
  const targetZ = Math.floor(cell / state.map.size) + 0.5;
  const dx = targetX - (state.entities.positionsX[entityId] ?? 0);
  const dz = targetZ - (state.entities.positionsZ[entityId] ?? 0);
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const avoidance =
    distance > 0.9 && (state.tick + entityId) % 4 === 0
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
  state.entities.positionsX[entityId] += (directionX / directionLength) * Math.min(speed, distance);
  state.entities.positionsZ[entityId] += (directionZ / directionLength) * Math.min(speed, distance);
  state.entities.headings[entityId] = Math.atan2(dx, dz);
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
    const hungry = (state.entities.hunger[entityId] ?? 0) >= 990;
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
    } else if (!hungry) {
      state.entities.malnutrition[entityId] = Math.max(
        0,
        (state.entities.malnutrition[entityId] ?? 0) - 10,
      );
    }
    if ((state.entities.health[entityId] ?? 0) !== 0) continue;
    if (state.entities.kind[entityId] !== EntityKind.Human) {
      state.entities.active[entityId] = 0;
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
