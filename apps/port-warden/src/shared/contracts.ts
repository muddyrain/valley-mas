import type {
  ProcessTreeContext,
  ScanResult,
  StopExecutionResult,
  StopPlan,
  StopScope,
} from './domain';

export const IPC_CHANNELS = {
  scan: 'port-warden:scan',
  processTree: 'port-warden:process-tree',
  prepareStop: 'port-warden:prepare-stop',
  executeStop: 'port-warden:execute-stop',
  openTarget: 'port-warden:open-target',
  registerProject: 'port-warden:register-project',
} as const;

export type PortWardenApi = {
  scan(): Promise<ScanResult>;
  getProcessTree(pid: number): Promise<ProcessTreeContext>;
  prepareStop(request: { pid: number; scope: StopScope }): Promise<StopPlan>;
  executeStop(request: { planId: string; confirmedPids: number[] }): Promise<StopExecutionResult>;
  openTarget(request: { pid: number; kind: 'project' | 'executable' }): Promise<void>;
  registerProject(pid: number): Promise<{ registered: boolean; path?: string }>;
};
