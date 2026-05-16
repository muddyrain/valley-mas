import * as Phaser from 'phaser';
import { WORLD_SIM_SCENE_KEYS } from './sceneKeys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(WORLD_SIM_SCENE_KEYS.Boot);
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#0b1020');

    const panel = this.add.rectangle(width / 2, height / 2, 420, 160, 0x111a2e, 0.96);
    panel.setStrokeStyle(2, 0x4052a1, 0.9);

    this.add
      .text(width / 2, height / 2 - 36, 'WorldSim', {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '30px',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 8, '启动场景 -> 世界场景 -> HUD 场景', {
        color: '#9fb3c8',
        fontFamily: 'monospace',
        fontSize: '16px',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 42, '正在准备 Phaser 原型...', {
        color: '#ffcd75',
        fontFamily: 'monospace',
        fontSize: '14px',
      })
      .setOrigin(0.5);

    this.time.delayedCall(220, () => {
      this.scene.start(WORLD_SIM_SCENE_KEYS.World);
      this.scene.launch(WORLD_SIM_SCENE_KEYS.UI);
    });
  }
}
