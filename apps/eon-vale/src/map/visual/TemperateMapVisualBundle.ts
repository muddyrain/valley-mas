import { MAP_VISUAL_CONTRACT_BUNDLE } from './MapVisualContractBundle';
import type { VisualBundleInput } from './VisualCatalog';
import type { VisualAsset, VisualManifest } from './VisualManifestSchema';

const contractManifest = MAP_VISUAL_CONTRACT_BUNDLE.manifest;
const basePalette = contractManifest.palettes.find(({ id }) => id === 'world.base');
const nonTemperateBiomes = ['rainforest', 'savanna', 'desert', 'wetland', 'tundra', 'polar'];

if (basePalette === undefined) throw new Error('Base world palette is unavailable');

const manifest: VisualManifest = {
  ...contractManifest,
  visualCatalogVersion: 'p1-structure-1',
  atlases: contractManifest.atlases.map((atlas) => ({
    ...atlas,
    image: `map/p1/${atlas.id}.png`,
  })),
  palettes: [
    {
      ...basePalette,
      colors: {
        ...basePalette.colors,
        darkest: '#18313A',
        shadow: '#29463E',
        neutral: '#66765D',
        midtone: '#719750',
        highlight: '#B6CB70',
        water_deep: '#1E4B6B',
        water_mid: '#2E7897',
        water_light: '#64B1B8',
        coast_sand: '#D8C77F',
        coast_highlight: '#F0DFA2',
        ground_grass: '#769B4D',
        ground_woodland: '#416844',
        grass_edge: '#9ABA69',
        woodland_edge: '#648A58',
        rock_highlight: '#A6AA91',
        rock_shadow: '#4B5148',
        corruption_ground: '#51485C',
        corruption_accent: '#85618D',
      },
    },
  ],
  assets: contractManifest.assets.map(scopeTemperateGroundAsset),
};

function scopeTemperateGroundAsset(asset: VisualAsset): VisualAsset {
  if (
    asset.category !== 'terrain-ground' ||
    !asset.tags.groundMaterials.includes('vegetated_soil')
  ) {
    return asset;
  }
  const form = asset.tags.forms[0];
  const variant = Number.parseInt(asset.id.match(/_(\d+)\.v01$/)?.[1] ?? '1', 10);
  const firstBand = form === 'material_base' ? 6 : 4;
  const biomes =
    variant <= firstBand
      ? ['grassland']
      : variant <= firstBand * 2
        ? ['woodland']
        : nonTemperateBiomes;
  return {
    ...asset,
    variantWeight: form === 'material_group' && variant % firstBand === 0 ? 0.28 : 1,
    tags: { ...asset.tags, biomes },
  };
}

export const TEMPERATE_MAP_VISUAL_BUNDLE = {
  manifest,
  atlasSources: Object.fromEntries(
    manifest.atlases.map(({ id, image }) => [id, `/map/p1/${image.split('/').at(-1)}`]),
  ),
} satisfies VisualBundleInput;
