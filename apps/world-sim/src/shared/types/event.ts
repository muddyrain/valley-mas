import type { EventId, FactionId, Tick } from './ids';

export type LogEventLevel = 'info' | 'warn' | 'battle' | 'diplomacy' | 'system';

/**
 * 业务级分类，用于 LogPanel 在前缀位显示语义标签：
 * - occupy: 占领
 * - lose:   失地（与 occupy 通常成对出现，从守方视角再写一条）
 * - eliminate: 灭国
 * - victory: 统一
 * - repel:  击退
 * - stalemate: 僵局
 * - misc:   其他（兜底）
 */
export type LogEventCategory =
  | 'occupy'
  | 'lose'
  | 'eliminate'
  | 'victory'
  | 'repel'
  | 'stalemate'
  | 'misc';

/**
 * 历史/事件流条目。Phase 6 后承担真实事件流：占领 / 失地 / 灭国 / 统一。
 */
export interface LogEvent {
  id: EventId;
  tick: Tick;
  level: LogEventLevel;
  category?: LogEventCategory;
  message: string;
  factionId?: FactionId;
}

export const LOG_CATEGORY_LABEL: Record<LogEventCategory, string> = {
  occupy: '占领',
  lose: '失地',
  eliminate: '灭国',
  victory: '统一',
  repel: '击退',
  stalemate: '僵局',
  misc: '事件',
};
