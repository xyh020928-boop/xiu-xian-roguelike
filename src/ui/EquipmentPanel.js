import Phaser from 'phaser';
import { WIDTH, HEIGHT, MATERIALS, DECOMPOSE_YIELD } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { RARITY_COLOR } from '../systems/GachaSystem.js';

// ==================== 布局常量 ====================
const FONT = '"Microsoft YaHei","SimHei",sans-serif';

const RIGHT_W = 280;
const RIGHT_X = WIDTH - RIGHT_W - 10;
const RIGHT_H = HEIGHT - 60 - 20;
const RIGHT_CX = RIGHT_X + RIGHT_W / 2;
const GRID_Y = 60;

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

export default class EquipmentPanel {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} bag - 父场景接口
   * @param {object} bag.save - 存档数据
   * @param {number} bag.slotId - 存档槽位ID
   * @param {string} bag.currentCat - 当前分类
   * @param {Function} bag.onRenderSlots - function(displayList): void 刷新网格
   * @param {Function} bag.onShowItemPopup - function(slot, anchorX, anchorY, source, equipSlotKey): void
   * @param {Function} bag.onShowFlashMsg - function(msg): void
   * @param {Function} bag.onClosePopup - function(): void
   * @param {Function} bag.onEquipSlotClick - function(slotKey, slot, x, y): void
   * @param {Function} bag.onBagChanged - function(): void
   * @param {Function} bag.getDisplaySlots - function(): array
   */
  constructor(scene, bag) {
    this.scene = scene;
    this.bag = bag;

    this._equipElements = [];
    this._equipSlotGfx = {};
    this._equipSlotTexts = {};
  }

  // ==================== 构建装备面板 ====================
  buildEquipmentPanel() {
    this._equipElements = [];
    this._equipSlotGfx = {};
    this._equipSlotTexts = {};

    // 面板背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a1e, 0.95);
    bg.fillRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    bg.lineStyle(2, 0x1a1a3a);
    bg.strokeRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    this._equipElements.push(bg);

    // 标题
    const title = this.scene.add.text(RIGHT_CX, GRID_Y + 22, '装备栏', {
      fontSize: '16px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._equipElements.push(title);

    // 金色细分隔线
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0xf0c040, 0.4);
    sep.lineBetween(RIGHT_X + 30, GRID_Y + 40, RIGHT_X + RIGHT_W - 30, GRID_Y + 40);
    this._equipElements.push(sep);

    // 像素人形
    this._drawPixelFigure();

    // 虚线连线
    this._drawDashedConnections();

    // 6个装备槽
    this.drawEquipSlots();
  }

  // ==================== 像素人形 ====================
  _drawPixelFigure() {
    const gfx = this.scene.add.graphics();
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

  // ==================== 虚线连线 ====================
  _drawDashedConnections() {
    const gfx = this.scene.add.graphics();
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

  // ==================== 绘制装备槽 ====================
  drawEquipSlots() {
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
      const gfx = this.scene.add.graphics();
      const item = this.bag.save.equipment[key];
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
        const charTxt = this.scene.add.text(pos.x, pos.y, firstChar, {
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
        const iconTxt = this.scene.add.text(pos.x, pos.y - 8, icon, {
          fontSize: '18px', color: iconColor || '#555566', fontFamily: FONT,
        }).setOrigin(0.5);
        this._equipElements.push(iconTxt);
        this._equipSlotTexts[key] = iconTxt;
      }
      this._equipElements.push(gfx);
      this._equipSlotGfx[key] = gfx;

      // 槽位标签（槽位外部下方 6px）
      const labelTxt = this.scene.add.text(pos.x, sy + slotSize + 6, label, {
        fontSize: '10px', color: '#888899', fontFamily: FONT,
      }).setOrigin(0.5, 0);
      this._equipElements.push(labelTxt);

      // 交互区
      const zone = this.scene.add.zone(pos.x, pos.y, slotSize, slotSize)
        .setInteractive({ useHandCursor: true });
      this._equipElements.push(zone);
      zone.on('pointerdown', () => {
        this._handleEquipSlotClick(key);
      });
    });
  }

  // ==================== 刷新装备槽 ====================
  refreshEquipSlots() {
    this.destroyRightPanel();
    if (this.bag.currentCat === 'jiyuan') {
      this.buildJiYuanPanel();
    } else {
      this.buildEquipmentPanel();
    }
  }

  // ==================== 处理装备槽点击 ====================
  _handleEquipSlotClick(slotKey) {
    if (this.bag.onClosePopup) this.bag.onClosePopup();
    const item = this.bag.save.equipment[slotKey];
    if (!item) return;

    // 显示道具详情弹窗（来源标记为 'equip'）
    const slotInfo = EQUIP_SLOTS.find(s => s.key === slotKey);
    const pos = this.getEquipSlotCenter(slotKey);
    const virtualSlot = { itemData: item, count: 1, poolKey: this._guessPoolKey(item) };

    if (this.bag.onEquipSlotClick) {
      this.bag.onEquipSlotClick(slotKey, virtualSlot, pos.x, pos.y);
    }
  }

  // ==================== 获取装备槽中心坐标 ====================
  getEquipSlotCenter(slotKey) {
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

  // ==================== 猜测道具 poolKey ====================
  _guessPoolKey(item) {
    if (!item || !item.id) return 'unknown';
    if (item.id.startsWith('dan_')) return 'dan';
    if (item.id.startsWith('fabao_')) return 'fabao';
    if (item.id.startsWith('tiancai_')) return 'tiancai';
    if (item.id.startsWith('gongfa_')) return 'gongfa';
    return 'unknown';
  }

  // ==================== 查找已装备道具 ====================
  _findEquippedItem(item) {
    for (const key of Object.keys(this.bag.save.equipment)) {
      const eq = this.bag.save.equipment[key];
      if (eq && eq.id === item.id) return key;
    }
    return null;
  }

  // ==================== 装备道具到指定槽位 ====================
  /**
   * 装备道具到指定槽位
   * @param {string} slotKey - 装备槽 key
   * @param {object} bagSlot - 背包槽数据 { itemData, count, poolKey }
   */
  _doEquip(slotKey, bagSlot) {
    const item = bagSlot.itemData;
    const poolKey = bagSlot.poolKey || this._guessPoolKey(item);

    // 如果槽位已有装备，先卸下
    const existing = this.bag.save.equipment[slotKey];
    if (existing) {
      const emptyIdx = this.bag.save.bag.slots.findIndex(s => s === null);
      if (emptyIdx === -1) {
        if (this.bag.onShowFlashMsg) this.bag.onShowFlashMsg('储物袋已满，无法换装');
        return;
      }
      this.bag.save.bag.slots[emptyIdx] = {
        itemData: existing,
        count: 1,
        poolKey: this._guessPoolKey(existing),
        obtainedAt: Date.now(),
      };
    }

    // 从背包移除
    const bagIdx = this.bag.save.bag.slots.findIndex(s =>
      s && s.itemData && s.itemData.id === item.id
    );
    if (bagIdx >= 0) {
      if (this.bag.save.bag.slots[bagIdx].count > 1) {
        this.bag.save.bag.slots[bagIdx].count--;
      } else {
        this.bag.save.bag.slots[bagIdx] = null;
      }
    }

    // 装入装备槽
    this.bag.save.equipment[slotKey] = { ...item };

    SaveManager.save(this.bag.slotId, this.bag.save);
    this.refreshEquipSlots();
    if (this.bag.onBagChanged) this.bag.onBagChanged();
  }

  /**
   * 公开的装备方法（供外部调用）
   */
  doEquip(slotKey, bagSlot) {
    this._doEquip(slotKey, bagSlot);
  }

  // ==================== 卸下装备栏中的道具 ====================
  /**
   * 卸下装备栏中的道具
   * @param {string} slotKey - 装备槽 key
   */
  _doUnequip(slotKey) {
    const item = this.bag.save.equipment[slotKey];
    if (!item) return;

    // 找背包空位
    const emptyIdx = this.bag.save.bag.slots.findIndex(s => s === null);
    if (emptyIdx === -1) {
      if (this.bag.onShowFlashMsg) this.bag.onShowFlashMsg('储物袋已满，无法卸下');
      return;
    }

    this.bag.save.bag.slots[emptyIdx] = {
      itemData: { ...item },
      count: 1,
      poolKey: this._guessPoolKey(item),
      obtainedAt: Date.now(),
    };

    this.bag.save.equipment[slotKey] = null;

    SaveManager.save(this.bag.slotId, this.bag.save);
    this.refreshEquipSlots();
    if (this.bag.onBagChanged) this.bag.onBagChanged();
  }

  /**
   * 公开的卸下方法（供外部调用）
   */
  doUnequip(slotKey) {
    this._doUnequip(slotKey);
  }

  /**
   * 获取装备可能的槽位
   */
  getEquipSlotsForPool(poolKey) {
    return EQUIP_SLOT_MAP[poolKey] || [];
  }

  /**
   * 获取装备槽配置
   */
  getEquipSlotInfo(slotKey) {
    return EQUIP_SLOTS.find(s => s.key === slotKey);
  }

  /**
   * 查找道具是否已装备
   */
  findEquippedItem(item) {
    return this._findEquippedItem(item);
  }

  // ==================== 右侧面板统一销毁 ====================
  destroyRightPanel() {
    if (this._jiYuanElements) {
      this._jiYuanElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._jiYuanElements = null;
    }
    if (this._equipElements) {
      this._equipElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._equipElements = null;
    }
    this._equipSlotGfx = {};
    this._equipSlotTexts = {};
  }

  // ==================== 机缘右侧面板 ====================
  buildJiYuanPanel() {
    this._jiYuanElements = [];

    // 面板背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a1e, 0.95);
    bg.fillRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    bg.lineStyle(2, 0x2a2a4a);
    bg.strokeRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    this._jiYuanElements.push(bg);

    // 标题
    const title = this.scene.add.text(RIGHT_CX, GRID_Y + 22, '机 缘', {
      fontSize: '18px', color: '#ffcc44', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._jiYuanElements.push(title);

    let curY = GRID_Y + 54;

    // ---- 材料库存 ----
    const matTitle = this.scene.add.text(RIGHT_X + 16, curY, '材料库存', {
      fontSize: '13px', color: '#8899aa', fontFamily: FONT,
    });
    this._jiYuanElements.push(matTitle);
    curY += 22;

    const matKeys = ['mat_001', 'mat_002', 'mat_003'];
    const matColors = { mat_001: '#aaaaaa', mat_002: '#4488ff', mat_003: '#ffd700' };
    matKeys.forEach(key => {
      const mat = MATERIALS[key];
      const count = this._countMaterial(key);
      const txt = this.scene.add.text(RIGHT_X + 20, curY, `${mat.name}：${count}`, {
        fontSize: '12px', color: matColors[key] || '#aaaaaa', fontFamily: FONT,
      });
      this._jiYuanElements.push(txt);
      curY += 18;
    });

    curY += 12;

    // 分隔线
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x334455, 0.5);
    sep.lineBetween(RIGHT_X + 20, curY, RIGHT_X + RIGHT_W - 20, curY);
    this._jiYuanElements.push(sep);
    curY += 16;

    // ---- 丹药库存 ----
    const pillTitle = this.scene.add.text(RIGHT_X + 16, curY, '丹药库存', {
      fontSize: '13px', color: '#8899aa', fontFamily: FONT,
    });
    this._jiYuanElements.push(pillTitle);
    curY += 22;

    const pillIds = ['pill_huiqi', 'pill_juling', 'pill_dahuan'];
    const pillColors = { pill_huiqi: '#44ccaa', pill_juling: '#ff6644', pill_dahuan: '#ffcc44' };
    pillIds.forEach(pid => {
      const count = this._countMaterial(pid);
      const name = pid === 'pill_huiqi' ? '回气丹' : pid === 'pill_juling' ? '聚灵丹' : '大还丹';
      const txt = this.scene.add.text(RIGHT_X + 20, curY, `${name}：${count}`, {
        fontSize: '12px', color: pillColors[pid] || '#aaaaaa', fontFamily: FONT,
      });
      this._jiYuanElements.push(txt);
      curY += 18;
    });

    curY += 12;

    // 分隔线
    const sep2 = this.scene.add.graphics();
    sep2.lineStyle(1, 0x334455, 0.5);
    sep2.lineBetween(RIGHT_X + 20, curY, RIGHT_X + 20, curY);
    this._jiYuanElements.push(sep2);
    curY += 16;

    // ---- 永久buff ----
    const buffTitle = this.scene.add.text(RIGHT_X + 16, curY, '永久加成', {
      fontSize: '13px', color: '#8899aa', fontFamily: FONT,
    });
    this._jiYuanElements.push(buffTitle);
    curY += 20;

    const buffs = this.bag.save.permBuffs || { maxHpPct: 0, atkPct: 0, maxHpFlat: 0, atkFlat: 0 };
    const hpPct = Math.floor((buffs.maxHpPct || 0) * 100);
    const atkPct = Math.floor((buffs.atkPct || 0) * 100);
    const hpFlat = buffs.maxHpFlat || 0;
    const atkFlat = buffs.atkFlat || 0;
    const hpParts = [];
    if (hpPct > 0) hpParts.push(`+${hpPct}%`);
    if (hpFlat > 0) hpParts.push(`+${hpFlat}`);
    const atkParts = [];
    if (atkPct > 0) atkParts.push(`+${atkPct}%`);
    if (atkFlat > 0) atkParts.push(`+${atkFlat}`);
    const hpStr = hpParts.length > 0 ? hpParts.join(' ') : '+0';
    const atkStr = atkParts.length > 0 ? atkParts.join(' ') : '+0';
    const hpTxt = this.scene.add.text(RIGHT_X + 20, curY, `最大血量：${hpStr}`, {
      fontSize: '12px', color: '#ff6644', fontFamily: FONT,
    });
    this._jiYuanElements.push(hpTxt);
    curY += 18;
    const atkTxt = this.scene.add.text(RIGHT_X + 20, curY, `攻击力：${atkStr}`, {
      fontSize: '12px', color: '#ffaa44', fontFamily: FONT,
    });
    this._jiYuanElements.push(atkTxt);

    curY += 24;

    // ---- 炼丹引导 ----
    const hintTxt = this.scene.add.text(RIGHT_CX, curY + 12, '如需炼丹\n请前往炼丹房', {
      fontSize: '13px', color: '#666688', fontFamily: FONT, align: 'center',
    }).setOrigin(0.5, 0);
    this._jiYuanElements.push(hintTxt);
  }

  /** 统计材料数量（从机缘背包中） */
  _countMaterial(itemId) {
    if (!this.bag.save.jiYuanBag || !Array.isArray(this.bag.save.jiYuanBag.slots)) return 0;
    let total = 0;
    for (const slot of this.bag.save.jiYuanBag.slots) {
      if (slot && slot.itemId === itemId) total += slot.count;
    }
    return total;
  }
}
