export type UnitState =
  | 'Idle'
  | 'Wander'
  | 'March'
  | 'Harvest'
  | 'Build'
  | 'Rest'
  | 'Attack'
  | 'Flee';

export type UnitStateContext = {
  waitUntil: number;
  now: number;
  hasTarget: () => boolean;
  moveTowardTarget: (deltaMs: number) => boolean;
  pickWanderTarget: () => void;
  pickHarvestTarget: () => void;
  pickBuildTarget: () => void;
  pickRestTarget: () => void;
  pickAttackTarget: () => void;
  pickFleeTarget: () => void;
  harvestResource: () => boolean;
  hasBuildTask: () => boolean;
  hasAttackTask: () => boolean;
  hasFleeTask: () => boolean;
  shouldHarvest: () => boolean;
  buildAtTarget: (deltaMs: number) => boolean;
  isRested: () => boolean;
  attackAtTarget: (deltaMs: number) => boolean;
  transition: (state: UnitState) => void;
};
