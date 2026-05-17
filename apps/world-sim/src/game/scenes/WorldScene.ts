import * as Phaser from 'phaser';
import { Unit } from '../../agent/Unit';
import { BUILDING_DEFS } from '../../config/buildings';
import {
  getM1ArtAssetEntries,
  M1_BUILDING_ART_ASSETS,
  M1_RESOURCE_ART_ASSETS,
  M1_UNIT_ART_ASSETS,
  type M1VisibleResourceType,
} from '../../config/m1ArtAssets';
import { DiplomacySystem } from '../../faction/DiplomacySystem';
import { FactionManager } from '../../faction/FactionManager';
import { createM1StarterFactions, HUMAN_FACTION_ID } from '../../faction/starterFactions';
import { TerritorySystem } from '../../faction/TerritorySystem';
import { BuildSystem } from '../../systems/BuildSystem';
import { CombatSystem } from '../../systems/CombatSystem';
import { type ReproductionBirth, ReproductionSystem } from '../../systems/ReproductionSystem';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { getTimeScaleSpeedFromKeyboardEvent, TimeScaleSystem } from '../../systems/TimeScaleSystem';
import { TimeSystem } from '../../systems/TimeSystem';
import { WarMobilizationSystem } from '../../systems/WarMobilizationSystem';
import {
  createTestWorldMap,
  type ResourceType,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  type TerrainType,
  type TestWorldMap,
} from '../../world/testMap';
import { WORLD_SIM_SCENE_KEYS } from './sceneKeys';

const DEBUG_DIRECT_UNIT_COMMANDS = false;

const FACTION_NAMES: Record<Unit['race'], string> = {
  human: '人类营地',
  orc: '兽人部落',
  elf: '精灵林地',
  dwarf: '矮人山堡',
};

const FACTION_COLORS: Record<Unit['race'], string> = {
  human: '#5d9e4f',
  orc: '#b55945',
  elf: '#5b6ee1',
  dwarf: '#c0a080',
};

type FactionRuntime = {
  resourceSystem: ResourceSystem;
  buildSystem: BuildSystem;
};

type CombatTargetKind = 'unit' | 'building';

type CombatTargetRef = {
  id: string;
  kind: CombatTargetKind;
  factionId: string;
  position: Phaser.Math.Vector2;
  hp: number;
  maxHp: number;
  applyDamage: (damage: number) => boolean;
};

const COMBAT_DETECTION_RANGE = 48;
const COMBAT_ATTACK_POWER = 12;
const COMBAT_UNIT_DEFENSE = 2;
const COMBAT_BUILDING_DEFENSE = 0;
const COMBAT_OCCUPATION_RADIUS_TILES = 2;

type UnitSpawnSpec = {
  id: string;
  name: string;
  x: number;
  y: number;
  race?: Unit['race'];
  gender: Unit['gender'];
  factionId?: string;
  wanderRadius?: number;
  restPoint?: {
    x: number;
    y: number;
  };
  hp?: number;
  vitality?: number;
  age?: number;
};

export class WorldScene extends Phaser.Scene {
  private static readonly HUD_STATUS_EVENT = 'world-sim:hud-status';

  private readonly map: TestWorldMap = createTestWorldMap();
  private readonly factionManager: FactionManager;
  private readonly territorySystem: TerritorySystem;
  private readonly reproductionSystem: ReproductionSystem;
  private readonly combatSystem: CombatSystem;
  private readonly diplomacySystem: DiplomacySystem;
  private readonly warMobilizationSystem: WarMobilizationSystem;
  private readonly timeScaleSystem: TimeScaleSystem;
  private readonly timeSystem: TimeSystem;
  private readonly factionRuntimes = new Map<string, FactionRuntime>();
  private units: Unit[] = [];
  private terrainTextureLayer?: Phaser.GameObjects.RenderTexture;
  private resourceTextureLayer?: Phaser.GameObjects.RenderTexture;
  private buildingTextureLayer?: Phaser.GameObjects.RenderTexture;
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private resourceGraphics?: Phaser.GameObjects.Graphics;
  private territoryGraphics?: Phaser.GameObjects.Graphics;
  private overlayGraphics?: Phaser.GameObjects.Graphics;
  private buildingGraphics?: Phaser.GameObjects.Graphics;
  private nightOverlay?: Phaser.GameObjects.Rectangle;
  private readonly claimedTerritoryBuildingIds = new Set<string>();
  private readonly notifiedTerritoryContactKeys = new Set<string>();
  private selectedUnit?: Unit;
  private commandUnit?: Unit;
  private unitLabel?: Phaser.GameObjects.Text;
  private targetMarker?: Phaser.GameObjects.Arc;
  private restMarkers: Phaser.GameObjects.Arc[] = [];
  private isPanning = false;
  private isFollowingUnit = true;
  private hudNotice?: string;
  private hudNoticeExpiresAt = 0;
  private hoveredWorldPoint?: Phaser.Math.Vector2;
  private lastPointerPosition = new Phaser.Math.Vector2();
  private terrainDirtyFromHarvest = false;

  constructor() {
    super(WORLD_SIM_SCENE_KEYS.World);
    this.factionManager = new FactionManager();
    this.territorySystem = new TerritorySystem(this.map);
    this.combatSystem = new CombatSystem();
    this.diplomacySystem = new DiplomacySystem(this.factionManager);
    this.warMobilizationSystem = new WarMobilizationSystem();
    this.timeScaleSystem = new TimeScaleSystem();
    this.timeSystem = new TimeSystem();
    this.reproductionSystem = new ReproductionSystem({
      canAffordBirth: (factionId: string) =>
        (this.factionRuntimes.get(factionId)?.resourceSystem.getInventory().food ?? 0) > 20,
      spendBirthCost: (factionId: string) =>
        this.factionRuntimes.get(factionId)?.resourceSystem.spend({ food: 20 }) ?? false,
    });
  }

  preload() {
    for (const asset of getM1ArtAssetEntries()) {
      this.load.image(asset.key, asset.url);
    }
  }

  create() {
    const worldWidth = this.map.width * this.map.tileSize;
    const worldHeight = this.map.height * this.map.tileSize;

    this.cameras.main.setBackgroundColor('#101726');
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
    this.cameras.main.setZoom(1);
    this.hoveredWorldPoint = this.cameras.main.midPoint.clone();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.terrainTextureLayer = this.add.renderTexture(0, 0, worldWidth, worldHeight);
    this.resourceTextureLayer = this.add.renderTexture(0, 0, worldWidth, worldHeight);
    this.buildingTextureLayer = this.add.renderTexture(0, 0, worldWidth, worldHeight);
    this.mapGraphics = this.add.graphics();
    this.resourceGraphics = this.add.graphics();
    this.territoryGraphics = this.add.graphics();
    this.buildingGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.nightOverlay = this.add.rectangle(0, 0, worldWidth, worldHeight, 0x0b1328, 0);
    this.nightOverlay.setOrigin(0, 0);
    this.nightOverlay.setScrollFactor(0);
    this.nightOverlay.setDepth(50);
    this.terrainTextureLayer.setOrigin(0, 0);
    this.resourceTextureLayer.setOrigin(0, 0);
    this.buildingTextureLayer.setOrigin(0, 0);
    this.terrainTextureLayer.setDepth(0);
    this.mapGraphics.setDepth(1);
    this.territoryGraphics.setDepth(2);
    this.resourceTextureLayer.setDepth(4);
    this.resourceGraphics.setDepth(4.1);
    this.buildingTextureLayer.setDepth(5);
    this.buildingGraphics.setDepth(6);
    this.overlayGraphics.setDepth(10);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();
    this.drawTerrainMap();
    this.drawResources();
    this.drawTerritoryOverlay();
    this.drawBuildings();
    this.drawMapBorder();
    this.spawnInitialUnits();
    this.spawnMarkers();
    this.updateCoordinateText();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  update(_time: number, delta: number) {
    const simDelta = this.timeScaleSystem.scaleDelta(delta);

    this.timeSystem.update(simDelta);
    this.updateNightOverlay();
    this.syncFactionBuildDemands();

    for (const unit of this.units) {
      unit.update(simDelta);
    }

    for (const unit of this.units) {
      if (unit.isDead) {
        this.handleDeadUnit(unit);
      }
    }

    this.units = this.units.filter((unit) => !unit.isDead);

    if (this.selectedUnit && this.selectedUnit.isDead) {
      this.selectUnit(undefined);
    }

    if (this.commandUnit && this.commandUnit.isDead) {
      this.commandUnit = this.units[0];
    }

    for (const birth of this.reproductionSystem.update(simDelta, this.units)) {
      this.units.push(this.spawnBirthUnit(birth));
    }

    this.syncFactionBuildDemands();

    if (this.consumeResourceDirty()) {
      this.syncFactionInventories();
      if (this.terrainDirtyFromHarvest) {
        this.drawTerrainMap();
        this.terrainDirtyFromHarvest = false;
      }
      this.drawResources();
    }

    if (this.consumeBuildDirty()) {
      this.claimTerritoryForCompletedBuildings();
      this.drawBuildings();
    }
    this.updateTargetMarker();
    this.updateUnitLabel();
    this.updateCoordinateText();
  }

  shutdown() {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);

    this.terrainTextureLayer?.destroy();
    this.terrainTextureLayer = undefined;
    this.resourceTextureLayer?.destroy();
    this.resourceTextureLayer = undefined;
    this.buildingTextureLayer?.destroy();
    this.buildingTextureLayer = undefined;
    this.mapGraphics?.destroy();
    this.mapGraphics = undefined;
    this.resourceGraphics?.destroy();
    this.resourceGraphics = undefined;
    this.territoryGraphics?.destroy();
    this.territoryGraphics = undefined;
    this.overlayGraphics?.destroy();
    this.overlayGraphics = undefined;
    this.nightOverlay?.destroy();
    this.nightOverlay = undefined;
    this.buildingGraphics?.destroy();
    this.buildingGraphics = undefined;
    this.unitLabel?.destroy();
    this.unitLabel = undefined;
    this.targetMarker?.destroy();
    this.targetMarker = undefined;
    for (const marker of this.restMarkers) {
      marker.destroy();
    }
    this.restMarkers = [];
    for (const unit of this.units) {
      unit.destroy();
    }
    this.units = [];
    this.selectedUnit = undefined;
    this.commandUnit = undefined;
    this.hudNotice = undefined;
    this.hudNoticeExpiresAt = 0;
    this.hoveredWorldPoint = undefined;
    this.claimedTerritoryBuildingIds.clear();
    this.notifiedTerritoryContactKeys.clear();
    this.factionRuntimes.clear();
    this.factionManager.clear();
  }

  private drawTerrainMap() {
    if (!this.mapGraphics) {
      return;
    }

    this.mapGraphics.clear();
    this.terrainTextureLayer?.clear();

    for (const tile of this.map.tiles) {
      const color = TERRAIN_COLORS[tile.terrainType];
      const x = tile.x * this.map.tileSize;
      const y = tile.y * this.map.tileSize;

      this.mapGraphics.fillStyle(color, 0.92);
      this.mapGraphics.fillRect(x, y, this.map.tileSize, this.map.tileSize);
      this.drawTerrainDetail(x, y, tile.terrainType);
    }

    this.mapGraphics.lineStyle(1, 0x101726, 0.08);

    for (let x = 0; x <= this.map.width; x += 1) {
      const worldX = x * this.map.tileSize;
      this.mapGraphics.lineBetween(worldX, 0, worldX, this.map.height * this.map.tileSize);
    }

    for (let y = 0; y <= this.map.height; y += 1) {
      const worldY = y * this.map.tileSize;
      this.mapGraphics.lineBetween(0, worldY, this.map.width * this.map.tileSize, worldY);
    }
  }

  private drawTerrainDetail(x: number, y: number, terrainType: TerrainType) {
    if (!this.mapGraphics) {
      return;
    }

    const seed = (x / this.map.tileSize) * 31 + (y / this.map.tileSize) * 17;

    switch (terrainType) {
      case 'grass':
        if (seed % 3 === 0) {
          this.mapGraphics.fillStyle(0x99e550, 0.22);
          this.mapGraphics.fillRect(x + 4, y + 5, 2, 1);
          this.mapGraphics.fillRect(x + 11, y + 10, 2, 1);
        }
        break;
      case 'forest':
        this.mapGraphics.fillStyle(0x1a1c2c, 0.16);
        this.mapGraphics.fillRect(x + 4, y + 11, 8, 2);
        this.mapGraphics.fillStyle(0x38b764, 0.32);
        this.mapGraphics.fillRect(x + 5, y + 4, 6, 3);
        this.mapGraphics.fillRect(x + 4, y + 7, 8, 3);
        break;
      case 'mountain':
        this.mapGraphics.fillStyle(0x94b0c2, 0.28);
        this.mapGraphics.fillTriangle(x + 3, y + 12, x + 8, y + 3, x + 13, y + 12);
        this.mapGraphics.lineStyle(1, 0x1a1c2c, 0.16);
        this.mapGraphics.lineBetween(x + 8, y + 4, x + 11, y + 12);
        break;
      case 'water':
        this.mapGraphics.fillStyle(0x5b6ee1, 0.18);
        this.mapGraphics.fillRect(x + 3, y + 5, 5, 1);
        this.mapGraphics.fillRect(x + 8, y + 10, 5, 1);
        break;
      case 'desert':
        this.mapGraphics.fillStyle(0xef7d57, 0.12);
        this.mapGraphics.fillRect(x + 4, y + 6, 2, 1);
        this.mapGraphics.fillRect(x + 10, y + 11, 3, 1);
        break;
      case 'snow':
        this.mapGraphics.fillStyle(0x94b0c2, 0.18);
        this.mapGraphics.fillRect(x + 4, y + 5, 2, 1);
        this.mapGraphics.fillRect(x + 10, y + 11, 2, 1);
        break;
      case 'lava':
        this.mapGraphics.fillStyle(0xffcd75, 0.32);
        this.mapGraphics.fillRect(x + 4, y + 4, 2, 2);
        this.mapGraphics.fillRect(x + 10, y + 10, 3, 1);
        break;
    }
  }

  private drawResources() {
    this.resourceTextureLayer?.clear();
    this.resourceGraphics?.clear();

    for (const tile of this.map.tiles) {
      if (!tile.resourceType || tile.resourceAmount <= 0) {
        continue;
      }

      const x = tile.x * this.map.tileSize;
      const y = tile.y * this.map.tileSize;

      if (!this.shouldDrawResourceMarker(tile.resourceType)) {
        continue;
      }

      const resourceAsset = M1_RESOURCE_ART_ASSETS[tile.resourceType];

      if (!this.drawTextureFrame(this.resourceTextureLayer, resourceAsset.key, x, y)) {
        this.drawResourceIcon(x, y, tile.resourceType);
      }
    }
  }

  private shouldDrawResourceMarker(
    resourceType: ResourceType,
  ): resourceType is M1VisibleResourceType {
    return resourceType === 'food' || resourceType === 'iron';
  }

  private drawResourceIcon(x: number, y: number, resourceType: ResourceType) {
    if (!this.getResourceIconGraphics()) {
      return;
    }

    switch (resourceType) {
      case 'wood':
        this.drawWoodIcon(x, y);
        break;
      case 'stone':
        this.drawStoneIcon(x, y);
        break;
      case 'iron':
        this.drawIronIcon(x, y);
        break;
      case 'food':
        this.drawFoodIcon(x, y);
        break;
    }
  }

  private drawWoodIcon(x: number, y: number) {
    const graphics = this.getResourceIconGraphics();

    if (!graphics) {
      return;
    }

    graphics.fillStyle(0x1a1c2c, 0.25);
    graphics.fillRect(x + 6, y + 7, 5, 7);
    graphics.fillStyle(0x8f563b, 0.9);
    graphics.fillRect(x + 7, y + 9, 3, 5);
    graphics.fillStyle(0x99e550, 0.85);
    graphics.fillRect(x + 5, y + 5, 7, 3);
    graphics.fillStyle(0x38b764, 0.85);
    graphics.fillRect(x + 4, y + 7, 9, 3);
  }

  private drawStoneIcon(x: number, y: number) {
    const graphics = this.getResourceIconGraphics();

    if (!graphics) {
      return;
    }

    graphics.fillStyle(0x1a1c2c, 0.26);
    graphics.fillRect(x + 4, y + 9, 9, 4);
    graphics.fillStyle(0x333c57, 0.9);
    graphics.fillRect(x + 4, y + 9, 4, 4);
    graphics.fillRect(x + 9, y + 8, 4, 5);
    graphics.fillStyle(0x94b0c2, 0.85);
    graphics.fillRect(x + 6, y + 8, 2, 1);
    graphics.fillRect(x + 10, y + 9, 2, 1);
  }

  private drawIronIcon(x: number, y: number) {
    const graphics = this.getResourceIconGraphics();

    if (!graphics) {
      return;
    }

    this.drawStoneIcon(x, y);
    graphics.fillStyle(0xb13e53, 1);
    graphics.fillRect(x + 6, y + 9, 2, 2);
    graphics.fillStyle(0xef7d57, 1);
    graphics.fillRect(x + 10, y + 8, 2, 2);
    graphics.fillStyle(0xffcd75, 0.95);
    graphics.fillRect(x + 11, y + 8, 1, 1);
  }

  private drawFoodIcon(x: number, y: number) {
    const graphics = this.getResourceIconGraphics();

    if (!graphics) {
      return;
    }

    graphics.fillStyle(0x1a1c2c, 0.24);
    graphics.fillRect(x + 4, y + 5, 8, 8);
    graphics.fillStyle(0x5d9e4f, 0.95);
    graphics.fillRect(x + 7, y + 8, 2, 5);
    graphics.fillRect(x + 5, y + 10, 2, 2);
    graphics.fillRect(x + 9, y + 10, 2, 2);
    graphics.fillStyle(0xffcd75, 1);
    graphics.fillRect(x + 7, y + 5, 2, 2);
    graphics.fillRect(x + 6, y + 7, 2, 2);
    graphics.fillRect(x + 9, y + 7, 2, 2);
    graphics.fillStyle(0xb13e53, 1);
    graphics.fillRect(x + 5, y + 8, 2, 2);
    graphics.fillRect(x + 10, y + 8, 2, 2);
  }

  private getResourceIconGraphics() {
    return this.resourceGraphics ?? this.mapGraphics;
  }

  private drawMapBorder() {
    if (!this.overlayGraphics) {
      return;
    }

    const worldWidth = this.map.width * this.map.tileSize;
    const worldHeight = this.map.height * this.map.tileSize;

    this.overlayGraphics.clear();
    this.overlayGraphics.lineStyle(4, 0xffcd75, 0.82);
    this.overlayGraphics.strokeRect(0, 0, worldWidth, worldHeight);
  }

  private drawTerritoryOverlay() {
    if (!this.territoryGraphics) {
      return;
    }

    this.territoryGraphics.clear();

    for (const tile of this.map.tiles) {
      if (!tile.ownerFactionId) {
        continue;
      }

      const color = this.factionManager.getFactionColorValue(tile.ownerFactionId);
      const x = tile.x * this.map.tileSize;
      const y = tile.y * this.map.tileSize;

      this.territoryGraphics.fillStyle(color, 0.24);
      this.territoryGraphics.fillRect(x, y, this.map.tileSize, this.map.tileSize);
      this.territoryGraphics.lineStyle(1, color, 0.42);
      this.territoryGraphics.strokeRect(x + 1, y + 1, this.map.tileSize - 2, this.map.tileSize - 2);
    }
  }

  private drawBuildings() {
    if (!this.buildingGraphics) {
      return;
    }

    this.buildingGraphics.clear();
    this.buildingTextureLayer?.clear();

    for (const runtime of this.factionRuntimes.values()) {
      for (const building of runtime.buildSystem.getBuildings()) {
        const def = BUILDING_DEFS[building.type];

        if (building.status !== 'complete') {
          this.drawBuildingSite(building.position, building.progress, building.progressRequired);
        } else if (building.type === 'hut') {
          this.drawHut(building.position);
        } else {
          this.drawBuildingBlock(building.position, def.color);
        }
      }
    }
  }

  private drawBuildingSite(
    position: Phaser.Math.Vector2,
    progress: number,
    progressRequired: number,
  ) {
    if (!this.buildingGraphics) {
      return;
    }

    const x = position.x - this.map.tileSize / 2;
    const y = position.y - this.map.tileSize / 2;

    if (
      this.drawTextureFrame(
        this.buildingTextureLayer,
        M1_BUILDING_ART_ASSETS.buildingSite.key,
        x,
        y,
      )
    ) {
      this.drawBuildingProgressBar(x, y, progress, progressRequired);
      return;
    }

    this.buildingGraphics.fillStyle(0x1a1c2c, 0.55);
    this.buildingGraphics.fillRect(x + 2, y + 7, 12, 7);
    this.buildingGraphics.lineStyle(1, 0xffcd75, 0.9);
    this.buildingGraphics.strokeRect(x + 2, y + 7, 12, 7);
    this.buildingGraphics.lineStyle(1, 0xc0a080, 0.9);
    this.buildingGraphics.lineBetween(x + 3, y + 5, x + 13, y + 12);
    this.buildingGraphics.lineBetween(x + 13, y + 5, x + 3, y + 12);

    this.drawBuildingProgressBar(x, y, progress, progressRequired);
  }

  private drawHut(position: Phaser.Math.Vector2) {
    if (!this.buildingGraphics) {
      return;
    }

    const x = position.x - this.map.tileSize / 2;
    const y = position.y - this.map.tileSize / 2;

    if (this.drawTextureFrame(this.buildingTextureLayer, M1_BUILDING_ART_ASSETS.hut.key, x, y)) {
      return;
    }

    this.buildingGraphics.fillStyle(0xb55945, 1);
    this.buildingGraphics.fillTriangle(x, y + 8, x + 8, y + 1, x + 16, y + 8);
    this.buildingGraphics.lineStyle(1, 0x1a1c2c, 0.95);
    this.buildingGraphics.strokeTriangle(x, y + 8, x + 8, y + 1, x + 16, y + 8);
    this.buildingGraphics.fillStyle(0xc0a080, 1);
    this.buildingGraphics.fillRect(x + 2, y + 8, 12, 7);
    this.buildingGraphics.lineStyle(1, 0x1a1c2c, 0.9);
    this.buildingGraphics.strokeRect(x + 2, y + 8, 12, 7);
    this.buildingGraphics.fillStyle(0x5d275d, 1);
    this.buildingGraphics.fillRect(x + 7, y + 11, 3, 4);
    this.buildingGraphics.fillStyle(0xffcd75, 1);
    this.buildingGraphics.fillRect(x + 4, y + 10, 2, 2);
  }

  private drawBuildingBlock(position: Phaser.Math.Vector2, color: number) {
    if (!this.buildingGraphics) {
      return;
    }

    const x = position.x - this.map.tileSize / 2;
    const y = position.y - this.map.tileSize / 2;

    this.buildingGraphics.fillStyle(color, 1);
    this.buildingGraphics.fillRect(x + 1, y + 1, this.map.tileSize - 2, this.map.tileSize - 2);
    this.buildingGraphics.lineStyle(1, 0x1a1c2c, 0.9);
    this.buildingGraphics.strokeRect(x + 1, y + 1, this.map.tileSize - 2, this.map.tileSize - 2);
  }

  private drawBuildingProgressBar(
    x: number,
    y: number,
    progress: number,
    progressRequired: number,
  ) {
    if (!this.buildingGraphics) {
      return;
    }

    const progressWidth = ((this.map.tileSize - 4) * progress) / progressRequired;

    this.buildingGraphics.fillStyle(0x4052a1, 0.9);
    this.buildingGraphics.fillRect(x + 2, y + this.map.tileSize - 3, this.map.tileSize - 4, 2);
    this.buildingGraphics.fillStyle(0xffcd75, 1);
    this.buildingGraphics.fillRect(x + 2, y + this.map.tileSize - 3, progressWidth, 2);
  }

  private drawTextureFrame(
    layer: Phaser.GameObjects.RenderTexture | undefined,
    key: string,
    x: number,
    y: number,
  ) {
    if (!layer || !this.textures.exists(key)) {
      return false;
    }

    layer.drawFrame(key, undefined, x, y);
    return true;
  }

  private spawnMarkers() {
    for (const marker of this.restMarkers) {
      marker.destroy();
    }
    this.restMarkers = [];

    for (const faction of this.factionManager.getFactions()) {
      const marker = this.add.circle(
        faction.capitalPosition.x,
        faction.capitalPosition.y,
        10,
        faction.getColorValue(),
        0.18,
      );
      marker.setStrokeStyle(2, faction.getColorValue(), 0.9);
      marker.setDepth(8);
      this.restMarkers.push(marker);
    }
  }

  private spawnInitialUnits() {
    const spawnedUnits: Unit[] = [];

    for (const starter of createM1StarterFactions(this.map)) {
      const capitalPosition = new Phaser.Math.Vector2(
        starter.capitalPosition.x,
        starter.capitalPosition.y,
      );
      const buildPoint = new Phaser.Math.Vector2(starter.buildPoint.x, starter.buildPoint.y);
      const runtime = this.ensureFactionRuntime(starter.factionId, buildPoint);

      this.ensureFaction(starter.factionId, starter.race, capitalPosition, runtime.resourceSystem);
      this.territorySystem.claimAroundWorldPoint(
        starter.factionId,
        capitalPosition,
        starter.starterTerritoryRadiusTiles,
      );

      for (const unitSpec of starter.units) {
        spawnedUnits.push(this.spawnUnit(unitSpec));
      }
    }

    this.units.push(...spawnedUnits);
    this.commandUnit = spawnedUnits[0];
    this.syncFactionTerritoryCounts();
    this.drawTerritoryOverlay();

    this.targetMarker = this.add.circle(
      this.commandUnit.position.x,
      this.commandUnit.position.y,
      9,
      0xffcd75,
      0,
    );
    this.targetMarker.setStrokeStyle(2, 0xffcd75, 0.9);
    this.targetMarker.setDepth(9);

    this.unitLabel = this.add.text(
      this.commandUnit.position.x,
      this.commandUnit.position.y - 18,
      '',
      {
        color: '#f4f4f4',
        fontFamily: 'monospace',
        fontSize: '10px',
        backgroundColor: '#1a1c2c',
        padding: {
          x: 4,
          y: 3,
        },
      },
    );
    this.unitLabel.setOrigin(0.5, 1);
    this.unitLabel.setDepth(12);
    this.unitLabel.setVisible(false);
  }

  private spawnBirthUnit(birth: ReproductionBirth) {
    return this.spawnUnit({
      id: birth.child.id,
      name: birth.child.name,
      x: birth.child.position.x,
      y: birth.child.position.y,
      race: birth.child.race,
      gender: birth.child.gender,
      factionId: birth.child.factionId,
      hp: birth.child.hp,
      vitality: birth.child.vitality,
      age: birth.child.age,
    });
  }

  private spawnUnit(spec: UnitSpawnSpec) {
    let unit!: Unit;
    const spawnPosition = new Phaser.Math.Vector2(spec.x, spec.y);
    const factionId = spec.factionId ?? HUMAN_FACTION_ID;
    const fallbackBuildPoint = this.getDefaultBuildPoint(spawnPosition);
    const runtime = this.ensureFactionRuntime(factionId, fallbackBuildPoint);
    const faction = this.ensureFaction(
      factionId,
      spec.race ?? 'human',
      spawnPosition,
      runtime.resourceSystem,
    );
    let currentAttackTarget: CombatTargetRef | undefined;
    let attackCooldownMs = 0;
    const refreshAttackTarget = () => {
      currentAttackTarget = this.findNearestEnemyCombatTarget(unit, COMBAT_DETECTION_RANGE);
      return currentAttackTarget;
    };

    unit = new Unit({
      id: spec.id,
      name: spec.name,
      scene: this,
      x: spec.x,
      y: spec.y,
      race: spec.race ?? 'human',
      gender: spec.gender,
      factionId,
      factionColor: faction.getColorValue(),
      unitTextureKey: M1_UNIT_ART_ASSETS[spec.race ?? 'human'][spec.gender].key,
      wanderRadius: spec.wanderRadius,
      hp: spec.hp,
      vitality: spec.vitality,
      age: spec.age,
      worldBounds: new Phaser.Geom.Rectangle(
        this.map.tileSize / 2,
        this.map.tileSize / 2,
        this.map.width * this.map.tileSize - this.map.tileSize,
        this.map.height * this.map.tileSize - this.map.tileSize,
      ),
      pickHarvestTarget: () =>
        runtime.resourceSystem.findNextHarvestTarget(unit?.position ?? spawnPosition),
      harvestResource: () => this.harvestResource(unit, runtime.resourceSystem),
      hasBuildTask: () => runtime.buildSystem.hasBuildTask(),
      pickBuildTarget: () => runtime.buildSystem.getBuildTarget(),
      buildAtTarget: (deltaMs: number) =>
        runtime.buildSystem.buildAt(unit?.position ?? spawnPosition, deltaMs),
      hasAttackTask: () => Boolean(refreshAttackTarget()),
      pickAttackTarget: () => refreshAttackTarget()?.position,
      attackAtTarget: (deltaMs: number) => {
        attackCooldownMs = Math.max(0, attackCooldownMs - deltaMs);

        if (attackCooldownMs > 0) {
          return false;
        }

        const targetDestroyed = this.attackCombatTarget(unit, currentAttackTarget);
        attackCooldownMs = 900;
        return targetDestroyed;
      },
      hasFleeTask: () => unit.hp < unit.maxHp * 0.2,
      pickFleeTarget: () => this.pickFleeTarget(unit, refreshAttackTarget()?.position),
      restPoint: spec.restPoint
        ? new Phaser.Math.Vector2(spec.restPoint.x, spec.restPoint.y)
        : faction.capitalPosition,
      shouldHarvest: () =>
        runtime.resourceSystem.needsHarvest() &&
        runtime.resourceSystem.getActiveHarvestPriorityTypes().length > 0,
    });
    unit.sprite.setInteractive({ useHandCursor: true });
    this.factionManager.attachUnit(unit.id, faction.id);

    if (spec.id.startsWith('birth-')) {
      const birthTargets = unit.artSprite ? [unit.sprite, unit.artSprite] : unit.sprite;

      unit.sprite.setAlpha(0);
      unit.sprite.setScale(0.25);
      unit.artSprite?.setAlpha(0);
      unit.artSprite?.setScale(0.25);
      this.tweens.add({
        targets: birthTargets,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 420,
        ease: 'Back.easeOut',
      });
    }

    return unit;
  }

  private followSelectedUnit() {
    if (!this.selectedUnit || this.selectedUnit.isDead) {
      return;
    }

    this.isFollowingUnit = true;
    this.cameras.main.startFollow(this.selectedUnit.sprite, true, 0.12, 0.12);
  }

  private handlePointerDown(
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[] = [],
  ) {
    if (!this.shouldPan(pointer)) {
      if (this.handleUnitSelection(gameObjects)) {
        this.updateCoordinateText(pointer);
        return;
      }

      if (DEBUG_DIRECT_UNIT_COMMANDS && this.handleMoveCommand(pointer)) {
        this.updateCoordinateText(pointer);
        return;
      }

      this.selectUnit(undefined);
      this.updateCoordinateText(pointer);
      return;
    }

    this.isPanning = true;
    this.isFollowingUnit = false;
    this.cameras.main.stopFollow();
    this.lastPointerPosition.set(pointer.x, pointer.y);
    this.input.setDefaultCursor('grabbing');
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.isPanning) {
      this.updateCoordinateText(pointer);
      return;
    }

    const camera = this.cameras.main;
    const deltaX = pointer.x - this.lastPointerPosition.x;
    const deltaY = pointer.y - this.lastPointerPosition.y;

    camera.scrollX -= deltaX / camera.zoom;
    camera.scrollY -= deltaY / camera.zoom;
    this.lastPointerPosition.set(pointer.x, pointer.y);
    this.updateCoordinateText(pointer);
  }

  private handlePointerUp() {
    this.isPanning = false;
    this.input.setDefaultCursor('default');
  }

  private handlePointerWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ) {
    const camera = this.cameras.main;
    const worldPointBeforeZoom = camera.getWorldPoint(pointer.x, pointer.y);
    const nextZoom = Phaser.Math.Clamp(camera.zoom + (deltaY > 0 ? -0.1 : 0.1), 0.5, 3);

    camera.setZoom(nextZoom);

    const worldPointAfterZoom = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += worldPointBeforeZoom.x - worldPointAfterZoom.x;
    camera.scrollY += worldPointBeforeZoom.y - worldPointAfterZoom.y;

    this.updateCoordinateText(pointer);
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const nextSpeed = getTimeScaleSpeedFromKeyboardEvent(event);

    if (nextSpeed !== undefined) {
      this.timeScaleSystem.setSpeed(
        nextSpeed === 0 && this.timeScaleSystem.speed === 0 ? 1 : nextSpeed,
      );
      this.updateCoordinateText();
      event.preventDefault();
      return;
    }

    if (key !== 'f') {
      return;
    }

    if (this.isFollowingUnit) {
      this.isFollowingUnit = false;
      this.cameras.main.stopFollow();
      return;
    }

    this.followSelectedUnit();
  };

  private shouldPan(pointer: Phaser.Input.Pointer) {
    return pointer.rightButtonDown() || pointer.middleButtonDown();
  }

  private handleMoveCommand(pointer: Phaser.Input.Pointer) {
    const unit = this.selectedUnit ?? this.commandUnit;

    if (!unit || unit.isDead || pointer.leftButtonDown() === false) {
      return false;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const destination = this.clampToWorld(worldPoint.x, worldPoint.y);

    unit.moveTo(destination.x, destination.y);
    this.updateTargetMarker();
    return true;
  }

  private clampToWorld(x: number, y: number) {
    const maxX = this.map.width * this.map.tileSize - this.map.tileSize / 2;
    const maxY = this.map.height * this.map.tileSize - this.map.tileSize / 2;

    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, this.map.tileSize / 2, maxX),
      Phaser.Math.Clamp(y, this.map.tileSize / 2, maxY),
    );
  }

  private findNearestEnemyCombatTarget(unit: Unit, maxDistance: number) {
    if (!unit || unit.isDead) {
      return undefined;
    }

    let nearestTarget: CombatTargetRef | undefined;
    let nearestDistance = maxDistance;

    for (const candidate of this.units) {
      if (candidate.isDead || candidate.id === unit.id || candidate.factionId === unit.factionId) {
        continue;
      }

      if (!this.diplomacySystem.isAtWar(unit.factionId, candidate.factionId)) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        unit.position.x,
        unit.position.y,
        candidate.position.x,
        candidate.position.y,
      );

      if (distance > nearestDistance) {
        continue;
      }

      nearestDistance = distance;
      nearestTarget = {
        id: candidate.id,
        kind: 'unit',
        factionId: candidate.factionId,
        position: candidate.position,
        hp: candidate.hp,
        maxHp: candidate.maxHp,
        applyDamage: (damage: number) => candidate.applyDamage(damage),
      };
    }

    for (const [factionId, runtime] of this.factionRuntimes) {
      if (factionId === unit.factionId) {
        continue;
      }

      if (!this.diplomacySystem.isAtWar(unit.factionId, factionId)) {
        continue;
      }

      for (const building of runtime.buildSystem.getBuildings()) {
        if (building.status !== 'complete') {
          continue;
        }

        const distance = Phaser.Math.Distance.Between(
          unit.position.x,
          unit.position.y,
          building.position.x,
          building.position.y,
        );

        if (distance > nearestDistance) {
          continue;
        }

        nearestDistance = distance;
        nearestTarget = {
          id: building.id,
          kind: 'building',
          factionId: building.factionId,
          position: building.position,
          hp: building.hp,
          maxHp: BUILDING_DEFS[building.type].hp,
          applyDamage: (damage: number) => runtime.buildSystem.damageBuilding(building.id, damage),
        };
      }
    }

    return nearestTarget;
  }

  private attackCombatTarget(attacker: Unit, target?: CombatTargetRef) {
    if (!target || attacker.isDead) {
      return true;
    }

    const damage = this.combatSystem.calculateDamage({
      attackPower: COMBAT_ATTACK_POWER,
      defense: target.kind === 'unit' ? COMBAT_UNIT_DEFENSE : COMBAT_BUILDING_DEFENSE,
    });
    const targetDestroyed = target.applyDamage(damage);

    if (targetDestroyed) {
      const capturedTerritory = this.captureTerritoryAfterCombat(attacker, target);

      if (!capturedTerritory) {
        this.hudNotice =
          target.kind === 'unit'
            ? `战斗：${attacker.name} 击倒目标`
            : `战斗：${attacker.name} 摧毁建筑`;
        this.hudNoticeExpiresAt = this.time.now + 3000;
      }
    }

    return targetDestroyed;
  }

  private captureTerritoryAfterCombat(attacker: Unit, target: CombatTargetRef) {
    if (!this.hasSurvivingFactionUnits(target.factionId)) {
      const result = this.territorySystem.captureAllFactionTerritory(
        attacker.factionId,
        target.factionId,
      );

      this.factionRuntimes.delete(target.factionId);
      this.syncFactionTerritoryCounts();
      this.notifyTerritoryContacts();
      this.drawTerritoryOverlay();
      this.drawBuildings();
      this.spawnMarkers();
      this.hudNotice = `征服：${this.factionManager.getFactionName(
        target.factionId,
      )} 据点清空，${result.capturedCount} 格领土变为无主`;
      this.hudNoticeExpiresAt = this.time.now + 5000;
      return true;
    }

    if (this.hasEnemyUnitInOccupationArea(target.factionId, target.position)) {
      return false;
    }

    const result = this.territorySystem.captureAroundWorldPoint(
      attacker.factionId,
      target.factionId,
      target.position,
      COMBAT_OCCUPATION_RADIUS_TILES,
    );

    if (result.capturedCount <= 0) {
      return false;
    }

    this.syncFactionTerritoryCounts();
    this.notifyTerritoryContacts();
    this.drawTerritoryOverlay();
    this.hudNotice = `占领：${this.factionManager.getFactionName(attacker.factionId)} 清空 ${
      result.capturedCount
    } 格敌方领土`;
    this.hudNoticeExpiresAt = this.time.now + 4000;
    return true;
  }

  private hasSurvivingFactionUnits(factionId: string) {
    return this.units.some((unit) => unit.factionId === factionId && !unit.isDead);
  }

  private hasEnemyUnitInOccupationArea(factionId: string, position: Phaser.Math.Vector2) {
    const centerX = Math.floor(position.x / this.map.tileSize);
    const centerY = Math.floor(position.y / this.map.tileSize);

    return this.units.some((unit) => {
      if (unit.isDead || unit.factionId !== factionId) {
        return false;
      }

      const unitTileX = Math.floor(unit.position.x / this.map.tileSize);
      const unitTileY = Math.floor(unit.position.y / this.map.tileSize);

      return (
        Math.abs(unitTileX - centerX) <= COMBAT_OCCUPATION_RADIUS_TILES &&
        Math.abs(unitTileY - centerY) <= COMBAT_OCCUPATION_RADIUS_TILES
      );
    });
  }

  private pickFleeTarget(unit: Unit, threatPosition?: Phaser.Math.Vector2) {
    const unitPosition = unit.position;
    const threat = threatPosition ?? new Phaser.Math.Vector2(unitPosition.x - 1, unitPosition.y);
    const directionX = unitPosition.x - threat.x;
    const directionY = unitPosition.y - threat.y;
    const length = Math.max(1, Math.hypot(directionX, directionY));
    const fleeDistance = this.map.tileSize * 4;

    return this.clampToWorld(
      unitPosition.x + (directionX / length) * fleeDistance,
      unitPosition.y + (directionY / length) * fleeDistance,
    );
  }

  private updateTargetMarker() {
    const unit = this.selectedUnit ?? this.commandUnit;

    if (!this.targetMarker || !unit || unit.isDead) {
      this.targetMarker?.setVisible(false);
      return;
    }

    const target = unit.targetPosition;

    if (!target) {
      this.targetMarker.setVisible(false);
      return;
    }

    this.targetMarker.setVisible(true);
    this.targetMarker.setPosition(target.x, target.y);
  }

  private harvestResource(unit: Unit, resourceSystem: ResourceSystem) {
    if (!unit) {
      return false;
    }

    const result = resourceSystem.harvestAt(unit.position);

    if (!result) {
      return false;
    }

    if (result.depleted && result.resourceType === 'wood' && result.tile.terrainType === 'grass') {
      this.terrainDirtyFromHarvest = true;
    }

    return true;
  }

  private updateCoordinateText(pointer?: Phaser.Input.Pointer) {
    if (pointer) {
      this.hoveredWorldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    }

    this.game.events.emit(WorldScene.HUD_STATUS_EVENT, this.buildHudStatusText());
  }

  private updateUnitLabel() {
    if (!this.unitLabel || !this.selectedUnit) {
      this.unitLabel?.setVisible(false);
      return;
    }

    if (this.selectedUnit.isDead) {
      this.unitLabel.setVisible(false);
      if (this.isFollowingUnit) {
        this.isFollowingUnit = false;
        this.cameras.main.stopFollow();
      }
      return;
    }

    this.unitLabel.setVisible(true);
    this.unitLabel.setText(
      `${this.getGenderLabel(this.selectedUnit.gender)} ${this.getUnitStateLabel(this.selectedUnit.state)}\nHP ${Math.ceil(
        this.selectedUnit.hp,
      )}  体力 ${Math.ceil(this.selectedUnit.vitality)}  年龄 ${this.selectedUnit.age}`,
    );
    this.unitLabel.setPosition(this.selectedUnit.sprite.x, this.selectedUnit.sprite.y - 18);
  }

  private formatUnitStats(unit: Unit) {
    const state = unit.isDead ? '死亡' : this.getUnitStateLabel(unit.state);
    const gender = this.getGenderLabel(unit.gender);
    const factionName = this.factionManager.getFactionName(unit.factionId);

    return `单位：${gender} ${state} ${factionName}  HP ${Math.ceil(unit.hp)}/${unit.maxHp}  体力 ${Math.ceil(unit.vitality)}/${
      unit.maxVitality
    }  年龄 ${unit.age}`;
  }

  private getGenderLabel(gender: Unit['gender']) {
    return gender === 'male' ? '男' : '女';
  }

  private getUnitStateLabel(state: Unit['state']) {
    const labels: Record<Unit['state'], string> = {
      Idle: '闲置',
      Wander: '游走',
      March: '行军',
      Harvest: '采集',
      Build: '建造',
      Rest: '休息',
      Attack: '攻击',
      Flee: '逃跑',
    };

    return labels[state];
  }

  private handleUnitSelection(gameObjects: Phaser.GameObjects.GameObject[]) {
    const unit = this.units.find((candidate) => {
      return candidate.isDead === false && gameObjects.includes(candidate.sprite);
    });

    if (unit) {
      this.selectUnit(unit);
      this.followSelectedUnit();
      return true;
    }

    this.selectUnit(undefined);
    return false;
  }

  private selectUnit(unit?: Unit) {
    this.selectedUnit = unit;
    if (this.unitLabel) {
      this.unitLabel.setVisible(Boolean(unit));
    }

    if (!unit) {
      this.isFollowingUnit = false;
      this.cameras.main.stopFollow();
    }
  }

  private buildHudStatusText() {
    const camera = this.cameras.main;
    const followMode = this.isFollowingUnit ? '跟随' : '自由';
    const unitStats = this.selectedUnit ? this.formatUnitStats(this.selectedUnit) : '单位：未选中';
    const factionSummary = this.getFactionSummary();
    const population = `人口：${this.factionManager.getTotalPopulation()}`;
    const inventory = this.getFactionInventorySummary();
    const buildSummary = this.getFactionBuildSummary();
    const diplomacySummary = this.getDiplomacySummary();
    const timeScale = `速度：${this.timeScaleSystem.getLabel()}`;
    const timeSummary = `时间：${this.timeSystem.getTimeLabel()}`;
    const notice = this.getHudNotice();
    const hoverLine = this.getTileFocusLine('光标', this.hoveredWorldPoint);
    const centerLine = this.getTileFocusLine('镜头中心', camera.midPoint);
    const status = `${hoverLine}\n${centerLine}\n镜头：${followMode}  缩放 ${camera.zoom.toFixed(
      1,
    )}x  ${timeScale}\n${timeSummary}\n${factionSummary}\n${diplomacySummary}\n${population}\n${unitStats}\n${inventory}\n${buildSummary}`;

    return notice ? `${notice}\n${status}` : status;
  }

  private getHudNotice() {
    if (!this.hudNotice || this.time.now >= this.hudNoticeExpiresAt) {
      return undefined;
    }

    return this.hudNotice;
  }

  private handleDeadUnit(unit: Unit) {
    const result = this.factionManager.detachUnit(unit.id);

    if (result?.extinct) {
      this.diplomacySystem.resetRelationsForFaction(result.faction.id);
      this.hudNotice = `势力灭亡：${result.faction.name}`;
      this.hudNoticeExpiresAt = this.time.now + 5000;
    }
  }

  private syncFactionInventories() {
    for (const [factionId, runtime] of this.factionRuntimes) {
      this.factionManager.replaceFactionInventory(factionId, runtime.resourceSystem.getInventory());
    }
  }

  private syncFactionBuildDemands() {
    for (const [factionId, runtime] of this.factionRuntimes) {
      runtime.buildSystem.setPopulationDemand(this.factionManager.getFactionPopulation(factionId));
    }
  }

  private claimTerritoryForCompletedBuildings() {
    let claimedNewTerritory = false;

    for (const [factionId, runtime] of this.factionRuntimes) {
      for (const building of runtime.buildSystem.getBuildings()) {
        const territoryBuildingKey = `${factionId}:${building.id}`;

        if (
          building.status !== 'complete' ||
          this.claimedTerritoryBuildingIds.has(territoryBuildingKey)
        ) {
          continue;
        }

        this.claimedTerritoryBuildingIds.add(territoryBuildingKey);

        const result = this.territorySystem.claimAroundWorldPoint(factionId, building.position);

        if (result.claimedCount > 0) {
          claimedNewTerritory = true;
        }
      }
    }

    if (!claimedNewTerritory) {
      return;
    }

    this.syncFactionTerritoryCounts();
    this.notifyTerritoryContacts();
    this.drawTerritoryOverlay();
  }

  private syncFactionTerritoryCounts() {
    for (const faction of this.factionManager.getFactions()) {
      this.factionManager.setFactionTerritoryCount(
        faction.id,
        this.territorySystem.getTerritoryCount(faction.id),
      );
    }
  }

  private notifyTerritoryContacts() {
    const adjacentPairs = this.territorySystem.getAdjacentFactionPairs();
    const warDeclarations = this.diplomacySystem.evaluateTerritoryContacts(adjacentPairs);
    const mobilizedCount = this.warMobilizationSystem.mobilize(warDeclarations, this.units);

    if (warDeclarations.length > 0) {
      const declaration = warDeclarations[0];
      this.hudNotice = `宣战并集结：${this.factionManager.getFactionName(
        declaration.firstFactionId,
      )} / ${this.factionManager.getFactionName(declaration.secondFactionId)} (${mobilizedCount})`;
      this.hudNoticeExpiresAt = this.time.now + 5000;
    }

    for (const pair of adjacentPairs) {
      const contactKey = [pair.firstFactionId, pair.secondFactionId].sort().join('|');

      if (this.notifiedTerritoryContactKeys.has(contactKey)) {
        continue;
      }

      this.notifiedTerritoryContactKeys.add(contactKey);
      if (warDeclarations.length === 0) {
        this.hudNotice = `领土接壤：${this.factionManager.getFactionName(pair.firstFactionId)} / ${this.factionManager.getFactionName(
          pair.secondFactionId,
        )}`;
        this.hudNoticeExpiresAt = this.time.now + 5000;
      }
    }
  }

  private getTileFocusLine(label: string, worldPoint?: Phaser.Math.Vector2) {
    if (!worldPoint) {
      return `${label}：未悬停`;
    }

    const tile = this.getTileAtWorldPoint(worldPoint);

    if (!tile) {
      return `${label}：超出地图`;
    }

    const owner = tile.ownerFactionId
      ? this.factionManager.getFactionName(tile.ownerFactionId)
      : '无主';
    const terrain = TERRAIN_LABELS[tile.terrainType];

    return `${label}：${tile.x}, ${tile.y} ${terrain}  归属：${owner}`;
  }

  private getTileAtWorldPoint(worldPoint: Phaser.Math.Vector2) {
    const tileX = Phaser.Math.Clamp(
      Math.floor(worldPoint.x / this.map.tileSize),
      0,
      this.map.width - 1,
    );
    const tileY = Phaser.Math.Clamp(
      Math.floor(worldPoint.y / this.map.tileSize),
      0,
      this.map.height - 1,
    );

    return this.map.tiles[tileY * this.map.width + tileX];
  }

  private getFactionSummary() {
    const factions = this.factionManager.getFactions();

    if (factions.length === 0) {
      return '势力：无';
    }

    return factions
      .map((faction) => {
        return `势力：${faction.name} 人口${faction.population} 领土${faction.territoryCount}`;
      })
      .join('\n');
  }

  private getFactionInventorySummary() {
    return this.factionManager
      .getFactions()
      .map((faction) => {
        const inventory =
          this.factionRuntimes.get(faction.id)?.resourceSystem.getInventorySummary() ??
          '库存：粮0 木0 石0 铁0';
        return `${faction.name} ${inventory}`;
      })
      .join('\n');
  }

  private getFactionBuildSummary() {
    return this.factionManager
      .getFactions()
      .map((faction) => {
        const buildSummary =
          this.factionRuntimes.get(faction.id)?.buildSystem.getSummary() ?? '建造：等待';
        return `${faction.name} ${buildSummary}`;
      })
      .join('\n');
  }

  private getDiplomacySummary() {
    const relationLines = this.diplomacySystem.getRelationSummaryLines();

    if (relationLines.length === 0) {
      return '外交：无';
    }

    return relationLines.join('\n');
  }

  private layout = () => {
    const { width, height } = this.scale;

    this.nightOverlay?.setSize(width, height);
  };

  private updateNightOverlay() {
    if (!this.nightOverlay) {
      return;
    }

    this.nightOverlay.setAlpha(this.timeSystem.isNight() ? 0.2 : 0);
  }

  private consumeResourceDirty() {
    let hasDirtyResource = false;

    for (const runtime of this.factionRuntimes.values()) {
      hasDirtyResource = runtime.resourceSystem.consumeDirty() || hasDirtyResource;
    }

    return hasDirtyResource;
  }

  private consumeBuildDirty() {
    let hasDirtyBuild = false;

    for (const runtime of this.factionRuntimes.values()) {
      hasDirtyBuild = runtime.buildSystem.consumeDirty() || hasDirtyBuild;
    }

    return hasDirtyBuild;
  }

  private ensureFactionRuntime(factionId: string, buildPoint: Phaser.Math.Vector2) {
    const existingRuntime = this.factionRuntimes.get(factionId);

    if (existingRuntime) {
      return existingRuntime;
    }

    const resourceSystem = new ResourceSystem(this.map);
    const runtime: FactionRuntime = {
      resourceSystem,
      buildSystem: new BuildSystem(resourceSystem, buildPoint, factionId),
    };

    this.factionRuntimes.set(factionId, runtime);
    return runtime;
  }

  private getDefaultBuildPoint(capitalPosition: Phaser.Math.Vector2) {
    return new Phaser.Math.Vector2(
      capitalPosition.x + this.map.tileSize,
      capitalPosition.y + this.map.tileSize,
    );
  }

  private ensureFaction(
    factionId: string,
    race: Unit['race'],
    capitalPosition: Phaser.Math.Vector2,
    resourceSystem: ResourceSystem,
  ) {
    const existingFaction = this.factionManager.getFaction(factionId);

    if (existingFaction) {
      return existingFaction;
    }

    return this.factionManager.createFaction({
      id: factionId,
      name: FACTION_NAMES[race],
      race,
      color: FACTION_COLORS[race],
      capitalPosition,
      inventory: resourceSystem.getInventory(),
    });
  }
}
