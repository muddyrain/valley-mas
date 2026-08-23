import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import {
  BiomeCode,
  CHUNK_SIZE,
  CHUNKS_PER_AXIS,
  EnvironmentThemeCode,
  LandformCode,
  WORLD_SIZE,
} from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import { MAP_VISUAL_CONTRACT_BUNDLE } from '../visual/MapVisualContractBundle';
import { createVisualCatalog } from '../visual/VisualCatalog';
import {
  compileChunkPlan,
  compileRepresentativeChunk,
  compileWorldViewPlan,
  NO_VISUAL_HANDLE,
} from './MapProjection';

const FIXED_TEMPLATE = 'continent';
const FIXED_SEED = 0x1a2b3c4d;

describe('MapProjection', () => {
  it('compiles one deterministic visible P0 path from the fixed snapshot and visual catalog', async () => {
    const snapshot = await generateWorldSnapshot({ templateId: FIXED_TEMPLATE, seed: FIXED_SEED });
    const catalog = await createVisualCatalog(MAP_VISUAL_CONTRACT_BUNDLE, async (source) => {
      const atlas = MAP_VISUAL_CONTRACT_BUNDLE.manifest.atlases.find(
        ({ id }) => MAP_VISUAL_CONTRACT_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    const world = compileWorldViewPlan(snapshot, catalog);
    const chunk = compileRepresentativeChunk(snapshot, catalog);
    const populatedChunkIndex = snapshot.objects.chunkOffsets.findIndex(
      (offset, index, offsets) =>
        index < offsets.length - 1 &&
        (offsets[index + 1] ?? offset) > offset &&
        chunkMatchCount(snapshot.cells.landform, index, (value) => value === LandformCode.Lowland) >
          1_024,
    );
    const populatedChunk = compileChunkPlan(snapshot, catalog, populatedChunkIndex);

    expect(world.width).toBe(1024);
    expect(world.height).toBe(1024);
    expect(world.rgba).toHaveLength(1024 * 1024 * 4);
    const treeFamilyIds = new Set(
      WORLD_RULES_CATALOG.treeArchetypes.map(({ numericId }) => numericId),
    );
    const treeObjectCount = [...snapshot.objects.semanticFamilyIds].filter((numericId) =>
      treeFamilyIds.has(numericId),
    ).length;
    expect(world.treeMarkerCount).toBeGreaterThan(0);
    expect(world.treeMarkerCount).toBeLessThan(treeObjectCount / 2);
    const visibleLandforms = new Set(snapshot.cells.landform);
    for (const requiredLandform of [0, 1, 2, 3, 4]) {
      expect(visibleLandforms.has(requiredLandform)).toBe(true);
    }
    expect(new Set(snapshot.cells.biome).size).toBeGreaterThanOrEqual(3);
    expect(chunk.width * chunk.height).toBe(64 * 64);
    expect([...chunk.baseVisuals].every((handle) => handle !== NO_VISUAL_HANDLE)).toBe(true);
    expect(chunk.overlayVisuals).toHaveLength(64 * 64);
    expect([...populatedChunk.groupVisuals].some((handle) => handle !== NO_VISUAL_HANDLE)).toBe(
      true,
    );
    expect([...chunk.autotileTopology].every((code) => code <= 46)).toBe(true);
    expect([...chunk.transitionVisuals].some((handle) => handle !== NO_VISUAL_HANDLE)).toBe(true);
    expect([...chunk.shoreBands].some((band) => band > 0)).toBe(true);
    expect(new Set(chunk.landforms).size).toBeGreaterThanOrEqual(3);
    expect(new Set(chunk.biomes).size).toBeGreaterThanOrEqual(2);
    expect(
      populatedChunk.lowCover.visualHandles.length + populatedChunk.upright.visualHandles.length,
    ).toBeGreaterThan(0);
    expect(populatedChunk.upright.visualHandles.length).toBe(
      populatedChunk.upright.shadowVisuals.length,
    );
    expect(populatedChunk.upright.visualHandles.length).toBe(populatedChunk.upright.anchorX.length);
    expect(populatedChunk.upright.visualHandles.length).toBe(populatedChunk.upright.anchorY.length);
    expect([
      ...populatedChunk.lowCover.visualHandles,
      ...populatedChunk.upright.visualHandles,
    ]).not.toContain(NO_VISUAL_HANDLE);
    expect(compileRepresentativeChunk(snapshot, catalog).checksum).toBe(chunk.checksum);
    expect(chunk.checksum).toMatch(/^[0-9a-f]{8}$/);
  });

  it('projects P1-2 bridge, elevation, and corruption structure without changing world facts', async () => {
    const snapshot = await generateWorldSnapshot({ templateId: FIXED_TEMPLATE, seed: FIXED_SEED });
    const catalog = await createVisualCatalog(MAP_VISUAL_CONTRACT_BUNDLE, async (source) => {
      const atlas = MAP_VISUAL_CONTRACT_BUNDLE.manifest.atlases.find(
        ({ id }) => MAP_VISUAL_CONTRACT_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });
    const bridgeChunk = findChunk(snapshot.cells.biome, (cell) => {
      const x = cell % WORLD_SIZE;
      const pair = new Set([snapshot.cells.biome[cell], snapshot.cells.biome[cell + 1]]);
      return (
        x + 1 < WORLD_SIZE &&
        snapshot.cells.landform[cell] === LandformCode.Lowland &&
        snapshot.cells.landform[cell + 1] === LandformCode.Lowland &&
        pair.has(BiomeCode.Grassland) &&
        pair.has(BiomeCode.Woodland)
      );
    });
    const elevationChunk = findChunk(
      snapshot.cells.landform,
      (cell) => snapshot.cells.landform[cell] >= LandformCode.Highland,
    );
    const corruptionChunk = findChunk(
      snapshot.cells.environmentTheme,
      (cell) => snapshot.cells.environmentTheme[cell] === EnvironmentThemeCode.Corruption,
    );

    const bridge = compileChunkPlan(snapshot, catalog, bridgeChunk);
    const elevation = compileChunkPlan(snapshot, catalog, elevationChunk);
    const corruption = compileChunkPlan(snapshot, catalog, corruptionChunk);
    expect([...bridge.biomeBridges].some((band) => band > 0)).toBe(true);
    expect([...elevation.elevationBands].some((band) => band > 0)).toBe(true);
    expect([...corruption.themeBands].some((band) => band > 0)).toBe(true);
    expect([...corruption.environmentThemes]).toContain(EnvironmentThemeCode.Corruption);
    expect(corruption.environmentThemes).toEqual(
      Uint8Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, (_, localCell) => {
        const localX = localCell % CHUNK_SIZE;
        const localY = Math.floor(localCell / CHUNK_SIZE);
        return (
          snapshot.cells.environmentTheme[
            (corruption.chunkY + localY) * WORLD_SIZE + corruption.chunkX + localX
          ] ?? 0
        );
      }),
    );
    expect(compileChunkPlan(snapshot, catalog, corruptionChunk).checksum).toBe(corruption.checksum);
  });
});

function findChunk(values: Uint8Array, includes: (cell: number) => boolean): number {
  for (let cell = 0; cell < values.length; cell += 1) {
    if (!includes(cell)) continue;
    const x = cell % WORLD_SIZE;
    const y = Math.floor(cell / WORLD_SIZE);
    return Math.floor(y / CHUNK_SIZE) * CHUNKS_PER_AXIS + Math.floor(x / CHUNK_SIZE);
  }
  throw new Error('Expected a matching fixed acceptance chunk');
}

function chunkMatchCount(
  values: Uint8Array,
  chunk: number,
  includes: (value: number) => boolean,
): number {
  const chunkX = (chunk % CHUNKS_PER_AXIS) * CHUNK_SIZE;
  const chunkY = Math.floor(chunk / CHUNKS_PER_AXIS) * CHUNK_SIZE;
  let count = 0;
  for (let y = chunkY; y < chunkY + CHUNK_SIZE; y += 1) {
    for (let x = chunkX; x < chunkX + CHUNK_SIZE; x += 1) {
      count += Number(includes(values[y * WORLD_SIZE + x] ?? 0));
    }
  }
  return count;
}
