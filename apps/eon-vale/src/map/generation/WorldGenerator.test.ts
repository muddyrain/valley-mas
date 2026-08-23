import { describe, expect, it } from 'vitest';

import {
  BiomeCode,
  EnvironmentThemeCode,
  GroundMaterialCode,
  LandformCode,
  ObjectFormTag,
  validateWorldSnapshot,
  WORLD_CELL_COUNT,
  WORLD_SIZE,
} from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import { type GenerationStage, generateWorldSnapshot } from './WorldGenerator';

describe('WorldGenerator', () => {
  it('builds the same authoritative snapshot for the same template and seed', async () => {
    const stages: GenerationStage[] = [];
    const first = await generateWorldSnapshot(
      { templateId: 'continent', seed: 0x1234abcd },
      ({ stage }) => stages.push(stage),
    );
    const second = await generateWorldSnapshot({ templateId: 'continent', seed: 0x1234abcd });

    expect(first.metadata.checksum).toBe(second.metadata.checksum);
    expect(first.cells.elevation).toEqual(second.cells.elevation);
    expect(first.cells.elevation).toHaveLength(WORLD_CELL_COUNT);
    expect(validateWorldSnapshot(first)).toEqual([]);
    expect(
      [...first.objects.formTags].some(
        (form) =>
          (form & ObjectFormTag.AgeSapling) !== 0 && (form & ObjectFormTag.HeightTall) !== 0,
      ),
    ).toBe(false);
    const families = new Map(
      [...WORLD_RULES_CATALOG.treeArchetypes, ...WORLD_RULES_CATALOG.decorationFamilies].map(
        (family) => [family.numericId, family],
      ),
    );
    for (let object = 0; object < first.objects.objectIds.length; object += 1) {
      const anchor = first.objects.anchorCells[object] ?? 0;
      const family = families.get(first.objects.semanticFamilyIds[object] ?? 0);
      const biomeId = WORLD_RULES_CATALOG.biomes[first.cells.biome[anchor] ?? 0]?.id;
      const landformId = WORLD_RULES_CATALOG.landforms[first.cells.landform[anchor] ?? 0]?.id;
      expect(family?.habitatBiomeIds).toContain(biomeId);
      if (
        family !== undefined &&
        'habitatLandformIds' in family &&
        family.habitatLandformIds.length
      ) {
        expect(family.habitatLandformIds).toContain(landformId);
      }
    }
    const cellsByLandform = countValues(first.cells.landform);
    const objectsByLandform = new Map<number, number>();
    for (const anchor of first.objects.anchorCells) {
      const landform = first.cells.landform[anchor] ?? LandformCode.DeepOcean;
      objectsByLandform.set(landform, (objectsByLandform.get(landform) ?? 0) + 1);
    }
    const density = (landform: number) =>
      (objectsByLandform.get(landform) ?? 0) / Math.max(1, cellsByLandform.get(landform) ?? 0);
    expect(density(LandformCode.Highland)).toBeLessThan(density(LandformCode.Lowland) * 0.4);
    expect(density(LandformCode.Mountain)).toBeLessThan(density(LandformCode.Highland));
    const landmarks = [...first.objects.semanticFamilyIds]
      .map((familyId, object) => ({ familyId, anchor: first.objects.anchorCells[object] ?? 0 }))
      .filter(({ familyId }) => familyId === 34 || familyId === 35);
    expect(landmarks.length).toBeGreaterThan(0);
    expect(landmarks.length).toBeLessThan(40);
    for (let left = 0; left < landmarks.length; left += 1) {
      for (let right = left + 1; right < landmarks.length; right += 1) {
        const leftAnchor = landmarks[left]?.anchor ?? 0;
        const rightAnchor = landmarks[right]?.anchor ?? 0;
        expect(
          Math.hypot(
            (leftAnchor % WORLD_SIZE) - (rightAnchor % WORLD_SIZE),
            Math.floor(leftAnchor / WORLD_SIZE) - Math.floor(rightAnchor / WORLD_SIZE),
          ),
        ).toBeGreaterThanOrEqual(32);
      }
    }
    expect(stages).toEqual([
      'terrain',
      'hydrology',
      'climate',
      'biomes',
      'ground',
      'objects',
      'validation',
    ]);
  });

  it('uses the template as a generation fact instead of a cosmetic label', async () => {
    const continent = await generateWorldSnapshot({ templateId: 'continent', seed: 91 });
    const ring = await generateWorldSnapshot({ templateId: 'ring_continent', seed: 91 });

    expect(continent.metadata.checksum).not.toBe(ring.metadata.checksum);
    expect(continent.cells.landform).not.toEqual(ring.cells.landform);
  });

  it('keeps every template inside its declared land-share contract', async () => {
    const seeds = [
      0x1357_9bdf, 0x2377_cc20, 0x3397_fc61, 0x43b8_2ca2, 0x53d8_5ce3, 0x63f8_8d24, 0x7418_bd65,
      0x8438_eda6,
    ] as const;

    for (const [index, template] of WORLD_RULES_CATALOG.templates.entries()) {
      const world = await generateWorldSnapshot({
        templateId: template.id,
        seed: seeds[index] ?? 0,
      });
      const landShare = matchingShare(world.cells.landform, (value) => value >= LandformCode.Coast);

      expect
        .soft(landShare, `${template.id} minimum land share`)
        .toBeGreaterThanOrEqual(template.landShare.min);
      expect
        .soft(landShare, `${template.id} maximum land share`)
        .toBeLessThanOrEqual(template.landShare.max);
      expect(new Set(world.cells.landform), `${template.id} has lowland`).toContain(
        LandformCode.Lowland,
      );
    }
  }, 30_000);

  it('keeps the player-facing templates structurally distinct', async () => {
    const [continent, twins, chain, triContinents] = await Promise.all([
      generateWorldSnapshot({ templateId: 'continent', seed: 0x1357_9bdf }),
      generateWorldSnapshot({ templateId: 'twin_continents', seed: 0x2377_cc20 }),
      generateWorldSnapshot({ templateId: 'island_chain', seed: 0x43b8_2ca2 }),
      generateWorldSnapshot({ templateId: 'tri_continents', seed: 0x8438_eda6 }),
    ]);
    const continentRegions = connectedRegionSizes(
      continent.cells.landform,
      (value) => value >= LandformCode.Coast,
    );
    const twinRegions = connectedRegionSizes(
      twins.cells.landform,
      (value) => value >= LandformCode.Coast,
    );
    const chainRegions = connectedRegionSizes(
      chain.cells.landform,
      (value) => value >= LandformCode.Coast,
    );
    const triRegions = connectedRegionSizes(
      triContinents.cells.landform,
      (value) => value >= LandformCode.Coast,
    );

    expect(continentRegions.filter((size) => size >= 400).length).toBeGreaterThanOrEqual(4);
    expect(twinRegions.filter((size) => size >= 10_000)).toHaveLength(2);
    expect(chainRegions.filter((size) => size >= 1_000).length).toBeGreaterThanOrEqual(6);
    expect(triRegions.filter((size) => size >= 30_000)).toHaveLength(3);
  }, 30_000);

  it('generates a coherent continent instead of grid-aligned mosaic fragments', async () => {
    const world = await generateWorldSnapshot({ templateId: 'continent', seed: 0x1a2b3c4d });
    const land = connectedRegionStats(world.cells.landform, (value) => value >= LandformCode.Coast);
    const landShare = matchingShare(world.cells.landform, (value) => value >= LandformCode.Coast);

    expect.soft(landShare).toBeGreaterThan(0.3);
    expect.soft(landShare).toBeLessThan(0.55);
    expect.soft(land.largestShare).toBeGreaterThan(0.82);
    expect.soft(land.smallRegionShare).toBeLessThan(0.015);
    expect.soft(gridBoundaryEnrichment(world.cells.landform, 16)).toBeLessThan(2);
    expect.soft(gridBoundaryEnrichment(world.cells.biome, 8, true)).toBeLessThan(2);
    expect.soft(neighbourChangeRate(world.cells.biome, world.cells.landform)).toBeLessThan(0.035);
    expect([...world.cells.landform]).toContain(LandformCode.Highland);
    expect([...world.cells.landform]).toContain(LandformCode.Mountain);
  });

  it('creates a real cold elevation region for the P2-3 acceptance world', async () => {
    const world = await generateWorldSnapshot({ templateId: 'continent', seed: 8 });
    let coldElevationCells = 0;
    let snowyColdElevationCells = 0;
    for (let cell = 0; cell < world.cells.landform.length; cell += 1) {
      const isCold =
        world.cells.biome[cell] === BiomeCode.Tundra || world.cells.biome[cell] === BiomeCode.Polar;
      const isElevation = (world.cells.landform[cell] ?? 0) >= LandformCode.Highland;
      if (!isCold || !isElevation) continue;
      coldElevationCells += 1;
      if (
        world.cells.groundMaterial[cell] === GroundMaterialCode.Snow ||
        world.cells.groundMaterial[cell] === GroundMaterialCode.Ice ||
        world.cells.groundMaterial[cell] === GroundMaterialCode.Rock
      ) {
        snowyColdElevationCells += 1;
      }
    }

    expect(coldElevationCells).toBeGreaterThan(500);
    expect(snowyColdElevationCells).toBe(coldElevationCells);
    expect([...world.cells.landform]).toContain(LandformCode.Mountain);
  });

  it('keeps corruption constrained, land-only, deterministic, and free of 32-cell blocks', async () => {
    const first = await generateWorldSnapshot({ templateId: 'continent', seed: 0x1a2b3c4d });
    const second = await generateWorldSnapshot({ templateId: 'continent', seed: 0x1a2b3c4d });
    const corruption = first.cells.environmentTheme;
    const corruptedCells = [...corruption].filter(
      (value) => value === EnvironmentThemeCode.Corruption,
    ).length;

    expect(corruption).toEqual(second.cells.environmentTheme);
    expect(corruptedCells).toBeGreaterThan(WORLD_CELL_COUNT * 0.005);
    expect(corruptedCells).toBeLessThan(WORLD_CELL_COUNT * 0.08);
    for (let cell = 0; cell < corruption.length; cell += 1) {
      if (corruption[cell] !== EnvironmentThemeCode.Corruption) continue;
      expect(first.cells.landform[cell]).toBeGreaterThan(LandformCode.Coast);
    }
    expect.soft(gridBoundaryEnrichment(corruption, 32)).toBeLessThan(2);
    expect.soft(neighbourChangeRate(corruption, first.cells.landform)).toBeLessThan(0.02);
  });

  it('rejects unknown templates before allocating a world', async () => {
    await expect(generateWorldSnapshot({ templateId: 'missing', seed: 1 })).rejects.toThrow(
      /Unknown world template/,
    );
  });
});

function connectedRegionStats(
  values: Uint8Array,
  includes: (value: number) => boolean,
): { readonly largestShare: number; readonly smallRegionShare: number } {
  const visited = new Uint8Array(values.length);
  let total = 0;
  let largest = 0;
  let small = 0;
  for (let start = 0; start < values.length; start += 1) {
    if (visited[start] === 1 || !includes(values[start] ?? 0)) continue;
    const queue = [start];
    visited[start] = 1;
    let size = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const cell = queue[cursor];
      if (cell === undefined) continue;
      size += 1;
      const x = cell % WORLD_SIZE;
      const neighbours = [
        x > 0 ? cell - 1 : -1,
        x + 1 < WORLD_SIZE ? cell + 1 : -1,
        cell >= WORLD_SIZE ? cell - WORLD_SIZE : -1,
        cell + WORLD_SIZE < values.length ? cell + WORLD_SIZE : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour >= 0 && visited[neighbour] === 0 && includes(values[neighbour] ?? 0)) {
          visited[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }
    total += size;
    largest = Math.max(largest, size);
    if (size < 256) small += size;
  }
  return {
    largestShare: total === 0 ? 0 : largest / total,
    smallRegionShare: total === 0 ? 0 : small / total,
  };
}

function connectedRegionSizes(
  values: Uint8Array,
  includes: (value: number) => boolean,
): readonly number[] {
  const visited = new Uint8Array(values.length);
  const sizes: number[] = [];
  for (let start = 0; start < values.length; start += 1) {
    if (visited[start] === 1 || !includes(values[start] ?? 0)) continue;
    const queue = [start];
    visited[start] = 1;
    let size = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const cell = queue[cursor];
      if (cell === undefined) continue;
      size += 1;
      const x = cell % WORLD_SIZE;
      const neighbours = [
        x > 0 ? cell - 1 : -1,
        x + 1 < WORLD_SIZE ? cell + 1 : -1,
        cell >= WORLD_SIZE ? cell - WORLD_SIZE : -1,
        cell + WORLD_SIZE < values.length ? cell + WORLD_SIZE : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour >= 0 && visited[neighbour] === 0 && includes(values[neighbour] ?? 0)) {
          visited[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((left, right) => right - left);
}

function matchingShare(values: Uint8Array, includes: (value: number) => boolean): number {
  let matches = 0;
  for (const value of values) if (includes(value)) matches += 1;
  return matches / values.length;
}

function countValues(values: Uint8Array): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function gridBoundaryEnrichment(values: Uint8Array, step: number, horizontalOnly = false): number {
  let boundaryChanges = 0;
  let boundaryComparisons = 0;
  let interiorChanges = 0;
  let interiorComparisons = 0;
  for (let y = 0; y < WORLD_SIZE; y += 1) {
    for (let x = 1; x < WORLD_SIZE; x += 1) {
      const changed = values[y * WORLD_SIZE + x] !== values[y * WORLD_SIZE + x - 1];
      if (x % step === 0) {
        boundaryComparisons += 1;
        if (changed) boundaryChanges += 1;
      } else {
        interiorComparisons += 1;
        if (changed) interiorChanges += 1;
      }
    }
  }
  if (!horizontalOnly) {
    for (let y = 1; y < WORLD_SIZE; y += 1) {
      for (let x = 0; x < WORLD_SIZE; x += 1) {
        const changed = values[y * WORLD_SIZE + x] !== values[(y - 1) * WORLD_SIZE + x];
        if (y % step === 0) {
          boundaryComparisons += 1;
          if (changed) boundaryChanges += 1;
        } else {
          interiorComparisons += 1;
          if (changed) interiorChanges += 1;
        }
      }
    }
  }
  const boundaryRate = boundaryChanges / boundaryComparisons;
  const interiorRate = interiorChanges / interiorComparisons;
  return interiorRate === 0 ? Number.POSITIVE_INFINITY : boundaryRate / interiorRate;
}

function neighbourChangeRate(values: Uint8Array, landforms: Uint8Array): number {
  let changes = 0;
  let comparisons = 0;
  for (let y = 0; y < WORLD_SIZE; y += 1) {
    for (let x = 0; x < WORLD_SIZE; x += 1) {
      const cell = y * WORLD_SIZE + x;
      if ((landforms[cell] ?? 0) < LandformCode.Coast) continue;
      if (x + 1 < WORLD_SIZE && (landforms[cell + 1] ?? 0) >= LandformCode.Coast) {
        comparisons += 1;
        if (values[cell] !== values[cell + 1]) changes += 1;
      }
      if (y + 1 < WORLD_SIZE && (landforms[cell + WORLD_SIZE] ?? 0) >= LandformCode.Coast) {
        comparisons += 1;
        if (values[cell] !== values[cell + WORLD_SIZE]) changes += 1;
      }
    }
  }
  return changes / comparisons;
}
