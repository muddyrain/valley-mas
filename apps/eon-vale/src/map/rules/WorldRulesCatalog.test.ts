import { describe, expect, it } from 'vitest';

import {
  validateWorldRulesCatalog,
  WORLD_RULES_CATALOG,
  type WorldRulesCatalog,
} from './WorldRulesCatalog';

describe('WorldRulesCatalog', () => {
  it('contains the confirmed map vocabulary and remains structurally valid', () => {
    expect(WORLD_RULES_CATALOG.templates.map(({ id }) => id)).toEqual([
      'continent',
      'twin_continents',
      'archipelago',
      'island_chain',
      'inland_sea',
      'ring_continent',
      'fractured_coast',
      'tri_continents',
    ]);
    expect(WORLD_RULES_CATALOG.landforms).toHaveLength(7);
    expect(WORLD_RULES_CATALOG.biomes).toHaveLength(8);
    expect(WORLD_RULES_CATALOG.groundMaterials).toHaveLength(7);
    expect(WORLD_RULES_CATALOG.treeArchetypes).toHaveLength(19);
    expect(WORLD_RULES_CATALOG.decorationFamilies).toHaveLength(16);
    expect(WORLD_RULES_CATALOG.treeArchetypes.map(({ numericId }) => numericId)).toEqual(
      Array.from({ length: 19 }, (_, index) => index + 1),
    );
    expect(
      WORLD_RULES_CATALOG.biomes.find(({ id }) => id === 'rainforest')?.treeCanopyCoverage,
    ).toEqual({ min: 0.22, max: 0.34 });
    expect(
      WORLD_RULES_CATALOG.groundMaterials.find(({ id }) => id === 'vegetated_soil'),
    ).toMatchObject({
      baseVariantMinimum: 16,
      materialGroupMinimum: 12,
      staticOverlayMinimum: 12,
    });
    expect(
      [...WORLD_RULES_CATALOG.treeArchetypes, ...WORLD_RULES_CATALOG.decorationFamilies].map(
        ({ numericId }) => numericId,
      ),
    ).toEqual(Array.from({ length: 35 }, (_, index) => index + 1));
    expect(validateWorldRulesCatalog(WORLD_RULES_CATALOG)).toEqual([]);
  });

  it('rejects duplicate authority ids and unknown habitat references', () => {
    const first = WORLD_RULES_CATALOG.treeArchetypes[0];
    if (first === undefined) throw new Error('Expected the first tree archetype');
    const invalidCatalog: WorldRulesCatalog = {
      ...WORLD_RULES_CATALOG,
      treeArchetypes: [
        ...WORLD_RULES_CATALOG.treeArchetypes,
        {
          ...first,
          id: 'tree.grassland.archetype_99',
          habitatBiomeIds: ['missing_biome'],
        },
      ],
    };

    expect(validateWorldRulesCatalog(invalidCatalog)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'semanticFamilies.19.numericId' }),
        expect.objectContaining({ path: 'treeArchetypes.19.habitatBiomeIds' }),
      ]),
    );
  });
});
