import { describe, expect, it, vi } from 'vitest';
import {
  createExecutableWindowQueryHost,
  createPowerShellWindowQueryHost,
  RefreshingQueryCache,
  ReusableQueryHost,
} from './window-target-query';

describe('reusable window target query host', () => {
  it('keeps a native line-query executable responsive across requests', async () => {
    const host = createExecutableWindowQueryHost(process.execPath, [
      '-e',
      "process.stdin.setEncoding('utf8');let value='';process.stdin.on('data',chunk=>{value+=chunk;for(;;){const newline=value.indexOf('\\n');if(newline<0)break;const line=value.slice(0,newline);value=value.slice(newline+1);if(line==='query')process.stdout.write('[]\\n')}})",
    ]);
    try {
      await expect(host.query()).resolves.toBe('[]');
      await expect(host.query()).resolves.toBe('[]');
    } finally {
      host.dispose();
    }
  });

  it.runIf(process.platform === 'win32')(
    'keeps a PowerShell line-query process responsive across requests',
    async () => {
      const host = createPowerShellWindowQueryHost(`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while (($command = [Console]::In.ReadLine()) -ne $null) {
  if ($command -eq 'query') {
    [Console]::Out.WriteLine('[]')
    [Console]::Out.Flush()
  }
}
      `);
      try {
        await expect(host.query()).resolves.toBe('[]');
        await expect(host.query()).resolves.toBe('[]');
      } finally {
        host.dispose();
      }
    },
    15_000,
  );

  it('reuses one warm host across window-selection requests', async () => {
    const query = vi.fn(async () => '[{"id":"wechat"}]');
    const dispose = vi.fn();
    const startHost = vi.fn(async () => ({ query, dispose }));
    const host = new ReusableQueryHost(startHost);

    host.prewarm();
    await Promise.all([host.query(), host.query()]);

    expect(startHost).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(3);
    await host.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('drops a failed host so the next selection can recover with a fresh process', async () => {
    const failedDispose = vi.fn();
    const recoveredDispose = vi.fn();
    const startHost = vi
      .fn()
      .mockResolvedValueOnce({
        query: vi.fn(async () => {
          throw new Error('host exited');
        }),
        dispose: failedDispose,
      })
      .mockResolvedValueOnce({
        query: vi.fn(async () => '[]'),
        dispose: recoveredDispose,
      });
    const host = new ReusableQueryHost(startHost);

    await expect(host.query()).rejects.toThrow('host exited');
    await expect(host.query()).resolves.toBe('[]');

    expect(startHost).toHaveBeenCalledTimes(2);
    expect(failedDispose).toHaveBeenCalledTimes(1);
    await host.dispose();
    expect(recoveredDispose).toHaveBeenCalledTimes(1);
  });

  it('returns the warmed window list immediately while refreshing stale targets in background', async () => {
    let finishRefresh: ((value: string) => void) | undefined;
    const query = vi
      .fn()
      .mockResolvedValueOnce('warm')
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finishRefresh = resolve;
          }),
      );
    let now = 0;
    const cache = new RefreshingQueryCache(query, 500, () => now);
    await cache.refresh();
    now = 600;

    await expect(cache.read()).resolves.toBe('warm');
    expect(query).toHaveBeenCalledTimes(2);
    finishRefresh?.('fresh');
    await expect(cache.refresh()).resolves.toBe('fresh');
    await expect(cache.read()).resolves.toBe('fresh');
  });

  it('does not block the selection overlay while its first background warmup is still running', async () => {
    let finishWarmup: ((value: string) => void) | undefined;
    const query = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishWarmup = resolve;
        }),
    );
    const cache = new RefreshingQueryCache(query, 500);

    await expect(cache.readOr('manual-selection')).resolves.toBe('manual-selection');
    expect(query).toHaveBeenCalledTimes(1);
    finishWarmup?.('windows');
    await expect(cache.refresh()).resolves.toBe('windows');
    await expect(cache.readOr('manual-selection')).resolves.toBe('windows');
  });
});
