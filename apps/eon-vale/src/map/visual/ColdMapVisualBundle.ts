import { DRY_MAP_VISUAL_BUNDLE } from './DryMapVisualBundle';
import type { VisualBundleInput } from './VisualCatalog';
import type { VisualAsset, VisualManifest } from './VisualManifestSchema';

const previous = DRY_MAP_VISUAL_BUNDLE.manifest;
const basePalette = previous.palettes.find(({ id }) => id === 'world.base');
if (basePalette === undefined) throw new Error('P2-2 world palette is unavailable');

const coldAtlases: VisualManifest['atlases'] = [
  atlas('terrain-ground-cold-01', 'terrain-ground', 256),
  atlas('vegetation-cold-01', 'vegetation', 256),
  atlas('ground-decoration-cold-01', 'ground-decoration', 256),
];
const cursors = new Map<string, { x: number; y: number; rowHeight: number }>();
const coldFamilies = new Set([
  'ground_cover.grass_tuft',
  'ground_cover.moss_lichen',
  'vegetation.bush',
  'ground_cover.small_stone',
  'object.rock_cluster',
  'object.mineral_crystal',
  'object.deadwood_stump',
  'object.dead_tree',
  'ground_cover.coast_debris',
]);

const scopedAssets = previous.assets.map(scopeLegacyColdAsset);
const coldGroundAssets = [
  ...groundAssets('tundra', 'snow', 4, 4, 3),
  ...groundAssets('polar', 'ice', 4, 4, 3),
  ...groundAssets('tundra', 'rock', 3, 3, 2),
  ...groundAssets('polar', 'rock', 3, 3, 2),
];
const coldTreeAssets = previous.assets
  .filter(({ tags }) => tags.treeArchetypes.some((id) => id.startsWith('tree.tundra.')))
  .map((asset) =>
    cloneToAtlas(asset, 'vegetation-cold-01', asset.id.replace(/\.v01$/, '.cold.v01')),
  );
const coldDecorationAssets = [...coldFamilies].flatMap((family) => decorationVariants(family));

const manifest: VisualManifest = {
  ...previous,
  visualCatalogVersion: 'p2-cold-1',
  atlases: [
    ...previous.atlases.map((page) => ({ ...page, image: `map/p2-3/${page.id}.png` })),
    ...coldAtlases,
  ],
  palettes: [
    {
      ...basePalette,
      colors: {
        ...basePalette.colors,
        ground_tundra: '#879B8C',
        ground_polar: '#C5D8D2',
        coast_ice: '#DCE4D5',
        cold_highland: '#84918A',
        cold_mountain: '#596665',
        snow_shadow: '#718589',
        snow_mid: '#A9BCB6',
        snow_light: '#E1E8DA',
        ice_shadow: '#6E9BA5',
        ice_mid: '#A9CFD0',
        ice_light: '#E7EEE1',
        cold_rock: '#657473',
        cold_rock_shadow: '#435457',
        cold_lichen: '#9AAA6D',
      },
    },
  ],
  assets: [...scopedAssets, ...coldGroundAssets, ...coldTreeAssets, ...coldDecorationAssets],
};

export const COLD_MAP_VISUAL_BUNDLE = {
  manifest,
  atlasSources: Object.fromEntries(manifest.atlases.map(({ id }) => [id, `/map/p2-3/${id}.png`])),
} satisfies VisualBundleInput;

function scopeLegacyColdAsset(asset: VisualAsset): VisualAsset {
  const isColdGround =
    asset.category === 'terrain-ground' &&
    asset.tags.groundMaterials.some(
      (material) => material === 'snow' || material === 'ice' || material === 'rock',
    );
  const isColdTree = asset.tags.treeArchetypes.some((id) => id.startsWith('tree.tundra.'));
  const family = asset.tags.semanticFamilies[0];
  if (!isColdGround && !isColdTree && (family === undefined || !coldFamilies.has(family))) {
    return asset;
  }
  const remainingBiomes = asset.tags.biomes.filter(
    (biome) => biome !== 'tundra' && biome !== 'polar',
  );
  return {
    ...asset,
    tags: {
      ...asset.tags,
      biomes:
        remainingBiomes.length > 0
          ? remainingBiomes
          : ['grassland', 'woodland', 'rainforest', 'wetland', 'savanna', 'desert'],
    },
  };
}

function groundAssets(
  biome: 'tundra' | 'polar',
  material: 'snow' | 'ice' | 'rock',
  baseCount: number,
  groupCount: number,
  overlayCount: number,
): VisualAsset[] {
  return [
    ...groundRoleAssets(biome, material, 'base', baseCount),
    ...groundRoleAssets(biome, material, 'group', groupCount),
    ...groundRoleAssets(biome, material, 'overlay', overlayCount),
  ];
}

function groundRoleAssets(
  biome: 'tundra' | 'polar',
  material: 'snow' | 'ice' | 'rock',
  role: 'base' | 'group' | 'overlay',
  count: number,
): VisualAsset[] {
  const source = previous.assets.find(
    ({ category, tags }) =>
      category === 'terrain-ground' &&
      tags.groundMaterials.includes(material) &&
      tags.forms.includes(`material_${role}`),
  );
  if (source === undefined) throw new Error(`Missing ${material} ${role} source asset`);
  return Array.from({ length: count }, (_, index) => ({
    ...source,
    id: `terrain.ground.${material}.${biome}.${role}_${pad(index + 1)}.prototype.v01`,
    atlasPageId: 'terrain-ground-cold-01',
    frames: [
      place('terrain-ground-cold-01', source.sourceCanvas.width, source.sourceCanvas.height),
    ],
    tags: {
      ...source.tags,
      biomes: [biome],
      groundMaterials: [material],
      forms: [`material_${role}`],
    },
  }));
}

function decorationVariants(family: string): VisualAsset[] {
  const source = previous.assets.find(({ tags }) => tags.semanticFamilies.includes(family));
  if (source === undefined) throw new Error(`Missing cold decoration source asset: ${family}`);
  const pageId =
    source.category === 'vegetation' ? 'vegetation-cold-01' : 'ground-decoration-cold-01';
  return [1, 2, 3].map((variant) => ({
    ...source,
    id: source.id.replace(/\.v01$/, `.cold_${pad(variant)}.v01`),
    atlasPageId: pageId,
    frames: [place(pageId, source.sourceCanvas.width, source.sourceCanvas.height)],
    tags: {
      ...source.tags,
      biomes: coldBiomesForDecoration(family),
      forms: [...source.tags.forms, `silhouette_cold_${pad(variant)}`],
    },
  }));
}

function coldBiomesForDecoration(family: string): string[] {
  if (
    family === 'ground_cover.moss_lichen' ||
    family === 'ground_cover.small_stone' ||
    family === 'object.rock_cluster' ||
    family === 'object.mineral_crystal' ||
    family === 'ground_cover.coast_debris'
  ) {
    return ['tundra', 'polar'];
  }
  return ['tundra'];
}

function cloneToAtlas(asset: VisualAsset, atlasPageId: string, id: string): VisualAsset {
  return {
    ...asset,
    id,
    atlasPageId,
    frames: [place(atlasPageId, asset.sourceCanvas.width, asset.sourceCanvas.height)],
  };
}

function atlas(
  id: string,
  category: VisualManifest['atlases'][number]['category'],
  size: number,
): VisualManifest['atlases'][number] {
  return {
    id,
    category,
    image: `map/p2-3/${id}.png`,
    width: size,
    height: size,
    padding: 2,
    pixelScale: 1,
    sampling: 'nearest',
    mipmaps: false,
    compression: 'lossless',
  };
}

function place(atlasId: string, width: number, height: number): VisualAsset['frames'][number] {
  const page = coldAtlases.find(({ id }) => id === atlasId);
  if (page === undefined) throw new Error(`Unknown cold atlas: ${atlasId}`);
  const cursor = cursors.get(atlasId) ?? { x: 2, y: 2, rowHeight: 0 };
  if (cursor.x + width > page.width - 2) {
    cursor.x = 2;
    cursor.y += cursor.rowHeight + page.padding;
    cursor.rowHeight = 0;
  }
  if (cursor.y + height > page.height - 2) throw new Error(`Cold atlas is full: ${atlasId}`);
  const frame = { x: cursor.x, y: cursor.y, width, height };
  cursor.x += width + page.padding;
  cursor.rowHeight = Math.max(cursor.rowHeight, height);
  cursors.set(atlasId, cursor);
  return frame;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
