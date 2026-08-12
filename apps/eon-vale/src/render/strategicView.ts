export type WorldViewLevel = 'world' | 'settlement' | 'resident';

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

const WORLD_TO_SETTLEMENT = 1.8;
const SETTLEMENT_TO_WORLD = 1.45;
const SETTLEMENT_TO_RESIDENT = 4.3;
const RESIDENT_TO_SETTLEMENT = 3.75;

export function resolveViewLevel(current: WorldViewLevel, zoom: number): WorldViewLevel {
  if (current === 'world') return zoom >= WORLD_TO_SETTLEMENT ? 'settlement' : 'world';
  if (current === 'resident') return zoom <= RESIDENT_TO_SETTLEMENT ? 'settlement' : 'resident';
  if (zoom <= SETTLEMENT_TO_WORLD) return 'world';
  if (zoom >= SETTLEMENT_TO_RESIDENT) return 'resident';
  return 'settlement';
}

export function viewZoom(level: WorldViewLevel, worldSize: number): number {
  if (level === 'world') return 1;
  if (level === 'settlement') return Math.max(2.7, Math.min(3.35, worldSize / 42));
  return Math.max(5.8, Math.min(6.2, worldSize / 21));
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
