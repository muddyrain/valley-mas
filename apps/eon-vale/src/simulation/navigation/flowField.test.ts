import { describe, expect, it } from 'vitest';
import { createFlowField, nextFlowCell } from './flowField';
import { createNavigationGrid, setCellCost } from './grid';

describe('flow field', () => {
  it('guides a crowd around blocked cells into the target region', () => {
    const grid = createNavigationGrid(20, 20);
    for (let z = 0; z < 17; z += 1) setCellCost(grid, 9, z, 0);
    const target = 19 * 20 + 19;
    const field = createFlowField(grid, target);
    let cell = 0;
    for (let step = 0; step < 100 && cell !== target; step += 1) cell = nextFlowCell(field, cell);

    expect(cell).toBe(target);
  });
});
