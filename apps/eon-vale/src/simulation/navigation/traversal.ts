import {
  ResourceNodeKind,
  ResourceNodeStage,
  type ResourceNodeStore,
  TerrainType,
} from '@/shared/gameTypes';
import { findResourceNodesInRadius } from '../resources/resourceNodes';
import { isInside, isWalkable, type NavigationGrid, toCell } from './grid';
import { hasLineOfSight } from './simplifyPath';

const MATURE_TREE_TRUNK_RADIUS = 0.22;

export interface TraversalSpeedSample {
  terrain: TerrainType;
  road: boolean;
  heightDelta: number;
  carrying: boolean;
}

export interface ConstrainedPosition {
  x: number;
  z: number;
  blocked: boolean;
}

export function traversalSpeedMultiplier(sample: TraversalSpeedSample): number {
  const slope = Math.abs(sample.heightDelta);
  let multiplier = sample.road ? 1.4 : sample.terrain === TerrainType.Forest ? 0.75 : 1;
  if (slope > 0.35) multiplier = Math.min(multiplier, 0.6);
  else if (slope > 0.14) multiplier = Math.min(multiplier, 0.85);
  if (sample.carrying) multiplier *= 0.8;
  return multiplier;
}

export function constrainNavigationStep(
  grid: NavigationGrid,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): ConstrainedPosition {
  const distance = Math.hypot(toX - fromX, toZ - fromZ);
  const samples = Math.max(1, Math.ceil(distance / 0.18));
  for (let sample = 1; sample <= samples; sample += 1) {
    const ratio = sample / samples;
    const x = fromX + (toX - fromX) * ratio;
    const z = fromZ + (toZ - fromZ) * ratio;
    const cellX = Math.floor(x);
    const cellZ = Math.floor(z);
    if (!isInside(grid, cellX, cellZ) || !isWalkable(grid, toCell(grid, cellX, cellZ))) {
      return { x: fromX, z: fromZ, blocked: true };
    }
  }
  return { x: toX, z: toZ, blocked: false };
}

function collidesWithMatureTree(store: ResourceNodeStore, x: number, z: number): boolean {
  return findResourceNodesInRadius(store, x, z, MATURE_TREE_TRUNK_RADIUS).some(
    (nodeId) =>
      store.active[nodeId] === 1 &&
      store.kind[nodeId] === ResourceNodeKind.Tree &&
      store.stage[nodeId] === ResourceNodeStage.Mature,
  );
}

export function overlapsMatureTreeTrunk(store: ResourceNodeStore, x: number, z: number): boolean {
  return collidesWithMatureTree(store, x, z);
}

function nearestMatureTreeDistance(store: ResourceNodeStore, x: number, z: number): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const nodeId of findResourceNodesInRadius(store, x, z, 0.76)) {
    if (
      store.active[nodeId] !== 1 ||
      store.kind[nodeId] !== ResourceNodeKind.Tree ||
      store.stage[nodeId] !== ResourceNodeStage.Mature
    ) {
      continue;
    }
    nearest = Math.min(
      nearest,
      Math.hypot((store.positionsX[nodeId] ?? 0) - x, (store.positionsZ[nodeId] ?? 0) - z),
    );
  }
  return nearest;
}

function nearestMatureTree(
  store: ResourceNodeStore,
  x: number,
  z: number,
): { x: number; z: number } | null {
  let result: { x: number; z: number } | null = null;
  let nearest = Number.POSITIVE_INFINITY;
  for (const nodeId of findResourceNodesInRadius(store, x, z, 0.76)) {
    if (
      store.active[nodeId] !== 1 ||
      store.kind[nodeId] !== ResourceNodeKind.Tree ||
      store.stage[nodeId] !== ResourceNodeStage.Mature
    ) {
      continue;
    }
    const nodeX = store.positionsX[nodeId] ?? 0;
    const nodeZ = store.positionsZ[nodeId] ?? 0;
    const distance = Math.hypot(nodeX - x, nodeZ - z);
    if (distance < nearest) {
      nearest = distance;
      result = { x: nodeX, z: nodeZ };
    }
  }
  return result;
}

export function resolveTreeTrunkCollision(
  store: ResourceNodeStore,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): ConstrainedPosition {
  if (!collidesWithMatureTree(store, toX, toZ)) return { x: toX, z: toZ, blocked: false };
  if (
    collidesWithMatureTree(store, fromX, fromZ) &&
    nearestMatureTreeDistance(store, toX, toZ) > nearestMatureTreeDistance(store, fromX, fromZ)
  ) {
    return { x: toX, z: toZ, blocked: false };
  }
  const tree = nearestMatureTree(store, toX, toZ);
  const step = Math.hypot(toX - fromX, toZ - fromZ);
  if (tree && step > 0) {
    const radialX = fromX - tree.x;
    const radialZ = fromZ - tree.z;
    const radialLength = Math.max(0.001, Math.hypot(radialX, radialZ));
    const candidates = [1, -1]
      .map((direction) => ({
        x:
          fromX +
          ((-radialZ / radialLength) * direction * 0.92 + (radialX / radialLength) * 0.38) * step,
        z:
          fromZ +
          ((radialX / radialLength) * direction * 0.92 + (radialZ / radialLength) * 0.38) * step,
      }))
      .filter((candidate) => !collidesWithMatureTree(store, candidate.x, candidate.z));
    const tangent = candidates[0];
    if (tangent) return { ...tangent, blocked: false };
  }
  const axisSlide = [
    { x: toX, z: fromZ },
    { x: fromX, z: toZ },
  ]
    .filter(
      (candidate) =>
        (candidate.x !== fromX || candidate.z !== fromZ) &&
        !collidesWithMatureTree(store, candidate.x, candidate.z),
    )
    .sort(
      (left, right) =>
        Math.hypot(left.x - toX, left.z - toZ) - Math.hypot(right.x - toX, right.z - toZ),
    )[0];
  if (axisSlide) return { ...axisSlide, blocked: false };
  const currentClearance = nearestMatureTreeDistance(store, fromX, fromZ);
  const escapeCandidate = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return { x: fromX + Math.cos(angle) * step, z: fromZ + Math.sin(angle) * step };
  })
    .filter((candidate) => {
      if (!collidesWithMatureTree(store, candidate.x, candidate.z)) return true;
      return (
        currentClearance < MATURE_TREE_TRUNK_RADIUS &&
        nearestMatureTreeDistance(store, candidate.x, candidate.z) > currentClearance
      );
    })
    .sort(
      (left, right) =>
        Math.hypot(left.x - toX, left.z - toZ) - Math.hypot(right.x - toX, right.z - toZ),
    )[0];
  if (escapeCandidate) return { ...escapeCandidate, blocked: false };
  return { x: fromX, z: fromZ, blocked: true };
}

export function pathRemainsTraversable(
  grid: NavigationGrid,
  currentCell: number,
  cells: readonly number[],
  cursor: number,
): boolean {
  let previous = currentCell;
  for (let index = cursor; index < cells.length; index += 1) {
    const cell = cells[index];
    if (cell === undefined || !hasLineOfSight(grid, previous, cell)) return false;
    previous = cell;
  }
  return true;
}
