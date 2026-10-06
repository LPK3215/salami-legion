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
          ENDLESS, endlessViewRadius, endlessMilestoneStep, endlessMilestoneThresholds,
          endlessHunterTarget, makeEndlessLevel, CFG, MiniGame } = window.__APP__;
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
    // 静态资源必须带 ?v= 版本号（GitHub Pages 强缓存 10 分钟，不换 URL 老访客会跑旧脚本）
    const vTags = Array.prototype.slice.call(document.querySelectorAll('script[src]'))
      .filter(s => s.getAttribute('src').indexOf('js/') === 0);
    assert(vTags.length > 0 && vTags.every(s => s.getAttribute('src').indexOf('?v=') > 0),
      '游戏脚本缺少 ?v= 版本号：' + vTags.map(s => s.getAttribute('src')).join(', '));
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

    /* ---- 摇杆原点锁定（旧 bug：橡皮筋会把原点拖出屏幕边界） ---- */
    // 先收掉上面那根还按住的手指 11，否则新按下会被「只认第一根手指」拦下
    window.dispatchEvent(mkPtr('pointerup', 430, 400, 11, 'touch'));
    assert(g.stick.active === false && g.stick.pointerId === null, '松手后摇杆状态未复位');
    const heldMove = Math.max(1, p.cx - stickFrom.x);
    ok('摇杆状态机正常：按下→拖动→多指→技能→松手均可复位（按住段位移 ' + heldMove.toFixed(1) + 'px）');

    g.canvas.dispatchEvent(mkPtr('pointerdown', 700, 300, 31, 'touch'));
    assert(g.stick.pointerId === 31, '手指 31 未能占用摇杆，实际绑定到 ' + g.stick.pointerId);
    const anchor0 = { x: g.stick.originX, y: g.stick.originY };
    // 手指超出行程 3 倍：原点不能动，方向与满力度必须保留（否则“拖着拖着就没行程了”）
    g.canvas.dispatchEvent(mkPtr('pointermove', 700 + g.stick.maxR * 3, 300, 31, 'touch'));
    assert(Math.abs(g.stick.originX - anchor0.x) < 0.01 && Math.abs(g.stick.originY - anchor0.y) < 0.01,
      '手指超出行程时不应把摇杆原点拖走：实际原点 (' + g.stick.originX.toFixed(1) + ',' +
      g.stick.originY.toFixed(1) + ')，按下位置 (' + anchor0.x + ',' + anchor0.y + ')');
    assert(g.stick.axisX > 0.99 && g.stick.strength > 0.99,
      '超出行程后应仍保持满力度同方向，实际力度 ' + g.stick.strength.toFixed(2));
    // 往回拖也一样：原点仍不动，方向反向
    g.canvas.dispatchEvent(mkPtr('pointermove', 700 - g.stick.maxR * 3, 300, 31, 'touch'));
    assert(Math.abs(g.stick.originX - anchor0.x) < 0.01, '反方向拖也不应把原点带走');
    assert(g.stick.axisX < -0.99 && g.stick.strength > 0.99, '反方向应仍为满速，实际 axisX=' + g.stick.axisX.toFixed(2));
    window.dispatchEvent(mkPtr('pointerup', 700 - g.stick.maxR * 3, 300, 31, 'touch'));
    // 在屏幕最下沿按下：原点应被收进安全区（距底边至少一个 maxR），否则向下拖没有行程
    g.canvas.dispatchEvent(mkPtr('pointerdown', 400, 798, 32, 'touch'));
    assert(g.stick.pointerId === 32, '手指 32 未能占用摇杆，实际绑定到 ' + g.stick.pointerId);
    assert(g.stick.originY <= g.vh - g.stick.maxR + 0.01,
      '靠近屏幕底边按下时原点应往里收：originY=' + g.stick.originY.toFixed(1) +
      '，安全边界=' + (g.vh - g.stick.maxR).toFixed(1));
    window.dispatchEvent(mkPtr('pointerup', 400, 798, 32, 'touch'));
    ok('摇杆原点锁定：超出行程不再拖走原点（正反方向均满速）· 贴底边按下会自动收进安全区');

    /* ---- 惯性而行（glide）：默认开 —— 松手保持方向，拉回中心＝刹车 ---- */
    assert(g.glide === true, '惯性而行应默认开启');
    g.canvas.dispatchEvent(mkPtr('pointerdown', 300, 400, 33, 'touch'));
    assert(g.stick.pointerId === 33, '手指 33 未能占用摇杆，实际绑定到 ' + g.stick.pointerId);
    g.canvas.dispatchEvent(mkPtr('pointermove', 430, 400, 33, 'touch'));
    const glFrom = { x: p.cx, y: p.cy };
    await frames(45);                       // 按住行进一段
    const glHeld = p.cx - glFrom.x;
    window.dispatchEvent(mkPtr('pointerup', 430, 400, 33, 'touch'));
    await frames(4);
    const glKeepFrom = { x: p.cx, y: p.cy };
    await frames(40);                       // 松手后同样时长
    const glKeep = p.cx - glKeepFrom.x;
    assert(g.stick.active === false, '松手后摇杆应已释放');
    assert(glHeld > 8 && glKeep / glHeld > 0.5,
      '惯性而行开启时松手应继续前进：按住位移 ' + glHeld.toFixed(1) + 'px，松手后只有 ' +
      glKeep.toFixed(1) + 'px');
    assert(g.lastInput === 'cruise', '松手后输入来源应标记为 cruise，实际 ' + g.lastInput);
    // 刹车：重新按住并把手指拉回原点（死区内），等减速完成后必须真的钉在原地
    g.canvas.dispatchEvent(mkPtr('pointerdown', 300, 400, 34, 'touch'));
    assert(g.stick.pointerId === 34, '手指 34 未能占用摇杆，实际绑定到 ' + g.stick.pointerId);
    g.canvas.dispatchEvent(mkPtr('pointermove', 430, 400, 34, 'touch'));
    await frames(10);
    g.canvas.dispatchEvent(mkPtr('pointermove', g.stick.originX, g.stick.originY, 34, 'touch'));
    assert(g.stick.strength === 0, '拉回中心后力度应归零（主动刹车）');
    await frames(45);                        // 先给减速留够时间
    const brakeSettled = { x: p.cx, y: p.cy };
    await frames(40);                        // 再看它是否真的钉住
    const brakeDrift = Math.hypot(p.cx - brakeSettled.x, p.cy - brakeSettled.y);
    assert(brakeDrift < 8,
      '拉回中心后应真的停下，减速完之后又漂了 ' + brakeDrift.toFixed(1) + 'px');
    window.dispatchEvent(mkPtr('pointerup', g.stick.originX, g.stick.originY, 34, 'touch'));
    assert(g.cruise.strength === 0, '刹车后巡航应被清空');
    ok('惯性而行生效：松手保持方向继续走 ' + glKeep.toFixed(0) + 'px（按住段 ' + glHeld.toFixed(0) +
       'px）· 拉回中心可刹车（减速后仅漂 ' + brakeDrift.toFixed(1) + 'px）');

    /* ---- 关掉惯性：主菜单「惯性」开关 → 旧行为“松手即停” ---- */
    assert(Save.data.settings.glide !== false, '惯性默认应为开');
    click($('btn-glide'), 'btn-glide');      // 开 → 关，并同步到当前对局
    assert(Save.data.settings.glide === false, '点击「惯性」未写入存档');
    assert(g.glide === false, '点击「惯性」未同步到当前对局引擎');
    g.canvas.dispatchEvent(mkPtr('pointerdown', 300, 400, 35, 'touch'));
    assert(g.stick.pointerId === 35, '手指 35 未能占用摇杆，实际绑定到 ' + g.stick.pointerId);
    g.canvas.dispatchEvent(mkPtr('pointermove', 430, 400, 35, 'touch'));
    const offFrom = { x: p.cx, y: p.cy };
    await frames(45);
    const offHeld = Math.max(1, p.cx - offFrom.x);
    window.dispatchEvent(mkPtr('pointerup', 430, 400, 35, 'touch'));
    assert(g.stick.active === false, '关闭惯性后松手应释放摇杆');
    await frames(4);
    const offStop = { x: p.cx, y: p.cy };
    await frames(40);
    const offDrift = Math.hypot(p.cx - offStop.x, p.cy - offStop.y);
    assert(offDrift / offHeld < 0.25,
      '关闭惯性后应迅速停下，残余位移 ' + offDrift.toFixed(1) + 'px（按住时 ' + offHeld.toFixed(1) + 'px）');
    click($('btn-glide'), 'btn-glide');      // 恢复默认（开），不影响后续用例
    assert(g.glide === true, '再次点击「惯性」应回到开启');
    ok('「惯性」开关双向有效：关闭后松手位移只残余 ' + offDrift.toFixed(1) +
       'px（按住 ' + offHeld.toFixed(1) + 'px），并实时同步存档与对局');

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
    const kbKeepFrom = { x: p.cx, y: p.cy };
    await frames(40);                       // 惯性而行：松键后仍沿原方向走
    const kbKeep = p.cx - kbKeepFrom.x;
    const kbHeld = Math.max(1, p.cx - kbFrom.x - kbKeep);
    assert(kbKeep / kbHeld > 0.5,
      '惯性而行开启时松开方向键应继续前进：按住段 ' + kbHeld.toFixed(1) + 'px，松键后只有 ' +
      kbKeep.toFixed(1) + 'px');
    assert(g.lastInput === 'cruise', '松键后输入来源应为 cruise，实际 ' + g.lastInput);
    ok('键盘惯性而行生效：松开 D 后继续前进 ' + kbKeep.toFixed(0) + 'px（按住段 ' + kbHeld.toFixed(0) + 'px）');

    // 键盘上的主动刹车：同时按住两个相反方向（A + D）
    key('keydown', 'd');                    // 先走起来
    await frames(10);
    key('keydown', 'a');                    // A + D 同时按下 → 抵消 → 刹车
    assert(g.keys.x === 0 && g._held.size === 2, '相反方向应互相抵消且仍算「按着」');
    await frames(45);                        // 减速完成
    const kbBrakeFrom = { x: p.cx, y: p.cy };
    await frames(40);                        // 再看是否钉住
    const kbBrake = Math.hypot(p.cx - kbBrakeFrom.x, p.cy - kbBrakeFrom.y);
    assert(kbBrake < 8,
      '同时按住 A+D 应真的停下，减速完之后又漂了 ' + kbBrake.toFixed(1) + 'px');
    assert(g.cruise.strength === 0, '刹车后巡航应被清空');
    key('keyup', 'a');
    key('keyup', 'd');
    ok('键盘刹车生效：同时按住 A+D 停下（减速后仅漂 ' + kbBrake.toFixed(1) + 'px）');

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
    // 固定步长推进：一旦收编成功就停手，避免一路吃满触发通关、让后续断言失去对局环境。
    // 注意：这一段可能跑好几秒游戏时间，若此时敌军还在场上，它会边吃中立小人长大、
    // 反过来把玩家吞光（对局提前结束）——下一段本来就要清空敌军，这里提前清掉，
    // 让「收编」这一段只受收编逻辑影响。
    if (c0 === p.count) g.legions.forEach(L => { if (!L.isPlayer) { L.clearUnits(); L.alive = false; } });
    for (let i = 0; i < 300 && p.count === c0 && g.status === 'playing'; i++) ticks(g, 1);
    assert(p.count > c0, '接近中立小人后人数未增长: ' + c0 + ' -> ' + p.count);
    assert(g.status === 'playing', '收编测试后对局应仍在进行，实际 ' + g.status);
    ok('中立小人可被收编：' + c0 + ' 人 -> ' + p.count + ' 人');

    /* ========== 9. 核心机制：按拍吞噬（擦边逐个吞 · 覆盖同批吞） ========== */
    // 隔离环境：清空中立小人，避免双方边打边收编干扰断言
    const savedNeutrals = g.neutrals;
    const savedNeutralTarget = g.neutralTarget;
    g.neutrals = [];
    g.neutralTarget = 0;      // 本段不让刷新的小人被收编，否则人数会变（只测吞噬节拍）
    g.legions.forEach((L) => { if (!L.isPlayer && L !== undefined) { L.clearUnits(); L.alive = false; } });
    // 前面的移动测试会让军团顺路收编中立小人，这里先压回安全人数，避免提前达成关卡目标
    while (p.count > 6) p.units.pop();

    const foe = g.legions.find((L) => !L.isPlayer);
    assert(foe, '找不到可用于测试的敌军团');
    p.target.x = p.cx; p.target.y = p.cy;   // 我方原地不动，只观察吞噬节奏
    /* 本段只测吞噬节拍：清掉上一段用例残留的巡航/输入来源，
       否则「惯性而行」会让我方军团自己往前跑，接触判定就会时好时坏 */
    g.glide = false;
    g.cruise.strength = 0;
    g.lastInput = 'idle';

    /* 摆一支 n 人敌军在与我方圆心相距 dist 的位置，推进「一拍」，返回这一拍同批吞了几个 */
    const oneTickBatch = (n, dist) => {
      // 先剔掉临时援军，不让它们在本段中途到期离队（否则我方会凭空空掉几个人）
      p.units = p.units.filter(u => !u.temp);
      while (p.units.length > 6) p.units.pop();
      while (p.units.length < 6) p.addUnit(p.cx, p.cy);
      foe.alive = true;
      foe.ai = null;                 // 固定不动，保证稳定接触
      foe.clearUnits();
      foe.cx = p.cx + dist; foe.cy = p.cy;
      foe.target.x = foe.cx; foe.target.y = foe.cy;
      for (let i = 0; i < n; i++) foe.addUnit(foe.cx + (i % 3) * 5, foe.cy + Math.floor(i / 3) * 5);
      /* 把两个圆心“钉住”：上一段用例残留的速度会让它们飘，
         而擦边场景只有几个像素的接触余量，一飘就脱离接触 → 一拍也吞不到 */
      p.cvx = 0; p.cvy = 0;
      p.target.x = p.cx; p.target.y = p.cy;
      foe.cvx = 0; foe.cvy = 0;
      const engulfed = g.engulfedCount(foe, p);   // 被我方圆盘「盖住」的那几个
      const meN = p.count, foeN = foe.count, st0 = g.status;
      g.pairTimers.clear();                        // 从零开始攒这一拍
      ticks(g, 20);                                // 20 × 0.02s = 0.4s → 正好一拍（间隔 0.32s）
      return {
        eaten: foeN - foe.count, gained: p.count - meN, engulfed: engulfed,
        meN: meN, foeN: foeN, st0: st0, st1: g.status,
        me1: p.count, foe1: foe.count, eatenByMe: g.stats.eaten,
      };
    };

    // 先摆一次 6 vs 4（拉远到不接触）取样双方圆盘半径，再据此算出「刚好相切」的距离
    // （人数必须拉开差距：两边相等时对等干瞪眼，谁也吞不了谁）
    oneTickBatch(4, 200);
    const grazeDist = Math.round((p.radius + foe.radius) * CFG.eat.contact * 0.97);
    const graze = oneTickBatch(4, grazeDist);
    const deep = oneTickBatch(4, 6);

    assert(graze.engulfed === 0, '擦边场景下不该有敌军单位被我方圆盘盖住，实际 ' + graze.engulfed + ' 个');
    assert(graze.st0 === 'playing' && graze.st1 === 'playing',
      '擦边这一拍对局必须正常运行，实际状态 ' + graze.st0 + ' → ' + graze.st1);
    assert(graze.meN === 6 && graze.foeN === 4,
      '擦边场景开局人数应为「我 6 敌 4」，实际 我' + graze.meN + ' 敌' + graze.foeN);
    assert(graze.eaten === 1, '擦边接触应一拍只吞 1 个（一个一个地吃），实际 ' + graze.eaten +
      ' 个（我 ' + graze.meN + '→' + graze.me1 + '，敌 ' + graze.foeN + '→' + graze.foe1 + '）');
    assert(deep.engulfed === 4, '覆盖场景下整支敌军应落在我方圆盘内，实际只有 ' + deep.engulfed + ' 个');
    assert(deep.st0 === 'playing' && deep.st1 === 'playing',
      '覆盖这一拍对局必须正常运行，实际状态 ' + deep.st0 + ' → ' + deep.st1);
    assert(deep.meN === 6 && deep.foeN === 4,
      '覆盖场景开局人数应为「我 6 敌 4」，实际 我' + deep.meN + ' 敌' + deep.foeN);
    assert(deep.eaten === 4, '被盖住的部分应同批吸收，实际一拍吞了 ' + deep.eaten +
      ' 个（我 ' + deep.meN + '→' + deep.me1 + '，敌 ' + deep.foeN + '→' + deep.foe1 +
      '，盖住 ' + deep.engulfed + '）');
    assert(deep.eaten <= Math.round(CFG.eat.batchMax * Math.max(1, p.atkMul || 1)),
      '同批吸收不应超过单批上限，实际一拍吞了 ' + deep.eaten + ' 个');
    assert(graze.eaten === graze.gained && deep.eaten === deep.gained,
      '被吞的单位必须全部转入我方，不能凭空消失');
    ok('按拍吞噬生效：擦边一拍吞 ' + graze.eaten + ' 个 · 盖住 ' + deep.engulfed +
       ' 个时一拍同批吞 ' + deep.eaten + ' 个（单批上限 ' + CFG.eat.batchMax + '）');

    // 反向验证：我方人数劣势时会被同批持续吞掉，但一批仍受单批上限约束（不会瞬间清空）
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
    let maxDrop = 0;
    let prevMe = meBeforeLose;
    for (let i = 0; i < 6; i++) {
      ticks(g, 20);
      maxDrop = Math.max(maxDrop, prevMe - p.count);
      prevMe = p.count;
      minMe = Math.min(minMe, p.count);
      // 验证的是「劣势会被一批一批吞掉」，不是「一定被吞光」，留 4 人保底不触发失败流程
      if (g.status !== 'playing' || p.count <= 4) break;
    }
    assert(minMe < meBeforeLose, '人数劣势时应被敌方持续吞掉，实际 ' + meBeforeLose + ' -> ' + minMe);
    assert(minMe > 0, '测试中我方不应全灭');
    assert(maxDrop <= Math.round(CFG.eat.batchMax * Math.ceil(20 * 0.02 / CFG.eat.interval)),
      '被吞也必须按拍结算、单批不超上限：窗口 0.4s 最多含 ' +
      Math.ceil(20 * 0.02 / CFG.eat.interval) + ' 拍 × 上限 ' + CFG.eat.batchMax +
      ' 个，实际一拍掉了 ' + maxDrop + ' 人');
    ok('反向吞噬生效：敌 ' + foeBig + ' 人 > 我方 ' + meBeforeLose + ' 人，我方被一批一批吞至 ' +
       minMe + ' 人（一拍最多掉 ' + maxDrop + ' 个，不会瞬间清空）');

    // 恢复环境（保持人数低于关卡目标，后续步骤再触发通关）
    g.glide = Save.data.settings.glide !== false;   // 把惯性恢复到存档设定
    g.neutralTarget = savedNeutralTarget;
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
    // 动态地图那一大段校验会长时间跑图，途中很容易凑到首个里程碑；
    // 先挂起弹窗，保证那些断言跑完再回到「里程碑 → 三选一」的正常流程
    ge.nextMilestone = 1e9;

    /* ---- 动态地图：世界框必须是以玩家为圆心的实时战场，不是写死尺寸的棋盘 ---- */
    assert(ge.dynWorld === true, '无尽模式应启用动态地图（以玩家为中心）');
    /* ---- 人数上限：单军团上限是可调参数，真正带住帧率的是全场总量闸门 ---- */
    assert(CFG.unitTotalMax > CFG.maxUnits,
      '全场总量闸门应高于单军团上限，实际 ' + CFG.unitTotalMax + ' / ' + CFG.maxUnits);
    assert(typeof ge.totalUnits === 'function' && ge.totalUnits() >= ge.player.count,
      '全场单位总量读数应可用，实际 ' + (ge.totalUnits && ge.totalUnits()));
    /* ---- 里程碑递增：只上提不回退，并最终封顶 ---- */
    for (let i = 1; i < 12; i++) {
      assert(endlessMilestoneStep(i + 1) >= endlessMilestoneStep(i),
        '里程碑增量不应回退：第 ' + i + ' 段 ' + endlessMilestoneStep(i) +
        ' → 第 ' + (i + 1) + ' 段 ' + endlessMilestoneStep(i + 1));
    }
    assert(endlessMilestoneStep(0) === ENDLESS.milestoneFirst, '首个里程碑应只要 ' + ENDLESS.milestoneFirst + ' 人');
    assert(endlessMilestoneStep(60) === ENDLESS.milestoneStepMax,
      '增量最终应封顶在 ' + ENDLESS.milestoneStepMax + '，实际 ' + endlessMilestoneStep(60));
    ok('里程碑递增序列：' + endlessMilestoneThresholds(6).join(' → ') + ' …（单军团上限 ' +
       CFG.maxUnits + ' 人，全场总量闸门 ' + CFG.unitTotalMax + ' 人）');
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
    ge.nextMilestone = STEP;                 // 恢复首个里程碑
    ok('无尽模式启动：单局连续对局 · 首个里程碑 ' + STEP + ' 人，之后每段增量逐段上提 · 战场 ' + ge.world.w + '×' + ge.world.h);

    // 达到第一个里程碑 → 不切页，直接在战场上浮出半透明三选一
    while (ge.player.count < STEP) ge.player.addUnit(ge.player.cx, ge.player.cy);
    await frames(30);
    assert(active('milestone-overlay'), '里程碑达成后未浮出三选一遮罩');
    assert(active('screen-game'), '里程碑应浮在战场之上，不能切走对局画面');
    // 浮层必须是 #screen-game 的后代：这样它天然只会半透明地盖在画布上，而不是遮住整个页面
    const msOv = $('milestone-overlay');
    assert(msOv && msOv.closest('#screen-game') === $('screen-game'),
      '里程碑浮层应挂在对局画面内部（不遮挡整页）');
    assert(!active('screen-reward'), '里程碑不应再走整页结算（会把战场全部遮住）');
    assert(ge.status === 'milestone', '里程碑期间对局应冻结，实际 ' + ge.status);
    // 里程碑按「>= 阈值」触发，同一帧里顺路多吃一个中立小人也是正常的
    assert(Save.data.stats.endlessBest >= STEP, '最高人数纪录未更新，实际 ' + Save.data.stats.endlessBest);
    assert(String($('ms-title').textContent).indexOf('里程碑') >= 0,
      '浮层标题应体现里程碑，实际 ' + $('ms-title').textContent);
    const cards2 = document.querySelectorAll('#ms-cards .reward-card');
    assert(cards2.length === 3, '无尽奖励仍应为三选一');
    const cardText = Array.prototype.map.call(cards2, c => c.textContent).join('|');
    assert(cardText.indexOf('解锁开局') < 0, '无尽里程碑不应出现「解锁开局人数」卡');
    ok('里程碑浮层：半透明浮在战场上 · 三选一正常 · 纪录 ' + Save.data.stats.endlessBest + ' 人');

    /* ---- 里程碑不再“整帧硬冻”：世界继续呼吸（滑停/粒子/镜头），玩法不推进 ---- */
    ge.particles.length = 0;
    ge.burst(ge.player.cx, ge.player.cy, '#ffffff', 8, 100);
    const mParticleN = ge.particles.length;
    const mTime0 = ge.time, mEaten0 = ge.stats.eaten, mCount0 = ge.player.count;
    const mCx0 = ge.player.cx, mCy0 = ge.player.cy;
    ge.player.cvx = 260; ge.player.cvy = 0;   // 给个满速惯性：应该“滑停”而不是“急停”
    ticks(ge, 30);
    assert(ge.status === 'milestone', '这段校验必须在里程碑冻结期内');
    assert(ge.particles.length < mParticleN,
      '里程碑期间粒子应继续消散（旧版整帧 return 会连粒子一起僵住），实际 ' +
      mParticleN + ' → ' + ge.particles.length);
    assert(ge.time === mTime0, '里程碑期间不应推进对局时间，实际 ' + mTime0 + ' → ' + ge.time);
    assert(ge.stats.eaten === mEaten0 && ge.player.count === mCount0,
      '里程碑期间不应继续吞噬/变动人数');
    const mGlide = Math.hypot(ge.player.cx - mCx0, ge.player.cy - mCy0);
    assert(mGlide > 4, '军团应带着惯性滑出一段（滑停），实际位移仅 ' + mGlide.toFixed(1) + 'px');
    ticks(ge, 60);
    assert(Math.hypot(ge.player.cvx, ge.player.cvy) < 8,
      '滑行应衰减到接近静止，实际速度 ' + ge.player.cvx.toFixed(1));
    assert(Math.abs(ge.dynR) > 0, '里程碑期间动态战场仍应在玩家周围（不重新构造世界）');
    ok('里程碑软暂停：滑停 ' + mGlide.toFixed(1) + 'px 后停下 · 粒子继续消散 · 时间与吞噬不推进');

    // 点一张卡 → 当场生效，短暂高光后自动回到战场，不需要再点「下一步」
    const countBefore = ge.player.count;
    click(cards2[0], '里程碑奖励卡');
    assert(cards2[0].classList.contains('picked'), '奖励卡未进入已选状态');
    assert(UI.msChosen === true, '点卡后应当场落定选择');
    await wait(600);
    assert(!active('milestone-overlay'), '选完奖励后浮层应自动收起');
    assert(ge.status === 'playing', '选完奖励后对局应自动恢复，实际 ' + ge.status);
    assert(active('screen-game'), '选完奖励后应仍在对局画面');
    assert(UI.game === ge, '无尽模式应沿用同一场对局，而不是重开');
    assert(ge.player.count >= countBefore, '继续后人数不应重置（' + countBefore + ' → ' + ge.player.count + '）');
    const M2 = STEP + ENDLESS.milestoneStepBase;
    assert(ge.nextMilestone === M2, '第二个里程碑应为 ' + M2 + ' 人，实际 ' + ge.nextMilestone);
    ok('点卡即生效：无需「下一步」，' + countBefore + ' 人直接接着打，下一段 ' + M2 + ' 人');

    // 第二段的要求比第一段更高，且动态战场随规模继续扩大
    const M3 = M2 + ENDLESS.milestoneStepBase + ENDLESS.milestoneStepGrowth;
    while (ge.player.count < M2) ge.player.addUnit(ge.player.cx, ge.player.cy);
    await frames(30);
    assert(active('milestone-overlay'), '第二个里程碑未浮出奖励遮罩');
    assert(ge.dynR >= arenaR, '战场半径不应缩小');
    assert(ge.world.w >= e1WorldW, '战场不应缩小');
    ok('里程碑推进：' + M2 + ' 人（下一段 ' + M3 + ' 人）· 战场半径 ' + Math.round(ge.dynR) +
       'px（框 ' + ge.world.w + '×' + ge.world.h + '）· 同一场对局人数累积不重置');
    click(document.querySelectorAll('#ms-cards .reward-card')[0], '里程碑奖励卡2');
    await wait(600);
    assert(ge.nextMilestone === M3, '里程碑增量应逐段递增，第三段应为 ' + M3 + '，实际 ' + ge.nextMilestone);
    assert(ge.status === 'playing', '第二个里程碑选完未回到对局');

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

    /* ---- 16. 反馈与规模：抖动只在大事件 · 里程碑合并弹窗 · 猎手能真打回去 · 臃肿掉队 ---- */

    // (a) 按拍吞食不再抖：吞中立小人、每拍咬对手一口都不应产生屏幕抖动
    const vFb = mkGame({});
    vfClean.push(vFb);
    const vFbN = { x: vFb.player.cx, y: vFb.player.cy, vx: 0, vy: 0, ph: 0, dir: 0, t: 9 };
    vFb.neutrals.length = 0;
    vFb.neutrals.push(vFbN);
    vFb.buildUnitGrid();
    vFb.updateNeutrals(0.02);
    assert(vFb.shake === 0, '收编中立小人不应引起抖动，实际 shake=' + vFb.shake);
    const vFbFoe = vFb.legions.filter(L => !L.isPlayer)[0];
    vFbFoe.ai = null; vFbFoe.cx = vFb.player.cx + 20; vFbFoe.cy = vFb.player.cy;
    while (vFb.player.count < vFbFoe.count + 8) vFb.player.addUnit(vFb.player.cx, vFb.player.cy);
    for (let i = 0; i < 40; i++) vFb.updateCombat(0.02);
    assert(vFb.stats.eaten > 0, '本项验证需要真的咬到几口（验证构造失败）');
    assert(vFb.shake === 0, '每拍吞噬不应叠抖（旧版「批量×0.4」每拍都加，人多时事件更密 → 常驻震动），实际 shake=' + vFb.shake.toFixed(2));
    // 一批部分吞食（输家不死）：反馈应是接触点涟漪，而不是抖屏
    const vRip = mkGame({});
    vfClean.push(vRip);
    const rFoe = vRip.legions.filter(L => !L.isPlayer)[0];
    rFoe.ai = null; rFoe.cx = vRip.player.cx + 18; rFoe.cy = vRip.player.cy;
    while (rFoe.count < 40) rFoe.addUnit(rFoe.cx, rFoe.cy);
    while (vRip.player.count < 60) vRip.player.addUnit(vRip.player.cx, vRip.player.cy);
    vRip.particles.length = 0;
    const rC0 = rFoe.count;
    vRip.absorbBatch(rFoe, vRip.player, 5, 18);
    assert(rFoe.count === rC0 - 5 && rFoe.alive, '一批应削掉 5 个且输家存活，实际 ' + rFoe.count + ' 人（存活 ' + rFoe.alive + '）');
    assert(vRip.particles.filter(p => p.ring).length > 0, '部分吞食反馈应改用涟漪，实际涟漪数 ' + vRip.particles.filter(p => p.ring).length);
    assert(vRip.shake === 0, '部分吞食不应抖屏，实际 shake=' + vRip.shake);

    // (b) 吞掉整支军团才抖，而且同类事件 0.35s 内只计一次
    const vKill = vFb.absorbBatch(vFbFoe, vFb.player, vFbFoe.count, 20);
    assert(vKill > 0 && !vFbFoe.alive, '应一口吞掉整支敌军（实际吞 ' + vKill + ' 个，存活 ' + vFbFoe.alive + '）');
    const vShakeKill = vFb.shake;
    assert(vShakeKill > 0, '吞掉整支军团应该抖一下，实际 shake=' + vShakeKill);
    vFb.addShake(7, 'kill');
    assert(vFb.shake === vShakeKill, '同一时间窗口内同类大事件不应叠抖，实际 ' + vShakeKill + ' → ' + vFb.shake);

    // (c) 规模越大单次越轻：振幅上限按我方人数反向衰减
    vFb.player.clearUnits();
    while (vFb.player.count < 900) vFb.player.addUnit(vFb.player.cx, vFb.player.cy);
    const vCapBig = vFb.shakeCap();
    vFb.player.clearUnits();
    for (let i = 0; i < 6; i++) vFb.player.addUnit(vFb.player.cx, vFb.player.cy);
    assert(vCapBig < vFb.shakeCap(), '后期振幅上限应比前期更轻（' + vFb.shakeCap().toFixed(1) + ' → ' + vCapBig.toFixed(1) + '）');

    // (d) 「震屏：关」完全静屏（主菜单开关走 setShake），但红闪反馈仍在
    const vOff = mkGame({});
    vfClean.push(vOff);
    vOff.setShake(false);
    vOff.addShake(7, 'down');
    assert(vOff.shake === 0, '关掉震屏后不应有任何抖动，实际 shake=' + vOff.shake);
    vOff.setShake(true);
    vOff.addShake(7, 'down');
    assert(vOff.shake > 0, '实时打开震屏后应立刻生效，实际 shake=' + vOff.shake);
    vOff.setShake(false);
    assert(vOff.shake === 0, '实时关闭震屏应把当前正在跳的这一下一起抹掉，实际 shake=' + vOff.shake);
    // 被大口吞食：不靠抖动也能看见（边缘红闪）
    const vHurt = mkGame({});
    vfClean.push(vHurt);
    while (vHurt.player.count < 20) vHurt.player.addUnit(vHurt.player.cx, vHurt.player.cy);
    const vHurtFoe = vHurt.legions.filter(L => !L.isPlayer)[0];
    vHurtFoe.ai = null; vHurtFoe.cx = vHurt.player.cx + 20; vHurtFoe.cy = vHurt.player.cy;
    while (vHurtFoe.count < vHurt.player.count * 4) vHurtFoe.addUnit(vHurtFoe.cx, vHurtFoe.cy);
    vHurt.hurtFlash = 0;
    // 一批咬掉 5 个（≥3 且 ≥我方5%），但我方不死（若全部吞光会走“全覆”而非“被咬疼”）
    vHurt.absorbBatch(vHurt.player, vHurtFoe, 5, 20);
    assert(vHurt.player.alive && vHurt.player.count < 20, '本项需要我方被咬掉一批但未全覆，实际 ' + vHurt.player.count + ' 人（存活 ' + vHurt.player.alive + '）');
    assert(vHurt.hurtFlash > 0, '被大口吞食应有边缘红闪，实际 hurtFlash=' + vHurt.hurtFlash);
    const vHurt0 = vHurt.hurtFlash;
    for (let i = 0; i < 20; i++) vHurt.updateFx(0.02);
    assert(vHurt.hurtFlash < vHurt0, '红闪应自己衰减（' + vHurt0.toFixed(2) + ' → ' + vHurt.hurtFlash.toFixed(2) + '）');
    ok('屏幕反馈：吞食不抖（改涟漪）· 只有大事件抖 · 规模越大抖得越轻 · 同类事件节流 · 可开关 · 被吞有红闪');

    // (e) 里程碑：一口吞掉大军团可以跨很多段，但只弹一次窗，而且不会因此连弹
    const mkEnd = (run) => new MiniGame({
      canvas: $('game-canvas'), minimap: $('minimap'),
      level: makeEndlessLevel(), levelIndex: LEVELS.length - 1,
      run: Object.assign({ mode: 'endless', skillId: 'rush', startCount: 3, buffs: {} }, run || {}),
      hooks: vfHooks,
    });
    const vMs = mkEnd({});
    vfClean.push(vMs);
    const vMsCurve = endlessMilestoneThresholds(5);   // 设计曲线：[10, 50, 100, 160, 230]
    assert(vMsCurve.join(',') === '10,50,100,160,230', '前期设计曲线应为 10→50→100→160→230，实际 ' + vMsCurve.join(' → '));

    // 一口从 3 人吞到 100 人（跨过 10/50/100 三段）→ 只弹一次窗，但三段全部计入
    while (vMs.player.count < 100) vMs.player.addUnit(vMs.player.cx, vMs.player.cy);
    vMs.stats.peak = vMs.player.count;
    vMs.reachMilestone();
    assert(vMs.milestones === 3, '吞到 100 人应一次达到 3 个里程碑，实际 ' + vMs.milestones);
    assert(vMs.milestoneCrossed === 3, '一口跨多段应合并为一次弹窗（本例合并 3 段），实际合并 ' + vMs.milestoneCrossed + ' 段');
    assert(vMs.milestonePrev === 100 && vMs.nextMilestone === 160,
      '合并后阈值应落在设计曲线上（已达 100 → 下一段 160），实际 ' + vMs.milestonePrev + ' → ' + vMs.nextMilestone);

    // 段长必须按「阈值」推进，而不是按“刚吞到的人数”：否则吞一大口会把下一段抬得虚高
    vMs.status = 'playing';
    vMs.milestones = 0;
    vMs.nextMilestone = 50; vMs.milestonePrev = 10;   // 人数仍为 100
    vMs.reachMilestone();
    assert(vMs.milestoneCrossed === 2, '从 50 阈值吞到 100 人应跨过 50/90 两段，实际 ' + vMs.milestoneCrossed);
    // 第二段基于阈值 90 计算（step=50 → 140）；若错按“当前 100 人”则会算到 150
    assert(vMs.nextMilestone === 140, '段长应基于阈值(90)而非当前人数(100)推进，期望 140，实际 ' + vMs.nextMilestone);
    ok('里程碑合并弹窗：吞到 100 人跨 3 段只弹 1 次（已达 ' + vMs.milestonePrev + ' → 下一段 ' + vMs.nextMilestone +
       '），段长按阈值推进不被“刚吞一大口”抬高，前期曲线 ' + vMsCurve.join(' → ') + ' 不变');

    // (e2) 奖励池有终点：阈值封顶在硬上限，领完即明确告知（不留“永远够不到的 1800”）
    const vCapG = mkEnd({});
    vfClean.push(vCapG);
    while (vCapG.player.count < CFG.maxUnits) vCapG.player.addUnit(vCapG.player.cx, vCapG.player.cy);
    vCapG.stats.peak = vCapG.player.count;
    vCapG.nextMilestone = CFG.maxUnits; vCapG.milestonePrev = 0;
    vCapG.reachMilestone();
    assert(vCapG.nextMilestone === Infinity,
      '领到硬上限那一段后不应再排下一段（否则会算出一个永远够不到的阈值），实际 ' + vCapG.nextMilestone);
    vCapG.status = 'playing';
    vCapG.checkGoal();
    assert(vCapG.status === 'playing', '奖励全部领完后不应再弹窗，实际 status=' + vCapG.status);
    const vCurveFull = endlessMilestoneThresholds(40);   // 传 40 段，实际应在上限处自然收口
    assert(vCurveFull.every(v => v <= CFG.maxUnits),
      '阈值序列不得超出硬上限，实际最大 ' + Math.max.apply(null, vCurveFull));
    assert(vCurveFull[vCurveFull.length - 1] === CFG.maxUnits,
      '阈值序列最后一段应正好落在硬上限 ' + CFG.maxUnits + '，实际 ' + vCurveFull[vCurveFull.length - 1]);
    ok('奖励池有终点：阈值封顶在 ' + CFG.maxUnits + '（共 ' + vCurveFull.length +
       ' 段，尾段 ' + vCurveFull[vCurveFull.length - 2] + ' → ' + CFG.maxUnits + '）· 领完不再弹窗，HUD 改说「奖励已全部解锁」');

    // (f) 猎手军团：真的超过 AI 自己的捕食线，而且不会被 aiCap 卡死
    const vH = mkEnd({});
    vfClean.push(vH);
    vH.time = ENDLESS.hunterMinTime + 1;
    while (vH.player.count < ENDLESS.hunterMinPop + 80) vH.player.addUnit(vH.player.cx, vH.player.cy);
    vH.stats.peak = vH.player.count;
    const vHPop = vH.player.count;
    const vHunter = vH.spawnEndlessEnemy(vHPop, 0, true);
    assert(vHunter && vHunter.hunter === true, '猎手应正确标记');
    const vHTarget = endlessHunterTarget(vHPop);
    assert(vHTarget > vHPop * 1.3, '猎手人数必须跨过 AI 的 1.3× 捕食线，实际 ' + vHTarget + ' / 我方 ' + vHPop);
    assert(vHTarget <= vHPop * ENDLESS.hunterRatioMax + 1, '猎手不应大到大得没法逃，实际 ' + vHTarget);
    const vNorm = vH.spawnEndlessEnemy(vHPop, 1, false);
    assert(vHunter.ai.sp < vNorm.ai.sp,
      '猎手应比同规模普通敌军更慢（才能靠 playerBonus 跑掉），实际 ' + vHunter.ai.sp.toFixed(3) + ' < ' + vNorm.ai.sp.toFixed(3));
    assert(vH.hunterAggro(vHunter) > 1000, '猎手索敌半径应按战场半径给（普通敌军仍是 1000px），实际 ' + vH.hunterAggro(vHunter).toFixed(0));
    assert(vH.hunterAggro(vNorm) === 1000, '普通敌军索敌半径不应被改动');
    // aiCap 豁免：否则猎手永远长不到能捕食的规模（收编按单位位置判定，所以把两方单位都挪到远离玩家处）
    const mkFoe = (hunterFlag) => {
      const gg = mkEnd({});
      vfClean.push(gg);
      const foe = gg.legions.filter(L => !L.isPlayer)[0];
      foe.ai = null; foe.hunter = !!hunterFlag; foe.clearUnits();
      const fx = gg.player.cx + 1200, fy = gg.player.cy;   // 必须在动态战场内（否则中立会被夹回、碰不到该军团）
      foe.cx = fx; foe.cy = fy;
      for (let i = 0; i < 3; i++) foe.addUnit(fx, fy);
      gg.aiCap = 1;                       // 闸门远低于当前 3 人：普通敌军应卡住，猎手应豁免
      gg.neutrals.length = 0;
      for (let i = 0; i < 6; i++) gg.neutrals.push({ x: fx + 2, y: fy, vx: 0, vy: 0, ph: 0, dir: 0, t: 9 });
      gg.buildUnitGrid();
      gg.updateNeutrals(0.02);
      return { gg, foe };
    };
    const vCapH = mkFoe(true);
    assert(vCapH.foe.count > 3, '猎手应能突破 aiCap 继续收编（否则机制空转），实际 ' + vCapH.foe.count + ' 人');
    const vCapN = mkFoe(false);
    assert(vCapN.foe.count === 3, '普通敌军到 aiCap 后不应再收编（只有猎手豁免），实际 ' + vCapN.foe.count + ' 人');
    // 前期不刷猎手
    const vHEarly = mkEnd({});
    vfClean.push(vHEarly);
    vHEarly.time = 0;
    while (vHEarly.player.count > 3) vHEarly.player.removeUnitAt(vHEarly.player.units.length - 1);
    vHEarly.stats.peak = vHEarly.player.count;
    let vHEver = false;
    for (let i = 0; i < 200; i++) {
      vHEarly.endlessRamp();
      if (vHEarly.legions.some(L => L.hunter)) { vHEver = true; break; }
    }
    assert(!vHEver, '未满 hunterMinTime / hunterMinPop 的前期不应刷猎手');
    ok('猎手军团：人数 ' + vHTarget + '（我方 ' + vHPop + '，×' + (vHTarget / vHPop).toFixed(2) + '）真的跨过 1.3× 捕食线 · 更慢但索敌覆盖全场 · aiCap 豁免 · 前期不出现');

    // (f2) 猎手只认玩家：不会被更近的普通敌军带偏
    const vFocus = mkEnd({});
    vfClean.push(vFocus);
    const pF = vFocus.player;
    const hF = vFocus.spawnEndlessEnemy(pF.count, 0, true);
    const nF = vFocus.spawnEndlessEnemy(pF.count, 1, false);
    nF.ai = null;
    // 把普通敌军摆在「猎手 → 玩家」的连线上（离猎手更近，且一定还在战场内）
    const fdx = pF.cx - hF.cx, fdy = pF.cy - hF.cy, fdl = Math.hypot(fdx, fdy) || 1;
    nF.cx = hF.cx + (fdx / fdl) * 220; nF.cy = hF.cy + (fdy / fdl) * 220;
    while (nF.count < Math.max(3, Math.floor(hF.count / 2))) nF.addUnit(nF.cx, nF.cy);
    hF.ai.t = 0;
    vFocus.aiThink(hF, 0.02);
    assert(Math.abs(hF.target.x - pF.cx) < 5 && Math.abs(hF.target.y - pF.cy) < 5,
      '猎手应无视更近的普通敌军、直奔玩家，实际目标 (' + hF.target.x.toFixed(0) + ',' + hF.target.y.toFixed(0) +
      ')，玩家在 (' + pF.cx.toFixed(0) + ',' + pF.cy.toFixed(0) + ')');

    // (f3) 猎手规模跟随【当前人数】而非峰值（掉队后 peak 仍很高，按 peak 会生成必死猎手）
    const vCount = mkEnd({});
    vfClean.push(vCount);
    while (vCount.player.count < 200) vCount.player.addUnit(vCount.player.cx, vCount.player.cy);
    vCount.stats.peak = 800;                                  // 峰值远高于当前人数（模拟掉队之后）
    const hByCount = vCount.spawnEndlessEnemy(vCount.stats.peak, 0, true);
    assert(hByCount.count <= vCount.player.count * ENDLESS.hunterRatioMax + 2,
      '猎手应按当前人数(' + vCount.player.count + ')定规模而不是峰值(' + vCount.stats.peak + ')，实际 ' + hByCount.count);

    // (f4) 猎手被吞掉后有刷新冷却；掉队期间不再加压
    const vHunterCd = mkEnd({});
    vfClean.push(vHunterCd);
    vHunterCd.time = ENDLESS.hunterMinTime + 5;
    while (vHunterCd.player.count < ENDLESS.hunterMinPop + 60) vHunterCd.player.addUnit(vHunterCd.player.cx, vHunterCd.player.cy);
    vHunterCd.stats.peak = vHunterCd.player.count;
    const hCd = vHunterCd.spawnEndlessEnemy(vHunterCd.player.count, 0, true);
    vHunterCd.destroyLegion(hCd, vHunterCd.player);
    assert(vHunterCd.hunterCd === ENDLESS.hunterRespawn,
      '猎手被吞掉应启动 ' + ENDLESS.hunterRespawn + 's 刷新冷却，实际 ' + vHunterCd.hunterCd);
    for (let i = 0; i < ENDLESS.hunterRespawn - 1; i++) vHunterCd.endlessRamp();
    assert(!vHunterCd.legions.some(L => L.hunter && L.alive), '冷却期内不应再刷猎手');
    for (let i = 0; i < 6; i++) vHunterCd.endlessRamp();
    assert(vHunterCd.hunterCd <= 0, '冷却应随时间递减归零，实际 ' + vHunterCd.hunterCd);
    // 掉队期间同样禁止刷猎手（被压 + 被猎 = 必死）
    const vStallH = mkEnd({});
    vfClean.push(vStallH);
    vStallH.time = ENDLESS.hunterMinTime + 5;
    while (vStallH.player.count < ENDLESS.hunterMinPop + 60) vStallH.player.addUnit(vStallH.player.cx, vStallH.player.cy);
    vStallH.stats.peak = vStallH.player.count;
    vStallH.stallDraining = true;
    for (let i = 0; i < 40; i++) vStallH.endlessRamp();
    assert(!vStallH.legions.some(L => L.hunter && L.alive), '臃肿掉队期间不应再刷猎手（避免双重打击变成必死）');
    ok('猎手调度：只猎玩家 · 规模跟当前人数（不跟峰值）· 被吞后 ' + ENDLESS.hunterRespawn +
       's 冷却 · 掉队期间不再加压');

    // (g) 臃肿掉队：顶死硬上限 8 秒后开掉，回到地板就停手（不靠提上限）
    const vSt = mkEnd({});
    vfClean.push(vSt);
    while (vSt.player.count < CFG.maxUnits) vSt.player.addUnit(vSt.player.cx, vSt.player.cy);
    const vStCap = vSt.player.count, vStNeu = vSt.neutrals.length;
    assert(vStCap === CFG.maxUnits, '本项验证需要顶死硬上限，实际 ' + vStCap);
    for (let i = 0; i < 350; i++) vSt.updateStall(0.02);      // 7 秒：未到贴顶时长，不该掉
    assert(vSt.player.count === vStCap, '贴着上限不满 ' + ENDLESS.stallHold + ' 秒不应掉人，实际剩 ' + vSt.player.count);
    for (let i = 0; i < 400; i++) vSt.updateStall(0.02);      // 再过 8 秒 → 超过阈值，开始掉队
    const vStAfter = vSt.player.count;
    assert(vStAfter < vStCap, '长时间臃肿应开始掉队，实际仍 ' + vStAfter);
    assert(vSt.neutrals.length > vStNeu, '掉队的人应变回中立小人（不凭空消失），中立 ' + (vSt.neutrals.length - vStNeu) + ' 个回流');
    for (let i = 0; i < 4000; i++) vSt.updateStall(0.02);
    const vStFloor = Math.round(CFG.maxUnits * ENDLESS.stallFloor);
    assert(Math.abs(vSt.player.count - vStFloor) <= 2, '回落到地板（' + vStFloor + '）应停手，实际 ' + vSt.player.count);
    ok('臃肿掉队：顶死 ' + ENDLESS.stallHold + 's 后每秒 -' + (ENDLESS.stallDrain * 100).toFixed(1) + '%，回落到 ' + vStFloor + ' 人停住（上限仍是 ' + CFG.maxUnits + '，不提上限也不卡帧）');

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
    ' endlessMilestoneStep: endlessMilestoneStep, endlessMilestoneThresholds: endlessMilestoneThresholds,' +
    ' endlessHunterTarget: endlessHunterTarget, makeEndlessLevel: makeEndlessLevel,' +
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
