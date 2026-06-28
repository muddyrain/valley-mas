import type { MapData } from '@/core/map';
import { TERRAIN_KINDS, type TerrainKind } from '@/core/map';
import { isRecentConquestTick } from '@/core/sim/conquestMemory';
import type {
  FactionId,
  FactionSummary,
  LogEventCategory,
  LogEventLevel,
  RegionId,
  ReplayFrame,
  ReplayInitialFaction,
  SettlementSummary,
  SettlementTier,
  Tick,
  WarId,
  WarKind,
  WarSiegeProgress,
  WarStatus,
  WarSummary,
} from '@/shared/types';
import type { WorldSimStore } from './store';

/**
 * 排行榜单条数据。Sidebar 渲染时按 regions 倒序展示。
 */
export interface FactionRankingEntry {
  id: FactionId;
  name: string;
  leader: string;
  colorHex: string;
  /** 控制的州数 */
  regions: number;
  /** 与「他人或地图外」相邻的边界段数；衡量战线长度 */
  borderLength: number;
  /** 地形分布快照 */
  terrainBreakdown: Record<TerrainKind, number>;
  /** 控制份额（0~1），由当前占领数除以全图可占陆地州数 */
  share: number;
  /** 排名（1 起，区域多者靠前；并列时按 borderLength 后置） */
  rank: number;
}

export interface FactionWarSummary {
  activeCount: number;
  truceCount: number;
  activeOpponents: string[];
  truceOpponents: string[];
  siegeCount: number;
  maxSiegeProgress: number;
  status: 'none' | WarStatus;
}

export type DiplomacyOverviewStatus = 'peace' | 'truce' | 'war';

export interface DiplomacyOverview {
  livingFactionCount: number;
  pairCount: number;
  peaceCount: number;
  borderWarCount: number;
  revoltWarCount: number;
  truceCount: number;
  activeWarCount: number;
  status: DiplomacyOverviewStatus;
}

export interface WarListEntry {
  id: WarId;
  kind: WarKind;
  status: WarStatus;
  attackerName: string;
  defenderName: string;
  startedTick: Tick;
  elapsedTicks: number;
  fatigue: number;
  truceRemainingTicks: number | null;
}

export interface SelectedSettlementSiegeDetail {
  progress: number;
  attackerName: string;
  defenderName: string;
  lastUpdatedTick: Tick;
}

export interface SelectedSettlementDetail {
  regionId: RegionId;
  settlementId: SettlementSummary['id'];
  settlementName: string;
  tier: SettlementTier;
  ownerName: string;
  ownerColorHex: string | null;
  terrain: TerrainKind;
  population: number;
  development: number;
  loyalty: number;
  unrest: number;
  revoltProgress: number;
  isCapital: boolean;
  foundedTick: Tick;
  recentlyConquered: boolean;
  conqueredTick: Tick | null;
  siege: SelectedSettlementSiegeDetail | null;
}

export interface DebugBalanceSummary {
  provinceCount: number;
  landCount: number;
  occupiedCount: number;
  occupiedRatio: number;
  livingFactionCount: number;
  largestFactionName: string | null;
  largestShare: number;
  activeWarCount: number;
  truceCount: number;
  replayFrameCount: number;
}

export interface ReplayEventAnchor {
  cursor: number;
  tick: Tick;
  category: LogEventCategory;
  level: LogEventLevel;
  message: string;
  factionId?: FactionId;
}

export interface ReplayHistorySummaryMeta {
  seed: string;
  provinceCount: number;
  mapMode: string;
  scenarioId: string | null;
  totalTicks: number;
}

export interface ReplayEventCount {
  category: LogEventCategory;
  count: number;
}

export interface ReplayFactionFate {
  factionId: FactionId;
  name: string;
  leader: string;
  colorHex: string;
  birthRegionId: RegionId | null;
  capitalRegionId: RegionId | null;
  startRegions: number;
  finalRegions: number;
  eliminatedTick: Tick | null;
  survived: boolean;
  winner: boolean;
}

export interface ReplayHistorySummary {
  version: 1;
  meta: ReplayHistorySummaryMeta;
  status: ReplayFrame['status'] | 'idle';
  winnerFactionId: FactionId | null;
  keyEvents: ReplayEventAnchor[];
  eventCounts: ReplayEventCount[];
  factionFates: ReplayFactionFate[];
}

const REPLAY_EVENT_ANCHOR_CATEGORIES: readonly LogEventCategory[] = [
  'capital',
  'eliminate',
  'victory',
  'stalemate',
  'revolt',
  'divine',
  'diplomacy',
];

const EMPTY_TERRAIN_BREAKDOWN: Record<TerrainKind, number> = {
  plain: 0,
  forest: 0,
  mountain: 0,
  desert: 0,
  river: 0,
  ocean: 0,
};

function emptyBreakdown(): Record<TerrainKind, number> {
  const out: Record<TerrainKind, number> = { ...EMPTY_TERRAIN_BREAKDOWN };
  return out;
}

export function computeFactionRankings(
  factions: FactionSummary[],
  map: MapData | null,
): FactionRankingEntry[] {
  if (!map) {
    return factions.map((f, idx) => ({
      id: f.id,
      name: f.name,
      leader: f.leader,
      colorHex: f.colorHex,
      regions: 0,
      borderLength: 0,
      terrainBreakdown: emptyBreakdown(),
      share: 0,
      rank: idx + 1,
    }));
  }

  const provinces = map.provinces;
  const total = provinces.reduce(
    (sum, province) => sum + (province.terrain === 'ocean' ? 0 : 1),
    0,
  );

  const regionsMap = new Map<FactionId, number>();
  const breakdownMap = new Map<FactionId, Record<TerrainKind, number>>();
  const borderMap = new Map<FactionId, number>();

  for (const province of provinces) {
    if (province.terrain === 'ocean') continue;
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    regionsMap.set(owner, (regionsMap.get(owner) ?? 0) + 1);
    let bd = breakdownMap.get(owner);
    if (!bd) {
      bd = emptyBreakdown();
      breakdownMap.set(owner, bd);
    }
    bd[province.terrain] += 1;
  }

  for (const edge of map.borders) {
    const leftIdx = edge.left as unknown as number;
    const rightIdx = edge.right == null ? null : (edge.right as unknown as number);
    const leftOwner = rankingOwnerOf(provinces[leftIdx]);
    const rightOwner = rightIdx == null ? null : rankingOwnerOf(provinces[rightIdx]);

    if (leftOwner != null && leftOwner !== rightOwner) {
      borderMap.set(leftOwner, (borderMap.get(leftOwner) ?? 0) + 1);
    }
    if (rightOwner != null && rightOwner !== leftOwner) {
      borderMap.set(rightOwner, (borderMap.get(rightOwner) ?? 0) + 1);
    }
  }

  const enriched = factions.map<FactionRankingEntry>((f) => ({
    id: f.id,
    name: f.name,
    leader: f.leader,
    colorHex: f.colorHex,
    regions: regionsMap.get(f.id) ?? 0,
    borderLength: borderMap.get(f.id) ?? 0,
    terrainBreakdown: breakdownMap.get(f.id) ?? emptyBreakdown(),
    share: total > 0 ? (regionsMap.get(f.id) ?? 0) / total : 0,
    rank: 0,
  }));

  enriched.sort((a, b) => {
    if (b.regions !== a.regions) return b.regions - a.regions;
    if (b.borderLength !== a.borderLength) return b.borderLength - a.borderLength;
    return a.name.localeCompare(b.name);
  });
  enriched.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return enriched;
}

/** Zustand selector：在组件中 useWorldSimStore(selectFactionRankings) 即可订阅 */
export const selectFactionRankings = (state: WorldSimStore): FactionRankingEntry[] =>
  computeFactionRankings(state.factions, state.map);

export function computeDiplomacyOverview(input: {
  factions: readonly FactionSummary[];
  wars: readonly WarSummary[];
}): DiplomacyOverview {
  const liveFactionIds = new Set(
    input.factions.filter((faction) => (faction.regions ?? 0) > 0).map((faction) => faction.id),
  );
  const relationByPair = new Map<string, WarKind | 'truce'>();

  for (const war of input.wars) {
    if (!liveFactionIds.has(war.attackerFactionId) || !liveFactionIds.has(war.defenderFactionId)) {
      continue;
    }

    const key = diplomacyPairKey(war.attackerFactionId, war.defenderFactionId);
    const previous = relationByPair.get(key);
    if (previous === 'revolt' || previous === 'border') continue;
    if (war.status === 'active') {
      relationByPair.set(key, war.kind);
    } else if (!previous) {
      relationByPair.set(key, 'truce');
    }
  }

  let borderWarCount = 0;
  let revoltWarCount = 0;
  let truceCount = 0;
  for (const relation of relationByPair.values()) {
    if (relation === 'border') {
      borderWarCount += 1;
    } else if (relation === 'revolt') {
      revoltWarCount += 1;
    } else {
      truceCount += 1;
    }
  }

  const livingFactionCount = liveFactionIds.size;
  const pairCount = (livingFactionCount * Math.max(0, livingFactionCount - 1)) / 2;
  const activeWarCount = borderWarCount + revoltWarCount;
  const peaceCount = Math.max(0, pairCount - activeWarCount - truceCount);

  return {
    livingFactionCount,
    pairCount,
    peaceCount,
    borderWarCount,
    revoltWarCount,
    truceCount,
    activeWarCount,
    status: activeWarCount > 0 ? 'war' : truceCount > 0 ? 'truce' : 'peace',
  };
}

export function computeFactionWarSummary(input: {
  factionId: FactionId;
  factions: readonly FactionSummary[];
  wars: readonly WarSummary[];
}): FactionWarSummary {
  const factionNameById = new Map(input.factions.map((faction) => [faction.id, faction.name]));
  const activeOpponents: string[] = [];
  const truceOpponents: string[] = [];
  let siegeCount = 0;
  let maxSiegeProgress = 0;

  for (const war of input.wars) {
    const opponentId =
      war.attackerFactionId === input.factionId
        ? war.defenderFactionId
        : war.defenderFactionId === input.factionId
          ? war.attackerFactionId
          : null;
    if (opponentId == null) continue;

    const opponentName = factionNameById.get(opponentId) ?? `#${opponentId as unknown as number}`;
    if (war.status === 'active') {
      activeOpponents.push(opponentName);
      for (const siege of war.siegeProgress ?? []) {
        if (
          siege.attackerFactionId !== input.factionId &&
          siege.defenderFactionId !== input.factionId
        ) {
          continue;
        }
        siegeCount += 1;
        maxSiegeProgress = Math.max(maxSiegeProgress, clamp01(siege.progress));
      }
    } else if (war.status === 'truce') {
      truceOpponents.push(opponentName);
    }
  }

  return {
    activeCount: activeOpponents.length,
    truceCount: truceOpponents.length,
    activeOpponents,
    truceOpponents,
    siegeCount,
    maxSiegeProgress,
    status: activeOpponents.length > 0 ? 'active' : truceOpponents.length > 0 ? 'truce' : 'none',
  };
}

export function computeWarListEntries(input: {
  factions: readonly FactionSummary[];
  wars: readonly WarSummary[];
  currentTick: Tick;
}): WarListEntry[] {
  const factionNameById = new Map(input.factions.map((faction) => [faction.id, faction.name]));
  const tick = input.currentTick as unknown as number;

  return input.wars
    .map((war): WarListEntry => {
      const truceUntil =
        war.truceUntilTick == null ? null : (war.truceUntilTick as unknown as number);
      return {
        id: war.id,
        kind: war.kind,
        status: war.status,
        attackerName:
          factionNameById.get(war.attackerFactionId) ??
          `#${war.attackerFactionId as unknown as number}`,
        defenderName:
          factionNameById.get(war.defenderFactionId) ??
          `#${war.defenderFactionId as unknown as number}`,
        startedTick: war.startedTick,
        elapsedTicks: Math.max(0, tick - (war.startedTick as unknown as number)),
        fatigue: clamp01(war.fatigue ?? 0),
        truceRemainingTicks: truceUntil == null ? null : Math.max(0, truceUntil - tick),
      };
    })
    .sort((left, right) => {
      const statusDelta = warStatusSortWeight(left.status) - warStatusSortWeight(right.status);
      if (statusDelta !== 0) return statusDelta;
      const elapsedDelta = right.elapsedTicks - left.elapsedTicks;
      if (elapsedDelta !== 0) return elapsedDelta;
      return (left.id as unknown as number) - (right.id as unknown as number);
    });
}

export function computeSelectedSettlementDetail(input: {
  selectedRegionId: RegionId | null;
  map: MapData | null;
  factions: readonly FactionSummary[];
  settlements: readonly SettlementSummary[];
  recentConquests: ReadonlyMap<number, Tick>;
  wars: readonly WarSummary[];
  currentTick: Tick;
}): SelectedSettlementDetail | null {
  if (!input.map || input.selectedRegionId == null) return null;

  const regionIndex = input.selectedRegionId as unknown as number;
  const province = input.map.provinces[regionIndex];
  if (!province || province.terrain === 'ocean') return null;

  const settlement = input.settlements.find(
    (candidate) => candidate.regionId === input.selectedRegionId,
  );
  if (!settlement) return null;

  const factionNameById = new Map(input.factions.map((faction) => [faction.id, faction.name]));
  const factionById = new Map(input.factions.map((faction) => [faction.id, faction]));
  const conqueredTick = input.recentConquests.get(regionIndex) ?? null;
  const siege = findSelectedSettlementSiege({
    settlement,
    wars: input.wars,
    factionNameById,
  });

  const owner = factionById.get(settlement.factionId);
  return {
    regionId: input.selectedRegionId,
    settlementId: settlement.id,
    settlementName: settlement.name,
    tier: settlement.tier,
    ownerName:
      owner?.name ??
      factionNameById.get(settlement.factionId) ??
      `#${settlement.factionId as unknown as number}`,
    ownerColorHex: owner?.colorHex ?? null,
    terrain: province.terrain,
    population: settlement.population,
    development: clamp01(settlement.development),
    loyalty: clamp01(settlement.loyalty),
    unrest: clamp01(settlement.unrest),
    revoltProgress: clamp01(settlement.revoltProgress),
    isCapital: settlement.isCapital,
    foundedTick: settlement.foundedTick,
    recentlyConquered: isRecentConquestTick(conqueredTick, input.currentTick),
    conqueredTick,
    siege,
  };
}

export function computeDebugBalanceSummary(input: {
  map: MapData | null;
  factions: readonly FactionSummary[];
  wars: readonly WarSummary[];
  replayFrameCount: number;
}): DebugBalanceSummary {
  const provinceCount = input.map?.provinces.length ?? 0;
  let landCount = 0;
  let occupiedCount = 0;

  if (input.map) {
    for (const province of input.map.provinces) {
      if (province.terrain === 'ocean') continue;
      landCount += 1;
      if (province.ownerFactionId != null) occupiedCount += 1;
    }
  }

  const livingFactions = input.factions.filter((faction) => (faction.regions ?? 0) > 0);
  const largest =
    livingFactions.length === 0
      ? null
      : livingFactions.reduce((best, faction) => (faction.regions > best.regions ? faction : best));
  const totalOwnedByFactions = livingFactions.reduce((sum, faction) => sum + faction.regions, 0);
  const activeWarCount = input.wars.filter((war) => war.status === 'active').length;
  const truceCount = input.wars.filter((war) => war.status === 'truce').length;

  return {
    provinceCount,
    landCount,
    occupiedCount,
    occupiedRatio: landCount === 0 ? 0 : occupiedCount / landCount,
    livingFactionCount: livingFactions.length,
    largestFactionName: largest?.name ?? null,
    largestShare:
      largest == null || totalOwnedByFactions === 0 ? 0 : largest.regions / totalOwnedByFactions,
    activeWarCount,
    truceCount,
    replayFrameCount: input.replayFrameCount,
  };
}

export function computeReplayEventAnchors(
  frames: readonly ReplayFrame[],
  limit = 12,
): ReplayEventAnchor[] {
  const cappedLimit = Math.max(0, Math.floor(limit));
  if (cappedLimit === 0) return [];

  const anchors: ReplayEventAnchor[] = [];
  frames.forEach((frame, index) => {
    for (const event of frame.events) {
      const category = event.category ?? 'misc';
      if (!isReplayEventAnchorCategory(category)) continue;
      anchors.push({
        cursor: index + 1,
        tick: frame.tick,
        category,
        level: event.level,
        message: event.message,
        factionId: event.factionId,
      });
    }
  });

  return anchors.length <= cappedLimit ? anchors : anchors.slice(-cappedLimit);
}

export function computeReplayHistorySummary(input: {
  meta: ReplayHistorySummaryMeta;
  initialOwnership: readonly (FactionId | null)[];
  initialFactions: readonly ReplayInitialFaction[];
  frames: readonly ReplayFrame[];
  keyEventLimit?: number;
}): ReplayHistorySummary {
  const allFactions = collectReplayFactions(input.initialFactions, input.frames);
  const startRegionsByFaction = countInitialRegions(input.initialOwnership);
  const finalRegionsByFaction = computeFinalRegions(allFactions, startRegionsByFaction, input.frames);
  const eliminatedTickByFaction = computeEliminatedTicks(
    allFactions,
    startRegionsByFaction,
    input.frames,
  );
  const lastFrame = input.frames[input.frames.length - 1];
  const winnerFactionId = lastFrame?.winnerFactionId ?? null;

  return {
    version: 1,
    meta: input.meta,
    status: lastFrame?.status ?? 'idle',
    winnerFactionId,
    keyEvents: computeReplayEventAnchors(input.frames, input.keyEventLimit ?? 24),
    eventCounts: computeReplayEventCounts(input.frames),
    factionFates: allFactions.map((faction) => {
      const finalRegions = finalRegionsByFaction.get(faction.id) ?? 0;
      return {
        factionId: faction.id,
        name: faction.name,
        leader: faction.leader,
        colorHex: faction.colorHex,
        birthRegionId: faction.birthRegionId,
        capitalRegionId: faction.capitalRegionId,
        startRegions: startRegionsByFaction.get(faction.id) ?? 0,
        finalRegions,
        eliminatedTick: eliminatedTickByFaction.get(faction.id) ?? null,
        survived: finalRegions > 0,
        winner: winnerFactionId === faction.id,
      };
    }),
  };
}

/** 仅生成空的地形分布对象，给 UI fallback 用 */
export function blankTerrainBreakdown(): Record<TerrainKind, number> {
  return emptyBreakdown();
}

export { TERRAIN_KINDS };

function findSelectedSettlementSiege(input: {
  settlement: SettlementSummary;
  wars: readonly WarSummary[];
  factionNameById: ReadonlyMap<FactionId, string>;
}): SelectedSettlementSiegeDetail | null {
  let strongest: WarSiegeProgress | null = null;
  for (const war of input.wars) {
    if (war.status !== 'active') continue;
    for (const siege of war.siegeProgress ?? []) {
      if (siege.settlementId !== input.settlement.id) continue;
      if (strongest == null || siege.progress > strongest.progress) {
        strongest = siege;
      }
    }
  }
  if (!strongest) return null;

  return {
    progress: clamp01(strongest.progress),
    attackerName:
      input.factionNameById.get(strongest.attackerFactionId) ??
      `#${strongest.attackerFactionId as unknown as number}`,
    defenderName:
      input.factionNameById.get(strongest.defenderFactionId) ??
      `#${strongest.defenderFactionId as unknown as number}`,
    lastUpdatedTick: strongest.lastUpdatedTick,
  };
}

function warStatusSortWeight(status: WarStatus): number {
  return status === 'active' ? 0 : 1;
}

function diplomacyPairKey(left: FactionId, right: FactionId): string {
  const leftNum = left as unknown as number;
  const rightNum = right as unknown as number;
  return leftNum < rightNum ? `${leftNum}:${rightNum}` : `${rightNum}:${leftNum}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isReplayEventAnchorCategory(category: LogEventCategory): boolean {
  return REPLAY_EVENT_ANCHOR_CATEGORIES.includes(category);
}

function collectReplayFactions(
  initialFactions: readonly ReplayInitialFaction[],
  frames: readonly ReplayFrame[],
): ReplayInitialFaction[] {
  const byId = new Map<number, ReplayInitialFaction>();
  for (const faction of initialFactions) {
    byId.set(faction.id as unknown as number, faction);
  }
  for (const frame of frames) {
    for (const faction of frame.newFactions ?? []) {
      byId.set(faction.id as unknown as number, faction);
    }
  }
  return Array.from(byId.values());
}

function countInitialRegions(
  initialOwnership: readonly (FactionId | null)[],
): Map<FactionId, number> {
  const counts = new Map<FactionId, number>();
  for (const owner of initialOwnership) {
    if (owner == null) continue;
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return counts;
}

function computeFinalRegions(
  factions: readonly ReplayInitialFaction[],
  startRegions: ReadonlyMap<FactionId, number>,
  frames: readonly ReplayFrame[],
): Map<FactionId, number> {
  const finalRegions = new Map<FactionId, number>();
  for (const faction of factions) {
    finalRegions.set(faction.id, startRegions.get(faction.id) ?? 0);
  }
  const lastFrame = frames[frames.length - 1];
  if (!lastFrame) return finalRegions;
  for (const row of lastFrame.rankings) {
    finalRegions.set(row.factionId as unknown as FactionId, row.regions);
  }
  return finalRegions;
}

function computeEliminatedTicks(
  factions: readonly ReplayInitialFaction[],
  startRegions: ReadonlyMap<FactionId, number>,
  frames: readonly ReplayFrame[],
): Map<FactionId, Tick> {
  const previousRegions = new Map<FactionId, number>();
  const eliminatedTicks = new Map<FactionId, Tick>();
  for (const faction of factions) {
    previousRegions.set(faction.id, startRegions.get(faction.id) ?? 0);
  }

  for (const frame of frames) {
    for (const row of frame.rankings) {
      const factionId = row.factionId as unknown as FactionId;
      const previous = previousRegions.get(factionId) ?? 0;
      if (previous > 0 && row.regions <= 0 && !eliminatedTicks.has(factionId)) {
        eliminatedTicks.set(factionId, frame.tick);
      }
      previousRegions.set(factionId, row.regions);
    }
  }

  return eliminatedTicks;
}

function computeReplayEventCounts(frames: readonly ReplayFrame[]): ReplayEventCount[] {
  const counts = new Map<LogEventCategory, number>();
  for (const frame of frames) {
    for (const event of frame.events) {
      const category = event.category ?? 'misc';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => left.category.localeCompare(right.category));
}

function rankingOwnerOf(
  province: { terrain: TerrainKind; ownerFactionId: FactionId | null } | undefined,
): FactionId | null {
  if (!province || province.terrain === 'ocean') return null;
  return province.ownerFactionId ?? null;
}
