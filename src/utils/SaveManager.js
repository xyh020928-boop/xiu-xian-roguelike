// 多存档管理器
export default class SaveManager {
  static _SLOTS_KEY = 'wudao_save_slots';
  static _SAVE_PREFIX = 'wudao_save_';

  // ==================== 槽位元数据 ====================

  /** 获取所有槽位元数据（用于存档选择界面） */
  static getSlots() {
    try {
      const raw = localStorage.getItem(this._SLOTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [
      { slotId: 0, isEmpty: true, playerName: '', majorRealmIndex: 0, layer: 1, totalRuns: 0, playtime: 0, lastSaved: null, createdAt: null },
      { slotId: 1, isEmpty: true, playerName: '', majorRealmIndex: 0, layer: 1, totalRuns: 0, playtime: 0, lastSaved: null, createdAt: null },
      { slotId: 2, isEmpty: true, playerName: '', majorRealmIndex: 0, layer: 1, totalRuns: 0, playtime: 0, lastSaved: null, createdAt: null },
      { slotId: 3, isEmpty: true, playerName: '', majorRealmIndex: 0, layer: 1, totalRuns: 0, playtime: 0, lastSaved: null, createdAt: null },
    ];
  }

  static _saveSlots(slots) {
    try {
      localStorage.setItem(this._SLOTS_KEY, JSON.stringify(slots));
    } catch (e) { /* ignore */ }
  }

  // ==================== 加载/保存/删除 ====================

  /** 加载指定槽位完整存档 */
  static load(slotId) {
    try {
      const raw = localStorage.getItem(`${this._SAVE_PREFIX}${slotId}`);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  /** 保存到指定槽位，同步更新元数据 */
  static save(slotId, data) {
    data.lastSaved = Date.now();
    try {
      localStorage.setItem(`${this._SAVE_PREFIX}${slotId}`, JSON.stringify(data));
    } catch (e) { /* ignore */ }

    // 同步更新槽位元数据
    const slots = this.getSlots();
    if (slots[slotId]) {
      slots[slotId] = {
        slotId,
        isEmpty: false,
        playerName: data.playerName || '无名散修',
        majorRealmIndex: data.majorRealmIndex || 0,
        layer: data.layer || 1,
        totalRuns: data.totalRuns || 0,
        playtime: data.playtime || 0,
        lastSaved: data.lastSaved,
        createdAt: data.createdAt || Date.now(),
      };
      this._saveSlots(slots);
    }
  }

  /** 删除指定槽位 */
  static delete(slotId) {
    try {
      localStorage.removeItem(`${this._SAVE_PREFIX}${slotId}`);
    } catch (e) { /* ignore */ }

    const slots = this.getSlots();
    if (slots[slotId]) {
      slots[slotId] = {
        slotId, isEmpty: true, playerName: '',
        majorRealmIndex: 0, layer: 1, totalRuns: 0,
        playtime: 0, lastSaved: null, createdAt: null,
      };
      this._saveSlots(slots);
    }
  }

  // ==================== 格式化 ====================

  /** 格式化时间差（"X分钟前" / "X小时前" / "X天前"） */
  static formatTimeAgo(timestamp) {
    if (!timestamp) return '从未保存';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }

  /** 格式化游玩时长（"2小时34分"） */
  static formatPlaytime(seconds) {
    if (!seconds || seconds <= 0) return '0分';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}小时${m}分`;
    if (h > 0) return `${h}小时`;
    return `${m}分`;
  }

  // ==================== 默认存档 ====================

  static getDefaultSave(slotId, playerName) {
    return {
      slotId,
      playerName: playerName || '无名散修',
      lingshi: 0,
      xianyu: 0,
      majorRealmIndex: 0,
      layer: 1,
      xiuwei: 0,
      xiuweiMax: 100,
      peakUnlocked: false,
      lastCaveTime: 0,
      upgrades: { maxHp: 0, atk: 0, mpMax: 0 },
      totalRuns: 0,
      totalKills: 0,
      playtime: 0,
      lastSaved: null,
      createdAt: Date.now(),
      bag: { slots: Array(60).fill(null) },
      activeRelics: [],
    };
  }

  /** 创建新存档并直接保存到槽位 */
  static createNew(slotId, playerName = '无名散修') {
    const data = this.getDefaultSave(slotId, playerName);
    this.save(slotId, data);
    return data;
  }
}
