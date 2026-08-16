import { describe, expect, it } from 'vitest';
import { estimateRenderBatches, normalizedDisplayFps } from './performanceMetrics';

describe('runtime performance metrics', () => {
  it('normalizes minor 60 Hz scheduler drift without hiding a real frame-rate miss', () => {
    expect(normalizedDisplayFps(1_000 / 59)).toBe(60);
    expect(normalizedDisplayFps(1_000 / 60.8)).toBe(60);
    expect(normalizedDisplayFps(1_000 / 57.9)).toBe(57.9);
    expect(normalizedDisplayFps(1_000 / 45)).toBe(45);
  });

  it('keeps shared entity and building atlases in one batch as their frame caches grow', () => {
    const baseline = estimateRenderBatches({
      visibleTerrainChunks: 96,
      visibleEntities: 100,
      visibleBuildings: 20,
      treeCanopyVisible: true,
      territoryVisible: true,
      statusVisible: true,
      visibleLabels: 5,
    });
    const expanded = estimateRenderBatches({
      visibleTerrainChunks: 96,
      visibleEntities: 1_000,
      visibleBuildings: 200,
      treeCanopyVisible: true,
      territoryVisible: true,
      statusVisible: true,
      visibleLabels: 5,
    });

    expect(expanded).toBe(baseline);
    expect(expanded).toBe(12);
  });

  it('counts canvas terrain chunks as one compatible sprite batch', () => {
    const common = {
      visibleEntities: 0,
      visibleBuildings: 0,
      treeCanopyVisible: false,
      territoryVisible: false,
      statusVisible: false,
      visibleLabels: 0,
    };
    expect(estimateRenderBatches({ ...common, visibleTerrainChunks: 1 })).toBe(1);
    expect(estimateRenderBatches({ ...common, visibleTerrainChunks: 256 })).toBe(1);
  });
});
