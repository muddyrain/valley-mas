import type {
  Inspection,
  ResourceNodeSnapshot,
  TerritorySnapshot,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from '@/render/renderTypes';
import {
  AgentState,
  BuildingType,
  CarriedResourceKind,
  type EcologyDiagnostics,
  EntityKind,
  type PopulationDiagnostics,
  Profession,
  ResidentRole,
  ResourceNodeKind,
  ResourceNodeStage,
  TerrainType,
  type Village,
  VillageTier,
} from '@/shared/gameTypes';
import type { SimulationKernel } from '@/simulation/kernel/kernel';
import type { HumanLifeFact } from '@/simulation/life/lifeFacts';
import { NaturalResourceKind, NaturalResourceStage } from '@/simulation/resources/naturalResources';
import { createDefaultWorldLaws } from '@/simulation/rules/worldLawCatalog';
import {
  deriveSettlementCapabilities,
  settlementHousingCapacity,
} from '@/simulation/settlements/construction';
import type { SettlementBuildingFact } from '@/simulation/settlements/settlementFacts';
import type { HumanTaskFact, HumanTaskFailureCode } from '@/simulation/tasks/taskFacts';
import { ElevationBand, elevationBandAt, SurfaceHabitat } from '@/simulation/world/worldFacts';

export interface KernelProjectionMetrics {
  tickMs: number;
  averageTickMs: number;
}

function terrainAt(elevation: number, surface: SurfaceHabitat): TerrainType {
  const band = elevationBandAt(elevation);
  if (band === ElevationBand.DeepOcean) return TerrainType.DeepOcean;
  if (band === ElevationBand.ShallowWater) return TerrainType.ShallowOcean;
  if (band === ElevationBand.Mountain) return TerrainType.Mountain;
  if (surface === SurfaceHabitat.Sand) return TerrainType.Beach;
  if (surface === SurfaceHabitat.WoodlandSoil) return TerrainType.Forest;
  if (surface === SurfaceHabitat.Desert) return TerrainType.Desert;
  if (surface === SurfaceHabitat.Snow) return TerrainType.Snow;
  return TerrainType.Grass;
}

function emptyPopulationDiagnostics(): PopulationDiagnostics {
  const causes = { age: 0, hunger: 0, disease: 0, violence: 0, disaster: 0 };
  return {
    totalBirths: 0,
    totalDeaths: 0,
    totalMigrations: 0,
    birthsThisYear: 0,
    deathsThisYear: 0,
    migrationsThisYear: 0,
    birthsLastYear: 0,
    deathsLastYear: 0,
    migrationsLastYear: 0,
    deathCauses: { ...causes },
    deathCausesThisYear: { ...causes },
    carryingCapacity: 0,
    housingCapacity: 0,
    storedFood: 0,
    children: 0,
    adults: 0,
    elders: 0,
    trend: 0,
    history: [],
  };
}

function emptyEcologyDiagnostics(): EcologyDiagnostics {
  const species = Array.from({ length: 8 }, (_, kind) => ({
    kind,
    count: 0,
    capacity: 0,
    status: 'not-introduced' as const,
    everPresent: false,
    lastReturnTick: 0,
    births: 0,
    deaths: 0,
    deathCauses: {
      age: 0,
      hunger: 0,
      predation: 0,
      hunting: 0,
      disease: 0,
      disaster: 0,
    },
  }));
  return {
    animals: 0,
    carcasses: 0,
    butcheredMeat: 0,
    fishCaught: 0,
    carcassesDecayed: 0,
    species,
    nextReturnTicks: Array.from({ length: 8 }, () => 0),
    extinctSinceTicks: Array.from({ length: 8 }, () => 0),
  };
}

export function projectKernelMap(kernel: SimulationKernel): WorldMapSnapshot {
  const world = kernel.state.world;
  const cellCount = world.size * world.size;
  const terrain = new Uint8Array(cellCount);
  const resourceFood = new Uint16Array(cellCount);
  for (let cell = 0; cell < cellCount; cell += 1) {
    terrain[cell] = terrainAt(world.elevation[cell] ?? -4, world.surface[cell] as SurfaceHabitat);
  }
  for (let id = 0; id < kernel.state.resources.count; id += 1) {
    if (
      !kernel.state.resources.active[id] ||
      kernel.state.resources.kind[id] !== NaturalResourceKind.WildFood
    ) {
      continue;
    }
    const cell = kernel.state.resources.cell[id] ?? 0;
    resourceFood[cell] = kernel.state.resources.amount[id] ?? 0;
  }
  return {
    size: world.size,
    preset: world.preset,
    terrain,
    height: world.elevation.slice(),
    moisture: world.moisture.slice(),
    temperature: world.temperature.slice(),
    resourceFood,
    fire: new Uint8Array(cellCount),
    rain: new Uint8Array(cellCount),
    plague: new Uint8Array(cellCount),
    crops: new Uint8Array(cellCount),
    craters: new Uint8Array(cellCount),
    roads: new Uint8Array(cellCount),
    changedChunks: [],
    fullRebuild: true,
  };
}

function projectKernelResourceIds(
  kernel: SimulationKernel,
  nodeIds: Uint32Array,
  full: boolean,
): ResourceNodeSnapshot {
  const resources = kernel.state.resources;
  const active = new Uint8Array(nodeIds.length);
  const kind = new Uint8Array(nodeIds.length);
  const positionsX = new Float32Array(nodeIds.length);
  const positionsZ = new Float32Array(nodeIds.length);
  const amount = new Uint16Array(nodeIds.length);
  const stage = new Uint8Array(nodeIds.length);
  const variant = new Uint8Array(nodeIds.length);
  for (let index = 0; index < nodeIds.length; index += 1) {
    const id = nodeIds[index] ?? 0;
    const resourceKind = resources.kind[id] as NaturalResourceKind;
    const renderable =
      resourceKind === NaturalResourceKind.Tree ||
      resourceKind === NaturalResourceKind.Stone ||
      resourceKind === NaturalResourceKind.Metal;
    active[index] = renderable ? (resources.active[id] ?? 0) : 0;
    kind[index] =
      resourceKind === NaturalResourceKind.Tree
        ? ResourceNodeKind.Tree
        : resourceKind === NaturalResourceKind.Metal
          ? ResourceNodeKind.Metal
          : ResourceNodeKind.Stone;
    const cell = resources.cell[id] ?? 0;
    positionsX[index] = (cell % kernel.state.world.size) + 0.5;
    positionsZ[index] = Math.floor(cell / kernel.state.world.size) + 0.5;
    amount[index] = resources.amount[id] ?? 0;
    stage[index] =
      resources.stage[id] === NaturalResourceStage.Sapling
        ? ResourceNodeStage.Sapling
        : ResourceNodeStage.Mature;
    variant[index] = cell % 4;
  }
  return {
    full,
    count: resources.count,
    nodeIds,
    active,
    kind,
    positionsX,
    positionsZ,
    amount,
    stage,
    variant,
  };
}

export function projectKernelResources(kernel: SimulationKernel): ResourceNodeSnapshot {
  const nodeIds = Uint32Array.from({ length: kernel.state.resources.count }, (_, id) => id);
  return projectKernelResourceIds(kernel, nodeIds, true);
}

export function projectKernelResourceDelta(
  kernel: SimulationKernel,
  dirtyResourceIds: readonly number[],
): ResourceNodeSnapshot {
  return projectKernelResourceIds(kernel, Uint32Array.from(dirtyResourceIds), false);
}

export function projectEmptyTerritory(): TerritorySnapshot {
  return {
    full: true,
    revision: 0,
    cells: new Uint32Array(0),
    villageIds: new Uint16Array(0),
    claimStrength: new Uint8Array(0),
    planningZoneKinds: new Uint8Array(0),
  };
}

function projectedAgentState(human: HumanLifeFact): AgentState {
  const task = human.task;
  if (!task) return AgentState.Idle;
  if (task.kind === 'idle-wander') return AgentState.Wander;
  if (task.kind === 'join-settlement') return AgentState.Wander;
  if (task.kind === 'rest') return AgentState.Rest;
  if (task.kind === 'eat' || task.kind === 'forage-food') return AgentState.Eat;
  if (task.kind === 'build' || task.kind === 'establish-settlement') return AgentState.Build;
  if (task.kind === 'deliver-resource') return AgentState.Haul;
  if (task.resourceKind === 'wood') return AgentState.GatherWood;
  if (task.resourceKind === 'stone' || task.resourceKind === 'metal') return AgentState.GatherStone;
  return AgentState.FindFood;
}

function projectedProfession(human: HumanLifeFact): Profession {
  if (human.workRole === 'forager') return Profession.Forager;
  if (human.workRole === 'woodcutter') return Profession.Woodcutter;
  if (human.workRole === 'miner') return Profession.Miner;
  if (human.workRole === 'builder') return Profession.Builder;
  if (human.workRole === 'hauler') return Profession.Hauler;
  return Profession.Forager;
}

function projectedCarriedKind(human: HumanLifeFact): CarriedResourceKind {
  if (human.carried.kind === 'food') return CarriedResourceKind.Food;
  if (human.carried.kind === 'wood') return CarriedResourceKind.Wood;
  if (human.carried.kind === 'stone') return CarriedResourceKind.Stone;
  if (human.carried.kind === 'metal') return CarriedResourceKind.Metal;
  return CarriedResourceKind.None;
}

function projectedBuildingType(building: SettlementBuildingFact): BuildingType {
  if (building.kind === 'tent' || building.kind === 'house') return BuildingType.Home;
  if (building.kind === 'basic-storage') return BuildingType.Storage;
  if (building.kind === 'farm') return BuildingType.Farm;
  if (building.kind === 'logging-site') return BuildingType.LoggingCamp;
  if (building.kind === 'mine') return BuildingType.Mine;
  if (building.kind === 'workshop') return BuildingType.Workshop;
  if (building.kind === 'barracks') return BuildingType.Barracks;
  if (building.kind === 'village-center') return BuildingType.CouncilHall;
  return BuildingType.TownCenter;
}

function buildingLabel(building: SettlementBuildingFact | undefined): string {
  if (!building) return '无';
  const labels: Record<SettlementBuildingFact['kind'], string> = {
    campfire: '营火',
    tent: '帐篷',
    'basic-storage': '基础储存',
    house: '住宅',
    farm: '农田',
    'logging-site': '伐木点',
    mine: '矿点',
    workshop: '工坊',
    barracks: '兵营',
    'village-center': '村庄中心',
  };
  return labels[building.kind];
}

function taskExpectedResult(task: HumanTaskFact): string {
  if (task.expectedResult === 'primitive-camp') return '建立原始营地';
  if (task.expectedResult === 'food-consumed') return '取得并吃下一餐';
  if (task.expectedResult === 'resource-delivered') return '把物资送到目标位置';
  if (task.expectedResult === 'building-completed') return '完成建筑施工';
  return '恢复精力';
}

function failureLabel(code: HumanTaskFailureCode | undefined): string | null {
  if (!code) return null;
  if (code === 'target-disappeared') return '目标已消失';
  if (code === 'target-unreachable') return '无法抵达目标';
  if (code === 'resource-unavailable') return '所需资源不足';
  if (code === 'reservation-expired') return '任务预留已失效';
  return '任务执行异常';
}

function projectedTask(human: HumanLifeFact) {
  const task = human.task;
  if (!task) return null;
  const type =
    task.kind === 'eat' || task.kind === 'forage-food'
      ? ('eat' as const)
      : task.kind === 'rest'
        ? ('sleep' as const)
        : task.kind === 'deliver-resource'
          ? ('haul' as const)
          : task.kind === 'build' || task.kind === 'establish-settlement'
            ? ('build' as const)
            : ('gather' as const);
  const reason =
    human.intent.reason === 'nutrition-critical'
      ? ('hunger' as const)
      : human.intent.reason === 'energy-critical'
        ? ('fatigue' as const)
        : task.resourceKind === 'wood'
          ? ('village-needs-wood' as const)
          : task.resourceKind === 'stone' || task.resourceKind === 'metal'
            ? ('village-needs-stone' as const)
            : task.kind === 'build' || task.kind === 'deliver-resource'
              ? ('village-construction' as const)
              : ('village-needs-food' as const);
  const phase =
    task.phase === 'moving-to-target'
      ? ('travel' as const)
      : task.phase === 'moving-to-delivery'
        ? ('delivery' as const)
        : task.phase === 'carrying'
          ? ('pickup' as const)
          : ('work' as const);
  return {
    id: task.id,
    type,
    reason,
    phase,
    targetKind:
      task.targetBuildingId !== null
        ? ('building' as const)
        : task.targetResourceId !== null
          ? ('resource-node' as const)
          : ('cell' as const),
    targetId: task.targetBuildingId ?? task.targetResourceId ?? task.targetCell,
    targetCell: task.targetCell,
    progress: Math.max(0, task.startedAtTick + task.workRemaining - task.commitUntilTick),
    requiredProgress: task.workRemaining,
    leaseUntilTick: task.reservationIds.length > 0 ? task.commitUntilTick : 0,
    suspendedUntilTick: human.retryAfterTick,
    startedAtTick: task.startedAtTick,
    finishedAtTick: 0,
    failureReason: failureLabel(human.lastTaskFailure?.code),
    suspensionReason: human.suspendedTask ? reason : null,
    expectedResult: taskExpectedResult(task),
  };
}

function emptyResources() {
  return { food: 0, wood: 0, stone: 0, metal: 0, gold: 0, tools: 0, equipment: 0 };
}

function projectedVillages(kernel: SimulationKernel): Village[] {
  return kernel.state.civilization.settlements.map((settlement) => {
    const inventory = kernel.state.civilization.settlementInventories.find(
      (candidate) => candidate.settlementId === settlement.id,
    );
    const resources = {
      ...emptyResources(),
      food: inventory?.food ?? 0,
      wood: inventory?.wood ?? 0,
      stone: inventory?.stone ?? 0,
      metal: inventory?.metal ?? 0,
    };
    const population = settlement.residentIds.reduce(
      (total, lifeId) =>
        total +
        (kernel.state.civilization.life.find((human) => human.id === lifeId)?.active ? 1 : 0),
      0,
    );
    const project = kernel.state.civilization.buildings.find(
      (building) => building.settlementId === settlement.id && !building.completed,
    );
    return {
      id: settlement.id + 1,
      name: settlement.name,
      x: (settlement.centerCell % kernel.state.world.size) + 0.5,
      z: Math.floor(settlement.centerCell / kernel.state.world.size) + 0.5,
      population,
      tier: VillageTier.Camp,
      health: 1_000,
      resources,
      storageCapacity: inventory?.capacity ?? 0,
      storageCapacityByKind: {
        ...emptyResources(),
        food: inventory?.capacity ?? 0,
        wood: inventory?.capacity ?? 0,
        stone: inventory?.capacity ?? 0,
        metal: inventory?.capacity ?? 0,
      },
      outdoorStockpile: emptyResources(),
      outdoorSinceTicks: emptyResources(),
      housingCapacity: settlementHousingCapacity(
        kernel.state.civilization.buildings,
        settlement.id,
      ),
      campHousingCapacity: 2,
      operationsInitialized: true,
      kingdomId: 0,
      buildingIds: kernel.state.civilization.buildings
        .filter((building) => building.settlementId === settlement.id)
        .map((building) => building.id),
      foundedAtTick: settlement.foundedAtTick,
      carryingCapacity: population,
      foodProduction: 0,
      foodProducedSinceUpdate: 0,
      foodSources: { farm: 0, wild: resources.food, meat: 0, fish: 0 },
      foodConsumption: 0,
      foodTrend: 0,
      shortageTicks: 0,
      peakPopulation: population,
      lastRecordedPopulationPeak: population,
      lastShortageStage: 'stable',
      abandonedAtTick: 0,
      lastBirthTick: Math.max(
        0,
        ...kernel.state.civilization.families
          .filter((family) => family.settlementId === settlement.id)
          .map((family) => family.lastBirthAtTick),
      ),
      pioneerReadyAtTick: 0,
      constructionPriority: 'automatic',
      constructionDecision: project ? `${buildingLabel(project)}施工中` : '暂无建设项目',
      constructionOverrideReason: '',
    };
  });
}

export function projectKernelInspection(
  kernel: SimulationKernel,
  target: 'entity' | 'village' | 'building' | 'kingdom',
  id: number,
): Inspection | null {
  if (target === 'village') {
    const settlement = kernel.state.civilization.settlements.find(
      (candidate) => candidate.id + 1 === id,
    );
    if (!settlement) return null;
    const village = projectedVillages(kernel).find((candidate) => candidate.id === id);
    if (!village) return null;
    const settlementBuildings = kernel.state.civilization.buildings.filter(
      (building) => building.settlementId === settlement.id,
    );
    const capabilities = deriveSettlementCapabilities(
      kernel.state.civilization.buildings,
      settlement.id,
    );
    const activeWorkers = kernel.state.civilization.life.filter(
      (human) => human.settlementId === settlement.id && human.task,
    );
    return {
      type: 'village',
      id,
      village,
      completedBuildings: settlementBuildings.filter((building) => building.completed).length,
      kingdomName: '无',
      development: {
        nextTier: null,
        population: village.population,
        requiredPopulation: village.population,
        buildings: [],
      },
      planningZones: { residential: 0, production: 0, defense: 0 },
      capabilities: {
        guardTrainingSlots: capabilities.trainingSlots,
        territoryReachBonus: capabilities.hasCivicCenter ? 1 : 0,
        claimStrengthBonus: capabilities.hasCivicCenter ? 1 : 0,
        captureBlockers: 0,
        watchtowers: 0,
        watchRange: 0,
        watchDamage: 0,
      },
      workHotspots:
        activeWorkers.length > 0
          ? [
              {
                kind: 'production',
                count: activeWorkers.length,
                x: village.x,
                z: village.z,
              },
            ]
          : [],
      activity: { total: village.population, categories: [], alerts: [] },
      history: [],
    };
  }
  if (target === 'building') {
    const fact = kernel.state.civilization.buildings.find((building) => building.id === id);
    if (!fact) return null;
    const building = projectKernelSnapshot(kernel, { tickMs: 0, averageTickMs: 0 }).buildings.find(
      (candidate) => candidate.id === id,
    );
    if (!building) return null;
    const settlement = kernel.state.civilization.settlements.find(
      (candidate) => candidate.id === fact.settlementId,
    );
    const workers = kernel.state.civilization.life.filter(
      (human) => human.task?.targetBuildingId === fact.id,
    );
    return {
      type: 'building',
      id,
      building,
      villageName: settlement?.name ?? '未定居',
      workerNames: workers.map((worker) => worker.name),
      capability: fact.completed ? buildingLabel(fact) : '施工中',
      inputs: Object.entries(fact.required)
        .map(([kind, amount]) => `${kind} ${amount}`)
        .join('、'),
      outputs: fact.completed ? '可用' : '尚未完成',
      stopReason: fact.completed ? '' : '等待材料或施工',
    };
  }
  if (target !== 'entity') return null;
  const human = kernel.state.civilization.life[id];
  if (!human) return null;
  const settlement = kernel.state.civilization.settlements.find(
    (candidate) => candidate.id === human.settlementId,
  );
  const partner = kernel.state.civilization.life.find(
    (candidate) => candidate.id === human.partnerId,
  );
  const home = kernel.state.civilization.buildings.find(
    (building) =>
      building.settlementId === human.settlementId &&
      building.completed &&
      (building.kind === 'house' || building.kind === 'tent'),
  );
  const workplace = kernel.state.civilization.buildings.find((building) => {
    if (building.settlementId !== human.settlementId || !building.completed) return false;
    if (human.workRole === 'woodcutter') return building.kind === 'logging-site';
    if (human.workRole === 'miner') return building.kind === 'mine';
    if (human.workRole === 'builder') return building.kind === 'workshop';
    return false;
  });
  return {
    type: 'entity',
    id,
    lifeId: human.id,
    favorite: false,
    name: human.name,
    kind: EntityKind.Human,
    age: human.ageYears,
    health: human.health,
    hunger: 1_000 - human.nutrition,
    energy: human.energy,
    profession: projectedProfession(human),
    state: projectedAgentState(human),
    villageName: settlement?.name ?? '未定居',
    kingdomName: '无',
    targetCell: human.task?.targetCell ?? null,
    traits: 0,
    level: 1,
    experience: 0,
    contribution: 0,
    role: settlement?.founderLifeId === human.id ? ResidentRole.Leader : ResidentRole.Citizen,
    weaponTier: 0,
    armorTier: 0,
    sex: human.sex === 'female' ? 0 : 1,
    familyId: human.familyId ?? 0,
    partnerName: partner?.name ?? '无',
    parentNames: human.parentIds
      .map(
        (parentId) =>
          kernel.state.civilization.life.find((candidate) => candidate.id === parentId)?.name,
      )
      .filter((name): name is string => Boolean(name)),
    malnutrition:
      human.nutritionStage === 'starving' ? 2 : human.nutritionStage === 'hungry' ? 1 : 0,
    history: [],
    task: projectedTask(human),
    carriedResourceKind: projectedCarriedKind(human),
    carriedResourceAmount: human.carried.amount,
    homeName: buildingLabel(home),
    workplaceName: buildingLabel(workplace),
  };
}

export function projectKernelSnapshot(
  kernel: SimulationKernel,
  metrics: KernelProjectionMetrics,
): WorldRenderSnapshot {
  const humans = kernel.state.civilization.life;
  const population = humans.length;
  const active = Uint8Array.from(humans, (human) => (human.active ? 1 : 0));
  const positionsX = Float32Array.from(
    humans,
    (human) => (human.cell % kernel.state.world.size) + 0.5,
  );
  const positionsZ = Float32Array.from(
    humans,
    (human) => Math.floor(human.cell / kernel.state.world.size) + 0.5,
  );
  const villages = projectedVillages(kernel);
  const buildings = kernel.state.civilization.buildings.map((building) => ({
    id: building.id,
    villageId: building.settlementId + 1,
    type: projectedBuildingType(building),
    x: (building.cell % kernel.state.world.size) + 0.5,
    z: Math.floor(building.cell / kernel.state.world.size) + 0.5,
    stage: building.completed ? (2 as const) : (1 as const),
    progress: building.progress,
    requiredProgress: building.requiredProgress,
    health: 1_000,
    completed: building.completed,
    constructionPhase: building.completed
      ? ('complete' as const)
      : Object.entries(building.required).every(
            ([kind, required]) =>
              (building.delivered[kind as 'food' | 'wood' | 'stone' | 'metal'] ?? 0) >=
              (required ?? 0),
          )
        ? ('building' as const)
        : ('delivery' as const),
    reservedWood: 0,
    reservedStone: 0,
    deliveredWood: building.delivered.wood ?? 0,
    deliveredStone: building.delivered.stone ?? 0,
    inTransitWood: 0,
    inTransitStone: 0,
    clearNodeIds: [],
    assignedWorkerIds: humans
      .filter((human) => human.task?.targetBuildingId === building.id)
      .map((human) => human.id),
    workSlots: 1,
  }));
  const children = humans.filter((human) => human.active && human.ageYears < 16).length;
  const adults = humans.filter((human) => human.active && human.ageYears >= 16).length;
  const storedFood = kernel.state.civilization.settlementInventories.reduce(
    (total, inventory) => total + inventory.food,
    0,
  );
  return {
    tick: kernel.state.tick,
    year: 1 + Math.floor(kernel.state.tick / 7_200),
    population,
    active,
    positionsX,
    positionsZ,
    headings: new Float32Array(population),
    states: Uint8Array.from(humans, projectedAgentState),
    kinds: Uint8Array.from(humans, () => EntityKind.Human),
    villageIds: Uint16Array.from(humans, (human) =>
      human.settlementId === null ? 0 : human.settlementId + 1,
    ),
    kingdomIds: new Uint16Array(population),
    health: Uint16Array.from(humans, (human) => human.health),
    infected: new Uint8Array(population),
    professions: Uint8Array.from(humans, projectedProfession),
    levels: Uint8Array.from(humans, () => 1),
    roles: Uint8Array.from(humans, (human) =>
      kernel.state.civilization.settlements.some(
        (settlement) => settlement.founderLifeId === human.id,
      )
        ? ResidentRole.Leader
        : ResidentRole.Citizen,
    ),
    weaponTiers: new Uint8Array(population),
    armorTiers: new Uint8Array(population),
    ages: Uint16Array.from(humans, (human) => human.ageYears),
    targetCells: Uint32Array.from(humans, (human) => human.task?.targetCell ?? human.cell),
    carriedResourceKinds: Uint8Array.from(humans, projectedCarriedKind),
    carriedResources: Uint8Array.from(humans, (human) => human.carried.amount),
    stats: {
      year: 1 + Math.floor(kernel.state.tick / 7_200),
      humans: kernel.state.civilization.humans,
      animals: 0,
      villages: villages.length,
      kingdoms: 0,
      wars: 0,
      populationTrend: 0,
    },
    villages,
    kingdoms: [],
    buildings,
    carcasses: [],
    events: [],
    historyRevision: 0,
    settings: { speed: kernel.playbackRate, quality: 'high', overlay: 'none' },
    demographics: {
      ...emptyPopulationDiagnostics(),
      carryingCapacity: villages.reduce((total, village) => total + village.housingCapacity, 0),
      housingCapacity: villages.reduce((total, village) => total + village.housingCapacity, 0),
      storedFood,
      children,
      adults,
    },
    worldLaws: createDefaultWorldLaws(),
    ecology: emptyEcologyDiagnostics(),
    activityAlerts: [],
    metrics: {
      tickMs: metrics.tickMs,
      averageTickMs: metrics.averageTickMs,
      completedPaths: 0,
      pathQueue: 0,
      neighbourCandidates: 0,
    },
  };
}
