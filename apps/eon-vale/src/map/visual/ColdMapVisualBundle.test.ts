import { describe, expect, it } from 'vitest';

import { COLD_MAP_VISUAL_BUNDLE } from './ColdMapVisualBundle';
import { createVisualCatalog } from './VisualCatalog';

describe('ColdMapVisualBundle', () => {
  it('adds contract-valid cold art without coupling semantic facts to atlas positions', async () => {
    const catalog = await createVisualCatalog(COLD_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = COLD_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => COLD_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P2-3 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(catalog.version).toBe('p2-cold-1');
    expect(COLD_MAP_VISUAL_BUNDLE.manifest.assets).toHaveLength(680);
    expect(
      Object.values(COLD_MAP_VISUAL_BUNDLE.atlasSources).every((path) => path.includes('/p2-3/')),
    ).toBe(true);
    expect(catalog.getPaletteColor('world.base', 'coast_ice')).toBe('#DCE4D5');
    expect(catalog.getPaletteColor('world.base', 'cold_mountain')).toBe('#596665');

    expectGround('tundra', 'snow', 4, 4, 3);
    expectGround('polar', 'ice', 4, 4, 3);
    expectGround('tundra', 'rock', 3, 3, 2);
    expectGround('polar', 'rock', 3, 3, 2);

    const trees = COLD_MAP_VISUAL_BUNDLE.manifest.assets
      .filter(({ atlasPageId }) => atlasPageId === 'vegetation-cold-01')
      .filter(({ tags }) => tags.treeArchetypes.some((id) => id.startsWith('tree.tundra.')));
    expect(trees).toHaveLength(16);
    for (const tree of trees) {
      expect(tree.sourceCanvas).toEqual({ width: 16, height: 24 });
      expect(tree.anchor).toEqual({ x: 8, y: 24 });
      expect(tree.logicalFootprint).toEqual({ widthCells: 1, heightCells: 1 });
    }
  });
});

function expectGround(
  biome: string,
  material: string,
  bases: number,
  groups: number,
  overlays: number,
): void {
  const candidates = COLD_MAP_VISUAL_BUNDLE.manifest.assets.filter(
    ({ atlasPageId, tags }) =>
      atlasPageId === 'terrain-ground-cold-01' &&
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
