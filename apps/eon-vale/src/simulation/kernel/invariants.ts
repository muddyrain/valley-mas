import { ElevationBand, elevationBandAt } from '../world/worldFacts';
import type { KernelWorldRoot } from './worldRoot';

export function validateKernelInvariants(state: KernelWorldRoot): string[] {
  const errors: string[] = [];
  const cellCount = state.world.size * state.world.size;
  if (state.world.elevation.length !== cellCount) errors.push('world.elevation length mismatch');
  if (state.world.surface.length !== cellCount) errors.push('world.surface length mismatch');
  if (state.world.moisture.length !== cellCount) errors.push('world.moisture length mismatch');
  if (state.world.temperature.length !== cellCount)
    errors.push('world.temperature length mismatch');
  if (state.resources.cellToResource.length !== cellCount)
    errors.push('resources.cellToResource length mismatch');
  const occupied = new Set<number>();
  for (let id = 0; id < state.resources.count; id += 1) {
    if (!state.resources.active[id]) continue;
    const cell = state.resources.cell[id] ?? cellCount;
    if (cell >= cellCount) errors.push(`resource ${id} outside world`);
    if (occupied.has(cell)) errors.push(`multiple resources occupy cell ${cell}`);
    occupied.add(cell);
    const band = elevationBandAt(state.world.elevation[cell] ?? -4);
    if (band === ElevationBand.DeepOcean || band === ElevationBand.ShallowWater) {
      errors.push(`land resource ${id} is submerged`);
    }
  }
  if (state.world.preset === 'ocean' && occupied.size > 0) errors.push('blank ocean has resources');
  const activeHumans = state.civilization.life.reduce(
    (total, human) => total + (human.active ? 1 : 0),
    0,
  );
  if (state.civilization.humans !== activeHumans) errors.push('civilization human count mismatch');
  const lifeIds = new Set<number>();
  for (const human of state.civilization.life) {
    if (lifeIds.has(human.id)) errors.push(`duplicate life id ${human.id}`);
    lifeIds.add(human.id);
    if (human.cell < 0 || human.cell >= cellCount) errors.push(`life ${human.id} outside world`);
    if (human.health < 0 || human.health > 1_000) errors.push(`life ${human.id} health invalid`);
    if (human.nutrition < 0 || human.nutrition > 1_000)
      errors.push(`life ${human.id} nutrition invalid`);
    if (human.energy < 0 || human.energy > 1_000) errors.push(`life ${human.id} energy invalid`);
    if (human.carried.amount < 0 || (human.carried.kind === null && human.carried.amount !== 0))
      errors.push(`life ${human.id} carried resource invalid`);
    if (human.task && human.task.pathCursor > human.task.pathCells.length)
      errors.push(`life ${human.id} task path cursor invalid`);
    for (const pathCell of human.task?.pathCells ?? []) {
      if (pathCell < 0 || pathCell >= cellCount)
        errors.push(`life ${human.id} task path outside world`);
    }
    if (human.settlementId !== null) {
      const settlement = state.civilization.settlements.find(
        (candidate) => candidate.id === human.settlementId,
      );
      if (!settlement?.residentIds.includes(human.id))
        errors.push(`life ${human.id} settlement membership mismatch`);
    }
    for (const reservationId of human.task?.reservationIds ?? []) {
      if (
        !state.civilization.reservations.active.some(
          (reservation) =>
            reservation.id === reservationId && reservation.holderLifeId === human.id,
        )
      ) {
        errors.push(`life ${human.id} task reservation ${reservationId} missing`);
      }
    }
  }
  const exclusiveReservations = new Set<string>();
  for (const reservation of state.civilization.reservations.active) {
    const holder = state.civilization.life.find(
      (human) => human.id === reservation.holderLifeId && human.active,
    );
    if (!holder) errors.push(`reservation ${reservation.id} holder missing`);
    if (reservation.expiresAtTick <= state.tick)
      errors.push(`reservation ${reservation.id} expired`);
    if (reservation.target.kind === 'natural-resource') {
      const key = `resource:${reservation.target.resourceId}`;
      if (exclusiveReservations.has(key)) errors.push(`duplicate reservation ${key}`);
      exclusiveReservations.add(key);
    } else if (reservation.target.kind === 'construction-site') {
      const key = `building:${reservation.target.buildingId}`;
      if (exclusiveReservations.has(key)) errors.push(`duplicate reservation ${key}`);
      exclusiveReservations.add(key);
    }
  }
  for (const inventory of state.civilization.settlementInventories) {
    const quantities = [inventory.food, inventory.wood, inventory.stone, inventory.metal];
    if (quantities.some((quantity) => quantity < 0))
      errors.push(`settlement ${inventory.settlementId} inventory negative`);
    if (quantities.reduce((total, quantity) => total + quantity, 0) > inventory.capacity)
      errors.push(`settlement ${inventory.settlementId} inventory exceeds capacity`);
    for (const resourceKind of ['food', 'wood', 'stone', 'metal'] as const) {
      const reserved = state.civilization.reservations.active.reduce(
        (total, reservation) =>
          total +
          (reservation.target.kind === 'settlement-inventory' &&
          reservation.target.settlementId === inventory.settlementId &&
          reservation.target.resourceKind === resourceKind
            ? reservation.quantity
            : 0),
        0,
      );
      if (reserved > inventory[resourceKind])
        errors.push(`settlement ${inventory.settlementId} ${resourceKind} over-reserved`);
    }
  }
  for (const settlement of state.civilization.settlements) {
    if (new Set(settlement.residentIds).size !== settlement.residentIds.length)
      errors.push(`settlement ${settlement.id} has duplicate residents`);
    for (const residentId of settlement.residentIds) {
      const resident = state.civilization.life.find((human) => human.id === residentId);
      if (!resident || resident.settlementId !== settlement.id)
        errors.push(`settlement ${settlement.id} resident ${residentId} mismatch`);
    }
  }
  for (const building of state.civilization.buildings) {
    if (building.cell < 0 || building.cell >= cellCount)
      errors.push(`building ${building.id} outside world`);
    if (elevationBandAt(state.world.elevation[building.cell] ?? -4) !== ElevationBand.Land)
      errors.push(`building ${building.id} is submerged`);
    if (building.progress < 0 || building.progress > building.requiredProgress)
      errors.push(`building ${building.id} progress invalid`);
    for (const resourceKind of ['food', 'wood', 'stone', 'metal'] as const) {
      if ((building.delivered[resourceKind] ?? 0) > (building.required[resourceKind] ?? 0))
        errors.push(`building ${building.id} ${resourceKind} over-delivered`);
    }
  }
  for (const family of state.civilization.families) {
    const first = state.civilization.life.find((human) => human.id === family.partnerIds[0]);
    const second = state.civilization.life.find((human) => human.id === family.partnerIds[1]);
    if (
      !first ||
      !second ||
      first.partnerId !== second.id ||
      second.partnerId !== first.id ||
      first.familyId !== family.id ||
      second.familyId !== family.id
    ) {
      errors.push(`family ${family.id} partner mismatch`);
    }
  }
  return errors;
}
