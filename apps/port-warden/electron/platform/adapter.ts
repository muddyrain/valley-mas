import type { ProcessSnapshot, RawListener, SupportedPlatform } from '../../src/shared/domain';

export type PlatformSnapshot = {
  listeners: RawListener[];
  processes: Map<number, ProcessSnapshot>;
  permissionLimited: boolean;
  warning?: string;
};

export interface PlatformPortAdapter {
  readonly platform: SupportedPlatform;
  scan(): Promise<PlatformSnapshot>;
  getProcesses(): Promise<Map<number, ProcessSnapshot>>;
  terminate(pid: number): Promise<void>;
}
