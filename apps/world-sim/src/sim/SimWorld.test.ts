import { describe, expect, it } from 'vitest';
import { type SimCommand, SimWorld } from './index';

describe('SimWorld deterministic replay', () => {
  it('produces the same replay snapshot for the same seed and commands', () => {
    const first = runReplay();
    const second = runReplay();

    expect(second).toBe(first);
  });

  it('accepts god commands through the command queue', () => {
    const world = new SimWorld({ seed: 'commands', width: 24, height: 18, initialUnits: 0 });

    world.enqueue({
      id: 'cmd-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 10, y: 9 },
        count: 3,
      },
    });
    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 10, y: 9 },
        amount: 30,
        radius: 1,
      },
    });

    world.step();
    const projection = world.project();

    expect(projection.stats.population).toBeGreaterThanOrEqual(3);
    expect(projection.stats.totalFood).toBeGreaterThan(0);
    expect(projection.recentEvents.some((event) => event.type === 'command_accepted')).toBe(true);
  });

  it('rejects invalid god commands without mutating the world', () => {
    const world = new SimWorld({ seed: 'reject', width: 24, height: 18, initialUnits: 0 });

    world.enqueue({
      id: 'cmd-invalid-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: -1, y: 2 },
        count: 3,
      },
    });

    world.step();
    const projection = world.project();

    expect(projection.stats.population).toBe(0);
    expect(projection.recentEvents.some((event) => event.type === 'command_rejected')).toBe(true);
  });

  it('does not let fresh spawn commands reproduce in the same tick', () => {
    const world = new SimWorld({ seed: 'spawn-pacing', width: 24, height: 18, initialUnits: 0 });

    world.enqueue({
      id: 'cmd-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 12, y: 9 },
        count: 10,
      },
    });
    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 12, y: 9 },
        amount: 500,
        radius: 6,
      },
    });

    world.step();

    expect(world.project().stats.population).toBe(10);
  });
});

describe('SimWorld life loop', () => {
  it('declines when food is removed and units starve', () => {
    const world = new SimWorld({ seed: 'starve', width: 24, height: 18, initialUnits: 12 });

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    const initialPopulation = world.project().stats.population;

    for (let tick = 0; tick < 180; tick += 1) {
      world.step();
    }

    expect(world.project().stats.population).toBeLessThan(initialPopulation);
  });

  it('can grow when local food is abundant', () => {
    const world = new SimWorld({ seed: 'growth', width: 24, height: 18, initialUnits: 18 });

    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 12, y: 9 },
        amount: 200,
        radius: 4,
      },
    });

    world.step();
    const initialPopulation = world.project().stats.population;

    for (let tick = 0; tick < 1800; tick += 1) {
      world.step();
    }

    expect(world.project().stats.population).toBeGreaterThan(initialPopulation);
  });

  it('runs 1000 units in pure simulation within the foundation budget', () => {
    const world = new SimWorld({ seed: 'scale-1000', width: 128, height: 128, initialUnits: 1000 });
    const start = performance.now();

    for (let tick = 0; tick < 40; tick += 1) {
      world.step();
    }

    const elapsedMs = performance.now() - start;

    expect(world.project().stats.population).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(500);
  });
});

function runReplay() {
  const world = new SimWorld({ seed: 'replay', width: 32, height: 24, initialUnits: 8 });
  const commands: SimCommand[] = [
    {
      id: 'cmd-1',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 16, y: 12 },
        amount: 40,
        radius: 2,
      },
    },
    {
      id: 'cmd-2',
      type: 'spawn_unit',
      issuedAtTick: 2,
      payload: {
        race: 'orc',
        position: { x: 18, y: 12 },
        count: 2,
      },
    },
    {
      id: 'cmd-3',
      type: 'lightning',
      issuedAtTick: 5,
      payload: {
        position: { x: 18, y: 12 },
        radius: 2,
      },
    },
  ];

  for (let tick = 0; tick < 60; tick += 1) {
    for (const command of commands) {
      if (command.issuedAtTick === tick) {
        world.enqueue(command);
      }
    }

    world.step();
  }

  return world.serializeForReplay();
}
