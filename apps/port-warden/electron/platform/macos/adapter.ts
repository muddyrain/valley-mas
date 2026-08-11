import type { ProcessSnapshot } from '../../../src/shared/domain';
import type { PlatformPortAdapter, PlatformSnapshot } from '../adapter';
import { runFile } from '../run-file';
import { parseMacListeners, parseMacProcessList, parseMacWorkingDirectories } from './parsers';

const chunk = <T>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, index * size + size),
  );

export class MacOsPortAdapter implements PlatformPortAdapter {
  readonly platform = 'darwin' as const;

  private async scanProcesses() {
    const [processes, executables] = await Promise.all([
      runFile('ps', ['-ww', '-axo', 'pid=,ppid=,uid=,lstart=,ucomm=,command=']),
      runFile('ps', ['-ww', '-axo', 'pid=,comm=']),
    ]);
    return parseMacProcessList(processes.stdout, executables.stdout);
  }

  async scan(): Promise<PlatformSnapshot> {
    const [listenerResult, processes] = await Promise.all([
      runFile('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-FpcftnT'], { allowExitCodes: [1] }),
      this.scanProcesses(),
    ]);
    const listeners = parseMacListeners(listenerResult.stdout);
    const listenerPids = [...new Set(listeners.map(({ pid }) => pid))];

    const cwdResults = await Promise.all(
      chunk(listenerPids, 100).map((pids) =>
        runFile('lsof', ['-a', '-d', 'cwd', '-Fn', '-p', pids.join(',')], {
          allowExitCodes: [1],
        }),
      ),
    );
    const directories = new Map<number, string>();
    for (const result of cwdResults) {
      for (const [pid, directory] of parseMacWorkingDirectories(result.stdout)) {
        directories.set(pid, directory);
      }
    }
    for (const [pid, directory] of directories) {
      const process = processes.get(pid);
      if (process) process.workingDirectory = directory;
    }

    const permissionLimited = listeners.some(({ pid }) => {
      const process = processes.get(pid);
      return !process || process.readOnly;
    });
    return {
      listeners,
      processes,
      permissionLimited,
      warning: listenerResult.stderr.trim() || undefined,
    };
  }

  getProcesses(): Promise<Map<number, ProcessSnapshot>> {
    return this.scanProcesses();
  }

  async terminate(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid < 2) throw new Error('无效或受保护的 PID');
    process.kill(pid, 'SIGTERM');
  }
}
