const DISPLAY_TARGET_FPS = 60;
const VSYNC_TOLERANCE_FPS = 2;

export function normalizedDisplayFps(averageFrameMs: number): number {
  if (!Number.isFinite(averageFrameMs) || averageFrameMs <= 0) return 0;
  const measured = 1_000 / averageFrameMs;
  if (Math.abs(measured - DISPLAY_TARGET_FPS) <= VSYNC_TOLERANCE_FPS) {
    return DISPLAY_TARGET_FPS;
  }
  return Math.round(measured * 10) / 10;
}

export function estimateRenderBatches({
  visibleTerrainChunks,
  visibleEntities,
  visibleBuildings,
  treeCanopyVisible,
  territoryVisible,
  statusVisible,
  visibleLabels,
}: {
  visibleTerrainChunks: number;
  visibleEntities: number;
  visibleBuildings: number;
  treeCanopyVisible: boolean;
  territoryVisible: boolean;
  statusVisible: boolean;
  visibleLabels: number;
}): number {
  return (
    (visibleTerrainChunks > 0 ? 1 : 0) +
    (visibleEntities > 0 ? 1 : 0) +
    (visibleBuildings > 0 ? 1 : 0) +
    (treeCanopyVisible ? 2 : 0) +
    (territoryVisible ? 1 : 0) +
    (statusVisible ? 1 : 0) +
    Math.max(0, visibleLabels)
  );
}
