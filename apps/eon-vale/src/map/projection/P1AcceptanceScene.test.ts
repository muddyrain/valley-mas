import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import { BiomeCode, LandformCode } from '../model/WorldSnapshot';
import { TEMPERATE_MAP_VISUAL_BUNDLE } from '../visual/TemperateMapVisualBundle';
import { createVisualCatalog } from '../visual/VisualCatalog';
import { NO_VISUAL_HANDLE } from './MapProjection';
import { compileP1TemperateCoastScene, P1_TEMPERATE_COAST_SCENE } from './P1AcceptanceScene';

describe('P1 temperate coast acceptance scene', () => {
  it('locks a populated grassland and woodland coast for cross-LOD review', async () => {
    const snapshot = await generateWorldSnapshot({
      templateId: P1_TEMPERATE_COAST_SCENE.templateId,
      seed: P1_TEMPERATE_COAST_SCENE.seed,
    });
    const catalog = await createVisualCatalog(TEMPERATE_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = TEMPERATE_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => TEMPERATE_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P1 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });
    const plan = compileP1TemperateCoastScene(snapshot, catalog);

    expect(plan.chunkX).toBe(P1_TEMPERATE_COAST_SCENE.chunkX);
    expect(plan.chunkY).toBe(P1_TEMPERATE_COAST_SCENE.chunkY);
    const biomes = new Set(plan.biomes);
    const landforms = new Set(plan.landforms);
    expect(biomes.has(BiomeCode.Grassland)).toBe(true);
    expect(biomes.has(BiomeCode.Woodland)).toBe(true);
    expect(landforms.has(LandformCode.ShallowWater)).toBe(true);
    expect(landforms.has(LandformCode.Coast)).toBe(true);
    const overlayCount = [...plan.overlayVisuals].filter(
      (handle) => handle !== NO_VISUAL_HANDLE,
    ).length;
    expect(overlayCount).toBeGreaterThan(30);
    expect(overlayCount).toBeLessThan(160);
    const materialGroupCount = [...plan.groupVisuals].filter(
      (handle) => handle !== NO_VISUAL_HANDLE,
    ).length;
    expect(materialGroupCount).toBeGreaterThan(10);
    expect(materialGroupCount).toBeLessThan(60);
    expect(new Set(plan.shoreBands).has(1)).toBe(true);
    expect(new Set(plan.shoreBands).has(3)).toBe(true);
    expect(plan.lowCover.visualHandles.length + plan.upright.visualHandles.length).toBeGreaterThan(
      30,
    );
  });
});
