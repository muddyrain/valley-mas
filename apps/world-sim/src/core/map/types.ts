import type { FactionId, RegionId } from '@/shared/types';

/**
 * 地形类型。5 种基础地形 + ocean（陆地掩膜外的不可通行区域）。
 */
export type TerrainKind = 'plain' | 'forest' | 'mountain' | 'desert' | 'river' | 'ocean';

export const TERRAIN_KINDS: TerrainKind[] = [
  'plain',
  'forest',
  'mountain',
  'desert',
  'river',
  'ocean',
];

/**
 * 单个州（Province / Voronoi Cell）。
 *
 * Phase 3 在 Phase 2 拓扑结构上增加 terrain 与采样得到的连续场，
 * 势力扩张仍保留在 Phase 4+。
 */
export interface Province {
  id: RegionId;
  /** Voronoi 站点坐标 */
  site: { x: number; y: number };
  /** Voronoi cell 多边形顶点（顺时针/逆时针由 d3-delaunay 决定） */
  polygon: Array<{ x: number; y: number }>;
  /** 邻接州 ID 列表（无主或地图外的邻居不会出现） */
  neighbors: RegionId[];
  /** 该州轮廓涉及的 BorderEdge 索引 */
  borderEdgeIds: number[];
  /** 用于快速命中/标签放置 */
  centroid: { x: number; y: number };
  /** 地形分类，Phase 3 起对每个州必赋值 */
  terrain: TerrainKind;
  /** 海拔，[0, 1]；高于 mountainCutoff 视为山脉 */
  elevation: number;
  /** 湿度，[0, 1]；与 elevation 共同决定森林/沙漠/平原 */
  moisture: number;
  /** 当前所属势力，Phase 3 仍为 null */
  ownerFactionId: FactionId | null;
}

/**
 * 一条边界线段。共享边只存一份，便于后续势力版图描边/外交矩阵。
 *
 * - 当 `right === null` 表示该边是地图外边界
 */
export interface BorderEdge {
  /** 起点 */
  a: { x: number; y: number };
  /** 终点 */
  b: { x: number; y: number };
  /** 边一侧的州 */
  left: RegionId;
  /** 边另一侧的州；地图外边界时为 null */
  right: RegionId | null;
}

export interface MapBounds {
  width: number;
  height: number;
}

export interface MapMeta {
  seed: string;
  /** 实际生成的州数 */
  provinceCount: number;
  /** 进行的 Lloyd 松弛次数 */
  relaxIterations: number;
  bounds: MapBounds;
}

export interface MapData {
  meta: MapMeta;
  provinces: Province[];
  borders: BorderEdge[];
}
