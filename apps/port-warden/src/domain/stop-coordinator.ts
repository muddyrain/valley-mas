import type {
  ProcessIdentity,
  ProcessSnapshot,
  StopExecutionResult,
  StopPlan,
  StopScope,
} from '../shared/domain';
import { verifyProcessIdentity } from './process-identity';
import { collectDescendantPids } from './process-tree';

type StopCoordinatorDependencies = {
  getProcesses(): Promise<Map<number, ProcessSnapshot>>;
  terminate(pid: number): Promise<void>;
  waitBeforeVerify?: () => Promise<void>;
  now?: () => Date;
  makeId?: () => string;
};

type StoredPlan = StopPlan & { identities: ProcessIdentity[] };

const identityOf = (process: ProcessSnapshot): ProcessIdentity => ({
  pid: process.pid,
  name: process.name,
  commandLine: process.commandLine,
  executablePath: process.executablePath,
  startedAt: process.startedAt,
});

const samePids = (left: number[], right: number[]) =>
  [...left].sort((a, b) => a - b).join(',') === [...right].sort((a, b) => a - b).join(',');

export class StopCoordinator {
  private readonly plans = new Map<string, StoredPlan>();
  private readonly now: () => Date;
  private readonly makeId: () => string;
  private readonly waitBeforeVerify: () => Promise<void>;

  constructor(private readonly dependencies: StopCoordinatorDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.makeId = dependencies.makeId ?? (() => crypto.randomUUID());
    this.waitBeforeVerify =
      dependencies.waitBeforeVerify ?? (() => new Promise((resolve) => setTimeout(resolve, 500)));
  }

  async prepare(expected: ProcessIdentity, scope: StopScope): Promise<StopPlan> {
    const processes = await this.dependencies.getProcesses();
    const current = processes.get(expected.pid);
    const verification = verifyProcessIdentity(expected, current);
    if (!verification.matches || !current) {
      throw new Error('进程身份已变化或进程已经退出，请刷新后重试');
    }
    if (current.readOnly) {
      throw new Error(
        current.readOnlyReason ? `该进程只读：${current.readOnlyReason}` : '该进程只读',
      );
    }

    const pids =
      scope === 'tree'
        ? [...collectDescendantPids(current.pid, processes), current.pid]
        : [current.pid];
    const targetProcesses = pids
      .map((pid) => processes.get(pid))
      .filter(Boolean) as ProcessSnapshot[];
    const readOnlyTarget = targetProcesses.find((process) => process.readOnly);
    if (readOnlyTarget) {
      throw new Error(`进程树包含只读 PID ${readOnlyTarget.pid}，已阻止停止操作`);
    }

    const now = this.now();
    const plan: StoredPlan = {
      id: this.makeId(),
      scope,
      expiresAt: new Date(now.getTime() + 30_000).toISOString(),
      targetProcesses,
      identities: targetProcesses.map(identityOf),
    };
    this.plans.set(plan.id, plan);
    return {
      id: plan.id,
      scope: plan.scope,
      expiresAt: plan.expiresAt,
      targetProcesses: plan.targetProcesses,
    };
  }

  async execute(planId: string, confirmedPids: number[]): Promise<StopExecutionResult> {
    const plan = this.plans.get(planId);
    this.plans.delete(planId);
    if (!plan) throw new Error('停止确认已失效，请重新确认');
    if (this.now().getTime() > new Date(plan.expiresAt).getTime()) {
      throw new Error('停止确认已过期，请重新确认');
    }

    const plannedPids = plan.targetProcesses.map(({ pid }) => pid);
    if (!samePids(plannedPids, confirmedPids)) throw new Error('确认的 PID 列表不匹配，已阻止操作');

    const freshProcesses = await this.dependencies.getProcesses();
    const alreadyExitedPids: number[] = [];
    for (const identity of plan.identities) {
      const current = freshProcesses.get(identity.pid);
      if (!current) {
        alreadyExitedPids.push(identity.pid);
        continue;
      }
      if (!verifyProcessIdentity(identity, current).matches) {
        throw new Error(`PID ${identity.pid} 的进程身份已变化，已阻止停止操作`);
      }
      if (current.readOnly) throw new Error(`PID ${identity.pid} 当前为只读，已阻止停止操作`);
    }

    const result: StopExecutionResult = { stoppedPids: [], alreadyExitedPids, failed: [] };
    const signaledPids: number[] = [];
    for (const { pid } of plan.targetProcesses) {
      if (alreadyExitedPids.includes(pid)) continue;
      try {
        await this.dependencies.terminate(pid);
        signaledPids.push(pid);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException)?.code === 'ESRCH') result.alreadyExitedPids.push(pid);
        else result.failed.push({ pid, message });
      }
    }

    if (signaledPids.length > 0) {
      await this.waitBeforeVerify();
      try {
        const afterStop = await this.dependencies.getProcesses();
        const identities = new Map(plan.identities.map((identity) => [identity.pid, identity]));
        for (const pid of signaledPids) {
          const current = afterStop.get(pid);
          const identity = identities.get(pid);
          if (!current || !identity || !verifyProcessIdentity(identity, current).matches) {
            result.stoppedPids.push(pid);
          } else {
            result.failed.push({ pid, message: '停止信号已发送，但进程仍在运行' });
          }
        }
      } catch {
        for (const pid of signaledPids) {
          result.failed.push({ pid, message: '停止信号已发送，但无法复核退出状态' });
        }
      }
    }
    return result;
  }
}
