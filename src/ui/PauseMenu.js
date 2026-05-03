import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { loadSettings, saveSettings } from '../utils/settings.js';
import SaveManager from '../utils/SaveManager.js';

// 面板常量
const PANEL_W = 360;
const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class PauseMenu {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts - { sceneName, showRestart, hasPhysics }
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.visible = false;
    this.sceneName = opts.sceneName || '';
    this.showRestart = opts.showRestart || false;
    this.hasPhysics = opts.hasPhysics || false;

    this.settings = loadSettings();

    // 滑块拖拽监听清理用
    this._dragListeners = [];

    // 元素分组（用于面板切换）
    this._mainElements = [];
    this._settingsElements = [];
    this._confirmElements = [];
  }

  // ==================== 创建所有UI ====================
  create() {
    // 1. 先创建 container，确保所有按钮创建之前已初始化
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setVisible(false);

    // 2. 构建各面板（元素全部加到 container 里）
    this._buildOverlay();
    this._buildMainMenu();
    this._buildSettingsPanel();
    this._buildConfirmDialog();

    // 3. 初始隐藏所有面板
    this._hideAllPanels();
  }

  // ==================== 遮罩（所有面板共用，第一个加到 container） ====================
  _buildOverlay() {
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.75);
    this.overlay.fillRect(0, 0, WIDTH, HEIGHT);
    this.container.add(this.overlay);
  }

  // ==================== 文字按钮工厂 ====================
  /** 创建一个居中文字按钮，添加到 container，返回按钮对象 */
  _addTextBtn(x, y, label, color, bgColor, callback) {
    const btn = this.scene.add.text(x, y, label, {
      fontSize: '20px',
      color: color || '#ffffff',
      backgroundColor: bgColor || '#2a2a4a',
      padding: { x: 28, y: 10 },
      fontFamily: FONT,
    }).setOrigin(0.5);

    btn.setInteractive({ useHandCursor: true });

    if (callback) {
      btn.on('pointerdown', callback);
    }
    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1));

    this.container.add(btn);
    return btn;
  }

  // ==================== 主菜单面板 ====================
  _buildMainMenu() {
    const btnCount = this.showRestart ? 6 : 5;
    const contentH = 30 + 20 + 12 + btnCount * 48 - 14;
    const panelH = contentH + 50;
    const px = (WIDTH - PANEL_W) / 2;
    const py = (HEIGHT - panelH) / 2;

    // 面板背景
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a0a2e, 0.95);
    panel.fillRoundedRect(px, py, PANEL_W, panelH, 8);
    panel.lineStyle(2, 0xf0c040);
    panel.strokeRoundedRect(px, py, PANEL_W, panelH, 8);
    this.container.add(panel);
    this._mainElements.push(panel);

    // 标题
    const title = this.scene.add.text(WIDTH / 2, py + 26, '── 问道 ──', {
      fontSize: '24px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);
    this._mainElements.push(title);

    // 场景名
    const sceneLabel = this.scene.add.text(WIDTH / 2, py + 50, `当前：${this.sceneName}`, {
      fontSize: '14px', color: '#666688', fontFamily: FONT,
    }).setOrigin(0.5);
    this.container.add(sceneLabel);
    this._mainElements.push(sceneLabel);

    // 分割线
    const div = this.scene.add.graphics();
    div.lineStyle(1, 0x333355);
    div.lineBetween(px + 20, py + 64, px + PANEL_W - 20, py + 64);
    this.container.add(div);
    this._mainElements.push(div);

    // 按钮
    const btnStartY = py + 88;
    const btnGap = 48;
    let btnIdx = 0;
    const isGameScene = this.scene.scene.key === 'GameScene';

    // 继续
    const continueBtn = this._addTextBtn(WIDTH / 2, btnStartY + btnIdx * btnGap,
      '继续', '#ffffff', '#2a2a3e', () => this.hide());
    this._mainElements.push(continueBtn);
    btnIdx++;

    // 手动保存
    const saveBtn = this._addTextBtn(WIDTH / 2, btnStartY + btnIdx * btnGap,
      '手动保存', '#44ffaa', '#1a2a1a', () => {
        const save = this.scene.registry.get('currentSave');
        const slotId = this.scene.registry.get('currentSlotId');
        if (save && slotId >= 0) {
          save.playtime = save.playtime || 0;
          SaveManager.save(slotId, save);
          const hint = this.scene.add.text(
            this.scene.scale.width / 2,
            this.scene.scale.height / 2 - 60,
            '✦ 保存成功',
            { fontSize: '20px', color: '#f0c040', fontFamily: FONT }
          ).setOrigin(0.5).setDepth(3000);
          this.scene.tweens.add({
            targets: hint, alpha: 0, y: hint.y - 30,
            delay: 800, duration: 600,
            onComplete: () => hint.destroy()
          });
        }
      });
    this._mainElements.push(saveBtn);
    btnIdx++;

    // 重新开始（仅 GameScene）
    if (this.showRestart && isGameScene) {
      const restartBtn = this._addTextBtn(WIDTH / 2, btnStartY + btnIdx * btnGap,
        '重新开始', '#ffcc44', '#2a2a1a', () => {
          this.hide();
          this.scene.scene.restart();
        });
      this._mainElements.push(restartBtn);
      btnIdx++;
    }

    // 设置
    const settingsBtn = this._addTextBtn(WIDTH / 2, btnStartY + btnIdx * btnGap,
      '设置', '#ffffff', '#2a2a3e', () => this._showSettingsPanel());
    this._mainElements.push(settingsBtn);
    btnIdx++;

    // 返回大厅
    const hallBtn = this._addTextBtn(WIDTH / 2, btnStartY + btnIdx * btnGap,
      '返回大厅', '#ffffff', '#2a2a3e', () => {
        if (this.showRestart) {
          this._showConfirm('确认要离开吗？当前局进度将丢失', () => {
            this.hide();
            this.scene.scene.start('HallScene');
          });
        } else {
          this.scene.scene.start('HallScene');
        }
      });
    this._mainElements.push(hallBtn);
    btnIdx++;

    // 返回主菜单
    const menuBtn = this._addTextBtn(WIDTH / 2, btnStartY + btnIdx * btnGap,
      '返回主菜单', '#ff8844', '#2a2a2a', () => {
        this._showConfirm('确认返回主菜单？进度不保存', () => {
          this.scene.scene.start('MenuScene');
        });
      });
    this._mainElements.push(menuBtn);
  }

  // ==================== 设置面板 ====================
  _buildSettingsPanel() {
    const btnCount = this.showRestart ? 6 : 5;
    const contentH = 30 + 20 + 12 + btnCount * 48 - 14;
    const panelH = contentH + 50;
    const px = (WIDTH - PANEL_W) / 2;
    const py = (HEIGHT - panelH) / 2;

    // 面板背景（与主面板同位置同尺寸）
    const settingsBg = this.scene.add.graphics();
    settingsBg.fillStyle(0x1a0a2e, 0.95);
    settingsBg.fillRoundedRect(px, py, PANEL_W, panelH, 8);
    settingsBg.lineStyle(2, 0xf0c040);
    settingsBg.strokeRoundedRect(px, py, PANEL_W, panelH, 8);
    this.container.add(settingsBg);
    this._settingsElements.push(settingsBg);

    // 返回按钮（文字按钮）
    const backBtn = this._addTextBtn(px + 70, py + 22, '← 返回', '#8888cc', undefined, () => this._showMainMenu());
    this._settingsElements.push(backBtn);

    // 分割线
    const div = this.scene.add.graphics();
    div.lineStyle(1, 0x333355);
    div.lineBetween(px + 20, py + 42, px + PANEL_W - 20, py + 42);
    this.container.add(div);
    this._settingsElements.push(div);

    // 音效音量滑块
    const sY1 = py + 64;
    const sliderW = 160;
    const sliderX = px + 50;
    this._sfxSlider = this._buildSlider(sliderX, sY1, sliderW,
      '音效音量', this.settings.sfxVolume, 100, 0x4488ff,
      (v) => { this.settings.sfxVolume = v; }
    );

    // 背景音乐滑块
    const sY2 = sY1 + 54;
    this._musicSlider = this._buildSlider(sliderX, sY2, sliderW,
      '背景音乐', this.settings.musicVolume, 100, 0x44cc88,
      (v) => { this.settings.musicVolume = v; }
    );

    // 画面缩放
    const zoomY = sY2 + 54;
    const zoomLabel = this.scene.add.text(px + 30, zoomY, '画面缩放', {
      fontSize: '14px', color: '#888888', fontFamily: FONT,
    });
    this.container.add(zoomLabel);
    this._settingsElements.push(zoomLabel);

    const zooms = [0.75, 1.0, 1.25];
    const zoomLabels = ['75%', '100%', '125%'];
    this._zoomBtns = [];
    zooms.forEach((z, i) => {
      const zx = px + 160 + i * 66;
      const zy = zoomY - 2;
      const isActive = this.settings.zoom === z;

      const zg = this.scene.add.graphics();
      this._drawZoomBtn(zg, zx, zy, isActive);
      this.container.add(zg);
      this._settingsElements.push(zg);

      const ztxt = this.scene.add.text(zx + 24, zy + 1, zoomLabels[i], {
        fontSize: '13px', color: '#cccccc', fontFamily: FONT,
      }).setOrigin(0.5);
      this.container.add(ztxt);
      this._settingsElements.push(ztxt);

      const zzone = this.scene.add.zone(zx + 24, zy + 12, 48, 24)
        .setInteractive({ useHandCursor: true });
      this.container.add(zzone);
      this._settingsElements.push(zzone);

      zzone.on('pointerdown', () => {
        this.settings.zoom = z;
        this.scene.scale.setZoom(z);
        this._zoomBtns.forEach((b, bi) => {
          this._drawZoomBtn(b.gfx, b.zx, b.zy, bi === i);
        });
      });

      this._zoomBtns.push({ gfx: zg, zx, zy });
    });

    // 全屏模式
    const fsY = zoomY + 45;
    const fsLabelText = this.scene.add.text(px + 30, fsY, '全屏模式', {
      fontSize: '14px', color: '#888888', fontFamily: FONT,
    });
    this.container.add(fsLabelText);
    this._settingsElements.push(fsLabelText);

    const fsBtnX = px + PANEL_W - 140;
    const fsBtn = this.scene.add.text(fsBtnX + 55, fsY, '', {
      fontSize: '14px', color: '#cccccc', fontFamily: FONT,
      backgroundColor: '#222244',
      padding: { x: 16, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.container.add(fsBtn);
    this._settingsElements.push(fsBtn);

    const updateFsLabel = () => {
      const isFS = this.scene.scale.isFullscreen;
      fsBtn.setText(isFS ? '开' : '关');
      fsBtn.setBackgroundColor(isFS ? '#224422' : '#222244');
    };
    updateFsLabel();

    fsBtn.on('pointerdown', () => {
      if (this.scene.scale.isFullscreen) {
        this.scene.scale.stopFullscreen();
      } else {
        this.scene.scale.startFullscreen();
      }
      this.settings.fullscreen = this.scene.scale.isFullscreen;
      this.scene.time.delayedCall(300, () => {
        this.settings.fullscreen = this.scene.scale.isFullscreen;
        updateFsLabel();
      });
    });
  }

  _drawZoomBtn(gfx, x, y, active) {
    gfx.clear();
    gfx.fillStyle(active ? 0x224488 : 0x222244, 0.7);
    gfx.fillRoundedRect(x, y, 48, 24, 4);
    gfx.lineStyle(1, active ? 0x4488ff : 0x444466);
    gfx.strokeRoundedRect(x, y, 48, 24, 4);
  }

  // ==================== 滑块控件 ====================
  _buildSlider(x, y, w, label, value, max, color, onChange) {
    const trackH = 6;
    const thumbR = 8;
    const px = (WIDTH - PANEL_W) / 2;

    // 标签
    const labelTxt = this.scene.add.text(px + 30, y - 2, label, {
      fontSize: '14px', color: '#888888', fontFamily: FONT,
    });
    this.container.add(labelTxt);
    this._settingsElements.push(labelTxt);

    // 滑块轨道背景
    const trackBg = this.scene.add.graphics();
    trackBg.fillStyle(0x333355);
    trackBg.fillRoundedRect(x, y + 8 - trackH / 2, w, trackH, 3);
    this.container.add(trackBg);
    this._settingsElements.push(trackBg);

    // 滑块轨道填充
    const trackFill = this.scene.add.graphics();
    this.container.add(trackFill);
    this._settingsElements.push(trackFill);

    // 滑块拇指
    const thumb = this.scene.add.graphics();
    this.container.add(thumb);
    this._settingsElements.push(thumb);

    // 数值文本
    const valTxt = this.scene.add.text(x + w + 14, y + 8, String(value), {
      fontSize: '14px', color: '#cccccc', fontFamily: FONT,
    }).setOrigin(0, 0.5);
    this.container.add(valTxt);
    this._settingsElements.push(valTxt);

    // 拖拽区域
    const zone = this.scene.add.zone(x + w / 2, y + 8, w + thumbR * 4, thumbR * 4)
      .setInteractive({ useHandCursor: true });
    this.container.add(zone);
    this._settingsElements.push(zone);

    let dragging = false;

    const update = (px2) => {
      const ratio = Phaser.Math.Clamp((px2 - x) / w, 0, 1);
      const v = Math.round(ratio * max);
      trackFill.clear();
      const fw = (v / max) * w;
      if (fw > 0) {
        trackFill.fillStyle(color);
        trackFill.fillRoundedRect(x, y + 8 - trackH / 2, fw, trackH, 3);
      }
      thumb.clear();
      thumb.fillStyle(color);
      thumb.fillCircle(x + fw, y + 8, thumbR);
      valTxt.setText(String(v));
      onChange(v);
      return v;
    };

    zone.on('pointerdown', (pointer) => {
      dragging = true;
      update(pointer.x);
    });

    const onMove = (pointer) => { if (dragging) update(pointer.x); };
    const onUp = () => { dragging = false; };

    if (this.scene.input) {
      this.scene.input.on('pointermove', onMove);
      this.scene.input.on('pointerup', onUp);
    }
    this._dragListeners.push(
      { event: 'pointermove', fn: onMove },
      { event: 'pointerup', fn: onUp },
    );

    // 初始状态
    update(x + (value / max) * w);
  }

  // ==================== 确认弹窗 ====================
  _buildConfirmDialog() {
    const cw = 320, ch = 170;
    const cpx = (WIDTH - cw) / 2;
    const cpy = (HEIGHT - ch) / 2;

    // 遮罩
    const confirmOverlay = this.scene.add.graphics();
    confirmOverlay.fillStyle(0x000000, 0.5);
    confirmOverlay.fillRect(0, 0, WIDTH, HEIGHT);
    this.container.add(confirmOverlay);
    this._confirmElements.push(confirmOverlay);

    // 面板
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a0a2e, 0.95);
    panel.fillRoundedRect(cpx, cpy, cw, ch, 8);
    panel.lineStyle(2, 0x883333);
    panel.strokeRoundedRect(cpx, cpy, cw, ch, 8);
    this.container.add(panel);
    this._confirmElements.push(panel);

    // 消息文本（动态更新）
    this._confirmMsg = this.scene.add.text(WIDTH / 2, cpy + 36, '', {
      fontSize: '16px', color: '#ff8888', fontFamily: FONT,
      wordWrap: { width: 280 }, align: 'center',
    }).setOrigin(0.5);
    this.container.add(this._confirmMsg);
    this._confirmElements.push(this._confirmMsg);

    // 确认按钮
    const btn1X = WIDTH / 2 - 80;
    const btnY = cpy + 100;
    this._confirmBtn1 = this.scene.add.text(btn1X + 60, btnY + 19, '确认', {
      fontSize: '16px', color: '#ff6666', fontFamily: FONT,
      backgroundColor: '#442222',
      padding: { x: 24, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.container.add(this._confirmBtn1);
    this._confirmElements.push(this._confirmBtn1);

    // 取消按钮
    const btn2X = WIDTH / 2 + 80 - 120;
    this._confirmBtn2 = this.scene.add.text(btn2X + 60, btnY + 19, '取消', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: FONT,
      backgroundColor: '#2a2a3e',
      padding: { x: 24, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.container.add(this._confirmBtn2);
    this._confirmElements.push(this._confirmBtn2);

    // 存储回调引用
    this._confirmCallback = null;
    this._confirmBtn1.on('pointerdown', () => {
      this._hidePanel(this._confirmElements);
      const cb = this._confirmCallback;
      this._confirmCallback = null;
      if (cb) cb();
    });
    this._confirmBtn2.on('pointerdown', () => {
      this._hidePanel(this._confirmElements);
      this._confirmCallback = null;
    });
  }

  // ==================== 面板显隐控制 ====================
  _setElementsVisible(elements, vis) {
    for (const el of elements) {
      if (!el) continue;
      if (el.setVisible !== undefined) {
        el.setVisible(vis);
      }
    }
  }

  _hidePanel(elements) {
    this._setElementsVisible(elements, false);
  }

  _showPanel(elements) {
    this._setElementsVisible(elements, true);
  }

  _hideAllPanels() {
    this._hidePanel(this._mainElements);
    this._hidePanel(this._settingsElements);
    this._hidePanel(this._confirmElements);
  }

  _showMainMenu() {
    this._hidePanel(this._settingsElements);
    this._hidePanel(this._confirmElements);
    this._showPanel(this._mainElements);
  }

  _showSettingsPanel() {
    this._hidePanel(this._mainElements);
    this._hidePanel(this._confirmElements);
    this._showPanel(this._settingsElements);
  }

  _showConfirm(msg, onConfirm) {
    if (this._confirmMsg) {
      this._confirmMsg.setText(msg);
    }
    this._confirmCallback = onConfirm || null;
    this._showPanel(this._confirmElements);
  }

  // ==================== 公共API ====================
  show() {
    if (this.visible) return;
    this.visible = true;

    if (this.container) {
      this.container.setVisible(true);
    }
    this._showMainMenu();

    // 暂停物理（加保护）
    if (this.hasPhysics && this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.pause();
    }

    // 暂停场景 tween（加保护）
    if (this.scene.tweens) {
      this.scene.tweens.pauseAll();
    }
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;

    if (this.container) {
      this.container.setVisible(false);
    }
    this._hideAllPanels();

    // 恢复物理（加保护）
    if (this.hasPhysics && this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.resume();
    }

    // 恢复 tween（加保护）
    if (this.scene.tweens) {
      this.scene.tweens.resumeAll();
    }

    // 保存设置
    saveSettings(this.settings);
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    // 先保存设置
    if (this.visible) {
      saveSettings(this.settings);
    }

    // 移除拖拽监听
    for (const { event, fn } of this._dragListeners) {
      if (this.scene.input) {
        this.scene.input.off(event, fn);
      }
    }
    this._dragListeners = [];

    // 销毁 container（自动销毁所有子元素）
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }

    // 清空引用
    this._mainElements = [];
    this._settingsElements = [];
    this._confirmElements = [];
    this._confirmBtn1 = null;
    this._confirmBtn2 = null;
    this._confirmMsg = null;
    this._confirmCallback = null;
  }
}
