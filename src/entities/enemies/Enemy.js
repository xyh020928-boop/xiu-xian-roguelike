// 敌人基类
import Phaser from 'phaser';

export default class Enemy {
  /** 全局敌人计数器 */
  static enemyCount = 0;

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - 生成位置 X
   * @param {number} y - 生成位置 Y
   * @param {object} config
   * @param {string} config.enemyType - 敌人类型标识（shangui/dugu/xiuxie/boss）
   * @param {number} config.hp - 血量
   * @param {number} config.atk - 攻击力
   * @param {number} config.spd - 移动速度
   * @param {number} config.color - 主体颜色
   * @param {number} config.width - 体型宽
   * @param {number} config.height - 体型高
   * @param {number} config.xpReward - 击杀修为奖励
   */
  constructor(scene, x, y, config = {}) {
    Enemy.enemyCount++;

    /** 实体类型 */
    this.entityType = 'enemy';

    /** 敌人子类型 */
    this.enemyType = config.enemyType || 'unknown';

    /** 唯一ID：enemy_<type>_<count> */
    this.id = `enemy_${this.enemyType}_${Enemy.enemyCount}`;

    /** 所属场景 */
    this.scene = scene;

    /** 属性 */
    this.hp = config.hp || 30;
    this.maxHp = config.hp || 30;
    this.atk = config.atk || 5;
    this.spd = config.spd || 80;

    /** 体型 */
    this.bodyWidth = config.width || 28;
    this.bodyHeight = config.height || 40;

    /** 主体颜色 */
    this.color = config.color || 0x8b4513;

    /** 击杀修为 */
    this.xpReward = config.xpReward || 0;

    /** 血条颜色（默认红色，子类覆盖） */
    this.hpBarColor = 0xff3333;

    /** 血条宽度 */
    this.hpBarWidth = 36;

    /** 是否存活 */
    this.alive = true;

    /** Phaser 精灵 */
    this.sprite = null;

    /** 攻击冷却 */
    this.lastAttackTime = 0;
    this.attackCooldown = 1500;

    /** 生成位置 */
    this.spawnX = x;
    this.spawnY = y;
  }

  /** 在场景中创建敌人精灵 */
  createSprite() {
    const key = 'enemy_' + this.enemyType;
    if (!this.scene.textures.exists(key)) {
      const gfx = this.scene.make.graphics({ add: false });
      gfx.fillStyle(this.color);
      gfx.fillRect(0, 0, this.bodyWidth, this.bodyHeight);
      gfx.generateTexture(key, this.bodyWidth, this.bodyHeight);
      gfx.destroy();
    }
    this.sprite = this.scene.physics.add.sprite(this.spawnX, this.spawnY, key);
    this.sprite.body.setSize(this.bodyWidth, this.bodyHeight);
    return this.sprite;
  }

  /** 受击 */
  takeDamage(amount) {
    if (!this.alive) return 0;
    const actual = Math.min(this.hp, amount);
    this.hp -= actual;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return actual;
  }
}
