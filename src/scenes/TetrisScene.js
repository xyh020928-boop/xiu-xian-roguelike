import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName } from '../config.js';
import { checkBreakthrough } from '../utils/helpers.js';
import SaveManager from '../utils/SaveManager.js';
import PauseMenu from '../ui/PauseMenu.js';

// 棋盘常量
const COLS = 10;
const ROWS = 20;
const CELL = 24;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const BOARD_X = 440;
const BOARD_Y = 170;

const PIECE_DEFS = [
  { name: 'I', shape: [[1, 1, 1, 1]], color: 0x00ffff },
  { name: 'O', shape: [[1, 1], [1, 1]], color: 0xffcc00 },
  { name: 'T', shape: [[0, 1, 0], [1, 1, 1]], color: 0xcc44ff },
  { name: 'S', shape: [[0, 1, 1], [1, 1, 0]], color: 0x44ff44 },
  { name: 'Z', shape: [[1, 1, 0], [0, 1, 1]], color: 0xff4444 },
  { name: 'J', shape: [[1, 0, 0], [1, 1, 1]], color: 0x4488ff },
  { name: 'L', shape: [[0, 0, 1], [1, 1, 1]], color: 0xff8844 },
];
const SCORE_TABLE = { 1: 15, 2: 40, 3: 90, 4: 200 };

export default class TetrisScene extends Phaser.Scene {
  constructor() {
    super('TetrisScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a1a');

    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');
    this._breakthroughShowing = false;

    // ============ 背景光点 ============
    for (let i = 0; i < 25; i++) {
      const dot = this.add.circle(
        Math.random() * WIDTH, Math.random() * HEIGHT,
        Math.random() * 1.2 + 0.5, 0x664422, 0.2
      ).setDepth(0);
      this.tweens.add({
        targets: dot, alpha: { from: 0.04, to: 0.25 },
        duration: 2000 + Math.random() * 3000, yoyo: true, repeat: -1,
        delay: Math.random() * 2000,
      });
    }

    // ============ 顶部栏 ============
    this.createTopBar();

    // ============ 右侧信息面板 ============
    this.createInfoPanel();

    // ============ 返回按钮 ============
    this.createBackButton();

    // ============ 键盘 ============
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    // ============ 棋盘渲染层 ============
    this.tetrisGfx = this.add.graphics().setDepth(10);
    this.tetrisStaticGfx = this.add.graphics().setDepth(9);
    this.tetrisPreviewGfx = this.add.graphics().setDepth(10);

    // DAS
    this._dasLeft = { held: false, first: 0, last: 0 };
    this._dasRight = { held: false, first: 0, last: 0 };
    this._dasDown = { held: false, first: 0, last: 0 };

    // 启动
    this.initTetris();
    this.refreshHUD();

    // 自动保存（30秒）
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

    // 暂停菜单
    this.pauseMenu = new PauseMenu(this, { sceneName: '淬炼心境中' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
    });
  }

  // ==================== 顶部栏 ====================
  createTopBar() {
    this.add.text(WIDTH / 2, 26, '淬炼心境', {
      fontSize: '34px', color: '#ff9944',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 58, '（以心御道，方块落定，修为自生）', {
      fontSize: '12px', color: '#666666',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // 境界名
    this.realmNameTop = this.add.text(WIDTH / 2, 78, '', {
      fontSize: '14px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // 小号修为进度
    this.xiuweiBarBg = this.add.graphics();
    this.xiuweiBarFg = this.add.graphics();
    this.xiuweiTextMini = this.add.text(WIDTH / 2, 108, '', {
      fontSize: '12px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
  }

  // ==================== 右侧信息面板 ====================
  createInfoPanel() {
    const px = BOARD_X + BOARD_W + 40; // 720
    const py = BOARD_Y;

    // 面板背景
    const panel = this.add.graphics();
    panel.fillStyle(0x111122, 0.5);
    panel.fillRoundedRect(px - 10, py - 10, 150, 400, 8);
    panel.lineStyle(1.5, 0x333355);
    panel.strokeRoundedRect(px - 10, py - 10, 150, 400, 8);

    // 下一个方块
    this.add.text(px + 40, py + 4, '下一个：', {
      fontSize: '14px', color: '#888888',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 本局修为
    this.tetrisScoreText = this.add.text(px + 10, py + 150, '本局修为：0', {
      fontSize: '16px', color: '#ffcc44',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 操作说明
    const helpY = py + 200;
    this.add.text(px + 10, helpY, '操作说明', {
      fontSize: '14px', color: '#777788',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    });
    const helps = [
      '← →  移动', '↑      旋转', '↓      加速', '空格  直落',
    ];
    helps.forEach((line, i) => {
      this.add.text(px + 10, helpY + 22 + i * 20, line, {
        fontSize: '13px', color: '#555566',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });
    });

    // 消行得分表
    const scoreY = helpY + 120;
    this.add.text(px + 10, scoreY, '消行修为', {
      fontSize: '14px', color: '#777788',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    });
    const scores = [
      '1行 +15', '2行 +40', '3行 +90', '4行 +200',
    ];
    scores.forEach((line, i) => {
      this.add.text(px + 10, scoreY + 22 + i * 18, line, {
        fontSize: '12px', color: '#555566',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });
    });

    // 游戏结束文字
    this.tetrisGameOverText = this.add.text(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2, '', {
      fontSize: '18px', color: '#ff4444',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setAlpha(0).setDepth(20);
  }

  // ==================== 返回按钮 ====================
  createBackButton() {
    const btnW = 130, btnH = 36;
    const btnX = WIDTH - btnW - 30;
    const btnY = 16;

    const gfx = this.add.graphics();
    const draw = (fill, stroke) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.8);
      gfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      gfx.lineStyle(1.5, stroke);
      gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    };
    draw(0x1a1a2e, 0x4466aa);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '返回洞府', {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x2a2a3e, 0x6688cc));
    zone.on('pointerout', () => draw(0x1a1a2e, 0x4466aa));
    zone.on('pointerdown', () => this.leaveScene());
  }

  leaveScene() {
    SaveManager.save(this.slotId, this.save);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.scene.start('CaveScene');
  }

  // ==================== 刷新HUD ====================
  refreshHUD() {
    this.realmNameTop.setText(`境界：${getRealmName(this.save.majorRealmIndex, this.save.layer)}`);
    this.drawXiuweiBar();
    this.xiuweiTextMini.setText(`修为：${this.save.xiuwei} / ${this.save.xiuweiMax}`);
  }

  drawXiuweiBar() {
    this.xiuweiBarBg.clear();
    this.xiuweiBarFg.clear();
    const barX = WIDTH / 2 - 120, barY = 92, barW = 240, barH = 8;
    const ratio = Math.min(1, Math.max(0, this.save.xiuwei / this.save.xiuweiMax));
    this.xiuweiBarBg.fillStyle(0x222244);
    this.xiuweiBarBg.fillRoundedRect(barX, barY, barW, barH, 4);
    if (ratio > 0) {
      this.xiuweiBarFg.fillStyle(0x8844ff);
      this.xiuweiBarFg.fillRoundedRect(barX, barY, Math.floor(barW * ratio), barH, 4);
    }
  }

  // ==================== 晋级进度条动画 ====================
  _animateBarRefill() {
    const barX = WIDTH / 2 - 120, barY = 92, barW = 240, barH = 8;
    this.xiuweiBarFg.clear();
    this.xiuweiBarFg.fillStyle(0x44ff88);
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
        this.xiuweiBarFg.fillRoundedRect(barX, barY, Math.floor(currentW), barH, 4);
        if (step >= steps) {
          this.drawXiuweiBar();
        }
      },
    });
  }

  // ==================== 初始化 ====================
  initTetris() {
    this.tetrisBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.tetrisScore = 0;
    this.tetrisPlaying = true;
    this.tetrisDropInterval = 800;
    this.tetrisLastDrop = this.time.now;
    this.tetrisGameOverTime = 0;
    this.tetrisGameOverText.setAlpha(0);
    this.tetrisPiece = null;
    this.tetrisNext = this.randomPiece();
    this.drawStaticBoard();
    this.spawnPiece();
  }

  randomPiece() {
    const def = PIECE_DEFS[Math.floor(Math.random() * PIECE_DEFS.length)];
    return { name: def.name, shape: def.shape.map(r => [...r]), color: def.color };
  }

  spawnPiece() {
    this.tetrisPiece = this.tetrisNext;
    this.tetrisNext = this.randomPiece();
    const px = Math.floor((COLS - this.tetrisPiece.shape[0].length) / 2);
    const py = 0;
    this.tetrisPiece.x = px;
    this.tetrisPiece.y = py;
    if (!this.isValid(this.tetrisPiece.shape, px, py)) {
      this.tetrisPlaying = false;
      this.tetrisGameOverTime = this.time.now;
      this.tetrisGameOverText.setText(`本局获得修为：${this.tetrisScore}`);
      this.tweens.add({ targets: this.tetrisGameOverText, alpha: 1, duration: 400 });
      this.time.delayedCall(3000, () => {
        if (this.tetrisPlaying === false && this.tetrisGameOverTime > 0) {
          this.initTetris();
        }
      });
    }
    this.drawPreview();
  }

  // ==================== 碰撞检测 ====================
  isValid(shape, px, py) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const bx = px + c, by = py + r;
          if (bx < 0 || bx >= COLS || by >= ROWS) return false;
          if (by >= 0 && this.tetrisBoard[by][bx] !== 0) return false;
        }
      }
    }
    return true;
  }

  // ==================== 旋转 ====================
  rotateShape(shape) {
    const rows = shape.length, cols = shape[0].length;
    const rot = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        rot[c][rows - 1 - r] = shape[r][c];
    return rot;
  }

  rotatePiece() {
    if (!this.tetrisPlaying || !this.tetrisPiece) return;
    const ns = this.rotateShape(this.tetrisPiece.shape);
    if (this.isValid(ns, this.tetrisPiece.x, this.tetrisPiece.y))
      this.tetrisPiece.shape = ns;
  }

  movePiece(dx, dy) {
    if (!this.tetrisPlaying || !this.tetrisPiece) return false;
    if (this.isValid(this.tetrisPiece.shape, this.tetrisPiece.x + dx, this.tetrisPiece.y + dy)) {
      this.tetrisPiece.x += dx;
      this.tetrisPiece.y += dy;
      return true;
    }
    return false;
  }

  hardDrop() {
    if (!this.tetrisPlaying || !this.tetrisPiece) return;
    while (this.movePiece(0, 1)) { /* drop */ }
    this.lockPiece();
    this.tetrisLastDrop = this.time.now;
  }

  getGhostY() {
    if (!this.tetrisPiece) return 0;
    let gy = this.tetrisPiece.y;
    while (this.isValid(this.tetrisPiece.shape, this.tetrisPiece.x, gy + 1)) gy++;
    return gy;
  }

  lockPiece() {
    if (!this.tetrisPiece) return;
    const { shape, x, y, color } = this.tetrisPiece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const by = y + r, bx = x + c;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS)
            this.tetrisBoard[by][bx] = color;
        }
      }
    }
    this.tetrisPiece = null;
    const cleared = this.clearLines();
    if (cleared > 0) {
      const gain = SCORE_TABLE[cleared] || 0;
      this.tetrisScore += gain;
      this.save.xiuwei += gain;
      SaveManager.save(this.slotId, this.save);
      this.refreshHUD();
      checkBreakthrough(this, this.save, this.slotId, (type) => { this.refreshHUD(); if (type === 'layer_up') this._animateBarRefill(); });
    }
    this.spawnPiece();
  }

  clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.tetrisBoard[r].every(cell => cell !== 0)) {
        this.tetrisBoard.splice(r, 1);
        this.tetrisBoard.unshift(Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    return cleared;
  }

  // ==================== 绘制 ====================
  drawStaticBoard() {
    this.tetrisStaticGfx.clear();
    this.tetrisStaticGfx.fillStyle(0x000000, 0.9);
    this.tetrisStaticGfx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    this.tetrisStaticGfx.lineStyle(0.5, 0x222244, 0.4);
    for (let c = 0; c <= COLS; c++)
      this.tetrisStaticGfx.lineBetween(BOARD_X + c * CELL, BOARD_Y, BOARD_X + c * CELL, BOARD_Y + BOARD_H);
    for (let r = 0; r <= ROWS; r++)
      this.tetrisStaticGfx.lineBetween(BOARD_X, BOARD_Y + r * CELL, BOARD_X + BOARD_W, BOARD_Y + r * CELL);
    this.tetrisStaticGfx.lineStyle(2, 0x444488);
    this.tetrisStaticGfx.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  }

  drawBoard() {
    this.tetrisGfx.clear();
    if (!this.tetrisPlaying) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (this.tetrisBoard[r][c] !== 0) {
            this.tetrisGfx.fillStyle(this.tetrisBoard[r][c], 0.35);
            this.tetrisGfx.fillRect(BOARD_X + c * CELL + 1, BOARD_Y + r * CELL + 1, CELL - 2, CELL - 2);
          }
      return;
    }
    // 已固定方块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.tetrisBoard[r][c] !== 0) {
          this.tetrisGfx.fillStyle(this.tetrisBoard[r][c], 0.9);
          this.tetrisGfx.fillRect(BOARD_X + c * CELL + 1, BOARD_Y + r * CELL + 1, CELL - 2, CELL - 2);
          this.tetrisGfx.fillStyle(0xffffff, 0.12);
          this.tetrisGfx.fillRect(BOARD_X + c * CELL + 1, BOARD_Y + r * CELL + 1, CELL - 2, 3);
        }
      }
    }
    if (!this.tetrisPiece) return;
    const { shape, x, y, color } = this.tetrisPiece;
    // Ghost
    const ghostY = this.getGhostY();
    if (ghostY !== y) {
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c] && ghostY + r >= 0) {
            const gx = BOARD_X + (x + c) * CELL, gy = BOARD_Y + (ghostY + r) * CELL;
            this.tetrisGfx.lineStyle(1.5, color, 0.3);
            this.tetrisGfx.strokeRect(gx + 1, gy + 1, CELL - 2, CELL - 2);
          }
    }
    // 当前方块
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] && y + r >= 0) {
          const cx = BOARD_X + (x + c) * CELL, cy = BOARD_Y + (y + r) * CELL;
          this.tetrisGfx.fillStyle(color, 0.9);
          this.tetrisGfx.fillRect(cx + 1, cy + 1, CELL - 2, CELL - 2);
          this.tetrisGfx.fillStyle(0xffffff, 0.18);
          this.tetrisGfx.fillRect(cx + 1, cy + 1, CELL - 2, 3);
        }
      }
    }
  }

  drawPreview() {
    this.tetrisPreviewGfx.clear();
    if (!this.tetrisNext) return;
    const pCell = 18, px = BOARD_X + BOARD_W + 70, py = BOARD_Y + 30;
    const { shape, color } = this.tetrisNext;
    const ox = px + (80 - shape[0].length * pCell) / 2;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) {
          this.tetrisPreviewGfx.fillStyle(color, 0.85);
          this.tetrisPreviewGfx.fillRect(ox + c * pCell, py + r * pCell, pCell - 1, pCell - 1);
        }
  }

  // ==================== 下落 ====================
  tetrisTick() {
    if (!this.tetrisPlaying || !this.tetrisPiece) return;
    if (!this.movePiece(0, 1)) {
      this.lockPiece();
      this.tetrisLastDrop = this.time.now;
    }
  }

  // ==================== 输入 ====================
  handleInput(time) {
    if (!this.tetrisPlaying || !this.tetrisPiece) return;

    // 左
    if (this.cursors.left.isDown) {
      if (!this._dasLeft.held) {
        this._dasLeft = { held: true, first: time, last: time };
        this.movePiece(-1, 0);
      } else if (time - this._dasLeft.first > 170 && time - this._dasLeft.last > 50) {
        this._dasLeft.last = time;
        this.movePiece(-1, 0);
      }
    } else { this._dasLeft.held = false; }

    // 右
    if (this.cursors.right.isDown) {
      if (!this._dasRight.held) {
        this._dasRight = { held: true, first: time, last: time };
        this.movePiece(1, 0);
      } else if (time - this._dasRight.first > 170 && time - this._dasRight.last > 50) {
        this._dasRight.last = time;
        this.movePiece(1, 0);
      }
    } else { this._dasRight.held = false; }

    // 下
    if (this.cursors.down.isDown) {
      if (!this._dasDown.held) {
        this._dasDown = { held: true, first: time, last: time };
        if (this.movePiece(0, 1)) this.tetrisLastDrop = time;
      } else if (time - this._dasDown.first > 100 && time - this._dasDown.last > 40) {
        this._dasDown.last = time;
        if (this.movePiece(0, 1)) this.tetrisLastDrop = time;
      }
    } else { this._dasDown.held = false; }

    // 上旋转
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.rotatePiece();
    // 空格硬降
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this.hardDrop();
  }

  // ==================== 主循环 ====================
  update(time, delta) {
    if (this.pauseMenu && this.pauseMenu.visible) return;
    if (this.tetrisPlaying) {
      this.handleInput(time);
      if (time - this.tetrisLastDrop > this.tetrisDropInterval) {
        this.tetrisTick();
        this.tetrisLastDrop = time;
      }
      this.drawBoard();
      this.tetrisScoreText.setText(`本局修为：${this.tetrisScore}`);
    } else if (this.tetrisGameOverTime > 0) {
      this.drawBoard();
    }
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
}
