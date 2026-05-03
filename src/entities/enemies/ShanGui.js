// 山鬼 — 近战冲刺怪
import Enemy from './Enemy.js';

export default class ShanGui extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, {
      enemyType: 'shangui',
      hp: 30,
      atk: 5,
      spd: 80,
      color: 0xff4444,       // 红色
      width: 28,
      height: 40,
      xpReward: 3,
    });

    /** 近战冲刺速度 */
    this.chargeSpeed = 200;

    /** 血条颜色 — 红色 */
    this.hpBarColor = 0xff4444;
    this.hpBarWidth = 36;

    /** 攻击冷却更短（近战） */
    this.attackCooldown = 1200;
  }
}
