import { CheckCircle2, FolderOpen, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getRecordingCompletionView } from './core/completion-view';
import type { RecorderSnapshot } from './shared/contracts';

export function RecordingCompletion() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void window.screenRecorder.getSnapshot().then(setSnapshot);
    return window.screenRecorder.onSnapshot(setSnapshot);
  }, []);

  const view = snapshot ? getRecordingCompletionView(snapshot) : undefined;
  if (!view) return null;

  const openVideo = async () => {
    setError(undefined);
    try {
      await window.screenRecorder.openOutputFile('recording');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法打开视频');
    }
  };

  return (
    <main className="recording-completion-card">
      <button
        type="button"
        className="recording-completion-close"
        aria-label="关闭完成提示"
        onClick={() => void window.screenRecorder.closeCompletion()}
      >
        <X aria-hidden="true" size={18} />
      </button>
      <header>
        <CheckCircle2 aria-hidden="true" size={30} strokeWidth={2} />
        <div>
          <strong>录屏已保存</strong>
          <span>{view.fileName}</span>
        </div>
      </header>
      <code title={view.outputPath}>{view.outputPath}</code>
      <footer>
        <button type="button" onClick={() => void openVideo()}>
          <Play aria-hidden="true" size={17} fill="currentColor" />
          播放视频
        </button>
        <button
          type="button"
          onClick={() => void window.screenRecorder.openOutputFolder('recording')}
        >
          <FolderOpen aria-hidden="true" size={17} />
          打开所在文件夹
        </button>
      </footer>
      {error && <div className="recording-completion-error">{error}</div>}
    </main>
  );
}
