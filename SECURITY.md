# 安全策略（Security Policy）

本项目是**纯浏览器端单机游戏**：没有后端服务、没有数据库、没有账号与鉴权、
不向任何第三方发送请求（页面除同源静态资源外无网络依赖，音效由 WebAudio 实时合成）。

因此绝大多数传统 Web 漏洞类别在这里**不适用**（无 SQL 注入点、无 SSRF、无认证绕过、无反序列化）。
本文只描述**真实存在的边界**。

## 支持版本

| 版本 | 是否支持 |
|---|---|
| `main` 分支最新版 | ✅ 唯一支持版本 |
| 历史 tag / 旧分支 | ❌ 不回移补丁（个人项目，请直接升级） |

## 部署形态与对应攻击面

| 形态 | 说明 | 攻击面 |
|---|---|---|
| GitHub Pages（静态托管） | https://lpk3215.github.io/salami-legion/ | 只有浏览器端代码，服务器不参与 |
| `node server.js`（本地/CNB 预览） | 零依赖静态文件服务器 | 见下 |

静态服务器已实现的防护（见 `server.js`）：

- **目录穿越防护**：`path.normalize(path.join(ROOT, pathname))` 之后强制校验结果仍在 `ROOT` 内，
  否则返回 403（`server.js` 的「防目录穿越」分支）
- **畸形 URL**：`decodeURIComponent` 抛错时返回 400，而不是崩溃
- **禁用缓存**：响应带 `Cache-Control: no-cache, no-store, must-revalidate`，避免预览环境读到陈旧存档以外的内容

## 已知且刻意保留的残余风险

1. **`localStorage` 存档属于「被信任输入」**
   存档键为 `mini_legion_save_v1`（`js/save.js`），读出的数值会进入 UI 渲染。
   `js/ui.js` 大量使用 `innerHTML` 拼接界面，但拼接来源是本地 `js/config.js` 常量与数字，
   **不接受任何网络输入或玩家自由文本**。
   → 若同一浏览器中已有能力写入本站 `localStorage`（恶意浏览器扩展、同源其它脚本），
   则存在**自我 XSS（self-XSS）**空间。这属于"零依赖单机小游戏"的有意取舍：
   引入 HTML 转义/模板引擎会增加运行时依赖，与项目定位冲突。
   如果你把本项目改造成联网/多人/接受外部数据的形态，**必须重新评估这一条**。

2. **无内容安全策略（CSP）响应头**
   GitHub Pages 无法在静态仓库里附加响应头。自托管时建议自行加
   `Content-Security-Policy: default-src 'self'`（本项目不需要外部域，可直接收紧）。

3. **MIT 许可证不提供任何保证**，详见 [LICENSE](LICENSE)。

## 如何报告漏洞

- 请**不要**开公开 Issue 报告安全问题。
- 发邮件到：**LPK3215 &lt;17538703215@163.com&gt;**，标题写明 `[security] salami-legion`。
- 若本仓库已开启 GitHub「私有漏洞报告」（Security → Report a vulnerability），也可以走那个渠道。

响应承诺（个人项目，尽力而非 SLA）：

- 48 小时内回复确认收到
- 确认后 7 天内给出评估结论与修复计划
- 修复后会公开致谢（如你希望匿名则隐去）

## 安全相关的开发约定

改动以下任一处时，请在 PR 里显式说明：

- `server.js` 的路径解析与静态文件返回逻辑
- 新增任何外部请求、CDN 依赖、第三方脚本
- 存档结构（`js/save.js`）与存档字段的读取方式
