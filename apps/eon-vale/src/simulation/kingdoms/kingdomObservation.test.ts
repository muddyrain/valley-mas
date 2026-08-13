import { describe, expect, it } from 'vitest';
import { DiplomacyState } from '@/shared/gameTypes';
import { deriveKingdomObservation } from './kingdomObservation';

describe('kingdom observation', () => {
  it('derives kingdom borders, village divisions and real war fronts from territory cells', () => {
    const observation = deriveKingdomObservation({
      size: 4,
      villageIds: Uint16Array.from([1, 1, 2, 3, 1, 2, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0]),
      villages: [
        { id: 1, kingdomId: 1 },
        { id: 2, kingdomId: 1 },
        { id: 3, kingdomId: 2 },
      ],
      kingdoms: [
        { id: 1, extinct: false, relations: { 2: DiplomacyState.War } },
        { id: 2, extinct: false, relations: { 1: DiplomacyState.War } },
      ],
    });

    expect(observation.kingdomBorders.length).toBeGreaterThan(0);
    expect(observation.villageBorders.length).toBeGreaterThan(0);
    expect(observation.warFronts).toEqual([
      expect.objectContaining({
        orientation: 'vertical',
        line: 3,
        start: 0,
        end: 2,
        firstKingdomId: 1,
        secondKingdomId: 2,
      }),
    ]);
    expect(observation.adjacencies).toEqual([
      {
        firstKingdomId: 1,
        secondKingdomId: 2,
        sharedEdges: 2,
        diagonalOnly: false,
        atWar: true,
      },
    ]);
  });

  it('treats diagonal kingdoms as neighbours without inventing a shared front', () => {
    const observation = deriveKingdomObservation({
      size: 2,
      villageIds: Uint16Array.from([1, 0, 0, 2]),
      villages: [
        { id: 1, kingdomId: 1 },
        { id: 2, kingdomId: 2 },
      ],
      kingdoms: [
        { id: 1, extinct: false, relations: { 2: DiplomacyState.Peace } },
        { id: 2, extinct: false, relations: { 1: DiplomacyState.Peace } },
      ],
    });

    expect(observation.warFronts).toEqual([]);
    expect(observation.adjacencies).toEqual([
      {
        firstKingdomId: 1,
        secondKingdomId: 2,
        sharedEdges: 0,
        diagonalOnly: true,
        atWar: false,
      },
    ]);
  });
});
