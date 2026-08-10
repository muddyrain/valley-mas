import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RecorderSnapshot } from './shared/contracts';

export function LongScreenshotControl() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string>();
  const previewRef = useRef<HTMLDivElement>(null);
  const capture = snapshot?.screenshot.longCapture;
  const previewCount = capture?.previewSlices.length ?? 0;

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  useEffect(() => {
    if (previewCount < 1) return;
    const preview = previewRef.current;
    if (preview) preview.scrollTop = preview.scrollHeight;
  }, [previewCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void window.screenRecorder.cancelLongScreenshot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const finish = async () => {
    setFinishing(true);
    setError(undefined);
    try {
      await window.screenRecorder.finishLongScreenshot();
    } catch (caught) {
      setFinishing(false);
      setError(caught instanceof Error ? caught.message : '无法完成长截图');
    }
  };

  return (
    <main
      className="long-screenshot-control"
      onContextMenu={(event) => {
        event.preventDefault();
        void window.screenRecorder.cancelLongScreenshot();
      }}
    >
      <span className="long-screenshot-capturing-dot" />
      <div className="long-screenshot-summary">
        <strong>长截图捕获中</strong>
        <small>
          {capture ? `${capture.frames} 段 · ${capture.pixelHeight}px · 滚动目标内容` : '正在准备'}
        </small>
      </div>
      <button
        type="button"
        className="long-screenshot-finish"
        title="完成长截图"
        aria-label="完成长截图"
        disabled={finishing}
        onClick={() => void finish()}
      >
        <Check aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        title="取消长截图"
        aria-label="取消长截图"
        onClick={() => void window.screenRecorder.cancelLongScreenshot()}
      >
        <X aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      <section className="long-screenshot-preview" aria-label="长截图实时预览">
        <header>
          <strong>实时预览</strong>
          <span>{capture ? `${capture.pixelHeight}px` : '准备中'}</span>
        </header>
        <div ref={previewRef} className="long-screenshot-preview-scroll">
          {capture?.previewSlices.map((slice, index) => (
            <img
              key={`${index}-${slice.pixelHeight}`}
              src={slice.dataUrl}
              alt=""
              draggable={false}
            />
          ))}
          {!previewCount && <span className="long-screenshot-preview-empty">等待首帧</span>}
        </div>
      </section>
      {(capture?.notice || error) && (
        <div className="long-screenshot-notice">{error || capture?.notice}</div>
      )}
    </main>
  );
}
