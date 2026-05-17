import type { ResourceType } from '../world/testMap';

export type M1ArtAsset = {
  key: string;
  url: string;
  loader: 'image';
};

type M1UnitRace = 'human' | 'orc' | 'elf' | 'dwarf';
type M1UnitGender = 'male' | 'female';
export type M1VisibleResourceType = Extract<ResourceType, 'food' | 'iron'>;

const resourcePngAssetUrl = (name: string) =>
  new URL(`../../assets/m1/resources/${name}.png`, import.meta.url).href;
const buildingPngAssetUrl = (name: string) =>
  new URL(`../../assets/m1/buildings/${name}.png`, import.meta.url).href;
const unitPngAssetUrl = (name: string) =>
  new URL(`../../assets/m1/units/${name}.png`, import.meta.url).href;

const pngAsset = (key: string, url: string): M1ArtAsset => ({
  key,
  url,
  loader: 'image',
});

export const M1_RESOURCE_ART_ASSETS = {
  food: pngAsset('m1-resource-food', resourcePngAssetUrl('food')),
  iron: pngAsset('m1-resource-iron', resourcePngAssetUrl('iron')),
} as const satisfies Record<M1VisibleResourceType, M1ArtAsset>;

export const M1_BUILDING_ART_ASSETS = {
  hut: pngAsset('m1-building-hut', buildingPngAssetUrl('hut')),
  buildingSite: pngAsset('m1-building-site', buildingPngAssetUrl('building-site')),
} as const satisfies Record<string, M1ArtAsset>;

export const M1_UNIT_ART_ASSETS = {
  human: {
    male: pngAsset('m1-unit-human-male', unitPngAssetUrl('human-male')),
    female: pngAsset('m1-unit-human-female', unitPngAssetUrl('human-female')),
  },
  orc: {
    male: pngAsset('m1-unit-orc-male', unitPngAssetUrl('orc-male')),
    female: pngAsset('m1-unit-orc-female', unitPngAssetUrl('orc-female')),
  },
  elf: {
    male: pngAsset('m1-unit-elf-male', unitPngAssetUrl('elf-male')),
    female: pngAsset('m1-unit-elf-female', unitPngAssetUrl('elf-female')),
  },
  dwarf: {
    male: pngAsset('m1-unit-dwarf-male', unitPngAssetUrl('dwarf-male')),
    female: pngAsset('m1-unit-dwarf-female', unitPngAssetUrl('dwarf-female')),
  },
} as const satisfies Record<M1UnitRace, Record<M1UnitGender, M1ArtAsset>>;

export function getM1ArtAssetEntries() {
  return [
    ...Object.values(M1_RESOURCE_ART_ASSETS),
    ...Object.values(M1_BUILDING_ART_ASSETS),
    ...Object.values(M1_UNIT_ART_ASSETS).flatMap((assetsByGender) => Object.values(assetsByGender)),
  ];
}
