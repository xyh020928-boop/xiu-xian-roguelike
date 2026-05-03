import { WIDTH, HEIGHT } from '../config.js';
import { calcPlayerStats } from '../utils/helpers.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class StatsPanel {
  constructor(scene, hall) {
    this.scene = scene;
    this.hall = hall;
  }

  // ==================== 战斗属性预览面板（4行×2列网格） ====================
  buildPanel() {
    const panelW = 500;
    const panelH = 120;
    const px = WIDTH / 2 - panelW / 2;
    const py = 140 + 3 * (90 + 12) + 10; // 3张卡片下方
    const rowH = 26;
    const col1X = px + 24;
    const col2X = px + panelW / 2 + 16;

    // 面板背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x112233, 0.6);
    bg.fillRoundedRect(px, py, panelW, panelH, 6);
    bg.lineStyle(1, 0x334455, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 6);
    this.hall._cultElements.push(bg);

    // 标题
    const title = this.scene.add.text(px + panelW / 2, py + 8, '── 战斗属性 ──', {
      fontSize: '13px', color: '#667788', fontFamily: FONT,
    }).setOrigin(0.5);
    this.hall._cultElements.push(title);

    const stats = calcPlayerStats(this.hall.save);
    const labelStyle = { fontSize: '12px', color: '#8899aa', fontFamily: FONT };

    // 辅助函数：判断是否有加成，返回颜色
    const bonusColor = (hasBonus) => hasBonus ? '#44ffcc' : '#ffffff';

    // 基础值计算
    const realmBonus = this.hall.save.majorRealmIndex || 0;
    const c = this.hall.save.cultivation || { tixiu: 0, jianxiu: 0, shenshi: 0 };

    const contentStartY = py + 28;

    // 第1行：生命（左）| 灵力（右）
    this._addStatLabel(col1X, contentStartY, '生命', labelStyle);
    this._addStatValue(col1X + 40, contentStartY, stats.maxHp, bonusColor((c.tixiu || 0) > 0 || realmBonus > 0));

    this._addStatLabel(col2X, contentStartY, '灵力', labelStyle);
    this._addStatValue(col2X + 40, contentStartY, stats.maxMp, bonusColor((c.jianxiu || 0) > 0 || realmBonus > 0));

    // 第2行：近战（左）| 剑气（右）
    const row2Y = contentStartY + rowH;
    this._addStatLabel(col1X, row2Y, '近战', labelStyle);
    this._addStatValue(col1X + 40, row2Y, stats.meleeDmgBonus.toFixed(2) + 'x', bonusColor(stats.meleeDmgBonus > 1));

    this._addStatLabel(col2X, row2Y, '剑气', labelStyle);
    this._addStatValue(col2X + 40, row2Y, stats.swordDmgBonus.toFixed(2) + 'x', bonusColor(stats.swordDmgBonus > 1));

    // 第3行：防御（左）| 回蓝（右）
    const row3Y = row2Y + rowH;
    this._addStatLabel(col1X, row3Y, '防御', labelStyle);
    this._addStatValue(col1X + 40, row3Y, Math.floor(stats.defense * 100) + '%', bonusColor(stats.defense > 0));

    this._addStatLabel(col2X, row3Y, '回蓝', labelStyle);
    this._addStatValue(col2X + 40, row3Y, stats.mpRegen.toFixed(1) + '/s', bonusColor(stats.mpRegen > 5));

    // 第4行：暴击（左）| 移速（右）
    const row4Y = row3Y + rowH;
    this._addStatLabel(col1X, row4Y, '暴击', labelStyle);
    this._addStatValue(col1X + 40, row4Y, Math.floor(stats.critRate * 100) + '%', bonusColor(stats.critRate > 0));

    this._addStatLabel(col2X, row4Y, '移速', labelStyle);
    this._addStatValue(col2X + 40, row4Y, stats.moveSpeed.toString(), bonusColor(stats.moveSpeed > 220));
  }

  _addStatLabel(x, y, text, style) {
    const t = this.scene.add.text(x, y, text + '：', style);
    this.hall._cultElements.push(t);
  }

  _addStatValue(x, y, text, color) {
    const t = this.scene.add.text(x, y, text, {
      fontSize: '12px', color, fontFamily: FONT,
    });
    this.hall._cultElements.push(t);
  }
}
