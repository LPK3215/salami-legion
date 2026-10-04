# 如何参与贡献

感谢你有兴趣动这个项目。本文是这个仓库的**唯一贡献规范**，请先完整读一遍再改代码 —— 
里面有一条会让老玩家存档清零的红线。

- 项目玩法与数值：[docs/01-gameplay.md](docs/01-gameplay.md)、[docs/02-modes.md](docs/02-modes.md)、[docs/03-systems.md](docs/03-systems.md)
- 架构与加内容教程：[docs/04-development.md](docs/04-development.md)
- 跨端操作与布局：[docs/05-controls-and-layout.md](docs/05-controls-and-layout.md)
- 常见问题：[FAQ.md](FAQ.md)　安全报告：[SECURITY.md](SECURITY.md)　行为准则：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## 1. 环境准备

```bash
git clone https://github.com/LPK3215/salami-legion.git
cd salami-legion
npm install        # 只装开发依赖 jsdom，运行时无任何依赖
npm start          # http://localhost:8080 （PORT=xxxx npm start 可换端口）
npm test           # jsdom 端到端测试：真实点击全部界面 + 校验核心玩法
```

要求 Node **>= 18**（真源是 `package.json` 的 `engines` 字段）。

**没有构建步骤。** 不存在 `npm run build`，改了 `.js` 刷新浏览器就生效 —— 任何要求你
"先编译"的改动都不符合本项目定位。

---

## 2. 文件职责

行数由 `scripts/visualization/lib_load_facts.mjs` 按换行（`wc -l` 口径）统计，不靠手填。

| 文件 | 行数 | 职责 |
|---|---|---|
| `index.html` | 266 | 页面骨架与各屏 DOM（主菜单 / 准备页 / 对局 HUD / 结算 / 商店 / 成就…） |
| `css/style.css` | 561 | 全部样式、断点适配、动画；**`:root` 自定义属性是全站配色真源**（图表也读它） |
| `js/config.js` | 257 | **所有数值与内容的真源**：`CFG`、`SKILLS`、`BUFFS`、`START_OPTIONS`、`SKINS`、`LEVELS`、`ACHIEVEMENTS`、`ENEMY_PALETTES` |
| `js/engine.js` | 1723 | 核心引擎：`Legion` 类、逐个单位吞噬、编队移动、AI、渲染、输入（鼠标/键盘/虚拟摇杆） |
| `js/ui.js` | 783 | 界面流转与交互：渲染列表、按钮、结算页、Toast |
| `js/save.js` | 98 | localStorage 存档读写 |
| `js/audio.js` | 53 | WebAudio 实时合成音效（无音频文件） |
| `server.js` | 126 | 零依赖静态服务器（含目录穿越防护、`/healthz`） |
| `test/dom.test.js` | 564 | jsdom 端到端测试 |
| `scripts/start.sh` | 56 | CNB 云开发环境幂等启动脚本 |
| `scripts/visualization/` | — | 图表生成器：`lib_load_facts.mjs`（事实层）+ 3 个 `generate_*.mjs`，产物写入 `docs/*.svg` |

**加内容优先改 `js/config.js`，不要在 `engine.js` / `ui.js` 里硬编码数值。**

---

## 3. 🔴 红线：存档键不许改

```js
// js/save.js:5
const SAVE_KEY = 'mini_legion_save_v1';
```

这是 localStorage 的键名。**改了它 = 所有玩家的金币、关卡进度、星级、皮肤、成就、无尽最高层瞬间清零。**

- 产品改名、文案改词、包名变化，都**不带动这个键**（历史上项目从《小人军团吞噬战》更名
  为《蚕食军团》时就是刻意保留它，见 [CHANGELOG.md](CHANGELOG.md)）。
- 确实需要迁移存档结构时：保持键名不变，在 `js/save.js` 内做**版本兼容读取**，
  并在 PR 描述里写明旧存档如何映射。
- 同理，`package.json` 的 `name` 与存档键无关，可以安全改。

---

## 4. 其他设计约束（PR 会被拒的常见原因）

1. **运行时零依赖是卖点。** 不要引入任何前端框架、打包器、CDN 脚本、图片/音频资源文件。
   音效必须是 WebAudio 合成，贴图必须是 Canvas 程序绘制。
2. **`eat.interval = 0.32` 是本作的差异点**（两支军团接触后每 0.32 秒转移 1 个单位，逐个消耗，
   而非一次吞并整队）。把它改回"一次性吞并"等于删掉这个项目存在的理由，会被直接拒。
3. **跨端操作要同时兼顾三种输入**：鼠标指针跟随、键盘（WASD/方向键，支持双键斜向）、
   移动端虚拟摇杆（多指不互抢）。改输入必须过 `npm test` 里的摇杆/键盘/多指用例。
4. **数值改动要同步文档。** 改了 `config.js` 的关卡/技能/皮肤/成就数值，必须同步
   `docs/02-modes.md`、`docs/03-systems.md` 与 `README.md` 里对应的描述，否则视为不完整改动。
5. 资源引用一律**相对路径**（`css/style.css`、`js/engine.js`），不要用 `/绝对路径` —— 
   站点部署在子路径 `lpk3215.github.io/salami-legion/` 下，绝对路径会 404。
6. 文件名小写 + 连字符，不含空格与中文。
7. **不在仓库内放二进制素材**（图片/音频/字体）。README 需要图时用 `scripts/visualization/` 生成 SVG；
   需要截图则保留 `<!-- TODO: 截图待补充 -->` 占位，不伪造截图，也不把 PNG 提交进仓库。
8. **图表不手写。** `docs/*.svg` 是生成产物，数字均来自 `lib_load_facts.mjs`；新增图表请新增一个
   `generate_<asset_name>.mjs`（只用 Node 内置模块，不引第三方依赖），而不是手写 SVG 或改现有样式。

---

## 5. 提交流程

1. Fork 仓库，从 `main` 切出分支：`feat/xxx`、`fix/xxx`、`docs/xxx`
2. 改动 → `npm test` 必须通过（见下一节关于偶发失败）
3. 提交信息用 Conventional Commits，中文描述即可：
   `feat: 新增第 14 关「沙丘合围」` / `fix: 修复松手摇杆残留惯性过大`
4. **同步更新 [CHANGELOG.md](CHANGELOG.md) 的 `[Unreleased]` 段**（Added / Changed / Fixed）
5. 开 PR 到 `main`，描述里写清：改了什么、为什么、怎么验的、影响不影响存档或数值
6. 不要直接向 `main` 推送；不要提交 `node_modules/`

一个 PR 只做一件事。功能与格式化混在一起会被要求拆开。

---

## 6. 测试怎么跑、怎么看

```bash
npm test
```

会真实驱动界面：主菜单 → 关卡选择 → 商店 → 成就 → 准备页 → 对局 → 逐个吞噬校验 →
摇杆/键盘/多指 → 通关结算与三选一 → 暂停 → 失败流程，最后打印 `全部通过 ✓`。

**已知偶发失败（不是你的 bug）：** 用例「应为多帧逐个消耗，而非一次性吞并」依赖帧推进
时序，实测主干与改动后均为约 2/6 概率失败（同一断言）。判定方法是**重跑两到三次**：
如果重跑通过且你没动 `eat.interval` 相关逻辑，就是抖动，PR 描述里注明即可。

更多调试手段（引擎压力/平衡模拟、浏览器内调试）见 [docs/04-development.md](docs/04-development.md) 第 6 节。

---

## 7. 部署说明

线上站点是 **GitHub Pages 经典模式（legacy）**，发布源 = `main` 分支**仓库根目录**
（不是 `/docs`，本仓库的 `docs/` 是开发文档）。因此：

- `git push github main` 之后自动构建发布，无需手动触发、无需 Actions
- 根目录必须有 `.nojekyll`（禁止 Jekyll 处理，保证原样发布）
- 入口必须是根目录 `index.html`

如果你把内容挪进 `docs/` 或改了发布源，线上会立刻 404，这类改动请先在 Issue 里讨论。

---

## 8. 报 Issue

Bug 请附：浏览器与版本、操作系统、复现步骤（到哪个界面、点了什么）、控制台报错原文、
是否可稳定复现。数值/平衡类反馈请附上关卡号、开局人数、带的技能。

---

## 9. 合并前自检

来自 [docs/04-development.md](docs/04-development.md) 第 9 节，另加三条本仓库专属：

- [ ] `npm test` 通过（偶发失败已按第 6 节重跑确认）
- [ ] `SAVE_KEY` 未被改动
- [ ] CHANGELOG 的 `[Unreleased]` 有本次条目
- [ ] 文档中的数值与实际取值一致
- [ ] 若改了 `js/config.js` 的条目数量、文件行数或主题色，跑过 `npm run docs:svg` 并把刷新后的 `docs/*.svg` 一起提交
- [ ] 浏览器 Console 无报错，站点子路径下资源不 404
