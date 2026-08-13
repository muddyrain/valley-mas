import type { TerritorySnapshot } from '@/render/renderTypes';
import type { TerritoryState } from '@/shared/gameTypes';

export function createFullTerritorySnapshot(territory: TerritoryState): TerritorySnapshot {
  const cells = Uint32Array.from({ length: territory.villageIds.length }, (_, cell) => cell);
  return {
    full: true,
    revision: territory.revision,
    cells,
    villageIds: territory.villageIds.slice(),
    claimStrength: territory.claimStrength.slice(),
    planningZoneKinds: territory.planningZoneKinds.slice(),
  };
}

export function drainTerritoryDelta(territory: TerritoryState): TerritorySnapshot | null {
  if (territory.dirtyCells.length === 0) return null;
  const cells = Uint32Array.from(new Set(territory.dirtyCells));
  territory.dirtyCells.length = 0;
  const villageIds = new Uint16Array(cells.length);
  const claimStrength = new Uint8Array(cells.length);
  const planningZoneKinds = new Uint8Array(cells.length);
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index] ?? 0;
    villageIds[index] = territory.villageIds[cell] ?? 0;
    claimStrength[index] = territory.claimStrength[cell] ?? 0;
    planningZoneKinds[index] = territory.planningZoneKinds[cell] ?? 0;
  }
  return {
    full: false,
    revision: territory.revision,
    cells,
    villageIds,
    claimStrength,
    planningZoneKinds,
  };
}
