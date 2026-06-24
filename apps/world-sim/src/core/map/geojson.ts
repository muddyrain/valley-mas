import { asRegionId, type RegionId } from '@/shared/types';
import { assignTerrains } from './terrain';
import type { BorderEdge, MapBounds, MapData, Province } from './types';

/**
 * Phase 10：从 GeoJSON FeatureCollection 构造 MapData。
 *
 * 流程：
 * 1. 解析 features：仅接受 Polygon / MultiPolygon。MultiPolygon 取面积最大的环作为主多边形，
 *    用于 Pixi 单 polygon 渲染管线（与 Phase 2 generator 输出对齐）。
 * 2. 计算所有顶点的经纬度包围盒，做 equirectangular 投影到目标 viewport（保纵横比，居中）。
 *    投影后纬度向下递增，与 Pixi 屏幕坐标一致。
 * 3. 通过 quantize 后的有向边 hash 推导邻接：同一条边出现在两个 feature 中即邻居，
 *    只出现一次即外边界（与 generator.buildBorders 同套思路）。
 * 4. 用与 random 地图相同的 simplex-noise 启发式给每个 region 赋地形（基于 centroid + seed），
 *    保证模拟逻辑（地形权重）无差别工作。
 *
 * 仅替换地图来源；不改 Province / BorderEdge / MapData 结构。
 */
export interface GeoJsonMapOptions {
  /** 用于派生地形噪声的 seed；同 seed 同 GeoJSON 必产生相同地形 */
  seed: string;
  /** 渲染目标尺寸；GeoJSON 投影会保纵横比缩放到该框内 */
  bounds: MapBounds;
  /** 用作 region 名（feature.properties[nameProperty]），可选 */
  nameProperty?: string;
  /** quantize 精度，默认 1e-3 → 把投影坐标四舍五入到千分位再做边 hash */
  quantizeDigits?: number;
}

interface GeoFeatureLike {
  type?: string;
  properties?: Record<string, unknown> | null;
  geometry?: GeoGeometryLike | null;
}

interface GeoGeometryLike {
  type: string;
  coordinates: unknown;
}

interface GeoJsonLike {
  type?: string;
  features?: GeoFeatureLike[];
}

export interface GeoJsonMapBuildResult {
  map: MapData;
  /** 每个 region 对应的 feature 名称（用于 inspector / 检视面板） */
  regionNames: string[];
  /** 被跳过的 feature 数量（geometry 非 Polygon/MultiPolygon 等） */
  skippedFeatureCount: number;
}

export function buildMapFromGeoJSON(
  raw: unknown,
  options: GeoJsonMapOptions,
): GeoJsonMapBuildResult {
  const { seed, bounds, nameProperty = 'name', quantizeDigits = 3 } = options;

  if (!isGeoJsonLike(raw)) {
    throw new Error('GeoJSON 解析失败：不是有效的 FeatureCollection');
  }
  const features = raw.features ?? [];
  if (features.length === 0) {
    throw new Error('GeoJSON 中没有 features');
  }

  // Step 1：抽取每个 feature 的代表性 outer ring（lon/lat）
  interface RawFeature {
    name: string;
    rings: Array<Array<[number, number]>>; // 主 polygon outer ring（取最大）；仍保留备用 rings
    primaryRing: Array<[number, number]>;
  }
  const rawFeatures: RawFeature[] = [];
  let skipped = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const geom = f?.geometry;
    if (!geom) {
      skipped++;
      continue;
    }
    const rings = extractOuterRings(geom);
    if (rings.length === 0) {
      skipped++;
      continue;
    }
    const primaryRing = pickLargestRing(rings);
    const props = f.properties ?? {};
    const nameRaw = props[nameProperty];
    const name = typeof nameRaw === 'string' ? nameRaw : `Region ${rawFeatures.length + 1}`;
    rawFeatures.push({ name, rings, primaryRing });
  }

  if (rawFeatures.length === 0) {
    throw new Error('GeoJSON 中没有可用的 Polygon/MultiPolygon feature');
  }

  // Step 2：经纬度包围盒 → equirectangular fit
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of rawFeatures) {
    for (const ring of f.rings) {
      for (const pt of ring) {
        const lon = pt[0];
        const lat = pt[1];
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat)
  ) {
    throw new Error('GeoJSON 坐标无效');
  }

  const lonSpan = Math.max(1e-9, maxLon - minLon);
  const latSpan = Math.max(1e-9, maxLat - minLat);
  // 缩放：保持原始纵横比；纬度方向直接展开（不用 mercator，避免高纬变形过大）
  const sx = bounds.width / lonSpan;
  const sy = bounds.height / latSpan;
  const scale = Math.min(sx, sy) * 0.96;
  const projWidth = lonSpan * scale;
  const projHeight = latSpan * scale;
  const offsetX = (bounds.width - projWidth) / 2;
  const offsetY = (bounds.height - projHeight) / 2;

  const project = (lon: number, lat: number): { x: number; y: number } => ({
    x: offsetX + (lon - minLon) * scale,
    // 纬度高 → 屏幕 y 小（北上南下）
    y: offsetY + (maxLat - lat) * scale,
  });

  // Step 3：投影所有 ring 顶点 + 同步抽取 border 候选
  const provinces: Province[] = new Array(rawFeatures.length);
  const regionNames: string[] = new Array(rawFeatures.length);
  // edgeKey -> { a, b, owners }
  const edgeMap = new Map<
    string,
    { a: { x: number; y: number }; b: { x: number; y: number }; owners: number[] }
  >();
  const neighborSets: Set<number>[] = rawFeatures.map(() => new Set<number>());

  const quant = 10 ** quantizeDigits;
  const keyOf = (ax: number, ay: number, bx: number, by: number): string => {
    const ka = `${Math.round(ax * quant)},${Math.round(ay * quant)}`;
    const kb = `${Math.round(bx * quant)},${Math.round(by * quant)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  for (let i = 0; i < rawFeatures.length; i++) {
    const rf = rawFeatures[i];
    const projectedPolygon = rf.primaryRing.map((pt) => project(pt[0], pt[1]));
    const polygon = stripClosingDuplicate(projectedPolygon);
    const centroid = polygonCentroid(polygon);
    const site = centroid;

    // 用所有 rings 参与边推导（让 MultiPolygon 的所有岛都贡献邻接）
    for (const ring of rf.rings) {
      const projRing = ring.map((pt) => project(pt[0], pt[1]));
      const ringNoClose = stripClosingDuplicate(projRing);
      const n = ringNoClose.length;
      if (n < 3) continue;
      for (let k = 0; k < n; k++) {
        const p0 = ringNoClose[k];
        const p1 = ringNoClose[(k + 1) % n];
        const key = keyOf(p0.x, p0.y, p1.x, p1.y);
        const existing = edgeMap.get(key);
        if (existing) {
          if (!existing.owners.includes(i)) existing.owners.push(i);
        } else {
          edgeMap.set(key, { a: { x: p0.x, y: p0.y }, b: { x: p1.x, y: p1.y }, owners: [i] });
        }
      }
    }

    provinces[i] = {
      id: asRegionId(i),
      site,
      polygon,
      neighbors: [],
      borderEdgeIds: [],
      centroid,
      terrain: 'plain',
      elevation: 0,
      moisture: 0,
      ownerFactionId: null,
    };
    regionNames[i] = rf.name;
  }

  // Step 4：根据 edgeMap 构造 borders & neighbors
  const borders: BorderEdge[] = [];
  for (const entry of edgeMap.values()) {
    const owners = entry.owners;
    if (owners.length === 0) continue;
    if (owners.length === 1) {
      borders.push({
        a: entry.a,
        b: entry.b,
        left: asRegionId(owners[0]),
        right: null,
      });
      continue;
    }
    // owners.length >= 2：取前两个作为 left/right；同一条边出现在 3+ feature 上极少见，
    // 通常是 MultiPolygon 内部岛屿/重复 ring，按前两者落入即可。
    const left = owners[0];
    const right = owners[1];
    borders.push({
      a: entry.a,
      b: entry.b,
      left: asRegionId(left),
      right: asRegionId(right),
    });
    neighborSets[left].add(right);
    neighborSets[right].add(left);
    // 若有 3+ owners：依旧把它们彼此连成邻居关系，让模拟扩张可达
    if (owners.length > 2) {
      for (let i = 0; i < owners.length; i++) {
        for (let j = i + 1; j < owners.length; j++) {
          neighborSets[owners[i]].add(owners[j]);
          neighborSets[owners[j]].add(owners[i]);
        }
      }
    }
  }

  for (let i = 0; i < provinces.length; i++) {
    const set = neighborSets[i];
    const arr: RegionId[] = [];
    for (const j of set) arr.push(asRegionId(j));
    provinces[i].neighbors = arr;
  }

  // 把 borderEdgeIds 反向挂回 provinces
  for (let edgeIdx = 0; edgeIdx < borders.length; edgeIdx++) {
    const edge = borders[edgeIdx];
    provinces[edge.left as unknown as number].borderEdgeIds.push(edgeIdx);
    if (edge.right != null) {
      provinces[edge.right as unknown as number].borderEdgeIds.push(edgeIdx);
    }
  }

  // Step 5：地形赋值（与 random 地图同一接口）
  assignTerrains(provinces, borders, { seed, bounds });

  return {
    map: {
      meta: {
        seed,
        provinceCount: provinces.length,
        relaxIterations: 0,
        bounds,
      },
      provinces,
      borders,
    },
    regionNames,
    skippedFeatureCount: skipped,
  };
}

/* ------------------------------------------------------------------ */
/* GeoJSON 几何抽取                                                    */
/* ------------------------------------------------------------------ */

function isGeoJsonLike(raw: unknown): raw is GeoJsonLike {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection') return false;
  return Array.isArray(obj.features);
}

/**
 * 从 Polygon / MultiPolygon 中抽出所有 outer ring（不包含 hole）。
 * 顶点为 [lon, lat] 元组数组。
 */
function extractOuterRings(geom: GeoGeometryLike): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  if (geom.type === 'Polygon') {
    const coords = geom.coordinates as unknown as number[][][];
    if (Array.isArray(coords) && coords.length > 0) {
      const ring = toLonLatRing(coords[0]);
      if (ring.length >= 3) out.push(ring);
    }
    return out;
  }
  if (geom.type === 'MultiPolygon') {
    const coords = geom.coordinates as unknown as number[][][][];
    if (Array.isArray(coords)) {
      for (const poly of coords) {
        if (Array.isArray(poly) && poly.length > 0) {
          const ring = toLonLatRing(poly[0]);
          if (ring.length >= 3) out.push(ring);
        }
      }
    }
    return out;
  }
  return out;
}

function toLonLatRing(raw: unknown): Array<[number, number]> {
  if (!Array.isArray(raw)) return [];
  const out: Array<[number, number]> = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lon = Number(pt[0]);
    const lat = Number(pt[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) out.push([lon, lat]);
  }
  return out;
}

function pickLargestRing(rings: Array<Array<[number, number]>>): Array<[number, number]> {
  if (rings.length === 1) return rings[0];
  let bestIdx = 0;
  let bestArea = -Infinity;
  for (let i = 0; i < rings.length; i++) {
    const a = Math.abs(signedRingArea(rings[i]));
    if (a > bestArea) {
      bestArea = a;
      bestIdx = i;
    }
  }
  return rings[bestIdx];
}

function signedRingArea(ring: Array<[number, number]>): number {
  let sum = 0;
  const n = ring.length;
  if (n < 3) return 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    sum += x0 * y1 - x1 * y0;
  }
  return sum * 0.5;
}

function stripClosingDuplicate(
  pts: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (pts.length === 0) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first.x === last.x && first.y === last.y) return pts.slice(0, pts.length - 1);
  return pts;
}

function polygonCentroid(polygon: Array<{ x: number; y: number }>): { x: number; y: number } {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumA = 0;
  for (let i = 0; i < n; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % n];
    const cross = p0.x * p1.y - p1.x * p0.y;
    sumA += cross;
    sumX += (p0.x + p1.x) * cross;
    sumY += (p0.y + p1.y) * cross;
  }
  if (sumA === 0) {
    let mx = 0;
    let my = 0;
    for (const p of polygon) {
      mx += p.x;
      my += p.y;
    }
    return { x: mx / n, y: my / n };
  }
  const a = sumA * 0.5;
  return { x: sumX / (6 * a), y: sumY / (6 * a) };
}
