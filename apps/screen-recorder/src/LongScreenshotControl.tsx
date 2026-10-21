import { Check, CopyCheck, Download, TriangleAlert, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getScreenshotCommand, type ScreenshotOutputAction } from './core/screenshot-command';
import type { RecorderSnapshot } from './shared/contracts';

export function LongScreenshotNotice({ notice }: { notice: string }) {
  return (
    <div className="long-screenshot-notice" role="status" aria-live="polite">
      <TriangleAlert aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{notice}</span>
    </div>
  );
}

export function LongScreenshotControl() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const capture = snapshot?.screenshot.longCapture;
  const previewCount = capture?.previewSlices.length ?? 0;

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  useLayoutEffect(() => {
    if (previewCount < 1) return;
    const preview = previewRef.current;
    if (preview) {
      preview.scrollTop = capture?.latestDirection === 'up' ? 0 : preview.scrollHeight;
    }
  }, [capture?.latestDirection, previewCount]);

  useEffect(
    () => () => {
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    },
    [],
  );

  const finish = async (action: ScreenshotOutputAction) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await window.screenRecorder.finishLongScreenshot(action);
    } catch {
      /* The main process retains the capture and displays its retry notice. */
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = getScreenshotCommand(event, false);
      if (finishingRef.current || event.repeat || !capture) return;
      if (command === 'copy' || command === 'save') {
        event.preventDefault();
        void finish(command);
      }
      if (command === 'cancel') void window.screenRecorder.cancelLongScreenshot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const revealScrollbarWhileScrolling = () => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.classList.add('long-screenshot-preview-scrolling');
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = setTimeout(() => {
      preview.classList.remove('long-screenshot-preview-scrolling');
    }, 500);
  };

  if (!capture) return null;

  return (
    <main
      className="long-screenshot-control"
      onContextMenu={(event) => {
        event.preventDefault();
        if (finishingRef.current) return;
        void window.screenRecorder.cancelLongScreenshot();
      }}
    >
      <section className="long-screenshot-preview" aria-label="长截图实时预览">
        <div
          ref={previewRef}
          className="long-screenshot-preview-scroll"
          onScroll={revealScrollbarWhileScrolling}
        >
          {capture.previewSlices.map((slice, index) => (
            <img
              key={`${index}-${slice.pixelHeight}`}
              src={slice.dataUrl}
              alt=""
              draggable={false}
            />
          ))}
        </div>
      </section>
      {capture.notice && <LongScreenshotNotice notice={capture.notice} />}
      <div className="long-screenshot-actions">
        <button
          type="button"
          className="long-screenshot-cancel"
          title="取消长截图"
          aria-label="取消长截图"
          disabled={finishing}
          onClick={() => void window.screenRecorder.cancelLongScreenshot()}
        >
          <X aria-hidden="true" size={23} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="另存为 PNG（⌘S）"
          aria-label="保存长截图文件"
          disabled={finishing}
          onClick={() => void finish('save')}
        >
          <Download aria-hidden="true" size={23} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="保存到默认目录并复制"
          aria-label="保存并复制长截图"
          disabled={finishing}
          onClick={() => void finish('copy-and-save')}
        >
          <CopyCheck aria-hidden="true" size={23} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="long-screenshot-finish"
          title="复制并完成（Enter / ⌘C）"
          aria-label="完成并复制长截图"
          disabled={finishing}
          onClick={() => void finish('copy')}
        >
          <Check aria-hidden="true" size={25} strokeWidth={2} />
        </button>
      </div>
    </main>
  );
}
