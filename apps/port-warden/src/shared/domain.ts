export type SupportedPlatform = 'darwin' | 'win32';

export type AddressFamily = 'ipv4' | 'ipv6' | 'unknown';

export type RawListener = {
  pid: number;
  port: number;
  address: string;
  family: AddressFamily;
};

export type ProjectSource = 'registered' | 'working-directory' | 'command-line' | 'unknown';

export type ProjectConfidence = 'exact' | 'inferred' | 'unknown';

export type ProjectAttribution = {
  path?: string;
  source: ProjectSource;
  confidence: ProjectConfidence;
  marker?: string;
};

export type ProcessSnapshot = {
  pid: number;
  ppid: number;
  uid?: number;
  name: string;
  commandLine?: string;
  executablePath?: string;
  startedAt?: string;
  workingDirectory?: string;
  readOnly: boolean;
  readOnlyReason?: string;
};

export type ProcessIdentity = Pick<
  ProcessSnapshot,
  'pid' | 'name' | 'commandLine' | 'executablePath' | 'startedAt'
>;

export type PortProcessRecord = {
  key: string;
  port: number;
  addresses: Array<{ address: string; family: AddressFamily }>;
  process: ProcessSnapshot;
  project: ProjectAttribution;
};

export type ProcessTreeNode = {
  process: ProcessSnapshot;
  children: ProcessTreeNode[];
};

export type ProcessTreeContext = {
  ancestors: ProcessSnapshot[];
  root?: ProcessTreeNode;
};

export type ScanChange = {
  key: string;
  port: number;
  pid: number;
  processName: string;
};

export type ScanResult = {
  platform: SupportedPlatform | 'unsupported';
  scannedAt: string;
  records: PortProcessRecord[];
  opened: ScanChange[];
  closed: ScanChange[];
  permissionLimited: boolean;
  warning?: string;
};

export type StopScope = 'process' | 'tree';

export type StopPlan = {
  id: string;
  scope: StopScope;
  expiresAt: string;
  targetProcesses: ProcessSnapshot[];
};

export type StopExecutionResult = {
  stoppedPids: number[];
  alreadyExitedPids: number[];
  failed: Array<{ pid: number; message: string }>;
};
