import {
  type BuildingId,
  domainId,
  type LifeId,
  type ReservationId,
  type ResourceId,
  type SettlementId,
} from '../kernel/ids';

export type ReservationTarget =
  | { kind: 'natural-resource'; resourceId: ResourceId }
  | {
      kind: 'settlement-inventory';
      settlementId: SettlementId;
      resourceKind: 'food' | 'wood' | 'stone' | 'metal';
    }
  | { kind: 'construction-site'; buildingId: BuildingId };

export interface ReservationFact {
  id: ReservationId;
  holderLifeId: LifeId;
  target: ReservationTarget;
  quantity: number;
  createdAtTick: number;
  expiresAtTick: number;
}

export interface ReservationLedger {
  nextReservationId: number;
  active: ReservationFact[];
}

export interface ReservationClaim {
  holderLifeId: LifeId;
  target: ReservationTarget;
  quantity: number;
  availableQuantity?: number;
  tick: number;
  expiresAtTick: number;
}

export type ReservationClaimResult =
  | { status: 'granted'; reservation: ReservationFact }
  | {
      status: 'rejected';
      reason: 'target-reserved' | 'insufficient-available' | 'invalid-claim';
    };

export function createReservationLedger(): ReservationLedger {
  return { nextReservationId: 0, active: [] };
}

function targetsEqual(left: ReservationTarget, right: ReservationTarget): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'natural-resource' && right.kind === 'natural-resource') {
    return left.resourceId === right.resourceId;
  }
  if (left.kind === 'settlement-inventory' && right.kind === 'settlement-inventory') {
    return left.settlementId === right.settlementId && left.resourceKind === right.resourceKind;
  }
  if (left.kind === 'construction-site' && right.kind === 'construction-site') {
    return left.buildingId === right.buildingId;
  }
  return false;
}

export function claimReservation(
  ledger: ReservationLedger,
  claim: ReservationClaim,
): ReservationClaimResult {
  if (
    !Number.isSafeInteger(claim.quantity) ||
    claim.quantity < 1 ||
    !Number.isSafeInteger(claim.tick) ||
    claim.tick < 0 ||
    !Number.isSafeInteger(claim.expiresAtTick) ||
    claim.expiresAtTick <= claim.tick
  ) {
    return { status: 'rejected', reason: 'invalid-claim' };
  }
  const existing = ledger.active.filter((reservation) =>
    targetsEqual(reservation.target, claim.target),
  );
  if (
    (claim.target.kind === 'natural-resource' || claim.target.kind === 'construction-site') &&
    existing.length > 0
  ) {
    return { status: 'rejected', reason: 'target-reserved' };
  }
  if (claim.target.kind === 'settlement-inventory') {
    if (
      claim.availableQuantity === undefined ||
      !Number.isSafeInteger(claim.availableQuantity) ||
      claim.availableQuantity < 0
    ) {
      return { status: 'rejected', reason: 'invalid-claim' };
    }
    const reserved = existing.reduce((total, reservation) => total + reservation.quantity, 0);
    if (reserved + claim.quantity > claim.availableQuantity) {
      return { status: 'rejected', reason: 'insufficient-available' };
    }
  }
  const reservation: ReservationFact = {
    id: domainId<'reservation'>(ledger.nextReservationId),
    holderLifeId: claim.holderLifeId,
    target: claim.target,
    quantity: claim.quantity,
    createdAtTick: claim.tick,
    expiresAtTick: claim.expiresAtTick,
  };
  ledger.nextReservationId += 1;
  ledger.active.push(reservation);
  return { status: 'granted', reservation };
}

export function expireReservations(ledger: ReservationLedger, tick: number): ReservationId[] {
  const expired: ReservationId[] = [];
  for (let index = ledger.active.length - 1; index >= 0; index -= 1) {
    const reservation = ledger.active[index];
    if (!reservation || reservation.expiresAtTick > tick) continue;
    expired.push(reservation.id);
    ledger.active.splice(index, 1);
  }
  return expired.sort((left, right) => left - right);
}

export function releaseReservation(
  ledger: ReservationLedger,
  reservationId: ReservationId,
): boolean {
  const index = ledger.active.findIndex((reservation) => reservation.id === reservationId);
  if (index < 0) return false;
  ledger.active.splice(index, 1);
  return true;
}
