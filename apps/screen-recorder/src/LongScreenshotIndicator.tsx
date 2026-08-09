import { useEffect, useState } from 'react';
import type { RecorderSnapshot } from './shared/contracts';

export function LongScreenshotIndicator() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  const capture = snapshot?.screenshot.longCapture;
  if (!capture || snapshot?.screenshot.state !== 'long-capturing') return null;
  const frame = capture.selectionFrame;
  return (
    <div className="long-screenshot-indicator" aria-hidden="true">
      <div
        className="long-screenshot-selection-frame"
        style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      >
        <span>长截图区域 · {capture.pixelHeight}px</span>
      </div>
    </div>
  );
}
