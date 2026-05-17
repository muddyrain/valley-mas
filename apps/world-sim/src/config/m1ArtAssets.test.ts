import { describe, expect, it } from 'vitest';
import {
  getM1ArtAssetEntries,
  M1_BUILDING_ART_ASSETS,
  M1_RESOURCE_ART_ASSETS,
  M1_UNIT_ART_ASSETS,
} from './m1ArtAssets';

describe('m1ArtAssets', () => {
  it('defines texture assets for M1 visible resources, buildings and units', () => {
    expect(Object.keys(M1_RESOURCE_ART_ASSETS).sort()).toEqual(['food', 'iron']);
    expect(Object.keys(M1_BUILDING_ART_ASSETS).sort()).toEqual(['buildingSite', 'hut']);
    expect(Object.keys(M1_UNIT_ART_ASSETS).sort()).toEqual(['dwarf', 'elf', 'human', 'orc']);
    expect(
      Object.values(M1_UNIT_ART_ASSETS).every((assets) => 'female' in assets && 'male' in assets),
    ).toBe(true);
  });

  it('keeps texture keys unique and URLs explicit', () => {
    const entries = getM1ArtAssetEntries();
    const keys = entries.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(entries.every((entry) => entry.url.length > 0)).toBe(true);
    expect(entries.every((entry) => entry.loader === 'image')).toBe(true);
    expect(entries.every((entry) => entry.url.endsWith('.png'))).toBe(true);
  });
});
