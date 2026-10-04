/**
 * 端到端 DOM 测试
 * 用 jsdom 加载真实 index.html，执行全部脚本，模拟用户点击所有界面，
 * 并验证核心玩法「逐个单位吞噬」、收编、通关奖励、暂停、失败等流程。
 *
 *   node test/dom.test.js      (或 npm test)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['js/config.js', 'js/save.js', 'js/audio.js', 'js/engine.js', 'js/ui.js'];

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const jsdomErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  // jsdom 未实现的 API 提示可忽略，真正的脚本运行时错误要捕获
  const msg = (e && e.message) || String(e);
  if (/Not implemented/i.test(msg)) return;
  jsdomErrors.push(msg);
});
vc.on('error', (...args) => jsdomErrors.push(args.join(' ')));
vc.on('warn', () => {});
vc.on('log', () => {});
vc.on('info', () => {});

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'http://localhost:8080/',
});
const { window } = dom;

/* ---------- Canvas 桩：jsdom 无绘图能力，用代理吞掉所有绘图调用 ---------- */
function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 20 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (p === 'createPattern') return () => ({});
      if (p === 'getImageData') return () => ({ data: new Uint8Array(4) });
      if (p === 'canvas') return { width: 1200, height: 800 };
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:,'; };

// jsdom 的 getBoundingClientRect 全为 0，给个像样的视口，保证相机/坐标换算走真实分支
const RECT = { left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800, x: 0, y: 0 };
window.HTMLElement.prototype.getBoundingClientRect = function () { return RECT; };

/* ---------- 测试脚本（在 window 上下文里执行，与页面脚本共享作用域） ---------- */
const harness = `
(async () => {
  // eval 的作用域与浏览器 <script> 不同，显式取出页面脚本暴露的全局
  const { UI, Save, LEVELS, SKINS, SKILLS, SKILL_LIST, START_OPTIONS, ACHIEVEMENTS,
          ENDLESS, endlessViewRadius, CFG, MiniGame } = window.__APP__;
  const log = [];
  const ok = (m) => log.push('  ✓ ' + m);
  const assert = (c, m) => { if (!c) throw new Error('断言失败: ' + m); };
  const $ = (id) => document.getElementById(id);
  const click = (el, m) => {
    if (!el) throw new Error('元素不存在: ' + m);
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  const active = (id) => { const e = $(id); return !!e && e.classList.contains('active'); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = (n) => new Promise((r) => {
    let i = 0;
    const step = () => { if (++i >= n) return r(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  // 固定步长推进模拟：rAF 的真实步长在不同机器上波动很大，
  // 会让「逐个吞噬」这类依赖时间的断言变得随机，这里用固定 dt 保证可复现。
  // 同时调用 render（镜头跟随/缩放是在 render 里推进的），否则镜头会停在旧位置，
  // 「屏幕坐标 → 世界坐标」这类断言就会失真。
  const ticks = (game, n, dt) => {
    const d = dt || 0.02;
    for (let i = 0; i < n; i++) { game.update(d); game.render(d); }
  };

  try {
    /* ========== 1. 等待 load，等同一个真实浏览器页面 ========== */
    if (document.readyState !== 'complete') {
      await new Promise((r) => window.addEventListener('load', r, { once: true }));
    }

    /* ========== 2. 初始化与各页面 ========== */
    UI.init();
    assert(active('screen-menu'), '初始化后应展示主菜单');
    assert(document.querySelectorAll('.js-coins').length >= 4, '金币显示位');
    ok('主菜单渲染，金币位:' + document.querySelectorAll('.js-coins').length);

    click($('btn-levels'), 'btn-levels');
    assert(active('screen-levels'), '未切换到关卡选择页');
    const cells = document.querySelectorAll('#level-grid .level-cell');
    assert(cells.length === LEVELS.length, '关卡数应为 ' + LEVELS.length + '，实际 ' + cells.length);
    assert(document.querySelectorAll('#level-grid .level-cell.locked').length === LEVELS.length - 1, '初始应只解锁第 1 关');
    ok('关卡选择页：' + cells.length + ' 关，初始仅第 1 关解锁');
    click($('btn-levels-back'), 'btn-levels-back');
    assert(active('screen-menu'), '返回主菜单失败');

    click($('btn-shop'), 'btn-shop');
    assert(active('screen-shop'), '未切换到商店');
    assert(document.querySelectorAll('#skin-grid .skin-cell').length === SKINS.length, '皮肤数应为 ' + SKINS.length);
    assert(document.querySelectorAll('#skin-grid .skin-cell.using').length === 1, '应恰有 1 款皮肤处于使用中');
    const buyBtn = document.querySelector('#skin-grid .btn-mini.buy');
    ok('商店页：' + SKINS.length + ' 款皮肤，均可购买按钮渲染');
    click($('btn-shop-back'), 'btn-shop-back');

    click($('btn-achv'), 'btn-achv');
    assert(active('screen-achv'), '未切换到成就页');
    assert(document.querySelectorAll('#achv-list .achv-row').length === ACHIEVEMENTS.length, '成就数应为 ' + ACHIEVEMENTS.length);
    ok('成就页：' + ACHIEVEMENTS.length + ' 个成就');
    click($('btn-achv-back'), 'btn-achv-back');

    click($('btn-help'), 'btn-help');
    assert(active('screen-help'), '未切换到说明页');
    click($('btn-help-back'), 'btn-help-back');
    ok('玩法说明页');

    /* ========== 3. 出征准备 ========== */
    click($('btn-start'), 'btn-start');
    assert(active('screen-prep'), '未切换到出征准备页');
    const optEls = document.querySelectorAll('#start-options .opt-btn');
    const skillEls = document.querySelectorAll('#skill-picker .skill-card');
    assert(optEls.length === START_OPTIONS.length, '开局人数选项数应为 ' + START_OPTIONS.length);
    assert(skillEls.length === SKILL_LIST.length, '技能卡数应为 ' + SKILL_LIST.length);
    ok('出征准备页：' + optEls.length + ' 种开局人数 / ' + skillEls.length + ' 个技能');

    // 首次渲染就应带默认选中态（曾经缺失，为已修复的 bug）
    assert(document.querySelectorAll('#start-options .opt-btn.selected').length === 1,
      '开局人数首次渲染缺少默认选中态');
    assert(document.querySelectorAll('#skill-picker .skill-card.selected').length === 1,
      '技能首次渲染缺少默认选中态');
    ok('首次进入即正确显示默认选中态');

    // 锁定项点击应被拦截（默认只解锁 3 人）
    const lockedOpt = document.querySelector('#start-options .opt-btn.locked');
    assert(lockedOpt, '应存在未解锁的开局人数');
    click(lockedOpt, '锁定的人数选项');
    const afterLocked = document.querySelectorAll('#start-options .opt-btn.selected');
    assert(afterLocked.length === 1 && afterLocked[0] !== lockedOpt, '锁定项不应被选中');
    assert(document.querySelectorAll('#toast-wrap .toast').length >= 1, '锁定项点击应给出提示');
    ok('未解锁的开局人数点击被正确拦截并提示');

    // 已解锁技能可切换（注意选完会重渲染，需重新查询节点）
    const nameOf = (el) => el.querySelector('.sk-name').textContent.replace(/Lv\.\d|未解锁/g, '').trim();
    const name0 = nameOf(document.querySelectorAll('#skill-picker .skill-card')[0]);
    click(document.querySelectorAll('#skill-picker .skill-card')[1], '第 2 个技能');
    const skillEls2 = document.querySelectorAll('#skill-picker .skill-card');
    const selSkill = document.querySelectorAll('#skill-picker .skill-card.selected');
    assert(selSkill.length === 1 && selSkill[0] === skillEls2[1], '技能选中态未切换');
    ok('技能选中态切换正确（' + name0 + ' -> ' + nameOf(skillEls2[1]) + '）');

    /* ========== 4. 进入对局 ========== */
    click($('btn-prep-go'), 'btn-prep-go');
    await wait(220);
    assert(active('screen-game'),
      '未进入对局页面 [body.screen=' + document.body.dataset.screen +
      ' run=' + JSON.stringify(UI.run && { idx: UI.run.levelIndex, sk: UI.run.skillId }) +
      ' game=' + !!UI.game + ']');
    assert(UI.game, '游戏实例未创建');
    const g = UI.game;
    const startCount = g.player.count;
    assert(startCount >= 3, '开局人数异常: ' + startCount);
    assert(g.legions.length >= 2, '应存在敌军');
    assert(g.neutrals.length > 30, '中立小人过少: ' + g.neutrals.length);
    ok('进入对局：我方 ' + startCount + ' 人 / ' + (g.legions.length - 1) + ' 支敌军 / ' + g.neutrals.length + ' 个中立小人');

    // 关卡模式必须画出地图边界（正向对照：证明下面的「0 次」不是探针失灵）
    const countBounds = (game) => {
      let rects = 0, bigArcs = 0;
      const realRect = game.ctx.strokeRect, realArc = game.ctx.arc;
      game.ctx.strokeRect = function () { rects++; };
      game.ctx.arc = function (x, y, r) { if (r > 600) bigArcs++; };   // 大半径圆环（可能被误读成场地圈）
      game.render(0.016);
      game.ctx.strokeRect = realRect; game.ctx.arc = realArc;
      return { rects, bigArcs };
    };
    const bCamp = countBounds(g);
    assert(bCamp.rects === 1 && bCamp.bigArcs === 1,
      '关卡模式应绘制 1 条地图边界 + 1 个装饰圆环，实际 ' + bCamp.rects + ' / ' + bCamp.bigArcs);

    // 后面的移动/摇杆/键盘用例会让军团顺路收编中立小人，有可能提前撞到第 1 关目标（15 人）
    // 从而让对局提前结束、后续对局内断言全部失去意义。这里先把目标抬到不可能达到的值，
    // 到第 12 段要故意通关时再还原（原目标值由该段自己读取）。
    const reachGoal = g.level.goal.type === 'reach' ? g.level.goal.val : 0;
    if (reachGoal) g.level.goal.val = 99999;

    /* ========== 5. 滑动控制 ========== */
    const p = g.player;
    const p0 = { x: p.cx, y: p.cy };
    g.canvas.dispatchEvent(new window.MouseEvent('pointermove', { bubbles: true, clientX: 1100, clientY: 700 }));
    await frames(45);
    const moved = Math.hypot(p.cx - p0.x, p.cy - p0.y);
    assert(moved > 5, '滑动后军团未移动，位移=' + moved.toFixed(2));
    ok('滑动控制生效，位移 ' + moved.toFixed(1) + 'px');

    /* ========== 6. 虚拟摇杆（触屏主控） ========== */
    const mkPtr = (type, x, y, id, ptype) => {
      const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperty(ev, 'pointerId', { value: id });
      Object.defineProperty(ev, 'pointerType', { value: ptype });
      return ev;
    };

    // 第一根手指按下 → 出现摇杆
    g.canvas.dispatchEvent(mkPtr('pointerdown', 300, 400, 11, 'touch'));
    assert(g.stick.active === true, '触屏按下后摇杆未激活');
    assert(g.stick.pointerId === 11, '摇杆未绑定到该手指');
    assert(g.stick.originX === 300 || Math.abs(g.stick.originX - 300) < 1, '摇杆原点应出现在按下位置');
    assert(g.stick.axisX === 0 && g.stick.axisY === 0, '刚按下时不应产生方向');

    // 向右拖动 → 方向为右、力度 > 0
    g.canvas.dispatchEvent(mkPtr('pointermove', 430, 400, 11, 'touch'));
    assert(g.stick.axisX > 0.95 && Math.abs(g.stick.axisY) < 0.05,
      '摇杆方向计算错误: ' + g.stick.axisX.toFixed(2) + ',' + g.stick.axisY.toFixed(2));
    assert(g.stick.strength > 0.9, '摇杆力度应接近满值，实际 ' + g.stick.strength.toFixed(2));

    const stickFrom = { x: p.cx, y: p.cy };
    await frames(45);
    assert(p.cx - stickFrom.x > 8, '摇杆未推动军团向右，位移 ' + (p.cx - stickFrom.x).toFixed(1));
    assert(g.lastInput === 'stick', '输入来源应标记为 stick');
    ok('虚拟摇杆生效：拖动方向 ' + (g.stick.axisX > 0 ? '右' : '?') +
       '，力度 ' + g.stick.strength.toFixed(2) + '，军团位移 ' + (p.cx - stickFrom.x).toFixed(1) + 'px');

    // 多指：第二根手指不能抢走摇杆，也不影响方向
    g.canvas.dispatchEvent(mkPtr('pointermove', 430, 400, 11, 'touch'));
    const axisBefore = { x: g.stick.axisX, y: g.stick.axisY };
    g.canvas.dispatchEvent(mkPtr('pointerdown', 200, 600, 22, 'touch'));
    g.canvas.dispatchEvent(mkPtr('pointermove', 120, 600, 22, 'touch'));
    assert(g.stick.pointerId === 11, '第二根手指抢走了摇杆，实际绑定到 ' + g.stick.pointerId);
    assert(g.stick.axisX === axisBefore.x && g.stick.axisY === axisBefore.y, '第二根手指改变了摇杆方向');
    ok('多指互不干扰：第二根手指无法抢走摇杆');

    // 多指同时操作：摇杆按住时点技能按钮依然有效
    p.skillCd = 0;
    click($('btn-skill'), 'btn-skill（摇杆按住时）');
    assert(p.skillCd > 0, '摇杆按住时技能按钮失效');
    assert(g.stick.pointerId === 11 && g.stick.active, '点技能后摇杆状态被破坏');
    ok('多指同时操作：摇杆 + 技能按钮可同时使用');

    // 松手停下（军团有平滑加速度，允许少量惯性，但必须迅速收敛）
    window.dispatchEvent(mkPtr('pointerup', 430, 400, 11, 'touch'));
    assert(g.stick.active === false && g.stick.pointerId === null, '松手后摇杆状态未复位');
    await frames(4);
    const stopFrom = { x: p.cx, y: p.cy };
    await frames(40);
    const drift = Math.hypot(p.cx - stopFrom.x, p.cy - stopFrom.y);
    const heldMove = Math.max(1, p.cx - stickFrom.x);
    assert(drift / heldMove < 0.25,
      '松手后应迅速停下，残余位移 ' + drift.toFixed(1) + 'px（按住时 ' + heldMove.toFixed(1) + 'px）');
    ok('摇杆松手迅速停下：按住时位移 ' + heldMove.toFixed(1) + 'px → 松手后残余惯性 ' + drift.toFixed(1) + 'px');

    // 死区：全新一次触摸下，轻微抖动不产生移动，拉出死区立即响应
    g.canvas.dispatchEvent(mkPtr('pointerdown', 600, 400, 12, 'touch'));
    g.canvas.dispatchEvent(mkPtr('pointermove', 606, 402, 12, 'touch'));
    assert(g.stick.strength === 0, '死区内不应产生力度，实际 ' + g.stick.strength);
    assert(g.stick.axisX === 0 && g.stick.axisY === 0, '死区内不应产生方向');
    g.canvas.dispatchEvent(mkPtr('pointermove', 660, 400, 12, 'touch'));
    assert(g.stick.strength > 0 && g.stick.axisX > 0.9, '离开死区后应立即产生方向');
    window.dispatchEvent(mkPtr('pointerup', 660, 400, 12, 'touch'));
    ok('摇杆死区生效（轻微抖动不移动，拉出死区立即响应）');

    /* ========== 7. 键盘操作（WASD / 方向键 / 斜向 / 快捷键） ========== */
    const key = (type, k) => window.dispatchEvent(new window.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));

    const kbFrom = { x: p.cx, y: p.cy };
    key('keydown', 'd');
    await frames(45);
    assert(p.cx - kbFrom.x > 8, 'D 键未让军团向右移动（位移 ' + (p.cx - kbFrom.x).toFixed(1) + '）');
    assert(g.lastInput === 'keys', '输入来源应标记为 keys');
    ok('键盘 D 键移动生效，位移 ' + (p.cx - kbFrom.x).toFixed(1) + 'px');

    key('keyup', 'd');
    await frames(4);
    const kbStop = { x: p.cx, y: p.cy };
    await frames(40);
    const kbDrift = Math.hypot(p.cx - kbStop.x, p.cy - kbStop.y);
    const kbHeld = Math.max(1, p.cx - kbFrom.x);
    assert(kbDrift / kbHeld < 0.25,
      '松开按键后应迅速停下，残余位移 ' + kbDrift.toFixed(1) + 'px（按住时 ' + kbHeld.toFixed(1) + 'px）');
    ok('键盘松开迅速停下：按住时位移 ' + kbHeld.toFixed(1) + 'px → 松手后残余惯性 ' + kbDrift.toFixed(1) + 'px');

    // 斜向：同时按住 W + D 必须保留两个方向
    key('keydown', 'w');
    key('keydown', 'd');
    assert(g.keys.x === 1 && g.keys.y === -1,
      '斜向组合键丢失方向，实际 x=' + g.keys.x + ' y=' + g.keys.y);
    key('keyup', 'w');
    key('keyup', 'd');
    assert(g.keys.x === 0 && g.keys.y === 0, '松开后方向未清零');
    ok('键盘斜向组合（W+D）正确保留两个方向');

    // 方向键等价于 WASD
    key('keydown', 'ArrowLeft');
    assert(g.keys.x === -1 && g.keys.y === 0, '方向键未生效');
    key('keyup', 'ArrowLeft');
    ok('方向键与 WASD 等价');

    // 快捷键：E 放技能、Esc 暂停
    p.skillCd = 0;
    key('keydown', 'e');
    assert(p.skillCd > 0, 'E 键未释放技能');
    key('keydown', 'Escape');
    assert(g.status === 'paused' && $('pause-overlay').classList.contains('active'), 'Esc 未暂停并显示遮罩');
    key('keydown', 'Escape');
    assert(g.status === 'playing' && !$('pause-overlay').classList.contains('active'), 'Esc 未继续游戏');
    ok('快捷键正常：E 放技能、Esc 暂停/继续');

    /* ========== 8. 收编中立小人 ========== */
    // 关闭指针托管，后续用 target 精确驱动（updateControl 每帧会覆盖 target）
    g.pointer.active = false;
    g.keys.x = 0; g.keys.y = 0;
    g.releaseInput();
    let best = null, bd = Infinity;
    for (let i = 0; i < g.neutrals.length; i++) {
      const N = g.neutrals[i];
      const d = (N.x - p.cx) ** 2 + (N.y - p.cy) ** 2;
      if (d < bd) { bd = d; best = N; }
    }
    p.target.x = best.x; p.target.y = best.y;
    const c0 = p.count;
    // 固定步长推进：一旦收编成功就停手，避免一路吃满触发通关、让后续断言失去对局环境
    for (let i = 0; i < 300 && p.count === c0 && g.status === 'playing'; i++) ticks(g, 1);
    assert(p.count > c0, '接近中立小人后人数未增长: ' + c0 + ' -> ' + p.count);
    assert(g.status === 'playing', '收编测试后对局应仍在进行，实际 ' + g.status);
    ok('中立小人可被收编：' + c0 + ' 人 -> ' + p.count + ' 人');

    /* ========== 9. 核心机制：逐个单位吞噬 ========== */
    // 隔离环境：清空中立小人，避免双方边打边收编干扰断言
    const savedNeutrals = g.neutrals;
    g.neutrals = [];
    g.legions.forEach((L) => { if (!L.isPlayer && L !== undefined) { L.clearUnits(); L.alive = false; } });
    // 前面的移动测试会让军团顺路收编中立小人，这里先压回安全人数，避免提前达成关卡目标
    while (p.count > 6) p.units.pop();

    const foe = g.legions.find((L) => !L.isPlayer);
    assert(foe, '找不到可用于测试的敌军团');
    foe.alive = true;
    foe.ai = null;                 // 固定不动，保证稳定接触
    foe.clearUnits();
    foe.cx = p.cx + 30; foe.cy = p.cy;
    foe.target.x = foe.cx; foe.target.y = foe.cy;
    for (let i = 0; i < 3; i++) foe.addUnit(foe.cx + i * 4, foe.cy);
    p.target.x = foe.cx; p.target.y = foe.cy;

    const beforeEat = p.count;
    const foeBefore = foe.count;
    const snapshots = [];
    for (let i = 0; i < 20; i++) {
      ticks(g, 20);
      snapshots.push({ foe: foe.count, me: p.count });
      if (foe.count === 0) break;
    }
    assert(foeBefore === 3, '测试敌军团初始应为 3 人');
    assert(foe.count === 0, '敌方应被杀光，实际剩 ' + foe.count + '（我方 ' + p.count + '）');
    assert(p.count === beforeEat + 3, '我方应恰好 +3 人（逐个并入），实际 ' + beforeEat + ' -> ' + p.count);
    const drops = snapshots.filter((s, i) => i > 0 && s.foe < snapshots[i - 1].foe).length;
    assert(drops >= 2, '应为多帧逐个消耗，而非一次性吞并，递减次数=' + drops);
    ok('逐个单位吞噬生效：敌 3 人 → 分 ' + drops + ' 次逐个并入我方，我方 ' + beforeEat + ' -> ' + p.count + ' 人');

    // 反向验证：我方人数劣势时应被逐个吞掉
    // 注意：人数必须低于本关目标（第 1 关为 15 人），否则会立刻通关导致主循环停止
    while (p.count < 12) p.addUnit(p.cx, p.cy);
    assert(p.count < (g.level.goal.val || 9999), '测试人数应低于关卡目标，避免提前通关');
    foe.clearUnits();
    foe.alive = true;
    foe.cx = p.cx + 30; foe.cy = p.cy;
    foe.target.x = foe.cx; foe.target.y = foe.cy;
    for (let i = 0; i < 20; i++) foe.addUnit(foe.cx + i * 2, foe.cy);
    p.target.x = foe.cx; p.target.y = foe.cy;

    const meBeforeLose = p.count;
    const foeBig = foe.count;
    let minMe = meBeforeLose;
    for (let i = 0; i < 6; i++) {
      ticks(g, 20);
      minMe = Math.min(minMe, p.count);
      // 验证的是「劣势会被逐个吞掉」，不是「一定被吞光」，留 4 人保底不触发失败流程
      if (g.status !== 'playing' || p.count <= 4) break;
    }
    assert(minMe < meBeforeLose, '人数劣势时应被敌方逐个吞掉，实际 ' + meBeforeLose + ' -> ' + minMe);
    assert(minMe > 0, '测试中我方不应全灭');
    ok('反向吞噬生效：敌 ' + foeBig + ' 人 > 我方 ' + meBeforeLose + ' 人，我方被逐个吞至 ' + minMe + ' 人');

    // 恢复环境（保持人数低于关卡目标，后续步骤再触发通关）
    g.neutrals = savedNeutrals;
    foe.clearUnits();
    foe.alive = false;
    while (p.count < 8) p.addUnit(p.cx, p.cy);
    assert(g.status === 'playing', '对局应仍在进行中，实际 ' + g.status);

    /* ========== 10. 技能释放 ========== */
    const cd0 = p.skillCd;
    click($('btn-skill'), 'btn-skill');
    assert(p.skillCd > 0 || Object.keys(p.fx).length > 0, '技能未生效');
    ok('技能释放成功：' + (SKILLS[g.run.skillId] ? SKILLS[g.run.skillId].name : '') + '，冷却 ' + p.skillCd.toFixed(1) + 's');

    /* ========== 11. 暂停 / 继续 ========== */
    click($('btn-pause'), 'btn-pause');
    assert(g.status === 'paused', '暂停失败');
    assert($('pause-overlay').classList.contains('active'), '暂停遮罩未显示');
    click($('btn-resume'), 'btn-resume');
    assert(g.status === 'playing', '继续失败');
    assert(!$('pause-overlay').classList.contains('active'), '暂停遮罩未隐藏');
    ok('暂停 / 继续正常');

    /* ========== 12. 通关 + 三选一奖励 ========== */
    if (reachGoal) g.level.goal.val = reachGoal;      // 还原第 1 关真实目标
    const goal = g.level.goal.type === 'reach' ? g.level.goal.val : 0;
    while (goal && p.count < goal) p.addUnit(p.cx, p.cy);
    if (!goal) {
      g.legions.forEach((L) => { if (!L.isPlayer) { L.clearUnits(); L.alive = false; } });
    }
    await frames(30);
    assert(active('screen-reward'), '通关后未弹出奖励页');
    const cards = document.querySelectorAll('#reward-cards .reward-card');
    assert(cards.length === 3, '奖励应为三选一，实际 ' + cards.length);
    assert(document.querySelectorAll('#reward-stars .star').length === 3, '星级显示缺失');
    ok('通关结算页：三选一奖励卡 ' + cards.length + ' 张，星级 ' + document.querySelectorAll('#reward-stars .star.on').length + ' 星');

    const coinsBefore = Save.data.coins;
    assert(coinsBefore > 0, '通关未发放金币');
    assert(Save.data.stars[1] >= 1, '未记录关卡星级');
    assert(Save.data.unlockedLevels >= 2, '未解锁第 2 关');
    ok('奖励结算：金币 +' + coinsBefore + '，累计 ' + Save.data.coins + '，已解锁第 2 关');

    click(cards[0], '第一张奖励卡');
    assert(cards[0].classList.contains('picked'), '奖励卡未进入已选状态');
    assert($('btn-reward-next').classList.contains('show'), '“进入下一关”按钮未出现');
    ok('奖励可点选，可进入下一关');

    click($('btn-reward-next'), 'btn-reward-next');
    await wait(220);
    assert(active('screen-game'), '未进入下一关');
    assert(UI.game && UI.game.level.id === 2, '下一关关卡号错误: ' + (UI.game ? UI.game.level.id : 'null'));
    ok('关卡推进正常，当前为第 ' + UI.game.level.id + ' 关');

    /* ========== 13. 失败流程 ========== */
    const g2 = UI.game;
    g2.player.clearUnits();
    g2.playerLost();
    await wait(60);
    assert(active('screen-lose'), '失败页未显示');
    ok('失败流程：结算页正常弹出');
    click($('btn-lose-menu'), 'btn-lose-menu');
    assert(active('screen-menu'), '失败后返回主菜单失败');
    ok('失败后返回主菜单正常');

    /* ========== 14. 操作方式切换（自动 → 摇杆 → 跟随） ========== */
    const mode0 = Save.data.settings.controlMode || 'auto';
    click($('btn-control'), 'btn-control');
    const mode1 = Save.data.settings.controlMode;
    click($('btn-control'), 'btn-control');
    const mode2 = Save.data.settings.controlMode;
    click($('btn-control'), 'btn-control');
    const mode3 = Save.data.settings.controlMode;
    assert(mode1 !== mode0 && mode2 !== mode1 && mode3 === mode0,
      '操作方式未正确循环：' + [mode0, mode1, mode2, mode3].join(' -> '));
    assert(String($('btn-control').textContent).indexOf('操作：') === 0,
      '操作按钮文案异常：' + $('btn-control').textContent);
    ok('操作方式可循环切换：' + [mode0, mode1, mode2, mode3].join(' → ') + '，按钮文案「' + $('btn-control').textContent + '」');

    /* ========== 15. 无尽模式（没有「层」，人数不重置，每 50 人三选一） ========== */
    click($('btn-endless'), 'btn-endless');
    assert(active('screen-prep'), '无尽模式未进入出征准备页');
    assert(String($('prep-title').textContent).indexOf('无尽') >= 0, '无尽准备页标题未体现模式');
    const prepGoal = String($('prep-goal').textContent);
    assert(prepGoal.indexOf('每层') < 0 && prepGoal.indexOf('层数') < 0, '无尽准备页不应再按层数描述');
    assert(prepGoal.indexOf('里程碑') >= 0, '无尽准备页应说明里程碑（每 50 人三选一）规则');
    click($('btn-prep-go'), 'btn-prep-go');
    await wait(220);
    const ge = UI.game;
    assert(ge, '无尽模式游戏实例未创建');
    assert(ge.level.endless === true, '关卡未标记为无尽模式');
    assert(ge.level.goal.type === 'endless', '无尽模式目标类型应为 endless，实际 ' + ge.level.goal.type);
    const STEP = ge.level.goal.step;
    const e1WorldW = ge.world.w;

    /* ---- 动态地图：世界框必须是以玩家为圆心的实时战场，不是写死尺寸的棋盘 ---- */
    assert(ge.dynWorld === true, '无尽模式应启用动态地图（以玩家为中心）');
    const wc0 = ge.world.x + ge.world.w / 2, hc0 = ge.world.y + ge.world.h / 2;
    assert(Math.abs(wc0 - ge.player.cx) < 2 && Math.abs(hc0 - ge.player.cy) < 2,
      '战场中心未跟随玩家：中心(' + wc0.toFixed(0) + ',' + hc0.toFixed(0) +
      ') 玩家(' + ge.player.cx.toFixed(0) + ',' + ge.player.cy.toFixed(0) + ')');
    assert(endlessViewRadius(400) > endlessViewRadius(10), '战场半径应随我方规模变大');

    // 把玩家瞬移一段距离，战场应整体跟着走，且内容持续围绕玩家生成
    const jumpX = 900, jumpY = -600;
    const beforeX = ge.world.x, beforeY = ge.world.y;
    ge.player.cx += jumpX; ge.player.cy += jumpY;
    ge.player.target.x = ge.player.cx; ge.player.target.y = ge.player.cy;
    ticks(ge, 3);
    const dxWorld = ge.world.x - beforeX, dyWorld = ge.world.y - beforeY;
    assert(Math.abs(dxWorld - jumpX) < 3 && Math.abs(dyWorld - jumpY) < 3,
      '玩家移动后战场未整体跟随：位移(' + dxWorld.toFixed(0) + ',' + dyWorld.toFixed(0) +
      ') 期望(' + jumpX + ',' + jumpY + ')');
    const arenaR = ge.dynR;
    let farthest = 0;
    for (const N of ge.neutrals) {
      const d = Math.sqrt((N.x - ge.player.cx) ** 2 + (N.y - ge.player.cy) ** 2);
      if (d > farthest) farthest = d;
    }
    assert(ge.neutrals.length > 0, '动态战场上应持续存在中立小人');
    assert(farthest <= arenaR * ENDLESS.cullPad + 4,
      '中立小人不应留在战场之外：最远 ' + farthest.toFixed(0) + ' > 边界 ' + (arenaR * ENDLESS.cullPad).toFixed(0));
    assert(ge.decor.length > 0, '动态战场上应持续存在装饰物');
    // 动态战场没有墙：跑到「旧边界」之外不应被夹回来
    assert(Math.abs(ge.player.cx - (wc0 + jumpX)) < 50, '动态战场不应把玩家夹在旧边界内');
    assert(ge.status === 'playing', '动态战场不应因越界中断对局');

    // 再远也必须跟得上：连续朝一个方向跑很远，不能被任何「隐形墙」拦住
    // （镜头是连续跟随的，所以这里让镜头先追上，模拟真实操作）
    ge.player.cx += 7200;
    ge.player.target.x = ge.player.cx; ge.player.target.y = ge.player.cy;
    for (let i = 0; i < 60; i++) ticks(ge, 1);
    const farFromOrigin = Math.abs(ge.player.cx - wc0);
    assert(farFromOrigin > 7000, '玩家应能连续跑出很远，实际位移 ' + farFromOrigin.toFixed(0));
    assert(Math.abs(ge.world.x + ge.world.w / 2 - ge.player.cx) < 3, '跑远后战场中心应仍然贴着玩家');

    // 对玩家零限制：屏幕上任意一点（含四角）都必须能直接指到，不能被夹到更近的地方
    ge.pointer.active = true;
    ge.pointer.x = 1198; ge.pointer.y = 2;
    ticks(ge, 1);
    const corner = ge.screenToWorld(1198, 2);
    assert(corner.x >= ge.world.x && corner.x <= ge.world.x + ge.world.w &&
      corner.y >= ge.world.y && corner.y <= ge.world.y + ge.world.h,
      '屏幕四角必须落在战场框内（战场半径应永远覆盖整个视野）');
    assert(Math.abs(ge.player.target.x - corner.x) < 2 && Math.abs(ge.player.target.y - corner.y) < 2,
      '动态战场限制了指哪走哪：target(' + ge.player.target.x.toFixed(0) + ',' + ge.player.target.y.toFixed(0) +
      ') 期望(' + corner.x.toFixed(0) + ',' + corner.y.toFixed(0) + ')');
    ge.pointer.active = false;
    ge.player.target.x = ge.player.cx; ge.player.target.y = ge.player.cy;
    ticks(ge, 1);
    ok('动态战场对玩家零限制：跑出 ' + farFromOrigin.toFixed(0) + 'px 不被拦 · 屏幕四角都能直接指到（无墙、也无软边界）');

    // 无尽模式渲染一帧：既不能有硬边界描边，也不能有会被误读成「场地圈」的大圆
    const bEnd = countBounds(ge);
    assert(bEnd.rects === 0 && bEnd.bigArcs === 0,
      '无尽模式渲染时不应出现任何边界/场地圈，实际边界 ' + bEnd.rects + ' 条 / 大圈 ' + bEnd.bigArcs + ' 个');
    ok('动态地图：以玩家为中心 · 半径 ' + Math.round(arenaR) + 'px · 随规模变化' +
       ' · 中立小人 ' + ge.neutrals.length + ' 个全部在战场内（最远 ' + farthest.toFixed(0) + 'px）');

    ge.player.cx -= jumpX; ge.player.cy -= jumpY;
    ge.player.target.x = ge.player.cx; ge.player.target.y = ge.player.cy;
    ticks(ge, 3);
    ok('无尽模式启动：单局连续对局 · 每 ' + STEP + ' 人一次三选一 · 战场 ' + ge.world.w + '×' + ge.world.h);

    // 达到第一个里程碑 → 暂停并弹出三选一
    while (ge.player.count < STEP) ge.player.addUnit(ge.player.cx, ge.player.cy);
    await frames(30);
    assert(active('screen-reward'), '里程碑达成后未弹出奖励页');
    assert(ge.status === 'milestone', '里程碑期间对局应冻结，实际 ' + ge.status);
    assert(Save.data.stats.endlessBest === STEP, '最高人数纪录未更新，实际 ' + Save.data.stats.endlessBest);
    assert(String($('reward-title').textContent).indexOf('里程碑') >= 0,
      '结算标题应体现里程碑，实际 ' + $('reward-title').textContent);
    const cards2 = document.querySelectorAll('#reward-cards .reward-card');
    assert(cards2.length === 3, '无尽奖励仍应为三选一');
    const cardText = Array.prototype.map.call(cards2, c => c.textContent).join('|');
    assert(cardText.indexOf('解锁开局') < 0, '无尽里程碑不应出现「解锁开局人数」卡');
    click(cards2[0], '无尽奖励卡');
    assert(String($('btn-reward-next').textContent).indexOf('继续') >= 0,
      '无尽模式按钮文案应为「继续无尽挑战」，实际 ' + $('btn-reward-next').textContent);
    ok('里程碑结算：三选一正常 · 纪录 ' + Save.data.stats.endlessBest + ' 人 · 按钮文案正确');

    // 继续：必须是同一场对局、人数不重置
    const countBefore = ge.player.count;
    click($('btn-reward-next'), 'btn-reward-next');
    await wait(120);
    assert(active('screen-game'), '继续后未回到对局画面');
    assert(UI.game === ge, '无尽模式应沿用同一场对局，而不是重开');
    assert(ge.status === 'playing', '继续后对局应恢复运行，实际 ' + ge.status);
    assert(ge.player.count >= countBefore, '继续后人数不应重置（' + countBefore + ' → ' + ge.player.count + '）');
    assert(ge.nextMilestone === STEP * 2, '下一个里程碑应为 ' + (STEP * 2) + '，实际 ' + ge.nextMilestone);

    // 第二个里程碑同样触发，且动态战场随规模继续扩大
    while (ge.player.count < STEP * 2) ge.player.addUnit(ge.player.cx, ge.player.cy);
    await frames(30);
    assert(active('screen-reward'), '第二个里程碑未弹出奖励页');
    assert(ge.dynR >= arenaR, '战场半径不应缩小');
    assert(ge.world.w >= e1WorldW, '战场不应缩小');
    ok('里程碑推进：' + (STEP * 2) + ' 人 · 战场半径 ' + Math.round(ge.dynR) +
       'px（框 ' + ge.world.w + '×' + ge.world.h + '）· 同一场对局人数累积不重置');
    click(document.querySelectorAll('#reward-cards .reward-card')[0], '无尽奖励卡2');
    click($('btn-reward-next'), 'btn-reward-next');
    await wait(120);

    assert(UI.run && UI.run.mode === 'endless', 'run.mode 应为 endless');
    assert(String($('hud-level').textContent).indexOf('无尽') >= 0, 'HUD 关卡标题未体现无尽');
    assert(String($('hud-level').textContent).indexOf('战场半径') >= 0, 'HUD 应显示动态战场半径');

    click($('btn-pause'), 'btn-pause');
    assert(active('pause-overlay'), '暂停遮罩未出现');
    click($('btn-resume'), 'btn-resume');
    assert(ge.status === 'playing', '继续后对局未恢复');

    // 无尽模式唯一的结局：被打光（结算要看「峰值人数」而不是层数）
    const peakNow = ge.player.count;
    ge.player.clearUnits();
    ge.playerLost();
    await wait(80);
    assert(active('screen-lose'), '无尽模式全灭后未弹出结算页');
    const loseSub = String($('lose-sub').textContent);
    assert(loseSub.indexOf('峰值') >= 0 && loseSub.indexOf('最高纪录') >= 0 && loseSub.indexOf('层') < 0,
      '无尽失败结算应报峰值人数而不是层数，实际：' + loseSub);
    assert((Save.data.stats.endlessBest || 0) >= peakNow, '全灭时应把峰值写进最高纪录');
    ok('无尽模式结束条件：全灭结算 · ' + loseSub);
    click($('btn-lose-menu'), 'btn-lose-menu');
    assert(active('screen-menu'), '退出无尽模式后未回到主菜单');
    ok('无尽模式可暂停并随时退出');

    /* ========== 15. 商店购买闭环 ========== */
    Save.data.coins = 99999;
    UI.refreshCoins();
    click($('btn-shop'), 'btn-shop');
    const buy = document.querySelector('#skin-grid .btn-mini.buy');
    assert(buy, '没有可购买的皮肤按钮');
    const ownedBefore = Save.data.skinsOwned.length;
    click(buy, '购买皮肤');
    assert(Save.data.skinsOwned.length === ownedBefore + 1, '购买后未增加已拥有皮肤');
    assert(document.querySelectorAll('#skin-grid .skin-cell.using').length === 1, '购买后未自动装备');
    ok('商店购买闭环：金币 ' + Save.data.coins + '，已拥有 ' + Save.data.skinsOwned.length + ' 款皮肤');
    click($('btn-shop-back'), 'btn-shop-back');

    /* ========== 16. 存档持久化 ========== */
    const raw = window.localStorage.getItem('mini_legion_save_v1');
    assert(raw && raw.length > 10, '未写入 localStorage');
    const parsed = JSON.parse(raw);
    assert(parsed.unlockedLevels >= 2, '存档未记录关卡进度');
    ok('存档持久化正常（' + raw.length + ' 字节，已解锁 ' + parsed.unlockedLevels + ' 关）');

    /* ========== 17. 技能 / 增益：配置里的 desc 是否真实生效 ========== */
    // 不读配置字符串，而是构造受控对局、量测引擎里的实际数值与行为。
    const vfHooks = { onHud() {}, onWin() {}, onMilestone() {}, onLose() {}, onLegionDown() {}, onInput() {} };
    const mkGame = (run) => new MiniGame({
      canvas: $('game-canvas'), minimap: $('minimap'),
      level: LEVELS[0], levelIndex: 0,
      run: Object.assign({ mode: 'campaign', skillId: 'rush', startCount: 3, buffs: {} }, run || {}),
      hooks: vfHooks,
    });
    const vfDist = (x, y, gg) => Math.hypot(x - gg.player.cx, y - gg.player.cy);
    const vfClean = [];

    /* ---- 增益 7 条 ---- */
    const vNone = mkGame({}), vBoost = mkGame({ buffs: { speed: 5, atk: 5 } });
    vfClean.push(vNone, vBoost);
    vNone.update(0.02); vBoost.update(0.02);
    const vSpd = vBoost.player.speedMul / vNone.player.speedMul;
    const vAtk = vBoost.player.atkMul / vNone.player.atkMul;
    assert(Math.abs(vSpd - 1.35) < 1e-9, '行军加速 ×5 应 +35% 移速，实际 ×' + vSpd.toFixed(4));
    assert(Math.abs(vAtk - 1.80) < 1e-9, '狼吞虎咽 ×5 应 +80% 吞噬速度，实际 ×' + vAtk.toFixed(4));

    const vStart = mkGame({ buffs: { start: 2 } });
    vfClean.push(vStart);
    assert(vStart.player.count === 3 + 4, '先锋增援 ×2 开局应 3+4=7 人，实际 ' + vStart.player.count);

    const vNeu = mkGame({ buffs: { neutral: 4 } });
    vfClean.push(vNeu);
    const vNeuWant = Math.min(Math.round(LEVELS[0].neutral * 2), CFG.neutralMax);
    assert(vNeu.neutralTarget === vNeuWant && vNeu.neutrals.length === vNeuWant,
      '遍地人潮 ×4 应把中立小人 +100%（目标 ' + vNeu.neutralTarget + '，实际铺开 ' + vNeu.neutrals.length + '）');

    const vShrink = mkGame({ buffs: { shrink: 3 } });
    vfClean.push(vShrink);
    const vFoe0 = vShrink.legions.filter(L => !L.isPlayer)[0];
    assert(vFoe0.count === Math.max(2, LEVELS[0].enemies[0].c - 6),
      '威慑 ×3 应把敌军开局 -6（下限 2），实际 ' + vFoe0.count);

    const vCd = mkGame({ buffs: { cd: 4 } });
    vfClean.push(vCd);
    Save.data.skills.rush = 1;
    vCd.player.skillCd = 0;
    vCd.useSkill();
    assert(Math.abs(vCd.player.skillCd - SKILLS.rush.cd * 0.52) < 1e-6,
      '战术精通 ×4 应把冷却 -48%，实际 ' + vCd.player.skillCd.toFixed(2) + 's');

    // 感召力：4 个单位钉在圆心（避开「残部加成」），中立小人放在「基础半径之外、+75% 之内」
    const mkTrap = (buffs) => {
      const gg = mkGame({ startCount: 4, buffs: buffs });
      vfClean.push(gg);
      gg.player.clearUnits();
      for (let k = 0; k < 4; k++) gg.player.addUnit(gg.player.cx, gg.player.cy);
      gg.legions.forEach(L => { if (!L.isPlayer) { L.clearUnits(); L.alive = false; } });
      gg.neutrals.length = 0;
      gg.neutrals.push({ x: gg.player.cx + CFG.pickup * 1.4, y: gg.player.cy, vx: 0, vy: 0, ph: 0, dir: 0, t: 9 });
      gg.buildUnitGrid();
      return gg;
    };
    const vTrapB = mkTrap({}), vTrapP = mkTrap({ pickup: 3 });
    vTrapB.updateNeutrals(0.02); vTrapP.updateNeutrals(0.02);
    assert(vTrapB.neutrals.length === 1 && vTrapB.player.count === 4,
      '基础收编半径（' + CFG.pickup + '）之外不应被收编，实际 ' + vTrapB.player.count + ' 人');
    assert(vTrapP.neutrals.length === 0 && vTrapP.player.count === 5,
      '感召力 +75%（半径 ' + (CFG.pickup * 1.75).toFixed(1) + '）应能收编同一位置的中立小人，实际 ' + vTrapP.player.count + ' 人');
    ok('增益 7 条核准：先锋增援/遍地人潮/行军加速/狼吞虎咽/感召力/威慑/战术精通 的数值均真实进入引擎');

    /* ---- 技能 6 个（统一固定在 Lv.1 逐条对数值） ---- */
    SKILL_LIST.forEach(id => { Save.data.skills[id] = 1; });

    const vRush = mkGame({ skillId: 'rush' });
    vfClean.push(vRush);
    vRush.updateLegion(vRush.player, 0.02); const r0 = vRush.player.speedMul;
    vRush.player.fx.rush = SKILLS.rush.levels[0].dur;
    vRush.updateLegion(vRush.player, 0.02); const r1 = vRush.player.speedMul;
    assert(Math.abs(r1 / r0 - 1.6) < 1e-9, '急速集结 Lv.1 应 +60% 移速，实际 ×' + (r1 / r0).toFixed(4));
    let vElapsed = 0;
    for (let i = 0; i < 1000 && vRush.player.fx.rush; i++) { vRush.updateFx(0.02); vElapsed += 0.02; }
    assert(Math.abs(vElapsed - SKILLS.rush.levels[0].dur) < 0.05,
      '急速集结应持续 ' + SKILLS.rush.levels[0].dur + ' 秒，实际 ' + vElapsed.toFixed(2) + ' 秒');

    const vFren = mkGame({ skillId: 'frenzy' });
    vfClean.push(vFren);
    vFren.updateLegion(vFren.player, 0.02); const f0 = vFren.player.atkMul;
    vFren.player.fx.frenzy = 5;
    vFren.updateLegion(vFren.player, 0.02); const f1 = vFren.player.atkMul;
    assert(Math.abs(f1 / f0 - 2.0) < 1e-9, '狂暴吞噬 Lv.1 应让吞噬速度翻倍，实际 ×' + (f1 / f0).toFixed(4));
    const vFoe1 = vFren.legions.filter(L => !L.isPlayer)[0];
    vFoe1.ai = null; vFoe1.cx = vFren.player.cx + 20; vFoe1.cy = vFren.player.cy;
    while (vFren.player.count < vFoe1.count + 6) vFren.player.addUnit(vFren.player.cx, vFren.player.cy);
    vFren.pairTimers.clear();
    let vIv = 0;
    const vFrenC0 = vFren.player.count;
    for (let i = 0; i < 100; i++) {
      vFren.updateCombat(0.02);
      if (vFren.player.count > vFrenC0) {          // 刚吞掉 1 个 → 这一帧把节拍设成 interval / atkMul
        vIv = Array.from(vFren.pairTimers.values())[0] || 0;
        break;
      }
    }
    assert(vIv > 0 && Math.abs(vIv - CFG.eat.interval / vFren.player.atkMul) < 1e-6,
      '狂暴吞噬应把吞噬节拍压到 ' + (CFG.eat.interval / vFren.player.atkMul).toFixed(3) +
      's（基准 ' + CFG.eat.interval + 's），实际 ' + vIv.toFixed(3) + 's');

    const vSlow = mkGame({ skillId: 'slow' });
    vfClean.push(vSlow);
    const vSlowFoe = vSlow.legions.filter(L => !L.isPlayer)[0];
    vSlowFoe.ai = null;
    vSlowFoe.cx = vSlow.player.cx + 100; vSlowFoe.cy = vSlow.player.cy;
    vSlow.updateLegion(vSlowFoe, 0.02);
    const s0 = vSlowFoe.speedMul;
    vSlow.player.fx.slow = SKILLS.slow.levels[0].dur;
    vSlow.updateLegion(vSlowFoe, 0.02);
    assert(Math.abs(vSlowFoe.speedMul / s0 - 0.6) < 1e-9,
      '时间迟缓 Lv.1 应把 ' + SKILLS.slow.levels[0].radius + ' 内敌军 -40% 移速，实际 ×' + (vSlowFoe.speedMul / s0).toFixed(4));
    vSlowFoe.cx = vSlow.player.cx + SKILLS.slow.levels[0].radius + 60;
    vSlow.updateLegion(vSlowFoe, 0.02);
    assert(Math.abs(vSlowFoe.speedMul - s0) < 1e-9, '半径外的敌军不应被减速');

    const vSh = mkGame({ skillId: 'shield' });
    vfClean.push(vSh);
    const vShFoe = vSh.legions.filter(L => !L.isPlayer)[0];
    vShFoe.ai = null; vShFoe.cx = vSh.player.cx + 20; vShFoe.cy = vSh.player.cy;
    while (vShFoe.count < vSh.player.count * 4) vShFoe.addUnit(vShFoe.cx, vShFoe.cy);
    vSh.player.fx.shield = SKILLS.shield.levels[0].dur;
    const vShCount = vSh.player.count;
    for (let i = 0; i < 40; i++) vSh.updateCombat(0.02);
    assert(vSh.player.count === vShCount, '坚壁期间不应损失单位，实际 ' + vShCount + ' -> ' + vSh.player.count);
    delete vSh.player.fx.shield;
    for (let i = 0; i < 40; i++) vSh.updateCombat(0.02);
    assert(vSh.player.count < vShCount, '坚壁结束后应恢复被逐个吞噬，实际仍 ' + vSh.player.count + ' 人');

    const vLure = mkGame({ skillId: 'lure' });
    vfClean.push(vLure);
    const vLureR = SKILLS.lure.levels[0].radius;
    vLure.neutrals.length = 0;
    const vLureN = { x: vLure.player.cx + vLureR * 0.9, y: vLure.player.cy, vx: 0, vy: 0, ph: 0, dir: 0, t: 9 };
    vLure.neutrals.push(vLureN);
    vLure.player.fx.lure = SKILLS.lure.levels[0].dur;
    for (let i = 0; i < 25; i++) vLure.updateNeutrals(0.02);
    const vLureIn = vfDist(vLureN.x, vLureN.y, vLure);
    const vLureInV = Math.hypot(vLureN.vx, vLureN.vy);
    assert(vLureIn < vLureR * 0.9 - 15 && vLureInV > 60,
      '诱捕应把 ' + vLureR + ' 内的中立小人拉近（' + (vLureR * 0.9).toFixed(0) + ' -> ' + vLureIn.toFixed(0) +
      '，吸引速度 ' + vLureInV.toFixed(0) + 'px/s）');
    vLureN.x = vLure.player.cx + vLureR * 1.15; vLureN.y = vLure.player.cy;
    vLureN.vx = 0; vLureN.vy = 0; vLureN.t = 9;
    for (let i = 0; i < 25; i++) vLure.updateNeutrals(0.02);
    const vLureOut = vfDist(vLureN.x, vLureN.y, vLure);
    // 半径外只剩 ≤16px/s 的自然游荡，不应出现 120px/s 的吸引力
    const vLureOutV = Math.hypot(vLureN.vx, vLureN.vy);
    assert(vLureOutV < 20 && vLureOut > vLureR * 1.15 - 10,
      '半径外不应被吸引（速度 ' + vLureOutV.toFixed(1) + 'px/s · 距离 ' + vLureOut.toFixed(0) + '）');

    const vRe = mkGame({ skillId: 'reinforce' });
    vfClean.push(vRe);
    vRe.player.skillCd = 0;
    const vReCount = vRe.player.count, vReNeu = vRe.neutrals.length;
    vRe.useSkill();
    assert(vRe.player.count === vReCount + 4, '临时增援 Lv.1 应立刻 +4 人，实际 +' + (vRe.player.count - vReCount));
    assert(vRe.player.units.filter(u => u.temp > 0).length === 4, '应有 4 个临时单位');
    vRe.player.target.x = vRe.player.cx; vRe.player.target.y = vRe.player.cy;
    for (let i = 0; i < 610; i++) vRe.updateLegion(vRe.player, 0.02);   // 12.2 秒
    assert(vRe.player.count === vReCount, '援军应在 ' + SKILLS.reinforce.levels[0].dur + ' 秒后离队，实际还剩 ' + (vRe.player.count - vReCount) + ' 人');
    assert(vRe.neutrals.length === vReNeu + 4, '离队的援军应变回中立小人（+' + (vRe.neutrals.length - vReNeu) + '）');
    ok('技能 6 个核准：急速集结/临时增援/诱捕/狂暴吞噬/时间迟缓/坚壁 的范围与秒数均真实生效');

    vfClean.forEach(x => x && x.destroy());

    window.__TEST_RESULT__ = { ok: true, log };
  } catch (err) {
    window.__TEST_RESULT__ = { ok: false, log, error: (err && err.stack) || String(err) };
  }
})();
`;

/* ---------- 按脚本标签顺序执行页面脚本 + 测试脚本 ---------- */
const source = SCRIPTS.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n')
  + '\n;window.__APP__ = { UI: UI, Save: Save, LEVELS: LEVELS, SKINS: SKINS, SKILLS: SKILLS,' +
    ' SKILL_LIST: SKILL_LIST, START_OPTIONS: START_OPTIONS, ACHIEVEMENTS: ACHIEVEMENTS,' +
    ' ENDLESS: ENDLESS, endlessViewRadius: endlessViewRadius,' +
    ' CFG: CFG, MiniGame: MiniGame };\n';

try {
  window.eval(source);
} catch (e) {
  console.error('[FAIL] 页面脚本执行异常:', e && e.stack || e);
  process.exit(1);
}

try {
  window.eval(harness);
} catch (e) {
  console.error('[FAIL] 测试脚本执行异常:', e && e.stack || e);
  process.exit(1);
}

const DEADLINE = 60000;
const started = Date.now();
const timer = setInterval(() => {
  const r = window.__TEST_RESULT__;
  if (r) {
    clearInterval(timer);
    finish(r);
  } else if (Date.now() - started > DEADLINE) {
    clearInterval(timer);
    console.error('[FAIL] 测试超时（' + DEADLINE / 1000 + 's）');
    process.exit(1);
  }
}, 60);

function finish(r) {
  console.log('===== 蚕食军团 · 端到端测试 =====');
  (r.log || []).forEach((l) => console.log(l));
  if (jsdomErrors.length) {
    console.log('\n[运行期 JS 错误]');
    jsdomErrors.slice(0, 10).forEach((e) => console.log('  ✗ ' + e));
  }
  if (r.ok && !jsdomErrors.length) {
    console.log('\n全部通过 ✓');
    process.exit(0);
  } else {
    if (!r.ok) console.error('\n失败: ' + r.error);
    if (jsdomErrors.length) console.error('存在运行期错误，视为失败');
    process.exit(1);
  }
}
