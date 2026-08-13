import { describe, expect, it } from 'vitest';
import { ResourceNodeKind, ResourceNodeStage, TerrainType } from '@/shared/gameTypes';
import { addResourceNode, createResourceNodeStore } from '../resources/resourceNodes';
import { createNavigationGrid, setCellCost } from './grid';
import {
  constrainNavigationStep,
  pathRemainsTraversable,
  resolveTreeTrunkCollision,
  traversalSpeedMultiplier,
} from './traversal';

describe('movement traversal', () => {
  it('uses readable terrain speed tiers and keeps roads fastest on passable land', () => {
    expect(
      traversalSpeedMultiplier({
        terrain: TerrainType.Forest,
        road: false,
        heightDelta: 0,
        carrying: false,
      }),
    ).toBe(0.75);
    expect(
      traversalSpeedMultiplier({
        terrain: TerrainType.Grass,
        road: false,
        heightDelta: 0.45,
        carrying: false,
      }),
    ).toBe(0.6);
    expect(
      traversalSpeedMultiplier({
        terrain: TerrainType.Grass,
        road: true,
        heightDelta: 0,
        carrying: false,
      }),
    ).toBe(1.4);
  });

  it('never lets a continuous movement step enter or cross an impassable cell', () => {
    const grid = createNavigationGrid(8, 4);
    setCellCost(grid, 3, 1, 0);

    expect(constrainNavigationStep(grid, 2.5, 1.5, 3.5, 1.5)).toEqual({
      x: 2.5,
      z: 1.5,
      blocked: true,
    });
  });

  it('invalidates a simplified route when a dynamic obstacle appears between waypoints', () => {
    const grid = createNavigationGrid(8, 4);
    const route = [1 * grid.width + 1, 1 * grid.width + 6];
    expect(pathRemainsTraversable(grid, route[0] as number, route, 1)).toBe(true);

    setCellCost(grid, 4, 1, 0);

    expect(pathRemainsTraversable(grid, route[0] as number, route, 1)).toBe(false);
  });

  it('treats mature tree trunks as local hard collision without blocking a whole cell', () => {
    const store = createResourceNodeStore(16, 4);
    addResourceNode(store, {
      kind: ResourceNodeKind.Tree,
      x: 4.5,
      z: 4.5,
      amount: 6,
      stage: ResourceNodeStage.Mature,
    });

    const deflected = resolveTreeTrunkCollision(store, 4.05, 4.5, 4.35, 4.5);
    expect(deflected.blocked).toBe(false);
    expect(Math.hypot(deflected.x - 4.5, deflected.z - 4.5)).toBeGreaterThanOrEqual(0.22);
    expect(deflected).not.toMatchObject({ x: 4.35, z: 4.5 });
    expect(resolveTreeTrunkCollision(store, 4.05, 3.8, 4.35, 3.8).blocked).toBe(false);
  });
});
