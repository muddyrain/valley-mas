import type { RecordingState } from './state-machine';

export function shouldShowRecordingOverlay(
  platform: string,
  state: RecordingState,
  capturePrepared: boolean,
): boolean {
  return (
    platform !== 'darwin' ||
    ((state === 'configuring' || state === 'countdown') && !capturePrepared)
  );
}

export async function hideRecordingOverlaysBeforeCapture(
  platform: string,
  windows: Array<{ isDestroyed(): boolean; hide(): void } | undefined>,
  settle: () => Promise<void>,
): Promise<void> {
  if (platform !== 'darwin') return;
  for (const window of windows) {
    if (window && !window.isDestroyed()) window.hide();
  }
  await settle();
}
