import { advanceFamilyReproduction, formSettlementFamilies } from '../life/families';
import { selectLifeIntents } from '../life/intents';
import {
  advanceLifeBodies,
  deterministicHumanPlacementCells,
  placeHumanFacts,
} from '../life/lifeFacts';
import { updateLifePerceptions } from '../life/perception';
import { planConstructionProjects } from '../settlements/construction';
import { planSettlementNeeds, selectSettlementWorkIntents } from '../settlements/settlementNeeds';
import { expireReservations } from '../tasks/reservations';
import { advanceLifeTaskActions } from '../tasks/taskActions';
import { scheduleLifeTasks } from '../tasks/taskScheduler';
import { applyWorldTerrainEdit } from '../world/worldEditing';
import type { NaturalContentOptions, WorldPreset, WorldSize } from '../world/worldFacts';
import { ElevationBand, elevationBandAt } from '../world/worldFacts';
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
  if (command.type === 'place-humans') {
    const cellCount = state.world.size * state.world.size;
    if (command.cell < 0 || command.cell >= cellCount) {
      return {
        sequence: command.sequence,
        type: command.type,
        status: 'rejected',
        reason: 'cell-out-of-range',
      };
    }
    if (!Number.isInteger(command.count) || command.count < 1 || command.count > 40) {
      return {
        sequence: command.sequence,
        type: command.type,
        status: 'rejected',
        reason: 'invalid-count',
      };
    }
    if (elevationBandAt(state.world.elevation[command.cell] ?? -4) !== ElevationBand.Land) {
      return {
        sequence: command.sequence,
        type: command.type,
        status: 'rejected',
        reason: 'surface-underwater',
      };
    }
    const placementCells = deterministicHumanPlacementCells(
      state.world,
      command.cell,
      command.count,
    );
    if (placementCells.length !== command.count) {
      return {
        sequence: command.sequence,
        type: command.type,
        status: 'rejected',
        reason: 'insufficient-land',
      };
    }
    placeHumanFacts(state.civilization, state.seed, placementCells);
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
      advanceLifeBodies(state.civilization, state.tick);
      updateLifePerceptions(state.civilization, state.resources, state.world.size, state.tick);
      expireReservations(state.civilization.reservations, state.tick);
      planConstructionProjects(state.civilization, state.world, state.resources, state.tick);
      planSettlementNeeds(state.civilization, state.tick);
      selectLifeIntents(state.civilization, state.tick);
      selectSettlementWorkIntents(state.civilization, state.tick);
      scheduleLifeTasks(state, state.tick);
      advanceLifeTaskActions(state);
      formSettlementFamilies(state.civilization, state.tick);
      advanceFamilyReproduction(state.civilization, state.seed, state.tick);
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
