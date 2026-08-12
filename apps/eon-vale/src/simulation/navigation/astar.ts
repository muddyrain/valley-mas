import { cellX, cellZ, isWalkable, type NavigationGrid } from './grid';

interface HeapEntry {
  cell: number;
  score: number;
}

class MinHeap {
  private readonly entries: HeapEntry[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(entry: HeapEntry): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if ((this.entries[parent]?.score ?? 0) <= entry.score) break;
      this.entries[index] = this.entries[parent] as HeapEntry;
      index = parent;
    }
    this.entries[index] = entry;
  }

  pop(): HeapEntry | undefined {
    const root = this.entries[0];
    const tail = this.entries.pop();
    if (!root || !tail || this.entries.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.entries.length) break;
      let child = left;
      if (
        right < this.entries.length &&
        (this.entries[right]?.score ?? 0) < (this.entries[left]?.score ?? 0)
      ) {
        child = right;
      }
      if ((this.entries[child]?.score ?? 0) >= tail.score) break;
      this.entries[index] = this.entries[child] as HeapEntry;
      index = child;
    }
    this.entries[index] = tail;
    return root;
  }
}

function heuristic(grid: NavigationGrid, cell: number, goal: number): number {
  return (
    Math.abs(cellX(grid, cell) - cellX(grid, goal)) +
    Math.abs(cellZ(grid, cell) - cellZ(grid, goal))
  );
}

function reconstruct(cameFrom: Int32Array, goal: number): number[] {
  const path = [goal];
  let current = goal;
  while (cameFrom[current] >= 0) {
    current = cameFrom[current] as number;
    path.push(current);
  }
  path.reverse();
  return path;
}

export function findPath(
  grid: NavigationGrid,
  start: number,
  goal: number,
  maxVisited = 12_000,
): number[] {
  if (!isWalkable(grid, start) || !isWalkable(grid, goal)) return [];
  if (start === goal) return [start];

  const cellCount = grid.width * grid.height;
  const cameFrom = new Int32Array(cellCount);
  cameFrom.fill(-1);
  const gScore = new Float32Array(cellCount);
  gScore.fill(Number.POSITIVE_INFINITY);
  const closed = new Uint8Array(cellCount);
  const open = new MinHeap();
  gScore[start] = 0;
  open.push({ cell: start, score: heuristic(grid, start, goal) });
  let visited = 0;

  while (open.size > 0 && visited < maxVisited) {
    const current = open.pop();
    if (!current || closed[current.cell]) continue;
    if (current.cell === goal) return reconstruct(cameFrom, goal);
    closed[current.cell] = 1;
    visited += 1;

    const x = cellX(grid, current.cell);
    const z = cellZ(grid, current.cell);
    const neighbours = [
      x > 0 ? current.cell - 1 : -1,
      x + 1 < grid.width ? current.cell + 1 : -1,
      z > 0 ? current.cell - grid.width : -1,
      z + 1 < grid.height ? current.cell + grid.width : -1,
    ];

    for (const neighbour of neighbours) {
      if (neighbour < 0 || closed[neighbour] || !isWalkable(grid, neighbour)) continue;
      const nextScore = gScore[current.cell] + (grid.cost[neighbour] ?? 1);
      if (nextScore >= gScore[neighbour]) continue;
      cameFrom[neighbour] = current.cell;
      gScore[neighbour] = nextScore;
      open.push({ cell: neighbour, score: nextScore + heuristic(grid, neighbour, goal) });
    }
  }

  return [];
}
