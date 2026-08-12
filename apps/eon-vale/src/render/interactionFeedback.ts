import { BuildingType } from '@/shared/gameTypes';

export interface InteractionGeometry {
  shape: 'circle' | 'ellipse';
  offsetX: number;
  offsetZ: number;
  radiusX: number;
  radiusZ: number;
}

export function interactionStrokeWidth(zoom: number, tone: 'hover' | 'selected'): number {
  const screenPixels = tone === 'selected' ? 1.5 : 1;
  return screenPixels / Math.max(0.25, zoom);
}

export function entityInteractionGeometry(): InteractionGeometry {
  return { shape: 'ellipse', offsetX: 0, offsetZ: -0.12, radiusX: 0.58, radiusZ: 0.23 };
}

export function buildingInteractionGeometry(type: BuildingType): InteractionGeometry {
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
  return { shape: 'ellipse', offsetX: 0, offsetZ: -0.15, radiusX: width / 2, radiusZ: depth / 2 };
}
