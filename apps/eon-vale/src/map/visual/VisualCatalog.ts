import type { VisualAsset, VisualManifest } from './VisualManifestSchema';
import { parseVisualManifest } from './VisualManifestSchema';

declare const visualHandleBrand: unique symbol;
export type VisualHandle = number & { readonly [visualHandleBrand]: true };

export interface VisualBundleInput {
  readonly manifest: unknown;
  readonly atlasSources: Readonly<Record<string, string>>;
}

export interface DecodedAtlasPage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export type AtlasDecoder = (source: string) => Promise<DecodedAtlasPage>;

export interface VisualQuery {
  readonly category: VisualAsset['category'];
  readonly semanticFamilyId?: string;
  readonly landformId?: string;
  readonly biomeId?: string;
  readonly groundMaterialId?: string;
  readonly environmentThemeId?: string;
  readonly treeArchetypeId?: string;
  readonly age?: VisualAsset['tags']['ages'][number];
  readonly height?: VisualAsset['tags']['heights'][number];
  readonly form?: string;
  readonly topologyCode?: number;
  readonly edgeRhythm?: 1 | 2 | 3;
}

export interface ProjectionVisualMetadata {
  readonly assetId: string;
  readonly kind: VisualAsset['kind'];
  readonly renderLayer: VisualAsset['renderLayer'];
  readonly logicalFootprint: VisualAsset['logicalFootprint'];
  readonly clearance: VisualAsset['clearance'];
  readonly sortBaselinePx: number;
  readonly maxOverflow: VisualAsset['maxOverflow'];
  readonly shadowMask: VisualHandle | null;
  readonly lodWorld: VisualHandle | null;
}

export interface RenderVisualMetadata {
  readonly atlasSource: string;
  readonly frames: VisualAsset['frames'];
  readonly sourceCanvas: VisualAsset['sourceCanvas'];
  readonly trimOffset: VisualAsset['trimOffset'];
  readonly anchor: VisualAsset['anchor'];
  readonly animations: VisualAsset['animations'];
}

export interface VisualCatalog {
  readonly version: string;
  resolve(query: VisualQuery, variantSeed: number): VisualHandle | null;
  getProjectionMetadata(handle: VisualHandle): ProjectionVisualMetadata;
  getRenderMetadata(handle: VisualHandle): RenderVisualMetadata;
  getPaletteColor(paletteId: string, role: string): string;
}

export async function createVisualCatalog(
  bundle: VisualBundleInput,
  decodeAtlas: AtlasDecoder,
): Promise<VisualCatalog> {
  const manifest = parseVisualManifest(bundle.manifest);
  await Promise.all(
    manifest.atlases.map(async (atlas) => {
      const source = bundle.atlasSources[atlas.id];
      if (source === undefined) throw new Error(`Missing atlas source: ${atlas.id}`);
      const decoded = await decodeAtlas(source);
      validateDecodedAtlas(atlas, decoded, manifest);
    }),
  );
  return new ValidatedVisualCatalog(manifest, bundle.atlasSources);
}

class ValidatedVisualCatalog implements VisualCatalog {
  readonly version: string;
  private readonly assets: readonly VisualAsset[];
  private readonly handleByAssetId: ReadonlyMap<string, VisualHandle>;
  private readonly atlasSourceById: Readonly<Record<string, string>>;
  private readonly paletteById: ReadonlyMap<string, Readonly<Record<string, string>>>;
  private readonly candidateSets = new Map<string, CandidateSet>();
  private readonly projectionMetadata: readonly ProjectionVisualMetadata[];
  private readonly renderMetadata: readonly RenderVisualMetadata[];

  constructor(manifest: VisualManifest, atlasSources: Readonly<Record<string, string>>) {
    this.version = manifest.visualCatalogVersion;
    this.assets = [...manifest.assets].sort((left, right) => left.id.localeCompare(right.id));
    this.handleByAssetId = new Map(
      this.assets.map((asset, index) => [asset.id, index as VisualHandle]),
    );
    this.atlasSourceById = atlasSources;
    this.paletteById = new Map(manifest.palettes.map(({ id, colors }) => [id, colors]));
    this.projectionMetadata = this.assets.map((asset) =>
      Object.freeze({
        assetId: asset.id,
        kind: asset.kind,
        renderLayer: asset.renderLayer,
        logicalFootprint: asset.logicalFootprint,
        clearance: asset.clearance,
        sortBaselinePx: asset.sortBaselinePx,
        maxOverflow: asset.maxOverflow,
        shadowMask:
          asset.shadowMaskId === undefined ? null : this.requiredHandle(asset.shadowMaskId),
        lodWorld: asset.lodWorldId === undefined ? null : this.requiredHandle(asset.lodWorldId),
      }),
    );
    this.renderMetadata = this.assets.map((asset) => {
      const atlasSource = this.atlasSourceById[asset.atlasPageId];
      if (atlasSource === undefined) throw new Error(`Missing atlas source: ${asset.atlasPageId}`);
      return Object.freeze({
        atlasSource,
        frames: asset.frames,
        sourceCanvas: asset.sourceCanvas,
        trimOffset: asset.trimOffset,
        anchor: asset.anchor,
        animations: asset.animations,
      });
    });
  }

  resolve(query: VisualQuery, variantSeed: number): VisualHandle | null {
    const candidates = this.candidatesFor(query);
    if (candidates.handles.length === 0) return null;
    let cursor = unitFloat(variantSeed) * candidates.totalWeight;
    for (const handle of candidates.handles) {
      const asset = this.assets[handle];
      if (asset === undefined) continue;
      cursor -= asset.variantWeight;
      if (cursor <= 0) return handle;
    }
    return candidates.handles[candidates.handles.length - 1] ?? null;
  }

  getProjectionMetadata(handle: VisualHandle): ProjectionVisualMetadata {
    const metadata = this.projectionMetadata[handle];
    if (metadata === undefined) throw new Error(`Unknown visual handle: ${handle}`);
    return metadata;
  }

  getRenderMetadata(handle: VisualHandle): RenderVisualMetadata {
    const metadata = this.renderMetadata[handle];
    if (metadata === undefined) throw new Error(`Unknown visual handle: ${handle}`);
    return metadata;
  }

  getPaletteColor(paletteId: string, role: string): string {
    const color = this.paletteById.get(paletteId)?.[role];
    if (color === undefined) throw new Error(`Unknown palette color: ${paletteId}.${role}`);
    return color;
  }

  private requiredHandle(assetId: string): VisualHandle {
    const handle = this.handleByAssetId.get(assetId);
    if (handle === undefined) throw new Error(`Unknown visual asset: ${assetId}`);
    return handle;
  }

  private candidatesFor(query: VisualQuery): CandidateSet {
    const key = visualQueryKey(query);
    const cached = this.candidateSets.get(key);
    if (cached !== undefined) return cached;
    const handles: VisualHandle[] = [];
    let totalWeight = 0;
    for (let index = 0; index < this.assets.length; index += 1) {
      const asset = this.assets[index];
      if (asset === undefined || !matches(asset, query)) continue;
      handles.push(index as VisualHandle);
      totalWeight += asset.variantWeight;
    }
    const candidates = Object.freeze({ handles: Object.freeze(handles), totalWeight });
    this.candidateSets.set(key, candidates);
    return candidates;
  }
}

interface CandidateSet {
  readonly handles: readonly VisualHandle[];
  readonly totalWeight: number;
}

function visualQueryKey(query: VisualQuery): string {
  return JSON.stringify([
    query.category,
    query.semanticFamilyId,
    query.landformId,
    query.biomeId,
    query.groundMaterialId,
    query.environmentThemeId,
    query.treeArchetypeId,
    query.age,
    query.height,
    query.form,
    query.topologyCode,
    query.edgeRhythm,
  ]);
}

function matches(asset: VisualAsset, query: VisualQuery): boolean {
  return (
    asset.category === query.category &&
    tagMatches(asset.tags.semanticFamilies, query.semanticFamilyId) &&
    tagMatches(asset.tags.landforms, query.landformId) &&
    tagMatches(asset.tags.biomes, query.biomeId) &&
    tagMatches(asset.tags.groundMaterials, query.groundMaterialId) &&
    tagMatches(asset.tags.environmentThemes, query.environmentThemeId) &&
    tagMatches(asset.tags.treeArchetypes, query.treeArchetypeId) &&
    tagMatches(asset.tags.ages, query.age) &&
    tagMatches(asset.tags.heights, query.height) &&
    tagMatches(asset.tags.forms, query.form) &&
    (query.topologyCode === undefined || asset.autotile?.topologyCode === query.topologyCode) &&
    (query.edgeRhythm === undefined || asset.autotile?.edgeRhythm === query.edgeRhythm)
  );
}

function tagMatches(tags: readonly string[], requested: string | undefined): boolean {
  return requested === undefined || tags.length === 0 || tags.includes(requested);
}

function validateDecodedAtlas(
  atlas: VisualManifest['atlases'][number],
  decoded: DecodedAtlasPage,
  manifest: VisualManifest,
): void {
  if (decoded.width !== atlas.width || decoded.height !== atlas.height) {
    throw new Error(
      `Atlas ${atlas.id} decoded as ${decoded.width}x${decoded.height}; expected ${atlas.width}x${atlas.height}`,
    );
  }
  if (decoded.pixels.length !== decoded.width * decoded.height * 4) {
    throw new Error(`Atlas ${atlas.id} returned an invalid RGBA buffer`);
  }
  if (atlas.category === 'effects') return;
  for (const asset of manifest.assets) {
    if (asset.atlasPageId !== atlas.id) continue;
    for (const frame of asset.frames) validateBinaryAlpha(atlas.id, frame, decoded);
  }
}

function validateBinaryAlpha(
  atlasId: string,
  frame: VisualAsset['frames'][number],
  decoded: DecodedAtlasPage,
): void {
  for (let y = frame.y; y < frame.y + frame.height; y += 1) {
    for (let x = frame.x; x < frame.x + frame.width; x += 1) {
      const alpha = decoded.pixels[(y * decoded.width + x) * 4 + 3];
      if (alpha !== 0 && alpha !== 255) {
        throw new Error(`Atlas ${atlasId} contains non-binary alpha at ${x},${y}`);
      }
    }
  }
}

function unitFloat(seed: number): number {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
