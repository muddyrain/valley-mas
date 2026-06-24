/**
 * 模拟时钟相关枚举与类型。Phase 1 仅供 UI 与 store 引用。
 */

export type SimSpeedTier = 'paused' | '0.5x' | '1x' | '2x' | '4x' | '8x';

export const SIM_SPEED_TIERS: SimSpeedTier[] = ['paused', '0.5x', '1x', '2x', '4x', '8x'];

export const SIM_SPEED_MULTIPLIER: Record<SimSpeedTier, number> = {
  paused: 0,
  '0.5x': 0.5,
  '1x': 1,
  '2x': 2,
  '4x': 4,
  '8x': 8,
};

export type SimMode = 'live' | 'replay';
