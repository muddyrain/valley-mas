import type { KernelWorldRoot } from '../kernel/worldRoot';
import type { HumanLifeFact } from '../life/lifeFacts';
import { energyStageAt, nutritionStageAt } from '../life/lifeFacts';
import { planLandPath } from '../navigation/worldLandPath';
import {
  establishPrimitiveSettlement,
  findReachableSettlement,
  joinSettlement,
} from '../settlements/settlementFacts';
import { ElevationBand, elevationBandAt } from '../world/worldFacts';
import { releaseReservation } from './reservations';
import type { HumanTaskFailureCode } from './taskFacts';

function moveToward(state: KernelWorldRoot, human: HumanLifeFact, targetCell: number): boolean {
  if (human.cell === targetCell) return true;
  const task = human.task;
  if (!task) return false;
  const pathMatchesCurrentPosition =
    task.pathCursor > 0 && task.pathCells[task.pathCursor - 1] === human.cell;
  const pathIsCurrent =
    task.pathWorldRevision === state.world.revision &&
    task.pathCells.at(-1) === targetCell &&
    pathMatchesCurrentPosition;
  if (!pathIsCurrent) {
    task.pathCells = planLandPath(state.world, human.cell, targetCell);
    task.pathCursor = 1;
    task.pathWorldRevision = state.world.revision;
  }
  const next = task.pathCells[task.pathCursor];
  if (
    next === undefined ||
    elevationBandAt(state.world.elevation[next] ?? -4) !== ElevationBand.Land
  )
    return false;
  human.cell = next;
  task.pathCursor += 1;
  return true;
}

function failTask(state: KernelWorldRoot, human: HumanLifeFact, code: HumanTaskFailureCode): void {
  const task = human.task;
  if (!task) return;
  for (const reservationId of task.reservationIds) {
    releaseReservation(state.civilization.reservations, reservationId);
  }
  if (human.carried.kind && human.carried.amount > 0) {
    state.civilization.looseResources.push({
      id: state.civilization.nextLooseResourceId,
      kind: human.carried.kind,
      amount: human.carried.amount,
      cell: human.cell,
      source: 'dropped',
    });
    state.civilization.nextLooseResourceId += 1;
    human.carried = { kind: null, amount: 0 };
  }
  human.lastTaskFailure = {
    code,
    atTick: state.tick,
    retryAfterTick: state.tick + 40,
    targetCell: task.targetCell,
  };
  human.retryAfterTick = state.tick + 40;
  human.task = null;
  human.decisionRequested = true;
}

function advanceGatherTask(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (
    !task ||
    (task.kind !== 'gather-resource' && task.kind !== 'forage-food') ||
    task.targetResourceId === null
  )
    return;
  if (task.phase === 'consuming') {
    if (human.carried.kind !== 'food' || human.carried.amount < 1) {
      failTask(state, human, 'resource-unavailable');
      return;
    }
    human.carried = { kind: null, amount: 0 };
    human.nutrition = Math.min(1_000, human.nutrition + 400);
    human.nutritionStage = nutritionStageAt(human.nutritionStage, human.nutrition);
    human.lastMealAtTick = state.tick;
    human.task = null;
    human.decisionRequested = true;
    return;
  }
  if (task.phase === 'moving-to-target' || task.phase === 'working') {
    const resourceId = task.targetResourceId;
    const reservationActive = task.reservationIds.every((reservationId) =>
      state.civilization.reservations.active.some(
        (reservation) => reservation.id === reservationId && reservation.holderLifeId === human.id,
      ),
    );
    if (!reservationActive) {
      failTask(state, human, 'reservation-expired');
      return;
    }
    if (!state.resources.active[resourceId] || (state.resources.amount[resourceId] ?? 0) <= 0) {
      failTask(state, human, 'target-disappeared');
      return;
    }
    if (task.phase === 'moving-to-target') {
      if (state.tick % 2 !== 0) return;
      if (!moveToward(state, human, task.targetCell)) {
        failTask(state, human, 'target-unreachable');
        return;
      }
      if (human.cell === task.targetCell) task.phase = 'working';
      return;
    }
    task.workRemaining = Math.max(0, task.workRemaining - 1);
    if (task.workRemaining > 0) return;
    state.resources.amount[resourceId] = Math.max(0, (state.resources.amount[resourceId] ?? 0) - 1);
    if ((state.resources.amount[resourceId] ?? 0) === 0) {
      state.resources.active[resourceId] = 0;
      state.resources.cellToResource[state.resources.cell[resourceId] ?? 0] = -1;
    }
    state.resources.revision += 1;
    state.resources.dirtyResourceIds.push(resourceId);
    human.carried = { kind: task.resourceKind, amount: 1 };
    for (const reservationId of task.reservationIds) {
      releaseReservation(state.civilization.reservations, reservationId);
    }
    task.reservationIds = [];
    if (task.kind === 'forage-food') {
      task.phase = 'consuming';
      return;
    }
    const storage = state.civilization.buildings.find(
      (building) =>
        building.settlementId === task.settlementId &&
        building.kind === 'basic-storage' &&
        building.completed,
    );
    if (!storage) {
      failTask(state, human, 'target-disappeared');
      return;
    }
    task.targetCell = storage.cell;
    task.phase = 'moving-to-delivery';
    return;
  }
  if (task.phase !== 'moving-to-delivery') return;
  if (state.tick % 2 === 0 && !moveToward(state, human, task.targetCell)) {
    failTask(state, human, 'target-unreachable');
    return;
  }
  if (human.cell !== task.targetCell) return;
  const inventory = state.civilization.settlementInventories.find(
    (candidate) => candidate.settlementId === task.settlementId,
  );
  if (!inventory || !human.carried.kind) {
    failTask(state, human, 'target-disappeared');
    return;
  }
  const stored = inventory.food + inventory.wood + inventory.stone + inventory.metal;
  if (stored + human.carried.amount > inventory.capacity) {
    failTask(state, human, 'resource-unavailable');
    return;
  }
  inventory[human.carried.kind] += human.carried.amount;
  human.carried = { kind: null, amount: 0 };
  human.task = null;
  human.decisionRequested = true;
}

function advanceEatTask(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (!task || task.kind !== 'eat') return;
  if (task.phase === 'moving-to-target') {
    if (state.tick % 2 !== 0) return;
    if (!moveToward(state, human, task.targetCell)) {
      failTask(state, human, 'target-unreachable');
      return;
    }
    if (human.cell !== task.targetCell) return;
    task.phase = 'working';
    return;
  }
  if (task.phase === 'working') {
    const reservation = task.reservationIds
      .map((reservationId) =>
        state.civilization.reservations.active.find(
          (candidate) => candidate.id === reservationId && candidate.holderLifeId === human.id,
        ),
      )
      .find(Boolean);
    const inventory = state.civilization.settlementInventories.find(
      (candidate) => candidate.settlementId === task.settlementId,
    );
    if (!reservation || !inventory || inventory.food < 1) {
      failTask(state, human, reservation ? 'resource-unavailable' : 'reservation-expired');
      return;
    }
    inventory.food -= 1;
    for (const reservationId of task.reservationIds) {
      releaseReservation(state.civilization.reservations, reservationId);
    }
    task.reservationIds = [];
    human.carried = { kind: 'food', amount: 1 };
    task.phase = 'carrying';
    return;
  }
  if (task.phase === 'carrying') {
    task.phase = 'consuming';
    return;
  }
  if (task.phase !== 'consuming') return;
  if (human.carried.kind !== 'food' || human.carried.amount < 1) {
    failTask(state, human, 'resource-unavailable');
    return;
  }
  human.carried = { kind: null, amount: 0 };
  human.nutrition = Math.min(1_000, human.nutrition + 400);
  human.nutritionStage = nutritionStageAt(human.nutritionStage, human.nutrition);
  human.lastMealAtTick = state.tick;
  human.task = null;
  human.decisionRequested = true;
}

function advanceConstructionDelivery(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (
    !task ||
    task.kind !== 'deliver-resource' ||
    task.targetBuildingId === null ||
    !task.resourceKind
  )
    return;
  const building = state.civilization.buildings.find(
    (candidate) => candidate.id === task.targetBuildingId && !candidate.completed,
  );
  if (!building) {
    failTask(state, human, 'target-disappeared');
    return;
  }
  if (task.phase === 'moving-to-target') {
    if (state.tick % 2 !== 0) return;
    if (!moveToward(state, human, task.targetCell)) {
      failTask(state, human, 'target-unreachable');
      return;
    }
    if (human.cell === task.targetCell) task.phase = 'carrying';
    return;
  }
  if (task.phase === 'carrying') {
    const reservation = task.reservationIds
      .map((reservationId) =>
        state.civilization.reservations.active.find(
          (candidate) => candidate.id === reservationId && candidate.holderLifeId === human.id,
        ),
      )
      .find(Boolean);
    const inventory = state.civilization.settlementInventories.find(
      (candidate) => candidate.settlementId === task.settlementId,
    );
    if (!reservation || !inventory || inventory[task.resourceKind] < 1) {
      failTask(state, human, reservation ? 'resource-unavailable' : 'reservation-expired');
      return;
    }
    inventory[task.resourceKind] -= 1;
    for (const reservationId of task.reservationIds) {
      releaseReservation(state.civilization.reservations, reservationId);
    }
    task.reservationIds = [];
    human.carried = { kind: task.resourceKind, amount: 1 };
    task.targetCell = building.cell;
    task.phase = 'moving-to-delivery';
    return;
  }
  if (task.phase !== 'moving-to-delivery') return;
  if (state.tick % 2 === 0 && !moveToward(state, human, task.targetCell)) {
    failTask(state, human, 'target-unreachable');
    return;
  }
  if (human.cell !== building.cell) return;
  const required = building.required[task.resourceKind] ?? 0;
  const delivered = building.delivered[task.resourceKind] ?? 0;
  if (delivered >= required || human.carried.kind !== task.resourceKind) {
    failTask(state, human, 'resource-unavailable');
    return;
  }
  building.delivered[task.resourceKind] = delivered + human.carried.amount;
  human.carried = { kind: null, amount: 0 };
  human.task = null;
  human.decisionRequested = true;
}

function advanceBuildTask(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (!task || task.kind !== 'build' || task.targetBuildingId === null) return;
  const building = state.civilization.buildings.find(
    (candidate) => candidate.id === task.targetBuildingId && !candidate.completed,
  );
  if (!building) {
    failTask(state, human, 'target-disappeared');
    return;
  }
  const hasMaterials = Object.entries(building.required).every(
    ([resourceKind, required]) =>
      (building.delivered[resourceKind as 'food' | 'wood' | 'stone' | 'metal'] ?? 0) >=
      (required ?? 0),
  );
  if (!hasMaterials) {
    failTask(state, human, 'resource-unavailable');
    return;
  }
  const reservationActive = task.reservationIds.every((reservationId) =>
    state.civilization.reservations.active.some(
      (reservation) => reservation.id === reservationId && reservation.holderLifeId === human.id,
    ),
  );
  if (!reservationActive) {
    failTask(state, human, 'reservation-expired');
    return;
  }
  if (task.phase === 'moving-to-target') {
    if (state.tick % 2 !== 0) return;
    if (!moveToward(state, human, building.cell)) {
      failTask(state, human, 'target-unreachable');
      return;
    }
    if (human.cell === building.cell) task.phase = 'working';
    return;
  }
  if (task.phase !== 'working') return;
  building.progress = Math.min(building.requiredProgress, building.progress + 1);
  task.workRemaining = Math.max(0, building.requiredProgress - building.progress);
  if (building.progress < building.requiredProgress) return;
  building.completed = true;
  for (const reservationId of task.reservationIds) {
    releaseReservation(state.civilization.reservations, reservationId);
  }
  human.task = null;
  human.workRole = 'none';
  human.decisionRequested = true;
}

function advanceRestTask(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (!task || task.kind !== 'rest') return;
  if (task.phase === 'moving-to-target') {
    if (state.tick % 2 !== 0) return;
    if (!moveToward(state, human, task.targetCell)) {
      failTask(state, human, 'target-unreachable');
      return;
    }
    if (human.cell === task.targetCell) task.phase = 'resting';
    return;
  }
  if (task.phase !== 'resting') return;
  human.energy = Math.min(1_000, human.energy + 5);
  human.energyStage = energyStageAt(human.energyStage, human.energy);
  if (human.energy < 750) return;
  human.task = null;
  human.suspendedTask = null;
  human.decisionRequested = true;
}

function advanceJoinSettlementTask(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (!task || task.kind !== 'join-settlement' || task.settlementId === null) return;
  const settlement = state.civilization.settlements.find(
    (candidate) => candidate.id === task.settlementId,
  );
  if (!settlement) {
    failTask(state, human, 'target-disappeared');
    return;
  }
  if (task.phase === 'moving-to-target') {
    if (state.tick % 2 !== 0) return;
    if (!moveToward(state, human, settlement.centerCell)) {
      failTask(state, human, 'target-unreachable');
      return;
    }
    if (human.cell !== settlement.centerCell) return;
  }
  joinSettlement(human, settlement);
  human.task = null;
  human.decisionRequested = true;
}

function advanceIdleWanderTask(state: KernelWorldRoot, human: HumanLifeFact): void {
  const task = human.task;
  if (!task || task.kind !== 'idle-wander') return;
  if (task.phase === 'moving-to-target') {
    if (state.tick % 2 !== 0) return;
    if (!moveToward(state, human, task.targetCell)) {
      failTask(state, human, 'target-unreachable');
      return;
    }
    if (human.cell !== task.targetCell) return;
  }
  human.task = null;
  human.decisionRequested = true;
}

export function advanceLifeTaskActions(state: KernelWorldRoot): void {
  for (const human of state.civilization.life) {
    if (!human.active || !human.task) continue;
    const task = human.task;
    if (task.kind === 'rest') {
      advanceRestTask(state, human);
      continue;
    }
    if (task.kind === 'eat') {
      advanceEatTask(state, human);
      continue;
    }
    if (task.kind === 'forage-food') {
      advanceGatherTask(state, human);
      continue;
    }
    if (task.kind === 'deliver-resource') {
      advanceConstructionDelivery(state, human);
      continue;
    }
    if (task.kind === 'build') {
      advanceBuildTask(state, human);
      continue;
    }
    if (task.kind === 'gather-resource') {
      advanceGatherTask(state, human);
      continue;
    }
    if (task.kind === 'join-settlement') {
      advanceJoinSettlementTask(state, human);
      continue;
    }
    if (task.kind === 'idle-wander') {
      advanceIdleWanderTask(state, human);
      continue;
    }
    if (task.kind !== 'establish-settlement' || task.phase !== 'working') continue;
    task.workRemaining = Math.max(0, task.workRemaining - 1);
    if (task.workRemaining > 0) continue;
    const reachable = findReachableSettlement(state.civilization, human, state.world);
    if (reachable) {
      task.kind = 'join-settlement';
      task.phase = human.cell === reachable.settlement.centerCell ? 'working' : 'moving-to-target';
      task.targetCell = reachable.settlement.centerCell;
      task.settlementId = reachable.settlement.id;
      task.expectedResult = 'settlement-membership';
      task.workRemaining = 0;
      task.pathCells = reachable.pathCells;
      task.pathCursor = 1;
      task.pathWorldRevision = state.world.revision;
      if (task.phase === 'working') advanceJoinSettlementTask(state, human);
      continue;
    }
    const settlement = establishPrimitiveSettlement(
      state.civilization,
      state.world,
      state.resources,
      human,
      state.tick,
    );
    if (!settlement) {
      human.lastTaskFailure = {
        code: 'target-unreachable',
        atTick: state.tick,
        retryAfterTick: state.tick + 100,
        targetCell: task.targetCell,
      };
      human.retryAfterTick = state.tick + 100;
    }
    human.task = null;
    human.decisionRequested = true;
  }
}
