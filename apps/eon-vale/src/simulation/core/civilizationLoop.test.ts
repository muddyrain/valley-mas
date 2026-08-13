import { describe, expect, it } from 'vitest';
import { VillageTier } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe('civilization gameplay loop', () => {
  it('grows camps into competing kingdoms without player scripting', () => {
    const simulation = createWorldSimulation({ seed: 'civilization-loop', initialHumans: 72 });
    for (let tick = 0; tick < 5_000; tick += 1) simulation.step();

    expect(simulation.state.villages.length).toBeGreaterThanOrEqual(2);
    expect(simulation.state.villages.some((village) => village.tier >= VillageTier.Hamlet)).toBe(
      true,
    );
    expect(simulation.state.kingdoms.length).toBeGreaterThanOrEqual(2);
    expect(simulation.state.wars.length + simulation.state.truces.length).toBeGreaterThan(0);
  });
});
