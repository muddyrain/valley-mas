import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

const enabled = process.env.EON_LONG_SOAK === '1';
const years = Number(process.env.EON_SOAK_YEARS ?? 2_000);
const fullTickYears = Math.min(years, Number(process.env.EON_SOAK_FULL_TICK_YEARS ?? 100));
const checkpointBurstTicks = Math.min(
  180,
  Math.max(1, Number(process.env.EON_SOAK_CHECKPOINT_BURST_TICKS ?? 20)),
);
const seed = process.env.EON_SOAK_SEED ?? 'eon-soak-0';

describe.runIf(enabled)('two-thousand-year world soak', () => {
  it(
    `keeps ${seed} observable through ${years} years`,
    () => {
      const simulation = createWorldSimulation({ seed, initialHumans: 72, mapSize: 128 });
      for (let tick = 0; tick < fullTickYears * 720; tick += 1) simulation.step();
      for (let quarter = fullTickYears * 4 + 1; quarter <= years * 4; quarter += 1) {
        simulation.state.tick = quarter * 180 - checkpointBurstTicks;
        for (let tick = 0; tick < checkpointBurstTicks; tick += 1) simulation.step();
      }

      let humans = 0;
      let animals = 0;
      for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
        if (!simulation.state.entities.active[entityId]) continue;
        if (simulation.state.entities.kind[entityId] === EntityKind.Human) humans += 1;
        else animals += 1;
      }
      const result = {
        seed,
        fullTickYears,
        checkpointBurstTicks,
        year: simulation.state.year,
        humans,
        animals,
        entitySlots: simulation.state.entities.count,
        villages: simulation.state.villages.filter((village) => village.health > 0).length,
        kingdoms: simulation.state.kingdoms.filter((kingdom) => !kingdom.extinct).length,
        births: simulation.state.population.totalBirths,
        deaths: simulation.state.population.totalDeaths,
        deathCauses: simulation.state.population.deathCauses,
      };
      console.info(`EON_SOAK_RESULT ${JSON.stringify(result)}`);

      expect(simulation.state.year).toBe(years + 1);
      expect(simulation.state.entities.count).toBeLessThanOrEqual(
        simulation.state.entities.capacity,
      );
      expect(animals).toBeGreaterThan(0);
      if (humans === 0) {
        expect(simulation.state.population.totalDeaths).toBeGreaterThan(0);
        expect(
          Object.values(simulation.state.population.deathCauses).reduce((a, b) => a + b, 0),
        ).toBe(simulation.state.population.totalDeaths);
      }
    },
    Math.max(30_000, years * 3_000),
  );
});
