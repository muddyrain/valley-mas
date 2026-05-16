import type { Unit } from '../agent/Unit';
import type { TestWorldMap } from '../world/testMap';

export type StarterUnitSpec = {
  id: string;
  name: string;
  x: number;
  y: number;
  race: Unit['race'];
  gender: Unit['gender'];
  factionId: string;
  wanderRadius?: number;
  restPoint: {
    x: number;
    y: number;
  };
};

export type StarterFactionSpec = {
  factionId: string;
  race: Unit['race'];
  capitalPosition: {
    x: number;
    y: number;
  };
  buildPoint: {
    x: number;
    y: number;
  };
  starterTerritoryRadiusTiles: number;
  units: StarterUnitSpec[];
};

export type HumanPrototypeCampPoints = {
  buildPoint: {
    x: number;
    y: number;
  };
  restPoint: {
    x: number;
    y: number;
  };
};

export const HUMAN_FACTION_ID = 'faction-1';
export const ORC_FACTION_ID = 'faction-2';
export const STARTER_TERRITORY_RADIUS_TILES = 2;

export function createM1StarterFactions(
  map: Pick<TestWorldMap, 'width' | 'height' | 'tileSize'>,
): StarterFactionSpec[] {
  const centerTileX = Math.floor(map.width / 2);
  const centerTileY = Math.floor(map.height / 2);

  return [
    createStarterFaction({
      factionId: HUMAN_FACTION_ID,
      race: 'human',
      tileX: centerTileX,
      tileY: centerTileY,
      unitPrefix: 'human',
      map,
    }),
    createStarterFaction({
      factionId: ORC_FACTION_ID,
      race: 'orc',
      tileX: Math.min(map.width - 4, centerTileX + 10),
      tileY: centerTileY,
      unitPrefix: 'orc',
      wanderRadius: 32,
      map,
    }),
  ];
}

export function getHumanPrototypeCampPoints(
  map: Pick<TestWorldMap, 'width' | 'height' | 'tileSize'>,
): HumanPrototypeCampPoints {
  const [humanStarter] = createM1StarterFactions(map);

  return {
    buildPoint: {
      x: humanStarter.capitalPosition.x + map.tileSize,
      y: humanStarter.capitalPosition.y + map.tileSize,
    },
    restPoint: {
      ...humanStarter.capitalPosition,
    },
  };
}

function createStarterFaction(options: {
  factionId: string;
  race: Unit['race'];
  tileX: number;
  tileY: number;
  unitPrefix: string;
  wanderRadius?: number;
  map: Pick<TestWorldMap, 'tileSize'>;
}): StarterFactionSpec {
  const centerX = options.tileX * options.map.tileSize + options.map.tileSize / 2;
  const centerY = options.tileY * options.map.tileSize + options.map.tileSize / 2;
  const capitalPosition = {
    x: centerX,
    y: centerY,
  };
  const buildPoint = {
    x: centerX + options.map.tileSize,
    y: centerY + options.map.tileSize,
  };

  return {
    factionId: options.factionId,
    race: options.race,
    capitalPosition,
    buildPoint,
    starterTerritoryRadiusTiles: STARTER_TERRITORY_RADIUS_TILES,
    units: [
      {
        id: `${options.unitPrefix}-unit-001`,
        name: `${options.unitPrefix}-alpha`,
        x: centerX - options.map.tileSize / 2,
        y: centerY,
        race: options.race,
        gender: 'male',
        factionId: options.factionId,
        wanderRadius: options.wanderRadius,
        restPoint: capitalPosition,
      },
      {
        id: `${options.unitPrefix}-unit-002`,
        name: `${options.unitPrefix}-beta`,
        x: centerX + options.map.tileSize / 2,
        y: centerY,
        race: options.race,
        gender: 'female',
        factionId: options.factionId,
        wanderRadius: options.wanderRadius,
        restPoint: capitalPosition,
      },
    ],
  };
}
