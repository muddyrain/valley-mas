import { describe, expect, it } from 'vitest';
import { buildHorizontalTileRuns } from './renderRuns';

describe('render run helpers', () => {
  it('merges adjacent horizontal tiles with the same style', () => {
    const runs = buildHorizontalTileRuns(
      [
        { x: 2, y: 1, terrain: 'grass' },
        { x: 0, y: 1, terrain: 'grass' },
        { x: 1, y: 1, terrain: 'grass' },
        { x: 3, y: 1, terrain: 'water' },
        { x: 0, y: 2, terrain: 'grass' },
      ],
      (tile) => tile.terrain,
    );

    expect(runs).toEqual([
      { x: 0, y: 1, width: 3, sample: { x: 0, y: 1, terrain: 'grass' }, styleKey: 'grass' },
      { x: 3, y: 1, width: 1, sample: { x: 3, y: 1, terrain: 'water' }, styleKey: 'water' },
      { x: 0, y: 2, width: 1, sample: { x: 0, y: 2, terrain: 'grass' }, styleKey: 'grass' },
    ]);
  });

  it('does not merge across gaps', () => {
    const runs = buildHorizontalTileRuns(
      [
        { x: 0, y: 0, owner: 'a' },
        { x: 2, y: 0, owner: 'a' },
      ],
      (tile) => tile.owner,
    );

    expect(runs.map((run) => ({ x: run.x, y: run.y, width: run.width }))).toEqual([
      { x: 0, y: 0, width: 1 },
      { x: 2, y: 0, width: 1 },
    ]);
  });
});
