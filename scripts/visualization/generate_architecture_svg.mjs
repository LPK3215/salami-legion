/**
 * generate_architecture_svg.mjs —— 生成「架构与数据流」图
 *
 * 用途：产出 docs/architecture.svg，供 README 可视化展示引用。
 *       图中的文件行数、内容数量、地图尺寸、吞噬节奏、存档键等全部运行时从真源读取
 *       （见 lib_load_facts.mjs），改代码后重跑本脚本即可同步，不会出现过期数字。
 * 依赖：仅 Node.js 内置模块 + 同目录 lib_load_facts.mjs。不引第三方，不联网。
 * 运行方式：node scripts/visualization/generate_architecture_svg.mjs（或 npm run docs:svg）
 * 输出路径：docs/architecture.svg（覆盖写；SVG 为纯文本，可 diff）
 *
 * 版式约定（上一版被浏览器 getBBox() 查出文字互压，已按此规则重排）：
 *   - 每层一个大框，标题与副标题一律「贴框顶」，内容一律在副标题下方留 ≥14px；
 *   - 任何文本不得与相邻层的框线同处一条水平带；
 *   - 行内标签统一放在同一 y 基线上，避免视觉归属错位。
 */
import fs from 'node:fs';
import path from 'node:path';
import { esc, loadFacts, ROOT } from './lib_load_facts.mjs';

const f = loadFacts();
const T = f.theme;
const W = 1180;

/* —— 纵向布局表：每层 { y, h } —— */
const L = {
  ui: { y: 100, h: 64 },
  cfg: { y: 200, h: 112 },
  eng: { y: 348, h: 170 },
  mod: { y: 546, h: 64 },
  api: { y: 638, h: 60 },
  dist: { y: 724, h: 60 },
};
const H = L.dist.y + L.dist.h + 40;

const X0 = 130;
const XW = 980;
const X1 = X0 + XW;

/** 层大框：标题贴顶 24px，副标题贴顶 42px */
function layerBox(y, h, title, sub, color, opts = {}) {
  const dashed = opts.dashed ? ' stroke-dasharray="5 4"' : '';
  return (
    `  <rect x="${X0}" y="${y}" width="${XW}" height="${h}" rx="10" fill="rgba(255,255,255,.05)" stroke="${color}" stroke-opacity=".55" stroke-width="1.5"${dashed}/>\n` +
    `  <text x="${X0 + XW / 2}" y="${y + 24}" text-anchor="middle" font-size="15" font-weight="700" fill="${color}">${esc(title)}</text>\n` +
    `  <text x="${X0 + XW / 2}" y="${y + 42}" text-anchor="middle" font-size="12" fill="${T['txt-dim']}">${esc(sub)}</text>`
  );
}

/** 同层内的并列小盒 */
function cell(x, y, w, h, title, sub, color, opts = {}) {
  const dashed = opts.dashed ? ' stroke-dasharray="5 4"' : '';
  const t = `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 5)}" text-anchor="middle" font-size="14" font-weight="700" fill="${color}">${esc(title)}</text>`;
  const s = sub ? `\n  <text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" font-size="11.5" fill="${T['txt-dim']}">${esc(sub)}</text>` : '';
  return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="rgba(255,255,255,.05)" stroke="${color}" stroke-opacity=".55" stroke-width="1.5"${dashed}/>\n  ${t}${s}`;
}

function chip(x, y, text, color) {
  const w = Math.round(text.length * 7.6 + 20);
  return (
    `  <rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="rgba(255,255,255,.06)" stroke="${color}" stroke-opacity=".5"/>\n` +
    `  <text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" font-size="12" fill="${color}">${esc(text)}</text>`
  );
}

function chipRow(x, y, items, color) {
  let cx = x;
  const out = [];
  for (const it of items) {
    out.push(chip(cx, y, it, color));
    cx += Math.round(it.length * 7.6 + 20) + 10;
  }
  return out.join('\n');
}

function arrowV(x, y1, y2, color = T.blue) {
  return (
    `  <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 9}" stroke="${color}" stroke-width="2" stroke-opacity=".7"/>\n` +
    `  <path d="M ${x - 5} ${y2 - 9} L ${x + 5} ${y2 - 9} L ${x} ${y2} Z" fill="${color}" fill-opacity=".85"/>`
  );
}

function arrowH(x1, x2, y, color) {
  return (
    `  <line x1="${x1}" y1="${y}" x2="${x2 - 8}" y2="${y}" stroke="${color}" stroke-width="1.6" stroke-opacity=".7"/>\n` +
    `  <path d="M ${x2 - 8} ${y - 4.5} L ${x2 - 8} ${y + 4.5} L ${x2} ${y} Z" fill="${color}" fill-opacity=".8"/>`
  );
}

function layerTag(y, h, label, color) {
  return (
    `  <text x="30" y="${y + h / 2 + 4}" font-size="11" fill="${color}" fill-opacity=".85">${esc(label)}</text>\n` +
    `  <line x1="112" y1="${y}" x2="112" y2="${y + h}" stroke="${color}" stroke-opacity=".25"/>`
  );
}

const p = [];

/* 表现层 */
p.push(layerTag(L.ui.y, L.ui.h, '表现层', T.blue));
p.push(cell(130, L.ui.y, 300, L.ui.h, 'index.html', `${f.lines['index.html']} 行 · 各屏 DOM 骨架`, T.blue));
p.push(cell(450, L.ui.y, 300, L.ui.h, 'css/style.css', `${f.lines['css/style.css']} 行 · 样式/断点/主题色`, T.blue));
p.push(cell(770, L.ui.y, 340, L.ui.h, '无框架 · 无构建', `运行时依赖 ${f.runtimeDeps} 个，刷新即生效`, T.green, { dashed: true }));

/* 数据真源 */
p.push(layerTag(L.cfg.y, L.cfg.h, '数据真源', T.gold));
p.push(layerBox(L.cfg.y, L.cfg.h, 'js/config.js', `${f.lines['js/config.js']} 行 —— 关卡 / 技能 / 增益 / 皮肤 / 成就 / 全局参数的唯一真源`, T.gold));
p.push(
  chipRow(160, L.cfg.y + 62, [
    `关卡 ${f.content.levels}`,
    `技能 ${f.content.skills}`,
    `增益 ${f.content.buffs}`,
    `皮肤 ${f.content.skins}`,
    `成就 ${f.content.achievements}`,
    `开局档位 ${f.content.startOptions}`,
    `敌军配色 ${f.content.enemyPalettes}`,
    `地图 ${f.mechanics.worldW}×${f.mechanics.worldH}`,
  ], T.gold)
);

/* 引擎层 + 每帧流水线 */
p.push(layerTag(L.eng.y, L.eng.h, '引擎层', T.purple));
p.push(layerBox(L.eng.y, L.eng.h, 'js/engine.js', `${f.lines['js/engine.js']} 行 · Legion 类 / AI / 编队 / 碰撞 / 渲染 · 每帧顺序如下`, T.purple));
const pipe = [
  ['输入', '指针·键盘·摇杆'],
  ['目标点', '平滑转向'],
  ['编队移动', '间距 ' + f.mechanics.spacing],
  ['逐个吞噬', `每 ${f.mechanics.eatInterval}s 转 1 个`],
  ['AI 决策', '追 / 逃 / 收编'],
  ['空间网格', '碰撞裁剪'],
  ['Canvas 渲染', '精灵 + 相机'],
];
const pw = 122;
const pgap = 14;
const ppy = L.eng.y + 56;
const phh = 76;
let px = 158;
pipe.forEach(([title, sub], i) => {
  const isKey = title === '逐个吞噬';
  const color = isKey ? T.red : T.purple;
  p.push(
    `  <rect x="${px}" y="${ppy}" width="${pw}" height="${phh}" rx="9" fill="${isKey ? 'rgba(255,91,110,.14)' : 'rgba(255,255,255,.05)'}" stroke="${color}" stroke-opacity=".7" stroke-width="${isKey ? 2.2 : 1.4}"/>`
  );
  p.push(`  <text x="${px + pw / 2}" y="${ppy + 32}" text-anchor="middle" font-size="13.5" font-weight="700" fill="${color}">${esc(title)}</text>`);
  p.push(`  <text x="${px + pw / 2}" y="${ppy + 52}" text-anchor="middle" font-size="10.5" fill="${isKey ? color : T['txt-dim']}">${esc(sub)}</text>`);
  if (i < pipe.length - 1) p.push(arrowH(px + pw, px + pw + pgap, ppy + phh / 2, T.purple));
  px += pw + pgap;
});

/* 外围模块 */
p.push(layerTag(L.mod.y, L.mod.h, '外围模块', T['blue-d']));
p.push(cell(130, L.mod.y, 316, L.mod.h, 'js/ui.js', `${f.lines['js/ui.js']} 行 · 界面流转与渲染`, T['blue-d']));
p.push(cell(466, L.mod.y, 316, L.mod.h, 'js/save.js', `${f.lines['js/save.js']} 行 · 存档读写`, T['blue-d']));
p.push(cell(802, L.mod.y, 308, L.mod.h, 'js/audio.js', `${f.lines['js/audio.js']} 行 · 音效合成`, T['blue-d']));

/* 浏览器能力 */
p.push(layerTag(L.api.y, L.api.h, '浏览器能力', T.green));
p.push(cell(130, L.api.y, 316, L.api.h, 'Canvas 2D', '预渲染精灵 + 空间网格', T.green));
p.push(cell(466, L.api.y, 316, L.api.h, 'WebAudio', '实时合成，无音频文件', T.green));
p.push(cell(802, L.api.y, 308, L.api.h, 'localStorage', `键 ${f.saveKey}`, T.green));

/* 分发 */
p.push(layerTag(L.dist.y, L.dist.h, '分发', T.gold));
p.push(cell(130, L.dist.y, 480, L.dist.h, 'server.js（本地 / CNB 预览）', `${f.lines['server.js']} 行 · 零依赖静态服务 + /healthz`, T.gold));
p.push(cell(630, L.dist.y, 480, L.dist.h, 'GitHub Pages（经典模式）', `发布源 main / 仓库根 · Node ${f.nodeEngines}`, T.gold));

/* 层间连线：一律从上一层底边到下一层顶边 */
p.push(arrowV(300, L.ui.y + L.ui.h, L.cfg.y));
p.push(arrowV(620, L.cfg.y + L.cfg.h, L.eng.y));
p.push(arrowV(288, L.eng.y + L.eng.h, L.mod.y));
p.push(arrowV(624, L.eng.y + L.eng.h, L.mod.y));
p.push(arrowV(956, L.eng.y + L.eng.h, L.mod.y));
p.push(arrowV(288, L.mod.y + L.mod.h, L.api.y));
p.push(arrowV(624, L.mod.y + L.mod.h, L.api.y));
p.push(arrowV(956, L.mod.y + L.mod.h, L.api.y));
p.push(arrowV(370, L.api.y + L.api.h, L.dist.y));
p.push(arrowV(870, L.api.y + L.api.h, L.dist.y));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif" role="img" aria-label="蚕食军团 架构与数据流">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${T.ink}"/><stop offset="100%" stop-color="${T.ink2}"/>
  </linearGradient>
  <linearGradient id="ttl" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${T.blue}"/><stop offset="100%" stop-color="${T.gold}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<text x="30" y="46" font-size="24" font-weight="800" fill="url(#ttl)">蚕食军团 · 架构与数据流</text>
<text x="30" y="72" font-size="13" fill="${T['txt-dim']}">纯前端单机游戏：无后端、无数据库、无第三方运行库。自上而下 = 页面 → 真源配置 → 引擎每帧流水线 → 模块 → 浏览器能力 → 分发</text>
<line x1="30" y1="84" x2="${W - 30}" y2="84" stroke="${T.blue}" stroke-opacity=".35"/>
${p.join('\n')}
<text x="30" y="${H - 14}" font-size="11.5" fill="${T['txt-dim']}">端到端测试 test/dom.test.js：${f.test.lines} 行 · ${f.test.sections} 段流程 · ${f.test.asserts} 条断言 · ${f.test.checks} 项界面校验　|　版本 v${f.version} · ${f.license} · 生成于 ${f.generatedAt}（数字源自 js/config.js、package.json、css/style.css）</text>
</svg>
`;

const out = path.join(ROOT, 'docs', 'architecture.svg');
fs.writeFileSync(out, svg, 'utf8');
console.log('已生成 docs/architecture.svg（' + svg.length + ' 字节）');
