import { SimWorld } from './SimWorld';
import type {
  Position,
  SimEvent,
  Unit,
  Village,
  VillageBuilding,
  VillageBuildingType,
  VillageBuildPlan,
  VillageGrowthBlocker,
  VillageGrowthPhase,
} from './types';

export type GrowthObservationOptions = {
  seed?: string;
  ticks?: number;
  sampleEvery?: number;
};

export type GrowthObservationReportOptions = Omit<GrowthObservationOptions, 'seed'> & {
  seeds?: string[];
};

export type GrowthObservationSnapshot = {
  tick: number;
  villageId?: string;
  phase?: VillageGrowthPhase;
  intention?: VillageBuildPlan;
  primaryBlocker?: VillageGrowthBlocker;
  population: number;
  housingCapacity: number;
  foodInventory: number;
  woodInventory: number;
  buildings: number;
  territoryTiles: number;
};

export type GrowthObservationRun = {
  seed: string;
  snapshots: GrowthObservationSnapshot[];
  phaseFirstTicks: Partial<Record<VillageGrowthPhase, number>>;
  finalSnapshot: GrowthObservationSnapshot;
  missingVillageBuildings: Array<Extract<VillageBuildingType, 'house' | 'storage' | 'farm'>>;
  recentEventSummaries: string[];
};

export type GrowthObservationReport = {
  ticks: number;
  sampleEvery: number;
  runs: GrowthObservationRun[];
};

export type SatelliteObservationOptions = {
  seeds?: string[];
  ticks?: number;
};

export type SatelliteObservationRun = {
  seed: string;
  firstExpansionStatusTick?: number;
  firstExpansionStatusPlan?: VillageBuildPlan;
  firstPrepareExpansionTick?: number;
  satelliteFoundedTick?: number;
  expansionLeadTicks?: number;
  villageCount: number;
  parentPopulationAfter: number;
  parentHousingCapacity: number;
  parentFoodInventory: number;
  parentWoodInventory: number;
  childPopulation?: number;
  childHousingCapacity?: number;
};

export type SatelliteObservationReport = {
  ticks: number;
  runs: SatelliteObservationRun[];
};

const DEFAULT_OPTIONS: Required<GrowthObservationOptions> = {
  seed: 'early-settlement-observation',
  ticks: 120,
  sampleEvery: 10,
};

const DEFAULT_REPORT_SEEDS = [
  'early-settlement-observation',
  'early-settlement-observation-b',
  'early-settlement-observation-c',
];
const DEFAULT_SATELLITE_REPORT_SEEDS = [
  'satellite-observation-a',
  'satellite-observation-b',
  'satellite-observation-c',
];

const VILLAGE_CHAIN_BUILDINGS = ['house', 'storage', 'farm'] as const;

export function observeEarlySettlement(options: GrowthObservationOptions = {}) {
  return observeEarlySettlementRun(options).snapshots;
}

export function observeEarlySettlementReport(options: GrowthObservationReportOptions = {}) {
  const ticks = options.ticks ?? DEFAULT_OPTIONS.ticks;
  const sampleEvery = options.sampleEvery ?? DEFAULT_OPTIONS.sampleEvery;
  const seeds = options.seeds ?? DEFAULT_REPORT_SEEDS;

  return {
    ticks,
    sampleEvery,
    runs: seeds.map((seed) => observeEarlySettlementRun({ seed, ticks, sampleEvery })),
  };
}

export function observeSatelliteSettlementReport(options: SatelliteObservationOptions = {}) {
  const ticks = options.ticks ?? 260;
  const seeds = options.seeds ?? DEFAULT_SATELLITE_REPORT_SEEDS;

  return {
    ticks,
    runs: seeds.map((seed) => observeSatelliteSettlementRun(seed, ticks)),
  };
}

function observeEarlySettlementRun(options: GrowthObservationOptions): GrowthObservationRun {
  const scenario = { ...DEFAULT_OPTIONS, ...options };
  const world = createEarlySettlementWorld(scenario.seed);
  const snapshots: GrowthObservationSnapshot[] = [];
  let previousPhase: VillageGrowthPhase | undefined;

  for (let elapsed = 0; elapsed <= scenario.ticks; elapsed += 1) {
    if (elapsed > 0) {
      world.step();
    }

    const projection = world.project();
    const village = projection.villages[0];
    const phaseChanged = village?.growthPhase !== previousPhase;
    const isScheduledSample = elapsed % Math.max(1, scenario.sampleEvery) === 0;

    if (phaseChanged || isScheduledSample) {
      snapshots.push({
        tick: projection.tick,
        villageId: village?.id,
        phase: village?.growthPhase,
        intention: village?.primaryIntention,
        primaryBlocker: village?.primaryGrowthBlocker,
        population: village?.population ?? 0,
        housingCapacity: village?.housingCapacity ?? 0,
        foodInventory: village?.foodInventory ?? 0,
        woodInventory: village?.woodInventory ?? 0,
        buildings: village
          ? projection.buildings.filter((building) => building.villageId === village.id).length
          : 0,
        territoryTiles: village?.territoryTiles ?? 0,
      });
    }

    previousPhase = village?.growthPhase;
  }

  const finalProjection = world.project();
  const finalVillage = finalProjection.villages[0];
  const finalSnapshot = snapshots[snapshots.length - 1] ?? createEmptySnapshot(world.currentTick);
  const activeBuildingTypes = new Set(
    finalVillage
      ? finalProjection.buildings
          .filter(
            (building) => building.villageId === finalVillage.id && building.status === 'active',
          )
          .map((building) => building.type)
      : [],
  );

  return {
    seed: scenario.seed,
    snapshots,
    phaseFirstTicks: summarizePhaseFirstTicks(snapshots),
    finalSnapshot,
    missingVillageBuildings: VILLAGE_CHAIN_BUILDINGS.filter(
      (building) => !activeBuildingTypes.has(building),
    ),
    recentEventSummaries: summarizeRecentGrowthEvents(finalProjection.recentEvents),
  };
}

export function formatGrowthObservation(snapshot: GrowthObservationSnapshot) {
  return [
    `tick=${snapshot.tick}`,
    `village=${snapshot.villageId ?? '-'}`,
    `phase=${snapshot.phase ?? '-'}`,
    `plan=${snapshot.intention ?? '-'}`,
    `blocker=${snapshot.primaryBlocker ?? '-'}`,
    `population=${snapshot.population}`,
    `housing=${snapshot.housingCapacity}`,
    `food=${snapshot.foodInventory}`,
    `wood=${snapshot.woodInventory}`,
    `buildings=${snapshot.buildings}`,
    `territory=${snapshot.territoryTiles}`,
  ].join(' | ');
}

export function formatGrowthObservationReport(report: GrowthObservationReport) {
  return report.runs.map(formatGrowthObservationRun).join('\n');
}

export function formatSatelliteObservationReport(report: SatelliteObservationReport) {
  return report.runs.map(formatSatelliteObservationRun).join('\n');
}

function formatGrowthObservationRun(run: GrowthObservationRun) {
  const final = run.finalSnapshot;

  return [
    run.seed,
    `firstCamp=${formatTick(run.phaseFirstTicks.camp)}`,
    `firstHamlet=${formatTick(run.phaseFirstTicks.hamlet)}`,
    `firstVillage=${formatTick(run.phaseFirstTicks.village)}`,
    `finalPhase=${final.phase ?? '-'}`,
    `finalPlan=${final.intention ?? '-'}`,
    `finalBlocker=${final.primaryBlocker ?? '-'}`,
    `population=${final.population}`,
    `housing=${final.housingCapacity}`,
    `buildings=${final.buildings}`,
    `territory=${final.territoryTiles}`,
    `missing=${run.missingVillageBuildings.join(',') || '-'}`,
    `events=${run.recentEventSummaries.join(';') || '-'}`,
  ].join(' | ');
}

function formatSatelliteObservationRun(run: SatelliteObservationRun) {
  return [
    run.seed,
    `firstExpansionStatus=${formatTick(run.firstExpansionStatusTick)}`,
    `firstExpansionPlan=${run.firstExpansionStatusPlan ?? '-'}`,
    `firstPrepareExpansion=${formatTick(run.firstPrepareExpansionTick)}`,
    `expansionLead=${formatTick(run.expansionLeadTicks)}`,
    `satelliteFounded=${formatTick(run.satelliteFoundedTick)}`,
    `villages=${run.villageCount}`,
    `parentPopulation=${run.parentPopulationAfter}`,
    `parentHousing=${run.parentHousingCapacity}`,
    `parentFood=${run.parentFoodInventory}`,
    `parentWood=${run.parentWoodInventory}`,
    `childPopulation=${run.childPopulation ?? '-'}`,
    `childHousing=${run.childHousingCapacity ?? '-'}`,
  ].join(' | ');
}

function observeSatelliteSettlementRun(seed: string, ticks: number): SatelliteObservationRun {
  const { world, parentVillageId } = createSatelliteObservationWorld(seed);
  let firstExpansionStatusTick: number | undefined;
  let firstExpansionStatusPlan: VillageBuildPlan | undefined;
  let firstPrepareExpansionTick: number | undefined;
  let satelliteFoundedTick: number | undefined;
  let childVillageId: string | undefined;

  for (let elapsed = 0; elapsed <= ticks; elapsed += 1) {
    if (elapsed > 0) {
      world.step();
    }

    const projection = world.project();
    const parent = projection.villages.find((village) => village.id === parentVillageId);

    if (!firstPrepareExpansionTick && parent?.expansionPlan === 'prepare_expansion') {
      firstPrepareExpansionTick = projection.tick;
    }

    const expansionStatus = projection.recentEvents.find(
      (event) =>
        event.type === 'village_expansion_status' && event.payload?.villageId === parentVillageId,
    );

    if (!firstExpansionStatusTick && expansionStatus) {
      firstExpansionStatusTick = expansionStatus.tick;
      firstExpansionStatusPlan =
        typeof expansionStatus.payload?.plan === 'string'
          ? (expansionStatus.payload.plan as VillageBuildPlan)
          : undefined;
    }

    const satelliteEvent = projection.recentEvents.find(
      (event) =>
        event.type === 'village_founded' && event.payload?.parentVillageId === parentVillageId,
    );

    if (!satelliteFoundedTick && satelliteEvent) {
      satelliteFoundedTick = satelliteEvent.tick;
      childVillageId = projection.villages.find((village) => village.id !== parentVillageId)?.id;
    }
  }

  const finalProjection = world.project();
  const parent = finalProjection.villages.find((village) => village.id === parentVillageId);
  const child = childVillageId
    ? finalProjection.villages.find((village) => village.id === childVillageId)
    : finalProjection.villages.find((village) => village.id !== parentVillageId);

  return {
    seed,
    firstExpansionStatusTick,
    firstExpansionStatusPlan,
    firstPrepareExpansionTick,
    satelliteFoundedTick,
    expansionLeadTicks:
      firstPrepareExpansionTick !== undefined && satelliteFoundedTick !== undefined
        ? satelliteFoundedTick - firstPrepareExpansionTick
        : undefined,
    villageCount: finalProjection.villages.length,
    parentPopulationAfter: parent?.population ?? 0,
    parentHousingCapacity: parent?.housingCapacity ?? 0,
    parentFoodInventory: parent?.foodInventory ?? 0,
    parentWoodInventory: parent?.woodInventory ?? 0,
    childPopulation: child?.population,
    childHousingCapacity: child?.housingCapacity,
  };
}

function summarizePhaseFirstTicks(snapshots: GrowthObservationSnapshot[]) {
  const ticks: Partial<Record<VillageGrowthPhase, number>> = {};

  for (const snapshot of snapshots) {
    if (snapshot.phase && ticks[snapshot.phase] === undefined) {
      ticks[snapshot.phase] = snapshot.tick;
    }
  }

  return ticks;
}

function summarizeRecentGrowthEvents(events: SimEvent[]) {
  return events
    .filter(
      (event) =>
        event.type === 'village_phase_changed' ||
        event.type === 'village_leveled_up' ||
        event.type === 'building_built',
    )
    .slice(-8)
    .map((event) => {
      const label =
        event.type === 'building_built' && typeof event.payload?.type === 'string'
          ? `${event.type}:${event.payload.type}`
          : event.type;

      return `${event.tick}:${label}`;
    });
}

function createEmptySnapshot(tick: number): GrowthObservationSnapshot {
  return {
    tick,
    population: 0,
    housingCapacity: 0,
    foodInventory: 0,
    woodInventory: 0,
    buildings: 0,
    territoryTiles: 0,
  };
}

function formatTick(tick: number | undefined) {
  return tick === undefined ? '-' : String(tick);
}

function createEarlySettlementWorld(seed: string) {
  const world = new SimWorld({ seed, width: 32, height: 24, initialUnits: 0 });

  world.enqueue({
    id: 'observation-food',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'food',
      position: { x: 16, y: 12 },
      amount: 600,
      radius: 5,
    },
  });
  world.enqueue({
    id: 'observation-wood-terrain',
    type: 'change_terrain',
    issuedAtTick: 0,
    payload: {
      terrain: 'forest',
      position: { x: 22, y: 12 },
    },
  });
  world.enqueue({
    id: 'observation-wood',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'wood',
      position: { x: 22, y: 12 },
      amount: 160,
    },
  });
  world.enqueue({
    id: 'observation-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'human',
      position: { x: 16, y: 12 },
      count: 12,
    },
  });
  world.step();

  return world;
}

function createSatelliteObservationWorld(seed: string) {
  const world = new SimWorld({ seed, width: 56, height: 32, initialUnits: 0 });

  placeFoodPatch(world, { x: 16, y: 12 }, 900, 5);
  placeWoodDeposit(world, { x: 22, y: 12 }, 500);
  placeFoodPatch(world, { x: 36, y: 12 }, 700, 4);
  world.enqueue({
    id: 'satellite-observation-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'human',
      position: { x: 16, y: 12 },
      count: 30,
    },
  });
  world.step();

  const mutableWorld = world as unknown as {
    villages: Map<string, Village>;
    buildings: Map<string, VillageBuilding>;
    units: Map<string, Unit>;
    createBuilding(village: Village, type: VillageBuildingType): VillageBuilding;
    updateKingdoms(): void;
  };
  const parent = mutableWorld.villages.values().next().value;

  if (!parent) {
    throw new Error('Expected satellite observation parent village');
  }

  for (const type of [
    'house',
    'house',
    'house',
    'house',
    'house',
    'house',
    'storage',
    'storage',
    'farm',
    'farm',
    'farm',
    'farm',
    'mine',
    'barrack',
    'dock',
  ] as VillageBuildingType[]) {
    const building = mutableWorld.createBuilding(parent, type);
    mutableWorld.buildings.set(building.id, building);
  }

  parent.population = 30;
  parent.housingCapacity = 42;
  parent.foodInventory = 1600;
  parent.foodCapacity = 1600;
  parent.woodInventory = 500;
  parent.stoneInventory = 200;
  parent.status = 'stable';

  let adopted = 0;

  for (const unit of mutableWorld.units.values()) {
    if (adopted >= 30) {
      break;
    }

    unit.homeVillageId = parent.id;
    unit.villageId = parent.id;
    unit.position = {
      x: parent.center.x + (adopted % 4) - 1,
      y: parent.center.y + Math.floor(adopted / 4) - 3,
    };
    adopted += 1;
  }

  mutableWorld.updateKingdoms();

  return { world, parentVillageId: parent.id };
}

function placeFoodPatch(world: SimWorld, position: Position, amount: number, radius: number) {
  for (const tile of world.map.tiles) {
    const dx = tile.x - position.x;
    const dy = tile.y - position.y;

    if (dx * dx + dy * dy > radius * radius) {
      continue;
    }

    tile.terrain = 'grass';
    tile.biome = 'temperate';
    tile.resource = { type: 'food', amount };
  }
}

function placeWoodDeposit(world: SimWorld, position: Position, amount: number) {
  const tile = world.map.tiles.find(
    (candidate) => candidate.x === position.x && candidate.y === position.y,
  );

  if (!tile) {
    return;
  }

  tile.terrain = 'forest';
  tile.biome = 'woodland';
  tile.resource = { type: 'wood', amount };
}
