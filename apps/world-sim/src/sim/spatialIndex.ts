import { type ChunkKey, getChunkKey } from './map';
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

    for (let y = minY; y <= maxY; y += 16) {
      for (let x = minX; x <= maxX; x += 16) {
        for (const id of this.cells.get(getChunkKey(x, y)) ?? []) {
          ids.add(id);
        }
      }
    }

    return [...ids];
  }
}
