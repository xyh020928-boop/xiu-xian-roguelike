import Phaser from 'phaser';
import { WIDTH, HEIGHT, HERBS, MAX_STACK_SIZE } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { addToBagBatch } from '../utils/helpers.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class AlchemyForge {
  constructor(scene, alchemy) {
    this.scene = scene;
    this.alchemy = alchemy; // { save, slotId, selectedRecipe, lingqiCount, furnaceElements, resultElements, onAlchemyComplete, onRefreshHerbPanel, onRebuildHerbPanel }
    this._furnaceContentX = 0;
    this._furnaceContentY = 0;
    this._furnaceElements = [];
    this._resultElements = [];
    this._furnaceDynEls = [];
  }

  // ==================== 丹炉面板 ====================
  buildFurnacePanel() {
    this._furnaceElements = [];

    const panelX = 270, panelY = 56, panelW = 420;

    // 背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a0a0a, 0.9);
    bg.fillRoundedRect(panelX, panelY, panelW, HEIGHT - panelY - 20, 8);
    bg.lineStyle(1.5, 0x442222);
    bg.strokeRoundedRect(panelX, panelY, panelW, HEIGHT - panelY - 20, 8);
    this._furnaceElements.push(bg);

    // 标题
    const title = this.scene.add.text(panelX + panelW / 2, panelY + 14, '丹 炉', {
      fontSize: '18px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._furnaceElements.push(title);

    // 丹炉图形
    this._drawFurnace(panelX + panelW / 2, panelY + 120);

    // 材料投入区（动态）
    this._furnaceContentY = panelY + 230;
    this._furnaceContentX = panelX;

    // 底部炼药按钮（动态）
    this._buildAlchemyButton(panelX, panelW);
  }

  _drawFurnace(cx, cy) {
    const g = this.scene.add.graphics();
    g.setDepth(1);

    // 炉腿
    g.fillStyle(0x444444);
    g.fillRect(cx - 50, cy + 50, 10, 30);
    g.fillRect(cx - 10, cy + 55, 10, 30);
    g.fillRect(cx + 40, cy + 50, 10, 30);

    // 炉体（椭圆用多点fillRect模拟）
    const bodyW = 120, bodyH = 90;
    g.fillStyle(0x333333);
    g.fillRoundedRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, 20);

    // 炉体边框
    g.lineStyle(2, 0x555555);
    g.strokeRoundedRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, 20);

    // 发光纹路
    g.lineStyle(1, 0x00ffcc, 0.6);
    g.lineBetween(cx - 45, cy - 25, cx + 45, cy - 25);
    g.lineBetween(cx - 40, cy - 5, cx + 40, cy - 5);
    g.lineBetween(cx - 35, cy + 15, cx + 35, cy + 15);

    // 炉盖（梯形用三角形近似 + 顶部矩形）
    g.fillStyle(0x3a3a3a);
    g.fillTriangle(cx - 35, cy - 45, cx + 35, cy - 45, cx + 22, cy - 62);
    g.fillTriangle(cx - 35, cy - 45, cx - 22, cy - 62, cx + 22, cy - 62);
    g.lineStyle(1.5, 0x555555);
    g.strokeTriangle(cx - 35, cy - 45, cx + 35, cy - 45, cx + 22, cy - 62);
    g.strokeTriangle(cx - 35, cy - 45, cx - 22, cy - 62, cx + 22, cy - 62);

    // 顶部圆钮
    g.fillStyle(0xcc8844);
    g.fillCircle(cx, cy - 62, 6);
    g.lineStyle(1, 0xffaa44);
    g.strokeCircle(cx, cy - 62, 6);

    // 炉口
    g.fillStyle(0xff6600, 0.3);
    g.fillCircle(cx, cy - 20, 15);

    this._furnaceElements.push(g);
    this._furnaceGfx = g;
  }

  /** 微光动画：丹炉发光 */
  _playFurnaceGlow(callback) {
    if (!this._furnaceGfx) return;
    let cycles = 0;
    this.scene.time.addEvent({
      delay: 400, repeat: 5,
      callback: () => {
        if (!this._furnaceGfx || !this._furnaceGfx.active) return;
        if (cycles % 2 === 0) {
          this._furnaceGfx.setAlpha(0.3);
        } else {
          this._furnaceGfx.setAlpha(1);
        }
        cycles++;
        if (cycles >= 6 && callback) {
          this.scene.time.delayedCall(200, callback);
        }
      },
    });
  }

  _buildAlchemyButton(panelX, panelW) {
    const btnW = 200, btnH = 44;
    const btnX = panelX + panelW / 2 - btnW / 2;
    const btnY = HEIGHT - 110;

    if (this._alchemyBtnGfx) { this._alchemyBtnGfx.destroy(); }

    this._alchemyBtnGfx = this.scene.add.graphics();
    const canDo = this.alchemy.selectedRecipe && this._canAffordRecipe(this.alchemy.selectedRecipe);

    const drawBtn = (fill, stroke) => {
      if (!this._alchemyBtnGfx) return;
      this._alchemyBtnGfx.clear();
      this._alchemyBtnGfx.fillStyle(fill, 0.85);
      this._alchemyBtnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this._alchemyBtnGfx.lineStyle(2.5, stroke);
      this._alchemyBtnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    };

    drawBtn(canDo ? 0x442200 : 0x1a1a1a, canDo ? 0xf0a040 : 0x444444);

    if (this._alchemyBtnTxt) this._alchemyBtnTxt.destroy();
    this._alchemyBtnTxt = this.scene.add.text(btnX + btnW / 2, btnY + btnH / 2, '开始炼丹', {
      fontSize: '20px', color: canDo ? '#f0c040' : '#555555',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    if (this._alchemyBtnZone) this._alchemyBtnZone.destroy();
    this._alchemyBtnZone = this.scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    this._alchemyBtnZone.on('pointerover', () => drawBtn(canDo ? 0x553310 : 0x1a1a1a, canDo ? 0xffcc44 : 0x444444));
    this._alchemyBtnZone.on('pointerout', () => drawBtn(canDo ? 0x442200 : 0x1a1a1a, canDo ? 0xf0a040 : 0x444444));
    this._alchemyBtnZone.on('pointerdown', () => {
      if (canDo) this._startAlchemy();
    });
  }

  _refreshFurnace() {
    // 清理旧的动态元素
    if (this._furnaceDynEls) {
      this._furnaceDynEls.forEach(el => { if (el && el.destroy) el.destroy(); });
    }
    this._furnaceDynEls = [];

    if (!this.alchemy.selectedRecipe) {
      const hint = this.scene.add.text(this._furnaceContentX + 210, this._furnaceContentY + 40,
        '请在左侧选择一个丹方', {
          fontSize: '14px', color: '#555555', fontFamily: FONT,
        }).setOrigin(0.5);
      this._furnaceDynEls.push(hint);
    } else {
      this._drawMaterialInput();
      this._drawLingqiControl();
    }

    this._buildAlchemyButton(270, 420);

    // 成丹率显示
    const rateY = HEIGHT - 150;
    const baseRate = this.alchemy.selectedRecipe ? this.alchemy.selectedRecipe.baseRate : 0;
    const finalRate = Math.min(baseRate + this.alchemy.lingqiCount * 0.05, 1.0);
    const rateColor = finalRate >= 0.8 ? '#44ff44' : finalRate >= 0.5 ? '#ffcc44' : '#ff6644';
    const rateTxt = this.scene.add.text(480, rateY, `成丹率：${Math.floor(finalRate * 100)}%`, {
      fontSize: '16px', color: rateColor, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._furnaceDynEls.push(rateTxt);
  }

  _drawMaterialInput() {
    const recipe = this.alchemy.selectedRecipe;
    let curY = this._furnaceContentY;

    const title = this.scene.add.text(this._furnaceContentX + 210, curY, '材料投入', {
      fontSize: '14px', color: '#889988', fontFamily: FONT,
    }).setOrigin(0.5);
    this._furnaceDynEls.push(title);
    curY += 28;

    for (const [hid, need] of Object.entries(recipe.herbs)) {
      const herb = HERBS[hid];
      const has = this.alchemy.save.herbs[hid] || 0;
      const ok = has >= need;
      const txt = this.scene.add.text(this._furnaceContentX + 210, curY,
        `${herb.name}：需要${need}，拥有${has}`, {
          fontSize: '12px', color: ok ? '#88cc88' : '#cc4444', fontFamily: FONT,
        }).setOrigin(0.5);
      this._furnaceDynEls.push(txt);
      curY += 20;
    }
  }

  _drawLingqiControl() {
    let curY = this._furnaceContentY + 110;
    const cx = this._furnaceContentX + 210;

    const label = this.scene.add.text(cx, curY, '加入灵气碎片提升成丹率', {
      fontSize: '13px', color: '#44ffee', fontFamily: FONT,
    }).setOrigin(0.5);
    this._furnaceDynEls.push(label);
    curY += 24;

    const maxLingqi = Math.min(5, this._countLingqi());
    const btnSize = 36;

    // [-] 按钮
    const minusGfx = this.scene.add.graphics();
    const drawMinus = () => {
      minusGfx.clear();
      minusGfx.fillStyle(this.alchemy.lingqiCount > 0 ? 0x1a2a2a : 0x151515, 0.8);
      minusGfx.fillRoundedRect(cx - 80, curY - btnSize / 2, btnSize, btnSize, 4);
      minusGfx.lineStyle(1.5, this.alchemy.lingqiCount > 0 ? 0x44ffee : 0x333333);
      minusGfx.strokeRoundedRect(cx - 80, curY - btnSize / 2, btnSize, btnSize, 4);
    };
    drawMinus();
    const minusTxt = this.scene.add.text(cx - 80 + btnSize / 2, curY, '-', {
      fontSize: '20px', color: this.alchemy.lingqiCount > 0 ? '#44ffee' : '#444444',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._furnaceDynEls.push(minusGfx, minusTxt);

    const minusZone = this.scene.add.zone(cx - 80 + btnSize / 2, curY, btnSize, btnSize)
      .setInteractive({ useHandCursor: true });
    minusZone.on('pointerdown', () => {
      if (this.alchemy.lingqiCount > 0) { this.alchemy.lingqiCount--; this._refreshFurnace(); }
    });
    this._furnaceDynEls.push(minusZone);

    // 数量显示
    const countTxt = this.scene.add.text(cx, curY, `${this.alchemy.lingqiCount}个`, {
      fontSize: '16px', color: '#44ffee', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._furnaceDynEls.push(countTxt);

    // [+] 按钮
    const plusGfx = this.scene.add.graphics();
    const drawPlus = () => {
      plusGfx.clear();
      plusGfx.fillStyle(this.alchemy.lingqiCount < maxLingqi ? 0x1a2a2a : 0x151515, 0.8);
      plusGfx.fillRoundedRect(cx + 80 - btnSize / 2, curY - btnSize / 2, btnSize, btnSize, 4);
      plusGfx.lineStyle(1.5, this.alchemy.lingqiCount < maxLingqi ? 0x44ffee : 0x333333);
      plusGfx.strokeRoundedRect(cx + 80 - btnSize / 2, curY - btnSize / 2, btnSize, btnSize, 4);
    };
    drawPlus();
    const plusTxt = this.scene.add.text(cx + 80, curY, '+', {
      fontSize: '20px', color: this.alchemy.lingqiCount < maxLingqi ? '#44ffee' : '#444444',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._furnaceDynEls.push(plusGfx, plusTxt);

    const plusZone = this.scene.add.zone(cx + 80, curY, btnSize, btnSize)
      .setInteractive({ useHandCursor: true });
    plusZone.on('pointerdown', () => {
      if (this.alchemy.lingqiCount < maxLingqi) { this.alchemy.lingqiCount++; this._refreshFurnace(); }
    });
    this._furnaceDynEls.push(plusZone);

    // 可持有量提示
    const hasTxt = this.scene.add.text(cx, curY + 24, `（持有${this._countLingqi()}个，最多加5个）`, {
      fontSize: '11px', color: '#555566', fontFamily: FONT,
    }).setOrigin(0.5);
    this._furnaceDynEls.push(hasTxt);
  }

  // ==================== 开始炼丹 ====================
  _startAlchemy() {
    if (!this.alchemy.selectedRecipe) return;
    if (!this._canAffordRecipe(this.alchemy.selectedRecipe)) {
      this._showFlashMsg('材料不足，无法炼丹');
      return;
    }

    const recipe = this.alchemy.selectedRecipe;

    // 扣除材料
    for (const [hid, need] of Object.entries(recipe.herbs)) {
      this.alchemy.save.herbs[hid] = (this.alchemy.save.herbs[hid] || 0) - need;
    }

    // 扣除灵气碎片
    if (this.alchemy.lingqiCount > 0) {
      this._removeLingqi(this.alchemy.lingqiCount);
    }

    // 炼丹动画（2秒）
    this._playFurnaceGlow(() => {
      const finalRate = Math.min(recipe.baseRate + this.alchemy.lingqiCount * 0.05, 1.0);
      const success = Math.random() < finalRate;

      this._showAlchemyResult(success, recipe);
    });
  }

  _showAlchemyResult(success, recipe) {
    this._clearResult();

    const cx = 480, cy = HEIGHT / 2;

    if (success) {
      // 金色光效
      const glow = this.scene.add.graphics().setDepth(100);
      glow.fillStyle(0xffd700, 0);
      glow.fillCircle(cx, cy - 20, 80);
      glow.fillStyle(0xffd700, 0);
      glow.fillCircle(cx, cy - 20, 40);
      this._resultElements.push(glow);
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0, to: 0.6 },
        duration: 300,
        yoyo: true, hold: 200, repeat: 2,
      });

      // 产出
      const prod = recipe.produce;
      if (prod.type === 'pill') {
        // 丹药存入普通背包
        const pillItem = {
          id: prod.id, name: prod.name, rarity: 'common', desc: prod.desc,
          poolKey: 'dan',
        };
        // 使用 addToBagBatch 批量存入，支持堆叠至MAX_STACK_SIZE
        this._addPillToBag(pillItem, prod.count);
      } else if (prod.type === 'perm') {
        // 永久buff
        if (!this.alchemy.save.permBuffs) this.alchemy.save.permBuffs = { maxHpPct: 0, atkPct: 0, maxHpFlat: 0, atkFlat: 0 };
        if (prod.effect.maxHpFlat) this.alchemy.save.permBuffs.maxHpFlat = (this.alchemy.save.permBuffs.maxHpFlat || 0) + prod.effect.maxHpFlat * prod.count;
        if (prod.effect.atkFlat) this.alchemy.save.permBuffs.atkFlat = (this.alchemy.save.permBuffs.atkFlat || 0) + prod.effect.atkFlat * prod.count;
        if (prod.effect.maxHpPct) this.alchemy.save.permBuffs.maxHpPct = (this.alchemy.save.permBuffs.maxHpPct || 0) + prod.effect.maxHpPct * prod.count;
        if (prod.effect.atkPct) this.alchemy.save.permBuffs.atkPct = (this.alchemy.save.permBuffs.atkPct || 0) + prod.effect.atkPct * prod.count;
      }

      SaveManager.save(this.alchemy.slotId, this.alchemy.save);

      const resultText = this.scene.add.text(cx, cy, `炼制成功！\n获得${prod.name}×${prod.count}`, {
        fontSize: '20px', color: '#ffd700', fontFamily: FONT, fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5).setDepth(101);
      this._resultElements.push(resultText);
      this.scene.tweens.add({
        targets: resultText,
        y: cy - 30,
        alpha: { from: 0, to: 1 },
        duration: 400,
      });
    } else {
      // 失败黑烟
      for (let i = 0; i < 8; i++) {
        const smoke = this.scene.add.graphics().setDepth(100);
        smoke.fillStyle(0x222222, 0.6);
        const sr = 8 + Math.random() * 20;
        smoke.fillCircle(0, 0, sr);
        smoke.setPosition(cx + (Math.random() - 0.5) * 80, cy - 30 + Math.random() * 40);
        this._resultElements.push(smoke);

        this.scene.tweens.add({
          targets: smoke,
          y: smoke.y - 60 - Math.random() * 40,
          alpha: 0,
          duration: 1500 + Math.random() * 500,
        });
      }

      const failText = this.scene.add.text(cx, cy, '炼丹失败\n材料尽数损耗', {
        fontSize: '20px', color: '#ff4444', fontFamily: FONT, fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5).setDepth(101);
      this._resultElements.push(failText);
      this.scene.tweens.add({
        targets: failText,
        alpha: { from: 0, to: 1 },
        duration: 400,
      });
    }

    // 3秒后清除结果
    this.scene.time.delayedCall(3000, () => {
      this._clearResult();
    });

    // 刷新界面
    this.alchemy.lingqiCount = 0;
    this._refreshFurnace();
    // 重建药材库
    if (this.alchemy.onRebuildHerbPanel) this.alchemy.onRebuildHerbPanel();
  }

  _addPillToBag(item, count) {
    if (!this.alchemy.save.bag || !Array.isArray(this.alchemy.save.bag.slots)) {
      this.alchemy.save.bag = { slots: Array(60).fill(null) };
    }
    return addToBagBatch(this.alchemy.save, item, count);
  }

  _clearResult() {
    if (this._resultElements) {
      this._resultElements.forEach(el => { if (el && el.destroy) el.destroy(); });
      this._resultElements = [];
    }
  }

  // ==================== 工具 ====================
  _canAffordRecipe(recipe) {
    for (const [hid, need] of Object.entries(recipe.herbs)) {
      if ((this.alchemy.save.herbs[hid] || 0) < need) return false;
    }
    return true;
  }

  _countLingqi() {
    if (!this.alchemy.save || !this.alchemy.save.jiYuanBag || !Array.isArray(this.alchemy.save.jiYuanBag.slots)) return 0;
    let total = 0;
    for (const slot of this.alchemy.save.jiYuanBag.slots) {
      if (slot && slot.itemId === 'mat_004') total += slot.count;
    }
    return total;
  }

  _removeLingqi(count) {
    if (!this.alchemy.save || !this.alchemy.save.jiYuanBag || !Array.isArray(this.alchemy.save.jiYuanBag.slots)) return;
    let remaining = count;
    for (let i = 0; i < this.alchemy.save.jiYuanBag.slots.length && remaining > 0; i++) {
      const slot = this.alchemy.save.jiYuanBag.slots[i];
      if (slot && slot.itemId === 'mat_004') {
        const take = Math.min(slot.count, remaining);
        slot.count -= take;
        if (slot.count <= 0) this.alchemy.save.jiYuanBag.slots[i] = null;
        remaining -= take;
      }
    }
  }

  _showFlashMsg(msg) {
    const t = this.scene.add.text(WIDTH / 2, HEIGHT - 60, msg, {
      fontSize: '15px', color: '#ffaa44', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2000).setAlpha(0);
    this.scene.tweens.add({
      targets: t, alpha: { from: 1, to: 0 },
      y: HEIGHT - 70, duration: 1500, delay: 100,
      onComplete: () => t.destroy(),
    });
  }
}
