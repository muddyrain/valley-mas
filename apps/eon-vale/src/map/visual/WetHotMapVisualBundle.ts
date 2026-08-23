import { TEMPERATE_MAP_VISUAL_BUNDLE } from './TemperateMapVisualBundle';
import type { VisualBundleInput } from './VisualCatalog';
import type { VisualAsset, VisualManifest } from './VisualManifestSchema';

const temperateManifest = TEMPERATE_MAP_VISUAL_BUNDLE.manifest;
const basePalette = temperateManifest.palettes.find(({ id }) => id === 'world.base');

if (basePalette === undefined) throw new Error('Temperate world palette is unavailable');

const manifest: VisualManifest = {
  ...temperateManifest,
  visualCatalogVersion: 'p2-wet-hot-1',
  atlases: temperateManifest.atlases.map((atlas) => ({
    ...atlas,
    image: `map/p2/${atlas.id}.png`,
  })),
  palettes: [
    {
      ...basePalette,
      colors: {
        ...basePalette.colors,
        ground_rainforest: '#2E6948',
        ground_wetland: '#637B5C',
        rainforest_shadow: '#173F35',
        rainforest_leaf: '#3E8150',
        rainforest_highlight: '#87AA58',
        wetland_shadow: '#405B50',
        wetland_mud: '#766E4E',
        wetland_reed: '#91A85C',
      },
    },
  ],
  assets: temperateManifest.assets.map(scopeWetHotGroundAsset),
};

function scopeWetHotGroundAsset(asset: VisualAsset): VisualAsset {
  if (
    asset.category !== 'terrain-ground' ||
    !asset.tags.groundMaterials.includes('vegetated_soil') ||
    !asset.tags.biomes.includes('rainforest')
  ) {
    return asset;
  }
  const variant = Number.parseInt(asset.id.match(/_(\d+)\.v01$/)?.[1] ?? '1', 10);
  const form = asset.tags.forms[0];
  const firstBand = form === 'material_base' ? 6 : 4;
  const wetHotVariant = variant - firstBand * 2;
  const unfinishedBiomes = ['savanna', 'desert', 'tundra', 'polar'];
  return {
    ...asset,
    tags: {
      ...asset.tags,
      biomes: [
        wetHotVariant <= Math.ceil(firstBand / 2) ? 'rainforest' : 'wetland',
        ...unfinishedBiomes,
      ],
    },
  };
}

export const WET_HOT_MAP_VISUAL_BUNDLE = {
  manifest,
  atlasSources: Object.fromEntries(
    manifest.atlases.map(({ id, image }) => [id, `/map/p2/${image.split('/').at(-1)}`]),
  ),
} satisfies VisualBundleInput;
