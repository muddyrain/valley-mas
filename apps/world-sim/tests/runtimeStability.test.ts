import { describe, expect, it, vi } from 'vitest';
import type { BorderEdge, MapData, Province, TerrainKind } from '../src/core/map';
import {
  assertContiguous,
  buildFrontPressureState,
  computeCapitalsAndCentroids,
  getDefenderPressureTargetWeight,
  getFrontPressureOverlaySegments,
  resetContiguityWatch,
  resolveFrontBattlePressure,
  runExpansionTick,
  summarizeFactionFrontPressure,
} from '../src/core/sim';
import { createPrngFromSeed } from '../src/shared/math';
import type { FactionId, FactionSummary, RegionId } from '../src/shared/types';
import { asFactionId, asRegionId, asTick } from '../src/shared/types';

const FACTION_A = asFactionId(1);
const FACTION_B = asFactionId(2);
const FACTION_C = asFactionId(3);

function createProvince(input: {
  id: number;
  owner?: FactionId | null;
  neighbors?: number[];
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
    neighbors: (input.neighbors ?? []).map((neighbor) => asRegionId(neighbor)),
    borderEdgeIds: [],
    centroid: { x, y },
    terrain: input.terrain ?? 'plain',
    elevation: 0,
    moisture: 0,
    ownerFactionId: input.owner ?? null,
  };
}

function createMap(provinces: Province[], borders: BorderEdge[] = []): MapData {
  return {
    meta: {
      seed: 'runtime-stability-test',
      provinceCount: provinces.length,
      relaxIterations: 0,
      bounds: { width: 100, height: 100 },
    },
    provinces,
    borders,
  };
}

function createFaction(input: {
  id: FactionId;
  name?: string;
  regions?: number;
  capitalRegionId?: RegionId | null;
  centroidRegionId?: RegionId | null;
}): FactionSummary {
  return {
    id: input.id,
    name: input.name ?? `Faction ${input.id as unknown as number}`,
    leader: 'Leader',
    colorHex: '#ffffff',
    birthRegionId: input.capitalRegionId ?? null,
    capitalRegionId: input.capitalRegionId ?? null,
    centroidRegionId: input.centroidRegionId ?? input.capitalRegionId ?? null,
    regions: input.regions ?? 0,
    population: 0,
  };
}

describe('runtime stability guardrails', () => {
  it('keeps expansion tick stable for empty maps and stale owners', () => {
    const empty = createMap([]);
    expect(() =>
      runExpansionTick({
        tick: asTick(1),
        map: empty,
        factions: [],
        rng: createPrngFromSeed('empty-map'),
      }),
    ).not.toThrow();

    const staleOwnerMap = createMap([createProvince({ id: 0, owner: asFactionId(99) })]);
    const result = runExpansionTick({
      tick: asTick(2),
      map: staleOwnerMap,
      factions: [createFaction({ id: FACTION_A })],
      rng: createPrngFromSeed('stale-owner'),
    });

    expect(result).toEqual({ patches: [], events: [] });
  });

  it('handles victory and stalemate edge cases without requiring front data', () => {
    const singleOwned = createMap([createProvince({ id: 0, owner: FACTION_A })]);
    const victory = runExpansionTick({
      tick: asTick(3),
      map: singleOwned,
      factions: [createFaction({ id: FACTION_A, regions: 1 })],
      rng: createPrngFromSeed('single-owned'),
    });
    expect(victory.events.some((event) => event.type === 'victory')).toBe(true);

    const blockedIslands = createMap([
      createProvince({ id: 0, owner: FACTION_A }),
      createProvince({ id: 1, owner: FACTION_B }),
    ]);
    const stalemate = runExpansionTick({
      tick: asTick(4),
      map: blockedIslands,
      factions: [
        createFaction({ id: FACTION_A, regions: 1 }),
        createFaction({ id: FACTION_B, regions: 1 }),
      ],
      rng: createPrngFromSeed('blocked-islands'),
    });
    expect(stalemate.events.some((event) => event.type === 'stalemate')).toBe(true);
  });

  it('survives malformed neighbor references and still captures reachable targets', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1, 99], x: 0 }),
      createProvince({ id: 1, owner: null, neighbors: [0], x: 10 }),
    ]);

    const result = runExpansionTick({
      tick: asTick(5),
      map,
      factions: [createFaction({ id: FACTION_A, regions: 1 })],
      rng: createPrngFromSeed('dangling-neighbor'),
      attemptsPerTick: 3,
    });

    expect(result.patches.length).toBeGreaterThanOrEqual(1);
    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(1),
      fromOwnerId: null,
      toOwnerId: FACTION_A,
    });
  });

  it('keeps front pressure APIs stable when data is partial or missing', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0, 2], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [1], x: 20 }),
    ]);
    const state = buildFrontPressureState({
      map,
      factions: [
        { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(999) },
        { id: FACTION_B, regions: 2, centroidRegionId: null },
      ],
      ownedTargetPreference: 0.7,
    });

    expect(state.fronts.size).toBe(1);
    expect(getDefenderPressureTargetWeight(state, FACTION_C)).toBe(1);
    expect(() =>
      summarizeFactionFrontPressure({
        state,
        faction: { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(999) },
      }),
    ).not.toThrow();

    const missingFrontPressure = resolveFrontBattlePressure({
      state,
      map,
      attackerId: FACTION_A,
      defenderId: FACTION_C,
      targetRegion: asRegionId(999),
      ownerOf: () => null,
    });
    expect(missingFrontPressure).toMatchObject({
      attackerPower: 0,
      defenderPower: 0,
      frontBias: 0,
      localSurroundBias: 0,
      attackerSupply: 1,
      multiFrontPenalty: 0,
    });
  });

  it('ignores broken or non-hostile border edges in pressure overlays', () => {
    const map = createMap(
      [
        createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
        createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
      ],
      [
        {
          a: { x: 5, y: 0 },
          b: { x: 5, y: 10 },
          left: asRegionId(0),
          right: asRegionId(1),
        },
        {
          a: { x: 50, y: 0 },
          b: { x: 50, y: 10 },
          left: asRegionId(99),
          right: asRegionId(100),
        },
        {
          a: { x: 0, y: 0 },
          b: { x: 0, y: 10 },
          left: asRegionId(0),
          right: null,
        },
      ],
    );
    const state = buildFrontPressureState({
      map,
      factions: [
        { id: FACTION_A, regions: 1, centroidRegionId: asRegionId(0) },
        { id: FACTION_B, regions: 1, centroidRegionId: asRegionId(1) },
      ],
      ownedTargetPreference: 0,
    });

    const segments = getFrontPressureOverlaySegments({ map, state });
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      leftFactionId: FACTION_A,
      rightFactionId: FACTION_B,
    });
  });

  it('keeps capital recompute stable for eliminated factions and stale capitals', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, x: 0 }),
      createProvince({ id: 1, owner: FACTION_A, x: 10 }),
      createProvince({ id: 2, owner: null, x: 20 }),
    ]);

    const result = computeCapitalsAndCentroids(map, [
      { id: FACTION_A, capitalRegionId: asRegionId(2) },
      { id: FACTION_B, capitalRegionId: asRegionId(999) },
    ]);

    expect(result.get(FACTION_A)?.capital).not.toBe(asRegionId(2));
    expect(result.get(FACTION_A)?.centroid).not.toBeNull();
    expect(result.get(FACTION_B)).toEqual({ capital: null, centroid: null });
  });

  it('limits contiguity diagnostics to warnings instead of throwing', () => {
    resetContiguityWatch();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const splitRealm = createMap([
        createProvince({ id: 0, owner: FACTION_A }),
        createProvince({ id: 1, owner: FACTION_A }),
      ]);
      expect(() => assertContiguous(splitRealm, new Map())).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
      resetContiguityWatch();
    }
  });
});
