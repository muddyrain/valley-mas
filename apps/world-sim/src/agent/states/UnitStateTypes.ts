export type UnitState = 'Idle' | 'Wander' | 'March' | 'Harvest' | 'Build' | 'Rest';

export type UnitStateContext = {
  waitUntil: number;
  now: number;
  hasTarget: () => boolean;
  moveTowardTarget: (deltaMs: number) => boolean;
  pickWanderTarget: () => void;
  pickHarvestTarget: () => void;
  pickBuildTarget: () => void;
  pickRestTarget: () => void;
  harvestResource: () => boolean;
  hasBuildTask: () => boolean;
  shouldHarvest: () => boolean;
  buildAtTarget: (deltaMs: number) => boolean;
  isRested: () => boolean;
  transition: (state: UnitState) => void;
};
