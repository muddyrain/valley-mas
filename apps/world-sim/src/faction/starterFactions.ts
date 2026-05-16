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
const STARTER_UNIT_COUNT = 10;
const HUMAN_STARTER_X_RATIO = 0.25;
const ORC_STARTER_X_RATIO = 0.75;
const STARTER_UNIT_NAMES = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
  'kappa',
];

export function createM1StarterFactions(
  map: Pick<TestWorldMap, 'width' | 'height' | 'tileSize'>,
): StarterFactionSpec[] {
  const centerTileY = Math.floor(map.height / 2);

  return [
    createStarterFaction({
      factionId: HUMAN_FACTION_ID,
      race: 'human',
      tileX: getStarterTileX(map.width, HUMAN_STARTER_X_RATIO),
      tileY: centerTileY,
      unitPrefix: 'human',
      map,
    }),
    createStarterFaction({
      factionId: ORC_FACTION_ID,
      race: 'orc',
      tileX: getStarterTileX(map.width, ORC_STARTER_X_RATIO),
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

function getStarterTileX(width: number, ratio: number) {
  const edgePaddingTiles = Math.min(4, Math.max(1, Math.floor(width / 8)));
  const minTileX = edgePaddingTiles;
  const maxTileX = Math.max(minTileX, width - 1 - edgePaddingTiles);

  return Math.min(maxTileX, Math.max(minTileX, Math.floor(width * ratio)));
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
  const unitSpacing = options.map.tileSize;
  const unitOffsets = [
    { x: -2, y: -1 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: -2, y: 1 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ];

  return {
    factionId: options.factionId,
    race: options.race,
    capitalPosition,
    buildPoint,
    starterTerritoryRadiusTiles: STARTER_TERRITORY_RADIUS_TILES,
    units: unitOffsets.slice(0, STARTER_UNIT_COUNT).map((offset, index) => ({
      id: `${options.unitPrefix}-unit-${String(index + 1).padStart(3, '0')}`,
      name: `${options.unitPrefix}-${STARTER_UNIT_NAMES[index]}`,
      x: centerX + offset.x * unitSpacing,
      y: centerY + offset.y * unitSpacing,
      race: options.race,
      gender: index < STARTER_UNIT_COUNT / 2 ? 'male' : 'female',
      factionId: options.factionId,
      wanderRadius: options.wanderRadius,
      restPoint: capitalPosition,
    })),
  };
}
