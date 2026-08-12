import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe.runIf(process.env.EON_250_YEAR_GATE === '1')('250-year generation gate', () => {
  it('keeps children, reproductive adults and elders in a peaceful healthy world', () => {
    const simulation = createWorldSimulation({
      seed: process.env.EON_250_YEAR_SEED ?? 'peaceful-demography-250',
      initialHumans: 72,
      mapSize: 128,
    });
    simulation.state.forcedPeaceUntil = Number.MAX_SAFE_INTEGER;

    for (let tick = 0; tick < 250 * 720; tick += 1) simulation.step();

    const ages: number[] = [];
    for (let id = 0; id < simulation.state.entities.count; id += 1) {
      if (
        simulation.state.entities.active[id] &&
        simulation.state.entities.kind[id] === EntityKind.Human
      ) {
        ages.push(simulation.state.entities.age[id] ?? 0);
      }
    }
    const carryingCapacity = simulation.state.population.carryingCapacity;
    const ratio = carryingCapacity > 0 ? ages.length / carryingCapacity : 0;
    const villages = simulation.state.villages
      .filter((village) => village.health > 0)
      .map((village) => {
        const residents = Array.from(
          { length: simulation.state.entities.count },
          (_, id) => id,
        ).filter(
          (id) =>
            simulation.state.entities.active[id] &&
            simulation.state.entities.kind[id] === EntityKind.Human &&
            simulation.state.entities.villageIds[id] === village.id,
        );
        return {
          id: village.id,
          population: residents.length,
          fertileWomen: residents.filter(
            (id) =>
              simulation.state.entities.sex[id] === 0 &&
              (simulation.state.entities.age[id] ?? 0) >= 18 &&
              (simulation.state.entities.age[id] ?? 0) <= 44,
          ).length,
          eligibleMen: residents.filter(
            (id) =>
              simulation.state.entities.sex[id] === 1 &&
              (simulation.state.entities.age[id] ?? 0) >= 18 &&
              (simulation.state.entities.age[id] ?? 0) <= 58,
          ).length,
          food: Number(village.resources.food.toFixed(1)),
          capacity: village.carryingCapacity,
          yearsSinceBirth: Number(
            ((simulation.state.tick - village.lastBirthTick) / 720).toFixed(1),
          ),
        };
      });
    console.info(
      `EON_250_YEAR_RESULT ${JSON.stringify({
        population: ages.length,
        children: ages.filter((age) => age < 16).length,
        reproductiveAdults: ages.filter((age) => age >= 18 && age <= 44).length,
        elders: ages.filter((age) => age >= 60).length,
        carryingCapacity,
        ratio,
        births: simulation.state.population.totalBirths,
        deaths: simulation.state.population.totalDeaths,
        villages,
        expeditions: simulation.state.expeditions.length,
      })}`,
    );

    expect(ages.filter((age) => age < 16).length).toBeGreaterThan(0);
    expect(ages.filter((age) => age >= 18 && age <= 44).length).toBeGreaterThan(1);
    expect(ages.filter((age) => age >= 60).length).toBeGreaterThan(0);
    expect(ratio).toBeGreaterThanOrEqual(0.6);
    expect(ratio).toBeLessThanOrEqual(0.85);
  }, 300_000);
});
