export type ScreenCapturePermissionStatus =
  | 'not-determined'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unknown';

export function createSingleFlightScreenCapturePermissionRequest(
  requestPermission: () => Promise<void>,
): () => Promise<void> {
  let activeRequest: Promise<void> | undefined;
  return () => {
    if (activeRequest) return activeRequest;
    const request = requestPermission().finally(() => {
      if (activeRequest === request) activeRequest = undefined;
    });
    activeRequest = request;
    return request;
  };
}

export function resolveScreenCapturePermissionStatus(
  platform: string,
  reportedStatus: ScreenCapturePermissionStatus,
  nativeCaptureVerified: boolean,
): ScreenCapturePermissionStatus {
  if (platform !== 'darwin') return 'granted';
  if (reportedStatus === 'denied' || reportedStatus === 'restricted') return reportedStatus;
  return nativeCaptureVerified ? 'granted' : reportedStatus;
}

export function shouldOfferScreenCapturePermissionRecovery(
  platform: string,
  status: ScreenCapturePermissionStatus,
): boolean {
  return platform === 'darwin' && status !== 'granted';
}

export type ScreenCapturePermissionRecoveryAction = 'request' | 'settings';

export function getScreenCapturePermissionRecoveryAction(
  platform: string,
  status: ScreenCapturePermissionStatus,
): ScreenCapturePermissionRecoveryAction | undefined {
  if (platform !== 'darwin' || status === 'granted') return undefined;
  return status === 'denied' || status === 'restricted' ? 'settings' : 'request';
}

type ScreenCapturePermissionRequest = {
  platform: string;
  getStatus(): ScreenCapturePermissionStatus;
  requestPermission(): Promise<void>;
};

export async function requestScreenCapturePermissionStatus({
  platform,
  getStatus,
  requestPermission,
}: ScreenCapturePermissionRequest): Promise<ScreenCapturePermissionStatus> {
  if (platform !== 'darwin') return 'granted';

  const status = getStatus();
  if (status === 'granted' || status === 'restricted') return status;
  try {
    await requestPermission();
  } catch {
    return getStatus();
  }
  return getStatus();
}

type ScreenCapturePermissionGate<T> = {
  platform: string;
  getStatus(): ScreenCapturePermissionStatus;
  requestPermission(): Promise<void>;
  deniedMessage: string;
  run(): T | Promise<T>;
};

export async function runAfterScreenCapturePermission<T>({
  platform,
  getStatus,
  requestPermission,
  deniedMessage,
  run,
}: ScreenCapturePermissionGate<T>): Promise<T> {
  if (platform !== 'darwin') return run();

  const status = getStatus();
  if (status === 'granted') return run();
  if (status === 'restricted') throw new Error(deniedMessage);

  try {
    await requestPermission();
  } catch {
    throw new Error(deniedMessage);
  }
  if (getStatus() !== 'granted') throw new Error(deniedMessage);
  return run();
}
