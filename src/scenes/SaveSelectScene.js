import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName } from '../config.js';
import SaveManager from '../utils/SaveManager.js';

export default class SaveSelectScene extends Phaser.Scene {
  constructor() {
    super('SaveSelectScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0d1a');

    // ---- 兼容旧存档迁移 ----
    this._migrateOldSave();

    // ---- 星点装饰 ----
    const stars = this.add.graphics();
    for (let i = 0; i < 50; i++) {
      const sx = Math.random() * WIDTH;
      const sy = Math.random() * HEIGHT;
      const r = Math.random() * 1.2 + 0.3;
      stars.fillStyle(0xffffff, Math.random() * 0.3 + 0.05);
      stars.fillCircle(sx, sy, r);
    }

    // ---- 标题 ----
    this.add.text(WIDTH / 2, 42, '择选道缘', {
      fontSize: '40px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // ---- 4个存档槽 ----
    this._createSaveSlots();

    // ---- 底部小字 ----
    this.add.text(WIDTH / 2, HEIGHT - 28, '共4处洞天福地，择一而居', {
      fontSize: '13px', color: '#555566',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);
  }

  // ==================== 兼容旧存档迁移 ====================
  _migrateOldSave() {
    try {
      const oldRaw = localStorage.getItem('wudao_save');
      if (!oldRaw) return;
      const oldData = JSON.parse(oldRaw);

      // 检查槽位0是否已存在
      const existing = SaveManager.load(0);
      if (existing) return;

      // 迁移到槽位0
      oldData.slotId = 0;
      oldData.playerName = oldData.playerName || '无名散修';
      oldData.createdAt = oldData.createdAt || Date.now();
      oldData.playtime = oldData.playtime || 0;
      oldData.activeRelics = oldData.activeRelics || [];
      if (!oldData.bag || !Array.isArray(oldData.bag.slots)) {
        oldData.bag = { slots: Array(60).fill(null) };
      }
      SaveManager.save(0, oldData);
      localStorage.removeItem('wudao_save');
    } catch (e) { /* ignore */ }
  }

  // ==================== 创建存档槽UI ====================
  _createSaveSlots() {
    const slotW = 500;
    const slotH = 100;
    const gap = 12;
    const startY = 100;
    const cx = WIDTH / 2;

    const slots = SaveManager.getSlots();

    slots.forEach((meta, i) => {
      const sy = startY + i * (slotH + gap);
      const sx = cx - slotW / 2;

      if (meta.isEmpty) {
        this._createEmptySlot(sx, sy, slotW, slotH, i);
      } else {
        this._createFilledSlot(sx, sy, slotW, slotH, meta, i);
      }
    });
  }

  // ---- 空槽 ----
  _createEmptySlot(sx, sy, sw, sh, slotId) {
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 0.6);
    bg.fillRoundedRect(sx, sy, sw, sh, 8);

    // 虚线效果（用分段线模拟）
    bg.lineStyle(1.5, 0x333355, 0.6);
    const dashLen = 8, gap = 6;
    // 顶部边
    for (let x = sx; x < sx + sw; x += dashLen + gap) {
      bg.lineBetween(x, sy, Math.min(x + dashLen, sx + sw), sy);
    }
    // 底部边
    for (let x = sx; x < sx + sw; x += dashLen + gap) {
      bg.lineBetween(x, sy + sh, Math.min(x + dashLen, sx + sw), sy + sh);
    }
    // 左边
    for (let y = sy; y < sy + sh; y += dashLen + gap) {
      bg.lineBetween(sx, y, sx, Math.min(y + dashLen, sy + sh));
    }
    // 右边
    for (let y = sy; y < sy + sh; y += dashLen + gap) {
      bg.lineBetween(sx + sw, y, sx + sw, Math.min(y + dashLen, sy + sh));
    }

    // 居中文字
    const txt = this.add.text(sx + sw / 2, sy + sh / 2, '+ 开始新的修行', {
      fontSize: '18px', color: '#555577',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    // 鼠标悬停效果
    const zone = this.add.zone(sx + sw / 2, sy + sh / 2, sw, sh)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x111133, 0.8);
      bg.fillRoundedRect(sx, sy, sw, sh, 8);
      bg.lineStyle(1.5, 0x666688, 0.8);
      for (let x = sx; x < sx + sw; x += dashLen + gap) {
        bg.lineBetween(x, sy, Math.min(x + dashLen, sx + sw), sy);
      }
      for (let x = sx; x < sx + sw; x += dashLen + gap) {
        bg.lineBetween(x, sy + sh, Math.min(x + dashLen, sx + sw), sy + sh);
      }
      for (let y = sy; y < sy + sh; y += dashLen + gap) {
        bg.lineBetween(sx, y, sx, Math.min(y + dashLen, sy + sh));
      }
      for (let y = sy; y < sy + sh; y += dashLen + gap) {
        bg.lineBetween(sx + sw, y, sx + sw, Math.min(y + dashLen, sy + sh));
      }
      txt.setColor('#888899');
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x0d0d1a, 0.6);
      bg.fillRoundedRect(sx, sy, sw, sh, 8);
      bg.lineStyle(1.5, 0x333355, 0.6);
      for (let x = sx; x < sx + sw; x += dashLen + gap) {
        bg.lineBetween(x, sy, Math.min(x + dashLen, sx + sw), sy);
      }
      for (let x = sx; x < sx + sw; x += dashLen + gap) {
        bg.lineBetween(x, sy + sh, Math.min(x + dashLen, sx + sw), sy + sh);
      }
      for (let y = sy; y < sy + sh; y += dashLen + gap) {
        bg.lineBetween(sx, y, sx, Math.min(y + dashLen, sy + sh));
      }
      for (let y = sy; y < sy + sh; y += dashLen + gap) {
        bg.lineBetween(sx + sw, y, sx + sw, Math.min(y + dashLen, sy + sh));
      }
      txt.setColor('#555577');
    });

    zone.on('pointerdown', () => {
      this._showCreateDialog(slotId);
    });
  }

  // ---- 有存档的槽 ----
  _createFilledSlot(sx, sy, sw, sh, meta, slotId) {
    const bg = this.add.graphics();
    const drawBg = (fill, border) => {
      bg.clear();
      bg.fillStyle(fill, 0.8);
      bg.fillRoundedRect(sx, sy, sw, sh, 8);
      bg.lineStyle(2, border);
      bg.strokeRoundedRect(sx, sy, sw, sh, 8);
    };
    drawBg(0x1a1a2e, 0xf0c040);

    const realmName = getRealmName(meta.majorRealmIndex, meta.layer);

    // 左侧：角色名 + 境界
    const leftX = sx + 20;
    this.add.text(leftX, sy + 18, meta.playerName || '无名散修', {
      fontSize: '22px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    });
    this.add.text(leftX, sy + 48, `境界：${realmName}`, {
      fontSize: '14px', color: '#44ccff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 中间：总局数、击杀、游玩时长
    const midX = sx + 250;
    this.add.text(midX, sy + 16, `历劫：${meta.totalRuns} 次`, {
      fontSize: '13px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });
    this.add.text(midX, sy + 36, `击杀：${meta.totalKills || 0}`, {
      fontSize: '13px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });
    this.add.text(midX, sy + 56, `时长：${SaveManager.formatPlaytime(meta.playtime)}`, {
      fontSize: '13px', color: '#888899',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    });

    // 右侧：最后保存时间
    this.add.text(sx + sw - 20, sy + 18, SaveManager.formatTimeAgo(meta.lastSaved), {
      fontSize: '13px', color: '#666677',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(1, 0);

    // 右上角删除按钮（小红叉）
    const delX = sx + sw - 18;
    const delY = sy + 8;
    const delText = this.add.text(delX, delY, '✕', {
      fontSize: '16px', color: '#aa4444',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const delZone = this.add.zone(delX, delY, 30, 30)
      .setInteractive({ useHandCursor: true });
    delZone.on('pointerover', () => delText.setColor('#ff4444'));
    delZone.on('pointerout', () => delText.setColor('#aa4444'));
    delZone.on('pointerdown', () => {
      this._showDeleteConfirm(slotId, sx, sy, sw, sh, () => {
        // 刷新整个界面
        this.scene.restart();
      });
    });

    // 整个槽的点击 → 进入游戏
    const zone = this.add.zone(sx + sw / 2, sy + sh / 2, sw, sh)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBg(0x2a2a3e, 0xffd700));
    zone.on('pointerout', () => drawBg(0x1a1a2e, 0xf0c040));
    zone.on('pointerdown', () => {
      this._loadAndEnter(slotId);
    });
  }

  // ==================== 加载存档并进入菜单 ====================
  _loadAndEnter(slotId) {
    const save = SaveManager.load(slotId);
    if (!save) return;

    this.registry.set('currentSave', save);
    this.registry.set('currentSlotId', slotId);
    this.scene.start('MenuScene');
  }

  // ==================== 创建新存档对话框 ====================
  _showCreateDialog(slotId) {
    const overlay = this.add.graphics().setDepth(300);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);

    const blocker = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(300);

    // DOM 输入框
    const domEl = this.add.dom(WIDTH / 2, HEIGHT / 2).createFromHTML(`
      <div style="background:#1a1a2e;padding:30px 40px;border:2px solid #f0c040;border-radius:10px;text-align:center;min-width:280px;">
        <div style="color:#f0c040;font-size:20px;margin-bottom:16px;font-family:'Microsoft YaHei',SimHei,sans-serif;">赐下道号</div>
        <input id="nameInput" type="text" maxlength="8" placeholder="无名散修"
          style="background:#0d0d1a;color:#ffffff;border:1px solid #666688;border-radius:4px;padding:10px 14px;font-size:16px;width:200px;text-align:center;outline:none;"/>
        <div style="margin-top:20px;display:flex;justify-content:center;gap:12px;">
          <button id="confirmBtn" style="background:#f0c040;color:#0d0d1a;border:none;border-radius:4px;padding:8px 28px;font-size:15px;font-weight:bold;cursor:pointer;">确认</button>
          <button id="cancelBtn" style="background:#333355;color:#cccccc;border:none;border-radius:4px;padding:8px 28px;font-size:15px;cursor:pointer;">取消</button>
        </div>
      </div>
    `).setDepth(301);

    domEl.addListener('click');
    domEl.on('click', (event) => {
      if (event.target.id === 'confirmBtn') {
        const input = document.getElementById('nameInput');
        const name = (input.value || '').trim() || '无名散修';
        this._createNewSave(slotId, name);
        domEl.destroy();
        overlay.destroy();
        blocker.destroy();
      } else if (event.target.id === 'cancelBtn') {
        domEl.destroy();
        overlay.destroy();
        blocker.destroy();
      }
    });
  }

  // ==================== 创建新存档 ====================
  _createNewSave(slotId, playerName) {
    const data = SaveManager.getDefaultSave(slotId, playerName);
    SaveManager.save(slotId, data);
    this.registry.set('currentSave', data);
    this.registry.set('currentSlotId', slotId);
    this.scene.start('MenuScene');
  }

  // ==================== 删除确认弹窗 ====================
  _showDeleteConfirm(slotId, sx, sy, sw, sh, onDeleted) {
    const meta = SaveManager.getSlots()[slotId];

    const overlay = this.add.graphics().setDepth(300);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);

    const blocker = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(300);

    // 弹窗面板
    const pw = 380, ph = 160;
    const px = WIDTH / 2 - pw / 2;
    const py = HEIGHT / 2 - ph / 2;

    const panel = this.add.graphics().setDepth(301);
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRoundedRect(px, py, pw, ph, 10);
    panel.lineStyle(2, 0xaa4444);
    panel.strokeRoundedRect(px, py, pw, ph, 10);

    this.add.text(WIDTH / 2, py + 32, `确认删除【${meta.playerName}】的存档？`, {
      fontSize: '17px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(302);

    this.add.text(WIDTH / 2, py + 60, '此操作不可撤销', {
      fontSize: '13px', color: '#aa4444',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(302);

    // 确认按钮
    const btnW = 100, btnH = 36;
    const btnY = py + 90;

    const confirmGfx = this.add.graphics().setDepth(302);
    confirmGfx.fillStyle(0x442222, 0.9);
    confirmGfx.fillRoundedRect(WIDTH / 2 - btnW - 20, btnY, btnW, btnH, 6);
    confirmGfx.lineStyle(1.5, 0xff4444);
    confirmGfx.strokeRoundedRect(WIDTH / 2 - btnW - 20, btnY, btnW, btnH, 6);
    this.add.text(WIDTH / 2 - 20, btnY + btnH / 2, '确认删除', {
      fontSize: '15px', color: '#ff4444',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(302);
    const confirmZone = this.add.zone(WIDTH / 2 - 20, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(303);

    // 取消按钮
    const cancelGfx = this.add.graphics().setDepth(302);
    cancelGfx.fillStyle(0x1a1a2e, 0.9);
    cancelGfx.fillRoundedRect(WIDTH / 2 + 20, btnY, btnW, btnH, 6);
    cancelGfx.lineStyle(1.5, 0x4466aa);
    cancelGfx.strokeRoundedRect(WIDTH / 2 + 20, btnY, btnW, btnH, 6);
    this.add.text(WIDTH / 2 + btnW / 2 + 20, btnY + btnH / 2, '取消', {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(302);
    const cancelZone = this.add.zone(WIDTH / 2 + btnW / 2 + 20, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(303);

    function cleanup() {
      [overlay, blocker, panel, confirmGfx, cancelGfx].forEach(el => { if (el && el.destroy) el.destroy(); });
      [confirmZone, cancelZone].forEach(el => { if (el && el.destroy) el.destroy(); });
      // destroy text children too
    }

    confirmZone.on('pointerdown', () => {
      SaveManager.delete(slotId);
      // 清理弹窗所有子元素
      [panel, confirmGfx, cancelGfx, overlay, blocker, confirmZone, cancelZone].forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      // 销毁所有depth 300+的文字和图形
      this.children.list
        .filter(c => c.depth >= 300)
        .forEach(c => { if (c && c.destroy) c.destroy(); });
      this.scene.restart();
    });

    cancelZone.on('pointerdown', () => {
      [panel, confirmGfx, cancelGfx, overlay, blocker, confirmZone, cancelZone].forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      this.children.list
        .filter(c => c.depth >= 300)
        .forEach(c => { if (c && c.destroy) c.destroy(); });
    });
  }

  update() { /* 静态界面 */ }
}
