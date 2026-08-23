import { COLD_MAP_VISUAL_BUNDLE } from './ColdMapVisualBundle';
import type { VisualBundleInput } from './VisualCatalog';
import type { VisualAsset, VisualManifest } from './VisualManifestSchema';

const previous = COLD_MAP_VISUAL_BUNDLE.manifest;
const genericWorldTreeCandidate = previous.assets.find(
  ({ id }) => id === 'lod_world.vegetation.tree.generic.v01',
);
if (genericWorldTreeCandidate === undefined) {
  throw new Error('Generic world tree marker is unavailable');
}
const genericWorldTree: VisualAsset = genericWorldTreeCandidate as VisualAsset;

const WORLD_LOD_ATLAS_ID = 'lod-world-detailed-01';
const worldLodAtlas: VisualManifest['atlases'][number] = {
  id: WORLD_LOD_ATLAS_ID,
  category: 'lod-world',
  image: `map/builtin/${WORLD_LOD_ATLAS_ID}.png`,
  width: 128,
  height: 128,
  padding: 2,
  pixelScale: 1,
  sampling: 'nearest',
  mipmaps: false,
  compression: 'lossless',
};
const cursor = { x: 2, y: 2, rowHeight: 0 };
const worldBiomes = [
  'grassland',
  'woodland',
  'rainforest',
  'savanna',
  'desert',
  'wetland',
  'tundra',
  'polar',
] as const;

const worldLodAssets = worldBiomes.flatMap((biome) =>
  [1, 2, 3].map((variant) => worldVegetationAsset(biome, variant)),
);

const remappedAssets = previous.assets.map((asset) => {
  if (asset.category !== 'vegetation' || asset.tags.treeArchetypes.length === 0) return asset;
  const biome = asset.tags.biomes.find((value) => worldBiomes.includes(value as never));
  if (biome === undefined) return asset;
  const variant = (stableHash(asset.id) % 3) + 1;
  return {
    ...asset,
    lodWorldId: worldLodAssetId(biome, variant),
  };
});

const manifest: VisualManifest = {
  ...previous,
  visualCatalogVersion: 'builtin-world-lod-1',
  atlases: [...previous.atlases, worldLodAtlas],
  palettes: [
    ...previous.palettes,
    {
      id: 'world.lod',
      colors: {
        water_deep: '#244E73',
        water_mid: '#347FA8',
        water_light: '#65B5C2',
        coast_sand: '#D9CC7D',
        coast_ice: '#DCE4D5',
        ground_grass: '#78A653',
        ground_woodland: '#3F7048',
        ground_rainforest: '#237044',
        ground_savanna: '#A29A4F',
        ground_desert: '#C5A35A',
        ground_wetland: '#477C68',
        ground_tundra: '#879B8C',
        ground_polar: '#C5D8D2',
        highland: '#727C68',
        mountain: '#4C5758',
        cold_highland: '#84918A',
        cold_mountain: '#596665',
        corruption: '#5C3D63',
      },
    },
  ],
  assets: [...remappedAssets, ...worldLodAssets],
};

export const BUILT_IN_MAP_VISUAL_BUNDLE = {
  manifest,
  atlasSources: Object.fromEntries(
    manifest.atlases.map(({ id }) => [
      id,
      id === WORLD_LOD_ATLAS_ID ? `/map/builtin/${id}.png` : `/map/p2-3/${id}.png`,
    ]),
  ),
} satisfies VisualBundleInput;

function worldVegetationAsset(biome: (typeof worldBiomes)[number], variant: number): VisualAsset {
  return {
    ...genericWorldTree,
    id: worldLodAssetId(biome, variant),
    atlasPageId: WORLD_LOD_ATLAS_ID,
    frames: [place(4, 4)],
    paletteId: 'world.lod',
    colorway: biome,
    tags: {
      ...genericWorldTree.tags,
      biomes: [biome],
      forms: [`world_cluster.variant_${String(variant).padStart(2, '0')}`],
    },
  };
}

function worldLodAssetId(biome: string, variant: number): string {
  return `lod_world.vegetation.${biome}.cluster_${String(variant).padStart(2, '0')}.v01`;
}

function place(width: number, height: number): VisualAsset['frames'][number] {
  if (cursor.x + width > worldLodAtlas.width - 2) {
    cursor.x = 2;
    cursor.y += cursor.rowHeight + worldLodAtlas.padding;
    cursor.rowHeight = 0;
  }
  if (cursor.y + height > worldLodAtlas.height - 2) {
    throw new Error('Built-in world LOD atlas is full');
  }
  const frame = { x: cursor.x, y: cursor.y, width, height };
  cursor.x += width + worldLodAtlas.padding;
  cursor.rowHeight = Math.max(cursor.rowHeight, height);
  return frame;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}
