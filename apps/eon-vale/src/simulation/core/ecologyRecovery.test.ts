import { describe, expect, it } from 'vitest';
import { EntityKind, TerrainType } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

function livingKind(
  simulation: ReturnType<typeof createWorldSimulation>,
  kind: EntityKind,
): number[] {
  const result: number[] = [];
  const { entities } = simulation.state;
  for (let entityId = 0; entityId < entities.count; entityId += 1) {
    if (entities.active[entityId] && entities.kind[entityId] === kind) result.push(entityId);
  }
  return result;
}

function deactivateKind(
  simulation: ReturnType<typeof createWorldSimulation>,
  kind: EntityKind,
): void {
  for (const entityId of livingKind(simulation, kind)) {
    simulation.state.entities.active[entityId] = 0;
  }
}

describe('long-running ecology recovery', () => {
  it('returns a previously seen species as a viable habitat-bound group', () => {
    const simulation = createWorldSimulation({
      seed: 'rewilding-deer',
      initialHumans: 0,
      mapSize: 128,
    });
    deactivateKind(simulation, EntityKind.Deer);
    simulation.state.worldLaws.naturalAnimalReturn = true;
    simulation.state.ecology.nextReturnTicks[EntityKind.Deer] = 0;

    for (let tick = 0; tick < 1_440; tick += 1) simulation.step();

    expect(livingKind(simulation, EntityKind.Deer).length).toBeGreaterThanOrEqual(2);
    expect(livingKind(simulation, EntityKind.Deer).length).toBeLessThanOrEqual(4);
    expect(
      simulation.state.events.some(
        (event) => event.kind === 'ecology' && event.message.includes('鹿'),
      ),
    ).toBe(true);
  });

  it('does not create a species that has never existed in a blank world', () => {
    const simulation = createWorldSimulation({
      seed: 'sterile-ocean',
      initialHumans: 0,
      mapSize: 128,
      preset: 'ocean',
    });
    simulation.state.worldLaws.naturalAnimalReturn = true;

    for (let tick = 0; tick < 2_160; tick += 1) simulation.step();

    expect(simulation.state.entities.count).toBe(0);
    expect(simulation.state.ecology.species[EntityKind.Fish]?.everPresent).toBe(false);
  });

  it('waits for a matching habitat before a species can return', () => {
    const simulation = createWorldSimulation({
      seed: 'missing-bear-habitat',
      initialHumans: 0,
      mapSize: 128,
    });
    deactivateKind(simulation, EntityKind.Bear);
    simulation.state.map.terrain.fill(TerrainType.Grass);
    simulation.state.worldLaws.naturalAnimalReturn = true;
    simulation.state.ecology.nextReturnTicks[EntityKind.Bear] = 0;

    for (let tick = 0; tick < 1_440; tick += 1) simulation.step();

    expect(livingKind(simulation, EntityKind.Bear)).toHaveLength(0);
    expect(simulation.state.ecology.species[EntityKind.Bear]?.status).toBe('waiting-habitat');
  });

  it('awakens eight balanced adult founders only when the civilization law is enabled', () => {
    const simulation = createWorldSimulation({
      seed: 'civilization-awakening',
      initialHumans: 72,
      mapSize: 128,
    });
    deactivateKind(simulation, EntityKind.Human);
    simulation.state.worldLaws.civilizationAwakening = false;

    for (let tick = 0; tick < 15_120; tick += 1) simulation.step();
    expect(livingKind(simulation, EntityKind.Human)).toHaveLength(0);

    simulation.state.worldLaws.civilizationAwakening = true;
    for (let tick = 0; tick < 720; tick += 1) simulation.step();

    const founders = livingKind(simulation, EntityKind.Human);
    const females = founders.filter((id) => simulation.state.entities.sex[id] === 0);
    const ages = founders.map((id) => simulation.state.entities.age[id] ?? 0);
    expect(founders).toHaveLength(8);
    expect(females).toHaveLength(4);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(18);
    expect(Math.max(...ages)).toBeLessThanOrEqual(35);
    expect(simulation.state.villages.some((village) => village.population === 8)).toBe(true);
  }, 15_000);

  it('reuses an unreferenced inactive entity slot after reaching array capacity', () => {
    const simulation = createWorldSimulation({ seed: 'entity-reuse', initialHumans: 0 });
    const { entities } = simulation.state;
    entities.count = entities.capacity;
    entities.active.fill(0);

    const spawned = simulation.spawn(EntityKind.Deer, 64, 64);

    expect(spawned).toEqual([0]);
    expect(entities.count).toBe(entities.capacity);
    expect(entities.active[0]).toBe(1);
    expect(entities.kind[0]).toBe(EntityKind.Deer);
  });

  it('does not recycle an inactive slot that is still a living resident parent', () => {
    const simulation = createWorldSimulation({ seed: 'referenced-entity-slot', initialHumans: 0 });
    const { entities } = simulation.state;
    entities.count = entities.capacity;
    entities.active.fill(0);
    const childId = entities.capacity - 1;
    entities.active[childId] = 1;
    entities.kind[childId] = EntityKind.Human;
    entities.parentAIds[childId] = 0;

    const spawned = simulation.spawn(EntityKind.Deer, 64, 64);

    expect(spawned).toEqual([1]);
    expect(entities.active[0]).toBe(0);
    expect(entities.parentAIds[childId]).toBe(0);
  });
});
