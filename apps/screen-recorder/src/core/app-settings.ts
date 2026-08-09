export type PersistedAppSettings = {
  recordingDirectory?: string;
  notificationsEnabled: boolean;
};

export type LoginItemTarget = {
  path?: string;
  args?: string[];
};

export function getLoginItemTarget(
  platform: NodeJS.Platform,
  isPackaged: boolean,
  executablePath: string,
  applicationPath: string,
): LoginItemTarget {
  if (platform !== 'win32' || isPackaged) return {};
  return { path: executablePath, args: [applicationPath] };
}

export function parsePersistedAppSettings(
  value: unknown,
  isAbsolute: (value: string) => boolean,
): PersistedAppSettings {
  if (!value || typeof value !== 'object') return { notificationsEnabled: false };
  const source = value as Record<string, unknown>;
  const notificationsEnabled = source.notificationsEnabled === true;
  const recordingDirectory = source.recordingDirectory;
  if (
    typeof recordingDirectory !== 'string' ||
    recordingDirectory.length === 0 ||
    recordingDirectory.length > 1024 ||
    recordingDirectory.includes('\0') ||
    !isAbsolute(recordingDirectory)
  ) {
    return { notificationsEnabled };
  }
  return { recordingDirectory, notificationsEnabled };
}
