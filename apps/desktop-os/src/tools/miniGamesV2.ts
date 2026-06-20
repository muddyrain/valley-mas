export type BeadColor = 'sage' | 'sky' | 'butter';
export type BeadTube = BeadColor[];
export type FallingKind = 'star' | 'cloud';

export interface FallingItem {
  id: string;
  lane: number;
  row: number;
  kind: FallingKind;
}

export const BEAD_CAPACITY = 4;
export const BEAD_COLORS: BeadColor[] = ['sage', 'sky', 'butter'];

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

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
