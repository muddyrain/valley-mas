import { type Building, BuildingType, type WorldState } from '@/shared/gameTypes';
import { createFlowField, type FlowField } from '../navigation/flowField';
import { isWalkable, toCell } from '../navigation/grid';
import { overlapsMatureTreeTrunk } from '../navigation/traversal';

const UNREACHABLE = 0xffff_ffff;

function nearestWalkableCell(state: WorldState, x: number, z: number): number {
  for (let radius = 0; radius < state.map.size / 2; radius += 1) {
    for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
        const cellX = Math.max(0, Math.min(state.map.size - 1, Math.round(x + offsetX)));
        const cellZ = Math.max(0, Math.min(state.map.size - 1, Math.round(z + offsetZ)));
        const cell = toCell(state.map.navigation, cellX, cellZ);
        if (
          isWalkable(state.map.navigation, cell) &&
          !overlapsMatureTreeTrunk(state.resourceNodes, cellX + 0.5, cellZ + 0.5)
        ) {
          return cell;
        }
      }
    }
  }
  return 0;
}

export interface ReachableStorage {
  building: Building;
  targetCell: number;
  navigationCost: number;
}

export function selectReachableStorage(
  state: WorldState,
  villageId: number,
  fromCell: number,
  flowFieldForTarget: (targetCell: number) => FlowField = (targetCell) =>
    createFlowField(state.map.navigation, targetCell),
): ReachableStorage | null {
  let selected: ReachableStorage | null = null;
  for (const building of state.buildings) {
    if (
      building.villageId !== villageId ||
      building.type !== BuildingType.Storage ||
      !building.completed ||
      building.health <= 0
    ) {
      continue;
    }
    const targetCell = nearestWalkableCell(state, building.x, building.z);
    if (targetCell < 0) continue;
    const navigationCost = flowFieldForTarget(targetCell).distance[fromCell];
    if (
      navigationCost === undefined ||
      navigationCost === UNREACHABLE ||
      (selected &&
        (navigationCost > selected.navigationCost ||
          (navigationCost === selected.navigationCost && building.id > selected.building.id)))
    ) {
      continue;
    }
    selected = { building, targetCell, navigationCost };
  }
  return selected;
}
