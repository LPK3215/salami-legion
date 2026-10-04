# 开发者文档

> 面向要改代码的人：架构、文件职责、引擎 API、怎么加内容、怎么测、怎么部署。

---

## 1. 技术栈与设计取舍

| 项 | 选择 | 原因 |
|---|---|---|
| 前端 | 原生 HTML + CSS + ES6 | 零构建、零依赖，双击 `index.html` 就能跑 |
| 渲染 | Canvas 2D | 同屏可能有上千个小人，DOM 撑不住 |
| 音效 | WebAudio 实时合成 | 不需要任何音频素材文件 |
| 存档 | localStorage | 纯前端，无需服务端 |
| 服务 | Node 零依赖静态服务器 | 只为把静态文件用 http 提供出去，方便预览 |
| 测试 | Node + jsdom | 无头环境里真实执行页面脚本、真实点击 DOM |

没有框架、没有打包器、没有后端、没有数据库。修改 JS 后刷新页面即可生效。

---

## 2. 目录结构

```
.
├── index.html              所有界面（9 个 screen 区块 + HUD）
├── css/style.css           全部样式
├── js/
│   ├── config.js           配置与数据：CFG / 关卡 / 技能 / 增益 / 皮肤 / 成就 / 无尽规则
│   ├── save.js             存档读写（localStorage）
│   ├── audio.js            音效合成（振荡器）
│   ├── engine.js           核心引擎：Game 类、军团、战斗、AI、渲染
│   └── ui.js               界面与流程控制：UI 对象
├── server.js               零依赖静态服务器
├── scripts/
│   ├── start.sh            幂等启动脚本（供 CNB_WELCOME_CMD 调用）
│   └── visualization/      文档图表与览页数据生成器（仅用 Node 内置模块）
├── test/dom.test.js        jsdom 端到端测试
├── project_overview/       项目全景观览页（仪表盘）
├── project_overview.html   根目录入口跳转页
├── .cnb.yml                CNB 云开发环境配置（自动启动服务）
└── docs/                   本套文档 + 三张生成的 SVG
```

脚本加载顺序（`index.html` 底部）**不能改**：
`config.js → save.js → audio.js → engine.js → ui.js`。
`const` 声明在经典 script 中共享全局词法环境，后面的文件依赖前面的全局常量。

---

## 3. 引擎架构（`js/engine.js`）

整体是一个 IIFE，向 window 暴露两个东西：

```js
window.MiniGame   // Game 类
window.GameUtils  // { SLOTS, blobRadius, makeSprite, clamp, rnd }
```

### 3.1 核心类

#### `Legion`（军团）
| 成员 | 说明 |
|---|---|
| `units[]` | 单位数组，每个单位是 `{x, y, vx, vy, ph, flash, temp, L}`；`L` 指回所属军团 |
| `cx, cy, cvx, cvy` | 军团中心（「指挥官」）位置与速度 |
| `target` | 该军团要去的世界坐标点 |
| `radius` | 由人数算出的圆盘半径 `blobRadius(count)` |
| `fx{}` | 当前生效的技能效果 `{ 技能id: 剩余秒数 }` |
| `skillCd` | 技能冷却剩余时间 |
| `ai` | AI 参数 `{c, sp, ag, react, t}`，为 `null` 表示不受 AI 驱动 |
| `sprites[]` | 预渲染精灵（炫彩皮肤是 7 张循环） |
| `alive` | 是否存活 |

#### `Game`（对局实例）
构造函数：

```js
new MiniGame({
  canvas,          // HTMLCanvasElement
  minimap,         // 可选，小地图 canvas
  level,           // 关卡配置对象
  levelIndex,      // 关卡下标（无尽模式传 -1）
  world,           // 可选 {w, h}，不传则用 CFG.world
  run,             // { mode, skillId, startCount, buffs, ... }
  hooks,           // 回调集合，见下
})
```

**回调（hooks）**

| 回调 | 参数 | 触发时机 |
|---|---|---|
| `onHud(data)` | 见下 | 每 ~0.1 秒推送一次，用于刷新 HUD |
| `onWin(res)` | 结算结果 | 达成目标 |
| `onLose(res)` | 结算结果（含 `reason`） | 我方人数归零 |
| `onInput()` | — | 玩家首次触摸/点击（用于解锁音频） |
| `onLegionDown(legion)` | 被消灭的军团 | 某支敌军被吃光 |

`onHud` 数据结构：
```js
{ count, peak, goalText, progress, time,
  enemyCount, enemies: [{ name, body, count, threat }],
  skillCd, skillCdMax }
```

`onWin/onLose` 结果数据结构：
```js
{ win, levelId, levelName, endless, stage, levelIndex,
  stars, time, coin, count, peak, eaten, lost,
  flawless, comeback, enemiesLeft, reason? }
```

**对外方法**：`start()` / `pause()` / `resume()` / `destroy()` / `useSkill()` / `resize()`

### 3.2 每帧更新顺序（`update(dt)`）

```
1. updateControl()    把玩家输入（指针/键盘）转成 player.target
2. 对每个军团：
     aiThink()         AI 决策（有节流，不是每帧都算）
     updateLegion()    算速度修正 → 移动军团中心 → 单位跟随编队 → 临时援军到期
3. buildUnitGrid()    把所有单位塞进空间网格（格子 46px）
4. updateNeutrals()   中立小人游荡 + 被收编判定（查 3×3 邻域网格）
5. updateCombat()     军团两两接触判定 + 逐个吞噬
6. updateFx()         技能计时、冷却
7. updateParticles()  粒子与飘字
8. updateCamera()     镜头跟随、缩放、危险度
9. spawnNeutral()     按需补充中立小人
10. pushHud()         节流推送 HUD
11. checkGoal()       判定胜负
```

### 3.3 战斗核心：逐个单位吞噬

```js
// updateCombat() 摘录
if (d2 > reach * reach) { pairTimers.set(key, EAT_INTERVAL); continue; }  // 脱离接触 → 计时器复位
if (A.count === B.count) continue;                                        // 势均力敌不吞噬
let t = pairTimers.get(key) ?? EAT_INTERVAL;
t -= dt;
if (t > 0) { pairTimers.set(key, t); continue; }                          // 未到吞噬节拍
const big = A.count > B.count ? A : B;
const small = A.count > B.count ? B : A;
pairTimers.set(key, EAT_INTERVAL / atkRate);                              // 受「吞噬速度」影响
this.absorb(small, big);                                                  // 转移 1 个单位
```

**关键设计点**：
- `pairTimers` 是**按军团对（pair）维护**的 Map，所以一个军团同时接触多支敌军时，
  每一对都独立按自己的节奏消耗。
- 脱离接触会把该对的计时器**重置为满**，所以「跑掉再回来」不会带着半个节拍，这是逃生机制成立的基础。
- `absorb()` 挑的是**最靠近接触点**的单位（前线），受击效果更自然。
- 想让吞噬更快/更慢，改 `CFG.eat.interval` 即可（全局），或通过 `atkRate` 做局部调整。

### 3.4 编队与移动

- 站位表 `SLOTS` 在模块加载时用**黄金角螺旋**预生成（最多 900 个位置），
  所以单位下标 `i` 直接对应一个固定站位，增减单位时军团会自然「重新收紧」。
- 军团中心是独立运动的「指挥官」，单位用**指数平滑**追自己的站位（`k = 1 - exp(-11*dt)`），
  落后越多追得越快（最高 `CFG.move.unitMax`）。
- 速度修正集中在这一段：

```js
let speedMul = 1;
if (L.ai) speedMul *= L.ai.sp;
if (L.ai && L.count < player.count * 0.75) speedMul *= CFG.move.panic;   // 弱势敌军惊慌
if (L.isPlayer && L.hasFx('rush'))         speedMul *= 1 + rushSpeed;
if (L.isPlayer)                            speedMul *= 1 + buff.speed;
speedMul *= 1 - min(0.12, count * 0.003);                                 // 人多变慢
if (L.isPlayer)                            speedMul *= CFG.move.playerBonus;
```

### 3.5 渲染

- 小人用**预渲染精灵**（`makeSprite(body, style)`，按 `颜色|造型` 缓存），每帧只是 `drawImage`。
- 只绘制视口内的对象（`viewRect()` 粗筛）。
- 绘制顺序：地面网格 → 装饰 → 中立小人 → 军团（按人数排序，玩家最后画以保证在最上层）→ 接触光圈 → 粒子 → 飘字 → 边界 → 危险暗角 → 追猎箭头 → 小地图。
- 屏幕震动（`this.shake`）只在战斗时生效。

---

## 4. 怎么加内容

### 4.1 加一个主线关卡

在 `js/config.js` 的 `LEVELS` 数组里插入一项：

```js
{
  id: 14,                          // 关卡序号（决定解锁顺序与星级存档 key）
  name: '新关卡名',
  goal: { type: 'reach', val: 160 } // 或 { type: 'eliminate' }
  neutral: 340,                    // 地图中立小人数量
  par: 130, gold: 95,              // 两星线 / 三星线（秒）
  coins: 130,                      // 基础金币
  enemies: [
    { c: 30, sp: 1.0, ag: 0.6, react: 0.4 }   // c=开局人数 sp=速度倍率 ag=好斗度 react=反应间隔(s)
  ],
  tip: '关卡提示文案',
}
```

> `id` 必须与数组顺序保持一致（`LEVELS[id-1]` 的用法在跳关逻辑里存在）。

### 4.2 加一个技能

1. 在 `js/config.js` 的 `SKILLS` 里加定义（`levels` 必须是 3 项）：

```js
teleport: {
  id: 'teleport', name: '瞬移', badge: '瞬', color: '#5ce1e6',
  cd: 30, unlockAfter: 9,
  levels: [
    { dur: 3, desc: '3 秒内……' },
    { dur: 4, desc: '4 秒内……' },
    { dur: 5, desc: '5 秒内……' },
  ],
}
```

2. 把 id 加进 `SKILL_LIST`（决定出征准备页的展示顺序）。
3. 在 `engine.js` 的 `useSkill()` 里实现效果；如果效果是**持续型**，就写进 `p.fx[id] = 秒数`，
   然后在 `updateLegion()` / `updateNeutrals()` 里读 `L.hasFx('teleport')` 生效。

UI（准备页卡片、HUD 按钮）会自动跟着 `SKILL_LIST` 渲染，不用改 HTML。

### 4.3 加一个本局增益

在 `js/config.js` 的 `BUFFS` 里加一项（`stat` 是累加键名）：

```js
{ id: 'giant', name: '巨人化', stat: 'speed', val: 0.05, max: 3, desc: '移动速度 +5%' },
```

如果 `stat` 是新的键名，记得在 `engine.js` 的 `computeBuffs()` 返回对象里加上初始值，
并在需要的地方使用它。三选一奖励卡会自动从 `BUFFS` 生成。

### 4.4 加一款皮肤

`js/config.js` 的 `SKINS` 里加一项，`style` 可选：
`plain` / `cap` / `glasses` / `ninja` / `horn` / `crown` / `helmet` / `rainbow`。
若要新造型，在 `engine.js` 的 `makeSprite()` 里加一个 `if (style === 'xxx')` 分支画上去。

### 4.5 加一个成就

`js/config.js` 的 `ACHIEVEMENTS` 里加一项，`check(s)` 收到的是存档对象：

```js
{ id: 'speedrun', name: '闪电战', desc: '30 秒内通关任意关卡', coins: 200,
  check: s => s.stats.fastestWin > 0 && s.stats.fastestWin <= 30 },
```

若需要新的统计字段，在 `js/save.js` 的 `defaultSave().stats` 里加上默认值
（`Save.merge()` 会自动补全老存档）。

---

## 5. 无尽模式的实现（没有「层」，一场打到底）

无尽模式的关卡对象**只有一个**，由 `js/config.js` 的 `makeEndlessLevel()` 生成
（结构与主线关卡一致，额外带 `endless: true`、`goal: { type: 'endless', step: 50 }`，
外加随规模变化的 `world`）。

### 里程碑 = 暂停，不是过关

- 引擎里多了一个状态：`status = 'playing' | 'paused' | 'milestone' | 'over'`。
  `milestone` 期间 `update()` 直接返回，**对局冻结但 `Game` 实例继续存活**。
- `checkGoal()` 对 `goal.type === 'endless'` 只做一件事：
  人数 `>= this.nextMilestone` 时调用 `reachMilestone()`（不再有 `win()`）。
- `reachMilestone()`：`milestones++`、`nextMilestone += step`、`releaseInput()`、
  `expandEndlessWorld()`、`buildResult(true)` 并回调 `hooks.onMilestone(res)`。
- `resumeFromMilestone()`：重算 `this.buff = computeBuffs(run.buffs)`、恢复 `playing`、
  重置 `lastT`。**这就是「人数不重置」的实现方式** ——
  UI 侧 `nextLevel()` 在无尽模式下不新建 `Game`，而是调用这个方法回到同一场对局。
- 里程碑奖励走的是同一套 `rollRewards()`，只是传 `{ endless: true }`：
  技能卡权重调高、去掉「解锁开局人数」卡。

### 难度递增（不按层，按人数 + 时间）

- `endlessRamp()` 每秒执行一次：
  - 敌军支数对齐 `min(2 + ⌊峰值人数/45⌋, 7)`，阵亡后自动补位（`spawnEndlessEnemy()`）；
  - 每支敌军按 `endlessEnemyTarget(pop, time, i, n)` 增援到目标人数（离玩家 520px 内不刷，避免凭空冒兵）；
  - 统一刷新 `ai.ag / ai.react / ai.sp`（`endlessEnemyStats(pop)`），并同步 `this.aiCap`；
  - 中立小人目标量随规模上涨。
- `expandEndlessWorld()` 在每个里程碑扩棋盘（只补新区域的装饰物；
  中立小人由常规的 `spawnNeutral` 缺额补充逻辑自动铺到新区域）。
- `Game` 内部所有地图边界都读 `this.world`，所以运行中改 `world.w/h` 是安全的。

### 记录

无尽模式不写星级，只更新 `Save.data.stats.endlessBest` = **单局最高人数**。

要调整无尽曲线，只改 `js/config.js` 里的 `ENDLESS` 常量与三个纯函数
（`endlessWorldFor` / `endlessEnemyTarget` / `endlessEnemyStats`）即可
（详见 [02-modes.md](02-modes.md#2-模式二无尽挑战没有层一场打到底)）。

---

## 6. 测试

### 端到端测试（推荐日常用）

```bash
npm install     # 首次需要装 jsdom
npm test
```

`test/dom.test.js` 会：
1. 用 jsdom 加载**真实 `index.html`**
2. 按 `<script>` 顺序执行全部游戏脚本
3. 打桩 Canvas（jsdom 没有绘图能力）
4. 模拟真实用户点击：遍历主菜单、关卡选择、商店、成就、说明、出征准备
5. 进入对局后验证：滑动控制、收编中立小人、**逐个吞噬（正向与反向）**、
   技能释放、暂停/继续、通关结算、三选一、关卡推进、
   **无尽模式里程碑（50 人暂停三选一 → 同一场对局继续、人数不重置、棋盘扩大）**、
   失败流程、商店购买、存档持久化
6. 捕获任何 jsdom 运行期 JS 错误，一旦出现即判定失败

当前规模（由 `scripts/visualization/lib_load_facts.mjs` 统计，可用 `npm run overview:data` 重算）：
**17 段流程 · 113 处断言调用点 · 39 项界面校验**。全部通过时最后一行输出 `全部通过 ✓`。

> 依赖时间的用例（逐个吞噬、反向吞噬、收编中立小人、无尽里程碑）统一走
> `ticks(game, n, dt)` **固定步长推进**，不再依赖 `requestAnimationFrame` 的墙钟步长，
> 因此不会随机器负载抖动。详见 [../CONTRIBUTING.md](../CONTRIBUTING.md) 第 6 节。

### 引擎压力/平衡模拟

引擎可以完全脱离 DOM 运行（`Game` 只依赖传入的 canvas 打桩）。
典型用法是批量跑对局统计胜率，用来验证关卡难度：

```js
const g = new MiniGame({
  canvas: stubCanvas, level, levelIndex, world: level.world,
  run: { mode:'campaign', skillId:'rush', startCount:3, buffs:{} },
  hooks: { onHud(){}, onWin(r){ done(r); }, onLose(r){ done(r); }, onLegionDown(){}, onInput(){} },
});
for (let f = 0; f < 9000 && !done; f++) { g.update(1/60); g.render(1/60); }
```

调试小技巧：`update()` 内部有 `status !== 'playing'` 守卫，
所以模拟时若对局已结束（通关/失败），后续 `update()` 不会再推进。

### 浏览器内调试

页面脚本的全局对象在浏览器控制台里可直接访问（经典 script 的顶层 `const` 属于全局词法环境）：

```js
UI.game.player.count        // 我方人数
UI.game.legions             // 全部军团
UI.game.neutrals.length     // 中立小人数量
UI.game.player.addUnit(UI.game.player.cx, UI.game.player.cy)   // 手动加人
Save.data                   // 存档对象
Save.reset()                // 重置存档
```

---

## 7. 运行与部署

### 本地

```bash
npm start                      # 或 node server.js / PORT=9000 node server.js
```

服务器特性：`0.0.0.0` 监听、`/healthz` 健康检查、正确 MIME、防目录穿越、缺失文件返回真实 404。

### CNB 云原生开发环境

1. `.cnb.yml` 声明了 `vscode` 事件，并在 `env.CNB_WELCOME_CMD` 里执行 `bash /workspace/scripts/start.sh`
   —— 进入开发环境时自动把服务拉起来（幂等，已在运行则跳过）。
2. `scripts/start.sh` 启动后会打印预览地址，它由环境变量 `CNB_VSCODE_PROXY_URI`
   把 `{{port}}` 替换成实际端口得到，形如 `https://xxxx-8080.cnb.run`。
3. 手动启动/重启：

```bash
bash scripts/start.sh          # 幂等启动 + 健康检查 + 打印预览地址
cat .server.pid                # 查看进程号
tail -f .server.log            # 查看日志
```

> 服务必须监听 `0.0.0.0`，监听 `127.0.0.1` 或 `localhost` 时 CNB 网关无法转发。

---

## 8. 性能与已知限制

| 项 | 说明 |
|---|---|
| 单位上限 | 单军团 900（`CFG.maxUnits`，同时是站位表容量），全局约 1800 |
| 同屏绘制 | 每帧对可见单位各一次 `drawImage`；800 单位在桌面端流畅，低端移动端建议控制在 300 以内 |
| 空间网格 | 格子 46px，只用于「中立小人收编」查询；军团间战斗是 O(军团数²)，军团数 ≤ 8，可忽略 |
| 单位间碰撞 | 不做单位级别的互相碰撞，靠编队站位自然散开（性能取舍） |
| 音效 | 对 `join` / `eat` 做了最小间隔节流，避免密集触发时爆音 |
| 无后端 | 没有排行榜/云存档，所有进度只在本机浏览器 |

---

## 9. 改动后的自检清单

改完代码，按顺序过一遍：

1. `node --check js/*.js` —— 语法
2. `npm test` —— 29 项端到端断言是否全绿
3. 浏览器里实际玩一局：开局 → 吃人 → 打架（逐个吞噬）→ 通关 → 三选一 → 下一关
4. 若是数值改动，跑一轮批量模拟看胜率曲线是否还合理
