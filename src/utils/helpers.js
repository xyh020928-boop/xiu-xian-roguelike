// 背包工具、升级配置、境界突破
import {
  MAJOR_REALMS, WIDTH, HEIGHT,
  getLayerXPRequired, getRealmName,
  CULTIVATION_PATHS, POINTS_PER_LAYER,
} from '../config.js';
import SaveManager from './SaveManager.js';

/** 默认存档结构（仅供兼容迁移使用） */
export function getDefaultSave() {
  return {
    lingshi: 0,
    xianyu: 0,
    majorRealmIndex: 0,
    layer: 1,
    peakUnlocked: false,
    upgrades: { maxHp: 0, atk: 0, mpMax: 0 },
    totalRuns: 0,
    totalKills: 0,
    xiuwei: 0,
    xiuweiMax: getLayerXPRequired(0, 1),
    lastCaveTime: 0,
    bag: { slots: Array(60).fill(null) },
  };
}

/**
 * 将道具加入背包格子
 * @param {object} save - 存档对象
 * @param {object} item - 道具数据（需含 id 字段）
 * @returns {{ success: boolean, slotIndex?: number, reason?: string }}
 */
export function addToBag(save, item) {
  if (!save.bag || !Array.isArray(save.bag.slots)) {
    save.bag = { slots: Array(60).fill(null) };
  }

  // 1. 查找是否已有相同 itemId 的格子
  const existIdx = save.bag.slots.findIndex(
    s => s && s.itemId === item.id
  );
  if (existIdx !== -1) {
    save.bag.slots[existIdx].count += 1;
    save.bag.slots[existIdx].obtainedAt = Date.now();
    return { success: true, slotIndex: existIdx };
  }

  // 2. 找第一个空格
  const emptyIdx = save.bag.slots.findIndex(s => s === null);
  if (emptyIdx === -1) {
    return { success: false, reason: '储物袋已满' };
  }

  // 3. 放入空格
  save.bag.slots[emptyIdx] = {
    itemId: item.id,
    itemData: item,
    poolKey: item.poolKey || null,
    count: 1,
    obtainedAt: Date.now(),
  };
  return { success: true, slotIndex: emptyIdx };
}

// ==================== 升级配置 ====================

export const UPGRADE_CONFIG = {
  maxHp: { label: '淬体强筋', desc: '最大血量', perLevel: 20, costMult: 15 },
  atk:    { label: '炼气凝神', desc: '攻击力',   perLevel: 3,  costMult: 20 },
  mpMax:  { label: '拓展灵海', desc: '最大灵力', perLevel: 20, costMult: 25 },
};

/** 计算某项升级的花费（level 为当前已升级次数，0-indexed） */
export function upgradeCost(statKey, level) {
  const cfg = UPGRADE_CONFIG[statKey];
  return (level + 1) * cfg.costMult;
}

// ==================== 修炼方向 → 战斗属性计算 ====================

/**
 * 根据修炼方向分配点数 + 战斗行为倾向 + 境界 计算玩家战斗属性
 * @param {object} save - 存档对象
 * @returns {object} 计算后的战斗属性
 */
export function calcPlayerStats(save) {
  const c = save.cultivation || { tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
  const realmBonus = save.majorRealmIndex || 0;

  // 倾向加成：每5点倾向折合1点有效分配（上限：不超过实际分配点数的50%）
  const maxTendencyBonus = Math.floor(Math.max(c.tixiu, c.jianxiu, c.shenshi) * 0.5);
  const tixiuTotal = c.tixiu + Math.min(Math.floor((c.tendencies?.tixiu || 0) / 5), maxTendencyBonus);
  const jianxiuTotal = c.jianxiu + Math.min(Math.floor((c.tendencies?.jianxiu || 0) / 5), maxTendencyBonus);
  const shenshiTotal = c.shenshi + Math.min(Math.floor((c.tendencies?.shenshi || 0) / 5), maxTendencyBonus);

  // 基于修炼方向点数计算属性
  const pathCfg = CULTIVATION_PATHS;
  const baseHP = 100 + realmBonus * 5;
  const baseAtk = 10 + realmBonus * 1;
  const baseMP = 100 + realmBonus * 5;
  const baseMoveSpeed = 220;
  const baseMpRegen = 5; // 每秒基础回蓝

  const maxHp = baseHP + tixiuTotal * pathCfg.tixiu.stats.maxHp;
  const atk = baseAtk;
  const meleeDmgBonus = 1 + tixiuTotal * pathCfg.tixiu.stats.meleeDmg;
  const defense = tixiuTotal * pathCfg.tixiu.stats.defense;
  const maxMp = baseMP + jianxiuTotal * pathCfg.jianxiu.stats.maxMp;
  const swordDmgBonus = 1 + jianxiuTotal * pathCfg.jianxiu.stats.swordDmg;
  const mpRegen = baseMpRegen + jianxiuTotal * pathCfg.jianxiu.stats.mpRegen;
  const critRate = shenshiTotal * pathCfg.shenshi.stats.critRate;
  const critDmg = 1.5 + shenshiTotal * pathCfg.shenshi.stats.critDmg;
  const moveSpeed = baseMoveSpeed + shenshiTotal * pathCfg.shenshi.stats.moveSpeed;

  return {
    maxHp, atk, meleeDmgBonus, defense,
    maxMp, swordDmgBonus, mpRegen,
    critRate, critDmg, moveSpeed,
    // 各修炼方向总点数（含倾向加成）
    tixiuTotal, jianxiuTotal, shenshiTotal,
  };
}

// ==================== 境界晋级系统 ====================

/**
 * 检查修为是否满，满则自动晋级小层或触发大境界突破提示
 * @param {Phaser.Scene} scene
 * @param {object} save - 存档对象（registry中的引用）
 * @param {number} slotId - 存档槽位ID
 * @param {Function} refreshFn - 晋级后刷新 UI
 * @returns {boolean} 是否触发了晋级/突破
 */
export function checkBreakthrough(scene, save, slotId, refreshFn) {
  if (scene._breakthroughShowing) return false;

  // 修为未满：不触发
  if (save.xiuwei < save.xiuweiMax) return false;

  // 九层大圆满 → 大境界突破提示
  if (save.layer >= 9) {
    save.xiuwei = save.xiuweiMax; // 封顶
    if (!save.peakUnlocked) {
      save.peakUnlocked = true;
      SaveManager.save(slotId, save);
      showMajorBreakthroughPopup(scene, save, slotId, refreshFn);
      scene._breakthroughShowing = true;
      return true;
    }
    return false;
  }

  // 小境界晋级：层数+1，获得修炼点数
  save.layer += 1;
  save.xiuwei = 0;
  save.xiuweiMax = getLayerXPRequired(save.majorRealmIndex, save.layer);
  if (!save.cultivation) save.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
  save.cultivation.points = (save.cultivation.points || 0) + POINTS_PER_LAYER;
  SaveManager.save(slotId, save);

  showLayerUpMsg(scene, save, refreshFn);
  return true;
}

// ==================== 小层晋级提示 ====================

function showLayerUpMsg(scene, save, refreshFn) {
  const realmName = getRealmName(save.majorRealmIndex, save.layer);
  const txt = scene.add.text(WIDTH / 2, HEIGHT / 2 - 40,
    `修为精进，晋级【${realmName}】！`, {
      fontSize: '26px', color: '#88ff88',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(200).setAlpha(0);

  scene.tweens.add({
    targets: txt,
    alpha: { from: 0, to: 1 },
    y: { from: HEIGHT / 2 - 60, to: HEIGHT / 2 - 80 },
    duration: 500,
    ease: 'Power2',
    onComplete: () => {
      scene.tweens.add({
        targets: txt,
        alpha: 0,
        delay: 1000,
        duration: 500,
        onComplete: () => { if (txt && txt.active) txt.destroy(); },
      });
      if (refreshFn) refreshFn('layer_up');
    },
  });
}

// ==================== 大境界突破弹窗 ====================

function showMajorBreakthroughPopup(scene, save, slotId, refreshFn) {
  const currentRealm = getRealmName(save.majorRealmIndex, save.layer);
  const maxIdx = MAJOR_REALMS.length - 1;

  // 已到最高境界
  if (save.majorRealmIndex >= maxIdx) {
    scene._breakthroughShowing = false;
    if (refreshFn) refreshFn('major_breakthrough');
    return;
  }

  const nextRealm = MAJOR_REALMS[save.majorRealmIndex + 1] + '期';
  const pw = 480, ph = 240;
  const px = WIDTH / 2 - pw / 2;
  const py = HEIGHT / 2 - ph / 2;

  // 遮罩
  const overlay = scene.add.graphics().setDepth(200);
  overlay.fillStyle(0x000000, 0.7);
  overlay.fillRect(0, 0, WIDTH, HEIGHT);

  const blocker = scene.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
    .setInteractive().setDepth(200);

  // 面板
  const panel = scene.add.graphics().setDepth(201);
  panel.fillStyle(0x1a1a2e, 0.95);
  panel.fillRoundedRect(px, py, pw, ph, 12);
  panel.lineStyle(2, 0xf0c040);
  panel.strokeRoundedRect(px, py, pw, ph, 12);

  // 标题
  const titleTxt = scene.add.text(WIDTH / 2, py + 30, '修为大圆满！', {
    fontSize: '24px', color: '#ffd700',
    fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(202);

  const subTxt = scene.add.text(WIDTH / 2, py + 62,
    `当前：${currentRealm}`, {
      fontSize: '16px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(202);

  const promptTxt = scene.add.text(WIDTH / 2, py + 98,
    `可突破至【${nextRealm}】，是否突破？`, {
      fontSize: '20px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(202);

  // "突破"按钮
  const btn1W = 140, btn1H = 44;
  const btn1X = WIDTH / 2 - btn1W - 25;
  const btnY = py + 150;
  const btn1Gfx = scene.add.graphics().setDepth(202);
  btn1Gfx.fillStyle(0x4a3a00, 0.9);
  btn1Gfx.fillRoundedRect(btn1X, btnY, btn1W, btn1H, 8);
  btn1Gfx.lineStyle(2, 0xffd700);
  btn1Gfx.strokeRoundedRect(btn1X, btnY, btn1W, btn1H, 8);
  const btn1Txt = scene.add.text(btn1X + btn1W / 2, btnY + btn1H / 2, '突破', {
    fontSize: '20px', color: '#ffd700',
    fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(202);
  const btn1Zone = scene.add.zone(btn1X + btn1W / 2, btnY + btn1H / 2, btn1W, btn1H)
    .setInteractive({ useHandCursor: true }).setDepth(203);

  // "暂缓"按钮
  const btn2W = 140, btn2H = 44;
  const btn2X = WIDTH / 2 + 25;
  const btn2Gfx = scene.add.graphics().setDepth(202);
  btn2Gfx.fillStyle(0x2a2a2a, 0.9);
  btn2Gfx.fillRoundedRect(btn2X, btnY, btn2W, btn2H, 8);
  btn2Gfx.lineStyle(2, 0x666666);
  btn2Gfx.strokeRoundedRect(btn2X, btnY, btn2W, btn2H, 8);
  const btn2Txt = scene.add.text(btn2X + btn2W / 2, btnY + btn2H / 2, '暂缓', {
    fontSize: '20px', color: '#aaaaaa',
    fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
  }).setOrigin(0.5).setDepth(202);
  const btn2Zone = scene.add.zone(btn2X + btn2W / 2, btnY + btn2H / 2, btn2W, btn2H)
    .setInteractive({ useHandCursor: true }).setDepth(203);

  const elements = [overlay, blocker, panel, titleTxt, subTxt, promptTxt,
    btn1Gfx, btn1Txt, btn1Zone, btn2Gfx, btn2Txt, btn2Zone];

  function cleanup() {
    for (const el of elements) {
      if (el && el.destroy) el.destroy();
    }
    scene._breakthroughShowing = false;
  }

  // 突破按钮 → 播放金光特效 + 晋级
  btn1Zone.on('pointerdown', () => {
    cleanup();

    const flash = scene.add.graphics().setDepth(300);
    flash.fillStyle(0xffd700, 0);
    flash.fillRect(0, 0, WIDTH, HEIGHT);

    scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.8 },
      duration: 400,
      yoyo: true,
      hold: 200,
      onComplete: () => {
        if (flash && flash.destroy) flash.destroy();

        save.majorRealmIndex++;
        save.layer = 1;
        save.xiuwei = 0;
        save.xiuweiMax = getLayerXPRequired(save.majorRealmIndex, 1);
        save.peakUnlocked = false;
        if (!save.cultivation) save.cultivation = { points: 0, tixiu: 0, jianxiu: 0, shenshi: 0, tendencies: { tixiu: 0, jianxiu: 0, shenshi: 0 } };
        save.cultivation.points = (save.cultivation.points || 0) + POINTS_PER_LAYER;
        SaveManager.save(slotId, save);

        const newName = getRealmName(save.majorRealmIndex, save.layer);
        const congrats = scene.add.text(WIDTH / 2, HEIGHT / 2,
          `恭喜道友，突破【${newName}】！`, {
            fontSize: '30px', color: '#ffd700',
            fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(300).setAlpha(0);

        scene.tweens.add({
          targets: congrats,
          alpha: { from: 0, to: 1 },
          scale: { from: 0.5, to: 1 },
          duration: 600,
          ease: 'Back.easeOut',
          onComplete: () => {
            scene.tweens.add({
              targets: congrats,
              alpha: 0,
              delay: 1500,
              duration: 500,
              onComplete: () => {
                if (congrats && congrats.destroy) congrats.destroy();
              },
            });
          },
        });

        if (refreshFn) refreshFn('major_breakthrough');
      },
    });
  });

  // 暂缓按钮
  btn2Zone.on('pointerdown', () => {
    cleanup();
    if (refreshFn) refreshFn('major_breakthrough');
  });
}
