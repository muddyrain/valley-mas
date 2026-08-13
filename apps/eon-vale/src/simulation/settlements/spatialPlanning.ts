import {
  AgentState,
  BuildingType,
  EntityKind,
  PlanningZoneKind,
  type Village,
  type WorkHotspot,
  type WorkHotspotKind,
  type WorldState,
} from '@/shared/gameTypes';
import { isWalkable } from '../navigation/grid';

export function planningZoneForBuilding(type: BuildingType): PlanningZoneKind {
  if (
    type === BuildingType.Home ||
    type === BuildingType.Storage ||
    type === BuildingType.TownCenter ||
    type === BuildingType.CouncilHall
  ) {
    return PlanningZoneKind.Residential;
  }
  if (
    type === BuildingType.Farm ||
    type === BuildingType.LoggingCamp ||
    type === BuildingType.Mine ||
    type === BuildingType.Workshop
  ) {
    return PlanningZoneKind.Production;
  }
  if (
    type === BuildingType.Barracks ||
    type === BuildingType.Wall ||
    type === BuildingType.Watchtower
  ) {
    return PlanningZoneKind.Defense;
  }
  return PlanningZoneKind.None;
}

export function paintVillagePlanningZone(
  state: WorldState,
  villageId: number,
  kind: PlanningZoneKind,
  centerCell: number,
  radius: number,
): number {
  const size = state.map.size;
  const centerX = centerCell % size;
  const centerZ = Math.floor(centerCell / size);
  let changed = 0;
  for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      if (offsetX * offsetX + offsetZ * offsetZ > radius * radius) continue;
      const x = centerX + offsetX;
      const z = centerZ + offsetZ;
      if (x < 0 || z < 0 || x >= size || z >= size) continue;
      const cell = z * size + x;
      if (
        state.territory.villageIds[cell] !== villageId ||
        !isWalkable(state.map.navigation, cell)
      ) {
        continue;
      }
      if (state.territory.planningZoneKinds[cell] === kind) continue;
      state.territory.planningZoneKinds[cell] = kind;
      state.territory.dirtyCells.push(cell);
      changed += 1;
    }
  }
  if (changed > 0) state.territory.revision += 1;
  return changed;
}

export function findPreferredPlanningSite(
  state: WorldState,
  village: Village,
  type: BuildingType,
  occupied: Array<{ x: number; z: number }>,
): { x: number; z: number } | null {
  const preferred = planningZoneForBuilding(type);
  if (preferred === PlanningZoneKind.None) return null;
  let best: { x: number; z: number; score: number } | null = null;
  for (let cell = 0; cell < state.territory.planningZoneKinds.length; cell += 1) {
    if (
      state.territory.planningZoneKinds[cell] !== preferred ||
      state.territory.villageIds[cell] !== village.id ||
      !isWalkable(state.map.navigation, cell)
    ) {
      continue;
    }
    const x = cell % state.map.size;
    const z = Math.floor(cell / state.map.size);
    if (x <= 1 || z <= 1 || x >= state.map.size - 2 || z >= state.map.size - 2) continue;
    if (occupied.some((site) => Math.hypot(site.x - x, site.z - z) < 1.8)) continue;
    const score = Math.hypot(x - village.x, z - village.z);
    if (
      !best ||
      score < best.score ||
      (score === best.score && cell < best.z * state.map.size + best.x)
    ) {
      best = { x, z, score };
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

function hotspotKind(state: AgentState): WorkHotspotKind | null {
  if (
    state === AgentState.GatherWood ||
    state === AgentState.GatherStone ||
    state === AgentState.Farm ||
    state === AgentState.Craft
  ) {
    return 'production';
  }
  if (state === AgentState.Build || state === AgentState.Repair) return 'construction';
  if (state === AgentState.Haul) return 'logistics';
  if (state === AgentState.Guard || state === AgentState.Chase || state === AgentState.Attack) {
    return 'defense';
  }
  return null;
}

export function collectVillageWorkHotspots(state: WorldState, villageId: number): WorkHotspot[] {
  const groups = new Map<string, WorkHotspot & { totalX: number; totalZ: number }>();
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (
      state.entities.active[entityId] !== 1 ||
      state.entities.kind[entityId] !== EntityKind.Human ||
      state.entities.villageIds[entityId] !== villageId
    ) {
      continue;
    }
    const kind = hotspotKind(state.entities.states[entityId] as AgentState);
    if (!kind) continue;
    const x = state.entities.positionsX[entityId] ?? 0;
    const z = state.entities.positionsZ[entityId] ?? 0;
    const key = `${kind}:${Math.floor(x / 6)}:${Math.floor(z / 6)}`;
    const group = groups.get(key) ?? { kind, count: 0, x: 0, z: 0, totalX: 0, totalZ: 0 };
    group.count += 1;
    group.totalX += x;
    group.totalZ += z;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      kind: group.kind,
      count: group.count,
      x: group.totalX / group.count,
      z: group.totalZ / group.count,
    }))
    .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind));
}

export function countVillagePlanningZones(
  state: WorldState,
  villageId: number,
): Record<
  PlanningZoneKind.Residential | PlanningZoneKind.Production | PlanningZoneKind.Defense,
  number
> {
  const counts = {
    [PlanningZoneKind.Residential]: 0,
    [PlanningZoneKind.Production]: 0,
    [PlanningZoneKind.Defense]: 0,
  };
  for (let cell = 0; cell < state.territory.planningZoneKinds.length; cell += 1) {
    if (state.territory.villageIds[cell] !== villageId) continue;
    const kind = state.territory.planningZoneKinds[cell] as PlanningZoneKind;
    if (kind !== PlanningZoneKind.None) counts[kind] += 1;
  }
  return counts;
}
