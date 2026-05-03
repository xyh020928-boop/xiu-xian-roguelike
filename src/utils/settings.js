// 游戏设置持久化
const KEY = 'wudao_settings';

const DEFAULTS = {
  sfxVolume: 80,
  musicVolume: 60,
  zoom: 1.0,
  fullscreen: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}
