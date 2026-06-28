import type { FocusStatus } from '../store/toolStore';

export function shouldRunMusicRuntime({
  runtimeEnabled,
  isMusicWindowRunning,
  isPlaying,
  isBuffering,
}: {
  runtimeEnabled: boolean;
  isMusicWindowRunning: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
}) {
  return runtimeEnabled && (isMusicWindowRunning || isPlaying || isBuffering);
}

export function shouldRunFocusTimerRuntime({
  isFocusWindowRunning,
  focusStatus,
  hasPendingCompletion,
}: {
  isFocusWindowRunning: boolean;
  focusStatus: FocusStatus;
  hasPendingCompletion: boolean;
}) {
  return isFocusWindowRunning || focusStatus === 'running' || hasPendingCompletion;
}
