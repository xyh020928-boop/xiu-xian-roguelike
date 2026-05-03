// 毒蛊 — 远程吐毒球
import Enemy from './Enemy.js';

export default class DuGu extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, {
      enemyType: 'dugu',
      hp: 20,
      atk: 6,
      spd: 50,
      color: 0xaa44ff,       // 紫色
      width: 24,
      height: 32,
      xpReward: 4,
    });

    /** 远程攻击 */
    this.attackRange = 300;

    /** 血条颜色 — 紫色 */
    this.hpBarColor = 0xaa44ff;
    this.hpBarWidth = 36;

    /** 攻击冷却较长（远程） */
    this.attackCooldown = 2000;
  }
}
