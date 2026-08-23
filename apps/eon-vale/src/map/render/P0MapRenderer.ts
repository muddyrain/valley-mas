import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

import {
  type ChunkCoordinate,
  ChunkRenderCache,
  planViewportChunks,
} from '../cache/MapChunkScheduler';
import {
  BiomeCode,
  CHUNK_SIZE,
  CHUNKS_PER_AXIS,
  EnvironmentThemeCode,
  LandformCode,
  WORLD_SIZE,
  type WorldSnapshot,
} from '../model/WorldSnapshot';
import {
  compileChunkPlan,
  compileRepresentativeChunk,
  compileWorldViewPlan,
  NO_VISUAL_HANDLE,
  type RenderChunkPlan,
  type RenderObjectBatchPlan,
  type WorldViewPlan,
} from '../projection/MapProjection';
import {
  compileP12AcceptanceScene,
  isP12AcceptanceSnapshot,
  type P12AcceptanceKind,
} from '../projection/P12AcceptanceScene';
import {
  compileP21AcceptanceScene,
  isP21AcceptanceSnapshot,
  type P21AcceptanceKind,
} from '../projection/P21AcceptanceScene';
import {
  compileP22AcceptanceScene,
  isP22AcceptanceSnapshot,
  type P22AcceptanceKind,
} from '../projection/P22AcceptanceScene';
import {
  compileP23AcceptanceScene,
  isP23AcceptanceSnapshot,
  type P23AcceptanceKind,
} from '../projection/P23AcceptanceScene';
import type { MapViewport } from '../session/MapSession';
import type { VisualCatalog, VisualHandle } from '../visual/VisualCatalog';

const CELL_PIXELS = 4;
const REGION_LOD_MIN = 0.72;
const CLOSE_LOD_MIN = 2.5;
const MAX_ZOOM = 6;
const CHUNK_CACHE_BUDGET = 192 * 1024 * 1024;
const VISIBLE_CHUNK_BUILD_SLICE_MS = 8;

export type MapDebugMode =
  | 'off'
  | 'ground'
  | 'biome'
  | 'terrain'
  | 'chunk'
  | 'autotile'
  | 'structure';

export interface P0RendererDebugState {
  readonly renderer: 'webgl2';
  readonly dpr: number;
  readonly lod: 'world' | 'region' | 'close';
  readonly zoom: number;
  readonly debugMode: MapDebugMode;
  readonly visualCatalogVersion: string | null;
  readonly snapshotChecksum: string | null;
  readonly representativeChunk: Readonly<{ x: number; y: number; checksum: string }> | null;
  readonly visibleChunks: number;
  readonly visibleDetailedChunks: number;
  readonly detailCoverageReady: boolean;
  readonly cachedChunks: number;
  readonly pendingChunks: number;
  readonly visibleObjects: number;
  readonly worldTreeMarkers: number;
}

interface LoadedAtlasImage {
  readonly element: HTMLImageElement;
  readonly pixels: ImageData;
}

interface RenderedChunk {
  readonly index: number;
  readonly plan: RenderChunkPlan;
  readonly ground: Sprite;
  readonly waterEffect: Sprite;
  readonly shadows: readonly Sprite[];
  readonly lowCover: readonly Sprite[];
  readonly upright: readonly Sprite[];
  readonly foreground: readonly Sprite[];
  readonly autotileDebug: Sprite;
  readonly structureDebug: Sprite;
  readonly estimatedBytes: number;
}

export class P0MapRenderer {
  private readonly app = new Application();
  private readonly worldLayer = new Container();
  private readonly overviewLayer = new Container();
  private readonly regionGroundLayer = new Container();
  private readonly shadowLayer = new Container();
  private readonly lowCoverLayer = new Container();
  private readonly uprightLayer = new Container();
  private readonly foregroundLayer = new Container();
  private readonly waterEffectLayer = new Container();
  private readonly debugLayer = new Container();
  private readonly chunkBoundaryGraphics = new Graphics();
  private readonly inputController = new AbortController();
  private readonly chunkCache = new ChunkRenderCache<RenderedChunk>(CHUNK_CACHE_BUDGET);
  private readonly atlasImages = new Map<string, Promise<LoadedAtlasImage>>();
  private readonly frameTextures = new Map<string, Texture>();
  private readonly visibleChunkKeys = new Set<number>();
  private readonly committedChunkKeys = new Set<number>();
  private readonly lodListeners = new Set<(lod: P0RendererDebugState['lod']) => void>();
  private initialized = false;
  private destroyed = false;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private lod: P0RendererDebugState['lod'] = 'world';
  private debugMode: MapDebugMode = 'off';
  private snapshotChecksum: string | null = null;
  private representativePlan: RenderChunkPlan | undefined;
  private terrainDebugSprite: Sprite | undefined;
  private biomeDebugSprite: Sprite | undefined;
  private snapshot: WorldSnapshot | undefined;
  private catalog: VisualCatalog | undefined;
  private worldSignal: AbortSignal | undefined;
  private buildQueue: ChunkCoordinate[] = [];
  private building = false;
  private detailCoverageReady = false;
  private worldTreeMarkers = 0;
  private worldRevision = 0;
  private elapsedMs = 0;

  async prepareWorld(
    canvas: HTMLCanvasElement,
    snapshot: WorldSnapshot,
    catalog: VisualCatalog,
    signal: AbortSignal,
  ): Promise<void> {
    await this.initialize(canvas);
    throwIfAborted(signal);
    this.worldRevision += 1;
    this.clearRenderedWorld();
    this.snapshot = snapshot;
    this.catalog = catalog;
    this.worldSignal = signal;

    const worldPlan = compileWorldViewPlan(snapshot, catalog);
    const representativePlan = isP12AcceptanceSnapshot(snapshot)
      ? compileP12AcceptanceScene(snapshot, catalog, 'bridge')
      : compileRepresentativeChunk(snapshot, catalog);
    const representativeIndex = chunkIndexAt(representativePlan.chunkX, representativePlan.chunkY);
    const atlasImages = await this.loadVisualSources(
      new Set([
        ...visualSources(representativePlan, catalog),
        ...worldVisualSources(worldPlan, catalog),
      ]),
      signal,
    );
    throwIfAborted(signal);
    this.installOverview(worldPlan, catalog, atlasImages);
    this.installChunk(
      representativeIndex,
      createRenderedChunk(representativeIndex, representativePlan, catalog, atlasImages, (handle) =>
        this.textureFor(handle, atlasImages),
      ),
    );
    this.representativePlan = representativePlan;
    this.snapshotChecksum = snapshot.metadata.checksum;
    this.zoom = this.fitZoom();
    this.centerWorld();
    this.applyCamera();
    await nextFrame();
    throwIfAborted(signal);
    this.app.renderer.render(this.app.stage);
    await nextFrame();
    throwIfAborted(signal);
    this.app.renderer.render(this.app.stage);
    await nextFrame();
  }

  setViewport(viewport: MapViewport): void {
    if (!this.initialized) return;
    this.zoom = Math.max(this.fitZoom(), Math.min(MAX_ZOOM, viewport.zoom));
    this.panX = this.app.screen.width / 2 - viewport.centerX * CELL_PIXELS * this.zoom;
    this.panY = this.app.screen.height / 2 - viewport.centerY * CELL_PIXELS * this.zoom;
    this.applyCamera();
  }

  subscribeLod(listener: (lod: P0RendererDebugState['lod']) => void): () => void {
    this.lodListeners.add(listener);
    listener(this.lod);
    return () => this.lodListeners.delete(listener);
  }

  getDebugState(): P0RendererDebugState {
    return {
      renderer: 'webgl2',
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      lod: this.lod,
      zoom: Number(this.zoom.toFixed(3)),
      debugMode: this.debugMode,
      visualCatalogVersion: this.catalog?.version ?? null,
      snapshotChecksum: this.snapshotChecksum,
      representativeChunk:
        this.representativePlan === undefined
          ? null
          : {
              x: this.representativePlan.chunkX,
              y: this.representativePlan.chunkY,
              checksum: this.representativePlan.checksum,
            },
      visibleChunks: this.visibleChunkKeys.size,
      visibleDetailedChunks: this.chunkCache.values().filter(({ ground }) => ground.visible).length,
      detailCoverageReady: this.detailCoverageReady,
      cachedChunks: this.chunkCache.size,
      pendingChunks: this.buildQueue.length + (this.building ? 1 : 0),
      visibleObjects:
        this.debugMode === 'ground'
          ? 0
          : this.chunkCache
              .values()
              .filter(({ ground }) => ground.visible)
              .reduce(
                (count, chunk) =>
                  count + chunk.lowCover.length + chunk.upright.length + chunk.foreground.length,
                0,
              ),
      worldTreeMarkers: this.worldTreeMarkers,
    };
  }

  advanceTime(milliseconds = 16): void {
    this.elapsedMs += Math.max(0, milliseconds);
    for (const chunk of this.chunkCache.values()) {
      const phase = (chunk.index * 0.73) % (Math.PI * 2);
      chunk.waterEffect.alpha = 0.045 + Math.sin(this.elapsedMs / 900 + phase) * 0.018;
    }
    if (this.initialized) this.app.renderer.render(this.app.stage);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worldRevision += 1;
    this.inputController.abort();
    this.clearRenderedWorld();
    if (this.initialized) {
      this.app.destroy(
        { removeView: false },
        { children: true, texture: true, textureSource: true },
      );
    }
  }

  private async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.destroyed) throw new Error('Renderer is destroyed');
    if (this.initialized) return;
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      canvas,
      resizeTo: window,
      background: 0x14252b,
      antialias: false,
      autoDensity: true,
      resolution,
      preference: 'webgl',
      preferWebGLVersion: 2,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    const gl = (this.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    if (!(gl instanceof WebGL2RenderingContext)) {
      this.app.destroy({ removeView: false }, { children: true });
      throw new Error('WebGL2 is required');
    }
    this.initialized = true;
    this.uprightLayer.sortableChildren = true;
    this.foregroundLayer.sortableChildren = true;
    this.worldLayer.addChild(
      this.overviewLayer,
      this.regionGroundLayer,
      this.shadowLayer,
      this.lowCoverLayer,
      this.uprightLayer,
      this.foregroundLayer,
      this.waterEffectLayer,
      this.debugLayer,
      this.chunkBoundaryGraphics,
    );
    this.app.stage.addChild(this.worldLayer);
    this.app.ticker.add((ticker) => this.advanceTime(ticker.deltaMS));
    this.bindInput(canvas);
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    const options = { signal: this.inputController.signal };
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const before = this.toWorld(event.offsetX, event.offsetY);
        const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
        this.zoom = Math.max(this.fitZoom(), Math.min(MAX_ZOOM, this.zoom * factor));
        this.panX = event.offsetX - before.x * this.zoom;
        this.panY = event.offsetY - before.y * this.zoom;
        this.applyCamera();
      },
      { ...options, passive: false },
    );
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0 && event.button !== 2) return;
        this.dragging = true;
        this.dragX = event.clientX;
        this.dragY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (!this.dragging) return;
        this.panX += event.clientX - this.dragX;
        this.panY += event.clientY - this.dragY;
        this.dragX = event.clientX;
        this.dragY = event.clientY;
        this.applyCamera();
      },
      options,
    );
    canvas.addEventListener('pointerup', () => (this.dragging = false), options);
    canvas.addEventListener('pointercancel', () => (this.dragging = false), options);
    window.addEventListener(
      'map-debug-mode',
      ((event: CustomEvent<MapDebugMode>) => {
        this.debugMode = event.detail;
        this.applyLayerVisibility();
      }) as EventListener,
      options,
    );
    window.addEventListener('map-focus-region', () => this.focusRepresentativeChunk(), options);
    window.addEventListener(
      'map-focus-p1-2',
      ((event: CustomEvent<P12AcceptanceKind>) =>
        this.focusP12AcceptanceScene(event.detail)) as EventListener,
      options,
    );
    window.addEventListener(
      'map-focus-p2-1',
      ((event: CustomEvent<P21AcceptanceKind>) =>
        this.focusP21AcceptanceScene(event.detail)) as EventListener,
      options,
    );
    window.addEventListener(
      'map-focus-p2-2',
      ((event: CustomEvent<P22AcceptanceKind>) =>
        this.focusP22AcceptanceScene(event.detail)) as EventListener,
      options,
    );
    window.addEventListener(
      'map-focus-p2-3',
      ((event: CustomEvent<P23AcceptanceKind>) =>
        this.focusP23AcceptanceScene(event.detail)) as EventListener,
      options,
    );
    window.addEventListener('map-focus-world', () => this.focusWorld(), options);
    window.addEventListener('resize', () => this.applyCamera(), options);
  }

  private installOverview(
    worldPlan: WorldViewPlan,
    catalog: VisualCatalog,
    atlasImages: ReadonlyMap<string, LoadedAtlasImage>,
  ): void {
    clearLayer(this.overviewLayer);
    clearLayer(this.debugLayer);
    this.overviewLayer.addChild(worldSprite(drawWorldOverview(worldPlan, catalog, atlasImages)));
    this.worldTreeMarkers = worldPlan.treeMarkerCount;
    this.terrainDebugSprite = worldSprite(
      canvasFromRgba(worldPlan.width, worldPlan.height, worldPlan.terrainDebugRgba),
    );
    this.biomeDebugSprite = worldSprite(
      canvasFromRgba(worldPlan.width, worldPlan.height, worldPlan.biomeDebugRgba),
    );
    this.debugLayer.addChild(this.terrainDebugSprite, this.biomeDebugSprite);
    this.drawChunkBoundaries(worldPlan.width, worldPlan.height);
    this.applyLayerVisibility();
  }

  private installChunk(index: number, chunk: RenderedChunk): void {
    if (this.chunkCache.has(index)) {
      destroyRenderedChunk(chunk);
      return;
    }
    this.regionGroundLayer.addChild(chunk.ground);
    if (chunk.shadows.length > 0) this.shadowLayer.addChild(...chunk.shadows);
    if (chunk.lowCover.length > 0) this.lowCoverLayer.addChild(...chunk.lowCover);
    if (chunk.upright.length > 0) this.uprightLayer.addChild(...chunk.upright);
    if (chunk.foreground.length > 0) this.foregroundLayer.addChild(...chunk.foreground);
    this.waterEffectLayer.addChild(chunk.waterEffect);
    this.debugLayer.addChild(chunk.autotileDebug);
    this.debugLayer.addChild(chunk.structureDebug);
    for (const evicted of this.chunkCache.set(index, chunk, chunk.estimatedBytes)) {
      destroyRenderedChunk(evicted.value);
    }
    this.setChunkVisible(chunk, this.committedChunkKeys.has(index));
    this.updateDetailedCoverageVisibility();
  }

  private scheduleVisibleChunks(): void {
    if (!this.initialized || this.lod === 'world' || !this.snapshot || !this.catalog) {
      this.visibleChunkKeys.clear();
      this.committedChunkKeys.clear();
      this.buildQueue = [];
      this.detailCoverageReady = false;
      this.chunkCache.protect(this.protectedChunkKeys());
      this.applyLayerVisibility();
      return;
    }
    const centerWorldPixels = this.toWorld(this.app.screen.width / 2, this.app.screen.height / 2);
    const plan = planViewportChunks({
      centerX: centerWorldPixels.x / CELL_PIXELS,
      centerY: centerWorldPixels.y / CELL_PIXELS,
      viewportWidthPx: this.app.screen.width,
      viewportHeightPx: this.app.screen.height,
      zoom: this.zoom,
      cellPixels: CELL_PIXELS,
    });
    this.visibleChunkKeys.clear();
    for (const { index } of plan.visible) this.visibleChunkKeys.add(index);
    this.commitDetailedCoverageIfReady();
    this.chunkCache.protect(this.protectedChunkKeys());
    for (const chunk of this.chunkCache.values()) {
      this.setChunkVisible(chunk, this.committedChunkKeys.has(chunk.index));
    }
    this.applyLayerVisibility();
    this.buildQueue = plan.required.filter(({ index }) => !this.chunkCache.has(index));
    if (!this.building) void this.processBuildQueue(this.worldRevision);
  }

  private async processBuildQueue(revision: number): Promise<void> {
    if (this.building) return;
    this.building = true;
    let sliceStartedAt = performance.now();
    try {
      while (this.buildQueue.length > 0 && revision === this.worldRevision && !this.destroyed) {
        const coordinate = this.buildQueue.shift();
        if (coordinate === undefined || this.chunkCache.has(coordinate.index)) continue;
        const snapshot = this.snapshot;
        const catalog = this.catalog;
        const signal = this.worldSignal;
        if (snapshot === undefined || catalog === undefined || signal === undefined) return;
        throwIfAborted(signal);
        const plan = compileChunkPlan(snapshot, catalog, coordinate.index);
        const images = await this.loadPlanAtlases(plan, signal);
        if (revision !== this.worldRevision || this.destroyed) return;
        this.installChunk(
          coordinate.index,
          createRenderedChunk(coordinate.index, plan, catalog, images, (handle) =>
            this.textureFor(handle, images),
          ),
        );
        const nextCoordinate = this.buildQueue[0];
        const nextIsVisible =
          nextCoordinate !== undefined && this.visibleChunkKeys.has(nextCoordinate.index);
        if (!nextIsVisible || performance.now() - sliceStartedAt >= VISIBLE_CHUNK_BUILD_SLICE_MS) {
          await nextFrame();
          sliceStartedAt = performance.now();
        }
      }
    } finally {
      this.building = false;
      if (this.buildQueue.length > 0 && revision === this.worldRevision && !this.destroyed) {
        void this.processBuildQueue(revision);
      }
    }
  }

  private loadPlanAtlases(
    plan: RenderChunkPlan,
    signal: AbortSignal,
  ): Promise<ReadonlyMap<string, LoadedAtlasImage>> {
    if (!this.catalog) throw new Error('Visual catalog is unavailable');
    const sources = visualSources(plan, this.catalog);
    return this.loadVisualSources(sources, signal);
  }

  private loadVisualSources(
    sources: ReadonlySet<string>,
    signal: AbortSignal,
  ): Promise<ReadonlyMap<string, LoadedAtlasImage>> {
    return Promise.all(
      [...sources].map(async (source) => {
        let image = this.atlasImages.get(source);
        if (image === undefined) {
          image = loadImage(source, signal).then(loadAtlasPixels);
          this.atlasImages.set(source, image);
        }
        return [source, await image] as const;
      }),
    ).then((entries) => new Map(entries));
  }

  private textureFor(
    handle: VisualHandle,
    images: ReadonlyMap<string, LoadedAtlasImage>,
    frameIndex = 0,
  ): Texture {
    const key = `${handle}:${frameIndex}`;
    const cached = this.frameTextures.get(key);
    if (cached !== undefined) return cached;
    if (!this.catalog) throw new Error('Visual catalog is unavailable');
    const metadata = this.catalog.getRenderMetadata(handle);
    const frame = metadata.frames[frameIndex % metadata.frames.length];
    const image = images.get(metadata.atlasSource);
    if (frame === undefined || image === undefined)
      throw new Error('Validated visual is unavailable');
    const sourceTexture = Texture.from(image.element);
    sourceTexture.source.scaleMode = 'nearest';
    const texture = new Texture({
      source: sourceTexture.source,
      frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
    });
    this.frameTextures.set(key, texture);
    return texture;
  }

  private drawChunkBoundaries(width: number, height: number): void {
    this.chunkBoundaryGraphics.clear();
    for (let cell = 0; cell <= width; cell += CHUNK_SIZE) {
      const x = cell * CELL_PIXELS;
      this.chunkBoundaryGraphics.moveTo(x, 0).lineTo(x, height * CELL_PIXELS);
    }
    for (let cell = 0; cell <= height; cell += CHUNK_SIZE) {
      const y = cell * CELL_PIXELS;
      this.chunkBoundaryGraphics.moveTo(0, y).lineTo(width * CELL_PIXELS, y);
    }
    this.chunkBoundaryGraphics.stroke({ color: 0xffd65a, width: 1, alpha: 0.9 });
  }

  private focusRepresentativeChunk(): void {
    if (!this.representativePlan || !this.initialized) return;
    this.focusPlan(this.representativePlan);
  }

  private focusP12AcceptanceScene(kind: P12AcceptanceKind): void {
    if (!this.initialized || !this.snapshot || !this.catalog) return;
    if (!isP12AcceptanceSnapshot(this.snapshot)) return;
    this.focusPlan(compileP12AcceptanceScene(this.snapshot, this.catalog, kind));
  }

  private focusP21AcceptanceScene(kind: P21AcceptanceKind): void {
    if (!this.initialized || !this.snapshot || !this.catalog) return;
    if (!isP21AcceptanceSnapshot(this.snapshot)) return;
    this.focusPlan(compileP21AcceptanceScene(this.snapshot, this.catalog, kind));
  }

  private focusP22AcceptanceScene(kind: P22AcceptanceKind): void {
    if (!this.initialized || !this.snapshot || !this.catalog) return;
    if (!isP22AcceptanceSnapshot(this.snapshot)) return;
    this.focusPlan(compileP22AcceptanceScene(this.snapshot, this.catalog, kind));
  }

  private focusP23AcceptanceScene(kind: P23AcceptanceKind): void {
    if (!this.initialized || !this.snapshot || !this.catalog) return;
    if (!isP23AcceptanceSnapshot(this.snapshot)) return;
    this.focusPlan(compileP23AcceptanceScene(this.snapshot, this.catalog, kind));
  }

  private focusPlan(plan: RenderChunkPlan): void {
    this.zoom = 2;
    const centerX = (plan.chunkX + plan.width / 2) * CELL_PIXELS;
    const centerY = (plan.chunkY + plan.height / 2) * CELL_PIXELS;
    this.panX = this.app.screen.width / 2 - centerX * this.zoom;
    this.panY = this.app.screen.height / 2 - centerY * this.zoom;
    this.applyCamera();
  }

  private focusWorld(): void {
    if (!this.initialized) return;
    this.zoom = this.fitZoom();
    this.centerWorld();
    this.applyCamera();
  }

  private centerWorld(): void {
    this.panX = (this.app.screen.width - WORLD_SIZE * CELL_PIXELS * this.zoom) / 2;
    this.panY = (this.app.screen.height - WORLD_SIZE * CELL_PIXELS * this.zoom) / 2;
  }

  private fitZoom(): number {
    if (!this.initialized) return 1;
    return (
      Math.min(
        this.app.screen.width / (WORLD_SIZE * CELL_PIXELS),
        this.app.screen.height / (WORLD_SIZE * CELL_PIXELS),
      ) * 0.92
    );
  }

  private toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: (screenX - this.panX) / this.zoom, y: (screenY - this.panY) / this.zoom };
  }

  private applyCamera(): void {
    if (!this.initialized) return;
    this.constrainPan();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.worldLayer.position.set(
      Math.round(this.panX * dpr) / dpr,
      Math.round(this.panY * dpr) / dpr,
    );
    this.worldLayer.scale.set(this.zoom);
    const nextLod =
      this.zoom < REGION_LOD_MIN ? 'world' : this.zoom < CLOSE_LOD_MIN ? 'region' : 'close';
    if (nextLod !== this.lod) {
      this.lod = nextLod;
      for (const listener of this.lodListeners) listener(nextLod);
    }
    this.applyLayerVisibility();
    this.scheduleVisibleChunks();
  }

  private applyLayerVisibility(): void {
    const detailed = this.lod !== 'world' && this.committedChunkKeys.size > 0;
    const objectsVisible = detailed && this.debugMode !== 'ground';
    this.regionGroundLayer.visible = detailed;
    this.shadowLayer.visible = objectsVisible;
    this.lowCoverLayer.visible = objectsVisible;
    this.uprightLayer.visible = objectsVisible;
    this.foregroundLayer.visible = objectsVisible;
    this.waterEffectLayer.visible = detailed;
    if (this.terrainDebugSprite) this.terrainDebugSprite.visible = this.debugMode === 'terrain';
    if (this.biomeDebugSprite) this.biomeDebugSprite.visible = this.debugMode === 'biome';
    this.chunkBoundaryGraphics.visible = this.debugMode === 'chunk';
    for (const chunk of this.chunkCache.values()) {
      chunk.autotileDebug.visible =
        detailed && this.debugMode === 'autotile' && this.committedChunkKeys.has(chunk.index);
      chunk.structureDebug.visible =
        detailed && this.debugMode === 'structure' && this.committedChunkKeys.has(chunk.index);
    }
  }

  private setChunkVisible(chunk: RenderedChunk, visible: boolean): void {
    const detailed = visible && this.lod !== 'world';
    const objectsVisible = detailed && this.debugMode !== 'ground';
    chunk.ground.visible = detailed;
    chunk.waterEffect.visible = detailed;
    for (const sprite of chunk.shadows) sprite.visible = objectsVisible;
    for (const sprite of chunk.lowCover) sprite.visible = objectsVisible;
    for (const sprite of chunk.upright) sprite.visible = objectsVisible;
    for (const sprite of chunk.foreground) sprite.visible = objectsVisible;
    chunk.autotileDebug.visible = detailed && this.debugMode === 'autotile';
    chunk.structureDebug.visible = detailed && this.debugMode === 'structure';
  }

  private hasCompleteDetailedCoverage(): boolean {
    return (
      this.visibleChunkKeys.size > 0 &&
      [...this.visibleChunkKeys].every((index) => this.chunkCache.has(index))
    );
  }

  private updateDetailedCoverageVisibility(): void {
    if (this.commitDetailedCoverageIfReady()) {
      this.chunkCache.protect(this.protectedChunkKeys());
    }
    for (const chunk of this.chunkCache.values()) {
      this.setChunkVisible(chunk, this.committedChunkKeys.has(chunk.index));
    }
    this.applyLayerVisibility();
  }

  private commitDetailedCoverageIfReady(): boolean {
    this.detailCoverageReady = this.lod !== 'world' && this.hasCompleteDetailedCoverage();
    if (!this.detailCoverageReady) return false;
    this.committedChunkKeys.clear();
    for (const index of this.visibleChunkKeys) this.committedChunkKeys.add(index);
    return true;
  }

  private protectedChunkKeys(): ReadonlySet<number> {
    return new Set([...this.visibleChunkKeys, ...this.committedChunkKeys]);
  }

  private constrainPan(): void {
    const width = WORLD_SIZE * CELL_PIXELS * this.zoom;
    const height = WORLD_SIZE * CELL_PIXELS * this.zoom;
    this.panX =
      width <= this.app.screen.width
        ? (this.app.screen.width - width) / 2
        : Math.min(0, Math.max(this.app.screen.width - width, this.panX));
    this.panY =
      height <= this.app.screen.height
        ? (this.app.screen.height - height) / 2
        : Math.min(0, Math.max(this.app.screen.height - height, this.panY));
  }

  private clearRenderedWorld(): void {
    for (const chunk of this.chunkCache.clear()) destroyRenderedChunk(chunk);
    for (const texture of this.frameTextures.values()) texture.destroy(false);
    this.frameTextures.clear();
    this.atlasImages.clear();
    this.visibleChunkKeys.clear();
    this.committedChunkKeys.clear();
    this.buildQueue = [];
    this.detailCoverageReady = false;
    this.worldTreeMarkers = 0;
    this.snapshot = undefined;
    this.catalog = undefined;
    this.worldSignal = undefined;
    this.representativePlan = undefined;
    this.snapshotChecksum = null;
    clearLayer(this.overviewLayer);
    clearLayer(this.debugLayer);
  }
}

function createRenderedChunk(
  index: number,
  plan: RenderChunkPlan,
  catalog: VisualCatalog,
  images: ReadonlyMap<string, LoadedAtlasImage>,
  textureFor: (handle: VisualHandle, frameIndex?: number) => Texture,
): RenderedChunk {
  const ground = chunkSprite(drawRegionChunk(plan, catalog, images), plan.chunkX, plan.chunkY);
  const waterEffect = chunkSprite(drawWaterEffect(plan), plan.chunkX, plan.chunkY);
  waterEffect.tint = 0xa8efff;
  waterEffect.blendMode = 'add';
  const shadows = objectSprites(plan, plan.upright, catalog, textureFor, true);
  const lowCover = objectSprites(plan, plan.lowCover, catalog, textureFor, false);
  const upright = objectSprites(plan, plan.upright, catalog, textureFor, false);
  const foreground = objectSprites(plan, plan.foreground, catalog, textureFor, false);
  const autotileDebug = chunkSprite(drawAutotileDebug(plan), plan.chunkX, plan.chunkY);
  autotileDebug.scale.set(CELL_PIXELS);
  const structureDebug = chunkSprite(drawStructureDebug(plan), plan.chunkX, plan.chunkY);
  structureDebug.scale.set(CELL_PIXELS);
  const textureBytes = plan.width * CELL_PIXELS * plan.height * CELL_PIXELS * 4 * 4;
  return {
    index,
    plan,
    ground,
    waterEffect,
    shadows,
    lowCover,
    upright,
    foreground,
    autotileDebug,
    structureDebug,
    estimatedBytes:
      textureBytes + (shadows.length + lowCover.length + upright.length + foreground.length) * 256,
  };
}

function objectSprites(
  plan: RenderChunkPlan,
  batch: RenderObjectBatchPlan,
  catalog: VisualCatalog,
  textureFor: (handle: VisualHandle, frameIndex?: number) => Texture,
  shadows: boolean,
): Sprite[] {
  const sprites: Sprite[] = [];
  for (let index = 0; index < batch.visualHandles.length; index += 1) {
    const rawHandle = shadows ? batch.shadowVisuals[index] : batch.visualHandles[index];
    if (rawHandle === undefined || rawHandle === NO_VISUAL_HANDLE) continue;
    const handle = rawHandle as VisualHandle;
    const render = catalog.getRenderMetadata(handle);
    const frameIndex =
      render.frames.length > 1 ? (batch.variantSeeds[index] ?? 0) % render.frames.length : 0;
    const frame = render.frames[frameIndex];
    if (frame === undefined) continue;
    const sprite = new Sprite({ texture: textureFor(handle, frameIndex) });
    sprite.anchor.set(render.anchor.x / frame.width, render.anchor.y / frame.height);
    const worldX = plan.chunkX + (batch.anchorX[index] ?? 0);
    const worldY = plan.chunkY + (batch.anchorY[index] ?? 0);
    sprite.position.set((worldX + 0.5) * CELL_PIXELS, (worldY + 1) * CELL_PIXELS);
    sprite.roundPixels = true;
    sprite.zIndex = batch.sortKeys[index] ?? 0;
    if (shadows) sprite.alpha = 0.38;
    sprites.push(sprite);
  }
  return sprites;
}

function visualSources(plan: RenderChunkPlan, catalog: VisualCatalog): ReadonlySet<string> {
  const sources = new Set<string>();
  const add = (rawHandle: number) => {
    if (rawHandle === NO_VISUAL_HANDLE) return;
    sources.add(catalog.getRenderMetadata(rawHandle as VisualHandle).atlasSource);
  };
  for (const handle of plan.baseVisuals) add(handle);
  for (const handle of plan.overlayVisuals) add(handle);
  for (const handle of plan.groupVisuals) add(handle);
  for (const handle of plan.themeVisuals) add(handle);
  for (const handle of plan.transitionVisuals) add(handle);
  for (const batch of [plan.lowCover, plan.upright, plan.foreground]) {
    for (const handle of batch.visualHandles) add(handle);
    for (const handle of batch.shadowVisuals) add(handle);
  }
  return sources;
}

function worldVisualSources(plan: WorldViewPlan, catalog: VisualCatalog): ReadonlySet<string> {
  const sources = new Set<string>();
  for (const rawHandle of plan.vegetationMarkers.visualHandles) {
    sources.add(catalog.getRenderMetadata(rawHandle as VisualHandle).atlasSource);
  }
  return sources;
}

function drawWorldOverview(
  plan: WorldViewPlan,
  catalog: VisualCatalog,
  images: ReadonlyMap<string, LoadedAtlasImage>,
): HTMLCanvasElement {
  const canvas = canvasFromRgba(plan.width, plan.height, plan.rgba);
  const context = requiredContext(canvas);
  const markers = plan.vegetationMarkers;
  for (let index = 0; index < markers.visualHandles.length; index += 1) {
    const handle = markers.visualHandles[index] as VisualHandle;
    const render = catalog.getRenderMetadata(handle);
    const frame = render.frames[0];
    const image = images.get(render.atlasSource);
    if (frame === undefined || image === undefined) continue;
    const anchorX = markers.anchorX[index] ?? 0;
    const anchorY = markers.anchorY[index] ?? 0;
    const density = markers.density[index] ?? 1;
    context.globalAlpha = density === 1 ? 0.82 : density === 2 ? 0.94 : 1;
    context.drawImage(
      image.element,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      anchorX - render.anchor.x,
      anchorY - render.anchor.y,
      frame.width,
      frame.height,
    );
  }
  context.globalAlpha = 1;
  return canvas;
}

function drawRegionChunk(
  plan: RenderChunkPlan,
  catalog: VisualCatalog,
  atlasImages: ReadonlyMap<string, LoadedAtlasImage>,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width * CELL_PIXELS;
  canvas.height = plan.height * CELL_PIXELS;
  const context = requiredContext(canvas);
  const basePixels = context.createImageData(canvas.width, canvas.height);
  const baseColors = regionBaseColors(catalog);
  for (let cell = 0; cell < plan.baseVisuals.length; cell += 1) {
    const x = (cell % plan.width) * CELL_PIXELS;
    const y = Math.floor(cell / plan.width) * CELL_PIXELS;
    fillImageDataCell(basePixels, canvas.width, x, y, regionCellColor(plan, cell, baseColors));
  }
  for (let cell = 0; cell < plan.baseVisuals.length; cell += 1) {
    const x = (cell % plan.width) * CELL_PIXELS;
    const y = Math.floor(cell / plan.width) * CELL_PIXELS;
    const landform = plan.landforms[cell] ?? LandformCode.DeepOcean;
    blitVisual(
      basePixels,
      canvas.width,
      x,
      y,
      plan.baseVisuals[cell] as VisualHandle,
      catalog,
      atlasImages,
      landform <= LandformCode.Coast ? 0.54 : 0.48,
      visualVariantSeed(plan, cell),
    );
  }
  const groupsPerAxis = plan.width / 4;
  for (let group = 0; group < plan.groupVisuals.length; group += 1) {
    const handle = plan.groupVisuals[group] ?? NO_VISUAL_HANDLE;
    if (handle === NO_VISUAL_HANDLE) continue;
    const groupX = group % groupsPerAxis;
    const groupY = Math.floor(group / groupsPerAxis);
    const centerCell = (groupY * 4 + 2) * plan.width + groupX * 4 + 2;
    const biome = plan.biomes[centerCell] ?? BiomeCode.Grassland;
    const opacity =
      biome === BiomeCode.Wetland
        ? 0.24
        : biome === BiomeCode.Rainforest
          ? 0.28
          : biome === BiomeCode.Savanna
            ? 0.32
            : biome === BiomeCode.Desert
              ? 0.26
              : 0.42;
    blitVisual(
      basePixels,
      canvas.width,
      groupX * 16,
      groupY * 16,
      handle as VisualHandle,
      catalog,
      atlasImages,
      opacity,
      group,
    );
  }
  for (let group = 0; group < plan.themeVisuals.length; group += 1) {
    const handle = plan.themeVisuals[group] ?? NO_VISUAL_HANDLE;
    if (handle === NO_VISUAL_HANDLE) continue;
    blitVisual(
      basePixels,
      canvas.width,
      (group % groupsPerAxis) * 16,
      Math.floor(group / groupsPerAxis) * 16,
      handle as VisualHandle,
      catalog,
      atlasImages,
      0.58,
      group + plan.visualSeed,
    );
  }
  drawStructureMarks(basePixels, canvas.width, plan, baseColors);
  for (let cell = 0; cell < plan.transitionVisuals.length; cell += 1) {
    const x = (cell % plan.width) * CELL_PIXELS;
    const y = Math.floor(cell / plan.width) * CELL_PIXELS;
    const transition = plan.transitionVisuals[cell] ?? NO_VISUAL_HANDLE;
    if (transition !== NO_VISUAL_HANDLE) {
      blitVisual(
        basePixels,
        canvas.width,
        x,
        y,
        transition as VisualHandle,
        catalog,
        atlasImages,
        0.42,
        cell,
        transitionTint(plan.landforms[cell] ?? 0, plan.biomes[cell] ?? 0, catalog),
      );
    }
  }
  for (let cell = 0; cell < plan.overlayVisuals.length; cell += 1) {
    const handle = plan.overlayVisuals[cell] ?? NO_VISUAL_HANDLE;
    if (handle === NO_VISUAL_HANDLE) continue;
    blitVisual(
      basePixels,
      canvas.width,
      (cell % plan.width) * CELL_PIXELS,
      Math.floor(cell / plan.width) * CELL_PIXELS,
      handle as VisualHandle,
      catalog,
      atlasImages,
      0.92,
      cell,
    );
  }
  context.putImageData(basePixels, 0, 0);
  return canvas;
}

function blitVisual(
  target: ImageData,
  targetWidth: number,
  x: number,
  y: number,
  handle: VisualHandle,
  catalog: VisualCatalog,
  atlasImages: ReadonlyMap<string, LoadedAtlasImage>,
  opacity: number,
  variantSeed: number,
  tint?: readonly number[],
): void {
  const metadata = catalog.getRenderMetadata(handle);
  const frame = metadata.frames[variantSeed % metadata.frames.length];
  const atlas = atlasImages.get(metadata.atlasSource);
  if (frame === undefined || atlas === undefined)
    throw new Error('Validated visual is unavailable');
  const source = atlas.pixels.data;
  const sourceWidth = atlas.pixels.width;
  for (let sourceY = 0; sourceY < frame.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < frame.width; sourceX += 1) {
      const sourcePixel = ((frame.y + sourceY) * sourceWidth + frame.x + sourceX) * 4;
      const alpha = ((source[sourcePixel + 3] ?? 0) / 255) * opacity;
      if (alpha <= 0) continue;
      const targetPixel = ((y + sourceY) * targetWidth + x + sourceX) * 4;
      const inverse = 1 - alpha;
      const sourceRed = tint?.[0] ?? source[sourcePixel] ?? 0;
      const sourceGreen = tint?.[1] ?? source[sourcePixel + 1] ?? 0;
      const sourceBlue = tint?.[2] ?? source[sourcePixel + 2] ?? 0;
      target.data[targetPixel] = Math.round(
        sourceRed * alpha + (target.data[targetPixel] ?? 0) * inverse,
      );
      target.data[targetPixel + 1] = Math.round(
        sourceGreen * alpha + (target.data[targetPixel + 1] ?? 0) * inverse,
      );
      target.data[targetPixel + 2] = Math.round(
        sourceBlue * alpha + (target.data[targetPixel + 2] ?? 0) * inverse,
      );
    }
  }
}

function regionCellColor(
  plan: RenderChunkPlan,
  cell: number,
  colors: ReadonlyMap<string, readonly number[]>,
): readonly number[] {
  const landform = plan.landforms[cell] ?? LandformCode.DeepOcean;
  const biome = plan.biomes[cell] ?? BiomeCode.Grassland;
  const fallback = colors.get('ground_grass') ?? [0, 0, 0, 255];
  const base = colors.get(regionColorRole(landform, biome)) ?? fallback;
  const worldX = plan.chunkX + (cell % plan.width);
  const worldY = plan.chunkY + Math.floor(cell / plan.width);
  if (landform === LandformCode.Coast) {
    const shoreBand = plan.shoreBands[cell] ?? 2;
    const shoreTone = quantizedMaterialTone(worldX, worldY, plan.visualSeed ^ 0x51ed_270b);
    if (shoreBand === 1) {
      const waterColor = colors.get('water_light') ?? base;
      return shadeColor(mixColor(base, waterColor, 0.3), -0.035 + shoreTone * 0.25);
    }
    if (shoreBand === 3) {
      const landColor = colors.get(regionColorRole(LandformCode.Lowland, biome)) ?? fallback;
      const encroachment = valueNoise(worldX, worldY, 13, plan.visualSeed ^ 0xc2b2_ae35) > 0.56;
      return shadeColor(
        mixColor(base, landColor, encroachment ? 0.56 : 0.34),
        shoreTone * 0.35 + 0.015,
      );
    }
    return shadeColor(base, shoreTone * 0.65);
  }
  if (landform === LandformCode.Lowland) {
    const wetHot = biome === BiomeCode.Rainforest || biome === BiomeCode.Wetland;
    const dry = biome === BiomeCode.Savanna || biome === BiomeCode.Desert;
    const cold = biome === BiomeCode.Tundra || biome === BiomeCode.Polar;
    const toneSeed = plan.visualSeed ^ Math.imul(biome + 1, 0x2e68_4b1d);
    const tone = wetHot
      ? broadMaterialTone(worldX, worldY, toneSeed)
      : dry
        ? dryMaterialTone(worldX, worldY, toneSeed)
        : cold
          ? broadMaterialTone(worldX, worldY, toneSeed)
          : quantizedMaterialTone(worldX, worldY, toneSeed);
    const toneStrength =
      biome === BiomeCode.Wetland
        ? 0.35
        : biome === BiomeCode.Rainforest
          ? 0.45
          : biome === BiomeCode.Savanna
            ? 0.55
            : biome === BiomeCode.Desert
              ? 0.4
              : biome === BiomeCode.Tundra
                ? 0.34
                : biome === BiomeCode.Polar
                  ? 0.22
                  : 0.9;
    let color = shadeColor(base, tone * toneStrength);
    const bridge = plan.biomeBridges[cell] ?? 0;
    if (bridge > 0) {
      const strength = bridge & 3;
      const targetBiome = (bridge >>> 2) - 1;
      const targetRole = regionColorRole(LandformCode.Lowland, targetBiome);
      const tongue = noiseCorner(worldX >> 2, worldY >> 2, plan.visualSeed ^ 0x3c6e_f372) > 0.54;
      const amount = Math.min(0.7, 0.17 + strength * 0.1 + (tongue ? 0.16 : 0));
      color = mixColor(color, colors.get(targetRole) ?? color, amount);
    }
    return applyEnvironmentTheme(plan, cell, color, colors, worldX, worldY);
  }
  if (landform === LandformCode.Highland || landform === LandformCode.Mountain) {
    const elevation = plan.elevations[cell] ?? 0;
    const elevationTone = (elevation - (landform === LandformCode.Mountain ? 224 : 188)) / 255;
    const materialTone = quantizedMaterialTone(worldX, worldY, plan.visualSeed ^ 0x6a09_e667);
    const rock = shadeColor(base, elevationTone * 0.16 + materialTone * 0.55);
    return applyEnvironmentTheme(plan, cell, rock, colors, worldX, worldY);
  }
  return applyEnvironmentTheme(plan, cell, base, colors, worldX, worldY);
}

function applyEnvironmentTheme(
  plan: RenderChunkPlan,
  cell: number,
  base: readonly number[],
  colors: ReadonlyMap<string, readonly number[]>,
  worldX: number,
  worldY: number,
): readonly number[] {
  if (plan.environmentThemes[cell] !== EnvironmentThemeCode.Corruption) return base;
  const corruption = colors.get('corruption_ground') ?? colors.get('shadow') ?? base;
  const band = plan.themeBands[cell] ?? 1;
  const tone = quantizedMaterialTone(worldX, worldY, plan.visualSeed ^ 0xbb67_ae85);
  return shadeColor(mixColor(base, corruption, band === 1 ? 0.22 : 0.34), tone * 0.35);
}

function drawStructureMarks(
  target: ImageData,
  width: number,
  plan: RenderChunkPlan,
  colors: ReadonlyMap<string, readonly number[]>,
): void {
  const bridgeLight = colors.get('grass_edge') ?? colors.get('highlight') ?? [255, 255, 255, 255];
  const rockLight = colors.get('rock_highlight') ?? colors.get('highlight') ?? bridgeLight;
  const rockShadow = colors.get('rock_shadow') ?? colors.get('shadow') ?? [0, 0, 0, 255];
  const corruptionAccent = colors.get('corruption_accent') ??
    colors.get('darkest') ?? [0, 0, 0, 255];
  for (let cell = 0; cell < plan.baseVisuals.length; cell += 1) {
    const seed = visualVariantSeed(plan, cell);
    const pixelX = (cell % plan.width) * CELL_PIXELS;
    const pixelY = Math.floor(cell / plan.width) * CELL_PIXELS;
    const bridge = plan.biomeBridges[cell] ?? 0;
    if (bridge > 0 && seed % 5 === 0) {
      const biome = plan.biomes[cell] ?? BiomeCode.Grassland;
      const bridgeOpacity =
        biome === BiomeCode.Rainforest || biome === BiomeCode.Wetland
          ? 0.2
          : biome === BiomeCode.Savanna || biome === BiomeCode.Desert
            ? 0.28
            : 0.42;
      setImageDataPixel(
        target,
        width,
        pixelX + ((seed >>> 5) & 3),
        pixelY + ((seed >>> 9) & 3),
        bridgeLight,
        bridgeOpacity,
      );
    }
    const elevationBand = plan.elevationBands[cell] ?? 0;
    if ((elevationBand === 1 || elevationBand === 3) && seed % 3 !== 0) {
      setImageDataPixel(target, width, pixelX + ((seed >>> 6) & 1), pixelY, rockLight, 0.7);
      setImageDataPixel(
        target,
        width,
        pixelX + 2 + ((seed >>> 8) & 1),
        pixelY + 3,
        rockShadow,
        0.62,
      );
    } else if (elevationBand > 0 && seed % 13 === 0) {
      setImageDataPixel(
        target,
        width,
        pixelX + ((seed >>> 4) & 3),
        pixelY + ((seed >>> 8) & 3),
        rockShadow,
        0.46,
      );
    }
    const themeBand = plan.themeBands[cell] ?? 0;
    if (themeBand > 0 && seed % (themeBand === 1 ? 3 : 8) === 0) {
      const offsetX = (seed >>> 11) & 3;
      const offsetY = (seed >>> 15) & 3;
      setImageDataPixel(
        target,
        width,
        pixelX + offsetX,
        pixelY + offsetY,
        corruptionAccent,
        themeBand === 1 ? 0.74 : 0.52,
      );
      if (themeBand === 1 && offsetX < 3) {
        setImageDataPixel(
          target,
          width,
          pixelX + offsetX + 1,
          pixelY + offsetY,
          corruptionAccent,
          0.38,
        );
      }
    }
  }
}

function setImageDataPixel(
  target: ImageData,
  width: number,
  x: number,
  y: number,
  color: readonly number[],
  opacity: number,
): void {
  const pixel = (y * width + x) * 4;
  const inverse = 1 - opacity;
  target.data[pixel] = Math.round((target.data[pixel] ?? 0) * inverse + (color[0] ?? 0) * opacity);
  target.data[pixel + 1] = Math.round(
    (target.data[pixel + 1] ?? 0) * inverse + (color[1] ?? 0) * opacity,
  );
  target.data[pixel + 2] = Math.round(
    (target.data[pixel + 2] ?? 0) * inverse + (color[2] ?? 0) * opacity,
  );
  target.data[pixel + 3] = 255;
}

function visualVariantSeed(plan: RenderChunkPlan, cell: number): number {
  const worldX = plan.chunkX + (cell % plan.width);
  const worldY = plan.chunkY + Math.floor(cell / plan.width);
  return Math.floor(noiseCorner(worldX, worldY, plan.visualSeed) * 0xffff_ffff) >>> 0;
}

function quantizedMaterialTone(x: number, y: number, seed: number): number {
  const broad = valueNoise(x, y, 46, seed);
  const medium = valueNoise(x, y, 19, seed ^ 0x9e37_79b9);
  const field = broad * 0.68 + medium * 0.32;
  if (field < 0.23) return -0.09;
  if (field < 0.38) return -0.045;
  if (field > 0.79) return 0.085;
  if (field > 0.63) return 0.04;
  return 0;
}

function broadMaterialTone(x: number, y: number, seed: number): number {
  const field = valueNoise(x, y, 83, seed);
  if (field < 0.3) return -0.055;
  if (field < 0.42) return -0.025;
  if (field > 0.74) return 0.05;
  if (field > 0.62) return 0.025;
  return 0;
}

function dryMaterialTone(x: number, y: number, seed: number): number {
  const broad = valueNoise(x, y, 97, seed);
  const drift = valueNoise(x, y, 37, seed ^ 0x85eb_ca6b);
  const field = broad * 0.76 + drift * 0.24;
  if (field < 0.28) return -0.07;
  if (field < 0.4) return -0.03;
  if (field > 0.76) return 0.06;
  if (field > 0.64) return 0.03;
  return 0;
}

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const gridX = Math.floor(x / scale);
  const gridY = Math.floor(y / scale);
  const fractionX = smoothStep((x % scale) / scale);
  const fractionY = smoothStep((y % scale) / scale);
  const top = interpolate(
    noiseCorner(gridX, gridY, seed),
    noiseCorner(gridX + 1, gridY, seed),
    fractionX,
  );
  const bottom = interpolate(
    noiseCorner(gridX, gridY + 1, seed),
    noiseCorner(gridX + 1, gridY + 1, seed),
    fractionX,
  );
  return interpolate(top, bottom, fractionY);
}

function noiseCorner(x: number, y: number, seed: number): number {
  let value = seed ^ Math.imul(x, 0x9e37_79b1) ^ Math.imul(y, 0x85eb_ca77);
  value = Math.imul(value ^ (value >>> 16), 0x7feb_352d);
  value = Math.imul(value ^ (value >>> 15), 0x846c_a68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffff_ffff;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function shadeColor(color: readonly number[], amount: number): readonly number[] {
  const target = amount < 0 ? 0 : 255;
  const strength = Math.abs(amount);
  return [
    Math.round((color[0] ?? 0) * (1 - strength) + target * strength),
    Math.round((color[1] ?? 0) * (1 - strength) + target * strength),
    Math.round((color[2] ?? 0) * (1 - strength) + target * strength),
    255,
  ];
}

function mixColor(
  first: readonly number[],
  second: readonly number[],
  amount: number,
): readonly number[] {
  return [
    Math.round((first[0] ?? 0) * (1 - amount) + (second[0] ?? 0) * amount),
    Math.round((first[1] ?? 0) * (1 - amount) + (second[1] ?? 0) * amount),
    Math.round((first[2] ?? 0) * (1 - amount) + (second[2] ?? 0) * amount),
    255,
  ];
}

function regionColorRole(landform: number, biome: number): string {
  if (landform === LandformCode.DeepOcean) return 'water_deep';
  if (landform === LandformCode.OpenOcean) return 'water_mid';
  if (landform === LandformCode.ShallowWater) return 'water_light';
  const cold = biome === BiomeCode.Tundra || biome === BiomeCode.Polar;
  if (landform === LandformCode.Coast) return cold ? 'coast_ice' : 'coast_sand';
  if (landform === LandformCode.Highland) return cold ? 'cold_highland' : 'highland';
  if (landform === LandformCode.Mountain) return cold ? 'cold_mountain' : 'mountain';
  return biome === BiomeCode.Woodland
    ? 'ground_woodland'
    : biome === BiomeCode.Rainforest
      ? 'ground_rainforest'
      : biome === BiomeCode.Savanna
        ? 'ground_savanna'
        : biome === BiomeCode.Desert
          ? 'ground_desert'
          : biome === BiomeCode.Wetland
            ? 'ground_wetland'
            : biome === BiomeCode.Tundra
              ? 'ground_tundra'
              : biome === BiomeCode.Polar
                ? 'ground_polar'
                : 'ground_grass';
}

function regionBaseColors(catalog: VisualCatalog): ReadonlyMap<string, readonly number[]> {
  const roles = [
    'water_deep',
    'water_mid',
    'water_light',
    'coast_sand',
    'coast_ice',
    'highland',
    'mountain',
    'cold_highland',
    'cold_mountain',
    'ground_grass',
    'ground_woodland',
    'ground_rainforest',
    'ground_savanna',
    'ground_desert',
    'ground_wetland',
    'ground_tundra',
    'ground_polar',
    'grass_edge',
    'rock_highlight',
    'rock_shadow',
    'cold_rock_shadow',
    'corruption_ground',
    'corruption_accent',
    'shadow',
    'darkest',
  ];
  return new Map(
    roles.map((role) => [role, [...hexToRgb(catalog.getPaletteColor('world.base', role)), 255]]),
  );
}

function transitionTint(
  landform: number,
  biome: number,
  catalog: VisualCatalog,
): readonly number[] {
  const base = hexToRgb(catalog.getPaletteColor('world.base', regionColorRole(landform, biome)));
  const highlight = hexToRgb(catalog.getPaletteColor('world.base', 'highlight'));
  const amount = landform === LandformCode.Coast ? 0.42 : 0.2;
  return base.map((channel, index) =>
    Math.round(channel * (1 - amount) + (highlight[index] ?? channel) * amount),
  );
}

function fillImageDataCell(
  imageData: ImageData,
  width: number,
  x: number,
  y: number,
  color: readonly number[],
): void {
  for (let offsetY = 0; offsetY < CELL_PIXELS; offsetY += 1) {
    for (let offsetX = 0; offsetX < CELL_PIXELS; offsetX += 1) {
      const pixel = ((y + offsetY) * width + x + offsetX) * 4;
      imageData.data[pixel] = color[0] ?? 0;
      imageData.data[pixel + 1] = color[1] ?? 0;
      imageData.data[pixel + 2] = color[2] ?? 0;
      imageData.data[pixel + 3] = color[3] ?? 255;
    }
  }
}

function drawWaterEffect(plan: RenderChunkPlan): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width * CELL_PIXELS;
  canvas.height = plan.height * CELL_PIXELS;
  const context = requiredContext(canvas);
  context.fillStyle = '#ffffff';
  for (let cell = 0; cell < plan.landforms.length; cell += 1) {
    const landform = plan.landforms[cell] ?? LandformCode.DeepOcean;
    if (landform > LandformCode.Coast || landform === LandformCode.DeepOcean) continue;
    const seed = Math.imul(cell + 1, 0x9e3779b1) >>> 0;
    const frequency =
      landform === LandformCode.Coast ? 7 : landform === LandformCode.ShallowWater ? 13 : 19;
    if (seed % frequency !== 0) continue;
    const x = (cell % plan.width) * CELL_PIXELS;
    const y = Math.floor(cell / plan.width) * CELL_PIXELS;
    context.globalAlpha = landform === LandformCode.Coast ? 0.85 : 0.5;
    context.fillRect(x + ((seed >>> 8) % 3), y + ((seed >>> 12) % 4), 2, 1);
  }
  context.globalAlpha = 1;
  return canvas;
}

function drawAutotileDebug(plan: RenderChunkPlan): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = requiredContext(canvas);
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let cell = 0; cell < plan.autotileTopology.length; cell += 1) {
    const code = plan.autotileTopology[cell] ?? 0;
    const [red, green, blue] = hslToRgb((code / 46) * 300, 0.8, 0.58);
    const pixel = cell * 4;
    pixels.data[pixel] = red;
    pixels.data[pixel + 1] = green;
    pixels.data[pixel + 2] = blue;
    pixels.data[pixel + 3] = 184;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function drawStructureDebug(plan: RenderChunkPlan): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = requiredContext(canvas);
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let cell = 0; cell < plan.baseVisuals.length; cell += 1) {
    const bridge = plan.biomeBridges[cell] ?? 0;
    const elevation = plan.elevationBands[cell] ?? 0;
    const theme = plan.themeBands[cell] ?? 0;
    const pixel = cell * 4;
    pixels.data[pixel] = theme > 0 ? 196 : elevation > 0 ? 224 : bridge > 0 ? 84 : 0;
    pixels.data[pixel + 1] = theme > 0 ? 74 : elevation > 0 ? 184 : bridge > 0 ? 208 : 0;
    pixels.data[pixel + 2] = theme > 0 ? 224 : elevation > 0 ? 72 : bridge > 0 ? 142 : 0;
    pixels.data[pixel + 3] = bridge + elevation + theme > 0 ? 210 : 0;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function hexToRgb(color: string): readonly [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function hslToRgb(hueDegrees: number, saturation: number, lightness: number): readonly number[] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = hueDegrees / 60;
  const component = chroma * (1 - Math.abs((hue % 2) - 1));
  const [red, green, blue] =
    hue < 1
      ? [chroma, component, 0]
      : hue < 2
        ? [component, chroma, 0]
        : hue < 3
          ? [0, chroma, component]
          : hue < 4
            ? [0, component, chroma]
            : hue < 5
              ? [component, 0, chroma]
              : [chroma, 0, component];
  const match = lightness - chroma / 2;
  return [red, green, blue].map((channel) => Math.round((channel + match) * 255));
}

function canvasFromRgba(width: number, height: number, rgba: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = requiredContext(canvas);
  const imageData = context.createImageData(width, height);
  imageData.data.set(rgba);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function worldSprite(canvas: HTMLCanvasElement): Sprite {
  const sprite = spriteFromCanvas(canvas);
  sprite.scale.set(CELL_PIXELS);
  return sprite;
}

function chunkSprite(canvas: HTMLCanvasElement, chunkX: number, chunkY: number): Sprite {
  const sprite = spriteFromCanvas(canvas);
  sprite.position.set(chunkX * CELL_PIXELS, chunkY * CELL_PIXELS);
  return sprite;
}

function spriteFromCanvas(canvas: HTMLCanvasElement): Sprite {
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  const sprite = new Sprite({ texture });
  sprite.roundPixels = true;
  return sprite;
}

function requiredContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Unable to create map raster canvas');
  context.imageSmoothingEnabled = false;
  return context;
}

function loadImage(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const abort = () => {
      image.src = '';
      reject(new DOMException('Map asset loading cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      signal.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error(`Unable to load map atlas: ${source}`));
    };
    image.src = source;
  });
}

function loadAtlasPixels(element: HTMLImageElement): LoadedAtlasImage {
  const canvas = document.createElement('canvas');
  canvas.width = element.naturalWidth;
  canvas.height = element.naturalHeight;
  const context = requiredContext(canvas);
  context.drawImage(element, 0, 0);
  return { element, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
}

function destroyRenderedChunk(chunk: RenderedChunk): void {
  chunk.ground.removeFromParent();
  chunk.ground.destroy({ texture: true, textureSource: true });
  chunk.waterEffect.removeFromParent();
  chunk.waterEffect.destroy({ texture: true, textureSource: true });
  chunk.autotileDebug.removeFromParent();
  chunk.autotileDebug.destroy({ texture: true, textureSource: true });
  chunk.structureDebug.removeFromParent();
  chunk.structureDebug.destroy({ texture: true, textureSource: true });
  for (const sprite of [
    ...chunk.shadows,
    ...chunk.lowCover,
    ...chunk.upright,
    ...chunk.foreground,
  ]) {
    sprite.removeFromParent();
    sprite.destroy({ texture: false, textureSource: false });
  }
}

function clearLayer(layer: Container): void {
  for (const child of layer.removeChildren()) child.destroy({ children: true, texture: true });
}

function chunkIndexAt(chunkX: number, chunkY: number): number {
  return Math.floor(chunkY / CHUNK_SIZE) * CHUNKS_PER_AXIS + Math.floor(chunkX / CHUNK_SIZE);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Map preparation cancelled', 'AbortError');
}
