// 机缘阁抽卡系统 — 卡池定义、抽卡逻辑、稀有度颜色

export const GACHA_POOLS = {
  // ==================== 丹药池 ====================
  dan: {
    name: '丹药',
    icon: '⚗',
    color: '#ff6644',
    description: '炼丹师秘制，服之有奇效',
    cost: { xianyu: 30 },
    items: [
      // 普通
      { id: 'dan_001', name: '回气丹', rarity: 'common', desc: '恢复20%最大血量', effect: { type: 'heal', value: 0.2 } },
      { id: 'dan_002', name: '聚灵丹', rarity: 'common', desc: '恢复30%最大灵力', effect: { type: 'mp', value: 0.3 } },
      { id: 'dan_003', name: '固元丹', rarity: 'common', desc: '本局最大血量+15', effect: { type: 'maxHp', value: 15 } },
      // 稀有
      { id: 'dan_004', name: '大还丹', rarity: 'rare', desc: '恢复50%血量和灵力', effect: { type: 'healFull', value: 0.5 } },
      { id: 'dan_005', name: '龙血丹', rarity: 'rare', desc: '本局攻击力+8', effect: { type: 'atk', value: 8 } },
      // 传说
      { id: 'dan_006', name: '九转金丹', rarity: 'legendary', desc: '血量和灵力全满，本局攻击力+20', effect: { type: 'godMode', value: 20 } },
    ],
  },

  // ==================== 法宝池 ====================
  fabao: {
    name: '法宝',
    icon: '⚔',
    color: '#4488ff',
    description: '上古遗留，蕴含道则',
    cost: { xianyu: 50 },
    items: [
      // 普通
      { id: 'fabao_001', name: '追风剑', rarity: 'common', desc: '剑气速度+20%', effect: { type: 'swordSpeed', value: 0.2 } },
      { id: 'fabao_002', name: '护身符', rarity: 'common', desc: '受击伤害-15%', effect: { type: 'dmgReduce', value: 0.15 } },
      { id: 'fabao_003', name: '聚灵环', rarity: 'common', desc: '灵力回复速度+50%', effect: { type: 'mpRegen', value: 0.5 } },
      // 稀有
      { id: 'fabao_004', name: '天罡剑阵', rarity: 'rare', desc: '剑气伤害+30%', effect: { type: 'swordDmg', value: 0.3 } },
      { id: 'fabao_005', name: '混元珠', rarity: 'rare', desc: '近战范围+40%', effect: { type: 'meleeRange', value: 0.4 } },
      // 传说
      { id: 'fabao_006', name: '诛仙剑', rarity: 'legendary', desc: '所有攻击伤害×2，但灵力消耗×1.5', effect: { type: 'doubleDmg' } },
    ],
  },

  // ==================== 天材地宝池 ====================
  tiancai: {
    name: '天材地宝',
    icon: '💎',
    color: '#44ffaa',
    description: '天地孕育，万年难遇',
    cost: { xianyu: 80 },
    items: [
      // 普通
      { id: 'tiancai_001', name: '灵草', rarity: 'common', desc: '永久最大血量+10', effect: { type: 'permHp', value: 10 } },
      { id: 'tiancai_002', name: '灵石髓', rarity: 'common', desc: '永久攻击力+2', effect: { type: 'permAtk', value: 2 } },
      { id: 'tiancai_003', name: '聚灵石', rarity: 'common', desc: '永久最大灵力+10', effect: { type: 'permMp', value: 10 } },
      // 稀有
      { id: 'tiancai_004', name: '千年何首乌', rarity: 'rare', desc: '永久最大血量+30', effect: { type: 'permHp', value: 30 } },
      { id: 'tiancai_005', name: '龙晶', rarity: 'rare', desc: '永久攻击力+8', effect: { type: 'permAtk', value: 8 } },
      // 传说
      { id: 'tiancai_006', name: '混沌灵根', rarity: 'legendary', desc: '永久所有属性+15', effect: { type: 'permAll', value: 15 } },
    ],
  },

  // ==================== 功法池 ====================
  gongfa: {
    name: '功法',
    icon: '📜',
    color: '#ff88ff',
    description: '上古秘典，修之可改命运',
    cost: { xianyu: 60 },
    items: [
      // 普通
      { id: 'gongfa_001', name: '基础剑诀', rarity: 'common', desc: '（内容待定）', effect: { type: 'placeholder' } },
      { id: 'gongfa_002', name: '御气术', rarity: 'common', desc: '（内容待定）', effect: { type: 'placeholder' } },
      // 稀有
      { id: 'gongfa_003', name: '太极剑法', rarity: 'rare', desc: '（内容待定）', effect: { type: 'placeholder' } },
      { id: 'gongfa_004', name: '八荒步', rarity: 'rare', desc: '（内容待定）', effect: { type: 'placeholder' } },
      // 传说
      { id: 'gongfa_005', name: '混沌剑典', rarity: 'legendary', desc: '（内容待定）', effect: { type: 'placeholder' } },
    ],
  },
};

/**
 * 抽卡核心逻辑
 * @param {string} poolKey - 卡池 key（dan/fabao/tiancai/gongfa）
 * @returns {object} 抽到的卡片 item
 */
export function drawCard(poolKey) {
  const pool = GACHA_POOLS[poolKey];
  if (!pool) return null;

  const rand = Math.random() * 100;
  let rarity = rand < 5 ? 'legendary' : rand < 30 ? 'rare' : 'common';

  const candidates = pool.items.filter(i => i.rarity === rarity);
  // 如果该稀有度没有候选，降级处理
  if (candidates.length === 0) {
    const commons = pool.items.filter(i => i.rarity === 'common');
    if (commons.length === 0) return pool.items[0];
    return commons[Math.floor(Math.random() * commons.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 稀有度颜色配置
 */
export const RARITY_COLOR = {
  common:    { text: '#ffffff', bg: '#333344', label: '普通' },
  rare:      { text: '#4488ff', bg: '#112244', label: '稀有' },
  legendary: { text: '#ffaa00', bg: '#332200', label: '传说' },
};

/**
 * 应用卡片效果
 * @param {object} card - 卡片 item
 * @param {object} save - 存档对象
 * @returns {string} 提示信息
 */
export function applyCardEffect(card, save) {
  const { effect } = card;
  if (!effect) return '无效卡片';

  switch (effect.type) {
    // 战斗场景内生效（存入 activeRelics）
    case 'heal':
    case 'mp':
    case 'maxHp':
    case 'healFull':
    case 'atk':
    case 'swordSpeed':
    case 'dmgReduce':
    case 'mpRegen':
    case 'swordDmg':
    case 'meleeRange':
    case 'doubleDmg':
    case 'godMode':
      if (!save.activeRelics) save.activeRelics = [];
      save.activeRelics.push(card);
      return `「${card.name}」已存入法宝栏，进入秘境后生效`;

    // 永久强化（直接写存档）
    case 'permHp':
      if (!save.upgrades) save.upgrades = {};
      save.upgrades.maxHp = (save.upgrades.maxHp || 0) + Math.floor(effect.value / 20);
      return `「${card.name}」永久最大血量 +${effect.value}`;

    case 'permAtk':
      if (!save.upgrades) save.upgrades = {};
      save.upgrades.atk = (save.upgrades.atk || 0) + Math.floor(effect.value / 3);
      return `「${card.name}」永久攻击力 +${effect.value}`;

    case 'permMp':
      if (!save.upgrades) save.upgrades = {};
      save.upgrades.mpMax = (save.upgrades.mpMax || 0) + Math.floor(effect.value / 20);
      return `「${card.name}」永久最大灵力 +${effect.value}`;

    case 'permAll':
      if (!save.upgrades) save.upgrades = {};
      save.upgrades.maxHp = (save.upgrades.maxHp || 0) + Math.floor(effect.value / 5);
      save.upgrades.atk = (save.upgrades.atk || 0) + Math.floor(effect.value / 3);
      save.upgrades.mpMax = (save.upgrades.mpMax || 0) + Math.floor(effect.value / 5);
      return `「${card.name}」永久全属性 +${effect.value}`;

    case 'placeholder':
      return `「${card.name}」已收录，功法效果待后续版本实装`;

    default:
      return `「${card.name}」效果类型未知`;
  }
}
