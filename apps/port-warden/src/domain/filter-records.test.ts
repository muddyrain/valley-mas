import { describe, expect, it } from 'vitest';
import type { PortProcessRecord } from '../shared/domain';
import { filterRecords } from './filter-records';

const records: PortProcessRecord[] = [
  {
    key: '42:5173',
    port: 5173,
    addresses: [{ address: '127.0.0.1', family: 'ipv4' }],
    process: {
      pid: 42,
      ppid: 1,
      name: 'node',
      commandLine: 'node apps/dashboard/server.js',
      executablePath: '/usr/local/bin/node',
      startedAt: 'Mon Aug 11 10:00:00 2026',
      workingDirectory: '/work/acme/apps/dashboard',
      readOnly: false,
    },
    project: {
      path: '/work/acme',
      source: 'working-directory',
      confidence: 'exact',
      marker: 'pnpm-workspace.yaml',
    },
  },
];

describe('filterRecords', () => {
  it.each([
    '5173',
    '42',
    'NODE',
    'dashboard/server',
    '/work/acme',
  ])('matches port, PID, process, command or project path: %s', (query) =>
    expect(filterRecords(records, query)).toHaveLength(1));

  it('returns all records for blank text and none for an unrelated query', () => {
    expect(filterRecords(records, '  ')).toEqual(records);
    expect(filterRecords(records, 'postgres')).toEqual([]);
  });
});
