import { describe, expect, it } from 'vitest';
import { getSmallRealmCollapseBias, getTempoConfig, smoothstep } from '../src/core/sim/tempo';
import {
  SIM_SPEED_MULTIPLIER,
  SIM_SPEED_TIERS,
  SPEEDUP_MAX_MULTIPLIER,
  SMALL_REALM_COLLAPSE_MAX_BONUS,
  SMALL_REALM_COLLAPSE_REGION_THRESHOLD,
  STRENGTH_BIAS_SCALE_DOMINANT,
  STRENGTH_BIAS_SCALE_NORMAL,
  WAR_PREFERENCE_MAX,
  WAR_PREFERENCE_MIN,
} from '../src/shared/types';

const TICKS_PER_YEAR = 4;

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
});
