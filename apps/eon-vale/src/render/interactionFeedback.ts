import { BuildingType, ResourceNodeKind, ResourceNodeStage } from '@/shared/gameTypes';
import type { WorldViewLevel } from './strategicView';

export interface InteractionGeometry {
  shape: 'circle' | 'ellipse';
  offsetX: number;
  offsetZ: number;
  radiusX: number;
  radiusZ: number;
}

export function interactionStrokeWidth(zoom: number, tone: 'hover' | 'selected'): number {
  const screenPixels = tone === 'selected' ? 2.25 : 1.25;
  return screenPixels / Math.max(0.25, zoom);
}

export function entityInteractionGeometry(
  viewLevel: Extract<WorldViewLevel, 'settlement' | 'resident'> = 'resident',
): InteractionGeometry {
  if (viewLevel === 'settlement') {
    return { shape: 'ellipse', offsetX: 0, offsetZ: -0.5, radiusX: 0.5, radiusZ: 0.68 };
  }
  return { shape: 'ellipse', offsetX: 0, offsetZ: -0.95, radiusX: 0.82, radiusZ: 1.12 };
}

export function buildingInteractionGeometry(
  type: BuildingType,
  viewLevel: Extract<WorldViewLevel, 'settlement' | 'resident'> = 'resident',
): InteractionGeometry {
  const footprint: Record<BuildingType, readonly [number, number]> = {
    [BuildingType.TownCenter]: [3.4, 2.2],
    [BuildingType.Home]: [2.2, 1.7],
    [BuildingType.Farm]: [3.2, 2.2],
    [BuildingType.Storage]: [2.6, 1.9],
    [BuildingType.Barracks]: [3.1, 2.1],
    [BuildingType.Road]: [2.5, 0.8],
    [BuildingType.LoggingCamp]: [2.8, 1.9],
    [BuildingType.Mine]: [2.8, 2],
    [BuildingType.Workshop]: [2.8, 1.9],
    [BuildingType.CouncilHall]: [3.2, 2.1],
    [BuildingType.Wall]: [2.4, 0.75],
    [BuildingType.Watchtower]: [2.2, 1.7],
  };
  const [width, depth] = footprint[type] ?? [2.4, 1.8];
  const staysOnGround = type === BuildingType.Farm || type === BuildingType.Road;
  const geometry: InteractionGeometry = {
    shape: 'ellipse',
    offsetX: 0,
    offsetZ: staysOnGround ? 0 : -0.9,
    radiusX: width / 2,
    radiusZ: staysOnGround ? depth / 2 : Math.max(depth / 2, 1.35),
  };
  if (viewLevel === 'resident') return geometry;
  return {
    ...geometry,
    offsetZ: geometry.offsetZ * 0.72,
    radiusX: geometry.radiusX * 0.72,
    radiusZ: geometry.radiusZ * 0.72,
  };
}

export function resourceInteractionGeometry(
  kind: ResourceNodeKind,
  stage: ResourceNodeStage,
  viewLevel: Extract<WorldViewLevel, 'settlement' | 'resident'> = 'resident',
): InteractionGeometry {
  if (viewLevel === 'settlement') {
    return kind === ResourceNodeKind.Tree
      ? { shape: 'ellipse', offsetX: 0, offsetZ: -0.62, radiusX: 0.7, radiusZ: 0.88 }
      : { shape: 'ellipse', offsetX: 0, offsetZ: -0.16, radiusX: 0.5, radiusZ: 0.38 };
  }
  if (kind === ResourceNodeKind.Tree && stage === ResourceNodeStage.Mature) {
    return { shape: 'ellipse', offsetX: 0, offsetZ: -2.7, radiusX: 1.8, radiusZ: 1.9 };
  }
  if (kind === ResourceNodeKind.Tree) {
    return { shape: 'ellipse', offsetX: 0, offsetZ: -0.75, radiusX: 0.72, radiusZ: 0.92 };
  }
  return { shape: 'ellipse', offsetX: 0, offsetZ: -0.22, radiusX: 0.72, radiusZ: 0.55 };
}
