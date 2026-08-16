import { PIXEL_ZOOM_STEPS, WORLD_PIXELS_PER_CELL } from './pixelCamera';

export type WorldViewLevel = 'world' | 'settlement' | 'resident';

export interface ViewScaleContext {
  mapSize: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface ViewPresentation {
  fullEntities: boolean;
  strategicEntities: boolean;
  detailedBuildings: boolean;
  settlementMarkers: boolean;
  territories: boolean;
  naturalResources: boolean;
  terrainDetail: 'macro' | 'districts' | 'resident';
}

export interface ResidentViewBounds {
  centerX: number;
  centerZ: number;
  halfWidth: number;
  halfHeight: number;
  margin: number;
}

const WORLD_TO_SETTLEMENT_COVERAGE = 0.78;
const SETTLEMENT_TO_WORLD_COVERAGE = 0.9;
const RESIDENT_MAX_LONG_AXIS_CELLS = 64;
const RESIDENT_MAX_SHORT_AXIS_CELLS = 36;
const RESIDENT_EXIT_LONG_AXIS_CELLS = 72;
const RESIDENT_EXIT_SHORT_AXIS_CELLS = 42;

export function visibleCellSpan(
  zoom: number,
  { mapSize, viewportWidth, viewportHeight }: ViewScaleContext,
): { width: number; height: number } {
  const scale = WORLD_PIXELS_PER_CELL * Math.max(PIXEL_ZOOM_STEPS[0], zoom);
  return {
    width: Math.min(mapSize, viewportWidth / scale),
    height: Math.min(mapSize, viewportHeight / scale),
  };
}

export function resolveViewLevel(
  current: WorldViewLevel,
  zoom: number,
  context: ViewScaleContext,
): WorldViewLevel {
  const span = visibleCellSpan(zoom, context);
  const worldCoverage = Math.min(span.width, span.height) / context.mapSize;
  const longAxis = Math.max(span.width, span.height);
  const shortAxis = Math.min(span.width, span.height);

  if (current === 'world') {
    return worldCoverage < WORLD_TO_SETTLEMENT_COVERAGE ? 'settlement' : 'world';
  }
  if (current === 'resident') {
    return longAxis > RESIDENT_EXIT_LONG_AXIS_CELLS || shortAxis > RESIDENT_EXIT_SHORT_AXIS_CELLS
      ? 'settlement'
      : 'resident';
  }
  if (worldCoverage >= SETTLEMENT_TO_WORLD_COVERAGE) return 'world';
  if (longAxis <= RESIDENT_MAX_LONG_AXIS_CELLS && shortAxis <= RESIDENT_MAX_SHORT_AXIS_CELLS) {
    return 'resident';
  }
  return 'settlement';
}

export function viewZoom(level: WorldViewLevel, context: ViewScaleContext): number {
  const { mapSize, viewportWidth, viewportHeight } = context;
  if (level === 'world') {
    const fit =
      (Math.min(viewportWidth, viewportHeight) * 0.92) /
      (Math.max(1, mapSize) * WORLD_PIXELS_PER_CELL);
    return zoomStepAtOrBelow(fit);
  }
  const target =
    level === 'settlement'
      ? Math.max(
          viewportWidth / (WORLD_PIXELS_PER_CELL * 128),
          viewportHeight / (WORLD_PIXELS_PER_CELL * 72),
        )
      : Math.max(
          viewportWidth / (WORLD_PIXELS_PER_CELL * RESIDENT_MAX_LONG_AXIS_CELLS),
          viewportHeight / (WORLD_PIXELS_PER_CELL * RESIDENT_MAX_SHORT_AXIS_CELLS),
        );
  return zoomStepAtOrAbove(target);
}

function zoomStepAtOrBelow(value: number): number {
  let selected: number = PIXEL_ZOOM_STEPS[0];
  for (const step of PIXEL_ZOOM_STEPS) {
    if (step > value) break;
    selected = step;
  }
  return selected;
}

function zoomStepAtOrAbove(value: number): number {
  return PIXEL_ZOOM_STEPS.find((step) => step >= value) ?? PIXEL_ZOOM_STEPS.at(-1) ?? 1;
}

export function presentationForView(level: WorldViewLevel): ViewPresentation {
  if (level === 'world')
    return {
      fullEntities: false,
      strategicEntities: false,
      detailedBuildings: false,
      settlementMarkers: true,
      territories: true,
      naturalResources: false,
      terrainDetail: 'macro',
    };
  if (level === 'settlement')
    return {
      fullEntities: false,
      strategicEntities: true,
      detailedBuildings: true,
      settlementMarkers: false,
      territories: false,
      naturalResources: false,
      terrainDetail: 'districts',
    };
  return {
    fullEntities: true,
    strategicEntities: false,
    detailedBuildings: true,
    settlementMarkers: false,
    territories: false,
    naturalResources: true,
    terrainDetail: 'resident',
  };
}

export function isResidentEntityVisible(x: number, z: number, bounds: ResidentViewBounds): boolean {
  return (
    Math.abs(x - bounds.centerX) <= bounds.halfWidth + bounds.margin &&
    Math.abs(z - bounds.centerZ) <= bounds.halfHeight + bounds.margin
  );
}
