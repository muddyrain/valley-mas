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
  void input;
  return 0;
}
