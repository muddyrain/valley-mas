import { SimWorld } from './SimWorld';
import type { Position, ResourceType, TerrainType, VillageBuildingType } from './types';

export type BuildingSiteObservationOptions = {
  seeds?: string[];
  ticks?: number;
};

export type BuildingSiteObservation = {
  buildingId: string;
  villageId: string;
  type: VillageBuildingType;
  position: Position;
  resourceType?: ResourceType;
  centerDistance: number;
  nearestFoodDistance: number;
  nearestStoneOrIronDistance: number;
  nearestWaterDistance: number;
  sameTypeNearestDistance: number;
};

export type BuildingSiteObservationRun = {
  seed: string;
  sites: BuildingSiteObservation[];
};

export type BuildingSiteObservationReport = {
  ticks: number;
  runs: BuildingSiteObservationRun[];
};

const DEFAULT_BUILDING_SITE_SEEDS = [
  'building-site-observation-a',
  'building-site-observation-b',
  'building-site-observation-c',
];

export function observeBuildingSiteReport(
  options: BuildingSiteObservationOptions = {},
): BuildingSiteObservationReport {
  const ticks = options.ticks ?? 180;
  const seeds = options.seeds ?? DEFAULT_BUILDING_SITE_SEEDS;

  return {
    ticks,
    runs: seeds.map((seed) => observeBuildingSiteRun(seed, ticks)),
  };
}

export function formatBuildingSiteObservationReport(report: BuildingSiteObservationReport) {
  return report.runs.map(formatBuildingSiteObservationRun).join('\n');
}

function formatBuildingSiteObservationRun(run: BuildingSiteObservationRun) {
  return run.sites
    .map((site) =>
      [
        run.seed,
        `id=${site.buildingId}`,
        `type=${site.type}`,
        `x=${round(site.position.x)}`,
        `y=${round(site.position.y)}`,
        `resource=${site.resourceType ?? '-'}`,
        `center=${round(site.centerDistance)}`,
        `food=${formatDistance(site.nearestFoodDistance)}`,
        `stoneOrIron=${formatDistance(site.nearestStoneOrIronDistance)}`,
        `water=${formatDistance(site.nearestWaterDistance)}`,
        `sameType=${formatDistance(site.sameTypeNearestDistance)}`,
      ].join(' | '),
    )
    .join('\n');
}

function observeBuildingSiteRun(seed: string, ticks: number): BuildingSiteObservationRun {
  const world = createBuildingSiteObservationWorld(seed);

  for (let tick = 0; tick < ticks; tick += 1) {
    world.step();
  }

  const projection = world.project();
  const sites = projection.buildings
    .filter((building) => building.type !== 'town_hall')
    .map((building): BuildingSiteObservation | undefined => {
      const village = projection.villages.find((candidate) => candidate.id === building.villageId);

      if (!village) {
        return undefined;
      }

      const sameTypeBuildings = projection.buildings.filter(
        (candidate) =>
          candidate.id !== building.id &&
          candidate.villageId === building.villageId &&
          candidate.type === building.type,
      );

      return {
        buildingId: building.id,
        villageId: building.villageId,
        type: building.type,
        position: building.position,
        resourceType: resourceAt(world, building.position),
        centerDistance: distance(building.position, village.center),
        nearestFoodDistance: nearestResourceDistance(world, building.position, 'food'),
        nearestStoneOrIronDistance: Math.min(
          nearestResourceDistance(world, building.position, 'stone'),
          nearestResourceDistance(world, building.position, 'iron'),
        ),
        nearestWaterDistance: nearestTerrainDistance(world, building.position, 'water'),
        sameTypeNearestDistance: nearestPositionDistance(
          building.position,
          sameTypeBuildings.map((candidate) => candidate.position),
        ),
      };
    })
    .filter((site): site is BuildingSiteObservation => Boolean(site))
    .sort((left, right) => {
      const typeOrder = left.type.localeCompare(right.type);
      return typeOrder === 0 ? left.buildingId.localeCompare(right.buildingId) : typeOrder;
    });

  return { seed, sites };
}

function createBuildingSiteObservationWorld(seed: string) {
  const world = new SimWorld({ seed, width: 44, height: 32, initialUnits: 0 });

  world.enqueue({
    id: 'building-sites-food',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'food',
      position: { x: 16, y: 14 },
      amount: 700,
      radius: 5,
    },
  });
  world.enqueue({
    id: 'building-sites-wood-terrain',
    type: 'change_terrain',
    issuedAtTick: 0,
    payload: {
      terrain: 'forest',
      position: { x: 23, y: 14 },
    },
  });
  world.enqueue({
    id: 'building-sites-wood',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'wood',
      position: { x: 23, y: 14 },
      amount: 240,
    },
  });
  world.enqueue({
    id: 'building-sites-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'human',
      position: { x: 16, y: 14 },
      count: 12,
    },
  });
  world.step();

  return world;
}

function resourceAt(world: SimWorld, position: Position) {
  const tile = world.map.tiles.find(
    (candidate) => candidate.x === Math.floor(position.x) && candidate.y === Math.floor(position.y),
  );

  return tile?.resource && tile.resource.amount > 0 ? tile.resource.type : undefined;
}

function nearestResourceDistance(world: SimWorld, position: Position, type: ResourceType) {
  return nearestPositionDistance(
    position,
    world.map.tiles
      .filter((tile) => tile.resource?.type === type && tile.resource.amount > 0)
      .map((tile) => ({ x: tile.x, y: tile.y })),
  );
}

function nearestTerrainDistance(world: SimWorld, position: Position, terrain: TerrainType) {
  return nearestPositionDistance(
    position,
    world.map.tiles
      .filter((tile) => tile.terrain === terrain)
      .map((tile) => ({ x: tile.x, y: tile.y })),
  );
}

function nearestPositionDistance(position: Position, positions: Position[]) {
  if (positions.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...positions.map((candidate) => distance(position, candidate)));
}

function distance(left: Position, right: Position) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function formatDistance(value: number) {
  return Number.isFinite(value) ? String(round(value)) : '-';
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
