import type { MapData, Province, TerrainKind } from '@/core/map';
import type { RandomSource } from '@/shared/math';
import type { RegionId } from '@/shared/types';

export type SpawnBalanceScore = {
  regionId: RegionId;
  score: number;
  edgeScore: number;
  coastScore: number;
  roomScore: number;
  terrainScore: number;
  spacingScore: number;
};

type SpawnCandidate = {
  province: Province;
  staticScore: number;
  edgeScore: number;
  coastScore: number;
  roomScore: number;
  terrainScore: number;
};

const COAST_HOP_LIMIT = 6;
const ROOM_HOP_LIMIT = 4;
const MIN_SCORE = 0.001;

const TERRAIN_SPAWN_SCORE: Record<TerrainKind, number> = {
  plain: 1,
  forest: 0.88,
  river: 0.84,
  desert: 0.62,
  mountain: 0.55,
  ocean: 0,
};

export function selectBalancedSpawnRegions(input: {
  map: MapData;
  count: number;
  occupied?: Set<number>;
  rng: RandomSource;
}): SpawnBalanceScore[] {
  if (input.count <= 0) return [];

  const occupied = input.occupied ?? new Set<number>();
  const candidates = buildSpawnCandidates(input.map, occupied);
  const selected: SpawnBalanceScore[] = [];
  const selectedIds = new Set<number>();
  const desiredSpacing = getDesiredSpacing(input.map, input.count);

  while (selected.length < input.count && selected.length < candidates.length) {
    let best: SpawnBalanceScore | null = null;
    for (const candidate of candidates) {
      const idNum = candidate.province.id as unknown as number;
      if (selectedIds.has(idNum)) continue;

      const spacingScore = getSpacingScore(input.map, candidate.province, selected, desiredSpacing);
      const score =
        candidate.staticScore * 0.55 +
        spacingScore * 0.45 +
        input.rng.next() * 0.01;
      const item: SpawnBalanceScore = {
        regionId: candidate.province.id,
        score,
        edgeScore: candidate.edgeScore,
        coastScore: candidate.coastScore,
        roomScore: candidate.roomScore,
        terrainScore: candidate.terrainScore,
        spacingScore,
      };
      if (best == null || item.score > best.score) best = item;
    }
    if (best == null) break;
    selected.push(best);
    selectedIds.add(best.regionId as unknown as number);
  }

  return selected;
}

function buildSpawnCandidates(map: MapData, occupied: Set<number>): SpawnCandidate[] {
  const coastHops = computeCoastHops(map);
  const roomCounts = new Map<number, number>();
  let maxRoom = 1;

  for (const province of map.provinces) {
    const idNum = province.id as unknown as number;
    if (province.terrain === 'ocean' || province.ownerFactionId != null || occupied.has(idNum)) {
      continue;
    }
    const room = countReachableLand(map, idNum, ROOM_HOP_LIMIT);
    roomCounts.set(idNum, room);
    maxRoom = Math.max(maxRoom, room);
  }

  const minDim = Math.max(1, Math.min(map.meta.bounds.width, map.meta.bounds.height));
  return map.provinces
    .filter((province) => {
      const idNum = province.id as unknown as number;
      return province.terrain !== 'ocean' && province.ownerFactionId == null && !occupied.has(idNum);
    })
    .map((province) => {
      const idNum = province.id as unknown as number;
      const edgeDistance = Math.min(
        province.centroid.x,
        province.centroid.y,
        map.meta.bounds.width - province.centroid.x,
        map.meta.bounds.height - province.centroid.y,
      );
      const edgeScore = clamp01(edgeDistance / (minDim * 0.18));
      const coastScore = clamp01((coastHops.get(idNum) ?? COAST_HOP_LIMIT) / COAST_HOP_LIMIT);
      const roomScore = clamp01((roomCounts.get(idNum) ?? 0) / maxRoom);
      const terrainScore = TERRAIN_SPAWN_SCORE[province.terrain];
      const staticScore =
        edgeScore * 0.26 + coastScore * 0.24 + roomScore * 0.3 + terrainScore * 0.2;
      return {
        province,
        staticScore: Math.max(MIN_SCORE, staticScore),
        edgeScore,
        coastScore,
        roomScore,
        terrainScore,
      };
    });
}

function computeCoastHops(map: MapData): Map<number, number> {
  const outerBorderIds = new Set<number>();
  map.borders.forEach((edge, index) => {
    if (edge.right == null) outerBorderIds.add(index);
  });

  const hops = new Map<number, number>();
  const queue: number[] = [];
  for (const province of map.provinces) {
    const idNum = province.id as unknown as number;
    if (province.terrain === 'ocean') continue;
    const touchesCoast =
      province.borderEdgeIds.some((edgeId) => outerBorderIds.has(edgeId)) ||
      province.neighbors.some((neighborId) => {
        const neighbor = map.provinces[neighborId as unknown as number];
        return neighbor?.terrain === 'ocean';
      });
    if (!touchesCoast) continue;
    hops.set(idNum, 0);
    queue.push(idNum);
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    const currentHop = hops.get(current) ?? 0;
    if (currentHop >= COAST_HOP_LIMIT) continue;
    const province = map.provinces[current];
    if (!province) continue;
    for (const neighborId of province.neighbors) {
      const neighbor = neighborId as unknown as number;
      const neighborProvince = map.provinces[neighbor];
      if (!neighborProvince || neighborProvince.terrain === 'ocean' || hops.has(neighbor)) {
        continue;
      }
      hops.set(neighbor, currentHop + 1);
      queue.push(neighbor);
    }
  }

  return hops;
}

function countReachableLand(map: MapData, start: number, maxHops: number): number {
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

function getSpacingScore(
  map: MapData,
  province: Province,
  selected: SpawnBalanceScore[],
  desiredSpacing: number,
): number {
  if (selected.length === 0) return 1;
  let nearest = Number.POSITIVE_INFINITY;
  for (const item of selected) {
    const selectedProvince = map.provinces[item.regionId as unknown as number];
    if (!selectedProvince) continue;
    nearest = Math.min(nearest, distance(province.centroid, selectedProvince.centroid));
  }
  return clamp01(nearest / desiredSpacing);
}

function getDesiredSpacing(map: MapData, count: number): number {
  const area = Math.max(1, map.meta.bounds.width * map.meta.bounds.height);
  return Math.sqrt(area / Math.max(1, count)) * 0.82;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
