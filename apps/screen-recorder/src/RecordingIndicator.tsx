import { useEffect, useState } from 'react';
import { getIndicatorFrame, getIndicatorView } from './indicator-view';
import type { RecorderSnapshot } from './shared/contracts';

export function RecordingIndicator() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    if (!snapshot || !['countdown', 'recording'].includes(snapshot.state)) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [snapshot]);

  const view = snapshot ? getIndicatorView(snapshot, now) : undefined;
  const frame = snapshot ? getIndicatorFrame(snapshot) : undefined;
  if (!snapshot || !view || !frame) {
    return null;
  }

  return (
    <div
      className={`recording-indicator recording-indicator-${view.phase} recording-indicator-${frame.mode}`}
      data-recording-mode={frame.mode}
      data-recording-phase={view.phase}
      aria-hidden="true"
    >
      <div
        className="recording-indicator-frame"
        style={{
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        }}
      />
    </div>
  );
}
