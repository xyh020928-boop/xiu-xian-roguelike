import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add
      .text(WIDTH / 2, HEIGHT / 2, '正在加载...', {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
      })
      .setOrigin(0.5);

    // 初始化全局存档状态
    this.registry.set('currentSave', null);
    this.registry.set('currentSlotId', -1);

    this.time.delayedCall(500, () => {
      this.scene.start('SaveSelectScene');
    });
  }
}
