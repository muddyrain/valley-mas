import { describe, expect, it } from 'vitest';
import { createVisualCatalog } from './VisualCatalog';
import { WET_HOT_MAP_VISUAL_BUNDLE } from './WetHotMapVisualBundle';

describe('WetHotMapVisualBundle', () => {
  it('adds independent wet-hot art without weakening the semantic contract', async () => {
    const catalog = await createVisualCatalog(WET_HOT_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = WET_HOT_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => WET_HOT_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P2 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(catalog.version).toBe('p2-wet-hot-1');
    expect(WET_HOT_MAP_VISUAL_BUNDLE.manifest.assets).toHaveLength(551);
    expect(
      Object.values(WET_HOT_MAP_VISUAL_BUNDLE.atlasSources).every((source) =>
        source.includes('/p2/'),
      ),
    ).toBe(true);
    expect(catalog.getPaletteColor('world.base', 'ground_rainforest')).toBe('#2E6948');
    expect(catalog.getPaletteColor('world.base', 'ground_wetland')).toBe('#637B5C');

    const wetHotTrees = WET_HOT_MAP_VISUAL_BUNDLE.manifest.assets.filter(({ tags }) =>
      tags.treeArchetypes.some(
        (id) => id.startsWith('tree.rainforest.') || id.startsWith('tree.wetland.'),
      ),
    );
    expect(wetHotTrees).toHaveLength(56);
    expect(new Set(wetHotTrees.flatMap(({ tags }) => tags.treeArchetypes)).size).toBe(7);

    const vegetatedGround = WET_HOT_MAP_VISUAL_BUNDLE.manifest.assets.filter(
      ({ category, tags }) =>
        category === 'terrain-ground' && tags.groundMaterials.includes('vegetated_soil'),
    );
    for (const biome of ['rainforest', 'wetland']) {
      const candidates = vegetatedGround.filter(({ tags }) => tags.biomes.includes(biome));
      expect(candidates.some(({ tags }) => tags.forms.includes('material_base'))).toBe(true);
      expect(candidates.some(({ tags }) => tags.forms.includes('material_group'))).toBe(true);
      expect(candidates.some(({ tags }) => tags.forms.includes('material_overlay'))).toBe(true);
    }
  });
});
