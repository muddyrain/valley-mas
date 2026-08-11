import type { PortWardenApi } from '../shared/contracts';
import type { PortProcessRecord, ProcessSnapshot } from '../shared/domain';

const process = (
  pid: number,
  ppid: number,
  name: string,
  commandLine: string,
  readOnly = false,
): ProcessSnapshot => ({
  pid,
  ppid,
  name,
  commandLine,
  executablePath: name === 'postgres' ? '/usr/local/bin/postgres' : '/opt/homebrew/bin/node',
  startedAt: 'Mon Aug 11 14:21:08 2026',
  workingDirectory: readOnly ? undefined : '/Users/dev/workspace/atlas/apps/web',
  readOnly,
  readOnlyReason: readOnly ? '进程属于其他用户或权限不足' : undefined,
});

const node = process(
  48112,
  47990,
  'node',
  '/opt/homebrew/bin/node /Users/dev/workspace/atlas/node_modules/vite/bin/vite.js --port 5173',
);
const api = process(
  48203,
  47990,
  'node',
  '/opt/homebrew/bin/node /Users/dev/workspace/atlas/apps/api/server.js --port 8080',
);
const postgres = process(
  933,
  1,
  'postgres',
  '/usr/local/bin/postgres -D /usr/local/var/postgres',
  true,
);

const records: PortProcessRecord[] = [
  {
    key: '48112:5173',
    port: 5173,
    addresses: [
      { address: '127.0.0.1', family: 'ipv4' },
      { address: '::1', family: 'ipv6' },
    ],
    process: node,
    project: {
      path: '/Users/dev/workspace/atlas',
      source: 'working-directory',
      confidence: 'exact',
      marker: 'pnpm-workspace.yaml',
    },
  },
  {
    key: '48203:8080',
    port: 8080,
    addresses: [{ address: '*', family: 'ipv6' }],
    process: api,
    project: {
      path: '/Users/dev/workspace/atlas',
      source: 'working-directory',
      confidence: 'exact',
      marker: 'pnpm-workspace.yaml',
    },
  },
  {
    key: '933:5432',
    port: 5432,
    addresses: [{ address: '127.0.0.1', family: 'ipv4' }],
    process: postgres,
    project: { source: 'unknown', confidence: 'unknown' },
  },
];

export function installMockApi() {
  const mock: PortWardenApi = {
    scan: async () => ({
      platform: 'darwin',
      scannedAt: new Date().toISOString(),
      records,
      opened: [],
      closed: [],
      permissionLimited: true,
    }),
    getProcessTree: async (pid) => ({
      ancestors: [process(47990, 1, 'zsh', '-zsh')],
      root: {
        process: records.find((record) => record.process.pid === pid)?.process ?? node,
        children: pid === node.pid ? [{ process: api, children: [] }] : [],
      },
    }),
    prepareStop: async ({ pid, scope }) => ({
      id: 'mock-stop-plan',
      scope,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      targetProcesses: scope === 'tree' && pid === node.pid ? [api, node] : [node],
    }),
    executeStop: async ({ confirmedPids }) => ({
      stoppedPids: confirmedPids,
      alreadyExitedPids: [],
      failed: [],
    }),
    openTarget: async () => undefined,
    registerProject: async () => ({ registered: true, path: '/Users/dev/workspace/atlas' }),
  };
  window.portWarden = mock;
}
