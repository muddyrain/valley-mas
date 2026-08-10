import { useEffect, useState } from 'react';
import { getIndicatorView } from './indicator-view';
import type { RecorderSnapshot } from './shared/contracts';

export function RecordingControl() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string>();

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
  if (!snapshot || !view) {
    return null;
  }

  const buttonLabel =
    snapshot.state === 'countdown'
      ? '取消'
      : snapshot.state === 'recording'
        ? '停止录制'
        : '正在保存';

  const stop = async () => {
    setError(undefined);
    try {
      await window.screenRecorder.stop();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法停止录制');
    }
  };

  return (
    <div className={`recording-control recording-control-${view.phase}`} aria-live="polite">
      <span className="recording-control-dot" />
      <div className="recording-control-status">
        <span>{view.label}</span>
        <strong>{view.elapsed}</strong>
      </div>
      <button type="button" disabled={snapshot.state === 'stopping'} onClick={() => void stop()}>
        {buttonLabel}
      </button>
      {error && <span className="recording-control-error">{error}</span>}
    </div>
  );
}
