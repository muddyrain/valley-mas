import { cellX, cellZ, isWalkable, type NavigationGrid } from './grid';

interface HeapEntry {
  cell: number;
  score: number;
}

const PATH_HEURISTIC_WEIGHT = 1.25;

export interface PathSearchWorkspace {
  readonly cellCount: number;
  readonly cameFrom: Int32Array;
  readonly gScore: Float32Array;
  readonly seenGeneration: Uint32Array;
  readonly closedGeneration: Uint32Array;
  generation: number;
}

export function createPathSearchWorkspace(cellCount: number): PathSearchWorkspace {
  return {
    cellCount,
    cameFrom: new Int32Array(cellCount),
    gScore: new Float32Array(cellCount),
    seenGeneration: new Uint32Array(cellCount),
    closedGeneration: new Uint32Array(cellCount),
    generation: 0,
  };
}

function beginSearch(workspace: PathSearchWorkspace): number {
  workspace.generation = (workspace.generation + 1) >>> 0;
  if (workspace.generation === 0) {
    workspace.seenGeneration.fill(0);
    workspace.closedGeneration.fill(0);
    workspace.generation = 1;
  }
  return workspace.generation;
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
  reusableWorkspace?: PathSearchWorkspace,
): number[] {
  if (!isWalkable(grid, start) || !isWalkable(grid, goal)) return [];
  if (start === goal) return [start];

  const cellCount = grid.width * grid.height;
  const workspace =
    reusableWorkspace?.cellCount === cellCount
      ? reusableWorkspace
      : createPathSearchWorkspace(cellCount);
  const generation = beginSearch(workspace);
  const { cameFrom, gScore, seenGeneration, closedGeneration } = workspace;
  const open = new MinHeap();
  cameFrom[start] = -1;
  gScore[start] = 0;
  seenGeneration[start] = generation;
  open.push({ cell: start, score: heuristic(grid, start, goal) * PATH_HEURISTIC_WEIGHT });
  let visited = 0;

  while (open.size > 0 && visited < maxVisited) {
    const current = open.pop();
    if (!current || closedGeneration[current.cell] === generation) continue;
    if (current.cell === goal) return reconstruct(cameFrom, goal);
    closedGeneration[current.cell] = generation;
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
      if (
        neighbour < 0 ||
        closedGeneration[neighbour] === generation ||
        !isWalkable(grid, neighbour)
      )
        continue;
      const nextScore = gScore[current.cell] + (grid.cost[neighbour] ?? 1);
      if (seenGeneration[neighbour] === generation && nextScore >= gScore[neighbour]) continue;
      cameFrom[neighbour] = current.cell;
      gScore[neighbour] = nextScore;
      seenGeneration[neighbour] = generation;
      open.push({
        cell: neighbour,
        score: nextScore + heuristic(grid, neighbour, goal) * PATH_HEURISTIC_WEIGHT,
      });
    }
  }

  return [];
}
