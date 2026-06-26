import { describe, expect, it } from 'vitest';
import type { MapData, Province, TerrainKind } from '../src/core/map';
import {
  buildFrontPressureState,
  getDefenderPressureTargetWeight,
  getFrontPressureOverlaySegments,
  resolveFrontBattlePressure,
  summarizeFactionFrontPressure,
} from '../src/core/sim/frontPressure';
import { getSmallRealmCollapseBias, getTempoConfig, smoothstep } from '../src/core/sim/tempo';
import {
  asFactionId,
  asRegionId,
  SIM_SPEED_MULTIPLIER,
  SIM_SPEED_TIERS,
  SMALL_REALM_COLLAPSE_MAX_BONUS,
  SMALL_REALM_COLLAPSE_REGION_THRESHOLD,
  SPEEDUP_MAX_MULTIPLIER,
  STRENGTH_BIAS_SCALE_DOMINANT,
  STRENGTH_BIAS_SCALE_NORMAL,
  WAR_PREFERENCE_MAX,
  WAR_PREFERENCE_MIN,
} from '../src/shared/types';

const TICKS_PER_YEAR = 4;
const FACTION_A = asFactionId(1);
const FACTION_B = asFactionId(2);
const FACTION_C = asFactionId(3);
const FACTION_D = asFactionId(4);

type TempoWindowInput = {
  startYear: number;
  endYear: number;
  startOccupied: number;
  endOccupied: number;
  startLive: number;
  endLive: number;
  startLargestShare: number;
  endLargestShare: number;
};

function sampleWindow(input: TempoWindowInput) {
  const startTick = input.startYear * TICKS_PER_YEAR;
  const endTick = input.endYear * TICKS_PER_YEAR;
  const rows = [];

  for (let tick = startTick; tick <= endTick; tick += TICKS_PER_YEAR) {
    const progress = (tick - startTick) / Math.max(1, endTick - startTick);
    const occupiedRatio =
      input.startOccupied + (input.endOccupied - input.startOccupied) * progress;
    const liveCount = Math.round(input.startLive + (input.endLive - input.startLive) * progress);
    const largestFactionShare =
      input.startLargestShare + (input.endLargestShare - input.startLargestShare) * progress;

    rows.push({
      year: tick / TICKS_PER_YEAR,
      occupiedRatio,
      liveCount,
      largestFactionShare,
      ...getTempoConfig({ occupiedRatio, liveCount, largestFactionShare }),
    });
  }

  return rows;
}

function createProvince(input: {
  id: number;
  owner: number | null;
  neighbors: number[];
  terrain?: TerrainKind;
  x?: number;
  y?: number;
}): Province {
  const x = input.x ?? input.id * 10;
  const y = input.y ?? 0;
  return {
    id: asRegionId(input.id),
    site: { x, y },
    polygon: [],
    neighbors: input.neighbors.map((neighbor) => asRegionId(neighbor)),
    borderEdgeIds: [],
    centroid: { x, y },
    terrain: input.terrain ?? 'plain',
    elevation: 0,
    moisture: 0,
    ownerFactionId: input.owner == null ? null : asFactionId(input.owner),
  };
}

function createMap(provinces: Province[]): MapData {
  return {
    meta: {
      seed: 'front-pressure-test',
      provinceCount: provinces.length,
      relaxIterations: 0,
      bounds: { width: 100, height: 100 },
    },
    provinces,
    borders: [],
  };
}

function createBorderedMap(provinces: Province[]): MapData {
  return {
    ...createMap(provinces),
    borders: [
      {
        a: { x: 5, y: 0 },
        b: { x: 5, y: 10 },
        left: asRegionId(0),
        right: asRegionId(1),
      },
      {
        a: { x: 15, y: 0 },
        b: { x: 15, y: 10 },
        left: asRegionId(1),
        right: asRegionId(2),
      },
    ],
  };
}

describe('balance pacing tempo', () => {
  it('keeps 0-50 years mostly in early expansion tempo', () => {
    const earlyWindow = sampleWindow({
      startYear: 0,
      endYear: 50,
      startOccupied: 0.02,
      endOccupied: 0.45,
      startLive: 8,
      endLive: 8,
      startLargestShare: 0.13,
      endLargestShare: 0.2,
    });

    expect(earlyWindow).toHaveLength(51);
    expect(earlyWindow.every((row) => row.speedMultiplier === 1)).toBe(true);
    expect(earlyWindow.every((row) => row.isEndgame === false)).toBe(true);
    expect(earlyWindow.every((row) => row.attempts === 100)).toBe(true);
    expect(earlyWindow[0].ownedTargetPreference).toBe(WAR_PREFERENCE_MIN);
    expect(earlyWindow[earlyWindow.length - 1].ownedTargetPreference).toBeGreaterThan(
      WAR_PREFERENCE_MIN,
    );
    expect(earlyWindow[earlyWindow.length - 1].ownedTargetPreference).toBeLessThan(0.25);
  });

  it('lets 150-300 years smoothly enter hegemony and late acceleration', () => {
    const hegemonyWindow = sampleWindow({
      startYear: 150,
      endYear: 300,
      startOccupied: 0.55,
      endOccupied: 0.94,
      startLive: 6,
      endLive: 4,
      startLargestShare: 0.3,
      endLargestShare: 0.55,
    });

    expect(hegemonyWindow[0].ownedTargetPreference).toBeGreaterThan(0.2);
    expect(hegemonyWindow[hegemonyWindow.length - 1].ownedTargetPreference).toBeCloseTo(
      WAR_PREFERENCE_MAX,
      2,
    );
    expect(hegemonyWindow[0].speedMultiplier).toBe(1);
    expect(hegemonyWindow[hegemonyWindow.length - 1].speedMultiplier).toBeGreaterThan(1.5);
    expect(hegemonyWindow[0].strengthBiasScale).toBe(STRENGTH_BIAS_SCALE_NORMAL);
    expect(hegemonyWindow[hegemonyWindow.length - 1].strengthBiasScale).toBeLessThan(0.5);
  });

  it('accelerates smoothly when occupation is nearly complete or live factions collapse', () => {
    expect(
      getTempoConfig({ occupiedRatio: 0.96, liveCount: 4, largestFactionShare: 0.5 }),
    ).toMatchObject({
      isEndgame: true,
    });
    expect(
      getTempoConfig({ occupiedRatio: 0.98, liveCount: 8, largestFactionShare: 0.5 }),
    ).toMatchObject({
      isEndgame: true,
      speedMultiplier: SPEEDUP_MAX_MULTIPLIER,
      attempts: 200,
    });
    expect(
      getTempoConfig({ occupiedRatio: 0.8, liveCount: 3, largestFactionShare: 0.5 }),
    ).toMatchObject({
      isEndgame: true,
      speedMultiplier: SPEEDUP_MAX_MULTIPLIER,
      attempts: 96,
    });
  });

  it('supports smoothstep boundaries and reversed live-count curves', () => {
    expect(smoothstep(0.35, 0.92, 0.2)).toBe(0);
    expect(smoothstep(0.35, 0.92, 0.92)).toBe(1);
    expect(smoothstep(6, 3, 6)).toBe(0);
    expect(smoothstep(6, 3, 3)).toBe(1);
  });

  it('reduces strength bias scale for dominant factions', () => {
    expect(
      getTempoConfig({ occupiedRatio: 0.6, liveCount: 6, largestFactionShare: 0.2 })
        .strengthBiasScale,
    ).toBe(STRENGTH_BIAS_SCALE_NORMAL);
    expect(
      getTempoConfig({ occupiedRatio: 0.6, liveCount: 6, largestFactionShare: 0.7 })
        .strengthBiasScale,
    ).toBe(STRENGTH_BIAS_SCALE_DOMINANT);
  });

  it('adds late-game collapse pressure only for tiny realms', () => {
    expect(getSmallRealmCollapseBias(0.6, 3)).toBe(0);
    expect(getSmallRealmCollapseBias(0.96, SMALL_REALM_COLLAPSE_REGION_THRESHOLD)).toBe(0);
    expect(getSmallRealmCollapseBias(0.96, 3)).toBeGreaterThan(0);
    expect(getSmallRealmCollapseBias(1, 1)).toBe(SMALL_REALM_COLLAPSE_MAX_BONUS);
  });

  it('exposes 16x as the highest live simulation speed tier', () => {
    expect(SIM_SPEED_TIERS).toContain('16x');
    expect(SIM_SPEED_TIERS[SIM_SPEED_TIERS.length - 1]).toBe('16x');
    expect(SIM_SPEED_MULTIPLIER['16x']).toBe(16);
  });

  it('uses aggregate front pressure without soldier entities', () => {
    const map = createMap([
      createProvince({ id: 0, owner: 1, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: 2, neighbors: [0], x: 10 }),
    ]);
    const state = buildFrontPressureState({
      map,
      factions: [
        { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) },
        { id: FACTION_B, regions: 1, centroidRegionId: asRegionId(1) },
      ],
      ownedTargetPreference: 0.15,
    });
    const pressure = resolveFrontBattlePressure({
      state,
      map,
      attackerId: FACTION_A,
      defenderId: FACTION_B,
      targetRegion: asRegionId(1),
      ownerOf: (id) => map.provinces[id as unknown as number]?.ownerFactionId ?? null,
    });

    expect(pressure.frontBias).toBe(0);
    expect(pressure.multiFrontPenalty).toBe(0);
    expect(pressure.attackerFrontCount).toBe(1);
    expect(pressure.defenderFrontCount).toBe(1);
  });

  it('increases target pressure for factions fighting on multiple fronts', () => {
    const map = createMap([
      createProvince({ id: 0, owner: 1, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: 2, neighbors: [0, 2], x: 10 }),
      createProvince({ id: 2, owner: 3, neighbors: [1], x: 20 }),
    ]);
    const state = buildFrontPressureState({
      map,
      factions: [
        { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) },
        { id: FACTION_B, regions: 1, centroidRegionId: asRegionId(1) },
        { id: FACTION_C, regions: 1, centroidRegionId: asRegionId(2) },
      ],
      ownedTargetPreference: 0.45,
    });
    const pressure = resolveFrontBattlePressure({
      state,
      map,
      attackerId: FACTION_A,
      defenderId: FACTION_B,
      targetRegion: asRegionId(1),
      ownerOf: (id) => map.provinces[id as unknown as number]?.ownerFactionId ?? null,
    });

    expect(pressure.defenderFrontCount).toBe(2);
    expect(getDefenderPressureTargetWeight(state, FACTION_B)).toBeGreaterThan(
      getDefenderPressureTargetWeight(state, FACTION_A),
    );
  });

  it('summarizes factions without hostile fronts as no pressure', () => {
    const map = createMap([createProvince({ id: 0, owner: 1, neighbors: [] })]);
    const faction = { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) };
    const state = buildFrontPressureState({
      map,
      factions: [faction],
      ownedTargetPreference: 0.15,
    });
    const summary = summarizeFactionFrontPressure({ state, faction });

    expect(summary).toMatchObject({
      factionId: FACTION_A,
      frontCount: 0,
      pressureLevel: 'none',
      totalWarPotential: 100,
      averageSupply: 1,
      multiFrontPenalty: 0,
      fronts: [],
    });
    expect(summary.highestRiskFront).toBeUndefined();
  });

  it('summarizes one-front factions as low pressure', () => {
    const map = createMap([
      createProvince({ id: 0, owner: 1, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: 2, neighbors: [0], x: 10 }),
    ]);
    const faction = { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) };
    const state = buildFrontPressureState({
      map,
      factions: [faction, { id: FACTION_B, regions: 1, centroidRegionId: asRegionId(1) }],
      ownedTargetPreference: 0.15,
    });
    const summary = summarizeFactionFrontPressure({ state, faction });

    expect(summary.frontCount).toBe(1);
    expect(summary.pressureLevel).toBe('low');
    expect(summary.averageSupply).toBe(1);
    expect(summary.fronts).toHaveLength(1);
    expect(summary.highestRiskFront).toMatchObject({
      enemyId: FACTION_B,
      contactEdges: 1,
      myPower: 100,
      enemyPower: 100,
    });
  });

  it('summarizes multi-front factions as high pressure and picks the riskiest front', () => {
    const map = createMap([
      createProvince({ id: 0, owner: 1, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: 2, neighbors: [0, 2, 3], x: 10 }),
      createProvince({ id: 2, owner: 3, neighbors: [1], x: 20 }),
      createProvince({ id: 3, owner: 4, neighbors: [1], x: 30 }),
    ]);
    const faction = { id: FACTION_B, regions: 1, centroidRegionId: asRegionId(1) };
    const state = buildFrontPressureState({
      map,
      factions: [
        { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) },
        faction,
        { id: FACTION_C, regions: 6, centroidRegionId: asRegionId(2) },
        { id: FACTION_D, regions: 1, centroidRegionId: asRegionId(3) },
      ],
      ownedTargetPreference: 0.45,
    });
    const summary = summarizeFactionFrontPressure({ state, faction });

    expect(summary.frontCount).toBe(3);
    expect(summary.pressureLevel).toBe('high');
    expect(summary.multiFrontPenalty).toBeGreaterThan(0);
    expect(summary.fronts).toHaveLength(3);
    expect(summary.highestRiskFront?.enemyId).toBe(FACTION_C);
    expect(summary.highestRiskFront?.riskScore).toBeGreaterThan(summary.fronts[1].riskScore);
  });

  it('creates lightweight overlay segments only for hostile borders', () => {
    const map = createBorderedMap([
      createProvince({ id: 0, owner: 1, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: 2, neighbors: [0, 2], x: 10 }),
      createProvince({ id: 2, owner: 2, neighbors: [1], x: 20 }),
    ]);
    const state = buildFrontPressureState({
      map,
      factions: [
        { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) },
        { id: FACTION_B, regions: 2, centroidRegionId: asRegionId(1) },
      ],
      ownedTargetPreference: 0.15,
    });
    const segments = getFrontPressureOverlaySegments({ map, state });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      leftFactionId: FACTION_A,
      rightFactionId: FACTION_B,
    });
    expect(segments[0].intensity).toBeGreaterThanOrEqual(0.25);
    expect(segments[0].intensity).toBeLessThanOrEqual(1);
    expect(segments[0].width).toBeGreaterThan(1);
  });
});
