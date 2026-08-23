import { describe, expect, it } from 'vitest';
import { TEMPERATE_MAP_VISUAL_BUNDLE } from './TemperateMapVisualBundle';
import { createVisualCatalog } from './VisualCatalog';

describe('TemperateMapVisualBundle', () => {
  it('keeps the complete semantic contract while replacing the P1 atlas and palette', async () => {
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

    expect(catalog.version).toBe('p1-structure-1');
    expect(TEMPERATE_MAP_VISUAL_BUNDLE.manifest.assets).toHaveLength(551);
    expect(
      Object.values(TEMPERATE_MAP_VISUAL_BUNDLE.atlasSources).every((source) =>
        source.includes('/p1/'),
      ),
    ).toBe(true);
    expect(catalog.getPaletteColor('world.base', 'ground_grass')).toBe('#769B4D');
    expect(catalog.getPaletteColor('world.base', 'ground_woodland')).toBe('#416844');
    const temperateTrees = TEMPERATE_MAP_VISUAL_BUNDLE.manifest.assets.filter(({ tags }) =>
      tags.treeArchetypes.some(
        (id) => id.startsWith('tree.grassland.') || id.startsWith('tree.woodland.'),
      ),
    );
    expect(temperateTrees).toHaveLength(48);
    expect(new Set(temperateTrees.flatMap(({ tags }) => tags.treeArchetypes)).size).toBe(6);
    expect(
      TEMPERATE_MAP_VISUAL_BUNDLE.manifest.assets.filter(({ category }) => category === 'water'),
    ).toHaveLength(4);
    const vegetatedGround = TEMPERATE_MAP_VISUAL_BUNDLE.manifest.assets.filter(
      ({ category, tags }) =>
        category === 'terrain-ground' && tags.groundMaterials.includes('vegetated_soil'),
    );
    expect(vegetatedGround.some(({ tags }) => tags.biomes.includes('grassland'))).toBe(true);
    expect(vegetatedGround.some(({ tags }) => tags.biomes.includes('woodland'))).toBe(true);
    expect(
      vegetatedGround.every(
        ({ tags }) => !(tags.biomes.includes('grassland') && tags.biomes.includes('woodland')),
      ),
    ).toBe(true);
  });
});
