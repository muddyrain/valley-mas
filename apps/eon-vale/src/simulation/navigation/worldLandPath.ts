import { ElevationBand, elevationBandAt, type WorldFacts } from '../world/worldFacts';
import { createPathSearchWorkspace, findPath, type PathSearchWorkspace } from './astar';
import { createNavigationGrid, type NavigationGrid } from './grid';

interface CachedWorldNavigation {
  revision: number;
  grid: NavigationGrid;
  workspace: PathSearchWorkspace;
}

const worldNavigationCache = new WeakMap<WorldFacts, CachedWorldNavigation>();

function buildWorldNavigation(world: WorldFacts): CachedWorldNavigation {
  const grid = createNavigationGrid(world.size, world.size);
  for (let cell = 0; cell < grid.cost.length; cell += 1) {
    grid.cost[cell] = elevationBandAt(world.elevation[cell] ?? -4) === ElevationBand.Land ? 4 : 0;
  }
  grid.mapVersion = world.revision;
  return {
    revision: world.revision,
    grid,
    workspace: createPathSearchWorkspace(grid.cost.length),
  };
}

function navigationFor(world: WorldFacts): CachedWorldNavigation {
  const cached = worldNavigationCache.get(world);
  if (cached?.revision === world.revision) return cached;
  const rebuilt = buildWorldNavigation(world);
  worldNavigationCache.set(world, rebuilt);
  return rebuilt;
}

export function planLandPath(world: WorldFacts, startCell: number, targetCell: number): number[] {
  if (startCell === targetCell) return [startCell];
  const startX = startCell % world.size;
  const startZ = Math.floor(startCell / world.size);
  const targetX = targetCell % world.size;
  const targetZ = Math.floor(targetCell / world.size);
  if (
    Math.abs(startX - targetX) + Math.abs(startZ - targetZ) === 1 &&
    elevationBandAt(world.elevation[startCell] ?? -4) === ElevationBand.Land &&
    elevationBandAt(world.elevation[targetCell] ?? -4) === ElevationBand.Land
  ) {
    return [startCell, targetCell];
  }
  const navigation = navigationFor(world);
  return findPath(
    navigation.grid,
    startCell,
    targetCell,
    navigation.grid.cost.length,
    navigation.workspace,
  );
}
