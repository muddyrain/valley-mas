import { describe, expect, it } from 'vitest';
import {
  FOOD_LOOP_RULES,
  GROUP_ACTIVITY_RULES,
  KINGDOM_SURVIVAL_RULES,
  requiredTravelRations,
  reservableTravelRations,
  STABILITY_SCENARIOS,
  TRAVEL_RATION_RULES,
} from './stabilityRules';

describe('5.5 stability rules', () => {
  it('keeps one edible inventory while retaining causal food sources', () => {
    expect(FOOD_LOOP_RULES).toMatchObject({
      inventoryUnit: 'food',
      sourceKinds: ['farm', 'wild', 'meat', 'fish'],
      storageSelection: 'lowest-reachable-navigation-cost',
      recipesInCurrentPhase: false,
    });
  });

  it('reserves enough meals for every member of a long journey', () => {
    expect(TRAVEL_RATION_RULES).toMatchObject({
      distanceCellsPerMeal: 128,
      mealHungerThreshold: 680,
      mealHungerReduction: 680,
      ordinaryWorkMaxOneWayCells: 48,
      rejectJourneyWithoutRations: true,
    });
    expect(TRAVEL_RATION_RULES.ordinaryWorkMaxOneWayCells * 2).toBeLessThan(
      TRAVEL_RATION_RULES.distanceCellsPerMeal,
    );
    expect(requiredTravelRations(0, 8)).toBe(0);
    expect(requiredTravelRations(1, 8)).toBe(8);
    expect(requiredTravelRations(129, 3)).toBe(6);
    expect(reservableTravelRations(11, 129, 3)).toBe(0);
    expect(reservableTravelRations(12, 129, 3)).toBe(6);
  });

  it('defines political survival from living citizens rather than buildings', () => {
    expect(KINGDOM_SURVIVAL_RULES).toEqual({
      active: 'living-citizens-and-populated-settlement',
      endangered: 'living-citizens-below-viable-population',
      exiled: 'living-citizens-without-populated-settlement',
      extinct: 'no-living-citizens',
      emptySettlementsBecomeAbandoned: true,
      crossKingdomAidInCurrentPhase: false,
    });
  });

  it('locks the accepted activity categories and deterministic scenario matrix', () => {
    expect(GROUP_ACTIVITY_RULES.categories).toEqual([
      'survival',
      'production',
      'logistics',
      'military',
      'migration',
      'idle',
      'blocked',
    ]);
    expect(STABILITY_SCENARIOS.map(({ id }) => id)).toEqual([
      'peace',
      'famine-recovery',
      'isolated-weak-kingdom',
      'two-kingdom-war',
      'long-expedition',
      'ocean-no-boat-baseline',
    ]);
    expect(STABILITY_SCENARIOS.every(({ seed }) => seed.length > 0)).toBe(true);
  });
});
