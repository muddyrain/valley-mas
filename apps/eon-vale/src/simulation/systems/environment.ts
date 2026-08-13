import {
  AgentState,
  DiplomacyState,
  GodPower,
  ResourceNodeKind,
  TerrainType,
  type WorldState,
} from '@/shared/gameTypes';
import { stableNoise } from '@/shared/random';
import { recordWorldEvent } from '../history/worldHistory';
import { setDiplomacy } from '../kingdoms/kingdoms';
import { markMapCellDirty } from '../map/mapDirty';
import { cellX, cellZ, isInside, toCell } from '../navigation/grid';
import {
  addResourceNode,
  findResourceNodesInRadius,
  harvestResourceNode,
  matureResourceNode,
  removeResourceNode,
} from '../resources/resourceNodes';

function cellsInRadius(state: WorldState, center: number, radius: number): number[] {
  const centerX = cellX(state.map.navigation, center);
  const centerZ = cellZ(state.map.navigation, center);
  const cells: number[] = [];
  for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (
        !isInside(state.map.navigation, x, z) ||
        Math.hypot(x - centerX, z - centerZ) > radius + 0.2
      )
        continue;
      cells.push(toCell(state.map.navigation, x, z));
    }
  }
  return cells;
}

export function applyGodPower(
  state: WorldState,
  power: GodPower,
  center: number,
  radius: number,
): void {
  const cells = cellsInRadius(state, center, radius);
  const affected = new Set(cells);
  const centerX = cellX(state.map.navigation, center) + 0.5;
  const centerZ = cellZ(state.map.navigation, center) + 0.5;
  const affectedNodes = findResourceNodesInRadius(
    state.resourceNodes,
    centerX,
    centerZ,
    radius + 0.75,
  );
  for (const cell of cells) {
    if (power === GodPower.Rain) {
      state.map.rain[cell] = 220;
      state.map.fire[cell] = Math.max(0, (state.map.fire[cell] ?? 0) - 130);
      state.map.crops[cell] = Math.min(255, (state.map.crops[cell] ?? 0) + 18);
      state.map.moisture[cell] = Math.min(255, (state.map.moisture[cell] ?? 0) + 20);
    }
    if (power === GodPower.Lightning)
      state.map.fire[cell] = Math.max(state.map.fire[cell] ?? 0, 175);
    if (power === GodPower.Fire) state.map.fire[cell] = 255;
    if (power === GodPower.Meteor) {
      state.map.craters[cell] = 255;
      state.map.height[cell] = Math.max(-1.4, (state.map.height[cell] ?? 0) - 2.2);
      state.map.fire[cell] = 230;
    }
    if (power === GodPower.Plague) state.map.plague[cell] = 255;
    if (power === GodPower.Growth || power === GodPower.Fertility) {
      state.map.resourceFood[cell] = Math.min(500, (state.map.resourceFood[cell] ?? 0) + 24);
      state.map.crops[cell] = Math.min(255, (state.map.crops[cell] ?? 0) + 42);
      if (
        state.map.terrain[cell] === TerrainType.Forest ||
        state.map.terrain[cell] === TerrainType.Grass
      ) {
        const x = cellX(state.map.navigation, cell);
        const z = cellZ(state.map.navigation, cell);
        const trees = findResourceNodesInRadius(state.resourceNodes, x + 0.5, z + 0.5, 0.7).filter(
          (nodeId) => state.resourceNodes.kind[nodeId] === ResourceNodeKind.Tree,
        );
        if (trees.length === 0) {
          addResourceNode(state.resourceNodes, {
            kind: ResourceNodeKind.Tree,
            x: x + 0.5,
            z: z + 0.5,
            amount: 5,
            variant: (x * 3 + z * 5) % 4,
          });
        } else {
          for (const nodeId of trees) matureResourceNode(state.resourceNodes, nodeId);
        }
      }
    }
    if (power === GodPower.Frost) {
      state.map.fire[cell] = 0;
      if (
        state.map.terrain[cell] !== TerrainType.DeepOcean &&
        state.map.terrain[cell] !== TerrainType.ShallowOcean &&
        state.map.terrain[cell] !== TerrainType.Mountain
      ) {
        state.map.terrain[cell] = TerrainType.Snow;
      }
    }
    if (power === GodPower.Earthquake) {
      state.map.height[cell] = Math.max(-2, (state.map.height[cell] ?? 0) - 0.8);
      state.map.craters[cell] = Math.max(state.map.craters[cell] ?? 0, 90);
    }
    if (power === GodPower.Purify) {
      state.map.fire[cell] = 0;
      state.map.plague[cell] = 0;
    }
    markMapCellDirty(state.map, cell);
  }

  if (power === GodPower.Meteor || power === GodPower.Earthquake) {
    for (const nodeId of affectedNodes) removeResourceNode(state.resourceNodes, nodeId);
  } else if (power === GodPower.Fire || power === GodPower.Lightning) {
    for (const nodeId of affectedNodes) {
      if (state.resourceNodes.kind[nodeId] !== ResourceNodeKind.Tree) continue;
      harvestResourceNode(
        state.resourceNodes,
        nodeId,
        state.tick,
        state.resourceNodes.amount[nodeId] ?? 1,
      );
    }
  }

  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (!state.entities.active[entityId]) continue;
    const cell = toCell(
      state.map.navigation,
      Math.floor(state.entities.positionsX[entityId] ?? 0),
      Math.floor(state.entities.positionsZ[entityId] ?? 0),
    );
    if (!affected.has(cell)) continue;
    if (power === GodPower.Lightning || power === GodPower.Meteor) {
      state.entities.health[entityId] = Math.max(0, (state.entities.health[entityId] ?? 0) - 420);
    }
    if (power === GodPower.Tornado) {
      state.entities.health[entityId] = Math.max(0, (state.entities.health[entityId] ?? 0) - 110);
      state.entities.states[entityId] = AgentState.Flee;
    }
    if (power === GodPower.Plague) state.entities.infected[entityId] = 255;
    if (power === GodPower.Blessing) {
      state.entities.blessed[entityId] = 1_200;
      state.entities.energy[entityId] = 1_000;
    }
    if (power === GodPower.Heal) {
      state.entities.health[entityId] = 1_000;
      state.entities.infected[entityId] = 0;
    }
    if (power === GodPower.Rage) state.entities.enraged[entityId] = 800;
    if (power === GodPower.Curse) {
      state.entities.blessed[entityId] = 0;
      state.entities.energy[entityId] = Math.max(0, (state.entities.energy[entityId] ?? 0) - 420);
      state.entities.health[entityId] = Math.max(1, (state.entities.health[entityId] ?? 0) - 180);
      state.entities.traits[entityId] = (state.entities.traits[entityId] ?? 0) | 0x80;
    }
    if (power === GodPower.Purify) state.entities.infected[entityId] = 0;
    if (power === GodPower.Fertility) state.entities.blessed[entityId] = 600;
  }

  if (
    power === GodPower.Meteor ||
    power === GodPower.Tornado ||
    power === GodPower.Earthquake ||
    power === GodPower.Fire
  ) {
    for (const building of state.buildings) {
      const cell = toCell(
        state.map.navigation,
        Math.max(0, Math.min(state.map.size - 1, Math.floor(building.x))),
        Math.max(0, Math.min(state.map.size - 1, Math.floor(building.z))),
      );
      if (!affected.has(cell)) continue;
      const damage =
        power === GodPower.Meteor
          ? 80
          : power === GodPower.Earthquake
            ? 42
            : power === GodPower.Tornado
              ? 28
              : 12;
      building.health = Math.max(0, building.health - damage);
    }
  }

  if (power === GodPower.Diplomacy && state.kingdoms.length >= 2) {
    const active = state.kingdoms.filter((kingdom) => !kingdom.extinct);
    const hasWar = active.some((kingdom) =>
      Object.values(kingdom.relations).includes(DiplomacyState.War),
    );
    for (let first = 0; first < active.length; first += 1) {
      for (let second = first + 1; second < active.length; second += 1) {
        setDiplomacy(
          state,
          active[first]?.id ?? 0,
          active[second]?.id ?? 0,
          hasWar ? DiplomacyState.Peace : DiplomacyState.War,
        );
      }
    }
    if (hasWar) state.forcedPeaceUntil = state.tick + 600;
  }

  const disasterNames: Partial<Record<GodPower, string>> = {
    [GodPower.Lightning]: '雷击',
    [GodPower.Fire]: '火灾',
    [GodPower.Tornado]: '龙卷风',
    [GodPower.Meteor]: '陨石坠落',
    [GodPower.Plague]: '瘟疫',
    [GodPower.Earthquake]: '地震',
  };
  const disasterName = disasterNames[power];
  if (disasterName) {
    recordWorldEvent(state, {
      kind: 'disaster',
      category: 'disaster',
      message: `${disasterName}袭击了地图 ${center % state.map.size}, ${Math.floor(center / state.map.size)}`,
      archive: true,
      notification: true,
      locationCell: center,
    });
  }
}

export function stepEnvironment(state: WorldState): void {
  const nextFire = state.map.fire.slice();
  const nextPlague = state.map.plague.slice();
  const width = state.map.size;
  for (let cell = 0; cell < state.map.terrain.length; cell += 1) {
    const fireBefore = state.map.fire[cell] ?? 0;
    const rainBefore = state.map.rain[cell] ?? 0;
    const plagueBefore = state.map.plague[cell] ?? 0;
    const cropsBefore = state.map.crops[cell] ?? 0;
    if (
      state.map.terrain[cell] === TerrainType.DeepOcean ||
      state.map.terrain[cell] === TerrainType.ShallowOcean
    ) {
      nextFire[cell] = 0;
      nextPlague[cell] = 0;
      continue;
    }
    const rain = state.map.rain[cell] ?? 0;
    if (rain > 0) {
      state.map.rain[cell] = Math.max(0, rain - 2);
      nextFire[cell] = Math.max(0, (nextFire[cell] ?? 0) - 12);
      state.map.crops[cell] = Math.min(255, (state.map.crops[cell] ?? 0) + 1);
    } else if ((nextFire[cell] ?? 0) > 0) nextFire[cell] = Math.max(0, (nextFire[cell] ?? 0) - 2);
    if ((state.map.fire[cell] ?? 0) > 180) {
      const x = cell % width;
      const z = Math.floor(cell / width);
      const neighbours = [
        x > 0 ? cell - 1 : -1,
        x + 1 < width ? cell + 1 : -1,
        z > 0 ? cell - width : -1,
        z + 1 < width ? cell + width : -1,
      ];
      for (const neighbour of neighbours) {
        if (
          neighbour < 0 ||
          state.map.terrain[neighbour] === TerrainType.DeepOcean ||
          state.map.terrain[neighbour] === TerrainType.ShallowOcean
        )
          continue;
        if (stableNoise(state.tick * 31 + cell * 7 + neighbour) > 0.82)
          nextFire[neighbour] = Math.max(nextFire[neighbour] ?? 0, 90);
      }
    }
    if ((state.map.plague[cell] ?? 0) > 0)
      nextPlague[cell] = Math.max(0, (nextPlague[cell] ?? 0) - 1);
    if (
      (nextFire[cell] ?? 0) !== fireBefore ||
      (state.map.rain[cell] ?? 0) !== rainBefore ||
      (nextPlague[cell] ?? 0) !== plagueBefore ||
      (state.map.crops[cell] ?? 0) !== cropsBefore
    ) {
      markMapCellDirty(state.map, cell);
    }
  }
  state.map.fire.set(nextFire);
  state.map.plague.set(nextPlague);
}
