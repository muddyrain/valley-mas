export const KERNEL_PHASES = Object.freeze([
  { id: 'command-boundary', writes: ['commands', 'paused', 'world'] },
  { id: 'environment-and-body', writes: ['world', 'bodies'] },
  { id: 'perception', writes: ['perception-cache'] },
  { id: 'low-frequency-planning', writes: ['plans', 'opportunities'] },
  { id: 'intent-and-reservation', writes: ['intents', 'reservations'] },
  { id: 'action-and-combat', writes: ['actions', 'pending-results'] },
  { id: 'atomic-commit', writes: ['bodies', 'inventories', 'ownership'] },
  { id: 'cleanup-and-history', writes: ['lifecycle', 'history'] },
  { id: 'observation-publish', writes: ['observation-cache'] },
] as const);

export type KernelPhaseId = (typeof KERNEL_PHASES)[number]['id'];

export function phaseOwner(writeTarget: string): KernelPhaseId[] {
  return KERNEL_PHASES.filter((phase) => phase.writes.includes(writeTarget as never)).map(
    (phase) => phase.id,
  );
}
