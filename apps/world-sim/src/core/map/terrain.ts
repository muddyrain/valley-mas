import { createNoise2D } from 'simplex-noise';
import { createPrngFromSeed } from '@/shared/math';
import type { BorderEdge, MapBounds, Province, TerrainKind } from './types';

/**
 * Phase 3 地形赋值。
 *
 * 流程：
 * 1. 用与地图同一个 seed 字符串派生出 4 个独立 PRNG（高度/湿度/河流走向/抖动），
 *    分别构造 simplex-noise 2D 噪声函数；同 seed 必产生同一组噪声。
 * 2. 在每个 Province 的 centroid 上做多倍频 fBm 采样，归一化到 [0,1] 得到 elevation/moisture。
 * 3. 用阈值把每个州分类为 plain / forest / mountain / desert。
 * 4. 河流：在“同时与左右两州存在”的内部 BorderEdge 中，挑高度差大且高度处于中段
 *    的若干条作为河谷线索，把这些线索两侧的州升级为 river。
 *
 * 给同一个 seed 字符串重复调用本函数，所有产物（terrain/elevation/moisture）必须完全一致。
 */
export interface TerrainAssignmentOptions {
  seed: string;
  bounds: MapBounds;
  /** elevation > mountainCutoff → mountain，默认 0.68 */
  mountainCutoff?: number;
  /** elevation < seaLevel 视为低地（用于增加平原/河流偏置），默认 0.30 */
  seaLevel?: number;
  /** 沙漠：低海拔且 moisture < desertMoistureMax，默认 0.32 */
  desertMoistureMax?: number;
  /** 森林：moisture > forestMoistureMin，默认 0.58 */
  forestMoistureMin?: number;
  /** 河流候选边占比上限，默认 0.06 */
  riverEdgeRatio?: number;
}

export function assignTerrains(
  provinces: Province[],
  borders: BorderEdge[],
  options: TerrainAssignmentOptions,
): void {
  const {
    seed,
    bounds,
    mountainCutoff = 0.68,
    seaLevel = 0.3,
    desertMoistureMax = 0.32,
    forestMoistureMin = 0.58,
    riverEdgeRatio = 0.06,
  } = options;

  // 用 seed 串派生 4 个独立 PRNG，互不串扰
  const elevRng = createPrngFromSeed(seed + ':elev');
  const moistRng = createPrngFromSeed(seed + ':moist');
  const warpRng = createPrngFromSeed(seed + ':warp');

  const elevNoise = createNoise2D(() => elevRng.next());
  const moistNoise = createNoise2D(() => moistRng.next());
  const warpNoise = createNoise2D(() => warpRng.next());

  // 把世界坐标投射到合适的频率域。基础尺度取地图较短边的 1/3。
  const baseScale = 1 / Math.max(1, Math.min(bounds.width, bounds.height) / 3);

  for (const province of provinces) {
    const cx = province.centroid.x;
    const cy = province.centroid.y;

    // 用 warp 噪声做 domain warp，避免明显的 simplex 网格痕迹
    const warpAmp = 0.18;
    const wx =
      cx + warpNoise(cx * baseScale * 1.7, cy * baseScale * 1.7) * warpAmp * (1 / baseScale);
    const wy =
      cy + warpNoise(cy * baseScale * 1.7, cx * baseScale * 1.7) * warpAmp * (1 / baseScale);

    const elevationRaw = fbm(elevNoise, wx * baseScale, wy * baseScale, 4, 2.05, 0.5);
    const moistureRaw = fbm(
      moistNoise,
      wx * baseScale * 1.3 + 521.31,
      wy * baseScale * 1.3 - 318.17,
      3,
      2.0,
      0.55,
    );

    // 边缘衰减：让靠近图框的格子海拔偏低，整体呈“岛屿/陆块”形状
    const edgeFalloff = computeEdgeFalloff(cx, cy, bounds);
    const elevation = clamp01(remap(elevationRaw) * 0.85 + 0.15 * (1 - edgeFalloff));
    const moisture = clamp01(remap(moistureRaw));

    province.elevation = elevation;
    province.moisture = moisture;
    province.terrain = classify(elevation, moisture, {
      mountainCutoff,
      seaLevel,
      desertMoistureMax,
      forestMoistureMin,
    });
  }

  carveRivers(provinces, borders, riverEdgeRatio, seaLevel);
}

/* ------------------------------------------------------------------ */
/* fBm 与分类                                                          */
/* ------------------------------------------------------------------ */

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

/** simplex 输出 [-1,1] → [0,1] */
function remap(v: number): number {
  return clamp01(v * 0.5 + 0.5);
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

interface ClassifyOpts {
  mountainCutoff: number;
  seaLevel: number;
  desertMoistureMax: number;
  forestMoistureMin: number;
}

function classify(elevation: number, moisture: number, opts: ClassifyOpts): TerrainKind {
  if (elevation >= opts.mountainCutoff) return 'mountain';
  if (elevation <= opts.seaLevel && moisture < opts.desertMoistureMax) return 'desert';
  if (moisture >= opts.forestMoistureMin) return 'forest';
  if (moisture < opts.desertMoistureMax) return 'desert';
  return 'plain';
}

function computeEdgeFalloff(x: number, y: number, bounds: MapBounds): number {
  // 越靠近矩形中心 → 越接近 1；越靠近边缘 → 越接近 0
  const nx = (x / bounds.width) * 2 - 1;
  const ny = (y / bounds.height) * 2 - 1;
  const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
  // 平滑过渡
  return 1 - d * d;
}

/* ------------------------------------------------------------------ */
/* 河流：基于内部 border 的高度差排序                                   */
/* ------------------------------------------------------------------ */

function carveRivers(
  provinces: Province[],
  borders: BorderEdge[],
  ratio: number,
  seaLevel: number,
): void {
  interface Candidate {
    leftId: number;
    rightId: number;
    score: number;
  }
  const candidates: Candidate[] = [];

  for (const edge of borders) {
    if (edge.right == null) continue;
    const leftId = edge.left as unknown as number;
    const rightId = edge.right as unknown as number;
    const a = provinces[leftId];
    const b = provinces[rightId];
    if (!a || !b) continue;
    if (a.terrain === 'mountain' && b.terrain === 'mountain') continue;
    if (a.terrain === 'ocean' || b.terrain === 'ocean') continue;

    const meanElev = (a.elevation + b.elevation) * 0.5;
    if (meanElev < seaLevel * 0.6) continue; // 太低（接近海平面）跳过
    if (meanElev > 0.8) continue; // 高山顶部不形成河谷
    const elevDiff = Math.abs(a.elevation - b.elevation);
    const moistAvg = (a.moisture + b.moisture) * 0.5;
    const score = elevDiff * 1.6 + moistAvg * 0.7 + (1 - Math.abs(meanElev - 0.45)) * 0.4;
    candidates.push({ leftId, rightId, score });
  }

  candidates.sort((p, q) => q.score - p.score);
  const limit = Math.max(0, Math.floor(borders.length * ratio));
  for (let i = 0; i < Math.min(limit, candidates.length); i++) {
    const { leftId, rightId } = candidates[i];
    const a = provinces[leftId];
    const b = provinces[rightId];
    // 河流升级：取两侧海拔较低的一方更优先变为河流，避免山脉上长河
    const lower = a.elevation <= b.elevation ? a : b;
    if (lower.terrain !== 'mountain') {
      lower.terrain = 'river';
    }
  }
}

/* ------------------------------------------------------------------ */
/* 颜色                                                                */
/* ------------------------------------------------------------------ */

/**
 * 地形 → Pixi 颜色十六进制；MapCanvas 渲染时直接读这里。
 * 值偏冷，整张图保持夜间地图的统一观感。
 */
export const TERRAIN_COLOR: Record<TerrainKind, number> = {
  plain: 0x6e8b54,
  forest: 0x2f5d3a,
  mountain: 0x7d6a5b,
  desert: 0xc9a86a,
  river: 0x3a76a8,
  ocean: 0x1a3a5c,
};

/** 用于 Sidebar / Legend 文字 */
export const TERRAIN_LABEL: Record<TerrainKind, string> = {
  plain: '平原',
  forest: '森林',
  mountain: '山脉',
  desert: '沙漠',
  river: '河流',
  ocean: '海洋',
};
