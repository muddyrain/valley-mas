export interface FluidSimulationSize {
  height: number;
  width: number;
}

export function resolveFluidSimulationSize(
  viewportWidth: number,
  viewportHeight: number,
  shortEdge = 160,
): FluidSimulationSize {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const safeShortEdge = Math.max(1, Math.round(shortEdge));
  const aspect = safeWidth / safeHeight;

  if (aspect > 1) {
    return {
      height: safeShortEdge,
      width: Math.max(safeShortEdge, Math.round(safeShortEdge * aspect)),
    };
  }

  return {
    height: Math.max(safeShortEdge, Math.round(safeShortEdge / aspect)),
    width: safeShortEdge,
  };
}

export function resolveFluidPassEnabled(
  mode: 'articles' | 'home',
  activity: number,
  heroExit: number,
) {
  return mode === 'home' && activity > 0 && heroExit < 0.9;
}
