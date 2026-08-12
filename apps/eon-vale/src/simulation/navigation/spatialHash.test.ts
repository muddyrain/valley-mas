import { describe, expect, it } from 'vitest';
import { SpatialHash } from './spatialHash';

describe('SpatialHash', () => {
  it('queries local buckets instead of scanning the whole population', () => {
    const hash = new SpatialHash(4);
    for (let id = 0; id < 1_000; id += 1) hash.insert(id, id % 100, Math.floor(id / 100) * 10);

    const result = hash.query(10, 10, 5);

    expect(result.candidates.length).toBeLessThan(100);
    expect(result.visitedBuckets).toBeLessThanOrEqual(16);
  });
});
