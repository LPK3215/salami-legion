/**
 * generate_attrition_mechanic_svg.mjs —— 生成「核心差异机制：按拍吞噬（盖住多少吞多少）」对比图
 *
 * 用途：产出 docs/attrition-mechanic.svg，用同一把时间尺对照三种规则：
 *       同类是接触瞬间整队吞并（垂直跳变）；本作到拍时【擦边】转移 1 个单位（阶梯），
 *       【被盖住 N 个】则一次转移 N 个（更陡的阶梯，上限 CFG.eat.batchMax）。
 *       节奏参数运行时取自 js/config.js 的 CFG.eat（interval / contact / batchMax），不写死。
 *       双方初始人数与「这一拍被盖住几个」是【机制示意值】（敌 5 / 我 3 / 盖住 2），
 *       已在图内写明，不冒充实测数据。
 * 依赖：仅 Node.js 内置模块 + 同目录 lib_load_facts.mjs。
 * 运行方式：node scripts/visualization/generate_attrition_mechanic_svg.mjs（或 npm run docs:svg）
 * 输出路径：docs/attrition-mechanic.svg
 *
 * 版式约定（上一版被浏览器 getBBox() 查出压字与贴边，已按此规则重排）：
 *   - 数据线在绘图区内缩 14px，避免与边框重合被误读；
 *   - 不在曲线上方横插说明文字，说明统一放图例或空白带；
 *   - 两个面板的刻度、轴、网格共用同一映射函数，保证可比。
 */
import fs from 'node:fs';
import path from 'node:path';
import { esc, loadFacts, ROOT } from './lib_load_facts.mjs';

const f = loadFacts();
const T = f.theme;
const IV = f.mechanics.eatInterval;
const BATCH = f.mechanics.eatBatchMax;      // 单批上限（真源 CFG.eat.batchMax）
const ENEMY = 5;
const ME = 3;
const YMAX = ENEMY + ME;
const TMAX = IV * ENEMY;
/* 示意：这一拍被圆盘盖住的个数（与图内标注一致；真实上限是 CFG.eat.batchMax，另写） */
const COVER = 2;

const W = 1080;
const H = 556;

/* 绘图区：rect 从 132 起，数据线内缩，避免贴边框 */
const RX0 = 132;
const RX1 = 1010;
const X0 = 170;
const X1 = 990;
const PAD = 14;

const px = (t) => X0 + (t / TMAX) * (X1 - X0);
const mkY = (top, h) => (v) => top + h - PAD - (v / YMAX) * (h - PAD * 2);

const PA = { top: 136, h: 122 };
const PB = { top: 312, h: 158 };
const yA = mkY(PA.top, PA.h);
const yB = mkY(PB.top, PB.h);

/** 本作：每拍转移 perTick 个单位的阶梯线（perTick = 1 即擦边逐个吞） */
function staircase(y, kind, perTick) {
  const per = Math.max(1, perTick || 1);
  const steps = Math.ceil(ENEMY / per);
  let d = '';
  for (let k = 0; k <= steps; k++) {
    const eaten = Math.min(ENEMY, per * k);
    const v = kind === 'foe' ? ENEMY - eaten : ME + eaten;
    const xt = Math.min(k * IV, TMAX);
    d += (k === 0 ? 'M' : 'L') + px(xt).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
    if (k < steps) {
      d += 'L' + px(Math.min((k + 1) * IV, TMAX)).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
    }
  }
  return d.trim();
}

/** 同类：接触即整队转移，垂直跳变后保持 */
function oneShot(y, kind) {
  const from = kind === 'foe' ? ENEMY : ME;
  const to = kind === 'foe' ? 0 : YMAX;
  return `M${px(0).toFixed(1)} ${y(from).toFixed(1)} L${px(0).toFixed(1)} ${y(to).toFixed(1)} L${X1.toFixed(1)} ${y(to).toFixed(1)}`;
}

const p = [];

/* ===== 图例（两面板共用，说明不再压在曲线上）===== */
p.push(`  <line x1="132" y1="94" x2="158" y2="94" stroke="${T.red}" stroke-width="3"/>`);
p.push(`  <text x="166" y="98" font-size="12.5" fill="${T.red}">敌方军团人数</text>`);
p.push(`  <line x1="272" y1="94" x2="298" y2="94" stroke="${T.blue}" stroke-width="3"/>`);
p.push(`  <text x="306" y="98" font-size="12.5" fill="${T.blue}">我方军团人数</text>`);
p.push(
  `  <text x="${RX1}" y="98" text-anchor="end" font-size="11.5" fill="${T['txt-dim']}">` +
    `节奏真源 js/config.js → CFG.eat.interval = ${IV}s，contact = ${f.mechanics.eatContact}，batchMax = ${BATCH}/批</text>`
);

/* ===== 面板 A：同类 ===== */
p.push(`  <text x="30" y="124" font-size="14.5" font-weight="700" fill="${T['txt-dim']}">同类做法 · 接触瞬间整队吞并</text>`);
p.push(`  <rect x="${RX0}" y="${PA.top}" width="${RX1 - RX0}" height="${PA.h}" rx="8" fill="rgba(255,255,255,.03)" stroke="${T['txt-dim']}" stroke-opacity=".28"/>`);
p.push(`  <path d="${oneShot(yA, 'foe')}" fill="none" stroke="${T.red}" stroke-width="2.8" stroke-opacity=".9"/>`);
p.push(`  <path d="${oneShot(yA, 'me')}" fill="none" stroke="${T.blue}" stroke-width="2.8" stroke-opacity=".9"/>`);
/* 两条水平线之间的空白带放结论，不与任何元素相交 */
p.push(`  <text x="${X1 - 8}" y="${((yA(0) + yA(YMAX)) / 2 + 4).toFixed(1)}" text-anchor="end" font-size="12.5" fill="${T['txt-dim']}">胜负在碰上的那一刻就定死</text>`);
p.push(`  <text x="120" y="${(yA(YMAX) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${T['txt-dim']}">${YMAX}</text>`);
p.push(`  <text x="120" y="${(yA(0) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${T['txt-dim']}">0</text>`);

/* ===== 面板 B：本作（同一个坐标系里画出两种接触）===== */
p.push(`  <text x="30" y="300" font-size="14.5" font-weight="700" fill="${T.gold}">本作《蚕食军团》· 每 ${IV}s 结算一批：实线 = 擦边（1 个/拍），虚线 = 被盖住 ${COVER} 个/拍</text>`);
p.push(`  <rect x="${RX0}" y="${PB.top}" width="${RX1 - RX0}" height="${PB.h}" rx="8" fill="rgba(255,217,61,.04)" stroke="${T.gold}" stroke-opacity=".32"/>`);

for (let k = 0; k <= ENEMY; k++) {
  const x = px(k * IV);
  p.push(`  <line x1="${x.toFixed(1)}" y1="${PB.top + 6}" x2="${x.toFixed(1)}" y2="${PB.top + PB.h - 6}" stroke="${T.gold}" stroke-opacity=".18"/>`);
  p.push(`  <text x="${x.toFixed(1)}" y="${PB.top + PB.h + 20}" text-anchor="middle" font-size="11" fill="${T['txt-dim']}">${(k * IV).toFixed(2)}s</text>`);
}
p.push(`  <path d="${staircase(yB, 'foe', 1)}" fill="none" stroke="${T.red}" stroke-width="3"/>`);
p.push(`  <path d="${staircase(yB, 'me', 1)}" fill="none" stroke="${T.blue}" stroke-width="3"/>`);
for (let k = 0; k <= ENEMY; k++) {
  const x = px(k * IV).toFixed(1);
  p.push(`  <circle cx="${x}" cy="${yB(ENEMY - k).toFixed(1)}" r="3.6" fill="${T.red}"/>`);
  p.push(`  <circle cx="${x}" cy="${yB(ME + k).toFixed(1)}" r="3.6" fill="${T.blue}"/>`);
}
/* 虚线：盖住 COVER 个/拍 —— 更陡的同一条时间尺，终点之后不再延伸 */
const coverEnd = Math.ceil(ENEMY / COVER) * IV;
p.push(`  <path d="${staircase(yB, 'foe', COVER)}" fill="none" stroke="${T.red}" stroke-width="2.6" stroke-opacity=".85" stroke-dasharray="7 5"/>`);
p.push(`  <path d="${staircase(yB, 'me', COVER)}" fill="none" stroke="${T.blue}" stroke-width="2.6" stroke-opacity=".85" stroke-dasharray="7 5"/>`);
for (let k = 0; k <= Math.ceil(ENEMY / COVER); k++) {
  const eaten = Math.min(ENEMY, COVER * k);
  const x = px(Math.min(k * IV, TMAX)).toFixed(1);
  p.push(`  <circle cx="${x}" cy="${yB(ENEMY - eaten).toFixed(1)}" r="3.4" fill="${T.red}" fill-opacity=".85"/>`);
  p.push(`  <circle cx="${x}" cy="${yB(ME + eaten).toFixed(1)}" r="3.4" fill="${T.blue}" fill-opacity=".85"/>`);
}
/* 虚线收尾之后的空白带：放「盖住就快」的结论，不与任何元素相交 */
p.push(
  `  <text x="${((px(coverEnd) + X1) / 2).toFixed(1)}" y="${((yB(0) + yB(YMAX)) / 2).toFixed(1)}" ` +
  `text-anchor="middle" font-size="12.5" fill="${T['txt-dim']}">把对方盖进自己的圆盘里 →</text>`
);
p.push(
  `  <text x="${((px(coverEnd) + X1) / 2).toFixed(1)}" y="${((yB(0) + yB(YMAX)) / 2 + 18).toFixed(1)}" ` +
  `text-anchor="middle" font-size="12.5" fill="${T.gold}">一拍吞 ${COVER} 个（上限 ${BATCH} 个/批）</text>`
);
p.push(`  <text x="120" y="${(yB(YMAX) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${T['txt-dim']}">${YMAX}</text>`);
p.push(`  <text x="120" y="${(yB(0) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${T['txt-dim']}">0</text>`);

/* ===== 轴与脚注 ===== */
p.push(`  <text x="${RX0}" y="${PB.top + PB.h + 40}" font-size="11.5" fill="${T['txt-dim']}">纵轴：军团人数　横轴：接触后经过的秒数（每个台阶 = 一次结算；实线每台阶 1 个，虚线每台阶 ${COVER} 个）</text>`);
p.push(
  `  <text x="${RX1}" y="${PB.top + PB.h + 40}" text-anchor="end" font-size="12.5" fill="${T.gold}">` +
    `→ 消耗期间人数随时可能反超：怎么接触、什么时候撤，才是这游戏的技术含量</text>`
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif" role="img" aria-label="按拍吞噬（擦边逐个吞、覆盖同批吞）与一次性吞并的对比">
<defs>
  <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.ink}"/><stop offset="100%" stop-color="${T.ink2}"/>
  </linearGradient>
  <linearGradient id="ttl2" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${T.gold}"/><stop offset="100%" stop-color="${T.red}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg2)"/>
<text x="30" y="44" font-size="24" font-weight="800" fill="url(#ttl2)">核心差异 · 按拍吞噬，盖住多少吞多少</text>
<text x="30" y="72" font-size="12.5" fill="${T['txt-dim']}">同一支 3 人军团遇上 5 人敌军后的人数变化。台阶间隔严格等于配置值；双方初始人数（敌 ${ENEMY} / 我 ${ME}）与虚线的「每拍被盖住 ${COVER} 个」均为机制示意值，不是实测数据。</text>
${p.join('\n')}
<text x="30" y="${H - 14}" font-size="11.5" fill="${T['txt-dim']}">生成于 ${f.generatedAt}｜数据真源 js/config.js（CFG.eat）｜版本 v${f.version}</text>
</svg>
`;

const out = path.join(ROOT, 'docs', 'attrition-mechanic.svg');
fs.writeFileSync(out, svg, 'utf8');
console.log('已生成 docs/attrition-mechanic.svg（' + svg.length + ' 字节）');
