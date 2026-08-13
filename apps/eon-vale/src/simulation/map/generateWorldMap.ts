import { TerrainType, type WorldMap, type WorldPreset } from '@/shared/gameTypes';
import { createSeededRandom, stableNoise } from '@/shared/random';
import { createNavigationGrid, toCell } from '../navigation/grid';

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

interface IslandSeed {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  height: number;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function coherentNoise(x: number, z: number, scale: number, salt: number): number {
  const scaledX = x / scale;
  const scaledZ = z / scale;
  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const tx = smoothstep(scaledX - x0);
  const tz = smoothstep(scaledZ - z0);
  const sample = (sampleX: number, sampleZ: number) =>
    stableNoise(sampleX * 73_856_093 + sampleZ * 19_349_663 + salt);
  const top = sample(x0, z0) * (1 - tx) + sample(x0 + 1, z0) * tx;
  const bottom = sample(x0, z0 + 1) * (1 - tx) + sample(x0 + 1, z0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

function createIslandSeeds(random: () => number, size: number, preset: WorldPreset): IslandSeed[] {
  if (preset === 'ocean') return [];
  if (preset === 'continent') {
    return [
      {
        x: size * (0.48 + (random() - 0.5) * 0.08),
        z: size * (0.5 + (random() - 0.5) * 0.08),
        radiusX: size * 0.42,
        radiusZ: size * 0.38,
        height: 0.72,
      },
    ];
  }
  return Array.from({ length: 7 }, (_, index) => {
    const angle = (index / 7) * Math.PI * 2 + (random() - 0.5) * 0.65;
    const ring = index === 0 ? 0 : size * (0.16 + random() * 0.18);
    return {
      x: size / 2 + Math.cos(angle) * ring,
      z: size / 2 + Math.sin(angle) * ring,
      radiusX: size * (index === 0 ? 0.29 : 0.13 + random() * 0.1),
      radiusZ: size * (index === 0 ? 0.25 : 0.12 + random() * 0.09),
      height: index === 0 ? 0.67 : 0.48 + random() * 0.18,
    };
  });
}

function elevationAt(
  x: number,
  z: number,
  size: number,
  islands: IslandSeed[],
  preset: WorldPreset,
  salt: number,
): number {
  if (preset === 'ocean') return -0.32;
  let land = -0.36;
  for (const island of islands) {
    const distance = Math.hypot((x - island.x) / island.radiusX, (z - island.z) / island.radiusZ);
    land = Math.max(land, island.height - distance * 0.72);
  }
  const broad =
    Math.sin(x * 0.071 + z * 0.019) * 0.075 +
    Math.cos(z * 0.063 - x * 0.027) * 0.065 +
    (coherentNoise(x, z, 18, salt) - 0.5) * 0.17;
  const edgeDistance = Math.min(x, z, size - 1 - x, size - 1 - z);
  const edgeFade = Math.max(0, Math.min(1, edgeDistance / Math.max(4, size * 0.08)));
  return (land + broad) * edgeFade - (1 - edgeFade) * 0.38;
}

export function generateWorldMap(
  seed: string,
  size = 128,
  preset: WorldPreset = 'archipelago',
): WorldMap {
  const cellCount = size * size;
  const terrain = new Uint8Array(cellCount);
  const height = new Float32Array(cellCount);
  const moisture = new Uint8Array(cellCount);
  const temperature = new Uint8Array(cellCount);
  const resourceFood = new Uint16Array(cellCount);
  const resourceWood = new Uint16Array(cellCount);
  const resourceStone = new Uint16Array(cellCount);
  const random = createSeededRandom(`${seed}:map:${preset}:${size}`);
  const biomeSalt = Math.floor(createSeededRandom(`${seed}:biomes`)() * 1_000_000_000);
  const islands = createIslandSeeds(random, size, preset);
  const navigation = createNavigationGrid(size, size);

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const cell = toCell(navigation, x, z);
      const elevation = elevationAt(x, z, size, islands, preset, biomeSalt);
      const wet = Math.max(
        0,
        Math.min(
          255,
          Math.round(
            118 +
              Math.sin(x * 0.028 + z * 0.011) * 34 +
              (coherentNoise(x, z, 30, biomeSalt + 41) - 0.5) * 128 +
              (coherentNoise(x, z, 12, biomeSalt + 97) - 0.5) * 28,
          ),
        ),
      );
      const heat = Math.max(
        0,
        Math.min(255, Math.round(215 - (z / size) * 160 - Math.max(0, elevation) * 52)),
      );
      height[cell] = elevation * 8;
      moisture[cell] = wet;
      temperature[cell] = heat;

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
