import { describe, expect, it } from 'vitest';
import { EntityKind, ResidentSex } from '@/shared/gameTypes';
import { ANIMAL_LIFECYCLE_RULES } from '../rules/ecologyRules';
import { createWorldSimulation } from './worldSimulation';

function livingKind(
  simulation: ReturnType<typeof createWorldSimulation>,
  kind: EntityKind,
): number[] {
  const ids: number[] = [];
  for (let id = 0; id < simulation.state.entities.count; id += 1) {
    if (simulation.state.entities.active[id] && simulation.state.entities.kind[id] === kind) {
      ids.push(id);
    }
  }
  return ids;
}

function keepOnly(
  simulation: ReturnType<typeof createWorldSimulation>,
  kind: EntityKind,
  keep: number,
): number[] {
  const selected = livingKind(simulation, kind).slice(0, keep);
  for (let id = 0; id < simulation.state.entities.count; id += 1) {
    if (simulation.state.entities.kind[id] !== EntityKind.Human && !selected.includes(id)) {
      simulation.state.entities.active[id] = 0;
    }
  }
  simulation.state.worldLaws.naturalAnimalReturn = false;
  return selected;
}

describe('animal lifecycle', () => {
  it('records natural old-age deaths instead of leaving animals immortal', () => {
    const simulation = createWorldSimulation({ seed: 'animal-old-age', initialHumans: 0 });
    const [deer] = keepOnly(simulation, EntityKind.Deer, 1);
    expect(deer).toBeDefined();
    simulation.state.entities.age[deer as number] =
      ANIMAL_LIFECYCLE_RULES[EntityKind.Deer].lifespanYears;

    for (let tick = 0; tick < 720; tick += 1) simulation.step();

    const diagnostics = simulation.state.ecology.species[EntityKind.Deer];
    expect(livingKind(simulation, EntityKind.Deer)).toHaveLength(0);
    expect(diagnostics?.deaths).toBe(1);
    expect(diagnostics?.deathCauses.age).toBe(1);
  });

  it('records starvation deaths after prolonged unmet hunger', () => {
    const simulation = createWorldSimulation({ seed: 'animal-starvation', initialHumans: 0 });
    const [deer] = keepOnly(simulation, EntityKind.Deer, 1);
    expect(deer).toBeDefined();
    simulation.state.entities.hunger[deer as number] = 1_000;
    simulation.state.entities.health[deer as number] = 8;
    simulation.state.map.resourceFood.fill(0);

    for (let tick = 0; tick < 60; tick += 1) simulation.step();

    const diagnostics = simulation.state.ecology.species[EntityKind.Deer];
    expect(livingKind(simulation, EntityKind.Deer)).toHaveLength(0);
    expect(diagnostics?.deathCauses.hunger).toBe(1);
  });

  it('reproduces only from mature, fed pairs below habitat capacity', () => {
    const simulation = createWorldSimulation({ seed: 'animal-reproduction', initialHumans: 0 });
    const pair = keepOnly(simulation, EntityKind.Deer, 2);
    expect(pair).toHaveLength(2);
    const rules = ANIMAL_LIFECYCLE_RULES[EntityKind.Deer];
    simulation.state.entities.sex[pair[0] as number] = ResidentSex.Female;
    simulation.state.entities.sex[pair[1] as number] = ResidentSex.Male;
    for (const id of pair) {
      simulation.state.entities.age[id] = rules.maturityYears;
      simulation.state.entities.hunger[id] = rules.maximumBreedingHunger;
    }

    for (let tick = 0; tick < 7_200; tick += 1) simulation.step();

    const diagnostics = simulation.state.ecology.species[EntityKind.Deer];
    expect(diagnostics?.births).toBeGreaterThan(0);
    expect(livingKind(simulation, EntityKind.Deer).length).toBeLessThanOrEqual(
      diagnostics?.capacity ?? 0,
    );
  });
});
