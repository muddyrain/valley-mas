import type { FactionId, RegionId, Tick } from '@/shared/types';

/**
 * 模拟器对外的运行状态机。Phase 5 仅 idle / running / victory / stalemate 四个终态，
 * 暂停由独立的 paused 字段表示，以便录像/逐帧调试时不丢失"还在 running"语义。
 */
export type SimStatus = 'idle' | 'running' | 'victory' | 'stalemate';

export type SimEventType =
  | 'capture'
  | 'repel'
  | 'eliminate'
  | 'victory'
  | 'stalemate'
  | 'revolt_warning';

/**
 * 单 tick 内核产出的语义事件。状态层会转成 LogEvent 写入日志面板。
 * 内核本身不感知日志面板，也不写 store。
 */
export interface SimEvent {
  tick: Tick;
  type: SimEventType;
  regionId: RegionId | null;
  attackerId: FactionId | null;
  defenderId: FactionId | null;
  message: string;
}

/**
 * 单 tick 内核产出的所有权变更补丁。状态层据此 clone 并写回 map。
 */
export interface SimPatch {
  regionId: RegionId;
  fromOwnerId: FactionId | null;
  toOwnerId: FactionId | null;
  tick: Tick;
}

export interface SimTickResult {
  patches: SimPatch[];
  events: SimEvent[];
}
