import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe('world law transitions', () => {
  it('changes future behavior and records each real player transition', () => {
    const simulation = createWorldSimulation({ seed: 'world-law-transition', initialHumans: 24 });

    simulation.setWorldLaw('naturalAnimalReturn', false);

    expect(simulation.state.worldLaws.naturalAnimalReturn).toBe(false);
    expect(simulation.state.events.at(-1)).toMatchObject({
      kind: 'law',
      message: '世界法则“动物自然回归”已关闭',
    });
    const eventCount = simulation.state.events.length;

    simulation.setWorldLaw('naturalAnimalReturn', false);
    expect(simulation.state.events).toHaveLength(eventCount);
  });

  it('stops new human starvation damage while hunger is disabled', () => {
    const simulation = createWorldSimulation({ seed: 'disabled-human-hunger', initialHumans: 0 });
    const resident = simulation.spawn(EntityKind.Human, 64, 64)[0] as number;
    const village = simulation.ensureVillageAt(
      simulation.state.entities.positionsX[resident] ?? 64,
      simulation.state.entities.positionsZ[resident] ?? 64,
      1,
    );
    simulation.state.entities.villageIds[resident] = village.id;
    simulation.state.entities.hunger[resident] = 1_000;
    simulation.state.entities.malnutrition[resident] = 120;
    simulation.state.entities.health[resident] = 100;
    village.resources.food = 0;
    village.shortageTicks = 1_800;
    simulation.setWorldLaw('hunger', false);

    for (let tick = 0; tick < 20; tick += 1) simulation.step();

    expect(simulation.state.entities.health[resident]).toBe(100);
    expect(simulation.state.entities.malnutrition[resident]).toBe(120);

    simulation.setWorldLaw('hunger', true);
    for (let tick = 0; tick < 20; tick += 1) simulation.step();
    expect(simulation.state.entities.health[resident]).toBeLessThan(100);
  });
});
