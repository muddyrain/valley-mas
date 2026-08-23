import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import {
  BiomeCode,
  CHUNK_SIZE,
  GroundMaterialCode,
  LandformCode,
  WORLD_SIZE,
} from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import { DRY_MAP_VISUAL_BUNDLE } from '../visual/DryMapVisualBundle';
import { createVisualCatalog } from '../visual/VisualCatalog';
import {
  compileP22AcceptanceScene,
  P22_ACCEPTANCE_CHUNKS,
  P22_ACCEPTANCE_WORLD,
} from './P22AcceptanceScene';

describe('P2-2 fixed dry-biome acceptance scenes', () => {
  it('locks deterministic savanna and desert coast slices', async () => {
    const snapshot = await generateWorldSnapshot(P22_ACCEPTANCE_WORLD);
    const catalog = await createVisualCatalog(DRY_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = DRY_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => DRY_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P2-2 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(P22_ACCEPTANCE_CHUNKS).toEqual({ savanna: 126, desert: 141 });
    const savanna = compileP22AcceptanceScene(snapshot, catalog, 'savanna');
    const desert = compileP22AcceptanceScene(snapshot, catalog, 'desert');

    expect([...savanna.biomes].filter((code) => code === BiomeCode.Savanna).length).toBeGreaterThan(
      2_000,
    );
    expect([...desert.biomes].filter((code) => code === BiomeCode.Desert).length).toBeGreaterThan(
      3_000,
    );
    expect([...savanna.landforms]).toContain(LandformCode.Coast);
    expect([...desert.landforms]).toContain(LandformCode.Coast);
    expect(
      materialCount(snapshot, P22_ACCEPTANCE_CHUNKS.savanna, GroundMaterialCode.BareSoil),
    ).toBeGreaterThan(2_000);
    expect(
      materialCount(snapshot, P22_ACCEPTANCE_CHUNKS.desert, GroundMaterialCode.Sand),
    ).toBeGreaterThan(3_000);
    expect([...savanna.biomeBridges].filter((band) => band > 0).length).toBeGreaterThan(40);
    expect([...desert.biomeBridges].filter((band) => band > 0).length).toBeGreaterThan(40);

    const savannaGroups = [...savanna.groupVisuals].filter(
      (handle) => handle !== 0xffff_ffff,
    ).length;
    const desertGroups = [...desert.groupVisuals].filter((handle) => handle !== 0xffff_ffff).length;
    expect(savannaGroups).toBeGreaterThan(8);
    expect(savannaGroups).toBeLessThan(45);
    expect(desertGroups).toBeGreaterThan(4);
    expect(desertGroups).toBeLessThan(35);
    expect(savanna.upright.visualHandles.length).toBeGreaterThan(20);
    expect(desert.upright.visualHandles.length).toBeGreaterThan(8);
    expect(
      surroundingFamilyCount(snapshot, P22_ACCEPTANCE_CHUNKS.desert, 'vegetation.cactus_succulent'),
    ).toBeGreaterThanOrEqual(2);
  });
});

function materialCount(
  snapshot: Awaited<ReturnType<typeof generateWorldSnapshot>>,
  chunk: number,
  material: number,
): number {
  const chunkX = (chunk % (WORLD_SIZE / CHUNK_SIZE)) * CHUNK_SIZE;
  const chunkY = Math.floor(chunk / (WORLD_SIZE / CHUNK_SIZE)) * CHUNK_SIZE;
  let count = 0;
  for (let y = chunkY; y < chunkY + CHUNK_SIZE; y += 1) {
    for (let x = chunkX; x < chunkX + CHUNK_SIZE; x += 1) {
      count += Number(snapshot.cells.groundMaterial[y * WORLD_SIZE + x] === material);
    }
  }
  return count;
}

function surroundingFamilyCount(
  snapshot: Awaited<ReturnType<typeof generateWorldSnapshot>>,
  centerChunk: number,
  familyId: string,
): number {
  const family = [
    ...WORLD_RULES_CATALOG.treeArchetypes,
    ...WORLD_RULES_CATALOG.decorationFamilies,
  ].find(({ id }) => id === familyId);
  if (family === undefined) return 0;
  const chunksPerAxis = WORLD_SIZE / CHUNK_SIZE;
  const centerX = centerChunk % chunksPerAxis;
  const centerY = Math.floor(centerChunk / chunksPerAxis);
  let count = 0;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const chunk = (centerY + offsetY) * chunksPerAxis + centerX + offsetX;
      const start = snapshot.objects.chunkOffsets[chunk] ?? 0;
      const end = snapshot.objects.chunkOffsets[chunk + 1] ?? start;
      for (let object = start; object < end; object += 1) {
        count += Number(snapshot.objects.semanticFamilyIds[object] === family.numericId);
      }
    }
  }
  return count;
}
