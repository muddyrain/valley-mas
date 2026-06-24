/**
 * Phase 10：GeoJSON 地图源目录。
 *
 * 这里只声明"有哪些预设地图、它们的元信息和数据 URL"，真正的 GeoJSON 数据由
 * loadGeoMap 在运行期 fetch；不把可能上百 KB 的 GeoJSON 打进 bundle，
 * 并允许用户自行替换 URL（比如换成本地 public/ 目录或 CDN）。
 *
 * 如果需要离线运行：把对应 GeoJSON 放到 apps/world-sim/public/geo/<id>.json，
 * Vite dev 会从根路径直接 serve，default URL 已指向 /geo/<id>.json。
 *
 * 数据来源建议：
 * - 中国省/地级市：阿里 DataV.GeoAtlas（datav.aliyun.com） 或本地缓存
 * - 世界国家：natural-earth-data 简化版（giscus / world-atlas 等公开镜像）
 * - 美国州：us-atlas（topojson 转 GeoJSON）
 */

export type GeoMapId = 'china-province' | 'china-city' | 'world-country' | 'us-state';

export interface GeoMapSource {
  id: GeoMapId;
  /** UI 显示名 */
  name: string;
  /** 简介 */
  description: string;
  /** GeoJSON URL（默认指向 public/geo/<id>.json，可在 UI 端被覆盖） */
  defaultUrl: string;
  /** 用作 region 名的 properties key */
  nameProperty: string;
  /** 推荐渲染框尺寸；不同地图横纵比差别大，分别给出 */
  bounds: { width: number; height: number };
}

export const GEO_MAP_REGISTRY: Record<GeoMapId, GeoMapSource> = {
  'china-province': {
    id: 'china-province',
    name: '中国省份',
    description: '34 个省级行政区（含港澳台）',
    defaultUrl: '/geo/china.json',
    nameProperty: 'name',
    bounds: { width: 1920, height: 1280 },
  },
  'china-city': {
    id: 'china-city',
    name: '中国地级市',
    description: '约 300+ 地级行政区',
    defaultUrl: '/geo/china-city.json',
    nameProperty: 'name',
    bounds: { width: 1920, height: 1280 },
  },
  'world-country': {
    id: 'world-country',
    name: '世界国家',
    description: '全球约 200 个国家',
    defaultUrl: '/geo/world-country.json',
    nameProperty: 'name',
    bounds: { width: 1920, height: 960 },
  },
  'us-state': {
    id: 'us-state',
    name: '美国州',
    description: '50 州 + DC',
    defaultUrl: '/geo/us-state.json',
    nameProperty: 'name',
    bounds: { width: 1920, height: 1200 },
  },
};

export const GEO_MAP_IDS: GeoMapId[] = [
  'china-province',
  'china-city',
  'world-country',
  'us-state',
];

export function getGeoMapSource(id: GeoMapId): GeoMapSource {
  const src = GEO_MAP_REGISTRY[id];
  if (!src) {
    throw new Error(`未知地图源：${id}`);
  }
  return src;
}

/** 把 GeoMapId 当 seed 用时的稳定后缀，确保同地图内噪声可复现 */
export function defaultSeedFor(id: GeoMapId): string {
  return `geo-${id}-001`;
}
