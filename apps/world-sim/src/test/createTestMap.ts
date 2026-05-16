import type { ResourceType, TerrainTile, TerrainType, TestWorldMap } from '../world/testMap';

type TestTileInput = {
  x: number;
  y: number;
  terrainType: TerrainType;
  ownerFactionId?: string;
  resourceType?: ResourceType;
  resourceAmount?: number;
};

export function createSmallTestMap(tileInputs: TestTileInput[], size = 4): TestWorldMap {
  const tiles: TerrainTile[] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      tiles.push({
        x,
        y,
        terrainType: 'grass',
        ownerFactionId: undefined,
        resourceAmount: 0,
        resourceCapacity: 0,
      });
    }
  }

  for (const input of tileInputs) {
    const tile = tiles[input.y * size + input.x];
    const resourceAmount = input.resourceAmount ?? 0;

    Object.assign(tile, {
      terrainType: input.terrainType,
      ownerFactionId: input.ownerFactionId,
      resourceType: input.resourceType,
      resourceAmount,
      resourceCapacity: resourceAmount,
    });
  }

  return {
    width: size,
    height: size,
    tileSize: 16,
    tiles,
  };
}
