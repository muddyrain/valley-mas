import { describe, expect, it } from 'vitest';

import { parseVisualManifest, type VisualManifest } from './VisualManifestSchema';

describe('VisualManifestSchema', () => {
  it('accepts a replaceable terrain asset with explicit spatial and rendering metadata', () => {
    const manifest = parseVisualManifest(createManifest());

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.assets[0]?.id).toBe('terrain.grassland.vegetated_soil.base.v01');
  });

  it('rejects broken cross references and trimmed terrain tiles', () => {
    const candidate = createManifest();
    candidate.assets[0] = {
      ...candidate.assets[0],
      paletteId: 'missing.palette',
      trimmed: true,
      trimOffset: { x: 1, y: 0 },
    };

    expect(() => parseVisualManifest(candidate)).toThrow();
  });

  it('enforces atlas padding between independently addressable frames', () => {
    const candidate = createManifest();
    const first = candidate.assets[0];
    if (first === undefined) throw new Error('Expected the first visual asset');
    candidate.assets.push({
      ...first,
      id: 'terrain.grassland.vegetated_soil.base.v02',
      frames: [{ x: 7, y: 2, width: 4, height: 4 }],
    });

    expect(() => parseVisualManifest(candidate)).toThrow(/transparent padding/);
  });

  it('rejects unknown semantic, shadow, LOD, and animation references', () => {
    const candidate = createManifest();
    const first = candidate.assets[0];
    if (first === undefined) throw new Error('Expected the first visual asset');
    first.tags.biomes = ['missing_biome'];
    first.shadowMaskId = 'effects.shadow.missing.v01';
    first.lodWorldId = 'lod_world.terrain.missing.v01';
    first.animations = [{ stateId: 'ripple', frameIndices: [2], fps: 4, phase: 'seeded' as const }];

    expect(() => parseVisualManifest(candidate)).toThrow(/Unknown semantic id/);
    expect(() => parseVisualManifest(candidate)).toThrow(/Unknown asset/);
    expect(() => parseVisualManifest(candidate)).toThrow(/missing frame/);
  });

  it('requires explicit 47-topology metadata for terrain transitions', () => {
    const candidate = createManifest();
    const atlas = candidate.atlases[0];
    const asset = candidate.assets[0];
    if (atlas === undefined || asset === undefined) throw new Error('Expected a terrain fixture');
    atlas.category = 'terrain-transition';
    asset.id = 'terrain.transition.grassland.edge.v01';
    asset.category = 'terrain-transition';
    asset.renderLayer = 'terrain-transition';

    expect(() => parseVisualManifest(candidate)).toThrow(/47-topology/);
  });
});

function createManifest(): VisualManifest {
  return {
    schemaVersion: 1 as const,
    worldRulesCatalogVersion: 1 as const,
    visualCatalogVersion: 'p0-placeholder-1',
    atlases: [
      {
        id: 'terrain-ground-01',
        category: 'terrain-ground' as const,
        image: 'map/terrain-ground-01.png',
        width: 64,
        height: 64,
        padding: 2,
        pixelScale: 1 as const,
        sampling: 'nearest' as const,
        mipmaps: false as const,
        compression: 'lossless' as const,
      },
    ],
    palettes: [
      {
        id: 'world.base',
        colors: {
          shadow: '#25343A',
          midtone: '#66824F',
          highlight: '#94AD68',
        },
      },
    ],
    assets: [
      {
        id: 'terrain.grassland.vegetated_soil.base.v01',
        category: 'terrain-ground' as const,
        kind: 'tile' as const,
        atlasPageId: 'terrain-ground-01',
        frames: [{ x: 2, y: 2, width: 4, height: 4 }],
        sourceCanvas: { width: 4, height: 4 },
        trimmed: false,
        trimOffset: { x: 0, y: 0 },
        anchor: { x: 0, y: 0 },
        logicalFootprint: { widthCells: 1, heightCells: 1 },
        clearance: { leftCells: 0, rightCells: 0, topCells: 0, bottomCells: 0 },
        renderLayer: 'terrain-base' as const,
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
  };
}
