import { existsSync } from 'node:fs';
import path from 'node:path';
import { mergeListeners } from '../../src/domain/listeners';
import { buildProcessTree } from '../../src/domain/process-tree';
import { resolveProjectAttribution } from '../../src/domain/project-attribution';
import { StopCoordinator } from '../../src/domain/stop-coordinator';
import type {
  ProcessIdentity,
  ProcessSnapshot,
  ProcessTreeContext,
  ScanChange,
  ScanResult,
  StopExecutionResult,
  StopPlan,
  StopScope,
} from '../../src/shared/domain';
import type { PlatformPortAdapter } from '../platform/adapter';

type PortServiceOptions = {
  files?: { exists(path: string): boolean };
  registeredPaths?: string[];
  now?: () => Date;
};

export type OpenTargetKind = 'project' | 'executable';

const changeOf = (record: ScanResult['records'][number]): ScanChange => ({
  key: record.key,
  port: record.port,
  pid: record.process.pid,
  processName: record.process.name,
});

const identityOf = (process: ProcessSnapshot): ProcessIdentity => ({
  pid: process.pid,
  name: process.name,
  commandLine: process.commandLine,
  executablePath: process.executablePath,
  startedAt: process.startedAt,
});

export class PortService {
  private readonly files: { exists(path: string): boolean };
  private readonly registeredPaths: string[];
  private readonly now: () => Date;
  private readonly stopCoordinator?: StopCoordinator;
  private previousRecords?: Map<string, ScanResult['records'][number]>;
  private latestRecords = new Map<string, ScanResult['records'][number]>();
  private latestProcesses = new Map<number, ProcessSnapshot>();

  constructor(
    private readonly adapter: PlatformPortAdapter | undefined,
    options: PortServiceOptions = {},
  ) {
    this.files = options.files ?? { exists: existsSync };
    this.registeredPaths = options.registeredPaths ?? [];
    this.now = options.now ?? (() => new Date());
    if (adapter) {
      this.stopCoordinator = new StopCoordinator({
        getProcesses: () => adapter.getProcesses(),
        terminate: (pid) => adapter.terminate(pid),
        now: this.now,
      });
    }
  }

  async scan(): Promise<ScanResult> {
    if (!this.adapter) {
      return {
        platform: 'unsupported',
        scannedAt: this.now().toISOString(),
        records: [],
        opened: [],
        closed: [],
        permissionLimited: true,
        warning: 'Port Warden 目前仅支持 macOS 13+ 和 Windows 10/11 64 位',
      };
    }

    const snapshot = await this.adapter.scan();
    const records = mergeListeners(snapshot.listeners, snapshot.processes).map((listener) => ({
      key: listener.key,
      port: listener.port,
      addresses: listener.addresses,
      process: listener.process,
      project: resolveProjectAttribution(
        {
          platform: this.adapter?.platform ?? 'darwin',
          registeredPaths: this.registeredPaths,
          workingDirectory: listener.process.workingDirectory,
          commandLine: listener.process.commandLine,
          executablePath: listener.process.executablePath,
        },
        this.files,
      ),
    }));
    const current = new Map(records.map((record) => [record.key, record]));
    const opened = this.previousRecords
      ? records.filter(({ key }) => !this.previousRecords?.has(key)).map(changeOf)
      : [];
    const closed = this.previousRecords
      ? [...this.previousRecords.values()].filter(({ key }) => !current.has(key)).map(changeOf)
      : [];

    this.previousRecords = current;
    this.latestRecords = current;
    this.latestProcesses = snapshot.processes;
    return {
      platform: this.adapter.platform,
      scannedAt: this.now().toISOString(),
      records,
      opened,
      closed,
      permissionLimited: snapshot.permissionLimited,
      warning: snapshot.warning,
    };
  }

  getProcessTree(pid: number): ProcessTreeContext {
    const ancestors: ProcessSnapshot[] = [];
    const visited = new Set<number>([pid]);
    let current = this.latestProcesses.get(pid);
    while (current && current.ppid > 0 && !visited.has(current.ppid)) {
      const parent = this.latestProcesses.get(current.ppid);
      if (!parent) break;
      ancestors.unshift(parent);
      visited.add(parent.pid);
      current = parent;
    }
    return { ancestors, root: buildProcessTree(pid, this.latestProcesses) };
  }

  async prepareStop(pid: number, scope: StopScope): Promise<StopPlan> {
    const process = [...this.latestRecords.values()].find(
      (record) => record.process.pid === pid,
    )?.process;
    if (!process) throw new Error('该 PID 不在当前扫描结果中，请先刷新');
    if (!this.stopCoordinator) throw new Error('当前平台不支持停止进程');
    return await this.stopCoordinator.prepare(identityOf(process), scope);
  }

  async executeStop(planId: string, confirmedPids: number[]): Promise<StopExecutionResult> {
    if (!this.stopCoordinator) throw new Error('当前平台不支持停止进程');
    return await this.stopCoordinator.execute(planId, confirmedPids);
  }

  addRegisteredPath(projectPath: string) {
    const normalized = path.normalize(projectPath);
    const index = this.registeredPaths.findIndex(
      (candidate) => path.normalize(candidate) === normalized,
    );
    if (index >= 0) this.registeredPaths.splice(index, 1);
    this.registeredPaths.unshift(normalized);
  }

  resolveRegistrationDefault(pid: number): string | undefined {
    const record = [...this.latestRecords.values()].find(
      (candidate) => candidate.process.pid === pid,
    );
    if (!record) throw new Error('该 PID 不在当前扫描结果中，请先刷新');
    if (record.project.path) return record.project.path;
    if (record.process.workingDirectory) return record.process.workingDirectory;
    if (record.process.executablePath) {
      const tools = this.adapter?.platform === 'win32' ? path.win32 : path.posix;
      return tools.dirname(record.process.executablePath);
    }
    return undefined;
  }

  resolveOpenTarget(pid: number, kind: OpenTargetKind): string {
    const record = [...this.latestRecords.values()].find(
      (candidate) => candidate.process.pid === pid,
    );
    if (!record) throw new Error('该 PID 不在当前扫描结果中，请先刷新');

    if (kind === 'project') {
      if (!record.project.path) throw new Error('当前无法确认该进程的项目目录');
      return record.project.path;
    }

    const executable = record.process.executablePath;
    if (!executable) throw new Error('当前无法确认该进程的可执行文件');
    const tools = this.adapter?.platform === 'win32' ? path.win32 : path.posix;
    return tools.dirname(executable);
  }
}
