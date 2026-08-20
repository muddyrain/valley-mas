import { stableNoise } from '@/shared/random';
import {
  type NaturalResourceFact,
  NaturalResourceKind,
  NaturalResourceSource,
  NaturalResourceStage,
} from '../resources/naturalResources';
import {
  isBuildableCell,
  type SettleabilityReport,
  type SettleableRegion,
  SurfaceHabitat,
  type WorldFacts,
  type WorldRepairRecord,
} from './worldFacts';

const REGION_RADIUS = 5;
const RESOURCE_RADIUS = 9;
const MIN_BUILDABLE_CELLS = 48;

function distanceSquared(size: number, first: number, second: number): number {
  const firstX = first % size;
  const firstZ = Math.floor(first / size);
  const secondX = second % size;
  const secondZ = Math.floor(second / size);
  return (firstX - secondX) ** 2 + (firstZ - secondZ) ** 2;
}

function buildableCellsAround(world: WorldFacts, centerCell: number): number[] {
  const centerX = centerCell % world.size;
  const centerZ = Math.floor(centerCell / world.size);
  const cells: number[] = [];
  for (let z = centerZ - REGION_RADIUS; z <= centerZ + REGION_RADIUS; z += 1) {
    for (let x = centerX - REGION_RADIUS; x <= centerX + REGION_RADIUS; x += 1) {
      if (x < 1 || z < 1 || x >= world.size - 1 || z >= world.size - 1) continue;
      if (Math.hypot(x - centerX, z - centerZ) > REGION_RADIUS + 0.2) continue;
      const cell = z * world.size + x;
      if (isBuildableCell(world, cell)) cells.push(cell);
    }
  }
  return cells;
}

function resourceCounts(
  world: WorldFacts,
  facts: readonly NaturalResourceFact[],
  centerCell: number,
): [number, number, number, number] {
  const counts = [0, 0, 0, 0];
  const maximumDistance = RESOURCE_RADIUS * RESOURCE_RADIUS;
  for (const fact of facts) {
    if (distanceSquared(world.size, centerCell, fact.cell) > maximumDistance) continue;
    counts[fact.kind] = (counts[fact.kind] ?? 0) + 1;
  }
  return counts as [number, number, number, number];
}

function describeRegion(
  world: WorldFacts,
  facts: readonly NaturalResourceFact[],
  centerCell: number,
): SettleableRegion {
  const counts = resourceCounts(world, facts, centerCell);
  return {
    centerCell,
    buildableCells: buildableCellsAround(world, centerCell).length,
    nearbyTrees: counts[NaturalResourceKind.Tree],
    nearbyWildFood: counts[NaturalResourceKind.WildFood],
    nearbyStone: counts[NaturalResourceKind.Stone],
    nearbyMetal: counts[NaturalResourceKind.Metal],
  };
}

function completeRegion(region: SettleableRegion): boolean {
  return (
    region.buildableCells >= MIN_BUILDABLE_CELLS &&
    region.nearbyTrees > 0 &&
    region.nearbyWildFood > 0 &&
    region.nearbyStone > 0 &&
    region.nearbyMetal > 0
  );
}

function candidateCenters(world: WorldFacts, seed: string, required: number): number[] {
  const candidates: Array<{ cell: number; score: number }> = [];
  for (let z = REGION_RADIUS + 1; z < world.size - REGION_RADIUS - 1; z += 2) {
    for (let x = REGION_RADIUS + 1; x < world.size - REGION_RADIUS - 1; x += 2) {
      const cell = z * world.size + x;
      if (!isBuildableCell(world, cell)) continue;
      const buildable = buildableCellsAround(world, cell).length;
      if (buildable < 24) continue;
      let scoreSeed = cell ^ world.size;
      for (let index = 0; index < seed.length; index += 1) {
        scoreSeed = Math.imul(scoreSeed ^ seed.charCodeAt(index), 16_777_619);
      }
      candidates.push({ cell, score: buildable + stableNoise(scoreSeed) });
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.cell - right.cell);
  const selected: number[] = [];
  const minimumSpacing = Math.max(16, Math.floor(world.size / Math.max(4, required + 1)));
  for (const candidate of candidates) {
    if (
      selected.every(
        (cell) => distanceSquared(world.size, cell, candidate.cell) >= minimumSpacing ** 2,
      )
    ) {
      selected.push(candidate.cell);
      if (selected.length >= required) break;
    }
  }
  return selected;
}

function findFreeCell(
  world: WorldFacts,
  occupied: Set<number>,
  centerCell: number,
  preferredOffset: readonly [number, number],
): number {
  const centerX = centerCell % world.size;
  const centerZ = Math.floor(centerCell / world.size);
  const candidates: number[] = [];
  for (let radius = 0; radius <= RESOURCE_RADIUS; radius += 1) {
    for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 1 || z < 1 || x >= world.size - 1 || z >= world.size - 1) continue;
        const cell = z * world.size + x;
        if (occupied.has(cell) || !isBuildableCell(world, cell)) continue;
        candidates.push(cell);
      }
    }
    if (candidates.length > 0) break;
  }
  const targetX = centerX + preferredOffset[0];
  const targetZ = centerZ + preferredOffset[1];
  candidates.sort((left, right) => {
    const leftX = left % world.size;
    const leftZ = Math.floor(left / world.size);
    const rightX = right % world.size;
    const rightZ = Math.floor(right / world.size);
    return (
      (leftX - targetX) ** 2 +
        (leftZ - targetZ) ** 2 -
        ((rightX - targetX) ** 2 + (rightZ - targetZ) ** 2) || left - right
    );
  });
  return candidates[0] ?? centerCell;
}

function repairRegion(
  world: WorldFacts,
  facts: NaturalResourceFact[],
  centerCell: number,
): WorldRepairRecord {
  const terrainCells: number[] = [];
  if (buildableCellsAround(world, centerCell).length < MIN_BUILDABLE_CELLS) {
    const centerX = centerCell % world.size;
    const centerZ = Math.floor(centerCell / world.size);
    for (let z = centerZ - 4; z <= centerZ + 4; z += 1) {
      for (let x = centerX - 4; x <= centerX + 4; x += 1) {
        if (Math.hypot(x - centerX, z - centerZ) > 4.2) continue;
        const cell = z * world.size + x;
        if (isBuildableCell(world, cell)) continue;
        world.elevation[cell] = 0.8;
        world.surface[cell] = SurfaceHabitat.Grassland;
        terrainCells.push(cell);
      }
    }
  }
  const occupied = new Set(facts.map((fact) => fact.cell));
  const resourceCells: number[] = [];
  const definitions = [
    [NaturalResourceKind.Tree, [2, 0], 5, NaturalResourceStage.Mature],
    [NaturalResourceKind.WildFood, [-2, 0], 8, NaturalResourceStage.Available],
    [NaturalResourceKind.Stone, [0, 2], 18, NaturalResourceStage.Available],
    [NaturalResourceKind.Metal, [0, -2], 12, NaturalResourceStage.Available],
  ] as const;
  const counts = resourceCounts(world, facts, centerCell);
  for (const [kind, offset, amount, stage] of definitions) {
    if (counts[kind] > 0) continue;
    const cell = findFreeCell(world, occupied, centerCell, offset);
    occupied.add(cell);
    if (kind === NaturalResourceKind.Tree) world.surface[cell] = SurfaceHabitat.WoodlandSoil;
    facts.push({ kind, cell, amount, stage, source: NaturalResourceSource.SettleabilityRepair });
    resourceCells.push(cell);
  }
  return { centerCell, terrainCells, resourceCells };
}

export function ensureSettleability(
  world: WorldFacts,
  facts: NaturalResourceFact[],
  seed: string,
  requiredRegions: number,
): SettleabilityReport {
  if (requiredRegions === 0 || world.preset === 'ocean') {
    return { requiredRegions: 0, regions: [], repairs: [] };
  }
  const centers = candidateCenters(world, seed, requiredRegions);
  if (centers.length < requiredRegions) {
    throw new Error(
      `World topology only provided ${centers.length}/${requiredRegions} region anchors`,
    );
  }
  const repairs: WorldRepairRecord[] = [];
  const regions: SettleableRegion[] = [];
  for (const center of centers) {
    const before = describeRegion(world, facts, center);
    const repair = completeRegion(before)
      ? { centerCell: center, terrainCells: [], resourceCells: [] }
      : repairRegion(world, facts, center);
    if (repair.terrainCells.length > 0 || repair.resourceCells.length > 0) repairs.push(repair);
    const region = describeRegion(world, facts, center);
    if (!completeRegion(region)) throw new Error(`Settleability repair failed at cell ${center}`);
    regions.push(region);
  }
  return { requiredRegions, regions, repairs };
}
