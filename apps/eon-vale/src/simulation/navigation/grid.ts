export const DEFAULT_CELL_COST = 4;
export const CHUNK_SIZE = 8;

export interface NavigationGrid {
  width: number;
  height: number;
  cost: Uint8Array;
  chunkColumns: number;
  chunkRows: number;
  chunkVersions: Uint32Array;
  mapVersion: number;
}

export function createNavigationGrid(width: number, height: number): NavigationGrid {
  const cost = new Uint8Array(width * height);
  cost.fill(DEFAULT_CELL_COST);
  const chunkColumns = Math.ceil(width / CHUNK_SIZE);
  const chunkRows = Math.ceil(height / CHUNK_SIZE);
  return {
    width,
    height,
    cost,
    chunkColumns,
    chunkRows,
    chunkVersions: new Uint32Array(chunkColumns * chunkRows),
    mapVersion: 0,
  };
}

export function toCell(grid: NavigationGrid, x: number, z: number): number {
  return z * grid.width + x;
}

export function cellX(grid: NavigationGrid, cell: number): number {
  return cell % grid.width;
}

export function cellZ(grid: NavigationGrid, cell: number): number {
  return Math.floor(cell / grid.width);
}

export function isInside(grid: NavigationGrid, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < grid.width && z < grid.height;
}

export function isWalkable(grid: NavigationGrid, cell: number): boolean {
  return cell >= 0 && cell < grid.cost.length && grid.cost[cell] > 0;
}

export function chunkIndexForCell(grid: NavigationGrid, cell: number): number {
  const x = cellX(grid, cell);
  const z = cellZ(grid, cell);
  return Math.floor(z / CHUNK_SIZE) * grid.chunkColumns + Math.floor(x / CHUNK_SIZE);
}

export function setCellCost(grid: NavigationGrid, x: number, z: number, cost: number): void {
  if (!isInside(grid, x, z)) return;
  const cell = toCell(grid, x, z);
  const nextCost = Math.max(0, Math.min(255, Math.round(cost)));
  if (grid.cost[cell] === nextCost) return;
  grid.cost[cell] = nextCost;
  const chunkIndex = chunkIndexForCell(grid, cell);
  grid.chunkVersions[chunkIndex] = (grid.chunkVersions[chunkIndex] ?? 0) + 1;
  grid.mapVersion += 1;
}

export function getCellChunkVersion(grid: NavigationGrid, cell: number): number {
  return grid.chunkVersions[chunkIndexForCell(grid, cell)] ?? 0;
}
