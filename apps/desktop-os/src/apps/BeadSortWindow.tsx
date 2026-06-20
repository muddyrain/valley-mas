import { useEffect, useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { formatTimer, useToolStore } from '../store/toolStore';
import {
  BEAD_CAPACITY,
  BEAD_LABELS,
  type BeadTube,
  createBeadPuzzle,
  isBeadPuzzleComplete,
  moveBead,
} from '../tools/miniGamesV2';
import './MiniApps.css';

export default function BeadSortWindow() {
  const [tubes, setTubes] = useState<BeadTube[]>(() => createBeadPuzzle());
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [reported, setReported] = useState(false);
  const best = useToolStore((s) => s.beadSortBest);
  const recordBest = useToolStore((s) => s.recordBeadSortBest);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const complete = isBeadPuzzleComplete(tubes);
  const seconds = Math.floor((now - startedAt) / 1000);

  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [complete]);

  useEffect(() => {
    if (!complete || moves === 0 || reported) return;
    setReported(true);
    recordBest(moves, seconds);
    pushNotification({
      app: '色珠整理',
      title: '整理完成',
      body: `${moves} 步 · ${formatTimer(seconds)}`,
    });
  }, [complete, moves, pushNotification, recordBest, reported, seconds]);

  function restart() {
    setTubes(createBeadPuzzle());
    setSelectedTube(null);
    setMoves(0);
    setStartedAt(Date.now());
    setNow(Date.now());
    setReported(false);
  }

  function chooseTube(index: number) {
    if (complete) return;
    if (selectedTube === null) {
      if (tubes[index].length > 0) setSelectedTube(index);
      return;
    }
    const next = moveBead(tubes, selectedTube, index);
    if (next !== tubes) {
      setTubes(next);
      setMoves((value) => value + 1);
    }
    setSelectedTube(null);
  }

  return (
    <div className="dock-app-window mini-app bead-sort-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>色珠整理</h2>
        </div>
        <button type="button" className="mini-app__secondary" onClick={restart}>
          重开
        </button>
      </header>

      <div className="game-stats">
        <span>步数 {moves}</span>
        <span>用时 {formatTimer(seconds)}</span>
        <span>最佳 {best?.moves ? `${best.moves} 步` : '暂无'}</span>
      </div>

      <section className="bead-board" aria-label="色珠整理棋盘">
        {tubes.map((tube, index) => (
          <button
            type="button"
            key={`tube-${index}`}
            className={`bead-tube ${selectedTube === index ? 'is-selected' : ''}`}
            onClick={() => chooseTube(index)}
            aria-label={`第 ${index + 1} 管`}
          >
            {Array.from({ length: BEAD_CAPACITY }).map((_, slot) => {
              const bead = tube[BEAD_CAPACITY - slot - 1];
              return bead ? (
                <span key={`${bead}-${slot}`} className={`bead bead--${bead}`}>
                  {BEAD_LABELS[bead]}
                </span>
              ) : (
                <i key={`empty-${slot}`} />
              );
            })}
          </button>
        ))}
      </section>

      {complete ? <div className="game-complete">完成</div> : null}
    </div>
  );
}
