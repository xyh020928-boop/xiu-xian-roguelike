import Phaser from 'phaser';
import { WIDTH, HEIGHT, HERBS, ALCHEMY_RECIPES } from '../config.js';
import SaveManager from '../utils/SaveManager.js';
import PauseMenu from '../ui/PauseMenu.js';
import AlchemyForge from '../ui/AlchemyForge.js';

const FONT = '"Microsoft YaHei","SimHei",sans-serif';

export default class AlchemyScene extends Phaser.Scene {
  constructor() {
    super('AlchemyScene');
  }

  create() {
    this.save = this.registry.get('currentSave');
    this.slotId = this.registry.get('currentSlotId');

    // 兼容旧存档
    if (!this.save.herbs) this.save.herbs = {};
    for (const key of Object.keys(HERBS)) {
      if (!(key in this.save.herbs)) this.save.herbs[key] = 0;
    }
    if (!this.save.permBuffs) this.save.permBuffs = { maxHpPct: 0, atkPct: 0, maxHpFlat: 0, atkFlat: 0 };

    // Shared alchemy context for the forge
    const alchemyData = {
      save: this.save,
      slotId: this.slotId,
      selectedRecipe: null,
      lingqiCount: 0,
      _furnaceElements: [],
      _resultElements: [],
      onRefreshHerbPanel: () => this._refreshHerbPanel(),
      onRebuildHerbPanel: () => this._rebuildHerbPanel(),
    };

    this.alchemyData = alchemyData;
    this.forge = new AlchemyForge(this, alchemyData);

    this._smokeElements = [];

    // 背景
    this.cameras.main.setBackgroundColor('#100808');

    // 烟雾粒子
    this._createSmokeParticles();

    // 标题
    this.add.text(WIDTH / 2, 18, '炼丹房', {
      fontSize: '30px', color: '#f0c040',
      fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    // 返回按钮
    this._createBackButton();

    // 三栏布局
    this._buildRecipePanel();
    this.forge.buildFurnacePanel();
    this._buildHerbPanel();

    // ESC 暂停菜单
    this.pauseMenu = new PauseMenu(this, { sceneName: '炼丹房' });
    this.pauseMenu.create();
    this.input.keyboard.on('keydown-ESC', () => { this.pauseMenu.toggle(); });

    // 自动保存
    this.autoSaveTimer = this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => {
        const s = this.registry.get('currentSave');
        const sid = this.registry.get('currentSlotId');
        if (s && sid >= 0) {
          s.playtime = (s.playtime || 0) + 30;
          SaveManager.save(sid, s);
        }
      },
    });

    this.events.on('shutdown', () => {
      if (this.pauseMenu) this.pauseMenu.destroy();
      if (this.autoSaveTimer) this.autoSaveTimer.remove();
    });
  }

  // ==================== 烟雾粒子 ====================
  _createSmokeParticles() {
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * WIDTH;
      const y = Math.random() * HEIGHT;
      const r = 20 + Math.random() * 50;
      const g = this.add.graphics();
      g.fillStyle(0x444444, 0.06);
      g.fillCircle(0, 0, r);
      g.setPosition(x, y).setDepth(0);
      this._smokeElements.push(g);

      this.tweens.add({
        targets: g,
        y: y - 60 - Math.random() * 40,
        alpha: { from: 0.06, to: 0 },
        duration: 4000 + Math.random() * 3000,
        delay: Math.random() * 3000,
        repeat: -1,
        onRepeat: () => {
          g.setPosition(Math.random() * WIDTH, HEIGHT + 20 + Math.random() * 50);
          g.setAlpha(0.06);
        },
      });
    }
  }

  // ==================== 返回按钮 ====================
  _createBackButton() {
    const btnW = 100, btnH = 26;
    const btnX = WIDTH - btnW - 20, btnY = 12;
    const gfx = this.add.graphics();
    const draw = (fill, stroke) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.8);
      gfx.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
      gfx.lineStyle(1.5, stroke);
      gfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 4);
    };
    draw(0x2a1a1a, 0x884444);
    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '返回大厅', {
      fontSize: '12px', color: '#ccaaaa', fontFamily: FONT,
    }).setOrigin(0.5);
    this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(0x3a2a2a, 0xaa6666))
      .on('pointerout', () => draw(0x2a1a1a, 0x884444))
      .on('pointerdown', () => {
        SaveManager.save(this.slotId, this.save);
        this.scene.start('HallScene');
      });
  }

  // ==================== 左侧：丹方选择栏 ====================
  _buildRecipePanel() {
    const panelX = 10;
    const panelY = 56;
    const panelW = 250;
    const titleY = panelY + 8;

    // 面板背景
    const outerBg = this.add.graphics();
    outerBg.fillStyle(0x1a0a0a, 0.9);
    outerBg.fillRoundedRect(panelX, panelY, panelW, HEIGHT - panelY - 20, 8);
    outerBg.lineStyle(1.5, 0x442222);
    outerBg.strokeRoundedRect(panelX, panelY, panelW, HEIGHT - panelY - 20, 8);

    // 标题
    this.add.text(panelX + panelW / 2, titleY, '丹 方', {
      fontSize: '18px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    // 分隔线
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x442222, 0.5);
    sep.lineBetween(panelX + 16, titleY + 24, panelX + panelW - 16, titleY + 24);

    // 条目参数
    const itemX = panelX + 10;
    const itemW = panelW - 20;   // 230px
    const itemH = 80;
    const gap = 8;
    const listStartY = panelY + 60;  // 从面板内 60px 处开始
    const textX = panelX + 12;

    this._recipeRefs = [];

    ALCHEMY_RECIPES.forEach((recipe, i) => {
      const iy = listStartY + i * (itemH + gap);
      const canAfford = this.forge._canAffordRecipe(recipe);

      // 背景块使用 Rectangle（位置天然居中，无偏移）
      const color = canAfford ? '#ddccaa' : '#665555';
      const fillColor = canAfford ? 0x2a1a1a : 0x151010;
      const itemBg = this.add.rectangle(
        itemX + itemW / 2, iy + itemH / 2, itemW, itemH, fillColor
      ).setStrokeStyle(1, canAfford ? 0x554433 : 0x332222).setDepth(0);

      // 丹方名（y=iy+12，字号14px）
      const nameTxt = this.add.text(textX, iy + 12, recipe.name, {
        fontSize: '14px', color, fontFamily: FONT, fontStyle: 'bold',
      });

      // 材料需求（y=iy+32，字号11px）
      const herbParts = Object.entries(recipe.herbs).map(([hid, cnt]) => {
        const herb = HERBS[hid];
        return `${herb.name}×${cnt}`;
      }).join(' + ');
      const needTxt = this.add.text(textX, iy + 32, `所需：${herbParts}`, {
        fontSize: '11px', color: canAfford ? '#888877' : '#554444', fontFamily: FONT,
      });

      // 成丹率（y=iy+50，字号11px）
      const rateTxt = this.add.text(textX, iy + 50, `成丹率：${Math.floor(recipe.baseRate * 100)}%`, {
        fontSize: '11px', color: '#666666', fontFamily: FONT,
      });

      // 点击区域
      const zone = this.add.zone(itemX + itemW / 2, iy + itemH / 2, itemW, itemH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this._selectRecipe(recipe, i);
      });

      this._recipeRefs.push({ recipe, nameTxt, needTxt, rateTxt, itemBg, zone });
    });
  }

  _selectRecipe(recipe, index) {
    this.alchemyData.selectedRecipe = recipe;
    this.alchemyData.lingqiCount = 0;
    this.forge._clearResult();

    // 重绘所有条目边框：先全部重置为未选中色，再高亮选中的
    this._recipeRefs.forEach((ref, i) => {
      const canAfford = this.forge._canAffordRecipe(ref.recipe);
      if (i === index) {
        ref.itemBg.setStrokeStyle(2, 0xf0c040).setFillStyle(0x3a1a00);
        ref.nameTxt.setColor('#f0c040');
      } else {
        ref.itemBg.setStrokeStyle(1, canAfford ? 0x554433 : 0x332222)
          .setFillStyle(canAfford ? 0x2a1a1a : 0x151010);
        ref.nameTxt.setColor(canAfford ? '#ddccaa' : '#665555');
      }
    });

    this.forge._refreshFurnace();
    this._refreshHerbPanel();
  }

  // ==================== 右侧：材料库存栏 ====================
  _buildHerbPanel() {
    const panelX = WIDTH - 210, panelY = 56, panelW = 200;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a0a0a, 0.9);
    bg.fillRoundedRect(panelX, panelY, panelW, HEIGHT - panelY - 20, 8);
    bg.lineStyle(1.5, 0x442222);
    bg.strokeRoundedRect(panelX, panelY, panelW, HEIGHT - panelY - 20, 8);

    this.add.text(panelX + panelW / 2, panelY + 14, '药材库', {
      fontSize: '16px', color: '#f0c040', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5);

    let curY = panelY + 44;

    // 灵气碎片（右对齐，存储引用）
    const lqCount = this.forge._countLingqi();
    this._lqText = this.add.text(panelX + panelW - 16, curY, `灵气碎片：${lqCount}`, {
      fontSize: '13px', color: '#44ffee', fontFamily: FONT,
    }).setOrigin(1, 0);
    curY += 22;

    // 草药列表（右对齐 + 数量颜色编码）
    this._herbRefs = [];
    Object.values(HERBS).forEach(herb => {
      const count = this.save.herbs[herb.id] || 0;
      const color = this._getHerbColor(herb.id, count);
      const txt = this.add.text(panelX + panelW - 16, curY, `${herb.name}：${count}`, {
        fontSize: '12px', color, fontFamily: FONT,
      }).setOrigin(1, 0);
      // tooltip on hover
      txt.setInteractive();
      const herbId = herb.id;
      txt.on('pointerover', () => txt.setColor('#ffffff'));
      txt.on('pointerout', () => txt.setColor(this._getHerbColor(herbId, this.save.herbs[herbId] || 0)));
      curY += 18;
      this._herbRefs.push({ text: txt, herbId: herb.id });
    });
  }

  /** 刷新药材存量颜色（选配方后调用） */
  _refreshHerbPanel() {
    if (!this._herbRefs) return;
    const recipe = this.alchemyData.selectedRecipe;
    // 更新灵气碎片
    if (this._lqText) {
      const lqCount = this.forge._countLingqi();
      this._lqText.setText(`灵气碎片：${lqCount}`);
    }
    // 更新草药颜色
    this._herbRefs.forEach(ref => {
      const count = this.save.herbs[ref.herbId] || 0;
      ref.text.setText(`${HERBS[ref.herbId].name}：${count}`);
      ref.text.setColor(this._getHerbColor(ref.herbId, count, recipe));
    });
  }

  /** 根据选中配方计算草药颜色 */
  _getHerbColor(herbId, count, recipe) {
    if (count <= 0) return '#555555';
    if (!recipe) return '#ffffff';
    const need = recipe.herbs[herbId] || 0;
    return count >= need ? '#ffffff' : '#ff4444';
  }

  _rebuildHerbPanel() {
    // 更新存量数字和颜色编码
    this._refreshHerbPanel();
  }

  update() {
    if (this.pauseMenu && this.pauseMenu.visible) return;
  }
}
