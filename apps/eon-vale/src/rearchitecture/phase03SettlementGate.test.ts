import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import { NaturalResourceKind } from '@/simulation/resources/naturalResources';

function reservationKey(target: {
  kind: string;
  resourceId?: number;
  buildingId?: number;
  settlementId?: number;
  resourceKind?: string;
}): string {
  if (target.kind === 'natural-resource') return `resource:${target.resourceId}`;
  if (target.kind === 'construction-site') return `building:${target.buildingId}`;
  return `inventory:${target.settlementId}:${target.resourceKind}`;
}

describe('phase 3 settlement exit gate', () => {
  it.each([
    ['gate-twelve', 12],
    ['gate-twenty-four', 24],
    ['gate-forty', 40],
  ] as const)('keeps seed %s with %i residents autonomous and consistent', (seed, count) => {
    const kernel = createSimulationKernel({ seed, size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(6_000);

    expect(kernel.state.diagnostics.invariantErrors).toEqual([]);
    expect(kernel.state.civilization.settlements).toHaveLength(1);
    expect(kernel.state.civilization.humans).toBeGreaterThanOrEqual(count);
    expect(
      kernel.state.civilization.settlementInventories.every(
        (inventory) =>
          inventory.food >= 0 &&
          inventory.wood >= 0 &&
          inventory.stone >= 0 &&
          inventory.metal >= 0,
      ),
    ).toBe(true);

    const exclusiveTargets = kernel.state.civilization.reservations.active
      .filter((reservation) => reservation.target.kind !== 'settlement-inventory')
      .map((reservation) => reservationKey(reservation.target));
    expect(new Set(exclusiveTargets).size).toBe(exclusiveTargets.length);

    for (const inventory of kernel.state.civilization.settlementInventories) {
      for (const resourceKind of ['food', 'wood', 'stone', 'metal'] as const) {
        const reserved = kernel.state.civilization.reservations.active.reduce(
          (total, reservation) =>
            total +
            (reservation.target.kind === 'settlement-inventory' &&
            reservation.target.settlementId === inventory.settlementId &&
            reservation.target.resourceKind === resourceKind
              ? reservation.quantity
              : 0),
          0,
        );
        expect(reserved).toBeLessThanOrEqual(inventory[resourceKind]);
      }
    }

    expect(
      kernel.state.civilization.life.every(
        (human) =>
          !human.active ||
          human.task !== null ||
          human.intent.reason === 'no-urgent-need' ||
          human.retryAfterTick >= kernel.state.tick,
      ),
    ).toBe(true);

    const startingCells = new Map(
      kernel.state.civilization.life
        .filter((human) => human.active)
        .map((human) => [human.id, human.cell] as const),
    );
    const residentsWithObservedMovement = new Set<number>();
    for (let tick = 0; tick < 200; tick += 1) {
      kernel.runTicks(1);
      for (const human of kernel.state.civilization.life) {
        if (human.active && human.cell !== startingCells.get(human.id)) {
          residentsWithObservedMovement.add(human.id);
        }
      }
    }
    expect(residentsWithObservedMovement.size).toBeGreaterThanOrEqual(
      Math.ceil(startingCells.size * 0.8),
    );
  });

  it('keeps populated authority identical at 1x and 8x playback', () => {
    const normal = createSimulationKernel({ seed: 'gate-populated-rate', size: 128 });
    const accelerated = createSimulationKernel({ seed: 'gate-populated-rate', size: 128 });
    const cell = normal.state.world.settleability.regions[0]?.centerCell ?? 0;
    normal.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    accelerated.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    normal.flushCommands();
    accelerated.flushCommands();
    normal.setPlaybackRate(1);
    accelerated.setPlaybackRate(8);
    normal.setPaused(false);
    accelerated.setPaused(false);

    normal.runTicks(2_000);
    accelerated.runTicks(2_000);

    expect(normal.state.diagnostics.invariantErrors).toEqual([]);
    expect(accelerated.state.diagnostics.invariantErrors).toEqual([]);
    expect(normal.checksum()).toBe(accelerated.checksum());
  });

  it('releases a vanished resource reservation, explains the failure and replans', () => {
    const kernel = createSimulationKernel({ seed: 'gate-failure-recovery', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);

    let affectedLifeId: number | null = null;
    let targetCell: number | null = null;
    for (let tick = 0; tick < 800; tick += 1) {
      kernel.runTicks(1);
      const human = kernel.state.civilization.life.find(
        (candidate) =>
          candidate.task?.kind === 'gather-resource' &&
          candidate.task.targetResourceId !== null &&
          kernel.state.resources.kind[candidate.task.targetResourceId] ===
            NaturalResourceKind.WildFood,
      );
      if (!human?.task) continue;
      affectedLifeId = human.id;
      targetCell = human.task.targetCell;
      break;
    }
    expect(affectedLifeId).not.toBeNull();
    expect(targetCell).not.toBeNull();
    if (affectedLifeId === null || targetCell === null) return;

    kernel.enqueue({
      type: 'lower-terrain',
      sequence: kernel.state.commands.lastSequence + 1,
      cell: targetCell,
      amount: 100,
    });
    kernel.flushCommands();
    kernel.runTicks(1);

    const affected = kernel.state.civilization.life.find((human) => human.id === affectedLifeId);
    expect(affected?.lastTaskFailure?.code).toBe('target-disappeared');
    expect(
      kernel.state.civilization.reservations.active.some(
        (reservation) => reservation.holderLifeId === affectedLifeId,
      ),
    ).toBe(false);

    kernel.runTicks(120);
    expect(affected?.task ?? affected?.intent).toBeTruthy();
    expect(affected?.retryAfterTick).toBeLessThanOrEqual(kernel.state.tick);
  });
});
