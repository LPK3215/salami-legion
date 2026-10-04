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
  const { UI, Save, LEVELS, SKINS, SKILLS, SKILL_LIST, START_OPTIONS, ACHIEVEMENTS } = window.__APP__;
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
    await frames(240);
    assert(p.count > c0, '接近中立小人后人数未增长: ' + c0 + ' -> ' + p.count);
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
      await frames(20);
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
      await frames(20);
      minMe = Math.min(minMe, p.count);
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

    /* ========== 15. 无尽模式（无限层数 + 棋盘逐层扩大） ========== */
    click($('btn-endless'), 'btn-endless');
    assert(active('screen-prep'), '无尽模式未进入出征准备页');
    assert(String($('prep-title').textContent).indexOf('无尽') >= 0, '无尽准备页标题未体现模式');
    click($('btn-prep-go'), 'btn-prep-go');
    await wait(220);
    const ge = UI.game;
    assert(ge, '无尽模式游戏实例未创建');
    assert(ge.level.endless === true, '关卡未标记为无尽模式');
    assert(ge.level.stage === 1, '无尽起始层应为 1，实际 ' + ge.level.stage);
    ok('无尽模式启动：第 ' + ge.level.stage + ' 层 · 目标 ' + ge.level.goal.val +
       ' 人 · 敌军 ' + ge.level.enemies.length + ' 支 · 棋盘 ' + ge.world.w + '×' + ge.world.h);

    const e1Goal = ge.level.goal.val, e1WorldW = ge.world.w;
    while (ge.player.count < e1Goal) ge.player.addUnit(ge.player.cx, ge.player.cy);
    await frames(30);
    assert(active('screen-reward'), '无尽通关后未弹出奖励页');
    assert(Save.data.stats.endlessBest === 1, '最高层纪录未更新，实际 ' + Save.data.stats.endlessBest);
    const cards2 = document.querySelectorAll('#reward-cards .reward-card');
    assert(cards2.length === 3, '无尽奖励仍应为三选一');
    click(cards2[0], '无尽奖励卡');
    assert(String($('btn-reward-next').textContent).indexOf('下一层') >= 0,
      '无尽模式按钮文案应为“进入下一层”，实际 ' + $('btn-reward-next').textContent);
    ok('无尽通关结算：三选一正常，纪录 第 ' + Save.data.stats.endlessBest + ' 层，按钮文案正确');

    click($('btn-reward-next'), 'btn-reward-next');
    await wait(240);
    const ge2 = UI.game;
    assert(ge2 && ge2 !== ge, '未创建新的无尽关卡实例');
    assert(ge2.level.stage === 2, '应进入第 2 层，实际 ' + (ge2 && ge2.level.stage));
    assert(ge2.level.goal.val > e1Goal, '层数提升后目标人数应更高');
    assert(ge2.level.enemies.length >= ge.level.enemies.length, '层数提升后敌军数量不应减少');
    assert(ge2.world.w > e1WorldW, '层数提升后棋盘应变大');
    ok('无尽推进：第 2 层 · 目标 ' + ge2.level.goal.val + ' 人 · 棋盘 ' + ge2.world.w + '×' + ge2.world.h + '（逐层扩大）');

    assert(UI.run && UI.run.mode === 'endless', 'run.mode 应为 endless');
    assert(String($('hud-level').textContent).indexOf('无尽') >= 0, 'HUD 关卡标题未体现无尽');

    click($('btn-pause'), 'btn-pause');
    click($('btn-quit'), 'btn-quit');
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
