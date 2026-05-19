import { CHUNK_SIZE, type ChunkKey, getChunkKey } from './map';
import type { Position, Unit } from './types';

export class SpatialIndex {
  private readonly cells = new Map<ChunkKey, string[]>();

  rebuild(units: Unit[]) {
    this.cells.clear();

    for (const unit of units) {
      if (unit.intent === 'dead') {
        continue;
      }

      const key = getChunkKey(unit.position.x, unit.position.y);
      const bucket = this.cells.get(key) ?? [];
      bucket.push(unit.id);
      this.cells.set(key, bucket);
    }
  }

  nearbyUnitIds(position: Position, radius: number) {
    const minX = Math.floor(position.x - radius);
    const maxX = Math.floor(position.x + radius);
    const minY = Math.floor(position.y - radius);
    const maxY = Math.floor(position.y + radius);
    const ids = new Set<string>();

    const minChunkX = Math.floor(minX / CHUNK_SIZE);
    const maxChunkX = Math.floor(maxX / CHUNK_SIZE);
    const minChunkY = Math.floor(minY / CHUNK_SIZE);
    const maxChunkY = Math.floor(maxY / CHUNK_SIZE);

    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        for (const id of this.cells.get(`${chunkX}:${chunkY}`) ?? []) {
          ids.add(id);
        }
      }
    }

    return [...ids];
  }
}
