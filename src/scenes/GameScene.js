import Phaser from 'phaser';
import { WIDTH, HEIGHT, REALMS, REALM_SWORD_CONFIG, getMajorRealmName, HERBS } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { calcPlayerStats } from '../utils/helpers.js';
import { drawBattleRelics } from '../systems/RelicSystem.js';
import PauseMenu from '../ui/PauseMenu.js';
import ChestSystem from '../systems/ChestSystem.js';
import ScoreSystem from '../systems/ScoreSystem.js';
import EffectSystem from '../systems/EffectSystem.js';
import MobileControls from '../ui/MobileControls.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // ============ 背景渐变 ============
    const bg = this.add.graphics();
    const r1 = 0x0d, g1c = 0x1b, b1 = 0x2a;
    const r2 = 0x0d, g2c = 0x1b, b2 = 0x0d;
    const stripH = 2;
    for (let y = 0; y < HEIGHT; y += stripH) {
      const t = y / HEIGHT;
      const r = Math.floor(r1 + (r2 - r1) * t);
      const g = Math.floor(g1c + (g2c - g1c) * t);
      const b = Math.floor(b1 + (b2 - b1) * t);
      bg.fillStyle((r << 16) | (g << 8) | b);
      bg.fillRect(0, y, WIDTH, stripH);
    }

    // ============ 地图背景分层 ============
    this._createBackgroundLayers();

    // ============ 地面 ============
    const groundY = 620, groundH = 20;
    const gg = this.make.graphics({ add: false });
    gg.fillStyle(0x3a5a1e);
    gg.fillRect(0, 0, WIDTH, groundH);
    gg.generateTexture('ground', WIDTH, groundH);
    gg.destroy();
    this.ground = this.physics.add.staticImage(WIDTH / 2, groundY + groundH / 2, 'ground');
    this.ground.refreshBody();

    const wallW = 6;
    const wallGfx = this.add.graphics();
    wallGfx.fillStyle(0x1a1a2e, 0.6);
    wallGfx.fillRect(0, 0, wallW, groundY + groundH);
    wallGfx.fillRect(WIDTH - wallW, 0, wallW, groundY + groundH);

    // ============ 玩家 ============
    const pg = this.make.graphics({ add: false });
    pg.fillStyle(0x00ffcc);
    pg.fillRect(0, 0, 36, 54);
    pg.generateTexture('player', 36, 54);
    pg.destroy();
    this.player = this.physics.add.sprite(200, 500, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(36, 54);
    this.physics.add.collider(this.player, this.ground);

    this.playerIdText = this.add.text(0, 0, 'player_001', {
      fontSize: '10px', color: '#00ffcc',
      backgroundColor: '#000000', padding: { x: 2, y: 1 },
    }).setDepth(100);

    // ============ 敌人纹理 ============
    if (!this.textures.exists('enemy')) {
      const eg = this.make.graphics({ add: false });
      eg.fillStyle(0x8B4513);
      eg.fillRect(0, 0, 28, 40);
      eg.generateTexture('enemy', 28, 40);
      eg.destroy();
    }
    // 精英敌人纹理
    if (!this.textures.exists('enemy_elite')) {
      const ee = this.make.graphics({ add: false });
      ee.fillStyle(0xcc2200);
      ee.fillRect(0, 0, 42, 60);
      ee.generateTexture('enemy_elite', 42, 60);
      ee.destroy();
    }
    // Boss纹理
    if (!this.textures.exists('enemy_boss')) {
      const eb = this.make.graphics({ add: false });
      eb.fillStyle(0x440044);
      eb.fillRect(0, 0, 80, 90);
      eb.generateTexture('enemy_boss', 80, 90);
      eb.destroy();
    }

    // ============ 剑气纹理 ============
    for (const realm of REALMS) {
      const cfg = REALM_SWORD_CONFIG[realm];
      const swordKey = 'sword_' + realm;
      if (!this.textures.exists(swordKey)) {
        const swGfx = this.make.graphics({ add: false });
        swGfx.fillStyle(cfg.color);
        swGfx.fillRect(0, 0, cfg.width, cfg.height);
        swGfx.generateTexture(swordKey, cfg.width, cfg.height);
        swGfx.destroy();
      }
    }

    // ============ 容器 ============
    this.enemies = [];
    this.projectiles = [];
    this.spiritStoneDrops = [];
    this.herbDrops = [];
    this.groundLingshi = [];   // 地面灵石追踪（战后自动回收用）

    // ============ 输入 ============
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyRealm = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);

    this.input.mouse.disableContextMenu();

    this.input.on('pointerdown', (pointer) => {
      if (this.gameEnded || this.isDead) return;
      const now = this.time.now;

      if (pointer.leftButtonDown()) {
        if (now - this.lastMeleeTime > this.meleeCooldown) {
          this.performMelee();
          this.lastMeleeTime = now;
        }
        return;
      }
      if (pointer.rightButtonDown()) {
        if (now - this.lastRangedTime > this.rangedCooldown) {
          const cfg = REALM_SWORD_CONFIG[this.currentRealm];
          if (this.currentMP >= cfg.mpCost) {
            this.currentMP -= cfg.mpCost;
            this.performRanged();
            this.lastRangedTime = now;
          } else {
            this.mpFlashTime = now;
          }
        }
        return;
      }
    });

    // 暂停菜单
    this.pauseMenu = new PauseMenu(this, {
      sceneName: '迷雾山林', showRestart: true, hasPhysics: true,
    });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => {
      this.pauseMenu.toggle();
    });
    // 自动保存（30秒）
    this.autoSaveTimer = this.time.addEvent({
      delay: 30000,
      loop: true,
      callback: () => {
        const s = this.registry.get('currentSave');
        const sid = this.registry.get('currentSlotId');
        if (s && sid >= 0) {
          s.playtime = (s.playtime || 0) + 30;
          if (this._tendencies) {
            if (!s.cultivation) s.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
            if (!s.cultivation.tendencies) s.cultivation.tendencies = { tixiu: 0, jianxiu: 0, shenshi: 0 };
          }
          SaveManager.save(sid, s);
          this.showAutoSaveHint();
        }
      },
    });

    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
      if (this.playerIdText) { this.playerIdText.destroy(); this.playerIdText = null; }
      if (this.mobileControls) this.mobileControls.destroy();
    });

    // ============ HUD ============
    this.hudRealmText = this.add.text(16, 12, '', {
      fontSize: '16px', color: '#ffffff', fontFamily: FONT,
    });

    this.hudHpText = this.add.text(16, 30, '', {
      fontSize: '13px', color: '#ffffff', fontFamily: FONT,
    });

    this.hpBarBg = this.add.graphics();
    this.hpBarFg = this.add.graphics();

    this.hudMpText = this.add.text(16, 60, '', {
      fontSize: '13px', color: '#ffffff', fontFamily: FONT,
    });

    this.mpBarBg = this.add.graphics();
    this.mpBarFg = this.add.graphics();

    this.killText = this.add.text(16, 86, '', {
      fontSize: '14px', color: '#ffcc00', fontFamily: FONT,
    });
    this.spiritText = this.add.text(WIDTH - 16, 12, '灵石: 0', {
      fontSize: '16px', color: '#ffd700', fontFamily: FONT,
    }).setOrigin(1, 0);

    // 阶段进度显示（顶部中央小字，常驻）
    this._phaseHudText = this.add.text(WIDTH / 2, 4, '', {
      fontSize: '13px', color: '#aaaacc', fontFamily: FONT,
    }).setOrigin(0.5, 0).setDepth(50);

    this.clearText = this.add.text(WIDTH / 2, HEIGHT / 2 - 40, '副本通关！', {
      fontSize: '52px', color: '#ffd700',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    // ============ 存档 & 属性 ============
    const save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');
    this.sessionTime = 0;
    const stats = calcPlayerStats(save);
    this.playerMaxHP = stats.maxHp;
    this.playerHP = this.playerMaxHP;
    this.playerAtk = stats.atk;
    this.playerMeleeDmgBonus = stats.meleeDmgBonus;
    this.playerSwordDmgBonus = stats.swordDmgBonus;
    this.playerDefense = stats.defense;
    this.playerMaxMP = stats.maxMp;
    this.currentMP = this.playerMaxMP;
    this.playerMpRegen = stats.mpRegen;
    this.playerCritRate = stats.critRate;
    this.playerCritDmg = stats.critDmg;
    this.moveSpeed = stats.moveSpeed;
    this.currentRealm = getMajorRealmName(save.majorRealmIndex);

    this._tendencies = { tixiu: 0, jianxiu: 0, shenshi: 0 };

    // ============ 战斗状态 ============
    this.isInvincible = false;
    this.killCount = 0;
    this.spiritStoneCount = 0;
    this.isDead = false;
    this.deathTime = 0;
    this.gameEnded = false;

    this.meleeCooldown = 350;
    this.lastMeleeTime = 0;
    this.rangedCooldown = 400;
    this.lastRangedTime = 0;

    this.mpFlashTime = -1000;
    this.jumpForce = -580;
    this._enemyIdCounter = 0;

    // ============ 副本阶段状态机 ============
    this.dungeonPhase = 'wave1';    // 'wave1' | 'wave2' | 'elite' | 'boss' | 'clear'
    this.phaseTransitioning = false;
    this.boss = null;               // Boss引用
    this.bossHpBar = null;          // Boss血条UI { bg, fill, nameText, pctText }
    this._phaseTitleElements = [];   // 阶段标题的UI元素引用（用于清理）

    // ============ 宝箱 & 词条系统 ============
    this.battleRelics = [];
    this.usedRelicIds = [];
    this.chestCount = 0;
    this.chests = [];
    this.shieldHP = 0;
    this._meleeCombo = 0;
    this._relicSelectOpen = false;
    this._deathSaveUsed = false;

    // ============ 战斗评分 ============
    this.score = {
      totalDmgDealt: 0,
      totalDmgTaken: 0,
      noDmgTime: 0,
      maxNoDmgStreak: 0,
      clearTime: 0,
      kills: 0,
    };

    // F键开箱
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    this.physics.world.gravity.y = 600;

    // ============ 手机虚拟按键 ============
    this.mobileControls = new MobileControls(this);

    // ============ 系统模块初始化 ============
    this._gameData = {
      chests: this.chests, chestGFX: null, player: this.player,
      activeRelics: this.battleRelics, usedRelicIds: this.usedRelicIds, chestCount: this.chestCount,
      enemies: this.enemies,
      playerHP: this.playerHP, playerMaxHP: this.playerMaxHP,
      playerMP: this.currentMP, playerMaxMP: this.playerMaxMP,
      shieldHP: this.shieldHP,
      totalDmgDealt: 0, totalKills: 0,
      startTime: this.time.now, noDamageStartTime: this.score.noDmgTime,
      longestNoDamage: this.score.maxNoDmgStreak, finishTime: null,
      finalScore: 0,
      relicSelectionEls: [],
      playerAtk: this.playerAtk,
      playerCritRate: this.playerCritRate,
      playerCritDmg: this.playerCritDmg,
      playerDefense: this.playerDefense,
    };
    this.chestSystem = new ChestSystem(this, this._gameData);
    this.scoreSystem = new ScoreSystem(this, this._gameData);
    this.effectSystem = new EffectSystem(this, this._gameData);

    this.updateRealmHUD();
    this.updateHPHUD();
    this.updateMPHUD();
    this.drawHPBar();
    this.drawMPBar();

    // 启动第一阶段
    this.spawnPhase('wave1');
  }

  // ==================== 地图背景分层 ====================
  _createBackgroundLayers() {
    // 远景：深色山影
    const mountains = this.add.graphics().setDepth(0);
    mountains.fillStyle(0x0a1a0a, 0.3);
    mountains.fillTriangle(80, 400, 250, 250, 420, 400);
    mountains.fillTriangle(350, 420, 550, 220, 750, 420);
    mountains.fillTriangle(680, 410, 880, 260, 1080, 410);
    mountains.fillTriangle(950, 390, 1100, 280, 1250, 390);
    // 更远的浅色山影（稍高透明度）
    mountains.fillStyle(0x0a150a, 0.18);
    mountains.fillTriangle(150, 380, 300, 270, 480, 380);
    mountains.fillTriangle(600, 390, 750, 290, 920, 390);

    // 中景：树木占位（不同高度的深绿矩形）
    const trees = this.add.graphics().setDepth(1);
    trees.fillStyle(0x1a3a1a, 0.6);
    // 随机分布一些树
    const treePositions = [
      [100, 570, 30], [160, 560, 35], [240, 575, 25],
      [350, 555, 40], [430, 570, 28], [520, 560, 32],
      [630, 550, 38], [710, 570, 26], [800, 560, 34],
      [900, 575, 30], [1000, 555, 36], [1100, 565, 28],
      [1180, 550, 33], [50, 580, 22], [1250, 575, 24],
    ];
    for (const [tx, ty, th] of treePositions) {
      trees.fillRect(tx - 8, ty - th, 16, th);
      // 树冠（小三角或小矩形）
      trees.fillStyle(0x1a4a1a, 0.5);
      trees.fillRect(tx - 14, ty - th - 12, 28, 16);
      trees.fillStyle(0x1a3a1a, 0.6);
    }

    // 迷雾效果：底部白色半透明渐变
    const mist = this.add.graphics().setDepth(150);
    for (let i = 0; i < 60; i += 2) {
      const alpha = 0.05 * (1 - i / 60);
      mist.fillStyle(0xffffff, alpha);
      mist.fillRect(0, HEIGHT - 60 + i, WIDTH, 2);
    }
  }

  // ==================== 场景跳转 ====================
  goToScene(name, data) {
    const s = this.registry.get('currentSave');
    const sid = this.registry.get('currentSlotId');
    if (s && sid >= 0 && this._tendencies) {
      if (!s.cultivation) s.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
      if (!s.cultivation.tendencies) s.cultivation.tendencies = { tixiu: 0, jianxiu: 0, shenshi: 0 };
      s.cultivation.tendencies.tixiu = (s.cultivation.tendencies.tixiu || 0) + this._tendencies.tixiu;
      s.cultivation.tendencies.jianxiu = (s.cultivation.tendencies.jianxiu || 0) + this._tendencies.jianxiu;
      s.cultivation.tendencies.shenshi = (s.cultivation.tendencies.shenshi || 0) + this._tendencies.shenshi;
      SaveManager.save(sid, s);
    }
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (data) this.scene.start(name, data);
    else this.scene.start(name);
  }

  // ==================== 副本阶段生成 ====================
  spawnPhase(phase) {
    this.dungeonPhase = phase;
    switch (phase) {
      case 'wave1': this._spawnWave1(); break;
      case 'wave2': this._spawnWave2(); break;
      case 'elite': this._spawnElite(); break;
      case 'boss':  this._spawnBoss(); break;
    }
    this._updatePhaseHUD();
  }

  _spawnWave1() {
    this.showPhaseTitle('— 第一波 —', '#ffffff', '28px', 1500);
    // 3只山鬼，分散在右侧x=700-1100
    const count = 3;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(700, 1100);
      this._createBasicEnemy(x, 500, 30, 80, 8);
    }
  }

  _spawnWave2() {
    this.showPhaseTitle('— 第二波 —', '#ffffff', '28px', 1500);
    // 5只山鬼，从右侧边缘依次出现（间隔0.3秒）
    const count = 5;
    const baseX = 1050;
    for (let i = 0; i < count; i++) {
      const x = baseX + i * 60;
      this.time.delayedCall(i * 300, () => {
        this._createBasicEnemy(x, 500, 35, 90, 8);
        this._updatePhaseHUD();
      });
    }
  }

  _createBasicEnemy(x, y, hp, speed, dmg) {
    const sprite = this.physics.add.sprite(x, y, 'enemy');
    sprite.body.setSize(28, 40);
    this.physics.add.collider(sprite, this.ground);

    const hpBarBg = this.add.graphics();
    const hpBar = this.add.graphics();
    this._enemyIdCounter++;

    const enemyObj = {
      sprite, hp, maxHP: hp, speed, damage: dmg,
      lastAttackTime: 0, attackCooldown: 1500,
      hpBarBg, hpBar,
      id: `enemy_${this._enemyIdCounter}`,
      idText: null,
      type: 'normal',
    };
    const idText = this.add.text(0, 0, enemyObj.id, {
      fontSize: '10px', color: '#ffaaaa',
      backgroundColor: '#000000', padding: { x: 2, y: 1 },
    }).setDepth(100);
    enemyObj.idText = idText;
    this.enemies.push(enemyObj);
  }

  _spawnElite() {
    this.showPhaseTitle('— 精英现身 —', '#ff8844', '32px', 1800);
    this._updatePhaseHUD();

    const x = 900, y = 500;
    const sprite = this.physics.add.sprite(x, y, 'enemy_elite');
    sprite.body.setSize(42, 60);
    this.physics.add.collider(sprite, this.ground);

    // 精英专用宽血条（80px）
    const hpBarBg = this.add.graphics();
    const hpBar = this.add.graphics();
    // 精英标签
    const eliteLabel = this.add.text(sprite.x, sprite.y - 48, '精英', {
      fontSize: '10px', color: '#ff4422', fontFamily: FONT, fontStyle: 'bold',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(100);

    this._enemyIdCounter++;
    const enemyObj = {
      sprite, hp: 120, maxHP: 120, speed: 70, damage: 15,
      lastAttackTime: 0, attackCooldown: 1500,
      hpBarBg, hpBar, hpBarWide: 80,
      id: `elite_${this._enemyIdCounter}`,
      idText: null,
      type: 'elite',
      isElite: true,
      chargeTimer: 0,
      isCharging: false,
      eliteLabel,
    };
    const idText = this.add.text(0, 0, enemyObj.id, {
      fontSize: '10px', color: '#ff4422',
      backgroundColor: '#000000', padding: { x: 2, y: 1 },
    }).setDepth(100);
    enemyObj.idText = idText;
    this.enemies.push(enemyObj);
  }

  _spawnBoss() {
    this.showPhaseTitle('— 妖王降临 —', '#ff2222', '38px', 2000);
    this._updatePhaseHUD();

    const x = 900, y = 480;
    const sprite = this.physics.add.sprite(x, y, 'enemy_boss');
    sprite.body.setSize(80, 90);
    this.physics.add.collider(sprite, this.ground);

    // Boss不显示普通头顶血条，使用专用全屏血条
    this._enemyIdCounter++;
    const enemyObj = {
      sprite, hp: 400, maxHP: 400, speed: 60, damage: 20,
      lastAttackTime: 0, attackCooldown: 2000,
      hpBarBg: null, hpBar: null,  // Boss不用头顶血条
      id: `boss_${this._enemyIdCounter}`,
      idText: null,
      type: 'boss',
      isBoss: true,
      bossPhase: 1,
      phaseTimer: 0,
      roarCooldown: 0,      // 熊吼冷却
      sweepCooldown: 0,      // 横扫冷却
      lungeCooldown: 0,      // 扑击冷却
      isLunging: false,
      attackDmgMult: 1,
      berserkGlow: null,
    };
    const idText = this.add.text(0, 0, enemyObj.id, {
      fontSize: '10px', color: '#ff44ff',
      backgroundColor: '#000000', padding: { x: 2, y: 1 },
    }).setDepth(100);
    enemyObj.idText = idText;
    this.boss = enemyObj;
    this.enemies.push(enemyObj);

    // 创建Boss专用全屏血条
    this._createBossHPBar();
  }

  // ==================== 阶段标题UI ====================
  showPhaseTitle(text, color, fontSize, duration) {
    // 清理旧标题元素
    if (this._phaseTitleElements) {
      this._phaseTitleElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    }
    this._phaseTitleElements = [];

    // 背景遮罩条
    const titleBg = this.add.graphics().setDepth(200);
    titleBg.fillStyle(0x000000, 0.5);
    titleBg.fillRect(0, HEIGHT / 2 - 40, WIDTH, 80);
    this._phaseTitleElements.push(titleBg);

    const titleText = this.add.text(WIDTH / 2, HEIGHT / 2, text, {
      fontSize, color, fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201).setAlpha(0);
    this._phaseTitleElements.push(titleText);

    this.tweens.add({
      targets: [titleBg, titleText],
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(duration, () => {
          if (titleText && titleText.active) {
            this.tweens.add({
              targets: [titleBg, titleText],
              alpha: 0,
              duration: 500,
              onComplete: () => {
                this._phaseTitleElements.forEach(el => { if (el && el.destroy) el.destroy(); });
                this._phaseTitleElements = [];
              },
            });
          }
        });
      },
    });
  }

  // ==================== Boss血条UI ====================
  _createBossHPBar() {
    const barX = 20, barY = 8, barW = WIDTH - 40, barH = 20;
    const bg = this.add.graphics().setDepth(200);
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(barX, barY, barW, barH, 6);
    bg.lineStyle(2, 0x664444);
    bg.strokeRoundedRect(barX, barY, barW, barH, 6);

    const fill = this.add.graphics().setDepth(201);
    fill.fillStyle(0xcc0000);
    fill.fillRoundedRect(barX + 2, barY + 2, barW - 4, barH - 4, 4);

    const nameText = this.add.text(barX + 8, barY + barH / 2, '妖王·熊罴', {
      fontSize: '13px', color: '#ffffff', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(202);

    const pctText = this.add.text(barX + barW - 8, barY + barH / 2, '100%', {
      fontSize: '12px', color: '#ffcccc', fontFamily: FONT,
    }).setOrigin(1, 0.5).setDepth(202);

    this.bossHpBar = { bg, fill, nameText, pctText, barX, barY, barW, barH };
  }

  _updateBossHPBar() {
    if (!this.boss || !this.boss.sprite || !this.boss.sprite.active || !this.bossHpBar) return;
    const pct = Math.max(0, this.boss.hp / this.boss.maxHP);
    const { fill, pctText, barX, barY, barW, barH } = this.bossHpBar;

    fill.clear();
    const color = pct > 0.7 ? 0xcc0000 : pct > 0.3 ? 0xff4400 : 0xff0000;
    fill.fillStyle(color);
    const currentW = Math.floor((barW - 4) * pct);
    if (currentW > 0) {
      fill.fillRoundedRect(barX + 2, barY + 2, currentW, barH - 4, 4);
    }

    pctText.setText(`${Math.floor(pct * 100)}%`);
  }

  _destroyBossHPBar() {
    if (!this.bossHpBar) return;
    const { bg, fill, nameText, pctText } = this.bossHpBar;
    // 淡出动画
    this.tweens.add({
      targets: [nameText, pctText],
      alpha: 0, duration: 800,
    });
    this.tweens.add({
      targets: bg,
      alpha: 0, duration: 800,
      onComplete: () => {
        if (bg && bg.destroy) bg.destroy();
        if (fill && fill.destroy) fill.destroy();
        if (nameText && nameText.destroy) nameText.destroy();
        if (pctText && pctText.destroy) pctText.destroy();
      },
    });
    this.bossHpBar = null;
  }

  _updatePhaseHUD() {
    if (!this._phaseHudText || !this._phaseHudText.active) return;
    const alive = this.enemies.filter(e => e && e.sprite && e.sprite.active).length;
    switch (this.dungeonPhase) {
      case 'wave1':
      case 'wave2': {
        const waveNum = this.dungeonPhase === 'wave1' ? 1 : 2;
        this._phaseHudText.setText(`第${waveNum}波  剩余：${alive}只`).setColor('#aaaacc');
        break;
      }
      case 'elite':
        this._phaseHudText.setText('精英战').setColor('#ff8844');
        break;
      case 'boss':
        this._phaseHudText.setText('Boss战').setColor('#ff2222');
        break;
      default:
        this._phaseHudText.setText('');
        break;
    }
  }

  // ==================== 主循环 ====================
  update(time, delta) {
    if (this.pauseMenu && this.pauseMenu.visible) return;
    if (this._relicSelectOpen) return;
    // 非清理阶段的 gameEnded 直接返回（死亡流程由下方 isDead 分支处理）
    if (this.gameEnded && this.dungeonPhase !== 'cleanup') return;

    // 游玩时长累计
    this.sessionTime = (this.sessionTime || 0) + delta / 1000;

    if (this.isDead && this.dungeonPhase !== 'cleanup') {
      if (time - this.deathTime > 2000) {
        this.gameEnded = true;
        this.score.maxNoDmgStreak = Math.max(this.score.maxNoDmgStreak, this.score.noDmgTime);
        this.score.totalDmgDealt = this._gameData.totalDmgDealt;
        const battleScore = this.scoreSystem.calcBattleScore(this.score, this.playerMaxHP);
        this.goToScene('GameOverScene', {
          result: 'dead', lingshi: this.spiritStoneCount, killCount: this.killCount,
          score: this.score, battleScore, battleRelics: [...this.battleRelics],
        });
      }
      return;
    }

    // ---- 清理阶段：仅允许移动、捡取、开箱，禁止战斗 ----
    if (this.dungeonPhase === 'cleanup') {
      this._updateCleanupMovement();
      this.updateSpiritStones();
      this.updateHerbDrops();
      this.chestSystem.updateChests();
      this.updateHPHUD();
      this.drawHPBar();
      this.updateMPHUD();
      this.drawMPBar();
      return;
    }

    // ---- 副本阶段检查 ----
    this.checkPhaseComplete();

    // ---- Boss血条更新 ----
    this._updateBossHPBar();

    // ---- 宝箱 ----
    this.chestSystem.updateChests();

    // ---- 无伤时间追踪 ----
    this.scoreSystem.updateNoDamage(delta);

    // ---- MP 回复 ----
    let regenRate = this.playerMpRegen;
    const mpRegenMult = this.effectSystem.getMpRegenMultiplier();
    regenRate *= mpRegenMult;
    this.currentMP = Math.min(this.playerMaxMP, this.currentMP + regenRate * (delta / 1000));

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;

    // ---- 移动（含手机虚拟按键） ----
    let effectiveSpeed = this.moveSpeed;
    const moveMult = this.effectSystem.getMoveSpeedMultiplier();
    effectiveSpeed *= moveMult;
    const mc = this.mobileControls;
    const leftDown = this.cursors.left.isDown || this.keyA.isDown || (mc && mc.leftHeld);
    const rightDown = this.cursors.right.isDown || this.keyD.isDown || (mc && mc.rightHeld);
    if (leftDown && !rightDown) {
      this.player.setVelocityX(-effectiveSpeed);
      this.player.setFlipX(true);
    } else if (rightDown && !leftDown) {
      this.player.setVelocityX(effectiveSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // ---- 跳跃（含手机虚拟按键） ----
    const upDown = this.cursors.up.isDown || this.keyW.isDown || (mc && mc.jumpHeld);
    if (upDown && onGround) {
      this.player.setVelocityY(this.jumpForce);
    }

    // ---- 手机动作按钮（攻/剑） ----
    if (mc && mc.enabled) {
      const now = this.time.now;
      if (mc.consumeMelee() && now - this.lastMeleeTime > this.meleeCooldown && !this.isDead) {
        this.performMelee();
        this.lastMeleeTime = now;
      }
      if (mc.consumeRanged() && now - this.lastRangedTime > this.rangedCooldown && !this.isDead) {
        const cfg = REALM_SWORD_CONFIG[this.currentRealm];
        if (this.currentMP >= cfg.mpCost) {
          this.currentMP -= cfg.mpCost;
          this.performRanged();
          this.lastRangedTime = now;
        } else {
          this.mpFlashTime = now;
        }
      }
    }

    // ---- 境界切换 ----
    if (Phaser.Input.Keyboard.JustDown(this.keyRealm)) {
      const idx = REALMS.indexOf(this.currentRealm);
      this.currentRealm = REALMS[(idx + 1) % REALMS.length];
      this.updateRealmHUD();
    }

    // ---- 玩家ID文字跟随 ----
    if (this.playerIdText && this.playerIdText.active) {
      this.playerIdText.setPosition(
        this.player.x - this.playerIdText.width / 2,
        this.player.y - 45
      );
    }

    // ---- 剑气 ----
    this.updateProjectiles();

    // ---- 敌人 ----
    this.updateAllEnemies(time, delta);

    // ---- 评分追踪 ----
    this.score.clearTime += delta / 1000;
    if (!this.isInvincible) {
      this.score.noDmgTime += delta / 1000;
    }

    // ---- 宝物拾取 ----
    this.updateSpiritStones();
    this.updateHerbDrops();

    // ---- HUD ----
    this.updateHPHUD();
    this.updateMPHUD();
    this.drawHPBar();
    this.drawMPBar();
    this.updateRelicHUD();
  }

  // ==================== 清理阶段专用移动（无战斗） ====================
  _updateCleanupMovement() {
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    const mc = this.mobileControls;
    const leftDown = this.cursors.left.isDown || this.keyA.isDown || (mc && mc.leftHeld);
    const rightDown = this.cursors.right.isDown || this.keyD.isDown || (mc && mc.rightHeld);

    if (leftDown && !rightDown) {
      this.player.setVelocityX(-this.moveSpeed);
      this.player.setFlipX(true);
    } else if (rightDown && !leftDown) {
      this.player.setVelocityX(this.moveSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    const upDown = this.cursors.up.isDown || this.keyW.isDown || (mc && mc.jumpHeld);
    if (upDown && onGround) {
      this.player.setVelocityY(this.jumpForce);
    }

    // 玩家ID文字跟随
    if (this.playerIdText && this.playerIdText.active) {
      this.playerIdText.setPosition(
        this.player.x - this.playerIdText.width / 2,
        this.player.y - 45
      );
    }
  }

  // ==================== 阶段转换 ====================
  checkPhaseComplete() {
    if (this.phaseTransitioning) return;

    const aliveEnemies = this.enemies.filter(e => e && e.sprite && e.sprite.active);

    switch (this.dungeonPhase) {
      case 'wave1':
        if (aliveEnemies.length === 0) this.startPhaseTransition('wave2', 2000);
        break;
      case 'wave2':
        if (aliveEnemies.length === 0) this.startPhaseTransition('elite', 2000);
        break;
      case 'elite':
        if (aliveEnemies.length === 0) this.startPhaseTransition('boss', 2000);
        break;
      case 'boss':
        if (aliveEnemies.length === 0) this.dungeonClear();
        break;
    }

    this._updatePhaseHUD();
  }

  startPhaseTransition(nextPhase, delay) {
    this.phaseTransitioning = true;
    this.time.delayedCall(delay, () => {
      this.dungeonPhase = nextPhase;
      this.spawnPhase(nextPhase);
      this.phaseTransitioning = false;
    });
  }

  // ==================== 通关结算（清理阶段） ====================
  dungeonClear() {
    this.dungeonPhase = 'cleanup';
    this.gameEnded = true;
    this._phaseHudText.setText('').setAlpha(0);
    this._destroyBossHPBar();

    // 停止所有敌人移动
    for (const e of this.enemies) {
      if (e && e.sprite && e.sprite.body) {
        e.sprite.setVelocity(0, 0);
        if (e.sprite.body) e.sprite.body.enable = false;
      }
    }

    // 显示通关文字
    this.tweens.add({ targets: this.clearText, alpha: 1, duration: 1000 });

    // 倒计时提示
    this.cleanupText = this.add.text(WIDTH / 2, 60, '打扫战场  10s', {
      fontSize: '22px', color: '#ffcc00', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(500);

    this.cleanupTimer = 10;
    this.cleanupEvent = this.time.addEvent({
      delay: 1000, repeat: 9,
      callback: () => {
        this.cleanupTimer--;
        if (this.cleanupTimer > 0) {
          if (this.cleanupText && this.cleanupText.active) {
            this.cleanupText.setText(`打扫战场  ${this.cleanupTimer}s`);
          }
        } else {
          if (this.cleanupText && this.cleanupText.active) {
            this.cleanupText.setText('战场清理完毕！');
          }
          this.time.delayedCall(800, () => this.endDungeon());
        }
      },
    });
  }

  endDungeon() {
    // 地面未捡灵石自动归入存档
    const uncollected = this.groundLingshi.filter(s => s && s.active).length;
    if (uncollected > 0) {
      this.spiritStoneCount += uncollected;
      this.spiritText.setText(`灵石: ${this.spiritStoneCount}`);
      const msg = this.add.text(WIDTH / 2, HEIGHT / 2, `自动回收灵石 ×${uncollected}`, {
        fontSize: '18px', color: '#ffcc00', fontFamily: FONT, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(600);
      // 销毁地面灵石
      for (const s of this.groundLingshi) {
        if (s && s.active) s.destroy();
      }
      this.groundLingshi = [];
    }

    // 未开宝箱直接销毁
    if (this.chestSystem) {
      const unclaimed = this.chestSystem.getUnclaimedCount();
      this.chestSystem.destroyAllChests();
      if (unclaimed > 0) {
        this.add.text(WIDTH / 2, HEIGHT / 2 + 40, `${unclaimed}个宝箱未开启，已消散`, {
          fontSize: '14px', color: '#888888', fontFamily: FONT,
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(600);
      }
    }

    // 1.5秒后跳转结算
    this.time.delayedCall(1500, () => {
      // 灵石写入存档
      const save = this.registry.get('currentSave');
      const slotId = this.registry.get('currentSlotId');
      if (save) {
        save.lingshi = (save.lingshi || 0) + this.spiritStoneCount;
        SaveManager.save(slotId, save);
        this.registry.set('currentSave', save);
      }

      this.score.maxNoDmgStreak = Math.max(this.score.maxNoDmgStreak, this.score.noDmgTime);
      this.score.totalDmgDealt = this._gameData.totalDmgDealt;
      this.scoreSystem.finishRun();
      const battleScore = this.scoreSystem.calcBattleScore(this.score, this.playerMaxHP);
      this.goToScene('GameOverScene', {
        result: 'clear', lingshi: this.spiritStoneCount, killCount: this.killCount,
        score: this.score, battleScore, battleRelics: [...this.battleRelics],
      });
    });
  }

  // ==================== 近战攻击 ====================
  performMelee() {
    const dir = this.player.flipX ? -1 : 1;

    if (this.effectSystem.hasRelicType('bloodMelee')) {
      this.effectSystem.applyBloodMeleeCost();
      this.playerHP = this._gameData.playerHP;
    }

    const hx = this.player.x + dir * 53;
    const hy = this.player.y;

    const hitGfx = this.add.graphics();
    hitGfx.fillStyle(0xffffff, 0.25);
    hitGfx.fillRect(hx - 35, hy - 30, 70, 60);
    hitGfx.lineStyle(1, 0xffffff, 0.5);
    hitGfx.strokeRect(hx - 35, hy - 30, 70, 60);
    this.time.delayedCall(100, () => {
      if (hitGfx) hitGfx.destroy();
    });

    const hitBounds = new Phaser.Geom.Rectangle(hx - 35, hy - 30, 70, 60);
    let relicMeleeBonus = 0;
    for (const relic of this.battleRelics) {
      if (relic.effect.type === 'meleeDmg' || relic.effect.type === 'bloodMelee')
        relicMeleeBonus += relic.effect.value;
    }
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const enemy = this.enemies[j];
      if (!enemy || !enemy.sprite || !enemy.sprite.active) continue;
      const eBounds = enemy.sprite.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(hitBounds, eBounds)) {
        this.applyDamageToEnemy(enemy, j, Math.floor(this.playerAtk * this.playerMeleeDmgBonus * (1 + relicMeleeBonus)));
        this._tendencies.tixiu += 1;

        if (this.effectSystem.hasRelicType('swordDomain')) {
          const comboResult = this.effectSystem.checkSwordDomainCombo(this._meleeCombo, enemy);
          this._meleeCombo = comboResult.newCombo;
        }
      }
    }
  }

  // ==================== 远程剑气 ====================
  getAngles(count) {
    switch (count) {
      case 1: return [0];
      case 2: return [0, -15];
      case 3: return [-15, 0, 15];
      case 5: return [-24, -12, 0, 12, 24];
      default: return [0];
    }
  }

  performRanged() {
    const cfg = REALM_SWORD_CONFIG[this.currentRealm];
    const angles = this.getAngles(cfg.count);
    const dir = this.player.flipX ? -1 : 1;
    const startX = this.player.x + dir * 28;
    const startY = this.player.y - this.player.height * 0.3;

    for (const angle of angles) {
      const rad = Phaser.Math.DegToRad(angle);
      const vx = Math.cos(rad) * cfg.speed * dir;
      const vy = Math.sin(rad) * cfg.speed;

      const p = this.physics.add.image(startX, startY, 'sword_' + this.currentRealm);
      p.body.setAllowGravity(false);
      p.setVelocity(vx, vy);
      p.startX = startX;
      p.range = cfg.range;
      this.projectiles.push(p);
    }
  }

  // ==================== 剑气更新 ====================
  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let relicSwordBonus = 0;
      for (const relic of this.battleRelics) {
        if (relic.effect.type === 'swordDmg') relicSwordBonus += relic.effect.value;
      }

      if (!p || !p.active || Math.abs(p.x - p.startX) > p.range) {
        if (p && p.active) p.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }
      const pBounds = p.getBounds();
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (!enemy || !enemy.sprite || !enemy.sprite.active) {
          this.enemies.splice(j, 1);
          continue;
        }
        const eBounds = enemy.sprite.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, eBounds)) {
          this.applyDamageToEnemy(enemy, j, Math.floor(this.playerAtk * this.playerSwordDmgBonus * (1 + relicSwordBonus)));
          this._tendencies.jianxiu += 1;
          this.projectiles.splice(i, 1);
          p.destroy();
          break;
        }
      }
    }
  }

  // ==================== 通用伤害处理 ====================
  applyDamageToEnemy(enemy, enemyIndex, dmg) {
    this.scoreSystem.trackDamage(dmg);

    const result = this.effectSystem.applyDamageEffects(dmg, enemy, enemyIndex);

    this.score.totalDmgDealt = this._gameData.totalDmgDealt;

    if (result.isCrit) {
      this._tendencies.shenshi += 1;
    }

    // Boss阶段判定
    if (enemy.isBoss && enemy.sprite && enemy.sprite.active) {
      this._checkBossPhaseTransition(enemy);
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, enemyIndex);
    }
  }

  // ==================== Boss阶段判定 ====================
  _checkBossPhaseTransition(boss) {
    const pct = boss.hp / boss.maxHP;
    if (pct <= 0.7 && boss.bossPhase === 1) {
      boss.bossPhase = 2;
      boss.speed = 90;
      boss.attackCooldown = 1200;
      boss.roarCooldown = 0;
      // 全屏闪红
      this._phaseFlash(0xff0000);
      // 身体变深红色
      boss.phase2Tint = true;
      this.tweens.add({
        targets: boss.sprite,
        duration: 300,
        onStart: () => { if (boss.sprite && boss.sprite.active) boss.sprite.setTint(0x660000); },
      });
    }
    if (pct <= 0.3 && boss.bossPhase === 2) {
      boss.bossPhase = 3;
      boss.speed = 110;
      boss.attackDmgMult = 1.5;
      boss.sweepCooldown = 0;
      // 全屏闪红（更亮）
      this._phaseFlash(0xff2222);
      // 开启闪烁
      if (boss.berserkGlow === null) {
        boss.berserkGlow = this.tweens.add({
          targets: boss.sprite,
          tint: { from: 0x660000, to: 0xff2200 },
          duration: 300,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  _phaseFlash(color) {
    const flash = this.add.graphics().setDepth(300);
    flash.fillStyle(color, 0.3);
    flash.fillRect(0, 0, WIDTH, HEIGHT);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 800,
      onComplete: () => { if (flash && flash.destroy) flash.destroy(); },
    });
  }

  // ==================== 击杀敌人 ====================
  killEnemy(enemy, enemyIndex) {
    if (enemy.sprite && enemy.sprite.body) enemy.sprite.body.enable = false;
    if (enemy.hpBarBg) enemy.hpBarBg.destroy();
    if (enemy.hpBar) enemy.hpBar.destroy();
    if (enemy.idText) { enemy.idText.destroy(); enemy.idText = null; }
    if (enemy.eliteLabel) { enemy.eliteLabel.destroy(); enemy.eliteLabel = null; }

    // 精英必掉宝箱
    if (enemy.type === 'elite' && enemy.sprite) {
      this.chestSystem.spawnChest(enemy.sprite.x, enemy.sprite.y);
    }

    // Boss: 掉落大量灵石 + 草药 + 死亡动画
    if (enemy.type === 'boss' && enemy.sprite) {
      const bx = enemy.sprite.x, by = enemy.sprite.y;
      // 死亡动画
      this.tweens.add({
        targets: enemy.sprite,
        scaleX: 1.5, scaleY: 1.5,
        duration: 400,
        yoyo: false,
        onComplete: () => {
          this.tweens.add({
            targets: enemy.sprite,
            scaleX: 0, scaleY: 0, alpha: 0,
            duration: 400,
          });
        },
      });
      // 10-15枚灵石
      const stoneCount = Math.floor(Math.random() * 6) + 10;
      for (let i = 0; i < stoneCount; i++) {
        const sx = bx + Math.random() * 60 - 30;
        const sy = by + Math.random() * 20 - 10;
        const stone = this.add.circle(sx, sy, 6, 0xffd700);
        stone.setDepth(10);
        this.spiritStoneDrops.push({ sprite: stone });
        this.groundLingshi.push(stone);
      }
      // 掉落1个草药
      const herb = this.add.circle(bx + 20, by - 10, 5, 0x44cc44);
      herb.setDepth(10);
      herb.setAlpha(0.8);
      this.herbDrops.push({ sprite: herb, type: 'herb_001' });

      // 清理Boss引用
      if (enemy.berserkGlow) { enemy.berserkGlow.stop(); enemy.berserkGlow = null; }
      this.boss = null;
      this._destroyBossHPBar();
    }

    // 普通：灵石掉落（60%概率）
    if (enemy.type !== 'boss' && enemy.type !== 'elite') {
      if (Math.random() < 0.6 && enemy.sprite) {
        const stone = this.add.circle(enemy.sprite.x, enemy.sprite.y, 6, 0xffd700);
        stone.setDepth(10);
        this.spiritStoneDrops.push({ sprite: stone });
        this.groundLingshi.push(stone);
      }
      // 宝箱掉落（25%概率）
      if (Math.random() < 0.25 && enemy.sprite) {
        this.chestSystem.spawnChest(enemy.sprite.x, enemy.sprite.y);
      }
      // 草药掉落（15%概率）
      if (Math.random() < 0.15 && enemy.sprite) {
        const herb = this.add.circle(enemy.sprite.x, enemy.sprite.y, 5, 0x44cc44);
        herb.setDepth(10);
        herb.setAlpha(0.8);
        this.herbDrops.push({ sprite: herb, type: 'herb_001' });
      }
    }

    this.killCount++;
    this.score.kills = this.killCount;
    this.killText.setText(`击杀数: ${this.killCount}`);

    // 词条: 击杀回血/回蓝
    this.effectSystem.applyKillEffects();
    this.playerHP = this._gameData.playerHP;
    this.currentMP = this._gameData.playerMP;

    // Boss由自身死亡动画管理精灵销毁
    if (enemy.sprite && enemy.type !== 'boss') {
      this.tweens.add({
        targets: enemy.sprite, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 250,
        onComplete: () => {
          if (enemy.sprite && enemy.sprite.active) enemy.sprite.destroy();
        },
      });
    }

    if (enemyIndex !== undefined && enemyIndex >= 0 && enemyIndex < this.enemies.length) {
      this.enemies.splice(enemyIndex, 1);
    } else {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.enemies.splice(idx, 1);
    }

    this._updatePhaseHUD();
  }

  // ==================== 敌人 AI ====================
  updateAllEnemies(time, delta) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.sprite || !enemy.sprite.active) {
        if (enemy) {
          if (enemy.hpBarBg) enemy.hpBarBg.destroy();
          if (enemy.hpBar) enemy.hpBar.destroy();
          if (enemy.idText) { enemy.idText.destroy(); enemy.idText = null; }
          if (enemy.eliteLabel) { enemy.eliteLabel.destroy(); enemy.eliteLabel = null; }
          if (enemy.berserkGlow) { enemy.berserkGlow.stop(); enemy.berserkGlow = null; }
        }
        this.enemies.splice(i, 1);
        continue;
      }

      // 敌人ID文字跟随
      if (enemy.idText && enemy.idText.active) {
        enemy.idText.setPosition(
          enemy.sprite.x - enemy.idText.width / 2,
          enemy.sprite.y - enemy.sprite.height / 2 - 20
        );
      }
      // 精英标签跟随
      if (enemy.eliteLabel && enemy.eliteLabel.active) {
        enemy.eliteLabel.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.sprite.height / 2 - 32);
      }

      // 眩晕中不行动
      if (enemy.stunned) {
        enemy.sprite.setVelocityX(0);
        this._updateEnemyHPBar(enemy);
        continue;
      }

      // Boss AI
      if (enemy.isBoss) {
        this._updateBossAI(enemy, time, delta);
        this._updateEnemyHPBar(enemy);
        continue;
      }

      // 精英AI
      if (enemy.isElite) {
        this._updateEliteAI(enemy, time, delta);
        continue;
      }

      // 普通敌人AI
      const dist = Phaser.Math.Distance.Between(
        enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y
      );
      enemy.sprite.setFlipX(this.player.x < enemy.sprite.x);

      if (dist < 50 && !this.isDead) {
        enemy.sprite.setVelocityX(0);
        if (time - enemy.lastAttackTime > enemy.attackCooldown) {
          enemy.lastAttackTime = time;
          enemy.sprite.setTint(0xffffff);
          this.time.delayedCall(150, () => {
            if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();
          });
          this.damagePlayer(enemy.damage || 8);
        }
      } else if (dist > 45) {
        const dir = this.player.x > enemy.sprite.x ? 1 : -1;
        enemy.sprite.setVelocityX(dir * (enemy.speed || 80));
      } else {
        enemy.sprite.setVelocityX(0);
      }
      this._updateEnemyHPBar(enemy);
    }
  }

  // ==================== 精英AI（冲刺攻击） ====================
  _updateEliteAI(enemy, time, delta) {
    if (!this.isDead) {
      enemy.chargeTimer += delta;

      // 每3秒冲刺
      if (enemy.chargeTimer > 3000 && !enemy.isCharging) {
        enemy.isCharging = true;
        enemy.chargeTimer = 0;

        // 预警闪烁
        this.tweens.add({
          targets: enemy.sprite,
          alpha: 0.3,
          duration: 100,
          yoyo: true,
          repeat: 4,
          onComplete: () => {
            if (!enemy.sprite || !enemy.sprite.active) return;
            // 冲刺！
            const dir = this.player.x < enemy.sprite.x ? -1 : 1;
            enemy.sprite.setVelocityX(dir * enemy.speed * 4);
            // 冲刺期间伤害加倍
            const originalDmg = enemy.damage;
            enemy.damage = originalDmg * 2;
            this.time.delayedCall(400, () => {
              if (enemy.sprite && enemy.sprite.active) {
                enemy.sprite.setVelocityX(0);
                enemy.damage = originalDmg;
              }
              enemy.isCharging = false;
            });
          },
        });
      }
    }

    // 正常追逐
    if (enemy.isCharging) {
      // 冲刺中不进行普通移动
      this._updateEnemyHPBar(enemy);
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y
    );
    enemy.sprite.setFlipX(this.player.x < enemy.sprite.x);

    if (dist < 50 && !this.isDead) {
      enemy.sprite.setVelocityX(0);
      if (time - enemy.lastAttackTime > enemy.attackCooldown) {
        enemy.lastAttackTime = time;
        enemy.sprite.setTint(0xffffff);
        this.time.delayedCall(150, () => {
          if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();
        });
        this.damagePlayer(enemy.damage || 15);
      }
    } else if (dist > 45) {
      const dir = this.player.x > enemy.sprite.x ? 1 : -1;
      enemy.sprite.setVelocityX(dir * enemy.speed);
    } else {
      enemy.sprite.setVelocityX(0);
    }
    this._updateEnemyHPBar(enemy);
  }

  // ==================== Boss AI（三阶段） ====================
  _updateBossAI(boss, time, delta) {
    const dist = Phaser.Math.Distance.Between(
      boss.sprite.x, boss.sprite.y, this.player.x, this.player.y
    );
    boss.sprite.setFlipX(this.player.x < boss.sprite.x);

    // 更新各冷却
    if (!boss.roarCooldown) boss.roarCooldown = 0;
    if (!boss.sweepCooldown) boss.sweepCooldown = 0;
    if (!boss.lungeCooldown) boss.lungeCooldown = 0;
    boss.roarCooldown += delta;
    boss.sweepCooldown += delta;
    boss.lungeCooldown += delta;

    // 阶段一：缓慢追踪 + 扑击
    if (boss.bossPhase === 1) {
      this._bossChase(boss, dist, time, boss.speed);
      // 每5秒扑击
      if (boss.lungeCooldown > 5000 && !boss.isLunging) {
        boss.isLunging = true;
        boss.lungeCooldown = 0;
        const dir = this.player.x < boss.sprite.x ? -1 : 1;
        boss.sprite.setVelocityX(dir * boss.speed * 5);
        this.time.delayedCall(500, () => {
          if (boss.sprite && boss.sprite.active) boss.sprite.setVelocityX(0);
          boss.isLunging = false;
        });
      }
    }
    // 阶段二：加速 + 熊吼
    else if (boss.bossPhase === 2) {
      this._bossChase(boss, dist, time, boss.speed);
      // 每4秒熊吼
      if (boss.roarCooldown > 4000) {
        boss.roarCooldown = 0;
        this._bossRoar(boss, dist);
      }
    }
    // 阶段三：狂暴 + 暴怒横扫
    else if (boss.bossPhase === 3) {
      this._bossChase(boss, dist, time, boss.speed);
      // 每6秒暴怒横扫
      if (boss.sweepCooldown > 6000) {
        boss.sweepCooldown = 0;
        this._bossSweep(boss);
      }
    }
  }

  _bossChase(boss, dist, time, speed) {
    if (dist < 60 && !this.isDead) {
      boss.sprite.setVelocityX(0);
      if (time - boss.lastAttackTime > boss.attackCooldown) {
        boss.lastAttackTime = time;
        boss.sprite.setTint(0xffffff);
        this.time.delayedCall(150, () => {
          if (boss.sprite && boss.sprite.active) boss.sprite.clearTint();
        });
        const baseDmg = boss.damage || 20;
        this.damagePlayer(Math.floor(baseDmg * (boss.attackDmgMult || 1)));
      }
    } else if (dist > 55 && !boss.isLunging) {
      const dir = this.player.x > boss.sprite.x ? 1 : -1;
      boss.sprite.setVelocityX(dir * speed);
    } else {
      boss.sprite.setVelocityX(0);
    }
  }

  // 熊吼：屏幕震动 + 范围伤害
  _bossRoar(boss, dist) {
    // 屏幕震动
    this.cameras.main.shake(300, 0.01);

    // 范围伤害判定
    if (dist <= 150) {
      this.damagePlayer(10);
    }

    // 视觉特效
    const roarGfx = this.add.graphics().setDepth(15);
    roarGfx.lineStyle(3, 0xff4400, 0.4);
    roarGfx.strokeCircle(boss.sprite.x, boss.sprite.y, 150);
    this.tweens.add({
      targets: roarGfx,
      alpha: 0,
      duration: 500,
      onComplete: () => { if (roarGfx && roarGfx.destroy) roarGfx.destroy(); },
    });
  }

  // 暴怒横扫：扇形攻击判定
  _bossSweep(boss) {
    const dir = this.player.x < boss.sprite.x ? -1 : 1;
    const sweepX = boss.sprite.x + dir * 50;
    const sweepW = 80, sweepH = 90;

    // 半透明红色矩形显示0.5秒
    const sweepGfx = this.add.graphics().setDepth(15);
    sweepGfx.fillStyle(0xff0000, 0.35);
    sweepGfx.fillRect(sweepX - sweepW / 2, boss.sprite.y - sweepH, sweepW, sweepH);
    sweepGfx.lineStyle(2, 0xff4444, 0.6);
    sweepGfx.strokeRect(sweepX - sweepW / 2, boss.sprite.y - sweepH, sweepW, sweepH);

    this.tweens.add({
      targets: sweepGfx,
      alpha: 0,
      duration: 500,
      onComplete: () => { if (sweepGfx && sweepGfx.destroy) sweepGfx.destroy(); },
    });

    // 伤害判定
    const sweepBounds = new Phaser.Geom.Rectangle(
      sweepX - sweepW / 2, boss.sprite.y - sweepH, sweepW, sweepH
    );
    const playerBounds = this.player.getBounds();
    if (Phaser.Geom.Intersects.RectangleToRectangle(sweepBounds, playerBounds)) {
      this.damagePlayer(35);
    }
  }

  // ==================== 通用血条更新 ====================
  _updateEnemyHPBar(enemy) {
    if (!enemy || !enemy.sprite) return;

    // Boss不使用头顶血条
    if (enemy.isBoss) return;

    const barW = enemy.hpBarWide || 36;
    const barH = 4;
    const barX = enemy.sprite.x - barW / 2;
    const barY = enemy.sprite.y - 30;

    if (enemy.hpBarBg) {
      enemy.hpBarBg.clear();
      enemy.hpBarBg.fillStyle(0x000000);
      enemy.hpBarBg.fillRect(barX, barY, barW, barH);
    }

    if (enemy.hpBar) {
      const ratio = Math.max(0, enemy.hp / enemy.maxHP);
      enemy.hpBar.clear();
      if (ratio > 0) {
        // 精英用橙色血条
        const color = enemy.isElite ? 0xff4400 : 0xff3333;
        enemy.hpBar.fillStyle(color);
        enemy.hpBar.fillRect(barX, barY, Math.floor(barW * ratio), barH);
      }
    }
  }

  // ==================== 伤害数字 ====================
  spawnDamageNumber(x, y, amount, color) {
    const txt = this.add.text(x, y, `-${amount}`, {
      fontSize: '18px', color, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: txt, y: y - 35, alpha: 0, duration: 600,
      onComplete: () => { if (txt && txt.active) txt.destroy(); },
    });
  }

  // ==================== 玩家受伤 ====================
  damagePlayer(amount) {
    if (this.isDead || this.isInvincible) return;

    const finalDmg = this.effectSystem.applyDefenseEffects(amount);
    this.shieldHP = this._gameData.shieldHP;

    this.playerHP -= finalDmg;
    this.score.totalDmgTaken += finalDmg;

    this.scoreSystem.recordDamageTaken();
    this.score.maxNoDmgStreak = Math.max(this.score.maxNoDmgStreak, this.score.noDmgTime);

    this.spawnDamageNumber(this.player.x, this.player.y - 30, finalDmg, '#ff4444');

    this.isInvincible = true;
    this.tweens.add({
      targets: this.player, alpha: 0.3, yoyo: true, repeat: 4, duration: 100,
      onComplete: () => {
        if (this.player && this.player.active) this.player.setAlpha(1);
        this.isInvincible = false;
      },
    });

    if (this.playerHP <= 0) {
      if (this.effectSystem.applyDeathSave(this._deathSaveUsed)) {
        this._deathSaveUsed = true;
        this.playerHP = this._gameData.playerHP;
        this.isInvincible = true;
        this.time.delayedCall(1500, () => { this.isInvincible = false; });
        return;
      }

      this.playerHP = 0;
      this.isDead = true;
      this.deathTime = this.time.now;
      this.player.setTint(0xff0000);
      this.player.setVelocityX(0);
      this.player.body.enable = false;
    }
  }

  // ==================== 灵石拾取 ====================
  updateSpiritStones() {
    for (let i = this.spiritStoneDrops.length - 1; i >= 0; i--) {
      const stone = this.spiritStoneDrops[i];
      if (!stone || !stone.sprite || !stone.sprite.active) {
        this.spiritStoneDrops.splice(i, 1);
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, stone.sprite.x, stone.sprite.y
      );
      if (dist < 40) {
        this.spiritStoneCount++;
        this.spiritText.setText(`灵石: ${this.spiritStoneCount}`);
        stone.sprite.destroy();
        this.spiritStoneDrops.splice(i, 1);
      }
    }
    // 地面灵石追踪（战后自动回收用）
    this.groundLingshi = this.groundLingshi.filter(s => s && s.active);
  }

  // ==================== 草药拾取 ====================
  updateHerbDrops() {
    for (let i = this.herbDrops.length - 1; i >= 0; i--) {
      const drop = this.herbDrops[i];
      if (!drop || !drop.sprite || !drop.sprite.active) {
        this.herbDrops.splice(i, 1);
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, drop.sprite.x, drop.sprite.y
      );
      if (dist < 40) {
        const herb = HERBS[drop.type];
        if (herb) {
          this._addHerbToSave(drop.type);
          const txt = this.add.text(drop.sprite.x, drop.sprite.y - 20, `获得${herb.name}×1`, {
            fontSize: '14px', color: '#44ff44', fontFamily: FONT, fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(50);
          this.tweens.add({
            targets: txt, y: txt.y - 50, alpha: 0, duration: 1200,
            onComplete: () => txt.destroy(),
          });
        }
        drop.sprite.destroy();
        this.herbDrops.splice(i, 1);
      }
    }
  }

  _addHerbToSave(herbId) {
    const save = this.registry.get('currentSave');
    if (!save) return;
    if (!save.herbs) save.herbs = {};
    save.herbs[herbId] = (save.herbs[herbId] || 0) + 1;
  }

  // ==================== HUD ====================
  updateRealmHUD() {
    this.hudRealmText.setText(`灵力  ${this.currentRealm}`);
  }

  updateHPHUD() {
    if (this.hudHpText && this.hudHpText.active) {
      this.hudHpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
    }
  }

  updateMPHUD() {
    if (this.hudMpText && this.hudMpText.active) {
      this.hudMpText.setText(`MP: ${Math.floor(this.currentMP)}/${this.playerMaxMP}`);
    }
  }

  drawHPBar() {
    this.hpBarBg.clear();
    this.hpBarFg.clear();
    const barX = 16, barY = 45, barW = 200, barH = 10;
    const ratio = Math.max(0, this.playerHP / this.playerMaxHP);
    this.hpBarBg.fillStyle(0x333333);
    this.hpBarBg.fillRect(barX, barY, barW, barH);
    if (ratio > 0) {
      let color = ratio > 0.5 ? 0xcc3333 : ratio > 0.25 ? 0xcc8833 : 0xcc2222;
      this.hpBarFg.fillStyle(color);
      this.hpBarFg.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    }
  }

  drawMPBar() {
    this.mpBarBg.clear();
    this.mpBarFg.clear();
    const barX = 16, barY = 75, barW = 200, barH = 10;
    const ratio = Math.max(0, this.currentMP / this.playerMaxMP);
    this.mpBarBg.fillStyle(0x333333);
    this.mpBarBg.fillRect(barX, barY, barW, barH);

    const flashing = this.time.now - this.mpFlashTime < 400;
    const barColor = flashing ? 0xff3333 : 0x3366ff;

    if (ratio > 0) {
      this.mpBarFg.fillStyle(barColor);
      this.mpBarFg.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    }
  }

  showAutoSaveHint() {
    const hint = this.add.text(WIDTH - 20, HEIGHT - 20, '✦ 已自动保存', {
      fontSize: '12px', color: '#aaaaaa', fontFamily: FONT,
    }).setOrigin(1, 1).setDepth(2000);
    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: () => hint.destroy(),
    });
  }

  // ==================== 词条HUD ====================
  updateRelicHUD() {
    if (this._relicHudBg) this._relicHudBg.destroy();
    if (this._relicHudTexts) {
      this._relicHudTexts.forEach(t => { if (t && t.destroy) t.destroy(); });
    }
    this._relicHudTexts = [];

    if (this.battleRelics.length === 0) return;

    const hudX = 14, startY = 110;
    const rarityColors = { common: '#aaaaaa', rare: '#4488ff', legendary: '#ffd700' };

    this._relicHudBg = this.add.graphics().setDepth(50);
    this._relicHudBg.fillStyle(0x000000, 0.5);
    this._relicHudBg.fillRoundedRect(hudX - 4, startY - 4, 180, this.battleRelics.length * 18 + 8, 4);

    this.battleRelics.forEach((relic, i) => {
      const color = rarityColors[relic.rarity] || '#aaaaaa';
      const t = this.add.text(hudX, startY + i * 18, `◆ ${relic.name}`, {
        fontSize: '11px', color, fontFamily: FONT,
      }).setDepth(51);
      this._relicHudTexts.push(t);
    });
  }
}
