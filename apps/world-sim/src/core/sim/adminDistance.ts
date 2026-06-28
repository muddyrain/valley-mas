import type { MapData } from '@/core/map';
import type { FactionId, FactionSummary, RegionId, SettlementSummary, Tick } from '@/shared/types';
import {
  isRecentConquestTick,
  RECENT_CONQUEST_TICK_WINDOW,
  type RecentConquestMemory,
} from './conquestMemory';

const ADMIN_DISTANCE_PRESSURE_START = 5;
const ADMIN_DISTANCE_PRESSURE_FULL = 18;
const ADMIN_DISTANCE_PENALTY_MAX = 0.18;
const OVEREXTENSION_SOFT_REGIONS_PER_SETTLEMENT = 48;
const OVEREXTENSION_HARD_REGIONS_PER_SETTLEMENT = 96;
const OVEREXTENSION_PENALTY_MAX = 0.1;

export interface AdminDistanceState {
  distanceByFaction: Map<FactionId, Map<number, number>>;
  settlementCountByFaction: Map<FactionId, number>;
  ownedRegionIdsByFaction: Map<FactionId, number[]>;
}

export interface AdminSupport {
  distance: number | null;
  settlementCount: number;
  distancePenalty: number;
  overextensionPenalty: number;
  totalPenalty: number;
  quality: number;
}

export type AdminPressureLevel = 'none' | 'stable' | 'strained' | 'overextended';

export interface FactionAdminSummary {
  factionId: FactionId;
  settlementCount: number;
  averageDistance: number | null;
  farRegionShare: number;
  regionsPerSettlement: number;
  averageQuality: number;
  overextensionPenalty: number;
  recentConquestShare: number;
  pressureLevel: AdminPressureLevel;
}

export function buildAdminDistanceState(input: {
  map: MapData;
  factions: readonly FactionSummary[];
  settlements?: readonly SettlementSummary[];
}): AdminDistanceState {
  const distanceByFaction = new Map<FactionId, Map<number, number>>();
  const settlementCountByFaction = new Map<FactionId, number>();
  const ownedRegionIdsByFaction = buildOwnedRegionIndex(input.map, input.factions);

  for (const faction of input.factions) {
    if (faction.regions <= 0) continue;
    const roots = getAdminRoots(input.map, faction, input.settlements ?? []);
    if (roots.length === 0) continue;

    settlementCountByFaction.set(faction.id, roots.length);
    distanceByFaction.set(faction.id, computeOwnedDistances(input.map, faction.id, roots));
  }

  return { distanceByFaction, settlementCountByFaction, ownedRegionIdsByFaction };
}

export function getAdminSupport(input: {
  state: AdminDistanceState;
  faction: FactionSummary | { id: FactionId; regions: number };
  sourceRegionId: RegionId | number | null;
}): AdminSupport {
  const settlementCount = Math.max(1, input.state.settlementCountByFaction.get(input.faction.id) ?? 1);
  const distance =
    input.sourceRegionId == null
      ? null
      : (input.state.distanceByFaction
          .get(input.faction.id)
          ?.get(input.sourceRegionId as unknown as number) ?? null);

  const distancePenalty =
    distance == null
      ? ADMIN_DISTANCE_PENALTY_MAX
      : smoothstep(ADMIN_DISTANCE_PRESSURE_START, ADMIN_DISTANCE_PRESSURE_FULL, distance) *
        ADMIN_DISTANCE_PENALTY_MAX;
  const overextensionPenalty = getOverextensionPenalty(input.faction.regions, settlementCount);
  const totalPenalty = clamp(distancePenalty + overextensionPenalty, 0, 0.28);

  return {
    distance,
    settlementCount,
    distancePenalty,
    overextensionPenalty,
    totalPenalty,
    quality: clamp(1 - totalPenalty, 0.72, 1),
  };
}

export function summarizeFactionAdminPressure(input: {
  state: AdminDistanceState;
  faction: FactionSummary | { id: FactionId; regions: number };
  recentConquests?: RecentConquestMemory;
  currentTick?: Tick;
}): FactionAdminSummary {
  if (input.faction.regions <= 0) {
    return {
      factionId: input.faction.id,
      settlementCount: 0,
      averageDistance: null,
      farRegionShare: 0,
      regionsPerSettlement: 0,
      averageQuality: 0,
      overextensionPenalty: 0,
      recentConquestShare: 0,
      pressureLevel: 'none',
    };
  }

  const settlementCount = Math.max(1, input.state.settlementCountByFaction.get(input.faction.id) ?? 1);
  const distances = Array.from(input.state.distanceByFaction.get(input.faction.id)?.values() ?? []);
  const ownedRegionIds = input.state.ownedRegionIdsByFaction.get(input.faction.id) ?? [];
  const recentConquestShare = getRecentConquestShare({
    ownedRegionIds,
    recentConquests: input.recentConquests,
    currentTick: input.currentTick,
  });
  const regionsPerSettlement = Math.max(1, input.faction.regions) / settlementCount;
  const overextensionPenalty = getOverextensionPenalty(input.faction.regions, settlementCount);

  if (distances.length === 0) {
    return {
      factionId: input.faction.id,
      settlementCount,
      averageDistance: null,
      farRegionShare: 1,
      regionsPerSettlement,
      averageQuality: 0.72,
      overextensionPenalty,
      recentConquestShare,
      pressureLevel: 'overextended',
    };
  }

  const averageDistance = average(distances);
  const farRegionShare =
    distances.filter((distance) => distance >= ADMIN_DISTANCE_PRESSURE_START).length / distances.length;
  const averageDistancePenalty =
    distances.reduce(
      (sum, distance) =>
        sum +
        smoothstep(ADMIN_DISTANCE_PRESSURE_START, ADMIN_DISTANCE_PRESSURE_FULL, distance) *
          ADMIN_DISTANCE_PENALTY_MAX,
      0,
    ) / distances.length;
  const averageQuality = clamp(1 - averageDistancePenalty - overextensionPenalty, 0.72, 1);

  return {
    factionId: input.faction.id,
    settlementCount,
    averageDistance,
    farRegionShare,
    regionsPerSettlement,
    averageQuality,
    overextensionPenalty,
    recentConquestShare,
    pressureLevel: getAdminPressureLevel({ averageQuality, farRegionShare, regionsPerSettlement }),
  };
}

function buildOwnedRegionIndex(
  map: MapData,
  factions: readonly FactionSummary[],
): Map<FactionId, number[]> {
  const liveFactionIds = new Set(factions.map((faction) => faction.id));
  const ownedRegionIdsByFaction = new Map<FactionId, number[]>();
  for (const province of map.provinces) {
    if (province.terrain === 'ocean' || province.ownerFactionId == null) continue;
    if (!liveFactionIds.has(province.ownerFactionId)) continue;
    const list = ownedRegionIdsByFaction.get(province.ownerFactionId) ?? [];
    list.push(province.id as unknown as number);
    ownedRegionIdsByFaction.set(province.ownerFactionId, list);
  }
  return ownedRegionIdsByFaction;
}

function getRecentConquestShare(input: {
  ownedRegionIds: readonly number[];
  recentConquests: RecentConquestMemory | undefined;
  currentTick: Tick | undefined;
}): number {
  if (input.ownedRegionIds.length === 0 || !input.recentConquests || input.currentTick == null) return 0;
  let recent = 0;
  for (const regionId of input.ownedRegionIds) {
    if (
      isRecentConquestTick(
        input.recentConquests.get(regionId),
        input.currentTick,
        RECENT_CONQUEST_TICK_WINDOW,
      )
    ) {
      recent++;
    }
  }
  return recent / input.ownedRegionIds.length;
}

function getAdminRoots(
  map: MapData,
  faction: FactionSummary,
  settlements: readonly SettlementSummary[],
): number[] {
  const roots: number[] = [];
  const seen = new Set<number>();

  for (const settlement of settlements) {
    if (settlement.factionId !== faction.id) continue;
    const id = settlement.regionId as unknown as number;
    const province = map.provinces[id];
    if (!province || province.terrain === 'ocean' || province.ownerFactionId !== faction.id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    roots.push(id);
  }

  if (roots.length > 0) return roots;

  for (const fallback of [faction.capitalRegionId, faction.centroidRegionId, faction.birthRegionId]) {
    if (fallback == null) continue;
    const id = fallback as unknown as number;
    const province = map.provinces[id];
    if (!province || province.terrain === 'ocean' || province.ownerFactionId !== faction.id) continue;
    roots.push(id);
    break;
  }

  return roots;
}

function computeOwnedDistances(map: MapData, factionId: FactionId, roots: readonly number[]): Map<number, number> {
  const distances = new Map<number, number>();
  const queue: number[] = [];

  for (const root of roots) {
    distances.set(root, 0);
    queue.push(root);
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    const distance = distances.get(current) ?? 0;
    const province = map.provinces[current];
    if (!province) continue;

    for (const neighborId of province.neighbors) {
      const neighbor = neighborId as unknown as number;
      if (distances.has(neighbor)) continue;
      const neighborProvince = map.provinces[neighbor];
      if (!neighborProvince || neighborProvince.terrain === 'ocean') continue;
      if (neighborProvince.ownerFactionId !== factionId) continue;
      distances.set(neighbor, distance + 1);
      queue.push(neighbor);
    }
  }

  return distances;
}

function getOverextensionPenalty(regions: number, settlementCount: number): number {
  const regionsPerSettlement = Math.max(1, regions) / Math.max(1, settlementCount);
  return (
    smoothstep(
      OVEREXTENSION_SOFT_REGIONS_PER_SETTLEMENT,
      OVEREXTENSION_HARD_REGIONS_PER_SETTLEMENT,
      regionsPerSettlement,
    ) * OVEREXTENSION_PENALTY_MAX
  );
}

function getAdminPressureLevel(input: {
  averageQuality: number;
  farRegionShare: number;
  regionsPerSettlement: number;
}): AdminPressureLevel {
  if (input.averageQuality <= 0) return 'none';
  if (
    input.averageQuality < 0.82 ||
    input.farRegionShare >= 0.55 ||
    input.regionsPerSettlement >= OVEREXTENSION_HARD_REGIONS_PER_SETTLEMENT
  ) {
    return 'overextended';
  }
  if (
    input.averageQuality < 0.9 ||
    input.farRegionShare >= 0.28 ||
    input.regionsPerSettlement >= OVEREXTENSION_SOFT_REGIONS_PER_SETTLEMENT
  ) {
    return 'strained';
  }
  return 'stable';
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
