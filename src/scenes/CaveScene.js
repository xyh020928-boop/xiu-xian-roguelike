import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName } from '../config.js';
import { checkBreakthrough } from '../utils/helpers.js';
import SaveManager from '../utils/SaveManager.js';
import PauseMenu from '../ui/PauseMenu.js';

export default class CaveScene extends Phaser.Scene {
  constructor() {
    super('CaveScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0d1a');
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');
    this._breakthroughShowing = false;

    // ============ 背景光点 ============
    for (let i = 0; i < 35; i++) {
      const dot = this.add.circle(
        Math.random() * WIDTH, Math.random() * HEIGHT,
        Math.random() * 1.5 + 0.8, 0x6666aa, 0.3
      ).setDepth(0);
      this.tweens.add({
        targets: dot, alpha: { from: 0.05, to: 0.45 },
        duration: 2000 + Math.random() * 4000, yoyo: true, repeat: -1,
        delay: Math.random() * 3000,
      });
    }

    // ============ 顶部 ============
    this.createTopBar();

    // ============ 按钮 ============
    this.createNavButtons();

    // ============ 底部返回 ============
    this.createBackButton();

    this.refreshAll();

    // 自动保存（30秒）
    this.autoSaveTimer = this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => {
        const s = this.registry.get('currentSave');
        const sid = this.registry.get('currentSlotId');
        if (s && sid >= 0) {
          s.playtime = (s.playtime || 0) + 30;
          SaveManager.save(sid, s);
          this.showAutoSaveHint();
        }
      },
    });

    // 暂停菜单
    this.pauseMenu = new PauseMenu(this, { sceneName: '洞府' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
    });
  }

  // ==================== 顶部栏 ====================
  createTopBar() {
    this.add.text(WIDTH / 2, 28, '洞　府', {
      fontSize: '38px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.realmText = this.add.text(WIDTH / 2, 64, '', {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    this.xiuweiBarBg = this.add.graphics();
    this.xiuweiBarFg = this.add.graphics();

    this.xiuweiText = this.add.text(WIDTH / 2, 102, '', {
      fontSize: '13px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
  }

  // ==================== 导航按钮 ====================
  createNavButtons() {
    const btnW = 480, btnH = 110;
    const btnX = WIDTH / 2 - btnW / 2;
    const gap = 30;
    const startY = 160;

    // ---- 静心修炼 ----
    this.createNavCard(
      btnX, startY, btnW, btnH,
      '静心修炼',
      '闭目凝神，以时换为',
      '修炼速度：10 修为 / 分钟',
      '#88aaff',
      () => this.scene.start('MeditateScene'),
    );

    // ---- 淬炼心境 ----
    this.createNavCard(
      btnX, startY + btnH + gap, btnW, btnH,
      '淬炼心境',
      '以心御道，消行证道',
      '手动修炼效率更高',
      '#ff9944',
      () => this.scene.start('TetrisScene'),
    );
  }

  createNavCard(x, y, w, h, title, subtitle, info, accentColor, onClick) {
    // 面板背景
    const bg = this.add.graphics();
    const drawBg = (fill, stroke) => {
      bg.clear();
      bg.fillStyle(fill, 0.7);
      bg.fillRoundedRect(x, y, w, h, 12);
      bg.lineStyle(2, stroke);
      bg.strokeRoundedRect(x, y, w, h, 12);
    };
    drawBg(0x111122, 0x333366);

    // 标题
    this.add.text(x + 30, y + 22, title, {
      fontSize: '26px', color: accentColor,
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    });

    // 副标题
    this.add.text(x + 30, y + 56, subtitle, {
      fontSize: '14px', color: '#777788',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 信息行
    this.add.text(x + 30, y + 80, info, {
      fontSize: '13px', color: '#555566',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 右侧箭头
    this.add.text(x + w - 40, y + h / 2, '▶', {
      fontSize: '28px', color: accentColor,
      fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    // 交互区域
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBg(0x1a1a33, 0x5555aa));
    zone.on('pointerout', () => drawBg(0x111122, 0x333366));
    zone.on('pointerdown', onClick);
  }

  // ==================== 返回大厅 ====================
  createBackButton() {
    const btnW = 180, btnH = 48;
    const btnX = WIDTH / 2 - btnW / 2;
    const btnY = HEIGHT - 90;

    const gfx = this.add.graphics();
    const draw = (fill, stroke) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.8);
      gfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      gfx.lineStyle(2, stroke);
      gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    };
    draw(0x1a1a2e, 0x664422);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '返回大厅', {
      fontSize: '20px', color: '#cccccc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x2a2a3e, 0x886644));
    zone.on('pointerout', () => draw(0x1a1a2e, 0x664422));
    zone.on('pointerdown', () => {
      this.scene.start('HallScene');
    });
  }

  // ==================== 刷新 ====================
  refreshAll() {
    this.realmText.setText(`境界：${getRealmName(this.save.majorRealmIndex, this.save.layer)}`);
    this.drawXiuweiBar();
    this.xiuweiText.setText(`修为：${this.save.xiuwei} / ${this.save.xiuweiMax}`);
    checkBreakthrough(this, this.save, this.slotId, () => this.refreshAll());
  }

  showAutoSaveHint() {
    const hint = this.add.text(WIDTH - 20, HEIGHT - 20, '✦ 已自动保存', {
      fontSize: '12px', color: '#aaaaaa',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 1).setDepth(2000);
    this.tweens.add({
      targets: hint, alpha: 0, delay: 2000, duration: 500,
      onComplete: () => hint.destroy(),
    });
  }

  drawXiuweiBar() {
    this.xiuweiBarBg.clear();
    this.xiuweiBarFg.clear();
    const barX = WIDTH / 2 - 160, barY = 82, barW = 320, barH = 12;
    const ratio = Math.min(1, Math.max(0, this.save.xiuwei / this.save.xiuweiMax));
    this.xiuweiBarBg.fillStyle(0x222244);
    this.xiuweiBarBg.fillRoundedRect(barX, barY, barW, barH, 6);
    if (ratio > 0) {
      this.xiuweiBarFg.fillStyle(0x8844ff);
      this.xiuweiBarFg.fillRoundedRect(barX, barY, Math.floor(barW * ratio), barH, 6);
    }
  }
}
