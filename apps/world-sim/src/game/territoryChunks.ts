import type { WorldProjection, WorldProjectionViewport } from '../sim';

export const TERRITORY_CHUNK_SIZE_TILES = 64;

export type TerritoryChunkBounds = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sampleViewport: WorldProjectionViewport;
};

export type TerritoryRegionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type TerritoryRegion = {
  id: string;
  bounds: TerritoryRegionBounds;
};

export type TerritoryRegionGeometry = {
  renderRuns: {
    x: number;
    y: number;
    length: number;
  }[];
};

export type RegionGeometryLookup = Map<string, TerritoryRegionGeometry>;

export type TerritoryRegionProjection = {
  regions: TerritoryRegion[];
};

export function buildVisibleTerritoryChunks(
  projection: Pick<WorldProjection, 'width' | 'height' | 'viewport'>,
  chunkSize = TERRITORY_CHUNK_SIZE_TILES,
): TerritoryChunkBounds[] {
  const viewport = projection.viewport ?? {
    x: 0,
    y: 0,
    width: projection.width,
    height: projection.height,
  };
  const minChunkX = Math.max(0, Math.floor(viewport.x / chunkSize));
  const minChunkY = Math.max(0, Math.floor(viewport.y / chunkSize));
  const maxChunkX = Math.min(
    Math.ceil(projection.width / chunkSize) - 1,
    Math.floor((viewport.x + viewport.width - 1) / chunkSize),
  );
  const maxChunkY = Math.min(
    Math.ceil(projection.height / chunkSize) - 1,
    Math.floor((viewport.y + viewport.height - 1) / chunkSize),
  );
  const chunks: TerritoryChunkBounds[] = [];

  for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      const x = chunkX * chunkSize;
      const y = chunkY * chunkSize;
      const width = Math.min(chunkSize, projection.width - x);
      const height = Math.min(chunkSize, projection.height - y);
      chunks.push({
        key: `${chunkX}:${chunkY}`,
        x,
        y,
        width,
        height,
        sampleViewport: {
          x: Math.max(0, x - 1),
          y: Math.max(0, y - 1),
          width: Math.min(projection.width, x + width + 1) - Math.max(0, x - 1),
          height: Math.min(projection.height, y + height + 1) - Math.max(0, y - 1),
        },
      });
    }
  }

  return chunks;
}

export function buildVisibleRegionIdsForViewport(
  projection: TerritoryRegionProjection,
  geometryByRegionId: RegionGeometryLookup,
  viewport: WorldProjectionViewport,
) {
  const minX = Math.floor(viewport.x);
  const minY = Math.floor(viewport.y);
  const maxX = Math.ceil(viewport.x + viewport.width);
  const maxY = Math.ceil(viewport.y + viewport.height);
  const visibleRegionIds = new Set<string>();

  for (const region of projection.regions) {
    if (!boundsIntersect(region.bounds, minX, minY, maxX, maxY)) {
      continue;
    }

    const geometry = geometryByRegionId.get(region.id);
    if (!geometry) {
      visibleRegionIds.add(region.id);
      continue;
    }

    if (
      geometry.renderRuns.some(
        (run) => run.y >= minY && run.y < maxY && run.x + run.length > minX && run.x < maxX,
      )
    ) {
      visibleRegionIds.add(region.id);
    }
  }

  return visibleRegionIds;
}

function boundsIntersect(
  bounds: TerritoryRegionBounds,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  return (
    bounds.minX < maxX && bounds.maxX + 1 > minX && bounds.minY < maxY && bounds.maxY + 1 > minY
  );
}
