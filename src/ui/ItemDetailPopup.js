import { WIDTH, HEIGHT, MATERIALS, DECOMPOSE_YIELD, DECOMPOSE_LINGQI_CHANCE } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { GACHA_POOLS, RARITY_COLOR } from '../systems/GachaSystem.js';
import { addMaterialToJiYuan, findJiYuanItem, removeJiYuanItem } from '../utils/helpers.js';

// ==================== 布局常量 ====================
const FONT = '"Microsoft YaHei","SimHei",sans-serif';

const EQUIP_SLOTS = [
  { key: 'helmet', label: '头盔', icon: '冠', color: '#aaaaff' },
  { key: 'armor',  label: '护甲', icon: '甲', color: '#aaaaff' },
  { key: 'legs',   label: '护腿', icon: '裤', color: '#aaaaff' },
  { key: 'belt',   label: '腰带', icon: '带', color: '#aaaaff' },
  { key: 'weapon', label: '武器', icon: '剑', color: '#ffaa44' },
  { key: 'amulet', label: '护符', icon: '符', color: '#ff88ff' },
];

const EQUIP_SLOT_MAP = {
  fabao:  ['weapon', 'amulet'],
  gongfa: ['amulet'],
};

export default class ItemDetailPopup {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} bag - 背包上下文，提供：
   *   save, slotId,
   *   state: { selectedSlot, selectedSlotIdx, currentCat },
   *   findEquippedItem(item) → slotKey|null,
   *   guessPoolKey(item) → string,
   *   getDisplaySlots(cat) → array,
   *   rerenderSlots(slots),
   *   rebuildEquipmentPanel(),
   *   rebuildJiYuanPanel(),
   *   destroyRightPanel(),
   *   onShowEquipSelect(slot, poolKey),
   *   onEquip(slotKey, bagSlot),
   *   onUnequip(slotKey),
   *   showFlashMsg(msg)
   */
  constructor(scene, bag) {
    this.scene = scene;
    this.bag = bag;
    this._popupElements = [];
    this._equipSelectElements = [];
    this._popupData = null;
  }

  // ==================== 道具详情弹窗 ====================
  /**
   * @param {object} slot - { itemData, count, poolKey }
   * @param {number} anchorX - 弹出位置参考点 X
   * @param {number} anchorY - 弹出位置参考点 Y
   * @param {string} source - 'bag' | 'equip'
   * @param {string} equipSlotKey - 如果是装备槽来源，记录槽位key
   */
  showItemPopup(slot, anchorX, anchorY, source = 'bag', equipSlotKey = null) {
    this.closePopup();

    const PW = 280, PH = 320;
    const item = slot.itemData;
    const rarity = item.rarity || 'common';
    const rarityCfg = RARITY_COLOR[rarity] || RARITY_COLOR.common;
    const poolKey = slot.poolKey || this.bag.guessPoolKey(item);
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
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.4);
    overlay.fillRect(0, 0, WIDTH, HEIGHT).setDepth(200);
    const overlayZone = this.scene.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(200);
    overlayZone.on('pointerdown', () => {
      this.closePopup();
      if (source === 'bag') {
        this.bag.state.selectedSlotIdx = -1;
        this.bag.state.selectedSlot = null;
        this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
      }
    });
    this._popupElements.push(overlay, overlayZone);

    // 弹窗面板
    const panel = this.scene.add.graphics().setDepth(201);
    const rarityBorder = parseInt((rarityCfg.text || '#ffffff').slice(1), 16);
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRoundedRect(px, py, PW, PH, 6);
    panel.lineStyle(2, rarityBorder, 0.8);
    panel.strokeRoundedRect(px, py, PW, PH, 6);
    this._popupElements.push(panel);

    // 右上角关闭 ×
    const closeBtn = this.scene.add.text(px + PW - 18, py + 8, '✕', {
      fontSize: '16px', color: '#888888', fontFamily: 'Arial,sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202);
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
    closeBtn.on('pointerdown', () => {
      this.closePopup();
      if (source === 'bag') {
        this.bag.state.selectedSlotIdx = -1;
        this.bag.state.selectedSlot = null;
        this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
      }
    });
    this._popupElements.push(closeBtn);

    let curY = py + 10;

    // 稀有度标签
    const rarityLabel = this.scene.add.text(px + PW / 2, curY, rarityCfg.label, {
      fontSize: '11px', color: rarityCfg.text, fontFamily: FONT,
      fontStyle: 'bold',
      backgroundColor: '#' + rarityCfg.bg.toString(16).padStart(6, '0'),
      padding: { x: 10, y: 1 },
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(rarityLabel);
    curY += 22;

    // 道具名称
    const nameTxt = this.scene.add.text(px + PW / 2, curY, item.name || '?', {
      fontSize: '18px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(nameTxt);
    curY += 26;

    // 分隔线
    const sep1 = this.scene.add.graphics().setDepth(201);
    sep1.lineStyle(1, 0x444466, 0.5);
    sep1.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep1);
    curY += 8;

    // 来源
    const sourceTxt = this.scene.add.text(px + 20, curY, `来源：${poolName}池`, {
      fontSize: '11px', color: '#777788', fontFamily: FONT,
    }).setDepth(202);
    this._popupElements.push(sourceTxt);
    curY += 18;

    // 分隔线
    const sep2 = this.scene.add.graphics().setDepth(201);
    sep2.lineStyle(1, 0x444466, 0.5);
    sep2.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep2);
    curY += 10;

    // 效果
    const effTitle = this.scene.add.text(px + 20, curY, '效　果', {
      fontSize: '12px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setDepth(202);
    this._popupElements.push(effTitle);
    curY += 20;

    const effectText = item.desc || '（无描述）';
    const effTxt = this.scene.add.text(px + 24, curY, effectText, {
      fontSize: '12px', color: '#cccccc', fontFamily: FONT,
      wordWrap: { width: PW - 48 },
    }).setDepth(202);
    this._popupElements.push(effTxt);
    const effectLines = Math.max(1, Math.ceil((effectText.length * 7) / (PW - 48)));
    curY += effectLines * 15 + 10;

    // 分隔线
    const sep3 = this.scene.add.graphics().setDepth(201);
    sep3.lineStyle(1, 0x333355, 0.4);
    sep3.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep3);
    curY += 10;

    // 简介
    const descTitle = this.scene.add.text(px + 20, curY, '简　介', {
      fontSize: '12px', color: '#888899', fontFamily: FONT, fontStyle: 'bold',
    }).setDepth(202);
    this._popupElements.push(descTitle);
    curY += 20;

    const desc = item.desc || '暂无简介';
    const descTxt = this.scene.add.text(px + 24, curY, desc, {
      fontSize: '11px', color: '#777788', fontFamily: FONT, fontStyle: 'italic',
      wordWrap: { width: PW - 48 },
    }).setDepth(202);
    this._popupElements.push(descTxt);

    // 底部按钮
    const btnY = py + PH - 44;

    // 判断道具是否已装备
    const equipEntry = this.bag.findEquippedItem(item);
    const isEquipped = !!equipEntry;

    if (poolKey === 'dan') {
      // 丹药：使用按钮
      this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '使用', '#44ccaa', '#1a2a2a', '#44ccaa', () => {
        this.bag.showFlashMsg('请在秘境中使用');
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
        this.bag.onUnequip(equipSlotKey);
        this.closePopup();
      });
    } else if (poolKey === 'fabao' || poolKey === 'gongfa') {
      if (isEquipped) {
        // 已装备：显示卸下
        this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '卸下', '#ff8844', '#2a1a1a', '#ff8844', () => {
          this.bag.onUnequip(equipEntry);
          this.closePopup();
          this.bag.state.selectedSlotIdx = -1;
          this.bag.state.selectedSlot = null;
          this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
        });
      } else {
        // 可装备：装备按钮
        this._addPopupButton(px + PW / 2 - 60, btnY, 120, 30, '装备', '#f0c040', '#2a2a1a', '#f0c040', () => {
          this.showEquipSelectPopup(slot, poolKey);
        });
      }
    } else {
      // 其他（兜底）
      this._addPopupLabel(px + PW / 2, btnY + 8, '待实装', '#888866', '#1a1a1a');
    }
  }

  /** 在弹窗内添加按钮 */
  _addPopupButton(bx, by, bw, bh, label, textColor, bgColor, borderColor, callback) {
    const bg = this.scene.add.graphics().setDepth(202);
    bg.fillStyle(parseInt(bgColor.slice(1), 16), 0.8);
    bg.fillRoundedRect(bx, by, bw, bh, 5);
    bg.lineStyle(1.5, parseInt(borderColor.slice(1), 16));
    bg.strokeRoundedRect(bx, by, bw, bh, 5);
    this._popupElements.push(bg);

    const txt = this.scene.add.text(bx + bw / 2, by + bh / 2, label, {
      fontSize: '14px', color: textColor, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(202);
    this._popupElements.push(txt);

    const zone = this.scene.add.zone(bx + bw / 2, by + bh / 2, bw, bh)
      .setInteractive({ useHandCursor: true }).setDepth(203);
    this._popupElements.push(zone);
    zone.on('pointerdown', callback);
  }

  /** 在弹窗内添加静态标签 */
  _addPopupLabel(cx, cy, label, textColor, bgColor) {
    const txt = this.scene.add.text(cx, cy, label, {
      fontSize: '14px', color: textColor, fontFamily: FONT, fontStyle: 'bold',
      backgroundColor: bgColor,
      padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0.5).setDepth(202);
    this._popupElements.push(txt);
  }

  // ==================== 机缘详情弹窗 ====================
  showJiYuanPopup(slot, anchorX, anchorY) {
    this.closePopup();

    const PW = 280, PH = 260;
    const item = slot.itemData;
    const rarity = item.rarity || 'common';
    const rarityCfg = RARITY_COLOR[rarity] || RARITY_COLOR.common;
    const isMaterial = item.type === 'material';
    const isRelic = item.type === 'relic';

    // 弹窗定位
    let px = anchorX + 16;
    let py = anchorY - PH / 2;
    if (px + PW > WIDTH - 10) px = anchorX - PW - 16;
    if (px < 10) px = 10;
    if (py < 10) py = 10;
    if (py + PH > HEIGHT - 10) py = HEIGHT - PH - 10;

    this._popupData = { px, py, PW, PH, source: 'jiyuan', slot };
    this._popupElements = [];

    // 遮罩
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.4);
    overlay.fillRect(0, 0, WIDTH, HEIGHT).setDepth(200);
    const overlayZone = this.scene.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(200);
    overlayZone.on('pointerdown', () => {
      this.closePopup();
      this.bag.state.selectedSlotIdx = -1;
      this.bag.state.selectedSlot = null;
      this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
    });
    this._popupElements.push(overlay, overlayZone);

    // 面板
    const panel = this.scene.add.graphics().setDepth(201);
    const rarityBorder = parseInt((rarityCfg.text || '#ffffff').slice(1), 16);
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRoundedRect(px, py, PW, PH, 6);
    panel.lineStyle(2, rarityBorder, 0.8);
    panel.strokeRoundedRect(px, py, PW, PH, 6);
    this._popupElements.push(panel);

    // 关闭按钮
    const closeBtn = this.scene.add.text(px + PW - 18, py + 8, '✕', {
      fontSize: '16px', color: '#888888', fontFamily: 'Arial,sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202);
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
    closeBtn.on('pointerdown', () => {
      this.closePopup();
      this.bag.state.selectedSlotIdx = -1;
      this.bag.state.selectedSlot = null;
      this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
    });
    this._popupElements.push(closeBtn);

    let curY = py + 14;

    // 稀有度
    const rarityLabel = this.scene.add.text(px + PW / 2, curY, rarityCfg.label, {
      fontSize: '11px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
      backgroundColor: '#' + rarityCfg.bg.toString(16).padStart(6, '0'),
      padding: { x: 10, y: 1 },
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(rarityLabel);
    curY += 22;

    // 名称
    const nameTxt = this.scene.add.text(px + PW / 2, curY, item.name || '?', {
      fontSize: '18px', color: rarityCfg.text, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(nameTxt);
    curY += 24;

    // 数量
    const countTxt = this.scene.add.text(px + PW / 2, curY, `持有：${slot.count}`, {
      fontSize: '13px', color: '#888899', fontFamily: FONT,
    }).setOrigin(0.5, 0).setDepth(202);
    this._popupElements.push(countTxt);
    curY += 20;

    // 描述
    const sep = this.scene.add.graphics().setDepth(201);
    sep.lineStyle(1, 0x444466, 0.5);
    sep.lineBetween(px + 20, curY, px + PW - 20, curY);
    this._popupElements.push(sep);
    curY += 10;

    const descTxt = this.scene.add.text(px + 20, curY, item.desc || '暂无描述', {
      fontSize: '12px', color: '#aaaacc', fontFamily: FONT,
      wordWrap: { width: PW - 40 },
    }).setDepth(202);
    this._popupElements.push(descTxt);

    // ---- 底部操作按钮 ----
    const btnY = py + PH - 44;

    if (isRelic) {
      // 机缘词条 → 分解按钮
      const yieldData = DECOMPOSE_YIELD[rarity];
      const lingqiCfg = DECOMPOSE_LINGQI_CHANCE[rarity];
      const yieldStr = yieldData ? yieldData.map(y => `${MATERIALS[y.id].name}×${y.count}`).join('、') : '';
      let previewStr = `分解产出：${yieldStr}`;
      if (lingqiCfg) {
        previewStr += `（${Math.floor(lingqiCfg.chance * 100)}%概率额外获得灵气碎片×${lingqiCfg.count}）`;
      }
      const yieldTxt = this.scene.add.text(px + PW / 2, btnY - 28, previewStr, {
        fontSize: '11px', color: '#778899', fontFamily: FONT,
        wordWrap: { width: PW - 40 }, align: 'center',
      }).setOrigin(0.5, 0.5).setDepth(202);
      this._popupElements.push(yieldTxt);

      this._addPopupButton(px + PW / 2 - 60, btnY + 4, 120, 30, '分解为材料', '#ff8844', '#2a1a1a', '#ff8844', () => {
        this.doDecompose(slot);
        this.closePopup();
        this.bag.state.selectedSlotIdx = -1;
        this.bag.state.selectedSlot = null;
        this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
        this.bag.destroyRightPanel();
        this.bag.rebuildJiYuanPanel();
      });
    } else {
      // 材料/丹药 → 引导提示
      this._addPopupLabel(px + PW / 2, btnY + 8, '如需炼丹，请前往炼丹房', '#666688', '#1a1a1a');
    }
  }

  // ==================== 关闭弹窗 ====================
  closePopup() {
    if (this._popupElements) {
      this._popupElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._popupElements = null;
    }
    this._popupData = null;

    // 同时关闭装备选择弹窗
    this.closeEquipSelectPopup();
  }

  // ==================== 装备选择弹窗 ====================
  showEquipSelectPopup(bagSlot, poolKey) {
    this.closeEquipSelectPopup();

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
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, WIDTH, HEIGHT).setDepth(250);
    const overlayZone = this.scene.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(250);
    overlayZone.on('pointerdown', () => this.closeEquipSelectPopup());
    this._equipSelectElements.push(overlay, overlayZone);

    // 面板
    const panel = this.scene.add.graphics().setDepth(251);
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRoundedRect(px, py, PW, PH, 8);
    panel.lineStyle(2, 0xf0c040);
    panel.strokeRoundedRect(px, py, PW, PH, 8);
    this._equipSelectElements.push(panel);

    // 标题
    const title = this.scene.add.text(WIDTH / 2, py + 22, '选择装备槽位', {
      fontSize: '16px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(252);
    this._equipSelectElements.push(title);

    // 槽位按钮
    let curY = py + 52;
    availableSlots.forEach(slotKey => {
      const slotInfo = EQUIP_SLOTS.find(s => s.key === slotKey);
      const label = slotInfo ? slotInfo.label : slotKey;

      const bg = this.scene.add.graphics().setDepth(252);
      bg.fillStyle(0x222244, 0.7);
      bg.fillRoundedRect(px + 20, curY, PW - 40, slotH, 5);
      bg.lineStyle(1.5, 0x4466aa);
      bg.strokeRoundedRect(px + 20, curY, PW - 40, slotH, 5);
      this._equipSelectElements.push(bg);

      const txt = this.scene.add.text(WIDTH / 2, curY + slotH / 2, label, {
        fontSize: '15px', color: '#aaaacc', fontFamily: FONT,
      }).setOrigin(0.5).setDepth(252);
      this._equipSelectElements.push(txt);

      const zone = this.scene.add.zone(WIDTH / 2, curY + slotH / 2, PW - 40, slotH)
        .setInteractive({ useHandCursor: true }).setDepth(253);
      this._equipSelectElements.push(zone);

      zone.on('pointerdown', () => {
        this.bag.onEquip(slotKey, bagSlot);
        this.closePopup();
        this.closeEquipSelectPopup();
        this.bag.state.selectedSlotIdx = -1;
        this.bag.state.selectedSlot = null;
        this.bag.rerenderSlots(this.bag.getDisplaySlots(this.bag.state.currentCat));
      });

      curY += slotH + gap;
    });
  }

  closeEquipSelectPopup() {
    if (this._equipSelectElements) {
      this._equipSelectElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._equipSelectElements = null;
    }
  }

  // ==================== 分解 ====================
  doDecompose(slot) {
    const rarity = slot.itemData.rarity || 'common';
    const yieldData = DECOMPOSE_YIELD[rarity];
    if (!yieldData) return;

    // 检查机缘背包中该道具的第一个位置
    const idx = findJiYuanItem(this.bag.save, slot.itemData.id);
    if (idx < 0) return;

    // 移除1个
    if (!removeJiYuanItem(this.bag.save, idx, 1)) return;

    // 必得材料
    const parts = [];
    for (const y of yieldData) {
      addMaterialToJiYuan(this.bag.save, y.id, y.count);
      parts.push(`${MATERIALS[y.id].name}×${y.count}`);
    }

    // 灵气碎片概率产出
    const lingqiCfg = DECOMPOSE_LINGQI_CHANCE[rarity];
    if (lingqiCfg && Math.random() < lingqiCfg.chance) {
      addMaterialToJiYuan(this.bag.save, 'mat_004', lingqiCfg.count);
      parts.push(`灵气碎片×${lingqiCfg.count}`);
    }

    SaveManager.save(this.bag.slotId, this.bag.save);
    this.bag.showFlashMsg(`分解${slot.itemData.name}，获得：${parts.join('、')}`);
  }
}
