import Phaser from 'phaser';
import { WIDTH, HEIGHT, CURRENCY } from '../config.js';
import { addToBag } from '../utils/helpers.js';
import SaveManager from '../utils/SaveManager.js';
import { GACHA_POOLS, drawCard, RARITY_COLOR, applyCardEffect } from '../systems/GachaSystem.js';
import PauseMenu from '../ui/PauseMenu.js';

export default class GachaScene extends Phaser.Scene {
  constructor() {
    super('GachaScene');
  }

  create() {
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');

    // ---- 背景 ----
    this.cameras.main.setBackgroundColor('#0d0d1a');

    // 星点装饰
    const stars = this.add.graphics();
    for (let i = 0; i < 50; i++) {
      const sx = Math.random() * WIDTH;
      const sy = Math.random() * HEIGHT;
      const r = Math.random() * 1.4 + 0.4;
      const alpha = Math.random() * 0.35 + 0.08;
      stars.fillStyle(0xffffff, alpha);
      stars.fillCircle(sx, sy, r);
    }

    // 顶部标题
    this.add.text(WIDTH / 2, 24, '机缘阁', {
      fontSize: '36px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 56, '天地机缘，皆在一念之间', {
      fontSize: '12px', color: '#555577',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // 货币信息（右上）
    this.currencyText = this.add.text(WIDTH - 40, 16, '', {
      fontSize: '17px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 0);

    // 返回按钮
    this.createBackButton();

    // 四张卡池卡片（2×2 网格）
    this.createPoolCards();

    // 抽卡动画层（初始隐藏）
    this.createDrawOverlay();

    // 刷新HUD
    this.refreshUI();

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
    this.pauseMenu = new PauseMenu(this, { sceneName: '机缘阁' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });
    this.events.on('shutdown', () => {
      this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
    });
  }

  // ==================== 返回大厅按钮 ====================
  createBackButton() {
    const btnW = 130, btnH = 32;
    const btnX = 30, btnY = 14;
    const gfx = this.add.graphics();
    const draw = (fill, stroke) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.8);
      gfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      gfx.lineStyle(1.5, stroke);
      gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    };
    draw(0x1a1a2e, 0x4466aa);
    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '返回大厅', {
      fontSize: '14px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x2a2a3e, 0x6688cc));
    zone.on('pointerout', () => draw(0x1a1a2e, 0x4466aa));
    zone.on('pointerdown', () => {
      SaveManager.save(this.slotId, this.save);
      this.scene.start('HallScene');
    });
  }

  // ==================== 2×2 卡池卡片网格 ====================
  createPoolCards() {
    const poolKeys = ['dan', 'fabao', 'tiancai', 'gongfa'];
    const cardW = 440;
    const cardH = 260;
    const gapX = 30;
    const gapY = 24;
    const totalW = cardW * 2 + gapX;
    const startX = (WIDTH - totalW) / 2;
    const startY = 88;

    this._btnRefs = {};

    poolKeys.forEach((key, i) => {
      const pool = GACHA_POOLS[key];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      // 卡片背景
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x111133, 0.7);
      cardBg.fillRoundedRect(cx, cy, cardW, cardH, 12);
      const borderColor = parseInt(pool.color.slice(1), 16);
      cardBg.lineStyle(2, borderColor, 0.5);
      cardBg.strokeRoundedRect(cx, cy, cardW, cardH, 12);

      // 图标
      this.add.text(cx + 56, cy + cardH / 2, pool.icon, {
        fontSize: '46px',
      }).setOrigin(0.5);

      // 卡池名 + 描述（图标右侧）
      const textX = cx + 100;
      this.add.text(textX, cy + 30, pool.name, {
        fontSize: '24px', color: pool.color,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      });

      this.add.text(textX, cy + 62, pool.description, {
        fontSize: '12px', color: '#777799',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });

      // 花费
      this.add.text(textX, cy + 88, `花费：${pool.cost.xianyu} ${CURRENCY.xianyu.icon}`, {
        fontSize: '15px', color: CURRENCY.xianyu.color,
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });

      // 概率说明
      this.add.text(textX, cy + 116, '普通 70%  |  稀有 25%  |  传说 5%', {
        fontSize: '11px', color: '#666677',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });

      // 池内道具数量
      const commonCount = pool.items.filter(it => it.rarity === 'common').length;
      const rareCount = pool.items.filter(it => it.rarity === 'rare').length;
      const legCount = pool.items.filter(it => it.rarity === 'legendary').length;
      this.add.text(textX, cy + 138, `收录：普通×${commonCount}  稀有×${rareCount}  传说×${legCount}`, {
        fontSize: '11px', color: '#555566',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      });

      // 抽取按钮
      const btnW = 140, btnH = 42;
      const btnX = cx + cardW - btnW - 28;
      const btnY = cy + cardH - btnH - 20;

      const btnGfx = this.add.graphics();
      const drawBtn = (fill, strokeCol) => {
        btnGfx.clear();
        btnGfx.fillStyle(fill, 0.9);
        btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
        btnGfx.lineStyle(2, strokeCol);
        btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      };
      drawBtn(0x1a2a3a, borderColor);

      this.add.text(btnX + btnW / 2, btnY + btnH / 2, '抽取一次', {
        fontSize: '17px', color: '#ffffff',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });

      btnZone.on('pointerover', () => drawBtn(0x2a3a4a, borderColor));
      btnZone.on('pointerout', () => drawBtn(0x1a2a3a, borderColor));
      btnZone.on('pointerdown', () => {
        this.tryDraw(key, pool, btnGfx, drawBtn, borderColor);
      });

      this._btnRefs[key] = { btnGfx, drawBtn, borderColor };
    });
  }

  // ==================== 尝试抽卡 ====================
  tryDraw(poolKey, pool, btnGfx, drawBtn, borderColor) {
    const cost = pool.cost.xianyu;

    if (this.save.xianyu < cost) {
      // 仙玉不足，按钮变红
      drawBtn(0x442222, 0xff4444);
      this.time.delayedCall(400, () => {
        drawBtn(0x1a2a3a, borderColor);
      });
      return;
    }

    // 扣除仙玉
    this.save.xianyu -= cost;
    SaveManager.save(this.slotId, this.save);
    this.refreshUI();

    // 抽卡
    const card = drawCard(poolKey);
    if (!card) return;

    // 存入背包（附带 poolKey）
    const result = addToBag(this.save, { ...card, poolKey });
    if (!result.success) {
      // 背包已满（60格全满）
      this._showBagFullWarning();
      // 退还仙玉
      this.save.xianyu += cost;
      SaveManager.save(this.slotId, this.save);
      this.refreshUI();
      return;
    }
    SaveManager.save(this.slotId, this.save);

    // 播放动画
    this.showDrawAnimation(card, poolKey);
  }

  // ==================== 抽卡动画层 ====================
  createDrawOverlay() {
    this.drawContainer = this.add.container(0, 0).setDepth(200).setVisible(false);
    this._drawElements = [];
    this._drawTweens = [];
    this._drawParticles = [];
  }

  showDrawAnimation(card, poolKey) {
    // 清理上次动画残留
    this._clearDrawElements();

    const rarityCfg = RARITY_COLOR[card.rarity];
    const isLegendary = card.rarity === 'legendary';

    // ---- 黑色遮罩 ----
    const overlay = this.add.graphics();
    overlay.setAlpha(0);
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawContainer.add(overlay);
    this._drawElements.push(overlay);

    // ---- 卡片背景 ----
    const cardW = 340, cardH = 300;
    const cardX = (WIDTH - cardW) / 2;
    const cardY = (HEIGHT - cardH) / 2 - 20;

    const cardBg = this.add.graphics();
    cardBg.fillStyle(parseInt(rarityCfg.bg.slice(1), 16), 0.95);
    cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    const borderHex = parseInt(rarityCfg.text.slice(1), 16);
    cardBg.lineStyle(3, borderHex, 0.8);
    cardBg.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    cardBg.setScale(0);
    this.drawContainer.add(cardBg);
    this._drawElements.push(cardBg);

    // ---- 稀有度标签 ----
    const rarityLabel = this.add.text(cardX + cardW / 2, cardY + 28, rarityCfg.label, {
      fontSize: '18px', color: rarityCfg.text,
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    rarityLabel.setScale(0);
    this.drawContainer.add(rarityLabel);
    this._drawElements.push(rarityLabel);

    // ---- 来源卡池 ----
    const poolName = GACHA_POOLS[poolKey] ? GACHA_POOLS[poolKey].name : '未知';
    const sourceText = this.add.text(cardX + cardW / 2, cardY + 50, `来源：${poolName}`, {
      fontSize: '13px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    sourceText.setScale(0);
    this.drawContainer.add(sourceText);
    this._drawElements.push(sourceText);

    // ---- 道具名称 ----
    const nameText = this.add.text(cardX + cardW / 2, cardY + 82, card.name, {
      fontSize: '30px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    nameText.setScale(0);
    this.drawContainer.add(nameText);
    this._drawElements.push(nameText);

    // ---- 分隔线 ----
    const sepLine = this.add.graphics();
    sepLine.lineStyle(1, borderHex, 0.4);
    sepLine.lineBetween(cardX + 40, cardY + 108, cardX + cardW - 40, cardY + 108);
    sepLine.setScale(0);
    this.drawContainer.add(sepLine);
    this._drawElements.push(sepLine);

    // ---- 效果描述 ----
    const descText = this.add.text(cardX + cardW / 2, cardY + 135, card.desc, {
      fontSize: '16px', color: '#cccccc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      wordWrap: { width: cardW - 60 },
      align: 'center',
    }).setOrigin(0.5);
    descText.setScale(0);
    this.drawContainer.add(descText);
    this._drawElements.push(descText);

    // ---- 存入背包提示 ----
    const bagHint = this.add.text(cardX + cardW / 2, cardY + 175, '已存入储物袋，可在背包中查看', {
      fontSize: '12px', color: '#666688',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
    bagHint.setScale(0);
    this.drawContainer.add(bagHint);
    this._drawElements.push(bagHint);

    // ---- 收入囊中按钮 ----
    const collectBtnW = 180, collectBtnH = 48;
    const collectBtnX = cardX + (cardW - collectBtnW) / 2;
    const collectBtnY = cardY + cardH - 64;

    const collectBtnGfx = this.add.graphics();
    const drawCollectBtn = (fill, stroke) => {
      collectBtnGfx.clear();
      collectBtnGfx.fillStyle(fill, 0.9);
      collectBtnGfx.fillRoundedRect(collectBtnX, collectBtnY, collectBtnW, collectBtnH, 10);
      collectBtnGfx.lineStyle(2, stroke);
      collectBtnGfx.strokeRoundedRect(collectBtnX, collectBtnY, collectBtnW, collectBtnH, 10);
    };
    drawCollectBtn(0x223322, borderHex);
    this.drawContainer.add(collectBtnGfx);
    this._drawElements.push(collectBtnGfx);

    const collectBtnText = this.add.text(collectBtnX + collectBtnW / 2, collectBtnY + collectBtnH / 2, '收入囊中', {
      fontSize: '20px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.drawContainer.add(collectBtnText);
    this._drawElements.push(collectBtnText);

    const collectZone = this.add.zone(collectBtnX + collectBtnW / 2, collectBtnY + collectBtnH / 2, collectBtnW, collectBtnH)
      .setInteractive({ useHandCursor: true });
    this.drawContainer.add(collectZone);
    this._drawElements.push(collectZone);

    collectZone.on('pointerover', () => drawCollectBtn(0x334433, borderHex));
    collectZone.on('pointerout', () => drawCollectBtn(0x223322, borderHex));
    collectZone.on('pointerdown', () => {
      const msg = applyCardEffect(card, this.save);
      SaveManager.save(this.slotId, this.save);
      this._collectCard(msg);
    });

    // ---- 传说粒子（金色光点） ----
    if (isLegendary) {
      this._spawnLegendaryParticles(cardX + cardW / 2, cardY + cardH / 2);
    }

    // ---- 动画 ----
    this.drawContainer.setVisible(true);

    const tweenOverlay = this.tweens.add({
      targets: overlay, alpha: 1, duration: 250, ease: 'Sine.easeIn',
    });
    this._drawTweens.push(tweenOverlay);

    // 卡片弹出：0 → 1.2 → 1
    const scaleItems = [cardBg, rarityLabel, sourceText, nameText, sepLine, descText, bagHint, collectBtnGfx, collectBtnText];
    scaleItems.forEach(item => {
      const t = this.tweens.add({
        targets: item,
        scale: { from: 0, to: 1 },
        duration: 450,
        ease: 'Back.easeOut',
        delay: 250,
      });
      this._drawTweens.push(t);
    });

    // 传说卡边框闪烁
    if (isLegendary) {
      const flashTween = this.tweens.add({
        targets: cardBg,
        alpha: { from: 1, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
      this._drawTweens.push(flashTween);
    }
  }

  // ==================== 传说粒子特效 ====================
  _spawnLegendaryParticles(cx, cy) {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const dist = 120 + Math.random() * 60;
      const tx = cx + Math.cos(angle) * dist;
      const ty = cy + Math.sin(angle) * dist;

      const particle = this.add.circle(cx, cy, 2 + Math.random() * 3, 0xffcc44, 1);
      this.drawContainer.add(particle);
      this._drawParticles.push(particle);

      const t = this.tweens.add({
        targets: particle,
        x: tx, y: ty,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.2 },
        duration: 800 + Math.random() * 400,
        ease: 'Sine.easeOut',
        delay: 300 + Math.random() * 200,
        onComplete: () => { particle.destroy(); },
      });
      this._drawTweens.push(t);
    }
  }

  // ==================== 收集卡片 ====================
  _collectCard(msg) {
    const tweenOut = this.tweens.add({
      targets: this.drawContainer,
      alpha: { from: 1, to: 0 },
      duration: 250,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.drawContainer.setVisible(false);
        this.drawContainer.setAlpha(1);
        this._clearDrawElements();
        this.refreshUI();
      },
    });
    this._drawTweens.push(tweenOut);

    // 飘字提示
    const tipText = this.add.text(WIDTH / 2, HEIGHT / 2 + 110, msg, {
      fontSize: '18px', color: '#44ff88',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(250).setAlpha(0);

    this.tweens.add({
      targets: tipText,
      alpha: { from: 1, to: 0 },
      y: HEIGHT / 2 + 80,
      duration: 2000,
      delay: 100,
      ease: 'Sine.easeOut',
      onComplete: () => { tipText.destroy(); },
    });
  }

  // ==================== 清理动画元素 ====================
  _clearDrawElements() {
    this._drawTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
    this._drawTweens = [];

    this._drawElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    this._drawElements = [];

    this._drawParticles.forEach(p => { if (p && p.destroy) p.destroy(); });
    this._drawParticles = [];
  }

  // ==================== 背包已满警告 ====================
  _showBagFullWarning() {
    const warnText = this.add.text(WIDTH / 2, HEIGHT / 2, '储物袋已满，请整理后再试', {
      fontSize: '22px', color: '#ff4444',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(300).setAlpha(0);

    this.tweens.add({
      targets: warnText,
      alpha: { from: 0, to: 1 },
      y: { from: HEIGHT / 2 + 10, to: HEIGHT / 2 },
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: warnText,
          alpha: 0,
          delay: 1500,
          duration: 500,
          onComplete: () => { warnText.destroy(); },
        });
      },
    });
  }

  // ==================== 刷新界面 ====================
  refreshUI() {
    this.currencyText.setText([
      `灵石：${this.save.lingshi} ${CURRENCY.lingshi.icon}`,
      `仙玉：${this.save.xianyu} ${CURRENCY.xianyu.icon}`,
    ].join('    '));
  }

  // ==================== 自动保存提示 ====================
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

  // ==================== 更新循环 ====================
  update() {
    if (this.pauseMenu && this.pauseMenu.visible) return;
  }
}
