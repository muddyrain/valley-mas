import type { RegionId } from '@/shared/types';
import type { MapData, Province } from './types';

/**
 * 命中测试：根据世界坐标找到所属州。
 *
 * 思路：
 * - 先用 Voronoi 的 site 找最近站点（O(n) 当前实现，足够 100/300/500 规模）。
 * - 再做点-多边形检查；若不在多边形内，仍返回最近站点（边界容错）。
 *
 * 后续 Phase 5 可换成 d3-delaunay `find` + 空间分桶，进一步加速。
 */
export function findProvinceAt(map: MapData, x: number, y: number): RegionId | null {
  const { provinces } = map;
  if (provinces.length === 0) return null;

  let bestId = provinces[0].id;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i];
    const dx = p.site.x - x;
    const dy = p.site.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      bestId = p.id;
    }
  }
  return bestId;
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
