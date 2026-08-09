import { useCallback, useEffect, useState } from 'react';
import { ColorPickerOverlay } from './ColorPickerOverlay';
import { getSelectionSurfaceMode } from './core/selection-surface';
import { ScreenshotEditor } from './ScreenshotEditor';
import { SelectionOverlay } from './SelectionOverlay';
import type { RecorderSnapshot } from './shared/contracts';

export function SelectionSurface() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [editorReady, setEditorReady] = useState(false);
  const revealEditor = useCallback(() => setEditorReady(true), []);
  const surfaceMode =
    snapshot?.selectionPurpose === 'recording'
      ? 'selection'
      : getSelectionSurfaceMode(snapshot?.screenshot.state ?? 'idle');
  const isColorPicker = snapshot?.selectionPurpose === 'color-picker';

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  useEffect(() => {
    if (surfaceMode === 'selection') setEditorReady(false);
  }, [surfaceMode]);

  if (!snapshot) return null;
  if (isColorPicker) return <ColorPickerOverlay />;

  return (
    <>
      {surfaceMode === 'selection' && !editorReady && <SelectionOverlay />}
      {surfaceMode === 'screenshot-editor' && (
        <ScreenshotEditor visible={editorReady} onCanvasReady={revealEditor} />
      )}
    </>
  );
}
