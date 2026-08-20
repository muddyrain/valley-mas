import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import {
  AgentState,
  BuildingType,
  CarriedResourceKind,
  DiplomacyState,
  EntityKind,
  GodPower,
  PlanningZoneKind,
  Profession,
  ResidentRole,
  ResourceNodeKind,
  ResourceNodeStage,
  TerrainType,
  VillageTier,
  type WorldSettings,
} from '@/shared/gameTypes';
import {
  deriveKingdomObservation,
  type KingdomBorderSegment,
  type KingdomObservation,
} from '@/simulation/kingdoms/kingdomObservation';
import {
  attackThrustFrame,
  combatHealthBar,
  shouldEmitDeathPuff,
  shouldFlashFromDamage,
} from './combatFeedback';
import { humanAgeScale } from './entityAppearance';
import {
  animalVisualProfile,
  BUILDING_VISUAL_PROFILES,
  FORMAL_PIXEL_ASSETS,
  resourceVisualProfile,
  selectedTreeCanopyAlpha,
  VISUAL_LOD_PROFILES,
} from './fullWorldVisuals';
import {
  buildingInteractionGeometry,
  entityInteractionGeometry,
  type InteractionGeometry,
  interactionStrokeWidth,
} from './interactionFeedback';
import { buildingFeedback, shouldEmitAttackHit } from './mapFeedback';
import { estimateRenderBatches, normalizedDisplayFps } from './performanceMetrics';
import { PixelAtlasSlotAllocator } from './pixelAtlas';
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
  TerritorySnapshot,
  WorldMapDelta,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from './renderTypes';
import {
  carriedResourceColor,
  residentHandItem,
  usesTravelPose,
  usesWorkPose,
} from './residentPresentation';
import { SnapshotInterpolator } from './SnapshotInterpolator';
import {
  type AnimalPose,
  animalPose,
  animationFrame,
  type HumanFacing,
  type HumanPose,
  humanFacing,
  humanPose,
} from './spriteAnimation';
import { resolveViewLevel, viewZoom, visibleCellSpan, type WorldViewLevel } from './strategicView';

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
  kingdomId?: number;
  resourceNodeId?: number;
}

export interface WorldSelection {
  kind: 'entity' | 'building' | 'village' | 'kingdom' | 'resource';
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

const RENDER_CHUNK_SIZE = 24;
const SOURCE_PIXELS_PER_CELL = 4;
const ENTITY_SOURCE_SCALE = WORLD_PIXELS_PER_CELL / 16;
const WORLD_SETTLEMENT_LABEL_LIMIT = 12;
const LOD_MASKS: Record<WorldViewLevel, number> = {
  world: 0b001,
  settlement: 0b010,
  resident: 0b100,
};

function lodMask(level: WorldViewLevel): number {
  return LOD_MASKS[level];
}

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
  [TerrainType.DeepOcean]: '#24586d',
  [TerrainType.ShallowOcean]: '#438696',
  [TerrainType.Beach]: '#d4bb79',
  [TerrainType.Grass]: '#78a461',
  [TerrainType.Forest]: '#4d7b51',
  [TerrainType.Desert]: '#c9a069',
  [TerrainType.Snow]: '#dce7df',
  [TerrainType.Mountain]: '#797f78',
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
  dirtyLodMask: number;
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
  private static readonly ATLAS_SIZE = 4_096;
  private static readonly SLOT_SIZE = 48;
  private readonly textures = new Map<string, Texture>();
  private readonly atlasCanvas = document.createElement('canvas');
  private readonly atlasTexture: Texture;
  private readonly slotAllocator: PixelAtlasSlotAllocator;

  constructor(onReset: () => void) {
    this.atlasCanvas.width = PixelTextureFactory.ATLAS_SIZE;
    this.atlasCanvas.height = PixelTextureFactory.ATLAS_SIZE;
    this.atlasTexture = Texture.from(this.atlasCanvas);
    this.atlasTexture.source.scaleMode = 'nearest';
    this.atlasTexture.source.autoGenerateMipmaps = false;
    const slotsPerAxis = Math.floor(PixelTextureFactory.ATLAS_SIZE / PixelTextureFactory.SLOT_SIZE);
    this.slotAllocator = new PixelAtlasSlotAllocator(slotsPerAxis * slotsPerAxis, () => {
      for (const texture of this.textures.values()) texture.destroy(false);
      this.textures.clear();
      const context = this.atlasCanvas.getContext('2d', { alpha: true });
      context?.clearRect(0, 0, PixelTextureFactory.ATLAS_SIZE, PixelTextureFactory.ATLAS_SIZE);
      this.atlasTexture.source.update();
      onReset();
    });
  }

  human(
    id: number,
    profession: Profession,
    kingdomId: number,
    role: ResidentRole,
    weaponTier: number,
    armorTier: number,
    carriedKind: CarriedResourceKind,
    facing: HumanFacing,
    pose: HumanPose,
    frame: number,
  ): Texture {
    const key = `human:${id % 12}:${profession}:${kingdomPaletteIndex(kingdomId)}:${role}:${weaponTier}:${armorTier}:${carriedKind}:${facing}:${pose}:${frame}`;
    return this.get(
      key,
      FORMAL_PIXEL_ASSETS.resident.width,
      FORMAL_PIXEL_ASSETS.resident.height,
      (context) => {
        const skin = ['#f3c7a1', '#dca77f', '#bb7d59', '#8b593e'][id % 4] ?? '#e1aa82';
        const hair =
          ['#3a2b25', '#65452f', '#c18a47', '#22282e'][Math.floor(id / 2) % 4] ?? '#3a2b25';
        const kingdom = kingdomColor(kingdomId);
        const cloth = profession === Profession.Guard ? shade(kingdom, 0.82) : kingdom;
        const pants = armorTier > 0 ? '#596571' : '#4d5149';
        context.fillStyle = 'rgba(20, 31, 28, 0.25)';
        context.fillRect(5, 29, 14, 2);
        context.fillStyle = pants;
        const walking = pose === 'walk' || pose === 'carry';
        context.fillRect(7, 21 + (walking && frame % 2 === 0 ? 1 : 0), 4, 9);
        context.fillRect(13, 21 + (walking && frame % 2 === 1 ? 1 : 0), 4, 9);
        context.fillStyle = cloth;
        context.fillRect(6, 12, 12, 11);
        context.fillStyle = shade(cloth, 1.22);
        context.fillRect(7, 12, 10, 3);
        if (armorTier > 0) {
          context.fillStyle = armorTier >= 3 ? '#d6dce0' : armorTier === 2 ? '#9eabb2' : '#7f8b91';
          context.fillRect(7, 14, 10, 7);
          context.fillStyle = '#54616a';
          context.fillRect(11, 14, 2, 7);
        }
        context.fillStyle = skin;
        context.fillRect(2, 14, 4, 9);
        context.fillRect(18, 14, 4, 9);
        context.fillRect(7, 4, 10, 9);
        context.fillStyle = hair;
        context.fillRect(7, 2, 10, 4);
        context.fillRect(6, 4, 3, 6);
        if ((id + profession) % 3 === 0) context.fillRect(16, 5, 3, 5);
        if (facing !== 'north') {
          context.fillStyle = '#25272a';
          if (facing === 'south') {
            context.fillRect(9, 8, 1, 1);
            context.fillRect(14, 8, 1, 1);
          } else {
            context.fillRect(15, 8, 1, 1);
          }
        }
        if (pose === 'sleep') {
          context.fillStyle = shade(cloth, 0.82);
          context.fillRect(4, 24, 16, 5);
        }
        drawProfession(context, profession, weaponTier);
        drawCarriedResource(context, carriedKind);
        drawRole(context, role);
      },
    );
  }

  animal(kind: EntityKind, variant: number, pose: AnimalPose, frame: number): Texture {
    const key = `animal:${kind}:${variant % 4}:${pose}:${frame}`;
    const profile = animalVisualProfile(kind);
    const asset = profile.large ? FORMAL_PIXEL_ASSETS.largeAnimal : FORMAL_PIXEL_ASSETS.animal;
    return this.get(key, asset.width, asset.height, (context) =>
      drawAnimal(context, kind, variant, pose, frame),
    );
  }

  building(
    type: BuildingType,
    kingdomId: number,
    tier: VillageTier,
    stage: number,
    damaged: boolean,
  ): Texture {
    const key = `building:${type}:${kingdomPaletteIndex(kingdomId)}:${tier}:${stage}:${damaged ? 1 : 0}`;
    return this.get(
      key,
      FORMAL_PIXEL_ASSETS.building.width,
      FORMAL_PIXEL_ASSETS.building.height,
      (context) => drawBuilding(context, type, kingdomColor(kingdomId), tier, stage, damaged),
    );
  }

  destroy(): void {
    for (const texture of this.textures.values()) texture.destroy(false);
    this.textures.clear();
    this.atlasTexture.destroy(true);
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
    const columns = Math.floor(PixelTextureFactory.ATLAS_SIZE / PixelTextureFactory.SLOT_SIZE);
    const { slot } = this.slotAllocator.allocate(key);
    const atlasX = (slot % columns) * PixelTextureFactory.SLOT_SIZE;
    const atlasY = Math.floor(slot / columns) * PixelTextureFactory.SLOT_SIZE;
    const atlasContext = this.atlasCanvas.getContext('2d', { alpha: true });
    if (!atlasContext) throw new Error('无法创建像素图集');
    atlasContext.imageSmoothingEnabled = false;
    atlasContext.clearRect(
      atlasX,
      atlasY,
      PixelTextureFactory.SLOT_SIZE,
      PixelTextureFactory.SLOT_SIZE,
    );
    atlasContext.drawImage(canvas, atlasX, atlasY);
    this.atlasTexture.source.update();
    const texture = new Texture({
      source: this.atlasTexture.source,
      frame: new Rectangle(atlasX, atlasY, width, height),
    });
    this.textures.set(key, texture);
    return texture;
  }
}

export class EonValeEngine {
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly terrainLayer = new Container();
  private readonly territoryLayer = new Graphics({ roundPixels: true });
  private readonly planningLayer = new Graphics({ roundPixels: true });
  private readonly settlementCoreLayer = new Graphics({ roundPixels: true });
  private readonly treeCanopyBackLayer = new Graphics({ roundPixels: true });
  private readonly hotspotLayer = new Graphics({ roundPixels: true });
  private readonly buildingLayer = new Container();
  private readonly stockpileLayer = new Graphics({ roundPixels: true });
  private readonly carcassLayer = new Graphics({ roundPixels: true });
  private readonly entityLayer = new Container();
  private readonly treeCanopyFrontLayer = new Graphics({ roundPixels: true });
  private readonly statusLayer = new Graphics({ roundPixels: true });
  private readonly combatStatusLayer = new Graphics({ roundPixels: true });
  private readonly interactionLayer = new Graphics({ roundPixels: true });
  private readonly effectLayer = new Graphics({ roundPixels: true });
  private readonly labelLayer = new Container();
  private readonly interpolator = new SnapshotInterpolator();
  private readonly textureFactory = new PixelTextureFactory(() => {
    for (const sprite of this.entitySprites) sprite.texture = Texture.EMPTY;
    for (const sprite of this.buildingSprites.values()) sprite.texture = Texture.EMPTY;
    this.entityTextureKeys.length = 0;
    this.buildingTextureKeys.clear();
    this.pixelTexturesInvalidated = true;
  });
  private readonly terrainChunks = new Map<number, TerrainChunkRecord>();
  private readonly entitySprites: Sprite[] = [];
  private readonly entityTextureKeys: string[] = [];
  private readonly buildingSprites = new Map<number, Sprite>();
  private readonly buildingTextureKeys = new Map<number, string>();
  private readonly settlementLabels = new Map<number, Text>();
  private readonly activityAlertLabels = new Map<string, Text>();
  private readonly lastAttackFeedbackTicks = new Map<number, number>();
  private readonly transientEffects: TransientEffect[] = [];
  private readonly damageFlashUntil = new Map<number, number>();
  private previousEntityActive = new Uint8Array();
  private previousEntityHealth = new Uint16Array();
  private readonly initializePromise: Promise<void>;
  private map: WorldMapSnapshot | null = null;
  private snapshot: WorldRenderSnapshot | null = null;
  private resourceNodes: ClientResourceNodes | null = null;
  private territoryVillageIds: Uint16Array | null = null;
  private territoryClaimStrength: Uint8Array | null = null;
  private territoryPlanningZoneKinds: Uint8Array | null = null;
  private territoryRevision = 0;
  private kingdomObservation: KingdomObservation | null = null;
  private kingdomObservationKey = '';
  private readonly resourceBuckets = new Map<number, number[]>();
  private camera: PixelCamera;
  private cameraTween: CameraTween | null = null;
  private selectedTarget: WorldSelection | null = null;
  private readonly highlightedEntityIds = new Set<number>();
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
  private visibleTreeCanopies = 0;
  private treeCanopyCameraKey = '';
  private totalAttackHits = 0;
  private pixelTexturesInvalidated = false;

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
        this.redrawSettlementCores();
        this.redrawOutdoorStockpiles();
        this.redrawCarcasses();
        this.updateTerritories();
        this.updateWorkHotspots();
        this.updateSettlementLabels();
        if (this.selectedTarget?.kind === 'entity') this.redrawTreeCanopies();
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
        viewZoom('world', {
          mapSize: map.size,
          viewportWidth: this.camera.viewportWidth,
          viewportHeight: this.camera.viewportHeight,
        }),
        this.camera.viewportWidth,
        this.camera.viewportHeight,
      );
      this.setViewLevel('world');
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
    const redrawStartedAt = performance.now();
    this.redrawRenderChunkTargets(targets);
    const redrawMs = performance.now() - redrawStartedAt;
    this.canvas.dataset.mapDeltaRedrawChunks = String(targets.size);
    this.canvas.dataset.mapDeltaRedrawMs = redrawMs.toFixed(2);
    this.canvas.dataset.mapDeltaRedrawMaxMs = Math.max(
      redrawMs,
      Number(this.canvas.dataset.mapDeltaRedrawMaxMs ?? 0),
    ).toFixed(2);
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
    const redrawStartedAt = performance.now();
    if (snapshot.full) {
      for (const record of this.terrainChunks.values()) this.drawTerrainChunk(record);
    } else {
      this.redrawRenderChunkTargets(changedTargets);
    }
    this.redrawTreeCanopies(true);
    const redrawMs = performance.now() - redrawStartedAt;
    this.canvas.dataset.resourceRedrawChunks = String(changedTargets.size);
    this.canvas.dataset.resourceRedrawMs = redrawMs.toFixed(2);
    this.canvas.dataset.resourceRedrawMaxMs = Math.max(
      redrawMs,
      Number(this.canvas.dataset.resourceRedrawMaxMs ?? 0),
    ).toFixed(2);
  }

  setTerritory(snapshot: TerritorySnapshot): void {
    const expectedCells = this.map ? this.map.size * this.map.size : snapshot.cells.length;
    if (
      snapshot.full ||
      !this.territoryVillageIds ||
      !this.territoryClaimStrength ||
      !this.territoryPlanningZoneKinds ||
      this.territoryVillageIds.length !== expectedCells
    ) {
      this.territoryVillageIds = new Uint16Array(expectedCells);
      this.territoryClaimStrength = new Uint8Array(expectedCells);
      this.territoryPlanningZoneKinds = new Uint8Array(expectedCells);
    }
    const villageIds = this.territoryVillageIds;
    const claimStrength = this.territoryClaimStrength;
    const planningZoneKinds = this.territoryPlanningZoneKinds;
    for (let index = 0; index < snapshot.cells.length; index += 1) {
      const cell = snapshot.cells[index] ?? 0;
      if (cell >= villageIds.length) continue;
      villageIds[cell] = snapshot.villageIds[index] ?? 0;
      claimStrength[cell] = snapshot.claimStrength[index] ?? 0;
      planningZoneKinds[cell] = snapshot.planningZoneKinds[index] ?? 0;
    }
    this.canvas.dataset.territoryRevision = String(snapshot.revision);
    this.canvas.dataset.territoryDeltaCells = String(snapshot.cells.length);
    this.territoryRevision = snapshot.revision;
    if (this.ready) this.updateTerritories();
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
      if (record) this.redrawVisibleTerrainChunk(record);
    }
  }

  private redrawVisibleTerrainChunk(record: TerrainChunkRecord): void {
    record.dirtyLodMask = 0b111;
    this.drawTerrainChunk(record, this.viewLevel);
    record.dirtyLodMask &= ~lodMask(this.viewLevel);
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
    const previousKingdomSelection = this.selectedTarget?.kind === 'kingdom';
    this.selectedTarget = selection;
    if (selection) this.canvas.dataset.selectedTarget = `${selection.kind}:${selection.id}`;
    else delete this.canvas.dataset.selectedTarget;
    this.canvas.dataset.selectionOutline = String(Boolean(selection));
    this.redrawInteraction();
    if (this.ready && (selection?.kind === 'entity' || !selection)) this.redrawTreeCanopies(true);
    if (
      this.ready &&
      this.overlay === 'territory' &&
      (previousKingdomSelection || selection?.kind === 'kingdom')
    ) {
      this.updateTerritories();
    }
  }

  setHighlightedEntities(entityIds: number[]): void {
    this.highlightedEntityIds.clear();
    for (const entityId of entityIds) this.highlightedEntityIds.add(entityId);
    this.canvas.dataset.highlightedResidents = String(this.highlightedEntityIds.size);
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
    if (this.ready) {
      this.redrawTerrainChunks([]);
      this.updateTerritories();
      this.updateWorkHotspots();
    }
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
      toZoom: viewZoom(level, this.camera),
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
      toZoom: viewZoom('world', this.camera),
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
      this.planningLayer,
      this.settlementCoreLayer,
      this.treeCanopyBackLayer,
      this.buildingLayer,
      this.stockpileLayer,
      this.carcassLayer,
      this.entityLayer,
      this.treeCanopyFrontLayer,
      this.hotspotLayer,
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
      this.redrawSettlementCores();
      this.redrawOutdoorStockpiles();
      this.redrawCarcasses();
      this.updateTerritories();
      this.updateWorkHotspots();
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
    if (this.pixelTexturesInvalidated) {
      this.pixelTexturesInvalidated = false;
      this.updateBuildings();
    }
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
    this.setViewLevel(resolveViewLevel(this.viewLevel, this.camera.zoom, this.camera));
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
          dirtyLodMask: 0,
        };
        this.terrainChunks.set(index, record);
        this.drawTerrainChunk(record);
      }
    }
    this.canvas.dataset.terrainChunks = String(this.terrainChunks.size);
    this.canvas.dataset.pixelTiles = 'true';
    this.redrawTreeCanopies(true);
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
      if (record) this.redrawVisibleTerrainChunk(record);
    }
  }

  private drawTerrainChunk(record: TerrainChunkRecord, level?: WorldViewLevel): void {
    const map = this.map;
    if (!map) return;
    const drawSettlement = level === undefined || level === 'settlement';
    const drawWorld = level === undefined || level === 'world';
    const drawResident = level === undefined || level === 'resident';
    const context = drawSettlement ? record.canvas.getContext('2d') : null;
    const overviewContext = drawWorld ? record.overviewCanvas.getContext('2d') : null;
    const residentContext = drawResident ? record.residentCanvas.getContext('2d') : null;
    if (drawSettlement && !context) return;
    if (drawWorld && !overviewContext) return;
    if (drawResident && !residentContext) return;
    if (context) {
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, record.canvas.width, record.canvas.height);
    }
    if (overviewContext) {
      overviewContext.imageSmoothingEnabled = false;
      overviewContext.clearRect(0, 0, record.overviewCanvas.width, record.overviewCanvas.height);
    }
    if (residentContext) {
      residentContext.imageSmoothingEnabled = false;
      residentContext.clearRect(0, 0, record.residentCanvas.width, record.residentCanvas.height);
    }
    for (let localZ = 0; localZ < record.cellsHigh; localZ += 1) {
      for (let localX = 0; localX < record.cellsWide; localX += 1) {
        const x = record.x + localX;
        const z = record.z + localZ;
        const cell = z * map.size + x;
        const terrain = map.terrain[cell] as TerrainType;
        const variation = ((Math.floor(x / 4) * 17 + Math.floor(z / 4) * 31) % 7) - 3;
        const terrainColor = overlayTerrainColor(map, cell, this.overlay, variation);
        if (overviewContext) {
          overviewContext.fillStyle = overlayTerrainColor(
            map,
            cell,
            this.overlay,
            variation * 0.45,
          );
          overviewContext.fillRect(localX, localZ, 1, 1);
        }
        if (context) {
          context.fillStyle = terrainColor;
          context.fillRect(
            localX * SOURCE_PIXELS_PER_CELL,
            localZ * SOURCE_PIXELS_PER_CELL,
            SOURCE_PIXELS_PER_CELL,
            SOURCE_PIXELS_PER_CELL,
          );
          drawTerrainDetail(context, map, cell, terrain, localX, localZ, 'districts');
        }
        if (residentContext) {
          residentContext.fillStyle = terrainColor;
          residentContext.fillRect(
            localX * SOURCE_PIXELS_PER_CELL,
            localZ * SOURCE_PIXELS_PER_CELL,
            SOURCE_PIXELS_PER_CELL,
            SOURCE_PIXELS_PER_CELL,
          );
          drawTerrainDetail(residentContext, map, cell, terrain, localX, localZ, 'resident');
        }
      }
    }
    this.drawResourceNodes(record, context, overviewContext, residentContext);
    if (context) record.texture.source.update();
    if (overviewContext) record.overviewTexture.source.update();
    if (residentContext) record.residentTexture.source.update();
  }

  private drawResourceNodes(
    record: TerrainChunkRecord,
    settlementContext: CanvasRenderingContext2D | null,
    overviewContext: CanvasRenderingContext2D | null,
    residentContext: CanvasRenderingContext2D | null,
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
          const residentProfile = resourceVisualProfile(kind, stage, 'resident');
          if (residentContext) {
            drawResourceNodeGlyph(
              residentContext,
              kind,
              stage,
              variant,
              sourceX,
              sourceZ,
              true,
              residentProfile.splitCanopy,
            );
          }
          const sampleRate =
            kind === ResourceNodeKind.Tree ? 3 : kind === ResourceNodeKind.Stone ? 2 : 1;
          if (settlementContext && (nodeId * 17 + variant * 7) % sampleRate === 0) {
            drawResourceNodeGlyph(settlementContext, kind, stage, variant, sourceX, sourceZ, false);
          }
          if (overviewContext) {
            const showForestCluster =
              kind === ResourceNodeKind.Tree &&
              stage >= ResourceNodeStage.Young &&
              (nodeId * 13 + variant * 7) % 3 === 0;
            const showResourceOverlay = this.overlay === 'resources';
            if (showForestCluster || showResourceOverlay) {
              overviewContext.fillStyle =
                kind === ResourceNodeKind.Tree
                  ? stage === ResourceNodeStage.Mature
                    ? '#285f42'
                    : '#3f7750'
                  : kind === ResourceNodeKind.Stone
                    ? '#a4aaa7'
                    : '#5d6d78';
              overviewContext.fillRect(Math.floor(x - record.x), Math.floor(z - record.z), 1, 1);
            }
          }
        }
      }
    }
  }

  private redrawTreeCanopies(force = false): void {
    const resources = this.resourceNodes;
    const map = this.map;
    const profile = VISUAL_LOD_PROFILES[this.viewLevel];
    const selectedEntityId = this.selectedTarget?.kind === 'entity' ? this.selectedTarget.id : -1;
    const selectedX =
      selectedEntityId >= 0 ? this.snapshot?.positionsX[selectedEntityId] : undefined;
    const selectedZ =
      selectedEntityId >= 0 ? this.snapshot?.positionsZ[selectedEntityId] : undefined;
    const cameraKey = `${this.viewLevel}:${this.camera.centerX.toFixed(2)}:${this.camera.centerZ.toFixed(2)}:${this.camera.zoom.toFixed(2)}:${this.canvas.dataset.resourceNodes ?? 0}:${selectedEntityId}:${selectedX?.toFixed(1) ?? ''}:${selectedZ?.toFixed(1) ?? ''}`;
    if (!force && this.treeCanopyCameraKey === cameraKey) return;
    this.treeCanopyCameraKey = cameraKey;
    this.treeCanopyBackLayer.clear();
    this.treeCanopyFrontLayer.clear();
    this.visibleTreeCanopies = 0;
    if (!resources || !map || !profile.splitTreeCanopy) {
      this.canvas.dataset.treeCanopyBack = '0';
      this.canvas.dataset.treeCanopyFront = '0';
      this.canvas.dataset.treeCanopyOcclusion = 'inactive';
      return;
    }

    const halfCellsX = this.camera.viewportWidth / (WORLD_PIXELS_PER_CELL * this.camera.zoom) / 2;
    const halfCellsZ = this.camera.viewportHeight / (WORLD_PIXELS_PER_CELL * this.camera.zoom) / 2;
    const minX = Math.max(0, this.camera.centerX - halfCellsX - 4);
    const maxX = Math.min(map.size, this.camera.centerX + halfCellsX + 4);
    const minZ = Math.max(0, this.camera.centerZ - halfCellsZ - 6);
    const maxZ = Math.min(map.size, this.camera.centerZ + halfCellsZ + 4);
    const bucketColumns = Math.ceil(map.size / 8);
    const firstBucketX = Math.floor(minX / 8);
    const lastBucketX = Math.floor(Math.max(minX, maxX - 0.001) / 8);
    const firstBucketZ = Math.floor(minZ / 8);
    const lastBucketZ = Math.floor(Math.max(minZ, maxZ - 0.001) / 8);
    const renderedNodes = new Set<number>();

    for (let bucketZ = firstBucketZ; bucketZ <= lastBucketZ; bucketZ += 1) {
      for (let bucketX = firstBucketX; bucketX <= lastBucketX; bucketX += 1) {
        for (const nodeId of this.resourceBuckets.get(bucketZ * bucketColumns + bucketX) ?? []) {
          if (renderedNodes.has(nodeId)) continue;
          renderedNodes.add(nodeId);
          if (
            resources.active[nodeId] !== 1 ||
            resources.kind[nodeId] !== ResourceNodeKind.Tree ||
            resources.stage[nodeId] !== ResourceNodeStage.Mature
          ) {
            continue;
          }
          const x = resources.positionsX[nodeId] ?? 0;
          const z = resources.positionsZ[nodeId] ?? 0;
          if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
          const groundX = x * WORLD_PIXELS_PER_CELL;
          const groundY = z * WORLD_PIXELS_PER_CELL;
          const variant = resources.variant[nodeId] ?? 0;
          const crown = [0x285f3f, 0x32704a, 0x3b7845, 0x24644a][variant % 4] ?? 0x285f3f;
          const highlight = [0x3d7950, 0x43875a, 0x4b8f56, 0x357d59][variant % 4] ?? 0x3d7950;
          const frontAlpha = selectedTreeCanopyAlpha(x, z, selectedX, selectedZ);
          this.treeCanopyBackLayer
            .rect(groundX - 6, groundY - 15, 12, 7)
            .rect(groundX - 4, groundY - 18, 8, 4)
            .fill({ color: crown, alpha: 1 });
          this.treeCanopyBackLayer
            .rect(groundX - 4, groundY - 16, 5, 2)
            .fill({ color: highlight, alpha: 0.95 });
          this.treeCanopyFrontLayer
            .rect(groundX - 7, groundY - 9, 14, 5)
            .rect(groundX - 5, groundY - 5, 4, 2)
            .rect(groundX + 2, groundY - 5, 4, 2)
            .fill({ color: crown, alpha: 0.96 * frontAlpha });
          this.visibleTreeCanopies += 1;
        }
      }
    }
    this.canvas.dataset.treeCanopyBack = String(this.visibleTreeCanopies);
    this.canvas.dataset.treeCanopyFront = String(this.visibleTreeCanopies);
    this.canvas.dataset.treeCanopyOcclusion = 'split-front-back';
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
      const profession = (latest.professions?.[entityId] ?? Profession.Forager) as Profession;
      const kingdomId = latest.kingdomIds?.[entityId] ?? 0;
      const kingdomPalette = kingdomPaletteIndex(kingdomId);
      const role = (latest.roles?.[entityId] ?? ResidentRole.Citizen) as ResidentRole;
      const weapon = latest.weaponTiers?.[entityId] ?? 0;
      const armor = latest.armorTiers?.[entityId] ?? 0;
      const carriedKind = (this.snapshot?.carriedResourceKinds[entityId] ??
        0) as CarriedResourceKind;
      const facing = humanFacing(sample.heading);
      const residentPose = humanPose(sample.state, carriedKind);
      const creaturePose = animalPose(kind, sample.state);
      const frame = animationFrame(
        kind === EntityKind.Human ? residentPose : creaturePose,
        latest.tick,
        entityId,
        kind !== EntityKind.Human,
      );
      const visualKey =
        kind === EntityKind.Human
          ? `h:${entityId % 12}:${profession}:${kingdomPalette}:${role}:${weapon}:${armor}:${carriedKind}:${facing}:${residentPose}:${frame}`
          : `a:${kind}:${entityId % 4}:${creaturePose}:${frame}`;
      if (this.entityTextureKeys[entityId] !== visualKey) {
        sprite.texture =
          kind === EntityKind.Human
            ? this.textureFactory.human(
                entityId,
                profession,
                kingdomId,
                role,
                weapon,
                armor,
                carriedKind,
                facing,
                residentPose,
                frame,
              )
            : this.textureFactory.animal(kind, entityId, creaturePose, frame);
        this.entityTextureKeys[entityId] = visualKey;
      }
      const moving = usesTravelPose(sample.state);
      const bob =
        this.viewLevel === 'resident' && moving && (Math.floor(now / 160) + entityId) % 2 === 0
          ? -0.25
          : 0;
      const horizontalFacing = facing === 'west' ? -1 : 1;
      const attackFrame = attackThrustFrame(sample.state, latest.tick, entityId);
      const thrust = attackFrame * horizontalFacing * 0.45;
      sprite.position.set(
        sample.x * WORLD_PIXELS_PER_CELL + thrust,
        sample.z * WORLD_PIXELS_PER_CELL + bob,
      );
      const working = usesWorkPose(sample.state);
      const workSwing = working ? Math.sin((latest.tick + entityId * 3) * 0.55) * 0.045 : 0;
      sprite.rotation = attackFrame ? horizontalFacing * 0.045 : workSwing;
      const ageScale = kind === EntityKind.Human ? humanAgeScale(latest.ages?.[entityId] ?? 18) : 1;
      const viewScale = this.viewLevel === 'resident' ? 1 : 0.52;
      sprite.scale.set(
        ENTITY_SOURCE_SCALE * horizontalFacing * ageScale * viewScale,
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
      const tier = village?.tier ?? VillageTier.Camp;
      const kingdomId = village?.kingdomId ?? 0;
      const key = `${building.type}:${kingdomPaletteIndex(kingdomId)}:${tier}:${building.stage}:${damaged ? 1 : 0}`;
      if (this.buildingTextureKeys.get(building.id) !== key) {
        sprite.texture = this.textureFactory.building(
          building.type,
          kingdomId,
          tier,
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
    this.canvas.dataset.settlementMaterialTiers = String(
      new Set(snapshot.villages.map((village) => village.tier)).size,
    );
    this.redrawBuildingStatus();
  }

  private redrawCarcasses(): void {
    this.carcassLayer.clear();
    const snapshot = this.snapshot;
    if (!snapshot) return;
    this.canvas.dataset.carcasses = String(snapshot.carcasses.length);
    if (this.viewLevel === 'world') return;
    const scale = this.viewLevel === 'resident' ? 1 : 0.72;
    for (const carcass of snapshot.carcasses) {
      const x = carcass.x * WORLD_PIXELS_PER_CELL;
      const z = carcass.z * WORLD_PIXELS_PER_CELL;
      const freshness = Math.max(0.3, Math.min(1, (carcass.decayAtTick - snapshot.tick) / 360));
      this.carcassLayer
        .rect(x - 2.5 * scale, z - 1.1 * scale, 5 * scale, 2.2 * scale)
        .fill({ color: 0x75483b, alpha: 0.86 * freshness });
      this.carcassLayer
        .rect(x - 3.1 * scale, z - 0.35 * scale, 1.4 * scale, 0.7 * scale)
        .fill({ color: 0xd8c7a0, alpha: 0.78 * freshness });
      this.carcassLayer
        .rect(x + 1.7 * scale, z - 0.35 * scale, 1.4 * scale, 0.7 * scale)
        .fill({ color: 0xd8c7a0, alpha: 0.78 * freshness });
    }
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

  private redrawOutdoorStockpiles(): void {
    this.stockpileLayer.clear();
    const snapshot = this.snapshot;
    if (!snapshot || this.viewLevel === 'world') {
      this.canvas.dataset.outdoorStockpiles = '0';
      return;
    }
    const colors = [0xd8b94d, 0x8b623c, 0x89918c, 0x637a86, 0xd3a446, 0xaab3b1, 0xd4dadd];
    let visible = 0;
    for (const village of snapshot.villages) {
      const amounts = Object.values(village.outdoorStockpile);
      if (!amounts.some((amount) => amount > 0)) continue;
      const originX = (village.x + 2.1) * WORLD_PIXELS_PER_CELL;
      const originZ = (village.z + 1.4) * WORLD_PIXELS_PER_CELL;
      this.stockpileLayer
        .ellipse(originX + 3, originZ + 2, 8, 3)
        .fill({ color: 0x2b332e, alpha: 0.35 });
      amounts.forEach((amount, index) => {
        if (amount <= 0) return;
        const column = visible % 4;
        this.stockpileLayer
          .rect(originX + column * 2, originZ - Math.min(4, Math.ceil(amount / 20)), 2, 4)
          .fill({ color: colors[index] ?? 0xb7a98a, alpha: 0.95 });
        visible += 1;
      });
    }
    this.canvas.dataset.outdoorStockpiles = String(visible);
  }

  private redrawSettlementCores(): void {
    this.settlementCoreLayer.clear();
    const snapshot = this.snapshot;
    if (!snapshot || this.viewLevel === 'world') {
      this.canvas.dataset.settlementTierGlyphs = '0';
      return;
    }
    let visible = 0;
    for (const village of snapshot.villages) {
      if (village.health <= 0) continue;
      const x = village.x * WORLD_PIXELS_PER_CELL;
      const z = village.z * WORLD_PIXELS_PER_CELL;
      if (village.tier === VillageTier.Camp) {
        this.settlementCoreLayer
          .poly([x - 7, z + 3, x - 3, z - 4, x + 1, z + 3])
          .fill({ color: 0xa8794f, alpha: 0.92 })
          .stroke({ color: 0xe4c28a, width: 0.6, alpha: 0.9 });
        this.settlementCoreLayer
          .circle(x + 5, z + 2, 2.2)
          .fill({ color: 0xf0a13a, alpha: 0.9 })
          .circle(x + 5, z + 1, 0.9)
          .fill({ color: 0xffdf6b, alpha: 1 });
      } else if (village.tier === VillageTier.Hamlet) {
        this.settlementCoreLayer
          .circle(x, z, 6)
          .stroke({ color: 0xb98b58, width: 0.9, alpha: 0.7 });
      } else if (village.tier === VillageTier.Town) {
        this.settlementCoreLayer
          .rect(x - 6, z - 4, 12, 8)
          .fill({ color: 0xb7ad95, alpha: 0.16 })
          .stroke({ color: 0xcac1aa, width: 0.9, alpha: 0.72 });
      } else {
        this.settlementCoreLayer
          .rect(x - 7, z - 5, 14, 10)
          .stroke({ color: 0xd9d3c3, width: 1.1, alpha: 0.8 })
          .rect(x - 4, z - 3, 8, 6)
          .stroke({ color: 0xe9c963, width: 0.8, alpha: 0.85 });
      }
      visible += 1;
    }
    this.canvas.dataset.settlementTierGlyphs = String(visible);
  }

  private updateTerritories(): void {
    const snapshot = this.snapshot;
    const map = this.map;
    const territoryVillageIds = this.territoryVillageIds;
    const territoryClaimStrength = this.territoryClaimStrength;
    const planningZoneKinds = this.territoryPlanningZoneKinds;
    this.territoryLayer.clear();
    this.planningLayer.clear();
    const resetObservation = (): void => {
      this.canvas.dataset.kingdomBorders = '0';
      this.canvas.dataset.villageBorders = '0';
      this.canvas.dataset.capitalMarkers = '0';
      this.canvas.dataset.kingdomAdjacencies = '0';
      this.canvas.dataset.adjacencyLinks = '0';
      this.canvas.dataset.warRelations = '0';
      this.canvas.dataset.warFronts = '0';
      delete this.canvas.dataset.observedKingdom;
    };
    if (
      snapshot &&
      map &&
      territoryVillageIds &&
      planningZoneKinds &&
      this.overlay === 'planning'
    ) {
      const colors: Record<number, number> = {
        [PlanningZoneKind.Residential]: 0x72b7d8,
        [PlanningZoneKind.Production]: 0xd6ad55,
        [PlanningZoneKind.Defense]: 0xd86666,
      };
      let visible = 0;
      for (let z = 0; z < map.size; z += 1) {
        let x = 0;
        while (x < map.size) {
          const cell = z * map.size + x;
          const kind = planningZoneKinds[cell] ?? PlanningZoneKind.None;
          if (kind === PlanningZoneKind.None || territoryVillageIds[cell] === 0) {
            x += 1;
            continue;
          }
          let endX = x + 1;
          while (
            endX < map.size &&
            planningZoneKinds[z * map.size + endX] === kind &&
            territoryVillageIds[z * map.size + endX] === territoryVillageIds[cell]
          ) {
            endX += 1;
          }
          this.planningLayer
            .rect(
              x * WORLD_PIXELS_PER_CELL,
              z * WORLD_PIXELS_PER_CELL,
              (endX - x) * WORLD_PIXELS_PER_CELL,
              WORLD_PIXELS_PER_CELL,
            )
            .fill({ color: colors[kind] ?? 0xffffff, alpha: 0.24 });
          visible += endX - x;
          x = endX;
        }
      }
      this.canvas.dataset.planningZoneCells = String(visible);
      this.canvas.dataset.strategicTerritories = 'false';
      this.canvas.dataset.strategicTerritoryCells = '0';
      resetObservation();
      return;
    }
    this.canvas.dataset.planningZoneCells = '0';
    if (
      !snapshot ||
      !map ||
      !territoryVillageIds ||
      !territoryClaimStrength ||
      this.overlay !== 'territory'
    ) {
      this.canvas.dataset.strategicTerritories = 'false';
      this.canvas.dataset.strategicTerritoryCells = '0';
      resetObservation();
      return;
    }
    const villages = new Map(snapshot.villages.map((village) => [village.id, village]));
    const kingdoms = new Map(snapshot.kingdoms.map((kingdom) => [kingdom.id, kingdom]));
    const observationKey = `${map.size}:${this.territoryRevision}:${snapshot.villages
      .map((village) => `${village.id}.${village.kingdomId}`)
      .join(',')}:${snapshot.kingdoms
      .map(
        (kingdom) =>
          `${kingdom.id}.${kingdom.capitalVillageId}.${Number(kingdom.extinct)}.${Object.entries(
            kingdom.relations,
          )
            .sort(([first], [second]) => Number(first) - Number(second))
            .map(([id, relation]) => `${id}-${relation}`)
            .join('_')}`,
      )
      .join(',')}`;
    if (!this.kingdomObservation || observationKey !== this.kingdomObservationKey) {
      this.kingdomObservation = deriveKingdomObservation({
        size: map.size,
        villageIds: territoryVillageIds,
        villages: snapshot.villages,
        kingdoms: snapshot.kingdoms,
      });
      this.kingdomObservationKey = observationKey;
    }
    const observation = this.kingdomObservation;
    const observedKingdomId =
      this.selectedTarget?.kind === 'kingdom'
        ? this.selectedTarget.id
        : this.hoveredTarget?.kind === 'kingdom'
          ? this.hoveredTarget.id
          : 0;
    if (observedKingdomId > 0) this.canvas.dataset.observedKingdom = String(observedKingdomId);
    else delete this.canvas.dataset.observedKingdom;
    let territoryCells = 0;
    for (let z = 0; z < map.size; z += 1) {
      let x = 0;
      while (x < map.size) {
        const cell = z * map.size + x;
        const villageId = territoryVillageIds[cell] ?? 0;
        if (!villageId) {
          x += 1;
          continue;
        }
        let endX = x + 1;
        while (endX < map.size && territoryVillageIds[z * map.size + endX] === villageId) {
          endX += 1;
        }
        const village = villages.get(villageId);
        const kingdomId = village?.kingdomId ?? 0;
        const color = hexNumber(kingdoms.get(kingdomId)?.color ?? kingdomColor(kingdomId));
        const claimAlpha = 0.08 + ((territoryClaimStrength[cell] ?? 0) / 255) * 0.1;
        const alpha =
          observedKingdomId > 0
            ? kingdomId === observedKingdomId
              ? Math.max(0.22, claimAlpha)
              : 0.035
            : claimAlpha;
        this.territoryLayer
          .rect(
            x * WORLD_PIXELS_PER_CELL,
            z * WORLD_PIXELS_PER_CELL,
            (endX - x) * WORLD_PIXELS_PER_CELL,
            WORLD_PIXELS_PER_CELL,
          )
          .fill({ color, alpha });
        territoryCells += endX - x;
        x = endX;
      }
    }
    const drawSegment = (
      segment: KingdomBorderSegment,
      color: number,
      width: number,
      alpha: number,
    ): void => {
      if (segment.orientation === 'vertical') {
        this.territoryLayer
          .moveTo(segment.line * WORLD_PIXELS_PER_CELL, segment.start * WORLD_PIXELS_PER_CELL)
          .lineTo(segment.line * WORLD_PIXELS_PER_CELL, segment.end * WORLD_PIXELS_PER_CELL)
          .stroke({ color, width, alpha });
        return;
      }
      this.territoryLayer
        .moveTo(segment.start * WORLD_PIXELS_PER_CELL, segment.line * WORLD_PIXELS_PER_CELL)
        .lineTo(segment.end * WORLD_PIXELS_PER_CELL, segment.line * WORLD_PIXELS_PER_CELL)
        .stroke({ color, width, alpha });
    };
    for (const segment of observation.villageBorders) {
      const highlighted = observedKingdomId > 0 && segment.firstKingdomId === observedKingdomId;
      drawSegment(segment, 0xe4eadc, highlighted ? 0.75 : 0.45, highlighted ? 0.72 : 0.34);
    }
    for (const segment of observation.kingdomBorders) {
      const highlighted =
        segment.firstKingdomId === observedKingdomId ||
        segment.secondKingdomId === observedKingdomId;
      const ownerId = segment.firstKingdomId || segment.secondKingdomId;
      drawSegment(
        segment,
        highlighted ? 0xffdb73 : hexNumber(kingdoms.get(ownerId)?.color ?? kingdomColor(ownerId)),
        highlighted ? 1.8 : 1.15,
        observedKingdomId > 0 && !highlighted ? 0.28 : 0.9,
      );
    }
    for (const segment of observation.warFronts)
      drawSegment(segment, 0xef5f4c, 2.25, observedKingdomId > 0 ? 0.95 : 0.86);

    let capitalMarkers = 0;
    for (const kingdom of snapshot.kingdoms) {
      if (kingdom.extinct || kingdom.capitalVillageId <= 0) continue;
      const capital = villages.get(kingdom.capitalVillageId);
      if (!capital) continue;
      const x = capital.x * WORLD_PIXELS_PER_CELL;
      const z = capital.z * WORLD_PIXELS_PER_CELL;
      const highlighted = kingdom.id === observedKingdomId;
      this.territoryLayer
        .poly([x, z - 3.2, x + 3.2, z, x, z + 3.2, x - 3.2, z])
        .fill({ color: 0xf5cd62, alpha: highlighted ? 1 : 0.9 })
        .stroke({
          color: highlighted ? 0xfff1a3 : 0x4a3824,
          width: highlighted ? 1.2 : 0.8,
        });
      capitalMarkers += 1;
    }

    let adjacencyLinks = 0;
    const observedKingdom = kingdoms.get(observedKingdomId);
    const observedCapital = observedKingdom
      ? villages.get(observedKingdom.capitalVillageId)
      : undefined;
    if (observedKingdom && observedCapital) {
      for (const adjacency of observation.adjacencies) {
        if (
          adjacency.firstKingdomId !== observedKingdomId &&
          adjacency.secondKingdomId !== observedKingdomId
        )
          continue;
        const neighbourId =
          adjacency.firstKingdomId === observedKingdomId
            ? adjacency.secondKingdomId
            : adjacency.firstKingdomId;
        const neighbour = kingdoms.get(neighbourId);
        const neighbourCapital = neighbour ? villages.get(neighbour.capitalVillageId) : undefined;
        if (!neighbour || !neighbourCapital) continue;
        const relation = observedKingdom.relations[neighbourId] ?? DiplomacyState.Peace;
        const color =
          relation === DiplomacyState.War
            ? 0xef5f4c
            : relation === DiplomacyState.Alliance
              ? 0xf1cf68
              : 0x78c9bd;
        this.territoryLayer
          .moveTo(
            observedCapital.x * WORLD_PIXELS_PER_CELL,
            observedCapital.z * WORLD_PIXELS_PER_CELL,
          )
          .lineTo(
            neighbourCapital.x * WORLD_PIXELS_PER_CELL,
            neighbourCapital.z * WORLD_PIXELS_PER_CELL,
          )
          .stroke({ color, width: adjacency.diagonalOnly ? 0.7 : 0.95, alpha: 0.58 });
        adjacencyLinks += 1;
      }
    }

    let warRelations = 0;
    for (const kingdom of snapshot.kingdoms) {
      for (const [enemyId, relation] of Object.entries(kingdom.relations)) {
        if (relation !== DiplomacyState.War || kingdom.id >= Number(enemyId)) continue;
        const own = villages.get(kingdom.capitalVillageId);
        const enemyKingdom = kingdoms.get(Number(enemyId));
        const enemy = enemyKingdom ? villages.get(enemyKingdom.capitalVillageId) : undefined;
        if (!own || !enemy) continue;
        this.territoryLayer
          .moveTo(own.x * WORLD_PIXELS_PER_CELL, own.z * WORLD_PIXELS_PER_CELL)
          .lineTo(enemy.x * WORLD_PIXELS_PER_CELL, enemy.z * WORLD_PIXELS_PER_CELL)
          .stroke({ color: 0xe55f4d, width: 0.75, alpha: 0.5 });
        warRelations += 1;
      }
    }
    this.canvas.dataset.strategicTerritories = 'true';
    this.canvas.dataset.strategicTerritoryCells = String(territoryCells);
    this.canvas.dataset.kingdomBorders = String(observation.kingdomBorders.length);
    this.canvas.dataset.villageBorders = String(observation.villageBorders.length);
    this.canvas.dataset.capitalMarkers = String(capitalMarkers);
    this.canvas.dataset.kingdomAdjacencies = String(observation.adjacencies.length);
    this.canvas.dataset.adjacencyLinks = String(adjacencyLinks);
    this.canvas.dataset.warRelations = String(warRelations);
    this.canvas.dataset.warFronts = String(observation.warFronts.length);
  }

  private updateWorkHotspots(): void {
    this.hotspotLayer.clear();
    const snapshot = this.snapshot;
    if (!snapshot || this.overlay !== 'work' || this.viewLevel === 'world') {
      this.canvas.dataset.workHotspots = '0';
      this.canvas.dataset.workHotspotParticipants = '0';
      return;
    }
    const groups = new Map<string, { kind: string; count: number; x: number; z: number }>();
    for (let entityId = 0; entityId < snapshot.population; entityId += 1) {
      if (
        snapshot.active[entityId] !== 1 ||
        snapshot.kinds[entityId] !== EntityKind.Human ||
        (snapshot.villageIds[entityId] ?? 0) === 0
      ) {
        continue;
      }
      const state = snapshot.states[entityId] as AgentState;
      const kind =
        state === AgentState.Build || state === AgentState.Repair
          ? 'construction'
          : state === AgentState.Haul
            ? 'logistics'
            : state === AgentState.Guard ||
                state === AgentState.Chase ||
                state === AgentState.Attack
              ? 'defense'
              : state === AgentState.GatherWood ||
                  state === AgentState.GatherStone ||
                  state === AgentState.Farm ||
                  state === AgentState.Craft
                ? 'production'
                : null;
      if (!kind) continue;
      const x = snapshot.positionsX[entityId] ?? 0;
      const z = snapshot.positionsZ[entityId] ?? 0;
      const key = `${snapshot.villageIds[entityId]}:${kind}:${Math.floor(x / 6)}:${Math.floor(z / 6)}`;
      const group = groups.get(key) ?? { kind, count: 0, x: 0, z: 0 };
      group.count += 1;
      group.x += x;
      group.z += z;
      groups.set(key, group);
    }
    const colors: Record<string, number> = {
      production: 0xe0b553,
      construction: 0x79bde0,
      logistics: 0xb792de,
      defense: 0xe36b66,
    };
    let participants = 0;
    for (const group of groups.values()) {
      const x = (group.x / group.count) * WORLD_PIXELS_PER_CELL;
      const z = (group.z / group.count) * WORLD_PIXELS_PER_CELL;
      const radius = (1.3 + Math.min(2.4, Math.sqrt(group.count) * 0.7)) * WORLD_PIXELS_PER_CELL;
      this.hotspotLayer
        .circle(x, z, radius)
        .fill({ color: colors[group.kind] ?? 0xffffff, alpha: 0.18 })
        .stroke({ color: colors[group.kind] ?? 0xffffff, width: 0.8, alpha: 0.9 });
      participants += group.count;
    }
    this.canvas.dataset.workHotspots = String(groups.size);
    this.canvas.dataset.workHotspotParticipants = String(participants);
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
    this.updateActivityAlertLabels();
    this.updateSettlementLabelPositions();
  }

  private updateActivityAlertLabels(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const livingKeys = new Set<string>();
    for (const alert of snapshot.activityAlerts) {
      const key = `${alert.villageId}:${alert.reason}`;
      livingKeys.add(key);
      let label = this.activityAlertLabels.get(key);
      if (!label) {
        label = new Text({
          text: '',
          anchor: 0.5,
          roundPixels: true,
          resolution: 1,
          style: {
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 10,
            fontWeight: '700',
            fill: 0xffd27a,
            stroke: { color: 0x442d1d, width: 3 },
          },
        });
        this.labelLayer.addChild(label);
        this.activityAlertLabels.set(key, label);
      }
      label.text =
        alert.reason === 'critical-hunger' ? `⚠ ${alert.count} 人缺粮` : `⚠ ${alert.count} 人受阻`;
    }
    for (const [key, label] of this.activityAlertLabels) {
      if (livingKeys.has(key)) continue;
      this.labelLayer.removeChild(label);
      label.destroy();
      this.activityAlertLabels.delete(key);
    }
    this.canvas.dataset.activityAlerts = String(this.activityAlertLabels.size);
  }

  private updateSettlementLabelPositions(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const visible = this.viewLevel !== 'resident';
    const worldLabelIds =
      this.viewLevel === 'world'
        ? new Set(
            [...snapshot.villages]
              .sort((left, right) => right.population - left.population || left.id - right.id)
              .slice(0, WORLD_SETTLEMENT_LABEL_LIMIT)
              .map((village) => village.id),
          )
        : null;
    for (const village of snapshot.villages) {
      const label = this.settlementLabels.get(village.id);
      if (!label) continue;
      const screen = worldToScreen(this.camera, village.x, village.z);
      label.position.set(Math.round(screen.x), Math.round(screen.y - 16));
      label.visible =
        visible &&
        (!worldLabelIds || worldLabelIds.has(village.id)) &&
        screen.x > -100 &&
        screen.x < this.camera.viewportWidth + 100 &&
        screen.y > -60 &&
        screen.y < this.camera.viewportHeight + 60;
    }
    for (const alert of snapshot.activityAlerts) {
      const label = this.activityAlertLabels.get(`${alert.villageId}:${alert.reason}`);
      if (!label) continue;
      const screen = worldToScreen(this.camera, alert.x, alert.z);
      label.position.set(Math.round(screen.x), Math.round(screen.y - 32));
      label.visible =
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
    const firstBuilding = snapshot.buildings.find(
      (building) => building.health > 0 && building.villageId === first?.id,
    );
    if (firstBuilding) {
      const screen = worldToScreen(this.camera, firstBuilding.x, firstBuilding.z);
      this.canvas.dataset.firstBuildingScreen = `${screen.x.toFixed(1)},${screen.y.toFixed(1)}`;
    } else {
      delete this.canvas.dataset.firstBuildingScreen;
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
    const latest = this.interpolator.latest;
    if (latest && this.viewLevel !== 'world') {
      for (const entityId of this.highlightedEntityIds) {
        if (
          entityId >= latest.population ||
          (latest.active?.[entityId] ?? 0) !== 1 ||
          (latest.health?.[entityId] ?? 0) <= 0
        ) {
          continue;
        }
        this.interactionLayer
          .circle(
            (latest.positionsX[entityId] ?? 0) * WORLD_PIXELS_PER_CELL,
            (latest.positionsZ[entityId] ?? 0) * WORLD_PIXELS_PER_CELL,
            0.62 * WORLD_PIXELS_PER_CELL,
          )
          .stroke({ color: 0xc9ed8d, width: 0.9, alpha: 0.9 });
      }
    }
    if (this.selectedTarget?.kind === 'entity' && this.snapshot && this.map) {
      const targetCell = this.snapshot.targetCells[this.selectedTarget.id];
      const point = this.targetPosition(this.selectedTarget);
      if (point && targetCell !== undefined && targetCell !== 0xffff_ffff) {
        this.interactionLayer
          .moveTo(point.x * WORLD_PIXELS_PER_CELL, point.z * WORLD_PIXELS_PER_CELL)
          .lineTo(
            ((targetCell % this.map.size) + 0.5) * WORLD_PIXELS_PER_CELL,
            (Math.floor(targetCell / this.map.size) + 0.5) * WORLD_PIXELS_PER_CELL,
          )
          .stroke({ color: 0xffd86a, width: 0.7, alpha: 0.5 });
      }
    }
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
    if (target.kind === 'kingdom') {
      const kingdom = this.snapshot?.kingdoms.find((candidate) => candidate.id === target.id);
      const capital = kingdom
        ? this.snapshot?.villages.find((village) => village.id === kingdom.capitalVillageId)
        : undefined;
      return capital
        ? {
            x: capital.x,
            z: capital.z,
            geometry: {
              shape: 'circle',
              offsetX: 0,
              offsetZ: 0,
              radiusX: 5,
              radiusZ: 5,
            },
          }
        : null;
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
    const visibleSpan = visibleCellSpan(scale, this.camera);
    this.canvas.dataset.visibleCellsWidth = visibleSpan.width.toFixed(1);
    this.canvas.dataset.visibleCellsHeight = visibleSpan.height.toFixed(1);
    this.updateTerrainLod();
    this.redrawTreeCanopies();
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
      const mask = lodMask(this.viewLevel);
      if ((record.dirtyLodMask & mask) !== 0) {
        this.drawTerrainChunk(record, this.viewLevel);
        record.dirtyLodMask &= ~mask;
      }
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
    this.setViewLevel(resolveViewLevel(this.viewLevel, this.camera.zoom, this.camera));
    if (raw >= 1) this.cameraTween = null;
  }

  private setViewLevel(level: WorldViewLevel): void {
    if (this.viewLevel === level && this.canvas.dataset.viewLevel) return;
    this.viewLevel = level;
    const visualProfile = VISUAL_LOD_PROFILES[level];
    this.canvas.dataset.viewLevel = level;
    this.canvas.dataset.strategicEntities = 'false';
    this.canvas.dataset.fullBodyResidents = String(level === 'resident');
    this.canvas.dataset.entityLod = visualProfile.entityMode;
    this.canvas.dataset.resourceLod = visualProfile.resourceMode;
    this.canvas.dataset.buildingLod = visualProfile.buildingMode;
    this.treeCanopyCameraKey = '';
    this.updateTerrainLod();
    this.updateBuildings();
    this.redrawSettlementCores();
    this.redrawOutdoorStockpiles();
    this.redrawCarcasses();
    this.redrawBuildingStatus();
    this.updateWorkHotspots();
    this.updateSettlementLabelPositions();
    this.redrawTreeCanopies(true);
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
    if (this.viewLevel !== 'world') {
      const centeredBuilding = this.snapshot?.buildings.find(
        (building) =>
          building.health > 0 && Math.hypot(building.x - world.x, building.z - world.z) < 0.72,
      );
      if (centeredBuilding) {
        click.buildingId = centeredBuilding.id;
        click.villageId = centeredBuilding.villageId;
        return click;
      }
    }
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
    if (this.overlay === 'territory') {
      const villageId = this.territoryVillageIds?.[click.cell] ?? 0;
      const kingdomId = this.snapshot?.villages.find(
        (village) => village.id === villageId,
      )?.kingdomId;
      if (kingdomId && kingdomId > 0) {
        click.kingdomId = kingdomId;
        return click;
      }
    }
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
    else if (click?.kingdomId !== undefined) target = { kind: 'kingdom', id: click.kingdomId };
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
    this.setViewLevel(resolveViewLevel(this.viewLevel, this.camera.zoom, this.camera));
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
    const previousKind = this.hoveredTarget?.kind;
    this.hoveredTarget = target;
    if (target) this.canvas.dataset.hoverTarget = `${target.kind}:${target.id}`;
    else delete this.canvas.dataset.hoverTarget;
    this.redrawInteraction();
    if (
      this.ready &&
      this.overlay === 'territory' &&
      (previousKind === 'kingdom' || target?.kind === 'kingdom')
    ) {
      this.updateTerritories();
    }
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
    let visibleTerrainChunks = 0;
    for (const chunk of this.terrainChunks.values()) {
      const screen = worldToScreen(this.camera, chunk.x, chunk.z);
      const screenSize = RENDER_CHUNK_SIZE * WORLD_PIXELS_PER_CELL * this.camera.zoom;
      if (
        screen.x + screenSize >= 0 &&
        screen.x <= this.camera.viewportWidth &&
        screen.y + screenSize >= 0 &&
        screen.y <= this.camera.viewportHeight
      ) {
        visibleTerrainChunks += 1;
      }
    }
    const estimatedBatches = estimateRenderBatches({
      visibleTerrainChunks,
      visibleEntities: this.visibleEntities,
      visibleBuildings: this.buildingSprites.size,
      treeCanopyVisible: this.visibleTreeCanopies > 0,
      territoryVisible: this.territoryLayer.context.instructions.length > 0,
      statusVisible: this.statusLayer.context.instructions.length > 0,
      visibleLabels,
    });
    const latest = this.interpolator.latest;
    const metrics: RuntimeMetrics = {
      fps: normalizedDisplayFps(average),
      frameP95Ms: p95,
      drawCalls: estimatedBatches,
      triangles:
        (this.terrainChunks.size +
          this.visibleEntities +
          this.buildingSprites.size +
          this.visibleTreeCanopies * 6 +
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
    this.canvas.dataset.animalStyle = 'formal-pixel-side-profiles';
    this.canvas.dataset.animalStyles = '7';
    this.canvas.dataset.kingdomPalette = 'residents-buildings-flags';
    this.canvas.dataset.buildingStyle = 'formal-functional-pixel-buildings';
    this.canvas.dataset.buildingProfiles = String(Object.keys(BUILDING_VISUAL_PROFILES).length);
    this.canvas.dataset.visualRollout = 'formal-full-world';
    this.canvas.dataset.formalAssetSample = 'resident-deer-wolf-tree-home-storage';
    this.canvas.dataset.residentAssetSize = `${FORMAL_PIXEL_ASSETS.resident.width}x${FORMAL_PIXEL_ASSETS.resident.height}`;
    this.canvas.dataset.animalAssetSize = `${FORMAL_PIXEL_ASSETS.animal.width}x${FORMAL_PIXEL_ASSETS.animal.height}`;
    this.canvas.dataset.treeAssetSize = `${FORMAL_PIXEL_ASSETS.tree.width}x${FORMAL_PIXEL_ASSETS.tree.height}`;
    this.canvas.dataset.buildingAssetSize = `${FORMAL_PIXEL_ASSETS.building.width}x${FORMAL_PIXEL_ASSETS.building.height}`;
    this.canvas.dataset.terrainLayers = 'terrain-height-temperature-moisture-surface';
    this.canvas.dataset.lodResourceModes = 'cluster-simplified-detailed';
    this.canvas.dataset.viewLevels = 'world-settlement-resident';
    this.canvas.dataset.viewLevel = 'world';
    this.canvas.dataset.entityLod = VISUAL_LOD_PROFILES.world.entityMode;
    this.canvas.dataset.resourceLod = VISUAL_LOD_PROFILES.world.resourceMode;
    this.canvas.dataset.buildingLod = VISUAL_LOD_PROFILES.world.buildingMode;
    this.canvas.dataset.fullRebuilds = '0';
    this.canvas.dataset.attackHits = '0';
    this.canvas.dataset.noTilt = 'true';
    this.canvas.dataset.noRotation = 'true';
  }
}

function kingdomColor(kingdomId: number): string {
  return KINGDOM_COLORS[kingdomPaletteIndex(kingdomId)] ?? '#d6c195';
}

function kingdomPaletteIndex(kingdomId: number): number {
  if (kingdomId <= 0) return 0;
  return ((kingdomId - 1) % (KINGDOM_COLORS.length - 1)) + 1;
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
  splitCanopy = false,
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
    if (splitCanopy) {
      context.fillStyle = '#4c3425';
      context.fillRect(x - 1, groundY, 3, 1);
      return;
    }
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
  const terrain = map.terrain[cell] as TerrainType;
  const elevation = map.height[cell] ?? 0;
  const moisture = map.moisture[cell] ?? 128;
  let base = TERRAIN_COLORS[terrain] ?? '#78a461';
  if (terrain === TerrainType.Mountain) {
    base = elevation >= 6.2 ? '#aeb7b0' : elevation >= 4.8 ? '#858c84' : '#737b72';
  } else if (terrain === TerrainType.Snow && elevation >= 5.5) {
    base = '#edf2ec';
  } else if (terrain === TerrainType.Grass && moisture > 175) {
    base = '#6d9b61';
  } else if (terrain === TerrainType.Desert && moisture < 60) {
    base = '#c79a61';
  }
  const variationStrength =
    terrain === TerrainType.DeepOcean || terrain === TerrainType.ShallowOcean ? 0.006 : 0.012;
  return shade(base, 1 + variation * variationStrength);
}

function drawTerrainDetail(
  context: CanvasRenderingContext2D,
  map: WorldMapSnapshot,
  cell: number,
  terrain: TerrainType,
  localX: number,
  localZ: number,
  detail: 'districts' | 'resident',
): void {
  const px = localX * SOURCE_PIXELS_PER_CELL;
  const py = localZ * SOURCE_PIXELS_PER_CELL;
  const hash = (cell * 1103515245 + 12345) >>> 0;
  if (terrain === TerrainType.DeepOcean && hash % 29 === 0) {
    context.fillStyle = '#347187';
    context.fillRect(px, py + 2, detail === 'resident' ? 3 : 2, 1);
  } else if (terrain === TerrainType.ShallowOcean && hash % 17 === 0) {
    context.fillStyle = '#70aeb6';
    context.fillRect(px + 1, py + 1, 3, 1);
  } else if (terrain === TerrainType.Beach && hash % 11 === 0) {
    context.fillStyle = '#eee0ae';
    context.fillRect(px, py, 2, 1);
  } else if (terrain === TerrainType.Forest && detail === 'resident' && hash % 9 === 0) {
    context.fillStyle = '#3f6e49';
    context.fillRect(px + 1, py + 1, 1, 1);
    context.fillStyle = '#6b9158';
    context.fillRect(px + 3, py + 2, 1, 1);
  } else if (terrain === TerrainType.Mountain) {
    const elevation = map.height[cell] ?? 0;
    context.fillStyle = elevation >= 6.2 ? '#eef2ec' : '#9ca49d';
    context.fillRect(px + 1, py, 2, 1);
    if (detail === 'resident') {
      context.fillStyle = '#616a63';
      context.fillRect(px + 2, py + 1, 1, 3);
    }
  } else if (terrain === TerrainType.Snow && detail === 'resident' && hash % 13 === 0) {
    context.fillStyle = '#f7faf7';
    context.fillRect(px + 1, py + 1, 2, 1);
  }
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
    if (residentHandItem(profession, weaponTier) === 'none') return;
    context.fillStyle = weaponTier >= 2 ? '#e4e8e8' : '#9da8a9';
    context.fillRect(21, 10, 1, 13);
    context.fillRect(19, 10, 4, 2);
    context.fillStyle = '#6b4d33';
    context.fillRect(3, 15, 2, 8);
    return;
  }
  const toolColor = profession === Profession.Farmer ? '#b69c4d' : '#879297';
  context.fillStyle = '#67492f';
  context.fillRect(21, 13, 2, 13);
  context.fillStyle = toolColor;
  if (profession === Profession.Builder || profession === Profession.Blacksmith) {
    context.fillRect(18, 12, 6, 3);
  } else if (profession === Profession.Miner) {
    context.fillRect(18, 12, 6, 2);
    context.fillRect(18, 14, 2, 3);
  } else if (profession === Profession.Woodcutter) {
    context.fillRect(18, 12, 5, 5);
  } else if (profession === Profession.Farmer) {
    context.fillRect(18, 12, 6, 2);
    context.fillRect(18, 10, 2, 5);
  } else if (profession === Profession.Hauler) {
    context.fillStyle = '#9a6a3d';
    context.fillRect(18, 16, 6, 7);
  }
}

function drawCarriedResource(context: CanvasRenderingContext2D, kind: CarriedResourceKind): void {
  if (kind === CarriedResourceKind.None) return;
  context.fillStyle = 'rgba(29, 25, 20, 0.4)';
  context.fillRect(1, 17, 8, 10);
  context.fillStyle = carriedResourceColor(kind);
  if (kind === CarriedResourceKind.Wood) {
    context.fillRect(1, 18, 8, 3);
    context.fillRect(1, 23, 8, 3);
  } else {
    context.fillRect(2, 18, 7, 8);
  }
}

function drawRole(context: CanvasRenderingContext2D, role: ResidentRole): void {
  if (role === ResidentRole.King || role === ResidentRole.Leader) {
    context.fillStyle = role === ResidentRole.King ? '#f4cd4f' : '#c6d1d6';
    context.fillRect(7, 0, 10, 2);
    context.fillRect(7, 0, 2, 3);
    context.fillRect(11, 0, 2, 3);
    context.fillRect(15, 0, 2, 3);
  }
  if (role === ResidentRole.Captain) {
    context.fillStyle = '#f0d45f';
    context.fillRect(3, 1, 2, 11);
    context.fillStyle = '#df6458';
    context.fillRect(5, 1, 7, 5);
  }
  if (role === ResidentRole.Veteran || role === ResidentRole.Master) {
    context.fillStyle = role === ResidentRole.Veteran ? '#d9c45d' : '#bdd4df';
    context.fillRect(4, 13, 3, 3);
  }
}

function drawAnimal(
  context: CanvasRenderingContext2D,
  kind: EntityKind,
  variant: number,
  pose: AnimalPose,
  frame: number,
): void {
  const { colors, silhouette } = animalVisualProfile(kind);
  const [body, head, detail] = colors;
  const width = context.canvas.width;
  context.fillStyle = 'rgba(20, 31, 28, 0.22)';
  context.fillRect(3, 21, width - 6, 2);
  if (kind === EntityKind.Chicken) {
    context.fillStyle = body;
    context.fillRect(6, 11, 11, 9);
    context.fillRect(15, 8, 6, 8);
    context.fillStyle = head;
    context.fillRect(16, 5, 3, 4);
    context.fillStyle = detail;
    context.fillRect(21, 11, 3, 2);
    context.fillRect(8, 20, 2, 4);
    context.fillRect(15, 20, 2, 4);
    return;
  }
  if (kind === EntityKind.Fish) {
    context.fillStyle = body;
    context.fillRect(5, 10, 13, 8);
    context.fillStyle = head;
    context.fillRect(16, 11, 5, 6);
    context.fillStyle = detail;
    context.fillRect(1, 9, 5, 10);
    context.fillRect(20, 12, 1, 1);
    context.fillRect(10, 7, 5, 3);
    return;
  }
  const heavy = kind === EntityKind.Bear || kind === EntityKind.Cow;
  const bodyWidth = heavy ? width - 10 : width - 9;
  const bodyY = kind === EntityKind.Bear ? 8 : 10;
  const bodyHeight = kind === EntityKind.Bear ? 12 : kind === EntityKind.Sheep ? 10 : 9;
  context.fillStyle = body;
  context.fillRect(4, bodyY, bodyWidth, bodyHeight);
  if (silhouette === 'wool-cloud') {
    context.fillRect(2, 12, 5, 6);
    context.fillRect(8, 8, 6, 3);
    context.fillRect(14, 9, 5, 3);
  }
  if (kind === EntityKind.Cow && variant % 2 === 0) {
    context.fillStyle = head;
    context.fillRect(9, 12, 4, 4);
  }
  context.fillStyle = head;
  const headX = pose === 'attack' ? width - 7 : width - 8;
  const headY = pose === 'eat' ? 14 : kind === EntityKind.Bear ? 9 : 8;
  context.fillRect(headX, headY, 7, 7);
  context.fillStyle = detail;
  context.fillRect(width - 3, headY + 2, 1, 1);
  const walking = pose === 'walk' || pose === 'attack';
  context.fillRect(7, 18 + (walking && frame % 2 === 0 ? 1 : 0), 3, 6);
  context.fillRect(width - 11, 18 + (walking && frame % 2 === 1 ? 1 : 0), 3, 6);
  if (kind === EntityKind.Wolf) {
    context.fillRect(1, 8, 6, 2);
    context.fillRect(2, 6, 5, 2);
  } else if (kind === EntityKind.Deer) {
    context.fillRect(1, 11, 5, 3);
  } else if (kind !== EntityKind.Bear) {
    context.fillRect(1, 10, 4, 3);
  }
  if (kind === EntityKind.Deer) {
    context.fillRect(width - 7, 2, 1, 7);
    context.fillRect(width - 3, 2, 1, 7);
    context.fillRect(width - 9, 2, 3, 1);
    context.fillRect(width - 3, 2, 3, 1);
    context.fillRect(width - 8, 5, 2, 1);
    context.fillRect(width - 3, 5, 2, 1);
  }
  if (kind === EntityKind.Wolf) {
    context.fillRect(width - 8, 4, 3, 5);
    context.fillRect(width - 3, 4, 3, 5);
  }
  if (kind === EntityKind.Bear) {
    context.fillRect(width - 8, 5, 3, 4);
    context.fillRect(width - 3, 5, 3, 4);
  }
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  type: BuildingType,
  kingdom: string,
  tier: VillageTier,
  stage: number,
  damaged: boolean,
): void {
  const profile = BUILDING_VISUAL_PROFILES[type];
  context.fillStyle = 'rgba(22, 31, 26, 0.25)';
  context.fillRect(5, 42, 38, 4);
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
  const wallColor = ['#89643f', '#c8a06c', '#bbb4a2', '#d7d3c5'][tier] ?? '#89643f';
  context.fillStyle = tier >= VillageTier.Town ? '#69645c' : '#79624a';
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
    if (profile.silhouette === 'south-gable-home') {
      context.fillStyle = wallColor;
      context.fillRect(11, 22, 26, 18);
      context.fillStyle = kingdom;
      context.fillRect(8, 18, 32, 6);
      context.fillRect(12, 14, 24, 5);
      context.fillRect(17, 10, 14, 5);
      context.fillStyle = shade(kingdom, 1.18);
      context.fillRect(11, 18, 13, 2);
      context.fillStyle = '#5c4433';
      context.fillRect(21, 30, 7, 10);
      context.fillStyle = '#f2cf73';
      context.fillRect(14, 28, 4, 4);
    } else if (profile.silhouette === 'raised-granary') {
      context.fillStyle = wallColor;
      context.fillRect(8, 20, 32, 18);
      context.fillStyle = kingdom;
      context.fillRect(5, 14, 38, 8);
      context.fillStyle = shade(kingdom, 1.16);
      context.fillRect(9, 15, 30, 2);
      context.fillStyle = '#5a4433';
      context.fillRect(11, 25, 26, 3);
      context.fillRect(11, 31, 26, 3);
      context.fillRect(13, 38, 4, 4);
      context.fillRect(31, 38, 4, 4);
    } else if (profile.silhouette === 'chimney-workshop') {
      context.fillStyle = wallColor;
      context.fillRect(9, 21, 30, 19);
      context.fillStyle = kingdom;
      context.fillRect(6, 15, 36, 8);
      context.fillStyle = '#6c5b51';
      context.fillRect(33, 5, 6, 17);
      context.fillStyle = '#bac2bd';
      context.fillRect(34, 2, 4, 4);
      context.fillStyle = '#d69b4f';
      context.fillRect(13, 27, 8, 6);
      context.fillStyle = '#5c4433';
      context.fillRect(25, 29, 8, 11);
    } else if (profile.silhouette === 'banner-longhouse') {
      context.fillStyle = wallColor;
      context.fillRect(6, 21, 36, 19);
      context.fillStyle = kingdom;
      context.fillRect(3, 14, 42, 9);
      context.fillStyle = shade(kingdom, 0.72);
      context.fillRect(8, 21, 32, 3);
      context.fillStyle = '#5c4433';
      context.fillRect(20, 29, 8, 11);
      context.fillStyle = '#f2d25e';
      context.fillRect(5, 5, 2, 16);
      context.fillStyle = kingdom;
      context.fillRect(7, 5, 10, 6);
    } else if (profile.silhouette === 'civic-hall-columns') {
      context.fillStyle = wallColor;
      context.fillRect(5, 20, 38, 20);
      context.fillStyle = kingdom;
      context.fillRect(3, 13, 42, 9);
      context.fillStyle = shade(kingdom, 1.18);
      for (const x of [10, 18, 28, 36]) context.fillRect(x, 23, 3, 17);
      context.fillStyle = '#5c4433';
      context.fillRect(21, 29, 7, 11);
      context.fillStyle = '#f0d36b';
      context.fillRect(22, 5, 4, 9);
    } else {
      context.fillStyle = wallColor;
      context.fillRect(5, 19, 38, 21);
      context.fillStyle = kingdom;
      context.fillRect(3, 12, 42, 9);
      context.fillStyle = shade(kingdom, 0.72);
      context.fillRect(8, 19, 32, 3);
      context.fillStyle = '#5c4433';
      context.fillRect(20, 29, 8, 11);
      context.fillStyle = '#f0d36b';
      context.fillRect(22, 4, 4, 9);
      context.fillStyle = '#6a4f38';
      context.fillRect(8, 7, 4, 7);
      context.fillStyle = '#e9dfb4';
      context.fillRect(9, 8, 2, 2);
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
