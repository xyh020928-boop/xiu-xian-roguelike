// 对局内临时词条系统

export const BATTLE_RELICS = [
  // ---- 普通 common ----
  { id: 'br_001', name: '寒铁护腕', rarity: 'common', desc: '近战伤害+15%', effect: { type: 'meleeDmg', value: 0.15 } },
  { id: 'br_002', name: '聚气符',   rarity: 'common', desc: '灵力回复+30%', effect: { type: 'mpRegen', value: 0.3 } },
  { id: 'br_003', name: '疾风靴',   rarity: 'common', desc: '移动速度+20%', effect: { type: 'moveSpeed', value: 0.2 } },
  { id: 'br_004', name: '回血珠',   rarity: 'common', desc: '击杀敌人回复3%最大血量', effect: { type: 'lifeSteal', value: 0.03 } },
  { id: 'br_005', name: '锋芒石',   rarity: 'common', desc: '剑气伤害+15%', effect: { type: 'swordDmg', value: 0.15 } },
  { id: 'br_006', name: '护身玉',   rarity: 'common', desc: '受到伤害-10%', effect: { type: 'defense', value: 0.1 } },
  // ---- 稀有 rare ----
  { id: 'br_007', name: '血煞戒',   rarity: 'rare', desc: '近战伤害+30%，每次近战消耗2点血量', effect: { type: 'bloodMelee', value: 0.3 } },
  { id: 'br_008', name: '雷引符',   rarity: 'rare', desc: '剑气命中使敌人眩晕0.4秒', effect: { type: 'swordStun', value: 0.4 } },
  { id: 'br_009', name: '吸星石',   rarity: 'rare', desc: '击杀敌人回复8%最大血量和灵力', effect: { type: 'fullSteal', value: 0.08 } },
  { id: 'br_010', name: '破甲印',   rarity: 'rare', desc: '所有攻击无视20%防御', effect: { type: 'armorPen', value: 0.2 } },
  { id: 'br_011', name: '狂战符',   rarity: 'rare', desc: '血量低于40%时攻击力+50%', effect: { type: 'berserk', value: 0.5 } },
  // ---- 传说 legendary ----
  { id: 'br_012', name: '混沌珠',   rarity: 'legendary', desc: '所有攻击伤害+50%，受到伤害+20%', effect: { type: 'chaosOrb' } },
  { id: 'br_013', name: '不死心',   rarity: 'legendary', desc: '首次致死伤害免疫，恢复30%血量（每局一次）', effect: { type: 'deathSave', value: 0.3 } },
  { id: 'br_014', name: '剑域碎片', rarity: 'legendary', desc: '普攻第三击触发剑域，造成AOE伤害', effect: { type: 'swordDomain' } },
];

const RARITY_WEIGHTS = { legendary: 5, rare: 25, common: 70 };

/**
 * 抽取三选一词条（不重复，稀有度权重：common70/rare25/legendary5）
 * @param {string[]} excludeIds - 已经出现过的词条id
 * @returns {object[]} 3个词条对象
 */
export function drawBattleRelics(excludeIds = []) {
  const pool = [...BATTLE_RELICS].filter(r => !excludeIds.includes(r.id));
  const results = [];

  while (results.length < 3 && pool.length > 0) {
    const rand = Math.random() * 100;
    let rarity;
    if (rand < RARITY_WEIGHTS.legendary) rarity = 'legendary';
    else if (rand < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.rare) rarity = 'rare';
    else rarity = 'common';

    const candidates = pool.filter(r =>
      r.rarity === rarity && !results.find(x => x.id === r.id)
    );

    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      results.push(picked);
      const idx = pool.indexOf(picked);
      if (idx !== -1) pool.splice(idx, 1);
    } else {
      // 降级：从所有剩余中随机选
      const fallback = pool.filter(r => !results.find(x => x.id === r.id));
      if (fallback.length > 0) {
        const picked = fallback[Math.floor(Math.random() * fallback.length)];
        results.push(picked);
        const idx = pool.indexOf(picked);
        if (idx !== -1) pool.splice(idx, 1);
      } else break;
    }
  }
  return results;
}
