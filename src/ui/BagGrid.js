import { WIDTH, HEIGHT, MAX_STACK_SIZE } from '../config.js';
import { RARITY_COLOR } from '../systems/GachaSystem.js';

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
  { key: 'jiyuan', label: '机缘',      icon: '◇', material: true },
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

export default class BagGrid {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} bag - { save, state: { selectedSlotIdx, selectedSlot, currentCat }, elements: { slotElements, countTexts, legendaryTweens, highlightGfx }, onItemClick, onJiYuanClick }
   */
  constructor(scene, bag) {
    this.scene = scene;
    this.bag = bag;
  }

  // ==================== 计算展示列表 ====================
  getDisplaySlots(category) {
    // 'all' 标签页：合并主背包 + 机缘背包
    if (category === 'all') {
      const mainFilled = this.bag.save.bag.slots.filter(s => s !== null);
      const jiYuanFilled = this.bag.save.jiYuanBag.slots.filter(s => s !== null);
      const filled = [...mainFilled, ...jiYuanFilled];
      filled.sort((a, b) => (a.obtainedAt || 0) - (b.obtainedAt || 0));
      const empties = Array(TOTAL_SLOTS - filled.length).fill(null);
      return [...filled, ...empties];
    }
    // 机缘标签使用独立背包
    if (category === 'jiyuan') {
      const slots = this.bag.save.jiYuanBag.slots;
      let filled = slots.filter(s => s !== null);
      filled.sort((a, b) => (a.obtainedAt || 0) - (b.obtainedAt || 0));
      const empties = Array(TOTAL_SLOTS - filled.length).fill(null);
      return [...filled, ...empties];
    }

    const slots = this.bag.save.bag.slots;
    let filled = slots.filter(s => s !== null);
    filled = filled.filter(s => s.poolKey === category);
    filled.sort((a, b) => (a.obtainedAt || 0) - (b.obtainedAt || 0));
    const empties = Array(TOTAL_SLOTS - filled.length).fill(null);
    return [...filled, ...empties];
  }

  // ==================== 渲染格子网格 ====================
  renderSlots(displayList) {
    this.bag.elements.legendaryTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    this.bag.elements.legendaryTweens = [];
    this.bag.elements.slotElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this.bag.elements.slotElements = [];
    // 独立管理角标元素，确保每次刷新正确销毁
    if (this.bag.elements.countTexts) {
      this.bag.elements.countTexts.forEach(t => { if (t && t.destroy) t.destroy(); });
    }
    this.bag.elements.countTexts = [];
    if (this.bag.elements.highlightGfx) { this.bag.elements.highlightGfx.destroy(); this.bag.elements.highlightGfx = null; }

    const isAll = this.bag.state.currentCat === 'all';
    const isJiYuan = this.bag.state.currentCat === 'jiyuan';
    // 'all' tab: 容量统计两个背包
    const mainFilled = this.bag.save.bag.slots.filter(s => s !== null).length;
    const jiYuanFilled = this.bag.save.jiYuanBag.slots.filter(s => s !== null).length;
    const filledCount = isAll ? (mainFilled + jiYuanFilled)
      : isJiYuan ? jiYuanFilled : mainFilled;

    if (filledCount >= TOTAL_SLOTS) {
      this.bag.elements.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#ff4444');
    } else if (filledCount >= TOTAL_SLOTS - 5) {
      this.bag.elements.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#ffaa44');
    } else {
      this.bag.elements.capacityText.setText(`${filledCount}/${TOTAL_SLOTS}`).setColor('#666677');
    }

    const hasVisible = displayList.some(s => s !== null);
    if (!hasVisible) {
      const msg = this.bag.state.currentCat === 'all' ? '缘法未至，储物袋中空空如也' : '此类道具尚未获得';
      const t = this.scene.add.text(GRID_X + GRID_W / 2, GRID_Y + GRID_H / 2, msg, {
        fontSize: '16px', color: '#555577', fontFamily: FONT,
      }).setOrigin(0.5);
      this.bag.elements.slotElements.push(t);
      return;
    }

    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const slot = displayList[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = GRID_X + col * (cellSize + GAP);
      const cy = GRID_Y + row * (cellSize + GAP);

      const isEmpty = slot === null;
      const isSelected = this.bag.state.selectedSlotIdx === i;

      const cellBg = this.scene.add.graphics();
      if (isEmpty) {
        cellBg.fillStyle(0x111122, 0.7);
        cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
        cellBg.lineStyle(3, 0x333355, 0.5);
        cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
        this.bag.elements.slotElements.push(cellBg);
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
      this.bag.elements.slotElements.push(cellBg);

      if (isSelected) {
        this.bag.elements.highlightGfx = this.scene.add.graphics();
        this.bag.elements.highlightGfx.lineStyle(3, 0xffffff, 0.9);
        this.bag.elements.highlightGfx.strokeRoundedRect(cx - 2, cy - 2, cellSize + 4, cellSize + 4, 5);
      }

      if (isLegendary) {
        const ft = this.scene.tweens.add({
          targets: cellBg,
          alpha: { from: 1, to: 0.6 },
          duration: 1000, yoyo: true, repeat: -1,
        });
        this.bag.elements.legendaryTweens.push(ft);
      }

      // 道具名
      const maxChars = 6;
      const name = item.name || '?';
      const displayName = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
      const nameText = this.scene.add.text(cx + cellSize / 2, cy + cellSize / 2 - 3, displayName, {
        fontSize: '11px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
        wordWrap: { width: cellSize - 6 }, align: 'center',
      }).setOrigin(0.5);
      this.bag.elements.slotElements.push(nameText);

      // ★ DEBUG: 打印每个slot的count
      console.log(`[renderSlots] i=${i} item=${item.name} rarity=${rarity} count=${slot.count}`);
      if (slot.count >= 1) {
        const isMaxStack = slot.count >= MAX_STACK_SIZE;
        // 半透明黑色背景（仅满堆叠时）
        if (isMaxStack) {
          const badgeW = 32, badgeH = 18;
          const badgeBg = this.scene.add.rectangle(
            cx + cellSize - badgeW / 2 - 3, cy + cellSize - badgeH / 2 - 2,
            badgeW, badgeH, 0x000000, 0.55
          ).setDepth(10);
          this.bag.elements.countTexts.push(badgeBg);
        }
        const fontSize = slot.count >= 10 ? '10px' : '11px';
        const badgeColor = isMaxStack ? '#ffd700' : slot.count >= 10 ? '#ffcc44' : '#ffffff';
        const ct = this.scene.add.text(cx + cellSize - 5, cy + cellSize - 6, `×${slot.count}`, {
          fontSize, color: badgeColor, fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(1, 1).setDepth(10);
        this.bag.elements.countTexts.push(ct);
      }

      // 交互
      const zone = this.scene.add.zone(cx + cellSize / 2, cy + cellSize / 2, cellSize, cellSize)
        .setInteractive({ useHandCursor: true });
      this.bag.elements.slotElements.push(zone);

      const displayIdx = i;
      zone.on('pointerdown', () => {
        const cellCenterX = cx + cellSize / 2;
        const cellCenterY = cy + cellSize / 2;
        if (this.bag.state.selectedSlotIdx === displayIdx) {
          // 再次点击：取消选中，关闭弹窗
          this.bag.state.selectedSlotIdx = -1;
          this.bag.state.selectedSlot = null;
          if (this.bag.onItemClick) {
            this.bag.onItemClick(displayIdx, null, cellCenterX, cellCenterY);
          }
        } else {
          this.bag.state.selectedSlotIdx = displayIdx;
          this.bag.state.selectedSlot = slot;
          if (isJiYuan) {
            if (this.bag.onJiYuanClick) {
              this.bag.onJiYuanClick(displayIdx, slot, cellCenterX, cellCenterY);
            }
          } else {
            if (this.bag.onItemClick) {
              this.bag.onItemClick(displayIdx, slot, cellCenterX, cellCenterY);
            }
          }
        }
      });

      zone.on('pointerover', () => {
        if (this.bag.state.selectedSlotIdx !== displayIdx) {
          cellBg.clear();
          cellBg.fillStyle(fillColor, 0.95);
          cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
          cellBg.lineStyle(3, 0x888899, 0.9);
          cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
        }
      });
      zone.on('pointerout', () => {
        if (this.bag.state.selectedSlotIdx !== displayIdx) {
          cellBg.clear();
          cellBg.fillStyle(fillColor, 0.8);
          cellBg.fillRoundedRect(cx, cy, cellSize, cellSize, 3);
          cellBg.lineStyle(3, borderColor, 0.8);
          cellBg.strokeRoundedRect(cx, cy, cellSize, cellSize, 3);
        }
      });
    }
  }
}
