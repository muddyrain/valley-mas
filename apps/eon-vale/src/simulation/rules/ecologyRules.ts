export const ECOLOGY_BALANCE_RULES = Object.freeze({
  allowPowerOverCapacity: true,
  hardCullOverCapacity: false,
  naturalReturnThresholdRatio: 0.2,
  naturalReturnCooldownTicks: Object.freeze([2_160, 4_320] as const),
});

export interface AnimalLifecycleRule {
  maturityYears: number;
  lifespanYears: number;
  maximumBreedingHunger: number;
  starvationDamage: number;
  reproductionChance: number;
}

export const ANIMAL_LIFECYCLE_RULES = Object.freeze({
  1: Object.freeze({
    maturityYears: 1,
    lifespanYears: 8,
    maximumBreedingHunger: 620,
    starvationDamage: 10,
    reproductionChance: 0.78,
  }),
  2: Object.freeze({
    maturityYears: 2,
    lifespanYears: 14,
    maximumBreedingHunger: 600,
    starvationDamage: 8,
    reproductionChance: 0.68,
  }),
  3: Object.freeze({
    maturityYears: 3,
    lifespanYears: 20,
    maximumBreedingHunger: 580,
    starvationDamage: 7,
    reproductionChance: 0.54,
  }),
  4: Object.freeze({
    maturityYears: 2,
    lifespanYears: 18,
    maximumBreedingHunger: 600,
    starvationDamage: 8,
    reproductionChance: 0.64,
  }),
  5: Object.freeze({
    maturityYears: 2,
    lifespanYears: 14,
    maximumBreedingHunger: 650,
    starvationDamage: 9,
    reproductionChance: 0.42,
  }),
  6: Object.freeze({
    maturityYears: 4,
    lifespanYears: 24,
    maximumBreedingHunger: 650,
    starvationDamage: 7,
    reproductionChance: 0.32,
  }),
  7: Object.freeze({
    maturityYears: 1,
    lifespanYears: 7,
    maximumBreedingHunger: 700,
    starvationDamage: 6,
    reproductionChance: 0.82,
  }),
} as const satisfies Record<number, AnimalLifecycleRule>);

export const HUNTING_RULES = Object.freeze({
  minimumPreyAge: 3,
  requiresFoodShortage: true,
  leavesCorpse: true,
  requiresButcheringAndDelivery: true,
  husbandryInCurrentScope: false,
  carcassDecayTicks: 360,
  foodShortagePerResident: 2,
  minimumFoodReserve: 4,
  huntRange: 42,
  attackIntervalTicks: 12,
  baseHuntDamage: 18,
  butcherTicks: 48,
  maximumCarriedMeat: 8,
  searchIntervalTicks: 40,
  meatBySpecies: Object.freeze({
    1: 2,
    2: 5,
    3: 8,
    4: 6,
    5: 3,
    6: 7,
    7: 1,
  } as const satisfies Record<number, number>),
});

export const FISHING_RULES = Object.freeze({
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
} as const);
