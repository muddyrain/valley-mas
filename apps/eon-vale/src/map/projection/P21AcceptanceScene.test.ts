import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import {
  BiomeCode,
  CHUNK_SIZE,
  GroundMaterialCode,
  LandformCode,
  WORLD_SIZE,
} from '../model/WorldSnapshot';
import { createVisualCatalog } from '../visual/VisualCatalog';
import { WET_HOT_MAP_VISUAL_BUNDLE } from '../visual/WetHotMapVisualBundle';
import {
  compileP21AcceptanceScene,
  P21_ACCEPTANCE_CHUNKS,
  P21_ACCEPTANCE_WORLD,
} from './P21AcceptanceScene';

describe('P2-1 fixed wet-hot acceptance scenes', () => {
  it('locks deterministic rainforest and wetland coast slices', async () => {
    const snapshot = await generateWorldSnapshot(P21_ACCEPTANCE_WORLD);
    const catalog = await createVisualCatalog(WET_HOT_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = WET_HOT_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => WET_HOT_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P2 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(P21_ACCEPTANCE_CHUNKS).toEqual({ rainforest: 147, wetland: 201 });
    const rainforest = compileP21AcceptanceScene(snapshot, catalog, 'rainforest');
    const wetland = compileP21AcceptanceScene(snapshot, catalog, 'wetland');
    expect(
      [...rainforest.biomes].filter((code) => code === BiomeCode.Rainforest).length,
    ).toBeGreaterThan(2_000);
    expect([...rainforest.landforms]).toContain(LandformCode.Coast);
    expect([...wetland.biomes].filter((code) => code === BiomeCode.Wetland).length).toBeGreaterThan(
      2_000,
    );
    const wetlandMaterials: number[] = [];
    for (let y = wetland.chunkY; y < wetland.chunkY + CHUNK_SIZE; y += 1) {
      for (let x = wetland.chunkX; x < wetland.chunkX + CHUNK_SIZE; x += 1) {
        wetlandMaterials.push(snapshot.cells.groundMaterial[y * WORLD_SIZE + x] ?? -1);
      }
    }
    expect(wetlandMaterials).toContain(GroundMaterialCode.Mud);
    expect([...wetland.landforms]).toContain(LandformCode.Coast);
    expect([...rainforest.biomeBridges].filter((band) => band > 0).length).toBeGreaterThan(40);
    expect([...wetland.biomeBridges].filter((band) => band > 0).length).toBeGreaterThan(40);
    expect([...rainforest.groupVisuals].some((handle) => handle !== 0xffff_ffff)).toBe(true);
    expect([...wetland.groupVisuals].some((handle) => handle !== 0xffff_ffff)).toBe(true);
    expect(rainforest.upright.visualHandles.length).toBeGreaterThan(30);
    expect(wetland.upright.visualHandles.length).toBeGreaterThan(30);
  });
});
