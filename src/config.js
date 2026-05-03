// 全局常量与配置

export const GAME_VERSION = 'v0.6.0';

/** 背包单格最大堆叠数量 */
export const MAX_STACK_SIZE = 64;

export const WIDTH = 1280;
export const HEIGHT = 720;

// 玩家初始属性
export const PLAYER_DEFAULTS = {
  hp: 100,
  mp: 100,
  atk: 10,
  spd: 220,
};

// ==================== 货币系统 ====================
export const CURRENCY = {
  lingshi: { name: '灵石', color: '#ffcc00', icon: '◈' },
  xianyu:  { name: '仙玉', color: '#44ffee', icon: '◇' },
};

// ==================== 境界系统 ====================

// 大境界（旧 REALMS 保留用于剑气配置 key 兼容）
export const REALMS = ['炼气期', '筑基期', '金丹期', '元婴期', '化神期'];
export const MAJOR_REALMS = ['炼气', '筑基', '金丹', '元婴', '化神'];

// 层次后缀
export const LAYER_NAMES = {
  1: '一层', 2: '二层', 3: '三层',   // 前期
  4: '四层', 5: '五层', 6: '六层',   // 中期
  7: '七层', 8: '八层', 9: '九层',   // 后期（九层圆满）
};

// 阶段描述
export const STAGE_NAMES = {
  early: '前期',   // 1-3层
  mid: '中期',     // 4-6层
  late: '后期',    // 7-9层
  peak: '大圆满',  // 9层修为满
};

// 各境界突破所需修为（旧版总修为，保留兼容）
export const REALM_XIUWEI_MAX = [1000, 3000, 8000, 20000, 50000];

/**
 * 每小层所需修为（随大境界和层数递增）
 * @param {number} majorIndex - 大境界索引 (0=炼气)
 * @param {number} layer - 当前小层 (1-9)
 * @returns {number}
 */
export function getLayerXPRequired(majorIndex, layer) {
  const base = [100, 300, 800, 2000, 5000]; // 各大境界第一层基础修为
  const multiplier = 1 + (layer - 1) * 0.5;   // 每层递增50%
  return Math.floor(base[majorIndex] * multiplier);
}

/**
 * 获取完整境界名称
 * @param {number} majorIndex - 大境界索引
 * @param {number} layer - 当前小层 (1-9)
 * @returns {string} 如 "炼气期·三层·前期" / "金丹期·九层·大圆满"
 */
export function getRealmName(majorIndex, layer) {
  const majorName = MAJOR_REALMS[majorIndex] || '???';
  if (layer >= 9) {
    return `${majorName}期·九层·大圆满`;
  }
  const layerName = LAYER_NAMES[layer] || `${layer}层`;
  const stage = layer <= 3 ? '前期' : layer <= 6 ? '中期' : '后期';
  return `${majorName}期·${layerName}·${stage}`;
}

/**
 * 获取当前大境界名称（用于剑气配置 key 匹配）
 */
export function getMajorRealmName(majorIndex) {
  return REALMS[majorIndex] || '炼气期';
}

// ==================== 各境界剑气属性（key 匹配 REALMS 旧名称） ====================
export const REALM_SWORD_CONFIG = {
  '炼气期': { speed: 400, range: 250, width: 30, height: 8,  color: 0xffee00, count: 1, mpCost: 8  },
  '筑基期': { speed: 500, range: 350, width: 40, height: 10, color: 0xffcc00, count: 1, mpCost: 12 },
  '金丹期': { speed: 600, range: 500, width: 50, height: 12, color: 0xff9900, count: 2, mpCost: 18 },
  '元婴期': { speed: 750, range: 680, width: 60, height: 14, color: 0xff6600, count: 3, mpCost: 25 },
  '化神期': { speed: 900, range: 900, width: 80, height: 18, color: 0xff3300, count: 5, mpCost: 35 },
};

// ==================== 修炼方向系统 ====================
export const CULTIVATION_PATHS = {
  tixiu: {
    name: '体修', desc: '淬炼肉身，以体为剑', color: '#ff6644', icon: '拳',
    stats: { maxHp: 8, meleeDmg: 0.04, defense: 0.02 },
  },
  jianxiu: {
    name: '剑修', desc: '以气御剑，剑走偏锋', color: '#44aaff', icon: '剑',
    stats: { maxMp: 6, swordDmg: 0.05, mpRegen: 0.03 },
  },
  shenshi: {
    name: '神识', desc: '开天眼，明万物', color: '#cc44ff', icon: '眼',
    stats: { critRate: 0.02, critDmg: 0.03, moveSpeed: 1.5 },
  },
};

// ==================== 机缘材料系统 ====================

/** 分解材料定义 */
export const MATERIALS = {
  mat_001: { id: 'mat_001', name: '法宝碎片', rarity: 'common', desc: '法宝残余的碎片，可用于炼丹', color: '#aaaaaa' },
  mat_002: { id: 'mat_002', name: '精炼石',   rarity: 'rare', desc: '蕴含精纯灵气的矿石', color: '#4488ff' },
  mat_003: { id: 'mat_003', name: '混沌晶核', rarity: 'legendary', desc: '混沌初开时凝结的晶核，极为稀有', color: '#ffd700' },
  mat_004: { id: 'mat_004', name: '灵气碎片', rarity: 'common', desc: '机缘分解时偶然凝聚的纯净灵气，炼丹时加入可提高成丹概率', color: '#44ffee' },
};

/** 分解产出：按稀有度（必得部分） */
export const DECOMPOSE_YIELD = {
  common:    [{ id: 'mat_001', count: 2 }],
  rare:      [{ id: 'mat_001', count: 5 }, { id: 'mat_002', count: 1 }],
  legendary: [{ id: 'mat_001', count: 10 }, { id: 'mat_002', count: 3 }, { id: 'mat_003', count: 1 }],
};

/** 分解灵气碎片额外产出概率 */
export const DECOMPOSE_LINGQI_CHANCE = {
  common:    { chance: 0.30, count: 1 },
  rare:      { chance: 0.50, count: 2 },
  legendary: { chance: 0.80, count: 3 },
};

// ==================== 草药系统 ====================

/** 草药道具定义 */
export const HERBS = {
  herb_001: { id: 'herb_001', name: '灵草',     rarity: 'common',    poolKey: 'tiancai', desc: '山野间自然生长的灵植，炼丹基础材料', effect: { type: 'herb', grade: 1 } },
  herb_002: { id: 'herb_002', name: '玄灵草',   rarity: 'rare',      poolKey: 'tiancai', desc: '蕴含较强灵力的稀有灵草，可炼制中阶丹药', effect: { type: 'herb', grade: 2 } },
  herb_003: { id: 'herb_003', name: '天阶灵药', rarity: 'legendary', poolKey: 'tiancai', desc: '千年难遇的顶阶灵药，炼制传说丹药必备', effect: { type: 'herb', grade: 3 } },
  herb_004: { id: 'herb_004', name: '续命草',   rarity: 'common',    poolKey: 'tiancai', desc: '有温和回血效果的常见灵草', effect: { type: 'herb', grade: 1 } },
  herb_005: { id: 'herb_005', name: '聚灵花',   rarity: 'common',    poolKey: 'tiancai', desc: '能凝聚周围灵力的小花，炼制灵力丹药常用', effect: { type: 'herb', grade: 1 } },
};

/** 炼丹配方（草药炼丹） */
export const ALCHEMY_RECIPES = [
  { id: 'recipe_huiqi',    name: '回气丹',   herbs: { herb_001: 2 },            produce: { type: 'pill', id: 'pill_huiqi',    name: '回气丹',   count: 2, desc: '恢复25%血量',           effect: { restoreHpPct: 0.25 } }, baseRate: 0.70 },
  { id: 'recipe_juling',   name: '聚灵丹',   herbs: { herb_005: 2 },            produce: { type: 'pill', id: 'pill_juling',   name: '聚灵丹',   count: 2, desc: '恢复25%灵力',           effect: { restoreMpPct: 0.25 } }, baseRate: 0.70 },
  { id: 'recipe_guyuan',   name: '固元丹',   herbs: { herb_001: 1, herb_004: 1 }, produce: { type: 'perm', id: 'perm_guyuan',   name: '固元丹',   count: 1, desc: '永久最大血量+10',        effect: { maxHpFlat: 10 } }, baseRate: 0.50 },
  { id: 'recipe_dahuan',   name: '大还丹',   herbs: { herb_002: 2 },            produce: { type: 'pill', id: 'pill_dahuan',   name: '大还丹',   count: 1, desc: '恢复50%血量和灵力',     effect: { restoreHpPct: 0.5, restoreMpPct: 0.5 } }, baseRate: 0.55 },
  { id: 'recipe_qiangjin', name: '强筋丹',   herbs: { herb_002: 1, herb_001: 2 }, produce: { type: 'perm', id: 'perm_qiangjin', name: '强筋丹',   count: 1, desc: '永久攻击力+5',           effect: { atkFlat: 5 } }, baseRate: 0.45 },
  { id: 'recipe_jiuzhuan', name: '九转金丹', herbs: { herb_003: 1, herb_002: 2 }, produce: { type: 'perm', id: 'perm_jiuzhuan', name: '九转金丹', count: 1, desc: '永久血量+30，攻击+10',   effect: { maxHpFlat: 30, atkFlat: 10 } }, baseRate: 0.30 },
];

/** 每突破一小层获得的修炼点数 */
export const POINTS_PER_LAYER = 3;
