import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import { addJiYuanToBag } from '../utils/helpers.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.result = data?.result || 'dead';
    this.earnedLingshi = data?.lingshi || 0;
    this.runKills = data?.killCount || 0;
    this.score = data?.score || { totalDmgDealt: 0, totalDmgTaken: 0, maxNoDmgStreak: 0, clearTime: 0, kills: 0 };
    this.battleScore = data?.battleScore ?? 0;
    this.battleRelics = data?.battleRelics || [];
  }

  create() {
    // 累加数据写入存档
    const save = this.registry.get('currentSave');
    const slotId = this.registry.get('currentSlotId');
    save.lingshi += this.earnedLingshi;
    save.totalRuns++;
    save.totalKills += this.runKills;
    SaveManager.save(slotId, save);

    const isClear = this.result === 'clear';
    this.cameras.main.setBackgroundColor(isClear ? '#0a0a2e' : '#000000');
    this.cameras.main.fadeIn(500, 0, 0, 0);

    const titleText = isClear ? '秘境已清' : '道消陨落';
    const titleColor = isClear ? '#f0c040' : '#ff3333';

    this.add.text(WIDTH / 2, 60, titleText, {
      fontSize: '56px', color: titleColor,
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subText = isClear ? '恭喜道友，此劫已渡' : '此劫未过，轮回再起';
    const subColor = isClear ? '#ffffff' : '#888888';
    this.add.text(WIDTH / 2, 120, subText, {
      fontSize: '20px', color: subColor,
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // ---- 评分 & 评级 ----
    const { grade, gradeColor } = this._getGrade(this.battleScore);
    this._showScoreAnimation(this.battleScore, grade, gradeColor);

    // ---- 战斗数据 ----
    this._showCombatStats();

    // ---- 通关时：词条留存 ----
    if (isClear && this.battleRelics.length > 0) {
      const retainCount = this._getRetainCount(grade);
      if (retainCount > 0) {
        this._showRelicRetention(retainCount, save, slotId);
        return; // 等待玩家选择
      }
    }

    // 无留存或死亡：自动返回
    this._addReturnHint();
  }

  // ==================== 评分动画 ====================
  _showScoreAnimation(targetScore, grade, gradeColor) {
    let current = 0;
    const scoreText = this.add.text(WIDTH / 2, 170, '0', {
      fontSize: '48px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const step = Math.max(1, Math.floor(targetScore / 30));
    this.time.addEvent({
      delay: 33, repeat: 29,
      callback: () => {
        current = Math.min(current + step, targetScore);
        scoreText.setText(String(current));
        if (current >= targetScore) {
          // 显示评级
          this.add.text(WIDTH / 2, 220, grade, {
            fontSize: '36px', color: gradeColor,
            fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            fontStyle: 'bold',
          }).setOrigin(0.5);
        }
      },
    });
  }

  // ==================== 战斗数据 ====================
  _showCombatStats() {
    const startY = 270;
    const rowH = 24;
    const lx = WIDTH / 2 - 160;
    const rx = WIDTH / 2 + 20;
    const labelStyle = { fontSize: '13px', color: '#8899aa', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' };
    const valStyle = { fontSize: '13px', color: '#ffffff', fontFamily: '"Microsoft YaHei","SimHei",sans-serif' };

    const rows = [
      { label: '总伤害输出', value: String(this.score.totalDmgDealt) },
      { label: '总承受伤害', value: String(this.score.totalDmgTaken) },
      { label: '最长无伤', value: this.score.maxNoDmgStreak.toFixed(1) + 's' },
      { label: '通关用时', value: this.score.clearTime.toFixed(1) + 's' },
      { label: '击杀数', value: String(this.score.kills) },
      { label: '灵石收获', value: String(this.earnedLingshi) + ' 枚' },
    ];

    rows.forEach((row, i) => {
      const col = i % 2 === 0 ? lx : rx;
      const y = startY + Math.floor(i / 2) * rowH;
      this.add.text(col, y, row.label + '：', labelStyle);
      this.add.text(col + 86, y, row.value, valStyle);
    });
  }

  // ==================== 评级计算 ====================
  _getGrade(score) {
    if (score >= 90) return { grade: 'S级 · 剑道通神', gradeColor: '#ffd700' };
    if (score >= 70) return { grade: 'A级 · 技惊四座', gradeColor: '#ff8844' };
    if (score >= 50) return { grade: 'B级 · 中规中矩', gradeColor: '#44aaff' };
    if (score >= 30) return { grade: 'C级 · 历劫艰难', gradeColor: '#88cc44' };
    return { grade: 'D级 · 侥幸生还', gradeColor: '#888888' };
  }

  _getRetainCount(grade) {
    if (grade.startsWith('S级') || grade.startsWith('A级')) return 2;
    if (grade.startsWith('B级')) return 1;
    if (grade.startsWith('C级')) return Math.random() < 0.5 ? 1 : 0;
    return 0;
  }

  // ==================== 词条留存界面 ====================
  _showRelicRetention(maxCount, save, slotId) {
    this._retainedRelics = {};
    this._retainCount = 0;
    this._maxRetain = maxCount;

    const startY = 370;

    // 标题
    this.add.text(WIDTH / 2, startY - 12, `本次机缘，可留存 ${maxCount} 件`, {
      fontSize: '18px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const cardW = 140, cardH = 160, gap = 16;
    const totalW = this.battleRelics.length * cardW + (this.battleRelics.length - 1) * gap;
    const startX = WIDTH / 2 - totalW / 2;
    const cardY = startY + 12;
    const rarityColors = { common: '#aaaaaa', rare: '#4488ff', legendary: '#ffd700' };

    this._retainCards = [];

    this.battleRelics.forEach((relic, i) => {
      const cx = startX + i * (cardW + gap);
      const color = rarityColors[relic.rarity] || '#aaaaaa';

      const card = this.add.graphics();
      card.fillStyle(0x1a1a2e, 0.9);
      card.fillRoundedRect(cx, cardY, cardW, cardH, 6);
      card.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(color).color);
      card.strokeRoundedRect(cx, cardY, cardW, cardH, 6);

      this.add.text(cx + cardW / 2, cardY + 14, relic.name, {
        fontSize: '14px', color, fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(cx + cardW / 2, cardY + 40, relic.desc, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
        wordWrap: { width: cardW - 16 }, align: 'center',
      }).setOrigin(0.5, 0);

      const selText = this.add.text(cx + cardW / 2, cardY + cardH - 22, '点击选择', {
        fontSize: '11px', color: '#667788', fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5);

      const zone = this.add.zone(cx + cardW / 2, cardY + cardH / 2, cardW, cardH)
        .setInteractive({ useHandCursor: true });

      this._retainCards.push({ relic, card, selText, zone, selected: false, cx, cardY, cardW, cardH, color });

      zone.on('pointerdown', () => {
        this._toggleRetainCard(relic.id);
      });
    });

    // 确认按钮
    this._confirmBtn = this.add.text(WIDTH / 2, startY + cardH + 40, '', {
      fontSize: '18px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      backgroundColor: '#224433', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._updateConfirmBtn();

    this._confirmBtn.on('pointerdown', () => {
      this._commitRetainedRelics(save, slotId);
    });
  }

  _toggleRetainCard(relicId) {
    const card = this._retainCards.find(c => c.relic.id === relicId);
    if (!card) return;

    if (card.selected) {
      card.selected = false;
      this._retainCount--;
      delete this._retainedRelics[relicId];
      card.card.clear();
      card.card.fillStyle(0x1a1a2e, 0.9);
      card.card.fillRoundedRect(card.cx, card.cardY, card.cardW, card.cardH, 6);
      card.card.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(card.color).color);
      card.card.strokeRoundedRect(card.cx, card.cardY, card.cardW, card.cardH, 6);
      card.selText.setText('点击选择');
      card.selText.setColor('#667788');
    } else if (this._retainCount < this._maxRetain) {
      card.selected = true;
      this._retainCount++;
      this._retainedRelics[relicId] = card.relic;
      card.card.clear();
      card.card.fillStyle(0x2a3a2e, 0.9);
      card.card.fillRoundedRect(card.cx, card.cardY, card.cardW, card.cardH, 6);
      card.card.lineStyle(2, 0x44ff88);
      card.card.strokeRoundedRect(card.cx, card.cardY, card.cardW, card.cardH, 6);
      card.selText.setText('已选择');
      card.selText.setColor('#44ff88');
    }
    this._updateConfirmBtn();
  }

  _updateConfirmBtn() {
    if (!this._confirmBtn) return;
    if (this._retainCount >= this._maxRetain) {
      this._confirmBtn.setText('带走机缘');
      this._confirmBtn.setBackgroundColor('#44aa44');
    } else {
      this._confirmBtn.setText(`带走机缘 (${this._retainCount}/${this._maxRetain})`);
      this._confirmBtn.setBackgroundColor('#224433');
    }
  }

  _commitRetainedRelics(save, slotId) {
    const selected = Object.values(this._retainedRelics);
    if (selected.length === 0) {
      this._goToHall();
      return;
    }

    // 存入机缘背包
    for (const relic of selected) {
      const item = {
        id: relic.id,
        name: relic.name,
        rarity: relic.rarity,
        desc: relic.desc,
        type: 'relic',
        poolKey: 'battle_relic',
      };
      addJiYuanToBag(save, item);
    }
    SaveManager.save(slotId, save);

    // 提示
    const msg = this.add.text(WIDTH / 2, HEIGHT - 80, `${selected.length}件机缘已存入储物袋`, {
      fontSize: '18px', color: '#44ff88',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.time.delayedCall(3000, () => {
      this._goToHall();
    });
  }

  // ==================== 底部返回提示 ====================
  _addReturnHint() {
    this.add.text(WIDTH / 2, HEIGHT - 30, '3秒后返回修炼大厅，或点击屏幕立即返回', {
      fontSize: '14px', color: '#666666',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this._goToHall();
    });

    this.time.delayedCall(3000, () => {
      this._goToHall();
    });
  }

  _goToHall() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HallScene', {
        result: this.result,
        lingshi: this.earnedLingshi,
        killCount: this.runKills,
      });
    });
  }
}
