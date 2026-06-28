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
import { findProvinceAt } from '../src/core/map/queries';
import type { MapData, Province } from '../src/core/map/types';
import { WORLD_POLITY_PAIRS } from '../src/core/scenario/defaults';
import {
  asEventId,
  asFactionId,
  asRegionId,
  asSettlementId,
  asTick,
  asWarId,
} from '../src/shared/types';
import {
  computeDebugBalanceSummary,
  computeDiplomacyOverview,
  computeFactionWarSummary,
  computeReplayEventAnchors,
  computeReplayHistorySummary,
  computeSelectedSettlementDetail,
  computeWarListEntries,
} from '../src/state/selectors';
import { useWorldSimStore } from '../src/state/store';
import { createBorderLayerChunkTracker } from '../src/ui/canvas/borderRenderCache';
import { computeFactionLabelAnchors } from '../src/ui/canvas/labelLayout';
import {
  createOwnerLayerChunkTracker,
  createOwnerVisualSignatureTracker,
} from '../src/ui/canvas/ownerRenderCache';

beforeEach(() => {
  // 每个测试前重置状态，避免单例 store 互相污染
  const store = useWorldSimStore.getState();
  store.setMode('idle');
  store.setFrontPressureOverlayVisible(false);
  store.setAdminDistanceOverlayVisible(false);
  store.setWarStatusOverlayVisible(false);
  store.setSiegeProgressOverlayVisible(false);
  store.setStrategicValueOverlayVisible(false);
  store.setSettlementStabilityOverlayMode('none');
  store.setDivineTool('none');
  store.setDebugPanelVisible(false);
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

  it('真实推演会记录近期征服记忆，重置模拟会清空', () => {
    const store = useWorldSimStore.getState();

    store.advanceTick(8);
    const afterTicks = useWorldSimStore.getState();
    expect(afterTicks.recentConquests.size).toBeGreaterThan(0);
    expect(
      Array.from(afterTicks.recentConquests.values()).every((tick) => tick <= afterTicks.tick),
    ).toBe(true);

    afterTicks.resetSim();
    expect(useWorldSimStore.getState().recentConquests.size).toBe(0);
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

  it('province hit testing reuses a spatial index after the first lookup', () => {
    let siteReads = 0;
    const provinces = Array.from({ length: 400 }, (_, index) => {
      const x = (index % 20) * 10;
      const y = Math.floor(index / 20) * 10;
      const site = { x, y };
      const province = {
        id: asRegionId(index),
        polygon: [],
        neighbors: [],
        borderEdgeIds: [],
        centroid: site,
        terrain: 'plain',
        elevation: 0,
        moisture: 0,
        ownerFactionId: null,
      } as Province;
      Object.defineProperty(province, 'site', {
        get() {
          siteReads += 1;
          return site;
        },
      });
      return province;
    });
    const map = {
      meta: {
        seed: 'hit-index',
        provinceCount: provinces.length,
        relaxIterations: 0,
        bounds: { width: 200, height: 200 },
      },
      provinces,
      borders: [],
    } satisfies MapData;

    expect(findProvinceAt(map, 31, 42)).toBe(asRegionId(83));
    siteReads = 0;

    expect(findProvinceAt(map, 32, 43)).toBe(asRegionId(83));
    expect(siteReads).toBeLessThan(10);
  });

  it('owner visual cache stays clean when only non-visual faction stats change', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'A',
      leader: 'A',
      colorHex: '#ff0000',
      regions: 2,
      capitalRegionId: asRegionId(0),
      birthRegionId: asRegionId(0),
      centroidRegionId: asRegionId(0),
    };
    const factionB = {
      id: asFactionId(2),
      name: 'B',
      leader: 'B',
      colorHex: '#00ff00',
      regions: 1,
      capitalRegionId: asRegionId(2),
      birthRegionId: asRegionId(2),
      centroidRegionId: asRegionId(2),
    };
    const map = {
      meta: {
        seed: 'owner-cache',
        provinceCount: 3,
        relaxIterations: 0,
        bounds: { width: 30, height: 10 },
      },
      provinces: [
        createRenderProvince(0, asFactionId(1)),
        createRenderProvince(1, asFactionId(1)),
        createRenderProvince(2, asFactionId(2)),
      ],
      borders: [],
    } satisfies MapData;
    const tracker = createOwnerVisualSignatureTracker();

    expect(tracker.update(map, [factionA, factionB]).changed).toBe(true);
    expect(tracker.update(map, [{ ...factionA, regions: 9 }, factionB]).changed).toBe(false);

    map.provinces[1].ownerFactionId = asFactionId(2);
    expect(tracker.update(map, [factionA, factionB]).changed).toBe(true);
    expect(tracker.update(map, [factionA, { ...factionB, colorHex: '#0000ff' }]).changed).toBe(true);
  });

  it('owner chunk cache marks only chunks touched by ownership changes', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'A',
      leader: 'A',
      colorHex: '#ff0000',
      regions: 2,
      capitalRegionId: asRegionId(0),
      birthRegionId: asRegionId(0),
      centroidRegionId: asRegionId(0),
    };
    const factionB = {
      id: asFactionId(2),
      name: 'B',
      leader: 'B',
      colorHex: '#00ff00',
      regions: 2,
      capitalRegionId: asRegionId(2),
      birthRegionId: asRegionId(2),
      centroidRegionId: asRegionId(2),
    };
    const map = {
      meta: {
        seed: 'owner-chunks',
        provinceCount: 4,
        relaxIterations: 0,
        bounds: { width: 40, height: 10 },
      },
      provinces: [
        createRenderProvince(0, asFactionId(1)),
        createRenderProvince(1, asFactionId(1)),
        createRenderProvince(2, asFactionId(2)),
        createRenderProvince(3, asFactionId(2)),
      ],
      borders: [],
    } satisfies MapData;
    const tracker = createOwnerLayerChunkTracker({ chunkSize: 20 });

    expect(tracker.update(map, [factionA, factionB]).dirtyChunkIds).toEqual([0, 1]);
    expect(tracker.update(map, [{ ...factionA, regions: 9 }, factionB])).toMatchObject({
      changed: false,
      dirtyChunkIds: [],
      dirtyRegionIds: [],
    });
    expect(tracker.update(map, [{ ...factionA, name: 'A2' }, factionB])).toMatchObject({
      changed: true,
      dirtyChunkIds: [],
      dirtyRegionIds: [],
    });

    map.provinces[1].ownerFactionId = asFactionId(2);
    expect(tracker.update(map, [factionA, factionB])).toMatchObject({
      changed: true,
      dirtyChunkIds: [0],
      dirtyRegionIds: [1],
    });

    map.provinces[3].ownerFactionId = asFactionId(1);
    expect(tracker.update(map, [factionA, factionB])).toMatchObject({
      changed: true,
      dirtyChunkIds: [1],
      dirtyRegionIds: [3],
    });
  });

  it('border chunk cache marks only chunks touched by border visual changes', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'A',
      leader: 'A',
      colorHex: '#ff0000',
      regions: 2,
      capitalRegionId: asRegionId(0),
      birthRegionId: asRegionId(0),
      centroidRegionId: asRegionId(0),
    };
    const factionB = {
      id: asFactionId(2),
      name: 'B',
      leader: 'B',
      colorHex: '#00ff00',
      regions: 2,
      capitalRegionId: asRegionId(2),
      birthRegionId: asRegionId(2),
      centroidRegionId: asRegionId(2),
    };
    const map = {
      meta: {
        seed: 'border-chunks',
        provinceCount: 4,
        relaxIterations: 0,
        bounds: { width: 40, height: 10 },
      },
      provinces: [
        createRenderProvince(0, asFactionId(1)),
        createRenderProvince(1, asFactionId(1)),
        createRenderProvince(2, asFactionId(2)),
        createRenderProvince(3, asFactionId(2)),
      ],
      borders: [
        createRenderBorder(0, 0, 1),
        createRenderBorder(1, 1, 2),
        createRenderBorder(2, 2, 3),
      ],
    } satisfies MapData;
    const tracker = createBorderLayerChunkTracker({ chunkSize: 20 });

    expect(tracker.update(map, [factionA, factionB])).toMatchObject({
      changed: true,
      dirtyChunkIds: [0, 1],
      dirtyEdgeIds: [0, 1, 2],
    });
    expect(tracker.update(map, [{ ...factionA, regions: 9 }, factionB])).toMatchObject({
      changed: false,
      dirtyChunkIds: [],
      dirtyEdgeIds: [],
    });

    map.provinces[0].ownerFactionId = asFactionId(2);
    expect(tracker.update(map, [factionA, factionB])).toMatchObject({
      changed: true,
      dirtyChunkIds: [0],
      dirtyEdgeIds: [0],
    });

    map.provinces[3].ownerFactionId = asFactionId(1);
    expect(tracker.update(map, [factionA, factionB])).toMatchObject({
      changed: true,
      dirtyChunkIds: [1],
      dirtyEdgeIds: [2],
    });
  });

  it('faction label layout uses centroid and capital anchors without scanning every province', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'A',
      leader: 'A',
      colorHex: '#ff0000',
      regions: 2,
      capitalRegionId: asRegionId(0),
      birthRegionId: asRegionId(0),
      centroidRegionId: asRegionId(0),
    };
    const scanTrapProvince = createRenderProvince(1, asFactionId(1));
    Object.defineProperty(scanTrapProvince, 'ownerFactionId', {
      get() {
        throw new Error('label layout should not scan non-anchor provinces on the fast path');
      },
    });
    const map = {
      meta: {
        seed: 'label-fast-path',
        provinceCount: 2,
        relaxIterations: 0,
        bounds: { width: 20, height: 10 },
      },
      provinces: [createRenderProvince(0, asFactionId(1)), scanTrapProvince],
      borders: [],
    } satisfies MapData;

    expect(computeFactionLabelAnchors(map, [factionA])).toEqual([
      {
        factionId: asFactionId(1),
        labelX: 4,
        labelY: 4,
        capitalX: 4,
        capitalY: 4,
      },
    ]);
  });

  it('faction label layout falls back to an owned-province centroid when anchor data is missing', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'A',
      leader: 'A',
      colorHex: '#ff0000',
      regions: 2,
      capitalRegionId: asRegionId(0),
      birthRegionId: asRegionId(0),
      centroidRegionId: null,
    };
    const map = {
      meta: {
        seed: 'label-fallback',
        provinceCount: 3,
        relaxIterations: 0,
        bounds: { width: 30, height: 10 },
      },
      provinces: [
        createRenderProvince(0, asFactionId(1)),
        createRenderProvince(1, asFactionId(2)),
        createRenderProvince(2, asFactionId(1)),
      ],
      borders: [],
    } satisfies MapData;

    expect(computeFactionLabelAnchors(map, [factionA])).toEqual([
      {
        factionId: asFactionId(1),
        labelX: 14,
        labelY: 4,
        capitalX: 4,
        capitalY: 4,
      },
    ]);
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

  it('剧本选择会驱动地图形态切换', () => {
    const store = useWorldSimStore.getState();
    store.regenerateMap({ seed: 'test-mode-001', provinceCount: 500 });

    store.loadScenario('warlords');
    const after = useWorldSimStore.getState();
    expect(after.mapMode).toBe('three-kingdoms');
    expect(after.map?.meta.bounds.width).toBe(2400);
    expect(after.currentScenarioId).toBe('warlords');

    store.loadScenario('random');
    const randomAfter = useWorldSimStore.getState();
    expect(randomAfter.mapMode).toBe('random');
    expect(randomAfter.map?.meta.bounds.width).toBe(1920);
    expect(randomAfter.currentScenarioId).toBe('random');
  });

  it('国外政体剧本只生成国外政体势力', () => {
    const store = useWorldSimStore.getState();
    store.regenerateMap({ seed: 'test-foreign-polities-001', provinceCount: 500 });

    store.loadScenario('foreign-polities');
    const after = useWorldSimStore.getState();
    const foreignNames = new Set(WORLD_POLITY_PAIRS.map((pair) => pair.factionName));

    expect(after.currentScenarioId).toBe('foreign-polities');
    expect(after.factions.length).toBeGreaterThan(0);
    expect(after.factions.every((faction) => foreignNames.has(faction.name))).toBe(true);
  });

  it('Sidebar 只暴露三个剧本入口', () => {
    const scenarioIds = useWorldSimStore
      .getState()
      .listAvailableScenarios()
      .map((s) => s.id);

    expect(scenarioIds).toEqual(['random', 'warlords', 'foreign-polities']);
  });

  it('行政距离 overlay 状态可独立切换', () => {
    const store = useWorldSimStore.getState();

    expect(store.adminDistanceOverlayVisible).toBe(false);
    expect(store.frontPressureOverlayVisible).toBe(false);
    expect(store.warStatusOverlayVisible).toBe(false);

    store.toggleAdminDistanceOverlay();
    expect(useWorldSimStore.getState().adminDistanceOverlayVisible).toBe(true);
    expect(useWorldSimStore.getState().frontPressureOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().warStatusOverlayVisible).toBe(false);

    store.setAdminDistanceOverlayVisible(false);
    expect(useWorldSimStore.getState().adminDistanceOverlayVisible).toBe(false);
  });

  it('战争状态 overlay 状态可独立切换', () => {
    const store = useWorldSimStore.getState();

    expect(store.warStatusOverlayVisible).toBe(false);
    expect(store.frontPressureOverlayVisible).toBe(false);
    expect(store.adminDistanceOverlayVisible).toBe(false);

    store.toggleWarStatusOverlay();
    expect(useWorldSimStore.getState().warStatusOverlayVisible).toBe(true);
    expect(useWorldSimStore.getState().frontPressureOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().adminDistanceOverlayVisible).toBe(false);

    store.setWarStatusOverlayVisible(false);
    expect(useWorldSimStore.getState().warStatusOverlayVisible).toBe(false);
  });

  it('围城 overlay 状态可独立切换', () => {
    const store = useWorldSimStore.getState();

    expect(store.siegeProgressOverlayVisible).toBe(false);
    expect(store.frontPressureOverlayVisible).toBe(false);
    expect(store.adminDistanceOverlayVisible).toBe(false);
    expect(store.warStatusOverlayVisible).toBe(false);

    store.toggleSiegeProgressOverlay();
    expect(useWorldSimStore.getState().siegeProgressOverlayVisible).toBe(true);
    expect(useWorldSimStore.getState().frontPressureOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().adminDistanceOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().warStatusOverlayVisible).toBe(false);

    store.setSiegeProgressOverlayVisible(false);
    expect(useWorldSimStore.getState().siegeProgressOverlayVisible).toBe(false);
  });

  it('战略价值 overlay 状态可独立切换', () => {
    const store = useWorldSimStore.getState();

    expect(store.strategicValueOverlayVisible).toBe(false);
    expect(store.frontPressureOverlayVisible).toBe(false);
    expect(store.adminDistanceOverlayVisible).toBe(false);
    expect(store.warStatusOverlayVisible).toBe(false);
    expect(store.siegeProgressOverlayVisible).toBe(false);

    store.toggleStrategicValueOverlay();
    expect(useWorldSimStore.getState().strategicValueOverlayVisible).toBe(true);
    expect(useWorldSimStore.getState().frontPressureOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().adminDistanceOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().warStatusOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().siegeProgressOverlayVisible).toBe(false);

    store.setStrategicValueOverlayVisible(false);
    expect(useWorldSimStore.getState().strategicValueOverlayVisible).toBe(false);
  });

  it('聚落稳定 overlay 使用忠诚与动荡互斥模式', () => {
    const store = useWorldSimStore.getState();

    expect(store.settlementStabilityOverlayMode).toBe('none');
    expect(store.frontPressureOverlayVisible).toBe(false);
    expect(store.adminDistanceOverlayVisible).toBe(false);
    expect(store.warStatusOverlayVisible).toBe(false);
    expect(store.siegeProgressOverlayVisible).toBe(false);

    store.setSettlementStabilityOverlayMode('loyalty');
    expect(useWorldSimStore.getState().settlementStabilityOverlayMode).toBe('loyalty');

    store.setSettlementStabilityOverlayMode('unrest');
    expect(useWorldSimStore.getState().settlementStabilityOverlayMode).toBe('unrest');
    expect(useWorldSimStore.getState().frontPressureOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().adminDistanceOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().warStatusOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().siegeProgressOverlayVisible).toBe(false);

    store.toggleSettlementStabilityOverlay('unrest');
    expect(useWorldSimStore.getState().settlementStabilityOverlayMode).toBe('none');
  });

  it('神力工具状态可独立切换', () => {
    const store = useWorldSimStore.getState();

    expect(store.divineTool).toBe('none');
    expect(store.frontPressureOverlayVisible).toBe(false);
    expect(store.settlementStabilityOverlayMode).toBe('none');

    store.toggleDivineTool('bless-settlement');
    expect(useWorldSimStore.getState().divineTool).toBe('bless-settlement');
    expect(useWorldSimStore.getState().frontPressureOverlayVisible).toBe(false);
    expect(useWorldSimStore.getState().settlementStabilityOverlayMode).toBe('none');

    store.toggleDivineTool('curse-settlement');
    expect(useWorldSimStore.getState().divineTool).toBe('curse-settlement');

    store.toggleDivineTool('incite-revolt');
    expect(useWorldSimStore.getState().divineTool).toBe('incite-revolt');

    store.toggleDivineTool('pacify-unrest');
    expect(useWorldSimStore.getState().divineTool).toBe('pacify-unrest');

    store.toggleDivineTool('accelerate-civilization');
    expect(useWorldSimStore.getState().divineTool).toBe('accelerate-civilization');

    store.toggleDivineTool('strike-disaster');
    expect(useWorldSimStore.getState().divineTool).toBe('strike-disaster');

    store.toggleDivineTool('freeze-war');
    expect(useWorldSimStore.getState().divineTool).toBe('freeze-war');

    store.toggleDivineTool('terraform-region');
    expect(useWorldSimStore.getState().divineTool).toBe('terraform-region');

    store.setDivineTerrain('river');
    expect(useWorldSimStore.getState().divineTerrain).toBe('river');

    store.recordDivineFeedback(asRegionId(12), 'terraform-region');
    expect(useWorldSimStore.getState().divineFeedback).toMatchObject({
      regionId: asRegionId(12),
      tool: 'terraform-region',
      sequence: 1,
    });
    store.recordDivineFeedback(asRegionId(13), 'freeze-war');
    expect(useWorldSimStore.getState().divineFeedback).toMatchObject({
      regionId: asRegionId(13),
      tool: 'freeze-war',
      sequence: 2,
    });
    store.clearDivineFeedback();
    expect(useWorldSimStore.getState().divineFeedback).toBeNull();

    store.toggleDivineTool('freeze-war');
    expect(useWorldSimStore.getState().divineTool).toBe('freeze-war');

    store.toggleDivineTool('freeze-war');
    expect(useWorldSimStore.getState().divineTool).toBe('none');
  });

  it('Debug 面板默认隐藏并可切换', () => {
    const store = useWorldSimStore.getState();

    expect(store.debugPanelVisible).toBe(false);

    store.toggleDebugPanel();
    expect(useWorldSimStore.getState().debugPanelVisible).toBe(true);

    store.setDebugPanelVisible(false);
    expect(useWorldSimStore.getState().debugPanelVisible).toBe(false);
  });

  it('Debug 摘要聚合当前局势关键指标', () => {
    const factionA = {
      id: asFactionId(1),
      name: '甲国',
      leader: '甲君',
      colorHex: '#ffffff',
      birthRegionId: asRegionId(0),
      capitalRegionId: asRegionId(0),
      centroidRegionId: asRegionId(0),
      regions: 2,
      population: 0,
    };
    const factionB = {
      ...factionA,
      id: asFactionId(2),
      name: '乙国',
      leader: '乙君',
      birthRegionId: asRegionId(1),
      capitalRegionId: asRegionId(1),
      centroidRegionId: asRegionId(1),
      regions: 1,
    };
    const factionC = {
      ...factionA,
      id: asFactionId(3),
      name: '丙国',
      leader: '丙君',
      birthRegionId: asRegionId(2),
      capitalRegionId: asRegionId(2),
      centroidRegionId: asRegionId(2),
      regions: 0,
    };
    const province = {
      id: asRegionId(0),
      site: { x: 0, y: 0 },
      polygon: [],
      neighbors: [],
      borderEdgeIds: [],
      centroid: { x: 0, y: 0 },
      terrain: 'plain',
      elevation: 0.2,
      moisture: 0.5,
      ownerFactionId: factionA.id,
    } satisfies Province;
    const map = {
      meta: {
        seed: 'debug-summary',
        provinceCount: 4,
        relaxIterations: 0,
        bounds: { width: 100, height: 100 },
      },
      provinces: [
        province,
        { ...province, id: asRegionId(1), ownerFactionId: factionA.id },
        { ...province, id: asRegionId(2), ownerFactionId: factionB.id },
        { ...province, id: asRegionId(3), terrain: 'ocean', ownerFactionId: null },
      ],
      borders: [],
    } satisfies MapData;

    const summary = computeDebugBalanceSummary({
      map,
      factions: [factionA, factionB, factionC],
      wars: [
        {
          id: asWarId(1),
          kind: 'border',
          status: 'active',
          attackerFactionId: factionA.id,
          defenderFactionId: factionB.id,
          startedTick: asTick(1),
          lastContactTick: asTick(2),
        },
        {
          id: asWarId(2),
          kind: 'border',
          status: 'truce',
          attackerFactionId: factionB.id,
          defenderFactionId: factionC.id,
          startedTick: asTick(1),
          lastContactTick: asTick(2),
        },
      ],
      replayFrameCount: 7,
    });

    expect(summary).toEqual({
      provinceCount: 4,
      landCount: 3,
      occupiedCount: 3,
      occupiedRatio: 1,
      livingFactionCount: 2,
      largestFactionName: '甲国',
      largestShare: 2 / 3,
      activeWarCount: 1,
      truceCount: 1,
      replayFrameCount: 7,
    });
  });

  it('Replay event anchors only expose major history events with seek cursors', () => {
    const frames = [
      {
        tick: asTick(1),
        patches: [],
        events: [
          {
            id: asEventId(1),
            tick: asTick(1),
            level: 'battle',
            category: 'occupy',
            message: 'ordinary capture',
          },
        ],
        rankings: [],
        status: 'running',
        winnerFactionId: null,
      },
      {
        tick: asTick(2),
        patches: [],
        events: [
          {
            id: asEventId(2),
            tick: asTick(2),
            level: 'system',
            category: 'capital',
            message: 'capital fell',
          },
        ],
        rankings: [],
        status: 'running',
        winnerFactionId: null,
      },
      {
        tick: asTick(3),
        patches: [],
        events: [
          {
            id: asEventId(3),
            tick: asTick(3),
            level: 'system',
            category: 'divine',
            message: 'divine change',
          },
        ],
        rankings: [],
        status: 'running',
        winnerFactionId: null,
      },
    ];

    const anchors = computeReplayEventAnchors(frames, 1);

    expect(anchors).toEqual([
      expect.objectContaining({
        cursor: 3,
        tick: asTick(3),
        category: 'divine',
        level: 'system',
        message: 'divine change',
      }),
    ]);
  });

  it('Replay history summary exports key events and faction fates without full frames', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'Alpha',
      leader: 'A',
      colorHex: '#ff0000',
      birthRegionId: asRegionId(0),
      capitalRegionId: asRegionId(0),
      population: 100,
    };
    const factionB = {
      id: asFactionId(2),
      name: 'Beta',
      leader: 'B',
      colorHex: '#0000ff',
      birthRegionId: asRegionId(2),
      capitalRegionId: asRegionId(2),
      population: 100,
    };
    const frames = [
      {
        tick: asTick(1),
        patches: [{ regionId: 1, from: null, to: 1 }],
        events: [
          {
            id: asEventId(11),
            tick: asTick(1),
            level: 'battle',
            category: 'occupy',
            message: 'Alpha occupies neutral land',
          },
        ],
        rankings: [
          { factionId: 1, regions: 2 },
          { factionId: 2, regions: 1 },
        ],
        status: 'running',
        winnerFactionId: null,
      },
      {
        tick: asTick(2),
        patches: [{ regionId: 2, from: 2, to: 1 }],
        events: [
          {
            id: asEventId(12),
            tick: asTick(2),
            level: 'system',
            category: 'eliminate',
            message: 'Beta falls',
            factionId: factionB.id,
          },
        ],
        rankings: [
          { factionId: 1, regions: 3 },
          { factionId: 2, regions: 0 },
        ],
        status: 'victory',
        winnerFactionId: factionA.id,
      },
    ];

    const summary = computeReplayHistorySummary({
      meta: {
        seed: 'summary-test',
        provinceCount: 4,
        mapMode: 'random',
        scenarioId: 'random',
        totalTicks: frames.length,
      },
      initialOwnership: [factionA.id, null, factionB.id, null],
      initialFactions: [factionA, factionB],
      frames,
      keyEventLimit: 8,
    });

    expect(summary.version).toBe(1);
    expect(summary.keyEvents).toEqual([
      expect.objectContaining({
        cursor: 2,
        tick: asTick(2),
        category: 'eliminate',
        message: 'Beta falls',
      }),
    ]);
    expect(summary.eventCounts).toEqual([
      { category: 'eliminate', count: 1 },
      { category: 'occupy', count: 1 },
    ]);
    expect(summary.factionFates).toEqual([
      expect.objectContaining({
        factionId: factionA.id,
        name: 'Alpha',
        startRegions: 1,
        finalRegions: 3,
        eliminatedTick: null,
        survived: true,
        winner: true,
      }),
      expect.objectContaining({
        factionId: factionB.id,
        name: 'Beta',
        startRegions: 1,
        finalRegions: 0,
        eliminatedTick: asTick(2),
        survived: false,
        winner: false,
      }),
    ]);
    expect(summary.status).toBe('victory');
    expect(summary.winnerFactionId).toBe(factionA.id);
  });

  it('Replay summary JSON export omits full replay frames', () => {
    const factionA = {
      id: asFactionId(1),
      name: 'Alpha',
      leader: 'A',
      colorHex: '#ff0000',
      birthRegionId: asRegionId(0),
      capitalRegionId: asRegionId(0),
      population: 100,
    };
    const frames = [
      {
        tick: asTick(1),
        patches: [{ regionId: 1, from: null, to: 1 }],
        events: [
          {
            id: asEventId(21),
            tick: asTick(1),
            level: 'system',
            category: 'victory',
            message: 'Alpha wins',
            factionId: factionA.id,
          },
        ],
        rankings: [{ factionId: 1, regions: 2 }],
        status: 'victory',
        winnerFactionId: factionA.id,
      },
    ];

    useWorldSimStore.setState({
      initialOwnership: [factionA.id, null],
      initialFactions: [factionA],
      replayFrames: frames,
      baselineScenarioId: 'random',
    });

    const json = useWorldSimStore.getState().exportReplaySummaryToJson();
    const parsed = JSON.parse(json);

    expect(parsed.frames).toBeUndefined();
    expect(parsed.keyEvents).toEqual([
      expect.objectContaining({ category: 'victory', message: 'Alpha wins' }),
    ]);
    expect(parsed.factionFates).toEqual([
      expect.objectContaining({ name: 'Alpha', finalRegions: 2, winner: true }),
    ]);
  });

  it('势力战争摘要区分交战与停战', () => {
    const factionA = {
      id: asFactionId(1),
      name: '甲国',
      leader: '甲君',
      colorHex: '#ffffff',
      birthRegionId: null,
      capitalRegionId: null,
      centroidRegionId: null,
      regions: 1,
      population: 0,
    };
    const factionB = { ...factionA, id: asFactionId(2), name: '乙国', leader: '乙君' };
    const factionC = { ...factionA, id: asFactionId(3), name: '丙国', leader: '丙君' };

    const summary = computeFactionWarSummary({
      factionId: factionA.id,
      factions: [factionA, factionB, factionC],
      wars: [
        {
          id: asWarId(1),
          kind: 'revolt',
          status: 'active',
          attackerFactionId: factionA.id,
          defenderFactionId: factionB.id,
          startedTick: asTick(1),
          lastContactTick: asTick(2),
          siegeProgress: [
            {
              settlementId: asSettlementId(11),
              regionId: asRegionId(11),
              attackerFactionId: factionA.id,
              defenderFactionId: factionB.id,
              progress: 0.72,
              lastUpdatedTick: asTick(2),
            },
          ],
        },
        {
          id: asWarId(2),
          kind: 'revolt',
          status: 'truce',
          attackerFactionId: factionC.id,
          defenderFactionId: factionA.id,
          startedTick: asTick(1),
          lastContactTick: asTick(2),
          truceUntilTick: asTick(30),
          siegeProgress: [
            {
              settlementId: asSettlementId(12),
              regionId: asRegionId(12),
              attackerFactionId: factionC.id,
              defenderFactionId: factionA.id,
              progress: 0.95,
              lastUpdatedTick: asTick(2),
            },
          ],
        },
      ],
    });

    expect(summary).toMatchObject({
      status: 'active',
      activeCount: 1,
      truceCount: 1,
      activeOpponents: ['乙国'],
      truceOpponents: ['丙国'],
      siegeCount: 1,
      maxSiegeProgress: 0.72,
    });
  });

  it('战争列表按交战优先并显示疲劳和停战剩余', () => {
    const factionA = {
      id: asFactionId(1),
      name: '甲国',
      leader: '甲君',
      colorHex: '#ffffff',
      birthRegionId: null,
      capitalRegionId: null,
      centroidRegionId: null,
      regions: 1,
      population: 0,
    };
    const factionB = { ...factionA, id: asFactionId(2), name: '乙国', leader: '乙君' };
    const factionC = { ...factionA, id: asFactionId(3), name: '丙国', leader: '丙君' };

    const entries = computeWarListEntries({
      factions: [factionA, factionB, factionC],
      currentTick: asTick(20),
      wars: [
        {
          id: asWarId(2),
          kind: 'border',
          status: 'truce',
          attackerFactionId: factionC.id,
          defenderFactionId: factionA.id,
          startedTick: asTick(4),
          lastContactTick: asTick(8),
          truceUntilTick: asTick(35),
          fatigue: 1,
        },
        {
          id: asWarId(1),
          kind: 'revolt',
          status: 'active',
          attackerFactionId: factionA.id,
          defenderFactionId: factionB.id,
          startedTick: asTick(10),
          lastContactTick: asTick(18),
          fatigue: 0.42,
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        id: asWarId(1),
        status: 'active',
        attackerName: '甲国',
        defenderName: '乙国',
        elapsedTicks: 10,
        fatigue: 0.42,
        truceRemainingTicks: null,
      }),
      expect.objectContaining({
        id: asWarId(2),
        status: 'truce',
        attackerName: '丙国',
        defenderName: '甲国',
        elapsedTicks: 16,
        fatigue: 1,
        truceRemainingTicks: 15,
      }),
    ]);
  });

  it('外交概览按和平、边境战争、叛乱战争与停战统计关系', () => {
    const factionA = {
      id: asFactionId(1),
      name: '甲国',
      leader: '甲君',
      colorHex: '#ffffff',
      birthRegionId: null,
      capitalRegionId: null,
      centroidRegionId: null,
      regions: 8,
      population: 0,
    };
    const factionB = { ...factionA, id: asFactionId(2), name: '乙国', leader: '乙君' };
    const factionC = { ...factionA, id: asFactionId(3), name: '丙国', leader: '丙君' };
    const factionD = { ...factionA, id: asFactionId(4), name: '丁国', leader: '丁君' };

    const overview = computeDiplomacyOverview({
      factions: [factionA, factionB, factionC, factionD],
      wars: [
        {
          id: asWarId(1),
          kind: 'border',
          status: 'active',
          attackerFactionId: factionA.id,
          defenderFactionId: factionB.id,
          startedTick: asTick(2),
          lastContactTick: asTick(4),
        },
        {
          id: asWarId(2),
          kind: 'revolt',
          status: 'active',
          attackerFactionId: factionC.id,
          defenderFactionId: factionD.id,
          startedTick: asTick(3),
          lastContactTick: asTick(4),
        },
        {
          id: asWarId(3),
          kind: 'border',
          status: 'truce',
          attackerFactionId: factionA.id,
          defenderFactionId: factionC.id,
          startedTick: asTick(1),
          lastContactTick: asTick(3),
          truceUntilTick: asTick(30),
        },
      ],
    });

    expect(overview).toMatchObject({
      livingFactionCount: 4,
      pairCount: 6,
      peaceCount: 3,
      borderWarCount: 1,
      revoltWarCount: 1,
      truceCount: 1,
      activeWarCount: 2,
      status: 'war',
    });
  });

  it('选中聚落详情包含势力、稳定、新占与围城状态', () => {
    const factionA = {
      id: asFactionId(1),
      name: '甲国',
      leader: '甲君',
      colorHex: '#ffffff',
      birthRegionId: asRegionId(1),
      capitalRegionId: asRegionId(1),
      centroidRegionId: asRegionId(1),
      regions: 8,
      population: 1000,
    };
    const factionB = { ...factionA, id: asFactionId(2), name: '乙国', leader: '乙君' };
    const province = {
      id: asRegionId(11),
      site: { x: 10, y: 10 },
      polygon: [],
      neighbors: [],
      borderEdgeIds: [],
      centroid: { x: 10, y: 10 },
      terrain: 'plain',
      elevation: 0.2,
      moisture: 0.5,
      ownerFactionId: factionA.id,
    } satisfies Province;

    const detail = computeSelectedSettlementDetail({
      selectedRegionId: province.id,
      map: {
        meta: {
          seed: 'selected-settlement',
          provinceCount: 12,
          relaxIterations: 0,
          bounds: { width: 100, height: 100 },
        },
        provinces: Array.from({ length: 12 }, (_, index) =>
          index === 11 ? province : { ...province, id: asRegionId(index), ownerFactionId: null },
        ),
        borders: [],
      } satisfies MapData,
      factions: [factionA, factionB],
      settlements: [
        {
          id: asSettlementId(101),
          factionId: factionA.id,
          name: '甲国镇1',
          regionId: province.id,
          tier: 'town',
          population: 320,
          development: 0.62,
          influenceRadius: 4,
          isCapital: false,
          foundedTick: asTick(1),
          loyalty: 0.58,
          unrest: 0.31,
          revoltProgress: 0.27,
        },
      ],
      recentConquests: new Map([[province.id as unknown as number, asTick(8)]]),
      wars: [
        {
          id: asWarId(1),
          kind: 'border',
          status: 'active',
          attackerFactionId: factionB.id,
          defenderFactionId: factionA.id,
          startedTick: asTick(5),
          lastContactTick: asTick(10),
          siegeProgress: [
            {
              settlementId: asSettlementId(101),
              regionId: province.id,
              attackerFactionId: factionB.id,
              defenderFactionId: factionA.id,
              progress: 0.46,
              lastUpdatedTick: asTick(10),
            },
          ],
        },
      ],
      currentTick: asTick(12),
    });

    expect(detail).toMatchObject({
      regionId: province.id,
      settlementName: '甲国镇1',
      tier: 'town',
      ownerName: '甲国',
      terrain: 'plain',
      population: 320,
      development: 0.62,
      loyalty: 0.58,
      unrest: 0.31,
      revoltProgress: 0.27,
      recentlyConquered: true,
      conqueredTick: asTick(8),
      siege: {
        progress: 0.46,
        attackerName: '乙国',
        defenderName: '甲国',
      },
    });
  });
});

function createRenderProvince(
  id: number,
  ownerFactionId: ReturnType<typeof asFactionId> | null,
): Province {
  return {
    id: asRegionId(id),
    site: { x: id * 10, y: 0 },
    polygon: [
      { x: id * 10, y: 0 },
      { x: id * 10 + 8, y: 0 },
      { x: id * 10 + 8, y: 8 },
      { x: id * 10, y: 8 },
    ],
    neighbors: [],
    borderEdgeIds: [],
    centroid: { x: id * 10 + 4, y: 4 },
    terrain: 'plain',
    elevation: 0.2,
    moisture: 0.5,
    ownerFactionId,
  };
}

function createRenderBorder(id: number, left: number, right: number) {
  return {
    a: { x: id * 10 + 8, y: 0 },
    b: { x: id * 10 + 8, y: 8 },
    left: asRegionId(left),
    right: asRegionId(right),
  };
}
