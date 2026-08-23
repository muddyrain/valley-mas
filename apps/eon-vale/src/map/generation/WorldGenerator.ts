import {
  BiomeCode,
  CHUNK_COUNT,
  CHUNK_SIZE,
  CHUNKS_PER_AXIS,
  createWorldSnapshot,
  EnvironmentThemeCode,
  encodeHydrology,
  GroundMaterialCode,
  LandformCode,
  ObjectFormTag,
  WaterKind,
  WORLD_CELL_COUNT,
  WORLD_SIZE,
  type WorldObjectColumns,
  type WorldSnapshot,
} from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';

export const GENERATOR_VERSION = 8;

export const GENERATION_STAGES = [
  'terrain',
  'hydrology',
  'climate',
  'biomes',
  'ground',
  'objects',
  'validation',
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

export interface WorldGenerationRequest {
  readonly templateId: string;
  readonly seed: number;
}

export interface GenerationProgress {
  readonly stage: GenerationStage;
  readonly completed: number;
}

export type GenerationProgressListener = (progress: GenerationProgress) => void;

export async function generateWorldSnapshot(
  request: WorldGenerationRequest,
  onProgress: GenerationProgressListener = () => undefined,
  signal?: AbortSignal,
): Promise<WorldSnapshot> {
  if (!WORLD_RULES_CATALOG.templates.some(({ id }) => id === request.templateId)) {
    throw new Error(`Unknown world template: ${request.templateId}`);
  }
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffff_ffff) {
    throw new Error(`World seed must be an unsigned 32-bit integer: ${request.seed}`);
  }

  const elevation = new Uint8Array(WORLD_CELL_COUNT);
  const landform = new Uint8Array(WORLD_CELL_COUNT);
  const hydrology = new Uint8Array(WORLD_CELL_COUNT);
  const biome = new Uint8Array(WORLD_CELL_COUNT);
  const groundMaterial = new Uint8Array(WORLD_CELL_COUNT);
  const environmentTheme = new Uint8Array(WORLD_CELL_COUNT);
  const temperature = new Uint8Array(WORLD_CELL_COUNT);
  const moisture = new Uint8Array(WORLD_CELL_COUNT);

  for (let y = 0; y < WORLD_SIZE; y += 1) {
    for (let x = 0; x < WORLD_SIZE; x += 1) {
      const index = y * WORLD_SIZE + x;
      const height = templateElevation(request.templateId, x, y, request.seed);
      elevation[index] = height;
      landform[index] = landformFor(height);
    }
  }
  await completeStage('terrain', 0, onProgress, signal);

  for (let index = 0; index < WORLD_CELL_COUNT; index += 1) {
    hydrology[index] =
      (landform[index] ?? LandformCode.DeepOcean) <= LandformCode.ShallowWater
        ? encodeHydrology(WaterKind.Ocean)
        : encodeHydrology(WaterKind.Dry);
  }
  await completeStage('hydrology', 1, onProgress, signal);

  for (let y = 0; y < WORLD_SIZE; y += 1) {
    const latitude = Math.abs(y / (WORLD_SIZE - 1) - 0.5) * 2;
    for (let x = 0; x < WORLD_SIZE; x += 1) {
      const index = y * WORLD_SIZE + x;
      temperature[index] = clampByte((1 - latitude) * 255 - (elevation[index] ?? 0) * 0.18);
      moisture[index] = clampByte(
        (valueNoise(x, y, 192, request.seed ^ 0x73a4c21d) * 0.7 +
          valueNoise(x + 311, y - 173, 64, request.seed ^ 0x2c9277b5) * 0.3) *
          255,
      );
    }
  }
  await completeStage('climate', 2, onProgress, signal);

  for (let index = 0; index < WORLD_CELL_COUNT; index += 1) {
    biome[index] = biomeFor(temperature[index] ?? 0, moisture[index] ?? 0);
  }
  await completeStage('biomes', 3, onProgress, signal);

  for (let index = 0; index < WORLD_CELL_COUNT; index += 1) {
    const landformCode = landform[index] ?? LandformCode.DeepOcean;
    const biomeCode = biome[index] ?? BiomeCode.Grassland;
    groundMaterial[index] = materialFor(landformCode, biomeCode, moisture[index] ?? 0);
    if (landformCode > LandformCode.Coast) {
      const x = index % WORLD_SIZE;
      const y = Math.floor(index / WORLD_SIZE);
      environmentTheme[index] = corruptionThemeFor(x, y, request.seed);
    }
  }
  await completeStage('ground', 4, onProgress, signal);

  const objects = createObjects(request.seed, landform, biome);
  await completeStage('objects', 5, onProgress, signal);

  const snapshot = createWorldSnapshot({
    templateId: request.templateId,
    seed: request.seed,
    generatorVersion: GENERATOR_VERSION,
    size: WORLD_SIZE,
    cells: { elevation, landform, hydrology, biome, groundMaterial, environmentTheme },
    objects,
  });
  await completeStage('validation', 6, onProgress, signal);
  return snapshot;
}

function createObjects(
  seed: number,
  landforms: Uint8Array,
  biomes: Uint8Array,
): WorldObjectColumns {
  const records: {
    objectId: number;
    anchorCell: number;
    semanticFamilyId: number;
    formTag: number;
    variantSeed: number;
  }[] = [];
  const chunkOffsets = new Uint32Array(CHUNK_COUNT + 1);
  const treesByBiome = WORLD_RULES_CATALOG.biomes.map((biome) =>
    WORLD_RULES_CATALOG.treeArchetypes.filter(({ habitatBiomeIds }) =>
      habitatBiomeIds.includes(biome.id),
    ),
  );
  const decorationsByBiome = WORLD_RULES_CATALOG.biomes.map((biome) =>
    WORLD_RULES_CATALOG.decorationFamilies.filter(({ habitatBiomeIds }) =>
      habitatBiomeIds.includes(biome.id),
    ),
  );
  const rareAnchors: number[] = [];

  let objectId = 1;
  for (let chunk = 0; chunk < CHUNK_COUNT; chunk += 1) {
    const chunkStart = records.length;
    chunkOffsets[chunk] = chunkStart;
    const chunkX = (chunk % CHUNKS_PER_AXIS) * CHUNK_SIZE;
    const chunkY = Math.floor(chunk / CHUNKS_PER_AXIS) * CHUNK_SIZE;
    for (let y = chunkY; y < chunkY + CHUNK_SIZE; y += 4) {
      for (let x = chunkX; x < chunkX + CHUNK_SIZE; x += 4) {
        const anchorX = x + (hash32(x, y, seed) & 3);
        const anchorY = y + ((hash32(y, x, seed ^ 0x91e10da5) >>> 2) & 3);
        const anchorCell = anchorY * WORLD_SIZE + anchorX;
        const landformCode = landforms[anchorCell] ?? LandformCode.DeepOcean;
        if (landformCode <= LandformCode.Coast) continue;
        const biomeCode = biomes[anchorCell] ?? BiomeCode.Grassland;
        const roll = hash01(anchorX, anchorY, seed ^ 0xa96f3c27);
        const terrainDensity =
          landformCode === LandformCode.Mountain
            ? 0.06
            : landformCode === LandformCode.Highland
              ? 0.22
              : 1;
        const treeCoverage =
          (WORLD_RULES_CATALOG.biomes[biomeCode]?.treeCanopyCoverage.max ?? 0) * terrainDensity;
        const decorationCoverage = 0.06 * Math.max(0.18, terrainDensity);
        let semanticFamilyId: number | undefined;
        let formTag = 0;
        if (roll < treeCoverage) {
          const candidates = treesByBiome[biomeCode] ?? [];
          const selected =
            candidates[hash32(anchorX, anchorY, seed) % Math.max(1, candidates.length)];
          semanticFamilyId = selected?.numericId;
          formTag = treeForm(hash32(anchorX, anchorY, seed ^ 0xd6e8feb8));
        } else if (roll < treeCoverage + decorationCoverage) {
          const landformId = WORLD_RULES_CATALOG.landforms[landformCode]?.id;
          const candidates = (decorationsByBiome[biomeCode] ?? []).filter(
            ({ habitatLandformIds }) =>
              habitatLandformIds.length === 0 ||
              (landformId !== undefined && habitatLandformIds.includes(landformId)),
          );
          const selected = chooseDecoration(candidates, hash32(anchorY, anchorX, seed));
          const rareSpacing = selected?.id.startsWith('landmark.')
            ? selected.id.includes('large')
              ? 64
              : 32
            : selected?.frequency === 'rare'
              ? 12
              : 0;
          if (
            selected !== undefined &&
            (rareSpacing === 0 ||
              rareAnchors.every((otherAnchor) => {
                const otherX = otherAnchor % WORLD_SIZE;
                const otherY = Math.floor(otherAnchor / WORLD_SIZE);
                return Math.hypot(anchorX - otherX, anchorY - otherY) >= rareSpacing;
              }))
          ) {
            semanticFamilyId = selected.numericId;
            if (rareSpacing > 0) rareAnchors.push(anchorCell);
          }
        }
        if (semanticFamilyId === undefined) continue;
        records.push({
          objectId,
          anchorCell,
          semanticFamilyId,
          formTag,
          variantSeed: hash32(anchorX, anchorY, seed ^ semanticFamilyId),
        });
        objectId += 1;
      }
    }
    const sortedChunk = records
      .slice(chunkStart)
      .sort((left, right) => left.anchorCell - right.anchorCell || left.objectId - right.objectId);
    records.splice(chunkStart, sortedChunk.length, ...sortedChunk);
  }
  chunkOffsets[CHUNK_COUNT] = records.length;
  return {
    objectIds: Uint32Array.from(records, ({ objectId }) => objectId),
    anchorCells: Uint32Array.from(records, ({ anchorCell }) => anchorCell),
    semanticFamilyIds: Uint16Array.from(records, ({ semanticFamilyId }) => semanticFamilyId),
    formTags: Uint16Array.from(records, ({ formTag }) => formTag),
    variantSeeds: Uint32Array.from(records, ({ variantSeed }) => variantSeed),
    chunkOffsets,
  };
}

function chooseDecoration<T extends Readonly<{ frequency: 'common' | 'uncommon' | 'rare' }>>(
  candidates: readonly T[],
  value: number,
): T | undefined {
  const weight = (candidate: T) =>
    candidate.frequency === 'common' ? 16 : candidate.frequency === 'uncommon' ? 4 : 1;
  const total = candidates.reduce((sum, candidate) => sum + weight(candidate), 0);
  if (total === 0) return undefined;
  let cursor = (value / 0x1_0000_0000) * total;
  for (const candidate of candidates) {
    cursor -= weight(candidate);
    if (cursor <= 0) return candidate;
  }
  return candidates.at(-1);
}

async function completeStage(
  stage: GenerationStage,
  stageIndex: number,
  listener: GenerationProgressListener,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (signal?.aborted === true) throw new DOMException('World generation cancelled', 'AbortError');
  listener({ stage, completed: (stageIndex + 1) / GENERATION_STAGES.length });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function templateElevation(templateId: string, x: number, y: number, seed: number): number {
  const nx = (x / (WORLD_SIZE - 1)) * 2 - 1;
  const ny = (y / (WORLD_SIZE - 1)) * 2 - 1;
  const noise =
    (valueNoise(x, y, 96, seed) - 0.5) * 0.22 +
    (valueNoise(x + 137, y - 251, 320, seed ^ 0xb5297a4d) - 0.5) * 0.14;
  const distance = Math.hypot(nx, ny);
  let field: number;
  let templateBias = 0;
  switch (templateId) {
    case 'twin_continents': {
      const leftWarp = valueNoise(x + 211, y - 97, 180, seed ^ 0x632b_e59b) - 0.5;
      const rightWarp = valueNoise(x - 367, y + 149, 164, seed ^ 0x8515_7af5) - 0.5;
      const left = organicIsland(nx, ny, -0.5, -0.04, 0.36, 0.66, leftWarp);
      const right = organicIsland(nx, ny, 0.49, 0.04, 0.37, 0.63, rightWarp);
      const leftPeninsula = organicIsland(nx, ny, -0.73, 0.31, 0.2, 0.16, leftWarp);
      const rightPeninsula = organicIsland(nx, ny, 0.73, -0.34, 0.19, 0.15, rightWarp);
      field = Math.max(
        left,
        right,
        leftPeninsula - 0.04,
        rightPeninsula - 0.04,
        satelliteIslandField(nx, ny, seed ^ 0x51ed_270b, 7, 0.78, 0.12),
      );
      templateBias = 0.07;
      break;
    }
    case 'archipelago':
      field =
        0.34 + Math.sin(nx * 13 + seed) * 0.16 + Math.cos(ny * 17 - seed) * 0.16 - distance * 0.28;
      templateBias = 0.45;
      break;
    case 'island_chain': {
      field = Number.NEGATIVE_INFINITY;
      for (let island = 0; island < 6; island += 1) {
        const t = island / 5;
        const centerX = -0.74 + t * 1.48;
        const centerY = 0.62 - t * 1.24 + Math.sin(t * Math.PI) * 0.08;
        const radiusX = 0.13 + hash01(island, 7, seed ^ 0x2d8a_4c31) * 0.03;
        const radiusY = 0.11 + hash01(island, 19, seed ^ 0x4f6c_dd1d) * 0.03;
        const islandWarp =
          valueNoise(
            x + island * 41,
            y - island * 29,
            92,
            seed ^ Math.imul(island + 1, 0x45d9_f3b),
          ) - 0.5;
        field = Math.max(
          field,
          organicIsland(nx, ny, centerX, centerY, radiusX, radiusY, islandWarp),
        );
      }
      templateBias = 0.04;
      break;
    }
    case 'inland_sea':
      field =
        0.84 - Math.max(Math.abs(nx), Math.abs(ny)) * 0.48 - Math.max(0, 0.45 - distance) * 1.55;
      templateBias = 0.27;
      break;
    case 'ring_continent':
      field = 0.76 - Math.abs(distance - 0.58) * 1.45;
      templateBias = 0.255;
      break;
    case 'fractured_coast':
      field = 0.68 - distance * 0.58 + noise * 1.9;
      templateBias = 0.34;
      break;
    case 'tri_continents': {
      const warpA = valueNoise(x + 97, y - 181, 172, seed ^ 0x243f_6a88) - 0.5;
      const warpB = valueNoise(x - 233, y + 317, 188, seed ^ 0x85a3_08d3) - 0.5;
      const warpC = valueNoise(x + 401, y + 83, 160, seed ^ 0x1319_8a2e) - 0.5;
      field = Math.max(
        organicIsland(nx, ny, -0.45, -0.4, 0.36, 0.31, warpA),
        organicIsland(nx, ny, 0.45, -0.36, 0.35, 0.32, warpB),
        organicIsland(nx, ny, 0.02, 0.47, 0.5, 0.32, warpC),
        satelliteIslandField(nx, ny, seed ^ 0xc0ac_29b7, 7, 0.78, 0.11),
      );
      templateBias = 0.05;
      break;
    }
    default: {
      const peakX = (hash01(71, 43, seed ^ 0x3c6e_f372) - 0.5) * 0.24;
      const peakY = (hash01(29, 83, seed ^ 0xa54f_f53a) - 0.5) * 0.2;
      const mountainCore = Math.max(0, 1 - Math.hypot(nx - peakX, ny - peakY) * 4.2) * 0.34;
      const coldRidgeDistance = Math.hypot((nx + 0.08) / 0.5, (ny + 0.72) / 0.19);
      const coldRidgeRaggedness =
        (valueNoise(x - 419, y + 277, 88, seed ^ 0x6a09_e667) - 0.5) * 0.18;
      const coldRidge = Math.max(0, 1 - coldRidgeDistance + coldRidgeRaggedness) * 0.62;
      const warpX = (valueNoise(x + 503, y - 191, 224, seed ^ 0x510e_527f) - 0.5) * 0.3;
      const warpY = (valueNoise(x - 283, y + 419, 208, seed ^ 0x9b05_688c) - 0.5) * 0.26;
      const coastUndulation =
        (valueNoise(x + 61, y - 107, 148, seed ^ 0x1f83_d9ab) - 0.5) * 0.34 +
        (valueNoise(x - 173, y + 89, 58, seed ^ 0x5be0_cd19) - 0.5) * 0.12;
      const mainland = 1.24 - Math.hypot((nx + warpX) * 0.82, ny + warpY) * 0.82 + coastUndulation;
      const satellites = continentSatelliteField(nx, ny, seed);
      field = Math.max(mainland + mountainCore + coldRidge, satellites);
    }
  }
  const edgeFalloff = Math.max(0, distance - 0.82) * 1.3;
  return clampByte((field + templateBias + noise - edgeFalloff) * 170);
}

function continentSatelliteField(nx: number, ny: number, seed: number): number {
  return satelliteIslandField(nx, ny, seed, 7, 0.9, 0.09);
}

function satelliteIslandField(
  nx: number,
  ny: number,
  seed: number,
  count: number,
  baseRadius: number,
  maxIslandRadius: number,
): number {
  let field = Number.NEGATIVE_INFINITY;
  for (let island = 0; island < count; island += 1) {
    const angle =
      (island / count) * Math.PI * 2 + (hash01(island, 17, seed ^ 0xa409_3822) - 0.5) * 0.7;
    const radius = baseRadius + hash01(island, 31, seed ^ 0x299f_31d0) * 0.08;
    const centerX = Math.cos(angle) * radius;
    const centerY = Math.sin(angle) * radius * 0.9;
    const radiusX = 0.055 + hash01(island, 47, seed ^ 0x082e_fa98) * maxIslandRadius;
    const radiusY = 0.05 + hash01(island, 59, seed ^ 0xec4e_6c89) * maxIslandRadius * 0.82;
    const islandDistance = Math.hypot((nx - centerX) / radiusX, (ny - centerY) / radiusY);
    field = Math.max(field, 0.93 - islandDistance * 0.24);
  }
  return field;
}

function organicIsland(
  nx: number,
  ny: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  warp: number,
): number {
  const distance = Math.hypot(
    (nx - centerX + warp * 0.18) / radiusX,
    (ny - centerY - warp * 0.14) / radiusY,
  );
  return 0.94 - distance * 0.34 + warp * 0.13;
}

function landformFor(elevation: number): number {
  if (elevation < 54) return LandformCode.DeepOcean;
  if (elevation < 84) return LandformCode.OpenOcean;
  if (elevation < 112) return LandformCode.ShallowWater;
  if (elevation < 124) return LandformCode.Coast;
  if (elevation < 188) return LandformCode.Lowland;
  if (elevation < 224) return LandformCode.Highland;
  return LandformCode.Mountain;
}

function biomeFor(temperature: number, moisture: number): number {
  if (temperature < 28) return BiomeCode.Polar;
  if (temperature < 66) return BiomeCode.Tundra;
  if (moisture < 45) return BiomeCode.Desert;
  if (temperature > 178 && moisture > 165) return BiomeCode.Rainforest;
  if (moisture > 206) return BiomeCode.Wetland;
  if (temperature > 150 && moisture < 110) return BiomeCode.Savanna;
  return moisture > 125 ? BiomeCode.Woodland : BiomeCode.Grassland;
}

function materialFor(landform: number, biome: number, moisture: number): number {
  if (landform <= LandformCode.ShallowWater) return GroundMaterialCode.Sand;
  if (landform === LandformCode.Coast) return GroundMaterialCode.Sand;
  if (landform >= LandformCode.Highland) return GroundMaterialCode.Rock;
  if (biome === BiomeCode.Polar) return GroundMaterialCode.Ice;
  if (biome === BiomeCode.Tundra) return GroundMaterialCode.Snow;
  if (biome === BiomeCode.Desert) return GroundMaterialCode.Sand;
  if (biome === BiomeCode.Wetland || moisture > 220) return GroundMaterialCode.Mud;
  return biome === BiomeCode.Savanna
    ? GroundMaterialCode.BareSoil
    : GroundMaterialCode.VegetatedSoil;
}

function corruptionThemeFor(x: number, y: number, seed: number): number {
  const focusX = WORLD_SIZE * (0.38 + hash01(11, 29, seed ^ 0x4f1bbcdc) * 0.24);
  const focusY = WORLD_SIZE * (0.34 + hash01(37, 17, seed ^ 0xa54ff53a) * 0.3);
  const radiusX = 112 + hash01(53, 7, seed ^ 0x510e527f) * 54;
  const radiusY = 92 + hash01(19, 61, seed ^ 0x9b05688c) * 46;
  const warpX = (valueNoise(x + 173, y - 97, 96, seed ^ 0x1f83d9ab) - 0.5) * 54;
  const warpY = (valueNoise(x - 211, y + 131, 112, seed ^ 0x5be0cd19) - 0.5) * 46;
  const distance = Math.hypot((x + warpX - focusX) / radiusX, (y + warpY - focusY) / radiusY);
  const raggedness = (valueNoise(x, y, 36, seed ^ 0xcbbb9d5d) - 0.5) * 0.28;
  return distance + raggedness < 0.86 ? EnvironmentThemeCode.Corruption : EnvironmentThemeCode.None;
}

function treeForm(value: number): number {
  const age =
    [ObjectFormTag.AgeSapling, ObjectFormTag.AgeMature, ObjectFormTag.AgeOld][value % 3] ??
    ObjectFormTag.AgeMature;
  let height =
    [ObjectFormTag.HeightCompact, ObjectFormTag.HeightStandard, ObjectFormTag.HeightTall][
      (value >>> 3) % 3
    ] ?? ObjectFormTag.HeightStandard;
  if (age === ObjectFormTag.AgeSapling && height === ObjectFormTag.HeightTall) {
    height = ObjectFormTag.HeightStandard;
  }
  return age | height;
}

function hash01(x: number, y: number, seed: number): number {
  return hash32(x, y, seed) / 0x1_0000_0000;
}

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const gridX = Math.floor(x / scale);
  const gridY = Math.floor(y / scale);
  const localX = smoothstep((x - gridX * scale) / scale);
  const localY = smoothstep((y - gridY * scale) / scale);
  const north = lerp(hash01(gridX, gridY, seed), hash01(gridX + 1, gridY, seed), localX);
  const south = lerp(hash01(gridX, gridY + 1, seed), hash01(gridX + 1, gridY + 1, seed), localX);
  return lerp(north, south, localY);
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function hash32(x: number, y: number, seed: number): number {
  let value = seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
