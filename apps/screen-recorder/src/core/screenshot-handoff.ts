import type { ScreenshotState } from './screenshot-state';

export function canRevealScreenshotEditor(
  state: ScreenshotState,
  activeOperationId: string | undefined,
  requestedOperationId: string,
): boolean {
  return state === 'editing' && activeOperationId === requestedOperationId;
}
