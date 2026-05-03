import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName, CULTIVATION_PATHS, POINTS_PER_LAYER } from '../config.js';
import { calcPlayerStats } from '../utils/helpers.js';
import SaveManager from '../utils/SaveManager.js';
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

    // ---- 修炼方向分配区域 ----
    this.createCultivationPanel();

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

  // ==================== 修炼方向分配面板 ====================
  createCultivationPanel() {
    // 初始化修炼数据
    if (!this.save.cultivation) {
      this.save.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
    }

    this._cultElements = [];   // 所有修炼卡片+属性面板的子元素
    this._cultCardRefs = {};   // 每张卡片的动态引用（按钮/可更新文本）
    this._statsElements = [];  // 属性面板文本引用

    // 首次构建
    this._buildCultivationCards();
  }

  // ==================== 构建/重建所有修炼卡片与属性面板 ====================
  _buildCultivationCards() {
    const pathKeys = ['tixiu', 'jianxiu', 'shenshi'];
    const cardW = 500;
    const cardH = 90;
    const panelX = WIDTH / 2 - cardW / 2;
    const startY = 140;
    const cardGap = 12;
    const FONT = '"Microsoft YaHei","SimHei",sans-serif';

    // ---- 可用点数提示 ----
    this.cultPointsText = this.add.text(WIDTH / 2, startY - 24, '', {
      fontSize: '16px', color: '#f0c040',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._cultElements.push(this.cultPointsText);

    pathKeys.forEach((key, i) => {
      const cfg = CULTIVATION_PATHS[key];
      const cy = startY + i * (cardH + cardGap);
      const cardElements = [];

      // --- 卡片背景 ---
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1a3e, 0.7);
      bg.fillRoundedRect(panelX, cy, cardW, cardH, 8);
      bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(cfg.color).color, 0.6);
      bg.strokeRoundedRect(panelX, cy, cardW, cardH, 8);
      cardElements.push(bg);

      // === 左侧区域 (relative x: 15-220) ===

      // 图标文字
      const iconTxt = this.add.text(panelX + 15, cy + 20, cfg.icon, {
        fontSize: '24px', color: cfg.color, fontFamily: FONT,
      });
      cardElements.push(iconTxt);

      // 方向名
      const nameTxt = this.add.text(panelX + 55, cy + 18, cfg.name, {
        fontSize: '20px', color: cfg.color, fontFamily: FONT, fontStyle: 'bold',
      });
      cardElements.push(nameTxt);

      // 描述小字
      const descTxt = this.add.text(panelX + 55, cy + 48, cfg.desc, {
        fontSize: '11px', color: '#666688', fontFamily: FONT,
      });
      cardElements.push(descTxt);

      // 倾向进度条背景
      const tendBarW = 120, tendBarH = 4;
      const tendX = panelX + 55;
      const tendY = cy + 68;
      const tendBg = this.add.graphics();
      tendBg.fillStyle(0x222244);
      tendBg.fillRoundedRect(tendX, tendY, tendBarW, tendBarH, 2);
      cardElements.push(tendBg);

      // 倾向进度条填充
      const tendFill = this.add.graphics();
      cardElements.push(tendFill);

      // === 中间区域 (relative x: 230-380) ===

      // 修炼点数
      const pointsTxt = this.add.text(panelX + 230, cy + 20, '', {
        fontSize: '12px', color: '#ffffff', fontFamily: FONT,
      });
      cardElements.push(pointsTxt);

      // 倾向次数
      const tendTxt = this.add.text(panelX + 230, cy + 42, '', {
        fontSize: '12px', color: '#888899', fontFamily: FONT,
      });
      cardElements.push(tendTxt);

      // 主要属性加成
      const attrTxt = this.add.text(panelX + 230, cy + 62, '', {
        fontSize: '11px', color: '#44ffaa', fontFamily: FONT,
      });
      cardElements.push(attrTxt);

      // === 右侧区域 (relative x: 390-480) ===

      // +1点按钮
      const btnW = 60, btnH = 40;
      const btnX = panelX + 410;
      const btnY = cy + 25;

      const btnGfx = this.add.graphics();
      const drawBtn = (fill, stroke) => {
        btnGfx.clear();
        btnGfx.fillStyle(fill, 0.9);
        btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
        btnGfx.lineStyle(1.5, stroke);
        btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      };
      drawBtn(0x223344, 0x446688);
      cardElements.push(btnGfx);

      const btnLabel = this.add.text(btnX + btnW / 2, btnY + btnH / 2, '+1点', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: FONT,
      }).setOrigin(0.5);
      cardElements.push(btnLabel);

      const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      cardElements.push(btnZone);

      btnZone.on('pointerdown', () => { this.allocatePoint(key); });

      // 存储引用
      this._cultCardRefs[key] = {
        tendFill, pointsTxt, tendTxt, attrTxt, btnGfx, btnLabel, drawBtn,
        tendX, tendY, tendBarW, tendBarH,
      };
      this._cultElements.push(...cardElements);
    });

    // ---- 战斗属性面板 ----
    this._buildStatsPanel();
  }

  // ==================== 销毁修炼卡片与属性面板元素 ====================
  _destroyCultivationElements() {
    for (const el of this._cultElements) {
      if (el && el.destroy) el.destroy();
    }
    this._cultElements = [];
    this._cultCardRefs = {};

    for (const el of this._statsElements) {
      if (el && el.destroy) el.destroy();
    }
    this._statsElements = [];
  }

  // ==================== 战斗属性预览面板（4行×2列网格） ====================
  _buildStatsPanel() {
    const panelW = 500;
    const panelH = 120;
    const px = WIDTH / 2 - panelW / 2;
    const py = 140 + 3 * (90 + 12) + 10; // 3张卡片下方
    const FONT = '"Microsoft YaHei","SimHei",sans-serif';
    const rowH = 26;
    const col1X = px + 24;
    const col2X = px + panelW / 2 + 16;

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x112233, 0.6);
    bg.fillRoundedRect(px, py, panelW, panelH, 6);
    bg.lineStyle(1, 0x334455, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 6);
    this._cultElements.push(bg);

    // 标题
    const title = this.add.text(px + panelW / 2, py + 8, '── 战斗属性 ──', {
      fontSize: '13px', color: '#667788', fontFamily: FONT,
    }).setOrigin(0.5);
    this._cultElements.push(title);

    const stats = calcPlayerStats(this.save);
    const labelStyle = { fontSize: '12px', color: '#8899aa', fontFamily: FONT };

    // 辅助函数：判断是否有加成，返回颜色
    const bonusColor = (hasBonus) => hasBonus ? '#44ffcc' : '#ffffff';

    // 基础值计算
    const realmBonus = this.save.majorRealmIndex || 0;
    const c = this.save.cultivation || { tixiu: 0, jianxiu: 0, shenshi: 0 };

    const contentStartY = py + 28;

    // 第1行：生命（左）| 灵力（右）
    this._addStatLabel(col1X, contentStartY, '生命', labelStyle);
    this._addStatValue(col1X + 40, contentStartY, stats.maxHp, bonusColor((c.tixiu || 0) > 0 || realmBonus > 0));

    this._addStatLabel(col2X, contentStartY, '灵力', labelStyle);
    this._addStatValue(col2X + 40, contentStartY, stats.maxMp, bonusColor((c.jianxiu || 0) > 0 || realmBonus > 0));

    // 第2行：近战（左）| 剑气（右）
    const row2Y = contentStartY + rowH;
    this._addStatLabel(col1X, row2Y, '近战', labelStyle);
    this._addStatValue(col1X + 40, row2Y, stats.meleeDmgBonus.toFixed(2) + 'x', bonusColor(stats.meleeDmgBonus > 1));

    this._addStatLabel(col2X, row2Y, '剑气', labelStyle);
    this._addStatValue(col2X + 40, row2Y, stats.swordDmgBonus.toFixed(2) + 'x', bonusColor(stats.swordDmgBonus > 1));

    // 第3行：防御（左）| 回蓝（右）
    const row3Y = row2Y + rowH;
    this._addStatLabel(col1X, row3Y, '防御', labelStyle);
    this._addStatValue(col1X + 40, row3Y, Math.floor(stats.defense * 100) + '%', bonusColor(stats.defense > 0));

    this._addStatLabel(col2X, row3Y, '回蓝', labelStyle);
    this._addStatValue(col2X + 40, row3Y, stats.mpRegen.toFixed(1) + '/s', bonusColor(stats.mpRegen > 5));

    // 第4行：暴击（左）| 移速（右）
    const row4Y = row3Y + rowH;
    this._addStatLabel(col1X, row4Y, '暴击', labelStyle);
    this._addStatValue(col1X + 40, row4Y, Math.floor(stats.critRate * 100) + '%', bonusColor(stats.critRate > 0));

    this._addStatLabel(col2X, row4Y, '移速', labelStyle);
    this._addStatValue(col2X + 40, row4Y, stats.moveSpeed.toString(), bonusColor(stats.moveSpeed > 220));
  }

  _addStatLabel(x, y, text, style) {
    const t = this.add.text(x, y, text + '：', style);
    this._cultElements.push(t);
  }

  _addStatValue(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontSize: '12px', color, fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });
    this._cultElements.push(t);
  }

  // ==================== 分配修炼点 ====================
  allocatePoint(pathKey) {
    const c = this.save.cultivation;
    if (!c || c.points <= 0) {
      const refs = this._cultCardRefs[pathKey];
      if (refs) {
        refs.drawBtn(0x442222, 0xff4444);
        refs.btnLabel.setColor('#ff4444');
        this.time.delayedCall(400, () => {
          refs.drawBtn(0x223344, 0x446688);
          refs.btnLabel.setColor('#aaaaaa');
        });
      }
      return;
    }

    c.points--;
    c[pathKey] = (c[pathKey] || 0) + 1;
    SaveManager.save(this.slotId, this.save);
    this.refreshUI();
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
    // 保存 cultPointsText 引用（在 _destroyCultivationElements 中会被销毁）
    this._destroyCultivationElements();
    this._buildCultivationCards();

    // 更新可用点数文本（重建后重新设置）
    this.cultPointsText.setText(`可用修炼点：${c.points || 0}  （每突破一层获得 ${POINTS_PER_LAYER} 点）`);

    // 填充每张卡片数据
    const pathKeys = ['tixiu', 'jianxiu', 'shenshi'];
    const stats = calcPlayerStats(this.save);

    pathKeys.forEach((key) => {
      const refs = this._cultCardRefs[key];
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
