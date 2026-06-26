import {
  changeSnakeDirection,
  createSnakeGame,
  type SnakeDirection,
  type SnakeState,
  stepSnake,
} from '@valley/mini-games';
import { useEffect, useMemo, useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useToolStore } from '../store/toolStore';
import './MiniApps.css';

function createPausedSnake(): SnakeState {
  return { ...createSnakeGame(), status: 'paused' };
}

function createRunningSnake(): SnakeState {
  return { ...createSnakeGame(), status: 'running' };
}

export default function SnakeWindow() {
  const [game, setGame] = useState<SnakeState>(() => createPausedSnake());
  const [reported, setReported] = useState(false);
  const best = useToolStore((s) => s.snakeBest);
  const recordBest = useToolStore((s) => s.recordSnakeBest);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const cells = useMemo(() => composeSnakeCells(game), [game]);
  const speed = Math.max(110, 260 - Math.floor(game.score / 50) * 22);

  useEffect(() => {
    if (game.status !== 'running') return;
    const timer = window.setInterval(() => {
      setGame((current) => (current.status === 'running' ? stepSnake(current) : current));
    }, speed);
    return () => window.clearInterval(timer);
  }, [game.status, speed]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const direction = keyToDirection(e.key);
      if (!direction) return;
      e.preventDefault();
      setGame((current) =>
        current.status === 'running' ? changeSnakeDirection(current, direction) : current,
      );
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (game.status !== 'over' || reported) return;
    setReported(true);
    const newBest = game.score > (best?.score ?? 0);
    if (game.score > 0) recordBest(game.score, game.snake.length);
    if (newBest) {
      pushNotification({
        app: '贪吃蛇',
        title: '新纪录',
        body: `${game.score} 分`,
      });
    }
  }, [best?.score, game, pushNotification, recordBest, reported]);

  function toggleRunning() {
    setGame((current) => {
      if (current.status === 'over') return createRunningSnake();
      return { ...current, status: current.status === 'running' ? 'paused' : 'running' };
    });
  }

  function restart() {
    setReported(false);
    setGame(createPausedSnake());
  }

  function turn(direction: SnakeDirection) {
    setGame((current) =>
      current.status === 'running' ? changeSnakeDirection(current, direction) : current,
    );
  }

  return (
    <div className="dock-app-window mini-app arcade-window snake-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>贪吃蛇</h2>
        </div>
        <div className="mini-app__header-actions">
          <button type="button" className="mini-app__secondary" onClick={restart}>
            重开
          </button>
          <button type="button" className="dock-app-window__button" onClick={toggleRunning}>
            {game.status === 'running' ? '暂停' : game.status === 'over' ? '再来' : '开始'}
          </button>
        </div>
      </header>

      <div className="game-stats">
        <span>分数 {game.score}</span>
        <span>长度 {game.snake.length}</span>
        <span>最高 {best?.score ?? 0}</span>
        <span>{statusLabel(game.status)}</span>
      </div>

      <section className="arcade-layout arcade-layout--snake" aria-label="贪吃蛇">
        <div className="arcade-board arcade-board--snake">
          {cells.map((cell, index) => (
            <span
              key={`snake-${index}`}
              className={`arcade-cell ${cell ? `arcade-cell--${cell}` : ''}`}
            />
          ))}
        </div>

        <div className="arcade-controls arcade-controls--pad">
          <button type="button" onClick={() => turn('up')}>
            上
          </button>
          <button type="button" onClick={() => turn('left')}>
            左
          </button>
          <button type="button" onClick={() => turn('right')}>
            右
          </button>
          <button type="button" onClick={() => turn('down')}>
            下
          </button>
        </div>
      </section>
    </div>
  );
}

function composeSnakeCells(game: SnakeState) {
  const cells = Array<string | null>(game.width * game.height).fill(null);
  cells[game.food.y * game.width + game.food.x] = 'food';
  game.snake.forEach((segment, index) => {
    cells[segment.y * game.width + segment.x] = index === 0 ? 'snake-head' : 'snake';
  });
  return cells;
}

function keyToDirection(key: string): SnakeDirection | null {
  if (key === 'ArrowUp' || key === 'w' || key === 'W') return 'up';
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'right';
  if (key === 'ArrowDown' || key === 's' || key === 'S') return 'down';
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'left';
  return null;
}

function statusLabel(status: SnakeState['status']) {
  if (status === 'running') return '进行中';
  if (status === 'over') return '结束';
  return '暂停';
}
