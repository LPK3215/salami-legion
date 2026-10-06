/* ==========================================================
   蚕食军团 · 项目全景观览 —— 交互与渲染
   数据来源：./facts.js 的 window.OVERVIEW_FACTS（由 npm run overview:data 生成）
   原则：页面上所有数字一律来自 facts，不在此文件手写任何统计值。
   ========================================================== */
(function () {
  'use strict';

  var F = window.OVERVIEW_FACTS;
  if (!F) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="padding:20px;border:1px dashed #ff5b6e;margin:80px 20px;border-radius:12px">' +
      '缺少 <code>facts.js</code>。请在仓库根目录执行 <code>npm run overview:data</code> 后刷新。</div>');
    return;
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var pick = function (obj, pathStr) {
    return pathStr.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  };
  var num = function (n) { return Number(n).toLocaleString('zh-CN'); };

  /* ---------- 1. data-fact 文本注入 ---------- */
  $$('[data-fact]').forEach(function (el) {
    var v = pick(F, el.getAttribute('data-fact'));
    if (v === undefined || v === null) { el.textContent = '—'; el.classList.add('dim'); return; }
    el.textContent = typeof v === 'number' ? num(v) : v;
  });

  /* ---------- 2. 数字滚动动画 ---------- */
  function countUp(el) {
    var target = Number(pick(F, el.getAttribute('data-count')) || 0);
    var dur = 900, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = num(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counted = new WeakSet();
  var statObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !counted.has(e.target)) { counted.add(e.target); countUp(e.target); }
    });
  }, { threshold: 0.4 });
  $$('[data-count]').forEach(function (el) { statObs.observe(el); });

  /* ---------- 3. 代码块：注入真实片段 + 单次分词高亮 + 行号 ---------- */
  /* 实现说明：高亮必须一趟完成。上一版先注 <span> 再跑下一条正则，
     关键字正则会二次命中自己写的 class="s" 里的 class，把标签打断成乱码文本（实测 61 行坏了 9 行）。 */
  var RULES = {
    js: [
      { re: /\bhttps?:\/\/[^\s,}'")]+/, cls: 's' },
      { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/, cls: 'c' },
      { re: /'(?:[^'\\\n]|\\.)*'/, cls: 's' },
      { re: /&quot;(?:[^&]|&(?!quot;))*?&quot;/, cls: 's' },
      { re: /\b(?:const|let|var|function|return|if|else|for|of|new|class|null|true|false|this|await)\b/, cls: 'k' },
      { re: /\b\d+(?:\.\d+)?\b/, cls: 'n' },
    ],
    bash: [
      { re: /#[^\n]*/, cls: 'c' },
      { re: /\b(?:npm\s+(?:install|start|test|run)|npm|node|git\s+clone|git\s+push|git|cd|bash|PORT)\b/, cls: 'k' },
      { re: /https?:\/\/[^\s]+/, cls: 's' },
      { re: /\b\d{2,}\b/, cls: 'n' },
    ],
    html: [
      { re: /&lt;\/?[\w-]+/, cls: 'k' },
      { re: /[\w-]+=&quot;[^&]*&quot;/, cls: 's' },
      { re: /&gt;/, cls: 'k' },
    ],
    bibtex: [
      { re: /https?:\/\/[^\s}]+/, cls: 's' },
      { re: /^\s*@\w+/, cls: 'k' },
      { re: /\b(?:author|title|year|version|license|url)\b/, cls: 'f' },
      { re: /\b\d{4}\b/, cls: 'n' },
    ],
    text: [],
  };

  function highlight(code, lang) {
    var rules = RULES[lang] || RULES.text;
    var s = esc(code);
    if (rules.length) {
      var re = new RegExp(rules.map(function (r) { return '(' + r.re.source + ')'; }).join('|'), 'gm');
      s = s.replace(re, function () {
        var args = arguments;
        for (var i = 1; i <= rules.length; i++) {
          if (args[i] !== undefined) return '<span class="' + rules[i - 1].cls + '">' + args[i] + '</span>';
        }
        return args[0];
      });
    }
    return s.split('\n').map(function (l) { return '<span class="ln">' + (l || ' ') + '</span>'; }).join('');
  }

  $$('[data-snippet]').forEach(function (pre) {
    var key = pre.getAttribute('data-snippet');
    var txt = F.snippets[key];
    var lang = pre.closest('.code').getAttribute('data-lang') || 'js';
    if (!txt) { pre.innerHTML = '<span class="ln c">// 未能在源码中定位该片段</span>'; return; }
    pre.innerHTML = highlight(txt, lang);
  });

  $$('[data-list]').forEach(function (pre) {
    var arr = pick(F, pre.getAttribute('data-list')) || [];
    pre.innerHTML = highlight(arr.join('\n'), 'text');
  });

  /* 快速开始里手写的命令块也统一加高亮与行号 */
  $$('.code').forEach(function (box) {
    var pre = box.querySelector('pre');
    if (pre && pre.innerHTML.indexOf('<span class="ln"') < 0) {
      pre.innerHTML = highlight(pre.textContent.trim(), box.getAttribute('data-lang') || 'text');
    }
  });

  /* ---------- 3b. Tab 切换（上一版缺失，导致四张表永远打不开） ---------- */
  $$('.tabs').forEach(function (tabs) {
    tabs.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.tab');
      if (!btn || !tabs.contains(btn)) return;
      $$('.tab', tabs).forEach(function (t) { t.classList.toggle('active', t === btn); });
      var id = btn.getAttribute('data-pane');
      $$('.pane').forEach(function (p) { p.classList.toggle('active', p.id === id); });
    });
  });

  /* ---------- 4. 目录树 ---------- */
  var TREE_DESC = {
    'index.html': '游戏主页：9 个 screen 区块 + HUD',
    'css/style.css': '全站样式与 :root 主题色',
    'js/config.js': '数值与内容唯一真源',
    'js/engine.js': '核心引擎（Legion / updateCombat / AI / 渲染）',
    'js/ui.js': '界面流转，接收引擎 hooks',
    'js/save.js': 'localStorage 存档读写',
    'js/audio.js': 'WebAudio 音效合成',
    'server.js': '零依赖静态服务器（本地/云预览）',
    'scripts/start.sh': 'CNB 云环境幂等启动脚本',
    'scripts/visualization': '文档图表与本页数据的生成器',
    'test/dom.test.js': 'jsdom 端到端测试',
    'docs': '玩法与开发文档（5 篇）',
    'README.md': '项目说明',
    'CONTRIBUTING.md': '贡献规范（含存档键红线）',
    'CHANGELOG.md': '变更日志',
    'FAQ.md': '常见问题',
    'SECURITY.md': '安全策略与漏洞报告渠道',
    'CODE_OF_CONDUCT.md': '行为准则',
    'AUTHORS': '作者与维护者',
    'LICENSE': 'MIT 许可全文',
    '.nojekyll': '禁用 Pages 的 Jekyll 处理',
    '.cnb.yml': 'CNB 云开发环境配置',
    '.gitignore': '忽略规则',
    '.gitattributes': '行尾与差异规则',
    '.editorconfig': '编辑器统一约定',
    'package.json': '脚本、依赖、开源元数据',
    'package-lock.json': '测试依赖版本锁定（生成物）',
    'project_overview': '本页（项目全景观览）',
    'project_overview.html': '根目录入口跳转页',
  };
  function treeNodes(nodes) {
    var ul = document.createElement('ul');
    nodes.forEach(function (n) {
      var li = document.createElement('li');
      var desc = TREE_DESC[n.path] || (n.path.indexOf('docs/') === 0 ? '开发文档' : n.path.indexOf('scripts/visualization/') === 0 ? '生成脚本' : '');
      if (n.type === 'dir') {
        var d = document.createElement('details');
        if (['js', 'css', 'scripts', 'test'].indexOf(n.name) >= 0) d.open = true;
        var sum = document.createElement('summary');
        sum.className = 'row';
        sum.innerHTML = '<span class="nm">' + esc(n.name) + '/</span><span class="ds">' + esc(desc) + '</span>';
        d.appendChild(sum);
        if (n.children && n.children.length) d.appendChild(treeNodes(n.children));
        li.appendChild(d);
      } else {
        var row = document.createElement('div');
        row.className = 'row leaf';
        row.innerHTML = '<span class="nm">' + esc(n.name) + '</span>' +
          '<span class="sz">' + (n.lines ? n.lines + ' 行' : '') + ' · ' + (n.bytes / 1024).toFixed(1) + ' KB</span>' +
          '<span class="ds">' + esc(desc) + '</span>';
        li.appendChild(row);
      }
      ul.appendChild(li);
    });
    return ul;
  }
  var treeRoot = $('#treeRoot');
  if (treeRoot) treeRoot.appendChild(treeNodes(F.tree));
  $$('[data-tree]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('details', treeRoot).forEach(function (d) { d.open = b.getAttribute('data-tree') === 'expand'; });
    });
  });

  /* ---------- 5. 数据表格 ---------- */
  function table(cols, rows) {
    var html = '<table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    return html;
  }
  var goalLabel = function (l) {
    return l.goalType === 'reach'
      ? '<span class="badge reach">达到 ' + l.goalVal + ' 人</span>'
      : '<span class="badge eliminate">消灭全部敌军</span>';
  };
  var TABLES = {
    levels: function () {
      return table(['#', '关卡', '目标', '中立小人', '敌军（人数 × 支数）', '两星线 par', '三星线 gold', '金币', '战术提示'],
        F.levels.map(function (l) {
          var ec = l.enemies.map(function (e) { return e.c; });
          return [l.id, '<b>' + esc(l.name) + '</b>', goalLabel(l), l.neutral,
            l.enemies.length + ' 支 · ' + ec.join(' / '), l.par + 's', l.gold + 's', l.coins,
            '<span class="dim tiny">' + esc(l.tip) + '</span>'];
        }));
    },
    skills: function () {
      return table(['图标', '技能', 'id', '冷却', '解锁条件', 'Lv.1 效果'],
        F.skills.map(function (s) {
          return ['<span class="swatch" style="background:' + s.color + ';color:' + s.color + '"></span><b>' + esc(s.badge) + '</b>',
            '<b>' + esc(s.name) + '</b>', '<code>' + s.id + '</code>', s.cd + 's',
            s.unlockAfter ? '通关第 ' + s.unlockAfter + ' 关' : '<span class="dim">初始可用</span>',
            '<span class="dim tiny">' + esc((s.levels && s.levels[0]) || '') + '</span>'];
        }));
    },
    buffs: function () {
      return table(['增益', 'id', '累加键', '单次值', '可叠层数', '说明'],
        F.buffs.map(function (b) {
          return ['<b>' + esc(b.name) + '</b>', '<code>' + b.id + '</code>', '<code>' + b.stat + '</code>',
            b.val, b.max, '<span class="dim tiny">' + esc(b.desc) + '</span>'];
        }));
    },
    skins: function () {
      return table(['颜色', '皮肤', 'id', '造型 style', '价格', '标签'],
        F.skins.map(function (s) {
          return ['<span class="swatch" style="background:' + s.body + ';color:' + s.body + '"></span>',
            '<b>' + esc(s.name) + '</b>', '<code>' + s.id + '</code>', '<code>' + s.style + '</code>',
            s.price === 0 ? '<span class="badge">默认</span>' : s.price + ' 金币',
            s.tag ? '<span class="dim tiny">' + esc(s.tag) + '</span>' : ''];
        }));
    },
    achievements: function () {
      return table(['成就', 'id', '达成条件', '奖励金币'],
        F.achievements.map(function (a) {
          return ['<b>' + esc(a.name) + '</b>', '<code>' + a.id + '</code>',
            '<span class="dim">' + esc(a.desc) + '</span>', a.coins];
        }));
    },
    docs: function () {
      var extra = [
        { file: 'README.md', title: '项目说明', quote: '上手、模式、文档索引、运行与测试' },
        { file: 'CONTRIBUTING.md', title: '贡献指南', quote: '环境、文件职责、红线（存档键）、PR 流程与自检' },
        { file: 'CHANGELOG.md', title: '更新日志', quote: 'Keep a Changelog + 语义化版本' },
        { file: 'FAQ.md', title: '常见问题', quote: '运行 / 玩法 / 存档 / 开发 / 许可 —— 共 ' + F.faq.questions + ' 问' },
        { file: 'SECURITY.md', title: '安全策略', quote: '攻击面、已实现防护、残余风险与报告渠道' },
        { file: 'CODE_OF_CONDUCT.md', title: '行为准则', quote: 'Contributor Covenant 2.1 精简版' },
        { file: 'AUTHORS', title: '作者与维护者', quote: '署名与贡献者追加规则' },
        { file: 'docs/architecture.svg', title: '架构图（生成）', quote: '架构与数据流，数字运行时取自真源' },
        { file: 'docs/attrition-mechanic.svg', title: '机制图（生成）', quote: '按拍吞噬（擦边逐个吞、覆盖同批吞）与一次性吞并对比' },
        { file: 'docs/content-scale.svg', title: '量级图（生成）', quote: '内容条目数条形图' },
      ];
      var rows = F.docSummaries.map(function (d) {
        return ['<a href="../' + d.file + '" target="_blank" rel="noopener"><code>' + esc(d.file) + '</code></a>',
          '<b>' + esc(d.title) + '</b>', '<span class="dim tiny">' + esc(d.quote) + '</span>'];
      }).concat(extra.map(function (d) {
        return ['<a href="../' + d.file + '" target="_blank" rel="noopener"><code>' + esc(d.file) + '</code></a>',
          '<b>' + esc(d.title) + '</b>', '<span class="dim tiny">' + esc(d.quote) + '</span>'];
      }));
      return table(['文件', '标题', '一句话内容'], rows);
    },
  };
  $$('[data-table]').forEach(function (box) {
    var key = box.getAttribute('data-table');
    if (TABLES[key]) box.innerHTML = TABLES[key]();
  });

  /* ---------- 6. 引用格式（BibTeX，字段全部来自 facts） ---------- */
  var bib = $('#bibtext');
  if (bib) {
    bib.textContent = [
      '@software{salami_legion,',
      '  author  = {' + F.meta.author + '},',
      '  title   = {' + F.meta.projectEn + '（' + F.meta.project + '）},',
      '  year    = {2026},',
      '  version = {' + F.meta.version + '},',
      '  license = {' + F.meta.license + '},',
      '  url     = {' + F.meta.repo + '}',
      '}',
    ].join('\n');
    var pre = bib;
    pre.innerHTML = highlight(pre.textContent, 'bibtex');
  }

  /* ---------- 7. 导航 / 目录 / 高亮 ---------- */
  var SECTIONS = [
    ['hero', 'Hero'], ['overview', '项目简介'], ['play', '立即开玩'], ['arch', '架构全景'], ['mechanic', '核心机制'],
    ['stack', '技术栈'], ['content', '内容量级'], ['tree', '目录结构'], ['start', '快速开始'],
    ['api', '引擎 API'], ['quality', '测试与质量'], ['docs', '文档索引'], ['contrib', '贡献指南'],
    ['license', '许可与引用'],
  ];
  var tocList = $('#tocList');
  if (tocList) {
    tocList.innerHTML = SECTIONS.map(function (s) {
      return '<li><a href="#' + s[0] + '">' + esc(s[1]) + '</a></li>';
    }).join('');
  }
  var navLinks = $$('#navLinks a').concat($$('#tocList a'));

  var progress = $('#progress');
  var toTop = $('#toTop');
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (progress) progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    if (toTop) toTop.classList.toggle('show', h.scrollTop > window.innerHeight * 0.9);
    var cur = '';
    SECTIONS.forEach(function (s) {
      var el = document.getElementById(s[0]);
      if (el && el.getBoundingClientRect().top <= 120) cur = s[0];
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + cur);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  var burger = $('#burger'), navLinksBox = $('#navLinks');
  if (burger) burger.addEventListener('click', function () { navLinksBox.classList.toggle('open'); });
  $$('#navLinks a').forEach(function (a) { a.addEventListener('click', function () { navLinksBox.classList.remove('open'); }); });

  var tocToggle = $('#tocToggle'), toc = $('#toc');
  if (tocToggle) tocToggle.addEventListener('click', function () { toc.classList.toggle('collapsed'); });

  /* ---------- 8. 主题切换（独立键名，不碰游戏存档键） ---------- */
  var THEME_KEY = 'salami_overview_theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = $('#themeToggle');
    if (b) b.textContent = t === 'light' ? '🌙' : '☀️';
  }
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }
  applyTheme(saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  var themeBtn = $('#themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* file:// 下可能不可用 */ }
    if (window.OVERVIEW_CHARTS) window.OVERVIEW_CHARTS.draw(true);
  });

  /* ---------- 9. 复制 ---------- */
  var toast = $('#toast');
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(say._t);
    say._t = setTimeout(function () { toast.classList.remove('show'); }, 1600);
  }
  function copyText(txt, okMsg) {
    var done = function () { say(okMsg || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(txt); done(); });
    } else { fallback(txt); done(); }
  }
  function fallback(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }
  $$('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-copy');
      var txt = key ? F.snippets[key] : btn.closest('.code').querySelector('pre').textContent;
      copyText(txt || '');
    });
  });
  var cloneBtn = $('#copyClone');
  if (cloneBtn) cloneBtn.addEventListener('click', function () { copyText('git clone ' + F.meta.cloneUrl, '克隆命令已复制'); });
  var bibBtn = $('#copyBib');
  if (bibBtn) bibBtn.addEventListener('click', function () { copyText($('#bibtext').textContent, '引用已复制'); });

  /* ---------- 10. 架构图 hover 说明 ---------- */
  var TIPS = {
    ui: '<b>表现层</b>：所有界面在同一张 <code>index.html</code> 内以 <code>screen</code> 区块切换，样式集中在 <code>css/style.css</code>，脚本按 config → save → audio → engine → ui 的顺序加载，<b>顺序不可调整</b>。',
    cfg: '<b>数据真源 <code>js/config.js</code></b>：关卡、技能、增益、皮肤、成就、开局档位与无尽规则全在这里。<b>加内容优先改这个文件</b>，UI 会自动跟着渲染。',
    engine: '<b>引擎层 <code>js/engine.js</code></b>：一个 IIFE，只暴露 <code>MiniGame</code> 与 <code>GameUtils</code>。含按拍吞噬的 <code>updateCombat()</code>（单批量由 <code>engulfedCount()</code> 按圆盘重叠算出）、按军团对维护的 <code>pairTimers</code>、AI 决策、黄金角螺旋编队、空间网格与 Canvas 渲染。',
    mods: '<b>外围模块</b>：<code>ui.js</code> 负责界面流转并接收引擎 hooks；<code>save.js</code> 做存档 merge/persist/reset，老存档字段会自动补全；<code>audio.js</code> 用振荡器合成音效，无音频文件。',
    api: '<b>浏览器能力</b>：Canvas 2D（精灵缓存 + 视口裁剪 + 小地图）、WebAudio（首次交互解锁上下文）、localStorage（键名与产品名解耦，<b>改名不动键</b>）。',
  };
  var tipBox = $('#archTip');
  if (tipBox) {
    tipBox.innerHTML = TIPS.ui;
    $$('#archSvg .layer').forEach(function (g) {
      g.addEventListener('mouseenter', function () {
        var k = g.getAttribute('data-node');
        tipBox.innerHTML = TIPS[k] || '';
        $$('#archSvg .layer').forEach(function (o) { o.classList.toggle('dim', o !== g); });
      });
      g.addEventListener('mouseleave', function () {
        $$('#archSvg .layer').forEach(function (o) { o.classList.remove('dim'); });
      });
    });
  }

  /* ---------- 11. 区块进场动画 ---------- */
  $$('.sec, .hero').forEach(function (s) { s.classList.add('reveal'); });
  var revObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); } });
  }, { threshold: 0.06 });
  $$('.reveal').forEach(function (el) { revObs.observe(el); });

  /* ---------- 12. 图表（图表逻辑在 charts.js） ---------- */
  if (window.OVERVIEW_CHARTS) window.OVERVIEW_CHARTS.draw();
})();
