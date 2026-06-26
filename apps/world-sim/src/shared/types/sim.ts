/**
 * 模拟时钟、速度档位与轻量平衡参数。Phase 1 仅供 UI、store 与 sim 内核引用。
 */

/** 时间单位配置：1 tick = 1 季，4 tick = 1 年 */
export const TICKS_PER_SEASON = 1;
export const SEASONS_PER_YEAR = 4;
export const TICKS_PER_YEAR = TICKS_PER_SEASON * SEASONS_PER_YEAR;

/** 平衡性参数：默认每 tick 扩张尝试次数 = clamp(存活势力数 × 16, 40, 100) */
export const EXPANSION_ATTEMPTS_MULTIPLIER = 16;
export const EXPANSION_ATTEMPTS_MIN = 40;
export const EXPANSION_ATTEMPTS_MAX = 100;

/** 战争目标偏好曲线：占领率推动战争频率从 15% 平滑升到 70% */
export const WAR_PREFERENCE_MIN = 0.15;
export const WAR_PREFERENCE_MAX = 0.7;
export const WAR_PREFERENCE_START_OCCUPIED = 0.35;
export const WAR_PREFERENCE_FULL_OCCUPIED = 0.92;

/** 终局加速曲线：占领率或存活势力收敛时，attempts 从 1x 平滑升到 2x */
export const SPEEDUP_START_OCCUPIED = 0.85;
export const SPEEDUP_FULL_OCCUPIED = 0.98;
export const SPEEDUP_LIVE_FACTIONS_START = 6;
export const SPEEDUP_LIVE_FACTIONS_FULL = 3;
export const SPEEDUP_MAX_MULTIPLIER = 2;

/** 反滚雪球曲线：最大势力占比越高，强弱修正越保守 */
export const STRENGTH_BIAS_SCALE_NORMAL = 0.65;
export const STRENGTH_BIAS_SCALE_DOMINANT = 0.4;
export const DOMINANT_SHARE_START = 0.35;
export const DOMINANT_SHARE_FULL = 0.65;

/** 残局清理压力：后期小国会更容易被吞并，避免几块地长期不死 */
export const SMALL_REALM_COLLAPSE_REGION_THRESHOLD = 12;
export const SMALL_REALM_COLLAPSE_START_OCCUPIED = 0.75;
export const SMALL_REALM_COLLAPSE_FULL_OCCUPIED = 0.95;
export const SMALL_REALM_COLLAPSE_MAX_BONUS = 0.12;

/** 季节名称，按 tick % 4 索引 */
export const SEASON_NAMES = ['春', '夏', '秋', '冬'] as const;

export type SimSpeedTier = 'paused' | '0.5x' | '1x' | '2x' | '4x' | '8x' | '16x';

export const SIM_SPEED_TIERS: SimSpeedTier[] = ['paused', '0.5x', '1x', '2x', '4x', '8x', '16x'];

export const SIM_SPEED_MULTIPLIER: Record<SimSpeedTier, number> = {
  paused: 0,
  '0.5x': 0.5,
  '1x': 1,
  '2x': 2,
  '4x': 4,
  '8x': 8,
  '16x': 16,
};

export type SimMode = 'live' | 'replay';

import type { Tick } from './ids';

/**
 * 将 tick 数格式化为游戏内时间显示。
 * 规则：1 tick = 1 季，4 tick = 1 年
 * 显示格式：「第 3 年 · 春」「第 12 年 · 秋」
 */
export function formatGameTime(tick: Tick): string {
  const t = Number(tick);
  const year = Math.floor(t / TICKS_PER_YEAR) + 1;
  const seasonIdx = Math.floor(t / TICKS_PER_SEASON) % SEASONS_PER_YEAR;
  const season = SEASON_NAMES[seasonIdx];
  return `第 ${year} 年 · ${season}`;
}
