/**
 * lib_load_facts.mjs —— 图表事实读取层（scripts/visualization/ 下各生成器共用）
 *
 * 用途：把「图里要出现的数字」全部在项目运行时从真源读出来，避免 SVG 里写死后过期。
 *       真源清单：js/config.js（数值与内容）、package.json（版本/许可/依赖）、
 *                 css/style.css（:root 主题色）、test/dom.test.js（测试段数与断言数）、
 *                 各源文件行数。
 * 依赖：仅 Node.js 内置模块（node:fs、node:path、node:vm）。不引第三方，不联网。
 * 运行方式：不单独运行，由 generate_*.mjs import；自检：
 *             node --input-type=module -e "import('./scripts/visualization/lib_load_facts.mjs').then(m=>console.log(m.loadFacts()))"
 * 输出：内存中的事实对象，不落盘（落盘由各自的 generate_*.mjs 负责）。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** 仓库根目录（scripts/visualization/ 的上两级） */
export const ROOT = path.resolve(HERE, '..', '..');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 统计文本行数（按换行计，与 wc -l 同口径） */
const lineCount = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

/** XML 文本节点转义，SVG 里任何动态文本都必须过这一层 */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 读取 js/config.js：它是浏览器脚本（顶层 const），用 vm 在同一作用域末尾取回导出 */
function readConfig() {
  const src = read('js/config.js');
  const sandbox = { console };
  const picked = vm.runInNewContext(
    src + '\n;({ CFG, SKILLS, SKILL_LIST, BUFFS, SKINS, LEVELS, ACHIEVEMENTS, START_OPTIONS, ENEMY_PALETTES, ENDLESS, endlessMilestoneThresholds })',
    sandbox,
    { filename: 'js/config.js', timeout: 5000 }
  );
  return picked;
}

/** 读取 css/style.css 的 :root 自定义属性，作为配色单一真源 */
function readTheme() {
  const block = /:root\{([\s\S]*?)\}/.exec(read('css/style.css'));
  const vars = {};
  if (block) {
    for (const m of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

/** 统计端到端测试的段数与断言调用点（排除函数定义自身） */
function readTestStats() {
  const src = read('test/dom.test.js');
  const sections = (src.match(/\/\* =+ \d+\./g) || []).length;
  const callSites = (name) =>
    (src.match(new RegExp('\\b' + name + '\\(', 'g')) || []).length -
    (src.match(new RegExp('function\\s+' + name + '\\b', 'g')) || []).length;
  return {
    sections,
    asserts: callSites('assert'),
    checks: callSites('ok'),
    lines: lineCount(src),
  };
}

/** 汇总全部事实 */
export function loadFacts() {
  const pkg = JSON.parse(read('package.json'));
  const cfg = readConfig();
  const theme = readTheme();

  const tracked = [
    'index.html',
    'css/style.css',
    'js/config.js',
    'js/engine.js',
    'js/ui.js',
    'js/save.js',
    'js/audio.js',
    'server.js',
    'test/dom.test.js',
    'scripts/start.sh',
  ];
  const lines = {};
  for (const rel of tracked) lines[rel] = lineCount(read(rel));

  const docs = fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .sort();

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    name: pkg.name,
    version: pkg.version,
    license: pkg.license,
    description: pkg.description,
    author: pkg.author,
    homepage: pkg.homepage || '',
    nodeEngines: pkg.engines.node,
    runtimeDeps: Object.keys(pkg.dependencies || {}).length,
    devDeps: Object.keys(pkg.devDependencies || {}).length,
    pkg,
    cfg,
    theme,
    lines,
    docs,
    test: readTestStats(),
    content: {
      levels: cfg.LEVELS.length,
      skills: Object.keys(cfg.SKILLS).length,
      buffs: cfg.BUFFS.length,
      skins: cfg.SKINS.length,
      achievements: cfg.ACHIEVEMENTS.length,
      startOptions: cfg.START_OPTIONS.length,
      enemyPalettes: cfg.ENEMY_PALETTES.length,
    },
    mechanics: {
      eatInterval: cfg.CFG.eat.interval,
      eatContact: cfg.CFG.eat.contact,
      eatBatchMax: cfg.CFG.eat.batchMax,
      // 无尽里程碑：只把「首段门槛」作为事实读给图表，段长公式留在 config 里
      milestoneFirst: cfg.ENDLESS.milestoneFirst,
      worldW: cfg.CFG.world.w,
      worldH: cfg.CFG.world.h,
      unitRadius: cfg.CFG.unit.r,
      spacing: cfg.CFG.unit.spacing,
    },
    saveKey: /SAVE_KEY\s*=\s*'([^']+)'/.exec(read('js/save.js'))[1],
  };
}
