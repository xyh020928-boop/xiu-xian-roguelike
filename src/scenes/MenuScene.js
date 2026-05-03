import Phaser from 'phaser';
import { WIDTH, HEIGHT, GAME_VERSION } from '../config.js';
import { loadSettings, saveSettings } from '../utils/settings.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';
const RX = WIDTH * 0.72; // 右侧面板 x 中线

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.settings = loadSettings();

    // ---- 星空背景（全屏随机星点） ----
    const stars = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * WIDTH;
      const sy = Math.random() * HEIGHT;
      const sr = Math.random() * 1.5 + 0.5;
      const alpha = Math.random() * 0.6 + 0.3;
      stars.fillStyle(0xffffff, alpha);
      stars.fillCircle(sx, sy, sr);
    }

    // 左侧几颗稍大的星
    for (let i = 0; i < 8; i++) {
      const sx = Math.random() * WIDTH * 0.5;
      const sy = Math.random() * HEIGHT;
      stars.fillStyle(0xffffff, 0.5 + Math.random() * 0.5);
      stars.fillCircle(sx, sy, 2 + Math.random() * 3);
    }

    // ---- 标题 ----
    this.add.text(RX, HEIGHT * 0.28, '问　道', {
      fontSize: '72px',
      color: '#f0c040',
      fontFamily: FONT,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // ---- 副标题 ----
    this.add.text(RX, HEIGHT * 0.38, '— 一苇渡江，以劫证道 —', {
      fontSize: '16px',
      color: '#a08020',
      fontFamily: FONT,
    }).setOrigin(0.5);

    // ---- 三个按钮 ----
    const btnStartY = HEIGHT * 0.52;
    const btnGap = 70;

    this._createMenuButton(RX, btnStartY, '开始游戏', () => {
      this.scene.start('SaveSelectScene', { mode: 'play' });
    });

    this._createMenuButton(RX, btnStartY + btnGap, '存　档', () => {
      this.scene.start('SaveSelectScene', { mode: 'manage' });
    });

    this._createMenuButton(RX, btnStartY + btnGap * 2, '设　置', () => {
      this._showSettingsPanel();
    });

    // ---- 版本号 ----
    this.add.text(WIDTH - 16, HEIGHT - 16, GAME_VERSION, {
      fontSize: '12px',
      color: '#666666',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(1, 1);

    // 设置面板元素容器（初始隐藏）
    this._settingsElements = [];
    this._confirmElements = [];
    this._settingsVisible = false;
  }

  // ==================== 菜单按钮 ====================
  _createMenuButton(x, y, label, callback) {
    // 左侧装饰竖线（初始隐藏）
    const lineX = x - 100;
    const lineH = 28;
    const line = this.add.graphics();
    line.lineStyle(2, 0xf0c040, 0);
    line.lineBetween(lineX, y - lineH / 2, lineX, y + lineH / 2);

    // 箭头 ▶（初始隐藏）
    const arrow = this.add.text(lineX - 16, y, '▶', {
      fontSize: '16px',
      color: '#f0c040',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    // 文字
    const text = this.add.text(x, y, label, {
      fontSize: '28px',
      color: '#cccccc',
      fontFamily: FONT,
    }).setOrigin(0.5);

    // 交互区域
    const zone = this.add.zone(x, y, 280, 50).setInteractive({ useHandCursor: true });

    let tweenRef = null;

    zone.on('pointerover', () => {
      // 竖线渐显
      line.clear();
      line.lineStyle(2, 0xf0c040, 1);
      line.lineBetween(lineX, y - lineH / 2, lineX, y + lineH / 2);
      arrow.setAlpha(1);

      // 文字右移 + 变色
      if (tweenRef) tweenRef.stop();
      tweenRef = this.tweens.add({
        targets: text,
        x: x + 4,
        color: '#f0c040',
        duration: 200,
        ease: 'Power2',
      });
    });

    zone.on('pointerout', () => {
      line.clear();
      line.lineStyle(2, 0xf0c040, 0);
      line.lineBetween(lineX, y - lineH / 2, lineX, y + lineH / 2);
      arrow.setAlpha(0);

      if (tweenRef) tweenRef.stop();
      tweenRef = this.tweens.add({
        targets: text,
        x: x,
        color: '#cccccc',
        duration: 200,
        ease: 'Power2',
      });
    });

    zone.on('pointerdown', callback);
  }

  // ==================== 设置面板 ====================
  _showSettingsPanel() {
    if (this._settingsVisible) return;
    this._settingsVisible = true;

    const PANEL_W = 440;
    const PANEL_H = 360;
    const px = (WIDTH - PANEL_W) / 2;
    const py = (HEIGHT - PANEL_H) / 2;

    // 遮罩
    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);
    this._settingsElements.push(overlay);

    // 面板背景
    const panel = this.add.graphics().setDepth(101);
    panel.fillStyle(0x1a0a2e, 0.95);
    panel.fillRoundedRect(px, py, PANEL_W, PANEL_H, 8);
    panel.lineStyle(2, 0xf0c040);
    panel.strokeRoundedRect(px, py, PANEL_W, PANEL_H, 8);
    this._settingsElements.push(panel);

    // 标题
    const title = this.add.text(WIDTH / 2, py + 24, '── 设置 ──', {
      fontSize: '22px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);
    this._settingsElements.push(title);

    // 分割线
    const div = this.add.graphics().setDepth(101);
    div.lineStyle(1, 0x333355);
    div.lineBetween(px + 20, py + 42, px + PANEL_W - 20, py + 42);
    this._settingsElements.push(div);

    // 音效音量滑块
    this._buildSlider(px + 50, py + 58, 140, '音效音量', this.settings.sfxVolume, 100, 0x4488ff,
      (v) => { this.settings.sfxVolume = v; });

    // 背景音乐滑块
    this._buildSlider(px + 50, py + 112, 140, '背景音乐', this.settings.musicVolume, 100, 0x44cc88,
      (v) => { this.settings.musicVolume = v; });

    // 画面缩放
    const zoomY = py + 166;
    this._settingsElements.push(
      this.add.text(px + 30, zoomY, '画面缩放', {
        fontSize: '14px', color: '#888888', fontFamily: FONT,
      }).setDepth(101)
    );

    const zoomValues = [0.75, 1.0, 1.25];
    const zoomLabels = ['75%', '100%', '125%'];
    zoomValues.forEach((z, i) => {
      const zx = px + 160 + i * 66;
      const zy = zoomY - 2;
      const isActive = this.settings.zoom === z;

      const zg = this.add.graphics().setDepth(101);
      zg.fillStyle(isActive ? 0x224488 : 0x222244, 0.7);
      zg.fillRoundedRect(zx, zy, 48, 24, 4);
      zg.lineStyle(1, isActive ? 0x4488ff : 0x444466);
      zg.strokeRoundedRect(zx, zy, 48, 24, 4);
      this._settingsElements.push(zg);

      const zt = this.add.text(zx + 24, zy + 1, zoomLabels[i], {
        fontSize: '13px', color: '#cccccc', fontFamily: FONT,
      }).setOrigin(0.5).setDepth(101);
      this._settingsElements.push(zt);

      const zzone = this.add.zone(zx + 24, zy + 12, 48, 24)
        .setInteractive({ useHandCursor: true }).setDepth(102);
      this._settingsElements.push(zzone);

      zzone.on('pointerdown', () => {
        this.settings.zoom = z;
        this.scale.setZoom(z);
        this._closeSettings();
        saveSettings(this.settings);
        this._showSettingsPanel(); // 重开以刷新
      });
    });

    // 全屏模式
    const fsY = zoomY + 45;
    this._settingsElements.push(
      this.add.text(px + 30, fsY, '全屏模式', {
        fontSize: '14px', color: '#888888', fontFamily: FONT,
      }).setDepth(101)
    );

    const isFS = this.scale.isFullscreen;
    const fsBtn = this.add.text(px + PANEL_W - 100, fsY + 2, isFS ? '开' : '关', {
      fontSize: '14px', color: '#cccccc', fontFamily: FONT,
      backgroundColor: isFS ? '#224422' : '#222244',
      padding: { x: 16, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(101);
    this._settingsElements.push(fsBtn);

    fsBtn.on('pointerdown', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
      this.time.delayedCall(300, () => {
        this.settings.fullscreen = this.scale.isFullscreen;
        saveSettings(this.settings);
        this._closeSettings();
        this._showSettingsPanel(); // 重开以刷新
      });
    });

    // 关闭按钮
    const closeBtn = this.add.text(WIDTH / 2, py + PANEL_H - 28, '关闭', {
      fontSize: '16px', color: '#aaaacc', fontFamily: FONT,
      backgroundColor: '#1a1a2e',
      padding: { x: 32, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(101);
    this._settingsElements.push(closeBtn);

    closeBtn.on('pointerdown', () => {
      saveSettings(this.settings);
      this._closeSettings();
    });
  }

  _buildSlider(x, y, w, label, value, max, color, onChange) {
    const trackH = 6;
    const thumbR = 8;

    // 标签
    const lt = this.add.text(x - 20, y + 2, label, {
      fontSize: '14px', color: '#888888', fontFamily: FONT,
    }).setDepth(101);
    this._settingsElements.push(lt);

    // 轨道背景
    const trBg = this.add.graphics().setDepth(101);
    trBg.fillStyle(0x333355);
    trBg.fillRoundedRect(x, y + 8 - trackH / 2, w, trackH, 3);
    this._settingsElements.push(trBg);

    // 轨道填充
    const trFill = this.add.graphics().setDepth(101);
    this._settingsElements.push(trFill);

    // 拇指
    const thumb = this.add.graphics().setDepth(101);
    this._settingsElements.push(thumb);

    // 数值文本
    const valT = this.add.text(x + w + 14, y + 8, String(value), {
      fontSize: '14px', color: '#cccccc', fontFamily: FONT,
    }).setOrigin(0, 0.5).setDepth(101);
    this._settingsElements.push(valT);

    // 拖拽区
    const zone = this.add.zone(x + w / 2, y + 8, w + thumbR * 4, thumbR * 4)
      .setInteractive({ useHandCursor: true }).setDepth(102);
    this._settingsElements.push(zone);

    let dragging = false;

    const update = (px2) => {
      const ratio = Phaser.Math.Clamp((px2 - x) / w, 0, 1);
      const v = Math.round(ratio * max);
      trFill.clear();
      const fw = (v / max) * w;
      if (fw > 0) {
        trFill.fillStyle(color);
        trFill.fillRoundedRect(x, y + 8 - trackH / 2, fw, trackH, 3);
      }
      thumb.clear();
      thumb.fillStyle(color);
      thumb.fillCircle(x + fw, y + 8, thumbR);
      valT.setText(String(v));
      onChange(v);
      return v;
    };

    zone.on('pointerdown', (pointer) => {
      dragging = true;
      update(pointer.x);
    });

    this.input.on('pointermove', (pointer) => { if (dragging) update(pointer.x); });
    this.input.on('pointerup', () => { dragging = false; });

    // 初始状态
    update(x + (value / max) * w);
  }

  _closeSettings() {
    this._settingsVisible = false;
    this._settingsElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._settingsElements = [];
  }
}
