/**
 * 地图来源目录。
 *
 * - 'random'：Voronoi 随机生成 + 陆地掩膜（不规则海岸线）
 * - 'three-kingdoms'：三国地图模式，使用更大的地图框和特定的 seed 后缀
 */

export type MapModeId = 'random' | 'three-kingdoms';

export interface MapModeSource {
  id: MapModeId;
  /** UI 显示名 */
  name: string;
  /** 简介 */
  description: string;
  /** 推荐渲染框尺寸 */
  bounds: { width: number; height: number };
}

export const MAP_MODE_REGISTRY: Record<MapModeId, MapModeSource> = {
  random: {
    id: 'random',
    name: '随机生成',
    description: 'Voronoi + 陆地掩膜 · 不规则海岸线',
    bounds: { width: 1920, height: 1200 },
  },
  'three-kingdoms': {
    id: 'three-kingdoms',
    name: '三国地图',
    description: '宽幅地图 · 更适合三国剧本',
    bounds: { width: 2400, height: 1200 },
  },
};

export const MAP_MODE_IDS: MapModeId[] = ['random', 'three-kingdoms'];

export function getMapModeSource(id: MapModeId): MapModeSource {
  const src = MAP_MODE_REGISTRY[id];
  if (!src) {
    throw new Error(`未知地图模式：${id}`);
  }
  return src;
}

/** 把 MapModeId 当 seed 用时的稳定后缀，确保同模式内噪声可复现 */
export function defaultSeedSuffix(id: MapModeId): string {
  switch (id) {
    case 'three-kingdoms':
      return '-tk';
    default:
      return '';
  }
}
