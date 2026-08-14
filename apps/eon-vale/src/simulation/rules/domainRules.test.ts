import { describe, expect, it } from 'vitest';
import { DELIVERY_BATCHES } from './deliveryRules';
import { ECOLOGY_BALANCE_RULES, FISHING_RULES, HUNTING_RULES } from './ecologyRules';
import { classifyPopulationBalance, POPULATION_BALANCE_RULES } from './populationRules';
import {
  LAW_TRANSITION_RULES,
  RULE_CONFLICT_RULES,
  SIMULATION_SPEEDS,
  simulationTickIntervalMs,
  speedForShortcut,
} from './runtimeRules';
import { TERRITORY_RULES } from './territoryRules';
import { WATER_TRAVEL_RULES } from './travelRules';
import { WORK_TASK_PHASES } from './workRules';

describe('accepted domain rules', () => {
  it('defines the healthy and intervention population bands', () => {
    expect(POPULATION_BALANCE_RULES).toEqual({
      healthyMinimumRatio: 0.6,
      healthyMaximumRatio: 0.85,
      interventionRatio: 0.45,
      minimumViableVillagePopulation: 6,
    });
    expect(classifyPopulationBalance(60, 100)).toBe('healthy');
    expect(classifyPopulationBalance(85, 100)).toBe('healthy');
    expect(classifyPopulationBalance(44, 100)).toBe('intervention');
    expect(classifyPopulationBalance(90, 100)).toBe('above-target');
  });

  it('keeps the real work lifecycle in its accepted order', () => {
    expect(WORK_TASK_PHASES).toEqual([
      'select',
      'reserve',
      'travel',
      'face-target',
      'work',
      'collect',
      'carry',
      'deposit',
    ]);
  });

  it('keeps ecology recovery causal instead of hard-culling power-spawned animals', () => {
    expect(ECOLOGY_BALANCE_RULES.allowPowerOverCapacity).toBe(true);
    expect(ECOLOGY_BALANCE_RULES.hardCullOverCapacity).toBe(false);
    expect(ECOLOGY_BALANCE_RULES.naturalReturnThresholdRatio).toBe(0.2);
    expect(HUNTING_RULES).toMatchObject({
      minimumPreyAge: 3,
      leavesCorpse: true,
      requiresButcheringAndDelivery: true,
      husbandryInCurrentScope: false,
    });
  });

  it('starts with shore fishing and upgrades to real dock-and-boat logistics', () => {
    expect(FISHING_RULES).toEqual({
      initialMethod: 'shore',
      upgradedMethod: 'dock-and-boat',
      requiresReachableShore: true,
      residentsWalkOnWater: false,
      consumesRealFishPopulation: true,
      emptyWaterProducesFish: false,
      requiresVisibleDelivery: true,
      depositBeforeVillageInventory: true,
      overfishingCanDepleteLocalPopulation: true,
      recoveryRequiresEcologicalReproduction: true,
      dockAndBoatInCurrentPhase: false,
      shoreRange: 4,
      workTicks: 72,
      catchFood: 2,
      searchIntervalTicks: 40,
      habitatFeedingIntervalTicks: 40,
      habitatFeedingHungerReduction: 320,
      habitatFeedingPressureExponent: 2,
    });
  });

  it('allows wading and emergency swimming without replacing boats', () => {
    expect(WATER_TRAVEL_RULES).toEqual({
      shallowWater: 'wade',
      deepWater: 'emergency-swim',
      shallowWaterSlowsMovement: true,
      waterConsumesStamina: true,
      zeroStaminaCausesDrowning: true,
      drowningSlowsAndDamages: true,
      aiPlansRoutineRoutesThroughDeepWater: false,
      emergencySwimTargetsNearestReachableLand: true,
      canWorkWhileSwimming: false,
      canFightWhileSwimming: false,
      canCarryHeavyCargoWhileSwimming: false,
      interIslandMigrationRequiresBoat: true,
      interIslandColonizationRequiresBoat: true,
      interIslandWarRequiresBoat: true,
      aquaticSpeciesIgnoreLandSwimLimits: true,
      landAnimalsSwimOnlyForEscapeOrShortCrossing: true,
      shoreFishingRemainsOnLand: true,
    });
  });

  it('defines territory as real cell ownership used by resources and conquest', () => {
    expect(TERRITORY_RULES).toMatchObject({
      ownershipUnit: 'cell',
      kingdomTerritory: 'union-of-village-territories',
      abandonedTerritory: 'gradual-decay',
      ownershipAffectsResources: true,
      ownershipTransfersOnConquest: true,
      godPowersIgnoreOwnership: true,
    });
  });

  it('defines player-controlled speed shortcuts without implicit speed changes', () => {
    expect(SIMULATION_SPEEDS).toEqual([1, 2, 4, 8]);
    expect(speedForShortcut('1')).toBe(1);
    expect(speedForShortcut('2')).toBe(2);
    expect(speedForShortcut('3')).toBe(4);
    expect(speedForShortcut('4')).toBe(8);
    expect(speedForShortcut('5')).toBeNull();
    expect(simulationTickIntervalMs(1)).toBe(50);
    expect(simulationTickIntervalMs(8)).toBe(6.25);
  });

  it('changes future behavior without undoing established world facts', () => {
    expect(LAW_TRANSITION_RULES).toEqual({
      preserveEstablishedFacts: true,
      reviveDeadEntities: false,
      restoreConsumedResources: false,
      logEveryPlayerChange: true,
      workTasksFinishCarriedDelivery: true,
    });
  });

  it('resolves rule conflicts by causal invariants and explicit law scopes', () => {
    expect(RULE_CONFLICT_RULES).toEqual({
      causalInvariantsHavePriority: true,
      lawsApplyOnlyToDeclaredScope: true,
      powersMayNotSilentlyToggleLaws: true,
      conflictingPowersAreBlockedWithReason: true,
      exceptionsMustBeCatalogedAndTested: true,
      universalPowerLawAiPriority: false,
    });
  });

  it('delivers the roadmap as six independently playable vertical slices', () => {
    expect(DELIVERY_BATCHES.map(({ id }) => id)).toEqual([
      'long-world-baseline',
      'resident-readability-slice',
      'settlement-and-kingdom-readability',
      'wild-ecology-and-food-loop',
      'full-world-visual-rollout',
      'ocean-transport-expansion',
    ]);
    expect(DELIVERY_BATCHES.every(({ playableLoopRequired }) => playableLoopRequired)).toBe(true);
    expect(DELIVERY_BATCHES.slice(0, 3).every(({ status }) => status === 'complete')).toBe(true);
    expect(DELIVERY_BATCHES[3]?.status).toBe('complete');
    expect(DELIVERY_BATCHES.slice(4).every(({ status }) => status === 'planned')).toBe(true);
    expect(
      DELIVERY_BATCHES.every(
        ({ backendOnlyDeliveryAllowed, decorativeOnlyDeliveryAllowed }) =>
          !backendOnlyDeliveryAllowed && !decorativeOnlyDeliveryAllowed,
      ),
    ).toBe(true);
  });
});
