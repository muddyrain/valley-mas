import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function PinnedScreenshot() {
  const [dataUrl, setDataUrl] = useState<string>();
  const [error, setError] = useState<string>();

  const closePinnedScreenshot = useCallback(() => {
    void window.screenRecorder
      .closePinnedScreenshot()
      .catch((caught) => setError(caught instanceof Error ? caught.message : '无法关闭固定图片'));
  }, []);

  useEffect(() => {
    void window.screenRecorder
      .getPinnedScreenshot()
      .then((pinned) => setDataUrl(pinned.dataUrl))
      .catch((caught) => setError(caught instanceof Error ? caught.message : '无法显示固定图片'));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePinnedScreenshot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePinnedScreenshot]);

  return (
    <main className="pinned-screenshot">
      <div className="pinned-screenshot-surface">
        {dataUrl ? (
          <img src={dataUrl} alt="固定截图" draggable={false} />
        ) : (
          <span>{error || '…'}</span>
        )}
        <button
          type="button"
          className="pinned-screenshot-close"
          aria-label="关闭固定图片"
          title="关闭"
          onClick={closePinnedScreenshot}
        >
          <X aria-hidden="true" size={16} strokeWidth={2} />
        </button>
      </div>
    </main>
  );
}
