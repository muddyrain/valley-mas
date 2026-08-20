import { TerrainType, type WorldMap, type WorldPreset } from '@/shared/gameTypes';
import { stableNoise } from '@/shared/random';
import { createNavigationGrid, toCell } from '../navigation/grid';
import { generateWorldFoundation } from '../world/topology';

function terrainCost(terrain: TerrainType): number {
  if (
    terrain === TerrainType.DeepOcean ||
    terrain === TerrainType.ShallowOcean ||
    terrain === TerrainType.Mountain
  ) {
    return 0;
  }
  if (terrain === TerrainType.Forest || terrain === TerrainType.Snow) return 6;
  if (terrain === TerrainType.Desert) return 5;
  if (terrain === TerrainType.Beach) return 3;
  return 4;
}

export function generateWorldMap(
  seed: string,
  size = 128,
  preset: WorldPreset = 'archipelago',
): WorldMap {
  const cellCount = size * size;
  const terrain = new Uint8Array(cellCount);
  const foundation = generateWorldFoundation(seed, size, preset);
  const height = foundation.elevation;
  const moisture = foundation.moisture;
  const temperature = foundation.temperature;
  const resourceFood = new Uint16Array(cellCount);
  const resourceWood = new Uint16Array(cellCount);
  const resourceStone = new Uint16Array(cellCount);
  const random = foundation.nextMapRandom;
  const navigation = createNavigationGrid(size, size);

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const cell = toCell(navigation, x, z);
      const elevation = foundation.normalizedElevation[cell] ?? -0.32;
      const wet = moisture[cell] ?? 0;
      const heat = temperature[cell] ?? 0;

      let type: TerrainType;
      if (elevation < -0.12) type = TerrainType.DeepOcean;
      else if (elevation < 0.015) type = TerrainType.ShallowOcean;
      else if (elevation < 0.065) type = TerrainType.Beach;
      else if (elevation > 0.48) type = TerrainType.Mountain;
      else if (heat < 65) type = TerrainType.Snow;
      else if (wet < 65) type = TerrainType.Desert;
      else if (wet > 140 && elevation > 0.1) type = TerrainType.Forest;
      else type = TerrainType.Grass;

      if (x === 0 || z === 0 || x === size - 1 || z === size - 1) type = TerrainType.DeepOcean;
      terrain[cell] = type;
      navigation.cost[cell] = terrainCost(type);
      if (type === TerrainType.Forest) resourceWood[cell] = 12 + Math.floor(random() * 24);
      if (type === TerrainType.Grass || type === TerrainType.Beach) {
        resourceFood[cell] = 4 + Math.floor(random() * 12);
      }
      if (type === TerrainType.Mountain && elevation < 0.64) {
        resourceStone[cell] = 18 + Math.floor(random() * 30);
      }
      if (
        navigation.cost[cell] > 0 &&
        type !== TerrainType.Mountain &&
        elevation > 0.1 &&
        stableNoise(cell * 13 + 97) > 0.93
      ) {
        resourceStone[cell] = 8 + Math.floor(random() * 15);
      }
    }
  }

  return {
    size,
    preset,
    terrain,
    height,
    moisture,
    temperature,
    resourceFood,
    resourceWood,
    resourceStone,
    fire: new Uint8Array(cellCount),
    rain: new Uint8Array(cellCount),
    plague: new Uint8Array(cellCount),
    crops: new Uint8Array(cellCount),
    craters: new Uint8Array(cellCount),
    roads: new Uint8Array(cellCount),
    navigation,
    dirtyMapCells: [],
  };
}

export function navigationCostForTerrain(terrain: TerrainType, road = false): number {
  const baseCost = terrainCost(terrain);
  return baseCost === 0 ? 0 : road ? 1 : baseCost;
}
