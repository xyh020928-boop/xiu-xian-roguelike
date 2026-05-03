import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // 背景色通过 main.js 全局配置

    // 随机星点装饰
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 1);
    for (let i = 0; i < 50; i++) {
      const sx = Math.random() * WIDTH;
      const sy = Math.random() * HEIGHT;
      const sr = Math.random() * 1.5 + 0.5;
      stars.fillCircle(sx, sy, sr);
    }

    // 标题
    this.add
      .text(WIDTH / 2, 200, '问　道', {
        fontSize: '64px',
        color: '#f0c040',
        fontFamily: '"Microsoft YaHei", "SimHei", sans-serif',
      })
      .setOrigin(0.5);

    // 副标题
    this.add
      .text(WIDTH / 2, 280, '— 一苇渡江，以劫证道 —', {
        fontSize: '18px',
        color: '#a08020',
        fontFamily: '"Microsoft YaHei", "SimHei", sans-serif',
      })
      .setOrigin(0.5);

    // 开始按钮背景
    const btnWidth = 200;
    const btnHeight = 50;
    const btnX = WIDTH / 2 - btnWidth / 2;
    const btnY = 420;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x2a1a4e, 0.8);
    btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);
    btnBg.lineStyle(2, 0xf0c040, 1);
    btnBg.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);

    // 开始按钮文字
    const startText = this.add
      .text(WIDTH / 2, btnY + btnHeight / 2, '进入大厅', {
        fontSize: '28px',
        color: '#ffffff',
        fontFamily: '"Microsoft YaHei", "SimHei", sans-serif',
      })
      .setOrigin(0.5);

    // 按钮交互区域
    const btnZone = this.add
      .zone(WIDTH / 2, btnY + btnHeight / 2, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    btnZone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x3a2a5e, 0.9);
      btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);
      btnBg.lineStyle(2, 0xffdd60, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);
      startText.setColor('#f0c040');
    });

    btnZone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x2a1a4e, 0.8);
      btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);
      btnBg.lineStyle(2, 0xf0c040, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);
      startText.setColor('#ffffff');
    });

    btnZone.on('pointerdown', () => {
      this.scene.start('HallScene');
    });

    // 版本号
    this.add
      .text(WIDTH - 16, HEIGHT - 16, 'v0.0.1', {
        fontSize: '12px',
        color: '#666666',
        fontFamily: 'Arial, sans-serif',
      })
      .setOrigin(1, 1);
  }
}
