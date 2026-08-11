import type { ProcessSnapshot, RawListener } from '../../../src/shared/domain';

const processLinePattern =
  /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(\S+)\s*(.*)$/;

export function parseMacListeners(output: string): RawListener[] {
  const listeners: RawListener[] = [];
  let pid: number | undefined;
  let family: RawListener['family'] = 'unknown';

  for (const line of output.split(/\r?\n/)) {
    const field = line[0];
    const value = line.slice(1);
    if (field === 'p') pid = Number(value);
    else if (field === 't') {
      family = value === 'IPv4' ? 'ipv4' : value === 'IPv6' ? 'ipv6' : 'unknown';
    } else if (field === 'n' && pid !== undefined) {
      const delimiter = value.lastIndexOf(':');
      const port = Number(value.slice(delimiter + 1));
      if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) continue;
      const address = value.slice(0, delimiter).replace(/^\[/, '').replace(/\]$/, '') || '*';
      listeners.push({ pid, port, address, family });
    }
  }

  return listeners;
}

function parseExecutables(output: string) {
  const executables = new Map<number, string>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (match) executables.set(Number(match[1]), match[2].trim());
  }
  return executables;
}

export function parseMacProcessList(
  output: string,
  executableOutput: string,
  currentUid = typeof process.getuid === 'function' ? process.getuid() : undefined,
): Map<number, ProcessSnapshot> {
  const executables = parseExecutables(executableOutput);
  const processes = new Map<number, ProcessSnapshot>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(processLinePattern);
    if (!match) continue;
    const [, pidText, ppidText, uidText, startedAt, name, commandLine] = match;
    const pid = Number(pidText);
    const uid = Number(uidText);
    const readOnly =
      pid <= 1 ||
      currentUid === undefined ||
      currentUid === 0 ||
      uid !== currentUid ||
      !commandLine ||
      !startedAt;
    processes.set(pid, {
      pid,
      ppid: Number(ppidText),
      uid,
      name,
      commandLine: commandLine || undefined,
      executablePath: executables.get(pid),
      startedAt,
      readOnly,
      readOnlyReason: readOnly
        ? pid <= 1
          ? '系统进程'
          : currentUid === 0
            ? 'Port Warden 正以 root 身份运行，请使用普通用户重启'
            : uid !== currentUid
              ? '进程属于其他用户或权限不足'
              : '进程身份信息不完整'
        : undefined,
    });
  }
  return processes;
}

export function parseMacWorkingDirectories(output: string) {
  const directories = new Map<number, string>();
  let pid: number | undefined;
  let cwdRecord = false;

  for (const line of output.split(/\r?\n/)) {
    const field = line[0];
    const value = line.slice(1);
    if (field === 'p') {
      pid = Number(value);
      cwdRecord = false;
    } else if (field === 'f') cwdRecord = value === 'cwd';
    else if (field === 'n' && cwdRecord && pid !== undefined && value) directories.set(pid, value);
  }
  return directories;
}
