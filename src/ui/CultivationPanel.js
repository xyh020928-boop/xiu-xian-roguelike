import Phaser from 'phaser';
import { WIDTH, HEIGHT, CULTIVATION_PATHS, POINTS_PER_LAYER } from '../config.js';
import SaveManager from '../utils/SaveManager.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class CultivationPanel {
  constructor(scene, hall) {
    this.scene = scene;
    this.hall = hall;
  }

  // ==================== 修炼方向分配面板 ====================
  createPanel() {
    // 初始化修炼数据
    if (!this.hall.save.cultivation) {
      this.hall.save.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
    }

    this.hall._cultElements = [];   // 所有修炼卡片+属性面板的子元素
    this.hall._cultCardRefs = {};   // 每张卡片的动态引用（按钮/可更新文本）
    this.hall._statsElements = [];  // 属性面板文本引用

    // 首次构建
    this.buildCards();
  }

  // ==================== 构建/重建所有修炼卡片与属性面板 ====================
  buildCards() {
    const pathKeys = ['tixiu', 'jianxiu', 'shenshi'];
    const cardW = 500;
    const cardH = 90;
    const panelX = WIDTH / 2 - cardW / 2;
    const startY = 140;
    const cardGap = 12;

    // ---- 可用点数提示 ----
    this.hall.cultPointsText = this.scene.add.text(WIDTH / 2, startY - 24, '', {
      fontSize: '16px', color: '#f0c040',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hall._cultElements.push(this.hall.cultPointsText);

    pathKeys.forEach((key, i) => {
      const cfg = CULTIVATION_PATHS[key];
      const cy = startY + i * (cardH + cardGap);
      const cardElements = [];

      // --- 卡片背景 ---
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x1a1a3e, 0.7);
      bg.fillRoundedRect(panelX, cy, cardW, cardH, 8);
      bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(cfg.color).color, 0.6);
      bg.strokeRoundedRect(panelX, cy, cardW, cardH, 8);
      cardElements.push(bg);

      // === 左侧区域 (relative x: 15-220) ===

      // 图标文字
      const iconTxt = this.scene.add.text(panelX + 15, cy + 20, cfg.icon, {
        fontSize: '24px', color: cfg.color, fontFamily: FONT,
      });
      cardElements.push(iconTxt);

      // 方向名
      const nameTxt = this.scene.add.text(panelX + 55, cy + 18, cfg.name, {
        fontSize: '20px', color: cfg.color, fontFamily: FONT, fontStyle: 'bold',
      });
      cardElements.push(nameTxt);

      // 描述小字
      const descTxt = this.scene.add.text(panelX + 55, cy + 48, cfg.desc, {
        fontSize: '11px', color: '#666688', fontFamily: FONT,
      });
      cardElements.push(descTxt);

      // 倾向进度条背景
      const tendBarW = 120, tendBarH = 4;
      const tendX = panelX + 55;
      const tendY = cy + 68;
      const tendBg = this.scene.add.graphics();
      tendBg.fillStyle(0x222244);
      tendBg.fillRoundedRect(tendX, tendY, tendBarW, tendBarH, 2);
      cardElements.push(tendBg);

      // 倾向进度条填充
      const tendFill = this.scene.add.graphics();
      cardElements.push(tendFill);

      // === 中间区域 (relative x: 230-380) ===

      // 修炼点数
      const pointsTxt = this.scene.add.text(panelX + 230, cy + 20, '', {
        fontSize: '12px', color: '#ffffff', fontFamily: FONT,
      });
      cardElements.push(pointsTxt);

      // 倾向次数
      const tendTxt = this.scene.add.text(panelX + 230, cy + 42, '', {
        fontSize: '12px', color: '#888899', fontFamily: FONT,
      });
      cardElements.push(tendTxt);

      // 主要属性加成
      const attrTxt = this.scene.add.text(panelX + 230, cy + 62, '', {
        fontSize: '11px', color: '#44ffaa', fontFamily: FONT,
      });
      cardElements.push(attrTxt);

      // === 右侧区域 (relative x: 390-480) ===

      // +1点按钮
      const btnW = 60, btnH = 40;
      const btnX = panelX + 410;
      const btnY = cy + 25;

      const btnGfx = this.scene.add.graphics();
      const drawBtn = (fill, stroke) => {
        btnGfx.clear();
        btnGfx.fillStyle(fill, 0.9);
        btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
        btnGfx.lineStyle(1.5, stroke);
        btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      };
      drawBtn(0x223344, 0x446688);
      cardElements.push(btnGfx);

      const btnLabel = this.scene.add.text(btnX + btnW / 2, btnY + btnH / 2, '+1点', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: FONT,
      }).setOrigin(0.5);
      cardElements.push(btnLabel);

      const btnZone = this.scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      cardElements.push(btnZone);

      btnZone.on('pointerdown', () => { this.allocatePoint(key); });

      // 存储引用
      this.hall._cultCardRefs[key] = {
        tendFill, pointsTxt, tendTxt, attrTxt, btnGfx, btnLabel, drawBtn,
        tendX, tendY, tendBarW, tendBarH,
      };
      this.hall._cultElements.push(...cardElements);
    });

    // ---- 战斗属性面板 ----
    this.hall.buildStatsPanel();
  }

  // ==================== 销毁修炼卡片与属性面板元素 ====================
  destroyElements() {
    for (const el of this.hall._cultElements) {
      if (el && el.destroy) el.destroy();
    }
    this.hall._cultElements = [];
    this.hall._cultCardRefs = {};

    for (const el of this.hall._statsElements) {
      if (el && el.destroy) el.destroy();
    }
    this.hall._statsElements = [];
  }

  // ==================== 分配修炼点 ====================
  allocatePoint(pathKey) {
    const c = this.hall.save.cultivation;
    if (!c || c.points <= 0) {
      const refs = this.hall._cultCardRefs[pathKey];
      if (refs) {
        refs.drawBtn(0x442222, 0xff4444);
        refs.btnLabel.setColor('#ff4444');
        this.scene.time.delayedCall(400, () => {
          refs.drawBtn(0x223344, 0x446688);
          refs.btnLabel.setColor('#aaaaaa');
        });
      }
      return;
    }

    c.points--;
    c[pathKey] = (c[pathKey] || 0) + 1;
    SaveManager.save(this.hall.slotId, this.hall.save);
    this.hall.refreshUI();
  }
}
