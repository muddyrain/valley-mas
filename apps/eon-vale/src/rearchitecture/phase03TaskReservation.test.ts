import { describe, expect, it } from 'vitest';
import { domainId } from '@/simulation/kernel/ids';
import {
  claimReservation,
  createReservationLedger,
  expireReservations,
  releaseReservation,
} from '@/simulation/tasks/reservations';

describe('phase 3 task reservation contracts', () => {
  it('grants one exclusive resource claim and releases it deterministically at expiry', () => {
    const ledger = createReservationLedger();
    const first = claimReservation(ledger, {
      holderLifeId: domainId<'life'>(1),
      target: { kind: 'natural-resource', resourceId: domainId<'resource'>(7) },
      quantity: 1,
      tick: 10,
      expiresAtTick: 20,
    });
    const duplicate = claimReservation(ledger, {
      holderLifeId: domainId<'life'>(2),
      target: { kind: 'natural-resource', resourceId: domainId<'resource'>(7) },
      quantity: 1,
      tick: 11,
      expiresAtTick: 21,
    });

    expect(first).toMatchObject({ status: 'granted' });
    expect(duplicate).toEqual({ status: 'rejected', reason: 'target-reserved' });
    expect(ledger.active).toHaveLength(1);

    expect(expireReservations(ledger, 20)).toEqual([
      first.status === 'granted' ? first.reservation.id : -1,
    ]);
    expect(ledger.active).toHaveLength(0);
  });

  it('never reserves more settlement inventory than is physically available', () => {
    const ledger = createReservationLedger();
    const target = {
      kind: 'settlement-inventory' as const,
      settlementId: domainId<'settlement'>(3),
      resourceKind: 'food' as const,
    };
    const first = claimReservation(ledger, {
      holderLifeId: domainId<'life'>(1),
      target,
      quantity: 3,
      availableQuantity: 4,
      tick: 1,
      expiresAtTick: 20,
    });
    const overdraw = claimReservation(ledger, {
      holderLifeId: domainId<'life'>(2),
      target,
      quantity: 2,
      availableQuantity: 4,
      tick: 2,
      expiresAtTick: 20,
    });

    expect(first.status).toBe('granted');
    expect(overdraw).toEqual({ status: 'rejected', reason: 'insufficient-available' });
    if (first.status === 'granted') releaseReservation(ledger, first.reservation.id);
    expect(
      claimReservation(ledger, {
        holderLifeId: domainId<'life'>(2),
        target,
        quantity: 2,
        availableQuantity: 4,
        tick: 3,
        expiresAtTick: 20,
      }).status,
    ).toBe('granted');
  });
});
