import { describe, expect, it } from 'vitest';
import { AgentState, EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe('animal behaviour', () => {
  it('starts all six terrestrial species and makes prey flee nearby predators', () => {
    const simulation = createWorldSimulation({ seed: 'wildlife', initialHumans: 0 });
    const kinds = Array.from(
      simulation.state.entities.kind.slice(0, simulation.state.entities.count),
    );
    expect(new Set(kinds)).toEqual(
      new Set([
        EntityKind.Chicken,
        EntityKind.Sheep,
        EntityKind.Cow,
        EntityKind.Deer,
        EntityKind.Wolf,
        EntityKind.Bear,
      ]),
    );

    const sheepId = simulation.spawn(EntityKind.Sheep, 64, 64)[0] as number;
    const wolfId = simulation.spawn(EntityKind.Wolf, 64, 64)[0] as number;
    simulation.state.entities.positionsX[wolfId] =
      simulation.state.entities.positionsX[sheepId] + 1;
    simulation.state.entities.positionsZ[wolfId] =
      simulation.state.entities.positionsZ[sheepId] + 1;
    const sheepBefore = [
      simulation.state.entities.positionsX[sheepId],
      simulation.state.entities.positionsZ[sheepId],
    ];

    for (let tick = 0; tick < 30; tick += 1) simulation.step();

    expect(simulation.state.entities.states[sheepId]).toBe(AgentState.Flee);
    expect([
      simulation.state.entities.positionsX[sheepId],
      simulation.state.entities.positionsZ[sheepId],
    ]).not.toEqual(sheepBefore);
  });

  it('keeps a blank-ocean world empty until the player creates land and life', () => {
    const simulation = createWorldSimulation({
      seed: 'blank-ocean',
      initialHumans: 72,
      preset: 'ocean',
    });

    expect(simulation.state.entities.count).toBe(0);
  });
});
