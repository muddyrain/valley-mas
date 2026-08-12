export interface SpatialQueryResult {
  candidates: number[];
  visitedBuckets: number;
}

export class SpatialHash {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    this.buckets.clear();
  }

  private key(x: number, z: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }

  insert(id: number, x: number, z: number): void {
    const key = this.key(x, z);
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(id);
    else this.buckets.set(key, [id]);
  }

  query(x: number, z: number, radius: number): SpatialQueryResult {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);
    const candidates: number[] = [];
    let visitedBuckets = 0;
    for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        visitedBuckets += 1;
        const bucket = this.buckets.get(`${cellX},${cellZ}`);
        if (bucket) candidates.push(...bucket);
      }
    }
    return { candidates, visitedBuckets };
  }
}
