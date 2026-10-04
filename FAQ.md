# 常见问题（FAQ）

面向玩家与二次开发者。玩法规则本身的问题请看 [docs/01-gameplay.md](docs/01-gameplay.md)。

---

## 玩与运行

**Q：线上地址是什么？会和代码一起更新吗？**
A：<https://lpk3215.github.io/salami-legion/>。它由 GitHub Pages **经典模式**托管，
发布源是 `main` 分支的**仓库根目录**，所以 `git push github main` 之后会自动构建发布，
不需要手动触发，也不依赖 GitHub Actions。

**Q：一定要装 Node 才能玩吗？**
A：不用。纯前端游戏，直接访问上面的线上地址即可。想离线跑也可以把仓库下载后双击
`index.html`（但见下一条），或用 `npm start` 起本地服务。

**Q：双击 `index.html` 打开后，金币和关卡进度保存不住？**
A：这是浏览器对 `file://` 协议下 `localStorage` 的限制，不是 bug。请改用本地服务：

```bash
npm start            # 默认 http://localhost:8080
PORT=3000 npm start  # 8080 被占用时换端口
```

（`server.js` 读取 `PORT` 环境变量，默认 8080，监听 `0.0.0.0`。）

**Q：这游戏要联网吗？有没有服务器 / 账号 / 排行榜？**
A：不需要联网，**没有后端、没有数据库、没有账号体系**。地图上的其它军团是 AI。
进度只存在你自己浏览器的 `localStorage` 里，因此换浏览器 / 清缓存 / 用无痕模式都会看不到进度。

**Q：存档存在哪里？怎么清掉？**
A：`localStorage` 的键 `mini_legion_save_v1`。想清空：主菜单最下方的「清空存档」按钮（有二次确认）。

**Q：手机 / 平板怎么操作？**
A：**按住屏幕任意位置**会出现虚拟摇杆，拖动方向即移动方向，拖得越远走得越快，松手即停；
右下角圆形按钮放技能，可与摇杆多指同时操作。不习惯摇杆的话，主菜单「操作」里可切换为
「跟随手指 / 指针：点哪走哪」。完整设计与参数见 [docs/05-controls-and-layout.md](docs/05-controls-and-layout.md)。

**Q：暂停有几种方式？切到后台会怎样？**
A：`Esc`、`P`，或点右上角按钮。切到后台会自动暂停，回来不会"一放手发现军团没了"。

---

## 玩法与数值

**Q：为什么我冲上去对方没有立刻被吞掉？**
A：这就是本作和同类游戏的**核心差异**。两支军团接触后不会一次性吞并整队，而是
**每 0.32 秒转移 1 个单位**（取值来自 `js/config.js` 的 `CFG.eat.interval`），
逐个持续消耗直到一方清零。所以"什么时候冲、什么时候撤"才是这游戏的技术含量。

**Q：关卡模式和无尽模式有什么区别？**
A：都是"一次挑战 = 先选技能与开局人数，然后连续闯关"，中途靠三选一奖励变强，失败则本次挑战结束（金币保留）。
区别在于关卡挑战是主线 **13 关**打完通关；无尽挑战**没有终点**，每层目标人数递增、敌军更多更强、
棋盘逐层扩大。全部数值差异见 [docs/02-modes.md](docs/02-modes.md)。

**Q：现在的量有多少？**
A：主线 13 关、6 个技能、7 种本局增益、4 档开局人数、10 款皮肤、14 个成就（取自 `js/config.js` 实测计数）。

**Q：能不能改吞噬节奏 / 关卡数值？**
A：可以，数值真源是 `js/config.js`，加内容的教程在 [docs/04-development.md](docs/04-development.md) 第 4 节。
但改完请把 `docs/02`、`docs/03` 与 `README.md` 里对应的描述一并同步（见 [CONTRIBUTING.md](CONTRIBUTING.md)）。

---

## 改名 / 存档 / 版本

**Q：项目从《小人军团吞噬战》改名为《蚕食军团》，我的存档会丢吗？**
A：**不会。** 存档键名 `mini_legion_save_v1` 与产品名是**刻意解耦**的，更名时没有动它。
反过来说：如果哪天有人"顺手"把存档键改成 `salami_legion_save_v1`，那才会让所有玩家的
金币、关卡进度、皮肤、成就瞬间清零 —— 这条红线写在 [CONTRIBUTING.md](CONTRIBUTING.md) 第 3 节。

**Q：仓库名为什么是 `salami-legion`？**
A："蚕食"的英文对应说法就是 salami tactics（切香肠式一点点割取），游戏领域这个叫法基本没有占用，
且短、好念、好拼 —— 部署到 Pages 后网址是 `用户名.github.io/仓库名/`，短名字更适合分享。

**Q：`package.json` 里为什么是 `"private": true`？**
A：这是**故意的**：本项目是浏览器游戏，不是 npm 库，`private: true` 防止被误发布到 npm registry。
它不影响 GitHub、Pages 或 `npm install` / `npm test`。

**Q：为什么 `package-lock.json` 也要提交？**
A：为了测试环境可复现 —— 端到端测试依赖 `jsdom`，锁版本能保证不同人跑的是同一套行为。
锁文件是生成物，不要手工编辑（`.gitattributes` 里也已把它标记为 `linguist-generated -diff`）。

---

## 开发与环境

**Q：`npm test` 偶尔报「应为多帧逐个消耗，而非一次性吞并」，是我改坏了吗？**
A：不一定是。该用例依赖帧推进时序，主干代码实测也存在约 **2/6** 概率的失败（同一断言）。
先重跑两三次：如果重跑能过，且你没碰 `CFG.eat.interval` 与吞噬相关逻辑，那就是抖动。
判定与处置方式见 [CONTRIBUTING.md](CONTRIBUTING.md) 第 6 节。

**Q：为什么线上点 `docs/xxx.md` 显示的是 Markdown 源码而不是渲染结果？**
A：因为根目录放了 `.nojekyll`，Pages 不再用 Jekyll 渲染，`.md` 会原样返回。
这是**有意的取舍**：禁用 Jekyll 才能保证下划线开头的文件不被忽略、花括号不被误解析、
静态资源按原样发布。想读渲染后的文档，请在 GitHub 仓库页面里看。

**Q：能不能引入框架 / 打包器 / CDN 库 / 图片素材？**
A：默认不能。运行时零依赖是这个项目的定位（无框架、无构建、音效由 WebAudio 合成、
贴图由 Canvas 程序绘制）。确实需要的话，请先开 Issue 讨论。

**Q：`server.js` 能直接对外提供生产服务吗？**
A：它只是个零依赖静态服务器（含目录穿越防护与 `/healthz`），设计用途是本地预览与
CNB 云开发环境。对外生产部署请走 Pages 或任意静态托管；自托管时建议自行补
`Content-Security-Policy` 等响应头（详见 [SECURITY.md](SECURITY.md)）。

**Q：`.cnb.yml` 是干什么的？**
A：CNB 云原生开发环境的配置：打开 WebIDE 时由 `CNB_WELCOME_CMD` 自动执行
`scripts/start.sh` 拉起服务，并通过 `$CNB_VSCODE_PROXY_URI` 端口网关转发到浏览器。
不用 CNB 的话可以完全忽略它。

**Q：README 里的架构图 / 机制图是怎么来的？改了代码要手改图吗？**
A：不用手改。三张 SVG 由 `scripts/visualization/` 下的生成器产出，图里的每一个数字
（文件行数、关卡/技能/皮肤/成就数量、`CFG.eat.interval`、地图尺寸、存档键、版本号、主题色）
都是运行时从 `js/config.js`、`package.json`、`css/style.css`、`test/dom.test.js` 读出来的。
改完代码跑一句即可重新生成：

```bash
npm run docs:svg
```

生成器只用 Node 内置模块（`node:fs` / `node:path` / `node:vm`），不需要装任何东西。

**Q：为什么有的徽章是动态的，有的写死在 README 里？**
A：能用 shields.io 动态端点的都用（`version`、top language、`jsdom` 版本、commit activity，
它们实时读仓库）。目前只有两个写死：`license` 和 `runtime deps 0`。前者的真源是 [LICENSE](LICENSE)，
后者的真源是 `package.json` 里**根本没有 `dependencies` 字段**（只有 `devDependencies`）。
取舍原则是：宁可用一个带真源可追溯的写死值，也不用一个当下会取错值的动态端点
（例如 `github/license/…` 在 `LICENSE` 推上远端之前只会返回 “not specified”）。

**Q：为什么不把游戏截图放进仓库？**
A：因为项目现在仓库内**零二进制文件**（画面 Canvas 绘制、音效 WebAudio 合成），这是个有意保持的性质。
所以 README 里的截图位置用了 `<!-- TODO: 截图待补充 -->` 占位而不塞 PNG；想直接看画面请走
[在线试玩地址](https://lpk3215.github.io/salami-legion/)。

## 两个页面

**Q：仓库根目录的 `index.html`（游戏）与 `project_overview/`（全景观览）到底哪个才是首页？**
A：**首页一定是游戏**。Pages 的发布源是仓库根，所以 `https://…/salami-legion/` 打开就是可玩本体；
介绍页住在 `https://…/salami-legion/project_overview/` 这个深链上。理由很直白：
别人拿到你的链接，第一动作是“玩”而不是“读”；把不可玩的页面放根部，等于在玩家和设备之间
多插一道必须再点一次的门。另外介绍页依赖 Google Fonts 与 Chart.js（CDN），
而游戏本体零依赖必定能跑 —— 门面不能建在有外链可用性的地基上。

**Q：那两边怎么互相去？**
A：已经双向打通。游戏主菜单底部「项目介绍」→ 新标签打开览页（**不丢当前进度**，弹屏被拦则当页跳转）；
览页的 Hero 与正文中段「立即开玩」→ 游戏本体。两边均用**相对路径**，子路径部署不会 404。

**Q：我能把根目录换成介绍页吗？**
A：技术上能（Pages 源就是仓库根，把介绍页资源平铺到根即可），但不建议，理由同上。
而且那样做会连带破坏 `CONTRIBUTING.md` 第 7 节与 `docs/04` 里关于“根目录 `index.html` 是入口”的约定，
以及 `project_overview.html` 这个跳转入口的定位。

---

## 许可与署名

**Q：可以商用 / 二次分发 / 换皮上架吗？**
A：许可证是 [MIT](LICENSE)，允许商用、修改、再分发，唯一要求是**保留版权声明与本许可声明**
（见 `LICENSE` 与 [AUTHORS](AUTHORS)）。但请注意：换皮上架仍可能涉及应用商店政策与
他人商标问题，那部分不在本许可证授予范围内。

**Q：素材有版权风险吗？**
A：没有外部素材。画面全部由 Canvas 程序绘制，音效全部由 WebAudio 实时合成，
仓库里不含图片与音频文件，因此不存在第三方素材授权问题。
