import type { MapData } from '@/core/map';
import type { FactionId, RegionId, Tick } from '@/shared/types';
import { isRecentConquestTick, type RecentConquestMemory } from './conquestMemory';

const DEFAULT_MAX_REVOLT_REGIONS = 4;
const DEFAULT_MAX_REVOLT_DEPTH = 2;

export interface CollectRevoltRegionIdsInput {
  map: MapData;
  rootRegionId: RegionId;
  parentFactionId: FactionId;
  parentCapitalRegionId?: RegionId | null;
  currentTick: Tick;
  recentConquests?: RecentConquestMemory;
  maxRegions?: number;
  maxDepth?: number;
}

interface RevoltCandidate {
  regionId: RegionId;
  depth: number;
  recentlyConquered: boolean;
  rebelNeighborCount: number;
}

export function collectRevoltRegionIds(input: CollectRevoltRegionIdsInput): RegionId[] {
  const maxRegions = Math.max(1, input.maxRegions ?? DEFAULT_MAX_REVOLT_REGIONS);
  const maxDepth = Math.max(0, input.maxDepth ?? DEFAULT_MAX_REVOLT_DEPTH);
  if (!isEligibleRevoltRegion(input, input.rootRegionId)) return [];

  const selected = new Set<RegionId>([input.rootRegionId]);
  const visited = new Set<RegionId>([input.rootRegionId]);
  const queue: Array<{ regionId: RegionId; depth: number }> = [{ regionId: input.rootRegionId, depth: 0 }];
  const candidates: RevoltCandidate[] = [];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const item = queue[cursor];
    if (item.depth >= maxDepth) continue;
    const province = input.map.provinces[item.regionId as unknown as number];
    if (!province) continue;

    for (const neighborId of province.neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      if (!isEligibleRevoltRegion(input, neighborId)) continue;

      const depth = item.depth + 1;
      queue.push({ regionId: neighborId, depth });
      candidates.push({
        regionId: neighborId,
        depth,
        recentlyConquered: isRecentConquestTick(
          input.recentConquests?.get(neighborId as unknown as number),
          input.currentTick,
        ),
        rebelNeighborCount: countSelectedNeighbors(input.map, neighborId, selected),
      });
    }
  }

  candidates.sort(compareRevoltCandidate);
  for (const candidate of candidates) {
    if (selected.size >= maxRegions) break;
    selected.add(candidate.regionId);
  }

  return Array.from(selected);
}

function compareRevoltCandidate(a: RevoltCandidate, b: RevoltCandidate): number {
  if (a.recentlyConquered !== b.recentlyConquered) return a.recentlyConquered ? -1 : 1;
  if (a.depth !== b.depth) return a.depth - b.depth;
  if (a.rebelNeighborCount !== b.rebelNeighborCount) return b.rebelNeighborCount - a.rebelNeighborCount;
  return (a.regionId as unknown as number) - (b.regionId as unknown as number);
}

function isEligibleRevoltRegion(input: CollectRevoltRegionIdsInput, regionId: RegionId): boolean {
  if (input.parentCapitalRegionId != null && regionId === input.parentCapitalRegionId) return false;
  const province = input.map.provinces[regionId as unknown as number];
  return (
    province != null &&
    province.terrain !== 'ocean' &&
    province.ownerFactionId === input.parentFactionId
  );
}

function countSelectedNeighbors(
  map: MapData,
  regionId: RegionId,
  selected: ReadonlySet<RegionId>,
): number {
  const province = map.provinces[regionId as unknown as number];
  if (!province) return 0;
  return province.neighbors.filter((neighborId) => selected.has(neighborId)).length;
}
