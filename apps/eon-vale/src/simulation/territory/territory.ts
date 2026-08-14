import type { TerritoryState, Village, WorldState } from '@/shared/gameTypes';
import { isWalkable } from '../navigation/grid';
import { resolveSettlementCapabilities } from '../settlements/settlementCapabilities';

const UNREACHED = Number.POSITIVE_INFINITY;
const DEFAULT_CLAIM_STEP = 24;
const DEFAULT_DECAY_STEP = 16;
const BASE_CLAIM_BUDGET = [8, 13, 19, 26] as const;

export interface TerritoryAdvanceOptions {
  claimStep?: number;
  decayStep?: number;
}

export function createTerritoryState(mapSize: number): TerritoryState {
  const cellCount = mapSize * mapSize;
  return {
    villageIds: new Uint16Array(cellCount),
    claimStrength: new Uint8Array(cellCount),
    planningZoneKinds: new Uint8Array(cellCount),
    dirtyCells: [],
    revision: 0,
  };
}

function claimBudget(state: WorldState, village: Village): number {
  const completedBuildings = village.buildingIds.reduce((count, buildingId) => {
    const building = state.buildings[buildingId - 1];
    return count + (building?.completed && building.health > 0 ? 1 : 0);
  }, 0);
  const populationReach = Math.min(6, Math.floor(village.population / 10));
  const buildingReach = Math.min(4, Math.floor(completedBuildings / 3));
  const capabilities = resolveSettlementCapabilities(state, village);
  return (
    (BASE_CLAIM_BUDGET[village.tier] ?? BASE_CLAIM_BUDGET[0]) +
    populationReach +
    buildingReach +
    capabilities.territoryReachBonus
  );
}

function nearestWalkableCell(state: WorldState, x: number, z: number): number {
  const centerX = Math.max(0, Math.min(state.map.size - 1, Math.floor(x)));
  const centerZ = Math.max(0, Math.min(state.map.size - 1, Math.floor(z)));
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
        const cellX = centerX + offsetX;
        const cellZ = centerZ + offsetZ;
        if (cellX < 0 || cellZ < 0 || cellX >= state.map.size || cellZ >= state.map.size) continue;
        const cell = cellZ * state.map.size + cellX;
        if (isWalkable(state.map.navigation, cell)) return cell;
      }
    }
  }
  return -1;
}

function proposeVillageClaims(
  state: WorldState,
  village: Village,
  desiredVillageIds: Uint16Array,
  bestScores: Float32Array,
): void {
  const budget = claimBudget(state, village);
  const startCell = nearestWalkableCell(state, village.x, village.z);
  if (startCell < 0) return;
  const distances = new Map<number, number>([[startCell, 0]]);
  const queueCells: number[] = [startCell];
  const queueDistances: number[] = [0];
  let cursor = 0;
  while (cursor < queueCells.length) {
    const cell = queueCells[cursor] ?? -1;
    const distance = queueDistances[cursor] ?? UNREACHED;
    cursor += 1;
    if (cell < 0 || distance !== distances.get(cell)) continue;
    const score = distance / Math.max(1, budget);
    const currentScore = bestScores[cell] ?? UNREACHED;
    const currentVillageId = desiredVillageIds[cell] ?? 0;
    if (score < currentScore || (score === currentScore && village.id < currentVillageId)) {
      bestScores[cell] = score;
      desiredVillageIds[cell] = village.id;
    }
    const x = cell % state.map.size;
    const z = Math.floor(cell / state.map.size);
    const neighbours = [
      x > 0 ? cell - 1 : -1,
      x + 1 < state.map.size ? cell + 1 : -1,
      z > 0 ? cell - state.map.size : -1,
      z + 1 < state.map.size ? cell + state.map.size : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0 || !isWalkable(state.map.navigation, neighbour)) continue;
      const navigationCost = state.map.navigation.cost[neighbour] ?? 0;
      const nextDistance = distance + Math.max(1, navigationCost / 4);
      if (nextDistance > budget || nextDistance >= (distances.get(neighbour) ?? UNREACHED))
        continue;
      distances.set(neighbour, nextDistance);
      queueCells.push(neighbour);
      queueDistances.push(nextDistance);
    }
  }
}

export function advanceTerritoryClaims(
  state: WorldState,
  options: TerritoryAdvanceOptions = {},
): void {
  const cellCount = state.map.size * state.map.size;
  if (
    state.territory.villageIds.length !== cellCount ||
    state.territory.claimStrength.length !== cellCount ||
    state.territory.planningZoneKinds.length !== cellCount
  ) {
    state.territory = createTerritoryState(state.map.size);
  }
  const territory = state.territory;
  const desiredVillageIds = new Uint16Array(cellCount);
  const bestScores = new Float32Array(cellCount);
  bestScores.fill(UNREACHED);
  for (const village of state.villages) {
    if (village.health <= 0 || village.population <= 0) continue;
    proposeVillageClaims(state, village, desiredVillageIds, bestScores);
  }
  const claimStep = Math.max(1, Math.min(255, Math.round(options.claimStep ?? DEFAULT_CLAIM_STEP)));
  const decayStep = Math.max(1, Math.min(255, Math.round(options.decayStep ?? DEFAULT_DECAY_STEP)));
  let changed = false;
  const claimSteps = new Map(
    state.villages.map((village) => [
      village.id,
      Math.min(255, claimStep + resolveSettlementCapabilities(state, village).claimStrengthBonus),
    ]),
  );
  for (let cell = 0; cell < cellCount; cell += 1) {
    const currentVillageId = territory.villageIds[cell] ?? 0;
    const desiredVillageId = desiredVillageIds[cell] ?? 0;
    const currentStrength = territory.claimStrength[cell] ?? 0;
    let nextVillageId = currentVillageId;
    let nextStrength = currentStrength;
    if (currentVillageId === desiredVillageId) {
      if (currentVillageId > 0) {
        nextStrength = Math.min(
          255,
          currentStrength + (claimSteps.get(currentVillageId) ?? claimStep),
        );
      }
    } else if (currentVillageId === 0) {
      nextVillageId = desiredVillageId;
      nextStrength = desiredVillageId > 0 ? (claimSteps.get(desiredVillageId) ?? claimStep) : 0;
    } else {
      nextStrength = Math.max(0, currentStrength - decayStep);
      if (nextStrength === 0) {
        nextVillageId = desiredVillageId;
        nextStrength = desiredVillageId > 0 ? (claimSteps.get(desiredVillageId) ?? claimStep) : 0;
      }
    }
    if (nextVillageId === currentVillageId && nextStrength === currentStrength) continue;
    territory.villageIds[cell] = nextVillageId;
    territory.claimStrength[cell] = nextStrength;
    if (nextVillageId !== currentVillageId) {
      territory.planningZoneKinds[cell] = 0;
    }
    territory.dirtyCells.push(cell);
    changed = true;
  }
  if (changed) territory.revision += 1;
}

export function territoryVillageIdAtCell(state: WorldState, cell: number): number {
  if (cell < 0 || cell >= state.territory.villageIds.length) return 0;
  return state.territory.villageIds[cell] ?? 0;
}

export function territoryKingdomIdAtCell(state: WorldState, cell: number): number {
  const villageId = territoryVillageIdAtCell(state, cell);
  if (!villageId) return 0;
  return state.villages.find((village) => village.id === villageId)?.kingdomId ?? 0;
}

export function canVillageUseTerritoryCell(
  state: WorldState,
  villageId: number,
  cell: number,
): boolean {
  const ownerVillageId = territoryVillageIdAtCell(state, cell);
  return ownerVillageId === 0 || ownerVillageId === villageId;
}

export function villageTerritoryCellCount(state: WorldState, villageId: number): number {
  let count = 0;
  for (const ownerVillageId of state.territory.villageIds) {
    if (ownerVillageId === villageId) count += 1;
  }
  return count;
}
