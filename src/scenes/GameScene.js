import Phaser from 'phaser';
import { WIDTH, HEIGHT, REALMS, REALM_SWORD_CONFIG, getMajorRealmName } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { calcPlayerStats } from '../utils/helpers.js';
import PauseMenu from '../ui/PauseMenu.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // ============ 背景渐变色块 ============
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

    // 玩家ID文字
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

    // ============ 输入（鼠标 + 键盘移动/跳跃） ============
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyRealm = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);

    // 禁用右键菜单
    this.input.mouse.disableContextMenu();

    // 鼠标攻击（左右键完全独立，互不穿透）
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
      sceneName: '秘境战斗中', showRestart: true, hasPhysics: true,
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
          // 刷新倾向到存档
          if (this._tendencies) {
            if (!s.cultivation) s.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
            if (!s.cultivation.tendencies) s.cultivation.tendencies = { tixiu: 0, jianxiu: 0, shenshi: 0 };
            // 每次只累加增量（不清零，goToScene 时一次性写入）
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
    });

    // ============ HUD ============
    // 灵力 & 境界
    this.hudRealmText = this.add.text(16, 12, '', {
      fontSize: '16px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // HP 文字
    this.hudHpText = this.add.text(16, 30, '', {
      fontSize: '13px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 血条
    this.hpBarBg = this.add.graphics();
    this.hpBarFg = this.add.graphics();

    // MP 文字
    this.hudMpText = this.add.text(16, 60, '', {
      fontSize: '13px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 灵力条
    this.mpBarBg = this.add.graphics();
    this.mpBarFg = this.add.graphics();

    // 击杀 & 灵石
    this.killText = this.add.text(16, 86, '', {
      fontSize: '14px', color: '#ffcc00',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });
    this.spiritText = this.add.text(WIDTH - 16, 12, '灵石: 0', {
      fontSize: '16px', color: '#ffd700',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 0);

    this.clearText = this.add.text(WIDTH / 2, HEIGHT / 2 - 40, '本轮秘境已清', {
      fontSize: '52px', color: '#ffd700',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    // ============ 存档 & 属性 ============
    const save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');
    this.sessionTime = 0;
    // 修炼方向属性计算
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

    // 倾向变化量（本局，结束后写入 save.cultivation.tendencies）
    this._tendencies = { tixiu: 0, jianxiu: 0, shenshi: 0 };

    // ============ 战斗状态 ============
    this.isInvincible = false;
    this.killCount = 0;
    this.spiritStoneCount = 0;
    this.isDead = false;
    this.deathTime = 0;
    this.gameEnded = false;

    // 近战
    this.meleeCooldown = 350;
    this.lastMeleeTime = 0;
    // 远程
    this.rangedCooldown = 400;
    this.lastRangedTime = 0;

    // MP 闪烁
    this.mpFlashTime = -1000;

    this.jumpForce = -580;

    // 敌人ID计数器
    this._enemyIdCounter = 0;

    // 波次
    this.waveState = 'fighting';
    this.waveNum = 0;
    this.waveDelay = 0;
    this.waveClearTime = 0;

    this.physics.world.gravity.y = 600;
    this.spawnWave(3);

    this.updateRealmHUD();
    this.updateHPHUD();
    this.updateMPHUD();
    this.drawHPBar();
    this.drawMPBar();
  }

  // ==================== 场景跳转 ====================
  goToScene(name, data) {
    // 将本局倾向写入存档
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

  // ==================== 刷怪 ====================
  spawnWave(count) {
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(700, 1200);
      const sprite = this.physics.add.sprite(x, 500, 'enemy');
      sprite.body.setSize(28, 40);
      this.physics.add.collider(sprite, this.ground);

      const hpBarBg = this.add.graphics();
      const hpBar = this.add.graphics();

      this._enemyIdCounter++;
      const enemyObj = {
        sprite, hp: 30, maxHP: 30,
        lastAttackTime: 0, attackCooldown: 1500,
        hpBarBg, hpBar,
        id: `enemy_${this._enemyIdCounter}`,
        idText: null,
      };
      // 敌人ID文字
      const idText = this.add.text(0, 0, enemyObj.id, {
        fontSize: '10px', color: '#ffaaaa',
        backgroundColor: '#000000', padding: { x: 2, y: 1 },
      }).setDepth(100);
      enemyObj.idText = idText;
      this.enemies.push(enemyObj);
    }
  }

  // ==================== 主循环 ====================
  update(time, delta) {
    if (this.pauseMenu && this.pauseMenu.visible) return;
    if (this.gameEnded) return;

    // 游玩时长累计
    this.sessionTime = (this.sessionTime || 0) + delta / 1000;

    if (this.isDead) {
      if (time - this.deathTime > 2000) {
        this.gameEnded = true;
        this.goToScene('GameOverScene', {
          result: 'dead', lingshi: this.spiritStoneCount, killCount: this.killCount,
        });
      }
      return;
    }

    // ---- MP 回复（基于修炼方向） ----
    const regenRate = this.playerMpRegen;
    this.currentMP = Math.min(this.playerMaxMP, this.currentMP + regenRate * (delta / 1000));

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;

    // ---- 移动 ----
    if (this.cursors.left.isDown || this.keyA.isDown) {
      this.player.setVelocityX(-this.moveSpeed);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown || this.keyD.isDown) {
      this.player.setVelocityX(this.moveSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // ---- 跳跃 ----
    if ((this.cursors.up.isDown || this.keyW.isDown) && onGround) {
      this.player.setVelocityY(this.jumpForce);
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
    this.updateAllEnemies(time);

    // ---- 灵石拾取 ----
    this.updateSpiritStones();

    // ---- 波次 ----
    this.checkWaves(time);

    // ---- HUD ----
    this.updateHPHUD();
    this.updateMPHUD();
    this.drawHPBar();
    this.drawMPBar();
  }

  // ==================== 波次 ====================
  checkWaves(time) {
    if (this.waveState === 'fighting' && this.enemies.length === 0) {
      this.waveNum++;
      if (this.waveNum >= 2) {
        this.waveState = 'cleared';
        this.waveClearTime = time;
        this.tweens.add({ targets: this.clearText, alpha: 1, duration: 500 });
      } else {
        this.waveState = 'waiting';
        this.waveDelay = time;
      }
    }
    if (this.waveState === 'waiting' && time - this.waveDelay > 2000) {
      this.spawnWave(5);
      this.waveState = 'fighting';
    }
    if (this.waveState === 'cleared' && time - this.waveClearTime > 3000) {
      this.gameEnded = true;
      this.goToScene('GameOverScene', {
        result: 'clear', lingshi: this.spiritStoneCount, killCount: this.killCount,
      });
    }
  }

  // ==================== 近战攻击（左键） ====================
  performMelee() {
    const dir = this.player.flipX ? -1 : 1;
    // 判定框：玩家前方 70×60
    const hx = this.player.x + dir * 53;
    const hy = this.player.y;

    // 白色半透明指示器
    const hitGfx = this.add.graphics();
    hitGfx.fillStyle(0xffffff, 0.25);
    hitGfx.fillRect(hx - 35, hy - 30, 70, 60);
    hitGfx.lineStyle(1, 0xffffff, 0.5);
    hitGfx.strokeRect(hx - 35, hy - 30, 70, 60);
    this.time.delayedCall(100, () => {
      if (hitGfx) hitGfx.destroy();
    });

    // 命中检测
    const hitBounds = new Phaser.Geom.Rectangle(hx - 35, hy - 30, 70, 60);
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const enemy = this.enemies[j];
      if (!enemy || !enemy.sprite || !enemy.sprite.active) continue;
      const eBounds = enemy.sprite.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(hitBounds, eBounds)) {
        this.applyDamageToEnemy(enemy, j, Math.floor(this.playerAtk * this.playerMeleeDmgBonus));
        this._tendencies.tixiu += 1;
      }
    }
  }

  // ==================== 远程剑气（右键） ====================
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
          this.applyDamageToEnemy(enemy, j, Math.floor(this.playerAtk * this.playerSwordDmgBonus));
          this._tendencies.jianxiu += 1;
          this.projectiles.splice(i, 1);
          p.destroy();
          break;
        }
      }
    }
  }

  // ==================== 通用伤害处理（含暴击） ====================
  applyDamageToEnemy(enemy, enemyIndex, dmg) {
    let finalDmg = dmg;
    let isCrit = false;

    if (Math.random() < this.playerCritRate) {
      finalDmg = Math.floor(dmg * this.playerCritDmg);
      isCrit = true;
      this._tendencies.shenshi += 1;
    }

    enemy.hp -= finalDmg;

    if (enemy.sprite && enemy.sprite.active) {
      enemy.sprite.setTint(isCrit ? 0xff8844 : 0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();
      });
      this.spawnDamageNumber(enemy.sprite.x, enemy.sprite.y - 20, finalDmg, isCrit ? '#ff8844' : '#ffff00');
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, enemyIndex);
    }
  }

  // ==================== 击杀敌人 ====================
  killEnemy(enemy, enemyIndex) {
    if (enemy.sprite && enemy.sprite.body) enemy.sprite.body.enable = false;
    if (enemy.hpBarBg) enemy.hpBarBg.destroy();
    if (enemy.hpBar) enemy.hpBar.destroy();
    if (enemy.idText) { enemy.idText.destroy(); enemy.idText = null; }

    if (Math.random() < 0.6 && enemy.sprite) {
      const stone = this.add.circle(enemy.sprite.x, enemy.sprite.y, 6, 0xffd700);
      stone.setDepth(10);
      this.spiritStoneDrops.push({ sprite: stone });
    }

    this.killCount++;
    this.killText.setText(`击杀数: ${this.killCount}`);

    if (enemy.sprite) {
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
  }

  // ==================== 敌人 AI ====================
  updateAllEnemies(time) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.sprite || !enemy.sprite.active) {
        if (enemy) {
          if (enemy.hpBarBg) enemy.hpBarBg.destroy();
          if (enemy.hpBar) enemy.hpBar.destroy();
          if (enemy.idText) { enemy.idText.destroy(); enemy.idText = null; }
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
          this.damagePlayer(8);
        }
      } else if (dist > 45) {
        const dir = this.player.x > enemy.sprite.x ? 1 : -1;
        enemy.sprite.setVelocityX(dir * 80);
      } else {
        enemy.sprite.setVelocityX(0);
      }
      this.updateEnemyHPBar(enemy);
    }
  }

  updateEnemyHPBar(enemy) {
    if (!enemy || !enemy.hpBarBg || !enemy.hpBar || !enemy.sprite) return;
    const ratio = Math.max(0, enemy.hp / enemy.maxHP);
    const barW = 36, barH = 4;
    const barX = enemy.sprite.x - barW / 2;
    const barY = enemy.sprite.y - 30;
    enemy.hpBarBg.clear();
    enemy.hpBarBg.fillStyle(0x000000);
    enemy.hpBarBg.fillRect(barX, barY, barW, barH);
    if (ratio > 0) {
      enemy.hpBar.clear();
      enemy.hpBar.fillStyle(0xff3333);
      enemy.hpBar.fillRect(barX, barY, barW * ratio, barH);
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
    const actualDmg = Math.max(1, Math.floor(amount * (1 - this.playerDefense)));
    this.playerHP -= actualDmg;
    this.spawnDamageNumber(this.player.x, this.player.y - 30, actualDmg, '#ff4444');

    this.isInvincible = true;
    this.tweens.add({
      targets: this.player, alpha: 0.3, yoyo: true, repeat: 4, duration: 100,
      onComplete: () => {
        if (this.player && this.player.active) this.player.setAlpha(1);
        this.isInvincible = false;
      },
    });

    if (this.playerHP <= 0) {
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

    // 灵力不足时闪红
    const flashing = this.time.now - this.mpFlashTime < 400;
    const barColor = flashing ? 0xff3333 : 0x3366ff;

    if (ratio > 0) {
      this.mpBarFg.fillStyle(barColor);
      this.mpBarFg.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    }
  }

  showAutoSaveHint() {
    const hint = this.add.text(WIDTH - 20, HEIGHT - 20, '✦ 已自动保存', {
      fontSize: '12px', color: '#aaaaaa',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 1).setDepth(2000);
    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: () => hint.destroy(),
    });
  }
}
