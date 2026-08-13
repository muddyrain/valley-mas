import { describe, expect, it } from 'vitest';
import type { ResidentTask } from '@/shared/gameTypes';
import {
  beginResidentTask,
  failResidentTask,
  renewResidentTaskLease,
  suspendResidentTask,
} from './residentTasks';

describe('resident semantic tasks', () => {
  it('records reason, target, phase, progress and a renewable 60 tick lease', () => {
    const task = beginResidentTask(7, 20, {
      type: 'gather',
      reason: 'village-needs-wood',
      targetKind: 'resource-node',
      targetId: 31,
      targetCell: 101,
      expectedResult: '携带木材返回苔溪仓库',
      requiredProgress: 36,
    });

    expect(task).toMatchObject({
      id: 7,
      phase: 'reserved',
      progress: 0,
      leaseUntilTick: 80,
      failureReason: null,
    });
    renewResidentTaskLease(task, 50);
    expect(task.leaseUntilTick).toBe(110);
  });

  it('keeps completed work and the reservation for 120 ticks after survival preemption', () => {
    const task: ResidentTask = {
      ...beginResidentTask(8, 100, {
        type: 'craft',
        reason: 'village-needs-tools',
        targetKind: 'building',
        targetId: 4,
        targetCell: 50,
        expectedResult: '制作一件工具',
        requiredProgress: 72,
      }),
      phase: 'work',
      progress: 35,
    };

    suspendResidentTask(task, 115, 'critical-hunger');

    expect(task.phase).toBe('suspended');
    expect(task.progress).toBe(35);
    expect(task.leaseUntilTick).toBe(235);
    expect(task.reason).toBe('village-needs-tools');
    expect(task.suspensionReason).toBe('critical-hunger');
    expect(task.failureReason).toBeNull();
  });

  it('releases a failed task and exposes a stable failure reason', () => {
    const task = beginResidentTask(9, 100, {
      type: 'build',
      reason: 'village-needs-housing',
      targetKind: 'building',
      targetId: 2,
      targetCell: 60,
      expectedResult: '推进住宅施工',
      requiredProgress: 100,
    });

    failResidentTask(task, 130, '目标已被摧毁');

    expect(task).toMatchObject({
      phase: 'failed',
      failureReason: '目标已被摧毁',
      leaseUntilTick: 130,
      finishedAtTick: 130,
    });
  });
});
