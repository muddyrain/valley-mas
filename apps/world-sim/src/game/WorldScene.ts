import * as Phaser from 'phaser';
import { type SimCommand, SimLoop, SimWorld, type TerrainType, type WorldProjection } from '../sim';
import {
  buildInspectionLines,
  buildMapLabels,
  buildTerritoryBorderSegments,
  filterEventsForSelection,
  formatEventSummary,
  selectNextKingdom,
  selectWorldEntity,
  type WorldSelection,
} from './inspection';

const TILE_SIZE = 10;
const PANEL_COLOR = 0x101726;
const PANEL_STROKE = 0x4052a1;
const TEXT_COLOR = '#f4f4f4';
const UI_MARGIN = 12;
const TITLE_PANEL_HEIGHT = 46;
const BOTTOM_PANEL_HEIGHT = 74;
const STATUS_PANEL_TOP = 62;
const EVENTS_PANEL_TOP = 62;
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
  farm: 0x99e550,
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

export class WorldScene extends Phaser.Scene {
  private world!: SimWorld;
  private loop!: SimLoop;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private territoryLayer?: Phaser.GameObjects.Graphics;
  private unitLayer?: Phaser.GameObjects.Graphics;
  private armyLayer?: Phaser.GameObjects.Graphics;
  private buildingLayer?: Phaser.GameObjects.Graphics;
  private resourceLayer?: Phaser.GameObjects.Graphics;
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
  private selection: WorldSelection = { type: 'none' };

  constructor() {
    super('world');
  }

  create() {
    this.world = new SimWorld({
      seed: 'worldsim-v2-demo',
      initialUnits: 32,
    });
    this.loop = new SimLoop(this.world);

    this.cameras.main.setBounds(
      0,
      0,
      this.world.map.width * TILE_SIZE,
      this.world.map.height * TILE_SIZE,
    );
    this.cameras.main.centerOn(
      (this.world.map.width * TILE_SIZE) / 2,
      (this.world.map.height * TILE_SIZE) / 2,
    );
    this.cameras.main.setZoom(1);
    this.cameras.main.roundPixels = true;

    this.terrainLayer = this.add.graphics();
    this.territoryLayer = this.add.graphics();
    this.resourceLayer = this.add.graphics();
    this.buildingLayer = this.add.graphics();
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

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.addEventListener('keydown', this.handleKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.renderProjection(this.projectVisibleWorld());
  }

  update(_time: number, delta: number) {
    this.loop.advance(delta);
    this.renderProjection(this.projectVisibleWorld());
  }

  private shutdown() {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.clearMapLabels();
  }

  private renderProjection(projection: WorldProjection) {
    const terrainDrawKey = this.getTerrainDrawKey(projection);

    if (terrainDrawKey !== this.lastTerrainDrawKey) {
      this.drawTerrain(projection);
      this.lastTerrainDrawKey = terrainDrawKey;
    }

    this.drawTerritory(projection);
    this.drawResources(projection);
    this.drawBuildings(projection);
    this.drawArmies(projection);
    this.drawUnits(projection);
    this.drawSelection(projection);
    this.drawMapLabels(projection);
    this.drawHud(projection);
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

  private drawResources(projection: WorldProjection) {
    if (!this.resourceLayer) {
      return;
    }

    this.resourceLayer.clear();

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
      const alpha = selected ? 0.34 : kingdom ? 0.22 : 0.08;

      this.territoryLayer.fillStyle(color, alpha);
      this.territoryLayer.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    const borderSegments = buildTerritoryBorderSegments(projection, this.selection);

    for (const segment of borderSegments) {
      this.territoryLayer.lineStyle(
        segment.selected ? 2 : 1,
        segment.selected ? 0xf4f4f4 : segment.color,
        segment.selected ? 0.95 : 0.72,
      );
      this.territoryLayer.beginPath();
      this.territoryLayer.moveTo(segment.x1 * TILE_SIZE, segment.y1 * TILE_SIZE);
      this.territoryLayer.lineTo(segment.x2 * TILE_SIZE, segment.y2 * TILE_SIZE);
      this.territoryLayer.strokePath();
    }
  }

  private drawUnits(projection: WorldProjection) {
    if (!this.unitLayer) {
      return;
    }

    this.unitLayer.clear();

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

  private drawBuildings(projection: WorldProjection) {
    if (!this.buildingLayer) {
      return;
    }

    this.buildingLayer.clear();

    for (const building of projection.buildings) {
      const color = BUILDING_COLORS[building.type];
      const x = building.position.x * TILE_SIZE;
      const y = building.position.y * TILE_SIZE;
      const alpha =
        building.status === 'active'
          ? 0.95
          : building.status === 'constructing'
            ? 0.58
            : building.status === 'abandoned'
              ? 0.38
              : 0.22;

      this.buildingLayer.fillStyle(color, alpha);

      if (building.type === 'farm') {
        this.buildingLayer.fillCircle(x, y, 5);
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
    }
  }

  private drawArmies(projection: WorldProjection) {
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

    this.titleText?.setText('世界模拟器 v2 基础原型');
    this.statusText?.setText(
      [
        '世界状态',
        `种子：${projection.seed}`,
        `时间：第 ${projection.tick} 刻`,
        `速度：${projection.paused ? '已暂停' : `${projection.speed} 倍速`}`,
        `人口：${projection.stats.population}`,
        `村庄：${projection.stats.villages}`,
        `王国：${projection.stats.kingdoms} / 陨落 ${projection.stats.fallenKingdoms}`,
        `最大王国：${leadingKingdom ? `${leadingKingdom.population} 人` : '无'}`,
        '王国列表',
        ...(activeKingdoms.length > 0
          ? activeKingdoms
              .slice(0, 4)
              .map(
                (kingdom) =>
                  `${kingdom.id}：${kingdom.population} 人 / ${kingdom.villageIds.length} 村`,
              )
          : ['无活跃王国']),
        `军队：${projection.stats.activeArmies}`,
        `建筑：${projection.stats.activeBuildings} 有效 / ${projection.stats.abandonedBuildings} 废弃`,
        `领土：${projection.stats.territoryTiles}`,
        `住房：${projection.stats.housingCapacity}`,
        `村庄库存：${projection.stats.totalVillageFood}`,
        `食物：${projection.stats.totalFood}`,
        `食物地块：${projection.stats.foodTiles}`,
        '',
        '颜色说明',
        '白色：空闲',
        '黄色：寻找食物',
        '绿色：正在进食',
        '灰蓝：游荡',
        '方块/圆点：建筑',
        '王国色块：领土',
        '同色三角：军队',
      ].join('\n'),
    );
    this.controlsText?.setText(
      [
        '操作',
        '左键：选择实体 / 地块',
        '按住控制键 + 左键：投放食物',
        '按住上档键 + 左键：召唤 4 个小人',
        '按住替代键 + 左键：闪电打击',
        '滚轮：缩放地图',
        '1 / 2 / 4 键：调整速度',
        'K 键：循环选择王国',
        '0 或 P 键：暂停 / 恢复',
        'F / G / W 键：将镜头中心改成森林 / 草地 / 水域',
      ].join('    '),
    );
    const storyEvents = filterEventsForSelection(projection, this.selection).slice(-8);
    this.eventsText?.setText(
      [
        ...buildInspectionLines(projection, this.selection),
        '',
        this.selection.type === 'none' || this.selection.type === 'tile' ? '最近事件' : '相关事件',
        '',
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
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    camera.setZoom(Phaser.Math.Clamp(camera.zoom + (deltaY > 0 ? -0.1 : 0.1), 0.5, 3));
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

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

    const center = this.cameras.main.midPoint;
    const position = {
      x: Math.floor(center.x / TILE_SIZE),
      y: Math.floor(center.y / TILE_SIZE),
    };

    if (key === 'f' || key === 'g' || key === 'w') {
      this.issue({
        type: 'change_terrain',
        payload: {
          terrain: key === 'f' ? 'forest' : key === 'w' ? 'water' : 'grass',
          position,
          radius: 4,
        },
      });
    }
  };

  private issue(command: Omit<SimCommand, 'id' | 'issuedAtTick'>) {
    this.world.enqueue({
      ...command,
      id: `cmd-${String(this.commandSequence).padStart(5, '0')}`,
      issuedAtTick: this.world.currentTick,
    } as SimCommand);
    this.commandSequence += 1;
  }

  private projectVisibleWorld() {
    const view = this.cameras.main.worldView;

    return this.world.project({
      viewport: {
        x: view.x / TILE_SIZE,
        y: view.y / TILE_SIZE,
        width: view.width / TILE_SIZE,
        height: view.height / TILE_SIZE,
        paddingTiles: 3,
      },
    });
  }

  private getTerrainDrawKey(projection: WorldProjection) {
    const viewport = projection.viewport;

    if (!viewport) {
      return `full:${projection.terrainRevision}`;
    }

    return [
      projection.terrainRevision,
      Math.floor(viewport.x),
      Math.floor(viewport.y),
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
      viewport.paddingTiles ?? 0,
    ].join(':');
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
    const sidePanelWidth = Math.min(compact ? 320 : 430, Math.max(280, Math.floor(width * 0.3)));
    const eventsWidth = Math.min(compact ? 350 : 430, Math.max(280, Math.floor(width * 0.3)));
    const bottomHeight = compact ? 88 : BOTTOM_PANEL_HEIGHT;
    const statusPanelHeight = Math.max(
      320,
      Math.min(height - STATUS_PANEL_TOP - bottomHeight - UI_MARGIN * 3, compact ? 440 : 560),
    );
    const eventsPanelHeight = Math.max(
      220,
      Math.min(height - EVENTS_PANEL_TOP - bottomHeight - UI_MARGIN * 3, compact ? 300 : 360),
    );

    this.uiLayer.clear();
    this.drawPanel(UI_MARGIN, 10, sidePanelWidth, TITLE_PANEL_HEIGHT, 0.82);
    this.drawPanel(UI_MARGIN, STATUS_PANEL_TOP, sidePanelWidth, statusPanelHeight, 0.78);
    this.drawPanel(
      UI_MARGIN,
      height - bottomHeight - UI_MARGIN,
      width - UI_MARGIN * 2,
      bottomHeight,
      0.78,
    );
    this.drawPanel(
      width - eventsWidth - UI_MARGIN,
      EVENTS_PANEL_TOP,
      eventsWidth,
      eventsPanelHeight,
      0.78,
    );

    this.titleText?.setPosition(26, 21);
    this.statusText?.setPosition(26, 78);
    this.statusText?.setWordWrapWidth(sidePanelWidth - 28);
    this.controlsText?.setPosition(26, height - bottomHeight + (compact ? 8 : 9));
    this.controlsText?.setWordWrapWidth(width - 52);
    this.eventsText?.setPosition(width - eventsWidth + 4, 78);
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
    this.uiCamera?.setSize(this.scale.width, this.scale.height);
    this.layoutUiPanels();
  };

  private setupUiCamera() {
    const worldObjects: Array<Phaser.GameObjects.GameObject | undefined> = [
      this.terrainLayer,
      this.territoryLayer,
      this.resourceLayer,
      this.buildingLayer,
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
