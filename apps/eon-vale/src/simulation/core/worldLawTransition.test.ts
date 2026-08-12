import { describe, expect, it } from 'vitest';
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
});
