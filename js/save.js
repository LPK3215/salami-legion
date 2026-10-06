/* ==========================================================
   存档系统（localStorage 持久化）
   ========================================================== */

const SAVE_KEY = 'mini_legion_save_v1';

function defaultSave() {
  return {
    coins: 0,
    unlockedLevels: 1,          // 已解锁到第几关
    stars: {},                  // { [levelId]: 0~3 }
    skinsOwned: ['classic'],
    skinSelected: 'classic',
    skills: { rush: 1, reinforce: 1 },   // 已解锁技能的等级
    startOptions: [3],          // 已解锁的开局人数
    achievements: {},           // { [id]: true }
    stats: {
      wins: 0, totalEaten: 0, totalCoins: 0,
      bestCount: 0, flawless: 0, comeback: 0, plays: 0,
      endlessBest: 0,   // 无尽模式单局最高人数
    },
    settings: {
      sound: true,
      controlMode: 'auto',   // 操作方式：auto（自动识别）| joystick（虚拟摇杆）| follow（跟随手指）
      glide: true,           // 惯性而行：松手/松键后沿最后方向继续走（关闭则「松手即停」）
      anchorStick: true,     // 摇杆原点锁定：按下时收进安全区，不再跟着手指爬出屏幕
    },
  };
}

const Save = {
  data: null,

  load() {
    // 已加载则直接返回，避免二次调用覆盖内存中已更新的进度
    if (this.data) return this.data;
    let d = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) d = JSON.parse(raw);
    } catch (e) { d = null; }
    const base = defaultSave();
    this.data = d ? this.merge(base, d) : base;
    return this.data;
  },

  merge(base, src) {
    const out = base;
    for (const k in src) {
      if (src[k] === null || src[k] === undefined) continue;
      if (Array.isArray(src[k]) || typeof src[k] !== 'object') out[k] = src[k];
      else out[k] = this.merge(out[k] || {}, src[k]);
    }
    // 保证关键字段存在
    out.skinsOwned = Array.isArray(out.skinsOwned) ? out.skinsOwned : ['classic'];
    out.startOptions = Array.isArray(out.startOptions) ? out.startOptions : [3];
    out.stats = Object.assign(defaultSave().stats, out.stats || {});
    out.settings = Object.assign(
      { sound: true, controlMode: 'auto', glide: true, anchorStick: true },
      out.settings || {});
    return out;
  },

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* 忽略 */ }
  },

  addCoins(n) {
    if (n <= 0) return;
    this.data.coins += n;
    this.data.stats.totalCoins += n;
    this.persist();
  },

  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.persist();
    return true;
  },

  skillLevel(id) { return this.data.skills[id] || 0; },

  unlockSkill(id) {
    if (!this.data.skills[id]) {
      this.data.skills[id] = 1;
      this.persist();
      return 'unlock';
    }
    if (this.data.skills[id] < 3) {
      this.data.skills[id] += 1;
      this.persist();
      return 'upgrade';
    }
    return null;
  },

  reset() {
    this.data = defaultSave();
    this.persist();
  },
};
