import { Delaunay, type Voronoi } from 'd3-delaunay';
import { createNoise2D } from 'simplex-noise';
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
  const terrainBeforeMask = provinces.map((province) => province.terrain);

  // Phase 1：用陆地掩膜将边缘州标记为 ocean，形成不规则海岸线
  applyLandMask(provinces, bounds, seed);
  applyEdgeSea(provinces, borders);
  keepLargestLandmass(provinces);
  limitLargeInteriorWater(provinces, borders, terrainBeforeMask);

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

/**
 * 陆地掩膜：用 simplex 噪声生成不规则陆地轮廓，掩膜外的州标记为 ocean。
 *
 * 逻辑：
 * 1. 用 seed 派生独立 PRNG 生成噪声函数。
 * 2. 对每个州的 centroid 采样噪声值，归一化到 [0,1]。
 * 3. 噪声值 < landThreshold 的州标记为 ocean。
 * 4. 用多倍频 fBm 让海岸线更自然。
 */
function applyLandMask(provinces: Province[], bounds: MapBounds, seed: string): void {
  const maskRng = createPrngFromSeed(seed + ':landmask');
  const maskNoise = createNoise2D(() => maskRng.next());

  const baseScale = 1 / Math.max(1, Math.min(bounds.width, bounds.height) / 3);
  const landThreshold = 0.42;

  for (const province of provinces) {
    const cx = province.centroid.x;
    const cy = province.centroid.y;

    // 多倍频 fBm 采样
    const maskValue = fbm(maskNoise, cx * baseScale, cy * baseScale, 4, 2.1, 0.5);
    // [-1,1] → [0,1]
    const normalized = clamp01(maskValue * 0.5 + 0.5);

    // 边缘衰减：靠近图框的州更可能成为海洋
    const edgeFalloff = computeEdgeFalloff(cx, cy, bounds);
    const finalValue = normalized * 0.7 + 0.3 * edgeFalloff;

    if (finalValue < landThreshold) {
      province.terrain = 'ocean';
    }
  }
}

function applyEdgeSea(provinces: Province[], borders: BorderEdge[]): void {
  for (const province of provinces) {
    if (isProvinceOnOuterBorder(province, borders)) {
      province.terrain = 'ocean';
    }
  }
}

function keepLargestLandmass(provinces: Province[]): void {
  const seen = new Uint8Array(provinces.length);
  let largestComponent: number[] = [];

  for (const province of provinces) {
    const start = province.id as unknown as number;
    if (seen[start] || province.terrain === 'ocean') continue;

    const component: number[] = [];
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      component.push(current);
      const currentProvince = provinces[current];
      if (!currentProvince) continue;

      for (const neighborId of currentProvince.neighbors) {
        const neighbor = neighborId as unknown as number;
        const neighborProvince = provinces[neighbor];
        if (!neighborProvince || seen[neighbor] || neighborProvince.terrain === 'ocean') {
          continue;
        }
        seen[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    if (component.length > largestComponent.length) {
      largestComponent = component;
    }
  }

  if (largestComponent.length === 0) return;

  const keep = new Set(largestComponent);
  for (const province of provinces) {
    const id = province.id as unknown as number;
    if (!keep.has(id)) {
      province.terrain = 'ocean';
    }
  }
}

function limitLargeInteriorWater(
  provinces: Province[],
  borders: BorderEdge[],
  terrainBeforeMask: Province['terrain'][],
): void {
  const maxInteriorWaterSize = Math.max(6, Math.floor(provinces.length * 0.015));
  const seen = new Uint8Array(provinces.length);

  for (const province of provinces) {
    const start = province.id as unknown as number;
    if (seen[start] || province.terrain !== 'ocean') continue;

    const component: number[] = [];
    let touchesEdge = false;
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      component.push(current);
      const currentProvince = provinces[current];
      if (!currentProvince) continue;
      if (isProvinceOnOuterBorder(currentProvince, borders)) {
        touchesEdge = true;
      }

      for (const neighborId of currentProvince.neighbors) {
        const neighbor = neighborId as unknown as number;
        const neighborProvince = provinces[neighbor];
        if (!neighborProvince || seen[neighbor] || neighborProvince.terrain !== 'ocean') {
          continue;
        }
        seen[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    if (!touchesEdge && component.length > maxInteriorWaterSize) {
      for (const id of component) {
        provinces[id].terrain = terrainBeforeMask[id] ?? 'plain';
      }
    }
  }
}

function isProvinceOnOuterBorder(province: Province, borders: BorderEdge[]): boolean {
  return province.borderEdgeIds.some((edgeId) => borders[edgeId]?.right == null);
}

function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function computeEdgeFalloff(x: number, y: number, bounds: MapBounds): number {
  const nx = (x / bounds.width) * 2 - 1;
  const ny = (y / bounds.height) * 2 - 1;
  const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
  return 1 - d * d;
}
