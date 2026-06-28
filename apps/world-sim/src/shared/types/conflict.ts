import type { FactionId, RegionId, SettlementId, Tick, WarId } from './ids';

export type WarKind = 'revolt' | 'border';
export type WarStatus = 'active' | 'truce';

export interface WarSiegeProgress {
  settlementId: SettlementId;
  regionId: RegionId;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  progress: number;
  lastUpdatedTick: Tick;
}

export interface WarCapitalShock {
  factionId: FactionId;
  startedTick: Tick;
  untilTick: Tick;
}

export interface WarSummary {
  id: WarId;
  kind: WarKind;
  status: WarStatus;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  startedTick: Tick;
  lastContactTick: Tick;
  fatigue?: number;
  attackerStartRegions?: number;
  defenderStartRegions?: number;
  truceUntilTick?: Tick;
  winnerFactionId?: FactionId | null;
  sourceSettlementId?: SettlementId;
  siegeProgress?: WarSiegeProgress[];
  capitalShocks?: WarCapitalShock[];
}
