import { describe, expect, it } from 'vitest';

import { BUILT_IN_MAP_VISUAL_BUNDLE } from './BuiltInMapVisualBundle';
import { createVisualCatalog } from './VisualCatalog';

describe('BuiltInMapVisualBundle', () => {
  it('promotes the cumulative biome art into a semantic built-in bundle with dedicated world LOD clusters', async () => {
    const catalog = await createVisualCatalog(BUILT_IN_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = BUILT_IN_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => BUILT_IN_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown built-in atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(catalog.version).toBe('builtin-world-lod-1');
    expect(BUILT_IN_MAP_VISUAL_BUNDLE.atlasSources['lod-world-detailed-01']).toBe(
      '/map/builtin/lod-world-detailed-01.png',
    );
    const clusters = BUILT_IN_MAP_VISUAL_BUNDLE.manifest.assets.filter(
      ({ atlasPageId }) => atlasPageId === 'lod-world-detailed-01',
    );
    expect(clusters).toHaveLength(24);
    for (const biome of [
      'grassland',
      'woodland',
      'rainforest',
      'savanna',
      'desert',
      'wetland',
      'tundra',
      'polar',
    ]) {
      expect(clusters.filter(({ tags }) => tags.biomes.includes(biome))).toHaveLength(3);
    }

    const treeAssets = BUILT_IN_MAP_VISUAL_BUNDLE.manifest.assets.filter(
      ({ category, tags }) => category === 'vegetation' && tags.treeArchetypes.length > 0,
    );
    expect(treeAssets.length).toBeGreaterThan(100);
    expect(treeAssets.every(({ lodWorldId }) => lodWorldId?.includes('.cluster_'))).toBe(true);
    expect(catalog.getPaletteColor('world.lod', 'water_deep')).toBe('#244E73');
  });
});
