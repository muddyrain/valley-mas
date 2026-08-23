import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import type { VisualBundleInput } from './VisualCatalog';
import type { VisualAsset, VisualManifest } from './VisualManifestSchema';

type AssetCategory = VisualAsset['category'];
type Frame = VisualAsset['frames'][number];

const pageByCategory: Record<AssetCategory, VisualManifest['atlases'][number]> = {
  'terrain-ground': page('terrain-ground-01', 'terrain-ground', 256),
  'terrain-transition': page('terrain-transition-01', 'terrain-transition', 128),
  water: page('water-01', 'water', 256),
  vegetation: page('vegetation-01', 'vegetation', 512),
  'ground-decoration': page('ground-decoration-01', 'ground-decoration', 256),
  landmark: page('landmark-01', 'landmark', 256),
  effects: page('effects-01', 'effects', 256),
  'lod-world': page('lod-world-01', 'lod-world', 128),
};

const cursors = new Map<AssetCategory, { x: number; y: number; rowHeight: number }>();
const assets: VisualAsset[] = [];

const treeShadowId = 'effects.shadow.tree.generic.v01';
const treeLodId = 'lod_world.vegetation.tree.generic.v01';

assets.push(
  asset({
    id: treeShadowId,
    category: 'effects',
    kind: 'effect',
    size: [16, 24],
    renderLayer: 'shadow',
  }),
  asset({
    id: treeLodId,
    category: 'lod-world',
    kind: 'sprite',
    size: [4, 4],
    renderLayer: 'upright',
  }),
);

for (const material of WORLD_RULES_CATALOG.groundMaterials) {
  addGroundSet(material.id, 'base', material.baseVariantMinimum);
  addGroundSet(material.id, 'group', material.materialGroupMinimum);
  addGroundSet(material.id, 'overlay', material.staticOverlayMinimum);
}

for (let topologyCode = 0; topologyCode < 47; topologyCode += 1) {
  for (const edgeRhythm of [1, 2, 3] as const) {
    assets.push(
      asset({
        id: `terrain.transition.mask_${pad(topologyCode)}.rhythm_${edgeRhythm}.v01`,
        category: 'terrain-transition',
        kind: 'tile',
        size: [4, 4],
        renderLayer: 'terrain-transition',
        autotile: { topologyCode, edgeRhythm },
      }),
    );
  }
}

for (const [landformId, frameCount] of [
  ['deep_ocean', 1],
  ['open_ocean', 3],
  ['shallow_water', 4],
  ['coast', 3],
] as const) {
  const animated = frameCount > 1;
  assets.push(
    asset({
      id: `water.${landformId}.${animated ? 'surface' : 'base'}.v01`,
      category: 'water',
      kind: 'tile',
      size: [4, 4],
      frameCount,
      renderLayer: animated ? 'water-effects' : 'terrain-base',
      landforms: [landformId],
      animations: animated
        ? [
            {
              stateId: landformId === 'coast' ? 'shore_break' : 'surface_shift',
              frameIndices: Array.from({ length: frameCount }, (_, index) => index),
              fps: landformId === 'coast' ? 6 : 4,
              phase: 'seeded',
            },
          ]
        : [],
    }),
  );
}

for (const archetype of WORLD_RULES_CATALOG.treeArchetypes) {
  for (const [age, heights] of [
    ['sapling', ['compact', 'standard']],
    ['mature', ['compact', 'standard', 'tall']],
    ['old', ['compact', 'standard', 'tall']],
  ] as const) {
    for (const height of heights) {
      assets.push(
        asset({
          id: `vegetation.${archetype.id}.${age}.${height}.v01`,
          category: 'vegetation',
          kind: 'sprite',
          size: [16, 24],
          renderLayer: 'upright',
          semanticFamilies: [archetype.id],
          biomes: [...archetype.habitatBiomeIds],
          treeArchetypes: [archetype.id],
          ages: [age],
          heights: [height],
          shadowMaskId: treeShadowId,
          lodWorldId: treeLodId,
          clearance: 2,
        }),
      );
    }
  }
}

for (const family of WORLD_RULES_CATALOG.decorationFamilies) {
  const category = decorationCategory(family.id);
  const [width, height] = decorationSize(family.sizeFamilyId);
  assets.push(
    asset({
      id: `${family.id}.contract.v01`,
      category,
      kind: 'sprite',
      size: [width, height],
      renderLayer: category === 'ground-decoration' ? 'low-cover' : 'upright',
      semanticFamilies: [family.id],
      biomes: [...family.habitatBiomeIds],
      landforms: [...family.habitatLandformIds],
      footprint: [family.logicalFootprintCells.width, family.logicalFootprintCells.height],
      clearance: family.exclusionRadiusCells.min,
    }),
  );
}

assets.push(
  asset({
    id: 'effects.corruption.focus.v01',
    category: 'effects',
    kind: 'effect',
    size: [16, 16],
    frameCount: 4,
    renderLayer: 'water-effects',
    environmentThemes: ['corruption'],
    animations: [
      {
        stateId: 'pulse',
        frameIndices: [0, 1, 2, 3],
        fps: 4,
        phase: 'seeded',
      },
    ],
  }),
  asset({
    id: 'lod_world.terrain.biome_patch.v01',
    category: 'lod-world',
    kind: 'tile',
    size: [4, 4],
    renderLayer: 'terrain-base',
  }),
);

const manifest: VisualManifest = {
  schemaVersion: 1,
  worldRulesCatalogVersion: 1,
  visualCatalogVersion: 'p0-contract-1',
  atlases: Object.values(pageByCategory),
  palettes: [
    {
      id: 'world.base',
      colors: {
        darkest: '#172A32',
        shadow: '#2E4648',
        neutral: '#66715D',
        midtone: '#77945A',
        highlight: '#B5C87A',
        water_deep: '#234968',
        water_mid: '#32769A',
        water_light: '#63AFC0',
        coast_sand: '#D7C987',
        ground_grass: '#82A85A',
        ground_woodland: '#4F7A4D',
        ground_rainforest: '#376A48',
        ground_savanna: '#A39B52',
        ground_desert: '#C49A5A',
        ground_wetland: '#5F8062',
        ground_tundra: '#879A80',
        ground_polar: '#C5DAD0',
        highland: '#69766B',
        mountain: '#4C5655',
        accent: '#D7A849',
      },
    },
  ],
  assets,
};

export const MAP_VISUAL_CONTRACT_BUNDLE = {
  manifest,
  atlasSources: Object.fromEntries(
    manifest.atlases.map(({ id, image }) => [id, `/map/p0/${image.split('/').at(-1)}`]),
  ),
} satisfies VisualBundleInput;

function page(
  id: string,
  category: AssetCategory,
  size: number,
): VisualManifest['atlases'][number] {
  return {
    id,
    category,
    image: `map/p0/${id}.png`,
    width: size,
    height: size,
    padding: 2,
    pixelScale: 1,
    sampling: 'nearest',
    mipmaps: false,
    compression: 'lossless',
  };
}

function addGroundSet(materialId: string, role: string, count: number): void {
  for (let index = 1; index <= count; index += 1) {
    assets.push(
      asset({
        id: `terrain.ground.${materialId}.${role}_${pad(index)}.v01`,
        category: 'terrain-ground',
        kind: 'tile',
        size: role === 'group' ? [16, 16] : [4, 4],
        renderLayer: role === 'overlay' ? 'terrain-transition' : 'terrain-base',
        groundMaterials: [materialId],
        forms: [`material_${role}`],
      }),
    );
  }
}

function asset(input: {
  id: string;
  category: AssetCategory;
  kind: VisualAsset['kind'];
  size: readonly [number, number];
  frameCount?: number;
  renderLayer: VisualAsset['renderLayer'];
  semanticFamilies?: string[];
  landforms?: string[];
  biomes?: string[];
  groundMaterials?: string[];
  environmentThemes?: string[];
  treeArchetypes?: string[];
  ages?: VisualAsset['tags']['ages'];
  heights?: VisualAsset['tags']['heights'];
  forms?: string[];
  footprint?: readonly [number, number];
  clearance?: number;
  shadowMaskId?: string;
  lodWorldId?: string;
  autotile?: VisualAsset['autotile'];
  animations?: VisualAsset['animations'];
}): VisualAsset {
  const [width, height] = input.size;
  const frames = Array.from({ length: input.frameCount ?? 1 }, () =>
    place(input.category, width, height),
  );
  const sprite = input.kind === 'sprite';
  const bottomCentered = sprite || input.renderLayer === 'shadow';
  const clearance = input.clearance ?? 0;
  return {
    id: input.id,
    category: input.category,
    kind: input.kind,
    atlasPageId: pageByCategory[input.category].id,
    frames,
    sourceCanvas: { width, height },
    trimmed: false,
    trimOffset: { x: 0, y: 0 },
    anchor: bottomCentered ? { x: width / 2, y: height } : { x: 0, y: 0 },
    logicalFootprint: {
      widthCells: input.footprint?.[0] ?? 1,
      heightCells: input.footprint?.[1] ?? 1,
    },
    clearance: {
      leftCells: clearance,
      rightCells: clearance,
      topCells: clearance,
      bottomCells: clearance,
    },
    renderLayer: input.renderLayer,
    sortBaselinePx: bottomCentered ? height : 0,
    maxOverflow: { leftPx: 0, rightPx: 0, topPx: 0, bottomPx: 0 },
    paletteId: 'world.base',
    colorway: 'base',
    variantWeight: 1,
    shadowMaskId: input.shadowMaskId,
    lodWorldId: input.lodWorldId,
    autotile: input.autotile,
    tags: {
      semanticFamilies: input.semanticFamilies ?? [],
      landforms: input.landforms ?? [],
      biomes: input.biomes ?? [],
      groundMaterials: input.groundMaterials ?? [],
      environmentThemes: input.environmentThemes ?? ['none'],
      treeArchetypes: input.treeArchetypes ?? [],
      ages: input.ages ?? [],
      heights: input.heights ?? [],
      forms: input.forms ?? [],
    },
    animations: input.animations ?? [],
  };
}

function place(category: AssetCategory, width: number, height: number): Frame {
  const pageSize = pageByCategory[category].width;
  const cursor = cursors.get(category) ?? { x: 2, y: 2, rowHeight: 0 };
  if (cursor.x + width > pageSize - 2) {
    cursor.x = 2;
    cursor.y += cursor.rowHeight + 2;
    cursor.rowHeight = 0;
  }
  if (cursor.y + height > pageSize - 2)
    throw new Error(`Map visual contract ${category} atlas is too small`);
  const frame = { x: cursor.x, y: cursor.y, width, height };
  cursor.x += width + 2;
  cursor.rowHeight = Math.max(cursor.rowHeight, height);
  cursors.set(category, cursor);
  return frame;
}

function decorationCategory(id: string): AssetCategory {
  if (id.startsWith('landmark.')) return 'landmark';
  if (id.startsWith('vegetation.') || id === 'object.dead_tree') return 'vegetation';
  return 'ground-decoration';
}

function decorationSize(sizeFamilyId: string): readonly [number, number] {
  if (sizeFamilyId === 'micro_cover') return [8, 8];
  if (sizeFamilyId === 'small_object') return [12, 16];
  if (sizeFamilyId === 'tree') return [16, 24];
  if (sizeFamilyId === 'medium_landmark') return [32, 32];
  return [64, 64];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
