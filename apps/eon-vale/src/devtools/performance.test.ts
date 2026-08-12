import { describe, expect, it } from 'vitest';
import { createPrototypeSimulation } from '@/simulation/core/prototypeSimulation';

describe.each([100, 500, 1_000])('prototype simulation with %i residents', (population) => {
  it('advances fixed ticks with every resident still simulated', () => {
    const simulation = createPrototypeSimulation({ population, seed: `stress-${population}` });
    const startedAt = performance.now();
    for (let tick = 0; tick < 300; tick += 1) simulation.step();
    const elapsed = performance.now() - startedAt;

    console.info(
      JSON.stringify({
        population,
        elapsedMs: Number(elapsed.toFixed(2)),
        averageTickMs: Number(simulation.metrics.averageTickMs.toFixed(3)),
        completedPaths: simulation.metrics.completedPaths,
        remainingPathQueue: simulation.metrics.pathQueue,
      }),
    );

    expect(simulation.activePopulation).toBe(population);
    expect(simulation.tick).toBe(300);
    expect(simulation.metrics.completedPaths).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10_000);
  });
});
