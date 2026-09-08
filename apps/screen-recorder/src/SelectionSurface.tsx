import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ColorPickerOverlay } from './ColorPickerOverlay';
import { getSelectionSurfaceLayers, getSelectionSurfaceMode } from './core/selection-surface';
import { ScreenshotEditor } from './ScreenshotEditor';
import { SelectionOverlay } from './SelectionOverlay';
import type { RecorderSnapshot } from './shared/contracts';

export function SelectionSurface() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [editorReady, setEditorReady] = useState(false);
  const [frameImage, setFrameImage] = useState<HTMLImageElement>();
  const backdropRef = useRef<HTMLDivElement>(null);
  const displayIdRef = useRef<string | undefined>(undefined);
  const displayId = snapshot?.selectionDisplay?.id ?? displayIdRef.current;
  displayIdRef.current = displayId;
  const revealEditor = useCallback(() => setEditorReady(true), []);
  const surfaceMode =
    snapshot?.selectionPurpose === 'recording'
      ? 'selection'
      : getSelectionSurfaceMode(snapshot?.screenshot.state ?? 'idle');
  const isColorPicker = snapshot?.selectionPurpose === 'color-picker';
  const selectionPurpose = snapshot?.selectionPurpose === 'recording' ? 'recording' : 'screenshot';
  const readyToEdit = editorReady && Boolean(frameImage);
  const layers = getSelectionSurfaceLayers(surfaceMode, readyToEdit);

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  useEffect(() => {
    if (surfaceMode === 'selection') setEditorReady(false);
  }, [surfaceMode]);

  useLayoutEffect(() => {
    if (!displayId) return;
    setFrameImage(undefined);
    backdropRef.current?.replaceChildren();
  }, [displayId]);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop || !frameImage || surfaceMode === 'empty') return;
    // Mount the decoded image itself so handoff never downloads/rasterizes a second full screen.
    if (backdrop.firstChild !== frameImage) backdrop.replaceChildren(frameImage);
  }, [frameImage, surfaceMode]);

  if (!snapshot) return null;
  if (isColorPicker) return <ColorPickerOverlay />;

  return (
    <>
      {surfaceMode !== 'empty' && <div ref={backdropRef} />}
      {layers.showSelection && (
        <SelectionOverlay
          interactive={surfaceMode === 'selection'}
          purpose={selectionPurpose}
          displayId={displayId}
          onFrameReady={setFrameImage}
        />
      )}
      {layers.showEditor && (
        <ScreenshotEditor
          visible={readyToEdit}
          onCanvasReady={revealEditor}
          sharedBackdrop
          onImageReady={setFrameImage}
        />
      )}
    </>
  );
}
