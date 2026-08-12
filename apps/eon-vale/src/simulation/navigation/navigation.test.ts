import { describe, expect, it } from 'vitest';
import { findPath } from './astar';
import { createNavigationGrid, setCellCost } from './grid';
import { PathQueue } from './pathQueue';
import { simplifyPath } from './simplifyPath';

describe('grid navigation', () => {
  it('never crosses an impassable cell', () => {
    const grid = createNavigationGrid(8, 8);
    for (let z = 0; z < 7; z += 1) setCellCost(grid, 3, z, 0);

    const path = findPath(grid, 0, 7 * 8 + 7);

    expect(path.at(-1)).toBe(63);
    expect(path.every((cell) => grid.cost[cell] > 0)).toBe(true);
  });

  it('uses a longer road when its travel cost is lower', () => {
    const grid = createNavigationGrid(7, 5);
    for (let x = 0; x < 7; x += 1) setCellCost(grid, x, 0, 1);
    for (let x = 1; x < 6; x += 1) setCellCost(grid, x, 2, 8);

    const path = findPath(grid, 2 * 7, 2 * 7 + 6);

    expect(path.some((cell) => Math.floor(cell / 7) === 0)).toBe(true);
  });

  it('simplifies collinear nodes without crossing obstacles', () => {
    const grid = createNavigationGrid(6, 6);
    setCellCost(grid, 2, 2, 0);
    const path = findPath(grid, 0, 35);
    const simplified = simplifyPath(grid, path);

    expect(simplified.length).toBeLessThan(path.length);
    expect(simplified).toEqual(expect.arrayContaining([0, 35]));
  });
});

describe('PathQueue', () => {
  it('honours priority and a per-tick search budget', () => {
    const grid = createNavigationGrid(16, 16);
    const queue = new PathQueue();
    queue.enqueue({
      requestId: 1,
      agentId: 1,
      startCell: 0,
      destinationCell: 255,
      priority: 1,
      mapVersion: 0,
      requestedAtTick: 0,
    });
    queue.enqueue({
      requestId: 2,
      agentId: 2,
      startCell: 15,
      destinationCell: 240,
      priority: 9,
      mapVersion: 0,
      requestedAtTick: 0,
    });

    const completed = queue.process(grid, 1);

    expect(completed).toHaveLength(1);
    expect(completed[0]?.requestId).toBe(2);
    expect(queue.size).toBe(1);
  });
});
