import type { MapData, Province } from '@/core/map';
import type { FactionId, FactionSummary, RegionId, SettlementSummary, Tick } from '@/shared/types';
import { asSettlementId, asTick } from '@/shared/types';
import { isRecentConquestTick, type RecentConquestMemory } from './conquestMemory';
import { computeRegionStrategicProfile, scoreSettlementProvinceForStrategy } from './geoStrategy';
import { advanceSettlementStability } from './stability';

const CAPITAL_POPULATION_BASE = 1200;
const CAPITAL_POPULATION_PER_REGION = 80;
const CAPITAL_INFLUENCE_RADIUS = 5;
const VILLAGE_POPULATION_BASE = 260;
const VILLAGE_POPULATION_PER_REGION = 8;
const TOWN_POPULATION_BASE = 650;
const TOWN_POPULATION_PER_REGION = 12;
const VILLAGE_INFLUENCE_RADIUS = 3;
const TOWN_INFLUENCE_RADIUS = 4;
const MIN_SETTLEMENT_GRAPH_DISTANCE = 4;
const MAX_SETTLEMENTS_PER_FACTION = 12;
const POPULATION_GROWTH_RATE = 0.045;
const DEVELOPMENT_GROWTH_RATE = 0.08;

export function rebuildSettlements(input: {
  map: MapData | null;
  factions: FactionSummary[];
  previous?: readonly SettlementSummary[];
  tick?: Tick;
  recentConquests?: RecentConquestMemory;
  capitalFallShockFactionIds?: ReadonlySet<FactionId>;
}): SettlementSummary[] {
  const { map, factions } = input;
  if (!map) return [];

  const previousByCapitalFaction = new Map(
    input.previous
      ?.filter((settlement) => settlement.isCapital)
      .map((settlement) => [settlement.factionId, settlement]),
  );
  const previousByRegion = new Map(
    input.previous
      ?.filter((settlement) => !settlement.isCapital)
      .map((settlement) => [settlement.regionId, settlement]),
  );
  const previousNonCapitalsByFaction = new Map<FactionId, SettlementSummary[]>();
  for (const settlement of input.previous ?? []) {
    if (settlement.isCapital) continue;
    const list = previousNonCapitalsByFaction.get(settlement.factionId) ?? [];
    list.push(settlement);
    previousNonCapitalsByFaction.set(settlement.factionId, list);
  }

  const tick = input.tick ?? asTick(0);
  const mainRegionsByFaction = computeMainRegionsByFaction(map, factions);
  const settlements: SettlementSummary[] = [];

  for (const faction of factions) {
    if (faction.regions <= 0) continue;
    const mainRegions = mainRegionsByFaction.get(faction.id);
    if (!mainRegions || mainRegions.size === 0) continue;

    const capitalRegionId = faction.capitalRegionId ?? faction.centroidRegionId ?? faction.birthRegionId;
    if (capitalRegionId == null) continue;

    const province = map.provinces[capitalRegionId as unknown as number];
    if (
      !province ||
      province.terrain === 'ocean' ||
      province.ownerFactionId !== faction.id ||
      !mainRegions.has(capitalRegionId)
    ) {
      continue;
    }

    const previousCapital = previousByCapitalFaction.get(faction.id);
    const targetCount = targetSettlementCountForRegions(faction.regions);
    const regionsPerSettlement = faction.regions / Math.max(1, targetCount);
    const capitalRecentlyFell = input.capitalFallShockFactionIds?.has(faction.id) ?? false;
    const distanceFromCapital = computeDistanceFromSettlements(map, mainRegions, [
      {
        id: asSettlementId(0),
        factionId: faction.id,
        name: '',
        regionId: capitalRegionId,
        tier: 'capital',
        population: 0,
        development: 0,
        influenceRadius: 0,
        isCapital: true,
        foundedTick: tick,
        loyalty: 1,
        unrest: 0,
        revoltProgress: 0,
      },
    ]);
    const capital = withStability(
      withGrowth(
        {
        id: previousCapital?.id ?? asSettlementId(faction.id as unknown as number),
        factionId: faction.id,
        name: `${faction.name}都城`,
        regionId: capitalRegionId,
        tier: 'capital',
        population: previousCapital?.population ?? 0,
        development: previousCapital?.development ?? 1,
        influenceRadius: CAPITAL_INFLUENCE_RADIUS,
        isCapital: true,
        foundedTick: previousCapital?.foundedTick ?? tick,
        loyalty: previousCapital?.loyalty ?? 1,
        unrest: previousCapital?.unrest ?? 0,
        revoltProgress: previousCapital?.revoltProgress ?? 0,
      },
        {
          previous: previousCapital,
          targetPopulation: CAPITAL_POPULATION_BASE + faction.regions * CAPITAL_POPULATION_PER_REGION,
          targetDevelopment: 1,
          province,
        },
      ),
      {
        previous: previousCapital,
        adminDistance: 0,
        regionsPerSettlement,
        recentlyConquered: isRecentConquestTick(
          input.recentConquests?.get(capitalRegionId as unknown as number),
          tick,
        ),
      },
    );
    const factionSettlements: SettlementSummary[] = [capital];

    const retained = (previousNonCapitalsByFaction.get(faction.id) ?? [])
      .filter((settlement) => isSettlementStillValid(map, mainRegions, settlement, faction.id, capitalRegionId))
      .sort((a, b) => {
        const tickDelta = Number(a.foundedTick) - Number(b.foundedTick);
        if (tickDelta !== 0) return tickDelta;
        return Number(b.population) - Number(a.population);
      })
      .slice(0, Math.max(0, targetCount - 1))
      .map((settlement) =>
        withStability(withGrowth(settlement, {
          previous: settlement,
          targetPopulation: getSettlementPopulationTarget(settlement.tier, faction.regions),
          targetDevelopment: getSettlementDevelopmentTarget(settlement.tier, map.provinces[settlement.regionId as unknown as number]),
          province: map.provinces[settlement.regionId as unknown as number],
        }), {
        previous: settlement,
        adminDistance: distanceFromCapital.get(settlement.regionId) ?? null,
        regionsPerSettlement,
        capitalRecentlyFell,
        recentlyConquered: isRecentConquestTick(
          input.recentConquests?.get(settlement.regionId as unknown as number),
          tick,
          ),
        }),
      );

    factionSettlements.push(...retained);

    while (factionSettlements.length < targetCount) {
      const candidate = pickSettlementCandidate(map, mainRegions, factionSettlements);
      if (!candidate) break;
      const settlementIndex = factionSettlements.length;
      const previousAtRegion = previousByRegion.get(candidate.id);
      const tier = tierForSettlementSlot(faction.regions, settlementIndex);
      factionSettlements.push(
        withStability(
          withGrowth(
            {
            id:
              previousAtRegion?.id ??
              asSettlementId(100_000 + (faction.id as unknown as number) * 1000 + settlementIndex),
            factionId: faction.id,
            name: `${faction.name}${tier === 'town' ? '镇' : '村'}${settlementIndex}`,
            regionId: candidate.id,
            tier,
            population: previousAtRegion?.population ?? 0,
            development: previousAtRegion?.development ?? baseDevelopmentForTier(tier),
            influenceRadius: tier === 'town' ? TOWN_INFLUENCE_RADIUS : VILLAGE_INFLUENCE_RADIUS,
            isCapital: false,
            foundedTick: previousAtRegion?.foundedTick ?? tick,
            loyalty: previousAtRegion?.loyalty ?? 1,
            unrest: previousAtRegion?.unrest ?? 0,
            revoltProgress: previousAtRegion?.revoltProgress ?? 0,
          },
            {
              previous: previousAtRegion,
              targetPopulation: getSettlementPopulationTarget(tier, faction.regions),
              targetDevelopment: getSettlementDevelopmentTarget(tier, candidate),
              province: candidate,
            },
          ),
          {
            previous: previousAtRegion,
            adminDistance: distanceFromCapital.get(candidate.id) ?? null,
            regionsPerSettlement,
            capitalRecentlyFell,
            recentlyConquered: isRecentConquestTick(
              input.recentConquests?.get(candidate.id as unknown as number),
              tick,
            ),
          },
        ),
      );
    }

    settlements.push(...factionSettlements);
  }

  return settlements;
}

export const rebuildCapitalSettlements = rebuildSettlements;

function withGrowth(
  settlement: SettlementSummary,
  input: {
    previous?: SettlementSummary | null;
    targetPopulation: number;
    targetDevelopment: number;
    province?: Province;
  },
): SettlementSummary {
  if (!input.previous) {
    return {
      ...settlement,
      population: Math.max(settlement.population, Math.floor(input.targetPopulation)),
      development: Math.max(settlement.development, round2(input.targetDevelopment)),
    };
  }

  const growthFactor = getSettlementGrowthFactor(input.province);
  return {
    ...settlement,
    population: advancePopulation(input.previous.population, input.targetPopulation, growthFactor),
    development: round2(
      advanceDevelopment(input.previous.development, input.targetDevelopment, growthFactor),
    ),
  };
}

function getSettlementPopulationTarget(tier: SettlementSummary['tier'], regions: number): number {
  switch (tier) {
    case 'capital':
      return CAPITAL_POPULATION_BASE + regions * CAPITAL_POPULATION_PER_REGION;
    case 'city':
      return 1100 + regions * 16;
    case 'town':
      return TOWN_POPULATION_BASE + regions * TOWN_POPULATION_PER_REGION;
    case 'village':
      return VILLAGE_POPULATION_BASE + regions * VILLAGE_POPULATION_PER_REGION;
  }
}

function getSettlementDevelopmentTarget(tier: SettlementSummary['tier'], province: Province | undefined): number {
  const base = baseDevelopmentForTier(tier);
  if (!province || province.terrain === 'ocean') return base;
  const profile = computeRegionStrategicProfile(province);
  const growthQuality = profile.fertility * 0.48 + profile.habitability * 0.42 - Math.max(0, profile.travelCost - 1) * 0.1;
  return clamp(base + (growthQuality - 0.45) * 0.32, base, 1);
}

function baseDevelopmentForTier(tier: SettlementSummary['tier']): number {
  switch (tier) {
    case 'capital':
      return 1;
    case 'city':
      return 0.85;
    case 'town':
      return 0.7;
    case 'village':
      return 0.35;
  }
}

function getSettlementGrowthFactor(province: Province | undefined): number {
  if (!province || province.terrain === 'ocean') return 1;
  const profile = computeRegionStrategicProfile(province);
  const factor =
    0.45 +
    profile.fertility * 0.36 +
    profile.habitability * 0.34 -
    Math.max(0, profile.travelCost - 1) * 0.16;
  return clamp(factor, 0.25, 1.35);
}

function advancePopulation(current: number, target: number, growthFactor: number): number {
  if (target <= current) return current;
  const next = current + (target - current) * POPULATION_GROWTH_RATE * growthFactor;
  return Math.min(Math.floor(target), Math.max(current + 1, Math.floor(next)));
}

function advanceDevelopment(current: number, target: number, growthFactor: number): number {
  if (target <= current) return current;
  return Math.min(target, current + (target - current) * DEVELOPMENT_GROWTH_RATE * growthFactor);
}

function withStability(
  settlement: SettlementSummary,
  input: {
    previous?: SettlementSummary | null;
    adminDistance: number | null;
    regionsPerSettlement: number;
    recentlyConquered: boolean;
    capitalRecentlyFell?: boolean;
  },
): SettlementSummary {
  const stability = advanceSettlementStability({
    tier: settlement.tier,
    isCapital: settlement.isCapital,
    previous: input.previous,
    adminDistance: input.adminDistance,
    regionsPerSettlement: input.regionsPerSettlement,
    recentlyConquered: input.recentlyConquered,
    capitalRecentlyFell: input.capitalRecentlyFell,
  });
  return { ...settlement, ...stability };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function targetSettlementCountForRegions(regions: number): number {
  if (regions <= 0) return 0;
  return Math.min(MAX_SETTLEMENTS_PER_FACTION, Math.max(1, 1 + Math.floor(regions / 40)));
}

function tierForSettlementSlot(regions: number, slot: number): 'village' | 'town' {
  if (regions >= 120 && slot % 3 === 0) return 'town';
  return 'village';
}

function isSettlementStillValid(
  map: MapData,
  mainRegions: ReadonlySet<RegionId>,
  settlement: SettlementSummary,
  factionId: FactionId,
  capitalRegionId: RegionId,
): boolean {
  if (settlement.regionId === capitalRegionId) return false;
  const province = map.provinces[settlement.regionId as unknown as number];
  return (
    province != null &&
    province.terrain !== 'ocean' &&
    province.ownerFactionId === factionId &&
    mainRegions.has(settlement.regionId)
  );
}

function pickSettlementCandidate(
  map: MapData,
  mainRegions: ReadonlySet<RegionId>,
  existing: readonly SettlementSummary[],
): Province | null {
  const occupied = new Set(existing.map((settlement) => settlement.regionId));
  const distanceByRegion = computeDistanceFromSettlements(map, mainRegions, existing);
  let best: { province: Province; score: number } | null = null;

  for (const regionId of mainRegions) {
    if (occupied.has(regionId)) continue;
    const province = map.provinces[regionId as unknown as number];
    if (!province || province.terrain === 'ocean') continue;

    const distance = distanceByRegion.get(regionId) ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(distance) || distance < MIN_SETTLEMENT_GRAPH_DISTANCE) continue;

    const ownedNeighborCount = province.neighbors.filter((neighborId) => mainRegions.has(neighborId)).length;
    const score =
      distance * 10 +
      scoreSettlementProvinceForStrategy(province) +
      ownedNeighborCount * 1.5;

    if (!best || score > best.score) {
      best = { province, score };
    }
  }

  return best?.province ?? null;
}

function computeDistanceFromSettlements(
  map: MapData,
  mainRegions: ReadonlySet<RegionId>,
  settlements: readonly SettlementSummary[],
): Map<RegionId, number> {
  const distanceByRegion = new Map<RegionId, number>();
  const queue: RegionId[] = [];

  for (const settlement of settlements) {
    if (!mainRegions.has(settlement.regionId)) continue;
    distanceByRegion.set(settlement.regionId, 0);
    queue.push(settlement.regionId);
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const regionId = queue[cursor];
    const distance = distanceByRegion.get(regionId) ?? 0;
    const province = map.provinces[regionId as unknown as number];
    if (!province) continue;
    for (const neighborId of province.neighbors) {
      if (!mainRegions.has(neighborId) || distanceByRegion.has(neighborId)) continue;
      distanceByRegion.set(neighborId, distance + 1);
      queue.push(neighborId);
    }
  }

  return distanceByRegion;
}

function computeMainRegionsByFaction(
  map: MapData,
  factions: readonly FactionSummary[],
): Map<FactionId, Set<RegionId>> {
  const result = new Map<FactionId, Set<RegionId>>();
  for (const faction of factions) {
    if (faction.regions <= 0) continue;
    const root = faction.capitalRegionId ?? faction.centroidRegionId ?? faction.birthRegionId;
    if (root == null) continue;
    const rootProvince = map.provinces[root as unknown as number];
    if (!rootProvince || rootProvince.terrain === 'ocean' || rootProvince.ownerFactionId !== faction.id) {
      continue;
    }
    result.set(faction.id, collectOwnedComponent(map, faction.id, root));
  }
  return result;
}

function collectOwnedComponent(map: MapData, factionId: FactionId, root: RegionId): Set<RegionId> {
  const visited = new Set<RegionId>();
  const queue: RegionId[] = [root];
  visited.add(root);

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const regionId = queue[cursor];
    const province = map.provinces[regionId as unknown as number];
    if (!province) continue;
    for (const neighborId of province.neighbors) {
      if (visited.has(neighborId)) continue;
      const neighbor = map.provinces[neighborId as unknown as number];
      if (!neighbor || neighbor.terrain === 'ocean' || neighbor.ownerFactionId !== factionId) continue;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }

  return visited;
}
