/* ==========================================================
   蚕食军团 · 核心引擎
   特色：军团接触后【逐个单位吞噬】，而非一次性吞并整队
   ========================================================== */

(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- 编队站位表（黄金角螺旋，均匀铺满圆盘） ---------------- */
  const SLOTS = [];
  (function () {
    for (let i = 0; i < CFG.maxUnits; i++) {
      const ang = i * 2.399963229728653;
      const r = CFG.unit.spacing * Math.sqrt(i) * 0.95 + (i ? 2 : 0);
      SLOTS.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
  })();
  function blobRadius(count) {
    if (count <= 1) return CFG.unit.r + 2;
    return CFG.unit.spacing * Math.sqrt(count - 1) * 0.95 + CFG.unit.r + 3;
  }

  /* ---------------- 小人精灵图预渲染 ---------------- */
  const spriteCache = new Map();
  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.lineTo(x + w - rr, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rr);
    g.lineTo(x + w, y + h - rr);
    g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    g.lineTo(x + rr, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - rr);
    g.lineTo(x, y + rr);
    g.quadraticCurveTo(x, y, x + rr, y);
    g.closePath();
  }
  function makeSprite(body, style) {
    const key = body + '|' + style;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const S = 4, W = 24, H = 27;
    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    const g = cv.getContext('2d');
    g.scale(S, S);
    g.translate(W / 2, H / 2);

    const dark = shade(body, -0.34);
    const lite = shade(body, 0.30);
    const skinC = '#ffd9b3';
    const skinD = shade('#ffd9b3', -0.22);

    // 影子
    g.fillStyle = 'rgba(0,0,0,0.20)';
    g.beginPath(); g.ellipse(0, 9.6, 8.0, 3.2, 0, 0, TAU); g.fill();

    // 身体
    roundRect(g, -6.5, -1.8, 13.0, 11.6, 5.4); g.fillStyle = dark; g.fill();
    roundRect(g, -5.9, -2.4, 11.8, 11.2, 4.9); g.fillStyle = body; g.fill();
    // 身体高光
    g.beginPath(); g.ellipse(-2.4, -0.4, 3.0, 2.0, -0.35, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.30)'; g.fill();

    // 小手
    g.fillStyle = dark;
    g.beginPath(); g.arc(-6.3, 2.0, 1.9, 0, TAU); g.arc(6.3, 2.0, 1.9, 0, TAU); g.fill();

    // 头
    g.beginPath(); g.arc(0, -6.8, 4.75, 0, TAU); g.fillStyle = dark; g.fill();
    g.beginPath(); g.arc(0, -7.2, 4.25, 0, TAU); g.fillStyle = skinC; g.fill();

    // 眼睛
    g.fillStyle = '#3a2f33';
    g.beginPath(); g.arc(-1.55, -7.3, 0.72, 0, TAU); g.arc(1.55, -7.3, 0.72, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(-1.3, -7.6, 0.26, 0, TAU); g.arc(1.8, -7.6, 0.26, 0, TAU); g.fill();

    // 造型
    if (style === 'cap') {
      g.beginPath(); g.arc(0, -8.2, 4.5, Math.PI, TAU); g.fillStyle = lite; g.fill();
      roundRect(g, -5.6, -9.2, 11.2, 2.2, 1.1); g.fillStyle = shade(body, 0.05); g.fill();
    } else if (style === 'glasses') {
      g.strokeStyle = '#2b2b38'; g.lineWidth = 0.85;
      g.beginPath(); g.arc(-1.7, -7.3, 1.75, 0, TAU); g.stroke();
      g.beginPath(); g.arc(1.7, -7.3, 1.75, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(-0.05, -7.3); g.lineTo(0.05, -7.3); g.stroke();
      g.fillStyle = 'rgba(120,200,255,0.4)';
      g.beginPath(); g.arc(-1.7, -7.3, 1.6, 0, TAU); g.arc(1.7, -7.3, 1.6, 0, TAU); g.fill();
    } else if (style === 'ninja') {
      g.fillStyle = shade(body, -0.55);
      roundRect(g, -4.6, -9.4, 9.2, 3.0, 1.2); g.fill();
      g.beginPath(); g.moveTo(3.2, -8.4); g.lineTo(7.6, -6.4); g.lineTo(7.0, -9.0); g.closePath(); g.fill();
    } else if (style === 'horn') {
      g.fillStyle = '#ffe9c9';
      g.beginPath(); g.moveTo(-3.6, -10.4); g.lineTo(-2.0, -14.2); g.lineTo(-1.0, -10.0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(3.6, -10.4); g.lineTo(2.0, -14.2); g.lineTo(1.0, -10.0); g.closePath(); g.fill();
    } else if (style === 'crown') {
      g.fillStyle = '#ffd93d';
      g.beginPath();
      g.moveTo(-4.4, -10.4); g.lineTo(-4.4, -13.6); g.lineTo(-2.2, -11.6);
      g.lineTo(0, -14.4); g.lineTo(2.2, -11.6); g.lineTo(4.4, -13.6);
      g.lineTo(4.4, -10.4); g.closePath(); g.fill();
      g.fillStyle = '#ff5b6e';
      g.beginPath(); g.arc(0, -12.0, 0.7, 0, TAU); g.fill();
    } else if (style === 'helmet') {
      g.beginPath(); g.arc(0, -7.2, 5.0, Math.PI, TAU); g.fillStyle = '#b9c4d4'; g.fill();
      roundRect(g, -5.4, -8.4, 10.8, 1.6, 0.8); g.fillStyle = '#8e99ab'; g.fill();
      g.beginPath(); g.arc(0, -12.6, 1.4, 0, TAU); g.fillStyle = '#ffd93d'; g.fill();
    } else if (style === 'rainbow') {
      g.beginPath(); g.arc(0, -7.2, 4.25, Math.PI * 0.15, Math.PI * 0.85);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.1; g.stroke();
    }
    spriteCache.set(key, cv);
    return cv;
  }

  /* ---------------- 军团 ---------------- */
  let LID = 0;
  class Legion {
    constructor(o) {
      this.id = ++LID;
      this.name = o.name;
      this.body = o.body;
      this.style = o.style || 'plain';
      this.isPlayer = !!o.isPlayer;
      this.units = [];
      this.cx = o.x; this.cy = o.y;
      this.cvx = 0; this.cvy = 0;
      this.target = { x: o.x, y: o.y };
      this.alive = true;
      this.ai = o.ai || null;
      this.fx = {};               // 技能效果 {id: remainTime}
      this.skillCd = 0;
      this.sprites = [];
      this.buildSprites();
      this.flash = 0;
      this.lastEat = 0;
      this.totalEaten = 0;
      this.totalLost = 0;
    }
    buildSprites() {
      const list = [];
      if (this.style === 'rainbow') {
        const hues = ['#ff5b6e', '#ffa63d', '#ffd93d', '#2ee6a8', '#4dd2ff', '#a66bff', '#ff6fd8'];
        for (const h of hues) list.push(makeSprite(h, 'rainbow'));
      } else {
        list.push(makeSprite(this.body, this.style));
      }
      this.sprites = list;
    }
    get count() { return this.units.length; }
    get radius() { return blobRadius(this.units.length); }

    addUnit(x, y, opts) {
      if (this.units.length >= CFG.maxUnits) return null;
      const u = {
        x, y, vx: 0, vy: 0,
        ph: Math.random() * TAU,
        flash: 0,
        temp: (opts && opts.temp) ? opts.temp : 0,
        L: this,
      };
      this.units.push(u);
      return u;
    }
    removeUnitAt(i) { return this.units.splice(i, 1)[0]; }
    hasFx(id) { return this.fx[id] > 0; }
    clearUnits() { this.units.length = 0; }
  }

  /* ---------------- 主游戏类 ---------------- */
  class Game {
    constructor(opts) {
      this.canvas = opts.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.mm = opts.minimap || null;
      this.mmCtx = this.mm ? this.mm.getContext('2d') : null;
      this.level = opts.level;
      this.levelIndex = opts.levelIndex;
      this.run = opts.run;                 // {skillId, startCount, buffs:{}}
      this.hooks = opts.hooks || {};
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      // 地图尺寸：默认取全局配置，无尽模式等可由关卡注入更大棋盘
      this.world = {
        w: (opts.world && opts.world.w) || CFG.world.w,
        h: (opts.world && opts.world.h) || CFG.world.h,
      };

      this.buff = this.computeBuffs(this.run.buffs || {});
      this.time = 0;
      this.status = 'playing';             // playing | paused | over
      this.particles = [];
      this.texts = [];
      this.contacts = [];
      this.shake = 0;
      this.pairTimers = new Map();
      this.decor = [];
      this.spawnAcc = 0;
      this.hudAcc = 0;
      this.unitGrid = new Map();
      this.cell = 46;

      this.legions = [];
      this.neutrals = [];
      this.player = null;
      this.stats = {
        eaten: 0, lost: 0, peak: 0, minCount: 999,
        usedSkillLow: false, minBeforeSkill: 999, flawless: true,
      };
      /* ---------------- 输入系统 ---------------- */
      // 鼠标跟随：屏幕坐标 + 是否生效（桌面端）
      this.pointer = { x: 0, y: 0, active: false, pointerId: null };
      // 键盘：x / y 取值 -1 / 0 / 1（支持斜向）
      this.keys = { x: 0, y: 0 };
      // 虚拟摇杆（触屏主控）：按下位置为原点，拖动方向与幅度决定移动方向与速度
      this.stick = {
        active: false, pointerId: null,
        originX: 0, originY: 0, knobX: 0, knobY: 0,
        axisX: 0, axisY: 0, strength: 0, maxR: 72,
      };
      this.inputKind = 'mouse';                 // mouse | touch | keyboard（最近一次输入设备）
      this.lastInput = 'idle';                  // idle | pointer | keys | stick
      this.controlMode = opts.controlMode || 'auto';   // auto | joystick | follow
      this._activePointers = new Map();         // 追踪多指，避免互相干扰
      this._held = new Set();                  // 当前按住的方向键（支持斜向组合）
      this.neutralSprite = makeSprite('#e9edf7', 'plain');
      this.cam = { x: 0, y: 0, zoom: 1, tzoom: 1 };
      this.dangerRatio = 0;

      this.resize();
      this.buildWorld();
      this.bindEvents();
    }

    /* ===== 增益换算 ===== */
    computeBuffs(stack) {
      const out = { startCount: 0, neutral: 0, speed: 0, atk: 0, pickup: 0, enemyStart: 0, cd: 0 };
      BUFFS.forEach(b => {
        const n = stack[b.id] || 0;
        if (n > 0) out[b.stat] += b.val * Math.min(n, b.max);
      });
      return out;
    }

    /* ===== 世界生成 ===== */
    buildWorld() {
      const W = this.world.w, H = this.world.h;
      const L = this.level;

      // 装饰物（草丛/石堆）：数量随地图面积自适应
      const decoColors = ['#2a7a4f', '#2f8a58', '#357a63', '#3a6f7a', '#4a6b8a'];
      const decoCount = Math.max(60, Math.round(W * H / 73000));
      for (let i = 0; i < decoCount; i++) {
        this.decor.push({
          x: rnd(60, W - 60), y: rnd(60, H - 60),
          r: rnd(16, 42), c: decoColors[(Math.random() * decoColors.length) | 0],
          s: Math.random() * TAU,
        });
      }

      // 玩家
      const skin = SKINS.find(s => s.id === Save.data.skinSelected) || SKINS[0];
      const startCount = clamp(this.run.startCount + this.buff.startCount, 1, CFG.maxUnits);
      this.player = new Legion({
        name: '我方军团', body: skin.body, style: skin.style, isPlayer: true,
        x: W / 2, y: H / 2,
      });
      this.player.target = { x: W / 2, y: H / 2 };
      this.legions.push(this.player);

      // 中立小人
      const neutralTarget = Math.round((L.neutral || 140) * (1 + this.buff.neutral));
      this.neutralTarget = Math.min(neutralTarget, CFG.neutralMax);

      // AI 人数上限：避免敌军无限滚雪球，保证关卡可完成
      const maxStart = Math.max.apply(null, L.enemies.map(e => e.c)) || 10;
      this.aiCap = Math.round(maxStart * 2.0 + 18);
      for (let i = 0; i < this.neutralTarget; i++) this.spawnNeutral(260);

      // 敌军团：配色避开玩家颜色
      const palettes = ENEMY_PALETTES.filter(p => colorDistance(p.body, skin.body) > 150);
      const pool = palettes.length >= L.enemies.length ? palettes : ENEMY_PALETTES;
      const used = [];
      L.enemies.forEach((e, i) => {
        let pal = pool[(i + 1) % pool.length];
        let guard = 0;
        while (used.indexOf(pal) >= 0 && guard++ < 20) pal = pool[(Math.random() * pool.length) | 0];
        used.push(pal);

        const ang = (i / L.enemies.length) * TAU + rnd(-0.3, 0.3);
        const rad = rnd(680, 1050);
        const x = clamp(W / 2 + Math.cos(ang) * rad, 140, W - 140);
        const y = clamp(H / 2 + Math.sin(ang) * rad, 140, H - 140);
        const A = new Legion({
          name: pal.name, body: pal.body, style: 'plain', x, y,
          ai: { c: e.c, sp: e.sp, ag: e.ag, react: e.react, t: Math.random() * 0.5 },
        });
        A.target = { x, y };
        this.legions.push(A);
      });

      // 初始单位
      this.spawnUnitsCircle(this.player, startCount, this.player.cx, this.player.cy, 60);
      for (let i = 1; i < this.legions.length; i++) {
        const A = this.legions[i];
        const c = Math.max(2, A.ai.c + this.buff.enemyStart);
        this.spawnUnitsCircle(A, c, A.cx, A.cy, 60);
      }

      this.recenterCamera(true);

      const sk = SKILLS[this.run.skillId];
      this.player.skillCd = 0;
      if (sk) this.player.skillCdMax = sk.cd;
    }

    spawnUnitsCircle(legion, n, cx, cy, r) {
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * TAU + Math.random();
        const rad = n === 1 ? 0 : r * Math.sqrt(Math.random());
        legion.addUnit(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
    }

    spawnNeutral(minDist) {
      if (this.neutrals.length >= CFG.neutralMax) return;
      const W = this.world.w, H = this.world.h;
      let x = 0, y = 0, ok = false;
      for (let t = 0; t < 12; t++) {
        x = rnd(60, W - 60); y = rnd(60, H - 60);
        ok = true;
        for (const L of this.legions) {
          if (!L.alive) continue;
          if (dist2(x, y, L.cx, L.cy) < minDist * minDist) { ok = false; break; }
        }
        if (ok) break;
      }
      this.neutrals.push({
        x, y, vx: rnd(-12, 12), vy: rnd(-12, 12),
        ph: Math.random() * TAU, dir: Math.random() * TAU, t: rnd(0.6, 2.2),
      });
    }

    /* ===== 事件绑定 ===== */
    bindEvents() {
      const cv = this.canvas;

      /* 屏幕坐标 → canvas 本地坐标 */
      const localPt = (e) => {
        const r = cv.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      /* 事件来源设备；jsdom / 老浏览器可能没有 pointerType，按鼠标处理 */
      const ptype = (e) => e.pointerType || 'mouse';
      /* 是否使用虚拟摇杆：鼠标永远用指针跟随，触屏默认摇杆 */
      const useStick = (t) => t !== 'mouse' && this.controlMode !== 'follow';

      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);

      /* ---------- 按下 ---------- */
      this._onDown = (e) => {
        if (this.status === 'over') return;
        if (this.hooks.onInput) this.hooks.onInput();
        const t = ptype(e);
        const p = localPt(e);
        this.inputKind = t;
        if (e.pointerId !== undefined) this._activePointers.set(e.pointerId, t);

        // 换设备操作时清掉上一设备的状态，避免触屏松手后又被残留的鼠标位置拖着走
        if (t !== 'mouse') {
          this.pointer.active = false;
          this.pointer.pointerId = null;
        }

        if (!useStick(t)) {
          // 指针跟随模式（鼠标 / 触屏可选“跟随手指”）
          this.pointer.x = p.x;
          this.pointer.y = p.y;
          this.pointer.active = true;
          if (e.pointerId !== undefined) this.pointer.pointerId = e.pointerId;
          return;
        }

        // 虚拟摇杆：只认第一根按在画布上的手指，多指操作不会互相干扰
        if (this.stick.pointerId !== null) return;
        this.stick.pointerId = e.pointerId;
        this.stick.active = true;
        this.stick.originX = p.x;
        this.stick.originY = p.y;
        this.stick.knobX = p.x;
        this.stick.knobY = p.y;
        this.stick.axisX = 0;
        this.stick.axisY = 0;
        this.stick.strength = 0;
        this.lastInput = 'stick';
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 部分环境不支持 */ }
      };

      /* ---------- 移动 ---------- */
      this._onMove = (e) => {
        const t = ptype(e);

        if (t === 'mouse') {
          if (useStick(t)) return;
          const p = localPt(e);
          this.pointer.x = p.x;
          this.pointer.y = p.y;
          this.pointer.active = true;
          return;
        }

        // 触屏：只有操控摇杆的那根手指有效
        if (e.pointerId !== this.stick.pointerId) {
          if (this.controlMode === 'follow') {
            const p = localPt(e);
            this.pointer.x = p.x;
            this.pointer.y = p.y;
            this.pointer.active = true;
          }
          return;
        }
        this.updateStick(localPt(e));
      };

      /* ---------- 抬起 / 取消 ---------- */
      this._onUp = (e) => {
        const t = ptype(e);
        if (e.pointerId !== undefined) this._activePointers.delete(e.pointerId);

        if (t !== 'mouse' && e.pointerId === this.stick.pointerId) {
          this.stick.active = false;
          this.stick.pointerId = null;
          this.stick.axisX = 0;
          this.stick.axisY = 0;
          this.stick.strength = 0;
          try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          // lastInput 保持 'stick'，下一帧由 updateControl 让军团停住
        }
        if (t !== 'mouse' && e.pointerId === this.pointer.pointerId) {
          this.pointer.active = false;
          this.pointer.pointerId = null;
        }
      };

      cv.addEventListener('pointerdown', this._onDown);
      cv.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onUp);

      /* 长按不弹右键菜单、不做双指缩放 */
      this._onCtx = (e) => e.preventDefault();
      this._onGest = (e) => e.preventDefault();
      cv.addEventListener('contextmenu', this._onCtx);
      cv.addEventListener('gesturestart', this._onGest);
      cv.addEventListener('gesturechange', this._onGest);
      cv.addEventListener('dblclick', this._onCtx);

      /* ---------- 键盘 ----------
         用「按住集合」推导方向，才能正确处理同时按住 W+D 这类斜向组合 */
      this._keyDir = (lk) => {
        if (lk === 'a' || lk === 'arrowleft') return 'left';
        if (lk === 'd' || lk === 'arrowright') return 'right';
        if (lk === 'w' || lk === 'arrowup') return 'up';
        if (lk === 's' || lk === 'arrowdown') return 'down';
        return null;
      };
      this._syncKeys = () => {
        const s = this._held;
        let x = 0, y = 0;
        if (s.has('left')) x -= 1;
        if (s.has('right')) x += 1;
        if (s.has('up')) y -= 1;
        if (s.has('down')) y += 1;
        // 同时按住相反方向时互相抵消
        this.keys.x = x;
        this.keys.y = y;
      };

      this._onKey = (e) => {
        const lk = String(e.key || '').toLowerCase();

        const dir = this._keyDir(lk);
        if (dir) {
          if (this.status === 'playing') {
            this._held.add(dir);
            this._syncKeys();
            this.inputKind = 'keyboard';
          }
          e.preventDefault();
          return;
        }
        if (lk === ' ' || lk === 'e' || lk === 'k') {
          if (!e.repeat) this.useSkill();
          e.preventDefault();
          return;
        }
        if (lk === 'escape' || lk === 'p') {
          e.preventDefault();
          if (this.hooks.onPauseToggle) this.hooks.onPauseToggle();
          else if (this.status === 'playing') this.pause();
          else this.resume();
        }
      };

      this._onKeyUp = (e) => {
        const dir = this._keyDir(String(e.key || '').toLowerCase());
        if (dir) {
          this._held.delete(dir);
          this._syncKeys();
        }
      };

      window.addEventListener('keydown', this._onKey);
      window.addEventListener('keyup', this._onKeyUp);

      /* ---------- 切到后台自动暂停并松开所有输入 ---------- */
      this._onVis = () => {
        if (!document.hidden) return;
        this.releaseInput();
        if (this.status === 'playing') {
          this.pause();
          if (this.hooks.onAutoPause) this.hooks.onAutoPause();
        }
      };
      this._onBlur = () => this.releaseInput();
      document.addEventListener('visibilitychange', this._onVis);
      window.addEventListener('blur', this._onBlur);
    }

    /* 松开全部输入（切后台 / 失焦时调用，避免“卡住一直走”） */
    releaseInput() {
      if (this._held) {
        this._held.clear();
      }
      this.keys.x = 0;
      this.keys.y = 0;
      this.pointer.active = false;
      this.pointer.pointerId = null;
      this.stick.active = false;
      this.stick.pointerId = null;
      this.stick.axisX = 0;
      this.stick.axisY = 0;
      this.stick.strength = 0;
      this.lastInput = 'idle';
    }

    /* 摇杆：手指位置 → 方向 + 力度；手指拖出范围时原点会跟着走（橡皮筋） */
    updateStick(p) {
      const s = this.stick;
      let dx = p.x - s.originX;
      let dy = p.y - s.originY;
      let dist = Math.hypot(dx, dy);

      if (dist > s.maxR) {
        const k = 1 - s.maxR / dist;
        s.originX += dx * k;
        s.originY += dy * k;
        dx = p.x - s.originX;
        dy = p.y - s.originY;
        dist = Math.hypot(dx, dy);
      }

      const d = dist || 1;
      const raw = Math.min(1, dist / s.maxR);
      const DEAD = 0.14;    // 死区：轻微抖动不产生移动
      const FULL = 0.72;    // 拉到 72% 即满速，手感更跟手
      const st = raw < DEAD ? 0 : Math.min(1, (raw - DEAD) / (FULL - DEAD));

      if (st === 0) {
        s.axisX = 0;
        s.axisY = 0;
        s.strength = 0;
      } else {
        s.axisX = dx / d;
        s.axisY = dy / d;
        s.strength = st;
      }
      const knobR = Math.min(dist, s.maxR * 0.7);
      s.knobX = s.originX + (dx / d) * knobR;
      s.knobY = s.originY + (dy / d) * knobR;
    }

    destroy() {
      window.removeEventListener('resize', this._onResize);
      this.canvas.removeEventListener('pointerdown', this._onDown);
      this.canvas.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onUp);
      this.canvas.removeEventListener('contextmenu', this._onCtx);
      this.canvas.removeEventListener('gesturestart', this._onGest);
      this.canvas.removeEventListener('gesturechange', this._onGest);
      this.canvas.removeEventListener('dblclick', this._onCtx);
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('keyup', this._onKeyUp);
      document.removeEventListener('visibilitychange', this._onVis);
      window.removeEventListener('blur', this._onBlur);
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.vw = Math.max(320, rect.width);
      this.vh = Math.max(320, rect.height);
      this.canvas.width = Math.floor(this.vw * this.dpr);
      this.canvas.height = Math.floor(this.vh * this.dpr);
      this.canvas.style.width = this.vw + 'px';
      this.canvas.style.height = this.vh + 'px';
      // 摇杆半径随屏幕尺寸自适应（小屏不至于占满，大屏不至于太小）
      this.stick.maxR = clamp(Math.min(this.vw, this.vh) * 0.17, 46, 96);
    }

    /* ===== 主循环 ===== */
    start() {
      this.lastT = performance.now();
      const loop = (now) => {
        if (!this.raf) return;
        let dt = (now - this.lastT) / 1000;
        this.lastT = now;
        dt = Math.min(dt, 0.05);
        if (this.status === 'playing') this.update(dt);
        this.render(dt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    pause() { if (this.status === 'playing') this.status = 'paused'; }
    resume() { if (this.status === 'paused') { this.status = 'playing'; this.lastT = performance.now(); } }

    /* ===== 屏幕坐标 -> 世界坐标 ===== */
    screenToWorld(sx, sy) {
      const z = this.cam.zoom;
      return {
        x: (sx - this.vw / 2) / z + this.cam.x,
        y: (sy - this.vh / 2) / z + this.cam.y,
      };
    }

    /* ===== 更新 ===== */
    update(dt) {
      if (this.status !== 'playing') return;   // 已结束/暂停不再推进
      this.time += dt;

      this.updateControl(dt);
      for (const L of this.legions) {
        if (!L.alive) continue;
        if (L.ai) this.aiThink(L, dt);
        this.updateLegion(L, dt);
      }

      this.buildUnitGrid();
      this.updateNeutrals(dt);
      this.updateCombat(dt);
      this.updateFx(dt);
      this.updateParticles(dt);
      this.updateCamera(dt);
      this.updateStats();

      this.spawnAcc += dt;
      if (this.spawnAcc > 0.5) {
        this.spawnAcc = 0;
        const deficit = this.neutralTarget - this.neutrals.length;
        if (deficit > 0) {
          const L = this.level;
          const rate = Math.min(6, deficit / 18 + 0.6) * (1 + this.buff.neutral);
          for (let i = 0; i < Math.ceil(rate); i++) this.spawnNeutral(300);
        }
      }

      this.hudAcc += dt;
      if (this.hudAcc > 0.1) { this.hudAcc = 0; this.pushHud(); }
      this.checkGoal();
    }

    /* 输入 → 军团目标点
       优先级：虚拟摇杆 > 键盘 > 指针跟随；键盘/摇杆松开后立即停下而不是继续漂移 */
    updateControl(dt) {
      const p = this.player;
      if (!p.alive) { this.lastInput = 'idle'; return; }
      const W = this.world.w, H = this.world.h;
      const REACH = 430;                     // 键盘/摇杆一次给多远的目标点

      // 1) 虚拟摇杆：方向 + 力度 → 目标点，力度越小走得越慢
      if (this.stick.active && (this.stick.axisX || this.stick.axisY)) {
        const reach = REACH * this.stick.strength;
        p.target.x = clamp(p.cx + this.stick.axisX * reach, 20, W - 20);
        p.target.y = clamp(p.cy + this.stick.axisY * reach, 20, H - 20);
        this.lastInput = 'stick';
        return;
      }

      // 2) 键盘：按住方向键 / WASD 移动，支持斜向
      if (this.keys.x || this.keys.y) {
        const len = Math.hypot(this.keys.x, this.keys.y) || 1;
        p.target.x = clamp(p.cx + (this.keys.x / len) * REACH, 20, W - 20);
        p.target.y = clamp(p.cy + (this.keys.y / len) * REACH, 20, H - 20);
        this.lastInput = 'keys';
        return;
      }

      // 3) 键盘/摇杆刚松开 → 原地停下（避免松手后还自己往前跑）
      if (this.lastInput === 'keys' || this.lastInput === 'stick') {
        p.target.x = p.cx;
        p.target.y = p.cy;
        this.lastInput = 'idle';
        if (!this.pointer.active) return;
      }

      // 4) 鼠标跟随 / 触屏“跟随手指”模式：朝指针所在的世界坐标移动
      if (this.pointer.active && this.pointer.x !== undefined) {
        const w = this.screenToWorld(this.pointer.x, this.pointer.y);
        p.target.x = clamp(w.x, 20, W - 20);
        p.target.y = clamp(w.y, 20, H - 20);
        this.lastInput = 'pointer';
      }
    }

    /* 技能效果查询 */
    fxOf(L, id) { return L.fx[id] || 0; }

    updateLegion(L, dt) {
      const n = L.units.length;
      if (n === 0) return;

      /* --- 速度/攻击修正 --- */
      let speedMul = 1, atkMul = 1;
      if (L.ai) {
        speedMul *= L.ai.sp;
        // 弱势军团惊慌失措，逃跑时会慢下来 —— 保证大军队追得上小军队
        const pl = this.player;
        if (pl && pl.alive && L.count < pl.count * 0.75) speedMul *= CFG.move.panic;
      }
      if (L.isPlayer && L.hasFx('rush')) {
        const lv = this.skillLv('rush');
        speedMul *= 1 + SKILLS.rush.levels[lv - 1].speed;
      }
      if (L.isPlayer) {
        speedMul *= 1 + this.buff.speed;
        atkMul *= 1 + this.buff.atk;
        if (L.hasFx('frenzy')) {
          const lv = this.skillLv('frenzy');
          atkMul *= 1 + SKILLS.frenzy.levels[lv - 1].atk;
        }
      } else {
        // 时间迟缓
        const p = this.player;
        if (p.alive && p.hasFx('slow')) {
          const lv = this.skillLv('slow');
          const eff = SKILLS.slow.levels[lv - 1];
          if (dist2(L.cx, L.cy, p.cx, p.cy) < eff.radius * eff.radius) speedMul *= 1 - eff.slow;
        }
      }
      const pen = Math.min(CFG.move.sizePenaltyMax, n * CFG.move.sizePenalty);
      speedMul *= 1 - pen;
      if (L.isPlayer) speedMul *= CFG.move.playerBonus;
      L.speedMul = speedMul;
      L.atkMul = atkMul;

      /* --- 军团中心（指挥官）朝目标移动 --- */
      const dx = L.target.x - L.cx, dy = L.target.y - L.cy;
      const d = Math.hypot(dx, dy);
      const maxSp = CFG.move.base * speedMul;
      let tvx = 0, tvy = 0;
      if (d > 5) { tvx = (dx / d) * maxSp; tvy = (dy / d) * maxSp; }
      const k = 1 - Math.exp(-7 * dt);
      L.cvx = lerp(L.cvx, tvx, k);
      L.cvy = lerp(L.cvy, tvy, k);
      L.cx += L.cvx * dt;
      L.cy += L.cvy * dt;

      const R = L.radius;
      L.cx = clamp(L.cx, R * 0.4 + 8, this.world.w - R * 0.4 - 8);
      L.cy = clamp(L.cy, R * 0.4 + 8, this.world.h - R * 0.4 - 8);

      /* --- 单位跟随编队 --- */
      const maxU = CFG.move.unitMax * Math.max(0.85, speedMul);
      const ek = 1 - Math.exp(-11 * dt);
      for (let i = 0; i < n; i++) {
        const u = L.units[i];
        const s = SLOTS[i < SLOTS.length ? i : SLOTS.length - 1];
        const gx = L.cx + s[0];
        const gy = L.cy + s[1];
        const ddx = gx - u.x, ddy = gy - u.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        const want = Math.min(maxU, dd * 8.5);
        const vtx = (ddx / dd) * want;
        const vty = (ddy / dd) * want;
        u.vx = lerp(u.vx, vtx, ek);
        u.vy = lerp(u.vy, vty, ek);
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        // 边界
        if (u.x < 6) { u.x = 6; u.vx = 0; }
        if (u.y < 6) { u.y = 6; u.vy = 0; }
        if (u.x > this.world.w - 6) { u.x = this.world.w - 6; u.vx = 0; }
        if (u.y > this.world.h - 6) { u.y = this.world.h - 6; u.vy = 0; }
        u.ph += dt * 5.5;
        if (u.flash > 0) u.flash -= dt;
      }

      /* --- 临时援军到期 --- */
      if (L.isPlayer) {
        for (let i = L.units.length - 1; i >= 0; i--) {
          const u = L.units[i];
          if (u.temp > 0) {
            u.temp -= dt;
            if (u.temp <= 0) {
              // 离队 -> 变回中立小人
              L.units.splice(i, 1);
              this.neutrals.push({
                x: u.x, y: u.y, vx: rnd(-20, 20), vy: rnd(-20, 20),
                ph: Math.random() * TAU, dir: Math.random() * TAU, t: rnd(0.6, 2),
              });
              this.burst(u.x, u.y, L.body, 5, 60);
            }
          }
        }
      }
    }

    /* 单位空间网格（供中立收编查询） */
    buildUnitGrid() {
      this.unitGrid.clear();
      for (const L of this.legions) {
        if (!L.alive || L.units.length === 0) continue;
        const arr = L.units;
        for (let i = 0; i < arr.length; i++) {
          const u = arr[i];
          const key = ((u.x / this.cell) | 0) + ',' + ((u.y / this.cell) | 0);
          let c = this.unitGrid.get(key);
          if (!c) { c = []; this.unitGrid.set(key, c); }
          c.push(u);
        }
      }
    }

    neutralsNear(x, y, r) {
      const out = [];
      const cs = this.cell;
      const x0 = ((x - r) / cs) | 0, x1 = ((x + r) / cs) | 0;
      const y0 = ((y - r) / cs) | 0, y1 = ((y + r) / cs) | 0;
      for (let i = 0; i < this.neutrals.length; i++) {
        const N = this.neutrals[i];
        const cx = (N.x / cs) | 0, cy = (N.y / cs) | 0;
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
        if (dist2(N.x, N.y, x, y) <= r * r) out.push(i);
      }
      return out;
    }

    updateNeutrals(dt) {
      const W = this.world.w, H = this.world.h;
      const p = this.player;
      const lureR = (p.alive && p.hasFx('lure')) ? SKILLS.lure.levels[this.skillLv('lure') - 1].radius : 0;

      for (let i = this.neutrals.length - 1; i >= 0; i--) {
        const N = this.neutrals[i];

        // 诱捕：中立小人被吸引
        if (lureR > 0 && dist2(N.x, N.y, p.cx, p.cy) < lureR * lureR) {
          const dx = p.cx - N.x, dy = p.cy - N.y;
          const d = Math.hypot(dx, dy) || 1;
          N.vx = lerp(N.vx, (dx / d) * 120, 1 - Math.exp(-5 * dt));
          N.vy = lerp(N.vy, (dy / d) * 120, 1 - Math.exp(-5 * dt));
        } else {
          N.t -= dt;
          if (N.t <= 0) { N.t = rnd(0.8, 2.6); N.dir = Math.random() * TAU; }
          N.vx = lerp(N.vx, Math.cos(N.dir) * 16, 1 - Math.exp(-3 * dt));
          N.vy = lerp(N.vy, Math.sin(N.dir) * 16, 1 - Math.exp(-3 * dt));
        }

        N.x += N.vx * dt;
        N.y += N.vy * dt;
        if (N.x < 16) { N.x = 16; N.dir = Math.PI - N.dir; }
        if (N.y < 16) { N.y = 16; N.dir = -N.dir; }
        if (N.x > W - 16) { N.x = W - 16; N.dir = Math.PI - N.dir; }
        if (N.y > H - 16) { N.y = H - 16; N.dir = -N.dir; }
        N.ph += dt * 4;

        // 收编判定：3x3 邻域网格中找最近的小人
        const cs = this.cell;
        const pickBase = CFG.pickup * (1 + this.buff.pickup);
        const outer = pickBase * 1.9;
        const outer2 = outer * outer;
        const gx = (N.x / cs) | 0, gy = (N.y / cs) | 0;
        let best = null, bestD = outer2;
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const cellArr = this.unitGrid.get((gx + ox) + ',' + (gy + oy));
            if (!cellArr) continue;
            for (let ci = 0; ci < cellArr.length; ci++) {
              const u = cellArr[ci];
              const ownerL = u.L;
              if (!ownerL || !ownerL.alive) continue;
              // 残部加成：人数很少的军团收编范围更大，便于翻盘
              const pr = pickBase * (ownerL.count <= 3 ? 1.9 : 1);
              const d2v = dist2(u.x, u.y, N.x, N.y);
              if (d2v < pr * pr && d2v < bestD) { bestD = d2v; best = u; }
            }
          }
        }
        if (best && best.L && best.L.alive) {
          const owner = best.L;
          // 敌军达到人数上限后不再收编中立小人
          if (!owner.isPlayer && owner.count >= this.aiCap) continue;
          const nu = owner.addUnit(N.x, N.y);
          if (nu) nu.flash = 0.35;
          this.neutrals.splice(i, 1);
          this.burst(N.x, N.y, owner.body, 4, 55);
          if (owner.isPlayer) {
            this.floatText('+1', N.x, N.y - 10, owner.body, 0.9);
            SFX.join();
            this.playerGot(1);
          } else if (dist2(N.x, N.y, p.cx, p.cy) < 900 * 900) {
            SFX.join();
          }
        }
      }
    }

    /* ===== 战斗：逐个单位吞噬 ===== */
    updateCombat(dt) {
      this.contacts.length = 0;
      const ls = this.legions;
      for (let i = 0; i < ls.length; i++) {
        const A = ls[i];
        if (!A.alive || A.count === 0) continue;
        for (let j = i + 1; j < ls.length; j++) {
          const B = ls[j];
          if (!B.alive || B.count === 0) continue;

          const ra = A.radius, rb = B.radius;
          const d2 = dist2(A.cx, A.cy, B.cx, B.cy);
          const reach = (ra + rb) * CFG.eat.contact;
          const key = A.id < B.id ? A.id + '_' + B.id : B.id + '_' + A.id;

          if (d2 > reach * reach) {
            this.pairTimers.set(key, CFG.eat.interval);
            continue;
          }

          const d = Math.sqrt(d2);
          this.contacts.push({ a: A, b: B, x: (A.cx + B.cx) / 2, y: (A.cy + B.cy) / 2, r: Math.min(ra, rb) });

          if (A.count === B.count) { this.pairTimers.set(key, CFG.eat.interval * 0.6); continue; }

          let t = this.pairTimers.get(key);
          if (t === undefined) t = CFG.eat.interval;
          t -= dt;
          if (t > 0) { this.pairTimers.set(key, t); continue; }

          const big = A.count > B.count ? A : B;
          const small = A.count > B.count ? B : A;

          // 坚壁：未被吞噬方免疫
          if (small.isPlayer && this.player.hasFx('shield')) {
            this.pairTimers.set(key, CFG.eat.interval * 0.5);
            continue;
          }

          const rate = big.isPlayer ? (big.atkMul || 1) : 1;
          this.pairTimers.set(key, CFG.eat.interval / Math.max(0.4, rate));
          this.absorb(small, big, d);

          if (big.isPlayer || small.isPlayer) {
            this.shake = Math.min(9, this.shake + (big.isPlayer ? 2.2 : 4.5));
          }
        }
      }
    }

    /* 吞噬一个单位：从 loser 转移给 winner */
    absorb(loser, winner, contactDist) {
      if (loser.count === 0) return;
      // 挑选最靠近接触点的单位（前线）
      let bi = 0, bd = Infinity;
      const tx = winner.cx, ty = winner.cy;
      for (let i = 0; i < loser.units.length; i++) {
        const u = loser.units[i];
        const d = dist2(u.x, u.y, tx, ty);
        if (d < bd) { bd = d; bi = i; }
      }
      const u = loser.removeUnitAt(bi);
      if (!u) return;
      const nu = winner.addUnit(u.x, u.y);
      if (nu) { nu.flash = 0.55; nu.vx = u.vx; nu.vy = u.vy; }

      // 特效
      this.burst(u.x, u.y, loser.body, 7, 110);
      this.burst(u.x, u.y, winner.body, 5, 90);
      winner.totalEaten++;
      loser.totalLost++;
      if (winner.isPlayer) {
        this.stats.eaten++;
        Save.data.stats.totalEaten++;
        SFX.eat();
        this.playerGot(1);
      } else if (loser.isPlayer) {
        SFX.eaten();
        this.stats.lost++;
        this.playerLost();
      }

      if (loser.count === 0) this.destroyLegion(loser, winner);
    }

    destroyLegion(L, by) {
      L.alive = false;
      this.shake = Math.max(this.shake, 10);
      for (let k = 0; k < 3; k++) this.burst(L.cx, L.cy, L.body, 16, 220);
      this.floatText(L.name + ' 被吞噬！', L.cx, L.cy - 30, '#ffffff', 1.6);
      if (this.hooks.onLegionDown) this.hooks.onLegionDown(L);
      if (L.isPlayer) this.gameOver('我军全军覆没');
    }

    /* ===== 技能 ===== */
    skillLv(id) { return Save.data.skills[id] || 1; }

    useSkill() {
      const p = this.player;
      if (!p.alive || this.status !== 'playing') return;
      if (p.skillCd > 0) return;
      const id = this.run.skillId;
      const sk = SKILLS[id];
      if (!sk) return;
      const lv = this.skillLv(id);
      const eff = sk.levels[Math.min(lv, 3) - 1];
      const cdMul = 1 - clamp(this.buff.cd, 0, 0.6);
      p.skillCd = sk.cd * cdMul;

      if (id === 'reinforce') {
        for (let i = 0; i < eff.count; i++) {
          const a = Math.random() * TAU, r = rnd(0, p.radius);
          const u = p.addUnit(p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r, { temp: eff.dur });
          if (u) u.flash = 0.8;
        }
        p.fx[id] = eff.dur;
        this.floatText('援军抵达 +' + eff.count, p.cx, p.cy - p.radius - 24, '#2ee6a8', 1.5);
      } else {
        p.fx[id] = eff.dur;
        this.floatText(sk.name + '！', p.cx, p.cy - p.radius - 24, sk.color, 1.4);
      }
      if (p.count <= 2) this.stats.usedSkillLow = true;
      this.ring(p.cx, p.cy, sk.color);
      SFX.skill();
      this.pushHud();
    }

    updateFx(dt) {
      for (const L of this.legions) {
        for (const k in L.fx) {
          if (L.fx[k] > 0) { L.fx[k] -= dt; if (L.fx[k] <= 0) delete L.fx[k]; }
        }
        if (L.skillCd > 0) L.skillCd = Math.max(0, L.skillCd - dt);
        if (L.flash > 0) L.flash -= dt;
      }
    }

    /* ===== AI ===== */
    aiThink(L, dt) {
      if (!L.ai) return;
      L.ai.t -= dt;
      if (L.ai.t > 0) return;
      L.ai.t = L.ai.react;

      const c = { x: L.cx, y: L.cy };
      let flee = null, fleeD = Infinity;
      let prey = null, preyD = Infinity;

      for (const E of this.legions) {
        if (E === L || !E.alive || E.count === 0) continue;
        const d = Math.sqrt(dist2(c.x, c.y, E.cx, E.cy));
        if (E.count > L.count * 1.06 + 1) { if (d < fleeD) { fleeD = d; flee = E; } }
        else if (E.count * 1.3 < L.count) { if (d < preyD) { preyD = d; prey = E; } }
      }

      const caution = 1.15 - L.ai.ag * 0.45;      // 越好斗越不怕
      const dangerR = 210 + L.radius + 190 * caution;
      let tx, ty;

      if (flee && fleeD < dangerR) {
        const dx = c.x - flee.cx, dy = c.y - flee.cy;
        const d = Math.hypot(dx, dy) || 1;
        // 靠墙时沿墙跑
        const W = this.world.w, H = this.world.h, m = 240;
        let ex = dx / d, ey = dy / d;
        if (c.x < m && ex < 0) ex = 0.6;
        if (c.x > W - m && ex > 0) ex = -0.6;
        if (c.y < m && ey < 0) ey = 0.6;
        if (c.y > H - m && ey > 0) ey = -0.6;
        const el = Math.hypot(ex, ey) || 1;
        tx = c.x + (ex / el) * 460;
        ty = c.y + (ey / el) * 460;
      } else if (prey && preyD < 1000 + L.ai.ag * 600) {
        tx = prey.cx;
        ty = prey.cy;
      } else {
        // 收集中立小人：找最近的一小簇
        let bx = 0, by = 0, bn = 0, bd = Infinity;
        for (let i = 0; i < this.neutrals.length; i += 1) {
          const N = this.neutrals[i];
          const d = dist2(N.x, N.y, c.x, c.y);
          if (d < bd) { bd = d; bx = N.x; by = N.y; bn = 1; }
        }
        if (bn === 0) {
          tx = rnd(200, this.world.w - 200);
          ty = rnd(200, this.world.h - 200);
        } else {
          tx = bx + rnd(-70, 70);
          ty = by + rnd(-70, 70);
        }
      }
      L.target.x = clamp(tx, 120, this.world.w - 120);
      L.target.y = clamp(ty, 120, this.world.h - 120);
    }

    /* ===== 粒子与文字 ===== */
    burst(x, y, color, n, spd) {
      if (this.particles.length > 900) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = rnd(spd * 0.3, spd);
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: rnd(0.25, 0.6), max: 0.6, c: color, r: rnd(1.6, 3.6),
        });
      }
    }
    ring(x, y, color) {
      this.particles.push({ ring: true, x, y, life: 0.55, max: 0.55, c: color, r: 10, grow: 460 });
    }
    floatText(t, x, y, c, scale) {
      this.texts.push({ t, x, y, c: c || '#fff', life: 1.0, max: 1.0, s: scale || 1 });
      if (this.texts.length > 40) this.texts.shift();
    }
    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        if (p.ring) continue;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.93; p.vy *= 0.93;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt; t.y -= dt * 26;
        if (t.life <= 0) this.texts.splice(i, 1);
      }
    }

    /* ===== 统计 / 目标 ===== */
    playerGot(n) {
      const p = this.player;
      if (p.count > this.stats.peak) this.stats.peak = p.count;
      if (p.count > Save.data.stats.bestCount) { Save.data.stats.bestCount = p.count; }
      if (p.count < this.stats.minCount) this.stats.minCount = p.count;
      this.flashHud();
    }
    playerLost() {
      const p = this.player;
      this.stats.flawless = false;
      if (p.count < this.stats.minCount) this.stats.minCount = p.count;
      if (p.count === 0) this.gameOver('军团被全部吞噬');
      this.flashHud();
    }
    updateStats() {
      const p = this.player;
      if (p.alive && p.count > this.stats.peak) this.stats.peak = p.count;
    }
    flashHud() { this.hudAcc = 1; }

    checkGoal() {
      if (this.status !== 'playing') return;
      const g = this.level.goal;
      const p = this.player;
      if (!p.alive) return;
      if (g.type === 'reach') {
        if (p.count >= g.val) this.win();
      } else {
        const alive = this.legions.filter(L => L.alive && !L.isPlayer).length;
        if (alive === 0) this.win();
      }
    }

    win() {
      if (this.status === 'over') return;
      this.status = 'over';
      this.player.skillCd = 0;
      SFX.win();
      const res = this.buildResult(true);
      if (this.hooks.onWin) this.hooks.onWin(res);
    }
    gameOver(reason) {
      if (this.status === 'over') return;
      this.status = 'over';
      SFX.lose();
      const res = this.buildResult(false);
      res.reason = reason;
      if (this.hooks.onLose) this.hooks.onLose(res);
    }

    buildResult(isWin) {
      const L = this.level;
      let stars = 0;
      if (isWin) {
        stars = 1;
        if (this.time <= L.par) stars = 2;
        if (this.time <= L.gold) stars = 3;
      }
      const p = this.player;
      const base = L.coins || 20;
      const coin = isWin ? Math.round(base + stars * 12 + Math.min(60, this.stats.eaten * 1.5)) : Math.round(base * 0.25);
      return {
        win: isWin,
        levelId: L.id,
        levelName: L.name,
        endless: !!L.endless,
        stage: L.stage || 0,
        levelIndex: this.levelIndex,
        stars,
        time: this.time,
        coin,
        count: p.count,
        peak: this.stats.peak,
        eaten: this.stats.eaten,
        lost: this.stats.lost,
        flawless: this.stats.flawless && this.stats.lost === 0,
        comeback: this.stats.usedSkillLow && p.count > 0,
        enemiesLeft: this.legions.filter(x => x.alive && !x.isPlayer).length,
      };
    }

    /* ===== 相机 ===== */
    updateCamera(dt) {
      const p = this.player;
      const R = p.alive ? p.radius : 40;
      const want = clamp(this.vh / (3.15 * Math.max(70, R * 2)), CFG.zoom.min, CFG.zoom.max);
      const base = Math.min(1.0, Math.max(CFG.zoom.min, want));
      this.cam.tzoom = base;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 22);

      // 危险提示（比我方更大的敌人在附近）
      let danger = 0;
      if (p.alive) {
        for (const E of this.legions) {
          if (E === p || !E.alive) continue;
          if (E.count > p.count) {
            const d = Math.sqrt(dist2(E.cx, E.cy, p.cx, p.cy));
            const t = clamp(1 - d / 420, 0, 1);
            if (t > danger) danger = t;
          }
        }
      }
      this.dangerRatio = danger;
      // 危险时略微拉远镜头
      this.cam.tzoom *= 1 - danger * 0.14;
    }

    recenterCamera(instant) {
      const p = this.player;
      this.cam.x = p.cx; this.cam.y = p.cy;
      if (instant) {
        const R = p.radius;
        this.cam.zoom = clamp(this.vh / (3.15 * Math.max(70, R * 2)), CFG.zoom.min, CFG.zoom.max);
        this.cam.tzoom = this.cam.zoom;
      }
    }

    /* ===== HUD 数据 ===== */
    pushHud() {
      const p = this.player;
      const L = this.level;
      const g = L.goal;
      let progress = 0, goalText = '';
      if (g.type === 'reach') {
        progress = clamp(p.count / g.val, 0, 1);
        goalText = '目标：军团达到 ' + g.val + ' 人';
      } else {
        const total = L.enemies.length;
        const alive = this.legions.filter(x => x.alive && !x.isPlayer).length;
        progress = clamp((total - alive) / total, 0, 1);
        goalText = '目标：消灭所有敌军（剩余 ' + alive + '）';
      }
      const enemies = this.legions.filter(x => !x.isPlayer && x.alive).map(x => ({
        name: x.name, body: x.body, count: x.count,
        threat: x.count > p.count,
      }));
      this.hooks.onHud && this.hooks.onHud({
        count: p.count,
        peak: this.stats.peak,
        goalText, progress,
        time: this.time,
        enemyCount: enemies.length,
        enemies,
        skillCd: p.skillCd,
        skillCdMax: (SKILLS[this.run.skillId] ? SKILLS[this.run.skillId].cd : 0) * (1 - clamp(this.buff.cd, 0, 0.6)),
      });
    }

    /* ==========================================================
       渲染
       ========================================================== */
    render(dt) {
      const ctx = this.ctx;
      const z = this.cam.zoom;
      if (this.status !== 'paused') {
        this.cam.zoom = lerp(this.cam.zoom, this.cam.tzoom, 1 - Math.exp(-4 * (dt || 0.016)));
        const p = this.player;
        const follow = 1 - Math.exp(-9 * (dt || 0.016));
        this.cam.x = lerp(this.cam.x, p.cx, follow);
        this.cam.y = lerp(this.cam.y, p.cy, follow);
      }

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.vw, this.vh);

      // 背景
      const bg = ctx.createLinearGradient(0, 0, 0, this.vh);
      bg.addColorStop(0, '#101736');
      bg.addColorStop(1, '#0a0f24');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.vw, this.vh);

      const sx = this.shake ? rnd(-this.shake, this.shake) : 0;
      const sy = this.shake ? rnd(-this.shake, this.shake) : 0;

      ctx.save();
      ctx.translate(this.vw / 2 + sx, this.vh / 2 + sy);
      ctx.scale(this.cam.zoom, this.cam.zoom);
      ctx.translate(-this.cam.x, -this.cam.y);

      const view = this.viewRect();

      this.drawFloor(ctx, view);
      this.drawDecor(ctx, view);
      this.drawNeutrals(ctx, view);
      this.drawLegions(ctx, view);
      this.drawContacts(ctx);
      this.drawParticles(ctx);
      this.drawTargetMarker(ctx);
      this.drawTexts(ctx);
      this.drawBounds(ctx);

      ctx.restore();

      this.drawDangerVignette(ctx);
      this.drawEnemyFinder(ctx);
      this.drawJoystick(ctx);
      this.drawMiniMap();
    }

    /* 桌面端：在目标点画一个十字准星，让“鼠标指到哪军团就去哪”一目了然 */
    drawTargetMarker(ctx) {
      if (this.inputKind !== 'mouse' || !this.pointer.active) return;
      const p = this.player;
      if (!p.alive) return;
      const t = p.target;
      const d = Math.hypot(t.x - p.cx, t.y - p.cy);
      if (d < 46) return;                       // 目标就在脚下，不画
      const pulse = 0.5 + Math.sin(this.time * 6) * 0.5;
      const r = 13 + pulse * 4;
      ctx.globalAlpha = 0.30 + pulse * 0.32;
      ctx.strokeStyle = '#9fd0ff';
      ctx.lineWidth = 2 / this.cam.zoom + 0.8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(t.x - 7, t.y); ctx.lineTo(t.x + 7, t.y);
      ctx.moveTo(t.x, t.y - 7); ctx.lineTo(t.x, t.y + 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* 触屏虚拟摇杆：基座 + 死区 + 手柄 + 方向指示 */
    drawJoystick(ctx) {
      const s = this.stick;
      if (!s.active) return;
      const R = s.maxR;

      ctx.save();
      // 基座
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s.originX, s.originY, R, 0, TAU); ctx.fill();

      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.originX, s.originY, R, 0, TAU); ctx.stroke();

      // 死区提示
      ctx.globalAlpha = 0.20;
      ctx.beginPath(); ctx.arc(s.originX, s.originY, R * 0.14, 0, TAU); ctx.stroke();

      // 方向连线
      if (s.strength > 0) {
        ctx.globalAlpha = 0.35 + s.strength * 0.3;
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.player.body || '#3d9bff';
        ctx.beginPath();
        ctx.moveTo(s.originX, s.originY);
        ctx.lineTo(s.knobX, s.knobY);
        ctx.stroke();
      }

      // 手柄
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = this.player.body || '#3d9bff';
      ctx.beginPath(); ctx.arc(s.knobX, s.knobY, R * 0.34, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(s.knobX, s.knobY, R * 0.34, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    /* 灭敌关卡：屏幕边缘指向最近敌军的追猎指引 */
    drawEnemyFinder(ctx) {
      if (this.level.goal.type !== 'eliminate') return;
      const p = this.player;
      if (!p.alive) return;
      let best = null, bd = Infinity;
      for (const E of this.legions) {
        if (E === p || !E.alive || E.count === 0) continue;
        const d = dist2(E.cx, E.cy, p.cx, p.cy);
        if (d < bd) { bd = d; best = E; }
      }
      if (!best) return;
      const ang = Math.atan2(best.cy - p.cy, best.cx - p.cx);
      const cx = this.vw / 2, cy = this.vh / 2;
      const R = Math.min(this.vw, this.vh) * 0.30;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      const pulse = 0.6 + Math.sin(this.time * 5) * 0.4;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.35 + pulse * 0.45;
      ctx.fillStyle = best.count > p.count ? '#ff5b6e' : '#2ee6a8';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -11);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = 0.85;
      ctx.font = 'bold 11px system-ui, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const dist = Math.round(Math.sqrt(bd) / 10);
      ctx.fillText(best.name + ' ' + best.count + '人 · ' + dist + 'm',
        cx + Math.cos(ang) * (R + 22), cy + Math.sin(ang) * (R + 22));
      ctx.globalAlpha = 1;
    }

    viewRect() {
      const z = this.cam.zoom;
      const w = this.vw / z, h = this.vh / z;
      return { x: this.cam.x - w / 2, y: this.cam.y - h / 2, w, h };
    }

    drawFloor(ctx, v) {
      const cell = 120;
      ctx.lineWidth = 1 / this.cam.zoom;
      ctx.strokeStyle = 'rgba(120,160,255,0.075)';
      ctx.beginPath();
      const x0 = Math.floor(v.x / cell) * cell, x1 = v.x + v.w;
      const y0 = Math.floor(v.y / cell) * cell, y1 = v.y + v.h;
      for (let x = x0; x <= x1; x += cell) { ctx.moveTo(x, v.y); ctx.lineTo(x, v.y + v.h); }
      for (let y = y0; y <= y1; y += cell) { ctx.moveTo(v.x, y); ctx.lineTo(v.x + v.w, y); }
      ctx.stroke();

      // 中心装饰圆环
      ctx.strokeStyle = 'rgba(120,160,255,0.10)';
      ctx.lineWidth = 6 / this.cam.zoom;
      ctx.beginPath();
      ctx.arc(this.world.w / 2, this.world.h / 2, 420, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.world.w / 2, this.world.h / 2, 780, 0, TAU);
      ctx.stroke();
    }

    drawDecor(ctx, v) {
      for (const d of this.decor) {
        if (d.x + d.r < v.x || d.x - d.r > v.x + v.w || d.y + d.r < v.y || d.y - d.r > v.y + v.h) continue;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r, d.r * 0.72, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = shade(d.c, 0.45);
        ctx.beginPath();
        ctx.ellipse(d.x - d.r * 0.22, d.y - d.r * 0.24, d.r * 0.55, d.r * 0.4, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    drawBounds(ctx) {
      ctx.strokeStyle = 'rgba(120,170,255,0.35)';
      ctx.lineWidth = 6 / this.cam.zoom;
      ctx.strokeRect(0, 0, this.world.w, this.world.h);
    }

    drawNeutrals(ctx, v) {
      const spr = this.neutralSprite;
      const w = 22, h = 25;
      for (const N of this.neutrals) {
        if (N.x < v.x - 30 || N.x > v.x + v.w + 30 || N.y < v.y - 30 || N.y > v.y + v.h + 30) continue;
        const bob = Math.sin(N.ph) * 1.1;
        ctx.globalAlpha = 0.92;
        ctx.drawImage(spr, N.x - w / 2, N.y - h / 2 + bob, w, h);
      }
      ctx.globalAlpha = 1;
    }

    drawLegions(ctx, v) {
      const list = this.legions.filter(L => L.alive && L.count > 0);
      list.sort((a, b) => {
        if (a.isPlayer !== b.isPlayer) return a.isPlayer ? 1 : -1;
        return b.count - a.count;
      });
      const w = 22, h = 25;
      for (const L of list) {
        const R = L.radius;
        if (L.cx + R < v.x - 40 || L.cx - R > v.x + v.w + 40 || L.cy + R < v.y - 40 || L.cy - R > v.y + v.h + 40) {
          continue;
        }
        // 地面阴影
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(L.cx, L.cy + R * 0.55, R * 0.95, R * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 技能光环
        if (L.isPlayer && (L.hasFx('rush') || L.hasFx('shield') || L.hasFx('frenzy'))) {
          const col = L.hasFx('shield') ? '#9b8cff' : (L.hasFx('rush') ? '#ffd93d' : '#ff4d6d');
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.55 + Math.sin(this.time * 12) * 0.25;
          ctx.lineWidth = 4 / this.cam.zoom + 2;
          ctx.beginPath();
          ctx.arc(L.cx, L.cy, R + 12, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (L.isPlayer && L.hasFx('lure')) {
          const eff = SKILLS.lure.levels[this.skillLv('lure') - 1];
          ctx.strokeStyle = 'rgba(255,138,61,0.5)';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 10]);
          ctx.beginPath();
          ctx.arc(L.cx, L.cy, eff.radius, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const arr = L.units;
        const sprs = L.sprites;
        const ns = sprs.length;
        for (let i = 0; i < arr.length; i++) {
          const u = arr[i];
          if (u.x < v.x - 30 || u.x > v.x + v.w + 30 || u.y < v.y - 30 || u.y > v.y + v.h + 30) continue;
          const bob = Math.sin(u.ph) * 0.9;
          const spr = ns === 1 ? sprs[0] : sprs[i % ns];
          ctx.drawImage(spr, u.x - w / 2, u.y - h / 2 + bob, w, h);
          if (u.flash > 0) {
            ctx.globalAlpha = Math.min(0.85, u.flash * 1.6);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(u.x, u.y - 1, 9, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }

        // 人数标签
        this.drawLegionTag(ctx, L, R);
      }
    }

    drawLegionTag(ctx, L, R) {
      const p = this.player;
      const txt = String(L.count);
      const y = L.cy - R - 16;
      let bg = 'rgba(10,16,36,0.72)';
      let border = 'rgba(255,255,255,0.25)';
      if (!L.isPlayer) {
        const threat = L.count > p.count;
        border = threat ? 'rgba(255,90,100,0.9)' : 'rgba(80,240,160,0.9)';
      } else {
        border = 'rgba(120,190,255,0.95)';
      }
      ctx.font = 'bold 15px system-ui, "PingFang SC", sans-serif';
      const tw = ctx.measureText(txt).width;
      const padX = 9, hgt = 21, wdt = tw + padX * 2;
      roundRect(ctx, L.cx - wdt / 2, y - hgt / 2, wdt, hgt, 10);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = border; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = L.isPlayer ? '#cfe4ff' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, L.cx, y + 0.5);

      // 军团名（小字在下方）
      ctx.font = '11px system-ui, "PingFang SC", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(L.name, L.cx, L.cy + R + 14);
    }

    drawContacts(ctx) {
      for (const c of this.contacts) {
        const pulse = 0.5 + Math.sin(this.time * 18) * 0.5;
        ctx.globalAlpha = 0.30 + pulse * 0.35;
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3 + pulse * 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 0.55 + pulse * 8, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    drawParticles(ctx) {
      for (const p of this.particles) {
        const a = clamp(p.life / p.max, 0, 1);
        if (p.ring) {
          const t = 1 - a;
          ctx.globalAlpha = a * 0.75;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = 4 * a + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + p.grow * t, 0, TAU);
          ctx.stroke();
        } else {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawTexts(ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of this.texts) {
        const a = clamp(t.life / t.max, 0, 1);
        ctx.globalAlpha = a;
        ctx.font = 'bold ' + (15 * t.s) + 'px system-ui, "PingFang SC", sans-serif';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(6,10,24,0.85)';
        ctx.strokeText(t.t, t.x, t.y);
        ctx.fillStyle = t.c;
        ctx.fillText(t.t, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }

    drawDangerVignette(ctx) {
      const d = this.dangerRatio;
      if (d <= 0.02) return;
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.28,
        this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.62);
      g.addColorStop(0, 'rgba(255,40,60,0)');
      g.addColorStop(1, 'rgba(255,40,60,' + (0.42 * d).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    drawMiniMap() {
      const mm = this.mm, g = this.mmCtx;
      if (!mm || !g) return;
      const W = mm.width, H = mm.height;
      const sx = W / this.world.w, sy = H / this.world.h;
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(8,14,32,0.82)';
      roundRect(g, 0, 0, W, H, 10); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.5; g.stroke();

      g.fillStyle = 'rgba(200,215,255,0.30)';
      for (let i = 0; i < this.neutrals.length; i += 4) {
        const N = this.neutrals[i];
        g.fillRect(N.x * sx - 0.5, N.y * sy - 0.5, 1.4, 1.4);
      }
      for (const L of this.legions) {
        if (!L.alive) continue;
        const r = L.isPlayer ? 4.2 : 3.2;
        g.beginPath();
        g.arc(L.cx * sx, L.cy * sy, r, 0, TAU);
        g.fillStyle = L.body;
        g.fill();
        if (L.isPlayer) {
          g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.stroke();
        }
      }
    }
  }

  global.MiniGame = Game;
  global.GameUtils = { SLOTS, blobRadius, makeSprite, clamp, rnd };
})(window);
