import {
  BiomeCode,
  CHUNK_SIZE,
  CHUNKS_PER_AXIS,
  EnvironmentThemeCode,
  LandformCode,
  ObjectFormTag,
  WORLD_SIZE,
  type WorldSnapshot,
} from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import type { VisualCatalog, VisualHandle } from '../visual/VisualCatalog';

export const NO_VISUAL_HANDLE = 0xffff_ffff;

export interface WorldViewPlan {
  readonly width: number;
  readonly height: number;
  readonly treeMarkerCount: number;
  readonly vegetationMarkers: WorldLodMarkerPlan;
  readonly rgba: Uint8ClampedArray;
  readonly terrainDebugRgba: Uint8ClampedArray;
  readonly biomeDebugRgba: Uint8ClampedArray;
}

export interface WorldLodMarkerPlan {
  readonly visualHandles: Uint32Array;
  readonly anchorX: Uint16Array;
  readonly anchorY: Uint16Array;
  readonly density: Uint8Array;
}

export interface RenderChunkPlan {
  readonly visualSeed: number;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly width: number;
  readonly height: number;
  readonly baseVisuals: Uint32Array;
  readonly overlayVisuals: Uint32Array;
  readonly groupVisuals: Uint32Array;
  readonly themeVisuals: Uint32Array;
  readonly transitionVisuals: Uint32Array;
  readonly autotileTopology: Uint8Array;
  readonly biomeBridges: Uint8Array;
  readonly elevationBands: Uint8Array;
  readonly environmentThemes: Uint8Array;
  readonly themeBands: Uint8Array;
  readonly elevations: Uint8Array;
  readonly landforms: Uint8Array;
  readonly biomes: Uint8Array;
  readonly shoreBands: Uint8Array;
  readonly lowCover: RenderObjectBatchPlan;
  readonly upright: RenderObjectBatchPlan;
  readonly foreground: RenderObjectBatchPlan;
  readonly checksum: string;
}

export interface RenderObjectBatchPlan {
  readonly visualHandles: Uint32Array;
  readonly shadowVisuals: Uint32Array;
  readonly anchorX: Uint16Array;
  readonly anchorY: Uint16Array;
  readonly sortKeys: Uint32Array;
  readonly variantSeeds: Uint32Array;
}

const landformIds = [
  'deep_ocean',
  'open_ocean',
  'shallow_water',
  'coast',
  'lowland',
  'highland',
  'mountain',
] as const;

const biomeIds = [
  'grassland',
  'woodland',
  'rainforest',
  'savanna',
  'desert',
  'wetland',
  'tundra',
  'polar',
] as const;

const groundMaterialIds = [
  'vegetated_soil',
  'bare_soil',
  'sand',
  'mud',
  'rock',
  'snow',
  'ice',
] as const;

const terrainPaletteRoles = [
  'water_deep',
  'water_mid',
  'water_light',
  'coast_sand',
  'ground_grass',
  'highland',
  'mountain',
] as const;

const biomePaletteRoles = [
  'ground_grass',
  'ground_woodland',
  'ground_rainforest',
  'ground_savanna',
  'ground_desert',
  'ground_wetland',
  'ground_tundra',
  'ground_polar',
] as const;

const validAutotileMasks = Object.freeze(
  [...new Set(Array.from({ length: 256 }, (_, mask) => normalizeMask(mask)))].sort(
    (left, right) => left - right,
  ),
);

if (validAutotileMasks.length !== 47) {
  throw new Error(`Expected 47 constrained autotile masks, received ${validAutotileMasks.length}`);
}

const topologyByMask = new Map(validAutotileMasks.map((mask, code) => [mask, code]));
const fullyConnectedTopology = requiredTopology(0xff);
const WORLD_TREE_MARKER_BUCKET_SIZE = 12;

export function compileWorldViewPlan(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
): WorldViewPlan {
  const terrainColors = terrainPaletteRoles.map((role) => parseHex(worldPalette(catalog, role)));
  const biomeColors = biomePaletteRoles.map((role) => parseHex(worldPalette(catalog, role)));
  const rgba = new Uint8ClampedArray(snapshot.cells.landform.length * 4);
  const terrainDebugRgba = new Uint8ClampedArray(rgba.length);
  const biomeDebugRgba = new Uint8ClampedArray(rgba.length);
  for (let cell = 0; cell < snapshot.cells.landform.length; cell += 1) {
    const landform = snapshot.cells.landform[cell] ?? LandformCode.DeepOcean;
    const biome = snapshot.cells.biome[cell] ?? 0;
    const x = cell % WORLD_SIZE;
    const y = Math.floor(cell / WORLD_SIZE);
    const terrainColor = terrainColors[landform] ?? terrainColors[LandformCode.Lowland];
    const biomeColor = biomeColors[biome] ?? biomeColors[0];
    if (terrainColor === undefined || biomeColor === undefined)
      throw new Error('P0 palette is incomplete');
    writeColor(terrainDebugRgba, cell, terrainColor);
    writeColor(biomeDebugRgba, cell, biomeColor);
    writeColor(
      rgba,
      cell,
      worldCellColor(
        landform <= LandformCode.Coast || landform >= LandformCode.Highland
          ? terrainColor
          : biomeColor,
        landform,
        snapshot.cells.elevation[cell] ?? 0,
        x,
        y,
        snapshot.metadata.seed,
      ),
    );
  }
  const treeFamilyIds = new Set(
    WORLD_RULES_CATALOG.treeArchetypes.map(({ numericId }) => numericId),
  );
  const corruptionColor = parseHex(worldPalette(catalog, 'corruption', 'shadow'));
  const treeMarkers = new Map<number, { object: number; count: number }>();
  for (let object = 0; object < snapshot.objects.objectIds.length; object += 1) {
    if (!treeFamilyIds.has(snapshot.objects.semanticFamilyIds[object] ?? 0)) continue;
    const anchor = snapshot.objects.anchorCells[object];
    if (anchor === undefined) continue;
    const x = anchor % WORLD_SIZE;
    const y = Math.floor(anchor / WORLD_SIZE);
    const bucketX = Math.floor(x / WORLD_TREE_MARKER_BUCKET_SIZE);
    const bucketY = Math.floor(y / WORLD_TREE_MARKER_BUCKET_SIZE);
    const bucket = bucketY * Math.ceil(WORLD_SIZE / WORLD_TREE_MARKER_BUCKET_SIZE) + bucketX;
    const marker = treeMarkers.get(bucket);
    if (marker === undefined) treeMarkers.set(bucket, { object, count: 1 });
    else marker.count += 1;
  }
  const markerHandles: number[] = [];
  const markerX: number[] = [];
  const markerY: number[] = [];
  const markerDensity: number[] = [];
  for (const marker of treeMarkers.values()) {
    const objectVisual = resolveTreeObjectVisual(snapshot, catalog, marker.object);
    if (objectVisual === null) continue;
    const lodWorld = catalog.getProjectionMetadata(objectVisual).lodWorld;
    const anchor = snapshot.objects.anchorCells[marker.object];
    if (lodWorld === null || anchor === undefined) continue;
    markerHandles.push(lodWorld);
    markerX.push(anchor % WORLD_SIZE);
    markerY.push(Math.floor(anchor / WORLD_SIZE));
    markerDensity.push(Math.min(3, marker.count));
  }
  for (let cell = 0; cell < snapshot.cells.environmentTheme.length; cell += 1) {
    if (snapshot.cells.environmentTheme[cell] === EnvironmentThemeCode.Corruption) {
      blendColor(rgba, cell, corruptionColor, 0.32);
    }
  }
  return {
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    treeMarkerCount: markerHandles.length,
    vegetationMarkers: {
      visualHandles: Uint32Array.from(markerHandles),
      anchorX: Uint16Array.from(markerX),
      anchorY: Uint16Array.from(markerY),
      density: Uint8Array.from(markerDensity),
    },
    rgba,
    terrainDebugRgba,
    biomeDebugRgba,
  };
}

function resolveTreeObjectVisual(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  object: number,
): VisualHandle | null {
  const familyNumericId = snapshot.objects.semanticFamilyIds[object] ?? 0;
  const tree = WORLD_RULES_CATALOG.treeArchetypes.find(
    ({ numericId }) => numericId === familyNumericId,
  );
  const anchor = snapshot.objects.anchorCells[object];
  if (tree === undefined || anchor === undefined) return null;
  return catalog.resolve(
    {
      category: 'vegetation',
      semanticFamilyId: tree.id,
      biomeId: requiredAt(biomeIds, snapshot.cells.biome[anchor] ?? 0),
      treeArchetypeId: tree.id,
      age: treeAge(snapshot.objects.formTags[object] ?? 0),
      height: treeHeight(snapshot.objects.formTags[object] ?? 0),
    },
    snapshot.objects.variantSeeds[object] ?? 0,
  );
}

export function compileRepresentativeChunk(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
): RenderChunkPlan {
  let selectedChunk = 0;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (let chunk = 0; chunk < CHUNKS_PER_AXIS * CHUNKS_PER_AXIS; chunk += 1) {
    const score = scoreChunk(snapshot, chunk);
    if (score > selectedScore) {
      selectedChunk = chunk;
      selectedScore = score;
    }
  }
  return compileChunkPlan(snapshot, catalog, selectedChunk);
}

export function compileChunkPlan(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  chunkIndex: number,
): RenderChunkPlan {
  const chunkX = (chunkIndex % CHUNKS_PER_AXIS) * CHUNK_SIZE;
  const chunkY = Math.floor(chunkIndex / CHUNKS_PER_AXIS) * CHUNK_SIZE;
  const cellCount = CHUNK_SIZE * CHUNK_SIZE;
  const baseVisuals = new Uint32Array(cellCount);
  const overlayVisuals = new Uint32Array(cellCount);
  overlayVisuals.fill(NO_VISUAL_HANDLE);
  const groupVisuals = new Uint32Array((CHUNK_SIZE / 4) ** 2);
  groupVisuals.fill(NO_VISUAL_HANDLE);
  const themeVisuals = new Uint32Array((CHUNK_SIZE / 4) ** 2);
  themeVisuals.fill(NO_VISUAL_HANDLE);
  const transitionVisuals = new Uint32Array(cellCount);
  transitionVisuals.fill(NO_VISUAL_HANDLE);
  const autotileTopology = new Uint8Array(cellCount);
  const biomeBridges = new Uint8Array(cellCount);
  const elevationBands = new Uint8Array(cellCount);
  const environmentThemes = new Uint8Array(cellCount);
  const themeBands = new Uint8Array(cellCount);
  const elevations = new Uint8Array(cellCount);
  const landforms = new Uint8Array(cellCount);
  const biomes = new Uint8Array(cellCount);
  const shoreBands = new Uint8Array(cellCount);

  for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      const localCell = localY * CHUNK_SIZE + localX;
      const worldX = chunkX + localX;
      const worldY = chunkY + localY;
      const worldCell = worldY * WORLD_SIZE + worldX;
      const landform = snapshot.cells.landform[worldCell] ?? LandformCode.DeepOcean;
      const biome = snapshot.cells.biome[worldCell] ?? 0;
      const material = snapshot.cells.groundMaterial[worldCell] ?? 0;
      elevations[localCell] = snapshot.cells.elevation[worldCell] ?? 0;
      landforms[localCell] = landform;
      biomes[localCell] = biome;
      environmentThemes[localCell] = snapshot.cells.environmentTheme[worldCell] ?? 0;
      biomeBridges[localCell] = biomeBridgeAt(snapshot, worldX, worldY);
      elevationBands[localCell] = elevationBandAt(snapshot, worldX, worldY);
      themeBands[localCell] = themeBandAt(snapshot, worldX, worldY);
      shoreBands[localCell] = shoreBandAt(snapshot, worldX, worldY);
      const variantSeed = cellSeed(snapshot.metadata.seed, worldX, worldY);
      const base =
        landform <= LandformCode.Coast
          ? catalog.resolve(
              { category: 'water', landformId: requiredAt(landformIds, landform) },
              variantSeed,
            )
          : catalog.resolve(
              {
                category: 'terrain-ground',
                biomeId: requiredAt(biomeIds, biome),
                groundMaterialId: requiredAt(groundMaterialIds, material),
                form: 'material_base',
              },
              variantSeed,
            );
      if (base === null) throw new Error(`No P0 base visual for world cell ${worldCell}`);
      baseVisuals[localCell] = base;

      if (landform > LandformCode.Coast) {
        const overlayRate =
          biome === BiomeCode.Woodland || biome === BiomeCode.Rainforest
            ? 2
            : biome === BiomeCode.Grassland ||
                biome === BiomeCode.Wetland ||
                biome === BiomeCode.Savanna ||
                biome === BiomeCode.Desert ||
                biome === BiomeCode.Tundra ||
                biome === BiomeCode.Polar
              ? 1
              : 0;
        if (((variantSeed >>> 9) & 0x3f) < overlayRate) {
          const overlay = catalog.resolve(
            {
              category: 'terrain-ground',
              biomeId: requiredAt(biomeIds, biome),
              groundMaterialId: requiredAt(groundMaterialIds, material),
              form: 'material_overlay',
            },
            variantSeed ^ 0x9e37_79b9,
          );
          if (overlay === null) throw new Error(`No P1 overlay visual for world cell ${worldCell}`);
          overlayVisuals[localCell] = overlay;
        }
      }

      const topology = topologyAt(snapshot, worldX, worldY);
      autotileTopology[localCell] = topology;
      if (
        topology !== fullyConnectedTopology &&
        landform >= LandformCode.Coast &&
        biomeBridges[localCell] === 0
      ) {
        const edgeRhythm = ((variantSeed % 3) + 1) as 1 | 2 | 3;
        const transition = catalog.resolve(
          { category: 'terrain-transition', topologyCode: topology, edgeRhythm },
          variantSeed,
        );
        if (transition === null)
          throw new Error(`No P0 transition visual for topology ${topology}`);
        transitionVisuals[localCell] = transition;
      }
    }
  }

  for (let groupY = 0; groupY < CHUNK_SIZE / 4; groupY += 1) {
    for (let groupX = 0; groupX < CHUNK_SIZE / 4; groupX += 1) {
      const worldX = chunkX + groupX * 4 + 2;
      const worldY = chunkY + groupY * 4 + 2;
      const worldCell = worldY * WORLD_SIZE + worldX;
      if ((snapshot.cells.landform[worldCell] ?? LandformCode.DeepOcean) <= LandformCode.Coast) {
        continue;
      }
      const material = snapshot.cells.groundMaterial[worldCell] ?? 0;
      const biome = snapshot.cells.biome[worldCell] ?? 0;
      const groupSeed = cellSeed(snapshot.metadata.seed ^ 0x57a6_f31d, worldX, worldY);
      if (
        snapshot.cells.environmentTheme[worldCell] === EnvironmentThemeCode.Corruption &&
        groupSeed % 100 < 22
      ) {
        const themeVisual = catalog.resolve(
          { category: 'effects', environmentThemeId: 'corruption' },
          groupSeed,
        );
        if (themeVisual === null) throw new Error('No corruption theme visual');
        themeVisuals[groupY * (CHUNK_SIZE / 4) + groupX] = themeVisual;
      }
      const groupRate =
        biome === BiomeCode.Rainforest
          ? 2
          : biome === BiomeCode.Wetland
            ? 3
            : biome === BiomeCode.Savanna
              ? 10
              : biome === BiomeCode.Desert
                ? 6
                : biome === BiomeCode.Grassland || biome === BiomeCode.Woodland
                  ? 18
                  : biome === BiomeCode.Tundra
                    ? 8
                    : biome === BiomeCode.Polar
                      ? 6
                      : 24;
      const groupRoll = (((groupSeed >>> 12) ^ groupSeed) >>> 0) % 100;
      if (groupRoll >= groupRate) continue;
      const visual = catalog.resolve(
        {
          category: 'terrain-ground',
          biomeId: requiredAt(biomeIds, biome),
          groundMaterialId: requiredAt(groundMaterialIds, material),
          form: 'material_group',
        },
        groupSeed,
      );
      if (visual === null) throw new Error(`No P0 material group for world cell ${worldCell}`);
      groupVisuals[groupY * (CHUNK_SIZE / 4) + groupX] = visual;
    }
  }

  const { lowCover, upright, foreground } = compileObjectBatches(
    snapshot,
    catalog,
    chunkIndex,
    chunkX,
    chunkY,
  );

  return {
    visualSeed: snapshot.metadata.seed,
    chunkX,
    chunkY,
    width: CHUNK_SIZE,
    height: CHUNK_SIZE,
    baseVisuals,
    overlayVisuals,
    groupVisuals,
    themeVisuals,
    transitionVisuals,
    autotileTopology,
    biomeBridges,
    elevationBands,
    environmentThemes,
    themeBands,
    elevations,
    landforms,
    biomes,
    shoreBands,
    lowCover,
    upright,
    foreground,
    checksum: planChecksum(chunkX, chunkY, [
      baseVisuals,
      overlayVisuals,
      groupVisuals,
      themeVisuals,
      transitionVisuals,
      autotileTopology,
      biomeBridges,
      elevationBands,
      environmentThemes,
      themeBands,
      elevations,
      landforms,
      biomes,
      shoreBands,
      lowCover.visualHandles,
      lowCover.shadowVisuals,
      lowCover.anchorX,
      lowCover.anchorY,
      lowCover.sortKeys,
      lowCover.variantSeeds,
      upright.visualHandles,
      upright.shadowVisuals,
      upright.anchorX,
      upright.anchorY,
      upright.sortKeys,
      upright.variantSeeds,
      foreground.visualHandles,
      foreground.shadowVisuals,
      foreground.anchorX,
      foreground.anchorY,
      foreground.sortKeys,
      foreground.variantSeeds,
    ]),
  };
}

function biomeBridgeAt(snapshot: WorldSnapshot, x: number, y: number): number {
  const cell = y * WORLD_SIZE + x;
  if ((snapshot.cells.landform[cell] ?? 0) !== LandformCode.Lowland) return 0;
  const biome = snapshot.cells.biome[cell] ?? 0;
  const radius = 4 + (cellSeed(snapshot.metadata.seed ^ 0x243f_6a88, x >> 3, y >> 3) % 9);
  let nearest = radius + 1;
  let target = biome;
  for (let distance = 1; distance <= radius; distance += 1) {
    for (const [offsetX, offsetY] of [
      [distance, 0],
      [-distance, 0],
      [0, distance],
      [0, -distance],
    ] as const) {
      if (distance >= nearest) continue;
      const safeX = Math.max(0, Math.min(WORLD_SIZE - 1, x + offsetX));
      const safeY = Math.max(0, Math.min(WORLD_SIZE - 1, y + offsetY));
      const neighbour = safeY * WORLD_SIZE + safeX;
      if (
        snapshot.cells.landform[neighbour] === LandformCode.Lowland &&
        snapshot.cells.biome[neighbour] !== biome
      ) {
        nearest = distance;
        target = snapshot.cells.biome[neighbour] ?? biome;
      }
    }
  }
  if (nearest > radius) return 0;
  const strength = Math.max(1, Math.min(3, Math.ceil((radius - nearest + 1) / 2)));
  return ((target + 1) << 2) | strength;
}

function elevationBandAt(snapshot: WorldSnapshot, x: number, y: number): number {
  const cell = y * WORLD_SIZE + x;
  const landform = snapshot.cells.landform[cell] ?? LandformCode.DeepOcean;
  if (landform !== LandformCode.Highland && landform !== LandformCode.Mountain) return 0;
  const radius = landform === LandformCode.Mountain ? 4 : 3;
  let nearestLower = radius + 1;
  for (let distance = 1; distance <= radius; distance += 1) {
    for (const [offsetX, offsetY] of [
      [distance, 0],
      [-distance, 0],
      [0, distance],
      [0, -distance],
    ] as const) {
      if (distance >= nearestLower) continue;
      const safeX = Math.max(0, Math.min(WORLD_SIZE - 1, x + offsetX));
      const safeY = Math.max(0, Math.min(WORLD_SIZE - 1, y + offsetY));
      const neighbour = safeY * WORLD_SIZE + safeX;
      if ((snapshot.cells.landform[neighbour] ?? landform) < landform) nearestLower = distance;
    }
  }
  const base = landform === LandformCode.Mountain ? 3 : 1;
  return nearestLower <= radius ? base : base + 1;
}

function themeBandAt(snapshot: WorldSnapshot, x: number, y: number): number {
  const cell = y * WORLD_SIZE + x;
  if (snapshot.cells.environmentTheme[cell] !== EnvironmentThemeCode.Corruption) return 0;
  for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
    const remaining = 3 - Math.abs(offsetY);
    for (let offsetX = -remaining; offsetX <= remaining; offsetX += 1) {
      const safeX = Math.max(0, Math.min(WORLD_SIZE - 1, x + offsetX));
      const safeY = Math.max(0, Math.min(WORLD_SIZE - 1, y + offsetY));
      if (
        snapshot.cells.environmentTheme[safeY * WORLD_SIZE + safeX] !==
        EnvironmentThemeCode.Corruption
      ) {
        return 1;
      }
    }
  }
  return 2;
}

function compileObjectBatches(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  chunkIndex: number,
  chunkX: number,
  chunkY: number,
): Readonly<{
  lowCover: RenderObjectBatchPlan;
  upright: RenderObjectBatchPlan;
  foreground: RenderObjectBatchPlan;
}> {
  const lowCover = createBatchBuilder();
  const upright = createBatchBuilder();
  const foreground = createBatchBuilder();
  const start = snapshot.objects.chunkOffsets[chunkIndex] ?? 0;
  const end = snapshot.objects.chunkOffsets[chunkIndex + 1] ?? start;
  for (let object = start; object < end; object += 1) {
    const familyNumericId = snapshot.objects.semanticFamilyIds[object] ?? 0;
    const tree = WORLD_RULES_CATALOG.treeArchetypes.find(
      ({ numericId }) => numericId === familyNumericId,
    );
    const decoration = WORLD_RULES_CATALOG.decorationFamilies.find(
      ({ numericId }) => numericId === familyNumericId,
    );
    const familyId = tree?.id ?? decoration?.id;
    const anchor = snapshot.objects.anchorCells[object];
    if (familyId === undefined || anchor === undefined) continue;
    const worldX = anchor % WORLD_SIZE;
    const worldY = Math.floor(anchor / WORLD_SIZE);
    const biomeId = requiredAt(biomeIds, snapshot.cells.biome[anchor] ?? 0);
    const landformId = requiredAt(landformIds, snapshot.cells.landform[anchor] ?? 0);
    const variantSeed = snapshot.objects.variantSeeds[object] ?? 0;
    const formTag = snapshot.objects.formTags[object] ?? 0;
    const visual =
      tree === undefined
        ? catalog.resolve(
            {
              category: decorationCategory(familyId),
              semanticFamilyId: familyId,
              biomeId,
              landformId,
            },
            variantSeed,
          )
        : catalog.resolve(
            {
              category: 'vegetation',
              semanticFamilyId: familyId,
              biomeId,
              treeArchetypeId: familyId,
              age: treeAge(formTag),
              height: treeHeight(formTag),
            },
            variantSeed,
          );
    if (visual === null) throw new Error(`No P0 visual for object family ${familyId}`);
    const metadata = catalog.getProjectionMetadata(visual);
    const target =
      metadata.renderLayer === 'low-cover'
        ? lowCover
        : metadata.renderLayer === 'foreground'
          ? foreground
          : upright;
    target.visualHandles.push(visual);
    target.shadowVisuals.push(metadata.shadowMask ?? NO_VISUAL_HANDLE);
    target.anchorX.push(worldX - chunkX);
    target.anchorY.push(worldY - chunkY);
    target.sortKeys.push(worldY * WORLD_SIZE + worldX);
    target.variantSeeds.push(variantSeed);
  }
  return {
    lowCover: finishBatch(lowCover),
    upright: finishBatch(upright),
    foreground: finishBatch(foreground),
  };
}

interface BatchBuilder {
  readonly visualHandles: number[];
  readonly shadowVisuals: number[];
  readonly anchorX: number[];
  readonly anchorY: number[];
  readonly sortKeys: number[];
  readonly variantSeeds: number[];
}

function createBatchBuilder(): BatchBuilder {
  return {
    visualHandles: [],
    shadowVisuals: [],
    anchorX: [],
    anchorY: [],
    sortKeys: [],
    variantSeeds: [],
  };
}

function finishBatch(builder: BatchBuilder): RenderObjectBatchPlan {
  return {
    visualHandles: Uint32Array.from(builder.visualHandles),
    shadowVisuals: Uint32Array.from(builder.shadowVisuals),
    anchorX: Uint16Array.from(builder.anchorX),
    anchorY: Uint16Array.from(builder.anchorY),
    sortKeys: Uint32Array.from(builder.sortKeys),
    variantSeeds: Uint32Array.from(builder.variantSeeds),
  };
}

function decorationCategory(familyId: string): 'ground-decoration' | 'vegetation' | 'landmark' {
  if (familyId.startsWith('landmark.')) return 'landmark';
  if (familyId.startsWith('vegetation.') || familyId === 'object.dead_tree') return 'vegetation';
  return 'ground-decoration';
}

function treeAge(formTag: number): 'sapling' | 'mature' | 'old' {
  if ((formTag & ObjectFormTag.AgeSapling) !== 0) return 'sapling';
  if ((formTag & ObjectFormTag.AgeOld) !== 0) return 'old';
  return 'mature';
}

function treeHeight(formTag: number): 'compact' | 'standard' | 'tall' {
  if ((formTag & ObjectFormTag.HeightCompact) !== 0) return 'compact';
  if ((formTag & ObjectFormTag.HeightTall) !== 0) return 'tall';
  return 'standard';
}

function scoreChunk(snapshot: WorldSnapshot, chunk: number): number {
  const chunkX = (chunk % CHUNKS_PER_AXIS) * CHUNK_SIZE;
  const chunkY = Math.floor(chunk / CHUNKS_PER_AXIS) * CHUNK_SIZE;
  const landforms = new Set<number>();
  const biomes = new Set<number>();
  let boundaryCount = 0;
  for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      const x = chunkX + localX;
      const y = chunkY + localY;
      const cell = y * WORLD_SIZE + x;
      const landform = snapshot.cells.landform[cell] ?? 0;
      landforms.add(landform);
      if (landform >= LandformCode.Coast) biomes.add(snapshot.cells.biome[cell] ?? 0);
      if (
        localX + 1 < CHUNK_SIZE &&
        surfaceKey(snapshot, x + 1, y) !== surfaceKey(snapshot, x, y)
      ) {
        boundaryCount += 1;
      }
      if (
        localY + 1 < CHUNK_SIZE &&
        surfaceKey(snapshot, x, y + 1) !== surfaceKey(snapshot, x, y)
      ) {
        boundaryCount += 1;
      }
    }
  }
  const hasWater = [...landforms].some((value) => value <= LandformCode.ShallowWater);
  const hasLand = [...landforms].some((value) => value >= LandformCode.Coast);
  const hasCoast = landforms.has(LandformCode.Coast);
  return (
    (hasCoast ? 2_000 : 0) +
    (hasWater && hasLand ? 1_000 : 0) +
    landforms.size * 180 +
    biomes.size * 80 +
    boundaryCount
  );
}

function topologyAt(snapshot: WorldSnapshot, x: number, y: number): number {
  const center = surfaceKey(snapshot, x, y);
  let mask = 0;
  if (surfaceKey(snapshot, x, y - 1) === center) mask |= 1;
  if (surfaceKey(snapshot, x + 1, y) === center) mask |= 2;
  if (surfaceKey(snapshot, x, y + 1) === center) mask |= 4;
  if (surfaceKey(snapshot, x - 1, y) === center) mask |= 8;
  if (surfaceKey(snapshot, x + 1, y - 1) === center) mask |= 16;
  if (surfaceKey(snapshot, x + 1, y + 1) === center) mask |= 32;
  if (surfaceKey(snapshot, x - 1, y + 1) === center) mask |= 64;
  if (surfaceKey(snapshot, x - 1, y - 1) === center) mask |= 128;
  return requiredTopology(mask);
}

function shoreBandAt(snapshot: WorldSnapshot, x: number, y: number): number {
  const center = snapshot.cells.landform[y * WORLD_SIZE + x] ?? LandformCode.DeepOcean;
  if (center !== LandformCode.Coast) return 0;
  let waterNeighbors = 0;
  let landNeighbors = 0;
  for (const [offsetX, offsetY] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const safeX = Math.max(0, Math.min(WORLD_SIZE - 1, x + offsetX));
    const safeY = Math.max(0, Math.min(WORLD_SIZE - 1, y + offsetY));
    const neighbor = snapshot.cells.landform[safeY * WORLD_SIZE + safeX] ?? center;
    if (neighbor <= LandformCode.ShallowWater) waterNeighbors += 1;
    else if (neighbor >= LandformCode.Lowland) landNeighbors += 1;
  }
  if (landNeighbors > waterNeighbors && landNeighbors > 0) return 3;
  if (waterNeighbors > 0) return 1;
  return 2;
}

function surfaceKey(snapshot: WorldSnapshot, x: number, y: number): number {
  const safeX = Math.max(0, Math.min(WORLD_SIZE - 1, x));
  const safeY = Math.max(0, Math.min(WORLD_SIZE - 1, y));
  const cell = safeY * WORLD_SIZE + safeX;
  const landform = snapshot.cells.landform[cell] ?? LandformCode.DeepOcean;
  if (landform <= LandformCode.Coast) return landform;
  return (
    16 +
    (snapshot.cells.groundMaterial[cell] ?? 0) * biomeIds.length +
    (snapshot.cells.biome[cell] ?? 0)
  );
}

function normalizeMask(mask: number): number {
  let normalized = mask & 0x0f;
  if ((mask & 0b0000_0011) === 0b0000_0011 && (mask & 16) !== 0) normalized |= 16;
  if ((mask & 0b0000_0110) === 0b0000_0110 && (mask & 32) !== 0) normalized |= 32;
  if ((mask & 0b0000_1100) === 0b0000_1100 && (mask & 64) !== 0) normalized |= 64;
  if ((mask & 0b0000_1001) === 0b0000_1001 && (mask & 128) !== 0) normalized |= 128;
  return normalized;
}

function requiredTopology(mask: number): number {
  const topology = topologyByMask.get(normalizeMask(mask));
  if (topology === undefined) throw new Error(`Unknown constrained autotile mask: ${mask}`);
  return topology;
}

function requiredAt<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Unknown semantic code: ${index}`);
  return value;
}

function parseHex(value: string): readonly [number, number, number] {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function worldPalette(catalog: VisualCatalog, role: string, fallbackRole = role): string {
  try {
    return catalog.getPaletteColor('world.lod', role);
  } catch {
    return catalog.getPaletteColor('world.base', fallbackRole);
  }
}

function worldCellColor(
  base: readonly [number, number, number],
  landform: number,
  elevation: number,
  x: number,
  y: number,
  seed: number,
): readonly [number, number, number] {
  const broadTone = (coherentWorldNoise(x, y, 32, seed ^ 0x8f1b_bcdc) - 0.5) * 0.16;
  const patchHash = cellSeed(seed ^ 0x51ed_270b, Math.floor(x / 4), Math.floor(y / 4));
  const patchTone = patchHash % 17 === 0 ? ((patchHash >>> 8) % 2 === 0 ? -0.06 : 0.055) : 0;
  const elevationTone = landform >= LandformCode.Highland ? ((elevation - 188) / 67) * -0.1 : 0;
  const waterTone = landform <= LandformCode.ShallowWater ? broadTone * 0.45 : broadTone;
  const amount = Math.max(-0.22, Math.min(0.18, waterTone + patchTone + elevationTone));
  return base.map((channel) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)),
      ),
    ),
  ) as unknown as readonly [number, number, number];
}

function coherentWorldNoise(x: number, y: number, scale: number, seed: number): number {
  const gridX = Math.floor(x / scale);
  const gridY = Math.floor(y / scale);
  const localX = smoothStep((x - gridX * scale) / scale);
  const localY = smoothStep((y - gridY * scale) / scale);
  const north = lerpNoise(unitNoise(gridX, gridY, seed), unitNoise(gridX + 1, gridY, seed), localX);
  const south = lerpNoise(
    unitNoise(gridX, gridY + 1, seed),
    unitNoise(gridX + 1, gridY + 1, seed),
    localX,
  );
  return lerpNoise(north, south, localY);
}

function unitNoise(x: number, y: number, seed: number): number {
  return cellSeed(seed, x, y) / 0x1_0000_0000;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerpNoise(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function writeColor(
  target: Uint8ClampedArray,
  cell: number,
  color: readonly [number, number, number],
): void {
  const offset = cell * 4;
  target[offset] = color[0];
  target[offset + 1] = color[1];
  target[offset + 2] = color[2];
  target[offset + 3] = 255;
}

function blendColor(
  target: Uint8ClampedArray,
  cell: number,
  color: readonly [number, number, number],
  strength: number,
): void {
  const offset = cell * 4;
  const baseStrength = 1 - strength;
  target[offset] = Math.round((target[offset] ?? 0) * baseStrength + color[0] * strength);
  target[offset + 1] = Math.round((target[offset + 1] ?? 0) * baseStrength + color[1] * strength);
  target[offset + 2] = Math.round((target[offset + 2] ?? 0) * baseStrength + color[2] * strength);
  target[offset + 3] = 255;
}

function cellSeed(seed: number, x: number, y: number): number {
  return (seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77)) >>> 0;
}

function planChecksum(
  chunkX: number,
  chunkY: number,
  columns: readonly (Uint8Array | Uint16Array | Uint32Array)[],
): string {
  let hash = 0x811c9dc5;
  hash = hashNumber(hash, chunkX);
  hash = hashNumber(hash, chunkY);
  for (const column of columns) {
    const bytes = new Uint8Array(column.buffer, column.byteOffset, column.byteLength);
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function hashNumber(hash: number, value: number): number {
  let result = hash;
  for (let shift = 0; shift < 32; shift += 8) {
    result = Math.imul(result ^ ((value >>> shift) & 0xff), 0x01000193) >>> 0;
  }
  return result;
}
