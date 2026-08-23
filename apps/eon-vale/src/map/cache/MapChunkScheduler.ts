import { CHUNK_SIZE, CHUNKS_PER_AXIS, WORLD_SIZE } from '../model/WorldSnapshot';

export interface ChunkCoordinate {
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

export interface ViewportChunkRequest {
  readonly centerX: number;
  readonly centerY: number;
  readonly viewportWidthPx: number;
  readonly viewportHeightPx: number;
  readonly zoom: number;
  readonly cellPixels: number;
  readonly prefetchRings?: number;
}

export interface ViewportChunkPlan {
  readonly visible: readonly ChunkCoordinate[];
  readonly prefetch: readonly ChunkCoordinate[];
  readonly required: readonly ChunkCoordinate[];
}

export function planViewportChunks(request: ViewportChunkRequest): ViewportChunkPlan {
  const cellsWide = request.viewportWidthPx / Math.max(request.zoom * request.cellPixels, 1);
  const cellsHigh = request.viewportHeightPx / Math.max(request.zoom * request.cellPixels, 1);
  const minChunkX = chunkAt(request.centerX - cellsWide / 2);
  const maxChunkX = chunkAt(request.centerX + cellsWide / 2 - 1e-6);
  const minChunkY = chunkAt(request.centerY - cellsHigh / 2);
  const maxChunkY = chunkAt(request.centerY + cellsHigh / 2 - 1e-6);
  const centerChunkX = chunkAt(request.centerX);
  const centerChunkY = chunkAt(request.centerY);
  const visible = coordinatesInRect(minChunkX, minChunkY, maxChunkX, maxChunkY).sort(
    (left, right) => comparePriority(left, right, centerChunkX, centerChunkY),
  );
  const visibleIndices = new Set(visible.map(({ index }) => index));
  const rings = request.prefetchRings ?? 1;
  const prefetch = coordinatesInRect(
    minChunkX - rings,
    minChunkY - rings,
    maxChunkX + rings,
    maxChunkY + rings,
  )
    .filter(({ index }) => !visibleIndices.has(index))
    .sort((left, right) => comparePriority(left, right, centerChunkX, centerChunkY));
  return { visible, prefetch, required: [...visible, ...prefetch] };
}

export interface EvictedChunk<T> {
  readonly key: number;
  readonly value: T;
}

interface CacheEntry<T> {
  readonly value: T;
  readonly bytes: number;
  lastUsed: number;
}

export class ChunkRenderCache<T> {
  private readonly entries = new Map<number, CacheEntry<T>>();
  private protectedKeys = new Set<number>();
  private clock = 0;
  private usedBytes = 0;

  constructor(private readonly budgetBytes: number) {
    if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0)
      throw new Error('Chunk cache budget must be a positive integer');
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.usedBytes;
  }

  get(key: number): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    entry.lastUsed = ++this.clock;
    return entry.value;
  }

  has(key: number): boolean {
    return this.entries.has(key);
  }

  protect(keys: ReadonlySet<number>): void {
    this.protectedKeys = new Set(keys);
  }

  set(key: number, value: T, bytes: number): readonly EvictedChunk<T>[] {
    if (!Number.isSafeInteger(bytes) || bytes <= 0)
      throw new Error('Chunk cache entry size must be a positive integer');
    const previous = this.entries.get(key);
    if (previous !== undefined) this.usedBytes -= previous.bytes;
    this.entries.set(key, { value, bytes, lastUsed: ++this.clock });
    this.usedBytes += bytes;
    const evicted: EvictedChunk<T>[] = [];
    while (this.usedBytes > this.budgetBytes) {
      const candidate = [...this.entries.entries()]
        .filter(([entryKey]) => entryKey !== key && !this.protectedKeys.has(entryKey))
        .sort((left, right) => left[1].lastUsed - right[1].lastUsed)[0];
      if (candidate === undefined) break;
      const [entryKey, entry] = candidate;
      this.entries.delete(entryKey);
      this.usedBytes -= entry.bytes;
      evicted.push({ key: entryKey, value: entry.value });
    }
    return evicted;
  }

  values(): readonly T[] {
    return [...this.entries.values()].map(({ value }) => value);
  }

  clear(): readonly T[] {
    const values = this.values();
    this.entries.clear();
    this.protectedKeys.clear();
    this.usedBytes = 0;
    return values;
  }
}

function coordinatesInRect(
  requestedMinX: number,
  requestedMinY: number,
  requestedMaxX: number,
  requestedMaxY: number,
): ChunkCoordinate[] {
  const minX = clampChunk(requestedMinX);
  const minY = clampChunk(requestedMinY);
  const maxX = clampChunk(requestedMaxX);
  const maxY = clampChunk(requestedMaxY);
  const coordinates: ChunkCoordinate[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      coordinates.push({ index: y * CHUNKS_PER_AXIS + x, x, y });
    }
  }
  return coordinates;
}

function comparePriority(
  left: ChunkCoordinate,
  right: ChunkCoordinate,
  centerX: number,
  centerY: number,
): number {
  const leftDistance = Math.abs(left.x - centerX) + Math.abs(left.y - centerY);
  const rightDistance = Math.abs(right.x - centerX) + Math.abs(right.y - centerY);
  return leftDistance - rightDistance || right.y - left.y || right.x - left.x;
}

function chunkAt(cell: number): number {
  return clampChunk(
    Math.floor(Math.max(0, Math.min(WORLD_SIZE - Number.EPSILON, cell)) / CHUNK_SIZE),
  );
}

function clampChunk(chunk: number): number {
  return Math.max(0, Math.min(CHUNKS_PER_AXIS - 1, chunk));
}
