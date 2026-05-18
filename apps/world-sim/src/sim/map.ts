import { SeededRng } from './rng';
import type { BiomeType, Position, ResourceType, TerrainType, Tile } from './types';

export const DEFAULT_WORLD_WIDTH = 128;
export const DEFAULT_WORLD_HEIGHT = 128;
export const CHUNK_SIZE = 16;

export type ChunkKey = `${number}:${number}`;

export type WorldMap = {
  width: number;
  height: number;
  tiles: Tile[];
  chunks: Map<ChunkKey, number[]>;
};

export function createWorldMap(
  seed: string,
  width = DEFAULT_WORLD_WIDTH,
  height = DEFAULT_WORLD_HEIGHT,
) {
  const rng = new SeededRng(`${seed}:map`);
  const tiles: Tile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const terrain = pickTerrain(seed, x, y, width, height);
      tiles.push({
        x,
        y,
        terrain,
        biome: pickBiome(terrain),
        resource: pickResource(rng, terrain),
      });
    }
  }

  return {
    width,
    height,
    tiles,
    chunks: indexChunks(width, height),
  };
}

export function getTile(map: Pick<WorldMap, 'width' | 'height' | 'tiles'>, position: Position) {
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);

  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return undefined;
  }

  return map.tiles[y * map.width + x];
}

export function forEachTileInRadius(
  map: WorldMap,
  position: Position,
  radius: number,
  visit: (tile: Tile) => void,
) {
  const minX = Math.max(0, Math.floor(position.x - radius));
  const maxX = Math.min(map.width - 1, Math.floor(position.x + radius));
  const minY = Math.max(0, Math.floor(position.y - radius));
  const maxY = Math.min(map.height - 1, Math.floor(position.y + radius));
  const radiusSquared = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - position.x;
      const dy = y - position.y;

      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }

      visit(map.tiles[y * map.width + x]);
    }
  }
}

export function isWalkable(terrain: TerrainType) {
  return terrain !== 'water' && terrain !== 'lava';
}

export function resourceTotals(tiles: Tile[], type: ResourceType) {
  let amount = 0;
  let tileCount = 0;

  for (const tile of tiles) {
    if (tile.resource?.type !== type || tile.resource.amount <= 0) {
      continue;
    }

    amount += tile.resource.amount;
    tileCount += 1;
  }

  return { amount, tileCount };
}

function pickTerrain(
  seed: string,
  x: number,
  y: number,
  width: number,
  height: number,
): TerrainType {
  const nx = x / Math.max(1, width - 1);
  const ny = y / Math.max(1, height - 1);
  const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
  const wave =
    Math.sin((x + seed.length) * 0.21) +
    Math.cos((y - seed.length) * 0.17) +
    Math.sin((x + y) * 0.09);

  if (edge < 0.05) {
    return 'water';
  }

  if (wave > 1.6) {
    return 'hill';
  }

  if (wave < -1.35) {
    return 'forest';
  }

  if (nx > 0.78 && ny > 0.62) {
    return 'sand';
  }

  if (nx > 0.72 && ny < 0.22) {
    return 'snow';
  }

  if (Math.abs(nx - 0.5) < 0.025 && ny > 0.7) {
    return 'lava';
  }

  return 'grass';
}

function pickBiome(terrain: TerrainType): BiomeType {
  switch (terrain) {
    case 'forest':
      return 'woodland';
    case 'hill':
      return 'highland';
    case 'water':
      return 'coast';
    case 'sand':
      return 'dryland';
    case 'snow':
      return 'frozen';
    case 'lava':
      return 'volcanic';
    case 'grass':
      return 'temperate';
  }
}

function pickResource(rng: SeededRng, terrain: TerrainType): Tile['resource'] {
  if (terrain === 'grass' && rng.chance(0.08)) {
    return { type: 'food', amount: 8 + rng.int(8) };
  }

  if (terrain === 'forest') {
    return rng.chance(0.18)
      ? { type: 'food', amount: 6 + rng.int(6) }
      : { type: 'wood', amount: 18 };
  }

  if (terrain === 'hill') {
    return { type: rng.chance(0.2) ? 'iron' : 'stone', amount: 20 + rng.int(16) };
  }

  return undefined;
}

function indexChunks(width: number, height: number) {
  const chunks = new Map<ChunkKey, number[]>();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = getChunkKey(x, y);
      const indexes = chunks.get(key) ?? [];
      indexes.push(y * width + x);
      chunks.set(key, indexes);
    }
  }

  return chunks;
}

export function getChunkKey(x: number, y: number): ChunkKey {
  return `${Math.floor(x / CHUNK_SIZE)}:${Math.floor(y / CHUNK_SIZE)}`;
}
