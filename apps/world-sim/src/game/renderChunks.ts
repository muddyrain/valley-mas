export type RenderChunkBounds = {
  key: string;
  chunkX: number;
  chunkY: number;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
};

export type TileExtents = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const SEAM_OVERDRAW_PIXELS = 1;
const CACHED_TERRAIN_FILL_ALPHA = 1;

type TileRunRectInput = {
  x: number;
  y: number;
  width: number;
};

type TileOriginInput = {
  tileX: number;
  tileY: number;
};

export function getRenderChunkBounds(
  chunkX: number,
  chunkY: number,
  worldWidth: number,
  worldHeight: number,
  chunkTiles: number,
): RenderChunkBounds {
  const tileX = chunkX * chunkTiles;
  const tileY = chunkY * chunkTiles;

  return {
    key: `${chunkX}:${chunkY}`,
    chunkX,
    chunkY,
    tileX,
    tileY,
    width: Math.max(0, Math.min(chunkTiles, worldWidth - tileX)),
    height: Math.max(0, Math.min(chunkTiles, worldHeight - tileY)),
  };
}

export function getChunkKeyForTile(x: number, y: number, chunkTiles: number) {
  return `${Math.floor(x / chunkTiles)}:${Math.floor(y / chunkTiles)}`;
}

export function getVisibleChunkKeys(tiles: Array<{ x: number; y: number }>, chunkTiles: number) {
  return new Set(tiles.map((tile) => getChunkKeyForTile(tile.x, tile.y, chunkTiles)));
}

export function getVisibleChunkKeySignature(
  tiles: Array<{ x: number; y: number }>,
  chunkTiles: number,
) {
  return [...getVisibleChunkKeys(tiles, chunkTiles)].sort().join('|');
}

export function getCachedTerrainFillAlpha() {
  return CACHED_TERRAIN_FILL_ALPHA;
}

export function getSeamSafeRenderTextureSize(
  bounds: Pick<RenderChunkBounds, 'width' | 'height'>,
  tileSize: number,
) {
  return {
    width: bounds.width * tileSize + SEAM_OVERDRAW_PIXELS,
    height: bounds.height * tileSize + SEAM_OVERDRAW_PIXELS,
  };
}

export function getSeamSafeTileRunRect(
  run: TileRunRectInput,
  origin: TileOriginInput,
  tileSize: number,
) {
  return {
    x: (run.x - origin.tileX) * tileSize,
    y: (run.y - origin.tileY) * tileSize,
    width: run.width * tileSize + SEAM_OVERDRAW_PIXELS,
    height: tileSize + SEAM_OVERDRAW_PIXELS,
  };
}

export function getTileExtents(tiles: Array<{ x: number; y: number }>): TileExtents | undefined {
  if (tiles.length === 0) {
    return undefined;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const tile of tiles) {
    minX = Math.min(minX, tile.x);
    minY = Math.min(minY, tile.y);
    maxX = Math.max(maxX, tile.x);
    maxY = Math.max(maxY, tile.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
