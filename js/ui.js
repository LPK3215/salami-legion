/* ==========================================================
   界面与流程控制：菜单 / 关卡 / 出征 / 对局 / 奖励 / 商店 / 成就
   ========================================================== */

const UI = {
  game: null,
  run: null,
  pendingLevel: 0,
  toastTimer: null,
  _inited: false,

  /* ---------------- 初始化（幂等，重复调用不会重置状态） ---------------- */
  init() {
    if (this._inited) return;
    this._inited = true;
    Save.load();
    this.bind();
    this.refreshCoins();
    this.show('screen-menu');
    this.updateContinueBtn();
    this.renderSkinPreviewMenu();
  },

  $(id) { return document.getElementById(id); },
  $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); },

  show(id) {
    this.$$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.body.dataset.screen = id;
  },

  /* ---------------- 事件绑定 ---------------- */
  bind() {
    const on = (id, fn) => {
      const el = this.$(id);
      if (el) el.addEventListener('click', () => { SFX.init(); SFX.resume(); SFX.click(); fn(); });
    };

    on('btn-start', () => {
      this.run = null;
      this.pendingMode = 'campaign';
      this.pendingLevel = 1;
      this.openPrep();
    });
    on('btn-endless', () => {
      this.run = null;
      this.pendingMode = 'endless';
      this.openPrep();
    });
    on('btn-continue', () => { if (this.run) this.launchLevel(); });
    on('btn-levels', () => this.openLevels());
    on('btn-shop', () => this.openShop());
    on('btn-achv', () => this.openAchv());
    on('btn-help', () => this.show('screen-help'));

    on('btn-levels-back', () => this.show('screen-menu'));
    on('btn-prep-back', () => this.show('screen-menu'));
    on('btn-shop-back', () => this.show('screen-menu'));
    on('btn-achv-back', () => this.show('screen-menu'));
    on('btn-help-back', () => this.show('screen-menu'));

    on('btn-prep-go', () => this.startRun());

    on('btn-pause', () => this.togglePause());
    on('btn-resume', () => this.togglePause());
    on('btn-restart', () => { this.closePause(); this.launchLevel(); });
    on('btn-quit', () => { this.closePause(); this.abandonRun(); });

    on('btn-reward-next', () => this.nextLevel());
    on('btn-lose-retry', () => {
      const mode = this.run ? this.run.mode : 'campaign';
      const i = this.run ? this.run.levelIndex : 0;
      this.run = null;
      this.pendingMode = mode;
      if (mode === 'endless') {
        this.openPrep();                       // 无尽模式失败后从第 1 层重开
      } else {
        const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
        this.pendingLevel = lv.id;
        this.openPrep();
      }
    });
    on('btn-lose-menu', () => this.abandonRun());

    on('btn-skill', () => { if (this.game) this.game.useSkill(); });

    on('btn-reset', () => {
      if (window.confirm('确定要清空全部进度吗？此操作不可撤销。')) {
        Save.reset();
        this.refreshCoins();
        this.show('screen-menu');
        this.updateContinueBtn();
      }
    });

    const sound = this.$('btn-sound');
    if (sound) {
      sound.addEventListener('click', () => {
        SFX.init(); SFX.resume();
        Save.data.settings.sound = !Save.data.settings.sound;
        SFX.enabled = Save.data.settings.sound;
        save();
        sound.textContent = SFX.enabled ? '音效：开' : '音效：关';
      });
      sound.textContent = Save.data.settings.sound ? '音效：开' : '音效：关';
    }
    SFX.enabled = Save.data.settings.sound;

    // 操作方式：自动识别 → 虚拟摇杆 → 跟随手指
    const ctrl = this.$('btn-control');
    if (ctrl) {
      const MODES = ['auto', 'joystick', 'follow'];
      const LABEL = { auto: '操作：自动', joystick: '操作：摇杆', follow: '操作：跟随' };
      const apply = () => {
        const m = Save.data.settings.controlMode || 'auto';
        ctrl.textContent = LABEL[m] || LABEL.auto;
        if (this.game) this.game.controlMode = m;
      };
      ctrl.addEventListener('click', () => {
        SFX.click();
        const cur = Save.data.settings.controlMode || 'auto';
        const next = MODES[(MODES.indexOf(cur) + 1) % MODES.length];
        Save.data.settings.controlMode = next;
        save();
        apply();
        const desc = {
          auto: '自动识别：触屏用虚拟摇杆，鼠标用指针跟随',
          joystick: '强制虚拟摇杆（触屏推荐）',
          follow: '强制跟随手指 / 指针：点哪走哪',
        };
        this.toast('操作方式：' + desc[next], 2200);
      });
      apply();
    }
  },

  /* 当前是否触屏设备 */
  isTouch() {
    return (typeof window !== 'undefined') &&
      (('ontouchstart' in window) || (navigator && navigator.maxTouchPoints > 0));
  },

  /* 根据设备与操作方式生成引导文案 */
  hintText() {
    const mode = (Save.data.settings && Save.data.settings.controlMode) || 'auto';
    const touch = this.isTouch();
    if (mode === 'follow') {
      return touch ? '按住屏幕，军团朝手指位置移动' : '移动鼠标控制方向 · 空格放技能';
    }
    if (mode === 'joystick') {
      return '按住屏幕拖动，虚拟摇杆控制方向<br>拖得越远走得越快，松手即停';
    }
    return touch
      ? '按住屏幕拖动，虚拟摇杆控制方向<br>拖得越远走得越快，松手即停'
      : '移动鼠标控制方向<br>WASD / 方向键同样可用 · 空格放技能';
  },

  /* ---------------- 金币 / 纪录刷新 ---------------- */
  refreshCoins() {
    this.$$('.js-coins').forEach(el => { el.textContent = Save.data.coins; });
    const eb = this.$('endless-best');
    if (eb) eb.textContent = '最高 第 ' + (Save.data.stats.endlessBest || 0) + ' 层';
  },

  updateContinueBtn() {
    const b = this.$('btn-continue');
    if (!b) return;
    b.hidden = !this.run;
    if (!this.run) return;
    b.textContent = this.run.mode === 'endless'
      ? ('继续挑战 · 无尽 第 ' + (this.run.stage || 1) + ' 层')
      : ('继续挑战 · 第 ' + (LEVELS[this.run.levelIndex] ? LEVELS[this.run.levelIndex].id : 1) + ' 关');
  },

  /* ==========================================================
     出征准备
     ========================================================== */
  openPrep() {
    this.pendingMode = this.pendingMode || 'campaign';
    let lv;
    if (this.pendingMode === 'endless') {
      lv = makeEndlessStage(1);
    } else {
      this.pendingLevel = this.pendingLevel || 1;
      lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, this.pendingLevel - 1))];
      this.pendingLevel = lv.id;
    }

    this.renderStartOptions();
    this.renderSkillPicker();
    const t = this.$('prep-title');
    if (t) t.textContent = this.pendingMode === 'endless' ? '无尽模式 · 从第 1 层开始' : ('第 ' + lv.id + ' 关 · ' + lv.name);
    const d = this.$('prep-goal');
    if (d) {
      d.textContent = this.pendingMode === 'endless'
        ? '无限层数挑战：每层目标人数递增、敌军更多更强、棋盘逐层扩大，看你能撑到第几层'
        : (lv.goal.type === 'reach'
          ? '过关目标：军团达到 ' + lv.goal.val + ' 人'
          : '过关目标：消灭全部 ' + lv.enemies.length + ' 支敌军');
    }
    const tip = this.$('prep-tip');
    if (tip) {
      tip.textContent = this.pendingMode === 'endless'
        ? ('第 1 层：目标 ' + lv.goal.val + ' 人，敌军 ' + lv.enemies.length + ' 支。无尽模式下奖励会一直累积，能走多远看你自己。')
        : (lv.tip || '');
    }
    this.updateContinueBtn();
    this.show('screen-prep');
  },

  renderStartOptions() {
    const wrap = this.$('start-options');
    if (!wrap) return;
    // 先归一化当前选择，保证首次渲染就带正确的选中态
    if (!Save.data._prepCount || Save.data.startOptions.indexOf(Save.data._prepCount) < 0) {
      Save.data._prepCount = Save.data.startOptions[0] || START_OPTIONS[0].count;
    }
    wrap.innerHTML = '';
    START_OPTIONS.forEach(opt => {
      const unlocked = Save.data.startOptions.indexOf(opt.count) >= 0;
      const el = document.createElement('button');
      el.className = 'opt-btn' + (unlocked ? '' : ' locked') + (Save.data._prepCount === opt.count ? ' selected' : '');
      el.innerHTML = '<b>' + opt.count + '</b><span>人</span>' +
        (unlocked ? '' : '<em>通关第 ' + opt.unlockAfter + ' 关解锁</em>');
      el.addEventListener('click', () => {
        SFX.click();
        if (!unlocked) { this.toast('该开局人数尚未解锁，可通过通关奖励获得'); return; }
        Save.data._prepCount = opt.count;
        this.renderStartOptions();
      });
      wrap.appendChild(el);
    });
  },

  renderSkillPicker() {
    const wrap = this.$('skill-picker');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!Save.data._prepSkillId || !Save.data.skills[Save.data._prepSkillId]) {
      Save.data._prepSkillId = Object.keys(Save.data.skills)[0] || 'rush';
    }
    SKILL_LIST.forEach(id => {
      const sk = SKILLS[id];
      const lv = Save.data.skills[id] || 0;
      const el = document.createElement('button');
      el.className = 'skill-card' + (lv ? '' : ' locked') + (Save.data._prepSkillId === id ? ' selected' : '');
      const eff = sk.levels[Math.max(0, Math.min(2, lv - 1))];
      el.innerHTML =
        '<div class="sk-badge" style="--c:' + sk.color + '">' + sk.badge + '</div>' +
        '<div class="sk-body">' +
        '<div class="sk-name">' + sk.name +
        (lv ? '<i class="sk-lv">Lv.' + lv + '</i>' : '<i class="sk-lock">未解锁</i>') + '</div>' +
        '<div class="sk-desc">' + (lv ? eff.desc : '通过通关奖励解锁') + '</div>' +
        '<div class="sk-cd">冷却 ' + sk.cd + ' 秒</div>' +
        '</div>';
      el.addEventListener('click', () => {
        SFX.click();
        if (!lv) { this.toast('技能「' + sk.name + '」尚未解锁，通关奖励中可解锁'); return; }
        Save.data._prepSkillId = id;
        this.renderSkillPicker();
      });
      wrap.appendChild(el);
    });
  },

  /* ==========================================================
     开始一次挑战
     ========================================================== */
  startRun() {
    const mode = this.pendingMode || 'campaign';
    const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (this.pendingLevel || 1) - 1))];
    this.run = {
      mode: mode,
      levelIndex: mode === 'campaign' ? LEVELS.indexOf(lv) : 0,
      stage: 1,
      startLevelId: mode === 'campaign' ? lv.id : 'E1',
      skillId: Save.data._prepSkillId || 'rush',
      startCount: Save.data._prepCount || 3,
      buffs: {},
      coinsEarned: 0,
      totalEaten: 0,
    };
    Save.data.stats.plays = (Save.data.stats.plays || 0) + 1;
    save();
    this.updateContinueBtn();
    this.launchLevel();
  },

  launchLevel() {
    if (!this.run) return;
    let level, idx;
    if (this.run.mode === 'endless') {
      level = makeEndlessStage(this.run.stage || 1);
      idx = -1;
    } else {
      idx = Math.min(this.run.levelIndex, LEVELS.length - 1);
      level = LEVELS[idx];
      this.run.levelIndex = idx;
    }

    this.show('screen-game');
    this.$('pause-overlay').classList.remove('active');
    this.$('hud-level').textContent = this.run.mode === 'endless'
      ? ('无尽模式 · 第 ' + level.stage + ' 层')
      : ('第 ' + level.id + ' 关 · ' + level.name);
    const skin = SKINS.find(s => s.id === Save.data.skinSelected) || SKINS[0];
    this.$('skill-badge').textContent = (SKILLS[this.run.skillId] || SKILLS.rush).badge;
    this.$('skill-badge').style.setProperty('--c', (SKILLS[this.run.skillId] || SKILLS.rush).color);
    this.$('skill-name').textContent = (SKILLS[this.run.skillId] || SKILLS.rush).name + ' Lv.' + (Save.data.skills[this.run.skillId] || 1);
    this.$('hud-count').textContent = this.run.startCount;
    const bf = this.$('buff-tags');
    if (bf) {
      const list = BUFFS.filter(b => (this.run.buffs[b.id] || 0) > 0)
        .map(b => '<span class="tag">' + b.name + ' ×' + this.run.buffs[b.id] + '</span>').join('');
      bf.innerHTML = list || '<span class="tag dim">暂无增益</span>';
    }

    if (this.game) { this.game.destroy(); this.game = null; }

    // 新手引导提示（文案随设备与操作方式变化）
    const isFirstStage = (this.run.mode === 'endless') ? (level.stage === 1) : (level.id === 1);
    const hint = this.$('hint-overlay');
    if (hint) {
      hint.innerHTML = this.hintText();
      hint.classList.toggle('show', isFirstStage);
      if (this.hintTimer) clearTimeout(this.hintTimer);
      if (isFirstStage) this.hintTimer = setTimeout(() => hint.classList.remove('show'), 6000);
    }

    const self = this;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        self.game = new MiniGame({
          canvas: self.$('game-canvas'),
          minimap: self.$('minimap'),
          level,
          levelIndex: idx,
          world: level.world,
          run: self.run,
          controlMode: Save.data.settings.controlMode || 'auto',
          hooks: {
            onHud(d) { self.onHud(d); },
            onWin(r) { self.onWin(r); },
            onLose(r) { self.onLose(r); },
            onInput() {
              SFX.init(); SFX.resume();
              const h = self.$('hint-overlay');
              if (h) h.classList.remove('show');
            },
            // Esc / P 暂停（引擎侧监听键盘，同步界面遮罩）
            onPauseToggle() { self.togglePause(); },
            // 切到后台自动暂停
            onAutoPause() {
              const ov = self.$('pause-overlay');
              if (ov) ov.classList.add('active');
            },
            onLegionDown(L) { if (!L.isPlayer) self.toast(L.name + ' 被吞噬！'); },
          },
        });
        self.game.start();
      });
    });
  },

  /* ---------------- 局内 HUD ---------------- */
  onHud(d) {
    const c = this.$('hud-count');
    if (c) {
      if (c.textContent !== String(d.count)) {
        c.textContent = d.count;
        c.classList.remove('pop');
        void c.offsetWidth;
        c.classList.add('pop');
      }
    }
    const g = this.$('hud-goal');
    if (g) g.textContent = d.goalText;
    const f = this.$('goalbar-fill');
    if (f) f.style.width = (d.progress * 100).toFixed(1) + '%';
    const t = this.$('hud-timer');
    if (t) t.textContent = fmtTime(d.time);

    const cd = this.$('skill-cd');
    const btn = this.$('btn-skill');
    if (cd && btn) {
      if (d.skillCd > 0.05) {
        const pct = d.skillCd / Math.max(0.01, d.skillCdMax);
        cd.style.height = (pct * 100).toFixed(0) + '%';
        btn.classList.add('cooling');
      } else {
        cd.style.height = '0%';
        btn.classList.remove('cooling');
      }
    }

    const list = this.$('enemy-list');
    if (list) {
      let html = '';
      d.enemies.sort((a, b) => b.count - a.count).forEach(e => {
        html += '<div class="enemy-row">' +
          '<i style="background:' + e.body + '"></i>' +
          '<span class="en-name">' + e.name + '</span>' +
          '<b class="' + (e.threat ? 'threat' : 'weak') + '">' + e.count + '</b>' +
          '</div>';
      });
      if (!html) html = '<div class="enemy-row empty">场上已无敌军</div>';
      list.innerHTML = html;
    }
  },

  /* ---------------- 暂停 ---------------- */
  togglePause() {
    if (!this.game) return;
    const ov = this.$('pause-overlay');
    if (this.game.status === 'playing') {
      this.game.pause();
      ov.classList.add('active');
    } else if (this.game.status === 'paused') {
      this.game.resume();
      ov.classList.remove('active');
    }
  },
  closePause() {
    const ov = this.$('pause-overlay');
    if (ov) ov.classList.remove('active');
  },

  abandonRun() {
    if (this.game) { this.game.destroy(); this.game = null; }
    this.run = null;
    save();
    this.updateContinueBtn();
    this.refreshCoins();
    this.show('screen-menu');
  },

  /* ==========================================================
     通关 / 失败结算
     ========================================================== */
  onWin(res) {
    const run = this.run;
    run.coinsEarned += res.coin;
    const id = res.levelId;

    /* ---- 无尽模式 ---- */
    if (res.endless || run.mode === 'endless') {
      const prevBest = Save.data.stats.endlessBest || 0;
      if (res.stage > prevBest) Save.data.stats.endlessBest = res.stage;
      Save.data.stats.wins++;
      if (res.flawless) Save.data.stats.flawless++;
      if (res.comeback) Save.data.stats.comeback++;
      Save.addCoins(res.coin);
      save();
      this.refreshCoins();
      const newAch = this.checkAchievements();

      this.$('reward-stars').innerHTML = '<span class="stage-badge">第 ' + res.stage + ' 层</span>';
      this.$('reward-title').textContent = '无尽第 ' + res.stage + ' 层通过！';
      this.$('reward-sub').textContent = '用时 ' + fmtTime(res.time) + ' · 吞噬 ' + res.eaten +
        ' 个敌人 · 终局 ' + res.count + ' 人' + (res.stage > prevBest ? ' · 新纪录！' : '');
      this.$('reward-coin').textContent = '+' + res.coin;
      this.renderRewards(newAch);
      this.show('screen-reward');
      return;
    }

    /* ---- 关卡推进模式 ---- */
    Save.data.stars[id] = Math.max(Save.data.stars[id] || 0, res.stars);
    if (Save.data.unlockedLevels < id + 1) Save.data.unlockedLevels = Math.min(id + 1, LEVELS.length);
    Save.data.stats.wins++;
    if (res.flawless) Save.data.stats.flawless++;
    if (res.comeback) Save.data.stats.comeback++;
    Save.addCoins(res.coin);
    save();
    this.refreshCoins();

    const newAch = this.checkAchievements();

    // 展示结算 + 三选一
    this.$('reward-stars').innerHTML = this.starsHtml(res.stars);
    this.$('reward-title').textContent = '第 ' + id + ' 关通过！';
    this.$('reward-sub').textContent = '用时 ' + fmtTime(res.time) + ' · 吞噬 ' + res.eaten + ' 个敌人 · 终局 ' + res.count + ' 人' +
      (id >= LEVELS.length ? ' · 全部关卡通关，无尽模式已解锁！' : '');
    this.$('reward-coin').textContent = '+' + res.coin;
    this.renderRewards(newAch);
    this.show('screen-reward');
  },

  onLose(res) {
    if (this.game) { this.game.destroy(); this.game = null; }
    const prevBest = Save.data.stats.endlessBest || 0;
    Save.addCoins(res.coin);
    save();
    this.refreshCoins();
    this.checkAchievements();
    const endless = res.endless || (this.run && this.run.mode === 'endless');
    this.$('lose-title').textContent = '挑战失败';
    this.$('lose-sub').textContent = (res.reason || '军团被吞噬殆尽') +
      (endless
        ? (' · 无尽模式 第 ' + (res.stage || 1) + ' 层 · 存活 ' + fmtTime(res.time) + ' · 最高纪录 第 ' + Math.max(prevBest, res.stage || 0) + ' 层')
        : (' · 第 ' + res.levelId + ' 关 · 存活 ' + fmtTime(res.time)));
    this.$('lose-coin').textContent = '+' + res.coin + '（安慰奖）';
    this.show('screen-lose');
  },

  starsHtml(n) {
    let s = '';
    for (let i = 0; i < 3; i++) s += '<span class="star' + (i < n ? ' on' : '') + '">★</span>';
    return s;
  },

  /* ---------------- 三选一奖励 ---------------- */
  renderRewards(newAch) {
    const wrap = this.$('reward-cards');
    wrap.innerHTML = '';
    const cards = this.rollRewards();
    this.chosen = false;
    cards.forEach(card => {
      const el = document.createElement('button');
      el.className = 'reward-card';
      el.style.setProperty('--c', card.color);
      el.innerHTML =
        '<div class="rc-icon">' + card.icon + '</div>' +
        '<div class="rc-title">' + card.title + '</div>' +
        '<div class="rc-desc">' + card.desc + '</div>' +
        '<div class="rc-kind">' + card.kind + '</div>';
      el.addEventListener('click', () => {
        if (this.chosen) return;
        this.chosen = true;
        SFX.coin();
        card.apply();
        save();
        this.refreshCoins();
        this.$$('#reward-cards .reward-card').forEach(x => x.classList.add('fade'));
        el.classList.remove('fade');
        el.classList.add('picked');
        this.$('btn-reward-next').classList.add('show');
      });
      wrap.appendChild(el);
    });
    const nextBtn = this.$('btn-reward-next');
    nextBtn.textContent = (this.run && this.run.mode === 'endless') ? '进入下一层' : '进入下一关';
    nextBtn.classList.remove('show');

    if (newAch && newAch.length) {
      newAch.forEach(a => this.toast('成就达成：' + a.name + '（+' + a.coins + ' 金币）', 2600));
    }
  },

  rollRewards() {
    const run = this.run;
    const pool = [];

    // 金币（随进度递增：主线按关卡序号，无尽按层数）
    const progress = run.mode === 'endless' ? (run.stage || 1) : (run.levelIndex + 1);
    const coinAmt = 60 + Math.round(Math.random() * 40) + progress * 8;
    pool.push({
      w: 30, kind: '货币', icon: '金', color: '#ffd93d',
      title: '金币 +' + coinAmt,
      desc: '用于在皮肤商店解锁全新外观',
      apply: () => { Save.addCoins(coinAmt); run.coinsEarned += coinAmt; },
    });

    // 技能解锁 / 升级
    SKILL_LIST.forEach(id => {
      const sk = SKILLS[id];
      const lv = Save.data.skills[id] || 0;
      if (lv === 0) {
        pool.push({
          w: 24, kind: '技能解锁', icon: sk.badge, color: sk.color,
          title: '解锁 · ' + sk.name,
          desc: sk.levels[0].desc + '（永久解锁）',
          apply: () => { Save.unlockSkill(id); },
        });
      } else if (lv < 3) {
        pool.push({
          w: 20, kind: '技能升级', icon: sk.badge, color: sk.color,
          title: sk.name + ' → Lv.' + (lv + 1),
          desc: sk.levels[lv].desc + '（永久强化）',
          apply: () => { Save.unlockSkill(id); },
        });
      }
    });

    // 本局增益
    BUFFS.forEach(b => {
      const n = run.buffs[b.id] || 0;
      if (n >= b.max) return;
      pool.push({
        w: 26, kind: '本局增益', icon: '增', color: '#2ee6a8',
        title: b.name + (n ? ' ×' + (n + 1) : ''),
        desc: b.desc + '（本次挑战内持续累积）',
        apply: () => { run.buffs[b.id] = n + 1; },
      });
    });

    // 开局人数解锁
    START_OPTIONS.forEach(o => {
      if (Save.data.startOptions.indexOf(o.count) >= 0) return;
      if (o.count === 3) return;
      pool.push({
        w: 12, kind: '永久奖励', icon: '兵', color: '#4dd2ff',
        title: '解锁开局 ' + o.count + ' 人',
        desc: '以后每次出征都可以选择 ' + o.count + ' 人开局',
        apply: () => { Save.data.startOptions.push(o.count); Save.data.startOptions.sort((a, b) => a - b); },
      });
    });

    // 加权随机取 3 张（不重复）
    const picked = [];
    const avail = pool.slice();
    while (picked.length < 3 && avail.length) {
      let total = 0;
      avail.forEach(c => total += c.w);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < avail.length; i++) { r -= avail[i].w; if (r <= 0) { idx = i; break; } }
      picked.push(avail.splice(idx, 1)[0]);
    }
    return picked;
  },

  nextLevel() {
    if (!this.run) return;
    if (this.run.mode === 'endless') {
      this.run.stage = (this.run.stage || 1) + 1;      // 无尽：层数无限递增
    } else {
      this.run.levelIndex++;
      if (this.run.levelIndex >= LEVELS.length) this.run.levelIndex = LEVELS.length - 1;
    }
    save();
    this.launchLevel();
  },

  /* ==========================================================
     关卡选择
     ========================================================== */
  openLevels() {
    const wrap = this.$('level-grid');
    wrap.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const unlocked = lv.id <= Save.data.unlockedLevels || lv.id === 13 && Save.data.unlockedLevels >= 13;
      const st = Save.data.stars[lv.id] || 0;
      const el = document.createElement('button');
      el.className = 'level-cell' + (unlocked ? '' : ' locked');
      el.innerHTML =
        '<div class="lv-id">' + lv.id + '</div>' +
        '<div class="lv-name">' + (unlocked ? lv.name : '未解锁') + '</div>' +
        '<div class="lv-goal">' + (lv.goal.type === 'reach' ? '达到 ' + lv.goal.val + ' 人' : '消灭敌军') + '</div>' +
        '<div class="lv-stars">' + this.starsHtml(st) + '</div>';
      el.addEventListener('click', () => {
        SFX.click();
        if (!unlocked) { this.toast('先通关前面的关卡吧'); return; }
        this.run = null;
        this.pendingLevel = lv.id;
        this.openPrep();
      });
      wrap.appendChild(el);
    });
    this.show('screen-levels');
  },

  /* ==========================================================
     商店
     ========================================================== */
  openShop() {
    const wrap = this.$('skin-grid');
    wrap.innerHTML = '';
    SKINS.forEach(sk => {
      const owned = Save.data.skinsOwned.indexOf(sk.id) >= 0;
      const using = Save.data.skinSelected === sk.id;
      const el = document.createElement('div');
      el.className = 'skin-cell' + (using ? ' using' : '');
      el.innerHTML =
        '<div class="skin-prev"><canvas width="76" height="86"></canvas></div>' +
        '<div class="skin-name">' + sk.name + '</div>' +
        '<div class="skin-tag">' + (sk.tag || '基础款') + '</div>' +
        '<div class="skin-act"></div>';
      const cv = el.querySelector('canvas');
      const g = cv.getContext('2d');
      const spr = GameUtils.makeSprite(sk.body, sk.style === 'rainbow' ? 'plain' : sk.style);
      g.clearRect(0, 0, 76, 86);
      g.drawImage(spr, 76 / 2 - 34, 86 / 2 - 38, 68, 76);

      const act = el.querySelector('.skin-act');
      if (using) {
        act.innerHTML = '<span class="btn-mini on">使用中</span>';
      } else if (owned) {
        act.innerHTML = '<button class="btn-mini use">使用</button>';
        act.querySelector('button').addEventListener('click', () => {
          SFX.click();
          Save.data.skinSelected = sk.id;
          save();
          this.openShop();
          this.renderSkinPreviewMenu();
          this.toast('已切换皮肤：' + sk.name);
        });
      } else {
        act.innerHTML = '<button class="btn-mini buy">' + sk.price + ' 金币</button>';
        act.querySelector('button').addEventListener('click', () => {
          if (!Save.spendCoins(sk.price)) { SFX.lose(); this.toast('金币不足，去关卡里多赚点吧'); return; }
          Save.data.skinsOwned.push(sk.id);
          Save.data.skinSelected = sk.id;
          save();
          SFX.coin();
          this.refreshCoins();
          this.openShop();
          this.renderSkinPreviewMenu();
          this.checkAchievements();
          this.toast('解锁成功：' + sk.name);
        });
      }
      wrap.appendChild(el);
    });
    this.refreshCoins();
    this.show('screen-shop');
  },

  renderSkinPreviewMenu() {
    const cv = this.$('menu-preview');
    if (!cv) return;
    const sk = SKINS.find(s => s.id === Save.data.skinSelected) || SKINS[0];
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const spr = GameUtils.makeSprite(sk.body, sk.style === 'rainbow' ? 'plain' : sk.style);
    g.drawImage(spr, cv.width / 2 - 30, cv.height / 2 - 34, 60, 68);
  },

  /* ==========================================================
     成就
     ========================================================== */
  openAchv() {
    const wrap = this.$('achv-list');
    wrap.innerHTML = '';
    let done = 0;
    ACHIEVEMENTS.forEach(a => {
      const got = !!Save.data.achievements[a.id];
      if (got) done++;
      const el = document.createElement('div');
      el.className = 'achv-row' + (got ? ' done' : '');
      el.innerHTML =
        '<div class="ac-icon">' + (got ? '★' : '☆') + '</div>' +
        '<div class="ac-body"><div class="ac-name">' + a.name + '</div>' +
        '<div class="ac-desc">' + a.desc + '</div></div>' +
        '<div class="ac-coin">+' + a.coins + '</div>';
      wrap.appendChild(el);
    });
    const p = this.$('achv-progress');
    if (p) p.textContent = '已完成 ' + done + ' / ' + ACHIEVEMENTS.length;
    this.refreshCoins();
    this.show('screen-achv');
  },

  checkAchievements() {
    const newly = [];
    ACHIEVEMENTS.forEach(a => {
      if (Save.data.achievements[a.id]) return;
      let ok = false;
      try { ok = !!a.check(Save.data); } catch (e) { ok = false; }
      if (ok) {
        Save.data.achievements[a.id] = true;
        Save.addCoins(a.coins);
        newly.push(a);
      }
    });
    if (newly.length) { save(); SFX.achieve(); }
    return newly;
  },

  /* ---------------- 提示条 ---------------- */
  toast(msg, ms) {
    const wrap = this.$('toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); }, ms || 1800);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, (ms || 1800) + 400);
  },
};

function save() { Save.persist(); }
window.addEventListener('load', () => UI.init());
