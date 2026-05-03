import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { GACHA_POOLS, RARITY_COLOR } from '../systems/GachaSystem.js';
import PauseMenu from '../ui/PauseMenu.js';

// ==================== 布局常量 ====================
const COLS = 6;
const ROWS = 10;
const TOTAL_SLOTS = COLS * ROWS;
const GAP = 4;
const LEFT_PANEL_W = 120;
const RIGHT_W = 280;

const gridStartY = 60;
const bottomPad = 20;
const cellSize = Math.floor((HEIGHT - gridStartY - bottomPad - (ROWS - 1) * GAP) / ROWS);
const GRID_W = COLS * cellSize + (COLS - 1) * GAP;
const GRID_H = ROWS * cellSize + (ROWS - 1) * GAP;
const GRID_X = LEFT_PANEL_W + 10;
const GRID_Y = gridStartY;

const RIGHT_X = WIDTH - RIGHT_W - 10;
const RIGHT_H = HEIGHT - GRID_Y - 20;
const RIGHT_CX = RIGHT_X + RIGHT_W / 2;

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

const CATEGORIES = [
  { key: 'all',    label: '全部',      icon: '◆' },
  { key: 'dan',    label: '丹药',      icon: '⚗' },
  { key: 'fabao',  label: '法宝',      icon: '⚔' },
  { key: 'tiancai', label: '天材地宝', icon: '💎' },
  { key: 'gongfa', label: '功法',      icon: '📜' },
];

const RARITY_BORDER = {
  common:    0x555566,
  rare:      0x2255aa,
  legendary: 0xaa7700,
};

const RARITY_FILL = {
  common:    0x111122,
  rare:      0x0a1530,
  legendary: 0x1a1000,
};

// ==================== 装备槽键 · 中文名 ====================
const EQUIP_SLOTS = [
  { key: 'helmet', label: '头盔', icon: '冠', color: '#aaaaff' },
  { key: 'armor',  label: '护甲', icon: '甲', color: '#aaaaff' },
  { key: 'legs',   label: '护腿', icon: '裤', color: '#aaaaff' },
  { key: 'belt',   label: '腰带', icon: '带', color: '#aaaaff' },
  { key: 'weapon', label: '武器', icon: '剑', color: '#ffaa44' },
  { key: 'amulet', label: '护符', icon: '符', color: '#ff88ff' },
];

// ==================== 装备槽映射（道具类型 → 可用槽位） ====================
const EQUIP_SLOT_MAP = {
  fabao:  ['weapon', 'amulet'],
  gongfa: ['amulet'],
};

export default class BagScene extends Phaser.Scene {
  constructor() {
    super('BagScene');
  }

  create() {
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');

    // ---- 兼容旧存档（无 equipment / bag） ----
    if (!this.save.bag || !Array.isArray(this.save.bag.slots)) {
      this.save.bag = { slots: Array(TOTAL_SLOTS).fill(null) };
    }
    if (this.save.bag.slots.length !== TOTAL_SLOTS) {
      const old = this.save.bag.slots;
      this.save.bag.slots = Array(TOTAL_SLOTS).fill(null);
      for (let i = 0; i < Math.min(old.length, TOTAL_SLOTS); i++) this.save.bag.slots[i] = old[i];
    }
    if (!this.save.equipment) {
      this.save.equipment = {
        helmet: null, armor: null, legs: null,
        belt: null, weapon: null, amulet: null,
      };
    }

    this._currentCat = 'all';
    this._selectedSlotIdx = -1;
    this._selectedSlot = null;
    this._slotElements = [];
    this._legendaryTweens = [];
    this._highlightGfx = null;

    // ---- 背景 ----
    this.cameras.main.setBackgroundColor('#0d0d1a');
    const stars = this.add.graphics();
    for (let i = 0; i < 35; i++) {
      stars.fillStyle(0xffffff, Math.random() * 0.25 + 0.06);
      stars.fillCircle(Math.random() * WIDTH, Math.random() * HEIGHT, Math.random() * 1.2 + 0.3);
    }

    // ---- 顶部标题 ----
    this.add.text(WIDTH / 2, 22, '储物袋', {
      fontSize: '30px', color: '#f0c040',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    // ---- 容量指示（右上） ----
    this.capacityText = this.add.text(WIDTH - 20, 22, '', {
      fontSize: '14px', color: '#666677', fontFamily: FONT,
    }).setOrigin(1, 0);

    // ---- 返回按钮 ----
    this._createBackButton();

    // ---- 左侧分类标签 ----
    this._createSidebar();

    // ---- 格子网格 ----
    this._renderSlots(this._getDisplaySlots('all'));

    // ---- 右侧装备栏 ----
    this._buildEquipmentPanel();

    // ---- 自动保存（30秒） ----
    this.autoSaveTimer = this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => {
        const s = this.registry.get('currentSave');
        const sid = this.registry.get('currentSlotId');
        if (s && sid >= 0) {
          s.playtime = (s.playtime || 0) + 30;
          SaveManager.save(sid, s);
          this._showAutoSaveHint();
        }
      },
    });

    // ---- 暂停菜单 ----
    this.pauseMenu = new PauseMenu(this, { sceneName: '储物袋' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
      this._legendaryTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
      this._closePopup();
    });
  }

  // ==================== 返回按钮 ====================
  _createBackButton() {
    const btnW = 100, btnH = 26;
    const btnX = LEFT_PANEL_W / 2 - btnW / 2;
    const btnY = 20;
    const gfx = this.add.graphics();
    const draw = (fill, stroke) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.8);
      gfx.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
      gfx.lineStyle(1.5, stroke);
      gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 4);
    };
    draw(0x1a1a2e, 0x4466aa);
    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '返回大厅', {
      fontSize: '12px', color: '#aaaacc', fontFamily: FONT,
    }).setOrigin(0.5);
    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x2a2a3e, 0x6688cc));
    zone.on('pointerout', () => draw(0x1a1a2e, 0x4466aa));
    zone.on('pointerdown', () => {
      this._closePopup();
      SaveManager.save(this.slotId, this.save);
      this.scene.start('HallScene');
    });
  }

  // ==================== 左侧分类标签 ====================
  _createSidebar() {
    const sx = 10;
    const sy = GRID_Y;
    const tabH = 40;
    const tabGap = 8;
    const tabW = LEFT_PANEL_W - 20;

    this._tabRefs = [];
    CATEGORIES.forEach((cat, i) => {
      const ty = sy + i * (tabH + tabGap);
      const bg = this.add.graphics();
      const txt = this.add.text(sx + tabW / 2, ty + tabH / 2, `${cat.icon} ${cat.label}`, {
        fontSize: '14px', color: '#888899', fontFamily: FONT,
      }).setOrigin(0.5);
      const zone = this.add.zone(sx + tabW / 2, ty + tabH / 2, tabW, tabH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this._closePopup();
        this._currentCat = cat.key;
        this._selectedSlotIdx = -1;
        this._selectedSlot = null;
        this._refreshTabs();
        this._renderSlots(this._getDisplaySlots(cat.key));
      });
      this._tabRefs.push({ cat: cat.key, bg, txt, ty });
    });
    this._refreshTabs();
  }

  _refreshTabs() {
    const tabW = LEFT_PANEL_W - 20;
    this._tabRefs.forEach(ref => {
      const active = ref.cat === this._currentCat;
      ref.bg.clear();
      if (active) {
        ref.bg.fillStyle(0x332200, 0.8);
        ref.bg.fillRoundedRect(10, ref.ty, tabW, 40, 5);
        ref.bg.lineStyle(1.5, 0xf0c040);
        ref.bg.strokeRoundedRect(10, ref.ty, tabW, 40, 5);
        ref.txt.setColor('#f0c040');
      } else {
        ref.bg.fillStyle(0x111133, 0.5);
        ref.bg.fillRoundedRect(10, ref.ty, tabW, 40, 5);
        ref.bg.lineStyle(1, 0x222244);
        ref.bg.strokeRoundedRect(10, ref.ty, tabW, 40, 5);
        ref.txt.setColor('#888899');
      }
    });
  }

  // ==================== 计算展示列表 ====================
  _getDisplaySlots(category) {
    const slots = this.save.bag.slots;
    let filled = slots.filter(s => s !== null);
    if (category !== 'all') {
      filled = filled.filter(s => s.poolKey === category);
    }
    filled.sort((a, b) => (a.obtainedAt || 0) - (b.obtainedAt || 0));
    const empties = Array(TOTAL_SLOTS - filled.length).fill(null);
    return [...filled, ...empties];
  }

  // ==================== 渲染格子网格 ====================
  _renderSlots(displayList) {
    this._legendaryTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    this._legendaryTweens = [];
    this._slotElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._slotElements = [];
    if (this._highlightGfx) { this._highlightGfx.destroy(); this._highlightGfx = null; }

    const slots = this.save.bag.slots;
    const filledCount = slots.filter(s => s !== null).length;

    if (filledCount >= TOTAL_SLOTS) {
      this.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#ff4444');
    } else if (filledCount >= TOTAL_SLOTS - 5) {
      this.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#ffaa44');
    } else {
      this.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#666677');
    }

    const hasVisible = displayList.some(s => s !== null);
    if (!hasVisible) {
      const msg = this._currentCat === 'all' ? '缘法未至，储物袋中空空如也' : '此类道具尚未获得';
      const t = this.add.text(GRID_X + GRID_W / 2, GRID_Y + GRID_H / 2, msg, {
        fontSize: '16px', color: '#555577', fontFamily: FONT,
      }).setOrigin(0.5);
      this._slotElements.push(t);
      return;
    }

    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const slot = displayList[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = GRID_X + col * (cellSize + GAP);
      const cy = GRID_Y + row * (cellSize + GAP);

      const isEmpty = slot === null;
      const isSelected = this._selectedSlotIdx === i;

      const cellBg = this.add.graphics();
      if (isEmpty) {
        cellBg.fillStyle(0x111122, 0.7);
        cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
        cellBg.lineStyle(3, 0x333355, 0.5);
        cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
        this._slotElements.push(cellBg);
        continue;
      }

      const item = slot.itemData;
      const rarity = item.rarity || 'common';
      const rarityCfg = RARITY_COLOR[rarity] || RARITY_COLOR.common;
      const borderColor = RARITY_BORDER[rarity] || 0x555566;
      const fillColor = RARITY_FILL[rarity] || 0x111122;
      const isLegendary = rarity === 'legendary';

      cellBg.fillStyle(fillColor, 0.8);
      cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
      cellBg.lineStyle(3, borderColor, 0.8);
      cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
      this._slotElements.push(cellBg);

      if (isSelected) {
        this._highlightGfx = this.add.graphics();
        this._highlightGfx.lineStyle(3, 0xffffff, 0.9);
        this._highlightGfx.strokeRoundedRect(cx - 2, cy - 2, cellSize + 4, cellSize + 4, 5);
      }

      if (isLegendary) {
        const ft = this.tweens.add({
          targets: cellBg,
          alpha: { from: 1, to: 0.6 },
          duration: 1000, yoyo: true, repeat: -1,
        });
        this._legendaryTweens.push(ft);
      }

      // 道具名
      const maxChars = 6;
      const name = item.name || '?';
      const displayName = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
      const nameText = this.add.text(cx + cellSize / 2, cy + cellSize / 2 - 3, displayName, {
        fontSize: '11px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
        wordWrap: { width: cellSize - 6 }, align: 'center',
      }).setOrigin(0.5);
      this._slotElements.push(nameText);

      if (slot.count > 1) {
        const ct = this.add.text(cx + cellSize - 5, cy + cellSize - 6, `×${slot.count}`, {
          fontSize: '10px', color: '#ffcc44', fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(1, 1);
        this._slotElements.push(ct);
      }

      // 交互
      const zone = this.add.zone(cx + cellSize / 2, cy + cellSize / 2, cellSize, cellSize)
        .setInteractive({ useHandCursor: true });
      this._slotElements.push(zone);

      const displayIdx = i;
      zone.on('pointerdown', () => {
        if (this._selectedSlotIdx === displayIdx) {
          // 再次点击：取消选中，关闭弹窗
          this._selectedSlotIdx = -1;
          this._selectedSlot = null;
          this._closePopup();
          this._renderSlots(this._getDisplaySlots(this._currentCat));
        } else {
          this._selectedSlotIdx = displayIdx;
          this._selectedSlot = slot;
          // 弹出道具详情弹窗
          const cellCenterX = cx + cellSize / 2;
          const cellCenterY = cy + cellSize / 2;
          this._showItemPopup(slot, cellCenterX, cellCenterY, 'bag');
          this._renderSlots(this._getDisplaySlots(this._currentCat));
        }
      });

      zone.on('pointerover', () => {
        if (this._selectedSlotIdx !== displayIdx) {
          cellBg.clear();
          cellBg.fillStyle(fillColor, 0.95);
          cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
          cellBg.lineStyle(3, 0x888899, 0.9);
          cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
        }
      });
      zone.on('pointerout', () => {
        if (this._selectedSlotIdx !== displayIdx) {
          cellBg.clear();
          cellBg.fillStyle(fillColor, 0.8);
          cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
          cellBg.lineStyle(3, borderColor, 0.8);
          cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
        }
      });
    }
  }

  // ==================== 右侧装备面板 ====================
  _buildEquipmentPanel() {
    this._equipElements = [];
    this._equipSlotGfx = {};
    this._equipSlotTexts = {};

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1e, 0.95);
    bg.fillRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    bg.lineStyle(2, 0x1a1a3a);
    bg.strokeRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    this._equipElements.push(bg);

    // 标题
    const title = this.add.text(RIGHT_CX, GRID_Y + 22, '装备栏', {
      fontSize: '16px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._equipElements.push(title);

    // 金色细分隔线
    const sep = this.add.graphics();
    sep.lineStyle(1, 0xf0c040, 0.4);
    sep.lineBetween(RIGHT_X + 30, GRID_Y + 40, RIGHT_X + RIGHT_W - 30, GRID_Y + 40);
    this._equipElements.push(sep);

    // 像素人形
    this._drawPixelFigure();

    // 虚线连线
    this._drawDashedConnections();

    // 6个装备槽
    this._drawEquipSlots();
  }

  _drawPixelFigure() {
    const gfx = this.add.graphics();
    const cx = RIGHT_CX;
    const availH = RIGHT_H - 80;
    const cy = GRID_Y + 80 + availH * 0.52;
    const s = (availH * 0.75) / 280;
    const color = 0x00ffcc;

    // 各部位（原始坐标乘以缩放系数 s）
    const parts = [
      { x: cx - 13 * s,  y: cy - 130 * s, w: 26 * s, h: 28 * s }, // 头部
      { x: cx - 5 * s,   y: cy - 102 * s, w: 10 * s, h: 10 * s }, // 颈部
      { x: cx - 38 * s,  y: cy - 92 * s,  w: 22 * s, h: 12 * s }, // 肩膀左
      { x: cx + 16 * s,  y: cy - 92 * s,  w: 22 * s, h: 12 * s }, // 肩膀右
      { x: cx - 38 * s,  y: cy - 80 * s,  w: 12 * s, h: 30 * s }, // 上臂左
      { x: cx + 26 * s,  y: cy - 80 * s,  w: 12 * s, h: 30 * s }, // 上臂右
      { x: cx - 37 * s,  y: cy - 50 * s,  w: 10 * s, h: 28 * s }, // 前臂左
      { x: cx + 27 * s,  y: cy - 50 * s,  w: 10 * s, h: 28 * s }, // 前臂右
      { x: cx - 37 * s,  y: cy - 22 * s,  w: 10 * s, h: 14 * s }, // 手左
      { x: cx + 27 * s,  y: cy - 22 * s,  w: 10 * s, h: 14 * s }, // 手右
      { x: cx - 18 * s,  y: cy - 90 * s,  w: 36 * s, h: 28 * s }, // 胸
      { x: cx - 16 * s,  y: cy - 62 * s,  w: 32 * s, h: 20 * s }, // 腹
      { x: cx - 17 * s,  y: cy - 42 * s,  w: 34 * s, h: 12 * s }, // 腰
      { x: cx - 18 * s,  y: cy - 30 * s,  w: 36 * s, h: 16 * s }, // 臀
      { x: cx - 20 * s,  y: cy - 14 * s,  w: 16 * s, h: 40 * s }, // 大腿左
      { x: cx + 4 * s,   y: cy - 14 * s,  w: 16 * s, h: 40 * s }, // 大腿右
      { x: cx - 19 * s,  y: cy + 26 * s,  w: 14 * s, h: 36 * s }, // 小腿左
      { x: cx + 5 * s,   y: cy + 26 * s,  w: 14 * s, h: 36 * s }, // 小腿右
      { x: cx - 21 * s,  y: cy + 62 * s,  w: 18 * s, h: 10 * s }, // 脚左
      { x: cx + 3 * s,   y: cy + 62 * s,  w: 18 * s, h: 10 * s }, // 脚右
    ];

    parts.forEach(p => {
      const rw = Math.max(p.w, 2);
      const rh = Math.max(p.h, 2);
      gfx.fillStyle(color, 0.12);
      gfx.fillRect(p.x, p.y, rw, rh);
      gfx.lineStyle(1.5, color, 0.8);
      gfx.strokeRect(p.x, p.y, rw, rh);
    });

    this._equipElements.push(gfx);
  }

  _drawDashedConnections() {
    const gfx = this.add.graphics();
    const cx = RIGHT_CX;
    const availH = RIGHT_H - 80;
    const cy = GRID_Y + 80 + availH * 0.52;
    const s = (availH * 0.75) / 280;
    const slotSize = 56;

    // 槽位中心
    const slotPos = {
      helmet: { x: cx,                y: cy - 185 * s - slotSize / 2 - 10 },
      armor:  { x: cx - 56 * s - 38,  y: cy - 88 * s },
      weapon: { x: cx - 56 * s - 38,  y: cy - 44 * s },
      legs:   { x: cx - 40 * s - 38,  y: cy + 10 * s },
      amulet: { x: cx + 56 * s + 38,  y: cy - 88 * s },
      belt:   { x: cx + 56 * s + 38,  y: cy - 44 * s },
    };

    const connections = [
      // 头盔 → 头顶
      { fx: slotPos.helmet.x, fy: slotPos.helmet.y + slotSize / 2, tx: cx, ty: cy - 130 * s },
      // 护甲 → 左胸
      { fx: slotPos.armor.x + slotSize / 2, fy: slotPos.armor.y, tx: cx - 18 * s, ty: cy - 76 * s },
      // 护腿 → 左大腿
      { fx: slotPos.legs.x + slotSize / 2, fy: slotPos.legs.y, tx: cx - 20 * s, ty: cy + 6 * s },
      // 武器 → 左手
      { fx: slotPos.weapon.x + slotSize / 2, fy: slotPos.weapon.y, tx: cx - 37 * s, ty: cy - 15 * s },
      // 腰带 → 右腰
      { fx: slotPos.belt.x - slotSize / 2, fy: slotPos.belt.y, tx: cx + 17 * s, ty: cy - 36 * s },
      // 护符 → 右胸
      { fx: slotPos.amulet.x - slotSize / 2, fy: slotPos.amulet.y, tx: cx + 18 * s, ty: cy - 76 * s },
    ];

    gfx.lineStyle(1, 0x445566, 0.5);
    const dashLen = 2;
    const gap = 4;

    connections.forEach(({ fx, fy, tx, ty }) => {
      const dx = tx - fx;
      const dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) return;
      const steps = Math.floor(dist / (dashLen + gap));
      for (let i = 0; i < steps; i++) {
        const t1 = (i * (dashLen + gap)) / dist;
        const t2 = Math.min((i * (dashLen + gap) + dashLen) / dist, 1);
        gfx.lineBetween(
          fx + dx * t1, fy + dy * t1,
          fx + dx * t2, fy + dy * t2,
        );
      }
    });

    this._equipElements.push(gfx);
  }

  _drawEquipSlots() {
    const slotSize = 56;
    const cx = RIGHT_CX;
    const availH = RIGHT_H - 80;
    const cy = GRID_Y + 80 + availH * 0.52;
    const s = (availH * 0.75) / 280;

    // 槽位中心坐标（基于用户公式）
    const positions = {
      helmet: { x: cx,                y: cy - 185 * s - slotSize / 2 - 10 },
      armor:  { x: cx - 56 * s - 38,  y: cy - 88 * s },
      weapon: { x: cx - 56 * s - 38,  y: cy - 44 * s },
      legs:   { x: cx - 40 * s - 38,  y: cy + 10 * s },
      amulet: { x: cx + 56 * s + 38,  y: cy - 88 * s },
      belt:   { x: cx + 56 * s + 38,  y: cy - 44 * s },
    };

    EQUIP_SLOTS.forEach(({ key, label, icon, color: iconColor }) => {
      const pos = positions[key];
      const sx = pos.x - slotSize / 2;
      const sy = pos.y - slotSize / 2;

      // 槽位背景
      const gfx = this.add.graphics();
      const item = this.save.equipment[key];
      if (item) {
        const rarity = item.rarity || 'common';
        const fill = RARITY_FILL[rarity] || 0x111122;
        const border = RARITY_BORDER[rarity] || 0x333355;
        const rarityCfg = RARITY_COLOR[rarity] || RARITY_COLOR.common;
        gfx.fillStyle(fill, 0.8);
        gfx.fillRoundedRect(sx, sy, slotSize, slotSize, 4);
        gfx.lineStyle(2, border, 0.8);
        gfx.strokeRoundedRect(sx, sy, slotSize, slotSize, 4);
        // 道具首字
        const firstChar = item.name ? item.name[0] : '?';
        const charTxt = this.add.text(pos.x, pos.y, firstChar, {
          fontSize: '22px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0.5);
        this._equipElements.push(charTxt);
        this._equipSlotTexts[key] = charTxt;
      } else {
        gfx.fillStyle(0x0d0d20, 0.8);
        gfx.fillRoundedRect(sx, sy, slotSize, slotSize, 4);
        gfx.lineStyle(2, 0x334466, 0.7);
        gfx.strokeRoundedRect(sx, sy, slotSize, slotSize, 4);
        // 图标文字（槽位中心偏上 8px）
        const iconTxt = this.add.text(pos.x, pos.y - 8, icon, {
          fontSize: '18px', color: iconColor || '#555566', fontFamily: FONT,
        }).setOrigin(0.5);
        this._equipElements.push(iconTxt);
        this._equipSlotTexts[key] = iconTxt;
      }
      this._equipElements.push(gfx);
      this._equipSlotGfx[key] = gfx;

      // 槽位标签（槽位外部下方 6px）
      const labelTxt = this.add.text(pos.x, sy + slotSize + 6, label, {
        fontSize: '10px', color: '#888899', fontFamily: FONT,
      }).setOrigin(0.5, 0);
      this._equipElements.push(labelTxt);

      // 交互区
      const zone = this.add.zone(pos.x, pos.y, slotSize, slotSize)
        .setInteractive({ useHandCursor: true });
      this._equipElements.push(zone);
      zone.on('pointerdown', () => {
        this._handleEquipSlotClick(key);
      });
    });
  }

  _refreshEquipSlots() {
    // 清理旧的装备槽元素
    Object.values(this._equipSlotGfx).forEach(el => { if (el && el.destroy) el.destroy(); });
    Object.values(this._equipSlotTexts).forEach(el => { if (el && el.destroy) el.destroy(); });
    this._equipSlotGfx = {};
    this._equipSlotTexts = {};

    // 清理旧的 zone 和标签（remove last N elements from _equipElements）
    // 简单方案：销毁整个装备面板重建
    this._equipElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._equipElements = [];
    this._equipSlotGfx = {};
    this._equipSlotTexts = {};
    this._buildEquipmentPanel();
  }

  _handleEquipSlotClick(slotKey) {
    this._closePopup();
    const item = this.save.equipment[slotKey];
    if (!item) return;

    // 显示道具详情弹窗（来源标记为 'equip'）
    const slotInfo = EQUIP_SLOTS.find(s => s.key === slotKey);
    const pos = this._getEquipSlotCenter(slotKey);
    this._showItemPopup(
      { itemData: item, count: 1, poolKey: this._guessPoolKey(item) },
      pos.x, pos.y, 'equip', slotKey
    );
  }

  _getEquipSlotCenter(slotKey) {
    const cx = RIGHT_CX;
    const availH = RIGHT_H - 80;
    const cy = GRID_Y + 80 + availH * 0.52;
    const s = (availH * 0.75) / 280;
    const slotSize = 56;
    const map = {
      helmet: { x: cx,                y: cy - 185 * s - slotSize / 2 - 10 },
      armor:  { x: cx - 56 * s - 38,  y: cy - 88 * s },
      weapon: { x: cx - 56 * s - 38,  y: cy - 44 * s },
      legs:   { x: cx - 40 * s - 38,  y: cy + 10 * s },
      amulet: { x: cx + 56 * s + 38,  y: cy - 88 * s },
      belt:   { x: cx + 56 * s + 38,  y: cy - 44 * s },
    };
    return map[slotKey] || { x: cx, y: cy };
  }

  _guessPoolKey(item) {
    if (!item || !item.id) return 'unknown';
    if (item.id.startsWith('dan_')) return 'dan';
    if (item.id.startsWith('fabao_')) return 'fabao';
    if (item.id.startsWith('tiancai_')) return 'tiancai';
    if (item.id.startsWith('gongfa_')) return 'gongfa';
    return 'unknown';
  }

  // ==================== 道具详情弹窗 ====================
  /**
   * @param {object} slot - { itemData, count, poolKey }
   * @param {number} anchorX - 弹出位置参考点 X
   * @param {number} anchorY - 弹出位置参考点 Y
   * @param {string} source - 'bag' | 'equip'
   * @param {string} equipSlotKey - 如果是装备槽来源，记录槽位key
   */
  _showItemPopup(slot, anchorX, anchorY, source = 'bag', equipSlotKey = null) {
    this._closePopup();

    const PW = 280, PH = 320;
    const item = slot.itemData;
    const rarity = item.rarity || 'common';
    const rarityCfg = RARITY_COLOR[rarity] || RARITY_COLOR.common;
    const poolKey = slot.poolKey || this._guessPoolKey(item);
    const poolName = GACHA_POOLS[poolKey] ? GACHA_POOLS[poolKey].name : '未知';

    // 弹窗定位（优先右侧，避免超出屏幕）
    let px = anchorX + 16;
    let py = anchorY - PH / 2;
    if (px + PW > WIDTH - 10) px = anchorX - PW - 16;
    if (px < 10) px = 10;
    if (py < 10) py = 10;
    if (py + PH > HEIGHT - 10) py = HEIGHT - PH - 10;

    this._popupData = { px, py, PW, PH, source, equipSlotKey, slot };
    this._popupElements = [];

    // 遮罩（点击关闭）
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.4);
    overlay.fillRect(0, 0, WIDTH, HEIGHT).setDepth(200);
    const overlayZone = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(200);
    overlayZone.on('pointerdown', () => {
      this._closePopup();
      if (source === 'bag') {
        this._selectedSlotIdx = -1;
        this._selectedSlot = null;
        this._renderSlots(this._getDisplaySlots(this._currentCat));
      }
    });
    this._popupElements.push(overlay, overlayZone);

    // 弹窗面板
    const panel = this.add.graphics().setDepth(201);
    const rarityBorder = parseInt((rarityCfg.text || '#ffffff').slice(1), 16);
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRoundedRect(px, py, PW, PH, 6);
    panel.lineStyle(2, rarityBorder, 0.8);
    panel.strokeRoundedRect(px, py, PW, PH, 6);
    this._popupElements.push(panel);

    // 右上角关闭 ×
    const closeBtn = this.add.text(px + PW - 18, py + 8, '✕', {
      fontSize: '16px', color: '#888888', fontFamily: 'Arial,sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202);
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
    closeBtn.on('pointerdown', () => {
      this._closePopup();
      if (source === 'bag') {
        this._selectedSlotIdx = -1;
        this._selectedSlot = null;
        this._renderSlots(this._getDisplaySlots(this._currentCat));
      }
    });
    this._popupElements.push(closeBtn);

    let curY = py + 10;

    // 稀有度标签
    const rarityLabel = this.add.text(px + PW / 2, curY, rarityCfg.label, {
      fontSize: '11px', color: rarityCfg.text, fontFamily: FONT,
      fontStyle: 'bold',
      backgroundColor: '#' + rarityCfg.bg.toString(16).padStart(6, '0'),
      padding: { x: 10, y: 1 },
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(rarityLabel);
    curY += 22;

    // 道具名称
    const nameTxt = this.add.text(px + PW / 2, curY, item.name || '?', {
      fontSize: '18px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(nameTxt);
    curY += 26;

    // 分隔线
    const sep1 = this.add.graphics().setDepth(201);
    sep1.lineStyle(1, 0x444466, 0.5);
    sep1.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep1);
    curY += 8;

    // 来源
    const sourceTxt = this.add.text(px + 20, curY, `来源：${poolName}池`, {
      fontSize: '11px', color: '#777788', fontFamily: FONT,
    }).setDepth(202);
    this._popupElements.push(sourceTxt);
    curY += 18;

    // 分隔线
    const sep2 = this.add.graphics().setDepth(201);
    sep2.lineStyle(1, 0x444466, 0.5);
    sep2.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep2);
    curY += 10;

    // 效果
    const effTitle = this.add.text(px + 20, curY, '效　果', {
      fontSize: '12px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setDepth(202);
    this._popupElements.push(effTitle);
    curY += 20;

    const effectText = item.desc || '（无描述）';
    const effTxt = this.add.text(px + 24, curY, effectText, {
      fontSize: '12px', color: '#cccccc', fontFamily: FONT,
      wordWrap: { width: PW - 48 },
    }).setDepth(202);
    this._popupElements.push(effTxt);
    const effectLines = Math.max(1, Math.ceil((effectText.length * 7) / (PW - 48)));
    curY += effectLines * 15 + 10;

    // 分隔线
    const sep3 = this.add.graphics().setDepth(201);
    sep3.lineStyle(1, 0x333355, 0.4);
    sep3.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep3);
    curY += 10;

    // 简介
    const descTitle = this.add.text(px + 20, curY, '简　介', {
      fontSize: '12px', color: '#888899', fontFamily: FONT, fontStyle: 'bold',
    }).setDepth(202);
    this._popupElements.push(descTitle);
    curY += 20;

    const desc = item.desc || '暂无简介';
    const descTxt = this.add.text(px + 24, curY, desc, {
      fontSize: '11px', color: '#777788', fontFamily: FONT, fontStyle: 'italic',
      wordWrap: { width: PW - 48 },
    }).setDepth(202);
    this._popupElements.push(descTxt);

    // 底部按钮
    const btnY = py + PH - 44;

    // 判断道具是否已装备
    const equipEntry = this._findEquippedItem(item);
    const isEquipped = !!equipEntry;

    if (poolKey === 'dan') {
      // 丹药：使用按钮
      this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '使用', '#44ccaa', '#1a2a2a', '#44ccaa', () => {
        this._showFlashMsg('请在秘境中使用');
      });
    } else if (poolKey === 'tiancai') {
      // 天材地宝：已生效
      this._addPopupLabel(px + PW / 2, btnY + 8, '已生效', '#44aa44', '#1a2a1a');
    } else if (item.effect && item.effect.type === 'placeholder') {
      // 占位功法
      this._addPopupLabel(px + PW / 2, btnY + 8, '待实装', '#888866', '#1a1a1a');
    } else if (source === 'equip') {
      // 从装备栏打开 → 显示卸下
      this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '卸下', '#ff8844', '#2a1a1a', '#ff8844', () => {
        this._doUnequip(equipSlotKey);
        this._closePopup();
      });
    } else if (poolKey === 'fabao' || poolKey === 'gongfa') {
      if (isEquipped) {
        // 已装备：显示卸下
        this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '卸下', '#ff8844', '#2a1a1a', '#ff8844', () => {
          this._doUnequip(equipEntry);
          this._closePopup();
          this._selectedSlotIdx = -1;
          this._selectedSlot = null;
          this._renderSlots(this._getDisplaySlots(this._currentCat));
        });
      } else {
        // 可装备：装备按钮
        this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '装备', '#f0c040', '#2a2a1a', '#f0c040', () => {
          this._showEquipSelectPopup(slot, poolKey);
        });
      }
    } else {
      // 其他（兜底）
      this._addPopupLabel(px + PW / 2, btnY + 8, '待实装', '#888866', '#1a1a1a');
    }
  }

  /** 在弹窗内添加按钮 */
  _addPopupButton(bx, by, bw, bh, label, textColor, bgColor, borderColor, callback) {
    const bg = this.add.graphics().setDepth(202);
    bg.fillStyle(parseInt(bgColor.slice(1), 16), 0.8);
    bg.fillRoundedRect(bx, by, bw, bh, 5);
    bg.lineStyle(1.5, parseInt(borderColor.slice(1), 16));
    bg.strokeRoundedRect(bx, by, bw, bh, 5);
    this._popupElements.push(bg);

    const txt = this.add.text(bx + bw / 2, by + bh / 2, label, {
      fontSize: '14px', color: textColor, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(202);
    this._popupElements.push(txt);

    const zone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh)
      .setInteractive({ useHandCursor: true }).setDepth(203);
    this._popupElements.push(zone);
    zone.on('pointerdown', callback);
  }

  /** 在弹窗内添加静态标签 */
  _addPopupLabel(cx, cy, label, textColor, bgColor) {
    const txt = this.add.text(cx, cy, label, {
      fontSize: '14px', color: textColor, fontFamily: FONT, fontStyle: 'bold',
      backgroundColor: bgColor,
      padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0.5).setDepth(202);
    this._popupElements.push(txt);
  }

  /** 查找道具是否在装备栏中，返回槽位 key */
  _findEquippedItem(item) {
    for (const key of Object.keys(this.save.equipment)) {
      const eq = this.save.equipment[key];
      if (eq && eq.id === item.id) return key;
    }
    return null;
  }

  _closePopup() {
    if (this._popupElements) {
      this._popupElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._popupElements = null;
    }
    this._popupData = null;

    // 同时关闭装备选择弹窗
    this._closeEquipSelectPopup();
  }

  // ==================== 装备选择弹窗 ====================
  _showEquipSelectPopup(bagSlot, poolKey) {
    this._closeEquipSelectPopup();

    const availableSlots = EQUIP_SLOT_MAP[poolKey];
    if (!availableSlots || availableSlots.length === 0) return;

    const PW = 240;
    const slotH = 44;
    const gap = 8;
    const contentH = slotH * availableSlots.length + gap * (availableSlots.length - 1);
    const PH = contentH + 80;
    const px = WIDTH / 2 - PW / 2;
    const py = HEIGHT / 2 - PH / 2;

    this._equipSelectElements = [];

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, WIDTH, HEIGHT).setDepth(250);
    const overlayZone = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(250);
    overlayZone.on('pointerdown', () => this._closeEquipSelectPopup());
    this._equipSelectElements.push(overlay, overlayZone);

    // 面板
    const panel = this.add.graphics().setDepth(251);
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRoundedRect(px, py, PW, PH, 8);
    panel.lineStyle(2, 0xf0c040);
    panel.strokeRoundedRect(px, py, PW, PH, 8);
    this._equipSelectElements.push(panel);

    // 标题
    const title = this.add.text(WIDTH / 2, py + 22, '选择装备槽位', {
      fontSize: '16px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(252);
    this._equipSelectElements.push(title);

    // 槽位按钮
    let curY = py + 52;
    availableSlots.forEach(slotKey => {
      const slotInfo = EQUIP_SLOTS.find(s => s.key === slotKey);
      const label = slotInfo ? slotInfo.label : slotKey;

      const bg = this.add.graphics().setDepth(252);
      bg.fillStyle(0x222244, 0.7);
      bg.fillRoundedRect(px + 20, curY, PW - 40, slotH, 5);
      bg.lineStyle(1.5, 0x4466aa);
      bg.strokeRoundedRect(px + 20, curY, PW - 40, slotH, 5);
      this._equipSelectElements.push(bg);

      const txt = this.add.text(WIDTH / 2, curY + slotH / 2, label, {
        fontSize: '15px', color: '#aaaacc', fontFamily: FONT,
      }).setOrigin(0.5).setDepth(252);
      this._equipSelectElements.push(txt);

      const zone = this.add.zone(WIDTH / 2, curY + slotH / 2, PW - 40, slotH)
        .setInteractive({ useHandCursor: true }).setDepth(253);
      this._equipSelectElements.push(zone);

      zone.on('pointerdown', () => {
        this._doEquip(slotKey, bagSlot);
        this._closePopup();
        this._closeEquipSelectPopup();
        this._selectedSlotIdx = -1;
        this._selectedSlot = null;
        this._renderSlots(this._getDisplaySlots(this._currentCat));
      });

      curY += slotH + gap;
    });
  }

  _closeEquipSelectPopup() {
    if (this._equipSelectElements) {
      this._equipSelectElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._equipSelectElements = null;
    }
  }

  // ==================== 装备/卸下逻辑 ====================
  /**
   * 装备道具到指定槽位
   * @param {string} slotKey - 装备槽 key
   * @param {object} bagSlot - 背包槽数据 { itemData, count, poolKey }
   */
  _doEquip(slotKey, bagSlot) {
    const item = bagSlot.itemData;
    const poolKey = bagSlot.poolKey || this._guessPoolKey(item);

    // 如果槽位已有装备，先卸下
    const existing = this.save.equipment[slotKey];
    if (existing) {
      const emptyIdx = this.save.bag.slots.findIndex(s => s === null);
      if (emptyIdx === -1) {
        this._showFlashMsg('储物袋已满，无法换装');
        return;
      }
      this.save.bag.slots[emptyIdx] = {
        itemData: existing,
        count: 1,
        poolKey: this._guessPoolKey(existing),
        obtainedAt: Date.now(),
      };
    }

    // 从背包移除
    const bagIdx = this.save.bag.slots.findIndex(s =>
      s && s.itemData && s.itemData.id === item.id
    );
    if (bagIdx >= 0) {
      if (this.save.bag.slots[bagIdx].count > 1) {
        this.save.bag.slots[bagIdx].count--;
      } else {
        this.save.bag.slots[bagIdx] = null;
      }
    }

    // 装入装备槽
    this.save.equipment[slotKey] = { ...item };

    SaveManager.save(this.slotId, this.save);
    this._refreshEquipSlots();
  }

  /**
   * 卸下装备栏中的道具
   * @param {string} slotKey - 装备槽 key
   */
  _doUnequip(slotKey) {
    const item = this.save.equipment[slotKey];
    if (!item) return;

    // 找背包空位
    const emptyIdx = this.save.bag.slots.findIndex(s => s === null);
    if (emptyIdx === -1) {
      this._showFlashMsg('储物袋已满，无法卸下');
      return;
    }

    this.save.bag.slots[emptyIdx] = {
      itemData: { ...item },
      count: 1,
      poolKey: this._guessPoolKey(item),
      obtainedAt: Date.now(),
    };

    this.save.equipment[slotKey] = null;

    SaveManager.save(this.slotId, this.save);
    this._refreshEquipSlots();
    this._renderSlots(this._getDisplaySlots(this._currentCat));
  }

  // ==================== 工具 ====================
  _showFlashMsg(msg) {
    const t = this.add.text(WIDTH / 2, HEIGHT - 80, msg, {
      fontSize: '15px', color: '#ffaa44', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2000).setAlpha(0);

    this.tweens.add({
      targets: t, alpha: { from: 1, to: 0 },
      y: HEIGHT - 90, duration: 1500, delay: 100,
      onComplete: () => t.destroy(),
    });
  }

  _showAutoSaveHint() {
    const hint = this.add.text(WIDTH - 20, HEIGHT - 20, '✦ 已自动保存', {
      fontSize: '12px', color: '#aaaaaa', fontFamily: FONT,
    }).setOrigin(1, 1).setDepth(2000);
    this.tweens.add({
      targets: hint, alpha: 0, delay: 2000, duration: 500,
      onComplete: () => hint.destroy(),
    });
  }

  update() {
    if (this.pauseMenu && this.pauseMenu.visible) return;
  }
}
