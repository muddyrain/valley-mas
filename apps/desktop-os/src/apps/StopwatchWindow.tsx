import { useEffect, useMemo, useState } from 'react';
import { formatTimer, useToolStore } from '../store/toolStore';
import './MiniApps.css';

type StopwatchMode = 'stopwatch' | 'countdown';

const COUNTDOWN_PRESETS = [60, 300, 900];

export default function StopwatchWindow() {
  const records = useToolStore((s) => s.stopwatchRecords);
  const addRecord = useToolStore((s) => s.addStopwatchRecord);
  const clearRecords = useToolStore((s) => s.clearStopwatchRecords);
  const [mode, setMode] = useState<StopwatchMode>('stopwatch');
  const [duration, setDuration] = useState(300);
  const [elapsedBase, setElapsedBase] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [laps, setLaps] = useState<number[]>([]);
  const running = startedAt !== null;
  const elapsed = useMemo(() => {
    if (!startedAt) return elapsedBase;
    return elapsedBase + Math.floor((now - startedAt) / 1000);
  }, [elapsedBase, now, startedAt]);
  const displaySeconds = mode === 'countdown' ? Math.max(0, duration - elapsed) : elapsed;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (mode !== 'countdown' || !running || elapsed < duration) return;
    setStartedAt(null);
    setElapsedBase(duration);
    addRecord('倒计时', duration);
  }, [addRecord, duration, elapsed, mode, running]);

  function start() {
    setStartedAt(Date.now());
    setNow(Date.now());
  }

  function pause() {
    setElapsedBase(elapsed);
    setStartedAt(null);
  }

  function reset(nextMode = mode) {
    setMode(nextMode);
    setElapsedBase(0);
    setStartedAt(null);
    setLaps([]);
    setNow(Date.now());
  }

  function lap() {
    if (displaySeconds <= 0) return;
    setLaps((items) => [displaySeconds, ...items].slice(0, 8));
    addRecord(mode === 'countdown' ? '倒计时' : '秒表', displaySeconds);
  }

  return (
    <div className="dock-app-window mini-app stopwatch-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>秒表</h2>
        </div>
        <span className="dock-app-window__badge">{running ? '计时中' : '已暂停'}</span>
      </header>

      <fieldset className="mini-segmented">
        <legend className="mini-app__sr-only">计时模式</legend>
        <button
          type="button"
          className={mode === 'stopwatch' ? 'is-active' : ''}
          onClick={() => reset('stopwatch')}
        >
          秒表
        </button>
        <button
          type="button"
          className={mode === 'countdown' ? 'is-active' : ''}
          onClick={() => reset('countdown')}
        >
          倒计时
        </button>
      </fieldset>

      {mode === 'countdown' ? (
        <div className="mini-segmented">
          {COUNTDOWN_PRESETS.map((seconds) => (
            <button
              type="button"
              key={seconds}
              className={duration === seconds ? 'is-active' : ''}
              onClick={() => {
                setDuration(seconds);
                reset('countdown');
              }}
            >
              {Math.round(seconds / 60)}m
            </button>
          ))}
        </div>
      ) : null}

      <section className="stopwatch-face">
        <strong>{formatTimer(displaySeconds)}</strong>
      </section>

      <div className="mini-actions">
        {running ? (
          <button type="button" className="dock-app-window__button" onClick={pause}>
            暂停
          </button>
        ) : (
          <button type="button" className="dock-app-window__button" onClick={start}>
            开始
          </button>
        )}
        <button type="button" className="mini-app__secondary" onClick={lap}>
          计次
        </button>
        <button type="button" className="mini-app__secondary" onClick={() => reset()}>
          重置
        </button>
      </div>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>记录</span>
          {records.length > 0 ? (
            <button type="button" className="mini-app__plain" onClick={clearRecords}>
              清除
            </button>
          ) : null}
        </div>
        <div className="mini-list">
          {[
            ...laps.map((seconds, index) => ({
              id: `lap-${seconds}-${index}`,
              label: '计次',
              seconds,
            })),
            ...records,
          ]
            .slice(0, 5)
            .map((item) => (
              <div key={item.id} className="mini-list__row">
                <span>{item.label}</span>
                <strong>{formatTimer(item.seconds)}</strong>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
