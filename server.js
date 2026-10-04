#!/usr/bin/env node
/**
 * 蚕食军团 · 零依赖静态服务
 * 监听 0.0.0.0，供 CNB 云原生开发环境端口转发/预览使用。
 *   启动： node server.js        (或 npm start)
 *   端口： PORT 环境变量，默认 8080
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

function send(res, code, body, headers) {
  const h = Object.assign(
    { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    headers || {}
  );
  res.writeHead(code, h);
  res.end(body);
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      return send(res, 404, 'Not Found: ' + req.url, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Content-Length': st.size };
    if (req.method === 'HEAD') return send(res, 200, '', headers);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => send(res, 500, 'Read Error', { 'Content-Type': 'text/plain; charset=utf-8' }));
    res.writeHead(200, Object.assign({ 'Cache-Control': 'no-cache, no-store, must-revalidate' }, headers));
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url, true).pathname || '/');
  } catch (e) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (pathname === '/healthz' || pathname === '/api/health') {
    return send(res, 200, JSON.stringify({
      ok: true,
      service: '蚕食军团',
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    }), { 'Content-Type': 'application/json; charset=utf-8' });
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  // 防目录穿越
  const full = path.normalize(path.join(ROOT, pathname));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // 根路径与目录 -> index.html
  fs.stat(full, (err, st) => {
    if (!err && st.isDirectory()) {
      const idx = path.join(full, 'index.html');
      fs.stat(idx, (e2, s2) => {
        if (!e2 && s2.isFile()) serveFile(req, res, idx);
        else send(res, 403, 'Directory listing disabled', { 'Content-Type': 'text/plain; charset=utf-8' });
      });
      return;
    }
    serveFile(req, res, full);
  });
});

server.on('error', (e) => {
  console.error('[server] 启动失败:', e && e.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const proxy = process.env.CNB_VSCODE_PROXY_URI || '';
  console.log('==============================================');
  console.log('  蚕食军团 已启动');
  console.log('  监听地址 : http://' + HOST + ':' + PORT);
  console.log('  健康检查 : /healthz');
  if (proxy) {
    console.log('  预览网址 : ' + proxy.replace('{{port}}', String(PORT)));
  }
  console.log('==============================================');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
