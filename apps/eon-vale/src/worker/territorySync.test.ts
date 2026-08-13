import { describe, expect, it } from 'vitest';
import { createTerritoryState } from '../simulation/territory/territory';
import { createFullTerritorySnapshot, drainTerritoryDelta } from './territorySync';

describe('territory sync', () => {
  it('sends a full map once and only dirty cells afterwards', () => {
    const territory = createTerritoryState(16);
    territory.villageIds[17] = 2;
    territory.claimStrength[17] = 90;
    territory.planningZoneKinds[17] = 2;
    territory.revision = 3;
    const full = createFullTerritorySnapshot(territory);

    expect(full.full).toBe(true);
    expect(full.cells).toHaveLength(256);
    expect(full.villageIds[17]).toBe(2);
    expect(full.claimStrength[17]).toBe(90);
    expect(full.planningZoneKinds[17]).toBe(2);

    territory.villageIds[17] = 3;
    territory.claimStrength[17] = 120;
    territory.planningZoneKinds[17] = 3;
    territory.dirtyCells.push(17, 17);
    const delta = drainTerritoryDelta(territory);
    expect(delta).toMatchObject({ full: false, revision: 3 });
    expect(delta?.cells).toEqual(Uint32Array.from([17]));
    expect(delta?.villageIds).toEqual(Uint16Array.from([3]));
    expect(delta?.claimStrength).toEqual(Uint8Array.from([120]));
    expect(delta?.planningZoneKinds).toEqual(Uint8Array.from([3]));
    expect(territory.dirtyCells).toEqual([]);
    expect(drainTerritoryDelta(territory)).toBeNull();
  });
});
