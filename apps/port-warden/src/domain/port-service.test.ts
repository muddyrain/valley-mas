import { describe, expect, it } from 'vitest';
import type { PlatformPortAdapter, PlatformSnapshot } from '../../electron/platform/adapter';
import { PortService } from '../../electron/services/port-service';
import type { ProcessSnapshot } from '../shared/domain';

const process = (pid: number, name: string): ProcessSnapshot => ({
  pid,
  ppid: 1,
  name,
  commandLine: `/usr/local/bin/${name} /work/${name}/server.js`,
  executablePath: `/usr/local/bin/${name}`,
  startedAt: `Mon Aug 11 10:00:0${pid} 2026`,
  workingDirectory: `/work/${name}`,
  readOnly: false,
});

describe('PortService scan changes', () => {
  it('establishes a baseline, then reports opened and released ports', async () => {
    const snapshots: PlatformSnapshot[] = [
      {
        listeners: [{ pid: 10, port: 3000, address: '127.0.0.1', family: 'ipv4' }],
        processes: new Map([[10, process(10, 'api')]]),
        permissionLimited: false,
      },
      {
        listeners: [
          { pid: 10, port: 3000, address: '127.0.0.1', family: 'ipv4' },
          { pid: 11, port: 5173, address: '::', family: 'ipv6' },
        ],
        processes: new Map([
          [10, process(10, 'api')],
          [11, process(11, 'web')],
        ]),
        permissionLimited: false,
      },
      {
        listeners: [{ pid: 11, port: 5173, address: '::', family: 'ipv6' }],
        processes: new Map([[11, process(11, 'web')]]),
        permissionLimited: false,
      },
    ];
    let index = 0;
    const adapter: PlatformPortAdapter = {
      platform: 'darwin',
      scan: async () => snapshots[Math.min(index++, snapshots.length - 1)] as PlatformSnapshot,
      getProcesses: async () => snapshots[Math.max(0, index - 1)]?.processes ?? new Map(),
      terminate: async () => undefined,
    };
    const service = new PortService(adapter, {
      files: { exists: (path) => path.endsWith('package.json') },
      now: () => new Date('2026-08-11T03:00:00.000Z'),
    });

    const baseline = await service.scan();
    const added = await service.scan();
    const released = await service.scan();

    expect(baseline.opened).toEqual([]);
    expect(baseline.closed).toEqual([]);
    expect(added.opened).toEqual([{ key: '11:5173', port: 5173, pid: 11, processName: 'web' }]);
    expect(released.closed).toEqual([{ key: '10:3000', port: 3000, pid: 10, processName: 'api' }]);
  });

  it('resolves only paths from the confirmed latest snapshot', async () => {
    const snapshot: PlatformSnapshot = {
      listeners: [{ pid: 10, port: 3000, address: '127.0.0.1', family: 'ipv4' }],
      processes: new Map([[10, process(10, 'api')]]),
      permissionLimited: false,
    };
    const adapter: PlatformPortAdapter = {
      platform: 'darwin',
      scan: async () => snapshot,
      getProcesses: async () => snapshot.processes,
      terminate: async () => undefined,
    };
    const service = new PortService(adapter, {
      files: { exists: (path) => path === '/work/api/package.json' },
    });
    await service.scan();

    expect(service.resolveOpenTarget(10, 'project')).toBe('/work/api');
    expect(service.resolveOpenTarget(10, 'executable')).toBe('/usr/local/bin');
    expect(() => service.resolveOpenTarget(999, 'project')).toThrow('当前扫描');
  });
});
