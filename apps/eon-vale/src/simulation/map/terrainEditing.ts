import {
  type MapTool,
  ResourceNodeKind,
  type ResourceNodeStore,
  TerrainType,
  type WorldMap,
} from '@/shared/gameTypes';
import { cellX, cellZ, chunkIndexForCell, isInside, setCellCost, toCell } from '../navigation/grid';
import {
  addResourceNode,
  findResourceNodesInRadius,
  removeResourceNode,
} from '../resources/resourceNodes';
import { navigationCostForTerrain } from './generateWorldMap';
import { markMapCellDirty } from './mapDirty';

export interface TerrainEdit {
  kind: MapTool;
  cell: number;
  radius: number;
}

export function editTerrain(
  map: WorldMap,
  edit: TerrainEdit,
  resourceNodes?: ResourceNodeStore,
): number[] {
  const centerX = cellX(map.navigation, edit.cell);
  const centerZ = cellZ(map.navigation, edit.cell);
  const changedChunks = new Set<number>();
  const radius = Math.max(0, Math.floor(edit.radius));
  for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (!isInside(map.navigation, x, z) || Math.hypot(x - centerX, z - centerZ) > radius + 0.2)
        continue;
      const cell = toCell(map.navigation, x, z);
      let terrain = map.terrain[cell] as TerrainType;
      if (edit.kind === 'raise') map.height[cell] = Math.min(8, (map.height[cell] ?? 0) + 0.7);
      if (edit.kind === 'lower') map.height[cell] = Math.max(-3, (map.height[cell] ?? 0) - 0.7);
      if (edit.kind === 'paint-land') {
        terrain = TerrainType.Grass;
        map.height[cell] = Math.max(0.4, map.height[cell] ?? 0);
      }
      if (edit.kind === 'paint-water') {
        terrain = TerrainType.ShallowOcean;
        map.height[cell] = -1.2;
      }
      if (edit.kind === 'paint-forest') {
        terrain = TerrainType.Forest;
        if (
          resourceNodes &&
          !findResourceNodesInRadius(resourceNodes, x + 0.5, z + 0.5, 0.6).some(
            (nodeId) => resourceNodes.kind[nodeId] === ResourceNodeKind.Tree,
          )
        ) {
          addResourceNode(resourceNodes, {
            kind: ResourceNodeKind.Tree,
            x: x + 0.5,
            z: z + 0.5,
            amount: 5,
            variant: (x * 3 + z * 7) % 4,
          });
        }
      }
      if (edit.kind === 'place-food')
        map.resourceFood[cell] = Math.min(500, (map.resourceFood[cell] ?? 0) + 30);
      if (edit.kind === 'place-stone' && resourceNodes) {
        addResourceNode(resourceNodes, {
          kind: ResourceNodeKind.Stone,
          x: x + 0.5,
          z: z + 0.5,
          amount: 12,
          variant: (x + z) % 3,
        });
      }
      if (edit.kind === 'erase') {
        map.resourceFood[cell] = 0;
        map.resourceWood[cell] = 0;
        map.resourceStone[cell] = 0;
        map.fire[cell] = 0;
        map.plague[cell] = 0;
        if (resourceNodes) {
          for (const nodeId of findResourceNodesInRadius(resourceNodes, x + 0.5, z + 0.5, 0.72)) {
            removeResourceNode(resourceNodes, nodeId);
          }
        }
      }
      map.terrain[cell] = terrain;
      setCellCost(map.navigation, x, z, navigationCostForTerrain(terrain, map.roads[cell] > 0));
      markMapCellDirty(map, cell);
      changedChunks.add(chunkIndexForCell(map.navigation, cell));
    }
  }
  return [...changedChunks].sort((left, right) => left - right);
}
