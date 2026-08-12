import { describe, expect, it } from 'vitest';
import { EntityKind, ResidentSex } from '@/shared/gameTypes';
import { createFlowField } from '../navigation/flowField';
import { createWorldSimulation } from './worldSimulation';

describe('population continuity', () => {
  it('reunites compatible adults stranded in small villages of the same kingdom', () => {
    const simulation = createWorldSimulation({
      seed: 'population-continuity',
      initialHumans: 0,
      mapSize: 128,
    });
    const targetCell = simulation.state.map.navigation.cost.findIndex((cost) => cost > 0);
    const field = createFlowField(simulation.state.map.navigation, targetCell);
    const sourceCell = field.distance.findIndex((distance) => distance >= 6 && distance <= 10);
    expect(sourceCell).toBeGreaterThanOrEqual(0);
    const targetX = targetCell % simulation.state.map.size;
    const targetZ = Math.floor(targetCell / simulation.state.map.size);
    const sourceX = sourceCell % simulation.state.map.size;
    const sourceZ = Math.floor(sourceCell / simulation.state.map.size);
    const women = simulation.spawn(EntityKind.Human, sourceX + 0.5, sourceZ + 0.5, 2);
    const men = simulation.spawn(EntityKind.Human, targetX + 0.5, targetZ + 0.5, 2);
    const firstVillage = simulation.ensureVillageAt(sourceX, sourceZ, women.length);
    const secondVillage = simulation.ensureVillageAt(targetX, targetZ, men.length);
    firstVillage.kingdomId = 1;
    secondVillage.kingdomId = 1;
    simulation.state.kingdoms.push({
      id: 1,
      name: '续火王国',
      color: '#6ca870',
      leaderId: women[0] ?? 0,
      villageIds: [firstVillage.id, secondVillage.id],
      relations: {},
      militaryPower: 0,
      extinct: false,
      foundedAtTick: 0,
    });
    women.forEach((entityId) => {
      simulation.state.entities.sex[entityId] = ResidentSex.Female;
      simulation.state.entities.age[entityId] = 20;
      simulation.state.entities.villageIds[entityId] = firstVillage.id;
      simulation.state.entities.kingdomIds[entityId] = 1;
    });
    men.forEach((entityId) => {
      simulation.state.entities.sex[entityId] = ResidentSex.Male;
      simulation.state.entities.age[entityId] = 20;
      simulation.state.entities.villageIds[entityId] = secondVillage.id;
      simulation.state.entities.kingdomIds[entityId] = 1;
    });

    for (let tick = 0; tick < 14_400; tick += 1) simulation.step();

    expect(simulation.state.population.totalBirths).toBeGreaterThan(0);
    expect(simulation.state.population.totalMigrations).toBeGreaterThan(0);
  });
});
