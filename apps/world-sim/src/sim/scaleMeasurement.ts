import { SimWorld } from './SimWorld';
import type {
  SimCommand,
  SimStepPhaseTimings,
  UnitRace,
  WorldProjection,
  WorldProjectionViewport,
} from './types';

export type ScaleMeasurementScenario = {
  name?: string;
  seed: string;
  width: number;
  height: number;
  initialUnits: number;
  warmupTicks: number;
  measuredTicks: number;
  viewport: WorldProjectionViewport;
  distribution?: 'center' | 'grid';
};

export type ProjectionEntityCounts = {
  tiles: number;
  units: number;
  villages: number;
  kingdoms: number;
  buildings: number;
  armies: number;
  territory: number;
  populationStat: number;
};

export type ScaleMeasurementStepPhaseAverages = SimStepPhaseTimings & {
  spatialIndexRebuild: number;
};

export type ScaleMeasurementResult = {
  scenario: ScaleMeasurementScenario;
  population: number;
  timings: {
    createWorldMs: number;
    totalStepMs: number;
    averageStepMs: number;
    phaseAverageMs: ScaleMeasurementStepPhaseAverages;
    slowestPhase: {
      name: keyof ScaleMeasurementStepPhaseAverages;
      averageMs: number;
    };
    fullProjectionMs: number;
    viewportProjectionMs: number;
  };
  counts: {
    global: {
      population: number;
      villages: number;
      kingdoms: number;
      buildings: number;
      activeArmies: number;
      territoryTiles: number;
    };
    full: ProjectionEntityCounts;
    viewport: ProjectionEntityCounts;
  };
};

export const SCALE_MEASUREMENT_SCENARIOS: ScaleMeasurementScenario[] = [
  createScaleMeasurementScenario('scale-1000', 1000),
  createScaleMeasurementScenario('scale-3000', 3000),
  createScaleMeasurementScenario('scale-5000', 5000),
  createScaleMeasurementScenario('scale-10000', 10000),
];

export function measureScaleScenario(scenario: ScaleMeasurementScenario): ScaleMeasurementResult {
  const createWorldStart = performance.now();
  const world = new SimWorld({
    seed: scenario.seed,
    width: scenario.width,
    height: scenario.height,
    initialUnits: scenario.distribution === 'center' ? scenario.initialUnits : 0,
  });
  seedGridPopulation(world, scenario);
  const createWorldMs = performance.now() - createWorldStart;

  runTicks(world, scenario.warmupTicks);

  const stepStart = performance.now();
  runTicks(world, scenario.measuredTicks);
  const totalStepMs = performance.now() - stepStart;
  const phaseAverageMs = averageStepPhaseTimings(world.stepProfiled(), 1);
  const slowestPhase = findSlowestStepPhase(phaseAverageMs);

  const fullProjectionStart = performance.now();
  const fullProjection = world.project();
  const fullProjectionMs = performance.now() - fullProjectionStart;

  const viewportProjectionStart = performance.now();
  const viewportProjection = world.project({ viewport: scenario.viewport });
  const viewportProjectionMs = performance.now() - viewportProjectionStart;

  return {
    scenario: { ...scenario, viewport: { ...scenario.viewport } },
    population: fullProjection.stats.population,
    timings: {
      createWorldMs: round(createWorldMs),
      totalStepMs: round(totalStepMs),
      averageStepMs: round(totalStepMs / Math.max(1, scenario.measuredTicks)),
      phaseAverageMs,
      slowestPhase,
      fullProjectionMs: round(fullProjectionMs),
      viewportProjectionMs: round(viewportProjectionMs),
    },
    counts: {
      global: {
        population: fullProjection.stats.population,
        villages: fullProjection.stats.villages,
        kingdoms: fullProjection.stats.kingdoms,
        buildings: fullProjection.stats.buildings,
        activeArmies: fullProjection.stats.activeArmies,
        territoryTiles: fullProjection.stats.territoryTiles,
      },
      full: countProjectionEntities(fullProjection),
      viewport: countProjectionEntities(viewportProjection),
    },
  };
}

export function measureScaleScenarios(
  scenarios: ScaleMeasurementScenario[] = SCALE_MEASUREMENT_SCENARIOS,
) {
  return scenarios.map((scenario) => measureScaleScenario(scenario));
}

export function formatScaleMeasurement(result: ScaleMeasurementResult) {
  const label = result.scenario.name ?? result.scenario.seed;
  const timing = result.timings;

  return [
    label,
    `units=${result.scenario.initialUnits}`,
    `population=${result.population}`,
    `createMs=${formatMs(timing.createWorldMs)}`,
    `avgStepMs=${formatMs(timing.averageStepMs)}`,
    `slowest=${timing.slowestPhase.name}:${formatMs(timing.slowestPhase.averageMs)}`,
    `behaviorUpdates=${timing.phaseAverageMs.unitBehaviorUpdates}/${timing.phaseAverageMs.unitBehaviorCandidates}`,
    `fullProjectMs=${formatMs(timing.fullProjectionMs)}`,
    `viewportProjectMs=${formatMs(timing.viewportProjectionMs)}`,
    `viewportUnits=${result.counts.viewport.units}`,
    `viewportTiles=${result.counts.viewport.tiles}`,
  ].join(' | ');
}

function createScaleMeasurementScenario(
  seed: string,
  initialUnits: number,
): ScaleMeasurementScenario {
  return {
    name: seed,
    seed,
    width: 128,
    height: 128,
    initialUnits,
    warmupTicks: 10,
    measuredTicks: 30,
    viewport: {
      x: 48,
      y: 48,
      width: 24,
      height: 16,
      paddingTiles: 2,
    },
    distribution: 'grid',
  };
}

function runTicks(world: SimWorld, ticks: number) {
  for (let tick = 0; tick < ticks; tick += 1) {
    world.step();
  }
}

function countProjectionEntities(projection: WorldProjection): ProjectionEntityCounts {
  return {
    tiles: projection.tiles.length,
    units: projection.units.length,
    villages: projection.villages.length,
    kingdoms: projection.kingdoms.length,
    buildings: projection.buildings.length,
    armies: projection.armies.length,
    territory: projection.territory.length,
    populationStat: projection.stats.population,
  };
}

function averageStepPhaseTimings(
  totals: SimStepPhaseTimings,
  ticks: number,
): ScaleMeasurementStepPhaseAverages {
  const divisor = Math.max(1, ticks);
  const averages: ScaleMeasurementStepPhaseAverages = {
    commandDrain: round(totals.commandDrain / divisor),
    spatialIndexRebuildBeforeVillages: round(totals.spatialIndexRebuildBeforeVillages / divisor),
    formVillages: round(totals.formVillages / divisor),
    rebuildVillageResidentsIndex: round(totals.rebuildVillageResidentsIndex / divisor),
    updateUnits: round(totals.updateUnits / divisor),
    updateUnitNeeds: round(totals.updateUnitNeeds / divisor),
    nearbyFoodLookup: round(totals.nearbyFoodLookup / divisor),
    nearestFoodLookup: round(totals.nearestFoodLookup / divisor),
    unitMovement: round(totals.unitMovement / divisor),
    reproduction: round(totals.reproduction / divisor),
    removeDeadUnits: round(totals.removeDeadUnits / divisor),
    unitBehaviorCandidates: round(totals.unitBehaviorCandidates / divisor),
    unitBehaviorUpdates: round(totals.unitBehaviorUpdates / divisor),
    unitBehaviorSkipped: round(totals.unitBehaviorSkipped / divisor),
    spatialIndexRebuildBeforeVillagesUpdate: round(
      totals.spatialIndexRebuildBeforeVillagesUpdate / divisor,
    ),
    updateVillages: round(totals.updateVillages / divisor),
    updateVillagePresence: round(totals.updateVillagePresence / divisor),
    updateVillageResidents: round(totals.updateVillageResidents / divisor),
    updateVillageEconomy: round(totals.updateVillageEconomy / divisor),
    updateVillageConsumption: round(totals.updateVillageConsumption / divisor),
    updateKingdoms: round(totals.updateKingdoms / divisor),
    updateDiplomacy: round(totals.updateDiplomacy / divisor),
    updateArmies: round(totals.updateArmies / divisor),
    spatialIndexRebuildAfterArmies: round(totals.spatialIndexRebuildAfterArmies / divisor),
    total: round(totals.total / divisor),
    spatialIndexRebuild: round(
      (totals.spatialIndexRebuildBeforeVillages +
        totals.spatialIndexRebuildBeforeVillagesUpdate +
        totals.spatialIndexRebuildAfterArmies) /
        divisor,
    ),
  };

  return averages;
}

function findSlowestStepPhase(averages: ScaleMeasurementStepPhaseAverages) {
  const phases = Object.entries(averages).filter(
    ([name]) =>
      name !== 'total' &&
      name !== 'unitBehaviorCandidates' &&
      name !== 'unitBehaviorUpdates' &&
      name !== 'unitBehaviorSkipped',
  );
  const [name, averageMs] = phases.reduce(
    (slowest, candidate) => (candidate[1] > slowest[1] ? candidate : slowest),
    phases[0],
  ) as [keyof ScaleMeasurementStepPhaseAverages, number];

  return {
    name,
    averageMs: round(averageMs),
  };
}

function seedGridPopulation(world: SimWorld, scenario: ScaleMeasurementScenario) {
  if (scenario.distribution === 'center') {
    return;
  }

  const maxSpawnPerCommand = 200;
  const clusterCount = Math.ceil(scenario.initialUnits / maxSpawnPerCommand);
  const positions = gridPositions(scenario.width, scenario.height, clusterCount);
  let remainingUnits = scenario.initialUnits;

  for (const [index, position] of positions.entries()) {
    if (remainingUnits <= 0) {
      break;
    }

    const count = Math.min(maxSpawnPerCommand, remainingUnits);
    const race = RACES[index % RACES.length];
    const issuedAtTick = world.currentTick;
    const commands: SimCommand[] = [
      {
        id: `scale-food-${index}`,
        type: 'place_resource',
        issuedAtTick,
        payload: {
          resourceType: 'food',
          position,
          amount: 900,
          radius: 5,
        },
      },
      {
        id: `scale-units-${index}`,
        type: 'spawn_unit',
        issuedAtTick,
        payload: {
          race,
          position,
          count,
        },
      },
    ];

    for (const command of commands) {
      world.enqueue(command);
    }

    remainingUnits -= count;
  }

  world.step();
}

function gridPositions(width: number, height: number, count: number) {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const margin = 10;
  const usableWidth = Math.max(1, width - margin * 2);
  const usableHeight = Math.max(1, height - margin * 2);

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      x: margin + (usableWidth * (column + 0.5)) / columns,
      y: margin + (usableHeight * (row + 0.5)) / rows,
    };
  });
}

function formatMs(value: number) {
  return value.toFixed(3);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

const RACES: UnitRace[] = ['human', 'orc', 'elf', 'dwarf'];
