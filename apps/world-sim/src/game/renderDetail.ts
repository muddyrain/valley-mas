import type { TerritorySource, VillageBuilding } from '../sim/types';
import type { CameraDetailLevel } from './cameraMath';

type RenderDensityInput = {
  detailLevel: CameraDetailLevel;
  visibleVillages: number;
  visibleBuildings: number;
  visibleResourceTiles: number;
  visibleUnits: number;
  visibleArmies: number;
  visibleWorkSites: number;
};

type TerritoryFillAlphaInput = {
  surface: 'land' | 'water';
  source: TerritorySource;
  hasKingdom: boolean;
  selected: boolean;
};

export function shouldDrawFarmlandAtDetail(detailLevel: CameraDetailLevel) {
  return detailLevel === 'local';
}

export function getDensityAdjustedDetailLevel(input: RenderDensityInput): CameraDetailLevel {
  if (input.detailLevel !== 'local') {
    return input.detailLevel;
  }

  if (
    input.visibleVillages >= 18 ||
    input.visibleBuildings >= 120 ||
    input.visibleResourceTiles >= 220 ||
    input.visibleUnits >= 260 ||
    input.visibleArmies >= 8 ||
    input.visibleWorkSites >= 70
  ) {
    return 'regional';
  }

  return input.detailLevel;
}

export function shouldDrawBuildingAtDetail(
  building: Pick<VillageBuilding, 'status' | 'type'>,
  detailLevel: CameraDetailLevel,
) {
  if (detailLevel === 'overview') {
    return false;
  }

  if (detailLevel === 'regional') {
    return (
      building.type === 'town_hall' ||
      building.status === 'constructing' ||
      building.status === 'abandoned' ||
      building.status === 'ruined'
    );
  }

  return true;
}

export function getTerritoryFillAlpha(input: TerritoryFillAlphaInput) {
  const surfaceBase = getTerritorySurfaceBaseAlpha(input);
  return surfaceBase * getTerritorySourceAlphaMultiplier(input.source);
}

function getTerritorySurfaceBaseAlpha(input: TerritoryFillAlphaInput) {
  if (input.selected) {
    return input.surface === 'water' ? 0.08 : 0.14;
  }

  if (input.surface === 'water') {
    return input.hasKingdom ? 0.11 : 0.04;
  }

  return input.hasKingdom ? 0.2 : 0.07;
}

function getTerritorySourceAlphaMultiplier(source: TerritorySource) {
  switch (source) {
    case 'frontier':
      return 0.45;
    case 'work_site':
      return 0.55;
    default:
      return 1;
  }
}
