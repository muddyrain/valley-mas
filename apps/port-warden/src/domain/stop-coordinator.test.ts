import { describe, expect, it, vi } from 'vitest';
import type { ProcessSnapshot } from '../shared/domain';
import { StopCoordinator } from './stop-coordinator';

const process = (pid: number, ppid = 1): ProcessSnapshot => ({
  pid,
  ppid,
  name: `process-${pid}`,
  commandLine: `node process-${pid}.js`,
  executablePath: '/usr/local/bin/node',
  startedAt: `2026-08-11T01:00:${String(pid).padStart(2, '0')}.000Z`,
  readOnly: false,
});

describe('StopCoordinator dangerous-operation protection', () => {
  it('revalidates every identity and stops an exact tree deepest-first', async () => {
    const snapshots = new Map([
      [10, process(10)],
      [11, process(11, 10)],
      [12, process(12, 11)],
    ]);
    const terminate = vi.fn(async (pid: number) => {
      snapshots.delete(pid);
    });
    const coordinator = new StopCoordinator({
      getProcesses: async () => new Map(snapshots),
      terminate,
      waitBeforeVerify: async () => undefined,
      now: () => new Date('2026-08-11T03:00:00.000Z'),
      makeId: () => 'safe-plan',
    });

    const plan = await coordinator.prepare(process(10), 'tree');
    await coordinator.execute(plan.id, [10, 11, 12]);

    expect(plan.targetProcesses.map(({ pid }) => pid)).toEqual([12, 11, 10]);
    expect(terminate.mock.calls.map(([pid]) => pid)).toEqual([12, 11, 10]);
  });

  it('does not terminate when PID identity changed after confirmation', async () => {
    let current = process(10);
    const terminate = vi.fn(async (_pid: number) => undefined);
    const coordinator = new StopCoordinator({
      getProcesses: async () => new Map([[10, current]]),
      terminate,
      now: () => new Date('2026-08-11T03:00:00.000Z'),
      makeId: () => 'reuse-plan',
    });
    const plan = await coordinator.prepare(process(10), 'process');
    current = { ...current, startedAt: '2026-08-11T03:00:01.000Z' };

    await expect(coordinator.execute(plan.id, [10])).rejects.toThrow('进程身份已变化');
    expect(terminate).not.toHaveBeenCalled();
  });

  it('rejects read-only processes and mismatched confirmed PID lists', async () => {
    const readonly = { ...process(4), readOnly: true, readOnlyReason: '系统进程' };
    const terminate = vi.fn(async (_pid: number) => undefined);
    const coordinator = new StopCoordinator({
      getProcesses: async () =>
        new Map([
          [4, readonly],
          [10, process(10)],
        ]),
      terminate,
      now: () => new Date('2026-08-11T03:00:00.000Z'),
      makeId: () => 'guard-plan',
    });

    await expect(coordinator.prepare(readonly, 'process')).rejects.toThrow('只读');
    const plan = await coordinator.prepare(process(10), 'process');
    await expect(coordinator.execute(plan.id, [10, 11])).rejects.toThrow('PID 列表不匹配');
    expect(terminate).not.toHaveBeenCalled();
  });

  it('does not report a process as stopped while the same identity is still running', async () => {
    const current = process(10);
    const coordinator = new StopCoordinator({
      getProcesses: async () => new Map([[10, current]]),
      terminate: async () => undefined,
      waitBeforeVerify: async () => undefined,
      now: () => new Date('2026-08-11T03:00:00.000Z'),
      makeId: () => 'still-running-plan',
    });

    const plan = await coordinator.prepare(current, 'process');
    const result = await coordinator.execute(plan.id, [10]);

    expect(result.stoppedPids).toEqual([]);
    expect(result.failed).toEqual([{ pid: 10, message: '停止信号已发送，但进程仍在运行' }]);
  });
});
