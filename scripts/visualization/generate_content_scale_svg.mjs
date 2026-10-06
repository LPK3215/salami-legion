/**
 * generate_content_scale_svg.mjs —— 生成「内容量级」条形图
 *
 * 用途：产出 docs/content-scale.svg，直观展示当前版本有多少关、几个技能/皮肤/成就。
 *       所有条长与数字均来自 js/config.js 的真实数组长度（运行时读取），
 *       加一关或加一款皮肤后重跑脚本即自动同步，不存在手工改数字漏改的问题。
 * 依赖：仅 Node.js 内置模块 + 同目录 lib_load_facts.mjs。
 * 运行方式：node scripts/visualization/generate_content_scale_svg.mjs（或 npm run docs:svg）
 * 输出路径：docs/content-scale.svg
 *
 * 版式约定（上一版被浏览器 getBBox() 查出说明行压住刻度、真源标注贴错行、数值溢出右边界，已修正）：
 *   - 刻度标签与说明文字分处不同基线，至少留 24px；
 *   - 「真源 XXX」注释放右侧留白、与所属条同一基线；
 *   - 数值一律画在色条内部右端，长度再短也不会越界；
 *   - 「数组名」注释放轨道右侧的专用留白区（x 从 X1+18 起），
 *     满格条也不会与数值标签互压（上一版就在这里叠出了“真14源”）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { esc, loadFacts, ROOT } from './lib_load_facts.mjs';

const f = loadFacts();
const T = f.theme;

const rows = [
  { label: '主线关卡', value: f.content.levels, src: 'LEVELS', color: T.gold },
  { label: '成就', value: f.content.achievements, src: 'ACHIEVEMENTS', color: T.green },
  { label: '皮肤', value: f.content.skins, src: 'SKINS', color: T.purple },
  { label: '本局技能', value: f.content.skills, src: 'SKILLS', color: T.blue },
  { label: '三选一增益', value: f.content.buffs, src: 'BUFFS', color: T['blue-d'] },
  { label: '敌军配色', value: f.content.enemyPalettes, src: 'ENEMY_PALETTES', color: T.red },
  { label: '开局人数档位', value: f.content.startOptions, src: 'START_OPTIONS', color: T['gold-d'] },
];

const W = 1080;
const X0 = 224;
const X1 = 900;
const NOTE_X = X1 + 18;
const BAR_TOP = 152;
const BAR_H = 38;
const GAP = 20;
const MAX = Math.max(...rows.map((r) => r.value));
const PLOT_BOTTOM = BAR_TOP + rows.length * (BAR_H + GAP) - GAP;
const H = PLOT_BOTTOM + 64;

const p = [];

/* 纵向刻度：标签统一放在所有说明文字之下、色条之上 */
for (let v = 2; v <= MAX; v += 2) {
  const x = (X0 + ((X1 - X0) * v) / MAX).toFixed(1);
  p.push(`  <line x1="${x}" y1="${BAR_TOP - 22}" x2="${x}" y2="${PLOT_BOTTOM}" stroke="${T['txt-dim']}" stroke-opacity=".14"/>`);
  p.push(`  <text x="${x}" y="${BAR_TOP - 30}" text-anchor="middle" font-size="10.5" fill="${T['txt-dim']}">${v}</text>`);
}
p.push(`  <text x="${X0}" y="${BAR_TOP - 30}" text-anchor="middle" font-size="10.5" fill="${T['txt-dim']}">0</text>`);
p.push(`  <line x1="${X0 - 40}" y1="${BAR_TOP - 22}" x2="${X0 - 40}" y2="${PLOT_BOTTOM}" stroke="${T['txt-dim']}" stroke-opacity=".25"/>`);

rows.forEach((r, i) => {
  const y = BAR_TOP + i * (BAR_H + GAP);
  const w = ((X1 - X0) * r.value) / MAX;
  const cy = y + BAR_H / 2 + 5;
  p.push(`  <text x="${X0 - 54}" y="${cy}" text-anchor="end" font-size="14" font-weight="600" fill="${T.txt}">${esc(r.label)}</text>`);
  p.push(`  <rect x="${X0}" y="${y}" width="${X1 - X0}" height="${BAR_H}" rx="7" fill="rgba(255,255,255,.045)"/>`);
  p.push(`  <rect x="${X0}" y="${y}" width="${w.toFixed(1)}" height="${BAR_H}" rx="7" fill="${r.color}" fill-opacity=".85"/>`);
  /* 数值放在色条内右端：短条也不会越出轨道 */
  p.push(`  <text x="${(X0 + w - 10).toFixed(1)}" y="${cy + 2}" text-anchor="end" font-size="16" font-weight="800" fill="${T.ink}">${r.value}</text>`);
  /* 数组名注释放轨道右侧专用留白区，与本行同基线 */
  p.push(`  <text x="${NOTE_X}" y="${cy}" text-anchor="start" font-size="10.5" fill="${T['txt-dim']}">${esc(r.src)}</text>`);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif" role="img" aria-label="蚕食军团 内容量级">
<defs>
  <linearGradient id="bg3" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.ink}"/><stop offset="100%" stop-color="${T.ink2}"/>
  </linearGradient>
  <linearGradient id="ttl3" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${T.blue}"/><stop offset="100%" stop-color="${T.green}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg3)"/>
<text x="30" y="46" font-size="24" font-weight="800" fill="url(#ttl3)">内容量级 · v${f.version}</text>
<text x="30" y="74" font-size="13" fill="${T['txt-dim']}">条长与数字运行时取自 js/config.js 的数组长度；右侧标注即对应的数组名。加内容后重跑 npm run docs:svg 即自动同步</text>
<text x="30" y="100" font-size="12.5" fill="${T['txt-dim']}">关卡挑战 ${f.content.levels} 关打完即通关 ｜ 无尽挑战没有层也没有终点（人数只增不减，里程碑从 ${f.mechanics.milestoneFirst} 人起逐段上提；地图以玩家为中心动态生成、敌军随规模实时变强）</text>
${p.join('\n')}
<text x="30" y="${H - 22}" font-size="11.5" fill="${T['txt-dim']}">运行时依赖 ${f.runtimeDeps} 个 ｜ 开发依赖 ${f.devDeps} 个（仅 jsdom，用于端到端测试） ｜ Node ${f.nodeEngines} ｜ 生成于 ${f.generatedAt}</text>
</svg>
`;

const out = path.join(ROOT, 'docs', 'content-scale.svg');
fs.writeFileSync(out, svg, 'utf8');
console.log('已生成 docs/content-scale.svg（' + svg.length + ' 字节）');
