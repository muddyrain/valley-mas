import type { FactionId, RegionId, SettlementId, Tick } from './ids';

export type SettlementTier = 'village' | 'town' | 'city' | 'capital';

/**
 * Phase 1 聚落快照。
 *
 * 当前已落地首都 + 自动村镇，用于把“势力 = 一团颜色”推进到“势力由核心聚落支撑”。
 * 后续行政距离、忠诚、围城和聚落成长都会复用这份结构。
 */
export interface SettlementSummary {
  id: SettlementId;
  factionId: FactionId;
  name: string;
  regionId: RegionId;
  tier: SettlementTier;
  population: number;
  development: number;
  influenceRadius: number;
  isCapital: boolean;
  foundedTick: Tick;
  loyalty: number;
  unrest: number;
  revoltProgress: number;
}
