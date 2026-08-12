export const TERRITORY_RULES = Object.freeze({
  ownershipUnit: 'cell',
  kingdomTerritory: 'union-of-village-territories',
  abandonedTerritory: 'gradual-decay',
  ownershipAffectsResources: true,
  ownershipTransfersOnConquest: true,
  godPowersIgnoreOwnership: true,
} as const);
