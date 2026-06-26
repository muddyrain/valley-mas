import { TERRAIN_KINDS, type TerrainKind } from '@/core/map';
import { asRegionId } from '@/shared/types';
import type { SpawnDirective, SpawnQuadrant } from './types';

const QUADRANTS: ReadonlySet<SpawnQuadrant> = new Set<SpawnQuadrant>([
  'n',
  's',
  'e',
  'w',
  'nw',
  'ne',
  'sw',
  'se',
  'center',
]);

const TERRAIN_SET: ReadonlySet<TerrainKind> = new Set<TerrainKind>(TERRAIN_KINDS);

/**
 * 把字符串形式的出生指令解析为 SpawnDirective。
 *
 *   "17"           → fixed RegionId(17)
 *   "random"       → 任意空州
 *   "random:plain" → 指定地形随机
 *   "random:n"     → 指定方位随机
 *
 * 解析失败返回 null，调用方应当回退到 random。
 */
export function parseSpawnDirective(token: string): SpawnDirective | null {
  const trimmed = token.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  if (trimmed === 'random') {
    return { kind: 'random' };
  }

  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return { kind: 'fixed', regionId: asRegionId(n) };
  }

  if (trimmed.startsWith('random:')) {
    const tail = trimmed.slice('random:'.length);
    if (TERRAIN_SET.has(tail as TerrainKind)) {
      return { kind: 'random-terrain', terrain: tail as TerrainKind };
    }
    if (QUADRANTS.has(tail as SpawnQuadrant)) {
      return { kind: 'random-quadrant', quadrant: tail as SpawnQuadrant };
    }
    return null;
  }

  return null;
}
