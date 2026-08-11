import type { ProcessSnapshot, RawListener } from '../../../src/shared/domain';

type WindowsConnection = {
  LocalAddress?: unknown;
  LocalPort?: unknown;
  OwningProcess?: unknown;
};

type WindowsProcess = {
  ProcessId?: unknown;
  ParentProcessId?: unknown;
  SessionId?: unknown;
  Name?: unknown;
  ExecutablePath?: unknown;
  CommandLine?: unknown;
  CreationDate?: unknown;
};

const protectedNames = new Set([
  'system',
  'registry',
  'idle',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
]);

const arrayOf = <T>(value: T | T[] | null | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

export function parseWindowsSnapshot(output: string): {
  listeners: RawListener[];
  processes: Map<number, ProcessSnapshot>;
} {
  const parsed = JSON.parse(output) as {
    connections?: WindowsConnection | WindowsConnection[];
    processes?: WindowsProcess | WindowsProcess[];
  };
  const listeners: RawListener[] = [];
  for (const connection of arrayOf(parsed.connections)) {
    const pid = number(connection.OwningProcess);
    const port = number(connection.LocalPort);
    const address = text(connection.LocalAddress);
    if (!pid || !port || port > 65_535 || !address) continue;
    listeners.push({
      pid,
      port,
      address,
      family: address.includes(':') ? 'ipv6' : 'ipv4',
    });
  }

  const processes = new Map<number, ProcessSnapshot>();
  for (const candidate of arrayOf(parsed.processes)) {
    const pid = number(candidate.ProcessId);
    const ppid = number(candidate.ParentProcessId);
    const sessionId = number(candidate.SessionId);
    const name = text(candidate.Name);
    if (pid === undefined || ppid === undefined || !name) continue;
    const commandLine = text(candidate.CommandLine);
    const executablePath = text(candidate.ExecutablePath);
    const startedAt = text(candidate.CreationDate);
    const readOnly =
      pid <= 4 ||
      sessionId === 0 ||
      protectedNames.has(name.toLowerCase()) ||
      !commandLine ||
      !startedAt;
    processes.set(pid, {
      pid,
      ppid,
      name,
      commandLine,
      executablePath,
      startedAt,
      workingDirectory: undefined,
      readOnly,
      readOnlyReason: readOnly ? '系统进程或进程身份信息不完整' : undefined,
    });
  }

  return { listeners, processes };
}
