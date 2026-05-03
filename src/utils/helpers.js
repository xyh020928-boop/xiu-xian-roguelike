// localStorage 存档工具
import {
  MAJOR_REALMS, WIDTH, HEIGHT,
  getLayerXPRequired, getRealmName,
} from '../config.js';

const SAVE_KEY = 'wudao_save';

/** 默认存档结构 */
export function getDefaultSave() {
  return {
    lingshi: 0,
    xianyu: 0,             // 仙玉（抽卡专用）
    majorRealmIndex: 0,   // 大境界索引（0=炼气）
    layer: 1,              // 当前小层（1-9）
    peakUnlocked: false,   // 九层大圆满后可突破大境界
    upgrades: { maxHp: 0, atk: 0, mpMax: 0 },
    totalRuns: 0,
    totalKills: 0,
    xiuwei: 0,             // 当前层修为
    xiuweiMax: getLayerXPRequired(0, 1),  // 当前层所需修为
    lastCaveTime: 0,
    bag: {                 // 背包系统（格子制，60格）
      slots: Array(60).fill(null),
    },
  };
}

/** 读取存档，缺失字段用默认值补齐。兼容旧版 realmIndex → majorRealmIndex */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = getDefaultSave();

      // 兼容旧存档：realmIndex → majorRealmIndex + layer=1
      if (parsed.realmIndex !== undefined && parsed.majorRealmIndex === undefined) {
        parsed.majorRealmIndex = parsed.realmIndex;
        parsed.layer = 1;
        delete parsed.realmIndex;
      }

      // 兼容旧背包（分类数组 → 格子制 / 扩容到60格）
      if (parsed.bag && !Array.isArray(parsed.bag.slots)) {
        const oldBag = parsed.bag;
        const slots = Array(60).fill(null);
        const now = Date.now();
        let slotIdx = 0;
        for (const cat of ['dan', 'fabao', 'tiancai', 'gongfa']) {
          const items = oldBag[cat] || [];
          for (const item of items) {
            if (slotIdx >= 60) break;
            slots[slotIdx] = {
              itemId: item.id, itemData: item, count: item.count || 1,
              poolKey: cat, obtainedAt: now - (60 - slotIdx) * 1000,
            };
            slotIdx++;
          }
        }
        parsed.bag = { slots };
      } else if (parsed.bag && Array.isArray(parsed.bag.slots) && parsed.bag.slots.length !== 60) {
        // 旧格数 → 60格扩容/缩容
        const oldSlots = parsed.bag.slots;
        const slots = Array(60).fill(null);
        for (let i = 0; i < Math.min(oldSlots.length, 60); i++) {
          slots[i] = oldSlots[i];
          // 补充缺失字段
          if (slots[i] && !slots[i].obtainedAt) slots[i].obtainedAt = Date.now() - (60 - i) * 1000;
          if (slots[i] && !slots[i].poolKey && slots[i].itemId) {
            if (slots[i].itemId.startsWith('dan_')) slots[i].poolKey = 'dan';
            else if (slots[i].itemId.startsWith('fabao_')) slots[i].poolKey = 'fabao';
            else if (slots[i].itemId.startsWith('tiancai_')) slots[i].poolKey = 'tiancai';
            else if (slots[i].itemId.startsWith('gongfa_')) slots[i].poolKey = 'gongfa';
          }
        }
        parsed.bag = { slots };
      }

      // 动态补齐 xiuweiMax
      if (!parsed.xiuweiMax) {
        parsed.xiuweiMax = getLayerXPRequired(
          parsed.majorRealmIndex || 0, parsed.layer || 1
        );
      }

      return {
        ...defaults,
        ...parsed,
        upgrades: { ...defaults.upgrades, ...(parsed.upgrades || {}) },
        bag: { ...defaults.bag, ...(parsed.bag || {}) },
      };
    }
  } catch (e) { /* ignore */ }
  return getDefaultSave();
}

/** 写入存档 */
export function saveSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
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

// ==================== 境界晋级系统 ====================

/**
 * 检查修为是否满，满则自动晋级小层或触发大境界突破提示
 * @param {Phaser.Scene} scene
 * @param {object} save
 * @param {Function} refreshFn - 晋级后刷新 UI
 * @returns {boolean} 是否触发了晋级/突破
 */
export function checkBreakthrough(scene, save, refreshFn) {
  if (scene._breakthroughShowing) return false;

  // 修为未满：不触发
  if (save.xiuwei < save.xiuweiMax) return false;

  // 九层大圆满 → 大境界突破提示
  if (save.layer >= 9) {
    save.xiuwei = save.xiuweiMax; // 封顶
    if (!save.peakUnlocked) {
      save.peakUnlocked = true;
      saveSave(save);
      showMajorBreakthroughPopup(scene, save, refreshFn);
      scene._breakthroughShowing = true;
      return true;
    }
    return false;
  }

  // 小境界晋级：层数+1
  save.layer += 1;
  save.xiuwei = 0;
  save.xiuweiMax = getLayerXPRequired(save.majorRealmIndex, save.layer);
  saveSave(save);

  showLayerUpMsg(scene, save, refreshFn);
  return true;
}

// ==================== 小层晋级提示 ====================

/**
 * 显示"晋级至X层"浮动提示，1.5 秒后消失
 */
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

/**
 * 九层大圆满时弹出突破大境界窗口
 */
function showMajorBreakthroughPopup(scene, save, refreshFn) {
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

    // 全屏金色闪光特效
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

        // 晋级
        save.majorRealmIndex++;
        save.layer = 1;
        save.xiuwei = 0;
        save.xiuweiMax = getLayerXPRequired(save.majorRealmIndex, 1);
        save.peakUnlocked = false;
        saveSave(save);

        // 成功提示
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
