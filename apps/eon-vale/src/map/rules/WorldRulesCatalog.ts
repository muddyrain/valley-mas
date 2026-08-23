export type DensityBand = 'sparse' | 'ordinary' | 'rich';
export type TreeAbundance = 'primary' | 'secondary' | 'rare';
export type ObjectFrequency = 'common' | 'uncommon' | 'rare';

export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

export interface WorldTemplateRule {
  readonly id: string;
  readonly landShare: NumericRange;
  readonly majorLandmasses: NumericRange;
  readonly satelliteIslands: NumericRange;
  readonly coastRoughness: NumericRange;
  readonly enclosedWater: 'forbidden' | 'allowed' | 'required';
}

export interface LandformRule {
  readonly id: string;
  readonly isWater: boolean;
}

export interface BiomeRule {
  readonly id: string;
  readonly decorationDensity: DensityBand;
  readonly treeCanopyCoverage: NumericRange;
  readonly activeCoverGroupShare: NumericRange;
  readonly coverAnchorsPerActiveGroup: NumericRange;
}

export interface GroundMaterialRule {
  readonly id: string;
  readonly baseVariantMinimum: number;
  readonly materialGroupMinimum: number;
  readonly staticOverlayMinimum: number;
}

export interface EnvironmentThemeRule {
  readonly id: string;
  readonly isOverlay: boolean;
}

export interface ObjectSizeFamilyRule {
  readonly id: string;
  readonly sourceFrames: readonly string[];
  readonly logicalFootprintCells: Readonly<{ width: number; height: number }>;
  readonly clearanceRadiusCells: NumericRange;
}

export interface TreeArchetypeRule {
  readonly numericId: number;
  readonly id: string;
  readonly habitatBiomeIds: readonly string[];
  readonly abundance: TreeAbundance;
  readonly sizeFamilyId: 'tree';
  readonly logicalFootprintCells: Readonly<{ width: 1; height: 1 }>;
  readonly exclusionRadiusCells: NumericRange;
}

export interface DecorationFamilyRule {
  readonly numericId: number;
  readonly id: string;
  readonly habitatBiomeIds: readonly string[];
  readonly habitatLandformIds: readonly string[];
  readonly frequency: ObjectFrequency;
  readonly sizeFamilyId: string;
  readonly logicalFootprintCells: Readonly<{ width: number; height: number }>;
  readonly exclusionRadiusCells: NumericRange;
}

export interface WorldRulesCatalog {
  readonly catalogVersion: 1;
  readonly tuningStatus: 'prototype';
  readonly templates: readonly WorldTemplateRule[];
  readonly landforms: readonly LandformRule[];
  readonly biomes: readonly BiomeRule[];
  readonly groundMaterials: readonly GroundMaterialRule[];
  readonly environmentThemes: readonly EnvironmentThemeRule[];
  readonly objectSizeFamilies: readonly ObjectSizeFamilyRule[];
  readonly treeArchetypes: readonly TreeArchetypeRule[];
  readonly decorationFamilies: readonly DecorationFamilyRule[];
}

export interface CatalogValidationIssue {
  readonly path: string;
  readonly message: string;
}

const templates: readonly WorldTemplateRule[] = [
  {
    id: 'continent',
    landShare: { min: 0.42, max: 0.64 },
    majorLandmasses: { min: 1, max: 1 },
    satelliteIslands: { min: 3, max: 10 },
    coastRoughness: { min: 0.3, max: 0.6 },
    enclosedWater: 'allowed',
  },
  {
    id: 'twin_continents',
    landShare: { min: 0.34, max: 0.58 },
    majorLandmasses: { min: 2, max: 2 },
    satelliteIslands: { min: 3, max: 12 },
    coastRoughness: { min: 0.35, max: 0.65 },
    enclosedWater: 'allowed',
  },
  {
    id: 'archipelago',
    landShare: { min: 0.22, max: 0.46 },
    majorLandmasses: { min: 0, max: 1 },
    satelliteIslands: { min: 12, max: 36 },
    coastRoughness: { min: 0.55, max: 0.9 },
    enclosedWater: 'allowed',
  },
  {
    id: 'island_chain',
    landShare: { min: 0.05, max: 0.28 },
    majorLandmasses: { min: 0, max: 1 },
    satelliteIslands: { min: 6, max: 18 },
    coastRoughness: { min: 0.5, max: 0.85 },
    enclosedWater: 'forbidden',
  },
  {
    id: 'inland_sea',
    landShare: { min: 0.55, max: 0.75 },
    majorLandmasses: { min: 1, max: 1 },
    satelliteIslands: { min: 0, max: 6 },
    coastRoughness: { min: 0.3, max: 0.65 },
    enclosedWater: 'required',
  },
  {
    id: 'ring_continent',
    landShare: { min: 0.45, max: 0.68 },
    majorLandmasses: { min: 1, max: 1 },
    satelliteIslands: { min: 0, max: 8 },
    coastRoughness: { min: 0.35, max: 0.7 },
    enclosedWater: 'required',
  },
  {
    id: 'fractured_coast',
    landShare: { min: 0.32, max: 0.58 },
    majorLandmasses: { min: 1, max: 3 },
    satelliteIslands: { min: 4, max: 18 },
    coastRoughness: { min: 0.75, max: 0.98 },
    enclosedWater: 'allowed',
  },
  {
    id: 'tri_continents',
    landShare: { min: 0.3, max: 0.56 },
    majorLandmasses: { min: 3, max: 3 },
    satelliteIslands: { min: 4, max: 14 },
    coastRoughness: { min: 0.55, max: 0.82 },
    enclosedWater: 'forbidden',
  },
];

const landforms: readonly LandformRule[] = [
  { id: 'deep_ocean', isWater: true },
  { id: 'open_ocean', isWater: true },
  { id: 'shallow_water', isWater: true },
  { id: 'coast', isWater: false },
  { id: 'lowland', isWater: false },
  { id: 'highland', isWater: false },
  { id: 'mountain', isWater: false },
];

const biomes: readonly BiomeRule[] = [
  biome('grassland', 'rich', 0.04, 0.1),
  biome('woodland', 'ordinary', 0.18, 0.28),
  biome('rainforest', 'rich', 0.22, 0.34),
  biome('savanna', 'ordinary', 0.08, 0.16),
  biome('desert', 'sparse', 0, 0.03),
  biome('wetland', 'rich', 0.06, 0.14),
  biome('tundra', 'sparse', 0, 0.05),
  biome('polar', 'sparse', 0, 0.01),
];

const groundMaterials: readonly GroundMaterialRule[] = [
  material('vegetated_soil', 16, 12, 12),
  material('bare_soil', 12, 10, 10),
  material('sand', 12, 10, 10),
  material('mud', 12, 10, 10),
  material('rock', 16, 12, 12),
  material('snow', 12, 10, 10),
  material('ice', 10, 8, 8),
];

const objectSizeFamilies: readonly ObjectSizeFamilyRule[] = [
  {
    id: 'micro_cover',
    sourceFrames: ['4x4', '8x8'],
    logicalFootprintCells: { width: 1, height: 1 },
    clearanceRadiusCells: { min: 0, max: 0 },
  },
  {
    id: 'small_object',
    sourceFrames: ['8x8', '12x12', '12x16'],
    logicalFootprintCells: { width: 1, height: 1 },
    clearanceRadiusCells: { min: 0, max: 2 },
  },
  {
    id: 'tree',
    sourceFrames: ['16x24', '24x24', '24x32', '24x40', '32x32', '32x40', '32x48'],
    logicalFootprintCells: { width: 1, height: 1 },
    clearanceRadiusCells: { min: 1, max: 4 },
  },
  {
    id: 'medium_landmark',
    sourceFrames: ['32x32', '48x48'],
    logicalFootprintCells: { width: 4, height: 4 },
    clearanceRadiusCells: { min: 2, max: 8 },
  },
  {
    id: 'large_landmark',
    sourceFrames: ['64x64', '96x96'],
    logicalFootprintCells: { width: 8, height: 8 },
    clearanceRadiusCells: { min: 4, max: 16 },
  },
];

const treeArchetypes: readonly TreeArchetypeRule[] = [
  tree(1, 'tree.grassland.archetype_01', 'grassland', 'primary', 2, 3),
  tree(2, 'tree.grassland.archetype_02', 'grassland', 'secondary', 2, 3),
  tree(3, 'tree.woodland.archetype_01', 'woodland', 'primary', 2, 4),
  tree(4, 'tree.woodland.archetype_02', 'woodland', 'primary', 2, 4),
  tree(5, 'tree.woodland.archetype_03', 'woodland', 'secondary', 2, 3),
  tree(6, 'tree.woodland.archetype_04', 'woodland', 'rare', 1, 2),
  tree(7, 'tree.rainforest.archetype_01', 'rainforest', 'primary', 2, 4),
  tree(8, 'tree.rainforest.archetype_02', 'rainforest', 'secondary', 3, 4),
  tree(9, 'tree.rainforest.archetype_03', 'rainforest', 'secondary', 2, 3),
  tree(10, 'tree.rainforest.archetype_04', 'rainforest', 'rare', 1, 2),
  tree(11, 'tree.savanna.archetype_01', 'savanna', 'primary', 2, 4),
  tree(12, 'tree.savanna.archetype_02', 'savanna', 'secondary', 2, 4),
  tree(13, 'tree.savanna.archetype_03', 'savanna', 'rare', 2, 3),
  tree(14, 'tree.desert.archetype_01', 'desert', 'primary', 3, 4),
  tree(15, 'tree.wetland.archetype_01', 'wetland', 'primary', 2, 4),
  tree(16, 'tree.wetland.archetype_02', 'wetland', 'secondary', 2, 3),
  tree(17, 'tree.wetland.archetype_03', 'wetland', 'secondary', 2, 4),
  tree(18, 'tree.tundra.archetype_01', 'tundra', 'primary', 2, 3),
  tree(19, 'tree.tundra.archetype_02', 'tundra', 'secondary', 1, 2),
];

const decorationFamilies: readonly DecorationFamilyRule[] = [
  decoration(
    20,
    'ground_cover.grass_tuft',
    ['grassland', 'woodland', 'savanna', 'wetland', 'tundra'],
    [],
    'micro_cover',
    'common',
    0,
    0,
  ),
  decoration(
    21,
    'ground_cover.flower',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'wetland'],
    [],
    'micro_cover',
    'uncommon',
    0,
    1,
  ),
  decoration(
    22,
    'ground_cover.moss_lichen',
    ['woodland', 'rainforest', 'wetland', 'tundra', 'polar'],
    [],
    'micro_cover',
    'common',
    0,
    0,
  ),
  decoration(
    23,
    'ground_cover.fern_low_leaf',
    ['woodland', 'rainforest', 'wetland'],
    [],
    'micro_cover',
    'common',
    0,
    1,
  ),
  decoration(
    24,
    'ground_cover.mushroom',
    ['woodland', 'rainforest', 'wetland'],
    [],
    'micro_cover',
    'uncommon',
    0,
    1,
  ),
  decoration(
    25,
    'vegetation.reed_high_grass',
    ['grassland', 'savanna', 'wetland'],
    [],
    'small_object',
    'common',
    0,
    1,
  ),
  decoration(
    26,
    'vegetation.bush',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra'],
    [],
    'small_object',
    'common',
    1,
    2,
  ),
  decoration(27, 'vegetation.cactus_succulent', ['desert'], [], 'small_object', 'uncommon', 1, 2),
  decoration(
    28,
    'ground_cover.small_stone',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra', 'polar'],
    [],
    'micro_cover',
    'common',
    0,
    1,
  ),
  decoration(
    29,
    'object.rock_cluster',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra', 'polar'],
    [],
    'small_object',
    'uncommon',
    1,
    3,
  ),
  decoration(
    30,
    'object.mineral_crystal',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra', 'polar'],
    ['highland', 'mountain'],
    'small_object',
    'rare',
    2,
    4,
  ),
  decoration(
    31,
    'object.deadwood_stump',
    ['woodland', 'rainforest', 'savanna', 'wetland', 'tundra'],
    [],
    'small_object',
    'uncommon',
    1,
    2,
  ),
  decoration(
    32,
    'object.dead_tree',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra'],
    [],
    'tree',
    'rare',
    2,
    4,
  ),
  decoration(33, 'ground_cover.coast_debris', [], ['coast'], 'micro_cover', 'uncommon', 0, 1),
  decoration(
    34,
    'landmark.medium_natural',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra', 'polar'],
    ['coast', 'lowland', 'highland', 'mountain'],
    'medium_landmark',
    'rare',
    4,
    8,
  ),
  decoration(
    35,
    'landmark.large_natural',
    ['grassland', 'woodland', 'rainforest', 'savanna', 'desert', 'wetland', 'tundra', 'polar'],
    ['coast', 'lowland', 'highland', 'mountain'],
    'large_landmark',
    'rare',
    8,
    16,
  ),
];

const worldRulesCatalog: WorldRulesCatalog = {
  catalogVersion: 1,
  tuningStatus: 'prototype',
  templates,
  landforms,
  biomes,
  groundMaterials,
  environmentThemes: [
    { id: 'none', isOverlay: false },
    { id: 'corruption', isOverlay: true },
  ],
  objectSizeFamilies,
  treeArchetypes,
  decorationFamilies,
};

const startupIssues = validateWorldRulesCatalog(worldRulesCatalog);
if (startupIssues.length > 0) {
  throw new Error(
    `Invalid built-in WorldRulesCatalog:\n${startupIssues.map(({ path, message }) => `${path}: ${message}`).join('\n')}`,
  );
}

export const WORLD_RULES_CATALOG: WorldRulesCatalog = deepFreeze(worldRulesCatalog);

export function validateWorldRulesCatalog(
  catalog: WorldRulesCatalog,
): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  checkUniqueIds(catalog.templates, 'templates', issues);
  checkUniqueIds(catalog.landforms, 'landforms', issues);
  checkUniqueIds(catalog.biomes, 'biomes', issues);
  checkUniqueIds(catalog.groundMaterials, 'groundMaterials', issues);
  checkUniqueIds(catalog.environmentThemes, 'environmentThemes', issues);
  checkUniqueIds(catalog.objectSizeFamilies, 'objectSizeFamilies', issues);
  checkUniqueIds(catalog.treeArchetypes, 'treeArchetypes', issues);
  checkUniqueIds(catalog.decorationFamilies, 'decorationFamilies', issues);
  checkUniqueNumericIds(
    [...catalog.treeArchetypes, ...catalog.decorationFamilies],
    'semanticFamilies',
    issues,
  );

  const biomeIds = new Set(catalog.biomes.map(({ id }) => id));
  const landformIds = new Set(catalog.landforms.map(({ id }) => id));
  const sizeFamilyIds = new Set(catalog.objectSizeFamilies.map(({ id }) => id));
  for (const [index, biomeRule] of catalog.biomes.entries()) {
    checkRange(biomeRule.treeCanopyCoverage, `biomes.${index}.treeCanopyCoverage`, issues, 0, 1);
    checkRange(
      biomeRule.activeCoverGroupShare,
      `biomes.${index}.activeCoverGroupShare`,
      issues,
      0,
      1,
    );
    checkRange(
      biomeRule.coverAnchorsPerActiveGroup,
      `biomes.${index}.coverAnchorsPerActiveGroup`,
      issues,
      0,
      4,
    );
  }
  for (const [index, materialRule] of catalog.groundMaterials.entries()) {
    for (const [field, value] of Object.entries({
      baseVariantMinimum: materialRule.baseVariantMinimum,
      materialGroupMinimum: materialRule.materialGroupMinimum,
      staticOverlayMinimum: materialRule.staticOverlayMinimum,
    })) {
      if (!Number.isInteger(value) || value <= 0)
        issues.push({
          path: `groundMaterials.${index}.${field}`,
          message: `Minimum must be a positive integer: ${value}`,
        });
    }
  }
  for (const [index, archetype] of catalog.treeArchetypes.entries()) {
    for (const biomeId of archetype.habitatBiomeIds) {
      if (!biomeIds.has(biomeId))
        issues.push({
          path: `treeArchetypes.${index}.habitatBiomeIds`,
          message: `Unknown biome: ${biomeId}`,
        });
    }
    if (!sizeFamilyIds.has(archetype.sizeFamilyId))
      issues.push({
        path: `treeArchetypes.${index}.sizeFamilyId`,
        message: `Unknown size family: ${archetype.sizeFamilyId}`,
      });
    checkRange(
      archetype.exclusionRadiusCells,
      `treeArchetypes.${index}.exclusionRadiusCells`,
      issues,
      0,
      Number.POSITIVE_INFINITY,
    );
  }
  for (const [index, family] of catalog.decorationFamilies.entries()) {
    checkReferences(
      family.habitatBiomeIds,
      biomeIds,
      `decorationFamilies.${index}.habitatBiomeIds`,
      'biome',
      issues,
    );
    checkReferences(
      family.habitatLandformIds,
      landformIds,
      `decorationFamilies.${index}.habitatLandformIds`,
      'landform',
      issues,
    );
    if (family.habitatBiomeIds.length === 0 && family.habitatLandformIds.length === 0) {
      issues.push({
        path: `decorationFamilies.${index}`,
        message: 'At least one habitat constraint is required',
      });
    }
    if (!sizeFamilyIds.has(family.sizeFamilyId)) {
      issues.push({
        path: `decorationFamilies.${index}.sizeFamilyId`,
        message: `Unknown size family: ${family.sizeFamilyId}`,
      });
    }
    checkRange(
      family.exclusionRadiusCells,
      `decorationFamilies.${index}.exclusionRadiusCells`,
      issues,
      0,
      Number.POSITIVE_INFINITY,
    );
  }

  for (const [index, template] of catalog.templates.entries()) {
    checkRange(template.landShare, `templates.${index}.landShare`, issues, 0, 1);
    checkRange(
      template.majorLandmasses,
      `templates.${index}.majorLandmasses`,
      issues,
      0,
      Number.POSITIVE_INFINITY,
    );
    checkRange(
      template.satelliteIslands,
      `templates.${index}.satelliteIslands`,
      issues,
      0,
      Number.POSITIVE_INFINITY,
    );
    checkRange(template.coastRoughness, `templates.${index}.coastRoughness`, issues, 0, 1);
  }
  return issues;
}

function tree(
  numericId: number,
  id: string,
  biomeId: string,
  abundance: TreeAbundance,
  exclusionMin: number,
  exclusionMax: number,
): TreeArchetypeRule {
  return {
    numericId,
    id,
    habitatBiomeIds: [biomeId],
    abundance,
    sizeFamilyId: 'tree',
    logicalFootprintCells: { width: 1, height: 1 },
    exclusionRadiusCells: { min: exclusionMin, max: exclusionMax },
  };
}

function biome(
  id: string,
  decorationDensity: DensityBand,
  treeCanopyMin: number,
  treeCanopyMax: number,
): BiomeRule {
  const densityRules: Record<
    DensityBand,
    Readonly<{ share: NumericRange; anchors: NumericRange }>
  > = {
    sparse: { share: { min: 0.2, max: 0.35 }, anchors: { min: 1, max: 1 } },
    ordinary: { share: { min: 0.4, max: 0.55 }, anchors: { min: 1, max: 2 } },
    rich: { share: { min: 0.55, max: 0.75 }, anchors: { min: 2, max: 4 } },
  };
  const density = densityRules[decorationDensity];
  return {
    id,
    decorationDensity,
    treeCanopyCoverage: { min: treeCanopyMin, max: treeCanopyMax },
    activeCoverGroupShare: density.share,
    coverAnchorsPerActiveGroup: density.anchors,
  };
}

function material(
  id: string,
  baseVariantMinimum: number,
  materialGroupMinimum: number,
  staticOverlayMinimum: number,
): GroundMaterialRule {
  return { id, baseVariantMinimum, materialGroupMinimum, staticOverlayMinimum };
}

function decoration(
  numericId: number,
  id: string,
  habitatBiomeIds: readonly string[],
  habitatLandformIds: readonly string[],
  sizeFamilyId: string,
  frequency: ObjectFrequency,
  exclusionMin: number,
  exclusionMax: number,
): DecorationFamilyRule {
  const footprintBySizeFamily: Record<string, Readonly<{ width: number; height: number }>> = {
    micro_cover: { width: 1, height: 1 },
    small_object: { width: 1, height: 1 },
    tree: { width: 1, height: 1 },
    medium_landmark: { width: 4, height: 4 },
    large_landmark: { width: 8, height: 8 },
  };
  const logicalFootprintCells = footprintBySizeFamily[sizeFamilyId];
  if (logicalFootprintCells === undefined) throw new Error(`Unknown size family: ${sizeFamilyId}`);
  return {
    numericId,
    id,
    habitatBiomeIds,
    habitatLandformIds,
    frequency,
    sizeFamilyId,
    logicalFootprintCells,
    exclusionRadiusCells: { min: exclusionMin, max: exclusionMax },
  };
}

function checkReferences(
  references: readonly string[],
  knownIds: ReadonlySet<string>,
  path: string,
  kind: string,
  issues: CatalogValidationIssue[],
): void {
  for (const reference of references) {
    if (!knownIds.has(reference)) issues.push({ path, message: `Unknown ${kind}: ${reference}` });
  }
}

function checkUniqueIds(
  entries: readonly Readonly<{ id: string }>[],
  path: string,
  issues: CatalogValidationIssue[],
): void {
  const ids = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (ids.has(entry.id))
      issues.push({ path: `${path}.${index}.id`, message: `Duplicate id: ${entry.id}` });
    ids.add(entry.id);
  }
}

function checkUniqueNumericIds(
  entries: readonly Readonly<{ numericId: number }>[],
  path: string,
  issues: CatalogValidationIssue[],
): void {
  const ids = new Set<number>();
  for (const [index, entry] of entries.entries()) {
    if (!Number.isInteger(entry.numericId) || entry.numericId <= 0 || ids.has(entry.numericId)) {
      issues.push({
        path: `${path}.${index}.numericId`,
        message: `Numeric id must be unique and positive: ${entry.numericId}`,
      });
    }
    ids.add(entry.numericId);
  }
}

function checkRange(
  range: NumericRange,
  path: string,
  issues: CatalogValidationIssue[],
  allowedMin: number,
  allowedMax: number,
): void {
  if (range.min < allowedMin || range.max > allowedMax || range.min > range.max) {
    issues.push({ path, message: `Invalid range: ${range.min}..${range.max}` });
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
