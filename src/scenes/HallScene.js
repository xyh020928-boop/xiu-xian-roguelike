import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName } from '../config.js';
import { loadSave, saveSave, UPGRADE_CONFIG, upgradeCost } from '../utils/helpers.js';
import PauseMenu from '../ui/PauseMenu.js';

export default class HallScene extends Phaser.Scene {
  constructor() {
    super('HallScene');
  }

  init(data) {
    this.lastResult = data?.result || null;
    this.lastLingshi = data?.lingshi || 0;
    this.lastKills = data?.killCount || 0;
  }

  create() {
    // 读取存档
    this.save = loadSave();

    // ---- 背景星空 ----
    this.cameras.main.setBackgroundColor('#1a0a2e');
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 1);
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * WIDTH;
      const sy = Math.random() * HEIGHT;
      stars.fillCircle(sx, sy, Math.random() * 1.5 + 0.5);
    }

    // ---- 左上角标题 ----
    this.add.text(40, 24, '修炼大厅', {
      fontSize: '36px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    });

    // ---- 右上角货币（单行：仙玉在前，灵石在后） ----
    this.currencyLine = this.add.text(WIDTH - 20, 20, '', {
      fontSize: '18px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 0);

    // ---- 右上角境界（货币下方） ----
    this.realmText = this.add.text(WIDTH - 20, 42, '', {
      fontSize: '16px', color: '#44ccff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 0);

    // ---- 左下角测试按钮：获得10仙玉 ----
    const testBtnW = 140, testBtnH = 20;
    const testBtnX = 24;
    const testBtnY = HEIGHT - 32;
    const testGfx = this.add.graphics();
    testGfx.fillStyle(0x111111, 0.3);
    testGfx.fillRoundedRect(testBtnX, testBtnY, testBtnW, testBtnH, 3);
    this.add.text(testBtnX + testBtnW / 2, testBtnY + testBtnH / 2, '获得10仙玉 (测试用)', {
      fontSize: '12px', color: '#444444',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    const testZone = this.add.zone(testBtnX + testBtnW / 2, testBtnY + testBtnH / 2, testBtnW, testBtnH)
      .setInteractive({ useHandCursor: true });
    testZone.on('pointerdown', () => {
      this.save.xianyu = (this.save.xianyu || 0) + 10;
      saveSave(this.save);
      this.refreshUI();
    });

    // ---- 上次结果横幅 ----
    if (this.lastResult) {
      const isClear = this.lastResult === 'clear';
      const msg = isClear
        ? `秘境已清！获得 ${this.lastLingshi} 枚灵石`
        : `道友陨落… 带回 ${this.lastLingshi} 枚灵石`;
      const bannerColor = isClear ? '#f0c040' : '#ff6666';

      const banner = this.add.text(WIDTH / 2, 100, msg, {
        fontSize: '22px', color: bannerColor,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.tweens.add({
        targets: banner,
        alpha: 0,
        delay: 2000,
        duration: 800,
      });
    }

    // ---- 升级按钮区域 ----
    this.createUpgradeButtons();

    // ---- 底部按钮：进入秘境 & 进入洞府 ----
    this.createEnterButtons();

    // 刷新显示（含战绩）
    this.refreshUI();

    // 暂停菜单
    this.pauseMenu = new PauseMenu(this, { sceneName: '修炼大厅' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => { this.pauseMenu.destroy(); });
  }

  // ==================== 创建升级按钮 ====================
  createUpgradeButtons() {
    const stats = ['maxHp', 'atk', 'mpMax'];
    const startY = 200;
    const gap = 120;

    stats.forEach((key, i) => {
      const cfg = UPGRADE_CONFIG[key];
      const y = startY + i * gap;
      const panelX = WIDTH / 2 - 210;
      const panelW = 420;
      const panelH = 100;

      // 面板背景
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1a3e, 0.8);
      bg.fillRoundedRect(panelX, y, panelW, panelH, 10);
      bg.lineStyle(2, 0x4444aa);
      bg.strokeRoundedRect(panelX, y, panelW, panelH, 10);

      // 名称
      this.add.text(panelX + 20, y + 12, cfg.label, {
        fontSize: '22px', color: '#f0c040',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      });

      // 说明文字（动态更新）
      const infoText = this.add.text(panelX + 20, y + 42, '', {
        fontSize: '14px', color: '#cccccc',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });

      // 花费文字
      const costText = this.add.text(panelX + 240, y + 42, '', {
        fontSize: '14px', color: '#ffd700',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });

      // 购买按钮
      const btnW = 90;
      const btnH = 36;
      const btnX = panelX + panelW - btnW - 20;
      const btnY = y + panelH / 2 - btnH / 2 + 5;

      const btnGfx = this.add.graphics();
      const drawBtn = (color, borderColor) => {
        btnGfx.clear();
        btnGfx.fillStyle(color, 0.9);
        btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
        btnGfx.lineStyle(2, borderColor);
        btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      };
      drawBtn(0x224422, 0x44aa44);

      this.add.text(btnX + btnW / 2, btnY + btnH / 2, '升级', {
        fontSize: '16px', color: '#ffffff',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5);

      const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });

      // 存储引用
      this._upgradeRefs = this._upgradeRefs || {};
      this._upgradeRefs[key] = { infoText, costText, btnGfx, btnZone, bg, drawBtn };

      // 点击事件
      btnZone.on('pointerdown', () => {
        this.tryUpgrade(key);
      });
    });
  }

  // ==================== 尝试升级 ====================
  tryUpgrade(key) {
    const cfg = UPGRADE_CONFIG[key];
    const currentLevel = this.save.upgrades[key];
    const cost = upgradeCost(key, currentLevel);

    if (this.save.lingshi < cost) {
      // 灵石不足：按钮变红提示
      const refs = this._upgradeRefs[key];
      refs.drawBtn(0x442222, 0xff4444);
      this.time.delayedCall(400, () => {
        refs.drawBtn(0x224422, 0x44aa44);
      });
      return;
    }

    // 扣除灵石并升级
    this.save.lingshi -= cost;
    this.save.upgrades[key]++;
    saveSave(this.save);
    this.refreshUI();
  }

  // ==================== 刷新界面 ====================
  refreshUI() {
    // 货币（单行：仙玉在前，灵石在后）
    this.currencyLine.setText(`◇ 仙玉：${this.save.xianyu || 0}      ◈ 灵石：${this.save.lingshi}`);
    // 境界
    this.realmText.setText(`境界：${getRealmName(this.save.majorRealmIndex, this.save.layer)}`);
    // 战绩
    this.children.getByName('stats')?.destroy();
    const statsText = this.add.text(WIDTH / 2, HEIGHT - 30,
      `战绩：共历劫 ${this.save.totalRuns} 次，击杀 ${this.save.totalKills} 名妖邪`, {
        fontSize: '14px', color: '#666666',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5).setName('stats');

    // 更新升级面板
    if (this._upgradeRefs) {
      for (const [key, refs] of Object.entries(this._upgradeRefs)) {
        const cfg = UPGRADE_CONFIG[key];
        const level = this.save.upgrades[key];
        const cost = upgradeCost(key, level);
        const base = key === 'atk' ? 10 : 100;
        const current = base + level * cfg.perLevel;
        const next = base + (level + 1) * cfg.perLevel;

        refs.infoText.setText(`${cfg.desc}：${current} → ${next}（+${cfg.perLevel}）`);
        refs.costText.setText(`${cost} 枚灵石`);
      }
    }
  }

  // ==================== 底部按钮：进入秘境 & 机缘阁 & 背包 & 进入洞府 ====================
  createEnterButtons() {
    const btnW = 155;
    const btnH = 50;
    const gap = 20;
    const totalW = btnW * 4 + gap * 3;
    const startX = WIDTH / 2 - totalW / 2;
    const btnY = HEIGHT - 100;

    // ---- 进入秘境 ----
    const dungeonBtnX = startX;
    const dungeonGfx = this.add.graphics();
    const drawDungeon = (fill, stroke) => {
      dungeonGfx.clear();
      dungeonGfx.fillStyle(fill, 0.85);
      dungeonGfx.fillRoundedRect(dungeonBtnX, btnY, btnW, btnH, 10);
      dungeonGfx.lineStyle(3, stroke);
      dungeonGfx.strokeRoundedRect(dungeonBtnX, btnY, btnW, btnH, 10);
    };
    drawDungeon(0x1a3a1a, 0x44cc44);

    this.add.text(dungeonBtnX + btnW / 2, btnY + btnH / 2, '进入秘境', {
      fontSize: '22px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const dungeonZone = this.add.zone(dungeonBtnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    dungeonZone.on('pointerover', () => drawDungeon(0x2a4a2a, 0x66ee66));
    dungeonZone.on('pointerout', () => drawDungeon(0x1a3a1a, 0x44cc44));
    dungeonZone.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // ---- 机缘阁 ----
    const gachaBtnX = dungeonBtnX + btnW + gap;
    const gachaGfx = this.add.graphics();
    const drawGacha = (fill, stroke) => {
      gachaGfx.clear();
      gachaGfx.fillStyle(fill, 0.85);
      gachaGfx.fillRoundedRect(gachaBtnX, btnY, btnW, btnH, 10);
      gachaGfx.lineStyle(3, stroke);
      gachaGfx.strokeRoundedRect(gachaBtnX, btnY, btnW, btnH, 10);
    };
    drawGacha(0x2a1a1a, 0xff9944);

    this.add.text(gachaBtnX + btnW / 2, btnY + btnH / 2, '机缘阁', {
      fontSize: '22px', color: '#ffd700',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const gachaZone = this.add.zone(gachaBtnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    gachaZone.on('pointerover', () => drawGacha(0x3a2a2a, 0xffbb66));
    gachaZone.on('pointerout', () => drawGacha(0x2a1a1a, 0xff9944));
    gachaZone.on('pointerdown', () => {
      this.scene.start('GachaScene');
    });

    // ---- 背包 ----
    const bagBtnX = gachaBtnX + btnW + gap;
    const bagGfx = this.add.graphics();
    const drawBag = (fill, stroke) => {
      bagGfx.clear();
      bagGfx.fillStyle(fill, 0.85);
      bagGfx.fillRoundedRect(bagBtnX, btnY, btnW, btnH, 10);
      bagGfx.lineStyle(3, stroke);
      bagGfx.strokeRoundedRect(bagBtnX, btnY, btnW, btnH, 10);
    };
    drawBag(0x1a2a1a, 0x44cc88);

    this.add.text(bagBtnX + btnW / 2, btnY + btnH / 2, '储物袋', {
      fontSize: '20px', color: '#44ffaa',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const bagZone = this.add.zone(bagBtnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    bagZone.on('pointerover', () => drawBag(0x2a3a2a, 0x66eeaa));
    bagZone.on('pointerout', () => drawBag(0x1a2a1a, 0x44cc88));
    bagZone.on('pointerdown', () => {
      this.scene.start('BagScene');
    });

    // ---- 进入洞府 ----
    const caveBtnX = bagBtnX + btnW + gap;
    const caveGfx = this.add.graphics();
    const drawCave = (fill, stroke) => {
      caveGfx.clear();
      caveGfx.fillStyle(fill, 0.85);
      caveGfx.fillRoundedRect(caveBtnX, btnY, btnW, btnH, 10);
      caveGfx.lineStyle(3, stroke);
      caveGfx.strokeRoundedRect(caveBtnX, btnY, btnW, btnH, 10);
    };
    drawCave(0x1a1a3e, 0x4466cc);

    this.add.text(caveBtnX + btnW / 2, btnY + btnH / 2, '进入洞府', {
      fontSize: '22px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const caveZone = this.add.zone(caveBtnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    caveZone.on('pointerover', () => drawCave(0x2a2a4e, 0x6688ee));
    caveZone.on('pointerout', () => drawCave(0x1a1a3e, 0x4466cc));
    caveZone.on('pointerdown', () => {
      this.scene.start('CaveScene');
    });
  }
}
