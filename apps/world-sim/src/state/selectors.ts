import type { MapData } from '@/core/map';
import { TERRAIN_KINDS, type TerrainKind } from '@/core/map';
import type { FactionId, FactionSummary } from '@/shared/types';
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
  /** 控制份额（0~1），由当前总占领数除以全图州数 */
  share: number;
  /** 排名（1 起，区域多者靠前；并列时按 borderLength 后置） */
  rank: number;
}

const EMPTY_TERRAIN_BREAKDOWN: Record<TerrainKind, number> = {
  plain: 0,
  forest: 0,
  mountain: 0,
  desert: 0,
  river: 0,
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
  const total = provinces.length;

  const regionsMap = new Map<FactionId, number>();
  const breakdownMap = new Map<FactionId, Record<TerrainKind, number>>();
  const borderMap = new Map<FactionId, number>();

  for (const province of provinces) {
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
    const leftOwner = provinces[leftIdx]?.ownerFactionId ?? null;
    const rightOwner = rightIdx == null ? null : (provinces[rightIdx]?.ownerFactionId ?? null);

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

/** 仅生成空的地形分布对象，给 UI fallback 用 */
export function blankTerrainBreakdown(): Record<TerrainKind, number> {
  return emptyBreakdown();
}

export { TERRAIN_KINDS };
