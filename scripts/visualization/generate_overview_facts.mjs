/**
 * generate_overview_facts.mjs —— 为「项目全景观览页」导出真源数据
 *
 * 用途：把 project_overview/ 页面需要的全部事实（版本、内容数量、13 关数值、技能/皮肤/成就、
 *       引擎常量、文件行数、测试统计、目录树、文档摘要、真实代码片段）在构建期从项目源码里
 *       抽取出来，写成 project_overview/facts.js（window.OVERVIEW_FACTS）。
 *       页面本身只消费 facts，不手抄任何数字 —— 数值单一真源。
 * 依赖：仅 Node.js 内置模块（node:fs / node:path / node:vm）+ lib_load_facts.mjs。
 * 运行方式：node scripts/visualization/generate_overview_facts.mjs（或 npm run overview:data）
 * 输出路径：project_overview/facts.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadFacts, ROOT } from './lib_load_facts.mjs';

/* 统一把 CRLF 归一为 LF：Windows 工作区常见 CRLF（仓库内存的是 LF），
   不归一会导致多行正则（代码 fence）失配，也会把 \r 带进页面代码示例。 */
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const lines = (rel) => read(rel).split('\n');

/** 取源码中「从匹配行起往下 n 行」的真实片段（带原始缩进，不重排） */
function snippet(rel, anchorRe, before, after) {
  const arr = lines(rel);
  const i = arr.findIndex((l) => anchorRe.test(l));
  if (i < 0) return null;
  return arr.slice(Math.max(0, i - before), i + after + 1).join('\n').trimEnd();
}

/** 目录树：排除 .git / node_modules 以及本脚本自己的产物 facts.js
 *   （否则它自身体积会被下一次运行记录进去，输出就不幂等了） */
function buildTree(dir, rel, depth) {
  const out = [];
  const entries = fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((e) => !['.git', 'node_modules'].includes(e.name))
    .filter((e) => !(e.isDirectory() && e.name.startsWith('.')))   // 隐藏目录（.tmp_* 之类的工作目录）不进树
    .filter((e) => (rel ? rel + '/' + e.name : e.name) !== 'project_overview/facts.js')
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
  for (const e of entries) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      out.push({ name: e.name, path: r, type: 'dir', children: depth < 3 ? buildTree(path.join(dir, e.name), r, depth + 1) : [] });
    } else {
      const st = fs.statSync(path.join(ROOT, dir, e.name));
      /* 行数统一由 fixLines() 按换行口径计算，与 lib_load_facts 保持一致 */
      out.push({ name: e.name, path: r, type: 'file', bytes: st.size, lines: 0 });
    }
  }
  return out;
}

/** 行端口径与 lib_load_facts 一致：按换行计 */
function lineCount(rel) {
  const t = read(rel);
  return t.split('\n').length - (t.endsWith('\n') ? 1 : 0);
}
function fixLines(nodes) {
  for (const n of nodes) {
    if (n.type === 'file') n.lines = lineCount(n.path);
    else if (n.children) fixLines(n.children);
  }
  return nodes;
}

const f = loadFacts();
const cfg = f.cfg;

/* 关卡全量（去掉函数等不可序列化字段） */
const levels = cfg.LEVELS.map((L) => ({
  id: L.id,
  name: L.name,
  goalType: L.goal.type,
  goalVal: L.goal.val || null,
  neutral: L.neutral,
  par: L.par,
  gold: L.gold,
  coins: L.coins,
  enemies: L.enemies.map((e) => ({ c: e.c, sp: e.sp, ag: e.ag })),
  tip: L.tip || '',
}));

const skills = Object.values(cfg.SKILLS).map((s) => ({
  id: s.id, name: s.name, badge: s.badge, color: s.color, cd: s.cd,
  unlockAfter: s.unlockAfter ?? null, levels: (s.levels || []).map((l) => l.desc),
}));

const buffs = cfg.BUFFS.map((b) => ({ id: b.id, name: b.name, stat: b.stat, val: b.val, max: b.max, desc: b.desc }));
const skins = cfg.SKINS.map((s) => ({ id: s.id, name: s.name, body: s.body, style: s.style, price: s.price, tag: s.tag || '' }));
const achievements = cfg.ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, coins: a.coins }));
const startOptions = cfg.START_OPTIONS.map((o) => ({ count: o.count, unlockAfter: o.unlockAfter ?? 0 }));
const palettes = cfg.ENEMY_PALETTES.map((p) => ({ name: p.name, body: p.body }));

/* 文档摘要：取每个 md 的第一个标题 + 第一行引文（真实存在才写） */
const docList = fs.readdirSync(path.join(ROOT, 'docs')).filter((x) => x.endsWith('.md')).sort();
const docSummaries = docList.map((x) => {
  const t = read('docs/' + x);
  const title = (/^#\s+(.+)$/m.exec(t) || [])[1] || x;
  const quote = (/^>\s+(.+)$/m.exec(t) || [])[1] || '';
  return { file: 'docs/' + x, title, quote: quote.replace(/\*\*/g, '') };
});

/* 每帧更新顺序：从 docs/04 §3.2 的代码块里按行抽出（有编号列表就用它） */
const dev = read('docs/04-development.md');
const orderBlock = /### 3\.2[\s\S]*?\n```\n([\s\S]*?)```/.exec(dev);
const updateOrder = orderBlock
  ? orderBlock[1].trim().split('\n').map((l) => l.trim()).filter(Boolean)
  : [];

const facts = {
  meta: {
    project: '蚕食军团',
    projectEn: 'Salami Legion',
    name: f.name,
    version: f.version,
    license: f.license,
    description: f.description,
    author: f.author,
    repo: 'https://github.com/LPK3215/salami-legion',
    cloneUrl: 'https://github.com/LPK3215/salami-legion.git',
    pages: 'https://lpk3215.github.io/salami-legion/',
    issues: 'https://github.com/LPK3215/salami-legion/issues',
    node: f.nodeEngines,
    runtimeDeps: f.runtimeDeps,
    devDeps: f.devDeps,
    saveKey: f.saveKey,
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z',
    generator: 'scripts/visualization/generate_overview_facts.mjs',
  },
  content: f.content,
  mechanics: {
    ...f.mechanics,
    maxUnits: cfg.CFG.maxUnits,
    unitTotalMax: cfg.CFG.unitTotalMax,
    neutralMax: cfg.CFG.neutralMax,
    endless: cfg.ENDLESS,
    // 里程碑阈值序列真源：endlessMilestoneStep()，页面不手抄前几个档位
    milestoneThresholds: cfg.endlessMilestoneThresholds(7),
    pickup: cfg.CFG.pickup,
    zoom: cfg.CFG.zoom,
    move: cfg.CFG.move,
    gridCell: Number(/this\.cell = (\d+)/.exec(read('js/engine.js'))[1]),
  },
  lines: f.lines,
  test: f.test,
  totals: {
    jsLines: ['js/config.js', 'js/engine.js', 'js/ui.js', 'js/save.js', 'js/audio.js'].reduce((a, k) => a + f.lines[k], 0),
    cssLines: f.lines['css/style.css'],
    htmlLines: f.lines['index.html'],
    testLines: f.lines['test/dom.test.js'],
    docFiles: docList.length,
    screens: (read('index.html').match(/id="screen-/g) || []).length,
    skinStyles: [...new Set(cfg.SKINS.map((s) => s.style))].sort(),
  },
  levels,
  skills,
  buffs,
  skins,
  achievements,
  startOptions,
  palettes,
  docSummaries,
  updateOrder,
  faq: {
    /* FAQ 问答条数与文件实际行数现场统计，不在页面里手抄 */
    questions: (read('FAQ.md').match(/^\*\*Q：/gm) || []).length,
    lines: lineCount('FAQ.md'),
  },
  tree: fixLines(buildTree('', '', 1)),
  snippets: {
    saveKey: snippet('js/save.js', /^const SAVE_KEY/, 0, 0),
    eatCore: snippet('js/engine.js', /let t = this\.pairTimers\.get\(key\);/, 4, 9),
    newGame: snippet('js/ui.js', /self\.game = new MiniGame\(\{/, 0, 9),
    levelDef: snippet('js/config.js', /^  \{ id: 4,/, 0, 4),
    scriptOrder: snippet('index.html', /src="js\/config\.js"/, 0, 4),
  },
};

const banner =
  '/* 本文件由 scripts/visualization/generate_overview_facts.mjs 自动生成，请勿手工编辑。\n' +
  ` *    重新生成：node scripts/visualization/generate_overview_facts.mjs  或  npm run overview:data\n` +
  ` *    生成时间：${facts.meta.generatedAt}；所有数值直接来自项目源码（js/config.js、js/engine.js、\n` +
  ' *    js/save.js、package.json、css/style.css、index.html、test/dom.test.js、docs/04-development.md）。 */\n';

const out = path.join(ROOT, 'project_overview', 'facts.js');
fs.writeFileSync(out, banner + 'window.OVERVIEW_FACTS = ' + JSON.stringify(facts, null, 1) + ';\n', 'utf8');
console.log('已生成 project_overview/facts.js（' + fs.statSync(out).size + ' 字节，关卡 ' + levels.length + ' 条）');
