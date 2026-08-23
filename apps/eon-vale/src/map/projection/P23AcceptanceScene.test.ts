import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import { BiomeCode, GroundMaterialCode, LandformCode } from '../model/WorldSnapshot';
import { COLD_MAP_VISUAL_BUNDLE } from '../visual/ColdMapVisualBundle';
import { createVisualCatalog } from '../visual/VisualCatalog';
import {
  compileP23AcceptanceScene,
  P23_ACCEPTANCE_CHUNKS,
  P23_ACCEPTANCE_WORLD,
} from './P23AcceptanceScene';

describe('P2-3 fixed cold-biome acceptance scenes', () => {
  it('locks tundra coast, polar ice coast, and a real cold ridge', async () => {
    const snapshot = await generateWorldSnapshot(P23_ACCEPTANCE_WORLD);
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

    expect(P23_ACCEPTANCE_CHUNKS).toEqual({ tundra: 36, polar: 21, coldElevation: 38 });
    const tundra = compileP23AcceptanceScene(snapshot, catalog, 'tundra');
    const polar = compileP23AcceptanceScene(snapshot, catalog, 'polar');
    const ridge = compileP23AcceptanceScene(snapshot, catalog, 'coldElevation');

    expect(count(tundra.biomes, BiomeCode.Tundra)).toBeGreaterThan(3_000);
    expect(count(tundra.landforms, LandformCode.Coast)).toBeGreaterThan(250);
    expect(count(polar.biomes, BiomeCode.Polar)).toBeGreaterThan(3_000);
    expect(count(polar.landforms, LandformCode.Coast)).toBeGreaterThan(300);
    expect(
      countMaterial(snapshot, P23_ACCEPTANCE_CHUNKS.tundra, GroundMaterialCode.Snow),
    ).toBeGreaterThan(1_500);
    expect(
      countMaterial(snapshot, P23_ACCEPTANCE_CHUNKS.polar, GroundMaterialCode.Ice),
    ).toBeGreaterThan(2_300);
    expect(
      [...ridge.landforms].filter((value) => value >= LandformCode.Highland).length,
    ).toBeGreaterThan(3_000);
    expect(count(ridge.biomes, BiomeCode.Tundra)).toBeGreaterThan(3_500);
    expect(
      [...tundra.groupVisuals].filter((handle) => handle !== 0xffff_ffff).length,
    ).toBeGreaterThan(2);
    expect(
      [...polar.groupVisuals].filter((handle) => handle !== 0xffff_ffff).length,
    ).toBeGreaterThan(2);
  });
});

function count(values: Uint8Array, target: number): number {
  return [...values].filter((value) => value === target).length;
}

function countMaterial(
  snapshot: Awaited<ReturnType<typeof generateWorldSnapshot>>,
  chunk: number,
  material: number,
): number {
  const chunkX = (chunk % 16) * 64;
  const chunkY = Math.floor(chunk / 16) * 64;
  let result = 0;
  for (let y = chunkY; y < chunkY + 64; y += 1) {
    for (let x = chunkX; x < chunkX + 64; x += 1) {
      result += Number(snapshot.cells.groundMaterial[y * 1024 + x] === material);
    }
  }
  return result;
}
