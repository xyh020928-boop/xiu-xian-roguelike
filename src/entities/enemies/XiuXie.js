// 邪修 — 近战 + 格挡
import Enemy from './Enemy.js';

export default class XiuXie extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, {
      enemyType: 'xiuxie',
      hp: 40,
      atk: 8,
      spd: 70,
      color: 0xff6600,       // 深橙
      width: 30,
      height: 44,
      xpReward: 6,
    });

    /** 格挡状态 */
    this.isBlocking = false;
    this.blockChance = 0.3;  // 30% 概率格挡

    /** 血条颜色 — 橙色 */
    this.hpBarColor = 0xff6600;
    this.hpBarWidth = 36;

    /** 攻击冷却 */
    this.attackCooldown = 1500;
  }

  /** 格挡判定：受击时概率减半伤害 */
  tryBlock() {
    if (Math.random() < this.blockChance) {
      this.isBlocking = true;
      return true;
    }
    return false;
  }

  /** 重置格挡 */
  resetBlock() {
    this.isBlocking = false;
  }
}
