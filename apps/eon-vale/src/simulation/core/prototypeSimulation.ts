import { createSeededRandom, randomInt } from '@/shared/random';
import { createNavigationGrid, isWalkable, type NavigationGrid, toCell } from '../navigation/grid';
import { PathQueue } from '../navigation/pathQueue';
import { SpatialHash } from '../navigation/spatialHash';

export interface PrototypeSimulationOptions {
  population: number;
  seed: string;
  mapSize?: number;
  pathBudget?: number;
}

export interface PrototypeMetrics {
  tickMs: number;
  averageTickMs: number;
  completedPaths: number;
  pathQueue: number;
  neighbourCandidates: number;
}

export interface PrototypeSnapshot {
  tick: number;
  population: number;
  positionsX: Float32Array;
  positionsZ: Float32Array;
  headings: Float32Array;
  states: Uint8Array;
  metrics: PrototypeMetrics;
}

export interface PrototypeSimulation {
  readonly activePopulation: number;
  readonly tick: number;
  readonly metrics: PrototypeMetrics;
  readonly grid: NavigationGrid;
  step(): void;
  snapshot(): PrototypeSnapshot;
}

interface AgentPath {
  cells: number[];
  cursor: number;
}

const FIXED_DELTA = 1 / 20;

function createStressGrid(size: number, random: () => number): NavigationGrid {
  const grid = createNavigationGrid(size, size);
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const border = x < 2 || z < 2 || x >= size - 2 || z >= size - 2;
      const lake = random() < 0.018 && x % 8 > 1 && z % 8 > 1;
      if (border || lake) grid.cost[toCell(grid, x, z)] = 0;
      else if (x % 9 === 0 || z % 11 === 0) grid.cost[toCell(grid, x, z)] = 2;
    }
  }
  return grid;
}

function randomWalkableCell(grid: NavigationGrid, random: () => number, origin?: number): number {
  const originX = origin === undefined ? Math.floor(grid.width / 2) : origin % grid.width;
  const originZ =
    origin === undefined ? Math.floor(grid.height / 2) : Math.floor(origin / grid.width);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const radius = origin === undefined ? Math.floor(grid.width / 2) - 3 : 18;
    const x = Math.max(2, Math.min(grid.width - 3, originX + randomInt(random, -radius, radius)));
    const z = Math.max(2, Math.min(grid.height - 3, originZ + randomInt(random, -radius, radius)));
    const cell = toCell(grid, x, z);
    if (isWalkable(grid, cell)) return cell;
  }
  return toCell(grid, originX, originZ);
}

export function createPrototypeSimulation(
  options: PrototypeSimulationOptions,
): PrototypeSimulation {
  const population = Math.max(1, Math.floor(options.population));
  const mapSize = options.mapSize ?? 128;
  const pathBudget = options.pathBudget ?? 12;
  const random = createSeededRandom(options.seed);
  const grid = createStressGrid(mapSize, random);
  const positionsX = new Float32Array(population);
  const positionsZ = new Float32Array(population);
  const headings = new Float32Array(population);
  const states = new Uint8Array(population);
  const agentCells = new Uint32Array(population);
  const paths: Array<AgentPath | null> = Array.from({ length: population }, () => null);
  const queue = new PathQueue();
  const spatialHash = new SpatialHash(3);
  let requestId = 0;
  let tick = 0;
  let totalTickMs = 0;
  const metrics: PrototypeMetrics = {
    tickMs: 0,
    averageTickMs: 0,
    completedPaths: 0,
    pathQueue: 0,
    neighbourCandidates: 0,
  };

  const requestPath = (agentId: number, priority = 1): void => {
    const startCell = agentCells[agentId] as number;
    requestId += 1;
    queue.enqueue({
      requestId,
      agentId,
      startCell,
      destinationCell: randomWalkableCell(grid, random, startCell),
      priority,
      mapVersion: grid.mapVersion,
      requestedAtTick: tick,
    });
    states[agentId] = 1;
  };

  for (let agentId = 0; agentId < population; agentId += 1) {
    const cell = randomWalkableCell(grid, random);
    agentCells[agentId] = cell;
    positionsX[agentId] = (cell % mapSize) + (random() - 0.5) * 0.5;
    positionsZ[agentId] = Math.floor(cell / mapSize) + (random() - 0.5) * 0.5;
    requestPath(agentId);
  }

  const step = (): void => {
    const startedAt = performance.now();
    tick += 1;
    const results = queue.process(grid, pathBudget);
    for (const result of results) {
      if (result.path.length > 1) {
        paths[result.agentId] = { cells: result.path, cursor: 1 };
        states[result.agentId] = 2;
        metrics.completedPaths += 1;
      } else {
        states[result.agentId] = 0;
      }
    }

    spatialHash.clear();
    for (let agentId = 0; agentId < population; agentId += 1) {
      spatialHash.insert(agentId, positionsX[agentId] as number, positionsZ[agentId] as number);
    }

    let neighbourCandidates = 0;
    for (let agentId = 0; agentId < population; agentId += 1) {
      const path = paths[agentId];
      if (!path) {
        if (states[agentId] === 0 && (agentId + tick) % 8 === 0) requestPath(agentId);
        continue;
      }
      const targetCell = path.cells[path.cursor];
      if (targetCell === undefined) {
        paths[agentId] = null;
        states[agentId] = 0;
        continue;
      }
      const targetX = (targetCell % mapSize) + 0.5;
      const targetZ = Math.floor(targetCell / mapSize) + 0.5;
      const deltaX = targetX - (positionsX[agentId] as number);
      const deltaZ = targetZ - (positionsZ[agentId] as number);
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance < 0.22) {
        path.cursor += 1;
        if (path.cursor >= path.cells.length) {
          agentCells[agentId] = targetCell;
          paths[agentId] = null;
          states[agentId] = 0;
        }
        continue;
      }

      const neighbours = spatialHash.query(
        positionsX[agentId] as number,
        positionsZ[agentId] as number,
        1.2,
      ).candidates;
      neighbourCandidates += neighbours.length;
      let separationX = 0;
      let separationZ = 0;
      for (const neighbourId of neighbours) {
        if (neighbourId === agentId) continue;
        const awayX = (positionsX[agentId] as number) - (positionsX[neighbourId] as number);
        const awayZ = (positionsZ[agentId] as number) - (positionsZ[neighbourId] as number);
        const squaredDistance = awayX * awayX + awayZ * awayZ;
        if (squaredDistance > 0.001 && squaredDistance < 0.8) {
          separationX += awayX / squaredDistance;
          separationZ += awayZ / squaredDistance;
        }
      }
      const inverseDistance = 1 / Math.max(distance, 0.001);
      const desiredX = deltaX * inverseDistance + separationX * 0.035;
      const desiredZ = deltaZ * inverseDistance + separationZ * 0.035;
      const desiredLength = Math.max(0.001, Math.hypot(desiredX, desiredZ));
      const speed = 2.4 + (agentId % 11) * 0.015;
      const velocityX = (desiredX / desiredLength) * speed;
      const velocityZ = (desiredZ / desiredLength) * speed;
      positionsX[agentId] = (positionsX[agentId] as number) + velocityX * FIXED_DELTA;
      positionsZ[agentId] = (positionsZ[agentId] as number) + velocityZ * FIXED_DELTA;
      headings[agentId] = Math.atan2(velocityX, velocityZ);
      agentCells[agentId] = toCell(
        grid,
        Math.max(0, Math.min(mapSize - 1, Math.floor(positionsX[agentId] as number))),
        Math.max(0, Math.min(mapSize - 1, Math.floor(positionsZ[agentId] as number))),
      );
    }

    metrics.neighbourCandidates = neighbourCandidates;
    metrics.pathQueue = queue.size;
    metrics.tickMs = performance.now() - startedAt;
    totalTickMs += metrics.tickMs;
    metrics.averageTickMs = totalTickMs / tick;
  };

  return {
    get activePopulation() {
      return population;
    },
    get tick() {
      return tick;
    },
    metrics,
    grid,
    step,
    snapshot() {
      return {
        tick,
        population,
        positionsX: positionsX.slice(),
        positionsZ: positionsZ.slice(),
        headings: headings.slice(),
        states: states.slice(),
        metrics: { ...metrics },
      };
    },
  };
}
