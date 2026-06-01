import { describe, expect, it } from 'vitest';
import {
  getDensityAdjustedDetailLevel,
  getTerritoryFillAlpha,
  shouldDrawBuildingAtDetail,
  shouldDrawFarmlandAtDetail,
} from './renderDetail';

describe('render detail helpers', () => {
  it('hides per-building clutter outside local zoom', () => {
    expect(shouldDrawBuildingAtDetail({ type: 'house', status: 'active' }, 'overview')).toBe(false);
    expect(shouldDrawBuildingAtDetail({ type: 'house', status: 'active' }, 'regional')).toBe(false);
    expect(shouldDrawBuildingAtDetail({ type: 'house', status: 'active' }, 'local')).toBe(true);
  });

  it('keeps map-level building signals visible in regional zoom', () => {
    expect(shouldDrawBuildingAtDetail({ type: 'town_hall', status: 'active' }, 'regional')).toBe(
      true,
    );
    expect(shouldDrawBuildingAtDetail({ type: 'farm', status: 'constructing' }, 'regional')).toBe(
      true,
    );
    expect(shouldDrawBuildingAtDetail({ type: 'storage', status: 'ruined' }, 'regional')).toBe(
      true,
    );
  });

  it('only draws farmland at local zoom', () => {
    expect(shouldDrawFarmlandAtDetail('overview')).toBe(false);
    expect(shouldDrawFarmlandAtDetail('regional')).toBe(false);
    expect(shouldDrawFarmlandAtDetail('local')).toBe(true);
  });

  it('downgrades dense local views to regional detail', () => {
    expect(
      getDensityAdjustedDetailLevel({
        detailLevel: 'local',
        visibleVillages: 23,
        visibleBuildings: 163,
        visibleResourceTiles: 300,
        visibleUnits: 303,
        visibleArmies: 9,
        visibleWorkSites: 80,
      }),
    ).toBe('regional');
    expect(
      getDensityAdjustedDetailLevel({
        detailLevel: 'local',
        visibleVillages: 4,
        visibleBuildings: 30,
        visibleResourceTiles: 80,
        visibleUnits: 40,
        visibleArmies: 2,
        visibleWorkSites: 8,
      }),
    ).toBe('local');
  });

  it('keeps selected territory outline-led without visible fill bands', () => {
    expect(
      getTerritoryFillAlpha({
        surface: 'land',
        source: 'settlement_core',
        hasKingdom: true,
        selected: true,
      }),
    ).toBe(0);
    expect(
      getTerritoryFillAlpha({
        surface: 'water',
        source: 'settlement_core',
        hasKingdom: true,
        selected: true,
      }),
    ).toBe(0);
  });

  it('keeps territory fill invisible so it cannot create map banding', () => {
    expect(
      getTerritoryFillAlpha({
        surface: 'land',
        source: 'settlement_core',
        hasKingdom: true,
        selected: false,
      }),
    ).toBe(0);
    expect(
      getTerritoryFillAlpha({
        surface: 'water',
        source: 'settlement_core',
        hasKingdom: true,
        selected: false,
      }),
    ).toBe(0);
    expect(
      getTerritoryFillAlpha({
        surface: 'land',
        source: 'frontier',
        hasKingdom: true,
        selected: false,
      }),
    ).toBe(0);
  });

  it('keeps frontier territory no stronger than settlement core territory', () => {
    const core = getTerritoryFillAlpha({
      surface: 'land',
      source: 'settlement_core',
      hasKingdom: true,
      selected: false,
    });
    const frontier = getTerritoryFillAlpha({
      surface: 'land',
      source: 'frontier',
      hasKingdom: true,
      selected: false,
    });

    expect(frontier).toBeLessThanOrEqual(core);
  });
});
