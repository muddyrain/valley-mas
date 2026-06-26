import {
  createTetrisGame,
  hardDropTetrisPiece,
  moveTetrisPiece,
  rotateTetrisPiece,
  stepTetris,
  type TetrisPiece,
  type TetrisPieceKind,
  type TetrisState,
} from '@valley/mini-games';
import { useEffect, useMemo, useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useToolStore } from '../store/toolStore';
import './MiniApps.css';

type BoardCell = TetrisPieceKind | null;

function createPausedGame(): TetrisState {
  return { ...createTetrisGame(), status: 'paused' };
}

function createRunningGame(): TetrisState {
  return { ...createTetrisGame(), status: 'running' };
}

export default function BlockDropWindow() {
  const [game, setGame] = useState<TetrisState>(() => createPausedGame());
  const [reported, setReported] = useState(false);
  const best = useToolStore((s) => s.blockDropBest);
  const recordBest = useToolStore((s) => s.recordBlockDropBest);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const board = useMemo(() => composeTetrisBoard(game), [game]);
  const dropDelay = Math.max(160, 720 - (game.level - 1) * 70);

  useEffect(() => {
    if (game.status !== 'running') return;
    const timer = window.setInterval(() => {
      setGame((current) => (current.status === 'running' ? stepTetris(current) : current));
    }, dropDelay);
    return () => window.clearInterval(timer);
  }, [dropDelay, game.status]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isBlockDropKey(e.key)) return;
      e.preventDefault();
      if (e.key === 'p' || e.key === 'P') {
        toggleRunning();
        return;
      }
      setGame((current) => {
        if (current.status !== 'running') return current;
        if (e.key === 'ArrowLeft') return moveTetrisPiece(current, -1);
        if (e.key === 'ArrowRight') return moveTetrisPiece(current, 1);
        if (e.key === 'ArrowUp') return rotateTetrisPiece(current);
        if (e.key === 'ArrowDown') return stepTetris(current);
        if (e.key === ' ') return hardDropTetrisPiece(current);
        return current;
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (game.status !== 'over' || reported) return;
    setReported(true);
    const newBest = game.score > (best?.score ?? 0);
    if (game.score > 0) recordBest(game.score, game.lines, game.level);
    if (newBest) {
      pushNotification({
        app: '方块下落',
        title: '新纪录',
        body: `${game.score} 分`,
      });
    }
  }, [best?.score, game, pushNotification, recordBest, reported]);

  function toggleRunning() {
    setGame((current) => {
      if (current.status === 'over') return createRunningGame();
      return { ...current, status: current.status === 'running' ? 'paused' : 'running' };
    });
  }

  function restart() {
    setReported(false);
    setGame(createPausedGame());
  }

  function runAction(action: 'left' | 'right' | 'rotate' | 'down' | 'drop') {
    setGame((current) => {
      if (current.status !== 'running') return current;
      if (action === 'left') return moveTetrisPiece(current, -1);
      if (action === 'right') return moveTetrisPiece(current, 1);
      if (action === 'rotate') return rotateTetrisPiece(current);
      if (action === 'down') return stepTetris(current);
      return hardDropTetrisPiece(current);
    });
  }

  return (
    <div className="dock-app-window mini-app arcade-window block-drop-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>方块下落</h2>
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
        <span>行数 {game.lines}</span>
        <span>等级 {game.level}</span>
        <span>最高 {best?.score ?? 0}</span>
        <span>{statusLabel(game.status)}</span>
      </div>

      <section className="arcade-layout" aria-label="方块下落">
        <div className="arcade-board arcade-board--tetris">
          {board.flatMap((row, y) =>
            row.map((cell, x) => (
              <span
                key={`${x}-${y}`}
                className={`arcade-cell ${cell ? `arcade-cell--${cell.toLowerCase()}` : ''}`}
              />
            )),
          )}
        </div>

        <aside className="arcade-side">
          <fieldset className="next-piece">
            <legend className="mini-app__sr-only">下一个方块</legend>
            {composePiecePreview(game.next).map((cell, index) => (
              <span
                key={`next-${index}`}
                className={`arcade-cell ${cell ? `arcade-cell--${cell.toLowerCase()}` : ''}`}
              />
            ))}
          </fieldset>
          <div className="arcade-controls arcade-controls--grid">
            <button type="button" onClick={() => runAction('left')}>
              左
            </button>
            <button type="button" onClick={() => runAction('rotate')}>
              转
            </button>
            <button type="button" onClick={() => runAction('right')}>
              右
            </button>
            <button type="button" onClick={() => runAction('down')}>
              降
            </button>
            <button type="button" onClick={() => runAction('drop')}>
              落
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function composeTetrisBoard(game: TetrisState): BoardCell[][] {
  const board = game.board.map((row) => row.map((cell) => cell?.kind ?? null));
  for (const block of game.active.blocks) {
    const x = game.active.x + block.x;
    const y = game.active.y + block.y;
    if (board[y]?.[x] !== undefined) board[y][x] = game.active.kind;
  }
  return board;
}

function composePiecePreview(piece: TetrisPiece): BoardCell[] {
  const cells = Array<BoardCell>(16).fill(null);
  for (const block of piece.blocks) {
    const x = block.x + (piece.kind === 'I' ? 0 : 1);
    const y = block.y + (piece.kind === 'I' ? 1 : 0);
    if (x >= 0 && x < 4 && y >= 0 && y < 4) cells[y * 4 + x] = piece.kind;
  }
  return cells;
}

function statusLabel(status: TetrisState['status']) {
  if (status === 'running') return '进行中';
  if (status === 'over') return '结束';
  return '暂停';
}

function isBlockDropKey(key: string) {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'p', 'P'].includes(key);
}
