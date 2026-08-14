import { z } from 'zod';
import type {
  AnimalCarcass,
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
  WorldSettings,
  WorldState,
} from '@/shared/gameTypes';
import { navigationCostForTerrain } from '../map/generateWorldMap';
import { createNavigationGrid } from '../navigation/grid';
import { addResourceNode, createResourceNodeStore } from '../resources/resourceNodes';
import { WORLD_LAW_IDS, type WorldLawId } from '../rules/worldLawCatalog';

export const SAVE_VERSION = 12;

const worldLawSchema = z
  .object(
    Object.fromEntries(WORLD_LAW_IDS.map((law) => [law, z.boolean()])) as Record<
      WorldLawId,
      z.ZodBoolean
    >,
  )
  .strict();

const numberArray = z.array(z.number());
const resourcesSchema = z
  .object({
    food: z.number().nonnegative(),
    wood: z.number().nonnegative(),
    stone: z.number().nonnegative(),
    metal: z.number().nonnegative(),
    gold: z.number().nonnegative(),
    tools: z.number().nonnegative(),
    equipment: z.number().nonnegative(),
  })
  .strict();
const buildingSchema = z
  .object({
    id: z.number().int().positive(),
    villageId: z.number().int().positive(),
    type: z.number().int().min(0).max(11),
    x: z.number(),
    z: z.number(),
    stage: z.number().int().min(0).max(2),
    progress: z.number().nonnegative(),
    requiredProgress: z.number().positive(),
    health: z.number().nonnegative(),
    completed: z.boolean(),
    constructionPhase: z.enum(['clearing', 'delivery', 'building', 'complete']),
    reservedWood: z.number().nonnegative(),
    reservedStone: z.number().nonnegative(),
    deliveredWood: z.number().nonnegative(),
    deliveredStone: z.number().nonnegative(),
    inTransitWood: z.number().nonnegative(),
    inTransitStone: z.number().nonnegative(),
    clearNodeIds: z.array(z.number().int().nonnegative()),
    assignedWorkerIds: z.array(z.number().int().nonnegative()),
    workSlots: z.number().int().nonnegative(),
  })
  .strict();
const animalCarcassSchema = z
  .object({
    id: z.number().int().positive(),
    sourceKind: z.number().int().min(1).max(7),
    deathCause: z.enum(['age', 'hunger', 'predation', 'hunting', 'disease', 'disaster']),
    x: z.number(),
    z: z.number(),
    meatRemaining: z.number().int().nonnegative(),
    createdAtTick: z.number().int().nonnegative(),
    decayAtTick: z.number().int().nonnegative(),
    reservedByEntityId: z.number().int().nonnegative().nullable(),
    reservedUntilTick: z.number().int().nonnegative(),
  })
  .strict();
const villageSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    x: z.number(),
    z: z.number(),
    population: z.number().int().nonnegative(),
    tier: z.number().int().min(0).max(3),
    health: z.number().nonnegative(),
    resources: resourcesSchema,
    storageCapacity: z.number().nonnegative(),
    storageCapacityByKind: resourcesSchema,
    outdoorStockpile: resourcesSchema,
    outdoorSinceTicks: resourcesSchema,
    housingCapacity: z.number().int().nonnegative(),
    campHousingCapacity: z.number().int().nonnegative(),
    operationsInitialized: z.boolean(),
    kingdomId: z.number().int().nonnegative(),
    buildingIds: z.array(z.number().int().positive()),
    foundedAtTick: z.number().int().nonnegative(),
    carryingCapacity: z.number().nonnegative(),
    foodProduction: z.number(),
    foodProducedSinceUpdate: z.number().nonnegative(),
    foodConsumption: z.number().nonnegative(),
    foodTrend: z.number(),
    shortageTicks: z.number().int().nonnegative(),
    peakPopulation: z.number().int().nonnegative(),
    lastRecordedPopulationPeak: z.number().int().nonnegative(),
    lastShortageStage: z.enum(['stable', 'rationing', 'migration', 'famine']),
    abandonedAtTick: z.number().int().nonnegative(),
    lastBirthTick: z.number().int().nonnegative(),
    pioneerReadyAtTick: z.number().int().nonnegative(),
    constructionPriority: z.enum([
      'automatic',
      'housing',
      'storage',
      'food',
      'production',
      'defense',
    ]),
    constructionDecision: z.string(),
    constructionOverrideReason: z.string(),
    captureKingdomId: z.number().int().nonnegative().optional(),
    captureProgress: z.number().nonnegative().optional(),
  })
  .strict();
const kingdomSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    color: z.string(),
    leaderId: z.number().int().nonnegative(),
    capitalVillageId: z.number().int().nonnegative(),
    villageIds: z.array(z.number().int().positive()),
    relations: z.record(z.string(), z.number().int().min(0).max(2)),
    militaryPower: z.number().nonnegative(),
    extinct: z.boolean(),
    foundedAtTick: z.number().int().nonnegative(),
  })
  .strict();
const residentTaskSchema = z
  .object({
    id: z.number().int().positive(),
    type: z.enum([
      'idle',
      'eat',
      'sleep',
      'gather',
      'haul',
      'build',
      'farm',
      'craft',
      'flee',
      'guard',
      'hunt',
      'butcher',
      'fish',
    ]),
    reason: z.enum([
      'none',
      'hunger',
      'critical-hunger',
      'fatigue',
      'critical-fatigue',
      'danger',
      'village-needs-food',
      'village-needs-wood',
      'village-needs-stone',
      'village-needs-metal',
      'village-needs-tools',
      'village-needs-equipment',
      'village-needs-housing',
      'village-construction',
      'professional-duty',
    ]),
    phase: z.enum([
      'reserved',
      'travel',
      'pickup',
      'work',
      'delivery',
      'complete',
      'suspended',
      'failed',
    ]),
    targetKind: z.enum([
      'none',
      'cell',
      'resource-node',
      'building',
      'village',
      'entity',
      'carcass',
    ]),
    targetId: z.number().int().nonnegative(),
    targetCell: z.number().int().nonnegative(),
    progress: z.number().nonnegative(),
    requiredProgress: z.number().nonnegative(),
    leaseUntilTick: z.number().int().nonnegative(),
    suspendedUntilTick: z.number().int().nonnegative(),
    startedAtTick: z.number().int().nonnegative(),
    finishedAtTick: z.number().int().nonnegative(),
    failureReason: z.string().nullable(),
    suspensionReason: z
      .enum([
        'none',
        'hunger',
        'critical-hunger',
        'fatigue',
        'critical-fatigue',
        'danger',
        'village-needs-food',
        'village-needs-wood',
        'village-needs-stone',
        'village-needs-metal',
        'village-needs-tools',
        'village-needs-equipment',
        'village-needs-housing',
        'village-construction',
        'professional-duty',
      ])
      .nullable(),
    expectedResult: z.string(),
  })
  .strict();

const worldHistorySubjectSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('entity'), lifeId: z.number().int().positive(), label: z.string() })
    .strict(),
  z
    .object({ kind: z.literal('village'), id: z.number().int().positive(), label: z.string() })
    .strict(),
  z
    .object({ kind: z.literal('kingdom'), id: z.number().int().positive(), label: z.string() })
    .strict(),
  z.object({ kind: z.literal('war'), warId: z.string().min(1), label: z.string() }).strict(),
  z
    .object({
      kind: z.literal('location'),
      cell: z.number().int().nonnegative(),
      label: z.string(),
    })
    .strict(),
]);

const worldEventSchema = z
  .object({
    id: z.number().int().positive(),
    tick: z.number().int().nonnegative(),
    kind: z.enum([
      'birth',
      'village',
      'village-founded',
      'village-upgrade',
      'village-abandoned',
      'village-merged',
      'population-peak',
      'family',
      'migration',
      'famine',
      'kingdom',
      'kingdom-founded',
      'kingdom-extinct',
      'war',
      'peace',
      'disaster',
      'construction',
      'extinction',
      'promotion',
      'death',
      'equipment',
      'ecology',
      'law',
      'awakening',
      'conquest',
    ]),
    category: z.enum(['world', 'kingdom', 'village', 'population', 'ecology', 'disaster']),
    message: z.string(),
    archive: z.boolean(),
    notification: z.boolean(),
    subjects: z.array(worldHistorySubjectSchema),
  })
  .strict();

const saveSchema = z
  .object({
    version: z.literal(SAVE_VERSION),
    seed: z.string().min(1),
    tick: z.number().int().nonnegative(),
    year: z.number().int().positive(),
    map: z
      .object({
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
      })
      .strict(),
    resourceNodes: z
      .object({
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
          z
            .object({
              tick: z.number().int().nonnegative(),
              nodeId: z.number().int().nonnegative(),
              stage: z.number().int().nonnegative(),
            })
            .strict(),
        ),
      })
      .strict(),
    territory: z
      .object({
        villageIds: numberArray,
        claimStrength: numberArray,
        planningZoneKinds: numberArray,
        revision: z.number().int().nonnegative(),
      })
      .strict(),
    entities: z
      .object({
        capacity: z.number().int().positive(),
        count: z.number().int().nonnegative(),
        lifeIds: numberArray,
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
        homeBuildingIds: numberArray,
        workBuildingIds: numberArray,
        names: z.array(z.string()),
        tasks: z.array(residentTaskSchema.nullable()),
        suspendedTasks: z.array(residentTaskSchema.nullable()),
      })
      .strict(),
    villages: z.array(villageSchema),
    kingdoms: z.array(kingdomSchema),
    buildings: z.array(buildingSchema),
    carcasses: z.array(animalCarcassSchema),
    nextCarcassId: z.number().int().nonnegative(),
    settings: z.unknown(),
    events: z.array(worldEventSchema),
    favoriteLifeIds: z.array(z.number().int().positive()),
    nextRequestId: z.number().int().nonnegative(),
    nextTaskId: z.number().int().nonnegative(),
    nextEventId: z.number().int().nonnegative(),
    nextLifeId: z.number().int().nonnegative(),
    forcedPeaceUntil: z.number().int().nonnegative(),
    population: z.unknown(),
    worldLaws: worldLawSchema,
    ecology: z.unknown(),
    humanExtinctSinceTick: z.number().int().nonnegative(),
    wars: z.array(z.unknown()),
    truces: z.array(z.unknown()),
    expeditions: z.array(z.unknown()),
    nextFamilyId: z.number().int().nonnegative(),
    nextExpeditionId: z.number().int().nonnegative(),
  })
  .strict();

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
    territory: {
      villageIds: values(state.territory.villageIds),
      claimStrength: values(state.territory.claimStrength),
      planningZoneKinds: values(state.territory.planningZoneKinds),
      revision: state.territory.revision,
    },
    entities: {
      capacity: state.entities.capacity,
      count: entityCount,
      lifeIds: values(state.entities.lifeIds, entityCount),
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
      homeBuildingIds: values(state.entities.homeBuildingIds, entityCount),
      workBuildingIds: values(state.entities.workBuildingIds, entityCount),
      names: state.entities.names.slice(0, entityCount),
      tasks: state.entities.tasks.slice(0, entityCount),
      suspendedTasks: state.entities.suspendedTasks.slice(0, entityCount),
    },
    villages: state.villages,
    kingdoms: state.kingdoms,
    buildings: state.buildings,
    carcasses: state.carcasses,
    nextCarcassId: state.nextCarcassId,
    settings: state.settings,
    events: state.events,
    favoriteLifeIds: state.favoriteLifeIds,
    nextRequestId: state.nextRequestId,
    nextTaskId: state.nextTaskId,
    nextEventId: state.nextEventId,
    nextLifeId: state.nextLifeId,
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
  if (
    save.territory.villageIds.length !== expectedCells ||
    save.territory.claimStrength.length !== expectedCells ||
    save.territory.planningZoneKinds.length !== expectedCells
  ) {
    throw new Error('存档损坏：领土地图尺寸不匹配');
  }
  const navigation = createNavigationGrid(save.map.size, save.map.size);
  const terrain = Uint8Array.from(save.map.terrain);
  const roads = Uint8Array.from(save.map.roads);
  for (let cell = 0; cell < expectedCells; cell += 1) {
    navigation.cost[cell] = navigationCostForTerrain(terrain[cell] ?? 0, roads[cell] > 0);
  }
  const capacity = Math.max(save.entities.capacity, save.entities.count, MAX_SAVE_ENTITIES);
  const entityLists = [
    save.entities.lifeIds,
    save.entities.active,
    save.entities.kind,
    save.entities.positionsX,
    save.entities.positionsZ,
    save.entities.headings,
    save.entities.health,
    save.entities.hunger,
    save.entities.energy,
    save.entities.age,
    save.entities.sex,
    save.entities.familyIds,
    save.entities.partnerIds,
    save.entities.parentAIds,
    save.entities.parentBIds,
    save.entities.lastBirthTicks,
    save.entities.malnutrition,
    save.entities.expeditionIds,
    save.entities.states,
    save.entities.professions,
    save.entities.villageIds,
    save.entities.kingdomIds,
    save.entities.targetCells,
    save.entities.traits,
    save.entities.speed,
    save.entities.infected,
    save.entities.blessed,
    save.entities.enraged,
    save.entities.experience,
    save.entities.contribution,
    save.entities.levels,
    save.entities.roles,
    save.entities.weaponTiers,
    save.entities.armorTiers,
    save.entities.carriedResourceKinds,
    save.entities.carriedResources,
    save.entities.resourceTargetIds,
    save.entities.homeBuildingIds,
    save.entities.workBuildingIds,
    save.entities.names,
    save.entities.tasks,
    save.entities.suspendedTasks,
  ];
  if (
    save.entities.count > save.entities.capacity ||
    entityLists.some((list) => list.length !== save.entities.count)
  ) {
    throw new Error('存档损坏：实体数组尺寸不匹配');
  }
  const uniqueLifeIds = new Set(save.entities.lifeIds);
  const maximumLifeId = Math.max(0, ...save.entities.lifeIds);
  if (
    uniqueLifeIds.size !== save.entities.lifeIds.length ||
    save.entities.lifeIds.some((lifeId) => lifeId <= 0) ||
    save.nextLifeId < maximumLifeId
  ) {
    throw new Error('存档损坏：人物生命标识无效');
  }
  const eventIds = new Set(save.events.map((event) => event.id));
  if (
    eventIds.size !== save.events.length ||
    save.events.some((event) => event.id > save.nextEventId)
  ) {
    throw new Error('存档损坏：历史事件标识无效');
  }
  const carcassIds = new Set(save.carcasses.map((carcass) => carcass.id));
  if (
    carcassIds.size !== save.carcasses.length ||
    save.carcasses.some((carcass) => carcass.id > save.nextCarcassId)
  ) {
    throw new Error('存档损坏：动物尸体标识无效');
  }
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
    territory: {
      villageIds: Uint16Array.from(save.territory.villageIds),
      claimStrength: Uint8Array.from(save.territory.claimStrength),
      planningZoneKinds: Uint8Array.from(save.territory.planningZoneKinds),
      dirtyCells: [],
      revision: save.territory.revision,
    },
    entities,
    villages: save.villages as Village[],
    kingdoms: save.kingdoms as Kingdom[],
    buildings: save.buildings as Building[],
    carcasses: save.carcasses as AnimalCarcass[],
    nextCarcassId: save.nextCarcassId,
    settings: save.settings as WorldSettings,
    events: save.events as WorldEvent[],
    favoriteLifeIds: save.favoriteLifeIds,
    nextRequestId: save.nextRequestId,
    nextTaskId: save.nextTaskId,
    nextEventId: save.nextEventId,
    nextLifeId: save.nextLifeId,
    forcedPeaceUntil: save.forcedPeaceUntil,
    population: save.population as PopulationDiagnostics,
    worldLaws: save.worldLaws,
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
    lifeIds: makeUint32(save.entities.lifeIds),
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
    homeBuildingIds: makeUint32(save.entities.homeBuildingIds),
    workBuildingIds: makeUint32(save.entities.workBuildingIds),
    names: [...save.entities.names],
    tasks: [
      ...save.entities.tasks,
      ...Array.from({ length: capacity - save.entities.tasks.length }, () => null),
    ],
    suspendedTasks: [
      ...save.entities.suspendedTasks,
      ...Array.from({ length: capacity - save.entities.suspendedTasks.length }, () => null),
    ],
    paths: Array.from({ length: capacity }, () => null),
  };
}
