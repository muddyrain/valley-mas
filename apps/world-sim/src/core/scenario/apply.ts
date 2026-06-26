import type { MapBounds, MapData, Province } from '@/core/map';
import type { RandomSource } from '@/shared/math';
import type { FactionId, RegionId } from '@/shared/types';
import { DEFAULT_LEADER_POOL, NAME_LEADER_PRESET } from './defaults';
import { parseSpawnDirective } from './parse';
import type {
  Scenario,
  ScenarioApplyResult,
  ScenarioFaction,
  ScenarioFactionAssignment,
  SpawnDirective,
  SpawnQuadrant,
} from './types';

export interface ApplyScenarioOptions {
  map: MapData;
  scenario: Scenario;
  rng: RandomSource;
  /** 颁发新的 FactionId（与 factionSlice 共用同一序列） */
  mintFactionId: () => FactionId;
  /** 留空时给势力兜底用的颜色池 */
  fallbackColors?: readonly string[];
  /** 留空时给势力兜底用的君主池 */
  fallbackLeaders?: readonly string[];
}

const DEFAULT_FALLBACK_COLORS = [
  '#e05656',
  '#3a82f6',
  '#4caf7c',
  '#f5b942',
  '#a05fd0',
  '#36c2c4',
  '#e08a3a',
  '#7a86c2',
];

const DEFAULT_FALLBACK_LEADERS = DEFAULT_LEADER_POOL;

/**
 * 把剧本应用到当前地图：解析每家势力的 spawnProvinceIds，依序占领空州。
 * 不修改入参 map，返回 ownership 覆写列表，由状态层负责落盘。
 */
export function applyScenarioToWorld(opts: ApplyScenarioOptions): ScenarioApplyResult {
  const { map, scenario, rng, mintFactionId } = opts;
  const fallbackColors = opts.fallbackColors ?? DEFAULT_FALLBACK_COLORS;
  const fallbackLeaders = opts.fallbackLeaders ?? DEFAULT_FALLBACK_LEADERS;

  /** 已被本次剧本占用的州（避免不同势力抢同一州） */
  const occupied = new Set<number>();
  const assignments: ScenarioFactionAssignment[] = [];
  const ownership: Array<{ regionId: RegionId; factionId: FactionId }> = [];
  const usedLeaders = new Set<string>();
  let unresolvedCount = 0;

  scenario.factions.forEach((faction, factionIdx) => {
    const factionId = mintFactionId();
    const colorHex = pickColor(faction, fallbackColors, factionIdx);
    const leader = pickLeader(faction, fallbackLeaders, factionIdx, usedLeaders);
    usedLeaders.add(leader);

    const tokens = faction.spawnProvinceIds.length > 0 ? faction.spawnProvinceIds : ['random'];
    const spawnRegionIds: RegionId[] = [];

    for (const token of tokens) {
      const directive = parseSpawnDirective(token) ?? { kind: 'random' };
      const picked = pickRegionForDirective(map, directive, occupied, rng);
      if (picked == null) {
        unresolvedCount += 1;
        continue;
      }
      occupied.add(picked as unknown as number);
      spawnRegionIds.push(picked);
      ownership.push({ regionId: picked, factionId });
    }

    assignments.push({
      factionId,
      factionName: faction.factionName,
      leader,
      colorHex,
      birthRegionId: spawnRegionIds[0] ?? null,
      spawnRegionIds,
    });
  });

  return { factionAssignments: assignments, ownership, unresolvedCount };
}

function pickColor(faction: ScenarioFaction, fallback: readonly string[], index: number): string {
  if (faction.colorHex && /^#[0-9a-fA-F]{6}$/.test(faction.colorHex)) {
    return faction.colorHex.toLowerCase();
  }
  return fallback[index % fallback.length];
}

function pickLeader(
  faction: ScenarioFaction,
  fallback: readonly string[],
  index: number,
  used: Set<string>,
): string {
  const trimmed = (faction.leader ?? '').trim();
  if (trimmed.length > 0) return trimmed;
  // 1) 朝代名命中预设：蜀汉→刘备 / 大唐→李世民 等，且未被同剧本其他势力占用
  const preset = NAME_LEADER_PRESET[faction.factionName];
  if (preset && !used.has(preset)) return preset;
  // 2) 默认君主池里挑首个未占用名
  for (const candidate of fallback) {
    if (!used.has(candidate)) return candidate;
  }
  // 3) 池用尽：循环回退，避免出现「未知君主」占位
  return fallback[index % fallback.length] ?? '佚名君主';
}

function pickRegionForDirective(
  map: MapData,
  directive: SpawnDirective,
  occupied: Set<number>,
  rng: RandomSource,
): RegionId | null {
  if (directive.kind === 'fixed') {
    const idx = directive.regionId as unknown as number;
    const province = map.provinces[idx];
    if (!province) return null;
    if (occupied.has(idx)) return null;
    if (province.ownerFactionId != null) return null;
    return province.id;
  }

  const candidates: Province[] = [];
  for (const province of map.provinces) {
    if (province.ownerFactionId != null) continue;
    if (province.terrain === 'ocean') continue; // 海洋州不可出生
    const idx = province.id as unknown as number;
    if (occupied.has(idx)) continue;
    if (directive.kind === 'random-terrain' && province.terrain !== directive.terrain) continue;
    if (
      directive.kind === 'random-quadrant' &&
      !isInQuadrant(province, directive.quadrant, map.meta.bounds)
    ) {
      continue;
    }
    candidates.push(province);
  }

  // 方位/地形指令找不到合规州时回退到任意空州，避免剧本"错位"导致整家落空
  if (candidates.length === 0 && directive.kind !== 'random') {
    for (const province of map.provinces) {
      if (province.ownerFactionId != null) continue;
      if (province.terrain === 'ocean') continue;
      const idx = province.id as unknown as number;
      if (occupied.has(idx)) continue;
      candidates.push(province);
    }
  }

  if (candidates.length === 0) return null;
  const pickIdx = Math.floor(rng.next() * candidates.length);
  return candidates[Math.min(pickIdx, candidates.length - 1)].id;
}

function isInQuadrant(province: Province, quadrant: SpawnQuadrant, bounds: MapBounds): boolean {
  const cx = province.centroid.x;
  const cy = province.centroid.y;
  const w = bounds.width;
  const h = bounds.height;
  const xBand = bandIndex(cx, w); // 0 = 左 / 1 = 中 / 2 = 右
  const yBand = bandIndex(cy, h); // 0 = 上 / 1 = 中 / 2 = 下

  switch (quadrant) {
    case 'n':
      return yBand === 0;
    case 's':
      return yBand === 2;
    case 'w':
      return xBand === 0;
    case 'e':
      return xBand === 2;
    case 'nw':
      return xBand === 0 && yBand === 0;
    case 'ne':
      return xBand === 2 && yBand === 0;
    case 'sw':
      return xBand === 0 && yBand === 2;
    case 'se':
      return xBand === 2 && yBand === 2;
    case 'center':
      return xBand === 1 && yBand === 1;
    default:
      return false;
  }
}

function bandIndex(value: number, total: number): 0 | 1 | 2 {
  if (value < total / 3) return 0;
  if (value < (total * 2) / 3) return 1;
  return 2;
}
