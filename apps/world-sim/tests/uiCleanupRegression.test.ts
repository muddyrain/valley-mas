/**
 * UI 清理回归测试。
 *
 * 验证移除 P0/P1 无用功能后，核心逻辑不受影响：
 * - 移除 Sidebar "模式"区域 → mode 状态仍存在且正常工作
 * - 移除 TopBar "+1 季"按钮 → advanceTick 函数仍存在且可调用
 * - 移除地图元信息（边界数/松弛轮次/地图尺寸）→ map.meta 数据完整
 *
 * 这些测试确保 UI 层的清理不会破坏底层状态或核心 API。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { generateMap } from '../src/core/map/generator';
import { useWorldSimStore } from '../src/state/store';

beforeEach(() => {
  // 每个测试前重置状态，避免单例 store 互相污染
  const store = useWorldSimStore.getState();
  store.setMode('idle');
  store.regenerateMap({ seed: 'test-init', provinceCount: 500 });
});

describe('UI cleanup regression', () => {
  it('mode 状态仍存在且可切换', () => {
    const store = useWorldSimStore.getState();
    expect(store.mode).toBe('idle');
    store.setMode('live');
    expect(useWorldSimStore.getState().mode).toBe('live');
    store.setMode('idle');
    expect(useWorldSimStore.getState().mode).toBe('idle');
  });

  it('advanceTick 函数仍可调用且能推进 tick', () => {
    const store = useWorldSimStore.getState();
    const initialTick = store.tick;
    store.advanceTick(1);
    expect(useWorldSimStore.getState().tick).toBeGreaterThan(initialTick);
  });

  it('map.meta 数据完整（边界数/松弛轮次/地图尺寸仍可访问）', () => {
    const map = generateMap({
      seed: 'test-regression-001',
      provinceCount: 500,
      bounds: { width: 1920, height: 1200 },
      relaxIterations: 2,
    });

    // 虽然 UI 不再显示这些元信息，但数据结构应完整
    expect(map.meta.relaxIterations).toBe(2);
    expect(map.meta.bounds.width).toBe(1920);
    expect(map.meta.bounds.height).toBe(1200);
    expect(map.meta.provinceCount).toBe(500);
    expect(map.borders.length).toBeGreaterThan(0);
  });

  it('地形统计仍可正确计算', () => {
    const map = generateMap({
      seed: 'test-terrain-count-001',
      provinceCount: 500,
      bounds: { width: 1920, height: 1200 },
      relaxIterations: 2,
    });

    const counts: Record<string, number> = {
      plain: 0,
      forest: 0,
      mountain: 0,
      desert: 0,
      river: 0,
      ocean: 0,
    };
    for (const province of map.provinces) {
      counts[province.terrain] += 1;
    }

    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    expect(total).toBe(500);
    // 陆地掩膜应产生一些海洋州
    expect(counts.ocean).toBeGreaterThan(0);
    // 应有平原
    expect(counts.plain).toBeGreaterThan(0);
  });

  it('地图生成后状态重置正确', () => {
    const store = useWorldSimStore.getState();
    // 生成新地图应重置 tick 和模拟状态
    store.regenerateMap({ seed: 'test-reset-001', provinceCount: 500 });
    const after = useWorldSimStore.getState();
    expect(after.tick).toBe(0);
    expect(after.status).toBe('idle');
    expect(after.paused).toBe(true);
    expect(after.map).not.toBeNull();
    expect(after.map?.meta.provinceCount).toBe(500);
  });

  it('地图模式切换正常工作', () => {
    const store = useWorldSimStore.getState();
    store.regenerateMap({ seed: 'test-mode-001', provinceCount: 500 });

    // 切换到三国地图模式
    store.setMapMode('three-kingdoms');
    const after = useWorldSimStore.getState();
    expect(after.mapMode).toBe('three-kingdoms');
    // 三国地图应使用更宽的画幅
    expect(after.map?.meta.bounds.width).toBe(2400);

    // 切换回随机模式
    store.setMapMode('random');
    expect(useWorldSimStore.getState().mapMode).toBe('random');
    expect(useWorldSimStore.getState().map?.meta.bounds.width).toBe(1920);
  });
});
