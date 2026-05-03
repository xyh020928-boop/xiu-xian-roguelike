// 全局常量与配置

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
