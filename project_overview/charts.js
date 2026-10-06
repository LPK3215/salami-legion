/* ==========================================================
   蚕食军团 · 项目全景观览 —— Chart.js 图表配置与数据
   依赖：./facts.js 先行加载（window.OVERVIEW_FACTS）。
   降级：若 Chart.js CDN 不可用（离线双击打开 / 网络受限），
         自动在图表位置改为渲染等价的 HTML 表格，信息不丢。
   原则：数据全部来自 facts，本文件不写任何统计数值。
   ========================================================== */
(function () {
  'use strict';

  var F = window.OVERVIEW_FACTS;

  function css(v, fb) {
    var x = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    return x || fb;
  }

  /* 降级用：把数据渲染成表格塞进原位置 */
  function fallbackTable(box, cols, rows) {
    var host = box.parentNode;
    var div = document.createElement('div');
    div.className = 'chart-fallback';
    div.innerHTML = '<p>Chart.js 未能加载（离线或被拦截），已降级为表格视图。</p>' +
      '<table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table>';
    host.replaceChild(div, box);
  }

  /* ---- 数据构造（全部由 facts 推导） ---- */
  /* 机制示意图：双方初始人数与「每拍被盖住几个」为示意值（与图内文字标注一致），
     而台阶间隔严格使用配置里的 CFG.eat.interval；单批上限读 CFG.eat.batchMax。 */
  function attritionDatasets() {
    var iv = F.mechanics.eatInterval;
    var ENEMY = 5, ME = 3, n = ENEMY;
    var foe = [], me = [], foeOne = [], meOne = [];
    for (var k = 0; k <= n; k++) {
      var t = +(k * iv).toFixed(4);
      foe.push({ x: t, y: ENEMY - k });
      me.push({ x: t, y: ME + k });
    }
    for (var j = 0; j <= n; j++) {
      var tt = +(j * iv).toFixed(4);
      foeOne.push({ x: tt, y: j === 0 ? ENEMY : 0 });
      meOne.push({ x: tt, y: j === 0 ? ME : ENEMY + ME });
    }
    /* 覆盖场景：一拍同批吞 COVER 个（COVER 是机制示意值，与图内标注一致；
       真实上限是 CFG.eat.batchMax，写在图例文字里） */
    var COVER = 2;
    var steps = Math.ceil(ENEMY / COVER);
    var foeCov = [], meCov = [];
    for (var s = 0; s <= steps; s++) {
      var eaten = Math.min(ENEMY, COVER * s);
      var ts = +(Math.min(s * iv, iv * n)).toFixed(4);
      foeCov.push({ x: ts, y: ENEMY - eaten });
      meCov.push({ x: ts, y: ME + eaten });
    }
    return { foe: foe, me: me, foeOne: foeOne, meOne: meOne,
             foeCov: foeCov, meCov: meCov, cover: COVER, iv: iv, n: n };
  }

  function contentSeries() {
    return [
      ['成就', F.content.achievements],
      ['主线关卡', F.content.levels],
      ['皮肤', F.content.skins],
      ['本局技能', F.content.skills],
      ['三选一增益', F.content.buffs],
      ['敌军配色', F.content.enemyPalettes],
      ['开局档位', F.content.startOptions],
      ['界面屏数', F.totals.screens],
    ];
  }

  function difficultySeries() {
    return F.levels.map(function (l) {
      return {
        id: l.id,
        name: l.name,
        neutral: l.neutral,
        enemyTotal: l.enemies.reduce(function (a, e) { return a + e.c; }, 0),
        coins: l.coins,
      };
    });
  }

  /* ---- 绘制 ---- */
  function draw(rebuild) {
    if (!F) return;
    var hasChart = typeof window.Chart !== 'undefined';

    if (!hasChart) {
      var a = attritionDatasets();
      var boxes = [
        ['chartAttrition', ['接触后秒数', '本作·擦边·敌方', '本作·擦边·我方', '本作·盖住' + a.cover + '个/拍·敌方', '本作·盖住' + a.cover + '个/拍·我方', '同类·敌方', '同类·我方'],
          a.foe.map(function (pt, i) {
            var cov = a.foeCov[i] || a.foeCov[a.foeCov.length - 1];
            var covMe = a.meCov[i] || a.meCov[a.meCov.length - 1];
            return [pt.x.toFixed(2), pt.y, a.me[i].y, cov.y, covMe.y, a.foeOne[i].y, a.meOne[i].y];
          })],
        ['chartContent', ['门类', '条目数'], contentSeries().map(function (r) { return [r[0], r[1]]; })],
        ['chartCurve', ['关卡', '中立小人', '敌军总人数', '金币'],
          difficultySeries().map(function (d) { return ['#' + d.id + ' ' + d.name, d.neutral, d.enemyTotal, d.coins]; })],
      ];
      boxes.forEach(function (b) {
        var el = document.getElementById(b[0]);
        if (el) fallbackTable(el, b[1], b[2]);
      });
      return;
    }

    var ink = css('--txt', '#eaf1ff');
    var dim = css('--txt-dim', 'rgba(234,241,255,.62)');
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    /* 网格线颜色必须跟主题走：浅色底上用淡蓝白几乎看不见 */
    var line = light ? 'rgba(18,35,63,.12)' : 'rgba(160,190,255,.16)';
    var gold = light ? '#c98a00' : css('--gold', '#ffd93d');
    var blue = css('--blue', '#3d9bff');
    var red = css('--red', '#ff5b6e');
    var green = light ? '#0f9d6b' : css('--green', '#2ee6a8');
    var purple = css('--purple', '#a66bff');

    window.Chart.defaults.color = dim;
    window.Chart.defaults.font.family = 'Inter, system-ui, "PingFang SC", sans-serif';
    window.Chart.defaults.borderColor = line;

    if (rebuild) {
      Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].destroy(); });
      charts = {};
    }

    /* --- 图 1：按拍吞噬（擦边逐个吞 / 覆盖同批吞）vs 一次性吞并 --- */
    var el1 = document.getElementById('chartAttrition');
    if (el1 && !charts.attrition) {
      var D = attritionDatasets();
      charts.attrition = new window.Chart(el1, {
        type: 'line',
        data: {
          datasets: [
            { label: '本作 · 敌方人数（擦边 1 个/拍）', data: D.foe, borderColor: red, backgroundColor: 'rgba(255,91,110,.14)',
              stepped: 'after', borderWidth: 3, pointRadius: 4, pointBackgroundColor: red, fill: false },
            { label: '本作 · 我方人数（擦边 1 个/拍）', data: D.me, borderColor: blue, backgroundColor: 'rgba(61,155,255,.14)',
              stepped: 'after', borderWidth: 3, pointRadius: 4, pointBackgroundColor: blue, fill: false },
            { label: '本作 · 敌方（盖住 ' + D.cover + ' 个/拍）', data: D.foeCov, borderColor: red, borderDash: [2, 3],
              stepped: 'after', borderWidth: 2, pointRadius: 3, pointBackgroundColor: red, fill: false },
            { label: '本作 · 我方（盖住 ' + D.cover + ' 个/拍）', data: D.meCov, borderColor: blue, borderDash: [2, 3],
              stepped: 'after', borderWidth: 2, pointRadius: 3, pointBackgroundColor: blue, fill: false },
            { label: '同类 · 敌方人数（瞬间归零）', data: D.foeOne, borderColor: red, borderDash: [6, 5],
              borderWidth: 2, pointRadius: 0, fill: false },
            { label: '同类 · 我方人数（瞬间 +5）', data: D.meOne, borderColor: blue, borderDash: [6, 5],
              borderWidth: 2, pointRadius: 0, fill: false },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            x: { type: 'linear', min: 0, max: +(D.iv * D.n).toFixed(2),
              title: { display: true, text: '接触后经过的秒数（台阶间隔 = ' + D.iv + 's）' },
              ticks: { stepSize: D.iv } },
            y: { min: 0, max: 8, title: { display: true, text: '军团人数' } },
          },
          plugins: {
            legend: { labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: function (c) { return c.dataset.label + '：' + c.parsed.y + ' 人 / ' + c.parsed.x + 's'; } } },
          },
        },
      });
    }

    /* --- 图 2：内容量级条形图 --- */
    var el2 = document.getElementById('chartContent');
    if (el2 && !charts.content) {
      var S = contentSeries();
      var palette = [gold, blue, purple, green, red, '#ff8a3d', '#4dd2ff', '#ff6fd8'];
      charts.content = new window.Chart(el2, {
        type: 'bar',
        data: {
          labels: S.map(function (r) { return r[0]; }),
          datasets: [{
            label: '条目数', data: S.map(function (r) { return r[1]; }),
            backgroundColor: S.map(function (r, i) { return palette[i % palette.length] + 'cc'; }),
            borderColor: S.map(function (r, i) { return palette[i % palette.length]; }),
            borderWidth: 1.5, borderRadius: 8, maxBarThickness: 26,
          }],
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + ' 项'; } } } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
        },
      });
    }

    /* --- 图 3：难度曲线（中立小人 / 敌军总数 / 金币） --- */
    var el3 = document.getElementById('chartCurve');
    if (el3 && !charts.curve) {
      var C = difficultySeries();
      charts.curve = new window.Chart(el3, {
        type: 'line',
        data: {
          labels: C.map(function (d) { return d.id; }),
          datasets: [
            { label: '中立小人', data: C.map(function (d) { return d.neutral; }), borderColor: green,
              backgroundColor: 'rgba(46,230,168,.16)', tension: 0.3, borderWidth: 2.4, pointRadius: 3, fill: true, yAxisID: 'y' },
            { label: '敌军总人数', data: C.map(function (d) { return d.enemyTotal; }), borderColor: red,
              backgroundColor: 'rgba(255,91,110,.12)', tension: 0.3, borderWidth: 2.4, pointRadius: 3, fill: true, yAxisID: 'y' },
            { label: '通关金币', data: C.map(function (d) { return d.coins; }), borderColor: gold,
              borderDash: [6, 4], tension: 0.3, borderWidth: 2.2, pointRadius: 3, fill: false, yAxisID: 'y1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { title: { display: true, text: '主线关卡序号' } },
            y: { position: 'left', beginAtZero: true, title: { display: true, text: '人数' } },
            y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: '金币' } },
          },
          plugins: {
            legend: { labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { title: function (items) { var d = C[items[0].dataIndex]; return '第 ' + d.id + ' 关 · ' + d.name; } } },
          },
        },
      });
    }
  }

  var charts = {};
  window.OVERVIEW_CHARTS = { draw: draw, charts: function () { return charts; } };

  /* CDN 可能在 script.js 之后才就绪，故在 load 后再补画一次 */
  window.addEventListener('load', function () { if (!Object.keys(charts).length) draw(false); });
})();
