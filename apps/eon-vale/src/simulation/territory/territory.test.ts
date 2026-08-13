import { describe, expect, it } from 'vitest';
import { VillageTier } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import {
  advanceTerritoryClaims,
  territoryKingdomIdAtCell,
  territoryVillageIdAtCell,
} from './territory';

function ownedCells(villageIds: Uint16Array, villageId: number): number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < villageIds.length; cell += 1) {
    if (villageIds[cell] === villageId) cells.push(cell);
  }
  return cells;
}

describe('cell territory', () => {
  it('claims reachable land cell by cell without crossing blocked terrain', () => {
    const simulation = createWorldSimulation({
      seed: 'territory-reachable',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const village = simulation.ensureVillageAt(64, 64, 24);
    village.tier = VillageTier.Town;

    advanceTerritoryClaims(simulation.state, { claimStep: 255, decayStep: 255 });

    const cells = ownedCells(simulation.state.territory.villageIds, village.id);
    expect(cells.length).toBeGreaterThan(40);
    expect(territoryVillageIdAtCell(simulation.state, cells[0] ?? -1)).toBe(village.id);
    expect(cells.every((cell) => (simulation.state.map.navigation.cost[cell] ?? 0) > 0)).toBe(true);
    expect(territoryVillageIdAtCell(simulation.state, 0)).toBe(0);
  });

  it('partitions neighbouring settlements and derives kingdom ownership from village cells', () => {
    const simulation = createWorldSimulation({
      seed: 'territory-rivals',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const first = simulation.ensureVillageAt(48, 64, 24);
    const second = simulation.ensureVillageAt(80, 64, 24);
    first.tier = VillageTier.Town;
    second.tier = VillageTier.Town;
    first.kingdomId = 1;
    second.kingdomId = 2;

    advanceTerritoryClaims(simulation.state, { claimStep: 255, decayStep: 255 });

    const firstCell = 64 * 128 + 48;
    const secondCell = 64 * 128 + 80;
    expect(territoryVillageIdAtCell(simulation.state, firstCell)).toBe(first.id);
    expect(territoryVillageIdAtCell(simulation.state, secondCell)).toBe(second.id);
    expect(territoryKingdomIdAtCell(simulation.state, firstCell)).toBe(1);
    expect(territoryKingdomIdAtCell(simulation.state, secondCell)).toBe(2);

    second.kingdomId = 1;
    expect(territoryVillageIdAtCell(simulation.state, secondCell)).toBe(second.id);
    expect(territoryKingdomIdAtCell(simulation.state, secondCell)).toBe(1);
  });

  it('decays abandoned territory gradually instead of erasing it immediately', () => {
    const simulation = createWorldSimulation({
      seed: 'territory-decay',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const village = simulation.ensureVillageAt(64, 64, 18);
    village.tier = VillageTier.Hamlet;
    advanceTerritoryClaims(simulation.state, { claimStep: 255, decayStep: 255 });
    const claimedBefore = ownedCells(simulation.state.territory.villageIds, village.id).length;

    village.health = 0;
    advanceTerritoryClaims(simulation.state, { claimStep: 64, decayStep: 64 });
    expect(ownedCells(simulation.state.territory.villageIds, village.id)).toHaveLength(
      claimedBefore,
    );

    for (let cycle = 0; cycle < 3; cycle += 1) {
      advanceTerritoryClaims(simulation.state, { claimStep: 64, decayStep: 64 });
    }
    expect(ownedCells(simulation.state.territory.villageIds, village.id)).toHaveLength(0);
  });
});
