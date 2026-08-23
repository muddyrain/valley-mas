import { describe, expect, it } from 'vitest';

import { DRY_MAP_VISUAL_BUNDLE } from './DryMapVisualBundle';
import { createVisualCatalog } from './VisualCatalog';

describe('DryMapVisualBundle', () => {
  it('adds independent dry-biome art without weakening earlier semantic coverage', async () => {
    const catalog = await createVisualCatalog(DRY_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = DRY_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => DRY_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P2-2 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(catalog.version).toBe('p2-dry-2');
    expect(DRY_MAP_VISUAL_BUNDLE.manifest.assets).toHaveLength(599);
    expect(
      Object.values(DRY_MAP_VISUAL_BUNDLE.atlasSources).every((source) =>
        source.includes('/p2-2/'),
      ),
    ).toBe(true);
    expect(catalog.getPaletteColor('world.base', 'ground_savanna')).toBe('#A68E4D');
    expect(catalog.getPaletteColor('world.base', 'ground_desert')).toBe('#C99A59');

    const dryTrees = DRY_MAP_VISUAL_BUNDLE.manifest.assets.filter(({ tags }) =>
      tags.treeArchetypes.some(
        (id) => id.startsWith('tree.savanna.') || id.startsWith('tree.desert.'),
      ),
    );
    expect(dryTrees).toHaveLength(32);
    expect(new Set(dryTrees.flatMap(({ tags }) => tags.treeArchetypes)).size).toBe(4);

    expectDryGround('savanna', 'bare_soil', 4, 4, 3);
    expectDryGround('desert', 'sand', 4, 4, 3);
    for (const family of [
      'ground_cover.grass_tuft',
      'vegetation.reed_high_grass',
      'vegetation.bush',
      'vegetation.cactus_succulent',
      'ground_cover.small_stone',
      'object.rock_cluster',
      'object.deadwood_stump',
      'object.dead_tree',
      'ground_cover.coast_debris',
    ]) {
      const variants = DRY_MAP_VISUAL_BUNDLE.manifest.assets.filter(
        ({ tags }) =>
          tags.semanticFamilies.includes(family) &&
          tags.biomes.some((biome) => biome === 'savanna' || biome === 'desert'),
      );
      expect(variants).toHaveLength(3);
      expect(
        new Set(
          variants.flatMap(({ tags }) =>
            tags.forms.filter((form) => form.startsWith('silhouette_')),
          ),
        ).size,
      ).toBe(3);
    }
  });
});

function expectDryGround(
  biome: string,
  material: string,
  bases: number,
  groups: number,
  overlays: number,
): void {
  const candidates = DRY_MAP_VISUAL_BUNDLE.manifest.assets.filter(
    ({ category, tags }) =>
      category === 'terrain-ground' &&
      tags.biomes.includes(biome) &&
      tags.groundMaterials.includes(material),
  );
  expect(candidates.filter(({ tags }) => tags.forms.includes('material_base'))).toHaveLength(bases);
  expect(candidates.filter(({ tags }) => tags.forms.includes('material_group'))).toHaveLength(
    groups,
  );
  expect(candidates.filter(({ tags }) => tags.forms.includes('material_overlay'))).toHaveLength(
    overlays,
  );
}
