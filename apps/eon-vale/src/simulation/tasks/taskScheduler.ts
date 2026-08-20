import { domainId } from '../kernel/ids';
import type { KernelWorldRoot } from '../kernel/worldRoot';
import { planLandPath } from '../navigation/worldLandPath';
import { NaturalResourceKind } from '../resources/naturalResources';
import { ElevationBand, elevationBandAt } from '../world/worldFacts';
import { claimReservation, releaseReservation } from './reservations';

function naturalKindFor(resourceKind: 'food' | 'wood' | 'stone' | 'metal'): NaturalResourceKind {
  if (resourceKind === 'food') return NaturalResourceKind.WildFood;
  if (resourceKind === 'wood') return NaturalResourceKind.Tree;
  if (resourceKind === 'stone') return NaturalResourceKind.Stone;
  return NaturalResourceKind.Metal;
}

function distanceSquared(size: number, leftCell: number, rightCell: number): number {
  const leftX = leftCell % size;
  const leftZ = Math.floor(leftCell / size);
  const rightX = rightCell % size;
  const rightZ = Math.floor(rightCell / size);
  return (leftX - rightX) ** 2 + (leftZ - rightZ) ** 2;
}

function localActivityTarget(state: KernelWorldRoot, humanCell: number, lifeId: number): number {
  const size = state.world.size;
  const x = humanCell % size;
  const z = Math.floor(humanCell / size);
  const candidates = [
    z > 0 ? humanCell - size : -1,
    x > 0 ? humanCell - 1 : -1,
    x + 1 < size ? humanCell + 1 : -1,
    z + 1 < size ? humanCell + size : -1,
  ];
  const start = (lifeId + Math.floor(state.tick / 8)) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const cell = candidates[(start + offset) % candidates.length] ?? -1;
    if (cell >= 0 && elevationBandAt(state.world.elevation[cell] ?? -4) === ElevationBand.Land) {
      return cell;
    }
  }
  return humanCell;
}

export function scheduleLifeTasks(state: KernelWorldRoot, tick: number): void {
  const population = state.civilization;
  for (const human of population.life) {
    const urgentIntent = human.intent.kind === 'rest' || human.intent.kind === 'find-food';
    const taskMatchesUrgency =
      (human.intent.kind === 'rest' && human.task?.kind === 'rest') ||
      (human.intent.kind === 'find-food' &&
        (human.task?.kind === 'eat' || human.task?.kind === 'forage-food'));
    if (
      human.task &&
      urgentIntent &&
      !taskMatchesUrgency &&
      human.task.phase !== 'moving-to-delivery' &&
      human.task.phase !== 'carrying'
    ) {
      for (const reservationId of human.task.reservationIds) {
        releaseReservation(population.reservations, reservationId);
      }
      human.suspendedTask = { ...human.task, reservationIds: [] };
      human.task = null;
      human.workRole = 'none';
    }
    if (!human.active || human.task) continue;
    if (
      human.retryAfterTick > tick &&
      !(
        human.intent.kind === 'idle' &&
        human.nutritionStage === 'healthy' &&
        human.energyStage === 'rested'
      )
    )
      continue;
    if (human.intent.kind === 'establish-settlement') {
      human.task = {
        id: domainId<'task'>(population.nextTaskId),
        kind: 'establish-settlement',
        phase: 'working',
        targetCell: human.cell,
        targetResourceId: null,
        targetBuildingId: null,
        settlementId: null,
        resourceKind: null,
        reservationIds: [],
        expectedResult: 'primitive-camp',
        startedAtTick: tick,
        commitUntilTick: tick + 10,
        workRemaining: 20,
        pathCells: [],
        pathCursor: 0,
        pathWorldRevision: null,
      };
      population.nextTaskId += 1;
      continue;
    }
    if (human.intent.kind === 'rest') {
      const restingPlace = population.buildings.find(
        (building) =>
          building.settlementId === human.settlementId &&
          (building.kind === 'tent' || building.kind === 'house') &&
          building.completed,
      );
      const targetCell = restingPlace?.cell ?? human.cell;
      human.task = {
        id: domainId<'task'>(population.nextTaskId),
        kind: 'rest',
        phase: human.cell === targetCell ? 'resting' : 'moving-to-target',
        targetCell,
        targetResourceId: null,
        targetBuildingId: null,
        settlementId:
          human.settlementId === null ? null : domainId<'settlement'>(human.settlementId),
        resourceKind: null,
        reservationIds: [],
        expectedResult: 'body-rested',
        startedAtTick: tick,
        commitUntilTick: tick,
        workRemaining: 0,
        pathCells: [],
        pathCursor: 0,
        pathWorldRevision: null,
      };
      population.nextTaskId += 1;
      human.workRole = 'none';
      continue;
    }
    if (human.intent.kind === 'find-food') {
      const inventory = population.settlementInventories.find(
        (candidate) => candidate.settlementId === human.settlementId,
      );
      const storage = population.buildings.find(
        (building) =>
          building.settlementId === human.settlementId &&
          building.kind === 'basic-storage' &&
          building.completed,
      );
      if (inventory && storage && inventory.food > 0) {
        const result = claimReservation(population.reservations, {
          holderLifeId: human.id,
          target: {
            kind: 'settlement-inventory',
            settlementId: inventory.settlementId,
            resourceKind: 'food',
          },
          quantity: 1,
          availableQuantity: inventory.food,
          tick,
          expiresAtTick: tick + 120,
        });
        if (result.status === 'granted') {
          human.task = {
            id: domainId<'task'>(population.nextTaskId),
            kind: 'eat',
            phase: human.cell === storage.cell ? 'working' : 'moving-to-target',
            targetCell: storage.cell,
            targetResourceId: null,
            targetBuildingId: null,
            settlementId: inventory.settlementId,
            resourceKind: 'food',
            reservationIds: [result.reservation.id],
            expectedResult: 'food-consumed',
            startedAtTick: tick,
            commitUntilTick: tick,
            workRemaining: 0,
            pathCells: [],
            pathCursor: 0,
            pathWorldRevision: null,
          };
          population.nextTaskId += 1;
          human.workRole = 'none';
          continue;
        }
      }
      const candidates = Array.from(
        { length: state.resources.count },
        (_, resourceId) => resourceId,
      )
        .filter(
          (resourceId) =>
            state.resources.active[resourceId] &&
            state.resources.kind[resourceId] === NaturalResourceKind.WildFood &&
            (state.resources.amount[resourceId] ?? 0) > 0,
        )
        .sort(
          (left, right) =>
            distanceSquared(
              state.world.size,
              human.cell,
              state.resources.cell[left] ?? human.cell,
            ) -
              distanceSquared(
                state.world.size,
                human.cell,
                state.resources.cell[right] ?? human.cell,
              ) || left - right,
        );
      for (const resourceId of candidates) {
        const targetCell = state.resources.cell[resourceId] ?? human.cell;
        const pathCells = planLandPath(state.world, human.cell, targetCell);
        if (pathCells.length === 0) continue;
        const result = claimReservation(population.reservations, {
          holderLifeId: human.id,
          target: { kind: 'natural-resource', resourceId: domainId<'resource'>(resourceId) },
          quantity: 1,
          tick,
          expiresAtTick: tick + 240,
        });
        if (result.status !== 'granted') continue;
        human.task = {
          id: domainId<'task'>(population.nextTaskId),
          kind: 'forage-food',
          phase: 'moving-to-target',
          targetCell,
          targetResourceId: domainId<'resource'>(resourceId),
          targetBuildingId: null,
          settlementId:
            human.settlementId === null ? null : domainId<'settlement'>(human.settlementId),
          resourceKind: 'food',
          reservationIds: [result.reservation.id],
          expectedResult: 'food-consumed',
          startedAtTick: tick,
          commitUntilTick: tick + 5,
          workRemaining: 10,
          pathCells,
          pathCursor: 1,
          pathWorldRevision: state.world.revision,
        };
        population.nextTaskId += 1;
        human.workRole = 'forager';
        break;
      }
      if (!human.task) {
        human.lastTaskFailure = {
          code: 'resource-unavailable',
          atTick: tick,
          retryAfterTick: tick + 40,
          targetCell: null,
        };
        human.retryAfterTick = tick + 40;
      }
      continue;
    }
    if (human.intent.kind === 'idle') {
      const targetCell = localActivityTarget(state, human.cell, human.id);
      human.task = {
        id: domainId<'task'>(population.nextTaskId),
        kind: 'idle-wander',
        phase: targetCell === human.cell ? 'working' : 'moving-to-target',
        targetCell,
        targetResourceId: null,
        targetBuildingId: null,
        settlementId:
          human.settlementId === null ? null : domainId<'settlement'>(human.settlementId),
        resourceKind: null,
        reservationIds: [],
        expectedResult: 'local-activity-completed',
        startedAtTick: tick,
        commitUntilTick: tick,
        workRemaining: 0,
        pathCells: targetCell === human.cell ? [human.cell] : [human.cell, targetCell],
        pathCursor: 1,
        pathWorldRevision: state.world.revision,
      };
      population.nextTaskId += 1;
      human.workRole = 'none';
      continue;
    }
    if (human.intent.kind !== 'settlement-work' || human.intent.opportunityId === undefined)
      continue;
    const opportunity = population.opportunities.find(
      (candidate) => candidate.id === human.intent.opportunityId,
    );
    if (!opportunity || human.settlementId !== opportunity.settlementId) continue;
    if (opportunity.kind === 'haul-construction') {
      const inventory = population.settlementInventories.find(
        (candidate) => candidate.settlementId === opportunity.settlementId,
      );
      const storage = population.buildings.find(
        (building) =>
          building.settlementId === opportunity.settlementId &&
          building.kind === 'basic-storage' &&
          building.completed,
      );
      const building = population.buildings.find(
        (candidate) => candidate.id === opportunity.buildingId && !candidate.completed,
      );
      if (!inventory || !storage || !building || inventory[opportunity.resourceKind] < 1) continue;
      const result = claimReservation(population.reservations, {
        holderLifeId: human.id,
        target: {
          kind: 'settlement-inventory',
          settlementId: inventory.settlementId,
          resourceKind: opportunity.resourceKind,
        },
        quantity: 1,
        availableQuantity: inventory[opportunity.resourceKind],
        tick,
        expiresAtTick: tick + 160,
      });
      if (result.status !== 'granted') continue;
      human.task = {
        id: domainId<'task'>(population.nextTaskId),
        kind: 'deliver-resource',
        phase: human.cell === storage.cell ? 'carrying' : 'moving-to-target',
        targetCell: storage.cell,
        targetResourceId: null,
        targetBuildingId: building.id,
        settlementId: opportunity.settlementId,
        resourceKind: opportunity.resourceKind,
        reservationIds: [result.reservation.id],
        expectedResult: 'resource-delivered',
        startedAtTick: tick,
        commitUntilTick: tick,
        workRemaining: 0,
        pathCells: [],
        pathCursor: 0,
        pathWorldRevision: null,
      };
      population.nextTaskId += 1;
      human.workRole = 'hauler';
      continue;
    }
    if (opportunity.kind === 'build') {
      const building = population.buildings.find(
        (candidate) => candidate.id === opportunity.buildingId && !candidate.completed,
      );
      if (!building) continue;
      const result = claimReservation(population.reservations, {
        holderLifeId: human.id,
        target: { kind: 'construction-site', buildingId: building.id },
        quantity: 1,
        tick,
        expiresAtTick: tick + building.requiredProgress + 160,
      });
      if (result.status !== 'granted') continue;
      human.task = {
        id: domainId<'task'>(population.nextTaskId),
        kind: 'build',
        phase: human.cell === building.cell ? 'working' : 'moving-to-target',
        targetCell: building.cell,
        targetResourceId: null,
        targetBuildingId: building.id,
        settlementId: opportunity.settlementId,
        resourceKind: null,
        reservationIds: [result.reservation.id],
        expectedResult: 'building-completed',
        startedAtTick: tick,
        commitUntilTick: tick + 5,
        workRemaining: building.requiredProgress - building.progress,
        pathCells: [],
        pathCursor: 0,
        pathWorldRevision: null,
      };
      population.nextTaskId += 1;
      human.workRole = 'builder';
      continue;
    }
    const candidates = Array.from({ length: state.resources.count }, (_, resourceId) => resourceId)
      .filter(
        (resourceId) =>
          state.resources.active[resourceId] &&
          state.resources.kind[resourceId] === naturalKindFor(opportunity.resourceKind) &&
          (state.resources.amount[resourceId] ?? 0) > 0,
      )
      .sort(
        (left, right) =>
          distanceSquared(state.world.size, human.cell, state.resources.cell[left] ?? human.cell) -
            distanceSquared(
              state.world.size,
              human.cell,
              state.resources.cell[right] ?? human.cell,
            ) || left - right,
      );
    let reservationId = null;
    let targetResourceId = null;
    let targetPathCells: number[] = [];
    for (const resourceId of candidates) {
      const pathCells = planLandPath(
        state.world,
        human.cell,
        state.resources.cell[resourceId] ?? human.cell,
      );
      if (pathCells.length === 0) continue;
      const result = claimReservation(population.reservations, {
        holderLifeId: human.id,
        target: { kind: 'natural-resource', resourceId: domainId<'resource'>(resourceId) },
        quantity: 1,
        tick,
        expiresAtTick: tick + 240,
      });
      if (result.status !== 'granted') continue;
      reservationId = result.reservation.id;
      targetResourceId = domainId<'resource'>(resourceId);
      targetPathCells = pathCells;
      break;
    }
    if (reservationId === null || targetResourceId === null) {
      human.lastTaskFailure = {
        code: 'resource-unavailable',
        atTick: tick,
        retryAfterTick: tick + 40,
        targetCell: null,
      };
      human.retryAfterTick = tick + 40;
      human.intent = { kind: 'idle', reason: 'no-urgent-need', selectedTick: tick };
      continue;
    }
    human.task = {
      id: domainId<'task'>(population.nextTaskId),
      kind: 'gather-resource',
      phase: 'moving-to-target',
      targetCell: state.resources.cell[targetResourceId] ?? human.cell,
      targetResourceId,
      targetBuildingId: null,
      settlementId: opportunity.settlementId,
      resourceKind: opportunity.resourceKind,
      reservationIds: [reservationId],
      expectedResult: 'resource-delivered',
      startedAtTick: tick,
      commitUntilTick: tick + 5,
      workRemaining: 10,
      pathCells: targetPathCells,
      pathCursor: 1,
      pathWorldRevision: state.world.revision,
    };
    population.nextTaskId += 1;
    human.workRole =
      opportunity.resourceKind === 'food'
        ? 'forager'
        : opportunity.resourceKind === 'wood'
          ? 'woodcutter'
          : 'miner';
  }
}
