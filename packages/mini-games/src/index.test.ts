import { describe, expect, test } from 'vitest';
import {
  changeSnakeDirection,
  createSnakeGame,
  createTetrisGame,
  hardDropTetrisPiece,
  isSnakeGameOver,
  isTetrisGameOver,
  moveTetrisPiece,
  rotateTetrisPiece,
  stepSnake,
  stepTetris,
  type TetrisCell,
} from './index';

function rng(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

function filledRow(openColumns: number[] = []): Array<TetrisCell | null> {
  return Array.from({ length: 10 }, (_, column) =>
    openColumns.includes(column) ? null : { kind: 'O' },
  );
}

describe('tetris logic', () => {
  test('creates a deterministic 10x20 board with active and next pieces', () => {
    const game = createTetrisGame({ rng: rng([0, 0.2]) });

    expect(game.board).toHaveLength(20);
    expect(game.board.every((row) => row.length === 10)).toBe(true);
    expect(game.active.kind).toBe('I');
    expect(game.next.kind).toBe('J');
    expect(game.score).toBe(0);
    expect(game.lines).toBe(0);
    expect(game.level).toBe(1);
    expect(game.status).toBe('running');
  });

  test('does not move the active piece outside the board', () => {
    let game = createTetrisGame({ rng: rng([0]) });

    for (let i = 0; i < 12; i += 1) {
      game = moveTetrisPiece(game, -1);
    }

    expect(game.active.x).toBe(0);
    expect(game.active.blocks.every((block) => block.x + game.active.x >= 0)).toBe(true);
  });

  test('rotates only when the rotated piece stays valid', () => {
    let game = createTetrisGame({ rng: rng([0]) });
    game = moveTetrisPiece(game, -10);

    const blockedRotation = rotateTetrisPiece(game);
    const moved = moveTetrisPiece(game, 4);
    const rotated = rotateTetrisPiece(moved);

    expect(blockedRotation.active.rotation).toBe(game.active.rotation);
    expect(rotated.active.rotation).not.toBe(moved.active.rotation);
  });

  test('hard drops, clears completed lines, and scores by cleared rows', () => {
    const board = Array.from({ length: 20 }, () => Array<TetrisCell | null>(10).fill(null));
    board[19] = filledRow([3, 4, 5, 6]);
    const game = createTetrisGame({
      rng: rng([0, 0.1]),
      board,
      active: { kind: 'I', x: 3, y: 0, rotation: 0 },
    });

    const dropped = hardDropTetrisPiece(game);

    expect(dropped.lines).toBe(1);
    expect(dropped.score).toBe(100);
    expect(dropped.level).toBe(1);
    expect(dropped.board[19].every((cell) => cell === null)).toBe(true);
  });

  test('reports game over when a new piece cannot spawn', () => {
    const board = Array.from({ length: 20 }, () => Array<TetrisCell | null>(10).fill(null));
    board[0] = filledRow();
    const game = createTetrisGame({ rng: rng([0]), board });

    expect(game.status).toBe('over');
    expect(isTetrisGameOver(game)).toBe(true);
    expect(stepTetris(game).status).toBe('over');
  });
});

describe('snake logic', () => {
  test('creates a deterministic snake board and food position', () => {
    const game = createSnakeGame({ rng: rng([0.9, 0.9]) });

    expect(game.width).toBe(16);
    expect(game.height).toBe(16);
    expect(game.snake).toEqual([
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 },
    ]);
    expect(game.food).toEqual({ x: 14, y: 14 });
    expect(game.status).toBe('running');
  });

  test('prevents direct reverse direction changes', () => {
    const game = createSnakeGame();

    const reversed = changeSnakeDirection(game, 'left');
    const turned = changeSnakeDirection(game, 'up');

    expect(reversed.direction).toBe('right');
    expect(turned.direction).toBe('up');
  });

  test('moves, eats food, grows, and places the next deterministic food', () => {
    const game = createSnakeGame({
      rng: rng([0.1, 0.1]),
      food: { x: 9, y: 8 },
    });

    const next = stepSnake(game);

    expect(next.score).toBe(10);
    expect(next.snake).toHaveLength(4);
    expect(next.snake[0]).toEqual({ x: 9, y: 8 });
    expect(next.food).toEqual({ x: 1, y: 1 });
  });

  test('ends when the snake hits a wall or itself', () => {
    const wallHit = stepSnake(
      createSnakeGame({
        snake: [
          { x: 15, y: 8 },
          { x: 14, y: 8 },
          { x: 13, y: 8 },
        ],
      }),
    );
    const selfHit = stepSnake(
      createSnakeGame({
        direction: 'up',
        snake: [
          { x: 8, y: 8 },
          { x: 8, y: 7 },
          { x: 7, y: 7 },
          { x: 7, y: 8 },
          { x: 8, y: 8 },
        ],
      }),
    );

    expect(wallHit.status).toBe('over');
    expect(selfHit.status).toBe('over');
    expect(isSnakeGameOver(wallHit)).toBe(true);
  });
});
