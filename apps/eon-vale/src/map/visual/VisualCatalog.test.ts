import { describe, expect, it } from 'vitest';

import { createVisualCatalog } from './VisualCatalog';

describe('VisualCatalog', () => {
  it('validates decoded atlas pages and resolves a deterministic opaque visual handle', async () => {
    const catalog = await createVisualCatalog(createBundle(), async () => ({
      width: 16,
      height: 16,
      pixels: new Uint8ClampedArray(16 * 16 * 4),
    }));
    const query = {
      category: 'terrain-ground' as const,
      biomeId: 'grassland',
      groundMaterialId: 'vegetated_soil',
      environmentThemeId: 'none',
    };

    const first = catalog.resolve(query, 481516);
    const second = catalog.resolve(query, 481516);

    expect(first).toEqual(second);
    expect(first).not.toBeNull();
    expect(first === null ? null : catalog.getProjectionMetadata(first)).toMatchObject({
      assetId: 'terrain.grassland.vegetated_soil.base.v01',
      renderLayer: 'terrain-base',
      logicalFootprint: { widthCells: 1, heightCells: 1 },
    });
    expect(first === null ? null : catalog.getRenderMetadata(first)).toMatchObject({
      atlasSource: 'memory://terrain-ground-01.png',
      frames: [{ x: 2, y: 2, width: 4, height: 4 }],
      anchor: { x: 0, y: 0 },
    });
    expect(catalog.getPaletteColor('world.base', 'midtone')).toBe('#66824F');
  });
});

function createBundle() {
  return {
    manifest: {
      schemaVersion: 1,
      worldRulesCatalogVersion: 1,
      visualCatalogVersion: 'test-1',
      atlases: [
        {
          id: 'terrain-ground-01',
          category: 'terrain-ground',
          image: 'map/terrain-ground-01.png',
          width: 16,
          height: 16,
          padding: 2,
          pixelScale: 1,
          sampling: 'nearest',
          mipmaps: false,
          compression: 'lossless',
        },
      ],
      palettes: [
        {
          id: 'world.base',
          colors: { shadow: '#25343A', midtone: '#66824F', highlight: '#94AD68' },
        },
      ],
      assets: [
        {
          id: 'terrain.grassland.vegetated_soil.base.v01',
          category: 'terrain-ground',
          kind: 'tile',
          atlasPageId: 'terrain-ground-01',
          frames: [{ x: 2, y: 2, width: 4, height: 4 }],
          sourceCanvas: { width: 4, height: 4 },
          trimmed: false,
          trimOffset: { x: 0, y: 0 },
          anchor: { x: 0, y: 0 },
          logicalFootprint: { widthCells: 1, heightCells: 1 },
          clearance: { leftCells: 0, rightCells: 0, topCells: 0, bottomCells: 0 },
          renderLayer: 'terrain-base',
          sortBaselinePx: 4,
          maxOverflow: { leftPx: 0, rightPx: 0, topPx: 0, bottomPx: 0 },
          paletteId: 'world.base',
          colorway: 'base',
          variantWeight: 1,
          tags: {
            semanticFamilies: [],
            landforms: [],
            biomes: ['grassland'],
            groundMaterials: ['vegetated_soil'],
            environmentThemes: ['none'],
            treeArchetypes: [],
            ages: [],
            heights: [],
            forms: [],
          },
          animations: [],
        },
      ],
    },
    atlasSources: { 'terrain-ground-01': 'memory://terrain-ground-01.png' },
  };
}
