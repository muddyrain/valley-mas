export interface GridPoint {
  x: number;
  y: number;
}

export type GameRng = () => number;
export type GameStatus = 'running' | 'paused' | 'over';

export type TetrisPieceKind = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export interface TetrisCell {
  kind: TetrisPieceKind;
}

export interface TetrisPiece {
  kind: TetrisPieceKind;
  x: number;
  y: number;
  rotation: number;
  blocks: GridPoint[];
}

export interface TetrisState {
  width: number;
  height: number;
  board: Array<Array<TetrisCell | null>>;
  active: TetrisPiece;
  next: TetrisPiece;
  score: number;
  lines: number;
  level: number;
  status: GameStatus;
  rng: GameRng;
}

export interface CreateTetrisOptions {
  rng?: GameRng;
  board?: Array<Array<TetrisCell | null>>;
  active?: Pick<TetrisPiece, 'kind' | 'x' | 'y' | 'rotation'>;
}

export type SnakeDirection = 'up' | 'right' | 'down' | 'left';

export interface SnakeState {
  width: number;
  height: number;
  snake: GridPoint[];
  food: GridPoint;
  direction: SnakeDirection;
  pendingDirection: SnakeDirection;
  score: number;
  status: GameStatus;
  rng: GameRng;
}

export interface CreateSnakeOptions {
  rng?: GameRng;
  width?: number;
  height?: number;
  snake?: GridPoint[];
  food?: GridPoint;
  direction?: SnakeDirection;
}

const TETRIS_WIDTH = 10;
const TETRIS_HEIGHT = 20;
const TETRIS_KINDS: TetrisPieceKind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const LINE_SCORES: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const TETRIS_SHAPES: Record<TetrisPieceKind, GridPoint[][]> = {
  I: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
  ],
  J: [
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
  L: [
    [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  O: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  ],
  S: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
  ],
  T: [
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  Z: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
};

export function createTetrisGame(options: CreateTetrisOptions = {}): TetrisState {
  const rng = options.rng ?? Math.random;
  const board = options.board ? cloneBoard(options.board) : createEmptyTetrisBoard();
  const active = options.active
    ? createTetrisPiece(
        options.active.kind,
        options.active.x,
        options.active.y,
        options.active.rotation,
      )
    : spawnTetrisPiece(pickTetrisKind(rng));
  const next = spawnTetrisPiece(pickTetrisKind(rng));
  const status: GameStatus = canPlaceTetrisPiece(board, active) ? 'running' : 'over';

  return {
    width: TETRIS_WIDTH,
    height: TETRIS_HEIGHT,
    board,
    active,
    next,
    score: 0,
    lines: 0,
    level: 1,
    status,
    rng,
  };
}

export function stepTetris(state: TetrisState): TetrisState {
  if (state.status !== 'running') return state;
  const nextActive = { ...state.active, y: state.active.y + 1 };
  if (canPlaceTetrisPiece(state.board, nextActive)) {
    return { ...state, active: withTetrisBlocks(nextActive) };
  }
  return lockTetrisPiece(state);
}

export function moveTetrisPiece(state: TetrisState, deltaX: number): TetrisState {
  if (state.status !== 'running') return state;
  const direction = Math.sign(deltaX);
  if (direction === 0) return state;
  let active = state.active;
  for (let step = 0; step < Math.abs(deltaX); step += 1) {
    const moved = withTetrisBlocks({ ...active, x: active.x + direction });
    if (!canPlaceTetrisPiece(state.board, moved)) break;
    active = moved;
  }
  return active === state.active ? state : { ...state, active };
}

export function rotateTetrisPiece(state: TetrisState): TetrisState {
  if (state.status !== 'running') return state;
  const shapeCount = TETRIS_SHAPES[state.active.kind].length;
  const rotated = createTetrisPiece(
    state.active.kind,
    state.active.x,
    state.active.y,
    (state.active.rotation + 1) % shapeCount,
  );
  return canPlaceTetrisPiece(state.board, rotated) ? { ...state, active: rotated } : state;
}

export function hardDropTetrisPiece(state: TetrisState): TetrisState {
  if (state.status !== 'running') return state;
  let active = state.active;
  while (canPlaceTetrisPiece(state.board, withTetrisBlocks({ ...active, y: active.y + 1 }))) {
    active = withTetrisBlocks({ ...active, y: active.y + 1 });
  }
  return lockTetrisPiece({ ...state, active });
}

export function isTetrisGameOver(state: TetrisState) {
  return state.status === 'over';
}

export function createSnakeGame(options: CreateSnakeOptions = {}): SnakeState {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const rng = options.rng ?? Math.random;
  const snake = options.snake
    ? clonePoints(options.snake)
    : [
        { x: Math.floor(width / 2), y: Math.floor(height / 2) },
        { x: Math.floor(width / 2) - 1, y: Math.floor(height / 2) },
        { x: Math.floor(width / 2) - 2, y: Math.floor(height / 2) },
      ];
  const direction = options.direction ?? 'right';
  const food = options.food ? { ...options.food } : placeSnakeFood(width, height, snake, rng);

  return {
    width,
    height,
    snake,
    food,
    direction,
    pendingDirection: direction,
    score: 0,
    status: 'running',
    rng,
  };
}

export function changeSnakeDirection(state: SnakeState, direction: SnakeDirection): SnakeState {
  if (isOppositeDirection(state.direction, direction)) return state;
  return { ...state, direction, pendingDirection: direction };
}

export function stepSnake(state: SnakeState): SnakeState {
  if (state.status !== 'running') return state;
  const direction = state.pendingDirection;
  const head = state.snake[0];
  const nextHead = {
    x: head.x + directionDelta(direction).x,
    y: head.y + directionDelta(direction).y,
  };
  const eating = samePoint(nextHead, state.food);
  const nextSnake = eating ? [nextHead, ...state.snake] : [nextHead, ...state.snake.slice(0, -1)];

  if (
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.width ||
    nextHead.y >= state.height ||
    nextSnake.slice(1).some((point) => samePoint(point, nextHead))
  ) {
    return { ...state, direction, status: 'over' };
  }

  return {
    ...state,
    snake: nextSnake,
    food: eating ? placeSnakeFood(state.width, state.height, nextSnake, state.rng) : state.food,
    direction,
    pendingDirection: direction,
    score: state.score + (eating ? 10 : 0),
  };
}

export function isSnakeGameOver(state: SnakeState) {
  return state.status === 'over';
}

function createEmptyTetrisBoard() {
  return Array.from({ length: TETRIS_HEIGHT }, () =>
    Array<TetrisCell | null>(TETRIS_WIDTH).fill(null),
  );
}

function cloneBoard(board: Array<Array<TetrisCell | null>>) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function pickTetrisKind(rng: GameRng): TetrisPieceKind {
  return TETRIS_KINDS[Math.min(TETRIS_KINDS.length - 1, Math.floor(rng() * TETRIS_KINDS.length))];
}

function spawnTetrisPiece(kind: TetrisPieceKind) {
  return createTetrisPiece(kind, kind === 'I' ? 3 : 4, 0, 0);
}

function createTetrisPiece(
  kind: TetrisPieceKind,
  x: number,
  y: number,
  rotation: number,
): TetrisPiece {
  return withTetrisBlocks({ kind, x, y, rotation, blocks: [] });
}

function withTetrisBlocks(piece: TetrisPiece): TetrisPiece {
  const shapes = TETRIS_SHAPES[piece.kind];
  return {
    ...piece,
    rotation: piece.rotation % shapes.length,
    blocks: shapes[piece.rotation % shapes.length].map((block) => ({ ...block })),
  };
}

function canPlaceTetrisPiece(board: Array<Array<TetrisCell | null>>, piece: TetrisPiece) {
  return piece.blocks.every((block) => {
    const x = piece.x + block.x;
    const y = piece.y + block.y;
    return x >= 0 && x < TETRIS_WIDTH && y >= 0 && y < TETRIS_HEIGHT && !board[y][x];
  });
}

function lockTetrisPiece(state: TetrisState): TetrisState {
  const board = cloneBoard(state.board);
  for (const block of state.active.blocks) {
    const x = state.active.x + block.x;
    const y = state.active.y + block.y;
    if (y >= 0 && y < TETRIS_HEIGHT && x >= 0 && x < TETRIS_WIDTH) {
      board[y][x] = { kind: state.active.kind };
    }
  }

  const { board: clearedBoard, cleared } = clearTetrisLines(board);
  const score = state.score + (LINE_SCORES[cleared] ?? 0);
  const lines = state.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const active = state.next;
  const next = spawnTetrisPiece(pickTetrisKind(state.rng));
  const status: GameStatus = canPlaceTetrisPiece(clearedBoard, active) ? 'running' : 'over';

  return {
    ...state,
    board: clearedBoard,
    active,
    next,
    score,
    lines,
    level,
    status,
  };
}

function clearTetrisLines(board: Array<Array<TetrisCell | null>>) {
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = TETRIS_HEIGHT - remaining.length;
  return {
    board: [
      ...Array.from({ length: cleared }, () => Array<TetrisCell | null>(TETRIS_WIDTH).fill(null)),
      ...remaining,
    ],
    cleared,
  };
}

function clonePoints(points: GridPoint[]) {
  return points.map((point) => ({ ...point }));
}

function samePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

function isOppositeDirection(a: SnakeDirection, b: SnakeDirection) {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

function directionDelta(direction: SnakeDirection): GridPoint {
  if (direction === 'up') return { x: 0, y: -1 };
  if (direction === 'down') return { x: 0, y: 1 };
  if (direction === 'left') return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function placeSnakeFood(
  width: number,
  height: number,
  snake: GridPoint[],
  rng: GameRng,
): GridPoint {
  const total = width * height;
  for (let attempt = 0; attempt < total * 2; attempt += 1) {
    const point = {
      x: Math.floor(rng() * width),
      y: Math.floor(rng() * height),
    };
    if (!snake.some((segment) => samePoint(segment, point))) return point;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = { x, y };
      if (!snake.some((segment) => samePoint(segment, point))) return point;
    }
  }
  return { x: -1, y: -1 };
}
