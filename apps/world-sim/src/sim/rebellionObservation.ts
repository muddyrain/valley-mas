import { SimWorld } from './SimWorld';
import type { ArmyGroup, Kingdom, Position, Unit, Village, VillageBuilding } from './types';

export type RebellionObservationOptions = {
  seeds?: string[];
  ticks?: number;
};

export type RebellionObservationRun = {
  seed: string;
  ticks: number;
  firstLowLoyaltyTick?: number;
  firstPrepareRebellionTick?: number;
  splitTick?: number;
  warDeclaredTick?: number;
  firstArmyFormedTick?: number;
  parentKingdomId?: string;
  rebelKingdomId?: string;
  rebelVillageId?: string;
  supporterCount: number;
  parentVillageCountAfter: number;
  rebelVillageCountAfter: number;
  parentPopulationAfter: number;
  rebelPopulationAfter: number;
  parentSoldiersAfter: number;
  rebelSoldiersAfter: number;
  activeArmiesAfter: number;
};

export type RebellionObservationReport = {
  ticks: number;
  runs: RebellionObservationRun[];
};

const DEFAULT_REBELLION_OBSERVATION_SEEDS = [
  'rebellion-observation-a',
  'rebellion-observation-b',
  'rebellion-observation-c',
];

export function observeRebellionReport(
  options: RebellionObservationOptions = {},
): RebellionObservationReport {
  const ticks = options.ticks ?? 180;
  const seeds = options.seeds ?? DEFAULT_REBELLION_OBSERVATION_SEEDS;

  return {
    ticks,
    runs: seeds.map((seed) => observeRebellionRun(seed, ticks)),
  };
}

export function formatRebellionObservationReport(report: RebellionObservationReport) {
  return report.runs.map(formatRebellionObservationRun).join('\n');
}

function observeRebellionRun(seed: string, ticks: number): RebellionObservationRun {
  const scenario = createRebellionObservationWorld(seed);
  const { world, parentKingdomId, rebelVillageId } = scenario;
  const run: RebellionObservationRun = {
    seed,
    ticks,
    parentKingdomId,
    rebelVillageId,
    supporterCount: 0,
    parentVillageCountAfter: 0,
    rebelVillageCountAfter: 0,
    parentPopulationAfter: 0,
    rebelPopulationAfter: 0,
    parentSoldiersAfter: 0,
    rebelSoldiersAfter: 0,
    activeArmiesAfter: 0,
  };

  for (let elapsed = 0; elapsed <= ticks; elapsed += 1) {
    const projection = world.project();
    const rebelVillage = projection.villages.find((village) => village.id === rebelVillageId);

    if (
      run.firstLowLoyaltyTick === undefined &&
      rebelVillage?.loyalty !== undefined &&
      rebelVillage.loyalty < 50
    ) {
      run.firstLowLoyaltyTick = projection.tick;
    }

    if (
      run.firstPrepareRebellionTick === undefined &&
      rebelVillage?.rebellionPlan === 'prepare_rebellion'
    ) {
      run.firstPrepareRebellionTick = projection.tick;
    }

    for (const event of projection.recentEvents) {
      if (event.type === 'rebellion_succeeded' && event.payload?.villageId === rebelVillageId) {
        run.splitTick ??= event.tick;
        run.rebelKingdomId =
          typeof event.payload.rebelKingdomId === 'string'
            ? event.payload.rebelKingdomId
            : undefined;
        run.supporterCount =
          typeof event.payload.supporterCount === 'number' ? event.payload.supporterCount : 0;
      }

      if (
        event.type === 'war_declared' &&
        event.payload?.rebellion === true &&
        event.payload.rebellionVillageId === rebelVillageId
      ) {
        run.warDeclaredTick ??= event.tick;
        run.rebelKingdomId =
          typeof event.payload.rebelKingdomId === 'string'
            ? event.payload.rebelKingdomId
            : run.rebelKingdomId;
      }

      if (
        event.type === 'army_formed' &&
        run.rebelKingdomId !== undefined &&
        event.payload?.targetKingdomId === run.rebelKingdomId
      ) {
        run.firstArmyFormedTick ??= event.tick;
      }
    }

    if (
      run.splitTick !== undefined &&
      run.warDeclaredTick !== undefined &&
      run.firstArmyFormedTick !== undefined
    ) {
      break;
    }

    if (elapsed < ticks) {
      world.step();
    }
  }

  const finalProjection = world.project();
  const parent = finalProjection.kingdoms.find((kingdom) => kingdom.id === parentKingdomId);
  const rebel = finalProjection.kingdoms.find((kingdom) => kingdom.id === run.rebelKingdomId);
  run.parentVillageCountAfter = parent?.villageIds.length ?? 0;
  run.rebelVillageCountAfter = rebel?.villageIds.length ?? 0;
  run.parentPopulationAfter = sumVillagePopulation(finalProjection.villages, parent);
  run.rebelPopulationAfter = sumVillagePopulation(finalProjection.villages, rebel);
  run.parentSoldiersAfter = sumVillageSoldiers(finalProjection.villages, parent);
  run.rebelSoldiersAfter = sumVillageSoldiers(finalProjection.villages, rebel);
  run.activeArmiesAfter = finalProjection.armies.filter(
    (army) => army.status !== 'disbanded',
  ).length;

  return run;
}

function formatRebellionObservationRun(run: RebellionObservationRun) {
  return [
    run.seed,
    `low=${formatTick(run.firstLowLoyaltyTick)}`,
    `prepare=${formatTick(run.firstPrepareRebellionTick)}`,
    `split=${formatTick(run.splitTick)}`,
    `war=${formatTick(run.warDeclaredTick)}`,
    `army=${formatTick(run.firstArmyFormedTick)}`,
    `parent=${run.parentKingdomId ?? '-'}`,
    `rebel=${run.rebelKingdomId ?? '-'}`,
    `village=${run.rebelVillageId ?? '-'}`,
    `supporters=${run.supporterCount}`,
    `parentVillages=${run.parentVillageCountAfter}`,
    `rebelVillages=${run.rebelVillageCountAfter}`,
    `pop=${run.rebelPopulationAfter}/${run.parentPopulationAfter}`,
    `power=${run.rebelSoldiersAfter}/${run.parentSoldiersAfter}`,
    `armies=${run.activeArmiesAfter}`,
  ].join(' | ');
}

function sumVillagePopulation(villages: Village[], kingdom?: Kingdom) {
  if (!kingdom) {
    return 0;
  }

  const villageIds = new Set(kingdom.villageIds);

  return villages.reduce(
    (total, village) => (villageIds.has(village.id) ? total + village.population : total),
    0,
  );
}

function sumVillageSoldiers(villages: Village[], kingdom?: Kingdom) {
  if (!kingdom) {
    return 0;
  }

  const villageIds = new Set(kingdom.villageIds);

  return villages.reduce(
    (total, village) => (villageIds.has(village.id) ? total + village.jobs.soldier : total),
    0,
  );
}

function createRebellionObservationWorld(seed: string) {
  const world = new SimWorld({ seed, width: 180, height: 72, initialUnits: 0 });

  world.enqueue({
    id: 'rebellion-observation-food',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'food',
      position: { x: 16, y: 12 },
      amount: 700,
      radius: 5,
    },
  });
  world.enqueue({
    id: 'rebellion-observation-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'human',
      position: { x: 16, y: 12 },
      count: 12,
    },
  });
  world.step();
  addWoodSiteNearVillage(world, world.project().villages[0].id);

  for (let tick = 0; tick < 300; tick += 1) {
    world.step();
  }

  const parentKingdom = world.project().kingdoms[0];

  if (!parentKingdom) {
    throw new Error('Expected parent kingdom for rebellion observation');
  }

  const leader = addVillageToKingdom(world, parentKingdom.id, {
    id: 'rebellion-observation-leader',
    position: { x: 168, y: 62 },
    population: 72,
  });
  const supporter = addVillageToKingdom(world, parentKingdom.id, {
    id: 'rebellion-observation-supporter',
    position: { x: 158, y: 58 },
    population: 48,
  });

  const mutableWorld = getMutableWorld(world);
  const capital = mutableWorld.villages.get(parentKingdom.capitalVillageId);

  if (capital) {
    addResidentUnitsToVillage(world, capital.id, Math.max(36, capital.population));
    addActiveBuildingToVillage(world, capital.id, 'barrack');
  }

  for (const village of [leader, supporter]) {
    addResidentUnitsToVillage(world, village.id, village.population);
    addActiveBuildingToVillage(world, village.id, 'barrack');
    village.foodInventory = 0;
    village.foodCapacity = Math.max(village.foodCapacity, 500);
    village.woodInventory = 500;
    village.woodCapacity = 500;
    village.stoneInventory = 200;
    village.stoneCapacity = 280;
    village.housingCapacity = Math.max(village.housingCapacity, village.population);
  }

  return {
    world,
    parentKingdomId: parentKingdom.id,
    rebelVillageId: leader.id,
  };
}

function addVillageToKingdom(
  world: SimWorld,
  kingdomId: string,
  options: { id: string; position: Position; population: number },
) {
  const mutableWorld = getMutableWorld(world);
  const kingdom = mutableWorld.kingdoms.get(kingdomId);

  if (!kingdom) {
    throw new Error(`Expected kingdom ${kingdomId}`);
  }

  const village: Village = {
    id: options.id,
    name: 'Observation March',
    level: 2,
    race: kingdom.race,
    kingdomId,
    center: { ...options.position },
    population: options.population,
    foodInventory: 120,
    foodCapacity: 180,
    woodInventory: 80,
    woodCapacity: 160,
    stoneInventory: 20,
    stoneCapacity: 80,
    ironInventory: 0,
    ironCapacity: 40,
    jobs: {
      farmer: 3,
      builder: 2,
      miner: 0,
      soldier: 4,
      laborer: Math.max(0, options.population - 9),
    },
    growthPhase: 'village',
    growthBlockers: [],
    primaryGrowthBlocker: undefined,
    buildPlan: 'idle',
    primaryIntention: 'idle',
    housingCapacity: Math.max(24, options.population),
    territoryTiles: 0,
    foundedAtTick: world.currentTick,
    status: 'stable',
  };

  mutableWorld.villages.set(village.id, village);
  kingdom.villageIds.push(village.id);
  mutableWorld.refreshKingdomMembership(kingdom);

  return village;
}

function addResidentUnitsToVillage(world: SimWorld, villageId: string, count: number) {
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (let index = 0; index < count; index += 1) {
    const unit = mutableWorld.createUnit({
      race: village.race,
      gender: index % 2 === 0 ? 'female' : 'male',
      position: {
        x: village.center.x + (index % 4) - 1,
        y: village.center.y + Math.floor(index / 4) - 1,
      },
      ageTicks: 12 * 240,
      hunger: 0,
      reproductionCooldownTicks: 0,
      villageId,
      homeVillageId: villageId,
    });

    mutableWorld.units.set(unit.id, unit);
  }
}

function addActiveBuildingToVillage(
  world: SimWorld,
  villageId: string,
  type: VillageBuilding['type'],
) {
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const building = mutableWorld.createBuilding(village, type);
  building.status = 'active';
  building.constructionProgress = building.constructionWorkRequired;
  mutableWorld.buildings.set(building.id, building);
}

function addWoodSiteNearVillage(world: SimWorld, villageId: string) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const tile = world.map.tiles.find(
    (candidate) =>
      candidate.x === Math.floor(village.center.x + 6) &&
      candidate.y === Math.floor(village.center.y),
  );

  if (!tile) {
    throw new Error('Expected nearby wood tile');
  }

  tile.terrain = 'forest';
  tile.biome = 'woodland';
  tile.resource = { type: 'wood', amount: 160 };
}

function formatTick(tick: number | undefined) {
  return tick === undefined ? '-' : String(tick);
}

function getMutableWorld(world: SimWorld) {
  return world as unknown as {
    villages: Map<string, Village>;
    kingdoms: Map<string, Kingdom>;
    buildings: Map<string, VillageBuilding>;
    armies: Map<string, ArmyGroup>;
    units: Map<string, Unit>;
    createUnit(options: {
      race: Unit['race'];
      gender: Unit['gender'];
      position: Position;
      ageTicks: number;
      hunger: number;
      reproductionCooldownTicks: number;
      villageId?: string;
      homeVillageId?: string;
    }): Unit;
    createBuilding(village: Village, type: VillageBuilding['type']): VillageBuilding;
    refreshKingdomMembership(kingdom: Kingdom): void;
  };
}
