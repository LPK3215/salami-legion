# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)，条目格式遵循
[Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)。

变更类型的含义：`Added` 新增功能/内容 · `Changed` 改动既有行为或数值 · `Fixed` 缺陷修复 ·
`Removed` 移除 · `Deprecated` 即将移除。

---

## [Unreleased]

### Added

- 文档图表与生成器（数字均运行时从真源读取，不手写）：
  `scripts/visualization/lib_load_facts.mjs`（事实层）、
  `generate_architecture_svg.mjs` → `docs/architecture.svg`（架构与数据流）、
  `generate_attrition_mechanic_svg.mjs` → `docs/attrition-mechanic.svg`（逐个吞噬 vs 一次性吞并对比）、
  `generate_content_scale_svg.mjs` → `docs/content-scale.svg`（内容量级条形图）；
  仅依赖 Node 内置模块，不引入外部运行时，可用 `npm run docs:svg` 一键重新生成
- README 新增「一图看懂」与入口地址表（仓库 + Pages），徽章改为优先使用 shields.io 动态端点
  （version / top language / jsdom 版本 / commit activity）
- 图表版式列入质量门禁：三张 SVG 经浏览器逐字 `getBBox()` / `getExtentOfChar()` 求交复验两轮，
  修掉了文字互压（胶囊压副标题、标题落进流程格、数值压注记“真14源”）、注记贴错行、
  数值越出轨道、数据线与边框重合等 10 处排版缺陷；复验方法已写入各生成器的「版式约定」注释
- 开源规范文件：`LICENSE`（MIT）、`CONTRIBUTING.md`、`CHANGELOG.md`、`FAQ.md`、
  `AUTHORS`、`SECURITY.md`、`CODE_OF_CONDUCT.md`
- `.gitattributes`：统一以 LF 存入仓库，并强制 `*.sh` 保持 LF —— 防止 `scripts/start.sh`
  被以 CRLF 提交后在 Linux/macOS 下无法执行（此前依赖各人 `core.autocrlf` 配置）
- `.editorconfig`：固化现有代码风格（2 空格缩进、UTF-8、LF、文件末尾换行），不引入格式化工具
- GitHub Pages 发布：经典模式（legacy），发布源为 `main` 分支**仓库根目录**，
  线上地址 <https://lpk3215.github.io/salami-legion/>
- `.nojekyll`：禁用 Jekyll 处理，保证静态资源原样发布
- `package.json`：补齐开源元数据 `license` / `author` / `repository` / `bugs` / `homepage`，
  并新增 `docs:svg` 脚本作为图表重新生成的入口

### Changed

- 文档中各源文件的行数统计口径统一为**按换行计（`wc -l` 同口径，由 `lib_load_facts.mjs` 计算）**：
  `index.html` 240 → 266、`css/style.css` 530 → 561、`js/config.js` 232 → 257、
  `js/engine.js` 1568 → 1723、`js/ui.js` 725 → 783、`js/save.js` 87 → 98、`js/audio.js` 47 → 53、
  `server.js` 113 → 126、`test/dom.test.js` 502 → 564、`scripts/start.sh` 49 → 56。
  原因：旧数值来自 PowerShell `Measure-Object -Line`（只计非空行），与 `wc -l` 不同口径，
  造成同一事实在两处不一致；现以 `lib_load_facts.mjs` 为单一真源
- 项目更名为**《蚕食军团》（Salami Legion）**，原名为《小人军团吞噬战》。
  同步范围：页面 `<title>` 与主菜单 logo（改为「蚕食 / 军团」两行四字）、包名
  `mini-legion-io` → `salami-legion`、`/healthz` 返回的服务名、启动横幅、
  `README.md` 与 `docs/` 中的项目名、以及各源文件的文件头注释
- 主菜单 logo 由 7 字（`小人军团` + `吞噬战` 两行）改为 4 字（`蚕食` + `军团` 两行），
  小屏断点下不再需要压缩字号

### Fixed

（本节暂无条目）

### Removed

（本节暂无条目）

> 说明：更名**未**改动 localStorage 存档键 `mini_legion_save_v1`（`js/save.js`）。
> 键名与产品名刻意解耦，改动它等同于清空全部玩家存档。

---

## [1.0.0] - 2026-10-04

首个公开版本。

### Added

- **核心机制「逐个单位吞噬」**：两支军团接触后每 0.32 秒转移 1 个单位，持续消耗直至一方清零，
  而不是一次性吞并整队 —— 本作的差异点所在
- **关卡挑战**：主线 13 关，目标为「达到 N 人」或「消灭所有敌军」，达成即结算并进入下一关
- **无尽挑战**：无限层数，每层目标人数递增、敌军更多更强、棋盘逐层扩大
- **成长体系**：6 个技能（急速集结 / 临时增援 / 诱捕 / 狂暴吞噬 / 时间迟缓 / 坚壁）、
  每关结算的三选一奖励、10 款皮肤商店、14 个成就、金币货币
- **跨端操作**：鼠标指针跟随（带十字准星）、`WASD` / 方向键（支持同时按两键斜向）、
  移动端虚拟摇杆（按住即出，拖动距离控制力度，多指操作互不干扰，可切换为「点哪走哪」）
- **纯前端零依赖实现**：Canvas 2D 渲染（预渲染精灵 + 空间网格）、WebAudio 实时合成音效
  （无音频资源文件）、localStorage 存档（无后端、无数据库）
- **暂停与后台保护**：`Esc` / `P` 或右上角按钮；切到后台自动暂停
- `server.js`：Node.js 零依赖静态服务器，含目录穿越防护与 `/healthz` 健康检查
- `test/dom.test.js`：jsdom 端到端测试，真实点击全部界面并校验核心玩法流程
- `scripts/start.sh` 与 `.cnb.yml`：CNB 云原生开发环境幂等启动与端口网关预览
- `docs/`：5 篇设计与开发文档（玩法、模式、系统与数值、开发者文档、跨端操作与布局）

---

## 版本记录约定

- 每次合入的改动由提交者在 `[Unreleased]` 下追加条目，发版时把该段改写成带日期的版本号
- 历史条目**不删除、不静默改写**；确需更正时新增一条 `Changed` 说明更正原因
- 破坏玩家存档兼容性的改动必须在条目中显式标注，并说明迁移方式（参见 [CONTRIBUTING.md](CONTRIBUTING.md) 第 3 节）
