/* ==========================================================
   小人军团吞噬战 · 全局配置与游戏数据
   ========================================================== */

const CFG = {
  world: { w: 3000, h: 2200 },              // 地图尺寸
  unit: { r: 8, spacing: 13 },              // 小人半径 / 编队间距
  move: { base: 140, unitMax: 470, sizePenalty: 0.0030, sizePenaltyMax: 0.12, playerBonus: 1.14, panic: 0.86 },
  eat: { interval: 0.32, contact: 0.94 },   // 逐个吞噬节奏：每 0.32 秒吞 1 个
  pickup: 26,                               // 收编中立小人的判定半径
  zoom: { min: 0.36, max: 1.12 },
  maxUnits: 900,                            // 单军团站位表上限
  unitTotalMax: 1800,
  neutralMax: 460,
};

/* ---------------- 敌方军团配色（避开蓝色给玩家） ---------------- */
const ENEMY_PALETTES = [
  { body: '#ff5b6e', name: '红队' },
  { body: '#a66bff', name: '紫队' },
  { body: '#ffa63d', name: '橙队' },
  { body: '#2ee6a8', name: '绿队' },
  { body: '#ff6fd8', name: '粉队' },
  { body: '#ffd93d', name: '黄队' },
  { body: '#4dd2ff', name: '青队' },
  { body: '#9aa6bd', name: '灰队' },
];

/* ---------------- 技能（每级效果递进，永久解锁+升级） ---------------- */
const SKILLS = {
  rush: {
    id: 'rush', name: '急速集结', badge: '速', color: '#ffd93d',
    cd: 22, unlockAfter: 0,
    levels: [
      { dur: 4.0, speed: 0.60, desc: '4 秒内全军团移动速度 +60%' },
      { dur: 5.0, speed: 0.80, desc: '5 秒内全军团移动速度 +80%' },
      { dur: 6.0, speed: 1.00, desc: '6 秒内全军团移动速度 +100%' },
    ],
  },
  reinforce: {
    id: 'reinforce', name: '临时增援', badge: '援', color: '#2ee6a8',
    cd: 26, unlockAfter: 0,
    levels: [
      { count: 4, dur: 12, desc: '立刻召唤 4 名援军，12 秒后离队' },
      { count: 6, dur: 14, desc: '立刻召唤 6 名援军，14 秒后离队' },
      { count: 8, dur: 16, desc: '立刻召唤 8 名援军，16 秒后离队' },
    ],
  },
  lure: {
    id: 'lure', name: '诱捕', badge: '诱', color: '#ff8a3d',
    cd: 24, unlockAfter: 2,
    levels: [
      { radius: 320, dur: 4.5, desc: '4.5 秒内吸引 320 范围内的中立小人靠拢' },
      { radius: 430, dur: 5.5, desc: '5.5 秒内吸引 430 范围内的中立小人靠拢' },
      { radius: 560, dur: 6.5, desc: '6.5 秒内吸引 560 范围内的中立小人靠拢' },
    ],
  },
  frenzy: {
    id: 'frenzy', name: '狂暴吞噬', badge: '噬', color: '#ff4d6d',
    cd: 30, unlockAfter: 4,
    levels: [
      { atk: 1.0, dur: 5, desc: '5 秒内吞噬速度翻倍' },
      { atk: 1.3, dur: 6, desc: '6 秒内吞噬速度 ×2.3' },
      { atk: 1.6, dur: 7, desc: '7 秒内吞噬速度 ×2.6' },
    ],
  },
  slow: {
    id: 'slow', name: '时间迟缓', badge: '缓', color: '#4dd2ff',
    cd: 28, unlockAfter: 5,
    levels: [
      { radius: 480, slow: 0.40, dur: 4, desc: '4 秒内附近敌军移动速度 -40%' },
      { radius: 560, slow: 0.50, dur: 5, desc: '5 秒内附近敌军移动速度 -50%' },
      { radius: 660, slow: 0.60, dur: 6, desc: '6 秒内附近敌军移动速度 -60%' },
    ],
  },
  shield: {
    id: 'shield', name: '坚壁', badge: '盾', color: '#9b8cff',
    cd: 34, unlockAfter: 7,
    levels: [
      { dur: 2.5, desc: '2.5 秒内我方单位不会被吞噬' },
      { dur: 3.5, desc: '3.5 秒内我方单位不会被吞噬' },
      { dur: 4.5, desc: '4.5 秒内我方单位不会被吞噬' },
    ],
  },
};
const SKILL_LIST = ['rush', 'reinforce', 'lure', 'frenzy', 'slow', 'shield'];

/* ---------------- 本局增益（通关奖励，一次挑战内累积） ---------------- */
const BUFFS = [
  { id: 'start',   name: '先锋增援', stat: 'startCount', val: 2,    max: 4, desc: '每关开局人数 +2' },
  { id: 'neutral', name: '遍地人潮', stat: 'neutral',    val: 0.25, max: 4, desc: '地图中立小人 +25%' },
  { id: 'speed',   name: '行军加速', stat: 'speed',      val: 0.07, max: 5, desc: '军团移动速度 +7%' },
  { id: 'atk',     name: '狼吞虎咽', stat: 'atk',        val: 0.16, max: 5, desc: '吞噬速度 +16%' },
  { id: 'pickup',  name: '感召力',   stat: 'pickup',     val: 0.25, max: 3, desc: '收编范围 +25%' },
  { id: 'shrink',  name: '威慑',     stat: 'enemyStart', val: -2,   max: 3, desc: '敌军开局人数 -2' },
  { id: 'cd',      name: '战术精通', stat: 'cd',         val: 0.12, max: 4, desc: '技能冷却 -12%' },
];

/* ---------------- 开局人数选项 ---------------- */
const START_OPTIONS = [
  { count: 3,  unlockAfter: 0 },
  { count: 5,  unlockAfter: 2 },
  { count: 7,  unlockAfter: 5 },
  { count: 10, unlockAfter: 9 },
];

/* ---------------- 皮肤（纯外观） ---------------- */
const SKINS = [
  { id: 'classic', name: '经典蓝', body: '#3d9bff', style: 'plain',   price: 0,    tag: '默认' },
  { id: 'sunset',  name: '落日橙', body: '#ff8a3d', style: 'plain',   price: 200,  tag: '' },
  { id: 'mint',    name: '薄荷绿', body: '#2ee6a8', style: 'cap',     price: 320,  tag: '鸭舌帽' },
  { id: 'rose',    name: '玫瑰粉', body: '#ff6fd8', style: 'glasses', price: 460,  tag: '酷眼镜' },
  { id: 'violet',  name: '星紫',   body: '#a66bff', style: 'ninja',   price: 620,  tag: '头巾' },
  { id: 'lava',    name: '熔岩红', body: '#ff4d4d', style: 'horn',    price: 800,  tag: '魔角' },
  { id: 'gold',    name: '黄金甲', body: '#ffcb2e', style: 'crown',   price: 1050, tag: '皇冠' },
  { id: 'ice',     name: '寒冰青', body: '#5ce1e6', style: 'helmet',  price: 1300, tag: '头盔' },
  { id: 'shadow',  name: '暗影',   body: '#5b6480', style: 'ninja',   price: 1600, tag: '头巾' },
  { id: 'rainbow', name: '炫彩',   body: '#ff5b6e', style: 'rainbow', price: 2200, tag: '七色循环' },
];

/* ---------------- 关卡 ---------------- */
/* goal: reach=达到人数 / eliminate=消灭所有敌军
   enemies: c=开局人数 sp=速度倍率 ag=好斗程度 react=反应间隔(s) */
const LEVELS = [
  { id: 1,  name: '初次集结', goal: { type: 'reach', val: 15 },  neutral: 110, par: 55,  gold: 36,
    enemies: [{ c: 5,  sp: 0.86, ag: 0.30, react: 0.70 }], coins: 25,
    tip: '滑动屏幕移动军团，吃掉中立小人快速壮大' },

  { id: 2,  name: '街头争锋', goal: { type: 'reach', val: 24 },  neutral: 135, par: 62,  gold: 42,
    enemies: [{ c: 6,  sp: 0.88, ag: 0.38, react: 0.62 }, { c: 8, sp: 0.90, ag: 0.42, react: 0.58 }], coins: 30,
    tip: '比我方小的军团可以逐个吞噬，比我们大的要躲开' },

  { id: 3,  name: '清扫街区', goal: { type: 'eliminate' },       neutral: 160, par: 85,  gold: 58,
    enemies: [{ c: 7,  sp: 0.90, ag: 0.55, react: 0.55 }, { c: 9, sp: 0.92, ag: 0.50, react: 0.55 }], coins: 36,
    tip: '把敌人逼到地图边缘，就无处可逃了' },

  { id: 4,  name: '人潮涌动', goal: { type: 'reach', val: 36 },  neutral: 175, par: 70,  gold: 48,
    enemies: [{ c: 8,  sp: 0.90, ag: 0.45, react: 0.55 }, { c: 10, sp: 0.92, ag: 0.48, react: 0.52 }, { c: 12, sp: 0.94, ag: 0.50, react: 0.50 }], coins: 40,
    tip: '开局技能是翻盘关键，善用它' },

  { id: 5,  name: '四面楚歌', goal: { type: 'eliminate' },       neutral: 190, par: 100, gold: 68,
    enemies: [{ c: 10, sp: 0.92, ag: 0.58, react: 0.50 }, { c: 12, sp: 0.94, ag: 0.55, react: 0.48 }, { c: 14, sp: 0.96, ag: 0.52, react: 0.48 }], coins: 46,
    tip: '被多支军团夹击很危险，逐个击破才是上策' },

  { id: 6,  name: '壮大队伍', goal: { type: 'reach', val: 52 },  neutral: 210, par: 82,  gold: 56,
    enemies: [{ c: 14, sp: 0.94, ag: 0.50, react: 0.48 }, { c: 16, sp: 0.96, ag: 0.52, react: 0.46 }, { c: 18, sp: 0.98, ag: 0.55, react: 0.45 }], coins: 52,
    tip: '人数越多编队越大，注意别让尾巴被敌人咬住' },

  { id: 7,  name: '围剿行动', goal: { type: 'eliminate' },       neutral: 220, par: 115, gold: 78,
    enemies: [{ c: 12, sp: 0.94, ag: 0.60, react: 0.46 }, { c: 15, sp: 0.96, ag: 0.58, react: 0.45 }, { c: 18, sp: 0.98, ag: 0.56, react: 0.44 }, { c: 20, sp: 1.00, ag: 0.60, react: 0.42 }], coins: 58,
    tip: '先吃掉最弱的那支，滚雪球才是吞噬战王道' },

  { id: 8,  name: '势均力敌', goal: { type: 'reach', val: 72 },  neutral: 240, par: 92,  gold: 62,
    enemies: [{ c: 20, sp: 0.96, ag: 0.55, react: 0.45 }, { c: 22, sp: 0.98, ag: 0.58, react: 0.44 }, { c: 25, sp: 1.00, ag: 0.60, react: 0.42 }, { c: 28, sp: 1.02, ag: 0.62, react: 0.40 }], coins: 66,
    tip: '势均力敌时同时接触只会干瞪眼，要靠人数差取胜' },

  { id: 9,  name: '大鱼吃小鱼', goal: { type: 'eliminate' },     neutral: 250, par: 125, gold: 86,
    enemies: [{ c: 22, sp: 0.96, ag: 0.62, react: 0.44 }, { c: 26, sp: 0.98, ag: 0.60, react: 0.42 }, { c: 30, sp: 1.00, ag: 0.62, react: 0.41 }, { c: 34, sp: 1.02, ag: 0.65, react: 0.40 }], coins: 74,
    tip: '技能「狂暴吞噬」能大幅加快吞噬节奏' },

  { id: 10, name: '军团之战', goal: { type: 'reach', val: 100 }, neutral: 290, par: 108, gold: 72,
    enemies: [{ c: 22, sp: 0.98, ag: 0.60, react: 0.42 }, { c: 26, sp: 1.00, ag: 0.62, react: 0.41 }, { c: 30, sp: 1.02, ag: 0.64, react: 0.40 }, { c: 34, sp: 1.04, ag: 0.66, react: 0.38 }, { c: 38, sp: 1.06, ag: 0.68, react: 0.36 }], coins: 86,
    tip: '注意敌人也会互相吞噬，坐山观虎斗也是战术' },

  { id: 11, name: '血战到底', goal: { type: 'eliminate' },       neutral: 310, par: 145, gold: 100,
    enemies: [{ c: 26, sp: 1.00, ag: 0.65, react: 0.40 }, { c: 30, sp: 1.02, ag: 0.66, react: 0.38 }, { c: 34, sp: 1.04, ag: 0.68, react: 0.38 }, { c: 38, sp: 1.06, ag: 0.70, react: 0.36 }, { c: 42, sp: 1.08, ag: 0.72, react: 0.34 }], coins: 100,
    tip: '残血时用「坚壁」能保命，撑过反打' },

  { id: 12, name: '人海狂潮', goal: { type: 'reach', val: 130 }, neutral: 330, par: 125, gold: 88,
    enemies: [{ c: 26, sp: 1.00, ag: 0.66, react: 0.38 }, { c: 30, sp: 1.02, ag: 0.68, react: 0.37 }, { c: 34, sp: 1.04, ag: 0.70, react: 0.36 }, { c: 38, sp: 1.06, ag: 0.72, react: 0.35 }, { c: 42, sp: 1.08, ag: 0.74, react: 0.34 }, { c: 46, sp: 1.10, ag: 0.76, react: 0.33 }], coins: 120,
    tip: '终极试炼：存活、壮大、然后吞掉整个世界' },

  /* ---- 无尽模式（通关 12 关后解锁） ---- */
  { id: 13, name: '终章·吞天噬地', goal: { type: 'reach', val: 150 }, neutral: 360, par: 150, gold: 110,
    enemies: [{ c: 32, sp: 1.02, ag: 0.70, react: 0.36 }, { c: 38, sp: 1.05, ag: 0.72, react: 0.35 }, { c: 44, sp: 1.08, ag: 0.74, react: 0.34 }, { c: 50, sp: 1.10, ag: 0.76, react: 0.33 }], coins: 150,
    tip: '主线最后一关。通关后主菜单的「无尽挑战」将是你真正的战场' },
];

/* ---------------- 无尽模式：层数程序化生成 ----------------
   无限层数，每层目标人数递增、敌军更多更强、棋盘逐层扩大（有上限）。 */
function makeEndlessStage(n) {
  const grown = Math.min(n - 1, 14);
  const world = { w: 3000 + grown * 110, h: 2200 + grown * 80 };

  const enemyCount = Math.min(2 + Math.floor((n - 1) / 2), 7);
  const baseCount = 6 + (n - 1) * 4;
  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    enemies.push({
      c: Math.round(baseCount * (1 + i * 0.16)),
      sp: Math.min(1.18, 0.92 + (n - 1) * 0.012),
      ag: Math.min(0.88, 0.36 + (n - 1) * 0.035),
      react: Math.max(0.28, 0.70 - (n - 1) * 0.028),
    });
  }

  const goalVal = 25 + n * 15;
  return {
    id: 'E' + n,
    name: '第 ' + n + ' 层',
    stage: n,
    endless: true,
    goal: { type: 'reach', val: goalVal },
    neutral: Math.min(380, 140 + n * 18),
    par: 75 + n * 6,
    gold: 55 + n * 5,
    coins: 20 + n * 6,
    world: world,
    enemies: enemies,
    tip: '无尽模式第 ' + n + ' 层：目标 ' + goalVal + ' 人，敌军 ' + enemyCount +
         ' 支（最强 ' + enemies[enemies.length - 1].c + ' 人）',
  };
}

/* ---------------- 成就 ---------------- */
const ACHIEVEMENTS = [
  { id: 'first_win', name: '初战告捷', desc: '通关任意关卡', coins: 50,  check: s => s.stats.wins >= 1 },
  { id: 'reach_25',  name: '人多势众', desc: '单局军团达到 25 人', coins: 60,  check: s => s.stats.bestCount >= 25 },
  { id: 'reach_50',  name: '人山人海', desc: '单局军团达到 50 人', coins: 110, check: s => s.stats.bestCount >= 50 },
  { id: 'reach_100', name: '千军万马', desc: '单局军团达到 100 人', coins: 220, check: s => s.stats.bestCount >= 100 },
  { id: 'eat_200',   name: '吞噬者',   desc: '累计吞噬 200 个敌方单位', coins: 130, check: s => s.stats.totalEaten >= 200 },
  { id: 'clear_5',   name: '小有名气', desc: '通关第 5 关', coins: 120, check: s => s.stars[5] > 0 },
  { id: 'clear_10',  name: '威震四方', desc: '通关第 10 关', coins: 240, check: s => s.stars[10] > 0 },
  { id: 'flawless',  name: '毫发无伤', desc: '一关中未损失任何单位并通关', coins: 180, check: s => s.stats.flawless >= 1 },
  { id: 'comeback',  name: '绝地翻盘', desc: '我方仅剩 1 人时使用技能并通关', coins: 220, check: s => s.stats.comeback >= 1 },
  { id: 'allstars',  name: '全星达人', desc: '累计获得 30 颗星', coins: 320, check: s => totalStars(s) >= 30 },
  { id: 'collector', name: '收藏家',   desc: '解锁 5 款皮肤', coins: 200, check: s => s.skinsOwned.length >= 5 },
  { id: 'rich',      name: '富甲一方', desc: '累计获得 3000 金币', coins: 350, check: s => s.stats.totalCoins >= 3000 },
  { id: 'endless_5', name: '无尽征途', desc: '无尽模式到达第 5 层', coins: 150, check: s => (s.stats.endlessBest || 0) >= 5 },
  { id: 'endless_10', name: '长夜漫漫', desc: '无尽模式到达第 10 层', coins: 300, check: s => (s.stats.endlessBest || 0) >= 10 },
];

function totalStars(s) {
  let n = 0;
  for (const k in s.stars) n += s.stars[k] || 0;
  return n;
}

/* ---------------- 工具函数 ---------------- */
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  const f = v => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
function colorDistance(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
}
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
