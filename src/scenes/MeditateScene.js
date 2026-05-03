import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName } from '../config.js';
import { loadSave, saveSave, checkBreakthrough } from '../utils/helpers.js';
import PauseMenu from '../ui/PauseMenu.js';

export default class MeditateScene extends Phaser.Scene {
  constructor() {
    super('MeditateScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#080818');

    // 读取存档
    this.save = loadSave();

    // 计算离线收益
    this.calcOfflineGains();

    // ============ 背景光点 ============
    this.createFloatingDots();

    // ============ 顶部栏 ============
    this.createTopBar();

    // ============ 打坐人物 + 光环 ============
    this.createFigure();

    // ============ 信息文字 ============
    this.createInfoTexts();

    // ============ 返回按钮 ============
    this.createBackButton();

    // ============ 挂机状态 ============
    this.idleStartTime = this.time.now;
    this.idleAccumulated = 0; // 本轮累计（显示用）
    this._lastSyncedAccum = 0; // 已同步到存档的累计值

    this._breakthroughShowing = false;

    this.refreshAll();

    // 暂停菜单
    this.pauseMenu = new PauseMenu(this, { sceneName: '静心修炼中' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => { this.pauseMenu.destroy(); });
  }

  // ==================== 背景光点 ====================
  createFloatingDots() {
    for (let i = 0; i < 30; i++) {
      const dot = this.add.circle(
        Math.random() * WIDTH, Math.random() * HEIGHT,
        Math.random() * 1.5 + 0.6,
        0x446688, 0.25
      ).setDepth(0);
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.05, to: 0.35 },
        duration: 2000 + Math.random() * 4000,
        yoyo: true, repeat: -1,
        delay: Math.random() * 3000,
      });
    }
  }

  // ==================== 离线收益 ====================
  calcOfflineGains() {
    this.offlineGain = 0;
    if (this.save.lastCaveTime > 0) {
      const elapsed = Date.now() - this.save.lastCaveTime;
      const minutes = Math.min(elapsed / 60000, 480);
      this.offlineGain = Math.floor(minutes * 10);
    }
  }

  // ==================== 顶部栏 ====================
  createTopBar() {
    // 标题
    this.add.text(WIDTH / 2, 28, '静心修炼', {
      fontSize: '36px', color: '#88ccff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 境界
    this.realmTextTop = this.add.text(WIDTH / 2, 62, '', {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // 修为进度条
    this.xiuweiBarBg = this.add.graphics();
    this.xiuweiBarFg = this.add.graphics();

    // 进度文字
    this.xiuweiTextTop = this.add.text(WIDTH / 2, 98, '', {
      fontSize: '13px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
  }

  // ==================== 打坐人物 ====================
  createFigure() {
    const cx = WIDTH / 2;
    const cy = 300;

    // 光环（在人物下方）
    this.halos = [];
    for (let i = 0; i < 3; i++) {
      const h = this.add.graphics().setDepth(5);
      h.lineStyle(1.5, 0x4488cc, 0.25 + i * 0.2);
      const rx = 55 + i * 18;
      const ry = 22 + i * 8;
      const segs = 64;
      for (let j = 0; j < segs; j++) {
        const a1 = (j / segs) * Math.PI * 2;
        const a2 = ((j + 1) / segs) * Math.PI * 2;
        h.lineBetween(
          Math.cos(a1) * rx, Math.sin(a1) * ry,
          Math.cos(a2) * rx, Math.sin(a2) * ry,
        );
      }
      h.setPosition(cx, cy);
      this.halos.push(h);
      this.tweens.add({
        targets: h,
        angle: i % 2 === 0 ? 360 : -360,
        duration: 4000 + i * 1200,
        repeat: -1,
      });
    }

    // 人物 Graphics
    const fig = this.add.graphics().setDepth(10);

    // 身体（道袍）
    fig.fillStyle(0x00aa88);
    fig.fillRoundedRect(cx - 16, cy - 6, 32, 44, 7);

    // 腰带
    fig.fillStyle(0xcc8844);
    fig.fillRect(cx - 16, cy + 14, 32, 4);

    // 头部
    fig.fillStyle(0x00cc99);
    fig.fillCircle(cx, cy - 26, 13);

    // 发髻
    fig.fillStyle(0x005544);
    fig.fillCircle(cx, cy - 37, 4);

    // 闭眼（两条小横线）
    fig.lineStyle(2, 0x004433);
    fig.lineBetween(cx - 5, cy - 27, cx - 2, cy - 27);
    fig.lineBetween(cx + 2, cy - 27, cx + 5, cy - 27);

    // 手臂（从肩部到膝前）
    fig.lineStyle(3.5, 0x008866);
    fig.lineBetween(cx - 14, cy + 2, cx - 28, cy + 18);
    fig.lineBetween(cx + 14, cy + 2, cx + 28, cy + 18);
    // 小臂
    fig.lineBetween(cx - 28, cy + 18, cx - 16, cy + 28);
    fig.lineBetween(cx + 28, cy + 18, cx + 16, cy + 28);

    // 双腿盘坐
    fig.lineStyle(5, 0x006644);
    fig.lineBetween(cx - 10, cy + 34, cx - 24, cy + 48);
    fig.lineBetween(cx + 10, cy + 34, cx + 24, cy + 48);
    fig.lineBetween(cx - 24, cy + 48, cx + 24, cy + 48);

    // 座下蒲团
    fig.fillStyle(0x886633, 0.6);
    fig.fillEllipse(cx, cy + 56, 60, 16);
  }

  // ==================== 信息文字 ====================
  createInfoTexts() {
    const cy = 420;

    // 修炼速度
    this.add.text(WIDTH / 2, cy, '修炼速度：10 修为 / 分钟', {
      fontSize: '16px', color: '#7799bb',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // 已修炼
    this.accumText = this.add.text(WIDTH / 2, cy + 32, '已修炼：0 修为', {
      fontSize: '20px', color: '#44ff88',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 离线收益提示（如有则显示后淡出）
    this.offlineGainText = this.add.text(WIDTH / 2, cy + 68, '', {
      fontSize: '15px', color: '#ffcc44',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setAlpha(0);
  }

  // ==================== 返回按钮 ====================
  createBackButton() {
    const btnW = 130, btnH = 36;
    const btnX = WIDTH - btnW - 30;
    const btnY = 16;

    const backGfx = this.add.graphics();
    const drawBtn = (fill, stroke) => {
      backGfx.clear();
      backGfx.fillStyle(fill, 0.8);
      backGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      backGfx.lineStyle(1.5, stroke);
      backGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    };
    drawBtn(0x1a1a2e, 0x4466aa);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '返回洞府', {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(0x2a2a3e, 0x6688cc));
    zone.on('pointerout', () => drawBtn(0x1a1a2e, 0x4466aa));
    zone.on('pointerdown', () => this.leaveScene());
  }

  // ==================== 离开场景 ====================
  leaveScene() {
    // 最终同步
    this.syncAccumToSave();

    this.tweens.killAll();
    this.time.removeAllEvents();
    this.save.lastCaveTime = Date.now();
    saveSave(this.save);
    this.scene.start('CaveScene');
  }

  // ==================== 同步累计修为到存档 ====================
  syncAccumToSave() {
    if (this.idleAccumulated > this._lastSyncedAccum) {
      const gain = this.idleAccumulated - this._lastSyncedAccum;
      this.save.xiuwei += gain;
      this._lastSyncedAccum = this.idleAccumulated;
      saveSave(this.save);
    }
  }

  // ==================== 刷新UI ====================
  refreshAll() {
    // 应用离线收益
    if (this.offlineGain > 0) {
      this.save.xiuwei += this.offlineGain;
      saveSave(this.save);

      this.offlineGainText.setText(`离线期间获得 ${this.offlineGain} 修为`);
      this.offlineGainText.setAlpha(1);
      this.tweens.add({
        targets: this.offlineGainText,
        alpha: 0, delay: 4000, duration: 1200,
      });
      this.offlineGain = 0;
    }

    // 境界
    this.realmTextTop.setText(`境界：${getRealmName(this.save.majorRealmIndex, this.save.layer)}`);

    // 进度条
    this.drawXiuweiBar();

    // 进度文字
    this.xiuweiTextTop.setText(`修为：${this.save.xiuwei} / ${this.save.xiuweiMax}`);

    // 检查突破
    checkBreakthrough(this, this.save, (type) => { this.refreshAll(); if (type === 'layer_up') this._animateBarRefill(); });
  }

  drawXiuweiBar() {
    this.xiuweiBarBg.clear();
    this.xiuweiBarFg.clear();
    const barX = WIDTH / 2 - 150, barY = 78, barW = 300, barH = 12;
    const ratio = Math.min(1, Math.max(0, this.save.xiuwei / this.save.xiuweiMax));
    this.xiuweiBarBg.fillStyle(0x222244);
    this.xiuweiBarBg.fillRoundedRect(barX, barY, barW, barH, 6);
    if (ratio > 0) {
      this.xiuweiBarFg.fillStyle(0x8844ff);
      this.xiuweiBarFg.fillRoundedRect(barX, barY, Math.floor(barW * ratio), barH, 6);
    }
  }

  // ==================== 晋级进度条动画 ====================
  _animateBarRefill() {
    const barX = WIDTH / 2 - 150, barY = 78, barW = 300, barH = 12;
    // 快速填满到 100%
    this.xiuweiBarFg.clear();
    this.xiuweiBarFg.fillStyle(0x44ff88); // 绿色提示晋级
    let currentW = 0;
    const targetW = barW;
    const duration = 300;
    const stepTime = 16;
    const steps = Math.ceil(duration / stepTime);
    const stepW = targetW / steps;
    let step = 0;

    const timer = this.time.addEvent({
      delay: stepTime,
      repeat: steps - 1,
      callback: () => {
        step++;
        currentW = Math.min(targetW, stepW * step);
        this.xiuweiBarFg.clear();
        this.xiuweiBarFg.fillStyle(0x44ff88);
        this.xiuweiBarFg.fillRoundedRect(barX, barY, Math.floor(currentW), barH, 6);
        if (step >= steps) {
          // 填满后重置为正常比例
          this.drawXiuweiBar();
        }
      },
    });
  }

  // ==================== 主循环 ====================
  update(time, delta) {
    if (this.pauseMenu && this.pauseMenu.visible) return;
    // 计算本轮累计修为
    const elapsedMin = (time - this.idleStartTime) / 60000;
    this.idleAccumulated = Math.floor(elapsedMin * 10);
    this.accumText.setText(`已修炼：${this.idleAccumulated} 修为`);

    // 有新增时同步到存档
    if (this.idleAccumulated > this._lastSyncedAccum) {
      const gain = this.idleAccumulated - this._lastSyncedAccum;
      this.save.xiuwei += gain;
      this._lastSyncedAccum = this.idleAccumulated;
      saveSave(this.save);

      // 更新HUD
      this.xiuweiTextTop.setText(`修为：${this.save.xiuwei} / ${this.save.xiuweiMax}`);
      this.drawXiuweiBar();

      // 检查突破
      checkBreakthrough(this, this.save, (type) => { this.refreshAll(); if (type === 'layer_up') this._animateBarRefill(); });
    }
  }
}
