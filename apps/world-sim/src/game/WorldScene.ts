import * as Phaser from 'phaser';
import { type SimCommand, SimLoop, SimWorld, type TerrainType, type WorldProjection } from '../sim';
import {
  type CameraDetailLevel,
  centerCameraView,
  clampCameraCenter,
  getAnchoredZoomCenter,
  getCameraDetailLevel,
  getCameraViewportFromCenter,
  getContainZoom,
  getCoverZoom,
  getViewportRelativePanSpeed,
  stepCameraMotion,
} from './cameraMath';
import {
  buildConflictSummaryLines,
  buildInspectionLines,
  buildKingdomOverviewLines,
  buildMapLabels,
  buildTerritoryBorderSegments,
  filterEventsForSelection,
  formatEventSummary,
  selectNextKingdom,
  selectWorldEntity,
  type WorldSelection,
} from './inspection';
import { resolveDemoWorldSeed } from './worldSeed';

const TILE_SIZE = 10;
const DEMO_WORLD_WIDTH = 256;
const DEMO_WORLD_HEIGHT = 256;
const DEMO_INITIAL_UNITS = 48;
const INITIAL_CAMERA_ZOOM = 0.72;
const MAX_CAMERA_ZOOM = 3;
const CAMERA_KEYBOARD_VIEWPORTS_PER_SECOND = 1.55;
const CAMERA_ACCELERATION = 82;
const CAMERA_DECELERATION = 56;
const CAMERA_MAX_DELTA_SECONDS = 1 / 30;
const CAMERA_VIEWPORT_PADDING_TILES = 18;
const STATIC_VIEWPORT_REDRAW_TILE_STEP = 16;
const STATIC_LAYER_REDRAW_TICK_STEP = 60;
const HUD_REDRAW_INTERVAL_MS = 250;
const CAMERA_KEY_ZOOM_PER_SECOND = 2.1;
const CAMERA_WHEEL_ZOOM_IN = 1.16;
const CAMERA_WHEEL_ZOOM_OUT = 1 / CAMERA_WHEEL_ZOOM_IN;
const PANEL_COLOR = 0x101726;
const PANEL_STROKE = 0x4052a1;
const TEXT_COLOR = '#f4f4f4';
const UI_MARGIN = 12;
const TITLE_PANEL_HEIGHT = 38;
const BOTTOM_PANEL_HEIGHT = 54;
const STATUS_PANEL_TOP = 54;
const EVENTS_PANEL_TOP = 54;
const COMPACT_STATUS_PANEL_HEIGHT = 118;
const COMPACT_EVENTS_PANEL_HEIGHT = 118;
const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x38b764,
  forest: 0x257179,
  hill: 0x566c86,
  water: 0x29366f,
  sand: 0xffcd75,
  snow: 0xf4f4f4,
  lava: 0xef7d57,
};

const INTENT_COLORS = {
  idle: 0xf4f4f4,
  seek_food: 0xffcd75,
  eat: 0x99e550,
  wander: 0x94b0c2,
  dead: 0x333c57,
} as const;

const BUILDING_COLORS = {
  town_hall: 0xf4f4f4,
  house: 0xc2c3c7,
  storage: 0xffcd75,
  farm: 0xd6b45f,
  mine: 0x566c86,
  barrack: 0xef7d57,
  dock: 0x29adff,
} as const;

const ARMY_STATUS_COLORS = {
  marching: 0xef7d57,
  fighting: 0xffcd75,
  retreating: 0x94b0c2,
  disbanded: 0x566c86,
} as const;

const CAMERA_CONTROL_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
  'q',
  'e',
  '+',
  '=',
  '-',
  '_',
]);

export class WorldScene extends Phaser.Scene {
  private world!: SimWorld;
  private loop!: SimLoop;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private territoryLayer?: Phaser.GameObjects.Graphics;
  private unitLayer?: Phaser.GameObjects.Graphics;
  private armyLayer?: Phaser.GameObjects.Graphics;
  private armyRouteLayer?: Phaser.GameObjects.Graphics;
  private buildingLayer?: Phaser.GameObjects.Graphics;
  private resourceLayer?: Phaser.GameObjects.Graphics;
  private workSiteLayer?: Phaser.GameObjects.Graphics;
  private selectionLayer?: Phaser.GameObjects.Graphics;
  private uiLayer?: Phaser.GameObjects.Graphics;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private titleText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private controlsText?: Phaser.GameObjects.Text;
  private eventsText?: Phaser.GameObjects.Text;
  private mapLabelTexts: Phaser.GameObjects.Text[] = [];
  private commandSequence = 1;
  private lastTerrainDrawKey = '';
  private lastResourceDrawKey = '';
  private lastTerritoryDrawKey = '';
  private lastBuildingDrawKey = '';
  private lastArmyRouteDrawKey = '';
  private lastMapLabelsDrawKey = '';
  private lastHudDrawKey = '';
  private lastHudDrawAtMs = -Infinity;
  private selection: WorldSelection = { type: 'none' };
  private cameraInitialized = false;
  private lastCameraWidth = 0;
  private lastCameraHeight = 0;
  private cameraVelocityX = 0;
  private cameraVelocityY = 0;
  private readonly pressedKeys = new Set<string>();

  constructor() {
    super('world');
  }

  create() {
    this.world = new SimWorld({
      seed: resolveDemoWorldSeed(window.location.search),
      width: DEMO_WORLD_WIDTH,
      height: DEMO_WORLD_HEIGHT,
      initialUnits: DEMO_INITIAL_UNITS,
    });
    this.loop = new SimLoop(this.world);

    this.configureMainCamera();
    this.cameras.main.setZoom(
      Phaser.Math.Clamp(this.getDefaultCameraZoom(), this.getMinimumCameraZoom(), MAX_CAMERA_ZOOM),
    );
    this.centerMainCamera();

    this.terrainLayer = this.add.graphics();
    this.territoryLayer = this.add.graphics();
    this.resourceLayer = this.add.graphics();
    this.workSiteLayer = this.add.graphics();
    this.buildingLayer = this.add.graphics();
    this.armyRouteLayer = this.add.graphics();
    this.armyLayer = this.add.graphics();
    this.unitLayer = this.add.graphics();
    this.selectionLayer = this.add.graphics();
    this.uiLayer = this.add.graphics();
    this.uiLayer.setScrollFactor(0);
    this.uiLayer.setDepth(20);
    this.titleText = this.createUiText(18, 14, 18);
    this.statusText = this.createUiText(18, 70, 13);
    this.controlsText = this.createUiText(18, 0, 13);
    this.eventsText = this.createUiText(0, 70, 12);
    this.setupUiCamera();
    this.focusGameCanvas();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.renderProjection(this.projectVisibleWorld(), 0);
  }

  update(time: number, delta: number) {
    this.ensureMainCameraInitialized();
    this.updateCameraControls(delta);
    this.loop.advance(delta);
    this.renderProjection(this.projectVisibleWorld(), time);
  }

  private shutdown() {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.clearMapLabels();
  }

  private renderProjection(projection: WorldProjection, timeMs: number) {
    const detailLevel = this.getRenderDetailLevel();
    const terrainDrawKey = this.getTerrainDrawKey(projection);
    const resourceDrawKey = this.getResourceDrawKey(projection, detailLevel);
    const territoryDrawKey = this.getTerritoryDrawKey(projection);
    const buildingDrawKey = this.getBuildingDrawKey(projection, detailLevel);
    const armyRouteDrawKey = this.getArmyRouteDrawKey(projection);
    const mapLabelsDrawKey = this.getMapLabelsDrawKey(projection, detailLevel);
    if (terrainDrawKey !== this.lastTerrainDrawKey) {
      this.drawTerrain(projection);
      this.lastTerrainDrawKey = terrainDrawKey;
    }

    if (territoryDrawKey !== this.lastTerritoryDrawKey) {
      this.drawTerritory(projection);
      this.lastTerritoryDrawKey = territoryDrawKey;
    }

    if (resourceDrawKey !== this.lastResourceDrawKey) {
      this.drawResources(projection, detailLevel);
      this.lastResourceDrawKey = resourceDrawKey;
    }

    this.drawWorkSites(projection, detailLevel);

    if (buildingDrawKey !== this.lastBuildingDrawKey) {
      this.drawBuildings(projection, detailLevel);
      this.lastBuildingDrawKey = buildingDrawKey;
    }

    if (armyRouteDrawKey !== this.lastArmyRouteDrawKey) {
      this.drawArmyRoutes(projection);
      this.lastArmyRouteDrawKey = armyRouteDrawKey;
    }

    this.drawArmies(projection, detailLevel);
    this.drawUnits(projection, detailLevel);
    this.drawSelection(projection);

    if (mapLabelsDrawKey !== this.lastMapLabelsDrawKey) {
      this.drawMapLabels(projection);
      this.lastMapLabelsDrawKey = mapLabelsDrawKey;
    }

    const hudDrawKey = this.getHudDrawKey(projection);

    if (
      hudDrawKey !== this.lastHudDrawKey ||
      timeMs - this.lastHudDrawAtMs >= HUD_REDRAW_INTERVAL_MS
    ) {
      this.drawHud(projection);
      this.lastHudDrawKey = hudDrawKey;
      this.lastHudDrawAtMs = timeMs;
    }
  }

  private drawTerrain(projection: WorldProjection) {
    if (!this.terrainLayer) {
      return;
    }

    this.terrainLayer.clear();

    for (const tile of projection.tiles) {
      this.terrainLayer.fillStyle(TERRAIN_COLORS[tile.terrain], 0.94);
      this.terrainLayer.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private drawResources(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    if (!this.resourceLayer) {
      return;
    }

    this.resourceLayer.clear();

    if (detailLevel !== 'local') {
      return;
    }

    for (const tile of projection.tiles) {
      if (!tile.resource || tile.resource.amount <= 0) {
        continue;
      }

      const cx = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = tile.y * TILE_SIZE + TILE_SIZE / 2;

      if (tile.resource.type === 'food') {
        this.resourceLayer.fillStyle(0xffcd75, 0.95);
        this.resourceLayer.fillCircle(cx, cy, 2);
        continue;
      }

      if (tile.resource.type === 'wood') {
        this.resourceLayer.fillStyle(0x4d8b43, 0.95);
        this.resourceLayer.fillTriangle(cx, cy - 3, cx - 3, cy + 2, cx + 3, cy + 2);
        this.resourceLayer.fillStyle(0x8b5a2b, 0.95);
        this.resourceLayer.fillRect(cx - 0.75, cy + 1.5, 1.5, 3);
        continue;
      }

      if (tile.resource.type === 'stone') {
        this.resourceLayer.fillStyle(0xa7b0b7, 0.95);
        this.resourceLayer.fillTriangle(cx - 3, cy + 2, cx, cy - 3, cx + 3, cy + 2);
        this.resourceLayer.fillTriangle(cx - 2, cy - 1, cx + 2, cy - 1, cx, cy + 3);
        this.resourceLayer.fillStyle(0x566c86, 0.95);
        this.resourceLayer.fillRect(cx - 1.5, cy + 0.5, 3, 2);
        continue;
      }

      if (tile.resource.type === 'iron') {
        this.resourceLayer.fillStyle(0xc5c8cf, 0.95);
        this.resourceLayer.fillCircle(cx, cy, 2.5);
        this.resourceLayer.fillStyle(0x29366f, 0.95);
        this.resourceLayer.fillCircle(cx - 1, cy - 0.5, 0.8);
        this.resourceLayer.fillCircle(cx + 1, cy + 0.4, 0.8);
      }
    }
  }

  private drawTerritory(projection: WorldProjection) {
    if (!this.territoryLayer) {
      return;
    }

    const kingdomsById = new Map(projection.kingdoms.map((kingdom) => [kingdom.id, kingdom]));

    this.territoryLayer.clear();

    for (const tile of projection.territory) {
      const kingdom = tile.kingdomId ? kingdomsById.get(tile.kingdomId) : undefined;
      const color = kingdom?.color ?? 0xffffff;
      const selected =
        this.selection.type === 'village'
          ? tile.villageId === this.selection.id
          : this.selection.type === 'kingdom'
            ? tile.kingdomId === this.selection.id
            : false;
      const alpha =
        tile.surface === 'water'
          ? selected
            ? 0.22
            : sourceAlpha(tile.source, kingdom ? 0.13 : 0.05)
          : selected
            ? 0.34
            : sourceAlpha(tile.source, kingdom ? 0.22 : 0.08);

      this.territoryLayer.fillStyle(color, alpha);
      this.territoryLayer.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    const borderSegments = buildTerritoryBorderSegments(projection, this.selection);

    for (const segment of borderSegments) {
      this.territoryLayer.lineStyle(
        segment.width,
        segment.selected ? 0xf4f4f4 : segment.color,
        segment.alpha,
      );
      this.territoryLayer.beginPath();
      this.territoryLayer.moveTo(segment.x1 * TILE_SIZE, segment.y1 * TILE_SIZE);
      this.territoryLayer.lineTo(segment.x2 * TILE_SIZE, segment.y2 * TILE_SIZE);
      this.territoryLayer.strokePath();
    }
  }

  private drawUnits(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    if (!this.unitLayer) {
      return;
    }

    this.unitLayer.clear();

    if (detailLevel !== 'local') {
      return;
    }

    for (const unit of projection.units) {
      this.unitLayer.fillStyle(INTENT_COLORS[unit.intent], 1);
      this.unitLayer.fillRect(
        unit.position.x * TILE_SIZE - 2,
        unit.position.y * TILE_SIZE - 2,
        4,
        4,
      );
    }
  }

  private drawBuildings(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    if (!this.buildingLayer) {
      return;
    }

    this.buildingLayer.clear();

    if (detailLevel === 'overview') {
      return;
    }

    for (const field of projection.farmland) {
      const x = field.x * TILE_SIZE;
      const y = field.y * TILE_SIZE;

      this.buildingLayer.fillStyle(0x8fc65a, detailLevel === 'local' ? 0.46 : 0.32);
      this.buildingLayer.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

      if (detailLevel === 'local') {
        this.buildingLayer.lineStyle(0.8, 0xe4cf8a, 0.5);
        this.buildingLayer.lineBetween(
          x + 2,
          y + TILE_SIZE / 2,
          x + TILE_SIZE - 2,
          y + TILE_SIZE / 2,
        );
      }
    }

    for (const building of projection.buildings) {
      const color = BUILDING_COLORS[building.type];
      const x = building.position.x * TILE_SIZE;
      const y = building.position.y * TILE_SIZE;
      const isAbandoned = building.status === 'abandoned';
      const isRuined = building.status === 'ruined';
      const alpha =
        building.status === 'active'
          ? 0.95
          : building.status === 'constructing'
            ? 0.58
            : isAbandoned
              ? 0.38
              : 0.2;

      this.buildingLayer.fillStyle(color, alpha);

      if (building.type === 'farm') {
        this.buildingLayer.fillRect(x - 4, y - 5, 8, 10);
        this.buildingLayer.fillStyle(0xf4f4f4, alpha);
        this.buildingLayer.fillTriangle(x, y - 11, x - 6, y - 4, x + 6, y - 4);
        this.buildingLayer.lineStyle(1.4, 0x101726, 0.8);
        this.buildingLayer.strokeRect(x - 4, y - 5, 8, 10);
        this.buildingLayer.lineStyle(1.2, 0xf4f4f4, alpha * 0.9);
        this.buildingLayer.lineBetween(x - 7, y - 1, x + 7, y - 1);
        this.buildingLayer.lineBetween(x, y - 8, x, y + 6);
      } else if (building.type === 'mine') {
        this.buildingLayer.fillRect(x - 5, y - 5, 10, 10);
        this.buildingLayer.lineStyle(2, 0xffcd75, alpha);
        this.buildingLayer.strokeRect(x - 5, y - 5, 10, 10);
      } else if (building.type === 'barrack') {
        this.buildingLayer.fillRect(x - 6, y - 4, 12, 8);
        this.buildingLayer.lineStyle(2, 0x101726, 0.85);
        this.buildingLayer.strokeRect(x - 6, y - 4, 12, 8);
      } else if (building.type === 'dock') {
        this.buildingLayer.fillRect(x - 7, y - 3, 14, 6);
        this.buildingLayer.lineStyle(2, 0x101726, 0.85);
        this.buildingLayer.strokeRect(x - 7, y - 3, 14, 6);
      } else if (building.type === 'town_hall') {
        this.buildingLayer.fillRect(x - 6, y - 6, 12, 12);
        this.buildingLayer.lineStyle(2, 0x101726, 0.85);
        this.buildingLayer.strokeRect(x - 6, y - 6, 12, 12);
      } else if (building.type === 'house') {
        const size = building.tier === 3 ? 12 : building.tier === 2 ? 10 : 8;
        this.buildingLayer.fillRect(x - size / 2, y - size / 2, size, size);
        if ((building.tier ?? 1) > 1) {
          this.buildingLayer.lineStyle(1.5, 0x101726, 0.85);
          this.buildingLayer.strokeRect(x - size / 2, y - size / 2, size, size);
        }
      } else {
        this.buildingLayer.fillRect(x - 5, y - 5, 10, 10);
      }

      if (isAbandoned || isRuined) {
        this.buildingLayer.lineStyle(1.5, isRuined ? 0x333c57 : color, isRuined ? 0.82 : 0.48);
        this.buildingLayer.strokeRect(x - 6, y - 6, 12, 12);
      }

      if (isRuined) {
        this.buildingLayer.lineStyle(2, 0x333c57, 0.88);
        this.buildingLayer.beginPath();
        this.buildingLayer.moveTo(x - 5, y - 5);
        this.buildingLayer.lineTo(x + 5, y + 5);
        this.buildingLayer.moveTo(x + 5, y - 5);
        this.buildingLayer.lineTo(x - 5, y + 5);
        this.buildingLayer.strokePath();
      }
    }
  }

  private drawWorkSites(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    if (!this.workSiteLayer) {
      return;
    }

    this.workSiteLayer.clear();

    if (detailLevel !== 'local') {
      return;
    }

    for (const site of projection.workSites) {
      const x = site.position.x * TILE_SIZE;
      const y = site.position.y * TILE_SIZE;
      const remainingTicks = Math.max(0, site.expiresAtTick - projection.tick);
      const pulse = 0.42 + 0.18 * Math.sin((projection.tick + site.position.x * 3) / 8);
      const alpha = Math.min(0.38, Math.max(0.06, (remainingTicks / 60) * pulse));

      if (site.type === 'wood_gathering') {
        this.workSiteLayer.lineStyle(0.8, 0x6abe30, alpha);
        this.workSiteLayer.strokeCircle(x, y, 4);
        this.workSiteLayer.fillStyle(0x8f563b, alpha * 0.45);
        this.workSiteLayer.fillRect(x - 1, y - 4, 2, 8);
        continue;
      }

      if (site.type === 'farm_tending') {
        this.workSiteLayer.lineStyle(0.8, 0xffcd75, alpha);
        this.workSiteLayer.strokeCircle(x, y, 4);
        this.workSiteLayer.fillStyle(0x99e550, alpha * 0.28);
        this.workSiteLayer.fillRect(x - 4, y - 1.5, 8, 3);
        continue;
      }

      if (site.type === 'construction') {
        this.workSiteLayer.lineStyle(1, 0xf4f4f4, alpha);
        this.workSiteLayer.strokeRect(x - 5, y - 5, 10, 10);
        this.workSiteLayer.fillStyle(0xf4f4f4, alpha * 0.28);
        this.workSiteLayer.fillTriangle(x, y - 4, x - 4, y + 3, x + 4, y + 3);
        continue;
      }

      this.workSiteLayer.lineStyle(0.8, 0x99e550, alpha);
      this.workSiteLayer.strokeCircle(x, y, 5);
    }
  }

  private drawArmies(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    if (!this.armyLayer) {
      return;
    }

    this.armyLayer.clear();
    const kingdomsById = new Map(projection.kingdoms.map((kingdom) => [kingdom.id, kingdom]));

    for (const army of projection.armies) {
      if (army.status === 'disbanded') {
        continue;
      }

      const x = army.position.x * TILE_SIZE;
      const y = army.position.y * TILE_SIZE;
      const radius = Math.min(9, Math.max(5, 3 + army.soldierCount / 4));
      const kingdom = kingdomsById.get(army.kingdomId);
      const fillColor = kingdom?.color ?? ARMY_STATUS_COLORS[army.status];
      const strokeColor = ARMY_STATUS_COLORS[army.status];

      this.armyLayer.fillStyle(fillColor, 0.94);
      this.armyLayer.fillTriangle(x, y - radius, x - radius, y + radius, x + radius, y + radius);
      this.armyLayer.lineStyle(2, strokeColor, 0.9);
      this.armyLayer.strokeTriangle(x, y - radius, x - radius, y + radius, x + radius, y + radius);
      this.armyLayer.lineStyle(1, 0x101726, 0.85);
      this.armyLayer.strokeTriangle(
        x,
        y - radius - 1,
        x - radius - 1,
        y + radius + 1,
        x + radius + 1,
        y + radius + 1,
      );
    }

    if (detailLevel !== 'local') {
      return;
    }

    for (const marker of projection.battleMarkers) {
      const kingdom = kingdomsById.get(marker.kingdomId);
      const x = marker.position.x * TILE_SIZE;
      const y = marker.position.y * TILE_SIZE;
      const fillColor = kingdom?.color ?? (marker.side === 'attacker' ? 0xef7d57 : 0x29adff);

      this.armyLayer.fillStyle(fillColor, marker.side === 'attacker' ? 0.92 : 0.78);
      this.armyLayer.fillCircle(x, y, marker.side === 'attacker' ? 2.3 : 2);
      this.armyLayer.lineStyle(1, marker.side === 'attacker' ? 0xffcd75 : 0xf4f4f4, 0.75);
      this.armyLayer.strokeCircle(x, y, marker.side === 'attacker' ? 2.8 : 2.5);
    }
  }

  private drawArmyRoutes(projection: WorldProjection) {
    if (!this.armyRouteLayer) {
      return;
    }

    this.armyRouteLayer.clear();

    for (const army of projection.armies) {
      if (army.status === 'disbanded') {
        continue;
      }

      const targetVillage = projection.villages.find(
        (village) => village.id === army.targetVillageId,
      );

      if (!targetVillage) {
        continue;
      }

      const selected =
        this.selection.type === 'army'
          ? this.selection.id === army.id
          : this.selection.type === 'kingdom'
            ? this.selection.id === army.kingdomId || this.selection.id === army.targetKingdomId
            : false;
      const routeColor = army.status === 'fighting' ? 0xffcd75 : 0xef7d57;

      this.armyRouteLayer.lineStyle(selected ? 2.5 : 1.5, routeColor, selected ? 0.9 : 0.46);
      this.armyRouteLayer.beginPath();
      this.armyRouteLayer.moveTo(army.position.x * TILE_SIZE, army.position.y * TILE_SIZE);
      this.armyRouteLayer.lineTo(
        targetVillage.center.x * TILE_SIZE,
        targetVillage.center.y * TILE_SIZE,
      );
      this.armyRouteLayer.strokePath();
      this.armyRouteLayer.fillStyle(routeColor, selected ? 0.85 : 0.52);
      this.armyRouteLayer.fillCircle(
        targetVillage.center.x * TILE_SIZE,
        targetVillage.center.y * TILE_SIZE,
        selected ? 5 : 3,
      );
    }
  }

  private drawSelection(projection: WorldProjection) {
    if (!this.selectionLayer) {
      return;
    }

    this.selectionLayer.clear();
    this.selectionLayer.lineStyle(2, 0xf4f4f4, 0.95);
    this.selectionLayer.fillStyle(0xffffff, 0.08);

    const selection = this.selection;

    switch (selection.type) {
      case 'none':
        return;
      case 'tile':
        this.selectionLayer.strokeRect(
          selection.x * TILE_SIZE,
          selection.y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
        return;
      case 'unit': {
        const unit = projection.units.find((candidate) => candidate.id === selection.id);

        if (!unit) {
          return;
        }

        this.selectionLayer.strokeCircle(
          unit.position.x * TILE_SIZE,
          unit.position.y * TILE_SIZE,
          7,
        );
        return;
      }
      case 'village': {
        const village = projection.villages.find((candidate) => candidate.id === selection.id);

        if (!village) {
          return;
        }

        this.selectionLayer.fillCircle(
          village.center.x * TILE_SIZE,
          village.center.y * TILE_SIZE,
          TILE_SIZE * 2.2,
        );
        this.selectionLayer.strokeCircle(
          village.center.x * TILE_SIZE,
          village.center.y * TILE_SIZE,
          TILE_SIZE * 7,
        );
        return;
      }
      case 'kingdom': {
        const kingdom = projection.kingdoms.find((candidate) => candidate.id === selection.id);
        const capital = projection.villages.find(
          (candidate) => candidate.id === kingdom?.capitalVillageId,
        );

        if (!kingdom || !capital) {
          return;
        }

        this.selectionLayer.lineStyle(3, kingdom.color, 0.95);
        this.selectionLayer.fillStyle(kingdom.color, 0.12);
        this.selectionLayer.fillCircle(
          capital.center.x * TILE_SIZE,
          capital.center.y * TILE_SIZE,
          TILE_SIZE * 3,
        );
        this.selectionLayer.strokeCircle(
          capital.center.x * TILE_SIZE,
          capital.center.y * TILE_SIZE,
          TILE_SIZE * 8,
        );
        return;
      }
      case 'building': {
        const building = projection.buildings.find((candidate) => candidate.id === selection.id);

        if (!building) {
          return;
        }

        this.selectionLayer.strokeRect(
          building.position.x * TILE_SIZE - 8,
          building.position.y * TILE_SIZE - 8,
          16,
          16,
        );
        return;
      }
      case 'army': {
        const army = projection.armies.find((candidate) => candidate.id === selection.id);

        if (!army) {
          return;
        }

        this.selectionLayer.strokeCircle(
          army.position.x * TILE_SIZE,
          army.position.y * TILE_SIZE,
          14,
        );
        return;
      }
    }
  }

  private drawMapLabels(projection: WorldProjection) {
    this.clearMapLabels();

    for (const label of buildMapLabels(projection)) {
      const x = Math.round(label.position.x * TILE_SIZE);
      const y = Math.round(label.position.y * TILE_SIZE);
      const text = this.add.text(x, y, label.text, {
        fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: label.color,
        backgroundColor: 'rgba(16, 23, 38, 0.72)',
        stroke: '#101726',
        strokeThickness: 2,
        resolution: 2,
      });
      text.setOrigin(0.5);
      text.setDepth(12);
      this.uiCamera?.ignore(text);
      this.mapLabelTexts.push(text);
    }
  }

  private clearMapLabels() {
    for (const label of this.mapLabelTexts) {
      label.destroy();
    }

    this.mapLabelTexts = [];
  }

  private drawHud(projection: WorldProjection) {
    this.layoutUiPanels();
    const activeKingdoms = projection.kingdoms
      .filter((kingdom) => kingdom.status !== 'fallen')
      .sort((a, b) => b.population - a.population);
    const leadingKingdom = activeKingdoms[0];
    const kingdomLines = buildKingdomOverviewLines(projection).slice(0, 2);
    const conflictLines = buildConflictSummaryLines(projection).slice(0, 2);

    this.titleText?.setText(
      `世界模拟器 · 人口 ${projection.stats.population} · 村庄 ${projection.stats.villages} · 王国 ${projection.stats.kingdoms}`,
    );
    this.statusText?.setText(
      this.selection.type === 'none'
        ? ''
        : [
            `第 ${projection.tick} 刻 · ${projection.paused ? '暂停' : `${projection.speed}x`}`,
            `领土 ${projection.stats.territoryTiles} · 建筑 ${projection.stats.activeBuildings}`,
            `库存 食物 ${Math.round(projection.stats.totalVillageFood)} / ${Math.round(
              projection.stats.totalVillageFoodCapacity,
            )} · 木石铁 ${Math.round(
              projection.stats.totalVillageWood,
            )}/${Math.round(projection.stats.totalVillageWoodCapacity)} ${Math.round(
              projection.stats.totalVillageStone,
            )}/${Math.round(projection.stats.totalVillageStoneCapacity)} ${Math.round(
              projection.stats.totalVillageIron,
            )}/${Math.round(projection.stats.totalVillageIronCapacity)}`,
            `最大王国 ${leadingKingdom ? `${leadingKingdom.population} 人` : '无'} · 陨落 ${
              projection.stats.fallenKingdoms
            }`,
            ...kingdomLines,
            ...conflictLines,
          ].join('\n'),
    );
    this.controlsText?.setText(
      [
        '操作',
        '左键：选择实体 / 地块',
        '按住控制键 + 左键：投放食物',
        '按住上档键 + 左键：召唤 4 个小人',
        '按住替代键 + 左键：闪电打击',
        'WASD / 方向键：移动镜头',
        '滚轮 / Q / +：放大，E / -：缩小',
        '1 / 2 / 4 键：调整速度',
        'K 键：循环选择王国',
        'H / J 键：让选中王国向压力目标开战 / 和平',
        '0 或 P 键：暂停 / 恢复',
        'F / G / V 键：将镜头中心改成森林 / 草地 / 水域',
      ].join('    '),
    );
    const storyEvents = filterEventsForSelection(projection, this.selection).slice(-5);
    const inspectionLines = buildInspectionLines(projection, this.selection);
    this.eventsText?.setText(
      this.selection.type === 'none'
        ? ''
        : [
            ...inspectionLines,
            '',
            this.selection.type === 'tile' ? '最近事件' : '相关事件',
            ...(storyEvents.length > 0
              ? storyEvents.map((event) => {
                  const summary = formatEventSummary(event);

                  return `第 ${event.tick} 刻：${summary || translateEvent(event.message)}`;
                })
              : ['暂无相关事件']),
          ].join('\n'),
    );
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    this.focusGameCanvas();
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const position = {
      x: Math.floor(worldPoint.x / TILE_SIZE),
      y: Math.floor(worldPoint.y / TILE_SIZE),
    };

    if (pointer.event.altKey) {
      this.issue({
        type: 'lightning',
        payload: { position, radius: 2, damage: 80 },
      });
      return;
    }

    if (pointer.event.shiftKey) {
      this.issue({
        type: 'spawn_unit',
        payload: { race: 'human', position, count: 4 },
      });
      return;
    }

    if (pointer.event.ctrlKey || pointer.event.metaKey) {
      this.issue({
        type: 'place_resource',
        payload: { resourceType: 'food', position, amount: 20, radius: 2 },
      });
      return;
    }

    this.selection = selectWorldEntity(this.projectVisibleWorld(), {
      x: worldPoint.x / TILE_SIZE,
      y: worldPoint.y / TILE_SIZE,
    });
  };

  private readonly handlePointerWheel = (
    pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ) => {
    if (pointer.event.ctrlKey || pointer.event.metaKey) {
      this.issueSpeedFromWheel(deltaY);
      return;
    }

    this.zoomCameraAt(
      pointer.x,
      pointer.y,
      deltaY > 0 ? CAMERA_WHEEL_ZOOM_OUT : CAMERA_WHEEL_ZOOM_IN,
    );
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.pressedKeys.add(key);

    if (CAMERA_CONTROL_KEYS.has(key)) {
      event.preventDefault();
    }

    if (key === '1' || key === '2' || key === '4') {
      this.issue({ type: 'set_speed', payload: { speed: Number(key) as 1 | 2 | 4 } });
      return;
    }

    if (key === '0' || key === 'p') {
      const projection = this.world.project();
      this.issue({ type: 'pause', payload: { paused: !projection.paused } });
      return;
    }

    if (key === 'k') {
      this.selection = selectNextKingdom(this.projectVisibleWorld(), this.selection);
      return;
    }

    if (key === 'h' || key === 'j') {
      this.issueSelectedDiplomacyCommand(key === 'h' ? 'force_war' : 'force_peace');
      return;
    }

    const center = this.cameras.main.midPoint;
    const position = {
      x: Math.floor(center.x / TILE_SIZE),
      y: Math.floor(center.y / TILE_SIZE),
    };

    if (key === 'f' || key === 'g' || key === 'v') {
      this.issue({
        type: 'change_terrain',
        payload: {
          terrain: key === 'f' ? 'forest' : key === 'v' ? 'water' : 'grass',
          position,
          radius: 4,
        },
      });
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  private focusGameCanvas() {
    const canvas = this.game.canvas;

    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
  }

  private updateCameraControls(deltaMs: number) {
    const deltaSeconds = Math.min(deltaMs / 1000, CAMERA_MAX_DELTA_SECONDS);
    const camera = this.cameras.main;
    const keyboardMove = this.getKeyboardCameraDirection();
    const viewportWidth = camera.width / camera.zoom;
    const viewportHeight = camera.height / camera.zoom;
    const speed = getViewportRelativePanSpeed({
      viewportWidth,
      viewportHeight,
      viewportFractionPerSecond: CAMERA_KEYBOARD_VIEWPORTS_PER_SECOND,
    });
    const nextMotion = stepCameraMotion(
      { velocityX: this.cameraVelocityX, velocityY: this.cameraVelocityY },
      {
        directionX: keyboardMove.x,
        directionY: keyboardMove.y,
        speed,
        deltaSeconds,
        acceleration: CAMERA_ACCELERATION,
        deceleration: CAMERA_DECELERATION,
      },
    );

    this.cameraVelocityX = nextMotion.velocityX;
    this.cameraVelocityY = nextMotion.velocityY;

    if (this.cameraVelocityX !== 0 || this.cameraVelocityY !== 0) {
      const attemptedCenterX = camera.midPoint.x + this.cameraVelocityX * deltaSeconds;
      const attemptedCenterY = camera.midPoint.y + this.cameraVelocityY * deltaSeconds;
      const clampedCenter = this.setMainCameraCenter(attemptedCenterX, attemptedCenterY);

      if (Math.abs(clampedCenter.centerX - attemptedCenterX) > 0.001) {
        this.cameraVelocityX = 0;
      }

      if (Math.abs(clampedCenter.centerY - attemptedCenterY) > 0.001) {
        this.cameraVelocityY = 0;
      }
    }

    const zoomDirection =
      (this.pressedKeys.has('q') || this.pressedKeys.has('+') || this.pressedKeys.has('=')
        ? 1
        : 0) -
      (this.pressedKeys.has('e') || this.pressedKeys.has('-') || this.pressedKeys.has('_') ? 1 : 0);

    if (zoomDirection !== 0) {
      const multiplier = Math.exp(CAMERA_KEY_ZOOM_PER_SECOND * zoomDirection * deltaSeconds);
      this.zoomCameraAt(camera.width / 2, camera.height / 2, multiplier);
    }
  }

  private getKeyboardCameraDirection() {
    return {
      x:
        (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright') ? 1 : 0) -
        (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft') ? 1 : 0),
      y:
        (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown') ? 1 : 0) -
        (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup') ? 1 : 0),
    };
  }

  private zoomCameraAt(screenX: number, screenY: number, multiplier: number) {
    const camera = this.cameras.main;
    const center = camera.midPoint;
    const nextZoom = Phaser.Math.Clamp(
      camera.zoom * multiplier,
      this.getMinimumCameraZoom(),
      MAX_CAMERA_ZOOM,
    );

    if (nextZoom === camera.zoom) {
      return;
    }

    const nextCenter = getAnchoredZoomCenter({
      centerX: center.x,
      centerY: center.y,
      screenX,
      screenY,
      viewportWidth: camera.width,
      viewportHeight: camera.height,
      currentZoom: camera.zoom,
      nextZoom,
    });

    camera.setZoom(nextZoom);
    this.setMainCameraCenter(nextCenter.centerX, nextCenter.centerY);
  }

  private issueSpeedFromWheel(deltaY: number) {
    const projection = this.world.project();
    const speeds: Array<0 | 1 | 2 | 4> = [0, 1, 2, 4];
    const currentIndex = speeds.indexOf(projection.paused ? 0 : projection.speed);
    const direction = deltaY > 0 ? -1 : 1;
    const nextSpeed = speeds[Phaser.Math.Clamp(currentIndex + direction, 0, speeds.length - 1)];

    if (nextSpeed === 0) {
      this.issue({ type: 'pause', payload: { paused: true } });
      return;
    }

    if (projection.paused) {
      this.issue({ type: 'pause', payload: { paused: false } });
    }

    this.issue({ type: 'set_speed', payload: { speed: nextSpeed } });
  }

  private issueSelectedDiplomacyCommand(type: 'force_war' | 'force_peace') {
    const projection = this.projectVisibleWorld();
    const selection = this.selection;
    let kingdomId: string | undefined;
    let targetKingdomId: string | undefined;

    if (selection.type === 'army') {
      const army = projection.armies.find((candidate) => candidate.id === selection.id);
      kingdomId = army?.kingdomId;
      targetKingdomId = army?.targetKingdomId;
    } else if (selection.type === 'kingdom') {
      const kingdom = projection.kingdoms.find((candidate) => candidate.id === selection.id);
      kingdomId = kingdom?.id;
      targetKingdomId = kingdom?.diplomacyTargetKingdomId;
    } else if (selection.type === 'village') {
      const village = projection.villages.find((candidate) => candidate.id === selection.id);
      const kingdom = village?.kingdomId
        ? projection.kingdoms.find((candidate) => candidate.id === village.kingdomId)
        : undefined;
      kingdomId = kingdom?.id;
      targetKingdomId = kingdom?.diplomacyTargetKingdomId;
    }

    if (!kingdomId || !targetKingdomId || kingdomId === targetKingdomId) {
      return;
    }

    if (type === 'force_war') {
      this.issue({
        type: 'force_war',
        payload: {
          aggressorKingdomId: kingdomId,
          targetKingdomId,
        },
      });
      return;
    }

    this.issue({
      type: 'force_peace',
      payload: {
        kingdomAId: kingdomId,
        kingdomBId: targetKingdomId,
      },
    });
  }

  private issue(command: Omit<SimCommand, 'id' | 'issuedAtTick'>) {
    this.world.enqueue({
      ...command,
      id: `cmd-${String(this.commandSequence).padStart(5, '0')}`,
      issuedAtTick: this.world.currentTick,
    } as SimCommand);
    this.commandSequence += 1;
  }

  private projectVisibleWorld() {
    const camera = this.cameras.main;
    const view = getCameraViewportFromCenter({
      centerX: camera.midPoint.x,
      centerY: camera.midPoint.y,
      viewportWidth: camera.width / camera.zoom,
      viewportHeight: camera.height / camera.zoom,
    });

    return this.world.project({
      viewport: {
        x: view.x / TILE_SIZE,
        y: view.y / TILE_SIZE,
        width: view.width / TILE_SIZE,
        height: view.height / TILE_SIZE,
        paddingTiles: CAMERA_VIEWPORT_PADDING_TILES,
      },
    });
  }

  private getTerrainDrawKey(projection: WorldProjection) {
    return `${projection.terrainRevision}:${this.getViewportBucketKey(projection)}`;
  }

  private getResourceDrawKey(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    return [
      detailLevel,
      projection.terrainRevision,
      this.getViewportBucketKey(projection),
      this.getStaticLayerTickBucket(projection),
    ].join(':');
  }

  private getTerritoryDrawKey(projection: WorldProjection) {
    return [
      this.getViewportBucketKey(projection),
      this.getSelectionDrawKey(),
      projection.stats.territoryTiles,
      projection.territory.length,
      projection.terrainRevision,
      this.getStaticLayerTickBucket(projection),
    ].join(':');
  }

  private getBuildingDrawKey(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    return [
      detailLevel,
      this.getViewportBucketKey(projection),
      projection.stats.activeBuildings,
      projection.buildings.length,
      this.getStaticLayerTickBucket(projection),
    ].join(':');
  }

  private getArmyRouteDrawKey(projection: WorldProjection) {
    return [
      this.getViewportBucketKey(projection),
      this.getSelectionDrawKey(),
      projection.armies.length,
      this.getStaticLayerTickBucket(projection),
    ].join(':');
  }

  private getMapLabelsDrawKey(projection: WorldProjection, detailLevel: CameraDetailLevel) {
    return [
      detailLevel,
      this.getViewportBucketKey(projection),
      projection.villages.length,
      projection.kingdoms.length,
      this.getStaticLayerTickBucket(projection),
    ].join(':');
  }

  private getHudDrawKey(projection: WorldProjection) {
    return [
      this.getRenderDetailLevel(),
      this.getSelectionDrawKey(),
      projection.paused ? 'paused' : projection.speed,
      projection.stats.population,
      projection.stats.villages,
      projection.stats.kingdoms,
      projection.stats.activeBuildings,
      projection.stats.territoryTiles,
      projection.stats.fallenKingdoms,
      this.scale.width,
      this.scale.height,
    ].join(':');
  }

  private getRenderDetailLevel() {
    return getCameraDetailLevel(this.cameras.main.zoom);
  }

  private getViewportBucketKey(projection: WorldProjection) {
    const viewport = projection.viewport;

    if (!viewport) {
      return 'full';
    }

    return [
      Math.floor(viewport.x / STATIC_VIEWPORT_REDRAW_TILE_STEP),
      Math.floor(viewport.y / STATIC_VIEWPORT_REDRAW_TILE_STEP),
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
      viewport.paddingTiles ?? 0,
    ].join(':');
  }

  private getStaticLayerTickBucket(projection: WorldProjection) {
    return Math.floor(projection.tick / STATIC_LAYER_REDRAW_TICK_STEP);
  }

  private getSelectionDrawKey() {
    switch (this.selection.type) {
      case 'none':
        return 'none';
      case 'tile':
        return `tile:${this.selection.x}:${this.selection.y}`;
      default:
        return `${this.selection.type}:${this.selection.id}`;
    }
  }

  private createUiText(x: number, y: number, fontSize: number) {
    const text = this.add.text(x, y, '', {
      fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: `${fontSize}px`,
      color: TEXT_COLOR,
      lineSpacing: 5,
    });
    text.setScrollFactor(0);
    text.setDepth(21);
    return text;
  }

  private layoutUiPanels() {
    if (!this.uiLayer) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 900 || height < 680;
    const hasSelection = this.selection.type !== 'none';
    const sidePanelWidth = Math.min(compact ? 300 : 345, Math.max(260, Math.floor(width * 0.22)));
    const eventsWidth = Math.min(
      hasSelection ? (compact ? 330 : 420) : compact ? 300 : 350,
      Math.max(260, Math.floor(width * 0.28)),
    );
    const bottomHeight = compact ? 72 : BOTTOM_PANEL_HEIGHT;
    const statusPanelHeight = compact ? 104 : COMPACT_STATUS_PANEL_HEIGHT;
    const eventsPanelHeight = hasSelection
      ? Math.min(height - EVENTS_PANEL_TOP - bottomHeight - UI_MARGIN * 3, compact ? 280 : 340)
      : COMPACT_EVENTS_PANEL_HEIGHT;

    this.uiLayer.clear();
    this.drawPanel(UI_MARGIN, 10, sidePanelWidth, TITLE_PANEL_HEIGHT, 0.82);
    if (hasSelection) {
      this.drawPanel(UI_MARGIN, STATUS_PANEL_TOP, sidePanelWidth, statusPanelHeight, 0.78);
    }
    this.drawPanel(
      UI_MARGIN,
      height - bottomHeight - UI_MARGIN,
      width - UI_MARGIN * 2,
      bottomHeight,
      0.78,
    );
    if (hasSelection) {
      this.drawPanel(
        width - eventsWidth - UI_MARGIN,
        EVENTS_PANEL_TOP,
        eventsWidth,
        eventsPanelHeight,
        0.78,
      );
    }

    this.titleText?.setPosition(26, 21);
    this.statusText?.setPosition(26, 68);
    this.statusText?.setWordWrapWidth(sidePanelWidth - 28);
    this.controlsText?.setPosition(26, height - bottomHeight + (compact ? 8 : 9));
    this.controlsText?.setWordWrapWidth(width - 52);
    this.eventsText?.setPosition(width - eventsWidth + 4, 68);
    this.eventsText?.setWordWrapWidth(eventsWidth - 28);
  }

  private drawPanel(x: number, y: number, width: number, height: number, alpha: number) {
    if (!this.uiLayer) {
      return;
    }

    this.uiLayer.fillStyle(PANEL_COLOR, alpha);
    this.uiLayer.fillRoundedRect(x, y, width, height, 6);
    this.uiLayer.lineStyle(1, PANEL_STROKE, 0.7);
    this.uiLayer.strokeRoundedRect(x, y, width, height, 6);
  }

  private readonly handleResize = () => {
    this.configureMainCamera();
    this.cameras.main.setZoom(
      Phaser.Math.Clamp(this.cameras.main.zoom, this.getMinimumCameraZoom(), MAX_CAMERA_ZOOM),
    );
    this.clampMainCameraCenter();
    this.cameraInitialized = true;
    this.lastCameraWidth = this.cameras.main.width;
    this.lastCameraHeight = this.cameras.main.height;
    this.resetWorldLayerDrawKeys();
    this.uiCamera?.setSize(this.scale.width, this.scale.height);
    this.layoutUiPanels();
  };

  private configureMainCamera() {
    this.cameras.main.setOrigin(0.5, 0.5);
    this.cameras.main.roundPixels = false;
    this.cameras.main.setBackgroundColor(TERRAIN_COLORS.water);
  }

  private getMinimumCameraZoom() {
    const worldPixelWidth = this.world.map.width * TILE_SIZE;
    const worldPixelHeight = this.world.map.height * TILE_SIZE;

    return getContainZoom(
      { width: this.scale.width, height: this.scale.height },
      { width: worldPixelWidth, height: worldPixelHeight },
      MAX_CAMERA_ZOOM,
    );
  }

  private getDefaultCameraZoom() {
    const worldPixelWidth = this.world.map.width * TILE_SIZE;
    const worldPixelHeight = this.world.map.height * TILE_SIZE;

    const coverZoom = getCoverZoom(
      { width: this.scale.width, height: this.scale.height },
      { width: worldPixelWidth, height: worldPixelHeight },
      MAX_CAMERA_ZOOM,
    );

    return Math.max(INITIAL_CAMERA_ZOOM, coverZoom);
  }

  private ensureMainCameraInitialized() {
    const camera = this.cameras.main;
    const sizeChanged =
      this.lastCameraWidth !== camera.width || this.lastCameraHeight !== camera.height;

    if (this.cameraInitialized && !sizeChanged) {
      return;
    }

    camera.setZoom(
      Phaser.Math.Clamp(
        this.cameraInitialized ? camera.zoom : this.getDefaultCameraZoom(),
        this.getMinimumCameraZoom(),
        MAX_CAMERA_ZOOM,
      ),
    );
    if (this.cameraInitialized) {
      this.clampMainCameraCenter();
    } else {
      this.centerMainCamera();
    }

    this.cameraInitialized = true;
    this.lastCameraWidth = camera.width;
    this.lastCameraHeight = camera.height;
    this.resetWorldLayerDrawKeys();
  }

  private resetWorldLayerDrawKeys() {
    this.lastTerrainDrawKey = '';
    this.lastResourceDrawKey = '';
    this.lastTerritoryDrawKey = '';
    this.lastBuildingDrawKey = '';
    this.lastArmyRouteDrawKey = '';
    this.lastMapLabelsDrawKey = '';
    this.lastHudDrawKey = '';
    this.lastHudDrawAtMs = -Infinity;
  }

  private centerMainCamera() {
    const camera = this.cameras.main;
    const viewportWidth = camera.width / camera.zoom;
    const viewportHeight = camera.height / camera.zoom;
    const worldPixelWidth = this.world.map.width * TILE_SIZE;
    const worldPixelHeight = this.world.map.height * TILE_SIZE;
    const nextCenter = centerCameraView({
      viewportWidth,
      viewportHeight,
      worldWidth: worldPixelWidth,
      worldHeight: worldPixelHeight,
    });

    this.setMainCameraCenter(nextCenter.centerX, nextCenter.centerY);
  }

  private clampMainCameraCenter() {
    const camera = this.cameras.main;

    return this.setMainCameraCenter(camera.midPoint.x, camera.midPoint.y);
  }

  private setMainCameraCenter(centerX: number, centerY: number) {
    const camera = this.cameras.main;
    const viewportWidth = camera.width / camera.zoom;
    const viewportHeight = camera.height / camera.zoom;
    const worldPixelWidth = this.world.map.width * TILE_SIZE;
    const worldPixelHeight = this.world.map.height * TILE_SIZE;
    const nextCenter = clampCameraCenter({
      centerX,
      centerY,
      viewportWidth,
      viewportHeight,
      worldWidth: worldPixelWidth,
      worldHeight: worldPixelHeight,
    });

    camera.centerOn(nextCenter.centerX, nextCenter.centerY);
    return nextCenter;
  }

  private setupUiCamera() {
    const worldObjects: Array<Phaser.GameObjects.GameObject | undefined> = [
      this.terrainLayer,
      this.territoryLayer,
      this.resourceLayer,
      this.workSiteLayer,
      this.buildingLayer,
      this.armyRouteLayer,
      this.armyLayer,
      this.unitLayer,
      this.selectionLayer,
    ];
    const uiObjects: Array<Phaser.GameObjects.GameObject | undefined> = [
      this.uiLayer,
      this.titleText,
      this.statusText,
      this.controlsText,
      this.eventsText,
    ];
    const visibleWorldObjects = worldObjects.filter(
      (object): object is Phaser.GameObjects.GameObject => Boolean(object),
    );
    const visibleUiObjects = uiObjects.filter((object): object is Phaser.GameObjects.GameObject =>
      Boolean(object),
    );

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    this.uiCamera.ignore(visibleWorldObjects);
    this.cameras.main.ignore(visibleUiObjects);
  }
}

function translateEvent(message: string) {
  if (message.includes('Spawn life command accepted')) {
    return '召唤生命命令已接受';
  }

  if (message.includes('Place resource command accepted')) {
    return '投放资源命令已接受';
  }

  if (message.includes('Change terrain command accepted')) {
    return '改变地形命令已接受';
  }

  if (message.includes('Lightning command accepted')) {
    return '闪电命令已接受';
  }

  if (message.includes('was born')) {
    return '新小人出生';
  }

  if (message.includes('died from lightning')) {
    return '小人被闪电击倒';
  }

  if (message.includes('food placed')) {
    return '食物已投放';
  }

  if (message.includes('Terrain changed')) {
    return '地形已改变';
  }

  if (message.includes('Lightning struck')) {
    return '闪电已落下';
  }

  if (message.includes('kingdom') && message.includes('founded')) {
    return '王国已建立';
  }

  if (message.includes('joined kingdom')) {
    return '村庄加入王国';
  }

  if (message.includes('capital moved')) {
    return '王国迁都';
  }

  if (message.includes('border friction')) {
    return '王国边境摩擦升温';
  }

  if (message.includes('resource pressure')) {
    return '王国资源压力升温';
  }

  if (message.includes('declared war')) {
    return '王国宣战';
  }

  if (message.includes('formed')) {
    return '军队已集结';
  }

  if (message.includes('battle resolved')) {
    return '战斗已结算';
  }

  if (message.includes('captured')) {
    return '村庄被占领';
  }

  if (message.includes('disbanded')) {
    return '军队已解散';
  }

  if (message.includes('fallen')) {
    return '王国陨落';
  }

  if (message.includes('founded')) {
    return '村庄已形成';
  }

  if (message.includes('is declining')) {
    return '村庄进入衰退';
  }

  if (message.includes('ruined')) {
    return '建筑已沦为废墟';
  }

  if (message.includes('abandoned')) {
    return '村庄已废弃';
  }

  if (message.includes('built')) {
    return '村庄建筑已完成';
  }

  if (message.includes('upgraded')) {
    return '建筑已升级';
  }

  if (message.includes('Speed changed')) {
    return '速度已调整';
  }

  if (message.includes('Simulation paused')) {
    return '模拟已暂停';
  }

  if (message.includes('Simulation resumed')) {
    return '模拟已恢复';
  }

  return message;
}

function sourceAlpha(source: string, baseAlpha: number) {
  switch (source) {
    case 'work_site':
      return baseAlpha * 0.7;
    case 'frontier':
      return baseAlpha * 0.55;
    default:
      return baseAlpha;
  }
}
