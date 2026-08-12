import { describe, expect, it } from 'vitest';
import { SnapshotInterpolator } from './SnapshotInterpolator';

function snapshot(tick: number, x: number) {
  return {
    tick,
    population: 1,
    positionsX: new Float32Array([x]),
    positionsZ: new Float32Array([x * 2]),
    headings: new Float32Array([0]),
    states: new Uint8Array([2]),
    metrics: {
      tickMs: 1,
      averageTickMs: 1,
      completedPaths: 1,
      pathQueue: 0,
      neighbourCandidates: 2,
    },
  };
}

describe('SnapshotInterpolator', () => {
  it('interpolates between two worker snapshots', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(snapshot(1, 4), 1_000);
    interpolator.push(snapshot(2, 8), 1_100);

    expect(interpolator.sample(0, 1_150)).toMatchObject({ x: 6, z: 12 });
  });

  it('resets safely when population changes', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(snapshot(1, 4), 1_000);
    const changed = snapshot(2, 9);
    changed.population = 2;
    changed.positionsX = new Float32Array([9, 10]);
    changed.positionsZ = new Float32Array([18, 20]);
    changed.headings = new Float32Array([0, 0]);
    changed.states = new Uint8Array([2, 2]);
    interpolator.push(changed, 1_100);

    expect(interpolator.sample(1, 1_110)).toMatchObject({ x: 10, z: 20 });
  });
});
