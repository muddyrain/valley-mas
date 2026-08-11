import { describe, expect, it } from 'vitest';
import type { ProcessSnapshot, RawListener } from '../shared/domain';
import { mergeListeners } from './listeners';

const process: ProcessSnapshot = {
  pid: 42,
  ppid: 1,
  name: 'node',
  commandLine: 'node server.js',
  executablePath: '/usr/local/bin/node',
  startedAt: '2026-08-11T01:00:00.000Z',
  readOnly: false,
};

describe('mergeListeners', () => {
  it('merges IPv4/IPv6 duplicates by PID and port while retaining raw addresses', () => {
    const listeners: RawListener[] = [
      { pid: 42, port: 5173, address: '*', family: 'ipv6' },
      { pid: 42, port: 5173, address: '0.0.0.0', family: 'ipv4' },
      { pid: 42, port: 5174, address: '127.0.0.1', family: 'ipv4' },
    ];

    const merged = mergeListeners(listeners, new Map([[42, process]]));

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ key: '42:5173', pid: 42, port: 5173 });
    expect(merged[0]?.addresses).toEqual([
      { address: '*', family: 'ipv6' },
      { address: '0.0.0.0', family: 'ipv4' },
    ]);
  });
});
