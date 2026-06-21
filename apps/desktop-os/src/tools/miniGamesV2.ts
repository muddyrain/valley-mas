export type BeadColor = 'sage' | 'sky' | 'butter';
export type BeadTube = BeadColor[];
export type FallingKind = 'star' | 'cloud';

export interface FallingItem {
  id: string;
  lane: number;
  row: number;
  kind: FallingKind;
}

export interface DicePlacement {
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  settleDelay: number;
}

export interface DicePlacement3D {
  x: number;
  y: number;
  z: number;
  rotation: [number, number, number];
  spin: [number, number, number];
  settleDelay: number;
}

export const BEAD_CAPACITY = 4;
export const BEAD_COLORS: BeadColor[] = ['sage', 'sky', 'butter'];
const DICE_MIN_DISTANCE = 68;
export const DICE_CUP_BOARD_RADIUS = 2;
export const DICE_CUP_DIE_FOOTPRINT_RADIUS = 0.39;
const DICE_SLOT_POOL = [
  { x: -118, y: 46 },
  { x: -44, y: 78 },
  { x: 36, y: 54 },
  { x: 112, y: 76 },
  { x: 122, y: 4 },
  { x: -92, y: -28 },
  { x: -8, y: -18 },
  { x: 74, y: -34 },
];
const DICE_SLOT_POOL_3D = [
  { x: -1.36, z: -0.32 },
  { x: -0.68, z: 0.2 },
  { x: 0, z: -0.42 },
  { x: 0.68, z: 0.2 },
  { x: 1.36, z: -0.32 },
];

export const BEAD_LABELS: Record<BeadColor, string> = {
  sage: '鼠尾草',
  sky: '天空蓝',
  butter: '黄油',
};

export function createBeadPuzzle(): BeadTube[] {
  const beads = shuffle(BEAD_COLORS.flatMap((color) => Array.from({ length: 3 }, () => color)));
  return [beads.slice(0, 3), beads.slice(3, 6), beads.slice(6, 9), [], []];
}

export function moveBead(tubes: BeadTube[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return tubes;
  const from = tubes[fromIndex];
  const to = tubes[toIndex];
  const bead = from.at(-1);
  if (!bead || !to || to.length >= BEAD_CAPACITY) return tubes;
  const targetTop = to.at(-1);
  if (targetTop && targetTop !== bead) return tubes;
  return tubes.map((tube, index) => {
    if (index === fromIndex) return tube.slice(0, -1);
    if (index === toIndex) return [...tube, bead];
    return tube;
  });
}

export function isBeadPuzzleComplete(tubes: BeadTube[]) {
  const filledTubes = tubes.filter((tube) => tube.length > 0);
  return (
    filledTubes.length === BEAD_COLORS.length &&
    filledTubes.every(
      (tube) =>
        tube.length === 3 &&
        tube.every((bead) => bead === tube[0]) &&
        BEAD_COLORS.includes(tube[0]),
    )
  );
}

export function createFallingItem(tick: number): FallingItem {
  return {
    id: `falling-${tick}-${Math.random().toString(16).slice(2)}`,
    lane: Math.floor(Math.random() * 3),
    row: 0,
    kind: Math.random() > 0.34 ? 'star' : 'cloud',
  };
}

export function advanceFallingItems(items: FallingItem[]) {
  return items.map((item) => ({ ...item, row: item.row + 1 })).filter((item) => item.row <= 5);
}

export function rollDice(count = 5, rng: () => number = Math.random) {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () =>
    Math.min(6, Math.floor(rng() * 6) + 1),
  );
}

export function createDicePlacements(count = 5, rng: () => number = Math.random): DicePlacement[] {
  const slots = shuffleWithRng(DICE_SLOT_POOL, rng);
  const placements: DicePlacement[] = [];
  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    const slot = slots[index % slots.length];
    let next = {
      x: slot.x + Math.round((rng() - 0.5) * 8),
      y: slot.y + Math.round((rng() - 0.5) * 8),
      z: 14 + Math.round(rng() * 18),
      rotateX: Math.round(rng() * 54 - 27),
      rotateY: Math.round(rng() * 54 - 27),
      rotateZ: Math.round(rng() * 42 - 21),
      settleDelay: Math.round(index * 40 + rng() * 80),
    };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const overlap = placements.find((placement) => distance(next, placement) < DICE_MIN_DISTANCE);
      if (!overlap) break;
      const angle = Math.atan2(next.y - overlap.y || 1, next.x - overlap.x || 1);
      next = {
        ...next,
        x: Math.round(next.x + Math.cos(angle) * 12),
        y: Math.round(next.y + Math.sin(angle) * 12),
      };
    }

    placements.push(next);
  }

  return placements;
}

export function createDicePlacements3D(
  count = 5,
  rng: () => number = Math.random,
): DicePlacement3D[] {
  const placements: DicePlacement3D[] = [];
  const maxRadius = DICE_CUP_BOARD_RADIUS - DICE_CUP_DIE_FOOTPRINT_RADIUS;
  const total = Math.max(0, Math.floor(count));
  const slots = shuffleWithRng(DICE_SLOT_POOL_3D, rng);

  for (let index = 0; index < total; index += 1) {
    let next = makeDicePlacement3D(index, rng, maxRadius, slots[index % slots.length]);

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const overlap = placements.find(
        (placement) => footprintDistance(next, placement) < DICE_CUP_DIE_FOOTPRINT_RADIUS * 2,
      );
      if (!overlap) break;

      const angle = Math.atan2(
        next.z - overlap.z || rng() - 0.5,
        next.x - overlap.x || rng() - 0.5,
      );
      next = clampPlacementToBoard(
        {
          ...next,
          x: next.x + Math.cos(angle) * 0.18,
          z: next.z + Math.sin(angle) * 0.18,
        },
        maxRadius,
      );
    }

    placements.push(next);
  }

  return placements;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function shuffleWithRng<T>(items: T[], rng: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function distance(a: Pick<DicePlacement, 'x' | 'y'>, b: Pick<DicePlacement, 'x' | 'y'>) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeDicePlacement3D(
  index: number,
  rng: () => number,
  maxRadius: number,
  slot: (typeof DICE_SLOT_POOL_3D)[number],
): DicePlacement3D {
  return clampPlacementToBoard(
    {
      x: slot.x + (rng() - 0.5) * 0.08,
      y: 0.52,
      z: slot.z + (rng() - 0.5) * 0.08,
      rotation: [0, -0.36 + (rng() - 0.5) * 0.34, 0],
      spin: [1.8 + rng() * 2.8, 2.2 + rng() * 3.2, 1.4 + rng() * 2.6],
      settleDelay: Math.round(index * 55 + rng() * 90),
    } satisfies DicePlacement3D,
    maxRadius,
  );
}

function clampPlacementToBoard(placement: DicePlacement3D, maxRadius: number): DicePlacement3D {
  const distanceFromCenter = Math.hypot(placement.x, placement.z);
  if (distanceFromCenter <= maxRadius) return placement;
  const scale = (maxRadius - 0.001) / distanceFromCenter;
  return {
    ...placement,
    x: placement.x * scale,
    z: placement.z * scale,
  };
}

function footprintDistance(
  a: Pick<DicePlacement3D, 'x' | 'z'>,
  b: Pick<DicePlacement3D, 'x' | 'z'>,
) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
