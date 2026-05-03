import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import PauseMenu from '../ui/PauseMenu.js';
import BagGrid from '../ui/BagGrid.js';
import ItemDetailPopup from '../ui/ItemDetailPopup.js';
import EquipmentPanel from '../ui/EquipmentPanel.js';

// ==================== 布局常量 ====================
const FONT = '"Microsoft YaHei","SimHei",sans-serif';
const LEFT_PANEL_W = 120;
const GRID_Y = 60;

const CATEGORIES = [
  { key: 'all',    label: '全部',      icon: '◆' },
  { key: 'dan',    label: '丹药',      icon: '⚗' },
  { key: 'fabao',  label: '法宝',      icon: '⚔' },
  { key: 'tiancai', label: '天材地宝', icon: '💎' },
  { key: 'gongfa', label: '功法',      icon: '📜' },
  { key: 'jiyuan', label: '机缘',      icon: '◇', material: true },
];

export default class BagScene extends Phaser.Scene {
  constructor() {
    super('BagScene');
  }

  create() {
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');

    // ---- 兼容旧存档 ----
    const TOTAL_SLOTS = 60;
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
    if (!this.save.jiYuanBag || !Array.isArray(this.save.jiYuanBag.slots)) {
      this.save.jiYuanBag = { slots: Array(TOTAL_SLOTS).fill(null) };
    }
    if (this.save.jiYuanBag.slots.length !== TOTAL_SLOTS) {
      const old = this.save.jiYuanBag.slots;
      this.save.jiYuanBag.slots = Array(TOTAL_SLOTS).fill(null);
      for (let i = 0; i < Math.min(old.length, TOTAL_SLOTS); i++) this.save.jiYuanBag.slots[i] = old[i];
    }
    if (!this.save.permBuffs) {
      this.save.permBuffs = { maxHpPct: 0, atkPct: 0 };
    }

    this._currentCat = 'all';
    this._selectedSlotIdx = -1;
    this._selectedSlot = null;

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

    // ---- 共享状态对象 ----
    const bagData = {
      save: this.save,
      slotId: this.slotId,
      state: {
        selectedSlotIdx: this._selectedSlotIdx,
        selectedSlot: this._selectedSlot,
        currentCat: this._currentCat,
      },
      elements: {
        slotElements: [],
        countTexts: [],
        legendaryTweens: [],
        highlightGfx: null,
        capacityText: this.capacityText,
        rightPanelElements: [],
      },
      bagGrid: null,
      popup: null,
      equipPanel: null,
    };

    // ---- 创建模块实例 ----
    this.bagGrid = new BagGrid(this, bagData);
    this.popup = new ItemDetailPopup(this, bagData);
    this.equipPanel = new EquipmentPanel(this, bagData);
    bagData.bagGrid = this.bagGrid;
    bagData.popup = this.popup;
    bagData.equipPanel = this.equipPanel;

    // ---- 给模块提供回调 ----
    // ItemDetailPopup 需要的回调
    bagData.findEquippedItem = (item) => this.equipPanel.findEquippedItem(item);
    bagData.guessPoolKey = (item) => this._guessPoolKey(item);
    bagData.getDisplaySlots = (cat) => this.bagGrid.getDisplaySlots(cat);
    bagData.rerenderSlots = (displayList) => {
      this.bagGrid.renderSlots(displayList);
    };
    bagData.rebuildEquipmentPanel = () => {
      this.equipPanel.buildEquipmentPanel();
    };
    bagData.rebuildJiYuanPanel = () => {
      this.equipPanel.buildJiYuanPanel();
    };
    bagData.destroyRightPanel = () => {
      this.equipPanel.destroyRightPanel();
    };
    bagData.onShowEquipSelect = (slot, poolKey) => {
      this.popup.showEquipSelectPopup(slot, poolKey);
    };
    bagData.onEquip = (slotKey, bagSlot) => {
      this.equipPanel.doEquip(slotKey, bagSlot);
      this._afterBagChange();
    };
    bagData.onUnequip = (slotKey) => {
      this.equipPanel.doUnequip(slotKey);
      this._afterBagChange();
    };
    bagData.showFlashMsg = (msg) => this._showFlashMsg(msg);

    // BagGrid 需要的回调
    bagData.onItemClick = (displayIdx, slot, cx, cy) => {
      if (slot === null) return;
      this._selectedSlotIdx = displayIdx;
      this._selectedSlot = slot;
      bagData.state.selectedSlotIdx = displayIdx;
      bagData.state.selectedSlot = slot;
      this.popup.showItemPopup(slot, cx, cy, 'bag');
      this.bagGrid.renderSlots(this.bagGrid.getDisplaySlots(this._currentCat));
    };
    bagData.onJiYuanClick = (displayIdx, slot, cx, cy) => {
      if (slot === null) return;
      this._selectedSlotIdx = displayIdx;
      this._selectedSlot = slot;
      bagData.state.selectedSlotIdx = displayIdx;
      bagData.state.selectedSlot = slot;
      this.popup.showJiYuanPopup(slot, cx, cy);
      this.bagGrid.renderSlots(this.bagGrid.getDisplaySlots(this._currentCat));
    };

    // EquipmentPanel 需要的回调
    bagData.currentCat = this._currentCat;
    bagData.onRenderSlots = (displayList) => {
      this.bagGrid.renderSlots(displayList);
    };
    bagData.onShowItemPopup = (slot, anchorX, anchorY, source, equipSlotKey) => {
      this.popup.showItemPopup(slot, anchorX, anchorY, source, equipSlotKey);
    };
    bagData.onShowFlashMsg = (msg) => this._showFlashMsg(msg);
    bagData.onClosePopup = () => {
      this.popup.closePopup();
    };
    bagData.onEquipSlotClick = (slotKey, virtualSlot, x, y) => {
      this._selectedSlotIdx = -1;
      this._selectedSlot = null;
      this.popup.showItemPopup(virtualSlot, x, y, 'equip', slotKey);
    };
    bagData.onBagChanged = () => {
      this._afterBagChange();
    };

    this._bagData = bagData;

    // ---- 返回按钮 ----
    this._createBackButton();

    // ---- 左侧分类标签 ----
    this._createSidebar();

    // ---- 格子网格 ----
    this.bagGrid.renderSlots(this.bagGrid.getDisplaySlots('all'));

    // ---- 右侧装备栏 ----
    this.equipPanel.buildEquipmentPanel();

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
      if (this._bagData && this._bagData.elements && this._bagData.elements.legendaryTweens) {
        this._bagData.elements.legendaryTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
      }
      if (this.popup) this.popup.closePopup();
    });
  }

  // ==================== 背包变更后统一刷新 ====================
  _afterBagChange() {
    this._selectedSlotIdx = -1;
    this._selectedSlot = null;
    this._bagData.state.selectedSlotIdx = -1;
    this._bagData.state.selectedSlot = null;
    this.bagGrid.renderSlots(this.bagGrid.getDisplaySlots(this._currentCat));
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
      this.popup.closePopup();
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
        this.popup.closePopup();
        this._currentCat = cat.key;
        this._bagData.state.currentCat = cat.key;
        this._bagData.currentCat = cat.key;
        this._selectedSlotIdx = -1;
        this._selectedSlot = null;
        this._bagData.state.selectedSlotIdx = -1;
        this._bagData.state.selectedSlot = null;
        this._refreshTabs();
        this.bagGrid.renderSlots(this.bagGrid.getDisplaySlots(cat.key));
        // 切换右侧面板
        this.equipPanel.destroyRightPanel();
        if (cat.key === 'jiyuan') {
          this.equipPanel.buildJiYuanPanel();
        } else {
          this.equipPanel.buildEquipmentPanel();
        }
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

  _guessPoolKey(item) {
    if (!item || !item.id) return 'unknown';
    if (item.id.startsWith('dan_')) return 'dan';
    if (item.id.startsWith('fabao_')) return 'fabao';
    if (item.id.startsWith('tiancai_')) return 'tiancai';
    if (item.id.startsWith('gongfa_')) return 'gongfa';
    return 'unknown';
  }

  update() {
    if (this.pauseMenu && this.pauseMenu.visible) return;
  }
}
