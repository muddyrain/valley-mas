import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import {
  AgentState,
  BuildingType,
  DiplomacyState,
  EntityKind,
  GodPower,
  Profession,
  ResidentRole,
  ResourceNodeKind,
  ResourceNodeStage,
  TerrainType,
  type WorldSettings,
} from '@/shared/gameTypes';
import {
  attackThrustFrame,
  combatHealthBar,
  shouldEmitDeathPuff,
  shouldFlashFromDamage,
} from './combatFeedback';
import { humanAgeScale } from './entityAppearance';
import {
  buildingInteractionGeometry,
  entityInteractionGeometry,
  type InteractionGeometry,
  interactionStrokeWidth,
} from './interactionFeedback';
import { buildingFeedback, shouldEmitAttackHit } from './mapFeedback';
import {
  createPixelCamera,
  type PixelCamera,
  panPixelCamera,
  resizePixelCamera,
  screenToWorldCell,
  WORLD_PIXELS_PER_CELL,
  worldToScreen,
  zoomCameraAt,
} from './pixelCamera';
import type {
  RenderSnapshot,
  ResourceNodeSnapshot,
  WorldMapDelta,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from './renderTypes';
import { SnapshotInterpolator } from './SnapshotInterpolator';
import type { WorldViewLevel } from './strategicView';

export interface RuntimeMetrics {
  fps: number;
  frameP95Ms: number;
  drawCalls: number;
  triangles: number;
  longTasks: number;
  tickMs: number;
  averageTickMs: number;
  pathQueue: number;
  completedPaths: number;
}

export interface WorldClick {
  cell: number;
  entityId?: number;
  buildingId?: number;
  villageId?: number;
  resourceNodeId?: number;
}

export interface WorldSelection {
  kind: 'entity' | 'building' | 'village' | 'resource';
  id: number;
}

export interface ResourceHoverInfo {
  name: string;
  stage: string;
  amount: number;
  screenX: number;
  screenY: number;
}

export interface EonValeEngineOptions {
  onMetrics: (metrics: RuntimeMetrics) => void;
  onWorldClick?: (click: WorldClick) => void;
  onViewLevelChange?: (level: WorldViewLevel) => void;
  onResourceHover?: (info: ResourceHoverInfo | null) => void;
}

const RENDER_CHUNK_SIZE = 64;
const SOURCE_PIXELS_PER_CELL = 4;
const ENTITY_SOURCE_SCALE = WORLD_PIXELS_PER_CELL / 16;
const KINGDOM_COLORS = [
  '#d6c195',
  '#dd6257',
  '#4d87d6',
  '#e2b84d',
  '#61a85f',
  '#9a6ccb',
  '#3ca79a',
];
const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.DeepOcean]: '#235a70',
  [TerrainType.ShallowOcean]: '#3f8796',
  [TerrainType.Beach]: '#d7bd76',
  [TerrainType.Grass]: '#78a960',
  [TerrainType.Forest]: '#4c7f50',
  [TerrainType.Desert]: '#cda466',
  [TerrainType.Snow]: '#dce8df',
  [TerrainType.Mountain]: '#7b837a',
};
const POWER_COLORS: Record<GodPower, number> = {
  [GodPower.Rain]: 0x68b9db,
  [GodPower.Lightning]: 0xffe46b,
  [GodPower.Fire]: 0xf06445,
  [GodPower.Tornado]: 0xc8d0ca,
  [GodPower.Meteor]: 0xff974f,
  [GodPower.Plague]: 0x9ace5b,
  [GodPower.Blessing]: 0xf8dc70,
  [GodPower.Heal]: 0x74d8a0,
  [GodPower.Rage]: 0xe35d59,
  [GodPower.Diplomacy]: 0xa6c4ff,
  [GodPower.Curse]: 0x9b68c7,
  [GodPower.Growth]: 0x79c95b,
  [GodPower.Frost]: 0xa8ddf0,
  [GodPower.Earthquake]: 0xb98559,
  [GodPower.Purify]: 0xe5fff2,
  [GodPower.Fertility]: 0xf09bbb,
};

interface TerrainChunkRecord {
  x: number;
  z: number;
  cellsWide: number;
  cellsHigh: number;
  canvas: HTMLCanvasElement;
  texture: Texture;
  sprite: Sprite;
  overviewCanvas: HTMLCanvasElement;
  overviewTexture: Texture;
  overviewSprite: Sprite;
  residentCanvas: HTMLCanvasElement;
  residentTexture: Texture;
  residentSprite: Sprite;
}

interface TransientEffect {
  x: number;
  z: number;
  radius: number;
  color: number;
  startedAt: number;
  duration: number;
  kind: 'power' | 'attack' | 'death';
}

interface CameraTween {
  startedAt: number;
  duration: number;
  fromX: number;
  fromZ: number;
  fromZoom: number;
  toX: number;
  toZ: number;
  toZoom: number;
}

interface ClientResourceNodes {
  count: number;
  active: Uint8Array;
  kind: Uint8Array;
  positionsX: Float32Array;
  positionsZ: Float32Array;
  amount: Uint16Array;
  stage: Uint8Array;
  variant: Uint8Array;
}

class PixelTextureFactory {
  private readonly textures = new Map<string, Texture>();

  human(
    id: number,
    profession: Profession,
    kingdomId: number,
    role: ResidentRole,
    weaponTier: number,
    armorTier: number,
  ): Texture {
    const key = `human:${id % 12}:${profession}:${kingdomId}:${role}:${weaponTier}:${armorTier}`;
    return this.get(key, 16, 20, (context) => {
      const skin = ['#f3c7a1', '#dca77f', '#bb7d59', '#8b593e'][id % 4] ?? '#e1aa82';
      const hair =
        ['#3a2b25', '#65452f', '#c18a47', '#22282e'][Math.floor(id / 2) % 4] ?? '#3a2b25';
      const kingdom = kingdomColor(kingdomId);
      const cloth = profession === Profession.Guard ? shade(kingdom, 0.82) : kingdom;
      const pants = armorTier > 0 ? '#596571' : '#4d5149';
      context.fillStyle = 'rgba(20, 31, 28, 0.25)';
      context.fillRect(4, 18, 9, 2);
      context.fillStyle = pants;
      context.fillRect(5, 13, 3, 5);
      context.fillRect(9, 13, 3, 5);
      context.fillStyle = cloth;
      context.fillRect(4, 8, 9, 7);
      context.fillStyle = shade(cloth, 1.22);
      context.fillRect(5, 8, 7, 2);
      if (armorTier > 0) {
        context.fillStyle = armorTier >= 3 ? '#d6dce0' : armorTier === 2 ? '#9eabb2' : '#7f8b91';
        context.fillRect(5, 9, 7, 4);
        context.fillStyle = '#54616a';
        context.fillRect(7, 9, 1, 4);
      }
      context.fillStyle = skin;
      context.fillRect(1, 9, 3, 6);
      context.fillRect(13, 9, 2, 6);
      context.fillRect(5, 3, 7, 6);
      context.fillStyle = hair;
      context.fillRect(5, 2, 7, 3);
      context.fillRect(4, 3, 2, 4);
      if ((id + profession) % 3 === 0) context.fillRect(11, 4, 2, 3);
      context.fillStyle = '#25272a';
      context.fillRect(6, 6, 1, 1);
      context.fillRect(10, 6, 1, 1);
      drawProfession(context, profession, weaponTier);
      drawRole(context, role);
    });
  }

  animal(kind: EntityKind, variant: number): Texture {
    const key = `animal:${kind}:${variant % 4}`;
    const width = kind === EntityKind.Bear || kind === EntityKind.Cow ? 24 : 20;
    return this.get(key, width, 16, (context) => drawAnimal(context, kind, variant));
  }

  building(type: BuildingType, kingdomId: number, stage: number, damaged: boolean): Texture {
    const key = `building:${type}:${kingdomId}:${stage}:${damaged ? 1 : 0}`;
    return this.get(key, 48, 44, (context) =>
      drawBuilding(context, type, kingdomColor(kingdomId), stage, damaged),
    );
  }

  destroy(): void {
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }

  private get(
    key: string,
    width: number,
    height: number,
    draw: (context: CanvasRenderingContext2D) => void,
  ): Texture {
    const cached = this.textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('无法创建像素纹理');
    context.imageSmoothingEnabled = false;
    draw(context);
    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'nearest';
    texture.source.autoGenerateMipmaps = false;
    this.textures.set(key, texture);
    return texture;
  }
}

export class EonValeEngine {
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly terrainLayer = new Container();
  private readonly territoryLayer = new Graphics({ roundPixels: true });
  private readonly buildingLayer = new Container();
  private readonly entityLayer = new Container();
  private readonly statusLayer = new Graphics({ roundPixels: true });
  private readonly combatStatusLayer = new Graphics({ roundPixels: true });
  private readonly interactionLayer = new Graphics({ roundPixels: true });
  private readonly effectLayer = new Graphics({ roundPixels: true });
  private readonly labelLayer = new Container();
  private readonly interpolator = new SnapshotInterpolator();
  private readonly textureFactory = new PixelTextureFactory();
  private readonly terrainChunks = new Map<number, TerrainChunkRecord>();
  private readonly entitySprites: Sprite[] = [];
  private readonly entityTextureKeys: string[] = [];
  private readonly buildingSprites = new Map<number, Sprite>();
  private readonly buildingTextureKeys = new Map<number, string>();
  private readonly settlementLabels = new Map<number, Text>();
  private readonly lastAttackFeedbackTicks = new Map<number, number>();
  private readonly transientEffects: TransientEffect[] = [];
  private readonly damageFlashUntil = new Map<number, number>();
  private previousEntityActive = new Uint8Array();
  private previousEntityHealth = new Uint16Array();
  private readonly initializePromise: Promise<void>;
  private map: WorldMapSnapshot | null = null;
  private snapshot: WorldRenderSnapshot | null = null;
  private resourceNodes: ClientResourceNodes | null = null;
  private readonly resourceBuckets = new Map<number, number[]>();
  private camera: PixelCamera;
  private cameraTween: CameraTween | null = null;
  private selectedTarget: WorldSelection | null = null;
  private hoveredTarget: WorldSelection | null = null;
  private overlay: WorldSettings['overlay'] = 'none';
  private brushRadius = 2;
  private brushVisible = false;
  private brushPoint: { x: number; z: number } | null = null;
  private viewLevel: WorldViewLevel = 'world';
  private started = false;
  private tickerAttached = false;
  private ready = false;
  private disposed = false;
  private pointerDown: { x: number; y: number; cameraX: number; cameraZ: number } | null = null;
  private pointerMoved = false;
  private frameSamples: number[] = [];
  private lastFrameAt = performance.now();
  private metricsElapsed = 0;
  private longTasks = 0;
  private observer: PerformanceObserver | null = null;
  private visibleEntities = 0;
  private totalAttackHits = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: EonValeEngineOptions,
  ) {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    this.camera = createPixelCamera(256, 0.5, width, height);
    this.writeStaticDatasets();
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    window.addEventListener('resize', this.resize);
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        this.longTasks += list.getEntries().length;
      });
      try {
        this.observer.observe({ type: 'longtask', buffered: true });
      } catch {
        this.observer = null;
      }
    }
    this.initializePromise = this.initialize();
  }

  pushSnapshot(snapshot: RenderSnapshot): void {
    if ('buildings' in snapshot) this.collectCombatTransitions(snapshot as WorldRenderSnapshot);
    this.interpolator.push(snapshot);
    this.canvas.dataset.population = String(snapshot.population);
    this.canvas.dataset.tick = String(snapshot.tick);
    if ('buildings' in snapshot) {
      this.snapshot = snapshot as WorldRenderSnapshot;
      if (this.ready) {
        this.updateBuildings();
        this.updateTerritories();
        this.updateSettlementLabels();
        this.collectAttackFeedback();
      }
    }
  }

  setWorldMap(map: WorldMapSnapshot): void {
    const fullRebuild = !this.map || this.map.size !== map.size || map.fullRebuild;
    this.map = map;
    this.canvas.dataset.mapSize = String(map.size);
    this.canvas.dataset.mapPreset = map.preset;
    this.canvas.dataset.mapRevision = String(Number(this.canvas.dataset.mapRevision ?? 0) + 1);
    this.canvas.dataset.activeFire = String(countActive(map.fire));
    this.canvas.dataset.activeRain = String(countActive(map.rain));
    if (fullRebuild) {
      this.canvas.dataset.fullRebuilds = String(Number(this.canvas.dataset.fullRebuilds ?? 0) + 1);
      this.camera = createPixelCamera(
        map.size,
        initialZoom(map.size),
        this.camera.viewportWidth,
        this.camera.viewportHeight,
      );
      this.setViewLevel(resolvePixelView(this.camera.zoom));
      this.setSelection(null);
    }
    if (!this.ready) return;
    if (fullRebuild) this.createTerrainChunks();
    else this.redrawTerrainChunks(map.changedChunks);
    this.updateWorldTransform();
  }

  applyWorldMapDelta(delta: WorldMapDelta): void {
    const map = this.map;
    if (!map) return;
    const renderChunksWide = Math.ceil(map.size / RENDER_CHUNK_SIZE);
    const targets = new Set<number>();
    for (let index = 0; index < delta.cells.length; index += 1) {
      const cell = delta.cells[index] ?? 0;
      if (cell >= map.terrain.length) continue;
      map.terrain[cell] = delta.terrain[index] ?? 0;
      map.height[cell] = delta.height[index] ?? 0;
      map.moisture[cell] = delta.moisture[index] ?? 0;
      map.temperature[cell] = delta.temperature[index] ?? 0;
      map.resourceFood[cell] = delta.resourceFood[index] ?? 0;
      map.fire[cell] = delta.fire[index] ?? 0;
      map.rain[cell] = delta.rain[index] ?? 0;
      map.plague[cell] = delta.plague[index] ?? 0;
      map.crops[cell] = delta.crops[index] ?? 0;
      map.craters[cell] = delta.craters[index] ?? 0;
      map.roads[cell] = delta.roads[index] ?? 0;
      const x = cell % map.size;
      const z = Math.floor(cell / map.size);
      targets.add(
        Math.floor(z / RENDER_CHUNK_SIZE) * renderChunksWide + Math.floor(x / RENDER_CHUNK_SIZE),
      );
    }
    this.canvas.dataset.mapDeltaCells = String(delta.cells.length);
    this.canvas.dataset.mapRevision = String(Number(this.canvas.dataset.mapRevision ?? 0) + 1);
    this.canvas.dataset.activeFire = String(countActive(map.fire));
    this.canvas.dataset.activeRain = String(countActive(map.rain));
    if (!this.ready) return;
    this.redrawRenderChunkTargets(targets);
  }

  setResourceNodes(snapshot: ResourceNodeSnapshot): void {
    const previous = this.resourceNodes;
    const previousCount = previous?.count ?? 0;
    const changedTargets = new Set<number>();
    if (previous && this.map && !snapshot.full) {
      for (const nodeId of snapshot.nodeIds) {
        if (nodeId >= previous.count) continue;
        this.addResourceRenderTarget(
          changedTargets,
          previous.positionsX[nodeId] ?? 0,
          previous.positionsZ[nodeId] ?? 0,
        );
      }
    }
    if (snapshot.full || !previous) {
      const capacity = Math.max(1, snapshot.count);
      this.resourceNodes = {
        count: snapshot.count,
        active: new Uint8Array(capacity),
        kind: new Uint8Array(capacity),
        positionsX: new Float32Array(capacity),
        positionsZ: new Float32Array(capacity),
        amount: new Uint16Array(capacity),
        stage: new Uint8Array(capacity),
        variant: new Uint8Array(capacity),
      };
      this.resourceBuckets.clear();
    } else if (snapshot.count > previous.active.length) {
      const capacity = Math.max(snapshot.count, previous.active.length * 2);
      previous.active = growClientArray(previous.active, capacity);
      previous.kind = growClientArray(previous.kind, capacity);
      previous.positionsX = growClientArray(previous.positionsX, capacity);
      previous.positionsZ = growClientArray(previous.positionsZ, capacity);
      previous.amount = growClientArray(previous.amount, capacity);
      previous.stage = growClientArray(previous.stage, capacity);
      previous.variant = growClientArray(previous.variant, capacity);
    }
    const resources = this.resourceNodes;
    if (!resources) return;
    resources.count = snapshot.count;
    for (let index = 0; index < snapshot.nodeIds.length; index += 1) {
      const nodeId = snapshot.nodeIds[index] ?? 0;
      resources.active[nodeId] = snapshot.active[index] ?? 0;
      resources.kind[nodeId] = snapshot.kind[index] ?? 0;
      resources.positionsX[nodeId] = snapshot.positionsX[index] ?? 0;
      resources.positionsZ[nodeId] = snapshot.positionsZ[index] ?? 0;
      resources.amount[nodeId] = snapshot.amount[index] ?? 0;
      resources.stage[nodeId] = snapshot.stage[index] ?? 0;
      resources.variant[nodeId] = snapshot.variant[index] ?? 0;
      this.addResourceRenderTarget(
        changedTargets,
        resources.positionsX[nodeId] ?? 0,
        resources.positionsZ[nodeId] ?? 0,
      );
      if (snapshot.full || nodeId >= previousCount) this.addResourceBucket(nodeId);
    }
    this.canvas.dataset.resourceNodes = String(resources.count);
    this.canvas.dataset.resourceDeltaUpdates = String(
      Number(this.canvas.dataset.resourceDeltaUpdates ?? 0) + (snapshot.full ? 0 : 1),
    );
    if (!this.ready) return;
    if (snapshot.full) {
      for (const record of this.terrainChunks.values()) this.drawTerrainChunk(record);
    } else {
      this.redrawRenderChunkTargets(changedTargets);
    }
  }

  private addResourceBucket(nodeId: number): void {
    const resources = this.resourceNodes;
    const map = this.map;
    if (!resources || !map) return;
    const columns = Math.ceil(map.size / 8);
    const bucket =
      Math.floor((resources.positionsZ[nodeId] ?? 0) / 8) * columns +
      Math.floor((resources.positionsX[nodeId] ?? 0) / 8);
    const nodes = this.resourceBuckets.get(bucket) ?? [];
    nodes.push(nodeId);
    this.resourceBuckets.set(bucket, nodes);
  }

  private addResourceRenderTarget(targets: Set<number>, x: number, z: number): void {
    const map = this.map;
    if (!map) return;
    const columns = Math.ceil(map.size / RENDER_CHUNK_SIZE);
    const chunkX = Math.max(0, Math.min(columns - 1, Math.floor(x / RENDER_CHUNK_SIZE)));
    const chunkZ = Math.max(0, Math.min(columns - 1, Math.floor(z / RENDER_CHUNK_SIZE)));
    targets.add(chunkZ * columns + chunkX);
  }

  private redrawRenderChunkTargets(targets: Set<number>): void {
    for (const target of targets) {
      const record = this.terrainChunks.get(target);
      if (record) this.drawTerrainChunk(record);
    }
  }

  setBrush(radius: number, visible: boolean): void {
    this.brushRadius = Math.max(1, radius);
    this.brushVisible = visible;
    if (visible) this.setHoveredTarget(null);
    this.canvas.style.cursor = visible ? 'crosshair' : 'grab';
    this.redrawInteraction();
  }

  playGodEffect(power: GodPower, cell: number, radius: number): void {
    const map = this.map;
    if (!map) return;
    this.transientEffects.push({
      x: (cell % map.size) + 0.5,
      z: Math.floor(cell / map.size) + 0.5,
      radius,
      color: POWER_COLORS[power],
      startedAt: performance.now(),
      duration: power === GodPower.Meteor || power === GodPower.Tornado ? 1_100 : 820,
      kind: 'power',
    });
  }

  setSelection(selection: WorldSelection | null): void {
    this.selectedTarget = selection;
    if (selection) this.canvas.dataset.selectedTarget = `${selection.kind}:${selection.id}`;
    else delete this.canvas.dataset.selectedTarget;
    this.canvas.dataset.selectionOutline = String(Boolean(selection));
    this.redrawInteraction();
  }

  setQuality(quality: WorldSettings['quality']): void {
    if (!this.ready) return;
    this.app.renderer.resolution = Math.min(
      window.devicePixelRatio,
      quality === 'low' ? 1 : quality === 'medium' ? 1.25 : 1.5,
    );
    this.resize();
  }

  setOverlay(overlay: WorldSettings['overlay']): void {
    if (this.overlay === overlay) return;
    this.overlay = overlay;
    if (this.ready) this.redrawTerrainChunks([]);
  }

  focusOn(x: number, z: number, level: Exclude<WorldViewLevel, 'world'> = 'settlement'): void {
    this.cameraTween = {
      startedAt: performance.now(),
      duration: 320,
      fromX: this.camera.centerX,
      fromZ: this.camera.centerZ,
      fromZoom: this.camera.zoom,
      toX: clamp(x, 0, this.map?.size ?? 256),
      toZ: clamp(z, 0, this.map?.size ?? 256),
      toZoom: level === 'resident' ? 4 : 1.5,
    };
    this.canvas.dataset.focus = `${x.toFixed(1)},${z.toFixed(1)}`;
  }

  returnToWorld(): void {
    const size = this.map?.size ?? 256;
    this.cameraTween = {
      startedAt: performance.now(),
      duration: 420,
      fromX: this.camera.centerX,
      fromZ: this.camera.centerZ,
      fromZoom: this.camera.zoom,
      toX: size / 2,
      toZ: size / 2,
      toZoom: initialZoom(size),
    };
    this.canvas.dataset.focus = 'world';
  }

  start(): void {
    this.started = true;
    void this.initializePromise.then(() => this.attachTicker());
  }

  dispose(): void {
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    window.removeEventListener('resize', this.resize);
    this.observer?.disconnect();
    if (!this.ready) return;
    this.app.ticker.remove(this.tick);
    for (const chunk of this.terrainChunks.values()) {
      chunk.texture.destroy(true);
      chunk.overviewTexture.destroy(true);
      chunk.residentTexture.destroy(true);
    }
    this.terrainChunks.clear();
    this.textureFactory.destroy();
    this.app.destroy({ removeView: false }, { children: true });
  }

  private async initialize(): Promise<void> {
    await this.app.init({
      canvas: this.canvas,
      width: Math.max(1, this.canvas.clientWidth || window.innerWidth),
      height: Math.max(1, this.canvas.clientHeight || window.innerHeight),
      preference: 'webgl',
      powerPreference: 'high-performance',
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 1.5),
      backgroundColor: 0x174b61,
      backgroundAlpha: 1,
      autoStart: false,
    });
    if (this.disposed) {
      this.app.destroy({ removeView: false });
      return;
    }
    this.ready = true;
    this.world.addChild(
      this.terrainLayer,
      this.territoryLayer,
      this.buildingLayer,
      this.entityLayer,
      this.statusLayer,
      this.combatStatusLayer,
      this.interactionLayer,
      this.effectLayer,
    );
    this.app.stage.addChild(this.world, this.labelLayer);
    this.resize();
    if (this.map) this.createTerrainChunks();
    if (this.snapshot) {
      this.updateBuildings();
      this.updateTerritories();
      this.updateSettlementLabels();
    }
    if (this.started) this.attachTicker();
  }

  private attachTicker(): void {
    if (!this.ready || this.tickerAttached || this.disposed) return;
    this.tickerAttached = true;
    this.lastFrameAt = performance.now();
    this.app.ticker.add(this.tick);
    this.app.ticker.start();
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const frameMs = Math.max(0.1, now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.frameSamples.push(frameMs);
    if (this.frameSamples.length > 240) this.frameSamples.splice(0, this.frameSamples.length - 240);
    this.metricsElapsed += frameMs;
    this.updateCameraTween(now);
    this.updateWorldTransform();
    this.updateEntities(now);
    this.redrawCombatStatus();
    this.updateSettlementLabelPositions();
    this.redrawInteraction();
    this.redrawEffects(now);
    if (this.metricsElapsed >= 1_000) {
      this.metricsElapsed = 0;
      this.emitMetrics();
    }
  };

  private readonly resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.camera = resizePixelCamera(this.camera, width, height);
    if (this.ready) this.app.renderer.resize(width, height);
    this.updateWorldTransform();
  };

  private createTerrainChunks(): void {
    for (const chunk of this.terrainChunks.values()) {
      this.terrainLayer.removeChild(chunk.sprite);
      this.terrainLayer.removeChild(chunk.overviewSprite);
      this.terrainLayer.removeChild(chunk.residentSprite);
      chunk.texture.destroy(true);
      chunk.overviewTexture.destroy(true);
      chunk.residentTexture.destroy(true);
    }
    this.terrainChunks.clear();
    const map = this.map;
    if (!map) return;
    const chunksWide = Math.ceil(map.size / RENDER_CHUNK_SIZE);
    for (let chunkZ = 0; chunkZ < chunksWide; chunkZ += 1) {
      for (let chunkX = 0; chunkX < chunksWide; chunkX += 1) {
        const x = chunkX * RENDER_CHUNK_SIZE;
        const z = chunkZ * RENDER_CHUNK_SIZE;
        const cellsWide = Math.min(RENDER_CHUNK_SIZE, map.size - x);
        const cellsHigh = Math.min(RENDER_CHUNK_SIZE, map.size - z);
        const canvas = document.createElement('canvas');
        canvas.width = cellsWide * SOURCE_PIXELS_PER_CELL;
        canvas.height = cellsHigh * SOURCE_PIXELS_PER_CELL;
        const texture = Texture.from(canvas);
        texture.source.scaleMode = 'nearest';
        texture.source.autoGenerateMipmaps = false;
        const sprite = new Sprite({ texture, roundPixels: true });
        sprite.position.set(x * WORLD_PIXELS_PER_CELL, z * WORLD_PIXELS_PER_CELL);
        const overviewCanvas = document.createElement('canvas');
        overviewCanvas.width = cellsWide;
        overviewCanvas.height = cellsHigh;
        const overviewTexture = Texture.from(overviewCanvas);
        overviewTexture.source.scaleMode = 'nearest';
        overviewTexture.source.autoGenerateMipmaps = false;
        const overviewSprite = new Sprite({ texture: overviewTexture, roundPixels: true });
        overviewSprite.position.set(x * WORLD_PIXELS_PER_CELL, z * WORLD_PIXELS_PER_CELL);
        overviewSprite.scale.set(WORLD_PIXELS_PER_CELL);
        const residentCanvas = document.createElement('canvas');
        residentCanvas.width = cellsWide * SOURCE_PIXELS_PER_CELL;
        residentCanvas.height = cellsHigh * SOURCE_PIXELS_PER_CELL;
        const residentTexture = Texture.from(residentCanvas);
        residentTexture.source.scaleMode = 'nearest';
        residentTexture.source.autoGenerateMipmaps = false;
        const residentSprite = new Sprite({ texture: residentTexture, roundPixels: true });
        residentSprite.position.set(x * WORLD_PIXELS_PER_CELL, z * WORLD_PIXELS_PER_CELL);
        overviewSprite.visible = this.viewLevel === 'world';
        sprite.visible = this.viewLevel === 'settlement';
        residentSprite.visible = this.viewLevel === 'resident';
        this.terrainLayer.addChild(overviewSprite, sprite, residentSprite);
        const index = chunkZ * chunksWide + chunkX;
        const record = {
          x,
          z,
          cellsWide,
          cellsHigh,
          canvas,
          texture,
          sprite,
          overviewCanvas,
          overviewTexture,
          overviewSprite,
          residentCanvas,
          residentTexture,
          residentSprite,
        };
        this.terrainChunks.set(index, record);
        this.drawTerrainChunk(record);
      }
    }
    this.canvas.dataset.terrainChunks = String(this.terrainChunks.size);
    this.canvas.dataset.pixelTiles = 'true';
  }

  private redrawTerrainChunks(changedNavigationChunks: number[]): void {
    const map = this.map;
    if (!map) return;
    if (changedNavigationChunks.length === 0) {
      for (const record of this.terrainChunks.values()) this.drawTerrainChunk(record);
      return;
    }
    const renderChunksWide = Math.ceil(map.size / RENDER_CHUNK_SIZE);
    const navigationChunksWide = Math.ceil(map.size / 16);
    const targets = new Set<number>();
    for (const chunk of changedNavigationChunks) {
      const navigationX = chunk % navigationChunksWide;
      const navigationZ = Math.floor(chunk / navigationChunksWide);
      const renderX = Math.floor((navigationX * 16) / RENDER_CHUNK_SIZE);
      const renderZ = Math.floor((navigationZ * 16) / RENDER_CHUNK_SIZE);
      targets.add(renderZ * renderChunksWide + renderX);
    }
    for (const target of targets) {
      const record = this.terrainChunks.get(target);
      if (record) this.drawTerrainChunk(record);
    }
  }

  private drawTerrainChunk(record: TerrainChunkRecord): void {
    const map = this.map;
    if (!map) return;
    const context = record.canvas.getContext('2d');
    const overviewContext = record.overviewCanvas.getContext('2d');
    const residentContext = record.residentCanvas.getContext('2d');
    if (!context || !overviewContext || !residentContext) return;
    context.imageSmoothingEnabled = false;
    overviewContext.imageSmoothingEnabled = false;
    residentContext.imageSmoothingEnabled = false;
    context.clearRect(0, 0, record.canvas.width, record.canvas.height);
    overviewContext.clearRect(0, 0, record.overviewCanvas.width, record.overviewCanvas.height);
    residentContext.clearRect(0, 0, record.residentCanvas.width, record.residentCanvas.height);
    for (let localZ = 0; localZ < record.cellsHigh; localZ += 1) {
      for (let localX = 0; localX < record.cellsWide; localX += 1) {
        const x = record.x + localX;
        const z = record.z + localZ;
        const cell = z * map.size + x;
        const terrain = map.terrain[cell] as TerrainType;
        const variation = ((x * 17 + z * 31) % 7) - 3;
        const terrainColor = overlayTerrainColor(map, cell, this.overlay, variation);
        context.fillStyle = terrainColor;
        residentContext.fillStyle = terrainColor;
        overviewContext.fillStyle = overlayTerrainColor(map, cell, this.overlay, 0);
        overviewContext.fillRect(localX, localZ, 1, 1);
        context.fillRect(
          localX * SOURCE_PIXELS_PER_CELL,
          localZ * SOURCE_PIXELS_PER_CELL,
          SOURCE_PIXELS_PER_CELL,
          SOURCE_PIXELS_PER_CELL,
        );
        residentContext.fillRect(
          localX * SOURCE_PIXELS_PER_CELL,
          localZ * SOURCE_PIXELS_PER_CELL,
          SOURCE_PIXELS_PER_CELL,
          SOURCE_PIXELS_PER_CELL,
        );
        drawTerrainDetail(context, map, cell, terrain, localX, localZ, 'districts');
        drawTerrainDetail(residentContext, map, cell, terrain, localX, localZ, 'resident');
      }
    }
    this.drawResourceNodes(record, context, overviewContext, residentContext);
    record.texture.source.update();
    record.overviewTexture.source.update();
    record.residentTexture.source.update();
  }

  private drawResourceNodes(
    record: TerrainChunkRecord,
    settlementContext: CanvasRenderingContext2D,
    overviewContext: CanvasRenderingContext2D,
    residentContext: CanvasRenderingContext2D,
  ): void {
    const resources = this.resourceNodes;
    const map = this.map;
    if (!resources || !map) return;
    const maxX = record.x + record.cellsWide;
    const maxZ = record.z + record.cellsHigh;
    const bucketColumns = Math.ceil(map.size / 8);
    const startBucketX = Math.floor(record.x / 8);
    const endBucketX = Math.floor((maxX - 0.001) / 8);
    const startBucketZ = Math.floor(record.z / 8);
    const endBucketZ = Math.floor((maxZ - 0.001) / 8);
    for (let bucketZ = startBucketZ; bucketZ <= endBucketZ; bucketZ += 1) {
      for (let bucketX = startBucketX; bucketX <= endBucketX; bucketX += 1) {
        for (const nodeId of this.resourceBuckets.get(bucketZ * bucketColumns + bucketX) ?? []) {
          if (resources.active[nodeId] !== 1) continue;
          const x = resources.positionsX[nodeId] ?? 0;
          const z = resources.positionsZ[nodeId] ?? 0;
          if (x < record.x || z < record.z || x >= maxX || z >= maxZ) continue;
          const kind = resources.kind[nodeId] as ResourceNodeKind;
          const stage = resources.stage[nodeId] as ResourceNodeStage;
          const variant = resources.variant[nodeId] ?? 0;
          const sourceX = Math.floor((x - record.x) * SOURCE_PIXELS_PER_CELL);
          const sourceZ = Math.floor((z - record.z) * SOURCE_PIXELS_PER_CELL) + 2;
          drawResourceNodeGlyph(residentContext, kind, stage, variant, sourceX, sourceZ, true);
          const sampleRate =
            kind === ResourceNodeKind.Tree ? 3 : kind === ResourceNodeKind.Stone ? 2 : 1;
          if ((nodeId * 17 + variant * 7) % sampleRate === 0) {
            drawResourceNodeGlyph(settlementContext, kind, stage, variant, sourceX, sourceZ, false);
          }
          if (this.overlay === 'resources') {
            overviewContext.fillStyle =
              kind === ResourceNodeKind.Tree
                ? '#2d7745'
                : kind === ResourceNodeKind.Stone
                  ? '#a4aaa7'
                  : '#5d6d78';
            overviewContext.fillRect(Math.floor(x - record.x), Math.floor(z - record.z), 1, 1);
          }
        }
      }
    }
  }

  private updateEntities(now: number): void {
    const latest = this.interpolator.latest;
    if (!latest) return;
    while (this.entitySprites.length < latest.population) {
      const sprite = new Sprite({ texture: Texture.EMPTY, roundPixels: true });
      sprite.anchor.set(0.5, 1);
      sprite.scale.set(ENTITY_SOURCE_SCALE);
      this.entityLayer.addChild(sprite);
      this.entitySprites.push(sprite);
    }
    const halfCellsX = this.camera.viewportWidth / (WORLD_PIXELS_PER_CELL * this.camera.zoom) / 2;
    const halfCellsZ = this.camera.viewportHeight / (WORLD_PIXELS_PER_CELL * this.camera.zoom) / 2;
    const margin = 4;
    let visible = 0;
    let strategic = 0;
    const textureSet = new Set<number>();
    for (let entityId = 0; entityId < this.entitySprites.length; entityId += 1) {
      const sprite = this.entitySprites[entityId];
      if (!sprite) continue;
      if (
        this.viewLevel === 'world' ||
        entityId >= latest.population ||
        (latest.active?.[entityId] ?? 1) === 0 ||
        (latest.health?.[entityId] ?? 1_000) <= 0
      ) {
        sprite.visible = false;
        continue;
      }
      const sample = this.interpolator.sample(entityId, now);
      if (!sample) {
        sprite.visible = false;
        continue;
      }
      const onScreen =
        Math.abs(sample.x - this.camera.centerX) <= halfCellsX + margin &&
        Math.abs(sample.z - this.camera.centerZ) <= halfCellsZ + margin;
      sprite.visible = onScreen;
      if (!onScreen) continue;
      const kind = (latest.kinds?.[entityId] ?? EntityKind.Human) as EntityKind;
      const isFocused =
        this.selectedTarget?.kind === 'entity' && this.selectedTarget.id === entityId;
      if (this.viewLevel === 'settlement' && !isFocused && entityId % 4 !== 0) {
        sprite.visible = false;
        continue;
      }
      const profession = (latest.professions?.[entityId] ?? Profession.Forager) as Profession;
      const kingdomId = latest.kingdomIds?.[entityId] ?? 0;
      const role = (latest.roles?.[entityId] ?? ResidentRole.Citizen) as ResidentRole;
      const weapon = latest.weaponTiers?.[entityId] ?? 0;
      const armor = latest.armorTiers?.[entityId] ?? 0;
      const visualKey =
        kind === EntityKind.Human
          ? `h:${entityId % 12}:${profession}:${kingdomId}:${role}:${weapon}:${armor}`
          : `a:${kind}:${entityId % 4}`;
      if (this.entityTextureKeys[entityId] !== visualKey) {
        sprite.texture =
          kind === EntityKind.Human
            ? this.textureFactory.human(entityId, profession, kingdomId, role, weapon, armor)
            : this.textureFactory.animal(kind, entityId);
        this.entityTextureKeys[entityId] = visualKey;
      }
      const moving =
        sample.state === AgentState.Wander ||
        sample.state === AgentState.Chase ||
        sample.state === AgentState.Flee ||
        sample.state === AgentState.Home;
      const bob =
        this.viewLevel === 'resident' && moving && (Math.floor(now / 160) + entityId) % 2 === 0
          ? -0.25
          : 0;
      const facing = Math.sin(sample.heading) < -0.08 ? -1 : 1;
      const attackFrame = attackThrustFrame(sample.state, latest.tick, entityId);
      const thrust = attackFrame * facing * 0.45;
      sprite.position.set(
        sample.x * WORLD_PIXELS_PER_CELL + thrust,
        sample.z * WORLD_PIXELS_PER_CELL + bob,
      );
      sprite.rotation = attackFrame ? facing * 0.045 : 0;
      const ageScale = kind === EntityKind.Human ? humanAgeScale(latest.ages?.[entityId] ?? 18) : 1;
      const viewScale = this.viewLevel === 'resident' ? 1 : 0.52;
      sprite.scale.set(
        ENTITY_SOURCE_SCALE * facing * ageScale * viewScale,
        ENTITY_SOURCE_SCALE * ageScale * viewScale,
      );
      sprite.alpha = (latest.infected?.[entityId] ?? 0) > 0 ? 0.78 : 1;
      sprite.tint = (this.damageFlashUntil.get(entityId) ?? 0) > now ? 0xff6d62 : 0xffffff;
      textureSet.add(sprite.texture.uid);
      visible += 1;
      if (this.viewLevel === 'settlement') strategic += 1;
    }
    this.visibleEntities = visible;
    this.canvas.dataset.residentVisible = String(visible);
    this.canvas.dataset.entityTextures = String(textureSet.size);
    this.canvas.dataset.strategicIcons = String(strategic);
  }

  private collectCombatTransitions(snapshot: WorldRenderSnapshot): void {
    const now = performance.now();
    let flashes = 0;
    let deathPuffs = 0;
    let attackFrames = 0;
    for (let entityId = 0; entityId < snapshot.population; entityId += 1) {
      const active = snapshot.active[entityId] ?? 0;
      const health = snapshot.health[entityId] ?? 0;
      const previousActive = this.previousEntityActive[entityId] ?? active;
      const previousHealth = this.previousEntityHealth[entityId] ?? health;
      if (snapshot.states[entityId] === AgentState.Attack) attackFrames += 1;
      if (shouldFlashFromDamage(previousHealth, health)) {
        this.damageFlashUntil.set(entityId, now + 180);
        flashes += 1;
      }
      if (
        shouldEmitDeathPuff(
          previousActive,
          active,
          (snapshot.kinds[entityId] ?? EntityKind.Human) as EntityKind,
        )
      ) {
        this.transientEffects.push({
          x: snapshot.positionsX[entityId] ?? 0,
          z: snapshot.positionsZ[entityId] ?? 0,
          radius: 0.7,
          color: 0xc6b9a0,
          startedAt: now,
          duration: 420,
          kind: 'death',
        });
        deathPuffs += 1;
      }
    }
    this.previousEntityActive = snapshot.active.slice();
    this.previousEntityHealth = snapshot.health.slice();
    this.canvas.dataset.damageFlashes = String(
      Number(this.canvas.dataset.damageFlashes ?? 0) + flashes,
    );
    this.canvas.dataset.deathPuffs = String(
      Number(this.canvas.dataset.deathPuffs ?? 0) + deathPuffs,
    );
    this.canvas.dataset.attackFrames = String(attackFrames);
  }

  private redrawCombatStatus(): void {
    this.combatStatusLayer.clear();
    const latest = this.interpolator.latest;
    if (!latest || this.viewLevel === 'world') {
      this.canvas.dataset.combatHealthBars = '0';
      return;
    }
    const thickness = 1 / Math.max(0.25, this.camera.zoom);
    let visible = 0;
    for (let entityId = 0; entityId < latest.population; entityId += 1) {
      if ((latest.active?.[entityId] ?? 0) !== 1) continue;
      const feedback = combatHealthBar(
        (latest.professions?.[entityId] ?? Profession.Forager) as Profession,
        (latest.states[entityId] ?? AgentState.Idle) as AgentState,
        latest.health?.[entityId] ?? 1_000,
      );
      if (!feedback.visible) continue;
      const x = (latest.positionsX[entityId] ?? 0) * WORLD_PIXELS_PER_CELL;
      const z = (latest.positionsZ[entityId] ?? 0) * WORLD_PIXELS_PER_CELL - 5;
      this.combatStatusLayer.rect(x - 2.25, z, 4.5, thickness).fill({
        color: 0x2b2825,
        alpha: 0.82,
      });
      this.combatStatusLayer.rect(x - 2.25, z, 4.5 * feedback.ratio, thickness).fill({
        color: feedback.ratio > 0.5 ? 0x83d16f : feedback.ratio > 0.25 ? 0xe1b75b : 0xe26455,
        alpha: 1,
      });
      visible += 1;
    }
    this.canvas.dataset.combatHealthBars = String(visible);
  }

  private updateBuildings(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const livingIds = new Set<number>();
    let construction = 0;
    let damage = 0;
    for (const building of snapshot.buildings) {
      livingIds.add(building.id);
      let sprite = this.buildingSprites.get(building.id);
      if (!sprite) {
        sprite = new Sprite({ texture: Texture.EMPTY, roundPixels: true });
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(ENTITY_SOURCE_SCALE);
        this.buildingLayer.addChild(sprite);
        this.buildingSprites.set(building.id, sprite);
      }
      const village = snapshot.villages.find((candidate) => candidate.id === building.villageId);
      const damaged = building.health < 100;
      const key = `${building.type}:${village?.kingdomId ?? 0}:${building.stage}:${damaged ? 1 : 0}`;
      if (this.buildingTextureKeys.get(building.id) !== key) {
        sprite.texture = this.textureFactory.building(
          building.type,
          village?.kingdomId ?? 0,
          building.stage,
          damaged,
        );
        this.buildingTextureKeys.set(building.id, key);
      }
      sprite.position.set(building.x * WORLD_PIXELS_PER_CELL, building.z * WORLD_PIXELS_PER_CELL);
      const viewScale = this.viewLevel === 'resident' ? 1 : 0.72;
      sprite.scale.set(ENTITY_SOURCE_SCALE * viewScale);
      sprite.visible = building.health > 0 && this.viewLevel !== 'world';
      const feedback = buildingFeedback(building);
      if (feedback?.kind === 'construction') construction += 1;
      if (feedback?.kind === 'damaged' || feedback?.kind === 'destroyed') damage += 1;
    }
    for (const [id, sprite] of this.buildingSprites) {
      if (livingIds.has(id)) continue;
      this.buildingLayer.removeChild(sprite);
      sprite.destroy();
      this.buildingSprites.delete(id);
      this.buildingTextureKeys.delete(id);
    }
    this.canvas.dataset.detailedBuildings = String(this.viewLevel !== 'world');
    this.canvas.dataset.constructionIndicators = String(construction);
    this.canvas.dataset.damageIndicators = String(damage);
    this.redrawBuildingStatus();
  }

  private redrawBuildingStatus(): void {
    const snapshot = this.snapshot;
    this.statusLayer.clear();
    if (!snapshot || this.viewLevel === 'world') {
      this.canvas.dataset.buildingStatusVisible = 'false';
      return;
    }
    let visible = 0;
    for (const building of snapshot.buildings) {
      const feedback = buildingFeedback(building);
      if (!feedback) continue;
      const x = building.x * WORLD_PIXELS_PER_CELL;
      const z = building.z * WORLD_PIXELS_PER_CELL;
      if (feedback.showScaffold) {
        this.statusLayer
          .rect(x - 5, z - 9, 10, 9)
          .stroke({ color: 0xe0ad55, width: 0.5, alpha: 0.9 });
      }
      this.statusLayer.rect(x - 5, z - 11, 10, 1.2).fill({ color: 0x26362e, alpha: 0.8 });
      this.statusLayer
        .rect(x - 5, z - 11, 10 * feedback.ratio, 1.2)
        .fill({ color: Number.parseInt(feedback.color.slice(1), 16), alpha: 1 });
      if (feedback.kind === 'destroyed') {
        this.statusLayer
          .moveTo(x - 4, z - 7)
          .lineTo(x + 4, z)
          .stroke({ color: 0xa94d43, width: 1 });
        this.statusLayer
          .moveTo(x + 4, z - 7)
          .lineTo(x - 4, z)
          .stroke({ color: 0xa94d43, width: 1 });
      }
      visible += 1;
    }
    this.canvas.dataset.buildingStatusVisible = String(visible > 0);
  }

  private updateTerritories(): void {
    const snapshot = this.snapshot;
    this.territoryLayer.clear();
    if (!snapshot || this.overlay !== 'territory') {
      this.canvas.dataset.strategicTerritories = 'false';
      this.canvas.dataset.warFronts = '0';
      return;
    }
    for (const village of snapshot.villages) {
      const color = hexNumber(kingdomColor(village.kingdomId));
      const radius = (6 + village.tier * 2.1) * WORLD_PIXELS_PER_CELL;
      this.territoryLayer
        .circle(village.x * WORLD_PIXELS_PER_CELL, village.z * WORLD_PIXELS_PER_CELL, radius)
        .fill({ color, alpha: 0.12 })
        .stroke({ color, width: 0.8, alpha: 0.7 });
    }
    let warFronts = 0;
    for (const kingdom of snapshot.kingdoms) {
      for (const [enemyId, relation] of Object.entries(kingdom.relations)) {
        if (relation !== DiplomacyState.War || kingdom.id >= Number(enemyId)) continue;
        const own = snapshot.villages.find((village) => kingdom.villageIds.includes(village.id));
        const enemy = snapshot.villages.find((village) => village.kingdomId === Number(enemyId));
        if (!own || !enemy) continue;
        this.territoryLayer
          .moveTo(own.x * WORLD_PIXELS_PER_CELL, own.z * WORLD_PIXELS_PER_CELL)
          .lineTo(enemy.x * WORLD_PIXELS_PER_CELL, enemy.z * WORLD_PIXELS_PER_CELL)
          .stroke({ color: 0xe55f4d, width: 1.2, alpha: 0.8 });
        warFronts += 1;
      }
    }
    this.canvas.dataset.strategicTerritories = 'true';
    this.canvas.dataset.warFronts = String(warFronts);
  }

  private updateSettlementLabels(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const livingIds = new Set<number>();
    for (const village of snapshot.villages) {
      livingIds.add(village.id);
      let label = this.settlementLabels.get(village.id);
      if (!label) {
        label = new Text({
          text: village.name,
          anchor: 0.5,
          roundPixels: true,
          resolution: 1,
          style: {
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 12,
            fontWeight: '700',
            fill: 0xf6f1d8,
            stroke: { color: 0x183229, width: 3 },
            dropShadow: { color: 0x10271f, alpha: 0.7, blur: 0, distance: 1, angle: Math.PI / 2 },
          },
        });
        this.labelLayer.addChild(label);
        this.settlementLabels.set(village.id, label);
      }
      label.text = village.name;
    }
    for (const [id, label] of this.settlementLabels) {
      if (livingIds.has(id)) continue;
      this.labelLayer.removeChild(label);
      label.destroy();
      this.settlementLabels.delete(id);
    }
    this.canvas.dataset.settlementLabels = String(this.settlementLabels.size);
    this.canvas.dataset.settlementLabelNames = snapshot.villages
      .map((village) => village.name)
      .join(',');
    this.updateSettlementLabelPositions();
  }

  private updateSettlementLabelPositions(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const visible = this.viewLevel !== 'resident';
    for (const village of snapshot.villages) {
      const label = this.settlementLabels.get(village.id);
      if (!label) continue;
      const screen = worldToScreen(this.camera, village.x, village.z);
      label.position.set(Math.round(screen.x), Math.round(screen.y - 16));
      label.visible =
        visible &&
        screen.x > -100 &&
        screen.x < this.camera.viewportWidth + 100 &&
        screen.y > -60 &&
        screen.y < this.camera.viewportHeight + 60;
    }
    const first = snapshot.villages[0];
    if (first) {
      const screen = worldToScreen(this.camera, first.x, first.z);
      this.canvas.dataset.firstVillageScreen = `${screen.x.toFixed(1)},${screen.y.toFixed(1)}`;
    }
    this.canvas.dataset.settlementLabelsVisible = String(visible);
  }

  private collectAttackFeedback(): void {
    const snapshot = this.snapshot;
    if (!snapshot || this.viewLevel === 'world') return;
    for (let entityId = 0; entityId < snapshot.population; entityId += 1) {
      const state = snapshot.states[entityId] as AgentState;
      const lastTick = this.lastAttackFeedbackTicks.get(entityId) ?? -1_000;
      if (!shouldEmitAttackHit(state, snapshot.tick, lastTick, this.viewLevel)) continue;
      this.lastAttackFeedbackTicks.set(entityId, snapshot.tick);
      this.transientEffects.push({
        x: snapshot.positionsX[entityId] ?? 0,
        z: snapshot.positionsZ[entityId] ?? 0,
        radius: 0.6,
        color: 0xffd26a,
        startedAt: performance.now(),
        duration: 260,
        kind: 'attack',
      });
      this.totalAttackHits += 1;
    }
    this.canvas.dataset.attackHits = String(this.totalAttackHits);
  }

  private redrawEffects(now: number): void {
    this.effectLayer.clear();
    for (let index = this.transientEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.transientEffects[index];
      if (!effect) continue;
      const progress = (now - effect.startedAt) / effect.duration;
      if (progress >= 1) {
        this.transientEffects.splice(index, 1);
        continue;
      }
      const x = effect.x * WORLD_PIXELS_PER_CELL;
      const z = effect.z * WORLD_PIXELS_PER_CELL;
      const radius = effect.radius * WORLD_PIXELS_PER_CELL * (0.45 + progress * 0.8);
      if (effect.kind === 'attack') {
        this.effectLayer
          .moveTo(x - radius, z - radius)
          .lineTo(x + radius, z + radius)
          .moveTo(x + radius, z - radius)
          .lineTo(x - radius, z + radius)
          .stroke({ color: effect.color, width: 0.8, alpha: 1 - progress });
      } else if (effect.kind === 'death') {
        for (let puff = 0; puff < 4; puff += 1) {
          const angle = (Math.PI * 2 * puff) / 4;
          const distance = radius * progress * 0.9;
          this.effectLayer
            .circle(x + Math.cos(angle) * distance, z + Math.sin(angle) * distance, radius * 0.18)
            .fill({ color: effect.color, alpha: 1 - progress });
        }
      } else {
        this.effectLayer
          .circle(x, z, radius)
          .stroke({ color: effect.color, width: 1.2, alpha: 1 - progress });
      }
    }
  }

  private redrawInteraction(): void {
    this.interactionLayer.clear();
    if (this.brushVisible && this.brushPoint) {
      this.interactionLayer
        .circle(
          this.brushPoint.x * WORLD_PIXELS_PER_CELL,
          this.brushPoint.z * WORLD_PIXELS_PER_CELL,
          this.brushRadius * WORLD_PIXELS_PER_CELL,
        )
        .fill({ color: 0xdaf49c, alpha: 0.12 })
        .stroke({ color: 0xdaf49c, width: 0.8, alpha: 0.95 });
    }
    const drawTarget = (
      target: WorldSelection | null,
      color: number,
      tone: 'hover' | 'selected',
    ) => {
      const point = this.targetPosition(target);
      if (!point) return false;
      const x = (point.x + point.geometry.offsetX) * WORLD_PIXELS_PER_CELL;
      const z = (point.z + point.geometry.offsetZ) * WORLD_PIXELS_PER_CELL;
      if (point.geometry.shape === 'ellipse') {
        this.interactionLayer.ellipse(
          x,
          z,
          point.geometry.radiusX * WORLD_PIXELS_PER_CELL,
          point.geometry.radiusZ * WORLD_PIXELS_PER_CELL,
        );
      } else {
        this.interactionLayer.circle(x, z, point.geometry.radiusX * WORLD_PIXELS_PER_CELL);
      }
      this.interactionLayer.stroke({
        color,
        width: interactionStrokeWidth(this.camera.zoom, tone),
        alpha: 0.95,
      });
      return true;
    };
    const hover = !this.brushVisible && drawTarget(this.hoveredTarget, 0x8fe49a, 'hover');
    const selected = drawTarget(this.selectedTarget, 0xffd86a, 'selected');
    this.canvas.dataset.hoverHighlight = String(hover);
    this.canvas.dataset.selectionOutline = String(selected);
    this.canvas.dataset.hoverStrokePx = '1';
    this.canvas.dataset.selectionStrokePx = '1.5';
  }

  private targetPosition(
    target: WorldSelection | null,
  ): { x: number; z: number; geometry: InteractionGeometry } | null {
    if (!target) return null;
    if (target.kind === 'entity') {
      if (this.viewLevel !== 'resident') return null;
      const latest = this.interpolator.latest;
      if (!latest || target.id >= latest.population) return null;
      return {
        x: latest.positionsX[target.id] ?? 0,
        z: latest.positionsZ[target.id] ?? 0,
        geometry: entityInteractionGeometry(),
      };
    }
    if (target.kind === 'building') {
      if (this.viewLevel === 'world') return null;
      const building = this.snapshot?.buildings.find((candidate) => candidate.id === target.id);
      return building
        ? { x: building.x, z: building.z, geometry: buildingInteractionGeometry(building.type) }
        : null;
    }
    if (target.kind === 'resource') {
      if (this.viewLevel === 'world') return null;
      const resources = this.resourceNodes;
      if (!resources || resources.active[target.id] !== 1) return null;
      return {
        x: resources.positionsX[target.id] ?? 0,
        z: resources.positionsZ[target.id] ?? 0,
        geometry: {
          shape: 'ellipse',
          offsetX: 0,
          offsetZ: -0.08,
          radiusX: 0.62,
          radiusZ: 0.34,
        },
      };
    }
    const village = this.snapshot?.villages.find((candidate) => candidate.id === target.id);
    const radius = village ? 3.2 + village.tier : 0;
    return village
      ? {
          x: village.x,
          z: village.z,
          geometry: { shape: 'circle', offsetX: 0, offsetZ: 0, radiusX: radius, radiusZ: radius },
        }
      : null;
  }

  private updateWorldTransform(): void {
    if (!this.ready) return;
    const scale = this.camera.zoom;
    this.world.scale.set(scale);
    this.world.position.set(
      Math.round(
        this.camera.viewportWidth / 2 - this.camera.centerX * WORLD_PIXELS_PER_CELL * scale,
      ),
      Math.round(
        this.camera.viewportHeight / 2 - this.camera.centerZ * WORLD_PIXELS_PER_CELL * scale,
      ),
    );
    this.canvas.dataset.zoom = String(scale);
    this.updateTerrainLod();
  }

  private updateTerrainLod(): void {
    const next =
      this.viewLevel === 'world'
        ? 'macro-1px'
        : this.viewLevel === 'settlement'
          ? 'districts-4px'
          : 'resident-4px';
    if (this.canvas.dataset.terrainLod === next) return;
    this.canvas.dataset.terrainLod = next;
    for (const record of this.terrainChunks.values()) {
      record.overviewSprite.visible = this.viewLevel === 'world';
      record.sprite.visible = this.viewLevel === 'settlement';
      record.residentSprite.visible = this.viewLevel === 'resident';
    }
  }

  private updateCameraTween(now: number): void {
    const tween = this.cameraTween;
    if (!tween) return;
    const raw = clamp((now - tween.startedAt) / tween.duration, 0, 1);
    const progress = raw * raw * (3 - 2 * raw);
    this.camera = {
      ...this.camera,
      centerX: lerp(tween.fromX, tween.toX, progress),
      centerZ: lerp(tween.fromZ, tween.toZ, progress),
      zoom: lerp(tween.fromZoom, tween.toZoom, progress),
    };
    this.setViewLevel(resolvePixelView(this.camera.zoom));
    if (raw >= 1) this.cameraTween = null;
  }

  private setViewLevel(level: WorldViewLevel): void {
    if (this.viewLevel === level && this.canvas.dataset.viewLevel) return;
    this.viewLevel = level;
    this.canvas.dataset.viewLevel = level;
    this.canvas.dataset.strategicEntities = 'false';
    this.canvas.dataset.fullBodyResidents = String(level === 'resident');
    this.updateTerrainLod();
    this.updateBuildings();
    this.redrawBuildingStatus();
    this.updateSettlementLabelPositions();
    this.options.onViewLevelChange?.(level);
  }

  private pick(screenX: number, screenY: number): WorldClick | null {
    const map = this.map;
    if (!map) return null;
    const world = screenToWorldCell(this.camera, screenX, screenY);
    const x = Math.floor(world.x);
    const z = Math.floor(world.z);
    if (x < 0 || z < 0 || x >= map.size || z >= map.size) return null;
    const click: WorldClick = { cell: z * map.size + x };
    if (this.brushVisible) return click;
    const latest = this.interpolator.latest;
    let bestEntityDistance = this.viewLevel === 'resident' ? 1.6 : 1.1;
    if (latest && this.viewLevel !== 'world') {
      for (let entityId = 0; entityId < latest.population; entityId += 1) {
        if (
          (latest.active?.[entityId] ?? 1) === 0 ||
          (latest.health?.[entityId] ?? 1_000) <= 0 ||
          (this.viewLevel === 'settlement' && entityId % 4 !== 0)
        ) {
          continue;
        }
        const distance = Math.hypot(
          (latest.positionsX[entityId] ?? 0) - world.x,
          (latest.positionsZ[entityId] ?? 0) - world.z,
        );
        if (distance < bestEntityDistance) {
          bestEntityDistance = distance;
          click.entityId = entityId;
        }
      }
    }
    if (click.entityId !== undefined) return click;
    let bestBuildingDistance = 2.3;
    for (const building of this.viewLevel === 'world' ? [] : (this.snapshot?.buildings ?? [])) {
      if (building.health <= 0) continue;
      const distance = Math.hypot(building.x - world.x, building.z - world.z);
      if (distance < bestBuildingDistance) {
        bestBuildingDistance = distance;
        click.buildingId = building.id;
        click.villageId = building.villageId;
      }
    }
    if (click.buildingId !== undefined) return click;
    const resources = this.resourceNodes;
    if (resources && this.viewLevel === 'resident') {
      const columns = Math.ceil(map.size / 8);
      const bucketX = Math.floor(world.x / 8);
      const bucketZ = Math.floor(world.z / 8);
      let bestResourceDistance = 1.15;
      for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const xIndex = bucketX + offsetX;
          const zIndex = bucketZ + offsetZ;
          if (xIndex < 0 || zIndex < 0 || xIndex >= columns || zIndex >= columns) continue;
          for (const nodeId of this.resourceBuckets.get(zIndex * columns + xIndex) ?? []) {
            if (resources.active[nodeId] !== 1) continue;
            const distance = Math.hypot(
              (resources.positionsX[nodeId] ?? 0) - world.x,
              (resources.positionsZ[nodeId] ?? 0) - world.z,
            );
            if (distance < bestResourceDistance) {
              bestResourceDistance = distance;
              click.resourceNodeId = nodeId;
            }
          }
        }
      }
    }
    if (click.resourceNodeId !== undefined) return click;
    let bestVillageDistance = this.viewLevel === 'world' ? 8 : 4;
    for (const village of this.snapshot?.villages ?? []) {
      const distance = Math.hypot(village.x - world.x, village.z - world.z);
      if (distance < bestVillageDistance) {
        bestVillageDistance = distance;
        click.villageId = village.id;
      }
    }
    return click;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = {
      x: event.offsetX,
      y: event.offsetY,
      cameraX: this.camera.centerX,
      cameraZ: this.camera.centerZ,
    };
    this.pointerMoved = false;
    this.canvas.setPointerCapture?.(event.pointerId);
    if (!this.brushVisible) this.canvas.style.cursor = 'grabbing';
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const world = screenToWorldCell(this.camera, event.offsetX, event.offsetY);
    this.brushPoint = world;
    if (this.pointerDown) {
      const dx = event.offsetX - this.pointerDown.x;
      const dy = event.offsetY - this.pointerDown.y;
      if (Math.hypot(dx, dy) > 4) this.pointerMoved = true;
      if (this.pointerMoved) {
        this.camera = panPixelCamera(
          { ...this.camera, centerX: this.pointerDown.cameraX, centerZ: this.pointerDown.cameraZ },
          dx,
          dy,
        );
        this.cameraTween = null;
        this.updateWorldTransform();
      }
      return;
    }
    if (this.brushVisible) {
      this.redrawInteraction();
      return;
    }
    const click = this.pick(event.offsetX, event.offsetY);
    let target: WorldSelection | null = null;
    if (click?.entityId !== undefined) target = { kind: 'entity', id: click.entityId };
    else if (click?.buildingId !== undefined) target = { kind: 'building', id: click.buildingId };
    else if (click?.resourceNodeId !== undefined)
      target = { kind: 'resource', id: click.resourceNodeId };
    else if (click?.villageId !== undefined) target = { kind: 'village', id: click.villageId };
    this.setHoveredTarget(target, event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const shouldClick = Boolean(this.pointerDown && !this.pointerMoved);
    this.pointerDown = null;
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.canvas.style.cursor = this.brushVisible ? 'crosshair' : 'grab';
    if (!shouldClick) return;
    const click = this.pick(event.offsetX, event.offsetY);
    if (click) this.options.onWorldClick?.(click);
  };

  private readonly handlePointerLeave = (): void => {
    this.pointerDown = null;
    this.brushPoint = null;
    this.setHoveredTarget(null);
    this.canvas.style.cursor = this.brushVisible ? 'crosshair' : 'grab';
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.cameraTween = null;
    this.camera = zoomCameraAt(
      this.camera,
      event.offsetX,
      event.offsetY,
      event.deltaY < 0 ? 1 : -1,
    );
    this.setViewLevel(resolvePixelView(this.camera.zoom));
    this.updateWorldTransform();
  };

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    const click = this.pick(event.offsetX, event.offsetY);
    if (click?.entityId === undefined) return;
    const latest = this.interpolator.latest;
    if (!latest) return;
    this.focusOn(
      latest.positionsX[click.entityId] ?? 0,
      latest.positionsZ[click.entityId] ?? 0,
      'resident',
    );
    this.options.onWorldClick?.(click);
  };

  private setHoveredTarget(target: WorldSelection | null, screenX = 0, screenY = 0): void {
    if (target?.kind === 'resource') {
      const resources = this.resourceNodes;
      if (resources) {
        this.options.onResourceHover?.({
          name: resourceNodeName(resources.kind[target.id] as ResourceNodeKind),
          stage: resourceStageName(resources.stage[target.id] as ResourceNodeStage),
          amount: resources.amount[target.id] ?? 0,
          screenX,
          screenY,
        });
      }
    } else {
      this.options.onResourceHover?.(null);
    }
    if (this.hoveredTarget?.kind === target?.kind && this.hoveredTarget?.id === target?.id) {
      return;
    }
    this.hoveredTarget = target;
    if (target) this.canvas.dataset.hoverTarget = `${target.kind}:${target.id}`;
    else delete this.canvas.dataset.hoverTarget;
    this.redrawInteraction();
  }

  private emitMetrics(): void {
    const sorted = [...this.frameSamples].sort((left, right) => left - right);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const average =
      this.frameSamples.reduce((sum, value) => sum + value, 0) /
      Math.max(1, this.frameSamples.length);
    const visibleLabels = [...this.settlementLabels.values()].filter(
      (label) => label.visible,
    ).length;
    const uniqueEntityTextures = Number(this.canvas.dataset.entityTextures ?? 0);
    const estimatedBatches =
      Math.ceil(this.terrainChunks.size / 16) +
      Math.ceil(Math.max(1, uniqueEntityTextures) / 16) +
      Math.ceil(Math.max(1, this.buildingSprites.size) / 16) +
      (this.territoryLayer.context.instructions.length > 0 ? 1 : 0) +
      (this.statusLayer.context.instructions.length > 0 ? 1 : 0) +
      visibleLabels;
    const latest = this.interpolator.latest;
    const metrics: RuntimeMetrics = {
      fps: average > 0 ? 1_000 / average : 0,
      frameP95Ms: p95,
      drawCalls: estimatedBatches,
      triangles:
        (this.terrainChunks.size +
          this.visibleEntities +
          this.buildingSprites.size +
          visibleLabels +
          4) *
        2,
      longTasks: this.longTasks,
      tickMs: latest?.metrics.tickMs ?? 0,
      averageTickMs: latest?.metrics.averageTickMs ?? 0,
      pathQueue: latest?.metrics.pathQueue ?? 0,
      completedPaths: latest?.metrics.completedPaths ?? 0,
    };
    this.canvas.dataset.metricSource = 'pixi-batch-estimate';
    this.options.onMetrics(metrics);
  }

  private writeStaticDatasets(): void {
    this.canvas.dataset.renderer = 'pixi-v8-webgl-2d';
    this.canvas.dataset.cameraMode = 'pixel-2d-pan-zoom';
    this.canvas.dataset.cameraMotion = 'stepped-anchor-zoom-bounded-pan';
    this.canvas.dataset.cameraNorth = 'fixed';
    this.canvas.dataset.humanStyle = 'layered-pixel-sprites';
    this.canvas.dataset.animalStyle = 'pixel-side-profiles';
    this.canvas.dataset.animalStyles = '7';
    this.canvas.dataset.kingdomPalette = 'residents-buildings-flags';
    this.canvas.dataset.buildingStyle = 'functional-pixel-buildings';
    this.canvas.dataset.viewLevels = 'world-settlement-resident';
    this.canvas.dataset.viewLevel = 'world';
    this.canvas.dataset.fullRebuilds = '0';
    this.canvas.dataset.attackHits = '0';
    this.canvas.dataset.noTilt = 'true';
    this.canvas.dataset.noRotation = 'true';
  }
}

function initialZoom(size: number): number {
  return size <= 128 ? 1 : 0.5;
}

function resolvePixelView(zoom: number): WorldViewLevel {
  if (zoom <= 0.75) return 'world';
  if (zoom < 3) return 'settlement';
  return 'resident';
}

function kingdomColor(kingdomId: number): string {
  if (kingdomId <= 0) return KINGDOM_COLORS[0] ?? '#d6c195';
  return KINGDOM_COLORS[((kingdomId - 1) % (KINGDOM_COLORS.length - 1)) + 1] ?? '#d6c195';
}

function countActive(values: Uint8Array): number {
  let count = 0;
  for (const value of values) if (value > 0) count += 1;
  return count;
}

function growClientArray<T extends Uint8Array | Uint16Array | Float32Array>(
  source: T,
  capacity: number,
): T {
  const Constructor = source.constructor as { new (length: number): T };
  const next = new Constructor(capacity);
  next.set(source);
  return next;
}

function resourceNodeName(kind: ResourceNodeKind): string {
  if (kind === ResourceNodeKind.Tree) return '树木';
  if (kind === ResourceNodeKind.Stone) return '露天石料';
  return '金属矿脉';
}

function resourceStageName(stage: ResourceNodeStage): string {
  if (stage === ResourceNodeStage.Stump) return '树桩';
  if (stage === ResourceNodeStage.Sapling) return '幼苗';
  if (stage === ResourceNodeStage.Young) return '幼树';
  if (stage === ResourceNodeStage.Mature) return '成熟';
  return '枯竭';
}

function drawResourceNodeGlyph(
  context: CanvasRenderingContext2D,
  kind: ResourceNodeKind,
  stage: ResourceNodeStage,
  variant: number,
  x: number,
  groundY: number,
  detailed: boolean,
): void {
  if (kind === ResourceNodeKind.Tree) {
    if (stage === ResourceNodeStage.Stump) {
      context.fillStyle = '#755038';
      context.fillRect(x - 1, groundY, 2, 1);
      return;
    }
    const young = stage === ResourceNodeStage.Sapling || stage === ResourceNodeStage.Young;
    const crown = ['#285f3f', '#32704a', '#3b7845', '#24644a'][variant % 4] ?? '#285f3f';
    context.fillStyle = '#6b4930';
    context.fillRect(x, groundY - (young ? 2 : 3), 1, young ? 3 : 4);
    context.fillStyle = crown;
    if (stage === ResourceNodeStage.Sapling) {
      context.fillRect(x - 1, groundY - 3, 3, 2);
    } else if (stage === ResourceNodeStage.Young || !detailed) {
      context.fillRect(x - 1, groundY - 4, 3, 3);
    } else {
      context.fillRect(x - 2, groundY - 6, 5, 3);
      context.fillRect(x - 1, groundY - 7, 3, 1);
      context.fillStyle = shade(crown, 1.18);
      context.fillRect(x - 1, groundY - 6, 2, 1);
    }
    return;
  }
  if (kind === ResourceNodeKind.Stone) {
    context.fillStyle = '#626c6a';
    context.fillRect(x - 2, groundY - 2, detailed ? 4 : 3, 3);
    context.fillStyle = '#a5aca7';
    context.fillRect(x - 1, groundY - 2, 2, 1);
    if (detailed) {
      context.fillStyle = '#818b87';
      context.fillRect(x + 1, groundY - 1, 1, 1);
    }
    return;
  }
  context.fillStyle = '#46525b';
  context.fillRect(x - 2, groundY - 3, detailed ? 5 : 4, 4);
  context.fillStyle = variant % 2 === 0 ? '#b77b49' : '#6f9ba8';
  context.fillRect(x - 1, groundY - 2, 1, 1);
  context.fillRect(x + 1, groundY - 1, 1, 1);
}

function overlayTerrainColor(
  map: WorldMapSnapshot,
  cell: number,
  overlay: WorldSettings['overlay'],
  variation: number,
): string {
  if (overlay === 'resources') {
    if ((map.resourceFood[cell] ?? 0) > 0) return '#94ad4f';
  }
  if (overlay === 'climate') {
    const heat = map.temperature[cell] ?? 128;
    const moisture = map.moisture[cell] ?? 128;
    if (heat < 75) return '#a6d7db';
    if (moisture < 70) return '#d09b61';
    if (moisture > 170) return '#4f9674';
  }
  if (overlay === 'navigation') {
    const terrain = map.terrain[cell] as TerrainType;
    return terrain === TerrainType.DeepOcean ||
      terrain === TerrainType.ShallowOcean ||
      terrain === TerrainType.Mountain
      ? '#7e4b55'
      : '#70b57a';
  }
  return shade(
    TERRAIN_COLORS[map.terrain[cell] as TerrainType] ?? '#78a960',
    1 + variation * 0.012,
  );
}

function drawTerrainDetail(
  context: CanvasRenderingContext2D,
  map: WorldMapSnapshot,
  cell: number,
  _terrain: TerrainType,
  localX: number,
  localZ: number,
  detail: 'districts' | 'resident',
): void {
  const px = localX * SOURCE_PIXELS_PER_CELL;
  const py = localZ * SOURCE_PIXELS_PER_CELL;
  const hash = (cell * 1103515245 + 12345) >>> 0;
  if (detail === 'resident' && (map.resourceFood[cell] ?? 0) > 0 && hash % 23 === 0) {
    context.fillStyle = '#d7c348';
    context.fillRect(px + 2, py + 1, 1, 1);
  }
  if ((map.crops[cell] ?? 0) > 0) {
    context.fillStyle = '#d1b849';
    context.fillRect(px, py + 1, 4, 1);
    context.fillRect(px, py + 3, 4, 1);
  }
  if ((map.roads[cell] ?? 0) > 0) {
    context.fillStyle = '#aa936f';
    context.fillRect(px, py + 1, 4, 2);
  }
  if ((map.fire[cell] ?? 0) > 0) {
    context.fillStyle = '#ef5a3d';
    context.fillRect(px + 1, py, 2, 3);
    context.fillStyle = '#ffd15a';
    context.fillRect(px + 2, py + 1, 1, 1);
  } else if (detail === 'resident' && (map.rain[cell] ?? 0) > 0 && hash % 3 === 0) {
    context.fillStyle = '#9ed8e6';
    context.fillRect(px + 1, py, 1, 2);
  }
  if ((map.craters[cell] ?? 0) > 0) {
    context.fillStyle = '#4d4d43';
    context.fillRect(px + 1, py + 1, 2, 2);
  }
}

function drawProfession(
  context: CanvasRenderingContext2D,
  profession: Profession,
  weaponTier: number,
): void {
  if (profession === Profession.Guard) {
    context.fillStyle = weaponTier >= 2 ? '#e4e8e8' : '#9da8a9';
    context.fillRect(14, 7, 1, 8);
    context.fillRect(13, 7, 3, 1);
    context.fillStyle = '#6b4d33';
    context.fillRect(2, 10, 1, 5);
    return;
  }
  const toolColor = profession === Profession.Farmer ? '#b69c4d' : '#879297';
  context.fillStyle = '#67492f';
  context.fillRect(14, 8, 1, 8);
  context.fillStyle = toolColor;
  if (profession === Profession.Builder || profession === Profession.Blacksmith) {
    context.fillRect(12, 8, 4, 2);
  } else if (profession === Profession.Miner) {
    context.fillRect(12, 8, 4, 1);
    context.fillRect(12, 9, 1, 2);
  } else if (profession === Profession.Woodcutter) {
    context.fillRect(12, 8, 3, 3);
  } else if (profession === Profession.Farmer) {
    context.fillRect(12, 8, 4, 1);
    context.fillRect(12, 7, 1, 3);
  } else if (profession === Profession.Hauler) {
    context.fillStyle = '#9a6a3d';
    context.fillRect(12, 10, 4, 4);
  }
}

function drawRole(context: CanvasRenderingContext2D, role: ResidentRole): void {
  if (role === ResidentRole.King || role === ResidentRole.Leader) {
    context.fillStyle = role === ResidentRole.King ? '#f4cd4f' : '#c6d1d6';
    context.fillRect(5, 0, 7, 1);
    context.fillRect(5, 0, 1, 2);
    context.fillRect(8, 0, 1, 2);
    context.fillRect(11, 0, 1, 2);
  }
  if (role === ResidentRole.Captain) {
    context.fillStyle = '#f0d45f';
    context.fillRect(3, 0, 1, 7);
    context.fillStyle = '#df6458';
    context.fillRect(4, 0, 4, 3);
  }
  if (role === ResidentRole.Veteran || role === ResidentRole.Master) {
    context.fillStyle = role === ResidentRole.Veteran ? '#d9c45d' : '#bdd4df';
    context.fillRect(3, 8, 2, 2);
  }
}

function drawAnimal(context: CanvasRenderingContext2D, kind: EntityKind, variant: number): void {
  const colors: Partial<Record<EntityKind, readonly [string, string, string]>> = {
    [EntityKind.Chicken]: ['#f3ead1', '#d85d45', '#d5a443'],
    [EntityKind.Sheep]: ['#eee5cf', '#88745d', '#51483e'],
    [EntityKind.Cow]: ['#e8dcc2', '#5f4a3b', '#352c27'],
    [EntityKind.Deer]: ['#b47b45', '#8c5a35', '#382f28'],
    [EntityKind.Wolf]: ['#777d82', '#555e65', '#323a40'],
    [EntityKind.Bear]: ['#805d42', '#6a4835', '#3f2d25'],
    [EntityKind.Fish]: ['#4d9eb8', '#6db8ca', '#286f8b'],
  };
  const [body, head, detail] = colors[kind] ?? colors[EntityKind.Sheep] ?? ['#eee', '#888', '#444'];
  const width = context.canvas.width;
  context.fillStyle = 'rgba(20, 31, 28, 0.22)';
  context.fillRect(3, 14, width - 5, 2);
  if (kind === EntityKind.Chicken) {
    context.fillStyle = body;
    context.fillRect(5, 7, 9, 7);
    context.fillRect(12, 5, 5, 6);
    context.fillStyle = head;
    context.fillRect(13, 3, 2, 3);
    context.fillStyle = detail;
    context.fillRect(17, 7, 2, 1);
    context.fillRect(7, 14, 1, 2);
    context.fillRect(12, 14, 1, 2);
    return;
  }
  if (kind === EntityKind.Fish) {
    context.fillStyle = body;
    context.fillRect(4, 6, 11, 6);
    context.fillStyle = head;
    context.fillRect(13, 7, 4, 4);
    context.fillStyle = detail;
    context.fillRect(1, 7, 4, 4);
    context.fillRect(16, 8, 1, 1);
    return;
  }
  const bodyWidth = kind === EntityKind.Bear || kind === EntityKind.Cow ? width - 9 : width - 8;
  context.fillStyle = body;
  context.fillRect(3, 6, bodyWidth, kind === EntityKind.Bear ? 8 : 7);
  if ((kind === EntityKind.Cow || kind === EntityKind.Deer) && variant % 2 === 0) {
    context.fillStyle = head;
    context.fillRect(7, 7, 3, 3);
  }
  context.fillStyle = head;
  context.fillRect(width - 7, 5, 6, 6);
  context.fillStyle = detail;
  context.fillRect(width - 3, 7, 1, 1);
  context.fillRect(5, 12, 2, 4);
  context.fillRect(width - 9, 12, 2, 4);
  context.fillRect(1, 7, 3, 2);
  if (kind === EntityKind.Deer) {
    context.fillRect(width - 6, 2, 1, 4);
    context.fillRect(width - 3, 2, 1, 4);
    context.fillRect(width - 7, 2, 2, 1);
    context.fillRect(width - 3, 2, 2, 1);
  }
  if (kind === EntityKind.Wolf) {
    context.fillRect(width - 7, 2, 2, 4);
    context.fillRect(width - 3, 2, 2, 4);
  }
  if (kind === EntityKind.Bear) {
    context.fillRect(width - 7, 3, 2, 3);
    context.fillRect(width - 3, 3, 2, 3);
  }
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  type: BuildingType,
  kingdom: string,
  stage: number,
  damaged: boolean,
): void {
  context.fillStyle = 'rgba(22, 31, 26, 0.25)';
  context.fillRect(5, 38, 38, 4);
  if (type === BuildingType.Road) {
    context.fillStyle = '#9e896b';
    context.fillRect(1, 29, 46, 8);
    context.fillStyle = '#c0a882';
    context.fillRect(1, 31, 46, 2);
    return;
  }
  if (type === BuildingType.Farm) {
    context.fillStyle = '#9c853f';
    context.fillRect(4, 18, 40, 20);
    for (let row = 0; row < 4; row += 1) {
      context.fillStyle = row % 2 === 0 ? '#d1bb4d' : '#697d3d';
      context.fillRect(6, 20 + row * 4, 36, 2);
    }
    return;
  }
  context.fillStyle = '#79624a';
  context.fillRect(9, 19, 30, 20);
  if (stage === 0) {
    context.fillStyle = '#b29c78';
    context.fillRect(7, 35, 34, 4);
    context.fillStyle = '#d09a4d';
    context.fillRect(8, 17, 2, 22);
    context.fillRect(38, 17, 2, 22);
    return;
  }
  if (type === BuildingType.Mine) {
    context.fillStyle = '#696b65';
    context.fillRect(6, 18, 36, 21);
    context.fillStyle = '#262a28';
    context.fillRect(17, 24, 14, 15);
  } else if (type === BuildingType.Wall) {
    context.fillStyle = '#8b8d83';
    context.fillRect(3, 24, 42, 15);
    for (let x = 4; x < 44; x += 8) context.fillRect(x, 19, 5, 6);
  } else if (type === BuildingType.Watchtower) {
    context.fillStyle = '#8b7659';
    context.fillRect(15, 11, 18, 28);
    context.fillStyle = kingdom;
    context.fillRect(9, 8, 30, 8);
  } else if (type === BuildingType.LoggingCamp) {
    context.fillStyle = '#82613f';
    for (let row = 0; row < 4; row += 1) context.fillRect(6, 23 + row * 4, 36, 3);
    context.fillStyle = kingdom;
    context.fillRect(10, 15, 28, 10);
  } else {
    const large =
      type === BuildingType.TownCenter ||
      type === BuildingType.CouncilHall ||
      type === BuildingType.Barracks;
    context.fillStyle = '#dbc48d';
    context.fillRect(large ? 7 : 11, large ? 17 : 21, large ? 34 : 26, large ? 22 : 18);
    context.fillStyle = kingdom;
    context.fillRect(large ? 4 : 8, large ? 11 : 15, large ? 40 : 32, 9);
    context.fillStyle = shade(kingdom, 0.72);
    context.fillRect(8, large ? 17 : 21, large ? 32 : 24, 3);
    context.fillStyle = '#5c4433';
    context.fillRect(20, 29, 8, 10);
    if (type === BuildingType.Workshop) {
      context.fillStyle = '#6c5b51';
      context.fillRect(33, 5, 6, 17);
      context.fillStyle = '#bac2bd';
      context.fillRect(34, 2, 4, 4);
    }
    if (type === BuildingType.Barracks) {
      context.fillStyle = '#f2d25e';
      context.fillRect(5, 5, 2, 16);
      context.fillStyle = kingdom;
      context.fillRect(7, 5, 10, 6);
    }
    if (type === BuildingType.TownCenter || type === BuildingType.CouncilHall) {
      context.fillStyle = '#f0d36b';
      context.fillRect(22, 5, 4, 8);
    }
  }
  if (stage === 1) {
    context.fillStyle = '#d09a4d';
    context.fillRect(7, 10, 2, 29);
    context.fillRect(39, 10, 2, 29);
    context.fillRect(7, 20, 34, 2);
  }
  if (damaged) {
    context.fillStyle = '#593b35';
    context.fillRect(17, 22, 2, 7);
    context.fillRect(19, 28, 5, 2);
    context.fillRect(29, 14, 2, 9);
  }
}

function hexNumber(value: string): number {
  return Number.parseInt(value.replace('#', ''), 16);
}

function shade(color: string, factor: number): string {
  const value = hexNumber(color);
  const channel = (shift: number) => clamp(Math.round(((value >> shift) & 0xff) * factor), 0, 255);
  return `#${channel(16).toString(16).padStart(2, '0')}${channel(8)
    .toString(16)
    .padStart(2, '0')}${channel(0).toString(16).padStart(2, '0')}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
