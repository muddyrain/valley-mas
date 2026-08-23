import { z } from 'zod';

import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';

const assetCategorySchema = z.enum([
  'terrain-ground',
  'terrain-transition',
  'water',
  'vegetation',
  'ground-decoration',
  'landmark',
  'effects',
  'lod-world',
]);

const renderLayerSchema = z.enum([
  'terrain-base',
  'terrain-transition',
  'low-cover',
  'shadow',
  'upright',
  'foreground',
  'water-effects',
  'selection',
]);

const positiveSizeSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const frameSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const atlasPageSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*-[0-9]{2}$/),
    category: assetCategorySchema,
    image: z.string().regex(/^(?!\/)(?!.*\.\.\/)[a-z0-9/_-]+\.png$/),
    width: z.number().int().positive().max(2048),
    height: z.number().int().positive().max(2048),
    padding: z.number().int().min(2),
    pixelScale: z.literal(1),
    sampling: z.literal('nearest'),
    mipmaps: z.literal(false),
    compression: z.literal('lossless'),
  })
  .strict();

const paletteSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
    colors: z
      .record(z.string().regex(/^#[0-9A-F]{6}$/))
      .refine(
        (colors) => Object.keys(colors).length > 0,
        'Palette must contain at least one named color',
      ),
  })
  .strict();

const animationSchema = z
  .object({
    stateId: z.string().regex(/^[a-z][a-z0-9_]*$/),
    frameIndices: z.array(z.number().int().nonnegative()).min(1),
    fps: z.number().positive().max(30),
    phase: z.enum(['synchronized', 'seeded', 'randomized']),
  })
  .strict();

const assetSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\.v[0-9]{2}$/),
    category: assetCategorySchema,
    kind: z.enum(['tile', 'sprite', 'effect']),
    atlasPageId: z.string(),
    frames: z.array(frameSchema).min(1),
    sourceCanvas: positiveSizeSchema,
    trimmed: z.boolean(),
    trimOffset: z
      .object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })
      .strict(),
    anchor: z
      .object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })
      .strict(),
    logicalFootprint: z
      .object({
        widthCells: z.number().int().positive(),
        heightCells: z.number().int().positive(),
      })
      .strict(),
    clearance: z
      .object({
        leftCells: z.number().int().nonnegative(),
        rightCells: z.number().int().nonnegative(),
        topCells: z.number().int().nonnegative(),
        bottomCells: z.number().int().nonnegative(),
      })
      .strict(),
    renderLayer: renderLayerSchema,
    sortBaselinePx: z.number().int().nonnegative(),
    maxOverflow: z
      .object({
        leftPx: z.number().int().nonnegative(),
        rightPx: z.number().int().nonnegative(),
        topPx: z.number().int().nonnegative(),
        bottomPx: z.number().int().nonnegative(),
      })
      .strict(),
    paletteId: z.string(),
    colorway: z.string().regex(/^[a-z][a-z0-9_]*$/),
    variantWeight: z.number().positive(),
    shadowMaskId: z.string().optional(),
    lodWorldId: z.string().optional(),
    autotile: z
      .object({
        topologyCode: z.number().int().min(0).max(46),
        edgeRhythm: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      })
      .strict()
      .optional(),
    tags: z
      .object({
        semanticFamilies: z.array(z.string()),
        landforms: z.array(z.string()),
        biomes: z.array(z.string()),
        groundMaterials: z.array(z.string()),
        environmentThemes: z.array(z.string()),
        treeArchetypes: z.array(z.string()),
        ages: z.array(z.enum(['sapling', 'mature', 'old'])),
        heights: z.array(z.enum(['compact', 'standard', 'tall'])),
        forms: z.array(z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/)),
      })
      .strict(),
    animations: z.array(animationSchema),
  })
  .strict();

const visualManifestBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    worldRulesCatalogVersion: z.literal(1),
    visualCatalogVersion: z.string().min(1),
    atlases: z.array(atlasPageSchema).min(1),
    palettes: z.array(paletteSchema).min(1),
    assets: z.array(assetSchema).min(1),
  })
  .strict();

type VisualManifestData = z.infer<typeof visualManifestBaseSchema>;

export const visualManifestSchema = visualManifestBaseSchema.superRefine(validateCrossReferences);

export type VisualManifest = z.infer<typeof visualManifestSchema>;
export type VisualAsset = VisualManifest['assets'][number];

export function parseVisualManifest(input: unknown): VisualManifest {
  return visualManifestSchema.parse(input);
}

function validateCrossReferences(manifest: VisualManifestData, context: z.RefinementCtx): void {
  checkUnique(manifest.atlases, 'atlases', context);
  checkUnique(manifest.palettes, 'palettes', context);
  checkUnique(manifest.assets, 'assets', context);

  const atlasById = new Map(manifest.atlases.map((atlas) => [atlas.id, atlas]));
  const paletteIds = new Set(manifest.palettes.map(({ id }) => id));
  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const biomeIds = new Set(WORLD_RULES_CATALOG.biomes.map(({ id }) => id));
  const landformIds = new Set(WORLD_RULES_CATALOG.landforms.map(({ id }) => id));
  const groundMaterialIds = new Set(WORLD_RULES_CATALOG.groundMaterials.map(({ id }) => id));
  const environmentThemeIds = new Set(WORLD_RULES_CATALOG.environmentThemes.map(({ id }) => id));
  const treeArchetypeIds = new Set(WORLD_RULES_CATALOG.treeArchetypes.map(({ id }) => id));
  const semanticFamilyIds = new Set([
    ...treeArchetypeIds,
    ...WORLD_RULES_CATALOG.decorationFamilies.map(({ id }) => id),
  ]);

  for (const [assetIndex, asset] of manifest.assets.entries()) {
    const atlas = atlasById.get(asset.atlasPageId);
    if (atlas === undefined) {
      addIssue(
        context,
        ['assets', assetIndex, 'atlasPageId'],
        `Unknown atlas page: ${asset.atlasPageId}`,
      );
    } else {
      if (atlas.category !== asset.category)
        addIssue(
          context,
          ['assets', assetIndex, 'category'],
          `Asset category must match atlas category ${atlas.category}`,
        );
      for (const [frameIndex, frame] of asset.frames.entries()) {
        if (frame.x + frame.width > atlas.width || frame.y + frame.height > atlas.height) {
          addIssue(
            context,
            ['assets', assetIndex, 'frames', frameIndex],
            `Frame exceeds atlas bounds ${atlas.width}x${atlas.height}`,
          );
        }
      }
    }
    if (!paletteIds.has(asset.paletteId))
      addIssue(context, ['assets', assetIndex, 'paletteId'], `Unknown palette: ${asset.paletteId}`);
    if (asset.anchor.x > asset.sourceCanvas.width || asset.anchor.y > asset.sourceCanvas.height) {
      addIssue(
        context,
        ['assets', assetIndex, 'anchor'],
        'Anchor must remain inside the source canvas',
      );
    }
    if (
      asset.kind === 'sprite' &&
      (asset.anchor.x !== asset.sourceCanvas.width / 2 ||
        asset.anchor.y !== asset.sourceCanvas.height)
    ) {
      addIssue(
        context,
        ['assets', assetIndex, 'anchor'],
        'Sprites must use an integer bottom-center anchor',
      );
    }
    if (asset.kind === 'tile' && (asset.anchor.x !== 0 || asset.anchor.y !== 0)) {
      addIssue(context, ['assets', assetIndex, 'anchor'], 'Tiles must use a top-left anchor');
    }
    if (asset.kind === 'tile' && asset.trimmed) {
      addIssue(context, ['assets', assetIndex, 'trimmed'], 'Tiles cannot be trimmed');
    }
    if (asset.sourceCanvas.width % 4 !== 0 || asset.sourceCanvas.height % 4 !== 0) {
      addIssue(
        context,
        ['assets', assetIndex, 'sourceCanvas'],
        'Source canvas dimensions must be multiples of 4px',
      );
    }
    if (asset.sortBaselinePx > asset.sourceCanvas.height) {
      addIssue(
        context,
        ['assets', assetIndex, 'sortBaselinePx'],
        'Sort baseline must remain inside the source canvas',
      );
    }
    if (!asset.trimmed && (asset.trimOffset.x !== 0 || asset.trimOffset.y !== 0)) {
      addIssue(
        context,
        ['assets', assetIndex, 'trimOffset'],
        'Untrimmed assets must use a zero trim offset',
      );
    }
    if (
      !asset.trimmed &&
      asset.frames.some(
        (frame) =>
          frame.width !== asset.sourceCanvas.width || frame.height !== asset.sourceCanvas.height,
      )
    ) {
      addIssue(
        context,
        ['assets', assetIndex, 'frames'],
        'Untrimmed frame size must match its source canvas',
      );
    }
    if (
      asset.trimmed &&
      asset.frames.some(
        (frame) =>
          asset.trimOffset.x + frame.width > asset.sourceCanvas.width ||
          asset.trimOffset.y + frame.height > asset.sourceCanvas.height,
      )
    ) {
      addIssue(
        context,
        ['assets', assetIndex, 'trimOffset'],
        'Trimmed frames must fit inside the source canvas at their trim offset',
      );
    }
    if (
      asset.trimmed &&
      asset.frames.some(
        (frame) =>
          frame.width !== asset.frames[0]?.width || frame.height !== asset.frames[0]?.height,
      )
    ) {
      addIssue(
        context,
        ['assets', assetIndex, 'frames'],
        'Trimmed animation frames must share one union trim rectangle',
      );
    }
    if (
      (asset.category === 'terrain-ground' || asset.category === 'terrain-transition') &&
      (asset.kind !== 'tile' || asset.trimmed)
    ) {
      addIssue(context, ['assets', assetIndex], 'Terrain assets must be untrimmed tiles');
    }
    if (asset.category === 'terrain-transition' && asset.autotile === undefined) {
      addIssue(
        context,
        ['assets', assetIndex, 'autotile'],
        'Terrain transition assets require a 47-topology code and one of three edge rhythms',
      );
    }
    if (asset.category !== 'terrain-transition' && asset.autotile !== undefined) {
      addIssue(
        context,
        ['assets', assetIndex, 'autotile'],
        'Only terrain transition assets can declare autotile metadata',
      );
    }
    for (const [animationIndex, animation] of asset.animations.entries()) {
      if (animation.frameIndices.some((frameIndex) => frameIndex >= asset.frames.length)) {
        addIssue(
          context,
          ['assets', assetIndex, 'animations', animationIndex, 'frameIndices'],
          'Animation references a missing frame',
        );
      }
    }
    checkSemanticTags(
      asset.tags.semanticFamilies,
      semanticFamilyIds,
      ['assets', assetIndex, 'tags', 'semanticFamilies'],
      context,
    );
    checkSemanticTags(
      asset.tags.landforms,
      landformIds,
      ['assets', assetIndex, 'tags', 'landforms'],
      context,
    );
    checkSemanticTags(
      asset.tags.biomes,
      biomeIds,
      ['assets', assetIndex, 'tags', 'biomes'],
      context,
    );
    checkSemanticTags(
      asset.tags.groundMaterials,
      groundMaterialIds,
      ['assets', assetIndex, 'tags', 'groundMaterials'],
      context,
    );
    checkSemanticTags(
      asset.tags.environmentThemes,
      environmentThemeIds,
      ['assets', assetIndex, 'tags', 'environmentThemes'],
      context,
    );
    checkSemanticTags(
      asset.tags.treeArchetypes,
      treeArchetypeIds,
      ['assets', assetIndex, 'tags', 'treeArchetypes'],
      context,
    );
    if (
      asset.id.startsWith('vegetation.tree.') &&
      (asset.tags.semanticFamilies.length !== 1 ||
        asset.tags.treeArchetypes.length !== 1 ||
        asset.tags.ages.length !== 1 ||
        asset.tags.heights.length !== 1 ||
        asset.tags.semanticFamilies[0] !== asset.tags.treeArchetypes[0])
    ) {
      addIssue(
        context,
        ['assets', assetIndex, 'tags'],
        'Tree assets require one archetype, one age, and one height tag',
      );
    }
    validateAssetReference(
      asset.shadowMaskId,
      'shadowMaskId',
      'effects',
      asset,
      assetIndex,
      assetById,
      context,
    );
    validateAssetReference(
      asset.lodWorldId,
      'lodWorldId',
      'lod-world',
      asset,
      assetIndex,
      assetById,
      context,
    );
  }
  checkAtlasFramePadding(manifest, context);
}

function validateAssetReference(
  referenceId: string | undefined,
  field: 'shadowMaskId' | 'lodWorldId',
  expectedCategory: z.infer<typeof assetCategorySchema>,
  asset: z.infer<typeof assetSchema>,
  assetIndex: number,
  assetById: ReadonlyMap<string, z.infer<typeof assetSchema>>,
  context: z.RefinementCtx,
): void {
  if (referenceId === undefined) return;
  const referenced = assetById.get(referenceId);
  if (referenced === undefined) {
    addIssue(context, ['assets', assetIndex, field], `Unknown asset: ${referenceId}`);
    return;
  }
  if (referenced.category !== expectedCategory)
    addIssue(
      context,
      ['assets', assetIndex, field],
      `Referenced asset must use category ${expectedCategory}`,
    );
  if (
    field === 'shadowMaskId' &&
    (referenced.sourceCanvas.width !== asset.sourceCanvas.width ||
      referenced.sourceCanvas.height !== asset.sourceCanvas.height ||
      referenced.anchor.x !== asset.anchor.x ||
      referenced.anchor.y !== asset.anchor.y)
  ) {
    addIssue(
      context,
      ['assets', assetIndex, field],
      'Shadow mask must share the source canvas and anchor',
    );
  }
  if (field === 'shadowMaskId' && variantSuffix(referenced.id) !== variantSuffix(asset.id)) {
    addIssue(context, ['assets', assetIndex, field], 'Shadow mask must use the same variant id');
  }
}

function checkAtlasFramePadding(manifest: VisualManifestData, context: z.RefinementCtx): void {
  const atlasById = new Map(manifest.atlases.map((atlas) => [atlas.id, atlas]));
  const placedFrames = new Map<
    string,
    { frame: z.infer<typeof frameSchema>; assetIndex: number; frameIndex: number }[]
  >();
  for (const [assetIndex, asset] of manifest.assets.entries()) {
    const placements = placedFrames.get(asset.atlasPageId) ?? [];
    for (const [frameIndex, frame] of asset.frames.entries())
      placements.push({ frame, assetIndex, frameIndex });
    placedFrames.set(asset.atlasPageId, placements);
  }
  for (const [atlasId, placements] of placedFrames) {
    const padding = atlasById.get(atlasId)?.padding;
    if (padding === undefined) continue;
    for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
      const left = placements[leftIndex];
      if (left === undefined) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
        const right = placements[rightIndex];
        if (right !== undefined && framesViolatePadding(left.frame, right.frame, padding)) {
          addIssue(
            context,
            ['assets', right.assetIndex, 'frames', right.frameIndex],
            `Atlas frames require at least ${padding}px transparent padding`,
          );
        }
      }
    }
  }
}

function framesViolatePadding(
  left: z.infer<typeof frameSchema>,
  right: z.infer<typeof frameSchema>,
  padding: number,
): boolean {
  return (
    left.x < right.x + right.width + padding &&
    left.x + left.width + padding > right.x &&
    left.y < right.y + right.height + padding &&
    left.y + left.height + padding > right.y
  );
}

function variantSuffix(id: string): string | undefined {
  return id.match(/\.v[0-9]{2}$/)?.[0];
}

function checkSemanticTags(
  tags: readonly string[],
  knownIds: ReadonlySet<string>,
  path: (string | number)[],
  context: z.RefinementCtx,
): void {
  for (const [index, tag] of tags.entries()) {
    if (!knownIds.has(tag)) addIssue(context, [...path, index], `Unknown semantic id: ${tag}`);
  }
}

function checkUnique(
  entries: readonly Readonly<{ id: string }>[],
  path: string,
  context: z.RefinementCtx,
): void {
  const ids = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (ids.has(entry.id)) addIssue(context, [path, index, 'id'], `Duplicate id: ${entry.id}`);
    ids.add(entry.id);
  }
}

function addIssue(context: z.RefinementCtx, path: (string | number)[], message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message });
}
