import type { FactionId, RegionId } from './ids';

/**
 * 势力快照。Phase 4 起作为 UI 展示与排行榜的真源数据；
 * 与版图的耦合通过 Province.ownerFactionId 维护，势力本身只持有元数据 + 出生地。
 */
export interface FactionSummary {
  id: FactionId;
  /** 势力名（如「蜀汉」「曹魏」），可由用户改名 */
  name: string;
  /** 君主/代表人物（默认池里取，可由用户后续填写） */
  leader: string;
  /** 旗帜主色（HSL → hex 表示） */
  colorHex: string;
  /** 出生地：地图随机分配；可重摇 */
  birthRegionId: RegionId | null;
  /**
   * Phase 8.5：当前首都所在州。新建时等于 birth；老家被吞后会自动迁到领土重心。
   * 标签与首都标记都钉在该州。
   */
  capitalRegionId: RegionId | null;
  /** Phase 8.5：当前势力所有领地的重心州（按几何 centroid 平均后取最近的 owned region） */
  centroidRegionId: RegionId | null;
  /** 当前控制区域数；由派生计算或势力创建时初始化 */
  regions: number;
  /** 当前总人口（占位值，后续 Phase 接入 sim 内核后再驱动） */
  population: number;
}
