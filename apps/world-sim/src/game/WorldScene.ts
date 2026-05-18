import * as Phaser from 'phaser';
import { type SimCommand, SimLoop, SimWorld, type TerrainType, type WorldProjection } from '../sim';

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
  hut: 0xc2c3c7,
  storage: 0xffcd75,
  farm: 0x99e550,
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
  private uiLayer?: Phaser.GameObjects.Graphics;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private titleText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private controlsText?: Phaser.GameObjects.Text;
  private eventsText?: Phaser.GameObjects.Text;
  private commandSequence = 1;
  private lastTerrainDrawKey = '';

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

    this.terrainLayer = this.add.graphics();
    this.territoryLayer = this.add.graphics();
    this.resourceLayer = this.add.graphics();
    this.buildingLayer = this.add.graphics();
    this.armyLayer = this.add.graphics();
    this.unitLayer = this.add.graphics();
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

    this.renderProjection(this.world.project());
  }

  update(_time: number, delta: number) {
    this.loop.advance(delta);
    this.renderProjection(this.world.project());
  }

  private shutdown() {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    window.removeEventListener('keydown', this.handleKeyDown);
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
      if (tile.resource?.type !== 'food' || tile.resource.amount <= 0) {
        continue;
      }

      this.resourceLayer.fillStyle(0xffcd75, 0.95);
      this.resourceLayer.fillCircle(
        tile.x * TILE_SIZE + TILE_SIZE / 2,
        tile.y * TILE_SIZE + TILE_SIZE / 2,
        2,
      );
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
      const alpha = kingdom ? 0.22 : 0.08;

      this.territoryLayer.fillStyle(color, alpha);
      this.territoryLayer.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
        building.status === 'active' ? 0.95 : building.status === 'abandoned' ? 0.38 : 0.22;

      this.buildingLayer.fillStyle(color, alpha);

      if (building.type === 'farm') {
        this.buildingLayer.fillCircle(x, y, 5);
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

  private drawHud(projection: WorldProjection) {
    this.layoutUiPanels();
    const leadingKingdom = projection.kingdoms
      .filter((kingdom) => kingdom.status !== 'fallen')
      .sort((a, b) => b.population - a.population)[0];

    this.titleText?.setText('WorldSim v2 基础原型');
    this.statusText?.setText(
      [
        '世界状态',
        `种子：${projection.seed}`,
        `时间：第 ${projection.tick} tick`,
        `速度：${projection.paused ? '已暂停' : `${projection.speed} 倍速`}`,
        `人口：${projection.stats.population}`,
        `村庄：${projection.stats.villages}`,
        `王国：${projection.stats.kingdoms} / 陨落 ${projection.stats.fallenKingdoms}`,
        `最大王国：${leadingKingdom ? `${leadingKingdom.population} 人` : '无'}`,
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
        '左键：投放食物',
        'Shift + 左键：召唤 4 个小人',
        'Alt + 左键：闪电打击',
        '滚轮：缩放地图',
        '1 / 2 / 4：调整速度',
        '0 或 P：暂停 / 恢复',
        'F / G / W：将镜头中心改成森林 / 草地 / 水域',
      ].join('    '),
    );
    this.eventsText?.setText(
      [
        '最近事件',
        '',
        ...projection.recentEvents
          .slice(-8)
          .map((event) => `第 ${event.tick} tick：${translateEvent(event.message)}`),
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

    this.issue({
      type: 'place_resource',
      payload: { resourceType: 'food', position, amount: 20, radius: 2 },
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

  private getTerrainDrawKey(projection: WorldProjection) {
    return `${projection.tick}:${
      projection.tiles.filter(
        (tile) => tile.terrain === 'water' || tile.terrain === 'forest' || tile.terrain === 'lava',
      ).length
    }`;
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
