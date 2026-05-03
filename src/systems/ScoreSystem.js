import { WIDTH, HEIGHT } from '../config.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class ScoreSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game; // { totalDmgDealt, totalKills, startTime, noDamageStartTime, longestNoDamage, finishTime, finalScore }
  }

  // Track damage dealt (called from applyDamageToEnemy)
  trackDamage(dmg) {
    this.game.totalDmgDealt += dmg;
  }

  // Track no-damage time in update
  updateNoDamage(delta) {
    if (this.game.noDamageStartTime > 0) {
      this.game.noDamageStartTime += delta;
    }
  }

  // Record when player takes damage
  recordDamageTaken() {
    const nd = this.game.noDamageStartTime;
    if (nd > this.game.longestNoDamage) {
      this.game.longestNoDamage = nd;
    }
    this.game.noDamageStartTime = 0;
  }

  // Called when run ends (checkWaves)
  finishRun() {
    const nd = this.game.noDamageStartTime;
    if (nd > this.game.longestNoDamage) {
      this.game.longestNoDamage = nd;
    }
    this.game.finishTime = this.scene.time.now;
  }

  // Calculate battle score (adapted from standalone function at lines 1189-1195)
  calcBattleScore(score, maxHp) {
    const dmgRatio = Math.min(score.totalDmgDealt / Math.max(score.totalDmgTaken, 1), 10);
    const dmgScore = Math.min(dmgRatio * 4, 40);
    const noDmgScore = Math.min(score.maxNoDmgStreak / 2, 30);
    const timeScore = Math.min(120 / Math.max(score.clearTime, 30) * 30, 30);
    return Math.floor(dmgScore + noDmgScore + timeScore);
  }

  // Get score grade and label
  getGrade(score) {
    if (score >= 90) return { grade: 'S', label: '剑道通神', color: '#ffd700' };
    if (score >= 80) return { grade: 'A', label: '技惊四座', color: '#ff8844' };
    if (score >= 60) return { grade: 'B', label: '中规中矩', color: '#44aaff' };
    if (score >= 40) return { grade: 'C', label: '历劫艰难', color: '#888888' };
    return { grade: 'D', label: '侥幸生还', color: '#666666' };
  }
}
