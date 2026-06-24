import { Delaunay, type Voronoi } from 'd3-delaunay';
import type { RandomSource } from '@/shared/math';
import { createPrngFromSeed } from '@/shared/math';
import { asRegionId, type RegionId } from '@/shared/types';
import { assignTerrains } from './terrain';
import type { BorderEdge, MapBounds, MapData, Province } from './types';

export interface MapGenerationOptions {
  seed: string;
  provinceCount: number;
  bounds: MapBounds;
  /** Lloyd 松弛次数，用于让 Voronoi 单元更均匀；默认 2 */
  relaxIterations?: number;
}

/**
 * Phase 2 随机地图生成器。
 *
 * 流程：
 * 1. 用确定性 PRNG 在矩形范围内撒点。
 * 2. d3-delaunay 计算 Delaunay/Voronoi。
 * 3. 用 Lloyd 松弛把站点向 Voronoi 重心移动 N 轮，避免分布过密/过疏。
 * 4. 根据 Delaunay 三角形/halfedges 计算邻接关系（neighbors）。
 * 5. 抽取所有 Voronoi 单元的多边形与共享边（borders）。
 *
 * 仅生成地理与拓扑结构，不涉及势力扩张/经济/战争。
 */
export function generateMap(options: MapGenerationOptions): MapData {
  const { seed, provinceCount, bounds } = options;
  const relaxIterations = options.relaxIterations ?? 2;
  const rng = createPrngFromSeed(seed);

  const points = scatterSites(rng, provinceCount, bounds);
  const flat = pointsToFlatArray(points);
  let delaunay = new Delaunay(flat);
  let voronoi = delaunay.voronoi([0, 0, bounds.width, bounds.height]);

  for (let i = 0; i < relaxIterations; i++) {
    relaxOnce(delaunay, voronoi, flat, bounds);
    delaunay = new Delaunay(flat);
    voronoi = delaunay.voronoi([0, 0, bounds.width, bounds.height]);
  }

  const provinces = buildProvinces(delaunay, voronoi, flat, provinceCount);
  const borders = buildBorders(delaunay, voronoi, provinceCount);

  attachBorderEdgesToProvinces(provinces, borders);

  // Phase 3：用同一个 seed 字符串派生噪声，给每个州赋地形属性
  assignTerrains(provinces, borders, { seed, bounds });

  return {
    meta: {
      seed,
      provinceCount: provinces.length,
      relaxIterations,
      bounds,
    },
    provinces,
    borders,
  };
}

/* ------------------------------------------------------------------ */
/* 内部辅助                                                            */
/* ------------------------------------------------------------------ */

function scatterSites(
  rng: RandomSource,
  count: number,
  bounds: MapBounds,
): Array<{ x: number; y: number }> {
  const margin = Math.min(bounds.width, bounds.height) * 0.02;
  const out: Array<{ x: number; y: number }> = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = {
      x: rng.range(margin, bounds.width - margin),
      y: rng.range(margin, bounds.height - margin),
    };
  }
  return out;
}

function pointsToFlatArray(points: Array<{ x: number; y: number }>): Float64Array {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = points[i].x;
    flat[i * 2 + 1] = points[i].y;
  }
  return flat;
}

/**
 * 一次 Lloyd 松弛：把每个站点移动到其 Voronoi cell 的重心。
 * 直接修改 `flat` 内容。
 */
function relaxOnce(
  delaunay: Delaunay<Float64Array>,
  voronoi: Voronoi<Float64Array>,
  flat: Float64Array,
  bounds: MapBounds,
): void {
  const n = flat.length / 2;
  for (let i = 0; i < n; i++) {
    const polygon = voronoi.cellPolygon(i);
    if (!polygon || polygon.length === 0) continue;
    const [cx, cy] = polygonCentroid(polygon);
    flat[i * 2] = clamp(cx, 0, bounds.width);
    flat[i * 2 + 1] = clamp(cy, 0, bounds.height);
  }
  // delaunay/voronoi 不是 inplace 的，调用方会重建
  void delaunay;
}

function polygonCentroid(polygon: Array<[number, number]> | number[][]): [number, number] {
  let sumX = 0;
  let sumY = 0;
  let sumA = 0;
  const n = polygon.length;
  // d3-delaunay 多边形闭合（首尾相同），处理时跳过最后一个重复点
  const last = pointEquals(polygon[0], polygon[n - 1]) ? n - 1 : n;
  for (let i = 0; i < last; i++) {
    const [x0, y0] = polygon[i] as [number, number];
    const [x1, y1] = polygon[(i + 1) % last] as [number, number];
    const cross = x0 * y1 - x1 * y0;
    sumA += cross;
    sumX += (x0 + x1) * cross;
    sumY += (y0 + y1) * cross;
  }
  if (sumA === 0) {
    // 退化情况：取顶点平均
    let mx = 0;
    let my = 0;
    for (let i = 0; i < last; i++) {
      mx += polygon[i][0] as number;
      my += polygon[i][1] as number;
    }
    return [mx / last, my / last];
  }
  const a = sumA * 0.5;
  return [sumX / (6 * a), sumY / (6 * a)];
}

function pointEquals(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function buildProvinces(
  _delaunay: Delaunay<Float64Array>,
  voronoi: Voronoi<Float64Array>,
  flat: Float64Array,
  count: number,
): Province[] {
  const provinces: Province[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const id = asRegionId(i);
    const site = { x: flat[i * 2], y: flat[i * 2 + 1] };
    const rawPolygon = voronoi.cellPolygon(i);
    const polygon = polygonToPoints(rawPolygon);
    const neighbors = collectNeighbors(voronoi, i);
    const centroid = computeCentroid(polygon, site);

    provinces[i] = {
      id,
      site,
      polygon,
      neighbors,
      borderEdgeIds: [],
      centroid,
      terrain: 'plain',
      elevation: 0,
      moisture: 0,
      ownerFactionId: null,
    };
  }
  return provinces;
}

function polygonToPoints(
  rawPolygon: Array<[number, number]> | number[][] | null,
): Array<{ x: number; y: number }> {
  if (!rawPolygon || rawPolygon.length === 0) return [];
  const n = rawPolygon.length;
  const last = pointEquals(rawPolygon[0], rawPolygon[n - 1]) ? n - 1 : n;
  const out: Array<{ x: number; y: number }> = new Array(last);
  for (let i = 0; i < last; i++) {
    out[i] = { x: rawPolygon[i][0] as number, y: rawPolygon[i][1] as number };
  }
  return out;
}

function collectNeighbors(voronoi: Voronoi<Float64Array>, i: number): RegionId[] {
  const out: RegionId[] = [];
  for (const j of voronoi.neighbors(i)) {
    out.push(asRegionId(j));
  }
  return out;
}

function computeCentroid(
  polygon: Array<{ x: number; y: number }>,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (polygon.length === 0) return { x: fallback.x, y: fallback.y };
  const arr: Array<[number, number]> = polygon.map((p) => [p.x, p.y]);
  const [cx, cy] = polygonCentroid(arr);
  if (Number.isFinite(cx) && Number.isFinite(cy)) {
    return { x: cx, y: cy };
  }
  return { x: fallback.x, y: fallback.y };
}

/**
 * 计算共享边集合。
 *
 * 策略：枚举每个 Voronoi cell 的环形顶点对（有序边），用 hash 把同一条无向边
 * 的两个朝向合并到同一个 BorderEdge。任何只出现一次的边即地图外边界
 * （right = null）。
 */
function buildBorders(
  _delaunay: Delaunay<Float64Array>,
  voronoi: Voronoi<Float64Array>,
  count: number,
): BorderEdge[] {
  const borderMap = new Map<string, BorderEdge>();

  for (let i = 0; i < count; i++) {
    const polygon = voronoi.cellPolygon(i);
    if (!polygon || polygon.length === 0) continue;
    const n = polygon.length;
    const last = pointEquals(polygon[0], polygon[n - 1]) ? n - 1 : n;

    for (let k = 0; k < last; k++) {
      const p0 = polygon[k];
      const p1 = polygon[(k + 1) % last];
      const ax = p0[0] as number;
      const ay = p0[1] as number;
      const bx = p1[0] as number;
      const by = p1[1] as number;
      const key = makeEdgeKey(ax, ay, bx, by);

      const existing = borderMap.get(key);
      if (existing) {
        if (existing.right == null) {
          existing.right = asRegionId(i);
        }
      } else {
        borderMap.set(key, {
          a: { x: ax, y: ay },
          b: { x: bx, y: by },
          left: asRegionId(i),
          right: null,
        });
      }
    }
  }

  return Array.from(borderMap.values());
}

/**
 * 生成无向边的稳定 hash。坐标做 1e-3 量化避免浮点误差导致同一条边被拆成两条。
 */
function makeEdgeKey(ax: number, ay: number, bx: number, by: number): string {
  const ka = quantize(ax) + ',' + quantize(ay);
  const kb = quantize(bx) + ',' + quantize(by);
  return ka < kb ? ka + '|' + kb : kb + '|' + ka;
}

function quantize(v: number): number {
  return Math.round(v * 1000);
}

function attachBorderEdgesToProvinces(provinces: Province[], borders: BorderEdge[]): void {
  for (let i = 0; i < borders.length; i++) {
    const edge = borders[i];
    provinces[edge.left].borderEdgeIds.push(i);
    if (edge.right != null) {
      provinces[edge.right].borderEdgeIds.push(i);
    }
  }
}
