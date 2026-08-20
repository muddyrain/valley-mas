import type {
  ResourceNodeSnapshot,
  TerritorySnapshot,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from '@/render/renderTypes';
import {
  type EcologyDiagnostics,
  type PopulationDiagnostics,
  ResourceNodeKind,
  ResourceNodeStage,
  TerrainType,
} from '@/shared/gameTypes';
import type { SimulationKernel } from '@/simulation/kernel/kernel';
import { NaturalResourceKind, NaturalResourceStage } from '@/simulation/resources/naturalResources';
import { createDefaultWorldLaws } from '@/simulation/rules/worldLawCatalog';
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

export function projectKernelSnapshot(
  kernel: SimulationKernel,
  metrics: KernelProjectionMetrics,
): WorldRenderSnapshot {
  return {
    tick: kernel.state.tick,
    year: 1 + Math.floor(kernel.state.tick / 7_200),
    population: 0,
    active: new Uint8Array(0),
    positionsX: new Float32Array(0),
    positionsZ: new Float32Array(0),
    headings: new Float32Array(0),
    states: new Uint8Array(0),
    kinds: new Uint8Array(0),
    villageIds: new Uint16Array(0),
    kingdomIds: new Uint16Array(0),
    health: new Uint16Array(0),
    infected: new Uint8Array(0),
    professions: new Uint8Array(0),
    levels: new Uint8Array(0),
    roles: new Uint8Array(0),
    weaponTiers: new Uint8Array(0),
    armorTiers: new Uint8Array(0),
    ages: new Uint16Array(0),
    targetCells: new Uint32Array(0),
    carriedResourceKinds: new Uint8Array(0),
    carriedResources: new Uint8Array(0),
    stats: {
      year: 1 + Math.floor(kernel.state.tick / 7_200),
      humans: 0,
      animals: 0,
      villages: 0,
      kingdoms: 0,
      wars: 0,
      populationTrend: 0,
    },
    villages: [],
    kingdoms: [],
    buildings: [],
    carcasses: [],
    events: [],
    historyRevision: 0,
    settings: { speed: kernel.playbackRate, quality: 'high', overlay: 'none' },
    demographics: emptyPopulationDiagnostics(),
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
