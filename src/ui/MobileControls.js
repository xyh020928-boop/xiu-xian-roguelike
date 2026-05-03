import { WIDTH, HEIGHT } from '../config.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class MobileControls {
  constructor(scene) {
    this.scene = scene;

    // 仅在触屏设备上启用
    if (!scene.sys.game.device.input.touch) {
      this.enabled = false;
      return;
    }
    this.enabled = true;

    // 移动状态（update里持续读取）
    this.leftHeld = false;
    this.rightHeld = false;
    this.jumpHeld = false;

    // 动作按钮（单次触发，由场景消费后清零）
    this._meleeQueued = false;
    this._rangedQueued = false;

    this._elements = [];
    this._createMovementButtons();
    this._createActionButtons();
  }

  // ==================== 左/右下角移动按键 ← → ====================
  _createMovementButtons() {
    const btnR = 32;
    const y = HEIGHT - 70;

    // ← 左移
    this._leftBtn = this._makeCircleBtn(70, y, btnR, 0x3355aa, 0.32, '←', '#aaccff');
    this._leftBtn.zone
      .on('pointerdown', () => { this.leftHeld = true; this._setPressed(this._leftBtn, true); })
      .on('pointerup', () => { this.leftHeld = false; this._setPressed(this._leftBtn, false); })
      .on('pointerout', () => { this.leftHeld = false; this._setPressed(this._leftBtn, false); });

    // → 右移
    this._rightBtn = this._makeCircleBtn(150, y, btnR, 0x3355aa, 0.32, '→', '#aaccff');
    this._rightBtn.zone
      .on('pointerdown', () => { this.rightHeld = true; this._setPressed(this._rightBtn, true); })
      .on('pointerup', () => { this.rightHeld = false; this._setPressed(this._rightBtn, false); })
      .on('pointerout', () => { this.rightHeld = false; this._setPressed(this._rightBtn, false); });
  }

  // ==================== 右下角动作按钮：攻 / 剑 / 跳 ====================
  _createActionButtons() {
    const btnR = 30;
    const baseY = HEIGHT - 110;

    // 攻（近战） — 左上
    this._meleeBtn = this._makeCircleBtn(WIDTH - 130, baseY, btnR, 0xcc3333, 0.34, '攻', '#ffaaaa');
    this._meleeBtn.zone.on('pointerdown', () => {
      this._meleeQueued = true;
      this._flashPress(this._meleeBtn);
    });

    // 剑（剑气） — 右上
    this._swordBtn = this._makeCircleBtn(WIDTH - 50, baseY, btnR, 0x7733cc, 0.34, '剑', '#ccbbff');
    this._swordBtn.zone.on('pointerdown', () => {
      this._rangedQueued = true;
      this._flashPress(this._swordBtn);
    });

    // 跳（跳跃） — 下方正中
    const jumpR = 34;
    this._jumpBtn = this._makeCircleBtn(WIDTH - 90, HEIGHT - 40, jumpR, 0x228833, 0.34, '跳', '#aaffaa');
    this._jumpBtn.zone
      .on('pointerdown', () => { this.jumpHeld = true; this._setPressed(this._jumpBtn, true); })
      .on('pointerup', () => { this.jumpHeld = false; this._setPressed(this._jumpBtn, false); })
      .on('pointerout', () => { this.jumpHeld = false; this._setPressed(this._jumpBtn, false); });
  }

  // ==================== 按钮构建工具 ====================
  _makeCircleBtn(cx, cy, r, color, alpha, label, labelColor) {
    const bg = this.scene.add.circle(cx, cy, r, color, alpha).setDepth(200);
    const border = this.scene.add.circle(cx, cy, r).setDepth(201);
    border.setStrokeStyle(1.5, color, 0.5);
    border.setFillStyle(0x000000, 0);

    const txt = this.scene.add.text(cx, cy, label, {
      fontSize: '18px', color: labelColor, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(202);

    // 扩大点击区域（1.2倍半径）
    const hitR = r * 1.2;
    const zone = this.scene.add.zone(cx, cy, hitR * 2, hitR * 2)
      .setInteractive({ useHandCursor: false }).setDepth(203);

    const btn = { bg, border, txt, zone, r, color, cx, cy };
    this._elements.push(bg, border, txt, zone);
    return btn;
  }

  _setPressed(btn, pressed) {
    if (!btn || !btn.bg || !btn.bg.active) return;
    if (pressed) {
      btn.bg.setFillStyle(0xffffff, 0.15);
      btn.border.setStrokeStyle(2, 0xffffff, 0.6);
    } else {
      btn.bg.setFillStyle(btn.color, 0.32);
      btn.border.setStrokeStyle(1.5, btn.color, 0.5);
    }
  }

  _flashPress(btn) {
    if (!btn || !btn.bg || !btn.bg.active) return;
    btn.bg.setFillStyle(btn.color, 0.65);
    btn.border.setStrokeStyle(2, 0xffffff, 0.7);
    this.scene.time.delayedCall(120, () => {
      if (btn.bg && btn.bg.active) {
        btn.bg.setFillStyle(btn.color, 0.34);
        btn.border.setStrokeStyle(1.5, btn.color, 0.5);
      }
    });
  }

  // ==================== 场景消费单次动作 ====================
  consumeMelee() {
    if (this._meleeQueued) { this._meleeQueued = false; return true; }
    return false;
  }
  consumeRanged() {
    if (this._rangedQueued) { this._rangedQueued = false; return true; }
    return false;
  }

  // ==================== 销毁 ====================
  destroy() {
    for (const el of this._elements) {
      if (el && el.destroy) el.destroy();
    }
    this._elements = [];
    this.enabled = false;
  }
}
