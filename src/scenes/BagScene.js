import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { GACHA_POOLS, RARITY_COLOR } from '../systems/GachaSystem.js';
import PauseMenu from '../ui/PauseMenu.js';

// ==================== 布局常量 ====================
const COLS = 6;
const ROWS = 10;
const TOTAL_SLOTS = COLS * ROWS; // 60
const GAP = 4;
const LEFT_PANEL_W = 120;

// 格子尺寸：优先适配高度，保证10行正方形格子全部可见
const gridStartY = 60;
const bottomPad = 20;
const cellSize = Math.floor((HEIGHT - gridStartY - bottomPad - (ROWS - 1) * GAP) / ROWS);
const GRID_W = COLS * cellSize + (COLS - 1) * GAP;
const GRID_H = ROWS * cellSize + (ROWS - 1) * GAP;
const GRID_X = LEFT_PANEL_W + 10;
const GRID_Y = gridStartY;

// 右侧预览面板
const RIGHT_X = GRID_X + GRID_W + 20;
const RIGHT_W = WIDTH - RIGHT_X - 10;
const RIGHT_H = HEIGHT - GRID_Y - 20;

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

export default class BagScene extends Phaser.Scene {
  constructor() {
    super('BagScene');
  }

  create() {
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');
    if (!this.save.bag || !Array.isArray(this.save.bag.slots)) {
      this.save.bag = { slots: Array(TOTAL_SLOTS).fill(null) };
    }
    if (this.save.bag.slots.length !== TOTAL_SLOTS) {
      const old = this.save.bag.slots;
      this.save.bag.slots = Array(TOTAL_SLOTS).fill(null);
      for (let i = 0; i < Math.min(old.length, TOTAL_SLOTS); i++) this.save.bag.slots[i] = old[i];
    }

    this._currentCat = 'all';
    this._selectedSlotIdx = -1;
    this._selectedSlot = null;
    this._slotElements = [];
    this._previewElements = [];
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
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // ---- 容量指示（右上） ----
    this.capacityText = this.add.text(WIDTH - 20, 22, '', {
      fontSize: '14px', color: '#666677',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 0);

    // ---- 返回按钮（左上，分类栏上方） ----
    this.createBackButton();

    // ---- 左侧分类标签 ----
    this.createSidebar();

    // ---- 格子网格 ----
    this.renderSlots(this.getDisplaySlots('all'));

    // ---- 右侧预览面板 ----
    this.createPreviewPanel();

    // ---- 自动保存（30秒） ----
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

    // ---- 暂停菜单 ----
    this.pauseMenu = new PauseMenu(this, { sceneName: '储物袋' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
      this._legendaryTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    });
  }

  // ==================== 返回按钮 ====================
  createBackButton() {
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
      fontSize: '12px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x2a2a3e, 0x6688cc));
    zone.on('pointerout', () => draw(0x1a1a2e, 0x4466aa));
    zone.on('pointerdown', () => {
      SaveManager.save(this.slotId, this.save);
      this.scene.start('HallScene');
    });
  }

  // ==================== 左侧分类标签 ====================
  createSidebar() {
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
        fontSize: '14px', color: '#888899',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5);
      const zone = this.add.zone(sx + tabW / 2, ty + tabH / 2, tabW, tabH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this._currentCat = cat.key;
        this._selectedSlotIdx = -1;
        this._selectedSlot = null;
        this.refreshTabs();
        this.renderSlots(this.getDisplaySlots(cat.key));
        this.showDefaultPreview();
      });
      this._tabRefs.push({ cat: cat.key, bg, txt, ty });
    });
    this.refreshTabs();
  }

  refreshTabs() {
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
  getDisplaySlots(category) {
    const slots = this.save.bag.slots;
    let filled = slots.filter(s => s !== null);
    if (category !== 'all') {
      filled = filled.filter(s => s.poolKey === category);
    }
    filled.sort((a, b) => (a.obtainedAt || 0) - (b.obtainedAt || 0));
    const empties = Array(TOTAL_SLOTS - filled.length).fill(null);
    return [...filled, ...empties];
  }

  // ==================== 渲染格子 ====================
  renderSlots(displayList) {
    this._legendaryTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    this._legendaryTweens = [];
    this._slotElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._slotElements = [];
    if (this._highlightGfx) { this._highlightGfx.destroy(); this._highlightGfx = null; }

    const slots = this.save.bag.slots;
    const filledCount = slots.filter(s => s !== null).length;

    // 容量指示
    if (filledCount >= TOTAL_SLOTS) {
      this.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#ff4444');
    } else if (filledCount >= TOTAL_SLOTS - 5) {
      this.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#ffaa44');
    } else {
      this.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#666677');
    }

    // 空背包
    const hasVisible = displayList.some(s => s !== null);
    if (!hasVisible) {
      const msg = this._currentCat === 'all' ? '缘法未至，储物袋中空空如也' : '此类道具尚未获得';
      const t = this.add.text(GRID_X + GRID_W / 2, GRID_Y + GRID_H / 2, msg, {
        fontSize: '16px', color: '#555577',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
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

      // 格子背景
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

      // 选中高亮边框
      if (isSelected) {
        this._highlightGfx = this.add.graphics();
        this._highlightGfx.lineStyle(3, 0xffffff, 0.9);
        this._highlightGfx.strokeRoundedRect(cx - 2, cy - 2, cellSize + 4, cellSize + 4, 5);
      }

      // 传说脉冲
      if (isLegendary) {
        const ft = this.tweens.add({
          targets: cellBg,
          alpha: { from: 1, to: 0.6 },
          duration: 1000, yoyo: true, repeat: -1,
        });
        this._legendaryTweens.push(ft);
      }

      // 道具名（超过6字截断）
      const maxChars = 6;
      const name = item.name || '?';
      const displayName = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
      const nameText = this.add.text(cx + cellSize / 2, cy + cellSize / 2 - 3, displayName, {
        fontSize: '11px', color: rarityCfg.text,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
        wordWrap: { width: cellSize - 6 }, align: 'center',
      }).setOrigin(0.5);
      this._slotElements.push(nameText);

      // 数量角标
      if (slot.count > 1) {
        const ct = this.add.text(cx + cellSize - 5, cy + cellSize - 6, `×${slot.count}`, {
          fontSize: '10px', color: '#ffcc44',
          fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
          fontStyle: 'bold',
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
          // 再次点击：取消选中
          this._selectedSlotIdx = -1;
          this._selectedSlot = null;
          this.showDefaultPreview();
          this.renderSlots(this.getDisplaySlots(this._currentCat));
        } else {
          this._selectedSlotIdx = displayIdx;
          this._selectedSlot = slot;
          this.showSlotPreview(slot);
          this.renderSlots(this.getDisplaySlots(this._currentCat));
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

  // ==================== 右侧预览面板 ====================
  createPreviewPanel() {
    this._previewGfx = this.add.graphics();
    // 面板背景
    this._previewGfx.fillStyle(0x0d0d20, 0.85);
    this._previewGfx.fillRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    this._previewGfx.lineStyle(2, 0x333355);
    this._previewGfx.strokeRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);

    this._previewElements = [];
    this.showDefaultPreview();
  }

  showDefaultPreview() {
    this._clearPreviewContent();

    const t = this.add.text(RIGHT_X + RIGHT_W / 2, GRID_Y + RIGHT_H / 2 - 10, '点击道具\n查看详情', {
      fontSize: '18px', color: '#444455',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);
    this._previewElements.push(t);
  }

  showSlotPreview(slot) {
    this._clearPreviewContent();
    this._drawPreviewBorder();

    const item = slot.itemData;
    const rarity = item.rarity || 'common';
    const rarityCfg = RARITY_COLOR[rarity] || RARITY_COLOR.common;
    const fillColor = RARITY_FILL[rarity] || 0x111122;
    const borderColor = RARITY_BORDER[rarity] || 0x555566;
    const borderHex = parseInt(rarityCfg.text.slice(1), 16);

    const poolKey = slot.poolKey ||
      (item.id.startsWith('dan_') ? 'dan' : item.id.startsWith('fabao_') ? 'fabao'
        : item.id.startsWith('tiancai_') ? 'tiancai' : item.id.startsWith('gongfa_') ? 'gongfa' : 'unknown');
    const poolName = GACHA_POOLS[poolKey] ? GACHA_POOLS[poolKey].name : '未知';
    const poolColor = GACHA_POOLS[poolKey] ? GACHA_POOLS[poolKey].color : '#888888';

    const px = RIGHT_X;
    const py = GRID_Y;
    let curY = py + 12;

    // ---- 图标区（正方形） ----
    const iconSize = Math.min(RIGHT_W - 16, 140);
    const iconX = px + (RIGHT_W - iconSize) / 2;
    const iconY = curY;

    const iconBg = this.add.graphics();
    iconBg.fillStyle(fillColor, 0.7);
    iconBg.fillRoundedRect(iconX, iconY, iconSize, iconSize, 8);
    iconBg.lineStyle(2, borderColor, 0.7);
    iconBg.strokeRoundedRect(iconX, iconY, iconSize, iconSize, 8);
    this._previewElements.push(iconBg);

    // 首字
    const firstChar = item.name ? item.name[0] : '?';
    this._previewElements.push(
      this.add.text(iconX + iconSize / 2, iconY + iconSize / 2 - 8, firstChar, {
        fontSize: `${Math.floor(iconSize * 0.45)}px`, color: rarityCfg.text,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    // 底部稀有度标签
    this._previewElements.push(
      this.add.text(iconX + iconSize / 2, iconY + iconSize - 18, rarityCfg.label, {
        fontSize: '13px', color: rarityCfg.text,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
        backgroundColor: '#000000',
        padding: { x: 10, y: 2 },
      }).setOrigin(0.5)
    );

    curY += iconSize + 14;

    // ---- 道具名称 ----
    this._previewElements.push(
      this.add.text(px + RIGHT_W / 2, curY, item.name || '?', {
        fontSize: '16px', color: rarityCfg.text,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0)
    );
    curY += 22;

    // 来源
    this._previewElements.push(
      this.add.text(px + RIGHT_W / 2, curY, `来自·${poolName}`, {
        fontSize: '10px', color: poolColor,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5, 0)
    );
    curY += 18;

    // ---- 分隔线 ----
    const sep1 = this.add.graphics();
    sep1.lineStyle(1, 0x665522, 0.5);
    sep1.lineBetween(px + 16, curY, px + RIGHT_W - 16, curY);
    this._previewElements.push(sep1);
    curY += 10;

    // ---- 效果 ----
    this._previewElements.push(
      this.add.text(px + 16, curY, '效　果', {
        fontSize: '12px', color: '#f0c040',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      })
    );
    curY += 18;

    const effectText = item.desc || '（无描述）';
    this._previewElements.push(
      this.add.text(px + 20, curY, effectText, {
        fontSize: '12px', color: '#cccccc',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        wordWrap: { width: RIGHT_W - 40 },
      })
    );
    // estimate effect text height
    const effectLines = Math.ceil((effectText.length * 9) / (RIGHT_W - 40)) || 1;
    curY += effectLines * 15 + 8;

    // ---- 分隔线 ----
    const sep2 = this.add.graphics();
    sep2.lineStyle(1, 0x333355, 0.4);
    sep2.lineBetween(px + 16, curY, px + RIGHT_W - 16, curY);
    this._previewElements.push(sep2);
    curY += 10;

    // ---- 简介 ----
    this._previewElements.push(
      this.add.text(px + 16, curY, '简　介', {
        fontSize: '12px', color: '#888899',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      })
    );
    curY += 18;

    const desc = item.desc || '暂无简介';
    this._previewElements.push(
      this.add.text(px + 20, curY, desc, {
        fontSize: '11px', color: '#777788',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'italic',
        wordWrap: { width: RIGHT_W - 40 },
      })
    );
    const descLines = Math.ceil((desc.length * 8) / (RIGHT_W - 40)) || 1;
    curY += descLines * 14 + 12;

    // ---- 底部按钮区 ----
    const btnY = py + RIGHT_H - 44;

    if (poolKey === 'dan') {
      // 丹药：使用按钮
      const ubW = 100, ubH = 30;
      const ubX = px + (RIGHT_W - ubW) / 2 - 55;
      const ubg = this.add.graphics();
      ubg.fillStyle(0x1a2a2a, 0.7);
      ubg.fillRoundedRect(ubX, btnY, ubW, ubH, 5);
      ubg.lineStyle(1.5, 0x44ccaa);
      ubg.strokeRoundedRect(ubX, btnY, ubW, ubH, 5);
      this._previewElements.push(ubg);

      const ubt = this.add.text(ubX + ubW / 2, btnY + ubH / 2, '使用', {
        fontSize: '14px', color: '#44ccaa',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this._previewElements.push(ubt);

      const ubZone = this.add.zone(ubX + ubW / 2, btnY + ubH / 2, ubW, ubH)
        .setInteractive({ useHandCursor: true });
      this._previewElements.push(ubZone);
      ubZone.on('pointerdown', () => {
        this._showFlashMsg('请在秘境中使用');
      });
    } else if (poolKey === 'tiancai') {
      this._previewElements.push(
        this.add.text(px + RIGHT_W / 2 - 55, btnY + 8, '已生效', {
          fontSize: '14px', color: '#44aa44',
          fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
          fontStyle: 'bold',
          backgroundColor: '#1a2a1a',
          padding: { x: 20, y: 6 },
        }).setOrigin(0.5)
      );
    } else if (item.effect && item.effect.type === 'placeholder') {
      this._previewElements.push(
        this.add.text(px + RIGHT_W / 2, btnY + 8, '待实装', {
          fontSize: '14px', color: '#888866',
          fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
          backgroundColor: '#1a1a1a',
          padding: { x: 16, y: 6 },
        }).setOrigin(0.5)
      );
    } else {
      this._previewElements.push(
        this.add.text(px + RIGHT_W / 2, btnY + 8, '待实装', {
          fontSize: '14px', color: '#888866',
          fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
          backgroundColor: '#1a1a1a',
          padding: { x: 16, y: 6 },
        }).setOrigin(0.5)
      );
    }

    // 关闭预览按钮
    const cbW = 100, cbH = 30;
    const cbX = px + (RIGHT_W - cbW) / 2 + 55;
    const cbg = this.add.graphics();
    cbg.fillStyle(0x1a1a2e, 0.7);
    cbg.fillRoundedRect(cbX, btnY, cbW, cbH, 5);
    cbg.lineStyle(1.5, 0x4466aa);
    cbg.strokeRoundedRect(cbX, btnY, cbW, cbH, 5);
    this._previewElements.push(cbg);

    const cbt = this.add.text(cbX + cbW / 2, btnY + cbH / 2, '关闭预览', {
      fontSize: '12px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    this._previewElements.push(cbt);

    const cbZone = this.add.zone(cbX + cbW / 2, btnY + cbH / 2, cbW, cbH)
      .setInteractive({ useHandCursor: true });
    this._previewElements.push(cbZone);
    cbZone.on('pointerdown', () => {
      this._selectedSlotIdx = -1;
      this._selectedSlot = null;
      this.showDefaultPreview();
      this.renderSlots(this.getDisplaySlots(this._currentCat));
    });
  }

  // ---- 轻提示 ----
  _showFlashMsg(msg) {
    const t = this.add.text(RIGHT_X + RIGHT_W / 2, GRID_Y + RIGHT_H - 70, msg, {
      fontSize: '14px', color: '#ffaa44',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(300).setAlpha(0);

    this.tweens.add({
      targets: t, alpha: { from: 1, to: 0 },
      y: GRID_Y + RIGHT_H - 80, duration: 1500, delay: 100,
      onComplete: () => t.destroy(),
    });
  }

  _drawPreviewBorder() {
    this._previewGfx.clear();
    this._previewGfx.fillStyle(0x0d0d20, 0.85);
    this._previewGfx.fillRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
    this._previewGfx.lineStyle(2, 0x333355);
    this._previewGfx.strokeRoundedRect(RIGHT_X, GRID_Y, RIGHT_W, RIGHT_H, 8);
  }

  _clearPreviewContent() {
    this._previewElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._previewElements = [];
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

  update() {
    if (this.pauseMenu && this.pauseMenu.visible) return;
  }
}
