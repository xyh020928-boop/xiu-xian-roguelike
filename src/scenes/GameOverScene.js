import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import SaveManager from '../utils/SaveManager.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.result = data?.result || 'dead';
    this.earnedLingshi = data?.lingshi || 0;
    this.runKills = data?.killCount || 0;
  }

  create() {
    // ---- 累加数据写入存档 ----
    const save = this.registry.get('currentSave');
    const slotId = this.registry.get('currentSlotId');
    save.lingshi += this.earnedLingshi;
    save.totalRuns++;
    save.totalKills += this.runKills;
    SaveManager.save(slotId, save);

    // ---- 界面 ----
    const isClear = this.result === 'clear';
    this.cameras.main.setBackgroundColor(isClear ? '#0a0a2e' : '#000000');
    this.cameras.main.fadeIn(500, 0, 0, 0);

    const titleText = isClear ? '秘境已清' : '道消陨落';
    const titleColor = isClear ? '#f0c040' : '#ff3333';

    this.add.text(WIDTH / 2, 180, titleText, {
      fontSize: '72px', color: titleColor,
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subText = isClear ? '恭喜道友，此劫已渡' : '此劫未过，轮回再起';
    const subColor = isClear ? '#ffffff' : '#888888';

    this.add.text(WIDTH / 2, 260, subText, {
      fontSize: '24px', color: subColor,
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 330, `本次收获灵石：${this.earnedLingshi} 枚`, {
      fontSize: '26px', color: '#ffd700',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 380, `击杀：${this.runKills}`, {
      fontSize: '20px', color: '#aaaaaa',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 500, '3秒后返回修炼大厅，或点击屏幕立即返回', {
      fontSize: '16px', color: '#666666',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.goToHall();
    });

    this.time.delayedCall(3000, () => {
      this.goToHall();
    });
  }

  goToHall() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HallScene', {
        result: this.result,
        lingshi: this.earnedLingshi,
        killCount: this.runKills,
      });
    });
  }
}
