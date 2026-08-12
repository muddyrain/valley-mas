export const SIMULATION_SPEEDS = [1, 2, 4, 8] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

const SPEED_SHORTCUTS = {
  '1': 1,
  '2': 2,
  '3': 4,
  '4': 8,
} as const satisfies Record<string, SimulationSpeed>;

export function speedForShortcut(key: string): SimulationSpeed | null {
  return SPEED_SHORTCUTS[key as keyof typeof SPEED_SHORTCUTS] ?? null;
}

export function simulationTickIntervalMs(speed: SimulationSpeed): number {
  return 1_000 / (20 * speed);
}

export const RUNTIME_RULES = Object.freeze({
  fixedStepHz: 20,
  dropSimulationTicks: false,
  changeSpeedForObservation: false,
  showBacklogInsteadOfChangingSpeed: true,
});

export const LAW_TRANSITION_RULES = Object.freeze({
  preserveEstablishedFacts: true,
  reviveDeadEntities: false,
  restoreConsumedResources: false,
  logEveryPlayerChange: true,
  workTasksFinishCarriedDelivery: true,
});

export const RULE_CONFLICT_RULES = Object.freeze({
  causalInvariantsHavePriority: true,
  lawsApplyOnlyToDeclaredScope: true,
  powersMayNotSilentlyToggleLaws: true,
  conflictingPowersAreBlockedWithReason: true,
  exceptionsMustBeCatalogedAndTested: true,
  universalPowerLawAiPriority: false,
});
