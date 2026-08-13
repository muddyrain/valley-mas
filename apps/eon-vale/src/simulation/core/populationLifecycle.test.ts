import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

function livingHumans(simulation: ReturnType<typeof createWorldSimulation>): number[] {
  const ids: number[] = [];
  const { entities } = simulation.state;
  for (let id = 0; id < entities.count; id += 1) {
    if (entities.active[id] && entities.kind[id] === EntityKind.Human) ids.push(id);
  }
  return ids;
}

describe('resident family lifecycle', () => {
  it('starts with a balanced, staggered population instead of random middle-aged founders', () => {
    const simulation = createWorldSimulation({ seed: 'balanced-founders', initialHumans: 72 });
    const residents = livingHumans(simulation);
    const female = residents.filter((id) => simulation.state.entities.sex[id] === 0).length;
    const male = residents.filter((id) => simulation.state.entities.sex[id] === 1).length;
    const ages = residents.map((id) => simulation.state.entities.age[id] ?? 0);

    expect(Math.abs(female - male)).toBeLessThanOrEqual(1);
    expect(ages.filter((age) => age < 16).length).toBeGreaterThanOrEqual(9);
    expect(ages.filter((age) => age >= 18 && age <= 42).length).toBeGreaterThanOrEqual(36);
    expect(ages.filter((age) => age >= 50).length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...ages)).toBeLessThanOrEqual(66);
  });

  it('grows and then remains viable through a peaceful thirty-year soak', () => {
    const simulation = createWorldSimulation({
      seed: 'peaceful-demography',
      initialHumans: 72,
      mapSize: 128,
    });
    simulation.state.forcedPeaceUntil = 100_000;

    for (let tick = 0; tick < 21_600; tick += 1) simulation.step();

    const residents = livingHumans(simulation);
    const diagnostics = simulation.state.population;
    const childrenWithParents = residents.filter(
      (id) =>
        (simulation.state.entities.parentAIds[id] ?? 0xffff_ffff) !== 0xffff_ffff &&
        (simulation.state.entities.parentBIds[id] ?? 0xffff_ffff) !== 0xffff_ffff,
    );
    expect(residents.length).toBeGreaterThanOrEqual(72);
    expect(diagnostics.totalBirths).toBeGreaterThan(0);
    expect(diagnostics.history.length).toBeGreaterThanOrEqual(20);
    expect(diagnostics.carryingCapacity).toBeGreaterThanOrEqual(residents.length * 0.85);
    expect(childrenWithParents.length).toBeGreaterThan(0);
    expect(diagnostics.deathCauses.hunger).toBeLessThan(diagnostics.totalBirths / 3);
  }, 20_000);

  it('keeps population outcomes identical when the worker advances the same ticks at 1x or 8x', () => {
    const normal = createWorldSimulation({
      seed: 'speed-invariant',
      initialHumans: 72,
      mapSize: 128,
    });
    const accelerated = createWorldSimulation({
      seed: 'speed-invariant',
      initialHumans: 72,
      mapSize: 128,
    });
    normal.state.forcedPeaceUntil = 100_000;
    accelerated.state.forcedPeaceUntil = 100_000;

    for (let tick = 0; tick < 7_200; tick += 1) normal.step();
    for (let frame = 0; frame < 900; frame += 1) {
      for (let speedStep = 0; speedStep < 8; speedStep += 1) accelerated.step();
    }

    expect(accelerated.state.tick).toBe(normal.state.tick);
    expect(livingHumans(accelerated).length).toBe(livingHumans(normal).length);
    expect(accelerated.state.population).toEqual(normal.state.population);
  }, 15_000);
});
