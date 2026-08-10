import { CheckCircle2, ExternalLink, FolderOpen, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RecorderSnapshot } from './shared/contracts';

export function ScreenshotCompletion() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  const path = snapshot?.screenshot.outputPath;
  const preview = snapshot?.completion?.previewDataUrl;
  if (!path || snapshot?.completion?.kind !== 'screenshot') return null;

  const openScreenshot = async () => {
    setError(undefined);
    try {
      await window.screenRecorder.openOutputFile('screenshot');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法打开截图');
    }
  };

  return (
    <main className="screenshot-completion-card">
      <button
        type="button"
        className="screenshot-completion-close"
        aria-label="关闭截图结果"
        onClick={() => void window.screenRecorder.closeCompletion()}
      >
        <X aria-hidden="true" size={18} />
      </button>
      <header>
        <CheckCircle2 aria-hidden="true" size={28} strokeWidth={2} />
        <div>
          <strong>长截图已保存</strong>
          <span>{path.split(/[\\/]/).at(-1)}</span>
        </div>
      </header>
      {preview && <img src={preview} alt="长截图完整预览" />}
      <code title={path}>{path}</code>
      <footer>
        <button type="button" onClick={() => void openScreenshot()}>
          <ExternalLink aria-hidden="true" size={17} />
          打开截图
        </button>
        <button
          type="button"
          onClick={() => void window.screenRecorder.openOutputFolder('screenshot')}
        >
          <FolderOpen aria-hidden="true" size={17} />
          打开所在文件夹
        </button>
      </footer>
      {error && <div className="screenshot-completion-error">{error}</div>}
    </main>
  );
}
