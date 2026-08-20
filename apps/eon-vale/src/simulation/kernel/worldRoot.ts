import type { NaturalResourceStore } from '../resources/naturalResources';
import { generateWorld } from '../world/generateWorld';
import type {
  NaturalContentOptions,
  WorldFacts,
  WorldPreset,
  WorldSize,
} from '../world/worldFacts';
import type { KernelCommand, KernelCommandRecord } from './commands';
import type { KernelPhaseId } from './phases';

export interface CivilizationFacts {
  humans: number;
  settlementInventories: Array<never>;
}

export interface KernelCommandState {
  pending: KernelCommand[];
  records: KernelCommandRecord[];
  lastSequence: number;
}

export interface KernelDiagnostics {
  invariantErrors: string[];
  lastPhaseTrace: KernelPhaseId[];
}

export interface KernelWorldRoot {
  schemaVersion: 1;
  seed: string;
  tick: number;
  paused: boolean;
  world: WorldFacts;
  resources: NaturalResourceStore;
  civilization: CivilizationFacts;
  commands: KernelCommandState;
  diagnostics: KernelDiagnostics;
}

export interface CreateKernelWorldOptions {
  seed: string;
  size?: WorldSize;
  preset?: WorldPreset;
  naturalContent?: NaturalContentOptions;
}

export function createKernelWorldRoot(options: CreateKernelWorldOptions): KernelWorldRoot {
  const generated = generateWorld({
    seed: options.seed,
    size: options.size,
    preset: options.preset,
    naturalContent: options.naturalContent,
  });
  return {
    schemaVersion: 1,
    seed: options.seed,
    tick: 0,
    paused: true,
    world: generated.world,
    resources: generated.resources,
    civilization: { humans: 0, settlementInventories: [] },
    commands: { pending: [], records: [], lastSequence: 0 },
    diagnostics: { invariantErrors: [], lastPhaseTrace: [] },
  };
}
