import { type NaturalResourceStore, removeResourcesAtCell } from '../resources/naturalResources';
import { ElevationBand, elevationBandAt, type SurfaceHabitat, type WorldFacts } from './worldFacts';

export type WorldTerrainEdit =
  | { type: 'raise-terrain'; cell: number; amount: number }
  | { type: 'lower-terrain'; cell: number; amount: number }
  | { type: 'set-surface'; cell: number; surface: SurfaceHabitat };

export interface WorldTerrainEditResult {
  accepted: boolean;
  cell: number;
  previousBand: ElevationBand;
  nextBand: ElevationBand;
  invalidatedResourceIds: number[];
  reason?: 'cell-out-of-range' | 'surface-underwater';
}

export function applyWorldTerrainEdit(
  world: WorldFacts,
  resources: NaturalResourceStore,
  edit: WorldTerrainEdit,
): WorldTerrainEditResult {
  if (!Number.isInteger(edit.cell) || edit.cell < 0 || edit.cell >= world.elevation.length) {
    return {
      accepted: false,
      cell: edit.cell,
      previousBand: ElevationBand.DeepOcean,
      nextBand: ElevationBand.DeepOcean,
      invalidatedResourceIds: [],
      reason: 'cell-out-of-range',
    };
  }
  const previousBand = elevationBandAt(world.elevation[edit.cell] ?? -4);
  if (edit.type === 'set-surface') {
    if (previousBand === ElevationBand.DeepOcean || previousBand === ElevationBand.ShallowWater) {
      return {
        accepted: false,
        cell: edit.cell,
        previousBand,
        nextBand: previousBand,
        invalidatedResourceIds: [],
        reason: 'surface-underwater',
      };
    }
    world.surface[edit.cell] = edit.surface;
  } else {
    const direction = edit.type === 'raise-terrain' ? 1 : -1;
    const amount = Math.max(0, edit.amount);
    world.elevation[edit.cell] = Math.max(
      -4,
      Math.min(8, (world.elevation[edit.cell] ?? 0) + direction * amount),
    );
  }
  const nextBand = elevationBandAt(world.elevation[edit.cell] ?? -4);
  const invalidatedResourceIds =
    nextBand === ElevationBand.DeepOcean || nextBand === ElevationBand.ShallowWater
      ? removeResourcesAtCell(resources, edit.cell)
      : [];
  world.revision += 1;
  world.dirtyCells.push(edit.cell);
  return { accepted: true, cell: edit.cell, previousBand, nextBand, invalidatedResourceIds };
}
