import { useEffect, useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useToolStore } from '../store/toolStore';
import { advanceFallingItems, createFallingItem, type FallingItem } from '../tools/miniGamesV2';
import './MiniApps.css';

export default function CloudBounceWindow() {
  const [lane, setLane] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [score, setScore] = useState(0);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const best = useToolStore((s) => s.cloudBounceBest);
  const recordBest = useToolStore((s) => s.recordCloudBounceBest);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setLane((value) => Math.max(0, value - 1));
      if (e.key === 'ArrowRight') setLane((value) => Math.min(2, value + 1));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setItems((current) => {
        const advanced = advanceFallingItems(current);
        const landed = advanced.filter((item) => item.row >= 5 && item.lane === lane);
        if (landed.some((item) => item.kind === 'cloud')) {
          setRunning(false);
          setGameOver(true);
          recordBest(score);
          pushNotification({
            app: '云朵弹跳',
            title: '本局结束',
            body: `${score} 分`,
          });
        } else if (landed.some((item) => item.kind === 'star')) {
          setScore((value) => value + 10);
        }
        return [...advanced.filter((item) => item.row < 5), createFallingItem(tick)];
      });
    }, 620);
    return () => window.clearInterval(timer);
  }, [lane, pushNotification, recordBest, running, score, tick]);

  function start() {
    setLane(1);
    setItems([]);
    setScore(0);
    setTick(0);
    setGameOver(false);
    setRunning(true);
  }

  return (
    <div className="dock-app-window mini-app cloud-bounce-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>云朵弹跳</h2>
        </div>
        <button type="button" className="dock-app-window__button" onClick={start}>
          {running ? '重开' : '开始'}
        </button>
      </header>

      <div className="game-stats">
        <span>分数 {score}</span>
        <span>最佳 {best?.score ?? 0}</span>
        <span>{running ? '进行中' : gameOver ? '结束' : '待开始'}</span>
      </div>

      <section className="cloud-board" aria-label="云朵弹跳棋盘">
        {Array.from({ length: 15 }).map((_, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const item = items.find((candidate) => candidate.row === row && candidate.lane === col);
          const isPlayer = row === 4 && col === lane;
          return (
            <span
              key={`cell-${index}`}
              className={`cloud-cell ${isPlayer ? 'is-player' : ''} ${
                item ? `is-${item.kind}` : ''
              }`}
            >
              {isPlayer ? '跳' : item?.kind === 'star' ? '星' : item?.kind === 'cloud' ? '云' : ''}
            </span>
          );
        })}
      </section>

      <div className="cloud-controls">
        <button type="button" onClick={() => setLane((value) => Math.max(0, value - 1))}>
          左
        </button>
        <button type="button" onClick={() => setLane((value) => Math.min(2, value + 1))}>
          右
        </button>
      </div>
    </div>
  );
}
