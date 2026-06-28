import type { MapData, Province, TerrainKind } from '@/core/map';

export interface RegionStrategicProfile {
  fertility: number;
  defensiveness: number;
  travelCost: number;
  habitability: number;
  strategicValue: number;
}

export interface StrategicValueOverlayRegion extends RegionStrategicProfile {
  regionId: Province['id'];
}

interface TerrainStrategyBase {
  fertility: number;
  defensiveness: number;
  travelCost: number;
  habitability: number;
  strategicBias: number;
}

const TERRAIN_STRATEGY_BASE: Record<TerrainKind, TerrainStrategyBase> = {
  plain: {
    fertility: 0.72,
    defensiveness: 0.34,
    travelCost: 1,
    habitability: 0.78,
    strategicBias: 0.52,
  },
  forest: {
    fertility: 0.62,
    defensiveness: 0.5,
    travelCost: 1.24,
    habitability: 0.65,
    strategicBias: 0.55,
  },
  mountain: {
    fertility: 0.22,
    defensiveness: 0.86,
    travelCost: 1.82,
    habitability: 0.18,
    strategicBias: 0.5,
  },
  desert: {
    fertility: 0.18,
    defensiveness: 0.24,
    travelCost: 1.34,
    habitability: 0.22,
    strategicBias: 0.24,
  },
  river: {
    fertility: 0.82,
    defensiveness: 0.44,
    travelCost: 1.12,
    habitability: 0.82,
    strategicBias: 0.72,
  },
  ocean: {
    fertility: 0,
    defensiveness: 0,
    travelCost: 99,
    habitability: 0,
    strategicBias: 0,
  },
};

export function computeRegionStrategicProfile(province: Province): RegionStrategicProfile {
  const base = TERRAIN_STRATEGY_BASE[province.terrain];
  if (province.terrain === 'ocean') {
    return {
      fertility: 0,
      defensiveness: 0,
      travelCost: 99,
      habitability: 0,
      strategicValue: 0,
    };
  }

  const elevation = clamp01(province.elevation);
  const moisture = clamp01(province.moisture);
  const fertility = clamp01(base.fertility + moisture * 0.22 - elevation * 0.18);
  const habitability = clamp01(base.habitability + moisture * 0.18 - elevation * 0.25);
  const defensiveness = clamp01(base.defensiveness + elevation * 0.18);
  const travelCost = Math.max(0.5, base.travelCost + elevation * 0.24 - moisture * 0.05);
  const strategicValue = clamp01(
    fertility * 0.34 +
      habitability * 0.3 +
      defensiveness * 0.16 +
      base.strategicBias * 0.2,
  );

  return {
    fertility,
    defensiveness,
    travelCost,
    habitability,
    strategicValue,
  };
}

export function scoreSettlementProvinceForStrategy(province: Province): number {
  const profile = computeRegionStrategicProfile(province);
  if (province.terrain === 'ocean') return -100;
  return (
    profile.habitability * 5 +
    profile.fertility * 3.5 +
    profile.strategicValue * 1.5 -
    profile.travelCost * 0.8 +
    profile.defensiveness * 0.6
  );
}

export function getStrategicWarTargetWeight(province: Province): number {
  const profile = computeRegionStrategicProfile(province);
  if (province.terrain === 'ocean') return 0;
  return clamp(0.65 + profile.strategicValue * 0.85, 0.35, 1.55);
}

export function getGeographicCombatPenalty(province: Province): number {
  const profile = computeRegionStrategicProfile(province);
  if (province.terrain === 'ocean') return 1;
  const travelPenalty = Math.max(0, profile.travelCost - 1) * 0.08;
  const defensePenalty = profile.defensiveness * 0.08;
  return clamp(travelPenalty + defensePenalty, 0, 0.2);
}

export function getStrategicValueOverlayRegions(map: MapData): StrategicValueOverlayRegion[] {
  const regions: StrategicValueOverlayRegion[] = [];
  for (const province of map.provinces) {
    if (province.terrain === 'ocean') continue;
    const profile = computeRegionStrategicProfile(province);
    regions.push({
      regionId: province.id,
      fertility: round2(profile.fertility),
      defensiveness: round2(profile.defensiveness),
      travelCost: round2(profile.travelCost),
      habitability: round2(profile.habitability),
      strategicValue: round2(profile.strategicValue),
    });
  }
  return regions;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
