import type { ProcessSnapshot } from '../../../src/shared/domain';
import type { PlatformPortAdapter, PlatformSnapshot } from '../adapter';
import { runFile } from '../run-file';
import { parseWindowsSnapshot } from './parser';

export const WINDOWS_SNAPSHOT_SCRIPT = `
$ErrorActionPreference = 'Stop'
$connections = @(Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess)
$processes = @(Get-CimInstance Win32_Process | ForEach-Object {
  [PSCustomObject]@{
    ProcessId = $_.ProcessId
    ParentProcessId = $_.ParentProcessId
    SessionId = $_.SessionId
    Name = $_.Name
    ExecutablePath = $_.ExecutablePath
    CommandLine = $_.CommandLine
    CreationDate = if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { $null }
  }
})
[PSCustomObject]@{ connections = $connections; processes = $processes } | ConvertTo-Json -Depth 4 -Compress
`.trim();

export class WindowsPortAdapter implements PlatformPortAdapter {
  readonly platform = 'win32' as const;

  private async snapshot(): Promise<PlatformSnapshot> {
    const result = await runFile('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      WINDOWS_SNAPSHOT_SCRIPT,
    ]);
    const snapshot = parseWindowsSnapshot(result.stdout);
    return {
      ...snapshot,
      permissionLimited: snapshot.listeners.some(({ pid }) => {
        const process = snapshot.processes.get(pid);
        return !process || process.readOnly;
      }),
      warning: result.stderr.trim() || undefined,
    };
  }

  scan(): Promise<PlatformSnapshot> {
    return this.snapshot();
  }

  async getProcesses(): Promise<Map<number, ProcessSnapshot>> {
    return (await this.snapshot()).processes;
  }

  async terminate(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid < 5) throw new Error('无效或受保护的 PID');
    process.kill(pid);
  }
}
