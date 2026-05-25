export type TileRunInput = {
  x: number;
  y: number;
};

export type HorizontalTileRun<T extends TileRunInput> = {
  x: number;
  y: number;
  width: number;
  sample: T;
  styleKey: string;
};

export function buildHorizontalTileRuns<T extends TileRunInput>(
  tiles: T[],
  getStyleKey: (tile: T) => string,
): HorizontalTileRun<T>[] {
  const sortedTiles = [...tiles].sort((left, right) => left.y - right.y || left.x - right.x);
  const runs: HorizontalTileRun<T>[] = [];
  let current: HorizontalTileRun<T> | undefined;

  for (const tile of sortedTiles) {
    const styleKey = getStyleKey(tile);
    if (
      current &&
      current.y === tile.y &&
      current.x + current.width === tile.x &&
      current.styleKey === styleKey
    ) {
      current.width += 1;
      continue;
    }

    current = {
      x: tile.x,
      y: tile.y,
      width: 1,
      sample: tile,
      styleKey,
    };
    runs.push(current);
  }

  return runs;
}
