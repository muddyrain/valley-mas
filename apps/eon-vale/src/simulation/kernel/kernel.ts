import { applyWorldTerrainEdit } from '../world/worldEditing';
import type { NaturalContentOptions, WorldPreset, WorldSize } from '../world/worldFacts';
import { kernelChecksum } from './checksum';
import type { KernelCommand, KernelCommandRecord } from './commands';
import { validateKernelInvariants } from './invariants';
import { KERNEL_PHASES, type KernelPhaseId } from './phases';
import { createKernelWorldRoot, type KernelWorldRoot } from './worldRoot';

export type PlaybackRate = 1 | 2 | 4 | 8;

export interface CreateSimulationKernelOptions {
  seed: string;
  size?: WorldSize;
  preset?: WorldPreset;
  naturalContent?: NaturalContentOptions;
}

export interface KernelStepReport {
  advanced: boolean;
  tick: number;
  phases: KernelPhaseId[];
  checksum: string;
  invariantErrors: string[];
}

export interface SimulationKernel {
  readonly state: KernelWorldRoot;
  readonly playbackRate: PlaybackRate;
  setPlaybackRate(rate: PlaybackRate): void;
  setPaused(paused: boolean): void;
  enqueue(command: KernelCommand): void;
  flushCommands(): KernelCommandRecord[];
  step(): KernelStepReport;
  runTicks(count: number): KernelStepReport[];
  checksum(): string;
}

function executeCommand(state: KernelWorldRoot, command: KernelCommand): KernelCommandRecord {
  if (command.sequence <= state.commands.lastSequence) {
    return {
      sequence: command.sequence,
      type: command.type,
      status: 'rejected',
      reason: 'duplicate-or-stale-sequence',
    };
  }
  state.commands.lastSequence = command.sequence;
  if (command.type === 'set-paused') {
    state.paused = command.paused;
    return { sequence: command.sequence, type: command.type, status: 'accepted' };
  }
  const result = applyWorldTerrainEdit(state.world, state.resources, command);
  return {
    sequence: command.sequence,
    type: command.type,
    status: result.accepted ? 'accepted' : 'rejected',
    reason: result.reason,
  };
}

export function createSimulationKernelFromState(state: KernelWorldRoot): SimulationKernel {
  let playbackRate: PlaybackRate = 1;

  const flushCommands = (): KernelCommandRecord[] => {
    const commands = state.commands.pending
      .splice(0)
      .sort((left, right) => left.sequence - right.sequence);
    const records = commands.map((command) => executeCommand(state, command));
    state.commands.records.push(...records);
    return records;
  };

  const kernel: SimulationKernel = {
    state,
    get playbackRate() {
      return playbackRate;
    },
    setPlaybackRate(rate) {
      playbackRate = rate;
    },
    setPaused(paused) {
      const highestPending = state.commands.pending.reduce(
        (highest, command) => Math.max(highest, command.sequence),
        state.commands.lastSequence,
      );
      state.commands.pending.push({ type: 'set-paused', sequence: highestPending + 1, paused });
      flushCommands();
    },
    enqueue(command) {
      state.commands.pending.push(command);
    },
    flushCommands,
    step() {
      flushCommands();
      if (state.paused) {
        return {
          advanced: false,
          tick: state.tick,
          phases: [],
          checksum: kernelChecksum(state),
          invariantErrors: validateKernelInvariants(state),
        };
      }
      const phases = KERNEL_PHASES.map((phase) => phase.id);
      state.tick += 1;
      state.diagnostics.lastPhaseTrace = phases;
      state.diagnostics.invariantErrors = validateKernelInvariants(state);
      return {
        advanced: true,
        tick: state.tick,
        phases,
        checksum: kernelChecksum(state),
        invariantErrors: [...state.diagnostics.invariantErrors],
      };
    },
    runTicks(count) {
      const reports: KernelStepReport[] = [];
      for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
        reports.push(kernel.step());
      }
      return reports;
    },
    checksum() {
      return kernelChecksum(state);
    },
  };
  state.diagnostics.invariantErrors = validateKernelInvariants(state);
  return kernel;
}

export function createSimulationKernel(options: CreateSimulationKernelOptions): SimulationKernel {
  return createSimulationKernelFromState(createKernelWorldRoot(options));
}
