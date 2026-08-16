import { describe, expect, it } from 'vitest';
import { DiplomacyState, EntityKind, VillageTier } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import {
  formKingdoms,
  kingdomLifeStatus,
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

  it('marks a kingdom extinct when no living citizens remain even if buildings survive', () => {
    const simulation = createWorldSimulation({ seed: 'last-city', initialHumans: 18 });
    const village = simulation.ensureVillageAt(64, 64, 18);
    village.tier = VillageTier.Hamlet;
    formKingdoms(simulation.state);
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      if (simulation.state.entities.kingdomIds[entityId] === 1) {
        simulation.state.entities.active[entityId] = 0;
      }
    }

    resolveKingdomExtinctions(simulation.state);

    expect(simulation.state.kingdoms[0]?.extinct).toBe(true);
    expect(simulation.state.kingdoms[0]?.capitalVillageId).toBe(0);
    expect(village.abandonedAtTick).toBe(Math.max(1, simulation.state.tick));
  });

  it('keeps citizens without a populated settlement alive as an exiled kingdom', () => {
    const simulation = createWorldSimulation({ seed: 'exiled-crown', initialHumans: 18 });
    const village = simulation.ensureVillageAt(64, 64, 18);
    const citizen = simulation.spawn(EntityKind.Human, village.x, village.z)[0] as number;
    simulation.state.entities.villageIds[citizen] = village.id;
    village.tier = VillageTier.Hamlet;
    formKingdoms(simulation.state);
    simulation.state.entities.kingdomIds[citizen] = 1;
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      if (simulation.state.entities.kingdomIds[entityId] !== 1) continue;
      if (entityId !== citizen) simulation.state.entities.active[entityId] = 0;
      simulation.state.entities.villageIds[entityId] = 0;
    }

    resolveKingdomExtinctions(simulation.state);

    const kingdom = simulation.state.kingdoms[0];
    if (!kingdom) throw new Error('测试王国未建立');
    expect(kingdomLifeStatus(simulation.state, kingdom)).toBe('exiled');
    expect(kingdom.extinct).toBe(false);
    expect(kingdom.capitalVillageId).toBe(0);
  });

  it('keeps a living capital stable and falls back to the strongest surviving settlement', () => {
    const simulation = createWorldSimulation({ seed: 'moving-crown', initialHumans: 18 });
    const first = simulation.ensureVillageAt(32, 64, 18);
    const second = simulation.ensureVillageAt(64, 64, 28);
    const third = simulation.ensureVillageAt(96, 64, 20);
    const firstCitizen = simulation.spawn(EntityKind.Human, first.x, first.z)[0] as number;
    const secondCitizen = simulation.spawn(EntityKind.Human, second.x, second.z)[0] as number;
    const thirdCitizen = simulation.spawn(EntityKind.Human, third.x, third.z)[0] as number;
    simulation.state.entities.villageIds[firstCitizen] = first.id;
    simulation.state.entities.villageIds[secondCitizen] = second.id;
    simulation.state.entities.villageIds[thirdCitizen] = third.id;
    first.tier = VillageTier.Hamlet;
    second.tier = VillageTier.Town;
    third.tier = VillageTier.CityState;
    formKingdoms(simulation.state);
    const kingdom = simulation.state.kingdoms[0];
    if (!kingdom) throw new Error('测试王国未建立');
    second.kingdomId = kingdom.id;
    third.kingdomId = kingdom.id;
    kingdom.villageIds = [first.id, second.id, third.id];
    simulation.state.entities.kingdomIds[firstCitizen] = kingdom.id;
    simulation.state.entities.kingdomIds[secondCitizen] = kingdom.id;
    simulation.state.entities.kingdomIds[thirdCitizen] = kingdom.id;

    refreshKingdomCapital(simulation.state, kingdom);
    expect(kingdom.capitalVillageId).toBe(first.id);

    first.health = 0;
    refreshKingdomCapital(simulation.state, kingdom);
    expect(kingdom.capitalVillageId).toBe(third.id);
  });
});
