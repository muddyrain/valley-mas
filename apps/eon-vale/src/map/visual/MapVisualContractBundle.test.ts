import { describe, expect, it } from 'vitest';

import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import { MAP_VISUAL_CONTRACT_BUNDLE } from './MapVisualContractBundle';
import { createVisualCatalog } from './VisualCatalog';

describe('MapVisualContractBundle', () => {
  it('covers every atlas category, all 47x3 transitions, and every sparse object semantic', async () => {
    const manifest = MAP_VISUAL_CONTRACT_BUNDLE.manifest;
    const catalog = await createVisualCatalog(MAP_VISUAL_CONTRACT_BUNDLE, async (source) => {
      const atlas = manifest.atlases.find(
        ({ id }) => MAP_VISUAL_CONTRACT_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P0 atlas source: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(new Set(manifest.atlases.map(({ category }) => category)).size).toBe(8);
    expect(
      manifest.assets.filter(({ category }) => category === 'terrain-transition'),
    ).toHaveLength(47 * 3);
    for (const material of WORLD_RULES_CATALOG.groundMaterials) {
      const materialAssets = manifest.assets.filter(({ tags }) =>
        tags.groundMaterials.includes(material.id),
      );
      expect(
        materialAssets.filter(({ tags }) => tags.forms.includes('material_base')),
      ).toHaveLength(material.baseVariantMinimum);
      expect(
        materialAssets.filter(({ tags }) => tags.forms.includes('material_group')),
      ).toHaveLength(material.materialGroupMinimum);
      expect(
        materialAssets.filter(({ tags }) => tags.forms.includes('material_overlay')),
      ).toHaveLength(material.staticOverlayMinimum);
    }
    for (const family of WORLD_RULES_CATALOG.decorationFamilies) {
      expect(
        catalog.resolve({ category: categoryFor(family.id), semanticFamilyId: family.id }, 7),
      ).not.toBeNull();
    }
    for (const archetype of WORLD_RULES_CATALOG.treeArchetypes) {
      expect(
        catalog.resolve(
          {
            category: 'vegetation',
            semanticFamilyId: archetype.id,
            treeArchetypeId: archetype.id,
            age: 'old',
            height: 'tall',
          },
          11,
        ),
      ).not.toBeNull();
    }
    const transition = catalog.resolve(
      { category: 'terrain-transition', topologyCode: 13, edgeRhythm: 2 },
      99,
    );
    expect(
      transition === null ? null : catalog.getProjectionMetadata(transition).assetId,
    ).toContain('mask_13.rhythm_2');
  });
});

function categoryFor(semanticId: string) {
  if (semanticId.startsWith('ground_cover.')) return 'ground-decoration' as const;
  if (semanticId.startsWith('landmark.')) return 'landmark' as const;
  if (semanticId.startsWith('vegetation.')) return 'vegetation' as const;
  return semanticId === 'object.dead_tree'
    ? ('vegetation' as const)
    : ('ground-decoration' as const);
}
