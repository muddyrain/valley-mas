import * as Phaser from 'phaser';
import { type SimCommand, SimLoop, SimWorld, type TerrainType, type WorldProjection } from '../sim';

const TILE_SIZE = 10;
const PANEL_COLOR = 0x101726;
const PANEL_STROKE = 0x4052a1;
const TEXT_COLOR = '#f4f4f4';
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

export class WorldScene extends Phaser.Scene {
  private world!: SimWorld;
  private loop!: SimLoop;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private unitLayer?: Phaser.GameObjects.Graphics;
  private resourceLayer?: Phaser.GameObjects.Graphics;
  private uiLayer?: Phaser.GameObjects.Graphics;
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
    this.resourceLayer = this.add.graphics();
    this.unitLayer = this.add.graphics();
    this.uiLayer = this.add.graphics();
    this.uiLayer.setScrollFactor(0);
    this.uiLayer.setDepth(20);
    this.titleText = this.createUiText(18, 14, 18);
    this.statusText = this.createUiText(18, 70, 13);
    this.controlsText = this.createUiText(18, 0, 13);
    this.eventsText = this.createUiText(0, 70, 12);

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

    this.drawResources(projection);
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

  private drawHud(projection: WorldProjection) {
    this.layoutUiPanels();
    this.titleText?.setText('WorldSim v2 基础原型');
    this.statusText?.setText(
      [
        '世界状态',
        `种子：${projection.seed}`,
        `时间：第 ${projection.tick} tick`,
        `速度：${projection.paused ? '已暂停' : `${projection.speed} 倍速`}`,
        `人口：${projection.stats.population}`,
        `食物：${projection.stats.totalFood}`,
        `食物地块：${projection.stats.foodTiles}`,
        '',
        '颜色说明',
        '白色：空闲',
        '黄色：寻找食物',
        '绿色：正在进食',
        '灰蓝：游荡',
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
    const sidePanelWidth = Math.min(340, Math.max(260, Math.floor(width * 0.26)));
    const eventsWidth = Math.min(390, Math.max(280, Math.floor(width * 0.3)));
    const bottomHeight = 74;

    this.uiLayer.clear();
    this.drawPanel(12, 10, sidePanelWidth, 46, 0.82);
    this.drawPanel(12, 62, sidePanelWidth, 255, 0.78);
    this.drawPanel(12, height - bottomHeight - 12, width - 24, bottomHeight, 0.78);
    this.drawPanel(width - eventsWidth - 12, 62, eventsWidth, 250, 0.78);

    this.titleText?.setPosition(26, 21);
    this.statusText?.setPosition(26, 78);
    this.controlsText?.setPosition(26, height - bottomHeight + 9);
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
    this.layoutUiPanels();
  };
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

  if (message.includes('ate food')) {
    return '小人正在进食';
  }

  if (message.includes('was born')) {
    return '新小人出生';
  }

  if (message.includes('died from starvation')) {
    return '小人因饥饿死亡';
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
