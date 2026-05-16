export const TILE_SIZE = 16;
export const TEST_MAP_SIZE = 64;

export type TerrainType = 'grass' | 'forest' | 'mountain' | 'water' | 'desert' | 'snow' | 'lava';
export type ResourceType = 'food' | 'wood' | 'stone' | 'iron';

export type TerrainTile = {
  x: number;
  y: number;
  terrainType: TerrainType;
  ownerFactionId?: string;
  resourceType?: ResourceType;
  resourceAmount: number;
  resourceCapacity: number;
};

export type TestWorldMap = {
  width: number;
  height: number;
  tileSize: number;
  tiles: TerrainTile[];
};

export const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x38b764,
  forest: 0x257179,
  mountain: 0x566c86,
  water: 0x29366f,
  desert: 0xffcd75,
  snow: 0xf4f4f4,
  lava: 0xef7d57,
};

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  grass: '草地',
  forest: '森林',
  mountain: '山地',
  water: '水域',
  desert: '沙漠',
  snow: '雪地',
  lava: '熔岩',
};

export function createTestWorldMap(size = TEST_MAP_SIZE): TestWorldMap {
  const tiles: TerrainTile[] = [];
  const center = (size - 1) / 2;
  const maxDistance = Math.hypot(center, center);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      tiles.push({
        x,
        y,
        ...createTerrainTile(x, y, center, maxDistance),
      });
    }
  }

  return {
    width: size,
    height: size,
    tileSize: TILE_SIZE,
    tiles,
  };
}

function createTerrainTile(
  x: number,
  y: number,
  center: number,
  maxDistance: number,
): Pick<
  TerrainTile,
  'terrainType' | 'ownerFactionId' | 'resourceType' | 'resourceAmount' | 'resourceCapacity'
> {
  const terrainType = pickTerrainType(x, y, center, maxDistance);
  const resource = pickInitialResource(terrainType, x, y);

  return {
    terrainType,
    ownerFactionId: undefined,
    resourceType: resource?.type,
    resourceAmount: resource?.amount ?? 0,
    resourceCapacity: resource?.amount ?? 0,
  };
}

function pickTerrainType(x: number, y: number, center: number, maxDistance: number): TerrainType {
  const distanceFromCenter = Math.hypot(x - center, y - center) / maxDistance;
  const ridge = Math.sin(x * 0.34) + Math.cos(y * 0.27);

  if (distanceFromCenter > 0.9) {
    return 'water';
  }

  if (distanceFromCenter > 0.78 && ridge < 0.55) {
    return 'water';
  }

  if (x > 47 && y < 18) {
    return 'snow';
  }

  if (x > 42 && y > 42) {
    return 'desert';
  }

  if (Math.abs(x - 33) < 3 && y > 43) {
    return 'lava';
  }

  if (ridge > 1.25 || (x > 20 && x < 30 && y > 9 && y < 30)) {
    return 'mountain';
  }

  if (ridge < -0.55 || (x > 9 && x < 24 && y > 34 && y < 52)) {
    return 'forest';
  }

  return 'grass';
}

function pickInitialResource(terrainType: TerrainType, x: number, y: number) {
  if (terrainType === 'forest') {
    return {
      type: 'wood' as const,
      amount: 10,
    };
  }

  if (terrainType === 'mountain') {
    return {
      type: (x + y) % 7 === 0 ? ('iron' as const) : ('stone' as const),
      amount: 20,
    };
  }

  if (terrainType === 'grass' && (x * 13 + y * 7) % 23 === 0) {
    return {
      type: 'food' as const,
      amount: 8,
    };
  }

  return undefined;
}
