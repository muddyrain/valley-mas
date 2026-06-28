import { Delaunay } from 'd3-delaunay';
import type { RegionId } from '@/shared/types';
import type { MapData, Province } from './types';

export interface ProvinceHitIndex {
  delaunay: Delaunay<Float64Array>;
  provinceIds: RegionId[];
}

const provinceHitIndexCache = new WeakMap<MapData, ProvinceHitIndex>();

/**
 * 命中测试：根据世界坐标找到所属州。
 *
 * 思路：
 * - 首次为 MapData 构建 Delaunay site 索引，并通过 WeakMap 缓存。
 * - 后续 hover / 点击 / 编辑涂抹复用索引，避免每次 pointermove 线性扫描全图。
 * - 返回最近站点对应州；这与 Voronoi 生成逻辑一致，边界上保持稳定容错。
 */
export function findProvinceAt(map: MapData, x: number, y: number): RegionId | null {
  const index = getProvinceHitIndex(map);
  if (!index) return null;
  return index.provinceIds[index.delaunay.find(x, y)] ?? null;
}

export function createProvinceHitIndex(map: MapData): ProvinceHitIndex | null {
  const { provinces } = map;
  if (provinces.length === 0) return null;
  const points = new Float64Array(provinces.length * 2);
  const provinceIds: RegionId[] = new Array(provinces.length);
  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    points[i * 2] = province.site.x;
    points[i * 2 + 1] = province.site.y;
    provinceIds[i] = province.id;
  }
  return {
    delaunay: new Delaunay(points),
    provinceIds,
  };
}

function getProvinceHitIndex(map: MapData): ProvinceHitIndex | null {
  const cached = provinceHitIndexCache.get(map);
  if (cached) return cached;
  const next = createProvinceHitIndex(map);
  if (next) provinceHitIndexCache.set(map, next);
  return next;
}

/**
 * 经典射线法点-多边形检查；保留备用（生成阶段用 site 距离更稳）。
 */
export function isPointInProvince(province: Province, x: number, y: number): boolean {
  const poly = province.polygon;
  if (poly.length === 0) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
