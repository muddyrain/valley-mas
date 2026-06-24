import type { MapData } from '@/core/map';
import type { FactionId, RegionId } from '@/shared/types';

export interface CapitalInfo {
  capital: RegionId | null;
  centroid: RegionId | null;
}

/**
 * computeCapitalsAndCentroids 的最小输入：仅依赖势力 id 与当前 capital。
 * 这样 simSlice (FactionSummary) 与 replaySlice (ReplayInitialFaction) 都能复用。
 */
export interface FactionCapitalInput {
  id: FactionId;
  capitalRegionId: RegionId | null;
}

/**
 * Phase 8.5：在所有 ownership 变更应用后，重新计算每势力的领土重心州；
 * 若当前 capital 不在己方掌控，则迁都至 centroid。无领土的势力 capital/centroid 均为 null。
 *
 * 纯函数：不读 store、不写 store；simSlice live tick 与 replaySlice rebuild 共用，
 * 保证录制态与回放态的首都/重心始终一致。
 */
export function computeCapitalsAndCentroids(
  map: MapData,
  factions: ReadonlyArray<FactionCapitalInput>,
): Map<FactionId, CapitalInfo> {
  const out = new Map<FactionId, CapitalInfo>();
  const sumByFaction = new Map<FactionId, { x: number; y: number; count: number }>();
  const ownedByFaction = new Map<FactionId, number[]>();
  for (const province of map.provinces) {
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    let agg = sumByFaction.get(owner);
    if (!agg) {
      agg = { x: 0, y: 0, count: 0 };
      sumByFaction.set(owner, agg);
    }
    agg.x += province.centroid.x;
    agg.y += province.centroid.y;
    agg.count += 1;
    let owned = ownedByFaction.get(owner);
    if (!owned) {
      owned = [];
      ownedByFaction.set(owner, owned);
    }
    owned.push(province.id as unknown as number);
  }
  for (const f of factions) {
    const agg = sumByFaction.get(f.id);
    if (!agg || agg.count === 0) {
      out.set(f.id, { capital: null, centroid: null });
      continue;
    }
    const avgX = agg.x / agg.count;
    const avgY = agg.y / agg.count;
    const owned = ownedByFaction.get(f.id) ?? [];
    let bestId = owned[0];
    let bestDist = Infinity;
    for (const idNum of owned) {
      const p = map.provinces[idNum];
      if (!p) continue;
      const dx = p.centroid.x - avgX;
      const dy = p.centroid.y - avgY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestId = idNum;
      }
    }
    const centroidId = bestId as unknown as RegionId;

    let capitalId = f.capitalRegionId;
    if (capitalId == null) {
      capitalId = centroidId;
    } else {
      const capProvince = map.provinces[capitalId as unknown as number];
      if (!capProvince || capProvince.ownerFactionId !== f.id) {
        capitalId = centroidId;
      }
    }
    out.set(f.id, { capital: capitalId, centroid: centroidId });
  }
  return out;
}
