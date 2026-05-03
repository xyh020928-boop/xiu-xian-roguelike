import Phaser from 'phaser';
import { WIDTH, HEIGHT, getRealmName } from '../config.js';
import SaveManager from '../utils/SaveManager.js';

export default class SaveSelectScene extends Phaser.Scene {
  constructor() {
    super('SaveSelectScene');
  }

  init(data) {
    this._mode = data?.mode || 'play'; // 'play' | 'manage'
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

    // ---- 标题（根据模式） ----
    const title = this._mode === 'manage' ? '存档管理' : '择选道缘';
    this.add.text(WIDTH / 2, 42, title, {
      fontSize: '40px', color: '#f0c040',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // manage 模式：返回主菜单按钮
    if (this._mode === 'manage') {
      this._createBackButton();
    }

    // ---- 4个存档槽 ----
    this._createSaveSlots();

    // ---- 底部小字 ----
    if (this._mode === 'play') {
      this.add.text(WIDTH / 2, HEIGHT - 28, '共4处洞天福地，择一而居', {
        fontSize: '13px', color: '#555566',
        fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      }).setOrigin(0.5);
    }
  }

  // ==================== 返回按钮（manage模式） ====================
  _createBackButton() {
    const btnW = 130, btnH = 32;
    const btnX = 30, btnY = 24;

    const gfx = this.add.graphics();
    const draw = (fill, stroke) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.8);
      gfx.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      gfx.lineStyle(1.5, stroke);
      gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    };
    draw(0x1a1a2e, 0x4466aa);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '← 返回主菜单', {
      fontSize: '13px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x2a2a3e, 0x6688cc));
    zone.on('pointerout', () => draw(0x1a1a2e, 0x4466aa));
    zone.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
  }

  // ==================== 兼容旧存档迁移 ====================
  _migrateOldSave() {
    try {
      const oldRaw = localStorage.getItem('wudao_save');
      if (!oldRaw) return;
      const oldData = JSON.parse(oldRaw);

      const existing = SaveManager.load(0);
      if (existing) return;

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
    const drawDashed = (fill, borderColor) => {
      bg.clear();
      bg.fillStyle(fill, 0.8);
      bg.fillRoundedRect(sx, sy, sw, sh, 8);
      bg.lineStyle(1.5, borderColor, 0.8);
      const dashLen = 8, dg = 6;
      for (let x = sx; x < sx + sw; x += dashLen + dg)
        bg.lineBetween(x, sy, Math.min(x + dashLen, sx + sw), sy);
      for (let x = sx; x < sx + sw; x += dashLen + dg)
        bg.lineBetween(x, sy + sh, Math.min(x + dashLen, sx + sw), sy + sh);
      for (let y = sy; y < sy + sh; y += dashLen + dg)
        bg.lineBetween(sx, y, sx, Math.min(y + dashLen, sy + sh));
      for (let y = sy; y < sy + sh; y += dashLen + dg)
        bg.lineBetween(sx + sw, y, sx + sw, Math.min(y + dashLen, sy + sh));
    };
    drawDashed(0x0d0d1a, 0x333355);

    const label = this._mode === 'manage' ? '空' : '+ 开始新的修行';
    const txt = this.add.text(sx + sw / 2, sy + sh / 2, label, {
      fontSize: '18px', color: '#555577',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5);

    const zone = this.add.zone(sx + sw / 2, sy + sh / 2, sw, sh)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => { drawDashed(0x111133, 0x666688); txt.setColor('#888899'); });
    zone.on('pointerout', () => { drawDashed(0x0d0d1a, 0x333355); txt.setColor('#555577'); });

    // play 模式：空槽可点击创建新存档；manage 模式：空槽不可操作
    if (this._mode === 'play') {
      zone.on('pointerdown', () => {
        this._showCreateDialog(slotId);
      });
    }
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
      this._showDeleteConfirm(slotId);
    });

    // 整个槽的点击
    const zone = this.add.zone(sx + sw / 2, sy + sh / 2, sw, sh)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBg(0x2a2a3e, 0xffd700));
    zone.on('pointerout', () => drawBg(0x1a1a2e, 0xf0c040));

    if (this._mode === 'play') {
      zone.on('pointerdown', () => {
        this._loadAndEnter(slotId);
      });
    } else {
      // manage 模式：显示详情弹窗
      zone.on('pointerdown', () => {
        this._showSaveDetail(slotId);
      });
    }
  }

  // ==================== 加载存档并进入菜单（play模式） ====================
  _loadAndEnter(slotId) {
    const save = SaveManager.load(slotId);
    if (!save) return;

    this.registry.set('currentSave', save);
    this.registry.set('currentSlotId', slotId);
    this.scene.start('HallScene');
  }

  // ==================== 存档详情弹窗（manage模式） ====================
  _showSaveDetail(slotId) {
    const save = SaveManager.load(slotId);
    if (!save) return;

    const meta = SaveManager.getSlots()[slotId];
    const realmName = getRealmName(meta.majorRealmIndex, meta.layer);

    // 遮罩
    const overlay = this.add.graphics().setDepth(300);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);

    const blocker = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(300);

    // 弹窗面板
    const pw = 440, ph = 320;
    const px = WIDTH / 2 - pw / 2;
    const py = HEIGHT / 2 - ph / 2;

    const panel = this.add.graphics().setDepth(301);
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRoundedRect(px, py, pw, ph, 10);
    panel.lineStyle(2, 0xf0c040);
    panel.strokeRoundedRect(px, py, pw, ph, 10);

    // 角色名
    this.add.text(WIDTH / 2, py + 24, meta.playerName || '无名散修', {
      fontSize: '24px', color: '#ffffff',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(302);

    // 分割线
    const div = this.add.graphics().setDepth(301);
    div.lineStyle(1, 0x333355);
    div.lineBetween(px + 20, py + 48, px + pw - 20, py + 48);

    // 详细信息
    const infoX = px + 40;
    let iy = py + 62;
    const lineGap = 26;
    const infoStyle = {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    };

    this.add.text(infoX, iy, `道　号：${meta.playerName || '无名散修'}`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `境　界：${realmName}`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `灵　石：${save.lingshi || 0} ◈`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `仙　玉：${save.xianyu || 0} ◇`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `历劫数：${meta.totalRuns || 0} 次`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `击　杀：${meta.totalKills || 0}`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `游玩时长：${SaveManager.formatPlaytime(meta.playtime)}`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `最后保存：${SaveManager.formatTimeAgo(meta.lastSaved)}`, infoStyle).setDepth(302);
    iy += lineGap;
    this.add.text(infoX, iy, `创　建：${SaveManager.formatTimeAgo(meta.createdAt)}`, infoStyle).setDepth(302);

    // 按钮区
    const btnY = py + ph - 50;
    const btnW = 140, btnH = 36;

    // 关闭按钮
    const closeX = WIDTH / 2 + 10;
    const closeGfx = this.add.graphics().setDepth(302);
    closeGfx.fillStyle(0x1a1a2e, 0.9);
    closeGfx.fillRoundedRect(closeX, btnY, btnW, btnH, 6);
    closeGfx.lineStyle(1.5, 0x4466aa);
    closeGfx.strokeRoundedRect(closeX, btnY, btnW, btnH, 6);
    this.add.text(closeX + btnW / 2, btnY + btnH / 2, '关闭', {
      fontSize: '15px', color: '#aaaacc',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(302);
    const closeZone = this.add.zone(closeX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(303);

    // 删除按钮
    const delX = WIDTH / 2 - btnW - 10;
    const delGfx = this.add.graphics().setDepth(302);
    delGfx.fillStyle(0x442222, 0.9);
    delGfx.fillRoundedRect(delX, btnY, btnW, btnH, 6);
    delGfx.lineStyle(1.5, 0xaa4444);
    delGfx.strokeRoundedRect(delX, btnY, btnW, btnH, 6);
    this.add.text(delX + btnW / 2, btnY + btnH / 2, '删除存档', {
      fontSize: '15px', color: '#ff6666',
      fontFamily: '"Microsoft YaHei","SimHei",sans-serif',
    }).setOrigin(0.5).setDepth(302);
    const delZone = this.add.zone(delX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(303);

    const cleanup = () => {
      [overlay, blocker, panel, div, closeGfx, delGfx, closeZone, delZone].forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      this.children.list.filter(c => c.depth >= 300).forEach(c => {
        if (c && c.destroy) c.destroy();
      });
    };

    closeZone.on('pointerdown', cleanup);

    delZone.on('pointerdown', () => {
      cleanup();
      this._showDeleteConfirm(slotId);
    });
  }

  // ==================== 创建新存档对话框（play模式） ====================
  _showCreateDialog(slotId) {
    const overlay = this.add.graphics().setDepth(300);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);

    const blocker = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(300);

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
    const data = SaveManager.createNew(slotId, playerName);
    this.registry.set('currentSave', data);
    this.registry.set('currentSlotId', slotId);
    this.scene.start('HallScene');
  }

  // ==================== 删除确认弹窗 ====================
  _showDeleteConfirm(slotId) {
    const meta = SaveManager.getSlots()[slotId];

    const overlay = this.add.graphics().setDepth(300);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, WIDTH, HEIGHT);

    const blocker = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
      .setInteractive().setDepth(300);

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

    const cleanup = () => {
      [panel, confirmGfx, cancelGfx, overlay, blocker, confirmZone, cancelZone].forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      this.children.list.filter(c => c.depth >= 300).forEach(c => {
        if (c && c.destroy) c.destroy();
      });
    };

    confirmZone.on('pointerdown', () => {
      SaveManager.delete(slotId);
      cleanup();
      this.scene.restart();
    });

    cancelZone.on('pointerdown', cleanup);
  }

  update() { /* 静态界面 */ }
}
