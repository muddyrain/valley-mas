import { describe, expect, it } from 'vitest';
import { DiplomacyState, VillageTier } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import {
  formKingdoms,
  refreshKingdomCapital,
  resolveKingdomExtinctions,
  setDiplomacy,
} from './kingdoms';

describe('kingdom lifecycle', () => {
  it('forms kingdoms from eligible villages and can declare war', () => {
    const simulation = createWorldSimulation({ seed: 'crowns', initialHumans: 36 });
    const first = simulation.ensureVillageAt(32, 64, 18);
    const second = simulation.ensureVillageAt(96, 64, 18);
    first.tier = VillageTier.Hamlet;
    second.tier = VillageTier.Hamlet;

    formKingdoms(simulation.state);
    expect(simulation.state.kingdoms).toHaveLength(2);
    expect(simulation.state.kingdoms[0]?.capitalVillageId).toBe(first.id);
    expect(simulation.state.kingdoms[1]?.capitalVillageId).toBe(second.id);
    setDiplomacy(simulation.state, 1, 2, DiplomacyState.War);
    expect(simulation.state.kingdoms[0]?.relations[2]).toBe(DiplomacyState.War);
    expect(simulation.state.kingdoms[1]?.relations[1]).toBe(DiplomacyState.War);
  });

  it('marks a kingdom extinct after its final village falls', () => {
    const simulation = createWorldSimulation({ seed: 'last-city', initialHumans: 18 });
    const village = simulation.ensureVillageAt(64, 64, 18);
    village.tier = VillageTier.Hamlet;
    formKingdoms(simulation.state);
    village.health = 0;

    resolveKingdomExtinctions(simulation.state);

    expect(simulation.state.kingdoms[0]?.extinct).toBe(true);
    expect(simulation.state.kingdoms[0]?.capitalVillageId).toBe(0);
  });

  it('keeps a living capital stable and falls back to the strongest surviving settlement', () => {
    const simulation = createWorldSimulation({ seed: 'moving-crown', initialHumans: 18 });
    const first = simulation.ensureVillageAt(32, 64, 18);
    const second = simulation.ensureVillageAt(64, 64, 28);
    const third = simulation.ensureVillageAt(96, 64, 20);
    first.tier = VillageTier.Hamlet;
    second.tier = VillageTier.Town;
    third.tier = VillageTier.CityState;
    formKingdoms(simulation.state);
    const kingdom = simulation.state.kingdoms[0];
    if (!kingdom) throw new Error('测试王国未建立');
    second.kingdomId = kingdom.id;
    third.kingdomId = kingdom.id;
    kingdom.villageIds = [first.id, second.id, third.id];

    refreshKingdomCapital(simulation.state, kingdom);
    expect(kingdom.capitalVillageId).toBe(first.id);

    first.health = 0;
    refreshKingdomCapital(simulation.state, kingdom);
    expect(kingdom.capitalVillageId).toBe(third.id);
  });
});
