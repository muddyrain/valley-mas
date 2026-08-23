import type { VisualBundleInput } from './VisualCatalog';
import type { VisualAsset, VisualManifest } from './VisualManifestSchema';
import { WET_HOT_MAP_VISUAL_BUNDLE } from './WetHotMapVisualBundle';

const wetHotManifest = WET_HOT_MAP_VISUAL_BUNDLE.manifest;
const basePalette = wetHotManifest.palettes.find(({ id }) => id === 'world.base');

if (basePalette === undefined) throw new Error('Wet-hot world palette is unavailable');

const dryAtlases: VisualManifest['atlases'] = [
  atlas('terrain-ground-dry-01', 'terrain-ground', 256),
  atlas('vegetation-dry-01', 'vegetation', 128),
  atlas('ground-decoration-dry-01', 'ground-decoration', 128),
];
const dryDecorationFamilies = new Set([
  'ground_cover.grass_tuft',
  'vegetation.reed_high_grass',
  'vegetation.bush',
  'vegetation.cactus_succulent',
  'ground_cover.small_stone',
  'object.rock_cluster',
  'object.deadwood_stump',
  'object.dead_tree',
  'ground_cover.coast_debris',
]);
const cursors = new Map<string, { x: number; y: number; rowHeight: number }>();
const scopedAssets = wetHotManifest.assets.map(scopeLegacyDryAsset);
const dryGroundAssets = [
  ...groundAssets('savanna', 'bare_soil', 4, 4, 3),
  ...groundAssets('desert', 'sand', 4, 4, 3),
];
const dryDecorationAssets = [
  'ground_cover.grass_tuft',
  'vegetation.reed_high_grass',
  'vegetation.bush',
  'vegetation.cactus_succulent',
  'ground_cover.small_stone',
  'object.rock_cluster',
  'object.deadwood_stump',
  'object.dead_tree',
  'ground_cover.coast_debris',
].flatMap((family) => decorationVariants(family));

const manifest: VisualManifest = {
  ...wetHotManifest,
  visualCatalogVersion: 'p2-dry-2',
  atlases: [
    ...wetHotManifest.atlases.map((page) => ({
      ...page,
      image: `map/p2-2/${page.id}.png`,
    })),
    ...dryAtlases,
  ],
  palettes: [
    {
      ...basePalette,
      colors: {
        ...basePalette.colors,
        ground_savanna: '#A68E4D',
        ground_desert: '#C99A59',
        savanna_shadow: '#665B36',
        savanna_grass: '#9A9A4B',
        savanna_sun: '#D4B765',
        desert_shadow: '#8B653F',
        desert_sand: '#D5AA67',
        desert_light: '#E5C47E',
        dry_rock: '#735C45',
      },
    },
  ],
  assets: [...scopedAssets, ...dryGroundAssets, ...dryDecorationAssets],
};

export const DRY_MAP_VISUAL_BUNDLE = {
  manifest,
  atlasSources: Object.fromEntries(manifest.atlases.map(({ id }) => [id, `/map/p2-2/${id}.png`])),
} satisfies VisualBundleInput;

function scopeLegacyDryAsset(asset: VisualAsset): VisualAsset {
  if (
    asset.category === 'terrain-ground' &&
    (asset.tags.groundMaterials.includes('bare_soil') ||
      asset.tags.groundMaterials.includes('sand'))
  ) {
    return { ...asset, tags: { ...asset.tags, biomes: ['tundra', 'polar'] } };
  }
  const family = asset.tags.semanticFamilies[0];
  if (family === undefined) return asset;
  if (family === 'vegetation.cactus_succulent') {
    return {
      ...asset,
      tags: { ...asset.tags, forms: [...asset.tags.forms, 'silhouette_saguaro'] },
    };
  }
  if (!dryDecorationFamilies.has(family)) return asset;
  const previousBiomes = asset.tags.biomes.filter(
    (biome) => biome !== 'savanna' && biome !== 'desert',
  );
  return {
    ...asset,
    tags: {
      ...asset.tags,
      biomes:
        previousBiomes.length > 0
          ? previousBiomes
          : ['grassland', 'woodland', 'rainforest', 'wetland', 'tundra', 'polar'],
    },
  };
}

function groundAssets(
  biome: 'savanna' | 'desert',
  material: 'bare_soil' | 'sand',
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
  biome: 'savanna' | 'desert',
  material: 'bare_soil' | 'sand',
  role: 'base' | 'group' | 'overlay',
  count: number,
): VisualAsset[] {
  const source = wetHotManifest.assets.find(
    ({ category, tags }) =>
      category === 'terrain-ground' &&
      tags.groundMaterials.includes(material) &&
      tags.forms.includes(`material_${role}`),
  );
  if (source === undefined) throw new Error(`Missing ${material} ${role} source asset`);
  return Array.from({ length: count }, (_, index) => ({
    ...source,
    id: `terrain.ground.${material}.${biome}.${role}_${pad(index + 1)}.prototype.v01`,
    atlasPageId: 'terrain-ground-dry-01',
    frames: [place('terrain-ground-dry-01', source.sourceCanvas.width, source.sourceCanvas.height)],
    tags: {
      ...source.tags,
      biomes: [biome],
      groundMaterials: [material],
      forms: [`material_${role}`],
    },
  }));
}

function decorationVariants(family: string): VisualAsset[] {
  const source = wetHotManifest.assets.find(({ tags }) => tags.semanticFamilies.includes(family));
  if (source === undefined) throw new Error(`Missing decoration source asset: ${family}`);
  const pageId =
    source.category === 'vegetation' ? 'vegetation-dry-01' : 'ground-decoration-dry-01';
  const variants = family === 'vegetation.cactus_succulent' ? [2, 3] : [2, 3, 4];
  return variants.map((variant) => ({
    ...source,
    id: source.id.replace(/\.v01$/, `.v${pad(variant)}`),
    atlasPageId: pageId,
    frames: [place(pageId, source.sourceCanvas.width, source.sourceCanvas.height)],
    tags: {
      ...source.tags,
      biomes: dryBiomesForDecoration(family),
      forms: [...source.tags.forms, decorationSilhouette(family, variant)],
    },
  }));
}

function decorationSilhouette(family: string, variant: number): string {
  const silhouettes: Record<string, readonly string[]> = {
    'ground_cover.grass_tuft': ['fan', 'windswept', 'seeded_split'],
    'vegetation.reed_high_grass': ['seed_stalks', 'windswept', 'split_clump'],
    'vegetation.bush': ['compact_lobes', 'windswept', 'split_crown'],
    'vegetation.cactus_succulent': ['barrel_cluster', 'prickly_pear'],
    'ground_cover.small_stone': ['single_pebble', 'pebble_cluster', 'flat_slab'],
    'object.rock_cluster': ['boulder_cluster', 'weathered_spire', 'layered_outcrop'],
    'object.deadwood_stump': ['rooted_stump', 'broken_stump', 'forked_stump'],
    'object.dead_tree': ['forked_snag', 'windswept_snag', 'hollow_skeleton'],
    'ground_cover.coast_debris': ['driftwood', 'shell_scatter', 'reed_wash'],
  };
  const offset = family === 'vegetation.cactus_succulent' ? variant - 2 : variant - 2;
  return `silhouette_${silhouettes[family]?.[offset] ?? `variant_${variant}`}`;
}

function dryBiomesForDecoration(family: string): string[] {
  if (family === 'vegetation.cactus_succulent') return ['desert'];
  if (
    family === 'ground_cover.grass_tuft' ||
    family === 'vegetation.reed_high_grass' ||
    family === 'object.deadwood_stump'
  ) {
    return ['savanna'];
  }
  return ['savanna', 'desert'];
}

function atlas(
  id: string,
  category: VisualManifest['atlases'][number]['category'],
  size: number,
): VisualManifest['atlases'][number] {
  return {
    id,
    category,
    image: `map/p2-2/${id}.png`,
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
  const page = dryAtlases.find(({ id }) => id === atlasId);
  if (page === undefined) throw new Error(`Unknown dry atlas: ${atlasId}`);
  const cursor = cursors.get(atlasId) ?? { x: 2, y: 2, rowHeight: 0 };
  if (cursor.x + width > page.width - 2) {
    cursor.x = 2;
    cursor.y += cursor.rowHeight + page.padding;
    cursor.rowHeight = 0;
  }
  if (cursor.y + height > page.height - 2) throw new Error(`Dry atlas is full: ${atlasId}`);
  const frame = { x: cursor.x, y: cursor.y, width, height };
  cursor.x += width + page.padding;
  cursor.rowHeight = Math.max(cursor.rowHeight, height);
  cursors.set(atlasId, cursor);
  return frame;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
