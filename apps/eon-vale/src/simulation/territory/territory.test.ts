import { describe, expect, it } from 'vitest';
import { type Building, BuildingType, VillageTier } from '@/shared/gameTypes';
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

function completedBuilding(id: number, villageId: number, type: BuildingType): Building {
  return {
    id,
    villageId,
    type,
    x: 64,
    z: 64,
    stage: 2,
    progress: 100,
    requiredProgress: 100,
    health: 100,
    completed: true,
    constructionPhase: 'complete',
    reservedWood: 0,
    reservedStone: 0,
    deliveredWood: 0,
    deliveredStone: 0,
    inTransitWood: 0,
    inTransitStone: 0,
    clearNodeIds: [],
    assignedWorkerIds: [],
    workSlots: 0,
  };
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

  it('uses the council hall and watchtower to expand and consolidate real territory', () => {
    const baseline = createWorldSimulation({
      seed: 'territory-governance',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const governed = createWorldSimulation({
      seed: 'territory-governance',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const baselineVillage = baseline.ensureVillageAt(64, 64, 45);
    const governedVillage = governed.ensureVillageAt(64, 64, 45);
    baselineVillage.tier = VillageTier.CityState;
    governedVillage.tier = VillageTier.CityState;
    for (const type of [BuildingType.CouncilHall, BuildingType.Watchtower]) {
      const building = completedBuilding(
        governed.state.buildings.length + 1,
        governedVillage.id,
        type,
      );
      governed.state.buildings.push(building);
      governedVillage.buildingIds.push(building.id);
    }

    advanceTerritoryClaims(baseline.state);
    advanceTerritoryClaims(governed.state);

    expect(
      ownedCells(governed.state.territory.villageIds, governedVillage.id).length,
    ).toBeGreaterThan(ownedCells(baseline.state.territory.villageIds, baselineVillage.id).length);
    expect(Math.max(...governed.state.territory.claimStrength)).toBe(32);
    expect(Math.max(...baseline.state.territory.claimStrength)).toBe(24);
  });
});
