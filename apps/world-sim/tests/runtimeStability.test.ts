import { describe, expect, it, vi } from 'vitest';
import type { BorderEdge, MapData, Province, TerrainKind } from '../src/core/map';
import { generateMap } from '../src/core/map';
import { applyScenarioToWorld } from '../src/core/scenario';
import { RANDOM_SCENARIO } from '../src/core/scenario/presets';
import { selectBalancedSpawnRegions } from '../src/core/scenario/spawnBalance';
import {
  advanceSettlementSieges,
  advanceWarStates,
  assertContiguous,
  buildAdminDistanceState,
  buildFrontPressureState,
  computeCapitalsAndCentroids,
  computeRegionStrategicProfile,
  getAdminSupport,
  getDefenderPressureTargetWeight,
  getFrontPressureOverlaySegments,
  getGeographicCombatPenalty,
  getSettlementSiegeOverlayRegions,
  getStrategicValueOverlayRegions,
  getStrategicWarTargetWeight,
  getWarStatusOverlaySegments,
  resetContiguityWatch,
  resolveFrontBattlePressure,
  runExpansionTick,
  scoreSettlementProvinceForStrategy,
  selectBorderWarDeclarations,
  summarizeFactionAdminPressure,
  summarizeFactionFrontPressure,
} from '../src/core/sim';
import { createPrngFromSeed } from '../src/shared/math';
import type { FactionId, FactionSummary, RegionId, SettlementSummary, WarSummary } from '../src/shared/types';
import { asFactionId, asRegionId, asSettlementId, asTick, asWarId } from '../src/shared/types';

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
  elevation?: number;
  moisture?: number;
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
    elevation: input.elevation ?? 0,
    moisture: input.moisture ?? 0,
    ownerFactionId: input.owner ?? null,
  };
}

describe('geographic strategy profile', () => {
  it('derives fertility, defense, travel, habitability and strategic value from terrain', () => {
    const fertileRiver = computeRegionStrategicProfile(
      createProvince({ id: 1, terrain: 'river', elevation: 0.2, moisture: 0.85 }),
    );
    const dryDesert = computeRegionStrategicProfile(
      createProvince({ id: 2, terrain: 'desert', elevation: 0.15, moisture: 0.05 }),
    );
    const mountainPass = computeRegionStrategicProfile(
      createProvince({ id: 3, terrain: 'mountain', elevation: 0.9, moisture: 0.35 }),
    );
    const ocean = computeRegionStrategicProfile(createProvince({ id: 4, terrain: 'ocean' }));

    expect(fertileRiver.fertility).toBeGreaterThan(dryDesert.fertility);
    expect(fertileRiver.habitability).toBeGreaterThan(mountainPass.habitability);
    expect(mountainPass.defensiveness).toBeGreaterThan(fertileRiver.defensiveness);
    expect(mountainPass.travelCost).toBeGreaterThan(fertileRiver.travelCost);
    expect(ocean).toMatchObject({
      fertility: 0,
      defensiveness: 0,
      habitability: 0,
      strategicValue: 0,
    });
  });

  it('scores settlement sites from strategic profile rather than terrain name alone', () => {
    const wetForest = createProvince({
      id: 1,
      terrain: 'forest',
      elevation: 0.12,
      moisture: 0.92,
    });
    const dryPlain = createProvince({
      id: 2,
      terrain: 'plain',
      elevation: 0.22,
      moisture: 0.05,
    });
    const mountain = createProvince({
      id: 3,
      terrain: 'mountain',
      elevation: 0.92,
      moisture: 0.4,
    });

    expect(scoreSettlementProvinceForStrategy(wetForest)).toBeGreaterThan(
      scoreSettlementProvinceForStrategy(dryPlain),
    );
    expect(scoreSettlementProvinceForStrategy(dryPlain)).toBeGreaterThan(
      scoreSettlementProvinceForStrategy(mountain),
    );
  });

  it('turns strategic value and geography into war target and combat modifiers', () => {
    const riverCrossing = createProvince({
      id: 1,
      terrain: 'river',
      elevation: 0.2,
      moisture: 0.86,
    });
    const dryDesert = createProvince({
      id: 2,
      terrain: 'desert',
      elevation: 0.12,
      moisture: 0.02,
    });
    const mountainPass = createProvince({
      id: 3,
      terrain: 'mountain',
      elevation: 0.95,
      moisture: 0.3,
    });

    expect(getStrategicWarTargetWeight(riverCrossing)).toBeGreaterThan(
      getStrategicWarTargetWeight(dryDesert),
    );
    expect(getGeographicCombatPenalty(mountainPass)).toBeGreaterThan(
      getGeographicCombatPenalty(riverCrossing),
    );
  });

  it('creates strategic value overlay regions for land provinces', () => {
    const map = createMap([
      createProvince({ id: 0, terrain: 'river', elevation: 0.1, moisture: 0.9 }),
      createProvince({ id: 1, terrain: 'mountain', elevation: 0.95, moisture: 0.25 }),
      createProvince({ id: 2, terrain: 'ocean' }),
    ]);

    const regions = getStrategicValueOverlayRegions(map);
    const river = regions.find((region) => region.regionId === asRegionId(0));
    const mountain = regions.find((region) => region.regionId === asRegionId(1));

    expect(regions.map((region) => region.regionId)).not.toContain(asRegionId(2));
    expect(river?.strategicValue).toBeGreaterThan(mountain?.strategicValue ?? 1);
    expect(river).toMatchObject({
      fertility: expect.any(Number),
      habitability: expect.any(Number),
      defensiveness: expect.any(Number),
      travelCost: expect.any(Number),
    });
  });
});

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

function countLandComponents(map: MapData): number {
  const seen = new Set<number>();
  let components = 0;

  for (const province of map.provinces) {
    const start = province.id as unknown as number;
    if (province.terrain === 'ocean' || seen.has(start)) continue;

    components += 1;
    seen.add(start);
    const stack = [start];

    while (stack.length > 0) {
      const current = stack.pop() as number;
      const currentProvince = map.provinces[current];
      if (!currentProvince) continue;

      for (const neighborId of currentProvince.neighbors) {
        const neighbor = neighborId as unknown as number;
        const neighborProvince = map.provinces[neighbor];
        if (!neighborProvince || neighborProvince.terrain === 'ocean' || seen.has(neighbor)) {
          continue;
        }
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }
  }

  return components;
}

function countReachableLandWithin(map: MapData, start: number, maxHops: number): number {
  const seen = new Set<number>([start]);
  const queue: Array<{ id: number; hops: number }> = [{ id: start, hops: 0 }];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current.hops >= maxHops) continue;
    const province = map.provinces[current.id];
    if (!province) continue;
    for (const neighborId of province.neighbors) {
      const neighbor = neighborId as unknown as number;
      const neighborProvince = map.provinces[neighbor];
      if (!neighborProvince || neighborProvince.terrain === 'ocean' || seen.has(neighbor)) {
        continue;
      }
      seen.add(neighbor);
      queue.push({ id: neighbor, hops: current.hops + 1 });
    }
  }

  return seen.size;
}

function minPairwiseSpawnDistance(map: MapData, regionIds: RegionId[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < regionIds.length; i++) {
    for (let j = i + 1; j < regionIds.length; j++) {
      const a = map.provinces[regionIds[i] as unknown as number]?.centroid;
      const b = map.provinces[regionIds[j] as unknown as number]?.centroid;
      if (!a || !b) continue;
      minDistance = Math.min(minDistance, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  return minDistance;
}

function minSpawnEdgeDistance(map: MapData, regionIds: RegionId[]): number {
  return regionIds.reduce((minDistance, regionId) => {
    const province = map.provinces[regionId as unknown as number];
    if (!province) return minDistance;
    const edgeDistance = Math.min(
      province.centroid.x,
      province.centroid.y,
      map.meta.bounds.width - province.centroid.x,
      map.meta.bounds.height - province.centroid.y,
    );
    return Math.min(minDistance, edgeDistance);
  }, Number.POSITIVE_INFINITY);
}

function getOceanComponentStats(map: MapData): Array<{ size: number; touchesEdge: boolean }> {
  const seen = new Set<number>();
  const stats: Array<{ size: number; touchesEdge: boolean }> = [];
  const outerBorderIds = new Set<number>();

  map.borders.forEach((edge, index) => {
    if (edge.right == null) outerBorderIds.add(index);
  });

  for (const province of map.provinces) {
    const start = province.id as unknown as number;
    if (province.terrain !== 'ocean' || seen.has(start)) continue;

    let size = 0;
    let touchesEdge = false;
    seen.add(start);
    const stack = [start];

    while (stack.length > 0) {
      const current = stack.pop() as number;
      const currentProvince = map.provinces[current];
      if (!currentProvince) continue;
      size += 1;
      if (currentProvince.borderEdgeIds.some((edgeId) => outerBorderIds.has(edgeId))) {
        touchesEdge = true;
      }

      for (const neighborId of currentProvince.neighbors) {
        const neighbor = neighborId as unknown as number;
        const neighborProvince = map.provinces[neighbor];
        if (!neighborProvince || neighborProvince.terrain !== 'ocean' || seen.has(neighbor)) {
          continue;
        }
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }

    stats.push({ size, touchesEdge });
  }

  return stats;
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
  it('places random scenario spawns with soft geographic balance', () => {
    const map = generateMap({
      seed: 'balanced-random-spawns',
      provinceCount: 3000,
      bounds: { width: 1920, height: 1200 },
      relaxIterations: 2,
    });
    const selected = selectBalancedSpawnRegions({
      map,
      count: 8,
      rng: createPrngFromSeed('balanced-random-spawns:pick'),
    });
    const regionIds = selected.map((item) => item.regionId);
    const localRooms = regionIds.map((regionId) =>
      countReachableLandWithin(map, regionId as unknown as number, 4),
    );
    const minRoom = Math.min(...localRooms);
    const maxRoom = Math.max(...localRooms);

    expect(regionIds).toHaveLength(8);
    expect(new Set(regionIds.map((id) => id as unknown as number)).size).toBe(8);
    expect(minSpawnEdgeDistance(map, regionIds)).toBeGreaterThan(70);
    expect(minPairwiseSpawnDistance(map, regionIds)).toBeGreaterThan(260);
    expect(maxRoom - minRoom).toBeLessThanOrEqual(20);
  });

  it('applies the random scenario through balanced batch spawns', () => {
    const map = generateMap({
      seed: 'balanced-random-scenario',
      provinceCount: 3000,
      bounds: { width: 1920, height: 1200 },
      relaxIterations: 2,
    });
    let nextFactionId = 1;
    const scenario = {
      ...RANDOM_SCENARIO,
      factions:
        RANDOM_SCENARIO.factionsFactory?.(createPrngFromSeed('balanced-random-scenario:names'), {
          includeChinese: true,
          includeForeign: true,
        }) ?? RANDOM_SCENARIO.factions,
    };
    const result = applyScenarioToWorld({
      map,
      scenario,
      rng: createPrngFromSeed('balanced-random-scenario:spawns'),
      mintFactionId: () => asFactionId(nextFactionId++),
    });
    const regionIds = result.factionAssignments.flatMap((assignment) => assignment.spawnRegionIds);

    expect(result.unresolvedCount).toBe(0);
    expect(regionIds).toHaveLength(8);
    expect(minSpawnEdgeDistance(map, regionIds)).toBeGreaterThan(70);
    expect(minPairwiseSpawnDistance(map, regionIds)).toBeGreaterThan(240);
  });

  it('keeps generated land connected when ocean is impassable', () => {
    const map = generateMap({
      seed: 'seed-5mrjxl',
      provinceCount: 3000,
      bounds: { width: 1920, height: 1200 },
      relaxIterations: 2,
    });

    expect(countLandComponents(map)).toBe(1);
  });

  it('keeps edge seas without creating a giant enclosed central lake', () => {
    const map = generateMap({
      seed: 'seed-5mrjxl',
      provinceCount: 3000,
      bounds: { width: 1920, height: 1200 },
      relaxIterations: 2,
    });

    const oceanComponents = getOceanComponentStats(map);
    const hasEdgeSea = oceanComponents.some((component) => component.touchesEdge);
    const largestInteriorLake = oceanComponents
      .filter((component) => !component.touchesEdge)
      .reduce((largest, component) => Math.max(largest, component.size), 0);

    expect(hasEdgeSea).toBe(true);
    expect(largestInteriorLake).toBeLessThanOrEqual(45);
  });

  it('does not let stale ocean ownership expand across water', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, terrain: 'ocean', neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: null, terrain: 'plain', neighbors: [0], x: 10 }),
    ]);

    const result = runExpansionTick({
      tick: asTick(6),
      map,
      factions: [createFaction({ id: FACTION_A, regions: 1 })],
      rng: createPrngFromSeed('stale-ocean-owner'),
      attemptsPerTick: 3,
    });

    expect(result.patches).toEqual([]);
    expect(result.events.every((event) => event.type === 'stalemate')).toBe(true);
  });

  it('does not build front pressure against stale ocean ownership', () => {
    const map = createMap(
      [
        createProvince({ id: 0, owner: FACTION_A, terrain: 'ocean', neighbors: [1], x: 0 }),
        createProvince({ id: 1, owner: FACTION_B, terrain: 'plain', neighbors: [0], x: 10 }),
      ],
      [
        {
          a: { x: 5, y: 0 },
          b: { x: 5, y: 10 },
          left: asRegionId(0),
          right: asRegionId(1),
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

    expect(state.fronts.size).toBe(0);
    expect(getFrontPressureOverlaySegments({ map, state })).toEqual([]);
  });

  it('keeps disconnected land enclaves owned instead of flickering to neutral', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0, 2], x: 10 }),
      createProvince({ id: 2, owner: FACTION_A, neighbors: [1], x: 20 }),
    ]);

    const result = runExpansionTick({
      tick: asTick(7),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 2, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 1, capitalRegionId: asRegionId(1) }),
      ],
      rng: createPrngFromSeed('stale-land-enclave'),
      attemptsPerTick: 0,
    });

    expect(result.patches).toEqual([]);
  });

  it('does not let disconnected enclaves act as expansion sources', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [], x: 0 }),
      createProvince({ id: 1, owner: FACTION_A, neighbors: [2], x: 10 }),
      createProvince({ id: 2, owner: null, neighbors: [1], x: 20 }),
    ]);

    const result = runExpansionTick({
      tick: asTick(8),
      map,
      factions: [createFaction({ id: FACTION_A, regions: 2, capitalRegionId: asRegionId(0) })],
      rng: createPrngFromSeed('isolated-enclave-source'),
      attemptsPerTick: 5,
    });

    expect(result.patches).toEqual([]);
  });

  it('slows far frontier neutral expansion instead of making every empty region a free capture', () => {
    const provinces: Province[] = [];
    for (let id = 0; id < 90; id++) {
      provinces.push(
        createProvince({
          id,
          owner: id < 20 ? FACTION_A : null,
          neighbors: [id - 1, id + 1].filter((neighbor) => neighbor >= 0 && neighbor < 90),
          x: id * 40,
        }),
      );
    }
    const map = {
      ...createMap(provinces),
      meta: {
        seed: 'far-frontier-neutral-expansion',
        provinceCount: provinces.length,
        relaxIterations: 0,
        bounds: { width: 3600, height: 100 },
      },
    };

    const result = runExpansionTick({
      tick: asTick(9),
      map,
      factions: [createFaction({ id: FACTION_A, regions: 20, capitalRegionId: asRegionId(0) })],
      rng: createPrngFromSeed('far-frontier-neutral-expansion'),
      attemptsPerTick: 60,
    });

    expect(result.patches.length).toBeGreaterThan(0);
    expect(result.patches.length).toBeLessThan(30);
    expect(result.patches.every((patch) => patch.fromOwnerId == null)).toBe(true);
  });

  it('uses the nearest settlement as the administrative support source', () => {
    const map = createMap(
      Array.from({ length: 30 }, (_, id) =>
        createProvince({
          id,
          owner: FACTION_A,
          neighbors: [id - 1, id + 1].filter((neighbor) => neighbor >= 0 && neighbor < 30),
          x: id * 10,
        }),
      ),
    );
    const faction = createFaction({
      id: FACTION_A,
      regions: 30,
      capitalRegionId: asRegionId(0),
      centroidRegionId: asRegionId(15),
    });

    const capitalOnly = buildAdminDistanceState({ map, factions: [faction] });
    const supportedFrontier = buildAdminDistanceState({
      map,
      factions: [faction],
      settlements: [
        {
          id: asSettlementId(1),
          factionId: FACTION_A,
          name: '都城',
          regionId: asRegionId(0),
          tier: 'capital',
          population: 1000,
          development: 1,
          influenceRadius: 5,
          isCapital: true,
          foundedTick: asTick(0),
        },
        {
          id: asSettlementId(2),
          factionId: FACTION_A,
          name: '前线镇',
          regionId: asRegionId(24),
          tier: 'town',
          population: 600,
          development: 0.7,
          influenceRadius: 4,
          isCapital: false,
          foundedTick: asTick(1),
        },
      ],
    });

    const capitalSupport = getAdminSupport({
      state: capitalOnly,
      faction,
      sourceRegionId: asRegionId(25),
    });
    const frontierSupport = getAdminSupport({
      state: supportedFrontier,
      faction,
      sourceRegionId: asRegionId(25),
    });
    const capitalSummary = summarizeFactionAdminPressure({
      state: capitalOnly,
      faction,
    });
    const frontierSummary = summarizeFactionAdminPressure({
      state: supportedFrontier,
      faction,
    });

    expect(capitalSupport.distance).toBe(25);
    expect(frontierSupport.distance).toBe(1);
    expect(frontierSupport.totalPenalty).toBeLessThan(capitalSupport.totalPenalty);
    expect(frontierSupport.quality).toBeGreaterThan(capitalSupport.quality);
    expect(capitalSummary.pressureLevel).toBe('overextended');
    expect(frontierSummary.averageDistance as number).toBeLessThan(capitalSummary.averageDistance as number);
    expect(frontierSummary.farRegionShare).toBeLessThan(capitalSummary.farRegionShare);
    expect(frontierSummary.pressureLevel).not.toBe('overextended');
  });

  it('counts recent conquest share inside the administrative pressure window', () => {
    const map = createMap(
      Array.from({ length: 10 }, (_, id) =>
        createProvince({
          id,
          owner: FACTION_A,
          neighbors: [id - 1, id + 1].filter((neighbor) => neighbor >= 0 && neighbor < 10),
          x: id * 10,
        }),
      ),
    );
    const faction = createFaction({
      id: FACTION_A,
      regions: 10,
      capitalRegionId: asRegionId(0),
      centroidRegionId: asRegionId(5),
    });
    const state = buildAdminDistanceState({ map, factions: [faction] });
    const recentConquests = new Map([
      [5, asTick(20)],
      [6, asTick(20)],
      [7, asTick(20)],
    ]);

    const fresh = summarizeFactionAdminPressure({
      state,
      faction,
      recentConquests,
      currentTick: asTick(35),
    });
    const agedOut = summarizeFactionAdminPressure({
      state,
      faction,
      recentConquests,
      currentTick: asTick(90),
    });

    expect(fresh.recentConquestShare).toBeCloseTo(0.3);
    expect(agedOut.recentConquestShare).toBe(0);
  });

  it('lets a supported frontier expand into neutral land faster than an unsupported frontier', () => {
    const provinces: Province[] = [];
    for (let id = 0; id < 70; id++) {
      provinces.push(
        createProvince({
          id,
          owner: id < 25 ? FACTION_A : null,
          neighbors: [id - 1, id + 1].filter((neighbor) => neighbor >= 0 && neighbor < 70),
          x: id * 20,
        }),
      );
    }
    const map = {
      ...createMap(provinces),
      meta: {
        seed: 'admin-supported-frontier-expansion',
        provinceCount: provinces.length,
        relaxIterations: 0,
        bounds: { width: 1400, height: 100 },
      },
    };
    const faction = createFaction({
      id: FACTION_A,
      regions: 25,
      capitalRegionId: asRegionId(0),
      centroidRegionId: asRegionId(12),
    });
    const capitalSettlement = {
      id: asSettlementId(1),
      factionId: FACTION_A,
      name: '都城',
      regionId: asRegionId(0),
      tier: 'capital' as const,
      population: 1000,
      development: 1,
      influenceRadius: 5,
      isCapital: true,
      foundedTick: asTick(0),
    };

    const unsupported = runExpansionTick({
      tick: asTick(10),
      map,
      factions: [faction],
      settlements: [capitalSettlement],
      rng: createPrngFromSeed('admin-supported-frontier-expansion'),
      attemptsPerTick: 60,
    });
    const supported = runExpansionTick({
      tick: asTick(10),
      map,
      factions: [faction],
      settlements: [
        capitalSettlement,
        {
          id: asSettlementId(2),
          factionId: FACTION_A,
          name: '前线镇',
          regionId: asRegionId(24),
          tier: 'town',
          population: 800,
          development: 0.7,
          influenceRadius: 4,
          isCapital: false,
          foundedTick: asTick(1),
        },
      ],
      rng: createPrngFromSeed('admin-supported-frontier-expansion'),
      attemptsPerTick: 60,
    });

    expect(supported.patches.length).toBeGreaterThan(unsupported.patches.length);
    expect(supported.patches.every((patch) => patch.fromOwnerId == null)).toBe(true);
  });

  it('prioritizes active revolt war targets over adjacent neutral land', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1, 2], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
      createProvince({ id: 2, owner: null, neighbors: [0], x: 20 }),
    ]);
    const rngValues = [0, 0, 0, 0];
    const rng = {
      next: () => rngValues.shift() ?? 0,
    };

    const result = runExpansionTick({
      tick: asTick(11),
      map,
      factions: [createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) })],
      activeWars: [
        {
          id: asWarId(1),
          kind: 'revolt',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(10),
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(1),
      fromOwnerId: FACTION_B,
      toOwnerId: FACTION_A,
    });
  });

  it('pulls active war attacks toward enemy settlements', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1, 2], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [0], x: 20 }),
    ]);
    const rngValues = [0, 0, 0, 0.3, 0];
    const rng = {
      next: () => rngValues.shift() ?? 0,
    };

    const result = runExpansionTick({
      tick: asTick(11),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 2, capitalRegionId: asRegionId(2) }),
      ],
      settlements: [
        {
          id: asSettlementId(2),
          factionId: FACTION_B,
          name: '乙都',
          regionId: asRegionId(2),
          tier: 'capital',
          population: 1200,
          development: 1,
          influenceRadius: 5,
          isCapital: true,
          foundedTick: asTick(0),
          loyalty: 1,
          unrest: 0,
          revoltProgress: 0,
        },
      ],
      activeWars: [
        {
          id: asWarId(11),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(10),
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(2),
      fromOwnerId: FACTION_B,
      toOwnerId: FACTION_A,
    });
  });

  it('explains settlement fortification in combat logs', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1, 2], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [0], x: 20 }),
    ]);
    const rngValues = [0, 0, 0, 0.3, 0.99];
    const rng = {
      next: () => rngValues.shift() ?? 0,
    };

    const result = runExpansionTick({
      tick: asTick(11),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 2, capitalRegionId: asRegionId(2) }),
      ],
      settlements: [
        {
          id: asSettlementId(2),
          factionId: FACTION_B,
          name: '乙都',
          regionId: asRegionId(2),
          tier: 'capital',
          population: 1200,
          development: 1,
          influenceRadius: 5,
          isCapital: true,
          foundedTick: asTick(0),
          loyalty: 1,
          unrest: 0,
          revoltProgress: 0,
        },
      ],
      activeWars: [
        {
          id: asWarId(12),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(10),
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.events[0].message).toContain('目标=都城');
    expect(result.events[0].message).toContain('围城=');
    expect(result.events[0].message).toContain('城防=-');
  });

  it('explains geographic combat modifiers in combat logs', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], terrain: 'plain', x: 0 }),
      createProvince({
        id: 1,
        owner: FACTION_B,
        neighbors: [0],
        terrain: 'mountain',
        elevation: 0.95,
        moisture: 0.3,
        x: 10,
      }),
    ]);
    const rngValues = [0, 0, 0, 0, 0.99];
    const rng = {
      next: () => rngValues.shift() ?? 0.99,
    };

    const result = runExpansionTick({
      tick: asTick(12),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 1, capitalRegionId: asRegionId(1) }),
      ],
      activeWars: [
        {
          id: asWarId(21),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(10),
          lastContactTick: asTick(11),
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.events[0].message).toContain('地利=-');
    expect(result.events[0].message).toContain('通行=');
    expect(result.events[0].message).toContain('战略=');
  });

  it('uses persistent settlement siege progress in combat logs', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [2], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [2], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [0, 1], x: 20 }),
    ]);
    let rngCallCount = 0;
    const rng = {
      next: () => {
        rngCallCount += 1;
        return rngCallCount <= 3 ? 0 : 0.99;
      },
    };

    const result = runExpansionTick({
      tick: asTick(13),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 2, capitalRegionId: asRegionId(2) }),
      ],
      settlements: [
        {
          id: asSettlementId(2),
          factionId: FACTION_B,
          name: '乙都',
          regionId: asRegionId(2),
          tier: 'capital',
          population: 1200,
          development: 1,
          influenceRadius: 5,
          isCapital: true,
          foundedTick: asTick(0),
          loyalty: 1,
          unrest: 0,
          revoltProgress: 0,
        },
      ],
      activeWars: [
        {
          id: asWarId(13),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(12),
          siegeProgress: [
            {
              settlementId: asSettlementId(2),
              regionId: asRegionId(2),
              attackerFactionId: FACTION_A,
              defenderFactionId: FACTION_B,
              progress: 0.6,
              lastUpdatedTick: asTick(12),
            },
          ],
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.events[0].message).toContain('围城=60%');
  });

  it('turns a maxed settlement siege into a capture even when the attack roll fails', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [2], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [2], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [0, 1], x: 20 }),
    ]);
    let rngCallCount = 0;
    const rng = {
      next: () => {
        rngCallCount += 1;
        return rngCallCount <= 3 ? 0 : 0.99;
      },
    };

    const result = runExpansionTick({
      tick: asTick(14),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 2, capitalRegionId: asRegionId(2) }),
      ],
      settlements: [
        {
          id: asSettlementId(2),
          factionId: FACTION_B,
          name: '乙都',
          regionId: asRegionId(2),
          tier: 'capital',
          population: 1200,
          development: 1,
          influenceRadius: 5,
          isCapital: true,
          foundedTick: asTick(0),
          loyalty: 1,
          unrest: 0,
          revoltProgress: 0,
        },
      ],
      activeWars: [
        {
          id: asWarId(13),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(12),
          siegeProgress: [
            {
              settlementId: asSettlementId(2),
              regionId: asRegionId(2),
              attackerFactionId: FACTION_A,
              defenderFactionId: FACTION_B,
              progress: 0.92,
              lastUpdatedTick: asTick(13),
            },
          ],
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(2),
      fromOwnerId: FACTION_B,
      toOwnerId: FACTION_A,
    });
    expect(result.events[0]).toMatchObject({
      type: 'capture',
      regionId: asRegionId(2),
      attackerId: FACTION_A,
      defenderId: FACTION_B,
    });
    expect(result.events[0].message).toContain('围城=92%');
  });

  it('turns capital shock into a temporary defensive collapse on the warfront', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
    ]);
    let rngCallCount = 0;
    const rng = {
      next: () => {
        rngCallCount += 1;
        return rngCallCount <= 4 ? 0 : 0.82;
      },
    };

    const result = runExpansionTick({
      tick: asTick(21),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 1, capitalRegionId: asRegionId(1) }),
      ],
      activeWars: [
        {
          id: asWarId(15),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(10),
          lastContactTick: asTick(20),
          capitalShocks: [
            {
              factionId: FACTION_B,
              startedTick: asTick(20),
              untilTick: asTick(28),
            },
          ],
        } as WarSummary,
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(1),
      fromOwnerId: FACTION_B,
      toOwnerId: FACTION_A,
    });
    expect(result.events[0].message).toContain('都城震荡=+14%');
  });

  it('advances and clears settlement siege progress from combat events', () => {
    const war = {
      id: asWarId(14),
      kind: 'border' as const,
      status: 'active' as const,
      attackerFactionId: FACTION_A,
      defenderFactionId: FACTION_B,
      startedTick: asTick(10),
      lastContactTick: asTick(10),
    };
    const settlement = {
      id: asSettlementId(4),
      factionId: FACTION_B,
      name: '乙城',
      regionId: asRegionId(4),
      tier: 'city' as const,
      population: 900,
      development: 1,
      influenceRadius: 4,
      isCapital: false,
      foundedTick: asTick(0),
      loyalty: 1,
      unrest: 0,
      revoltProgress: 0,
    };

    const advanced = advanceSettlementSieges({
      wars: [war],
      settlements: [settlement],
      events: [
        {
          tick: asTick(20),
          type: 'repel',
          regionId: asRegionId(4),
          attackerId: FACTION_A,
          defenderId: FACTION_B,
          message: '攻城失利',
        },
      ],
      tick: asTick(20),
    });

    expect(advanced.updatedWars[0]?.siegeProgress?.[0]).toMatchObject({
      settlementId: asSettlementId(4),
      regionId: asRegionId(4),
      attackerFactionId: FACTION_A,
      defenderFactionId: FACTION_B,
      progress: expect.any(Number),
      lastUpdatedTick: asTick(20),
    });
    expect(advanced.updatedWars[0]?.siegeProgress?.[0]?.progress).toBeGreaterThan(0);

    const cleared = advanceSettlementSieges({
      wars: advanced.wars,
      settlements: [settlement],
      events: [
        {
          tick: asTick(21),
          type: 'capture',
          regionId: asRegionId(4),
          attackerId: FACTION_A,
          defenderId: FACTION_B,
          message: '攻陷乙城',
        },
      ],
      tick: asTick(21),
    });

    expect(cleared.updatedWars[0]?.siegeProgress).toBeUndefined();
  });

  it('slows failed siege progress in defensible hard-to-cross settlement regions', () => {
    const war = {
      id: asWarId(140),
      kind: 'border' as const,
      status: 'active' as const,
      attackerFactionId: FACTION_A,
      defenderFactionId: FACTION_B,
      startedTick: asTick(10),
      lastContactTick: asTick(10),
    };
    const plainSettlement: SettlementSummary = {
      id: asSettlementId(40),
      factionId: FACTION_B,
      name: '平原城',
      regionId: asRegionId(0),
      tier: 'city',
      population: 900,
      development: 1,
      influenceRadius: 4,
      isCapital: false,
      foundedTick: asTick(0),
      loyalty: 1,
      unrest: 0,
      revoltProgress: 0,
    };
    const mountainSettlement: SettlementSummary = {
      ...plainSettlement,
      id: asSettlementId(41),
      name: '山隘城',
      regionId: asRegionId(1),
    };
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_B, terrain: 'plain', elevation: 0.05, moisture: 0.5 }),
      createProvince({ id: 1, owner: FACTION_B, terrain: 'mountain', elevation: 0.95, moisture: 0.25 }),
    ]);

    const advanced = advanceSettlementSieges({
      wars: [war],
      settlements: [plainSettlement, mountainSettlement],
      events: [
        {
          tick: asTick(20),
          type: 'repel',
          regionId: asRegionId(0),
          attackerId: FACTION_A,
          defenderId: FACTION_B,
          message: '平原攻城失利',
        },
        {
          tick: asTick(20),
          type: 'repel',
          regionId: asRegionId(1),
          attackerId: FACTION_A,
          defenderId: FACTION_B,
          message: '山地攻城失利',
        },
      ],
      tick: asTick(20),
      map,
    });

    const progress = advanced.updatedWars[0]?.siegeProgress ?? [];
    const plainProgress = progress.find((entry) => entry.settlementId === plainSettlement.id);
    const mountainProgress = progress.find((entry) => entry.settlementId === mountainSettlement.id);

    expect(plainProgress?.progress).toBeGreaterThan(mountainProgress?.progress ?? 0);
  });

  it('does not attack owned neighbors while the pair is at peace', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
    ]);
    const rng = { next: () => 0 };

    const result = runExpansionTick({
      tick: asTick(12),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 1, capitalRegionId: asRegionId(1) }),
      ],
      activeWars: [],
      rng,
      attemptsPerTick: 4,
    });

    expect(result.patches).toEqual([]);
    expect(result.events.every((event) => event.type === 'stalemate')).toBe(true);
  });

  it('allows owned border attacks only after an active border war exists', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
    ]);
    const rng = { next: () => 0 };

    const result = runExpansionTick({
      tick: asTick(12),
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 1, capitalRegionId: asRegionId(1) }),
      ],
      activeWars: [
        {
          id: asWarId(4),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(11),
          lastContactTick: asTick(11),
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(1),
      fromOwnerId: FACTION_B,
      toOwnerId: FACTION_A,
    });
  });

  it('selects deterministic border war declarations for peaceful contact pairs', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0, 2], x: 10 }),
      createProvince({ id: 2, owner: FACTION_C, neighbors: [1], x: 20 }),
    ]);

    const declarations = selectBorderWarDeclarations({
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 2, capitalRegionId: asRegionId(1) }),
        createFaction({ id: FACTION_C, regions: 1, capitalRegionId: asRegionId(2) }),
      ],
      wars: [
        {
          id: asWarId(5),
          kind: 'border',
          status: 'truce',
          attackerFactionId: FACTION_B,
          defenderFactionId: FACTION_C,
          startedTick: asTick(1),
          lastContactTick: asTick(1),
          truceUntilTick: asTick(30),
        },
      ],
    });

    expect(declarations).toEqual([
      expect.objectContaining({
        attackerFactionId: FACTION_B,
        defenderFactionId: FACTION_A,
      }),
    ]);
  });

  it('creates war status overlay segments only for active or truce war borders', () => {
    const map = createMap(
      [
        createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
        createProvince({ id: 1, owner: FACTION_B, neighbors: [0, 2], x: 10 }),
        createProvince({ id: 2, owner: FACTION_C, neighbors: [1], x: 20 }),
      ],
      [
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
    );

    const segments = getWarStatusOverlaySegments({
      map,
      wars: [
        {
          id: asWarId(7),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(1),
          lastContactTick: asTick(2),
          fatigue: 0.5,
        },
      ],
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      status: 'active',
      leftFactionId: FACTION_A,
      rightFactionId: FACTION_B,
      fatigue: 0.5,
    });
  });

  it('creates settlement siege overlay regions for valid active siege progress', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [], terrain: 'ocean', x: 20 }),
    ]);

    const wars = [
      {
        id: asWarId(91),
        kind: 'border' as const,
        status: 'active' as const,
        attackerFactionId: FACTION_A,
        defenderFactionId: FACTION_B,
        startedTick: asTick(1),
        lastContactTick: asTick(2),
        siegeProgress: [
          {
            settlementId: asSettlementId(1),
            regionId: asRegionId(1),
            attackerFactionId: FACTION_A,
            defenderFactionId: FACTION_B,
            progress: 0.45,
            lastUpdatedTick: asTick(2),
          },
          {
            settlementId: asSettlementId(2),
            regionId: asRegionId(2),
            attackerFactionId: FACTION_A,
            defenderFactionId: FACTION_B,
            progress: 0.9,
            lastUpdatedTick: asTick(2),
          },
        ],
      },
      {
        id: asWarId(92),
        kind: 'border' as const,
        status: 'truce' as const,
        attackerFactionId: FACTION_A,
        defenderFactionId: FACTION_B,
        startedTick: asTick(1),
        lastContactTick: asTick(2),
        siegeProgress: [
          {
            settlementId: asSettlementId(3),
            regionId: asRegionId(1),
            attackerFactionId: FACTION_A,
            defenderFactionId: FACTION_B,
            progress: 0.8,
            lastUpdatedTick: asTick(2),
          },
        ],
      },
    ];

    const regions = getSettlementSiegeOverlayRegions({ map, wars });

    expect(regions).toEqual([
      expect.objectContaining({
        warId: asWarId(91),
        regionId: asRegionId(1),
        attackerFactionId: FACTION_A,
        defenderFactionId: FACTION_B,
        progress: 0.45,
      }),
    ]);

    expect(getSettlementSiegeOverlayRegions({ map, wars, selectedFactionId: FACTION_C })).toEqual([]);
  });

  it('turns a disconnected active war into a temporary truce', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: null, terrain: 'ocean', neighbors: [0, 2], x: 10 }),
      createProvince({ id: 2, owner: FACTION_B, neighbors: [1], x: 20 }),
    ]);

    const result = advanceWarStates({
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 1, capitalRegionId: asRegionId(2) }),
      ],
      wars: [
        {
          id: asWarId(2),
          kind: 'revolt',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(1),
          lastContactTick: asTick(1),
        },
      ],
      tick: asTick(12),
    });

    expect(result.wars[0]).toMatchObject({ status: 'truce' });
    expect(result.updatedWars[0]).toMatchObject({ status: 'truce' });
    expect(result.transitions[0]).toMatchObject({ type: 'truce' });
  });

  it('turns a long active border war into a fatigue truce', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
    ]);

    const result = advanceWarStates({
      map,
      factions: [
        createFaction({ id: FACTION_A, regions: 20, capitalRegionId: asRegionId(0) }),
        createFaction({ id: FACTION_B, regions: 18, capitalRegionId: asRegionId(1) }),
      ],
      wars: [
        {
          id: asWarId(6),
          kind: 'border',
          status: 'active',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(1),
          lastContactTick: asTick(80),
          fatigue: 0.8,
          attackerStartRegions: 20,
          defenderStartRegions: 20,
        },
      ],
      tick: asTick(120),
    });

    expect(result.wars[0]).toMatchObject({
      status: 'truce',
      fatigue: 1,
    });
    expect(result.transitions[0]).toMatchObject({
      type: 'truce',
      reason: 'fatigue',
    });
  });

  it('does not attack a faction while the pair is under truce', () => {
    const map = createMap([
      createProvince({ id: 0, owner: FACTION_A, neighbors: [1, 2], x: 0 }),
      createProvince({ id: 1, owner: FACTION_B, neighbors: [0], x: 10 }),
      createProvince({ id: 2, owner: null, neighbors: [0], x: 20 }),
    ]);
    const rng = { next: () => 0 };

    const result = runExpansionTick({
      tick: asTick(13),
      map,
      factions: [createFaction({ id: FACTION_A, regions: 1, capitalRegionId: asRegionId(0) })],
      activeWars: [
        {
          id: asWarId(3),
          kind: 'revolt',
          status: 'truce',
          attackerFactionId: FACTION_A,
          defenderFactionId: FACTION_B,
          startedTick: asTick(1),
          lastContactTick: asTick(1),
          truceUntilTick: asTick(50),
        },
      ],
      rng,
      attemptsPerTick: 1,
    });

    expect(result.patches[0]).toMatchObject({
      regionId: asRegionId(2),
      fromOwnerId: null,
      toOwnerId: FACTION_A,
    });
  });

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
