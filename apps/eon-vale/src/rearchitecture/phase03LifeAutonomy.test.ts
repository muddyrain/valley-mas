import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import { energyStageAt, nutritionStageAt } from '@/simulation/life/lifeFacts';
import { ElevationBand, elevationBandAt } from '@/simulation/world/worldFacts';

describe('phase 3 life and autonomy contracts', () => {
  it('places persistent adult humans only through an accepted kernel command', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-life-placement', size: 128 });
    const replay = createSimulationKernel({ seed: 'phase-3-life-placement', size: 128 });
    const centerCell = kernel.state.world.settleability.regions[0]?.centerCell;
    expect(centerCell).toBeTypeOf('number');

    kernel.enqueue({
      type: 'place-humans',
      sequence: 1,
      cell: centerCell ?? 0,
      count: 12,
    });
    replay.enqueue({
      type: 'place-humans',
      sequence: 1,
      cell: centerCell ?? 0,
      count: 12,
    });

    expect(kernel.flushCommands()).toEqual([
      { sequence: 1, type: 'place-humans', status: 'accepted' },
    ]);
    replay.flushCommands();
    expect(kernel.state.civilization.humans).toBe(12);
    expect(kernel.state.civilization.life).toHaveLength(12);
    expect(new Set(kernel.state.civilization.life.map((human) => human.id)).size).toBe(12);
    const occupiedCells = kernel.state.civilization.life.map((human) => human.cell);
    expect(occupiedCells).toEqual(replay.state.civilization.life.map((human) => human.cell));
    expect(new Set(occupiedCells).size).toBe(12);
    expect(occupiedCells).toContain(centerCell);
    expect(
      kernel.state.civilization.life.every(
        (human) =>
          human.active &&
          elevationBandAt(kernel.state.world.elevation[human.cell] ?? -4) === ElevationBand.Land &&
          human.ageYears >= 18 &&
          human.health === 1_000 &&
          human.nutrition === 1_000 &&
          human.energy === 1_000,
      ),
    ).toBe(true);
  });

  it('advances body reserves and changes survival stages with hysteresis', () => {
    expect(nutritionStageAt('healthy', 600)).toBe('hungry');
    expect(nutritionStageAt('hungry', 650)).toBe('hungry');
    expect(nutritionStageAt('hungry', 700)).toBe('healthy');
    expect(nutritionStageAt('hungry', 250)).toBe('starving');
    expect(nutritionStageAt('starving', 300)).toBe('starving');
    expect(nutritionStageAt('starving', 350)).toBe('hungry');

    expect(energyStageAt('rested', 500)).toBe('tired');
    expect(energyStageAt('tired', 600)).toBe('tired');
    expect(energyStageAt('tired', 650)).toBe('rested');
    expect(energyStageAt('tired', 150)).toBe('exhausted');
    expect(energyStageAt('exhausted', 200)).toBe('exhausted');
    expect(energyStageAt('exhausted', 250)).toBe('tired');

    const kernel = createSimulationKernel({ seed: 'phase-3-body', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(20);

    const human = kernel.state.civilization.life[0];
    expect(human?.nutrition).toBe(999);
    expect(human?.energy).toBe(998);
  });

  it('derives local perception before selecting an explainable intent', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-perception', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(1);

    const human = kernel.state.civilization.life[0];
    expect(human?.perception.observedAtTick).toBe(1);
    expect(human?.perception.nearestFoodResourceId).not.toBeNull();
    expect(human?.intent).toEqual({
      kind: 'establish-settlement',
      reason: 'unsettled-adult',
      selectedTick: 1,
    });
    expect(human?.task).toMatchObject({
      kind: 'establish-settlement',
      phase: 'working',
      targetCell: cell,
      expectedResult: 'primitive-camp',
    });
  });

  it('interrupts ordinary work at a safe checkpoint when fatigue becomes urgent', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-fatigue-interrupt', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);

    for (let tick = 0; tick < 5_200; tick += 1) {
      kernel.runTicks(1);
      const human = kernel.state.civilization.life[0];
      if (human?.energyStage !== 'tired') continue;
      for (let settle = 0; settle < 120 && human.task?.kind !== 'rest'; settle += 1) {
        kernel.runTicks(1);
      }
      expect(human.intent).toMatchObject({ kind: 'rest', reason: 'energy-critical' });
      expect(human.task).toMatchObject({ kind: 'rest' });
      expect(
        kernel.state.civilization.reservations.active.some(
          (reservation) => reservation.holderLifeId === human.id,
        ),
      ).toBe(false);
      return;
    }
    throw new Error('resident never crossed the tired threshold');
  });

  it('survives hunger by reserving and consuming physically stored food', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-eating', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(8_300);

    const human = kernel.state.civilization.life[0];
    const inventory = kernel.state.civilization.settlementInventories[0];
    expect(human?.active).toBe(true);
    expect(human?.nutrition).toBeGreaterThan(600);
    expect(human?.nutritionStage).toBe('healthy');
    expect(inventory?.food).toBeGreaterThanOrEqual(0);
    expect(human?.lastMealAtTick).toBeGreaterThanOrEqual(8_000);
  });

  it('exposes reserved food as a carried fact before consumption', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-meal-carry', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(25);

    const human = kernel.state.civilization.life[0];
    const inventory = kernel.state.civilization.settlementInventories[0];
    const storage = kernel.state.civilization.buildings.find(
      (building) => building.kind === 'basic-storage',
    );
    expect(human && inventory && storage).toBeTruthy();
    if (!human || !inventory || !storage) return;

    kernel.state.civilization.reservations.active = [];
    human.task = null;
    human.cell = storage.cell;
    human.nutrition = 500;
    human.nutritionStage = 'hungry';
    human.decisionRequested = true;
    inventory.food = 1;

    kernel.runTicks(1);
    expect(inventory.food).toBe(0);
    expect(human.task).toMatchObject({ kind: 'eat', phase: 'carrying' });
    expect(human.carried).toEqual({ kind: 'food', amount: 1 });
    expect(human.lastMealAtTick).toBe(-1);

    kernel.runTicks(2);
    expect(human.task).toBeNull();
    expect(human.carried).toEqual({ kind: null, amount: 0 });
    expect(human.nutrition).toBe(900);
    expect(human.lastMealAtTick).toBe(kernel.state.tick);
  });
});
