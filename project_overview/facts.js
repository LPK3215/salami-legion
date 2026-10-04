/* 本文件由 scripts/visualization/generate_overview_facts.mjs 自动生成，请勿手工编辑。
 *    重新生成：node scripts/visualization/generate_overview_facts.mjs  或  npm run overview:data
 *    生成时间：2026-10-04 15:32Z；所有数值直接来自项目源码（js/config.js、js/engine.js、
 *    js/save.js、package.json、css/style.css、index.html、test/dom.test.js、docs/04-development.md）。 */
window.OVERVIEW_FACTS = {
 "meta": {
  "project": "蚕食军团",
  "projectEn": "Salami Legion",
  "name": "salami-legion",
  "version": "1.1.0",
  "license": "MIT",
  "description": "蚕食军团（Salami Legion）—— 逐个单位吞噬的休闲军团对战游戏（纯前端 Canvas，零运行时依赖）",
  "author": "LPK3215 <17538703215@163.com>",
  "repo": "https://github.com/LPK3215/salami-legion",
  "cloneUrl": "https://github.com/LPK3215/salami-legion.git",
  "pages": "https://lpk3215.github.io/salami-legion/",
  "issues": "https://github.com/LPK3215/salami-legion/issues",
  "node": ">=18",
  "runtimeDeps": 0,
  "devDeps": 1,
  "saveKey": "mini_legion_save_v1",
  "generatedAt": "2026-10-04 15:32Z",
  "generator": "scripts/visualization/generate_overview_facts.mjs"
 },
 "content": {
  "levels": 13,
  "skills": 6,
  "buffs": 7,
  "skins": 10,
  "achievements": 14,
  "startOptions": 4,
  "enemyPalettes": 8
 },
 "mechanics": {
  "eatInterval": 0.32,
  "eatContact": 0.94,
  "worldW": 3000,
  "worldH": 2200,
  "unitRadius": 8,
  "spacing": 13,
  "maxUnits": 900,
  "unitTotalMax": 1800,
  "neutralMax": 460,
  "pickup": 26,
  "zoom": {
   "min": 0.36,
   "max": 1.12
  },
  "move": {
   "base": 140,
   "unitMax": 470,
   "sizePenalty": 0.003,
   "sizePenaltyMax": 0.12,
   "playerBonus": 1.14,
   "panic": 0.86
  },
  "gridCell": 46
 },
 "lines": {
  "index.html": 269,
  "css/style.css": 564,
  "js/config.js": 302,
  "js/engine.js": 2054,
  "js/ui.js": 815,
  "js/save.js": 98,
  "js/audio.js": 53,
  "server.js": 126,
  "test/dom.test.js": 881,
  "scripts/start.sh": 56
 },
 "test": {
  "sections": 18,
  "asserts": 157,
  "checks": 44,
  "lines": 881
 },
 "totals": {
  "jsLines": 3322,
  "cssLines": 564,
  "htmlLines": 269,
  "testLines": 881,
  "docFiles": 5,
  "screens": 9,
  "skinStyles": [
   "cap",
   "crown",
   "glasses",
   "helmet",
   "horn",
   "ninja",
   "plain",
   "rainbow"
  ]
 },
 "levels": [
  {
   "id": 1,
   "name": "初次集结",
   "goalType": "reach",
   "goalVal": 15,
   "neutral": 110,
   "par": 55,
   "gold": 36,
   "coins": 25,
   "enemies": [
    {
     "c": 5,
     "sp": 0.86,
     "ag": 0.3
    }
   ],
   "tip": "滑动屏幕移动军团，吃掉中立小人快速壮大"
  },
  {
   "id": 2,
   "name": "街头争锋",
   "goalType": "reach",
   "goalVal": 24,
   "neutral": 135,
   "par": 62,
   "gold": 42,
   "coins": 30,
   "enemies": [
    {
     "c": 6,
     "sp": 0.88,
     "ag": 0.38
    },
    {
     "c": 8,
     "sp": 0.9,
     "ag": 0.42
    }
   ],
   "tip": "比我方小的军团可以逐个吞噬，比我们大的要躲开"
  },
  {
   "id": 3,
   "name": "清扫街区",
   "goalType": "eliminate",
   "goalVal": null,
   "neutral": 160,
   "par": 85,
   "gold": 58,
   "coins": 36,
   "enemies": [
    {
     "c": 7,
     "sp": 0.9,
     "ag": 0.55
    },
    {
     "c": 9,
     "sp": 0.92,
     "ag": 0.5
    }
   ],
   "tip": "把敌人逼到地图边缘，就无处可逃了"
  },
  {
   "id": 4,
   "name": "人潮涌动",
   "goalType": "reach",
   "goalVal": 36,
   "neutral": 175,
   "par": 70,
   "gold": 48,
   "coins": 40,
   "enemies": [
    {
     "c": 8,
     "sp": 0.9,
     "ag": 0.45
    },
    {
     "c": 10,
     "sp": 0.92,
     "ag": 0.48
    },
    {
     "c": 12,
     "sp": 0.94,
     "ag": 0.5
    }
   ],
   "tip": "开局技能是翻盘关键，善用它"
  },
  {
   "id": 5,
   "name": "四面楚歌",
   "goalType": "eliminate",
   "goalVal": null,
   "neutral": 190,
   "par": 100,
   "gold": 68,
   "coins": 46,
   "enemies": [
    {
     "c": 10,
     "sp": 0.92,
     "ag": 0.58
    },
    {
     "c": 12,
     "sp": 0.94,
     "ag": 0.55
    },
    {
     "c": 14,
     "sp": 0.96,
     "ag": 0.52
    }
   ],
   "tip": "被多支军团夹击很危险，逐个击破才是上策"
  },
  {
   "id": 6,
   "name": "壮大队伍",
   "goalType": "reach",
   "goalVal": 52,
   "neutral": 210,
   "par": 82,
   "gold": 56,
   "coins": 52,
   "enemies": [
    {
     "c": 14,
     "sp": 0.94,
     "ag": 0.5
    },
    {
     "c": 16,
     "sp": 0.96,
     "ag": 0.52
    },
    {
     "c": 18,
     "sp": 0.98,
     "ag": 0.55
    }
   ],
   "tip": "人数越多编队越大，注意别让尾巴被敌人咬住"
  },
  {
   "id": 7,
   "name": "围剿行动",
   "goalType": "eliminate",
   "goalVal": null,
   "neutral": 220,
   "par": 115,
   "gold": 78,
   "coins": 58,
   "enemies": [
    {
     "c": 12,
     "sp": 0.94,
     "ag": 0.6
    },
    {
     "c": 15,
     "sp": 0.96,
     "ag": 0.58
    },
    {
     "c": 18,
     "sp": 0.98,
     "ag": 0.56
    },
    {
     "c": 20,
     "sp": 1,
     "ag": 0.6
    }
   ],
   "tip": "先吃掉最弱的那支，滚雪球才是吞噬战王道"
  },
  {
   "id": 8,
   "name": "势均力敌",
   "goalType": "reach",
   "goalVal": 72,
   "neutral": 240,
   "par": 92,
   "gold": 62,
   "coins": 66,
   "enemies": [
    {
     "c": 20,
     "sp": 0.96,
     "ag": 0.55
    },
    {
     "c": 22,
     "sp": 0.98,
     "ag": 0.58
    },
    {
     "c": 25,
     "sp": 1,
     "ag": 0.6
    },
    {
     "c": 28,
     "sp": 1.02,
     "ag": 0.62
    }
   ],
   "tip": "势均力敌时同时接触只会干瞪眼，要靠人数差取胜"
  },
  {
   "id": 9,
   "name": "大鱼吃小鱼",
   "goalType": "eliminate",
   "goalVal": null,
   "neutral": 250,
   "par": 125,
   "gold": 86,
   "coins": 74,
   "enemies": [
    {
     "c": 22,
     "sp": 0.96,
     "ag": 0.62
    },
    {
     "c": 26,
     "sp": 0.98,
     "ag": 0.6
    },
    {
     "c": 30,
     "sp": 1,
     "ag": 0.62
    },
    {
     "c": 34,
     "sp": 1.02,
     "ag": 0.65
    }
   ],
   "tip": "技能「狂暴吞噬」能大幅加快吞噬节奏"
  },
  {
   "id": 10,
   "name": "军团之战",
   "goalType": "reach",
   "goalVal": 100,
   "neutral": 290,
   "par": 108,
   "gold": 72,
   "coins": 86,
   "enemies": [
    {
     "c": 22,
     "sp": 0.98,
     "ag": 0.6
    },
    {
     "c": 26,
     "sp": 1,
     "ag": 0.62
    },
    {
     "c": 30,
     "sp": 1.02,
     "ag": 0.64
    },
    {
     "c": 34,
     "sp": 1.04,
     "ag": 0.66
    },
    {
     "c": 38,
     "sp": 1.06,
     "ag": 0.68
    }
   ],
   "tip": "注意敌人也会互相吞噬，坐山观虎斗也是战术"
  },
  {
   "id": 11,
   "name": "血战到底",
   "goalType": "eliminate",
   "goalVal": null,
   "neutral": 310,
   "par": 145,
   "gold": 100,
   "coins": 100,
   "enemies": [
    {
     "c": 26,
     "sp": 1,
     "ag": 0.65
    },
    {
     "c": 30,
     "sp": 1.02,
     "ag": 0.66
    },
    {
     "c": 34,
     "sp": 1.04,
     "ag": 0.68
    },
    {
     "c": 38,
     "sp": 1.06,
     "ag": 0.7
    },
    {
     "c": 42,
     "sp": 1.08,
     "ag": 0.72
    }
   ],
   "tip": "残血时用「坚壁」能保命，撑过反打"
  },
  {
   "id": 12,
   "name": "人海狂潮",
   "goalType": "reach",
   "goalVal": 130,
   "neutral": 330,
   "par": 125,
   "gold": 88,
   "coins": 120,
   "enemies": [
    {
     "c": 26,
     "sp": 1,
     "ag": 0.66
    },
    {
     "c": 30,
     "sp": 1.02,
     "ag": 0.68
    },
    {
     "c": 34,
     "sp": 1.04,
     "ag": 0.7
    },
    {
     "c": 38,
     "sp": 1.06,
     "ag": 0.72
    },
    {
     "c": 42,
     "sp": 1.08,
     "ag": 0.74
    },
    {
     "c": 46,
     "sp": 1.1,
     "ag": 0.76
    }
   ],
   "tip": "终极试炼：存活、壮大、然后吞掉整个世界"
  },
  {
   "id": 13,
   "name": "终章·吞天噬地",
   "goalType": "reach",
   "goalVal": 150,
   "neutral": 360,
   "par": 150,
   "gold": 110,
   "coins": 150,
   "enemies": [
    {
     "c": 32,
     "sp": 1.02,
     "ag": 0.7
    },
    {
     "c": 38,
     "sp": 1.05,
     "ag": 0.72
    },
    {
     "c": 44,
     "sp": 1.08,
     "ag": 0.74
    },
    {
     "c": 50,
     "sp": 1.1,
     "ag": 0.76
    }
   ],
   "tip": "主线最后一关。通关后主菜单的「无尽挑战」将是你真正的战场"
  }
 ],
 "skills": [
  {
   "id": "rush",
   "name": "急速集结",
   "badge": "速",
   "color": "#ffd93d",
   "cd": 22,
   "unlockAfter": 0,
   "levels": [
    "4 秒内全军团移动速度 +60%",
    "5 秒内全军团移动速度 +80%",
    "6 秒内全军团移动速度 +100%"
   ]
  },
  {
   "id": "reinforce",
   "name": "临时增援",
   "badge": "援",
   "color": "#2ee6a8",
   "cd": 26,
   "unlockAfter": 0,
   "levels": [
    "立刻召唤 4 名援军，12 秒后离队",
    "立刻召唤 6 名援军，14 秒后离队",
    "立刻召唤 8 名援军，16 秒后离队"
   ]
  },
  {
   "id": "lure",
   "name": "诱捕",
   "badge": "诱",
   "color": "#ff8a3d",
   "cd": 24,
   "unlockAfter": 2,
   "levels": [
    "4.5 秒内吸引 320 范围内的中立小人靠拢",
    "5.5 秒内吸引 430 范围内的中立小人靠拢",
    "6.5 秒内吸引 560 范围内的中立小人靠拢"
   ]
  },
  {
   "id": "frenzy",
   "name": "狂暴吞噬",
   "badge": "噬",
   "color": "#ff4d6d",
   "cd": 30,
   "unlockAfter": 4,
   "levels": [
    "5 秒内吞噬速度翻倍",
    "6 秒内吞噬速度 ×2.3",
    "7 秒内吞噬速度 ×2.6"
   ]
  },
  {
   "id": "slow",
   "name": "时间迟缓",
   "badge": "缓",
   "color": "#4dd2ff",
   "cd": 28,
   "unlockAfter": 5,
   "levels": [
    "4 秒内附近敌军移动速度 -40%",
    "5 秒内附近敌军移动速度 -50%",
    "6 秒内附近敌军移动速度 -60%"
   ]
  },
  {
   "id": "shield",
   "name": "坚壁",
   "badge": "盾",
   "color": "#9b8cff",
   "cd": 34,
   "unlockAfter": 7,
   "levels": [
    "2.5 秒内我方单位不会被吞噬",
    "3.5 秒内我方单位不会被吞噬",
    "4.5 秒内我方单位不会被吞噬"
   ]
  }
 ],
 "buffs": [
  {
   "id": "start",
   "name": "先锋增援",
   "stat": "startCount",
   "val": 2,
   "max": 4,
   "desc": "每关开局人数 +2"
  },
  {
   "id": "neutral",
   "name": "遍地人潮",
   "stat": "neutral",
   "val": 0.25,
   "max": 4,
   "desc": "地图中立小人 +25%"
  },
  {
   "id": "speed",
   "name": "行军加速",
   "stat": "speed",
   "val": 0.07,
   "max": 5,
   "desc": "军团移动速度 +7%"
  },
  {
   "id": "atk",
   "name": "狼吞虎咽",
   "stat": "atk",
   "val": 0.16,
   "max": 5,
   "desc": "吞噬速度 +16%"
  },
  {
   "id": "pickup",
   "name": "感召力",
   "stat": "pickup",
   "val": 0.25,
   "max": 3,
   "desc": "收编范围 +25%"
  },
  {
   "id": "shrink",
   "name": "威慑",
   "stat": "enemyStart",
   "val": -2,
   "max": 3,
   "desc": "敌军开局人数 -2"
  },
  {
   "id": "cd",
   "name": "战术精通",
   "stat": "cd",
   "val": 0.12,
   "max": 4,
   "desc": "技能冷却 -12%"
  }
 ],
 "skins": [
  {
   "id": "classic",
   "name": "经典蓝",
   "body": "#3d9bff",
   "style": "plain",
   "price": 0,
   "tag": "默认"
  },
  {
   "id": "sunset",
   "name": "落日橙",
   "body": "#ff8a3d",
   "style": "plain",
   "price": 200,
   "tag": ""
  },
  {
   "id": "mint",
   "name": "薄荷绿",
   "body": "#2ee6a8",
   "style": "cap",
   "price": 320,
   "tag": "鸭舌帽"
  },
  {
   "id": "rose",
   "name": "玫瑰粉",
   "body": "#ff6fd8",
   "style": "glasses",
   "price": 460,
   "tag": "酷眼镜"
  },
  {
   "id": "violet",
   "name": "星紫",
   "body": "#a66bff",
   "style": "ninja",
   "price": 620,
   "tag": "头巾"
  },
  {
   "id": "lava",
   "name": "熔岩红",
   "body": "#ff4d4d",
   "style": "horn",
   "price": 800,
   "tag": "魔角"
  },
  {
   "id": "gold",
   "name": "黄金甲",
   "body": "#ffcb2e",
   "style": "crown",
   "price": 1050,
   "tag": "皇冠"
  },
  {
   "id": "ice",
   "name": "寒冰青",
   "body": "#5ce1e6",
   "style": "helmet",
   "price": 1300,
   "tag": "头盔"
  },
  {
   "id": "shadow",
   "name": "暗影",
   "body": "#5b6480",
   "style": "ninja",
   "price": 1600,
   "tag": "头巾"
  },
  {
   "id": "rainbow",
   "name": "炫彩",
   "body": "#ff5b6e",
   "style": "rainbow",
   "price": 2200,
   "tag": "七色循环"
  }
 ],
 "achievements": [
  {
   "id": "first_win",
   "name": "初战告捷",
   "desc": "通关任意关卡",
   "coins": 50
  },
  {
   "id": "reach_25",
   "name": "人多势众",
   "desc": "单局军团达到 25 人",
   "coins": 60
  },
  {
   "id": "reach_50",
   "name": "人山人海",
   "desc": "单局军团达到 50 人",
   "coins": 110
  },
  {
   "id": "reach_100",
   "name": "千军万马",
   "desc": "单局军团达到 100 人",
   "coins": 220
  },
  {
   "id": "eat_200",
   "name": "吞噬者",
   "desc": "累计吞噬 200 个敌方单位",
   "coins": 130
  },
  {
   "id": "clear_5",
   "name": "小有名气",
   "desc": "通关第 5 关",
   "coins": 120
  },
  {
   "id": "clear_10",
   "name": "威震四方",
   "desc": "通关第 10 关",
   "coins": 240
  },
  {
   "id": "flawless",
   "name": "毫发无伤",
   "desc": "一关中未损失任何单位并通关",
   "coins": 180
  },
  {
   "id": "comeback",
   "name": "绝地翻盘",
   "desc": "我方仅剩 1 人时使用技能并通关",
   "coins": 220
  },
  {
   "id": "allstars",
   "name": "全星达人",
   "desc": "累计获得 30 颗星",
   "coins": 320
  },
  {
   "id": "collector",
   "name": "收藏家",
   "desc": "解锁 5 款皮肤",
   "coins": 200
  },
  {
   "id": "rich",
   "name": "富甲一方",
   "desc": "累计获得 3000 金币",
   "coins": 350
  },
  {
   "id": "endless_100",
   "name": "无尽征途",
   "desc": "无尽模式单局达到 100 人",
   "coins": 150
  },
  {
   "id": "endless_250",
   "name": "长夜漫漫",
   "desc": "无尽模式单局达到 250 人",
   "coins": 300
  }
 ],
 "startOptions": [
  {
   "count": 3,
   "unlockAfter": 0
  },
  {
   "count": 5,
   "unlockAfter": 2
  },
  {
   "count": 7,
   "unlockAfter": 5
  },
  {
   "count": 10,
   "unlockAfter": 9
  }
 ],
 "palettes": [
  {
   "name": "红队",
   "body": "#ff5b6e"
  },
  {
   "name": "紫队",
   "body": "#a66bff"
  },
  {
   "name": "橙队",
   "body": "#ffa63d"
  },
  {
   "name": "绿队",
   "body": "#2ee6a8"
  },
  {
   "name": "粉队",
   "body": "#ff6fd8"
  },
  {
   "name": "黄队",
   "body": "#ffd93d"
  },
  {
   "name": "青队",
   "body": "#4dd2ff"
  },
  {
   "name": "灰队",
   "body": "#9aa6bd"
  }
 ],
 "docSummaries": [
  {
   "file": "docs/01-gameplay.md",
   "title": "玩法指南",
   "quote": "这是一篇「怎么玩、怎么赢」的完整说明。看完你应该能理解这个游戏所有的判断依据。"
  },
  {
   "file": "docs/02-modes.md",
   "title": "游戏模式详解",
   "quote": "这一篇专门解释「到底有几种玩法、每种怎么结束、有没有无尽模式、地图是不是都一样大」。"
  },
  {
   "file": "docs/03-systems.md",
   "title": "系统与数值详解",
   "quote": "技能、增益、三选一奖励、成就、商店、存档，全都在这里。数值直接对应 `js/config.js`。"
  },
  {
   "file": "docs/04-development.md",
   "title": "开发者文档",
   "quote": "面向要改代码的人：架构、文件职责、引擎 API、怎么加内容、怎么测、怎么部署。"
  },
  {
   "file": "docs/05-controls-and-layout.md",
   "title": "跨端操作与布局方案",
   "quote": "本文说明网页版《蚕食军团》在电脑端与移动端上的完整交互设计："
  }
 ],
 "updateOrder": [
  "1. updateDynamicWorld() 无尽专用：世界框重算为「以玩家为中心」，回收并补足内容",
  "2. updateControl()      把玩家输入（指针/键盘）转成 player.target",
  "3. 对每个军团：",
  "aiThink()           AI 决策（有节流，不是每帧都算）",
  "updateLegion()      算速度修正 → 移动军团中心 → 单位跟随编队 → 临时援军到期",
  "4. buildUnitGrid()      把所有单位塞进空间网格（格子 46px）",
  "5. updateNeutrals()     中立小人游荡 + 被收编判定（查 3×3 邻域网格）",
  "6. updateCombat()       军团两两接触判定 + 逐个吞噬",
  "7. updateFx()           技能计时、冷却",
  "8. updateParticles()    粒子与飘字",
  "9. updateCamera()       镜头跟随、缩放、危险度",
  "10. spawnNeutral()      按需补充中立小人",
  "11. endlessRamp()       无尽专用：每秒一次，敌军数量/人数/性格对齐我方规模",
  "12. pushHud()           节流推送 HUD（含动态战场半径）",
  "13. checkGoal()         判定胜负（无尽 → 里程碑）"
 ],
 "faq": {
  "questions": 30,
  "lines": 178
 },
 "tree": [
  {
   "name": "css",
   "path": "css",
   "type": "dir",
   "children": [
    {
     "name": "style.css",
     "path": "css/style.css",
     "type": "file",
     "bytes": 26644,
     "lines": 564
    }
   ]
  },
  {
   "name": "docs",
   "path": "docs",
   "type": "dir",
   "children": [
    {
     "name": "01-gameplay.md",
     "path": "docs/01-gameplay.md",
     "type": "file",
     "bytes": 8017,
     "lines": 153
    },
    {
     "name": "02-modes.md",
     "path": "docs/02-modes.md",
     "type": "file",
     "bytes": 13344,
     "lines": 221
    },
    {
     "name": "03-systems.md",
     "path": "docs/03-systems.md",
     "type": "file",
     "bytes": 7858,
     "lines": 173
    },
    {
     "name": "04-development.md",
     "path": "docs/04-development.md",
     "type": "file",
     "bytes": 22038,
     "lines": 452
    },
    {
     "name": "05-controls-and-layout.md",
     "path": "docs/05-controls-and-layout.md",
     "type": "file",
     "bytes": 14013,
     "lines": 279
    },
    {
     "name": "architecture.svg",
     "path": "docs/architecture.svg",
     "type": "file",
     "bytes": 14806,
     "lines": 135
    },
    {
     "name": "attrition-mechanic.svg",
     "path": "docs/attrition-mechanic.svg",
     "type": "file",
     "bytes": 5581,
     "lines": 58
    },
    {
     "name": "content-scale.svg",
     "path": "docs/content-scale.svg",
     "type": "file",
     "bytes": 6527,
     "lines": 66
    }
   ]
  },
  {
   "name": "js",
   "path": "js",
   "type": "dir",
   "children": [
    {
     "name": "audio.js",
     "path": "js/audio.js",
     "type": "file",
     "bytes": 2321,
     "lines": 53
    },
    {
     "name": "config.js",
     "path": "js/config.js",
     "type": "file",
     "bytes": 17806,
     "lines": 302
    },
    {
     "name": "engine.js",
     "path": "js/engine.js",
     "type": "file",
     "bytes": 76868,
     "lines": 2054
    },
    {
     "name": "save.js",
     "path": "js/save.js",
     "type": "file",
     "bytes": 2815,
     "lines": 98
    },
    {
     "name": "ui.js",
     "path": "js/ui.js",
     "type": "file",
     "bytes": 31225,
     "lines": 815
    }
   ]
  },
  {
   "name": "project_overview",
   "path": "project_overview",
   "type": "dir",
   "children": [
    {
     "name": "assets",
     "path": "project_overview/assets",
     "type": "dir",
     "children": [
      {
       "name": ".gitkeep",
       "path": "project_overview/assets/.gitkeep",
       "type": "file",
       "bytes": 0,
       "lines": 1
      }
     ]
    },
    {
     "name": "charts.js",
     "path": "project_overview/charts.js",
     "type": "file",
     "bytes": 10053,
     "lines": 216
    },
    {
     "name": "index.html",
     "path": "project_overview/index.html",
     "type": "file",
     "bytes": 35669,
     "lines": 561
    },
    {
     "name": "script.js",
     "path": "project_overview/script.js",
     "type": "file",
     "bytes": 21603,
     "lines": 428
    },
    {
     "name": "style.css",
     "path": "project_overview/style.css",
     "type": "file",
     "bytes": 31975,
     "lines": 650
    }
   ]
  },
  {
   "name": "scripts",
   "path": "scripts",
   "type": "dir",
   "children": [
    {
     "name": "visualization",
     "path": "scripts/visualization",
     "type": "dir",
     "children": [
      {
       "name": "generate_architecture_svg.mjs",
       "path": "scripts/visualization/generate_architecture_svg.mjs",
       "type": "file",
       "bytes": 10415,
       "lines": 198
      },
      {
       "name": "generate_attrition_mechanic_svg.mjs",
       "path": "scripts/visualization/generate_attrition_mechanic_svg.mjs",
       "type": "file",
       "bytes": 7774,
       "lines": 133
      },
      {
       "name": "generate_content_scale_svg.mjs",
       "path": "scripts/visualization/generate_content_scale_svg.mjs",
       "type": "file",
       "bytes": 5686,
       "lines": 90
      },
      {
       "name": "generate_overview_facts.mjs",
       "path": "scripts/visualization/generate_overview_facts.mjs",
       "type": "file",
       "bytes": 8127,
       "lines": 182
      },
      {
       "name": "lib_load_facts.mjs",
       "path": "scripts/visualization/lib_load_facts.mjs",
       "type": "file",
       "bytes": 4778,
       "lines": 138
      }
     ]
    },
    {
     "name": "start.sh",
     "path": "scripts/start.sh",
     "type": "file",
     "bytes": 1680,
     "lines": 56
    }
   ]
  },
  {
   "name": "test",
   "path": "test",
   "type": "dir",
   "children": [
    {
     "name": "dom.test.js",
     "path": "test/dom.test.js",
     "type": "file",
     "bytes": 49186,
     "lines": 881
    }
   ]
  },
  {
   "name": ".cnb.yml",
   "path": ".cnb.yml",
   "type": "file",
   "bytes": 615,
   "lines": 15
  },
  {
   "name": ".editorconfig",
   "path": ".editorconfig",
   "type": "file",
   "bytes": 783,
   "lines": 26
  },
  {
   "name": ".gitattributes",
   "path": ".gitattributes",
   "type": "file",
   "bytes": 1297,
   "lines": 37
  },
  {
   "name": ".gitignore",
   "path": ".gitignore",
   "type": "file",
   "bytes": 268,
   "lines": 24
  },
  {
   "name": ".nojekyll",
   "path": ".nojekyll",
   "type": "file",
   "bytes": 0,
   "lines": 1
  },
  {
   "name": "AUTHORS",
   "path": "AUTHORS",
   "type": "file",
   "bytes": 651,
   "lines": 19
  },
  {
   "name": "CHANGELOG.md",
   "path": "CHANGELOG.md",
   "type": "file",
   "bytes": 18493,
   "lines": 218
  },
  {
   "name": "CODE_OF_CONDUCT.md",
   "path": "CODE_OF_CONDUCT.md",
   "type": "file",
   "bytes": 2081,
   "lines": 47
  },
  {
   "name": "CONTRIBUTING.md",
   "path": "CONTRIBUTING.md",
   "type": "file",
   "bytes": 12631,
   "lines": 206
  },
  {
   "name": "FAQ.md",
   "path": "FAQ.md",
   "type": "file",
   "bytes": 11254,
   "lines": 178
  },
  {
   "name": "index.html",
   "path": "index.html",
   "type": "file",
   "bytes": 12154,
   "lines": 269
  },
  {
   "name": "LICENSE",
   "path": "LICENSE",
   "type": "file",
   "bytes": 1064,
   "lines": 21
  },
  {
   "name": "package-lock.json",
   "path": "package-lock.json",
   "type": "file",
   "bytes": 19461,
   "lines": 549
  },
  {
   "name": "package.json",
   "path": "package.json",
   "type": "file",
   "bytes": 1125,
   "lines": 31
  },
  {
   "name": "project_overview.html",
   "path": "project_overview.html",
   "type": "file",
   "bytes": 343,
   "lines": 11
  },
  {
   "name": "README.md",
   "path": "README.md",
   "type": "file",
   "bytes": 11950,
   "lines": 212
  },
  {
   "name": "SECURITY.md",
   "path": "SECURITY.md",
   "type": "file",
   "bytes": 3267,
   "lines": 65
  },
  {
   "name": "server.js",
   "path": "server.js",
   "type": "file",
   "bytes": 4296,
   "lines": 126
  }
 ],
 "snippets": {
  "saveKey": "const SAVE_KEY = 'mini_legion_save_v1';",
  "eatCore": "          this.contacts.push({ a: A, b: B, x: (A.cx + B.cx) / 2, y: (A.cy + B.cy) / 2, r: Math.min(ra, rb) });\n\n          if (A.count === B.count) { this.pairTimers.set(key, CFG.eat.interval * 0.6); continue; }\n\n          let t = this.pairTimers.get(key);\n          if (t === undefined) t = CFG.eat.interval;\n          t -= dt;\n          if (t > 0) { this.pairTimers.set(key, t); continue; }\n\n          const big = A.count > B.count ? A : B;\n          const small = A.count > B.count ? B : A;\n\n          // 坚壁：未被吞噬方免疫\n          if (small.isPlayer && this.player.hasFx('shield')) {",
  "newGame": "        self.game = new MiniGame({\n          canvas: self.$('game-canvas'),\n          minimap: self.$('minimap'),\n          level,\n          levelIndex: idx,\n          world: level.world,\n          run: self.run,\n          controlMode: Save.data.settings.controlMode || 'auto',\n          hooks: {\n            onHud(d) { self.onHud(d); },",
  "levelDef": "  { id: 4,  name: '人潮涌动', goal: { type: 'reach', val: 36 },  neutral: 175, par: 70,  gold: 48,\n    enemies: [{ c: 8,  sp: 0.90, ag: 0.45, react: 0.55 }, { c: 10, sp: 0.92, ag: 0.48, react: 0.52 }, { c: 12, sp: 0.94, ag: 0.50, react: 0.50 }], coins: 40,\n    tip: '开局技能是翻盘关键，善用它' },\n\n  { id: 5,  name: '四面楚歌', goal: { type: 'eliminate' },       neutral: 190, par: 100, gold: 68,",
  "scriptOrder": null
 }
};
