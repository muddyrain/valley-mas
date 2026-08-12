import { describe, expect, it } from 'vitest';
import { EntityKind, ResidentSex } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe('family resettlement', () => {
  it('moves a whole young family from a crowded village into a reachable empty village', () => {
    const simulation = createWorldSimulation({
      seed: 'family-resettlement',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const source = simulation.ensureVillageAt(42, 64, 8);
    const destination = simulation.ensureVillageAt(58, 64, 0);
    source.kingdomId = 1;
    destination.kingdomId = 1;
    source.housingCapacity = 8;
    source.carryingCapacity = 8;
    destination.housingCapacity = 24;
    destination.carryingCapacity = 24;
    source.resources.food = 160;
    destination.resources.food = 160;

    const residents = simulation.spawn(EntityKind.Human, source.x, source.z, 8);
    for (const id of residents) {
      simulation.state.entities.villageIds[id] = source.id;
      simulation.state.entities.kingdomIds[id] = 1;
      simulation.state.entities.age[id] = 52;
    }
    const family = residents.slice(0, 4);
    const [mother, father, firstChild, secondChild] = family;
    if (
      mother === undefined ||
      father === undefined ||
      firstChild === undefined ||
      secondChild === undefined
    ) {
      throw new Error('测试家庭生成失败');
    }
    simulation.state.entities.sex[mother] = ResidentSex.Female;
    simulation.state.entities.sex[father] = ResidentSex.Male;
    simulation.state.entities.age[mother] = 28;
    simulation.state.entities.age[father] = 30;
    simulation.state.entities.age[firstChild] = 4;
    simulation.state.entities.age[secondChild] = 9;
    simulation.state.entities.partnerIds[mother] = father;
    simulation.state.entities.partnerIds[father] = mother;
    for (const id of family) simulation.state.entities.familyIds[id] = 1;
    simulation.state.entities.parentAIds[firstChild] = mother;
    simulation.state.entities.parentBIds[firstChild] = father;
    simulation.state.entities.parentAIds[secondChild] = mother;
    simulation.state.entities.parentBIds[secondChild] = father;
    simulation.state.worldLaws.humanReproduction = false;

    for (let tick = 0; tick < 4_320; tick += 1) simulation.step();

    expect(family.every((id) => simulation.state.entities.villageIds[id] === destination.id)).toBe(
      true,
    );
    expect(simulation.state.population.totalMigrations).toBeGreaterThanOrEqual(family.length);
  }, 20_000);
});
