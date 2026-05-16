import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

export type WorldSimGameOptions = {
  parent: string | HTMLElement;
};

export class WorldSimGame {
  readonly instance: Phaser.Game;

  constructor(options: WorldSimGameOptions) {
    this.instance = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: options.parent,
      backgroundColor: '#0b1020',
      disableContextMenu: true,
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scene: [BootScene, WorldScene, UIScene],
    });
  }

  destroy() {
    this.instance.destroy(true);
  }
}
