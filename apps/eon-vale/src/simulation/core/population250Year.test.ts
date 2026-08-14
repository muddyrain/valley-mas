import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createLongWorldSegmentReport, resolvePopulation250YearGateConfig } from './longWorldGate';
import { createWorldSimulation } from './worldSimulation';

const gateConfig = resolvePopulation250YearGateConfig();

describe.runIf(process.env.EON_250_YEAR_GATE === '1')('250-year generation gate', () => {
  it(
    'keeps children, reproductive adults and elders in a peaceful healthy world',
    () => {
      const simulation = createWorldSimulation({
        seed: process.env.EON_250_YEAR_SEED ?? 'peaceful-demography-250',
        initialHumans: 72,
        mapSize: 128,
      });
      simulation.state.forcedPeaceUntil = Number.MAX_SAFE_INTEGER;

      const totalTicks = 250 * 720;
      const reportIntervalTicks = gateConfig.reportIntervalYears * 720;
      let segmentStartTick = simulation.state.tick;
      let segmentStartedAt = performance.now();
      for (let tick = 0; tick < totalTicks; tick += 1) {
        simulation.step();
        const completedTicks = tick + 1;
        if (completedTicks % reportIntervalTicks !== 0 && completedTicks !== totalTicks) continue;

        let humans = 0;
        let children = 0;
        let reproductiveAdults = 0;
        let elders = 0;
        let animals = 0;
        let huntTasks = 0;
        let butcherTasks = 0;
        let fishTasks = 0;
        for (let id = 0; id < simulation.state.entities.count; id += 1) {
          if (!simulation.state.entities.active[id]) continue;
          if (simulation.state.entities.kind[id] !== EntityKind.Human) {
            animals += 1;
            continue;
          }
          humans += 1;
          const age = simulation.state.entities.age[id] ?? 0;
          if (age < 16) children += 1;
          if (age >= 18 && age <= 44) reproductiveAdults += 1;
          if (age >= 60) elders += 1;
          const taskType = simulation.state.entities.tasks[id]?.type;
          if (taskType === 'hunt') huntTasks += 1;
          else if (taskType === 'butcher') butcherTasks += 1;
          else if (taskType === 'fish') fishTasks += 1;
        }
        const report = createLongWorldSegmentReport({
          seed: simulation.state.seed,
          startTick: segmentStartTick,
          endTick: simulation.state.tick,
          elapsedMs: performance.now() - segmentStartedAt,
          humans,
          children,
          reproductiveAdults,
          elders,
          animals,
          carcasses: simulation.state.carcasses.length,
          villages: simulation.state.villages.filter((village) => village.health > 0).length,
          buildings: simulation.state.buildings.length,
          entitySlots: simulation.state.entities.count,
          pathQueue: simulation.metrics.pathQueue,
          storedFood: simulation.state.population.storedFood,
          carryingCapacity: simulation.state.population.carryingCapacity,
          births: simulation.state.population.totalBirths,
          deaths: simulation.state.population.totalDeaths,
          deathCauses: simulation.state.population.deathCauses,
          huntTasks,
          butcherTasks,
          fishTasks,
          butcheredMeat: simulation.state.ecology.butcheredMeat,
          fishCaught: simulation.state.ecology.fishCaught,
        });
        console.info(`EON_250_YEAR_SEGMENT ${JSON.stringify(report)}`);
        segmentStartTick = simulation.state.tick;
        segmentStartedAt = performance.now();
      }

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
    },
    gateConfig.timeoutMs,
  );
});
