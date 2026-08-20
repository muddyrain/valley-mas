import type { SurfaceHabitat } from '../world/worldFacts';

interface CommandEnvelope {
  sequence: number;
}

export type KernelCommand =
  | (CommandEnvelope & { type: 'set-paused'; paused: boolean })
  | (CommandEnvelope & { type: 'raise-terrain'; cell: number; amount: number })
  | (CommandEnvelope & { type: 'lower-terrain'; cell: number; amount: number })
  | (CommandEnvelope & { type: 'set-surface'; cell: number; surface: SurfaceHabitat });

export type KernelCommandStatus = 'accepted' | 'rejected';

export interface KernelCommandRecord {
  sequence: number;
  type: KernelCommand['type'];
  status: KernelCommandStatus;
  reason?: 'duplicate-or-stale-sequence' | 'cell-out-of-range' | 'surface-underwater';
}
