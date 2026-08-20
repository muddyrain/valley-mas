import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import { deriveSettlementCapabilities } from '@/simulation/settlements/construction';
import { ElevationBand, elevationBandAt } from '@/simulation/world/worldFacts';

describe('phase 3 settlement and logistics contracts', () => {
  it('lets one resident establish a primitive camp through real work', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-founder', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(25);

    const settlement = kernel.state.civilization.settlements[0];
    const founder = kernel.state.civilization.life[0];
    expect(settlement).toMatchObject({
      founderLifeId: founder?.id,
      centerCell: cell,
      residentIds: [founder?.id],
    });
    expect(founder?.settlementId).toBe(settlement?.id);

    const primitiveFacilities = kernel.state.civilization.buildings.filter(
      (building) => building.settlementId === settlement?.id,
    );
    expect(primitiveFacilities.map((building) => building.kind).sort()).toEqual([
      'basic-storage',
      'campfire',
      'tent',
    ]);
    expect(new Set(primitiveFacilities.map((building) => building.cell)).size).toBe(3);
    expect(
      primitiveFacilities.every(
        (building) =>
          building.completed &&
          elevationBandAt(kernel.state.world.elevation[building.cell] ?? -4) === ElevationBand.Land,
      ),
    ).toBe(true);
  });

  it('forms one settlement from a deterministic batch instead of duplicating villages', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-batch-founder', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(40);

    expect(kernel.state.civilization.settlements).toHaveLength(1);
    expect(kernel.state.civilization.settlements[0]?.residentIds).toHaveLength(12);
    expect(
      kernel.state.civilization.life.every(
        (human) => human.settlementId === kernel.state.civilization.settlements[0]?.id,
      ),
    ).toBe(true);
  });

  it('moves harvested food through carrying before it enters settlement inventory', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-food-logistics', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    const initialWildFood = Array.from(kernel.state.resources.amount).reduce(
      (total, amount, id) =>
        total +
        (kernel.state.resources.active[id] && kernel.state.resources.kind[id] === 1 ? amount : 0),
      0,
    );
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);

    let carryingObserved = false;
    for (let tick = 0; tick < 240; tick += 1) {
      kernel.runTicks(1);
      const human = kernel.state.civilization.life[0];
      if (human?.task?.phase !== 'moving-to-delivery') continue;
      carryingObserved = true;
      expect(human.carried).toEqual({ kind: 'food', amount: 1 });
      expect(kernel.state.civilization.settlementInventories[0]?.food).toBe(0);
      break;
    }
    expect(carryingObserved).toBe(true);

    for (let tick = 0; tick < 120; tick += 1) {
      if ((kernel.state.civilization.settlementInventories[0]?.food ?? 0) > 0) break;
      kernel.runTicks(1);
    }
    const human = kernel.state.civilization.life[0];
    const inventoryFood = kernel.state.civilization.settlementInventories[0]?.food ?? 0;
    const remainingWildFood = Array.from(kernel.state.resources.amount).reduce(
      (total, amount, id) =>
        total +
        (kernel.state.resources.active[id] && kernel.state.resources.kind[id] === 1 ? amount : 0),
      0,
    );
    expect(inventoryFood).toBe(1);
    expect(human?.carried).toEqual({ kind: null, amount: 0 });
    expect(initialWildFood - remainingWildFood).toBe(inventoryFood);
  });

  it('forms reciprocal families from real adult partners', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-families', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(120);

    expect(kernel.state.civilization.families).toHaveLength(6);
    for (const family of kernel.state.civilization.families) {
      const first = kernel.state.civilization.life.find(
        (human) => human.id === family.partnerIds[0],
      );
      const second = kernel.state.civilization.life.find(
        (human) => human.id === family.partnerIds[1],
      );
      expect(first?.partnerId).toBe(second?.id);
      expect(second?.partnerId).toBe(first?.id);
      expect(first?.familyId).toBe(family.id);
      expect(second?.familyId).toBe(family.id);
    }
  });

  it('builds housing only after inventory materials are hauled to a real site', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-construction', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);

    let observedDeliveredMaterial = false;
    for (let tick = 0; tick < 2_000; tick += 1) {
      kernel.runTicks(1);
      const house = kernel.state.civilization.buildings.find(
        (building) => building.kind === 'house',
      );
      if (!house) continue;
      if ((house.delivered.wood ?? 0) > 0 || (house.delivered.stone ?? 0) > 0) {
        observedDeliveredMaterial = true;
      }
      if (!house.completed) continue;
      expect(observedDeliveredMaterial).toBe(true);
      expect(house.delivered).toEqual(house.required);
      expect(house.progress).toBe(house.requiredProgress);
      expect(
        kernel.state.civilization.settlementInventories.every(
          (inventory) =>
            inventory.food >= 0 &&
            inventory.wood >= 0 &&
            inventory.stone >= 0 &&
            inventory.metal >= 0,
        ),
      ).toBe(true);
      return;
    }
    throw new Error('house construction did not complete within the scenario budget');
  });

  it('creates children only from real partners when food and housing permit', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-births', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(4_000);

    const children = kernel.state.civilization.life.filter((human) => human.ageYears === 0);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      const family = kernel.state.civilization.families.find(
        (candidate) => candidate.id === child.familyId,
      );
      expect(family).toBeDefined();
      expect(child.parentIds).toEqual(family?.partnerIds);
      expect(family?.childIds).toContain(child.id);
      expect(child.settlementId).toBe(family?.settlementId);
    }
  });

  it('constructs every stage 3 facility and derives capabilities only from completed facts', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-facilities', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(6_000);

    const settlement = kernel.state.civilization.settlements[0];
    const completedKinds = new Set(
      kernel.state.civilization.buildings
        .filter((building) => building.settlementId === settlement?.id && building.completed)
        .map((building) => building.kind),
    );
    expect(completedKinds).toEqual(
      new Set([
        'campfire',
        'tent',
        'basic-storage',
        'house',
        'farm',
        'logging-site',
        'mine',
        'workshop',
        'barracks',
        'village-center',
      ]),
    );
    expect(
      deriveSettlementCapabilities(kernel.state.civilization.buildings, settlement?.id ?? 0),
    ).toMatchObject({
      storageCapacity: 80,
      farmingSlots: 2,
      loggingSlots: 2,
      miningSlots: 2,
      craftingSlots: 2,
      trainingSlots: 4,
      hasCivicCenter: true,
    });
  });
});
