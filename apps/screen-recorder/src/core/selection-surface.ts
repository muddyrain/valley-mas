import type { ScreenshotState } from './screenshot-state';

export type SelectionSurfaceMode = 'empty' | 'selection' | 'screenshot-editor';

export function getSelectionSurfaceMode(state: ScreenshotState): SelectionSurfaceMode {
  if (state === 'editing' || state === 'long-capturing') return 'screenshot-editor';
  if (state === 'selecting' || state === 'capturing') return 'selection';
  return 'empty';
}

export function getSelectionSurfaceLayers(
  mode: SelectionSurfaceMode,
  editorReady: boolean,
): { showEditor: boolean; showSelection: boolean } {
  const showEditor = mode === 'screenshot-editor';
  return {
    showEditor,
    showSelection: mode === 'selection' || (showEditor && !editorReady),
  };
}
