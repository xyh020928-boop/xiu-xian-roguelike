import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import { RARITY_COLOR } from './GachaSystem.js';
import { drawBattleRelics } from './RelicSystem.js';

export default class ChestSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game; // { chests, chestGFX, player, activeRelics, relicSelectionEls }
  }

  // ==================== 宝箱系统 ====================
  spawnChest(x, y) {
    const chestY = Math.min(y, 590); // 保持在地面上
    const gfx = this.scene.add.graphics().setDepth(10);
    // 宝箱主体
    gfx.fillStyle(0x886622);
    gfx.fillRoundedRect(x - 14, chestY - 10, 28, 20, 3);
    // 盖子
    gfx.fillStyle(0xaa8833);
    gfx.fillRoundedRect(x - 15, chestY - 14, 30, 8, { tl: 3, tr: 3, bl: 0, br: 0 });
    // 锁扣
    gfx.fillStyle(0xffd700);
    gfx.fillCircle(x, chestY - 6, 3);

    const chest = { gfx, x, y: chestY, opened: false };
    this.game.chests.push(chest);
  }

  updateChests() {
    for (let i = this.game.chests.length - 1; i >= 0; i--) {
      const chest = this.game.chests[i];
      if (chest.opened) {
        if (chest.gfx) chest.gfx.destroy();
        if (chest.hintText) chest.hintText.destroy();
        this.game.chests.splice(i, 1);
        continue;
      }

      const dist = Phaser.Math.Distance.Between(this.game.player.x, this.game.player.y, chest.x, chest.y);
      if (dist < 50) {
        // 显示提示
        if (!chest.hintText) {
          chest.hintText = this.scene.add.text(chest.x, chest.y - 30, 'F键开箱', {
            fontSize: '12px', color: '#ffd700',
            fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            backgroundColor: '#00000088', padding: { x: 4, y: 1 },
          }).setOrigin(0.5).setDepth(12);
        }
        if (Phaser.Input.Keyboard.JustDown(this.scene.keyF)) {
          this.openChest(chest);
        }
      } else {
        if (chest.hintText) {
          chest.hintText.destroy();
          chest.hintText = null;
        }
      }
    }
  }

  openChest(chest) {
    chest.opened = true;
    this.game.chestCount++;

    if (this.game.activeRelics.length >= 6) {
      const msg = this.scene.add.text(WIDTH / 2, HEIGHT / 2, '机缘已满，无法再获取', {
        fontSize: '22px', color: '#ff8844',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(500);
      this.scene.tweens.add({
        targets: msg, alpha: 0, delay: 1500, duration: 500,
        onComplete: () => msg.destroy(),
      });
      return;
    }

    const relics = drawBattleRelics(this.game.usedRelicIds);
    if (relics.length === 0) {
      const msg = this.scene.add.text(WIDTH / 2, HEIGHT / 2, '机缘已尽', {
        fontSize: '22px', color: '#888888',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5).setDepth(500);
      this.scene.tweens.add({
        targets: msg, alpha: 0, delay: 1500, duration: 500,
        onComplete: () => msg.destroy(),
      });
      return;
    }
    this._showRelicSelection(relics);
  }

  // ==================== 三选一界面 ====================
  _showRelicSelection(relics) {
    this.scene.physics.world.pause();
    this.scene.tweens.pauseAll();
    this.scene._relicSelectOpen = true;

    // 遮罩
    const overlay = this.scene.add.graphics().setDepth(400);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);

    // 标题
    const title = this.scene.add.text(WIDTH / 2, 95, '机缘现世，择一而取', {
      fontSize: '28px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(401);

    const cardW = 200, cardH = 280, gap = 24, totalW = relics.length * cardW + (relics.length - 1) * gap;
    const startX = WIDTH / 2 - totalW / 2;
    const cardY = 145;

    const rarityColors = { common: '#aaaaaa', rare: '#4488ff', legendary: '#ffd700' };

    this.game.relicSelectionEls = [overlay, title];

    relics.forEach((relic, i) => {
      const cx = startX + i * (cardW + gap);
      const color = rarityColors[relic.rarity] || '#aaaaaa';

      // 卡片背景
      const card = this.scene.add.graphics().setDepth(401);
      card.fillStyle(0x1a1a2e, 0.95);
      card.fillRoundedRect(cx, cardY, cardW, cardH, 8);
      card.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color);
      card.strokeRoundedRect(cx, cardY, cardW, cardH, 8);
      this.game.relicSelectionEls.push(card);

      // 稀有度标签
      const rarityLabel = ['普通', '稀有', '传说'][['common', 'rare', 'legendary'].indexOf(relic.rarity)];
      const tagBg = this.scene.add.graphics().setDepth(402);
      tagBg.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.3);
      tagBg.fillRoundedRect(cx + cardW / 2 - 32, cardY + 12, 64, 20, 4);
      this.game.relicSelectionEls.push(tagBg);
      const tagTxt = this.scene.add.text(cx + cardW / 2, cardY + 22, rarityLabel, {
        fontSize: '12px', color, fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5).setDepth(402);
      this.game.relicSelectionEls.push(tagTxt);

      // 名称
      const nameTxt = this.scene.add.text(cx + cardW / 2, cardY + 55, relic.name, {
        fontSize: '20px', color, fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(402);
      this.game.relicSelectionEls.push(nameTxt);

      // 分隔线
      const div = this.scene.add.graphics().setDepth(401);
      div.lineStyle(1, 0x333355);
      div.lineBetween(cx + 20, cardY + 74, cx + cardW - 20, cardY + 74);
      this.game.relicSelectionEls.push(div);

      // 描述
      const descTxt = this.scene.add.text(cx + cardW / 2, cardY + 100, relic.desc, {
        fontSize: '14px', color: '#cccccc', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        wordWrap: { width: cardW - 24 }, align: 'center',
      }).setOrigin(0.5, 0).setDepth(402);
      this.game.relicSelectionEls.push(descTxt);

      // 选择按钮
      const btnW = 100, btnH = 34;
      const btnX = cx + (cardW - btnW) / 2;
      const btnY = cardY + cardH - btnH - 20;

      const btnGfx = this.scene.add.graphics().setDepth(402);
      btnGfx.fillStyle(0x224433, 0.9);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnGfx.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(color).color);
      btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      this.game.relicSelectionEls.push(btnGfx);

      const btnTxt = this.scene.add.text(btnX + btnW / 2, btnY + btnH / 2, '选择', {
        fontSize: '16px', color: '#ffffff', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5).setDepth(403);
      this.game.relicSelectionEls.push(btnTxt);

      const btnZone = this.scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true }).setDepth(403);
      this.game.relicSelectionEls.push(btnZone);

      btnZone.on('pointerdown', () => {
        this.game.activeRelics.push(relic);
        this.game.usedRelicIds.push(relic.id);
        this._closeRelicSelection();
      });
    });
  }

  _closeRelicSelection() {
    this.scene._relicSelectOpen = false;
    this.scene.physics.world.resume();
    this.scene.tweens.resumeAll();
    if (this.game.relicSelectionEls) {
      for (const el of this.game.relicSelectionEls) {
        if (el && el.destroy) el.destroy();
      }
      this.game.relicSelectionEls = null;
    }
  }
}
