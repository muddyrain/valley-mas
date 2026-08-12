import { z } from 'zod';
import type {
  Building,
  EcologyDiagnostics,
  EntityArrays,
  Kingdom,
  PioneerExpedition,
  PopulationDiagnostics,
  ResourceNodeKind,
  ResourceNodeStage,
  TruceRecord,
  Village,
  WarCampaign,
  WorldEvent,
  WorldLaws,
  WorldSettings,
  WorldState,
} from '@/shared/gameTypes';
import { navigationCostForTerrain } from '../map/generateWorldMap';
import { createNavigationGrid } from '../navigation/grid';
import { addResourceNode, createResourceNodeStore } from '../resources/resourceNodes';

export const SAVE_VERSION = 5;

const numberArray = z.array(z.number());
const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  seed: z.string().min(1),
  tick: z.number().int().nonnegative(),
  year: z.number().int().positive(),
  map: z.object({
    size: z.number().int().min(16).max(768),
    preset: z.enum(['archipelago', 'continent', 'ocean']),
    terrain: numberArray,
    height: numberArray,
    moisture: numberArray,
    temperature: numberArray,
    resourceFood: numberArray,
    fire: numberArray,
    rain: numberArray,
    plague: numberArray,
    crops: numberArray,
    craters: numberArray,
    roads: numberArray,
    chunkVersions: numberArray,
    mapVersion: z.number().int().nonnegative(),
  }),
  resourceNodes: z.object({
    chunkSize: z.number().int().positive(),
    count: z.number().int().nonnegative(),
    active: numberArray,
    kind: numberArray,
    positionsX: numberArray,
    positionsZ: numberArray,
    amount: numberArray,
    maxAmount: numberArray,
    stage: numberArray,
    variant: numberArray,
    reservedBy: numberArray,
    reservedUntil: numberArray,
    regrowAtTick: numberArray,
    regrowthQueue: z.array(
      z.object({
        tick: z.number().int().nonnegative(),
        nodeId: z.number().int().nonnegative(),
        stage: z.number().int().nonnegative(),
      }),
    ),
  }),
  entities: z.object({
    capacity: z.number().int().positive(),
    count: z.number().int().nonnegative(),
    active: numberArray,
    kind: numberArray,
    positionsX: numberArray,
    positionsZ: numberArray,
    headings: numberArray,
    health: numberArray,
    hunger: numberArray,
    energy: numberArray,
    age: numberArray,
    sex: numberArray,
    familyIds: numberArray,
    partnerIds: numberArray,
    parentAIds: numberArray,
    parentBIds: numberArray,
    lastBirthTicks: numberArray,
    malnutrition: numberArray,
    expeditionIds: numberArray,
    states: numberArray,
    professions: numberArray,
    villageIds: numberArray,
    kingdomIds: numberArray,
    targetCells: numberArray,
    traits: numberArray,
    speed: numberArray,
    infected: numberArray,
    blessed: numberArray,
    enraged: numberArray,
    experience: numberArray,
    contribution: numberArray,
    levels: numberArray,
    roles: numberArray,
    weaponTiers: numberArray,
    armorTiers: numberArray,
    carriedResourceKinds: numberArray,
    carriedResources: numberArray,
    resourceTargetIds: numberArray,
    names: z.array(z.string()),
  }),
  villages: z.array(z.unknown()),
  kingdoms: z.array(z.unknown()),
  buildings: z.array(z.unknown()),
  settings: z.unknown(),
  events: z.array(z.unknown()),
  nextRequestId: z.number().int().nonnegative(),
  nextEventId: z.number().int().nonnegative(),
  forcedPeaceUntil: z.number().int().nonnegative(),
  population: z.unknown(),
  worldLaws: z.unknown(),
  ecology: z.unknown(),
  humanExtinctSinceTick: z.number().int().nonnegative(),
  wars: z.array(z.unknown()),
  truces: z.array(z.unknown()),
  expeditions: z.array(z.unknown()),
  nextFamilyId: z.number().int().nonnegative(),
  nextExpeditionId: z.number().int().nonnegative(),
});

type ParsedSave = z.infer<typeof saveSchema>;

function values(array: ArrayLike<number>, count?: number): number[] {
  return Array.from(count === undefined ? array : Array.prototype.slice.call(array, 0, count));
}

export function serializeWorld(state: WorldState): string {
  const entityCount = state.entities.count;
  return JSON.stringify({
    version: SAVE_VERSION,
    seed: state.seed,
    tick: state.tick,
    year: state.year,
    map: {
      size: state.map.size,
      preset: state.map.preset,
      terrain: values(state.map.terrain),
      height: values(state.map.height),
      moisture: values(state.map.moisture),
      temperature: values(state.map.temperature),
      resourceFood: values(state.map.resourceFood),
      fire: values(state.map.fire),
      rain: values(state.map.rain),
      plague: values(state.map.plague),
      crops: values(state.map.crops),
      craters: values(state.map.craters),
      roads: values(state.map.roads),
      chunkVersions: values(state.map.navigation.chunkVersions),
      mapVersion: state.map.navigation.mapVersion,
    },
    resourceNodes: {
      chunkSize: state.resourceNodes.chunkSize,
      count: state.resourceNodes.count,
      active: values(state.resourceNodes.active, state.resourceNodes.count),
      kind: values(state.resourceNodes.kind, state.resourceNodes.count),
      positionsX: values(state.resourceNodes.positionsX, state.resourceNodes.count),
      positionsZ: values(state.resourceNodes.positionsZ, state.resourceNodes.count),
      amount: values(state.resourceNodes.amount, state.resourceNodes.count),
      maxAmount: values(state.resourceNodes.maxAmount, state.resourceNodes.count),
      stage: values(state.resourceNodes.stage, state.resourceNodes.count),
      variant: values(state.resourceNodes.variant, state.resourceNodes.count),
      reservedBy: values(state.resourceNodes.reservedBy, state.resourceNodes.count),
      reservedUntil: values(state.resourceNodes.reservedUntil, state.resourceNodes.count),
      regrowAtTick: values(state.resourceNodes.regrowAtTick, state.resourceNodes.count),
      regrowthQueue: state.resourceNodes.regrowthQueue,
    },
    entities: {
      capacity: state.entities.capacity,
      count: entityCount,
      active: values(state.entities.active, entityCount),
      kind: values(state.entities.kind, entityCount),
      positionsX: values(state.entities.positionsX, entityCount),
      positionsZ: values(state.entities.positionsZ, entityCount),
      headings: values(state.entities.headings, entityCount),
      health: values(state.entities.health, entityCount),
      hunger: values(state.entities.hunger, entityCount),
      energy: values(state.entities.energy, entityCount),
      age: values(state.entities.age, entityCount),
      sex: values(state.entities.sex, entityCount),
      familyIds: values(state.entities.familyIds, entityCount),
      partnerIds: values(state.entities.partnerIds, entityCount),
      parentAIds: values(state.entities.parentAIds, entityCount),
      parentBIds: values(state.entities.parentBIds, entityCount),
      lastBirthTicks: values(state.entities.lastBirthTicks, entityCount),
      malnutrition: values(state.entities.malnutrition, entityCount),
      expeditionIds: values(state.entities.expeditionIds, entityCount),
      states: values(state.entities.states, entityCount),
      professions: values(state.entities.professions, entityCount),
      villageIds: values(state.entities.villageIds, entityCount),
      kingdomIds: values(state.entities.kingdomIds, entityCount),
      targetCells: values(state.entities.targetCells, entityCount),
      traits: values(state.entities.traits, entityCount),
      speed: values(state.entities.speed, entityCount),
      infected: values(state.entities.infected, entityCount),
      blessed: values(state.entities.blessed, entityCount),
      enraged: values(state.entities.enraged, entityCount),
      experience: values(state.entities.experience, entityCount),
      contribution: values(state.entities.contribution, entityCount),
      levels: values(state.entities.levels, entityCount),
      roles: values(state.entities.roles, entityCount),
      weaponTiers: values(state.entities.weaponTiers, entityCount),
      armorTiers: values(state.entities.armorTiers, entityCount),
      carriedResourceKinds: values(state.entities.carriedResourceKinds, entityCount),
      carriedResources: values(state.entities.carriedResources, entityCount),
      resourceTargetIds: values(state.entities.resourceTargetIds, entityCount),
      names: state.entities.names.slice(0, entityCount),
    },
    villages: state.villages,
    kingdoms: state.kingdoms,
    buildings: state.buildings,
    settings: state.settings,
    events: state.events,
    nextRequestId: state.nextRequestId,
    nextEventId: state.nextEventId,
    forcedPeaceUntil: state.forcedPeaceUntil,
    population: state.population,
    worldLaws: state.worldLaws,
    ecology: state.ecology,
    humanExtinctSinceTick: state.humanExtinctSinceTick,
    wars: state.wars,
    truces: state.truces,
    expeditions: state.expeditions,
    nextFamilyId: state.nextFamilyId,
    nextExpeditionId: state.nextExpeditionId,
  });
}

export function loadWorldSave(encoded: string): WorldState {
  let raw: unknown;
  try {
    raw = JSON.parse(encoded);
  } catch {
    throw new Error('存档损坏：无法解析数据');
  }
  if (typeof raw === 'object' && raw && 'version' in raw && raw.version !== SAVE_VERSION) {
    throw new Error(`存档版本不受支持：${String(raw.version)}`);
  }
  const result = saveSchema.safeParse(raw);
  if (!result.success) throw new Error('存档损坏：数据校验失败');
  return restoreWorld(result.data);
}

function restoreWorld(save: ParsedSave): WorldState {
  const expectedCells = save.map.size * save.map.size;
  if (save.map.terrain.length !== expectedCells || save.map.height.length !== expectedCells) {
    throw new Error('存档损坏：地图尺寸不匹配');
  }
  const navigation = createNavigationGrid(save.map.size, save.map.size);
  const terrain = Uint8Array.from(save.map.terrain);
  const roads = Uint8Array.from(save.map.roads);
  for (let cell = 0; cell < expectedCells; cell += 1) {
    navigation.cost[cell] = navigationCostForTerrain(terrain[cell] ?? 0, roads[cell] > 0);
  }
  navigation.chunkVersions.set(save.map.chunkVersions.slice(0, navigation.chunkVersions.length));
  navigation.mapVersion = save.map.mapVersion;
  const capacity = Math.max(save.entities.capacity, save.entities.count, MAX_SAVE_ENTITIES);
  const entities = restoreEntities(save, capacity);
  const resourceNodes = createResourceNodeStore(save.map.size, save.resourceNodes.chunkSize);
  for (let nodeId = 0; nodeId < save.resourceNodes.count; nodeId += 1) {
    const restoredNodeId = addResourceNode(resourceNodes, {
      kind: (save.resourceNodes.kind[nodeId] ?? 0) as ResourceNodeKind,
      x: save.resourceNodes.positionsX[nodeId] ?? 0,
      z: save.resourceNodes.positionsZ[nodeId] ?? 0,
      amount: save.resourceNodes.amount[nodeId] ?? 0,
      stage: (save.resourceNodes.stage[nodeId] ?? 0) as ResourceNodeStage,
      variant: save.resourceNodes.variant[nodeId] ?? 0,
    });
    resourceNodes.active[restoredNodeId] = save.resourceNodes.active[nodeId] ?? 0;
    resourceNodes.maxAmount[restoredNodeId] = save.resourceNodes.maxAmount[nodeId] ?? 0;
    resourceNodes.reservedBy[restoredNodeId] = save.resourceNodes.reservedBy[nodeId] ?? 0;
    resourceNodes.reservedUntil[restoredNodeId] = save.resourceNodes.reservedUntil[nodeId] ?? 0;
    resourceNodes.regrowAtTick[restoredNodeId] = save.resourceNodes.regrowAtTick[nodeId] ?? 0;
  }
  resourceNodes.dirtyNodeIds.length = 0;
  resourceNodes.chunkRevisions.fill(0);
  resourceNodes.regrowthQueue = save.resourceNodes.regrowthQueue.map((event) => ({
    tick: event.tick,
    nodeId: event.nodeId,
    stage: event.stage as ResourceNodeStage,
  }));
  return {
    version: SAVE_VERSION,
    seed: save.seed,
    tick: save.tick,
    year: save.year,
    map: {
      size: save.map.size,
      preset: save.map.preset,
      terrain,
      height: Float32Array.from(save.map.height),
      moisture: Uint8Array.from(save.map.moisture),
      temperature: Uint8Array.from(save.map.temperature),
      resourceFood: Uint16Array.from(save.map.resourceFood),
      resourceWood: new Uint16Array(expectedCells),
      resourceStone: new Uint16Array(expectedCells),
      fire: Uint8Array.from(save.map.fire),
      rain: Uint8Array.from(save.map.rain),
      plague: Uint8Array.from(save.map.plague),
      crops: Uint8Array.from(save.map.crops),
      craters: Uint8Array.from(save.map.craters),
      roads,
      navigation,
      dirtyMapCells: [],
    },
    resourceNodes,
    entities,
    villages: save.villages as Village[],
    kingdoms: save.kingdoms as Kingdom[],
    buildings: save.buildings as Building[],
    settings: save.settings as WorldSettings,
    events: save.events as WorldEvent[],
    nextRequestId: save.nextRequestId,
    nextEventId: save.nextEventId,
    forcedPeaceUntil: save.forcedPeaceUntil,
    population: save.population as PopulationDiagnostics,
    worldLaws: save.worldLaws as WorldLaws,
    ecology: save.ecology as EcologyDiagnostics,
    humanExtinctSinceTick: save.humanExtinctSinceTick,
    wars: save.wars as WarCampaign[],
    truces: save.truces as TruceRecord[],
    expeditions: save.expeditions as PioneerExpedition[],
    nextFamilyId: save.nextFamilyId,
    nextExpeditionId: save.nextExpeditionId,
  };
}

const MAX_SAVE_ENTITIES = 1_200;

function restoreEntities(save: ParsedSave, capacity: number): EntityArrays {
  const makeUint8 = (source: number[]) =>
    Object.assign(new Uint8Array(capacity), Uint8Array.from(source));
  const makeUint16 = (source: number[]) =>
    Object.assign(new Uint16Array(capacity), Uint16Array.from(source));
  const makeUint32 = (source: number[]) =>
    Object.assign(new Uint32Array(capacity), Uint32Array.from(source));
  const makeFloat32 = (source: number[]) =>
    Object.assign(new Float32Array(capacity), Float32Array.from(source));
  return {
    capacity,
    count: save.entities.count,
    active: makeUint8(save.entities.active),
    kind: makeUint8(save.entities.kind),
    positionsX: makeFloat32(save.entities.positionsX),
    positionsZ: makeFloat32(save.entities.positionsZ),
    headings: makeFloat32(save.entities.headings),
    health: makeUint16(save.entities.health),
    hunger: makeUint16(save.entities.hunger),
    energy: makeUint16(save.entities.energy),
    age: makeUint16(save.entities.age),
    sex: makeUint8(save.entities.sex),
    familyIds: makeUint32(save.entities.familyIds),
    partnerIds: makeUint32(save.entities.partnerIds),
    parentAIds: makeUint32(save.entities.parentAIds),
    parentBIds: makeUint32(save.entities.parentBIds),
    lastBirthTicks: makeUint32(save.entities.lastBirthTicks),
    malnutrition: makeUint16(save.entities.malnutrition),
    expeditionIds: makeUint16(save.entities.expeditionIds),
    states: makeUint8(save.entities.states),
    professions: makeUint8(save.entities.professions),
    villageIds: makeUint16(save.entities.villageIds),
    kingdomIds: makeUint16(save.entities.kingdomIds),
    targetCells: makeUint32(save.entities.targetCells),
    traits: makeUint8(save.entities.traits),
    speed: makeFloat32(save.entities.speed),
    infected: makeUint8(save.entities.infected),
    blessed: makeUint16(save.entities.blessed),
    enraged: makeUint16(save.entities.enraged),
    experience: makeUint32(save.entities.experience),
    contribution: makeUint32(save.entities.contribution),
    levels: makeUint8(save.entities.levels),
    roles: makeUint8(save.entities.roles),
    weaponTiers: makeUint8(save.entities.weaponTiers),
    armorTiers: makeUint8(save.entities.armorTiers),
    carriedResourceKinds: makeUint8(save.entities.carriedResourceKinds),
    carriedResources: makeUint8(save.entities.carriedResources),
    resourceTargetIds: makeUint32(save.entities.resourceTargetIds),
    names: [...save.entities.names],
    paths: Array.from({ length: capacity }, () => null),
  };
}
