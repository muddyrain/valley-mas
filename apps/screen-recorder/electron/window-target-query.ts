import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

export type QueryHost = {
  query(): Promise<string>;
  dispose(): void;
};

export class RefreshingQueryCache<T> {
  private hasValue = false;
  private value: T | undefined;
  private updatedAt = 0;
  private refreshPromise: Promise<T> | undefined;

  constructor(
    private readonly query: () => Promise<T>,
    private readonly maxAgeMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  refresh(): Promise<T> {
    if (this.refreshPromise) return this.refreshPromise;
    const refreshPromise = this.query()
      .then((value) => {
        this.value = value;
        this.hasValue = true;
        this.updatedAt = this.now();
        return value;
      })
      .finally(() => {
        if (this.refreshPromise === refreshPromise) this.refreshPromise = undefined;
      });
    this.refreshPromise = refreshPromise;
    return refreshPromise;
  }

  async read(): Promise<T> {
    if (!this.hasValue) return this.refresh();
    if (this.now() - this.updatedAt >= this.maxAgeMs) {
      void this.refresh().catch(() => undefined);
    }
    return this.value as T;
  }

  async readOr(fallback: T): Promise<T> {
    if (!this.hasValue) {
      void this.refresh().catch(() => undefined);
      return fallback;
    }
    return this.read();
  }
}

export class ReusableQueryHost {
  private hostPromise: Promise<QueryHost> | undefined;
  private disposed = false;

  constructor(private readonly startHost: () => Promise<QueryHost> | QueryHost) {}

  private getHost(): Promise<QueryHost> {
    if (this.disposed) return Promise.reject(new Error('窗口查询服务已关闭'));
    this.hostPromise ??= Promise.resolve(this.startHost());
    return this.hostPromise;
  }

  async query(): Promise<string> {
    const activePromise = this.getHost();
    const host = await activePromise;
    try {
      return await host.query();
    } catch (error) {
      if (this.hostPromise === activePromise) this.hostPromise = undefined;
      host.dispose();
      throw error;
    }
  }

  prewarm(): void {
    void this.query().catch(() => undefined);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const activePromise = this.hostPromise;
    this.hostPromise = undefined;
    if (!activePromise) return;
    const host = await activePromise.catch(() => undefined);
    host?.dispose();
  }
}

type PendingQuery = {
  resolve(value: string): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
};

class PowerShellLineQueryHost implements QueryHost {
  private buffer = '';
  private readonly pending: PendingQuery[] = [];
  private failure: Error | undefined;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly timeoutMs: number,
  ) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.accept(chunk));
    child.once('error', (error) => this.fail(error));
    child.once('exit', (code, signal) => {
      const reason = signal || (code === null ? 'unknown' : String(code));
      this.fail(new Error(`窗口查询进程已退出（${reason}）`));
    });
  }

  query(): Promise<string> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const pending: PendingQuery = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.pending.indexOf(pending);
          if (index >= 0) this.pending.splice(index, 1);
          reject(new Error('窗口识别超时'));
        }, this.timeoutMs),
      };
      this.pending.push(pending);
      this.child.stdin.write('query\n', (error) => {
        if (error) this.fail(error);
      });
    });
  }

  dispose(): void {
    this.fail(new Error('窗口查询服务已关闭'));
    if (!this.child.killed) this.child.kill();
  }

  private accept(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      const pending = this.pending.shift();
      if (!pending) continue;
      clearTimeout(pending.timer);
      pending.resolve(line);
    }
  }

  private fail(error: Error): void {
    if (!this.failure) this.failure = error;
    for (const pending of this.pending.splice(0)) {
      clearTimeout(pending.timer);
      pending.reject(this.failure);
    }
  }
}

export function createPowerShellWindowQueryHost(script: string, timeoutMs = 5_000): QueryHost {
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encodedCommand,
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  return new PowerShellLineQueryHost(child, timeoutMs);
}
