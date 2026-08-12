export const WORK_TASK_PHASES = [
  'select',
  'reserve',
  'travel',
  'face-target',
  'work',
  'collect',
  'carry',
  'deposit',
] as const;

export type WorkTaskPhase = (typeof WORK_TASK_PHASES)[number];

export const WORK_RULES = Object.freeze({
  preserveInterruptibleProgress: true,
  produceOnlyAfterWork: true,
  depositBeforeVillageInventory: true,
  simulationPrecisionIndependentOfSpeed: true,
});
