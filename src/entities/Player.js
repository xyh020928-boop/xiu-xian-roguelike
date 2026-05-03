// 玩家角色类
import Phaser from 'phaser';

export default class Player {
  constructor(scene, x, y) {
    /** 唯一ID */
    this.id = 'player_001';

    /** 实体类型标识 */
    this.entityType = 'player';

    /** 所属 Phaser 场景 */
    this.scene = scene;

    /** 属性 */
    this.hp = 100;
    this.maxHp = 100;
    this.mp = 100;
    this.maxMp = 100;
    this.atk = 10;
    this.spd = 220;

    /** Phaser 精灵 */
    this.sprite = null;
    this.spawnX = x;
    this.spawnY = y;
  }

  /**
   * 在场景中创建玩家精灵（Graphics 占位）
   * 返回 Phaser.GameObjects.Sprite
   */
  createSprite() {
    const key = 'player';
    if (!this.scene.textures.exists(key)) {
      const pg = this.scene.make.graphics({ add: false });
      pg.fillStyle(0x00ffcc);
      pg.fillRect(0, 0, 36, 54);
      pg.generateTexture(key, 36, 54);
      pg.destroy();
    }
    this.sprite = this.scene.physics.add.sprite(this.spawnX, this.spawnY, key);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setSize(36, 54);
    return this.sprite;
  }

  /** 受击 */
  takeDamage(amount) {
    if (this.hp <= 0) return 0;
    const actual = Math.min(this.hp, amount);
    this.hp -= actual;
    return actual;
  }

  /** 是否死亡 */
  get isDead() {
    return this.hp <= 0;
  }
}
