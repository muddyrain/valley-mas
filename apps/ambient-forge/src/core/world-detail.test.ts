import { describe, expect, it } from 'vitest';
import {
  getResidentCameraOcclusion,
  getResidentDetailTier,
  getResidentVisualCadence,
  getWorldPopulationBudget,
  isResidentBlockingChaseCamera,
  stepResidentVisualAnimation,
} from './world-detail';

describe('world detail tiers', () => {
  it('固定主角始终使用英雄档，附近居民保持完整骨骼，远处逐步简化', () => {
    expect(getResidentDetailTier(120, { controlled: true, quality: 'low' })).toBe('hero');
    expect(getResidentDetailTier(18, { controlled: false, quality: 'high' })).toBe('near');
    expect(getResidentDetailTier(42, { controlled: false, quality: 'high' })).toBe('mid');
    expect(getResidentDetailTier(86, { controlled: false, quality: 'high' })).toBe('far');
  });

  it('只降低远处视觉更新频率，不降低近处碰撞和输入更新', () => {
    expect(getResidentVisualCadence('hero')).toBe(1);
    expect(getResidentVisualCadence('near')).toBe(1);
    expect(getResidentVisualCadence('mid')).toBe(2);
    expect(getResidentVisualCadence('far')).toBe(4);
  });

  it('非玩家居民进入相机极近距离时隐藏，并用更大的恢复阈值避免闪烁', () => {
    expect(getResidentCameraOcclusion(false, 0.72, false)).toBe(true);
    expect(getResidentCameraOcclusion(true, 1.08, false)).toBe(true);
    expect(getResidentCameraOcclusion(true, 1.5, false)).toBe(false);
    expect(getResidentCameraOcclusion(false, 0.2, true)).toBe(false);
    expect(getResidentCameraOcclusion(false, 2.8, false, true)).toBe(true);
    expect(isResidentBlockingChaseCamera([0, 4], [0, 0], [0.1, 2], false)).toBe(true);
    expect(isResidentBlockingChaseCamera([0, 4], [0, 0], [1.4, 2], false)).toBe(false);
  });

  it('远处骨骼降频时累计完整动画时间，不会每四帧只前进一帧后突然卡顿', () => {
    let accumulated = 0;
    const applied: number[] = [];
    for (let frame = 1; frame <= 8; frame += 1) {
      const step = stepResidentVisualAnimation(accumulated, 1 / 60, frame, 4, true);
      accumulated = step.accumulatedDelta;
      if (step.updateDelta > 0) applied.push(step.updateDelta);
    }

    expect(applied).toHaveLength(2);
    expect(applied[0]).toBeCloseTo(4 / 60, 5);
    expect(applied[1]).toBeCloseTo(4 / 60, 5);
    expect(applied.reduce((total, delta) => total + delta, 0)).toBeCloseTo(8 / 60, 5);
    expect(stepResidentVisualAnimation(0.08, 1 / 60, 9, 4, false)).toEqual({
      accumulatedDelta: 0,
      updateDelta: 0,
    });
  });

  it('高画质预算保留近处生活密度，并提供远处虚拟人口', () => {
    expect(getWorldPopulationBudget('high')).toMatchObject({
      activeResidents: 18,
      activeVehicles: 9,
      virtualResidents: 72,
      virtualVehicles: 26,
    });
    expect(getWorldPopulationBudget('low').virtualResidents).toBe(72);
    expect(getWorldPopulationBudget('low').activeResidents).toBeLessThan(18);
  });
});
