import type {
  ResidentTask,
  ResidentTaskReason,
  ResidentTaskTargetKind,
  ResidentTaskType,
} from '@/shared/gameTypes';

export const ACTIVE_TASK_LEASE_TICKS = 60;
export const SUSPENDED_TASK_LEASE_TICKS = 120;

export interface BeginResidentTaskOptions {
  type: ResidentTaskType;
  reason: ResidentTaskReason;
  targetKind: ResidentTaskTargetKind;
  targetId: number;
  targetCell: number;
  expectedResult: string;
  requiredProgress: number;
}

export function beginResidentTask(
  id: number,
  tick: number,
  options: BeginResidentTaskOptions,
): ResidentTask {
  return {
    id,
    ...options,
    phase: 'reserved',
    progress: 0,
    leaseUntilTick: tick + ACTIVE_TASK_LEASE_TICKS,
    suspendedUntilTick: 0,
    startedAtTick: tick,
    finishedAtTick: 0,
    failureReason: null,
    suspensionReason: null,
  };
}

export function renewResidentTaskLease(task: ResidentTask, tick: number): void {
  if (task.phase === 'complete' || task.phase === 'failed') return;
  task.leaseUntilTick = tick + ACTIVE_TASK_LEASE_TICKS;
}

export function suspendResidentTask(
  task: ResidentTask,
  tick: number,
  reason: Extract<ResidentTaskReason, 'critical-hunger' | 'critical-fatigue' | 'danger'>,
): void {
  task.phase = 'suspended';
  task.suspendedUntilTick = tick + SUSPENDED_TASK_LEASE_TICKS;
  task.leaseUntilTick = task.suspendedUntilTick;
  task.suspensionReason = reason;
}

export function failResidentTask(task: ResidentTask, tick: number, reason: string): void {
  task.phase = 'failed';
  task.failureReason = reason;
  task.leaseUntilTick = tick;
  task.suspendedUntilTick = 0;
  task.finishedAtTick = tick;
  task.suspensionReason = null;
}

export function completeResidentTask(task: ResidentTask, tick: number): void {
  task.phase = 'complete';
  task.progress = task.requiredProgress;
  task.leaseUntilTick = tick;
  task.suspendedUntilTick = 0;
  task.finishedAtTick = tick;
  task.suspensionReason = null;
}
