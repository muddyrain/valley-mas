import type { CSSProperties } from 'react';
import {
  FOCUS_DURATIONS,
  FOCUS_LABELS,
  type FocusMode,
  formatTimer,
  useToolStore,
} from '../store/toolStore';
import './MiniApps.css';

const MODES: FocusMode[] = ['work', 'short', 'long'];

export default function FocusTimerWindow() {
  const mode = useToolStore((s) => s.focusMode);
  const status = useToolStore((s) => s.focusStatus);
  const remaining = useToolStore((s) => s.focusRemainingSeconds);
  const duration = useToolStore((s) => s.focusDurationSeconds);
  const completedCount = useToolStore((s) => s.focusCompletedCount);
  const setMode = useToolStore((s) => s.setFocusMode);
  const start = useToolStore((s) => s.startFocusTimer);
  const pause = useToolStore((s) => s.pauseFocusTimer);
  const reset = useToolStore((s) => s.resetFocusTimer);
  const progress = Math.max(0, Math.min(1, 1 - remaining / duration));

  return (
    <div className="dock-app-window mini-app focus-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>专注钟</h2>
        </div>
        <span className="dock-app-window__badge">{statusLabel(status)}</span>
      </header>

      <div
        className="focus-ring"
        style={{ '--focus-progress': `${progress * 360}deg` } as CSSProperties}
      >
        <div className="focus-ring__inner">
          <span>{FOCUS_LABELS[mode]}</span>
          <strong>{formatTimer(remaining)}</strong>
        </div>
      </div>

      <fieldset className="mini-segmented">
        <legend className="mini-app__sr-only">专注模式</legend>
        {MODES.map((item) => (
          <button
            type="button"
            key={item}
            className={item === mode ? 'is-active' : ''}
            onClick={() => setMode(item)}
            disabled={status === 'running'}
          >
            {FOCUS_LABELS[item]}
            <span>{Math.round(FOCUS_DURATIONS[item] / 60)}m</span>
          </button>
        ))}
      </fieldset>

      <div className="mini-actions">
        {status === 'running' ? (
          <button type="button" className="dock-app-window__button" onClick={() => pause()}>
            暂停
          </button>
        ) : (
          <button type="button" className="dock-app-window__button" onClick={start}>
            开始
          </button>
        )}
        <button type="button" className="mini-app__secondary" onClick={() => reset()}>
          重置
        </button>
      </div>

      <section className="mini-app__panel">
        <div className="mini-stat">
          <span>完成次数</span>
          <strong>{completedCount}</strong>
        </div>
      </section>
    </div>
  );
}

function statusLabel(status: 'idle' | 'running' | 'paused') {
  if (status === 'running') return '进行中';
  if (status === 'paused') return '已暂停';
  return '待开始';
}
