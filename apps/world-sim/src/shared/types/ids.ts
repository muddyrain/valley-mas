/**
 * 通用 ID 与品牌类型。Phase 1 仅占位，后续模拟内核会基于这些 ID 类型扩展。
 */

export type Brand<K, T> = K & { readonly __brand: T };

export type FactionId = Brand<number, 'FactionId'>;
export type RegionId = Brand<number, 'RegionId'>;
export type SettlementId = Brand<number, 'SettlementId'>;
export type WarId = Brand<number, 'WarId'>;
export type CityId = Brand<number, 'CityId'>;
export type ArmyId = Brand<number, 'ArmyId'>;
export type LeaderId = Brand<number, 'LeaderId'>;
export type EventId = Brand<number, 'EventId'>;
export type Tick = Brand<number, 'Tick'>;

export const asFactionId = (n: number): FactionId => n as FactionId;
export const asRegionId = (n: number): RegionId => n as RegionId;
export const asSettlementId = (n: number): SettlementId => n as SettlementId;
export const asWarId = (n: number): WarId => n as WarId;
export const asCityId = (n: number): CityId => n as CityId;
export const asArmyId = (n: number): ArmyId => n as ArmyId;
export const asLeaderId = (n: number): LeaderId => n as LeaderId;
export const asEventId = (n: number): EventId => n as EventId;
export const asTick = (n: number): Tick => n as Tick;
