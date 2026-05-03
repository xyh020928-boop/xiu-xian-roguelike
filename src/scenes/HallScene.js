import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName, CULTIVATION_PATHS, HERBS } from '../config.js';
import { calcPlayerStats } from '../utils/helpers.js';
import SaveManager from '../utils/SaveManager.js';
import PauseMenu from '../ui/PauseMenu.js';
import CultivationPanel from '../ui/CultivationPanel.js';
import StatsPanel from '../ui/StatsPanel.js';

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
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');

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
    const testBtnY = HEIGHT - 52;
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
      SaveManager.save(this.slotId, this.save);
      this.refreshUI();
    });

    // ---- 获得草药×3 (测试用) ----
    const herbBtnX = 24;
    const herbBtnY = HEIGHT - 24;
    const herbGfx = this.add.graphics();
    herbGfx.fillStyle(0x111111, 0.3);
    herbGfx.fillRoundedRect(herbBtnX, herbBtnY, testBtnW, testBtnH, 3);
    this.add.text(herbBtnX + testBtnW / 2, herbBtnY + testBtnH / 2, '获得草药×3 (测试用)', {
      fontSize: '12px', color: '#445544',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    const herbZone = this.add.zone(herbBtnX + testBtnW / 2, herbBtnY + testBtnH / 2, testBtnW, testBtnH)
      .setInteractive({ useHandCursor: true });
    herbZone.on('pointerdown', () => {
      if (!this.save.herbs) this.save.herbs = {};
      Object.keys(HERBS).forEach(key => {
        this.save.herbs[key] = (this.save.herbs[key] || 0) + 2;
      });
      SaveManager.save(this.slotId, this.save);
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

    // ---- 创建共享上下文供模块使用 ----
    const hallData = {
      save: this.save,
      slotId: this.slotId,
      _cultElements: [],
      _cultCardRefs: {},
      _statsElements: [],
      buildStatsPanel: () => this.statsPanel.buildPanel(),
      refreshUI: () => this.refreshUI(),
    };

    this.cultPanel = new CultivationPanel(this, hallData);
    this.statsPanel = new StatsPanel(this, hallData);

    // ---- 修炼方向分配区域 ----
    this.cultPanel.createPanel();

    // ---- 底部按钮：进入秘境 & 进入洞府 ----
    this.createEnterButtons();

    // 刷新显示（含战绩）
    this.refreshUI();

    // 暂停菜单
    this.pauseMenu = new PauseMenu(this, { sceneName: '修炼大厅' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });

    // 自动保存（30秒）
    this.autoSaveTimer = this.time.addEvent({
      delay: 30000,
      loop: true,
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

    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
    });
  }

  // ==================== 刷新界面 ====================
  refreshUI() {
    const c = this.save.cultivation || { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };

    // 货币（单行：仙玉在前，灵石在后）
    this.currencyLine.setText(`◇ 仙玉：${this.save.xianyu || 0}      ◈ 灵石：${this.save.lingshi}`);
    // 境界
    this.realmText.setText(`境界：${getRealmName(this.save.majorRealmIndex, this.save.layer)}`);
    // 战绩
    this.children.getByName('stats')?.destroy();
    this.add.text(WIDTH / 2, HEIGHT - 30,
      `战绩：共历劫 ${this.save.totalRuns} 次，击杀 ${this.save.totalKills} 名妖邪`, {
        fontSize: '14px', color: '#666666',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5).setName('stats');

    // 销毁旧卡片并重建
    // 保存 cultPointsText 引用（在 destroyElements 中会被销毁）
    this.cultPanel.destroyElements();
    this.cultPanel.buildCards();

    // 更新可用点数文本（重建后重新设置）
    // 注：cultPointsText 在 buildCards 中被重新创建，这里需要通过 _cultElements 找到它
    const pointsText = this.cultPanel.hall._cultElements.find(el =>
      el && el.text != null && typeof el.setText === 'function'
    );
    if (pointsText) {
      pointsText.setText(`可用修炼点：${c.points || 0}  （每突破一层获得 3 点）`);
    }

    // 填充每张卡片数据
    const pathKeys = ['tixiu', 'jianxiu', 'shenshi'];
    const stats = calcPlayerStats(this.save);

    pathKeys.forEach((key) => {
      const refs = this.cultPanel.hall._cultCardRefs[key];
      if (!refs) return;
      const alloc = c[key] || 0;
      const tend = c.tendencies?.[key] || 0;

      refs.pointsTxt.setText(`修炼：${alloc} 点`);
      refs.tendTxt.setText(`倾向：${tend} 次`);

      // 倾向进度条
      const rawTend = tend % 5;
      refs.tendFill.clear();
      if (rawTend > 0) {
        const cfg = CULTIVATION_PATHS[key];
        refs.tendFill.fillStyle(Phaser.Display.Color.HexStringToColor(cfg.color).color, 0.8);
        refs.tendFill.fillRoundedRect(refs.tendX, refs.tendY, (rawTend / 5) * refs.tendBarW, refs.tendBarH, 2);
      }

      // 主要属性加成
      let attrText = '';
      if (key === 'tixiu') attrText = `近战 +${Math.floor((stats.meleeDmgBonus - 1) * 100)}%`;
      if (key === 'jianxiu') attrText = `剑气 +${Math.floor((stats.swordDmgBonus - 1) * 100)}%`;
      if (key === 'shenshi') attrText = `暴击 +${Math.floor(stats.critRate * 100)}%`;
      refs.attrTxt.setText(attrText);

      // 按钮状态
      const hasPoints = (c.points || 0) > 0;
      refs.drawBtn(hasPoints ? 0x224433 : 0x223344, hasPoints ? 0x44aa66 : 0x446688);
      refs.btnLabel.setColor(hasPoints ? '#44ff88' : '#aaaaaa');
    });
  }

  // ==================== 底部按钮：进入秘境 & 机缘阁 & 背包 & 炼丹房 & 进入洞府 ====================
  createEnterButtons() {
    const btnW = 115;
    const btnH = 50;
    const gap = 16;
    const totalW = btnW * 5 + gap * 4;
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
      fontSize: '18px', color: '#ffffff',
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
      fontSize: '18px', color: '#ffd700',
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
      fontSize: '16px', color: '#44ffaa',
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

    // ---- 炼丹房 ----
    const alchemyBtnX = bagBtnX + btnW + gap;
    const alchemyGfx = this.add.graphics();
    const drawAlchemy = (fill, stroke) => {
      alchemyGfx.clear();
      alchemyGfx.fillStyle(fill, 0.85);
      alchemyGfx.fillRoundedRect(alchemyBtnX, btnY, btnW, btnH, 10);
      alchemyGfx.lineStyle(3, stroke);
      alchemyGfx.strokeRoundedRect(alchemyBtnX, btnY, btnW, btnH, 10);
    };
    drawAlchemy(0x2a1a1a, 0xcc6644);

    this.add.text(alchemyBtnX + btnW / 2, btnY + btnH / 2, '炼丹房', {
      fontSize: '16px', color: '#ff8844',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const alchemyZone = this.add.zone(alchemyBtnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    alchemyZone.on('pointerover', () => drawAlchemy(0x3a2a2a, 0xee8866));
    alchemyZone.on('pointerout', () => drawAlchemy(0x2a1a1a, 0xcc6644));
    alchemyZone.on('pointerdown', () => {
      this.scene.start('AlchemyScene');
    });

    // ---- 进入洞府 ----
    const caveBtnX = alchemyBtnX + btnW + gap;
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
      fontSize: '16px', color: '#ffffff',
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

  // ==================== 自动保存提示 ====================
  showAutoSaveHint() {
    const hint = this.add.text(WIDTH - 20, HEIGHT - 20, '✦ 已自动保存', {
      fontSize: '12px', color: '#aaaaaa',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 1).setDepth(2000);
    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: () => hint.destroy(),
    });
  }
}
