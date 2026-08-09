import { CircleStop, Download, Video } from 'lucide-react';
import type { RecordingState } from '../core/recording';

interface RecordingControlsProps {
  supported: boolean;
  state: RecordingState;
  includesAudio: boolean;
  fileName: string;
  onStart: () => void;
  onStop: () => void;
}

export function RecordingControls({
  supported,
  state,
  includesAudio,
  fileName,
  onStart,
  onStop,
}: RecordingControlsProps) {
  const remaining = Math.max(0, Math.ceil(state.durationSeconds - state.elapsedSeconds));
  return (
    <section className="panel-section" aria-labelledby="recording-heading">
      <div className="section-heading">
        <Video size={15} aria-hidden="true" />
        <h2 id="recording-heading">导出 WebM</h2>
      </div>
      {state.status === 'recording' ? (
        <div className="recording-live" role="status">
          <span className="record-dot" />
          <span>录制中 · {remaining} 秒</span>
          <button type="button" className="compact-button" onClick={onStop}>
            <CircleStop size={15} aria-hidden="true" />
            停止
          </button>
        </div>
      ) : (
        <button type="button" className="wide-button" disabled={!supported} onClick={onStart}>
          <Video size={16} aria-hidden="true" />
          录制 10 秒
        </button>
      )}
      {!supported ? <p className="support-note">当前浏览器不支持 Canvas WebM 录制。</p> : null}
      {state.status === 'recording' ? (
        <p className="support-note">
          {includesAudio ? '本次导出包含当前音乐与环境声。' : '本次导出不含声音。'}
        </p>
      ) : null}
      {state.status === 'ready' && state.downloadUrl ? (
        <a className="download-link" href={state.downloadUrl} download={fileName}>
          <Download size={16} aria-hidden="true" />
          下载 {includesAudio ? '有声' : '无声'} WebM
        </a>
      ) : null}
      {state.error ? <p className="inline-error">{state.error}</p> : null}
    </section>
  );
}
