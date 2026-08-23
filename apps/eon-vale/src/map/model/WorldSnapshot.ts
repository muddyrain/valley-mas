import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';

export const WORLD_SIZE = 1024;
export const WORLD_CELL_COUNT = WORLD_SIZE * WORLD_SIZE;
export const CHUNK_SIZE = 64;
export const CHUNKS_PER_AXIS = WORLD_SIZE / CHUNK_SIZE;
export const CHUNK_COUNT = CHUNKS_PER_AXIS * CHUNKS_PER_AXIS;

export const LandformCode = {
  DeepOcean: 0,
  OpenOcean: 1,
  ShallowWater: 2,
  Coast: 3,
  Lowland: 4,
  Highland: 5,
  Mountain: 6,
} as const;

export const BiomeCode = {
  Grassland: 0,
  Woodland: 1,
  Rainforest: 2,
  Savanna: 3,
  Desert: 4,
  Wetland: 5,
  Tundra: 6,
  Polar: 7,
} as const;

export const GroundMaterialCode = {
  VegetatedSoil: 0,
  BareSoil: 1,
  Sand: 2,
  Mud: 3,
  Rock: 4,
  Snow: 5,
  Ice: 6,
} as const;

export const EnvironmentThemeCode = {
  None: 0,
  Corruption: 1,
} as const;

export const WaterKind = {
  Dry: 0,
  Ocean: 1,
  Lake: 2,
  River: 3,
} as const;

export const RiverClass = {
  None: 0,
  Tributary: 1,
  Channel: 2,
  Main: 3,
  Estuary: 4,
} as const;

export const FlowDirection = {
  North: 0,
  NorthEast: 1,
  East: 2,
  SouthEast: 3,
  South: 4,
  SouthWest: 5,
  West: 6,
  NorthWest: 7,
} as const;

export const ObjectFormTag = {
  AgeSapling: 1 << 0,
  AgeMature: 1 << 1,
  AgeOld: 1 << 2,
  HeightCompact: 1 << 3,
  HeightStandard: 1 << 4,
  HeightTall: 1 << 5,
} as const;

const AGE_FORM_MASK = ObjectFormTag.AgeSapling | ObjectFormTag.AgeMature | ObjectFormTag.AgeOld;
const HEIGHT_FORM_MASK =
  ObjectFormTag.HeightCompact | ObjectFormTag.HeightStandard | ObjectFormTag.HeightTall;
const KNOWN_FORM_MASK = AGE_FORM_MASK | HEIGHT_FORM_MASK;

type ValueOf<T> = T[keyof T];
export type WaterKindCode = ValueOf<typeof WaterKind>;
export type RiverClassCode = ValueOf<typeof RiverClass>;
export type FlowDirectionCode = ValueOf<typeof FlowDirection>;

export interface WorldCellColumns {
  readonly elevation: Uint8Array;
  readonly landform: Uint8Array;
  readonly hydrology: Uint8Array;
  readonly biome: Uint8Array;
  readonly groundMaterial: Uint8Array;
  readonly environmentTheme: Uint8Array;
}

export interface WorldObjectColumns {
  readonly objectIds: Uint32Array;
  readonly anchorCells: Uint32Array;
  readonly semanticFamilyIds: Uint16Array;
  readonly formTags: Uint16Array;
  readonly variantSeeds: Uint32Array;
  readonly chunkOffsets: Uint32Array;
}

export interface WorldSnapshotMetadata {
  readonly snapshotId: string;
  readonly templateId: string;
  readonly seed: number;
  readonly generatorVersion: number;
  readonly size: typeof WORLD_SIZE;
  readonly checksum: string;
}

export interface WorldSnapshot {
  readonly metadata: WorldSnapshotMetadata;
  readonly cells: WorldCellColumns;
  readonly objects: WorldObjectColumns;
}

export interface WorldSnapshotDraft {
  readonly templateId: string;
  readonly seed: number;
  readonly generatorVersion: number;
  readonly size: number;
  readonly cells: WorldCellColumns;
  readonly objects: WorldObjectColumns;
}

export interface WorldSnapshotValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function createWorldSnapshot(draft: WorldSnapshotDraft): WorldSnapshot {
  const checksum = computeWorldSnapshotChecksum(draft);
  const snapshot: WorldSnapshot = {
    metadata: {
      snapshotId: `${draft.templateId}:${draft.seed}:${draft.generatorVersion}:${checksum}`,
      templateId: draft.templateId,
      seed: draft.seed,
      generatorVersion: draft.generatorVersion,
      size: WORLD_SIZE,
      checksum,
    },
    cells: draft.cells,
    objects: draft.objects,
  };
  const issues = validateWorldSnapshot(snapshot);
  if (issues.length > 0) {
    throw new Error(issues.map(({ path, message }) => `${path}: ${message}`).join('\n'));
  }
  Object.freeze(snapshot.metadata);
  Object.freeze(snapshot.cells);
  Object.freeze(snapshot.objects);
  return Object.freeze(snapshot);
}

export function validateWorldSnapshot(
  snapshot: WorldSnapshot,
): readonly WorldSnapshotValidationIssue[] {
  const issues: WorldSnapshotValidationIssue[] = [];
  const { metadata, cells, objects } = snapshot;
  if (metadata.size !== WORLD_SIZE)
    issue(issues, 'metadata.size', `Expected ${WORLD_SIZE}, received ${metadata.size}`);
  if (!Number.isInteger(metadata.seed) || metadata.seed < 0 || metadata.seed > 0xffffffff)
    issue(issues, 'metadata.seed', 'Seed must be an unsigned 32-bit integer');
  if (!Number.isSafeInteger(metadata.generatorVersion) || metadata.generatorVersion < 1)
    issue(issues, 'metadata.generatorVersion', 'Generator version must be a positive integer');
  if (metadata.templateId.length === 0)
    issue(issues, 'metadata.templateId', 'Template id is required');
  if (!WORLD_RULES_CATALOG.templates.some(({ id }) => id === metadata.templateId))
    issue(issues, 'metadata.templateId', `Unknown template id: ${metadata.templateId}`);

  checkColumnLength(cells.elevation, 'cells.elevation', WORLD_CELL_COUNT, issues);
  checkColumnLength(cells.landform, 'cells.landform', WORLD_CELL_COUNT, issues);
  checkColumnLength(cells.hydrology, 'cells.hydrology', WORLD_CELL_COUNT, issues);
  checkColumnLength(cells.biome, 'cells.biome', WORLD_CELL_COUNT, issues);
  checkColumnLength(cells.groundMaterial, 'cells.groundMaterial', WORLD_CELL_COUNT, issues);
  checkColumnLength(cells.environmentTheme, 'cells.environmentTheme', WORLD_CELL_COUNT, issues);
  checkCodes(cells.landform, 6, 'cells.landform', issues);
  checkCodes(cells.biome, 7, 'cells.biome', issues);
  checkCodes(cells.groundMaterial, 6, 'cells.groundMaterial', issues);
  checkCodes(cells.environmentTheme, 1, 'cells.environmentTheme', issues);
  checkHydrology(cells.hydrology, issues);
  checkObjects(objects, issues);

  const expectedChecksum = computeWorldSnapshotChecksum({
    templateId: metadata.templateId,
    seed: metadata.seed,
    generatorVersion: metadata.generatorVersion,
    size: metadata.size,
    cells,
    objects,
  });
  if (metadata.checksum !== expectedChecksum)
    issue(
      issues,
      'metadata.checksum',
      `Expected ${expectedChecksum}, received ${metadata.checksum}`,
    );
  const expectedId = `${metadata.templateId}:${metadata.seed}:${metadata.generatorVersion}:${metadata.checksum}`;
  if (metadata.snapshotId !== expectedId)
    issue(issues, 'metadata.snapshotId', `Expected ${expectedId}`);
  return issues;
}

export function computeWorldSnapshotChecksum(draft: WorldSnapshotDraft): string {
  let hash = 0x811c9dc5;
  hash = hashString(hash, draft.templateId);
  hash = hashNumber(hash, draft.seed);
  hash = hashNumber(hash, draft.generatorVersion);
  hash = hashNumber(hash, draft.size);
  hash = hashBytes(hash, draft.cells.elevation);
  hash = hashBytes(hash, draft.cells.landform);
  hash = hashBytes(hash, draft.cells.hydrology);
  hash = hashBytes(hash, draft.cells.biome);
  hash = hashBytes(hash, draft.cells.groundMaterial);
  hash = hashBytes(hash, draft.cells.environmentTheme);
  hash = hashNumbers(hash, draft.objects.objectIds);
  hash = hashNumbers(hash, draft.objects.anchorCells);
  hash = hashNumbers(hash, draft.objects.semanticFamilyIds);
  hash = hashNumbers(hash, draft.objects.formTags);
  hash = hashNumbers(hash, draft.objects.variantSeeds);
  hash = hashNumbers(hash, draft.objects.chunkOffsets);
  return hash.toString(16).padStart(8, '0');
}

export function encodeHydrology(
  waterKind: WaterKindCode,
  riverClass: RiverClassCode = RiverClass.None,
  flowDirection: FlowDirectionCode = FlowDirection.North,
): number {
  if (waterKind === WaterKind.River && riverClass === RiverClass.None)
    throw new Error('River cells require a river class');
  if (waterKind !== WaterKind.River && riverClass !== RiverClass.None)
    throw new Error('Only river cells can have a river class');
  const flow = waterKind === WaterKind.River ? flowDirection : 0;
  return waterKind | (riverClass << 2) | (flow << 5);
}

export function decodeHydrology(value: number): Readonly<{
  waterKind: WaterKindCode;
  riverClass: RiverClassCode;
  flowDirection: FlowDirectionCode;
}> {
  return {
    waterKind: (value & 0b11) as WaterKindCode,
    riverClass: ((value >> 2) & 0b111) as RiverClassCode,
    flowDirection: ((value >> 5) & 0b111) as FlowDirectionCode,
  };
}

function checkColumnLength(
  column: ArrayLike<number>,
  path: string,
  expected: number,
  issues: WorldSnapshotValidationIssue[],
): void {
  if (column.length !== expected)
    issue(issues, path, `Expected ${expected} entries, received ${column.length}`);
}

function checkCodes(
  column: Uint8Array,
  maxCode: number,
  path: string,
  issues: WorldSnapshotValidationIssue[],
): void {
  for (let index = 0; index < column.length; index += 1) {
    const value = column[index];
    if (value !== undefined && value > maxCode) {
      issue(issues, `${path}.${index}`, `Unknown code: ${value}`);
      return;
    }
  }
}

function checkHydrology(column: Uint8Array, issues: WorldSnapshotValidationIssue[]): void {
  for (let index = 0; index < column.length; index += 1) {
    const value = column[index];
    if (value === undefined) continue;
    const decoded = decodeHydrology(value);
    const riverClassValid =
      decoded.riverClass >= RiverClass.Tributary && decoded.riverClass <= RiverClass.Estuary;
    if (
      decoded.waterKind === WaterKind.River
        ? !riverClassValid
        : decoded.riverClass !== RiverClass.None || decoded.flowDirection !== FlowDirection.North
    ) {
      issue(issues, `cells.hydrology.${index}`, `Invalid packed hydrology value: ${value}`);
      return;
    }
  }
}

function checkObjects(objects: WorldObjectColumns, issues: WorldSnapshotValidationIssue[]): void {
  const count = objects.objectIds.length;
  checkColumnLength(objects.anchorCells, 'objects.anchorCells', count, issues);
  checkColumnLength(objects.semanticFamilyIds, 'objects.semanticFamilyIds', count, issues);
  checkColumnLength(objects.formTags, 'objects.formTags', count, issues);
  checkColumnLength(objects.variantSeeds, 'objects.variantSeeds', count, issues);
  checkColumnLength(objects.chunkOffsets, 'objects.chunkOffsets', CHUNK_COUNT + 1, issues);
  if (objects.chunkOffsets.length !== CHUNK_COUNT + 1) return;
  if (objects.chunkOffsets[0] !== 0)
    issue(issues, 'objects.chunkOffsets.0', 'First chunk offset must be zero');
  if (objects.chunkOffsets[CHUNK_COUNT] !== count)
    issue(
      issues,
      `objects.chunkOffsets.${CHUNK_COUNT}`,
      `Last chunk offset must equal object count ${count}`,
    );

  const objectIds = new Set<number>();
  const semanticFamilyIds = new Set([
    ...WORLD_RULES_CATALOG.treeArchetypes.map(({ numericId }) => numericId),
    ...WORLD_RULES_CATALOG.decorationFamilies.map(({ numericId }) => numericId),
  ]);
  const treeFamilyIds = new Set(
    WORLD_RULES_CATALOG.treeArchetypes.map(({ numericId }) => numericId),
  );
  for (let chunk = 0; chunk < CHUNK_COUNT; chunk += 1) {
    const start = objects.chunkOffsets[chunk] ?? 0;
    const end = objects.chunkOffsets[chunk + 1] ?? 0;
    if (start > end || end > count) {
      issue(issues, `objects.chunkOffsets.${chunk}`, `Invalid chunk range: ${start}..${end}`);
      continue;
    }
    let previousKey: readonly [number, number, number] | undefined;
    for (let index = start; index < end; index += 1) {
      const objectId = objects.objectIds[index] ?? 0;
      const anchor = objects.anchorCells[index] ?? WORLD_CELL_COUNT;
      const semanticFamilyId = objects.semanticFamilyIds[index] ?? 0;
      const formTag = objects.formTags[index] ?? 0;
      if (objectId === 0 || objectIds.has(objectId))
        issue(
          issues,
          `objects.objectIds.${index}`,
          `Object id must be unique and non-zero: ${objectId}`,
        );
      objectIds.add(objectId);
      if (anchor >= WORLD_CELL_COUNT) {
        issue(issues, `objects.anchorCells.${index}`, `Anchor is outside the world: ${anchor}`);
        continue;
      }
      if (!semanticFamilyIds.has(semanticFamilyId))
        issue(
          issues,
          `objects.semanticFamilyIds.${index}`,
          `Unknown semantic family id: ${semanticFamilyId}`,
        );
      if (
        treeFamilyIds.has(semanticFamilyId) &&
        ((formTag & ~KNOWN_FORM_MASK) !== 0 ||
          !hasExactlyOneBit(formTag & AGE_FORM_MASK) ||
          !hasExactlyOneBit(formTag & HEIGHT_FORM_MASK))
      ) {
        issue(
          issues,
          `objects.formTags.${index}`,
          `Tree form must contain one age and one height tag: ${formTag}`,
        );
      }
      if (!treeFamilyIds.has(semanticFamilyId) && formTag !== 0) {
        issue(
          issues,
          `objects.formTags.${index}`,
          `Non-tree objects cannot use tree form tags: ${formTag}`,
        );
      }
      const x = anchor % WORLD_SIZE;
      const y = Math.floor(anchor / WORLD_SIZE);
      const actualChunk = Math.floor(y / CHUNK_SIZE) * CHUNKS_PER_AXIS + Math.floor(x / CHUNK_SIZE);
      if (actualChunk !== chunk)
        issue(
          issues,
          `objects.anchorCells.${index}`,
          `Anchor belongs to chunk ${actualChunk}, not ${chunk}`,
        );
      const key = [y, x, objectId] as const;
      if (previousKey !== undefined && compareKeys(previousKey, key) > 0)
        issue(
          issues,
          `objects.objectIds.${index}`,
          'Objects must be sorted by anchor Y, anchor X, then stable id',
        );
      previousKey = key;
    }
  }
}

function hasExactlyOneBit(value: number): boolean {
  return value !== 0 && (value & (value - 1)) === 0;
}

function compareKeys(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function issue(issues: WorldSnapshotValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function hashString(hash: number, value: string): number {
  let result = hash;
  for (let index = 0; index < value.length; index += 1)
    result = fnvByte(result, value.charCodeAt(index) & 0xff);
  return fnvByte(result, 0);
}

function hashNumber(hash: number, value: number): number {
  let result = hash;
  const normalized = value >>> 0;
  for (let shift = 0; shift < 32; shift += 8)
    result = fnvByte(result, (normalized >>> shift) & 0xff);
  return result;
}

function hashBytes(hash: number, values: Uint8Array): number {
  let result = hash;
  for (const value of values) result = fnvByte(result, value);
  return result;
}

function hashNumbers(hash: number, values: Uint16Array | Uint32Array): number {
  let result = hash;
  for (const value of values) result = hashNumber(result, value);
  return result;
}

function fnvByte(hash: number, byte: number): number {
  return Math.imul(hash ^ byte, 0x01000193) >>> 0;
}
