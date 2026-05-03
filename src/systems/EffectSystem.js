export default class EffectSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game; // { activeRelics, playerHP, playerMaxHP, playerMP, playerMaxMP, shieldHP }
  }

  /**
   * Check if the player has a relic of the given type.
   * Adapted from _hasRelicType (lines 940-942)
   */
  hasRelicType(type) {
    return this.game.activeRelics.some(r => r.effect.type === type);
  }

  /**
   * Trigger sword domain AOE damage around the given enemy.
   * Adapted from _triggerSwordDomain (lines 944-966)
   */
  triggerSwordDomain(enemy) {
    if (!enemy || !enemy.sprite) return;
    const scene = this.scene;
    const cx = enemy.sprite.x, cy = enemy.sprite.y;
    const gfx = scene.add.graphics().setDepth(15);
    gfx.fillStyle(0x4488ff, 0.3);
    gfx.fillCircle(cx, cy, 80);
    scene.time.delayedCall(300, () => gfx.destroy());

    // Damage all enemies within 80px
    for (const e of this.game.enemies) {
      if (!e || !e.sprite || !e.sprite.active) continue;
      const dist = Phaser.Math.Distance.Between(cx, cy, e.sprite.x, e.sprite.y);
      if (dist <= 80) {
        const aoeDmg = Math.floor(this.game.playerAtk * 0.5);
        e.hp -= aoeDmg;
        this.game.totalDmgDealt += aoeDmg;
        scene.spawnDamageNumber(e.sprite.x, e.sprite.y - 20, aoeDmg, '#4488ff');
        if (e.hp <= 0) {
          const idx = this.game.enemies.indexOf(e);
          if (idx !== -1) scene.killEnemy(e, idx);
        }
      }
    }
  }

  /**
   * Calculate melee damage bonus from active relics.
   */
  getMeleeDmgBonus() {
    let bonus = 0;
    for (const relic of this.game.activeRelics) {
      switch (relic.effect.type) {
        case 'meleeDmg':
          bonus += relic.effect.value;
          break;
        case 'bloodMelee':
          bonus += relic.effect.value;
          break;
      }
    }
    return bonus;
  }

  /**
   * Calculate sword/ranged damage bonus from active relics.
   */
  getSwordDmgBonus() {
    let bonus = 0;
    for (const relic of this.game.activeRelics) {
      if (relic.effect.type === 'swordDmg') {
        bonus += relic.effect.value;
      }
    }
    return bonus;
  }

  /**
   * Apply all damage-related relic effects (crit, berserk, chaosOrb, swordStun, etc.)
   * Called from applyDamageToEnemy.
   * Adapted from lines 577-621 (applyDamageToEnemy relic section).
   *
   * @param {number} dmg - Base damage before relic modifiers
   * @param {object} enemy - The enemy being hit
   * @param {number} enemyIndex - Index of the enemy in the enemies array
   * @returns {{ finalDmg: number, isCrit: boolean }}
   */
  applyDamageEffects(dmg, enemy, enemyIndex) {
    let finalDmg = dmg;
    let isCrit = false;

    // 词条: 狂战符 (berserk) - +50% damage when HP < 40%
    if (this.hasRelicType('berserk')) {
      if (this.game.playerHP < this.game.playerMaxHP * 0.4) {
        const relic = this.game.activeRelics.find(r => r.effect.type === 'berserk');
        finalDmg = Math.floor(finalDmg * (1 + relic.effect.value));
      }
    }

    // 词条: 混沌珠 (chaosOrb) - all damage +50%
    if (this.hasRelicType('chaosOrb')) {
      finalDmg = Math.floor(finalDmg * 1.5);
    }

    // Player base crit
    if (Math.random() < this.game.playerCritRate) {
      finalDmg = Math.floor(finalDmg * this.game.playerCritDmg);
      isCrit = true;
    }

    enemy.hp -= finalDmg;
    this.game.totalDmgDealt += finalDmg;

    // 词条: 剑气眩晕 (swordStun)
    if (this.hasRelicType('swordStun')) {
      const relic = this.game.activeRelics.find(r => r.effect.type === 'swordStun');
      enemy.stunned = true;
      this.scene.time.delayedCall(relic.effect.value * 1000, () => { enemy.stunned = false; });
    }

    // Visual feedback: tint on hit
    if (enemy.sprite && enemy.sprite.active) {
      enemy.sprite.setTint(isCrit ? 0xff8844 : 0xffffff);
      this.scene.time.delayedCall(80, () => {
        if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();
      });
      this.scene.spawnDamageNumber(
        enemy.sprite.x, enemy.sprite.y - 20,
        finalDmg,
        isCrit ? '#ff8844' : '#ffff00'
      );
    }

    return { finalDmg, isCrit };
  }

  /**
   * Apply defense-related relic effects and shield absorption.
   * Called from damagePlayer.
   * Adapted from lines 764-815 (damagePlayer relic section).
   *
   * @param {number} incomingDmg - Raw incoming damage amount
   * @returns {number} - Final damage after defense and shield
   */
  applyDefenseEffects(incomingDmg) {
    // 词条: 混沌珠 (chaosOrb) - incoming damage +20%
    let dmgMult = 1;
    if (this.hasRelicType('chaosOrb')) dmgMult = 1.2;

    // Defense from relics
    let defenseTotal = this.game.playerDefense || 0;
    for (const relic of this.game.activeRelics) {
      if (relic.effect.type === 'defense') {
        defenseTotal += relic.effect.value;
      }
    }

    let finalDmg = Math.max(1, Math.floor(incomingDmg * dmgMult * (1 - defenseTotal)));

    // Shield absorption
    if (this.game.shieldHP > 0) {
      if (this.game.shieldHP >= finalDmg) {
        this.game.shieldHP -= finalDmg;
        finalDmg = 0;
      } else {
        finalDmg -= this.game.shieldHP;
        this.game.shieldHP = 0;
      }
    }

    return finalDmg;
  }

  /**
   * Apply kill effects (lifeSteal, fullSteal) on enemy death.
   * Adapted from lines 654-664 (killEnemy relic section).
   */
  applyKillEffects() {
    for (const relic of this.game.activeRelics) {
      const t = relic.effect.type;
      if (t === 'lifeSteal') {
        this.game.playerHP = Math.min(
          this.game.playerMaxHP,
          this.game.playerHP + Math.floor(this.game.playerMaxHP * relic.effect.value)
        );
      }
      if (t === 'fullSteal') {
        this.game.playerHP = Math.min(
          this.game.playerMaxHP,
          this.game.playerHP + Math.floor(this.game.playerMaxHP * relic.effect.value)
        );
        this.game.playerMP = Math.min(
          this.game.playerMaxMP,
          this.game.playerMP + Math.floor(this.game.playerMaxMP * relic.effect.value)
        );
      }
    }
  }

  /**
   * Check and apply deathSave relic (one-time death immunity).
   * Adapted from lines 798-805 (damagePlayer deathSave section).
   *
   * @param {boolean} deathSaveUsed - Whether the death save has already been consumed
   * @returns {boolean} - true if death save activated (prevented death)
   */
  applyDeathSave(deathSaveUsed) {
    if (this.hasRelicType('deathSave') && !deathSaveUsed) {
      const relic = this.game.activeRelics.find(r => r.effect.type === 'deathSave');
      this.game.playerHP = Math.floor(this.game.playerMaxHP * relic.effect.value);
      this.scene.isInvincible = true;
      this.scene.time.delayedCall(1500, () => { this.scene.isInvincible = false; });
      return true;
    }
    return false;
  }

  /**
   * Check if the player has the bloodMelee relic and apply HP cost.
   * Adapted from lines 465-467 (performMelee bloodMelee section).
   *
   * @returns {boolean} - true if bloodMelee cost was applied
   */
  applyBloodMeleeCost() {
    if (this.hasRelicType('bloodMelee')) {
      this.game.playerHP = Math.max(1, this.game.playerHP - 2);
      return true;
    }
    return false;
  }

  /**
   * Check sword domain combo and trigger if conditions met.
   * Adapted from lines 499-505 (performMelee swordDomain section).
   *
   * @param {number} comboCount - Current melee combo counter
   * @param {object} enemy - The enemy hit (for domain center)
   * @returns {{ newCombo: number, triggered: boolean }}
   */
  checkSwordDomainCombo(comboCount, enemy) {
    let newCombo = comboCount;
    let triggered = false;
    if (this.hasRelicType('swordDomain')) {
      newCombo++;
      if (newCombo >= 3) {
        newCombo = 0;
        this.triggerSwordDomain(enemy);
        triggered = true;
      }
    }
    return { newCombo, triggered };
  }

  /**
   * Get MP regen multiplier from relics.
   * Adapted from lines 359-362 (update MP regen section).
   */
  getMpRegenMultiplier() {
    let mult = 1;
    for (const relic of this.game.activeRelics) {
      if (relic.effect.type === 'mpRegen') mult *= (1 + relic.effect.value);
    }
    return mult;
  }

  /**
   * Get movement speed multiplier from relics.
   * Adapted from lines 368-371 (update movement speed section).
   */
  getMoveSpeedMultiplier() {
    let mult = 1;
    for (const relic of this.game.activeRelics) {
      if (relic.effect.type === 'moveSpeed') mult *= (1 + relic.effect.value);
    }
    return mult;
  }
}
