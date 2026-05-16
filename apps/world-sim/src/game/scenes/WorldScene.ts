import * as Phaser from 'phaser';
import { Unit } from '../../agent/Unit';
import { BUILDING_DEFS } from '../../config/buildings';
import { FactionManager } from '../../faction/FactionManager';
import { createM1StarterFactions, HUMAN_FACTION_ID } from '../../faction/starterFactions';
import { TerritorySystem } from '../../faction/TerritorySystem';
import { BuildSystem } from '../../systems/BuildSystem';
import { type ReproductionBirth, ReproductionSystem } from '../../systems/ReproductionSystem';
import { ResourceSystem } from '../../systems/ResourceSystem';
import {
  createTestWorldMap,
  type ResourceType,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
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
  private readonly factionRuntimes = new Map<string, FactionRuntime>();
  private units: Unit[] = [];
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private territoryGraphics?: Phaser.GameObjects.Graphics;
  private overlayGraphics?: Phaser.GameObjects.Graphics;
  private buildingGraphics?: Phaser.GameObjects.Graphics;
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

  constructor() {
    super(WORLD_SIM_SCENE_KEYS.World);
    this.factionManager = new FactionManager();
    this.territorySystem = new TerritorySystem(this.map);
    this.reproductionSystem = new ReproductionSystem({
      canAffordBirth: (factionId: string) =>
        (this.factionRuntimes.get(factionId)?.resourceSystem.getInventory().food ?? 0) > 20,
      spendBirthCost: (factionId: string) =>
        this.factionRuntimes.get(factionId)?.resourceSystem.spend({ food: 20 }) ?? false,
    });
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

    this.mapGraphics = this.add.graphics();
    this.territoryGraphics = this.add.graphics();
    this.buildingGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.mapGraphics.setDepth(0);
    this.territoryGraphics.setDepth(2);
    this.buildingGraphics.setDepth(5);
    this.overlayGraphics.setDepth(10);

    this.drawMap();
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
    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.DOWN, this.handleKeyDown, this);
  }

  update(_time: number, delta: number) {
    for (const unit of this.units) {
      unit.update(delta);
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

    for (const birth of this.reproductionSystem.update(delta, this.units)) {
      this.units.push(this.spawnBirthUnit(birth));
    }

    if (this.consumeResourceDirty()) {
      this.syncFactionInventories();
      this.drawMap();
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
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.DOWN, this.handleKeyDown, this);

    this.mapGraphics?.destroy();
    this.mapGraphics = undefined;
    this.territoryGraphics?.destroy();
    this.territoryGraphics = undefined;
    this.overlayGraphics?.destroy();
    this.overlayGraphics = undefined;
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

  private drawMap() {
    if (!this.mapGraphics) {
      return;
    }

    this.mapGraphics.clear();

    for (const tile of this.map.tiles) {
      const color = TERRAIN_COLORS[tile.terrainType];

      this.mapGraphics.fillStyle(color, 1);
      this.mapGraphics.fillRect(
        tile.x * this.map.tileSize,
        tile.y * this.map.tileSize,
        this.map.tileSize,
        this.map.tileSize,
      );

      if (tile.resourceType && tile.resourceAmount > 0) {
        this.drawResourceIcon(
          tile.x * this.map.tileSize,
          tile.y * this.map.tileSize,
          tile.resourceType,
        );
      }
    }

    this.mapGraphics.lineStyle(1, 0x1a1c2c, 0.18);

    for (let x = 0; x <= this.map.width; x += 1) {
      const worldX = x * this.map.tileSize;
      this.mapGraphics.lineBetween(worldX, 0, worldX, this.map.height * this.map.tileSize);
    }

    for (let y = 0; y <= this.map.height; y += 1) {
      const worldY = y * this.map.tileSize;
      this.mapGraphics.lineBetween(0, worldY, this.map.width * this.map.tileSize, worldY);
    }
  }

  private drawResourceIcon(x: number, y: number, resourceType: ResourceType) {
    if (!this.mapGraphics) {
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
    if (!this.mapGraphics) {
      return;
    }

    this.mapGraphics.fillStyle(0x1a1c2c, 0.45);
    this.mapGraphics.fillRect(x + 5, y + 5, 7, 9);
    this.mapGraphics.fillStyle(0x8f563b, 1);
    this.mapGraphics.fillRect(x + 7, y + 8, 3, 6);
    this.mapGraphics.fillStyle(0x38b764, 1);
    this.mapGraphics.fillRect(x + 5, y + 3, 7, 4);
    this.mapGraphics.fillStyle(0x257179, 1);
    this.mapGraphics.fillRect(x + 4, y + 6, 9, 4);
    this.mapGraphics.fillStyle(0x99e550, 0.95);
    this.mapGraphics.fillRect(x + 7, y + 4, 3, 2);
  }

  private drawStoneIcon(x: number, y: number) {
    if (!this.mapGraphics) {
      return;
    }

    this.mapGraphics.fillStyle(0x1a1c2c, 0.45);
    this.mapGraphics.fillRect(x + 3, y + 8, 10, 5);
    this.mapGraphics.fillStyle(0x333c57, 1);
    this.mapGraphics.fillRect(x + 4, y + 8, 4, 4);
    this.mapGraphics.fillRect(x + 9, y + 7, 4, 5);
    this.mapGraphics.fillStyle(0x566c86, 1);
    this.mapGraphics.fillRect(x + 5, y + 7, 4, 4);
    this.mapGraphics.fillRect(x + 8, y + 9, 5, 3);
    this.mapGraphics.fillStyle(0x94b0c2, 0.95);
    this.mapGraphics.fillRect(x + 6, y + 8, 2, 1);
    this.mapGraphics.fillRect(x + 10, y + 9, 2, 1);
  }

  private drawIronIcon(x: number, y: number) {
    if (!this.mapGraphics) {
      return;
    }

    this.drawStoneIcon(x, y);
    this.mapGraphics.fillStyle(0xb13e53, 1);
    this.mapGraphics.fillRect(x + 6, y + 9, 2, 2);
    this.mapGraphics.fillStyle(0xef7d57, 1);
    this.mapGraphics.fillRect(x + 10, y + 8, 2, 2);
    this.mapGraphics.fillStyle(0xffcd75, 0.95);
    this.mapGraphics.fillRect(x + 11, y + 8, 1, 1);
  }

  private drawFoodIcon(x: number, y: number) {
    if (!this.mapGraphics) {
      return;
    }

    this.mapGraphics.fillStyle(0x1a1c2c, 0.35);
    this.mapGraphics.fillRect(x + 4, y + 5, 8, 8);
    this.mapGraphics.fillStyle(0x5d9e4f, 1);
    this.mapGraphics.fillRect(x + 7, y + 8, 2, 5);
    this.mapGraphics.fillRect(x + 5, y + 10, 2, 2);
    this.mapGraphics.fillRect(x + 9, y + 10, 2, 2);
    this.mapGraphics.fillStyle(0xffcd75, 1);
    this.mapGraphics.fillRect(x + 7, y + 5, 2, 2);
    this.mapGraphics.fillRect(x + 6, y + 7, 2, 2);
    this.mapGraphics.fillRect(x + 9, y + 7, 2, 2);
    this.mapGraphics.fillStyle(0xb13e53, 1);
    this.mapGraphics.fillRect(x + 5, y + 8, 2, 2);
    this.mapGraphics.fillRect(x + 10, y + 8, 2, 2);
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

    this.buildingGraphics.fillStyle(0x1a1c2c, 0.55);
    this.buildingGraphics.fillRect(x + 2, y + 7, 12, 7);
    this.buildingGraphics.lineStyle(1, 0xffcd75, 0.9);
    this.buildingGraphics.strokeRect(x + 2, y + 7, 12, 7);
    this.buildingGraphics.lineStyle(1, 0xc0a080, 0.9);
    this.buildingGraphics.lineBetween(x + 3, y + 5, x + 13, y + 12);
    this.buildingGraphics.lineBetween(x + 13, y + 5, x + 3, y + 12);

    const progressWidth = ((this.map.tileSize - 4) * progress) / progressRequired;

    this.buildingGraphics.fillStyle(0x4052a1, 0.9);
    this.buildingGraphics.fillRect(x + 2, y + this.map.tileSize - 3, this.map.tileSize - 4, 2);
    this.buildingGraphics.fillStyle(0xffcd75, 1);
    this.buildingGraphics.fillRect(x + 2, y + this.map.tileSize - 3, progressWidth, 2);
  }

  private drawHut(position: Phaser.Math.Vector2) {
    if (!this.buildingGraphics) {
      return;
    }

    const x = position.x - this.map.tileSize / 2;
    const y = position.y - this.map.tileSize / 2;

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
        runtime.resourceSystem.findNearestHarvestTarget(unit?.position ?? spawnPosition),
      harvestResource: () => this.harvestResource(unit, runtime.resourceSystem),
      hasBuildTask: () => runtime.buildSystem.hasBuildTask(),
      pickBuildTarget: () => runtime.buildSystem.getBuildTarget(),
      buildAtTarget: (deltaMs: number) =>
        runtime.buildSystem.buildAt(unit?.position ?? spawnPosition, deltaMs),
      restPoint: spec.restPoint
        ? new Phaser.Math.Vector2(spec.restPoint.x, spec.restPoint.y)
        : faction.capitalPosition,
      shouldHarvest: () =>
        runtime.resourceSystem.needsHarvest() &&
        runtime.resourceSystem.hasHarvestableResource(
          runtime.resourceSystem.getHarvestPriorityTypes(),
        ),
    });
    unit.sprite.setInteractive({ useHandCursor: true });
    this.factionManager.attachUnit(unit.id, faction.id);

    if (spec.id.startsWith('birth-')) {
      unit.sprite.setAlpha(0);
      unit.sprite.setScale(0.25);
      this.tweens.add({
        targets: unit.sprite,
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

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key.toLowerCase() !== 'f') {
      return;
    }

    if (this.isFollowingUnit) {
      this.isFollowingUnit = false;
      this.cameras.main.stopFollow();
      return;
    }

    this.followSelectedUnit();
  }

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
    const notice = this.getHudNotice();
    const hoverLine = this.getTileFocusLine('光标', this.hoveredWorldPoint);
    const centerLine = this.getTileFocusLine('镜头中心', camera.midPoint);
    const status = `${hoverLine}\n${centerLine}\n镜头：${followMode}  缩放 ${camera.zoom.toFixed(
      1,
    )}x\n${factionSummary}\n${population}\n${unitStats}\n${inventory}\n${buildSummary}`;

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
      this.hudNotice = `势力灭亡：${result.faction.name}`;
      this.hudNoticeExpiresAt = this.time.now + 5000;
    }
  }

  private syncFactionInventories() {
    for (const [factionId, runtime] of this.factionRuntimes) {
      this.factionManager.replaceFactionInventory(factionId, runtime.resourceSystem.getInventory());
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
    for (const pair of this.territorySystem.getAdjacentFactionPairs()) {
      const contactKey = [pair.firstFactionId, pair.secondFactionId].sort().join('|');

      if (this.notifiedTerritoryContactKeys.has(contactKey)) {
        continue;
      }

      this.notifiedTerritoryContactKeys.add(contactKey);
      this.hudNotice = `领土接壤：${this.factionManager.getFactionName(pair.firstFactionId)} / ${this.factionManager.getFactionName(
        pair.secondFactionId,
      )}`;
      this.hudNoticeExpiresAt = this.time.now + 5000;
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
      buildSystem: new BuildSystem(resourceSystem, buildPoint),
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
