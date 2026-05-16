import * as Phaser from 'phaser';
import { WORLD_SIM_SCENE_KEYS } from './sceneKeys';

export class UIScene extends Phaser.Scene {
  private static readonly HUD_STATUS_EVENT = 'world-sim:hud-status';

  private topBar?: Phaser.GameObjects.Rectangle;
  private footerBar?: Phaser.GameObjects.Rectangle;
  private statusPanel?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private helpText?: Phaser.GameObjects.Text;

  constructor() {
    super(WORLD_SIM_SCENE_KEYS.UI);
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0, 0, 0, 0)');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.topBar = this.add.rectangle(0, 0, 1, 32, 0x0e1528, 0.9).setOrigin(0, 0);
    this.footerBar = this.add.rectangle(0, 0, 1, 28, 0x0e1528, 0.75).setOrigin(0, 1);
    this.statusPanel = this.add.rectangle(12, 42, 310, 128, 0x0e1528, 0.82).setOrigin(0, 0);
    this.statusPanel.setStrokeStyle(1, 0x4052a1, 0.82);

    this.titleText = this.add.text(12, 8, 'WorldSim / M0 瓦片地图', {
      color: '#ffcd75',
      fontFamily: 'monospace',
      fontSize: '13px',
    });

    this.statusText = this.add.text(
      22,
      50,
      '光标：--\n镜头中心：--\n镜头：--\n势力：--\n单位：未选中\n库存：粮0 木0 石0 铁0\n建造：等待',
      {
        color: '#ffcd75',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineSpacing: 4,
      },
    );

    this.helpText = this.add.text(
      12,
      0,
      '左键：选中单位    右键/中键：平移    滚轮：缩放    F：跟随/自由镜头',
      {
        color: '#94b0c2',
        fontFamily: 'monospace',
        fontSize: '12px',
      },
    );

    this.game.events.on(UIScene.HUD_STATUS_EVENT, this.handleHudStatus, this);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
  }

  shutdown() {
    this.game.events.off(UIScene.HUD_STATUS_EVENT, this.handleHudStatus, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.topBar?.destroy();
    this.footerBar?.destroy();
    this.statusPanel?.destroy();
    this.titleText?.destroy();
    this.statusText?.destroy();
    this.helpText?.destroy();
    this.topBar = undefined;
    this.footerBar = undefined;
    this.statusPanel = undefined;
    this.titleText = undefined;
    this.statusText = undefined;
    this.helpText = undefined;
  }

  private handleHudStatus(status: string) {
    this.statusText?.setText(status);
  }

  private layout = () => {
    const { width, height } = this.scale;

    this.topBar?.setSize(width, 32);
    this.footerBar?.setSize(width, 28);
    this.footerBar?.setPosition(0, height);

    this.titleText?.setPosition(12, 8);
    this.statusPanel?.setPosition(12, 42);
    this.statusText?.setPosition(22, 50);
    this.helpText?.setPosition(12, height - 20);
  };
}
