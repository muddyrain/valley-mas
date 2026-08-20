import { describe, expect, it } from 'vitest';
import { domainId } from '@/simulation/kernel/ids';
import { createSimulationKernel } from '@/simulation/kernel/kernel';

describe('phase 3 navigation recovery', () => {
  it('detours around a land obstacle instead of entering an unreachable retry loop', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-navigation-detour', size: 128 });
    const world = kernel.state.world;
    const center = world.settleability.regions[0]?.centerCell ?? 0;
    const centerX = center % world.size;
    const centerZ = Math.floor(center / world.size);
    const start = centerZ * world.size + centerX;
    const target = centerZ * world.size + centerX + 4;

    for (let z = centerZ - 2; z <= centerZ + 2; z += 1) {
      for (let x = centerX; x <= centerX + 4; x += 1) {
        world.elevation[z * world.size + x] = 1;
      }
    }
    world.elevation[start + 1] = -1;
    world.revision += 1;

    kernel.enqueue({ type: 'place-humans', sequence: 1, cell: start, count: 1 });
    kernel.flushCommands();
    const human = kernel.state.civilization.life[0];
    expect(human).toBeTruthy();
    if (!human) return;

    human.energy = 0;
    human.energyStage = 'exhausted';
    human.decisionRequested = false;
    human.task = {
      id: domainId<'task'>(0),
      kind: 'rest',
      phase: 'moving-to-target',
      targetCell: target,
      targetResourceId: null,
      targetBuildingId: null,
      settlementId: null,
      resourceKind: null,
      reservationIds: [],
      expectedResult: 'body-rested',
      startedAtTick: 0,
      commitUntilTick: 0,
      workRemaining: 0,
      pathCells: [],
      pathCursor: 0,
      pathWorldRevision: null,
    };

    kernel.setPaused(false);
    kernel.runTicks(20);

    expect(human.cell).toBe(target);
    expect(human.lastTaskFailure?.code).not.toBe('target-unreachable');
  });

  it('forms one settlement for founders connected by a real land route', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-connected-founders', size: 128 });
    const world = kernel.state.world;
    const center = world.settleability.regions[0]?.centerCell ?? 0;
    const centerX = center % world.size;
    const centerZ = Math.floor(center / world.size);
    const secondCell = center + 9;

    for (let z = centerZ - 4; z <= centerZ + 4; z += 1) {
      for (let x = centerX - 4; x <= centerX + 13; x += 1) {
        world.elevation[z * world.size + x] = 1;
      }
    }
    world.revision += 1;

    kernel.enqueue({ type: 'place-humans', sequence: 1, cell: center, count: 1 });
    kernel.enqueue({ type: 'place-humans', sequence: 2, cell: secondCell, count: 1 });
    expect(kernel.flushCommands().every((record) => record.status === 'accepted')).toBe(true);
    kernel.setPaused(false);
    kernel.runTicks(80);

    expect(kernel.state.civilization.settlements).toHaveLength(1);
    expect(new Set(kernel.state.civilization.life.map((human) => human.settlementId)).size).toBe(1);
  });

  it('turns healthy no-urgent-need time into visible local activity', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-local-activity', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(25);

    const human = kernel.state.civilization.life[0];
    expect(human?.settlementId).not.toBeNull();
    if (!human) return;
    human.task = null;
    human.suspendedTask = null;
    human.retryAfterTick = 0;
    human.nutrition = 1_000;
    human.nutritionStage = 'healthy';
    human.energy = 1_000;
    human.energyStage = 'rested';
    human.decisionRequested = true;
    kernel.state.civilization.opportunities = [];
    const startingCell = human.cell;

    kernel.runTicks(4);

    expect(human.cell).not.toBe(startingCell);
    expect(human.lastTaskFailure?.code).not.toBe('target-unreachable');
  });
});
