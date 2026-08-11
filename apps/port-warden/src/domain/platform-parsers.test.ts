import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseMacListeners,
  parseMacProcessList,
  parseMacWorkingDirectories,
} from '../../electron/platform/macos/parsers';
import { parseWindowsSnapshot } from '../../electron/platform/windows/parser';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');

describe('macOS platform output', () => {
  it('parses lsof field output and keeps IPv4/IPv6 addresses', () => {
    expect(parseMacListeners(fixture('macos-lsof.txt'))).toEqual([
      { pid: 4100, port: 4310, address: '*', family: 'ipv6' },
      { pid: 4100, port: 4310, address: '127.0.0.1', family: 'ipv4' },
      { pid: 4200, port: 8765, address: '127.0.0.1', family: 'ipv4' },
    ]);
  });

  it('parses one batched ps snapshot and executable lookup', () => {
    const processes = parseMacProcessList(fixture('macos-ps.txt'), fixture('macos-comm.txt'), 501);

    expect(processes.get(4100)).toMatchObject({
      pid: 4100,
      ppid: 4000,
      uid: 501,
      name: 'node',
      executablePath: '/opt/homebrew/bin/node',
      commandLine: '/opt/homebrew/bin/node /Users/mei/work/demo/server.js --port 4310',
      startedAt: 'Mon Aug 11 09:12:01 2026',
      readOnly: false,
    });
  });

  it('keeps stop actions read-only when Port Warden runs as root', () => {
    const processes = parseMacProcessList(fixture('macos-ps.txt'), fixture('macos-comm.txt'), 0);

    expect(processes.get(4100)).toMatchObject({
      readOnly: true,
      readOnlyReason: 'Port Warden 正以 root 身份运行，请使用普通用户重启',
    });
  });

  it('parses cwd values collected in one lsof batch', () => {
    expect(parseMacWorkingDirectories(fixture('macos-cwd.txt'))).toEqual(
      new Map([
        [4100, '/Users/mei/work/demo'],
        [4200, '/Users/mei/work/api'],
      ]),
    );
  });
});

describe('Windows platform JSON', () => {
  it('parses PowerShell JSON without pretending working directories are exact', () => {
    const snapshot = parseWindowsSnapshot(fixture('windows-snapshot.json'));

    expect(snapshot.listeners).toHaveLength(3);
    expect(snapshot.processes.get(9000)).toMatchObject({
      pid: 9000,
      ppid: 8000,
      name: 'node.exe',
      executablePath: 'C:\\Program Files\\nodejs\\node.exe',
      workingDirectory: undefined,
      readOnly: false,
    });
    expect(snapshot.processes.get(9100)).toMatchObject({
      readOnly: true,
      readOnlyReason: '系统进程或进程身份信息不完整',
    });
    expect(snapshot.processes.get(9200)).toMatchObject({
      name: 'custom-service.exe',
      readOnly: true,
      readOnlyReason: '系统进程或进程身份信息不完整',
    });
  });
});
